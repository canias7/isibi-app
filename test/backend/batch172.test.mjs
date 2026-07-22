// Batch 172 — installment / payment-plan schedule (stateless /finance calc): split a `total` into
// `count` equal installments after an optional `down`. rate 0 → equal-principal split; rate > 0 →
// amortized over the financed amount. Cents-exact: principal ties out, the final balance is 0.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 172");
const slug = "b172";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const TOK = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const plan = (body, tok) => c.post(`/api/db/${slug}/finance/installments`, body, tok === null ? {} : { token: tok || TOK });

// --- rate 0: even $1200 over 12 → twelve $100 installments, no interest ---
let a = (await plan({ total: 1200, count: 12 })).json;
t.eq(a.payment, 100, "even split → $100/installment");
t.eq(a.financed, 1200, "financed = total when no down");
t.eq(a.total_interest, 0, "rate 0 → no interest");
t.eq(a.total_paid, 1200, "total_paid = sum of installments");
t.eq(a.schedule.length, 12, "12 rows for 12 installments");
t.eq(a.schedule[11].balance, 0, "final balance is exactly 0");
t.eq(a.schedule[0].n, 1, "rows are 1-indexed via n");
t.eq(Math.round(a.schedule.reduce((s, x) => s + x.principal, 0) * 100) / 100, 1200, "principal ties out to the cent");

// --- down payment: $1200 with $200 down over 12, rate 0 → finance $1000; last installment absorbs residual ---
let b = (await plan({ total: 1200, count: 12, down: 200 })).json;
t.eq(b.financed, 1000, "financed = total − down");
t.eq(b.payment, 83.33, "level installment = round(1000/12) = 83.33");
t.eq(b.schedule[11].amount, 83.37, "final installment absorbs the rounding residual");
t.eq(b.total_paid, 1000, "installments sum to the financed amount");
t.eq(Math.round(b.schedule.reduce((s, x) => s + x.amount, 0) * 100) / 100, 1000, "installment amounts sum to financed");

// --- amortized (rate > 0): $1000 over 12 at 12% APR ---
let d = (await plan({ total: 1000, count: 12, rate: 12 })).json;
t.eq(d.payment, 88.85, "amortized level payment ≈ $88.85");
t.eq(d.schedule[0].interest, 10, "first-period interest = 1000 × 1% = $10");
t.eq(d.schedule[0].principal, 78.85, "first-period principal = payment − interest");
t.eq(d.schedule[11].balance, 0, "amortized balance ends exactly at 0");
t.eq(Math.round(d.schedule.reduce((s, x) => s + x.principal, 0) * 100) / 100, 1000, "amortized principal ties out to the cent");
t.eq(Math.round(d.schedule.reduce((s, x) => s + x.interest, 0) * 100) / 100, d.total_interest, "total_interest = Σ interest");
t.ok(d.schedule.every((x) => x.interest >= 0 && x.principal >= 0), "no negative interest or principal");
t.ok(d.schedule[0].interest > d.schedule[10].interest, "interest is front-loaded (declines over time)");

// --- start + freq stamps each installment's due date (first one period out) ---
let e = (await plan({ total: 1200, count: 4, start: "2026-01-15" })).json;
t.eq(e.schedule.map((x) => x.date), ["2026-02-15", "2026-03-15", "2026-04-15", "2026-05-15"], "monthly due dates stamped from start");

// --- down covers the whole total → financed 0, all-zero schedule of `count` rows ---
let f = (await plan({ total: 1000, count: 6, down: 1000 })).json;
t.eq(f.financed, 0, "down == total → nothing financed");
t.eq(f.schedule.length, 6, "still returns `count` rows");
t.eq(f.total_paid, 0, "nothing to pay in installments");

// --- guards ---
t.eq((await plan({ total: 0, count: 12 })).status, 400, "total must be positive → 400");
t.eq((await plan({ total: 100, count: 0 })).status, 400, "count 0 → 400");
t.eq((await plan({ total: 100, count: 601 })).status, 400, "count > 600 → 400");
t.eq((await plan({ total: 100, count: 5, down: 200 })).status, 400, "down > total → 400");
t.eq((await plan({ total: 100, count: 5, down: -1 })).status, 400, "negative down → 400");
t.eq((await plan({ total: 100, count: 5, rate: 2000 })).status, 400, "rate > 1000 → 400");
t.eq((await plan({ total: 100, count: 5, rate: -1 })).status, 400, "negative rate → 400");
t.eq((await plan({ total: 1200, count: 12 }, null)).status, 401, "signed-out → 401");

t.done(); h.restore();
