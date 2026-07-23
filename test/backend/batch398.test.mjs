// Batch 398 — WORD FREQUENCY. Stateless top-terms counter (lower-cased, split on non-letters), optional
// stop-word removal + top cap. Covers counting, ordering, stopwords toggle, top cap, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 398");
const slug = "b398";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const wf = (text, opts = {}) => c.post(`/api/db/${slug}/word-frequency`, { text, ...opts }).then((r) => r.json);

// --- Counting + ordering ---
let r = await wf("apple banana apple cherry apple banana");
t.eq(r.top[0].word, "apple", "most frequent word first");
t.eq(r.top[0].count, 3, "…count 3");
t.eq(r.top[1].word, "banana", "second most frequent");
t.eq(r.top[1].count, 2, "…count 2");
t.eq(r.unique_words, 3, "3 unique words");
t.eq(r.total_words, 6, "6 total words");

// --- Stopwords removed by default ---
r = await wf("the cat and the dog and the bird");
t.ok(!r.top.some((w) => w.word === "the"), "'the' is stripped by default");
t.ok(!r.top.some((w) => w.word === "and"), "'and' is stripped");
t.ok(r.top.some((w) => w.word === "cat"), "content words remain");

// --- Stopwords off ---
r = await wf("the the the cat", { stopwords: false });
t.eq(r.top[0].word, "the", "with stopwords off, 'the' is counted");
t.eq(r.top[0].count, 3, "…3 times");

// --- Top cap ---
r = await wf("a1 b2 c3 d4 e5 f6", { top: 2, stopwords: false });
t.eq(r.top.length, 2, "top:2 returns just 2");
t.eq(r.unique_words, 6, "…but unique_words counts all");

// --- Case-insensitive ---
t.eq((await wf("Cat CAT cat")).top[0].count, 3, "case-insensitive counting");

// --- Ties broken alphabetically ---
r = await wf("zebra apple", { stopwords: false });
t.eq(r.top[0].word, "apple", "equal counts → alphabetical order");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/word-frequency`, {})).status, 400, "no text → 400");

t.done(); h.restore();
