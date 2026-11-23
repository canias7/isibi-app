// CLAUDE CODE'S SCHEDULING TOOLS IN CODER (2026-11-23): CronCreate, CronDelete and CronList (prompts scheduled in this chat),
// ScheduleWakeup (the self-paced /loop) and RemoteTrigger (cloud scheduled tasks that start a new chat on a schedule; it backs
// /schedule), as cron_create, cron_delete, cron_list, schedule_wakeup and remote_trigger. Claude Code's tools reference,
// scheduled-tasks.md, routines.md and its Agent SDK's input types.
//
// Shared by Coder's machine (the tools check what Grok asked and answer in words; what changed goes back with the turn's
// result) and Coder's Worker (src/coder-schedules.mjs keeps them and starts each run from its every-minute check). Only what
// Cloudflare's Workers have: no Node APIs.
//
// COST (CLAUDE.md: no paid run without the owner's approval): every run is a Grok call, so there are caps, each one the owner
// can change with a Worker variable: at most CRON_MAX active crons a chat, a cron at most once a minute, a cloud scheduled
// task at most once an hour, at most RUNS_PER_DAY scheduled runs a day per chat (UTC), and every run at effort Low.

import { localParts, zoned } from "./gloopy-schedule.mjs";

export const CRON_DEFAULTS = Object.freeze({ max: 10, minMinutes: 1, runsPerDay: 24, triggerMinHours: 1, triggerMax: 10, effort: "low" });
/** Claude Code: "Recurring tasks automatically expire 7 days after creation. The task fires one final time, then deletes itself." */
export const RECURRING_DAYS = 7;
/** Claude Code: "The runtime clamps delaySeconds to between 60 and 3600 seconds." */
export const WAKE_MIN_S = 60, WAKE_MAX_S = 3600;
export const CRON_ID = /^[0-9a-f]{8}$/;
export const TRIGGER_ID = /^trig_[0-9a-z]{12}$/;
export const EFFORTS = Object.freeze(["low", "medium", "high"]);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

const posInt = (v, d, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
/** The caps, from the Worker's variables (CODER_CRON_MAX, CODER_CRON_MIN_MINUTES, CODER_CRON_RUNS_PER_DAY, CODER_TRIGGER_MIN_HOURS, CODER_TRIGGER_MAX, CODER_CRON_EFFORT), else the defaults. */
export function cronLimits(env = {}) {
  const e = env && typeof env === "object" ? env : {};
  const d = CRON_DEFAULTS;
  const effort = String(e.CODER_CRON_EFFORT || "").trim().toLowerCase();
  return { max: posInt(e.CODER_CRON_MAX, d.max, 1, 50), minMinutes: posInt(e.CODER_CRON_MIN_MINUTES, d.minMinutes, 1, 1440), runsPerDay: posInt(e.CODER_CRON_RUNS_PER_DAY, d.runsPerDay, 1, 500), triggerMinHours: posInt(e.CODER_TRIGGER_MIN_HOURS, d.triggerMinHours, 1, 168), triggerMax: posInt(e.CODER_TRIGGER_MAX, d.triggerMax, 1, 50), effort: EFFORTS.includes(effort) ? effort : d.effort };
}
/** Caps sent with a turn, checked again (the machine never takes them on trust beyond these bounds). */
export const limitsOf = (x) => (x && typeof x === "object" ? cronLimits({ CODER_CRON_MAX: x.max, CODER_CRON_MIN_MINUTES: x.minMinutes, CODER_CRON_RUNS_PER_DAY: x.runsPerDay, CODER_TRIGGER_MIN_HOURS: x.triggerMinHours, CODER_TRIGGER_MAX: x.triggerMax, CODER_CRON_EFFORT: x.effort }) : cronLimits());

// ── CRON EXPRESSIONS ────────────────────────────────────────────────────────────────────────────────────────────────
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DOWS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const FIELDS = [["minute", 0, 59, null], ["hour", 0, 23, null], ["day of month", 1, 31, null], ["month", 1, 12, MONTHS], ["day of week", 0, 7, DOWS]];

function field(text, [label, lo, hi, names]) {
  const out = new Set();
  const val = (s) => {
    const k = String(s).toLowerCase();
    if (names && names.includes(k)) return names.indexOf(k) + (label === "month" ? 1 : 0);
    if (!/^\d+$/.test(k)) throw new Error("cron: " + label + " has “" + s + "”");
    const n = Number(k);
    if (n < lo || n > hi) throw new Error("cron: " + label + " must be " + lo + "-" + hi);
    return n;
  };
  for (const part of String(text).split(",")) {
    const m = /^(\*|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d+))?$/i.exec(part);
    if (!m) throw new Error("cron: " + label + " has “" + part + "”");
    const step = m[2] ? Number(m[2]) : 1;
    if (!(step >= 1)) throw new Error("cron: " + label + " step must be 1 or more");
    let a = lo, b = hi;
    if (m[1] !== "*") { const r = m[1].split("-"); a = val(r[0]); b = r.length > 1 ? val(r[1]) : m[2] ? hi : a; }
    if (a > b) throw new Error("cron: " + label + " range " + m[1] + " runs backwards");
    for (let i = a; i <= b; i += step) out.add(label === "day of week" && i === 7 ? 0 : i);
  }
  return out;
}

/** A 5-field cron expression (minute hour day-of-month month day-of-week; *, lists, ranges, steps, names), parsed, or throws with what is wrong. */
export function parseCron(expr) {
  const parts = String(expr == null ? "" : expr).trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5) throw new Error("cron: give 5 fields (minute hour day-of-month month day-of-week), like “*/5 * * * *”");
  const [min, hour, dom, month, dow] = parts.map((p, i) => field(p, FIELDS[i]));
  return { min, hour, dom, month, dow, domAll: parts[2] === "*", dowAll: parts[4] === "*", text: parts.join(" ") };
}

/** The first time the cron matches strictly after `after` (in `tz`, UTC by default), or null within a year and a day. */
export function nextCron(expr, after, tz = "UTC") {
  const c = typeof expr === "string" ? parseCron(expr) : expr;
  const start = localParts(after, tz);
  const mins = [...c.min].sort((a, b) => a - b), hours = [...c.hour].sort((a, b) => a - b);
  for (let i = 0; i < 367; i++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate(), wd = day.getUTCDay();
    if (!c.month.has(m)) continue;
    // Standard cron: with both day fields restricted, either one matching is enough.
    const dayOk = c.domAll && c.dowAll ? true : c.domAll ? c.dow.has(wd) : c.dowAll ? c.dom.has(d) : c.dom.has(d) || c.dow.has(wd);
    if (!dayOk) continue;
    for (const h of hours) for (const mi of mins) { const t = zoned(y, m, d, h, mi, tz); if (t > after) return t; }
  }
  return null;
}

/** The shortest gap, in minutes, between its next `n` runs after `from` (Infinity when it runs once or never). */
export function shortestGap(expr, from, n = 60, tz = "UTC") {
  let prev = nextCron(expr, from, tz), gap = Infinity;
  for (let i = 0; i < n && prev !== null; i++) { const t = nextCron(expr, prev, tz); if (t === null) break; gap = Math.min(gap, (t - prev) / MIN); prev = t; }
  return gap;
}

/** A cron in words where it is a common one ("every 5 minutes"), else the expression itself. */
export function cronWords(expr) {
  const p = String(expr || "").trim().split(/\s+/);
  if (p.length !== 5) return String(expr || "");
  const [mi, h, dom, mo, dow] = p;
  const rest = dom === "*" && mo === "*" && dow === "*";
  if (mi === "*" && h === "*" && rest) return "every minute";
  let m = /^\*\/(\d+)$/.exec(mi);
  if (m && h === "*" && rest) return "every " + m[1] + " minutes";
  if (/^\d+$/.test(mi) && h === "*" && rest) return "every hour at :" + mi.padStart(2, "0");
  m = /^\*\/(\d+)$/.exec(h);
  if (/^\d+$/.test(mi) && m && rest) return "every " + m[1] + " hours at :" + mi.padStart(2, "0");
  if (/^\d+$/.test(mi) && /^\d+$/.test(h) && rest) return "every day at " + h.padStart(2, "0") + ":" + mi.padStart(2, "0") + " UTC";
  if (/^\d+$/.test(mi) && /^\d+$/.test(h) && dom === "*" && mo === "*" && dow === "1-5") return "every weekday at " + h.padStart(2, "0") + ":" + mi.padStart(2, "0") + " UTC";
  return "cron “" + p.join(" ") + "” (UTC)";
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const plain = (s, max) => String(s == null ? "" : s).replace(/[\p{Cf}]/gu, "").trim().slice(0, max);
const hex = (n) => { const a = new Uint8Array(Math.ceil(n / 2)); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, n); };
const base36 = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => (b % 36).toString(36)).join(""); };

// ── CRONS (CronCreate) ──────────────────────────────────────────────────────────────────────────────────────────────
/** What cron_create was asked, checked: a kept cron { id, cron, prompt, recurring, at, next, expires? }, or throws. */
export function checkCron(raw, now = Date.now(), limits = cronLimits()) {
  const x = raw && typeof raw === "object" ? raw : {};
  const prompt = plain(x.prompt, 4000);
  if (!prompt) throw new Error("prompt: give the prompt to run each time");
  const c = parseCron(x.cron);
  const recurring = x.recurring !== false;
  const next = nextCron(c, now);
  if (next === null) throw new Error("cron: “" + c.text + "” never matches in the next year");
  if (recurring && limits.minMinutes > 1 && shortestGap(c, now) < limits.minMinutes) throw new Error("cron: at most once every " + limits.minMinutes + " minutes");
  return { id: hex(8), cron: c.text, prompt, recurring, at: now, next, ...(recurring ? { expires: now + RECURRING_DAYS * DAY } : {}) };
}

/** A kept cron, checked again (the Worker never takes one on trust): the same shape, or null. */
export function cleanCron(x) {
  if (!x || typeof x !== "object" || !CRON_ID.test(String(x.id || ""))) return null;
  try { parseCron(x.cron); } catch { return null; }
  const prompt = plain(x.prompt, 4000);
  if (!prompt || !Number.isFinite(x.next)) return null;
  return { id: x.id, cron: String(x.cron).trim().split(/\s+/).join(" "), prompt, recurring: x.recurring !== false, at: Number(x.at) || 0, next: Number(x.next), ...(x.recurring !== false && Number.isFinite(x.expires) ? { expires: Number(x.expires) } : {}) };
}

/** A wake-up (schedule_wakeup), checked: { stop: true } or { at, prompt, reason, noop? }, or throws. */
export function checkWakeup(raw, now = Date.now()) {
  const x = raw && typeof raw === "object" ? raw : {};
  if (x.stop === true) return { stop: true };
  const prompt = plain(x.prompt, 4000), reason = plain(x.reason, 300).replace(/\s+/g, " ");
  if (!prompt) throw new Error("prompt: give the prompt to run when it wakes (the /loop input, the same each time)");
  if (!reason) throw new Error("reason: say in one short sentence why this delay");
  const d = Number(x.delaySeconds);
  if (!Number.isFinite(d)) throw new Error("delaySeconds: give a number of seconds (60 to 3600)");
  const s = Math.min(WAKE_MAX_S, Math.max(WAKE_MIN_S, Math.round(d)));
  return { at: now + s * 1000, seconds: s, prompt, reason, ...(x.noop === true ? { noop: true } : {}) };
}
export const cleanWake = (w) => (w && typeof w === "object" && Number.isFinite(w.at) && plain(w.prompt, 4000) ? { at: Number(w.at), prompt: plain(w.prompt, 4000), reason: plain(w.reason, 300) } : null);

/** One cron in a line for cron_list: "abc12345 · every 5 minutes · recurring · next 2026-11-23 10:05 UTC · prompt". */
export const cronLine = (c) => [c.id, cronWords(c.cron), c.recurring ? "recurring (ends " + iso(c.expires || c.at + RECURRING_DAYS * DAY) + ")" : "one-shot", "next " + iso(c.next), "prompt: " + String(c.prompt).replace(/\s+/g, " ").slice(0, 200)].join(" · ");

// ── CLOUD SCHEDULED TASKS (RemoteTrigger) ───────────────────────────────────────────────────────────────────────────
/** The prompt of a RemoteTrigger body: `prompt`, or Claude Code's job_config.ccr.events[0].data.message.content. */
function bodyPrompt(b) {
  if (typeof b.prompt === "string") return b.prompt;
  try { const c = b.job_config.ccr.events[0].data.message.content; return typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || "").join("\n") : ""; } catch { return ""; }
}
/** A cloud scheduled task as remote_trigger create or update asks: { name, cron, prompt, repo, enabled, effort }, or throws. With `old`, an update. */
export function checkTrigger(body, now = Date.now(), limits = cronLimits(), old = null) {
  const b = body && typeof body === "object" ? body : {};
  const o = old || {};
  const name = plain(b.name ?? o.name, 80).replace(/\s+/g, " ");
  if (!name) throw new Error("body.name: give the task a short name");
  const prompt = plain(bodyPrompt(b) || o.prompt, 4000);
  if (!prompt) throw new Error("body.prompt: give the prompt each run starts its new chat with");
  const cron = String(b.cron_expression ?? b.cron ?? o.cron ?? "").trim().split(/\s+/).join(" ");
  const c = parseCron(cron);
  if (nextCron(c, now) === null) throw new Error("cron: “" + cron + "” never matches in the next year");
  if (shortestGap(c, now, 200) < limits.triggerMinHours * 60) throw new Error("cron_expression: a cloud scheduled task runs at most once every " + (limits.triggerMinHours === 1 ? "hour" : limits.triggerMinHours + " hours") + " (“" + cron + "” runs more often)");
  const repo = String(b.repo ?? o.repo ?? "").trim();
  if (repo && !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repo)) throw new Error("body.repo: owner/name of a GitHub repository");
  const effort = String(b.effort ?? o.effort ?? limits.effort).toLowerCase();
  return { name, prompt, cron: c.text, repo, enabled: b.enabled === undefined ? o.enabled !== false : b.enabled !== false, effort: EFFORTS.includes(effort) ? effort : limits.effort };
}
/** A kept cloud scheduled task checked again: { id, name, prompt, cron, repo, enabled, effort, at, next, runs }, or null. */
export function cleanTrigger(x) {
  if (!x || typeof x !== "object" || !TRIGGER_ID.test(String(x.id || ""))) return null;
  let t;
  try { t = checkTrigger(x, Number(x.at) || 0, { ...cronLimits(), triggerMinHours: 1 }); } catch { return null; }
  const runs = (Array.isArray(x.runs) ? x.runs : []).filter((r) => r && Number.isFinite(r.at)).map((r) => ({ at: r.at, result: String(r.result || "").slice(0, 20), ...(r.chat ? { chat: String(r.chat).slice(0, 80) } : {}), ...(r.why ? { why: String(r.why).slice(0, 200) } : {}) })).slice(-20);
  return { id: x.id, ...t, at: Number(x.at) || 0, next: Number.isFinite(x.next) ? Number(x.next) : null, runs };
}
export const newTriggerId = () => "trig_" + base36(12);
export const triggerView = (t) => ({ id: t.id, name: t.name, cron_expression: t.cron, schedule: cronWords(t.cron), prompt: t.prompt, repo: t.repo || "", enabled: t.enabled, effort: t.effort, next_run_at: t.enabled && t.next ? new Date(t.next).toISOString() : null });

// ── THE TOOLS, ON CODER'S MACHINE ──────────────────────────────────────────────────────────────────────────────────
const capWords = (l) => "Caps (each scheduled run is a paid model call): at most " + l.max + " active crons in this chat, at most one run a minute" + (l.minMinutes > 1 ? " (every " + l.minMinutes + " minutes)" : "") + ", at most " + l.runsPerDay + " scheduled runs a day in this chat (crons and wake-ups together; past that, runs are skipped until the next day, UTC), each run at effort " + l.effort + ".";
export const CRON_CREATE_DESCRIPTION = "Schedule a prompt to be enqueued at a future time. Use for both recurring schedules and one-shot reminders.\n\nUses standard 5-field cron in UTC: minute hour day-of-month month day-of-week. \"*/5 * * * *\" = every 5 minutes, \"30 14 28 2 *\" = Feb 28 at 2:30pm UTC once.\n\n## One-shot tasks (recurring: false)\n\nFor \"remind me at X\" or \"at <time>, do Y\" requests — fire once then auto-delete. Pin minute/hour/day-of-month/month to specific values.\n\n## Recurring jobs (recurring: true, the default)\n\nFor \"every N minutes\" / \"every hour\" / \"weekdays at 9am\" requests. Recurring tasks auto-expire after 7 days: they fire one final time, then are deleted.\n\n## How runs happen\n\nJobs live with this chat (the owner's chat on gofarther.dev; they survive the machine stopping). A run fires only while the chat is idle: one that comes due while a message is running fires once the chat is free, never once per missed time. Each run is a new message in this chat with the prompt.\n\n" + capWords(CRON_DEFAULTS) + " (The owner can change these.) `durable` is accepted; every job here is kept with the chat.\n\nReturns a job ID you can pass to cron_delete.";
export const CRON_DELETE_DESCRIPTION = "Cancel a cron job previously scheduled with cron_create. Removes it from this chat's scheduled tasks.";
export const CRON_LIST_DESCRIPTION = "List all cron jobs scheduled via cron_create in this chat (id, schedule, next run, prompt), and the pending wake-up of a self-paced loop, if any. Use the ids with cron_delete.";
export const SCHEDULE_WAKEUP_DESCRIPTION = "Schedule when to resume work in /loop dynamic mode (always pass the `prompt` arg). The owner invoked /loop without an interval, asking you to self-pace iterations of a task.\n\nPass the same /loop prompt back via `prompt` each turn so the next firing repeats the task. Call this at the end of each iteration to pick when the next one runs; omit the call to end the loop, or call it with stop: true to cancel the pending wake-up.\n\n## Picking delaySeconds\n\nClamped to [60, 3600]. Each wake-up is a new paid model call in this chat, so don't wake more often than the work needs: checking a long build, 1200-1800s; watching for something that changes every few minutes, 270s; idle with nothing to watch, 1200s or more. A wake-up that comes due while the chat is busy fires once it is free.\n\n" + capWords(CRON_DEFAULTS) + "\n\nThe `reason` is shown to the owner: one short specific sentence. Set noop: true when this wake-up found nothing new.";
export const REMOTE_TRIGGER_DESCRIPTION = "Create, update, run and list the owner's cloud scheduled tasks (formerly routines): each run starts a NEW Coder chat on its repository with the task's prompt, on a cron schedule (5-field, UTC). Backs /schedule. Use it only when the owner asks for work on a schedule that should start fresh chats (\"every weekday at 9, review open PRs\"); for repeating work in THIS chat, use cron_create.\n\nActions: list; get (trigger_id); create (body: { name, cron_expression, prompt, repo? (owner/name; this chat's repository by default), enabled?, effort? }); update (trigger_id, body with the fields to change; enabled: false pauses it); run (trigger_id: start one run now); list_runs (trigger_id). create_webhook_trigger and get_run_log are not available in Coder.\n\nCaps (each run is a paid model call): at most " + CRON_DEFAULTS.triggerMax + " cloud scheduled tasks, each at most once an hour, at most " + CRON_DEFAULTS.runsPerDay + " runs a day across them, each run at effort " + CRON_DEFAULTS.effort + " unless body.effort says otherwise. (The owner can change these.) Changes take effect when your turn ends.";

export const CRON_TOOLS = Object.freeze([
  { type: "function", function: { name: "schedule_wakeup", description: SCHEDULE_WAKEUP_DESCRIPTION, parameters: { type: "object", properties: {
    delaySeconds: { type: "number", description: "Seconds from now to wake up. Clamped to [60, 3600]." },
    reason: { type: "string", description: "One short sentence explaining the chosen delay. Shown to the owner." },
    prompt: { type: "string", description: "The /loop input to fire on wake-up. Pass the same input verbatim each turn." },
    noop: { type: "boolean", description: "true when this iteration found nothing new." },
    stop: { type: "boolean", description: "true to cancel the pending wake-up and end the self-paced loop." },
  }, required: [] } } },
  { type: "function", function: { name: "cron_create", description: CRON_CREATE_DESCRIPTION, parameters: { type: "object", properties: {
    cron: { type: "string", description: "Standard 5-field cron expression in UTC: \"M H DoM Mon DoW\" (e.g. \"*/5 * * * *\" = every 5 minutes, \"30 14 28 2 *\" = Feb 28 at 2:30pm UTC once)." },
    prompt: { type: "string", description: "The prompt to enqueue at each fire time." },
    recurring: { type: "boolean", description: "true (default) = fire on every cron match until deleted or auto-expired after 7 days. false = fire once at the next match, then auto-delete." },
    durable: { type: "boolean", description: "Accepted for Claude Code compatibility; every job is kept with this chat." },
  }, required: ["cron", "prompt"] } } },
  { type: "function", function: { name: "cron_delete", description: CRON_DELETE_DESCRIPTION, parameters: { type: "object", properties: { id: { type: "string", description: "Job ID returned by cron_create." } }, required: ["id"] } } },
  { type: "function", function: { name: "cron_list", description: CRON_LIST_DESCRIPTION, parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "remote_trigger", description: REMOTE_TRIGGER_DESCRIPTION, parameters: { type: "object", properties: {
    action: { type: "string", enum: ["list", "get", "create", "update", "run", "create_webhook_trigger", "list_runs", "get_run_log"] },
    trigger_id: { type: "string", description: "Required for get, update, run and list_runs." },
    session_id: { type: "string" },
    cursor: { type: "string" },
    body: { type: "object", description: "For create and update: { name, cron_expression, prompt, repo, enabled, effort }." },
  }, required: ["action"] } } },
]);
export const CRON_TOOL_NAMES = Object.freeze(CRON_TOOLS.map((t) => t.function.name));
export const CRON_TOOL_CC = Object.freeze({ cron_create: "CronCreate", cron_delete: "CronDelete", cron_list: "CronList", schedule_wakeup: "ScheduleWakeup", remote_trigger: "RemoteTrigger" });

/**
 * THE TURN'S SCHEDULING STATE on Coder's machine: what the chat had when the turn began (`crons`, `wake`, `triggers`, from the
 * Worker) and what this turn changed (returned with the result: cronAdds, cronRemovals, wakeup, triggerOps).
 */
export function cronState({ crons = [], wake = null, triggers = [], limits = null, repo = "" } = {}) {
  return { crons: (Array.isArray(crons) ? crons : []).map(cleanCron).filter(Boolean), wake: cleanWake(wake), triggers: (Array.isArray(triggers) ? triggers : []).map(cleanTrigger).filter(Boolean), limits: limitsOf(limits), repo: String(repo || ""), adds: [], removals: [], wakeup: undefined, triggerOps: [] };
}
/** What the turn's result carries for the Worker. */
export const cronResult = (st) => ({ ...(st.adds.length ? { cronAdds: st.adds } : {}), ...(st.removals.length ? { cronRemovals: st.removals } : {}), ...(st.wakeup !== undefined ? { wakeup: st.wakeup } : {}), ...(st.triggerOps.length ? { triggerOps: st.triggerOps } : {}) });
const liveCrons = (st) => [...st.crons.filter((c) => !st.removals.includes(c.id)), ...st.adds];
const liveTriggers = (st) => st.triggers.map((t) => { const u = st.triggerOps.filter((o) => o.op === "update" && o.id === t.id).at(-1); return u ? { ...t, ...u.trigger } : t; }).concat(st.triggerOps.filter((o) => o.op === "create").map((o) => ({ id: o.id, ...o.trigger, runs: [], next: nextCron(o.trigger.cron, Date.now()) })));

/** One scheduling tool call, answered in words (the result Grok gets). `now` for tests. */
export function cronTool(st, name, args, now = Date.now()) {
  const a = args && typeof args === "object" ? args : {};
  const L = st.limits;
  try {
    if (name === "cron_create") {
      if (liveCrons(st).length >= L.max) return "Error: this chat already has " + L.max + " scheduled tasks, the most it may have (each run is a paid model call). Delete one with cron_delete first.";
      const c = checkCron(a, now, L);
      st.adds.push(c);
      return "Scheduled " + c.id + " (" + cronWords(c.cron) + (c.recurring ? "" : ", once") + "). Next run " + iso(c.next) + "." + (c.recurring ? " Recurring: auto-expires after " + RECURRING_DAYS + " days (" + iso(c.expires) + ")." : " It deletes itself after running.") + " It runs only while this chat is idle, at effort " + L.effort + "; at most " + L.runsPerDay + " scheduled runs a day here. " + JSON.stringify({ id: c.id, durable: true });
    }
    if (name === "cron_delete") {
      const id = String(a.id || "").trim();
      const it = liveCrons(st).find((c) => c.id === id);
      if (!it) return "Error: no scheduled job with id " + id.slice(0, 20) + " in this chat (cron_list shows them).";
      if (st.adds.includes(it)) st.adds = st.adds.filter((c) => c !== it); else st.removals.push(id);
      return "Cancelled job " + id + ".";
    }
    if (name === "cron_list") {
      const list = liveCrons(st);
      const w = st.wakeup !== undefined ? (st.wakeup && !st.wakeup.stop ? st.wakeup : null) : st.wake;
      const lines = list.map(cronLine);
      if (w) lines.push("wake-up (self-paced loop) at " + iso(w.at) + ": " + String(w.reason || "").slice(0, 120));
      return lines.length ? lines.join("\n") : "No scheduled jobs.";
    }
    if (name === "schedule_wakeup") {
      const w = checkWakeup(a, now);
      if (w.stop) { const had = st.wakeup ? !st.wakeup.stop : !!st.wake; st.wakeup = { stop: true }; return had ? "Pending wakeup cancelled. The loop won't fire again." : "No pending wake-up; the loop is ended."; }
      st.wakeup = w;
      return "Next wake-up in " + w.seconds + "s, at " + iso(w.at) + (w.seconds !== Math.round(Number(a.delaySeconds)) ? " (clamped to 60-3600 seconds)" : "") + ": " + w.reason + ". It fires only when this chat is idle, at effort " + L.effort + ".";
    }
    if (name === "remote_trigger") {
      const action = String(a.action || "");
      const id = String(a.trigger_id || "").trim();
      const all = liveTriggers(st);
      const find = () => { const t = all.find((x) => x.id === id); if (!t) throw new Error("trigger_id: no cloud scheduled task " + (id ? id.slice(0, 30) : "given") + " (action list shows them)"); return t; };
      if (action === "list") return JSON.stringify({ data: all.map(triggerView) });
      if (action === "get") return JSON.stringify(triggerView(find()));
      if (action === "list_runs") return JSON.stringify({ data: (find().runs || []).slice().reverse().map((r) => ({ started_at: new Date(r.at).toISOString(), result: r.result, ...(r.chat ? { session_id: r.chat } : {}), ...(r.why ? { why: r.why } : {}) })) });
      if (action === "create") {
        if (all.length >= L.triggerMax) throw new Error("the owner already has " + L.triggerMax + " cloud scheduled tasks, the most allowed: update or disable one instead");
        const t = checkTrigger(a.body, now, L);
        if (!t.repo) t.repo = st.repo;
        if (!t.repo) throw new Error("body.repo: name the GitHub repository (owner/name) each run works in");
        const tid = newTriggerId();
        st.triggerOps.push({ op: "create", id: tid, trigger: t });
        return "Created " + tid + ": “" + t.name + "”, " + cronWords(t.cron) + ", in " + t.repo + ", each run a new chat at effort " + t.effort + (t.enabled ? "" : " (disabled)") + ". Next run " + iso(nextCron(t.cron, now)) + ". Kept when your turn ends. " + JSON.stringify({ id: tid });
      }
      if (action === "update") {
        const old = find();
        const t = checkTrigger(a.body, now, L, old);
        st.triggerOps.push({ op: "update", id: old.id, trigger: t });
        return "Updated " + old.id + ": “" + t.name + "”, " + cronWords(t.cron) + (t.enabled ? "" : ", disabled") + ". Kept when your turn ends.";
      }
      if (action === "run") {
        const t = find();
        st.triggerOps.push({ op: "run", id: t.id });
        return "Run of " + t.id + " (“" + t.name + "”) starts in a new chat when your turn ends (it counts toward the " + L.runsPerDay + " runs a day).";
      }
      if (action === "create_webhook_trigger" || action === "get_run_log") return "Error: " + action + " is not available in Coder. Use list_runs for a task's recent runs; each run is its own chat on gofarther.dev.";
      return "Error: action must be one of list, get, create, update, run, list_runs.";
    }
  } catch (e) { return "Error: " + String((e && e.message) || e).slice(0, 300); }
  return "Error: unknown scheduling tool " + String(name).slice(0, 40);
}

/** What a run of a cron, a wake-up or a cloud scheduled task sends: the prompt, with a short note of what started it. */
export function cronRunText(kind, it) {
  if (kind === "wake") return "(Self-paced /loop wake-up: " + String(it.reason || "").slice(0, 200) + ")\n\n" + it.prompt;
  if (kind === "trigger") return "(Cloud scheduled task “" + it.name + "”, " + cronWords(it.cron) + ": a new chat it started.)\n\n" + it.prompt;
  return "(Scheduled task " + it.id + ", " + cronWords(it.cron) + (it.recurring ? "" : ", once") + ".)\n\n" + it.prompt;
}
