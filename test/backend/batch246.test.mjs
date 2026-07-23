// Batch 246 — TIME-OFF REQUESTS. A member requests time off; an admin approves/denies. Covers request, mine,
// admin list + filters, decide (approve/deny, once), owner-cancel-while-pending, admin delete, validation,
// authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 246");
const slug = "b246";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const req = (tok, body) => c.post(`/api/db/${slug}/timeoff`, body, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/timeoff/mine`, { token: tok }).then((r) => r.json);
const all = (tok, q) => c.get(`/api/db/${slug}/timeoff${q || ""}`, { token: tok }).then((r) => r.json);
const decide = (tok, id, approve, note) => c.post(`/api/db/${slug}/timeoff/${id}/decide`, { approve, note }, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/timeoff/${id}`, { token: tok });

// --- Request (member) ---
const r1 = (await req(B, { starts: "2026-07-01", ends: "2026-07-05", reason: "vacation" })).json;
t.eq(r1.status, "pending", "a new request is pending");
const id1 = r1.id;
await req(C, { starts: "2026-07-10", ends: "2026-07-10", reason: "appointment" });

// --- Mine ---
t.eq((await mine(B)).requests.length, 1, "B sees their own request");
t.eq((await mine(C)).requests.length, 1, "…C sees theirs");

// --- Admin list + status filter ---
t.eq((await all(A)).requests.length, 2, "admin sees all requests");
t.eq((await all(A, "?status=pending")).requests.length, 2, "…both pending");

// --- Decide: approve ---
t.eq((await decide(A, id1, true, "enjoy!")).json.status, "approved", "admin approves a request");
t.eq((await mine(B)).requests[0].status, "approved", "…reflected for the member");
t.eq((await mine(B)).requests[0].decision_note, "enjoy!", "…with the decision note");

// --- Deciding again → 409 ---
t.eq((await decide(A, id1, false)).status, 409, "re-deciding a decided request → 409");
t.eq((await all(A, "?status=approved")).requests.length, 1, "status filter approved → 1");

// --- Owner can cancel a pending request; not an approved one ---
const r3 = (await req(B, { starts: "2026-08-01", ends: "2026-08-02" })).json.id;
t.eq((await del(B, r3)).json.deleted, true, "the owner cancels their pending request");
t.eq((await del(B, id1)).status, 403, "…but can't cancel an already-approved one");

// --- Admin can delete any ---
t.eq((await del(A, id1)).json.deleted, true, "an admin can delete any request");

// --- Validation + authz ---
t.eq((await req(B, { ends: "2026-09-01" })).status, 400, "missing starts → 400");
t.eq((await req(B, { starts: "2026-09-05", ends: "2026-09-01" })).status, 400, "ends before starts → 400");
t.eq((await decide(B, 2, true)).status, 403, "a member can't decide → 403");
t.eq((await all(B)).status ?? 403, 403, "a member can't list all → 403");
t.eq((await c.get(`/api/db/${slug}/timeoff`, { token: B })).status, 403, "…confirmed 403");
t.eq((await decide(A, 999999, true)).status, 404, "deciding a missing request → 404");
t.eq((await c.post(`/api/db/${slug}/timeoff`, { starts: "2026-09-01", ends: "2026-09-02" })).status, 401, "signed-out request → 401");

t.done(); h.restore();
