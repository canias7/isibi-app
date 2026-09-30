// The route a paid press expects, and whether the router gave it.
//
// ── WHY THE CANARY NEEDS ONE (Batch 1, 2026-09-29) ─────────────────────────
//
// The paid canary refused an answer only when it was not an edit or named no
// layer, and then posted whatever the router said. So a test written as "the
// router answers `page` + `remove` for /gallery" had nothing holding it to that:
// a `nav` answer, another page, or a part held back would still have bought an
// edit, of another kind or on another page, to be judged afterwards against
// expectations it never met.
//
// OPT-IN AND GENERIC. The press writes the expectation as `key=value` pairs over
// the router's own fields; nothing here knows a site, a page or a sentence. AND
// IT NEVER CHANGES THE ANSWER: it decides only whether the answer is posted
// exactly as it came, or not posted at all.
//
// A MALFORMED EXPECTATION REFUSES BEFORE ANYTHING IS SPENT, so a typo such as
// `layer=dta` costs nothing, not a routing call that could never match.
import { ASK_TOOL, EDIT_LAYERS, ROUTE_FAILURE_KINDS, ROUTE_ERROR_CLASSES, providerCode } from "../builder/site-ask.mjs";

/** The router's intents, read from its own tool so the two cannot drift. */
const INTENTS = ASK_TOOL.input_schema.properties.intent.enum;
/** Fields read as strings. `none` (absent or empty) is for the two paths only:
 *  an answer with no intent or layer is refused before this check is reached. */
const TEXTS = ["intent", "layer", "page", "rename"];
/** Fields read as flags, the way the edit POST reads them: absent is false. */
const FLAGS = ["remove", "tab"];
/** What the router held back. Only `none` can be asked for: nothing held back. */
const HELD = "alsoAsked";
const KEYS = [...TEXTS, ...FLAGS, HELD];

/**
 * The form's box, read whole. Blank is no expectation; anything else must be
 * space-separated `key=value` pairs over KEYS, each key once.
 *
 * @returns {{ ok: true, expect: object | null } | { ok: false, msg: string }}
 */
export function readExpectRoute(raw) {
  if (raw === undefined || raw === null) return { ok: true, expect: null };
  if (typeof raw !== "string") return { ok: false, msg: "the expected route is not text" };
  const text = raw.trim();
  if (!text) return { ok: true, expect: null };
  const expect = {};
  for (const token of text.split(/\s+/)) {
    const m = /^([A-Za-z]+)=(\S+)$/.exec(token);
    if (!m) return { ok: false, msg: `"${token}" is not key=value` };
    const [, key, value] = m;
    if (!KEYS.includes(key)) return { ok: false, msg: `"${key}" is not a field the router answers (${KEYS.join(", ")})` };
    if (Object.hasOwn(expect, key)) return { ok: false, msg: `"${key}" is named twice` };
    if (FLAGS.includes(key)) {
      if (value !== "true" && value !== "false") return { ok: false, msg: `${key} is true or false, not "${value}"` };
      expect[key] = value === "true";
    } else if (key === HELD) {
      if (value !== "none") return { ok: false, msg: `${HELD} can only be none (nothing held back), not "${value}"` };
      expect[key] = null;
    } else if (key === "intent") {
      if (!INTENTS.includes(value)) return { ok: false, msg: `intent is one of ${INTENTS.join(", ")}, not "${value}"` };
      expect[key] = value;
    } else if (key === "layer") {
      if (!EDIT_LAYERS.includes(value)) return { ok: false, msg: `layer is one of ${EDIT_LAYERS.join(", ")}, not "${value}"` };
      expect[key] = value;
    } else if (value === "none") {
      expect[key] = null;
    } else if (!value.startsWith("/")) {
      return { ok: false, msg: `${key} is a path starting with "/", or none, not "${value}"` };
    } else {
      expect[key] = value;
    }
  }
  return { ok: true, expect };
}

/**
 * Whether the router's answer is the expected one, field by field, for the
 * fields the expectation names and no others.
 *
 * CANNOT-TELL IS A MISMATCH, NEVER A VALUE: a flag that is not a boolean and a
 * text field that is not a string are reported as unreadable, never coerced
 * (`String(["/gallery"])` is "/gallery").
 */
export function routeVerdict(expect, answer) {
  const a = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
  const diffs = [];
  for (const key of Object.keys(expect || {})) {
    const want = expect[key];
    const raw = Object.hasOwn(a, key) ? a[key] : undefined;
    let got;
    let readable = true;
    if (FLAGS.includes(key)) {
      if (raw === undefined || raw === null) got = false;
      else if (typeof raw === "boolean") got = raw;
      else readable = false;
    } else if (raw === undefined || raw === null || raw === "") {
      got = null;
    } else if (typeof raw === "string") {
      got = raw;
    } else {
      readable = false;
    }
    if (!readable) diffs.push({ key, want, got: raw, readable: false });
    else if (got !== want) diffs.push({ key, want, got, readable: true });
  }
  return { ok: diffs.length === 0, diffs };
}

const said = (v) => (v === null ? "none" : String(v));

/** The expectation in the form's own spelling, for the log. */
export function expectSaid(expect) {
  return KEYS.filter((k) => Object.hasOwn(expect || {}, k)).map((k) => `${k}=${said(expect[k])}`).join(" ");
}

/** One line per mismatch, for the refusal. */
export function mismatchSaid(verdict) {
  return (verdict && verdict.diffs ? verdict.diffs : []).map((d) => d.readable
    ? `${d.key}: expected ${said(d.want)}, the router answered ${said(d.got)}`
    : `${d.key}: expected ${said(d.want)}, the router answered ${JSON.stringify(d.got)}, which cannot be read as one`).join("; ");
}

/**
 * WHY THE ROUTING CALL FAILED, in one line for the log (Lane 1b, 2026-09-30).
 *
 * The route's `failure` is already built from allow-lists; this reads it again
 * the same way rather than trusting it, so a field of the wrong shape is left
 * out and never coerced, and an answer with no readable reason says so instead
 * of printing a guess. `routing.json` keeps the object itself.
 */
export function failureSaid(f) {
  if (!f || typeof f !== "object" || Array.isArray(f) || !ROUTE_FAILURE_KINDS.includes(f.kind)) return "no reason given";
  const bits = [f.kind];
  if (f.provider === "xai" || f.provider === "anthropic") bits.push(f.provider);
  if (Number.isInteger(f.status) && f.status >= 100 && f.status <= 599) bits.push(String(f.status));
  // A code only from its own provider's table: a press from the branch reads
  // main's Worker too, so this line never trusts the answer's shape alone.
  const code = providerCode(f.provider, f.type);
  if (code) bits.push(code);
  // The plain `Error` says nothing a reader can use; a named class does.
  if (typeof f.error === "string" && f.error !== "Error" && ROUTE_ERROR_CLASSES.includes(f.error)) bits.push(f.error);
  return bits.join(" ") + (f.billing === true ? " — refused on our account (billing or key)" : "");
}
