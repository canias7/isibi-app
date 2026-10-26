// A PART'S MODEL CALLS, MADE AHEAD AND ANSWERED AGAIN EXACTLY (2026-10-08,
// the parallel-tasks batch).
//
// A request's parts are written one at a time — the site's own lock allows one
// job per site — but their model calls need not wait for that. A part is
// PREPARED beside another part's job: its routing and its step run in the
// Worker with nothing written to the site, and every call it makes is recorded
// here, keyed by the exact request it sent. When the part's own job runs, each
// call whose request is byte for byte one that was prepared is answered from
// the record; any other is made then.
//
// THAT EQUALITY IS THE WHOLE SAFETY ARGUMENT. A step builds its request from
// what it reads of the site (the pictures' descriptions, the page's text, the
// menu), from its own words and from what the parts it needs did. When another
// part has changed any of that in the meantime, the request differs, nothing
// is answered from the record, and the step plans again against the site as it
// now is — a prepared answer is never applied to a site it was not made for.
// When nothing it reads has changed, the answer is the one it would get, made
// earlier.
//
// MONEY: a recorded answer keeps its usage, so the job that uses it bills it
// exactly as if the call were made then, once, through its own reserve. A
// preparation never charges; what it made that no job used is ours.
//
// PURE: hashing is the platform's `crypto.subtle`; the store is the caller's.

/** The fields of a model request that decide its answer; transport options (`stream`, `metadata`) do not. */
const DECIDING = ["model", "system", "messages", "tools", "tool_choice", "max_tokens", "temperature", "top_p", "top_k", "thinking", "stop_sequences", "response_format"];

/** Keys sorted all the way down, so two equal requests serialize the same whatever order their objects were built in. */
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonical(v[k]);
    return out;
  }
  return v;
}

/** The deciding fields of a request, and nothing else — what a fingerprint is taken over. */
export function decidingOf(req) {
  const pick = {};
  for (const k of DECIDING) if (req && Object.hasOwn(req, k) && req[k] !== undefined) pick[k] = req[k];
  return pick;
}

/** The request's fingerprint: SHA-256 over the deciding fields, canonical. */
export async function requestHash(req) {
  const pick = decidingOf(req);
  const text = JSON.stringify(canonical(pick));
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── AN ANSWER THAT ARRIVED IS NOT ALWAYS ONE THAT CAN BE GIVEN AGAIN ─────────
//
// (2026-10-11, the unusable-answer round, after Codex's review of 648964d5.)
// A transport that succeeded proves only that a reply came back. A reply the
// provider cut off at its token limit carries half a tool call; one it paused,
// or ran out of context on, is unfinished; an error body, or something that is
// not a reply at all, answered nothing. Codex showed the cost of replaying
// one: a component's designer answered with a cut-off reply beside another
// designer's question, the job rightly ended on the question, and after the
// customer's answer the identical request was answered from the cut-off
// record — the request failed and that designer was never asked again.
//
// So the boundary every recorded answer passes — recorded here, staged for a
// job, read back, replayed — judges each reply: a reply that cannot be given
// again is KEPT, with its verdict, for the record, and NEVER REPLAYED; its
// call is made again, through the job's own reserve and limits, like any call
// that has no recorded answer. A complete answer keeps its meaning whatever it
// says — a design, a question back, a refusal, prose that changes nothing are
// the model's answer and are replayed as before. Records stored before this
// rule carry no verdict; they are judged when read.

/** Provider stop reasons that mean the reply is unfinished (the xAI boundary reports `finish_reason: "length"` as `max_tokens`). */
const UNFINISHED = new Set(["max_tokens", "pause_turn", "model_context_window_exceeded"]);

/**
 * WHY THIS REPLY CANNOT BE GIVEN AGAIN, or "" when it can. Reads the reply's
 * shape and its stop reason only — never its words.
 */
export function unusableReply(reply) {
  if (!reply || typeof reply !== "object" || Array.isArray(reply)) return "not-a-reply";
  if (reply.type === "error" || (Object.hasOwn(reply, "error") && reply.error)) return "error";
  if (typeof reply.stop_reason === "string" && UNFINISHED.has(reply.stop_reason)) return "unfinished:" + reply.stop_reason;
  if (Object.hasOwn(reply, "content") && reply.content != null) {
    if (!Array.isArray(reply.content)) return "malformed";
    for (const b of reply.content) {
      if (!b || typeof b !== "object") return "malformed";
      if (b.type === "tool_use" && (!b.input || typeof b.input !== "object" || Array.isArray(b.input))) return "malformed";
    }
  }
  if (Array.isArray(reply.choices) && reply.choices.some((c) => c && c.finish_reason === "length")) return "unfinished:length";
  return "";
}

// ── AN ANSWER ITS STEP REJECTED IS NOT REUSABLE EITHER (2026-10-11, the
//    validation round, after Codex's review of fb50298e) ─────────────────────
//
// A reply can be complete at the provider and still unusable: a component
// placed on a page the site does not have passes `unusableReply` and is then
// refused by its step's own cleaner. Neither the provider's "done" nor an
// identical request proves such an answer can be given again — replayed, it
// is refused again, and the work never recovers. So the step that validates a
// reply MARKS it when it refuses it (`rejectReply`, with the step's own
// reason), and the recorder carries that verdict into the record exactly as
// it carries a cut-off: kept for diagnosis, never replayed. The mark is read
// when the record is written (the job's end, a preparation's save), so a
// refusal anywhere in the job — an early answer checked as it lands, a turn,
// a preparation — reaches every reader: staging, replay, continuation.
const REJECTED = new WeakMap();
/**
 * A step's own cleaner refused this reply: it is never given again. `facts`
 * (2026-10-13, correction reuse) are the refusal's own facts, never its
 * answer — see `readRefusal`. Facts that do not read are not kept.
 */
export function rejectReply(reply, why, facts) {
  if (!reply || typeof reply !== "object") return;
  REJECTED.set(reply, String(why || "rejected").slice(0, 80));
  const f = facts === undefined ? null : readRefusal(facts);
  if (f) REFUSAL_FACTS.set(reply, f); else REFUSAL_FACTS.delete(reply);
  // THE REPLY IT STANDS FOR (2026-10-26, explore-code): a step handed a copy
  // of the recorded answer (the explore loop's, with its looks taken out and
  // every round's usage summed) refuses the recorded one too, so the record
  // carries the verdict exactly as before.
  const orig = STANDS_FOR.get(reply);
  if (orig && orig !== reply) rejectReply(orig, why, facts);
}
const STANDS_FOR = new WeakMap();
/** `copy` is handed to a step in place of `original`, the reply the recorder kept. */
export function replyStandsFor(copy, original) {
  if (copy && typeof copy === "object" && original && typeof original === "object" && copy !== original) STANDS_FOR.set(copy, original);
}
/** Why a step refused this reply, or "". */
export const replyRejected = (reply) => (reply && typeof reply === "object" && REJECTED.get(reply)) || "";

// ── A REFUSAL'S FACTS GUIDE A REPLAY; ITS ANSWER NEVER DOES (2026-10-13,
//    correction reuse, on the owner's word) ──────────────────────────────────
//
// THE RULE ABOVE, AMENDED IN SCOPE AND NOWHERE ELSE: a refused or cut-off
// ANSWER is still never staged, replayed, handed to a continuation, shown to a
// model or applied. What a refusal adds to the record is its FACTS — what the
// step decided when it refused, all of which the live path already carries
// into its one correction:
//   feedback    the exact correction feedback the step sent
//   superseded  the requirement entries the refused answer listed (grounded
//               again in the customer's words by whoever reads them)
//   cleanIn     the digest of what the cleaner judged beyond the request
//               (`valueDigest`), so the refusal holds only where it was made
// A later job whose first request is byte for byte the refused one (its
// fingerprint, part section and all) and whose cleaner input digests the same
// may go straight to the recorded correction — which is still answered only
// by an exact match, and still validated by that job's own cleaner before
// anything is applied. Anything missing, malformed or different falls back
// to asking the model, exactly as before. Before this round run 141's paid
// correction was unreachable (`docs/history/2026-10-13-correction-reuse.md`).
const REFUSAL_FACTS = new WeakMap();
/** The longest correction feedback kept; a longer one is not kept (the job asks again). */
export const REFUSAL_FEEDBACK_MAX = 16000;
/** The most requirement entries a refusal's facts may carry; more are not kept. */
export const REFUSAL_REQ_MAX = 500;
/** The largest a refusal's facts may be, as JSON. */
export const REFUSAL_BYTES_MAX = 262144;
const HEX64 = /^[0-9a-f]{64}$/;
const plainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/**
 * A REFUSAL'S FACTS read strictly — `{ feedback, superseded, cleanIn }`, a
 * fresh copy, or null. Every field must read: feedback a non-empty string,
 * superseded a list (possibly empty) of plain objects, cleanIn a SHA-256 hex
 * digest; nothing beside them; bounded. Null is "no facts", never "a refusal
 * with nothing in it".
 */
export function readRefusal(v) {
  if (!plainObject(v)) return null;
  const keys = Object.keys(v).sort().join(",");
  if (keys !== "cleanIn,feedback,superseded") return null;
  if (typeof v.feedback !== "string" || !v.feedback || v.feedback.length > REFUSAL_FEEDBACK_MAX) return null;
  if (typeof v.cleanIn !== "string" || !HEX64.test(v.cleanIn)) return null;
  if (!Array.isArray(v.superseded) || v.superseded.length > REFUSAL_REQ_MAX || !v.superseded.every(plainObject)) return null;
  let text;
  try { text = JSON.stringify({ feedback: v.feedback, superseded: v.superseded, cleanIn: v.cleanIn }); } catch { return null; }
  if (typeof text !== "string" || text.length > REFUSAL_BYTES_MAX) return null;
  return JSON.parse(text);
}
/** The facts its step kept when it refused this reply, or null. */
export const replyRefusal = (reply) => (reply && typeof reply === "object" && REFUSAL_FACTS.get(reply)) || null;

/** Plain JSON values only, keys sorted; anything else (a Map, a function, NaN) throws — a digest that cannot be taken is no digest. */
function strictCanonical(v) {
  if (v === null || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") { if (!Number.isFinite(v)) throw new TypeError("not-json"); return v; }
  if (Array.isArray(v)) return v.map((x) => (x === undefined ? null : strictCanonical(x)));
  if (plainObject(v)) {
    const out = {};
    for (const k of Object.keys(v).sort()) if (v[k] !== undefined) out[k] = strictCanonical(v[k]);
    return out;
  }
  throw new TypeError("not-json");
}
/** SHA-256 over a plain JSON value, canonical (`cleanIn`); "" when it is not plain JSON — and "" never matches. */
export async function valueDigest(v) {
  let text;
  try { text = JSON.stringify(strictCanonical(v)); } catch { return ""; }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * WHAT A REPLAYER THROWS, never returns, for a call whose request is a refused
 * one — and only to a caller that declared it handles prior refusals
 * (`wrap(send, { refusals: true })`). It carries the refusal's facts and no
 * reply: a caller that does not handle it sees a failed call. `take()` is the
 * caller's acceptance — counted as `skipped`, and noted by any recorder the
 * call passed through, so a continuation carries the facts (never the answer).
 * A caller that declines simply asks again: nothing is counted.
 */
export class PriorRefusal extends Error {
  constructor(r, onTake) {
    super("prior-refusal");
    this.name = "PriorRefusal";
    this.h = r.h;
    this.why = r.why;
    this.facts = { feedback: r.feedback, superseded: r.superseded, cleanIn: r.cleanIn };
    this.takes = [onTake];
    this.taken = false;
  }
  also(fn) { this.takes.push(fn); }
  take() {
    if (this.taken) return null;
    this.taken = true;
    for (const f of this.takes) { try { f(); } catch { /* the record never costs the job */ } }
    return { why: this.why, ...JSON.parse(JSON.stringify(this.facts)) };
  }
}
/** The prior refusal a failed call carries, or null. */
export const priorRefusalOf = (e) => (e instanceof PriorRefusal ? e : null);

// ── WHAT A REQUEST PART'S MODEL CALL WAS SHOWN OF THE OTHER PARTS (2026-10-13,
//    after run 141) ─────────────────────────────────────────────────────────
//
// A step of one part is shown the whole message with every other part's words
// marked `⟦ANOTHER PART: …⟧` and a rule never to make them (`partBlock`,
// site-ask.mjs). Model inputs are not kept, so no run could show that a model
// received the markings. This is the smallest record that can: per call, read
// off the request exactly as sent, NUMBERS AND A NAME, NEVER TEXT —
//   what      the tool the call was made for (`tool_choice.name`)
//   others    how many other-part spans it carried, marked
//   rule      whether the rule sentence was there
//   unmarked  how many times another part's words appear in the request
//             outside a marking and outside the done list (must be 0)
//   done      how many earlier parts the done list reports
// A call with no part section is not a part's call and gives null.
export const PART_SECTION = "THE WHOLE REQUEST THIS PART CAME FROM";
export const PART_RULE = "THE WORDS MARKED ⟦ANOTHER PART: …⟧ ARE OTHER PARTS OF THE REQUEST";
const DONE_HEAD = "\nWHAT THE PARTS BEFORE THIS ONE DID, in order:\n";
const textOf = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.map((b) => (b && typeof b === "object" && typeof b.text === "string" ? b.text : typeof b === "string" ? b : "")).join("\n") : "");
const countIn = (hay, needle) => { if (!needle) return 0; let n = 0, at = hay.indexOf(needle); while (at >= 0) { n++; at = hay.indexOf(needle, at + needle.length); } return n; };
export function partMarks(req) {
  if (!req || typeof req !== "object") return null;
  const msgs = Array.isArray(req.messages) ? req.messages : [];
  const text = [textOf(req.system), ...msgs.map((m) => textOf(m && m.content))].join("\n");
  if (!text.includes(PART_SECTION)) return null;
  // THE RULE SENTENCE NAMES THE MARKING ITSELF ("⟦ANOTHER PART: …⟧"), so it
  // is taken out before the spans are read.
  const body = text.split(PART_RULE).join(" ");
  const spans = [...body.matchAll(/⟦ANOTHER PART: ([\s\S]*?)⟧/g)].map((m) => m[1].trim()).filter(Boolean);
  // THE DONE LIST REPORTS EARLIER PARTS' WORDS ON PURPOSE (they are done), so
  // it is counted apart and left out of the unmarked scan; it runs from its
  // heading to the end of the part section's text block.
  let rest = body.replace(/⟦ANOTHER PART: [\s\S]*?⟧/g, " ");
  let done = 0;
  const at = rest.indexOf(DONE_HEAD);
  if (at >= 0) {
    const tail = rest.slice(at + DONE_HEAD.length);
    const lines = tail.split("\n");
    let k = 0;
    while (k < lines.length && /^\d+\. “/.test(lines[k])) k++;
    done = k;
    rest = rest.slice(0, at) + "\n" + lines.slice(k).join("\n");
  }
  const unmarked = [...new Set(spans)].reduce((n, sp) => n + countIn(rest, sp), 0);
  // WHILE A STEP MAY LOOK (explore-code, 2026-10-26) it asks for any tool, its own first.
  const named = req.tool_choice && typeof req.tool_choice.name === "string" ? req.tool_choice.name : req.tool_choice && req.tool_choice.type === "any" && Array.isArray(req.tools) && req.tools[0] && typeof req.tools[0].name === "string" ? req.tools[0].name : "";
  const what = named.slice(0, 60);
  return { what, others: spans.length, rule: text.includes(PART_RULE), unmarked, done };
}

/** How many per-call marks a record keeps (a part's step makes a handful; a list this long is a loop). */
export const MARKS_KEPT = 100;

/**
 * Per-call marks read back strictly: a list of `partMarks` answers (with
 * `replayed` on a job's), at most MARKS_KEPT. Anything that does not read is
 * null — unknown, never "no markings".
 */
export function readMarks(v) {
  if (!Array.isArray(v) || v.length > MARKS_KEPT) return null;
  const whole = (x) => Number.isInteger(x) && x >= 0;
  const out = [];
  for (const m of v) {
    if (!m || typeof m !== "object" || typeof m.what !== "string" || m.what.length > 60 || !whole(m.others) || typeof m.rule !== "boolean" || !whole(m.unmarked) || !whole(m.done)) return null;
    if (Object.hasOwn(m, "replayed") && typeof m.replayed !== "boolean") return null;
    if (Object.hasOwn(m, "skipped") && m.skipped !== true) return null;
    out.push({ what: m.what, others: m.others, rule: m.rule, unmarked: m.unmarked, done: m.done, ...(Object.hasOwn(m, "replayed") ? { replayed: m.replayed } : {}), ...(m.skipped === true ? { skipped: true } : {}) });
  }
  return out;
}

/**
 * A RECORDER: `wrap(send)` makes every call as `send` would and keeps its
 * answer under its request's fingerprint; `image(generate)` keeps each picture
 * bought under the description it was bought for. A failed call is not kept —
 * its job makes it again. A reply that cannot be given again is kept with its
 * verdict (`unusable`), for the record only: it is never replayed.
 */
export function recorder() {
  const calls = [];
  const images = [];
  // WHAT EACH PART CALL WAS SHOWN OF THE OTHER PARTS (`partMarks`), in order;
  // numbers only, never part of an entry (an entry is its fingerprint and its
  // answer).
  const marks = [];
  // A REFUSAL TAKEN FROM AN EARLIER RECORD: its fingerprint, verdict and
  // facts, and no reply — the job never had the refused answer.
  const noteRefusal = (h, why, facts) => {
    const f = readRefusal(facts);
    if (typeof h !== "string" || !HEX64.test(h) || typeof why !== "string" || !why || !f) return;
    const entry = { h };
    Object.defineProperty(entry, "unusable", { value: "rejected:" + why, enumerable: false });
    Object.defineProperty(entry, "refusal", { value: f, enumerable: false });
    Object.defineProperty(entry, "toJSON", { value: () => ({ h, unusable: "rejected:" + why, refusal: f }), enumerable: false });
    calls.push(entry);
  };
  return {
    calls, images, marks,
    wrap(send) {
      return async (req) => {
        try { const m = partMarks(req); if (m && marks.length < MARKS_KEPT) marks.push(m); } catch { /* the record never costs the call */ }
        let reply;
        try { reply = await send(req); }
        catch (e) {
          // A PRIOR REFUSAL ITS CALLER TAKES is kept as facts with no answer,
          // so whatever reads this record next can take it too.
          if (e instanceof PriorRefusal) e.also(() => noteRefusal(e.h, e.why, e.facts));
          throw e;
        }
        try {
          const h = await requestHash(req);
          // THE VERDICT IS READ WHEN THE RECORD IS WRITTEN: a cut-off now, or a
          // refusal by the step that reads this reply later in the job.
          // THE VERDICT IS NOT A FIELD OF THE ENTRY: an entry is its
          // fingerprint and its answer, nothing else (no copy of the request
          // rides with it). It is read when asked (`unusable`) and when the
          // entry is written (`toJSON`), so a refusal made after the call is in
          // the stored record.
          const entry = { h, reply };
          const verdict = () => unusableReply(reply) || (replyRejected(reply) ? "rejected:" + replyRejected(reply) : undefined);
          // A REFUSAL'S FACTS ride only with a refusal by its step (never a cut-off).
          const facts = () => (unusableReply(reply) || !replyRejected(reply) ? null : replyRefusal(reply));
          Object.defineProperty(entry, "unusable", { get: verdict, enumerable: false });
          Object.defineProperty(entry, "refusal", { get: () => facts() || undefined, enumerable: false });
          Object.defineProperty(entry, "toJSON", { value: () => { const u = verdict(); const f = facts(); return u ? { h, reply, unusable: u, ...(f ? { refusal: f } : {}) } : { h, reply }; }, enumerable: false });
          calls.push(entry);
        } catch { /* an answer that cannot be kept is made again by the job */ }
        return reply;
      };
    },
    image(generate) {
      return async (describe, ...rest) => {
        const url = await generate(describe, ...rest);
        if (typeof url === "string" && url) images.push({ d: String(describe || ""), url });
        return url;
      };
    },
  };
}

/**
 * A prepared record read back: `{ calls, images, discarded }`, only what reads
 * — a malformed entry is dropped, never guessed. An entry whose reply cannot
 * be given again (marked when recorded, or judged now — a record stored before
 * the rule carries no mark) is left out of `calls` and named in `discarded`
 * (`{ h, why }`), so every reader — a job's staging, its replayer, the next
 * job's staging of what this one kept — gives its ANSWER to nobody.
 * AMENDED IN SCOPE ONLY (2026-10-13, correction reuse, on the owner's word):
 * a refusal by its step may carry its FACTS (`readRefusal`), read here into
 * `refusals` without the reply; they guide only a caller that handles prior
 * refusals, and only on an exact request match (see above `readRefusal`).
 */
export function readPrepared(raw) {
  let v = raw;
  if (typeof raw === "string") { try { v = JSON.parse(raw); } catch { return { calls: [], images: [], discarded: [], refusals: [] }; } }
  const ok = v && typeof v === "object" && !Array.isArray(v);
  const calls = [];
  const discarded = [];
  const refusals = [];
  for (const c of ok && Array.isArray(v.calls) ? v.calls : []) {
    if (!c || typeof c.h !== "string" || !/^[0-9a-f]{64}$/.test(c.h)) continue;
    const why = (typeof c.unusable === "string" && c.unusable) || unusableReply(c.reply);
    if (why) {
      discarded.push({ h: c.h, why });
      // ITS FACTS, NEVER ITS REPLY (2026-10-13): only a refusal by its step,
      // only facts that read (`readRefusal`); a record written before the
      // amendment has none, and yields none.
      if (why.startsWith("rejected:") && why.length > 9 && c.refusal !== undefined) {
        const f = readRefusal(c.refusal);
        if (f) refusals.push({ h: c.h, why: why.slice(9), ...f });
      }
      continue;
    }
    calls.push({ h: c.h, reply: c.reply });
  }
  const images = ok && Array.isArray(v.images) ? v.images.filter((i) => i && typeof i.d === "string" && typeof i.url === "string" && i.url) : [];
  return { calls, images, discarded, refusals };
}

/**
 * A RECORD TO STAGE for a job from what was read back (`readPrepared`): the
 * usable answers, the pictures, and each refusal as an entry with its facts
 * and NO REPLY — so the job's own read finds them exactly as written.
 */
export function stagedRecord(got) {
  const g = got && typeof got === "object" ? got : {};
  const calls = Array.isArray(g.calls) ? g.calls.map((c) => ({ h: c.h, reply: c.reply })) : [];
  for (const r of Array.isArray(g.refusals) ? g.refusals : []) {
    const f = readRefusal({ feedback: r.feedback, superseded: r.superseded, cleanIn: r.cleanIn });
    if (f && typeof r.h === "string" && HEX64.test(r.h) && typeof r.why === "string" && r.why) calls.push({ h: r.h, unusable: "rejected:" + r.why, refusal: f });
  }
  return { calls, images: Array.isArray(g.images) ? g.images : [] };
}

/**
 * AN ATTEMPT'S PURCHASE NOTES (2026-10-09), written before each purchase and
 * again when it ends: `{ d, state: "buying" }`, then `{ d, state: "bought",
 * url }` or `{ d, state: "none" }`. Read back strictly: a note that cannot be
 * read is the same as one still buying, its outcome unknown.
 */
export function readBuys(raw) {
  const list = raw && typeof raw === "object" && Array.isArray(raw.buys) ? raw.buys : [];
  return list.map((b) => {
    const d = b && typeof b.d === "string" ? b.d : "";
    if (b && b.state === "bought" && typeof b.url === "string" && b.url) return { d, state: "bought", url: b.url };
    // ANSWERED WITH NO PICTURE: the purchase ended, and nothing came of it.
    if (b && b.state === "none") return { d, state: "none" };
    return { d, state: "buying" };
  });
}

/** A purchase an attempt began and never saw end: its outcome is unknown, and it is not bought again by a preparation. */
export const unfinishedBuy = (raw) => readBuys(raw).find((b) => b.state === "buying") || null;

/**
 * A REPLAYER over what was prepared: `wrap(send)` answers a call from the
 * record when its fingerprint is one prepared and not yet used (each answer
 * once, in the order made), and otherwise makes it; `image(generate)` hands
 * back a picture bought for the same description. `used()` says how many of
 * each were answered from the record, for the job's trace.
 */
export function replayer(prepared) {
  const { calls, images, refusals } = readPrepared(prepared);
  const spent = new Set();
  const spentImg = new Set();
  const spentRef = new Set();
  let hits = 0, imageHits = 0, misses = 0, skipped = 0;
  // EVERY PART CALL'S MARKS, replayed or made now (`partMarks`): a replayed
  // call still forms its request, so what it would have shown is known.
  const marks = [];
  return {
    marks: () => marks.slice(),
    // `calls` answered exactly, `missed` made by a model now. NOTHING ELSE
    // REUSES AN ANSWER (2026-10-11, after Codex's review): a re-base that
    // carried an answer onto a changed request by judging the change
    // irrelevant was shown to carry a stale value; a step that may run beside
    // another is shown only its declared scope instead (`site-apply.mjs`
    // `scopedText`, `scopedData`), so its exact request is what its answer
    // rests on. `rebased` stays in the shape, always 0.
    used: () => ({ calls: hits, rebased: 0, images: imageHits, missed: misses }),
    // FIRST REQUESTS ANSWERED BY A PRIOR REFUSAL ITS CALLER TOOK (2026-10-13):
    // no model asked, no answer given; the correction that follows is counted
    // as any call. Apart from `used()`, whose shape is pinned (UA 0).
    skips: () => skipped,
    /**
     * MORE PREPARED CALLS, joined while the job runs (2026-10-11, the
     * generality round): a later step of the same job, prepared beside the
     * earlier ones, hands its recorded calls here before its turn. Read under
     * the same rule as everything else (`readPrepared`): an answer that cannot
     * be given again is never added.
     */
    add(more) {
      const got = readPrepared({ calls: Array.isArray(more) ? more : [] });
      for (const c of got.calls) calls.push(c);
      for (const r of got.refusals) refusals.push(r);
    },
    /**
     * IS THIS PICTURE ONE ITS PREPARATION BOUGHT? Such a picture sits in the
     * owner's uploads before the job places it, so a step that lists the
     * uploads hides it — it was not there when the preparation listed them,
     * and the list is part of the request the preparation's answer was made for.
     */
    hides: (url) => typeof url === "string" && images.some((i) => i.url === url),
    /**
     * WOULD THIS REQUEST BE ANSWERED FROM THE RECORD (2026-10-24)? Asked by
     * the question gate after a charge (`clarifyTransport`'s `replayHas`): a
     * call prepared before the charge, with its question field offered, is
     * replayed as prepared rather than sent again without it — the same exact
     * match `wrap` uses, nothing spent and nothing reused loosely.
     */
    // …AND A PRIOR REFUSAL RECORDED FOR IT (2026-10-24, auto-split's
    // charged-across-parts): sent as prepared, a caller that handles one skips
    // to the recorded correction as before (`wrap`'s `refusals`); sent without
    // its question field it matched nothing, and the job asked again.
    async has(req) {
      if (!calls.length && !refusals.length) return false;
      let h = "";
      try { h = await requestHash(req); } catch { return false; }
      return calls.some((c, i) => !spent.has(i) && c.h === h) || refusals.some((r, i) => !spentRef.has(i) && r.h === h);
    },
    // EVERY CALL IS COUNTED (2026-10-11, after Codex's review): with no
    // recorded call to match — a preparation that kept only pictures, or none —
    // each call is still made through here, so `missed` counts it. Returning
    // `send` itself left a fresh call uncounted beside `missed: 0`.
    //
    // A PRIOR REFUSAL ONLY FOR A CALLER THAT HANDLES ONE (`refusals: true`,
    // 2026-10-13): its request matched exactly, no usable answer recorded for
    // it, the refusal not yet spent — then the call is not made and no reply
    // is given; `PriorRefusal` is thrown with the facts. Every other caller
    // never sees a refusal: its call is made, as before.
    wrap(send, { refusals: handles = false } = {}) {
      return async (req) => {
        let m = null;
        try { m = partMarks(req); } catch { m = null; }
        let h = "";
        if (calls.length || (handles === true && refusals.length)) { try { h = await requestHash(req); } catch { h = ""; } }
        const at = h ? calls.findIndex((c, i) => !spent.has(i) && c.h === h) : -1;
        if (at < 0 && h && handles === true) {
          const ri = refusals.findIndex((r, i) => !spentRef.has(i) && r.h === h);
          if (ri >= 0) {
            spentRef.add(ri);
            if (m && marks.length < MARKS_KEPT) marks.push({ ...m, replayed: false, skipped: true });
            throw new PriorRefusal(refusals[ri], () => { skipped++; });
          }
        }
        if (m && marks.length < MARKS_KEPT) marks.push({ ...m, replayed: at >= 0 });
        if (at >= 0) { spent.add(at); hits++; return calls[at].reply; }
        misses++;
        return send(req);
      };
    },
    image(generate) {
      if (!images.length) return generate;
      return async (describe, ...rest) => {
        const d = String(describe || "");
        const at = images.findIndex((x, i) => !spentImg.has(i) && x.d === d);
        if (at >= 0) { spentImg.add(at); imageHits++; return images[at].url; }
        return generate(describe, ...rest);
      };
    },
  };
}

/** Where a part's preparation is kept, under its request: one record per preparation. */
export const prepKey = (slug, key, n, seq) => "requests/" + slug + "/" + key + "/prep/p" + n + "-" + seq + ".json";
/** Where a job's own share of a preparation is put before it runs, under the job's id (a key the job may read, wherever it runs). */
export const jobPrepKey = (id) => "jobs/prepared/" + id + ".json";

// ── ONE PURCHASE, WHOEVER MAKES IT (2026-10-09, round 3, after Codex's review) ──
//
// An attempt's own notes (`readBuys`) end at the preparation's edge. Codex
// showed what lies past it: a regular job that runs while a preparation's
// purchase is still out buys its own picture, the first one lands too, and the
// part is done with two photographs bought; and an attempt whose earlier
// record cannot be read took that as "nothing happened" and bought again.
//
// So a picture a request's part buys is ONE LOGICAL PURCHASE with one record,
// under the site's own source (`purchaseKey`), shared by every preparation
// attempt, every retake and the part's applying job wherever it runs. It is
// named by the part and by the picture's description and its place among the
// part's purchases of that description (`purchaseId`) — the same in a
// preparation and in the job, because they send the same step the same words.
//
//   absent      nobody has begun it: whoever writes `buying` first (a
//               conditional create) may buy it
//   buying      begun; its outcome is unknown until its buyer writes again.
//               Another reader never buys it: it looks for the stored picture
//               the purchase tags with its id, and otherwise the outcome is
//               UNKNOWN — held, never taken as permission to buy again
//   generated   the image service made it (2026-10-09, round 4): where it
//               holds the picture (`source`) is kept before the download, so a
//               download or store that failed is finished later on THAT
//               picture by whoever reads it next — never bought again
//   bought      landed: reused by everyone after, with its address
//   none        ended with no picture: it may be begun again
//   released    the customer said, knowing it may cost, to buy it again
//
// A record that cannot be read, or reads as none of these, is unknown too.

/** Where one logical purchase is recorded: under the site's source, which a job may read and write wherever it runs. */
export const purchaseKey = (slug, key, n, id) => "source/" + slug + "/purchases/" + key + "/p" + n + "-" + id + ".json";
/** The states a purchase record may hold. */
export const PURCHASE_STATES = Object.freeze(["buying", "generated", "bought", "none", "released"]);

/** A purchase's id: the part, the description, and which purchase of that description it is (0, 1, …). */
export async function purchaseId(slug, key, n, d, k) {
  const text = [String(slug), String(key), String(n), String(d || ""), String(k || 0)].join("\n");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

/**
 * A purchase record read back strictly, or null when it does not read as one —
 * which its readers take as unknown, never as absent.
 */
export function readPurchase(raw) {
  let v = raw;
  if (typeof raw === "string") { try { v = JSON.parse(raw); } catch { return null; } }
  if (!v || typeof v !== "object" || Array.isArray(v) || v.v !== 1 || !PURCHASE_STATES.includes(v.state)) return null;
  if (typeof v.id !== "string" || !/^[0-9a-f]{24}$/.test(v.id)) return null;
  if (v.state === "bought" && !(typeof v.url === "string" && v.url)) return null;
  if (v.state === "generated" && !(typeof v.source === "string" && /^https:\/\//.test(v.source))) return null;
  return {
    v: 1, id: v.id, state: v.state, d: typeof v.d === "string" ? v.d : "",
    by: typeof v.by === "string" ? v.by : "", at: Number.isFinite(v.at) ? v.at : 0,
    ...(v.state === "bought" ? { url: v.url } : {}),
    ...(v.state === "generated" ? { source: v.source } : {}),
    // HOW A PURCHASE ENDED WITH NOTHING (2026-10-11): its reason, read by
    // whoever meets that ending next.
    ...(v.state === "none" && typeof v.why === "string" && v.why ? { why: v.why.slice(0, 40) } : {}),
    ...(v.state === "none" && v.asked === false ? { asked: false } : {}),
  };
}
