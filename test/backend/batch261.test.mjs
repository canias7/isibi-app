// Batch 261 — STAR RATINGS. A quick 1–5 star rating per item, one changeable vote per member; the average,
// count, and distribution are derived. Covers rate, average math, distribution, change-vote dedup, mine,
// remove, per-item isolation, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 261");
const slug = "b261";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const rate = (tok, item, stars) => c.post(`/api/db/${slug}/ratings/${item}`, { stars }, tok === null ? {} : { token: tok }).then((r) => r.json);
const get = (tok, item) => c.get(`/api/db/${slug}/ratings/${item}`, tok ? { token: tok } : {}).then((r) => r.json);
const remove = (tok, item) => c.del(`/api/db/${slug}/ratings/${item}`, { token: tok }).then((r) => r.json);

// --- Rate ---
t.eq((await rate(A, "prod-1", 5)).average, 5, "first 5-star → average 5");
let r = await rate(B, "prod-1", 3);
t.eq(r.count, 2, "2 ratings");
t.eq(r.average, 4, "average (5+3)/2 = 4");
await rate(C, "prod-1", 4);

// --- Distribution ---
r = await get(null, "prod-1");
t.eq(r.count, 3, "3 ratings");
t.ok(Math.abs(r.average - 4) < 0.01, "average = (5+3+4)/3 = 4");
t.eq(r.distribution[5], 1, "one 5-star");
t.eq(r.distribution[3], 1, "one 3-star");
t.eq(r.distribution[4], 1, "one 4-star");

// --- Change a vote (dedup) ---
r = await rate(B, "prod-1", 1);
t.eq(r.count, 3, "changing a vote doesn't add a new one");
t.ok(Math.abs(r.average - 3.33) < 0.01, "…average (5+1+4)/3 ≈ 3.33");
t.eq(r.distribution[3], 0, "…the old 3-star is gone");
t.eq(r.distribution[1], 1, "…now a 1-star");

// --- mine ---
t.eq((await get(A, "prod-1")).mine, 5, "A sees their own 5-star");
t.eq((await get(null, "prod-1")).mine, null, "signed-out has no mine");

// --- Remove ---
r = await remove(C, "prod-1");
t.eq(r.count, 2, "removing a rating drops the count");
t.eq((await get(C, "prod-1")).mine, null, "…and clears mine");

// --- Per-item isolation ---
await rate(A, "prod-2", 2);
t.eq((await get(null, "prod-2")).average, 2, "prod-2 has its own average");
t.eq((await get(null, "prod-1")).count, 2, "…prod-1 unchanged");

// --- Unrated item ---
t.eq((await get(null, "prod-9")).count, 0, "an unrated item → count 0");
t.eq((await get(null, "prod-9")).average, 0, "…average 0");

// --- Validation + authz ---
t.eq((await rate(A, "prod-1", 6)).status ?? 400, 400, "6 stars → 400");
t.eq((await c.post(`/api/db/${slug}/ratings/prod-1`, { stars: 0 }, { token: A })).status, 400, "0 stars → 400");
t.eq((await c.post(`/api/db/${slug}/ratings/prod-1`, { stars: 5 })).status, 401, "signed-out rate → 401");
t.eq((await c.del(`/api/db/${slug}/ratings/prod-1`)).status, 401, "signed-out remove → 401");

t.done(); h.restore();
