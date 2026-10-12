// Whole-document summarization for the Analyze button.
//
// Small documents: one call over all chunks.
// Large documents: map-reduce — summarize ordered batches in parallel, then
// combine. Every chunk is read.
// Very large documents (more batches than the time budget allows): sample the
// chunks — the start and end of the document plus the chunks that are most
// different from each other by embedding — then map-reduce the sample and tell
// the user what share of the document the summary covers.
//
// Dependency-free on purpose: the LLM call is injected (`Complete`), so the
// logic can be checked without a network (see scripts/check-summarize.ts).

export type SummaryChunk = { text: string; chunkIndex: number; embedding?: number[] };
export type ChatMessage = { role: "system" | "user"; content: string };
export type Complete = (messages: ChatMessage[]) => Promise<string>;
export type DocInput = { id: string; name: string; cachedSummary?: string; chunks: SummaryChunk[] };

// ~6k tokens per call: leaves room for the prompt and answer inside
// gpt-3.5-turbo's 16k context.
export const BATCH_CHARS = 24_000;
// ponytail: budget is a batch count, not a clock. At ~6s per call and 4 in
// parallel, 80 batches is ~2 min — well under Vercel Hobby's 300s. Tune from
// real timings; upgrade path is a deadline-aware map that reduces early.
export const MAX_MAP_BATCHES = 80;
const CONCURRENCY = 4;
// Upload's chunkText overlaps consecutive chunks by 100 tokens * 4 chars.
const OVERLAP_CHARS = 400;
const GAP = "\n[...]\n";

const MAP_PROMPT = `You summarize one section of a larger document.
Write a dense summary (at most 150 words) of the key facts, names, figures, dates and conclusions in this section.
Use only the given text. "[...]" marks omitted text.`;
const FINAL_PROMPT = `Write a concise summary (about 200 words) of the document from the provided content.
Use only the provided content and do not invent details. Summarize what is present; do not refuse for missing specifics.`;
const COMBINE_PROMPT = `Merge these partial summaries of one document into a single dense summary (at most 300 words).
Keep the key facts, names, figures and conclusions. Use only the given text.`;
const MULTI_PROMPT = `Combine these per-document summaries into one concise overview (about 200 words).
Name each document and note how they relate. Use only the given summaries.`;

const byIndex = (a: SummaryChunk, b: SummaryChunk) => a.chunkIndex - b.chunkIndex;

/** Pack ordered chunks into batches of at most `limit` chars, dropping the
 *  text that consecutive chunks repeat and marking gaps between sampled ones. */
export function packBatches(ordered: SummaryChunk[], limit = BATCH_CHARS): string[] {
    const batches: string[] = [];
    let cur = "";
    let prev: SummaryChunk | undefined;
    for (const c of ordered) {
        let text = c.text;
        if (prev && c.chunkIndex === prev.chunkIndex + 1) {
            if (prev.text.endsWith(text)) text = "";
            else if (text.startsWith(prev.text.slice(-OVERLAP_CHARS))) text = text.slice(OVERLAP_CHARS);
        } else if (prev) {
            text = GAP + text;
        }
        prev = c;
        if (!text) continue;
        if (cur && cur.length + text.length > limit) {
            batches.push(cur);
            cur = "";
        }
        cur += text;
    }
    if (cur) batches.push(cur);
    return batches;
}

function normalize(v?: number[]): Float64Array | null {
    if (!v || v.length === 0) return null;
    let n = 0;
    for (const x of v) n += x * x;
    if (n === 0) return null;
    const s = 1 / Math.sqrt(n);
    return Float64Array.from(v, (x) => x * s);
}

function dot(a: Float64Array, b: Float64Array): number {
    let d = 0;
    for (let i = 0; i < a.length; i++) d += a[i] * b[i];
    return d;
}

/** Add evenly spaced unpicked indices until `picked` holds k. */
function fillStride(n: number, picked: Set<number>, k: number) {
    const free: number[] = [];
    for (let i = 0; i < n; i++) if (!picked.has(i)) free.push(i);
    const need = k - picked.size;
    for (let j = 0; j < need && j < free.length; j++) {
        picked.add(free[Math.floor((j * free.length) / need)]);
    }
}

/** Farthest-point sampling: repeatedly add the chunk least similar to
 *  everything picked so far, so distinct topics anywhere in the document get
 *  represented. Chunks without embeddings fall back to an even stride.
 *  ponytail: O(k·n·dims) — about a second at thousands of chunks; upgrade to
 *  k-means on a subsample if documents get far larger. */
function fillDiverse(ordered: SummaryChunk[], picked: Set<number>, k: number) {
    const n = ordered.length;
    const vecs = ordered.map((c) => normalize(c.embedding));
    const minDist = new Float64Array(n).fill(Infinity);
    const update = (v: Float64Array) => {
        for (let i = 0; i < n; i++) {
            const w = vecs[i];
            if (w) minDist[i] = Math.min(minDist[i], 1 - dot(v, w));
        }
    };
    for (const i of picked) {
        const v = vecs[i];
        if (v) update(v);
    }
    while (picked.size < k) {
        let best = -1;
        for (let i = 0; i < n; i++) {
            if (!picked.has(i) && vecs[i] && (best < 0 || minDist[i] > minDist[best])) best = i;
        }
        if (best < 0) break; // no embedded chunks left
        picked.add(best);
        update(vecs[best]!);
    }
    fillStride(n, picked, k);
}

/** Chunks to summarize within `budgetBatches`. Returns all of them when they
 *  fit, otherwise a start/end + diverse sample. `coverage` = share of chunks. */
export function selectChunks(chunks: SummaryChunk[], budgetBatches: number) {
    const ordered = [...chunks].sort(byIndex);
    const n = ordered.length;
    if (packBatches(ordered).length <= budgetBatches) {
        return { selected: ordered, coverage: 1 };
    }
    // Guarantees the sample packs into at most budgetBatches batches.
    const maxLen = Math.max(...ordered.map((c) => c.text.length));
    const perBatch = Math.max(1, Math.floor(BATCH_CHARS / (maxLen + GAP.length)));
    const k = Math.min(n, budgetBatches * perBatch);
    const edge = Math.min(perBatch, Math.floor(k / 4));
    const picked = new Set<number>();
    for (let i = 0; i < edge; i++) {
        picked.add(i);
        picked.add(n - 1 - i);
    }
    fillDiverse(ordered, picked, k);
    const selected = [...picked].sort((a, b) => a - b).map((i) => ordered[i]);
    return { selected, coverage: selected.length / n };
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
}

const ask = (complete: Complete, system: string, user: string) =>
    complete([{ role: "system", content: system }, { role: "user", content: user }]);

const SEP = "\n\n---\n\n";

/** Join texts into groups of at most `limit` chars. */
function groupTexts(parts: string[], limit = BATCH_CHARS): string[] {
    const out: string[] = [];
    let cur = "";
    for (const p of parts) {
        if (cur && cur.length + SEP.length + p.length > limit) {
            out.push(cur);
            cur = "";
        }
        cur += (cur ? SEP : "") + p;
    }
    if (cur) out.push(cur);
    return out;
}

/** Summaries -> one summary, merging in rounds while they exceed one call. */
async function reduce(parts: string[], complete: Complete, finalPrompt: string): Promise<string> {
    let groups = groupTexts(parts);
    while (groups.length > 1) {
        const merged = await mapPool(groups, CONCURRENCY, (g) => ask(complete, COMBINE_PROMPT, g));
        const next = groupTexts(merged);
        if (next.length >= groups.length) break; // can't shrink further
        groups = next;
    }
    return ask(complete, finalPrompt, groups.join(SEP));
}

/** Summary of one document within `budgetBatches` map calls. */
export async function summarizeDocument(chunks: SummaryChunk[], complete: Complete, budgetBatches = MAX_MAP_BATCHES) {
    const { selected, coverage } = selectChunks(chunks, budgetBatches);
    const batches = packBatches(selected);
    let summary =
        batches.length === 1
            ? await ask(complete, FINAL_PROMPT, batches[0])
            : await reduce(await mapPool(batches, CONCURRENCY, (b) => ask(complete, MAP_PROMPT, b)), complete, FINAL_PROMPT);
    if (coverage < 1) {
        const pct = Math.max(1, Math.round(coverage * 100));
        summary += `\n\n_Note: this document is very large, so this summary is based on about ${pct}% of it — its start, its end, and the sections that differ most from each other._`;
    }
    return { summary, coverage };
}

/** Summary for the selected documents. Reuses cached per-document summaries
 *  and returns the fresh ones worth caching (computed with the full budget). */
export async function summarize(docs: DocInput[], complete: Complete) {
    const pending = docs.filter((d) => !d.cachedSummary && d.chunks.length > 0);
    const totalChars = pending.reduce((s, d) => s + d.chunks.reduce((t, c) => t + c.text.length, 0), 0);
    const fresh = new Map<string, string>();
    const toCache: { id: string; summary: string }[] = [];

    // Sequential per document so the batch budget stays global.
    for (const d of pending) {
        const chars = d.chunks.reduce((t, c) => t + c.text.length, 0);
        const budget = pending.length === 1 ? MAX_MAP_BATCHES : Math.max(1, Math.floor((MAX_MAP_BATCHES * chars) / totalChars));
        const { summary, coverage } = await summarizeDocument(d.chunks, complete, budget);
        fresh.set(d.id, summary);
        // A summary squeezed by a multi-doc budget is not the best one for the
        // document alone, so only cache it if nothing was sampled away.
        if (budget === MAX_MAP_BATCHES || coverage === 1) toCache.push({ id: d.id, summary });
    }

    const parts = docs
        .map((d) => ({ name: d.name, summary: d.cachedSummary || fresh.get(d.id) }))
        .filter((p): p is { name: string; summary: string } => !!p.summary);

    if (parts.length === 0) {
        return { summary: "No text could be extracted from the selected document(s), so there is nothing to summarize.", toCache };
    }
    if (parts.length === 1) return { summary: parts[0].summary, toCache };
    const summary = await ask(complete, MULTI_PROMPT, parts.map((p) => `Document: ${p.name}\n${p.summary}`).join(SEP));
    return { summary, toCache };
}
