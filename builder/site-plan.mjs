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
// pre-filling them per trade was the wrong move. So the fields the table held
// become fields the designer answers, per site, having read the brief.
//
// `structure` WENT ENTIRELY 2026-08-20 (owner's call) — six fields to five, and
// the last two exports of `site-layouts.mjs` with it, so that file went too. It
// named one of eight page skeletons: single-scroll, bento, sidebar,
// split-screen, full-bleed-hero, card-grid, editorial, terminal.
//
// MEASURED AS IGNORED, which is why it was not merely re-shaped into free text.
// Over the pinned generator corpus: `sidebar` produced no page importing
// `sidebar-layout`; `single-scroll` — "one page, sections in sequence, the nav
// is anchor links" — produced four routes navigated by `<Link>`, the opposite
// on both halves of its own definition; `editorial` produced a centred column.
// Three scenarios, three disobeyed.
//
// AND `shape` ALREADY ASKS THE QUESTION, which is what settled it. That field
// takes two or three lines on what LEADS, what the body runs through and the
// rule this kind of site fails by breaking — authored per site, in the
// designer's own words. A second free-text field about the arrangement is the
// same answer twice, and the two would eventually disagree; the old `shape`
// description had to spend a clause telling the model not to restate the
// skeleton it had just picked, which is the tell.
//
// WHAT REALLY WENT WITH IT IS THE PHOTOGRAPH BUDGET, a cost rather than an
// intention. Two branches keyed on the enum's own names — `terminal` bought
// nothing and the two hero-led skeletons bought two. Recorded where it
// happened, on `planBudget` in `site-images.mjs`.
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
export const PLAN_KEYS = ["purpose", "shape", "pages", "action", "components"];

/** Every plan axis an edit may move — the same five, so `EDIT_FIELDS` derives rather than restates. */
export const PLAN_EDIT_FIELDS = PLAN_KEYS;

/* -------------------------------------------------------- the kit palette */

/**
 * WHAT THE DESIGNER PICKS ITS MANIFEST FROM — 279 names, ordered most-used-first.
 *
 * IT NEEDED A LIST AND HAD NONE. `components` compels 10-24 names out of a kit of
 * 2,112, and until this the field described the job and named not one component,
 * so the designer was answering from imagination. Most of this kit is named
 * things no model could guess — `stats-band`, `trust-strip`, `rate-card`,
 * `week-strip` — so an unlisted palette is a manifest of plausible inventions,
 * every one of which resolves to no signature at all.
 *
 * 279 RATHER THAN ALL 2,112, and the reason is a measurement rather than thrift.
 * The whole kit is 11,392 tokens of names against 1,442 for these, and the
 * designer's tool block is 24,495 — so all of them is a 46 per cent increase on a
 * cached block where this is 6. What that buys is nothing: these 279 are EVERY
 * component the 324 exemplar pages ever reach for, so a site needing something
 * outside them is needing something no site has yet needed.
 *
 * THE PAGE WRITER IS TOLD ABOUT ALL 2,112 ANYWAY, which is the asymmetry that
 * makes this safe. The two calls ask different questions: the designer PICKS, so
 * it wants a realistic palette; the page writer WRITES, and `lintPages` permits
 * any real module — so a name it has never heard of is exactly how an import
 * gets made blind.
 *
 * FROZEN, WITH ITS PROVENANCE, because it cannot be re-derived after the change
 * it belongs to: the corpus it is measured from is the family table this work
 * deletes. Ordered by how many of the 324 pages import each one, so the head of
 * the list is real signal about what a site usually needs — and `page-gen.mjs`
 * takes the always-on signature core off the front of it rather than keeping a
 * second list.
 *
 * MEASURED FROM WHAT PAGES IMPORT, NEVER FROM WHAT FAMILIES DECLARED, and the
 * difference is the whole argument for this being a better list than the one it
 * replaces. Those declarations were wrong in BOTH directions: 42 per cent of
 * every reach a family's own pages made lay outside its list, and 31 of the 282
 * names those lists carried were imported by no page at all. A list of what
 * somebody thought a trade would need is not a list of what its pages used.
 */
export const KIT_PALETTE = [
  "site-chrome", "section-header", "faq", "safe-image", "price-list", "location-card",
  "testimonial", "gallery", "opening-hours", "stats-band", "trust-strip", "cta-band", "input",
  "media-grid", "success-panel", "contact-form", "busy-button", "form-row", "rate-card",
  "steps", "availability-grid", "spec-row", "textarea", "button", "download-card",
  "event-card", "open-now", "house-rules", "menu-section", "press-quote", "search-input",
  "pricing-table", "team-grid", "availability-calendar", "contact-card", "date-enquiry",
  "filter-bar", "result-count", "service-area", "timeline", "triage-banner",
  "announcement-bar", "prev-next", "product-card", "tag-list", "video-embed",
  "arrangement-steps", "bento-grid", "checklist-dot", "data-table", "inspection-rating",
  "practitioner-card", "service-times", "session-table", "side-nav", "size-guide",
  "status-badge", "turnaround-note", "capacity-table", "category-nav", "code-block",
  "countdown", "cutoff-time", "eligibility-check", "email-capture", "fare-quote", "figure",
  "frequency-picker", "label", "plan-card", "subject-list", "ticket-tiers", "tour-dates",
  "admission-prices", "audio-player", "before-after", "card", "comparison-table",
  "counter-services", "description-list", "entry-requirements", "produce-calendar", "quote",
  "search-facets", "amenity-list", "anchor-heading", "article-card", "author-byline", "badge",
  "cancel-policy", "cart-badge", "committee-list", "donation-tiers", "excess-note",
  "exhibition-card", "facility-status", "fee-table", "install-command", "interest-rates",
  "link-card", "live-badge", "marquee", "parallax", "post-meta", "price-tag", "profile-card",
  "property-card", "rating-summary", "reveal", "seller-card", "social-links", "sort-select",
  "status-dot", "tap-list", "terms-block", "trade-terms", "week-strip", "add-to-cart",
  "age-gate", "alarm-state", "allergen-matrix", "audience-switch", "booking-summary",
  "bulk-pricing", "bundle-row", "calculator-card", "cart-line", "certification-row",
  "collection-day", "compliance-checklist", "contract-end", "copy-button", "cover-level",
  "curl-example", "currency-amount", "day-schedule", "deadline-bar", "delivery-estimate",
  "delivery-slot", "device-picker", "direct-saving", "episode-row", "exchange-rate-note",
  "feature-grid", "file-list", "fixture-list", "impact-stat", "investment-table", "job-card",
  "lead-time", "logo-cloud", "media-object", "meeting-papers", "membership-grades", "money",
  "pitch-types", "place-order-bar", "priority-badge", "progress-ring", "quote-calculator",
  "quote-request", "radio-cards", "rate-board", "room-card", "sdk-tabs", "season-picker",
  "sla-clock", "slot-capacity", "stock-badge", "store-locator", "story-lead", "tariff-row",
  "term-dates", "territory-list", "time-lane-grid", "trading-diary", "unit-card",
  "vehicle-lookup", "verified-badge", "viewer-count", "waitlist-form", "accordion",
  "activity-feed", "agenda-list", "arrears-note", "assignee-picker", "avatar-name",
  "award-badge", "bin-type", "break-even-note", "bulk-actions", "cart-summary",
  "changelog-entry", "chapter-list", "checkbox", "chunked-upload", "claim-timeline",
  "click-collect", "cohort-picker", "condition-report", "consent-checkbox", "countdown-ring",
  "curriculum-path", "date-range-picker", "departure-board", "dish-card", "estimate-band",
  "exclusion-list", "facet-range", "form-progress", "form-section", "goal-gauge",
  "incident-report", "kanban-board", "key-points", "league-table", "lineup-grid",
  "livery-packages", "login-form", "lot-card", "maintenance-page", "masonry",
  "membership-card", "membership-tier-row", "meter-reading", "min-order-note", "minutes-entry",
  "not-found", "option-priced-list", "order-summary", "patrol-log", "payback-note",
  "payment-picker", "paywall", "permit-row", "policy-summary-row", "postcode-input",
  "prescription-row", "priority-debts", "prompt-box", "provenance-note", "pull-quote",
  "quantity-break", "reading-time", "receipt", "recent-searches", "record-header",
  "recurring-picker", "refresh-pill", "repair-job", "repair-status", "repayment-preview",
  "route-stop", "rsvp-buttons", "search-suggestions", "seat-map", "service-availability",
  "service-history", "setlist-row", "shift-signup", "shipping-options", "sidebar-layout",
  "smart-meter-note", "sparkline", "stock-level", "store-badges", "streaming-text",
  "suggestion-chips", "table-search", "tenancy-costs", "time-until", "travel-time-note",
  "upgrade-badge", "vehicle-card", "video-hero", "waiting-list-place", "wishlist-button",
  "word-count", "working-hours",
];

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
  const seen = new Set();
  for (const x of v) {
    const s = str(x, cap);
    // DEDUPLICATED, and it is the component manifest that makes this matter.
    // A repeated name spends one of MAX_COMPONENTS on a signature already sent,
    // so a model that lists `faq` twice gets 23 components' worth of props and
    // is told it named 24. Found by a mutation on the generator's own dedup,
    // which showed nothing anywhere held it. Harmless and right for the other
    // two: a shape line or a verb repeated is a slot spent saying nothing.
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
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
  return lines2.join("\n");
}

/* ------------------------------------------------------- the tool schema */

/**
 * The five fields, in the order they must be generated. Spread into
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
      "A vague line here produces a vague site.",
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
      "Naming a component that does not exist is refused and costs nothing; leaving one out is what hurts.\n\n" +
      // THE PALETTE, MOST-USED FIRST — and the order is information rather than
      // formatting: the head of this list is what a small business site nearly
      // always needs and the tail is what one trade in fifty does. Named here
      // because a compelled field with no list is answered from imagination, and
      // most of this kit is named things no model would guess.
      "Pick from these, most-commonly-needed first:\n" + KIT_PALETTE.join(", ") + ".",
  },
};

/** All five are required — every one is a line of the directive. */
export const PLAN_REQUIRED = PLAN_KEYS.slice();
