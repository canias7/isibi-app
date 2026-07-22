// Batch 120 — payments/allocations + AR aging: paid/outstanding on docs, overdue buckets
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 120");
const slug = "b120";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const mkInv = (extra) => c.post(`/api/db/${slug}/documents`, Object.assign({ type: "invoice", status: "sent", lines: [{ qty: 1, unit_price: 100 }] }, extra), { token: ADMIN });
const alloc = (id, body) => c.post(`/api/db/${slug}/documents/${id}/allocations`, body, { token: ADMIN });
const getDoc = (id) => c.get(`/api/db/${slug}/documents/${id}`, { token: ADMIN });

// Apply payments; paid/outstanding track; settled flips when fully paid.
let inv = await mkInv({ party: "Acme" });
const INV = inv.json.doc.id;
t.eq(inv.json.doc.outstanding, 100, "new invoice outstanding = total");
t.eq(inv.json.doc.paid, 0, "nothing paid yet");
let a1 = await alloc(INV, { amount: 30, ref: "PMT-1" });
t.eq(a1.json.paid, 30, "paid 30");
t.eq(a1.json.outstanding, 70, "outstanding 70");
t.ok(!a1.json.settled, "not settled yet");
let a2 = await alloc(INV, { amount: 70 });
t.ok(a2.json.settled && a2.json.outstanding === 0, "second payment settles it");
t.eq((await getDoc(INV)).json.doc.paid, 100, "getDocument reflects paid");
t.eq((await getDoc(INV)).json.doc.outstanding, 0, "getDocument reflects outstanding");

// Over-allocation guarded unless forced.
let inv2 = await mkInv({});
let over = await alloc(inv2.json.doc.id, { amount: 150 });
t.eq(over.status, 409, "over-allocation → 409");
t.eq(over.json.code, "overpay", "409 carries overpay code");
t.eq((await alloc(inv2.json.doc.id, { amount: 150, allowOverpay: true })).json.paid, 150, "allowOverpay forces it");

// List + delete an allocation restores outstanding.
let list = (await c.get(`/api/db/${slug}/documents/${INV}/allocations`, { token: ADMIN })).json;
t.eq(list.allocations.length, 2, "two allocations listed");
const firstAlloc = list.allocations[0].id;
let del = await c.del(`/api/db/${slug}/documents/${INV}/allocations/${firstAlloc}`, { token: ADMIN });
t.eq(del.json.outstanding, 30, "removing the 30 payment restores 30 outstanding");
t.eq((await getDoc(INV)).json.doc.paid, 70, "paid back down to 70");

// Validation + authz.
t.eq((await alloc(INV, { amount: -5 })).status, 400, "negative amount → 400");
t.eq((await alloc(99999, { amount: 10 })).status, 404, "missing doc → 404");
t.eq((await c.post(`/api/db/${slug}/documents/${INV}/allocations`, { amount: 10 }, { token: USER })).status, 403, "non-admin → 403");
t.eq((await c.post(`/api/db/${slug}/documents/${INV}/allocations`, { amount: 10 })).status, 401, "signed-out → 401");

// ── AR aging ──
const asOf = "2026-06-30";
await mkInv({ party: "Acme", due_date: "2026-07-10" });   // not due → current
await mkInv({ party: "Acme", due_date: "2026-06-25" });   // 5 days → 1-30
await mkInv({ party: "Beta", due_date: "2026-05-20" });   // 41 days → 31-60
await mkInv({ party: "Beta", due_date: "2026-03-01" });   // 121 days → 91+
let paid = await mkInv({ party: "Gamma", due_date: "2026-01-01" });
await alloc(paid.json.doc.id, { amount: 100 });           // fully paid → excluded
await c.post(`/api/db/${slug}/documents`, { type: "invoice", status: "draft", due_date: "2026-01-01", lines: [{ qty: 1, unit_price: 100 }] }, { token: ADMIN }); // draft → excluded

let ag = (await c.get(`/api/db/${slug}/documents/aging?type=invoice&as_of=${asOf}`, { token: ADMIN })).json;
t.eq(ag.buckets, ["current", "1-30", "31-60", "61-90", "91+"], "default aging buckets");
// bucket sums: current 100, 1-30 = 100 (new) + the 30 still-open INV (due today? INV has no due → basis=doc_date=today, days=0 → current)
const byLabel = {}; ag.buckets.forEach((b, i) => byLabel[b] = ag.totals.aged[i]);
t.eq(byLabel["31-60"], 100, "one invoice in 31-60");
t.eq(byLabel["91+"], 100, "one invoice in 91+");
t.ok(byLabel["1-30"] >= 100, "at least the 5-day-overdue invoice in 1-30");
// the fully-paid + draft invoices are excluded from the total
t.ok(ag.totals.total > 0 && ag.documents.every((d) => d.outstanding > 0), "only owing docs appear");
// per-party grouping
t.ok(ag.parties.find((p) => p.party === "Beta").total === 200, "Beta owes 200 across two buckets");

// aging requires a type
t.eq((await c.get(`/api/db/${slug}/documents/aging`, { token: ADMIN })).status, 400, "aging without type → 400");
t.eq((await c.get(`/api/db/${slug}/documents/aging?type=invoice`, { token: USER })).status, 403, "non-admin aging → 403");

t.done(); h.restore();
