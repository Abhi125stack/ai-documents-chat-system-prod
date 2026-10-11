import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Chat from "@/models/Chat";
import { getUserIdFromHeader } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import "@/models/Document"; // Ensure Document model is registered for populate

export async function GET(req: Request) {
    try {
        await connectDB();
        const userId = getUserIdFromHeader(req);

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }

        // Fetch all chat sessions for this user where they have sent at least one message
        // Populating documentId to get the document name and other info
        const rawChats = await Chat.find({ 
            userId,
            "messages.role": "user"
        })
            .populate("documentId", "name size status createdAt")
            .sort({ createdAt: -1 });

        // Filter out chats where the document no longer exists
        const chats = rawChats.filter((chat: { documentId: unknown }) => chat.documentId !== null);

        return NextResponse.json({
            message: "Chat history fetched successfully!",
            success: true,
            chats,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("Fetch chat history error:", err);
        return NextResponse.json({ 
            message: "Failed to fetch chat history.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}
