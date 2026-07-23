// Batch 385 — CRON PREVIEW. Stateless "when does this cron next fire?" for 5-field cron (min hour dom month dow;
// * , - /). Returns the next N UTC fire times from a given `from`. Covers common patterns + DOM/DOW OR semantics.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 385");
const slug = "b385";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const cron = (expression, opts = {}) => c.post(`/api/db/${slug}/cron-preview`, { expression, ...opts }).then((r) => r.json);

// --- Every minute ---
let r = await cron("* * * * *", { from: "2026-01-01T00:00:30Z", count: 3 });
t.eq(r.next.length, 3, "returns 3 fire times");
t.eq(r.next[0], "2026-01-01T00:01:00.000Z", "next whole minute");
t.eq(r.next[1], "2026-01-01T00:02:00.000Z", "…then the following minute");

// --- Daily at 09:30 ---
r = await cron("30 9 * * *", { from: "2026-01-01T10:00:00Z", count: 2 });
t.eq(r.next[0], "2026-01-02T09:30:00.000Z", "next 09:30 is tomorrow (already past today)");
t.eq(r.next[1], "2026-01-03T09:30:00.000Z", "…then the day after");

// --- Step: every 15 minutes ---
r = await cron("*/15 * * * *", { from: "2026-01-01T00:00:00Z", count: 4 });
t.eq(r.next.map((x) => x.slice(14, 16)).join(","), "15,30,45,00", "every 15 minutes");

// --- List + range ---
r = await cron("0 9,17 * * 1-5", { from: "2026-01-03T00:00:00Z", count: 2 }); // Jan 3 2026 is a Saturday
// Next weekday 9:00 is Mon Jan 5.
t.eq(r.next[0], "2026-01-05T09:00:00.000Z", "weekday 9am skips the weekend");
t.eq(r.next[1], "2026-01-05T17:00:00.000Z", "…then 5pm the same weekday");

// --- Specific month/day ---
r = await cron("0 0 25 12 *", { from: "2026-06-01T00:00:00Z", count: 2 });
t.eq(r.next[0], "2026-12-25T00:00:00.000Z", "Dec 25 midnight");
t.eq(r.next[1], "2027-12-25T00:00:00.000Z", "…next year");

// --- DOM/DOW OR semantics: both restricted → either matches ---
r = await cron("0 0 13 * 5", { from: "2026-02-01T00:00:00Z", count: 3 }); // the 13th OR any Friday
// Feb 2026: Fridays are 6,13,20,27; the 13th is itself a Friday. So first three: Feb 6, Feb 13, Feb 20.
t.eq(r.next[0].slice(0, 10), "2026-02-06", "first is a Friday (Feb 6)");
t.eq(r.next[1].slice(0, 10), "2026-02-13", "…then Feb 13 (both the 13th and a Friday)");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/cron-preview`, { expression: "* * * *" })).status, 400, "wrong field count → 400");
t.eq((await c.post(`/api/db/${slug}/cron-preview`, { expression: "99 * * * *" })).status, 400, "out-of-range minute → 400");
t.eq((await c.post(`/api/db/${slug}/cron-preview`, {})).status, 400, "no expression → 400");

t.done(); h.restore();
