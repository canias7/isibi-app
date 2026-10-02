// QUESTIONS BACK, ON A SITE THAT EXISTS (2026-10-02) — the clarification contract.
//
// Owner: *"Implement model-driven clarification for existing-site edit and
// add-on requests only; preserve current first-build behavior. Let the router
// ask a targeted question when missing information materially affects which
// path, target, or operation to choose, instead of converting clarification
// into add-on work. Let edit and add-on steps request clarification too when
// they discover missing details after routing. … preserve the original request,
// attachments, scope, deferred parts, and completed work across the answer and
// page refresh. Resume with the answer incorporated without repeating completed
// changes or charges; support cancellation and a changed request, and prevent
// stale answers from triggering work."*
//
// WHO DECIDES WHAT. A model decides whether to ask and what (the router, a
// step's own model); a model decides whether a reply answers the question or
// asks for something else (the router, shown the question). Code only checks a
// question is one the screen can show, keeps the one live question for a site,
// and refuses an answer to a question that is no longer the live one. Nothing
// here reads a customer's words.
//
// ONE LIVE QUESTION PER SITE, stored where the site's job may write it
// (`source/<slug>/question.json`, inside `jobPrefixes`), so a step that asks
// from inside a queued job keeps it exactly as the route does. A newer question
// replaces it; an answer, a cancel or a message that is not an answer closes
// it, each with a conditional write (`onlyIf: { etagMatches }`, the build
// resume's claim), so of two answers to one question only one can act.
//
// WHAT THE RECORD HOLDS is what the answer must resume: the request still to
// do (the whole message for a question asked before anything ran; only the part
// that asked when other parts already ran, so those are never done again), the
// parts put off earlier (named on every outcome until done), and every question
// this request has asked (`asked`, so none is asked twice). Attachments stay
// with the browser, which keeps them beside the question and sends them again
// with the answer.
//
// NO QUESTION IS SHOWN THAT ITS ANSWER CANNOT RESUME (2026-10-02, the owner's
// review: *"never display a question whose answer cannot resume the original
// request; retain an answerable continuation, with protection against
// repeating the same unanswered question"*). There is no count of questions
// past which one is shown with nothing waiting: every question kept is
// answerable, a question this request has already asked is never asked again
// (`askRepeat`), and one whose answer could not fit beside the request it
// resumes is never asked at all (`askRoom`). Replacing the question an answer
// was given to is one conditional write (`replaceAsk`), so a failed write
// leaves that question waiting to be answered again.
//
// DEPENDENCY-LIGHT: the router's own readers, nothing else, so the Worker and
// the job child import it alike (it is in the Dockerfile's worker line).

import { MAX_MESSAGE, MAX_OPTIONS, MAX_QUESTION_CHARS, readAsk, heldList, EDIT_LAYERS } from "./site-ask.mjs";

// The question's reader is the router's own, so the router and every step hold
// a question to one rule (`readAsk` in site-ask.mjs). Re-exported for the
// steps, which import this module.
export { readAsk };

/** How long a question stays answerable. A day: an answer the next morning still counts. */
export const ASK_TTL_MS = 24 * 60 * 60 * 1000;

/** Where a site's live question is kept — inside the prefixes its jobs may write. */
export const QUESTION_KEY = (slug) => "source/" + String(slug || "").toLowerCase() + "/question.json";

/** The states a question can be in. Only `pending` can be answered. */
export const ASK_STATUSES = Object.freeze(["pending", "answered", "cancelled", "superseded"]);

/** Which step asked: the router, one of the nine edit steps, or the add-on. */
export const ASK_STAGES = Object.freeze(["route", ...EDIT_LAYERS, "addon"]);

/**
 * THE FIELD EVERY STEP'S TOOL CARRIES. Optional, and described by purpose only
 * (*"Delete worked examples; state only the purpose"*): a step that can act
 * leaves it out, and one that cannot tell which thing is meant asks for that
 * one detail instead of guessing — with nothing changed until the reply.
 */
export const QUESTION_FIELD = Object.freeze({
  type: "object",
  description:
    "ONLY WHEN YOU CANNOT DO THIS WITHOUT ONE DETAIL THEY LEFT OUT, and nothing you were shown settles it — " +
    "which of several things they mean, or what should happen to it. Then ask them that one thing here and " +
    "leave the rest of your answer empty: nothing is changed until they reply. Never ask to check that they " +
    "meant it, never for something you can see, never for a choice you can make sensibly yourself, and never " +
    "what they were already asked: each question they answered is in their message, with their answer. When " +
    "you can act, act and leave this out.",
  properties: {
    text: { type: "string", description: "The question, in one or two short, plain sentences, written to them." },
    options: {
      type: "array",
      maxItems: MAX_OPTIONS,
      items: { type: "string" },
      description:
        "Up to four short answers they might give, each a few words, when the answer is one of a few things " +
        "you were shown. Leave it out when it is not. They can always type their own.",
    },
  },
  required: ["text"],
});

/** A step's tool with the question field beside its own — never replacing one it already has. */
export function withQuestion(tool) {
  const schema = (tool && tool.input_schema) || {};
  const props = schema.properties || {};
  if (Object.hasOwn(props, "question")) throw new Error("withQuestion: the tool already has a question field");
  return { ...tool, input_schema: { ...schema, properties: { ...props, question: QUESTION_FIELD } } };
}

/** The question a step's model asked, read off its tool call; null when it asked none. */
export function askOf(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = use && use.input && typeof use.input === "object" ? use.input : null;
  return input ? readAsk(input.question) : null;
}

/**
 * THE REQUEST THE ANSWER RESUMES: what was still to do, then the question and
 * the answer as plain lines — the shape `clarifiedBrief` gives a first build,
 * so the step that reads it sees the customer's own words and never a
 * paraphrase. `null` when it would not fit one message: every step reads at
 * most `MAX_MESSAGE` characters, and a request cut short would lose the answer.
 */
export function answeredRequest(request, question, answer) {
  const r = typeof request === "string" ? request.trim() : "";
  const q = typeof question === "string" ? question.trim() : "";
  const a = typeof answer === "string" ? answer.trim() : "";
  if (!r || !q || !a) return null;
  const out = r + "\n\nThey were asked: " + q + "\nThey answered: " + a;
  return out.length <= MAX_MESSAGE ? out : null;
}

/** A fresh id: 32 hex from the platform's CSPRNG. */
export function newAskId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * HOW MANY QUESTIONS ONE REQUEST'S RECORD NAMES — a bound on the record's size,
 * never a budget of questions. Each round adds its question and answer to the
 * request it resumes, which is one message long (`answeredRequest`), so a
 * request runs out of room long before this.
 */
export const MAX_ASKED = 64;

const ID_RE = /^[0-9a-f]{32}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

/**
 * A QUESTION AS IT IS STORED, every field checked: `null` when anything is not
 * what a question needs. `held` is the parts put off earlier, read the way a
 * hand-over reads them (`heldList`); a list that cannot be read makes the whole
 * record unusable rather than quietly naming none.
 */
//
// `attached` says whether the message the question is about carried files. The
// files stay with the browser that sent them; this is how another tab, a
// reload that lost them, or another device knows to ask for them again rather
// than answer without them.
//
// `asked` IS EVERY QUESTION THIS REQUEST HAS ASKED, this one last — absent, it
// is this one alone. `round` is how many that is; there is no ceiling on it,
// because every question kept is one its answer can resume (`askRoom`), and a
// request asks again only what it has not asked before (`askRepeat`).
export function packAsk({ id, uid, slug, stage, round, question, request, held = [], at, status = "pending", attached = false, asked } = {}) {
  const q = readAsk(question);
  const parts = heldList(held);
  const req = typeof request === "string" ? request.trim() : "";
  if (typeof id !== "string" || !ID_RE.test(id)) return null;
  if (typeof uid !== "string" || !uid) return null;
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return null;
  if (typeof stage !== "string" || !ASK_STAGES.includes(stage)) return null;
  if (!Number.isInteger(round) || round < 1) return null;
  // EVERY PART NO LONGER THAN A MESSAGE: each was cut from one, and a single
  // string reaches `heldList` unchecked for length.
  if (!q || !req || req.length > MAX_MESSAGE || parts === null || parts.some((p) => p.length > MAX_MESSAGE)) return null;
  if (!Number.isFinite(at)) return null;
  if (!ASK_STATUSES.includes(status)) return null;
  if (typeof attached !== "boolean") return null;
  // THE QUESTIONS ASKED SO FAR, EACH ONE A QUESTION'S OWN WORDS, THIS ONE LAST:
  // a list that is anything else makes the record unusable, never a shorter list.
  const list = asked === undefined ? [q.text] : asked;
  if (!Array.isArray(list) || !list.length || list.length > MAX_ASKED) return null;
  if (!list.every((t) => typeof t === "string" && t.trim() && t.length <= MAX_QUESTION_CHARS)) return null;
  if (list[list.length - 1] !== q.text) return null;
  return { v: 1, id, uid, slug, stage, round, question: q, request: req, held: parts, at, status, attached, asked: list.slice() };
}

/**
 * THE QUESTIONS A REQUEST HAS ASKED, as a hand-over carries them (`asked`, from
 * the routing answer to the step that runs the request): a list of question
 * texts, or none. Anything else is none — it only ever protects against a
 * repeat, so a list that cannot be read protects against nothing rather than
 * refusing the work.
 */
export function askedList(v) {
  if (!Array.isArray(v) || v.length > MAX_ASKED) return [];
  return v.every((t) => typeof t === "string" && t.trim() && t.length <= MAX_QUESTION_CHARS) ? v.slice() : [];
}

/** A question's words as they are compared: case, accents, spacing and punctuation set aside. */
function askKey(text) {
  return String(text || "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * HAS THIS REQUEST ALREADY ASKED THIS? A question whose words, set side by side
 * with one already asked (`askKey`), are the same. Such a question is never
 * asked again: its answer was given, and asking it once more is a loop, not a
 * question (owner: *"protection against repeating the same unanswered
 * question"*).
 */
export function askRepeat(asked, question) {
  const k = askKey(question && question.text);
  return !!k && askedList(asked).some((t) => askKey(t) === k);
}

/**
 * THE ANSWERS A RESUMED REQUEST CARRIES (2026-10-02, the owner's review:
 * *"verify actual resumed model inputs"*): its lines from the one that asked
 * this request's first question to its end. `answeredRequest` only ever
 * appends, so they are its last lines — and in no change's own words, however
 * narrowly the picker scoped each change. "" on a fresh request, or when those
 * lines are not there.
 */
export function answerLines(text, asked) {
  const list = askedList(asked);
  if (typeof text !== "string" || !list.length) return "";
  const at = text.indexOf("\n\nThey were asked: " + list[0].trim() + "\nThey answered: ");
  return at < 0 ? "" : text.slice(at + 2).trim();
}

/**
 * THE QUESTIONS WHOSE ANSWERS A REQUEST STILL CARRIES: those of `asked` it
 * holds the lines for. A question kept with a request records only these as
 * asked, so it never forbids asking again what the request no longer answers.
 */
export function askedIn(request, asked) {
  const r = typeof request === "string" ? request : "";
  return askedList(asked).filter((q) => r.includes("They were asked: " + q.trim() + "\nThey answered: "));
}

/**
 * THE ROOM AN ANSWER NEEDS: the longest answer the question offers, and never
 * less than a short typed one — a question whose offered answers fit and whose
 * typed answers could not is still one the screen must not show.
 */
export const ASK_ANSWER_ROOM = 40;

/**
 * CAN AN ANSWER TO THIS QUESTION RESUME THIS REQUEST? The request, the question
 * and an answer as long as its longest option (or `ASK_ANSWER_ROOM`) must fit
 * one message (`answeredRequest`). When they cannot, every answer would be
 * refused as too long, so the question is never shown.
 */
export function askRoom(request, question) {
  const q = readAsk(question);
  if (!q) return false;
  const room = Math.max(ASK_ANSWER_ROOM, ...q.options.map((o) => o.length));
  return answeredRequest(request, q.text, "x".repeat(room)) !== null;
}

/** A stored question read back, with the same checks it was written under. */
export function readAskRecord(raw) {
  let v = raw;
  if (typeof raw === "string") { try { v = JSON.parse(raw); } catch { return null; } }
  if (!v || typeof v !== "object" || Array.isArray(v) || v.v !== 1) return null;
  return packAsk(v);
}

/**
 * IS THIS THE LIVE QUESTION, FOR THIS OWNER? `{ ok: true }`, or `{ ok: false,
 * why }` with `why` one of `missing`, `other` (not this question, or not this
 * owner's), `closed` (answered, cancelled or replaced) and `expired`. An answer
 * to anything but the live question triggers nothing.
 */
export function askLive(record, { id, uid, slug, now = Date.now() } = {}) {
  if (!record) return { ok: false, why: "missing" };
  if (record.id !== id || record.uid !== uid || record.slug !== slug) return { ok: false, why: "other" };
  if (record.status !== "pending") return { ok: false, why: "closed" };
  if (!(now - record.at < ASK_TTL_MS)) return { ok: false, why: "expired" };
  return { ok: true };
}

/**
 * THE SITE'S STORED QUESTION AND ITS ETAG, `{ record, etag }` — `record` null
 * when there is none or it cannot be read, so a damaged record is never a
 * question anybody can answer.
 */
export async function loadAsk(bucket, slug) {
  const obj = await bucket.get(QUESTION_KEY(slug));
  if (!obj) return { record: null, etag: null };
  let text = "";
  try { text = await obj.text(); } catch { return { record: null, etag: obj.etag || null }; }
  return { record: readAskRecord(text), etag: obj.etag || null };
}

/** A new live question for the site, replacing whatever was there. */
export async function storeAsk(bucket, record) {
  await bucket.put(QUESTION_KEY(record.slug), JSON.stringify(record), { httpMetadata: { contentType: "application/json" } });
}

/**
 * CLOSE THE LIVE QUESTION, ONCE. Read, check it is still this owner's pending
 * question, and write its new status ON THE SAME ETAG: R2 answers `null` when
 * another writer moved it first, and then this one has lost — exactly one of
 * two answers to one question can act. `{ ok: true, record }` with the record
 * as it was before it closed, or `{ ok: false, why }` (`askLive`'s reasons, or
 * `raced`).
 */
export async function closeAsk(bucket, { slug, id, uid, status, now = Date.now() } = {}) {
  if (!ASK_STATUSES.includes(status) || status === "pending") throw new Error("closeAsk: not a closing status");
  const { record, etag } = await loadAsk(bucket, slug);
  const live = askLive(record, { id, uid, slug, now });
  if (!live.ok) return live;
  if (!etag) return { ok: false, why: "raced" };
  const won = await bucket.put(QUESTION_KEY(slug), JSON.stringify({ ...record, status }),
    { httpMetadata: { contentType: "application/json" }, onlyIf: { etagMatches: etag } });
  return won ? { ok: true, record } : { ok: false, why: "raced" };
}

/**
 * ANSWER THE LIVE QUESTION WITH THE NEXT ONE, IN ONE WRITE (2026-10-02, the
 * owner's review: *"preserve recoverable state if storing the next question
 * fails"*). Closing the answered question and storing the next were two writes,
 * so when the second failed the answer was used up and nothing waited. Now the
 * next question is written OVER the answered one, on its etag: when the write
 * fails or another writer moved first, the answered question is still the live
 * one, waiting to be answered again. `next` is a packed question; `{ ok: true,
 * record }` with the answered record as it was, or `{ ok: false, why }`
 * (`askLive`'s reasons, or `raced`). A write that throws throws.
 */
export async function replaceAsk(bucket, { slug, id, uid, next, now = Date.now() } = {}) {
  if (!next || next.status !== "pending" || next.slug !== slug || next.uid !== uid) throw new Error("replaceAsk: not a next question for this owner's site");
  const { record, etag } = await loadAsk(bucket, slug);
  const live = askLive(record, { id, uid, slug, now });
  if (!live.ok) return live;
  if (!etag) return { ok: false, why: "raced" };
  const won = await bucket.put(QUESTION_KEY(slug), JSON.stringify(next),
    { httpMetadata: { contentType: "application/json" }, onlyIf: { etagMatches: etag } });
  return won ? { ok: true, record } : { ok: false, why: "raced" };
}
