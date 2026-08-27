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

// THE WHOLE KIT, FROM A LEAF. `page-gen.mjs` imports THIS file, so the names
// could not be taken from there without a cycle — which is exactly why the
// designer was offered 279 of 2,112 until 2026-08-21. `ui-components.mjs`
// imports nothing, so both sides can read the one list.
import { UI_COMPONENTS } from "./ui-components.mjs";
// THE ONE CAP ON A PICTURE'S DESCRIPTION, imported rather than restated. It is
// what `planImages` slices a token to before spending money on it, so a second
// number here would let the designer write a sentence this file accepts and the
// buying path silently truncates — the customer's picture described one way and
// bought another. `site-images.mjs` imports NOTHING, so this adds no cycle.
import { MAX_PROMPT_CHARS as MAX_IMAGE_PROMPT } from "./site-images.mjs";


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
 *
 * THIS IS THE SEMANTIC SET, NOT THE TOOL'S PROPERTY ORDER — they agreed until
 * 2026-08-21 and no longer do. `shape` is spliced into `design_schema` after
 * `mode` (see `SHAPE_FIELD`), so the order the model answers in is purpose,
 * pages, action, components, … , shape. What this list is for is everything
 * else: what `normalizePlan` may produce, what an edit may move, and what a
 * look change escalates on. Every guard derives from it rather than restating
 * it, which is why it must stay the whole set.
 *
 * `kind` IS FIRST (2026-08-27, owner's report: "he made an espresso machine on
 * a CRM"). Everything below it is a decision ABOUT the kind of thing being
 * built, so it is the one field that has to exist before any other answer
 * means anything — see KIND_FIELD.
 */
export const PLAN_KEYS = ["kind", "purpose", "shape", "pages", "action", "components", "images"];

/** Every plan axis an edit may move — the same five, so `EDIT_FIELDS` derives rather than restates. */
export const PLAN_EDIT_FIELDS = PLAN_KEYS;

/* -------------------------------------------------------- the kit palette */

/**
 * WHAT THE DESIGNER PICKS ITS MANIFEST FROM — 279 names, ordered most-used-first.
 *
 * IT NEEDED A LIST AND HAD NONE. `components` compels a manifest out of a kit of
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

/**
 * WHAT THE DESIGNER ACTUALLY PICKS FROM — the whole kit (owner's call, 2026-08-21).
 *
 * `KIT_PALETTE` above is 279 names and stays exactly as it is, because it does a
 * SECOND job: `ALWAYS_API_CORE` takes its first 20 as the signatures every site
 * gets whether or not the designer asks. That head is a frozen measurement and
 * must not move. What changes is only what the `components` FIELD offers.
 *
 * WHY 279 WAS WRONG, MEASURED RATHER THAN ARGUED. Those names are every
 * component the 324 exemplar pages imported — and all 324 are small-business
 * brochures, so "no site has yet needed it" meant "no brochure has". Over the
 * corpus, a funeral director's components sit at median position #4 and a CRM's
 * at #154, with 9 of its 18 past #150; an ai-tool's at #266. Twelve app parts —
 * `stat-card`, `metric-delta`, `row-actions`, `pagination`, `multi-sort`,
 * `split-view`, `detail-panel`, `inline-edit`, `saved-views`, `toolbar`,
 * `export-button`, `data-list` — were in the kit and nameable by nobody.
 *
 * AND THE 279 NEVER LIMITED WHAT A SITE COULD USE, which is what makes the old
 * shape worse than it looks. `lintPages` permits any real module and the page
 * writer is told all 2,112 names, so an unnameable component was not forbidden —
 * it was imported with NO SIGNATURE SENT. That is the invented-prop failure that
 * costs a page. The narrow list bought nothing and hid that.
 *
 * THE COST, MEASURED: +9,950 tokens on a block that is cached, so 0.37 credits a
 * build warm (1% of a 38-credit build) and 4.66 once per prompt version. The old
 * comment's "46 per cent increase" was true of the token count and misleading as
 * money.
 *
 * ORDER IS KEPT, AND IT IS THE HALF THAT STILL EARNS ITS PLACE. The 279 lead, in
 * their measured frequency order, then everything else alphabetically — so the
 * head of the list is still real signal about what a site usually needs, and the
 * tail is there for the site that needs something else. That change grew the
 * MENU and not the MANIFEST; the manifest's own cap moved separately on
 * 2026-08-24, 24 -> 50 — see `MAX_COMPONENTS` for what it costs.
 *
 * Derived from both lists rather than written out, or it goes stale the first
 * time a component is added to the kit.
 */
export const COMPONENT_MENU = (() => {
  const seen = new Set(KIT_PALETTE);
  const rest = UI_COMPONENTS.filter((n) => !seen.has(n)).sort();
  return [...KIT_PALETTE, ...rest];
})();

/* --------------------------------------------------------------- the caps */

// CAPS LIVE HERE, IN CODE, AND ALSO IN THE DESCRIPTIONS — this repo's standing
// distinction, and the reason `MAX_CLARIFY` is arithmetic rather than a
// sentence. A cap a model is merely told about is not a cap.
export const MAX_PAGES = 5;
export const MAX_ACTION = 3;
// 24 UNTIL 2026-08-24, AND THE OWNER RAISED IT TO 50: "so the model chooses how
// many it needs, and the cap is 50." A FLOOR WENT WITH IT — the field asked for
// "10-24", which is a range, and a range makes a site that genuinely needs eight
// components pad to ten. What is left is a ceiling and a judgement.
//
// THE COST IS MEASURED AND IT IS THE PER-SITE BLOCK, NOT THE CACHED ONE. This is
// a MANIFEST: page generation is shown the exact props of every name on it, and
// that block is per site, so it is FRESH INPUT on every build and cannot be
// cached. Driven against the real `componentApiFor`: 24 names is 3,872
// characters (~1,076 tokens) and 50 is 9,494 (~2,637) — +1,561 tokens, which on
// the default picker's rate is +$0.0031, or **0.39 credits**, about 1% of a
// 38-credit build. And it is only paid by a site that really names 50: a shop
// that needs twelve sends twelve.
export const MAX_COMPONENTS = 50;

/**
 * How many bands one page may declare, MEASURED rather than chosen.
 *
 * Counted over the 324 pinned exemplars — the pages WE wrote in the house style,
 * which is the only corpus of finished pages there is: 284 of them carry a
 * top-level `<section>`, and the distribution is min 1 · median 4 · p90 5 ·
 * p95 6 · max 9. Eight covers everything but the tail, and the tail is a handful
 * of pages rather than a shape the cap should be sized for.
 *
 * IT ALSO BOUNDS THE OUTPUT BILL, which is the half a generous number gets wrong
 * quietly. This field is written per page, so the worst case is
 * MAX_PAGES × MAX_SECTIONS × MAX_SECTION characters of model OUTPUT — billed at
 * 5x input — and output is the one part of the designer's answer that no cache
 * ever absorbs.
 */
export const MAX_SECTIONS = 8;
const MAX_PURPOSE = 400;
const MAX_SECTION = 120;
const MAX_ROLE = 200;
// A NAME IS A NAV LABEL, NOT A SENTENCE. `MAX_ROLE` stays beside it because a
// plan stored before 2026-08-24 carries a whole clause under `role` and
// `pageList` still reads it — see there for why that fallback is load-bearing.
const MAX_PAGE_NAME = 40;

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
 * The page set: `{path, name}`, deduplicated by path, capped.
 *
 * WHAT THIS STEP DECIDES, AND ALL IT DECIDES (owner's call, 2026-08-24): which
 * pages the site has, what each is called, and where it lives. Not what a page
 * is FOR — that used to be `role`, a clause about purpose, and it is out of
 * scope now.
 *
 * A STORED `role` IS STILL ACCEPTED, and that is not politeness — it is the
 * difference between a rename and a data loss. `_meta.site_look` on every site
 * ever built holds `{path, role}`, and a revise reads it straight back through
 * here. Requiring `name` alone would drop EVERY page of EVERY existing site, and
 * `normalizePlan` returns null the moment `pages` is empty — so a customer
 * asking to change a colour would lose their purpose and their whole page set.
 * The `shape` field already set this precedent: "a value WE changed the meaning
 * of must never cost a customer their purpose and their page set on a revise."
 *
 * TWO CAPS, BECAUSE THEY ARE TWO DIFFERENT THINGS. A `name` is a label — 40
 * characters is a generous nav item. A legacy `role` is a whole clause and keeps
 * `MAX_ROLE`, so an existing site's directive line is not truncated mid-word by
 * a rename it had no part in.
 *
 * DEDUPLICATED BECAUSE TWO ENTRIES FOR ONE PATH IS A PAGE SET WITH A BUG IN IT —
 * the directive would list the same address twice, and the generator would be
 * asked to write one file to satisfy both. First wins, which is the same rule
 * `normalizeSchema` applies to a duplicate table.
 *
 * A page with no name is dropped rather than kept with an empty one: the name is
 * the entire content of that line of the directive, and `- /book — ` tells the
 * generator less than not mentioning /book at all.
 */
function pageList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  const seen = new Set();
  for (const p of v) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const path = str(p.path, 80).toLowerCase();
    const name = str(p.name, MAX_PAGE_NAME) || str(p.role, MAX_ROLE);
    if (!path || !name || !PATH_OK.test(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ path, name });
    if (out.length >= MAX_PAGES) break;
  }
  return out;
}

/**
 * The per-page arrangement: `{path, sections}`, one entry per page, in order.
 *
 * VALIDATED AGAINST THE PAGE LIST, which is the whole reason this is a function
 * rather than another `lines()` call. A shape for `/pricing` on a site whose
 * pages are `/` and `/book` is an instruction to arrange a page that will never
 * be written — printed in the directive it reads as a fourth page the generator
 * forgot, and the likeliest thing a model does with it is write one. So an entry
 * whose path is not in `pages` is DROPPED rather than repaired: repairing means
 * guessing which page was meant, and this file already refuses that guess one
 * function up for the same reason.
 *
 * A PAGE WITH NO ENTRY IS LEGAL and is the reason `sections` is not compelled
 * per page. Six pages × eight bands is a very long answer, and a model made to
 * fill every one pads the thin pages rather than admitting they are thin — the
 * arrangement of a two-band contact page is not worth the tokens. An absent page
 * is simply one the page writer lays out itself, exactly as every page was
 * before this field existed.
 *
 * ORDER IS THE CONTENT. `sections` is the page top to bottom and the first entry
 * is what leads, so nothing is sorted and nothing is re-ordered; the directive
 * numbers them so the instruction cannot be read as a set.
 *
 * Deduplicated within a page for the reason `lines()` gives — a band repeated is
 * a slot spent saying nothing — and never ACROSS pages, because two pages
 * legitimately share one (a closing "book a chair" band belongs on all of them).
 */
function pageShapes(v, pages) {
  if (!Array.isArray(v)) return [];
  const known = new Set(pages.map((p) => p.path));
  const out = [];
  const seen = new Set();
  for (const s of v) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const path = str(s.path, 80).toLowerCase();
    if (!known.has(path) || seen.has(path)) continue;
    const sections = lines(s.sections, { cap: MAX_SECTION, max: MAX_SECTIONS });
    // AN ENTRY WITH NO USABLE BAND IS NOT AN ARRANGEMENT. Kept, it prints a page
    // heading with nothing under it, which says less than the page's own role
    // line already did and reads as an arrangement we lost.
    if (!sections.length) continue;
    seen.add(path);
    out.push({ path, sections });
  }
  return out;
}

/**
 * The photographs this site gets, one entry a picture.
 *
 * EVERY ENTRY IS ~19 CREDITS OF REAL SPEND, which is what makes each rule here
 * a money decision rather than tidiness:
 *
 *   A PAGE THE SITE HAS NOT GOT IS DROPPED. The token has to be written into
 *   that page's source for a URL to land anywhere, so a picture declared for a
 *   route nobody generated is bought and then shown to no one. Checked against
 *   the page list for the same reason `pageShapes` is.
 *
 *   AN ENTRY WITH NO DESCRIPTION IS DROPPED rather than bought. `planImages`
 *   already refuses an empty `@@IMG:@@` for the stated reason — paying $0.15 to
 *   find out what an image model does with an empty prompt is the most expensive
 *   way to get a random picture — and the same answer belongs here, where it
 *   costs a slot rather than a photograph.
 *
 *   NOT DEDUPED BY PAGE. A gallery page legitimately wants three, and the home
 *   page wants an opening shot and a room. What bounds the total is `IMAGE_CAP`
 *   and the balance, both of which are applied downstream by `planBudget` and
 *   `imagesAffordable`, so this one is free to say what the site wants and let
 *   the money answer separately — the distinction `imageNote` exists to report.
 *
 * CAPPED AT `MAX_PAGES * 2` RATHER THAN AT `IMAGE_CAP`, deliberately. This is
 * what the site ASKED for and the budget is what it GOT, and collapsing the two
 * here would make "this site has no photographs" and "it wanted twelve"
 * indistinguishable — which is the exact thing `overflow` is carried for.
 */
function pageImages(v, pages) {
  if (!Array.isArray(v)) return [];
  const known = new Set(pages.map((p) => p.path));
  const out = [];
  for (const s of v) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const page = str(s.page, 80).toLowerCase();
    if (!known.has(page)) continue;
    const describe = str(s.describe, MAX_IMAGE_PROMPT);
    if (!describe) continue;
    out.push({ page, describe });
    if (out.length >= MAX_PAGES * 2) break;
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
  // STRICT EQUALITY AGAINST THE TWO LEGAL VALUES, never a truthiness or a
  // String() — `["tool"]` stringifies to "tool", which is the coercion this
  // codebase has shipped as a real bug four times (a role, an access level, a
  // mode, a build model). Anything else is dropped, and absent means shopfront
  // everywhere downstream, which is what every plan stored before the field
  // existed already is.
  if (p.kind === "shopfront" || p.kind === "tool") out.kind = p.kind;
  // AFTER `pages`, because it is checked against them. A stored `shape` from
  // before 2026-08-21 is a flat string array and `pageShapes` answers `[]` for
  // it — so the plan still normalises and the old value simply buys nothing,
  // which is the rule the deleted `structure` field already established: a value
  // WE changed the meaning of must never cost a customer their purpose and their
  // page set on a revise.
  const shape = pageShapes(p.shape, pages);
  if (shape.length) out.shape = shape;
  const action = lines(p.action, { cap: 80, max: MAX_ACTION });
  if (action.length) out.action = action;
  const components = lines(p.components, { cap: 60, max: MAX_COMPONENTS });
  if (components.length) out.components = components;
  // AFTER `pages` for the reason `shape` is: each entry names one, and a picture
  // for a page the site does not have is a photograph nobody can ever see.
  //
  // KEYED ON THE INPUT BEING AN ARRAY, NOT ON THE RESULT HAVING ENTRIES
  // (2026-08-27). `if (images.length)` dropped an explicit `[]` — so the ONE
  // way IMAGES_FIELD documents for saying "this site has no photographs" was
  // structurally unsendable: the answer vanished here, `planBudget` read
  // absent, and the derived rule bought the home page a photograph anyway.
  // Measured on four consecutive builds of a brief saying "no photographs
  // anywhere" (runs 43–46), every one of which bought one. Answered-but-empty
  // and answered-but-unusable both survive as `[]` now — an answered field
  // whose entries were all refused buys NOTHING rather than a fallback picture
  // nobody described, the same rule `planImages` applies to an empty prompt.
  // Absent stays absent, so every stored plan from before the field behaves
  // exactly as it did.
  const images = pageImages(p.images, pages);
  if (Array.isArray(p.images)) out.images = images;
  return out;
}

/** Does this look object carry an authored plan, or only a legacy family? */
export function hasPlan(look) {
  return normalizePlan(look) !== null;
}

/**
 * What the page writer is told when the site is a WORKING TOOL, verbatim.
 *
 * ONE STRING, EXPORTED, so the module test can assert the directive carries it
 * without pinning a spelling — and so the sentence exists in exactly one place.
 * Every prohibition in it is a real thing the shopfront mold produced on a
 * tool brief, measured on a live build (northgroup-10, 2026-08-26): a hero
 * with a product photograph, a "Request a quote" closing band, a team section
 * of placeholder panels — a coffee company's brochure with the CRM bolted on
 * behind it. The positive half matters as much as the prohibitions ("the front
 * page IS the tool"), because a model told only what not to draw still has to
 * put SOMETHING first — the `publicView` lesson, where deleting instructions
 * without stating the replacement left the model inventing one.
 */
export const TOOL_DIRECTIVE =
  "THIS SITE IS A WORKING TOOL, NOT A SHOPFRONT. No hero, no marketing bands, no team section, " +
  "no testimonials, no closing pitch — and no photographs or picture slots anywhere. " +
  "The front page opens straight into the work itself: the table, the board, the list — dense, " +
  "figure-first, columns that line up. Every page is a working screen of the tool.";

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
  // THE TOOL BLOCK LEADS, directly under the purpose, because it is the frame
  // every line after it is read in. The page writer's whole training set is
  // shopfronts — hero, pitch, team, closing band — so a tool that merely lists
  // its pages still comes out wearing a brochure. Stated here rather than only
  // in the design tool, because this is the one block the PAGE WRITER reads.
  if (p.kind === "tool") lines2.push(TOOL_DIRECTIVE);
  if (p.action && p.action.length) {
    const verbs = p.action.map((c) => `"${c}"`).join(" / ");
    // PER KIND, because the shopfront wording asserts a hero exists — telling
    // the page writer the verb "leads the hero" on a site the line above just
    // forbade a hero on is the prompt contradicting itself, which is the
    // UI_SHORTLIST failure this repo has already paid a whole build for.
    lines2.push(p.kind === "tool"
      ? `Primary action: ${verbs} — the working verb; it leads the header and sits beside the work. There is no hero and no closing band.`
      : `Primary action: ${verbs} — this verb leads the header, the hero, and the closing band.`);
  }
  if (p.components && p.components.length) lines2.push(`Reach first for: ${p.components.join(", ")}.`);
  lines2.push(`This site has ${p.pages.length} page${p.pages.length === 1 ? "" : "s"}:`);
  // THE ARRANGEMENT SITS UNDER THE PAGE IT ARRANGES, which is the whole change
  // (owner's call 2026-08-21). It was three lines about the SITE printed between
  // the purpose and the page list — so a four-page site got one paragraph of
  // layout and the page writer decided, per page, which of the 24 components in
  // the manifest went where. Under the page, in order, it is an instruction
  // rather than a mood.
  //
  // NUMBERED rather than bulleted: `sections` is the page top to bottom and a
  // bullet list reads as a set of things the page contains, which is the one
  // reading that loses the only fact this field carries.
  const shapeFor = new Map((p.shape || []).map((s) => [s.path, s.sections]));
  for (const pg of p.pages) {
    lines2.push(`- ${pg.path} — ${pg.name}`);
    const sections = shapeFor.get(pg.path);
    if (sections) sections.forEach((s, n) => lines2.push(`    ${n + 1}. ${s}`));
  }
  return lines2.join("\n");
}

/* ------------------------------------------------------- the tool schema */

/**
 * The five fields, in the order they must be generated. Spread into
 * `design_schema.properties` so the tool has ONE definition of them.
 */
export const PLAN_FIELDS = {
  // FIRST OF THE SPREAD, AND THAT IS THE FIX (owner's report, 2026-08-27: "he
  // made an espresso machine on a CRM"). Until this field existed the pipeline
  // had exactly one mold — a shopfront — so a brief for a working tool was
  // squeezed through it: a marketing hero with a product photograph, a
  // "Request a quote" band and a team section, with the tool bolted on behind.
  // The failure was never the image count; it was that nothing anywhere asked
  // WHAT KIND OF THING the brief describes. A tool's property order is its
  // generation order, so this sits before `purpose`: every later answer is an
  // answer ABOUT the kind.
  //
  // AN ENUM, NOT PROSE, because the answer is read by CODE as well as by the
  // page writer: `planBudget` answers 0 photographs for a tool whatever else is
  // declared, and `directiveFromPlan` leads the page-generation directive with
  // the tool block. A cap a model is merely told about is not a cap.
  kind: {
    type: "string",
    enum: ["shopfront", "tool"],
    description:
      "What KIND of thing this site is — decide it before anything else, because every other answer follows " +
      'from it. "shopfront": a site that exists to persuade a VISITOR — a cafe, a barber, a builder, a studio. ' +
      "It sells; it leads with a hero and a call to action, and nearly every brief is one. " +
      '"tool": a thing the business itself works IN rather than shows — a CRM, a tracker, a booking desk, a ' +
      'stock list, a dashboard. The brief usually says so in as many words ("a working tool rather than a ' +
      'website"). A tool is NOT a website about the tool: no hero, no marketing bands, no team section, no ' +
      "closing pitch, and no photographs or picture slots anywhere — the front page IS the tool, opening " +
      "straight into the work (the table, the board, the list). " +
      'When the brief genuinely reads as both, answer "shopfront".',
  },

  purpose: {
    type: "string",
    description:
      "One line: what this site is organised AROUND. Not what the business does — what the PAGE is for. " +
      "This is the sentence every other choice on this call follows from, so write it as a claim about the " +
      'page: "the list of things IS the page." "live state is the content — countdowns, and freshness shown." ' +
      '"the slot picker is the hero; everything else supports the appointment." ' +
      "A description of the trade is not a purpose.",
  },

  // WHAT THIS STEP IS FOR, AND ALL IT IS FOR (owner's call, 2026-08-24): the
  // page list and the routes. Which pages exist, what each is called, where it
  // lives. `role` — a clause about what a page was FOR — is gone with the rest
  // of the old description; `pageList` still READS a stored one so no existing
  // site loses its pages on a revise, which is the half that matters.
  //
  // TWO OF THE DELETED SENTENCES WERE FACTS RATHER THAN CRAFT, and both fail
  // SILENTLY now rather than making a page worse. Written down here because
  // nothing else states them where a model can reach.
  //
  //   "at most 6" is `MAX_PAGES`, and `pageList` CUTS at it. A model that
  //   answers eight has two dropped with no error and no note — the site is
  //   quietly two pages short of what it planned, and `shape` and `images`
  //   entries for those two are then dropped as well, because both validate
  //   against the surviving list.
  //
  //   'Include the home page as "/"' is load-bearing at a different layer.
  //   `validatePages` cannot know which of five pages is home, and
  //   `publishPages` REFUSES to publish a site with no `index.tsx` rather than
  //   shipping one whose root URL renders nothing. So a plan with no "/" does
  //   not degrade — it ends the build at `stage: "home"`.
  //
  // The caps and the refusal are unchanged: they live in `pageList`,
  // `validatePages` and `publishPages`, none of which reads this description.
  // What has gone is the model being told about them.
  pages: {
    type: "array",
    items: {
      type: "object",
      properties: {
        // NO EXAMPLE PAGE NAMES, and that is the owner's correction rather than
        // brevity. The first draft read "Home, Booking, Menu" — and the one
        // thing a model reliably does with a worked example is copy it, which
        // is the whole finding the family-exemplar and reference-page deletions
        // rest on. Three names in this description is a menu, and every site
        // comes out with the same three pages whatever trade it is.
        name: { type: "string", description: "What this page is called, as it would read in the nav." },
        // THE FORMAT IS STATED AND NO PAGE IS NAMED, because these are FACTS
        // about our own pipeline rather than craft: `PATH_OK` refuses a
        // trailing slash, an extension, a capital, a missing leading slash or
        // any character outside [a-z0-9-] — and a refused path DROPS the page
        // SILENTLY. The home page being "/" is the one the model cannot get
        // anywhere else, and a site with no "/" has no front door.
        path: {
          type: "string",
          description:
            'Its route. The home page is "/". Every other page is a leading slash then lowercase ' +
            "words with hyphens for spaces — no trailing slash, no file extension.",
        },
      },
      required: ["name", "path"],
    },
    description:
      `Which pages this site has, at most ${MAX_PAGES}. Decide how many it needs, what each one is ` +
      "called, and its route. Nothing else — this step is the page list and the routes.",
  },


  // LAST, AND THAT IS THE DESIGN — see PLAN_KEYS. By the time this is filled in
  // the page list above it is already written, so the pick is made for THESE
  // pages rather than for a trade.
  components: {
    type: "array",
    items: { type: "string" },
    description:
      `As many components from the kit as this site needs, at most ${MAX_COMPONENTS}. ` +
      "THIS IS A MANIFEST, NOT A SHORTLIST: the step that writes the pages is shown the exact props of the " +
      "components you name here, so one you leave out is one it has to guess the props of — and a wrong guess " +
      "costs that page. You have just written the page list above; name what those pages need, the ordinary " +
      "parts as well as the distinctive ones. A booking page wants availability-grid and week-strip, a menu " +
      "wants menu-section and price-list, a live board wants countdown and live-badge. " +
      "A records screen wants data-table with row-actions, pagination and stat-card, not a stack of cards. " +
      "Naming a component that does not exist is refused and costs nothing; leaving one out is what hurts.\n\n" +
      // THE WHOLE KIT, MOST-USED FIRST — and the order is information rather than
      // formatting: the head is what a small business site nearly always needs
      // and the tail is what one site in fifty does. Named here because a
      // compelled field with no list is answered from imagination, and most of
      // this kit is named things no model would guess.
      //
      // ALL 2,112 SINCE 2026-08-21. It was the 279-name `KIT_PALETTE`, measured
      // off 324 brochure pages — so a CRM's own components sat at median
      // position #154 and twelve app parts were nameable by nobody. See
      // COMPONENT_MENU for the measurement and the cost.
      "Pick from these — the whole kit, most-commonly-needed first. The head is what most sites need; " +
      "read further for a records screen, a dashboard or an internal tool:\n" + COMPONENT_MENU.join(", ") + ".",
  },
};

/**
 * `shape` IS A PLAN FIELD AND IS NOT IN `PLAN_FIELDS`, which is the one thing to
 * understand about this file's shape (owner's call, 2026-08-21).
 *
 * It is spliced into `design_schema` AFTER `mode` — last of every front-end
 * field — rather than beside its four plan siblings. A tool's property order is
 * its generation order, which is why `components` is pinned last inside
 * `PLAN_FIELDS`: it is chosen after the page list it has to serve. The same
 * argument runs one level up and further. `shape` is the field that says where
 * things GO, so it is worth the least when it is answered first and the most
 * when it is answered last: written after `mode`, the model has already fixed
 * the purpose, the page set, the primary verb, the component manifest, the
 * typeface, the palette, all 23 style axes and light-or-dark, and it is
 * arranging a page whose parts are all decided rather than guessing at a
 * layout for parts it has not chosen yet.
 *
 * AND IT IS PER PAGE (owner's call, 2026-08-21): *"the only thing I want in this
 * step is that it organises where the components and everything else goes —
 * per page."* It was three lines about the SITE, printed between the purpose and
 * the page list, so a four-page site got one paragraph of layout and the page
 * writer decided — page by page — which of the 24 components in the manifest
 * went where, and in what order. Nothing said. Now each entry names a page and
 * lists its bands top to bottom, and the directive nests them under that page.
 *
 * WHAT LEFT WITH THE OLD FORM, stated rather than quietly dropped: line 3 was
 * "the rule this kind of site fails by breaking" — *"stale-looking data is the
 * failure"*, *"dead ends are the failure"* — which is a genuinely site-wide fact
 * and has no home in a per-page field. It is NOT relocated into `purpose`: that
 * field answers what the site is organised around, and a second question folded
 * into it is the "two answers about one thing" trap this file already records.
 * If it turns out to have been doing work, it comes back as its own field.
 *
 * Its own description had said the purpose is "the sentence every other choice
 * on this call follows from" while sitting fourteenth of twenty-three — so the
 * plan block as a whole was answered after most of what it claimed to lead.
 * Moving `shape` does not fix that for `purpose`; it fixes it for the field
 * where the ordering does the most work.
 *
 * THE COST, STATED: the five plan fields are no longer contiguous in the tool,
 * so reading `design_schema` no longer shows the plan in one place. `PLAN_KEYS`
 * is still all five and is still what every guard derives from — it is the
 * SEMANTIC set (what `normalizePlan` produces, what `EDIT_FIELDS` allows, what
 * a look edit escalates on), and it deliberately no longer mirrors the tool's
 * property order. The test that asserted those two agreed now asserts the
 * split instead, or it would be a claim about nothing.
 */
/**
 * THE PRIMARY VERB, ANSWERED LATE (owner's call, 2026-08-24).
 *
 * It was fourth of five inside `PLAN_FIELDS`, between `pages` and
 * `components`. The owner's ordering puts it at 15 — after the whole front end
 * AND after the backend — so it leaves the spread the way `shape` and `images`
 * already have, rather than being reordered inside it. `PLAN_KEYS`,
 * `PLAN_REQUIRED` and `PLAN_EDIT_FIELDS` are untouched: this moves WHEN it is
 * answered, nothing about what it is.
 *
 * WHAT THAT COSTS, WRITTEN DOWN RATHER THAN GLOSSED. Its own description says
 * the verb "leads the header, the hero and the closing band" — three placements
 * that `components` (6) and `shape` (7) now choose BEFORE the verb exists. The
 * model picks the manifest and arranges every band, and only then names the
 * thing they are meant to lead with. Nothing breaks; the arrangement is simply
 * made without one input it used to have.
 */
export const ACTION_FIELD = {
  type: "array",
  items: { type: "string" },
  description:
    'The primary verb, worded as the button says it: ["Book now", "Check availability"]. ' +
    "It leads the header, the hero and the closing band, so it has to be the ONE thing you want a visitor " +
    'to do. Never "Learn more".',
};

export const SHAPE_FIELD = {
  type: "array",
  items: {
    type: "object",
    properties: {
      path: { type: "string", description: "One of the paths you listed in `pages`. Anything else is dropped." },
      sections: {
        type: "array",
        items: { type: "string" },
        description:
          `The page TOP TO BOTTOM, one short line a band, in order — at most ${MAX_SECTIONS}. ` +
          "The first is what LEADS. Name the component that carries the band and say what goes in it.",
      },
    },
    required: ["path", "sections"],
  },
  description:
    "WHERE EVERYTHING GOES, ONE ENTRY PER PAGE.\n" +
    "The pages and the component manifest are already decided above, so arrange what you have " +
    "chosen rather than describing a mood. The primary action is NOT yet named — say where the " +
    "site's main call to action sits and let the wording come later.\n" +
    "Examples:\n" +
    '  {"path": "/", "sections": [' +
    '"hero — the shop, the town, and the Book a chair button", ' +
    '"service-list — the price list, sectioned, prices on the right", ' +
    '"team-grid — the four barbers", ' +
    '"map-card — the address and the opening hours"]}\n' +
    '  {"path": "/deals", "sections": [' +
    '"filter-bar — search, and a filter by stage", ' +
    '"data-table — every deal, with row-actions and pagination", ' +
    '"empty-state — when nothing matches"]}\n' +
    "A page you leave out is one the page writer arranges itself, so leave out the ones with " +
    "nothing to say. A vague band produces a vague page.",
};

/**
 * THE PHOTOGRAPHS, AND THIS IS THE LAST FIELD ON THE CALL (owner's call,
 * 2026-08-23): *"lets move image generator to the designer."*
 *
 * IT WAS SPLIT ACROSS TWO PLACES AND THE DESIGNER WAS IN NEITHER. How many
 * pictures a site got was a RULE — `planBudget` counting the home page plus any
 * page whose components read as picture-led — and what each one was OF came from
 * the PAGE-GENERATION call, which writes `@@IMG:…@@` tokens. So the number was
 * derived from an answer the designer gave for another purpose, and the subject
 * was chosen by a model that had never seen the site's look.
 *
 * THE MEASUREMENT THAT SETTLED WHERE IT BELONGS: `page-gen.mjs` contains ZERO
 * references to the `css` the designer wrote. So the model describing the
 * photographs could not know it was dressing a near-black recording studio — it
 * had the brief and the layout and not one word about the palette. The designer
 * has all three by the time it reaches this field, which is the whole argument
 * for moving it rather than merely re-wording the directive.
 *
 * LAST, PAST `shape`, FOR THE REASON `shape` ITSELF IS LATE. By here the palette
 * is written (field 9), the pages are chosen, the verb is fixed, the manifest is
 * picked and every page is arranged band by band — so "the hero on `/`" is a
 * band this model just placed rather than one it is guessing at.
 *
 * OPTIONAL, AND AN OMISSION IS NOT SILENCE. `planBudget` falls back to the
 * derived rule when there is no readable list, which is what keeps every site
 * built before today working: their stored plans have no `images` at all, and
 * reading that as "none" would suppress photographs on the next revise of every
 * one of them. An EMPTY ARRAY is different and is honoured — that is a site
 * saying it wants none, which a CRM or a terminal-styled site legitimately does.
 * (THAT SENTENCE WAS FALSE from 2026-08-23 to 2026-08-27: `normalizePlan`
 * dropped an explicit `[]` on the way through and `mergeLook` read one as
 * silence, so the single documented way to say "none" was structurally
 * unsendable and the derived rule bought a photograph anyway — four
 * consecutive builds against a brief saying "no photographs anywhere". Both
 * layers are fixed, and each carries the reasoning at the line that had it.)
 *
 * IT SAYS WHAT, NOT WHERE ON THE PAGE. The page writer writes the JSX, so it
 * places the token; this decides that the picture exists and what it shows.
 * Splitting it further would mean the designer naming a component slot it cannot
 * see the props of.
 */
export const IMAGES_FIELD = {
  type: "array",
  items: {
    type: "object",
    properties: {
      page: { type: "string", description: "One of the paths you listed in `pages`. Anything else is dropped." },
      describe: {
        type: "string",
        description:
          "What the photograph SHOWS, in a sentence — the subject, the light, the framing. " +
          "This is sent to an image model verbatim, so write it as a picture and not as a caption: " +
          '"the shop front at dusk, warm light through the window, shot from across the street" — ' +
          'not "our shop".',
      },
    },
    required: ["page", "describe"],
  },
  description:
    "THE REAL PHOTOGRAPHS THIS SITE GETS. Leave it out and the site is judged by the ordinary rule; " +
    "send an empty list to say it should have none.\n" +
    "THE BRIEF'S OWN WORDS ABOUT PHOTOGRAPHS ARE LAW: if it says the site should have none, the answer " +
    "is an empty list — not one tasteful exception. And a `tool` site gets no photographs whatever is " +
    "sent here.\n" +
    "EACH ONE COSTS THE CUSTOMER REAL MONEY, so ask for a picture only where it is the argument — the " +
    "opening, the work, the room — and never for decoration. Most small sites want one or two; a gallery " +
    "or a portfolio is what wants more.\n" +
    "You have just arranged every page, so describe pictures that belong to " +
    "THAT site: a near-black studio and a bright bakery want different light in the frame.\n" +
    "Everything you do not ask for here still renders — as the theme's own placeholder, which is a " +
    "deliberate look and not a gap. The owner fills those in after the build.",
};

/**
 * The schema fragment for a plan key, wherever it happens to live.
 *
 * ONE READER OF THE SPLIT. Four of the five are in `PLAN_FIELDS` and `shape` is
 * its own export, so every caller that walks `PLAN_KEYS` and looks the field up
 * would otherwise need its own copy of that fact — and a copy is what drifts.
 * Two guards walk the keys today ("every plan key has a field the designer can
 * answer" and "every compelled field TELLS it something"); both go through here,
 * so a sixth field placed somewhere else again is covered by both without
 * anybody remembering either file.
 *
 * Returns undefined for a key with no fragment, which is exactly what those
 * guards are looking for.
 */
export function planFieldFor(key) {
  if (key === "shape") return SHAPE_FIELD;
  if (key === "images") return IMAGES_FIELD;
  if (key === "action") return ACTION_FIELD;
  return PLAN_FIELDS[key];
}

/** All five are required — every one is a line of the directive. */
export const PLAN_REQUIRED = PLAN_KEYS.slice();
