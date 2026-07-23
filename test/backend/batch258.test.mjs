// Batch 258 — SLA TIMERS. Start a deadline clock for a (kind, ref) with a target in minutes; reads report
// remaining/breached; resolving stops the clock. Covers start + due_at, remaining, breach (white-box past
// start), resolve stops the clock, list + status filter, restart, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 258");
const slug = "b258";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 (member/staff)
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const start = (tok, kind, ref, mins) => c.post(`/api/db/${slug}/sla-timers/${kind}/${ref}`, { target_mins: mins }, tok === null ? {} : { token: tok }).then((r) => r.json);
const getT = (kind, ref) => c.get(`/api/db/${slug}/sla-timers/${kind}/${ref}`).then((r) => r.json);
const resolve = (tok, kind, ref) => c.post(`/api/db/${slug}/sla-timers/${kind}/${ref}/resolve`, {}, { token: tok }).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/sla-timers${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, kind, ref) => c.del(`/api/db/${slug}/sla-timers/${kind}/${ref}`, { token: tok });
const setStart = (kind, ref, iso) => h.getDb(uuid).prepare("UPDATE _sla_timers SET started_at=? WHERE kind=? AND ref=?").run(iso, kind, ref);

// --- Start a timer ---
let r = await start(B, "ticket", "101", 60);
t.eq(r.status, "open", "a new timer is open");
t.ok(r.due_at, "…with a due_at");
t.ok(r.remaining_mins > 55 && r.remaining_mins <= 60, "…~60 minutes remaining");

// --- Read reports remaining ---
t.eq((await getT("ticket", "101")).breached, false, "not breached yet");

// --- Breach (white-box: started 2h ago, target 60m) ---
setStart("ticket", "101", new Date(Date.now() - 120 * 60000).toISOString());
r = await getT("ticket", "101");
t.eq(r.breached, true, "an overdue timer is breached");
t.eq(r.status, "breached", "…status breached");
t.ok(r.remaining_mins < 0, "…remaining goes negative");

// --- Resolve stops the clock ---
r = await resolve(B, "ticket", "101");
t.eq(r.status, "resolved", "resolving marks it resolved");
t.eq(r.breached, false, "…no longer counted as breached");
t.eq((await getT("ticket", "101")).status, "resolved", "…stays resolved");

// --- List + status filter ---
await start(B, "ticket", "102", 30);
await start(B, "order", "9", 45);
setStart("ticket", "102", new Date(Date.now() - 60 * 60000).toISOString()); // breached
let l = (await list(A)).timers;
t.eq(l.length, 3, "admin lists all timers");
t.eq((await list(A, "?status=breached")).timers.length, 1, "status=breached → 1 (ticket/102)");
t.eq((await list(A, "?status=resolved")).timers.length, 1, "status=resolved → 1 (ticket/101)");
t.eq((await list(A, "?kind=order")).timers.length, 1, "kind filter → 1 order timer");

// --- Restart resets the clock ---
r = await start(B, "ticket", "102", 90);
t.eq(r.status, "open", "restarting a breached timer reopens it");
t.ok(r.remaining_mins > 85, "…with a fresh window");

// --- Delete (admin) ---
t.eq((await del(A, "order", "9")).json.deleted, true, "admin deletes a timer");
t.eq((await getT("order", "9")).ok ?? false, false, "…gone");

// --- Validation + authz ---
t.eq((await start(B, "ticket", "z", 0)).status ?? 400, 400, "target_mins 0 → 400");
t.eq((await c.post(`/api/db/${slug}/sla-timers/ticket/z`, { target_mins: 0 }, { token: B })).status, 400, "…confirmed 400");
t.eq((await c.post(`/api/db/${slug}/sla-timers/ticket/z`, { target_mins: 60 })).status, 401, "signed-out start → 401");
t.eq((await list(B)).status ?? 403, 403, "a member can't list all → 403");
t.eq((await c.get(`/api/db/${slug}/sla-timers`, { token: B })).status, 403, "…confirmed 403");
t.eq((await del(B, "ticket", "101")).status, 403, "a member can't delete → 403");
t.eq((await getT("ticket", "nope")).ok ?? false, false, "a missing timer → not ok");

t.done(); h.restore();
