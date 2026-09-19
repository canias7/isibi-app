// Scheduled work for a published site.
//
// THE GAP THIS FILLS, AND WHY IT IS A CAPABILITY RATHER THAN A FEATURE. The
// model can already express "who needs reminding tomorrow" — it is a SELECT.
// What it cannot do is arrange for that query to run tomorrow at nine, or put
// the result on a wire. Every other missing integration (SMS reminders, a
// nightly digest, chasing unpaid invoices, flagging bookings nobody confirmed)
// is that same pair, and building them one at a time is how you end up with the
// eight-verb runner again.
//
// So the split is the one payments and confirmations already use:
//
//   MODEL     a schedule, and an internal SQL function returning the messages.
//             Which rows, on what condition, worded how, joined to whatever —
//             all of it per site, written at build time.
//   PLATFORM  the clock and the wire. Only that, and only because the model has
//             neither: nothing in a database or a static page can run itself on
//             a timer, and Postgres has no HTTP client.
//
// It is deliberately NOT the deleted `runSiteFunction`, whose spec was a
// sequence of eight named steps. A job names ONE function and sends what it
// returns. There is nothing here to extend when somebody wants a different kind
// of scheduled work — they write different SQL.

// The floor is 15 minutes. Anything finer is a promise the 2-minute cron cannot
// keep across many sites, and a site asking for "every minute" would quietly get
// something else.
export const MIN_EVERY_MINUTES = 15;
export const MAX_EVERY_MINUTES = 60 * 24 * 31;
// Per tick, per site. A job that suddenly matches ten thousand rows is a bill on
// the owner's provider and a stall for every other site's job; it is capped, and
// `shapeMessages` reports the overflow rather than dropping it silently.
export const MAX_MESSAGES_PER_RUN = 100;
// Sites drained per tick. Bounds one slow site's effect on the rest, the same
// reason `neon_teardown` batches at 5.
export const MAX_JOBS_PER_TICK = 25;

const MAX_SUBJECT = 200;
const MAX_BODY = 4000;

/**
 * Validate one declared job. Null for anything unresolvable — a job that half
 * exists is worse than none, because the owner is told their reminders are set
 * up and no reminder is ever sent.
 *
 * The `fn` cross-reference (does it exist, is it internal?) is NOT checked here.
 * Only `normalizeSchema` sees the function list, so it is resolved there, the
 * same way `confirm.fn` is.
 */
export function normalizeJob(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const name = String(raw.name || "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(name)) return null;
  const fn = String(raw.fn || raw.function || "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(fn) || fn.startsWith("_")) return null;

  const n = parseInt(raw.everyMinutes != null ? raw.everyMinutes : (raw.every != null ? raw.every : raw.minutes), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  // CLAMPED, not refused. A model asking for every 5 minutes wants "often", and
  // refusing the whole job over the number loses the reminder entirely — but it
  // must not be told it got what it asked for, so the stored value is the real
  // one and it is the real one that runs.
  const everyMinutes = Math.min(MAX_EVERY_MINUTES, Math.max(MIN_EVERY_MINUTES, n));
  const out = { name, fn, everyMinutes };
  // A CLOCK TIME (owner, 2026-09-03). "Every day at nine" was "every 1440
  // minutes from whenever it was added", so a reminder added at ten to
  // midnight went out at ten to midnight for ever. `at` is the time of day in
  // the site's own zone, and `tz` the zone — the owner's browser's, stamped by
  // the route that adds the job; absent reads as UTC. Only a daily-or-slower
  // job has a time of day: on a faster one the field means nothing and is
  // left off rather than clamping the interval to a day behind the model's
  // back (the addon's own cleaner refuses that combination by name first).
  const at = typeof raw.at === "string" && AT_RE.test(raw.at.trim()) ? raw.at.trim() : null;
  // ── A JOB THAT RUNS ONCE (2026-09-19) ────────────────────────────────────
  //
  // `on` is a single calendar date in the site's own zone and its PRESENCE is
  // the one-time marker — nothing else carries it, so there is one place to
  // ask and no second flag to disagree with.
  //
  // THE ORDER IS LOAD-BEARING AND IS WHY THE FORCING SITS ABOVE THE `at`
  // GATE. `at` is kept only for a daily-or-slower job, so a model that writes
  // `{on, at, everyMinutes: 60}` — an entirely reasonable thing for it to
  // write, since it is thinking about a date and not about an interval —
  // would lose `at` at the gate below and then be refused for having a date
  // with no time. The interval is meaningless for a one-time job and is
  // forced first.
  //
  // FORCED TO `MAX_EVERY_MINUTES`, AND THAT IS THE FAIL-SAFE RATHER THAN A
  // TIDY DEFAULT. The interval is never read for selection (the `on` branch
  // in `dueJobs` is asked first and returns), so the value only matters if
  // `spec.on` is ever LOST — a hand-edited row, a spec rewritten by a version
  // that does not know about `on`. At the monthly ceiling such a job degrades
  // to *at most monthly*; at the model's 60 it would degrade to hourly, which
  // is the runaway this field exists to prevent, arriving through the back
  // door. A wrong number here is a reminder nobody asked for, for ever.
  //
  // ⚠ AND AN `on` THAT IS PRESENT AND UNREADABLE REFUSES THE JOB WHOLE — it
  // does NOT fall back to the interval. This is the one place this module
  // departs from its own tolerant habit, and the departure is the owner's
  // sentence: *"a request to run once must never silently become a recurring
  // job."* Everywhere else the engine drops what it cannot read and the site
  // goes on working (a connection loses its response sketch and still
  // answers); here, dropping `on` leaves a `{name, fn, everyMinutes}` that is
  // a perfectly valid RECURRING job — so the tolerant reading turns "remind me
  // on the 3rd" into a reminder every month for ever, which is not the feature
  // degrading, it is the feature inverted.
  //
  // MEASURED before this line existed: `{on: "2026-13-45", at: "09:00",
  // everyMinutes: 1440}` came back as a clean daily job with no `on`.
  //
  // What it costs: a stored spec carrying a junk `on` loses its job on the
  // next publish rather than quietly recurring. That is the recoverable
  // direction — the owner sees the job is gone and asks again, where nobody
  // ever notices the other one.
  const onRaw = raw.on == null ? null : String(raw.on).trim();
  const on = onRaw && ON_RE.test(onRaw) && calendarDay(onRaw) ? onRaw : null;
  if (onRaw && !on) return null;
  if (on) out.everyMinutes = MAX_EVERY_MINUTES;
  if (at && out.everyMinutes >= 1440) {
    out.at = at;
    const tz = validTimeZone(raw.tz);
    if (tz) out.tz = tz;
  }
  // REFUSED WHOLE, never downgraded to a recurring job. This is the owner's
  // own sentence — *"a request to run once must never silently become a
  // recurring job"* — and dropping `on` while keeping the rest is exactly
  // that: the owner is told their one-time reminder is set up, and it goes
  // out every month for ever. A job that half exists is worse than none.
  if (on && !out.at) return null;
  if (on) out.on = on;
  return out;
}

/** A clock time as a job states it: "HH:MM", 24-hour. */
export const AT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A single calendar date as a job states it: "YYYY-MM-DD". */
export const ON_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * How late a missed one-time job may still go out.
 *
 * A tick missed by minutes must still send — that is the whole reason
 * `!last_run && due <= now` exists on the recurring path — and a reminder for
 * last Tuesday must NOT go out today because an outage ended. Past the grace
 * the job is never selected again, and the readback reports it as `missed`
 * rather than as "never run", because those are different facts and only one
 * of them is something the owner can act on.
 */
export const MISSED_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Is this a real calendar day? `ON_RE` admits `2026-13-45`, so the shape is
 * not the answer.
 *
 * Plain arithmetic, no `Date`: `Date.UTC(1, 0, 1)` silently means 1901, so a
 * round-trip through it reports a well-formed early year as invalid. The same
 * reader the counts mode uses, for the same reason.
 */
function calendarDay(s) {
  const m = ON_RE.exec(String(s || ""));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const len = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= len ? { y, mo, d } : null;
}

/**
 * The instant a one-time job runs: the wall time `on` + `at` in `tz`, or null
 * when any of the three cannot be read.
 *
 * REUSES `occurrenceOn` BY IDENTITY rather than repeating its arithmetic, so
 * the two daylight-saving policies are the recurring path's own and cannot
 * drift from them: a REPEATED local time takes the FIRST reading (one local
 * day stays one run) and a NONEXISTENT one takes the LATER candidate (the job
 * is not skipped; for one day it runs an hour later by the clock). Two rules
 * for one arithmetic is how they come apart, and this repository has paid for
 * that once already on this exact function.
 *
 * NULL FOR AN UNREADABLE DATE, TIME OR ZONE, and `dueJobs` reads that as never
 * due. Fail closed: a reminder that does not go out is a complaint somebody
 * can make, and one that goes out at the wrong time on the wrong day is a
 * message already sitting in somebody's customers' inboxes.
 */
export function onceAt(on, at, tz) {
  const day = calendarDay(on);
  const m = AT_RE.exec(String(at || "").trim());
  if (!day || !m) return null;
  const zone = validTimeZone(tz) || "UTC";
  const x = occurrenceOn(zone, day.y, day.mo, day.d, Number(m[1]), Number(m[2]));
  // ⚠ `Number.isFinite` IS A DECLARED BELT, MEASURED INERT rather than reasoned
  // about: once `calendarDay` and `AT_RE` have passed and the zone is
  // `validTimeZone(tz) || "UTC"`, `occurrenceOn` answers either a finite
  // instant or `null`, and `null` is what this line would return anyway.
  // **432 probes — nine zones including junk ones, eight dates including both
  // daylight transitions and the year bounds, six times — ZERO cases where the
  // check changed an answer.**
  //
  // It stays because the deadness is a property of a NEIGHBOUR (what
  // `occurrenceOn` promises to return) and not of this expression, and because
  // the answer here is read by a scheduler: a `NaN` reaching `dueJobs` would
  // make `t < when` and `(t - when) <= GRACE` both false, so the job would
  // never fire and nothing anywhere would say why. The sweep mutates the
  // observable half of this line instead.
  return Number.isFinite(x) ? x : null;
}

/**
 * What became of a one-time job, for the owner's panel: `scheduled` · `done` ·
 * `missed` · `unreadable`, and **null for a recurring job**, which has no such
 * thing.
 *
 * DERIVED FROM THE ROW, never stored. A `state` column would be a second value
 * that can disagree with `last_run`, and the whole job of this line is to be
 * the truth about `last_run`.
 *
 * `missed` EXISTS BECAUSE "never run" IS THREE FACTS. A job ahead of its time,
 * a job whose moment went by unserved, and a job whose date nobody can read
 * all have an empty `last_run` — and only two of them are something the owner
 * can act on, in opposite ways. Collapsing them is how a reminder that never
 * went out reads as a reminder that has not gone out YET, for ever.
 *
 * `unreadable` is its own answer rather than folded into `missed`: a date the
 * scheduler cannot parse will never fire whatever the clock does, so the fix
 * is to say it again, not to wait.
 */
export function onceState(row, now = Date.now()) {
  const spec = row && typeof row.spec === "object" && row.spec ? row.spec : null;
  const on = spec && typeof spec.on === "string" ? spec.on : null;
  if (!on) return null;
  if (row.last_run) return "done";
  const when = onceAt(on, spec.at, spec.tz);
  if (when == null) return "unreadable";
  const t = Number(now);
  if (!Number.isFinite(t)) return "scheduled";
  if (t < when) return "scheduled";
  return (t - when) <= MISSED_GRACE_MS ? "scheduled" : "missed";
}

/** One day, for the clock-time arithmetic below. */
const DAY_MS = 86400000;

/**
 * An IANA zone name the runtime knows, or null. Asked of Intl itself rather
 * than a list: the list is the platform's, and a name it does not know throws
 * at format time, which is the one place this must never throw.
 */
export function validTimeZone(tz) {
  if (typeof tz !== "string" || tz.length > 64 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+){0,3}$/.test(tz)) return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return null; }
}

/**
 * What the wall clock in `zone` reads at the instant `t`, as plain numbers, or
 * null when the runtime will not say. `hour` is normalised: some runtimes spell
 * midnight 24 under `h23`, and 24 as a number is tomorrow.
 */
function wallParts(zone, t) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = {};
  for (const part of f.formatToParts(new Date(t))) if (part.type !== "literal") p[part.type] = Number(part.value);
  if (!Number.isFinite(p.year) || !Number.isFinite(p.month) || !Number.isFinite(p.day) || !Number.isFinite(p.hour) || !Number.isFinite(p.minute)) return null;
  if (p.hour === 24) p.hour = 0;
  return p;
}

/**
 * The zone's offset AT THE INSTANT `t` — milliseconds to add to UTC to get the
 * wall clock — read as "the wall clock taken as if it were UTC, minus the real
 * instant". Minute precision, which is every offset the tz database holds.
 *
 * THE FLOOR IS A DECLARED BELT, measured inert rather than reasoned about: every
 * caller passes an instant `Date.UTC` built at minute precision, so flooring it
 * changes nothing today and a sweep mutant on that line would survive. It stays
 * because the contract above is "the offset at an instant", and a sub-minute
 * error inside a scheduler is the kind nobody ever sees. Said here because a
 * sweep cannot say it, and the next session deletes what nothing appears to need.
 */
function zoneOffsetAt(zone, t) {
  const p = wallParts(zone, t);
  if (!p) return null;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(t / 60000) * 60000;
}

/**
 * The instant on the LOCAL DATE `y-mo-d` at which the clock in `zone` reads
 * `hh:mi` — this job's occurrence for that day, exactly one per local day.
 *
 * The offsets in force a day either side of the target are the only two that
 * can apply to it, so `wall - before` and `wall - after` are the only two
 * candidate instants. Each is VERIFIED by formatting it back: only the read-back
 * can tell a real reading from one the clock skips over.
 *
 * THE TWO POLICIES, STATED, because the clock changes twice a year and both
 * cases have to mean something:
 *
 *  • A REPEATED local time (autumn, the hour that runs twice) verifies TWICE,
 *    and the occurrence is the FIRST — the job runs the first time the clock
 *    reads its time, and `anchor >= due` in `dueJobs` then refuses the second,
 *    so one local day is still one run. Taking the later one would leave the
 *    earlier reading unserved for an hour and is a coin toss between two equally
 *    true answers; the earlier one is never late.
 *
 *  • A NONEXISTENT local time (spring, the hour that never happens) verifies
 *    NEITHER, and the occurrence is the LATER candidate — the instant the time
 *    would have had under the offset in force before the change, which for a
 *    daily job is exactly 24 hours after yesterday's run, one hour later by the
 *    clock for that one day. The job is NOT skipped: a reminder that silently
 *    does not go out once a year is the failure nobody notices, and running
 *    after the time that was asked for is the safe side of running before it.
 */
function occurrenceOn(zone, y, mo, d, hh, mi) {
  const wall = Date.UTC(y, mo - 1, d, hh, mi);
  const before = zoneOffsetAt(zone, wall - DAY_MS);
  const after = zoneOffsetAt(zone, wall + DAY_MS);
  if (before == null || after == null) return null;
  const cand = before === after ? [wall - before] : [wall - before, wall - after];
  const real = cand.filter((x) => {
    const p = wallParts(zone, x);
    return !!p && p.year === y && p.month === mo && p.day === d && p.hour === hh && p.minute === mi;
  });
  return real.length ? Math.min(...real) : Math.max(...cand);
}

/**
 * The most recent instant at which the clock time `at` occurred in `tz`, at
 * or before `now`: today's, or yesterday's while today's is still ahead.
 *
 * Computed from Intl's own view of the zone, so summer time is the zone's
 * business and not ours — AND THE OFFSET IS READ AT THE TARGET MINUTE, not at
 * `now`. (Owner, 2026-09-16, reproduced.) Reading it at `now` moved the
 * occurrence whenever the clocks changed: a daily 00:30 Europe/London job that
 * had served 25 October's 00:30 was selected AGAIN from 01:00Z that morning —
 * the moment London went back — because the offset read 0 there and put
 * "today's 00:30" an hour later than the one already served, for the rest of
 * that day. The doc comment here used to concede the approximation and rest on
 * "the interval rule that runs beside this in `dueJobs` means never twice",
 * which was true until that rule came off for daily jobs: A RULE TRUE BECAUSE OF
 * A LAYER BELOW IT EXPIRES WHEN THAT LAYER MOVES, and the layer moved because we
 * moved it.
 *
 * TWO local days are asked — today's and yesterday's — and that is a complete
 * answer rather than a sample: an occurrence carries the local date it belongs
 * to, `now`'s local date is today, so yesterday's occurrence is always behind
 * `now` and the search can never need the day before it. The LATEST answer at or
 * before `now` wins rather than the first one found, so nothing rests on the two
 * coming out in calendar order across a transition. Null for an unreadable `at`.
 */
export function lastDueAt(at, tz, now) {
  const m = AT_RE.exec(String(at || "").trim());
  const t = Number(now);
  if (!m || !Number.isFinite(t)) return null;
  const zone = validTimeZone(tz) || "UTC";
  const here = wallParts(zone, t);
  if (!here) return null;
  const hh = Number(m[1]);
  const mi = Number(m[2]);
  const midnight = Date.UTC(here.year, here.month - 1, here.day);
  let best = null;
  for (let back = 0; back <= 1; back++) {
    const day = new Date(midnight - back * DAY_MS);
    const x = occurrenceOn(zone, day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh, mi);
    if (x != null && x <= t && (best == null || x > best)) best = x;
  }
  return best;
}

/**
 * Which of these rows are due.
 *
 * `now` is passed in rather than read, so the boundary is testable — a schedule
 * whose off-by-one only shows up at a real clock edge is exactly the bug that
 * never gets caught.
 *
 * The 30-second grace mirrors the existing cron: a 15-minute job driven by a
 * 2-minute tick would otherwise skip a slot whenever the ticks land badly, and
 * an hourly digest that silently becomes two-hourly is very hard to notice.
 */
export function dueJobs(rows, now) {
  const t = Number(now);
  // How long this job has been waiting, for the ordering below. A job that has
  // never run, or whose stamp cannot be read, has waited longest — the same
  // rows the dueness filter treats as "run, do not strand".
  const waited = (r) => {
    if (!r || !r.last_run) return Infinity;
    const last = Date.parse(r.last_run);
    if (!Number.isFinite(last)) return Infinity;
    return t - last;
  };
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    if (!r || r.enabled === false) return false;
    // ── A JOB THAT RUNS ONCE, ASKED FIRST (2026-09-19) ─────────────────────
    //
    // Asked above the interval test because for a one-time job the interval
    // is not a weaker rule, it is the WRONG rule: `everyMinutes` is a forced
    // ceiling with no meaning, and letting it decide would make the job fire
    // again a month later. This branch answers completely and returns.
    //
    // `last_run` IS THE CONSUMPTION MARKER, and it is the only one available.
    // `persistSiteJobs` rewrites `spec` on every publish, so a `done` flag
    // written there by the runner would be destroyed by the next unrelated
    // change to the site — and the job would run a second time, weeks later,
    // because somebody changed a colour.
    const once = r.spec && typeof r.spec === "object" && typeof r.spec.on === "string" ? r.spec.on : null;
    if (once) {
      if (r.last_run) return false;                 // consumed, for ever
      const when = onceAt(once, r.spec.at, r.spec.tz);
      if (when == null) return false;               // cannot tell WHEN → never
      if (t < when) return false;                   // not yet
      // …AND NOT SO LATE IT IS STALE. Past the grace the occurrence is gone:
      // a reminder about a thing that already happened is worse than silence,
      // and the owner is told rather than left to wonder (the readback calls
      // this state `missed`).
      return (t - when) <= MISSED_GRACE_MS;
    }
    const mins = parseInt(r.schedule_minutes, 10);
    if (!(mins > 0)) return false;
    // A CLOCK-TIME JOB (owner, 2026-09-03) is due once the latest occurrence
    // of its time is behind us AND after its last run — or after it was
    // REGISTERED, for a job that has never run, so a daily 09:00 added at
    // three in the afternoon waits for the morning instead of firing on the
    // next tick. The interval still applies on top, so a weekly 09:00 waits
    // the week. An unreadable time falls through to the plain interval.
    const at = r.spec && typeof r.spec === "object" ? r.spec.at : null;
    const due = at ? lastDueAt(at, r.spec.tz, t) : null;
    if (due != null) {
      const anchor = r.last_run ? Date.parse(r.last_run) : Date.parse(r.updated_at || "");
      if (!Number.isFinite(anchor)) return true;     // no stamp and no registration time: run, do not strand
      if (anchor >= due) return false;               // already ran this occurrence, or added after it
      if (!r.last_run) return true;                  // never run, and its time has come since it was added
      // ── A MANUAL RUN MUST NOT MOVE THE NIGHTLY OCCURRENCE ─────────────────
      //
      // (owner, 2026-09-16, reproduced.) A daily 23:00 Europe/London job with
      // `last_run` 19:29:36Z — the timestamp "Run now" left — was NOT selected
      // at 22:00Z or 22:02Z that evening, and WAS selected at 19:30Z the next
      // day: the elapsed-interval test below measures 24 hours from whenever
      // the job last ran, so one press slides the whole schedule to the time of
      // the press. The customer asked for eleven at night and would have got
      // half past seven in the evening, for ever, drifting again on every press.
      //
      // FOR A DAILY-OR-FASTER CLOCK-TIME JOB THE OCCURRENCE GATE IS THE WHOLE
      // RULE, and it already carries the duplicate protection: `anchor >= due`
      // three lines up refuses a job that has run since the latest occurrence,
      // whatever ran it. There is exactly one occurrence per day at `mins <=
      // 1440`, so "has this occurrence been served" is a complete question and
      // elapsed time adds nothing but the drift.
      //
      // SLOWER THAN DAILY KEEPS THE ELAPSED TEST, UNCHANGED AND DELIBERATELY.
      // A weekly 09:00 needs to skip six occurrences, and the interval is what
      // does that. Measuring it to the OCCURRENCE instead of to `now` was tried
      // and is WORSE: a run that landed late (09:05 on a busy tick) then fails
      // its own next occurrence by five minutes and slips a whole day, where
      // measuring to `now` slips it by minutes within the same day.
      //
      // WHAT THIS DOES NOT FIX, STATED: a manual run still perturbs a job
      // slower than daily, exactly as it does today — it becomes the anchor and
      // the next occurrence can fall short of the interval. Fixing that needs
      // the last SCHEDULED occurrence stored apart from `last_run`, which is a
      // migration; this change leaves that case byte for byte as it was.
      if (mins <= 1440) return true;
      return (t - anchor) >= (mins * 60000 - 30000);
    }
    if (!r.last_run) return true;                    // never run — due immediately
    const last = Date.parse(r.last_run);
    if (!Number.isFinite(last)) return true;         // unreadable stamp: run, do not strand
    // A last_run in the FUTURE (a clock skew, a hand-edited row) would otherwise
    // park the job until real time caught up, which for a monthly job is weeks.
    if (last > t) return true;
    return (t - last) >= (mins * 60000 - 30000);
  })
    // STALEST FIRST, AND THE CAP IS WHY THIS MATTERS. The filter can return more
    // than `MAX_JOBS_PER_TICK` and the slice below takes a fixed number — so in
    // READ ORDER the same first 25 win every tick and everything behind them
    // starves permanently, however long it has been waiting. Nothing announces
    // that: each tick reports a healthy run, and the jobs nobody sees simply
    // never fire.
    //
    // Sorting by how long each has waited makes the rotation fall out on its
    // own: a job that runs has its stamp refreshed and goes to the back, so over
    // a few ticks everything due gets a turn. It also puts a never-run job — a
    // site that has just been built — at the front, which is where it belongs.
    //
    // Held HERE rather than left to the caller's query string, because this is
    // the module that decides which jobs run and a property the caller happens
    // to supply is one a later edit drops silently.
    .sort((a, b) => waited(b) - waited(a))
    .slice(0, MAX_JOBS_PER_TICK);
}

/**
 * Validate what the model's function returned.
 *
 * Computed is not trusted. These messages are model-written SQL output that
 * nobody reads before it becomes mail on the owner's account, so each one is
 * checked exactly as a form field would be — and the address goes through the
 * SAME `recipient` the write path uses, because "a@b.com, evil@x.com" is header
 * injection whoever produced it.
 */
export function shapeMessages(out, recipientFn, phoneFn) {
  const raw = typeof out === "string" ? safeJson(out) : out;
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.messages) ? raw.messages : null);
  if (!list) return { messages: [], dropped: 0, overflow: 0, bad: raw == null ? "nothing" : "not a list" };

  const messages = [];
  let dropped = 0;
  for (const m of list.slice(0, MAX_MESSAGES_PER_RUN)) {
    // WHICH CHANNEL, DECLARED RATHER THAN INFERRED. The tempting shortcut is
    // "no subject means text it" — and that turns a function that forgot a
    // subject into a text message to somebody's phone, at the owner's expense,
    // instead of a dropped message they can see in the panel. An unrecognised
    // channel is email, because email is the one that costs nothing per send.
    const channel = String((m && m.channel) || "email").toLowerCase() === "sms" ? "sms" : "email";
    const body = String((m && m.body) == null ? "" : m.body).slice(0, MAX_BODY);

    if (channel === "sms") {
      // THE NUMBER GOES THROUGH THE SAME PARSER THE WRITE PATH USES. A job's
      // recipients come out of model-written SQL, so "07700 900000" and
      // "+44 7700 900000" both turn up — and only one of them can be sent to.
      // Without `phoneFn` the caller has not wired SMS at all, and a message
      // asking for it is dropped rather than quietly emailed to a phone number.
      const to = phoneFn && m && typeof m === "object" ? phoneFn(m.to) : null;
      if (!to || !body.trim()) { dropped++; continue; }
      // No subject: a text has none, and carrying one would put it on the wire
      // as part of the body on some providers.
      messages.push({ channel, to, body });
      continue;
    }

    const to = m && typeof m === "object" ? recipientFn(m, "to") : null;
    const subject = String((m && m.subject) == null ? "" : m.subject).slice(0, MAX_SUBJECT);
    if (!to || !subject || !body) { dropped++; continue; }
    messages.push({ channel, to, subject, html: body });
  }
  // Overflow is REPORTED, never silent. A job quietly capped at 100 looks like a
  // job that worked, and the hundred-and-first customer is the one who turns up
  // without a reminder.
  return { messages, dropped, overflow: Math.max(0, list.length - MAX_MESSAGES_PER_RUN), bad: null };
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

/**
 * A job that DOES something rather than sending something (owner, 2026-09-03:
 * the backend services round — "row expiry via a scheduled job").
 *
 * Until now a job's function could only answer with messages: a reminder, a
 * digest. Housekeeping — clearing rows older than thirty days, closing expired
 * holds, dropping stale carts — had nowhere to report, and a function that did
 * its DELETE and returned `{}` read as "returned not a list" in the owner's
 * panel: broken SQL, said of SQL that had just worked.
 *
 * The shape is explicit and small: `{"did": "cleared 12 expired holds"}`. A
 * STRING, written by the function, because only the function knows what its
 * count means — a bare number would have to be read as "rows", and "12 rows"
 * said of a job that archived twelve and deleted none is a guess dressed as a
 * report. Anything else — a list, an object without `did`, null — is not work
 * done and falls through to the message reading exactly as before.
 */
export function workDone(out) {
  const raw = typeof out === "string" ? safeJson(out) : out;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const did = raw.did;
  return typeof did === "string" && did.trim() ? did.trim().slice(0, 160) : null;
}

/**
 * ONE PLAIN SENTENCE FOR WHAT A RUN ACTUALLY DID.
 *
 * WHY THIS EXISTS. `runJob` already computes an honest, four-way outcome — and
 * every caller threw it into a `console.log` the site owner cannot read. So from
 * the owner's side a reminder that never arrives is indistinguishable from a
 * reminder that was never due, and the only symptom is a customer who does not
 * turn up, months later, looking like ordinary business. That is the worst
 * failure shape a scheduled job can have, and it is this repo's most-recorded
 * one: a feature that works and cannot be seen working.
 *
 * THE FOUR OUTCOMES MUST NOT READ ALIKE. That is the whole requirement:
 *
 *   nothing was due          — the ordinary run, and NOT news
 *   the function is broken   — returned null, or a shape that is not a list
 *   rows came back, no key   — the owner has not pasted a mail key yet
 *   it sent, or it threw     — the two that need a number and a reason
 *
 * NO RECIPIENT EVER APPEARS HERE. This is a platform table beside every other
 * site's, and the messages are a customer's own name and address; counts and
 * reasons carry everything the owner needs and nothing they should not have in
 * two places. Same discipline as the audit log's allow-list.
 */
export function jobOutcome(out) {
  if (!out || typeof out !== "object") return "Didn\u2019t run.";
  if (out.ok === false) {
    if (out.reason === "threw") return "Failed \u2014 " + String(out.error || "no reason given").slice(0, 160);
    return "Couldn\u2019t run \u2014 " + String(out.reason || "no reason given").slice(0, 160);
  }
  // An overlapping tick losing the claim is the SYSTEM WORKING, not news — but
  // if it is ever shown it must not read like a failure or like a quiet
  // Tuesday. The runner skips the last_result write for this outcome entirely.
  if (out.skipped) return "Skipped \u2014 another run had already picked this up.";
  // WORK DONE, in the function's own words. Read before the message counts,
  // because a housekeeping run sends nothing and "Nothing to send this time"
  // would be true and useless.
  if (typeof out.did === "string" && out.did) {
    const did = out.did.slice(0, 160);
    return "Done \u2014 " + did + (/[.!?]$/.test(did) ? "" : ".");
  }
  const sent = Number(out.sent) || 0;
  const bits = [];
  if (sent) bits.push("Sent " + sent + (sent === 1 ? " message." : " messages."));
  // A FUNCTION THAT RETURNED NULL IS NOT "NOTHING TO DO", and collapsing the two
  // is exactly the confusion this function exists to end: one is a quiet Tuesday
  // and the other is model-written SQL that is broken on every run.
  else if (out.reason && /^returned /.test(String(out.reason))) {
    bits.push("The function didn\u2019t return a list of messages \u2014 nothing could be sent.");
  } else if (out.reason) bits.push("Ready to send, but " + String(out.reason).slice(0, 120) + ".");
  else bits.push("Nothing to send this time.");

  if (out.failed) bits.push(out.failed + (out.failed === 1 ? " message failed to send." : " messages failed to send."));
  // NOT A FAILURE, AND NOT SILENCE EITHER. These are texts on a site with no
  // SMS key pasted yet (or the reverse) — nothing broke, and the owner still
  // needs to know some of what the job produced is waiting on them.
  if (out.unsent) {
    bits.push(out.unsent + (out.unsent === 1 ? " message is" : " messages are")
      + " waiting on a provider key in Secrets.");
  }
  // Reported, never silent — a job quietly capped is a job that looks like it
  // worked, and the hundred-and-first customer is the one with no reminder.
  if (out.overflow) bits.push(out.overflow + " more were over the " + MAX_MESSAGES_PER_RUN + "-per-run cap and were not sent.");
  if (out.dropped) bits.push(out.dropped + (out.dropped === 1 ? " was missing an address, subject or body." : " were missing an address, subject or body."));
  return bits.join(" ");
}

/**
 * Run one site's due job. Injected deps, so every decision is testable with no
 * clock, no database and no network.
 *
 * NEVER THROWS. A job is background work; a failing one must not stop the tick
 * for every other site, so it reports a reason and the caller logs it.
 *
 * `stamp` runs FIRST, before any sending, and that ordering is the important
 * one: stamped afterwards, a job that dies mid-send is due again on the next
 * tick and mails everyone it already reached. Losing a run is recoverable —
 * sending a reminder four times is not.
 */
export async function runJob(deps, row) {
  const name = row && row.name;
  try {
    const spec = row && row.spec && typeof row.spec === "object" ? row.spec : null;
    const fn = spec && typeof spec.fn === "string" ? spec.fn : null;
    if (!fn || !/^[a-z][a-z0-9_]{0,40}$/.test(fn)) return { ok: false, name, reason: "no function" };

    // THE STAMP IS A CLAIM NOW, not a fire-and-forget write (2026-08-13 audit).
    // Cloudflare cron ticks OVERLAP when a tick outlasts its 2-minute interval
    // — 25 jobs of up to 100 sequential provider sends can take many minutes —
    // so two ticks could both read a job as due and both mail its whole batch:
    // the exact double-send the stamp-first ordering exists to prevent, open
    // through a different door. And the old write was never checked, so an
    // HTTP-level failure (Supabase read-only, where reads keep working) let
    // the send proceed unstamped and re-mail everyone every tick until writes
    // recovered. `{won:false}` means another tick claimed this run OR the
    // claim could not be recorded — either way nothing may be sent. Strictly
    // `=== false`: a dep that cannot say (older fakes) behaves as before.
    const claimed = await deps.stamp(row);
    if (claimed && claimed.won === false) return { ok: true, name, skipped: true };

    const raw = await deps.callFn(fn);
    // A NULL-SHAPED ANSWER WITH A NAMED CAUSE. `callFn` used to return bare
    // null for three different situations — database unreachable, job no
    // longer declared, unusable function name — and all three wore the
    // broken-SQL sentence, against this module's own four-outcomes bar. The
    // caller names the cause now; the sentence carries it.
    if (raw && typeof raw === "object" && typeof raw.jobsSkip === "string") {
      return { ok: true, name, sent: 0, reason: String(raw.jobsSkip).slice(0, 120) };
    }
    // A HOUSEKEEPING RUN reports what it did and sends nothing. Read after
    // `jobsSkip` (ours) and before the messages (the function's), so a
    // function cannot answer both — `did` beside a list is `did`.
    const did = workDone(raw);
    if (did) return { ok: true, name, sent: 0, did };
    const shaped = shapeMessages(raw, deps.recipient, deps.phone);
    if (shaped.bad) return { ok: true, name, sent: 0, reason: "returned " + shaped.bad };
    if (!shaped.messages.length) return { ok: true, name, sent: 0, dropped: shaped.dropped };

    // EACH CHANNEL'S KEY IS RESOLVED ONCE, AND ONLY IF THAT CHANNEL IS USED.
    // A hundred reminders must not be a hundred decryptions — and a job that
    // sends no texts must not read the SMS vault at all, or every email-only
    // site on the platform pays a decrypt per tick for a feature it never
    // declared.
    const wants = (c) => shaped.messages.some((m) => m.channel === c);
    const creds = wants("email") ? await deps.credentials() : null;
    const smsCreds = wants("sms") && deps.smsCredentials ? await deps.smsCredentials() : null;

    // NAMED PER CHANNEL, because "no provider key in Secrets" said of a job that
    // sends both is a sentence the owner cannot act on: they have pasted one key
    // and are missing the other, and the panel would tell them to paste the one
    // they already have.
    if (wants("email") && !creds && !wants("sms")) return { ok: true, name, sent: 0, reason: "no email provider key in Secrets" };
    if (wants("sms") && !smsCreds && !wants("email")) return { ok: true, name, sent: 0, reason: "no SMS provider key in Secrets" };
    if (!creds && !smsCreds) return { ok: true, name, sent: 0, reason: "no provider key in Secrets" };

    // `unsent`, NOT `skipped`. `skipped: true` already means "another tick had
    // claimed this run" — a BOOLEAN — and `jobOutcome` branches on it before it
    // reads anything else. A COUNT in the same field is truthy, so a run that
    // sent an email and could not send a text reported "Skipped — another run
    // had already picked this up", which is a flat lie about a run that did
    // work; and `runScheduledSiteJobs` skips the `last_result` write on that
    // same flag, so the owner's panel kept the PREVIOUS run's line for ever.
    // Two bugs out of one overloaded name.
    let sent = 0, failed = 0, unsent = 0;
    for (const m of shaped.messages) {
      const use = m.channel === "sms" ? smsCreds : creds;
      // A MESSAGE WHOSE CHANNEL HAS NO KEY IS NOT A FAILURE. Counting it as one
      // makes a half-configured site look broken every run, when what is true is
      // that the emails went and the texts are waiting on a credential.
      if (!use) { unsent++; continue; }
      const r = m.channel === "sms"
        ? await deps.sendSms({ ...use, to: m.to, body: m.body })
        : await deps.send({ ...use, to: m.to, subject: m.subject, html: m.html });
      if (r && r.ok) sent++; else failed++;
    }
    return { ok: true, name, sent, failed, dropped: shaped.dropped, overflow: shaped.overflow, unsent };
  } catch (e) {
    return { ok: false, name, reason: "threw", error: String((e && e.message) || e).slice(0, 200) };
  }
}

/**
 * One row of the owner's Jobs panel, from one row of `site_functions`.
 *
 * ⚠ IT LIVES HERE RATHER THAN IN THE ROUTE BECAUSE OF A SWEEP SURVIVOR. Two of
 * these fields could be emptied with the whole suite green: driving
 * `GET /api/site/<slug>/jobs` needs Supabase, the owner gate and a session, so
 * nothing anywhere asked the projection a question it could fail. *A wall
 * nobody can drive is a wall nobody is guarding*, and the answer this
 * repository keeps reaching for is to make it drivable — `appliedFacts`,
 * `expectedCode` and `addLayerIn` were all moved for the same reason.
 *
 * AND IT BELONGS BESIDE THE SCHEDULER ON ITS OWN MERITS: every field is the
 * scheduler's view of that row. `fn` is what `runJob` will call, `everyMinutes`
 * is what `dueJobs` measures, `on`/`onState` are what it selects a one-time job
 * by. A copy in the route is a second idea of what a job is.
 *
 * EVERY FIELD FAILS CLOSED — a row of some other shape draws no sentence, no
 * number and no state word rather than drawing junk.
 */
export function jobPanelRow(j) {
  const row = j && typeof j === "object" ? j : {};
  const spec = row.spec && typeof row.spec === "object" ? row.spec : null;
  const str = (k) => (spec && typeof spec[k] === "string" ? spec[k] : null);
  return {
    name: String(row.name || ""),
    // WHICH FUNCTION IT RUNS (owner, 2026-09-16: *"an identical count is not
    // proof of which function was called"*), off the SPEC where `runJob` reads
    // it. Empty for a row whose spec lost it — a job that can never run, and
    // saying nothing would hide exactly that.
    fn: str("fn") || "",
    everyMinutes: Number(row.schedule_minutes) || 0,
    // The clock time and its zone (2026-09-03); null on a plain interval.
    at: str("at"),
    tz: str("tz"),
    // THE ONE DATE A ONE-TIME JOB RUNS (2026-09-19), null for a recurring one,
    // so the panel can say "once, on 2026-10-03 at 09:00 Europe/London" rather
    // than "every 44640 minutes" — which is the forced ceiling and is true of
    // nothing anybody asked for.
    on: str("on"),
    // …AND WHAT BECAME OF IT. Derived from the row rather than stored: a state
    // column could disagree with `last_run`, and the whole job of this field is
    // to be the truth about it.
    onState: onceState(row),
    enabled: row.enabled !== false,
    lastRun: row.last_run || null,
    // NULL rather than a cheerful default. A job that has never run and a job
    // whose last run sent nothing are different facts, and inventing a sentence
    // for the first is how a brand-new site reads as working before it ever has.
    lastResult: typeof row.last_result === "string" ? row.last_result : null,
  };
}
