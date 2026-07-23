// Batch 282 — RETURN / RMA FLOW. A member requests a return; an admin moves it requested → approved | rejected
// and approved → refunded, each an atomic state-guarded transition. Covers create, mine, admin list/filter,
// get one (owner + admin), approve, reject, refund (amount → cents), invalid transitions → 409, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 282");
const slug = "b282";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const create = (tok, body) => c.post(`/api/db/${slug}/rma`, body, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/rma/mine`, { token: tok }).then((r) => r.json);
const all = (tok, q) => c.get(`/api/db/${slug}/rma${q || ""}`, { token: tok });
const one = (tok, id) => c.get(`/api/db/${slug}/rma/${id}`, { token: tok });
const act = (tok, id, a, body) => c.post(`/api/db/${slug}/rma/${id}/${a}`, body || {}, { token: tok });

// --- Create ---
const id1 = (await create(B, { order_ref: "ORD-100", reason: "wrong size", items: "shirt" })).json.id;
const id2 = (await create(B, { order_ref: "ORD-200", reason: "defective" })).json.id;
t.ok(id1 && id2, "member opens two return requests");
t.eq((await one(B, id1)).json.rma.status, "requested", "…initial status requested");

// --- Mine / admin list ---
t.eq((await mine(B)).rma.length, 2, "B sees their 2 requests");
t.eq((await mine(C)).rma.length, 0, "C sees none (isolation)");
t.eq((await all(A)).json.rma.length, 2, "admin sees all");

// --- Get one: owner + admin, not others ---
t.eq((await one(A, id1)).json.rma.order_ref, "ORD-100", "admin reads a request");
t.eq((await one(C, id1)).status, 403, "another member can't read it → 403");

// --- Approve → refund ---
t.eq((await act(A, id1, "approve")).json.status, "approved", "admin approves request 1");
t.eq((await act(A, id1, "refund", { amount: 12.5 })).json.status, "refunded", "…then refunds it");
t.eq((await one(A, id1)).json.rma.refund_amount, 1250, "…refund amount stored in cents");

// --- Reject the other ---
t.eq((await act(A, id2, "reject", { note: "outside window" })).json.status, "rejected", "admin rejects request 2");
t.eq((await one(A, id2)).json.rma.note, "outside window", "…with the rejection note");

// --- Status filter ---
t.eq((await all(A, "?status=refunded")).json.rma.length, 1, "admin filters by status");

// --- Invalid transitions (atomic guards) ---
const id3 = (await create(B, { order_ref: "ORD-300" })).json.id;
t.eq((await act(A, id3, "refund")).status, 409, "refunding a non-approved request → 409");
await act(A, id3, "approve");
t.eq((await act(A, id3, "approve")).status, 409, "re-approving an approved request → 409");
t.eq((await act(A, id2, "approve")).status, 409, "approving a rejected request → 409");

// --- Validation + authz ---
t.eq((await create(B, {})).status, 400, "a missing order_ref → 400");
t.eq((await create(null, { order_ref: "X" })).status, 401, "signed-out create → 401");
t.eq((await act(B, id3, "refund")).status, 403, "a member can't transition → 403");
t.eq((await all(B)).status, 403, "a member can't list all → 403");
t.eq((await act(A, 999999, "approve")).status, 404, "transitioning a missing request → 404");

t.done(); h.restore();
