// Batch 288 — TRENDING / TOP-N. Each hit records an item (+ weight) with a timestamp; a public top endpoint
// aggregates the highest-scoring items within a rolling window. Covers hit, ranked top, weights, n limit,
// item filter, window exclusion of old rows, prune, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 288");
const slug = "b288";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const hit = (tok, body) => c.post(`/api/db/${slug}/trending/hit`, body, tok === null ? {} : { token: tok });
const top = (q) => c.get(`/api/db/${slug}/trending/top${q || ""}`).then((r) => r.json);
const prune = (tok, q) => c.del(`/api/db/${slug}/trending${q || ""}`, { token: tok });

// --- Record hits ---
await hit(B, { item: "a" }); await hit(B, { item: "a" }); await hit(B, { item: "a" }); // a: score 3
await hit(B, { item: "b", weight: 5 });                                                // b: score 5
await hit(B, { item: "c" });                                                           // c: score 1
t.ok((await hit(B, { item: "a" })).json.recorded, "member records a hit");            // a: score 4

// --- Top (default 24h window), ranked by score ---
let top1 = (await top("?window=24h")).top;
t.eq(top1[0].item, "b", "highest-weight item ranks first");
t.eq(top1[0].score, 5, "…score 5");
t.eq(top1[1].item, "a", "…then the most-hit item");
t.eq(top1[1].score, 4, "…score 4 (3 + 1 more)");
t.eq(top1[1].hits, 4, "…hits counted separately from score");
t.eq(top1[0].rank, 1, "ranks are assigned");

// --- n limit ---
t.eq((await top("?window=24h&n=2")).top.length, 2, "n caps the result count");

// --- item filter ---
let f = (await top("?item=a")).top;
t.eq(f.length, 1, "the item filter narrows to one");
t.eq(f[0].score, 4, "…with its score");

// --- Window excludes old rows; 'all' includes them ---
const db = h.getDb(uuid);
db.prepare("INSERT INTO _trending (item, weight, at) VALUES (?,?,?)").run("old", 100, new Date(Date.now() - 48 * 3600000).toISOString());
t.ok(!(await top("?window=24h")).top.find((x) => x.item === "old"), "a 48h-old hit is outside the 24h window");
t.ok((await top("?window=all")).top.find((x) => x.item === "old"), "…but shows in the all-time window");
t.ok((await top("?window=7d")).top.find((x) => x.item === "old"), "…and within 7 days");

// --- Prune (admin) ---
t.ok((await prune(A, "?before=" + encodeURIComponent(new Date(Date.now() + 86400000).toISOString()))).json.deleted >= 1, "admin prunes old rows");
t.eq((await top("?window=all")).top.length, 0, "…the feed is empty after pruning everything");

// --- Validation + authz ---
t.eq((await hit(B, {})).status, 400, "a missing item → 400");
t.eq((await c.post(`/api/db/${slug}/trending/hit`, { item: "x" })).status, 401, "signed-out hit → 401");
t.eq((await prune(B)).status, 403, "a member can't prune → 403");

t.done(); h.restore();
