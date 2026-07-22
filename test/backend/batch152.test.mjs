// Batch 152 — capital-budgeting / investment analysis (FP&A/CPM): NPV, IRR (solved numerically),
// payback + discounted payback, profitability index. Verified against a textbook case + edges.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 152");
const slug = "b152";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const TOK = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const inv = (body, tok) => c.post(`/api/db/${slug}/finance/investment`, body, tok === null ? {} : { token: tok || TOK });

// Textbook: invest $1000, get $500/yr for 3 years, discount 10%.
let r = (await inv({ cashflows: [-1000, 500, 500, 500], rate: 10 })).json;
t.ok(Math.abs(r.npv - 243.43) < 0.02, "NPV ≈ $243.43");
t.ok(r.irr_pct > 23.3 && r.irr_pct < 23.5, "IRR ≈ 23.4%");
t.ok(Math.abs(r.payback_period - 2.0) < 0.001, "payback = 2.0 periods (1000/500 over 2 yrs)");
t.ok(Math.abs(r.discounted_payback - 2.35) < 0.02, "discounted payback ≈ 2.35 periods");
t.ok(Math.abs(r.profitability_index - 1.2434) < 0.002, "profitability index ≈ 1.243");
t.eq(r.total_inflow, 1500, "total inflow = 1500");
t.eq(r.total_outflow, 1000, "total outflow = 1000");
t.eq(r.periods, 3, "3 periods after t0");

// A break-even project: pay 100 now, get 110 next period at 10% → NPV exactly 0, IRR = 10%.
let be = (await inv({ cashflows: [-100, 110], rate: 10 })).json;
t.ok(Math.abs(be.npv) < 0.01, "NPV ≈ 0 at the hurdle rate");
t.ok(Math.abs(be.irr_pct - 10) < 0.05, "IRR ≈ 10% (equals the discount rate)");
t.ok(Math.abs(be.payback_period - 0.909) < 0.01, "payback ≈ 0.909 (100/110 into period 1)");

// Cashflows as objects with {amount} also work.
let ob = (await inv({ cashflows: [{ amount: -500 }, { amount: 300 }, { amount: 300 }], rate: 8 })).json;
t.ok(ob.npv > 0, "object-form cashflows compute (positive NPV here)");
t.ok(ob.irr_pct > 8, "IRR beats the 8% hurdle");

// A never-profitable project: no IRR, no payback.
let bad = (await inv({ cashflows: [-1000, -100, -50], rate: 10 })).json;
t.eq(bad.irr, null, "all-negative flows → no IRR");
t.eq(bad.payback_period, null, "never recovers → no payback");
t.ok(bad.npv < 0, "NPV is negative");

// Higher discount rate lowers NPV (sanity).
let lo = (await inv({ cashflows: [-1000, 500, 500, 500], rate: 5 })).json;
let hi = (await inv({ cashflows: [-1000, 500, 500, 500], rate: 20 })).json;
t.ok(lo.npv > hi.npv, "a higher discount rate yields a lower NPV");

// Guards.
t.eq((await inv({ cashflows: [-1000], rate: 10 })).status, 400, "fewer than 2 cashflows → 400");
t.eq((await inv({ cashflows: "nope", rate: 10 })).status, 400, "cashflows must be an array → 400");
t.eq((await inv({ cashflows: [-1000, "x"], rate: 10 })).status, 400, "non-numeric cashflow → 400");
t.eq((await inv({ cashflows: [-1000, 500], rate: -150 })).status, 400, "rate ≤ -100 → 400");
t.eq((await inv({ cashflows: [-1000, 500], rate: 10 }, null)).status, 401, "signed-out → 401");

t.done(); h.restore();
