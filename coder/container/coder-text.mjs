/**
 * SAFE TEXT AND NUMBERS FROM A TOOL CALL'S INPUT (2026-11-19): a value that cannot become text, like {"toString":1}, is
 * never let throw. Text stays as it is; anything else is its JSON, or "" when even that fails.
 */
export function asText(v) {
  if (typeof v === "string") return v;
  if (v === undefined || v === null) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { const j = JSON.stringify(v); return typeof j === "string" ? j : ""; } catch { return ""; }
}
/** A number from a tool's input: a number, or text of one; NaN otherwise (never a throw). */
export const asNumber = (v) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN);
