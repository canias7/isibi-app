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
// parts put off earlier (named on every outcome until done), and what they
// already told us (`context`: each question this request asked before this
// one, with its answer). Attachments stay with the browser, which keeps them
// beside the question and sends them again with the answer.
//
// THE ANSWERS RIDE BESIDE THE REQUEST, NEVER IN IT (2026-10-02, the owner's
// second review: *"keep clarification context separate from executable
// instructions, with the model identifying its relevant scope rather than
// customer-keyword rules"*). The request is the customer's own words still to
// do and nothing else: no answer is ever appended to it, so it never grows and
// never runs out of room. Every model that decides a change is shown the
// answers in a section of their own, labelled as details of the request and
// never a change of their own (`contextBlock`, `clarifyTransport`); the lane
// picker names which answers each change needs, so when a change is made
// beside a question its answers go with it (`handled`), and the changes still
// to do keep theirs.
//
// NO QUESTION IS SHOWN THAT ITS ANSWER CANNOT RESUME, AND NONE IS ASKED AS IF
// NEW WHEN ITS ANSWER EXISTS (2026-10-02, the owner's two reviews: *"never
// display a question whose answer cannot resume the original request"*; *"when
// an answer did not resolve the ambiguity, retain the pending request and let
// the model ask a more specific follow-up; when the answer already exists,
// reuse it instead of asking again. Prevent repeated-question loops without
// discarding the request or requiring the user to retype it."*). A model that
// asks what was already answered is asked once more with that answer in front
// of it (`clarifyTransport`, and the router's own call), to act on it or ask a
// more specific follow-up. One that still asks the same thing is kept with a
// note naming the answer that did not settle it (`againNote`), and the request
// waits for a better answer; asked a third time, it is sent once more with no
// question offered and acts on what it was told (`MAX_SAME_ASK`). Past
// `MAX_ASKED` answers no question is offered at all. Replacing the question an
// answer was given to is one conditional write (`replaceAsk`), so a failed
// write leaves that question waiting to be answered again.
//
// DEPENDENCY-LIGHT: the router's own readers, nothing else, so the Worker and
// the job child import it alike (it is in the Dockerfile's worker line).

import {
  MAX_MESSAGE, MAX_OPTIONS, readAsk, heldList, EDIT_LAYERS,
  MAX_ASKED, MAX_SAME_ASK, MAX_ANSWER_CHARS, MAX_NOTE_CHARS, CONTEXT_HEADING,
  readContext, shownContext, repeatOf, contextBlock, withContext, reuseNote, withReuse, againNote,
} from "./site-ask.mjs";

// The question's reader is the router's own, so the router and every step hold
// a question to one rule (`readAsk` in site-ask.mjs). Re-exported for the
// steps, which import this module.
export { readAsk };

// AND SO ARE WHAT THEY ALREADY TOLD US AND ITS READERS (2026-10-02): the
// router shows a waiting request's answers and sends a repeated question back
// with its answer, exactly as a step's transport does (`clarifyTransport`
// below), so both live beside `readAsk` and hold the answers to one rule. The
// router cannot import this module: this one imports it.
export {
  MAX_ASKED, MAX_SAME_ASK, MAX_ANSWER_CHARS, MAX_NOTE_CHARS, CONTEXT_HEADING,
  readContext, shownContext, repeatOf, contextBlock, withContext, reuseNote, withReuse, againNote,
};

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
    "what they already answered (WHAT THEY ALREADY TOLD YOU); if that left it open, ask a more specific " +
    "question naming what is open. When you can act, act and leave this out.",
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

/** A fresh id: 32 hex from the platform's CSPRNG. */
export function newAskId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

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
// `context` IS WHAT THEY ALREADY TOLD US: each question this request asked
// before this one, with its answer, in order (`readContext`) — beside the
// request, never in it, and fewer than `MAX_ASKED` of them, so the answer to
// this one still fits the list. `round` is how many questions the request has
// asked, this one included. `note` is the line a question asked once more is
// shown under (`againNote`), naming the answer that did not settle it.
export function packAsk({ id, uid, slug, stage, round, question, request, held = [], at, status = "pending", attached = false, context = [], note } = {}) {
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
  // WHAT THEY TOLD US SO FAR: a list that is anything else makes the record
  // unusable, never a shorter list.
  const told = readContext(context);
  if (told === null || told.length >= MAX_ASKED) return null;
  if (note !== undefined && (typeof note !== "string" || !note.trim() || note.trim().length > MAX_NOTE_CHARS)) return null;
  return {
    v: 2, id, uid, slug, stage, round, question: q, request: req, held: parts, at, status, attached, context: told,
    ...(note === undefined ? {} : { note: note.trim() }),
  };
}

/**
 * A REQUEST WITH NO QUESTION OFFERED: the question field taken off every tool
 * that has one — for a request already carrying `MAX_ASKED` answers, and for a
 * question asked `MAX_SAME_ASK` times. Its model acts on what it was told.
 */
export function stripQuestion(request) {
  if (!request || typeof request !== "object" || !Array.isArray(request.tools)) return request;
  let changed = false;
  const tools = request.tools.map((t) => {
    const schema = t && t.input_schema;
    const props = schema && schema.properties;
    if (!props || !Object.hasOwn(props, "question")) return t;
    changed = true;
    const { question: _drop, ...rest } = props;
    return { ...t, input_schema: { ...schema, properties: rest } };
  });
  return changed ? { ...request, tools } : request;
}

/** A reply to a request that offered no question: any question in it is not one, and is taken out. */
function dropQuestion(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : null;
  const asks = (b) => !!b && b.type === "tool_use" && !!b.input && typeof b.input === "object" && Object.hasOwn(b.input, "question");
  if (!blocks || !blocks.some(asks)) return reply;
  return {
    ...reply,
    content: blocks.map((b) => {
      if (!asks(b)) return b;
      const { question: _drop, ...rest } = b.input;
      return { ...b, input: rest };
    }),
  };
}

/**
 * EVERY MODEL CALL A STEP MAKES, WITH WHAT THEY ALREADY TOLD US (2026-10-02,
 * the owner's second review). `send` is the step's own transport; this wraps
 * it, so no step's request builder changes and no step can forget:
 *
 *   * each request is shown the answers this step needs (`shown`), in their
 *     own section after everything else it holds (`withContext`);
 *   * a reply that asks what this request already asked (`all`: every answer
 *     it carries, shown to this step or not) is not put to the customer — the
 *     model is sent the request again with that answer in front of it
 *     (`withReuse`), to act on it or ask a more specific question, and only
 *     that second reply is returned: the first call is ours and its usage is
 *     never billed;
 *   * a question already put to the customer `MAX_SAME_ASK` times is sent
 *     again with no question offered, and once the request carries
 *     `MAX_ASKED` answers no call is offered one (`stripQuestion`): a question
 *     in such a reply is taken out, never read.
 *
 * `onReuse(hit, closed)` hears each time a model was sent again, for the trace.
 */
export function clarifyTransport(send, { shown = () => [], all = () => [], onReuse = null } = {}) {
  return async (request) => {
    const every = readContext(all()) || [];
    const closed = every.length >= MAX_ASKED;
    let req = withContext(request, shown());
    if (closed) req = stripQuestion(req);
    const reply = await send(req);
    if (closed) return dropQuestion(reply);
    const ask = askOf(reply);
    const hit = ask ? repeatOf(every, ask) : [];
    if (!hit.length) return reply;
    const last = hit.length >= MAX_SAME_ASK;
    if (typeof onReuse === "function") { try { onReuse(hit, last); } catch { /* the trace never costs the call */ } }
    const second = await send(withReuse(last ? stripQuestion(req) : req, hit));
    return last ? dropQuestion(second) : second;
  };
}

/** The same, for a call shaped `(keys, request, budget)` — the page writer's. */
export function clarifyCall(call, opts) {
  return (keys, req, budget) => clarifyTransport((r) => call(keys, r, budget), opts)(req);
}

/** A stored question read back, with the same checks it was written under. */
export function readAskRecord(raw) {
  let v = raw;
  if (typeof raw === "string") { try { v = JSON.parse(raw); } catch { return null; } }
  if (!v || typeof v !== "object" || Array.isArray(v) || v.v !== 2) return null;
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
