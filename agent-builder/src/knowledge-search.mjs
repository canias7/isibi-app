/**
 * WHAT A KNOWLEDGE SEARCH ANSWERED — one reading, for every reader of it.
 *
 * ⚠ **ITS OWN FILE BECAUSE THREE MODULES READ THAT ANSWER AND MUST NOT DISAGREE ABOUT WHAT
 * AN ABSENCE MEANS.** `capabilities.mjs` reads it for an agent's own tools,
 * `automation-store.mjs` reads it for a workflow's `retrieve` seam, and `automations.mjs`
 * turns it into the sentence a person reads in an execution's history. Neither store may
 * import the other and `automations.mjs` is deliberately dependency-light, so the choices are
 * one tiny module or three readings that agree until one is edited — which is the shape
 * `rest-profile.mjs` and `workflow-refs.mjs` already take for the same reason.
 *
 * **NOTHING HERE ASKS ANYBODY ANYTHING.** It is pure, so every branch is drivable with no
 * database, and a caller hands it whatever came back — junk included.
 */

/**
 * The four things a search can have answered, and `unknown` for a reading that cannot say.
 *
 * ⚠ **THEY ARE FOUR BECAUSE COLLAPSING ANY TWO MISLEADS IN A DIFFERENT DIRECTION**, and this
 * is the whole of why the database answers `searched` and `sources` at all:
 *
 *   * `matched`      — passages came back.
 *   * `no-match`     — this agent HAS reference material and none of it matched. A fact about
 *                      the documents, and the only one of the four that is.
 *   * `no-sources`    — the search ran and this agent has nothing to search. Nothing is wrong
 *                      with the query, and telling somebody their documents do not mention
 *                      something they have never uploaded sends them to read documents that
 *                      are not there.
 *   * `not-searched` — there was nothing searchable in the ask (a blank, or a phrase made
 *                      entirely of stopwords). About the QUERY, which a caller can fix.
 *   * `unknown`      — the answer did not say. Cannot-tell must never read as a value, and
 *                      the value it would be read as here is "your documents do not match".
 */
export const SEARCH_OUTCOMES = Object.freeze([
  "matched", "no-match", "no-sources", "not-searched", "unknown",
]);

/**
 * The answer, as this repository's readers need it.
 *
 * ⚠ **`searched` AND `sources` ARE `null` WHEN THEY CANNOT BE READ, and that is the whole
 * reason this is a function rather than a destructure.** A reader handed an unrecognised
 * answer — a deployment older than the object shape, an outage's error body, a legacy bare
 * array — must be able to say "I could not tell" instead of "your documents do not match".
 *
 * **REFUSE, NEVER COERCE.** `searched` must be the boolean and `sources` a real count, so a
 * string `"false"` (truthy) and a `"0"` cannot become answers about somebody's library.
 *
 * ⚠ **A BARE ARRAY IS THE OLD SHAPE AND ITS PASSAGES ARE KEPT, which is a deployment-order
 * decision rather than tidiness.** `agent.search_knowledge` answered `setof jsonb` until the
 * migration this reader ships with, so a PostgREST call to a database that has not had it yet
 * comes back as a list. Dropping those would make a working search answer nothing found, in
 * silence, for as long as the two halves were apart; taking them leaves the two new facts
 * `null`, so a genuine miss on an old database reads `unknown` — "I could not tell" — which is
 * the honest answer and the one this file exists to keep available.
 */
export function readSearch(answer) {
  const bare = Array.isArray(answer) ? answer : null;
  const o = !bare && answer && typeof answer === "object" ? answer : null;
  const raw = bare ?? (o ? o.excerpts : null);
  return {
    excerpts: Array.isArray(raw) ? raw : [],
    searched: o && typeof o.searched === "boolean" ? o.searched : null,
    sources: o && Number.isInteger(o.sources) && o.sources >= 0 ? o.sources : null,
  };
}

/**
 * Which of `SEARCH_OUTCOMES` a read is, and the ORDER is the meaning.
 *
 * ⚠ **PASSAGES FIRST, whatever the flags say.** An answer carrying excerpts and
 * `searched: false` is self-contradictory, and the passages are the part a caller can use;
 * reading the flag there would throw away material the database really found.
 *
 * ⚠ **THEN `not-searched` BEFORE THE SOURCE COUNT**, because it is true however big the
 * library is: nothing was looked for, so the library was not consulted and its size is not
 * the thing to say. Reversing the two tells somebody with no documents to fix their query
 * and somebody with a bad query to upload something.
 *
 * **AND `unknown` IS REACHED BY FALLING THROUGH RATHER THAN BY BEING TESTED FOR**, so a
 * reading this function has never heard of cannot become one of the other four by accident.
 */
export function searchOutcome(read) {
  const r = read && typeof read === "object" ? read : {};
  if (Array.isArray(r.excerpts) && r.excerpts.length) return "matched";
  if (r.searched === false) return "not-searched";
  if (r.searched === true && r.sources === 0) return "no-sources";
  if (r.searched === true && typeof r.sources === "number" && r.sources > 0) return "no-match";
  return "unknown";
}
