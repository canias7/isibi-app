// Batch 248 — TWO-PERSON APPROVAL. A sensitive op needs two DISTINCT admins to sign off. One admin proposes,
// a different admin approves (or any admin rejects). Covers propose, self-approve blocked, second-admin
// authorizes, reject, decided-once, list + filter, get, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 248");
const slug = "b248";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin (first signup)
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
// Promote B to admin so we have two admins.
h.getDb(uuid).prepare("UPDATE _users SET role='admin' WHERE email=?").run("b@x.dev");
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3 member (non-admin)
const propose = (tok, body) => c.post(`/api/db/${slug}/dual-approval`, body, tok === null ? {} : { token: tok });
const approve = (tok, id) => c.post(`/api/db/${slug}/dual-approval/${id}/approve`, {}, { token: tok });
const reject = (tok, id, note) => c.post(`/api/db/${slug}/dual-approval/${id}/reject`, { note }, { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/dual-approval${q || ""}`, { token: tok }).then((r) => r.json);
const getOne = (tok, id) => c.get(`/api/db/${slug}/dual-approval/${id}`, { token: tok }).then((r) => r.json);

// --- Propose (admin A) ---
const id1 = (await propose(A, { op: "delete_all_users", ref: "danger", note: "cleanup" })).json.id;
t.ok(id1, "admin A proposes a sensitive op");
t.eq((await getOne(A, id1)).approval.status, "pending", "…status pending");

// --- Proposer can't self-approve ---
t.eq((await approve(A, id1)).status, 403, "the proposer can't approve their own op → 403");
t.eq((await getOne(A, id1)).approval.status, "pending", "…still pending");

// --- A second, distinct admin authorizes ---
t.eq((await approve(B, id1)).json.status, "authorized", "a second admin approves → authorized");
t.eq((await getOne(A, id1)).approval.approved_by, 2, "…approved_by is B");

// --- Can't act on an already-decided op ---
t.eq((await approve(B, id1)).status, 409, "re-approving a decided op → 409");
t.eq((await reject(B, id1)).status, 409, "…and rejecting it → 409");

// --- Reject path ---
const id2 = (await propose(A, { op: "refund_large" })).json.id;
t.eq((await reject(B, id2, "not justified")).json.status, "rejected", "a second admin rejects");
t.eq((await getOne(A, id2)).approval.status, "rejected", "…status rejected");

// --- List + status filter ---
t.eq((await list(A)).approvals.length, 2, "admin lists all approvals");
t.eq((await list(A, "?status=authorized")).approvals.length, 1, "…filter by status");

// --- Validation + authz ---
t.eq((await propose(A, {})).status, 400, "missing op → 400");
t.eq((await propose(C, { op: "x" })).status, 403, "a non-admin can't propose → 403");
t.eq((await approve(C, id1)).status, 403, "a non-admin can't approve → 403");
t.eq((await list(C)).status ?? 403, 403, "a non-admin can't list → 403");
t.eq((await c.get(`/api/db/${slug}/dual-approval`, { token: C })).status, 403, "…confirmed 403");
t.eq((await approve(B, 999999)).status, 404, "approving a missing op → 404");
t.eq((await propose(null, { op: "x" })).status, 401, "signed-out propose → 401");

t.done(); h.restore();
