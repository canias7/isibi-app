/**
 * REFERENCES — `{{name}}` in a step's text, resolved from the execution's own values.
 *
 * Its own module because THREE places need it and none of them may hold a second
 * copy: `readWorkflow` refuses a reference nothing can produce, `runWorkflow`
 * substitutes at run time, and the site builder's route validates a saved workflow
 * before it reaches the database. A second implementation of the same syntax is how
 * a name that saves cleanly fails at run time for a reason nobody can see.
 *
 * **THE SYNTAX IS DELIBERATELY SMALL: a name, and nothing else.** No expressions, no
 * property paths, no defaults, no filters. Every one of those is a language, and a
 * language in a text box is something to parse, to bound and to get wrong — and the
 * thing a customer actually wants is "put the topic I typed in here".
 */

/** What a name may be, and it is the identifier rule the rest of this product uses. */
export const REF_NAME = /^[a-z][a-z0-9_]{0,39}$/;

/** `{{ name }}`, with whitespace inside the braces tolerated because people type it. */
const REF = /\{\{\s*([^{}]*?)\s*\}\}/g;

/**
 * Every name a piece of text refers to, in order, without duplicates.
 *
 * **A MALFORMED REFERENCE IS NOT A REFERENCE AND IS NOT AN ERROR EITHER.**
 * `{{ }}`, `{{a b}}` and `{{Name}}` match the braces and not the name rule, so they
 * are left alone as literal text — which is the only reading that lets somebody write
 * about braces. What is NOT tolerated is a well-formed name nothing can produce, and
 * that is the caller's check below.
 */
export function refsIn(text) {
  const out = [];
  if (typeof text !== "string") return out;
  for (const m of text.matchAll(REF)) {
    const name = m[1];
    if (REF_NAME.test(name) && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Substitute from a flat map of values.
 *
 * **AN UNKNOWN NAME IS NAMED AND NEVER SUBSTITUTED WITH NOTHING.** A note that
 * quietly became "Prepared a summary of " for a customer is worse than a step that
 * failed saying `topic`: the first is a thing they will send to somebody. So the
 * answer is `{missing}` and the caller decides — and the caller here always fails the
 * step, because a partial answer is the one outcome with no way back.
 *
 * `Object.hasOwn`, never truthiness and never `in`: an empty string is a real value a
 * person can have typed, and `{{constructor}}` must not resolve to a function.
 */
export function fillRefs(text, values) {
  if (typeof text !== "string") return { text: "", missing: [] };
  const missing = [];
  const bag = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const filled = text.replace(REF, (whole, raw) => {
    const name = String(raw).trim();
    if (!REF_NAME.test(name)) return whole;
    if (!Object.hasOwn(bag, name)) {
      if (!missing.includes(name)) missing.push(name);
      return whole;
    }
    return valueText(bag[name]);
  });
  return { text: filled, missing };
}

/**
 * What a stored value reads as inside a sentence.
 *
 * **REFUSED-SHAPED RATHER THAN COERCED, and the one coercion left is deliberate.**
 * `String(["a"])` is `"a"`, which is this repository's most-repeated value trap, so a
 * list and an object read as empty rather than as their first element or as
 * `[object Object]`. A number and a boolean DO read as themselves, because a step that
 * binds a count and a sentence that quotes it is the ordinary case.
 */
export function valueText(v) {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return "";
}
