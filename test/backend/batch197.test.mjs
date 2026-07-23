// Batch 197 — BUSINESS HOURS. Weekly open intervals (local time) + per-date overrides, and an "open now?"
// check that respects the business timezone and special days. Uses fixed dates (2026-07-27 = Monday) and
// explicit tz so the open-check is deterministic.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 197");
const slug = "b197";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const add = (tok, body) => c.post(`/api/db/${slug}/hours`, body, tok === null ? {} : { token: tok });
const sched = (tok) => c.get(`/api/db/${slug}/hours`, tok === null ? {} : { token: tok }).then((r) => r.json);
const special = (tok, body) => c.post(`/api/db/${slug}/hours/special`, body, { token: tok });
const delSpecial = (tok, date) => c.del(`/api/db/${slug}/hours/special/${date}`, { token: tok });
const delInterval = (tok, id) => c.del(`/api/db/${slug}/hours/${id}`, { token: tok });
const open = (tok, at, tz) => c.get(`/api/db/${slug}/hours/open?at=${encodeURIComponent(at)}&tz=${tz || 0}`, tok === null ? {} : { token: tok }).then((r) => r.json);
const MON = "2026-07-27", SUN = "2026-07-26", TUE = "2026-07-28";

// --- Weekly intervals (Mon 9-17 and 18-20, Tue 10-14) ---
const i1 = (await add(A, { dow: 1, open: "09:00", close: "17:00" })).json.id;
await add(A, { dow: 1, open: "18:00", close: "20:00" });
await add(A, { dow: 2, open: "10:00", close: "14:00" });
let s = await sched(null);
t.eq([s.weekly["1"].length, s.weekly["2"].length, s.weekly["0"].length], [2, 1, 0], "weekly schedule groups by day");

// --- Open-now against regular hours ---
t.eq((await open(null, `${MON}T14:00:00Z`, 0)).open, true, "Mon 14:00 → open (within 9-17)");
t.eq((await open(null, `${MON}T17:30:00Z`, 0)).open, false, "Mon 17:30 → closed (in the 17-18 gap)");
t.eq((await open(null, `${MON}T19:00:00Z`, 0)).open, true, "Mon 19:00 → open (evening interval)");
t.eq((await open(null, `${SUN}T12:00:00Z`, 0)).reason, "closed_today", "Sunday → closed all day");

// --- Timezone shifts the local hour ---
t.eq((await open(null, `${MON}T16:00:00Z`, 0)).open, true, "16:00Z at tz 0 → 16:00 local → open");
t.eq((await open(null, `${MON}T16:00:00Z`, -480)).open, false, "16:00Z at tz -8h → 08:00 local → closed (before 9)");

// --- Special override: a holiday closes an otherwise-open day ---
await special(A, { date: MON, closed: true, note: "Holiday" });
t.eq((await open(null, `${MON}T14:00:00Z`, 0)).reason, "special_closed", "a closed override wins over regular Monday hours");
t.eq((await delSpecial(A, MON)).json.deleted, true, "remove the override");
t.eq((await open(null, `${MON}T14:00:00Z`, 0)).open, true, "…back to regular open");

// --- Special hours override the regular ones for that date ---
await special(A, { date: TUE, open: "12:00", close: "13:00" });
t.eq((await open(null, `${TUE}T12:30:00Z`, 0)).open, true, "Tue special 12-13 → open at 12:30");
t.eq((await open(null, `${TUE}T11:00:00Z`, 0)).open, false, "…and closed at 11:00 (regular Tue 10-14 is overridden)");

// --- Remove an interval ---
t.eq((await delInterval(A, i1)).json.deleted, true, "delete the Mon 9-17 interval");
t.eq((await sched(null)).weekly["1"].length, 1, "…Monday now has just the evening interval");

// --- Validation + authz ---
t.eq((await add(A, { dow: 7, open: "09:00", close: "17:00" })).status, 400, "dow 7 → 400");
t.eq((await add(A, { dow: 1, open: "17:00", close: "09:00" })).status, 400, "close <= open → 400");
t.eq((await special(A, { closed: true })).status, 400, "special without a date → 400");
t.eq((await add(B, { dow: 1, open: "09:00", close: "17:00" })).status, 403, "a non-admin can't add hours → 403");
t.eq((await add(null, { dow: 1, open: "09:00", close: "17:00" })).status, 401, "signed-out add → 401");
t.eq((await sched(null)).ok, true, "…but the schedule + open-check read publicly");

t.done(); h.restore();
