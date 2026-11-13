// GLOOPY'S SCHEDULES, KEPT AND RUN BY CODER'S WORKER (owner, 2026-11-09: "Ok go"; Grok Bot's routines, dots' recurring
// tasks and its waking up to continue). Gloopy asks with its `schedule` tool; the owner approves each new one on a card
// (each run uses Grok); the Worker keeps them here and, every minute, starts the ones that are due: a message for Gloopy
// in its chat, as if sent by the owner's app (container/gloopy-schedule.mjs has the times).
//
// Kept per person (coder/<uid>/gloopy/schedules.json: { items, day, runs }), with one small record per person under
// coder/gloopy-due/ that says when their next run is, so the every-minute check reads only those.
//
// Limits, so a schedule never runs up a bill: at most SCHEDULES_MAX schedules and RUNS_PER_DAY runs a day per person; a
// run that cannot start (Gloopy busy with another message, or its computer not starting) is tried again each minute for
// LATE_MS, then skipped (said in the chat).
//
// PAUSE, EDIT, RUN NOW AND A HISTORY (the audit, owner 2026-11-10: "do all of that"; Grok Bot's routines can be paused,
// edited and run once to try them, and show their past runs): one schedule can be paused (it does not run until it goes
// again, from then on), or all of Gloopy's background work (schedules, wake-ups and webhook calls; what came due
// meanwhile is skipped and said once when it goes again); a schedule's words or times can be changed; and the last
// LOG_MAX runs (ran, skipped and why, tried) are kept.

import { cleanSchedule, nextRun, whenWords, whenLocal, SCHEDULES_MAX, RUNS_PER_DAY, WAKEUPS_MAX } from "../container/gloopy-schedule.mjs";
export { LOG_MAX } from "../container/gloopy-schedule.mjs";
import { LOG_MAX } from "../container/gloopy-schedule.mjs";
import { cleanPermissions } from "../container/gloopy-permissions.mjs";
import { eventText, HOOK_QUEUE_MAX, HOOK_TEXT_MAX } from "./gloopy-webhooks.mjs";

/** Gloopy's chat (src/coder-routes.mjs GLOOPY_ID). */
export const GLOOPY_CHAT = "gloopy-main";
export const DUE_PREFIX = "coder/gloopy-due/";
/** A run that has not started this long after its time is skipped. */
export const LATE_MS = 30 * 60 * 1000;
const MAX_EVENTS = 4000;

export const schedulesKey = (uid) => ["coder", uid, "gloopy", "schedules.json"].join("/");
const dueKey = (uid) => DUE_PREFIX + uid + ".json";
const chatKey = (uid, file) => ["coder", uid, GLOOPY_CHAT, file].join("/");
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });

/** A person's schedules, each checked again: { items: [{ id, ...schedule, next, last, runs, at }], day, runs }. */
export async function readSchedules(bucket, uid) {
  const d = await getJson(bucket, schedulesKey(uid), null);
  const items = (d && Array.isArray(d.items) ? d.items : []).map((x) => {
    const s = cleanSchedule(x);
    // A webhook call waiting while Gloopy was busy (2026-11-09) is a one-time item carrying what the call brought.
    const ev = Number.isFinite(s && s.once) && x.event && typeof x.event === "object" && typeof x.event.data === "string" ? { event: { hook: String(x.event.hook || "").slice(0, 30), data: x.event.data.slice(0, HOOK_TEXT_MAX + 2000), at: Number(x.event.at) || 0 } } : {};
    return s && typeof x.id === "string" && /^s[a-z0-9]{4,20}$/.test(x.id) ? { id: x.id, ...s, next: Number.isFinite(x.next) ? x.next : null, last: Number(x.last) || 0, runs: Number(x.runs) || 0, at: Number(x.at) || 0, ...(x.self === true && Number.isFinite(s.once) ? { self: true } : {}), ...(x.paused === true && !ev.event ? { paused: true } : {}), ...ev } : null;
  }).filter((x) => x && x.next !== null).slice(0, SCHEDULES_MAX + HOOK_QUEUE_MAX);
  const plain = (t, max) => String(t == null ? "" : t).replace(/\s+/g, " ").replace(/[\p{Cf}\p{Cc}]/gu, "").trim().slice(0, max);
  const log = (d && Array.isArray(d.log) ? d.log : []).filter((e) => e && Number.isFinite(e.at) && ["ran", "skipped", "test"].includes(e.result)).map((e) => ({ at: e.at, id: plain(e.id, 30), name: plain(e.name, 60), kind: ["schedule", "wake", "event"].includes(e.kind) ? e.kind : "schedule", result: e.result, ...(OUTCOMES.includes(e.outcome) ? { outcome: e.outcome } : {}), ...(e.why ? { why: plain(e.why, 200) } : {}) })).slice(-LOG_MAX);
  return { items, day: d && typeof d.day === "string" ? d.day : "", runs: d && Number.isInteger(d.runs) ? d.runs : 0, ...(d && d.paused === true ? { paused: true, pausedAt: Number(d.pausedAt) || 0 } : {}), log };
}

/** Kept, with the person's record of when their next run is (none when they have no schedules left). */
const stored = (data) => ({ items: data.items, day: data.day, runs: data.runs, ...(data.paused ? { paused: true, pausedAt: data.pausedAt || 0 } : {}), log: Array.isArray(data.log) ? data.log.slice(-LOG_MAX) : [] });
export async function writeSchedules(bucket, uid, email, data) {
  await putJson(bucket, schedulesKey(uid), stored(data));
  // Nothing is due while Gloopy's background work is paused, nor a schedule that is paused.
  const next = data.paused ? null : data.items.reduce((m, s) => (!s.paused && Number.isFinite(s.next) && (m === null || s.next < m) ? s.next : m), null);
  if (next === null) await bucket.delete(dueKey(uid));
  else await putJson(bucket, dueKey(uid), { uid, email: String(email || ""), next });
}

/** The schedules as Gloopy is told of them with each message (and as the page may show them). */
/** The schedules themselves (not webhook calls waiting their turn). */
const own = (data) => data.items.filter((x) => !x.event);

export function schedulesForTurn(data) {
  // With the parts of when it runs (live test, 2026-11-10): a change that names only a new time keeps the rest.
  return own(data).map((s) => ({ id: s.id, name: s.name, when: whenWords(s), nextLocal: s.next ? whenLocal(s.next, s.tz) : "", task: s.task.slice(0, 600), tz: s.tz, ...(Number.isFinite(s.once) ? { once: true } : {}), ...(s.self ? { self: true } : {}), ...(s.paused ? { paused: true } : {}), ...(s.every ? { every: s.every } : {}), ...(s.time ? { time: s.time } : {}), ...(Array.isArray(s.days) ? { days: s.days } : {}), ...(Number.isInteger(s.day) ? { day: s.day } : {}), ...(Number.isInteger(s.hours) ? { hours: s.hours } : {}) }));
}

/** What a run is, for the history: a schedule, a wake-up Gloopy set itself, or a webhook's call. */
const kindOf = (it) => (it.event ? "event" : Number.isFinite(it.once) && it.self ? "wake" : "schedule");
/**
 * A run kept in the history (the last LOG_MAX): { at, id, name, kind, result: ran | skipped | test, why?, outcome? }; a
 * run that started gets its outcome when its job ends (endRun).
 */
export function logRun(data, it, result, why = "", now = Date.now()) {
  data.log = [...(Array.isArray(data.log) ? data.log : []), { at: now, id: String(it.event ? it.event.hook || it.id : it.id), name: it.name, kind: kindOf(it), result, ...(why ? { why: String(why).slice(0, 200) } : {}) }].slice(-LOG_MAX);
}

/** How a run went, in the history. */
export const OUTCOMES = Object.freeze(["succeeded", "failed", "waiting"]);
/**
 * HOW A RUN WENT (the docs, 2026-11-10; Grok Bot's run history shows each run as Running, Succeeded or Failed, a failed
 * one with its reason): the latest run of `id` still going (no outcome, or waiting for the owner's answer on its card)
 * gets one. Only the history changes. Answers whether there was such a run.
 */
export async function endRun(bucket, uid, id, outcome, why = "") {
  if (typeof id !== "string" || !id || !OUTCOMES.includes(outcome)) return false;
  const data = await readSchedules(bucket, uid);
  const log = Array.isArray(data.log) ? data.log : [];
  const i = log.findLastIndex((e) => e && e.id === id && (e.result === "ran" || e.result === "test") && (!e.outcome || e.outcome === "waiting"));
  if (i < 0) return false;
  const { why: _old, ...rest } = log[i];
  log[i] = { ...rest, outcome, ...(why ? { why: String(why).slice(0, 200) } : {}) };
  await putJson(bucket, schedulesKey(uid), stored({ ...data, log }));
  return true;
}

/**
 * ONE SCHEDULE PAUSED, OR GOING AGAIN: paused, it does not run; going again, its next run is the next one from now (a
 * one-time run whose time passed meanwhile is over, kept in the history). Answers it, or null when there is no such one.
 */
export function setPaused(data, id, paused, now = Date.now()) {
  const it = own(data).find((x) => x.id === id);
  if (!it) return null;
  if (paused) { it.paused = true; return it; }
  delete it.paused;
  if (!(it.next > now)) {
    const n = Number.isFinite(it.once) ? null : nextRun(it, now);
    if (n === null) { data.items = data.items.filter((x) => x !== it); logRun(data, it, "skipped", "its time passed while it was paused", now); return { ...it, gone: true }; }
    it.next = n;
  }
  return it;
}

/**
 * ALL OF GLOOPY'S BACKGROUND WORK PAUSED, OR GOING AGAIN: paused, no schedule, wake-up or webhook call runs (the owner can
 * still talk to Gloopy). Going again, what came due meanwhile is skipped (one-time runs end; repeating ones go on from
 * now), each kept in the history. Answers the names of what was skipped.
 */
export function pauseAll(data, paused, now = Date.now()) {
  if (paused) { if (!data.paused) { data.paused = true; data.pausedAt = now; } return []; }
  if (!data.paused) return [];
  delete data.paused; delete data.pausedAt;
  const skipped = [];
  for (const it of [...data.items]) {
    if (it.paused || it.next > now) continue;
    skipped.push(it.name);
    logRun(data, it, "skipped", "Gloopy was paused", now);
    const n = Number.isFinite(it.once) ? null : nextRun(it, now);
    if (n === null) data.items = data.items.filter((x) => x !== it); else it.next = n;
  }
  return skipped;
}

/**
 * A SCHEDULE CHANGED (its name, its task, or when it runs: `spec`, a whole new time checked by checkSchedule), kept with
 * its id, its runs and whether it is paused; its next run from now. Answers it, or throws with what is wrong.
 */
export function editSchedule(data, id, { name = "", task = "", spec = null } = {}, now = Date.now()) {
  const it = own(data).find((x) => x.id === id);
  if (!it) throw new Error("No schedule has that id.");
  const merged = cleanSchedule({ ...(spec && typeof spec === "object" ? spec : it), ...(name ? { name } : {}), ...(task ? { task } : {}) });
  if (!merged) throw new Error("that schedule could not be read");
  const next = nextRun(merged, now);
  if (next === null) throw new Error("that schedule's time has passed");
  for (const k of ["name", "task", "tz", "once", "every", "hours", "anchor", "time", "days", "day", "until"]) delete it[k];
  Object.assign(it, merged, { next });
  if (!Number.isFinite(merged.once)) delete it.self;
  return it;
}

/** What Gloopy is sent for a run the owner started to try a schedule ("Run now"): as a run of it, said to be a try. */
export function testText(s, now = Date.now()) {
  return "(Test run of “" + s.name + "”, " + whenWords(s) + ": the owner started it now to try it. Do its task as it would run then. It is " + whenLocal(now, s.tz) + " now in " + s.tz + ".)\n\n" + s.task;
}

/** A new schedule, approved by the owner: kept with its first run; refused past SCHEDULES_MAX. Answers it, or throws. */
export function addSchedule(data, spec, now = Date.now()) {
  const s = cleanSchedule(spec);
  if (!s) throw new Error("that schedule could not be read");
  if (own(data).length >= SCHEDULES_MAX) throw new Error("Gloopy has " + SCHEDULES_MAX + " schedules already: ask it to stop one first");
  const next = nextRun(s, now);
  if (next === null) throw new Error("that schedule's time has passed");
  const item = { id: "s" + crypto.randomUUID().replace(/-/g, "").slice(0, 10), ...s, next, last: 0, runs: 0, at: now };
  data.items.push(item);
  return item;
}

/**
 * WAKE-UPS GLOOPY SET IN A TURN (owner, 2026-11-09: "just automatically wake up"), kept when the turn ends, with no card:
 * one-time only, in the future, at most WAKEUPS_MAX waiting and SCHEDULES_MAX in all. Answers how many were kept.
 */
export function addWakeups(data, specs, now = Date.now()) {
  let kept = 0;
  for (const raw of Array.isArray(specs) ? specs.slice(0, WAKEUPS_MAX) : []) {
    const s = cleanSchedule(raw);
    if (!s || !Number.isFinite(s.once) || !(s.once > now)) continue;
    if (own(data).filter((x) => Number.isFinite(x.once)).length >= WAKEUPS_MAX || own(data).length >= SCHEDULES_MAX) break;
    try { addSchedule(data, s, now).self = true; kept++; } catch { break; }
  }
  return kept;
}

/**
 * WHAT A TURN ASKED TO KEEP, BY THE OWNER'S SETTINGS AS KEPT HERE (2026-11-09; never as the machine says): wake-ups when
 * "Wake-ups" is Always allow, repeating schedules when "Repeating schedules" is (anything else came as a card instead).
 */
export function addFromTurn(data, specs, perms, now = Date.now()) {
  const p = cleanPermissions(perms);
  const list = (Array.isArray(specs) ? specs : []).filter((x) => x && typeof x === "object").slice(0, SCHEDULES_MAX);
  let kept = p.wake === "allow" ? addWakeups(data, list.filter((x) => Number.isFinite(x.once)), now) : 0;
  if (p.schedule === "allow") {
    for (const raw of list.filter((x) => !Number.isFinite(x.once))) {
      const s = cleanSchedule(raw);
      if (!s || own(data).length >= SCHEDULES_MAX) continue;
      try { addSchedule(data, s, now); kept++; } catch { /* its time has passed */ }
    }
  }
  return kept;
}

/** The day's count of runs, started over on a new day (UTC); whether one more may start today. */
export function runsLeft(data, now = Date.now()) {
  if (data.day !== utcDay(now)) { data.day = utcDay(now); data.runs = 0; }
  return data.runs < RUNS_PER_DAY;
}

/**
 * A WEBHOOK CALL WAITING WHILE GLOOPY IS BUSY (2026-11-09): kept as a one-time item due now, which the every-minute
 * check starts once Gloopy is free (or skips, saying so, after LATE_MS). At most HOOK_QUEUE_MAX wait; false when full.
 */
export function queueEvent(data, { hook, name, task, data: said, at }) {
  if (data.items.filter((x) => x.event).length >= HOOK_QUEUE_MAX) return false;
  data.items.push({ id: "s" + crypto.randomUUID().replace(/-/g, "").slice(0, 10), name, task, tz: "UTC", once: at, next: at, last: 0, runs: 0, at, event: { hook, data: said, at } });
  return true;
}

/** What Gloopy is sent for a run: when it is, and the task the owner approved (or that Gloopy set itself, for a wake-up). */
export function scheduledText(s, now = Date.now()) {
  if (Number.isFinite(s.once) && s.self) return "(Scheduled run of “" + s.name + "”: the wake-up you set to come back to this. It is " + whenLocal(now, s.tz) + " now in " + s.tz + ".)\n\n" + s.task;
  return "(Scheduled run of “" + s.name + "”, " + whenWords(s) + ", which the owner approved. It is " + whenLocal(now, s.tz) + " now in " + s.tz + ".)\n\n" + s.task;
}

/** A line in Gloopy's chat, from Coder's app (a run skipped). */
async function noteInChat(bucket, uid, text, now) {
  const ev = await getJson(bucket, chatKey(uid, "events.json"), []);
  await putJson(bucket, chatKey(uid, "events.json"), [...(Array.isArray(ev) ? ev : []), { at: now, type: "note", text }].slice(-MAX_EVENTS));
}

/**
 * EVERY MINUTE (worker.js): for each person with a run due, the earliest due one is started, as a message for Gloopy
 * sent through Coder's own API as that person (deps.coder, like the watch list's). One run per person per minute.
 */
export async function runGloopySchedules(env, deps, now = Date.now()) {
  const bucket = env.CODER_BUCKET;
  const keys = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: DUE_PREFIX, cursor });
    for (const o of page.objects || []) keys.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const out = { checked: 0, started: 0, waiting: 0, skipped: 0 };
  for (const key of keys) {
    const rec = await getJson(bucket, key, null);
    if (!rec || typeof rec.uid !== "string" || !rec.uid) { await bucket.delete(key); continue; }
    if (!(Number(rec.next) <= now)) continue;
    out.checked++;
    const r = await runDue(bucket, deps, rec, now).catch(() => "error");
    if (r === "started") out.started++; else if (r === "waiting") out.waiting++; else if (r === "skipped") out.skipped++;
  }
  return out;
}

async function runDue(bucket, deps, rec, now) {
  const data = await readSchedules(bucket, rec.uid);
  const due = data.paused ? null : data.items.filter((s) => !s.paused && s.next <= now).sort((a, b) => a.next - b.next)[0];
  if (!due) { await writeSchedules(bucket, rec.uid, rec.email, data); return "none"; }
  if (data.day !== utcDay(now)) { data.day = utcDay(now); data.runs = 0; }
  // Its next time (a run that was once is then gone).
  const onward = () => { due.next = nextRun(due, Math.max(now, due.next)); if (due.next === null) data.items = data.items.filter((x) => x !== due); };
  const skip = async (why) => { logRun(data, due, "skipped", why, now); onward(); await noteInChat(bucket, rec.uid, "Skipped “" + due.name + "” (" + whenLocal(now, due.tz) + "): " + why, now); await writeSchedules(bucket, rec.uid, rec.email, data); return "skipped"; };
  if (data.runs >= RUNS_PER_DAY) return skip("Gloopy already ran " + RUNS_PER_DAY + " scheduled tasks today, the most it runs in a day.");
  const late = now - due.next > LATE_MS;
  const meta = await getJson(bucket, chatKey(rec.uid, "meta.json"), null);
  if (meta && meta.status === "running") return late ? skip("Gloopy was busy with another message for 30 minutes.") : "waiting";
  // A CARD STILL WAITING FOR THE OWNER (the audit, 2026-11-10): the run waits for their answer, up to 30 minutes from the
  // card (then the run goes ahead and the card is over: a card from a run they did not start has expired by then).
  const card = meta && meta.pending && typeof meta.pending === "object" ? meta.pending : null;
  if (card && now - Number(card.at || meta.at || 0) < LATE_MS && !(Number(card.expires) > 0 && now > Number(card.expires))) return late ? skip("Gloopy was waiting for your answer on a card.") : "waiting";
  const text = due.event ? eventText(due.name, due.task, due.event.data, due.event.at || due.once, true) : scheduledText(due, now);
  const res = await deps.coder(new Request("https://gofarther.dev/api/coder/projects/" + GLOOPY_CHAT + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, scheduled: due.event ? { id: due.event.hook, name: due.name, when: "a call to its web address", event: true } : { id: due.id, name: due.name, when: whenWords(due), ...(due.self ? { wake: true } : {}) } }) }), { id: rec.uid, email: rec.email }).catch(() => null);
  if (res && res.status === 200) {
    due.last = now; due.runs++; data.runs++;
    logRun(data, due, "ran", "", now);
    onward();
    await writeSchedules(bucket, rec.uid, rec.email, data);
    return "started";
  }
  // Not started (Gloopy busy, or its computer not starting): tried again next minute, until it is too late.
  return late ? skip("Gloopy's computer could not start it.") : "waiting";
}
