// Self-check for src/lib/summarize.ts (no network, fake LLM).
// Run: node_modules/.bin/jiti scripts/check-summarize.ts
import assert from "node:assert/strict";
import { packBatches, selectChunks, summarize, BATCH_CHARS, type ChatMessage, type SummaryChunk } from "../src/lib/summarize";

// Same windows as upload's chunkText(text, 800, 100).
function chunk(text: string): SummaryChunk[] {
    const out: SummaryChunk[] = [];
    for (let i = 0, idx = 0; i < text.length; i += 3200 - 400, idx++) out.push({ text: text.slice(i, i + 3200), chunkIndex: idx });
    return out;
}
const words = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(" ");

// 1. Packing all chunks reproduces the original text exactly (overlap dropped).
const text = words(20_000, "w");
const all = chunk(text);
assert.equal(packBatches(all).join(""), text);
assert.ok(packBatches(all).every((b) => b.length <= BATCH_CHARS));

// 2. Small document: everything selected.
const small = chunk(words(1_000, "s"));
assert.equal(selectChunks(small, 80).coverage, 1);

// 3. Large document over budget: sample fits the budget, keeps start/end and
//    reaches distinct topics hidden in the middle.
const topicOf = (i: number, n: number) => (i < n / 2 ? 0 : 1 + (i % 5)); // 5 topics in the 2nd half
const big = chunk(words(60_000, "b")).map((c, i, arr) => {
    const e = new Array(8).fill(0);
    e[topicOf(i, arr.length)] = 1;
    return { ...c, embedding: e };
});
const { selected, coverage } = selectChunks(big, 3);
assert.ok(coverage < 1);
assert.ok(packBatches(selected).length <= 3, "sample must fit the budget");
assert.equal(selected[0].chunkIndex, 0);
assert.equal(selected[selected.length - 1].chunkIndex, big.length - 1);
const topics = new Set(selected.map((c) => topicOf(c.chunkIndex, big.length)));
assert.equal(topics.size, 6, "every topic represented");

// 4. No embeddings: stride fill still reaches the full sample size.
const plain = big.map(({ text, chunkIndex }) => ({ text, chunkIndex }));
assert.equal(selectChunks(plain, 3).selected.length, selected.length);

// 5. Map-reduce with a fake model: concurrency capped, caching honoured.
(async () => {
    let calls = 0, inFlight = 0, peak = 0;
    const complete = async (m: ChatMessage[]) => {
        calls++; inFlight++; peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return `summary(${m[1].content.length})`;
    };
    const r = await summarize([{ id: "a", name: "A", chunks: all }], complete);
    const batches = packBatches(all).length;
    assert.ok(batches > 1);
    assert.equal(calls, batches + 1, "one map call per batch + one final");
    assert.ok(peak <= 4);
    assert.deepEqual(r.toCache.map((c) => c.id), ["a"]);

    calls = 0;
    const r2 = await summarize([{ id: "a", name: "A", cachedSummary: "cached", chunks: all }], complete);
    assert.equal(calls, 0);
    assert.equal(r2.summary, "cached");

    calls = 0;
    await summarize([{ id: "a", name: "A", cachedSummary: "x", chunks: all }, { id: "b", name: "B", chunks: small }], complete);
    assert.equal(calls, 2, "small doc in one call + one combine");

    const huge = await summarize([{ id: "h", name: "H", chunks: chunk(words(400_000, "h")) }], complete);
    assert.match(huge.summary, /based on about \d+%/);
    console.log("summarize self-check: OK");
})().catch((e) => { console.error(e); process.exit(1); });
