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
