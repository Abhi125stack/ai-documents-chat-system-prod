import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { findOrCreateChat } from "@/lib/chat";
import Document from "@/models/Document";
import DocumentChunk from "@/models/DocumentChunk";
import { getUserIdFromHeader } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { OpenRouter } from '@openrouter/sdk';
import mongoose from "mongoose";
import OpenAI from "openai";

type ScoredChunk = { text: string; score: number };
type ChunkDoc = { text: string; embedding?: number[]; chunkIndex: number };

const openRouter = new OpenRouter({
    apiKey: process.env.OPENROUTER_AI_SECRET_KEY || '',
    httpReferer: "http://localhost:3000",
    xTitle: "AI Documents Chat System",
});

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_AI_SECRET_KEY || '',
});

// Helper for Cosine Similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const userId = getUserIdFromHeader(req);
        if (!userId) {
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }

        const body = await req.json();
        const { docId, docIds, content } = body;
        // mode distinguishes a specific-fact question (qa, default) from a
        // whole-document summary. Defaulting to "qa" keeps existing clients intact.
        const mode: "qa" | "summary" = body.mode === "summary" ? "summary" : "qa";

        // Support both single and multiple IDs
        const targetIds = docIds || (docId ? [docId] : null);

        if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0 || !content) {
            return NextResponse.json({ message: "docIds and content are required.", success: false }, { status: 400 });
        }

        // Validate all IDs are valid ObjectIds before querying
        const invalidIds = targetIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return NextResponse.json({ message: `Invalid ID format detected: ${invalidIds.join(', ')}`, success: false }, { status: 400 });
        }

        // 1. Verify documents exist and belong to user
        const documents = await Document.find({ _id: { $in: targetIds }, userId });
        if (documents.length === 0) {
            return NextResponse.json({ message: "Documents not found or access denied.", success: false }, { status: 404 });
        }

        // 2. Extract embedding for the user's question (qa mode only — summary
        //    selects chunks by position and does not need a query embedding).
        let questionEmbedding: number[] | null = null;
        if (mode === "qa") {
            try {
                const embedRes = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: content,
                });
                questionEmbedding = embedRes.data[0].embedding;
            } catch (err) {
                console.log("Failed to generate embedding for user question, falling back to keyword search.", err);
            }
        }

        // 3. Fetch chunks — only for documents verified as owned in step 1, and
        //    scoped by userId at the chunk layer too (defense in depth: retrieval
        //    can never read another user's chunks even if the id list changes).
        const ownedDocIds = documents.map((d: { _id: mongoose.Types.ObjectId }) => d._id);

        const allChunks = await DocumentChunk.find(
            { documentId: { $in: ownedDocIds }, userId }
        );
        console.log("All chunks:", allChunks.length);
        
        // 4. Select relevant chunks
        let topChunks: string[] = [];

        if (mode === "summary") {
            // Summary: do NOT rank against the instruction string (that poisons
            // retrieval with the query's own words). Pick representative coverage —
            // the leading chunks plus an even stride sample across the document —
            // ordered by position so the model sees a faithful cross-section.
            const ordered = [...allChunks].sort(
                (a: ChunkDoc, b: ChunkDoc) => a.chunkIndex - b.chunkIndex
            );
            const MAX = 6;
            if (ordered.length <= MAX) {
                topChunks = ordered.map((c: ChunkDoc) => c.text);
            } else {
                const stride = Math.ceil(ordered.length / MAX);
                for (let i = 0; i < ordered.length && topChunks.length < MAX; i += stride) {
                    topChunks.push(ordered[i].text);
                }
            }
        } else if (questionEmbedding && allChunks.some((c: ChunkDoc) => c.embedding && c.embedding.length > 0)) {
            // Semantic Search using Cosine Similarity
            const scoredChunks: ScoredChunk[] = allChunks.map((chunk: ChunkDoc) => {
                const score = (chunk.embedding && chunk.embedding.length > 0) 
                    ? cosineSimilarity(questionEmbedding!, chunk.embedding)
                    : 0;
                return { text: chunk.text, score };
            });
            
            // Sort by highest similarity
            scoredChunks.sort((a: ScoredChunk, b: ScoredChunk) => b.score - a.score);
            
            // Pick top 5 chunks
            topChunks = scoredChunks.slice(0, 5).map((c: ScoredChunk) => c.text);
        } else {
            // Fallback: Basic Keyword Search
            const searchTerms = content.toLowerCase().split(/\s+/).filter((word: string) => word.length > 3);
            const scoredChunks: ScoredChunk[] = allChunks.map((chunk: ChunkDoc) => {
                let score = 0;
                const chunkText = chunk.text.toLowerCase();
                for (const term of searchTerms) {
                    if (chunkText.includes(term)) score++;
                }
                return { text: chunk.text, score };
            });
            
            // Sort by highest occurrence matches
            scoredChunks.sort((a: ScoredChunk, b: ScoredChunk) => b.score - a.score);
            
            // Pick top 5 chunks
            topChunks = scoredChunks.slice(0, 5).map((c: ScoredChunk) => c.text);
        }

        const excerpts = topChunks.length > 0 
            ? topChunks.join("\n\n---\n\n") 
            : "No specific excerpts available.";

        const systemPrompt = {
            role: "system",
            content: mode === "summary"
                ? `You are an AI assistant. Summarize the document using the provided excerpts.
The excerpts are a representative cross-section of the document; base the summary only on them.
Do not refuse for missing specifics — summarize what is present.

Document Excerpts:
${excerpts}`
                : `You are an AI assistant answering strictly from the provided document excerpts.
If the answer is not found in the excerpts, say you could not find it.

Document Excerpts:
${excerpts}`
        };

        // 5. Find or create Chat (atomic upsert on (userId, docKey) — see lib/chat.ts)
        const chat = await findOrCreateChat(userId, targetIds);

        // 6. Prepare message history for OpenAI
        const messageHistory = chat.messages.map((msg: { role: string; content: string }) => ({
            role: msg.role,
            content: msg.content,
        }));

        // 7. Get response from OpenRouter
        let aiResponse;
        try {
            if (!process.env.OPENROUTER_AI_SECRET_KEY) {
                throw new Error("Missing AI API key in environment variables.");
            }

            const chatMessages = [
                systemPrompt,
                ...messageHistory,
                { role: "user", content: content },
            ];

            const completion = await openRouter.chat.send({
                chatGenerationParams: {
                    model: 'openai/gpt-3.5-turbo', 
                    // OpenRouter SDK's message union is stricter than our role:string shape;
                    // the runtime payload is correct, only the compile-time union differs.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    messages: chatMessages as any,
                    stream: false,
                }
            });

            aiResponse = completion.choices[0].message.content;
            console.log("AI Response:", completion.choices);
        } catch (openAiError: unknown) {
            console.error("AI API ERROR:", openAiError);
            return NextResponse.json({ 
                message: "AI Gateway error.", 
                error: getErrorMessage(openAiError), 
                success: false 
            }, { status: 502 }); 
        }

        // 8. Update Chat history
        chat.messages.push({
            role: "user",
            content,
            createdAt: new Date(),
        });
        chat.messages.push({
            role: "assistant",
            content: aiResponse,
            createdAt: new Date(),
        });

        await chat.save();

        return NextResponse.json({
            message: "Response generated successfully!",
            success: true,
            aiResponse,
            chat,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("ROOT Chat with AI error:", err);
        return NextResponse.json({ 
            message: "A critical error occurred in the chat processing system.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}
