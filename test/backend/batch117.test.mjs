// Batch 117 — document→stock posting: fulfil a doc = issue (sales) or receive (purchase) its lines
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 117");
const slug = "b117";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const mkDoc = (body) => c.post(`/api/db/${slug}/documents`, body, { token: ADMIN });
const move = (body) => c.post(`/api/db/${slug}/stock/moves`, body, { token: ADMIN });
const postStock = (id, body) => c.post(`/api/db/${slug}/documents/${id}/post-stock`, body, { token: ADMIN });
const onHand = (item, loc) => c.get(`/api/db/${slug}/stock/level?item=${item}${loc ? "&location=" + loc : ""}`, { token: ADMIN }).then((r) => r.json.on_hand);

// Stock some items first.
await move({ item: "widget", qty: 100 });
await move({ item: "gadget", qty: 100 });

// A sales order with two item lines → issue reduces on-hand.
let so = await mkDoc({ type: "sales_order", lines: [
  { item: "widget", description: "W", qty: 10, unit_price: 5 },
  { item: "gadget", description: "G", qty: 4, unit_price: 8 },
] });
let ps = await postStock(so.json.doc.id, {});
t.eq(ps.status, 200, "post-stock (sales) → 200");
t.eq(ps.json.direction, "issue", "sales doc defaults to issue");
t.eq(ps.json.moves.length, 2, "one move per item line");
t.eq(await onHand("widget"), 90, "widget issued 10 → 90");
t.eq(await onHand("gadget"), 96, "gadget issued 4 → 96");

// Idempotent — second post refused.
t.eq((await postStock(so.json.doc.id, {})).status, 409, "re-post to stock → 409");
t.eq((await postStock(so.json.doc.id, {})).json.code, "stock_posted", "409 carries stock_posted code");
t.eq((await c.get(`/api/db/${slug}/documents/${so.json.doc.id}`, { token: ADMIN })).json.doc.stock_posted, true, "doc flagged stock_posted");

// A purchase order → receive raises on-hand, and carries the line cost for valuation.
let po = await mkDoc({ type: "purchase_order", lines: [{ item: "bolt", qty: 50, unit_price: 2 }] });
let pr = await postStock(po.json.doc.id, {});
t.eq(pr.json.direction, "receive", "purchase doc defaults to receive");
t.eq(await onHand("bolt"), 50, "bolt received → 50 on hand");
t.eq((await c.get(`/api/db/${slug}/stock/valuation?item=bolt`, { token: ADMIN })).json.total_value, 100, "received qty carries unit_cost → valued at 50×$2");

// Explicit direction override.
let ret = await mkDoc({ type: "credit_note", lines: [{ item: "widget", qty: 3, unit_price: 5 }] });
await postStock(ret.json.doc.id, { direction: "receive" }); // a return puts stock back
t.eq(await onHand("widget"), 93, "explicit receive puts 3 back → 93");

// All-or-nothing: an order that oversells one line posts NEITHER line.
let big = await mkDoc({ type: "sales_order", lines: [
  { item: "gadget", qty: 5, unit_price: 1 },      // fine
  { item: "widget", qty: 9999, unit_price: 1 },   // not enough
] });
let over = await postStock(big.json.doc.id, {});
t.eq(over.status, 409, "over-issue order → 409");
t.eq(over.json.code, "stock", "409 carries stock code");
t.eq(await onHand("gadget"), 96, "the fine line was NOT issued (all-or-nothing pre-check)");
t.eq((await c.get(`/api/db/${slug}/documents/${big.json.doc.id}`, { token: ADMIN })).json.doc.stock_posted, false, "failed doc stays unposted");

// Multi-line same item is summed in the pre-check.
await move({ item: "pen", qty: 10 });
let dup = await mkDoc({ type: "sales_order", lines: [
  { item: "pen", qty: 6, unit_price: 1 },
  { item: "pen", qty: 6, unit_price: 1 },   // 6+6 = 12 > 10 available
] });
t.eq((await postStock(dup.json.doc.id, {})).status, 409, "summed need (12 > 10) → 409");
t.eq(await onHand("pen"), 10, "nothing issued for the over-summed order");

// A doc with no stockable lines.
let empty = await mkDoc({ type: "invoice", lines: [{ description: "service fee", qty: 1, unit_price: 100 }] });
t.eq((await postStock(empty.json.doc.id, {})).status, 400, "no item lines → 400");

// Guards.
t.eq((await c.post(`/api/db/${slug}/documents/${po.json.doc.id}/post-stock`, {}, { token: USER })).status, 403, "non-admin → 403");
t.eq((await postStock(99999, {})).status, 404, "missing doc → 404");

t.done(); h.restore();
