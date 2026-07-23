// Batch 373 — MAINTENANCE SCHEDULE. An asset with a recurring service interval; servicing advances next_due;
// a check flags overdue. Covers register, next_due computation, service (now + backdated), overdue flag +
// filter, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 373");
const slug = "b373";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const reg = (tok, body) => c.post(`/api/db/${slug}/maintenance-schedule`, body, { token: tok });
const get = (key) => c.get(`/api/db/${slug}/maintenance-schedule/${key}`).then((r) => r.json);

// --- Register with last_serviced → next_due = last + interval ---
let r = (await reg(A, { key: "hvac", name: "HVAC filter", interval_days: 90, last_serviced: "2026-01-01" })).json;
t.eq(r.item.interval_days, 90, "interval stored");
t.eq(r.item.next_due.slice(0, 10), "2026-04-01", "next_due = last_serviced + 90d");

// --- Register with no last_serviced → due interval days from now ---
r = (await reg(A, { key: "fresh", interval_days: 30 })).json;
t.ok(r.item.days_until >= 29 && r.item.days_until <= 30, "a fresh item is due ~interval days out");
t.eq(r.item.overdue, false, "…not overdue");

// --- A past-due item flags overdue ---
r = await get("hvac"); // last serviced 2026-01-01, due 2026-04-01 — already past on 2026-07
t.eq(r.item.overdue, true, "an item past next_due is overdue");
t.ok(r.item.days_until < 0, "…days_until is negative");

// --- Service advances next_due from the service date ---
r = (await c.post(`/api/db/${slug}/maintenance-schedule/hvac/service`, { date: "2026-07-01" }, { token: A })).json;
t.eq(r.item.last_serviced.slice(0, 10), "2026-07-01", "service sets last_serviced");
t.eq(r.item.next_due.slice(0, 10), "2026-09-29", "…and next_due = serviced + 90d");
t.eq(r.item.overdue, false, "…no longer overdue");

// --- Overdue filter ---
await reg(A, { key: "old", interval_days: 10, last_serviced: "2020-01-01" });
let over = (await c.get(`/api/db/${slug}/maintenance-schedule?overdue=1`).then((x) => x.json)).items;
t.ok(over.some((i) => i.key === "old"), "overdue filter includes the old item");
t.ok(!over.some((i) => i.key === "fresh"), "…and excludes the fresh one");

// --- List all ---
t.ok((await c.get(`/api/db/${slug}/maintenance-schedule`).then((x) => x.json)).items.length >= 3, "list returns all items");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/maintenance-schedule/fresh`, { token: A })).json.deleted, true, "admin deletes an item");
t.eq((await get("fresh")).ok, false, "…and it's gone");

// --- Validation + authz ---
t.eq((await reg(A, { key: "x", interval_days: 0 })).status, 400, "interval < 1 → 400");
t.eq((await reg(A, { key: "bad key!", interval_days: 5 })).status, 400, "an invalid key → 400");
t.eq((await c.post(`/api/db/${slug}/maintenance-schedule/ghost/service`, {}, { token: A })).status, 404, "servicing a missing item → 404");
t.eq((await reg(B, { key: "z", interval_days: 5 })).status, 403, "a member can't register → 403");
t.eq((await c.post(`/api/db/${slug}/maintenance-schedule`, { key: "z", interval_days: 5 })).status, 401, "signed-out → 401");

t.done(); h.restore();
