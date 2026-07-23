// Batch 189 — ANNOUNCEMENTS. An admin broadcasts; each member sees ACTIVE ones until they dismiss.
// Covers per-member dismissal, scheduling window (starts_at/ends_at), admin all-view + delete, guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 189");
const slug = "b189";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const future = new Date(Date.now() + 864e5).toISOString();
const past = new Date(Date.now() - 864e5).toISOString();
const post = (tok, body) => c.post(`/api/db/${slug}/announcements`, body, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/announcements`, { token: tok }).then((r) => r.json.announcements);
const all = (tok) => c.get(`/api/db/${slug}/announcements/all`, { token: tok });
const dismiss = (tok, id) => c.post(`/api/db/${slug}/announcements/${id}/dismiss`, {}, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/announcements/${id}`, { token: tok });

// --- Post + per-member view ---
const a1 = (await post(A, { title: "Maintenance", body: "Down at 5pm", level: "warning" })).json.id;
const a2 = (await post(A, { body: "New feature!" })).json.id;
t.eq((await mine(B)).map((x) => x.id), [a2, a1], "B sees both active announcements, newest-first");

// --- Dismiss is per-member ---
t.eq((await dismiss(B, a1)).json.dismissed, true, "B dismisses a1");
t.eq((await mine(B)).map((x) => x.id), [a2], "…a1 drops out of B's list");
t.eq((await dismiss(B, a1)).json.already, true, "dismissing again is idempotent (already:true)");
t.eq((await mine(C)).length, 2, "C still sees both (dismissal is per-member)");

// --- Scheduling window ---
const a3 = (await post(A, { body: "later", starts_at: future })).json.id;
const a4 = (await post(A, { body: "expired", ends_at: past })).json.id;
let bList = (await mine(B)).map((x) => x.id);
t.ok(!bList.includes(a3), "a not-yet-started announcement is hidden");
t.ok(!bList.includes(a4), "an expired announcement is hidden");
t.eq(bList, [a2], "B still sees only a2");

// --- Admin all-view + delete ---
t.eq((await all(A)).json.announcements.length, 4, "admin /all shows every announcement incl. scheduled/expired");
t.eq((await all(B)).status, 403, "a member can't read /all → 403");
t.eq((await del(A, a2)).json.deleted, true, "admin deletes a2");
t.eq((await mine(B)).length, 0, "…B's list is now empty (a1 dismissed, a2 deleted, a3 future, a4 expired)");

// --- Validation + guards ---
t.eq((await del(A, 999999)).status, 404, "delete a non-existent announcement → 404");
t.eq((await dismiss(B, 999999)).status, 404, "dismiss a non-existent announcement → 404");
t.eq((await post(A, {})).status, 400, "missing body → 400");
t.eq((await post(B, { body: "hax" })).status, 403, "a non-admin can't post → 403");
t.eq((await c.get(`/api/db/${slug}/announcements`)).status, 401, "signed-out GET → 401");

t.done(); h.restore();
