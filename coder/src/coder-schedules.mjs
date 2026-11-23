// CODER'S SCHEDULED PROMPTS, KEPT AND RUN BY CODER'S WORKER (2026-11-23; Claude Code's CronCreate, CronDelete, CronList,
// ScheduleWakeup and RemoteTrigger: container/coder-schedule.mjs has the tools and the times). Gloopy's schedules
// (gloopy-schedules.mjs) are separate and unchanged; this follows their shape.
//
// - A chat's crons and its self-paced loop's wake-up: coder/<uid>/<chat>/crons.json { items, wake, day, runs }, with a small
//   record under coder/cron-due/ saying when its next run is, so the every-minute check reads only those.
// - The owner's cloud scheduled tasks: coder/<uid>/triggers.json { items, day, runs }, with coder/trigger-due/<uid>.json.
//
// A run of a cron or wake-up is a message in its chat (as if the owner sent it), only while the chat is idle (Claude Code:
// "Tasks only fire while Claude Code is running and idle"; no catch-up: one late run, then the next from now). A run of a cloud
// scheduled task opens a new chat on its repository and sends its prompt there. Every run is at the caps' effort (Low by
// default), and at most `runsPerDay` start a day (UTC) per chat, and as many across the cloud scheduled tasks.

import { cleanCron, cleanWake, cleanTrigger, nextCron, cronLimits, cronRunText, CRON_ID, TRIGGER_ID } from "../container/coder-schedule.mjs";

export const CRON_DUE = "coder/cron-due/", TRIGGER_DUE = "coder/trigger-due/";
/** A run that has not started this long after its time (the chat busy all along) is skipped, as Gloopy's are. */
export const CRON_LATE_MS = 30 * 60 * 1000;
const cronsKey = (uid, chat) => ["coder", uid, chat, "crons.json"].join("/");
const triggersKey = (uid) => ["coder", uid, "triggers.json"].join("/");
const cronDueKey = (uid, chat) => CRON_DUE + uid + "/" + chat + ".json";
const trigDueKey = (uid) => TRIGGER_DUE + uid + ".json";
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const CHAT = /^[A-Za-z0-9_-]{1,80}$/;

async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });
const drop = (bucket, key) => (typeof bucket.delete === "function" ? bucket.delete(key) : null);

/** A chat's crons and wake-up, each checked again. */
export async function readCrons(bucket, uid, chat) {
  const d = await getJson(bucket, cronsKey(uid, chat), null);
  return { items: (d && Array.isArray(d.items) ? d.items : []).map(cleanCron).filter(Boolean).slice(0, 50), wake: cleanWake(d && d.wake), day: d && typeof d.day === "string" ? d.day : "", runs: d && Number.isInteger(d.runs) ? d.runs : 0 };
}
export async function writeCrons(bucket, uid, email, chat, data) {
  const next = [...data.items.map((c) => c.next), ...(data.wake ? [data.wake.at] : [])].filter(Number.isFinite).reduce((m, t) => (m === null || t < m ? t : m), null);
  if (!data.items.length && !data.wake) { await drop(bucket, cronsKey(uid, chat)); await drop(bucket, cronDueKey(uid, chat)); return; }
  await putJson(bucket, cronsKey(uid, chat), { items: data.items, wake: data.wake, day: data.day, runs: data.runs });
  if (next === null) await drop(bucket, cronDueKey(uid, chat)); else await putJson(bucket, cronDueKey(uid, chat), { uid, email: String(email || ""), chat, next });
}
export async function readTriggers(bucket, uid) {
  const d = await getJson(bucket, triggersKey(uid), null);
  return { items: (d && Array.isArray(d.items) ? d.items : []).map(cleanTrigger).filter(Boolean).slice(0, 50), day: d && typeof d.day === "string" ? d.day : "", runs: d && Number.isInteger(d.runs) ? d.runs : 0 };
}
export async function writeTriggers(bucket, uid, email, data) {
  const next = data.items.filter((t) => t.enabled && Number.isFinite(t.next)).reduce((m, t) => (m === null || t.next < m ? t.next : m), null);
  await putJson(bucket, triggersKey(uid), { items: data.items, day: data.day, runs: data.runs });
  if (next === null) await drop(bucket, trigDueKey(uid)); else await putJson(bucket, trigDueKey(uid), { uid, email: String(email || ""), next });
}

/** What a Coder turn is sent (the machine's cron_list and remote_trigger read these; it changes them only through its result). */
export async function cronTurnOn(env, bucket, uid, chat) {
  const c = await readCrons(bucket, uid, chat), t = await readTriggers(bucket, uid);
  return { crons: c.items, wake: c.wake, triggers: t.items, limits: cronLimits(env) };
}

/**
 * WHAT A CODER TURN CHANGED (its result: cronAdds, cronRemovals, wakeup, triggerOps), checked again here and kept, within the
 * caps (never as the machine says). `repo`: the chat's repository, for a cloud scheduled task that names none.
 */
export async function applyCronTurn(env, bucket, uid, email, chat, result, repo = "", now = Date.now()) {
  const r = result && typeof result === "object" ? result : {};
  const L = cronLimits(env);
  const adds = Array.isArray(r.cronAdds) ? r.cronAdds.slice(0, L.max) : [], gone = Array.isArray(r.cronRemovals) ? r.cronRemovals.filter((x) => typeof x === "string") : [];
  const ops = Array.isArray(r.triggerOps) ? r.triggerOps.filter((o) => o && typeof o === "object").slice(0, 20) : [];
  const out = { crons: 0, triggers: 0, runs: [] };
  if (CHAT.test(String(chat || "")) && (adds.length || gone.length || r.wakeup !== undefined)) {
    const d = await readCrons(bucket, uid, chat);
    d.items = d.items.filter((c) => !gone.includes(c.id));
    for (const raw of adds) {
      const c = cleanCron(raw);
      if (!c || d.items.length >= L.max || d.items.some((x) => x.id === c.id)) continue;
      // (Its next run from now, as the Worker reckons it.)
      const next = nextCron(c.cron, now);
      if (next === null) continue;
      d.items.push({ ...c, next, at: now, ...(c.recurring ? { expires: Math.min(Number(c.expires) || Infinity, now + 7 * 86400000) } : {}) });
      out.crons++;
    }
    if (r.wakeup && r.wakeup.stop === true) d.wake = null;
    else if (r.wakeup) { const w = cleanWake(r.wakeup); if (w) d.wake = { ...w, at: Math.min(Math.max(w.at, now + 60000), now + 3600000) }; }
    await writeCrons(bucket, uid, email, chat, d);
  }
  if (ops.length) {
    const t = await readTriggers(bucket, uid);
    for (const o of ops) {
      const id = String(o.id || "");
      if (!TRIGGER_ID.test(id)) continue;
      if (o.op === "create") {
        if (t.items.length >= L.triggerMax || t.items.some((x) => x.id === id)) continue;
        const it = cleanTrigger({ ...o.trigger, repo: (o.trigger && o.trigger.repo) || repo, id, at: now, runs: [] });
        if (!it) continue;
        it.next = it.enabled ? nextCron(it.cron, now) : null;
        t.items.push(it); out.triggers++;
      } else if (o.op === "update") {
        const i = t.items.findIndex((x) => x.id === id);
        if (i < 0) continue;
        const it = cleanTrigger({ ...t.items[i], ...(o.trigger || {}), id, at: t.items[i].at, runs: t.items[i].runs });
        if (!it) continue;
        it.next = it.enabled ? nextCron(it.cron, now) : null;
        t.items[i] = it; out.triggers++;
      } else if (o.op === "run" && t.items.some((x) => x.id === id)) out.runs.push(id);
    }
    await writeTriggers(bucket, uid, email, t);
  }
  return out;
}

const dayCount = (d, now) => { if (d.day !== utcDay(now)) { d.day = utcDay(now); d.runs = 0; } };
const listKeys = async (bucket, prefix) => {
  const keys = [];
  let cursor;
  do { const page = await bucket.list({ prefix, cursor }); for (const o of page.objects || []) keys.push(o.key); cursor = page.truncated ? page.cursor : undefined; } while (cursor);
  return keys;
};
const note = async (bucket, uid, chat, text, now) => {
  const k = ["coder", uid, chat, "events.json"].join("/");
  const ev = await getJson(bucket, k, []);
  await putJson(bucket, k, [...(Array.isArray(ev) ? ev : []), { at: now, type: "note", text }].slice(-4000));
};

/**
 * EVERY MINUTE (worker.js): each chat with a cron or wake-up due gets its earliest due one, as a message from the owner's app
 * (deps.coder, as the owner, like Gloopy's schedules), at the caps' effort; each owner's due cloud scheduled task opens a new
 * chat. One run per chat (and per owner's cloud tasks) per minute.
 */
export async function runCoderCrons(env, deps, now = Date.now()) {
  const bucket = env.CODER_BUCKET;
  const L = cronLimits(env);
  const out = { started: 0, waiting: 0, skipped: 0, triggers: 0 };
  for (const key of await listKeys(bucket, CRON_DUE)) {
    const rec = await getJson(bucket, key, null);
    if (!rec || typeof rec.uid !== "string" || !CHAT.test(String(rec.chat || ""))) { await drop(bucket, key); continue; }
    if (!(Number(rec.next) <= now)) continue;
    const r = await runCronDue(env, bucket, deps, rec, L, now).catch(() => "error");
    if (r in out) out[r]++;
  }
  for (const key of await listKeys(bucket, TRIGGER_DUE)) {
    const rec = await getJson(bucket, key, null);
    if (!rec || typeof rec.uid !== "string") { await drop(bucket, key); continue; }
    if (!(Number(rec.next) <= now)) continue;
    const t = await readTriggers(bucket, rec.uid);
    const due = t.items.filter((x) => x.enabled && x.next !== null && x.next <= now).sort((a, b) => a.next - b.next)[0];
    if (due) { await startTrigger(env, bucket, deps, rec, t, due, L, now).catch(() => null); out.triggers++; }
    else await writeTriggers(bucket, rec.uid, rec.email, t);
  }
  return out;
}

async function runCronDue(env, bucket, deps, rec, L, now) {
  const d = await readCrons(bucket, rec.uid, rec.chat);
  const cands = [...d.items.filter((c) => c.next <= now).map((c) => ({ kind: "cron", it: c, at: c.next })), ...(d.wake && d.wake.at <= now ? [{ kind: "wake", it: d.wake, at: d.wake.at }] : [])].sort((a, b) => a.at - b.at);
  const due = cands[0];
  if (!due) { await writeCrons(bucket, rec.uid, rec.email, rec.chat, d); return "none"; }
  // Its next time, or gone: a one-shot cron and a wake-up after one run; a recurring cron after its final run past its 7 days.
  const onward = () => {
    if (due.kind === "wake") { d.wake = null; return; }
    const c = due.it, next = nextCron(c.cron, now);
    if (!c.recurring || next === null || (Number.isFinite(c.expires) && now >= c.expires)) d.items = d.items.filter((x) => x !== c); else c.next = next;
  };
  const what = due.kind === "wake" ? "the loop's wake-up" : "scheduled task " + due.it.id;
  const skip = async (why) => { onward(); await note(bucket, rec.uid, rec.chat, "Skipped " + what + ": " + why, now).catch(() => {}); await writeCrons(bucket, rec.uid, rec.email, rec.chat, d); return "skipped"; };
  dayCount(d, now);
  if (d.runs >= L.runsPerDay) return skip("this chat already had " + L.runsPerDay + " scheduled runs today (UTC), the most a day (each is a paid model call).");
  const meta = await getJson(bucket, ["coder", rec.uid, rec.chat, "meta.json"].join("/"), null);
  if (!meta) { await drop(bucket, cronsKey(rec.uid, rec.chat)); await drop(bucket, cronDueKey(rec.uid, rec.chat)); return "skipped"; }
  // Only while the chat is idle (and not waiting on a card): else it waits, and after CRON_LATE_MS it is skipped.
  const busy = meta.status === "running" || meta.status === "starting" || !!meta.parked;
  if (busy) return now - due.at > CRON_LATE_MS ? skip("the chat was busy for 30 minutes.") : "waiting";
  const res = await deps.coder(new Request("https://gofarther.dev/api/coder/projects/" + rec.chat + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: cronRunText(due.kind, due.it), effort: L.effort }) }), { id: rec.uid, email: rec.email }).catch(() => null);
  if (res && res.status === 200) { d.runs++; onward(); await writeCrons(bucket, rec.uid, rec.email, rec.chat, d); return "started"; }
  return now - due.at > CRON_LATE_MS ? skip("its run could not start.") : "waiting";
}

/** A cloud scheduled task's run: a new chat on its repository, its prompt sent there (one late run, then the next from now). */
export async function startTrigger(env, bucket, deps, rec, t, due, L = cronLimits(env), now = Date.now(), manual = false) {
  const log = (result, extra = {}) => { due.runs = [...(due.runs || []), { at: now, result, ...extra }].slice(-20); };
  if (!manual) due.next = nextCron(due.cron, now);
  dayCount(t, now);
  if (t.runs >= L.runsPerDay) { log("skipped", { why: "already " + L.runsPerDay + " cloud scheduled runs today (UTC)" }); await writeTriggers(bucket, rec.uid, rec.email, t); return null; }
  const user = { id: rec.uid, email: rec.email };
  const call = (path, body) => deps.coder(new Request("https://gofarther.dev/api/coder/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), user).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
  const made = await call("projects", { repo: due.repo }).catch(() => ({ status: 0, data: {} }));
  const chat = made.status === 200 && made.data && made.data.project ? String(made.data.project.id || "") : "";
  if (!chat) { log("failed", { why: String((made.data && made.data.error) || "the chat could not be opened").slice(0, 200) }); await writeTriggers(bucket, rec.uid, rec.email, t); return null; }
  const sent = await call("projects/" + chat + "/message", { text: cronRunText("trigger", due), effort: due.effort || L.effort }).catch(() => ({ status: 0 }));
  t.runs++;
  log(sent.status === 200 ? "started" : "failed", { chat });
  await writeTriggers(bucket, rec.uid, rec.email, t);
  return sent.status === 200 ? chat : null;
}

/** Runs remote_trigger asked for with action "run", after the turn is saved. */
export async function runTriggersNow(env, bucket, deps, uid, email, ids, now = Date.now()) {
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, 3)) {
    const t = await readTriggers(bucket, uid);
    const it = t.items.find((x) => x.id === id);
    if (it) await startTrigger(env, bucket, deps, { uid, email }, t, it, cronLimits(env), now, true).catch(() => null);
  }
}
export { CRON_ID };
