// Batch 311 — RENEWALS. Contract / subscription end-date tracking with an upcoming window and a renew action.
// Covers create, upcoming window (in / out), renew (bumps date), patch status, list filter, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 311");
const slug = "b311";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();
const create = (tok, body) => c.post(`/api/db/${slug}/renewals`, body, tok === null ? {} : { token: tok });
const upcoming = (tok, q) => c.get(`/api/db/${slug}/renewals/upcoming${q || ""}`, { token: tok }).then((r) => r.json);
const renew = (tok, id, body) => c.post(`/api/db/${slug}/renewals/${id}/renew`, body, { token: tok });
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/renewals/${id}`, body, { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/renewals${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/renewals/${id}`, { token: tok });

// --- Create with various end dates ---
const soon = (await create(A, { name: "Acme SaaS", end_date: iso(15), amount: 99.0 })).json.id;
const later = (await create(A, { name: "Big Contract", end_date: iso(200) })).json.id;
t.ok(soon && later, "admin creates renewals");

// --- Upcoming window ---
let up = (await upcoming(A, "?days=30")).upcoming;
t.eq(up.length, 1, "only the renewal within 30 days is upcoming");
t.eq(up[0].id, soon, "…the soon one");
t.eq((await upcoming(A, "?days=365")).upcoming.length, 2, "a wider window catches both");

// --- Renew bumps the end date out of the window ---
t.eq((await renew(A, soon, { end_date: iso(400), amount: 120.0 })).json.status, "active", "renew keeps it active");
t.eq((await upcoming(A, "?days=30")).upcoming.length, 0, "…and pushes it out of the 30-day window");

// --- Patch to cancelled drops it from upcoming ---
t.eq((await patch(A, later, { status: "cancelled" })).json.id, later, "admin cancels a renewal");
t.eq((await upcoming(A, "?days=365")).upcoming.length, 0, "cancelled renewals are not upcoming");

// --- List filter ---
t.eq((await list(A, "?status=cancelled")).renewals.length, 1, "list filters by status");
t.eq((await list(A)).renewals.length, 2, "…and lists all without a filter");

// --- Delete ---
t.eq((await del(A, later)).json.deleted, true, "admin deletes a renewal");

// --- Validation + authz ---
t.eq((await create(A, { name: "x" })).status, 400, "a missing end_date → 400");
t.eq((await create(A, { end_date: iso(10) })).status, 400, "a missing name → 400");
t.eq((await create(A, { name: "x", end_date: "not-a-date" })).status, 400, "a bad end_date → 400");
t.eq((await renew(A, soon, { end_date: "bad" })).status, 400, "renew with a bad date → 400");
t.eq((await renew(A, 999999, { end_date: iso(30) })).status, 404, "renew a missing one → 404");
t.eq((await create(B, { name: "x", end_date: iso(10) })).status, 403, "a member can't create → 403");
t.eq((await c.get(`/api/db/${slug}/renewals`)).status, 401, "signed-out → 401");

t.done(); h.restore();
