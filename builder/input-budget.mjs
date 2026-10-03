// HOW MUCH A CUSTOMER CAN SAY IN ONE MESSAGE ON A SITE THAT EXISTS, AND HOW
// MUCH ONE REQUEST CARRIES — one size policy for every hop (2026-10-03, the
// owner's first information-limits batch: *"remove the arbitrary
// 2,000-character request and 500-character clarification-answer restrictions
// throughout the affected browser, server, model-input, persistence, queue, and
// resume paths … Use a consistent technical size policy supported by actual
// request, storage, and model-context constraints, and document its rationale.
// Within that supported budget, preserve the complete input; beyond it,
// preserve the draft and pending state, explain the real constraint, and never
// execute a shortened request."*).
//
// TWO NUMBERS, AND EVERY HOP READS THESE TWO (the page mirrors them in
// public/edit-poll.js, held equal by test/input-budget.test.mjs):
//
//   MAX_INPUT_CHARS   — ONE MESSAGE of the conversation: a request, an answer
//                       to a question, a question the builder asks, or one of
//                       the answers it offers (a pressed answer is sent as the
//                       answer, so it is bounded as one).
//   MAX_CARRIED_CHARS — ONE REQUEST WITH EVERYTHING THAT RIDES WITH IT to every
//                       model that resumes it: the request still to do, the
//                       parts it put off, and every question asked about it
//                       with its answer (`carriedChars`).
//
// WHY THESE TWO NUMBERS — the real constraints, the binding one first:
//
//   1. A QUEUED JOB'S STORED ANSWER: 200,000 characters. `edit_finalize`
//      (worker.js) keeps that much of a job's answer, and a job's answer carries
//      its request and every answer back for its reply (`replyFor`, up to
//      MAX_CARRIED_CHARS); up to four message-sized copies of words that are not
//      new — the request's unfinished parts (`resume`, `deferred`, `putOff`) and
//      a question kept with its answers (`clarify`, and its words again on the
//      step's own entry); the site's pages and the reply (about 6,000); and the
//      rest of the answer — the largest of the 315 stored when this was set is
//      27,961 characters. 48,000 + 4 × 16,000 + 6,000 + 27,961 is about
//      146,000: over a quarter of the bound left over. THIS is what sets the
//      two numbers.
//   2. THE ROUTING ROUTE'S BODY: 2,000,000 bytes (`/api/site/route`). One
//      message is at most 6 bytes a character in JSON (an escaped control
//      character; most non-Latin text is 3): 96,000 bytes beside a page list
//      and table names.
//   3. THE MODELS' WINDOWS: 500,000 tokens at the smallest any picker reaches
//      (`MODEL_LIMITS` in build-models.mjs). The largest edit call is the page
//      writer's — up to 90,000 + 36,000 + 16,000 characters of page, parts and
//      stylesheet, about 47,000 tokens at this repo's 3 characters a token, and
//      a 30,000-token answer — and the carried whole is about 16,000 tokens
//      more. Under a fifth of the smallest window: not the constraint.
//   4. WHAT A MODEL COPIES BACK. The router copies a part it holds back word
//      for word (`alsoAsked`), and the lane picker copies each change's words
//      (`scopes`), so their output ceilings grow by the words they may copy
//      (`echoTokens`) — at 2 characters a token, 8,000 more for a message at
//      the bound, inside every picker's stated output limit (128,000 at the
//      smallest) and spent only when used.
//   5. MONEY AND TIME, which bound nothing here and are said so: every call that
//      carries the words is billed for them as every call is, so a message at
//      the bound costs more to route and edit than a short one — the balance is
//      still the only bound on money. Copying a long part back takes a model
//      time: 8,000 tokens is about 80 seconds at 100 a second, inside the
//      240-second quick call (`QUICK_CALL_MS`).
//
// BEYOND THEM, NOTHING IS CUT. The page keeps the words in the message box and
// says the number before anything is sent; the routes refuse at no cost, with a
// waiting question left as it was; no step is ever handed a shorter copy.
//
// WHERE A STEP HAS A SMALLER BOUND OF ITS OWN, it is that step's, and is said
// before the step runs: the full rewrite is the build's pipeline, which reads
// the first `REWRITE_MAX_CHARS` of a request (its held parts are found in that
// much, and its brief is that much), and the build is unchanged — so a longer
// request that needs a rewrite is held back with the reason, never rewritten
// from a shortened copy.
//
// THE FIRST BUILD IS UNTOUCHED: its message, its brief and its answers keep
// their own bounds (`MAX_MESSAGE` in site-ask.mjs, `siteAnswer` in the page).

/** One message: a request, an answer, a question the builder asks, or one answer it offers. */
export const MAX_INPUT_CHARS = 16000;

/** One request with everything it carries: the request, its put-off parts, every question and answer. */
export const MAX_CARRIED_CHARS = 48000;

/**
 * THE BUILD PIPELINE'S OWN READ OF A REQUEST: the full rewrite finds a climb's
 * held parts in the first this-many characters of the instruction and writes
 * from them (`buildHeld` in worker.js). Not raised, because the rewrite is the
 * build's pipeline; named here so the page can say it before a longer request
 * is sent there.
 */
export const REWRITE_MAX_CHARS = 4000;

/** How many characters a copied word costs at most, for output ceilings (a generous 2:1; this repo estimates 3:1). */
export const ECHO_CHARS_PER_TOKEN = 2;

/**
 * THE MOST ROOM ONE STEP'S LIST ANSWER IS GIVEN (2026-10-03, the mixed-work
 * fixes). With no count of changes left on the picture, menu, row and rules
 * steps, each step's ceiling grows with what it is shown (every picture, row,
 * table or link named once) — and is held to this. The constraint is TIME, not
 * the models' output caps (128,000 at the smallest): 16,000 tokens is about 160
 * seconds of writing at 100 a second, inside the 240-second quick call
 * (`QUICK_CALL_MS`). An answer that needs more is cut at the ceiling, and each
 * step refuses a cut answer whole and says so, at no cost — never half-applied.
 */
export const LIST_ANSWER_MAX_TOKENS = 16000;

/**
 * THE OUTPUT TOKENS A MODEL MAY NEED TO COPY THESE WORDS BACK: added to the
 * ceiling of a call whose answer quotes the customer (the router's held-back
 * parts, the picker's scoped words). A ceiling, not a charge: only the tokens
 * written are billed.
 */
export function echoTokens(...texts) {
  let longest = 0;
  for (const t of texts) {
    const n = typeof t === "string" ? t.length : 0;
    if (n > longest) longest = n;
  }
  return Math.ceil(longest / ECHO_CHARS_PER_TOKEN);
}

/**
 * WHAT ONE REQUEST CARRIES, IN CHARACTERS: the request still to do, every part
 * it put off, and every question asked about it with its answer. Anything that
 * is not text counts as nothing here; the readers of each field refuse it on
 * their own.
 */
export function carriedChars({ request = "", held = [], context = [] } = {}) {
  const len = (v) => (typeof v === "string" ? v.length : 0);
  let n = len(request);
  for (const p of Array.isArray(held) ? held : typeof held === "string" ? [held] : []) n += len(p);
  for (const p of Array.isArray(context) ? context : []) n += p && typeof p === "object" ? len(p.q) + len(p.a) : 0;
  return n;
}
