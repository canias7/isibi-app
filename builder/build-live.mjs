// A FIRST BUILD THE BROWSER CAN FIND AGAIN (2026-10-10, the Build
// browser-reconnection gap).
//
// A first build's POST holds its socket while the build runs, and the browser
// learns the build's job id only when that POST answers. Nothing kept it: a
// reload, a closed tab or another device lost the build for good — its reply
// never shown, its result sitting uncollected, and the next message in the
// same chat sent as a fresh first build (a second, paid build when the first
// had not yet named its site). The durable build jobs were always there —
// the row (`edit_jobs`, op `build`), the R2 job, its resume record, its
// progress record and its answer — but nothing tied them to the account and
// the chat that asked.
//
// Three small records, all keyed by the signed-in account, so another
// account's builds are never in the listing at all:
//   builds-live/<uid>/<job>.json        the marker: which chat asked, in what
//                                       words, when — written at acceptance;
//   builds-live/<uid>/<job>.done.json   the build's final answer, kept when it
//                                       is written (the poll deletes the answer
//                                       slot on its first read, so a second
//                                       session could never see it);
//   builds-live/<uid>/chat-<chat>.json  the chat's running build, claimed with
//                                       a conditional write, so a second first
//                                       build for the same chat while one runs
//                                       is answered with the running one —
//                                       never started, never charged again.
//
// What a found build IS is read from the records the build already keeps,
// never guessed: the kept final answer (done or failed); the row's own
// verdict (failed, lost, cancelled — `rowVerdict`); a row with no verdict
// (running); and, with no row at all (a sandbox, or a row that could not be
// filed), running only while the marker is younger than a build can run.

import { isJobId, BUILD_JOB_MS } from "./build-job.mjs";

export const BUILD_LIVE_ROOT = "builds-live/";
export const BUILD_LIVE_VERSION = 1;
/** How long a build stays findable after it was accepted: a day, the progress records' own discovery window. */
export const BUILD_LIVE_MS = 24 * 3600 * 1000;
/** How many of the account's builds one listing reads. */
export const BUILD_LIVE_MAX = 20;

const UID_RE = /^[A-Za-z0-9-]{8,64}$/;
// THE CHAT IS THE BROWSER'S OWN PROJECT ID (`siteCreate`: `site_<ms>_<5>`);
// anything else is not keyed on, so a malformed one can never name a path.
const CHAT_RE = /^[A-Za-z0-9_-]{1,80}$/;

export const isLiveUid = (v) => typeof v === "string" && UID_RE.test(v);
export const isLiveChat = (v) => typeof v === "string" && CHAT_RE.test(v);

/** The account's prefix: every key below lives under it, and a listing reads nothing else. */
export function buildLiveRoot(uid) {
  if (!isLiveUid(uid)) throw new Error("build-live: refusing an account id we cannot key on");
  return BUILD_LIVE_ROOT + uid + "/";
}
export function buildLiveKey(uid, job) {
  if (!isJobId(job)) throw new Error("build-live: refusing a job id we did not mint");
  return buildLiveRoot(uid) + job + ".json";
}
export function buildKeptKey(uid, job) {
  if (!isJobId(job)) throw new Error("build-live: refusing a job id we did not mint");
  return buildLiveRoot(uid) + job + ".done.json";
}
export function buildChatKey(uid, chat) {
  if (!isLiveChat(chat)) throw new Error("build-live: refusing a chat id we cannot key on");
  return buildLiveRoot(uid) + "chat-" + chat + ".json";
}
/** A marker's job id from its key under the account's prefix, or "" for any other key (a kept answer, a chat claim). */
export function markerJobOf(key, uid) {
  const root = buildLiveRoot(uid);
  if (typeof key !== "string" || !key.startsWith(root)) return "";
  const rest = key.slice(root.length);
  const m = /^([0-9a-f]{32})\.json$/.exec(rest);
  return m ? m[1] : "";
}

const str = (v) => (typeof v === "string" ? v : "");
const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/**
 * How long an acceptance may take before a marker that never reached
 * "accepted", with no row behind it, is taken as abandoned (2026-10-10,
 * round 3). Acceptance is a row, an R2 object and a queue message — seconds.
 */
export const BUILD_ACCEPT_MS = 5 * 60 * 1000;

/**
 * The marker as written: the job, the account, the chat, the customer's own
 * words, and when — and how far the build got (round 3):
 *   accepted  its queue message was sent (or its job may be run by the queue):
 *             only then is it listed, so discovery never hands a browser a job
 *             that was not accepted;
 *   inline    the queue path could not take it and it runs inside its own
 *             request: never listed (there is no job to follow), but it still
 *             owns its chat until it ends.
 */
export function packBuildLive({ job, uid, chat, words = "", at, accepted = false, inline = false }) {
  return { v: BUILD_LIVE_VERSION, job, uid, chat: isLiveChat(chat) ? chat : "", words: str(words), at, ...(accepted ? { accepted: true } : {}), ...(inline ? { inline: true } : {}) };
}
/** A stored marker, read strictly: null for anything that is not one. */
export function readBuildLive(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== BUILD_LIVE_VERSION) return null;
  if (!isJobId(raw.job) || !isLiveUid(raw.uid) || num(raw.at) === null) return null;
  if (typeof raw.chat !== "string" || (raw.chat && !isLiveChat(raw.chat)) || typeof raw.words !== "string") return null;
  return { job: raw.job, uid: raw.uid, chat: raw.chat, words: raw.words, at: raw.at, accepted: raw.accepted === true, inline: raw.inline === true };
}

/** The kept final answer: its status, its body as the poll would serve it, its type, and when. */
export function packBuildDone({ status, body, type = "application/json", at }) {
  return { v: BUILD_LIVE_VERSION, status, body, type, at };
}
export function readBuildDone(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== BUILD_LIVE_VERSION) return null;
  if (!Number.isInteger(raw.status) || raw.status < 100 || raw.status > 599 || typeof raw.body !== "string") return null;
  return { status: raw.status, body: raw.body, type: str(raw.type) || "application/json", at: num(raw.at) || 0 };
}

/**
 * The chat's claim: which build owns it. `ended` is the owner's own release
 * (its job could not be stored or queued), written over its own claim and
 * only while the claim is still its own, so a release never removes another
 * request's ownership.
 */
export function packBuildChat({ job, at, ended = false }) { return { v: BUILD_LIVE_VERSION, job, at, ...(ended ? { ended: true } : {}) }; }
export function readBuildChat(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== BUILD_LIVE_VERSION || !isJobId(raw.job)) return null;
  return { job: raw.job, at: num(raw.at) || 0, ended: raw.ended === true };
}

/**
 * EXECUTION OWNERSHIP (2026-10-10, round 4). One record per job, created with
 * a conditional write, so exactly one party ever executes a job:
 *   queue    the queue's consumer took it (the container's runner, taking
 *            the consumer's lease over, inherits it — the same execution);
 *   inline   the producer's inline fallback took it, after a send or store
 *            that failed — the same job id, the same billing identity;
 *   revoked  a later request taking over an abandoned chat took it first, so
 *            the job can never start.
 * Deleting the job's envelope proves nothing (the consumer deletes it on
 * read); only this record decides who runs. Kept under its own prefix,
 * outside the job envelopes, and never served.
 */
export const BUILD_RUN_ROOT = "builds-run/";
export function buildRunKey(job) {
  if (!isJobId(job)) throw new Error("build-live: refusing a job id we did not mint");
  return BUILD_RUN_ROOT + job + ".json";
}
const RUN_OWNERS = new Set(["queue", "inline", "revoked"]);
export function packBuildRun({ job, owner, at }) { return { v: BUILD_LIVE_VERSION, job, owner, at }; }
export function readBuildRun(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== BUILD_LIVE_VERSION || !isJobId(raw.job) || !RUN_OWNERS.has(raw.owner)) return null;
  return { job: raw.job, owner: raw.owner, at: num(raw.at) || 0 };
}
/**
 * WHAT AN EXISTING EXECUTION RECORD MEANS FOR A CHAT'S CLAIM:
 *   "free"  revoked (the job can never start), or an executor older than any
 *           build runs (it is gone);
 *   "held"  an executor (queue or inline) that may still be running.
 */
export function runVerdict(run, now) {
  if (!run) return "free";
  if (run.owner === "revoked") return "free";
  return num(now) !== null && now - run.at > BUILD_JOB_MS ? "free" : "held";
}

/**
 * MAY A NEW FIRST BUILD TAKE A CHAT WHOSE CLAIM IS ALREADY WRITTEN?
 * (2026-10-10, the claim-to-marker race.)
 *   "held"  its owner may still be running: the new request follows it;
 *   "free"  its owner has ended (a kept answer, a row verdict, its own
 *           release, or no row and older than a build can run), or the claim
 *           itself is not a claim (unparseable), and it may be replaced —
 *           only by a write conditional on exactly the claim judged here.
 * A missing or unreadable marker is NOT an ended owner: the marker is written
 * before the claim, so a claim with no marker is a request part-way through,
 * or one that went down mid-way; either way its build may already be queued,
 * and it stays "held" until it is older than any build runs. Following a
 * build that never ran costs the customer a failure message; starting a
 * second one would cost them a second build.
 */
export function claimVerdict({ held, view, now }) {
  if (!held) return "free";
  if (held.ended) return "free";
  if (view) return holdsChat(view) ? "held" : "free";
  return num(now) !== null && now - held.at > BUILD_JOB_MS ? "free" : "held";
}

/**
 * IS A KEPT ANSWER A FINISHED BUILD OR A FAILED ONE? Finished is the
 * browser's own success gate (`reactSend`: `r.ok && d.error !== true &&
 * d.slug`); anything else is a failure the answer itself explains.
 */
export function doneOutcome(done) {
  if (!done) return "";
  let body = null;
  try { body = JSON.parse(done.body); } catch { body = null; }
  const ok = done.status >= 200 && done.status < 300 && body && typeof body === "object" && !Array.isArray(body) && body.error !== true && typeof body.slug === "string" && body.slug && body.ok !== false;
  return ok ? "done" : "failed";
}

/**
 * WHAT A FOUND BUILD IS, FROM ITS OWN RECORDS:
 *   done / failed  the kept final answer, handed back whole (`answer`);
 *   inline         running inside its own request (the queue could not take
 *                  it): owns its chat while younger than a build can run, then
 *                  stale — whatever its row says, since that row was closed
 *                  when the build went inline;
 *   accepting      not yet accepted: a row with no verdict behind it (the
 *                  acceptance is under way, or its message was sent and only
 *                  the "accepted" write was lost — the stale sweep settles the
 *                  row either way), or no row and younger than an acceptance
 *                  takes;
 *   abandoned      not accepted, and its row has a verdict or it has no row
 *                  and is older than an acceptance takes;
 *   failed         an accepted build whose row has its own verdict (failed,
 *                  lost, cancelled), handed back as the poll would answer it;
 *   unknown        an accepted build whose row says done while no answer was
 *                  kept (said as that, never as running or as a success);
 *   running        an accepted build whose row has no verdict, or — with no row
 *                  at all — younger than a build can run; its lines ride with it;
 *   stale          accepted, no row, no answer, and older than any build runs.
 * `row` is `buildRowStatus`'s answer: null when there is no row.
 */
export function buildLiveState({ marker, done = null, row = null, run = null, now }) {
  if (!marker) return null;
  const base = { job: marker.job, chat: marker.chat, words: marker.words, at: marker.at };
  const age = num(now) !== null ? now - marker.at : 0;
  if (done) return { ...base, state: doneOutcome(done), answer: { status: done.status, body: done.body, type: done.type } };
  // THE EXECUTION RECORD OUTRANKS THE MARKER'S OWN FLAGS (round 4): a build
  // whose "inline" or "accepted" write was lost is still the executor it is,
  // and no acceptance timeout frees a chat while it may be running.
  const runAge = run && num(now) !== null ? now - run.at : 0;
  if (run && run.owner === "inline") return { ...base, state: runAge > BUILD_JOB_MS ? "stale" : "inline" };
  if (run && run.owner === "revoked") return { ...base, state: "abandoned" };
  if (marker.inline) return { ...base, state: age > BUILD_JOB_MS ? "stale" : "inline" };
  if (run && run.owner === "queue" && !(row && row.verdict)) return { ...base, state: runAge > BUILD_JOB_MS && !row ? "stale" : "running" };
  if (!marker.accepted) {
    if (row) return { ...base, state: row.verdict ? "abandoned" : "accepting" };
    return { ...base, state: age > BUILD_ACCEPT_MS ? "abandoned" : "accepting" };
  }
  if (row && row.verdict) {
    const v = row.verdict;
    if (v.body && v.body.collected === true) return { ...base, state: "unknown" };
    return { ...base, state: "failed", answer: { status: v.status, body: JSON.stringify(v.body), type: "application/json" } };
  }
  if (row) return { ...base, state: "running" };
  return { ...base, state: age > BUILD_JOB_MS ? "stale" : "running" };
}

/** Whether a found build still owns its chat: one running, one being accepted, or one running inline. */
export const holdsChat = (view) => !!(view && (view.state === "running" || view.state === "accepting" || view.state === "inline"));
/** Whether the listing shows a found build: only one that was accepted and ended or runs as a job a browser can follow. */
export const listsBuild = (view) => !!(view && ["running", "done", "failed", "unknown"].includes(view.state));
