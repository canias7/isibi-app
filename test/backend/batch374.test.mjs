// Batch 374 — CAPACITY FORECAST. Stateless capacity-vs-demand roll-up: per-period utilization / shortfall /
// surplus + totals + overall utilization. Covers the math, labels, edge cases, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 374");
const slug = "b374";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const cf = (periods) => c.post(`/api/db/${slug}/capacity-forecast`, { periods }).then((r) => r.json);

// --- Basic per-period math ---
let r = await cf([
  { label: "Mon", capacity: 100, demand: 80 },
  { label: "Tue", capacity: 100, demand: 120 },
]);
t.eq(r.periods[0].utilization, 80, "Mon 80% utilized");
t.eq(r.periods[0].surplus, 20, "…20 surplus");
t.eq(r.periods[0].shortfall, 0, "…no shortfall");
t.eq(r.periods[1].utilization, 120, "Tue over capacity (120%)");
t.eq(r.periods[1].shortfall, 20, "…20 shortfall");
t.eq(r.periods[1].surplus, 0, "…no surplus");

// --- Totals + overall ---
t.eq(r.total_capacity, 200, "total capacity summed");
t.eq(r.total_demand, 200, "total demand summed");
t.eq(r.overall_utilization, 100, "overall 100% utilized");
t.eq(r.total_shortfall, 0, "net shortfall 0 (surplus offsets)");

// --- Zero capacity → null utilization, shortfall = demand ---
r = await cf([{ capacity: 0, demand: 5 }]);
t.eq(r.periods[0].utilization, null, "zero capacity → null utilization");
t.eq(r.periods[0].shortfall, 5, "…all demand is shortfall");

// --- Default labels are the index ---
t.eq((await cf([{ capacity: 1, demand: 1 }])).periods[0].label, "0", "missing label defaults to the index");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/capacity-forecast`, { periods: [] })).status, 400, "empty periods → 400");
t.eq((await c.post(`/api/db/${slug}/capacity-forecast`, {})).status, 400, "no periods → 400");
t.eq((await c.post(`/api/db/${slug}/capacity-forecast`, { periods: [{ capacity: -1, demand: 1 }] })).status, 400, "negative capacity → 400");
t.eq((await c.post(`/api/db/${slug}/capacity-forecast`, { periods: [{ capacity: 1, demand: "x" }] })).status, 400, "non-numeric demand → 400");

t.done(); h.restore();
