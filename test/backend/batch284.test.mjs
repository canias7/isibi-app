// Batch 284 — ORDER NOTES / GIFT MESSAGES. A member attaches a note or gift message to an order reference;
// staff read them all. Covers attach, gift flag, per-order list (member sees own, admin sees all), mine,
// delete (owner + admin), isolation, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 284");
const slug = "b284";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const attach = (tok, body) => c.post(`/api/db/${slug}/order-notes`, body, tok === null ? {} : { token: tok });
const forOrder = (tok, ref) => c.get(`/api/db/${slug}/order-notes?order_ref=${ref}`, { token: tok }).then((r) => r.json);
const mine = (tok) => c.get(`/api/db/${slug}/order-notes/mine`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/order-notes/${id}`, { token: tok });

// --- Attach ---
const n1 = (await attach(B, { order_ref: "ORD-1", message: "Leave at the door" })).json.id;
const n2 = (await attach(B, { order_ref: "ORD-1", message: "Happy Birthday!", gift: true })).json.id;
await attach(C, { order_ref: "ORD-1", message: "Ring the bell" });
t.ok(n1 && n2, "member attaches notes to an order");

// --- Per-order view: member sees only their own ---
let bo = (await forOrder(B, "ORD-1")).notes;
t.eq(bo.length, 2, "B sees their 2 notes on ORD-1");
t.ok(bo.find((n) => n.id === n2).gift, "…the gift flag is set on the gift message");

// --- Admin sees all notes on the order ---
let ao = (await forOrder(A, "ORD-1")).notes;
t.eq(ao.length, 3, "admin sees all 3 notes on ORD-1");
t.ok(ao[0].user_id != null, "…with the author id");

// --- Mine ---
t.eq((await mine(B)).notes.length, 2, "B lists their notes");
t.eq((await mine(C)).notes.length, 1, "C lists theirs (isolation)");

// --- Delete (owner) + admin ---
t.eq((await del(B, n1)).json.deleted, true, "B deletes their own note");
t.eq((await mine(B)).notes.length, 1, "…now 1 left");
t.eq((await del(A, n2)).json.deleted, true, "admin deletes any note");

// --- Validation + authz ---
t.eq((await attach(B, { order_ref: "ORD-9" })).status, 400, "a missing message → 400");
t.eq((await attach(B, { message: "hi" })).status, 400, "a missing order_ref → 400");
t.eq((await c.get(`/api/db/${slug}/order-notes`, { token: B })).status, 400, "listing with no ?order_ref → 400");
t.eq((await del(C, n1 + 999)).status, 404, "deleting a missing note → 404");
const cNote = (await attach(C, { order_ref: "ORD-2", message: "x" })).json.id;
t.eq((await del(B, cNote)).status, 403, "deleting someone else's note → 403");
t.eq((await c.post(`/api/db/${slug}/order-notes`, { order_ref: "X", message: "y" })).status, 401, "signed-out attach → 401");

t.done(); h.restore();
