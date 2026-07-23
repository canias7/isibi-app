// Batch 243 — RELATED CONTENT. A stateless recommender: given a set of items with tags and a target id,
// rank the others by how many tags they share with the target. Covers ranking by shared count, Jaccard
// score, limit, zero-overlap exclusion, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 243");
const slug = "b243";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const related = (body) => c.post(`/api/db/${slug}/related`, body).then((r) => r.json);
const items = [
  { id: "a", tags: ["js", "react", "frontend"] },
  { id: "b", tags: ["js", "react", "hooks"] },       // shares js+react (2) with a
  { id: "c", tags: ["js", "backend"] },              // shares js (1) with a
  { id: "d", tags: ["python", "ml"] },               // shares nothing with a
  { id: "e", tags: ["react", "frontend", "css"] },   // shares react+frontend (2) with a
];

// --- Rank by shared-tag count ---
let r = await related({ items, target: "a" });
t.eq(r.related.length, 3, "3 items share at least one tag with 'a' (b, c, e)");
t.ok(!r.related.some((x) => x.id === "d"), "'d' (no overlap) is excluded");
t.eq(r.related[0].shared, 2, "the top match shares 2 tags");
t.ok(["b", "e"].includes(r.related[0].id), "…and is b or e");
t.eq(r.related[r.related.length - 1].id, "c", "'c' (1 shared) ranks last");

// --- Jaccard tiebreak: e (2/4) beats b (2/4)? equal — check score present ---
t.ok(r.related.every((x) => x.score >= 0 && x.score <= 1), "each has a 0..1 similarity score");
// e shares react+frontend; union(a,e) = {js,react,frontend,css} = 4 → 2/4 = 0.5
const e = r.related.find((x) => x.id === "e");
t.eq(e.score, 0.5, "e's Jaccard score is 2/4 = 0.5");

// --- The target itself is never in the results ---
t.ok(!r.related.some((x) => x.id === "a"), "the target is excluded from its own related list");

// --- Limit ---
t.eq((await related({ items, target: "a", limit: 1 })).related.length, 1, "limit caps the results");

// --- Target with no shared tags → empty ---
r = await related({ items, target: "d" });
t.eq(r.related.length, 0, "a target that shares nothing → empty related list");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/related`, { target: "a" })).status, 400, "missing items → 400");
t.eq((await c.post(`/api/db/${slug}/related`, { items })).status, 400, "missing target → 400");
t.eq((await c.post(`/api/db/${slug}/related`, { items, target: "zzz" })).status, 400, "a target not in items → 400");

t.done(); h.restore();
