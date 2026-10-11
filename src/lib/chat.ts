import Chat from "@/models/Chat";

type InitialMessage = { role: "user" | "assistant" | "system"; content: string; createdAt: Date };

/** Canonical key for a document set: order-independent and de-duplicated. */
export function chatKeyFor(docIds: string[]): string {
    return [...new Set(docIds.map(String))].sort().join(",");
}

/**
 * Return the single chat for (userId, document set), creating it atomically.
 *
 * Previously each route did findOne -> create, so two concurrent first requests
 * for the same selection both saw "no chat" and both inserted a duplicate.
 * Now creation is an upsert on the unique (userId, docKey) index, so the
 * database guarantees one chat per selection.
 */
export async function findOrCreateChat(
    userId: string,
    docIds: string[],
    initialMessages: InitialMessage[] = []
) {
    const docKey = chatKeyFor(docIds);

    // 1. Canonical lookup.
    const existing = await Chat.findOne({ userId, docKey });
    if (existing) return existing;

    // 2. Legacy chat created before docKey existed: adopt it by backfilling the key,
    //    so existing conversation history is preserved instead of starting a new chat.
    const legacyQuery =
        docIds.length === 1
            ? { userId, documentId: docIds[0] }
            : { userId, documentIds: { $size: docIds.length, $all: docIds } };
    try {
        const legacy = await Chat.findOneAndUpdate(
            { ...legacyQuery, docKey: { $exists: false } },
            { $set: { docKey } },
            { new: true }
        );
        if (legacy) return legacy;
    } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
        // Another request already claimed this key; fall through to read it.
    }

    // 3. Atomic create. The unique index turns a concurrent duplicate insert into
    //    E11000, in which case the winner's chat is read back.
    try {
        const chat = await Chat.findOneAndUpdate(
            { userId, docKey },
            {
                $setOnInsert: {
                    ...(docIds.length === 1 ? { documentId: docIds[0] } : { documentIds: docIds }),
                    messages: initialMessages,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (chat) return chat;
    } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
    }

    const winner = await Chat.findOne({ userId, docKey });
    if (!winner) throw new Error("Failed to find or create chat.");
    return winner;
}
