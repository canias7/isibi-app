// Batch 343 — STRING SIMILARITY. Stateless Levenshtein + normalized similarity + Dice bigram coefficient.
// Covers identical, one edit, empty, unrelated, dice on shared bigrams, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 343");
const slug = "b343";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const sim = (a, b) => c.post(`/api/db/${slug}/string-similarity`, { a, b }).then((r) => r.json);

// --- Identical ---
let r = await sim("hello", "hello");
t.eq(r.levenshtein, 0, "identical → 0 edits");
t.eq(r.similarity, 1, "…similarity 1");
t.eq(r.dice, 1, "…dice 1");

// --- One substitution ---
r = await sim("kitten", "kitten".replace("k", "s"));
t.eq(r.levenshtein, 1, "one substitution → distance 1");
t.ok(r.similarity > 0.8, "…high similarity");

// --- Classic kitten/sitting = 3 ---
t.eq((await sim("kitten", "sitting")).levenshtein, 3, "kitten↔sitting is 3 edits");

// --- Unrelated ---
r = await sim("abc", "xyz");
t.eq(r.levenshtein, 3, "totally different short strings → distance = length");
t.eq(r.similarity, 0, "…similarity 0");

// --- Dice on shared bigrams ---
r = await sim("night", "nacht");
t.ok(r.dice > 0 && r.dice < 1, "partial bigram overlap → dice between 0 and 1");

// --- Empty ---
r = await sim("", "");
t.eq(r.similarity, 1, "two empties are identical");

// --- Case-insensitive dice, case-sensitive levenshtein ---
r = await sim("Hello", "hello");
t.eq(r.levenshtein, 1, "levenshtein is case-sensitive");
t.eq(r.dice, 1, "…dice is case-insensitive");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/string-similarity`, { a: "x" })).status, 400, "a missing b → 400");
t.eq((await c.post(`/api/db/${slug}/string-similarity`, { a: 1, b: 2 })).status, 400, "non-strings → 400");

t.done(); h.restore();
