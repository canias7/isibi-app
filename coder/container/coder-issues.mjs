/**
 * CLAUDE CODE'S WORDS FOR A CALL ITS SCHEMA REFUSED (its w0, 2.1.325, read from its program 2026-11-14; the model is told
 * "InputValidationError: " and these): from zod's issues, the missing parameters, the unexpected ones and those of the wrong
 * type, then the others ("is invalid: …", at most 20, each cut at 500 characters), headed "<Tool> failed due to the following
 * issue(s):"; with none of the first three, zod's own message, the issues themselves as JSON, two spaces deep. An issue is as
 * zod makes it: its fields in zod's order, then `path` and `message` (coder-webfetch.mjs and coder-websearch.mjs make theirs,
 * checked against Claude Code's own zod). The words themselves are coder-zodtext.mjs's (its issuesText), the one copy of them.
 * No Node module: any part of Coder may load it.
 */
import { issuesText, pathText, ISSUES_LISTED_MAX, ISSUE_MESSAGE_MAX } from "./coder-zodtext.mjs";
/** The formatter itself, and a parameter's path as Claude Code writes it (allowed_domains[1]): coder-zodtext.mjs's, the one copy. */
export { issuesText, pathText };
/** Claude Code's caps: the other issues listed, and each one's message. */
export const OTHER_MAX = ISSUES_LISTED_MAX, MESSAGE_MAX = ISSUE_MESSAGE_MAX;
// ── zod's issues, as Claude Code's own zod makes them ──────────────────────────
/** What zod calls a value it did not expect ("received number"). */
export const kindOf = (v) => (v === undefined ? "undefined" : v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" && Number.isNaN(v) ? "nan" : typeof v);
/** A value of the wrong kind, or a missing one ("received undefined"). */
export const typeIssue = (expected, value, path) => ({ expected, code: "invalid_type", path, message: "Invalid input: expected " + expected + ", received " + kindOf(value) });
/** Fields the schema does not have (a strict object's). */
export const keysIssue = (keys, path = []) => ({ code: "unrecognized_keys", keys, path, message: "Unrecognized key" + (keys.length > 1 ? "s" : "") + ": " + keys.map((k) => JSON.stringify(k)).join(", ") });
/**
 * A string's length as zod's min() counts it in Claude Code (one character for a pair of surrogates, when the string's
 * length is from the minimum up to twice it).
 */
export function minLengthOf(s, min) {
  const len = s.length;
  if (!(len >= min && len < min * 2) || !/[\uD800-\uDBFF]/.test(s)) return len;
  let n = len;
  for (let i = 0; i < len - 1; i++) if ((s.charCodeAt(i) & 0xfc00) === 0xd800 && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n--; i++; }
  return n;
}
/**
 * zod's min() issue, or null: it is checked on whatever has a length, a string (counted as above), and also a list given in
 * a string's place, beside its "expected string" issue, as Claude Code's own zod does.
 */
export function minLengthIssue(v, min, path) {
  if (v === null || v === undefined || v.length === undefined) return null;
  if ((typeof v === "string" ? minLengthOf(v, min) : v.length) >= min) return null;
  const origin = Array.isArray(v) ? "array" : typeof v === "string" ? "string" : "unknown";
  const unit = origin === "string" ? "characters" : origin === "array" ? "items" : "";
  return { origin, code: "too_small", minimum: min, inclusive: true, path, message: "Too small: expected " + origin + (unit ? " to have >=" + min + " " + unit : " to be >=" + min) };
}
