// Batch 173 — TIERED / MARGINAL COMMISSION calculator (stateless /finance calc). A flat `rate` or
// `brackets[]` where each bracket's rate applies ONLY to the portion of `amount` inside it (marginal,
// like income-tax brackets), cents-exact, plus an optional flat `base`. Covers: flat, marginal across
// tiers, an amount that stops inside one bracket, unsorted brackets, base add-on, and the guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 173");
const slug = "b173";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // any signed-in member may calc
const comm = (body, opts) => c.post(`/api/db/${slug}/finance/commission`, body, opts === undefined ? { token: A } : opts);
const TIERS = [{ up_to: 1000, rate: 5 }, { up_to: 5000, rate: 10 }, { rate: 15 }]; // last = open-ended

// --- FLAT rate ---
let r = (await comm({ amount: 1000, rate: 10 })).json;
t.eq([r.amount, r.commission, r.effective_rate], [1000, 100, 10], "flat 10% of 1000 = 100");
t.eq(r.brackets, [{ from: 0, to: null, rate: 10, portion: 1000, commission: 100 }], "flat → single open bracket line");

// --- MARGINAL: amount stops inside the 2nd tier ---
r = (await comm({ amount: 3000, brackets: TIERS })).json;
t.eq(r.commission, 250, "3000: 1000@5% (50) + 2000@10% (200) = 250");
t.eq(r.brackets, [
  { from: 0, to: 1000, rate: 5, portion: 1000, commission: 50 },
  { from: 1000, to: 5000, rate: 10, portion: 2000, commission: 200 },
], "only the two touched tiers appear; the open tier is untouched");
t.eq(r.effective_rate, 8.33, "effective rate = 250/3000 ≈ 8.33%");

// --- MARGINAL: amount spans every tier (into the open-ended top) ---
r = (await comm({ amount: 10000, brackets: TIERS })).json;
t.eq(r.commission, 1200, "10000: 50 + 400 + 750 = 1200 across all three tiers");
t.eq(r.brackets.length, 3, "all three tiers produce a line");
t.eq(r.brackets[2], { from: 5000, to: null, rate: 15, portion: 5000, commission: 750 }, "top open tier: 5000@15% = 750");
t.eq(Math.round(r.brackets.reduce((s, b) => s + b.portion, 0)), 10000, "portions sum back to the amount");

// --- Amount entirely inside the first tier → only one line, the higher tiers never engage ---
r = (await comm({ amount: 500, brackets: TIERS })).json;
t.eq([r.commission, r.brackets.length], [25, 1], "500 → 25, single tier line (no phantom empty tiers)");

// --- Unsorted brackets are sorted before the marginal walk ---
r = (await comm({ amount: 3000, brackets: [{ rate: 15 }, { up_to: 5000, rate: 10 }, { up_to: 1000, rate: 5 }] })).json;
t.eq(r.commission, 250, "same 250 regardless of input bracket order");

// --- Flat `base` added on top; effective rate reflects it ---
r = (await comm({ amount: 1000, rate: 10, base: 50 })).json;
t.eq([r.commission, r.base, r.effective_rate], [150, 50, 15], "100 commission + 50 base = 150 (15% eff)");

// --- Cents-exactness on an odd rate ---
r = (await comm({ amount: 333.33, rate: 7.5 })).json;
t.eq(r.commission, 25, "7.5% of 333.33 = 24.99975 → rounds to 25.00 to the cent");

// --- amount 0 → zero commission (base still applies) ---
r = (await comm({ amount: 0, rate: 10, base: 20 })).json;
t.eq([r.commission, r.effective_rate, r.brackets.length], [20, 0, 0], "amount 0 → base only, eff 0, no tier lines");

// --- GUARDS ---
t.eq((await comm({ amount: 1000, rate: 10 }, {})).status, 401, "signed-out → 401");
t.eq((await comm({ amount: -1, rate: 5 })).status, 400, "negative amount → 400");
t.eq((await comm({ amount: 1000 })).status, 400, "no rate and no brackets → 400");
t.eq((await comm({ amount: 1000, brackets: [{ up_to: 500, rate: 200000 }] })).status, 400, "bracket rate out of range → 400");
t.eq((await comm({ amount: 1000, brackets: Array.from({ length: 51 }, () => ({ rate: 1 })) })).status, 400, "> 50 brackets → 400");

t.done(); h.restore();
