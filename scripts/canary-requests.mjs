// ── THE REQUEST BATCH: EACH PRESS JUDGED BY WHAT LANDED, AND WHICH PATH IT TOOK ──
//
// The combined request flow's real-model batch (2026-10-03,
// docs/investigations/request-flow-rollout.md): six presses on the bakery,
// each one message the server takes on as a request (`rq-*` in
// canary-ui.mjs). This module judges a press from what the canary read; it
// reads nothing itself.
//
// TWO KINDS OF VERDICT, NEVER MIXED (the owner, 2026-10-03: *"Record valid
// alternative execution paths accurately, distinguishing a successful user
// outcome from coverage of a particular internal handoff."*):
//   * CHECKS — what the customer asked for happened, and nothing else: the
//     request was taken on and ended with every part done where the press
//     allows it, the site holds exactly the named changes, nothing else moved,
//     no part ran before a part it needed had finished, and each reply is the
//     model's own and on screen. A check that fails fails the press.
//   * COVERAGE — which internal hand-over the run went through: whether the
//     add-on step set the menu link aside, whether a part waited for another,
//     whether a step asked the question rather than the router. The router and
//     each step choose their own path, and a prior model answer does not
//     guarantee the next one, so the same message can reach the same outcome
//     by another valid path. Coverage is recorded, covered or not, and never
//     fails a press.
//
// A REPLY IS NOT AN OUTCOME (run 47): every check reads what the operations
// did — the request's own view, the stored source, the served pages, the
// owner's table listing, the logo's bytes — never how many replies came back.
import { frameOf, withoutAdditions, profileMatches, plain, states, wordsOf, less, changedSpan, anchors, region, visible, photosOf } from "./canary-additions.mjs";
import { requestKeyOf, routeCallOf, liveOnItsPart, answerResumedVerdict } from "./canary-ui.mjs";
import { replyStateOf, modelTextOf, questionOf, watchedReplies, replyFailure } from "./canary-replies.mjs";

const byPath = (list) => new Map((Array.isArray(list) ? list : []).filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source || "")]));
const listOf = (v) => (typeof v === "string" && v ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);
/** A list of records, each an object; anything else read as none (`listOf` keeps strings only). */
const arrOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

/** A part's statuses that mean a job was filed for it, or it may start now: never before a part it needs is done. */
export const PART_STARTED = Object.freeze(["ready", "queued", "started", "waiting", "unverified", "done", "partial", "failed"]);
/** A part running, or about to run. */
export const PART_LIVE = Object.freeze(["ready", "queued", "started"]);

/** The route a page file serves, read off its own `createFileRoute("…")`; "" when it names none. */
export function routeOfPage(source) {
  const m = /createFileRoute\(\s*(["'`])([^"'`]+)\1\s*\)/.exec(String(source || ""));
  return m ? m[2] : "";
}

/** The stored page that serves a route, or null. */
export function pageForRoute(pages, route) {
  for (const p of Array.isArray(pages) ? pages : []) {
    if (p && typeof p.path === "string" && routeOfPage(p.source) === route) return { path: p.path, source: String(p.source || "") };
  }
  return null;
}

// ── A HEADING CHANGED, THAT TEXT ONLY ───────────────────────────────────────

/** The ways a page's source may spell the same words: an apostrophe as typed, curled, or escaped. */
function spellings(s) {
  const t = String(s || "");
  return [...new Set([t, t.replace(/'/g, "’"), t.replace(/'/g, "&apos;"), t.replace(/'/g, "&#39;"), t.replace(/'/g, "\\'")])];
}

/** Words as written in a page's source, read as a visitor reads them: entities decoded, a JSX string's braces and quotes taken off. */
function sourceWords(s) {
  let t = String(s || "").trim();
  const m = /^\{\s*(["'`])([\s\S]*)\1\s*\}$/.exec(t);
  if (m) t = m[2];
  return plain(t.replace(/&apos;|&#39;|&#x27;|\\'/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}

/**
 * WHETHER ONE PAGE'S SOURCE CHANGED IN ONE PLACE ONLY: the heading's words,
 * from `from` to `to`, and every other byte as it was. The old words must be
 * in the page exactly once (twice cannot say which one was meant); what
 * replaced them is read as words, so a JSX string or an escaped apostrophe
 * reads the same. A change beyond it, spacing included, is said as such.
 */
export function headingOnly(before, after, from, to) {
  const x = String(before == null ? "" : before), y = String(after == null ? "" : after);
  let at = -1, lit = "";
  for (const f of spellings(from)) {
    const i = x.indexOf(f);
    if (i < 0) continue;
    if (x.indexOf(f, i + 1) >= 0) return { ok: false, why: `"${from}" is in the page more than once, so which one changed cannot be told` };
    at = i; lit = f;
    break;
  }
  if (at < 0) return { ok: false, why: `"${from}" was not in the page before` };
  const head = x.slice(0, at), tail = x.slice(at + lit.length);
  if (y.length >= head.length + tail.length && y.startsWith(head) && y.endsWith(tail)) {
    const mid = y.slice(head.length, y.length - tail.length);
    return sourceWords(mid) === plain(to) ? { ok: true, why: "" } : { ok: false, why: `the heading reads ${JSON.stringify(mid.slice(0, 120))}, not "${to}"` };
  }
  const squash = (s) => s.replace(/\s+/g, "");
  const spaced = squash(y).startsWith(squash(head)) && squash(y).endsWith(squash(tail));
  return { ok: false, why: spaced ? "the page changed beyond that heading, in its spacing only" : "the page changed beyond that heading" };
}

// ── A LINE OF WORDS ADDED ───────────────────────────────────────────────────

/** A time as one spelling: "8 pm", "8:00pm", "8.00 PM" and "20:00" are all "8pm". */
export function timeWords(s) {
  return String(s == null ? "" : s)
    .replace(/\b(1[3-9]|2[0-3])[:.]00\b/g, (_, h) => `${Number(h) - 12}pm`)
    .replace(/\b(\d{1,2})(?:[:.]00)?\s*(am|pm|a\.m\.|p\.m\.)/gi, (_, h, m) => `${h}${m.toLowerCase().replace(/\./g, "")}`);
}

/**
 * Whether `text` names every stem, each at the start of a word: "class" names
 * "classes", and "bread" names "bread-making". Nothing to look for names
 * nothing: an empty list is never a pass.
 */
export function namesAll(text, stems) {
  const t = plain(text);
  const list = listOf(stems);
  return list.length > 0 && list.every((w) => {
    const s = plain(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !!s && new RegExp("(?:^|[^a-z0-9])" + s).test(t);
  });
}

/** Whether `text` states every fragment, each whole and undenied (`states`), times read as one spelling; an empty list is never a pass. */
export function statesAll(text, says) {
  const t = timeWords(text);
  const list = listOf(says);
  return list.length > 0 && list.every((w) => states(t, timeWords(w)));
}

// ── WHAT LEFT THE PAGE, AND WHAT THE REQUEST DID, MESSAGE BY MESSAGE ────────

/** The view of a request a message ended on, or null. */
const finalOf = (step) => (step && step.request && step.request.final && typeof step.request.final === "object" ? step.request.final : null);

/** Whether a part's route is one this press allows: an edit layer it lists, or the add-on step where it opens it. */
export function routeAllowed(route, scenario) {
  if (typeof route !== "string" || !route) return false;
  if (route === "addon") return !!(scenario && (scenario.addon === true || scenario.adds === true));
  return !!(scenario && Array.isArray(scenario.layers) && scenario.layers.includes(route));
}

/**
 * ONE MESSAGE, AS A REQUEST: one routing call carrying its words, nothing
 * posted from the page after it, and then — for a message that ends on a
 * question (`until: "question"`) — one part waiting on a step's question with
 * nothing else running, or the router's own question with no request opened
 * (another valid path, said as such); for every other message the request
 * ended with every part done at a route the press allows, nothing stopped by
 * the wall. A file the message carried rode the routing call byte for byte.
 * A message sent with the tab closed (`away`) ended with no page open and was
 * shown, ended, by the tab opened afterwards.
 */
export function requestStepChecks(step, scenario) {
  const out = [];
  const add = (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const n = step && step.n;
  const net = Array.isArray(step && step.network) ? step.network : [];
  if (!step || !step.sent) { add(`message ${n} was sent`, false, "it was not sent"); return out; }
  const routes = net.filter((e) => e && e.method === "POST" && e.path === "/api/site/route");
  const route = routeCallOf(net);
  add(`message ${n} left as one routing call carrying its words exactly`, routes.length === 1 && !!(route && route.req && route.req.message === step.say),
    `${routes.length} routing call(s)${route && route.req && route.req.message !== step.say ? "; the words differ" : ""}`);
  const posts = net.filter((e) => e && e.method === "POST" && /^\/api\/site\/[^/]+\/(edit|addon)$/.test(String(e.path || "")));
  add(`message ${n}: the page posted no edit or add-on of its own (the server runs every part)`, posts.length === 0, posts.map((e) => e.path).join(", "));
  if (step.file) {
    const got = route && route.req && Array.isArray(route.req.images) && route.req.images[0] ? route.req.images[0].sha256 : "";
    add(`message ${n}'s file rode the routing call byte for byte (sha256 ${String(step.file.sha256).slice(0, 16)}…)`, got === step.file.sha256, got || "no file on the routing call");
  }
  const key = requestKeyOf(net);
  // A CONTINUATION'S ANSWER (`answer`, 2026-10-08): it resumed exactly the part that was waiting.
  const fin = finalOf(step);
  if (Object.hasOwn(step, "answering")) {
    const v = answerResumedVerdict(step);
    add(`message ${n} answered the question that was waiting and resumed exactly that part`, v.ok, v.why);
    // AND AFTERWARDS, THE SAME IDENTITIES (2026-10-08): the request the page
    // followed is the named one, and its named part moved on from the named
    // question to done.
    const w = step.answering || {};
    const fp = fin && fin.key === w.key && Array.isArray(fin.parts) ? fin.parts.find((p) => p && p.n === w.part) : null;
    const still = fp && fp.status === "waiting" && fp.question && (fp.question.id === w.id || String(fp.question.text || "").trim() === w.text);
    add(`message ${n}: afterwards, part ${w.part} of request ${w.key} moved on from the named question to done`,
      !!fp && !still && fp.status === "done",
      !fin ? "the request was not read afterwards" : fin.key !== w.key ? `the request read afterwards is ${fin.key}, not ${w.key}` : !fp ? `request ${w.key} has no part ${w.part} afterwards` : still ? "it still waits on the named question" : `it is ${JSON.stringify(fp.status)}`);
  }
  const parts = fin && Array.isArray(fin.parts) ? fin.parts : [];
  const wall = step.request && step.request.wall;
  if (step.mode === "question") {
    const q = step.question || null;
    if (q && q.by === "router") {
      add(`message ${n} ended on a question: the router's own, with no request opened (another valid path: the answer is routed whole)`,
        !key && !!(route && route.res && route.res.intent === "clarify"), key ? "a request was opened too" : "the routing answer is not a question");
      return out;
    }
    add(`message ${n} was taken on as a request`, !!key, "the routing answer names no request");
    const waiting = parts.filter((p) => p && p.status === "waiting" && p.question);
    // NOTHING ELSE RUNNING, NOR ENDED OTHERWISE: every other part is done, or
    // waits for this one (a part about to run or running is neither).
    const off = parts.filter((p) => p && p.status !== "waiting" && p.status !== "done" && p.status !== "blocked");
    add(`message ${n} ended on one part waiting with a step's question, the page showing it, and nothing else running`,
      !!q && q.by === "step" && waiting.length === 1 && q.part === waiting[0].n && !off.length && !wall,
      wall ? `the wall stopped part ${wall.n}: ${wall.why}` : !q ? "no question was shown" : `parts ${parts.map((p) => `${p.n}:${p.status}`).join(" ") || "(none read)"}`);
    return out;
  }
  add(`message ${n} was taken on as a request`, !!key, "the routing answer names no request");
  if (!key) return out;
  add(`message ${n}'s request ended`, !!(fin && fin.ended === true), fin ? `it is ${fin.state || "?"}` : "its view was never read");
  add(`message ${n}'s request: every part done, each at a route this press allows`,
    parts.length > 0 && parts.every((p) => p && p.status === "done" && routeAllowed(p.route, scenario)),
    parts.map((p) => `${p.n}:${p.status}${p.route ? "@" + p.route : ""}`).join(" ") || "no part read");
  add(`message ${n}: nothing was stopped by the wall`, !wall, wall ? `part ${wall.n}: ${wall.why}` : "");
  if (step.mode === "away") {
    const a = step.away || {};
    add(`message ${n}'s request ended while no page was open`, a.closed === true && a.ended === true, a.closed ? (a.ended ? "" : "it had not ended when the reads stopped") : "the tab was never closed");
    add(`nothing read message ${n}'s request route while the tab was closed (only the requests list, which moves nothing)`,
      a.closed === true && Array.isArray(a.calls) && a.calls.length === 0, (a.calls || []).map((c) => `${c.method} ${c.path}`).join(", ") || "not watched");
    add(`the tab opened afterwards showed message ${n}'s request ended, every part with its reply`,
      !!(a.reopened && a.reopened.closed === true), a.reopened ? a.reopened.why || "the page never closed the request" : "no tab was opened afterwards");
  }
  return out;
}

/**
 * WHICH PART NEEDS WHICH, as the routing answer numbered them (`dependsOn`,
 * change 0 being the part the answer makes and change i the i-th part held
 * back, `alsoAsked`), mapped onto the request's parts as it took the message
 * on. A change the request folded into another cannot be mapped and is
 * counted, never guessed.
 */
export function relationsOf(step) {
  const route = routeCallOf(step && step.network);
  const res = route && route.res && typeof route.res === "object" ? route.res : {};
  const accepted = res.request && Array.isArray(res.request.parts) ? res.request.parts : [];
  const also = listOf(res.alsoAsked);
  const numberOf = (c) => {
    if (c === 0) return accepted.some((p) => p && p.n === 0) ? 0 : undefined;
    const w = also[c - 1];
    const p = typeof w === "string" ? accepted.find((x) => x && x.words === w) : null;
    return p ? p.n : undefined;
  };
  const out = [], unread = [];
  for (const d of Array.isArray(res.dependsOn) ? res.dependsOn : []) {
    for (const a of Array.isArray(d && d.after) ? d.after : []) {
      const part = numberOf(d.change), needs = numberOf(a);
      if (Number.isInteger(part) && Number.isInteger(needs) && part !== needs) out.push({ part, needs });
      else unread.push({ change: d.change, after: a });
    }
  }
  return { relations: out, unread, blocked: accepted.filter((p) => p && p.status === "blocked").map((p) => p.n) };
}

/**
 * SUBSTANTIVE PREPARATION OVERLAPPING ANOTHER PART'S ACTIVE EXECUTION
 * (2026-10-09; corrected on Codex's review of ac24aece, which reproduced the
 * first version passing "preparing" or "prepared" beside a merely queued job —
 * neither shows two things running at once). Judged only on RECORDED
 * INTERVALS in the request's own view, the last one the press read for the
 * first message's request:
 * - a part's preparation step (`prepRun.step`: from, to, and the model calls it
 *   made) — the routing alone is not the step's work;
 * - another part's run job's execution (`runs`: from its progress record's
 *   opening to its close) — a queued job is not executing.
 * They overlap when each began before the other ended (a touching edge is
 * not overlap). A step that made no model call is not substantive. Open
 * intervals and missing records are reported as missing evidence, never as a
 * pass.
 */
export function overlapVerdict(steps) {
  const list = arrOf(steps);
  const first = list[0];
  if (!first || first.sent !== true) return { ok: false, overlaps: [], routingOnly: [], why: "the first message was not sent" };
  const key = first.request && typeof first.request.key === "string" ? first.request.key : "";
  const finals = list.filter((x) => x && x.request && x.request.key === key && x.request.final && typeof x.request.final === "object").map((x) => x.request.final);
  const view = finals.length ? finals[finals.length - 1] : null;
  if (!key || !view) return { ok: false, overlaps: [], routingOnly: [], why: "missing evidence: the request's view was never read" };
  const parts = arrOf(view.parts);
  const fin = (v) => typeof v === "number" && Number.isFinite(v);
  const preps = [], routes = [], runs = [];
  let open = 0;
  for (const p of parts) {
    const pr = p && p.prepRun && typeof p.prepRun === "object" ? p.prepRun : null;
    if (pr) {
      const st = pr.step && typeof pr.step === "object" ? pr.step : null;
      if (st && fin(st.from) && fin(st.to) && st.to >= st.from && Number.isInteger(st.calls) && st.calls > 0) preps.push({ part: p.n, from: st.from, to: st.to, calls: st.calls });
      else if (fin(pr.from) && fin(pr.to) && pr.to >= pr.from) routes.push({ part: p.n, from: pr.from, to: pr.to, outcome: pr.outcome || "" });
    }
    for (const r of arrOf(p && p.runs)) {
      if (!r || !fin(r.from)) continue;
      if (!fin(r.to)) { open++; continue; }
      if (r.to >= r.from) runs.push({ part: p.n, job: String(r.job || ""), from: r.from, to: r.to });
    }
  }
  const meets = (a, b) => a.from < b.to && b.from < a.to;
  const overlaps = [], routingOnly = [];
  for (const s of preps) for (const r of runs) if (r.part !== s.part && meets(s, r)) overlaps.push({ prepPart: s.part, calls: s.calls, runPart: r.part, job: r.job, ms: Math.min(s.to, r.to) - Math.max(s.from, r.from) });
  for (const s of routes) for (const r of runs) if (r.part !== s.part && meets(s, r)) routingOnly.push({ prepPart: s.part, runPart: r.part, job: r.job });
  const sec = (ms) => Math.round(ms / 100) / 10;
  let why = "";
  if (!overlaps.length) {
    if (!preps.length && !routes.length && !runs.length) why = "missing evidence: the view records no preparation and no job execution interval";
    else if (!runs.length) why = `missing evidence: no other part's job execution interval was recorded${open ? ` (${open} still open)` : ""}`;
    else if (!preps.length && routingOnly.length) why = `only a routing ran beside another part's job (part ${routingOnly[0].prepPart} beside part ${routingOnly[0].runPart}'s job); no step's work did`;
    else if (!preps.length) why = "no part's preparation ran a step";
    else why = "the prepared step's work did not overlap another part's job: it ran before that job started or after it ended";
  }
  return { ok: overlaps.length > 0, overlaps, routingOnly, runs: runs.length, preps: preps.length, why, said: overlaps.length ? `part ${overlaps[0].prepPart}'s prepared step (${overlaps[0].calls} model call(s)) overlapped part ${overlaps[0].runPart}'s job ${overlaps[0].job.slice(0, 8)} for ${sec(overlaps[0].ms)} s` : "" };
}

/**
 * NO PART STARTED BEFORE A PART IT NEEDS HAD FINISHED, as the canary saw the
 * request: every view it read (`trail`, every 3 s with the tab open and every
 * 20 s with it closed) is checked against every relation. A part whose job is
 * filed, running or finished while the one it needs is not done is the flow
 * running out of order. No relation means nothing to order: the check holds,
 * and says so.
 */
export function jobOrderVerdict(step) {
  const { relations, unread } = relationsOf(step);
  // AND THE CARD, FOR A MESSAGE READ IN A FRESH BROWSER SESSION (2026-10-07):
  // its own route is read only through the requests list while its tab is
  // closed, so most of what the canary saw of it is the request's card — each
  // reading of the parts as the page kept them, in the tab that sent it and in
  // the fresh session (`fresh.before`, `fresh.after`). Each is checked too.
  const cards = step && step.fresh && typeof step.fresh === "object" ? [...arrOf(step.fresh.before), ...arrOf(step.fresh.after)] : [];
  const trail = [
    ...(step && step.request && Array.isArray(step.request.trail) ? step.request.trail : []),
    ...cards.map((c) => ({ ms: c.ms, parts: arrOf(c.parts).map((p) => [p.n, p.status]) })),
  ];
  if (!relations.length) return { ok: true, vacuous: true, relations, unread, views: trail.length, why: "no part waited for another" };
  const bad = [];
  for (const v of trail) {
    const st = new Map(Array.isArray(v && v.parts) ? v.parts : []);
    for (const r of relations) {
      if (PART_STARTED.includes(st.get(r.part)) && st.get(r.needs) !== "done") {
        bad.push(`at ${Math.round((v.ms || 0) / 1000)} s part ${r.part} was ${st.get(r.part)} while part ${r.needs}, which it needs, was ${st.get(r.needs) || "unread"}`);
      }
    }
  }
  if (!trail.length) return { ok: false, relations, unread, views: 0, why: "the request was never read while it ran" };
  return { ok: !bad.length, relations, unread, views: trail.length, why: bad.slice(0, 3).join("; ") };
}

/**
 * EACH PART'S REPLY: the model's own (`replySource: "model"`) and on screen
 * in the browser. A step's question is the step's own words, shown on its
 * card. The request's own reply, when it has one, is judged the same way.
 *
 * SINCE 2026-10-05 a request's message carries its replies WATCHED TO THEIR
 * END (`replyWatch`, `watchReplies` in canary-ui.mjs): each of its own jobs'
 * replies read off that job alone, waited for until it was written or had
 * failed for good and was on screen, and told apart — the model's, failed,
 * timed out, composed, unread (`watchedReplies`). A message recorded before
 * then is read the old way, off the last answer the page was handed for each
 * job, and with the same states: a reply still `pending` there was judged
 * before it was written, and says so, never "composed".
 */
export function repliesOf(step, seen = new Set()) {
  if (step && step.replyWatch) return watchedReplies(step.replyWatch, seen);
  const out = [];
  const net = Array.isArray(step && step.network) ? step.network : [];
  const screen = (Array.isArray(step && step.replies) ? step.replies : []).map((t) => plain(t));
  const shown = (text) => {
    const w = plain(text).slice(0, 80);
    return !!w && screen.some((s) => s.includes(w));
  };
  const fin = finalOf(step);
  for (const p of fin && Array.isArray(fin.parts) ? fin.parts : []) {
    for (const job of Array.isArray(p && p.jobs) ? p.jobs : []) {
      // A JOB AN EARLIER MESSAGE OF THE SAME REQUEST SHOWED was judged there.
      if (seen.has(job)) continue;
      seen.add(job);
      const hits = net.filter((e) => e && e.final === true && e.res && typeof e.res === "object" && e.path === `/api/site/edit/${job}`);
      const res = hits.length ? hits[hits.length - 1].res : null;
      if (!res) { out.push({ part: p.n, job, source: "unread", shown: false }); continue; }
      const state = replyStateOf(res);
      const asks = questionOf(res);
      if (asks) { out.push({ part: p.n, job, source: "question", text: asks, shown: shown(asks) }); if (state === "question") continue; }
      const model = modelTextOf(res);
      out.push({ part: p.n, job, source: state, text: model || String(res.msg || ""), shown: shown(model || res.msg || "") });
    }
  }
  const rr = step && step.request && step.request.reply;
  if (rr && typeof rr.text === "string" && rr.text) out.push({ part: "request", job: "", for: rr.for || "", source: rr.source === "model" ? "model" : "composed", text: rr.text, shown: shown(rr.text) });
  return out;
}

/**
 * The replies as checks: each one the model's own and on screen, a question
 * on screen — each failing with what it was (`replyFailure`): failed, timed
 * out, composed, unread, or written and never shown. A message the server
 * took on as a request whose replies were not watched to their end fails too.
 */
export function replyChecks(steps) {
  const out = [];
  const seen = new Set();
  for (const s of Array.isArray(steps) ? steps : []) {
    if (!s || !s.sent) continue;
    if (s.completed === true && s.request && s.request.key && !s.replyWatch) {
      out.push({ name: `message ${s.n}'s replies were watched to their end`, ok: false, why: "the request ended, and its replies were judged without waiting for them" });
    }
    const list = repliesOf(s, seen);
    if (!list.length) { out.push({ name: `message ${s.n} had a reply`, ok: false, why: "no part's reply was read" }); continue; }
    for (const r of list) {
      const who = r.part === "request" ? `the request's own reply${r.for ? ` (${r.for})` : ""}` : `part ${r.part}'s ${r.source === "question" ? "question" : "reply"}`;
      if (r.source === "question") out.push({ name: `message ${s.n}: ${who} is on screen`, ok: r.shown, why: r.shown ? "" : JSON.stringify(String(r.text || "").slice(0, 120)) });
      else {
        const ok = r.source === "model" && r.shown;
        out.push({ name: `message ${s.n}: ${who} is the model's own, and on screen`, ok, why: ok ? "" : replyFailure(r) });
      }
    }
  }
  return out;
}

// ── WHAT LANDED ON THE SITE ─────────────────────────────────────────────────

/** The logos a served page's header draws, as addresses on the site's own upload path. */
export function headerLogos(html, slug) {
  const head = region(html, "header");
  const mark = `/u/${slug}/`;
  return [...head.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).filter((u) => u.includes(mark)).map((u) => u.slice(u.indexOf(mark)));
}

/**
 * THE WORDS A MENU LINK MUST CARRY (2026-10-07, after run 105): only words the
 * customer's own message asks for — a spec's `label`, cited from that message
 * in `asked` — and then the link's words must hold them, as before. Asked for
 * none, the words are the builder's to choose: any label does, so long as it
 * says something. No list of words taken to mean the same, and no wording of
 * the builder's own is required.
 */
export const labelWords = (want) => (want && typeof want.label === "string" ? want.label.trim() : "");
export function labelFits(label, want) {
  const text = plain(label).trim();
  if (!text) return false;
  const asked = plain(labelWords(want)).trim();
  return asked ? text.includes(asked) : true;
}

/** The served home page's description, decoded; "" when it carries none. */
export function servedDescription(html) {
  const m = /<meta\b[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/.exec(String(html || ""));
  return m ? m[1].replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&") : "";
}

/**
 * THE NEW PAGES, one per page the press asks for: a route the sitemap did not
 * list before, served 200, whose words are about what was asked (`about`),
 * with a stored page file that serves it. Any other new route is extra.
 */
export function newPagesFound({ want, before, after, served }) {
  const was = new Set(Object.keys((before && before.render) || {}));
  const fresh = Object.keys((after && after.render) || {}).filter((r) => !was.has(r)).sort();
  const files = (after && after.source && Array.isArray(after.source.pages) ? after.source.pages : []);
  const oldFiles = new Set((before && before.source && Array.isArray(before.source.pages) ? before.source.pages : []).map((p) => p.path));
  const used = new Set();
  const found = [];
  for (const w of Array.isArray(want) ? want : []) {
    const route = fresh.find((r) => !used.has(r) && listOf(w.about).every((a) => visible(served && served[r]).includes(plain(a))));
    if (!route) { found.push({ want: w, route: "", why: `no new page is about ${listOf(w.about).join(" and ")} (new routes: ${fresh.join(", ") || "none"})` }); continue; }
    used.add(route);
    const file = files.find((p) => p && !oldFiles.has(p.path) && routeOfPage(p.source) === route);
    const status = after && after.render && after.render[route] ? after.render[route].status : undefined;
    found.push({ want: w, route, path: file ? file.path : "", status, why: !file ? `no new stored page file serves ${route}` : status !== 200 ? `${route} answered ${status}` : "" });
  }
  return { found, fresh, extra: fresh.filter((r) => !used.has(r)) };
}

/**
 * THE SITE AGAINST THIS PRESS'S OWN BEFORE-READ: each named change there,
 * exactly, and everything not named as it was — every stored page byte for
 * byte apart from the named places (a menu item, a footer link, a heading's
 * words, a line), no page gone, no stored component changed, the stored
 * description and every header logo as they were unless named, and the
 * owner's table listing the same tables with the same rules, columns and row
 * counts. `found` is `newPagesFound`'s answer.
 */
export function outcomeChecks({ spec, before, after, served, beforeServed, logo, row, tables, slug }) {
  const out = [];
  const add = (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const want = (spec && spec.expect) || {};
  const bRender = (before && before.render) || {}, aRender = (after && after.render) || {};
  const complete = !!(before && before.complete === true && after && after.complete === true);
  add("both stored source reads are complete", complete, "a store read did not answer, so an absence proves nothing");
  const bPages = before && before.source ? before.source.pages : [], aPages = after && after.source ? after.source.pages : [];
  const b = byPath(bPages), a = byPath(aPages);
  const pf = newPagesFound({ want: want.pages, before, after, served });
  // EACH NEW PAGE, ANSWERING, ABOUT WHAT WAS ASKED.
  for (const f of pf.found) {
    add(`a new page about ${listOf(f.want.about).join(" and ")} was added, stored and served 200${f.route ? ` (${f.route})` : ""}`, !f.why && !!f.route, f.why);
  }
  add("no other page was added", !pf.extra.length, `also new: ${pf.extra.join(", ")}`);
  // EACH HEADING: the served page reads the new words and not the old; the
  // before-read read the old.
  for (const h of Array.isArray(want.headings) ? want.headings : []) {
    const was = (bRender[h.route] || {}).headings || [], now = (aRender[h.route] || {}).headings || [];
    const hasFrom = (l) => l.some((t) => plain(t) === plain(h.from)), hasTo = (l) => l.some((t) => plain(t) === plain(h.to));
    add(`${h.route}'s heading "${h.from}" now reads "${h.to}" on the served page`, hasFrom(was) && hasTo(now) && !hasFrom(now),
      `before ${JSON.stringify(was)}, after ${JSON.stringify(now)}`);
  }
  // THE DESCRIPTION, stored and served.
  const bs = before && before.stored, as = after && after.stored;
  if (want.description) {
    const d = want.description;
    const said = as && as.ok ? as.description : "";
    add(`the stored description now names ${listOf(d.says).join(", ")}`, !!(bs && bs.ok && as && as.ok) && namesAll(said, d.says) && !(d.absentBefore && namesAll(bs.description, d.absentBefore)) && said !== bs.description,
      `before ${JSON.stringify(bs && bs.ok ? bs.description : null)}, after ${JSON.stringify(said || null)}`);
    const home = servedDescription(served && served["/"]);
    add("the served home page carries that description", !!said && home === said, `served ${JSON.stringify(home)}`);
  } else {
    add("the stored description is what it was", !!(bs && bs.ok && as && as.ok && bs.description === as.description),
      `before ${JSON.stringify(bs && bs.ok ? bs.description : "UNREADABLE")}, after ${JSON.stringify(as && as.ok ? as.description : "UNREADABLE")}`);
  }
  // THE MENU: every page that had one gained exactly the one item, pointing at
  // the new page, and kept every item it had in its order; every served
  // header links it. Its words are judged only where the request asked for
  // some (`labelFits`).
  const fb = frameOf(bPages), fa = frameOf(aPages);
  const framed = [...fb.keys()].filter((p) => fb.get(p).menus.length);
  // THE ROUTES THOSE PAGES SERVE: a served page is judged for its frame only
  // where its stored source has one (the bakery's unfinished page has none).
  const framedRoutes = framed.map((p) => routeOfPage(b.get(p))).filter(Boolean);
  if (want.menu) {
    const target = pf.found[want.menu.page || 0];
    const href = target && target.route;
    const bad = [];
    if (!href) bad.push("the page it links to was not found");
    for (const p of framed) {
      const was = fb.get(p).menus, now = (fa.get(p) || { menus: [] }).menus;
      if (now.length !== was.length) { bad.push(`${p} has ${now.length} menus, not ${was.length}`); continue; }
      was.forEach((items, i) => {
        const got = now[i];
        const extra = got.filter((it) => !items.some((x) => x.label === it.label && x.href === it.href));
        const kept = got.filter((it) => items.some((x) => x.label === it.label && x.href === it.href));
        if (extra.length !== 1 || extra[0].href !== href || !labelFits(extra[0].label, want.menu)) bad.push(`${p}'s menu gained ${JSON.stringify(extra)}`);
        if (JSON.stringify(kept) !== JSON.stringify(items)) bad.push(`${p}'s menu did not keep its own items in their order`);
      });
    }
    const words = labelWords(want.menu);
    add(`every page's menu gained ${words ? `"${words}"` : "one labelled link"} → ${href || "the new page"} (${words ? "the words asked for" : "no words were asked for"}) and kept every item it had`, complete && framed.length > 0 && !bad.length, bad.join("; ") || "no menu was read");
    const off = framedRoutes.filter((r) => !anchors(region(served && served[r], "header")).some((x) => x.href === href && labelFits(x.text, want.menu)));
    add(`every served header links ${words ? `"${words}" to ${href || "the new page"} (the words asked for)` : `${href || "the new page"} with a label (no words were asked for)`}`, !!href && framedRoutes.length > 0 && !off.length, `not on ${off.join(", ") || "any page read"}`);
  }
  // A LINK SOME MENUS ALREADY CARRY, FINISHED (2026-10-04, the focused check of
  // run 95's fixes): every menu that lacked it gained exactly it, keeping its
  // own items in their order; every menu that had it is as it was; at least
  // one menu gained it; and every served header links it. A page with no menu
  // is judged by the byte-for-byte check below, so none is given one.
  if (want.menuFinish) {
    const { href } = want.menuFinish;
    const words = labelWords(want.menuFinish);
    const bad = [];
    let gained = 0;
    for (const p of framed) {
      const was = fb.get(p).menus, now = (fa.get(p) || { menus: [] }).menus;
      if (now.length !== was.length) { bad.push(`${p} has ${now.length} menus, not ${was.length}`); continue; }
      was.forEach((items, i) => {
        const got = now[i];
        if (items.some((x) => x.href === href)) {
          if (JSON.stringify(got) !== JSON.stringify(items)) bad.push(`${p}'s menu already had it and changed to ${JSON.stringify(got)}`);
          return;
        }
        const extra = got.filter((it) => !items.some((x) => x.label === it.label && x.href === it.href));
        const kept = got.filter((it) => items.some((x) => x.label === it.label && x.href === it.href));
        if (extra.length !== 1 || extra[0].href !== href || !labelFits(extra[0].label, want.menuFinish)) bad.push(`${p}'s menu gained ${JSON.stringify(extra)}`);
        else gained++;
        if (JSON.stringify(kept) !== JSON.stringify(items)) bad.push(`${p}'s menu did not keep its own items in their order`);
      });
    }
    add(`every menu that lacked ${words ? `"${words}"` : "a link"} → ${href} gained ${words ? "it (the words asked for)" : "one, labelled (no words were asked for)"}, keeping its own items, and every menu that had it is as it was`, complete && framed.length > 0 && gained > 0 && !bad.length,
      bad.join("; ") || (framed.length ? "no menu gained it" : "no menu was read"));
    const off = framedRoutes.filter((r) => !anchors(region(served && served[r], "header")).some((x) => x.href === href && labelFits(x.text, want.menuFinish)));
    add(`every served header links ${words ? `"${words}" to ${href} (the words asked for)` : `${href} with a label (no words were asked for)`}`, framedRoutes.length > 0 && !off.length, `not on ${off.join(", ") || "any page read"}`);
  }
  // THE FOOTER'S SOCIAL LINKS: the one profile, once, beside what was there.
  if (want.social) {
    const bad = [];
    for (const p of framed) {
      const was = fb.get(p).social, now = (fa.get(p) || { social: [] }).social;
      const extra = now.filter((it) => !was.some((x) => x.network === it.network && x.href === it.href));
      if (extra.length !== 1 || plain(extra[0].network) !== plain(want.social.network) || !profileMatches(extra[0].href, want.social)) bad.push(`${p}'s footer gained ${JSON.stringify(extra)}`);
      if (!was.every((x) => now.some((it) => it.network === x.network && it.href === x.href))) bad.push(`${p}'s footer lost a link`);
    }
    add(`every page's footer gained the ${want.social.network} link to ${want.social.host}${want.social.path} and kept every link it had`, complete && framed.length > 0 && !bad.length, bad.join("; ") || "no footer was read");
    const off = framedRoutes.filter((r) => !anchors(region(served && served[r], "footer")).some((x) => profileMatches(x.href, want.social)));
    add(`every served footer links to ${want.social.host}${want.social.path}`, framedRoutes.length > 0 && !off.length, `not on ${off.join(", ") || "any page read"}`);
  }
  // THE LINE OF WORDS, stored and served: nothing the page said is gone, and
  // what is new is one line stating what was asked, undenied.
  const rest = (p, src) => withoutAdditions(p, src, { menu: !!(want.menu || want.menuFinish), social: !!want.social });
  const wordsAt = want.words ? pageForRoute(bPages, want.words.route) : null;
  if (want.words) {
    const now = wordsAt ? a.get(wordsAt.path) : undefined;
    if (!wordsAt || now === undefined) add(`${want.words.route} was read before and after`, false, `${want.words.route} is missing from a read`);
    else {
      const wb = wordsOf(rest(wordsAt.path, wordsAt.source)), wa = wordsOf(rest(wordsAt.path, now));
      const lost = less(wb, wa);
      add(`${want.words.route} still says everything it said`, !lost.length, `lost: ${JSON.stringify(lost.slice(0, 6))}`);
      const line = less(wa, wb).join(" ");
      const gained = visible(changedSpan(rest(wordsAt.path, wordsAt.source), rest(wordsAt.path, now)));
      const cap = listOf(want.words.says).join(" ").length + 200;
      add(`${want.words.route} gained a line saying ${listOf(want.words.says).map((w) => `"${w}"`).join(" and ")}, and no more than a line's words`,
        statesAll(line, want.words.says) && statesAll(gained, want.words.says) && !statesAll([...wb.keys()].join(" "), want.words.says) && line.length <= cap,
        `new words: ${JSON.stringify(less(wa, wb).slice(0, 6))}; read off the change: ${JSON.stringify(gained.slice(0, 200))}`);
      const pb = photosOf(wordsAt.source, slug), pa = photosOf(now, slug);
      const moved = [...new Set([...pb.keys(), ...pa.keys()])].filter((u) => (pb.get(u) || 0) !== (pa.get(u) || 0));
      add(`${want.words.route} shows the same photographs as before`, !moved.length, `changed: ${JSON.stringify(moved)}`);
      const h = served && served[want.words.route];
      add(`the served ${want.words.route} says it`, typeof h === "string" && statesAll(visible(region(h, "main") || h), want.words.says), typeof h === "string" ? "the words are not on the page, or are denied there" : `${want.words.route} was not read`);
    }
  }
  // THE LOGO: every served header draws the attached file, by the address its
  // own bytes name, and the bytes served there are that file's.
  const heads = Object.entries(served || {}).filter(([, h]) => typeof h === "string" && region(h, "header"));
  if (want.logo) {
    const url = `/u/${slug}/${String(want.logo.sha256).slice(0, 32)}.png`;
    const off = heads.filter(([, h]) => { const l = headerLogos(h, slug); return !(l.length > 0 && l.every((u) => u === url)); }).map(([r]) => r);
    add(`every served header draws the attached picture as the logo (${url})`, heads.length > 0 && !off.length, `not on ${off.join(", ") || "any page read"}`);
    add("the logo's served bytes are the attached file's, byte for byte", !!(logo && logo.status === 200 && logo.sha256 === want.logo.sha256 && logo.url === url),
      logo ? `${logo.url || "?"} answered ${logo.status}, sha256 ${String(logo.sha256 || "").slice(0, 16)}…` : "not read");
  } else {
    // A PAGE THE PRESS ADDED had no logo to keep: only the pages served before are compared.
    const kept = heads.filter(([r]) => Object.hasOwn(bRender, r));
    const changed = kept.filter(([r, h]) => JSON.stringify(headerLogos(h, slug)) !== JSON.stringify(headerLogos(beforeServed && beforeServed[r], slug))).map(([r]) => r);
    add("every served header draws the logo it drew before", kept.length > 0 && !changed.length, `changed on ${changed.join(", ") || "no page read"}`);
  }
  // THE ROW (R2), read by the canary's own row readers around the message.
  if (spec && spec.row) {
    const r = row || {};
    const okOf = (k) => !!(r.shown && r.shown[k] && r.shown[k].verdict && r.shown[k].verdict.ok);
    add(`the baseline, immediately before the message: ${spec.row.table} id ${spec.row.id} is ${spec.row.match.name} at ${spec.row.from} on both readers`,
      !!(r.baselineVerdict && r.baselineVerdict.ok), r.baselineVerdict ? r.baselineVerdict.why : "not read");
    add(`the database change is exactly ${spec.row.table} id ${spec.row.id} ${spec.row.field} ${spec.row.from} -> ${spec.row.to}, and nothing else`,
      !!(r.change && r.change.exact), r.change ? JSON.stringify({ target: r.change.target, others: (r.change.others || []).length, added: r.change.added, gone: r.change.gone }) : "not read");
    add("a visitor's read shows that one change and nothing else", !!(r.visitorChange && r.visitorChange.exact), r.visitorChange ? JSON.stringify({ target: r.visitorChange.target }) : "not read");
    add(`the ${spec.row.shown.path} page shows ${spec.row.shown.after} for ${spec.row.match.name} and every other line as it was`, okOf("afterEdit"),
      r.shown && r.shown.afterEdit ? (r.shown.afterEdit.target || r.shown.afterEdit.why || "") : "not read");
    add("the canary wrote no row of its own (the change is kept, by the owner's demo-site rule)", !r.writes, `${r.writes} write(s) refused`);
  }
  // EVERYTHING NOT NAMED, AS IT WAS.
  const headed = new Map((Array.isArray(want.headings) ? want.headings : []).map((h) => [h.route, h]));
  const gone = [], moved = [];
  for (const [p, src] of b) {
    if (!a.has(p)) { gone.push(p); continue; }
    const route = routeOfPage(src);
    if (wordsAt && p === wordsAt.path) continue;
    const h = headed.get(route);
    if (h) {
      const v = headingOnly(rest(p, src), rest(p, a.get(p)), h.from, h.to);
      if (!v.ok) moved.push(`${p}: ${v.why}`);
    } else if (rest(p, a.get(p)) !== rest(p, src)) moved.push(`${p} changed`);
  }
  add("no stored page was removed", complete && !gone.length, `gone: ${gone.join(", ")}`);
  add("every stored page is byte for byte as it was, apart from the named changes", complete && !moved.length, moved.join("; "));
  const newFiles = [...a.keys()].filter((p) => !b.has(p));
  const meant = pf.found.map((f) => f.path).filter(Boolean);
  add(`no page file was added${meant.length ? " beyond the new page's own" : ""}`, complete && newFiles.every((p) => meant.includes(p)), `added: ${newFiles.filter((p) => !meant.includes(p)).join(", ")}`);
  const bParts = byPath(before && before.source ? before.source.parts : []), aParts = byPath(after && after.source ? after.source.parts : []);
  const partMoved = [...bParts].filter(([p, src]) => aParts.get(p) !== src).map(([p]) => p);
  const partNew = [...aParts.keys()].filter((p) => !bParts.has(p));
  add("every stored component is byte for byte as it was", complete && !partMoved.length, `changed or gone: ${partMoved.join(", ")}`);
  add(`no component was added${(want.pages || []).length ? " beyond what a new page brings" : ""}`, complete && (!partNew.length || (want.pages || []).length > 0), `added: ${partNew.join(", ")}`);
  const routesGone = Object.keys(bRender).filter((r) => !(aRender[r] && aRender[r].status === 200));
  add("every page that was served before is still served 200", !routesGone.length, `not served: ${routesGone.join(", ")}`);
  // THE DATABASE, AS ITS OWNER LISTS IT: the same tables, each with the same
  // rules, columns and number of rows. A new table, or a rule changed by a
  // part nobody asked for, shows here.
  // A PRESS THAT ASKS FOR A NEW TABLE (`want.tables`, 2026-10-05) gets that
  // many, each with the rules and the column named, and every other table as
  // it was.
  const tb = tables && tables.before, ta = tables && tables.after;
  if (!(tb && tb.ok && ta && ta.ok)) add("the site's tables were read before and after", false, `${tb ? (tb.ok ? "after" : "before: " + tb.why) : "before"} not read${ta && !ta.ok ? "; after: " + ta.why : ""}`);
  else {
    const diff = [];
    const added = [];
    for (const n of new Set([...tb.names, ...ta.names])) {
      const x = tb.tables[n], y = ta.tables[n];
      if (!x) { if (want.tables) added.push(n); else diff.push(`${n} is new`); continue; }
      if (!y) { diff.push(`${n} is gone`); continue; }
      if (x.access !== y.access) diff.push(`${n}'s rules ${x.access} -> ${y.access}`);
      if (JSON.stringify(x.columns) !== JSON.stringify(y.columns)) diff.push(`${n}'s columns changed`);
      if (x.rows !== y.rows) diff.push(`${n} ${x.rows} -> ${y.rows} rows`);
    }
    if (want.tables) {
      const t = want.tables;
      const fits = (n) => {
        const y = ta.tables[n];
        return !!(y && y.pair && y.pair.read === t.pair.read && y.pair.write === t.pair.write && y.columns.some((c) => String(c).toLowerCase().includes(t.column)));
      };
      add(`exactly ${t.added} new table${t.added === 1 ? "" : "s"}, read ${t.pair.read} and written by ${t.pair.write}, with a column for ${t.column}`,
        added.length === t.added && added.every(fits),
        added.length ? added.map((n) => `${n}: ${JSON.stringify({ access: ta.tables[n].access, columns: ta.tables[n].columns })}`).join("; ") : "no new table");
      add("every other table is as it was: the same rules, columns and row counts", !diff.length, diff.join("; "));
    } else add("the site's tables are as they were: the same tables, rules, columns and row counts", !diff.length, diff.join("; "));
  }
  return { checks: out, newPages: pf };
}

// ── WHICH PATH THE RUN TOOK ─────────────────────────────────────────────────

/** Every part each message's request ended with, in order. */
const partsOf = (steps) => (Array.isArray(steps) ? steps : []).flatMap((s) => { const f = finalOf(s); return f && Array.isArray(f.parts) ? f.parts : []; });

/**
 * THE COVERAGE A PRESS IS FOR (`spec.covers`), each read off what the run did:
 * covered, not covered (the run took another valid path, or failed before
 * it), with why. Never a check: the same outcome may come by another path.
 */
export const COVERAGE = Object.freeze({
  "edit-and-addon": (steps) => {
    const done = partsOf(steps).filter((p) => p && p.status === "done");
    const add = done.some((p) => p.route === "addon"), edit = done.some((p) => p.route && p.route !== "addon" && p.addition !== true);
    return { covered: add && edit, why: `${add ? "an" : "no"} add-on part and ${edit ? "an" : "no"} edit part of the message's own finished` };
  },
  "several-parts": (steps) => {
    const n = partsOf(steps).length;
    return { covered: n >= 2, why: `${n} part(s)` };
  },
  "waits-for-prerequisite": (steps) => {
    const s = (steps || [])[0];
    const r = s ? relationsOf(s) : { relations: [], unread: [], blocked: [] };
    const j = s ? jobOrderVerdict(s) : null;
    return { covered: r.relations.length > 0 && !!j && j.ok && !j.vacuous, why: r.relations.length ? `${r.relations.map((x) => `part ${x.part} waited for part ${x.needs}`).join("; ")}${j && !j.ok ? ` — but ${j.why}` : ""}` : `the routing answer named no order${r.blocked.length ? ` (parts ${r.blocked.join(", ")} were blocked)` : ""}` };
  },
  "addon-sets-aside": (steps) => {
    const s = (steps || [])[0];
    const route = routeCallOf(s && s.network);
    const accepted = route && route.res && route.res.request && Array.isArray(route.res.request.parts) ? route.res.request.parts.length : 0;
    const carved = partsOf([s]).filter((p) => p && p.n >= accepted && p.addition === true);
    return { covered: carved.some((p) => p.status === "done"), why: carved.length ? carved.map((p) => `part ${p.n} "${p.words}" set aside by the add-on step, ${p.status}${p.route ? " @" + p.route : ""}`).join("; ") : `no part was set aside by the add-on step (the request began with ${accepted} part(s))` };
  },
  "step-question": (steps) => {
    const s = (steps || []).find((x) => x && x.mode === "question");
    const q = s && s.question;
    const other = s ? (finalOf(s) || { parts: [] }).parts.filter((p) => p && p.status === "done") : [];
    return { covered: !!q && q.by === "step" && other.length > 0, why: !q ? "no question was asked" : q.by !== "step" ? "the router asked the question, before any request was opened" : other.length ? `part ${q.part} asked while ${other.map((p) => "part " + p.n).join(", ")} finished` : `part ${q.part} asked, and no other part had finished` };
  },
  "answer-resumes": (steps) => {
    const i = (steps || []).findIndex((x) => x && x.mode === "question");
    const q = i >= 0 ? steps[i].question : null;
    const next = i >= 0 ? steps[i + 1] : null;
    const route = routeCallOf(next && next.network);
    const res = route && route.res && typeof route.res === "object" ? route.res : {};
    const ok = !!q && q.by === "step" && !!res.resumed && res.resumed.key === q.key && res.resumed.part === q.part;
    return { covered: ok, why: ok ? `the answer resumed part ${q.part} of request ${q.key}` : !q ? "no question was asked" : !next || !next.sent ? "the answer was not sent" : `the answer's routing names ${res.resumed ? JSON.stringify(res.resumed) : "no resumed part"}` };
  },
  "file-to-later-part": (steps) => {
    const s = (steps || []).find((x) => x && x.file);
    const logo = s ? partsOf([s]).find((p) => p && p.route === "logo") : null;
    return { covered: !!logo && logo.n > 0 && logo.status === "done", why: !logo ? "no part went to the logo step" : logo.n === 0 ? "the logo was the request's first part" : `part ${logo.n}, the logo, read the request's file, ${logo.status}` };
  },
  "closed-tab": (steps) => {
    const s = (steps || []).find((x) => x && x.mode === "away");
    const a = s && s.away;
    const ok = !!a && a.closed === true && a.ended === true && Array.isArray(a.calls) && a.calls.length === 0;
    return { covered: ok, why: !a ? "the tab was not closed" : ok ? `ended ${Math.round((a.endedMs || 0) / 1000)} s after the tab closed, read ${a.reads} time(s) through the list alone` : "the request did not end while the tab was closed" };
  },
  // EVERY PART SHOWED A PROGRESS LINE (2026-10-06): recorded, never failed on —
  // a part that finishes between two milestones' lines is told by its reply.
  "progress-each-part": (steps) => {
    const s = (steps || []).find((x) => x && x.mode === "fresh");
    const f = s && s.fresh;
    if (!f) return { covered: false, why: "the message was not read in a fresh browser session" };
    const most = new Map();
    for (const snap of [...arrOf(f.before), ...arrOf(f.after)]) {
      for (const p of arrOf(snap && snap.parts)) most.set(p.n, Math.max(most.get(p.n) || 0, listOf(p.lines).length));
    }
    const each = [...most.entries()].sort((a, b) => a[0] - b[0]);
    return { covered: each.length > 0 && each.every(([, c]) => c > 0), why: each.length ? each.map(([n, c]) => `part ${n}: ${c} line(s) at most`).join("; ") : "no part was read" };
  },
});

// ── WHAT THE CUSTOMER WAS SHOWN WHILE THE WORK RAN (2026-10-06) ──────────────

/**
 * THE PROGRESS LIVE CHECK'S OWN SIDE, for a press that asks (`expect.progress`),
 * read off the message sent with its tab closed once its progress showed and
 * read afterwards in a fresh browser session (`away: "fresh"`). Every one
 * fails the press:
 * - BEFORE THE END: a progress line was on screen in the tab that sent it
 *   while the request still ran, and that tab was then closed with the
 *   request still running;
 * - WITH NO PAGE OPEN: the request was read through the requests list alone,
 *   which named it, and nothing read the request's own route;
 * - THE FRESH SESSION: signed in afresh as the same account, it found the
 *   request on the server and drew its card; showed every line the sending
 *   tab had shown; and followed the request to its end, every part's reply on
 *   screen;
 * - THE MODEL'S OWN LINES FOR EACH STATE: a running part was named by the
 *   model's line for doing it, and at the end every part was done and named
 *   by its line for having done it.
 * The words themselves are recorded, never judged: no length, no keyword.
 */
export function progressChecks({ steps }) {
  const out = [];
  const add = (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const s = arrOf(steps).find((x) => x && x.mode === "fresh");
  const f = s && s.fresh;
  if (!f) {
    const sent = arrOf(steps).some((x) => x && x.sent === true);
    add("the message was sent with its tab closed once its progress showed, and read in a fresh browser session", false, sent ? "it was not followed that way" : "no message was sent");
    return out;
  }
  const lines = (list) => {
    const got = new Set();
    for (const snap of arrOf(list)) for (const p of arrOf(snap && snap.parts)) for (const l of listOf(p.lines)) got.add(`${p.n}\u0000${l}`);
    return got;
  };
  // THE FIRST LINE, READ OFF THE SENDING TAB'S OWN SNAPSHOTS, never taken on
  // the driver's word (2026-10-06, Codex's reproduction): it must have been
  // live on its own running part in a reading made while the request ran. A
  // done part's kept line, shown while another part waited, is not progress.
  const first = f.first && typeof f.first === "object" && typeof f.first.line === "string" && f.first.line ? f.first : null;
  const firstLive = !!first && arrOf(f.before).some((snap) => snap && snap.ended !== true && arrOf(snap.parts).some((p) => p.n === first.part && liveOnItsPart(p) && p.live === first.line));
  add("a progress line was on screen in the tab that sent the message, live on its own running part, while the request still ran", firstLive,
    first ? `the line taken (part ${first.part}, ${first.status || "?"}) was never live on its own running part in the sending tab's readings`
      : f.closedRunning === false ? "the request had ended before any line was shown live" : "no line was shown live on a running part before the tab was closed");
  add("the tab that sent it was then closed, the request still running", f.closed === true && f.closedRunning === true,
    f.closed !== true ? "the tab was not closed" : "the request had already ended when the tab was closed");
  const away = f.away || {};
  const calls = arrOf(away.calls);
  add("with no page open, the request was read through the requests list alone, and nothing read its own route",
    (away.reads || 0) > 0 && arrOf(away.list).some((x) => x && x.found) && calls.length === 0,
    !away.reads ? "the list was never read" : calls.length ? `its own route was read ${calls.length} time(s) with no page open` : "the list never named the request");
  const re = f.reopened || {};
  add("a fresh browser session, signed in afresh as the same account, found the request on the server and drew its card",
    re.ok === true && re.found === true && re.newSession === true && re.sameAccount === true,
    re.ok !== true ? re.why || "it did not open" : re.newSession !== true ? "its session was the first tab's" : re.sameAccount !== true ? "it was signed in as another account" : re.why || "it never drew the request's card");
  const before = lines(f.before), after = lines(f.after);
  const lost = [...before].filter((x) => !after.has(x));
  add("the fresh session showed every progress line the sending tab had shown", before.size > 0 && !lost.length,
    before.size === 0 ? "the sending tab showed no line" : `not shown again: ${lost.map((x) => JSON.stringify(x.split("\u0000")[1])).join(", ")}`);
  add("the fresh session followed the request to its end, every part's reply on screen", re.closed === true, re.why || "the request was not shown closed");
  const all = [...arrOf(f.before), ...arrOf(f.after)];
  const said = (p, state) => !!(p && p.said && typeof p.said[state] === "string" && p.said[state] && p.words === p.said[state]);
  add("while a part ran, its card named it by the model's own line for doing it",
    all.some((snap) => arrOf(snap && snap.parts).some((p) => p.status === "started" && said(p, "doing"))),
    "no running part was shown with the model's doing line");
  const tail = arrOf(f.after);
  const last = tail.length ? tail[tail.length - 1] : null;
  const parts = last ? arrOf(last.parts) : [];
  const off = parts.filter((p) => !(p.status === "done" && said(p, "done")));
  add("at its end every part was done, and named by the model's own line for having done it", parts.length > 0 && !off.length,
    parts.length ? off.map((p) => `part ${p.n} ${p.status || "?"} shown as ${JSON.stringify(p.words)}`).join("; ") : "the fresh session's card was never read");
  return out;
}

export function coverageOf({ spec, steps }) {
  return listOf(spec && spec.covers).map((name) => {
    const f = Object.hasOwn(COVERAGE, name) ? COVERAGE[name] : null;
    if (!f) return { name, covered: false, why: "not a coverage this canary knows" };
    try { return { name, ...f(steps) }; } catch (e) { return { name, covered: false, why: `could not be read (${String((e && e.message) || e).slice(0, 80)})` }; }
  });
}

// ── THE LIVE CHECK OF THE PAGE'S REFRESH (2026-10-05) ─────────────────────────

/** The preview's `v` an address carries, or null. */
export function previewVOf(addr) {
  if (typeof addr !== "string" || !addr) return null;
  try {
    const v = new URL(addr, "https://preview.invalid/").searchParams.get("v");
    return v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null;
  } catch { return null; }
}
const pathAndQuery = (addr) => { try { const u = new URL(addr, "https://preview.invalid/"); return u.pathname + u.search; } catch { return ""; } };

/**
 * THE PAGE'S OWN SIDE OF A PRESS THAT ASKS FOR IT (`expect.live`), read off the
 * record, beside the usual checks. Every one fails the press:
 * - EACH REPLY WITH ITS REQUEST: no other request's reply is drawn after a
 *   message, each of its own is drawn after it, and an earlier message's
 *   replies stay before the next message (read by the jobs they are marked
 *   with, on the next message's thread);
 * - THE PREVIEW: once a message is done its frame was given a newer address
 *   than before its Send, and the tab showing it loaded that address — the
 *   tab opened afterwards, for a message sent with its tab closed and every
 *   message after it;
 * - THE INVENTORY: the first message's routing answer named the site's tables
 *   (every one its owner lists), the router's input; once it was done, the
 *   page's own lists hold the new page and every table, the new one with
 *   them; the next message's routing call sent them all and its answer named
 *   them all; and once that one was done the page's tables are what that
 *   answer read.
 * The tables are compared as sets, by name, against the first answer's names
 * and the owner's listing of what is new — never against a fixed list.
 */
export function liveChecks({ steps, tables, newPages, frameLoads }) {
  const out = [];
  const add = (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const list = Array.isArray(steps) ? steps : [];
  const low = (l) => (Array.isArray(l) ? l.filter((x) => typeof x === "string").map((x) => x.toLowerCase()) : null);
  const holds = (l, names) => { const x = low(l); return !!x && names.every((nm) => x.includes(nm)); };
  const same = (a, b) => { const x = low(a), y = low(b); return !!x && !!y && [...new Set(x)].sort().join("\n") === [...new Set(y)].sort().join("\n"); };
  const loads = Array.isArray(frameLoads) ? frameLoads : [];
  const shown = (v) => (Array.isArray(v) ? JSON.stringify(v) : "no list");
  // EACH REPLY WITH ITS REQUEST.
  list.forEach((s, i) => {
    if (!s || !s.sent) return;
    const others = Array.isArray(s.otherReplies) ? s.otherReplies : null;
    add(`message ${s.n}: no other request's reply is drawn after it`, !!others && !others.length,
      others ? `${others.length} drawn after it: ${JSON.stringify(others.slice(0, 3))}` : "its thread was not read");
    const mine = s.replyWatch && Array.isArray(s.replyWatch.attributed) ? s.replyWatch.attributed : null;
    add(`message ${s.n}'s own replies are drawn after it`, !!mine && mine.length > 0 && Number.isInteger(s.at) && s.at >= 0 && mine.every((k) => k > s.at),
      !mine ? "its replies were not watched" : !mine.length ? "none of its replies was found on screen" : `the message is at ${s.at}, its replies at ${mine.join(", ")}`);
    const prev = i > 0 ? list[i - 1] : null;
    if (prev && prev.sent) {
      const jobs = new Set(Array.isArray(prev.jobs) ? prev.jobs : []);
      const thread = Array.isArray(s.thread) ? s.thread : [];
      const marked = thread.map((m, k) => (m && m.job && jobs.has(m.job) ? k : -1)).filter((k) => k >= 0);
      let from = -1;
      thread.forEach((m, k) => { if (m && m.who === "u" && m.text === String(prev.say || "").slice(0, 80)) from = k; });
      add(`message ${prev.n}'s replies stay with it, before message ${s.n}`,
        marked.length > 0 && from >= 0 && Number.isInteger(s.at) && s.at > from && marked.every((k) => k > from && k < s.at),
        !marked.length ? `none of message ${prev.n}'s replies is marked on the thread` : `message ${prev.n} at ${from}, its replies at ${marked.join(", ")}, message ${s.n} at ${s.at}`);
    }
  });
  // THE PREVIEW.
  list.forEach((s, i) => {
    if (!s || !s.sent) return;
    // A MESSAGE SENT WITH ITS TAB CLOSED IS JUDGED AGAINST THE ADDRESS THE TAB
    // OPENED AFTERWARDS FIRST SHOWED (2026-10-05, run 101): the first tab moves
    // its own preview after a send — its first look at the site's earlier
    // requests reconciles them — so the reopened tab can open at an address
    // newer than the one read before the send, and a check against that one
    // could not fail with no reconcile at all. Its own first address is
    // captured off the frame's loads before anything could move it.
    const away = s.mode === "away";
    const re = away && s.away && s.away.reopened && typeof s.away.reopened === "object" ? s.away.reopened : null;
    const before = away ? (re && typeof re.firstFrame === "string" ? re.firstFrame : null) : (s.typed ? s.typed.frame : null);
    const after = s.view ? s.view.frame : null;
    const vb = previewVOf(before), va = previewVOf(after);
    // THE TAB THAT SHOWS IT: the run's first is 1, each closed-tab message opens the next.
    const tab = away && re && Number.isInteger(re.frameTab) ? re.frameTab : 1 + list.slice(0, i + 1).filter((x) => x && x.mode === "away").length;
    add(`message ${s.n}: the preview was given a newer address once it was done${away ? " than the tab opened afterwards first showed" : ""}`,
      vb !== null && va !== null && va > vb,
      away ? `the tab opened afterwards first showed ${before || "nothing that was seen"}, once done ${after || "unread"}` : `before the send ${before || "unread"}, once done ${after || "unread"}`);
    // A NEWER ADDRESS, LOADED: an address the frame already had is not one,
    // however often that tab loaded it.
    const want = after && vb !== null && va !== null && va > vb ? pathAndQuery(after) : "";
    add(`message ${s.n}: that tab's preview loaded the newer address`, !!want && loads.some((f) => f && f.tab === tab && f.path === want),
      want ? `tab ${tab} loaded ${loads.filter((f) => f && f.tab === tab).map((f) => f.path).join(", ") || "nothing"}` : "there was no newer address to look for");
  });
  // THE INVENTORY.
  const tb = tables && tables.before, ta = tables && tables.after;
  const known = !!(tb && tb.ok && ta && ta.ok);
  const added = known ? ta.names.filter((nm) => !tb.names.includes(nm)) : [];
  const page = newPages && Array.isArray(newPages.found) && newPages.found[0] && newPages.found[0].route ? newPages.found[0].route : "";
  const first = list[0], second = list[1];
  const answer = (s) => { const r = routeCallOf(s && s.network); return r && r.res && typeof r.res === "object" ? r.res : null; };
  const firstNamed = first && first.sent ? low((answer(first) || {}).tablesFilled) : null;
  if (first && first.sent) {
    add(`message 1's routing answer named every table the site had (${known ? tb.names.join(", ") || "none" : "unread"}): what the router was told`,
      known && !!firstNamed && holds(firstNamed, tb.names) && !added.some((nm) => firstNamed.includes(nm)),
      `it named ${firstNamed ? JSON.stringify(firstNamed) : "no list"}`);
    const v = first.view || {};
    add(`once message 1 was done, the page's own pages hold the new page (${page || "not found"})`, !!page && Array.isArray(v.pages) && v.pages.includes(page), `the page's pages: ${shown(v.pages)}`);
    add(`once message 1 was done, the page's own tables hold the new one (${added.join(", ") || "none new"}) and every one that answer named`,
      known && added.length > 0 && !!firstNamed && holds(v.tables, [...firstNamed, ...added]), `the page's tables: ${shown(v.tables)}`);
  }
  if (second && second.sent) {
    const r = routeCallOf(second.network);
    const hint = r && r.req && r.req.site && typeof r.req.site === "object" ? r.req.site.tables : undefined;
    const named = (answer(second) || {}).tablesFilled;
    const all = [...(firstNamed || []), ...added];
    add("message 2's routing call sent every table, the new one with them", known && added.length > 0 && !!firstNamed && holds(hint, all), `it sent ${shown(hint)}`);
    add("message 2's routing answer named every table, the new one with them: what the router was told", known && added.length > 0 && !!firstNamed && holds(named, all), `it named ${shown(named)}`);
    const v = second.view || {};
    add("once message 2 was done, the page still holds the new page, and its tables are what that answer read",
      !!page && Array.isArray(v.pages) && v.pages.includes(page) && Array.isArray(named) && same(v.tables, named),
      `the page's pages: ${shown(v.pages)}; its tables: ${shown(v.tables)}`);
  }
  return out;
}

/**
 * THE WHOLE VERDICT OF ONE PRESS: each message's request, the job order, the
 * site's changes and everything else as it was, the replies — and, beside
 * them and never in them, the coverage. Taken whether or not every message was
 * sent, so a stopped press records why it did not pass. A press that asks for
 * it (`expect.live`) is judged on the page's own side too (`liveChecks`).
 */
export function requestBatchVerdict({ spec, steps, before, after, served, beforeServed, logo, row, tables, slug, frameLoads }) {
  const checks = [];
  const want = Array.isArray(spec && spec.steps) ? spec.steps : [];
  want.forEach((_, i) => {
    const s = (Array.isArray(steps) ? steps : [])[i];
    if (!s || !s.sent) { checks.push({ name: `message ${i + 1} was sent`, ok: false, why: "it was not sent" }); return; }
    checks.push(...requestStepChecks(s, spec));
    const j = jobOrderVerdict(s);
    checks.push({ name: `message ${i + 1}: no part started before a part it needs had finished${j.vacuous ? " (no part waited for another)" : ""}`, ok: j.ok, why: j.ok ? "" : j.why });
  });
  const o = outcomeChecks({ spec, before, after, served, beforeServed, logo, row, tables, slug });
  checks.push(...o.checks);
  if (spec && spec.expect && spec.expect.live === true) checks.push(...liveChecks({ steps, tables, newPages: o.newPages, frameLoads }));
  // SUBSTANTIVE PREPARATION BESIDE ANOTHER PART'S EXECUTION (2026-10-09), for a press that asks: the first message's request, by recorded intervals.
  if (spec && spec.expect && spec.expect.overlap === true) {
    const v = overlapVerdict(steps);
    checks.push({ name: "message 1: a part's prepared step ran while another part's job was executing, by their recorded intervals", ok: v.ok, why: v.ok ? v.said : v.why });
  }
  // WHAT THE CUSTOMER WAS SHOWN WHILE THE WORK RAN (2026-10-06), for a press that asks.
  if (spec && spec.expect && spec.expect.progress === true) checks.push(...progressChecks({ steps }));
  const replies = replyChecks(steps);
  const coverage = coverageOf({ spec, steps });
  return { ok: checks.every((c) => c.ok) && replies.every((c) => c.ok), checks, replies, coverage, newPages: o.newPages };
}
