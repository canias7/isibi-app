// Batch 160 — ADVERSARIAL: money-correctness invariants for the finance calculators (amortization
// must ALWAYS tie out to the cent, for every rate incl. 0% and extreme; investment edge cases), and
// bulk mass-assignment (a bulk `set` can't write undeclared/managed columns).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 160");
const slug = "b160";
await c.ensure(slug);
await c.schema(slug, { tables: { items: { access: "admin", columns: [{ name: "title", type: "text" }, { name: "status", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const amort = (body) => c.post(`/api/db/${slug}/finance/amortization`, body, { token: A }).then((r) => r.json);
const inv = (body) => c.post(`/api/db/${slug}/finance/investment`, body, { token: A }).then((r) => r.json);

// --- Amortization ALWAYS ties out to the cent, across rate regimes + extra payments ---
const cases = [
  { principal: 250000, rate: 4.5, term: 360 },              // 30y mortgage
  { principal: 250000, rate: 4.5, term: 360, extra: 500 },  // + accelerated
  { principal: 10000, rate: 0, term: 24 },                  // 0% loan
  { principal: 10000, rate: 0, term: 24, extra: 100 },      // 0% + extra (early payoff)
  { principal: 5000, rate: 29.99, term: 24 },               // credit-card APR
  { principal: 1000, rate: 100, term: 6 },                  // extreme rate
  { principal: 333.33, rate: 7.7, term: 13 },               // odd principal/term
];
let allTieOut = true, allBalanceZero = true, allNonNeg = true, allTotals = true;
for (const cs of cases) {
  const r = await amort(cs);
  const sumPrincipal = Math.round(r.schedule.reduce((a, x) => a + x.principal, 0) * 100) / 100;
  if (sumPrincipal !== cs.principal) { allTieOut = false; console.log("  ⚠ principal not tied out:", JSON.stringify(cs), "→", sumPrincipal); }
  if (r.schedule[r.schedule.length - 1].balance !== 0) { allBalanceZero = false; console.log("  ⚠ balance not zero:", JSON.stringify(cs)); }
  if (r.schedule.some((x) => x.interest < 0 || x.principal < 0)) allNonNeg = false;
  const sumInt = Math.round(r.schedule.reduce((a, x) => a + x.interest, 0) * 100) / 100;
  if (Math.abs(r.total_interest - sumInt) > 0.01 || Math.abs(r.total_paid - (cs.principal + r.total_interest)) > 0.01) allTotals = false;
}
t.ok(allTieOut, "principal repaid sums to the exact cent for every case");
t.ok(allBalanceZero, "the final balance is exactly 0 for every case");
t.ok(allNonNeg, "no negative interest or principal in any schedule");
t.ok(allTotals, "total_interest and total_paid are internally consistent");

// --- Investment edge cases don't crash and behave sanely ---
let z = await inv({ cashflows: [0, 0, 0], rate: 10 });
t.eq(z.npv, 0, "all-zero cashflows → NPV 0");
t.eq(z.irr, null, "all-zero → no IRR (no sign change)");
t.eq(z.payback_period, null, "all-zero → no payback");
let neg = await inv({ cashflows: [-1000, -100, -50], rate: 10 });
t.ok(neg.npv < 0 && neg.irr === null, "all-outflow project → negative NPV, no IRR");
let big = await inv({ cashflows: [-100, 1000], rate: 10 });
t.ok(big.irr_pct > 800 && big.irr_pct < 1000, "a 10x return → IRR ≈ 900%");

// --- Bulk mass-assignment: a `set` can only touch DECLARED columns ---
for (const s of ["a", "b", "c"]) await c.post(`/api/db/${slug}/rows/items`, { title: s, status: "open" }, { token: A });
const firstId = (await c.get(`/api/db/${slug}/rows/items`, { token: A })).json.rows[0].id;
// set with ONLY an undeclared/managed column → rejected (nothing to update).
t.eq((await c.post(`/api/db/${slug}/rows/items/bulk`, { op: "update", where: ["status:eq:open"], set: { owner_id: 999 } }, { token: A })).status, 400, "bulk set of only owner_id → 400 (not a declared column)");
t.eq((await c.post(`/api/db/${slug}/rows/items/bulk`, { op: "update", where: ["status:eq:open"], set: { id: 1 } }, { token: A })).status, 400, "bulk set of only id → 400");
// set mixing a declared col + a forbidden one → only the declared one applies; id/owner_id untouched.
await c.post(`/api/db/${slug}/rows/items/bulk`, { op: "update", where: ["status:eq:open"], set: { status: "done", id: 777 } }, { token: A });
const after = (await c.get(`/api/db/${slug}/rows/items`, { token: A })).json.rows;
t.ok(after.every((r) => r.status === "done"), "the declared column (status) updated");
t.ok(after.some((r) => r.id === firstId), "the id was NOT overwritten by the forged set value");
t.ok(!after.some((r) => r.id === 777), "no row got the forged id");

t.done(); h.restore();
