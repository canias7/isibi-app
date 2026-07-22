// Batch 179 — DAILY CHECK-IN STREAKS. Once-per-UTC-day atomic check-in, current streak (the run
// ending today OR yesterday), longest run ever, gap handling, per-member isolation, and validation.
// Dates are computed relative to real "today" (UTC) so current_streak is deterministic.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 179");
const slug = "b179";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 (streaks have no admin surface)
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token;
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token;
const iso = (off) => new Date(Date.now() - off * 86400000).toISOString().slice(0, 10);
const today = iso(0), yest = iso(1), d2 = iso(2), d3 = iso(3), far = iso(30), tomorrow = iso(-1);
const checkin = (tok, day) => c.post(`/api/db/${slug}/streak/checkin`, day === undefined ? {} : { day }, tok === null ? {} : { token: tok });
const streak = (tok) => c.get(`/api/db/${slug}/streak`, { token: tok }).then((r) => r.json);

// --- Empty ---
t.eq(await streak(B).then((s) => [s.current_streak, s.longest_streak, s.total, s.last_day, s.days.length]), [0, 0, 0, null, 0], "no check-ins → all zero");

// --- Check in today, then a same-day no-op ---
let r = (await checkin(B)).json;
t.eq([r.checked_in, r.current_streak, r.total], [true, 1, 1], "first check-in today → streak 1");
r = (await checkin(B, today)).json;
t.eq([r.checked_in, r.current_streak, r.total], [false, 1, 1], "same-day again → checked_in:false, no duplicate");

// --- Backfill yesterday → consecutive run of 2 ---
r = (await checkin(B, yest)).json;
t.eq([r.current_streak, r.longest_streak, r.total], [2, 2, 2], "today + yesterday → current & longest 2");

// --- A gap breaks the current streak (d3 with d2 missing) ---
r = (await checkin(B, d3)).json;
t.eq([r.current_streak, r.longest_streak, r.total], [2, 2, 3], "d3 (gap at d2) → current stays 2, total 3");

// --- Fill the gap → one run of 4 ---
r = (await checkin(B, d2)).json;
t.eq([r.current_streak, r.longest_streak, r.total], [4, 4, 4], "filling d2 links d3..today → current & longest 4");
let s = await streak(B);
t.eq([s.last_day, s.days.slice(0, 4)], [today, [today, yest, d2, d3]], "GET: last_day today, recent days newest-first");

// --- An old isolated day keeps longest, doesn't touch current ---
r = (await checkin(B, far)).json;
t.eq([r.current_streak, r.longest_streak, r.total], [4, 4, 5], "an isolated 30-day-old check-in: current 4, longest 4, total 5");

// --- Grace window: a streak ending YESTERDAY still counts as current ---
t.eq((await checkin(C, yest)).json.current_streak, 1, "only-yesterday → current 1 (yesterday grace)");
// --- …but ending TWO days ago does not ---
t.eq((await checkin(D, d2)).json.current_streak, 0, "only-two-days-ago → current 0 (broken)");

// --- Per-member isolation ---
t.eq((await streak(B)).current_streak, 4, "B's streak is unaffected by C and D");

// --- Validation ---
t.eq((await checkin(B, "2026-02-30")).status, 400, "impossible calendar date → 400");
t.eq((await checkin(B, "not-a-date")).status, 400, "malformed date → 400");
t.eq((await checkin(B, "")).status, 400, "empty day string → 400 (not silently today)");
t.eq((await checkin(B, tomorrow)).status, 400, "future day → 400");

// --- Guards ---
t.eq((await checkin(null)).status, 401, "signed-out check-in → 401");
t.eq((await c.get(`/api/db/${slug}/streak`)).status, 401, "signed-out GET → 401");

t.done(); h.restore();
