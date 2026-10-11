import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Chat from "@/models/Chat";
import { getUserIdFromHeader } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ docId: string }> }
) {
    try {
        await connectDB();
        const userId = getUserIdFromHeader(req);
        const { docId } = await params;

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }

        let chat = await Chat.findOne({ userId, documentId: docId });

        if (!chat) {
            // Initialize a new chat with a welcome message if it doesn't exist
            chat = await Chat.create({
                userId,
                documentId: docId,
                messages: [
                    {
                        role: "assistant",
                        content: "Hello! I'm your AI Assistant. I've analyzed this document. How can I help you today?",
                        createdAt: new Date(),
                    },
                ],
            });
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
