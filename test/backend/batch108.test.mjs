// Batch 108 — numeric histogram: GET /rows/<t>/histogram?col=&buckets= → distribution over ranges
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 108");
const slug = "b108";
await c.ensure(slug);
await c.schema(slug, { tables: {
  orders: { access: "admin", columns: [{ name: "amount", type: "integer" }, { name: "region", type: "text" }] },
  scores: { access: "user", columns: [{ name: "value", type: "integer" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3
const hist = (tab, q, tok) => c.get(`/api/db/${slug}/rows/${tab}/histogram?${q}`, tok ? { token: tok } : {});

// amounts 0,10,20,…,100 (11 rows). With 10 buckets over [0,100], width=10.
for (const a of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) await c.post(`/api/db/${slug}/rows/orders`, { amount: a, region: a < 50 ? "west" : "east" }, { token: ADMIN });

let r = (await hist("orders", "col=amount&buckets=10", ADMIN)).json;
t.eq(r.min, 0, "auto min");
t.eq(r.max, 100, "auto max");
t.eq(r.width, 10, "bucket width = (max-min)/buckets");
t.eq(r.buckets.length, 10, "10 buckets");
t.eq(r.total, 11, "all 11 rows counted");
// first bucket [0,10) holds 0; each of the next holds one; the top value (100) clamps into the last bucket.
t.eq(r.buckets[0].count, 1, "bucket 0 holds the value 0");
t.eq(r.buckets[9].count, 2, "top bucket holds 90 AND the clamped max 100");
t.eq(r.buckets.reduce((s, b) => s + b.count, 0), 11, "bucket counts sum to total");
t.eq(r.buckets[0].lo, 0, "bucket 0 lo");
t.eq(r.buckets[9].hi, 100, "last bucket hi = max");

// explicit bounds + fewer buckets
let e = (await hist("orders", "col=amount&buckets=2&min=0&max=100", ADMIN)).json;
t.eq(e.buckets.length, 2, "explicit buckets honored");
t.eq(e.buckets[0].count, 5, "lower half: 0,10,20,30,40 → 5");
t.eq(e.buckets[1].count, 6, "upper half: 50..100 → 6 (incl. clamped max)");

// a where-filter narrows the population like stats does.
let wf = (await hist("orders", "col=amount&buckets=5&where=region:eq:west", ADMIN)).json;
t.eq(wf.total, 5, "where=region:west → only the 5 west rows");

// non-numeric column rejected.
t.eq((await hist("orders", "col=region&buckets=5", ADMIN)).status, 400, "non-numeric col → 400");
t.eq((await hist("orders", "buckets=5", ADMIN)).status, 400, "missing col → 400");

// user-table histogram is scoped to the caller's own rows.
await c.post(`/api/db/${slug}/rows/scores`, { value: 5 }, { token: A });
await c.post(`/api/db/${slug}/rows/scores`, { value: 15 }, { token: A });
await c.post(`/api/db/${slug}/rows/scores`, { value: 99 }, { token: B });
t.eq((await hist("scores", "col=value&buckets=10", A)).json.total, 2, "A sees only their 2 scores");
t.eq((await hist("scores", "col=value&buckets=10", B)).json.total, 1, "B sees only their 1 score");
t.eq((await hist("scores", "col=value&buckets=10")).status, 401, "user-table histogram needs a login");

// degenerate range (all equal) → one bucket with everything.
await c.post(`/api/db/${slug}/rows/orders`, { amount: 42, region: "x" }, { token: ADMIN }); // extra row
let flat = (await hist("orders", "col=amount&buckets=5&min=7&max=7", ADMIN)).json;
t.eq(flat.buckets.length, 1, "degenerate min==max → single bucket");
t.eq(flat.width, 0, "degenerate width 0");

// POST not allowed.
t.eq((await c.post(`/api/db/${slug}/rows/orders/histogram`, {}, { token: ADMIN })).status, 405, "histogram is GET-only");

t.done(); h.restore();
