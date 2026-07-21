# Backend roadmap — built-app DB primitives (target: 93)

The per-site backend (`/api/db/<slug>/…` + `/api/site/backend/…`) gives every generated
app a ready backend layer, declared in `isibi.schema.json` and taught to the generator via
`BACKEND_RULES` (in `builder/react-gen.mjs`). Goal: ship the full ~93-item primitive set.

> The original 100-item artifact (AI category parked → 93) was never committed. This file
> is the **reconstructed** roadmap kept in-repo so the work is resumable. Ordering favors
> **owner-facing/automatic** (near-zero builder-prompt cost) first, then client-facing, then
> 🔑 provider-key-gated last. Update the DONE/REMAINING split as batches land.

## Verification note (this session)

Batches 16+ are offline-verified with the harness in `test/backend/` (runs the real
`worker.js` over in-memory `node:sqlite`), shipped as **branch + PR for the owner to run the
live pass and merge**. Earlier layers/batches (≤15) were verified live at $0.

---

## DONE (~53 / 93)

**Named layers:** Counters · Reactions · Profiles · Uniqueness constraints.

**Batches 1–15:** column default/enum/min-max/pattern + atomic incr (1) · soft-delete/trash
(2) · multi-sort + where-ops + tags (3) · bulk update/delete by filter (4) · password
strength + block/ban (5) · in-app notifications (6) · invite-only signup (7) · cursor
pagination (8) · JSON columns (9) · faceted filters + counts (10) · schema-evolution
backfill (11) · auto-slugs (12) · custom roles/RBAC (13) · per-row sharing/ACL (14) ·
optimistic concurrency (15).

**Batches 16–22:** updated_at timestamps + `?fields` + `?count` (16) ·
immutable fields + computed default tokens `@now`/`@today`/`@uuid` (17) · Follows social
graph (18) · `between` operator + `sort=random` (19) · ordered lists / manual positions +
`/move` reorder (20) · expiring rows / TTL (21) · pinned/featured + defaultSort (22) · app settings/config KV (23) · bookmarks/saves (24) · scheduled publish/drafts (25) · following feed (26) · maxRows quota + uniqueCI (27) · cross-field checks (28) · referential integrity (29) · child rollups (30) · reports/moderation (31) · computed columns (32) · polls (33).

---

## REMAINING (~56, ordered by build priority)

### A. Automatic / owner-facing (no keys) — do first
- [x] Ordered lists / manual positions (`"ordered":true` + `/move` reorder) — kanban, todo order (Batch 20)
- [x] Row `pin`/`feature` flag + pinned-first ordering + per-table defaultSort (Batch 22)
- [x] Expiring rows / TTL (`"expires":true`, auto-hidden past expires_at) — sales, stories, invites (Batch 21)
- [ ] Audit log (owner-facing `_audit` of writes; `GET /api/site/backend/audit`)
- [ ] Row history / change snapshots (per-row versions, revert)
- [x] Settings / config KV per app (`/api/db/<slug>/config`) + feature flags (Batch 23)
- [x] Feature flags per app (subsumed by config KV, Batch 23)
- [ ] CSV export (`/api/site/backend/export?format=csv`; JSON export exists)
- [ ] CSV/JSON import mapping niceties (import exists — add column mapping)
- [ ] Data seeding endpoint (owner seeds demo rows)
- [ ] Per-app rate-limit config (owner tunes the read/write caps)
- [ ] Aggregate "distinct values" endpoint niceties (facets exist — add plain distinct)
- [ ] Cascade options (set-null vs delete) per ref
- [x] Referential integrity (`"enforceRefs"`, reject fk to missing parent) (Batch 29)
- [x] Computed/derived read columns (`"computed"`) (Batch 32)
- [x] Unique case-insensitive constraint (`"uniqueCI"`) (Batch 27)
- [x] Cross-field validation rules (`"checks"`) (Batch 28)
- [x] Default sort per table (`"defaultSort"`) (Batch 22)
- [x] Max-rows / quota per table (`"maxRows"`, per-owner or global) (Batch 27)
- [ ] Soft "archive" state distinct from trash (status lifecycle helper)

### B. Client-facing app features (no keys)
- [x] Bookmarks/saves first-class primitive (/save, /saves) (Batch 24)
- [ ] Mentions parsing (@user → notification)
- [x] Following/home feed (?following=1 on feed reads) (Batch 26)
- [ ] Block another member
- [ ] Report/flag content → moderation queue (owner review)
- [x] Polls (first-class, one-per-user) (Batch 33)
- [ ] Comment threading depth helper (relations exist — add depth/tree read)
- [ ] Many-to-many join helper (declare a link table + `?via=`)
- [x] Reverse-relation rollups (`?rollup=child:agg:col`) (Batch 30)
- [ ] Nearby / geo search (lat,lng radius)
- [ ] Presence / who's-online
- [ ] Realtime edits+deletes diff (changes covers appends — add updates)
- [ ] File upload to R2 per app (`/api/db/<slug>/upload`) + metadata
- [ ] Signed upload URLs
- [ ] Image resize/transform on upload (photon is available)
- [ ] Full-text search index (LIKE `q` exists — add ranked FTS)
- [ ] Saved views / filters per member
- [ ] Row-level view counts (built on counters convention)
- [x] Scheduled publish / drafts (`"publishable":true`, publish_at) (Batch 25)
- [x] Scheduled publish (publish_at) (Batch 25)

### C. Auth / account (mostly no keys; verify live)
- [ ] Change password (self-serve, visitor)
- [ ] Change email (self-serve, visitor)
- [ ] Delete own account (visitor)
- [ ] Email verification enforcement (columns + link exist — add gate)
- [ ] Account lockout after N failed logins (columns exist — wire it)
- [ ] Session list + revoke ("log out other devices")
- [ ] Per-user rate limiting / throttle
- [ ] API keys for app-to-app access
- [ ] Magic-link / OTP login 🔑 (needs mailer — mailer exists)
- [ ] Password reset polish (exists — confirm + document)

### D. Comms / jobs
- [ ] Outbound webhooks on row events
- [ ] Scheduled functions / cron (functions have `schedule` — verify + document)
- [ ] Email send as a function step 🔑 (mailer exists)
- [ ] Web push 🔑
- [ ] SMS 🔑

### E. Commerce 🔑 (needs Stripe on the built app)
- [ ] Checkout for built apps
- [ ] Orders helper
- [ ] Cart
- [ ] Inventory decrement (atomic — incr exists)
- [ ] Coupons / discounts

### F. Integrations 🔑
- [ ] OAuth social login (Google/GitHub)
- [ ] 2FA / TOTP

---

## Conventions for adding a layer (learned the hard way)
- A NEW **table-level** schema key must be forwarded in **both** `normalizeSchema`/
  `coerceTable` (~line 2712) **and** the persisted `norm.push({…})` (~line 2841), else it's
  dropped before it reaches the request-time `def` (loaded from `_meta`). Column-level keys
  survive via `coerceCol`.
- Read modifiers that live in `buildD1Filter`/`buildD1List` apply to ALL read paths at once
  (lowest-risk place to add query features).
- Joins/attachments hang off `doExpand`; keep opt-in (a `?flag`) so default reads stay lean.
- New `/api/db/<slug>/<verb>` routes mirror the Reactions/Follows/Notifications blocks
  (regex → siteBackendBySlug → optional site-user token → handler).
- Keep `BACKEND_RULES` additions tight (prompt-bloat is a real cost) — fold into an existing
  line when you can; favor automatic/owner-facing layers that cost the builder ~nothing.
- Offline-verify with `test/backend/` before the PR; owner runs the live pass before merge.
