// The page generator's model-facing half — the rules it writes against, the
// tool it fills in, and the deterministic checks its output has to survive.
//
// Kept out of worker.js on purpose: this is plain, dependency-free JavaScript,
// so it can be imported and tested outside the Worker (see test/page-gen.test.mjs)
// the same way site-schema.mjs and site-data.mjs are.
//
// The contract itself is builder/GENERATOR.md, and the page it is derived from is
// builder/lovable/template/src/routes/index.tsx. Both are reproduced here because
// the Worker has no filesystem; a test asserts this copy has not drifted from the
// file, and GENERATOR.md's rule stands — when the two disagree, the file wins.


// Generated from the component files by builder/gen-component-api.mjs. Kept in
// step by test/component-api.test.mjs, which regenerates and compares.
import { COMPONENT_API, COMPONENT_TYPES } from "./component-api.mjs";
// The chart half, generated from src/components/charts/lib by
// builder/gen-chart-api.mjs and kept in step by test/chart-api.test.mjs.
import { CHART_COMPONENTS, CHART_API } from "./chart-api.mjs";
import { FAMILIES, layoutDirective } from "./site-layouts.mjs";
import { imageDirective } from "./site-images.mjs";
import { FAMILY_EXEMPLARS } from "./family-exemplars.mjs";
import { modelsFor } from "./build-models.mjs";
// One worked call per primitive, mined out of the demos by
// builder/gen-chart-usage.mjs. This is what the 1,140 demo files are FOR: they
// are the only place in the repo these APIs are called, and they compile, so
// every example is known-good rather than something written from the types.
// Reachable only this way — the model has no filesystem, and importing a demo
// is the defect the lint refuses.
import { CHART_USAGE } from "./chart-usage.mjs";
import { normalizePayment } from "../site-payments.mjs";

/**
 * The house motion set. Spec and reasoning: builder/MOTION.md.
 *
 * Named here because a class the model is never told about is a class no
 * generated page will ever carry. This codebase has installed unreachable
 * capability three times — 27 blocks, 196 examples, 882 chart primitives — each
 * on disk, compiling, and used by nothing because no rule mentioned it. The
 * drift test runs BOTH ways: an effect in styles.css that is not listed here is
 * dead, and one listed here that is not in styles.css is a class the model will
 * write and the browser will ignore.
 */
export const MOTION = [
  ["motion-enter", "something appears that the visitor did not ask for — a banner, a notice"],
  ["motion-fade", "the same, but for anything centred with translate (it would fight the centring)"],
  ["motion-stagger", "on a <ul> whose items arrive together — a service list, a menu"],
  ["motion-inout", "needs data-shown=\"true|false\"; stays mounted so it can animate OUT too"],
  ["motion-collapse", "needs data-open=\"true|false\"; opens to height auto, nothing measured"],
  ["motion-swap", "one thing replaced another in the same place — skeleton to content"],
  ["motion-press", "on a button; the press itself, 90ms"],
  ["motion-lift", "on a clickable card; hover only, so never the only sign it is clickable"],
  ["motion-reveal", "a section arriving as a long page is scrolled"],
  ["motion-progress", "a reading-progress bar; put it on the filled element"],
  ["motion-stick", "a header that changes once it has stuck; the change goes on its CHILD"],
];
const MOTION_CATALOGUE = MOTION.map(([n, why]) => `${n} — ${why}`).join("\n");
const MOTION_COUNT = MOTION.length;

/** Domain -> its exports, one line each. What the compose prompt spends its chart budget on. */
export const CHART_CATALOGUE = Object.entries(CHART_COMPONENTS)
  .map(([domain, names]) => `${domain}: ${names.join(", ")}`).join("\n");
const CHART_DOMAIN_COUNT = Object.keys(CHART_COMPONENTS).length;
const CHART_NAME_COUNT = Object.values(CHART_COMPONENTS).reduce((n, v) => n + v.length, 0);
/**
 * WHAT EACH MODULE ACTUALLY EXPORTS, component names and type names alike.
 *
 * The lint knew only that `@/components/ui/faq` was a real FILE, never that the
 * thing being imported out of it was real. Measured live 2026-08-09: a build
 * wrote `import { FaqAccordion } from "@/components/ui/faq"`, the module exports
 * `Faq`, and it passed validate and lint, failed `tsc`, and cost the customer
 * the whole site — `TS2305`, one of the three commonest failures there are.
 *
 * Derived from `COMPONENT_API`, which already carries the names (a module with
 * several exports lists them all, separated by `·`), so this costs no new
 * generated file and cannot drift from it.
 */
export const UI_EXPORTS = (() => {
  const out = {};
  for (const [mod, sig] of Object.entries(COMPONENT_API)) {
    const names = new Set();
    for (const m of String(sig).matchAll(/([A-Z][A-Za-z0-9]*)\s*\(/g)) names.add(m[1]);
    for (const t of Object.keys(COMPONENT_TYPES[mod] || {})) names.add(t);
    if (names.size) out[mod] = names;
  }
  return out;
})();

/** Every component in src/components/ui. An import of anything else does not resolve. */
/**
 * The kit components that draw their picture THROUGH `SafeImage` — so an empty
 * `src` is the designed placeholder rather than a broken-image icon.
 *
 * This is the allow-list for a `@@IMG:@@` photograph token, and it exists
 * because `SafeImage` alone was too narrow: the first live build put one in
 * `<Gallery>`, which is exactly right and was reported as a problem.
 *
 * DERIVED FROM THE KIT, not curated — `test/page-gen.test.mjs` re-reads every
 * ui component on disk and fails on any difference, both directions. A
 * hand-kept list here would go stale the first time a card started using the
 * guard, and the failure mode is the lint scolding the model for doing the
 * right thing.
 */
export const SAFE_IMAGE_COMPONENTS = [
  "AnnotationUpload", "ArticleCard", "BeforeAfter", "BeforeAfterUpload", "BrandUpload", "CartLine",
  "CaseStudyCard", "ConnectCard", "CourseCard", "CoverImage", "DishCard", "EventCard", "EvidenceList",
  "ExhibitionCard", "Figure", "FilePreviewPane", "Gallery", "Hero", "HeroSplit", "ImageStrip",
  "InvoiceHeader", "Letterhead", "MediaGrid", "PageThumbnails", "PractitionerCard", "ProductCard",
  "ProofOfCollection", "PropertyCard", "RecipeCard", "RoomCard", "SafeImage", "SellerCard",
  "ServiceCard", "SharePreview", "SignatureBlock", "SnagItem", "StarterGallery", "StoryLead",
  "TeamGrid", "ThumbnailPicker", "VehicleCard", "VideoHero",
];

export const UI_COMPONENTS = [
  "accordion", "alert-dialog", "alert", "aspect-ratio", "avatar", "badge", "breadcrumb",
  "button", "calendar", "card", "carousel", "chart", "checkbox", "collapsible", "command",
  "context-menu", "dialog", "drawer", "dropdown-menu", "form", "hover-card", "input-otp",
  "input", "label", "menubar", "navigation-menu", "pagination", "popover", "progress",
  "radio-group", "resizable", "scroll-area", "select", "separator", "sheet", "sidebar",
  "site-chrome", "skeleton", "slider", "sonner", "switch", "table", "tabs", "textarea", "toggle-group",
  "toggle", "tooltip",
  // Added 2026-07-30. `empty` and `spinner` because the rules already require
  // every list to handle "nothing yet" and every submit to show it is working,
  // and the model was hand-rolling both every time; `field` and `input-group`
  // because most generated sites are a form.
  "empty", "spinner", "field", "input-group",
  // The rest of what the registry actually ships for this style. `toast` is
  // deliberately NOT here: it is superseded by `sonner`, which we have, and
  // offering both would give the model two ways to raise a toast and it would
  // pick inconsistently between pages of the same site.
  "button-group", "item", "kbd",
  // From the new-york-v4 style, fetched by URL: this template declares style
  // "new-york" (v3), which is why the CLI could not resolve it by name. A plain
  // <select> — lighter than the Radix one for a three-option dropdown, which is
  // most of them.
  "native-select",
  // The rest of the v4-only set, added 2026-07-30 (owner's call: take everything
  // shadcn publishes). `combobox` had been refused twice — it wants v4's button
  // sizes and fails TS2322 without them — and it compiles now that button.tsx
  // carries `xs`/`icon-xs`/`icon-sm`/`icon-lg` alongside its own four.
  //
  // The five chat primitives are here because they EXIST, not because a business
  // site needs them. They are for building a chat UI; nothing in PAGE_RULES points
  // at them, and the lint only cares that a cited component is real.
  "combobox", "direction",
  "attachment", "bubble", "marker", "message", "message-scroller",

  // ── OURS, not shadcn's (2026-07-30) ────────────────────────────────────────
  // The 61 above are PRIMITIVES — button, input, dialog. A business site is made
  // of COMPOSITIONS, and every generated page was rebuilding them inline from
  // card and div: a hero, a price list, an opening-hours table, the four states
  // of a list. That is what every paid component registry sells, and writing them
  // ourselves costs no licence, no token and no npm dependency.
  //
  // Written rather than bought for a second reason that turned out to matter
  // more: the expensive part of a bigger kit was never storing it, it was
  // DESCRIBING it to the model. We own these APIs, so the usage notes are
  // accurate by construction — where 400 foreign components would be 400
  // unfamiliar APIs the model half-understands.
  //
  // Page sections.
  "hero", "hero-split", "section-header", "feature-grid", "stats-band",
  "pricing-table", "price-list", "menu-section", "testimonial", "cta-band",
  "faq", "steps", "team-grid", "gallery", "logo-cloud", "announcement-bar",
  "site-header", "site-footer", "before-after",
  // The business itself.
  "opening-hours", "contact-card", "location-card", "availability-grid",
  "review-stars", "social-links",
  // Data and state. `data-list` is the important one: all four list states in
  // one place, which the rules otherwise ask the model to hand-write on every
  // list of every page.
  "data-list", "stat-card", "timeline", "tag-list", "countdown", "marquee",
  "safe-image", "copy-button", "share-buttons",
  // Forms.
  "date-time-picker", "phone-input", "quantity-input", "file-drop", "success-panel",

  // ── The second hundred (2026-07-30) ───────────────────────────────────────
  // Utility-first: the shapes a page needs over and over, rather than more ways
  // to decorate one. Monochrome throughout — state is carried by fill, weight and
  // a written label, never by colour alone, which does not survive greyscale or
  // reach anyone who cannot see it.
  // Layout — structure a page without hand-rolling flex and grid every time.
  "container", "section", "stack", "inline", "auto-grid", "two-col",
  "center-box", "bento-grid", "masonry", "sticky-bar", "page-header",
  "scroll-top", "divider-text", "spacer", "toolbar", "overflow-scroller",
  // Typography.
  "prose", "heading", "text", "lead", "quote", "bullet-list", "clamp-text",
  "expandable-text",
  // Data display.
  "description-list", "key-value", "data-table", "sortable-header",
  "row-actions", "avatar-group", "status-dot", "status-badge",
  "progress-ring", "metric-delta", "count-badge", "comparison-table",
  "detail-panel", "record-header", "legend",
  // Feedback and state.
  "banner", "callout", "inline-alert", "loading-overlay", "stepper",
  "skeleton-text", "skeleton-card", "error-state", "confirm-dialog",
  "offline-banner", "busy-button", "retry-panel",
  // Navigation.
  "tab-nav", "nav-list", "anchor-nav", "back-link", "prev-next", "link-card",
  "mobile-nav", "side-nav", "step-nav", "nav-footer", "result-count",
  "external-link",
  // Forms. Every one carries the right autoComplete and inputMode, which is most of what makes a form fillable on a phone.
  "form-row", "form-section", "form-actions", "form-error-summary",
  "field-hint", "required-mark", "search-input", "password-input",
  "email-input", "url-input", "number-input", "currency-input",
  "percent-input", "textarea-count", "checkbox-group", "radio-cards",
  "switch-row", "multi-select", "address-fields", "name-fields",
  // Media.
  "video-embed", "audio-player", "cover-image", "media-grid", "image-strip",
  "avatar-upload", "icon-badge", "logo",
  // Utility.
  "theme-toggle", "print-button", "cookie-banner", "scroll-progress",
  "reveal", "time-ago", "duration", "visually-hidden", "avatar-name",

  // ── The third hundred (2026-07-30) ────────────────────────────────────────
  // Whole flows rather than more parts: a basket, a booking, an account, an
  // admin table. Same rules as the rest — prop-driven, monochrome unless the
  // meaning is genuinely semantic, and colour never the only signal.
  // Commerce.
  "product-card", "price-tag", "cart-line", "cart-summary", "order-summary",
  "coupon-input", "stock-badge", "variant-picker", "delivery-estimate",
  "payment-methods", "trust-strip", "order-tracker", "wishlist-button",
  "add-to-cart",
  // Booking and scheduling — the shapes this platform's sites are mostly made of.
  "calendar-month", "day-schedule", "week-strip", "duration-picker",
  "party-size", "booking-summary", "cancel-policy", "waitlist-form",
  "recurring-picker", "timezone-note",
  // Accounts and members.
  "login-form", "signup-form", "reset-form", "otp-form", "profile-card",
  "account-menu", "plan-card", "usage-meter", "invite-form",
  "permission-row", "danger-zone", "session-row",
  // Dashboard and admin.
  "metric-row", "filter-bar", "date-range-picker", "bulk-actions",
  "export-button", "column-toggle", "saved-views", "activity-feed",
  "audit-row", "inbox-list", "assignee-picker", "priority-badge",
  // Content and publishing.
  "article-card", "article-header", "author-byline", "reading-time",
  "post-meta", "related-list", "category-nav", "figure", "code-block",
  "changelog-entry", "glossary-item", "faq-search",
  // Social proof.
  "rating-summary", "review-card", "rating-input", "review-form",
  "verified-badge", "award-badge", "press-quote", "case-study-card",
  // Interaction.
  "like-button", "vote-buttons", "emoji-reaction", "nps-scale",
  "feedback-widget", "labeled-progress", "sticky-cta", "tour-step",
  "hotkey-list", "toggle-chip",
  // Formatting. All Intl-based, so they localise for free and add no dependency.
  "money", "number-format", "date-format", "list-format", "plural",
  "truncate-middle", "highlight-match", "file-size", "ordinal", "initials",
  // More layout.
  "split-view", "panel", "well", "card-grid", "list-row", "media-object",
  "empty-illustration", "sidebar-layout", "sticky-aside", "centered-form",
  "section-divider", "grid-item",

  // ── The fourth hundred (2026-07-30) ───────────────────────────────────────
  // Files, tables at scale, charts without a charting library, onboarding,
  // search, settings, status, events, and the cards for the trades this
  // platform actually builds sites for.
  // Files and attachments.
  "file-type-icon", "file-row", "file-list", "upload-progress", "download-card",
  "attachment-list", "storage-bar",
  // Notifications and discussion.
  "notification-item", "notification-list", "notification-bell", "unread-divider",
  "comment", "comment-thread", "reply-box", "mention-chip", "moderation-note",
  // Tables at scale. The four that matter are `select-all-banner` (page vs all),
  // `expandable-row`, `totals-row` and `grouped-rows` — the parts a table grows
  // once it has more rows than fit.
  "page-size-select", "row-select", "select-all-banner", "expandable-row",
  "totals-row", "grouped-rows", "table-skeleton", "sticky-table",
  "density-toggle", "inline-edit",
  // Charts, hand-drawn in SVG and CSS. Deliberately NOT recharts: these are the
  // small ones — a trend beside a number, a share of a total — where a charting
  // library is 90 KB to draw eight rectangles. `chart` and src/components/charts
  // are still there for a real one.
  "sparkline", "mini-bars", "bar-list", "donut-mini", "gauge", "heat-strip",
  "ratio-bar", "dot-plot", "progress-stack", "trend-arrow",
  // Onboarding and first run.
  "welcome-card", "setup-checklist", "spotlight", "whats-new",
  "sample-data-banner", "getting-started", "connect-card", "first-run",
  // Search.
  "search-header", "search-results", "recent-searches", "search-suggestions",
  "no-results", "search-facets", "sort-select", "applied-filters",
  // Settings and account admin.
  "settings-nav", "setting-item", "notification-prefs", "api-key-row",
  "webhook-row", "connected-account", "billing-summary", "invoice-row",
  "seat-usage", "two-factor-setup", "email-verify-banner",
  // System status.
  "uptime-bar", "incident-item", "status-list", "maintenance-notice",
  "latency-badge", "sync-status", "queue-depth",
  // Events and calendars.
  "event-card", "agenda-list", "time-slot", "rsvp-buttons", "event-meta",
  "all-day-row", "date-nav", "now-line", "ics-button",
  // The trades. A generated site is usually one of these, and each card is the
  // shape that trade's listings actually take.
  "job-card", "property-card", "course-card", "recipe-card", "dish-card",
  "service-card", "room-card", "vehicle-card", "ticket-card", "donation-card",
  "membership-card",
  // More inputs and utility.
  "tag-input", "slug-input", "unit-input", "weekday-picker", "color-swatch",
  "id-badge", "json-view", "diff-text", "word-count", "map-embed",

  // ── The fifth hundred (2026-07-30) ────────────────────────────────────────
  // Messaging (12) · printed documents and invoices (12) · the forms that are
  // actually hard (13) · what a page does when something breaks (10) ·
  // accessibility and page structure (10) · location and delivery (10) ·
  // bulk import (10) · time and availability (11) · people and org (12).
  // Messaging and support.
  "chat-message", "chat-thread", "chat-composer", "typing-indicator",
  "message-status", "conversation-row", "help-launcher", "canned-reply",
  "contact-form", "ticket-row", "sla-badge", "escalation-note",
  // Documents, invoices and print. `print-only`/`screen-only`/`page-break`
  // exist because the commonest printing bug is not layout — it is eight
  // pages of navigation printed because nothing said not to.
  "invoice-header", "invoice-lines", "invoice-totals", "receipt", "letterhead",
  "signature-block", "terms-block", "document-meta", "page-break",
  "print-only", "screen-only", "watermark",
  // Forms, the cases the first four hundred did not cover.
  "multi-step-form", "form-progress", "repeatable-field", "conditional-field",
  "signature-pad", "consent-checkbox", "date-of-birth", "time-input",
  "range-input", "scale-input", "matrix-question", "honeypot", "save-draft",
  // What the page does when something goes wrong.
  "error-boundary", "not-found", "forbidden", "rate-limited",
  "maintenance-page", "stale-data-note", "slow-note", "undo-toast",
  "conflict-note", "partial-failure",
  // Accessibility and page structure. `skip-link` + `landmark` are a PAIR —
  // the link needs the main region's id and tabindex to do anything.
  "skip-link", "live-region", "focus-trap", "heading-level", "lang-switch",
  "text-size", "landmark", "seo-jsonld", "share-preview", "page-title",
  // Location and delivery.
  "store-locator", "distance-badge", "service-area", "travel-time",
  "postcode-input", "pickup-point", "delivery-slot", "shipping-options",
  "address-summary", "country-select",
  // Getting existing data in.
  "csv-import", "column-mapper", "import-preview", "paste-table",
  "import-summary", "batch-progress", "row-errors", "dry-run-note",
  "dedupe-list", "template-download",
  // Time and availability. `open-now` answers the question a visitor has;
  // `opening-hours` shows the week.
  "open-now", "holiday-notice", "lead-time", "blackout-dates", "shift-badge",
  "time-until", "slot-hold", "timezone-picker", "recurrence-summary",
  "duration-bar", "date-badge",
  // People and org. `presence-dot` is about a PERSON and `status-dot` about a
  // system — they look alike and one component covering both ends up with a
  // colleague who is "Failed".
  "person-row", "presence-dot", "role-badge", "org-chart", "skill-tags",
  "on-call", "handoff-note", "availability-legend", "capacity-bar",
  "mention-picker", "directory-list", "approval-chain",
  // ── The sixth hundred (2026-07-31) ────────────────────────────────────────
  // Editing and document state. Every product that lets somebody write
  // anything needs these, and not one of them existed.
  "markdown-editor", "markdown-preview", "format-toolbar", "paste-clean",
  "undo-redo", "char-limit-ring", "dirty-indicator", "draft-badge",
  "lock-indicator", "revert-button",
  "rich-text", "code-editor", "emoji-picker", "mention-textarea", "link-editor",
  "slash-menu", "block-menu", "drag-handle", "selection-toolbar",
  "table-editor", "find-replace", "focus-mode", "version-history",
  "comment-anchor", "suggestion-mode",
  // Pickers. A picker is the same problem every time and is got wrong every
  // time, which is exactly what a kit is for.
  "search-select", "tag-select", "async-select", "cascading-select",
  "dependent-select", "transfer-list", "dual-list", "tree-select",
  "stepper-input", "slider-input", "number-scrubber", "unit-toggle",
  "color-picker", "icon-picker", "size-picker", "radius-picker",
  "aspect-picker", "spacing-picker", "font-picker",
  "month-picker", "year-picker", "quarter-picker", "week-picker",
  "time-range", "cron-builder",
  // Lists and collections, past the plain one.
  "virtual-list", "grouped-list", "nested-list", "tree-view", "tree-item",
  "checkbox-tree", "reorderable-grid", "list-toolbar", "list-density",
  "two-line-row", "three-line-row", "swipeable-row", "selectable-list",
  "multi-column-list", "chip-list", "timeline-vertical", "timeline-horizontal",
  "shelf", "cluster", "rail",
  // Tables, past the plain one.
  "pivot-table", "frozen-columns", "column-resize", "column-reorder",
  "cell-editor", "cell-badge", "cell-sparkline", "row-detail", "row-group",
  "footer-summary", "table-export", "table-search", "column-filter",
  "multi-sort", "table-settings", "comparison-columns", "matrix-table",
  "spreadsheet-grid", "compare-table", "feature-matrix",
  // Forms, past the plain fields.
  "field-array", "masked-input", "card-input", "cvc-input", "expiry-input",
  "iban-input", "password-strength", "confirm-field", "field-lock",
  "inline-form", "quick-add", "bulk-edit-panel", "template-fill",
  "autofill-note", "otp-resend", "form-lock", "field-group", "field-error",
  "field-success", "form-diff",
  // Signing in, and the screens around it.
  "passkey-prompt", "device-list", "login-history", "suspicious-login",
  "recovery-codes", "backup-email", "security-score", "permission-matrix",
  "role-picker", "scope-list", "sso-button", "magic-link-sent",
  "verify-pending", "lockout-note", "session-expiry", "step-up-prompt",
  // Media, past the embed.
  "video-player", "waveform", "transcript-line", "chapter-list",
  "subtitle-track", "playback-speed", "scrubber", "poster-picker",
  "volume-slider", "live-badge", "viewer-count", "audio-recorder",
  "image-crop", "image-zoom", "image-compare", "lightbox", "thumb-strip",
  "progressive-image", "blur-up", "media-caption",
  // AI surfaces. Not a vertical — every product being built now has these.
  "prompt-box", "model-picker", "streaming-text", "thinking-indicator",
  "tool-call-card", "citation-list", "source-card", "token-meter",
  "regenerate-button", "response-rating", "suggestion-chips",
  "conversation-branch", "voice-input", "transcript-view", "context-meter",
  "attachment-tray", "stop-generating", "copy-response", "prompt-history",
  "system-prompt-editor",
  // Code and technical display.
  "code-diff", "log-viewer", "terminal-output", "stack-trace",
  "status-code-badge", "curl-example", "sdk-tabs", "schema-viewer",
  "json-tree", "syntax-highlight", "request-timing", "header-table",
  "query-params", "env-badge", "build-status", "commit-row", "branch-badge",
  "diff-stat",
  // Overlays and interruption.
  "toast-stack", "snackbar", "progress-toast", "modal-stack", "sheet-stack",
  "popover-menu", "rich-tooltip", "coach-mark", "hint-dot", "nudge-bubble",
  "celebration", "blocking-overlay", "timeout-note", "slide-over",
  "confirm-inline", "dismiss-all",
  // Motion and gesture. No animation runtime anywhere.
  "parallax", "tilt-card", "count-up", "typewriter", "confetti", "ripple",
  "drag-list", "sortable-list", "swipe-actions", "resize-handle",
  "pull-to-refresh", "infinite-scroll", "snap-carousel", "magnetic-button",
  "flip-card", "stagger-list", "shake-error", "pulse-dot", "morph-height",
  "scroll-reveal",
  // App shell and editor furniture.
  "split-pane", "dock", "drawer-stack", "mega-menu", "sidebar-collapse",
  "sticky-shrink", "breadcrumb-collapse", "workspace-switcher", "app-shell",
  "panel-group", "floating-toolbar", "context-panel", "zoom-controls",
  "layer-list", "property-panel", "pane-tabs", "command-bar",
  "quick-switcher", "shortcut-overlay", "resizable-columns",
  // Navigation.
  "cursor-pagination", "load-more", "jump-to", "section-nav", "tab-overflow",
  "nav-badge", "back-to-list", "related-nav", "sitemap-list", "nav-search",
  "recent-nav", "pinned-nav", "nav-group", "scroll-spy", "snap-sections",
  // Search.
  "search-scope", "search-history", "saved-search", "query-builder",
  "filter-tree", "facet-range", "multi-sort-picker", "result-preview",
  "did-you-mean", "search-shortcut", "instant-results", "search-empty",
  // Collaboration.
  "presence-bar", "live-cursor", "typing-dots", "comment-pin",
  "resolve-thread", "mention-badge", "share-invite", "viewer-list",
  "edit-lock", "activity-dot", "follow-changes", "co-edit-note",
  "conflict-merge", "change-request",
  // Sharing and getting things out.
  "share-sheet", "embed-code", "qr-code", "download-menu", "export-format",
  "print-preview", "permalink", "short-link", "email-share", "copy-link",
  "social-preview", "export-progress",
  // Notifications.
  "toast-queue", "notification-group", "digest-row", "snooze-menu",
  "priority-inbox", "mute-schedule", "channel-toggle", "delivery-status",
  "notification-empty", "subscribe-toggle",
  // Deciding between things.
  "pros-cons", "decision-matrix", "weighted-score", "option-card",
  "trade-off-bar", "recommendation-badge", "side-by-side", "spec-row",
  "winner-badge", "shortlist-bar",
  // Workflow and state.
  "state-badge", "transition-arrow", "workflow-map", "phase-bar",
  "checkpoint-list", "rollback-note", "stage-gate", "progress-donut",
  "completion-ring", "milestone-dot", "blocked-note", "handover-bar",
  // Numbers and units.
  "unit-convert", "precision-toggle", "big-number", "delta-pill",
  "tolerance-bar", "percent-ring", "currency-switch", "rounding-note",
  "range-summary", "threshold-bar",
  // Loading and progressive rendering.
  "shimmer", "skeleton-list", "skeleton-form", "placeholder-grid",
  "lazy-boundary", "content-placeholder", "load-error", "partial-list",
  "stale-badge", "refresh-pill",
  // Accessibility surfaces.
  "reduce-motion", "high-contrast", "screen-reader-note", "alt-text-field",
  "contrast-check", "keyboard-map", "reading-guide", "caption-toggle",
  "transcript-toggle", "tab-order-note",
  // Trust and safety.
  "report-reason", "moderation-queue", "appeal-form", "strike-badge",
  "age-gate", "content-warning", "blur-sensitive", "source-label",
  "spam-note", "trust-score",
  // Asking people things.
  "survey-card", "question-nav", "likert-row", "ranking-list",
  "open-question", "csat-face", "effort-score", "exit-survey",
  "poll-result", "vote-bar", "sentiment-chip", "response-summary",
  // Settings.
  "preference-group", "reset-defaults", "import-settings", "export-settings",
  "shortcut-row", "theme-picker", "density-preference", "unit-preference",
  "startup-page", "advanced-toggle",
  // Typography and long-form.
  "drop-cap", "pull-quote", "footnote", "sidenote", "definition",
  "table-of-contents", "anchor-heading", "read-progress", "byline-compact",
  "kicker",
  // Plumbing - headless utilities.
  "portal", "click-outside", "scroll-lock", "drop-zone", "drag-preview",
  "breakpoint-badge", "safe-area", "offline-queue", "idle-note",
  "clipboard-history", "hotkey-badge", "media-query-note",
  // Onboarding.
  "feature-tour", "whats-new-dot", "upgrade-badge", "usage-nudge",
  "empty-cta", "sample-toggle", "reset-demo", "checklist-dot",
  // Shaping a set of data.
  "date-preset", "relative-date", "filter-preset", "group-by-picker",
  "aggregate-picker", "bucket-picker", "top-n-picker",
  // Keyboard and power users.
  "command-item", "command-group", "key-sequence", "keyboard-tip",
  "focus-list",
  // Validation.
  "error-summary-link", "field-warning", "async-validation",
  "uniqueness-check", "format-hint",
  // Clocks and elapsed time.
  "timezone-clock", "world-clock", "working-hours", "availability-toggle",
  "snooze-until", "deadline-bar", "elapsed-timer", "stopwatch",
  "countdown-ring",
  // Is this data any good?
  "completeness-bar", "missing-fields", "data-freshness", "outlier-flag",
  "duplicate-badge", "quality-score",
  // Getting files in.
  "chunked-upload", "upload-queue", "paste-image", "camera-capture",
  "scan-document", "file-preview", "folder-tree", "folder-path",
  // Location without a map provider.
  "coordinate-input", "radius-slider", "place-search",
  // Layout, the pieces still missing.
  "aspect-box", "full-bleed", "edge-fade", "gutter", "sidebar-right",
  "three-col", "content-width", "sticky-columns", "sticky-footer",
  // Money as a shape.
  "amount-input", "currency-amount", "tax-toggle", "discount-input",
  "payment-picker", "split-amount",
  // Shapes with no near neighbour - 2D arrangements, and the pickers,
  // money and media shapes nothing above can stand in for.
  "kanban-board", "gantt-bars", "heatmap-grid", "time-lane-grid", "seat-map",
  "variant-matrix", "funnel-steps", "tree-table", "node-graph", "timesheet-grid",
  "multi-date-picker", "nl-date-input", "meeting-poll-grid", "rule-builder",
  "option-priced-list", "split-tender", "split-by-item", "range-trim",
  "image-annotate", "focal-point", "read-aloud", "rtl-preview", "barcode",
  "stamp-card", "poll-composer", "minimap-scroll",
  // Catalogue.
  "colour-swatch", "stock-level", "unit-price", "bulk-pricing",
  "preorder-badge", "backorder-note", "personalisation-field", "warranty-badge",
  "care-icons", "material-badge", "price-history", "min-order-note",
  "sku-field", "category-tile", "new-in-badge", "last-chance-badge",
  "quantity-break", "collection-header", "recently-viewed", "shop-the-look",
  // Cart and checkout.
  "cart-badge", "cart-empty", "saved-for-later", "promo-field",
  "click-collect", "delivery-window", "substitution-pref", "price-changed-note",
  "order-review", "place-order-bar", "gift-toggle", "gift-message",
  // Orders and fulfilment.
  "order-timeline", "tracking-input", "delivery-eta", "return-window",
  "partial-shipment", "pack-checklist", "failed-delivery", "leave-safe-consent",
  "return-reason", "proof-of-delivery", "collection-code", "address-correct-note",
  // Family signatures — the shape a whole KIND of site is built around, where
  // the kit had nothing close. An institutional site talking to two audiences,
  // an immersive top-of-page, a membership gate, the block a feed site ends
  // with, and the event/publishing/teaching shapes the model was writing inline
  // every time.
  "audience-switch", "video-hero", "paywall", "email-capture",
  "ticket-tiers", "install-command", "episode-row", "calculator-card",
  "curriculum-path", "tour-dates", "bid-box", "store-badges",
  // Sync, offline and conflict. What a page does when the connection drops, when a write does not land, and when two edits collide.
  "conflict-diff", "conflict-choice", "pending-changes", "optimistic-note", "reconnect-strip",
  "last-synced", "write-blocked", "read-only-mode", "draft-recovery", "unsaved-guard",
  "version-conflict", "background-job", "job-progress", "job-failed", "resume-upload",
  "partial-save", "retry-countdown", "connection-quality", "sync-conflict-list", "retry-budget",
  "write-queue",
  // Undo, history and revisions. What happened, who did it, and how to get back to how it was.
  "undo-stack", "action-history", "revert-panel", "snapshot-list", "restore-point",
  "diff-inline", "blame-gutter", "revision-slider", "change-summary", "who-changed",
  "rollback-confirm", "draft-vs-live", "autosave-history", "merge-preview", "history-scrub",
  // Selection and bulk mechanics. What 'select all' means this time, and what is actually ticked.
  "range-select", "cross-page-selection", "invert-selection", "selection-limit", "select-scope",
  "marquee-select", "selection-tray", "pick-remaining",
  // Drag, drop and reorder. Every draggable list also ships the keyboard route, because drag alone makes reordering a feature only some readers have.
  "drop-target", "reorder-list", "drop-indicator", "sortable-grid", "drag-autoscroll",
  "nest-indent", "move-to-menu", "drag-disabled-note", "reorder-buttons", "drop-rejected",
  // Keyboard and focus. One tab stop per list, the platform's own modifier, and saying where focus went.
  "shortcut-hint", "key-cap", "shortcut-sheet", "roving-list", "access-key-badge",
  "kbd-chord", "focus-return", "shortcut-conflict",
  // Duration, interval and recurrence. How long, how often, how much notice — and whether the rule really lands where the author thinks.
  "duration-input", "interval-picker", "lead-time-input", "buffer-time", "cutoff-time",
  "turnaround-note", "time-since", "working-hours-input", "overlap-warning", "grace-window",
  "time-budget", "schedule-preview", "next-occurrence", "deadline-note", "slippage-note",
  // Measurement, units and conversion. Each carries the domain knowledge a generic unit field gets silently wrong.
  "dimension-input", "weight-input", "temperature-input", "ratio-input", "tolerance-field",
  "min-max-field", "measurement-summary", "size-chart-row", "capacity-input", "distance-input",
  "area-input", "unit-mismatch",
  // Numbers, comparison and decision aids. Every one shows the working, and none carries its meaning in colour alone.
  "target-vs-actual", "benchmark-bar", "percentile-note", "confidence-range", "estimate-band",
  "score-breakdown", "tradeoff-slider", "what-if-toggle", "scenario-tabs", "sensitivity-note",
  "threshold-marker", "goal-gauge", "streak-counter", "running-total", "variance-note",
  "break-even-note", "payback-note",
  // Text, reading and truncation. Folded rather than cut, and the reading aids that actually help.
  "read-more", "glossary-term", "footnote-ref", "footnote-list", "abbreviation",
  "quote-attribution", "summary-toggle", "pronunciation-hint", "key-points", "text-scale",
  "line-focus", "column-reader",
  // Errors, recovery and support. Every failure names a next step, and the technical half folds away.
  "error-retry", "error-detail-toggle", "not-found-panel", "permission-denied", "maintenance-panel",
  "degraded-note", "report-problem", "error-reference", "support-handoff", "known-issue",
  "recovery-steps", "contact-fallback", "partial-outage",
  // Permissions and sharing. The safe option is never the default, and every scope states its consequence.
  "share-scope", "link-permissions", "access-summary", "who-can-see", "pending-invite",
  "transfer-ownership", "leave-confirm", "visibility-toggle", "embargo-note", "shared-with-list",
  "request-access", "access-expiry", "guest-note", "scope-summary",
  // Onboarding and guidance. Every step offers a way past it, and every nudge names the payoff.
  "setup-task", "first-run-panel", "tip-bubble", "sample-data-note", "skip-for-now",
  "progress-nudge", "completion-meter", "what-changed", "guided-step", "try-it-panel",
  "dismissed-tips", "first-value-note",
  // Search and retrieval. Why nothing matched, what was actually searched for, and which filter is hiding it.
  "search-operators", "zero-results", "facet-list", "query-chips", "typeahead-list",
  "search-within", "match-context", "sort-direction", "search-tips", "query-explain",
  // Forms, deeper mechanics. The wiring that makes a long form survivable — summaries that take focus, errors that anchor, and nothing hidden that still submits.
  "field-dependency", "conditional-section", "validation-summary", "inline-hint", "error-anchor",
  "prefill-note", "clear-form", "form-draft", "required-legend", "field-mask",
  "paste-parse", "field-history", "answer-review", "branching-note", "autofill-conflict",
  // Layout mechanics. Sticky things that know they are stuck, and the edge cues that stop a scrollable box looking full.
  "sticky-header", "scroll-shadow", "overflow-fade", "collapsible-panel", "fit-to-width",
  "print-break", "width-preset", "safe-area-pad", "back-to-top", "anchor-offset",
  // Tables, deeper. The parts that make a wide, long table readable — pinned columns, a real caption, and totals that say what they total.
  "column-pin", "row-expand", "footer-totals", "cell-error", "table-density",
  "column-chooser", "frozen-corner", "row-number", "table-loading", "cell-tooltip",
  "column-summary", "row-compare", "table-caption", "column-order", "cell-overflow",
  // Money mechanics. Every total shows its working, every fee says why, and nothing is rounded away in silence.
  "price-breakdown", "fee-line", "rounding-line", "currency-note", "exchange-rate-note",
  "amount-in-words", "payment-schedule", "instalment-line", "balance-due", "overpayment-note",
  "credit-applied", "deposit-line", "refund-line", "surcharge-note", "tip-picker",
  "split-evenly", "who-owes", "settle-up", "part-payment",
  // Files and documents. What a file is, what is inside it, whether it has been checked, and whether the text can be trusted.
  "file-preview-pane", "file-version", "file-conflict", "breadcrumb-path", "file-type-note",
  "scan-status", "checksum-note", "download-progress", "zip-contents", "page-thumbnails",
  "document-outline", "signature-request", "redaction-note", "watermark-note", "ocr-note",
  // Images and media handling. The controls a player and an image editor need, each with the keyboard route that gesture-only versions leave out.
  "crop-box", "rotate-control", "compare-slider", "zoom-pan", "exposure-note",
  "alt-text-warning", "media-duration", "caption-track", "waveform-scrub", "thumbnail-picker",
  "media-error", "autoplay-note", "picture-in-picture", "loop-toggle", "volume-control",
  // Notifications and attention. Who has seen it, when it comes back, and which channel carries which kind.
  "snooze-picker", "quiet-hours", "channel-preference", "seen-by", "acknowledge-button",
  "reminder-set", "follow-toggle", "watch-count",
  // Trust, safety and moderation. Removals that explain themselves, claims that name who checked them, and blocks you can find again.
  "moderation-queue-item", "appeal-status", "age-rating-note", "verified-claim", "dispute-note",
  "takedown-note", "safety-tips", "block-list", "mute-duration",
  // Status and lifecycle. Whose move it is, what is blocking it, and when the promise runs out.
  "lifecycle-bar", "state-machine-note", "blocked-by", "waiting-on", "handover-note",
  "sla-clock", "escalation-ladder", "queue-position", "eta-band", "throttle-note",
  "cooldown-note",
  // Comparison and choice. Reasons that can be argued with, and the rows that actually differ.
  "recommended-flag", "why-this-note", "eliminate-option", "shortlist-tray", "difference-only",
  "compatibility-note", "requirement-check",
  // Data quality and import. Where a value came from, how sure we are, and which rows did not make it.
  "duplicate-warning", "merge-records", "confidence-note", "source-attribution", "last-verified",
  "sample-preview", "row-error-list", "fix-suggestion", "skip-row-note",
  // Accessibility, deeper. The controls that make a page usable when the defaults are not enough.
  "reduced-motion-note", "contrast-toggle", "focus-visible-note", "landmark-nav", "announce-region",
  "text-only-toggle", "pause-motion",
  // Print and export mechanics. What leaves the system, on paper or as a file.
  "export-scope", "page-header-footer", "print-range", "export-history", "share-as-link",
  "embed-snippet", "qr-handoff",
  // ai-suggestion ai-explain ai-confidence ai-sources ai-regenerate ai-edit-diff ai-disclosure prompt-field ai-feedback ai-limit-note draft-with-ai ai-scope-picker ai-undo model-note generation-history ai-error-note cursor-label editing-lock annotation-pin resolve-toggle who-is-here

  // AI assistance surfaces
  "ai-suggestion", "ai-explain", "ai-confidence", "ai-sources", "ai-regenerate",
  "ai-edit-diff", "ai-disclosure", "prompt-field", "ai-feedback", "ai-limit-note",
  "draft-with-ai", "ai-scope-picker", "ai-undo", "model-note", "generation-history",
  "ai-error-note",
  // Presence and collaboration
  "cursor-label", "editing-lock", "annotation-pin", "resolve-toggle", "who-is-here",
  // Approvals and sign-off
  "approval-request", "sign-off-row", "approver-list", "reject-reason", "delegate-approval",
  "approval-deadline", "countersign", "approval-history", "approval-quorum", "recall-request",
  // Templates and reuse
  "template-picker", "save-as-template", "template-variables", "template-preview", "duplicate-options",
  "preset-menu", "default-set", "apply-to-many", "template-diff", "starter-gallery",
  // Tagging and taxonomy
  "tag-cloud", "category-tree", "taxonomy-picker", "label-manager", "tag-merge",
  "suggested-tags", "tag-rename", "tag-scope", "untagged-note",
  // Pagination and loading
  "infinite-sentinel", "page-size", "jump-to-page", "partial-list-note", "lazy-section",
  "list-end", "loading-more",
  // Filters, deeper
  "filter-group", "exclude-filter", "filter-count", "clear-filters", "filter-summary",
  "numeric-filter", "boolean-filter", "multi-select-filter", "filter-drawer", "quick-filters",
  "filter-conflict",
  // Place, without a provider
  "radius-input", "distance-note", "directions-link", "opening-status", "travel-time-note",
  "nearby-list", "region-picker", "location-consent", "service-area-note", "catchment-note",
  // Consent and privacy
  "consent-summary", "data-request", "retention-note", "purpose-list", "opt-out-row",
  "privacy-choice", "tracking-note", "export-my-data", "delete-my-data", "consent-history",
  "third-party-list", "lawful-basis-note",
  // Device and capability
  "orientation-note", "small-screen-note", "install-prompt", "camera-access", "location-access",
  "notification-access", "data-saver-note", "touch-hint", "clipboard-blocked", "fullscreen-toggle",
  "device-unsupported", "permission-prompt",
  // Automation and rules
  "rule-summary", "trigger-picker", "condition-row", "rule-preview", "rule-conflict",
  "rule-log", "rule-enabled", "run-now",
  // Wizards and multi-step
  "wizard-nav", "step-summary", "review-step", "save-and-exit", "resume-later",
  "step-validation", "branch-preview", "step-skipped", "wizard-exit-guard",
  // Number presentation
  "compact-number", "range-text", "approx-note", "significant-figures", "number-scale-note",
  // Identity and credentials
  "id-check-status", "trust-level", "badge-explainer", "credential-row", "credential-expiry",
  "identity-summary", "proof-upload", "verification-steps",
  // Feedback and rating mechanics
  "emoji-scale", "survey-progress", "free-text-followup", "response-rate", "rating-guidance",
  "rating-changed",
  // Stock and allocation mechanics
  "allocation-bar", "reserved-note", "lot-row", "expiry-batch", "reorder-point",
  "stock-move", "shrinkage-note", "count-sheet",
  // Comments and annotation mechanics
  "unresolved-count", "comment-draft", "reaction-summary", "thread-participants", "comment-permalink",
  // Capacity and queueing
  "slot-capacity", "overbooking-note", "staff-load", "utilisation-bar", "peak-note",
  "no-show-note", "walk-in-note",
  // Contact and address mechanics
  "contact-method-picker", "preferred-contact", "contact-verify", "do-not-contact", "alternate-contact",
  "address-validate", "delivery-note-field", "contact-card-compact",
  // Attachments and evidence
  "evidence-list", "photo-required-note", "capture-hint", "attachment-limit", "file-required",
  "before-after-upload", "annotation-upload", "receipt-upload",
  // Handover and shift work
  "handoff-summary", "shift-handover", "escalate-action", "priority-picker", "due-soon-note",
  "read-receipt", "batch-window", "confidence-bar", "language-fallback", "cost-estimate-note",
  "coverage-gap", "on-call-now",
  // Integrations and connectors
  "connector-card", "connection-health", "oauth-consent-summary", "reauth-prompt", "field-mapping",
  "sync-direction", "sync-schedule", "integration-log", "disconnect-warning", "credential-rotate",
  "provider-status", "mapping-conflict", "test-connection",
  // Webhooks and events
  "webhook-endpoint", "event-subscription", "delivery-attempt", "payload-preview", "signature-secret",
  "replay-event", "event-filter", "dead-letter", "delivery-rate", "webhook-test",
  "idempotency-note", "retry-policy",
  // Quotas, limits and metering
  "usage-breakdown", "overage-preview", "limit-reached", "plan-limit-row", "burst-note",
  "usage-forecast", "seat-usage-row", "hard-limit-warning", "usage-alert-rule",
  // Multi-tenancy and white-label
  "tenant-badge", "brand-upload", "custom-domain", "domain-verify", "subdomain-field",
  "tenant-limits", "workspace-invite", "cross-workspace-note", "tenant-delete",
  // Internationalisation, deeper
  "locale-picker", "translation-status", "missing-translation", "pluralisation-preview", "rtl-toggle",
  "date-format-preview", "number-format-preview", "measurement-system", "translator-note", "locale-fallback-chain",
  "string-context",
  // Theming and customisation
  "palette-preview", "font-preview", "spacing-preview", "logo-slot", "theme-reset",
  "custom-css-note", "preview-frame", "brand-check", "theme-export",
  // Tax and compliance surfaces
  "tax-breakdown", "tax-exempt-note", "reverse-charge-note", "jurisdiction-picker", "compliance-checklist",
  "regulation-note", "certification-row", "expiry-audit", "policy-version", "attestation-box",
  "record-keeping-note", "disclosure-block", "withholding-note",
  // Versioning and releases
  "version-badge", "changelog-feed", "upgrade-prompt", "deprecation-note", "breaking-change-note",
  "migration-guide-link", "version-picker", "rollout-progress", "canary-note", "pin-version",
  "release-freeze",
  // Backup, restore and migration
  "backup-list", "backup-schedule", "restore-preview", "restore-confirm", "migration-progress",
  "dry-run-result", "cutover-note", "legacy-note", "data-residency",
  // Performance and diagnostics
  "latency-note", "cache-status", "health-check-row", "uptime-strip", "status-page-link",
  "diagnostic-bundle",
  // Analytics instrumentation
  "event-name-field", "property-schema", "tracking-plan-row", "consent-gated-note", "sample-rate",
  "funnel-step-row", "cohort-picker", "attribution-note", "goal-definition",
  // Voice, gesture and scanning
  "voice-transcript", "push-to-talk", "swipe-hint", "pinch-hint", "scan-overlay",
  "scan-result", "nfc-prompt",
  // Email and embed rendering
  "email-preview", "plain-text-fallback", "inbox-preview", "unsubscribe-footer", "email-safe-note",
  "embed-size", "embed-permissions", "iframe-fallback", "widget-key", "embed-preview",
  // Construction and site work
  "site-diary", "snag-item", "snag-list", "drawing-revision", "permit-row",
  "plant-hire-row", "toolbox-talk", "site-induction", "weather-delay", "variation-order",
  "retention-line", "handover-pack", "hoarding-notice",
  // Agriculture and growing
  "land-parcel", "crop-stage", "sowing-window", "harvest-window", "yield-note",
  "spray-record", "livestock-row", "herd-count", "grazing-plan", "soil-note",
  "irrigation-note", "traceability-code",
  // Logistics and freight
  "consignment-row", "leg-list", "freight-quote", "load-plan", "pallet-count",
  "customs-note", "incoterm-note", "hazard-class", "temperature-log", "proof-of-collection",
  "driver-assignment", "vehicle-check", "route-stop", "dwell-time", "demurrage-note",
  "axle-weight",
  // Warehousing and inventory ops
  "bin-location", "putaway-task", "pick-path", "cycle-count-row", "goods-in-row",
  "quarantine-note", "serial-capture", "batch-trace", "stock-adjustment", "replenish-task",
  "shrink-report", "slotting-note",
  // Manufacturing and production
  "work-order-row", "bill-of-materials", "routing-step", "machine-status", "downtime-note",
  "scrap-rate", "changeover-note", "takt-note", "quality-check-row", "nonconformance",
  "batch-yield", "shift-output", "tooling-row",
  // Energy and utilities
  "meter-reading", "tariff-row", "consumption-bar", "outage-notice", "supply-status",
  "smart-meter-note", "carbon-note", "generation-mix", "switch-supplier", "estimated-vs-actual",
  "usage-compare",
  // Civic and public services
  "case-reference", "eligibility-check", "application-status", "document-checklist", "appointment-offer",
  "service-standard", "appeal-route", "accessibility-statement", "translation-request", "representative-note",
  "public-notice", "consultation-response",
  // Libraries and archives
  "catalogue-record", "shelf-mark", "loan-row", "hold-queue", "renewal-note",
  "reading-room-booking", "finding-aid", "provenance-note", "access-restriction", "digitisation-status",
  "accession-number",
  // Museums and cultural venues
  "object-label", "exhibition-row", "gallery-plan", "audio-stop", "conservation-note",
  "loan-agreement", "acquisition-note", "timed-entry", "donor-credit",
  // Research and laboratories
  "sample-row", "protocol-step", "reagent-row", "instrument-booking", "calibration-note",
  "chain-of-custody", "result-flag", "reference-range", "study-arm", "participant-row",
  "ethics-approval", "data-dictionary", "replicate-group", "assay-plate", "freezer-location",
  // Recruitment and job boards
  "vacancy-card", "applicant-row", "pipeline-stage", "screening-question", "cv-preview",
  "interview-slot", "scorecard-row", "offer-summary", "reference-request", "salary-range-note",
  "anonymised-toggle", "talent-pool", "rejection-note", "vacancy-closing",
  // Insurance and claims
  "policy-summary-row", "cover-level", "excess-note", "claim-row", "claim-timeline",
  "incident-report", "assessor-visit", "settlement-offer", "renewal-quote", "exclusion-list",
  "beneficiary-row", "premium-breakdown",
  // Accounting and bookkeeping
  "ledger-row", "reconciliation-row", "unmatched-note", "journal-entry", "chart-of-accounts",
  "period-lock", "accrual-note", "depreciation-row", "trial-balance-row", "aged-balance",
  "write-off-note", "nominal-code", "bank-feed-row",
  // Security and access control
  "door-event", "badge-row", "visitor-sign-in", "escort-note", "zone-permission",
  "alarm-state", "patrol-log", "key-issue",
  // Sports leagues and fixtures
  "fixture-row", "league-table-row", "score-entry", "squad-list", "substitution-row",
  "card-record", "fixture-postponed", "cup-bracket", "player-stat-row", "season-picker",
  "venue-allocation", "referee-assignment",
  // Music and recording
  "track-row", "setlist-row", "stem-list", "take-row", "royalty-split",
  "release-schedule", "isrc-field", "rehearsal-slot", "stage-plot",
  // Film and production
  "call-sheet", "scene-row", "shot-list-row", "location-release", "crew-role-row",
  "day-out-of-days", "continuity-note", "dailies-row", "rushes-note", "wrap-report",
  // Membership clubs and societies
  "membership-tier-row", "renewal-reminder", "committee-list", "agm-notice", "motion-vote",
  "minutes-entry", "subscription-arrears", "guest-sign-in", "club-fixture",
  // Volunteering and community
  "shift-signup", "volunteer-row", "hours-log", "induction-status", "role-description",
  "impact-note", "thank-you-note", "rota-gap",
  // Waste and recycling
  "collection-day", "bin-type", "contamination-note", "weighbridge-row", "recycling-rate",
  "missed-collection",
  // Maritime and aviation
  "berth-row", "tide-note", "flight-leg", "manifest-row", "crew-roster-row",
  "fuel-log", "maintenance-due", "notam-note", "cargo-hold",
  // Franchises and multi-site
  "site-picker", "site-compare-row", "rollout-status", "local-override", "brand-standard-check",
  "franchise-fee-row", "group-report", "site-league-table", "central-message",
  // Two-sided matching
  "match-score", "mutual-interest", "shortlist-both", "availability-overlap", "intro-request",
  "match-reason", "decline-politely", "rematch-note", "match-expiry", "preference-weights",
  // Gaming and esports
  "match-lobby", "ladder-row", "loadout-row", "achievement-row", "party-invite",
  "queue-timer", "spectator-count",
  // Auctions and bidding
  "lot-card", "reserve-note", "proxy-bid", "buyers-premium", "auction-timer",
  "withdrawn-lot", "hammer-price", "condition-report", "absentee-bid",
  // Publishing and print production
  "issue-row", "page-plan", "proof-status", "print-run", "distribution-list",
  "embargo-time", "byline-row",
  // Pharmacy and dispensing
  "prescription-row", "dispense-label", "stock-substitute", "controlled-drug-note", "repeat-request",
  "interaction-warning", "dosage-field", "pharmacist-check", "ready-to-collect", "patient-leaflet",
  // Care and social support
  "care-plan-row", "visit-log", "medication-round", "next-of-kin", "risk-assessment-row",
  "consent-to-care", "care-hours", "safeguarding-note", "review-due", "keyworker-row",
  // Estate agency and sales
  "offer-row", "chain-status", "valuation-note", "listing-status", "vendor-note",
  "buyer-position", "completion-date", "key-release", "asking-price-change",
  // Lending and mortgages
  "affordability-note", "repayment-preview", "rate-type", "term-slider", "deposit-percent",
  "offer-expiry", "arrears-note", "overpayment-allowance", "redemption-note", "broker-note",
  // Telecoms and connectivity
  "line-status", "bundle-row", "data-allowance", "roaming-note", "coverage-note",
  "sim-row", "port-request", "contract-end", "add-on-row", "fair-use-note",
  // Coworking and space booking
  "room-booking-row", "access-hours", "day-pass", "occupancy-note", "amenity-list",
  "booking-credits", "floor-picker", "locker-row", "visitor-pass",
  // Equipment and hire
  "asset-row", "hire-period", "condition-check", "deposit-hold", "return-due",
  "damage-charge", "serial-row", "service-history", "off-hire-note",
  // Food and drink production
  "recipe-scale", "allergen-matrix", "best-before", "production-run", "tasting-note",
  "cellar-row", "abv-note", "label-approval", "batch-code", "shelf-life-note",
  // Emergency and incident response
  "incident-severity", "responder-list", "muster-list", "all-clear", "resource-status",
  "scene-note", "triage-row", "comms-log", "stand-down",
  // Health records, deeper
  "triage-outcome", "referral-row", "waiting-list-note", "consent-to-share", "care-summary",
  "allergy-row", "immunisation-row", "observation-row", "discharge-note",
  // Written for the family reference pages, kept alphabetical so a new one has
  // one obvious place to go.
  "arrangement-steps", "availability-calendar", "capacity-table", "date-enquiry",
  "device-picker", "donation-tiers", "exhibition-card", "fee-table", "fixture-list",
  "frequency-picker", "impact-stat", "league-table", "lineup-grid", "practitioner-card",
  "admission-prices", "counter-services", "direct-saving", "entry-requirements",
  "facility-status", "fare-quote", "house-rules", "inspection-rating",
  "investment-table", "livery-packages", "meeting-papers", "membership-grades",
  "pitch-types", "produce-calendar", "quote-calculator",
  "quote-request", "rate-card", "repair-status", "seller-card", "service-times",
  "session-table", "size-guide", "story-lead", "subject-list", "symptom-row",
  "tap-list", "tenancy-costs", "territory-list", "trade-terms", "triage-banner",
  "unit-card", "vehicle-lookup",
  // Added 2026-08-03 with the second thirty-five families. `service-availability`
  // is the answer a utility or collection service exists to give and prints the
  // address it is about; `priority-debts` is the ordering that IS free debt
  // advice — which creditor can take your home, ahead of whichever one is
  // ringing you.
  // `interest-rates` because the two "rate" components already here are a hire
  // rate card and a LIBRARY loan row — a lender had nothing, and the conditions
  // attached to a savings rate are the product rather than a footnote.
  "interest-rates", "priority-debts", "service-availability",
  // `trading-diary` for a mobile trader: today marked, because where the van is
  // NOW is the one perishable fact, and a cancelled pitch stays on the list.
  "trading-diary",
  // `term-dates` because the closure days ARE the content: a term stated as one
  // range hides the INSET days and half-term inside it, which is exactly what a
  // working parent has to arrange childcare around.
  // `repair-job` because `repair-status` is a device on a bench — its stages end
  // at "ready to collect". A home repair is attended, not collected, and the
  // fact a tenant needs is the appointment window and whether the promised date
  // has already gone.
  "term-dates", "repair-job",
  // `departure-board` because for a bus, a ferry or a park-and-ride the
  // timetable IS the product. An expected TIME beats the word "delayed" — one
  // lets somebody go and buy a coffee, the other makes them stand there — and a
  // cancelled service stays on the board rather than vanishing.
  "departure-board",
  // `rate-board` because a bureau's whole product is a board, and the only
  // number on it that matters is the one nobody prints: the SPREAD. Every
  // bureau advertises "0% commission", which is true and is not the price —
  // the charge is the gap between the two rates. It is derived here rather
  // than passed, so it cannot drift from the rates beside it, and `setAt` is
  // required because a rate with no timestamp is a claim.
  "rate-board",
  // `waiting-list-place` because THREE components say "waiting" and they answer
  // different questions. `queue-position` is minutes deep; `waiting-list-note`
  // is a CLINICAL list and refuses to print a rank, correctly, since people are
  // added ahead on urgency; this is an ORDERED list months or years deep where
  // you join the bottom and only move up, and on that kind hiding the position
  // is the dishonest choice. Caught live: the clinical one was used on an
  // allotment page and its own footnote contradicted the headline above it.
  "waiting-list-place",
];

// THE COMPONENTS THE MODEL IS SHOWN — the most-used slice of the 2,058.
//
// DERIVED FROM WHAT ASKS FOR THEM, not hand-picked and not "the first N". The 26
// layout families each declare the components their pages need (`store` names
// cart-line, place-order-bar, payment-picker…), and the rules themselves cite
// more by name. That union IS the most-used set, and it updates itself when a
// family is added — a hand-written 100 would drift from the families the day one
// changed, and nothing would say so.
//
// WHY NOT 100, WHICH IS WHAT WAS ASKED FOR: the families alone declare 157. A
// list of 100 would omit 57 components a family says its pages need, which
// breaks the layout wiring rather than trimming a prompt.
//
// WHAT THIS COSTS, stated plainly because it is the same failure this repo keeps
// having: the model can only import a name it has been given, so the components
// left off are ones no generated page will use. The saving is ~786 tokens a
// build — PAGE_RULES is cached, so only about a tenth of the full list's 8,150
// was ever being paid. That is the smallest of the prompt savings available and
// the only one that costs reach; it is here because the owner asked for it.
// `UI_COMPONENTS` stays whole — it is the LINT's allow-list and the drift guard
// against what is on disk, so a page importing any real component still passes.
// EVERY SHORTLISTED COMPONENT WITH ITS SIGNATURE.
//
// The model was given 282 NAMES and no props, and guessing them is the single
// largest cause of a refused page. Measured 2026-08-04, one CRM sample: a `badge`
// prop that does not exist, a `subtitle` that is called `description`, an `id` on
// a row type that has none, and `"error"` for a state whose values are
// success/warning/danger/neutral/quiet. Four errors, one root cause, whole site a
// placeholder.
//
// ~9,000 tokens, and they ride in the CACHED system block — measured at
// `cacheRead 27,716` on a real build, so this is a cache read at 0.1x, roughly
// $0.003 on a build that costs $0.22. The reason it was not affordable before was
// the assumption it would be fresh input on every build. It is not.
//
// Names alone stay in rule 3; this is the reference the model checks a call
// against, which is why it is a separate block rather than a longer rule.
/**
 * Which kit module exports this JSX tag, or null.
 *
 * Derived from `UI_EXPORTS`, which is itself derived from `COMPONENT_API` — so a
 * tag resolves exactly when the prompt claims that component exists. A name
 * exported by two modules resolves to NEITHER: guessing which one a page meant
 * is how a lint invents a complaint about a correct call.
 */
export function uiModuleFor(tag) {
  const hits = [];
  for (const [mod, names] of Object.entries(UI_EXPORTS)) if (names.has(tag)) hits.push(mod);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * The PROP NAMES each documented component accepts, derived from its signature.
 *
 * The failure this exists for is the one the eval actually records: not a
 * component the model could not see, but a prop invented on one it could.
 * `render` on `Column`, `onClick` on a bulk action, `title` on an `Activity`,
 * `activityFeedPlaceholder` out of `activity-feed` — every recorded compile
 * failure was on a component whose signature was in the prompt.
 *
 * SPLIT ON DEPTH, never on a bare comma. A signature carries object props
 * (`action?: { label: string; href?: string }`), generics and function types,
 * all full of commas and colons that are NOT top-level props — and a regex
 * written for the flat case is a mistake this codebase has now made three
 * separate times (the chart lib's missing semicolons, `Column<T>`, `DataTable<T>`).
 *
 * Returns null for a component with no signature, so the lint can SKIP it rather
 * than guess: a false alarm teaches the model away from a component that is
 * perfectly real, which is worse than the miss.
 */
export function propsOf(component, tag) {
  const sig = COMPONENT_API[component];
  // A TRUNCATED SIGNATURE CANNOT ANSWER "IS THIS PROP REAL". `gen-component-api`
  // elides a long nested type with `…`, which leaves an unbalanced brace — the
  // splitter never returns to depth 0 and every prop after it disappears. That
  // is a list of props that LOOKS complete and is not, which turns a correct
  // call into a complaint. Skipping is the only safe answer, and it is the same
  // rule the import check uses for a module with no known exports.
  if (typeof sig === "string" && sig.includes("\u2026")) return null;
  if (!sig) return null;
  // THE SIGNATURE MUST BE FOR THIS TAG. A module can export several components —
  // `testimonial.tsx` has `Testimonial` and `TestimonialGrid` — and COMPONENT_API
  // documents ONE of them. Reading the wrong one reported `TestimonialGrid` as
  // taking `item`, which is the other component's prop, on a page that was right.
  if (tag && !new RegExp("^" + tag + "\\s*\\(").test(sig)) return null;
  const open = sig.indexOf("(");
  if (open < 0) return null;
  // The matching close paren, not the first one — a function-typed prop has its own.
  let depth = 0, close = -1;
  for (let i = open; i < sig.length; i++) {
    const c = sig[i];
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) return null;
  // THROUGH THE SHARED SPLITTER, not a second copy of it. This function had its
  // own inline loop, written before `splitTop` was extracted — so the `=>` fix
  // reached one and not the other, and every prop after a function-typed one was
  // invisible. `ContactForm(onSubmit: (v: {…}) => void, busy?, …)` came back as
  // just `onSubmit`, which turned four correct props into a lint complaint.
  // Measured: 121 of 328 known-good pages flagged. Two copies of one rule, in
  // the same change that extracted the helper to avoid exactly that.
  const parts = splitTop(sig.slice(open + 1, close), ",");
  const names = [];
  for (const raw of parts) {
    const m = raw.trim().match(/^([A-Za-z_$][\w$]*)\??\s*:/);
    if (m) names.push(m[1]);
  }
  return names.length ? names : null;
}

/**
 * The element's OWN attributes — `[name, indexOfValue]` — never a nested one's.
 *
 * A prop can hold a whole element: `media={<SafeImage src={null} …/>}`. Reading
 * the attribute text flat pulled `src`, `alt` and `ratio` out of the INNER
 * component and reported them against the outer one, on pages that were right.
 * So names are taken at brace depth 0 only.
 */
function ownAttrs(attrs) {
  const out = [];
  let d = 0;
  for (let i = 0; i < attrs.length; i++) {
    const c = attrs[i];
    if ("{([".includes(c)) { d++; continue; }
    if ("})]".includes(c)) { d = Math.max(0, d - 1); continue; }
    if (d !== 0) continue;
    const m = /^([a-zA-Z][\w-]*)\s*=/.exec(attrs.slice(i));
    if (!m || (i > 0 && /[\w-]/.test(attrs[i - 1]))) continue;
    let v = i + m[0].length;
    while (v < attrs.length && /\s/.test(attrs[v])) v++;
    out.push([m[1], v]);
    i = v - 1;
  }
  return out;
}

/**
 * Blank every string literal, keeping the length.
 *
 * A page is full of prose, and prose contains angle brackets, colons and commas.
 * Without this the element scanner read `<CodeBlock code={\`<Table invoices={x}/>\`}>`
 * as an element called Table, and a `Faq` answer containing ", so:" as a field
 * called `so` — 24 complaints about pages that were right.
 *
 * LENGTH-PRESERVING, never removing, because every index computed here is used
 * against the real text. That is written down in this repo as the rule for
 * comment stripping and it holds identically for strings.
 *
 * A template's `${…}` is blanked WITH it. That can hide a real element inside an
 * interpolation, which is a miss rather than a false alarm — the safe direction
 * for a lint whose whole viability is not crying wolf.
 */
function blankStrings(code) {
  const out = code.split("");
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === "\\") { j += 2; continue; }
        if (code[j] === quote) break;
        j++;
      }
      for (let k = i + 1; k < Math.min(j, code.length); k++) if (out[k] !== "\n") out[k] = " ";
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

/**
 * Every `<Component …>` in a page, with its attribute text.
 *
 * Depth-aware because a prop can hold anything: an arrow function's `=>`, a
 * generic, a nested object. Yields `[full, tag, attrs]` so it drops into the
 * same shape the regex it replaced produced.
 */
function* jsxElements(real) {
  // SCANNED ON THE BLANKED VIEW, SLICED FROM THE REAL ONE — the indices are the
  // same by construction, which is the entire reason the blanker preserves
  // length. Attributes are yielded blanked too: the lint reads key NAMES, and a
  // key never lives inside a string.
  const code = blankStrings(real);
  const open = /<([A-Z][A-Za-z0-9]*)[\s/>]/g;
  let m;
  while ((m = open.exec(code))) {
    let i = m.index + 1 + m[1].length, d = 0, end = -1;
    for (; i < code.length; i++) {
      const c = code[i];
      if ("{([".includes(c)) d++;
      else if ("})]".includes(c)) d = Math.max(0, d - 1);
      // `code[i - 1] !== "="` IS BELT-AND-BRACES TOO, and measured as such: a
      // mutation removing it survives, because every JSX expression lives inside
      // `{}`, so an arrow is never at depth 0 and `d === 0` already excludes it.
      // It only earns its keep once the depth is WRONG — an unmatched `}` in a
      // JSX comment clamps d to 0 mid-element, and then the arrow really would
      // end the element early. Kept for that, and because deleting it is one
      // simplification away from restoring the truncation bug described above.
      else if (c === ">" && d === 0 && code[i - 1] !== "=") { end = i; break; }
    }
    if (end < 0) continue;
    yield [code.slice(m.index, end + 1), m[1], code.slice(m.index + 1 + m[1].length, end).replace(/\/$/, "")];
    open.lastIndex = end;
  }
}

/**
 * Split a bracketed list on its TOP-LEVEL separator, ignoring nested ones.
 *
 * Shared by the prop reader and the shape reader because both are defeated by
 * the same thing: a signature and a type body are both full of commas, colons
 * and semicolons that belong to something nested. This codebase has written a
 * flat splitter three times and been wrong three times.
 */
function splitTop(src, sep) {
  const out = [];
  const str = String(src);
  let buf = "", d = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    // `=>` IS NOT A CLOSING BRACKET. `cell?: (row: T) => React.ReactNode` drove
    // the depth negative, so every field after a function-typed one was lost —
    // and a field the reader cannot see is a FALSE ALARM on correct code, which
    // is the one thing this lint must never produce. Found by reading the output
    // rather than by a test: `Column` came back missing `numeric` and `width`.
    if (c === ">" && str[i - 1] === "=") { buf += c; continue; }
    if ("([{<".includes(c)) d++;
    else if (")]}>".includes(c)) d = Math.max(0, d - 1);
    if (c === sep && d === 0) { out.push(buf); buf = ""; continue; }
    buf += c;
  }
  out.push(buf);
  return out;
}

/**
 * The bodies of the TOP-LEVEL object literals in a prop value.
 *
 * Depth-tracked, because an item can hold objects of its own and their keys are
 * not the item's keys — reading the innermost braces reported `capacities: {
 * Standing: 120 }` as an item with a field called `Standing`.
 */
function topObjects(value) {
  const out = [];
  let d = 0, start = -1;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "{") { if (d === 0) start = i; d++; }
    else if (c === "}") { d--; if (d === 0 && start >= 0) { out.push(value.slice(start + 1, i)); start = -1; } }
  }
  return out;
}

/**
 * The FIELD NAMES of the object a prop expects, when the signature names a type
 * the component also documents.
 *
 * THIS is the shape the eval actually records — not a wrong JSX attribute, but a
 * wrong key inside an object literal handed to one: `{ src, alt, fallbackSeed }`
 * against `Shot`, `{ key, header, render }` against `Column`, `{ who, what,
 * title }` against `Activity`. Measured on the real failing pages: 20 of one and
 * 7 of another in the recorded history.
 *
 * Returns null unless the type is documented on THAT component — two components
 * export a type called `Activity` with different shapes, so a name alone cannot
 * resolve it, which is the same reason `UI_SHORTLIST_API` prints only cited types.
 */
export function shapeOf(component, prop, tag) {
  const sig = COMPONENT_API[component];
  // A TRUNCATED SIGNATURE CANNOT ANSWER "IS THIS PROP REAL". `gen-component-api`
  // elides a long nested type with `…`, which leaves an unbalanced brace — the
  // splitter never returns to depth 0 and every prop after it disappears. That
  // is a list of props that LOOKS complete and is not, which turns a correct
  // call into a complaint. Skipping is the only safe answer, and it is the same
  // rule the import check uses for a module with no known exports.
  if (typeof sig === "string" && sig.includes("\u2026")) return null;
  const types = COMPONENT_TYPES[component];
  if (!sig || !types) return null;
  if (tag && !new RegExp("^" + tag + "\\s*\\(").test(sig)) return null;
  const open = sig.indexOf("(");
  if (open < 0) return null;
  for (const part of splitTop(sig.slice(open + 1, sig.lastIndexOf(")")), ",")) {
    const m = part.trim().match(/^([A-Za-z_$][\w$]*)\??\s*:\s*([A-Za-z_$][\w$]*)(?:<[^>]*>)?(\[\])?/);
    if (!m || m[1] !== prop) continue;
    const body = types[m[2]];
    if (!body) return null;
    const fields = [];
    for (const f of splitTop(body.replace(/^\{|\}$/g, ""), ";")) {
      const fm = f.trim().match(/^([A-Za-z_$][\w$]*)\??\s*:/);
      if (fm) fields.push(fm[1]);
    }
    return fields.length ? fields : null;
  }
  return null;
}

/**
 * Attributes every component takes regardless of its signature, so the lint
 * cannot flag them. `key`/`ref` are React's own; `className`/`children` the
 * prompt already promises every component in the kit accepts; the rest are
 * standard DOM passthrough.
 */
export const FREE_PROPS = new Set(["key", "ref", "className", "children", "style", "id", "title", "role", "tabIndex"]);

export const UI_SHORTLIST_API = () => {
  const lines = [];
  for (const n of UI_SHORTLIST) {
    const sig = COMPONENT_API[n];
    if (!sig) continue;
    // THE SHAPE A SIGNATURE STOPS AT. `ActivityFeed(items: Activity[], …)` names
    // a type the model cannot see, and it passed `{title, description}[]` where
    // `Activity` is `{who, what, at, avatar?}` — one error, and the only thing
    // between a booking sample and a pass.
    //
    // Taken from THAT COMPONENT'S OWN FILE: two components in this kit export a
    // type called `Activity` and they are different shapes, so a name alone
    // cannot resolve it. Only types the signature actually mentions are printed.
    const own = COMPONENT_TYPES[n] || {};
    const cited = Object.keys(own).filter((t) => new RegExp("\\b" + t + "\\b").test(sig));
    const shapes = cited.map((t) => t + " = " + own[t]).join("; ");
    lines.push("  " + n + " — " + sig + (shapes ? "   where " + shapes : ""));
  }
  return lines.join("\n");
};

export const UI_SHORTLIST = (() => {
  const wanted = new Set();
  for (const fam of Object.values(FAMILIES)) for (const c of fam.components || []) wanted.add(c);
  const real = new Set(UI_COMPONENTS);
  // A family naming a component that does not exist would silently shrink this
  // list; the wiring test asserts that never happens, and this keeps the prompt
  // honest if it ever does.
  return UI_COMPONENTS.filter((c) => wanted.has(c) && real.has(c));
})();


// Imported, not restated. The generator has to predict exactly what the API will
// refuse, and when these rules were written out in both files they drifted — the
// lint claimed a read of a `feed` or `admin` table returns 403, which the API
// does not do. site-access.mjs is dependency-free, so this module stays
// importable without the Worker's node_modules.
export { MANAGED_COLUMNS } from "../site-access.mjs";
import { MANAGED_COLUMNS, canReadAccess, canWriteAccess, whyNotReadable, needsMember, hasPublicView, canMemberWrite, resolveAccess, accessNameFor, accessLabel, readNeedsMember } from "../site-access.mjs";

export const MAX_PAGES = 6;
export const MAX_PAGE_CHARS = 24000;

// A byte-for-byte copy of every file in builder/lovable/template/src/routes/
// that the generator is meant to imitate. Inlined rather than read from disk
// because worker.js bundles this module and a Worker has no filesystem; the
// escaping is generated, never hand-typed. test/page-gen.test.mjs fails if any
// of them diverges from the file it was copied from.
//
// FOUR PAGES, NOT ONE, and the reason is what the single page could not show.
// Measured against the rules that cite them: `usePublicRows` had 8 mentions and
// 0 demonstrations, `useMember` 10 and 0, the claim hooks 1 each and 0, and all
// 11 motion effects were named and none shown. A rule the model is told but
// never shown is a rule it satisfies by inventing a shape, and the invented
// shape is what burns the single repair pass.
//
// They ride in the SYSTEM block, which carries `cache_control: ephemeral`, so
// the extra length is a cache READ on every build after the first rather than
// fresh input. That is also why they are a constant set and not selected per
// build: varying the block by schema would break the cache on every build and
// cost far more than the pages it saved.
export const REFERENCE_PAGES = [
  {
    path: "index.tsx",
    blurb: "THE HOME PAGE — the trade's own layout: menu-style prices, the barbers, the work, find-us.",
    source: `// Reference page — THE HOME PAGE, laid out the way the TRADE lays one out.
//
// A generated site is not a generic landing page wearing a business's name. A
// barber shop has conventions, and following them is most of what reads as
// "somebody who knows this trade made this":
//
//   - The PRICE LIST IS A MENU — rows with the price on the right — never a
//     grid of product cards. \`PriceList\`'s own comment calls it the most common
//     shape on a site this platform builds.
//   - PEOPLE BOOK A BARBER, not a shop, so the team gets a section. The
//     pictures are the owner's to add later; \`TeamGrid\` guards them.
//   - The GALLERY is the work. It is the shop's portfolio, not decoration.
//   - HOURS, ADDRESS AND PHONE LIVE TOGETHER in one "Find us" section, because
//     they answer one question. Hours floating alone answer half of it.
//
// AND THE BUTTONS SIT WHERE THE DECISION HAPPENS. "Book" is in the header on
// every page, in the hero, on EVERY ROW of the price list, and once more at the
// bottom. The per-row button carries its service into the form —
// \`/book?service=Skin fade\` — so the form opens half-filled. "Call" is beside
// "Book" in the hero as a real tel: link, because for a barber shop the phone
// IS a booking channel.
//
// The rhythm is BANDS: full-bleed hero, then sections alternating between the
// page colour and \`bg-muted\`, each with its own inner container. A page where
// every section is \`mt-14\` inside one narrow column reads as a document.
//
// THE PAGES ARE WIRED TOGETHER — owner's call. One chrome navigates between
// them, the price rows carry their service into /book, the form hands back the
// claim link /manage opens, and the member pages sit behind the real session,
// so the site WORKS the day it is generated. What stays written into the page
// is the owner's own facts — hours, the team, the gallery captions — and that
// is a data decision, not a wiring one: those cost no query and cannot render
// empty on a fresh site.
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { Hero } from "@/components/ui/hero";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";

export const Route = createFileRoute("/")({ component: Home });

type Service = Row & {
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
};

// The same facts on every page of the site. Written once per file rather than
// once per return. The phone is a nav link because for this trade it is a
// booking channel, not small print.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Prices", href: "#prices" },
    { label: "The barbers", href: "#barbers" },
    { label: "Find us", href: "#find-us" },
    { label: "0114 270 0000", href: "tel:+441142700000" },
  ],
  action: { label: "Book a chair", href: "/book" },
};

// The shop's own facts. Anything the owner will never edit from a form belongs
// in the page — it costs no query and cannot be empty on a fresh site.
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "09:00", close: "18:00" },
  { day: 3, label: "Wednesday", open: "09:00", close: "18:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "20:00" },
  { day: 5, label: "Friday", open: "09:00", close: "20:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "17:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];

function Home() {
  const services = useRows<Service>("services", { order: "price", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <Hero
        title="Barbering on Cutler Row since 2014"
        subtitle="Six barbers, no appointment needed on weekdays. Walk in before eleven, or book a chair."
        primary={{ label: "Book a chair", href: "/book" }}
        secondary={{ label: "Call 0114 270 0000", href: "tel:+441142700000" }}
      />

      {/* Reassurance in the trade's own language, not a corporate stats band. */}
      <section className="mx-auto max-w-5xl px-6">
        <TrustStrip
          items={[
            { title: "Walk-ins welcome", description: "Before 11 on weekdays you won't wait long" },
            {
              title: "4.9 on Google",
              description: "Two hundred odd reviews, mostly about the fades",
            },
            { title: "Cash or card", description: "No booking fee, no deposit" },
          ]}
        />
      </section>

      <section id="prices" className="mt-4 border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <SectionHeader
            eyebrow="The price list"
            title="Cuts and shaves"
            description="Every cut finishes with a hot towel. Students £4 off, Tuesday to Thursday."
          />
          {/* A price list is ROWS — name, price on the right, a Book button on
              the row — because that is how the trade writes one. \`PriceList\`
              takes the whole list at once, so the query's states sit around it;
              when a page lays rows out itself, \`DataList\` carries all four
              states instead. */}
          {services.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
          {services.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the price list. Refresh and try again.
            </p>
          )}
          {services.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">Nothing listed yet.</p>
          )}
          {!!services.data?.length && (
            <PriceList
              className="mt-6"
              items={services.data.map((s) => ({
                name: s.name,
                description: s.description,
                price: s.price,
                meta: s.duration_minutes != null ? \`\${s.duration_minutes} min\` : null,
              }))}
              /* THE BUTTON IN THE RIGHT PLACE: the row you are reading is the
                 service you want, so its Book button carries the service into
                 the form. The search param is typed by /book's own
                 validateSearch, so a typo here fails the build. */
              action={{
                label: "Book",
                onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }),
              }}
            />
          )}
        </div>
      </section>

      <section id="barbers" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The barbers"
          title="Pick your chair"
          description="Six of us, two generations. Ask for whoever cut you last — it's on your booking."
        />
        {/* People book a person. Photos are the owner's to add after the build,
            so every one is guarded by the component. */}
        <TeamGrid
          className="mt-8"
          items={[
            { name: "Tommy Vasile", role: "Owner — fades and razor work" },
            { name: "Marcus Obeng", role: "Beards and hot towel shaves" },
            { name: "Ellis Ward", role: "Scissor cuts" },
            { name: "Deniz Aydın", role: "Kids and first cuts" },
          ]}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20 motion-reveal">
          <SectionHeader eyebrow="The work" title="Recent cuts" />
          <Gallery
            className="mt-8"
            columns={3}
            items={[
              { src: null, alt: "Skin fade, front window chair" },
              { src: null, alt: "Beard line-up" },
              { src: null, alt: "Scissor crop" },
              { src: null, alt: "Hot towel shave" },
              { src: null, alt: "The long window on a Saturday" },
              { src: null, alt: "Tommy's chair" },
            ]}
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader eyebrow="Kind words" title="What the chairs say" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial
            item={{
              quote:
                "Been coming since they opened. Never waited more than ten minutes, never had a bad cut.",
              name: "Dan Whitfield",
              role: "Every third Thursday",
            }}
          />
          <Testimonial
            item={{
              quote: "Took my lad for his first proper cut. Deniz had him laughing the whole time.",
              name: "Priya Nair",
              role: "Saturday regular",
            }}
          />
        </div>
      </section>

      {/* Hours, address and phone are ONE question — how do I get there and
          when — so they are one section, with the live answer on top. */}
      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-20 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On the row itself" />
            <OpenNow
              className="mt-6"
              hours={HOURS.filter((h) => h.open && h.close).map((h) => ({
                day: h.day,
                open: h.open!,
                close: h.close!,
              }))}
            />
            <OpeningHours days={HOURS} className="mt-4" />
          </div>
          <LocationCard
            className="self-start"
            name="Cutler Row Barbers"
            address="14 Cutler Row, Sheffield S1 2AY"
            note="Two minutes from the Cathedral tram stop. No parking on the row itself — use Campo Lane."
          />
        </div>
      </section>

      {/* The last thing before the footer is the thing you want them to do. */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <CtaBand
          title="A chair is usually free the same day"
          description="Book in thirty seconds. We'll call to confirm."
          action={{ label: "Book a chair", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
`,
  },
  {
    path: "book.tsx",
    blurb: "THE FORM — validation, taken slots, the claim link back, and ?service= preselect.",
    source: `// Reference page — THE FORM. Everything a \`collect\` table needs: validation
// before a round trip, the four list states behind a Select, the slots somebody
// else has already taken, and a confirmation screen that does not promise the
// customer a link this page cannot obtain.
//
// A \`collect\` table is write-only: no policy lets anyone list it, so a booking
// page CANNOT read the bookings to work out what is free. \`usePublicRows\` reads
// a VIEW the schema published for exactly that — the taken times and nothing
// else. If the schema declares no view for a table, ship the ordinary form; a
// visitor is told about a clash on submit instead of before it.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useRows, useCreateRow, usePublicRows, type Row } from "@/lib/rows";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/book")({
  component: Book,
  // Every Book button on the site carries its service here — the price list's
  // per-row button navigates with \`search: { service: r.name }\` — so the form
  // opens half-filled. Narrowing here is also what TYPES that navigate call.
  // The return type marks the key OPTIONAL (\`service?:\`), not merely
  // possibly-undefined — without that, every <Link to="/book"> in the site is
  // forced to spell out a search object.
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
});

type Service = Row & { name: string; price: number | null };

// The row shape this form writes. It is a TYPE ARGUMENT ONLY — \`useCreateRow\`
// resolves to void, because a \`collect\` table grants no SELECT and asking
// PostgREST to return the inserted row is what made the insert 403.
type Appointment = Row;

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a chair", href: "/book" },
};

const SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

// Mirrors the declared columns. The API rejects anything undeclared anyway, but
// validating here means the visitor is told before a round trip.
const booking = z.object({
  service: z.string().min(1, "Pick a service"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_phone: z.string().min(6, "We need a number to confirm on"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a time"),
  notes: z.string().max(500).optional(),
});

type Booking = z.infer<typeof booking>;

function Book() {
  // A service name that no longer exists simply leaves the Select on its
  // placeholder — a stale link half-fills instead of breaking.
  const { service: preselected } = Route.useSearch();
  const services = useRows<Service>("services", { order: "price", dir: "asc" });
  const create = useCreateRow<Appointment>("appointments");
  // A plain "did it land" flag, not a token. The token could never have arrived
  // — see onSuccess below.
  const [booked, setBooked] = useState(false);

  const form = useForm<Booking>({
    resolver: zodResolver(booking),
    defaultValues: {
      service: preselected ?? "",
      customer_name: "",
      customer_phone: "",
      date: "",
      time: "",
      notes: "",
    },
  });

  // Watched, because which slots are gone depends on the day being asked about.
  const date = form.watch("date");
  // The argument is the TABLE, not the name of a view. A \`publicView\` is a
  // projection the schema declared ON that table, so \`appointments\` is what is
  // asked for and the server returns only the published columns.
  //
  // Those rows carry NEVER an \`id\` — a projection strips it — so they are keyed
  // on a published column. Filters are FLAT: a declared column name is the key,
  // with no \`filter\` wrapper around it.
  const taken = usePublicRows<{ time: string }>("appointments", date ? { date } : undefined);

  const onSubmit = (values: Booking) => {
    create.mutate(values, {
      // The callback parameter is NOT annotated: TanStack's signature is
      // contravariant in four arguments and refuses any hand-written type here.
      // NOTHING COMES BACK, and this page is why that had to be said out loud.
      // It read \`row.claim_token\` off the insert — which needs PostgREST to
      // RETURN the row, which needs SELECT, which a write-only \`collect\` table
      // deliberately does not grant. So the header that fetched the token is
      // what made the INSERT itself 403, and since this file is the reference
      // the generator is derived from, it taught that pattern to every site the
      // builder has produced. Confirmation is the end of the flow; a manage link
      // needs the schema to expose a function that creates AND returns.
      onSuccess: () => {
        toast.success("Booked — we'll call to confirm.");
        form.reset();
        setBooked(true);
      },
      // The API separates the caller's fault from a server fault, so its own
      // message is worth showing instead of a generic failure.
      onError: (e: Error) => toast.error(e.message),
    });
  };

  // THE CONFIRMATION IS THE END OF THE FLOW, and that is a complete site rather
  // than a broken one. Offering a "manage your booking" link here would need a
  // token this page cannot obtain: reading it off the insert is what refused the
  // insert. A site that wants one declares a function that creates AND returns.
  if (booked) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-lg px-6 py-20 text-center motion-enter">
          <h1 className="text-3xl font-semibold tracking-tight">You're booked</h1>
          <p className="mt-3 text-muted-foreground">
            We'll call to confirm within the hour. Need to change it? Give us a ring.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/">Back to the shop</Link>
          </Button>
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Book a chair</h1>
        <p className="mt-2 text-muted-foreground">We'll call to confirm within the hour.</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="service"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Service</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose one" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.data?.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    {/* Taken slots are struck through and unpickable, so a visitor
                      sees 09:30 is gone BEFORE submitting rather than being
                      refused after filling the whole form in. */}
                    <AvailabilityGrid
                      slots={SLOTS}
                      taken={taken.data?.map((t) => t.time) ?? []}
                      value={field.value}
                      onSelect={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Anything else?</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sm:col-span-2">
              {/* Disabled while in flight, or a customer who sees nothing happen
                presses again and books three times. */}
              <Button type="submit" className="motion-press" disabled={create.isPending}>
                {create.isPending ? "Booking…" : "Request appointment"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </SiteChrome>
  );
}
`,
  },
  {
    path: "manage.tsx",
    blurb: "COMING BACK — one row, opened by a claim token off the URL.",
    source: `// Reference page — COMING BACK. The person who filled the form in has no
// account and never will, so a claim token IS their identity: it arrives in the
// confirmation link, it opens exactly one row, and it does nothing else.
//
// Build this page whenever a site takes appointments, orders or reservations —
// anything a customer might need to check, MOVE or cancel. A plain contact form
// does not need one; nobody comes back to look at an enquiry.
//
// CHANGING BEATS CANCELLING, and for a while this page could only cancel. On a
// booking table with \`unique\` or \`noOverlap\`, cancel-and-rebook gives the slot
// up before the new one is secured — so the customer can lose the only
// appointment they had, to move it by an hour. Offer the change when the schema
// declares a function for it.
//
// The token is read off the URL. A wrong token and a row that is not there
// answer IDENTICALLY, which is deliberate: a distinct "bad link" would tell
// somebody guessing which bookings exist.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useClaimedRow, useCancelClaim, useAmendClaim, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/manage")({
  component: Manage,
  // Search params arrive as unknown; narrowing here is what makes the token a
  // string for the rest of the page instead of \`unknown\`.
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
});

type Appointment = Row & {
  service: string;
  date: string;
  time: string;
  status: string | null;
};

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a chair", href: "/book" },
};

function Manage() {
  const { t: claim } = Route.useSearch();
  // The schema declares these three functions; they are named here, not guessed.
  const booking = useClaimedRow<Appointment>("booking_by_claim", claim);
  const cancel = useCancelClaim("cancel_booking_by_claim");
  const amend = useAmendClaim("amend_booking_by_claim");
  const [moving, setMoving] = useState(false);

  const onCancel = () => {
    if (!claim) return;
    cancel.mutate(
      { claim },
      {
        // Idempotent on purpose — a cancel link gets clicked twice, and the second
        // click should read as "already cancelled", never as a broken link.
        onSuccess: () => toast.success("Cancelled. Sorry to miss you."),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const onMove = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!claim) return;
    const form = new FormData(e.currentTarget);
    // The keys are the FUNCTION'S argument names, and the function decides which
    // columns those reach — so this page cannot touch a column the business did
    // not open, and the table's own constraints re-run inside the UPDATE.
    amend.mutate(
      { claim, values: { new_date: String(form.get("date") || ""), new_time: String(form.get("time") || "") } },
      {
        onSuccess: () => { setMoving(false); toast.success("Moved. See you then."); },
        // A slot taken between opening this page and submitting it comes back as
        // the same duplicate error the booking form gets, and says so.
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Your booking</h1>

        {!claim && (
          <p className="mt-4 text-muted-foreground">
            This page needs the link from your confirmation.{" "}
            <Link to="/book" className="underline">
              Book a chair
            </Link>{" "}
            instead.
          </p>
        )}

        {claim && booking.isPending && <Skeleton className="mt-6 h-40 rounded-xl" />}

        {claim && booking.isError && (
          <p className="mt-4 text-sm text-destructive">
            Couldn't load your booking. Refresh and try again.
          </p>
        )}

        {/* A missing row and a wrong token land here together, and say the same
            thing — which is the whole point. */}
        {claim && !booking.isPending && !booking.isError && !booking.data && (
          <p className="mt-4 text-muted-foreground">
            We couldn't find that booking. It may have been cancelled already.
          </p>
        )}

        {booking.data && (
          <Card className="mt-6 motion-enter">
            <CardHeader>
              <CardTitle>{booking.data.service}</CardTitle>
              <CardDescription className="tabular-nums">
                {booking.data.date} at {booking.data.time}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  {booking.data.status === "cancelled" ? "Cancelled" : "Confirmed"}
                </span>
                {booking.data.status !== "cancelled" && (
                  <div className="flex gap-2">
                    {/* CHANGE SITS BEFORE CANCEL, and reads as the ordinary
                        action, because moving an appointment is what somebody
                        opening this link usually wants. Cancel stays
                        destructive and second. */}
                    <Button variant="outline" onClick={() => setMoving((v) => !v)}>
                      {moving ? "Keep it" : "Change time"}
                    </Button>
                    <Button variant="destructive" onClick={onCancel} disabled={cancel.isPending}>
                      {cancel.isPending ? "Cancelling…" : "Cancel booking"}
                    </Button>
                  </div>
                )}
              </div>

              {moving && booking.data.status !== "cancelled" && (
                /* PRE-FILLED with what they already have, so moving by an hour
                   is one field and not a re-entry of the whole booking. */
                <form onSubmit={onMove} className="flex flex-wrap items-end gap-3 border-t pt-4">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <Input type="date" name="date" defaultValue={booking.data.date} required />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Time</span>
                    <Input type="time" name="time" defaultValue={booking.data.time} required />
                  </label>
                  <Button type="submit" disabled={amend.isPending}>
                    {amend.isPending ? "Moving…" : "Move booking"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SiteChrome>
  );
}
`,
  },
  {
    path: "account.tsx",
    blurb: "MEMBERS — sign in, then read a table scoped to whoever signed in.",
    source: `// Reference page — MEMBERS. A \`user\`, \`feed\` or \`admin\` table is scoped to the
// visitor who is signed in, so reading or writing one WITHOUT a session is a
// 401, and a page that shows an error instead of a sign-in form looks broken
// rather than locked. That is the whole reason this page exists.
//
// One form, two buttons. Sign-up and sign-in take the same shape, so splitting
// them into two pages doubles the code and halves the chance a visitor finds the
// one they need.
//
// ONE ERROR FOR THE WHOLE FORM, never per field. Saying which of the address and
// the password was wrong tells somebody whether that address has an account
// here.
//
// The chrome wraps the page ONCE, with the three states switching inside it. A
// component that returns early into a second copy of the layout is how a header
// ends up on two of a page's three states.
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useLogin,
  useSignup,
  useLogout,
  useRows,
  useCreateRow,
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataList } from "@/components/ui/data-list";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/account")({ component: Account });

type Profile = Row & { nickname: string | null };

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a chair", href: "/book" },
};

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  // 8 is the server's own minimum. Saying so here saves a round trip.
  password: z.string().min(8, "At least 8 characters"),
});

type Credentials = z.infer<typeof credentials>;

function Account() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const logout = useLogout();

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  // The callback's parameter is NOT annotated. TanStack's mutation callback is
  // contravariant in four arguments and refuses any hand-written type for it.
  const submit = (action: typeof login, values: Credentials) => {
    action.mutate(values, {
      onSuccess: (data) => {
        // A second factor answers with \`pending\` and NO token, so "it returned
        // 200" is not the same as "you are signed in".
        if (data && typeof data === "object" && "pending" in data) {
          toast.message("Check your authenticator app to finish signing in.");
          return;
        }
        form.reset();
      },
      onError: () => toast.error("That email and password didn't match."),
    });
  };

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-md px-6 py-16">
        {member.isPending && <p className="text-muted-foreground">Checking your sign-in…</p>}

        {/* Member-scoped reads live BEHIND the sign-in check, never beside it.
            Rendering this at all is the proof there is a session. */}
        {member.data && <SignedIn name={member.data.name} onSignOut={() => logout.mutate()} />}

        {!member.isPending && !member.data && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in, or make an account to keep your details.
            </p>

            <Form {...form}>
              <form
                className="mt-8 grid gap-4"
                onSubmit={form.handleSubmit((v) => submit(login, v))}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3">
                  <Button type="submit" className="motion-press" disabled={login.isPending}>
                    {login.isPending ? "Signing in…" : "Sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={signup.isPending}
                    onClick={form.handleSubmit((v) => submit(signup, v))}
                  >
                    Create an account
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </div>
    </SiteChrome>
  );
}

function SignedIn({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const profiles = useRows<Profile>("profiles");
  const create = useCreateRow("profiles");

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Hello, {name}</h1>
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* \`profiles\` is a \`user\` table, so this read returns THIS member's
              rows and nobody else's — the scoping is the database's job, not a
              filter written here. */}
          <DataList
            query={profiles}
            className="grid gap-2"
            skeleton={1}
            empty={{ title: "Nothing saved yet" }}
            error="Couldn't load your details."
          >
            {(p) => (
              <p key={p.id} className="text-sm">
                {p.nickname}
              </p>
            )}
          </DataList>
          <Button
            className="mt-4"
            disabled={create.isPending}
            onClick={() => create.mutate({ nickname: name })}
          >
            Save my name
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
`,
  },
];

/** The home page alone, which is what most briefs need. */
export const REFERENCE_PAGE = REFERENCE_PAGES[0].source;

export const PAGE_RULES = `You write the pages of a small business website, as TypeScript React route files.

The site's database ALREADY EXISTS. A schema was designed from the same brief and its tables
are live Postgres. You are given exactly what was created. You cannot invent a table, a column
or an access level — anything not in the schema below does not exist.

## Hard rules

1. NO FETCH CODE. Read with \`useRows\`, write with \`useCreateRow\`, both from "@/lib/rows".
   A page that calls fetch, axios or XMLHttpRequest is wrong.
   AND NO CommonJS: every page is an ES module. \`require()\` and \`module.exports\`
   typecheck and bundle, then throw "require is not defined" in the browser and take
   the whole section down with them. Top-level \`import\` only.

2. RESPECT THE ACCESS LEVEL. The API enforces it — this is not a matter of taste.
   - \`display\` — you may LIST and READ it. A write returns 403.
   - \`collect\` — you may SUBMIT a form to it. A read returns 403. These rows are other
     visitors' submissions; never list them, never count them, never show "3 people booked".
   - \`user\` — PRIVATE PER MEMBER. Signed in, they read and write only their OWN rows;
     signed out, both return 401. Build the signed-in view AND a sign-in prompt.
   - \`feed\` — SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in
     member writes rows that become theirs. Signed out, both return 401.
   - \`admin\` — SHARED, READ-ONLY FROM THE SITE. Anyone signed in reads every row, and
     NOBODY writes one from a published page — not a form, not \`useCreateRow\`, not an
     edit, whatever role the member holds. The table is granted SELECT and nothing else,
     so a write is 403 for everyone; the business maintains those rows from its isibi
     dashboard. Build the reading UI and no write UI at all.

3. THE KIT FOR EVERY CONTROL, imported from "@/components/ui/<name>". Never hand-roll a
   button, input, select, checkbox or dialog. Build from these — they are what the
   layouts are made of, and the only names under that path you should use:
   ${UI_SHORTLIST.join(", ")}.

   THE EXPORT NAME IS THE FILE NAME IN PascalCase, EXACTLY — no embellishment.
   \`@/components/ui/faq\` exports \`Faq\`, not \`FaqAccordion\`; \`open-now\` exports
   \`OpenNow\`. That holds for 2,026 of the 2,042 modules, and guessing a longer,
   more descriptive name is a compile error that costs the whole site — measured
   live, it is one of the three commonest failures there are. The exceptions,
   which are the only modules where the name is not deducible:
   ${Object.entries(UI_EXPORTS).filter(([m, n]) => !n.has(m.replace(/(^|-)([a-z0-9])/g, (_, a2, b2) => b2.toUpperCase()))).map(([m, n]) => m + " → " + [...n].join(", ")).join("; ")}.

   THEIR EXACT PROPS — check every call against this rather than guessing. A prop
   that does not exist, or a state value outside the union shown, is a compile error
   and the whole site falls back to its data model. Where a type is a NAME
   (\`Row[]\`, \`Activity[]\`), hand it the rows a hook gave you and do not invent
   fields on it.
   **These are the components whose props are stated. The kit under that path is
   larger, and anything not listed here you would be calling blind — prefer one of
   these, and if you do reach for another, keep the call to \`children\` and
   \`className\`, which every component in the kit accepts.**
${UI_SHORTLIST_API()}

   There is no "toast" or "use-toast" component — toasts come from \`import { toast } from "sonner"\`.
   The kit does not stop here: ${CHART_NAME_COUNT} chart components live under
   "@/components/charts/lib/<domain>" and are listed in full below. They are part of the
   same kit, reached by a different path — so "nothing else exists" above is about that
   path, not about what you may render.

4. FORMS ARE react-hook-form + zod, through shadcn's \`Form\`/\`FormField\`/\`FormControl\`.
   TanStack Form is installed but shadcn's form components do not speak to it — mixing them
   produces inputs that silently do not validate. Never import "@tanstack/react-form".

5. THE ZOD SCHEMA MIRRORS THE DECLARED COLUMNS. The API drops anything undeclared, so a field
   the schema does not have vanishes without an error.

6. NEVER WRITE A MANAGED COLUMN. These are set by the engine and dropped from any write:
   ${MANAGED_COLUMNS.join(", ")}.

7. EVERY PICTURE IS \`<SafeImage>\`, NEVER A BARE \`<img>\`.
   \`SafeImage(src?, alt?, ratio? = "4/3", fallback?, fallbackSeed?)\` draws the picture when
   there is one and this theme's own designed placeholder when there is not, so there is
   nothing to guard and nothing to remember. A bare \`<img src="">\` paints a broken icon.
   - A COLUMN NAMED FOR A PICTURE HOLDS A URL STRING. \`photo\`, \`image_url\`, \`avatar\`,
     \`logo\`, \`cover\`, \`hero_image\` and the like are ordinary text columns holding a path
     like "/u/<slug>/<hash>.jpg". On a \`display\` table the OWNER fills these in after the
     build, so on a new site they are empty — pass one straight through and let the
     component decide: \`<SafeImage src={row.photo} alt={row.name} ratio="4/3" className="..." />\`.
   - A DECORATIVE picture takes \`alt=""\`, HTML's own way of saying so; the placeholder
     then paints a plain panel rather than a captioned tile. Two of them side by side take
     different \`fallbackSeed\` values so they do not come out identical.
   - A REAL PHOTOGRAPH is a \`@@IMG:describe the picture@@\` token in the \`src\`, and how
     many this site may have is stated with the brief below. Write one ONLY in a
     \`SafeImage\` \`src\` and NEVER invent a path under /u/ yourself: a token that cannot be
     bought becomes an empty src, which is the placeholder, while a made-up path is a 404
     on every page that shows it.

8. A FORM MAY LET THE VISITOR ATTACH ONE, but only when its table declares an image
   column. Upload first, then submit the URL as an ordinary text field:

   \`\`\`tsx
   const upload = useUploadFile("bookings");           // from "@/lib/rows"
   // <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" ... />
   const { url } = await upload.mutateAsync(file);
   form.setValue("photo", url);                        // then create the row as normal
   \`\`\`

   The row write is still plain JSON — there is no multipart and no "file field".
   Disable submit while \`upload.isPending\`, and surface \`error.message\` like any other
   write: the API says "that image is too big" or "that doesn't look like a PNG, JPEG,
   WebP or GIF", which is worth showing. **PNG, JPEG, WebP and GIF only — SVG is refused**
   — and the file is capped at 2 MB, so say so next to the control rather than letting
   someone pick a 12 MB photo and be told no afterwards.

9. A BOOKING PAGE SHOWS WHICH SLOTS ARE TAKEN with \`usePublicRows\`. A \`collect\` table
   cannot be read — that is the whole point of it — but if the schema declares a
   \`publicView\` on it, that projection CAN be read by anyone, and it is how a form greys
   out a time somebody already booked. \`usePublicRows("bookings")\` returns only the
   columns the schema chose to publish, never a name or an email.
   **The schema above says, per table, whether this works — do not infer it.** When it says
   NO, build the ordinary form and ship it: the visitor picks a time and the server refuses
   a taken one with a clear message. Greying slots out early is a nicety, and a page that
   fails because it could not have one is far worse than a page without one.
   **These rows have NO \`id\`** — a projection publishes only the columns listed above, and
   \`id\` is refused outright. Type them as \`PublicRow & { … }\`, never \`Row & { … }\`, and key
   the list on a published column or the index.

10. GIVE THE VISITOR THEIR SUBMISSION BACK. A \`collect\` table is write-only — no policy
    lets anybody list it — so the person who booked cannot see their appointment again
    unless the SCHEMA declares a way. When it does, the way is a database function:
    \`useClaimedRow("get_booking", token)\` reads one row by its claim token,
    \`useCancelClaim("cancel_booking")\` cancels it, and \`useAmendClaim("amend_booking")\`
    CHANGES it — \`amend.mutate({ claim, values: { date, time } })\`, where the keys are the
    function's own argument names. All three take the FUNCTION NAME the schema declared, not a table.
    **If the schema declares an amend function, build the change as well as the cancel.**
    Cancelling and rebooking is not the same thing: on a table with \`unique\` or \`noOverlap\`
    it gives the slot up before the new one is secured, and it makes the customer type
    everything in again. Pre-fill the form with the row they already have.
    **Only build the manage page if the schema actually declares those functions** —
    check the digest. If it does not, the confirmation screen is the end of the flow, and
    that is a complete site rather than a broken one.
    **\`useCreateRow\` RESOLVES TO NOTHING — never read the created row off it.** A
    \`collect\` table has no SELECT policy and no SELECT grant, which is the entire point
    of write-only, so asking PostgREST to return the inserted row makes the INSERT itself
    fail with 403. It is typed \`void\`, so \`data.claim_token\` is a compile error rather
    than a form that refuses every customer. To hand somebody a manage link, the SCHEMA
    has to expose a function that creates the row AND returns its token — call that with
    \`useRpcAction\`. If it declares no such function, the confirmation screen is the end
    of the flow and the site is complete. **Never annotate a mutation callback's parameter.**
    Write \`onSuccess: (data) => …\`, not \`onSuccess: (data: Booking) => …\`. TanStack's
    callback takes four arguments and its types are contravariant, so ANY hand-written
    annotation is refused even when it looks right — that was three separate build
    failures. Let it infer.
    Build this whenever the schema declares the functions AND the form is an appointment,
    an order or a reservation — anything somebody would want to check or call off. Not for
    a plain contact form, which nobody comes back to.

11. ANYTHING THE SCHEMA DECLARES AS A FUNCTION, you can call: \`useRpc("fn", args)\` to read
    and \`useRpcAction("fn")\` to act. This is how a site does what a filter cannot — a
    total across tables, the slots left on a day, one row out of a write-only table. Only
    call functions the digest actually lists.

12. A CHART COMES FROM "@/components/charts/lib/<domain>", never from a file named
    \`chart-something\`. The \`charts/chart-*.tsx\` files are DEMOS — each one wraps a
    primitive in a Card around invented numbers ("Bookings 268 / 300 · January - June
    2024"). One imported into a page compiles, bundles and publishes a stranger's made-up
    figures to this site's visitors. Import the primitive and pass it the site's own rows.
    The ${CHART_DOMAIN_COUNT} domain modules and everything they export are listed below.

13. A ROUTE PARAM IS A STRING AND \`row.id\` IS A NUMBER. Everything out of
    \`Route.useParams()\` or \`Route.useSearch()\` is typed \`string\`, so putting an id into a
    link or comparing one needs \`String(...)\` — and a comparison without it is not only a
    type error, it is a lookup that would find nothing:
      <Link to="/records/$id" params={{ id: String(row.id) }}>
      navigate({ to: "/record", search: { id: String(row.id) } })
      const record = rows.find((r) => String(r.id) === id)
    Going the OTHER way needs nothing: every hook that takes an id accepts \`string | number\`,
    so \`useRow(TABLE, id)\` with the string straight off the URL is correct. Do not wrap it
    in \`Number()\`.

14. A CATEGORY IS NOT ALPHABETICAL. \`order\` sorts by the VALUE in the column, so ordering
    a menu by its category column gives Dessert, Pizza, Starters — pudding at the top, which
    is not a menu anybody has ever printed. Measured on a real published site.
    Sort in the PAGE against the order the trade uses, and read in an order that is
    meaningful on its own so the list is right even before you group it:
      const SECTIONS = ["Starters", "Pizza", "Dessert"];
      const items = useRows<Item>("menu_items", { order: "price", dir: "asc" });
      const grouped = SECTIONS
        .map((name) => ({ name, rows: (items.data ?? []).filter((r) => r.category === name) }))
        .filter((g) => g.rows.length);
    Anything NOT in your list must still appear — put the leftovers in a final group rather
    than dropping them, or a row the owner adds later is invisible with nothing to explain it.
    The same applies to any column whose values are names rather than quantities: a status, a
    stage, a size, a day of the week. \`order\` by one only when alphabetical IS the answer.

15. A TABLE MARKED \`PAID: YES\` IS BOUGHT, NOT SUBMITTED. The digest says so per table.
    \`useCreateRow\` on one returns 403 — a paid table has no public insert at all, which is
    exactly what stops a price being forged — so use \`useCheckout\` and let the server price it:
      const checkout = useCheckout("orders")
      const { data: products = [] } = useRows<Product>("products")
      const [cart, setCart] = useState<Record<number, number>>({})
      ...
      <BusyButton
        busy={checkout.isPending}
        onClick={() =>
          checkout.mutate({
            items: Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty })),
            fields: { customer_name: name, email },
          })
        }
      >Pay <Money amount={total} currency="GBP" /></BusyButton>
    Send \`{ id, qty }\` and NOTHING else per line — no price, no total, no currency. The
    server reads the prices out of the catalogue table itself, so a total computed in the
    page is for DISPLAY only and is never sent. \`fields\` carries the customer's own
    details and only declared columns survive; never put \`payment_status\` or
    \`amount_total\` on a form, they are the platform's.
    \`mutate\` REDIRECTS to Stripe, so nothing after it runs — no toast, no navigate. The
    customer returns to \`/?paid=<id>\` or \`/?cancelled=<id>\`; read it with
    \`Route.useSearch()\` to say thank you. That id is NOT proof of payment, so never show
    an order's contents from it — the shop's own Stripe tells the platform when it is paid.
    Show the error \`checkout.error\` carries rather than a generic one: it is written for
    the customer, and says so when the shop has not finished setting payments up.

16. NO EXPLANATORY COMMENTS IN THE PAGES YOU WRITE. The examples above are commented
    because they are teaching you; the files you return are a customer's website and
    nobody reads its source. Output costs five times what input costs, and comments are
    27% of the example set — so a comment is the single most expensive thing here, and
    it is bought for a reader who does not exist. Write the code. The one exception is a
    line that stops the next person breaking something non-obvious ("cancelled bookings
    still hold the slot"); if it only restates what the line under it does, leave it out.

## Reading rows

\`useRows<T>(table, params)\` → a TanStack Query result whose \`.data\` is the rows.
- \`params\`: \`{ limit, offset, order, dir, q, <column>: value }\`. \`limit\` is capped at 100.
- \`order\` must be a DECLARED column or "id" — any other value silently falls back to id.
  \`created_at\` is NOT orderable unless the table declared it.
- a \`<column>: value\` pair is an equality filter, and only on declared columns.
- \`q\` is full-text search and only does something on a table that declared fts.
- rows come back with every column including \`id\` and \`created_at\`, so you can display those
  even though you cannot sort or filter on them.
- type it: \`type Service = Row & { name: string; price: number | null }\`. Every column the
  database did not mark required can be null — say so in the type and guard before rendering.

## Every list handles four states

Omit one and the page looks fine in a screenshot and broken in use:
- \`isPending\` → \`<Skeleton />\` placeholders, not a spinner and not nothing
- \`isError\` → one sentence a visitor can act on
- \`data?.length === 0\` → \`<Empty />\` from \`@/components/ui/empty\`, not a bare paragraph and
  never an empty grid. Give it a heading and a sentence saying what would put something there.
- loaded → the rows

## Every form must

- disable its submit button while \`mutation.isPending\`, and say so on the button — a
  \`<Spinner />\` inside it reads better than swapping the label, and keeps the width steady
- \`toast.success(...)\` and \`form.reset()\` on success
- \`toast.error(e.message)\` on failure — THE API'S OWN MESSAGE. It distinguishes the caller's
  fault from a server fault and returns a \`code\` for duplicate / overlap / bad_ref / required /
  full / invalid. "That time is already taken" is useful; "something went wrong" is not.

## Routing

File-based, TanStack Router. Each page is one file under src/routes/ exporting
\`export const Route = createFileRoute("<url>")({ component: X })\`.
  index.tsx → "/"      about.tsx → "/about"      menu/index.tsx → "/menu"
\`index.tsx\` is required. Link between pages with \`<Link to="/menu">\` from "@tanstack/react-router".
Never write routeTree.gen.ts, __root.tsx, src/pages/ or app/layout.tsx.

NEVER address a page as \`#/menu\`. The app uses browser history, so a \`#/\` link sets the URL
fragment and navigates nowhere — the page looks right and the link is dead. Use the plain path:
\`<Link to="/menu">\` in the body, and \`href: "/menu"\` in a \`SiteChrome\`/\`SiteHeader\` \`links\`
array (those go through \`SiteLink\`, so they route correctly whichever address the site is served
on). Same for navigating in code: \`const navigate = useNavigate()\` then \`navigate({ to: "/menu" })\`,
never \`location.hash = ...\`. An in-page anchor to a section on the SAME page — \`href="#prices"\`
with \`id="prices"\` — is a different thing and is fine.

## Styling

Tailwind v4 with semantic tokens: bg-background, text-foreground, bg-card, text-muted-foreground,
border-border, bg-primary, text-destructive. NEVER a literal colour — not bg-slate-900, not text-red-600, not
bg-[#1a1a1a], not a hex in a style prop. The site's colours come from its theme and from the owner's own
changes, both applied at build time, so a colour written into a page is one they can never change: ask for a
yellow background afterwards and every token moves except the one you hardcoded. It breaks dark mode too. Also available:
lucide-react icons, date-fns, recharts. Import nothing that is not already a dependency.

## Motion

${MOTION_COUNT} effects, as plain classes. There is NO animation library installed and none is
needed — add one and the build fails. Never write your own duration: use these, or the
scale \`duration-(--dur-1|2|3|4)\` (90 / 180 / 320 / 500ms) with \`ease-emphasis\` or
\`ease-standard\`. A raw \`duration-300\` is refused.

Every one of these stops for a visitor who asked for less movement, while the content
stays — so use them freely; they cannot trap anything invisible.

${MOTION_CATALOGUE}

WHEN TO REACH FOR THEM, since most pages need only three:
- Anything you render conditionally that the visitor did not just click — a banner, a
  confirmation, a "we are closed today" notice — gets \`motion-enter\`. Appearing instantly
  reads as a page glitch rather than as the site telling them something.
- A list you map over — services, a menu, opening hours — gets \`motion-stagger\` on the
  \`<ul>\`, not on the items.
- A long page's sections get \`motion-reveal\`. A short one does not: above the fold it
  delays the first thing they came to read.
- Something the visitor clicked open, or an inline editor, gets NOTHING. They are already
  looking at that spot and waiting; a fade there is felt as slowness, not polish.

## Charts — the other half of the kit

${CHART_NAME_COUNT} components across ${CHART_DOMAIN_COUNT} modules under "@/components/charts/lib/". Use them
exactly as you use the ${UI_COMPONENTS.length} above: import, pass props, done. Every one is
prop-driven — hand it \`useRows(...)\` data, never a copied array — and monochrome by rule,
so fill, weight, hatching and a written label carry the reading, never colour alone.

\`import { Bullet } from "@/components/charts/lib/bullet"\`

Most are for a specific trade, and the module name says which: a barber shop's page reaches
for \`salon\`, a cafe's for \`restaurant\`, a gym's for \`gym\`. Pick the domain that matches the
brief before reaching for a generic bar chart — \`salon.RebookRate\` says something a bar
chart cannot.

Six names are exported by two modules each, so take the one under the domain you read it
under. A module not listed here does not exist.

${CHART_CATALOGUE}

## Visitor accounts

A site can have members — its own customers, nothing to do with isibi accounts.
Everything comes from \`@/lib/rows\`; there is no other auth API and no \`fetch\`:

- \`useMember()\` → \`{ data: member | null, isPending }\`. **Render neither view until it
  settles**, or the page flashes a sign-in form at somebody already signed in. A member is
  \`{ id, email, name, role, verified }\` and \`id\` is a UUID string, never a number.
- \`useSignup()\` → \`{ email, password, name }\`. \`useLogin()\` → \`{ email, password }\`.
  On success the session is stored and every read re-runs on its own. Passwords need 8+
  characters. Surface the error's \`message\` on failure — the server distinguishes a wrong
  password from an address that already has an account, and inventing your own text loses that.
- \`useLogout()\` → a mutation, no arguments.
- \`useRequestReset()\` → \`{ email }\`. Always succeeds; say "check your inbox" whether or
  not the address has an account, because saying which confirms who is a member. The link
  itself is handled by the platform.

Gate admin UI on \`member.role\`, which is \`"user"\` unless the owner granted something. An
\`admin\` table refuses a write from any other role with a 403, so a button that is always
visible is a button that sometimes fails.

Build sign-in and sign-up ONLY when the schema actually has a \`user\`, \`feed\` or \`admin\`
table. A site of \`display\` and \`collect\` tables needs no accounts, and adding them is
friction nobody asked for — for somebody returning to a form they filled in, the claim link
(rule 10) is the right tool and needs no account at all.

## What is not possible yet

- Editing and deleting work ONLY on a member's OWN rows, in a \`user\` or \`feed\` table, with
  \`useUpdateRow\`/\`useDeleteRow\` and a signed-in member. A \`collect\` or \`display\` row has no
  owner and can never be changed from a page. Someone else's row answers 404, so treat "not found"
  as "not yours" and say so gently. AN EDIT IS WRITTEN LIKE THIS — the id, then the columns:
      const update = useUpdateRow<Deal>("deals");
      update.mutate({ id: deal.id, stage: "won" }, { onSuccess: () => toast.success("Saved") });
  Nesting them under \`values\` works too, if that reads better to you. A DELETE takes the id on
  its own: \`remove.mutate(deal.id)\`.
- No owner/admin dashboard IN THE SITE — a \`collect\` table cannot be read back from a page.
  Its owner reads those submissions inside isibi, which is not something you build.
If the brief asks for one of these, build everything else and say plainly in \`notes\` what was
left out and why. Never generate UI that cannot work.

## Definition of done

\`tsc --noEmit\` must be clean and \`vite build\` must succeed. Write real TypeScript: no \`any\`,
no unresolved imports, no props a component does not take.

Keep it to the few pages the brief actually needs — usually one, at most ${MAX_PAGES}. Write warm,
specific copy for the business in the brief; never lorem ipsum, never a placeholder image URL.

## The pages to imitate

Four real, compiling pages of ONE site, written against services(display) + appointments(collect,
with a publicView and a claim token) + profiles(user). They are the shape to copy — every rule
above is visible in them. Take the pages the brief needs and leave the rest; a site with no member
table needs no account page, and a plain contact form needs no manage page.

${REFERENCE_PAGES.map((p) => `### ${p.path} — ${p.blurb}\n\n${p.source}`).join("\n\n")}`;

export const SITE_PAGES_TOOL = {
  name: "write_pages",
  description: "Write the route files for the site.",
  input_schema: {
    type: "object",
    properties: {
      pages: {
        type: "array",
        // THERE WAS A `minItems: 1` HERE AND IT MADE A DELETION INEXPRESSIBLE.
        // It was added for a measured reason — 2026-08-05, a build called this
        // tool correctly, handed it `[]`, and charged 23 credits for a
        // placeholder — and it is the wrong LAYER for that reason, because this
        // one tool serves a build, a revise, an addon and a one-page edit, and
        // only the first two are always wrong to answer with no pages.
        //
        // MEASURED 2026-08-11, and it explains two failed attempts at fixing this
        // with words: "remove the gallery page" came back rewriting all four of
        // the site's pages and never setting `remove`. That was read as the model
        // ignoring the prompt. It was not — the schema OBLIGED it to return at
        // least one page, a pure deletion has none, and the only expressible
        // answer was the site rewritten. The same shape as `usePublicRows`, where
        // the honest call was a type error and the only one that compiled was a
        // lie.
        //
        // The requirement moved to `validatePages`, which is handed `partial` and
        // therefore KNOWS which of the four it is looking at. There is still no
        // `maxItems`, for the reason below: the cap belongs there too.
        //
        // A schema ceiling would make a model that wanted seven pages produce an
        // INVALID call, and an invalid call is the empty-array failure this all
        // exists to stop. Refusing too much is the same bug as accepting nothing.
        description: "One entry per route file, and one of them MUST be index.tsx. Leave this an EMPTY list only when " +
          "the change is purely a deletion and no page needed its links edited — otherwise every build, revise and " +
          "edit needs at least one.",
        items: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: 'Path under src/routes/, e.g. "index.tsx" or "menu.tsx". A directory form ("menu/index.tsx") is accepted and routes at "/menu"; prefer the flat form.',
            },
            source: { type: "string", description: "The complete .tsx source for that route file." },
          },
          required: ["path", "source"],
        },
      },
      remove: {
        type: "array",
        items: { type: "string" },
        description:
          "THE ONLY WAY TO DELETE A PAGE. Use it whenever the change asks for one to go away — \"remove the gallery " +
          "page\", \"we don't need the about page any more\". Leaving a page out of `pages` does NOT delete it here: " +
          "an unreturned page is KEPT, so a deletion answered that way silently does nothing. " +
          "The route files to delete, exactly as they are named above — for example \"src/routes/gallery.tsx\".\n" +
          "IF YOU REMOVE A PAGE YOU MUST ALSO RETURN EVERY PAGE THAT LINKS TO IT, with the link taken out. A link " +
          "pointing at a route that no longer exists does not compile, so the whole change would be refused and " +
          "their site left as it was. Never remove the home page.\n" +
          "Leave this out entirely for anything that is not a deletion.",
      },
      notes: {
        type: "string",
        description:
          "What you built, for the person who asked \u2014 two or three sentences, plain, no markdown. Say what the pages are and " +
          "anything they should know: something the brief asked for that you left out and why, a decision you made for them, a " +
          "detail you had to invent. This is shown to them as the reply in the chat, so write it to them and not about them, and " +
          "do not repeat their own brief back at them.",
      },
    },
    required: ["pages"],
  },
};

/**
 * What each READ level means to a page, in the words the generator acts on.
 *
 * Composed with the write half rather than looked up by name, because the five
 * names are now presets over a 4x4 grid and a table may legitimately sit in a
 * cell with no name at all — "anyone reads, members write their own" is the
 * commonest one, and describing it as its nearest preset would be a lie in
 * whichever direction the preset differs.
 */
export const READ_NOTE = {
  none: "NOBODY READS IT from a page — not a visitor, not a member, not the author. Never list these rows; a read returns 403.",
  own: "PRIVATE PER MEMBER. Signed in, a member reads only their OWN rows; signed out, a read returns 401. Build the signed-in view AND a sign-in prompt.",
  members: "ANY SIGNED-IN MEMBER READS EVERY ROW. Signed out, a read returns 401 — offer a sign-in rather than an empty list.",
  public: "ANYONE READS IT, signed in or not. List it, show it, search it, and never gate it behind a sign-in.",
};

export const WRITE_NOTE = {
  none: "NOBODY WRITES TO IT from a published page — no form, no useCreateRow, no edit, whatever role they hold. The business maintains these rows from its Go Farther dashboard. Build the reading UI and no write UI at all.",
  anyone: "ANY VISITOR WRITES TO IT, with no account — a booking, an order, an enquiry. They may submit and may never reach a row again: update and delete both return 403.",
  own: "A SIGNED-IN MEMBER WRITES ROWS THAT BECOME THEIRS, and edits or deletes only their own. Signed out, a write returns 401.",
  members: "ANY SIGNED-IN MEMBER WRITES, and may edit or delete ANY row, not only their own.",
};

/** The two halves as one sentence, for a table however it was declared. */
export function accessNote(t) {
  const { read, write } = resolveAccess(t);
  return "reads — " + (READ_NOTE[read] || READ_NOTE.none) + " writes — " + (WRITE_NOTE[write] || WRITE_NOTE.none);
}

export const ACCESS_NOTE = {
  display: "visitors READ it. List it, show it, search it. Writing to it returns 403.",
  collect: "visitors WRITE to it. Submit a form. Reading it returns 403 — never list these rows.",
  user: "PRIVATE PER MEMBER. Signed in, a member reads and writes only their OWN rows; signed out, both return 401. Build the signed-in view AND a sign-in prompt for when there is no member.",
  feed: "SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in member writes rows that become theirs. Signed out, both return 401.",
  admin: "SHARED, READ-ONLY FROM THE SITE. Anyone signed in reads every row; NOBODY writes to it from a published page — no form, no useCreateRow, no edit, whatever role they hold. The business maintains these rows from its isibi dashboard. Build the reading and listing UI and no write UI at all.",
};

/** The tables, exactly as they exist, in the least ambiguous form we can put them. */
export function schemaDigest(spec) {
  // A RETIRED TABLE IS NOT OFFERED, and this is half of what makes retiring
  // work: `grantsFor` withdraws its public access, and this stops the generator
  // writing a page against it. Told about it, the model would build a list that
  // renders empty and a form that 401s — worse than the feature simply being
  // gone, because it looks broken rather than removed.
  const tables = (spec && Array.isArray(spec.tables) ? spec.tables : [])
    .filter((t) => t && t.name && !t.retired);
  if (!tables.length) return "(the schema declares no tables)";
  // DECLARED FUNCTIONS, STATED. `useRpc`, `useRpcAction`, `useClaimedRow` and
  // `useCancelClaim` all take a function NAME, and the model has no way to
  // discover one — it can only be told. Not saying is how the whole tier stayed
  // dead: exactly the `publicView` failure, where a rule was conditioned on a
  // fact the digest never supplied.
  //
  // Printed with the exact signature, because a name alone does not say what to
  // pass. An ABSENT section reads as "this site declared none", which is the
  // honest answer and the common one.
  // INTERNAL FUNCTIONS ARE NOT CALLABLE AND MUST NOT BE ADVERTISED. An
  // `internal: true` function is REVOKEd from PUBLIC and never granted to the
  // Data API roles — that is the whole point of the flag (a confirmation
  // builder returns somebody's address and message). Listing it here told the
  // model it could call it, and `lintPages` accepted the call, so the page
  // compiled, published, and answered 403 to every visitor: exactly the class
  // the lint exists to catch, arriving through the catalogue instead.
  const fns = (spec && Array.isArray(spec.functions) ? spec.functions : []).filter((f) => f && f.name && !f.internal);
  const fnLines = fns.length
    ? "\n\nFUNCTIONS this schema declares — call these by NAME with useRpc / useRpcAction / useClaimedRow / useCancelClaim / useAmendClaim, and NO others:\n" +
      fns.map((f) => {
        const args = (Array.isArray(f.args) ? f.args : []).map((a2) => a2.name + ": " + a2.type).join(", ");
        return "  " + f.name + "(" + args + ") -> " + (f.returns || "void");
      }).join("\n")
    : "";
  // THIRD-PARTY READS, which the model was never told about at all. `useApi` is
  // the one hook in `@/lib/rows` no rule and no digest ever mentioned, so a site
  // could declare an api, the platform would serve it, and no generated page
  // could ever call it — the whole tier reachable by nothing, which is this
  // repo's signature failure and the reason `apis` is stated here beside the
  // functions rather than left for the model to discover.
  const apis = (spec && Array.isArray(spec.apis) ? spec.apis : []).filter((a) => a && a.name);
  const apiLines = apis.length
    ? "\n\nOUTSIDE DATA this site can read — call these by NAME with useApi(name, { params }), and NO others:\n" +
      apis.map((a) => {
        const ps = (Array.isArray(a.params) ? a.params : []).join(", ");
        return "  " + a.name + "(" + ps + ")" +
          " — the platform holds the key and does the call; the page only gets the answer back as JSON.";
      }).join("\n")
    : "";
  const tableLines = tables.map((t) => {
    const access = String(t.access || "collect").toLowerCase();
    const rw = resolveAccess(t);
    const presetName = accessNameFor(rw);
    // Columns arrive in two shapes and BOTH must work. normalizeSchema produces
    // rich objects ({name, type, notnull, ref}); the schema persisted in a
    // site's own `_meta` stores plain NAMES. Filtering on `c.name` silently
    // dropped every string, so a spec read back from _meta described each table
    // as having no columns at all — and the generator dutifully wrote pages that
    // said so. Live for one deploy on 2026-07-28.
    const cols = (t.columns || [])
      .map((c) => (typeof c === "string" ? { name: c } : c))
      .filter((c) => c && c.name);
    const described = cols.map((c) => {
      const bits = [String(c.type || "text").toLowerCase()];
      if (c.notnull) bits.push("required");
      if (c.ref) bits.push("names a row in " + c.ref);
      return c.name + " (" + bits.join(", ") + ")";
    });
    const lines = [
      // STATED AS THE PAIR. It read `access "user"` and the note for that name,
      // which cannot describe a table sitting in one of the eleven cells no
      // preset covers — and naming the nearest preset instead is wrong in
      // whichever direction they differ. The preset name is still printed when
      // there IS one, because it is what the schema says and what a revise will
      // read back.
      "TABLE " + t.name + " — read \"" + rw.read + "\", write \"" + rw.write + "\"" +
        (presetName ? " (\"" + presetName + "\")" : "") + ": " + accessNote(t),
      "  columns: " + (described.length ? described.join(" · ") : "(none)"),
    ];
    if (rw.read === "public") {
      lines.push("  order / filter by: " + cols.map((c) => c.name).concat("id").join(", "));
      lines.push("  full-text search: " + (t.fts ? "yes — pass { q } to useRows" : "no — do not pass q"));
    }
    // Whether `usePublicRows` works on this table, stated rather than left to be
    // guessed. Rule 9 says not to call it on a table with no public view — a
    // rule the model could not follow, because nothing here told it which tables
    // have one. Measured live 2026-07-29: it correctly worked out that
    // `bookings` had none, could not build the taken-slots hint, and the whole
    // site came out as the placeholder over one optional enhancement.
    //
    // Printed for EVERY table, not only the ones that have it. "No public view"
    // is the fact that stops a 404, and an absent line reads as an omission
    // rather than an answer.
    // `user` normally means private-to-me. `teamScope` changes that to
    // "ours", and a page that says "your notes" on a shared team table is
    // describing something the API does not do.
    if (t.teamScope && access === "user") {
      lines.push("  SHARED WITH THE TEAM: everyone in this member's team reads and edits the same rows. Say \"our\"/\"the team's\", not \"your\".");
    }
    if (access !== "display") {
      // `hasPublicView` decides, not a shape test written here — the data path
      // answers 404 on exactly this question, and a second copy of the rule
      // drifts into a digest that promises a read the API refuses.
      lines.push(hasPublicView(t)
        ? "  usePublicRows: YES — anyone may read " + t.publicView.columns.join(", ") + " from this table"
        : "  usePublicRows: NO — this table has no public view; calling it is a 404, so build the page without it");
    }
    // Stated for EVERY collect table, YES or NO, never omitted. An absent line
    // reads as an omission rather than an answer — the exact failure that made
    // a whole site come out as the placeholder when `publicView` was declarable,
    // enforced, and never mentioned in this digest.
    if (access === "collect") {
      const pay = normalizePayment(t);
      lines.push(pay
        ? "  PAID: YES — the visitor pays by card. Do NOT call useCreateRow on this table; it has no public insert and would 403. "
          + "Use useCheckout(\"" + t.name + "\") with the rows they chose from " + pay.from + ", priced in " + pay.currency.toUpperCase() + ". "
          + "The page sends only { id, qty } per line — never a price, total or currency — plus the customer's own declared fields."
        : "  PAID: NO — this is an ordinary form. Submit it with useCreateRow; there is no payment on this table.");
    }
    return lines.join("\n");
  }).join("\n\n");
  // THE AGGREGATE, WHICH NO PER-TABLE LINE CAN STATE.
  //
  // Every table above is described accurately and the fact that MATTERS is a
  // property of the set: whether a signed-out visitor can read anything at all.
  // Measured live 2026-08-10 on a real marketplace — `events` private per member,
  // `bookings` write-only, `reviews` members-only — so not one visitor could see
  // a single listing. The generator had no home page it could honestly write and
  // returned NOTHING, and the failure surfaced two steps downstream at
  // `stage: validate` with a message that named none of this.
  //
  // A STATEMENT OF FACT, NOT A RULE, which is what makes it safe to add. It
  // cannot false-alarm: an internal tool legitimately has no public tables, and
  // the sentence is correct for that site too — build the sign-in first. The
  // alternative, refusing the schema, would be wrong for every such site, and
  // this codebase already records that a check wrong a third of the time is
  // worse than no check.
  const readable = tables.filter((t) => resolveAccess(t).read === "public" || hasPublicView(t));
  const shut = tables.length && !readable.length
    ? "\nNOTHING ON THIS SITE IS READABLE BY A SIGNED-OUT VISITOR. Every table above needs a signed-in " +
      "member, so there is NO public list to build and no browse page to write. Do not write one: it would " +
      "401 for everybody who is not signed in. Build a home page that says what the site is and offers a " +
      "sign-in, and put every list behind it.\n"
    : "";
  return tableLines + shut + fnLines + apiLines;
}

/**
 * The user turn: what to build, and what already exists to build it against.
 * The brand is the name the schema designer settled on, and it is already in the
 * published page's <title> — passing it here keeps the heading from disagreeing
 * with the browser tab.
 */
/**
 * What the generator is told a revise is FOR.
 *
 * A revise sends {slug, instruction}, so before this the generator's entire
 * knowledge of the site was one line like "add a gallery" — and since it rewrites
 * every page each time, a working barber shop came back as a page listing a
 * gallery and nothing else. The merged schema fixed the tables; this fixes the
 * intent.
 *
 * The ORIGINAL brief is the anchor and is never rewritten by an instruction: an
 * accumulating log would grow without bound and would keep contradicting itself
 * ("remove the gallery" stays true forever). What the site has BECOME is carried
 * by the merged schema, which is the authoritative half anyway.
 */
export function briefForPages({ brief, priorBrief } = {}) {
  const now = String(brief || "").trim();
  const before = String(priorBrief || "").trim();
  if (!before || before === now) return now;
  if (!now) return before;
  return "The site already exists. It was originally built from this brief:\n\n" + before +
    "\n\nWHAT TO CHANGE NOW\n" + now +
    "\n\nKeep everything the original brief asked for unless this change says otherwise.";
}

/**
 * brief + the family's layout directive, which is what the model is ACTUALLY
 * given. Extracted from worker.js 2026-08-04.
 *
 * It lived inline in `buildAndPublishPages`, so the eval — which is supposed to
 * measure the generator — composed its own user turn and sent the bare brief.
 * ~287 tokens of layout instruction that every production build carries and no
 * sample ever did, which made the compile rate a number for a prompt the
 * platform does not send. Exactly what `pagesRequest` was extracted to prevent,
 * one layer up: the harness must not be able to tune a different prompt.
 *
 * GUARDED against a null directive: `layoutDirective` answers null for an
 * unknown family or structure, and interpolating that appends the literal word
 * "null" to the brief and loses the layout, silently.
 *
 * THE PHOTOGRAPH ALLOWANCE RIDES HERE FOR THE SAME REASON THE LAYOUT DOES. It
 * varies per build — it is derived from the family's page set and then cut down
 * to what the balance can carry — and PAGE_RULES sits under `cache_control:
 * ephemeral` at ~27,000 tokens, so a number that changes per build in the system
 * block would miss that cache every single time. Measured on the family
 * exemplar, which faced the same choice: $0.0082 a build becomes $0.1019.
 *
 * `images` is OMITTED, not defaulted, when the caller does not pass one — the
 * eval and every other caller that has no budget to state then sends exactly the
 * request it sent before this existed.
 */
export function briefWithLayout({ brief, family, structure, images } = {}) {
  const directive = family ? layoutDirective(family, structure ? { structure } : {}) : null;
  const parts = [String(brief ?? "")];
  if (directive) parts.push(directive);
  if (images != null) parts.push(imageDirective(images));
  return parts.join("\n\n");
}

/**
 * The reference home page for a family, as a worked example — or null.
 *
 * THE MODEL HAD NEVER SEEN ONE UNTIL 2026-08-04. `src/family-pages` was read by
 * test files and by nothing on the model path, and PAGE_RULES never mentioned
 * it, so the 100 best pages in this repo were on disk, typechecked, rendered,
 * guarded — and reachable by nothing. The same shape as the 27 blocks and the
 * 196 examples, both deleted for exactly that. These are wired instead, because
 * unlike a block they are what a good site of that trade actually looks like.
 *
 * IN THE USER TURN, NEVER THE SYSTEM BLOCK. A cache entry is keyed on the bytes,
 * so an exemplar that varies per family would make the cached prefix differ every
 * build and never hit: $0.0082 a build becomes $0.1019, thirteen times, measured.
 * Here it is ~2,300 tokens of fresh input, about $0.007 — 4% of what a build's
 * output costs.
 *
 * It does NOT replace the barber page in PAGE_RULES. They answer different
 * questions: that one is how to CALL the API and is identical on every build,
 * which is what makes it nearly free; this one is what this TRADE looks like.
 */
export function familyExemplar(family) {
  const src = family ? FAMILY_EXEMPLARS[family] : null;
  return src || null;
}

/**
 * `attachCount` is what the user ATTACHED, and it defaults to none so every
 * existing caller produces a byte-identical prompt.
 *
 * THIS NOTE IS TWO CLAUSES, AND IT SHRANK TWICE TO GET THERE. The first draft
 * assigned a purpose per file type ("a logo is a palette, a PDF is content to
 * reproduce") — wrong, because the same PDF is the customer's own price list or
 * a competitor's brochure and only the brief distinguishes them. The second
 * explained at length how to work that out instead, which is teaching the model
 * something it already knows: an attachment in a conversation is an ordinary
 * thing, and the person attaching it says what it is for. Owner's call, and it
 * is the same de-prescribing lesson the rules learned generally.
 *
 * What is left is only what the model cannot get from the message itself: that
 * the files are part of the request rather than decoration, and which of the two
 * "references" in this prompt wins when they disagree. There is deliberately NO
 * instruction about seeding — `write_pages` takes route files and nothing else,
 * so an earlier "put it in the seed rows" line asked for something this step is
 * structurally incapable of doing. Seeds come from the designer.
 */
/**
 * The site as it stands, handed back to the generator so a revise is an EDIT.
 *
 * WITHOUT THIS A REVISE REWRITES EVERY PAGE FROM NOTHING. The model saw the
 * brief and the schema and never the pages, and the container wipes
 * `src/routes` before each build — so "change the phone number in the header"
 * regenerated all the copy on every page. It stayed on topic, because the
 * original brief anchors it, and the words were different every time.
 *
 * PUT LAST AND FRAMED AS THE THING TO EDIT, not as another reference: the trade
 * exemplar above is a shape to copy and this is the actual site, so read in the
 * other order the model treats its own site as one more example.
 *
 * Bounded, because a large site is a large prompt and this is fresh input on
 * every revise. Over the cap the pages are named but not shown, which degrades
 * to today's behaviour for the site that would have been most expensive.
 */
const MAX_PRIOR_CHARS = 90000;
export function priorPagesBlock(pages, mode = "revise", target = "") {
  const list = (Array.isArray(pages) ? pages : [])
    .filter((p) => p && typeof p.path === "string" && typeof p.source === "string" && p.source.trim());
  if (!list.length) return "";
  const total = list.reduce((n, p) => n + p.source.length, 0);

  // ONE PAGE, AND ONLY THAT PAGE'S SOURCE GOES IN THE PROMPT. This is the
  // cheapest generation there is: the prior-source block rides in the USER
  // message and is not cached, so showing one file instead of five is a real
  // saving on input as well as on output. The other pages are named so a link
  // can point at one, and shown to nobody.
  //
  // A target nobody can find degrades to the ordinary revise rather than
  // silently editing the wrong file — the caller checks this too, and two
  // places refusing is better than one place guessing.
  if (mode === "page") {
    const one = list.find((p) => p.path === target);
    if (one && one.source.length <= MAX_PRIOR_CHARS) {
      const others = list.filter((p) => p.path !== one.path).map((p) => p.path);
      return "\n\nTHE PAGE YOU ARE CHANGING\n" +
        "Below is the current source of " + one.path + ", exactly as it is published right now.\n\n" +
        "RETURN THIS ONE FILE AND NOTHING ELSE. Change only what the instruction asks for; everything else in it " +
        "stays BYTE-IDENTICAL — the same headings, the same sentences, the same sections in the same order, the " +
        "same components. Do not reword, retitle, tidy or improve anything you were not asked about. The customer " +
        "wrote this page; a change they did not ask for reads to them as their site being replaced.\n\n" +
        "Do not return any other page, and do not create one. If what they are asking for needs a page that does " +
        "not exist, return this file unchanged and it will be handled elsewhere.\n" +
        (others.length ? "The site's other pages, which you may link to and must not return: " + others.join(", ") + "\n" : "") +
        "\n--- " + one.path + " ---\n" + one.source;
    }
    // No such page, or one too large to show: fall through to the full revise
    // below, which is what the caller would have done anyway.
  }
  // ADDING SOMETHING IS NOT REWRITING EVERYTHING, and the difference is the
  // whole reason the addon lane exists. A revise re-emits every page — output is
  // ~87% of what a build costs, so "add a gallery" pays to re-type five pages
  // that did not change. Here the model returns the NEW page and the pages it
  // had to touch to make it reachable, and the caller merges that over the rest.
  //
  // The nav is why "and nothing else" is not quite the rule: each generated page
  // declares its own CHROME with its own links, so a page nobody links to is a
  // page nobody can reach. Usually that is the home page, and usually the answer
  // is two files instead of six.
  if (mode === "addon" && total <= MAX_PRIOR_CHARS) {
    return "\n\nTHE SITE AS IT STANDS — YOU ARE ADDING TO IT\n" +
      "Below is the CURRENT source of every page, exactly as it is published right now.\n\n" +
      "RETURN ONLY WHAT IS NEW OR CHANGED. A page you do not return is kept exactly as it is, so returning one " +
      "unchanged bills the customer for retyping their own site. Usually that is ONE new page, plus the page a " +
      "visitor would look on to find it — each page carries its own nav links, so a new page nobody links to is " +
      "a page nobody can reach.\n" +
      // MEASURED, NOT FEARED. First live run: "add a gallery page" came back
      // having rewritten all four of the site's existing pages, for 28 credits —
      // a whole build's price for an addition. The rule above was already there
      // and did not bind, so it is now stated as a NUMBER with the consequence
      // attached, and the merge reverts an unjustified rewrite regardless.
      "TWO FILES IS THE NORMAL ANSWER AND FOUR IS ALWAYS WRONG. Do not return a page just because you read it. If " +
      "a page does not gain or lose a link, and the change does not name it, leave it out — a rewrite of a page " +
      "nobody asked about will be thrown away and the customer will still have paid for the words.\n\n" +
      "IF THE THING THEY ASKED FOR BELONGS ON A PAGE THAT ALREADY EXISTS, return that page edited and add no new " +
      "file at all. A testimonials section on the home page is an edit to the home page, not a new route.\n\n" +
      // WITHOUT THIS SENTENCE THE DELETE VERB IS UNREACHABLE. The full-revise
      // block one branch below says "to delete a page, simply do not return it",
      // which is exactly true there and does NOTHING here — an unreturned page
      // is KEPT. So a model working from that habit answers "remove the gallery"
      // by returning nothing, the merge reports no change, and the request
      // escalates to the ~25-credit revise this lane exists to avoid.
      "ARE THEY ASKING FOR A PAGE TO GO AWAY? THEN `remove` IS THE ONLY THING THAT DOES IT. Put its file path in " +
      "`remove` — \"src/routes/gallery.tsx\". NOT returning it does NOTHING here: a page you do not return is " +
      "KEPT, which is the opposite of what it means on an ordinary rewrite, and answering a deletion by returning " +
      "the other pages leaves the page exactly where it was. Measured: that is what happens when this is missed. " +
      "Also return any page that LINKS to the one being removed, with the link taken out, or the site will not " +
      "compile and nothing will change at all.\n\n" +
      "Anything you DO return must be the whole file, and everything in it that this change does not touch stays " +
      "BYTE-IDENTICAL — the same headings, the same sentences, the same sections in the same order. The customer " +
      "wrote this site; a change they did not ask for reads to them as their site being replaced.\n\n" +
      list.map((p) => "--- " + p.path + " ---\n" + p.source).join("\n\n");
  }
  if (total > MAX_PRIOR_CHARS) {
    return "\n\nTHE SITE AS IT STANDS\nIt has these pages: " + list.map((p) => p.path).join(", ") +
      ". They are too large to show here, so write them again in full \u2014 keep the same pages, the same " +
      "sections and the same wording wherever the instruction does not ask for a change.";
  }
  return "\n\nTHE SITE AS IT STANDS \u2014 THIS IS WHAT YOU ARE EDITING\n" +
    "Below is the CURRENT source of every page, exactly as it is published right now.\n\n" +
    "Return every page again, but as an EDIT of this: change only what the instruction asks for, and leave " +
    "everything else BYTE-IDENTICAL \u2014 the same headings, the same sentences, the same sections in the same " +
    "order, the same components. Do not reword, retitle, tidy or improve anything you were not asked about. " +
    "The customer wrote this site; a change they did not ask for reads to them as their site being replaced.\n\n" +
    "To DELETE a page, simply do not return it. To ADD one, return it alongside the others.\n\n" +
    list.map((p) => "--- " + p.path + " ---\n" + p.source).join("\n\n");
}

export function pagesPrompt(brief, spec, brand, family, attachCount = 0, priorPages = null, mode = "revise", target = "") {
  const name = String(brand || "").trim();
  const example = familyExemplar(family);
  const n = Math.max(0, Math.floor(Number(attachCount) || 0));
  return "Build the pages for this site.\n\nBRIEF\n" + String(brief || "").trim() +
    (name ? "\n\nTHE SITE IS CALLED\n" + name + " \u2014 use it as the heading; it is already the page title." : "") +
    "\n\nTHE SCHEMA THAT EXISTS\n" + schemaDigest(spec) +
    // BEFORE the trade exemplar and saying so, because the two are both
    // "references" and they can disagree. What the customer attached is about
    // THEIR business; the exemplar is a generic shape for the trade. When they
    // conflict the attachment wins, or the feature is decorative.
    (n
      ? "\n\nWHAT THE USER ATTACHED\n" + n + " file" + (n === 1 ? "" : "s") + ", above this text, part of what they are asking " +
        "for. Where " + (n === 1 ? "it" : "they") + " and the trade example below disagree, the attachment wins."
      : "") +
    // AFTER the schema, deliberately: the schema is a constraint the page must
    // obey and the example is a shape to follow, and an example read first
    // invites copying its tables. Framed as a DIFFERENT site of the same trade,
    // or the model reproduces its content — the failure the deleted examples
    // tier actually shipped, with a real customer's page reading "Our flagship
    // product combines cutting-edge technology with sleek design."
    (example
      ? "\n\nA SITE OF THIS TRADE, DONE WELL\nThis is a DIFFERENT business, and it compiles today. Copy its SHAPE — " +
        "what leads, what the sections are and in what order, how dense the real pages are, how specific the " +
        "writing is. Copy none of its words, its prices, its names or its tables; this site has its own schema " +
        "above and its own brief.\n\n" + example
      : "") +
    // LAST, so the model reads the shape-to-copy first and the site-to-edit
    // second. Empty on a first build, so nothing about that path changes.
    priorPagesBlock(priorPages, mode, target);
}

// A route path the container will accept: under src/routes, .tsx, no traversal,
// and not one of the files the template or the router owns. Checked on the name
// as written, BEFORE any extension is normalised — otherwise "routeTree.gen.ts"
// slips through as "routeTree.gen.tsx".
const RESERVED = /(^|\/)(__root|routeTree\.gen|readme)\b/i;
const SAFE_PATH = /^[a-z0-9_$][a-z0-9._$-]*(\/[a-z0-9._$-]+)*\.tsx$/i;

function cleanPath(raw) {
  let p = String(raw || "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  p = p.replace(/^(?:src\/)?routes\//, "");
  if (!p || p.includes("..") || RESERVED.test(p)) return null;
  if (!/\.[a-z]+$/i.test(p)) p += ".tsx";
  if (p.endsWith(".ts")) p = p.slice(0, -3) + ".tsx";
  return SAFE_PATH.test(p) ? p : null;
}

/**
 * Structural check on the tool's output: real paths, real source, an index.
 * Returns the files worth trying to compile plus everything wrong with them.
 */
export function validatePages(input, { partial = false } = {}) {
  const problems = [];
  const pages = [];
  const seen = new Set();
  const raw = (input && Array.isArray(input.pages)) ? input.pages : [];
  if (raw.length > MAX_PAGES) problems.push("More than " + MAX_PAGES + " pages were written; only the first " + MAX_PAGES + " were kept.");
  for (const p of raw.slice(0, MAX_PAGES)) {
    const source = p && typeof p.source === "string" ? p.source : "";
    // AN EMPTY PAGE IS A PROBLEM, NOT A SILENT SKIP. Dropped quietly, a call that
    // named five routes and gave every one an empty `source` came out the far end
    // as zero pages and zero problems — indistinguishable from a tool call with
    // no `pages` list at all, and reported as "the generator called the tool with
    // no pages in it", which is false and sends whoever reads it the wrong way.
    // Measured 2026-08-10 on a real build that could not be diagnosed afterwards
    // because all four of those failures print the same sentence.
    if (!source.trim()) {
      problems.push('"' + String((p && p.path) || "?").slice(0, 60) + '" was written with no code in it.');
      continue;
    }
    const path = cleanPath(p.path);
    if (!path) { problems.push('"' + String(p && p.path).slice(0, 60) + '" is not a route file name — use something like index.tsx or menu.tsx.'); continue; }
    if (seen.has(path)) { problems.push(path + " was written twice; only the first was kept."); continue; }
    if (source.length > MAX_PAGE_CHARS) { problems.push(path + " is over " + MAX_PAGE_CHARS + " characters — split it or cut it down."); continue; }
    if (!/createFileRoute\s*\(/.test(source)) { problems.push(path + " does not export a Route — every page needs createFileRoute(...)."); continue; }
    seen.add(path);
    pages.push({ path, source });
  }
  // A PARTIAL SET HAS NO HOME PAGE AND SHOULD NOT, which is not the same as a
  // site having none. The addon lane returns only what it wrote — usually one
  // new page and the nav entry that reaches it — and the site's real index is
  // kept untouched by `mergeAddonPages`. Reporting it missing there would put a
  // false problem on every single addon.
  if (!partial && pages.length && !seen.has("index.tsx")) problems.push("There is no index.tsx, so the site has no home page.");

  // ── A LINK TO A PAGE THAT DOES NOT EXIST IS A DEAD BUILD ──────────────────
  //
  // TanStack generates a UNION of the routes that exist, so `<Link to="/account">`
  // where no account.tsx was kept is `TS2322`, the compile fails, and the whole
  // site publishes as the placeholder. Measured live 2026-08-04: the model wrote
  // SEVEN pages, the cap kept six, `/account` was the one dropped — and the two
  // pages linking to it took the build down with them. A cap that silently drops
  // a page while leaving links to it is a guaranteed failure, not a risk.
  //
  // Deliberately broader than the cap, because the cap is only one way to get
  // here: a model that writes three pages and links to a fourth it never wrote
  // fails identically, and that needs no truncation at all.
  //
  // Rewritten to "/" rather than refused. Home always exists (asserted above),
  // so the site builds and one link goes somewhere sensible instead of nowhere —
  // which beats losing every page over a single href. The rewrite is reported,
  // so it is visible rather than silent.
  // A DIRECTORY INDEX ROUTES AT ITS DIRECTORY. `menu/index.tsx` is `/menu` to
  // TanStack, and this used to derive `/menu/index` — so a page written in the
  // directory form had its route recorded under a name nothing links to, and
  // every CORRECT `<Link to="/menu">` was rewritten to "/" as dangling. The page
  // existed at /menu, nothing reached it, and a false problem was reported on a
  // site that published. `cleanPath`'s SAFE_PATH allows directories, so this is
  // reachable output, not a hypothetical — reproduced before it was fixed.
  const routeOf = (path) =>
    path === "index.tsx" ? "/" : "/" + path.replace(/\.tsx$/, "").replace(/\/index$/, "");
  const live = new Set(pages.map((p) => routeOf(p.path)));
  const dangling = new Set();
  for (const p of pages) {
    p.source = p.source.replace(/(\bto\s*[=:]\s*)(["'])(\/[A-Za-z0-9/_-]*)\2/g, (m, lead, quote, target) => {
      if (live.has(target)) return m;
      dangling.add(target);
      return lead + quote + "/" + quote;
    });
  }
  if (dangling.size) {
    problems.push("These pages were linked to and do not exist, so the links were pointed at the home page instead: " +
      [...dangling].slice(0, 6).join(", ") + ".");
  }

  const notes = (input && typeof input.notes === "string") ? input.notes.trim().slice(0, 600) : "";
  return { pages, notes, problems };
}

// Reads the generated source for the mistakes that compile cleanly and then fail
// at runtime — a page that 403s against its own API looks perfect until it is
// loaded. Deliberately high-precision: every rule here is checked against the
// schema, so a hit is always a real defect, never a style opinion.
/**
 * The colours a page must not name, as three patterns.
 *
 * Kept up here and EXPORTED so the tests drive the real ones rather than
 * retyping them — a second copy of a pattern is two things that can disagree
 * about what counts as a colour.
 */
export const TAILWIND_PALETTE =
  "slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
export const COLOUR_UTILITIES =
  "bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|accent|caret|divide|placeholder|shadow";
export const TAILWIND_COLOUR =
  new RegExp("\\b(?:" + COLOUR_UTILITIES + ")-(?:" + TAILWIND_PALETTE + ")-[0-9]{2,3}\\b", "g");
/** The bracket's CONTENTS decide — `text-[0.7rem]` is a size and is in the corpus. */
export const ARBITRARY_COLOUR =
  new RegExp("\\b(?:" + COLOUR_UTILITIES + ")-\\[(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch|lab|lch|color)\\([^\\]]*\\))\\]", "g");
/** Six or eight digits only: `#add` is a real in-page anchor in the corpus. */
export const HEX_COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/g;

export function lintPages(pages, spec) {
  const problems = [];
  const tables = new Map();
  // Declared function names, for the RPC check below.
  // Callable functions only — an `internal` one is revoked from the Data API
  // roles, so a page calling it 403s. Kept apart from `internalFns` below so
  // the two failures can be told apart in the message.
  const allFns = (spec && Array.isArray(spec.functions) ? spec.functions : []).filter((f) => f && f.name);
  const fns = new Set(allFns.filter((f) => !f.internal).map((f) => String(f.name).toLowerCase()));
  const internalFns = new Set(allFns.filter((f) => f.internal).map((f) => String(f.name).toLowerCase()));
  const declaredApis = new Set((spec && Array.isArray(spec.apis) ? spec.apis : [])
    .map((a) => String((a && a.name) || "").toLowerCase()).filter(Boolean));
  for (const t of (spec && Array.isArray(spec.tables) ? spec.tables : [])) {
    if (t && t.name) tables.set(String(t.name).toLowerCase(), t);
  }
  const ui = new Set(UI_COMPONENTS);
  const say = (path, msg) => problems.push(path + ": " + msg);
  const memberTables = [...tables.values()].filter((t) => needsMember(t));

  for (const { path, source } of pages) {
    // Strip COMMENTS before pattern-matching, so a rule quoted in a doc comment is
    // not reported as the code doing it. String literals are deliberately NOT
    // stripped — this comment claimed they were, which is the kind of note that
    // outlives the code it describes. Hand-lexing template literals to blank them
    // gets nested backticks wrong and an over-blanking scanner HIDES real code,
    // which is the direction that costs a bug rather than a false alarm. The
    // price of leaving them: page copy containing the literal text "fetch (" is
    // reported as fetch code. A lint problem does not block publishing, so a rare
    // false alarm is the cheaper side of that trade.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    if (/\b(?:fetch|XMLHttpRequest)\s*\(/.test(code) || /\baxios\b/.test(code)) {
      say(path, "calls fetch directly. Read with useRows and write with useCreateRow from @/lib/rows — no fetch code in a page.");
    }
    // A PAGE MAY NOT NAME A COLOUR, and the reason is a feature rather than a
    // preference. The site's colours come from its theme and from the per-site
    // token patch, both of which the CONTAINER applies at build time — so a page
    // that writes `bg-amber-400` is unreachable by either. "Make the background
    // yellow" then moves the token, reports success, and the page does not
    // change: the edit lane's `look` layer silently doing nothing, which is the
    // exact failure it was built to end.
    //
    // Three shapes, and the corpus decides how tight each can be. Measured over
    // all 329 pages the model learns from — the 4 reference pages and 324 family
    // exemplars — there are ZERO literal colours of any kind, so none of these
    // can false-alarm on a page written the way we teach.
    for (const m of code.matchAll(TAILWIND_COLOUR)) {
      say(path, "writes the literal colour class \"" + m[0] + "\". Use the theme tokens — bg-background, text-foreground, " +
        "bg-primary, bg-muted and so on — or the site's own colours can never change it.");
      break;
    }
    // An arbitrary value that is a COLOUR. `text-[0.7rem]` and `text-[11px]` are
    // real and appear in the corpus, so the bracket's CONTENTS have to be the
    // test rather than the bracket itself.
    let arb = false;
    for (const m of code.matchAll(ARBITRARY_COLOUR)) {
      say(path, "writes the fixed colour \"" + m[0] + "\". Use the theme tokens instead — a colour written into the page " +
        "cannot be changed afterwards.");
      arb = true;
      break;
    }
    // THE HEX SCAN RUNS ON CODE WITH THE ARBITRARY VALUES BLANKED, because
    // `bg-[#ff0000]` matches both rules and one mistake reported twice reads as
    // two mistakes. Blanked rather than removed, so offsets stay valid — the
    // idiom this file already follows for comments.
    const noArb = arb ? code.replace(ARBITRARY_COLOUR, (m) => " ".repeat(m.length)) : code;
    // A raw hex colour. SIX OR EIGHT DIGITS ONLY: the three-digit form collides
    // with in-page anchors, and the corpus really does contain `href="#add"` —
    // flagging that would teach the model away from an anchor that is perfectly
    // correct, which costs more than the miss.
    for (const m of noArb.matchAll(HEX_COLOUR)) {
      say(path, "writes the raw colour \"" + m[0] + "\". Use the theme tokens — a hex colour in a page ignores the site's " +
        "theme and cannot be changed later.");
      break;
    }
    // COMMONJS IN AN ESM BUNDLE. Measured live 2026-08-08: a generated page
    // reached for `require()` out of training-data habit, and it passed every
    // check the pipeline has — the lint said nothing, `tsc` accepted it (Node's
    // types declare `require`), vite bundled it, and the site published. Then the
    // browser threw `ReferenceError: require is not defined` and the whole
    // component tree under it went to the error boundary, live, on a customer's
    // site. `build smoke` went red on "no console errors" and that was the only
    // thing in the repo that noticed.
    //
    // Exactly the class the `fetch` rule above exists for — compiles, bundles,
    // fails in front of a visitor — so it belongs next to it. With the repair
    // pass gone (2026-08-04) nothing downstream absorbs it.
    if (/\brequire\s*\(/.test(code) || /\bmodule\.exports\b/.test(code) || /\bexports\.[A-Za-z_$]/.test(code)) {
      say(path, "uses CommonJS (require/module.exports). These pages are ES modules bundled by vite: " +
        "`require` is not defined in the browser, so the page compiles, publishes, and then throws at " +
        "runtime — the whole section renders as an error. Use a top-level `import` instead.");
    }
    if (/@tanstack\/react-form/.test(code)) {
      say(path, "imports @tanstack/react-form. shadcn's Form components only speak to react-hook-form; use useForm from react-hook-form with zodResolver.");
    }
    // A ROUTE ADDRESSED AS A FRAGMENT — the same class again, and this one was
    // live for a day on every site built after the router moved.
    //
    // `#/book` was CORRECT while the app ran on `createHashHistory()`: the
    // fragment was where the route lived, and a hash anchor was real client-side
    // navigation. On 2026-08-09 the router moved to browser history so pages
    // could have real addresses, and every one of those links silently became a
    // no-op — it sets `location.hash`, matches no route, and renders nothing.
    // The customer clicks "Book" in the header and stays where they are.
    //
    // Nothing else can see it. `tsc` is happy (it is a string), vite bundles it,
    // the lint's other rules do not care, and the site publishes. It is visible
    // only by clicking, which is why it needs a rule rather than a fixed
    // template — the chrome and all 318 exemplars were corrected, and the model
    // still has the old shape in its training data.
    //
    // `#section` IS LEFT ALONE, deliberately: a fragment naming an id on the
    // same page is an ordinary in-page anchor and still works. Only `#/` — a
    // fragment that was standing in for a path — is ever wrong.
    if (/["'`]#\//.test(code)) {
      say(path, "addresses a page as `#/...`. The app uses browser history, so a `#/` link sets the " +
        "fragment and navigates nowhere — the page looks fine and the link does nothing. Use the " +
        "ordinary path (`/book`), or `<Link to=\"/book\">` inside the page body. An in-page anchor " +
        "like `#prices` is fine and is not this.");
    }
    // The same navigation written imperatively. `location.hash = "#/book"` is
    // one assignment away from the rule above and fails identically, so a rule
    // that only reads hrefs teaches the model to reach for this instead.
    if (/location\s*\.\s*hash\s*=/.test(code)) {
      say(path, "navigates by assigning location.hash. That moved the router under hash history and " +
        "does nothing now. Use `const navigate = useNavigate()` from @tanstack/react-router and " +
        "`navigate({ to: \"/book\" })`.");
    }
    // EDITING IS CHECKED PER TABLE, like every other hook here. It used to be a
    // BOOLEAN over the whole file — `/useUpdateRow|useDeleteRow/.test(code)` —
    // which never captured WHICH table was being edited. So `useUpdateRow` on a
    // `display` menu, a `collect` booking or an `admin` table passed the lint,
    // compiled, published and answered 403, as long as the page called
    // useMember() and the schema declared any member table at all. Every
    // neighbouring rule was per-table; these two alone were not.
    const editsRows = /\buseUpdateRow\b|\buseDeleteRow\b/.test(code);
    const editTargets = [...code.matchAll(/\buse(?:Update|Delete)Row\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)];
    for (const m of editTargets) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) { say(path, 'edits table "' + m[1] + '", which the schema does not declare.'); continue; }
      if (!canMemberWrite(t)) {
        say(path, 'edits "' + m[1] + '", which is access "' + accessLabel(t) + '" — PATCH and DELETE on it return 403. Only `user` and `feed` rows have an owner who may change them.');
      } else if (!/\buseMember\b/.test(code)) {
        say(path, 'edits "' + m[1] + '" without useMember(). Only a signed-in member can change a row, and only their own — put the edit UI behind a sign-in.');
      }
    }
    // PAYING IS CHECKED PER TABLE, for the same reason editing is.
    //
    // This is the class of failure this lint exists for: it typechecks, it
    // bundles, and it 403s at a real customer. A payable table has NO public
    // INSERT — that missing grant is the whole reason a price cannot be forged
    // — so useCreateRow on one is refused by Postgres at the moment somebody
    // tries to buy something.
    for (const m of code.matchAll(/\buseCreateRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && normalizePayment(t)) {
        say(path, 'submits "' + m[1] + '" with useCreateRow, but that table is PAID — it has no public insert and the write returns 403. Use useCheckout("' + m[1] + '") instead, sending { id, qty } for each item.');
      }
    }
    // And the other way round: checkout on a table that takes no payment. The
    // route answers 404 for it, so the button would simply never work.
    for (const m of code.matchAll(/\buseCheckout\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) { say(path, 'takes payment for table "' + m[1] + '", which the schema does not declare.'); continue; }
      if (!normalizePayment(t)) {
        say(path, 'calls useCheckout("' + m[1] + '"), but that table declares no payment — checkout answers 404 for it. Submit it with useCreateRow.');
      }
    }
    // The table name is not always a literal. Keep the blunt checks for the calls
    // the loop above could not resolve, or a computed table name would skip the
    // rule entirely — but do not repeat what it already said.
    if (editsRows && !editTargets.length) {
      if (!/\buseMember\b/.test(code)) {
        say(path, "calls useUpdateRow/useDeleteRow without useMember(). Only a signed-in member can change a row, and only their own — put the edit UI behind a sign-in.");
      }
      if (!memberTables.length) {
        say(path, "calls useUpdateRow/useDeleteRow, but this schema has no member table. `collect` and `display` rows have no owner and can never be edited from a page.");
      }
    }

    // A ROW ID IS A NUMBER AND A ROUTE PARAM IS A STRING, and the two failures
    // this catches are not the same size. Handing `row.id` to a link is a type
    // error and nothing worse. COMPARING them is a lookup that finds nothing —
    // `4 === "4"` is false — so if it ever stopped being a type error it would
    // become a manage page that says "not found" for every real row. Measured
    // live 2026-08-05: both, in one CRM sample, two of its four errors.
    //
    // Scoped to identifiers this file actually binds from a param hook, rather
    // than to every `.id ===` — `d.id === selectedId` against a numeric state is
    // correct code, and a rule that flagged it would be one the model learns to
    // ignore.
    const params = new Set();
    for (const m of code.matchAll(/(?:const|let)\s*(\{[^}]*\}|\w+)\s*=\s*[\w.]*use(?:Params|Search)\s*\(/g)) {
      const bind = m[1].trim();
      if (bind.startsWith("{")) {
        for (const part of bind.slice(1, -1).split(",")) {
          // `{ service: preselected }` binds the RIGHT name; `{ id = "" }` the left.
          const name = part.includes(":") ? part.split(":").pop() : part;
          const clean = name.split("=")[0].trim();
          if (/^\w+$/.test(clean)) params.add(clean);
        }
      } else if (/^\w+$/.test(bind)) params.add(bind + ".");
    }
    const isParam = (expr) => params.has(expr) || [...params].some((p) => p.endsWith(".") && expr.startsWith(p));
    if (params.size) {
      for (const m of code.matchAll(/([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*(===|!==)\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*)/g)) {
        const [, left, , right] = m;
        const rowId = (e) => /\.id$/.test(e) && !isParam(e);
        if ((rowId(left) && isParam(right)) || (rowId(right) && isParam(left))) {
          say(path, "compares " + left + " " + m[2] + " " + right + ", and a route param is a string while a row id is a number — they can never be equal. Write String(" + (rowId(left) ? left : right) + ") on the id side.");
        }
      }
    }
    // The other direction: an id going INTO a route. `String(...)` calls are
    // blanked first rather than matched around, so whitespace inside the call
    // cannot evade the check.
    for (const m of code.matchAll(/\b(?:params|search)\s*[:=]\s*\{\{?([^{}]*)\}\}?/g)) {
      const body = m[1].replace(/String\s*\([^()]*\)/g, '""');
      const bare = body.match(/\b[A-Za-z_$][\w$]*\.id\b/);
      if (bare) say(path, "puts " + bare[0] + " into a route without String(). Params and search params are typed string; wrap it as String(" + bare[0] + ").");
    }

    for (const m of code.matchAll(/from\s+"@\/components\/ui\/([a-z0-9-]+)"/gi)) {
      if (!ui.has(m[1].toLowerCase())) say(path, 'imports "@/components/ui/' + m[1] + '", which does not exist. Available: ' + UI_COMPONENTS.join(", ") + ".");
    }

    // THE NAME, not just the module. `import { FaqAccordion } from ".../faq"`
    // names a real file and a member that was never there — the module check
    // above passes it, `tsc` refuses it, and the site publishes as the
    // placeholder. Measured live, and one of the three commonest failures.
    //
    // A module we have no export list for is SKIPPED rather than guessed at: a
    // false alarm here would teach the model away from a component that is
    // perfectly real, which is worse than the miss.
    for (const m of code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'`]@\/components\/ui\/([a-z0-9-]+)["'`]/g)) {
      const known = UI_EXPORTS[m[2].toLowerCase()];
      if (!known) continue;
      for (const raw of m[1].split(",")) {
        // `type X`, `X as Y` — the imported NAME is what has to exist.
        const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (!name || !/^[A-Za-z_$]/.test(name)) continue;
        if (!known.has(name)) {
          say(path, 'imports { ' + name + ' } from "@/components/ui/' + m[2] + '", which does not export it. ' +
            "That module exports: " + [...known].join(", ") + ".");
        }
      }
    }

    // A PROP THE COMPONENT DOES NOT TAKE — the failure the eval actually records.
    //
    // Every recorded compile failure was on a component whose signature WAS in
    // the prompt: `render` on a `Column`, `onClick` on a bulk action, `title` on
    // an `Activity`, `fallbackSeed` on a `Shot`. The model can see the component
    // and invents a prop anyway, `tsc` refuses the file, and since the salvage
    // landed that costs the page rather than the site. Caught here it costs
    // nothing — the site publishes and the problem is reported.
    //
    // SKIPPED for any component with no documented signature, the same rule as
    // the import check above: a false alarm teaches the model away from a
    // component that is perfectly real, which is worse than the miss.
    //
    // SKIPPED for an element carrying a spread, because `{...props}` can supply
    // anything and there is no way to know what.
    // THE ELEMENT'S ATTRIBUTES, SCANNED RATHER THAN MATCHED. Written
    // `<([A-Z]\w*)\s([^>]*?)>` this stopped at the first `>` — which inside
    // `cell: (r) => r.x` is the arrow, so every element with a function-typed
    // prop was truncated and skipped. The `=>` trap for the third time in one
    // change, and the reason `splitTop` carries the same guard.
    for (const im of jsxElements(code)) {
      const mod = uiModuleFor(im[1]);
      if (!mod) continue;
      const allowed = propsOf(mod, im[1]);
      if (!allowed) continue;
      const attrs = im[2];
      if (attrs.includes("{...")) continue;
      const ok = new Set([...allowed, ...FREE_PROPS]);
      for (const [prop] of ownAttrs(attrs)) {
        // `aria-*`/`data-*` are DOM passthrough and never in a signature.
        if (/^(aria|data)-/.test(prop) || ok.has(prop)) continue;
        say(path, "<" + im[1] + "> is given `" + prop + "`, which it does not take. " +
          "It takes: " + allowed.join(", ") + ".");
      }
      // AND THE KEYS INSIDE A PROP'S OBJECTS, which is the shape that actually
      // fails. Measured on the real pages: the invented name is almost never a
      // JSX attribute, it is a key in the array handed to one — `fallbackSeed`
      // in a `Shot`, `render` in a `Column`, `title` in an `Activity`.
      for (const [name, at] of ownAttrs(attrs)) {
        const fields = shapeOf(mod, name, im[1]);
        // `attrs[at] !== "{"` IS BELT-AND-BRACES, AND SAYING SO IS THE POINT.
        // A mutation removing it survived the whole suite, and unlike the other
        // survivors this one really is inert: with a string value the scan below
        // runs on to the NEXT prop's brace, and it stops at the first `}` that
        // returns the depth to zero — which is that same brace's own close. So
        // the slice always carries one unmatched `{` and `topObjects` yields
        // nothing from it. Kept because that is an EMERGENT property of the
        // scan, not a local one: it holds by accident of where the loop breaks,
        // and a later edit to that loop would turn a string-valued prop into a
        // reader of the next prop's object. This makes the precondition local.
        if (!fields || attrs[at] !== "{") continue;
        // The value as written, from the `{` to its match — bounded to the
        // attribute so a later prop's braces cannot be read as this one's.
        const from = at;
        let d = 0, end = -1;
        for (let i = from; i < attrs.length; i++) {
          if (attrs[i] === "{") d++;
          else if (attrs[i] === "}") { d--; if (!d) { end = i; break; } }
        }
        if (end < 0) continue;
        const value = attrs.slice(from + 1, end);
        // Inline literals only. A variable, a `.map()` or a spread can hold
        // anything, and guessing is how a lint invents a complaint.
        if (value.includes("...")) continue;
        // THE OUTERMOST OBJECTS, not the innermost. `/\{([^{}]*)\}/` matches the
        // deepest braces, so `{ name: "x", capacities: { Standing: 120 } }` was
        // read as an item with one key called `Standing` — a page that was
        // perfectly correct, reported as wrong.
        for (const body of topObjects(value)) {
          for (const kv of splitTop(body, ",")) {
            const km = kv.trim().match(/^([a-zA-Z_$][\w$]*)\s*:/);
            if (!km || fields.includes(km[1])) continue;
            say(path, "<" + im[1] + "> `" + name + "` is given `" + km[1] +
              "`, which is not part of that shape. It takes: " + fields.join(", ") + ".");
          }
        }
      }
    }

    // MOTION THAT INVENTS ITS OWN TIMING. Deliberately narrow: a raw duration or
    // easing is always a real defect now, because the kit was tokenised and there
    // is exactly one scale. It is also the failure that never announces itself —
    // a page where the banner, the panel and the toast each picked a different
    // number looks correct in every screenshot and simply feels unconsidered.
    for (const m of code.matchAll(/\bduration-(\d+)\b/g)) {
      say(path, "uses duration-" + m[1] + ". The kit has one timing scale — use " +
        "duration-(--dur-1) 90ms, (--dur-2) 180ms, (--dur-3) 320ms or (--dur-4) 500ms.");
    }
    for (const m of code.matchAll(/(?<=["'\s])ease-(?:linear|in-out|in|out)(?=[\s"'`])/g)) {
      say(path, "uses " + m[0] + ". Use ease-emphasis for anything arriving, ease-standard " +
        "for a state change.");
    }
    // An animation runtime. None is installed, so this would fail the build
    // anyway — but a named refusal explains WHY rather than leaving the model to
    // read a module-not-found and try a different package.
    for (const m of code.matchAll(/from\s+["'](framer-motion|motion|motion\/react|gsap|@react-spring\/[a-z]+|animejs)["']/g)) {
      say(path, 'imports "' + m[1] + '". There is no animation library and none is needed — ' +
        "every effect the kit needs is a CSS class. See the motion list in the rules.");
    }

    // THE CHART DEMOS, refused by name. This is the rule the deleted `@/examples/*`
    // one used to be, and it is justified here on exactly the reasoning that
    // retired it there: that rule went when the folder went, because a missing
    // module is caught by tsc like any other. These 1,140 files are NOT missing.
    // Each is `export default function Component()` wrapping a primitive in a
    // Card around invented figures, so an import of one COMPILES, bundles, and
    // publishes "Bookings 268 / 300 · January - June 2024" to a real business's
    // customers. Nothing else in the pipeline can tell that from a real chart.
    // The path class allows `/`, so this catches a nested path as well as a flat
    // one — and THAT is what makes the `(?!lib\/)` real. Written as `[a-z0-9-]+`
    // the lookahead was decoration: the class cannot cross a slash, so
    // `charts/lib/bullet` never matched it in the first place and removing the
    // lookahead changed nothing. Proved by mutation, which is the only way that
    // kind of no-op guard ever gets found.
    for (const m of code.matchAll(/from\s+"@\/components\/charts\/(?!lib\/)([a-z0-9/-]+)"/gi)) {
      say(path, 'imports "@/components/charts/' + m[1] + '", which is a DEMO — a fixed ' +
        "layout around invented numbers, not a component. Import the primitive it uses from " +
        '"@/components/charts/lib/<domain>" and pass it this site\'s rows.');
    }

    // A chart import is checked down to the NAMED EXPORT, which the ui check
    // above deliberately is not: a ui module's exports are shadcn's and widely
    // known, while these are ours, six names live in two domains each, and the
    // model is picking from 141 modules it is shown once. Getting the module
    // right and the name wrong is the likely miss, and it costs the single
    // repair pass if only tsc catches it.
    for (const m of code.matchAll(/import\s*(\{[^}]*\})\s*from\s+"@\/components\/charts\/lib\/([a-z0-9-]+)"/gi)) {
      const names = CHART_COMPONENTS[m[2].toLowerCase()];
      if (!names) {
        say(path, 'imports "@/components/charts/lib/' + m[2] + '", which is not a chart domain. ' +
          "The domains are: " + Object.keys(CHART_COMPONENTS).join(", ") + ".");
        continue;
      }
      for (const raw of m[1].replace(/[{}]/g, "").split(",")) {
        // `Foo as Bar` imports Foo; the local alias is the page's business.
        const want = raw.trim().split(/\s+as\s+/i)[0].trim();
        if (!want || want === "type") continue;
        if (!names.includes(want)) {
          const elsewhere = Object.entries(CHART_COMPONENTS)
            .filter(([, ns]) => ns.includes(want)).map(([d]) => d);
          say(path, '"' + want + '" is not exported by @/components/charts/lib/' + m[2] + ". " +
            (elsewhere.length
              ? "It is in " + elsewhere.join(" and ") + " — import it from there."
              : "That module exports: " + names.join(", ") + "."));
        }
      }
    }

    // `useApi` FOR A NAME THE SCHEMA NEVER DECLARED. Same class as the useRpc
    // check: the call compiles, the page publishes, and the route answers 404 to
    // every visitor. The hook was invisible to the model until the digest started
    // naming the declared apis, so this is the other half of making it usable —
    // being told what exists, and being told when a name is not one of them.
    for (const m of code.matchAll(/\buseApi\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      if (declaredApis.has(m[1].toLowerCase())) continue;
      say(path, 'calls useApi("' + m[1] + '"), which the schema does not declare. ' +
        (declaredApis.size ? "Declared: " + [...declaredApis].join(", ") + "." : "This schema declares no outside data sources at all."));
    }

    // A PHOTOGRAPH TOKEN SOMEWHERE AN UNBOUGHT PICTURE WOULD BREAK.
    //
    // The token is bought if there is budget for it and cleared to the empty
    // string if there is not — and an empty string is a designed placeholder
    // inside `SafeImage` and a BROKEN-IMAGE ICON in a bare `<img>`. So the tag
    // it sits in decides what an unbought picture looks like, which is why the
    // rule is about the tag rather than about the token.
    //
    // IT WAS `SafeImage` ALONE AND THAT WAS TOO NARROW — measured on the first
    // live build, which put a token in `<Gallery>` and was told off for it. 42
    // of the kit's components render their picture THROUGH SafeImage, so a
    // token in any of them is exactly as safe as one in SafeImage itself, and
    // those are the components the model naturally reaches for on a page that
    // wants a photograph. Refusing them teaches the model to hand-roll an
    // `<img>` instead, which is the one thing that really does break.
    //
    // Checked by the nearest `<` BEFORE the token: the token is always inside an
    // attribute, so in well-formed JSX that is its own opening tag. A token in a
    // bare string constant is caught by the same test, which is intended — it is
    // not in a src at all, and there is no telling where it ends up.
    for (const m of code.matchAll(/@@IMG:[\s\S]*?@@/g)) {
      const open = code.lastIndexOf("<", m.index);
      const tag = open < 0 ? "" : (code.slice(open + 1, open + 24).match(/^[A-Za-z][\w.]*/) || [""])[0];
      if (!SAFE_IMAGE_COMPONENTS.includes(tag)) {
        say(path, "writes a @@IMG:@@ photograph token " + (tag ? "inside <" + tag + ">" : "outside any tag") +
          '. A token belongs in the image prop of a component that draws through SafeImage — `<SafeImage src="@@IMG:...@@" alt="..." />` ' +
          "is the plain one, and Gallery, Hero, TeamGrid, ProductCard and the rest are fine too — because a " +
          "picture that could not be bought becomes an empty src, which those draw as a placeholder and " +
          "a bare <img> draws as a broken image.");
      }
    }

    // There was a rule here refusing `@/examples/*`, shadcn's own documentation
    // demos. It existed for one reason, stated in its own comment: every file in
    // that folder COMPILED, so nothing else in the pipeline could tell a real
    // page from one shipping "Our flagship product combines cutting-edge
    // technology with sleek design" to a barber shop's customers. The folder was
    // deleted 2026-07-31, which makes that import a missing module — caught by
    // `tsc` like any other, and no longer silent. The rule's whole justification
    // went with the files, so it went too rather than standing guard over a path
    // that no longer resolves.

    // Read and write are asked separately because the API answers them
    // separately, and the levels do not line up: `feed` READS and WRITES for a
    // signed-in member, while `admin` reads for one and writes for nobody. This
    // comment said "`feed` and `admin` serve reads and refuse writes", which was
    // wrong about feed and is exactly the kind of note that outlives the code it
    // describes.
    // A member-scoped table without useMember() renders a permanent 401 to a
    // signed-out visitor and looks like a broken page rather than a locked one.
    for (const m of code.matchAll(/\buseRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && readNeedsMember(t) && !/\buseMember\b/.test(code)) {
        say(path, 'reads "' + m[1] + '" (access "' + accessLabel(t) + '") without useMember(). Signed out that returns 401, so the page must offer a sign-in rather than an error.');
      }
      if (!t) say(path, 'reads table "' + m[1] + '", which the schema does not declare.');
      // A member table is handled by the rule above: it is readable, just not
      // anonymously. Saying both would report one page twice and pay for a
      // repair pass to fix a problem that was already described.
      else if (!canReadAccess(t) && !readNeedsMember(t)) {
        say(path, 'lists "' + m[1] + '", which is access "' + accessLabel(t) + '" — reading it returns 403: ' + whyNotReadable(t) + '.');
      }
    }
    // `usePublicRows` is the one read that does NOT follow from a table's access
    // level — it works only where the schema declared a `publicView`, and on
    // every other table it is a 404 the visitor sees as a broken page. The same
    // class as the checks around it: a mismatch between what the page asks for
    // and what the schema actually permits, caught without running anything.
    for (const m of code.matchAll(/\busePublicRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'reads table "' + m[1] + '", which the schema does not declare.');
      else if (!hasPublicView(t)) {
        say(path, 'calls usePublicRows("' + m[1] + '"), but that table declares no publicView — the request is a 404. Build the page without the taken-slots hint; the server still refuses a taken slot on submit.');
      }
    }
    for (const m of code.matchAll(/\buseRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && readNeedsMember(t) && !/\buseMember\b/.test(code)) {
        say(path, 'reads one row of "' + m[1] + '" (access "' + accessLabel(t) + '") without useMember(). Signed out that returns 401.');
      } else if (t && !canReadAccess(t) && !readNeedsMember(t)) {
        say(path, 'reads one row of "' + m[1] + '", which is access "' + accessLabel(t) + '" — reading it returns 403: ' + whyNotReadable(t) + '.');
      }
    }
    // A FUNCTION THE SCHEMA NEVER DECLARED IS A 404, and until 2026-08-04 no
    // schema could declare one at all — so `useRpc`, `useRpcAction`,
    // `useClaimedRow` and `useCancelClaim` were four hooks nothing could reach.
    // Now that they can be declared, calling an undeclared one is the same class
    // as naming a table that does not exist, and is caught the same way.
    for (const m of code.matchAll(/\buse(?:Rpc|RpcAction|ClaimedRow|CancelClaim)\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      if (internalFns.has(m[1].toLowerCase())) {
        say(path, 'calls "' + m[1] + '", which the schema declares as internal — it is revoked from the ' +
          "Data API roles, so the call compiles and then answers 403 to every visitor. Platform-only; do not call it from a page.");
      } else if (!fns.has(m[1].toLowerCase())) {
        say(path, 'calls the database function "' + m[1] + '", which this schema does not declare — the request is a 404. ' +
          (fns.size ? "Declared: " + [...fns].join(", ") + "." : "This schema declares no functions at all."));
      }
    }
    for (const m of code.matchAll(/\buseCreateRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'writes to table "' + m[1] + '", which the schema does not declare.');
      // A member table accepts writes from someone signed in — that is the whole
      // point of the level — so the question is whether the page has a member,
      // not whether the table is writable.
      //
      // `canMemberWrite`, NOT `needsMember`: the latter is true for `admin`, and
      // admin grants SELECT and nothing else, so this branch swallowed the one
      // case it most needed to report. An admin form passed the lint and then
      // refused its own administrator.
      else if (canMemberWrite(t)) {
        if (!/\buseMember\b/.test(code)) {
          say(path, 'writes to "' + m[1] + '" (access "' + accessLabel(t) + '") without useMember(). Signed out that returns 401, so the form must be behind a sign-in.');
        }
      } else if (!canWriteAccess(t.access)) {
        say(path, 'submits to "' + m[1] + '", which is access "' + accessLabel(t) + '" — writing to it returns 403. Only a `collect` table accepts a write from a published site.');
      }
    }
  }
  return [...new Set(problems)];
}

/** The repair turn: here is what you wrote, here is what is wrong, write it again. */
/**
 * The exact props of the components a page imported.
 *
 * The rules name 500 components and describe NONE of them, because a usage line
 * each is ~12,600 tokens on every build. So the model picks by name and guesses
 * the props — and the guess is wrong often enough to matter: `<ReviewStars
 * rating={4.5} />` is the obvious spelling and the prop is `value`, which is
 * TS2322, the one repair pass spent, and a site published as the placeholder.
 *
 * Handing them over on the REPAIR pass costs nothing on a build that worked and
 * ~500 tokens on one that did not — and a repair is exactly where a wrong prop
 * name has to be corrected. The imports are read off the code the model just
 * wrote, so it only ever gets the twenty or so it actually reached for.
 */
export function importedComponentApi(pages) {
  const want = new Set();
  const wantCharts = new Set();
  for (const p of pages || []) {
    const src = String(p.source || "");
    for (const m of src.matchAll(/from\s+["']@\/components\/ui\/([a-z0-9-]+)["']/gi)) {
      want.add(m[1].toLowerCase());
    }
    // The chart domains a page reached for get their signatures too. A repair is
    // where a wrong prop name is fixed, and these are components we invented —
    // the half the model can only guess at — so leaving them out would hand back
    // the exact page that failed with nothing new to go on.
    for (const m of src.matchAll(/from\s+["']@\/components\/charts\/lib\/([a-z0-9-]+)["']/gi)) {
      wantCharts.add(m[1].toLowerCase());
    }
  }
  const lines = [...want].sort()
    .filter((n) => COMPONENT_API[n])          // shadcn primitives are absent on purpose
    .map((n) => `${n} — ${COMPONENT_API[n]}`)
    .concat([...wantCharts].sort()
      .filter((n) => CHART_API[n])
      .map((n) => `charts/lib/${n} — ${CHART_API[n]}`));
  return lines.length ? lines.join("\n") : null;
}

/**
 * Worked calls for the chart primitives a page actually named, from the demos.
 *
 * Separate from the signatures because they answer different questions and one
 * cannot stand in for the other. A signature gives the whole surface and stops
 * at a type NAME — `Waterfall(steps: Step[], …)` never says what a `Step` is,
 * and 27 of the 854 end that way. The example resolves it, and shows the
 * optional `total: true` flag no type name hinted at.
 *
 * Scoped to what the page IMPORTED, and to the names it actually used, or this
 * costs on every repair what the compose/repair split exists to avoid.
 */
export function importedChartUsage(pages) {
  const out = [];
  for (const p of pages || []) {
    const src = String(p.source || "");
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@\/components\/charts\/lib\/([a-z0-9-]+)["']/gi)) {
      for (const raw of m[1].replace(/[{}]/g, "").split(",")) {
        const name = raw.trim().split(/\s+as\s+/i)[0].trim();
        const key = m[2].toLowerCase() + "." + name;
        if (CHART_USAGE[key] && !out.some((o) => o.startsWith(key + "\n"))) {
          out.push(key + "\n" + CHART_USAGE[key]);
        }
      }
    }
  }
  return out.length ? out.join("\n\n") : null;
}

/**
 * UNREACHABLE FROM PRODUCTION SINCE 2026-08-04. Nothing calls this: the repair
 * pass was removed from `publish-pages.mjs` and `pagesRequest` no longer has a
 * `fix` branch, so a build makes exactly one model call.
 *
 * Said out loud because this codebase's most expensive recurring bug is code
 * that LOOKS reachable and is not — `roundRobin`, `sla`, `maskFields`,
 * `teamScope` at five separate layers. The difference here is that it is
 * written down, and a test asserts no production caller exists rather than
 * trusting this comment.
 *
 * Kept rather than deleted because it is one decision away from mattering
 * again: if the eval's first-try rate turns out to be poor, the repair comes
 * back and this is what it needs. `importedComponentApi` and
 * `importedChartUsage` are here on the same terms, along with the generated
 * `COMPONENT_API`, `CHART_API` and `CHART_USAGE` they read. The owner's
 * standing rule is that unused code goes; this is a deliberate hold on that,
 * not an oversight, and it is theirs to call.
 */
export function repairPrompt(brief, spec, pages, problems, brand) {
  const files = pages.map((p) => "=== src/routes/" + p.path + " ===\n" + p.source).join("\n\n");
  const api = importedComponentApi(pages);
  const usage = importedChartUsage(pages);
  return "The pages you wrote did not work. Fix them and return the COMPLETE set of route files again — " +
    "every file, not a patch.\n\nWHAT IS WRONG\n" +
    problems.map((p) => "- " + p).join("\n") +
    (api
      ? "\n\nTHE EXACT PROPS OF WHAT YOU IMPORTED\n" +
        "These are the real signatures, taken from the components themselves. Where what you\n" +
        "wrote disagrees with one of these, the signature is right. Every one also takes\n" +
        "className. A `?` means optional; `= x` is the default.\n" + api
      : "") +
    // The examples come AFTER the signatures on purpose: the signature is the
    // whole surface and the example is one working point on it. Read the other
    // way round, a call showing four of nine props reads as the four that exist.
    (usage
      ? "\n\nWORKING CALLS FOR THE CHARTS YOU IMPORTED\n" +
        "Real code that compiles today, so where a signature only gave you a type NAME this\n" +
        "shows its shape. Arrays are cut short — copy the shape, not the numbers, and pass\n" +
        "this site's own rows.\n" + usage
      : "") +
    "\n\nWHAT YOU WROTE\n" + files.slice(0, 60000) +
    "\n\n" + pagesPrompt(brief, spec, brand);
}

// ------------------------------------------------------- the request itself

/**
 * Page generation is a much bigger call than the schema design — whole .tsx
 * files rather than a handful of column names.
 *
 * Sized above what the pages themselves need: Sonnet 5 runs adaptive thinking
 * when `thinking` is omitted, and max_tokens caps thinking AND the response
 * together, so a budget tight around the files would spend part of itself
 * reasoning and truncate the last one.
 *
 * 30,000, RAISED FROM 24,000 ON 2026-08-04 (owner's call), alongside taking the
 * request's timeout off. Both caps had the same shape of failure and it is the
 * expensive one: hitting either means the tokens were generated and billed and
 * the caller gets nothing — a truncated tool_use block is treated as a failed
 * generation here, correctly, because its last file ends mid-expression.
 *
 * It costs nothing to raise. max_tokens is a CEILING, not a reservation: a
 * three-page site that finishes in 5,000 is billed for 5,000 either way. The
 * only thing a low ceiling buys is a cheaper failure, and a failure is the
 * thing we are trying not to have.
 */
export const SITE_PAGES_MAX_TOKENS = 30000;

/**
 * The exact body the Worker POSTs to the model.
 *
 * Extracted so the eval harness issues the SAME request the Worker does. It was
 * built inline in worker.js, which cannot be imported — so any harness had to
 * restate the model, the budget, the tool and the prompt, and would then be
 * tuning against something subtly different from what production runs. A test
 * asserts worker.js calls this rather than rebuilding the body.
 *
 * THE SYSTEM BLOCK IS CACHED, and that is the whole reason it is an array here
 * rather than the plain string it used to be. `PAGE_RULES` is ~7,000 tokens and
 * is byte-identical on every generation on the platform — it does not vary with
 * the brief, the schema or the brand, all of which live in the user message. So
 * it was being paid for in full, every build, forever.
 *
 * Measured: input goes 7,523 -> 1,148 tokens per build in the steady state, an
 * 85% cut. The first call in a cache window pays a 1.25x write premium (9,294),
 * so it breaks even on the second build. That break-even used to be reached
 * inside a single build, because the repair pass re-sent this exact block; with
 * the repair gone it takes a second BUILD in the cache window.
 *
 * The consequence to know about: a cache entry is keyed on the bytes, so ANY
 * edit to PAGE_RULES — including adding a component name — invalidates it and
 * the next call pays the write premium again. That is once per deploy that
 * touches the rules, against a saving on every build in between.
 */
export function pagesRequest({ brief, spec, brand, family, attachments, model, priorPages, mode = "revise", target = "" } = {}) {
  // THE ATTACHED FILES \u2014 images and PDFs \u2014 and where they sit is load-bearing
  // twice over.
  //
  // They go in the USER MESSAGE, which is after both cached blocks — so a build
  // with an attachment still reads `PAGE_RULES` and the tool schema out of the
  // cache. Putting them anywhere in `system` or `tools` would change the cached
  // bytes and make every attachment a cache miss on ~27,000 tokens, which costs
  // far more than the pictures do.
  //
  // And they come BEFORE the text within that message, which is the order the
  // API is documented to work best in and the order the prompt then refers to
  // ("above this text").
  //
  // Blocks are validated by the caller. When there are none the content stays a
  // plain STRING rather than a one-element array — the shape every existing
  // caller and test already sees, so adding this feature changes no request that
  // does not use it.
  const blocks = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  const text = pagesPrompt(brief, spec, brand, family, blocks.length, priorPages, mode, target);
  return {
    // The composer's Builder picker chooses this; `modelsFor()` with no
    // argument is the default pair, which is what the eval harness and every
    // caller that does not offer a choice get. Never a bare string here — a
    // fourth copy of a model id is a fourth place for it to go stale.
    model: model || modelsFor().pages,
    max_tokens: SITE_PAGES_MAX_TOKENS,
    tools: [SITE_PAGES_TOOL],
    tool_choice: { type: "tool", name: "write_pages" },
    system: [{ type: "text", text: PAGE_RULES, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: blocks.length ? [...blocks, { type: "text", text }] : text }],
  };
}
