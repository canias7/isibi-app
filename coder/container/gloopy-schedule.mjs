// GLOOPY'S SCHEDULES (owner, 2026-11-09: "Ok go"; Grok Bot's routines, "Schedules and time zones", and dots' recurring
// tasks and "decide when to pause and wake up to continue"): work Gloopy does on its own later, once ("in 30 minutes",
// "tomorrow at 9") or again and again ("every weekday at 8:00"), in the owner's time zone. The owner approves each one
// on a card first: every run is a message for Gloopy, so it uses Grok (CLAUDE.md: no paid run without the owner's OK).
//
// Shared by Gloopy's machine (the `schedule` tool checks what Gloopy asked and says it in words) and Coder's Worker
// (which keeps the schedules and starts each run, every minute). Only what Cloudflare's Workers have: no Node APIs.

/** At most this many schedules per person, and this many runs a day (UTC) in all, so a schedule can never run up a bill. */
export const SCHEDULES_MAX = 10, RUNS_PER_DAY = 24;
/** The most past runs kept in the history (the audit, 2026-11-10). */
export const LOG_MAX = 30;
/**
 * WAKE-UPS (owner, 2026-11-09: "just automatically wake up"): a one-time run Gloopy sets for itself, to come back to a
 * job later, is kept at once with no card. At most this many wait at a time, each at least this many minutes ahead.
 */
export const WAKEUPS_MAX = 5, WAKE_MIN_MINUTES = 5;
/** How a schedule repeats: every N hours (1 to 12), every day, every weekday (Monday to Friday), some days of each week, one day of each month. */
export const EVERY = Object.freeze(["hours", "day", "weekday", "week", "month"]);
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

/** Whether `tz` is a time zone this computer knows (an IANA name like Europe/Lisbon). */
export function okZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** The wall clock in `tz` at instant `ms`: { y, m, d, h, mi, wd } (wd: 0 is Sunday). */
export function localParts(ms, tz) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), wd: DAYS.indexOf(String(p.weekday).slice(0, 3).toLowerCase()) };
}

/** The instant of a wall-clock time in `tz` (a time that a clock change skips is moved on by the change). */
export function zoned(y, m, d, h, mi, tz) {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const offset = (ms) => { const p = localParts(ms, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / MIN) * MIN; };
  let t = wall - offset(wall);
  const o = offset(t);
  if (wall - t !== o) t = wall - o;
  return t;
}

const plainText = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").replace(/[\p{Cf}\p{Cc}]/gu, "").trim().slice(0, max);
const minute = (ms) => Math.ceil(ms / MIN) * MIN;

/**
 * WHAT GLOOPY ASKED FOR, CHECKED (its `schedule` tool's add): { name, task, time_zone } with either `in_minutes` or `at`
 * ("YYYY-MM-DD HH:MM", the owner's time) for once, or `every` with `time` ("HH:MM"), `days` (week), `day` (month) or
 * `hours`, and `until` ("YYYY-MM-DD") if it should stop. Answers the schedule as it is kept, or throws with what to fix.
 */
export function checkSchedule(raw, now = Date.now()) {
  const x = raw && typeof raw === "object" ? raw : {};
  const name = plainText(x.name, 60);
  if (!name) throw new Error("give name: a few words the owner will recognize, like “Morning news”");
  const task = String(x.task == null ? "" : x.task).replace(/[\p{Cf}]/gu, "").trim().slice(0, 2000);
  if (!task) throw new Error("give task: what you will do each time, as instructions to yourself that stand on their own");
  const tz = String(x.time_zone || "").trim();
  if (!okZone(tz)) throw new Error("give time_zone: the owner's, as a name like Europe/Lisbon or America/New_York (from your notes; ask the owner if you don't know it)");
  const out = { name, task, tz };
  if (x.in_minutes !== undefined && x.in_minutes !== null && x.in_minutes !== "") {
    const n = Math.round(Number(x.in_minutes));
    if (!(n >= 2 && n <= 7 * 24 * 60)) throw new Error("in_minutes: 2 to 10080 (a week)");
    return { ...out, once: minute(now + n * MIN) };
  }
  if (x.at) {
    const a = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})$/.exec(String(x.at).trim());
    if (!a) throw new Error("at: the owner's local date and time, like 2026-11-10 09:00");
    const t = zoned(Number(a[1]), Number(a[2]), Number(a[3]), Number(a[4]), Number(a[5]), tz);
    if (!(t > now + MIN)) throw new Error("at: that time has passed (it is " + whenLocal(now, tz) + " now in " + tz + ")");
    if (t > now + 366 * DAY) throw new Error("at: at most a year from now");
    return { ...out, once: t };
  }
  const every = String(x.every || "");
  if (!EVERY.includes(every)) throw new Error("give in_minutes or at (once), or every: hours, day, weekday, week or month");
  out.every = every;
  if (every === "hours") {
    const n = Math.round(Number(x.hours));
    if (!(n >= 1 && n <= 12)) throw new Error("hours: every 1 to 12 hours");
    out.hours = n;
    out.anchor = minute(now);
  } else {
    const t = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(x.time || "").trim());
    if (!t) throw new Error("give time: the owner's local time, like 08:00");
    out.time = t[1].padStart(2, "0") + ":" + t[2];
    if (every === "week") {
      const days = [...new Set((Array.isArray(x.days) ? x.days : [x.days]).map((d) => String(d || "").slice(0, 3).toLowerCase()).filter((d) => DAYS.includes(d)))];
      if (!days.length) throw new Error("give days: which days of the week, like [\"mon\", \"thu\"]");
      out.days = DAYS.filter((d) => days.includes(d));
    }
    if (every === "month") {
      const d = Math.round(Number(x.day));
      if (!(d >= 1 && d <= 28)) throw new Error("give day: the day of the month, 1 to 28");
      out.day = d;
    }
  }
  if (x.until) {
    const u = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x.until).trim());
    if (!u) throw new Error("until: the last day, like 2026-12-31");
    out.until = zoned(Number(u[1]), Number(u[2]), Number(u[3]), 23, 59, tz) + MIN - 1;
    if (!(out.until > now)) throw new Error("until: that day has passed");
  }
  return out;
}

/** A kept schedule, checked again (the Worker never takes one on trust): the same shape, or null. */
export function cleanSchedule(s) {
  if (!s || typeof s !== "object" || !okZone(s.tz)) return null;
  const name = plainText(s.name, 60), task = String(s.task || "").trim().slice(0, 2000);
  if (!name || !task) return null;
  const out = { name, task, tz: s.tz };
  if (Number.isFinite(s.once)) return { ...out, once: Number(s.once) };
  if (!EVERY.includes(s.every)) return null;
  out.every = s.every;
  if (s.every === "hours") { if (!(Number.isInteger(s.hours) && s.hours >= 1 && s.hours <= 12 && Number.isFinite(s.anchor))) return null; out.hours = s.hours; out.anchor = Number(s.anchor); }
  else {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.time || ""))) return null;
    out.time = s.time;
    if (s.every === "week") { const days = (Array.isArray(s.days) ? s.days : []).filter((d) => DAYS.includes(d)); if (!days.length) return null; out.days = DAYS.filter((d) => days.includes(d)); }
    if (s.every === "month") { if (!(Number.isInteger(s.day) && s.day >= 1 && s.day <= 28)) return null; out.day = s.day; }
  }
  if (Number.isFinite(s.until)) out.until = Number(s.until);
  return out;
}

/** When it runs next, strictly after `after` (an instant), or null when it has no more runs. */
export function nextRun(s, after) {
  if (Number.isFinite(s.once)) return s.once > after ? s.once : null;
  let t = null;
  if (s.every === "hours") {
    const p = s.hours * HOUR;
    t = s.anchor + Math.max(1, Math.floor((after - s.anchor) / p) + 1) * p;
  } else {
    const [hh, mm] = s.time.split(":").map(Number);
    const start = localParts(after, s.tz);
    for (let i = 0; i < 400 && t === null; i++) {
      const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
      const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate(), wd = day.getUTCDay();
      if (s.every === "weekday" && (wd === 0 || wd === 6)) continue;
      if (s.every === "week" && !s.days.includes(DAYS[wd])) continue;
      if (s.every === "month" && d !== s.day) continue;
      const c = zoned(y, m, d, hh, mm, s.tz);
      if (c > after) t = c;
    }
  }
  if (t !== null && Number.isFinite(s.until) && t > s.until) return null;
  return t;
}

/** An instant as the owner reads it in `tz`: "Tue 10 Nov, 09:00". */
export function whenLocal(ms, tz) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
  return v.weekday + " " + v.day + " " + v.month + ", " + v.hour + ":" + v.minute;
}

const nth = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
const list = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a.at(-1));

/** A schedule in words, for the owner's card and Gloopy: "every weekday at 08:00 (Europe/Lisbon)". */
export function whenWords(s) {
  let w;
  if (Number.isFinite(s.once)) w = "once, on " + whenLocal(s.once, s.tz).replace(", ", " at ");
  else if (s.every === "hours") w = s.hours === 1 ? "every hour" : "every " + s.hours + " hours";
  else if (s.every === "day") w = "every day at " + s.time;
  else if (s.every === "weekday") w = "every weekday at " + s.time;
  else if (s.every === "week") w = "every " + list(s.days.map((d) => DAY_NAMES[DAYS.indexOf(d)])) + " at " + s.time;
  else w = "on the " + nth(s.day) + " of every month at " + s.time;
  const until = Number.isFinite(s.until) ? ", until " + whenLocal(s.until, s.tz).split(",")[0] : "";
  return w + (s.every === "hours" ? "" : " (" + s.tz + ")") + until;
}

/** One of Gloopy's schedules in a line: "- s1a2b3 · Morning news · every weekday at 08:00 (Europe/Lisbon) · next Tue 10 Nov, 08:00 · task: …". */
export function scheduleLine(x) {
  const s = x && typeof x === "object" ? x : {};
  return "- " + [String(s.id || ""), String(s.name || ""), String(s.when || ""), s.paused ? "paused by the owner" : s.nextLocal ? "next " + s.nextLocal : "", s.task ? "task: " + String(s.task).replace(/\s+/g, " ").slice(0, 200) : ""].filter(Boolean).join(" · ");
}

// ── WEBHOOKS: STARTING WORK FROM EVENTS (owner, 2026-11-09: "2"; Grok Bot's routines started by a call to their web
// address, "Senders include it as Authorization: Bearer <key>"; dots' event-triggered work). A webhook is a web address
// that starts a Gloopy run with its task each time a service calls it with its key (GitHub, a form, a store, a script, or
// Zapier, Make or IFTTT passing on an email or a Slack message). What the call carries reaches Gloopy as data, never as
// instructions. Its id is in its address; its key is made by Coder's Worker from its id and never reaches Gloopy.

/** At most this many webhooks per person. */
export const WEBHOOKS_MAX = 10;
/** A webhook's id (the last part of its address). */
export const HOOK_ID = /^h[a-z0-9]{20}$/;

/** A webhook as Gloopy asked for it, checked: { name, task }, or null. */
export function cleanWebhook(w) {
  if (!w || typeof w !== "object") return null;
  const name = plainText(w.name, 60), task = String(w.task || "").trim().slice(0, 2000);
  return name && task ? { name, task } : null;
}

/** One line for Gloopy's list: its id, name, address and how often it was called. */
export function webhookLine(w) {
  const calls = Number(w.calls) || 0;
  return "- " + w.id + " · " + plainText(w.name, 60) + " · " + String(w.url || "") + " · " + (calls ? "called " + calls + " time" + (calls === 1 ? "" : "s") + (w.last ? ", last " + new Date(w.last).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "") : "not called yet") + " · task: " + String(w.task || "").replace(/\s+/g, " ").slice(0, 160);
}
