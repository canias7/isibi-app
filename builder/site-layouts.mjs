// What shape a generated site is.
//
// THE THIRD AXIS. Themes (site-theme.mjs) vary how a site LOOKS; the reference
// pages carry the grammar every site shares (chrome, states, buttons where
// decisions happen); this module varies how a site is ARRANGED — the hero
// pattern, the body rhythm, and which verb leads. The source document is
// builder/LAYOUTS.md (owner-authored, 24 families); the two are held in
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

// The eight cross-cutting variants from LAYOUTS.md — any family can be
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

/* ----------------------------------------------------------------- families */

/**
 * Each family: `md` is the numbered heading in LAYOUTS.md; `label` completes
 * the sentence "<name> — <label>"; `shape` is the arrangement in 2–4 lines;
 * `cta` is the verb family that leads the header, the hero and the closing
 * band; `kinds` is who this is for (free text, matched against the brief);
 * `components` is what to reach for FIRST — every name is guarded against the
 * ui folder on disk, so a typo here fails the suite, not a build.
 *
 * `pages` is THE PAGE SET — how many pages a site of this family ships and
 * what each one is for. It is a family property, not a global cap: a café is
 * one scroll, a docs site is four linked pages, and flattening that to a
 * uniform count is how every generated site ends up the same site. The
 * reference app at src/family-pages/<family>/ carries EXACTLY these files
 * (test-enforced both directions), so every declared page has a rendered,
 * compiling proof. `index` is always first; every other entry is a flat route
 * file (`book` → /book).
 */
export const FAMILIES = {
  "booking-first": {
    md: "Booking-first",
    label: "the slot picker is the hero; everything else supports the appointment",
    cta: ["Book now", "Check availability"],
    shape: [
      "hero: the booking surface itself, or one button straight to it, with the open-now answer beside it",
      "body: services and prices, then the people or the proof, then find-us",
      "the booking action repeats after every section that builds the case for it",
    ],
    pages: [
      { file: "index", role: "the case and today's slots — everything funnels to /book" },
      { file: "book", role: "the booking form itself; it arrives knowing the service when a price row sent it" },
      { file: "manage", role: "an existing appointment, reached from its claim link — view, move, cancel" },
      { file: "work", role: "the work itself — a gallery of finished sets, because nails are a visual trade" },
    ],
    kinds: ["salon", "spa", "nail studio", "clinic", "dental", "therapy", "tattoo studio", "home services", "fitness studio", "yoga"],
    components: ["availability-grid", "week-strip", "day-schedule", "price-list", "team-grid", "open-now", "opening-hours", "booking-summary"],
    variants: {
      "call-now": "home services: the phone IS the booking channel — a tel: link leads, the form is the fallback",
      "class-schedule": "fitness: the weekly timetable replaces the slot picker as the hero",
    },
    ready: true,
  },

  "inventory-first": {
    md: "Inventory / search-first",
    label: "filter rail beside a result grid; the search bar sits above or replaces the hero",
    cta: ["View listing", "Save", "Inquire"],
    shape: [
      "hero: the search input, or none at all — results start immediately",
      "body: a filter rail beside the grid; every card opens a detail page",
      "counts and sort stay visible, so the visitor always knows what they are looking at",
    ],
    pages: [
      { file: "index", role: "search, the filter rail, the results — browsing starts immediately" },
      { file: "listing", role: "one property told fully — the gallery, the facts, the viewing enquiry" },
      { file: "landlords", role: "the OTHER audience — what managing costs, what it includes, the valuation ask" },
    ],
    kinds: ["real estate", "car dealership", "job board", "rentals", "travel", "hotel"],
    components: ["search-input", "search-facets", "filter-bar", "facet-range", "sort-select", "result-count", "property-card", "vehicle-card", "pagination"],
    variants: {
      "date-picker": "travel and hotel: dates and party size come before any results (date-range-picker)",
    },
    ready: true,
  },

  "evidence-first": {
    md: "Evidence-first",
    label: "the work speaks — large imagery, minimal copy, contact is the destination",
    cta: ["Start a project", "Inquire"],
    shape: [
      "hero: the strongest single piece of work, uncrowded",
      "body: the portfolio (gallery or case studies), then who vouches, then the enquiry",
      "copy stays short everywhere; the pictures carry the argument",
    ],
    pages: [
      { file: "index", role: "the strongest work, uncrowded; every piece leads to /project or /contact" },
      { file: "project", role: "one commission told as a story — the brief, the day, the pictures" },
      { file: "contact", role: "the enquiry — dates, place, one form; the destination the whole site points at" },
      { file: "pricing", role: "the packages, priced in the open — the question every enquiry asks first" },
    ],
    kinds: ["agency", "consultancy", "law firm", "architecture", "interior design", "photographer", "videographer", "wedding vendor"],
    components: ["gallery", "masonry", "case-study-card", "before-after", "lightbox", "press-quote", "testimonial", "logo-cloud"],
    variants: {},
    ready: true,
  },

  "feed-first": {
    md: "Feed / archive-first",
    label: "reverse-chronological stream; the newest thing on top, nav secondary",
    cta: ["Read", "Subscribe"],
    shape: [
      "hero: none, or the latest entry itself",
      "body: one column of entries, each with byline, date and reading time",
      "the archive is reachable but never in the way of the newest thing",
    ],
    pages: [
      { file: "index", role: "the stream — newest on top, the subscribe capture riding mid-feed" },
      { file: "episode", role: "one entry in full — the player, the notes, who was in it" },
      { file: "archive", role: "everything ever published in one dense list, filterable" },
      { file: "about", role: "who makes it, how it's made, how to pitch or sponsor — the page other media checks" },
    ],
    kinds: ["publication", "blog", "magazine", "podcast", "newsletter", "creator", "personal brand"],
    components: ["article-card", "author-byline", "reading-time", "post-meta", "tag-list", "audio-player", "episode-row", "email-capture", "pagination"],
    variants: {
      "single-column-capture": "newsletter: the subscribe form is the hero and the archive is the proof below it",
      "link-hub": "creator: a thumb-width vertical stack of link-cards, nothing else",
    },
    ready: true,
  },

  "product-first": {
    md: "Product-first",
    label: "the thing itself is the hero — screenshot, render, or trailer",
    cta: ["Sign up", "Buy", "Download"],
    shape: [
      "hero: the product shown working, beside one sentence of what it does",
      "body: proof in descending strength — features, who uses it, pricing, questions",
      "one signup path, repeated; never two competing actions",
    ],
    pages: [
      { file: "index", role: "the pitch — the product working, proof in descending strength, one signup path" },
      { file: "pricing", role: "the plans side by side, what each includes, the objections answered" },
      { file: "support", role: "help that actually helps — the common fixes, then a human; app stores require this page" },
    ],
    kinds: ["SaaS", "mobile app", "hardware", "game", "developer tool", "API"],
    components: ["hero-split", "feature-grid", "pricing-table", "plan-card", "logo-cloud", "comparison-table", "faq", "video-embed", "store-badges", "changelog-entry"],
    variants: {
      "docs-sidebar": "developer tool: the install command and docs nav sit high (sdk-tabs, code-block)",
    },
    ready: true,
  },

  "conversion-single": {
    md: "Conversion-single-purpose",
    label: "one page, one action; everything is subordinate to a single button",
    cta: ["Donate", "Register", "Enroll", "Join"],
    shape: [
      "hero: the cause or the event, with the one action beside it",
      "body: each section answers one objection, then repeats the same button",
      "nothing links away; the page is a funnel with no exits",
    ],
    pages: [
      { file: "index", role: "the ONLY page — one action, every section re-earns the same button, nothing links away" },
    ],
    kinds: ["nonprofit", "event", "conference", "course cohort", "community", "membership", "coming soon"],
    components: ["cta-band", "countdown", "ticket-tiers", "donation-card", "event-card", "agenda-list", "steps", "stats-band", "waitlist-form", "faq"],
    variants: {},
    ready: true,
  },

  "trust-first": {
    md: "Trust-first",
    label: "credentials, licensing and proof before any pitch; conservative typography",
    cta: ["Free consultation", "Get a quote"],
    shape: [
      "hero: who we are and what we are licensed for, stated plainly",
      "body: the people with their credentials, then who vouches, then the consultation form",
      "conservative rhythm throughout — no gimmick earns its place here",
    ],
    pages: [
      { file: "index", role: "who we are and what we are licensed for, before any pitch" },
      { file: "services", role: "each practice area stated plainly — what it covers, what it costs to start" },
      { file: "contact", role: "the consultation form, with who answers it and how fast" },
      { file: "about", role: "the firm itself — history, regulation, how it charges; the page trust is checked against" },
    ],
    kinds: ["accounting", "tax", "bookkeeping", "insurance broker", "financial advisor", "medical specialist", "childcare", "eldercare", "tutoring", "veterinary"],
    components: ["trust-strip", "profile-card", "verified-badge", "award-badge", "testimonial", "press-quote", "faq", "contact-form"],
    variants: {
      "booking-hybrid": "veterinary and clinics: the slot picker appears after trust is established, not before",
    },
    ready: true,
  },

  "menu-first": {
    md: "Menu-first",
    label: "the list of things IS the page; often single-scroll, sometimes no nav at all",
    cta: ["Order", "Reserve", "Directions"],
    shape: [
      "hero: thin — the name, the open-now answer, and directions",
      "body: the menu itself, sectioned, prices on the right",
      "hours and the address stay within one scroll of wherever the visitor is",
    ],
    pages: [
      { file: "index", role: "the ONLY page — the menu IS the site; hours and directions ride within one scroll" },
    ],
    kinds: ["café", "deli", "food truck", "bakery", "catering", "bar", "brewery", "ghost kitchen"],
    components: ["menu-section", "price-list", "dish-card", "open-now", "opening-hours", "location-card"],
    variants: {
      "order-form": "bakery and catering: a collect form rides beside the menu",
      "tap-list": "bar and brewery: what is pouring NOW leads, dense price-list rows",
      "order-widget": "delivery-native: the order path sits above everything else",
    },
    ready: true,
  },

  "location-first": {
    md: "Location-first",
    label: "the locator is load-bearing; nearest-to-you is the first answer",
    cta: ["Find nearest", "Get directions"],
    shape: [
      "hero: the locator — postcode in, nearest branch out",
      "body: per-location hours, stock and contact; everything else after",
    ],
    pages: [
      { file: "index", role: "the locator — postcode in, nearest branch out" },
      { file: "location", role: "one branch's own page — hours, timetable, how to join" },
      { file: "memberships", role: "the plans compared — one price everywhere is the chain's whole pitch, so say it" },
    ],
    kinds: ["franchise", "gym chain", "coworking", "dispensary", "pharmacy", "hotel group", "retail with pickup"],
    components: ["store-locator", "map-embed", "location-card", "open-now", "distance-badge", "pickup-point", "stock-badge"],
    variants: {
      "property-switcher": "hotel group: switch between properties rather than search for one",
      "in-stock-near-you": "retail: the stock answer per branch is the point of the page",
    },
    ready: true,
  },

  "narrative-first": {
    md: "Credential / narrative-first",
    label: "one person is the product — portrait, story, then proof of authority",
    cta: ["Book me", "Apply", "Follow"],
    shape: [
      "hero: the portrait and one line of positioning",
      "body: the story first person, then the proof as a timeline — talks, releases, press",
      "one ask at the end, not five",
    ],
    pages: [
      { file: "index", role: "the portrait, the story, the proof — in that order" },
      { file: "press", role: "the press kit — a bio at three lengths, photos, quotes ready to lift" },
      { file: "music", role: "the work itself — releases with players; a musician's site without the music is a CV" },
    ],
    kinds: ["résumé", "speaker", "author", "coach", "consultant", "campaign", "artist", "musician"],
    components: ["profile-card", "timeline", "quote", "press-quote", "event-card", "tour-dates", "gallery", "social-links"],
    variants: {
      "donate-volunteer-split": "campaign: two primary actions of equal weight, donate and volunteer",
    },
    ready: true,
  },

  "docs-first": {
    md: "Documentation-first",
    label: "persistent sidebar, dense internal linking, search always visible",
    cta: ["Copy install command", "Get started"],
    shape: [
      "hero: the install command, copyable, and nothing else",
      "body: a persistent sidebar beside the content; search never leaves the header",
      "every page links sideways — dead ends are the failure",
    ],
    pages: [
      { file: "index", role: "the install command and the doors in — running in a minute" },
      { file: "guide", role: "the walkthrough — install to first result, in order, with the sidebar" },
      { file: "api", role: "the reference — every call with its arguments and returns, linkable" },
      { file: "changelog", role: "reverse-chronological, no marketing — what changed and when" },
      { file: "examples", role: "the cookbook — whole working recipes for the jobs people actually have" },
    ],
    kinds: ["API reference", "SDK docs", "open source project", "help center", "knowledge base", "changelog", "status page"],
    components: ["install-command", "side-nav", "table-of-contents", "search-input", "code-block", "copy-button", "curl-example", "sdk-tabs", "prev-next", "anchor-heading", "changelog-entry"],
    variants: {},
    ready: true,
  },

  "data-first": {
    md: "Data-first",
    label: "the numbers, or the interface showing them, are the hero",
    cta: ["Try it", "Download report", "Compare"],
    shape: [
      "hero: the headline numbers themselves, or the dashboard doing its job",
      "body: the comparison above the fold when comparing is the product; the chart lib (@/components/charts/lib) carries anything a table cannot",
      "every figure is tabular-nums and every claim has its number beside it",
    ],
    pages: [
      { file: "index", role: "the numbers themselves, above any prose" },
      { file: "methodology", role: "how the numbers were made — sources, sample, what was excluded; the trust page" },
      { file: "report", role: "the annual deep-dive — what's inside, the headline findings, the capture that gates it" },
    ],
    kinds: ["dashboard product", "analytics", "BI tool", "pricing calculator", "comparison site", "research report"],
    components: ["big-number", "stats-band", "sparkline", "metric-delta", "gauge", "data-table", "comparison-table", "calculator-card", "donut-mini"],
    variants: {},
    ready: true,
  },

  institutional: {
    md: "Institutional",
    label: "audience-split navigation; several unrelated journeys share one homepage",
    cta: ["Apply", "Find", "Pay", "Visit"],
    shape: [
      "hero: the audience switch — who are you, and the page rearranges for the answer",
      "body: tasks over marketing; search prominent; events and notices as first-class sections",
    ],
    pages: [
      { file: "index", role: "the audience switch — the page rearranges for who you are" },
      { file: "apply", role: "the prospective journey — dates, steps, the application itself" },
      { file: "visit", role: "open days and getting here — times, travel, what to expect" },
      { file: "courses", role: "the course finder — searchable, honest about entry requirements per subject" },
    ],
    kinds: ["university", "school", "government", "municipal", "hospital system", "museum", "gallery", "church"],
    components: ["audience-switch", "category-nav", "search-header", "event-card", "faq", "steps", "download-card"],
    variants: {},
    ready: true,
  },

  immersive: {
    md: "Media-heavy / immersive",
    label: "full-bleed imagery or video, minimal chrome, sparse type, scroll as choreography",
    cta: ["Explore", "Configure", "Shop"],
    shape: [
      "hero: the media takes the whole first screen; the name floats over it",
      "body: long full-bleed passages with sparse type between them; chrome nearly disappears",
      "motion is the grammar here — reveals and parallax carry the pacing",
    ],
    pages: [
      { file: "index", role: "the media takes the first screen; chrome nearly disappears" },
      { file: "rooms", role: "the offering as full-bleed passages — one each, sparse type between" },
      { file: "dining", role: "the table — one sitting, one menu, the same full-bleed restraint" },
    ],
    kinds: ["fashion brand", "car manufacturer", "luxury hospitality", "film", "show", "design studio"],
    components: ["video-hero", "gallery", "lightbox", "before-after", "marquee", "parallax", "snap-sections", "full-bleed", "progressive-image"],
    variants: {},
    ready: true,
  },

  transactional: {
    md: "Transactional utility",
    label: "no marketing — form, state, confirmation; layout discipline over expression",
    cta: ["Submit", "Continue", "Pay"],
    shape: [
      "hero: none — the form starts where the page does",
      "body: one step visible at a time, progress shown, every terminal state designed",
      "success, failure, 404 and maintenance are pages, not afterthoughts",
    ],
    pages: [
      { file: "index", role: "the form — it starts where the page does" },
      { file: "status", role: "an existing application looked up and answered plainly" },
      { file: "done", role: "the confirmation — reference number, what happens next; a designed page, not an afterthought" },
      { file: "maintenance", role: "the down-for-works page, designed on purpose — when it's back, what still works, who to ring" },
    ],
    kinds: ["customer portal", "billing", "support ticket", "confirmation page", "checkout", "waitlist"],
    components: ["multi-step-form", "form-progress", "form-section", "steps", "order-summary", "receipt", "success-panel", "not-found", "maintenance-page"],
    variants: {},
    ready: true,
  },

  regulated: {
    md: "Regulated / disclosure-heavy",
    label: "compliance blocks are structural, not footnotes; gates and disclaimers shape the page",
    cta: ["Open account", "Verify age", "View rates"],
    shape: [
      "hero: gated where the law requires it — nothing renders before the gate",
      "body: rates and terms as first-class sections in real tables, not fine print",
      "the compliance footer is part of the design, present on every page",
    ],
    pages: [
      { file: "index", role: "the gate first, then the goods — nothing renders before the age answer" },
      { file: "terms", role: "the disclosures as a first-class page — delivery, returns, licensing, in real sections" },
      { file: "tastings", role: "the events — gated like the shelf, booked like a class, licence rules stated" },
    ],
    kinds: ["bank", "credit union", "crypto exchange", "pharma", "cannabis retail", "gambling", "sportsbook"],
    components: ["age-gate", "terms-block", "consent-checkbox", "data-table", "pricing-table", "faq"],
    variants: {},
    ready: true,
  },

  "time-sensitive": {
    md: "Time-sensitive",
    label: "live state is the content — countdowns, ends-in timers, freshness shown",
    cta: ["Bid", "Buy now", "Refresh"],
    shape: [
      "hero: the clock — what is live now and when it ends",
      "body: the live board, with its freshness visible; stale-looking data is the failure",
    ],
    pages: [
      { file: "index", role: "what is live right now, each with its clock; freshness visible" },
      { file: "event", role: "one night in full — the countdown, the tiers, what remains" },
      { file: "season", role: "everything on sale — the whole board, each show carrying its own urgency state" },
    ],
    kinds: ["ticketing", "box office", "auction", "flash sale", "drop", "live results", "status board"],
    components: ["countdown", "countdown-ring", "deadline-bar", "live-badge", "refresh-pill", "time-until", "seat-map", "bid-box", "big-number", "viewer-count"],
    variants: {},
    ready: true,
  },

  "membership-gated": {
    md: "Membership-gated",
    label: "two different sites — logged-out is a pitch, logged-in is a product",
    cta: ["Subscribe", "Log in", "Join"],
    shape: [
      "logged out: a pitch page whose proof is a taste of the real thing",
      "logged in: the product itself, no marketing left anywhere",
      "the wall is designed, not a dead end — it shows what it is refusing",
    ],
    pages: [
      { file: "index", role: "logged out — the pitch, and a wall that shows what it is refusing" },
      { file: "letters", role: "logged in — the product itself, no marketing left anywhere" },
      { file: "account", role: "the membership — plan, renewal, sign out" },
      { file: "letter", role: "one letter, read in full — the surface the membership actually buys, wall-free" },
    ],
    kinds: ["paywalled publication", "private community", "alumni portal", "fan club", "B2B customer portal"],
    components: ["paywall", "login-form", "signup-form", "membership-card", "plan-card", "pricing-table", "upgrade-badge"],
    variants: {},
    ready: true,
  },

  industrial: {
    md: "Industrial / B2B non-SaaS",
    label: "specs, downloads and quote paths; pricing often behind auth",
    cta: ["Request quote", "Download spec", "Find distributor"],
    shape: [
      "hero: what is made and to what tolerance — the claim a buyer checks first",
      "body: spec tables and downloads lead; the quote path is the conversion",
    ],
    pages: [
      { file: "index", role: "what is made and to what tolerance; the quote path is the conversion" },
      { file: "product", role: "one line in full — the spec table and the downloads" },
      { file: "quote", role: "the RFQ — part, quantity, spec upload, who to call back" },
      { file: "stockists", role: "where to buy without an account — the distributor list, nearest first" },
    ],
    kinds: ["manufacturer", "logistics", "freight", "construction", "wholesale", "distributor", "lab", "testing services"],
    components: ["spec-row", "feature-matrix", "data-table", "download-card", "file-list", "store-locator", "tracking-input", "contact-form"],
    variants: {},
    ready: true,
  },

  "recruiting-first": {
    md: "Recruiting-first",
    label: "filtered role list plus culture proof; sometimes dual-audience",
    cta: ["Apply", "Submit résumé", "Post a job"],
    shape: [
      "hero: the open roles, filterable, above any culture copy",
      "body: culture proof beside the list, not instead of it; outcomes where claimed",
    ],
    pages: [
      { file: "index", role: "the open roles, filterable, above the culture proof" },
      { file: "role", role: "one role in full — the work, the pay, the apply form" },
      { file: "life", role: "the culture proof, shown not claimed — the week, the room, the benefits as facts" },
    ],
    kinds: ["careers site", "staffing agency", "talent marketplace", "internship", "bootcamp"],
    components: ["job-card", "filter-bar", "search-input", "team-grid", "stats-band", "steps", "faq"],
    variants: {
      "dual-audience": "staffing: employers and seekers get two entry paths of equal weight",
    },
    ready: true,
  },

  educational: {
    md: "Educational",
    label: "curriculum tree or practice surface; progress is a visible element",
    cta: ["Enroll", "Start lesson", "Practice"],
    shape: [
      "hero: the outcome, then the path to it",
      "body: the curriculum as an ordered spine with progress visible on it",
      "outcomes and placement numbers wherever they are claimed",
    ],
    pages: [
      { file: "index", role: "the outcome, then the curriculum as an ordered spine" },
      { file: "lesson", role: "one lesson — the content, where you are on the path, what is next" },
      { file: "enroll", role: "joining — what the money buys, when cohorts start, the one form" },
    ],
    kinds: ["course platform", "interactive tutorial", "LMS", "practice tool", "library", "archive"],
    components: ["course-card", "curriculum-path", "chapter-list", "steps", "progress-ring", "completion-ring", "stats-band", "faq"],
    variants: {},
    ready: true,
  },

  "local-civic": {
    md: "Local & civic",
    label: "hours, address, contact, documents — utility over polish",
    cta: ["Visit", "Contact", "Download"],
    shape: [
      "hero: thin — the name, the open-now answer, the address",
      "body: notices, then documents as a first-class list, then contact",
      "utility over polish, deliberately; nothing here needs to impress",
    ],
    pages: [
      { file: "index", role: "hours, notices, documents, contact — utility over polish" },
      { file: "events", role: "what is on this month, listed plainly with dates and rooms" },
      { file: "join", role: "getting a card — who can, what it needs, what it unlocks; the library's one form" },
    ],
    kinds: ["HOA", "neighborhood", "library branch", "nonprofit chapter", "small-town municipal"],
    components: ["opening-hours", "open-now", "location-card", "contact-form", "download-card", "file-list", "faq", "announcement-bar"],
    variants: {},
    ready: true,
  },

  personal: {
    md: "Personal / niche web",
    label: "intimate scale, one narrative, often single-page",
    cta: ["RSVP", "Read", "Give"],
    shape: [
      "one column, one voice, often one page",
      "the story in order, then the single ask — RSVP, read, give",
    ],
    pages: [
      { file: "index", role: "the story in order, then the RSVP" },
      { file: "travel", role: "getting there and staying — trains, rooms, the shape of the day" },
      { file: "registry", role: "the gifts, put the intimate way — a few real things, the honeymoon pot, and permission to bring nothing" },
    ],
    kinds: ["wedding", "memorial", "baby registry", "single-page résumé", "digital garden", "link-in-bio"],
    components: ["rsvp-buttons", "event-card", "countdown", "gallery", "timeline", "quote", "social-links", "link-card"],
    variants: {},
    ready: true,
  },

  "ai-native": {
    md: "Emerging / AI-native",
    label: "the input is the hero — try before signup, the output is the proof",
    cta: ["Generate", "Try it", "Run"],
    shape: [
      "hero: the input box itself, working, with no wall in front of it",
      "body: the output beside or below the input; examples as suggestion chips",
      "signup comes after the visitor has already made something",
    ],
    pages: [
      { file: "index", role: "the ONLY page — the input works before any signup; the output is the proof" },
    ],
    kinds: ["chat-as-homepage", "agent builder", "workflow builder", "prompt gallery", "playground", "generative tool"],
    components: ["prompt-box", "chat-composer", "chat-thread", "chat-message", "suggestion-chips", "streaming-text", "before-after", "code-block", "regenerate-button", "model-picker"],
    variants: {},
    ready: true,
  },
};

/* -------------------------------------------------------------- mold-breakers */

// Two shapes LAYOUTS.md keeps outside the families. Same fields, same guards.
export const MOLD_BREAKERS = {
  marketplace: {
    md: "Two-sided marketplace",
    label: "supply and demand share one page — the toggle above the fold decides which you see",
    cta: ["Join", "List", "Find"],
    shape: [
      "hero: the two-sided switch — I need X / I offer X — and the page rearranges for the answer",
      "body: each side gets its own proof and its own action; neither is the default",
    ],
    pages: [
      { file: "index", role: "one page — the two-sided switch decides everything you see" },
    ],
    kinds: ["marketplace"],
    components: ["audience-switch", "search-input", "steps", "stats-band"],
    variants: {},
    ready: true,
  },
  directory: {
    md: "Directory",
    label: "the search bar is the entire homepage",
    cta: ["Search", "Browse"],
    shape: [
      "hero: one search input, centered, with suggestions under it",
      "body: nothing until asked — recent searches and categories are the only furniture",
    ],
    pages: [
      { file: "index", role: "one page — the search input IS the homepage" },
    ],
    kinds: ["directory"],
    components: ["search-input", "search-suggestions", "recent-searches", "result-count", "category-nav"],
    variants: {},
    ready: true,
  },
};

/* ------------------------------------------------------------------ helpers */

export const FAMILY_NAMES = Object.keys(FAMILIES);
export const READY_FAMILIES = FAMILY_NAMES.filter((n) => FAMILIES[n].ready);
export const STRUCTURE_NAMES = Object.keys(STRUCTURES);

/**
 * What a designer/classifier step may choose from — READY families only. A
 * not-ready family here would be an instruction to build a page around a
 * component that does not exist.
 */
export function familiesForPrompt() {
  return READY_FAMILIES
    .map((n) => `${n} — ${FAMILIES[n].label} (${FAMILIES[n].kinds.slice(0, 4).join(", ")})`)
    .join("\n");
}

export function structuresForPrompt() {
  return STRUCTURE_NAMES.map((n) => `${n} — ${STRUCTURES[n].text}`).join("\n");
}

/**
 * The text a build puts in the USER message. Null on anything unknown or not
 * ready — a directive is a promise about what the kit can do, so a wrong name
 * must fail loudly at the call site rather than produce a page that lints red.
 */
export function layoutDirective(family, { structure, variant } = {}) {
  const f = FAMILIES[family] ?? MOLD_BREAKERS[family];
  if (!f || !f.ready) return null;
  if (structure !== undefined && !STRUCTURES[structure]) return null;
  if (variant !== undefined && !f.variants[variant]) return null;

  const lines = [
    `LAYOUT — ${f.md}: ${f.label}.`,
    ...f.shape.map((s) => `- ${s}`),
    `Primary action: ${f.cta.map((c) => `"${c}"`).join(" / ")} — this verb leads the header, the hero, and the closing band.`,
    `Reach first for: ${f.components.join(", ")}.`,
    // The page COUNT is the family's, not a global default: a café is one
    // scroll and a docs site is four linked pages. The names are the
    // archetype's — keep the count and the division of labour, and rename the
    // routes for the business at hand where that reads better.
    `This family ships ${f.pages.length} page${f.pages.length === 1 ? "" : "s"}:`,
    ...f.pages.map((p) => `- ${p.file === "index" ? "/" : "/" + p.file} — ${p.role}`),
  ];
  if (variant) lines.push(`Variant — ${variant}: ${f.variants[variant]}.`);
  if (structure) lines.push(`Structure — ${structure}: ${STRUCTURES[structure].text}.`);
  return lines.join("\n");
}
