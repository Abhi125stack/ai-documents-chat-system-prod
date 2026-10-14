// Live check of the Chroma wiring used by upload + retrieval (no local files,
// synthetic vectors): indexChunks -> queryChunkIds ranking, the userId and
// documentId filters (single-doc and $in paths), then cleanup.
// Run: set -a; . ./.env.local; set +a; node_modules/.bin/jiti scripts/check-chroma.ts
import assert from "node:assert/strict";
import { getChunkCollection, indexChunks, queryChunkIds } from "../src/lib/chroma";

const DIM = 1536;
const vec = (seed: number) => Array.from({ length: DIM }, (_, i) => Math.sin(i * (seed + 1) * 0.37));
const run = Date.now().toString(36);
const [userA, userB] = [`checkA-${run}`, `checkB-${run}`];
const [doc1, doc2, docB] = [`d1-${run}`, `d2-${run}`, `dB-${run}`];

(async () => {
    const chunks = [
        { _id: `c0-${run}`, documentId: doc1, userId: userA, chunkIndex: 0, embedding: vec(1) },
        { _id: `c1-${run}`, documentId: doc1, userId: userA, chunkIndex: 1, embedding: vec(2) },
        { _id: `c2-${run}`, documentId: doc2, userId: userA, chunkIndex: 0, embedding: vec(3) },
        // Same vector as c1 but another user's document: must never be returned to userA.
        { _id: `cB-${run}`, documentId: docB, userId: userB, chunkIndex: 0, embedding: vec(2) },
        { _id: `cX-${run}`, documentId: doc1, userId: userA, chunkIndex: 2, embedding: [] }, // skipped
    ];
    try {
        assert.equal(await indexChunks(chunks), 4, "chunks without a vector must be skipped");

        const single = await queryChunkIds(vec(2), userA, [doc1], 5);
        assert.equal(single[0], `c1-${run}`, "nearest chunk must rank first");
        assert.deepEqual([...single].sort(), [`c0-${run}`, `c1-${run}`], "single-doc filter");

        const multi = await queryChunkIds(vec(3), userA, [doc1, doc2], 5);
        assert.equal(multi[0], `c2-${run}`, "multi-doc ($in) ranking");
        assert.ok(!multi.includes(`cB-${run}`), "another user's chunk leaked");

        assert.deepEqual(await queryChunkIds(vec(2), userA, [docB], 5), [], "userId filter must block foreign docs");
        console.log("ok: index, ranking, single/multi-doc filters, user isolation");
    } finally {
        const col = await getChunkCollection();
        await col.delete({ ids: chunks.map((c) => c._id) });
        console.log("cleanup: collection count =", await col.count());
    }
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
