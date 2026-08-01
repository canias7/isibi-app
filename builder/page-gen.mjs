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
import { COMPONENT_API } from "./component-api.mjs";
// The chart half, generated from src/components/charts/lib by
// builder/gen-chart-api.mjs and kept in step by test/chart-api.test.mjs.
import { CHART_COMPONENTS, CHART_API } from "./chart-api.mjs";
// One worked call per primitive, mined out of the demos by
// builder/gen-chart-usage.mjs. This is what the 1,140 demo files are FOR: they
// are the only place in the repo these APIs are called, and they compile, so
// every example is known-good rather than something written from the types.
// Reachable only this way — the model has no filesystem, and importing a demo
// is the defect the lint refuses.
import { CHART_USAGE } from "./chart-usage.mjs";

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
/** Every component in src/components/ui. An import of anything else does not resolve. */
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
];

// Imported, not restated. The generator has to predict exactly what the API will
// refuse, and when these rules were written out in both files they drifted — the
// lint claimed a read of a `feed` or `admin` table returns 403, which the API
// does not do. site-access.mjs is dependency-free, so this module stays
// importable without the Worker's node_modules.
export { MANAGED_COLUMNS } from "../site-access.mjs";
import { MANAGED_COLUMNS, canReadAccess, canWriteAccess, whyNotReadable, needsMember, hasPublicView } from "../site-access.mjs";

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
  action: { label: "Book a chair", href: "#/book" },
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
        primary={{ label: "Book a chair", href: "#/book" }}
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
          action={{ label: "Book a chair", href: "#/book" }}
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
// else has already taken, and the claim link that lets the customer come back.
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

// \`claim_token\` is a column the schema declares on a \`collect\` table, and the
// insert hands the whole row back — so the token arrives as part of the row
// rather than beside it. It is NULLABLE, because only a table that declared one
// has it: read it guarded, never destructured as required.
type Appointment = Row & { claim_token: string | null };

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a chair", href: "#/book" },
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
  const [claim, setClaim] = useState<string | null>(null);

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
      onSuccess: (row) => {
        toast.success("Booked — we'll call to confirm.");
        form.reset();
        if (!row.claim_token) return;
        setClaim(row.claim_token);
      },
      // The API separates the caller's fault from a server fault, so its own
      // message is worth showing instead of a generic failure.
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (claim) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-lg px-6 py-20 text-center motion-enter">
          <h1 className="text-3xl font-semibold tracking-tight">You're booked</h1>
          <p className="mt-3 text-muted-foreground">
            Keep this link — it is the only way back to this appointment.
          </p>
          <Button asChild className="mt-6">
            <Link to="/manage" search={{ t: claim }}>
              Manage your booking
            </Link>
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
// anything a customer might need to check or cancel. A plain contact form does
// not need one; nobody comes back to look at an enquiry.
//
// The token is read off the URL. A wrong token and a row that is not there
// answer IDENTICALLY, which is deliberate: a distinct "bad link" would tell
// somebody guessing which bookings exist.
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useClaimedRow, useCancelClaim, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
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
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a chair", href: "#/book" },
};

function Manage() {
  const { t: claim } = Route.useSearch();
  // The schema declares these two functions; they are named here, not guessed.
  const booking = useClaimedRow<Appointment>("booking_by_claim", claim);
  const cancel = useCancelClaim("cancel_booking_by_claim");

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
            <CardContent className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                {booking.data.status === "cancelled" ? "Cancelled" : "Confirmed"}
              </span>
              {booking.data.status !== "cancelled" && (
                <Button variant="destructive" onClick={onCancel} disabled={cancel.isPending}>
                  {cancel.isPending ? "Cancelling…" : "Cancel booking"}
                </Button>
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
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a chair", href: "#/book" },
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

2. RESPECT THE ACCESS LEVEL. The API enforces it — this is not a matter of taste.
   - \`display\` — you may LIST and READ it. A write returns 403.
   - \`collect\` — you may SUBMIT a form to it. A read returns 403. These rows are other
     visitors' submissions; never list them, never count them, never show "3 people booked".
   - \`user\` — PRIVATE PER MEMBER. Signed in, they read and write only their OWN rows;
     signed out, both return 401. Build the signed-in view AND a sign-in prompt.
   - \`feed\` — SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in
     member writes rows that become theirs. Signed out, both return 401.
   - \`admin\` — SHARED, ROLE-WRITABLE. Anyone signed in reads it; only a member whose role
     the table names in \`writeRoles\` may write. Anyone else gets 403 with \`code: "role"\`.

3. THE KIT FOR EVERY CONTROL, imported from "@/components/ui/<name>". Never hand-roll a
   button, input, select, checkbox or dialog. Under that path these exist and nothing
   else does:
   ${UI_COMPONENTS.join(", ")}.
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

7. A COLUMN NAMED FOR A PICTURE HOLDS A URL STRING. \`photo\`, \`image_url\`, \`avatar\`,
   \`logo\`, \`cover\`, \`hero_image\` and the like are ordinary text columns whose value is a
   path like "/u/<slug>/<hash>.jpg". Render one as a plain
   \`<img src={row.photo} alt="" className="..." />\`.
   ALWAYS GUARD IT: on a \`display\` table the owner fills these in after the build, so
   the value is often empty, and \`<img src="">\` renders as a broken image on a brand-new
   site. Write \`{row.photo ? <img .../> : <div className="..." />}\` — an image or a
   placeholder box, never a broken one.

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
    \`useClaimedRow("get_booking", token)\` reads one row by its claim token and
    \`useCancelClaim("cancel_booking")\` cancels it. Both take the FUNCTION NAME the schema
    declared, not a table.
    **Only build the manage page if the schema actually declares those functions** —
    check the digest. If it does not, the confirmation screen is the end of the flow, and
    that is a complete site rather than a broken one.
    When it does: \`useCreateRow\` resolves to the created ROW, so read the token off the
    column the schema publishes it in and put it in the link
    (\`/manage?t=\${row.claim_token}\`). **Never annotate a mutation callback's parameter.**
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

## Styling

Tailwind v4 with semantic tokens: bg-background, text-foreground, bg-card, text-muted-foreground,
border-border, bg-primary, text-destructive. A raw bg-slate-900 breaks dark mode. Also available:
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
  as "not yours" and say so gently.
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
        description: "One entry per route file. Must include index.tsx.",
        items: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: 'Path under src/routes/, e.g. "index.tsx" or "menu.tsx". No leading directories.',
            },
            source: { type: "string", description: "The complete .tsx source for that route file." },
          },
          required: ["path", "source"],
        },
      },
      notes: {
        type: "string",
        description: "Anything the brief asked for that was left out, and why. Empty if nothing was.",
      },
    },
    required: ["pages"],
  },
};

export const ACCESS_NOTE = {
  display: "visitors READ it. List it, show it, search it. Writing to it returns 403.",
  collect: "visitors WRITE to it. Submit a form. Reading it returns 403 — never list these rows.",
  user: "PRIVATE PER MEMBER. Signed in, a member reads and writes only their OWN rows; signed out, both return 401. Build the signed-in view AND a sign-in prompt for when there is no member.",
  feed: "SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in member writes rows that become theirs. Signed out, both return 401.",
  admin: "SHARED, ROLE-WRITABLE. Anyone signed in reads it; only a member whose role is 'admin' (or one this table names in writeRoles) may write. A write by anyone else returns 403 with code 'role'.",
};

/** The tables, exactly as they exist, in the least ambiguous form we can put them. */
export function schemaDigest(spec) {
  const tables = (spec && Array.isArray(spec.tables) ? spec.tables : []).filter((t) => t && t.name);
  if (!tables.length) return "(the schema declares no tables)";
  return tables.map((t) => {
    const access = String(t.access || "collect").toLowerCase();
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
      "TABLE " + t.name + " — access \"" + access + "\": " + (ACCESS_NOTE[access] || ACCESS_NOTE.collect),
      "  columns: " + (described.length ? described.join(" · ") : "(none)"),
    ];
    if (access === "display") {
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
    return lines.join("\n");
  }).join("\n\n");
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

export function pagesPrompt(brief, spec, brand) {
  const name = String(brand || "").trim();
  return "Build the pages for this site.\n\nBRIEF\n" + String(brief || "").trim() +
    (name ? "\n\nTHE SITE IS CALLED\n" + name + " — use it as the heading; it is already the page title." : "") +
    "\n\nTHE SCHEMA THAT EXISTS\n" + schemaDigest(spec);
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
export function validatePages(input) {
  const problems = [];
  const pages = [];
  const seen = new Set();
  const raw = (input && Array.isArray(input.pages)) ? input.pages : [];
  if (raw.length > MAX_PAGES) problems.push("More than " + MAX_PAGES + " pages were written; only the first " + MAX_PAGES + " were kept.");
  for (const p of raw.slice(0, MAX_PAGES)) {
    const source = p && typeof p.source === "string" ? p.source : "";
    if (!source.trim()) continue;
    const path = cleanPath(p.path);
    if (!path) { problems.push('"' + String(p && p.path).slice(0, 60) + '" is not a route file name — use something like index.tsx or menu.tsx.'); continue; }
    if (seen.has(path)) { problems.push(path + " was written twice; only the first was kept."); continue; }
    if (source.length > MAX_PAGE_CHARS) { problems.push(path + " is over " + MAX_PAGE_CHARS + " characters — split it or cut it down."); continue; }
    if (!/createFileRoute\s*\(/.test(source)) { problems.push(path + " does not export a Route — every page needs createFileRoute(...)."); continue; }
    seen.add(path);
    pages.push({ path, source });
  }
  if (pages.length && !seen.has("index.tsx")) problems.push("There is no index.tsx, so the site has no home page.");
  const notes = (input && typeof input.notes === "string") ? input.notes.trim().slice(0, 600) : "";
  return { pages, notes, problems };
}

// Reads the generated source for the mistakes that compile cleanly and then fail
// at runtime — a page that 403s against its own API looks perfect until it is
// loaded. Deliberately high-precision: every rule here is checked against the
// schema, so a hit is always a real defect, never a style opinion.
export function lintPages(pages, spec) {
  const problems = [];
  const tables = new Map();
  for (const t of (spec && Array.isArray(spec.tables) ? spec.tables : [])) {
    if (t && t.name) tables.set(String(t.name).toLowerCase(), t);
  }
  const ui = new Set(UI_COMPONENTS);
  const say = (path, msg) => problems.push(path + ": " + msg);
  const memberTables = [...tables.values()].filter((t) => needsMember(t.access));

  for (const { path, source } of pages) {
    // Strip comments and string literals before pattern-matching, so a rule in a
    // doc comment is not reported as the code doing it.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    if (/\b(?:fetch|XMLHttpRequest)\s*\(/.test(code) || /\baxios\b/.test(code)) {
      say(path, "calls fetch directly. Read with useRows and write with useCreateRow from @/lib/rows — no fetch code in a page.");
    }
    if (/@tanstack\/react-form/.test(code)) {
      say(path, "imports @tanstack/react-form. shadcn's Form components only speak to react-hook-form; use useForm from react-hook-form with zodResolver.");
    }
    // Editing and deleting are allowed now, but ONLY on a member's own rows —
    // so a page that offers them without a member has nothing to scope by and
    // the API answers 401.
    const editsRows = /\buseUpdateRow\b|\buseDeleteRow\b/.test(code);
    if (editsRows && !/\buseMember\b/.test(code)) {
      say(path, "calls useUpdateRow/useDeleteRow without useMember(). Only a signed-in member can change a row, and only their own — put the edit UI behind a sign-in.");
    }
    if (editsRows && !memberTables.length) {
      say(path, "calls useUpdateRow/useDeleteRow, but this schema has no member table. `collect` and `display` rows have no owner and can never be edited from a page.");
    }

    for (const m of code.matchAll(/from\s+"@\/components\/ui\/([a-z0-9-]+)"/gi)) {
      if (!ui.has(m[1].toLowerCase())) say(path, 'imports "@/components/ui/' + m[1] + '", which does not exist. Available: ' + UI_COMPONENTS.join(", ") + ".");
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
    // separately: `feed` and `admin` serve reads and refuse writes, so flagging
    // a read of one would be reporting a defect that does not exist — and every
    // problem reported here costs a paid repair pass.
    // A member-scoped table without useMember() renders a permanent 401 to a
    // signed-out visitor and looks like a broken page rather than a locked one.
    for (const m of code.matchAll(/\buseRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && needsMember(t.access) && !/\buseMember\b/.test(code)) {
        say(path, 'reads "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401, so the page must offer a sign-in rather than an error.');
      }
      if (!t) say(path, 'reads table "' + m[1] + '", which the schema does not declare.');
      // A member table is handled by the rule above: it is readable, just not
      // anonymously. Saying both would report one page twice and pay for a
      // repair pass to fix a problem that was already described.
      else if (!canReadAccess(t.access) && !needsMember(t.access)) {
        say(path, 'lists "' + m[1] + '", which is access "' + t.access + '" — reading it returns 403: ' + whyNotReadable(t.access) + '.');
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
      if (t && needsMember(t.access) && !/\buseMember\b/.test(code)) {
        say(path, 'reads one row of "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401.');
      } else if (t && !canReadAccess(t.access) && !needsMember(t.access)) {
        say(path, 'reads one row of "' + m[1] + '", which is access "' + t.access + '" — reading it returns 403: ' + whyNotReadable(t.access) + '.');
      }
    }
    for (const m of code.matchAll(/\buseCreateRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'writes to table "' + m[1] + '", which the schema does not declare.');
      // A member table accepts writes from someone signed in — that is the whole
      // point of the level — so the question is whether the page has a member,
      // not whether the table is writable.
      else if (needsMember(t.access)) {
        if (!/\buseMember\b/.test(code)) {
          say(path, 'writes to "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401, so the form must be behind a sign-in.');
        }
      } else if (!canWriteAccess(t.access)) {
        say(path, 'submits to "' + m[1] + '", which is access "' + t.access + '" — writing to it returns 403. Only a `collect` table accepts a write from a published site.');
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
 */
export const SITE_PAGES_MAX_TOKENS = 24000;

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
 * so it breaks even on the second build. The repair pass re-sends this exact
 * block within the same build, which makes it a guaranteed hit.
 *
 * The consequence to know about: a cache entry is keyed on the bytes, so ANY
 * edit to PAGE_RULES — including adding a component name — invalidates it and
 * the next call pays the write premium again. That is once per deploy that
 * touches the rules, against a saving on every build in between.
 */
export function pagesRequest({ brief, spec, brand, fix } = {}) {
  return {
    model: "claude-sonnet-5",
    max_tokens: SITE_PAGES_MAX_TOKENS,
    tools: [SITE_PAGES_TOOL],
    tool_choice: { type: "tool", name: "write_pages" },
    system: [{ type: "text", text: PAGE_RULES, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: fix
        ? repairPrompt(brief, spec, fix.pages, fix.problems, brand)
        : pagesPrompt(brief, spec, brand),
    }],
  };
}
