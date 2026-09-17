/**
 * WHICH SCHEMA A PostgREST REQUEST NAMES — one rule, keyed on the HTTP METHOD.
 *
 * ⚠ **THE PROFILE NAMES THE RELATION, NOT A BODY, AND THE DIRECTION IT SPLITS ON IS THE
 * HTTP METHOD RATHER THAN WHAT THE DATABASE FUNCTION DOES.** `Accept-Profile` is honoured
 * on `GET` and `HEAD`; `Content-Profile` on everything else. **Every PostgREST RPC is a
 * POST**, however purely the function behind it reads — so a "read" RPC sent with
 * `Accept-Profile` has no profile at all as far as PostgREST is concerned and resolves
 * against the default schema, where these functions do not exist.
 *
 * MEASURED before this module existed: **10 of the 14 capability operations sent
 * `accept-profile` on a POST**, among them the `read_automation` pre-check that
 * `pause_automation` and `run_automation` each make first — so on a real PostgREST those
 * two would have failed at their own first step. The site builder's `agent-store.mjs` had
 * the same defect in its DELETE and it is recorded there; this is the same mistake one
 * product over, and the reason it kept happening is that each store decided for itself
 * with a flag named for the FUNCTION's behaviour (`write`) rather than for the request's.
 *
 * **SO THE RULE LIVES HERE AND NOWHERE ELSE.** Five stores speak to PostgREST and all five
 * ask this; `test/capabilities.test.mjs` censuses the source for any that decides on its
 * own again. A flag a call site can forget is a flag a call site will forget — the four
 * capability operations that happened to be right were right because somebody remembered,
 * and the ten that were wrong are what remembering is worth.
 */

/** The verbs PostgREST honours `Accept-Profile` on. Everything else is a write, to it. */
export const READ_VERBS = Object.freeze(["GET", "HEAD"]);

/**
 * The header NAME this method's schema belongs in.
 *
 * **AN UNREADABLE METHOD ANSWERS THE WRITE HEADER**, which is the fail-closed direction:
 * `Content-Profile` is ignored on a GET and costs nothing, while `Accept-Profile` on a
 * POST silently loses the schema — so being wrong the other way is the expensive one.
 *
 * ⚠ **AND A NON-STRING IS NOT COERCED, which this function got wrong on its first draft.**
 * `String(["GET"])` is `"GET"`, so a one-element array answered the READ header — this
 * repository's most-repeated value trap, in the four lines written to close a different
 * instance of the same class. A method is a string or it is unreadable.
 */
export function profileHeader(method) {
  if (typeof method !== "string") return "content-profile";
  return READ_VERBS.includes(method.toUpperCase()) ? "accept-profile" : "content-profile";
}

/** `{ "accept-profile": schema }` or `{ "content-profile": schema }`, ready to spread. */
export function profileFor(method, schema) {
  return { [profileHeader(method)]: schema };
}
