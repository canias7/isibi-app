// Batch 237 — RECURRING EVENTS (RRULE-lite). A stateless expander: given a start + a simple recurrence rule
// + a window, return the occurrence dates. Covers daily/weekly/monthly, interval, count, until, byweekday,
// from/to windowing, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 237");
const slug = "b237";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const expand = (body) => c.post(`/api/db/${slug}/recurring/expand`, body).then((r) => r.json);
const day = (iso) => iso.slice(0, 10);

// --- Daily with count ---
let r = await expand({ start: "2026-03-01T09:00:00Z", freq: "daily", count: 3 });
t.eq(r.occurrences.length, 3, "daily count=3 → 3 occurrences");
t.eq(day(r.occurrences[0]), "2026-03-01", "…first is the start");
t.eq(day(r.occurrences[1]), "2026-03-02", "…then the next day");
t.eq(day(r.occurrences[2]), "2026-03-03", "…and the day after");

// --- Daily with interval ---
r = await expand({ start: "2026-03-01", freq: "daily", interval: 2, count: 3 });
t.eq(day(r.occurrences[1]), "2026-03-03", "interval=2 skips a day");
t.eq(day(r.occurrences[2]), "2026-03-05", "…every 2 days");

// --- Weekly ---
r = await expand({ start: "2026-03-02", freq: "weekly", count: 3 }); // 2026-03-02 is a Monday
t.eq(day(r.occurrences[1]), "2026-03-09", "weekly → +7 days");
t.eq(day(r.occurrences[2]), "2026-03-16", "…and +14");

// --- Monthly ---
r = await expand({ start: "2026-01-15", freq: "monthly", count: 3 });
t.eq(day(r.occurrences[0]), "2026-01-15", "monthly first");
t.eq(day(r.occurrences[1]), "2026-02-15", "…next month same day");
t.eq(day(r.occurrences[2]), "2026-03-15", "…and the month after");

// --- until bound ---
r = await expand({ start: "2026-03-01", freq: "daily", until: "2026-03-04" });
t.eq(r.occurrences.length, 4, "until stops the series (Mar 1–4 inclusive)");
t.eq(day(r.occurrences[r.occurrences.length - 1]), "2026-03-04", "…last is the until date");

// --- byweekday (weekly): Mon+Wed+Fri ---
r = await expand({ start: "2026-03-02", freq: "weekly", byweekday: [1, 3, 5], count: 6 }); // Mon=1 Wed=3 Fri=5
const days = r.occurrences.map(day);
t.ok(days.includes("2026-03-02") && days.includes("2026-03-04") && days.includes("2026-03-06"), "week 1 has Mon/Wed/Fri");
t.ok(days.includes("2026-03-09") && days.includes("2026-03-11") && days.includes("2026-03-13"), "week 2 too");
t.eq(r.occurrences.length, 6, "count caps at 6 across the weekdays");

// --- from/to windowing ---
r = await expand({ start: "2026-03-01", freq: "daily", limit: 60, from: "2026-03-10", to: "2026-03-12" });
t.eq(r.occurrences.length, 3, "from/to windows to Mar 10–12");
t.eq(day(r.occurrences[0]), "2026-03-10", "…first is the from date");

// --- limit caps output ---
r = await expand({ start: "2026-03-01", freq: "daily", limit: 5 });
t.eq(r.occurrences.length, 5, "limit caps the number of occurrences");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/recurring/expand`, { freq: "daily" })).status, 400, "missing start → 400");
t.eq((await c.post(`/api/db/${slug}/recurring/expand`, { start: "2026-03-01", freq: "yearly" })).status, 400, "an unsupported freq → 400");
t.eq((await c.post(`/api/db/${slug}/recurring/expand`, { start: "not-a-date", freq: "daily" })).status, 400, "a bad start → 400");

t.done(); h.restore();
