// Batch 205 — SUPPORT TICKETS. A member opens a ticket, staff (admin) triage/assign/resolve, both reply on
// a thread; an internal message is a staff-only note. Covers open, list scoping (own vs all + filters),
// get+thread with internal-note hiding, reply, requester-reply reopens, triage (status/priority/assignee),
// authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 205");
const slug = "b205";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3 member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (em) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(em)[0].id;
const open = (tok, body) => c.post(`/api/db/${slug}/tickets`, body, tok === null ? {} : { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/tickets${q || ""}`, { token: tok }).then((r) => r.json);
const getT = (tok, id) => c.get(`/api/db/${slug}/tickets/${id}`, { token: tok });
const reply = (tok, id, body) => c.post(`/api/db/${slug}/tickets/${id}/messages`, body, { token: tok });
const triage = (tok, id, body) => c.patch(`/api/db/${slug}/tickets/${id}`, body, { token: tok });

// --- Open (member) ---
const t1 = (await open(B, { subject: "Login broken", body: "Can't sign in", priority: "high" })).json;
t.eq(t1.status, "open", "new ticket is open");
t.eq(t1.priority, "high", "…with the given priority");
const id1 = t1.id;
const t2 = (await open(C, { subject: "Billing q", body: "Charged twice" })).json;
t.eq(t2.priority, "normal", "priority defaults to normal");

// --- List scoping ---
t.eq((await list(B)).tickets.length, 1, "B sees only their own ticket");
t.eq((await list(A)).tickets.length, 2, "admin sees all tickets");
t.eq((await list(A, "?status=open")).tickets.length, 2, "admin filters by status");
t.eq((await list(A, "?mine=1")).tickets.length, 0, "admin ?mine=1 → only tickets they requested (none)");

// --- Get + thread ---
let g = (await getT(B, id1)).json;
t.eq(g.messages.length, 1, "thread has the opening message");
t.eq(g.messages[0].body, "Can't sign in", "…with the body");
t.eq((await getT(C, id1)).status, 403, "another member can't view someone else's ticket");

// --- Internal notes hidden from requester ---
await reply(A, id1, { body: "internal: check auth logs", internal: true });
await reply(A, id1, { body: "We're looking into it" });
t.eq((await getT(B, id1)).json.messages.length, 2, "requester sees opening + public reply (not the internal note)");
t.eq((await getT(A, id1)).json.messages.length, 3, "admin sees all 3 incl. the internal note");
t.eq((await reply(B, id1, { body: "x", internal: true })).json.internal, false, "a member can't post an internal note (coerced public)");

// --- Triage (admin) ---
t.eq((await triage(A, id1, { status: "resolved", assignee: idOf("a@x.dev") })).json.ticket.status, "resolved", "admin resolves + assigns");
t.ok((await getT(A, id1)).json.ticket.closed_at, "…resolved sets closed_at");

// --- Requester reply reopens a resolved ticket ---
await reply(B, id1, { body: "Still broken!" });
t.eq((await getT(A, id1)).json.ticket.status, "open", "a requester reply reopens the resolved ticket");
t.eq((await getT(A, id1)).json.ticket.closed_at, null, "…and clears closed_at");

// --- Validation + authz ---
t.eq((await open(B, { body: "no subject" })).status, 400, "missing subject → 400");
t.eq((await open(B, { subject: "no body" })).status, 400, "missing body → 400");
t.eq((await triage(B, id1, { status: "closed" })).status, 403, "a member can't triage → 403");
t.eq((await triage(A, id1, { status: "bogus" })).status, 400, "a bad status → 400");
t.eq((await triage(A, id1, { assignee: 999999 })).status, 400, "assigning a non-existent user → 400");
t.eq((await getT(A, 999999)).status, 404, "a missing ticket → 404");
t.eq((await open(null, { subject: "x", body: "y" })).status, 401, "signed-out open → 401");

t.done(); h.restore();
