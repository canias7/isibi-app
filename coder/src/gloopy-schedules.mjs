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

import { cleanSchedule, nextRun, whenWords, whenLocal, SCHEDULES_MAX, RUNS_PER_DAY, WAKEUPS_MAX } from "../container/gloopy-schedule.mjs";

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
    return s && typeof x.id === "string" && /^s[a-z0-9]{4,20}$/.test(x.id) ? { id: x.id, ...s, next: Number.isFinite(x.next) ? x.next : null, last: Number(x.last) || 0, runs: Number(x.runs) || 0, at: Number(x.at) || 0, ...(x.self === true && Number.isFinite(s.once) ? { self: true } : {}) } : null;
  }).filter((x) => x && x.next !== null).slice(0, SCHEDULES_MAX);
  return { items, day: d && typeof d.day === "string" ? d.day : "", runs: d && Number.isInteger(d.runs) ? d.runs : 0 };
}

/** Kept, with the person's record of when their next run is (none when they have no schedules left). */
export async function writeSchedules(bucket, uid, email, data) {
  await putJson(bucket, schedulesKey(uid), { items: data.items, day: data.day, runs: data.runs });
  const next = data.items.reduce((m, s) => (Number.isFinite(s.next) && (m === null || s.next < m) ? s.next : m), null);
  if (next === null) await bucket.delete(dueKey(uid));
  else await putJson(bucket, dueKey(uid), { uid, email: String(email || ""), next });
}

/** The schedules as Gloopy is told of them with each message (and as the page may show them). */
export function schedulesForTurn(data) {
  return data.items.map((s) => ({ id: s.id, name: s.name, when: whenWords(s), nextLocal: s.next ? whenLocal(s.next, s.tz) : "", task: s.task.slice(0, 600), ...(Number.isFinite(s.once) ? { once: true } : {}) }));
}

/** A new schedule, approved by the owner: kept with its first run; refused past SCHEDULES_MAX. Answers it, or throws. */
export function addSchedule(data, spec, now = Date.now()) {
  const s = cleanSchedule(spec);
  if (!s) throw new Error("that schedule could not be read");
  if (data.items.length >= SCHEDULES_MAX) throw new Error("Gloopy has " + SCHEDULES_MAX + " schedules already: ask it to stop one first");
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
    if (data.items.filter((x) => Number.isFinite(x.once)).length >= WAKEUPS_MAX || data.items.length >= SCHEDULES_MAX) break;
    try { addSchedule(data, s, now).self = true; kept++; } catch { break; }
  }
  return kept;
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
  const due = data.items.filter((s) => s.next <= now).sort((a, b) => a.next - b.next)[0];
  if (!due) { await writeSchedules(bucket, rec.uid, rec.email, data); return "none"; }
  if (data.day !== utcDay(now)) { data.day = utcDay(now); data.runs = 0; }
  // Its next time (a run that was once is then gone).
  const onward = () => { due.next = nextRun(due, Math.max(now, due.next)); if (due.next === null) data.items = data.items.filter((x) => x !== due); };
  const skip = async (why) => { onward(); await noteInChat(bucket, rec.uid, "Skipped “" + due.name + "” (" + whenLocal(now, due.tz) + "): " + why, now); await writeSchedules(bucket, rec.uid, rec.email, data); return "skipped"; };
  if (data.runs >= RUNS_PER_DAY) return skip("Gloopy already ran " + RUNS_PER_DAY + " scheduled tasks today, the most it runs in a day.");
  const late = now - due.next > LATE_MS;
  const meta = await getJson(bucket, chatKey(rec.uid, "meta.json"), null);
  if (meta && meta.status === "running") return late ? skip("Gloopy was busy with another message for 30 minutes.") : "waiting";
  const res = await deps.coder(new Request("https://gofarther.dev/api/coder/projects/" + GLOOPY_CHAT + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: scheduledText(due, now), scheduled: { id: due.id, name: due.name, when: whenWords(due), ...(due.self ? { wake: true } : {}) } }) }), { id: rec.uid, email: rec.email }).catch(() => null);
  if (res && res.status === 200) {
    due.last = now; due.runs++; data.runs++;
    onward();
    await writeSchedules(bucket, rec.uid, rec.email, data);
    return "started";
  }
  // Not started (Gloopy busy, or its computer not starting): tried again next minute, until it is too late.
  return late ? skip("Gloopy's computer could not start it.") : "waiting";
}
