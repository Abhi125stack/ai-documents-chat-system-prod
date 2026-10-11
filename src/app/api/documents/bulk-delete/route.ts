import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Document from "@/models/Document";
import Chat from "@/models/Chat";
import { getUserIdFromHeader } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { GridFSBucket } from "mongodb";
import mongoose from "mongoose";

export async function POST(req: Request) {
    try {
        await connectDB();
        const userId = getUserIdFromHeader(req);

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }

        const { docIds } = await req.json();

        if (!Array.isArray(docIds) || docIds.length === 0) {
            return NextResponse.json({ message: "No document IDs provided.", success: false }, { status: 400 });
        }

        // 1. Find all document metadata for these IDs and user
        const docs = await Document.find({ _id: { $in: docIds }, userId });

        if (docs.length === 0) {
            return NextResponse.json({ message: "No matching documents found.", success: false }, { status: 404 });
        }

        const db = mongoose.connection.db;
        if (!db) throw new Error("Database not connected");

        const bucket = new GridFSBucket(db, {
            bucketName: "documents",
        });

        // 2. Delete files from GridFS for each document
        for (const doc of docs) {
            if (doc.fileId) {
                try {
                    await bucket.delete(new mongoose.Types.ObjectId(doc.fileId));
                } catch (gridFsError: unknown) {
                    console.warn(`GridFS deletion error for file ${doc.fileId}:`, getErrorMessage(gridFsError));
                }
            }
        }

        const docIdsToDelete = docs.map(d => d._id);

        // 3. Delete Associated Chats in bulk
        await Chat.deleteMany({ userId, documentId: { $in: docIdsToDelete } });

        // 4. Delete Metadata records in bulk
        const result = await Document.deleteMany({ _id: { $in: docIdsToDelete } });

        return NextResponse.json({
            message: `${result.deletedCount} documents deleted successfully!`,
            success: true,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("Bulk delete documents error:", err);
        return NextResponse.json({ 
            message: "Failed to delete documents.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}
