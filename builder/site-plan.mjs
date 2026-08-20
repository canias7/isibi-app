// THE SITE PLAN IS AUTHORED, NOT LOOKED UP (owner's call, 2026-08-20).
//
// Until this, `design_schema` took `family` — one of 100 — and the platform
// looked up a table row to learn what the pages were, how they were arranged,
// what the primary verb was and which components to reach for. So a barber shop
// got the barber shop's answers and a dentist got the dentist's, decided once by
// a person, for a trade, years before any particular site existed.
//
// The owner's direction: "the model alone decides how to shape it". The FIELDS
// were right — a purpose, a shape, a page set, a verb, a component list — and
// pre-filling them per trade was the wrong move. So the six fields the table
// held become six fields the designer answers, per site, having read the brief.
//
// WHAT THIS DELIBERATELY DOES NOT CHANGE: the directive's FORMAT. `layoutDirective`
// composes a block that the page-generation call has been reading since it
// existed, and `directiveFromPlan` emits the same block from authored values —
// same lines, same order, same wording, one word different (a site "has" pages
// where a family "ships" them). The pages call cannot tell which produced it,
// which is what keeps this a change to ONE step rather than to the generator.
//
// Plain module with no I/O, like `site-edit.mjs` and `publish-pages.mjs`, so the
// whole decision is tested without a Worker, a model or a database.

import { STRUCTURES, STRUCTURE_NAMES } from "./site-layouts.mjs";

/**
 * THE FIELD ORDER IS THE FIX, AND IT IS THE WHOLE REASON `components` IS LAST.
 *
 * A tool schema's property order is the order the model fills the fields in, so
 * this list decides what the designer knows at the moment it picks each value.
 * `components` names which components the page writer will be shown the props
 * of — so a wrong pick there is a component used blind, with invented props,
 * which `tsc` refuses and salvage turns into a stubbed page.
 *
 * Picking it LAST means the model has already committed to the purpose, the
 * skeleton, the shape, THE PAGE LIST AND WHAT EACH PAGE IS FOR, and the primary
 * verb. It is choosing components for four pages it has just decided to build,
 * rather than for "a dentist" in the abstract.
 *
 * That is not a small difference and it is the measured weakness of what came
 * before. Over the 324 exemplar pages, a family LISTED 8.0 components and its own
 * pages IMPORTED 12.1 — 42% of every reach lay outside the list, and only 2 of
 * 100 lists covered everything their pages used. That is what picking for a
 * trade, with no page list in hand, is worth.
 *
 * Guarded by a test, because a later edit that adds a field or reorders this
 * list for tidiness would put the pick back in front of the pages silently.
 */
export const PLAN_KEYS = ["purpose", "structure", "shape", "pages", "action", "components"];

/** Every plan axis an edit may move — the same six, so `EDIT_FIELDS` derives rather than restates. */
export const PLAN_EDIT_FIELDS = PLAN_KEYS;

/* --------------------------------------------------------------- the caps */

// CAPS LIVE HERE, IN CODE, AND ALSO IN THE DESCRIPTIONS — this repo's standing
// distinction, and the reason `MAX_CLARIFY` is arithmetic rather than a
// sentence. A cap a model is merely told about is not a cap.
export const MAX_SHAPE = 3;
export const MAX_PAGES = 6;
export const MAX_ACTION = 3;
export const MAX_COMPONENTS = 24;
const MAX_PURPOSE = 400;
const MAX_LINE = 300;
const MAX_ROLE = 200;

/**
 * A route path the rest of the pipeline can actually address.
 *
 * Deliberately the SAME shape `validatePages` and `routeOf` already agree on:
 * lowercase, `[a-z0-9-]` segments, a leading slash, no trailing slash, no
 * extension. A path outside that is dropped rather than repaired, because
 * repairing it is guessing what the model meant and a wrong guess names a page
 * the generator then writes at an address nothing routes to.
 *
 * CASE IS THE ONE EXCEPTION, AND IT IS NOT A GUESS. `/Book` and `/book` are the
 * same route written two ways — there is no second thing it could have meant —
 * and these paths feed the DIRECTIVE rather than a filename, so lowercasing
 * tells the model to build a legal route where dropping would silently delete a
 * page it asked for. Everything else really is refused: a trailing slash, an
 * extension, a missing leading slash, a segment with characters a route cannot
 * carry.
 */
const PATH_OK = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/;

const str = (v, cap) => (typeof v === "string" ? v.trim().slice(0, cap) : "");

/**
 * A LIST OF STRINGS, refusing anything that merely stringifies.
 *
 * `String(["a","b"])` is `"a,b"` — one entry wearing two answers — which this
 * codebase has now been bitten by four times (a role, an access level, a mode,
 * a build model). So an entry that is not a string is dropped, and a value that
 * is not an array is not coerced into one.
 */
function lines(v, { cap, max }) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) {
    const s = str(x, cap);
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * The page set: `{path, role}`, deduplicated by path, capped.
 *
 * DEDUPLICATED BECAUSE TWO ENTRIES FOR ONE PATH IS A PAGE SET WITH A BUG IN IT —
 * the directive would list the same address twice with two different jobs, and
 * the generator would be asked to write one file to satisfy both. First wins,
 * which is the same rule `normalizeSchema` applies to a duplicate table.
 *
 * A page with no role is dropped rather than kept with an empty one: the role
 * is the entire content of that line of the directive, and `- /book — ` tells
 * the generator less than not mentioning /book at all.
 */
function pageList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  const seen = new Set();
  for (const p of v) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const path = str(p.path, 80).toLowerCase();
    const role = str(p.role, MAX_ROLE);
    if (!path || !role || !PATH_OK.test(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ path, role });
    if (out.length >= MAX_PAGES) break;
  }
  return out;
}

/**
 * The authored plan, narrowed to what the rest of the pipeline can use.
 *
 * ALLOW-LIST, NOT A FILTER, and that is deliberate: it builds its output field
 * by field, so a property nobody added here cannot ride along into `_meta` and
 * be described to the page generator as though it meant something. That is the
 * `coerceTable` shape — and its trap, which cost `teamScope` five layers of
 * silent death, is that a field added to the tool and forgotten HERE is dropped
 * without a word. `PLAN_KEYS` is what a test derives from, at both ends.
 *
 * RETURNS null FOR A PLAN THAT CANNOT COMPOSE A DIRECTIVE — no purpose, or no
 * usable page — rather than a half-plan. The caller then falls back to whatever
 * it had, which for an existing site is its stored family and for a new one is
 * no directive at all, and both are states the pipeline already handles. A
 * half-plan is not: it would print a LAYOUT block naming no pages, which reads
 * to the generator as an instruction to build a site with none.
 */
export function normalizePlan(input) {
  const p = input && typeof input === "object" && !Array.isArray(input) ? input : null;
  if (!p) return null;

  const purpose = str(p.purpose, MAX_PURPOSE);
  const pages = pageList(p.pages);
  if (!purpose || !pages.length) return null;

  const out = { purpose, pages };
  // AN UNRECOGNISED STRUCTURE IS DROPPED, NOT REFUSED. The directive already
  // treats the structure line as optional — `layoutDirective` omits it when the
  // family declares none — so a plan whose skeleton we cannot name is a plan
  // missing one line, not a plan that cannot be used. Refusing here would throw
  // away a good purpose and a good page set over a typo in an enum.
  if (typeof p.structure === "string" && Object.hasOwn(STRUCTURES, p.structure)) out.structure = p.structure;
  const shape = lines(p.shape, { cap: MAX_LINE, max: MAX_SHAPE });
  if (shape.length) out.shape = shape;
  const action = lines(p.action, { cap: 80, max: MAX_ACTION });
  if (action.length) out.action = action;
  const components = lines(p.components, { cap: 60, max: MAX_COMPONENTS });
  if (components.length) out.components = components;
  return out;
}

/** Does this look object carry an authored plan, or only a legacy family? */
export function hasPlan(look) {
  return normalizePlan(look) !== null;
}

/**
 * The directive, composed from authored fields instead of a table row.
 *
 * THE FORMAT IS `layoutDirective`'s, line for line, and that is load-bearing
 * rather than tidy. The page-generation prompt, the four reference pages and
 * every rule that mentions the layout block were written against that shape; a
 * plan that emitted a different one would be a change to the generator wearing
 * the costume of a change to the designer.
 *
 * Null on a plan that cannot compose one, for the reason `layoutDirective`
 * answers null on an unknown family: interpolating that appends the literal
 * word "null" to the brief and loses the layout, silently.
 */
export function directiveFromPlan(plan) {
  const p = normalizePlan(plan);
  if (!p) return null;
  const lines2 = [`LAYOUT — ${p.purpose}.`];
  for (const s of p.shape || []) lines2.push(`- ${s}`);
  if (p.action && p.action.length) {
    lines2.push(
      `Primary action: ${p.action.map((c) => `"${c}"`).join(" / ")} — this verb leads the header, the hero, and the closing band.`,
    );
  }
  if (p.components && p.components.length) lines2.push(`Reach first for: ${p.components.join(", ")}.`);
  lines2.push(`This site has ${p.pages.length} page${p.pages.length === 1 ? "" : "s"}:`);
  for (const pg of p.pages) lines2.push(`- ${pg.path} — ${pg.role}`);
  if (p.structure) lines2.push(`Structure — ${p.structure}: ${STRUCTURES[p.structure].text}.`);
  return lines2.join("\n");
}

/* ------------------------------------------------------- the tool schema */

/**
 * The eight skeletons, printed from the registry rather than retyped.
 *
 * A second copy here is two things that can disagree about what `sidebar`
 * means, and the one that the designer reads is not the one the directive
 * prints — so the model would pick against one description and the page writer
 * would be handed another.
 */
const STRUCTURE_LIST = STRUCTURE_NAMES.map((n) => `- ${n} — ${STRUCTURES[n].text}`).join("\n");

/**
 * The six fields, in the order they must be generated. Spread into
 * `design_schema.properties` so the tool has ONE definition of them.
 */
export const PLAN_FIELDS = {
  purpose: {
    type: "string",
    description:
      "One line: what this site is organised AROUND. Not what the business does — what the PAGE is for. " +
      "This is the sentence every other choice on this call follows from, so write it as a claim about the " +
      'page: "the list of things IS the page." "live state is the content — countdowns, and freshness shown." ' +
      '"the slot picker is the hero; everything else supports the appointment." ' +
      "A description of the trade is not a purpose.",
  },

  structure: {
    type: "string",
    enum: STRUCTURE_NAMES,
    description:
      "The page skeleton. Pick for what the content IS, not for novelty.\n" +
      STRUCTURE_LIST +
      "\n`terminal` sets this site's photograph budget to ZERO. Pick it when imagery would be noise, " +
      "not when the brief simply did not mention pictures.",
  },

  shape: {
    type: "array",
    items: { type: "string" },
    description:
      "How the page is laid out, in two or three lines.\n" +
      "Line 1 — what LEADS: the first thing on screen.\n" +
      "Line 2 — what the body runs through, in order.\n" +
      "Line 3 — the rule this kind of site fails by breaking.\n" +
      "Be specific, and name the failure. Real examples: " +
      '"the menu itself, sectioned, prices on the right" · ' +
      '"every page links sideways — dead ends are the failure" · ' +
      '"stale-looking data is the failure" · ' +
      '"hours and the address stay within one scroll of wherever the visitor is". ' +
      "A vague line here produces a vague site. Do not restate the structure you already picked — say what goes IN it.",
  },

  pages: {
    type: "array",
    items: {
      type: "object",
      properties: {
        path: { type: "string", description: 'The URL. "/" for the home page, then "/book", "/menu". Lowercase.' },
        role: { type: "string", description: "What this page is FOR, in one clause." },
      },
      required: ["path", "role"],
    },
    description:
      `One entry per route, at most ${MAX_PAGES}. THE COUNT IS YOURS: a café is one scroll and a reference site ` +
      "is four linked pages. Include the home page as \"/\" and give it a role like any other. " +
      "Do not invent a page the brief gives no reason for — an empty page is worse than no page, and every " +
      "page here is generated code that has to compile.",
  },

  action: {
    type: "array",
    items: { type: "string" },
    description:
      'The primary verb, worded as the button says it: ["Book now", "Check availability"]. ' +
      "It leads the header, the hero and the closing band, so it has to be the ONE thing you want a visitor " +
      'to do. Never "Learn more".',
  },

  // LAST, AND THAT IS THE DESIGN — see PLAN_KEYS. By the time this is filled in
  // the page list above it is already written, so the pick is made for THESE
  // pages rather than for a trade.
  components: {
    type: "array",
    items: { type: "string" },
    description:
      `${MAX_COMPONENTS >= 24 ? "10-24" : "10-" + MAX_COMPONENTS} components from the kit that this site will need. ` +
      "THIS IS A MANIFEST, NOT A SHORTLIST: the step that writes the pages is shown the exact props of the " +
      "components you name here, so one you leave out is one it has to guess the props of — and a wrong guess " +
      "costs that page. You have just written the page list above; name what those pages need, the ordinary " +
      "parts as well as the distinctive ones. A booking page wants availability-grid and week-strip, a menu " +
      "wants menu-section and price-list, a live board wants countdown and live-badge. " +
      "Naming a component that does not exist is refused and costs nothing; leaving one out is what hurts.",
  },
};

/** The six are all required — every one is a line of the directive. */
export const PLAN_REQUIRED = PLAN_KEYS.slice();
