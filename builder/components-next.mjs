// The next 877 — proposed components, none of which exist.
//
// THE BAR IS THE ONE THE SHIPPED KIT ACTUALLY USES, and an earlier pass of this
// file got it wrong. That pass culled to 26 by asking "is the rendering
// structure new" — a rule the kit itself fails: 33 of its components end in
// -card and 32 in -badge, and under that rule thirty of each should never have
// been built. They were built on purpose, and the kit's own note says why:
// "every one is PROP-DRIVEN, not children-only... these take the shape of the
// data a site has". A recipe-card takes {title, cookTime, servings} and a
// property-card takes {price, beds, baths}. They render alike and are not the
// same component, because the point is that the model hands one its data
// instead of hand-writing the layout.
//
// So the test is: are the PROPS different, and would the model otherwise write
// that layout inline? If yes it earns a name.
//
// 142 entries still failed it — TRUE prop-clones, identical props to something
// shipped rather than merely similar. Ten countdowns to ten different events
// all take {date, label}, which is countdown-ring. Twelve "-status" chips take
// one state string with no distinct state set, which is status-badge.
// free-shipping-meter is threshold-bar, normal-range-bar is tolerance-bar,
// flashcard is flip-card, rubric-table is matrix-question, csv-mapper is
// column-mapper.
//
// NEXT_SHAPES at the end is the subset with no near neighbour AT ALL — a
// different structure, not just different props — so it is what to build first.
export const NEXT_PLANNED = {
  "Calendar and scheduling, deep": [
    "time-grid", "recurrence-editor", "lane-calendar", "resource-lanes", "quick-event",
    "meeting-poll", "best-time-grid", "closed-dates", "cancellation-window",
  ],

  "Catalogue and products": [
    "colour-swatch", "stock-level", "backorder-note", "preorder-badge", "bundle-builder",
    "addon-list", "personalisation-field", "engrave-preview", "fit-guide", "material-badge",
    "care-icons", "warranty-badge", "price-history", "unit-price", "bulk-pricing",
    "quantity-break", "min-order-note", "sku-field", "barcode-display", "category-tile",
    "collection-header", "lookbook-grid", "shop-the-look", "recently-viewed", "new-in-badge",
    "last-chance-badge",
  ],

  "Cart and checkout": [
    "cart-drawer", "cart-badge", "cart-empty", "saved-for-later", "cart-upsell",
    "promo-field", "gift-toggle", "gift-message", "delivery-picker", "click-collect",
    "store-picker", "address-book", "express-pay-buttons", "order-notes", "substitution-pref",
    "invoice-toggle", "tax-number-field", "po-number-field", "delivery-window", "basket-merge-note",
    "price-changed-note", "out-of-stock-item", "order-review", "place-order-bar",
  ],

  "Orders and fulfilment": [
    "order-card", "order-timeline", "tracking-input", "carrier-badge", "delivery-eta",
    "proof-of-delivery", "return-window", "return-reason", "return-label", "exchange-picker",
    "partial-shipment", "pick-list", "pack-checklist", "dispatch-doc", "label-print",
    "manifest-table", "failed-delivery", "redelivery-picker", "collection-code", "damage-report",
    "cancel-window", "address-correct-note", "delivery-instructions", "leave-safe-consent",
  ],

  "Subscriptions and billing": [
    "plan-compare", "seat-counter", "included-usage", "overage-note", "billing-cycle-toggle",
    "proration-preview", "pause-subscription", "cancel-flow", "winback-offer", "dunning-banner",
    "card-expiry-warn", "billing-history", "invoice-status", "credit-note-doc-line", "billing-contact",
    "tax-id-field", "receipt-list", "payment-retry", "grace-period-note", "downgrade-warn",
    "upgrade-preview", "trial-banner", "policy-summary",
  ],

  "Messaging": [
    "thread-list", "new-since-divider", "message-group", "reaction-picker", "reply-quote",
    "forward-header", "edited-note", "deleted-stub", "pinned-bar", "attachment-bubble",
    "group-header", "member-count", "mute-badge", "archive-swipe", "translate-toggle",
    "spam-fold", "message-search", "starred-messages", "disappearing-note",
  ],

  "Email client": [
    "sender-chip", "subject-line", "preview-text", "thread-collapse", "quote-fold",
    "compose-bar", "recipient-field", "cc-toggle", "attachment-warn", "undo-send-bar",
    "schedule-send", "snoozed-until-chip", "label-chips", "sweep-actions", "unsubscribe-bar",
    "phishing-banner", "external-sender-tag", "out-of-office-banner", "reply-all-warn",
  ],

  "Social and community": [
    "post-composer", "feed-item", "repost-header", "like-count", "follow-button",
    "follower-stat", "profile-banner", "verified-tick", "handle-field", "bio-editor",
    "hashtag-chip", "trend-item", "suggested-follow", "blocked-person", "community-rules",
    "join-gate", "member-intro", "rsvp-summary", "audience-picker", "quote-post",
    "thread-composer", "draft-stack", "share-count", "close-circle-badge", "crosspost-targets",
    "mute-words", "feed-preference",
  ],

  "Comments and discussion": [
    "nested-thread", "comment-composer", "collapse-thread", "load-more-replies", "best-comment",
    "op-badge", "moderator-badge", "sort-comments", "comment-count", "inline-reply",
    "upvote-pair", "controversial-fold", "edit-history", "quote-reply", "live-comments",
    "thread-depth-cap", "continue-thread",
  ],

  "Editor chrome": [
    "floating-format-bar", "word-count-live", "focus-mode-toggle", "typewriter-scroll", "footnote-composer",
    "divider-menu", "snippet-picker", "template-gallery", "track-changes-bar", "suggestion-bubble",
    "accept-reject-pair", "autosave-note", "style-picker", "paste-clean-note", "heading-shortcuts",
    "doc-language-picker",
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
    "win-probability", "lost-reason", "company-card", "org-link", "last-touch",
    "next-step-field", "activity-composer", "call-log-entry", "meeting-log", "email-log-entry",
    "lead-score-facts", "territory-badge", "quota-bar", "forecast-range", "renewal-flag",
    "upsell-flag",
  ],

  "Support desk": [
    "first-response-clock", "sla-chip", "breach-warn", "assign-menu", "saved-reply",
    "satisfaction-followup", "escalation-path", "merge-tickets", "split-ticket", "previous-tickets",
    "internal-note", "public-reply-toggle", "on-hold-reason", "reopen-form", "kb-suggest",
    "csat-request", "backlog-age",
  ],

  "HR and staffing": [
    "org-node", "reports-list", "leave-request", "leave-balance", "shift-card",
    "shift-swap", "open-shift", "overtime-tally", "break-tracker", "cert-expiry",
    "training-record", "onboarding-checklist", "probation-meter", "anniversary-badge", "headcount-stat",
    "payslip-summary", "expense-claim", "mileage-field",
  ],

  "Restaurant and hospitality": [
    "menu-line", "dish-tile", "allergen-badges", "dietary-tags", "spice-level",
    "course-header", "tasting-menu", "wine-pairing", "daily-special", "sold-out-strike",
    "party-size-picker", "seating-preference", "waitlist-position", "buzzer-number", "order-ticket",
    "course-fire", "modifier-picker", "combo-builder", "time-priced-badge", "service-charge-note",
    "tip-presets", "covers-count", "turn-time",
  ],

  "Clinics and health": [
    "appointment-type", "intake-section", "symptom-picker", "insurance-field", "medication-item",
    "dose-schedule", "refill-reminder", "allergy-list", "vitals-strip", "practitioner-card",
    "referral-form", "follow-up-picker", "test-result", "prep-instructions", "telehealth-join",
    "no-show-policy", "chaperone-request",
  ],

  "Education and courses": [
    "course-tile", "lesson-item", "module-header", "progress-map", "quiz-question",
    "answer-choice", "explanation-reveal", "review-due-badge", "assignment-item", "due-badge",
    "grade-pill", "peer-review-card", "cohort-banner", "live-class-join", "recording-item",
    "certificate-card", "prerequisite-gate", "enroll-bar", "seat-limit", "syllabus-week",
    "office-hours", "pass-threshold",
  ],

  "Property and lettings": [
    "listing-card", "price-per-area", "property-facts", "floorplan-toggle", "energy-rating",
    "viewing-slots", "chain-depth", "tenure-badge", "purchase-costs", "affordability-inputs",
    "availability-date", "furnished-badge", "pet-policy", "deposit-terms", "virtual-tour-badge",
    "agent-card",
  ],

  "Events and ticketing": [
    "ticket-tier", "tier-soldout", "standing-badge", "door-times", "lineup-slot",
    "stage-tag", "age-restriction", "ticket-transfer", "resale-listing", "qr-ticket",
    "wallet-pass-button", "refund-protection", "group-discount", "capacity-note", "accessible-seating",
    "parking-options", "set-times", "lineup-billing", "support-acts", "weather-policy",
  ],

  "Travel and itineraries": [
    "itinerary-day", "journey-leg", "layover-note", "terminal-badge", "gate-change-warn",
    "boarding-group", "baggage-allowance", "entry-requirements", "booking-reference", "seat-preference",
    "meal-preference", "loyalty-tier", "points-balance", "offline-itinerary", "checkin-opens-note",
  ],

  "Legal and consent": [
    "signature-typed", "initials-field", "consent-log", "terms-gate", "retention-badge",
    "data-request-form", "data-request-status", "erasure-confirm", "processor-list", "cookie-detail-table",
    "lawful-basis-picker", "jurisdiction-badge", "witness-field", "version-consented", "guardian-consent",
  ],

  "Printable documents": [
    "invoice-doc", "quote-doc", "estimate-accept-bar", "packing-slip", "delivery-note-doc",
    "receipt-doc", "statement-doc", "remittance-line", "credit-note-doc", "brand-letterhead",
    "doc-numbering", "payment-terms", "bank-details-block", "page-x-of-y", "signature-line",
    "doc-watermark", "void-stamp", "paid-stamp",
  ],

  "Developer consoles": [
    "endpoint-entry", "method-badge", "param-table", "response-example", "webhook-attempt",
    "webhook-replay", "secret-rotate-bar", "token-scopes", "origin-allowlist", "sdk-version",
    "deprecation-banner", "migration-steps", "changelog-item", "dependency-badge", "queue-lag",
    "retry-policy-note", "dead-letter-item", "cron-next-runs", "log-level-picker", "error-group",
    "release-entry", "artifact-item", "api-key-scopes-diff", "sandbox-toggle",
  ],

  "Flags and operations": [
    "flag-toggle", "flag-targeting", "rollout-percent", "kill-switch", "incident-banner",
    "status-component", "maintenance-window", "oncall-badge", "pager-ack-bar", "runbook-link",
    "postmortem-header", "sev-badge", "impact-summary", "freeze-banner", "canary-meter",
  ],

  "Gamification and loyalty": [
    "badge-locked", "xp-award", "streak-flame", "rank-change", "quest-card",
    "quest-progress", "daily-goal", "reward-claim", "points-ledger", "tier-progress",
    "referral-card", "referral-status", "season-track", "challenge-invite",
  ],

  "Podcasts and audio": [
    "episode-item", "episode-progress", "listen-later", "show-card", "follow-show",
    "transcript-search", "clip-share", "timestamp-link", "download-toggle", "episode-notes",
    "guest-badge", "ad-marker", "intro-skip", "chapter-source",
  ],

  "Video platforms": [
    "up-next-card", "playlist-rail", "chapter-thumbs", "quality-picker", "autoplay-toggle",
    "theater-toggle", "watch-later", "continue-watching", "member-only-badge", "dub-picker",
    "clip-creator", "timestamp-comment", "view-milestone", "vertical-rail", "credits-skip",
  ],

  "News and publishing": [
    "headline-stack", "live-blog-entry", "live-blog-pin", "developing-tag", "correction-note",
    "update-stamp", "paywall-meter", "metered-note", "subscriber-badge", "gift-article",
    "series-nav", "part-x-of-y", "dateline", "wire-credit", "photo-credit",
    "standfirst", "breaking-bar", "opinion-tag", "fact-box", "event-timeline",
    "related-coverage", "editors-pick",
  ],

  "Reviews and ratings": [
    "rating-stars", "star-input", "review-entry", "write-review", "review-guidelines",
    "verified-purchase-badge", "helpful-vote", "owner-response", "review-filter", "average-badge",
    "review-invite", "incentive-disclosure",
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
    "workout-card", "exercise-item", "set-logger", "rep-counter", "personal-best",
    "distance-stat", "pace-stat", "effort-zones", "route-stats", "warmup-block",
    "cooldown-block", "program-week", "rest-day-badge",
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
    "import-preview-table", "error-rows-download", "dry-run-toggle", "import-report", "rollback-import",
    "export-columns-picker", "export-schedule", "starter-file", "encoding-picker", "delimiter-picker",
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
    "chip-input", "segment-stack", "step-dots", "mini-map-scroll",
  ],

  "Salons and services, deeper": [
    "service-menu", "staff-picker", "patch-test-gate", "consultation-toggle", "aftercare-sheet",
    "loyalty-stamp", "no-show-terms", "deposit-request", "chair-availability", "waiting-list-join",
    "rebook-prompt",
  ],

  "Account security, further": [
    "passkey-nudge", "login-alert", "trusted-device-badge", "password-age-note", "mfa-method",
    "backup-codes-print", "account-freeze", "recovery-contact",
  ],

  "Forms, further": [
    "form-progress-save", "review-before-submit", "dependency-chips", "input-prefix", "input-suffix",
    "marketing-opt-in", "sms-opt-in",
  ],

  "Tables, further": [
    "column-totals", "row-numbering", "cell-diff", "table-density-toggle", "column-hide-menu",
    "row-hover-actions", "table-print-view", "group-subtotal", "cell-validation-mark", "table-annotations",
    "column-type-icon", "table-zoom", "selection-summary",
  ],

  "Media library": [
    "photo-annotate", "image-rotate", "gallery-reorder", "caption-editor", "batch-tag",
    "photo-compare-grid", "raw-badge", "panorama-strip", "image-dedupe", "usage-count-badge",
    "media-trash",
  ],

  "Notifications, further": [
    "preference-matrix", "quiet-days", "vip-list", "channel-order", "digest-preview",
    "notification-log", "test-notification", "read-all-bar",
  ],

  "Search, further": [
    "synonym-editor", "zero-results-suggest", "operators-help", "recent-searches-clear",
  ],

  "Localisation": [
    "locale-preview", "translated-badge", "machine-translation-note", "glossary-term-lock",
  ],

  "The local area, no provider": [
    "plus-code-field", "directions-steps", "landmark-field", "service-area-list", "postcode-checker",
    "zone-map-lite", "transit-options",
  ],

  "Content administration": [
    "seo-preview", "meta-editor", "slug-editor", "redirect-rule", "publish-schedule",
    "content-slot", "broken-link", "alt-audit",
  ],

  "Point of sale": [
    "cash-drawer-count", "till-session", "till-refund", "card-terminal-status", "offline-mode-bar",
    "receipt-print", "open-tab", "float-count", "end-of-day",
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
    "capacity-heatmap", "shift-coverage", "time-off-conflict", "price-tier-table", "stock-by-location",
    "reserve-stock", "low-stock-alert", "restock-date", "swatch-group",
  ],

};

// Structurally new — nothing shipped renders anything like these. Build first.
// Each entry says what it IS and why nothing covers it.
export const NEXT_SHAPES = {
  "Grids and boards — 2D arrangements the kit has no answer for": {
    "kanban-board": "Columns of cards, dragged between columns, per-column limit, optional swimlane rows. `drag-list` and `sortable-list` reorder WITHIN one list; nothing moves an item across lists.",
    "gantt-bars": "Task bars positioned and sized on a shared time axis, with links between them. `timeline-horizontal` places points on a line; it has no spans and no dependencies.",
    "heatmap-grid": "A day-by-week grid where each cell's fill is a count. `heat-strip` is one dimension; `mini-bars` is a series, not a calendar.",
    "time-lane-grid": "Lanes down one axis, time along the other, blocks positioned by start and duration and overlapping side by side — the week view AND the staff rota, which are one shape with the lane relabelled. `day-schedule` is one day as a list; `calendar-month` has no time axis.",
    "seat-map": "Pick from a positioned plan (seats, tables, pitches) where position carries meaning. Every other picker in the kit is a list.",
    "variant-matrix": "Size against colour, each cell in stock or not, one cell selectable. `variant-picker` is a row of options and cannot express a combination that is unavailable.",
    "funnel-steps": "Stages with the drop-off BETWEEN them as the thing being read. `steps` and `progress-stack` show where you are, not what was lost at each stage.",
    "tree-table": "A hierarchy and columns at once — expandable parents with aligned numeric columns. The kit has `tree-view` and `data-table` as separate things.",
    "node-graph": "Boxes joined by edges, positioned and pannable. `workflow-map` is deliberately a list, and `org-chart` is a fixed hierarchy.",
    "timesheet-grid": "Days across, projects down, hours typed in cells, totals on both edges. `spreadsheet-grid` is generic cells with no totals contract."
  },
  "Pickers with a shape the kit's pickers do not have": {
    "multi-date-picker": "Several arbitrary dates, not a range and not weekdays. `date-range-picker` is contiguous; `weekday-picker` repeats.",
    "nl-date-input": "Type “next Tuesday 2pm” and see it resolve. Every other date input in the kit is a control, not parsed text.",
    "meeting-poll-grid": "People against candidate slots, counts per slot, a winner picked from them. `availability-grid` shows one person's free time.",
    "rule-builder": "When THIS happens, do THAT — a trigger, conditions and actions. `query-builder` filters rows; `cron-builder` is only a schedule.",
    "option-priced-list": "Options that each change the price, with a running total — toppings, add-ons, and pick-any-N-for-a-fixed-price, which is the same control with a different total rule. `checkbox-group` has no money and `order-summary` takes finished lines."
  },
  "Money shapes the kit's money components do not cover": {
    "split-tender": "Part cash, part card, part voucher, with the remainder falling as each is entered. `split-amount` divides among people; `payment-picker` chooses one method.",
    "split-by-item": "Assign each line of a bill to a person and total per person. A different question from splitting a number."
  },
  "Media editing": {
    "range-trim": "Two handles on a media timeline for in and out points. `scrubber` has one handle and seeks.",
    "image-annotate": "Draw boxes or drop pins ON an image with notes attached. `comment-pin` anchors to a page, not to image coordinates.",
    "focal-point": "Click a point on an image so every crop keeps it. `image-crop` produces one crop; this drives all of them."
  },
  "Reading and language": {
    "read-aloud": "Play this page as speech, with the sentence being spoken highlighted. `voice-input` is the other direction.",
    "rtl-preview": "Mirror the layout to check a right-to-left language without changing the app's own direction. `direction` sets it; this previews it."
  },
  "Small things with no near neighbour": {
    "barcode": "A 1D barcode (Code128/EAN) as SVG. `qr-code` is 2D and takes its matrix from elsewhere; a shelf label needs the linear one.",
    "stamp-card": "A grid of earned and unearned stamps toward a reward. `checklist-dot` counts tasks; this counts visits and has a prize at the end.",
    "poll-composer": "Build a poll — add and reorder options, set how long it runs. `poll-result` displays one; nothing makes one.",
    "minimap-scroll": "A shrunk map of a long document with the viewport marked, draggable. `scroll-progress` is a bar and `table-of-contents` is headings."
  }
};

export const NEXT_THOUSAND = Object.fromEntries([
  ...Object.entries(NEXT_PLANNED),
  ...Object.entries(NEXT_SHAPES).map(([g, e]) => [g, Object.keys(e)]),
]);
