import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { findOrCreateChat } from "@/lib/chat";
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

        const chat = await findOrCreateChat(userId, [docId], [
            {
                role: "assistant",
                content: "Hello! I'm your AI Assistant. I've analyzed this document. How can I help you today?",
                createdAt: new Date(),
            },
        ]);

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
