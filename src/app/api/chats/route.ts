import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Chat from "@/models/Chat";
import { getUserIdFromHeader } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import mongoose from "mongoose";

export async function GET(req: Request) {
    try {
        await connectDB();
        const userId = getUserIdFromHeader(req);

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const idsString = searchParams.get("ids");

        if (!idsString) {
            return NextResponse.json({ message: "No document IDs provided.", success: false }, { status: 400 });
        }

        // Decode in case IDs are URL-encoded strings (e.g. contain %2C)
        const decodedIds = decodeURIComponent(idsString);
        const docIds = decodedIds.split(/,|%2C/).filter(id => id.trim() !== "");
        
        // Validate all IDs
        const invalidIds = docIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return NextResponse.json({ message: `Invalid ID format detected: ${invalidIds.join(', ')}`, success: false }, { status: 400 });
        }

        let chat;
        if (docIds.length === 1) {
            chat = await Chat.findOne({ userId, documentId: docIds[0] });
        } else {
            // Find chat that contains exactly these IDs
            chat = await Chat.findOne({ 
                userId, 
                documentIds: { $size: docIds.length, $all: docIds } 
            });
        }

        if (!chat) {
            const chatData: Record<string, unknown> = {
                userId,
                messages: [
                    {
                        role: "assistant",
                        content: `Hello! I'm your AI Assistant. I've contextualized ${docIds.length > 1 ? `these ${docIds.length} documents` : "this document"}. How can I help you today?`,
                        createdAt: new Date(),
                    },
                ],
            };

            if (docIds.length === 1) {
                chatData.documentId = docIds[0];
            } else {
                chatData.documentIds = docIds;
            }

            chat = await Chat.create(chatData);
        }

        return NextResponse.json({
            message: "Chat fetched successfully!",
            success: true,
            chat,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("Fetch chat error:", err);
        return NextResponse.json({ 
            message: "Failed to fetch chat.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}
