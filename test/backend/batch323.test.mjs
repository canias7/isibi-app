// Batch 323 — RIGHT-TO-BE-FORGOTTEN QUEUE. A member opens a data-erasure request; an admin moves it open →
// processing → done | rejected. Covers open, one-open guard, mine, queue, process/complete, reject, invalid
// transitions, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 323");
const slug = "b323";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const open = (tok, body) => c.post(`/api/db/${slug}/erasure-requests`, body || {}, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/erasure-requests/mine`, { token: tok }).then((r) => r.json);
const queue = (tok, q) => c.get(`/api/db/${slug}/erasure-requests${q || ""}`, { token: tok }).then((r) => r.json);
const act = (tok, id, a, body) => c.post(`/api/db/${slug}/erasure-requests/${id}/${a}`, body || {}, { token: tok });

// --- Open ---
const b1 = (await open(B, { reason: "please delete my data" })).json.id;
t.ok(b1, "member opens an erasure request");
t.eq((await mine(B)).requests[0].status, "open", "…status open");

// --- One open at a time ---
t.eq((await open(B)).status, 409, "a second open request → 409");

// --- Admin queue ---
const c1 = (await open(C)).json.id;
t.eq((await queue(A, "?status=open")).requests.length, 2, "admin sees the open queue");

// --- Process → complete ---
t.eq((await act(A, b1, "process")).json.status, "processing", "admin starts processing");
t.eq((await act(A, b1, "complete", { note: "erased" })).json.status, "done", "admin completes it");
t.ok((await mine(B)).requests.find((r) => r.status === "done"), "…the done request is recorded");

// --- Reject path ---
t.eq((await act(A, c1, "reject", { note: "not verified" })).json.status, "rejected", "admin rejects a request");
t.eq((await queue(A, "?status=open")).requests.length, 0, "…the open queue is now empty");

// --- Invalid transitions ---
t.eq((await act(A, b1, "process")).status, 409, "can't process a done request → 409");
t.eq((await act(A, c1, "complete")).status, 409, "can't complete a rejected request → 409");
t.eq((await act(A, 999999, "process")).status, 404, "acting on a missing request → 404");

// --- Authz ---
t.eq((await act(B, c1, "process")).status, 403, "a member can't transition → 403");
t.eq((await c.get(`/api/db/${slug}/erasure-requests`, { token: B })).status, 403, "a member can't read the queue → 403");
t.eq((await c.post(`/api/db/${slug}/erasure-requests`, {})).status, 401, "signed-out → 401");

t.done(); h.restore();
