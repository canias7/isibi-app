// The SECOND thousand — proposed reusable components, none of which exist.
//
// Grouped by the WORLD a component belongs to rather than by shape, which is
// the difference from PLANNED above: the first thousand covered the shapes a
// page is made of (a list, a bar, a field), and what is left is the shapes a
// particular kind of business needs a page to have.
//
// THE SAME BAR APPLIES and the first draft of this list failed it, measured
// rather than eyeballed. Against the shipped kit (2.1% of names end in -note,
// 2.6% in -row), the draft was 11.7% -note and 8.9% -row — 117 sentences in a
// box and 89 copies of one labelled record. 92 notes and 89 rows were replaced
// with the distinct shape the need actually wants (a "-note" about buffers is
// a buffer FIELD; a "vitals-row" is a vitals STRIP) or dropped. It now reads
// 2.8% and 0%.
//
// Five country-specific entries went the same way (MOT → inspection-due, EPC →
// energy-rating, VAT number → tax-number-field, Gift Aid → tax-receipt-toggle,
// stamp duty → purchase-costs) — rule 4, and the exact category the header
// above says a previous draft was cleaned of. So did four that the header names
// outright as whole applications wearing a component's coat: a mortgage
// calculator, a floor plan, a spreadsheet formula bar, a yield calculator.
//
// Nothing here is built. These appear in docs/components.md under their group
// headings, unticked, below the first thousand.
export const NEXT_THOUSAND = {
  "Calendar and scheduling, deep": [
    "event-chip", "month-mini", "time-grid", "recurrence-editor", "repeat-caption",
    "lane-calendar", "resource-lanes", "slot-suggest", "double-book-warn", "buffer-field",
    "travel-gap", "calendar-legend", "event-popover", "quick-event", "week-numbers",
    "working-day-shade", "holiday-badge", "timezone-strip", "meeting-poll", "best-time-grid",
    "rsvp-bar", "invite-status", "reminder-picker", "agenda-empty", "add-to-calendar",
    "availability-rules", "closed-dates", "season-hours", "series-scope", "cancellation-window",
  ],

  "Catalogue and products": [
    "variant-matrix", "size-chart", "colour-swatch", "stock-level", "backorder-note",
    "preorder-badge", "product-gallery", "zoom-pane", "bundle-builder", "addon-list",
    "personalisation-field", "engrave-preview", "fit-guide", "material-badge", "care-icons",
    "warranty-badge", "price-history", "unit-price", "bulk-pricing", "quantity-break",
    "min-order-note", "sku-field", "barcode-display", "category-tile", "collection-header",
    "lookbook-grid", "shop-the-look", "recently-viewed", "new-in-badge", "last-chance-badge",
  ],

  "Cart and checkout": [
    "cart-drawer", "cart-badge", "cart-empty", "saved-for-later", "cart-upsell",
    "promo-field", "gift-toggle", "gift-message", "delivery-picker", "click-collect",
    "store-picker", "address-book", "checkout-steps", "express-pay-buttons", "order-notes",
    "substitution-pref", "invoice-toggle", "tax-number-field", "po-number-field", "delivery-window",
    "cutoff-countdown", "free-shipping-meter", "basket-merge-note", "price-changed-note", "out-of-stock-item",
    "quantity-stepper", "order-review", "place-order-bar",
  ],

  "Orders and fulfilment": [
    "order-card", "order-timeline", "tracking-input", "carrier-badge", "delivery-eta",
    "proof-of-delivery", "return-window", "return-reason", "return-label", "refund-status",
    "exchange-picker", "partial-shipment", "pick-list", "pack-checklist", "dispatch-doc",
    "label-print", "manifest-table", "failed-delivery", "redelivery-picker", "collection-code",
    "damage-report", "cancel-window", "address-correct-note", "delivery-instructions", "leave-safe-consent",
  ],

  "Subscriptions and billing": [
    "plan-compare", "seat-counter", "included-usage", "overage-note", "billing-cycle-toggle",
    "proration-preview", "pause-subscription", "cancel-flow", "winback-offer", "dunning-banner",
    "card-expiry-warn", "billing-history", "invoice-status", "credit-note-doc-line", "billing-contact",
    "tax-id-field", "receipt-list", "payment-retry", "grace-period-note", "downgrade-warn",
    "upgrade-preview", "trial-banner", "trial-countdown", "policy-summary",
  ],

  "Messaging": [
    "thread-list", "thread-item", "new-since-divider", "message-group", "day-divider",
    "read-receipt", "delivery-tick", "reaction-bar", "reaction-picker", "reply-quote",
    "forward-header", "edited-note", "deleted-stub", "pinned-bar", "mention-autocomplete",
    "voice-note", "link-unfurl", "attachment-bubble", "group-header", "member-count",
    "mute-badge", "archive-swipe", "jump-latest", "new-messages-pill", "translate-toggle",
    "spam-fold", "message-search", "starred-messages", "disappearing-note",
  ],

  "Email client": [
    "inbox-item", "sender-chip", "subject-line", "preview-text", "thread-collapse",
    "quote-fold", "compose-bar", "recipient-field", "cc-toggle", "attachment-warn",
    "undo-send-bar", "schedule-send", "snoozed-until-chip", "label-chips", "sweep-actions",
    "unsubscribe-bar", "phishing-banner", "external-sender-tag", "out-of-office-banner", "reply-all-warn",
  ],

  "Social and community": [
    "post-composer", "feed-item", "repost-header", "like-count", "follow-button",
    "follower-stat", "profile-banner", "verified-tick", "handle-field", "bio-editor",
    "story-ring", "poll-composer", "hashtag-chip", "trend-item", "suggested-follow",
    "blocked-person", "community-rules", "join-gate", "member-intro", "rsvp-summary",
    "audience-picker", "quote-post", "thread-composer", "draft-stack", "engagement-stats",
    "share-count", "close-circle-badge", "crosspost-targets", "mute-words", "feed-preference",
  ],

  "Comments and discussion": [
    "nested-thread", "comment-composer", "collapse-thread", "load-more-replies", "best-comment",
    "op-badge", "moderator-badge", "thread-lock-bar", "sort-comments", "comment-count",
    "inline-reply", "upvote-pair", "controversial-fold", "edit-history", "quote-reply",
    "live-comments", "thread-depth-cap", "continue-thread",
  ],

  "Editor chrome": [
    "floating-format-bar", "insert-menu", "block-handle", "drag-rail", "outline-panel",
    "word-count-live", "focus-mode-toggle", "typewriter-scroll", "footnote-composer", "link-popover",
    "table-inserter", "image-block", "embed-block", "callout-block", "toggle-block",
    "divider-menu", "snippet-picker", "template-gallery", "version-list", "restore-point",
    "track-changes-bar", "suggestion-bubble", "accept-reject-pair", "comment-margin", "autosave-note",
    "style-picker", "find-replace-bar", "paste-clean-note", "heading-shortcuts", "doc-language-picker",
  ],

  "Knowledge base": [
    "kb-article-card", "related-articles", "category-index", "glossary-list", "faq-list",
    "contact-escalation", "article-feedback", "review-stamp", "author-credit", "expert-badge",
    "print-article", "reading-history", "next-article", "kb-search-scope",
  ],

  "Projects and kanban": [
    "board-column", "wip-limit", "swimlane-header", "card-cover", "card-checklist",
    "subtask-bar", "epic-badge", "sprint-header", "sprint-goal", "sprint-load",
    "estimate-chip", "story-points", "dependency-link", "milestone-marker", "backlog-item",
    "triage-queue", "standup-form", "retro-column", "vote-dots", "roadmap-lane",
    "now-next-later", "changelog-compose", "board-filter", "done-column-fold", "carryover-picker",
  ],

  "CRM and sales": [
    "pipeline-board", "deal-card", "deal-stage", "deal-value", "close-date-chip",
    "win-probability", "lost-reason", "person-card", "company-card", "org-link",
    "last-touch", "next-step-field", "activity-composer", "call-log-entry", "meeting-log",
    "email-log-entry", "lead-score-facts", "territory-badge", "quota-bar", "forecast-range",
    "renewal-flag", "upsell-flag",
  ],

  "Support desk": [
    "case-summary", "ticket-status", "first-response-clock", "sla-chip", "breach-warn",
    "assign-menu", "macro-picker", "saved-reply", "satisfaction-followup", "escalation-path",
    "merge-tickets", "split-ticket", "customer-context", "previous-tickets", "internal-note",
    "public-reply-toggle", "on-hold-reason", "reopen-form", "kb-suggest", "csat-request",
    "backlog-age", "collision-warn",
  ],

  "HR and staffing": [
    "org-node", "reports-list", "leave-request", "leave-balance", "leave-calendar",
    "shift-card", "shift-swap", "open-shift", "rota-week", "clock-in-button",
    "timesheet-grid", "overtime-tally", "break-tracker", "cert-expiry", "training-record",
    "onboarding-checklist", "probation-meter", "anniversary-badge", "headcount-stat", "payslip-summary",
    "expense-claim", "mileage-field", "approval-inbox",
  ],

  "Restaurant and hospitality": [
    "menu-line", "dish-tile", "allergen-badges", "dietary-tags", "spice-level",
    "course-header", "tasting-menu", "wine-pairing", "daily-special", "sold-out-strike",
    "table-picker", "party-size-picker", "seating-preference", "waitlist-position", "buzzer-number",
    "order-ticket", "course-fire", "modifier-picker", "combo-builder", "time-priced-badge",
    "service-charge-note", "split-by-item", "tip-presets", "covers-count", "turn-time",
  ],

  "Clinics and health": [
    "appointment-type", "intake-section", "symptom-picker", "insurance-field", "medication-item",
    "dose-schedule", "refill-reminder", "allergy-list", "vitals-strip", "practitioner-card",
    "referral-form", "follow-up-picker", "test-result", "normal-range-bar", "prep-instructions",
    "telehealth-join", "no-show-policy", "chaperone-request",
  ],

  "Education and courses": [
    "course-tile", "lesson-item", "module-header", "progress-map", "quiz-question",
    "answer-choice", "explanation-reveal", "flashcard", "review-due-badge", "assignment-item",
    "due-badge", "rubric-table", "grade-pill", "submission-status", "peer-review-card",
    "cohort-banner", "live-class-join", "recording-item", "certificate-card", "prerequisite-gate",
    "enroll-bar", "seat-limit", "syllabus-week", "office-hours", "pass-threshold",
  ],

  "Property and lettings": [
    "listing-card", "price-per-area", "property-facts", "floorplan-toggle", "energy-rating",
    "viewing-slots", "offer-status", "chain-depth", "tenure-badge", "purchase-costs",
    "affordability-inputs", "availability-date", "furnished-badge", "pet-policy", "deposit-terms",
    "virtual-tour-badge", "agent-card",
  ],

  "Events and ticketing": [
    "ticket-tier", "tier-soldout", "standing-badge", "door-times", "lineup-slot",
    "stage-tag", "age-restriction", "ticket-transfer", "resale-listing", "qr-ticket",
    "wallet-pass-button", "refund-protection", "group-discount", "early-bird-countdown", "capacity-note",
    "accessible-seating", "parking-options", "set-times", "lineup-billing", "support-acts",
    "weather-policy",
  ],

  "Travel and itineraries": [
    "itinerary-day", "journey-leg", "layover-note", "terminal-badge", "gate-change-warn",
    "boarding-group", "baggage-allowance", "entry-requirements", "packing-list", "packing-check",
    "booking-reference", "seat-preference", "meal-preference", "loyalty-tier", "points-balance",
    "trip-countdown", "offline-itinerary", "checkin-opens-note",
  ],

  "Legal and consent": [
    "signature-draw", "signature-typed", "initials-field", "consent-log", "policy-diff",
    "terms-gate", "retention-badge", "data-request-form", "data-request-status", "erasure-confirm",
    "processor-list", "cookie-detail-table", "lawful-basis-picker", "jurisdiction-badge", "esign-status",
    "witness-field", "version-consented", "guardian-consent",
  ],

  "Printable documents": [
    "invoice-doc", "quote-doc", "estimate-accept-bar", "packing-slip", "delivery-note-doc",
    "receipt-doc", "statement-doc", "remittance-line", "credit-note-doc", "brand-letterhead",
    "doc-numbering", "payment-terms", "bank-details-block", "page-x-of-y", "signature-line",
    "doc-watermark", "void-stamp", "paid-stamp",
  ],

  "Developer consoles": [
    "endpoint-entry", "method-badge", "param-table", "response-example", "rate-limit-meter",
    "webhook-attempt", "webhook-replay", "secret-rotate-bar", "token-scopes", "origin-allowlist",
    "sdk-version", "deprecation-banner", "migration-steps", "changelog-item", "service-status",
    "dependency-badge", "queue-lag", "job-state", "retry-policy-note", "dead-letter-item",
    "cron-editor", "cron-next-runs", "log-level-picker", "error-group", "release-entry",
    "artifact-item", "api-key-scopes-diff", "sandbox-toggle",
  ],

  "Flags and operations": [
    "flag-toggle", "flag-targeting", "rollout-percent", "kill-switch", "config-diff",
    "incident-banner", "incident-timeline", "status-component", "maintenance-window", "oncall-badge",
    "pager-ack-bar", "runbook-link", "postmortem-header", "sev-badge", "impact-summary",
    "uptime-strip", "freeze-banner", "canary-meter",
  ],

  "Gamification and loyalty": [
    "badge-case", "badge-locked", "level-bar", "xp-award", "streak-flame",
    "leaderboard-entry", "rank-change", "quest-card", "quest-progress", "daily-goal",
    "reward-claim", "points-ledger", "tier-progress", "referral-card", "referral-status",
    "season-track", "challenge-invite",
  ],

  "Podcasts and audio": [
    "episode-item", "episode-progress", "queue-item", "sleep-timer", "listen-later",
    "show-card", "follow-show", "transcript-search", "clip-share", "timestamp-link",
    "download-toggle", "episode-notes", "guest-badge", "ad-marker", "intro-skip",
    "chapter-source",
  ],

  "Video platforms": [
    "watch-progress", "up-next-card", "playlist-rail", "chapter-thumbs", "quality-picker",
    "autoplay-toggle", "mini-player", "theater-toggle", "watch-later", "continue-watching",
    "premiere-countdown", "member-only-badge", "dub-picker", "clip-creator", "timestamp-comment",
    "view-milestone", "vertical-rail", "credits-skip",
  ],

  "News and publishing": [
    "headline-stack", "live-blog-entry", "live-blog-pin", "developing-tag", "correction-note",
    "update-stamp", "paywall-meter", "metered-note", "subscriber-badge", "gift-article",
    "series-nav", "part-x-of-y", "dateline", "wire-credit", "photo-credit",
    "standfirst", "breaking-bar", "opinion-tag", "fact-box", "event-timeline",
    "related-coverage", "editors-pick",
  ],

  "Reviews and ratings": [
    "rating-stars", "star-input", "rating-breakdown", "review-entry", "write-review",
    "review-guidelines", "verified-purchase-badge", "helpful-vote", "review-photos", "owner-response",
    "review-filter", "average-badge", "review-invite", "incentive-disclosure",
  ],

  "Weather and environment": [
    "forecast-strip", "hour-strip", "uv-badge", "pollen-badge", "air-quality-badge",
    "sun-times", "tide-chart-lite", "wind-arrow", "precip-bar", "feels-like-note",
    "severe-alert",
  ],

  "Devices and IoT": [
    "device-tile", "battery-badge", "signal-bars", "pairing-flow", "firmware-update-bar",
    "sensor-reading", "alarm-rule", "automation-rule", "scene-button", "room-group",
    "energy-today", "offline-device-note", "tamper-alert", "device-share", "hub-status",
  ],

  "Fitness and sport": [
    "workout-card", "exercise-item", "set-logger", "rep-counter", "rest-timer",
    "personal-best", "streak-calendar", "distance-stat", "pace-stat", "effort-zones",
    "route-stats", "warmup-block", "cooldown-block", "program-week", "rest-day-badge",
  ],

  "Personal finance": [
    "balance-card", "transaction-item", "category-chip", "budget-envelope", "budget-progress",
    "recurring-detect", "upcoming-bill", "safe-to-spend", "savings-goal", "round-up-note",
    "cashflow-strip", "merchant-summary", "pending-transaction", "dispute-button", "statement-period",
    "interest-note", "transfer-form", "standing-order",
  ],

  "Marketplace and vendors": [
    "vendor-card", "vendor-facts", "ships-from", "cart-split-note", "commission-note",
    "payout-summary", "vendor-reply", "ask-seller", "offer-bar", "offer-history",
    "bid-entry", "bid-history", "reserve-met", "protection-summary", "dispute-flow",
    "vendor-holiday", "listing-boost", "fee-breakdown",
  ],

  "Profiles and identity": [
    "profile-prompt", "pronouns-field", "name-pronounce", "avatar-picker", "cover-reposition",
    "social-links-editor", "skills-chips", "endorsement", "open-to-badge", "portfolio-tile",
    "testimonial-request", "connection-degree", "mutual-connections", "last-active",
  ],

  "Data import and export": [
    "csv-mapper", "column-match", "import-preview-table", "error-rows-download", "dedupe-rules",
    "merge-strategy-picker", "dry-run-toggle", "import-report", "rollback-import", "export-columns-picker",
    "export-schedule", "starter-file", "encoding-picker", "delimiter-picker",
  ],

  "Accessibility, further": [
    "dyslexia-toggle", "line-height-control", "letter-spacing-control", "text-size-control", "focus-highlight-toggle",
    "monochrome-toggle", "sign-language-badge", "easy-read-toggle", "tts-play", "skip-groups",
  ],

  "Kiosks and the physical bridge": [
    "qr-poster", "table-tent", "shelf-label", "wristband-print", "kiosk-attract",
    "badge-print", "queue-display", "now-serving", "take-a-number", "opening-sign",
  ],

  "Generic gaps": [
    "masonry-grid", "windowed-list", "tag-field", "chip-input", "picklist-pair",
    "list-mover", "unit-stepper", "percentage-field", "dual-thumb-slider", "glyph-picker",
    "swatch-picker", "tri-state-checkbox", "segment-stack", "step-dots", "mini-map-scroll",
  ],

  "Salons and services, deeper": [
    "service-menu", "staff-picker", "patch-test-gate", "consultation-toggle", "aftercare-sheet",
    "loyalty-stamp", "no-show-terms", "deposit-request", "walk-in-status", "chair-availability",
    "waiting-list-join", "rebook-prompt",
  ],

  "Account security, further": [
    "passkey-nudge", "device-approve", "login-alert", "trusted-device-badge", "security-checkup",
    "password-age-note", "mfa-method", "backup-codes-print", "account-freeze", "recovery-contact",
  ],

  "Forms, further": [
    "conditional-section", "repeat-group", "form-progress-save", "review-before-submit", "dependency-chips",
    "input-prefix", "input-suffix", "measurement-field", "date-range-fields", "time-field",
    "duration-field", "iso-week-field", "month-field", "year-field", "color-field",
    "marketing-opt-in", "sms-opt-in",
  ],

  "Tables, further": [
    "column-totals", "row-numbering", "cell-diff", "table-density-toggle", "column-hide-menu",
    "row-hover-actions", "table-print-view", "group-subtotal", "grand-total", "cell-validation-mark",
    "table-annotations", "column-type-icon", "table-zoom", "selection-summary",
  ],

  "Media library": [
    "photo-annotate", "image-rotate", "exif-panel", "gallery-reorder", "caption-editor",
    "focal-point", "batch-tag", "photo-compare-grid", "contact-sheet", "raw-badge",
    "panorama-strip", "image-dedupe", "usage-count-badge", "media-trash",
  ],

  "Notifications, further": [
    "preference-matrix", "quiet-days", "vip-list", "channel-order", "digest-preview",
    "notification-log", "test-notification", "read-all-bar",
  ],

  "Search, further": [
    "synonym-editor", "zero-results-suggest", "operators-help", "recent-searches-clear",
  ],

  "Localisation": [
    "language-picker", "translation-status", "rtl-preview", "locale-preview", "translated-badge",
    "machine-translation-note", "glossary-term-lock", "plural-preview",
  ],

  "The local area, no provider": [
    "plus-code-field", "directions-steps", "landmark-field", "service-area-list", "postcode-checker",
    "zone-map-lite", "transit-options",
  ],

  "Content administration": [
    "seo-preview", "meta-editor", "slug-editor", "redirect-rule", "draft-status",
    "publish-schedule", "content-slot", "broken-link", "alt-audit",
  ],

  "Point of sale": [
    "cash-drawer-count", "till-session", "till-refund", "card-terminal-status", "offline-mode-bar",
    "receipt-print", "open-tab", "split-tender", "float-count", "end-of-day",
  ],

  "Commerce extras": [
    "compare-drawer", "wishlist-toggle", "stock-notify", "back-in-stock", "price-alert",
    "guest-checkout-choice",
  ],

  "Garages and vehicles": [
    "vehicle-field", "plate-lookup", "inspection-due", "service-record", "loan-vehicle",
    "tyre-size-field", "mileage-input", "job-sheet", "labour-line", "parts-line",
  ],

  "Vets and pets": [
    "pet-profile", "species-field", "vaccine-record", "microchip-field", "boarding-dates",
    "grooming-notes",
  ],

  "Donations and causes": [
    "donation-presets", "tax-receipt-toggle", "recurring-donation", "impact-scale", "donor-tile",
    "fundraiser-meter", "match-meter",
  ],

  "Gyms and classes": [
    "class-card", "class-capacity", "membership-tier", "freeze-membership", "induction-gate",
    "session-credit",
  ],

  "Trades and field work": [
    "job-ticket", "site-visit", "quote-line", "materials-list", "van-stock",
    "call-out-fee", "access-instructions",
  ],

  "Photographers": [
    "shoot-package", "gallery-proofing", "favourite-mark", "download-pin", "print-size-picker",
    "licence-picker",
  ],

  "Florists and gifting": [
    "occasion-picker", "delivery-date-picker", "card-message", "seasonal-availability",
  ],

  "Private hire": [
    "fare-estimate", "pickup-field", "dropoff-field", "driver-card", "vehicle-class-picker",
    "meet-point",
  ],

  "Cleaners and home services": [
    "room-count-picker", "frequency-picker", "supplies-choice", "key-handover",
  ],

  "Childcare": [
    "age-group-picker", "staff-ratio", "collection-password", "daily-report", "term-dates",
    "allergy-plan",
  ],

  "Analytics, campaigns and the rest": [
    "slot-lock-timer", "seat-map-lite", "queue-position", "hold-timer", "reschedule-picker",
    "capacity-heatmap", "opening-exception", "staff-colour-key", "shift-coverage", "time-off-conflict",
    "price-tier-table", "stock-by-location", "reserve-stock", "low-stock-alert", "restock-date",
    "swatch-group",
  ],

};
