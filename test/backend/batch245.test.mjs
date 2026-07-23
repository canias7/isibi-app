// Batch 245 — STAFF SHIFTS. An admin schedules staff shifts (who, when, role); a coverage check counts who
// is on during a window; a member sees their own shifts. Covers create + validation, list + filters, mine,
// coverage (overlap logic), delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 245");
const slug = "b245";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (em) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(em)[0].id;
const create = (tok, body) => c.post(`/api/db/${slug}/shifts`, body, tok === null ? {} : { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/shifts${q || ""}`, { token: tok }).then((r) => r.json);
const mine = (tok) => c.get(`/api/db/${slug}/shifts/mine`, { token: tok }).then((r) => r.json);
const coverage = (tok, from, to) => c.get(`/api/db/${slug}/shifts/coverage?from=${from}&to=${to}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/shifts/${id}`, { token: tok });
const bId = idOf("b@x.dev"), cId = idOf("c@x.dev");

// --- Create shifts ---
const s1 = (await create(A, { user: bId, starts: "2026-06-01T09:00:00Z", ends: "2026-06-01T17:00:00Z", role: "cashier" })).json.id;
await create(A, { user: cId, starts: "2026-06-01T12:00:00Z", ends: "2026-06-01T20:00:00Z", role: "floor" });
await create(A, { user: bId, starts: "2026-06-02T09:00:00Z", ends: "2026-06-02T17:00:00Z" });
t.ok(s1, "admin schedules a shift");

// --- List + user filter ---
t.eq((await list(A)).shifts.length, 3, "3 shifts total");
t.eq((await list(A, `?user=${bId}`)).shifts.length, 2, "user filter → B's 2 shifts");

// --- Mine ---
t.eq((await mine(B)).shifts.length, 2, "B sees their own 2 shifts");
t.eq((await mine(C)).shifts.length, 1, "…C sees 1");

// --- Coverage: midday June 1 (both B and C are on) ---
let cov = await coverage(A, "2026-06-01T13:00:00Z", "2026-06-01T14:00:00Z");
t.eq(cov.staff_count, 2, "both staff cover 1–2pm on June 1");
// Morning June 1: only B (C starts at noon)
cov = await coverage(A, "2026-06-01T10:00:00Z", "2026-06-01T11:00:00Z");
t.eq(cov.staff_count, 1, "only B covers 10–11am");
t.eq(cov.staff[0], bId, "…and it's B");
// A window with no shifts
cov = await coverage(A, "2026-06-05T10:00:00Z", "2026-06-05T11:00:00Z");
t.eq(cov.on_shift, 0, "no coverage on June 5");

// --- Delete ---
t.eq((await del(A, s1)).json.deleted, true, "admin deletes a shift");
t.eq((await list(A)).shifts.length, 2, "…now 2");

// --- Validation + authz ---
t.eq((await create(A, { user: bId, starts: "2026-06-01T09:00:00Z" })).status, 400, "missing ends → 400");
t.eq((await create(A, { user: bId, starts: "2026-06-01T17:00:00Z", ends: "2026-06-01T09:00:00Z" })).status, 400, "ends before starts → 400");
t.eq((await create(A, { user: 999999, starts: "2026-06-01T09:00:00Z", ends: "2026-06-01T17:00:00Z" })).status, 404, "a missing user → 404");
t.eq((await create(B, { user: cId, starts: "2026-06-01T09:00:00Z", ends: "2026-06-01T17:00:00Z" })).status, 403, "a member can't schedule → 403");
t.eq((await coverage(B, "2026-06-01T09:00:00Z", "2026-06-01T17:00:00Z")).status ?? 403, 403, "a member can't read coverage → 403");
t.eq((await c.get(`/api/db/${slug}/shifts/coverage?from=x&to=y`, { token: B })).status, 403, "…confirmed 403");
t.eq((await c.get(`/api/db/${slug}/shifts/mine`)).status, 401, "signed-out mine → 401");

t.done(); h.restore();
