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
  salon: {
    md: "Salon, barber or clinic — booking-first",
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
      { file: "call-now", alt: true, role: "an ALTERNATIVE home for a mobile trade — the phone is the booking surface, because a grid cannot know the room" },
      { file: "class-schedule", alt: true, role: "an ALTERNATIVE home for a class studio — the week's timetable leads, because the question spans seven days" },
    ],
    kinds: ["salon", "spa", "nail studio", "clinic", "dental", "therapy", "tattoo studio", "home services", "fitness studio", "yoga",
      "hairdresser", "barber", "beautician", "massage", "piercing", "waxing", "aesthetics", "dog groomer",],
    components: ["availability-grid", "week-strip", "day-schedule", "price-list", "team-grid", "open-now", "opening-hours", "booking-summary"],
    structure: "single-scroll",
    ready: true,
  },

  "estate-agent": {
    md: "Estate agent, dealer or any big listing — search-first",
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
      { file: "date-picker", alt: true, role: "an ALTERNATIVE home for travel and hotels — dates and party size come before any result" },
    ],
    kinds: ["real estate", "car dealership", "job board", "rentals", "travel", "hotel"],
    components: ["search-input", "search-facets", "filter-bar", "facet-range", "sort-select", "result-count", "property-card", "vehicle-card", "pagination"],
    structure: "card-grid",
    ready: true,
  },

  agency: {
    md: "Agency, studio or practice — the work as evidence",
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
    kinds: ["agency", "consultancy", "law firm", "architecture", "interior design", "photographer", "videographer", "wedding vendor",
      "IT support", "managed service provider", "web design", "SEO agency", "copywriter", "translation", "virtual assistant", "branding", "PR agency", "market research",],
    components: ["gallery", "masonry", "case-study-card", "before-after", "lightbox", "press-quote", "testimonial", "logo-cloud"],
    structure: "editorial",
    ready: true,
  },

  podcast: {
    md: "Podcast, blog or newsletter — the feed is the page",
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
      { file: "single-column-capture", alt: true, role: "an ALTERNATIVE home for a newsletter — the subscribe form is the hero, the archive its evidence" },
      { file: "link-hub", alt: true, role: "an ALTERNATIVE home for a creator — one narrow stack of link-cards and nothing else" },
    ],
    kinds: ["publication", "blog", "magazine", "podcast", "newsletter", "creator", "personal brand"],
    components: ["article-card", "author-byline", "reading-time", "post-meta", "tag-list", "audio-player", "episode-row", "email-capture", "pagination"],
    structure: "single-scroll",
    ready: true,
  },

  software: {
    md: "Software product — product-first",
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
      { file: "docs-sidebar", alt: true, role: "an ALTERNATIVE home for a developer tool — the install command and docs nav sit high" },
    ],
    kinds: ["SaaS", "mobile app", "hardware", "game", "developer tool", "API"],
    components: ["hero-split", "feature-grid", "pricing-table", "plan-card", "logo-cloud", "comparison-table", "faq", "video-embed", "store-badges", "changelog-entry"],
    structure: "bento",
    ready: true,
  },

  campaign: {
    md: "One page, one ask — a fundraiser, launch or event",
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
    structure: "full-bleed-hero",
    ready: true,
  },

  accountant: {
    md: "Accountant, solicitor or adviser — trust-first",
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
      { file: "booking-hybrid", alt: true, role: "an ALTERNATIVE home for vets and clinics — the slot picker appears after trust, not before" },
    ],
    kinds: ["accounting", "tax", "bookkeeping", "insurance broker", "financial advisor", "medical specialist", "childcare", "eldercare", "tutoring", "veterinary",
      "payroll", "mortgage broker", "estate planning", "wills and probate", "auditor", "VAT specialist",],
    components: ["trust-strip", "profile-card", "verified-badge", "award-badge", "testimonial", "press-quote", "faq", "contact-form"],
    structure: "single-scroll",
    ready: true,
  },

  restaurant: {
    md: "Restaurant or café — menu-first",
    label: "the list of things IS the page; often single-scroll, sometimes no nav at all",
    cta: ["Order", "Reserve", "Directions"],
    shape: [
      "hero: thin — the name, the open-now answer, and directions",
      "body: the menu itself, sectioned, prices on the right",
      "hours and the address stay within one scroll of wherever the visitor is",
    ],
    pages: [
      { file: "index", role: "the ONLY page — the menu IS the site; hours and directions ride within one scroll" },
      { file: "order-form", alt: true, role: "an ALTERNATIVE home for a bakery or caterer — a collect form rides beside the menu" },
      { file: "order-widget", alt: true, role: "an ALTERNATIVE home for delivery-native food — the order path sits above everything else" },
      { file: "tap-list", alt: true, role: "an ALTERNATIVE home for a bar or brewery — what is pouring NOW leads, in dense rows" },
    ],
    kinds: ["café", "deli", "food truck", "bakery", "catering", "bar", "brewery", "ghost kitchen"],
    components: ["menu-section", "price-list", "dish-card", "open-now", "opening-hours", "location-card"],
    structure: "single-scroll",
    ready: true,
  },

  gym: {
    md: "Gym or any multi-branch business — location-first",
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
      { file: "property-switcher", alt: true, role: "an ALTERNATIVE home for a hotel group — switch between properties rather than search for one" },
      { file: "in-stock-near-you", alt: true, role: "an ALTERNATIVE home for multi-branch retail — the stock answer per branch is the point" },
    ],
    kinds: ["franchise", "gym chain", "coworking", "dispensary", "pharmacy", "hotel group", "retail with pickup",
      "leisure operator", "climbing centre", "swim school",],
    components: ["store-locator", "map-embed", "location-card", "open-now", "distance-badge", "pickup-point", "stock-badge"],
    structure: "split-screen",
    ready: true,
  },

  "personal-brand": {
    md: "One person's name as the brand — narrative-first",
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
      { file: "donate-volunteer-split", alt: true, role: "an ALTERNATIVE home for a campaign — two primary actions of equal weight" },
    ],
    kinds: ["résumé", "speaker", "author", "coach", "consultant", "campaign", "artist", "musician",
      "DJ", "band", "magician", "life coach",],
    components: ["profile-card", "timeline", "quote", "press-quote", "event-card", "tour-dates", "gallery", "social-links"],
    structure: "editorial",
    ready: true,
  },

  documentation: {
    md: "Developer documentation — reference-first",
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
    structure: "sidebar",
    ready: true,
  },

  research: {
    md: "Research, figures or a comparison — data-first",
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
    structure: "bento",
    ready: true,
  },

  college: {
    md: "College, council or hospital — a task register",
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
    structure: "single-scroll",
    ready: true,
  },

  hotel: {
    md: "Hotel, retreat or destination — media-heavy",
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
    structure: "full-bleed-hero",
    ready: true,
  },

  portal: {
    md: "A customer portal or utility — finish the task, leave",
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
    structure: "single-scroll",
    ready: true,
  },

  "licensed-trade": {
    md: "Licensed trade or regulated seller — disclosure-heavy",
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
    structure: "single-scroll",
    ready: true,
  },

  "box-office": {
    md: "Box office, auction or drop — the clock is the content",
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
    structure: "terminal",
    ready: true,
  },

  "paid-newsletter": {
    md: "Paid publication or private community — membership-gated",
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
    structure: "editorial",
    ready: true,
  },

  manufacturer: {
    md: "Manufacturer, wholesaler or trade supplier — spec-first",
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
    structure: "split-screen",
    ready: true,
  },

  careers: {
    md: "A careers site — roles-first",
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
      { file: "dual-audience", alt: true, role: "an ALTERNATIVE home for staffing — two entry paths of equal weight" },
    ],
    kinds: ["careers site", "staffing agency", "talent marketplace", "internship", "bootcamp",
      "recruitment agency", "apprenticeships", "graduate scheme", "outplacement",],
    components: ["job-card", "filter-bar", "search-input", "team-grid", "stats-band", "steps", "faq"],
    structure: "bento",
    ready: true,
  },

  course: {
    md: "A course you sell — curriculum-first",
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
    structure: "sidebar",
    ready: true,
  },

  library: {
    md: "Library, community group or small charity — utility-first",
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
    structure: "single-scroll",
    ready: true,
  },

  wedding: {
    md: "A wedding, party or personal occasion — one voice, one ask",
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
    structure: "single-scroll",
    ready: true,
  },

  "ai-tool": {
    md: "An AI tool — the prompt is the interface",
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
    structure: "terminal",
    ready: true,
  },

  store: {
    md: "Store — cart-first",
    label: "the products are the page and the basket is always in reach; checkout is the destination",
    cta: ["Add to cart", "Checkout"],
    shape: [
      "hero: the current range or one featured product — never a slogan without goods on the same screen",
      "body: the product grid with price and stock on every card; each card opens the product page",
      "the basket rides every page (cart-badge in the chrome); checkout is one page, not a tunnel",
    ],
    pages: [
      { file: "index", role: "the shop front — featured, the categories, the grid; every card opens /product" },
      { file: "product", role: "one product told fully — pictures, options, stock, and the add-to-cart moment" },
      { file: "checkout", role: "the basket becomes an order — lines, delivery, payment, one place-order bar" },
      { file: "single-product", alt: true, role: "an ALTERNATIVE home for one-product DTC — a long product story down the page, then buy" },
      { file: "catalogue", alt: true, role: "an ALTERNATIVE home for hundreds of SKUs — search and facets lead, the grid behaves like inventory" },
    ],
    kinds: ["ecommerce", "online store", "boutique", "fashion", "jewellery", "homeware", "furniture", "electronics", "bookshop", "gift shop", "pet supplies", "DTC brand", "subscription box",
      "toy shop", "pet shop", "carpet shop", "flooring shop", "blinds and curtains", "antiques", "garden centre", "hardware shop", "sports shop", "cycle shop",],
    components: ["product-card", "price-tag", "stock-badge", "add-to-cart", "quantity-input", "cart-badge", "cart-line", "cart-summary", "shipping-options", "payment-picker", "place-order-bar", "category-nav"],
    structure: "card-grid",
    ready: true,
  },

  crm: {
    md: "An internal tool — records-first, behind a sign-in",
    label: "signed-in software rather than a website — a table of records, filters, and one record opened fully",
    cta: ["Sign in", "New record"],
    shape: [
      "logged out is one screen: what the tool does, who it is for, and the sign-in — no marketing site attached",
      "logged in: a toolbar (search, filters, bulk actions) over the records table; a row opens the record",
      "the record view is header, fields, and the activity trail — edits happen where the record is read",
    ],
    pages: [
      { file: "index", role: "the door — what this tool is, the proof it works, and the sign-in itself" },
      { file: "records", role: "the work surface — search, filters, the table, bulk actions on a selection" },
      { file: "record", role: "one record opened fully — header, status, the fields, the activity trail" },
      { file: "board", alt: true, role: "an ALTERNATIVE home for stage-driven work — the kanban board replaces the table" },
      { file: "queue", alt: true, role: "an ALTERNATIVE home for a help desk — a priority inbox, and you reply where you read" },
    ],
    kinds: ["CRM", "project management", "help desk", "booking platform", "inventory management", "invoicing", "HR portal", "applicant tracking", "internal tool"],
    components: ["data-table", "table-search", "filter-bar", "bulk-actions", "record-header", "status-badge", "priority-badge", "assignee-picker", "activity-feed", "kanban-board"],
    structure: "sidebar",
    ready: true,
  },

  /* ---- the second twenty (2026-08-02) — all ready:false until their
     signature components land; see the readiness note at the top. ---- */

  tradesman: {
    md: "Plumber, electrician or roofer — call-first",
    label: "the phone number IS the hero and the proof is photographs of finished work",
    cta: ["Call now", "Get a quote"],
    shape: [
      "hero: the number, the trades covered and the area — a tel: link before any form",
      "body: before-and-after pairs, because this trade is bought on evidence of finished work",
      "reviews with the street named, then the quote form for people who cannot ring now",
    ],
    pages: [
      { file: "index", role: "the number, the area, the work and the reviews" },
      { file: "quote", role: "describe the job, send photographs" },
      { file: "work", role: "before and after, job by job" },
      { file: "emergency", alt: true, role: "an ALTERNATIVE home for a 24-hour trade — the out-of-hours number leads" },
    ],
    kinds: [
      "plumber",
      "electrician",
      "roofer",
      "builder",
      "joiner",
      "plasterer",
      "heating engineer",
      "locksmith",
      "glazier",
      "damp specialist",
      "tree surgeon", "chimney sweep", "scaffolding", "drain clearance", "asbestos removal", "alarm installer", "CCTV installer", "fire safety", "flooring fitter", "kitchen fitter", "bathroom fitter", "tiler", "decorator", "fencing", "driveways", "guttering", "handyman",
    ],
    components: ["before-after", "service-area", "testimonial", "trust-strip", "safe-image", "gallery", "quote-request"],
    structure: "single-scroll",
    ready: true,
  },

  charity: {
    md: "Charity or cause — donate-first",
    label: "the ask is the page; everything else is evidence that the money works",
    cta: ["Donate", "Give monthly"],
    shape: [
      "hero: what the money does, in one sentence and one number, with the amount picker beside it",
      "body: the programmes, then the impact stated plainly, then the other ways to give",
      "regular giving is offered as prominently as one-off — it is what actually funds a charity",
    ],
    pages: [
      { file: "index", role: "the ask, the programmes and the proof" },
      { file: "donate", role: "the amount picker and the one form" },
      { file: "impact", role: "where last year's money went" },
    ],
    kinds: [
      "charity",
      "foundation",
      "food bank",
      "hospice",
      "animal rescue",
      "community fund",
      "appeal",
      "trust",
      "air ambulance",
      "mutual aid",
    ],
    components: ["stats-band", "testimonial", "cta-band", "progress-ring", "faq", "donation-tiers", "impact-stat"],
    structure: "single-scroll",
    ready: true,
  },

  church: {
    md: "Church or place of worship — times-first",
    label: "when we meet and what happens if you have never been, before anything else",
    cta: ["Plan a visit", "Service times"],
    shape: [
      "hero: this week's times and the address — the two facts a first visit needs",
      "body: what to expect the first time, in plain words, then the groups, then giving",
      "nothing here assumes the reader already belongs",
    ],
    pages: [
      { file: "index", role: "times, what to expect, and the groups" },
      { file: "visit", role: "the first visit answered in detail" },
      { file: "groups", role: "what runs during the week" },
    ],
    kinds: [
      "church",
      "chapel",
      "mosque",
      "synagogue",
      "temple",
      "meeting house",
      "parish",
      "congregation",
      "cathedral",
      "quaker meeting",
    ],
    components: ["opening-hours", "event-card", "location-card", "faq", "safe-image", "testimonial", "service-times"],
    structure: "single-scroll",
    ready: true,
  },

  "sports-club": {
    md: "Sports club — fixtures-first",
    label: "the next fixture and the last result are the news; everything else is the club",
    cta: ["Join the club", "Next fixture"],
    shape: [
      "hero: next fixture, last result, and where the club sits in its table",
      "body: the teams, then how to join or trial, then the ground and how to get there",
      "results are a table, not prose — supporters scan them",
    ],
    pages: [
      { file: "index", role: "next fixture, last result, the table" },
      { file: "teams", role: "every side, training nights, who runs it" },
      { file: "join", role: "trials, subs and the membership form" },
    ],
    kinds: [
      "football club",
      "cricket club",
      "rugby club",
      "netball",
      "athletics",
      "running club",
      "rowing",
      "hockey",
      "bowls",
      "junior academy",
    ],
    components: ["stats-band", "event-card", "team-grid", "location-card", "safe-image", "price-list", "fixture-list", "league-table"],
    structure: "single-scroll",
    ready: true,
  },

  festival: {
    md: "Festival or multi-day event — lineup-first",
    label: "the lineup grid is the product; tickets and travel are what it funnels into",
    cta: ["Buy tickets", "See the lineup"],
    shape: [
      "hero: dates, place, and the headline names — nothing above the lineup",
      "body: the grid by day and stage, then ticket tiers, then travel, camping and access",
      "an FAQ that answers the practical questions is not optional at this scale",
    ],
    pages: [
      { file: "index", role: "dates, the headline names, the tiers" },
      { file: "lineup", role: "the grid, by day and stage" },
      { file: "info", role: "travel, camping, access, the rules" },
    ],
    kinds: [
      "music festival",
      "food festival",
      "literary festival",
      "arts weekend",
      "county show",
      "conference",
      "comic con",
      "pride",
      "carnival",
      "beer festival",
    ],
    components: ["countdown", "event-card", "price-list", "faq", "gallery", "safe-image", "stats-band", "lineup-grid"],
    structure: "full-bleed-hero",
    ready: true,
  },

  venue: {
    md: "A space for hire — capacity-first",
    label: "how many it holds, what it costs and whether the date is free",
    cta: ["Check a date", "Request the pack"],
    shape: [
      "hero: the room at its best, with capacity and the date enquiry beside it",
      "body: the spaces with capacities by layout, then packages, then the gallery",
      "the date question is answerable from every screen — it is the only thing anyone came for",
    ],
    pages: [
      { file: "index", role: "the rooms, the capacities, the date box" },
      { file: "spaces", role: "each room in full — layouts and limits" },
      { file: "enquire", role: "the date, the numbers and the one form" },
    ],
    kinds: [
      "wedding venue",
      "function room",
      "village hall",
      "studio hire",
      "conference centre",
      "gallery hire",
      "photography studio",
      "marquee",
      "barn",
      "theatre hire",
    ],
    components: ["gallery", "safe-image", "price-list", "contact-form", "faq", "location-card", "stats-band", "capacity-table", "date-enquiry"],
    structure: "split-screen",
    ready: true,
  },

  "holiday-let": {
    md: "One holiday let — availability-first",
    label: "one property, one calendar; book direct and skip the platform's cut",
    cta: ["Check availability", "Book direct"],
    shape: [
      "hero: the view that sells it, with the calendar and the nightly rate beside it",
      "body: the rooms one by one, then what is within walking distance, then the practical page",
      "book-direct is the whole argument, so the saving against the platforms is stated",
    ],
    pages: [
      { file: "index", role: "the place, the calendar, the rate" },
      { file: "rooms", role: "every room and what is in it" },
      { file: "area", role: "what is worth doing within a walk or a drive" },
    ],
    kinds: [
      "holiday cottage",
      "cabin",
      "shepherd's hut",
      "apartment",
      "lodge",
      "glamping",
      "narrowboat",
      "annexe",
      "beach house",
      "bothy",
    ],
    components: ["gallery", "safe-image", "location-card", "faq", "price-list", "testimonial", "week-strip", "availability-calendar"],
    structure: "full-bleed-hero",
    ready: true,
  },

  garage: {
    md: "Garage or MOT centre — vehicle-first",
    label: "you type a registration and the site answers with your car and its prices",
    cta: ["Book an MOT", "Get a price"],
    shape: [
      "hero: the registration box, because everything else follows from the vehicle",
      "body: the prices as a plain list, then how long it takes and whether you can wait",
      "a garage is chosen on trust and turnaround, so both are stated before any marketing",
    ],
    pages: [
      { file: "index", role: "the reg box, the prices, the turnaround" },
      { file: "book", role: "the slot and the work, with the vehicle already known" },
      { file: "services", role: "every job priced, from MOT to clutch" },
    ],
    kinds: [
      "garage",
      "MOT centre",
      "tyre fitter",
      "bodyshop",
      "valeting",
      "car servicing",
      "exhaust centre",
      "auto electrician",
      "mobile mechanic",
      "fleet servicing",
    ],
    components: ["price-list", "availability-grid", "opening-hours", "location-card", "trust-strip", "testimonial", "vehicle-lookup"],
    structure: "single-scroll",
    ready: true,
  },

  "funeral-director": {
    md: "Funeral director — two-paths",
    label: "somebody needing help tonight and somebody planning ahead are different readers, answered separately and immediately",
    cta: ["Call us now", "Plan ahead"],
    shape: [
      "hero: the 24-hour number, and one clear split — a death has happened, or I am planning",
      "body: what happens next, step by step, in plain sentences and no euphemism",
      "costs are published in full, because asking is the thing people cannot bring themselves to do",
    ],
    pages: [
      { file: "index", role: "the number, the two paths, what happens next" },
      { file: "costs", role: "every price, itemised, no packages hidden" },
      { file: "plan", role: "planning ahead, and what it fixes" },
    ],
    kinds: [
      "funeral director",
      "celebrant",
      "crematorium",
      "memorial mason",
      "bereavement service",
      "will writer",
      "probate",
      "estate clearance",
      "florist (funeral)",
      "green burial",
    ],
    components: ["price-list", "faq", "contact-form", "location-card", "opening-hours", "testimonial", "arrangement-steps"],
    structure: "single-scroll",
    ready: true,
  },

  nursery: {
    md: "Nursery or childcare — sessions-first",
    label: "the sessions, the fees and whether there is a place, before anything about the setting",
    cta: ["Book a visit", "Check availability"],
    shape: [
      "hero: ages taken, hours, and whether there is a space this term",
      "body: the sessions as a table with fees, then the day, then the staff and the inspection",
      "funded hours are explained rather than mentioned — it is the question every parent has",
    ],
    pages: [
      { file: "index", role: "ages, sessions, fees, and a space or not" },
      { file: "day", role: "what a day actually looks like" },
      { file: "visit", role: "book a look round, and what to bring when you come" },
    ],
    kinds: [
      "nursery",
      "pre-school",
      "childminder",
      "after-school club",
      "holiday club",
      "forest school",
      "creche",
      "playgroup",
      "daycare",
      "tutoring centre",
    ],
    components: ["opening-hours", "team-grid", "faq", "safe-image", "gallery", "contact-form", "testimonial", "session-table", "fee-table"],
    structure: "single-scroll",
    ready: true,
  },

  medical: {
    md: "Medical or veterinary practice — register-first",
    label: "urgent instructions first, then how to register, then everything else",
    cta: ["Register", "Book an appointment"],
    shape: [
      "hero: what to do if it is urgent, stated before anything about the practice",
      "body: how to register, the practitioners, then the treatments with prices where they are private",
      "nothing decorative sits above the urgent instruction",
    ],
    pages: [
      { file: "index", role: "urgent first, then registering" },
      { file: "team", role: "the practitioners and what each does" },
      { file: "treatments", role: "what is offered and what it costs" },
    ],
    kinds: [
      "GP practice",
      "dental practice",
      "veterinary surgery",
      "physiotherapy",
      "optician",
      "podiatry",
      "chiropractor",
      "audiology",
      "private clinic",
      "osteopath",
      "vets", "counselling", "acupuncture", "hearing aids", "sports therapy", "nutritionist", "speech therapy", "occupational health",
    ],
    components: ["team-grid", "price-list", "opening-hours", "location-card", "faq", "contact-form", "practitioner-card", "triage-banner"],
    structure: "single-scroll",
    ready: true,
  },

  gallery: {
    md: "Gallery or museum — exhibition-first",
    label: "what is on right now, at the size the work deserves",
    cta: ["Plan your visit", "What's on"],
    shape: [
      "hero: the current exhibition, full width, with its dates and the visit link",
      "body: what is on next, then the collection, then opening times and admission",
      "the work is the page; the institution is a footnote to it",
    ],
    pages: [
      { file: "index", role: "the current show, then what's next" },
      { file: "exhibition", role: "one exhibition in full — the work, the dates, the room" },
      { file: "visit", role: "hours, admission, access, getting here" },
    ],
    kinds: [
      "art gallery",
      "museum",
      "heritage site",
      "artist studio",
      "sculpture park",
      "archive",
      "craft centre",
      "historic house",
      "exhibition space",
      "open studios",
    ],
    components: ["gallery", "safe-image", "event-card", "opening-hours", "location-card", "figure", "masonry", "exhibition-card"],
    structure: "full-bleed-hero",
    ready: true,
  },

  brewery: {
    md: "Brewery, winery or distillery — range-first",
    label: "the drinks with their strength and style, then the room you can drink them in",
    cta: ["See the range", "Book a tour"],
    shape: [
      "hero: what is pouring now, because a taproom's stock is the news",
      "body: the core range with ABV and style, then the taproom hours, then tours and stockists",
      "producer, not shop — this sells the place as much as the bottle",
    ],
    pages: [
      { file: "index", role: "what's pouring, the range, the taproom" },
      { file: "range", role: "every drink, with notes and strength" },
      { file: "visit", role: "taproom hours, tours, and finding us" },
    ],
    kinds: [
      "brewery",
      "winery",
      "distillery",
      "cidery",
      "taproom",
      "roastery",
      "creamery",
      "smokehouse",
      "bakery (wholesale)",
      "kombucha",
    ],
    components: ["price-list", "opening-hours", "location-card", "gallery", "safe-image", "testimonial", "event-card", "tap-list"],
    structure: "single-scroll",
    ready: true,
  },

  "farm-shop": {
    md: "Farm shop or box scheme — season-first",
    label: "what is good this week, which changes every week and is the entire pitch",
    cta: ["Order a box", "What's in season"],
    shape: [
      "hero: this week's box and what is in it — a farm shop's stock IS its marketing",
      "body: the box sizes and prices, then the seasonal calendar, then the farm itself",
      "the calendar matters: it tells somebody in February why there are no strawberries",
    ],
    pages: [
      { file: "index", role: "this week's box, the sizes, the farm" },
      { file: "season", role: "the year, month by month" },
      { file: "order", role: "the box, the day, the drop point" },
    ],
    kinds: [
      "farm shop",
      "veg box",
      "CSA",
      "farmers' market",
      "smallholding",
      "pick your own",
      "dairy",
      "orchard",
      "fishmonger",
      "butcher",
    ],
    components: ["price-list", "opening-hours", "location-card", "gallery", "safe-image", "testimonial", "menu-section", "produce-calendar"],
    structure: "single-scroll",
    ready: true,
  },

  news: {
    md: "Local paper or newsroom — lead-first",
    label: "one lead story, then sections; a hierarchy of importance rather than a stream",
    cta: ["Read the story", "Subscribe"],
    shape: [
      "hero: the lead, with its picture at the size that says it is the lead",
      "body: two or three secondaries, then the sections, then most-read",
      "this differs from a feed: a newsroom EDITS, and the page has to show that judgement",
    ],
    pages: [
      { file: "index", role: "the lead, the secondaries, the sections" },
      { file: "story", role: "one article, read properly" },
      { file: "section", role: "everything filed under one heading" },
    ],
    kinds: [
      "local paper",
      "newsroom",
      "magazine",
      "trade publication",
      "student paper",
      "community news",
      "investigative outlet",
      "sports desk",
      "listings weekly",
      "parish magazine",
    ],
    components: ["safe-image", "section-nav", "figure", "email-capture", "tag-list", "testimonial", "story-lead"],
    structure: "bento",
    ready: true,
  },

  cleaner: {
    md: "Cleaning or grounds service — recurring-first",
    label: "priced per visit and sold as a standing slot, not a one-off job",
    cta: ["Get a price", "Book a first clean"],
    shape: [
      "hero: the price for a typical property and how often, because this is bought as a habit",
      "body: what a visit includes down to the detail, then the area covered, then the team",
      "recurring beats one-off everywhere: weekly, fortnightly and monthly are priced side by side",
    ],
    pages: [
      { file: "index", role: "the price, the frequency, what is included" },
      { file: "book", role: "property size, frequency, first date" },
      { file: "areas", role: "the streets and postcodes actually covered" },
    ],
    kinds: [
      "domestic cleaning",
      "commercial cleaning",
      "window cleaner",
      "gardener",
      "grounds maintenance",
      "oven cleaning",
      "carpet cleaning",
      "gutter clearing",
      "pest control",
      "pool maintenance",
      "laundry service", "dry cleaner", "car valeting", "jet washing", "end of tenancy",
    ],
    components: ["price-list", "service-area", "testimonial", "trust-strip", "faq", "contact-form", "before-after", "frequency-picker"],
    structure: "single-scroll",
    ready: true,
  },

  removals: {
    md: "Removals or man-and-van — quote-first",
    label: "the quote is a calculator, and the survey booking is what it converts into",
    cta: ["Get a quote", "Book a survey"],
    shape: [
      "hero: the calculator — where from, where to, how many rooms — answering with a range",
      "body: what is included and what is not, then the survey booking, then insurance and terms",
      "a range beats silence: this trade's whole friction is that nobody will publish a number",
    ],
    pages: [
      { file: "index", role: "the calculator, what's included, the survey" },
      { file: "quote", role: "the full form, with photographs" },
      { file: "moving-day", role: "what happens on the day, hour by hour" },
    ],
    kinds: [
      "removals",
      "man and van",
      "house clearance",
      "office move",
      "piano moving",
      "storage and removals",
      "packing service",
      "international move",
      "student move",
      "courier",
    ],
    components: ["price-list", "steps", "faq", "testimonial", "trust-strip", "contact-form", "service-area", "quote-calculator"],
    structure: "single-scroll",
    ready: true,
  },

  storage: {
    md: "Self-storage or unit hire — size-first",
    label: "which size you need and whether one is free, answered with prices on the page",
    cta: ["Reserve a unit", "See sizes"],
    shape: [
      "hero: the sizes with prices and a live free/taken state",
      "body: a size guide in things people own, then access hours, then security",
      "prices are on the page — the industry hides them and that is the opening",
    ],
    pages: [
      { file: "index", role: "sizes, prices, what's free" },
      { file: "sizes", role: "the guide, in furniture rather than square feet" },
      { file: "reserve", role: "pick the unit and the start date" },
    ],
    kinds: [
      "self storage",
      "container storage",
      "lock-up",
      "workshop unit",
      "studio hire",
      "allotment plot",
      "parking space",
      "locker hire",
      "archive storage",
      "garage rental",
    ],
    components: ["price-list", "opening-hours", "location-card", "faq", "trust-strip", "contact-form", "unit-card", "size-guide"],
    structure: "card-grid",
    ready: true,
  },

  tutor: {
    md: "Tutor or coach — subject-first",
    label: "what you teach, to what level, at what rate — the three questions in that order",
    cta: ["Book a trial", "See rates"],
    shape: [
      "hero: subjects and levels, with the rate and the trial offer beside them",
      "body: the results, then how a session works, then when you are free",
      "one person, so the credentials are personal rather than corporate",
    ],
    pages: [
      { file: "index", role: "subjects, levels, rate, trial" },
      { file: "book", role: "pick a slot for the trial" },
      { file: "about", role: "who you are and why it works" },
    ],
    kinds: [
      "private tutor",
      "music teacher",
      "driving instructor",
      "language coach",
      "exam prep",
      "business coach",
      "personal trainer",
      "swim teacher",
      "dog trainer",
      "careers coach",
    ],
    components: ["price-list", "availability-grid", "testimonial", "faq", "safe-image", "contact-form", "subject-list"],
    structure: "single-scroll",
    ready: true,
  },

  "repair-shop": {
    md: "Repair shop — device-first",
    label: "pick the thing that is broken and the site answers with a price and a turnaround",
    cta: ["Get a price", "Track a repair"],
    shape: [
      "hero: choose your device, because every question after that depends on it",
      "body: the common repairs priced, then turnaround, then the track-a-repair door",
      "walk-in-and-wait versus leave-it-with-us is the fact people actually need",
    ],
    pages: [
      { file: "index", role: "pick the device, see the price" },
      { file: "prices", role: "every repair, by device" },
      { file: "track", role: "where my repair is, from its ticket" },
    ],
    kinds: [
      "phone repair",
      "computer repair",
      "watch repair",
      "shoe repair",
      "bike shop",
      "instrument repair",
      "jewellery repair",
      "upholstery",
      "clock repair",
      "tailoring alterations",
    ],
    components: ["price-list", "opening-hours", "location-card", "faq", "trust-strip", "before-after", "repair-status", "device-picker"],
    structure: "single-scroll",
    ready: true,
  },
  marketplace: {
    md: "Two-sided marketplace — audience-first",
    label: "supply and demand share one page — the toggle above the fold decides which you see",
    cta: ["Join", "List", "Find"],
    shape: [
      "hero: the two-sided switch — I need X / I offer X — and the page rearranges for the answer",
      "body: each side gets its own proof and its own action; neither is the default",
      "the makers are people, not stock — a seller carries a name, a place and a rating with its count",
    ],
    pages: [
      { file: "index", role: "the two-sided switch, and both sides answered above the fold" },
      { file: "browse", role: "what is for sale, filtered, with the maker beside each thing" },
      { file: "sell", role: "the other side in full — fees, payouts and what it takes to list" },
    ],
    kinds: [
      "marketplace", "craft marketplace", "resale site", "rental marketplace",
      "services marketplace", "trade platform", "ticket exchange", "swap site",
      "local classifieds", "artisan collective",
    ],
    components: ["audience-switch", "search-input", "steps", "stats-band", "seller-card", "filter-bar", "result-count"],
    structure: "split-screen",
    ready: true,
  },
  hire: {
    md: "Hire by the day — item-and-dates-first",
    label: "pick the thing, pick the dates, see the price — and the deposit is on the page, not in the small print",
    cta: ["Check availability", "Reserve"],
    shape: [
      "hero: the range with a day rate on each, and the dates asked before anything else",
      "body: one item in full — what it does, what it costs by period, what is included and what is not",
      "the deposit, the excess and what counts as damage are stated where the price is, never at collection",
    ],
    pages: [
      { file: "index", role: "the range, day rates, and the dates question" },
      { file: "item", role: "one item in full — spec, rates by period, what is included" },
      { file: "book", role: "dates, extras, the deposit and the excess, stated before anybody pays" },
    ],
    kinds: [
      "van hire", "car hire", "tool hire", "plant hire", "marquee hire", "party hire",
      "skip hire", "trailer hire", "equipment hire", "AV hire",
    ],
    components: ["price-list", "safe-image", "gallery", "faq", "location-card", "opening-hours", "trust-strip", "availability-calendar", "rate-card"],
    structure: "card-grid",
    ready: true,
  },

  taxi: {
    md: "Taxi or private hire — fare-first",
    label: "where from, where to, and a fixed price before anybody rings",
    cta: ["Get a fare", "Book now"],
    shape: [
      "hero: the two address fields and a fixed fare, answered on the page",
      "body: the fixed prices to the places everybody goes — airports, stations, the hospital",
      "the 24-hour number leads the header, because half of this trade is somebody standing in the rain",
    ],
    pages: [
      { file: "index", role: "the fare quote and the number" },
      { file: "fares", role: "fixed prices to the places everybody goes, and what changes them" },
      { file: "account", role: "the other customer — business accounts, school runs, regular journeys" },
    ],
    kinds: [
      "taxi", "private hire", "minicab", "chauffeur", "airport transfer", "coach hire",
      "minibus hire", "executive travel", "wheelchair accessible taxi", "courier (same day)",
    ],
    components: ["price-list", "service-area", "faq", "testimonial", "trust-strip", "opening-hours", "contact-form", "fare-quote"],
    structure: "split-screen",
    ready: true,
  },

  "care-home": {
    md: "Care home — the place, the fees and the visit",
    label: "what it is actually like, what it actually costs, and how to come and see it",
    cta: ["Arrange a visit", "See the fees"],
    shape: [
      "hero: the home itself, the inspection rating with its date, and the visit ask",
      "body: the rooms one by one, then the day, then the fees in full",
      "the weekly fee is on the page — a sector that hides it is the reason families ring six homes",
    ],
    pages: [
      { file: "index", role: "the home, the rating, and how to come and look" },
      { file: "rooms", role: "every room type and what is in it" },
      { file: "fees", role: "the weekly fee, what it includes, and how funding works" },
    ],
    kinds: [
      "care home", "nursing home", "residential care", "dementia care", "supported living",
      "respite care", "retirement village", "extra care housing", "hospice", "learning disability care",
    ],
    components: ["safe-image", "gallery", "price-list", "faq", "location-card", "team-grid", "testimonial", "contact-form", "inspection-rating"],
    structure: "full-bleed-hero",
    ready: true,
  },

  "home-care": {
    md: "Home care — visits-and-rates-first",
    label: "what a visit actually is, what an hour costs, and who would be coming",
    cta: ["Arrange an assessment", "See the rates"],
    shape: [
      "hero: the hourly rate and the inspection rating, together, above anything about the company",
      "body: what each kind of visit includes, then the rates by length and by day, then the carers",
      "the rate is per hour and stated by band — a single headline rate is a quote nobody gets",
    ],
    pages: [
      { file: "index", role: "the rate, the rating, and what a visit is" },
      { file: "services", role: "each kind of care and what a visit actually includes" },
      { file: "arrange", role: "the assessment, and how funding works" },
    ],
    kinds: [
      "home care", "domiciliary care", "live-in care", "companionship", "respite at home",
      "personal care", "dementia care at home", "end of life care", "reablement", "night care",
    ],
    components: ["price-list", "service-area", "faq", "testimonial", "team-grid", "trust-strip", "contact-form", "steps", "rate-card", "inspection-rating"],
    structure: "single-scroll",
    ready: true,
  },

  facility: {
    md: "Pay-and-play facility — slot-first",
    label: "book a slot or turn up, and the price depends on when rather than on who you are",
    cta: ["Book a slot", "See what's free"],
    shape: [
      "hero: what is free right now and what is not, before anything about the building",
      "body: the slots, then peak and off-peak side by side, then membership against paying as you go",
      "a visitor's real question is 'can I get on today' — every other page answers 'we exist'",
    ],
    pages: [
      { file: "index", role: "what is free right now, and what a session costs" },
      { file: "book", role: "pick a slot — the grid, peak and off-peak, and what to bring" },
      { file: "membership", role: "joining against paying each time, with the break-even stated" },
    ],
    kinds: [
      "golf club", "bowling alley", "climbing wall", "swimming pool", "leisure centre",
      "snooker club", "ice rink", "tennis courts", "padel club", "driving range",
    ],
    components: ["availability-grid", "week-strip", "price-list", "pricing-table", "opening-hours", "location-card", "faq", "rate-card", "facility-status"],
    structure: "single-scroll",
    ready: true,
  },

  attraction: {
    md: "Visitor attraction — plan-your-day-first",
    label: "what it costs, when it opens, what happens at what time, and how long to allow",
    cta: ["Plan your visit", "Book tickets"],
    shape: [
      "hero: the place, with the price and the opening times inside the first screen",
      "body: today's timetable — the talks, the feeds, the departures — then how long to allow, then getting here",
      "a family ticket states what it SAVES against the same people bought separately, because that is the sum everybody gets wrong",
    ],
    pages: [
      { file: "index", role: "prices, times, and what happens when" },
      { file: "visit", role: "getting here, access, food, and what to bring" },
      { file: "whats-on", role: "events, seasonal openings, and the school holidays" },
    ],
    kinds: [
      "zoo", "farm park", "steam railway", "castle", "theme park", "aquarium",
      "stately home", "wildlife park", "adventure park", "show cave",
    ],
    components: ["price-list", "opening-hours", "location-card", "gallery", "safe-image", "event-card", "faq", "service-times", "admission-prices"],
    structure: "full-bleed-hero",
    ready: true,
  },

  "pet-boarding": {
    md: "Kennels or cattery — dates-and-requirements-first",
    label: "the dates, the nightly rate by size, and the vaccinations that must be done weeks in advance",
    cta: ["Check dates", "Book a stay"],
    shape: [
      "hero: the calendar and the nightly rate, with the vaccination deadline beside them",
      "body: where they actually stay, then the day, then what has to be in place before arrival",
      "the requirements lead rather than trail — a jab needed fourteen days ahead is useless found the night before",
    ],
    pages: [
      { file: "index", role: "rates, free dates, and what has to be done first" },
      { file: "stay", role: "where they sleep, what a day is, and who looks after them" },
      { file: "book", role: "the dates and the requirements checklist, in that order" },
    ],
    kinds: [
      "kennels", "cattery", "dog daycare", "home boarding", "pet sitting",
      "dog walking", "small animal boarding", "rabbit boarding", "reptile boarding", "aviary boarding",
    ],
    components: ["availability-calendar", "rate-card", "price-list", "gallery", "safe-image", "faq", "location-card", "opening-hours", "team-grid", "entry-requirements"],
    structure: "single-scroll",
    ready: true,
  },

  entertainer: {
    md: "An act for hire — see-it-then-check-the-date",
    label: "watch thirty seconds of it, then find out whether the date is free — in that order",
    cta: ["Check my date", "Watch"],
    shape: [
      "hero: the act itself, playing, with the date box beside it",
      "body: what you get for what, then where they have played, then the practical questions about space and power",
      "nobody books an act they have not seen, and nobody watches a clip after filling in a form",
    ],
    pages: [
      { file: "index", role: "see the act, check the date" },
      { file: "packages", role: "what you get for what — sets, hours, and what is extra" },
      { file: "book", role: "the date, the venue and the details that decide whether it can happen" },
    ],
    kinds: [
      "DJ", "wedding band", "function band", "magician", "children's entertainer",
      "tribute act", "caricaturist", "close-up magic", "casino hire", "photo booth",
    ],
    components: ["video-embed", "gallery", "safe-image", "testimonial", "price-list", "faq", "date-enquiry", "contact-form"],
    structure: "split-screen",
    ready: true,
  },

  directory: {
    md: "Directory — search-first",
    label: "the search bar is the entire homepage",
    cta: ["Search", "Browse"],
    shape: [
      "hero: one search input, centered, with suggestions under it",
      "body: nothing until asked — recent searches and categories are the only furniture",
      "a result is a real entry with an address and hours, never a card with a logo and a link",
    ],
    pages: [
      { file: "index", role: "the search input IS the homepage — nothing else above the fold" },
      { file: "results", role: "what a search returns, counted, filtered and honest when empty" },
      { file: "listing", role: "one entry in full — who, where, when, and how to reach them" },
    ],
    kinds: [
      "directory", "business directory", "trade directory", "venue finder",
      "club finder", "what's on listing", "supplier index", "member register",
      "service finder", "local guide",
    ],
    components: ["search-input", "search-suggestions", "recent-searches", "result-count", "category-nav", "location-card", "opening-hours"],
    structure: "single-scroll",
    ready: true,
  },

  campsite: {
    md: "Campsite or caravan park — will-it-fit-first",
    label: "which pitch takes what you are arriving in, whether it has hookup, and when the gate is locked",
    cta: ["Check the pitches", "Book a pitch"],
    shape: [
      "hero: the pitch types with their SIZE and what they take, not a photograph of a sunset",
      "body: free nights, then the facilities including the ones that are shut, then the arrival window",
      "a family in a 7.5m motorhome is asking one question and every campsite site answers 'we are in a lovely valley'",
    ],
    pages: [
      { file: "index", role: "the pitch types, what fits on each, and the nightly rate" },
      { file: "book", role: "free nights and the arrival window — the gate is the thing people get caught by" },
      { file: "site", role: "the facilities, the walk to them, and the rules while you are here" },
    ],
    kinds: [
      "campsite", "caravan park", "touring site", "glamping site", "motorhome stopover",
      "certificated location", "camping field", "aire", "holiday park", "residential park",
    ],
    components: ["availability-calendar", "week-strip", "amenity-list", "gallery", "safe-image", "location-card", "faq", "rate-card", "price-list", "pitch-types", "house-rules"],
    structure: "single-scroll",
    ready: true,
  },
  "bed-and-breakfast": {
    md: "B&B or guest house — book-direct-first",
    label: "the rooms, what a single person actually pays, and what booking here saves against the platform",
    cta: ["Book direct", "See the rooms"],
    shape: [
      "hero: the direct saving computed against the platform price, with the date it was checked",
      "body: the rooms with the SINGLE-occupancy rate stated, then breakfast, then the house rules",
      "a solo traveller assumes half of the double rate and it is never half — say the number",
    ],
    pages: [
      { file: "index", role: "the rooms, the rates including single occupancy, and the direct saving" },
      { file: "rooms", role: "each room in full — size, bed, bathroom, what you can see out of it" },
      { file: "stay", role: "breakfast, arrival, parking, and the rules — the practical half" },
    ],
    kinds: [
      "bed and breakfast", "guest house", "inn with rooms", "farmhouse B&B", "pub with rooms",
      "boutique guesthouse", "homestay", "airbnb host", "serviced room", "hostel",
    ],
    components: ["room-card", "gallery", "safe-image", "location-card", "faq", "rate-card", "testimonial", "week-strip", "availability-calendar", "direct-saving", "house-rules"],
    structure: "editorial",
    ready: true,
  },
  "local-shop": {
    md: "A shop that does not sell online — counter-first",
    label: "what you can actually do at the counter, and the hours for each, which are not the shop's hours",
    cta: ["What we do", "Find us"],
    shape: [
      "hero: the counter services with their OWN hours beside the shop's",
      "body: what is stocked, then where and when, then the things people ring up to ask",
      "the post office counter shuts at 17:30 while the shop is open until 22:00 and nobody publishes that",
    ],
    pages: [
      { file: "index", role: "what you can do here, when, and where we are" },
      { file: "shop", role: "what is stocked and what can be ordered in" },
    ],
    kinds: [
      "corner shop", "newsagent", "post office", "off licence", "hardware shop",
      "pharmacy", "greengrocer", "dry cleaner", "convenience store", "village shop",
      "key cutting", "parcel shop", "launderette", "tobacconist", "sweet shop",
    ],
    components: ["opening-hours", "location-card", "price-list", "faq", "gallery", "safe-image", "announcement-bar", "counter-services"],
    structure: "single-scroll",
    ready: true,
  },
  wholesaler: {
    md: "Trade supplier — do-I-qualify-first",
    label: "the minimum order, the carriage-paid line, the delivery days and whether an account is needed — before any product",
    cta: ["Open an account", "See the terms"],
    shape: [
      "hero: the trade terms, because a buyer who does not qualify should find out in ten seconds",
      "body: the price breaks by case and pallet, then lead times, then the account application",
      "every trade site hides the minimum order behind a login and wastes both parties' morning",
    ],
    pages: [
      { file: "index", role: "the terms, the minimum, and who we supply" },
      { file: "range", role: "the products with case and pallet pricing, and the break quantities" },
      { file: "account", role: "opening a trade account — what is needed and how long it takes" },
    ],
    kinds: [
      "wholesaler", "cash and carry", "trade counter", "trade supplier", "importer",
      "distributor", "buying group", "catering supplier", "builders merchant", "trade only",
    ],
    components: ["bulk-pricing", "quantity-break", "lead-time", "data-table", "spec-row", "download-card", "contact-form", "faq", "stock-level", "trade-terms"],
    structure: "sidebar",
    ready: true,
  },
  "franchise-sales": {
    md: "Selling a franchise — total-cost-first",
    label: "what it really costs to open, what is NOT in that figure, and which territories are actually free",
    cta: ["What it costs", "Which areas are free"],
    shape: [
      "hero: the total investment computed from its parts, beside the headline fee everybody quotes",
      "body: what the fee excludes, then the free territories, then the process and its timescale",
      "'from £14,995' is the franchise fee and the real number is three times it — add it up on the page",
    ],
    pages: [
      { file: "index", role: "the total cost, computed, and what the headline figure leaves out" },
      { file: "territories", role: "which areas are free, taken or under offer" },
      { file: "process", role: "from enquiry to opening — the steps, and how long each really takes" },
    ],
    kinds: [
      "franchise", "franchise opportunity", "master franchise", "licensee scheme", "dealership opportunity",
      "management franchise", "van franchise", "area development", "partner programme", "business opportunity",
    ],
    components: ["faq", "contact-form", "testimonial", "timeline", "stats-band", "download-card", "payback-note", "break-even-note", "safe-image", "investment-table", "territory-list"],
    structure: "single-scroll",
    ready: true,
  },

  "lettings-agent": {
    md: "Lettings agent — what-it-costs-to-move-in-first",
    label: "the money a tenant actually needs up front, and the landlord fee as a percentage rather than 'competitive'",
    cta: ["What it costs to move in", "Landlords"],
    shape: [
      "hero: the up-front total for a tenant, computed, with the statement that everything else is prohibited by law",
      "body: the available properties, then the landlord tiers as percentages, then the compliance a landlord actually has to do",
      "two audiences on one site — a tenant asking what they will be stung for, and a landlord asking what the fee is",
    ],
    pages: [
      { file: "index", role: "what a tenant pays up front, and what is banned" },
      { file: "landlords", role: "the management tiers as percentages, and what each includes" },
      { file: "compliance", role: "the certificates a landlord needs, with the deadline on each" },
    ],
    kinds: [
      "letting agent", "student lettings", "HMO management", "block management", "build to rent",
      "corporate lettings", "holiday let management", "guaranteed rent", "rent to rent", "relocation agent",
    ],
    components: ["property-card", "search-facets", "filter-bar", "pricing-table", "entry-requirements", "faq", "location-card", "contact-form", "gallery", "tenancy-costs"],
    structure: "card-grid",
    ready: true,
  },
  "professional-body": {
    md: "Institute or association — which-grade-am-I-first",
    label: "the membership ladder with what each grade REQUIRES, so somebody can place themselves in ten seconds",
    cta: ["Which grade am I?", "Find a member"],
    shape: [
      "hero: the grades with their entry requirements, not their benefits",
      "body: the register, then CPD and what it actually demands a year, then the assessment route",
      "every institute leads with what membership gives you and buries what it takes to get in",
    ],
    pages: [
      { file: "index", role: "the grades, and what each one requires of you" },
      { file: "register", role: "find a member — the searchable register that is the body's real product" },
      { file: "apply", role: "the assessment route, the evidence needed, and how long it takes" },
    ],
    kinds: [
      "professional body", "institute", "trade association", "chartered body", "licensing board",
      "accreditation scheme", "regulator", "membership organisation", "guild", "learned society",
    ],
    components: ["membership-tier-row", "search-input", "search-facets", "result-count", "faq", "timeline", "download-card", "contact-form", "stats-band", "membership-grades"],
    structure: "sidebar",
    ready: true,
  },
  "parish-council": {
    md: "Parish or town council — next-meeting-first",
    label: "when the next meeting is, whether the agenda is out yet, and what the precept costs on your band",
    cta: ["Next meeting", "Papers"],
    shape: [
      "hero: the next meeting with the agenda's publication state — an agenda is due three clear days before, and 'not out yet' is information",
      "body: the papers, then the councillors and their vacancies, then the precept per band",
      "a resident wants to know whether they can turn up and speak, and every council site answers with a welcome message",
    ],
    pages: [
      { file: "index", role: "the next meeting, the agenda, and how to speak at it" },
      { file: "papers", role: "agendas and minutes, with the decisions and who is doing what" },
      { file: "council", role: "councillors, vacancies, and what the precept costs" },
    ],
    kinds: [
      "parish council", "town council", "community council", "residents association", "neighbourhood forum",
      "school governors", "allotment association", "village hall committee", "civic society", "friends group",
    ],
    components: ["minutes-entry", "committee-list", "faq", "location-card", "price-list", "download-card", "announcement-bar", "safe-image", "meeting-papers"],
    structure: "editorial",
    ready: true,
  },
  equestrian: {
    md: "Livery yard or riding school — is-there-a-space-first",
    label: "the livery packages by the week, what turnout actually means here, and whether a stable is free",
    cta: ["Is there a space?", "Book a lesson"],
    shape: [
      "hero: the livery packages with the weekly price and whether any are free right now",
      "body: turnout stated in hours and months rather than as the word 'available', then the arena and the hacking, then lessons",
      "'turnout available' is on every yard's advert and answers none of the four questions that decide it",
    ],
    pages: [
      { file: "index", role: "the livery packages, the weekly price, and what is free" },
      { file: "yard", role: "turnout, the arena, the hacking, and the rest of the facilities" },
      { file: "lessons", role: "riding lessons by level, and what a first one is like" },
    ],
    kinds: [
      "livery yard", "riding school", "equestrian centre", "stud", "pony club centre",
      "trekking centre", "horse transport", "farrier", "equine therapy", "carriage driving",
    ],
    components: ["amenity-list", "rate-card", "gallery", "safe-image", "location-card", "faq", "session-table", "testimonial", "house-rules", "livery-packages"],
    structure: "full-bleed-hero",
    ready: true,
  },

  /* --------------------------------------------- 66-100, added 2026-08-03.
   *
   * THE SECOND THIRTY-FIVE (owner's call). The first sixty-five covered the
   * businesses a high street has; these cover the shapes they did not — a
   * service that must ask WHERE YOU LIVE before it can say anything, a price
   * that is a function of quantity, a rate board that is the whole product,
   * and a page whose reader is frightened.
   *
   * The test that matters most for this block is the structure spread: adding
   * thirty-five single-scrolls would have been faster and would have recreated
   * the sameness the axis exists to break. */

  broadband: {
    md: "Broadband or network provider — can-I-get-it-first",
    label: "the address checker IS the hero; nothing below it means anything yet",
    cta: ["Check my address", "See packages"],
    shape: [
      "hero: a postcode field and nothing competing with it — every figure on the page is conditional on the answer",
      "body: the packages available AT THAT ADDRESS, then the contract length and what happens when it ends",
      "an unavailable service stays on the page saying why, because 'why not me' is the question that generates the call",
    ],
    pages: [
      { file: "index", role: "the address check, then what this address can actually have" },
      { file: "packages", role: "the speeds and prices in full, with the after-offer price beside the offer one" },
      { file: "switching", role: "moving house or moving provider — the dates, the overlap and the exit fee" },
    ],
    kinds: ["broadband", "isp", "full fibre", "network operator", "mobile network", "satellite internet", "altnet", "business connectivity"],
    components: ["postcode-input", "service-availability", "bundle-row", "contract-end", "plan-card", "faq", "section-header"],
    structure: "split-screen",
    ready: true,
  },

  energy: {
    md: "Energy or metered supplier — tariff-first",
    label: "the tariff table is the page; a bill is the only thing being compared",
    cta: ["Compare tariffs", "Send a reading"],
    shape: [
      "hero: the tariffs side by side with the standing charge shown, not folded into an annual estimate",
      "body: how to read a meter and send one, then what happens when a fixed term ends",
      "every estimate states the usage it assumes, or it is a number pretending to be a fact",
    ],
    pages: [
      { file: "index", role: "the tariffs, the standing charges and what a typical year costs on each" },
      { file: "tariffs", role: "the full table including the ones closing, with exit fees and end dates" },
      { file: "meter", role: "sending a reading — the form, and what the digits on each meter type mean" },
    ],
    kinds: ["energy supplier", "gas", "electricity", "water", "heat network", "metered service", "community energy"],
    components: ["tariff-row", "meter-reading", "smart-meter-note", "contract-end", "faq", "section-header", "announcement-bar"],
    structure: "split-screen",
    ready: true,
  },

  bank: {
    md: "Bank, lender or credit union — rates-first",
    label: "every rate with its conditions in the same row, because the conditions are the product",
    cta: ["Apply to join", "See rates"],
    shape: [
      "hero: what you can borrow and what you can earn, as two rate tables, no imagery between them",
      "body: who may join, what it costs to repay, and the checks before applying",
      "a representative APR says so in words — half of applicants may be offered worse and no table shows that otherwise",
    ],
    pages: [
      { file: "index", role: "the headline rates for saving and borrowing, and who may join" },
      { file: "borrow", role: "the loans in full — a repayment preview and what happens if a payment is missed" },
      { file: "save", role: "the savings accounts, each with its withdrawal limits stated in the row" },
      { file: "join", role: "the eligibility check and the documents to bring, before any form" },
    ],
    kinds: ["credit union", "building society", "community lender", "savings provider", "mutual", "friendly society"],
    components: ["interest-rates", "repayment-preview", "eligibility-check", "checklist-dot", "faq", "contact-card", "section-header"],
    structure: "sidebar",
    ready: true,
  },

  insurance: {
    md: "Insurance or protection — cover-levels-first",
    label: "levels side by side with what each refuses — the exclusions decide it",
    cta: ["Get a quote", "Compare cover"],
    shape: [
      "hero: the levels of cover as parallel columns, differing lines called out rather than left to be spotted",
      "body: the exclusions in plain words, the excess, then what claiming actually looks like",
      "the excess appears next to the cover it applies to — a single figure in a footer is how a claim becomes a complaint",
    ],
    pages: [
      { file: "index", role: "the cover levels compared, and the exclusions that apply to all of them" },
      { file: "cover", role: "one level in full — every limit, the excess for each claim type, the wording" },
      { file: "claim", role: "how a claim runs, stage by stage, with what is needed at each" },
    ],
    kinds: ["insurance", "protection", "warranty", "pet insurance", "travel insurance", "insurance broker", "breakdown cover", "home emergency"],
    components: ["cover-level", "exclusion-list", "excess-note", "policy-summary-row", "claim-timeline", "faq", "section-header"],
    structure: "card-grid",
    ready: true,
  },

  "debt-advice": {
    md: "Free advice service — urgent-help-first",
    label: "no form before the phone number, and the priority order above everything",
    cta: ["Talk to an adviser", "Start with the checklist"],
    shape: [
      "hero: how to reach a person today, and the sentence saying it is free and confidential",
      "body: which debts to deal with first and why, then what an adviser will ask you to bring",
      "nothing on this page asks for a detail before it has given something — a form ahead of the help is a door",
    ],
    pages: [
      { file: "index", role: "how to reach someone now, and the priority order that IS the advice" },
      { file: "options", role: "what can actually be arranged, each with what it costs you afterwards" },
    ],
    kinds: ["debt advice", "money advice", "welfare rights", "law centre", "citizens advice", "advice service", "hardship fund"],
    components: ["priority-debts", "triage-banner", "checklist-dot", "contact-card", "faq", "section-header", "site-chrome"],
    structure: "single-scroll",
    ready: true,
  },

  "subscription-box": {
    md: "A subscription — plan-and-frequency-first",
    label: "size and frequency chosen before payment, with the cancel terms beside them",
    cta: ["Start a box", "See the plans"],
    shape: [
      "hero: the sizes as a choice and the frequency beside it — two decisions, made together, before any card details",
      "body: what turns up, when the cut-off is, and how to skip a delivery without ringing anybody",
      "cancelling is described where somebody is deciding to subscribe, not filed under terms",
    ],
    pages: [
      { file: "index", role: "the sizes and frequencies, with the cancel terms next to them" },
      { file: "plans", role: "every plan priced, including the ones that only make sense for a household" },
      { file: "manage", role: "skipping, pausing, changing frequency and stopping — reached from the account link" },
    ],
    kinds: ["subscription box", "coffee subscription", "wine club", "book club", "pet box", "razor subscription", "flower subscription"],
    components: ["frequency-picker", "recurring-picker", "cutoff-time", "cancel-policy", "delivery-estimate", "plan-card", "faq"],
    structure: "split-screen",
    ready: true,
  },

  "meal-plan": {
    md: "Meal plan or recipe box — this-week's-menu-first",
    label: "this week's food leads; nobody subscribes to a box of unknowns",
    cta: ["See this week", "Choose a plan"],
    shape: [
      "hero: the dishes available this week as cards, with the ordering cut-off stated above them",
      "body: the plans and portion sizes, then the allergens as a full matrix rather than a disclaimer",
      "the cut-off appears on every page — it is the only thing on the site that expires",
    ],
    pages: [
      { file: "index", role: "this week's dishes and the cut-off, then the plans underneath" },
      { file: "menu", role: "the full week including next week's, with the allergen matrix" },
      { file: "plans", role: "portions, frequency and price per serving, which is the honest comparison" },
    ],
    kinds: ["recipe box", "meal plan", "meal prep", "veg box", "food subscription", "diet plan", "prepared meals"],
    components: ["cutoff-time", "menu-section", "allergen-matrix", "frequency-picker", "delivery-slot", "plan-card", "faq"],
    structure: "card-grid",
    ready: true,
  },

  "food-truck": {
    md: "Street food or mobile trader — where-today-first",
    label: "where the van is TODAY, above all — the only fact on the site that expires",
    cta: ["Where we are today", "Book us"],
    shape: [
      "hero: today's pitch and its hours, large, with the rest of the week directly beneath it",
      "body: what is on, then hiring the van for a private event, which is the other half of the business",
      "a cancelled pitch stays in the diary marked cancelled — a regular finds out by driving there otherwise",
    ],
    pages: [
      { file: "index", role: "where we are today and this week, then what is on the menu" },
      { file: "diary", role: "the full trading diary — markets, regular pitches and the winter gaps" },
      { file: "hire", role: "hiring the van for a wedding, a party or a works do" },
    ],
    kinds: ["food truck", "street food", "mobile catering", "market stall", "coffee van", "mobile trader", "pop-up kitchen", "ice cream van"],
    components: ["trading-diary", "menu-section", "location-card", "open-now", "date-enquiry", "faq", "section-header"],
    structure: "full-bleed-hero",
    ready: true,
  },

  "coach-hire": {
    md: "Coach or minibus hire — route-and-date-first",
    label: "seats, date and route set the price; photographs of the fleet set nothing",
    cta: ["Get a quote", "Check a date"],
    shape: [
      "hero: the three questions that set the price — how many, where to, which day — and nothing else",
      "body: the fleet by capacity rather than by prettiness, then what the quote does and does not include",
      "driver hours are a legal limit, not a preference, so a long day is priced as two drivers and says so",
    ],
    pages: [
      { file: "index", role: "the three questions, an indicative price, and what is included" },
      { file: "fleet", role: "every vehicle by seats, with access and luggage stated" },
      { file: "quote", role: "the enquiry form — route, date, times and the extras that change the figure" },
    ],
    kinds: ["coach hire", "minibus hire", "school transport", "airport transfer", "wedding transport", "private hire", "day trips"],
    components: ["vehicle-card", "capacity-table", "fare-quote", "route-stop", "date-enquiry", "faq", "section-header"],
    structure: "split-screen",
    ready: true,
  },

  caterer: {
    md: "Caterer or event supplier — headcount-first",
    label: "the number of people is the first question and every figure on the page moves with it",
    cta: ["Get a quote", "See the menus"],
    shape: [
      "hero: a headcount and a date, with a per-head figure that changes as the number does",
      "body: the menus at each price point, then what a quote covers — staff, hire, travel, VAT",
      "the minimum spend is stated in the hero, because it is the fact that ends half of these enquiries",
    ],
    pages: [
      { file: "index", role: "headcount, date, the per-head bands and the minimum spend" },
      { file: "menus", role: "the menus at each band, with the allergen matrix rather than a disclaimer" },
      { file: "quote", role: "the enquiry — venue, timings, dietary needs and what we need to know about the kitchen" },
    ],
    kinds: ["caterer", "event catering", "wedding catering", "buffet", "hog roast", "corporate catering", "canapes", "grazing table"],
    components: ["price-list", "menu-section", "allergen-matrix", "date-enquiry", "capacity-table", "faq", "section-header"],
    structure: "editorial",
    ready: true,
  },

  "driving-school": {
    md: "Driving school or instructor — pass-rate-first",
    label: "the pass rate and the wait for a test, plainly — both are what people ring to ask",
    cta: ["Book a first lesson", "Check availability"],
    shape: [
      "hero: the pass rate as a real figure with the sample size beside it, and how far out the diary is",
      "body: what a lesson costs and what a block costs, then the instructor as a person rather than a logo",
      "the test-centre waiting time is stated because it is the constraint nobody warns a learner about",
    ],
    pages: [
      { file: "index", role: "the pass rate, the wait, the prices and who is teaching" },
      { file: "lessons", role: "hourly, block and intensive, with what each actually suits" },
      { file: "book", role: "the first lesson — pick-up, licence check and what happens in the first hour" },
    ],
    kinds: ["driving school", "driving instructor", "intensive course", "motorcycle training", "hgv training", "pass plus", "refresher lessons"],
    components: ["price-list", "week-strip", "availability-grid", "rating-summary", "practitioner-card", "faq", "section-header"],
    structure: "single-scroll",
    ready: true,
  },

  "music-school": {
    md: "Music or arts school — instrument-and-grade-first",
    label: "pick the instrument then the stage; timetable and fees follow from those two",
    cta: ["Book a taster", "See the timetable"],
    shape: [
      "sidebar: the instruments as the rail, because that is the first thing a parent narrows by",
      "body: the teacher, the grades and what a term costs — one page per instrument, not one page for everything",
      "the fee is per TERM and says so, since an hourly figure on a school that bills termly is a wrong number",
    ],
    pages: [
      { file: "index", role: "the instruments, the grades taught and how a term is priced" },
      { file: "lessons", role: "one-to-one, group and ensemble — who each suits and at what stage" },
      { file: "timetable", role: "the week, by instrument and room, with the spaces still free" },
      { file: "fees", role: "per term, with the bursary and the instrument-loan scheme stated" },
    ],
    kinds: ["music school", "music teacher", "drama school", "dance school", "art class", "stage school", "peripatetic teaching"],
    components: ["subject-list", "session-table", "fee-table", "practitioner-card", "time-lane-grid", "faq", "section-header"],
    structure: "sidebar",
    ready: true,
  },

  school: {
    md: "Primary or secondary school — parents-first",
    label: "term dates, absence and the newsletter above anything about the school's values",
    cta: ["Report an absence", "Term dates"],
    shape: [
      "sidebar: the parent's rail — term dates, absence, uniform, the newsletter — not a prospectus menu",
      "body: what is happening this week, then admissions, then the governors and the inspection report",
      "the closure days appear INSIDE each term, because a term stated as one range hides the days school is shut",
    ],
    pages: [
      { file: "index", role: "this week, the absence line, and the next dates that affect a family" },
      { file: "admissions", role: "how to apply, the catchment, and what the oversubscription criteria really mean" },
      { file: "term-dates", role: "the year with every INSET day and closure inside its term" },
      { file: "news", role: "the newsletter and the letters home, kept where a parent can find one again" },
    ],
    kinds: ["primary school", "secondary school", "academy", "sixth form", "special school", "independent school", "nursery school", "pupil referral unit"],
    components: ["term-dates", "announcement-bar", "committee-list", "inspection-rating", "contact-card", "faq", "section-header"],
    structure: "sidebar",
    ready: true,
  },

  apprenticeship: {
    md: "Training provider — am-I-eligible-first",
    label: "each course states who may take it and who pays, before what it covers",
    cta: ["Check eligibility", "Apply"],
    shape: [
      "hero: the eligibility question, because funding rules decide more applications than interest does",
      "body: the courses as a grid with entry requirements and the funding route on every card",
      "who pays is named — the employer, the levy, the adult skills fund or the learner — never left implied",
    ],
    pages: [
      { file: "index", role: "who we can take, how it is funded, and the courses running now" },
      { file: "courses", role: "every course with its entry requirements, length and awarding body" },
      { file: "apply", role: "the steps, the documents and what happens between applying and starting" },
    ],
    kinds: ["training provider", "apprenticeship", "adult education", "skills bootcamp", "further education", "vocational training", "employability programme"],
    components: ["eligibility-check", "entry-requirements", "fee-table", "cohort-picker", "checklist-dot", "faq", "section-header"],
    structure: "card-grid",
    ready: true,
  },

  "housing-association": {
    md: "Housing association or social landlord — report-a-repair-first",
    label: "the four things tenants come for as tiles, repairs first, none more than a click deep",
    cta: ["Report a repair", "Pay rent"],
    shape: [
      "bento: repairs, rent, the emergency number and how to complain, as tiles rather than a prospectus",
      "body: what counts as an emergency and what the response times actually are, in writing",
      "the complaints route is given equal weight to everything else, because burying it is what generates ombudsman cases",
    ],
    pages: [
      { file: "index", role: "the four tenant doors as a grid, with the out-of-hours number always visible" },
      { file: "repairs", role: "what is an emergency, the response times, and tracking one already reported" },
      { file: "tenancy", role: "rent, arrears help, ending a tenancy, and how to complain properly" },
    ],
    kinds: ["housing association", "social landlord", "council housing", "almshouse", "tenant management", "co-operative housing", "supported housing"],
    components: ["bento-grid", "repair-job", "triage-banner", "arrears-note", "contact-card", "faq", "section-header"],
    structure: "bento",
    ready: true,
  },

  optician: {
    md: "Optician or hearing centre — test-then-frames",
    label: "an appointment and a shop on one page, kept visibly apart because they are different visits",
    cta: ["Book an eye test", "Browse frames"],
    shape: [
      "split: the test on one side as a bookable appointment, the shop on the other as browsable stock",
      "body: what a test actually involves and how long it takes, then lenses priced as options rather than as a range",
      "the NHS entitlement is stated plainly, because most people who qualify do not know they do",
    ],
    pages: [
      { file: "index", role: "book a test on one side, browse frames on the other, entitlement stated" },
      { file: "eye-test", role: "what happens in the 30 minutes, who is free, and who gets one free" },
      { file: "frames", role: "the stock, and lenses priced as options so a total can be worked out" },
    ],
    kinds: ["optician", "optometrist", "hearing centre", "audiologist", "eyewear", "contact lenses", "dispensing optician"],
    components: ["availability-grid", "option-priced-list", "price-list", "practitioner-card", "opening-hours", "faq", "section-header"],
    structure: "split-screen",
    ready: true,
  },

  pharmacy: {
    md: "Pharmacy or dispensary — prescriptions-and-services-first",
    label: "repeats and the things needing no appointment, as a grid of doors rather than a shop",
    cta: ["Order a repeat", "See services"],
    shape: [
      "bento: ordering a repeat, the NHS services, the counter, and when the pharmacist is actually in",
      "body: what can be treated here without seeing a GP, which is far more than most people think",
      "the out-of-hours and urgent route is stated, because a pharmacy is where people go when the surgery is shut",
    ],
    pages: [
      { file: "index", role: "the four doors, and when the pharmacist is on the premises" },
      { file: "services", role: "what can be treated here without a GP, and which are free" },
      { file: "repeat", role: "ordering a repeat, how long it takes, and what to do when an item is out of stock" },
    ],
    kinds: ["pharmacy", "chemist", "dispensary", "travel clinic", "vaccination service", "community pharmacy"],
    components: ["bento-grid", "prescription-row", "counter-services", "triage-banner", "opening-hours", "faq", "section-header"],
    structure: "bento",
    ready: true,
  },

  "bike-shop": {
    md: "Bike or equipment shop — buy-and-service",
    label: "two businesses on one page — stock to browse and a workshop to book — kept visibly apart",
    cta: ["Book a service", "See what is in"],
    shape: [
      "card-grid: what is actually in stock, in sizes, because a bike you cannot ride is not stock",
      "body: the workshop as a bookable diary with a real turnaround, then what each service includes",
      "the workshop wait is stated in weeks, since in March it is six and that is the answer somebody needs",
    ],
    pages: [
      { file: "index", role: "what is in, in which sizes, and how far out the workshop is" },
      { file: "bikes", role: "the stock with sizes and what fits whom, rather than a catalogue" },
      { file: "workshop", role: "the services, what each includes, and booking one" },
    ],
    kinds: ["bike shop", "cycle shop", "ski hire", "outdoor shop", "golf shop", "music shop", "camera shop", "equipment retailer"],
    components: ["product-card", "spec-row", "price-list", "availability-grid", "service-history", "faq", "section-header"],
    structure: "card-grid",
    ready: true,
  },

  "garden-centre": {
    md: "Garden centre or plant nursery — what's-good-now-first",
    label: "what is worth planting this month leads; a site that does not change with the season is wrong",
    cta: ["What's in now", "Plan a visit"],
    shape: [
      "editorial: the month's planting, written as advice rather than as a product list",
      "body: what is actually in stock now, then the practical visit facts — parking, the cafe, the dog rule",
      "anything out of season says so rather than being quietly listed, because selling somebody a doomed plant loses them",
    ],
    pages: [
      { file: "index", role: "what to plant this month, and what of it is in stock" },
      { file: "plants", role: "the stock by season, with what will not survive being planted now" },
      { file: "visit", role: "opening hours, parking, the cafe, dogs, and accessibility" },
    ],
    kinds: ["garden centre", "plant nursery", "seed merchant", "florist", "landscaping supplier", "allotment shop", "farm nursery"],
    components: ["season-picker", "product-card", "price-list", "opening-hours", "location-card", "faq", "section-header"],
    structure: "editorial",
    ready: true,
  },

  antiques: {
    md: "Antiques or one-of-a-kind dealer — each-piece-unique",
    label: "one of everything, so a sold piece stays on the page marked sold rather than vanishing",
    cta: ["Enquire", "See the stock"],
    shape: [
      "editorial: each piece gets its own measure — a grid of thumbnails is how a unique object stops being one",
      "body: provenance and condition given as much room as the photograph, because that is what the price rests on",
      "a sold piece remains, marked sold, since it is the record of what this dealer handles",
    ],
    pages: [
      { file: "index", role: "the current stock, with the sold pieces kept and marked" },
      { file: "piece", role: "one object in full — provenance, condition, measurements, the price" },
      { file: "selling", role: "for somebody with something to sell — valuation, commission and probate" },
    ],
    kinds: ["antiques", "art dealer", "vintage", "rare books", "coins and medals", "classic cars", "salvage", "auction consignment"],
    components: ["lot-card", "provenance-note", "condition-report", "gallery", "safe-image", "faq", "section-header"],
    structure: "editorial",
    ready: true,
  },

  "golf-club": {
    md: "Golf or members' club — membership-and-tee-times",
    label: "a grid: what joining costs, whether a visitor may play, and the next free tee time",
    cta: ["Book a tee time", "Join"],
    shape: [
      "bento: the membership ladder, the visitor answer, the next tee times and the dress code as four tiles",
      "body: the categories in full with their joining fees and whether each has a waiting list",
      "the visitor question is answered first because most traffic is somebody asking it, not a prospective member",
    ],
    pages: [
      { file: "index", role: "join, visit, book, and what the club expects of you" },
      { file: "membership", role: "every category with its fee, waiting list and voting rights" },
      { file: "visitors", role: "green fees, when a visitor may play, and the dress code in plain terms" },
    ],
    kinds: ["golf club", "members club", "bowls club", "sailing club", "shooting ground", "tennis club", "country club", "angling club"],
    components: ["bento-grid", "membership-tier-row", "availability-grid", "house-rules", "opening-hours", "faq", "section-header"],
    structure: "bento",
    ready: true,
  },

  band: {
    md: "Band or touring artist — tour-dates-first",
    label: "the next date and the ticket link above everything; the music is one click, the tour is not",
    cta: ["Get tickets", "Listen"],
    shape: [
      "full-bleed: one image and the next date over it, with the ticket link in the first screen",
      "body: the dates in full including the sold-out ones, then something to listen to, then the merch",
      "a cancelled or sold-out date stays listed and says which, because a fan checking is asking exactly that",
    ],
    pages: [
      { file: "index", role: "the next date, the tour, and one thing to listen to" },
      { file: "tour", role: "every date including sold out and cancelled, with the on-sale times" },
      { file: "listen", role: "the records, where to hear them, and the set as it is currently played" },
    ],
    kinds: ["band", "musician", "touring artist", "DJ", "orchestra", "comedian", "theatre company", "spoken word"],
    components: ["tour-dates", "setlist-row", "audio-player", "ticket-tiers", "press-quote", "faq", "section-header"],
    structure: "full-bleed-hero",
    ready: true,
  },

  "game-studio": {
    md: "A game — trailer-first",
    label: "the trailer fills the screen, then the platforms, then one button that buys or wishlists it",
    cta: ["Wishlist", "Buy now"],
    shape: [
      "full-bleed: the trailer, playing on its own terms, with the platforms directly under it",
      "body: what the game actually is in three sentences, then the press, then the studio",
      "the platform list says which are confirmed and which are hoped for, because a wrong assumption is a refund",
    ],
    pages: [
      { file: "index", role: "the trailer, the platforms, and the one button" },
      { file: "about", role: "what the game is, how long it takes, and what it is not" },
      { file: "press", role: "the kit — screenshots, logos, the fact sheet and who to contact" },
    ],
    kinds: ["game", "indie game", "mobile app", "software launch", "hardware product", "board game", "kickstarter"],
    components: ["video-embed", "device-picker", "wishlist-button", "press-quote", "media-object", "faq", "section-header"],
    structure: "full-bleed-hero",
    ready: true,
  },

  film: {
    md: "A film or production — screenings-first",
    label: "the trailer, then where it is actually showing, which is what a release page is for",
    cta: ["Find a screening", "Watch the trailer"],
    shape: [
      "full-bleed: the trailer, then the next screening near the reader rather than a list of festivals",
      "body: the screenings in full with the Q&A dates marked, then the film itself, then the credits",
      "a past screening is kept and marked, since a run is the evidence a distributor and a venue both want",
    ],
    pages: [
      { file: "index", role: "the trailer and the next screenings, with the Q&A dates marked" },
      { file: "screenings", role: "every date, past and future, and how to request one" },
      { file: "about", role: "the film, the runtime, the certificate and who made it" },
    ],
    kinds: ["film", "documentary", "short film", "theatre production", "festival premiere", "screening tour", "independent cinema"],
    components: ["video-embed", "tour-dates", "ticket-tiers", "press-quote", "safe-image", "faq", "section-header"],
    structure: "full-bleed-hero",
    ready: true,
  },

  solar: {
    md: "Solar or retrofit installer — savings-calculator-first",
    label: "an honest estimate from the roof and the bill, with the payback stated in years",
    cta: ["Estimate my saving", "Book a survey"],
    shape: [
      "split: a calculator on one side taking roof size and current bill, the range it produces on the other",
      "body: what the install actually involves, then the grants, then what would make us say no",
      "the estimate is a BAND rather than a figure, because a single number implies a precision no survey has",
    ],
    pages: [
      { file: "index", role: "the calculator, the payback band, and what the figures assume" },
      { file: "how-it-works", role: "the install week by week, the grants, and the roofs we turn down" },
      { file: "survey", role: "booking the survey — free, no obligation, and what it measures" },
    ],
    kinds: ["solar installer", "heat pump", "battery storage", "EV charger", "insulation", "retrofit", "renewable energy"],
    components: ["calculator-card", "estimate-band", "arrangement-steps", "quote-request", "price-list", "faq", "section-header"],
    structure: "split-screen",
    ready: true,
  },

  waste: {
    md: "Skip hire or waste collection — size-and-date-first",
    label: "which size, which day, and whether a permit is needed — the three things that stop a booking",
    cta: ["Book a skip", "Check permits"],
    shape: [
      "hero: the sizes compared against something a person can picture, and the date it can land",
      "body: what may not go in, then the permit question, which is a council matter and takes days",
      "the prohibited list is prominent, because one mattress in a mixed skip is a charge nobody expects",
    ],
    pages: [
      { file: "index", role: "sizes, the next available date, and what cannot go in" },
      { file: "sizes", role: "every size against a real comparison, with what each realistically holds" },
      { file: "book", role: "the booking — access, the permit, and the collection window" },
    ],
    kinds: ["skip hire", "waste collection", "house clearance", "grab hire", "man and van waste", "recycling", "scrap metal"],
    components: ["size-guide", "bin-type", "permit-row", "collection-day", "price-list", "faq", "section-header"],
    structure: "single-scroll",
    ready: true,
  },

  security: {
    md: "Alarm, CCTV or guarding — response-first",
    label: "how fast somebody actually attends, in writing, ahead of any equipment specification",
    cta: ["Book a survey", "Talk to us"],
    shape: [
      "hero: the response time as a contractual figure with last quarter's actual beside it",
      "body: what is monitored and by whom, then the systems, then what happens on an activation",
      "false alarms are addressed openly, since they are the real cost of a system and nobody advertises them",
    ],
    pages: [
      { file: "index", role: "the response time, what monitoring means, and what an activation looks like" },
      { file: "systems", role: "alarms, cameras and access control, with what each does and does not do" },
      { file: "monitoring", role: "the receiving centre, police response levels, and the false-alarm policy" },
    ],
    kinds: ["alarm installer", "CCTV", "security guarding", "keyholding", "access control", "monitoring centre", "mobile patrol"],
    components: ["alarm-state", "patrol-log", "sla-clock", "incident-report", "price-list", "faq", "section-header"],
    structure: "single-scroll",
    ready: true,
  },

  memorial: {
    md: "Memorial mason — regulations-and-choosing",
    label: "the cemetery's rules constrain everything, so they come before the catalogue, gently",
    cta: ["Talk to us", "See memorials"],
    shape: [
      "editorial: quiet, unhurried, one measure — a grid of headstones is the wrong register entirely",
      "body: what the burial authority permits where you are, then the choosing, then the timescale",
      "the six-month wait for the ground to settle is stated early, because it is the thing nobody is told",
    ],
    pages: [
      { file: "index", role: "the regulations that constrain the choice, and the honest timescale" },
      { file: "memorials", role: "the work, with materials and what each costs to maintain" },
      { file: "guidance", role: "inscriptions, permits, and adding to an existing memorial later" },
    ],
    kinds: ["memorial mason", "monumental mason", "headstones", "cremation memorials", "renovation and re-lettering", "cemetery works"],
    components: ["compliance-checklist", "arrangement-steps", "price-list", "gallery", "safe-image", "faq", "section-header"],
    structure: "editorial",
    ready: true,
  },

  translation: {
    md: "Translation or interpreting — language-pair-first",
    label: "the pair and the turnaround set the price; no imagery, just the rates and the queue",
    cta: ["Get a quote", "Send a document"],
    shape: [
      "terminal: monospace, hairline rules, no photography — the product is words and a deadline",
      "body: the pairs with a rate each, then the turnaround, then which documents need certifying",
      "certified, sworn and notarised are three different things and the page says which yours needs",
    ],
    pages: [
      { file: "index", role: "the pairs, the per-word rate and the current turnaround" },
      { file: "rates", role: "every pair and document type, including the certifying surcharges" },
      { file: "quote", role: "sending a document — word count, deadline and what we need to know" },
    ],
    kinds: ["translation", "interpreting", "transcription", "subtitling", "localisation", "certified translation", "sign language"],
    components: ["rate-card", "turnaround-note", "word-count", "certification-row", "price-list", "faq", "section-header"],
    structure: "terminal",
    ready: true,
  },

  timetable: {
    md: "Scheduled transport — departures-first",
    label: "the next departures as a board, because a timetable is the entire product",
    cta: ["Next departures", "Full timetable"],
    shape: [
      "terminal: a departure board at the top, monospace, readable from across a shelter",
      "body: the full timetable, then fares, then what happens when a service cannot run",
      "a cancelled service stays on the board — removing it is how somebody waits for one that was never coming",
    ],
    pages: [
      { file: "index", role: "the next departures, live, with the expected times rather than 'delayed'" },
      { file: "timetable", role: "the full printed timetable, both directions, with the school-day variations" },
      { file: "fares", role: "single, return, day and season, plus who travels free" },
    ],
    kinds: ["bus service", "community transport", "ferry", "park and ride", "shuttle", "dial-a-ride", "heritage railway"],
    components: ["departure-board", "service-times", "fare-quote", "location-card", "faq", "section-header"],
    structure: "terminal",
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
export function layoutDirective(family, { structure } = {}) {
  // The two mold-breakers are ordinary families now, so the fallback that used
  // to reach a second table is gone. They were ready, produced a directive and
  // were documented — and lived OUTSIDE the families object, so they were absent
  // from READY_FAMILIES, from the designer tool's enum and from the prompt. The
  // model could not pick either one. Seventh instance in this repo of something
  // built, tested, on disk and reachable by nothing.
  const f = FAMILIES[family];
  if (!f || !f.ready) return null;
  if (structure !== undefined && !STRUCTURES[structure]) return null;
  // The SKELETON is a family property with a per-build override. Every family
  // declares a default structure — a store browses (card-grid), a firm reads
  // (single column), a departures board is a terminal — so two families stop
  // sharing one shape by default, and a build may still ask for any of the
  // eight explicitly.
  const chosen = structure ?? f.structure;

  const shipped = f.pages.filter((p) => !p.alt);
  const lines = [
    `LAYOUT — ${f.md}: ${f.label}.`,
    ...f.shape.map((s) => `- ${s}`),
    `Primary action: ${f.cta.map((c) => `"${c}"`).join(" / ")} — this verb leads the header, the hero, and the closing band.`,
    `Reach first for: ${f.components.join(", ")}.`,
    // The page COUNT is the family's, not a global default: a café is one
    // scroll and a docs site is four linked pages. The names are the
    // archetype's — keep the count and the division of labour, and rename the
    // routes for the business at hand where that reads better.
    // ALT PAGES ARE EXCLUDED, and this is the line that makes declaring them
    // safe. `pages` is two things at once: the reference app's manifest AND
    // the instruction telling a generated site what to build. An alternative
    // home is a real page of the REFERENCE app — it compiles, renders and is
    // guarded like any other — but a customer's salon must not be told to ship
    // a /call-now route. Without this filter every generated site would.
    `This family ships ${shipped.length} page${shipped.length === 1 ? "" : "s"}:`,
    ...shipped.map((p) => `- ${p.file === "index" ? "/" : "/" + p.file} — ${p.role}`),
  ];
  if (chosen) lines.push(`Structure — ${chosen}: ${STRUCTURES[chosen].text}.`);
  return lines.join("\n");
}
