import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
    throw new Error("Please define MONGODB_URI");
}

interface MongooseCache {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = global as typeof globalThis & {
    mongoose?: MongooseCache;
};

const cached: MongooseCache =
    globalForMongoose.mongoose ??
    (globalForMongoose.mongoose = { conn: null, promise: null });

export async function connectDB() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            maxPoolSize: 10,
        };
        cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (m) => {
            // CRITICAL: GridFS requires an index on { files_id: 1, n: 1 } to stream files 
            // larger than 32MB. Without this, MongoDB hits a 'Sort exceeded memory limit' 
            // error and drops the connection (leading to net::ERR_EMPTY_RESPONSE).
            try {
                const db = m.connection.db;
                if (db) {
                    await db.collection("documents.chunks").createIndex({ files_id: 1, n: 1 }, { unique: true });
                    console.log("✅ GridFS performance indices verified.");
                }
            } catch (e) {
                // Ignore if indices already exist or if permission restricted
                console.warn("GridFS Index check:", e);
            }
            return m;
        });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}