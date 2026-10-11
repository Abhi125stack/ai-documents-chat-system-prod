import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Document from "@/models/Document";
import { getUserIdFromHeader } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";

export async function GET(req: Request) {
    try {
        await connectDB();
        const userId = getUserIdFromHeader(req);

        const { searchParams } = new URL(req.url);
        const name = searchParams.get("name");

        const query: Record<string, unknown> = { userId };
        if (name) {
            query.name = { $regex: name, $options: "i" };
        }

        const documents = await Document.find(query).sort({ createdAt: -1, _id: -1 });

        return NextResponse.json({
            message: "Documents fetched successfully!",
            success: true,
            documents,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("Fetch documents error:", err);
        return NextResponse.json({ 
            message: "Failed to fetch documents.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}
