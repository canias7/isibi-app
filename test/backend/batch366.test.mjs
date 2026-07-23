// Batch 366 — COMMISSION CALCULATOR. Stateless: flat rate OR marginal tiers (like progressive tax). Returns
// commission, effective rate, and a per-bracket breakdown. Amounts are numbers; commission rounds to cents.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 366");
const slug = "b366";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const cm = (body) => c.post(`/api/db/${slug}/commission`, body).then((r) => r.json);

// --- Flat rate ---
let r = await cm({ amount: 1000, rate: 0.1 });
t.eq(r.commission, 100, "10% of $1000 = $100");
t.eq(r.effective_rate, 0.1, "…effective rate 0.1");

// --- Marginal tiers (progressive) ---
// 5% up to 1000, 10% from 1000-5000, 15% above 5000. On $6000:
// 1000*.05 (50) + 4000*.10 (400) + 1000*.15 (150) = 600
r = await cm({ amount: 6000, tiers: [{ upto: 1000, rate: 0.05 }, { upto: 5000, rate: 0.10 }, { rate: 0.15 }] });
t.eq(r.commission, 600, "tiered commission sums the brackets");
t.eq(r.breakdown.length, 3, "…three brackets touched");
t.eq(r.breakdown[2].to, 6000, "…the open top bracket caps at the actual amount");

// --- Amount inside the first bracket only ---
r = await cm({ amount: 500, tiers: [{ upto: 1000, rate: 0.05 }, { rate: 0.15 }] });
t.eq(r.commission, 25, "an amount under the first cap uses only that bracket");
t.eq(r.breakdown.length, 1, "…one bracket");

// --- Tiers given out of order still work ---
r = await cm({ amount: 2000, tiers: [{ rate: 0.15 }, { upto: 1000, rate: 0.05 }] });
t.eq(r.commission, 50 + 150, "unsorted tiers are sorted by cap");

// --- Zero amount ---
r = await cm({ amount: 0, rate: 0.2 });
t.eq(r.commission, 0, "zero amount → zero commission");
t.eq(r.effective_rate, 0, "…effective rate 0");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/commission`, { amount: -5, rate: 0.1 })).status, 400, "negative amount → 400");
t.eq((await c.post(`/api/db/${slug}/commission`, { amount: 100, rate: 1.5 })).status, 400, "rate > 1 → 400");
t.eq((await c.post(`/api/db/${slug}/commission`, { amount: 100 })).status, 400, "no rate and no tiers → 400");
t.eq((await c.post(`/api/db/${slug}/commission`, { amount: 100, tiers: [{ upto: 50, rate: 2 }] })).status, 400, "a tier rate > 1 → 400");

t.done(); h.restore();
