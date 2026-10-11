import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Document from "@/models/Document";
import Chat from "@/models/Chat";
import { getUserIdFromHeader } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { GridFSBucket } from "mongodb";
import mongoose from "mongoose";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ docId: string }> }
) {
    try {
        await connectDB();
        const userId = getUserIdFromHeader(req);
        const { docId } = await params;
        const idArray = docId.split(",");

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }

        if (idArray.length > 1) {
            const documents = await Document.find({ _id: { $in: idArray }, userId });
            return NextResponse.json({
                message: "Documents fetched successfully!",
                success: true,
                documents,
            }, { status: 200 });
        }

        const document = await Document.findOne({ _id: docId, userId });

        if (!document) {
            return NextResponse.json({ message: "Document not found.", success: false }, { status: 404 });
        }

        return NextResponse.json({
            message: "Document fetched successfully!",
            success: true,
            document,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("Fetch document error:", err);
        return NextResponse.json({ 
            message: "Failed to fetch document.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}

export async function DELETE(
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

        // 1. Find the document metadata
        const doc = await Document.findOne({ _id: docId, userId });

        if (!doc) {
            return NextResponse.json({ message: "Document not found or unauthorized.", success: false }, { status: 404 });
        }

        const db = mongoose.connection.db;
        if (!db) throw new Error("Database not connected");

        // 2. Delete from GridFS if fileId exists
        if (doc.fileId) {
            const bucket = new GridFSBucket(db, {
                bucketName: "documents",
            });
            try {
                await bucket.delete(new mongoose.Types.ObjectId(doc.fileId));
            } catch (gridFsError: unknown) {
                console.warn("GridFS deletion error (might already be gone):", getErrorMessage(gridFsError));
            }
        }

        // 3. Delete Associated Chats
        await Chat.deleteMany({ userId, documentId: docId });

        // 4. Delete Metadata record
        await Document.deleteOne({ _id: docId });

        return NextResponse.json({
            message: "Document deleted successfully!",
            success: true,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("Delete document error:", err);
        return NextResponse.json({ 
            message: "Failed to delete document.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}
