// The third 500 — proposed components, none of which exists and none of which
// is already on another list. Checked mechanically against the union of the
// 1,057 built, the 500 in components-planned.mjs and the 856 in
// components-next.mjs: 1,868 claimed names, 93 collisions caught and dropped.
//
// THESE ARE MECHANICS, NOT TRADES, and that is the whole thesis of the list.
// The two lists before it are organised by industry — restaurant, clinic,
// property, salon — and 62 such groups are now spoken for. Another pass at
// trades produces the failure components-next.mjs already documents: 51 '-row'
// entries that were one labelled record row renamed 51 times. The claimed
// namespace is also saturated exactly where you would expect (77 '-badge',
// 62 '-picker', 56 '-card', 53 '-list'), so a new trade noun almost always
// lands on a shape that exists.
//
// What is genuinely missing is the layer underneath: what a page does when the
// connection drops, when two people edit at once, when the visitor wants to
// undo, when a number needs a unit, when a list is too long to show. Those are
// wanted by every trade at once, which is the first rule on the original list,
// and they are the shapes a model reliably writes inline because no component
// offers them.
//
// The bar is unchanged from components-next.mjs: are the PROPS different, and
// would the model otherwise hand-write that layout? Plus the original four —
// wanted by three unrelated trades, a distinct shape, a component rather than a
// feature with a data model, and free of any one country's rules.
export const THIRD_PLANNED = {
  "Sync, offline and conflict": [
    "conflict-diff", "conflict-choice", "pending-changes", "optimistic-note", "reconnect-strip",
    "last-synced", "write-blocked", "read-only-mode", "draft-recovery", "unsaved-guard",
    "version-conflict", "background-job", "job-progress", "job-failed", "resume-upload",
    "partial-save", "retry-countdown", "connection-quality", "sync-conflict-list", "retry-budget",
    "write-queue",
  ],

  "Undo, history and revisions": [
    "undo-stack", "action-history", "revert-panel", "snapshot-list", "restore-point",
    "diff-inline", "blame-gutter", "revision-slider", "change-summary", "who-changed",
    "rollback-confirm", "draft-vs-live", "autosave-history", "merge-preview", "history-scrub",
  ],

  "Selection and bulk mechanics": [
    "range-select", "cross-page-selection", "invert-selection", "selection-limit", "select-scope",
    "marquee-select", "selection-tray", "pick-remaining",
  ],

  "Drag, drop and reorder": [
    "drop-target", "reorder-list", "drop-indicator", "sortable-grid", "drag-autoscroll",
    "nest-indent", "move-to-menu", "drag-disabled-note", "reorder-buttons", "drop-rejected",
  ],

  "Keyboard and focus": [
    "shortcut-hint", "key-cap", "shortcut-sheet", "roving-list", "access-key-badge",
    "kbd-chord", "focus-return", "shortcut-conflict",
  ],

  "Duration, interval and recurrence": [
    "duration-input", "interval-picker", "lead-time-input", "buffer-time", "cutoff-time",
    "turnaround-note", "time-since", "working-hours-input", "overlap-warning", "grace-window",
    "time-budget", "schedule-preview", "next-occurrence", "deadline-note", "slippage-note",
  ],

  "Measurement, units and conversion": [
    "dimension-input", "weight-input", "temperature-input", "ratio-input", "tolerance-field",
    "min-max-field", "measurement-summary", "size-chart-row", "capacity-input", "distance-input",
    "area-input", "unit-mismatch",
  ],

  "Numbers, comparison and decision aids": [
    "target-vs-actual", "benchmark-bar", "percentile-note", "confidence-range", "estimate-band",
    "score-breakdown", "tradeoff-slider", "what-if-toggle", "scenario-tabs", "sensitivity-note",
    "threshold-marker", "goal-gauge", "streak-counter", "running-total", "variance-note",
    "break-even-note", "payback-note",
  ],

  "Text, reading and truncation": [
    "read-more", "glossary-term", "footnote-ref", "footnote-list", "abbreviation",
    "quote-attribution", "summary-toggle", "pronunciation-hint", "key-points", "text-scale",
    "line-focus", "column-reader",
  ],

  "Errors, recovery and support": [
    "error-retry", "error-detail-toggle", "not-found-panel", "permission-denied", "maintenance-panel",
    "degraded-note", "report-problem", "error-reference", "support-handoff", "known-issue",
    "recovery-steps", "contact-fallback", "partial-outage",
  ],

  "Permissions and sharing": [
    "share-scope", "link-permissions", "access-summary", "who-can-see", "pending-invite",
    "transfer-ownership", "leave-confirm", "visibility-toggle", "embargo-note", "shared-with-list",
    "request-access", "access-expiry", "guest-note", "scope-summary",
  ],

  "Onboarding and guidance": [
    "setup-task", "first-run-panel", "tip-bubble", "sample-data-note", "skip-for-now",
    "progress-nudge", "completion-meter", "what-changed", "guided-step", "try-it-panel",
    "dismissed-tips", "first-value-note",
  ],

  "Search and retrieval": [
    "search-operators", "zero-results", "facet-list", "query-chips", "typeahead-list",
    "search-within", "match-context", "sort-direction", "search-tips", "query-explain",
  ],

  "Forms, deeper mechanics": [
    "field-dependency", "conditional-section", "validation-summary", "inline-hint", "error-anchor",
    "prefill-note", "clear-form", "form-draft", "required-legend", "field-mask",
    "paste-parse", "field-history", "answer-review", "branching-note", "autofill-conflict",
  ],

  "Layout mechanics": [
    "sticky-header", "scroll-shadow", "overflow-fade", "collapsible-panel", "fit-to-width",
    "print-break", "width-preset", "safe-area-pad", "back-to-top", "anchor-offset",
  ],

  "Tables, deeper": [
    "column-pin", "row-expand", "footer-totals", "cell-error", "table-density",
    "column-chooser", "frozen-corner", "row-number", "table-loading", "cell-tooltip",
    "column-summary", "row-compare", "table-caption", "column-order", "cell-overflow",
  ],

  "Money mechanics": [
    "price-breakdown", "fee-line", "rounding-line", "currency-note", "exchange-rate-note",
    "amount-in-words", "payment-schedule", "instalment-line", "balance-due", "overpayment-note",
    "credit-applied", "deposit-line", "refund-line", "surcharge-note", "tip-picker",
    "split-evenly", "who-owes", "settle-up", "part-payment",
  ],

  "Files and documents": [
    "file-preview-pane", "file-version", "file-conflict", "breadcrumb-path", "file-type-note",
    "scan-status", "checksum-note", "download-progress", "zip-contents", "page-thumbnails",
    "document-outline", "signature-request", "redaction-note", "watermark-note", "ocr-note",
  ],

  "Images and media handling": [
    "crop-box", "rotate-control", "compare-slider", "zoom-pan", "exposure-note",
    "alt-text-warning", "media-duration", "caption-track", "waveform-scrub", "thumbnail-picker",
    "media-error", "autoplay-note", "picture-in-picture", "loop-toggle", "volume-control",
  ],

  "Notifications and attention": [
    "snooze-picker", "quiet-hours", "channel-preference", "seen-by", "acknowledge-button",
    "reminder-set", "follow-toggle", "watch-count",
  ],

  "Trust, safety and moderation": [
    "moderation-queue-item", "appeal-status", "age-rating-note", "verified-claim", "dispute-note",
    "takedown-note", "safety-tips", "block-list", "mute-duration",
  ],

  "Status and lifecycle": [
    "lifecycle-bar", "state-machine-note", "blocked-by", "waiting-on", "handover-note",
    "sla-clock", "escalation-ladder", "queue-position", "eta-band", "throttle-note",
    "cooldown-note",
  ],

  "Comparison and choice": [
    "recommended-flag", "why-this-note", "eliminate-option", "shortlist-tray", "difference-only",
    "compatibility-note", "requirement-check",
  ],

  "Data quality and import": [
    "duplicate-warning", "merge-records", "confidence-note", "source-attribution", "last-verified",
    "sample-preview", "row-error-list", "fix-suggestion", "skip-row-note",
  ],

  "Accessibility, deeper": [
    "reduced-motion-note", "contrast-toggle", "focus-visible-note", "landmark-nav", "announce-region",
    "text-only-toggle", "pause-motion",
  ],

  "Print and export mechanics": [
    "export-scope", "page-header-footer", "print-range", "export-history", "share-as-link",
    "embed-snippet", "qr-handoff",
  ],

  "AI assistance surfaces": [
    "ai-suggestion", "ai-explain", "ai-confidence", "ai-sources", "ai-regenerate",
    "ai-edit-diff", "ai-disclosure", "prompt-field", "ai-feedback", "ai-limit-note",
    "draft-with-ai", "ai-scope-picker", "ai-undo", "model-note", "generation-history",
    "ai-error-note",
  ],

  "Presence and collaboration": [
    "cursor-label", "editing-lock", "annotation-pin", "resolve-toggle", "who-is-here",
  ],

  "Approvals and sign-off": [
    "approval-request", "sign-off-row", "approver-list", "reject-reason", "delegate-approval",
    "approval-deadline", "countersign", "approval-history", "approval-quorum", "recall-request",
  ],

  "Templates and reuse": [
    "template-picker", "save-as-template", "template-variables", "template-preview", "duplicate-options",
    "preset-menu", "default-set", "apply-to-many", "template-diff", "starter-gallery",
  ],

  "Tagging and taxonomy": [
    "tag-cloud", "category-tree", "taxonomy-picker", "label-manager", "tag-merge",
    "suggested-tags", "tag-rename", "tag-scope", "untagged-note",
  ],

  "Pagination and loading": [
    "infinite-sentinel", "page-size", "jump-to-page", "partial-list-note", "lazy-section",
    "list-end", "loading-more",
  ],

  "Filters, deeper": [
    "filter-group", "exclude-filter", "filter-count", "clear-filters", "filter-summary",
    "numeric-filter", "boolean-filter", "multi-select-filter", "filter-drawer", "quick-filters",
    "filter-conflict",
  ],

  "Place, without a provider": [
    "radius-input", "distance-note", "directions-link", "opening-status", "travel-time-note",
    "nearby-list", "region-picker", "location-consent", "service-area-note", "catchment-note",
  ],

  "Consent and privacy": [
    "consent-summary", "data-request", "retention-note", "purpose-list", "opt-out-row",
    "privacy-choice", "tracking-note", "export-my-data", "delete-my-data", "consent-history",
    "third-party-list", "lawful-basis-note",
  ],

  "Device and capability": [
    "orientation-note", "small-screen-note", "install-prompt", "camera-access", "location-access",
    "notification-access", "data-saver-note", "touch-hint", "clipboard-blocked", "fullscreen-toggle",
    "device-unsupported", "permission-prompt",
  ],

  "Automation and rules": [
    "rule-summary", "trigger-picker", "condition-row", "rule-preview", "rule-conflict",
    "rule-log", "rule-enabled", "run-now",
  ],

  "Wizards and multi-step": [
    "wizard-nav", "step-summary", "review-step", "save-and-exit", "resume-later",
    "step-validation", "branch-preview", "step-skipped", "wizard-exit-guard",
  ],

  "Number presentation": [
    "compact-number", "range-text", "approx-note", "significant-figures", "number-scale-note",
  ],

  "Identity and credentials": [
    "id-check-status", "trust-level", "badge-explainer", "credential-row", "credential-expiry",
    "identity-summary", "proof-upload", "verification-steps",
  ],

  "Feedback and rating mechanics": [
    "emoji-scale", "survey-progress", "free-text-followup", "response-rate", "rating-guidance",
    "rating-changed",
  ],

  "Stock and allocation mechanics": [
    "allocation-bar", "reserved-note", "lot-row", "expiry-batch", "reorder-point",
    "stock-move", "shrinkage-note", "count-sheet",
  ],

  "Comments and annotation mechanics": [
    "unresolved-count", "comment-draft", "reaction-summary", "thread-participants", "comment-permalink",
  ],

  "Capacity and queueing": [
    "slot-capacity", "overbooking-note", "staff-load", "utilisation-bar", "peak-note",
    "no-show-note", "walk-in-note",
  ],

  "Contact and address mechanics": [
    "contact-method-picker", "preferred-contact", "contact-verify", "do-not-contact", "alternate-contact",
    "address-validate", "delivery-note-field", "contact-card-compact",
  ],

  "Attachments and evidence": [
    "evidence-list", "photo-required-note", "capture-hint", "attachment-limit", "file-required",
    "before-after-upload", "annotation-upload", "receipt-upload",
  ],

  "Handover and shift work": [
    "handoff-summary", "shift-handover", "escalate-action", "priority-picker", "due-soon-note",
    "read-receipt", "batch-window", "confidence-bar", "language-fallback", "cost-estimate-note",
    "coverage-gap", "on-call-now",
  ],
};
