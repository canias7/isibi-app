// The next 500 — reusable components the kit does NOT have yet.
//
// Names only. These appear in docs/components.md WITHOUT a checkmark, so one
// list shows what exists and what is proposed. A name that gets built moves to
// the ticked half on its own: the generator reads the folder for what is done
// and subtracts it, so an entry cannot sit here claiming to be missing once it
// is not.
//
// THE BAR, and the first draft of this list failed it. Every entry has to be:
//   1. wanted by three UNRELATED trades — not a barber shop thing
//   2. a distinct SHAPE, not the same shape under a different noun
//   3. a component, not a feature with a data model behind it
//   4. free of any one country's rules
//
// The draft this replaces had 51 entries ending in `-row` that were ONE
// labelled record row renamed 51 times, 33 `-note` entries that were a sentence
// in a box, 11 that only mean anything in the UK (MOT, DBS, EPC, council tax),
// and a dozen that were whole applications wearing a component's coat — a
// mortgage calculator, a floor plan, a segment builder. Grouped by SHAPE here
// rather than by trade, which is the difference.
export const PLANNED = [
  // Charts, the real ones. The kit has ten hand-drawn in SVG for the small
  // cases; these are the library-backed set for a page that is a dashboard.
  "line-chart", "area-chart", "bar-chart", "stacked-bar", "grouped-bar",
  "pie-chart", "scatter-plot", "bubble-chart", "radar-chart", "funnel-chart",
  "waterfall-chart", "treemap-chart", "histogram", "box-plot", "bullet-chart",
  "step-chart", "range-chart", "combo-chart", "chart-legend", "chart-export",
  "trend-card", "distribution-bar", "quantile-bar", "sparkline-grid",
  "comparison-chart",

  // Rich text and editing. Every product that lets somebody write anything
  // needs these, and not one of them exists yet.
  "rich-text", "markdown-editor", "markdown-preview", "mention-textarea",
  "emoji-picker", "link-editor", "code-editor", "format-toolbar", "block-menu",
  "slash-menu", "drag-handle", "selection-toolbar", "suggestion-mode",
  "version-history", "comment-anchor", "table-editor", "paste-clean",
  "focus-mode", "dirty-indicator", "revert-button", "draft-badge",
  "lock-indicator", "find-replace", "char-limit-ring", "undo-redo",

  // Pickers. A picker is the same problem every time and is got wrong every
  // time, which is exactly what a kit is for.
  "color-picker", "icon-picker", "month-picker", "year-picker", "week-picker",
  "quarter-picker", "time-range", "cron-builder", "number-scrubber",
  "unit-toggle", "aspect-picker", "font-picker", "size-picker",
  "spacing-picker", "radius-picker", "async-select", "cascading-select",
  "dependent-select", "tree-select", "transfer-list", "dual-list",
  "search-select", "tag-select", "slider-input", "stepper-input",

  // Lists and collections, past the plain one.
  "virtual-list", "grouped-list", "nested-list", "tree-view", "tree-item",
  "checkbox-tree", "reorderable-grid", "list-toolbar", "list-density",
  "two-line-row", "three-line-row", "swipeable-row", "selectable-list",
  "multi-column-list", "chip-list", "timeline-vertical", "timeline-horizontal",
  "shelf", "cluster", "rail",

  // Tables, past the ones the fourth hundred added.
  "pivot-table", "frozen-columns", "column-resize", "column-reorder",
  "cell-editor", "cell-badge", "cell-sparkline", "row-detail", "row-group",
  "footer-summary", "table-export", "table-search", "column-filter",
  "multi-sort", "table-settings", "comparison-columns", "matrix-table",
  "spreadsheet-grid", "compare-table", "feature-matrix",

  // Forms, the parts still missing.
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

  // Code and technical display. Any product with an API, a log or a config
  // file — which is most of them.
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

  // Motion and gesture. Each has to earn its bytes — the kit's rule is that an
  // effect needing an animation runtime is usually an effect that does not.
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

  // Navigation, past the second hundred's set.
  "cursor-pagination", "load-more", "jump-to", "section-nav", "tab-overflow",
  "nav-badge", "back-to-list", "related-nav", "sitemap-list", "nav-search",
  "recent-nav", "pinned-nav", "nav-group", "scroll-spy", "snap-sections",

  // Search, past the fourth hundred's set.
  "search-scope", "search-history", "saved-search", "query-builder",
  "filter-tree", "facet-range", "multi-sort-picker", "result-preview",
  "did-you-mean", "search-shortcut", "instant-results", "search-empty",

  // Collaboration. Two people in one document is a shape, not a vertical.
  "presence-bar", "live-cursor", "typing-dots", "comment-pin",
  "resolve-thread", "mention-badge", "share-invite", "viewer-list",
  "edit-lock", "activity-dot", "follow-changes", "co-edit-note",
  "conflict-merge", "change-request",

  // Sharing and getting things out.
  "share-sheet", "embed-code", "qr-code", "download-menu", "export-format",
  "print-preview", "permalink", "short-link", "email-share", "copy-link",
  "social-preview", "export-progress",

  // Notifications, past the fourth hundred's set.
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

  // Loading and absence.
  "shimmer", "placeholder-grid", "skeleton-list", "skeleton-form",
  "lazy-boundary", "content-placeholder", "load-error", "partial-list",
  "stale-badge", "refresh-pill",

  // Accessibility, past the fifth hundred's set.
  "caption-toggle", "transcript-toggle", "high-contrast", "reduce-motion",
  "reading-guide", "screen-reader-note", "keyboard-map", "alt-text-field",
  "contrast-check", "tab-order-note",

  // Trust and safety. Any site that accepts something from a stranger.
  "report-reason", "moderation-queue", "appeal-form", "strike-badge",
  "age-gate", "content-warning", "blur-sensitive", "source-label",
  "spam-note", "trust-score",

  // Asking people things.
  "survey-card", "question-nav", "likert-row", "ranking-list",
  "open-question", "csat-face", "effort-score", "exit-survey", "poll-result",
  "vote-bar", "sentiment-chip", "response-summary",

  // Settings, past the fourth hundred's set.
  "preference-group", "reset-defaults", "import-settings", "export-settings",
  "shortcut-row", "theme-picker", "density-preference", "unit-preference",
  "startup-page", "advanced-toggle",

  // Typography and long-form.
  "drop-cap", "pull-quote", "footnote", "sidenote", "definition",
  "table-of-contents", "anchor-heading", "read-progress", "byline-compact",
  "kicker",

  // Plumbing — headless, no markup of their own, and every app rebuilds them.
  "portal", "click-outside", "scroll-lock", "drop-zone", "drag-preview",
  "breakpoint-badge", "safe-area", "offline-queue", "idle-note",
  "clipboard-history", "hotkey-badge", "media-query-note",
  // Onboarding and product-led growth, the generic half.
  "feature-tour", "whats-new-dot", "upgrade-badge", "usage-nudge", "empty-cta",
  "sample-toggle", "reset-demo", "checklist-dot",

  // Shaping a set of data, whatever the data is.
  "date-preset", "relative-date", "filter-preset", "group-by-picker",
  "aggregate-picker", "bucket-picker", "top-n-picker",

  // Keyboard and power users.
  "command-item", "command-group", "key-sequence", "keyboard-tip",
  "focus-list",

  // Validation, past the error summary.
  "error-summary-link", "field-warning", "async-validation",
  "uniqueness-check", "format-hint",

  // Clocks and elapsed time.
  "timezone-clock", "world-clock", "working-hours", "availability-toggle",
  "snooze-until", "deadline-bar", "elapsed-timer", "stopwatch",
  "countdown-ring",

  // Is this data any good?
  "completeness-bar", "missing-fields", "data-freshness", "outlier-flag",
  "duplicate-badge", "quality-score",

  // Getting files in, past the drop zone.
  "chunked-upload", "upload-queue", "paste-image", "camera-capture",
  "scan-document", "file-preview", "folder-tree", "folder-path",

  // Location without a map provider.
  "coordinate-input", "radius-slider", "place-search",

  // Layout, the pieces still missing.
  "aspect-box", "full-bleed", "edge-fade", "gutter", "sidebar-right",
  "three-col", "content-width", "sticky-columns", "sticky-footer",

  // Money as a SHAPE, not as accounting.
  "amount-input", "currency-amount", "tax-toggle", "discount-input",
  "payment-picker", "split-amount",
];
