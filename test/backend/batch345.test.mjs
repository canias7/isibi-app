// Batch 345 — SENTIMENT. Stateless lexicon scorer with simple negation. Covers positive, negative, neutral,
// negation flip, matched-word lists, comparative, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 345");
const slug = "b345";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const sn = (text) => c.post(`/api/db/${slug}/sentiment`, { text }).then((r) => r.json);

// --- Positive ---
let r = await sn("This product is great and I love it, absolutely wonderful!");
t.ok(r.score > 0, "positive text scores > 0");
t.eq(r.label, "positive", "…labelled positive");
t.ok(r.positive.includes("great") && r.positive.includes("love"), "…matched positive words listed");

// --- Negative ---
r = await sn("Terrible experience, the app is buggy and slow. I hate it.");
t.ok(r.score < 0, "negative text scores < 0");
t.eq(r.label, "negative", "…labelled negative");
t.ok(r.negative.includes("terrible"), "…matched negative words listed");

// --- Neutral (no lexicon words) ---
r = await sn("The meeting is scheduled for three o'clock on Tuesday.");
t.eq(r.score, 0, "text with no sentiment words → 0");
t.eq(r.label, "neutral", "…labelled neutral");

// --- Negation flips polarity ---
let pos = await sn("this is good");
let neg = await sn("this is not good");
t.ok(pos.score > 0, "'good' is positive");
t.ok(neg.score < 0, "'not good' flips to negative");

// --- Comparative scales by length ---
r = await sn("great");
t.eq(r.comparative, r.score / r.words, "comparative = score / word count");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/sentiment`, { text: "   " })).status, 400, "blank text → 400");
t.eq((await c.post(`/api/db/${slug}/sentiment`, {})).status, 400, "missing text → 400");

t.done(); h.restore();
