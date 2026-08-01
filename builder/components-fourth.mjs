// The fourth 500 — proposed components, none of which exists and none of which
// is already on another list. Checked mechanically against the union of the
// 1,057 built and the three backlogs before it: 2,368 claimed names.
//
// WHERE THIS ONE LOOKS, since the obvious ground is gone. components-planned
// and components-next are organised by trade (62 groups), components-third by
// mechanics (47 groups). What neither reached is the PLATFORM layer a tool
// grows into — integrations, webhooks, quotas, tenancy, releases, migration,
// instrumentation — and the verticals none of the 62 groups touch: freight,
// warehousing, manufacturing, construction, agriculture, energy, civic
// services, laboratories, recruitment, insurance, accounting, archives.
//
// Only 10 of 430 names in the first pass collided with the 2,368, against 93
// in the third list's first pass. That gap is the evidence this ground really
// was unclaimed rather than merely renamed.
//
// The bar is unchanged: are the PROPS different, and would the model otherwise
// hand-write that layout? Plus the original four — three unrelated trades, a
// distinct shape, a component rather than a feature with a data model, and free
// of any one country's rules.
//
// 20 were cut from a clean 520 for failing it. EIGHT for the country rule, and
// that is the one to watch: 'dbs-status', 'vat-return-box', 'rams-note',
// 'right-to-work', 'no-claims-note', 'waste-transfer-note',
// 'standing-charge-note' and 'tip-slot' all read as ordinary nouns and are
// each one jurisdiction's paperwork. components-next.mjs records the same
// mistake being made before, and names DBS in its list of eleven.
export const FOURTH_PLANNED = {
  "Integrations and connectors": [
    "connector-card", "connection-health", "oauth-consent-summary", "reauth-prompt", "field-mapping",
    "sync-direction", "sync-schedule", "integration-log", "disconnect-warning", "credential-rotate",
    "provider-status", "mapping-conflict", "test-connection",
  ],

  "Webhooks and events": [
    "webhook-endpoint", "event-subscription", "delivery-attempt", "payload-preview", "signature-secret",
    "replay-event", "event-filter", "dead-letter", "delivery-rate", "webhook-test",
    "idempotency-note", "retry-policy",
  ],

  "Quotas, limits and metering": [
    "usage-breakdown", "overage-preview", "limit-reached", "plan-limit-row", "burst-note",
    "usage-forecast", "seat-usage-row", "hard-limit-warning", "usage-alert-rule",
  ],

  "Multi-tenancy and white-label": [
    "tenant-badge", "brand-upload", "custom-domain", "domain-verify", "subdomain-field",
    "tenant-limits", "workspace-invite", "cross-workspace-note", "tenant-delete",
  ],

  "Internationalisation, deeper": [
    "locale-picker", "translation-status", "missing-translation", "pluralisation-preview", "rtl-toggle",
    "date-format-preview", "number-format-preview", "measurement-system", "translator-note", "locale-fallback-chain",
    "string-context",
  ],

  "Tax and compliance surfaces": [
    "tax-breakdown", "tax-exempt-note", "reverse-charge-note", "jurisdiction-picker", "compliance-checklist",
    "regulation-note", "certification-row", "expiry-audit", "policy-version", "attestation-box",
    "record-keeping-note", "disclosure-block", "withholding-note",
  ],

  "Theming and customisation": [
    "palette-preview", "font-preview", "spacing-preview", "logo-slot", "theme-reset",
    "custom-css-note", "preview-frame", "brand-check", "theme-export",
  ],

  "Versioning and releases": [
    "version-badge", "changelog-feed", "upgrade-prompt", "deprecation-note", "breaking-change-note",
    "migration-guide-link", "version-picker", "rollout-progress", "canary-note", "pin-version",
    "release-freeze",
  ],

  "Backup, restore and migration": [
    "backup-list", "backup-schedule", "restore-preview", "restore-confirm", "migration-progress",
    "dry-run-result", "cutover-note", "legacy-note", "data-residency",
  ],

  "Performance and diagnostics": [
    "latency-note", "cache-status", "health-check-row", "uptime-strip", "status-page-link",
    "diagnostic-bundle",
  ],

  "Analytics instrumentation": [
    "event-name-field", "property-schema", "tracking-plan-row", "consent-gated-note", "sample-rate",
    "funnel-step-row", "cohort-picker", "attribution-note", "goal-definition",
  ],

  "Voice, gesture and scanning": [
    "voice-transcript", "push-to-talk", "swipe-hint", "pinch-hint", "scan-overlay",
    "scan-result", "nfc-prompt",
  ],

  "Email and embed rendering": [
    "email-preview", "plain-text-fallback", "inbox-preview", "unsubscribe-footer", "email-safe-note",
    "embed-size", "embed-permissions", "iframe-fallback", "widget-key", "embed-preview",
  ],

  "Construction and site work": [
    "site-diary", "snag-item", "snag-list", "drawing-revision", "permit-row",
    "plant-hire-row", "toolbox-talk", "site-induction", "weather-delay", "variation-order",
    "retention-line", "handover-pack", "hoarding-notice",
  ],

  "Agriculture and growing": [
    "land-parcel", "crop-stage", "sowing-window", "harvest-window", "yield-note",
    "spray-record", "livestock-row", "herd-count", "grazing-plan", "soil-note",
    "irrigation-note", "traceability-code",
  ],

  "Logistics and freight": [
    "consignment-row", "leg-list", "freight-quote", "load-plan", "pallet-count",
    "customs-note", "incoterm-note", "hazard-class", "temperature-log", "proof-of-collection",
    "driver-assignment", "vehicle-check", "route-stop", "dwell-time", "demurrage-note",
    "axle-weight",
  ],

  "Warehousing and inventory ops": [
    "bin-location", "putaway-task", "pick-path", "cycle-count-row", "goods-in-row",
    "quarantine-note", "serial-capture", "batch-trace", "stock-adjustment", "replenish-task",
    "shrink-report", "slotting-note",
  ],

  "Manufacturing and production": [
    "work-order-row", "bill-of-materials", "routing-step", "machine-status", "downtime-note",
    "scrap-rate", "changeover-note", "takt-note", "quality-check-row", "nonconformance",
    "batch-yield", "shift-output", "tooling-row",
  ],

  "Energy and utilities": [
    "meter-reading", "tariff-row", "consumption-bar", "outage-notice", "supply-status",
    "smart-meter-note", "carbon-note", "generation-mix", "switch-supplier", "estimated-vs-actual",
    "usage-compare",
  ],

  "Civic and public services": [
    "case-reference", "eligibility-check", "application-status", "document-checklist", "appointment-offer",
    "service-standard", "appeal-route", "accessibility-statement", "translation-request", "representative-note",
    "public-notice", "consultation-response",
  ],

  "Libraries and archives": [
    "catalogue-record", "shelf-mark", "loan-row", "hold-queue", "renewal-note",
    "reading-room-booking", "finding-aid", "provenance-note", "access-restriction", "digitisation-status",
    "accession-number",
  ],

  "Museums and cultural venues": [
    "object-label", "exhibition-row", "gallery-plan", "audio-stop", "conservation-note",
    "loan-agreement", "acquisition-note", "timed-entry", "donor-credit",
  ],

  "Research and laboratories": [
    "sample-row", "protocol-step", "reagent-row", "instrument-booking", "calibration-note",
    "chain-of-custody", "result-flag", "reference-range", "study-arm", "participant-row",
    "ethics-approval", "data-dictionary", "replicate-group", "assay-plate", "freezer-location",
  ],

  "Recruitment and job boards": [
    "vacancy-card", "applicant-row", "pipeline-stage", "screening-question", "cv-preview",
    "interview-slot", "scorecard-row", "offer-summary", "reference-request", "salary-range-note",
    "anonymised-toggle", "talent-pool", "rejection-note", "vacancy-closing",
  ],

  "Insurance and claims": [
    "policy-summary-row", "cover-level", "excess-note", "claim-row", "claim-timeline",
    "incident-report", "assessor-visit", "settlement-offer", "renewal-quote", "exclusion-list",
    "beneficiary-row", "premium-breakdown",
  ],

  "Accounting and bookkeeping": [
    "ledger-row", "reconciliation-row", "unmatched-note", "journal-entry", "chart-of-accounts",
    "period-lock", "accrual-note", "depreciation-row", "trial-balance-row", "aged-balance",
    "write-off-note", "nominal-code", "bank-feed-row",
  ],

  "Security and access control": [
    "door-event", "badge-row", "visitor-sign-in", "escort-note", "zone-permission",
    "alarm-state", "patrol-log", "key-issue",
  ],

  "Sports leagues and fixtures": [
    "fixture-row", "league-table-row", "score-entry", "squad-list", "substitution-row",
    "card-record", "fixture-postponed", "cup-bracket", "player-stat-row", "season-picker",
    "venue-allocation", "referee-assignment",
  ],

  "Music and recording": [
    "track-row", "setlist-row", "stem-list", "take-row", "royalty-split",
    "release-schedule", "isrc-field", "rehearsal-slot", "stage-plot",
  ],

  "Film and production": [
    "call-sheet", "scene-row", "shot-list-row", "location-release", "crew-role-row",
    "day-out-of-days", "continuity-note", "dailies-row", "rushes-note", "wrap-report",
  ],

  "Membership clubs and societies": [
    "membership-tier-row", "renewal-reminder", "committee-list", "agm-notice", "motion-vote",
    "minutes-entry", "subscription-arrears", "guest-sign-in", "club-fixture",
  ],

  "Volunteering and community": [
    "shift-signup", "volunteer-row", "hours-log", "induction-status", "role-description",
    "impact-note", "thank-you-note", "rota-gap",
  ],

  "Waste and recycling": [
    "collection-day", "bin-type", "contamination-note", "weighbridge-row", "recycling-rate",
    "missed-collection",
  ],

  "Maritime and aviation": [
    "berth-row", "tide-note", "flight-leg", "manifest-row", "crew-roster-row",
    "fuel-log", "maintenance-due", "notam-note", "cargo-hold",
  ],

  "Franchises and multi-site": [
    "site-picker", "site-compare-row", "rollout-status", "local-override", "brand-standard-check",
    "franchise-fee-row", "group-report", "site-league-table", "central-message",
  ],

  "Two-sided matching": [
    "match-score", "mutual-interest", "shortlist-both", "availability-overlap", "intro-request",
    "match-reason", "decline-politely", "rematch-note", "match-expiry", "preference-weights",
  ],

  "Gaming and esports": [
    "match-lobby", "ladder-row", "loadout-row", "achievement-row", "party-invite",
    "queue-timer", "spectator-count",
  ],

  "Auctions and bidding": [
    "lot-card", "reserve-note", "proxy-bid", "buyers-premium", "auction-timer",
    "withdrawn-lot", "hammer-price", "condition-report", "absentee-bid",
  ],

  "Publishing and print production": [
    "issue-row", "page-plan", "proof-status", "print-run", "distribution-list",
    "embargo-time", "byline-row",
  ],

  "Pharmacy and dispensing": [
    "prescription-row", "dispense-label", "stock-substitute", "controlled-drug-note", "repeat-request",
    "interaction-warning", "dosage-field", "pharmacist-check", "ready-to-collect", "patient-leaflet",
  ],

  "Care and social support": [
    "care-plan-row", "visit-log", "medication-round", "next-of-kin", "risk-assessment-row",
    "consent-to-care", "care-hours", "safeguarding-note", "review-due", "keyworker-row",
  ],

  "Estate agency and sales": [
    "offer-row", "chain-status", "valuation-note", "listing-status", "vendor-note",
    "buyer-position", "completion-date", "key-release", "asking-price-change",
  ],

  "Lending and mortgages": [
    "affordability-note", "repayment-preview", "rate-type", "term-slider", "deposit-percent",
    "offer-expiry", "arrears-note", "overpayment-allowance", "redemption-note", "broker-note",
  ],

  "Telecoms and connectivity": [
    "line-status", "bundle-row", "data-allowance", "roaming-note", "coverage-note",
    "sim-row", "port-request", "contract-end", "add-on-row", "fair-use-note",
  ],

  "Coworking and space booking": [
    "room-booking-row", "access-hours", "day-pass", "occupancy-note", "amenity-list",
    "booking-credits", "floor-picker", "locker-row", "visitor-pass",
  ],

  "Equipment and hire": [
    "asset-row", "hire-period", "condition-check", "deposit-hold", "return-due",
    "damage-charge", "serial-row", "service-history", "off-hire-note",
  ],

  "Food and drink production": [
    "recipe-scale", "allergen-matrix", "best-before", "production-run", "tasting-note",
    "cellar-row", "abv-note", "label-approval", "batch-code", "shelf-life-note",
  ],

  "Emergency and incident response": [
    "incident-severity", "responder-list", "muster-list", "all-clear", "resource-status",
    "scene-note", "triage-row", "comms-log", "stand-down",
  ],

  "Health records, deeper": [
    "triage-outcome", "referral-row", "waiting-list-note", "consent-to-share", "care-summary",
    "allergy-row", "immunisation-row", "observation-row", "discharge-note", "symptom-row",
  ],
};
