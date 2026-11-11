// A JOB KEEPS GOING WHEN THE TAB CLOSES (like Claude Code, whose web sessions
// run on after the browser is closed; the owner's screenshots, 2026-11-06:
// "Finish all this", item 1 "Closing the tab").
//
// Coder's machine sleeps after 10 quiet minutes, and a finished job is only
// saved (pushed to its branch, its chat kept) when someone asks for its state.
// Before this, that someone was always an open tab. Now each job is put on a
// watch list when it starts, and the Worker's every-minute run asks for the
// state of each one on it: that keeps the machine awake while the job works,
// and saves the job when it ends, exactly as an open tab would (the same route,
// so a tab and this run never save a job twice: the machine hands its end out
// once). A job leaves the list when it has ended, or after WATCH_MAX_MS.

/** Where the watch list lives in Coder's storage: one small record per running job. */
export const WATCH_PREFIX = "coder/running-jobs/";
/** A job may work for 45 minutes after a setup of up to 5; after 2 hours it is no longer kept awake. */
export const WATCH_MAX_MS = 2 * 60 * 60 * 1000;
/** Asking for the state from past the end: the answer carries no steps, only whether it still runs. */
const PAST_END = 1_000_000_000;
/** How many jobs are asked about at once. */
const AT_ONCE = 5;

/** The record of one job: a chat's turn, so a new message never removes the watch of the next. */
export const watchKey = (uid, id, turn) => WATCH_PREFIX + uid + "__" + id + "__" + Number(turn) + ".json";

/** Put a job that just started on the watch list. */
export async function watchJob(bucket, { uid, email, id, turn }, now = Date.now()) {
  await bucket.put(watchKey(uid, id, turn), JSON.stringify({ uid, email: String(email || ""), id, turn: Number(turn), at: now }), { httpMetadata: { contentType: "application/json" } });
}

async function readJson(bucket, key) {
  const o = await bucket.get(key);
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch { return null; }
}

/**
 * EVERY MINUTE: ask for the state of each job on the watch list, as its owner,
 * through Coder's own route (`deps.coder(request, user)`), and take off the list
 * the jobs that have ended. Answers `{ checked, ended }`.
 */
export async function runWatchedJobs(env, deps, now = Date.now()) {
  const bucket = env.CODER_BUCKET;
  const keys = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: WATCH_PREFIX, cursor });
    for (const o of page.objects || []) keys.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  let checked = 0, ended = 0;
  const one = async (key) => {
    const job = await readJson(bucket, key);
    // A broken record, or a job past its time: no longer kept awake.
    if (!job || typeof job.uid !== "string" || typeof job.id !== "string" || !(now - Number(job.at) < WATCH_MAX_MS)) { await bucket.delete(key); ended++; return; }
    const res = await deps.coder(new Request("https://gofarther.dev/api/coder/projects/" + encodeURIComponent(job.id) + "/state?since=" + PAST_END), { id: job.uid, email: job.email }).catch(() => null);
    const st = res ? await res.json().catch(() => null) : null;
    checked++;
    // No answer this minute: asked again next minute (the route frees a chat whose machine stays silent).
    if (!st) return;
    const project = st.project && typeof st.project === "object" ? st.project : null;
    // Still working on this message: kept on the list. A later message has its own record.
    const going = (st.running === true || (project && project.status === "running")) && !(project && Number(project.turn) > job.turn);
    if (going) return;
    await bucket.delete(key);
    ended++;
  };
  for (let i = 0; i < keys.length; i += AT_ONCE) await Promise.all(keys.slice(i, i + AT_ONCE).map((k) => one(k).catch(() => {})));
  return { checked, ended };
}

// ── NEVER ASLEEP WITH WORK ON IT (2026-11-06) ───────────────────────────────
// The old builder's way (its container-hold.mjs; the owner: "we had something
// like that on the previous builder"), and like Claude Code's cloud sessions,
// which stay up while they work and pause after a few quiet minutes. When
// Coder's machine has had no request for 10 minutes, the container library is
// about to stop it; first the machine is asked whether it has work (its /busy),
// and it stays awake while a job is working, or has ended and is not saved yet.
// The every-minute run above stays: it is what saves a job when no tab is open.

/** A working job keeps its machine awake for 2 hours at most (it works for 45 minutes at most). */
export const HOLD_MAX_MS = WATCH_MAX_MS;
/** An ended job waits at most 30 minutes to be saved (the every-minute run saves it within a minute). */
export const SAVE_WAIT_MS = 30 * 60 * 1000;
/**
 * A BACKGROUND COMMAND STILL RUNNING after Coder's answer keeps its machine awake too (tool 4, part 2: like Claude Code's, it
 * goes on until it ends, is stopped, or reaches its time limit, 2 hours at most), and one that ended keeps it awake until
 * Coder is told (the every-minute run starts that turn within a minute or two).
 */
export const BG_HOLD_MS = 2 * 60 * 60 * 1000 + 5 * 60 * 1000;
export const TELL_WAIT_MS = 15 * 60 * 1000;
/** How long the machine has to say whether it is busy: it answers at once unless it is stuck. */
export const BUSY_PROBE_MS = 5000;

const count = (v) => Number.isInteger(v) && v > 0;
const ms = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Should this machine stay awake, given its /busy answer (null when it could
 * not be asked)? Strict on purpose, like the old builder's: no answer, a
 * strange answer, an idle machine or work past its time all let it sleep, so a
 * stuck machine never stays up (and costs) for good. Answers `{ hold, why }`.
 */
export function holdDecision(state) {
  if (!state || typeof state !== "object") return { hold: false, why: "no-answer" };
  if (count(state.working)) {
    if (!ms(state.workingMs)) return { hold: false, why: "unreadable" };
    if (state.workingMs <= HOLD_MAX_MS) return { hold: true, why: "working" };
  }
  if (count(state.unsaved)) {
    if (!ms(state.unsavedMs)) return { hold: false, why: "unreadable" };
    if (state.unsavedMs <= SAVE_WAIT_MS) return { hold: true, why: "unsaved" };
  }
  if (count(state.background)) {
    if (!ms(state.backgroundMs)) return { hold: false, why: "unreadable" };
    // (Up to the limit the machine says it has, as the owner set it in Settings; 2 hours unless raised.)
    if (state.backgroundMs <= (ms(state.bgMaxMs) ? bgHoldFor(state.bgMaxMs) : BG_HOLD_MS)) return { hold: true, why: "background" };
  }
  if (count(state.untold)) {
    if (!ms(state.untoldMs)) return { hold: false, why: "unreadable" };
    if (state.untoldMs <= TELL_WAIT_MS) return { hold: true, why: "untold" };
  }
  return { hold: false, why: count(state.working) || count(state.unsaved) || count(state.background) || count(state.untold) ? "stuck" : "idle" };
}

// ── BACKGROUND COMMANDS AFTER THE ANSWER (tool 4, part 2; the owner, 2026-11-09: "do all of those") ──
// Like Claude Code's: a background command goes on after Coder's answer, until it ends, is stopped, or reaches its time
// limit, and Coder is told when it ends; with nothing else going on, a turn is started to tell it (Claude Code "re-invokes
// you when it exits"). A chat whose job ended with background commands still running is on this second list; the
// every-minute run asks its machine about them (through Coder's own route, as the chat's owner) and starts that turn.

/** Where the list lives: one small record per chat. */
export const BG_PREFIX = "coder/background-watch/";
/** A chat stays on it 2 hours and 15 minutes at most (a background command's longest time limit is 2 hours). */
export const BG_WATCH_MAX_MS = 2 * 60 * 60 * 1000 + 15 * 60 * 1000;
export const bgKey = (uid, id) => BG_PREFIX + uid + "__" + id + ".json";

/** Put a chat on it (again: the time counts from its last job's end). */
export async function watchBackground(bucket, { uid, email, id, maxMs = 0 }, now = Date.now()) {
  await bucket.put(bgKey(uid, id), JSON.stringify({ uid, email: String(email || ""), id, at: now, ...(bgWatchFor(maxMs) !== BG_WATCH_MAX_MS ? { max: bgWatchFor(maxMs) } : {}) }), { httpMetadata: { contentType: "application/json" } });
}
/**
 * THE LONGEST A BACKGROUND COMMAND MAY RUN, AS THE OWNER SET IT (Settings, 2026-11-10): 2 hours unless raised, 24 at most.
 * A chat stays on the list that long and 15 minutes more; its machine is kept awake that long and 5 minutes more.
 */
export const BG_MAX_CAP_MS = 24 * 60 * 60 * 1000;
const bgMaxOf = (ms) => (typeof ms === "number" && Number.isFinite(ms) && ms > 2 * 60 * 60 * 1000 ? Math.min(BG_MAX_CAP_MS, ms) : 2 * 60 * 60 * 1000);
export const bgWatchFor = (ms) => bgMaxOf(ms) + 15 * 60 * 1000;
export const bgHoldFor = (ms) => bgMaxOf(ms) + 5 * 60 * 1000;

/**
 * EVERY MINUTE: for each chat on the list, its background commands (GET …/background). One that ended and Coder was not told
 * of, while the chat has no job running: a turn is started to tell it (POST …/message with fromBackground). A chat with none
 * left leaves the list. Answers `{ checked, woken, left }`.
 */
export async function runBackgroundJobs(env, deps, now = Date.now()) {
  const bucket = env.CODER_BUCKET;
  const keys = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: BG_PREFIX, cursor });
    for (const o of page.objects || []) keys.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  let checked = 0, woken = 0, left = 0;
  const one = async (key) => {
    const rec = await readJson(bucket, key);
    if (!rec || typeof rec.uid !== "string" || typeof rec.id !== "string" || !(now - Number(rec.at) < (typeof rec.max === "number" ? Math.min(rec.max, bgWatchFor(BG_MAX_CAP_MS)) : BG_WATCH_MAX_MS))) { await bucket.delete(key); left++; return; }
    const user = { id: rec.uid, email: rec.email };
    const base = "https://gofarther.dev/api/coder/projects/" + encodeURIComponent(rec.id);
    const res = await deps.coder(new Request(base + "/background"), user).catch(() => null);
    const st = res ? await res.json().catch(() => null) : null;
    checked++;
    if (res && res.status === 404) { await bucket.delete(key); left++; return; }
    if (!st || st.ok !== true) return;
    const running = st.running === true || (st.project && st.project.status === "running");
    if (Number(st.untold) > 0 && !running) {
      const r = await deps.coder(new Request(base + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromBackground: true }) }), user).catch(() => null);
      if (r && r.status === 200) woken++;
      return;
    }
    // (A chat stays while an asyncRewake hook of its runs: it may wake it.)
    if (!(Array.isArray(st.background) && st.background.length) && !(Number(st.untold) > 0) && !(Number(st.hooks) > 0)) { await bucket.delete(key); left++; }
  };
  for (let i = 0; i < keys.length; i += AT_ONCE) await Promise.all(keys.slice(i, i + AT_ONCE).map((k) => one(k).catch(() => {})));
  return { checked, woken, left };
}
