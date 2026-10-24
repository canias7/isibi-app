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
import { heldList, heldParts, wordsIn, wordSpans, readSpans, readContext, EDIT_LAYERS } from "./site-ask.mjs";
import { MAX_INPUT_CHARS, MAX_CARRIED_CHARS, REWRITE_MAX_CHARS } from "./input-budget.mjs";
import { REQUEST_KEY_RE } from "./clarify.mjs";
import { readMarks } from "./prepared.mjs";
import { outcomeOf } from "./site-reply.mjs";
import { savedDraftOf } from "./check-evidence.mjs";
import { readTargets, inferNeeds, neededFrom, applyOrder, clearToPrepare, clearToWrite, prepScope, addonScope, routeScope } from "./request-plan.mjs";

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
/** The refusals a part's run gets only from another part of its own request beside it (2026-10-16). */
export const OVERLAP_LOSSES = Object.freeze(["conflict", "turn", "turn-lost", "older"]);
/** How many times a part that lost to such an overlap runs again, alone, before it fails. */
export const OVERLAP_RETRIES = 2;
/**
 * A CHECKPOINT THAT COULD NOT BE SAVED OR READ JUST NOW (round 14, after
 * Codex's pass on 29fc95af): the part is `recovering`, durable on its request,
 * and the server's own driver runs it again — at once the first time, then
 * after a wait that doubles from `HELD_RECOVER_FIRST_MS` up to
 * `HELD_RECOVER_MAX_MS` — for as long as any wait on a request lasts
 * (`WAIT_MS`, a day). Each job tries the store itself several times. The
 * customer sends nothing again; a restart loses nothing, because the next try
 * is a time on the record, and the two-minute sweep moves every unfinished
 * request on.
 */
export const HELD_RECOVER_FIRST_MS = 30000;
export const HELD_RECOVER_MAX_MS = 30 * 60 * 1000;
/** How long the part waits before its `tries`-th job: none for the first, then 30 s, 1 min, 2 min … up to 30 min. */
export function heldRecoverDelay(tries) {
  if (!Number.isInteger(tries) || tries <= 1) return 0;
  return Math.min(HELD_RECOVER_FIRST_MS * 2 ** (tries - 2), HELD_RECOVER_MAX_MS);
}

// ── PREPARATION (2026-10-08, the parallel-tasks batch) ──────────────────────
//
// The site's lock lets one job write at a time, and it stays that way: writes
// are applied one after another against the site as it then is. What may run
// beside them is a part's PREPARATION — its routing and its step's model calls
// (and a picture the step buys), made in the Worker with nothing written to
// the site, every answer recorded. When the part's own job runs, under the
// lock, each call whose request is exactly what was prepared is answered from
// the record, and any other is made then: a part whose inputs another part
// changed is planned again against the current site, never applied from a
// stale one. The job bills what its step used, prepared or not, once, as
// every job does; a preparation never touches the ledger.
/** Parts of one request prepared at once, at most. */
export const PREP_MAX_LIVE = 3;
/** Preparations one part may start for one step of it: the first, and one after a preparation that went quiet. */
export const PREP_TRIES = 2;
/** How long a preparation that has not answered is waited for before its part runs without it (or it is tried again). */
export const PREP_FRESH_MS = 10 * 60 * 1000;
/**
 * The edit steps a preparation runs up to their first write: their model calls
 * and the pictures they buy. Text, menu and picture stop at their publish; look
 * before the look is stored; page at its publish (its tweak or its rewrite);
 * data and rules before a row or a grant is touched (2026-10-09). The logo step
 * makes no model call, so there is nothing to prepare.
 */
export const PREP_LAYERS = Object.freeze(["text", "nav", "picture", "look", "page", "data", "rules"]);
/** And the add-on step: its picker and designers, and an addition with no database its page writer, up to its first write (2026-10-09). */
export const PREP_ADDON = true;
/** Hand-overs one part may make before the full rewrite is the only way left: an edit's, the add-on's, and one more. */
export const HOPS_MAX = 3;

/**
 * A CHANGE TOO BIG FOR THE SMALLER STEPS SPLITS ITSELF (owner, 2026-10-24:
 * an edit or addition that is too big re-plans itself as smaller parts and
 * carries on, never asking the customer to resend). A part whose step says
 * `split` is routed again, the router told the step's reason and asked to
 * split the words into parts it can do (`split` on the routing job's
 * `request`, `partBlock`'s section); the parts it holds back are carved as
 * parts of their own and run, each charged as any part is. `SPLIT_MAX` is how
 * deep that goes: a part split once, or carved from one, that comes back too
 * big may split once more; beyond that it ends `too-big`, honestly, with the
 * step's reason. `SPLIT_NOT` are the reasons a smaller part cannot fix (a
 * change of what kind of site it is, a site without its saved design): those
 * end as before.
 */
export const SPLIT_MAX = 2;
export const SPLIT_NOT = Object.freeze(["build", "no-look", "no-meta", "needs-pages"]);

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
//   uncertain      a picture purchase for it was begun (by its preparation, or an earlier
//                  try) and nobody can tell whether it went through (2026-10-09, round 3):
//                  held, nothing published or charged, what needs it held, independent
//                  parts going on. Moved on (`purchaseResolved`) when the purchase is found
//                  to have landed or the customer says to buy it again; expires in a day
//   recovering     its job could not save or read the requirements it resumes with
//                  (round 14): nothing applied or charged, its checkpoint and kept answers
//                  stay; the driver runs it again at `recover.next` (`heldRecoverDelay`),
//                  what needs it held, independent parts going on. Ends as failed, saying
//                  why, only when its checkpoint is known lost (missing with no copy, or
//                  malformed) or after a day of tries
//   expired        its question went unanswered for a day
//   refused        it could not be placed in an order that makes sense (the relations formed a cycle)
export const PART_TERMINAL = Object.freeze(["done", "partial", "failed", "not-run", "cancelled", "needs-rewrite", "expired", "refused"]);
/**
 * MAY ANOTHER PART OF THIS REQUEST WRITE BESIDE PART `n`? (2026-10-23, audit
 * S2-3) Any other part not ended, except one that cannot start before `n`
 * ends: a `blocked` part that needs `n`, or follows it, directly or through
 * another such part. An addition's own schema guard asked every open part,
 * so the part that needed the addition made it lose, and re-run, every time.
 */
export function othersOpenIn(rec, n) {
  if (!rec || !Array.isArray(rec.parts)) return true;
  const behind = new Set([n]);
  for (let grew = true; grew;) {
    grew = false;
    for (const p of rec.parts) {
      if (!p || behind.has(p.n) || p.status !== "blocked") continue;
      const after = (Array.isArray(p.needs) && p.needs.some((m) => behind.has(m))) || (p.parent !== null && p.parent !== undefined && behind.has(p.parent));
      if (after) { behind.add(p.n); grew = true; }
    }
  }
  return rec.parts.some((p) => p && !behind.has(p.n) && !PART_TERMINAL.includes(p.status));
}
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
/** The reasoning efforts a request may carry (xAI's own). */
const REQUEST_EFFORTS = ["low", "medium", "high", "xhigh"];
export function newRequest({ key, uid, slug, message, picker = "", effort = "", tz = "", digest = null, recent = null, files = [], attached = false, context = [], accepted = null, routedCost = null, parts = [], attempt = "", labels = null, at = Date.now() } = {}) {
  if (!isRequestKey(key) || typeof uid !== "string" || !uid || !isRequestSlug(slug)) return null;
  const text = typeof message === "string" ? message.trim() : "";
  if (!text || text.length > MAX_INPUT_CHARS) return null;
  const told = readContext(context);
  if (told === null) return null;
  const rec = {
    v: REQUEST_V, key, uid, slug, at, updatedAt: at, rev: 1,
    message: text,
    picker: typeof picker === "string" ? picker : "",
    // THE CUSTOMER'S EFFORT (2026-10-20): every part's job is filed with it.
    ...(REQUEST_EFFORTS.includes(effort) ? { effort } : {}),
    tz: typeof tz === "string" ? tz.slice(0, 64) : "",
    digest: plain(digest) ? digest : null,
    // WHAT EACH PAGE CALLED ITSELF WHEN THE MESSAGE WAS UNDERSTOOD (2026-10-11,
    // round 11): the identity the customer's words were read against. An
    // addition's picker and designers find "the booking page" by it, and a
    // headline changed by another part of this same request never changes
    // their request (`readLabels`).
    labels: readLabels(labels),
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

/** A page-label snapshot read strictly: `{ "/path": "label" }`, at most 200, each a short string; null otherwise. */
export function readLabels(v) {
  if (!plain(v)) return null;
  const out = {};
  let n = 0;
  for (const [k, l] of Object.entries(v)) {
    if (typeof k !== "string" || !/^\/[a-z0-9/_-]{0,80}$/i.test(k) || typeof l !== "string" || !l.trim()) continue;
    if (++n > 200) break;
    out[k] = l.trim().slice(0, 80);
  }
  return n ? out : null;
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
    // WHAT IT TOUCHES, as the model named it (`readTargets`), and its
    // PREPARATION (2026-10-08, the parallel-tasks batch): null until either.
    targets: null, prep: null,
  };
}

/** One change's named targets merged into a part's (`{ writes, reads }`), each kept once. */
function addTargets(part, t) {
  if (!part || !t || typeof t !== "object") return;
  const cur = part.targets && typeof part.targets === "object" ? part.targets : { writes: [], reads: [] };
  for (const k of ["writes", "reads"]) {
    const list = Array.isArray(cur[k]) ? cur[k].slice() : [];
    for (const x of Array.isArray(t[k]) ? t[k] : []) if (!list.includes(x)) list.push(x);
    cur[k] = list;
  }
  part.targets = cur;
}

/** What a routing answer says the part it routed should run with. */
function routeOf(r) {
  const intent = r && r.intent === "addon" ? "addon" : "edit";
  return {
    op: intent, intent,
    layer: intent === "edit" && typeof r.layer === "string" ? r.layer : "",
    page: typeof r.page === "string" ? r.page : "",
    remove: r.remove === true, rename: typeof r.rename === "string" ? r.rename : "", tab: r.tab === true,
    // WHICH SCREEN SIZES (2026-10-24): the router's proper subset, or none (all three).
    ...(Array.isArray(r.devices) && r.devices.length ? { devices: r.devices.slice(0, 3) } : {}),
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
  // WHAT EACH PART TOUCHES, as the model numbered the changes (2026-10-08),
  // through the same folding: a held part inside another is that part.
  const named = readTargets(routed && routed.targets);
  for (const [c, t] of Object.entries(named)) {
    const me = numberOf[Number(c)];
    if (Number.isInteger(me)) addTargets(parts[me], t);
  }
  // AND THE WAITING THE MODEL DID NOT SAY: a part that refers to something
  // another part creates waits for it, whichever order the words came in
  // (`inferNeeds` — creation only, never a cycle with what the model said).
  inferNeeds(parts);
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
 * needs it whole (`complete`). Returns the new parts' numbers, with
 * `byChange`: each of the router's change numbers as a part (null if skipped).
 *
 * `sibling` (a routing job's held part that the part itself needs first) is
 * not carved from it but added beside it, with the part waiting for it.
 */
export function carveParts(rec, parentN, words, { dependsOn = [], sibling = [], targets = null } = {}) {
  const parent = rec.parts[parentN];
  if (!parent) return [];
  const made = [];
  const numberOf = [parentN];
  for (const w0 of Array.isArray(words) ? words : []) {
    const w = wordsIn(rec.message, w0);
    numberOf.push(null);
    if (!w || w.length >= parent.words.length) continue;
    // ONE THAT ALREADY IS A PART is that part, for the numbers that name it.
    const same = rec.parts.find((q) => q.words === w && q.n !== parentN);
    if (same) { numberOf[numberOf.length - 1] = same.n; continue; }
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
  // WHAT EACH NEW PART TOUCHES, numbered as the words were (0 the parent).
  if (targets && typeof targets === "object") {
    for (const [c, t] of Object.entries(targets)) {
      const me = numberOf[Number(c)];
      if (Number.isInteger(me)) addTargets(rec.parts[me], t);
    }
  }
  inferNeeds(rec.parts);
  refuseCycles(rec.parts);
  // THE ROUTER'S CHANGE NUMBERS, read as parts (A02-2): a skipped entry keeps
  // its number, so `made[i - 1]` would land on the wrong part.
  Object.defineProperty(made, "byChange", { value: numberOf });
  return made;
}

// ── A CHANGE SENT WHILE THE REQUEST RUNS (2026-10-23, background work) ──────

/**
 * A NEW MESSAGE JOINS THE LIVE REQUEST as parts of its own: planned as any
 * message is (`planParts`, with its routing answer), numbered after the parts
 * already there, its words added to the request's message (so a later carve
 * finds them), and then the waiting the model did not say is read over all
 * the parts (`inferNeeds`), so a new part that refers to something an earlier
 * part creates waits for it. The parts already there are never changed: they
 * do not start waiting on the new ones, and what they carved or held stays.
 *
 * `{ ok: true, rec, parts }` (a new record; `parts` the new numbers), the
 * same parts with `duplicate` when this message key already joined, or
 * `{ ok: false, why }`: `ended` (the request ended or was stopped: the message
 * becomes a request of its own), or the plan's own refusal.
 */
export function appendParts(rec, { key, message, routed, at = Date.now() } = {}) {
  if (!rec || !Array.isArray(rec.parts)) return { ok: false, why: "no-request" };
  if (!isRequestKey(key)) return { ok: false, why: "key" };
  const joined = Array.isArray(rec.joined) ? rec.joined : [];
  const had = joined.find((j) => j && j.key === key);
  if (had) return { ok: true, rec, parts: had.parts.slice(), duplicate: true };
  if (rec.ended || rec.stop) return { ok: false, why: "ended" };
  const text = typeof message === "string" ? message.trim() : "";
  if (!text || text.length > MAX_INPUT_CHARS) return { ok: false, why: "message" };
  const planned = planParts(text, routed);
  if (!planned.ok) return planned;
  const next = clone(rec);
  const base = next.parts.length;
  const offset = next.message.length + 2;
  next.message = next.message + "\n\n" + text;
  const kept = next.parts.map((p) => p.needs.slice());
  const made = [];
  for (const p of planned.parts) {
    p.n += base;
    p.needs = p.needs.map((m) => m + base);
    if (Number.isInteger(p.parent)) p.parent += base;
    p.at = offset + Math.max(0, p.at);
    p.joined = key;
    next.parts.push(p);
    made.push(p.n);
  }
  inferNeeds(next.parts);
  // THE PARTS ALREADY THERE KEEP THEIR OWN WAITING: only a new part waits.
  kept.forEach((needs, i) => { next.parts[i].needs = needs; });
  refuseCycles(next.parts);
  // A NEW ANSWERED PART THAT NOW WAITS is routed again when its turn comes,
  // as `planParts` does for part 0 (its answer was made before what it needs).
  const first = next.parts[base];
  if (first && first.needs.length && first.phase === "run") { first.phase = "route"; first.route = null; first.runs = null; first.held = []; first.putOff = []; }
  for (const n of made) { const p = next.parts[n]; if (p.status !== "refused") p.status = p.needs.length ? "blocked" : "ready"; }
  next.joined = [...joined, { key, at, parts: made }];
  next.updatedAt = at;
  return { ok: true, rec: settleState(next, at), parts: made };
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
    ...(typeof v.by === "string" && /^[a-z]+:[a-z]{1,24}$/.test(v.by) ? { by: v.by } : {}),
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
  if (b.recovered === true) {
    // A RECONCILED SAVE PROVEN BY ITS OWN DRAFT REVISION (2026-10-16): saved,
    // not published — told apart from a publish whose details were lost.
    const saved = b.reconciled === "draft-saved" ? savedDraftOf(b.draft) : null;
    return saved ? { act: "recovered", draft: saved } : { act: "recovered" };
  }
  return { act: "success", ask, deferred };
}

/**
 * A JOB ANSWER'S SAVED DRAFT (2026-10-16, the frontend batch): its revision,
 * version and preview readiness as the answer gives them (`draftFacts`), or
 * null when the answer names no saved, unpublished revision. Read so the
 * request's card can say "saved as a draft" from the job's own answer.
 */
function answerDraft(body) {
  const d = body && typeof body === "object" ? body.draft : null;
  if (!d || typeof d !== "object" || d.published !== false || !Number.isSafeInteger(d.revision) || d.revision <= 0) return null;
  return { revision: d.revision, version: typeof d.version === "string" ? d.version : "", preview: d.previewUploaded === true ? "ready" : d.previewPending === true ? "pending" : "unknown" };
}
const SAVED_DONE = (d) => "saved the change as draft revision " + d.revision + " (not published; what it changed was not recorded)";

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
  // A STEP'S OWN LIST OF WHAT IT WAS ASKED AND DID NOT MAKE (2026-10-23, the text step).
  for (const n of list(b.notDone)) if (plain(n) && str(n.what)) add(n.what, n.why || "not-done");
  for (const k of list(b.keptParts)) add(str(k) || "component", "kept");
  for (const k of list(b.unseenParts)) add(str(k) || "component", "unseen");
  for (const d of list(b.dropped)) if (plain(d) && d.why !== "duplicate") add(d.label || d.href || "entry", d.why || "left-out");
  for (const r of list(b.refusedLinks)) if (plain(r)) add(r.label || r.to || "link", r.why || "refused");
  // A MARKED FRAME THE PLACEMENT STEP COULD NOT FILL (round 5).
  for (const x of list(b.notPlaced)) if (plain(x)) add(x.d || "photograph", x.why || "not-placed");
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
    return { act: "route", route: routeOf(b), alsoAsked: heldList(b.alsoAsked) || [], dependsOn: Array.isArray(b.dependsOn) ? b.dependsOn : [], targets: readTargets(b.targets) };
  }
  if (b.intent === "build") return { act: "rewrite", why: "rebuild" };
  return { act: "unknown" };
}

/**
 * WHERE A HAND-OVER GOES — the page's `escalateAction`, now the server's.
 *
 *   an edit naming the add-on goes there, unless the add-on handed it this
 *   part (then it stops: it would ask the add-on the question it just answered);
 *   an edit naming another layer hops to it; the add-on naming an edit layer
 *   hands it there as an addition (`fromAddon`).
 *
 * ── THE FULL REWRITE IS NEVER A FALLBACK (owner, 2026-10-24) ──────────────
 * *"Keep [the rewrite] only for a full new site description on a site that
 * exists, and for the customer clearly asking to start over … remove it as an
 * automatic fallback."* A step that climbs (names no layer), a second hand-over,
 * a hand-over to its own layer and a chain past `HOPS_MAX` used to end in the
 * full rewrite's go-ahead (measured at 17 credits, every page written again).
 * Now:
 *   `split`        the change needs more than the smaller steps can make in one
 *                  go: the part ends, said, and the customer is asked to send it
 *                  as smaller changes. Nothing is rewritten and nothing charged.
 *   `retry-build`  the step found the site has NO PAGES (`no-source`): its first
 *                  build never finished (a placeholder). The offer is the build
 *                  tried again, never a rewrite of pages that do not exist.
 */
export function handOff(read, route) {
  const from = plain(route) ? route : {};
  if (read.act === "climb") return read.reason === "no-source" ? { act: "retry-build" } : { act: "split", why: "climb" };
  if (read.act !== "hop") return { act: "unknown" };
  const named = read.layer;
  if ((from.hops || 0) >= HOPS_MAX) return { act: "split", why: "hops" };
  if (from.op === "addon") {
    if (!EDIT_LAYERS.includes(named)) return { act: "unknown" };
    return { act: "hop", op: "edit", layer: named, page: read.page, fromAddon: true, handedOff: true };
  }
  if (named === "addon") return from.fromAddon === true ? { act: "stop" } : { act: "hop", op: "addon", layer: "", page: read.page, fromAddon: false, handedOff: false };
  if (!EDIT_LAYERS.includes(named)) return { act: "unknown" };
  if (from.handedOff === true) return { act: "split", why: "handed-off" };
  if (named !== from.layer) return { act: "hop", op: "edit", layer: named, page: read.page, fromAddon: from.fromAddon === true, handedOff: true };
  return { act: "split", why: "same-layer" };
}

/** Why work moved (`EditPoll.handOver`'s `handOver`): the step it left, its reason and field, and the page; null when none is known. */
function handOverOf(from, read, page) {
  const ho = {};
  const fromName = from.op === "addon" ? "addon" : (from.layer || "");
  if (fromName) ho.from = fromName;
  if (read.reason) ho.reason = read.reason;
  if (read.field) ho.field = read.field;
  if (page) ho.page = page;
  return ho.from || ho.reason ? ho : null;
}

/** The route a hand-over runs with: where it goes and the part's context, never the first answer's verbs (W1). */
function handedRoute(from, to, read) {
  const page = to.page || from.page || "";
  return {
    op: to.op, intent: to.op, layer: to.op === "edit" ? to.layer : "",
    page, remove: false, rename: "", tab: false,
    // WHICH SCREEN SIZES (2026-10-24): the words did not change on the hop.
    ...(to.op === "edit" && Array.isArray(from.devices) && from.devices.length ? { devices: from.devices } : {}),
    handOver: handOverOf(from, read, page),
    cost: from.cost, handedOff: to.handedOff === true, fromAddon: to.fromAddon === true,
    hops: (from.hops || 0) + 1,
  };
}

/** The pages a step's answer says it added (`added`), as site paths. */
function createdPages(body) {
  const b = plain(body) ? body : {};
  return (Array.isArray(b.added) ? b.added : []).filter((x) => typeof x === "string" && x)
    .map((x) => (x.startsWith("/") ? x : "/" + x.replace(/^src\/routes\//, "").replace(/\.tsx$/, "").replace(/^index$/, "")).toLowerCase())
    .filter((x) => /^\/[a-z0-9][a-z0-9/_-]{0,80}$|^\/$/.test(x));
}

/** The words a part's step says it wrote (`changed`), as strings, at most 8 (2026-10-23, fix-edit-flow). */
export function changedOf(body) {
  const b = plain(body) ? body : {};
  // THE TEXT STEP'S `changed` IS THE WORDS IT WROTE; other steps' are files or fields.
  if (b.layer !== "text") return [];
  return (Array.isArray(b.changed) ? b.changed : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 8).map((x) => x.slice(0, 200));
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
/**
 * THE FRAME AN ADDITION HANDED ON (`frameHop`, 2026-10-24): a part of its own
 * that runs the menu/frame editor (an edit layer, as an addition from the
 * add-on step) with the frame's words, or the whole part's when they cannot be
 * told apart. Not made when another part already carries those words, nor
 * twice. Returns the new part, or null.
 */
export function frameFollowOn(rec, p, body) {
  const b = plain(body) ? body : {};
  const h = plain(b.frameHop) ? b.frameHop : null;
  if (!h || typeof h.layer !== "string" || !EDIT_LAYERS.includes(h.layer)) return null;
  const w = (typeof h.words === "string" && wordsIn(rec.message, h.words)) || p.words;
  if (!w) return null;
  const had = rec.parts.find((q) => q.source === "frame-hop" && q.parent === p.n);
  if (had) return had;
  if (w !== p.words && carried(rec, p.n, w)) return null;
  const route = handedRoute(p.route || {}, { op: "edit", layer: h.layer, page: "", fromAddon: true, handedOff: true }, {});
  const part = newPart(rec.parts.length, w, { at: Math.max(0, rec.message.indexOf(w)), source: "frame-hop", parent: p.n, route, phase: "run" });
  part.hops = route.hops;
  rec.parts.push(part);
  return part;
}

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
// A CARVED CHILD'S FAILURE NO LONGER BREAKS ITS PARENT (2026-10-24,
// request-needs): what the parent made stands, and a part that needs something
// of the parent asks whether that thing exists (`needMet`), the child's
// creations included.
/** Has the part and every part carved from it ended (or is it waiting on a question)? */
function ended(rec, n, seen = new Set()) {
  const p = rec.parts[n];
  if (!p || seen.has(n)) return false;
  seen.add(n);
  return PART_TERMINAL.includes(p.status) && childrenOf(rec, n).every((c) => ended(rec, c.n, seen));
}
/** The things (`page:/x`, `data:t`) a part and the parts carved from it really created. */
function createdBy(rec, n, seen = new Set()) {
  const p = rec.parts[n];
  if (!p || seen.has(n)) return [];
  seen.add(n);
  const own = Array.isArray(p.created) ? p.created.filter((t) => typeof t === "string") : [];
  return [...own, ...childrenOf(rec, n).flatMap((c) => createdBy(rec, c.n, seen))];
}
/** Record on a part what its step's answer says it created: pages added, tables added. */
function recordCreated(p, body) {
  const b = plain(body) ? body : {};
  const things = [
    ...createdPages(b).map((pg) => "page:" + pg),
    ...(Array.isArray(b.tables) ? b.tables : []).filter((t) => typeof t === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(t)).map((t) => "data:" + t.toLowerCase()),
  ];
  if (!things.length) return;
  const cur = Array.isArray(p.created) ? p.created.slice() : [];
  for (const t of things) if (!cur.includes(t)) cur.push(t);
  p.created = cur;
}
/** Statuses a prerequisite may end in and still let a part that needs it run when what it needs exists. */
const MADE_SOME = Object.freeze(["done", "partial", "failed"]);
/**
 * IS PART `p`'S NEED OF PART `m` MET? `"yes"`, `"wait"`, or the list of the
 * concrete things it needs that `m` did not create (2026-10-24, request-needs).
 * - `m` done with all its carved parts: yes, as before.
 * - `m` not yet ended (running, retrying a provider error, waiting): wait.
 * - `m` ended partial or failed: a need that names things (`needOn`) is met
 *   when each exists in what `m` and its carved parts created; a need the
 *   router said with nothing named is met — the part's own step judges what it
 *   can do, and refuses honestly what it cannot.
 * - `m` stopped, expired, refused or never run: a named need is met only by
 *   what was created; an unnamed one is not met.
 */
function needMet(rec, p, m) {
  if (complete(rec, m)) return "yes";
  if (!ended(rec, m)) return "wait";
  const want = neededFrom(p, m);
  const q = rec.parts[m];
  if (!want.length) return MADE_SOME.includes(q.status) ? "yes" : [];
  const have = createdBy(rec, m);
  const missing = want.filter((t) => !have.includes(t));
  return missing.length ? missing : "yes";
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
  // LONGER THAN THE REWRITE READS (audit A37-3): the build reads only the first
  // `REWRITE_MAX_CHARS` of what it runs, so the part ends with that reason, at
  // no cost, as the page holds such a request back; it is never offered.
  if (String(p.resume || p.words || "").length > REWRITE_MAX_CHARS) { p.status = "failed"; p.why = "rewrite-too-long"; p.phase = "approval"; p.route = null; return; }
  p.status = "approval"; p.why = why; p.approvalAt = now; p.phase = "approval"; p.route = null;
}

/**
 * WHAT A PART'S APPROVED REWRITE IS TOLD BESIDE ITS WORDS (2026-10-22, audit
 * A37-1): the parts held back that are in what it runs (`alsoAsked`, which the
 * build takes out before anything reads it: `buildHeld`), and why the step
 * below handed it the work (`handOver`), as the page's own climb posts them
 * (`EditPoll.handOver` into the rewrite). A part carved off mid-run runs once,
 * as its own part, never inside the rewrite as well.
 */
export function rewriteWire(rec, n) {
  const p = rec && Array.isArray(rec.parts) ? rec.parts[n] : null;
  if (!p) return {};
  const text = p.resume || p.words;
  const held = (Array.isArray(p.held) ? p.held : []).filter((w) => typeof w === "string" && w && !!wordsIn(text, w));
  return { alsoAsked: heldWire(held.length ? held : undefined), handOver: plain(p.handOver) ? p.handOver : undefined };
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
    // A LOST BUILD IS NOT YET A FAILED ONE (2026-10-16): the lost-build
    // recovery decides it — saved as a draft, published, or not — and stores
    // that answer here. Until it does, the part waits (nothing that needs it
    // runs), never told as failed: under draft-first its save may stand.
    if (row.state === "lost") { p.status = "unverified"; p.why = "rewrite-recovering"; return; }
    // NO ANSWER, SO NO WORD ON MONEY: what it cost cannot be told.
    job.end = { state: row.state, at: now, cost: null, act: "no-answer" };
    if (row.state === "cancelled") { p.status = "cancelled"; p.why = rec.stop || stoppedPart(rec, p.n) ? "stopped" : "cancelled"; return; }
    if (row.state === "done") {
      p.status = "done"; p.why = "unrecorded"; p.outcome = { job: job.id, kind: "rewrite" };
      p.done = "rewrote the site for this (what it changed was not recorded)"; return;
    }
    p.status = "failed"; p.why = "rewrite-failed"; return;
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
    // SAVED AS THE SITE'S DRAFT (2026-10-16): done — what needs it may go on
    // — and said as a draft revision, never as a published site.
    const saved = b.draft && typeof b.draft === "object" && b.draft.published === false && Number.isSafeInteger(b.draft.revision) && b.draft.revision > 0 ? b.draft : null;
    p.outcome = { job: job.id, kind: "rewrite", ...(saved ? { draft: { revision: saved.revision, version: typeof saved.version === "string" ? saved.version : "", preview: saved.previewUploaded === true ? "ready" : saved.previewPending === true ? "pending" : "unknown" } } : {}) };
    if (!b.error) {
      p.status = "done";
      p.done = saved ? "rewrote the site's pages for this and saved them as draft revision " + saved.revision + " (not published)" + (b.recovered === true ? "; what it changed was not recorded" : "") : "rewrote the site's pages for this";
      return;
    }
    p.status = "partial"; p.why = "partly-done";
    p.notDone = [{ what: "a page of the rewrite", why: String(b.error).slice(0, 60) }]; return;
  }
  if (b.cancelled === true) { p.status = "cancelled"; p.why = rec.stop || stoppedPart(rec, p.n) ? "stopped" : "cancelled"; return; }
  // IT ASKED INSTEAD (2026-10-24, the parity audit): the rewrite's designer or
  // page writer needed a decision only the customer can make. Nothing was
  // built and its deposit came back; the question is kept on the part and
  // said, so they can send the request again with the answer in it.
  if (b.intent === "clarify" && plain(b.question) && typeof b.question.text === "string" && b.question.text.trim()) {
    p.status = "failed"; p.why = "rewrite-asked"; p.asked = b.question.text.trim().slice(0, 300);
    p.outcome = { job: job.id, kind: "rewrite" }; return;
  }
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
 * WHAT A PAUSED JOB'S ANSWER SAYS IT KEPT (round 13, round 14), checked
 * against the part: `{ held }` for a checkpoint the store verified;
 * `{ held, heldList }` for one carried whole; `{ held, heldDelta }` for one
 * carried as what changed since the checkpoint the job resumed from — that
 * one must be an earlier job of this same part, paused with exactly that
 * count, so a chain only ever reaches back, never across parts. Null for
 * anything that does not read: never a smaller set.
 */
function keptCheckpoint(p, job, hcp) {
  const hc = Number.isInteger(hcp.count) && hcp.count >= 0 ? hcp.count : null;
  if (hc === null) return null;
  const asked = typeof hcp.asked === "string" ? { heldAsked: hcp.asked.slice(0, 40) } : {};
  if (Array.isArray(hcp.requirements)) return hcp.requirements.length === hc ? { held: hc, heldList: hcp.requirements, ...asked } : null;
  if (plain(hcp.base) || Array.isArray(hcp.add) || Array.isArray(hcp.drop)) {
    const b = plain(hcp.base) ? hcp.base : null;
    const at = p.jobs.indexOf(job);
    const i = b && typeof b.job === "string" ? p.jobs.findIndex((x) => x && x.kind === "run" && x.id === b.job) : -1;
    const base = i >= 0 ? p.jobs[i] : null;
    if (!base || i >= at || !Number.isInteger(b.count) || !base.end || base.end.held !== b.count) return null;
    const drop = Array.isArray(hcp.drop) ? hcp.drop : null;
    const add = Array.isArray(hcp.add) ? hcp.add : null;
    const rename = hcp.rename === undefined ? [] : (Array.isArray(hcp.rename) ? hcp.rename : null);
    if (!drop || !add || !rename || !drop.every((x) => typeof x === "string" && x) || new Set(drop).size !== drop.length) return null;
    if (!rename.every((x) => Array.isArray(x) && (x.length === 2 || (x.length === 3 && typeof x[2] === "boolean")) && typeof x[0] === "string" && x[0] && typeof x[1] === "string" && x[1] && !drop.includes(x[0]))) return null;
    if (new Set(rename.map((x) => x[0])).size !== rename.length) return null;
    if (b.count - drop.length + add.length !== hc) return null;
    return { held: hc, heldDelta: { base: { job: b.job, count: b.count }, drop, rename, add }, ...asked };
  }
  return { held: hc };
}

/**
 * A CHECKPOINT THAT COULD NOT BE SAVED OR READ (round 13; recoverable since
 * round 14): nothing was applied or charged, and no question was
 * acknowledged. Known lost — malformed, or missing with no copy on the
 * request — the part fails now, saying so, never done and never run on a
 * smaller set. Anything else (the store refused, a read failed, the copy was
 * not staged yet) is `recovering`: run again by the driver at `next`, its
 * kept answers replayed, for up to a day (`nextStep`).
 */
function recoverHeld(p, job, ans, error, why, now) {
  job.end.act = "held-retry";
  const hf = heldFromOf(p);
  const copy = !!hf && (Array.isArray(hf.list) || !!hf.delta);
  // A CHECKPOINT THE CONTAINER'S WALL REFUSED (`refused`, audit A24-2) is
  // what the Worker would have read as missing: lost without a copy, and run
  // again to be staged from the copy when there is one.
  const lost = error === "checkpoint-unread" && (why === "malformed" || ((why === "missing" || why === "refused") && !copy));
  // A REFUSAL IS SAID AS ONE (audit S1-7, 2026-10-23): the service running
  // the part was not allowed to read the checkpoint, which is not the same as
  // the checkpoint being unreadable, and the reply says which.
  const reason = error === "checkpoint-unread" && why === "refused" ? "checkpoint-refused" : error;
  if (lost) {
    delete p.recover;
    endUnfinished(p, leftOf(ans.body), reason, { job: job.id, kind: "refused" });
    return;
  }
  const was = plain(p.recover) ? p.recover : {};
  const tries = (Number.isInteger(was.tries) ? was.tries : 0) + 1;
  const since = Number.isFinite(was.since) ? was.since : now;
  p.recover = { why: reason, tries, since, next: now + heldRecoverDelay(tries), last: String(why || "").slice(0, 80) };
  p.status = "recovering"; p.why = reason;
  const left = strongerLeft(p.left, leftOf(ans.body));
  if (left) p.left = left;
  p.outcome = { job: job.id, kind: "recovering" };
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
    p.status = "cancelled"; p.why = rec.stop || stoppedPart(rec, p.n) ? "stopped" : "cancelled";
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
    // A ROUTING ASKED TO SPLIT A PART (2026-10-24) has been answered: the ask
    // is spent, whatever came back (a failed call is asked again with it).
    const splitting = plain(p.splitAsk) ? p.splitAsk : null;
    if (splitting && read.act !== "failed") delete p.splitAsk;
    // …AND IT NEVER OFFERS THE FULL REWRITE: an answer of `build` to "split
    // this" ends the part too big, as the step said, with its reason.
    if (splitting && read.act === "rewrite") { endUnfinished(p, "", "too-big", { job: job.id, kind: "escalate" }); p.split = splitting.why; if (splitting.reason) p.splitReason = splitting.reason; return; }
    if (read.act === "route") {
      p.route = { ...read.route, hops: 0 };
      p.phase = "run";
      // WHAT ITS OWN ROUTING SAID IT TOUCHES (change 0), beside what it was accepted with.
      if (read.targets && read.targets[0]) addTargets(p, read.targets[0]);
      // WHAT IT READS IS KNOWN ONLY NOW (2026-10-23, fix-edit-flow): a part
      // carved from another was given no targets when it was made, so the
      // waiting `inferNeeds` adds — a link to the page its parent creates —
      // is worked out again here, and a part needing one that broke is not
      // run (the request's next step says which).
      if (read.targets && read.targets[0]) inferNeeds(rec.parts);
      if (read.alsoAsked.length) {
        const needsFirst = read.dependsOn.filter((d) => d.change === 0).flatMap((d) => d.after);
        const made = carveParts(rec, p.n, read.alsoAsked, { dependsOn: read.dependsOn.filter((d) => d.change !== 0), sibling: needsFirst, targets: read.targets });
        // A PART CARVED FROM A SPLIT IS AS DEEP AS ITS PARENT: it may split
        // once more only while its parent could (`SPLIT_MAX`).
        if (Number.isInteger(p.splitDepth)) for (const m of made) { rec.parts[m].splitDepth = p.splitDepth; if (splitting) rec.parts[m].splitOf = p.n; }
        // THE PART NEEDS A PART IT HELD BACK FIRST: it waits for it, and is
        // routed again when its turn comes.
        const before = needsFirst.map((i) => made.byChange[i]).filter((m) => Number.isInteger(m) && m !== p.n && !rec.parts[m].needs.includes(p.n));
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
  // AN ANSWER TOO LARGE FOR ITS ROW THAT THE STORE NEVER TOOK (round 14):
  // what it did is not recorded — never read as done, never as nothing.
  if (ans && plain(ans.body.spilled) && ans.body.spilled.unsaved === true) {
    job.end.act = "unrecorded";
    if (ans.body.ok === false) { endUnfinished(p, "", "outcome-unrecorded", { job: job.id, kind: "unrecorded" }); return; }
    p.status = "partial"; p.why = "outcome-unrecorded"; p.outcome = { job: job.id, kind: "unrecorded" };
    p.notDone = [{ what: p.words, why: "outcome-unrecorded" }];
    return;
  }
  const read = readRun(ans);
  job.end.act = read.act;
  // WHAT IT REALLY CREATED, whatever it ended as (2026-10-24, request-needs):
  // the pages and tables its step's own answer names, so a part that needs one
  // of them runs when it exists, even if this part was partial or failed.
  recordCreated(p, ans && ans.body);
  if (read.deferred && read.deferred.length) {
    // WHAT THIS PART CREATED, recorded on it before its words are carved
    // (2026-10-23, fix-edit-flow): a carved part that then names that page
    // waits for it (`inferNeeds`), and is not run when it broke.
    const made = createdPages(ans && ans.body);
    if (made.length) addTargets(p, { writes: made.map((pg) => "new-page:" + pg), reads: [] });
    carveParts(rec, p.n, read.deferred);
  }
  // A PART THIS STEP LEFT FOR LATER THAT IS NO PART OF THE REQUEST NOW — not
  // the customer's words, or all of this part's — is work asked for and not
  // done, never dropped.
  const lost = (read.deferred || []).filter((w) => !carried(rec, p.n, w));
  if (read.act === "hop" || read.act === "climb") {
    const to = handOff(read, p.route || {});
    job.end.handOff = to.act;
    if (to.act === "hop") { p.route = handedRoute(p.route || {}, to, read); p.hops = p.route.hops; p.status = "ready"; return; }
    // THE HAND-OVER IS KEPT FOR THE REWRITE (2026-10-22, audit A37-1): the
    // go-ahead clears the route, so why the step climbed is kept on the part
    // and posted with the rewrite (`rewriteWire`), as the page's climb posts it.
    // A SITE WITH NO PAGES (its first build never finished): the build tried
    // again waits for their go-ahead (owner, 2026-10-24) — never a rewrite.
    if (to.act === "retry-build") { askApproval(p, "retry-build", now); if (p.status === "approval") p.retry = true; p.outcome = { job: job.id, kind: "escalate" }; return; }
    // TOO BIG FOR THE SMALLER STEPS: said, and left to the customer to send
    // in smaller changes. The whole site is never rewritten for a change.
    // …UNLESS IT CAN SPLIT ITSELF (owner, 2026-10-24): routed again, told why,
    // and asked for parts it can do. Only when nothing of it went in (nothing
    // is redone) and under `SPLIT_MAX`; the climbing job's own charge stands
    // as its row says, and the routing again is not charged (`partOf`).
    const reason = typeof read.reason === "string" ? read.reason.slice(0, 40) : "";
    const depth = Number.isInteger(p.splitDepth) ? p.splitDepth : 0;
    if (to.act === "split" && depth < SPLIT_MAX && !SPLIT_NOT.includes(reason) && !leftOf(ans.body) && !p.left && !lost.length) {
      p.splitDepth = depth + 1;
      p.splitAsk = { why: to.why, ...(reason ? { reason } : {}) };
      // WHAT IT RUNS STAYS (`runs`: part 0's whole message, its held parts
      // beside it), so the parts held back before are still found and taken
      // out; the routing again reads its own words.
      p.phase = "route"; p.route = null; p.hops = 0;
      job.end.act = "split";
      p.outcome = { job: job.id, kind: "split" };
      p.status = "ready"; p.why = null;
      return;
    }
    if (to.act === "split") { endUnfinished(p, "", "too-big", { job: job.id, kind: "escalate" }); p.split = to.why; if (typeof read.reason === "string" && read.reason) p.splitReason = read.reason.slice(0, 40); return; }
    if (to.act === "stop") { endUnfinished(p, "", "handed-back", { job: job.id, kind: "escalate" }); return; }
    endUnfinished(p, "", "unreadable"); return;
  }
  if (read.act === "recovered" && read.draft) { p.status = "done"; p.why = "unrecorded"; p.outcome = { job: job.id, kind: "draft", draft: read.draft }; p.done = SAVED_DONE(read.draft); return; }
  if (read.act === "recovered") { p.status = "done"; p.why = "unrecorded"; p.outcome = { job: job.id, kind: "recovered" }; p.done = "made the change (what it changed was not recorded)"; return; }
  if (read.act === "success" && p.place && p.route && p.route.place) {
    // THE PLACEMENT STEP FINISHED (round 5): the addition's own "not done"
    // stands beside any frame this step could not fill.
    const notDone = [...(p.place.notDone || []), ...notDoneOf(ans.body, "edit")];
    p.place = { ...p.place, placedBy: job.id };
    p.outcome = { job: job.id, kind: "done", ...((d) => (d ? { draft: d } : {}))(answerDraft(ans.body)) };
    if (notDone.length) { p.status = "partial"; p.why = "partly-done"; p.notDone = notDone; return; }
    p.status = "done"; p.why = null; return;
  }
  if (read.act === "success") {
    // A RETRY THAT FINISHED speaks for the whole part: what an earlier try left is in what it did.
    delete p.left;
    p.outcome = { job: job.id, kind: "done", ...((d) => (d ? { draft: d } : {}))(answerDraft(ans.body)) };
    p.done = doneSummary(ans.body);
    // WHAT IT REALLY WROTE (2026-10-23, fix-edit-flow): the step's own
    // `changed`, so the request's summary states that, never the asked words.
    { const ch = changedOf(ans.body); if (ch.length) p.changed = ch; else delete p.changed; }
    if (read.ask) { p.status = "waiting"; p.question = { round: (p.askRound || 0) + 1, ...read.ask, at: now }; p.phase = "answer"; return; }
    // DONE ONLY WHEN NOTHING ASKED FOR WAS LEFT UNDONE: what it named as not
    // done makes it partial, which nothing that needs it treats as finished.
    let notDone = notDoneOf(ans.body, (p.route && p.route.op) === "addon" ? "addon" : "edit");
    // THE FRAME SET ASIDE BESIDE OTHER KINDS RUNS RIGHT AFTER (2026-10-24,
    // driftwood-and-daughters): handed to the menu/frame editor as an addition,
    // in this same request, even when its words are the whole part's.
    const fh = frameFollowOn(rec, p, ans && ans.body);
    if (fh) notDone = notDone.filter((d) => d.what !== "frame");
    for (const w of lost) if (!(fh && wordsIn(rec.message, w) === fh.words)) notDone.push({ what: w, why: "left-over" });
    // AN ADDITION PUBLISHED WITH FRAMES WAITING ON A PURCHASE NOBODY CAN TELL
    // YET (2026-10-09, round 5): what it added is live and stays; the part is
    // held on those purchases, and once they are known a placement step fills
    // the marked frames — the addition is never made again, nothing is bought
    // again on a guess, and the customer sends nothing again.
    const pending = (p.route && p.route.op) === "addon" ? pendingOf(ans.body) : [];
    if (pending.length) {
      p.status = "uncertain"; p.why = "photos-pending";
      p.purchase = { held: pending.map((x) => ({ id: x.id, d: x.d, why: x.why || "unconfirmed" })), at: now };
      p.place = { photos: pending, addon: p.route, notDone, job: job.id };
      p.published = true;
      return;
    }
    if (notDone.length) { p.status = "partial"; p.why = "partly-done"; p.notDone = notDone; return; }
    p.status = "done"; return;
  }
  if (read.act === "clarify" || (read.act === "refusal" && read.ask)) {
    // ITS CHECKPOINT, AS THE JOB SAYS IT VERIFIED IT (round 13): how many
    // requirements the next run must resume with.
    const hcp = plain(ans.body.heldCheckpoint) ? ans.body.heldCheckpoint : null;
    const kept = hcp ? keptCheckpoint(p, job, hcp) : null;
    // A CHECKPOINT CARRIED THAT DOES NOT READ (round 14): the question is not
    // acknowledged over it — the part recovers, as for one never saved.
    if (hcp && !kept) { recoverHeld(p, job, ans, "checkpoint-unsaved", "inline-malformed", now); return; }
    if (kept) Object.assign(job.end, kept);
    delete p.recover;
    p.status = "waiting"; p.question = { round: (p.askRound || 0) + 1, ...read.ask, at: now }; p.phase = "answer";
    // A QUESTION AFTER SOMETHING WENT IN (2026-10-07): what this try, or an
    // earlier one, left standing stays on the part while it waits.
    const left = strongerLeft(p.left, leftOf(ans.body));
    if (left) p.left = left;
    p.outcome = { job: job.id, kind: "asked" }; return;
  }
  // …AND A STEP THAT DID NOT GO THROUGH WHILE A PURCHASE IT BEGAN WAS STILL
  // OUT (2026-10-11, Codex on d7a00395: an addition's photograph begun beside
  // its page writer, which then failed): held on that purchase, never ended as
  // if nothing were out; once it is known the step runs again and reuses it.
  // A CHECKPOINT THAT COULD NOT BE SAVED OR READ (round 13): nothing was
  // applied or charged, and the question was not acknowledged. The part runs
  // again — its answers replayed (`stageKept`), its saved requirements read
  // again — a bounded number of times; then it fails, saying so, never done.
  if (read.act === "refusal" && (read.error === "checkpoint-unsaved" || read.error === "checkpoint-unread")) {
    recoverHeld(p, job, ans, read.error, typeof ans.body.why === "string" ? ans.body.why : "", now);
    return;
  }
  if (read.act === "refusal" && (read.error === "purchase-unconfirmed" || heldOf(ans.body).length > 0)) {
    // HELD ON A PURCHASE NOBODY CAN TELL (2026-10-09, round 3): its job
    // published and charged nothing; the part waits, recoverable.
    job.end.act = "uncertain";
    p.status = "uncertain"; p.why = "purchase-unconfirmed";
    p.purchase = { held: heldOf(ans.body), at: now };
    p.outcome = { job: job.id, kind: "uncertain" };
    return;
  }
  // LOST TO ANOTHER PART OF THIS REQUEST (2026-10-16): its publish found
  // another part's change on the same files (`conflict`), or the site's turn
  // passed to another part (`turn`, `turn-lost`), or a newer draft already
  // stood (`older`). Only the publish spine answers these codes (worker.js
  // `lostOr`); nothing of it went in and it was refunded, so it is not the
  // customer's to send again: it runs
  // once more, alone (`serial`), a bounded number of times, then fails as before.
  // …AND THE SAME REFUSAL AFTER THE PUBLISH GATE, read back by the review
  // reconcile: never activated, refunded, the job's own code kept as `was`.
  const lostCode = read.act === "refusal" && read.error === "reconciled" && ans.body.kind === "never-activated" && typeof ans.body.was === "string" ? ans.body.was : read.error;
  if (read.act === "refusal" && OVERLAP_LOSSES.includes(lostCode) && !leftOf(ans.body) && !p.left && (Number(p.overlapRuns) || 0) < OVERLAP_RETRIES) {
    p.overlapRuns = (Number(p.overlapRuns) || 0) + 1;
    p.serial = true;
    job.end.act = "overlap";
    p.outcome = { job: job.id, kind: "overlap" };
    p.status = "ready"; p.why = null;
    return;
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

/** The marked frames an addition published waiting on a purchase, read strictly: `{ id, d, k, file, why }` each. */
export function pendingOf(body) {
  const list = plain(body) && Array.isArray(body.pendingPhotos) ? body.pendingPhotos : [];
  return list.filter((x) => plain(x) && typeof x.id === "string" && /^[0-9a-f]{24}$/.test(x.id) && typeof x.d === "string" && Number.isInteger(x.k) && x.k >= 0)
    .slice(0, 12)
    .map((x) => {
      const files = (Array.isArray(x.files) ? x.files : [x.file]).filter((f) => typeof f === "string" && f).map((f) => f.slice(0, 200)).slice(0, 12);
      // WHERE ITS FRAME IS, OR THAT NONE COULD BE SAFELY FOUND (round 6): a
      // purchase with no frame is still pending work, told apart, never placed by a guess.
      return { id: x.id, d: x.d.slice(0, 300), k: x.k, file: files[0] || "", files, located: x.located !== false && files.length > 0, why: typeof x.why === "string" ? x.why.slice(0, 40) : "" };
    });
}

/** The purchases a held job named, read strictly: `{ id, d, why }` each. */
function heldOf(body) {
  const list = plain(body) && Array.isArray(body.held) ? body.held : [];
  return list.filter((h) => plain(h) && typeof h.id === "string" && /^[0-9a-f]{24}$/.test(h.id))
    .map((h) => ({ id: h.id, d: typeof h.d === "string" ? h.d.slice(0, 300) : "", why: typeof h.why === "string" ? h.why.slice(0, 40) : "" }));
}

/**
 * A HELD PART MOVED ON (2026-10-09, round 3): every purchase it was held on is
 * now known — found to have landed, ended, or released by the customer — so
 * it runs again, as a new job of the same step; the purchase is reused or made
 * through its one record. Null when the part is not held.
 */
export function purchaseResolved(record, n, now = Date.now()) {
  const rec = clone(record);
  const p = rec.parts[n];
  if (rec.stop || rec.ended || !p || p.status !== "uncertain") return null;
  p.status = "ready"; p.why = null;
  // AN ADDITION'S MARKED FRAMES (round 5): the next job fills them through the
  // picture step's placement, not the addition again.
  if (p.place && Array.isArray(p.place.photos) && p.place.photos.length) {
    p.route = { op: "edit", layer: "picture", page: "", place: p.place.photos.map((x) => ({ id: x.id, d: x.d, k: x.k, file: x.file, files: Array.isArray(x.files) ? x.files : [x.file].filter(Boolean), located: x.located !== false })), cost: 0 };
    p.phase = "run";
  }
  p.purchase = { ...(p.purchase || {}), resolvedAt: now };
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return settleState(rec, now);
}

/** The purchases a held part waits on: `{ id, d, why }` each, or [] for a part not held. */
export const heldPurchases = (p) => (p && p.status === "uncertain" && p.purchase && Array.isArray(p.purchase.held) ? p.purchase.held : []);

/**
 * HOW LONG A PURCHASE CAN STILL BE RUNNING after its part was held: the image
 * call's own limit (120 seconds), its three 30-second downloads and the store,
 * with room. Past it, a purchase that was still being made has no running
 * call left, and nobody can tell how it ended.
 */
export const PHOTO_RUNNING_MS = 300000;

/**
 * WHAT ONE HELD PURCHASE IS NOW, read from the reason its record gave
 * (2026-10-11, the recovery card):
 *   saving   made, not stored yet — the same picture is saved, never made again;
 *   running  still being made, within the call's own time;
 *   placing  the purchase is known; its frame could not be read just now;
 *   unknown  begun and not known to have ended — only the customer's
 *            buy-again begins it again, knowing it may cost twice;
 *   saved    stored, waiting to be placed with the rest of the part
 *            (2026-10-11): placed is the part itself, done;
 *   again    released by the customer: bought again once the part runs;
 *   ended    known to have ended with nothing.
 */
export function heldPurchaseState(h, heldAt, now = Date.now()) {
  const why = h && typeof h.why === "string" ? h.why : "";
  if (why === "store-pending") return "saving";
  if (why === "frames-unreachable") return "placing";
  if (why === "saved") return "saved";
  if (why === "released") return "again";
  if (why === "ended") return "ended";
  if (why === "in-flight" && Number.isFinite(heldAt) && now - heldAt < PHOTO_RUNNING_MS) return "running";
  return "unknown";
}

/**
 * A HELD PART'S PURCHASES WITH THE REASON NOW OBSERVED for each (`seen`, id →
 * reason): a made picture whose store failed (`store-pending`), or whose
 * source no longer answers (`source-unreachable`). The time it was held is
 * kept. Null when nothing changed.
 */
export function heldReasons(record, n, seen) {
  const p0 = record && record.parts ? record.parts[n] : null;
  if (!p0 || p0.status !== "uncertain" || !(seen instanceof Map) || !p0.purchase || !Array.isArray(p0.purchase.held)) return null;
  if (!p0.purchase.held.some((h) => seen.has(h.id) && seen.get(h.id) !== h.why)) return null;
  const rec = clone(record);
  const p = rec.parts[n];
  p.purchase.held = p.purchase.held.map((h) => (seen.has(h.id) ? { ...h, why: String(seen.get(h.id)).slice(0, 40) } : h));
  rec.rev = (Number(rec.rev) || 0) + 1;
  return rec;
}

/** A held part's purchases, each with its state, and the part's own: the most uncertain of them (unknown, running, saving, placing). */
export function heldPurchaseView(p, now = Date.now()) {
  const at = p && p.purchase ? p.purchase.at : NaN;
  const list = heldPurchases(p).map((h) => ({ d: h.d, ...(h.why ? { why: h.why } : {}), state: heldPurchaseState(h, at, now) }));
  const state = ["unknown", "running", "saving", "placing", "again", "saved", "ended"].find((x) => list.some((h) => h.state === x)) || null;
  return { list, state, buyAgain: list.some((h) => h.state === "unknown") };
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
export function nextStep(record, rows = {}, now = Date.now(), { writeMax = 1 } = {}) {
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
  // ONE PART STOPPED OR REMOVED (2026-10-23, background work): the same, for
  // the parts named in `stopParts` only — the rest of the request goes on; a
  // part that needed one of them is not run (`broken`), as for any stop.
  for (const p of rec.parts) {
    if (!stoppedPart(rec, p.n) || PART_TERMINAL.includes(p.status) || currentJob(p)) continue;
    p.status = "cancelled"; p.why = "stopped";
  }
  // A QUESTION NOBODY ANSWERED IN A DAY EXPIRES, as the question record does.
  for (const p of rec.parts) {
    if (p.status === "waiting" && p.question && Number.isFinite(p.question.at) && now - p.question.at >= WAIT_MS) { p.status = "expired"; p.why = "unanswered"; }
    // AND A GO-AHEAD NOBODY GAVE IN A DAY, the same way: its files are let go
    // when the request ends, and what needed it is not run.
    if (p.status === "approval" && Number.isFinite(p.approvalAt) && now - p.approvalAt >= WAIT_MS) { p.status = "expired"; p.why = "unapproved"; }
    // AND A PURCHASE NOBODY COULD TELL IN A DAY: it stays recorded, unknown,
    // never bought again on a guess; the part is told as not done.
    if (p.status === "uncertain" && p.purchase && Number.isFinite(p.purchase.at) && now - p.purchase.at >= WAIT_MS) {
      // AN ADDITION THAT WENT LIVE with frames still waiting (round 5) is done
      // in part — what it added stands, its frames stay empty — never expired.
      if (p.place && p.published) { p.status = "partial"; p.why = "photos-unconfirmed"; p.notDone = [...(p.place.notDone || []), ...(p.place.photos || []).map((x) => ({ what: x.d.slice(0, 200), why: "photo-unconfirmed" }))]; }
      else { p.status = "expired"; p.why = "purchase-unconfirmed"; }
    }
    // A PART RECOVERING ITS CHECKPOINT (round 14): run again once its wait is
    // over; after a day of tries it ends, saying why — its checkpoint, its
    // kept answers and what its tries left standing are all still recorded.
    if (p.status === "recovering") {
      const r = plain(p.recover) ? p.recover : {};
      if (Number.isFinite(r.since) && now - r.since >= WAIT_MS) endUnfinished(p, "", r.why || "checkpoint-unread");
      else if (!Number.isFinite(r.next) || now >= r.next) { p.status = "ready"; p.why = null; }
    }
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
      // GATED ON WHAT IT NEEDS, NOT ON HOW THE OTHER PART ENDED (2026-10-24,
      // request-needs): a part runs when the things it needs exist, even if
      // the part making them was partial or failed; only a need whose thing is
      // genuinely missing holds it, and it says which (`missing`).
      const met = p.needs.map((m) => [m, needMet(rec, p, m)]);
      const bad = met.find(([, v]) => Array.isArray(v));
      if (bad) {
        p.status = "not-run"; p.why = "needs:" + bad[0];
        if (bad[1].length) p.missing = bad[1].slice(); else delete p.missing;
        moved = true; continue;
      }
      const settled = !parent || PART_TERMINAL.includes(parent.status) || parent.status === "waiting";
      const ok = settled && met.every(([, v]) => v === "yes");
      const want = ok ? "ready" : "blocked";
      if (p.status !== want) { p.status = want; moved = true; }
    }
  }
  const files = [];
  // EVERY JOB CHOSEN AND NOT YET FILED (its id unknown) is filed again first;
  // nothing new is chosen on that step.
  const pendings = rec.parts.filter((p) => { const j = currentJob(p); return j && !j.id; });
  const running = (p) => ["queued", "started", "unverified"].includes(p.status) || !!(currentJob(p) && currentJob(p).id);
  const live = rec.parts.some(running);
  // HOW MANY JOBS OF ONE REQUEST MAY RUN AT ONCE (2026-10-15, the
  // concurrent-execution round): one unless the Worker says more
  // (`writeBesideMax`). Above one, a ready part is filed beside the jobs
  // already running when nothing it must follow is unfinished and nothing
  // running conflicts with it (`clearToWrite`); the site's publish turn and
  // the rebase onto the site as it is then keep every outcome.
  const many = Number.isInteger(writeMax) && writeMax > 1;
  if (pendings.length) {
    for (const p of pendings) { const j = currentJob(p); files.push({ n: p.n, key: j.key, kind: j.kind, op: j.op }); }
  } else if ((!live || many) && !rec.stop) {
    // THE NEXT WRITE (2026-10-08): in the order the parts must be applied —
    // after what each needs, otherwise the message's order — a part whose
    // preparation found a question first (its job asks at once, at no new
    // model cost, and what does not need it goes on), and never a part whose
    // preparation is still running while another part is ready: its job would
    // make the same calls a second time. When every ready part is being
    // prepared, nothing is filed; the preparation's end moves the request on.
    const order = applyOrder(rec.parts);
    const ready = order.map((m) => rec.parts[m]).filter((p) => p && p.status === "ready");
    const asks = ready.filter((p) => prepFor(p) && p.prep.state === "done" && p.prep.outcome === "ask");
    const free = ready.filter((p) => !preparing(p, now));
    const choose = (next) => {
      const kind = next.phase === "run" && next.route ? "run" : "route";
      const op = kind === "route" ? ROUTE_OP : (next.route.op === "addon" ? "addon" : "edit");
      next.seq += 1;
      const key = jobKey(rec.key, next.n, next.seq);
      next.jobs.push({ key, kind, op, id: null, seq: next.seq, end: null });
      next.status = "queued";
      files.push({ n: next.n, key, kind, op });
    };
    if (!many) {
      const next = asks[0] || free[0] || null;
      if (next) choose(next);
    } else {
      let count = rec.parts.filter(running).length;
      const ended = (q) => PART_TERMINAL.includes(q.status);
      for (const next of [...asks, ...free.filter((p) => !asks.includes(p))]) {
        if (count >= writeMax) break;
        // THE FIRST JOB OF A REQUEST WITH NOTHING RUNNING is chosen as it
        // always was; every one beside it must be clear to write.
        if ((files.length || rec.parts.some(running)) && !clearToWrite(rec.parts, next.n, ended, running)) continue;
        choose(next);
        count++;
      }
    }
  }
  const file = files[0] || null;
  // WHAT IS PREPARED NOW: every ready part not being written, whose
  // preparation has not been made for the step it is on, that no earlier part
  // still to be applied conflicts with (`clearToPrepare`), up to
  // `PREP_MAX_LIVE` at once. Claimed here, on the same write as the step, so
  // two drivers at once prepare it once; a redelivered preparation finds its
  // claim already answered and makes no call.
  const prepare = [];
  if (!rec.stop) {
    let running = rec.parts.filter((p) => preparing(p, now)).length;
    const ended = (q) => PART_TERMINAL.includes(q.status);
    for (const m of applyOrder(rec.parts)) {
      if (running >= PREP_MAX_LIVE) break;
      const p = rec.parts[m];
      if (!p || p.status !== "ready" || currentJob(p) || !preparable(p) || !wantsPrep(p, now)) continue;
      if (!clearToPrepare(rec.parts, p.n, ended)) continue;
      const again = prepFor(p) ? (Number(p.prep.tries) || 0) : 0;
      // AN ATTEMPT A CONSUMER TOOK AND NEVER ANSWERED is named on the new one
      // (`prev`): what it recorded is reused, and a purchase it began and never
      // finished is never made again blindly (the Worker reads its notes).
      // …AND AN ATTEMPT MADE FOR THE STEP BEFORE (2026-10-11, the evidence
      // reconciliation): a part prepared while it was still to be routed has
      // its step's calls already answered; once its routing ran and it moved to
      // its step, it is prepared again — naming that attempt, so its answers
      // are replayed (each only for a byte-identical request) and never asked
      // of the model a second time.
      const prev = prepFor(p) && p.prep.state === "running" ? p.prep.seq
        : (prepFor(p) && Number.isInteger(p.prep.prev) ? p.prep.prev
          : (p.prep && !prepFor(p) && p.prep.state === "done" && Number.isInteger(p.prep.seq) ? p.prep.seq : null));
      // THE ATTEMPT IT REPLACES IS KEPT AS EVIDENCE (2026-10-09, run 117's
      // diagnosis): when it was sent, taken and answered, and its step —
      // never lost to the new claim (`prepPast`, the last PREP_PAST_KEPT).
      keepPastPrep(p);
      p.prep = { seq: (Number(p.prep && p.prep.seq) || 0) + 1, for: p.seq, phase: p.phase, tries: again + 1, state: "attempting", at: now, ...(Number.isInteger(prev) ? { prev } : {}) };
      prepare.push({ n: p.n, seq: p.prep.seq });
      running++;
    }
  }
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return { record: settleState(rec, now), file, files, prepare };
}

/** Is this part's preparation for the step it is on now (no job filed for it since)? */
const prepFor = (p) => !!p.prep && p.prep.for === p.seq && p.prep.phase === p.phase;
/** When a claim last showed life: taken by its consumer (`startedAt`), or sent (`at`). */
const prepSince = (prep) => (prep.state === "running" && Number.isFinite(prep.startedAt) ? prep.startedAt : prep.at);
/** Is a preparation sent, or taken by a consumer, that may still answer? */
function preparing(p, now) {
  return prepFor(p) && (p.prep.state === "attempting" || p.prep.state === "running") && Number.isFinite(prepSince(p.prep)) && now - prepSince(p.prep) < PREP_FRESH_MS;
}
/** Is there a preparation worth starting: none for this step yet, or one that went quiet with a try left? */
function wantsPrep(p, now) {
  if (!prepFor(p)) return true;
  if (p.prep.state !== "attempting" && p.prep.state !== "running") return false;
  return !preparing(p, now) && (Number(p.prep.tries) || 0) < PREP_TRIES;
}

/**
 * A CONSUMER TAKES A PREPARATION (2026-10-09, after Codex's review): the claim
 * the driver sent (`attempting`, this `seq`) becomes this consumer's
 * (`running`, its `owner`), in one write of the record on its etag — so of two
 * deliveries of one message, read at the same moment, exactly one write lands
 * and the other, reading again, finds the claim taken and makes no call. The
 * caller saves the answer on the etag it read under; `ok` false means there
 * is nothing to take.
 */
export function takePrep(record, n, seq, owner, now = Date.now()) {
  const rec = clone(record);
  const p = rec.parts[n];
  if (rec.stop || rec.ended || !p || !prepFor(p) || p.prep.seq !== seq || p.prep.state !== "attempting" || typeof owner !== "string" || !owner) return { record: rec, ok: false };
  p.prep = { ...p.prep, state: "running", owner, startedAt: now };
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return { record: rec, ok: true, prev: Number.isInteger(p.prep.prev) ? p.prep.prev : null };
}

/** Is this consumer still the owner of this attempt, inside its own time? Asked before every purchase. */
export function ownsPrep(record, n, seq, owner, now = Date.now(), runMs = PREP_FRESH_MS) {
  const p = record && record.parts ? record.parts[n] : null;
  return !!p && !record.stop && !record.ended && !!p.prep && p.prep.seq === seq && p.prep.state === "running" && p.prep.owner === owner && Number.isFinite(p.prep.startedAt) && now - p.prep.startedAt < runMs;
}
/** Can this part's next step be prepared: its routing, or an edit step whose work before its publish writes nothing to the site. */
function preparable(p) {
  if (p.phase === "route") return true;
  if (p.phase !== "run" || !p.route) return false;
  // A PLACEMENT (round 5) makes no model call and its purchases are the part's
  // own: there is nothing to prepare, and it must never buy in a preparation.
  if (Array.isArray(p.route.place) && p.route.place.length) return false;
  if (p.route.op === "addon") return PREP_ADDON;
  return PREP_LAYERS.includes(p.route.layer);
}

/**
 * A PREPARATION'S OUTCOME, kept on its part — only when the claim it answers
 * is still the part's own (`seq`, still attempting): a late answer for a step
 * the part has moved past, or for a claim since taken again, is dropped.
 * `outcome` is what it reached: `ready` (the step's work done, at its
 * publish), `ask` (the step asked the customer something), `routed` (routing
 * only — the step it chose is not one a preparation runs), `stopped` (the step
 * ended on its own without changing anything), or `error`.
 */
export function notePrepared(record, n, seq, { ok = false, outcome = "error", key = null, calls = 0, images = 0, owner = null, now = Date.now(), step = null } = {}) {
  const rec = clone(record);
  const p = rec.parts[n];
  // ONLY THE OWNER OF THIS ATTEMPT (2026-10-09): taken by it (`running`, its
  // `owner`), the same `seq`. A consumer that lost the claim, or a late one
  // whose attempt was since taken again, keeps nothing.
  if (!p || !p.prep || p.prep.seq !== seq || p.prep.state !== "running" || typeof owner !== "string" || p.prep.owner !== owner) return { record: rec, kept: false };
  p.prep = { ...p.prep, state: ok ? "done" : "failed", outcome: String(outcome || "error"), key: typeof key === "string" ? key : null, calls: Number(calls) || 0, images: Number(images) || 0, endedAt: now };
  // WHEN ITS STEP'S OWN WORK RAN (2026-10-09, the readiness correction): the
  // step replayed after the routing, from its first instant to its last, and
  // how many model calls it made. Absent when only the routing ran — which is
  // not substantive preparation of the step.
  const st = readPrepStep(step);
  if (st) p.prep.step = st; else delete p.prep.step;
  rec.updatedAt = now;
  rec.rev = (Number(rec.rev) || 0) + 1;
  return { record: rec, kept: true };
}

/**
 * A PREPARED ROUTING'S STEP, as its run job will see the part: the record with
 * the part routed (its route, its named targets) and whether that step may be
 * prepared now — a step the preparation runs, with no earlier part it
 * conflicts with or that writes what it reads. Asked again here because the
 * route is what makes those known.
 */
export function routedForPrep(record, n, read) {
  const work = clone(record);
  const p = work.parts[n];
  if (!p || !read || !read.route) return { work, ok: false };
  Object.assign(p, { route: { ...read.route, hops: 0 }, phase: "run" });
  if (read.targets && read.targets[0]) addTargets(p, read.targets[0]);
  return { work, ok: preparable(p) && clearToPrepare(work.parts, n, (q) => PART_TERMINAL.includes(q.status)) };
}

/** A preparation's step interval, read strictly: `{ from, to, calls }` with from <= to, or null. */
export function readPrepStep(step) {
  if (!step || typeof step !== "object") return null;
  const { from, to, calls, replayed } = step;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || !Number.isInteger(calls) || calls < 0) return null;
  // `calls` ARE MODEL CALLS MADE (2026-10-11); answers replayed from an earlier
  // attempt are kept apart (`replayed`), so a step that only replayed is never
  // read as model work done beside another job.
  // WHAT EACH CALL WAS SHOWN OF THE OTHER PARTS (2026-10-13, `partMarks`):
  // kept only when it reads; a list that does not read is left out, never
  // reported as "no markings".
  const marks = Object.hasOwn(step, "marks") ? readMarks(step.marks) : null;
  return { from, to, calls, ...(Number.isInteger(replayed) && replayed > 0 ? { replayed } : {}), ...(marks ? { marks } : {}) };
}

/**
 * WHAT A PART'S LAST PREPARATION RAN, AND WHEN (2026-10-09, the readiness
 * correction): its attempt from taken to answered, its outcome, and its
 * step's own interval when the step ran — the evidence a reader needs to tell
 * substantive preparation beside another part's job from a routing alone.
 * Null when no attempt was taken.
 */
export function prepRunOf(p) {
  return runOfPrep(p && p.prep);
}

/** One attempt's timings, read strictly: `sent` its claim (`at`), `from`/`to` taken and answered. Null when never taken. */
function runOfPrep(pr) {
  if (!pr || typeof pr !== "object" || !Number.isFinite(pr.startedAt)) return null;
  return {
    seq: pr.seq, sent: Number.isFinite(pr.at) ? pr.at : null, from: pr.startedAt, to: Number.isFinite(pr.endedAt) ? pr.endedAt : null,
    outcome: typeof pr.outcome === "string" ? pr.outcome : null,
    step: readPrepStep(pr.step),
  };
}

/** How many earlier attempts a part keeps the timings of. */
export const PREP_PAST_KEPT = 6;

/** The attempt about to be replaced, kept on the part (`prepPast`) when a consumer took it; the oldest dropped past PREP_PAST_KEPT. */
function keepPastPrep(p) {
  const run = runOfPrep(p && p.prep);
  if (!run) return;
  const past = Array.isArray(p.prepPast) ? p.prepPast.filter((x) => x && x.seq !== run.seq) : [];
  past.push(run);
  p.prepPast = past.slice(-PREP_PAST_KEPT);
}

/**
 * EVERY PREPARATION ATTEMPT A PART RAN, OLDEST FIRST (2026-10-09): the kept
 * earlier ones and the current one, each read strictly. A reader judging
 * overlap reads them all, so a retry never hides an earlier attempt's work.
 */
export function prepRunsOf(p) {
  const out = [];
  for (const x of Array.isArray(p && p.prepPast) ? p.prepPast : []) { const r = runOfPrep({ seq: x && x.seq, at: x && x.sent, startedAt: x && x.from, endedAt: x && x.to, outcome: x && x.outcome, step: x && x.step }); if (r) out.push(r); }
  const cur = prepRunOf(p);
  if (cur && !out.some((r) => r.seq === cur.seq)) out.push(cur);
  return out;
}

/** What the page and the progress writer read of a part's preparation: `preparing`, `prepared`, or nothing. */
export function prepState(p, now = Date.now()) {
  if (!p || !["ready", "blocked", "queued"].includes(p.status) || !prepFor(p)) return "";
  if (p.prep.state === "attempting" || p.prep.state === "running") return now - prepSince(p.prep) < PREP_FRESH_MS ? "preparing" : "";
  return p.prep.state === "done" && p.prep.outcome === "ready" ? "prepared" : "";
}

/**
 * WHETHER A REQUEST STILL HAS A PART BEING MADE (2026-10-23, audit S5-3): a
 * part queued, started, ready or recovering, or one whose preparation is
 * running (`prepState`), which has no job row while it is prepared. A part
 * waiting on the owner (a question, a go-ahead) is not being made.
 */
export function requestMaking(rec, now = Date.now()) {
  if (!rec || !Array.isArray(rec.parts)) return false;
  return rec.parts.some((p) => p && (["queued", "started", "ready", "recovering"].includes(p.status) || prepState(p, now) === "preparing"));
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
      : ps.some((p) => ["queued", "started", "ready", "recovering"].includes(p.status)) ? "running"
      : ps.some((p) => p.status === "waiting" || p.status === "approval" || p.status === "uncertain") ? "waiting" : "blocked";
  }
  return rec;
}

/** The ids of every job of the request that has not ended: the rows a step reads. */
/** Whether one part of a request was stopped on its own (`stopParts`, background work). */
export function stoppedPart(rec, n) {
  return !!rec && Array.isArray(rec.stopParts) && rec.stopParts.includes(n);
}

/**
 * STOP ONE PART (2026-10-23, background work: Stop on a job's own view, Remove
 * on a part still waiting its turn). The record with `n` added to `stopParts`,
 * or null when there is nothing to stop: no such part, the request ended or
 * stopped whole, or the part already ended. Nothing new starts for it; a job
 * it is running is cancelled by the caller through the job's own door.
 */
export function stopPart(record, n) {
  if (!record || record.ended || record.stop || !Number.isInteger(n)) return null;
  const p = Array.isArray(record.parts) ? record.parts.find((x) => x && x.n === n) : null;
  if (!p || PART_TERMINAL.includes(p.status)) return null;
  if (stoppedPart(record, n)) return record;
  return { ...record, stopParts: [...(Array.isArray(record.stopParts) ? record.stopParts : []), n] };
}

/** The live job of one part, by id, when it has one. */
export function partJobId(rec, n) {
  const p = rec && Array.isArray(rec.parts) ? rec.parts.find((x) => x && x.n === n) : null;
  const j = p ? currentJob(p) : null;
  return j && j.id ? j.id : (j && j.kind === "rewrite" && !j.end ? j.key : "");
}

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
      const before = needsFirst.map((i) => made.byChange[i]).filter((m) => Number.isInteger(m) && m !== p.n && !rec.parts[m].needs.includes(p.n));
      if (before.length) { for (const m of before) if (!p.needs.includes(m)) p.needs.push(m); p.phase = "route"; p.route = null; p.status = "blocked"; }
    }
  } else if (routed && routed.intent === "ask") {
    p.status = "done"; p.answer = typeof routed.answer === "string" ? routed.answer : ""; p.done = "answered a question about the site"; p.outcome = { kind: "answer" };
  } else if (routed && routed.intent === "build" && routed.confirmed === true) {
    // "START OVER", CONFIRMED (owner, 2026-10-24): the router asked first
    // ("this replaces your whole site, OK?") and this answer said yes. The
    // answer IS the go-ahead: the route records it at once
    // (`approveRequestPart`), with no second button.
    askApproval(p, "start-over", now);
    if (p.status === "approval") p.confirmed = true;
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

/**
 * THE CHECKPOINT A PART'S NEXT RUN RESUMES FROM (round 13): the latest run job
 * of the part that paused on the customer's question, when its pause kept a
 * checkpoint (`end.held`, its count). The latest only: if that one cannot be
 * read, the part waits on it — an older checkpoint holds older scope.
 */
export function heldFromOf(p) {
  const runs = (p && Array.isArray(p.jobs) ? p.jobs : []).filter((j) => j && j.kind === "run" && typeof j.id === "string" && j.id && j.end && j.end.act === "clarify");
  const last = runs[runs.length - 1];
  if (!last || !Number.isInteger(last.end.held) || last.end.held < 0) return null;
  return {
    job: last.id, count: last.end.held,
    ...(Array.isArray(last.end.heldList) ? { list: last.end.heldList, asked: last.end.heldAsked || "" } : {}),
    // …OR WHAT CHANGED SINCE AN EARLIER CHECKPOINT OF THE PART (round 14).
    ...(plain(last.end.heldDelta) ? { delta: last.end.heldDelta, asked: last.end.heldAsked || "" } : {}),
  };
}

/** The part a waiting question belongs to, kept on the record when the question is asked again (`part.question`). */
export function askedPart(record, questionId) {
  return (record && record.parts || []).find((p) => p.status === "waiting" && p.question && p.question.id === questionId) || null;
}

// ── THE BODIES OF A PART'S JOBS ──────────────────────────────────────────────

/** What every model call of a part is shown beside its words (`partBlock`): the message, and what came before. */
export function partOf(rec, n) {
  // WHAT THE PARTS IT NEEDS DID (2026-10-08, the parallel-tasks batch): the
  // parts it waits for, all the way down, and the part it was carved from —
  // never a part it does not need. An independent part's step is the same
  // whichever finished first, so what it is shown cannot depend on that, and
  // a preparation made before another part ended is still the one its job runs.
  const need = new Set();
  const walk = (m) => {
    const q = rec.parts[m];
    if (!q || need.has(m)) return;
    need.add(m);
    for (const x of q.needs) walk(x);
    if (Number.isInteger(q.parent)) walk(q.parent);
  };
  const me = rec.parts[n];
  if (me) { for (const x of me.needs) walk(x); if (Number.isInteger(me.parent)) walk(me.parent); }
  // WHAT IS NOT THIS PART'S WORK (2026-10-12, run 137): where every other
  // part's own words stand in the message, as offsets, so the message it is
  // shown marks them as another part's — a step that writes several pages was
  // shown a held change unmarked, and made it. A part whose words hold this
  // one's (the part it was carved from) is not "other": its words are its too.
  const others = otherSpans(rec, n);
  return {
    key: rec.key, part: n, original: rec.message,
    // CARVED FROM ANOTHER PART BY A JOB (2026-10-23, fix-edit-flow): its words
    // were already read, and paid for, by the job that carved them, so its
    // own routing job is not charged again (live: 3 credits, nothing done).
    // Parts the message's own routing held back keep their charge, as before.
    ...(me && me.source === "carved" ? { carved: true } : {}),
    // ROUTED AGAIN TO SPLIT ITSELF (2026-10-24): the step's reason, so the
    // router is asked for parts it can do — and, the words already routed and
    // paid for, not charged again.
    // ALREADY CHARGED (2026-10-24, the owner: no question after a charge): an
    // earlier job of this request — any part's, routing or run — ended with a
    // charge on its row (`chargedOf`), so this part's steps offer the customer
    // no question and state their default (`clarifyTransport`'s `charged`).
    ...(rec.parts.some((q) => Array.isArray(q.jobs) && q.jobs.some((j) => j && j.end && Number(j.end.cost) > 0)) ? { charged: true } : {}),
    ...(me && plain(me.splitAsk) ? { split: { why: String(me.splitAsk.why || "").slice(0, 20), ...(me.splitAsk.reason ? { reason: me.splitAsk.reason } : {}) } } : {}),
    done: rec.parts.filter((q) => q.n !== n && need.has(q.n) && q.status === "done" && q.done).map((q) => ({ words: q.words, said: q.done })),
    ...(others.length ? { others } : {}),
    context: rec.context,
  };
}

/**
 * `[[start, end), …]` in `rec.message`, in order and never overlapping: every
 * place another part's words stand, never this part's own. Part 0's words are
 * the message with the held parts taken out, so they are rarely the
 * customer's text to the letter; where a part's words are not found as they
 * are, it is the message's text outside every other part's words.
 */
function otherSpans(rec, n) {
  const text = typeof rec.message === "string" ? rec.message : "";
  const me = rec.parts[n];
  if (!text || !me) return [];
  const live = rec.parts.filter((q) => q && q.status !== "refused" && typeof q.words === "string" && q.words);
  const at = (q) => wordSpans(text, q.words);
  const mine = at(me);
  const raw = [];
  for (const q of live) {
    if (q.n === n || wordsIn(q.words, me.words)) continue;
    let sp = at(q);
    if (!sp.length) {
      const covered = live.filter((r) => r.n !== q.n).flatMap(at).sort((x, y) => x[0] - y[0]);
      let pos = 0;
      const gaps = [];
      for (const [s, e] of covered) { if (s > pos) gaps.push([pos, s]); pos = Math.max(pos, e); }
      if (pos < text.length) gaps.push([pos, text.length]);
      sp = gaps.map(([s, e]) => {
        while (s < e && /\s/u.test(text[s])) s++;
        while (e > s && /\s/u.test(text[e - 1])) e--;
        return [s, e];
      }).filter(([s, e]) => /[\p{L}\p{N}]/u.test(text.slice(s, e)));
    }
    raw.push(...sp);
  }
  const out = [];
  for (const sp of raw.filter(([s, e]) => !mine.some(([ms, me2]) => s < me2 && ms < e)).sort((x, y) => x[0] - y[0] || y[1] - x[1])) {
    const last = out[out.length - 1];
    if (last && sp[0] < last[1]) { last[1] = Math.max(last[1], sp[1]); continue; }
    out.push([sp[0], sp[1]]);
  }
  return out;
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
    // ROUTED AGAINST THE SITE AS IT IS NOW: the route reads the site's own
    // table names (`routeDigest`) — a part before this one may have added one
    // — and they replace these whenever the read answers. THE NAMES KNOWN AT
    // ACCEPTANCE ARE KEPT as the fallback (2026-10-23, audit A36-5): blanked,
    // a read that failed or timed out left the router told of no table at all,
    // where the page's own path keeps the page's names. Its own page list
    // replaces the one kept here whenever it can be read.
    const digest = plain(rec.digest) ? { ...rec.digest } : { pages: [], tables: [] };
    // …UNLESS ITS ROUTING IS SCOPED (2026-10-15, `routeScope`): a prepared part
    // the router named only stored tables for keeps this page list, the one
    // kept at acceptance, in its preparation and in its job alike — the same
    // rule as a prepared step's scope, given only when the part was prepared.
    const scope = p.prep ? routeScope(p) : null;
    return {
      url: "/api/site/route",
      body: {
        message: words, site: digest, picker: rec.picker, ...(REQUEST_EFFORTS.includes(rec.effort) ? { effort: rec.effort } : {}), firstBuild: false, brief: words, qa: [],
        answering: false, attached: rec.files.length > 0 || rec.attached, slug: rec.slug, hasSite: true, idem: key, request,
        ...(scope ? { scope } : {}),
      },
    };
  }
  // A RUN AFTER A QUESTION RESUMES FROM ONE CHECKPOINT (round 13): the last job
  // of this part that paused on a question, when it kept one — never an older one.
  const hf = heldFromOf(p);
  if (hf) request.heldFrom = { job: hf.job, count: hf.count };
  // …AND ONLY A PART THAT PAUSED HAS ANYTHING TO RESUME (round 14): one that
  // never stopped on a question or a purchase reads no checkpoint, so a store
  // that cannot be read just then holds up nothing it never needed.
  if (p.jobs.some((j) => j && j.kind === "run" && j.end && (j.end.act === "clarify" || j.end.act === "uncertain"))) request.paused = true;
  const d = p.route || {};
  const context = contextWire(rec.context);
  const askRound = Number.isInteger(p.askRound) && p.askRound > 0 ? p.askRound : undefined;
  // WHAT THE STEP TAKES OUT OF WHAT IT RUNS: the parts held back that are in
  // those words — after an answer, the request it left holds only its own and
  // what the answer's routing held back, never the message's other parts.
  const inRun = p.held.filter((w) => !p.resume || !!wordsIn(p.resume, w));
  const held = inRun.length ? inRun : undefined;
  if (d.op === "addon") {
    // A PREPARED ADDITION'S DECLARED SCOPE (`addonScope`), on its preparation
    // and its job alike, as an edit's is below.
    const aScope = p.prep ? addonScope(p) : null;
    return {
      url: "/api/site/" + encodeURIComponent(rec.slug) + "/addon",
      body: {
        instruction: runs, picker: rec.picker, ...(REQUEST_EFFORTS.includes(rec.effort) ? { effort: rec.effort } : {}), idem: key, tz: rec.tz,
        // THE PAGES AS THEY WERE IDENTIFIED (`labels`, round 11), on its
        // preparation and its job alike, so both make the same request.
        ...(readLabels(rec.labels) ? { labels: readLabels(rec.labels) } : {}),
        alsoAsked: heldWire(held),
        handOver: plain(d.handOver) ? d.handOver : undefined,
        // WHICH SCREEN SIZES THE ADDITION IS FOR (2026-10-24), as an edit's.
        devices: Array.isArray(d.devices) && d.devices.length ? d.devices : undefined,
        askRound, putOff, context,
        routedCost: Number.isInteger(d.cost) && d.cost >= 0 ? d.cost : undefined,
        attached: rec.files.length || rec.attached ? true : undefined,
        // FILES IT WAS SAID TO CARRY AND NEVER GOT (round 8): the add-on step is
        // told, and may ask for them; an answer's files join the request's.
        filesMissing: rec.attached && !rec.files.length ? true : undefined,
        scope: aScope || undefined,
        request,
      },
    };
  }
  // THE PICTURE STEP IS SENT THE FILES TOO (audit A25-1, #162): an attached
  // photo is stored and offered first, instead of a bought one.
  const imgs = d.layer === "logo" || d.layer === "picture" ? files.slice(0, 3) : [];
  // A PREPARED PART'S DECLARED SCOPE (2026-10-11, after Codex's review): its
  // step is shown only the pages or tables its route names — its preparation
  // and its job alike, so what a prepared answer rests on is exactly what its
  // request holds, and an exact replay is valid whatever changed elsewhere.
  const scope = p.prep ? prepScope(p) : null;
  return {
    url: "/api/site/" + encodeURIComponent(rec.slug) + "/edit",
    body: {
      layer: String(d.layer || ""),
      page: d.page ? String(d.page) : "",
      remove: d.remove === true,
      rename: typeof d.rename === "string" ? d.rename : "",
      tab: d.tab === true,
      devices: Array.isArray(d.devices) && d.devices.length ? d.devices : undefined,
      instruction: runs,
      alsoAsked: heldWire(held),
      addition: d.fromAddon === true ? true : undefined,
      handedOff: d.handedOff === true ? true : undefined,
      handOver: plain(d.handOver) ? d.handOver : undefined,
      askRound, putOff, context,
      attached: rec.files.length || rec.attached ? true : undefined,
      picker: rec.picker, ...(REQUEST_EFFORTS.includes(rec.effort) ? { effort: rec.effort } : {}),
      routedCost: Number.isInteger(d.cost) && d.cost >= 0 ? d.cost : undefined,
      recent: d.layer === "data" && Array.isArray(rec.recent) && rec.recent.length ? rec.recent.slice(0, 3) : undefined,
      scope: scope || undefined,
      images: imgs.length ? imgs : undefined,
      // AN ADDITION'S MARKED FRAMES TO FILL (round 5): the picture step places
      // each one's purchase, with no model call.
      place: Array.isArray(d.place) && d.place.length ? d.place.map((x) => ({ id: x.id, d: x.d, k: x.k, file: x.file, files: Array.isArray(x.files) ? x.files : [x.file].filter(Boolean), located: x.located !== false })) : undefined,
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
  // WHERE THE OTHER PARTS' WORDS STAND (`partOf`): a list that does not read
  // is none, and the part is shown as before.
  const others = readSpans(v.others, original, v.original);
  const chars = original.length + done.reduce((s, d) => s + d.words.length + d.said.length, 0);
  if (chars > MAX_CARRIED_CHARS) return null;
  // THE CHECKPOINT THIS JOB MUST RESUME FROM (round 13): the paused job and how
  // many requirements it held — read strictly; anything else is none.
  const hf = plain(v.heldFrom) && typeof v.heldFrom.job === "string" && /^[0-9a-f]{8,64}$/.test(v.heldFrom.job) && Number.isInteger(v.heldFrom.count) && v.heldFrom.count >= 0
    ? { job: v.heldFrom.job, count: v.heldFrom.count } : null;
  return { key: v.key, part: v.part, original, done, ...(others.length ? { others } : {}), context, ...(hf ? { heldFrom: hf } : {}), ...(v.paused === true ? { paused: true } : {}), ...(v.carved === true ? { carved: true } : {}), ...(readSplit(v.split) ? { split: readSplit(v.split) } : {}), ...(v.charged === true ? { charged: true } : {}) };
}

/** A routing job's split ask (`partOf`'s `split`), read strictly: `{ why, reason? }`, or null. */
export function readSplit(v) {
  if (!plain(v) || typeof v.why !== "string" || !/^[a-z-]{1,20}$/.test(v.why)) return null;
  if (v.reason !== undefined && (typeof v.reason !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(v.reason))) return null;
  return { why: v.why, ...(typeof v.reason === "string" ? { reason: v.reason } : {}) };
}

// ── WHAT THE PAGE AND THE REPLY ARE SHOWN ────────────────────────────────────

/** A run job whose own reply explains its part: it ended with an answer, and was not a hand-over, nor a try lost to its own request's overlap (run again by the request, so its "Send it again." is not the owner's to follow: audit A14-2). */
const shownRun = (j) => j.kind === "run" && !!j.id && !!j.end && !["hop", "climb", "answerless", "held-retry", "overlap"].includes(j.end.act);

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
    // A LINE'S EXPLANATION RIDES WITH IT (talk, 2026-10-13), when it has one.
    for (const l of progress[j.id]) if (l && typeof l === "object") out.push({ job: j.id, n: l.n, ms: l.ms, text: l.text, ...(typeof l.explain === "string" && l.explain ? { explain: l.explain } : {}) });
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
/**
 * EACH RUN JOB'S EXECUTION, as its own progress record kept it (`runs`, by job
 * id: `{ from, to }` — opened when the job began running, closed at its end; a
 * `to` of null while it runs). Only what the record says: a job with none is
 * left out, never given a guessed interval.
 */
function runsOf(p, runs) {
  if (!runs || typeof runs !== "object") return [];
  const out = [];
  for (const j of Array.isArray(p.jobs) ? p.jobs : []) {
    if (!j || j.kind !== "run" || typeof j.id !== "string" || !Object.hasOwn(runs, j.id)) continue;
    const r = runs[j.id];
    if (!r || !Number.isFinite(r.from) || (r.to !== null && (!Number.isFinite(r.to) || r.to < r.from))) continue;
    out.push({ job: j.id, from: r.from, to: r.to });
  }
  return out;
}

/**
 * A part's run jobs' use of their preparation (`prepUse`, by job id):
 * `[{ job, known, staged, replayed, rebased, fresh }]`. A job whose evidence
 * is absent or unreadable (`null`) is `known: false` with no counts, and a
 * count that does not read is `null` — missing evidence is never shown as 0.
 */
function prepUseOf(p, prepUse) {
  if (!prepUse || typeof prepUse !== "object") return [];
  const out = [];
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
  for (const j of Array.isArray(p.jobs) ? p.jobs : []) {
    if (!j || j.kind !== "run" || typeof j.id !== "string" || !Object.hasOwn(prepUse, j.id)) continue;
    const u = prepUse[j.id];
    if (u && typeof u === "object") {
      // `scoped` and `needs` (2026-10-11): what the step was shown, and how
      // often the model's own answer said it needed more; absent on evidence
      // written before them, and then null — never 0.
      // `marks` (2026-10-13): each call's `partMarks`, replayed or made now;
      // null when absent or unreadable — unknown, never "none".
      // `skipped` (2026-10-13, correction reuse): first requests answered by
      // a prior refusal; null on evidence written before it.
      out.push({ job: j.id, known: true, staged: ["yes", "no", "unreadable"].includes(u.staged) ? u.staged : null, replayed: n(u.replayed), rebased: n(u.rebased), fresh: n(u.fresh), skipped: n(u.skipped), scoped: n(u.scoped), needs: n(u.needs), marks: Object.hasOwn(u, "marks") ? readMarks(u.marks) : null });
    } else out.push({ job: j.id, known: false });
  }
  return out;
}

export function requestView(rec, { progress = null, said = null, runs = null, prepUse = null, now = Date.now() } = {}) {
  // THE MESSAGE'S OWN ROUTING CHARGE, WHEN NO PART'S REPLY SAYS IT: part 0's
  // run carries it (`routedCost`) only when part 0 ran on the answer that
  // accepted the message and its job's reply was written; a part 0 routed
  // again, stopped or never run leaves it to the request's own reply.
  const p0 = rec.parts[0];
  const saidByPart0 = !!p0 && !p0.jobs.some((j) => j.kind === "route") && p0.jobs.some(shownRun);
  return {
    key: rec.key, state: rec.state, ended: rec.ended === true, stop: rec.stop === true, at: rec.at, updatedAt: rec.updatedAt,
    routedUnsaid: !saidByPart0 && Number.isInteger(rec.routedCost) && rec.routedCost > 0 ? rec.routedCost : 0,
    // A SPLIT REQUEST'S OPENING LINE (2026-10-23), the model's own, when written.
    ...(said && typeof said === "object" && typeof said.opening === "string" && said.opening.trim() ? { opening: said.opening.trim() } : {}),
    parts: rec.parts.map((p) => ({
      n: p.n, words: typeof p.shown === "string" && p.shown ? p.shown : p.words, status: p.status,
      // BEING PREPARED, OR PREPARED AND WAITING ITS TURN TO BE APPLIED
      // (2026-10-08): its work has started; it is never done until its own
      // job has applied it and said so.
      ...((st) => (st ? { prep: st } : {}))(prepState(p)),
      // WHEN ITS PREPARATION RAN, AND ITS JOBS (2026-10-09, the readiness
      // correction): the evidence a reader judges overlap by — never a status
      // sampled while it ran.
      ...((pr) => (pr ? { prepRun: pr } : {}))(prepRunOf(p)),
      ...((rs) => (rs.length > 1 ? { prepRuns: rs } : {}))(prepRunsOf(p)),
      ...((rs) => (rs.length ? { runs: rs } : {}))(runsOf(p, runs)),
      // WHAT EACH RUN JOB ANSWERED FROM ITS PREPARATION AND ASKED A MODEL NOW
      // (2026-10-11): the job's own durable record, so reuse is read, not inferred.
      ...((us) => (us.length ? { prepUse: us } : {}))(prepUseOf(p, prepUse)),
      // WHAT A STEP FOR IT IS SENT — the full rewrite's go-ahead sends this.
      ...(p.status === "needs-rewrite" || p.status === "approval" ? { ask: p.resume || p.words } : {}),
      // THE APPROVED REWRITE'S BUILD, which no job poll reads (`/api/site/build/<id>` does).
      ...(p.approval ? { approved: { at: p.approval.at } } : {}),
      // ITS GO-AHEAD IS THE BUILD TRIED AGAIN, not a rewrite (2026-10-24): the
      // site's first build never finished, so it has no pages to change.
      ...(p.retry === true ? { retry: true } : {}),
      // WHY ITS STEP COULD NOT MAKE IT, when it ended too big (2026-10-24).
      ...(p.why === "too-big" && typeof p.splitReason === "string" ? { splitReason: p.splitReason } : {}),
      // SPLITTING ITSELF (2026-10-24): being routed again into smaller parts,
      // and, for a part that came of it, the part it was split from.
      ...(plain(p.splitAsk) ? { splitting: true } : {}),
      ...(Number.isInteger(p.splitOf) ? { splitOf: p.splitOf } : {}),
      // WHAT ITS REWRITE ASKED, when it stopped to ask (2026-10-24).
      ...(typeof p.asked === "string" && p.asked ? { asked: p.asked } : {}),
      // EVERY JOB IT FILED, in order — its routing, its runs, its rewrite —
      // for a reader that checks each one's row and ledger (the UI canary).
      ids: p.jobs.filter((j) => j.id).map((j) => j.id),
      ...(p.why ? { why: p.why } : {}),
      // WHAT IT WAITS FOR (2026-10-16, the frontend batch): the parts it
      // needs, by number, while it is held for them or was not run because
      // one of them broke — so the card names the part, not "another part".
      ...((p.status === "blocked" || p.status === "not-run") && Array.isArray(p.needs) && p.needs.length ? { needs: p.needs.filter((m) => Number.isInteger(m)) } : {}),
      // WHICH THING IT NEEDED WAS NOT MADE (2026-10-24, request-needs).
      ...(p.status === "not-run" && Array.isArray(p.missing) && p.missing.length ? { missing: p.missing.filter((t) => typeof t === "string").slice(0, 8) } : {}),
      // SAVED AS A DRAFT, NOT PUBLISHED (2026-10-16, the frontend batch): the
      // revision its job saved, from the job's own answer or the recovery's
      // reading of the draft — the card says "saved", never "published".
      ...((p.status === "done" || p.status === "partial") && p.outcome && p.outcome.draft && Number.isSafeInteger(p.outcome.draft.revision) && p.outcome.draft.revision > 0
        ? { draft: { revision: p.outcome.draft.revision, preview: ["ready", "pending"].includes(p.outcome.draft.preview) ? p.outcome.draft.preview : "unknown" } } : {}),
      // WHAT ITS TRIES LEFT STANDING (2026-10-07): the reply's facts and the
      // card read it here — dropped from this view, a part stopped after its
      // table went in was told as stopped "before it changed anything".
      ...(leftValue(p.left) && p.status !== "done" ? { left: leftValue(p.left) } : {}),
      // WHAT A HELD PART WAITS ON (2026-10-09, round 3): each picture whose
      // purchase nobody can tell, by its description.
      // AND WHY, AS ITS RECORD GIVES IT (2026-10-11): a picture made and not
      // saved yet (`store-pending`) is not one whose purchase is unknown.
      // EACH ONE'S STATE AND THE PART'S (2026-10-11, the recovery card): what
      // the card says, and whether a buy-again is offered at all — only for
      // a purchase nobody can tell.
      ...(p.status === "uncertain" ? ((hv) => ({ purchases: hv.list, purchaseState: hv.state, buyAgain: hv.buyAgain }))(heldPurchaseView(p, now)) : {}),
      // PICKING ITSELF UP AGAIN (round 14): how many tries, and when the next is.
      ...(p.status === "recovering" && plain(p.recover) ? { recover: { tries: p.recover.tries, next: p.recover.next } } : {}),
      // AN ADDITION ALREADY LIVE WHOSE FRAMES WAIT ON THEIR PHOTOGRAPHS (round
      // 5): published, so never shown as nothing done.
      ...(p.place && p.published ? { published: true, waitingPhotos: (p.place.photos || []).length } : {}),
      ...(p.status === "waiting" && p.question ? { question: { id: p.question.id, text: p.question.text, options: p.question.options, ...(p.question.note ? { note: p.question.note } : {}), ...(p.question.queued ? { queued: true } : {}) } } : {}),
      ...(typeof p.answer === "string" ? { answer: p.answer } : {}),
      // WHAT ITS STEP RECORDED DOING AND WHAT IT LEFT UNDONE (2026-10-23,
      // fix-edit-flow): the facts the request's summary is written from.
      ...((p.status === "done" || p.status === "partial") && typeof p.done === "string" && p.done ? { made: p.done } : {}),
      ...((p.status === "done" || p.status === "partial") && Array.isArray(p.changed) && p.changed.length ? { changed: p.changed.slice(0, 8) } : {}),
      ...(p.status === "partial" && Array.isArray(p.notDone) && p.notDone.length ? { notDone: p.notDone.slice(0, 8).map((x) => ({ what: String((x && x.what) || ""), why: String((x && x.why) || "") })) } : {}),
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
      // THE PAGE ITS ROUTE NAMED (2026-10-23, background work): "Show me" opens
      // it in the preview once the part is done. Only a path, never words.
      ...((p.status === "done" || p.status === "partial") && p.route && typeof p.route.page === "string" && /^\/[^\s]{0,200}$/.test(p.route.page) ? { page: p.route.page } : {}),
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
