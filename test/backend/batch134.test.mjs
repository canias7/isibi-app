// Batch 134 — time & attendance: clock in/out, no double-open, hours summary, admin manual entry
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 134");
const slug = "b134";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2 (employee "2")
const clockIn = (body, tok) => c.post(`/api/db/${slug}/timeclock/in`, body || {}, { token: tok || A });
const clockOut = (body, tok) => c.post(`/api/db/${slug}/timeclock/out`, body || {}, { token: tok || A });
const status = (tok) => c.get(`/api/db/${slug}/timeclock/status`, { token: tok || A });

// Clock in, then out — minutes computed.
let ci = await clockIn({ at: "2026-03-02T09:00:00Z" });
t.eq(ci.status, 200, "clock in → 200");
t.ok((await status()).json.clocked_in, "status shows clocked in");
t.eq((await status()).json.since, "2026-03-02T09:00:00.000Z", "status shows since");
// Can't clock in twice.
t.eq((await clockIn({ at: "2026-03-02T10:00:00Z" })).status, 409, "double clock-in → 409");
t.eq((await clockIn({})).json.code, "open", "409 code open");
let co = await clockOut({ at: "2026-03-02T17:30:00Z" });
t.eq(co.status, 200, "clock out → 200");
t.eq(co.json.minutes, 510, "8.5h = 510 min");
t.eq(co.json.hours, 8.5, "8.5 hours");
t.ok(!(await status()).json.clocked_in, "no longer clocked in");
// Can't clock out when not in.
t.eq((await clockOut({})).status, 409, "clock out with no open shift → 409");
t.eq((await clockOut({})).json.code, "not_open", "409 code not_open");

// Another shift, then a summary.
await clockIn({ at: "2026-03-03T09:00:00Z" });
await clockOut({ at: "2026-03-03T13:00:00Z" }); // 4h
let sum = (await c.get(`/api/db/${slug}/timeclock/summary?employee=2`, { token: A })).json;
t.eq(sum.shifts, 2, "2 completed shifts");
t.eq(sum.hours, 12.5, "8.5 + 4 = 12.5 hours");

// Date-scoped summary.
let mar2 = (await c.get(`/api/db/${slug}/timeclock/summary?employee=2&from=2026-03-02&to=2026-03-02`, { token: A })).json;
t.eq(mar2.hours, 8.5, "only Mar 2 shift in the window");

// Entries history.
let ent = (await c.get(`/api/db/${slug}/timeclock/entries`, { token: A })).json.entries;
t.eq(ent.length, 2, "two entries");
t.ok(ent.every((e) => !e.open), "both closed");

// Ownership: a member can't clock or view another employee; admin can act for anyone.
t.eq((await clockIn({ employee: "999" }, A)).status, 403, "member can't clock another employee");
t.eq((await c.get(`/api/db/${slug}/timeclock/summary?employee=2`, { token: ADMIN })).json.hours, 12.5, "admin views employee 2");
// admin manual entry (correction) for anyone.
let man = await c.post(`/api/db/${slug}/timeclock/entry`, { employee: "carol", clock_in: "2026-03-04T08:00:00Z", clock_out: "2026-03-04T16:00:00Z" }, { token: ADMIN });
t.eq(man.json.minutes, 480, "manual entry 8h");
t.eq((await c.post(`/api/db/${slug}/timeclock/entry`, { employee: "carol", clock_in: "x", clock_out: "y" }, { token: ADMIN })).status, 400, "manual entry bad dates → 400");
t.eq((await c.post(`/api/db/${slug}/timeclock/entry`, { employee: "carol", clock_in: "2026-03-04T08:00:00Z", clock_out: "2026-03-04T16:00:00Z" }, { token: A })).status, 403, "non-admin manual entry → 403");

// Org-wide summary (admin, no employee) groups everyone.
let all = (await c.get(`/api/db/${slug}/timeclock/summary`, { token: ADMIN })).json.summary;
t.ok(all.some((s) => s.employee === "2" && s.hours === 12.5) && all.some((s) => s.employee === "carol" && s.hours === 8), "org summary lists both");
t.eq((await c.get(`/api/db/${slug}/timeclock/summary`, { token: A })).status, 403, "non-admin org summary → 403");

// Auth.
t.eq((await c.post(`/api/db/${slug}/timeclock/in`, {})).status, 401, "signed-out → 401");

t.done(); h.restore();
