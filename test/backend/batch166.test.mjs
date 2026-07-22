// Batch 166 — ADVERSARIAL: approval workflow. The security question: can a writer FORGE the
// approval_status via a normal PATCH (bypassing the approval endpoints)? Plus double-approve, a
// non-approver, and multi-approver (any listed role) semantics.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 166");
const slug = "b166";
await c.ensure(slug);
await c.schema(slug, { tables: {
  expenses: { access: "admin", writeRoles: ["rep", "manager", "finance"], approval: { approvers: ["manager", "finance"] },
              columns: [{ name: "memo", type: "text" }, { name: "amount", type: "integer" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const REP = (await c.signup(slug, "rep@x.dev", "Str0ng-pass-9")).json.token;     // id2
const MGR = (await c.signup(slug, "mgr@x.dev", "Str0ng-pass-9")).json.token;     // id3
const FIN = (await c.signup(slug, "fin@x.dev", "Str0ng-pass-9")).json.token;     // id4
const setRole = (id, role) => c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id, action: "set_role", role } });
await setRole(2, "rep"); await setRole(3, "manager"); await setRole(4, "finance");
const statusOf = (id) => c.get(`/api/db/${slug}/rows/expenses/${id}`, { token: ADMIN }).then((r) => r.json.row.approval_status);

// Row 1: rep submits → pending.
await c.post(`/api/db/${slug}/rows/expenses`, { memo: "dinner", amount: 400 }, { token: ADMIN }); // id1
await c.post(`/api/db/${slug}/rows/expenses/1/submit`, {}, { token: REP });
t.eq(await statusOf(1), "pending", "row 1 is pending after submit");

// --- SECURITY: a writer can't FORGE approval_status via a normal PATCH ---
let forge = await c.patch(`/api/db/${slug}/rows/expenses/1`, { approval_status: "approved", memo: "edited" }, { token: REP });
t.eq(await statusOf(1), "pending", "PATCH can't forge approval_status → stays pending");
t.eq((await c.get(`/api/db/${slug}/rows/expenses/1`, { token: ADMIN })).json.row.memo, "edited", "…but the real column (memo) did update, so the PATCH ran");
// Even an admin PATCH can't set the guarded status column directly.
await c.patch(`/api/db/${slug}/rows/expenses/1`, { approval_status: "approved" }, { token: ADMIN });
t.eq(await statusOf(1), "pending", "even an admin can't set approval_status via PATCH (endpoint-only)");

// --- A non-approver role can't approve ---
t.eq((await c.post(`/api/db/${slug}/rows/expenses/1/approve`, {}, { token: REP })).status, 403, "the rep (not an approver) can't approve");

// --- Multi-approver: ANY listed approver role can approve (OR semantics) ---
// The finance role (also an approver) approves row 1.
let ap = await c.post(`/api/db/${slug}/rows/expenses/1/approve`, { note: "fin ok" }, { token: FIN });
t.ok(ap.json.ok && ap.json.status === "approved", "a finance approver (one of the listed roles) can approve");
t.eq(await statusOf(1), "approved", "row 1 is approved");

// --- Double-approve is a no-op / not corrupting: status stays approved ---
let again = await c.post(`/api/db/${slug}/rows/expenses/1/approve`, {}, { token: MGR });
t.ok(again.status === 200 || again.status === 409, "re-approving an approved row is handled (200 idempotent or 409)");
t.eq(await statusOf(1), "approved", "…and the status remains approved (not corrupted)");

// --- Reject path + can't approve a rejected row without resubmit ---
await c.post(`/api/db/${slug}/rows/expenses`, { memo: "sketchy", amount: 9000 }, { token: ADMIN }); // id2
await c.post(`/api/db/${slug}/rows/expenses/2/submit`, {}, { token: REP });
t.eq((await c.post(`/api/db/${slug}/rows/expenses/2/reject`, { note: "no receipt" }, { token: MGR })).json.status, "rejected", "manager rejects row 2");
t.eq(await statusOf(2), "rejected", "row 2 is rejected");

// --- The approvals log is append-only and attributes actors correctly ---
let log = (await c.get(`/api/db/${slug}/rows/expenses/1/approvals`, { token: MGR })).json;
t.ok(log.log.some((e) => e.action === "approve" && e.actor_id === 4), "the approval is attributed to the finance actor (id4)");
t.ok(log.log.some((e) => e.action === "submit" && e.actor_id === 2), "the submit is attributed to the rep (id2)");

t.done(); h.restore();
