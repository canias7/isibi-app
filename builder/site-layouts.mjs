// What shape a generated site is.
//
// THE THIRD AXIS. Themes (site-theme.mjs) vary how a site LOOKS; the reference
// pages carry the grammar every site shares (chrome, states, buttons where
// decisions happen); this module varies how a site is ARRANGED — the hero
// pattern, the body rhythm, and which verb leads. The source document is
// builder/LAYOUTS.md (owner-authored, 26 families); the two are held in
// bijection by test/site-layouts.test.mjs, both directions.
//
// A LAYOUT RIDES IN THE USER MESSAGE, NEVER THE SYSTEM BLOCK. The reference
// pages sit in the system block under `cache_control: ephemeral`, so they must
// stay constant; the chosen family is per-build and the user message varies per
// build anyway. `layoutDirective()` renders the text that goes there.
//
// THE PAGE SET IS A FAMILY PROPERTY (owner's call, 2026-08-01). Sites used to
// get a flat page budget chosen for token cost; that made every site the same
// depth. Now each family declares `pages` — one for a café, four for a docs
// site — the directive states them, and src/family-pages/<family>/ carries a
// complete rendered reference app with exactly that page set.
//
// READINESS IS DERIVED, NOT TRUSTED. A family whose signature component is not
// in the kit yet carries `wants: [...]` and `ready: false`, and the prompt
// helpers refuse to offer it — a directive telling the model to reach for a
// component that does not exist is the exact import-something-absent failure
// the lint exists to stop, moved upstream. The test recomputes readiness from
// the ui folder on disk: land the wanted component and the suite FAILS until
// the family is flipped on, so the flag cannot go stale in either direction.
// The gaps are specced for a separate build session in builder/component-gaps.md.
//
// Pure logic, no I/O, the same shape as site-theme.mjs and site-fonts.mjs — so
// all of it is tested outside the Worker.

/* ------------------------------------------------------------- structures */

// The eight cross-cutting structures from LAYOUTS.md — any family can be
// expressed through any of these. `md` is the bullet text in the source doc,
// held in bijection by the test.
export const STRUCTURES = {
  "single-scroll": {
    md: "Single-page scroll",
    text: "one page, sections in sequence; the nav is anchor links into them",
  },
  bento: {
    md: "Bento grid",
    text: "the first screen is a dense grid of unequal tiles (BentoGrid), each one fact or one door",
  },
  sidebar: {
    md: "Sidebar-persistent",
    text: "a persistent left rail carries the nav or filters; content scrolls beside it (sidebar-layout)",
  },
  "split-screen": {
    md: "Split-screen 50/50",
    text: "50/50 — media or live state on one side, copy and the action on the other (split-view)",
  },
  "full-bleed-hero": {
    md: "Full-bleed hero + centered content column",
    text: "an edge-to-edge opening, then one centered measure for everything after it",
  },
  "card-grid": {
    md: "Card-grid dense",
    text: "uniform cards from the top — a page for browsing, not reading",
  },
  editorial: {
    md: "Editorial asymmetric",
    text: "magazine spreads — alternating offsets, generous whitespace, nothing centered by default",
  },
  terminal: {
    md: "Terminal / monospace minimal",
    text: "monospace type, hairline borders, no imagery, no decoration",
  },
};

/* ---------------------------------------------------------------------------
 * THE 100 FAMILIES ARE GONE (owner's call, 2026-08-20).
 *
 * "The point of making this builds is so that I want to eliminate the families
 * and reference app and layouts so the model can make it itself."
 *
 * What stood here was a table of 100 trades, each declaring the pages a site of
 * that kind ships, the components to reach for, the primary verb, the layout in
 * 2-4 lines and the 909 business kinds it covered — plus `layoutDirective`,
 * which composed all of that into the block the page-generation call reads.
 * `design_schema` took one name and the platform looked the rest up.
 *
 * The FIELDS were right and pre-filling them per trade was the wrong move. They
 * are `site-plan.mjs` now: the designer answers the same six per site, having
 * read the brief, and `directiveFromPlan` composes the same block — proved
 * byte-identical, line for line, against 98 of the 100 rows this table held.
 *
 * WHAT SURVIVED, AND WHY EACH ONE HAD TO:
 *
 *   STRUCTURES — the eight page skeletons above. Real code branches on these
 *   names (`terminal` sets a site's photograph budget to zero), the plan offers
 *   them as an enum, and an enum is a cap enforced in code rather than a rule a
 *   model is merely told. They were never per-trade.
 *
 *   The four REFERENCE_PAGES in `page-gen.mjs` — NOT the same thing as the 100
 *   reference apps that went with this table. Those taught what a TRADE looks
 *   like; these teach how to CALL the API, are identical on every build, and
 *   ride in the cached prompt at almost no cost.
 *
 *   KIT_PALETTE — 279 component names, measured from what the deleted pages
 *   actually imported and frozen before they went. Deliberate: the corpus this
 *   change destroys is the only place that measurement could ever come from.
 *
 * THE ONE THING LOST, STATED RATHER THAN DISCOVERED LATER: a site built before
 * 2026-08-20 stores a `family`, and `briefWithLayout` used to fall back to this
 * table for it. With the table gone such a site revises with no layout
 * directive — acceptable because a revise already carries the site's OWN page
 * source plus the instruction to return every page as a byte-identical edit, so
 * its real layout is the pages themselves and never the directive. A FIRST
 * build has no fallback to lose.
 * ------------------------------------------------------------------------- */

export const STRUCTURE_NAMES = Object.keys(STRUCTURES);
