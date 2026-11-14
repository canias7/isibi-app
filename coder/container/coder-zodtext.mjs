/**
 * CLAUDE CODE'S WORDS FOR A TOOL INPUT ITS SCHEMA REFUSES (its own formatter, 2.1.325's `w0`; the owner, 2026-11-14: "Fix
 * base on Claude Code docs, please"), and the issues of zod 4.6.2 (the zod Claude Code is built with) as zod writes them.
 *
 * A call whose input its schema refuses gets "InputValidationError: " and then, when a parameter is missing, unexpected or of
 * the wrong type: "<Tool> failed due to the following issue(s):" with those lines first and the other issues after them (at
 * most 20, each message cut at 500 characters); when only values are wrong (no such parameter): zod's own message, the issues
 * as JSON ("InputValidationError: [ … ]").
 *
 * No Node module here: Coder's Worker loads plan mode's words (coder-plan.mjs, through coder-perms.mjs), which use this file.
 * The one copy of these words: coder-zod.mjs (hooks, grep, glob), coder-issues.mjs (web_fetch, web_search) and coder-lsp.mjs
 * use this formatter (2026-11-14).
 */

/** Claude Code's caps: the other issues listed (its Aun), and each one's message (its Ogr). */
export const ISSUES_LISTED_MAX = 20;
export const ISSUE_MESSAGE_MAX = 500;
/** Its marker on a custom issue whose message is for the model (listed last, and never left as zod's JSON). */
export const MODEL_FACING = "modelFacingMessage";

/** A parameter's path as Claude Code writes it (its kRe): questions[0].options. */
export const pathText = (p) => (Array.isArray(p) ? p : []).reduce((s, x, i) => (typeof x === "number" ? s + "[" + x + "]" : i === 0 ? String(x) : s + "." + String(x)), "");
/** Claude Code's cut of a long text (its pl): the first `n` characters (never half a surrogate pair), "…" and how many more. */
export function cutText(t, n) {
  const s = String(t);
  if (s.length <= n) return s;
  let head = n <= 0 ? "" : s.slice(0, n);
  const last = head.charCodeAt(head.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) head = head.slice(0, -1);
  return head + "… [+" + (s.length - head.length) + " chars]";
}
/** zod 4's "received …" (its parsedType): NaN, null, array, or the value's typeof. */
export const receivedKind = (v) => (v === undefined ? "undefined" : v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" && Number.isNaN(v) ? "NaN" : typeof v);
/** zod's way of writing one value in a message (its stringifyPrimitive). */
const shown = (v) => (typeof v === "bigint" ? v.toString() + "n" : typeof v === "string" ? '"' + v + '"' : String(v));

// ── ZOD 4.6.2'S ISSUES, key for key in its order (each one checked against zod itself in the tests) ───────────────────────
/** A value of the wrong type ("Invalid input: expected string, received number"); undefined: a missing parameter. */
export const typeIssue = (expected, input, path) => ({ expected, code: "invalid_type", path, message: "Invalid input: expected " + expected + ", received " + receivedKind(input) });
/** Keys a strict object does not know. */
export const unknownKeysIssue = (keys, path = []) => ({ code: "unrecognized_keys", keys, path, message: "Unrecognized key" + (keys.length > 1 ? "s" : "") + ": " + keys.map((k) => JSON.stringify(k)).join(", ") });
/** A list or a text under its minimum (`custom`: the schema's own message, as TodoWrite's "Content cannot be empty"). */
export const tooSmallIssue = (origin, minimum, path, custom = "") => ({ origin, code: "too_small", minimum, inclusive: true, path, message: custom || "Too small: expected " + origin + sized(origin, ">=", minimum) });
/** A list or a text over its maximum. */
export const tooBigIssue = (origin, maximum, path, custom = "") => ({ origin, code: "too_big", maximum, inclusive: true, path, message: custom || "Too big: expected " + origin + sized(origin, "<=", maximum) });
/** zod's sizing words: a list's items, a text's characters, else "to be" (its getSizing). */
const sized = (origin, adj, n) => (origin === "array" || origin === "set" ? " to have " + adj + n + " items" : origin === "string" ? " to have " + adj + n + " characters" : " to be " + adj + n);
/** A value outside an enum or a literal ("Invalid option: expected one of …", or one value: "Invalid input: expected …"). */
export const valueIssue = (values, path) => ({ code: "invalid_value", values: [...values], path, message: values.length === 1 ? "Invalid input: expected " + shown(values[0]) : "Invalid option: expected one of " + values.map(shown).join("|") });
/** A value no option of a union takes: each option's own issues (their paths from the value), "Invalid input". */
export const unionIssue = (errors, path) => ({ code: "invalid_union", errors, path, message: "Invalid input" });
/** A refinement's issue (a schema's own check, with its message). */
export const customIssue = (message, path = [], params) => ({ code: "custom", path, message, ...(params ? { params } : {}) });

/** zod's own message for its error: the issues as JSON, two spaces (its jsonStringifyReplacer: a bigint as text). */
export const zodMessage = (issues) => JSON.stringify(issues, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

/**
 * CLAUDE CODE'S w0, word for word: the missing parameters, the unexpected ones, those of the wrong type, then the other
 * issues ("The parameter `x` is invalid: …", "… matches none of the accepted forms" for a union with no message left, at most
 * 20 and "(N more issues not listed)"), then the model-facing custom ones; with none of the first three and no model-facing
 * one, zod's own message.
 */
export function issuesText(tool, issues) {
  const list = Array.isArray(issues) ? issues : [];
  const msg = (x) => (typeof x.message === "string" ? x.message : "");
  const isFacing = (x) => x.code === "custom" && !!x.params && x.params[MODEL_FACING] === true;
  const missing = list.filter((x) => x.code === "invalid_type" && msg(x).includes("received undefined")).map((x) => pathText(x.path));
  const unexpected = list.filter((x) => x.code === "unrecognized_keys").flatMap((x) => (Array.isArray(x.keys) ? x.keys : []).map((k) => pathText([...(x.path || []), k])));
  const wrong = list.filter((x) => x.code === "invalid_type" && !msg(x).includes("received undefined")).map((x) => ({ param: pathText(x.path), expected: x.expected, received: (/received (\w+)/.exec(msg(x)) || [])[1] || "unknown" }));
  const facing = list.filter(isFacing).map(msg);
  const other = list.filter((x) => x.code !== "invalid_type" && x.code !== "unrecognized_keys" && !isFacing(x)).map((x) => {
    const p = pathText(x.path), who = p === "" ? "The input" : "The parameter `" + p + "`";
    const why = cutText(msg(x).replace(/^Invalid input(?:: |$)/, ""), ISSUE_MESSAGE_MAX);
    if (why !== "") return who + " is invalid: " + why;
    return x.code === "invalid_union" ? who + " matches none of the accepted forms" : who + " is invalid";
  });
  const lines = [];
  lines.push(...missing.map((p) => "The required parameter `" + p + "` is missing"));
  lines.push(...unexpected.map((p) => "An unexpected parameter `" + p + "` was provided"));
  lines.push(...wrong.map((w) => "The parameter `" + w.param + "` type is expected as `" + w.expected + "` but provided as `" + w.received + "`"));
  if (!lines.length && !facing.length) return zodMessage(list);
  lines.push(...other.slice(0, ISSUES_LISTED_MAX));
  const more = other.length - ISSUES_LISTED_MAX;
  if (more > 0) lines.push("(" + more + " more " + (more === 1 ? "issue" : "issues") + " not listed)");
  lines.push(...facing);
  return tool + " failed due to the following " + (lines.length > 1 ? "issues" : "issue") + ":\n" + lines.join("\n");
}
/** What Coder is told of a refused call (Claude Code's "InputValidationError: " and its steer, then w0), as Coder's failed calls start. */
export const inputErrorText = (tool, issues, steer = "") => "error: InputValidationError: " + (steer ? steer + "\n\n" : "") + issuesText(tool, issues);
