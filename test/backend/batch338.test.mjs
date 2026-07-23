// Batch 338 — RRULE EXPANSION. Stateless recurrence expander: start + freq/interval/count/until/byday → the
// next occurrence dates. Covers daily, interval, count cap, until bound, weekly, weekly byday, monthly, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 338");
const slug = "b338";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const rr = (body) => c.post(`/api/db/${slug}/rrule`, body).then((r) => r.json);
const day = (iso) => iso.slice(0, 10);

// --- Daily count 3 ---
let r = await rr({ start: "2026-01-01T09:00:00Z", freq: "daily", count: 3 });
t.eq(r.occurrences.length, 3, "daily count 3 → 3 occurrences");
t.eq(day(r.occurrences[0]), "2026-01-01", "…first is the start");
t.eq(day(r.occurrences[2]), "2026-01-03", "…third is +2 days");

// --- Interval 2 (every other day) ---
r = await rr({ start: "2026-01-01", freq: "daily", interval: 2, count: 3 });
t.eq(day(r.occurrences[1]), "2026-01-03", "interval 2 skips a day");

// --- until bound ---
r = await rr({ start: "2026-01-01", freq: "daily", count: 100, until: "2026-01-05" });
t.eq(r.occurrences.length, 5, "until caps the expansion (Jan 1–5)");

// --- Weekly ---
r = await rr({ start: "2026-01-01", freq: "weekly", count: 3 });
t.eq(day(r.occurrences[1]), "2026-01-08", "weekly steps 7 days");

// --- Weekly byday (Mon/Wed/Fri) ---
r = await rr({ start: "2026-01-05", freq: "weekly", byday: ["mo", "we", "fr"], count: 3 });
// 2026-01-05 is a Monday
t.eq(day(r.occurrences[0]), "2026-01-05", "byday: first Monday");
t.eq(day(r.occurrences[1]), "2026-01-07", "…then Wednesday");
t.eq(day(r.occurrences[2]), "2026-01-09", "…then Friday");

// --- Monthly ---
r = await rr({ start: "2026-01-15", freq: "monthly", count: 3 });
t.eq(day(r.occurrences[1]), "2026-02-15", "monthly steps one month");
t.eq(day(r.occurrences[2]), "2026-03-15", "…and again");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/rrule`, { start: "nope", freq: "daily" })).status, 400, "a bad start → 400");
t.eq((await c.post(`/api/db/${slug}/rrule`, { start: "2026-01-01", freq: "hourly" })).status, 400, "an unsupported freq → 400");

t.done(); h.restore();
