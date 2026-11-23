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

import { ghEventMatches, ghSourceOf } from "../container/coder-schedule.mjs";
import { cleanCron, cleanWake, cleanTrigger, nextCron, cronLimits, cronRunText, zoneOf, triggerView, cronJob, cronWords, iso, CRON_ID, TRIGGER_ID, HOOK_RX, HOOKS_PER_TRIGGER } from "../container/coder-schedule.mjs";

export const CRON_DUE = "coder/cron-due/", TRIGGER_DUE = "coder/trigger-due/", TRIGGER_HOOKS = "coder/trigger-hooks/", TRIGGER_GH = "coder/trigger-gh/";
/** Where a repository's GitHub event sources are listed. */
export const ghIndexKey = (repo) => TRIGGER_GH + String(repo).toLowerCase().replace("/", "__") + ".json";
/** A webhook trigger's call: its body at most this big; and at most one call a minute per task. */
export const TRIGGER_HOOK_BODY_MAX = 64 * 1024, TRIGGER_HOOK_GAP_MS = 60 * 1000;
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
  const next = [...data.items.map((c) => c.fire ?? c.next), ...(data.wake ? [data.wake.at] : [])].filter(Number.isFinite).reduce((m, t) => (m === null || t < m ? t : m), null);
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
export async function cronTurnOn(env, bucket, uid, chat, zone = "") {
  const c = await readCrons(bucket, uid, chat), t = await readTriggers(bucket, uid);
  return { crons: c.items, wake: c.wake, triggers: t.items, limits: cronLimits(env), zone: zoneOf(zone), base: publicBase(env), logs: await runLogs(bucket, uid, t.items) };
}
export const publicBase = (env) => String((env && env.CODER_PUBLIC_URL) || "https://gofarther.dev").replace(/\/+$/, "");

/** RUN LOGS FOR get_run_log: for each cloud scheduled task's latest 3 runs, its chat in lines (what was asked, said, run). */
export const LOG_LINES = 120, LOG_RUNS = 3;
export async function runLogs(bucket, uid, triggers) {
  const out = {};
  let budget = 200_000;
  for (const t of triggers) for (const r of (t.runs || []).filter((x) => x.chat).slice(-LOG_RUNS)) {
    if (budget <= 0 || !CHAT.test(r.chat)) continue;
    const ev = await getJson(bucket, ["coder", uid, r.chat, "events.json"].join("/"), []);
    const lines = (Array.isArray(ev) ? ev : []).map(logLine).filter(Boolean).slice(-LOG_LINES);
    budget -= lines.reduce((n, l) => n + l.length, 0);
    out[r.chat] = lines;
  }
  return out;
}
const logLine = (e) => {
  if (!e || typeof e !== "object") return "";
  const at = Number.isFinite(e.at) ? new Date(e.at).toISOString().slice(11, 19) + " " : "";
  const cut = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (e.type === "user") return at + "user: " + cut(e.text);
  if (e.type === "text") return at + "assistant: " + cut(e.text);
  if (e.type === "bash") return at + "tool " + cut(e.tool || "bash") + ": " + cut((e.verb ? e.verb + " " : "") + (e.command || ""));
  if (e.type === "note" || e.type === "error") return at + e.type + ": " + cut(e.text || e.error);
  if (e.type === "done" || e.type === "end") return at + "turn ended" + (e.status ? " (" + cut(e.status) + ")" : "");
  return "";
};

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
      const next = nextCron(c.cron, now, c.tz);
      if (next === null) continue;
      const kept = cleanCron({ ...c, next, at: now, ...(c.recurring ? { expires: Math.min(Number(c.expires) || Infinity, now + 7 * 86400000) } : {}) });
      if (kept) d.items.push(kept);
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
        const it = cleanTrigger({ ...o.trigger, repo: (o.trigger && o.trigger.repo) || repo, id, at: now, runs: [], hooks: [] });
        if (!it) continue;
        it.next = it.enabled ? nextCron(it.cron, now, it.tz) : null;
        t.items.push(it); out.triggers++;
      } else if (o.op === "update") {
        const i = t.items.findIndex((x) => x.id === id);
        if (i < 0) continue;
        const it = cleanTrigger({ ...t.items[i], ...(o.trigger || {}), id, at: t.items[i].at, runs: t.items[i].runs, hooks: t.items[i].hooks });
        if (!it) continue;
        it.next = it.enabled ? nextCron(it.cron, now, it.tz) : null;
        t.items[i] = it; out.triggers++;
      } else if (o.op === "hook") {
        // A WEBHOOK TRIGGER (create_webhook_trigger): an inbound address; its secret is made by the owner on the page.
        const it = t.items.find((x) => x.id === id), hook = String(o.hook || "");
        if (!it || !HOOK_RX.test(hook) || it.hooks.length >= HOOKS_PER_TRIGGER || it.hooks.some((h) => h.id === hook)) continue;
        const gh = o.source === "github" ? ghSourceOf(o) : null;
        const src = gh && gh.source === "github" ? { id: hook, at: now, ...gh } : null;
        if (o.source === "github" && !src) continue;
        it.hooks.push(src || { id: hook, at: now });
        await putJson(bucket, TRIGGER_HOOKS + hook + ".json", { uid, email: String(email || ""), trigger: id, hash: "", ...(src ? { source: "github", repo: src.repo } : {}) });
        // (A GitHub event source: listed under its repository, for Coder's GitHub App webhook to find: githubTriggerEvent.)
        if (src) { const k = ghIndexKey(src.repo); const list = await getJson(bucket, k, []); await putJson(bucket, k, [...(Array.isArray(list) ? list : []).filter((x) => x && x.hook !== hook), { uid, email: String(email || ""), trigger: id, hook }].slice(-200)); }
        out.triggers++;
      } else if (o.op === "run" && t.items.some((x) => x.id === id)) out.runs.push({ id, text: typeof o.text === "string" ? o.text.slice(0, 4000) : "" });
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
  const cands = [...d.items.filter((c) => (c.fire ?? c.next) <= now).map((c) => ({ kind: "cron", it: c, at: c.fire ?? c.next })), ...(d.wake && d.wake.at <= now ? [{ kind: "wake", it: d.wake, at: d.wake.at }] : [])].sort((a, b) => a.at - b.at);
  const due = cands[0];
  if (!due) { await writeCrons(bucket, rec.uid, rec.email, rec.chat, d); return "none"; }
  // Its next time, or gone: a one-shot cron and a wake-up after one run; a recurring cron after its final run past its 7 days.
  const onward = () => {
    if (due.kind === "wake") { d.wake = null; return; }
    // (From its cron time or now, whichever is later: a run that starts early, as "*/5" does, isn't run twice.)
    const c = due.it, next = nextCron(c.cron, Math.max(now, c.next), c.tz);
    if (!c.recurring || next === null || (Number.isFinite(c.expires) && now >= c.expires)) d.items = d.items.filter((x) => x !== c);
    else { c.next = next; Object.assign(c, cleanCron(c) || {}); }
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
export async function startTrigger(env, bucket, deps, rec, t, due, L = cronLimits(env), now = Date.now(), manual = false, given = null) {
  const via = given && given.via ? given.via : manual ? "run" : "schedule";
  const viaWords = via === "webhook" ? "a call to its web address" : via === "github" ? "a GitHub event" + (given && given.event ? " (" + given.event + ")" : "") : "started by hand";
  const log = (result, extra = {}) => { due.runs = [...(due.runs || []), { at: now, result, via, ...extra }].slice(-50); };
  if (!manual) due.next = nextCron(due.cron, now, due.tz);
  dayCount(t, now);
  if (t.runs >= L.runsPerDay) { log("skipped", { why: "already " + L.runsPerDay + " cloud scheduled runs today (UTC)" }); await writeTriggers(bucket, rec.uid, rec.email, t); return null; }
  const user = { id: rec.uid, email: rec.email };
  const call = (path, body) => deps.coder(new Request("https://gofarther.dev/api/coder/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), user).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
  const made = await call("projects", { repo: due.repo }).catch(() => ({ status: 0, data: {} }));
  const chat = made.status === 200 && made.data && made.data.project ? String(made.data.project.id || "") : "";
  if (!chat) { log("failed", { why: String((made.data && made.data.error) || "the chat could not be opened").slice(0, 200) }); await writeTriggers(bucket, rec.uid, rec.email, t); return null; }
  const sent = await call("projects/" + chat + "/message", { text: cronRunText("trigger", due, via === "schedule" ? "" : { via: viaWords, text: (given && given.text) || "" }), effort: due.effort || L.effort }).catch(() => ({ status: 0 }));
  t.runs++;
  log(sent.status === 200 ? "started" : "failed", { chat });
  await writeTriggers(bucket, rec.uid, rec.email, t);
  return sent.status === 200 ? chat : null;
}

/** Runs remote_trigger asked for with action "run", after the turn is saved. */
export async function runTriggersNow(env, bucket, deps, uid, email, ids, now = Date.now()) {
  for (const r of (Array.isArray(ids) ? ids : []).slice(0, 3)) {
    const id = typeof r === "string" ? r : r && r.id;
    const t = await readTriggers(bucket, uid);
    const it = t.items.find((x) => x.id === id);
    if (it) await startTrigger(env, bucket, deps, { uid, email }, t, it, cronLimits(env), now, true, { via: "run", text: (r && r.text) || "" }).catch(() => null);
  }
}

const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))))].map((b) => b.toString(16).padStart(2, "0")).join("");
const sameHex = (a, b) => { a = String(a); b = String(b); if (!a || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * A CALL TO A CLOUD SCHEDULED TASK'S WEB ADDRESS (create_webhook_trigger; Claude Code's API trigger, "/fire"): POST with
 * Authorization: Bearer <token> and an optional JSON body { text }, handed to the run as a literal string. It starts a run
 * as a scheduled one does: a new chat, at the task's effort, counted in the same runs a day; at most one a minute a task.
 */
export async function triggerHookCall(request, env, deps, hook, now = Date.now()) {
  const bucket = env.CODER_BUCKET;
  const no = (status, message) => reply({ error: { message } }, status);
  if (!HOOK_RX.test(String(hook || ""))) return no(404, "There is no scheduled task at this address.");
  const rec = await getJson(bucket, TRIGGER_HOOKS + hook + ".json", null);
  if (!rec || typeof rec.uid !== "string" || !/^[\w-]{1,100}$/.test(rec.uid)) return no(404, "There is no scheduled task at this address.");
  const raw = await request.text();
  if (raw.length > TRIGGER_HOOK_BODY_MAX) return no(413, "The call's body is over 64 KB.");
  const token = /^Bearer\s+(\S+)$/i.exec(String(request.headers.get("authorization") || ""));
  if (!rec.hash || !token || !sameHex(await sha256(token[1]), rec.hash)) return no(401, "The token is missing or wrong: send it as Authorization: Bearer <token> (the owner makes it on gofarther.dev, Schedules).");
  const t = await readTriggers(bucket, rec.uid);
  const it = t.items.find((x) => x.id === rec.trigger);
  const h = it && it.hooks.find((x) => x.id === hook);
  if (!it || !h) { await drop(bucket, TRIGGER_HOOKS + hook + ".json"); return no(404, "There is no scheduled task at this address."); }
  if (!it.enabled) return no(409, "“" + it.name + "” is turned off.");
  const last = (it.runs || []).filter((r) => r.via === "webhook").at(-1);
  if (last && now - last.at < TRIGGER_HOOK_GAP_MS) return no(429, "At most one call a minute starts a run of this task.");
  dayCount(t, now);
  if (t.runs >= cronLimits(env).runsPerDay) return no(429, "The cloud scheduled tasks have already run their most for today (UTC).");
  let text = "";
  if (raw.trim()) { try { const b = JSON.parse(raw); text = b && typeof b.text === "string" ? b.text : raw; } catch { text = raw; } }
  h.calls = (h.calls || 0) + 1;
  const chat = await startTrigger(env, bucket, deps, rec, t, it, cronLimits(env), now, true, { via: "webhook", text: text.slice(0, 4000) });
  return chat ? reply({ type: "routine_fire", claude_code_session_id: chat, claude_code_session_url: publicBase(env) + "/?chat=" + chat }) : no(502, "The run could not start; see the task's runs on gofarther.dev.");
}

/**
 * THE PAGE'S SCHEDULES VIEW (signed in): GET schedules?chat=<id> lists the chat's crons and wake-up and the owner's cloud
 * scheduled tasks; POST cancels a cron (cancel), stops the wake-up (stopWake), turns a task off or on (trigger, enabled),
 * deletes a task (trigger, remove) or a web address (hook, remove), or makes a web address's token (hook, token: shown once).
 */
export async function schedulesRoute(request, env, uid, email, url, now = Date.now()) {
  const bucket = env.CODER_BUCKET;
  const chat = String(url.searchParams.get("chat") || "");
  const view = async () => {
    const c = CHAT.test(chat) ? await readCrons(bucket, uid, chat) : { items: [], wake: null };
    const t = await readTriggers(bucket, uid);
    return { ok: true, crons: c.items.map((x) => ({ ...cronJob(x, now), tz: x.tz, next: iso(Math.max(now, x.fire ?? x.next), x.tz) })), wake: c.wake ? { at: c.wake.at, reason: c.wake.reason } : null, triggers: t.items.map((x) => ({ ...triggerView(x, publicBase(env)), runs: x.runs.slice(-5).reverse().map((r) => ({ at: r.at, result: r.result, via: r.via || "", chat: r.chat || "" })), hooks: x.hooks.map((h) => (h.source === "github" ? { id: h.id, source: "github", repo: h.repo, events: h.events, calls: h.calls || 0 } : { id: h.id, url: publicBase(env) + "/api/coder/trigger-hook/" + h.id, hasToken: !!h.tokenAt, calls: h.calls || 0 })) })) };
  };
  if (request.method === "GET") return reply(await view());
  if (request.method !== "POST") return reply({ error: "method" }, 405);
  let b = {}; try { b = await request.json(); } catch { b = {}; }
  if (typeof b.cancel === "string" || b.stopWake === true) {
    if (!CHAT.test(chat)) return reply({ error: "no such chat" }, 404);
    const d = await readCrons(bucket, uid, chat);
    if (typeof b.cancel === "string") d.items = d.items.filter((x) => x.id !== b.cancel);
    if (b.stopWake === true) d.wake = null;
    await writeCrons(bucket, uid, email, chat, d);
    return reply(await view());
  }
  const t = await readTriggers(bucket, uid);
  const it = t.items.find((x) => x.id === b.trigger);
  if (!it) return reply({ error: "no such scheduled task" }, 404);
  let token = "";
  if (typeof b.hook === "string") {
    const h = it.hooks.find((x) => x.id === b.hook);
    if (!h) return reply({ error: "no such web address" }, 404);
    if (b.remove === true) { it.hooks = it.hooks.filter((x) => x !== h); await drop(bucket, TRIGGER_HOOKS + h.id + ".json"); }
    else if (b.token === true) {
      const a = new Uint8Array(32); crypto.getRandomValues(a);
      token = "gfh_" + [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
      await putJson(bucket, TRIGGER_HOOKS + h.id + ".json", { uid, email: String(email || ""), trigger: it.id, hash: await sha256(token) });
      h.tokenAt = now;
    }
  } else if (b.remove === true) {
    for (const h of it.hooks) await drop(bucket, TRIGGER_HOOKS + h.id + ".json");
    t.items = t.items.filter((x) => x !== it);
  } else if (typeof b.enabled === "boolean") { it.enabled = b.enabled; it.next = it.enabled ? nextCron(it.cron, now, it.tz) : null; }
  await writeTriggers(bucket, uid, email, t);
  return reply({ ...(await view()), ...(token ? { token } : {}) });
}

export { CRON_ID };

/** A GitHub event, said for the run it starts (data, not instructions): repository, event, action, number, title, who, link. */
export function ghEventText(event, p) {
  const x = p && typeof p === "object" ? p : {};
  const item = x.pull_request || x.issue || x.release || x.workflow_run || x.check_run || x.discussion || null;
  const lines = ["repository: " + String((x.repository && x.repository.full_name) || ""), "event: " + event + (x.action ? "." + x.action : "")];
  if (item && item.number) lines.push("number: " + item.number);
  if (item && (item.title || item.name)) lines.push("title: " + String(item.title || item.name).slice(0, 300));
  if (event === "push") lines.push("ref: " + String(x.ref || ""), "commits: " + (Array.isArray(x.commits) ? x.commits.length : 0), "head: " + String((x.head_commit && x.head_commit.message) || "").split("\n")[0].slice(0, 200));
  if (x.sender && x.sender.login) lines.push("by: " + x.sender.login);
  const link = (item && item.html_url) || (x.compare) || "";
  if (link) lines.push("link: " + String(link).slice(0, 300));
  if (x.comment && x.comment.body) lines.push("comment: " + String(x.comment.body).slice(0, 2000));
  return lines.join("\n").slice(0, 4000);
}

/**
 * A GITHUB EVENT FOR CLOUD SCHEDULED TASKS (create_webhook_trigger with source "github"; called from Coder's GitHub App webhook,
 * src/coder-mentions.mjs, once its signature is checked): each task listed for the repository whose events match starts one
 * run, as a scheduled one does (a new chat, the task's effort, the same runs a day; at most one a minute a task). Returns the
 * chats started.
 */
export async function githubTriggerEvent(env, deps, event, p, now = Date.now()) {
  const bucket = env.CODER_BUCKET;
  const repo = p && p.repository && typeof p.repository.full_name === "string" ? p.repository.full_name : "";
  if (!bucket || !repo || !event || event === "ping") return [];
  const k = ghIndexKey(repo);
  const list = await getJson(bucket, k, []);
  if (!Array.isArray(list) || !list.length) return [];
  const action = typeof p.action === "string" ? p.action : "";
  const keep = [], started = [];
  for (const rec of list.slice(0, 200)) {
    if (!rec || typeof rec.uid !== "string" || !/^[\w-]{1,100}$/.test(rec.uid)) continue;
    const t = await readTriggers(bucket, rec.uid);
    const it = t.items.find((x) => x.id === rec.trigger);
    const h = it && it.hooks.find((x) => x.id === rec.hook && x.source === "github");
    if (!it || !h || String(h.repo).toLowerCase() !== repo.toLowerCase()) continue;
    keep.push(rec);
    if (!it.enabled || !ghEventMatches(h.events, event, action)) continue;
    const last = (it.runs || []).filter((r) => r.via === "github").at(-1);
    if (last && now - last.at < TRIGGER_HOOK_GAP_MS) continue;
    dayCount(t, now);
    if (t.runs >= cronLimits(env).runsPerDay) continue;
    h.calls = (h.calls || 0) + 1;
    const chat = await startTrigger(env, bucket, deps, rec, t, it, cronLimits(env), now, true, { via: "github", event: event + (action ? "." + action : ""), text: ghEventText(event, p) }).catch(() => null);
    if (chat) started.push(chat);
  }
  if (keep.length !== list.length) await putJson(bucket, k, keep);
  return started;
}
