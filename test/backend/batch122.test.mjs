// Batch 122 — work orders + MRP: build a product (issue components, receive finished + cost roll-up), net demand
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 122");
const slug = "b122";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const move = (body) => c.post(`/api/db/${slug}/stock/moves`, body, { token: ADMIN });
const onHand = (item) => c.get(`/api/db/${slug}/stock/level?item=${item}`, { token: ADMIN }).then((r) => r.json.on_hand);
const mkWo = (body) => c.post(`/api/db/${slug}/work-orders`, body, { token: ADMIN });
const build = (id) => c.post(`/api/db/${slug}/work-orders/${id}/build`, {}, { token: ADMIN });

// gizmo = 2×partA + 3×partB.
await c.post(`/api/db/${slug}/bom`, { product: "gizmo", lines: [{ component: "partA", qty: 2 }, { component: "partB", qty: 3 }] }, { token: ADMIN });
// Stock the components with costs ($2 and $1) so the finished cost rolls up.
await move({ item: "partA", qty: 100, unit_cost: 2 });
await move({ item: "partB", qty: 100, unit_cost: 1 });

// Plan a build of 5 gizmos.
let wo = await mkWo({ product: "gizmo", qty: 5 });
t.eq(wo.status, 200, "create work order → 200");
t.eq(wo.json.work_order.status, "planned", "starts planned");
const WO = wo.json.work_order.id;

// Inspect requirements + availability.
let view = (await c.get(`/api/db/${slug}/work-orders/${WO}`, { token: ADMIN })).json;
const req = Object.fromEntries(view.requirements.map((r) => [r.component, r]));
t.eq(req.partA.required, 10, "needs 10 partA (2 × 5)");
t.eq(req.partB.required, 15, "needs 15 partB (3 × 5)");
t.eq(req.partA.shortfall, 0, "no shortfall (100 on hand)");
t.ok(view.can_build, "can_build true when stock suffices");

// A build we can't cover fails and moves no stock.
let wo2 = await mkWo({ product: "gizmo", qty: 1000 });
t.eq((await build(wo2.json.work_order.id)).status, 409, "insufficient components → 409");
t.eq(await onHand("partA"), 100, "no components consumed by the failed build");

// Build the feasible one: components issued, finished goods received at rolled-up cost.
let b = await build(WO);
t.eq(b.status, 200, "build → 200");
t.eq(b.json.issued.length, 2, "both components issued");
t.eq(b.json.unit_cost, 7, "finished unit cost = (10×$2 + 15×$1)/5 = $7");
t.eq(await onHand("partA"), 90, "partA down 10");
t.eq(await onHand("partB"), 85, "partB down 15");
t.eq(await onHand("gizmo"), 5, "5 gizmos produced");
t.eq((await c.get(`/api/db/${slug}/stock/valuation?item=gizmo`, { token: ADMIN })).json.total_value, 35, "gizmo stock valued at 5×$7 = $35");

// Idempotent — can't build twice.
t.eq((await build(WO)).status, 409, "re-build → 409");
t.eq((await build(WO)).json.code, "built", "409 carries built code");
t.ok((await c.get(`/api/db/${slug}/work-orders/${WO}`, { token: ADMIN })).json.work_order.built, "WO flagged built");

// Cancel a planned WO; then it can't be built. And a built WO can't be cancelled.
t.eq((await c.post(`/api/db/${slug}/work-orders/${wo2.json.work_order.id}/cancel`, {}, { token: ADMIN })).json.status, "cancelled", "cancel planned WO");
t.eq((await build(wo2.json.work_order.id)).status, 409, "building a cancelled WO → 409");
t.eq((await c.post(`/api/db/${slug}/work-orders/${WO}/cancel`, {}, { token: ADMIN })).status, 409, "can't cancel a built WO");

// Can't plan a WO for a product with no BOM.
t.eq((await mkWo({ product: "noBomThing", qty: 1 })).status, 400, "WO for a product with no BOM → 400");

// ── MRP ──
let mrp = await c.post(`/api/db/${slug}/mrp`, { demand: [{ product: "gizmo", qty: 10 }, { product: "rawthing", qty: 5 }] }, { token: ADMIN });
t.eq(mrp.status, 200, "mrp → 200");
const mreq = Object.fromEntries(mrp.json.requirements.map((r) => [r.component, r]));
t.eq(mreq.partA.required, 20, "gizmo×10 needs 20 partA");
t.eq(mreq.partA.available, 90, "partA on hand 90");
t.eq(mreq.partA.shortfall, 0, "partA covered");
t.eq(mreq.rawthing.required, 5, "a demanded product with no BOM is itself a requirement");
t.eq(mreq.rawthing.shortfall, 5, "rawthing fully short (none on hand)");
t.ok(mrp.json.shortfalls.length === 1 && mrp.json.shortfalls[0].component === "rawthing", "shortfalls lists only what's short");

// Guards.
t.eq((await c.post(`/api/db/${slug}/mrp`, { demand: [] }, { token: ADMIN })).status, 400, "empty demand → 400");
t.eq((await mkWo({ product: "gizmo", qty: 1 }, )).status, 200, "sanity: another WO plans fine");
t.eq((await c.post(`/api/db/${slug}/work-orders`, { product: "gizmo", qty: 1 }, { token: USER })).status, 403, "non-admin → 403");
t.eq((await c.post(`/api/db/${slug}/mrp`, { demand: [{ product: "gizmo", qty: 1 }] })).status, 401, "signed-out → 401");

t.done(); h.restore();
