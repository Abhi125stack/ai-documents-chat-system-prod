export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Document, { IDocument } from "@/models/Document";
import DocumentChunk from "@/models/DocumentChunk";
import { getUserIdFromHeader } from "@/lib/auth";
import { GridFSBucket } from "mongodb";
import mongoose from "mongoose";
import { Readable } from "stream";
import { getErrorMessage } from "@/lib/utils";
import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import path from "path";
import { pathToFileURL } from "url";

// --- Fix for PDF.js worker in Next.js environment (specifically for mehmet-kozan/pdf-parse) ---
try {
  // Use the root pdfjs-dist which we've now locked to 5.4.296 to match pdf-parse
  const workerPath = path.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
  const workerUrl = pathToFileURL(workerPath).toString();
  PDFParse.setWorker(workerUrl);
  console.log("PDFParse worker resolved to:", workerUrl);
} catch (e) {
  console.warn("Failed to set PDFParse worker path, letting it fall back to default/fake worker.", e);
  try { PDFParse.setWorker(undefined); } catch {}
}

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_AI_SECRET_KEY || "",
});

// Helper to chunk text
function chunkText(text: string, maxTokens: number = 800, overlapTokens: number = 100): string[] {
    const chunkSize = maxTokens * 4; // Approx 4 chars per token
    const overlap = overlapTokens * 4;
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize - overlap;
    }
    console.log("Text chunks created:", chunks.length);
    return chunks;
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const userId = getUserIdFromHeader(req);

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }

        const formData = await req.formData();
        const files = formData.getAll("files") as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ message: "No files uploaded.", success: false }, { status: 400 });
        }

        const db = mongoose.connection.db;
        if (!db) throw new Error("Database not connected");
        
        const bucket = new GridFSBucket(db, {
            bucketName: "documents",
        });

        const uploadedDocs: IDocument[] = [];

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const filename = file.name;
            const contentType = file.type || "application/pdf";

            // 1. Upload To GridFS
            const uploadStream = bucket.openUploadStream(filename, {
                metadata: { userId, contentType },
            });

            const readableStream = new Readable();
            readableStream.push(buffer);
            readableStream.push(null);

            await new Promise((resolve, reject) => {
                readableStream.pipe(uploadStream)
                    .on("error", reject)
                    .on("finish", resolve);
            });

            // 2. Create the Database Record (Pending Status)
            const newDoc = await Document.create({
                name: filename,
                size: file.size,
                fileId: uploadStream.id,
                userId,
                status: "processing",
                pages: 0
            });

            let fullText = "";
            let pages = 0;

            // 3. Extract Text Immediately
            try {
                // Parse PDF
                const parser = new PDFParse({ data: buffer });
                const textResult = await parser.getText();
                
                fullText = textResult.text || "";
                pages = textResult.total || 0;

                console.log(`PDF Parsing successful for ${filename}. Extracted ${fullText.length} characters.`);
                
                // Update total page count in DB
                newDoc.pages = pages;
                await newDoc.save();

            } catch (err) {
                console.error(`PDF Parsing failed for ${filename}:`, err);
                newDoc.status = "error";
                await newDoc.save();
                uploadedDocs.push(newDoc);
                continue; // Skip embeddings if parsing failed
            }

            // 4. Chunk & Embed Flow
            if (fullText.trim().length > 0) {
                const textChunks = chunkText(fullText, 800, 100);
                
                try {
                    // Try embeddings
                    const embedRes = await openai.embeddings.create({
                        model: "text-embedding-3-small", 
                        input: textChunks,
                    });

                    console.log(`Generated ${embedRes.data.length} embeddings for ${filename}`);
                    
                    const chunkDocs = textChunks.map((text, i) => ({
                        documentId: newDoc._id,
                        userId,
                        text,
                        chunkIndex: i,
                        embedding: embedRes.data[i].embedding || []
                    }));
                    
                    await DocumentChunk.insertMany(chunkDocs);
                    
                } catch(e) {
                    console.error("Embedding generation failed, saving raw chunks instead.", e);
                    // Fallback: save chunks without embeddings
                    const chunkDocs = textChunks.map((text, i) => ({
                        documentId: newDoc._id,
                        userId,
                        text,
                        chunkIndex: i
                    }));
                    await DocumentChunk.insertMany(chunkDocs);
                }
            }

            // 5. Finalize Document Status
            newDoc.status = "processed";
            await newDoc.save();
            uploadedDocs.push(newDoc);
        }

        return NextResponse.json({
            message: "Documents uploaded and processed successfully.",
            success: true,
            documents: uploadedDocs.map(doc => ({
                _id: doc._id.toString(),
                name: doc.name,
                size: doc.size,
                fileId: doc.fileId.toString(),
                userId: doc.userId.toString(),
                pages: doc.pages,
                status: doc.status,
                createdAt: doc.createdAt?.toISOString() || new Date().toISOString()
            })),
        }, { status: 201 });

    } catch (err: unknown) {
        console.error("CRITICAL API FAILURE [Upload]:", err);
        return NextResponse.json({ 
            message: "A critical error occurred during upload.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}
