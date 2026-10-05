// THE CURRENT REQUEST'S REPLIES, SETTLED AND ON SCREEN (2026-10-05).
//
// The owner, after run 97: *"Request completion does not mean its
// model-written replies have finished: track the current request's job IDs
// and wait within a bounded deadline for their replies to settle and actually
// appear on screen before judging them … Distinguish pending, model-written,
// failed and timed-out replies, and ensure unrelated historical replies cannot
// satisfy or block the current request's verdict."*
//
// Since deploy 2183 the page closes a request once each part's outcome is
// applied, while a part's reply may still be written in the background: its
// place is held on the thread (`EditPoll.holdReply`, the message carrying the
// job's id as `held.job`) and settled later by the page's own follow of that
// job (`editReplyFollow`). Run 97's canary ended its message when the page
// closed the request, 8 s after the job ended, and judged a reply that was
// still `pending`.
//
// So a reply is read here OFF ITS OWN JOB, never off the thread as a whole:
//   * its STATE from the page's own polls of that job (the answers it was
//     handed under `x-gf-edit: final`, which the canary records): written by
//     the model, still being written, failed, a question, or composed (no
//     model reply on it);
//   * its PLACE on screen by the job's own id where the page holds one — the
//     message that held the reply's place is the one it settles into — and
//     otherwise by the job's own words, counted against every other job whose
//     answer carries the same words, so a message another job's reply put
//     there never stands in for this one.
// A job that is not the current request's is never waited on and never read
// for it: a historical reply can neither satisfy nor hold up this verdict.
// Where the page puts those historical replies is the page's own matter
// (recorded in docs/backlog.md as an open product bug); this only refuses to
// count them.

import { EditPoll } from "./canary-watch.mjs";
import { plain } from "./canary-additions.mjs";

// A REPLY'S STATES, as this reads them and the verdict names them.
//   model     the model's own reply is on its job's answer;
//   pending   being written (`replyState: "pending"`); never a verdict on its
//             own — one still pending when the time runs out is `timeout`;
//   failed    the server gave up on it (`replyState: "failed"`): the page
//             shows its own sentence instead;
//   question  a step's question with no reply owed beside it;
//   composed  an answer with no model reply on it and none owed (the switch
//             off, or nothing to write);
//   none      nothing is shown for it (a hand-over);
//   unread    the page never read the job's answer;
//   timeout   still pending, or still held on screen, when the time ran out —
//             or held until the page itself stopped waiting for it.
export const REPLY_STATES = Object.freeze(["model", "pending", "failed", "question", "composed", "none", "unread", "timeout"]);

const JOB_PATH = /^\/api\/site\/edit\/([^/?#]+)$/;

/** The job a recorded poll is of, or "". */
export function jobOfPath(path) {
  const m = JOB_PATH.exec(String(path || ""));
  if (!m) return "";
  try { return decodeURIComponent(m[1]); } catch { return ""; }
}

/** The model's own words on an answer, read exactly as the page reads them, or "". */
export function modelTextOf(res) {
  return EditPoll.modelReply(res) || "";
}

/** One answer's reply state (`REPLY_STATES`), from what the server handed the page. */
export function replyStateOf(res) {
  if (!res || typeof res !== "object" || Array.isArray(res)) return "unread";
  // A HAND-OVER SHOWS NOTHING (the page says nothing for one), whatever its
  // reply's progress: the step it was handed to explains the part.
  if (res.escalate === true) return "none";
  if (modelTextOf(res)) return "model";
  if (res.replyState === "pending") return "pending";
  if (res.replyState === "failed") return "failed";
  if (questionOf(res)) return "question";
  return "composed";
}

/** A step's question on an answer, or "" — asked whatever the reply's state. */
export function questionOf(res) {
  return res && typeof res === "object" && res.clarify && typeof res.clarify === "object" && typeof res.clarify.text === "string" ? res.clarify.text : "";
}

/** The words a job's message on screen must carry for its answer: the model's, the question's, or the page's own sentence's start. */
export function expectedTextOf(res) {
  const state = replyStateOf(res);
  if (state === "model") return modelTextOf(res);
  if (state === "question") return questionOf(res);
  if (state === "failed" || state === "composed") return typeof res.msg === "string" ? res.msg : "";
  return "";
}

/** What a text is matched by: its first 80 characters, normalised as the screen's are. */
export const keyOf = (text) => plain(text).trim().slice(0, 80);

/** Whether a message's words carry a text, by that text's key; never for an empty text. */
const carries = (screen, text) => {
  const k = keyOf(text);
  return !!k && plain(screen).includes(k);
};

/**
 * EVERY JOB THE PAGE READ AN ANSWER FOR, AND WHAT IT LAST SAID — and when the
 * reply was first seen pending and first seen settled (the run's clock, as
 * the recorded answers carry it). Read off the page's own recorded polls; a
 * job is known by its id alone.
 */
export function jobAnswers(network) {
  const out = new Map();
  for (const e of Array.isArray(network) ? network : []) {
    if (!e || e.final !== true || !e.res || typeof e.res !== "object" || Array.isArray(e.res)) continue;
    const job = jobOfPath(e.path);
    if (!job) continue;
    const state = replyStateOf(e.res);
    const was = out.get(job) || { job, res: null, state: "unread", polls: 0, pendingMs: null, settledMs: null };
    was.res = e.res;
    was.state = state;
    was.polls++;
    const ms = Number.isFinite(e.ms) ? e.ms : null;
    if (state === "pending" && was.pendingMs === null) was.pendingMs = ms;
    if (state !== "pending" && was.settledMs === null) was.settledMs = ms;
    out.set(job, was);
  }
  return out;
}

/**
 * THE JOBS WHOSE OWN REPLIES THIS MESSAGE IS JUDGED ON: every job the
 * request's view lists as explaining its part (`jobs`, never a hand-over or
 * a routing job), in order, less those an earlier message of the same
 * request was judged on. `[{ job, part }]`.
 */
export function replyJobsOf(view, earlier = new Set()) {
  const out = [];
  const seen = new Set();
  for (const p of view && Array.isArray(view.parts) ? view.parts : []) {
    for (const job of p && Array.isArray(p.jobs) ? p.jobs : []) {
      if (typeof job !== "string" || !job || seen.has(job) || earlier.has(job)) continue;
      seen.add(job);
      out.push({ job, part: p.n });
    }
  }
  return out;
}

/**
 * WHERE EACH HELD REPLY STANDS ON THE THREAD, kept from read to read of ONE
 * page: the index of the message whose `held.job` names it. The page only
 * appends to its thread while it is open, so the message that held a reply's
 * place is the one it settles into; a page reloaded or opened afresh reads
 * its thread from storage (the last 40 messages), so its places are read
 * again from scratch, known by the page's own time origin (`origin`).
 */
export function trackHeld(slots, s) {
  const prev = slots && typeof slots === "object" && slots.at && typeof slots.at === "object" ? slots : { tab: null, at: {} };
  const tab = s && Number.isFinite(s.origin) ? s.origin : null;
  const out = { tab, at: prev.tab === tab ? { ...prev.at } : {} };
  const msgs = s && Array.isArray(s.messages) ? s.messages : [];
  msgs.forEach((m, i) => {
    const job = m && typeof m.held === "string" ? m.held : "";
    if (job && !Object.hasOwn(out.at, job)) out.at[job] = i;
  });
  return out;
}

/**
 * THE CURRENT REQUEST'S REPLIES AS THEY STAND NOW: for each of its jobs, the
 * reply's state off that job's own answers, and whether — and where — it is
 * on screen. `settled` once every one of them is written or has failed for
 * good, and is on screen (a failure's line no longer held, a question's words
 * drawn), and the request's own reply too when one is owed.
 *
 *   jobs      `replyJobsOf`'s list;
 *   network   every recorded API answer of the run so far;
 *   s         the latest read of the page (`messages` with `held` and
 *             `holding`; `requests[key]` with `replied` and `replies`);
 *   slots     `trackHeld`'s places;
 *   key       the current request;
 *   request   its own reply as its view says it (`{ text, source, for }`,
 *             `{ state, for }`, or null when none is owed).
 */
export function repliesNow({ jobs = [], network = [], s = null, slots = null, key = "", request = null } = {}) {
  const answers = jobAnswers(network);
  const msgs = s && Array.isArray(s.messages) ? s.messages : [];
  const at = slots && slots.at && typeof slots.at === "object" ? slots.at : {};
  // A PLACE IS GOOD while its message is still there and holds no other job.
  const slotOf = (job) => {
    if (!Object.hasOwn(at, job)) return null;
    const i = at[job];
    const m = msgs[i];
    if (!m || (typeof m.held === "string" && m.held && m.held !== job)) return null;
    return i;
  };
  const placed = new Set();
  for (const job of Object.keys(at)) { const i = slotOf(job); if (i !== null) placed.add(i); }
  // THE REST OF THE THREAD: assistant messages no held reply stands in.
  const pool = [];
  msgs.forEach((m, i) => {
    if (!m || m.who !== "a" || m.card || m.busy || m.holding || placed.has(i)) return;
    pool.push({ i, text: String(m.text || "") });
  });
  const hitsFor = (text) => pool.filter((p) => carries(p.text, text));
  // WHO ELSE NEEDS THE SAME WORDS: every job the page read an answer for,
  // whatever request it is, with no held place of its own — by its reply's
  // words or its question's, once per job.
  const demand = (k) => [...answers.values()].filter((a) => slotOf(a.job) === null && (keyOf(expectedTextOf(a.res)) === k || keyOf(questionOf(a.res)) === k)).length;
  // ON SCREEN AS MANY TIMES AS IT IS NEEDED: never fewer messages carrying a
  // text than jobs whose answers carry it.
  const enough = (text) => { const k = keyOf(text); return !!k && hitsFor(text).length >= demand(k); };
  const used = new Set();
  const out = [];
  for (const { job, part } of Array.isArray(jobs) ? jobs : []) {
    const a = answers.get(job) || null;
    let state = a ? a.state : "unread";
    const res = a ? a.res : null;
    const text = expectedTextOf(res);
    const asks = questionOf(res);
    const i = slotOf(job);
    const holding = i !== null && !!msgs[i] && (msgs[i].held === job || msgs[i].holding === true);
    let shown = false;
    let where = null;
    let screen = "";
    let asked = false;
    if (i !== null) {
      // THE MESSAGE THAT HELD ITS PLACE — still holding it (its words drawn
      // under the line when it asks), or settled into the model's words, the
      // question's, or the page's own sentence.
      where = i;
      screen = String(msgs[i].text || "");
      asked = !!asks && carries(screen, asks);
      if (!holding) {
        // HELD UNTIL THE PAGE ITSELF STOPPED WAITING: settled into its own
        // sentence while the reply was still being written.
        if (state === "pending") state = "timeout";
        shown = state === "model" ? carries(screen, text) && (!asks || asked)
          : state === "question" ? asked
            : state === "failed" || state === "composed" || state === "timeout";
      }
    } else {
      // NO HELD PLACE: its own words, as many times on screen as there are
      // jobs whose answers carry them — a question's words likewise, so a
      // question another request asked in the same words does not stand in.
      asked = !!asks && enough(asks);
      if (enough(text)) {
        const hits = hitsFor(text);
        const pick = hits.find((p) => !used.has(p.i)) || hits[0];
        where = pick.i;
        screen = pick.text;
        shown = !asks || asked;
      }
    }
    if (shown && where !== null) used.add(where);
    const settled = state === "model" ? shown && !holding
      : state === "question" ? asked
        : state === "failed" || state === "composed" ? !holding
          : state === "none" || state === "timeout";
    out.push({
      job, part, state, text, ...(asks ? { asks, asked } : {}), shown: !!shown && !holding, holding, at: where,
      ...(screen ? { screen } : {}),
      pendingMs: a ? a.pendingMs : null, settledMs: a && a.state !== "pending" ? a.settledMs : null, settled,
    });
  }
  // THE REQUEST'S OWN REPLY, when one is owed: on screen once the page says
  // it showed this request's reply and its words are there.
  let own = null;
  if (request && typeof request === "object") {
    const kept = s && s.requests && key && s.requests[key] ? s.requests[key] : null;
    const byPage = !!(kept && (kept.replied === true || (Array.isArray(kept.replies) && !!request.for && kept.replies.includes(request.for))));
    if (typeof request.text === "string" && request.text) {
      const hits = hitsFor(request.text).filter((p) => !used.has(p.i));
      const ok = byPage && hits.length >= 1;
      const source = request.source === "model" ? "model" : "composed";
      own = { text: request.text, source, for: request.for || "", state: source, shown: ok, settled: ok, ...(ok ? { at: hits[0].i } : {}) };
      if (ok) used.add(hits[0].i);
    } else if (request.state === "pending") own = { text: "", for: request.for || "", state: "pending", shown: false, settled: false };
    else if (request.state === "failed") own = { text: "", for: request.for || "", state: "failed", shown: false, settled: true };
  }
  return {
    jobs: out, request: own,
    settled: out.every((j) => j.settled) && (!own || own.settled),
    attributed: [...used].sort((x, y) => x - y),
  };
}

/**
 * WHAT IS LEFT WHEN THE TIME RUNS OUT: a reply still pending, or still held
 * on screen, is `timeout`; the request's own reply still pending likewise.
 */
export function timedOut(now) {
  const jobs = (now && Array.isArray(now.jobs) ? now.jobs : []).map((j) => (!j.settled && (j.state === "pending" || j.holding) ? { ...j, state: "timeout" } : j));
  const request = now && now.request && now.request.state === "pending" ? { ...now.request, state: "timeout" } : now ? now.request : null;
  return { ...now, jobs, request, settled: false };
}

/**
 * THE VERDICT'S ROWS FOR ONE MESSAGE'S WATCHED REPLIES: `{ part, job, source,
 * text, shown }` — `source` the reply's state, and for a part's reply whose
 * job also asked a question, the question as its own row.
 */
export function watchedReplies(watch, seen = new Set()) {
  const out = [];
  for (const j of watch && Array.isArray(watch.jobs) ? watch.jobs : []) {
    if (seen.has(j.job)) continue;
    seen.add(j.job);
    if (j.asks && j.state !== "question") out.push({ part: j.part, job: j.job, source: "question", text: j.asks, shown: j.asked === true });
    out.push({
      part: j.part, job: j.job, source: j.state, text: j.state === "question" ? j.asks || j.text : j.text,
      shown: j.state === "question" ? j.asked === true : !!j.shown,
      pendingMs: j.pendingMs, settledMs: j.settledMs, ...(j.screen ? { screen: j.screen } : {}),
    });
  }
  const r = watch && watch.request;
  if (r && (r.text || r.state)) out.push({ part: "request", job: "", for: r.for || "", source: r.state || r.source, text: r.text || "", shown: !!r.shown });
  return out;
}

/** Why a reply that is not the model's own, on screen, fails — in words that name its state. "" for one that passes. */
export function replyFailure(r) {
  const words = JSON.stringify(String((r && (r.screen || r.text)) || "").slice(0, 120));
  switch (r && r.source) {
    case "model": return r.shown ? "" : "the model's reply was written but is not on screen";
    case "timeout": return "timed out: the reply was still being written when the message's time ran out";
    case "pending": return "timed out: the reply was still being written when it was judged";
    case "failed": return `failed: the reply was not written (the server gave up), and the page showed its own sentence instead: ${words}`;
    case "composed": return `composed: no model reply on it: ${words}`;
    case "unread": return "unread: the page never read this job's answer";
    case "none": return "nothing is shown for it (a hand-over)";
    default: return `${(r && r.source) || "unknown"}: ${words}`;
  }
}
