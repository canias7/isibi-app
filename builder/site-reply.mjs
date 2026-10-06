// ── THE CUSTOMER'S REPLY, WRITTEN BY A MODEL FROM WHAT REALLY HAPPENED ─────
//
// (2026-10-03.) Owner: *"Make normal customer-facing messages throughout edit
// and add-on model-written, including router clarification, success, partial
// completion, pending work, ordinary refusals, repeated-question explanations,
// and cancellation acknowledgments … Code must supply structured, verified
// facts about what changed, what failed, what remains pending, and whether
// input is needed; the model should explain those facts naturally using the
// conversation and site context, without inventing outcomes or changing
// execution decisions. Keep fixed messages only for genuine technical failures
// … A reply-generation failure must never rerun completed work."*
//
// THREE PARTS, AND EACH KEEPS TO ITS OWN JOB.
//
//   THE FACTS are read off the route's own final answer — the fields the
//   browser's composer has always read (`editReplyBody`, `addonReplyText`,
//   `alsoTail`, `wholeRequestNote` in public/chat.js) — and never off the
//   request's wording. Each is one short statement with an id and a kind:
//   something that changed, something that did not and why, a part left for
//   later, the question that needs an answer, what it cost, how to undo it.
//   Where a step already wrote its own account of a result (a refusal's
//   reason, the menu editor's list of links), that account is the fact: the
//   step is the only side that knows it.
//
//   THE CALL is one forced tool call (`write_reply`) on the customer's own
//   picked quick model, shown the facts, their words, the answers they gave
//   and the site's name and pages. It must say which facts it explained
//   (`covers`); a reply that leaves one out is asked for once more, and a
//   second miss is not used.
//
//   THE FALLBACK is to change nothing. A reply that cannot be had — the call
//   failed, timed out, or never covered every fact — leaves the route's answer
//   exactly as it was, and the browser says what it always said. Nothing here
//   runs before the outcome is final, writes anything, or charges anything, so
//   a reply that fails cannot repeat a change or a charge.
//
// NOTHING IS CUT (2026-10-03, the owner's review of the first version:
// *"stop cutting off pending requests, failed additions, and facts after
// arbitrary limits. Pass the complete outcome to the model"*). Every fact goes
// to the model whole — every part left for later, every addition that failed,
// every entry, every reason in full — and the model is told to summarize in its
// own words without dropping or blurring any of them, and never to call
// unfinished work done. The only bound left is on what comes back: a reply
// longer than `REPLY_MAX_CHARS` is refused (never cut), and the page then says
// it the old way, which carries everything too.
//
// WHAT IS NOT WRITTEN BY A MODEL, ON PURPOSE: a technical failure of ours (a
// model or provider that did not answer, a store or service that could not be
// reached), told by its fixed sentence — decided by what the answer says
// (`ours`, and the reasons in `TECHNICAL`), never by its HTTP status alone;
// an escalation, which is not an ending (the browser walks on); a receipt for
// queued work; and the first build, whose interview this never touches.
//
// DEPENDENCY-LIGHT: the Worker and the job child both import it, and the job
// image copies `builder/` modules by name (the Dockerfile's worker line).

import { readContext, MAX_ANSWER_CHARS } from "./site-ask.mjs";

/** The switch: `MODEL_REPLIES` = "on" in the Worker's vars. Anything else keeps every reply as it was. */
export function repliesOn(env) {
  return !!(env && typeof env.MODEL_REPLIES === "string" && env.MODEL_REPLIES.trim().toLowerCase() === "on");
}

/** Where the reply came from, on the answer the browser reads. Only "model" is ever written. */
export const REPLY_SOURCE = "model";

/**
 * The longest reply used: a bound against a runaway answer, not a length to
 * aim for — room for a long outcome summarized with every detail named. A
 * reply past it is refused, never cut. The page reads the same number
 * (`MODEL_REPLY_MAX` in public/edit-poll.js).
 */
export const REPLY_MAX_CHARS = 4000;

/** What one call may write: the reply and the list of facts it covers. */
export const REPLY_MAX_TOKENS = 2000;

/**
 * How long a reply may take, end to end, both attempts together, WHEN THE
 * CUSTOMER'S OWN CONNECTION WAITS FOR IT — a synchronous edit, a routing
 * answer, a cancel. The work is already done and the customer is waiting on
 * its sentence; past this the route answers without one and the browser says
 * it the old way. 45 s since 2026-10-04 (it was 20): run 95's three-fact
 * replies ran past a 12 s call, and a reply of one fact took about 5 s.
 */
export const REPLY_DEADLINE_MS = 45000;

/** One call's own ceiling, inside the deadline (30 s since 2026-10-04; it was 12). */
export const REPLY_CALL_MS = 30000;

// ── A QUEUED JOB'S REPLY IS WRITTEN IN THE BACKGROUND (2026-10-04, run 95's F2) ──
//
// Run 95's R1: every reply call for its three parts ran into the poll's 12 s
// ceiling and was cut off — six attempts, the page's three and the canary's
// three, each read taking 12 s longer than one with nothing to write — so
// every part's answer came late and in the fixed wording, and a reply not
// written was not kept, so the next read paid the 12 s again. The owner chose
// to write the reply on the server once the job's outcome and money are final,
// independently of anybody reading it: these are its budget and its record.
//
// THE BUDGET IS THE BACKGROUND'S, not the poll's moved: nobody waits on it, so
// a call has 90 s and an attempt 150 s (two calls at most), the attempt is
// tried three times, 30 s and then 120 s apart, and a reply still not written
// fifteen minutes after it was asked for is given up as a technical failure.
export const REPLY_BG_CALL_MS = 90000;
export const REPLY_BG_DEADLINE_MS = 150000;
export const REPLY_BG_ATTEMPTS = 3;
export const REPLY_BG_RETRY_S = Object.freeze([30, 120]);
/** How long a writer's claim holds: its attempt's whole deadline and a minute more. */
export const REPLY_LEASE_MS = REPLY_BG_DEADLINE_MS + 60000;
/** How long after it was asked for a reply may still be written; past it, failed. */
export const REPLY_HORIZON_MS = 15 * 60000;
/** A wait past this, with no writer started, is a lost message: the reply is asked for again. */
export const REPLY_RETRY_GRACE_MS = 90000;
/**
 * HOW EARLY A RETRY'S OWN MESSAGE MAY BE TAKEN (2026-10-04, the owner's
 * review): the message is sent with the wait itself, so it comes at its time;
 * this allows only for two machines' clocks disagreeing, never for a
 * duplicate or early delivery, which waits like any other.
 */
export const REPLY_RETRY_SKEW_MS = 2000;
/** The states of a reply's record — its own progress, never the job's. */
export const REPLY_STATES = Object.freeze(["pending", "writing", "written", "failed", "none"]);

/**
 * A REPLY'S RECORD, AS STORED (2026-10-04): `{ state, text?, attempts, asked,
 * at, lease?, retryAt?, why? }`, or null when it is no record at all. One kept
 * before 2026-10-04 — `{ text, at }`, the poll's — is a written reply.
 */
export function readReplyRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
  if (raw.v !== 2) {
    return typeof raw.text === "string" && raw.text.trim() ? { state: "written", text: raw.text, attempts: 1, asked: num(raw.at), at: num(raw.at) } : null;
  }
  if (typeof raw.state !== "string" || !REPLY_STATES.includes(raw.state)) return null;
  const text = typeof raw.text === "string" && raw.text.trim() ? raw.text : undefined;
  if (raw.state === "written" && !text) return null;
  const lease = raw.lease && typeof raw.lease === "object" && typeof raw.lease.owner === "string" && Number.isFinite(raw.lease.until) ? { owner: raw.lease.owner, until: raw.lease.until } : undefined;
  return {
    state: raw.state, ...(text ? { text } : {}),
    attempts: Number.isInteger(raw.attempts) && raw.attempts >= 0 ? raw.attempts : 0,
    asked: num(raw.asked), at: num(raw.at),
    ...(lease ? { lease } : {}),
    ...(Number.isFinite(raw.retryAt) ? { retryAt: raw.retryAt } : {}),
    ...(typeof raw.why === "string" && raw.why ? { why: raw.why.slice(0, 40) } : {}),
  };
}

/**
 * WHAT TO DO WITH A REPLY'S RECORD NOW — the one rule the poll, the sweep and
 * the writer all read:
 *   ask       there is none: make it and ask for the reply;
 *   serve     written: hand it back;
 *   failed    given up: the browser says it the old way, a technical failure;
 *   none      nothing to say: no reply is owed;
 *   wait      being written, or waiting for its next try;
 *   requeue   a writer's claim ran out, or a try was never started: ask again;
 *   give-up   past its horizon: failed.
 * `rec` as `readReplyRecord` reads it; `now` a time in ms.
 */
export function replyNext(rec, now) {
  if (!rec) return "ask";
  if (rec.state === "written") return "serve";
  if (rec.state === "failed") return "failed";
  if (rec.state === "none") return "none";
  if (now - rec.asked > REPLY_HORIZON_MS) return "give-up";
  if (rec.state === "writing") return rec.lease && rec.lease.until > now ? "wait" : "requeue";
  return now - (rec.retryAt || rec.asked) > REPLY_RETRY_GRACE_MS ? "requeue" : "wait";
}

/**
 * MAY A WRITER TAKE THE REPLY NOW (2026-10-04, the owner's review) — the one
 * rule at the claim:
 *   claim   a try is due: none yet, a writer's claim run out, or a retry
 *           whose time has come;
 *   skip    not this writer's: written, failed or owed nothing; being written
 *           under a claim that holds; or a retry not yet due — so a duplicate
 *           or early delivery spends no try and skips no wait;
 *   fail    past its horizon, or its tries spent.
 * `rec` as `readReplyRecord` reads it, or null for none; `now` in ms.
 */
export function replyClaim(rec, now) {
  if (!rec) return "claim";
  const next = replyNext(rec, now);
  if (next === "serve" || next === "failed" || next === "none") return "skip";
  if (rec.state === "writing" && rec.lease && rec.lease.until > now) return "skip";
  if (next === "give-up" || rec.attempts >= REPLY_BG_ATTEMPTS) return "fail";
  if (rec.state === "pending" && Number.isFinite(rec.retryAt) && rec.retryAt - now > REPLY_RETRY_SKEW_MS) return "skip";
  return "claim";
}

export const REPLY_TOOL = {
  name: "write_reply",
  description:
    "Write the one chat message the customer reads now, explaining every fact you were given, and list the id of each fact you explained.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "The message to the customer, in your own words: what was done, what was not done and why, what is still waiting, " +
          "and what you need from them — every fact, and only the facts. As long as that takes and no longer: short when little " +
          "happened; when much happened, group and summarize, but name every change, failure and waiting part. A short list is " +
          "fine when there are many items.",
      },
      covers: {
        type: "array",
        items: { type: "string" },
        description: "The id of every fact your reply explains, exactly as written in brackets (for example \"c1\"). Every fact must be here.",
      },
    },
    required: ["reply", "covers"],
  },
};

export const REPLY_SYSTEM =
  "You write the chat message a customer reads after asking an AI website builder to change their live website. " +
  "The builder's code has already done the work and checked what really happened; you are given all of it as a list of " +
  "facts, each with an id. Your job is only to tell the customer, naturally and in your own words, what those facts say.\n\n" +
  "WHAT A FACT'S ID SAYS IT IS\n" +
  "c: done. f: not done (with the reason when there is one). p: still waiting — not done yet. q: needs their answer " +
  "(the question is shown under your message). x: nothing changed. m: money. u: how to undo. n: worth knowing.\n\n" +
  "RULES\n" +
  "- Make clear what was done, what was not done and why, what is still waiting, and what you need from them — in that " +
  "order where they apply.\n" +
  "- Never say or suggest that something not done, or still waiting, was done. When only part of what they asked for " +
  "was done, say which part.\n" +
  "- Say only what the facts say. Never claim a change, a failure, a charge, a refund, a question or a next step that no " +
  "fact states. If a fact says nothing on the site changed, say so plainly.\n" +
  "- Explain every fact, and list its id in covers. You may group related facts and summarize a long list in your own " +
  "words, but every change, failure, waiting part and question must still be recognisable in what you write: name each " +
  "one, even briefly. Never drop or blur one to keep the message short.\n" +
  "- When a fact says a question will be shown under your reply, lead into it in a few words. Do not ask it yourself, " +
  "do not repeat its words, and do not invent answers to choose from.\n" +
  "- When a fact names a part of their request that was left for later, say plainly that it was not tried, in their own words.\n" +
  "- Describe their site the way they would: pages by their names or addresses, things by the words people see. Never " +
  "mention steps, tools, layers, files, code, models or error codes.\n" +
  "- Use their own words for things on their site where the facts quote them.\n" +
  "- Write in the language they wrote their message in. Warm and direct; no apologies beyond one short one when something " +
  "did not work; no marketing.\n" +
  "- You may start with ✅ when everything they asked for was done, or ⚠️ when part or all of it was not. Otherwise no emoji.\n" +
  "- Never put a fact's id in the reply itself.";

// ── FACTS ────────────────────────────────────────────────────────────────

/**
 * WHAT TECHNICAL MEANS HERE: a failure of ours that no rewording helps —
 * a model, provider, store or service that did not answer, or a state we
 * cannot read. These keep their fixed sentences. Everything else that ends a
 * request (a page the site does not have, a change already in place, a part
 * that needs a detail, a refusal to take something off, a compile that did
 * not come together) is an ordinary outcome and is explained.
 */
export const TECHNICAL = Object.freeze(new Set([
  "send", "no-container", "queue", "stale", "bad-idem", "needs-review", "storage not configured",
  "backend", "config", "store", "rename-store", "generate", "provision", "schema", "verify",
  "parts-unreadable", "row-unprotected", "row-write", "unread", "no-page-back", "clarify-unkept", "ask-unusable",
  "unconfigured", "held-unread", "context-unread", "scope-unread", "layer", "editable-state",
  "no-meta", "lost", "could not read the job", "stopped", "time", "budget", "unverified",
]));

/**
 * Whether an answer is a failure of ours, by what it says — `ours`, a reason
 * in `TECHNICAL`, a stop the platform made (`review`), or a charge the ledger
 * could not take for a reason other than the balance — never by its status.
 */
export function technicalAnswer(body) {
  if (!body || typeof body !== "object") return false;
  if (body.ours === true || body.failed === true || body.review === true) return true;
  if (body.error === "unbilled") return body.detail !== "insufficient";
  return typeof body.error === "string" && TECHNICAL.has(body.error);
}

/** Text on one line, WHOLE: control characters and runs of space made single spaces, and never shortened (2026-10-03). */
const flat = (v) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const said = (v) => (typeof v === "string" && v.trim() ? flat(v) : "");
const quote = (v) => "“" + flat(v) + "”";
const listOf = (items) => (items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1]);
const count = (n, one, many) => (n === 1 ? "one " + one : n + " " + (many || one + "s"));

/** A page file as the address people see: `src/routes/gallery.tsx` → `/gallery` (the browser's `sitePathOf`). */
export function pathOf(file) {
  if (typeof file === "string" && /^\/[^\s]*$/.test(file)) return file;
  const m = String(file || "").match(/^(?:src\/routes\/)?(.+)\.tsx$/i);
  if (!m) return "";
  const rel = m[1];
  const cut = rel.lastIndexOf("/");
  const dir = cut < 0 ? "" : rel.slice(0, cut + 1);
  const segs = (cut < 0 ? rel : rel.slice(cut + 1)).split(".").filter(Boolean).map((s) => s.replace(/_$/, ""));
  if (segs.some((s) => s.charAt(0) === "_")) return "";
  if (segs[segs.length - 1] === "index") segs.pop();
  return "/" + (dir + segs.join("/")).replace(/\/$/, "");
}
const paths = (v) => [...new Set((Array.isArray(v) ? v : []).map(pathOf).filter(Boolean))];
const strings = (v) => (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x.trim()).map(flat);
/**
 * The parts put off, every one, as the answer carries them: one as a string or
 * several as a list. Read for telling, never validated away — whatever the
 * hand-over's own reader would refuse is still every part said here
 * (2026-10-03: a list past the old four-part count was dropped whole).
 */
const partsOf = (v) => [...new Set((typeof v === "string" ? [v] : Array.isArray(v) ? v : []).filter((p) => typeof p === "string" && p.trim()).map(flat))];
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A list of facts with ids by kind: c changed, f not done, p pending, q question, n note, m money, u undo. */
function factList() {
  const out = [];
  const seen = new Set();
  const n = {};
  const PREFIX = { changed: "c", "not-done": "f", pending: "p", question: "q", note: "n", money: "m", undo: "u", nothing: "x" };
  // `item` KEEPS TWO THINGS TWO (2026-10-03): the same words said twice from
  // two sources are one fact, but two entries that read the same — two
  // identical rows taken off a list — are two, and folding them would report
  // one where two moved. A list's own entries pass their place in the list.
  const add = (kind, text, item) => {
    const t = flat(text);
    const key = item === undefined ? kind + "|" + t : kind + "|" + item;
    if (!t || seen.has(key)) return;
    seen.add(key);
    const p = PREFIX[kind] || "n";
    n[p] = (n[p] || 0) + 1;
    out.push({ id: p + n[p], kind, text: t });
  };
  return { add, out };
}

// ── WHAT EACH REQUIREMENT CAME TO, ONE FACT EACH (2026-10-06) ──────────────
//
// Codex reproduced four requirements a customer asked for, each left undone:
// the note named the first three, and this list handed the reply model the
// note as ONE fact, so the fourth reached nothing, and the completeness check
// could only ask whether that one sentence was covered. The owner: *"every
// distinct requested outcome must reach the reply model and its existing
// completeness checks, with accurate states and legitimate deduplication
// preserved. Prefer complete structured outcome facts and let the model write
// the customer's response naturally."* So the route sends what the customer is
// told about each requirement (`requirementsTold`), and each is a fact of its
// own: the reply model must name every one (`readReply`'s `covers`).
//
// THE KIND IS THE STATE'S. Not there, impossible for now, or waiting on a part
// that failed is not done. There and unchecked, or scheduled and not yet seen
// running, is done with something worth knowing. And a requirement nobody
// could see is never called done (owner, 2026-09-15: *"'I've set that up' is
// inappropriate when implementation is unknown"*), so it rides as not done,
// saying exactly that.
const TOLD_FACTS = Object.freeze({
  unsupported: ["not-done", (o) => "Their site cannot do this yet: " + o.need + (o.why ? " (" + o.why + ")" : "") + "."],
  "still-to-do": ["not-done", (o) => "Not done: " + o.need + "."],
  blocked: ["not-done", (o) => "Not done, because another part of this change it depends on did not work: " + o.need + (o.why ? " (" + o.why + ")" : "") + "."],
  "set-up": ["note", (o) => "Set up, but nothing here can check that it works: " + o.need + "."],
  scheduled: ["note", (o) => "Scheduled as asked; its automatic running has not been seen yet: " + o.need + "."],
  unseen: ["not-done", (o) => "Nothing here can see whether this is in place: " + o.need + "."],
});

/**
 * The requirements' facts, then what the note says beside them. CANNOT-TELL
 * READS AS THE WHOLE NOTE: a list that is absent (an answer stored before the
 * route sent one) or has an entry that does not read is not trusted to be
 * whole, and the note, which says every requirement, is one fact as before.
 */
function coverFacts(F, a) {
  const list = a.requirementsTold;
  const whole = Array.isArray(list) && list.length > 0 && list.every((o) => o && typeof o === "object" && !Array.isArray(o)
    && typeof o.need === "string" && flat(o.need) && Object.hasOwn(TOLD_FACTS, o.told) && (o.why === undefined || typeof o.why === "string"));
  if (!whole) {
    const s = said(a.coverNote);
    if (s) F.add("not-done", s);
    return;
  }
  for (const o of list) {
    const [kind, text] = TOLD_FACTS[o.told];
    F.add(kind, text({ need: flat(o.need), why: o.why ? flat(o.why) : "" }));
  }
  const rest = said(a.coverOther);
  if (rest) F.add("not-done", rest);
}

/**
 * The parts left for later: this turn's (`deferred`) and those put off before a
 * question (`putOff`). IN A REQUEST OF SEVERAL PARTS (2026-10-03, `inRequest`)
 * they are its other parts, which the server runs after this one by itself —
 * so nobody is asked to send them again.
 */
function heldFacts(F, body, done, inRequest = false) {
  const now = partsOf(body.deferred);
  const parts = now.concat(partsOf(body.putOff).filter((p) => !now.includes(p)));
  for (const p of parts) {
    F.add("pending", inRequest
      ? "Not part of this step: it is its own part of the same request, done separately after this one without them sending it again: " + quote(p)
      : (done ? "Left for later, so not tried this time (they can send it next): " : "Left for later, so not tried: ") + quote(p));
  }
}

/** The question a step or the router is asking, shown under the reply by the page itself. */
function questionFact(F, q) {
  if (!q || typeof q.text !== "string" || !q.text.trim()) return;
  F.add("question", "A question for them will be shown right under your reply, with its own words and choices: " + quote(q.text) +
    ". Lead into it briefly; do not repeat or answer it.");
}

/**
 * A STEP'S QUESTION AND NOTHING ELSE TO SAY: nothing ran, nothing was put off,
 * nothing charged. The question is the model's own words already, and the page
 * draws it with its card, so there is nothing for a reply to explain — and no
 * call is made for one.
 */
function questionOnly(facts) {
  return facts.some((f) => f.kind === "question") && facts.every((f) => f.kind === "question" || f.kind === "nothing");
}

/**
 * A PART'S TARGET, AS A CUSTOMER READS IT (2026-10-03): their own words for it
 * (the picker's scope), the page it was on, or — when the step was given
 * neither — the part of the site it is about. Never a count: the owner's
 * *"Do not replace missing targets with a vague count."*
 */
const LANE_PLAIN = Object.freeze({
  css: "the styling", theme: "the theme", brand: "the site's name", description: "the description",
  wordmark: "the logo", favicon: "the tab icon", lang: "the language", langs: "the other languages",
  behavior: "what a control does", qr: "a QR code", purpose: "what a page leads with", components: "a page's building blocks",
  shape: "a page's layout", images: "a photograph", action: "the menu or the header button",
  backend: "what the site stores and accepts", three: "the 3D scene", tsx: "a part built for the site",
  kind: "the kind of site", pages: "a page", slug: "the web address",
});
/** A step's layer as a customer reads it, for a step named by neither words nor lanes (the router's own step). */
const LAYER_PLAIN = Object.freeze({
  picture: "a photograph", nav: "the menu or the header button", rules: "what the site stores and accepts",
  rename: "the web address", logo: "the logo", text: "the wording", data: "an entry in a stored list", page: "a page", look: "the look",
});
/** What a part was asked, as names: its own words when the picker scoped it, else its lanes' part of the site, else its layer's. */
function namesOf(p) {
  const words = strings(p && p.words).map(quote);
  if (words.length) return words;
  const lanes = [...new Set((Array.isArray(p && p.lanes) ? p.lanes : []).map((l) => LANE_PLAIN[l]).filter(Boolean))];
  if (lanes.length) return lanes;
  const layer = p && typeof p.layer === "string" ? LAYER_PLAIN[p.layer] : "";
  return layer ? [layer] : [];
}
const pageOfPart = (p) => (typeof (p && p.page) === "string" && p.page.charAt(0) === "/" ? p.page : "");
function targetSaid(p) {
  const names = namesOf(p);
  const page = pageOfPart(p);
  if (names.length) return listOf(names) + (page ? " on " + page : "");
  return page ? "the change on " + page : "";
}

/**
 * What a refusal or a part that did not go through says, each with its target;
 * none is folded into a count. Two parts refused for the same reason on the same
 * page are one problem (two lanes of one page operation, say), said once with
 * both their names.
 */
function partialFacts(F, parts) {
  const groups = [];
  for (const p of parts) {
    const m = p && typeof p.msg === "string" ? p.msg.trim() : "";
    const page = pageOfPart(p);
    // A PART WITH NO REASON IS ALWAYS ITS OWN FACT: each entry is its own step.
    let g = m ? groups.find((x) => x.m === m && x.page === page) : null;
    if (!g) groups.push(g = { m, page, names: [] });
    for (const n of namesOf(p)) if (!g.names.includes(n)) g.names.push(n);
  }
  groups.forEach((g, i) => {
    const what = g.names.length ? listOf(g.names) + (g.page ? " on " + g.page : "") : (g.page ? "the change on " + g.page : "");
    F.add("not-done", (what ? "This part was not done: " + what + "." : "Part of the request was not done.") +
      (g.m ? " The builder's own reason: " + quote(g.m) : " No reason was recorded; asking for it again on its own will say why."), "partial:" + i);
  });
  const charged = parts.map((p) => num(p && p.cost)).filter((c) => c !== null && c > 0);
  const total = charged.reduce((a, c) => a + c, 0);
  if (total > 0) F.add("money", (charged.length === 1 ? "That part" : "Those parts") + " still cost " + count(total, "credit") + ".");
}

/**
 * EVERY STEP THAT RAN BESIDE OTHERS SAYS WHAT IT DID (2026-10-03, the
 * mixed-work audit's MW1). A message that ran several steps answers `look`,
 * and the facts above read the look's fields and the page operations — so a
 * photograph taken off and a menu changed beside them were made and told
 * nowhere. `steps` is each step's own account (worker.js, the edit route's
 * merge); a step whose layer writes its own sentence (only it knows which
 * picture, which links, which address) is said here in its words, with the
 * words it was asked in. Look and page steps are already said above.
 */
const OWN_ACCOUNT = new Set(["picture", "nav", "rules", "rename", "logo", "text", "data"]);
function stepFacts(F, e) {
  if (!Array.isArray(e.steps)) return;
  e.steps.forEach((s, i) => {
    if (!s || typeof s !== "object" || s.status !== "done" || !OWN_ACCOUNT.has(s.layer)) return;
    const own = said(s.msg).replace(/^✅\s*/, "");
    const what = targetSaid(s);
    F.add("changed", (what ? "Done: " + what + ". " : "") +
      (own ? "What the builder reports it did: " + quote(own) : "The change was made."), "step:" + i);
    if (s.layer === "rules") F.add("note", "The change to what the site accepts took effect at once; nothing needed rebuilding.");
  });
}

/** The money a refusal states (`wholeRequestNote`): the edit's own charge, and the routing call's when it is known. */
function refusalMoney(F, body, routedCost) {
  const cost = num(body.cost);
  const unchanged = body.unchanged === true || body.error === "withheld";
  if (unchanged) F.add("nothing", "Nothing on their site changed.");
  if (cost !== null && cost >= 0) F.add("money", cost > 0 ? "This change still cost " + count(cost, "credit") + "." : "This change cost them nothing.");
  const routed = num(routedCost);
  if (routed !== null && routed > 0) F.add("money", "Reading their message cost " + count(routed, "credit") + ".");
}

const LOOK_SAY = { lang: "the language", brand: "the name", description: "the description", theme: "the theme", favicon: "the tab icon", wordmark: "the logo" };

/** What the page operations that published did (`pageOpsSaid`). */
function pageOpFacts(F, ops) {
  let gone = false;
  for (const op of (Array.isArray(ops) ? ops : [])) {
    if (!op || typeof op !== "object") continue;
    const page = typeof op.page === "string" && op.page ? op.page : "";
    const removed = paths(op.removed);
    if (Array.isArray(op.removed) && op.removed.length) {
      F.add("changed", "Took " + (removed.length ? listOf(removed) : "that page") + " off the site.");
      gone = true;
    } else if (typeof op.renamedTo === "string" && op.renamedTo) {
      F.add("changed", "Moved " + (page || "that page") + " to " + op.renamedTo + "; the old address sends visitors to the new one.");
    } else {
      F.add("changed", "Updated " + (page || "the page") + ".");
    }
  }
  if (gone) F.add("undo", "Every published version is kept, so a page taken off can be put back if they ask.");
}

/** What a change did beside what was asked for (`editOutcomes`), every layer. */
function outcomeFacts(F, e) {
  const kept = strings(e.keptParts);
  if (kept.length) F.add("not-done", "Left " + listOf(kept) + " alone: too long to show the builder in one go, and rewriting it unseen would risk losing what it does.");
  const unseen = strings(e.unseenParts);
  if (unseen.length) F.add("not-done", "Could not read the site's sections just then, so " + listOf(unseen) + " stayed exactly as before; asking again may work.");
  const unsure = strings(e.partsUnsure);
  if (unsure.length) F.add("note", "Could not confirm that " + listOf(unsure) + " is still on the page; worth a look before sharing it.");
  const heldPix = Number(e.photosKept) || 0;
  if (heldPix > 0) F.add("note", (heldPix === 1 ? "The photograph" : "The " + heldPix + " photographs") + " already on the page stayed; only what was asked about changed.");
  const lostPix = Number(e.photosRemoved) || 0;
  const offPix = typeof e.photosTakenOff === "number" && e.photosTakenOff > 0 ? e.photosTakenOff : 0;
  if (lostPix > 0) F.add("changed", count(lostPix, "photograph") + (lostPix === 1 ? " is" : " are") + " no longer on the site.");
  if (offPix > 0) F.add("undo", "To undo that, they can roll back to the previous build in Cloud → Versions.");
  else if (lostPix > 0) F.add("undo", "To undo that, they can say “put the " + (lostPix === 1 ? "photo" : "photos") + " back”.");
  const parts = Array.isArray(e.partial) ? e.partial : [];
  partialFacts(F, e.clarify ? parts.filter((p) => !(p && p.error === "clarify")) : parts);
  const frames = Number(e.photos) || 0;
  if (frames > 0) F.add("note", "There " + (frames === 1 ? "is an empty space" : "are " + frames + " empty spaces") + " for a photo; uploading their own in the Data panel fills " + (frames === 1 ? "it" : "them") + ".");
  const listPix = Number(e.listPhotos) || 0;
  if (listPix > 0 || e.listPhotosMore === true) F.add("note", "The page draws its pictures from a list, so the photographs there come from that list; they can ask for photographs there.");
  for (const p of strings(e.problems)) F.add("note", "Worth knowing: " + p);
  const render = said(e.renderNote);
  if (render) F.add("note", render);
}

/**
 * THE FACTS OF AN EDIT'S FINAL ANSWER — the edit route's, synchronous or a
 * queued job's stored one. `skip` says why no reply is written: an answer that
 * is not an ending, or a failure of ours that keeps its fixed sentence.
 */
export function editReplyFacts(e, { routedCost = null, inRequest = false } = {}) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return { skip: "unreadable", facts: [] };
  if (e.escalate === true) return { skip: "escalate", facts: [] };
  if (typeof e.job === "string" && typeof e.poll === "string") return { skip: "receipt", facts: [] };
  if (e.ok === true && e.recovered === true) return { skip: "recovered", facts: [] };
  if (typeof e.ok !== "boolean") return { skip: "unreadable", facts: [] };
  if (technicalAnswer(e)) return { skip: "technical", facts: [] };
  const F = factList();
  if (e.ok === true) {
    const layer = typeof e.layer === "string" ? e.layer : "";
    if (layer === "text") {
      const n = Number(e.applied) || 0;
      const now = strings(e.changed).map(quote);
      F.add("changed", "Changed the wording" + (n > 1 ? " in " + n + " places" : "") + (now.length ? "; it now reads " + listOf(now) : "") + ".");
      for (const link of (Array.isArray(e.staleTel) ? e.staleTel : [])) {
        if (!link || typeof link.href !== "string" || !link.href) continue;
        F.add("not-done", /^mailto:/.test(link.href)
          ? "The email link still sends to " + flat(link.href.replace(/^mailto:/, "")) + "; saying “point the email link at the new address” fixes it."
          : "The Call link still dials " + flat(link.href.replace(/^tel:/, "")) + "; saying “make the call button use the new number” fixes it.");
      }
    } else if (layer === "data") {
      const rows = Array.isArray(e.applied) ? e.applied : [];
      const gone = rows.filter((r) => r && r.removed);
      const rest = rows.filter((r) => r && !r.removed);
      const added = rest.filter((r) => r.id === undefined);
      const changed = rest.filter((r) => r.id !== undefined);
      const tables = (list) => [...new Set(list.map((r) => (typeof r.table === "string" ? r.table : "")).filter(Boolean))];
      if (changed.length) F.add("changed", "Updated " + count(changed.length, "entry", "entries") + (tables(changed).length ? " in " + listOf(tables(changed)) : "") + ".");
      if (added.length) F.add("changed", "Added " + count(added.length, "entry", "entries") + (tables(added).length ? " to " + listOf(tables(added)) : "") + ".");
      gone.forEach((g, i) => {
        const w = g.was && typeof g.was === "object" ? g.was : null;
        const cols = w ? Object.keys(w).filter((k) => k !== "id" && w[k] != null && String(w[k]).trim()) : [];
        const desc = cols.map((k) => k + " " + flat(w[k])).join(", ");
        F.add("changed", "Removed an entry from " + (typeof g.table === "string" ? g.table : "a list") + (desc ? " (" + desc + ")" : "") + ".", "removed:" + i);
        const name = cols.length ? flat(w[cols[0]]) : "";
        if (name) F.add("undo", "To bring it back, they can say “put " + name + " back”.", "removed:" + i);
      });
      const sorted = said(e.sortMsg);
      if (sorted) F.add("changed", sorted.replace(/^✅\s*/, ""));
      if (e.failed) F.add("not-done", count(Number(e.failed) || 1, "entry", "entries") + " could not be saved; trying that one again may work.");
      if (!rows.length && !sorted) F.add("changed", "The change was made.");
    } else if (layer === "page" && ((Array.isArray(e.removed) && e.removed.length) || (typeof e.renamedTo === "string" && e.renamedTo))) {
      pageOpFacts(F, [e]);
    } else if (layer === "page") {
      F.add("changed", "Updated " + (typeof e.page === "string" && e.page ? e.page : "the page") + ".");
      const reord = strings(e.reordered);
      if (reord.length) F.add("note", listOf(reord) + (reord.length === 1 ? " is" : " are") + " listed on other pages too, and only this page changed; saying “do the same everywhere” makes them match.");
      const ign = paths(e.ignored);
      if (ign.length) F.add("not-done", "Only that one page changed; " + listOf(ign) + (ign.length === 1 ? " was" : " were") + " left alone, and asking again naming " + (ign.length === 1 ? "it" : "them") + " would change " + (ign.length === 1 ? "it" : "them") + " too.");
    } else if (layer === "look") {
      const ops = Array.isArray(e.pageOps) ? e.pageOps : [];
      const look = said(e.lookNote);
      if (look) F.add("changed", look);
      const moved = (Array.isArray(e.moved) ? e.moved : []).filter((k) => typeof k === "string").map((k) => LOOK_SAY[k] || k);
      const bits = moved.concat(strings(e.tokens), strings(e.style), e.css ? ["the design"] : []);
      const where = typeof e.tokensPage === "string" && e.tokensPage ? " on " + e.tokensPage : "";
      if (bits.length) F.add("changed", "Changed " + listOf(bits) + where + ".");
      pageOpFacts(F, ops);
      const takeOff = said(e.takeOffNote);
      if (takeOff) F.add("not-done", takeOff);
      if (moved.includes("the name")) {
        const n = Number(e.renamed) || 0;
        F.add(n ? "changed" : "note", n
          ? "Changed the name in " + count(n, "place") + " on the pages too."
          : "The title and link preview use the new name, but the old name was not found written on any page; the headings are worth checking.");
      }
      for (const n of [e.styleNote, e.tokenNote, e.cssNote]) { const s = said(n); if (s) F.add("note", s); }
      stepFacts(F, e);
      if (!F.out.length) F.add("changed", "Updated the look.");
    } else if (e.satisfied === true) {
      // AN ADDITION ALREADY TRUE (2026-10-04, run 95's F1): nothing changed,
      // because nothing needed to; the step's own sentence names what was
      // already there, and where.
      const own = said(e.msg);
      F.add("nothing", own ? "Nothing needed changing; the builder's own account: " + quote(own) : "Nothing needed changing: it was already there.");
    } else {
      // picture, nav, logo, rename, rules: the step wrote its own account,
      // because only it knows which picture, which links, which address.
      const own = said(e.msg);
      F.add("changed", own ? "What the builder reports it did: " + quote(own.replace(/^✅\s*/, "")) : "The change was made.");
      if (layer === "rules") F.add("note", "It took effect at once; nothing needed rebuilding.");
    }
    outcomeFacts(F, e);
  } else {
    if (e.error === "clarify") {
      // A step that asked and did nothing else: nothing ran, nothing charged.
      F.add("nothing", "Nothing on their site changed yet; one detail is needed first.");
    } else {
      const own = said(e.msg);
      if (own) F.add("not-done", "The change was not made. The builder's own reason: " + quote(own));
      else {
        const parts = Array.isArray(e.partial) ? e.partial.filter((p) => !(p && p.error === "clarify")) : [];
        if (parts.length) partialFacts(F, parts);
        else F.add("not-done", "The change did not go through.");
      }
      refusalMoney(F, e, routedCost);
    }
  }
  heldFacts(F, e, e.ok === true, inRequest === true);
  questionFact(F, e.clarify);
  return questionOnly(F.out) ? { skip: "question-only", facts: [] } : { skip: null, facts: F.out };
}

/** An interval in minutes as a customer reads it: "every 15 minutes", "every day". */
function everySaid(m) {
  return !Number.isFinite(m) || m <= 0 ? ""
    : m === 1 ? "every minute"
      : m % 10080 === 0 ? (m === 10080 ? "every week" : "every " + (m / 10080) + " weeks")
        : m % 1440 === 0 ? (m === 1440 ? "every day" : "every " + (m / 1440) + " days")
          : m % 60 === 0 ? (m === 60 ? "every hour" : "every " + (m / 60) + " hours")
            : "every " + m + " minutes";
}

/** A scheduled job as a customer reads it (the browser's `jobWords`, without the zone). */
function jobSaid(j) {
  if (!j || typeof j !== "object" || typeof j.name !== "string" || !j.name) return "";
  const every = everySaid(Number(j.everyMinutes));
  const at = typeof j.at === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(j.at) ? " at " + j.at : "";
  return flat(j.name) + (every ? " (" + every + at + ")" : "");
}

/** An add-on kind as a customer reads it, for a kind named without a design of its own (declined). */
const KIND_PLAIN = Object.freeze({
  table: "a list for the site to store", row: "an entry in one of the site's lists", function: "a function the site runs",
  api: "a connection to an outside service", job: "a scheduled job", page: "a page", component: "a section on a page",
  words: "a line of words", frame: "a menu link, button or footer item", qr: "a QR code", three: "a 3D scene", photo: "a photograph",
});

/** A code's destination as a customer reads it: a web address's path when it is one, the payload otherwise. */
function opensSaid(points) {
  const t = typeof points === "string" ? points.trim() : "";
  if (!t) return "";
  try {
    const u = new URL(t);
    if (u.protocol === "http:" || u.protocol === "https:") return u.pathname && u.pathname !== "/" ? u.pathname : u.host;
  } catch { /* not a web address: said as it is */ }
  return t;
}

/**
 * WHAT A CODE OR A SCENE REALLY IS ON THE SITE (2026-10-03, the mixed-work
 * audit's MW5; the owner: *"distinguish configuration saved from placement
 * verified"*). Shown on a page the publication carries (`on`) is done; carried
 * only by a part a page may render (`unsure`) is a note that nothing confirmed
 * it; saved with no page showing it is not done — the configuration exists and
 * nobody can see it. The page asked for is named beside where it really is.
 */
function placedFacts(F, a) {
  (Array.isArray(a.qrs) ? a.qrs : []).forEach((q, i) => {
    if (!q || typeof q !== "object") return;
    const what = "a QR code" + (said(q.label) ? " captioned " + quote(q.label) : "") + (opensSaid(q.opens) ? " that opens " + opensSaid(q.opens) : "");
    const on = paths(q.on);
    const asked = typeof q.page === "string" && q.page.charAt(0) === "/" ? q.page : "";
    if (on.length) {
      F.add("changed", "Added " + what + ", shown on " + listOf(on) + ".", "qr:" + i);
      if (asked && !on.includes(asked)) F.add("not-done", "That QR code was asked for on " + asked + ", and that page does not show it.", "qr-page:" + i);
    } else if (q.unsure === true) {
      F.add("note", "Saved " + what + (asked ? " for " + asked : "") + ", but nothing could confirm a page shows it; worth a look.", "qr:" + i);
    } else {
      F.add("not-done", "Saved " + what + ", but no page shows it yet" + (asked ? " (it was asked for on " + asked + ")" : "") + "; asking to put it on a page places it.", "qr:" + i);
    }
  });
  const sc = a.scene && typeof a.scene === "object" ? a.scene : null;
  if (sc) {
    const what = "a 3D scene" + (said(sc.about) ? " (" + said(sc.about) + ")" : "");
    const on = paths(sc.on);
    const asked = typeof sc.page === "string" && sc.page.charAt(0) === "/" ? sc.page : "";
    if (on.length) {
      F.add("changed", "Added " + what + " on " + listOf(on) + ".");
      if (asked && !on.includes(asked)) F.add("not-done", "The 3D scene was asked for on " + asked + ", and that page does not draw it.");
    } else if (sc.unsure === true) {
      F.add("note", "Saved " + what + (asked ? " for " + asked : "") + ", but nothing could confirm a page draws it; worth a look.");
    } else {
      F.add("not-done", "Saved " + what + ", but no page draws it yet" + (asked ? " (it was asked for on " + asked + ")" : "") + "; asking for it on a page puts it there.");
    }
  }
}

/** THE FACTS OF AN ADD-ON'S FINAL ANSWER, synchronous or a queued job's stored one. */
export function addonReplyFacts(a, { routedCost = null, inRequest = false } = {}) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return { skip: "unreadable", facts: [] };
  if (a.escalate === true) return { skip: "escalate", facts: [] };
  if (typeof a.job === "string" && typeof a.poll === "string") return { skip: "receipt", facts: [] };
  if (a.ok === true && a.recovered === true) return { skip: "recovered", facts: [] };
  if (typeof a.ok !== "boolean") return { skip: "unreadable", facts: [] };
  if (technicalAnswer(a)) return { skip: "technical", facts: [] };
  const F = factList();
  if (a.ok === true) {
    const added = paths(a.added);
    const removed = paths(a.removed);
    // A PAGE WHOSE ONE CHANGE IS A NEW PAGE'S LINK (`restored`, settled once
    // every step ran — 2026-10-05, run 101): the page writer's own change to it
    // was not kept, so it is said exactly, never as "updated" or "left as it
    // was" of the whole page.
    const restored = (Array.isArray(a.restored) ? a.restored : [])
      .map((r) => (r && typeof r === "object" ? { page: pathOf(r.path), to: paths(r.to) } : null))
      .filter((r) => r && r.page && r.to.length);
    const linkedOnly = new Set(restored.map((r) => r.page));
    const changed = paths(a.changed).filter((p) => !linkedOnly.has(p));
    if (added.length) F.add("changed", "Added " + listOf(added) + " to the site.");
    if (removed.length) F.add("changed", "Removed " + listOf(removed) + ".");
    if (changed.length) F.add("changed", "Updated " + listOf(changed) + ".");
    restored.forEach((r, i) => F.add("changed", "On " + r.page + ", the only change is the link to " + listOf(r.to) + " in its menu; nothing else there needed to change for this.", "restored:" + i));
    const tables = strings(a.tables);
    if (tables.length) F.add("changed", "The site now stores " + listOf(tables) + ".");
    const fns = strings(a.functions);
    if (fns.length) F.add("changed", "Added " + (fns.length === 1 ? "the function " : "the functions ") + listOf(fns) + ".");
    const apis = strings(a.apis);
    if (apis.length) F.add("changed", "Connected " + listOf(apis) + ".");
    const jobs = (Array.isArray(a.jobs) ? a.jobs : []).map(jobSaid).filter(Boolean);
    if (jobs.length) F.add("changed", "Scheduled " + listOf(jobs) + ".");
    // WHAT A JOB ASKED FOR, WHEN IT RUNS ON ANOTHER INTERVAL (2026-10-03, the
    // mixed-work audit's MW7): stated beside the interval it really runs on,
    // never instead of it.
    (Array.isArray(a.jobs) ? a.jobs : []).forEach((j, i) => {
      const asked = j && Number.isFinite(Number(j.askedEveryMinutes)) ? Number(j.askedEveryMinutes) : null;
      if (asked === null || !j.name) return;
      F.add("note", "The scheduled job " + flat(j.name) + " was asked to run " + everySaid(asked) + ", which the platform does not run; it runs " +
        everySaid(Number(j.everyMinutes)) + ", the nearest interval the platform allows.", "job-every:" + i);
    });
    placedFacts(F, a);
    // A KIND WHOSE DESIGNER DECLINED, BESIDE THE KINDS THAT WERE ADDED
    // (2026-10-03, the mixed-work audit's MW6): asked for, and nothing designed.
    strings(a.declined).forEach((k, i) => {
      F.add("not-done", "Nothing was made for " + (KIND_PLAIN[k] || "one part of the request") + ": the builder could not design it from what was asked, and asking for it again on its own, with more detail, may work.", "declined:" + i);
    });
    const rows = (Array.isArray(a.rows) ? a.rows : []).filter((r) => r && typeof r.table === "string" && r.table);
    rows.forEach((r, i) => {
      F.add("changed", "Added " + (typeof r.label === "string" && r.label ? quote(r.label) : "an entry") + " to " + flat(r.table) + (Number.isSafeInteger(r.id) ? " (entry " + r.id + ")" : "") + ".", "row:" + i);
    });
    for (const w of (Array.isArray(a.words) ? a.words : [])) {
      if (w && typeof w.words === "string" && w.words && typeof w.page === "string" && w.page.charAt(0) === "/") F.add("changed", "Added " + quote(w.words) + " to " + w.page + ".");
    }
    const placed = [...new Set((Array.isArray(a.ownPhotos) ? a.ownPhotos : []).map((p) => (p && typeof p.page === "string" && p.page.charAt(0) === "/" ? p.page : "")).filter(Boolean))];
    if (placed.length) F.add("changed", "Put one of their own photographs on " + listOf(placed) + ".");
    if (a.provisioned === true) F.add("changed", "The site has its own database now.");
    for (const fe of (Array.isArray(a.functionErrors) ? a.functionErrors : [])) {
      if (fe && typeof fe.name === "string" && fe.name) F.add("not-done", "The function " + flat(fe.name) + " could not be created" + (fe.error ? ": " + flat(fe.error) : "") + ".");
    }
    for (const je of (Array.isArray(a.jobErrors) ? a.jobErrors : [])) {
      if (je && typeof je.name === "string" && je.name) F.add("not-done", "The scheduled job " + flat(je.name) + " could not be set up" + (je.error ? ": " + flat(je.error) : "") + ", so it will not run yet.");
    }
    const secrets = strings(a.needsSecrets);
    if (secrets.length) F.add("note", "To switch it on, they add " + listOf(secrets) + " under Cloud → Secrets.");
    for (const k of ["credentialNote", "pictureNote"]) { const s = said(a[k]); if (s) F.add("note", s); }
    coverFacts(F, a);
    { const s = said(a.keptPartsNote); if (s) F.add("note", s); }
    // WHAT A DESIGNER SUGGESTED BESIDE THE ASK (2026-10-05, run 101): never a
    // requirement, never done or not done — an extra nobody asked for and
    // nothing was made for, theirs to ask for if they want it.
    const ideas = strings(a.suggestions).slice(0, 3);
    if (ideas.length) F.add("note", "Something they did not ask for, so nothing was made for it, which they could ask for if they want: " + listOf(ideas.map(quote)) + ".");
    const frames = Number(a.photos) || 0;
    if (frames > 0) F.add("note", "There " + (frames === 1 ? "is an empty space" : "are " + frames + " empty spaces") + " for a photo; uploading their own in the Data panel fills " + (frames === 1 ? "it" : "them") + ".");
    const skipped = Array.isArray(a.skipped) ? a.skipped : [];
    if (skipped.includes("photo")) F.add("not-done", "The photograph is a separate step: asking for it on its own places it.");
    if (skipped.includes("frame")) F.add("not-done", "The new link, button or footer item is a separate step: asking for it on its own adds it to every page.");
    (Array.isArray(a.notAdded) ? a.notAdded : []).forEach((nA, i) => {
      if (nA && typeof nA.msg === "string" && nA.msg) F.add("not-done", "Left out " + (typeof nA.name === "string" && nA.name ? quote(nA.name) : "one " + flat(nA.kind || "entry")) + ". The builder's own reason: " + quote(nA.msg), "notAdded:" + i);
    });
    for (const k of (Array.isArray(a.kept) ? a.kept : [])) {
      if (!k || !k.path) continue;
      const p = pathOf(k.path) || flat(k.path);
      F.add("not-done", k.why === "home"
        ? "Left " + p + ": it is the home page, and removing it would leave the site with no front door."
        : "Left " + p + ": " + listOf(paths(k.from)) + " still links to it; the link has to come out first.");
    }
    const back = paths(a.reverted);
    if (back.length) F.add("note", "Left " + listOf(back) + " as " + (back.length === 1 ? "it was" : "they were") + ": nothing there needed to change for this.");
    const unlinked = strings(a.unlinked);
    if (unlinked.length) F.add("note", "Nothing links to " + listOf(unlinked) + " yet; saying where the link should go adds it.");
    for (const p of strings(a.problems)) F.add("note", "Worth knowing: " + p);
    const render = said(a.renderNote);
    if (render) F.add("note", render);
    if (!F.out.length) F.add("changed", "The addition was made.");
  } else if (a.error === "clarify") {
    F.add("nothing", "Nothing was added yet; one detail is needed first.");
  } else {
    const own = said(a.msg);
    F.add("not-done", own ? "Nothing was added. The builder's own reason: " + quote(own) : "The addition did not go through.");
    (Array.isArray(a.notAdded) ? a.notAdded : []).forEach((nA, i) => {
      if (nA && typeof nA.msg === "string" && nA.msg) F.add("not-done", "Left out " + (typeof nA.name === "string" && nA.name ? quote(nA.name) : "one entry") + ". The builder's own reason: " + quote(nA.msg), "notAdded:" + i);
    });
    if (routedCost !== null && num(routedCost) > 0) F.add("money", "Reading their message cost " + count(num(routedCost), "credit") + ".");
  }
  heldFacts(F, a, a.ok === true, inRequest === true);
  questionFact(F, a.clarify);
  return questionOnly(F.out) ? { skip: "question-only", facts: [] } : { skip: null, facts: F.out };
}

/**
 * THE FACTS OF A ROUTING ANSWER THAT ENDS THE TURN: an answer to a question
 * that is no longer the live one, one too long to keep, a request whose answers
 * are full, a question being answered elsewhere. A question the router asks is
 * already its own words (the model's), and its note is written apart
 * (`repeatNoteFacts`); a failed routing call is ours and keeps its sentence.
 */
export function routeReplyFacts(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return { skip: "unreadable", facts: [] };
  if (d.failed === true) return { skip: "technical", facts: [] };
  const F = factList();
  if (d.error === "stale-question") {
    F.add("not-done", d.why === "expired"
      ? "The question they were answering had expired, so their reply was not acted on."
      : "The question they were answering had already been answered or set aside, so their reply was not acted on.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
    F.add("note", "They can say what they would like now, and it will be taken from there.");
  } else if (d.error === "question-busy") {
    F.add("not-done", "Their last question was being answered somewhere else at the same moment, so this message was not acted on.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
    F.add("note", "Sending the message again picks it up from there.");
  } else if (d.error === "answer-too-long") {
    // THE REAL CONSTRAINT, WITH ITS NUMBERS (2026-10-03, the size policy): one
    // message past `MAX_INPUT_CHARS`, or the request with every answer beside it
    // past `MAX_CARRIED_CHARS` — what one request can carry to the models.
    const n = num(d.chars);
    const max = num(d.max) || (d.carried === true ? null : MAX_ANSWER_CHARS);
    F.add("not-done", d.carried === true
      ? "Their answer" + (n ? " is " + n.toLocaleString("en-GB") + " characters, and with" : ", with") + " their request and the answers already beside it, is more than the " +
        (max ? max.toLocaleString("en-GB") + " characters" : "amount") + " one request can carry to the builder, so it was not added."
      : "Their answer" + (n ? " is " + n.toLocaleString("en-GB") + " characters," : " is") + " longer than one message can hold" + (max ? " (" + max.toLocaleString("en-GB") + " characters)" : "") + ", so it was not added.");
    F.add("pending", "Their request is still waiting, with its question still open; a shorter answer lets it go ahead.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
  } else if (d.error === "message-too-long") {
    const n = num(d.chars);
    const max = num(d.max) || MAX_ANSWER_CHARS;
    F.add("not-done", "Their message" + (n ? " is " + n.toLocaleString("en-GB") + " characters," : " is") + " longer than one message can hold (" +
      max.toLocaleString("en-GB") + " characters, what the builder can carry beside their site in one request), so it was not sent on.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
    F.add("note", "Their words are kept in the message box: a shorter message, or the request sent as separate messages, lets it go ahead.");
  } else if (d.error === "answer-files-full") {
    // A PART'S QUESTION ANSWERED WITH FILES (2026-10-03): with the request's own,
    // more than one request can carry.
    const had = num(d.files);
    const max = num(d.max);
    F.add("not-done", "Their answer brought " + (num(d.adding) === 1 ? "a file" : "files") + ", and with the " + (had === 1 ? "file" : (had || "") + " files").trim() + " their request already carries that is more than one request can carry" + (max ? " (" + max + ")" : "") + ", so the answer was not sent on.");
    F.add("pending", "Their request is still waiting, with its question still open; their answer and its files are back in the message box.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
  } else if (d.error === "answers-full") {
    F.add("not-done", "Their request already carries as many answers as can be kept beside it, and every one of them is still needed, so this answer could not be added without forgetting one they gave.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
    F.add("pending", "Their request is still waiting; pressing Cancel on the question and sending what is left of it as a new message lets it go ahead.");
  } else {
    return { skip: "not-an-ending", facts: [] };
  }
  return { skip: null, facts: F.out };
}

/** THE FACTS OF A CANCEL: what the question route answered (`{ cancelled, why, putOff }`). */
export function cancelReplyFacts(r) {
  if (!r || typeof r !== "object" || Array.isArray(r) || typeof r.cancelled !== "boolean") return { skip: "unreadable", facts: [] };
  const F = factList();
  if (r.cancelled && r.request && typeof r.request === "object" && Array.isArray(r.request.parts)) {
    // ONE PART OF A LONGER REQUEST (2026-10-03): only that part ends; the rest
    // goes on as it was, except what needed it.
    F.add("changed", "The part of their request that asked this question is cancelled: nothing more will be done for it.");
    F.add("nothing", "Nothing on their site changed because of it.");
    for (const p of r.request.parts) {
      if (!p || typeof p.words !== "string") continue;
      if (p.status === "not-run") F.add("not-done", "Not started, because it needed the cancelled part: " + quote(p.words));
      else if (p.status === "done") F.add("note", "Already done before this, and unchanged by it: " + quote(p.words));
      else if (p.status !== "cancelled") F.add("pending", "Still going ahead as part of the same request: " + quote(p.words));
    }
  } else if (r.cancelled) {
    F.add("changed", "Their waiting request is cancelled: nothing more will be done for it.");
    F.add("nothing", "Nothing on their site changed because of it.");
    for (const p of partsOf(r.putOff)) F.add("pending", "Left for later and never tried, so it is not done either: " + quote(p));
  } else {
    F.add("not-done", r.why === "expired"
      ? "There was nothing to cancel: that question had already expired."
      : r.why === "missing"
        ? "There was nothing to cancel: no question is waiting on this site."
        : "There was nothing to cancel: that question had already been answered or replaced, so whatever it led to is going ahead as answered.");
  }
  return { skip: null, facts: F.out };
}

/**
 * THE FACTS OF A REQUEST OF SEVERAL PARTS (2026-10-03, the combined request
 * flow): one fact per part, from its status on the server (`requestView` in
 * builder/request.mjs) — for what no part's own reply explains. A part a job
 * finished has its own reply, written from that job's answer, and is named
 * here only as done; a part that never ran says why (the part it needed, a
 * stop, a question nobody answered, the full rewrite it would need), and a
 * part still going says whether it is queued, running or waiting — never
 * done before its record says so. Nothing to add when every part is done and
 * each has its own reply.
 */
export function requestReplyFacts(v) {
  if (!v || typeof v !== "object" || !Array.isArray(v.parts) || !v.parts.length) return { skip: "unreadable", facts: [] };
  const parts = v.parts.filter((p) => p && typeof p.words === "string" && typeof p.status === "string");
  const own = (p) => Array.isArray(p.jobs) && p.jobs.length > 0;
  // THE MESSAGE'S OWN ROUTING CHARGE that no part's reply says (`routedUnsaid`).
  const unsaid = num(v.routedUnsaid);
  if (!(unsaid > 0) && parts.every((p) => p.status === "done" && (own(p) || typeof p.answer === "string"))) return { skip: "nothing-to-add", facts: [] };
  const F = factList();
  // WHAT A PART THAT DID NOT FINISH WAS CHARGED, as its jobs' rows say
  // (`charged`): never assumed from how it ended — a later part's own routing
  // is charged before it runs, whatever happens to it after.
  // A view with no number there says nothing about money: cannot-tell is
  // never read as nothing.
  const paid = (p) => {
    const c = num(p.charged);
    return c === null ? "" : c > 0 ? " The steps it had already taken were charged " + count(c, "credit") + "." : " Nothing was charged for it.";
  };
  // WHAT A PART MADE WITH NO REPLY OF ITS OWN WAS CHARGED (the full rewrite):
  // every job it filed, as their rows and the build's own answer say.
  const paidAll = (p) => {
    const c = num(p.charged);
    return c === null ? "" : c > 0 ? " Everything done for it was charged " + count(c, "credit") + "." : " Nothing was charged for it.";
  };
  const named = (n) => { const q = parts.find((x) => x.n === n); return q ? quote(q.words) : "another part of the request"; };
  const neededOf = (p) => Number((/^needs:(\d+)$/.exec(String(p.why || "")) || [])[1]);
  for (const p of parts) {
    const w = quote(p.words);
    const item = "part:" + p.n;
    if (p.status === "done") {
      F.add("changed", "Done: " + w + (own(p) ? " — its own reply above says what changed."
        // MADE BY THE FULL REWRITE THEY GAVE THE GO-AHEAD FOR (2026-10-03): no
        // step's reply says it, so this one does, with what it cost.
        : p.approved ? " — by the full rewrite of every page, on their go-ahead. Every page was written again, so parts of the site this did not mention may read differently now." + paidAll(p)
        : typeof p.answer === "string" ? " — they asked a question, answered above." : "."), item);
    } else if (p.status === "approval") {
      // WAITING FOR THEIR GO-AHEAD (2026-10-03): nothing starts until they press
      // it, and what needs this part waits with it rather than being given up.
      F.add("pending", "Waiting for their go-ahead: " + w + ". The quicker steps could not make it; only the full rewrite of every page can " +
        "(a full rewrite of the same site was measured at 17 credits), and that writes every page again, so it changes far more than this part asked for. " +
        "It starts only if they press the go-ahead button shown under this part, and lapses if it is left for a day; anything that needs it waits until then." + paid(p), item);
    } else if (p.status === "partial") {
      // DONE IN PART (2026-10-03): its step named something it was asked for
      // and did not do; its own reply says what. Nothing that needed it ran.
      F.add("not-done", "Done only in part: " + w + (own(p) ? " — its own reply above says what was made and what was not." : "."), item);
    } else if (p.status === "not-run") {
      const before = parts.find((x) => x.n === neededOf(p));
      F.add("not-done", "Not started: " + w + ", because it needed " + named(neededOf(p)) + " done first, and " +
        (before && before.status === "partial" ? "that was only partly done." : "that did not finish.") + paid(p), item);
    } else if (p.status === "cancelled") {
      F.add("not-done", (p.why === "question-cancelled" ? "Cancelled with the question it asked, before it changed anything: " : "Stopped at their request before it changed anything: ") + w + "." + paid(p), item);
    } else if (p.status === "needs-rewrite") {
      F.add("not-done", "Not made: " + w + ". The quicker steps could not make it; only the full rewrite of every page could " +
        "(a full rewrite of the same site was measured at 17 credits), which changes far more than this part asked for, " +
        "so it was not started. They can start it from the button shown under this part, or leave it." + paid(p), item);
    } else if (p.status === "expired") {
      F.add("not-done", "Not done: " + w + (p.why === "unapproved"
        ? ", because the full rewrite it needed was not given the go-ahead within a day, so it was never started. They can ask for it again."
        : ", because the question it asked went unanswered for a day. They can ask for it again.") + paid(p), item);
    } else if (p.status === "refused") {
      F.add("not-done", "Not done: " + w + ", because it and the parts it depends on could not be put in an order that works. They can send it on its own." + paid(p), item);
    } else if (p.status === "failed") {
      F.add("not-done", "Not done: " + w + (own(p) ? " — its own reply above says why."
        : p.why === "routing-failed" ? " — working out what it needed failed on our side." + paid(p)
        : p.why === "rewrite-not-written" ? " — the full rewrite they gave the go-ahead for ran, but its pages could not be written, so their site stayed exactly as it was." + paid(p)
        : p.approved ? " — the full rewrite they gave the go-ahead for did not finish, on our side." + paid(p)
        : " — it stopped before it finished, on our side." + paid(p)), item);
    } else if (p.status === "waiting") {
      const q = p.question && typeof p.question.text === "string" ? p.question.text : "";
      F.add("question", "Waiting for their answer before it goes on: " + w + (q ? ", which asked " + quote(q) : "") + ".", item);
    } else if (p.status === "unverified") {
      F.add("pending", "Not known yet whether it went live: " + w + "; it is being checked, and nothing else runs until that is settled.", item);
    } else if (p.status === "started") {
      F.add("pending", "Being done now: " + w + ".", item);
    } else if (p.status === "blocked") {
      F.add("pending", "Queued, and waiting for another part to finish first: " + w + ".", item);
    } else if (p.why === "site-review") {
      F.add("pending", "Queued, and waiting: " + w + ". Their site takes no new changes until an earlier change that stopped part-way through publishing has been checked; it goes ahead after that.", item);
    } else {
      F.add("pending", "Queued, not started yet: " + w + ".", item);
    }
  }
  if (unsaid > 0) F.add("money", "Reading their message cost " + count(unsaid, "credit") + ".");
  return { skip: null, facts: F.out };
}

/**
 * THE FACTS OF A QUESTION ASKED AGAIN: the note above a question the router or
 * a step asked once more, after answers that did not settle it. `earlier` is
 * every answer they gave to it, oldest first; `atLimit` says that nothing will
 * be sent to a model again on its own, so only their answer or a cancel moves it.
 */
export function repeatNoteFacts({ question, earlier = [], atLimit = false } = {}) {
  const q = question && typeof question.text === "string" ? question.text.trim() : "";
  const answers = (Array.isArray(earlier) ? earlier : []).map((p) => (p && typeof p.a === "string" ? p.a.trim() : "")).filter(Boolean);
  if (!q || !answers.length) return { skip: "unreadable", facts: [] };
  const F = factList();
  F.add("note", "This question was asked before, and their " + (answers.length === 1 ? "answer, " + quote(answers[0]) + "," : "answers, " + listOf(answers.map(quote)) + ",") + " did not settle it.");
  F.add("question", "The question will be shown right under your note, with its own words: " + quote(q) + ". Do not repeat it.");
  F.add("pending", atLimit
    ? "Nothing more will be done until they answer once more or cancel the request; either is fine."
    : "Their request is waiting for this one answer.");
  return { skip: null, facts: F.out };
}

// ── THE CALL ──────────────────────────────────────────────────────────────

/** What the model is shown besides the facts: their words, their answers, the site. */
export function replyContext({ request = "", answers = [], site = null } = {}) {
  const lines = [];
  const name = site && typeof site.name === "string" ? flat(site.name) : "";
  const slug = site && typeof site.slug === "string" ? flat(site.slug) : "";
  const pages = site && Array.isArray(site.pages) ? site.pages.filter((p) => typeof p === "string" && p.charAt(0) === "/") : [];
  if (name || slug) lines.push("THEIR SITE: " + (name || slug) + (name && slug ? " (" + slug + ")" : ""));
  if (pages.length) lines.push("ITS PAGES: " + pages.join(", "));
  const words = typeof request === "string" ? request.trim() : "";
  if (words) lines.push("WHAT THEY ASKED FOR:\n" + flat(words));
  const told = readContext(answers) || [];
  if (told.length) lines.push("WHAT THEY TOLD US IN ANSWER TO EARLIER QUESTIONS:\n" + told.map((p) => "- " + quote(p.q) + " → " + quote(p.a)).join("\n"));
  return lines.join("\n\n");
}

/** The request one reply call sends: every fact, whole. `missed` names the facts a first answer left out. */
export function replyRequest({ facts, context = "", model, missed = [] }) {
  const body = (context ? context + "\n\n" : "") +
    "WHAT REALLY HAPPENED (explain every fact; list each id you explained in covers):\n" +
    facts.map((f) => "[" + f.id + "] " + f.text).join("\n") +
    (missed.length ? "\n\nYOUR LAST REPLY LEFT OUT " + missed.join(", ") + ". Explain every fact this time." : "");
  return {
    model,
    max_tokens: REPLY_MAX_TOKENS,
    tools: [REPLY_TOOL],
    tool_choice: { type: "tool", name: REPLY_TOOL.name },
    system: [{ type: "text", text: REPLY_SYSTEM }],
    messages: [{ role: "user", content: body }],
  };
}

/**
 * A reply, read and checked: the forced tool's `reply`, inside the length
 * bound, carrying no fact id in its text, with every fact in `covers`.
 * `{ ok, text, missing }`; `ok` false with `missing` empty is an answer that
 * could not be read at all.
 */
export function readReply(reply, facts, maxChars = REPLY_MAX_CHARS) {
  const block = reply && Array.isArray(reply.content) ? reply.content.find((b) => b && b.type === "tool_use" && b.name === REPLY_TOOL.name) : null;
  const input = block && block.input && typeof block.input === "object" ? block.input : null;
  if (!input || typeof input.reply !== "string" || !Array.isArray(input.covers)) return { ok: false, text: "", missing: [] };
  const text = input.reply.replace(/\r\n/g, "\n").trim();
  if (!text || text.length > maxChars) return { ok: false, text: "", missing: [] };
  const ids = new Set(facts.map((f) => f.id));
  if ([...ids].some((id) => new RegExp("\\[" + id + "\\]").test(text))) return { ok: false, text: "", missing: [] };
  const covered = new Set(input.covers.filter((c) => typeof c === "string").map((c) => c.trim()));
  const missing = facts.map((f) => f.id).filter((id) => !covered.has(id));
  return { ok: missing.length === 0, text, missing };
}

/** The four token kinds, in the shape `pageCredits` prices (the router's `askUsage`). */
export function replyUsage(reply, model) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    model,
  };
}

/**
 * WRITE ONE REPLY. Never throws. `{ ok: true, text, usage, attempts }`, or
 * `{ ok: false, why, usage, attempts }` — `why` one of `no-facts`, `send`,
 * `deadline`, `unreadable`, `uncovered`. At most two calls: a first answer
 * that left a fact out is asked once more, naming what it missed.
 */
export async function writeReply(deps, { facts, context = "", model, deadlineMs = REPLY_DEADLINE_MS, maxChars = REPLY_MAX_CHARS, now = () => Date.now() } = {}) {
  const usage = [];
  if (!Array.isArray(facts) || !facts.length) return { ok: false, why: "no-facts", usage, attempts: 0 };
  if (!deps || typeof deps.send !== "function") return { ok: false, why: "send", usage, attempts: 0 };
  const start = now();
  let missed = [];
  let attempts = 0;
  let why = "unreadable";
  while (attempts < 2) {
    const left = deadlineMs - (now() - start);
    if (left <= 0) return { ok: false, why: "deadline", usage, attempts };
    attempts++;
    let timer;
    let reply;
    try {
      reply = await Promise.race([
        Promise.resolve().then(() => deps.send(replyRequest({ facts, context, model, missed }))),
        new Promise((_, no) => { timer = setTimeout(() => no(Object.assign(new Error("reply deadline"), { deadline: true })), left); }),
      ]);
    } catch (e) {
      return { ok: false, why: e && e.deadline ? "deadline" : "send", usage, attempts };
    } finally {
      if (timer) clearTimeout(timer);
    }
    usage.push(replyUsage(reply, model));
    const read = readReply(reply, facts, maxChars);
    if (read.ok) return { ok: true, text: read.text, usage, attempts };
    if (!read.missing.length) { why = "unreadable"; break; }
    missed = read.missing;
    why = "uncovered";
  }
  return { ok: false, why, usage, attempts };
}

/**
 * WHAT THE JOB DID, IN ONE WORD, FROM THE FACTS ITS REPLY IS WRITTEN FROM
 * (2026-10-04): the line the page holds a reply's place with while the reply
 * is written (`PENDING_LINES` in public/edit-poll.js). The owner: *"do not
 * display "Done" for a failed or refused operation simply because its
 * explanation is pending."* So "done" is something changed and nothing asked
 * for left undone or waiting on a question; "partly" is something changed
 * beside a part not done or a question; "not-done" is nothing changed and a
 * part not done; "asked" is a question and nothing else; "nothing" is nothing
 * changed with nothing refused (an addition already there). "" when the facts
 * say none of these — a skipped body, a list that does not read — and the
 * page then holds the place with a line that claims nothing.
 */
export const REPLY_OUTCOMES = Object.freeze(["done", "partly", "not-done", "asked", "nothing"]);
export function replyOutcomeOf(read) {
  const facts = read && Array.isArray(read.facts) ? read.facts : [];
  const has = (kind) => facts.some((f) => f && f.kind === kind);
  if (has("changed")) return has("not-done") || has("question") ? "partly" : "done";
  if (has("not-done")) return "not-done";
  if (has("question")) return "asked";
  if (has("nothing")) return "nothing";
  return "";
}

/** The answer with the reply on it, as one new object: every field kept, `reply` and `replySource` added. */
export function withReplyText(body, text) {
  return { ...body, reply: text, replySource: REPLY_SOURCE };
}
