// GENERATED-ADJACENT: the name of every component in the kit.
//
// A LEAF, ON PURPOSE, AND THAT IS THE WHOLE REASON THIS FILE EXISTS. It lived
// as an 818-line literal inside `page-gen.mjs`, which imports `site-plan.mjs` —
// so the designer's tool could not offer the full kit without a cycle, and the
// list it offered instead was 279 names measured off 324 brochure pages.
//
// Imported by BOTH now: `page-gen.mjs` tells the page writer what exists, and
// `site-plan.mjs` builds the designer's menu from it. One definition, so the
// two can never disagree about what a real component is.
//
// Nothing is imported here. Keep it that way — a cycle is what it is for.

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
