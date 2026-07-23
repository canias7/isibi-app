// Batch 298 — ANALYTICS SESSIONS. A member opens a session, heartbeats it, and ends it; an admin counts who's
// active in a recent window. Covers start, beat (page_views bump), end, active (admin), me, ownership, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 298");
const slug = "b298";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const start = (tok) => c.post(`/api/db/${slug}/sessions/start`, {}, { token: tok });
const beat = (tok, id) => c.post(`/api/db/${slug}/sessions/${id}/beat`, {}, { token: tok });
const end = (tok, id) => c.post(`/api/db/${slug}/sessions/${id}/end`, {}, { token: tok });
const active = (tok, q) => c.get(`/api/db/${slug}/sessions/active${q || ""}`, { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/sessions/me`, { token: tok }).then((r) => r.json);

// --- Start ---
const s1 = (await start(B)).json.id;
const s2 = (await start(C)).json.id;
t.ok(s1 && s2, "members open sessions");

// --- Beat bumps page_views ---
t.eq((await beat(B, s1)).json.page_views, 2, "a heartbeat bumps page_views to 2");
t.eq((await beat(B, s1)).json.page_views, 3, "…and again to 3");

// --- Active (admin) ---
let ac = (await active(A)).json;
t.eq(ac.active, 2, "two active sessions");
t.eq(ac.unique_users, 2, "…from two users");

// --- End ---
t.eq((await end(B, s1)).json.ended, true, "owner ends their session");
t.eq((await active(A)).json.active, 1, "…active count drops to 1");
t.eq((await beat(B, s1)).status, 404, "beating an ended session → 404");

// --- Me ---
t.eq((await mine(B)).sessions.length, 1, "B lists their session");
t.ok((await mine(B)).sessions[0].ended_at, "…marked ended");

// --- Ownership + authz ---
t.eq((await beat(C, s1)).status, 404, "a non-owner can't beat someone's session → 404");
t.eq((await active(B)).status, 403, "a member can't read the active list → 403");
t.eq((await c.post(`/api/db/${slug}/sessions/start`, {})).status, 401, "signed-out start → 401");
// Old sessions fall outside a tight window
h.getDb(uuid).prepare("UPDATE _sessions SET last_seen=? WHERE id=?").run(new Date(Date.now() - 3600000).toISOString(), s2);
t.eq((await active(A, "?window=5m")).json.active, 0, "a stale session is outside the 5m window");
t.eq((await active(A, "?window=2h")).json.active, 1, "…but inside a 2h window");

t.done(); h.restore();
