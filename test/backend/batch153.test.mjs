// Batch 153 — two stateless business calculators: EOQ (economic order quantity + reorder point /
// safety stock, for IMS/SCM/WMS) and break-even / CVP (for pricing & planning). Verified against
// textbook numbers + guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 153");
const slug = "b153";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const TOK = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const eoq = (body, tok) => c.post(`/api/db/${slug}/finance/eoq`, body, tok === null ? {} : { token: tok || TOK });
const be = (body, tok) => c.post(`/api/db/${slug}/finance/breakeven`, body, tok === null ? {} : { token: tok || TOK });

// EOQ: D=10000/yr, order cost $50, holding $2/unit/yr → EOQ = sqrt(2*10000*50/2) = 707.11.
let e = (await eoq({ demand: 10000, order_cost: 50, holding_cost: 2 })).json;
t.ok(Math.abs(e.eoq - 707.11) < 0.05, "EOQ ≈ 707.11 units");
t.eq(e.eoq_rounded, 708, "EOQ rounds up to a whole order");
t.ok(Math.abs(e.orders_per_year - 14.14) < 0.05, "orders/year ≈ 14.14");
t.ok(Math.abs(e.total_annual_cost - 1414.21) < 0.1, "total annual cost ≈ $1414.21");
t.ok(Math.abs(e.annual_order_cost - e.annual_holding_cost) < 0.5, "at EOQ, order cost ≈ holding cost");

// EOQ with a reorder point: lead 7 days, daily σ=5, 95% service → z≈1.645.
let e2 = (await eoq({ demand: 10000, order_cost: 50, holding_cost: 2, lead_time: 7, demand_std: 5, service_level: 95 })).json;
t.ok(Math.abs(e2.z - 1.645) < 0.01, "z-score for 95% ≈ 1.645");
t.ok(Math.abs(e2.demand_during_lead - 191.78) < 0.1, "demand during 7-day lead ≈ 191.8");
t.ok(Math.abs(e2.safety_stock - 21.76) < 0.2, "safety stock ≈ 21.8 (z·σ·√lead)");
t.ok(Math.abs(e2.reorder_point - (e2.demand_during_lead + e2.safety_stock)) < 0.02, "reorder point = lead demand + safety stock");
// Explicit safety stock overrides the statistical one.
t.eq((await eoq({ demand: 3650, order_cost: 10, holding_cost: 1, lead_time: 10, safety_stock: 50 })).json.safety_stock, 50, "explicit safety_stock is used as-is");

// Break-even: price $50, variable $30, fixed $10,000 → cm $20, 500 units, $25,000 revenue.
let b = (await be({ price: 50, variable_cost: 30, fixed_cost: 10000 })).json;
t.eq(b.contribution_margin, 20, "contribution margin = price − variable");
t.eq(b.cm_ratio, 0.4, "cm ratio = 20/50");
t.eq(b.break_even_units, 500, "break-even at 500 units");
t.eq(b.break_even_revenue, 25000, "break-even revenue $25,000");

// Target profit + a given unit volume.
let b2 = (await be({ price: 50, variable_cost: 30, fixed_cost: 10000, target_profit: 5000, units: 600 })).json;
t.eq(b2.units_for_target, 750, "750 units for a $5,000 profit ((10000+5000)/20)");
t.eq(b2.profit_at_units, 2000, "profit at 600 units = 600*20 − 10000");
t.eq(b2.margin_of_safety_units, 100, "margin of safety = 600 − 500 units");
t.ok(Math.abs(b2.margin_of_safety_pct - 16.67) < 0.01, "margin of safety ≈ 16.67%");

// Guards.
t.eq((await eoq({ demand: 0, order_cost: 50, holding_cost: 2 })).status, 400, "EOQ: demand must be positive → 400");
t.eq((await eoq({ demand: 100, order_cost: 50, holding_cost: 0 })).status, 400, "EOQ: holding cost must be positive → 400");
t.eq((await be({ price: 30, variable_cost: 30, fixed_cost: 1000 })).status, 400, "no break-even when price ≤ variable → 400");
t.eq((await be({ price: 50, variable_cost: 30 })).status, 400, "break-even needs fixed_cost → 400");
t.eq((await eoq({ demand: 100, order_cost: 50, holding_cost: 2 }, null)).status, 401, "signed-out → 401");

t.done(); h.restore();
