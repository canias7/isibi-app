// Batch 151 — loan amortization calculator (LMS/mortgage/BNPL): level-payment schedule that
// ties out to the cent, a 0% case, an extra-principal early-payoff case, dates, and guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 151");
const slug = "b151";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const TOK = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const amort = (body, tok) => c.post(`/api/db/${slug}/finance/amortization`, body, tok === null ? {} : { token: tok || TOK });
const sumPrincipal = (s) => Math.round(s.reduce((a, r) => a + r.principal, 0) * 100) / 100;

// Classic 30-year mortgage: $100,000 @ 6% APR, 360 monthly payments → ~$599.55/mo.
let r = (await amort({ principal: 100000, rate: 6, term: 360 })).json;
t.ok(Math.abs(r.payment - 599.55) < 0.05, "monthly payment ≈ $599.55");
t.eq(r.periods, 360, "360 payments");
t.eq(r.schedule[0].interest, 500, "first period interest = 100000 * 0.5% = $500");
t.ok(Math.abs(r.schedule[0].principal - (r.payment - 500)) < 0.001, "first principal = payment − interest");
t.eq(r.schedule[359].balance, 0, "balance is exactly 0 after the last payment");
t.eq(sumPrincipal(r.schedule), 100000, "principal repaid ties out to the cent");
t.ok(Math.abs(r.total_paid - (100000 + r.total_interest)) < 0.001, "total paid = principal + total interest");
t.ok(r.total_interest > 115000 && r.total_interest < 116500, "total interest in the expected ballpark (~$115.8k)");

// Zero-interest loan: $1,200 over 12 → $100/mo, no interest.
let z = (await amort({ principal: 1200, rate: 0, term: 12 })).json;
t.eq(z.payment, 100, "0% → payment = principal / term");
t.eq(z.total_interest, 0, "0% → no interest");
t.eq(z.schedule[0].interest, 0, "0% → each period is all principal");
t.eq(z.schedule[11].balance, 0, "0% → paid off exactly");

// Extra principal pays it off EARLY with less interest.
let base = (await amort({ principal: 100000, rate: 6, term: 360 })).json;
let ex = (await amort({ principal: 100000, rate: 6, term: 360, extra: 200 })).json;
t.ok(ex.periods < 360, "extra principal shortens the loan (< 360 periods)");
t.ok(ex.total_interest < base.total_interest, "extra principal saves interest");
t.eq(ex.schedule[ex.schedule.length - 1].balance, 0, "still pays off to exactly 0");
t.eq(sumPrincipal(ex.schedule), 100000, "with extra, principal still ties out to the cent");

// Dates: first payment one period after start (freq 12 → monthly).
let d = (await amort({ principal: 1200, rate: 0, term: 3, start: "2026-01-15", freq: 12 })).json;
t.eq(d.schedule[0].date, "2026-02-15", "first payment dated one month after the start");
t.eq(d.schedule[2].date, "2026-04-15", "third payment three months after start");

// Guards.
t.eq((await amort({ principal: 0, rate: 5, term: 12 })).status, 400, "principal must be positive → 400");
t.eq((await amort({ principal: 1000, rate: -1, term: 12 })).status, 400, "negative rate → 400");
t.eq((await amort({ principal: 1000, rate: 5, term: 0 })).status, 400, "term < 1 → 400");
t.eq((await amort({ principal: 1000, rate: 5, term: 5000 })).status, 400, "term > 1200 → 400");
t.eq((await amort({ principal: 1000, rate: 5, term: 12, extra: -5 })).status, 400, "negative extra → 400");
t.eq((await amort({ principal: 1000, rate: 5, term: 12 }, null)).status, 401, "signed-out → 401");

t.done(); h.restore();
