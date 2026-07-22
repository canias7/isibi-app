// Batch 115 — inventory valuation: weighted-average cost over the stock ledger
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 115");
const slug = "b115";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const move = (body) => c.post(`/api/db/${slug}/stock/moves`, body, { token: ADMIN });
const val = (q) => c.get(`/api/db/${slug}/stock/valuation${q || ""}`, { token: ADMIN });
const rowFor = (j, item, loc) => j.valuation.find((r) => r.item === item && (loc ? r.location === loc : true));

// Two receipts at different costs → weighted-average unit cost.
await move({ item: "widget", qty: 10, unit_cost: 5 });   // 10 @ $5
await move({ item: "widget", qty: 10, unit_cost: 7 });   // 10 @ $7  → avg (50+70)/20 = $6
await move({ item: "widget", qty: -5 });                 // issue 5 (no cost) → on_hand 15, avg unchanged
let w = (await val("?item=widget")).json;
let wr = rowFor(w, "widget");
t.eq(wr.on_hand, 15, "on_hand after receipts − issue");
t.eq(wr.avg_cost, 6, "weighted-average cost = $6");
t.eq(wr.value, 90, "value = 15 × $6 = $90");
t.eq(w.total_value, 90, "total_value reflects the one item");

// Fractional quantities value exactly.
await move({ item: "flour", qty: 3, unit_cost: 2.5 });
await move({ item: "flour", qty: 1, unit_cost: 4.5 });   // avg (7.5+4.5)/4 = $3
let f = rowFor((await val("?item=flour")).json, "flour");
t.eq(f.avg_cost, 3, "fractional weighted avg = $3");
t.eq(f.value, 12, "flour value = 4 × $3 = $12");

// An item received with no cost → avg/value null (can't value it).
await move({ item: "freebie", qty: 100 });
let fb = rowFor((await val("?item=freebie")).json, "freebie");
t.eq(fb.avg_cost, null, "no cost → avg_cost null");
t.eq(fb.value, null, "no cost → value null");

// Item-level average applied across locations; total sums both.
await move({ item: "bolt", qty: 10, unit_cost: 2, location: "wh1" });
await move({ item: "bolt", qty: 10, unit_cost: 4, location: "wh2" }); // item avg (20+40)/20 = $3
let b = (await val("?item=bolt")).json;
t.eq(rowFor(b, "bolt", "wh1").value, 30, "wh1: 10 × item-avg $3 = $30");
t.eq(rowFor(b, "bolt", "wh2").value, 30, "wh2: 10 × item-avg $3 = $30");
// location filter narrows the rows
let bloc = (await val("?item=bolt&location=wh1")).json;
t.ok(bloc.valuation.length === 1 && bloc.valuation[0].location === "wh1", "location filter narrows to one row");

// Whole-warehouse valuation total = widget 90 + flour 12 + bolt 60 (freebie null) = 162.
let all = (await val()).json;
t.eq(all.total_value, 162, "grand total across costed items = $162");

// Authz + method.
t.eq((await c.get(`/api/db/${slug}/stock/valuation`, { token: USER })).status, 403, "non-admin → 403");
t.eq((await c.get(`/api/db/${slug}/stock/valuation`)).status, 401, "signed-out → 401");
t.eq((await c.post(`/api/db/${slug}/stock/valuation`, {}, { token: ADMIN })).status, 405, "valuation is GET-only");

t.done(); h.restore();
