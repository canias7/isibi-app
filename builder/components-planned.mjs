// The next 500 — reusable components the kit does NOT have yet.
//
// Names only. These appear in docs/components.md WITHOUT a checkmark, so one
// list shows what exists and what is proposed.
//
// A name that gets built moves to the ticked half on its own: the generator
// reads the folder for what is done and subtracts it from this list, so an
// entry cannot sit here claiming to be missing once it is not.
//
// Grouped by the trade or the job it serves rather than by shape — which is how
// the built five hundreds are organised, and how a site actually needs them.
export const PLANNED = [
  // Charts, the real ones. The kit has ten hand-drawn in SVG for the small cases;
  // these are the recharts-backed set for a page that is genuinely a dashboard.
  "line-chart", "area-chart", "bar-chart", "stacked-bar", "grouped-bar",
  "pie-chart", "scatter-plot", "bubble-chart", "radar-chart", "funnel-chart",
  "waterfall-chart", "treemap", "sankey", "histogram", "box-plot",
  "candlestick", "bullet-chart", "gantt-chart", "heatmap-grid",
  "pareto-chart", "step-chart", "range-chart", "combo-chart", "chart-legend",
  "chart-export",

  // AI products, which is most of what gets built now.
  "prompt-box", "model-picker", "streaming-text", "thinking-indicator",
  "tool-call-card", "citation-list", "source-card", "token-meter",
  "regenerate-button", "response-rating", "prompt-library",
  "system-prompt-editor", "temperature-slider", "context-meter",
  "attachment-tray", "voice-input", "transcript-view", "suggestion-chips",
  "guardrail-note", "hallucination-warning", "model-compare",
  "conversation-branch",

  // Developer and API surfaces.
  "code-diff", "log-viewer", "terminal-output", "stack-trace", "env-var-row",
  "api-endpoint", "request-builder", "response-viewer", "status-code-badge",
  "curl-example", "sdk-tabs", "webhook-payload", "rate-limit-meter",
  "sandbox-toggle", "deprecation-note", "schema-viewer", "cron-expression",
  "feature-flag-row", "deploy-row", "build-log", "health-check-row",
  "release-notes",

  // Project and task management.
  "kanban-board", "kanban-column", "task-card", "subtask-list",
  "sprint-header", "burndown-chart", "milestone-row", "dependency-note",
  "blocker-badge", "effort-badge", "due-badge", "label-picker",
  "board-filter", "swimlane", "backlog-row", "epic-card", "story-points",
  "velocity-bar", "retro-column", "standup-note", "timeline-gantt",
  "workload-grid",

  // CRM and sales.
  "deal-card", "pipeline-board", "pipeline-stage", "lead-score",
  "quote-builder", "proposal-preview", "contact-merge", "forecast-bar",
  "win-loss-bar", "next-step-note", "call-log-row", "email-thread",
  "meeting-note", "territory-badge", "commission-row", "target-progress",
  "churn-risk", "upsell-hint", "account-health",

  // Money, properly. Beyond a price and a basket.
  "ledger-row", "balance-summary", "tax-breakdown", "currency-converter",
  "exchange-rate", "payment-schedule", "dunning-notice", "refund-row",
  "payout-summary", "reconciliation-row", "budget-bar", "expense-row",
  "mileage-log", "receipt-scan", "vat-note", "credit-note", "statement-row",
  "aging-report", "cashflow-bar", "profit-summary", "journal-entry",
  "bank-feed-row", "split-transaction", "recurring-charge", "fee-breakdown",
  "invoice-status",

  // Subscription businesses.
  "trial-banner", "upgrade-nudge", "feature-gate", "usage-alert",
  "cancel-flow", "downgrade-warning", "proration-note", "plan-switcher",
  "addon-row", "seat-buyer", "referral-card", "credit-balance",
  "overage-notice", "renewal-reminder", "win-back-offer",
  "pause-subscription", "gift-subscription", "annual-toggle",
  "price-lock-note", "grandfathered-badge",

  // Email and campaigns.
  "email-preview", "subject-tester", "send-schedule", "segment-builder",
  "ab-test-row", "open-rate", "click-map", "unsubscribe-note",
  "template-picker", "merge-tag", "preheader-input", "spam-score",
  "list-health", "drip-step", "campaign-card", "utm-builder",
  "landing-variant", "popup-timing", "suppression-row",

  // Analytics, past the summary numbers.
  "funnel-steps", "retention-table", "attribution-row", "event-stream",
  "segment-chip", "goal-card", "session-list", "path-flow", "bounce-note",
  "source-table", "device-split", "geo-table", "realtime-count",
  "anomaly-flag", "benchmark-bar", "forecast-line", "custom-report",

  // Stock and the warehouse.
  "stock-row", "bin-location", "pick-list", "barcode-input", "batch-row",
  "reorder-alert", "supplier-card", "purchase-order", "goods-in",
  "stock-count", "variance-row", "serial-lookup", "pallet-label",
  "shipment-row", "carrier-picker", "packing-list", "return-row",
  "warranty-row", "asset-tag", "depreciation-row", "transfer-order",
  "cycle-count",

  // HR and people operations.
  "leave-request", "holiday-balance", "payslip-row", "review-cycle",
  "goal-row", "one-to-one-note", "offboarding-checklist", "contract-row",
  "right-to-work", "absence-calendar", "headcount-bar", "org-search",
  "salary-band", "bonus-row", "pension-note", "training-record", "dbs-badge",
  "timesheet-row", "overtime-note", "rota-grid",

  // Field service — the trades, out on a job.
  "job-sheet", "engineer-route", "part-usage", "sign-off-pad", "defect-row",
  "checklist-photo", "van-stock", "callout-card", "quote-approval",
  "before-photo", "risk-assessment", "method-statement", "permit-row",
  "meter-reading", "warranty-claim", "follow-up-note", "travel-log",
  "site-access-note",

  // Restaurants and bars, past the menu.
  "table-map", "cover-count", "allergen-key", "wine-pairing", "tasting-menu",
  "tip-selector", "split-bill", "kitchen-ticket", "course-timing",
  "table-status", "waitlist-row", "reservation-note", "happy-hour-badge",
  "corkage-note", "set-menu", "dietary-filter", "table-turn",
  "service-charge", "bar-tab", "order-pad",

  // Retail and marketplaces.
  "seller-card", "bid-history", "escrow-note", "dispute-row",
  "shipping-label", "tracking-timeline", "buyer-protection", "counter-offer",
  "watchlist-row", "feedback-score", "listing-form", "bulk-price",
  "bundle-picker", "gift-message", "gift-wrap", "loyalty-points",
  "reward-tier", "referral-code", "store-credit", "price-match",
  "back-in-stock",

  // Travel.
  "flight-row", "itinerary-day", "baggage-note", "passenger-form",
  "seat-picker", "layover-badge", "currency-note", "hotel-row",
  "transfer-row", "excursion-card", "travel-insurance", "boarding-pass",
  "check-in-status", "fare-rules", "price-alert", "multi-city",
  "cabin-picker", "loyalty-number", "trip-summary", "trip-packing",
  "weather-strip", "visa-note",

  // Teaching.
  "lesson-nav", "quiz-question", "answer-feedback", "certificate",
  "flashcard", "assignment-card", "grade-badge", "rubric-table",
  "submission-row", "discussion-prompt", "attendance-grid", "course-outline",
  "video-lesson", "cohort-card", "office-hours", "peer-review",
  "plagiarism-note", "credit-hours", "prerequisite-note",

  // Health and care.
  "appointment-summary", "symptom-list", "medication-row", "dosage-note",
  "vitals-row", "allergy-badge", "patient-referral", "care-plan",
  "triage-badge", "consent-form", "prescription-row", "immunisation-row",
  "pain-scale", "next-of-kin", "gp-details", "test-result", "waiting-time",

  // Legal and compliance.
  "clause-list", "redline-diff", "version-compare", "signature-request",
  "retention-note", "dpa-summary", "cookie-table", "data-request",
  "policy-accept", "disclosure-note", "conflict-check", "matter-row",
  "time-entry", "engagement-letter", "court-date", "evidence-row",
  "chain-of-custody", "privilege-badge",

  // Property, past the listing card.
  "floor-plan", "viewing-slot", "offer-status", "mortgage-calculator",
  "epc-badge", "tenure-note", "chain-status", "valuation-row", "tenancy-row",
  "deposit-note", "inventory-check", "maintenance-request", "landlord-card",
  "lease-summary", "council-tax-band", "rent-schedule",

  // Fitness and wellbeing.
  "workout-row", "set-tracker", "pb-badge", "class-schedule", "body-metric",
  "streak-badge", "rest-timer", "exercise-card", "plan-week", "calorie-ring",
  "water-tracker", "sleep-bar", "mood-check", "habit-grid", "coach-note",
  "injury-note",

  // Cars.
  "service-history", "mot-badge", "finance-quote", "part-row", "tyre-spec",
  "valuation-badge", "test-drive-slot", "px-estimate", "warranty-plan",
  "fuel-log", "damage-diagram", "reg-lookup", "spec-compare", "dealer-card",

  // Events, past the ticket.
  "seat-map", "tier-picker", "guest-list", "check-in-scanner", "badge-print",
  "session-picker", "speaker-card", "sponsor-band", "agenda-track",
  "room-capacity", "live-poll", "qa-queue", "networking-card",
  "exhibitor-row", "ticket-transfer", "door-list", "run-sheet",

  // Social and community.
  "post-composer", "feed-item", "follow-button", "profile-header",
  "badge-wall", "leaderboard", "karma-score", "report-dialog", "block-list",
  "thread-sort", "poll-post", "repost-button", "bookmark-button",
  "story-ring", "group-card", "event-invite", "dm-request", "mute-note",
  "trending-list", "hashtag-chip",

  // Video and audio, past the embed.
  "video-player", "waveform", "transcript-line", "chapter-list",
  "subtitle-track", "playback-speed", "scrubber", "poster-picker",
  "clip-trimmer", "volume-slider", "picture-in-picture", "quality-picker",
  "cast-button", "live-badge", "viewer-count", "playlist-row",
  "audio-recorder",

  // Motion and gesture. Each has to earn its bytes — the kit's rule is that an
  // effect needing an animation runtime is usually an effect that does not.
  "parallax", "tilt-card", "count-up", "typewriter", "confetti", "ripple",
  "drag-list", "sortable-list", "swipe-actions", "resize-handle",
  "pull-to-refresh", "infinite-scroll", "snap-carousel", "magnetic-button",
  "flip-card", "stagger-list",

  // App shell and editor furniture.
  "split-pane", "dock", "drawer-stack", "mega-menu", "sidebar-collapse",
  "sticky-shrink", "breadcrumb-dropdown", "workspace-switcher", "app-shell",
  "panel-group", "floating-toolbar", "context-panel", "zoom-controls",
  "layer-list", "property-panel",
];
