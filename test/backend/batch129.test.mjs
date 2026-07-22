// Batch 129 — lot/batch/serial + expiry: per-lot on-hand, lot-scoped guard, FEFO allocate, expiring report
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 129");
const slug = "b129";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const move = (body) => c.post(`/api/db/${slug}/stock/moves`, body, { token: ADMIN });
const lots = (q) => c.get(`/api/db/${slug}/stock/lots${q || ""}`, { token: ADMIN });
const alloc = (q) => c.get(`/api/db/${slug}/stock/allocate${q}`, { token: ADMIN });
const level = (item) => c.get(`/api/db/${slug}/stock/level?item=${item}`, { token: ADMIN }).then((r) => r.json.on_hand);

// Receive two lots with different expiries.
await move({ item: "vaccine", lot: "L1", qty: 100, expiry: "2026-06-01", unit_cost: 2 });
await move({ item: "vaccine", lot: "L2", qty: 50, expiry: "2026-03-01", unit_cost: 2 });

// Lots report is FEFO-ordered (earliest expiry first) with per-lot on-hand.
let lr = (await lots("?item=vaccine")).json.lots;
t.eq(lr.map((l) => l.lot), ["L2", "L1"], "lots ordered earliest-expiry-first (FEFO)");
t.eq(lr[0].on_hand, 50, "L2 on-hand 50");
t.eq(lr[1].on_hand, 100, "L1 on-hand 100");
// Item-level on-hand aggregates all lots.
t.eq(await level("vaccine"), 150, "item on-hand = sum of lots");

// Expiring-soon report.
let exp = (await lots("?item=vaccine&expiring_before=2026-04-01")).json.lots;
t.eq(exp.map((l) => l.lot), ["L2"], "expiring_before filters to the soon-to-expire lot");

// FEFO allocate: pull 120 → 50 from L2 (earliest) then 70 from L1.
let a = (await alloc("?item=vaccine&qty=120")).json;
t.ok(a.fulfillable && a.shortfall === 0, "120 is fulfillable");
t.eq(a.plan.map((p) => [p.lot, p.take]), [["L2", 50], ["L1", 70]], "FEFO plan: drain L2 first, then L1");
// Over-demand shows a shortfall.
let a2 = (await alloc("?item=vaccine&qty=200")).json;
t.ok(!a2.fulfillable && a2.shortfall === 50, "200 leaves a 50 shortfall");

// Lot-scoped no-negative guard: can't issue more of a lot than it holds.
t.eq((await move({ item: "vaccine", lot: "L2", qty: -60 })).status, 409, "issue 60 from a 50-lot → 409");
t.ok(/lot L2/.test((await move({ item: "vaccine", lot: "L2", qty: -60 })).json.error || ""), "409 names the lot");
t.eq((await move({ item: "vaccine", lot: "L2", qty: -50 })).status, 200, "issuing exactly the lot's 50 is fine");
// L2 now depleted → drops out of the lots report.
t.ok(!(await lots("?item=vaccine")).json.lots.some((l) => l.lot === "L2"), "depleted lot leaves the on-hand report");
t.eq(await level("vaccine"), 100, "item on-hand down to 100 (L1 only)");

// Serial numbers = a lot of qty 1.
await move({ item: "laptop", lot: "SN-001", qty: 1 });
await move({ item: "laptop", lot: "SN-002", qty: 1 });
t.eq((await lots("?item=laptop")).json.lots.length, 2, "two serials tracked");
t.eq((await move({ item: "laptop", lot: "SN-001", qty: -1 })).status, 200, "ship serial SN-001");
t.eq((await move({ item: "laptop", lot: "SN-001", qty: -1 })).status, 409, "can't ship SN-001 twice");

// Non-lot moves still work and don't show in the lot report.
await move({ item: "bulk", qty: 500 });
t.eq(await level("bulk"), 500, "non-lot item on-hand");
t.ok(!(await lots()).json.lots.some((l) => l.item === "bulk"), "non-lot stock not in the lots report");

// Guards.
t.eq((await alloc("?item=vaccine")).status, 400, "allocate needs a qty");
t.eq((await c.get(`/api/db/${slug}/stock/lots`)).status, 401, "signed-out → 401");

t.done(); h.restore();
