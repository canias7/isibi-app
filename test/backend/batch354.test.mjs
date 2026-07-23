// Batch 354 — EXPENSE CLAIMS. A member submits an expense; an admin moves it submitted → approved | rejected,
// and approved → reimbursed. Covers submit, mine, queue + total, get-one authz, approve/reimburse, reject,
// invalid transitions, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 354");
const slug = "b354";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const submit = (tok, body) => c.post(`/api/db/${slug}/expense-claims`, body, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/expense-claims/mine`, { token: tok }).then((r) => r.json);
const queue = (tok, q) => c.get(`/api/db/${slug}/expense-claims${q || ""}`, { token: tok }).then((r) => r.json);
const one = (tok, id) => c.get(`/api/db/${slug}/expense-claims/${id}`, { token: tok });
const act = (tok, id, a, body) => c.post(`/api/db/${slug}/expense-claims/${id}/${a}`, body || {}, { token: tok });

// --- Submit ---
const e1 = (await submit(B, { amount: 42.50, category: "travel", description: "taxi" })).json.id;
const e2 = (await submit(B, { amount: 100, category: "meals" })).json.id;
t.ok(e1 && e2, "member submits expenses");
t.eq((await one(B, e1)).json.claim.amount, 4250, "…amount stored in cents");
t.eq((await one(B, e1)).json.claim.status, "submitted", "…status submitted");

// --- Mine / queue ---
t.eq((await mine(B)).claims.length, 2, "B sees their 2 claims");
let q = await queue(A);
t.eq(q.claims.length, 2, "admin sees the queue");
t.eq(q.total_amount, 14250, "…with a total in cents");

// --- Approve → reimburse ---
t.eq((await act(A, e1, "approve")).json.status, "approved", "admin approves");
t.eq((await act(A, e1, "reimburse")).json.status, "reimbursed", "…then reimburses");
t.eq((await act(A, e1, "reimburse")).status, 409, "…reimbursing again → 409");

// --- Reject ---
t.eq((await act(A, e2, "reject", { note: "no receipt" })).json.status, "rejected", "admin rejects with a note");
t.eq((await one(A, e2)).json.claim.note, "no receipt", "…note stored");
t.eq((await act(A, e2, "approve")).status, 409, "can't approve a rejected claim");

// --- Status filter ---
t.eq((await queue(A, "?status=reimbursed")).claims.length, 1, "queue filters by status");

// --- Authz ---
t.eq((await one(C, e1)).status, 403, "another member can't read someone's claim → 403");
t.eq((await act(B, e2, "approve")).status, 403, "a member can't transition → 403");
t.eq((await c.get(`/api/db/${slug}/expense-claims`, { token: B })).status, 403, "a member can't read the queue → 403");

// --- Validation ---
t.eq((await submit(B, {})).status, 400, "a missing amount → 400");
t.eq((await submit(B, { amount: -5 })).status, 400, "a negative amount → 400");
t.eq((await act(A, 999999, "approve")).status, 404, "acting on a missing claim → 404");
t.eq((await c.post(`/api/db/${slug}/expense-claims`, { amount: 5 })).status, 401, "signed-out → 401");

t.done(); h.restore();
