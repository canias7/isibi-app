// How full the model's context window was, and what filled it.
//
// Owner, 2026-09-13, holding up Claude Code's own context panel — a bar reading
// `527.1k / 1M (53%)` over a breakdown by part: "KINDA WANT SOMETHING LIKE THIS
// THAT TRACKS THE CONTEXT WINDOW THING."
//
// MEASURED OFF THE REQUEST OBJECT, NEVER OFF THE PIECES THAT BUILT IT. The
// design call assembles `{tools, system, messages}` and then bills from
// `req.model` precisely so that "what we billed" and "what we sent" cannot
// disagree; this reads the same object for the same reason. Count the brief and
// the tool separately at their call sites and the report drifts the first time
// somebody adds a fourth thing to the message — and it drifts SILENTLY, because
// a breakdown that is short by one part still adds up to something plausible.
//
// ── THE ONE THING THIS MODULE IS HONEST ABOUT ───────────────────────────────
//
// THE TOTAL IS EXACT AND THE PARTS ARE ESTIMATED, and the report says which is
// which rather than presenting one number in two accuracies. There is no
// tokenizer here — for either provider — so a part's share is measured in
// CHARACTERS. What rescues it is that the provider hands back the real input
// total on every call (`usage`, which is already what billing is metered on), so
// the parts are scaled to sum to that exact number. The percentages are then
// sound even though no single part's absolute count is.
//
// A caller with no usage (a call that failed, a record from before this shipped)
// gets `exact: false` and the raw character-derived estimate. It must be drawn
// differently — a panel that presents an estimate as a measurement is this
// repository's own SEO-tab finding, where three hardcoded claims about a
// customer's business read as facts.
//
// CHARACTERS PER TOKEN IS THIS REPOSITORY'S OWN 3, not a new guess:
// `laneMaxTokens` already derives every lane's ceiling at three characters per
// token because "SVG and CSS tokenise worse than prose", and everything measured
// here is JSON schema, TSX and CSS rather than prose. It is only ever used when
// there is no exact total to scale against, and it is exported so the one number
// has one home.
export const CHARS_PER_TOKEN = 3;

/**
 * The character weight of each part of one model request.
 *
 * Anthropic-shaped, which is every request this platform makes internally —
 * `model-xai.mjs` translates at the provider boundary, so a Grok call is this
 * shape right up until it leaves.
 *
 * FOUR PARTS, NAMED FOR WHAT A PERSON WOULD CALL THEM rather than for the API
 * field they live in: `tools` is the design tool or the page tool, `system` the
 * cached rules block, `message` the brief and everything folded into it, and
 * `attachments` the customer's own files, which ride as content blocks and are
 * the one part a customer can grow without us doing anything.
 *
 * An absent part is 0 and is KEPT, never dropped: a panel that omits an empty
 * row cannot say "this build attached nothing", which is a different statement
 * from "this build was not measured".
 */
export function requestParts(req) {
  if (!req || typeof req !== "object") return { tools: 0, system: 0, message: 0, attachments: 0 };

  const tools = req.tools ? JSON.stringify(req.tools).length : 0;

  // The system block is a string on some calls and a list of cached blocks on
  // others. Both shapes are live in this codebase today.
  let system = 0;
  if (typeof req.system === "string") system = req.system.length;
  else if (Array.isArray(req.system)) {
    for (const b of req.system) system += typeof b?.text === "string" ? b.text.length : 0;
  }

  // The user message is a plain STRING when nothing is attached and a list of
  // blocks when something is — `designSiteSchema` says so in as many words, and
  // keeping both shapes is what stops an attachment missing the cached prefix.
  let message = 0;
  let attachments = 0;
  for (const m of Array.isArray(req.messages) ? req.messages : []) {
    const c = m?.content;
    if (typeof c === "string") message += c.length;
    else if (Array.isArray(c)) {
      for (const b of c) {
        if (b?.type === "text" && typeof b.text === "string") message += b.text.length;
        // An image or a PDF is bytes, not text. Its character length is a poor
        // proxy for its token cost and a base64 payload would otherwise swamp
        // every other part of the chart — so it is counted apart and the report
        // says it is approximate even among approximations.
        else attachments += JSON.stringify(b || null).length;
      }
    }
  }
  return { tools, system, message, attachments };
}

/**
 * The exact input tokens one call really cost, out of the provider's own answer.
 *
 * ALL THREE KINDS COUNT TOWARD THE WINDOW. `input_tokens` EXCLUDES cached reads
 * on Anthropic — `model-xai.mjs` carries a whole comment about that asymmetry,
 * because passing OpenAI's inclusive `prompt_tokens` through as `in` once
 * overcharged every cached token at full price. Billing prices the three apart;
 * the CONTEXT WINDOW does not care what anything cost, only how much text the
 * model had to hold, so here they are summed.
 *
 * Answers `null` when there is no usage to read, which a caller must not read as
 * zero — zero is a call that sent nothing.
 */
export function exactInputTokens(usage) {
  if (!usage || typeof usage !== "object") return null;
  const n = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const total = n(usage.input_tokens) + n(usage.cache_read_input_tokens) + n(usage.cache_creation_input_tokens);
  // A usage object that carried none of the three fields is not a measurement of
  // zero, it is an absence — the recorded "cannot-tell must never read as
  // nothing-there", which has cost this repository five separate bugs.
  const sawOne = ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"].some(
    (k) => typeof usage[k] === "number" && Number.isFinite(usage[k]),
  );
  return sawOne ? total : null;
}

/**
 * One call's context report: how full the window was, and what filled it.
 *
 * `window` comes from the caller (it is `contextWindow(model)` in practice, kept
 * as a parameter so this module stays dependency-free and drivable). A `null`
 * window means we do not know this model, and then there is no percentage — NOT
 * a percentage of a guessed denominator, which would be a number that looks
 * measured and is invented.
 */
export function contextReport({ name = "", model = "", window = null, req = null, usage = null } = {}) {
  const chars = requestParts(req);
  const totalChars = chars.tools + chars.system + chars.message + chars.attachments;
  const exact = exactInputTokens(usage);

  // THE RECONCILIATION, and it is the whole point of the module. With an exact
  // total, each part takes its own share of it, so the parts sum to the number
  // the provider charged for. Without one, each part is divided by the 3:1
  // estimate and the report is flagged.
  const scale = exact !== null && totalChars > 0 ? exact / totalChars : 1 / CHARS_PER_TOKEN;
  const parts = [];
  for (const key of ["tools", "system", "message", "attachments"]) {
    const c = chars[key];
    parts.push({
      name: key,
      chars: c,
      tokens: Math.round(c * scale),
      // Of the CALL, not of the window: a part is a share of what was sent, and
      // a reader comparing two builds wants that share to be stable when the
      // window changes under them.
      share: totalChars > 0 ? c / totalChars : 0,
    });
  }

  const tokens = exact !== null ? exact : Math.round(totalChars / CHARS_PER_TOKEN);
  const usable = typeof window === "number" && Number.isFinite(window) && window > 0;
  return {
    name,
    model,
    window: usable ? window : null,
    tokens,
    exact: exact !== null,
    // `null` rather than 0 for an unknown model: a bar drawn at 0% says "nothing
    // was sent", which is the opposite of "we cannot say".
    used: usable ? tokens / window : null,
    parts,
  };
}

/**
 * The whole of one build or edit: every call that reported, and the fullest.
 *
 * THE FULLEST CALL IS THE HEADLINE, and that is a decision rather than an
 * average. A build makes many calls — the design step can be sixteen agents and
 * the page step nine — so "how full was the context window" has no single answer
 * across them. What a person actually wants to know is how close the worst one
 * came to the wall, because that is the one that will fail first. An average
 * would hide exactly the call worth seeing.
 *
 * `calls` is kept in the order it was recorded, which is run order, so the panel
 * can list them as they happened rather than sorting the story away.
 */
export function contextSummary(calls) {
  const list = Array.isArray(calls) ? calls.filter((c) => c && typeof c === "object") : [];
  if (!list.length) return { calls: [], fullest: null, tokens: 0, exact: false };

  let fullest = null;
  for (const c of list) {
    if (typeof c.used !== "number") continue;
    if (!fullest || c.used > fullest.used) fullest = c;
  }
  // With no usable percentage anywhere — every call on an unknown model — fall
  // back to the largest by raw tokens, which is still the right call to show and
  // is honest about having no denominator.
  if (!fullest) {
    for (const c of list) {
      if (!fullest || (c.tokens || 0) > (fullest.tokens || 0)) fullest = c;
    }
  }
  return {
    calls: list,
    fullest,
    tokens: list.reduce((sum, c) => sum + (typeof c.tokens === "number" ? c.tokens : 0), 0),
    // The whole record is only as exact as its weakest call: one estimated call
    // in the list means the total is an estimate, and saying otherwise would put
    // a measured-looking number over a guess.
    exact: list.every((c) => c.exact === true),
  };
}
