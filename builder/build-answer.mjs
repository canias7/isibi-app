import { renderNote } from "./site-render.mjs";
import { imageNote } from "./site-images.mjs";

// WHICH SITE THIS BUILD MADE — the half of a build's answer that says so.
//
// Owner, 2026-09-08, on a build that published and reported failure: "the
// problem is that is the build gotta stay in that chat, not make a new one."
//
// THE BUILD HAD TWO SUCCESS ANSWERS AND THEY WERE DIFFERENT SHAPES. The inline
// route composed `{ok:true, slug, url, backend, brand, tables, schema, …}` from
// route-local variables; the collector — `runResumedSiteBuild`, which finishes
// every build whose generation outlives the POST socket — composed
// `{ok:true, resumed, ...pages}`, and `pages` is `publishPages`' out object,
// which takes `slug` as an INPUT and never puts it on the output. So the
// collector's answer carried no slug.
//
// `public/chat.js`'s success gate is `if (r.ok && d && d.error !== true &&
// d.slug)`. No slug, no success: the answer fell past every named branch to the
// catch-all, which has no `msg` to print and says "That didn't come together —
// you weren't charged." Measured on `hearth-paper` (2026-09-08): live site, 14
// credits taken, that sentence on screen. And on `plyhouse` before it — both of
// this account's real builds ended `stage: "resume"`, so this had been failing
// EVERY long build, not one.
//
// The three symptoms are one cause: the false error, the false "weren't
// charged" (the credit pill refreshes just above it, showing the real spend),
// and the slug never written onto the local project — which is what leaves the
// chat empty and the site standing on its own as a card.
//
// SO THE IDENTITY FIELDS ARE COMPOSED ONCE, HERE, AND BOTH PATHS SPREAD THEM.
// This is the repo's own answer to "two lists of the same thing", and the shape
// `BEHAVIOR_ITEM` and `TABLE_ITEM` already take: one object, two callers, no
// second copy to drift.
//
// WHY ONLY THESE SIX AND NOT THE WHOLE ANSWER. The inline route's literal is
// ~100 lines of per-field reasoning and its own comment says the body is "NOT
// RE-INDENTED, deliberately" — a wholesale extraction is a diff nobody can
// review. These six are exactly the ones the collector was missing, and exactly
// the ones the browser's success path reads that `publishPages` does not
// already provide: everything else it reads (`page`, `files`, `cost`, `images`,
// `buildMs`) rides on `...pages` and always did.
//
// LIGHT ENOUGH TO DRIVE WITH NO WORKER AND NO NETWORK. The two note writers it
// imports are themselves dependency-free, so this module needs no bindings.

/**
 * The fields that name the site a build produced.
 *
 * Every one of them is read by `public/chat.js` on the success path
 * (13307-13351): `slug` and `url` become the project's identity, `backend`
 * gates the Data panel, `brand` becomes the project's name, and `schema` /
 * `tables` become the table list the router digest carries.
 *
 * ABSENT RATHER THAN `undefined` WHERE THERE IS NOTHING TO SAY. `JSON.stringify`
 * drops an undefined value, so the two are identical on the wire — but they are
 * not identical to a test, and a guard that compares field sets has to be
 * comparing what really ships. Only `slug` is unconditional: a build that
 * cannot name its site has nothing to answer, and the caller should not be
 * reaching for this.
 */
export function siteAnswer({ slug, url, backend, brand, tables, schema } = {}) {
  const name = typeof slug === "string" ? slug.trim() : "";
  if (!name) return {};
  const out = {
    slug: name,
    // THE SAME EXPRESSION THE INLINE ROUTE ALWAYS USED. `/s/<slug>/` is the
    // internal addressing scheme and 301s to the public address; the browser
    // falls back to exactly this string when `url` is absent
    // (`d.url || ('/s/' + d.slug + '/')`), so composing it here changes nothing
    // for the path that already worked and gives the collector the same answer.
    url: typeof url === "string" && url ? url : "/s/" + name + "/",
    // AN OBSERVATION, NOT A CONSTANT — the inline route's own comment says so.
    // It was hardcoded `true` when every build provisioned; since 2026-08-24 a
    // first build has no database, and `public/chat.js` gates the Data panel and
    // the delete wording on this field, so a site with nothing stored would
    // offer a panel over a database that does not exist. Strict, never truthy:
    // a caller that cannot tell must pass `false` and be wrong in the direction
    // that hides a panel rather than the one that promises a missing database.
    backend: backend === true,
  };
  // THE SITE'S NAME, which becomes the project's name in the workspace. A build
  // that designed no brand leaves the project called whatever the customer's
  // first four words made it, which is the behaviour before this existed.
  if (typeof brand === "string" && brand.trim()) out.brand = brand.trim();
  // WHAT THIS APPLY TOUCHED, and what the merged spec says. The browser prefers
  // `schema` and falls back to `tables`, so both travel — see chat.js's own
  // comment about a revise, where the two legitimately differ.
  //
  // `tables` IS AN ARRAY WITH PROPERTIES HUNG OFF IT on the inline path
  // (`made.functions`, `made.functionErrors` are read separately, and
  // `JSON.stringify` keeps only the array). Passed through untouched rather
  // than rebuilt, so that reading is unchanged.
  if (Array.isArray(tables)) out.tables = tables;
  if (Array.isArray(schema)) out.schema = schema;
  return out;
}

/**
 * THE FIELDS THE BROWSER'S SUCCESS PATH NEEDS, named so a guard can assert both
 * answers satisfy it without retyping the list.
 *
 * Derived from what `public/chat.js` reads between its success gate and the end
 * of the block that records the site. `slug` first because it IS the gate.
 */
export const ANSWER_FIELDS = ["slug", "url", "backend"];

/**
 * WHAT HAPPENED TO THE PAGES, in the customer's own reply.
 *
 * FOUND BY THE GUARD THAT WAS WRITTEN FOR THE SLUG. Deriving the browser's read
 * set out of `public/chat.js` — every `d.<field>` inside its success block —
 * and subtracting what `publishPages` puts on its out object left five
 * sentences the inline route composes and the collector never did. So a
 * collected build was silent about all five, on top of failing the gate: no
 * "3 pages threw an error", no "a page was replaced by a stub", no account of
 * the photographs. Not a false statement like the slug was — a missing one —
 * but on the path that finishes every long build.
 *
 * THREE OF THE FIVE, and the line is what the collector can honestly SEE.
 * These ride on `pages`, which it has in hand, so they are the slug's own
 * shape: a value computed and never put on the wire. The other two cannot be
 * derived there and are deliberately left at the inline route:
 *
 *   `cssNote`     wants `cssAsk` — `readCss(designed.css)`, and what is STORED
 *                 is the resolved sheet (`cssAsk.usable ? cssAsk.css :
 *                 priorCss`), from which `usable` cannot be recovered.
 *   `contextNote` wants `context` — `contextSummary(...)` over the linked
 *                 pages and the researched facts, which the resume record does
 *                 not carry.
 *
 * Adding either would mean storing a second copy of something on the record,
 * which is a bigger change than the sentence is worth; naming them here is so
 * the next session does not have to derive the same subtraction again.
 *
 * ONE COMPOSER RATHER THAN THREE MATCHING LINES ON EACH PATH, for the reason
 * the whole module exists: two copies of an answer's shape drift, and the
 * drift is silent.
 */
export function pageNotes(pages) {
  const p = pages && typeof pages === "object" ? pages : null;
  if (!p) return {};
  const out = {};
  // `|| undefined` at every one, exactly as the inline route wrote them:
  // `JSON.stringify` drops the key, so an ordinary build's answer is
  // byte-identical to what it was before this existed.
  const salvage = typeof p.salvageNote === "string" && p.salvageNote ? p.salvageNote : "";
  if (salvage) out.salvageNote = salvage;
  const images = imageNote(p.images);
  if (images) out.imagesNote = images;
  const render = renderNote(p.render);
  if (render) out.renderNote = render;
  return out;
}

/**
 * The note fields this composes, named so a guard can compare both answers
 * without keeping its own list.
 */
export const NOTE_FIELDS = ["salvageNote", "imagesNote", "renderNote"];
