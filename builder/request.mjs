// ONE MESSAGE, SEVERAL PARTS, FINISHED ON THE SERVER (2026-10-03).
//
// Owner: *"one user message can request multiple edits and additions, and all
// accepted parts are remembered and processed without the user resending them
// or keeping the browser open … Let the model identify each operation, its
// scope, target and dependencies … Code should validate the plan and manage
// execution, ordering, persistence and recovery … Run parts sequentially
// against the latest site state, keeping each part's existing publish and
// charging behavior. Move the existing browser-driven handoffs to server
// coordination and reuse existing leases, site locks, idempotency, publication
// checkpoints and billing records wherever possible."*
//
// ── WHAT THIS MODULE IS ──────────────────────────────────────────────────────
//
// The decisions, and nothing that touches storage or the network, so every one
// of them is driven by a test with literal inputs. `worker.js` keeps the
// record in the site bucket, files the jobs and reads their rows; this module
// says what the record is, which parts a routing answer makes, what a job's
// stored answer means for its part, where a hand-over goes, and which job runs
// next.
//
// ── THE SHAPE OF IT ──────────────────────────────────────────────────────────
//
//   * A REQUEST is one message the routing call accepted for work: the message
//     itself, the browser's choices every part needs (the picked model, the
//     time zone, the undo rows, the site digest), durable copies of its files,
//     the answers given, and its PARTS.
//   * A PART is a passage of that message: its own words (found in the
//     message), the parts it needs done first (named by the model), and the
//     routing answer it runs with once it has one. The part the routing call
//     answered runs with that answer; every other part is routed when its turn
//     comes, against the site as it is then, by the same router.
//   * EVERY STEP OF A PART IS AN ORDINARY QUEUED JOB — routing it (`ROUTE_OP`)
//     and running it (`edit` or `addon`) — filed under a key derived from the
//     request (`jobKey`), so filing it twice finds the same `edit_jobs` row.
//     The claim, the lease, the site lock, the reserves, the publish marks,
//     the refund, the sweeps and the reconcile are the job runner's, as for
//     any job. A part's state is read from its jobs' rows; nothing here holds
//     a mark a crash could leave behind.
//   * ONE JOB OF A REQUEST IS LIVE AT A TIME, so a request's writes are
//     sequential, and the site's lock keeps them sequential across requests.
//   * POLICY: an independent part runs whatever happened to another; a part
//     that needs one which failed, was stopped, expired, or needs a go-ahead
//     is not run, and says which.
//
// What decides is always a model's structured answer read by code — which
// parts there are (`alsoAsked`, the picker's `elsewhere`, the look door's held
// additions), which needs which (`dependsOn`), what each part is and where it
// goes (the router, every step) — never a keyword, and never the position of
// words in the message, which only breaks ties between parts with no relation.
import { heldList, heldParts, wordsIn, readContext, EDIT_LAYERS } from "./site-ask.mjs";
import { MAX_INPUT_CHARS, MAX_CARRIED_CHARS } from "./input-budget.mjs";
import { REQUEST_KEY_RE } from "./clarify.mjs";
import { outcomeOf } from "./site-reply.mjs";

export const REQUEST_V = 1;

/**
 * THE SWITCH (2026-10-03): `REQUEST_FLOW` = an affirmative word, read the way
 * `EDIT_ASYNC` is. Off, no message is taken on as a request and every message
 * runs as it did — the page drives its steps — so a deploy with it off changes
 * nothing a customer or the UI canary sees. On, a site's message sent with its
 * key, where edits are queued, is finished on the server. Read only where a
 * message is accepted: requests already taken on go on to their end either way.
 */
export function requestFlowOn(env) {
  const v = env && env.REQUEST_FLOW;
  return typeof v === "string" && ["1", "true", "on", "yes"].includes(v.trim().toLowerCase());
}

// ── WHERE A REQUEST LIVES (the site bucket; no new storage) ─────────────────
//
// `requests/<slug>/<key>.json` is the record: created once (`etagDoesNotMatch:
// "*"`, the write a queued job's reply already uses) and moved only on the
// etag it was read under, as the site's question is. `requests-live/<slug>/<key>`
// is a marker the two-minute sweep lists, written with the record and kept a
// day after the request ends, so a page opened later — or on another device —
// can show what happened. Files are content-addressed under the record.
// THE MARKERS HAVE A ROOT OF THEIR OWN, never one inside `requests/`: `live` is
// a slug a site may have, and its records' prefix must not be every marker's.
export const REQUEST_ROOT = "requests/";
export const LIVE_ROOT = "requests-live/";
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
export const isRequestKey = (k) => typeof k === "string" && REQUEST_KEY_RE.test(k);
export const isRequestSlug = (s) => typeof s === "string" && SLUG_RE.test(s);
export const recordKey = (slug, key) => REQUEST_ROOT + slug + "/" + key + ".json";
export const liveKey = (slug, key) => LIVE_ROOT + slug + "/" + key;
// ONE ACCEPTANCE'S OWN COPIES (2026-10-03, the owner's review): a message's
// files are kept under the acceptance that wrote them (`attempt`: when it
// began, in base 36, and a random tail), so a copy is named by exactly one
// acceptance's record or by none. Two acceptances of one message never share
// a copy; what a losing or failed acceptance wrote can be let go once no
// record can name it, without touching another's.
export const fileKey = (slug, key, attempt, sha, ext) => REQUEST_ROOT + slug + "/" + key + "/files/" + attempt + "/" + sha + "." + ext;
export const filesPrefix = (slug, key) => REQUEST_ROOT + slug + "/" + key + "/files/";
export const attemptId = (now, hex) => Math.max(0, Math.floor(Number(now) || 0)).toString(36) + "-" + String(hex || "").replace(/[^0-9a-f]/gi, "").slice(0, 16);
/** When an acceptance began, from its own id or a file key under it; `NaN` when it cannot be read. */
export function attemptAt(v) {
  const s = String(v || "");
  const m = /\/files\/([0-9a-z]+)-[0-9a-f]+\//.exec(s) || /^([0-9a-z]+)-[0-9a-f]+$/.exec(s);
  return m ? parseInt(m[1], 36) : NaN;
}
export const requestReplyKey = (slug, key) => REQUEST_ROOT + slug + "/" + key + "/reply.json";
/** Where the two-minute sweep stopped in the markers, so the next tick goes on from there. Never a slug's: slugs have no dot. */
export const SWEEP_CURSOR_KEY = REQUEST_ROOT + "sweep-cursor.json";
/** A live marker's key back as `{ slug, key }`, or `null`. */
export function parseLiveKey(k) {
  if (typeof k !== "string" || !k.startsWith(LIVE_ROOT)) return null;
  const rest = k.slice(LIVE_ROOT.length).split("/");
  if (rest.length !== 2 || !isRequestSlug(rest[0]) || !isRequestKey(rest[1])) return null;
  return { slug: rest[0], key: rest[1] };
}
/** How long a marker stays after its request ended: a page opened within a day still learns how it ended. */
export const LIVE_AFTER_END_MS = 24 * 60 * 60 * 1000;
/**
 * How long a marker may wait for its record before the sweep takes it away:
 * the marker is written first, so one with no record is an acceptance that
 * died between the two writes — or one still writing. Far longer than any
 * acceptance takes, and short enough that the sweep stops reading it soon.
 */
export const ORPHAN_MARKER_MS = 15 * 60 * 1000;
/** How long a part may wait on a question: the question record's own lifetime (`ASK_TTL_MS`). */
export const WAIT_MS = 24 * 60 * 60 * 1000;

// ── ONE JOB PER STEP, NAMED FROM THE REQUEST ────────────────────────────────
//
// `<key>-p<part>-<seq>`: `seq` counts every job filed for the part — its
// routing, its run, a retry, a hand-over, a resume after an answer — so no two
// jobs of a request share a key, and asking for the same step twice answers
// the same row. Inside `edit_create`'s `^[A-Za-z0-9_-]{16,64}$` for every part
// a message can hold.
export const ROUTE_OP = "route";
export const jobKey = (key, n, seq) => key + "-p" + n + "-" + seq;
/** `{ key, n, seq }` from a job key this module minted, or `null`. */
export function readJobKey(k) {
  const m = typeof k === "string" ? /^([A-Za-z0-9_-]{16,64})-p(\d+)-(\d+)$/.exec(k) : null;
  if (!m || !isRequestKey(m[1]) || k.length > 64) return null;
  return { key: m[1], n: Number(m[2]), seq: Number(m[3]) };
}

/** A job that ended with no answer at all is filed once more (D5), its money already back. */
export const RETRIES = 1;
/** Hand-overs one part may make before the full rewrite is the only way left: an edit's, the add-on's, and one more. */
export const HOPS_MAX = 3;

// ── STATUSES ─────────────────────────────────────────────────────────────────
//
// A part is never said to be done, or being done, before its own row says so.
//   blocked        a part it needs is not finished yet
//   ready          it may run; no job is filed for it yet
//   queued         its job is filed and not yet claimed
//   started        its job is claimed and running
//   waiting        it asked a question, and waits for the answer
//   unverified     its job began publishing and could not confirm it (review)
//   done           its job finished and said what changed, or that nothing needed to
//   partial        its job finished and named something it was asked for and did not
//                  do (`notDoneOf`): what it did stands, and nothing that needs it runs
//   failed         its job ended with its own reason
//   not-run        never started: a part it needs did not finish
//   cancelled      stopped before it started, or before it published
//   approval       only the full rewrite of every page could make it: it waits for the
//                  customer's own go-ahead (`approvePart`), its files kept and what needs
//                  it held; approved, it runs the rewrite as a job of its own (`rewrite`)
//   needs-rewrite  the same, in a request recorded before approvals were kept (ended)
//   expired        its question went unanswered for a day
//   refused        it could not be placed in an order that makes sense (the relations formed a cycle)
export const PART_TERMINAL = Object.freeze(["done", "partial", "failed", "not-run", "cancelled", "needs-rewrite", "expired", "refused"]);
const BAD = Object.freeze(["partial", "failed", "not-run", "cancelled", "needs-rewrite", "expired", "refused"]);
const LIVE_JOB = Object.freeze(["queued", "claimed", "routing", "editing", "building", "verifying", "correcting", "rebuilding", "publishing"]);
const ENDED_JOB = Object.freeze(["done", "failed", "cancelled", "lost"]);

// ── THE WIRE THE BROWSER WRITES, WRITTEN ONCE MORE HERE ──────────────────────
//
// `heldWire` and `contextWire` in public/edit-poll.js, which this module cannot
// import (a browser global). The bodies below must be the ones `siteEdit` and
// `siteAddon` post for the same decision, and `test/request-flow.test.mjs`
// cuts those two functions out of chat.js and compares them field for field.
function heldWire(v) {
  if (typeof v === "string") return v ? v : undefined;
  const list = heldList(v);
  if (list === null) return v;
  if (!list.length) return undefined;
  return list.length === 1 ? list[0] : list;
}
function contextWire(v) {
  if (v === null || v === undefined) return undefined;
  const list = readContext(v);
  if (list === null) return v;
  return list.length ? list : undefined;
}
const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

// ── THE RECORD ───────────────────────────────────────────────────────────────

/**
 * A new request, or `null` when anything it needs is missing. `accepted` is
 * the routing call's own answer, handed back whole to a retry of the same
 * message (the same key) so a lost response is never routed or charged twice.
 */
export function newRequest({ key, uid, slug, message, picker = "", tz = "", digest = null, recent = null, files = [], attached = false, context = [], accepted = null, routedCost = null, parts = [], attempt = "", at = Date.now() } = {}) {
  if (!isRequestKey(key) || typeof uid !== "string" || !uid || !isRequestSlug(slug)) return null;
  const text = typeof message === "string" ? message.trim() : "";
  if (!text || text.length > MAX_INPUT_CHARS) return null;
  const told = readContext(context);
  if (told === null) return null;
  const rec = {
    v: REQUEST_V, key, uid, slug, at, updatedAt: at, rev: 1,
    message: text,
    picker: typeof picker === "string" ? picker : "",
    tz: typeof tz === "string" ? tz.slice(0, 64) : "",
    digest: plain(digest) ? digest : null,
    recent: Array.isArray(recent) && recent.length ? recent.slice(0, 3) : null,
    files: Array.isArray(files) ? files.filter((f) => plain(f) && typeof f.key === "string") : [],
    attached: attached === true,
    context: told,
    accepted: plain(accepted) ? accepted : null,
    routedCost: Number.isInteger(routedCost) && routedCost >= 0 ? routedCost : null,
    // WHICH ACCEPTANCE WROTE THIS RECORD: read back after a write whose answer
    // was lost, to tell our own landed record from another acceptance's.
    attempt: typeof attempt === "string" ? attempt : "",
    stop: false,
    parts: Array.isArray(parts) ? parts : [],
    state: "running", ended: false, endedAt: null,
  };
  return settleState(rec);
}

/** A stored record read back, or `null`: the shape is checked, never assumed. */
export function readRequest(raw) {
  let v = raw;
  if (typeof raw === "string") { try { v = JSON.parse(raw); } catch { return null; } }
  if (!plain(v) || v.v !== REQUEST_V || !isRequestKey(v.key) || typeof v.uid !== "string" || !isRequestSlug(v.slug)) return null;
  if (typeof v.message !== "string" || !Array.isArray(v.parts) || !Array.isArray(v.files) || readContext(v.context) === null) return null;
  for (const p of v.parts) {
    if (!plain(p) || !Number.isInteger(p.n) || typeof p.words !== "string" || !Array.isArray(p.needs) || !Array.isArray(p.jobs)) return null;
  }
  return v;
}

function newPart(n, words, { at = 0, source = "router", parent = null, needs = [], route = null, phase = "route" } = {}) {
  return {
    n, words, at, source, parent, needs: needs.slice(), held: [], putOff: [], runs: null,
    route, phase, resume: null, askRound: null,
    seq: 0, retries: 0, hops: 0, jobs: [],
    status: "ready", why: null, question: null, outcome: null, done: null,
  };
}

/** What a routing answer says the part it routed should run with. */
function routeOf(r) {
  const intent = r && r.intent === "addon" ? "addon" : "edit";
  return {
    op: intent, intent,
    layer: intent === "edit" && typeof r.layer === "string" ? r.layer : "",
    page: typeof r.page === "string" ? r.page : "",
    remove: r.remove === true, rename: typeof r.rename === "string" ? r.rename : "", tab: r.tab === true,
    handOver: plain(r.handOver) ? r.handOver : null,
    cost: Number.isInteger(r.cost) && r.cost >= 0 ? r.cost : null,
    handedOff: false, fromAddon: false,
  };
}

// ── THE PLAN ─────────────────────────────────────────────────────────────────

/**
 * THE PARTS OF A MESSAGE, from the routing answer that accepted it.
 *
 * Part 0 is what that answer does — the message less every part it held back
 * (`heldParts`, the routes' own reading) — and runs with that answer. Each
 * held part is a part of its own, routed when its turn comes. `putOff` are
 * parts an earlier question put off (an answer carries them); they join as
 * parts of their own, with no stated order.
 *
 * `{ ok: true, parts }`, or `{ ok: false, why }` when the held parts cannot be
 * read or found in the message: then nothing is planned at all, because
 * running the message whole would run the parts meant for later — the
 * route's own rule for the same case.
 */
export function planParts(message, routed, { putOff = [] } = {}) {
  const text = typeof message === "string" ? message.trim() : "";
  const listed = heldList(routed && routed.alsoAsked);
  if (listed === null) return { ok: false, why: "held-unread" };
  const off = heldList(putOff);
  if (off === null) return { ok: false, why: "put-off-unread" };
  // EVERY HELD PART IS THE CUSTOMER'S OWN WORDS, found in the message.
  const held = [];
  for (const h of listed) {
    const w = wordsIn(text, h);
    if (!w) return { ok: false, why: "held-not-found" };
    held.push(w);
  }
  const split = heldParts(text, listed);
  if (!split.ok) return { ok: false, why: "held-not-found" };
  const parts = [newPart(0, split.run, { at: -1, source: "message", route: routeOf(routed), phase: "run" })];
  // PART 0 RUNS AS THE PAGE WOULD HAVE SENT IT: the whole message, with the
  // router's held parts and the parts an earlier question put off beside it,
  // so the step takes them out itself (`heldBack`) — the same input, through
  // the same reader, as before.
  parts[0].runs = text;
  parts[0].held = listed.slice();
  parts[0].putOff = off.slice();
  // AND WHAT IT IS SHOWN AS: the message with each other part's words marked
  // where they were taken out (…), never the stray commas they leave behind.
  parts[0].shown = shownWithout(text, held);
  // A HELD PART INSIDE ANOTHER IS THAT PART (`heldParts` folds it the same
  // way): its number answers for the outermost part it lies in.
  const outerOf = held.map((w, i) => held.findIndex((o, j) => j !== i && o.length > w.length && !!wordsIn(o, w)));
  const outermost = (i) => { let at = i; for (let k = 0; k < held.length && outerOf[at] >= 0; k++) at = outerOf[at]; return at; };
  const numberOf = [0];
  held.forEach((w, i) => {
    if (outerOf[i] >= 0) return;
    numberOf[i + 1] = parts.length;
    parts.push(newPart(parts.length, w, { at: Math.max(0, text.indexOf(w)), source: "router" }));
  });
  held.forEach((w, i) => { if (outerOf[i] >= 0) numberOf[i + 1] = numberOf[outermost(i) + 1]; });
  for (const w of off) {
    if (parts.some((p) => p.words === w)) continue;
    parts.push(newPart(parts.length, w, { at: Math.max(0, text.indexOf(w)), source: "put-off" }));
  }
  // WHICH NEEDS WHICH, as the model numbered them, through the folding above.
  for (const d of Array.isArray(routed && routed.dependsOn) ? routed.dependsOn : []) {
    const me = numberOf[d.change];
    if (!Number.isInteger(me)) continue;
    for (const a of d.after) {
      const it = numberOf[a];
      if (Number.isInteger(it) && it !== me && !parts[me].needs.includes(it)) parts[me].needs.push(it);
    }
  }
  // THE ANSWERED PART WAITS WHEN IT NEEDS ANOTHER, and is routed again when its
  // turn comes, on its own words: the answer that chose its route was made
  // before the part it needs existed.
  if (parts[0].needs.length) { parts[0].phase = "route"; parts[0].route = null; parts[0].runs = null; parts[0].held = []; parts[0].putOff = []; }
  refuseCycles(parts);
  for (const p of parts) if (p.status !== "refused") p.status = p.needs.length ? "blocked" : "ready";
  return { ok: true, parts };
}

/** A message as part 0 is shown: each held part's words replaced by "…", once, the runs of marks folded. */
function shownWithout(text, held) {
  let out = text;
  for (const w of [...held].sort((a, b) => b.length - a.length)) {
    const at = out.indexOf(w);
    if (at >= 0) out = out.slice(0, at) + "\u2026" + out.slice(at + w.length);
  }
  out = out.replace(/\u2026(?:[\s,;:]*\u2026)+/g, "\u2026").replace(/\u2026[\s.]*$/, "\u2026").replace(/[ \t]{2,}/g, " ").trim();
  return out === text ? null : out;
}

/** Parts whose relations form a cycle are refused, each said: no order is guessed for them. */
function refuseCycles(parts) {
  const state = new Map();
  const onCycle = new Set();
  const stack = [];
  const visit = (n) => {
    state.set(n, 1);
    stack.push(n);
    for (const m of parts[n] ? parts[n].needs : []) {
      if (!parts[m]) continue;
      if (state.get(m) === 1) { for (let i = stack.indexOf(m); i < stack.length; i++) onCycle.add(stack[i]); }
      else if (!state.has(m)) visit(m);
    }
    stack.pop();
    state.set(n, 2);
  };
  for (const p of parts) if (!state.has(p.n)) visit(p.n);
  for (const n of onCycle) { parts[n].status = "refused"; parts[n].why = "order-unclear"; }
}

// ── PARTS A JOB LEFT FOR LATER ───────────────────────────────────────────────

/**
 * PARTS ONE PART'S JOB PUT OFF, ADDED TO THE SAME REQUEST: the picker's
 * `elsewhere`, the look door's held additions, a routing job's own held parts.
 * Each must be the customer's own words in the message, shorter than the part
 * it came from (so a chain of these always ends), and not a part already —
 * nor inside one other than its parent. A part carved from another runs after
 * that part's job (only its run knew the words are separate), needs it only
 * where the model said so (`dependsOn`), and a part that needed the parent
 * needs it whole (`complete`). Returns the new parts' numbers.
 *
 * `sibling` (a routing job's held part that the part itself needs first) is
 * not carved from it but added beside it, with the part waiting for it.
 */
export function carveParts(rec, parentN, words, { dependsOn = [], sibling = [] } = {}) {
  const parent = rec.parts[parentN];
  if (!parent) return [];
  const made = [];
  const numberOf = [parentN];
  for (const w0 of Array.isArray(words) ? words : []) {
    const w = wordsIn(rec.message, w0);
    numberOf.push(null);
    if (!w || w.length >= parent.words.length) continue;
    if (rec.parts.some((q) => q.words === w || (q.n !== parentN && q.parent !== parentN && q.words.length > w.length && wordsIn(q.words, w)))) continue;
    const n = rec.parts.length;
    const beside = sibling.includes(numberOf.length - 1);
    const part = newPart(n, w, {
      at: Math.max(0, rec.message.indexOf(w)), source: beside ? "router" : "carved",
      parent: beside ? null : parentN, needs: beside ? parent.needs.slice() : [],
    });
    rec.parts.push(part);
    if (!parent.held.includes(w)) parent.held.push(w);
    numberOf[numberOf.length - 1] = n;
    made.push(n);
  }
  for (const d of Array.isArray(dependsOn) ? dependsOn : []) {
    const me = numberOf[d.change];
    if (!Number.isInteger(me)) continue;
    for (const a of d.after) {
      const it = numberOf[a];
      if (Number.isInteger(it) && it !== me && !rec.parts[me].needs.includes(it)) rec.parts[me].needs.push(it);
    }
  }
  refuseCycles(rec.parts);
  return made;
}

// ── READING A JOB'S STORED ANSWER ────────────────────────────────────────────

/** The stored answer of a job row (`edit_get`): `{ status, body }`, or `null` when it has none that reads. */
export function answerOf(row) {
  const res = row && row.result;
  if (!plain(res) || typeof res.body !== "string") return null;
  try {
    const body = JSON.parse(res.body);
    return plain(body) ? { status: Number(res.status) || 0, body } : null;
  } catch { return null; }
}

/**
 * A question on an answer, as the page's card reads it — `{ id, text, options }`
 * — with what it takes to put it in the site's question slot again
 * (`request`, `stage`, `round`) and whether it is there yet (`queued`: the slot
 * held another question when it was asked, so it waits its turn). `null` when
 * there is no question that reads.
 */
function askOf(v) {
  if (!plain(v) || typeof v.text !== "string" || !v.text.trim()) return null;
  return {
    id: typeof v.id === "string" ? v.id : null,
    text: v.text.trim(),
    options: Array.isArray(v.options) ? v.options.filter((o) => typeof o === "string" && o) : [],
    ...(typeof v.note === "string" && v.note ? { note: v.note } : {}),
    ...(typeof v.request === "string" && v.request.trim() ? { request: v.request.trim() } : {}),
    ...(typeof v.stage === "string" && v.stage ? { stage: v.stage } : {}),
    ...(Number.isInteger(v.round) && v.round > 0 ? { round: v.round } : {}),
    queued: v.queued === true,
  };
}

/**
 * WHAT A RUN JOB'S ANSWER SAYS (the edit and add-on routes' replies), read as
 * the page's `readRouteReply` reads them: a hand-over, a question, a refusal,
 * a success, or nothing that can be used.
 */
export function readRun(ans) {
  const unknown = { act: "unknown" };
  if (!ans || !plain(ans.body)) return unknown;
  const b = ans.body;
  const httpOk = ans.status >= 200 && ans.status < 300;
  if (typeof b.ok !== "boolean") return unknown;
  const deferred = heldList(b.deferred) || [];
  const ask = b.clarify === undefined ? null : askOf(b.clarify);
  if (b.escalate === true) {
    if (!httpOk || b.ok !== false) return unknown;
    const why = { reason: typeof b.reason === "string" ? b.reason : "", field: typeof b.field === "string" ? b.field : "", deferred };
    if (b.layer === undefined) return { act: "climb", ...why };
    if (typeof b.layer !== "string" || (b.page != null && typeof b.page !== "string")) return unknown;
    return { act: "hop", layer: b.layer, page: b.page || "", ...why };
  }
  if (b.ok === false && ask && b.error === "clarify") return { act: "clarify", ask, deferred };
  if (b.ok === false) return { act: "refusal", ask, deferred, error: typeof b.error === "string" ? b.error : "" };
  if (!httpOk) return unknown;
  if (b.recovered === true) return { act: "recovered" };
  return { act: "success", ask, deferred };
}

/**
 * WHAT AN `ok: true` ANSWER SAYS WAS ASKED FOR AND NOT DONE (2026-10-03, the
 * owner's review: *"distinguish genuine refusals and partial outcomes, and
 * never satisfy dependencies merely because the enclosing response has
 * ok:true"*). Each `{ what, why }`, from the step's own named lists, never
 * from `ok` alone:
 *   an edit's    a step that did not go through (`partial`; a question is
 *                asked, not refused), a lane not built (`notBuilt`), a
 *                component kept or unseen (`keptParts`, `unseenParts`), a
 *                menu or footer entry left out (`dropped`; a duplicate is
 *                there once), a link refused in the copy (`refusedLinks`),
 *                rows that failed (`failed`);
 *   an addition's  an entry left out (`notAdded`), a kind its designer
 *                declined (`declined`), a kind or entry set aside without its
 *                words (`skipped`), a page that did not survive the writer
 *                (`missingPages`), a part of the design that could not be
 *                built (`droppedFields`).
 */
/** The requirement outcomes that are not done (`requirementReport`'s `told`), and the warnings that are work kept out (`warningReport`'s `what`). */
const TOLD_UNDONE = Object.freeze(["unsupported", "still-to-do", "blocked", "not-tracked"]);
const WARNED_UNDONE = Object.freeze(["qr", "held-page", "held-section", "refused"]);
export function notDoneOf(body, op = "edit") {
  const b = plain(body) ? body : {};
  const out = [];
  const list = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === "string" ? v : "");
  const add = (what, why) => out.push({ what: String(what || "").slice(0, 200), why: String(why || "").slice(0, 60) });
  if (op === "addon") {
    for (const n of list(b.notAdded)) if (plain(n)) add(n.name || n.kind || "entry", n.why || "left-out");
    for (const d of list(b.declined)) add(typeof d === "string" ? d : plain(d) ? d.kind : "kind", "declined");
    for (const k of list(b.skipped)) add(typeof k === "string" ? k : plain(k) ? k.name || k.kind : "entry", plain(k) && k.why ? k.why : "set-aside");
    for (const m of list(b.missingPages)) add(typeof m === "string" ? m : "page", "missing");
    for (const f of list(b.droppedFields)) if (plain(f)) add(f.name || f.what || "part", "dropped");
    // WHAT ITS OWN REPORT SAYS IS NOT DONE (2026-10-07): a requirement the
    // site cannot do yet, one whose work is not there, one waiting on a part
    // that did not work, and one past what a step keeps track of — and a QR
    // code, page or section kept out — so an addition that told the customer
    // "still to do" is never a part recorded as finished. A missing page is
    // `missingPages`' above, said once.
    for (const r of list(b.requirementsTold)) if (plain(r) && TOLD_UNDONE.includes(r.told)) add(str(r.need) || "requirement", r.told);
    for (const w of list(b.warningsTold)) if (plain(w) && WARNED_UNDONE.includes(w.what)) add(str(w.name) || w.what, w.what);
    return out;
  }
  for (const p of list(b.partial)) if (plain(p) && !p.ask && p.error !== "clarify") add(p.page || p.layer || "step", p.error || p.reason || "not-done");
  for (const n of list(b.notBuilt)) if (plain(n)) add(n.field || "lane", "not-built");
  for (const k of list(b.keptParts)) add(str(k) || "component", "kept");
  for (const k of list(b.unseenParts)) add(str(k) || "component", "unseen");
  for (const d of list(b.dropped)) if (plain(d) && d.why !== "duplicate") add(d.label || d.href || "entry", d.why || "left-out");
  for (const r of list(b.refusedLinks)) if (plain(r)) add(r.label || r.to || "link", r.why || "refused");
  const failed = Array.isArray(b.failed) ? b.failed.length : Number.isInteger(b.failed) ? b.failed : 0;
  if (failed > 0) add(failed + " row" + (failed === 1 ? "" : "s"), "failed");
  return out;
}

/** WHAT A ROUTING JOB'S ANSWER SAYS (the routing route's reply for one part). */
export function readRoute(ans) {
  if (!ans || !plain(ans.body)) return { act: "unknown" };
  const b = ans.body;
  if (b.ok !== true) return { act: "refusal", error: typeof b.error === "string" ? b.error : "" };
  if (b.failed === true) return { act: "failed" };
  if (b.intent === "clarify") { const ask = askOf({ ...(plain(b.question) ? b.question : {}), ...(plain(b.questionFor) ? b.questionFor : {}) }); return ask ? { act: "clarify", ask } : { act: "unknown" }; }
  if (b.intent === "ask") return { act: "answer", answer: typeof b.answer === "string" ? b.answer : "" };
  if (b.intent === "edit" || b.intent === "addon") {
    return { act: "route", route: routeOf(b), alsoAsked: heldList(b.alsoAsked) || [], dependsOn: Array.isArray(b.dependsOn) ? b.dependsOn : [] };
  }
  if (b.intent === "build") return { act: "rewrite", why: "rebuild" };
  return { act: "unknown" };
}

/**
 * WHERE A HAND-OVER GOES — the page's `escalateAction`, now the server's.
 *
 *   an edit naming the add-on goes there, unless the add-on handed it this
 *   part (then it stops: it would ask the add-on the question it just answered);
 *   an edit that is itself a hand-over, or that names its own layer, has only
 *   the full rewrite left; an edit naming another layer hops to it; the add-on
 *   naming an edit layer hands it there as an addition (`fromAddon`); a reply
 *   naming no layer is the full rewrite.
 *
 * The full rewrite is never started here: it rewrites every page and costs far
 * more than the step asked for, so the part waits for a go-ahead.
 */
export function handOff(read, route) {
  const from = plain(route) ? route : {};
  if (read.act === "climb") return { act: "rewrite", why: "climb" };
  if (read.act !== "hop") return { act: "unknown" };
  const named = read.layer;
  if ((from.hops || 0) >= HOPS_MAX) return { act: "rewrite", why: "hops" };
  if (from.op === "addon") {
    if (!EDIT_LAYERS.includes(named)) return { act: "unknown" };
    return { act: "hop", op: "edit", layer: named, page: read.page, fromAddon: true, handedOff: true };
  }
  if (named === "addon") return from.fromAddon === true ? { act: "stop" } : { act: "hop", op: "addon", layer: "", page: read.page, fromAddon: false, handedOff: false };
  if (!EDIT_LAYERS.includes(named)) return { act: "unknown" };
  if (from.handedOff === true) return { act: "rewrite", why: "handed-off" };
  if (named !== from.layer) return { act: "hop", op: "edit", layer: named, page: read.page, fromAddon: from.fromAddon === true, handedOff: true };
  return { act: "rewrite", why: "same-layer" };
}

/** The route a hand-over runs with: where it goes and the part's context, never the first answer's verbs (W1). */
function handedRoute(from, to, read) {
  const page = to.page || from.page || "";
  const ho = {};
  const fromName = from.op === "addon" ? "addon" : (from.layer || "");
  if (fromName) ho.from = fromName;
  if (read.reason) ho.reason = read.reason;
  if (read.field) ho.field = read.field;
  if (page) ho.page = page;
  return {
    op: to.op, intent: to.op, layer: to.op === "edit" ? to.layer : "",
    page, remove: false, rename: "", tab: false,
    handOver: ho.from || ho.reason ? ho : null,
    cost: from.cost, handedOff: to.handedOff === true, fromAddon: to.fromAddon === true,
    hops: (from.hops || 0) + 1,
  };
}

/** A short account of what a part's job really did, for the parts after it (`partBlock`): never customer-facing. */
export function doneSummary(body) {
  const b = plain(body) ? body : {};
  const out = [];
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);
  const pagesOf = (v) => list(v).map((p) => (p.startsWith("/") ? p : "/" + p.replace(/^src\/routes\//, "").replace(/\.tsx$/, "").replace(/^index$/, "")));
  if (list(b.added).length) out.push("added the page" + (b.added.length === 1 ? " " : "s ") + pagesOf(b.added).join(", "));
  if (list(b.removed).length) out.push("removed " + pagesOf(b.removed).join(", "));
  if (typeof b.renamedTo === "string" && b.renamedTo) out.push("moved a page to " + b.renamedTo);
  if (list(b.tables).length) out.push("added the table" + (b.tables.length === 1 ? " " : "s ") + b.tables.join(", "));
  if (Array.isArray(b.steps)) {
    const layers = [...new Set(b.steps.filter((s) => plain(s) && s.status === "done" && typeof s.layer === "string").map((s) => s.layer))];
    if (layers.length) out.push("changed it with the " + layers.join(", ") + " step" + (layers.length === 1 ? "" : "s"));
  } else if (typeof b.layer === "string" && b.layer) out.push("changed it with the " + b.layer + " step");
  if (typeof b.slug === "string" && b.slug && b.layer === "rename") out.push("the site's address is now " + b.slug);
  // AN ADDITION ALREADY TRUE (2026-10-04): done, with nothing to change.
  if (b.satisfied === true) out.push("found it already done");
  if (!out.length) out.push(b.addon === true || Array.isArray(b.kinds) ? "made the addition" : "made the change");
  const said = out.join("; ");
  return said.length > 400 ? said.slice(0, 400) : said;
}

/**
 * WORDS A STEP LEFT FOR LATER ARE A PART OF THE REQUEST: a part of their own,
 * or inside a part other than the one that left them.
 */
function carried(rec, n, w0) {
  const w = wordsIn(rec.message, w0);
  if (!w) return false;
  return rec.parts.some((q) => q.n !== n && (q.words === w || (q.words.length > w.length && !!wordsIn(q.words, w))));
}

// ── THE NEXT STEP ────────────────────────────────────────────────────────────

const currentJob = (p) => { for (let i = p.jobs.length - 1; i >= 0; i--) if (!p.jobs[i].end) return p.jobs[i]; return null; };
const lastJob = (p) => (p.jobs.length ? p.jobs[p.jobs.length - 1] : null);
const childrenOf = (rec, n) => rec.parts.filter((q) => q.parent === n);
function complete(rec, n, seen = new Set()) {
  const p = rec.parts[n];
  if (!p || seen.has(n)) return false;
  seen.add(n);
  return p.status === "done" && childrenOf(rec, n).every((c) => complete(rec, c.n, seen));
}
function broken(rec, n, seen = new Set()) {
  const p = rec.parts[n];
  if (!p || seen.has(n)) return false;
  seen.add(n);
  return BAD.includes(p.status) || childrenOf(rec, n).some((c) => broken(rec, c.n, seen));
}

/**
 * A job that ended without running to an answer: no stored answer at all, the
 * stale sweep's own (never claimed), the consumer's when the site's container
 * could not take it (never started), or the job's own when the service running
 * it was shut down under it (`stopped`, its reserve given back). Nothing of
 * any of them is charged or published.
 */
const NO_ANSWER = Object.freeze(["stale", "no-container", "stopped"]);
export function answerless(row) {
  if (!row || !ENDED_JOB.includes(row.state) || row.needs_review === true) return false;
  if (row.billing === "reserved" || row.billing === "finalized") return false;
  const ans = answerOf(row);
  return !ans || NO_ANSWER.includes(ans.body.error);
}

/** What a job that ended was charged: its reserves when its row says they were finalized, else nothing. */
export function chargedOf(row) {
  // A NUMBER AS THE ROW HOLDS IT, never one coerced from something else.
  const c = row && typeof row.cost === "number" ? row.cost : NaN;
  return row && row.billing === "finalized" && Number.isInteger(c) && c > 0 ? c : 0;
}

/**
 * A PART ONLY THE FULL REWRITE CAN MAKE WAITS FOR THE CUSTOMER'S GO-AHEAD
 * (2026-10-03, the owner's review: *"Preserve a waiting approval state and
 * attachments, record the approval durably, and use the existing rewrite
 * executor"*). Not an ending: what needs it waits rather than being given up,
 * and the request keeps its files until it ends.
 */
function askApproval(p, why, now) {
  p.status = "approval"; p.why = why; p.approvalAt = now; p.phase = "approval"; p.route = null;
}

/** The final answer of a rewrite's build, `{ status, body }`, or `null` while there is none yet (or only its 202). */
function finalBuild(v, uid) {
  if (!plain(v) || typeof v.body !== "string") return null;
  if (typeof v.uid === "string" && v.uid && uid && v.uid !== uid) return null;
  let body = null;
  try { body = JSON.parse(v.body); } catch { body = null; }
  if (!plain(body)) return null;
  const status = Number(v.status) || 0;
  if (status === 202 || body.stage === "resuming") return null;
  return { status, body };
}

/**
 * SETTLE AN APPROVED REWRITE FROM ITS BUILD (the existing executor's own
 * records): the answer it wrote (`build`), else its row. A build that wrote no
 * final answer yet is still running; one whose row ended without one is said
 * from the row — kept as published only when the row says it finished.
 */
function settleRewrite(rec, p, job, row, now) {
  const fin = finalBuild(row.build, rec.uid);
  if (!fin) {
    if (row.needs_review === true) { p.status = "unverified"; return; }
    if (!ENDED_JOB.includes(row.state)) { p.status = row.state === "queued" ? "queued" : "started"; return; }
    // NO ANSWER, SO NO WORD ON MONEY: what it cost cannot be told.
    job.end = { state: row.state, at: now, cost: null, act: "no-answer" };
    if (row.state === "cancelled") { p.status = "cancelled"; p.why = rec.stop ? "stopped" : "cancelled"; return; }
    if (row.state === "done") {
      p.status = "done"; p.why = "unrecorded"; p.outcome = { job: job.id, kind: "rewrite" };
      p.done = "rewrote the site for this (what it changed was not recorded)"; return;
    }
    p.status = "failed"; p.why = row.state === "lost" ? "rewrite-lost" : "rewrite-failed"; return;
  }
  const b = fin.body;
  // WHAT IT CHARGED, AS THE BUILD ITSELF REPORTS IT: the build path bills by
  // its own refs, never through the job's reserves. An answer that names no
  // whole number says nothing about money (null), never nothing charged.
  job.end = { state: row.state, at: now, cost: typeof b.cost === "number" && Number.isInteger(b.cost) && b.cost >= 0 ? b.cost : null, act: "rewrite" };
  // DONE ONLY WHEN IT PUBLISHED THE SITE ITSELF (`page: "app"`), as the page
  // reads a build. One that salvaged a page it could not write published the
  // rest: partial, so nothing that needs it runs.
  if (b.ok === true && b.page === "app") {
    p.outcome = { job: job.id, kind: "rewrite" };
    if (!b.error) { p.status = "done"; p.done = "rewrote the site's pages for this"; return; }
    p.status = "partial"; p.why = "partly-done";
    p.notDone = [{ what: "a page of the rewrite", why: String(b.error).slice(0, 60) }]; return;
  }
  if (b.cancelled === true) { p.status = "cancelled"; p.why = rec.stop ? "stopped" : "cancelled"; return; }
  // ANSWERED, BUT NO SITE WRITTEN (the pages could not be made; a revise leaves
  // the live site as it was), or failed outright.
  p.status = "failed";
  p.why = b.ok === true ? "rewrite-not-written" : typeof b.error === "string" && b.error ? b.error.slice(0, 60) : typeof b.stage === "string" && b.stage ? b.stage : "rewrite-failed";
  p.outcome = { job: job.id, kind: "rewrite" };
}

/**
 * WHAT A FAILED OR STOPPED JOB'S OWN ANSWER SAYS IT LEFT STANDING (2026-10-07):
 * `partial` (something of it is live — an addition's tables, an edit's steps
 * that went through outside the publish, `landed`), `unpublished` (saved, not
 * live), `unknown` (it stopped part-way through an apply), or "" — nothing of
 * it went in, or the answer records nothing either way. Only what the answer
 * RECORDS is read: its outcome, its database record, its landed steps — never
 * the reply's own guess for an answer that records nothing, so an ordinary
 * refusal is never told as one that may have changed the site.
 */
export function leftOf(body) {
  if (!plain(body) || body.ok !== false) return "";
  if (Array.isArray(body.landed) && body.landed.some((l) => typeof l === "string" && l.trim())) return "partial";
  // `outcomeOf` reads the outcome, then the database record, and answers
  // `recorded: false` for an answer that records neither — which is read here
  // as nothing standing, never as the unknown it says for the reply.
  const o = outcomeOf(body);
  return o && o.recorded !== false && ["partial", "unpublished", "unknown"].includes(o.state) ? o.state : "";
}

/**
 * WHAT A JOB THAT ENDED WITH NO ANSWER LEFT STANDING, from its database record
 * as the driver settled it (`row.migration`, 2026-10-07): `partial` where the
 * engine reported tables applied without the page, `unknown` where the record
 * never heard back from the apply, else "".
 */
export function leftOfRecord(m) {
  if (!plain(m)) return "";
  if (m.status === "applied_without_page") return "partial";
  if (m.status === "failed") return "unknown";
  return "";
}
/** The stronger of two readings of what a part's jobs left standing: something live, then something unknown, then something saved. */
const LEFT_ORDER = ["", "unpublished", "unknown", "partial"];
const strongerLeft = (a, b) => (LEFT_ORDER.indexOf(b) > LEFT_ORDER.indexOf(a || "") ? b : a || "");
/** One of the three things a job can leave standing, or "" — a value read from storage is never trusted further than that. */
export const leftValue = (v) => (v === "partial" || v === "unpublished" || v === "unknown" ? v : "");

/**
 * WHAT ONE ENDED JOB LEFT STANDING, FROM EVERY RECORD OF IT (2026-10-07,
 * corrected after Codex's review): its own answer (`leftOf`) and, where the
 * answer records nothing either way, its database record as the driver read
 * it (`row.migration`, `leftOfRecord`) — the stronger of the two. A stop whose
 * answer said nothing about the tables it had already applied was told as
 * stopped "before it changed anything".
 */
export function leftOfRow(row) {
  const ans = answerOf(row);
  return strongerLeft(ans ? leftOf(ans.body) : "", leftOfRecord(row && row.migration));
}
/**
 * DOES THIS ENDED JOB'S DATABASE RECORD NEED READING (2026-10-07)? One with no
 * usable answer, and one stopped whose answer records nothing about what
 * stands — the two whose parts would otherwise be told as having changed
 * nothing. The caller reads the record (`endedEvidence`) and hands it in as
 * `row.migration`.
 */
export function wantsEvidence(row) {
  if (!row || !ENDED_JOB.includes(row.state) || row.needs_review === true) return false;
  if (answerless(row)) return true;
  const ans = answerOf(row);
  const stopped = row.state === "cancelled" || (!!ans && ans.body.ok === false && (ans.body.error === "cancelled" || ans.body.detail === "cancelled"));
  return stopped && !(ans && ans.body.ok === true) && !(ans && leftOf(ans.body));
}
/**
 * A PART THAT DID NOT FINISH, WITH EVERYTHING ITS TRIES LEFT STANDING
 * (2026-10-07): one rule for every way a run job can fail. Something of it
 * live — from this try or an earlier one — is done in part, never wholly
 * failed, and nothing that needs it runs; something saved but not live, or an
 * apply that stopped part-way, fails and keeps what it left.
 */
function endUnfinished(p, left, why, outcome) {
  p.left = strongerLeft(p.left, left);
  if (outcome) p.outcome = outcome;
  if (p.left === "partial") {
    p.status = "partial"; p.why = "partly-done";
    p.notDone = [{ what: p.words, why: String(why || "failed").slice(0, 60) }];
    return;
  }
  p.status = "failed"; p.why = why;
  if (!p.left) delete p.left;
}

/**
 * SETTLE ONE JOB THAT ENDED: what its answer means for its part.
 */
function settle(rec, p, job, row, now) {
  const ans = answerOf(row);
  // WHAT IT WAS CHARGED, AS ITS ROW SAYS — its reserves once finalized, and
  // nothing for one refunded, exempt or never reserved — so a part's money is
  // read from the ledger's own record, never assumed from how it ended.
  job.end = { state: row.state, at: now, cost: chargedOf(row) };
  // STOPPED, AS THE JOB ITSELF SAYS: a cancel caught at a gate (`error`) or at
  // the publish gate (`detail`) — the job runner then marks the row failed, so
  // the answer is what tells a stop from a failure.
  const stopped = row.state === "cancelled" || (!!ans && ans.body.ok === false && (ans.body.error === "cancelled" || ans.body.detail === "cancelled"));
  if (stopped && !(ans && ans.body.ok === true)) {
    job.end.act = "cancelled";
    p.status = "cancelled"; p.why = rec.stop ? "stopped" : "cancelled";
    // A STOP AFTER SOMETHING WENT IN (2026-10-07): the part is still stopped,
    // and what its tries left standing is kept on it — from its answer, from
    // its database record where the answer records nothing (Codex: the branch
    // ignored `row.migration`), and from an earlier try — so it is never told
    // as stopped "before it changed anything".
    const left = strongerLeft(p.left, leftOfRow(row));
    if (left) p.left = left;
    return;
  }
  if (answerless(row)) {
    job.end.act = "answerless";
    // WHAT IT LEFT STANDING IS KEPT ACROSS ITS RETRY (2026-10-07): a first try
    // whose tables went in before it died is still told so if the last fails.
    const left = leftOfRecord(row.migration);
    if (left) p.left = strongerLeft(p.left, left);
    if (p.retries < RETRIES) { p.retries++; p.status = "ready"; return; }
    endUnfinished(p, "", "no-answer"); return;
  }
  // DONE WITH NO ANSWER THAT READS: a publish the reconcile kept, or one the
  // sweep finalized — live, and what it changed not recorded.
  if (row.state === "done" && !ans) {
    job.end.act = "recovered";
    p.status = "done"; p.why = "unrecorded"; p.outcome = { job: job.id, kind: "recovered" };
    p.done = "made the change (what it changed was not recorded)"; return;
  }
  if (job.kind === "route") {
    const read = readRoute(ans);
    if (read.act !== "failed") p.retries = 0;
    job.end.act = read.act;
    if (read.act === "route") {
      p.route = { ...read.route, hops: 0 };
      p.phase = "run";
      if (read.alsoAsked.length) {
        const needsFirst = read.dependsOn.filter((d) => d.change === 0).flatMap((d) => d.after);
        const made = carveParts(rec, p.n, read.alsoAsked, { dependsOn: read.dependsOn.filter((d) => d.change !== 0), sibling: needsFirst });
        // THE PART NEEDS A PART IT HELD BACK FIRST: it waits for it, and is
        // routed again when its turn comes.
        const before = needsFirst.map((i) => made[i - 1]).filter(Number.isInteger);
        if (before.length) { for (const m of before) if (!p.needs.includes(m)) p.needs.push(m); p.phase = "route"; p.route = null; p.runs = null; }
      }
      p.status = "ready";
      return;
    }
    if (read.act === "clarify") { p.status = "waiting"; p.question = { round: 1, ...read.ask, at: now }; p.phase = "answer"; return; }
    if (read.act === "answer") { p.status = "done"; p.answer = read.answer; p.outcome = { job: job.id, kind: "answer" }; p.done = "answered a question about the site"; return; }
    if (read.act === "rewrite") { askApproval(p, read.why, now); return; }
    // THE ROUTING CALL ITSELF FAILED (the provider, our ceiling): ours, so it
    // is asked once more, as a job with no answer is; then the part fails.
    if (read.act === "failed") {
      if (p.retries < RETRIES) { p.retries++; p.status = "ready"; return; }
      p.status = "failed"; p.why = "routing-failed"; return;
    }
    p.status = "failed"; p.why = read.act === "refusal" ? (read.error || "refused") : "unreadable";
    return;
  }
  // A RUN JOB: an edit or an addition.
  p.retries = 0;
  const read = readRun(ans);
  job.end.act = read.act;
  if (read.deferred && read.deferred.length) carveParts(rec, p.n, read.deferred);
  // A PART THIS STEP LEFT FOR LATER THAT IS NO PART OF THE REQUEST NOW — not
  // the customer's words, or all of this part's — is work asked for and not
  // done, never dropped.
  const lost = (read.deferred || []).filter((w) => !carried(rec, p.n, w));
  if (read.act === "hop" || read.act === "climb") {
    const to = handOff(read, p.route || {});
    job.end.handOff = to.act;
    if (to.act === "hop") { p.route = handedRoute(p.route || {}, to, read); p.hops = p.route.hops; p.status = "ready"; return; }
    if (to.act === "rewrite") { askApproval(p, to.why, now); p.outcome = { job: job.id, kind: "escalate" }; return; }
    if (to.act === "stop") { endUnfinished(p, "", "handed-back", { job: job.id, kind: "escalate" }); return; }
    endUnfinished(p, "", "unreadable"); return;
  }
  if (read.act === "recovered") { p.status = "done"; p.why = "unrecorded"; p.outcome = { job: job.id, kind: "recovered" }; p.done = "made the change (what it changed was not recorded)"; return; }
  if (read.act === "success") {
    // A RETRY THAT FINISHED speaks for the whole part: what an earlier try left is in what it did.
    delete p.left;
    p.outcome = { job: job.id, kind: "done" };
    p.done = doneSummary(ans.body);
    if (read.ask) { p.status = "waiting"; p.question = { round: (p.askRound || 0) + 1, ...read.ask, at: now }; p.phase = "answer"; return; }
    // DONE ONLY WHEN NOTHING ASKED FOR WAS LEFT UNDONE: what it named as not
    // done makes it partial, which nothing that needs it treats as finished.
    const notDone = notDoneOf(ans.body, (p.route && p.route.op) === "addon" ? "addon" : "edit");
    for (const w of lost) notDone.push({ what: w, why: "left-over" });
    if (notDone.length) { p.status = "partial"; p.why = "partly-done"; p.notDone = notDone.slice(0, 24); return; }
    p.status = "done"; return;
  }
  if (read.act === "clarify" || (read.act === "refusal" && read.ask)) {
    p.status = "waiting"; p.question = { round: (p.askRound || 0) + 1, ...read.ask, at: now }; p.phase = "answer";
    // A QUESTION AFTER SOMETHING WENT IN (2026-10-07): what this try, or an
    // earlier one, left standing stays on the part while it waits.
    const left = strongerLeft(p.left, leftOf(ans.body));
    if (left) p.left = left;
    p.outcome = { job: job.id, kind: "asked" }; return;
  }
  if (read.act === "refusal") {
    // A FAILURE AFTER PART OF IT WENT LIVE (2026-10-07) is done in part — what
    // went in stands, and nothing that needs the part runs, as for any part
    // done in part — never recorded as wholly failed; one that left something
    // saved but not live, or whose apply stopped part-way, fails, and says so.
    // An EARLIER try's standing work counts the same (`endUnfinished`).
    endUnfinished(p, leftOf(ans.body), read.error || "refused", { job: job.id, kind: "refused" });
    return;
  }
  endUnfinished(p, "", "unreadable", { job: job.id, kind: "unreadable" });
}

/**
 * WHAT ONE JOB'S OWN OUTCOME IS, FOR ITS CARD (2026-10-06, the owner: *"Derive
 * the displayed state and model-written summary from the actual outcome across
 * Edit and Add-on, covering partial results, clarification, handoffs and
 * unverified outcomes"*). A page-filed job has no request to settle it, and
 * its card on another device read success from `ok: true` alone — so an
 * addition that set part of the ask aside showed as finished (Codex's
 * reproduction). These are `settle`'s own readings of the same row and
 * answer, for one job rather than a part:
 *   queued      filed, not yet claimed
 *   running     claimed and running
 *   unverified  it began publishing and could not confirm it (held for review)
 *   waiting     it asked the customer something, and waits for the answer
 *   handoff     this step could not make it and handed it on to another
 *   done        finished, nothing it was asked for left undone
 *   partial     finished, and named something asked for that it did not do,
 *               or put a part off for later (`notDoneOf`, `deferred`)
 *   failed      ended with its own reason, or with no answer at all
 *   cancelled   stopped
 * Null for a row that does not read. `op` is the job's own (`edit` or
 * `addon`), which says which lists name what was not done.
 */
export const EDIT_JOB_OUTCOMES = Object.freeze(["queued", "running", "unverified", "waiting", "handoff", "done", "partial", "failed", "cancelled"]);
export function editJobOutcome(row, op = "edit") {
  if (!plain(row) || typeof row.state !== "string") return null;
  if (row.needs_review === true) return "unverified";
  if (LIVE_JOB.includes(row.state)) return row.state === "queued" ? "queued" : "running";
  if (!ENDED_JOB.includes(row.state)) return null;
  const ans = answerOf(row);
  const stopped = row.state === "cancelled" || (!!ans && ans.body.ok === false && (ans.body.error === "cancelled" || ans.body.detail === "cancelled"));
  // A STOP OR A DEATH AFTER PART OF IT WENT LIVE IS DONE IN PART (2026-10-07),
  // read from its answer and, where that records nothing, its database record
  // (`row.migration`, handed in by the caller) — as `settle` reads it.
  if (stopped && !(ans && ans.body.ok === true)) return leftOfRow(row) === "partial" ? "partial" : "cancelled";
  if (answerless(row)) return leftOfRecord(row.migration) === "partial" ? "partial" : "failed";
  if (ans && leftOf(ans.body) === "partial") return "partial";
  if (row.state === "done" && !ans) return "done";
  const read = readRun(ans);
  if (read.act === "hop" || read.act === "climb") return "handoff";
  if (read.act === "recovered") return "done";
  if (read.act === "success") {
    if (read.ask) return "waiting";
    return notDoneOf(ans.body, op === "addon" ? "addon" : "edit").length || read.deferred.length ? "partial" : "done";
  }
  if (read.act === "clarify" || (read.act === "refusal" && read.ask)) return "waiting";
  return "failed";
}

/**
 * ONE STEP OF A REQUEST: settle the jobs that ended, apply the stop, expire
 * questions nobody answered, decide which parts may run, and choose the next
 * job — one at a time. `rows` maps job ids to their `edit_get` rows; a job
 * whose row is not there is left as it was for this step. Returns
 * `{ record, file }`: the record to write back (on the etag it was read
 * under), and the job to file after it, if any — `{ n, key, kind, op }` —
 * which the caller builds the body for (`jobBody`). A job already recorded but
 * not yet given an id (the filer died after the write) comes back to be filed
 * again under the same key.
 */
export function nextStep(record, rows = {}, now = Date.now()) {
  const rec = clone(record);
  for (const p of rec.parts) {
    const job = currentJob(p);
    if (!job || !job.id) continue;
    const row = rows[job.id];
    if (!row || row.ok === false) continue;
    if (job.kind === "rewrite") { settleRewrite(rec, p, job, row, now); continue; }
    if (row.needs_review === true) { p.status = "unverified"; continue; }
    if (LIVE_JOB.includes(row.state)) { p.status = row.state === "queued" ? "queued" : "started"; continue; }
    if (ENDED_JOB.includes(row.state)) settle(rec, p, job, row, now);
  }
  // NOTHING NEW STARTS ONCE A STOP IS ASKED: a part not yet running is
  // stopped; a running one ends through its own job's cancel, as any job's.
  if (rec.stop) {
    for (const p of rec.parts) {
      if (PART_TERMINAL.includes(p.status) || currentJob(p)) continue;
      p.status = "cancelled"; p.why = "stopped";
    }
  }
  // A QUESTION NOBODY ANSWERED IN A DAY EXPIRES, as the question record does.
  for (const p of rec.parts) {
    if (p.status === "waiting" && p.question && Number.isFinite(p.question.at) && now - p.question.at >= WAIT_MS) { p.status = "expired"; p.why = "unanswered"; }
    // AND A GO-AHEAD NOBODY GAVE IN A DAY, the same way: its files are let go
    // when the request ends, and what needed it is not run.
    if (p.status === "approval" && Number.isFinite(p.approvalAt) && now - p.approvalAt >= WAIT_MS) { p.status = "expired"; p.why = "unapproved"; }
  }
  // WHO MAY RUN: an independent part whatever happened elsewhere; a part whose
  // prerequisite did not finish is not run, and says which. The prerequisites
  // are the model's (`needs`), never guessed here. A part a job left for later
  // (`parent`) runs once that job's part has ended or is waiting on a
  // question — in order, never in the middle of its hand-overs — and needs it
  // to have worked only where the model said so.
  let moved = true;
  while (moved) {
    moved = false;
    for (const p of rec.parts) {
      if (p.status !== "blocked" && p.status !== "ready") continue;
      const parent = p.parent === null ? null : rec.parts[p.parent];
      const bad = p.needs.find((m) => broken(rec, m));
      if (bad !== undefined) { p.status = "not-run"; p.why = "needs:" + bad; moved = true; continue; }
      const settled = !parent || PART_TERMINAL.includes(parent.status) || parent.status === "waiting";
      const ok = settled && p.needs.every((m) => complete(rec, m));
      const want = ok ? "ready" : "blocked";
      if (p.status !== want) { p.status = want; moved = true; }
    }
  }
  let file = null;
  const pending = rec.parts.find((p) => { const j = currentJob(p); return j && !j.id; });
  const live = rec.parts.some((p) => ["queued", "started", "unverified"].includes(p.status) || (currentJob(p) && currentJob(p).id));
  if (pending) {
    const j = currentJob(pending);
    file = { n: pending.n, key: j.key, kind: j.kind, op: j.op };
  } else if (!live && !rec.stop) {
    const next = rec.parts.filter((p) => p.status === "ready").sort((a, b) => a.at - b.at || a.n - b.n)[0];
    if (next) {
      const kind = next.phase === "run" && next.route ? "run" : "route";
      const op = kind === "route" ? ROUTE_OP : (next.route.op === "addon" ? "addon" : "edit");
      next.seq += 1;
      const key = jobKey(rec.key, next.n, next.seq);
      next.jobs.push({ key, kind, op, id: null, seq: next.seq, end: null });
      next.status = "queued";
      file = { n: next.n, key, kind, op };
    }
  }
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return { record: settleState(rec, now), file };
}

/** The request's own state, from its parts. */
export function settleState(rec, now = Date.now()) {
  const ps = rec.parts;
  const ended = ps.length > 0 && ps.every((p) => PART_TERMINAL.includes(p.status));
  if (ended) {
    const done = ps.filter((p) => p.status === "done").length;
    const some = ps.filter((p) => p.status === "done" || p.status === "partial").length;
    rec.state = done === ps.length ? "done" : some ? "partial" : (rec.stop ? "stopped" : "failed");
    if (!rec.ended) { rec.ended = true; rec.endedAt = now; }
  } else {
    rec.ended = false;
    rec.state = ps.some((p) => p.status === "unverified") ? "review"
      : ps.some((p) => ["queued", "started", "ready"].includes(p.status)) ? "running"
      : ps.some((p) => p.status === "waiting" || p.status === "approval") ? "waiting" : "blocked";
  }
  return rec;
}

/** The ids of every job of the request that has not ended: the rows a step reads. */
export function liveJobIds(rec) {
  const out = [];
  for (const p of rec.parts) { const j = currentJob(p); if (j && j.id) out.push(j.id); }
  return out;
}

/**
 * THE QUESTIONS WAITING TO BE ASKED: a waiting part's question that is not the
 * site's live one — the slot held another when it was asked, or a newer
 * message replaced it — in the order the parts started. The site keeps one
 * question at a time; each is put there in turn, and never over another that
 * is pending.
 */
export function questionsToOffer(rec, live) {
  return rec.parts
    .filter((p) => p.status === "waiting" && p.question && p.question.id && p.question.request)
    .filter((p) => !live || live.id !== p.question.id || live.status !== "pending")
    .sort((a, b) => (a.question.at || 0) - (b.question.at || 0) || a.n - b.n);
}

/** Record that a waiting part's question is now the site's live one. */
export function noteOffered(record, n, id) {
  const rec = clone(record);
  const p = rec.parts[n];
  if (p && p.question && p.question.id === id) p.question.queued = false;
  return rec;
}

/** Record the id of the job filed under `key` (the filing's answer, or a duplicate's). */
export function noteJobId(record, key, id) {
  const rec = clone(record);
  for (const p of rec.parts) {
    for (const j of p.jobs) {
      if (j.key !== key || j.id) continue;
      j.id = id;
      if (p.why === "site-review") p.why = null;
    }
  }
  return rec;
}

/**
 * A JOB THE SITE WOULD NOT TAKE YET: the site is paused while a job that
 * stopped mid-publish is checked (`edit_create`'s `needs-review`). The part
 * keeps its place and says why; its job is filed when the site takes jobs
 * again, under the same key.
 */
export function noteFilingRefused(record, key, error) {
  const rec = clone(record);
  if (error !== "needs-review") return rec;
  for (const p of rec.parts) for (const j of p.jobs) if (j.key === key && !j.id) p.why = "site-review";
  return rec;
}

// ── AN ANSWER FOR A WAITING PART ─────────────────────────────────────────────

/**
 * THE ANSWER TO A PART'S QUESTION, ON THE SERVER. The routing call that read
 * the answer has already decided the waiting words with it (`routed`), as it
 * does for any waiting request, so the part runs next with that decision and
 * no second routing call. `resume` is what the answer must still do (the
 * question record's request), `context` every answer the request now has,
 * `round` the questions its part has asked. A routing answer that is not work
 * leaves the part as the answer settles it: a question about the site is
 * answered; a rebuild needs a go-ahead.
 */
export function answerPart(record, n, { routed, resume, context, round, now = Date.now() } = {}) {
  const rec = clone(record);
  const p = rec.parts[n];
  if (!p || p.status !== "waiting") return null;
  const told = readContext(context);
  if (told !== null) rec.context = told;
  p.question = null;
  p.askRound = Number.isInteger(round) && round > 0 ? round : p.askRound;
  if (typeof resume === "string" && resume.trim()) p.resume = resume.trim();
  if (routed && (routed.intent === "edit" || routed.intent === "addon")) {
    p.route = { ...routeOf(routed), hops: 0 };
    p.phase = "run";
    p.status = "ready";
    // WHAT THE ROUTER HELD BACK WHILE READING THE ANSWER becomes parts of the
    // request, as a routing job's do, and is taken out of what this part runs.
    const also = heldList(routed.alsoAsked) || [];
    if (also.length) {
      const deps = Array.isArray(routed.dependsOn) ? routed.dependsOn : [];
      const needsFirst = deps.filter((d) => d.change === 0).flatMap((d) => d.after);
      const made = carveParts(rec, n, also, { dependsOn: deps.filter((d) => d.change !== 0), sibling: needsFirst });
      const before = needsFirst.map((i) => made[i - 1]).filter(Number.isInteger);
      if (before.length) { for (const m of before) if (!p.needs.includes(m)) p.needs.push(m); p.phase = "route"; p.route = null; p.status = "blocked"; }
    }
  } else if (routed && routed.intent === "ask") {
    p.status = "done"; p.answer = typeof routed.answer === "string" ? routed.answer : ""; p.done = "answered a question about the site"; p.outcome = { kind: "answer" };
  } else if (routed && routed.intent === "build") {
    askApproval(p, "rebuild", now);
  } else return null;
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return settleState(rec, now);
}

/**
 * AN ANSWER MET WITH THE NEXT QUESTION (the routing route's `replaceAsk`): the
 * part keeps waiting, on the new question, with every answer so far. `ask` is
 * the question as the card shows it, with its request, stage and round.
 */
export function askedAgain(record, n, { ask, context, now = Date.now() } = {}) {
  const rec = clone(record);
  const p = rec.parts[n];
  const q = askOf(ask);
  if (!p || p.status !== "waiting" || !q || !q.id) return null;
  const told = readContext(context);
  if (told !== null) rec.context = told;
  p.question = { ...q, queued: false, at: now };
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return settleState(rec, now);
}

/**
 * A PART'S QUESTION CANCELLED by the customer (the question's own Cancel): the
 * part ends there, said, and what needed it is not run. `null` when the part is
 * not waiting on that question.
 */
export function cancelPart(record, n, questionId, now = Date.now()) {
  const rec = clone(record);
  const p = rec.parts[n];
  if (!p || p.status !== "waiting" || !p.question || p.question.id !== questionId) return null;
  p.status = "cancelled"; p.why = "question-cancelled"; p.question = null;
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return settleState(rec, now);
}

/**
 * THE CUSTOMER'S GO-AHEAD FOR A PART'S FULL REWRITE, RECORDED (2026-10-03):
 * the part runs the rewrite as its next job — `job` the build's id, derived
 * from the request (so a second press finds the same one). Recorded before
 * anything is filed, as a job not yet filed (the owner's second review: the
 * go-ahead is durable once written): the next step files it (`nextStep`'s
 * pending job), whoever takes that step — the press, the sweep, a job's end.
 * The press stores the build's job first, so whatever files it has all it
 * needs. `null` when the part is not waiting for a go-ahead: given already
 * (by another press, another device), stopped, or past its day.
 */
export function approvePart(record, n, { job, seq, now = Date.now() } = {}) {
  const rec = clone(record);
  const p = rec.parts[n];
  if (rec.stop || rec.ended || !p || p.status !== "approval" || typeof job !== "string" || !job || !Number.isInteger(seq) || seq <= (p.seq || 0)) return null;
  p.seq = seq;
  p.jobs.push({ key: job, kind: "rewrite", op: "build", id: null, seq, end: null });
  p.status = "queued"; p.phase = "rewrite"; p.why = null;
  p.approval = { at: now, job };
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return settleState(rec, now);
}

/** The next job number a part's go-ahead files its rewrite under. */
export const approvalSeq = (p) => (Number(p && p.seq) || 0) + 1;

/** The part a waiting question belongs to, kept on the record when the question is asked again (`part.question`). */
export function askedPart(record, questionId) {
  return (record && record.parts || []).find((p) => p.status === "waiting" && p.question && p.question.id === questionId) || null;
}

// ── THE BODIES OF A PART'S JOBS ──────────────────────────────────────────────

/** What every model call of a part is shown beside its words (`partBlock`): the message, and what came before. */
export function partOf(rec, n) {
  return {
    key: rec.key, part: n, original: rec.message,
    done: rec.parts.filter((q) => q.n !== n && q.status === "done" && q.done).map((q) => ({ words: q.words, said: q.done })),
    context: rec.context,
  };
}

/**
 * THE POST A PART'S JOB REPLAYS, built from the record alone — exactly what the
 * page posts after routing (`siteEdit`, `siteAddon`, the routing call), so a
 * part runs through the same route, the same gates and the same publish and
 * charging as a message sent by hand. `files` are `{ data, name }`, read back
 * from the record's durable copies by the caller, for the step that reads
 * files (today the logo step, as the page sends them).
 */
export function jobBody(rec, n, kind, key, { files = [] } = {}) {
  const p = rec.parts[n];
  const words = p.resume || p.words;
  // WHAT A RUN SENDS: the request an answer left (`resume`), or part 0's whole
  // message (`runs`, its held parts beside it), or the part's own words.
  const runs = p.resume || p.runs || p.words;
  const putOff = p.resume ? undefined : heldWire(p.putOff && p.putOff.length ? p.putOff : undefined);
  const request = partOf(rec, n);
  if (kind === "route") {
    // ROUTED AGAINST THE SITE AS IT IS NOW: no table names from the page that
    // sent the message, so the route reads the site's own (`routeDigest`) —
    // a part before this one may have added one. Its own page list replaces
    // the one kept here whenever it can be read.
    const digest = plain(rec.digest) ? { ...rec.digest, tables: [] } : { pages: [], tables: [] };
    return {
      url: "/api/site/route",
      body: {
        message: words, site: digest, picker: rec.picker, firstBuild: false, brief: words, qa: [],
        answering: false, attached: rec.files.length > 0 || rec.attached, slug: rec.slug, hasSite: true, idem: key, request,
      },
    };
  }
  const d = p.route || {};
  const context = contextWire(rec.context);
  const askRound = Number.isInteger(p.askRound) && p.askRound > 0 ? p.askRound : undefined;
  // WHAT THE STEP TAKES OUT OF WHAT IT RUNS: the parts held back that are in
  // those words — after an answer, the request it left holds only its own and
  // what the answer's routing held back, never the message's other parts.
  const inRun = p.held.filter((w) => !p.resume || !!wordsIn(p.resume, w));
  const held = inRun.length ? inRun : undefined;
  if (d.op === "addon") {
    return {
      url: "/api/site/" + encodeURIComponent(rec.slug) + "/addon",
      body: {
        instruction: runs, picker: rec.picker, idem: key, tz: rec.tz,
        alsoAsked: heldWire(held),
        handOver: plain(d.handOver) ? d.handOver : undefined,
        askRound, putOff, context,
        routedCost: Number.isInteger(d.cost) && d.cost >= 0 ? d.cost : undefined,
        attached: rec.files.length || rec.attached ? true : undefined,
        request,
      },
    };
  }
  const imgs = d.layer === "logo" ? files.slice(0, 3) : [];
  return {
    url: "/api/site/" + encodeURIComponent(rec.slug) + "/edit",
    body: {
      layer: String(d.layer || ""),
      page: d.page ? String(d.page) : "",
      remove: d.remove === true,
      rename: typeof d.rename === "string" ? d.rename : "",
      tab: d.tab === true,
      instruction: runs,
      alsoAsked: heldWire(held),
      addition: d.fromAddon === true ? true : undefined,
      handedOff: d.handedOff === true ? true : undefined,
      handOver: plain(d.handOver) ? d.handOver : undefined,
      askRound, putOff, context,
      attached: rec.files.length || rec.attached ? true : undefined,
      picker: rec.picker,
      routedCost: Number.isInteger(d.cost) && d.cost >= 0 ? d.cost : undefined,
      recent: d.layer === "data" && Array.isArray(rec.recent) && rec.recent.length ? rec.recent.slice(0, 3) : undefined,
      images: imgs.length ? imgs : undefined,
      idem: key,
      request,
    },
  };
}

/** The `request` a replayed body carries, read back by the routes: `{ key, part, original, done, context }`, or `null`. */
export function readRequestOf(v) {
  if (!plain(v) || !isRequestKey(v.key) || !Number.isInteger(v.part) || v.part < 0) return null;
  const original = typeof v.original === "string" ? v.original.trim() : "";
  if (!original || original.length > MAX_INPUT_CHARS) return null;
  const done = Array.isArray(v.done) ? v.done.filter((d) => plain(d) && typeof d.words === "string" && typeof d.said === "string") : [];
  const context = readContext(v.context);
  if (context === null) return null;
  const chars = original.length + done.reduce((s, d) => s + d.words.length + d.said.length, 0);
  if (chars > MAX_CARRIED_CHARS) return null;
  return { key: v.key, part: v.part, original, done, context };
}

// ── WHAT THE PAGE AND THE REPLY ARE SHOWN ────────────────────────────────────

/** A run job whose own reply explains its part: it ended with an answer, and was not a hand-over. */
const shownRun = (j) => j.kind === "run" && !!j.id && !!j.end && !["hop", "climb", "answerless"].includes(j.end.act);

/**
 * A PART'S PROGRESS LINES (2026-10-06): each of its run jobs' lines in the
 * order the jobs were filed, each line with its job — read by the Worker off
 * the jobs' own records and handed in (`progress`, by job id), never kept on
 * the request.
 */
function partProgress(p, progress) {
  const out = [];
  if (!progress || typeof progress !== "object") return out;
  for (const j of p.jobs) {
    if (!j || j.kind !== "run" || !j.id || !Object.hasOwn(progress, j.id) || !Array.isArray(progress[j.id])) continue;
    for (const l of progress[j.id]) if (l && typeof l === "object") out.push({ job: j.id, n: l.n, ms: l.ms, text: l.text });
  }
  return out;
}

/**
 * A REQUEST AS THE PAGE FOLLOWS IT: each part with its words, its status and
 * why, its question while it waits, and the run jobs whose stored answers
 * explain it (the page fetches each through the job poll, which writes its
 * model reply once). Nothing private: no uid, no files' keys. `progress`
 * (2026-10-06) is each run job's progress lines by job id, read at the look;
 * a part with none carries no `progress` at all. `said` is each part's own
 * line in every state, by part number, read off the request's narration
 * record at the look (`saidForRequest`): a part with none carries no `said`,
 * and the page names it by its words.
 */
export function requestView(rec, { progress = null, said = null } = {}) {
  // THE MESSAGE'S OWN ROUTING CHARGE, WHEN NO PART'S REPLY SAYS IT: part 0's
  // run carries it (`routedCost`) only when part 0 ran on the answer that
  // accepted the message and its job's reply was written; a part 0 routed
  // again, stopped or never run leaves it to the request's own reply.
  const p0 = rec.parts[0];
  const saidByPart0 = !!p0 && !p0.jobs.some((j) => j.kind === "route") && p0.jobs.some(shownRun);
  return {
    key: rec.key, state: rec.state, ended: rec.ended === true, stop: rec.stop === true, at: rec.at, updatedAt: rec.updatedAt,
    routedUnsaid: !saidByPart0 && Number.isInteger(rec.routedCost) && rec.routedCost > 0 ? rec.routedCost : 0,
    parts: rec.parts.map((p) => ({
      n: p.n, words: typeof p.shown === "string" && p.shown ? p.shown : p.words, status: p.status,
      // WHAT A STEP FOR IT IS SENT — the full rewrite's go-ahead sends this.
      ...(p.status === "needs-rewrite" || p.status === "approval" ? { ask: p.resume || p.words } : {}),
      // THE APPROVED REWRITE'S BUILD, which no job poll reads (`/api/site/build/<id>` does).
      ...(p.approval ? { approved: { at: p.approval.at } } : {}),
      // EVERY JOB IT FILED, in order — its routing, its runs, its rewrite —
      // for a reader that checks each one's row and ledger (the UI canary).
      ids: p.jobs.filter((j) => j.id).map((j) => j.id),
      ...(p.why ? { why: p.why } : {}),
      // WHAT ITS TRIES LEFT STANDING (2026-10-07): the reply's facts and the
      // card read it here — dropped from this view, a part stopped after its
      // table went in was told as stopped "before it changed anything".
      ...(leftValue(p.left) && p.status !== "done" ? { left: leftValue(p.left) } : {}),
      ...(p.status === "waiting" && p.question ? { question: { id: p.question.id, text: p.question.text, options: p.question.options, ...(p.question.note ? { note: p.question.note } : {}), ...(p.question.queued ? { queued: true } : {}) } } : {}),
      ...(typeof p.answer === "string" ? { answer: p.answer } : {}),
      // THE JOBS WHOSE OWN REPLY EXPLAINS THIS PART: every run that ended with an
      // answer, never a hand-over (the page says nothing for one, as it never
      // did) or a job that ended without an answer.
      jobs: p.jobs.filter(shownRun).map((j) => j.id),
      // WHAT ITS JOBS WERE CHARGED, from their rows (`chargedOf`): its routing,
      // its runs, a hand-over's, whatever came back excluded.
      // A job whose cost cannot be told (a rewrite whose answer named none)
      // makes the part's money cannot-tell (null), never a smaller number.
      charged: p.jobs.some((j) => j.end && j.end.cost === null) ? null : p.jobs.reduce((s, j) => s + (j.end && Number.isInteger(j.end.cost) ? j.end.cost : 0), 0),
      ...(p.route ? { route: p.route.op === "addon" ? "addon" : (p.route.layer || "edit") } : {}),
      // AN EDIT THE ADD-ON STEP HANDED THIS PART TO, as its job's body marks it
      // (`addition`): read by the UI canary's wall for an additions scenario.
      ...(p.route && p.route.op !== "addon" && p.route.fromAddon === true ? { addition: true } : {}),
      // WHAT ITS JOBS SAID WHILE THEY RAN (2026-10-06), when they said anything.
      ...((lines) => (lines.length ? { progress: lines } : {}))(partProgress(p, progress)),
      // AND ITS OWN LINE IN EVERY STATE, when the model has written it.
      ...(said && typeof said === "object" && Object.hasOwn(said, p.n) && said[p.n] ? { said: said[p.n] } : {}),
    })),
  };
}
