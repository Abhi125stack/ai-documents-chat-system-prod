import { CloudClient, type Collection } from "chromadb";

// Chroma is only the vector index. Chunk text and embeddings stay in Mongo
// (DocumentChunk); Chroma stores { id: chunk _id, embedding, metadata } and
// returns ranked ids. We always pass our own OpenAI vectors, so no Chroma
// embedding function is attached (embeddingFunction: null).
export const CHUNK_COLLECTION = "doc_chunks";

let collectionPromise: Promise<Collection> | null = null;

export function getChunkCollection(): Promise<Collection> {
    if (!collectionPromise) {
        const { CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE } = process.env;
        if (!CHROMA_API_KEY || !CHROMA_TENANT || !CHROMA_DATABASE) {
            return Promise.reject(new Error("ChromaDB is not configured (CHROMA_API_KEY / CHROMA_TENANT / CHROMA_DATABASE)."));
        }
        const client = new CloudClient({
            apiKey: CHROMA_API_KEY,
            tenant: CHROMA_TENANT,
            database: CHROMA_DATABASE,
        });
        collectionPromise = client
            .getOrCreateCollection({
                name: CHUNK_COLLECTION,
                embeddingFunction: null,
                // Same metric the current in-Node ranking uses.
                configuration: { spann: { space: "cosine" } },
            })
            .catch((err) => {
                collectionPromise = null; // allow a retry on the next request
                throw err;
            });
    }
    return collectionPromise;
}

// ponytail: fixed batch size, safely under Chroma Cloud's per-write record
// limit; switch to client.getMaxBatchSize() if the limit ever bites.
const UPSERT_BATCH = 100;

export type IndexableChunk = {
    _id: unknown;
    documentId: unknown;
    userId: unknown;
    chunkIndex: number;
    embedding?: number[];
};

/** Upsert chunk vectors (id = Mongo chunk _id). Chunks without a vector are skipped. */
export async function indexChunks(chunks: IndexableChunk[]): Promise<number> {
    const rows = chunks.filter((c) => c.embedding && c.embedding.length > 0);
    if (rows.length === 0) return 0;
    const col = await getChunkCollection();
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
        const batch = rows.slice(i, i + UPSERT_BATCH);
        await col.upsert({
            ids: batch.map((c) => String(c._id)),
            embeddings: batch.map((c) => c.embedding as number[]),
            metadatas: batch.map((c) => ({
                userId: String(c.userId),
                documentId: String(c.documentId),
                chunkIndex: c.chunkIndex,
            })),
        });
    }
    return rows.length;
}

/** Ids of the nearest chunks, best first, restricted to this user's given documents. */
export async function queryChunkIds(
    embedding: number[],
    userId: string,
    documentIds: string[],
    n: number
): Promise<string[]> {
    const col = await getChunkCollection();
    const docFilter = documentIds.length === 1
        ? { documentId: documentIds[0] }
        : { documentId: { $in: documentIds } };
    const res = await col.query({
        queryEmbeddings: [embedding],
        nResults: n,
        where: { $and: [{ userId }, docFilter] },
        include: [],
    });
    return res.ids[0] ?? [];
}
