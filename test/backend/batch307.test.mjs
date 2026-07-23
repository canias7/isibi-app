// Batch 307 — READABILITY. Stateless text analyzer: word/sentence/syllable counts, reading time, Flesch
// reading-ease + Flesch-Kincaid grade. Covers counts, reading time, score direction (simple vs complex), wpm.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 307");
const slug = "b307";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const rd = (body) => c.post(`/api/db/${slug}/readability`, body).then((r) => r.json);

// --- Counts ---
let r = await rd({ text: "The cat sat. The dog ran fast." });
t.eq(r.words, 7, "counts words");
t.eq(r.sentences, 2, "counts sentences by terminal punctuation");
t.ok(r.syllables >= 7, "counts at least one syllable per word");
t.ok(r.chars > 0, "reports char count");

// --- Reading time scales with wpm ---
const long = Array.from({ length: 400 }, () => "word").join(" ");
r = await rd({ text: long });
t.eq(r.reading_time_min, 2, "400 words at 200 wpm → 2 min");
t.eq((await rd({ text: long, wpm: 400 })).reading_time_min, 1, "…at 400 wpm → 1 min");

// --- Simple text scores higher (easier) than complex text ---
const simple = await rd({ text: "I go to the store. I buy milk. I go home." });
const complex = await rd({ text: "Notwithstanding the aforementioned considerations, the multifaceted implementation necessitated substantial reconsideration." });
t.ok(simple.flesch_reading_ease > complex.flesch_reading_ease, "simpler text has a higher reading-ease");
t.ok(complex.flesch_kincaid_grade > simple.flesch_kincaid_grade, "complex text has a higher grade level");

// --- Single sentence with no terminal punctuation still counts as 1 ---
r = await rd({ text: "just a few words here" });
t.eq(r.sentences, 1, "text without punctuation → 1 sentence");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/readability`, { text: "   " })).status, 400, "blank text → 400");
t.eq((await c.post(`/api/db/${slug}/readability`, {})).status, 400, "missing text → 400");

t.done(); h.restore();
