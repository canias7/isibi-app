// Batch 73 — approval workflow (submit → approve/reject, role-gated, audit log,
// status column is endpoint-set only so an owner/writer can't self-approve by PATCHing)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 73");
const slug = "b73";
await c.ensure(slug);
await c.schema(slug, { tables: {
  expenses: {
    access: "admin",
    writeRoles: ["rep", "manager"],
    approval: { approvers: ["manager"] }, // status col defaults to approval_status
    columns: [{ name: "memo", type: "text" }, { name: "amount", type: "integer" }],
  },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 = admin
const REP = (await c.signup(slug, "rep@x.dev", "Str0ng-pass-9")).json.token;     // id2
const MGR = (await c.signup(slug, "mgr@x.dev", "Str0ng-pass-9")).json.token;     // id3
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;   // id4
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 2, action: "set_role", role: "rep" } });
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 3, action: "set_role", role: "manager" } });

// admin creates an expense
await c.post(`/api/db/${slug}/rows/expenses`, { memo: "Client dinner", amount: 400 }, { token: ADMIN }); // id 1
// fresh row has no approval status yet
t.eq((await c.get(`/api/db/${slug}/rows/expenses/1`, { token: ADMIN })).json.row.approval_status, null, "new row unsubmitted (status null)");

// a plain user (no write role) cannot submit
t.eq((await c.post(`/api/db/${slug}/rows/expenses/1/submit`, {}, { token: USER })).status, 403, "non-writer can't submit");
// a writer (rep) submits it → pending
let sub = await c.post(`/api/db/${slug}/rows/expenses/1/submit`, { note: "please review" }, { token: REP });
t.ok(sub.json.ok && sub.json.status === "pending", "rep submits → pending");
t.eq((await c.get(`/api/db/${slug}/rows/expenses/1`, { token: ADMIN })).json.row.approval_status, "pending", "row status is pending");

// the pending queue via the normal filter (status col is queryable)
t.eq((await c.get(`/api/db/${slug}/rows/expenses?where=approval_status:eq:pending`, { token: MGR })).json.rows.length, 1, "manager finds it in the pending queue via ?where");

// a rep is NOT an approver → can't approve
t.eq((await c.post(`/api/db/${slug}/rows/expenses/1/approve`, {}, { token: REP })).status, 403, "rep can't approve (not an approver role)");
// the manager approves
let ap = await c.post(`/api/db/${slug}/rows/expenses/1/approve`, { note: "ok by me" }, { token: MGR });
t.ok(ap.json.ok && ap.json.status === "approved", "manager approves → approved");
t.eq((await c.get(`/api/db/${slug}/rows/expenses/1`, { token: ADMIN })).json.row.approval_status, "approved", "row status is approved");

// audit log carries both decisions, newest first, with actors + notes
let log = (await c.get(`/api/db/${slug}/rows/expenses/1/approvals`, { token: MGR })).json;
t.ok(log.ok && log.status === "approved", "log endpoint returns current status");
t.eq(log.log.length, 2, "two log entries (submit + approve)");
t.eq(log.log[0].action, "approve", "newest entry is the approval");
t.eq(log.log[0].actor_id, 3, "approval actor is the manager (id3)");
t.eq(log.log[0].note, "ok by me", "approval note recorded");
t.eq(log.log[1].action, "submit", "oldest entry is the submit");
t.eq(log.log[1].actor_id, 2, "submit actor is the rep (id2)");

// reject path on a second expense
await c.post(`/api/db/${slug}/rows/expenses`, { memo: "Sketchy", amount: 9000 }, { token: ADMIN }); // id 2
await c.post(`/api/db/${slug}/rows/expenses/2/submit`, {}, { token: REP });
let rej = await c.post(`/api/db/${slug}/rows/expenses/2/reject`, { note: "no receipt" }, { token: MGR });
t.ok(rej.json.ok && rej.json.status === "rejected", "manager rejects → rejected");

// SELF-APPROVE HOLE CLOSED: a writer directly PATCHing the status column is ignored
// (approval_status is NOT in the app-writable set — only the endpoints set it).
await c.post(`/api/db/${slug}/rows/expenses`, { memo: "Self", amount: 100 }, { token: REP }); // id 3
await c.patch(`/api/db/${slug}/rows/expenses/3`, { memo: "Self edited", amount: 100, approval_status: "approved" }, { token: REP });
const three = (await c.get(`/api/db/${slug}/rows/expenses/3`, { token: ADMIN })).json.row;
t.eq(three.memo, "Self edited", "the writable field DID update");
t.eq(three.approval_status, null, "but approval_status stayed null (not app-writable — no self-approve)");

// a table without approval config rejects the endpoint
await c.schema(slug, { tables: { notes: { access: "admin", columns: [{ name: "body", type: "text" }] } } });
await c.post(`/api/db/${slug}/rows/notes`, { body: "x" }, { token: ADMIN });
t.eq((await c.post(`/api/db/${slug}/rows/notes/1/approve`, {}, { token: MGR })).status, 400, "no approval config → 400");

t.done(); h.restore();
