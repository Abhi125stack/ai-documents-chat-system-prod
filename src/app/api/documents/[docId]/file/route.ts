import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Document from "@/models/Document";
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

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }

        const document = await Document.findOne({ _id: docId, userId });

        if (!document) {
            return NextResponse.json({ message: "Document not found.", success: false }, { status: 404 });
        }

        const db = mongoose.connection.db;
        if (!db) throw new Error("Database not connected");

        const bucket = new GridFSBucket(db, {
            bucketName: "documents",
        });

        // 1. Get exact file metadata from GridFS (essential for large files)
        // This ensures we have the correct identifier and exact storage length
        const fileId = new mongoose.Types.ObjectId(document.fileId.toString());
        const fileMetadata = await db.collection("documents.files").findOne({ _id: fileId });

        if (!fileMetadata) {
            return NextResponse.json({ message: "File data not found in storage.", success: false }, { status: 404 });
        }

        const downloadStream = bucket.openDownloadStream(fileId);

        // 2. Convert to Web Stream with error propagation
        const webStream = new ReadableStream({
            start(controller) {
                downloadStream.on("data", (chunk) => {
                    controller.enqueue(new Uint8Array(chunk));
                });
                downloadStream.on("end", () => {
                    controller.close();
                });
                downloadStream.on("error", (err) => {
                    console.error("🔴 Stream error for file:", document.fileId, err);
                    controller.error(err);
                });
            },
            cancel() {
                downloadStream.destroy();
            },
        });

        return new NextResponse(webStream, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Length": fileMetadata.length.toString(),
                "Content-Disposition": `inline; filename="${encodeURIComponent(document.name)}"`,
                "Cache-Control": "private, max-age=3600",
            },
        });

    } catch (err: unknown) {
        console.error("Stream file error:", err);
        return NextResponse.json({ 
            message: "Failed to stream document.", 
            error: getErrorMessage(err), 
            success: false 
        }, { status: 500 });
    }
}
