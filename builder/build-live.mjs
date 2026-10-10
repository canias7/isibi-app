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

/** The marker as written: the job, the account, the chat, the customer's own words, and when. */
export function packBuildLive({ job, uid, chat, words = "", at }) {
  return { v: BUILD_LIVE_VERSION, job, uid, chat: isLiveChat(chat) ? chat : "", words: str(words), at };
}
/** A stored marker, read strictly: null for anything that is not one. */
export function readBuildLive(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== BUILD_LIVE_VERSION) return null;
  if (!isJobId(raw.job) || !isLiveUid(raw.uid) || num(raw.at) === null) return null;
  if (typeof raw.chat !== "string" || (raw.chat && !isLiveChat(raw.chat)) || typeof raw.words !== "string") return null;
  return { job: raw.job, uid: raw.uid, chat: raw.chat, words: raw.words, at: raw.at };
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

/** The chat's claim: which build is running for it. */
export function packBuildChat({ job, at }) { return { v: BUILD_LIVE_VERSION, job, at }; }
export function readBuildChat(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== BUILD_LIVE_VERSION || !isJobId(raw.job)) return null;
  return { job: raw.job, at: num(raw.at) || 0 };
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
 *   failed         the row's own verdict (failed, lost, cancelled), handed
 *                  back as the poll would answer it;
 *   unknown        a row that says done while no answer was kept (said as
 *                  that, never as running or as a success);
 *   running        a row with no verdict, or — with no row at all — a marker
 *                  younger than a build can run; its progress lines ride with it;
 *   stale          no row, no answer, and older than any build runs.
 * `row` is `buildRowStatus`'s answer: null when there is no row.
 */
export function buildLiveState({ marker, done = null, row = null, now }) {
  if (!marker) return null;
  const base = { job: marker.job, chat: marker.chat, words: marker.words, at: marker.at };
  if (done) return { ...base, state: doneOutcome(done), answer: { status: done.status, body: done.body, type: done.type } };
  if (row && row.verdict) {
    const v = row.verdict;
    if (v.body && v.body.collected === true) return { ...base, state: "unknown" };
    return { ...base, state: "failed", answer: { status: v.status, body: JSON.stringify(v.body), type: "application/json" } };
  }
  if (row) return { ...base, state: "running" };
  return { ...base, state: num(now) !== null && now - marker.at > BUILD_JOB_MS ? "stale" : "running" };
}

/** Whether a found build still holds its chat: only a running one does. */
export const holdsChat = (view) => !!(view && view.state === "running");
