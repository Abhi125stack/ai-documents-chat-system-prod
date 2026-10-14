import mongoose, { Document } from "mongoose";
import { DocumentStatus } from "@/types";

export interface IDocument extends Document {
    name: string;
    size: number;
    fileId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    pages?: number;
    summary?: string;
    vectorIndexed?: boolean;
    status: DocumentStatus;
    createdAt: Date;
    updatedAt: Date;
}


const DocumentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Filename is required"],
        },
        size: {
            type: Number,
            required: true,
        },
        fileId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "documents.files", // Correct reference to our GridFS bucket files
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },
        pages: {
            type: Number,
            default: 0,
        },
        // Cached Analyze summary (documents are immutable after upload).
        summary: {
            type: String,
        },
        // True once every embedded chunk is in the Chroma index. Retrieval uses
        // Chroma only when all selected documents are indexed, else the in-Node scan.
        vectorIndexed: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["processing", "processed", "error"],
            default: "processed",
        },
    },
    { timestamps: true }
);

export default mongoose.models.Document || mongoose.model<IDocument>("Document", DocumentSchema);
