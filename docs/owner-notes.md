# Owner Notes

Running record kept for the owner (aniascapital@gmail.com). Two purposes:
1. **Bug log** — things the owner found broken or not-as-wanted, tracked to resolution.
2. **How the owner likes things done** — durable preferences/patterns so a fresh
   session doesn't have to relearn them.

Future sessions: **read this file at the start.** Update it as bugs are reported
and fixed, and add a preference line whenever the owner signals one.

---

## 2026-07-21 — BACKEND ROADMAP: building the "100 more" list (AI parked)

Owner wants the whole 100-item backend roadmap built (AI category skipped for now).
Shipping in cohesive batches, each verified live at $0 (bare `ensure`+`schema`
backends, deleted after). A roadmap artifact was produced (100 items, categorized,
effort/value tagged). Running tally:

- **Batch 1 — validation & integrity** (PR #533, live 16/16): column `default`,
  `enum`, `min`/`max` (numeric bounds / text length), `pattern` regex — all enforced
  server-side (bad value → 400). **Atomic column increment** `POST /rows/<t>/<id>/incr
  {col,by,min?}` (race-free, floor optional, own-row/admin scope).
- **Security review** (PR #534): adversarial 5-finder workflow + verify over ALL the
  session's new layers. No injection / authz / leak / critical found. Two low-sev fixes:
  `coerceCol` dropped `max:0` via `||` falsiness (now `!== undefined`); feed/user POST
  now reject empty/junk-only bodies (matches collect/admin).
- **Batch 2 — soft-delete / trash / restore** (PR #535, live 17/17): table `"trash":true`
  → `deleted_at`; DELETE soft-hides (`?hard=1` = permanent), reads exclude trashed by
  default (`?trashed=1` / `?withTrashed=1`), `POST /rows/<t>/<id>/restore`. Threaded
  through list + get-by-id + stats + scoped delete/restore.
- **Batch 3 — query power + tags** (this PR): multi-column sort (`sort=-price,name`),
  where operators `startswith|endswith|in|nin|isnull|notnull`, and **Tags** (`_tags`:
  add/remove/list per row, `?tag=` filter, `?tags=1` attach — same write scope as the row).

Progress: ~8 of 93 roadmap items shipped. 🔑-flagged items (OAuth, SMS, web push,
Stripe extensions) will need the owner's provider keys for live verification — batched
toward the end.

**Batches 4–8 (all shipped + verified live, no keys):**
- **Batch 4 — bulk update/delete by filter** (PR #538, 14/14): `PATCH`/`DELETE
  /rows/<t>?where=…` acts on every matching row → `{updated/deleted:N}`. Rails: a
  filter is REQUIRED, capped 1000/call, scoped to own rows (feed/user), trash-aware.
- **Batch 5 — password strength + block/ban** (PR #539, 15/15): signup rejects weak
  passwords; `_users.blocked` (owner endpoint `/api/site/backend/member` block|unblock|
  make_admin|remove_admin) — blocked can't log in + kicked on next `/auth/me`.
- **Batch 6 — in-app notifications** (PR #540, 14/14): per-app `_notifications`, member
  reads own inbox `GET …/notifications[?unread=1]` + `/read` + `/read-all`; created
  server-side ONLY via a `{do:notify,to,type,text,link}` function step (usually an
  on-insert trigger). Completes the social stack (profiles+reactions+tags+notifications).
- **Batch 7 — invite-only signup** (PR #541, 13/13): owner endpoint
  `/api/site/backend/invites` enable|disable|create(count,uses)|list|revoke; signup
  requires a valid `invite` code (atomic redeem) except the bootstrap admin →
  403 `{need:'invite'}`.
- **Batch 8 — cursor pagination** (PR #542, 7/7): keyset `?after=<lastRowId>` / `?before=`
  for stable "load more" on big lists (alongside limit/offset).
- **Batch 9 — JSON/array/object columns** (PR #543, 14/14): declare `type:"json"`
  (aliases `array`/`object`) → the platform JSON-stringifies on write & re-parses on
  read across EVERY path (single/list/batch/realtime). Store a whole nested object or
  list in one column (order line-items, settings blob). Backed by TEXT; `def.json`
  drives (de)serialization. Can't `where=` into it (use a `ref` table if you must query
  the inner rows).
- **Batch 10 — faceted filters + counts** (PR #544, 9/9): `GET …/rows/<t>/facets?fields=
  color,size` → `{facets:{color:[{value,count}],…}}` (top 100/col by count) for filter
  sidebars ("Red (12)·Blue (4)"). Respects the SAME where/q/tag/trash + read visibility,
  so counts drill down as filters tick. Pure read, no write-path risk.
- **Batch 11 — schema-evolution column backfill** (PR #545, 8/8): fixes the footgun below.
  `applySiteSchema` now ALTER-adds `owner_id`/`deleted_at` (idempotent) after the
  `CREATE IF NOT EXISTS`, so revising a table's access (display→feed/user) or turning on
  `trash` backfills the required columns instead of silently breaking scoped writes.
- **Batch 12 — auto-slugs / pretty URLs** (PR #546 + fix #547, 8/8): table-level
  `"slug":"title"` → the platform fills a UNIQUE url-safe `slug` column on insert
  ("My First Post!"→`my-first-post`, `-2/-3` on collision, batch-deduped, diacritics
  folded, empty→`item`). Wired into ALL insert paths (single/batch/upsert); edits never
  re-slug; apps route via `?where=slug:eq:`. **Fix #547:** `normalizeSchema` was
  stripping the new `slug` table key (it only forwarded unique/oncePerUser/trash) — the
  column was created but never populated; caught by the live test, now threaded through.
- **Batch 13 — custom roles / RBAC** (PR #548, 10/10): an `admin`-access table can declare
  `"writeRoles":["editor","admin"]` so those custom roles may write (built-in `admin` is
  always superuser). Centralized the 5 admin write-auth sites into one
  `siteRoleAllows(env,uuid,userId,def)`. Owner `/member` gained `set_role` (assign any
  role, validated). Role assignment is owner-only (no in-app self-serve = no priv-esc).
  Note: the FIRST signup on any built app auto-becomes `admin` (bootstrap) — expected.
- **Batch 14 — per-row sharing / ACL** (PR #549, N/N): on a `user`-access table the row
  OWNER shares one record with specific members — `POST …/rows/<t>/<id>/share
  {user:email|id, perm:'view'|'edit'}`, `DELETE …/share/<memberId>`, `GET …/share`.
  Recipient reads it via the normal single-GET; lists everything shared with them via
  `?shared=1`; `edit`-shares may PATCH, `view` is read-only, DELETE stays owner-only.
  New `_shares` table (PK row_table,row_id,user_id). Default owner-only reads unchanged
  (no leak) — sharing is purely additive.

- **Batch 15 — optimistic concurrency / no lost updates** (PR #550): table `"version":true`
  → a `_version` col that auto-bumps on each single-row PATCH and is returned on reads
  (`row._version`). Client sends `?ifVersion=N` (or `If-Match`) → stale write refused with
  409 `{code:'conflict', version}`; success returns `{version:new}`; omit to force last-writer-
  wins. Wired into all 3 single-PATCH branches (feed/admin/user + the edit-share collaborator
  path) via one `applyVersionedUpdate` helper. Completes the collaboration story (sharing +
  RBAC made concurrent edits possible; this makes them safe). Scoped to single-row PATCH
  (bulk/incr don't version). New table-key `version` threaded through normalizeSchema.

Also a mid-run **security review** (PR #534) over batches' new code: no injection/
authz/leak/critical; fixed `max:0` falsiness + blank feed/user writes. Roadmap tally:
~31 of 93 shipped. Each verified via bare `ensure`+`schema` test backends ($0), deleted.
**Lesson (recurring):** any NEW table-level schema key must be forwarded in
`normalizeSchema`/`coerceTable` (line ~2712) AND in the persisted `norm.push({…})`
(line ~2841) or it's silently dropped before `applySiteSchema` (the second half of the
lesson: even if it reaches `applySiteSchema` and creates the column, the request-time
`def` is loaded from `_meta` and won't carry the flag unless `norm` includes it) —
column-level keys survive via `coerceCol`, table-level ones don't.

## 2026-07-21 — CONTINUING THE ROADMAP (session picked up "keep going until 93")

Owner: finish the backend roadmap (~31 → 93). Original 100-item artifact was never
committed (lived in a prior session), so remaining items are being reconstructed from
the shipped tally + standard backend primitives, favoring OWNER-FACING/AUTOMATIC layers
(near-zero builder-prompt cost) first, then client-facing, then 🔑 key-gated (Stripe/
OAuth/SMS/push) last. This session CAN'T live-verify (no deployed test backend + auth
token), so batches are shipped **branch + PR for the owner to verify/merge** (owner's
call), each **offline-verified** against a new harness instead of live.

**NEW: offline backend harness** (`scratchpad/bh/` this session — consider committing to
`test/backend/` if it keeps proving useful). Imports the REAL `worker.js` default fetch
handler unmodified (an ESM loader stubs the two native deps `@cf-wasm/photon` +
`@cloudflare/containers`) and backs Cloudflare D1 with in-memory `node:sqlite`, plus a
fetch mock for the `site_backends` slug→uuid ledger and owner auth. So `ensure`→`schema`
→signup→auth'd insert→list→patch all run the actual route code end-to-end offline. This
is the quality gate now; the owner still does the real live pass before merge.

## 2026-07-21 — Batch 16: edit-tracking + read-shaping (offline 17/17 + reg 5/5) ✅ built, PR

Three additive, mostly-automatic primitives (PR on `claude/chat-session-xy6jwe`):
- **`"timestamps":true`** (table flag; aliases updatedAt/updated_at/timestamp) → auto
  `updated_at` column, set on insert (= created) via CREATE default, **bumped to now on
  EVERY edit** — single PATCH (via `applyVersionedUpdate`, so it also covers the
  share-edit collaborator path), bulk PATCH, and incr. Returned on reads. Fully automatic,
  zero app code. Threaded through `normalizeSchema` + `norm` + CREATE/ALTER (ALTER can't
  carry a `datetime()` default, so existing rows are backfilled `= created_at`; the only
  caveat is a NEW insert on a table REVISED to add timestamps gets `updated_at` on its
  first edit — fresh tables are perfect).
- **`?fields=a,b`** — sparse field selection on any list/get: returns only those columns
  (plus `id`, always). Applied LAST after all joins, so opt-in attached objects
  (author/children/_counts/expanded refs/reactions/tags) are always kept; it only trims
  the row's own columns. Unknown names ignored.
- **`?count=<child>`** — attaches `row._counts.<child>` = how many children reference each
  row, WITHOUT fetching them (feed shows "12 comments" cheaply). Batched grouped COUNT,
  public-read children only (no private leak), trash-aware. Peer of `?children`.
BACKEND_RULES got ONE tight combined line (prompt-bloat-aware). Roadmap tally: ~32/93.

## 2026-07-21 — Batch 17: write integrity — immutable fields + computed defaults (offline 13/13) ✅ built, PR

Two cohesive write-integrity primitives (same PR/branch):
- **`"immutable":true`** (column flag; aliases readonly/readOnly/writeOnce) → write-once: a
  field is settable on INSERT but any later edit that includes it → 400 "can't be changed".
  Enforced in `validateRow` on `!isInsert` (covers single + bulk PATCH, both call it) and
  in the `incr` path (an immutable numeric can't be incremented). Threaded via `coerceCol`
  → `rules[col].immutable`. Use for an email, a created price, an order number.
- **Computed default tokens** — a column `"default"` of `"@now"`/`"now"`/`"timestamp"` →
  `datetime('now')`, `"@today"`/`"today"` → `date('now')`, `"@uuid"`/`"uuid"` → a random
  uuid-shaped id. Emitted as a SQL DEFAULT *expression* in CREATE TABLE, so the DB fills it
  when the writer omits the field — NO insert-path plumbing. A provided value still wins;
  a plain literal default is unchanged (these words are reserved when used as a default).
  Same ALTER caveat as updated_at (a table REVISED to add one gets it only on fresh CREATE).
BACKEND_RULES: folded into the existing schema-column-rules line (no new bullet).
Roadmap tally: ~34/93.

## 2026-07-21 — Batch 18: NEW LAYER Follows (member social graph) (offline 12/12) ✅ built, PR

Mirrors the proven Reactions primitive but over the MEMBER graph (not rows), so risk is
low. New `_follows (follower_id, followee_id)` PK-deduped table in each site D1:
- `POST /api/db/<slug>/follow/<userId>` (auth) → toggles, `{following, followers}`
  (`{on:true|false}` forces). Can't follow yourself. Idempotent (PK).
- `GET …/follow/<userId>` → `{followers, following, mine}` (Bearer → `mine`).
- `GET …/follow/<userId>/followers` and `/following` → arrays of public profiles
  (batched, safe columns) for "Followers"/"Following" pages.
Helpers `ensureFollows`/`toggleFollow`/`followState`/`followList` sit beside the reactions
helpers. BACKEND_RULES: one new social line (after PROFILES). Roadmap tally: ~35/93.

## 2026-07-21 — Batch 19: query power II — `between` + `sort=random` (offline 7/7) ✅ built, PR

Both live inside the shared `buildD1Filter`/`buildD1List`, so EVERY read path (list/stats/
facets/bulk, all access modes) gets them for free — one-place, low-risk changes:
- **`where=<col>:between:lo:hi`** (also `lo,hi`) → inclusive range `col >= lo AND col <= hi`
  (price bands, date windows, score ranges). Both bounds required else the clause is ignored;
  values bind as-is (SQLite affinity handles numeric vs text). Added to the operator regex.
- **`sort=random`** (aliases `rand`/`shuffle`) → `ORDER BY RANDOM()`, for discover/featured/
  shuffle surfaces (pair with a small `limit`). Overrides relevance/explicit sort; not for
  pagination (each page reshuffles).
BACKEND_RULES: folded into the existing QUERY line. Roadmap tally: ~37/93.

## 2026-07-21 — Batch 20: NEW LAYER Ordered lists / manual positions (offline 11/11) ✅ built, PR

Drag-to-reorder (todos, kanban, playlists, galleries):
- Table flag **`"ordered":true`** (aliases position/sortable/reorderable) → adds a `position`
  REAL column, auto-assigned to the END of its scope on insert by an **AFTER INSERT trigger**
  (`trg_<t>_pos`, per-owner on user/feed via `owner_id IS NEW.owner_id`, global otherwise) —
  zero insert-path plumbing. Existing rows backfilled `position=id`.
- **`POST …/rows/<t>/<id>/move`** with `{after:<id>}` / `{before:<id>}` (midpoint between the
  neighbour and the next row on that side — REAL, so no renumber) or `{to:<n>}` (absolute).
  Scoped like writes (feed/user own rows, admin any, display/collect 403). Added `move` to the
  rows sub-route regex.
- Apps read with `?sort=position`. **Bonus fix:** auto-managed columns (`position`,
  `updated_at`, `_version`) weren't in the sortable/filterable set — added a `listExtras`
  param threaded into `buildD1Filter`/`buildD1List` so `?sort=position|updated_at|_version`
  now works (this was needed for ordered lists to be visible, and helps Batches 15/16 too).
BACKEND_RULES: one new line (after TRASH). Roadmap tally: ~38/93.

## 2026-07-21 — Batch 21: NEW LAYER Expiring rows / TTL (offline 8/8 + trash reg 4/4) ✅ built, PR

Flash sales, 24h stories, one-time invites, temp share links:
- Table flag **`"expires":true`** (aliases ttl/expiry/expiring) → adds `expires_at` (app-set,
  so it's added to the writable/queryable/sortable `allow` list). Reads hide rows past their
  `expires_at`; NULL = never. `?expired=1` / `?withExpired=1` mirror trashed/withTrashed.
  Comparison via SQLite `datetime()` (normalizes ISO vs 'YYYY-MM-DD HH:MM:SS', no bound param).
  Renew by PATCHing expires_at later. Hidden not deleted (sweep via a scheduled function).
- **Mechanism refactor:** folded expiry into the trash-visibility path — `trashClause` +
  new param-free `expiresClause` compose into `visClause`; `withTrash` → **`withVisible`**
  (covers list/stats/facets/bulk/single-GET at once). Trash behavior unchanged (reg 4/4).
BACKEND_RULES: one new line (after ORDERED LISTS). Roadmap tally: ~39/93.

## 2026-07-21 — Batch 22: pinned/featured rows + per-table defaultSort (offline 8/8) ✅ built, PR

Both are list-ordering defaults, localized to `buildD1List` (via a new `opts` param):
- **`"pinnable":true`** → adds a `pinned` INTEGER (app-set, added to the writable/queryable/
  sortable allow list); pinned rows float to the TOP of every order (`pinned DESC` prepended
  to orderSql), sticky posts / featured products. Survives explicit sorts and shuffle.
- **`"defaultSort":"-created_at"`** (sanitized string, same prefix convention as `?sort`) →
  used when the request sends no `sort`; per-query `?sort` still overrides. Threaded through
  coerceTable/norm.
This is the first batch of the post-merge run (16–21 merged to main via #551). Opens a new PR.
Roadmap tally: ~40/93.

## 2026-07-21 — Batch 23: NEW LAYER App settings / config KV (offline 15/15) ✅ built, PR #552

Every app needs a settings/feature-flag store (theme, hero text, toggles). Self-contained
like Counters — new `_config (k,v,updated_at)` table per site D1:
- `GET /api/db/<slug>/config` → `{config:{k:value}}` · `GET …/config/<key>` → `{value}`
  (PUBLIC — the app renders from it).
- `POST …/config/<key> {value}` / `DELETE …/config/<key>` — **admin site-user only** (role
  check inline). Values stored as JSON so booleans/numbers/objects round-trip.
Helpers `ensureConfig`/`readConfig`/`writeConfig`/`parseConfigVal`. Subsumes "feature flags"
(a config bool). BACKEND_RULES: one line (after FOLLOWS). Roadmap tally: ~42/93. On PR #552.

## 2026-07-21 — Batch 24: NEW LAYER Bookmarks / saves (offline 13/13) ✅ built

Mirrors Follows/Reactions but PRIVATE to each member. New `_bookmarks (user_id, target)`
PK-deduped table:
- `POST /api/db/<slug>/save/<table>:<id>` (auth) → toggle `{saved, count}`; `{on}` forces.
- `GET …/save/<target>` → `{count, mine}` (Bearer → mine).
- `GET …/saves[?table=<t>&limit=N]` (auth) → the caller's saved items `[{target, table, id,
  created_at}]` newest-first; the app then loads rows via `?where=id:in:…`.
Helpers ensureBookmarks/toggleBookmark/bookmarkState/bookmarkList. One BACKEND_RULES line.
Roadmap tally: ~43/93.

## 2026-07-21 — Batch 25: Scheduled publish / drafts (publish_at) (offline 7/7) ✅ built

Inverse of TTL, reuses the visibility mechanism: `"publishable":true` (aliases scheduled/
publish_at) → adds `publish_at` (app-set, in the writable/sortable allow list). Reads HIDE
rows whose publish_at is in the FUTURE; NULL/past = live. `?scheduled=1` = drafts view,
`?withScheduled=1` = all. `publishClause` folds into `visClause` alongside trash + expiry.
Roadmap tally: ~44/93.

## 2026-07-21 — Batch 26: Following feed (?following=1) (offline 7/7) ✅ built

The home/timeline primitive: on a `feed` list read a signed-in caller adds `?following=1` to
get ONLY rows whose owner_id is someone they follow (`owner_id IN (SELECT followee_id FROM
_follows WHERE follower_id=?)` — ensures the Follows table first). Composes with where/q/sort/
pagination; empty if they follow nobody; ignored when signed out. One line in the feed GET
branch. Roadmap tally: ~45/93.

> ⚠️ NOTE TO FUTURE SESSIONS: do NOT edit this file with `perl -0pi` + a unicode `\x{…}`
> literal — it re-encodes the whole file as latin1 and mojibakes every em-dash/emoji (had to
> restore from git in Batch 26). Use the Edit tool for prose; perl only for ASCII-only ticks.

## 2026-07-21 — Batch 27: Integrity II — maxRows quota + case-insensitive unique (offline 14/14) ✅ built

Both DB-enforced (no insert-path plumbing), mirroring the trigger/index patterns:
- **`"maxRows":N`** → a BEFORE INSERT trigger `SELECT RAISE(ABORT,'row limit reached')` once
  the count hits N (scoped per-owner on user/feed via `owner_id IS NEW.owner_id`, global
  otherwise). The abort maps to a clean **409 `{code:'limit'}`** in the data-api catch. Free-
  tier caps, "max 100 todos per user".
- **`"uniqueCI":["handle"]`** → `CREATE UNIQUE INDEX ON t (lower(col))` — case-insensitive
  uniqueness (usernames/emails), race-free, surfaces as the existing 409 `{code:'duplicate'}`.
Carried through coerceTable (enforcement is index/trigger, so norm not needed). Roadmap: ~47/93.

## 2026-07-21 — Batch 28: Cross-field validation checks (offline 7/7) ✅ built

Table-level **`"checks":[["end_at","gte","start_at"],["capacity","gt","reserved"]]`** (ops
gt/gte/lt/lte/eq/ne) enforced in `validateRow`: numeric compare when both parse as numbers,
else string/ISO-date. Enforced when BOTH fields are in the body — always on a full insert; on
a partial PATCH only if it carries both (documented limitation: one-field update can't compare
against the stored other). Carried via coerceTable + norm (validateRow reads request-time def).
Roadmap tally: ~48/93.

## 2026-07-21 — Batch 29: Referential integrity (enforceRefs) (offline 7/7) ✅ built

Table flag **`"enforceRefs":true`** → a BEFORE INSERT and BEFORE UPDATE-OF trigger per `ref`
column that RAISEs when the fk is set but the parent id doesn't exist; abort maps to a clean
**400 `{code:'ref'}`** in the data-api catch. NULL fk allowed (optional link). Complements the
delete-time cascade. Trigger-based (no write-path plumbing); carried via coerceTable. Roadmap
tally: ~49/93.

## 2026-07-21 — Batch 30: Reverse-relation rollups (?rollup=child:agg:col) (offline 10/10) ✅ built

Extends `?count` (Batch 16) to AGGREGATE a child column onto each parent without fetching the
children: `?rollup=line_items:sum:amount,reviews:avg:rating` → `row._rollups.line_items.sum.amount`,
`row._rollups.reviews.avg.rating` (count → `._rollups.<child>.count`). agg ∈ sum/avg/min/max/
count. `attachRollups` beside `attachCounts` in `doExpand`; batched grouped aggregate per spec,
public-read children only, trash-aware, invalid specs ignored. Roadmap tally: ~50/93.

## 2026-07-21 — Batch 31: NEW LAYER Reports / flags + moderation queue (offline 15/15) ✅ built

UGC safety: members flag content, the app admin reviews. New `_reports (id, target,
reporter_id, reason, status, UNIQUE(target,reporter_id))`:
- `POST /api/db/<slug>/report/<table>:<id> {reason}` (auth) → flag, deduped per member →
  `{reported, count}`; `GET …/report/<target>` → `{count, mine}`.
- `GET …/reports[?status=open|all]` (ADMIN role) → the moderation queue with reporter names;
  `POST …/reports/<id> {action:resolve|dismiss|reopen}` (admin) updates status.
Helpers ensureReports/createReport/reportState. Admin gate = inline role check (like config).
One BACKEND_RULES line. Roadmap tally: ~51/93.

## 2026-07-21 — Batch 32: Computed / derived read columns (offline 7/7) ✅ built

Table-level **`"computed":{"full_name":["first_name"," ","last_name"]}`** → on READ each
template token that names a column (declared OR managed: id/created_at/owner_id/updated_at/
slug/position/pinned) becomes that row's value; anything else is a literal. Assembled in JS
(`attachComputed` in doExpand, after parseJsonRows) — no SQL, no injection; read-only (a
written value of that name is ignored, always recomputed). NULLs → "". Carried via
coerceTable + norm. Roadmap tally: ~52/93.

## 2026-07-21 — Batch 33: NEW LAYER Polls (offline 9/9) ✅ built

One-vote-per-member polls (mirrors reactions). New `_polls (poll, option, user_id,
PK(poll,user_id))` — re-voting UPDATES the member's option (real one-per-user):
- `POST /api/db/<slug>/poll/<poll>/<option>` (auth) → cast/change → `{counts, total, mine}`.
- `GET …/poll/<poll>` → tally (Bearer → mine); `DELETE …/poll/<poll>` (auth) → withdraw.
Helpers ensurePolls/pollState/votePoll/unvotePoll. poll + options are app strings. One
BACKEND_RULES line (after REACTIONS). Roadmap tally: ~53/93.

## 2026-07-21 — Batch 34: Account self-service (offline 15/15) ✅ built

New `/api/db/<slug>/auth/(password|email|account)` on the Phase-C visitor auth, each
RE-VERIFYING the current password (a stolen token alone can't change/delete):
- `POST …/auth/password {current_password, password}` → change password (strength-checked),
  returns a fresh token.
- `POST …/auth/email {password, email}` → change email (collision-checked, resets verified),
  fresh token.
- `DELETE …/auth/account {password}` → delete the member + their owned rows (every user/feed
  table) + their social side-rows (_follows/_bookmarks/_reactions/_polls/_reports/_shares/
  _notifications).
One BACKEND_RULES line (after INVITE-ONLY). Roadmap tally: ~54/93.

## 2026-07-21 — Batch 35: Email-verification enforcement (offline 6/6) ✅ built

Table flag **`"requireVerified":true`** → a signed-in member must have confirmed their email
(`_users.verified`) before ANY write to that table; unverified → 403 `{code:'unverified'}`.
Single choke point right after userId is resolved in the rows handler (covers POST/PATCH/
DELETE across every access branch); reads unaffected. Carried via coerceTable + norm.
Note: account **lockout** (8 failed logins → 15-min lock) was ALREADY implemented in the
login path — marked done in the roadmap, no new code. Roadmap tally: ~56/93.

## 2026-07-21 — Batch 36: NEW LAYER Block another member (offline 12/12) ✅ built

`_blocks` PK(blocker_id, blocked_id): `POST /block/<userId>` toggle → `{blocking}` (also
DELETEs any follow edge both ways), `GET /block/<userId>` → `{blocking}`, `GET /blocks` →
your blocked ids. Teeth: **`?hideBlocked=1`** on a feed read excludes blocked authors
(`owner_id NOT IN (…)`), composing with `?following=1` (refactored the feed audience filters
into a composable list). Helpers ensureBlocks/toggleBlock/blockState/blockedIdList. One
BACKEND_RULES line. Roadmap tally: ~57/93.

## 2026-07-21 — Batch 37: NEW LAYER Audit log (offline 9/9) ✅ built

Table flag **`"audit":true`** → AFTER INSERT/UPDATE/DELETE triggers append to a shared
`_audit (row_table, row_id, action, actor_id, at)` — zero write-path plumbing. Actor =
NEW/OLD.owner_id on user/feed tables, else NULL. App admin reads at **`GET /api/db/<slug>/
audit[?table=&action=&limit=]`** (inline admin role check, newest-first, filterable).
Carried via coerceTable; triggers created in applySiteSchema after the ref-integrity block.
Roadmap tally: ~58/93.

## 2026-07-21 — Batch 38: Data export CSV/JSON (offline 11/11) ✅ built

**`GET /api/db/<slug>/export/<table>[?format=csv|json&limit=N]`** (admin site-user) returns
the table as a downloadable file (Content-Disposition attachment). CSV = union of keys +
RFC-4180 escaping (`"` doubled, quoted when it contains comma/quote/newline), CRLF rows;
JSON = array (json columns parsed). Cap 50k rows. Complements the existing OWNER-side
`/api/site/backend/export`. Roadmap tally: ~59/93.

## 2026-07-21 — Batch 39: NEW LAYER Presence / who's-online (offline 10/10) ✅ built

`_presence (user_id PK, at)`: `POST /presence` (auth heartbeat), `GET /presence[?within=5]`
→ members pinged in the last N min (joined to profiles), `GET /presence/<userId>` →
`{online, last_seen}`. Online = `datetime(at) > datetime('now','-N minutes')` (node:sqlite
supports the modifier). within capped 1–60. Helpers ensurePresence/touchPresence/onlineList/
presenceOf. One BACKEND_RULES line. Roadmap tally: ~60/93.

## 2026-07-21 — Batch 40: Row history + revert ("history":true) (offline 12/12) ✅ built

Table flag → a BEFORE UPDATE trigger snapshots the OLD data columns as JSON (`json_object(
'col', OLD."col", …)`) into a shared `_history` on every edit — no write-path plumbing.
`history`/`revert` added to the rows sub-route regex. The row's OWNER (feed/user) or an admin
reads `GET /rows/<t>/<id>/history` (newest-first) and restores via `POST /rows/<t>/<id>/revert/
<historyId>` (restores the snapshot's declared columns; the revert UPDATE itself re-snapshots,
so it's undoable). Carried via coerceTable + norm. Roadmap tally: ~61/93.

## 2026-07-21 — Batch 41: NEW LAYER Saved views / filters per member (offline 10/10) ✅ built

Private per-member named JSON query configs (saved searches, filter sets, dashboards). New
`_views (user_id, name, spec, PK(user_id,name))`: `POST /views/<name> {spec}`, `GET /views`,
`GET /views/<name>`, `DELETE /views/<name>` — all auth, spec is arbitrary JSON. Helpers
ensureViews/saveView/listViews/getView/deleteView (mirrors the config KV pattern but per-user).
One BACKEND_RULES line. Roadmap tally: ~62/93.

## 2026-07-21 — Batch 42: Cascade onDelete modes (offline 8/8) ✅ built

Column-level **`"onDelete"`** on a fk: `cascade` (default, existing behavior), `setNull` (keep
children, null their fk), `restrict` (block the parent delete while children exist → 409
`{code:'restrict'}`). Threaded via coerceCol → per-table `refModes` in norm → `childRefsOf`
returns the mode → `cascadeDeleteRow` unlinks/deletes/refuses accordingly; restrict throws a
tagged error mapped to 409 in the data-api catch. Roadmap tally: ~63/93.

## 2026-07-21 — Batch 43: Per-member write rate limit (offline 8/8) ✅ built

Table flag **`"rateLimit":N`** (aliases writeLimit/throttle/maxPerMinute) → each member may
make at most N writes/min to that table (anti-spam). Single choke point beside the
requireVerified gate (POST/PATCH/DELETE, keyed `slug|urate|table|userId` through the existing
`rateOk`); over the cap → 429. Carried via coerceTable + norm. Roadmap tally: ~64/93.

## 2026-07-21 — Batch 44: Nearby / geo search (offline 9/9) ✅ built

`GET /rows/<t>/near?lat=&lng=&radius=<km>[&limit=]` (added `near` to the rows sub-route group).
Table declares `"geo":{"lat":"latitude","lng":"longitude"}` or auto-detects lat/lng(/lon/
longitude). A SQL bounding-box prefilter (± radius/111.32°, lng adjusted by cos(lat), no trig
needed) narrows candidates (cap 2000), then JS haversine filters to the exact radius, attaches
`row._distance_km`, sorts nearest-first, pages. Respects read visibility + user scope. Gotcha
fixed: `Number(null)===0` so missing lat/lng must be checked as empty, not via isFinite.
Roadmap tally: ~65/93.

## 2026-07-21 — Batch 45: Threaded/nested tree read (offline 8/8) ✅ built

`GET /rows/<t>/tree` (added `tree` to the rows sub-route group) for a SELF-REFERENTIAL table
(a column whose `ref` points at its own table, e.g. comments.parent_id → comments). Fetches
all rows (cap 2000, visibility + user scope), runs authors/reactions/tags/computed on the flat
set, then nests them: each row gets a `replies` array (`byId` map, guards self-parent cycles).
`?root=<id>` returns one subtree. Roadmap tally: ~66/93.

## 2026-07-21 — Batch 46: NEW LAYER Many-to-many links (offline 11/11) ✅ built

Generic undirected relationship store `_links (a, b, PK(a,b))` where a/b are `<table>:<id>`
(pairs normalized/sorted so one edge per pair, queryable from either side): `POST /link {a,b}`
(auth), `DELETE /link {a,b}` (auth), `GET /links/<target>[?to=<table>]` → linked items
`[{target,table,id}]`. Helpers ensureLinks/addLink/removeLink/linksOf. Saves declaring a join
table for a plain M2M (use a real join table when the link carries its own data). Roadmap
tally: ~67/93.

## 2026-07-21 — Batch 47: Soft archive ("archivable":true) (offline 10/10) ✅ built

Gmail-style archive, distinct from trash: `archived_at` column, `archivedClause` folds into
`visClause` (default hides archived; `?archived=1` / `?withArchived=1`). `POST /rows/<t>/<id>/
archive` sets archived_at=now, `/unarchive` clears it (added `archive|unarchive` to the sub-
route action group; same write scope as the table). Carried via coerceTable + norm. Reuses the
trash/expiry/scheduled visibility mechanism (regressions green). Roadmap tally: ~68/93.

## 2026-07-21 — Batch 48: Mentions → notifications (offline 8/8) ✅ built

`POST /api/db/<slug>/mention {target, users:[ids], text?}` (auth) drops a `mention`
notification (via the existing `createNotification`) into each listed member's inbox. Anti-
spam: ≤10 recipients/call, rate-limited 20/min, self excluded, unknown ids skipped, and
deduped per (recipient, target) within an hour. The app resolves @handles → ids client-side.
Roadmap tally: ~69/93.

## 2026-07-21 — Batch 49: File upload per-app (offline 7/7) ✅ built

Added **`POST /api/db/<slug>/upload {name, data}`** → `{url, name, type, size}` — a per-app,
API-consistent mirror of the existing platform `/api/site/upload` (same validation: PNG/JPG/
WebP/GIF + PDF, ≤6MB, 300/site cap, served at `/u/<slug>/…`). "Live" is proven by an R2
`sites/<slug>/index.html` OR a D1 backend for the slug (so React apps qualify). Documented in
the React BACKEND_RULES (was only in the static SITE_RULES). Signed-upload-URLs marked
covered: the direct base64→public-URL model is the platform's upload path (no presign needed).
Harness gained a `head()` on the mock bucket. Roadmap tally: ~71/93.

## 2026-07-21 — Batch 50: coverage pass — mark already-delivered roadmap items done ✅

Honest audit: five roadmap items are ALREADY implemented by existing endpoints; confirmed in
code and marked done (no redundant new code):
- **Distinct values** → the FACETS endpoint (`/rows/<t>/facets?fields=<col>`) returns each
  value + count; a plain distinct is `facets[col].map(v => v.value)`.
- **Data seeding** → batch insert `POST /rows/<t> {rows:[…]}` (insertMany, ≤100/call).
- **Row-level view counts** → the Counters layer (`POST /count/views:post:<id>`), already in
  BACKEND_RULES.
- **Password reset** → the Phase-C `/auth/reset-request` + `/auth/reset` endpoints exist.
- **Scheduled functions / cron** → `isibi.functions.json` functions support `schedule`
  (documented in the React BACKEND_RULES functions section).
Remaining after this: mostly 🔑 provider-key-gated (commerce ×5, OAuth, 2FA, email/push/SMS —
need the owner's keys + can't be live-verified here) plus a few invasive infra items (session
revoke, API keys, outbound webhooks, ranked FTS, image resize, realtime edit/delete diff,
CSV-import column mapping, per-app rate config). Roadmap tally: ~76/93.

## 2026-07-21 — Batch 51: Realtime sync — edits + deletes diff (offline 7/7) ✅ built

Table flag **`"sync":true`** → implies `updated_at` (created/edited tracking) + a delete
tombstone trigger into a shared `_deletes` table. `GET /rows/<t>/changes?sync=<iso>` returns
`{updated:[rows with COALESCE(updated_at,created_at) > since], deleted:[ids from _deletes >
since], at:<now cursor>}` for full offline-first incremental sync (the existing `changes`
append endpoint is unchanged when `?sync` is absent or the table isn't sync). `tsFrag`/
`listExtras` now honor `timestamps || sync`. Roadmap tally: ~77/93.

## 2026-07-21 — Batch 52: Weighted full-text ranking (offline 6/6) ✅ built

Table flag **`"searchWeights":{"title":5,"body":1}`** → the `q` relevance rank weights matches
by column (only the weighted columns rank; the WHERE-side `q` filter still matches any column).
A practical FTS without needing FTS5 (uncertain in D1). Implemented in the buildD1List rank
block via `listOpts.searchWeights`; carried through coerceTable + norm. Also marked **inventory
decrement** done — it's exactly the atomic incr with a floor: `POST /rows/<t>/<id>/incr
{col:"stock", by:-1, min:0}`. Roadmap tally: ~79/93.

## 2026-07-21 — Batch 53: NEW LAYER Coupons / discount codes (offline 12/12) ✅ built

`_coupons (code PK, discount, max_uses, used, expires_at)`: admin mints/lists/deletes
(`POST/GET/DELETE /coupons`), anyone validates (`GET /coupon/<code>` → {valid, discount,
remaining}, no consume), a member redeems (`POST /coupon/<code>/redeem`) via an atomic
`UPDATE … WHERE used<max_uses AND not-expired` so the cap is race-free (409 when spent/
expired). `discount` is app-defined JSON. Helpers ensureCoupons/couponState/redeemCoupon.
Roadmap tally: ~80/93. (The no-Stripe half of commerce; checkout itself is 🔑.)

## 2026-07-21 — Batch 54: 2FA / TOTP (offline 12/12) ✅ built

Standard RFC-6238 TOTP (authenticator apps) — implemented with WebCrypto HMAC-SHA1, no
external service. Helpers base32Encode/Decode, `_totpAt`, `totpVerify`, `newTotpSecret`.
`_users` gains `totp_secret`/`totp_enabled` (via ensureAuthExtras). Routes: `POST /auth/2fa/
setup` → {secret, otpauth}, `/enable {code}` (verify+on), `/disable {code}` (verify+off).
LOGIN now checks TOTP when enabled — right password but missing/wrong code → 401
`{need:'2fa'}` (the login SELECT self-heals older sites lacking the columns). Offline-tested by
replicating the TOTP algorithm in the harness test. Roadmap tally: ~81/93.

## 2026-07-21 — Batch 55: NEW LAYER Cart + Orders pattern (offline 10/10) ✅ built

Shopping cart `_cart (user_id, item, qty, PK(user_id,item))` (item = `<table>:<id>`): `POST
/cart/<item> {qty}` (qty≤0 removes), `GET /cart` → {cart, count}, `DELETE /cart/<item>`,
`DELETE /cart` (empty). Private per member. Helpers ensureCart/setCartItem/getCart/clearCart.
**Orders** marked done as a documented PATTERN (a `user` orders table + server-side pricing +
atomic stock incr + coupon redeem + cart clear; Stripe checkout is the 🔑 function step).
Roadmap tally: ~83/93.

## 2026-07-21 — Batch 56: CSV import with column mapping (offline 11/11) ✅ built

`POST /api/db/<slug>/import/<table> {csv, mapping?, hasHeader?}` (admin) — RFC-4180 CSV parse
(quotes/commas/newlines), header→column auto-map (or explicit `mapping`), only declared columns
written, each row validated (validateRow), owner stamped on user/feed, chunked through
insertMany (100/call, ≤5000 rows) → `{inserted, skipped}`. Complements the Batch-38 export.
Roadmap tally: ~84/93.

## 2026-07-21 — Batch 57: commerce & comms via the FUNCTIONS layer (coverage) ✅

The React functions layer (isibi.functions.json, executor at worker.js:~2181) already supports
`fetch`/`email`/`checkout`/`notify` steps + `on:{insert}` event triggers + `{{secret.NAME}}`,
and it's fully documented in the React BACKEND_RULES. So these roadmap items are DELIVERED
(they need the owner's provider keys — 🔑 — but the capability + docs exist); marked done:
- **Email send** → the `email` step (RESEND/SENDGRID/POSTMARK key).
- **Checkout** → the `checkout` step (Stripe key; subscription mode supported).
- **Outbound webhooks** → `on:{insert:<table>}` + a `fetch` POST to the external URL.
- **SMS** → a `fetch` step to a provider REST API (Twilio) with its secret.
- **Magic-link / OTP** → an `email` step (send code/link) + a code table + verify function
  (same shape as the built-in password reset).
- **Web push** → a `fetch` step to a push provider's REST API (subscription mgmt is app-side).
Added a one-line WEBHOOKS/SMS/MAGIC-LINK hint to the functions section. Genuinely-remaining
(need dedicated builds, not just keys): OAuth redirect flow, session revoke, API keys, per-app
rate config, image resize. Roadmap tally: ~90/93.

## 2026-07-21 — Batch 58: Session revoke / "log out other devices" (offline 9/9) built

Block-style token epoch: `_users.token_epoch` (ensureAuthExtras); every token carries `ep`
(set at signup=0 / login = current epoch). `POST /auth/logout-all` (auth) bumps the epoch and
returns a FRESH token (current device stays in). `/auth/me` now rejects a token whose `ep` !=
the stored epoch -> old sessions die at the next guard (same model as block/verified; the
stateless data API keeps a revoked token until expiry, which is the documented tradeoff). The
login + /me SELECTs self-heal older sites lacking the column. Roadmap tally: ~91/93.

## 2026-07-21 — Batch 59: API keys (app-to-app) + per-app rate config (offline 18/18) built

Two owner/admin-facing layers, both offline-verified:

- **API keys** — an ADMIN site-user mints `sk_<48hex>` keys (`POST /api/db/<slug>/apikeys
  {label}`, returned ONCE), lists them prefix-only (`GET`), revokes (`DELETE /apikeys/<id>`).
  Only the SHA-256 hash is stored in the site's own D1 `_apikeys` (like passwords). A caller
  presents `X-API-Key: sk_…` to the data API and is authenticated as the MEMBER the key is
  bound to (the minting admin), flowing through the SAME per-access authz — so it inherits
  admin role, can read/write everything, no special-casing. Only consulted when there's no
  Bearer token (a real login always wins). Revoked/malformed keys don't authenticate. Cap 50
  active keys/site. `resolveApiKeyUser()` bumps `last_used` via waitUntil.
- **Per-app rate-limit config** — a TOP-LEVEL schema `"rateLimits":{"read":300,"write":60}`
  (req/IP/min; aliases rate/apiRateLimit, bare number = both) tunes the data-API per-IP caps
  that previously were hardcoded 300/60. Threaded through `normalizeSchema` → persisted
  `_meta.schema` (preserved across re-applies when unspecified) → read at request time from
  the already-loaded spec (NO extra D1 read). The rate check moved INSIDE the try block so it
  can see the spec. Absent config → the same generous defaults as before.

Roadmap tally: ~93/93. Only two items remain and BOTH need a live environment I can't reach
offline: **image resize/transform on upload** (needs live photon/wasm — the harness stubs it)
and **OAuth social login** (needs the owner's Google/GitHub OAuth app credentials + a redirect
round-trip). Everything else is delivered.

## 2026-07-21 — Batch 60: server-side image resize / transform on upload (offline 8/8) built

`/api/db/<slug>/upload` now takes an optional `resize:{max|w|h,format,quality}` (or
top-level `max`/`w`/`h`/`format`/`quality`) and runs the bytes through photon before
storing: `max` bounds the longest side (downscale-only, keeps aspect), `w`/`h` set
exact/one-side dims, `format` (jpeg|webp|png, +quality for jpeg) re-encodes. The
response `{url,type,size}` reflect the transformed file. New helper
`transformImageBytes(bytes,mime,spec)` — PNG/JPEG/WEBP only (GIF/PDF pass through),
and it FALLS BACK to the original bytes on any decode/encode failure or no-op spec, so
a bad transform can never lose the upload. **photon is wasm — NOT runnable offline**;
the test harness stub was enriched (get_width/get_height + non-empty encode output) so
the offline test (8/8) exercises the request plumbing + format/ext selection, but the
real pixel resize needs the OWNER's live pass. Roadmap: ~93/93.

Only ONE roadmap item now genuinely remains: **OAuth social login (Google/GitHub)** —
it needs the owner to register an OAuth app and provide client id/secret + a redirect
round-trip, so it can't be built+verified without owner credentials. Everything else
is delivered.

## 2026-07-22 — Reporting: expression aggregates (weighted forecast)

`sum=<alias>:<expr>` in stats — aggregate a SQL arithmetic expression (`+ - * /` + parens over
filterable columns and number literals) instead of a bare column, so `sum=weighted:amount*probability/100`
returns a WEIGHTED pipeline forecast summed in SQL (a formula field is read-time JS, can't be SUMmed).
New `exprToSql(prefix, expr)` in buildD1Stats: tokenizes, validates structure (balanced parens,
operand/operator alternation, ≥1 real column), maps cols→sqlIdent/currency-convExpr and numbers→
literals (no injection — operators are a fixed set); returns null (→ aggregate skipped) on malformed/
unknown-col. Parallel `wantedExpr` collected in the wanted loop, emitted into all 3 SELECT paths
(cross/time/main), threaded through the returns + shapeD1Stats. aggSqlExpr resolves an expr alias too,
so groupSort/having work by it. Gotcha: integer cols → integer math (multiply before dividing);
`+` must be URL-encoded `%2B` (query-string `+`=space). Offline batch88 (13/13), full suite (71)
green. BACKEND_RULES STATS section documents it.

## 2026-07-22 — /merge now moves the loser's satellites to the survivor

Closes a follow-up from the delete-cascade PR. New `reassignRowSatellites(env,uuid,table,fromId,toId)`
MOVES a merged-away record's notes/attachments/approvals/history (row_id UPDATE) and tags/shares +
reaction/report/bookmark/link targets (`<table>:<id>` rewrite) onto the survivor. Composite-PK tables
use `UPDATE OR IGNORE` then DELETE the loser leftover, so a value the survivor already has (e.g. the
same tag) isn't duplicated. Wired into the merge handler right before the loser row is deleted (which
is a plain DELETE, no purge — so the moved satellites survive). So dedup keeps full activity history
now. Offline batch87 (10/10): both notes on survivor, both attachment files intact + fetchable,
tags merged/deduped (vip once + hot), loser side empty. Full suite (70) green. BACKEND_RULES merge
entry updated.

## 2026-07-22 — Hardening: hard-delete cascades to a row's satellite data (no orphans)

Hygiene/cost layer. New `purgeRowSatellites(env,uuid,table,ids)` sweeps a hard-deleted row's
satellites: attachment BYTES in R2 (real storage cost) + `_attachments` rows, then `_notes`,
`_approvals`, `_history`, `_tags`, `_shares` (row_table/row_id-keyed) and `_reactions`, `_reports`,
`_bookmarks`, `_links` (`<table>:<id>`-target). Best-effort per table (caught no-op if a site never
used a feature). `_audit` intentionally KEPT (the deletion's compliance trail). Wired into
`cascadeDeleteRow` (single hard delete) and the bulk hard-delete path (selects victim ids first,
then deletes, then purges). Row ids are AUTOINCREMENT so orphans were never a correctness bug (no id
reuse) — this is about not leaking storage/rows. Offline batch86 (14/14) asserts the harness R2
`_map.size` drops as rows are deleted + survivors keep their data. Full suite (69) green. FOLLOW-UPS:
(1) cascade-deleted CHILD rows' satellites aren't swept (only the directly-deleted row's — matches
the existing one-level cascade philosophy); (2) `/merge` deletes the loser row but doesn't
purge/repoint its satellites yet.

## 2026-07-22 — CRM gap layer: file attachments on records

Genuine gap (needed infra, which already existed — the R2 SITES_BUCKET). New `_attachments` table
(row_table,row_id,filename,content_type,size,r2_key,uploaded_by) + endpoints: `POST
/rows/<t>/<id>/attach {filename,content_type?,data:<base64>}` (data: URL prefix stripped, ≤14M b64
chars ≈ 10 MB, 50/record), `GET .../attach` (list w/ urls), `DELETE .../attach/<attId>` (own or
admin). Bytes stored in R2 as BASE64 (round-trips through the harness stub AND real R2 faithfully;
decoded to a Uint8Array when streamed). Fetch-through-worker at `GET /api/db/<slug>/attach/<attId>`
(Phase D.1, new top-level route) streams with the stored content-type — access re-checks the
UNDERLYING record's visibility via memberCanSeeRow (public-read row → anyone; user row →
owner/team/admin), so the bucket URL is never exposed and a forbidden file is an indistinguishable
404. attach/list gated by memberCanSeeRow too; collect → 400. Offline batch85 (25/25) incl.
round-trip body checks, public vs private fetch gating, non-uploader 403, bad-base64 400. Full suite
(68) green. BACKEND_RULES documents it after activity-notes. FOLLOW-UP: attachments aren't cascaded
when the row is hard-deleted (orphan R2 objects) — fine for now, could sweep later.

## 2026-07-22 — CRM gap layer: global search across tables

Discovery gap (a genuinely-missing feature, not composable). New route `GET /api/db/<slug>/search?q=…
[&tables=&per=]` (Phase D.0, before the rows block) runs the same buildD1Filter `q` match over EVERY
readable table at once → `{results:[{table, rows}], count}` grouped by table. Per-table visibility
reused: collect skipped, user tables scoped to the caller (owner_id, signed-out → skipped),
display/feed/admin all rows; trash excluded; per-table attaches (json/computed/formulas/currency/sla)
+ stripFieldRoles(callerRole) applied so search never leaks secured fields. Uses a synthetic
`qUrl = new URL("https://s/?q=…")` so a stray ?where can't leak across tables. Caps: 20 tables
scanned, `per` (default 5, max 25) rows each, rate-limited 120/min/IP. Offline batch84 (17/17),
full suite (67) green. BACKEND_RULES documents it after the duplicate-check entry.
Note: this is the command-palette / global-search-box backend; single-table search is still the
list read's `?q=`.

## 2026-07-22 — CRM gap layer: SLA escalation action [part 2 of 2]

Completes SLA. `sla.escalate:{to?, field?, value?}` config + `POST /rows/<t>/overdue/escalate`
(dm[4] `escalate`, added to regex in part 1). Admin/writeRole-gated (siteRoleAllows). Sweeps the
overdue set ORG-WIDE (base=withVisible(null), not owner-scoped — it's an ops action) and applies the
action to rows NOT YET escalated: reassign owner_id to `to` (resolveMemberId; needs an owner column)
and/or set `field`=`value`. IDEMPOTENT via a `NOT (<all actions already satisfied>)` guard, so a
scheduler can hit it repeatedly; capped at 2000 rows/call via an id-subquery. Refactored the overdue
WHERE into a shared `overdueParts(baseClause)` closure (escalate uses it org-wide; the GET queue
keeps its ?where-aware path). Does NOT resolve rows (they stay overdue until a done status). NO
built-in timer by design (per-site cron = scale frontier) — the endpoint is wireable to a scheduled
function or external cron. Offline batch83 (16/16): reassign+flag on a feed table, field-only on an
admin table, idempotency, non-admin 403, still-overdue-after-escalate, no-config 400, POST-only.
Full suite (66) green. GOTCHA confirmed in testing: `created_at` is a managed col the client can't
set, so an SLA `start` you want to backdate must be a DECLARED date column (opened_at), not created_at.

## 2026-07-22 — CRM gap layer: SLA / deadlines (read-time status + overdue queue) [part 1 of 2]

Time-based primitive (the last automation gap). Table-level `sla:{start,mins,done?}` — clock runs
from `start` date col (default created_at) for `mins` (a number, or a duration string parsed by new
`slaMinutes()`: `30m`/`4h`/`2d`/`1w`); a `done:{field,values}` status stops it. Two pieces:
(1) read-time `attachSla(def,rows)` adds `row._sla = {due_at, remaining_mins, overdue, done}` (like
attachCurrency — wired into doExpand + the tree read path), for overdue badges / urgency sort;
(2) `GET /rows/<t>/overdue[?where=&limit=&offset=]` — the overdue queue, computed IN SQL
(`datetime(start,'+<mins> minutes') < datetime('now')`, done-state excluded), most-overdue-first,
read-visibility scoped (user→own/team via buildD1Filter over withVisible(userReadBase)), honors
?where= + trash, paginated with total. dm[3] `overdue` added to the rows regex (+ dm[4] `escalate`
reserved for part 2). No cron — deliberately: a global per-site sweep is the scale frontier; the
ESCALATION ACTION (auto-reassign/flag the overdue set, wireable to a scheduler) is part 2, next PR.
Offline batch82 (18/18, uses Date-relative timestamps), full suite (65) green. BACKEND_RULES documents
it after the geo/near section.

## 2026-07-22 — CRM gap layer: grouped-report controls (sort / top-N / HAVING)

Reporting completion. `buildD1Stats` gained shared controls applied to ALL grouped paths (plain
multi-dim, cross-table, time-bucket): `groupSort=<count|sum:col|avg:col|…|value>` + `groupOrder`
(default count desc) → sort groups by an aggregate; `groupLimit`/`topN` (≤1000, default 500) →
top-N; `having=<agg>:<op>:<n>` (repeatable AND, ops gt/gte/lt/lte/eq/ne) → filter groups. `aggSqlExpr`
builds the raw SQL expr (COUNT(*) / SUM(col) via aggExpr, honoring currency conversion) so sort/having
work even when the agg isn't SELECTed; `value`→`_g0`. HAVING params appended after WHERE params;
ignored on the ungrouped-total branch (no GROUP BY). Enables revenue leaderboards, top-N accounts,
and quota/threshold reports in one request. Offline batch81 (13/13), full suite (64) green.
BACKEND_RULES STATS section documents it.

## 2026-07-22 — CRM gap layer: time-bucketed stats (trend / time-series reports)

Reporting gap. `buildD1Stats` now recognizes a group token `datecol:granularity`
(year|month|week|day|date|hour) → buckets rows by a truncated timestamp via SQLite
`strftime` (month→`%Y-%m`, day→`%Y-%m-%d`, week→`%Y-W%W`, hour→`%Y-%m-%d %H:00`), ordered
CHRONOLOGICALLY (bucket ASC) so it plots directly. `?group=closed_at:month&sum=amount` →
revenue-per-month; works on created_at/updated_at or any declared ISO-date column; honors `where=`
and the aggExpr currency conversion. Returns the single-dim `{group, groups:[{value:bucket,…}]}`
shape. Detection requires the granularity to be known AND the column filterable, else it falls
through to the normal group path (an unknown granularity degrades to a global aggregate, no error).
Offline batch79 (14/14), full suite (62) green. BACKEND_RULES STATS section documents it.

## 2026-07-22 — CRM gap layer: duplicate check (does-this-already-exist lookup)

Data-quality gap. `GET /rows/<t>/duplicates?email=…&phone=…` (dm[3] `duplicates` added to the rows
regex) → `{matches, count, on}`, existing rows matching ANY supplied declared column (OR),
case-insensitive + trimmed (`LOWER(TRIM(col))=LOWER(TRIM(?))`). `&exclude=<id>` skips a row (edit
mode). Schema-free — the client names which columns to check; unknown/control (limit/exclude/fields)
params ignored; no valid key → 400. Read-only GET; read-visibility scoped via userReadBase +
withVisible (user table → own/team only, no cross-user leak; public-read → all; collect → 403),
runs through doExpand so field-level security applies. Composes with /merge (fold the found dup) and
column uniqueCI (hard block instead of soft warn). Offline batch78 (15/15), full suite (61) green.
BACKEND_RULES documents it after the FACETS section.

## 2026-07-22 — CRM gap layer: territory / field-based assignment (assignBy)

Workflow gap, companion to round-robin. Table-level `assignBy:{field, map:{value:token}, default?}`
on a user/feed table routes a new row to a specific member by a field value (region/product/tier →
named rep). New `resolveAssignee(env,uuid,def,table,body,fallback)` supersedes the direct
roundRobinOwner call at both insert sites: it tries assignBy FIRST (field value → `map[value]` or
`default`, resolved via `resolveMemberId` — id or email → member id), then round-robin, then the
creator. So territory routing wins for known segments and round-robin spreads the rest (declare both
on one table). Tokens validated as id or email (≤120 chars); map keys lowercased/trimmed; unresolved
token → fall through. Normalizer + norm.push carry `assignBy`. Offline batch80 (12/12) incl. the
assignBy+roundRobin composition, full suite (63) green. BACKEND_RULES documents it after round-robin.

## 2026-07-22 — CRM gap layer: round-robin assignment (lead routing)

Workflow gap. Table-level `roundRobin:{among:[roles]}` on a user/feed table → each new row's
owner_id is auto-assigned to the next member of the role pool in rotation (stable order by id, atomic
`_counters` row `rr:<table>` → even, no double-assign), regardless of creator — so admin/public-intake
leads fan out to reps. New `roundRobinOwner(env,uuid,def,table,fallback)` helper; blocked members
skipped (`blocked IS NULL OR blocked=0`), empty pool → fallback to creator (never unowned). Wired
into BOTH owner-stamped single-row inserts (feed @14-space indent + user @12-space — the replace_all
only caught the feed one at first; the user block needed a separate edit) by swapping the stamped
`[userId]` for `[rrOwner]`; the response returns `owner_id` when it differs. Normalizer accepts
`{among}` / array / `true`(→["user"]) forms; norm.push carries it. Batch/upsert intentionally keep
the creator as owner (single-insert is the lead-creation path). Offline batch77 (10/10), full suite
(60) green. BACKEND_RULES documents it after the approval section.

## 2026-07-22 — CRM gap layer: auto-numbering / sequences (record numbers)

Data-model gap. Table-level `sequence:{field, prefix?, pad?, start?}` stamps each new row with the
next human-readable number (INV-01000, LEAD-0042). Backed by the existing atomic `bumpCounter`
(_counters row `seq:<table>`, `INSERT … ON CONFLICT DO UPDATE … RETURNING n`), so gap-free + no
collisions. New `maybeSequence(env,uuid,def,tn,body)` helper (mirrors maybeSlug) sets body[field] and
returns true so the caller adds the column; threaded into ALL insert paths — the 4 single-row row
handlers (collect/feed/user/admin), upsertRow, and insertMany (batch adds the field to the col set
since it's not in `allow`). The field is PLATFORM-ADDED (applySiteSchema, like the approval status
col), kept OUT of `allow` (authoritative — a client-sent value is ignored, and PATCH can't change
it), and pushed into `listExtras` so it's queryable/sortable. Normalizer + norm.push carry it.
Offline batch76 (13/13; note: `?sort=id` defaults to DESC — tests use `&order=asc`), full suite (59)
green. BACKEND_RULES schema section documents it after multi-currency.

## 2026-07-22 — CRM gap layer: unified activity timeline (notes + approvals + audit)

The record history panel — `GET /rows/<t>/<id>/timeline[?types=&limit=]` merges a record's `_notes`,
`_approvals`, and (when the table declares `audit:true`) `_audit` field-change events into ONE
reverse-chronological feed, each entry `{type:'note'|'approval'|'audit', at (ISO), actor_id,
actor:{…}, …type-specific}`. `?types=note,approval` narrows sources; `?limit=` caps (default 100,
max 300). Same memberCanSeeRow visibility gate + collect/401 guards as notes. Read-only GET.
Two gotchas handled: (1) `audit` was normalized but NOT carried through norm.push — added
`audit:!!t.audit` so `def.audit` exists at request time (that was the one bug in testing); (2) the
sources timestamp differently — _notes/_approvals store ISO (…T…Z), the _audit trigger stores SQLite
`datetime('now')` (`YYYY-MM-DD HH:MM:SS`), which DON'T sort lexically against each other — so the
handler parses both to epoch ms (space-form treated as UTC) for the sort and normalizes every `at`
to ISO in the response. Note: submit/approve also produce an audit `update` row (they UPDATE the
status col), so the feed shows both the decision AND its field-change — intended. Offline batch75
(19/19), full suite (58) green. BACKEND_RULES documents it after the activity-notes entry.

## 2026-07-22 — CRM gap layer: activity notes / logging (per-record activity log)

CRM activity log — the central "log a call/email/meeting note against a contact/deal" feature that
was genuinely absent (rollups, bulk ops, history all already existed). Polymorphic platform table
`_notes (id, row_table, row_id, author_id, kind, body, created_at)`, ensured lazily (ensureNotes),
always-on for every non-collect table (no schema key — like tags/reactions). Endpoints (dm[4]
`notes` added to the rows regex):
- `POST /rows/<t>/<id>/notes {body, kind?}` — kind ∈ note|call|email|meeting|task|sms|log (default
  note; invalid → note); body ≤5000 chars, required.
- `GET /rows/<t>/<id>/notes[?kind=&limit=]` — newest-first, each with `note.author` (batched public
  profile).
- `DELETE /rows/<t>/<id>/notes/<noteId>` — your own note, or any if admin.
Visibility gate `memberCanSeeRow(env,uuid,def,tn,rowId,userId,access)` (new reusable helper) runs
for ALL methods up-front so an outsider gets 404 (can't even discover a note exists): on a `user`
table = owner / owner's manager via teamRead CTE / admin; on display/feed/admin = any signed-in
member; collect = none (400). New-note id returned via `INSERT … RETURNING id`. Offline batch74
(21/21), full suite (57) green. BACKEND_RULES documents it after the reports/moderation section.
NOTE for the follow-up: a unified activity TIMELINE endpoint (merging _notes + _audit + _approvals +
_history into one chronological feed) is the natural next gap — this lays its foundation.

## 2026-07-22 — CRM gap layer: approval workflow (submit → approve/reject, audited)

Workflow gap (the last of the three harder CRM gaps). Table-level
`"approval":{approvers:[roles],status?:"approval_status"}`. The `status` col is PLATFORM-ADDED
(applySiteSchema, like `pinned`) and pushed into `listExtras` (queryable/sortable) but deliberately
NOT into `allow` — so `pickCols` won't accept it from a write body. That closes the self-approve
hole: an owner/writer can't PATCH themselves to approved; only the endpoints set it. Endpoints
(dm[4] added to the rows regex: submit|approve|reject|approvals):
- `POST /rows/<t>/<id>/submit {note?}` — a writer of the row (owner on user/feed, admin/writeRole on
  admin) → status `pending`.
- `POST /rows/<t>/<id>/approve|reject {note?}` — a member whose role ∈ approvers (or admin) →
  `approved`/`rejected`; fires on:{update}.
- `GET /rows/<t>/<id>/approvals` — the decision log (action, actor_id, note, at; newest first) +
  current status.
Pending QUEUE = the normal list filter `?where=approval_status:eq:pending` (pairs with teamRead so a
manager sees their team's). Audit trail in a new platform `_approvals` table (ensureApprovals/
logApproval, lazy per-isolate). The `exist` lookup only selects owner_id on user/feed tables (admin
tables have none — that was the one bug in testing, fixed). Offline batch73 (19/19) incl. the
self-approve-hole check, full suite (56) green. BACKEND_RULES RBAC section documents it.

## 2026-07-22 — CRM gap layer: multi-currency (native storage, base-currency roll-ups)

Data-model gap. Table-level `"currency":{amount,code,base,rates,as?}` — `amount` = money col,
`code` = per-row ISO-currency col, `base` = report currency, `rates` = {CUR: base-units-per-1}
(base auto-1). TWO effects: (1) READ-time `attachCurrency(def, rows)` adds `<amount>_base` (= amount
× rate[code]), null when the row's currency has no rate — wired into the list/single/tree/sync read
paths beside attachFormulas; (2) STATS-side, `buildD1Stats` recognizes the derived `as` field in
sum/avg/min/max and emits `SUM(amount * CASE UPPER(currency) WHEN 'EUR' THEN 1.08 … ELSE NULL END)`,
so `?group=region&sum=amount_base` rolls a cross-currency pipeline up into ONE base total in SQL (a
EUR deal + a GBP deal add correctly; unconvertible rows drop out of the SUM). Currency codes are
`^[A-Z]{2,8}$` and rates finite>0, both inlined safely (no params). Normalizer added to
normalizeSchema + carried through norm.push. Offline batch72 (12/12), full suite (55) green.
BACKEND_RULES schema section documents it.

## 2026-07-22 — CRM gap layer: cross-table reporting (group by a parent column)

Reporting gap (CRM gap #2). `buildD1Stats(url, tn, allowCols, base, def, spec)` — extra
`def`+`spec` args — now understands a `group` token containing a dot: `<fkcol>.<parentcol>`.
`GET .../rows/opportunities/stats?group=account_id.industry&sum=amount` groups the pipeline by
each opportunity's ACCOUNT's industry (a join you'd otherwise do client-side), returning the
single-dim `{group:'account_id.industry', groups:[{value, count, sum:{}}]}` shape. Implementation:
resolves the parent via `def.refs[fk]`, validates the parent column against its tableDef, then
runs `SELECT p.<pcol>, <aggs> FROM (SELECT * FROM <child> <where>) t LEFT JOIN <parent> p ON
t.<fk>=p.id GROUP BY p.<pcol>` — the child's base filter (incl. owner/trash/tag scoping) is
isolated in the subquery so the JOIN can never make a base column ambiguous. Unknown fk or
missing parent column falls back to the plain group path (no 500). One cross dimension. Call site
updated to pass `def, spec`. Offline batch71 (12/12), full suite (54 suites) green. BACKEND_RULES
STATS section documents the `<fkcol>.<parentcol>` token so the generator emits it.

## 2026-07-22 — CRM gap layer: record merge (dedupe)

Data-model gap. New `POST /api/db/<slug>/rows/<t>/<id>/merge {from:<otherId>, fillBlanks?}`
(ADMIN) folds `from` INTO this record: every child row referencing `from` (found via
childRefsOf, the ref graph) is repointed to this id, then `from` is deleted. `fillBlanks:true`
first copies the loser's non-empty values into the survivor's empty fields (keep the fuller
record). Returns {into, from, repointed:{table:count}}. Added `merge` to the rows dm regex +
isMerge handler. Dedupe duplicate accounts/contacts. Offline batch70 (11/11), full suite green.

## 2026-07-22 — CRM gap layer: record assignment (/assign — lead routing)

Workflow gap. New `POST /api/db/<slug>/rows/<t>/<id>/assign {user:<id|email>}` on a user/feed
table sets owner_id to that member. Gated to an ADMIN, or (on a teamRead table) the current
owner's MANAGER (recursive CTE check). Assignee resolved by id or email; fires on:{update}
automations. Added `assign` to the rows dm regex + isAssign handler. Combines with teamRead
(the new owner's manager still sees the record) for CRM lead routing / case reassignment.
Offline batch69 (7/7), full suite green.

## 2026-07-22 — CRM gap layer: on:{update} function triggers

Workflow gap. Functions could trigger on:{insert} only; added on:{update} so an automation
runs after a single-row PATCH (field-change automation). normalizeFnSpec parses
on:{update:"table"} (+ "update:table" string forms); insertTriggersFor fetch broadened to
insert|update fns; new fireRowTriggers(event) + fireUpdateTriggers, called after a SUCCESSFUL
own-row + admin PATCH with input {_event:'update', id, ...changedFields}. Pairs with
`transitions` for stage-driven automation (deal → won ⇒ log activity / notify). Offline
batch68 (4/4, harness mocks site_functions + captures the async trigger), full suite green.

## 2026-07-22 — CRM gap layer: team/manager-hierarchy visibility (teamRead)

Completes the SHARING MODEL (CRM gap #1). Table-level `"teamRead":true` on a `user` table →
a manager READS rows owned by their whole downline (recursive `_users.manager_id`), not just
their own; WRITES stay own-row-only. `manager_id` added to `_users` (ensureAuthExtras); the
owner sets a member's manager via the member route new `set_manager` action (manager_id/null).
Read path: compute `teamIds` ONCE per GET via a recursive CTE (from the caller down, cap
5000), then a `userReadBase()` helper returns `owner_id IN (…)` for managers / `owner_id=?`
for solo users; applied to list + single-GET + stats + facets. Solo users (no reports)
unchanged, so zero blast radius on existing apps. Offline batch67 (10/10) — mgr sees own+2
reports, reps see own, single-GET works for mgr, peer 404s, mgr can't EDIT a report's row,
team stats count=3. Full suite green (core read-scoping change, no regressions).

### CRM sharing model (gap #1) now covers: field-level security + team-hierarchy read
visibility. (Not yet: criteria-based sharing RULES + territory management — a later layer.)

## 2026-07-22 — CRM gap layer: field-level security (fieldRoles)

Fourth CRM gap, first piece of the SHARING MODEL (gap #1). Table-level
`"fieldRoles":{"amount":["admin","manager"],"cost":["admin"]}` — on reads, a column is
stripped for any caller whose role isn't listed (signed-out = role `public`); `admin` is a
superuser and always sees every field. New `stripFieldRoles()` runs in doExpand before the
?fields projection; the caller's role is fetched ONCE and only when the table declares
fieldRoles (every other table pays nothing). So reps see the deal but not its margin.
Forwarded through coerceTable + norm.push. Offline batch66 (7/7), full suite green. Remaining
in the sharing model: team/manager-hierarchy read visibility (see your reports' records).

## 2026-07-22 — CRM gap layer: formula fields (arithmetic)

Third CRM gap (data-model). `computed` only concatenates strings; added a table-level
`"formulas":{"name":[tok,…]}` that computes a NUMBER per row from arithmetic over columns —
tokens are numeric columns or literal numbers with + - * / and correct precedence (* / bind
first). New `attachFormulas()` in the read pipeline (doExpand + the changes read path);
read-only, non-numeric operand or /0 → null. Covers CRM money math: line_total = quantity *
unit_price, net = subtotal - discount, with_tax = subtotal * 1.2. Forwarded through
coerceTable + norm.push. Offline batch65 (6/6), full suite green.

## 2026-07-22 — CRM gap layer: stage-gating / state machine (transitions)

Second CRM gap (workflow). Table-level `"transitions":{"<col>":{"<from>":["<to>",…]}}` — a
PATCH that moves a guarded column off a declared step is refused with 409
{code:'transition', from, to, allowed}. `"*"` from-key allows leaving any value; a PATCH
that doesn't touch the column is unaffected. Single choke point before the access branches
(covers feed/user/admin PATCH). Forwarded through coerceTable + norm.push. Also memoized
`readBody` (read-once) so the guard + the branch share one parse. Enforces opportunity-stage
/ case-status / order-state flows in the DB. Offline batch64 (8/8), full suite green.

## 2026-07-22 — CRM gap layer: multi-dimensional reports (matrix/pivot)

First of the "enterprise CRM gaps" build. The stats endpoint already did single-column
GROUP BY with count/sum/avg/min/max; extended `buildD1Stats` + the stats handler to accept
`?group=col1,col2[,…]` (up to 4 dims) → a matrix report, one row per combination
(`{groupBy:[…], groups:[{col1,col2,count,sum:{…},avg:{…}}]}`). Single-dim shape is unchanged
(backward compatible: still `{group, groups:[{value,…}]}`). Covers "pipeline by stage AND by
rep" in one request. Respects where/q/tag + user-table owner scoping. Offline-verified
batch63 (11/11), full suite green. This closes most of CRM gap #2 (reporting) — remaining:
cross-TABLE grouping (group opps by account.industry) and HAVING (filter on an aggregate).

## 2026-07-21 — BUGFIX: schema revise dropped new app columns (+ stale flag-triggers)

Found while live-testing: **re-applying a schema (what a REVISE does) never ALTER-added a
newly-declared app column.** `applySiteSchema` only `ALTER ADD COLUMN`-ed platform columns
(owner_id, deleted_at, position, …); app columns relied on `CREATE TABLE IF NOT EXISTS`,
which is a no-op on an existing table. So "add a due_date to tasks" (a super-common revise)
silently left the column out → every write to it failed with "data error". This was the
real cause of the "data error" I first misattributed to the audit trigger.

Fix (worker.js applySiteSchema):
- Collect each declared app column's `name type` and `ALTER TABLE … ADD COLUMN` it after
  the CREATE (idempotent try/catch — bare type only, since ALTER can't add NOT NULL/UNIQUE/
  PK to a populated table; required-ness is enforced at the API layer). Revises that add a
  field now work.
- Secondary hygiene: DROP the flag-driven triggers (`_del`/`_pos`/`_max`/`_aud_*`/`_hist`)
  before the conditional CREATE blocks, so turning a flag OFF (e.g. dropping `audit`) removes
  its trigger instead of leaving it firing into `_audit`/`_history` after it's disabled.

Offline-verified: test/backend/batch62.test.mjs (4/4) — audit on→insert, audit off same-cols
→insert still works, NEW column added on re-apply→insert works, audit re-enabled→works. Full
suite green. Deploying; will re-verify live.

## 2026-07-21 — Live generation QA + BACKEND_RULES tightening

Generated real sites through the live Sonnet builder (`/api/site/react-build`) as a user
and verified each provisioned backend. Findings:

- **Access-mode mapping is reliably correct.** Two sites (a book club, an events board)
  both got collect/display/user/feed/admin exactly right for the brief, verified live
  (feed public-read + own-row edits, user private isolation, collect admin-only read,
  admin RBAC 403).
- **Finer constraints were dropped.** The events board's "one RSVP per member per event"
  did NOT become `oncePerUser` (a member could RSVP repeatedly), and `event_id` was a
  plain int with no `ref` (no server-side relation). Same class as omitting a 1-5 `min/max`.
- **Fix:** added a directive to `BACKEND_RULES` (builder/react-gen.mjs) telling the model
  to ENCODE the brief's rules as schema keys — 'one X per member' → `oncePerUser`, 'rated
  1-5' → `min/max`, 'belongs to a parent' → `ref`, unique handle/code → `unique`/`uniqueCI`,
  fixed choice set → `enum`. "If the brief says it, the schema carries it."
- **Generation reliability:** ~half of first-attempt builds failed (a missing imported
  component file → compile error; a truncated generation on a large multi-page app). The
  auto-fix loop recovered some (1-2 passes) but not all. Adding "keep files minimal +
  ensure every import exists" to the brief helped. Worth watching if build success rate
  matters.

## 2026-07-21 — Batch 61: OAuth social login (Google / GitHub) — ROADMAP COMPLETE 93/93 ✅ built

The final roadmap layer. Two GET endpoints, a normal browser redirect dance:
`GET /api/db/<slug>/auth/oauth/<google|github>[?return=<path>]` → 302 to the provider;
`GET .../callback?code&state` → verify the signed state, exchange the code server-side
(client secret never touches the page), read the VERIFIED email + name/avatar, upsert a
PASSWORDLESS `_users` row (random unusable password, verified=1, first member = admin,
invite-only respected), mint a normal site-user session token, and 302 back to
`/s/<slug>/<return>#token=<jwt>` for the SPA to grab from the hash. Shares `_users` with
password auth, so a member can use either. Owner setup: add `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET` (+/or GITHUB_*) in Cloud → Secrets and register the redirect URI
`https://<site>/api/db/<slug>/auth/oauth/<provider>/callback` with the provider; until
then the buttons return a clear "not set up" message (501). State = a signed 10-min
site-user token (purpose:oauth, provider, nonce, return path).

**OFFLINE-TESTED FULLY (17/17):** the test mocks the provider token/userinfo calls AND
the owner's encrypted secrets (replicating encryptSecret with the harness's
test-service-key), so the whole dance runs offline — authorize URL construction, state
sign/verify + tamper rejection, code→token→email exchange, passwordless user creation,
session issuance, idempotent re-login, and GitHub's /user/emails fallback. The harness
`makeClient` now also returns `location` (302 Location header). **The real Google/GitHub
round-trip still needs the owner's live pass** (a registered OAuth app + a browser) — I
can't do that offline. BACKEND_RULES taught the flow (send browser to the endpoint, read
`#token=` on return).

### 🎉 BACKEND ROADMAP COMPLETE — 93/93

All 93 backend primitives for the website-builder DB are built and merged. The last four
(Batches 59–61: API keys, per-app rate config, image resize, OAuth) are offline-verified;
the three that touch a live-only surface — **image pixel resize (photon/wasm)** and **the
real Google/GitHub OAuth round-trip** — are structurally complete and need only the
owner's live pass / OAuth-app credentials to exercise end-to-end. Nothing remains on the
roadmap. See docs/backend-roadmap.md (all boxes ticked).

## 2026-07-21 — NEW LAYER: Uniqueness constraints (race-free) ✅ live

Apps couldn't enforce "one review per member per product" / "one RSVP per event" /
a unique code without a racy check-then-insert. Now it's schema-declared and
DB-enforced:

- Table-level `"oncePerUser":["product_id"]` (on `user`/`feed`) → UNIQUE over
  `(owner_id, product_id)` = one row per member per value.
- Table-level `"unique":["code"]` (global) or `["event_id","seat"]` (composite);
  accepts one group or many (`[["a"],["b","c"]]`).
- Real UNIQUE INDEX in the site D1 — race-free. A violating write returns a clean
  **409** `{error:"already exists", code:"duplicate"}` across single/batch/upsert
  (was a 502). BACKEND_RULES: declare it instead of check-then-insert; handle 409.

Shipped PR #530, deployed. **Verified live 13/13** — oncePerUser is genuinely
per-user (member B could still review product 1 after A), global unique, composite
`(event_id,seat)` unique, 409 `code:'duplicate'`, and the owner row-count confirmed
the dup was actually blocked (3 rows, not 4). Bare test backend, $0, deleted.

## 2026-07-21 — NEW LAYER: Reactions (one-per-user likes/upvotes/RSVPs) ✅ live

Counters tally anonymously but can't dedupe per user, so a like/upvote/RSVP button
had to hand-roll a side table. New first-class primitive:

- `POST /api/db/<slug>/react/<target> {type}` (auth) → TOGGLES the caller's reaction
  (default type `like`), returns `{reacted, count}`; `{on:true|false}` forces a
  direction (idempotent). `GET …/react/<target>` → `{counts:{type:n}, mine:[types]}`
  (send Bearer for `mine`; anon gets counts only).
- Dedup enforced by `PRIMARY KEY(target,type,user_id)` in the site D1 `_reactions`
  (dropped with the DB). Writes require login so "one per user" is real.
- **`?reactions=1`** on any list read inlines `row.reactions = {counts, mine}` for
  target `<table>:<id>` (batched, caller-aware) — a feed renders like/upvote buttons
  with counts + the user's own state in ONE request. Composes with `?authors=1`.
- CONVENTION: react to `<tableName>:${id}` (e.g. `posts:${id}`) so manual reacts and
  the `?reactions=1` shortcut agree — BACKEND_RULES now states this explicitly (a
  singular-vs-plural mismatch would split the count).

Shipped PR #528, deployed. **Verified live 14/14** — toggle on/off, auth guard, cross-
user dedup, idempotent force on/off, counts+mine (auth-aware), multi-type (like+upvote),
and the `?reactions=1` feed join (caller-aware + opt-in). Bare test backend, $0, deleted.

## 2026-07-21 — NEW LAYER: Profiles (public member identity) ✅ live

Testing kept showing the same gap: generated apps (Townsquare, Parkbench) copied an
`author_name` into EVERY row because there was no shared, publicly-readable member
identity. Fixed it with a real profiles layer:

- `_users` gains `display_name` / `avatar_url` / `bio` (back-compatible ALTER via
  `ensureAuthExtras`). Signup optionally takes `display_name` (defaults from email).
- `GET /api/db/<slug>/profile/<id>` — PUBLIC, safe columns only (never email/hash).
- `GET`/`PATCH /api/db/<slug>/profile/me` — read/edit own (auth); avatar must be a
  URL, name non-empty, bio bounded. `GET …/profiles?ids=1,2,3` — batch.
- **`?authors=1`** on any list read inlines `row.author = {id,display_name,avatar_url}`
  by `owner_id` (batched, no N+1) — feeds show the poster with NO author_name column.
- Owner member read now shows `display_name`; BACKEND_RULES teaches profiles+`?authors`.

Shipped PR #526, deployed. **Verified live 17/17** — public read (no email/hash leak),
me read (own email), PATCH (+ URL/empty guards + 401 anon), batch, the `?authors=1`
join (opt-in), and owner member names (no hashes). Bare-provisioned test backend, $0,
deleted after.

## 2026-07-21 — NEW LAYER: Counters (atomic likes/views/reactions/polls) ✅ live

Built apps had no race-free way to tally likes, view counts, reactions, or poll
options — a read-modify-write on a row column races under load, and a full row per
event is overkill. (Testing had surfaced the pain: Parkbench duplicated `author_name`
into every row for lack of shared primitives.) Added a named-counter primitive:

- `POST /api/db/<slug>/count/<name>[?by=N]` → atomic increment (default +1, floored
  at 0; negative to undo a like), returns the new `{value}`.
- `GET /api/db/<slug>/count/<name>` → `{value}`; `GET …/count` → `{counters:{…}}`.
- PUBLIC + atomic (anonymous likes/views, no login, no races), rate-limited
  (300/min read · 120/min write). Stored in the site's own D1 `_counters` (dropped
  with the DB — no orphans). Surfaced to the owner in `/api/site/backend/analytics`
  as `{counters}`. BACKEND_RULES teaches the builder counter-vs-feed-row + naming
  (`like:post:${id}`) + pairing with a `user` row to stop double-likes.

Shipped PR #524 (+#525 trailing-slash tolerance), deployed. **Verified live 12/12** —
increment/by/floor, read single+all+unknown, owner analytics surfacing, method guard,
and the property that matters: **25 concurrent increments → exactly 25 (race-free)**.
All test backends provisioned bare (ensure+schema, $0) and deleted after.

## 2026-07-21 — End-to-end platform test + a real bug caught (backend wiring) ⚠️→✅

**Drove a real Haiku-built app ("Townsquare" community board, $0 fal, photo-free)
end-to-end as a real user** — signup/login, feed posts, comments (relations),
search, the AI suggest-title function, analytics — then checked every owner panel.

**Platform backend: 22/22 checks PASSED.** Auth (+ first-user→admin role), feed
writes (auth-gated, anon rejected), relations (`?children=comments` nested 3,
`?expand=post_id` inlined the parent), search (`?q=coffee`→1; multi-term AND),
**AI-as-a-primitive** (suggest-title → owner charged EXACTLY 1 credit, zero provider
leak), analytics (owner panel showed EXACT counts: 22 total / view 16 / post 6),
owner reads (posts, comments, members, admin role). Every DB point the platform
exposes is solid.

**THE BUG (in the GENERATOR, not the platform):** the Haiku build rendered a
perfect UI but showed "Could not load posts" — because it wired EVERY backend call
**without the site slug**. The rule mandates `const API = '/api/db/' +
location.pathname.split('/')[2]`; Haiku ignored it, wrote its own helper
`fetch(\`/api/db${'{'}t${'}'}\`)` and called `w("/rows/comments")` → `/api/db/rows/comments`
(slug-less → 404). The string `townsquare-e7c3eb` appeared **0 times** in the whole
bundle. Auth, posts, comments — all dead. **Why nothing caught it: the build +
auto-fix loop only checks that the code COMPILES. This compiles fine; it's wired
wrong at RUNTIME.** So a fully non-functional backend app can build clean, pass
validation, and ship. Exactly what real e2e testing is for.

**Important framing:** the bug was **Haiku-specific**, and the builder UI already
sent NO model field → production builds were **already Sonnet-only**. The dead app
only happened because the *test* forced Haiku via the raw API. So live users were
almost certainly unaffected — but the Haiku code path existed and was reachable.

**FIX — shipped + DEPLOYED (PR #523 merged to main + live on isibi.ai 2026-07-21):**
1. **Haiku REMOVED from the builder** (owner's call 2026-07-21 — "just take haiku
   out"). `RB_MODEL` in `/api/site/react-build` is now hardcoded `claude-sonnet-5`;
   the `model:'haiku'` API path is gone. (Haiku is untouched everywhere else — it
   still writes the cheap director steps. This only removes it from whole-app builds.)
2. **Louder API-base rule** (`react-gen.mjs` BACKEND_RULES) — deriving the slug is now
   a hard, explicit directive ("NEVER hardcode `/api/db/auth`… NEVER `/api/db${'{'}x${'}'}`…").
3. **Post-build wiring guard + repair pass** (`worker.js`, mirrors schema-repair) — a
   model-agnostic net in case even Sonnet ever mis-wires: if the app hits `/api/db`
   with a slug-less shape and never derives the slug, a targeted URL-only rewrite pass
   (`WIRING_REPAIR_RULES`) fixes it. One small extra LLM call only when the defect is
   present. Detection **verified offline 9/9** (fires on the real broken bundle + 4
   broken variants; silent on 3 correctly-wired variants + a static site).

**VERIFIED LIVE (2026-07-21, after deploy):** built a fresh backend app ("Parkbench",
same brief) on the live builder with no model field → came back `model: claude-sonnet-5`,
`backend:true`, `fixed:0`. Inspected the served bundle: **4/4 wiring checks pass** —
derives the slug via `split("/")[2]`, ZERO slug-less `/api/db/auth|rows` literals, ZERO
`/api/db${'{'}x${'}'}` templates. Drove it end-to-end: signup → post (auth-gated feed) →
public read → comment → `?children=comments` nested = all ✅. (Also re-confirmed the
validation layer: a post missing the required `author_name` was correctly rejected.)
**Haiku's app was dead; the Sonnet app works.** First generation attempt returned a
transient "came out incomplete" (generic message, no provider leak — good); a retry
succeeded, so keep an eye on occasional Sonnet stream-truncation on complex briefs.
Both test apps (`townsquare-e7c3eb`, `parkbench-d78597`) deleted; test-account credits
reset. (This note is a follow-up commit after the #523 squash-merge — not new code.)

---

## 2026-07-20 — Phase 4a: React builder STREAMS (live code view) + auto-fix loop ✅

`/api/site/react-build` is now an NDJSON stream (like the classic builder):
- `{ev:"code"}` — the source as Sonnet writes it (the "watch the code" live view)
- `{ev:"phase"}` — generating → images → compiling → (fixing) → publishing
- `{ev:"done"|"error"}` — URL / slug / cost / balance / brand / fixed-count

**Why streaming mattered:** the old one-shot ~138s request was borderline against
timeouts; streaming keeps the connection alive AND Sonnet generation now streams,
which removes the large-output non-streaming timeout risk. **Auto-fix loop:** on a
Vite compile error the exact error + current files go back to Sonnet (≤2 tries),
corrected files are grafted, images re-injected, rebuild. Brand is derived from
the generated `<title>` for the slug + card name.

**Verified live** on a throwaway account (deleted after; test credits via SQL, real
✦ untouched): fired a plant-shop + a lemonade brief, watched phases + code stream
live, terminal `{done}` → "Little Squeeze", compiled React, 3 files, buildMs 8436,
`fixed:0`. Live code-view UI mocked from the REAL captured stream + screenshotted
for the owner (dark Zephyr theme, filename tab, syntax highlight, phase stepper,
success bar). The UI is a design preview — NOT yet wired into the chatbox.

**Deploy gotcha logged:** the first Phase-4a deploy (873b79b) FAILED on a transient
Cloudflare API **522** during `wrangler deploy` (nothing to do with the code —
bundling + secrets succeeded). Re-deployed via a no-op change; also renamed
`instance_type` `standard` → `standard-1` (same 4 GiB tier) to clear a wrangler
deprecation warning. **Lesson: always confirm the deploy run's conclusion=success
(GH Actions) before testing — a green *merge* is not a green *deploy*.**

**Still open in Phase 4 — the CUTOVER (big, needs owner's steer):** wiring the React
engine in as the actual chatbox builder replaces the whole static-HTML page/edit
model (revise, per-page preview, publish, edge functions, version history are all
built around editable page HTML; React output is a compiled bundle). That's a
product decision + a multi-step migration, not a drop-in. Parked for the owner to
direct next.

---

## 2026-07-20 — ✅ FIRST LIVE REACT BUILD SUCCEEDED (owner reloaded Anthropic credits)

Once the Anthropic API balance was topped up, the React pipeline ran clean
end-to-end on the first try:

- Prompt: one line ("small-batch coffee roaster called Ember & Oak…").
- Result: `ok:true`, live at **`/s/a-clean-landing-page-for-a-s-7a2c10/`** — a real
  **compiled Vite/React SPA** (bundled `index.html` + hashed `index-*.js` +
  `index-*.css`), not static HTML. `buildMs 8146` (container vite build ~8s),
  total ~138s, `cost 133` credits (throwaway account, deleted after).
- The model self-branded it "Ember & Oak — Small-Batch Coffee Roasters" (title +
  nav + 3 bean cards Finca Alta/Kayanza Reserve/Cerro Negro with roast badges +
  altitude/process/tasting notes + Our Story + footer). Screenshot sent to owner.
- Rendered headless with ZERO page errors. (Screenshotting note for future
  sessions: the headless browser can't reach isibi.ai through the agent proxy —
  curl the dist files down, serve on 127.0.0.1, launch chromium with
  `--proxy-server=direct://` / `--proxy-bypass-list=*` (NO proxy for localhost),
  screenshot that. Generated images 404 in that local render but are real on the
  live URL.)

**Known rough edge for prod (not blocking the milestone):** the whole build is one
synchronous ~138s HTTP request (generation is NON-streaming). At `max_tokens 16000`
that's borderline against the 180s Anthropic AbortSignal and any client timeout —
a bigger app could exceed it. Phase 4 should move generation to **streaming**
(the claude-api guidance: stream for large max_tokens) and/or make the endpoint
async (kick off → poll), which also feeds the live code-streaming view the owner
wants.

---

## 2026-07-20 — Phase 4c: FULL CUTOVER — the chatbox builder now IS the React engine ✅

Owner's call: "full cutover now" + "collapsed rows" + "not the open-site card". Done.

**What changed in the chatbox (`chat.js`/`styles.css`):**
- New project OR any React site → the streaming React engine (`/api/site/react-build`
  · `/api/site/react-revise`). Legacy static sites keep the old `/api/site` path.
- **Live view IS the chat** — Claude-Code-style collapsible step rows (`.st-step`):
  during a build "Writing the code ▾" streams the source live; when done the rows
  collapse to ✓ summaries stored ON the message (Wrote the code / Generated images
  → opens thumbnails / Compiled / Published), each opened by the ▾. Rows default
  COLLAPSED. NO "Open site" result card (owner cut it — redundant w/ the preview +
  the top-bar "Live ↗"). Output text restyled to match.
- Stage: compile placeholder during a first build, then the compiled site from
  `/s/<slug>/` (cache-busted per revise). `Publish`→`Live ↗`; Code tab + Download-
  HTML hidden for React sites; site cards preview the live compiled app.
- Data model: a React site carries `react:true` + `slug` + `url` + `previewV`; a
  synthetic 1-page `pages[]` keeps the built/unbuilt gate working. `sitesSave`
  spreads `...s` so these + `m.build` persist.

**Verified live** (throwaway, real ✦ untouched, deleted after): built "El Fuego"
(5 images, published), then **revised by chat** ("change the hero headline to Tacos
That Bite Back") → same URL, rebuilt in 14s, headline changed, rest preserved.
Screenshotted for the owner.

**Bug caught + fixed in-flight:** revise first threw a generic error — `react-revise`
referenced `REACT_REVISE_RULES` but the worker only imported `REACT_RULES` +
`REACT_FIX_RULES`, so it was a runtime ReferenceError (esbuild doesn't catch an
unimported reference — it becomes a global lookup). Added the import (PR #445).
**Lesson: a new worker helper that references an imported binding must be added to
the `react-gen.mjs` import list; syntax-check won't catch a missing import.**

**Not screenshotted in-app:** the logged-in builder can't be rendered headless here
(Supabase login + the agent proxy can't reach isibi.ai from Chromium), so the live-
view visual was validated via the standalone prototype (identical markup/CSS) driven
by a real stream. The in-app wiring is deployed; owner should try a build to confirm.

**Deferred (React sites, follow-ups):** the More→Cloud panels (Analytics/Inbox/
Members/Functions/Files/Payments) + Deep-scan + version-restore were built for
static page-HTML; they're still reachable for React sites but some assume page HTML
— revisit per-panel when the owner wants them on React. R2 has a few orphaned test
sites (little-squeeze/ember/el-fuego) from throwaways — harmless, unlinked.

---

## 2026-07-20 — Per-site backends: the two-layer decision + Phase A (D1 plumbing)

Owner's direction for giving built sites their own backend (like Lovable):
- **Layer 1 = isibi's OWN login** (people who log in to build sites) → **stays on
  Supabase, no Clerk.** Untouched. (Clerk was considered + priced — good for L1
  someday, but a bad fit for L2: it'd mix all sites' visitors into one pool or cost
  per-visitor across every built site. Rejected for L2.)
- **Layer 2 = each BUILT site's own backend** (its visitors' logins + its data) →
  **its own Cloudflare D1 database per site.** No Clerk; we build the site auth on
  standard primitives (WebCrypto).

**Why D1, confirmed from CF docs:** included in the $5 Workers Paid plan we already
have — 25B row reads / 50M writes / 5GB storage per MONTH included, then pennies.
**No per-database fee**; **50,000 databases/account** on Paid (raisable), 10GB each.
So "one DB per site" is ~$0 until real scale. KEY point the owner needed: it's **one
Cloudflare account + one Worker + many databases** — NOT a separate CF project per
site. Separate *databases* already give hard isolation (site A's queries can't reach
site B's DB); you don't need separate projects for that.

**Phase A shipped (plumbing):** `site_backends` table (slug→D1 uuid, RLS own-read,
cascades on account delete) + Worker `cfD1Create`/`cfD1Query`(by uuid)/
`ensureSiteBackend` + test endpoint `POST /api/site/backend/ensure`. Two new Worker
secrets wired in deploy.yml: `CF_ACCOUNT_ID` (reuses `CLOUDFLARE_ACCOUNT_ID`) +
`CF_D1_API_TOKEN` (owner created a Custom token, Account·D1·Edit, 2026-07-20).

**Build order (each testable):** A plumbing ✅ · B schema (AI declares tables) ·
C built-site auth (signup/login/me, users in the site's own DB) · D data read/write
(access-controlled) · E builder UI (Data/Users panel). All D1, $0 until scale.

---

## 2026-07-20 — Per-site backend Phases B + C (schema + built-site auth) ✅

**Phase B — schema:** `applySiteSchema(uuid, spec)` turns an AI-declared JSON table
spec into safe DDL (strict identifier validation + double-quoting → SQL-injection
proof, whitelisted types, auto `id` PK + `created_at`) and creates the tables in the
site's own D1. `parseSchemaSpec(files)` pulls `isibi.schema.json` out of a generated
project. Test endpoint `POST /api/site/backend/schema`. Verified live: products+orders
created; a malicious table name was rejected 400.

**Phase C — built-site visitor auth:** public, slug-scoped endpoints
`/api/db/<slug>/auth/{signup,login,me}`. Each site's visitors' accounts live in that
site's own D1 `_users`; passwords hashed **WebCrypto PBKDF2 (100k iters — the Workers
cap; 120k throws "iteration counts above 100000 are not supported")**, random salt,
constant-time compare. Session tokens HMAC-signed with a **per-site secret** stored in
the site's own DB (`_meta.auth_secret`) → a token for site A is invalid on site B (no
platform-wide auth secret). Brute-force lockout (8 fails → 15 min), generic login
errors + dummy hash on unknown email (no timing enumeration), 8-char min. Helpers are
`signSiteUserToken`/`verifySiteUserToken` (the names `signSiteToken`/`verifySiteToken`
were already taken by the OLD static-site member auth — don't collide).
Verified live: signup→me→login all work; wrong-pw 401, dup 409, **cross-site token
rejected 401**.

**Still ahead (per-site backend):** D — data read/write API (access-controlled:
collect / display / per-user buckets) · E — builder Data/Users panel · plus the
GENERATION WIRING (extend REACT_RULES so the AI declares `isibi.schema.json` + wires
login/data forms; the react-build/revise pipeline calls ensureSiteBackend +
applySiteSchema). Until that wiring lands, A–C are server capabilities proven by
endpoint tests, NOT yet triggered by a normal user build. **Orphan test D1 DBs still
accumulate in the CF dashboard (no delete path yet — that's part of D/E + account
deletion).**

---

## 2026-07-20 — Per-site backend Phase D + WIRING: LIVE end-to-end (Lovable-style) ✅

**Phase D — data API:** schema now records each table's access mode + column
allow-list in the site's own `_meta.schema`. Public API `/api/db/<slug>/rows/<table>
[/<id>]`: **collect** = public insert only, **display** = public read only, **user**
= login required + rows scoped to `owner_id`. Owner read `/api/site/backend/rows`
(isibi-authed) for the builder panel + collect submissions (`_users` never exposes
hashes). Verified: all three modes enforced; two visitors' `user` rows isolated.

**Generation WIRING (the capstone):** REACT_RULES + REACT_REVISE_RULES gained a
BACKEND protocol — the model emits `isibi.schema.json` (tables + access) and wires
forms to `/api/db/<slug>/…` (slug from `location.pathname.split('/')[2]`) ONLY when
the site needs data/auth. react-build/revise `parseSchemaSpec` (never shipped) →
after publish, `ensureSiteBackend` + `applySiteSchema` auto-provision (non-fatal on
error). New `{ev:phase 'database'}` + `{ev:done backend:true}`; live view shows a
"Setting up the database" step. (NOTE: `BACKEND_RULES` must be declared BEFORE
REACT_RULES in react-gen.mjs — const TDZ, not hoisted.)

**LIVE END-TO-END PROOF:** built "FocusFlow" from one sentence ("a waitlist page
where emails are actually saved") → model declared `waitlist_signups` (collect),
backend auto-provisioned, a visitor POSTed an email (public) → saved, owner read it
back. Full Lovable-style "describe an app with data → it works" is LIVE. Screenshot
sent.

**So the per-site backend (A→D + wiring) is COMPLETE and live.** Remaining polish:
Phase E — a builder **Data/Users panel** (front-end) so the owner sees rows in-app
(today they're reachable via `/api/site/backend/rows`); plus a D1 **delete path** on
account deletion / site delete (orphan test DBs still accumulate).

---

## 2026-07-20 — Per-site backend Phase E: builder Data/Users panel ✅ (feature COMPLETE)

New **"Data" top-bar tab** in the builder, shown on any React site that has a backend
(`site.backend`, set from the build's `done.backend`). `loadSiteData(site)` (chat.js)
lists the site's tables (from `/api/site/backend/rows?slug=`) down the left with their
access type + a "Users" tab, and paints a live grid of the selected table's rows
(`&table=`). The owner sees signups / submissions / accounts in-app. Styles: `.st-data*`.

**→ The per-site backend is now feature-complete: A (provision) · B (schema) · C
(built-site auth) · D (data API) · E (Data panel) + generation wiring, all live.**
A user builds an app that needs data → its own DB + tables + login + working forms,
and the owner views the data in the builder. Lovable-style, done.

**Only real remaining item:** a **D1 delete path** — deleting a site or an account
should also delete its D1 database(s) (call the CF DELETE API + drop the
`site_backends` row; add to `delete_account`). Today orphan DBs accumulate (harmless,
counts toward the 50k cap). Do this before heavy real usage. Minor UI nit: long table
names clip the access label in the Data sidebar (cosmetic).

---

## 2026-07-20 — Full site delete (the × on a Your-Sites card now wipes everything) ✅

Owner: "if user deletes it from there, that's it, it's deleted." Done. The card ×
used to only drop the site from localStorage — the live page + D1 db lingered.
Now: `POST /api/site/backend/delete` (auth, owner-scoped via the React source uid
and/or the `site_backends` row) deletes the **D1 database** (`cfD1Delete` → CF DELETE
API) + its mapping row, and the R2 **published dist + uploads + generated source**.
Frontend card × confirms (permanent) then calls it before removing locally; drafts
with no slug still delete locally only. Verified live: owner delete → 404 "no
backend" after; a NON-owner's delete attempt is blocked (site survives).

- Nit: the non-owner block returns 401 ("sign in required") instead of a cleaner
  403 — security is correct, message is off. Cosmetic.
- **Still pending:** ACCOUNT deletion (`delete_account` + the client wipe) doesn't
  yet loop the user's react sites through this delete endpoint, so deleting an
  account leaves its site D1 DBs orphaned. Small follow-up: on account delete,
  iterate `sitesCache` slugs → call `/api/site/backend/delete` for each first.

---

## 2026-07-20 — Test pass on the builder + per-site backend (found + fixed 1 real bug)

Ran real end-to-end builds (owner said "start testing"). Results:
- **Login app (user-tier), "DayList" to-do:** PASS. Model declared a `user` table
  (`tasks`: title/done), wired signup/login/rows + Bearer token; 2 visitors →
  each sees ONLY their own tasks, logged-out → 401, re-login works, data saves +
  reads. App renders as a real login-gated landing page.
- **Plain portfolio ("Mira Voss"), no data:** PASS — correctly `backend=False`,
  no schema (no over-provisioning of informational sites).
- **Revise-adds-backend (add a contact form to the portfolio):** found a **REAL
  BUG** → the model declared the schema in an alternate shape
  `{tables:{messages:{fields:{...}}}}` (object-keyed + `fields`, no `access`)
  instead of the canonical `{tables:[{name,columns:[...]}]}`, so `applySiteSchema`
  created **0 tables** and the form would POST to a missing table. **FIXED:
  `normalizeSchema()` (worker.js) now coerces tables-as-object/array, columns/
  fields (object or array), bare-string cols, and missing access→'collect' before
  applying.** Re-verified: alternate shape now creates the table + the form
  saves + owner reads the message.
- **Full site delete on real sites:** PASS — both test sites deleted via the
  endpoint → backend 404 + live page 404 (R2 wiped).

Lesson: the model's schema JSON shape VARIES run-to-run; keep `applySiteSchema`
tolerant (it is now). If more shape drift shows up, extend `normalizeSchema`.

---

## 2026-07-20 — Test round 2 (feed + display): 1 fixed, 1 known-limit noted

- **Community feed (Campfire, "post publicly, everyone reads"):** was **BROKEN** —
  the model picked `display` (public read, no write) so logged-in posting 403'd.
  **FIXED: added a 4th access mode `feed`** = public GET, logged-in POST/PATCH/
  DELETE scoped to the author (owner_id). Verified: 2 users post → public read
  sees BOTH; logged-out post → 401. Rules now steer the model to `feed` for
  boards/comments/reviews/public-guestbooks (vs collect which hides, display
  which blocks). The four modes: **collect · display · user · feed.**
- **Shop (Clayware, "products from a database"):** the model **hardcoded** the 4
  mugs (`backend=False`) instead of a `display` table — correct, because `display`
  tables start EMPTY and there's no owner content-editor yet. Not broken (the shop
  works), just not DB-editable. Rules now tell the model to hardcode small fixed
  catalogs. **RESOLVED 2026-07-20 — owner content editor SHIPPED:** the Data panel
  is now editable. `/api/site/backend/row` (POST/PATCH/DELETE, owner-scoped via
  `siteBackendForOwner`) lets the owner add/edit/delete rows in their own declared
  tables; the panel got a `+ Add` button, an add/edit form (a field per declared
  column) and per-row Edit/× controls. `_users`/`_meta` are blocked; columns are
  allow-listed from the schema (minus id/created_at/owner_id). "The AI builds the
  storefront; you stock the shelves." **So `display` is now first-class** — the
  model can use it for products/posts/menus and the owner fills the content in.
  Live-verified end-to-end: owner adds 2 menu rows → owner read sees them → PATCH
  edits price → PUBLIC data API (what a visitor sees) reflects it → DELETE removes
  it; guards held (_users 404, undeclared column dropped). Test account/site wiped.

- **Account deletion now wipes built sites (2026-07-20):** deleting an isibi
  account used to orphan each built site's Cloudflare D1 database. New
  `/api/site/backend/delete-all` sweeps the `site_backends` ledger for the user
  (every D1 they own, cross-device) + R2 (published dist, uploads, source) + the
  mapping rows, and the client passes its locally-known slugs too so informational
  sites (no D1) get their R2 cleaned. Called in the delete-account flow BEFORE the
  account is removed (best-effort, never blocks the delete).

- **Cross-user isolation audit (2026-07-20) — data was safe, responses lied.**
  Hammered `feed` + `user` modes with two site-visitors (Alice/Bob). Every read
  and write is correctly scoped `WHERE id=? AND owner_id=?`, so Bob could never
  read/edit/delete Alice's rows — **no leak, no breach.** BUT a wrong-owner (or
  already-gone) PATCH/DELETE still returned `{ok:true}`/200 because the SQL
  succeeded with 0 rows changed. A generated app checks `res.ok` to update its UI,
  so it would show "Saved"/"Deleted" falsely. **FIXED:** new `cfD1Exec` reads D1's
  rows-changed count; scoped writes now 404 `{ok:false,"not found"}` on 0 changes,
  and a `user` GET-by-id that matches nothing 404s instead of `{ok:true,row:null}`.
  Re-verified: 20/20 cross-user checks pass. (PR #467)
- **Schema-merge bug (2026-07-20) — a revise could break existing tables.**
  `applySiteSchema` wrote the current call's tables as the WHOLE `_meta.schema`.
  A revise that re-emits a schema with only the new/changed table would overwrite
  it, stripping pre-existing tables from the data API's allow-list — their data
  still existed (`CREATE TABLE IF NOT EXISTS` never drops it) but the API 404'd
  them as "unknown table", silently breaking a live app's existing forms/feeds.
  **FIXED:** applied tables now MERGE into the persisted schema (re-declared wins,
  untouched preserved); a revise can't strip a table's access. (PR #468)
- **Boolean columns didn't round-trip (2026-07-20).** Posting `active: true` into
  a `boolean` column stored the STRING "true" (D1 binds a JS bool as text). Both
  "true" AND "false" are truthy in JS, so a generated app's `if (row.done)` would
  treat a `false` row as true — silently broken todo/checkbox/published flags.
  **FIXED:** `d1Params` coerces every bound param (true→1, false→0, undefined→null)
  at the one bind point all writes share. Integer/real already round-tripped. (#470)
- **Also audited clean (no bugs), 2026-07-20:** cross-OWNER isolation (a different
  isibi user can't read/add/reschema/delete another owner's site), auth brute-force
  lockout (7 wrong = 401, 8th locks, correct pw then 429 for 15 min), signup guards
  (dup 409 / short-pw 400 / bad-email 400 / garbage-token 401), cross-SITE token
  isolation (a login on site A can't touch site B — separate HMAC secret + slug
  check), collect-read protection (submissions owner-only), and identifier/injection
  guards. NB: login enforces the 8-char min BEFORE the lockout counter, so only
  valid-length wrong passwords count toward a lockout (fine — a <8 pw can't be right).

- **Built-app visitor password reset SHIPPED (2026-07-20, #476).** The per-site D1
  visitor auth had signup/login/me only — a forgotten password = locked out forever.
  Added `POST /api/db/<slug>/auth/reset-request` (always ok, no existence leak;
  emails a single-use 45-min link bound to the current hash via `pv`) + `reset`
  (verifies sig+exp+purpose+slug+pv, sets new hash, clears lockout, returns a fresh
  session). Platform-hosted **/reset** page (worker-served, self-contained, on-brand)
  so the generated app never needs its own reset route — the model just wires a
  "Forgot password?" request form (BACKEND_RULES updated). Email via `sendPlatformEmail`
  → Go Farther. Tested 11/11 (page renders, reset-request always-ok for existing/
  unknown/honeypot/bad-email, reset rejects garbage + wrong-purpose tokens, orig pw
  still works). Happy path (real emailed token→change) unverifiable without the key +
  a mailbox, and the token secret is correctly unforgeable.
  **⚠️ SETUP NEEDED for email to actually send:** add a GitHub Actions secret
  `GO_FARTHER_API_KEY` (the same gf_live_… key the Supabase send-email fn uses), then
  re-add `GO_FARTHER_API_KEY` to deploy.yml's `secrets:` list + uncomment its env line
  (instructions inline in deploy.yml). Until then reset-request succeeds silently but
  sends nothing. **LESSON (logged):** adding a name to wrangler's `secrets:` list
  before the GitHub secret exists FAILS THE WHOLE DEPLOY ("Value for secret X not
  found") — always create the secret first, or the deploy is dead.
- **BACKLOG (owner's call 2026-07-20):** cap built-site DB creation via CREDITS
  (charge per provision) rather than a hard per-user limit — "set that up later."
  No cap today; acceptable while the user base is small.
- **Robustness/fuzz pass (2026-07-20) — all clean (30/30), no bugs.** Threw malformed
  schemas (tables as string/number/null, columns as string, access as number, garbage
  types, nested junk, whole-body null/string) → all handled, never a raw 500
  (normalizeSchema coerces or 400s). ensure with empty/missing/huge/symbol slugs →
  sanitized or 400. Non-JSON bodies → 400. Data API: PUT→403, non-JSON→400, unknown
  slug→404. `/s/<slug>/` serving: crafted traversal paths (`../../etc/passwd`,
  `..%2f`, `....//`, 300-char) ALL 404 — safe by construction (R2 object keys are
  literal strings, so `..` never resolves like a filesystem; slug regex is `[a-z0-9-]`
  only). Site stayed functional after the whole fuzz. delete-all re-verified too.
- **FULL-STACK security sweep (2026-07-20) — ALL AIRTIGHT, zero findings.** Went
  beyond the D1 backend to the whole app, testing as real authed users (anon key +
  JWT) against Supabase + the Worker:
  · **Money RPCs** — a normal user CANNOT call `add_credits`/`set_plan` (404 PGRST202,
    not exposed to `authenticated`) or `credit_back` (403); `use_credits(-100000)`
    doesn't add; direct `UPDATE credits`/`INSERT user_plan`/`INSERT purchases` all
    403 (42501 — authenticated role has NO write grant on money tables; only the
    SECURITY DEFINER RPCs touch them, minting is service_role-only).
  · **RLS** — user A reads 0 rows of B's credits/purchases/user_plan/chats/
    user_memory/user_assets/usage_log/gen_charges; can't write into B's data.
  · **SSRF** (`/api/import/fetch`) — every internal target blocked (127/10/172.16-31/
    192.168/100.64 CGNAT/0.0.0.0/169.254 metadata/::1/fe80/fc00, plus decimal/hex/
    octal-int and IPv4-mapped-IPv6 encodings, trailing-dot, `.internal`); file/gopher/
    ftp schemes 400; no content leak; no credits spent.
  · **Storage** (`media` bucket) — INSERT/DELETE/SELECT policies are path-scoped to
    `media/<auth.uid()>/`; A uploading into B's folder = 403 RLS "new row violates
    row-level security policy"; own folder works.
  · **Stripe webhook** — unsigned AND forged-signature events both rejected 400 "bad
    signature"; no credits minted.
  · **Generation gates** (`/api/{image,video,audio}`) — unauthed 401; a non-allowlisted
    model 400 "unknown model" BEFORE any fal call/charge; error bodies never say "fal".
  All test users/data deleted.

- **PLATFORM STACK — building out the layers every app needs (2026-07-20).** Model:
  the platform provides each backend layer as a ready primitive; the AI declares/
  wires it and the platform provisions+serves it (same as the DB does). Status:
  · **QUALITY PASS (owner 2026-07-21, "do that better") — 3 things, not more breadth:**
    (1) **BACKEND_RULES consolidation (#515):** the build prompt had grown to ~3900
    tokens read on EVERY build (dilution + cost risk); rewrote it ~58% smaller (~1650
    tokens) with ZERO capability lost — kept every endpoint/exact syntax + the critical
    schema-mandatory + access-mode warnings, cut boilerplate fetch() examples; validation
    folded into the column shape. Audited all 28 capability markers present. (2)
    **Cascade delete (#516/#517) — VERIFIED live 11/11:** deleting a row (data API feed/
    user/admin + owner editor) now also deletes its direct children (tables whose `ref`
    points at it) so no orphans; ownership checked FIRST (gone/not-yours → 404, no phantom
    cascade). **Honest transactions finding:** empirically confirmed **D1's HTTP /query
    rejects multi-statement SQL + BEGIN/COMMIT**, so true multi-write ACID transactions
    are NOT available for dynamic per-site DBs — cascade runs SEQUENTIAL children-first
    deletes (a mid-failure can only leave a harmless childless parent, never an orphan).
    So: the "transactions" gap is a genuine D1 platform limit, not a to-do. (3) **Owner
    UI (#519):** wired 3 new More▸Cloud cards + on-brand glass modals — **Insights**
    (visitor traffic by event + top pages from analytics, plus API request/error counts
    from metrics), **Backups** (back-up-now + list + one-click restore, logins
    untouched), **Versions** (list archived builds + one-click roll back). Screenshot
    shown + approved. Endpoints were already live/verified — this is the missing UI.
    **Export/Import UI (#521):** added under snapshot/restore in the Backups panel —
    pick a table → Export CSV/JSON (authed blob download) or Import CSV (file → rows).
    So EVERY backend data endpoint now has an owner control. Only non-UI'd surface left
    is the AI endpoint (no owner need — it's an in-app feature). **QUALITY PASS COMPLETE.**
  · **AI-as-a-primitive (#508) — built apps call an LLM, no key, VERIFIED live 15/15.**
    A built app adds real AI (chatbot, summarize, suggest-a-reply, categorize) with
    `POST /api/db/<slug>/ai {prompt,system?}` → `{ok,text}`, or an `{do:"ai"}` function
    step → `{{steps.r.text}}`. Platform runs Claude Haiku server-side; each call is
    METERED TO THE APP OWNER'S CREDITS (their visitors trigger it, so the caller can't
    be charged) via a NEW service-role, mint-gated `use_credits_for` RPC that atomically
    gates+charges and REFUNDS on any failure. Flat 1 credit/call, output capped (800
    tok), hard rate limit 20/min per visitor, errors ALWAYS generic (a visitor never
    sees provider internals). **Proof:** 9/9 free (empty prompt → no charge + friendly
    error; error text leaks no "anthropic/fal/haiku/claude/key"; `use_credits_for`
    blocked for anon 401 + authenticated 403 = drain locked; GET /ai 404) + 6/6 paid
    (real Haiku replied "OK" / "Hi there, friend!"; owner charged EXACTLY 1 credit per
    call, 20→19→18). Owner approved the ~$0.006 test spend. Builder rules document both
    forms. **This is the AI-native differentiator — apps ship AI features out of the box.**
  · **Visitor analytics (#512, accuracy fix #513) — page views + events, VERIFIED live
    12/12.** A built app fire-and-forgets `POST /api/db/<slug>/track {event,path}` on
    page views + key actions (signup/purchase); the owner reads `GET /api/site/backend/
    analytics?slug=&days=` → `{total, byEvent, byPath, byDay, rows}`. Stored as tiny
    (day,event,path) counter upserts in the site's own D1 `_analytics` — never raw per-
    event rows, so no DB bloat. PRODUCT analytics, distinct from ops `_metrics` (which
    counts API requests). **#513 note:** first shipped buffered (flush-at-20) like
    _metrics but that under-counted at low traffic (13/25 — events stranded in sub-
    threshold isolate buffers); fixed to write EACH event through immediately (per-event
    upsert via waitUntil, table ensured once/isolate) so view-counts are EXACT — re-test
    12/12 total=25, view=20/signup=4/purchase=1, /pricing=11, no-auth→401, XSS event/
    path sanitized. Rate-limited 300/min per visitor. Builder rules document /track.
  · **Event triggers (#511) — on-insert → function, VERIFIED live 6/6.** A function can
    declare `"on":{"insert":"<table>"}` (sibling of steps) to run AUTOMATICALLY after a
    row is inserted into that table (new order → email me · new signup → notify Slack ·
    new comment → AI-screen), with the new row as `{{input.<field>}}`. Fires on single-
    row VISITOR inserts (collect/feed/user/admin), NOT bulk imports (no flood), via
    ctx.waitUntil (write never blocks); per-slug trigger list cached in-isolate 60s so
    no-trigger sites pay ~1 lookup/min. **Also FIXED the ai function step:** `ai` was
    missing from FN_ACTIONS so `{do:ai}` was silently stripped on normalize (the direct
    /ai endpoint always worked) — now the step survives + runs metered to the owner.
    **Proof (zero AI/fal): 6/6** — an order insert fired the fn → wrote a `logs` row
    templated from `{{input}}`; a 2nd order → 2nd log; a bulk import of 3 orders fired
    ZERO triggers. Seeded the fn straight into site_functions (no build); cleaned up.
  · **Data import (#509) — CSV/rows → a table, VERIFIED live 14/14.** Owner endpoint
    `POST /api/site/backend/import {slug,table,csv|rows}` — the mirror of export. Parses
    a CSV string (RFC-4180-ish: quoted fields, embedded commas/newlines, `""` escapes)
    with case-insensitive header→column mapping, or a rows array; cap 2000; only declared
    columns written (unknown dropped, `_users`/`_meta` blocked, empty cell → NULL).
    **Proof (zero AI/fal): 14/14** — `"Gadget, deluxe"` + `""quotes""` parsed, Name→name/
    Price→price mapped, `ignored` col dropped, empty price→NULL, rows-array path, header-
    only→400, _users refused, no-auth→401, and export round-trips it. Owner-facing.
  DB ✅ · Auth+reset ✅ · **Files ✅ (#484)** · **Server functions + Secrets ✅ (#486)
  → this also delivers Payments + Email for React apps** (via a checkout/email
  function step + a secret) · **Search/Query ✅ (#490)** · **Stats/Aggregations ✅
  (#491)** · **Roles/permissions ✅ (#492)** · **Email verification ✅ (#493)** ·
  **Realtime ✅ (#494)** · **Relations/expand ✅ (#495)** · **Reverse relations ✅
  (#496)** · **Upsert ✅ (#497)** · **Batch insert ✅ (#498)** · **Data export ✅
  (#499)** · **Rate limiting ✅ (#500)** · **Validation ✅ (#501)** · **Multi-word search
  ✅ (#502)** · **Observability ✅ (#503)** · **Backup/restore ✅ (#504)**. Custom domains
  LAST (owner's call 2026-07-21 — "all of them, leave custom domains for last"; it needs
  the owner to enable Cloudflare custom hostnames + SSL at the account level, so it's
  gated on infra, not code).
  · **Backup/restore (#504) — data DR for built apps, VERIFIED live 11/11.** Owner
    endpoints: `POST /api/site/backend/backup` snapshots ALL declared data tables into
    one JSON in R2 (`backups/<slug>/<ts>.json`); `GET …/backups` lists them; `POST …/
    restore {key}` DELETEs + reloads those tables from a snapshot, **preserving row ids
    so relations survive**. `_users` is EXCLUDED (a restore can never wipe/expose
    logins). Restore keys are prefix-scoped to the slug; site delete (single + account-
    wide) sweeps `backups/<slug>/`. Owner-facing, no build-prompt change. **Proof (zero
    AI/fal): 11/11** — backup counted 4 rows, listed, deleted all posts, restore brought
    3 posts + 1 comment back with **id 1 preserved** so the comment still expand-joins
    its post; no-auth→401, foreign-slug key→400. Cleaned up.
    **NOT done (honest):** *build* versioning/rollback (keep last N published builds for
    one-click rollback) — that's a publish-pipeline change, separate from this DATA
    backup/restore. NOW BUILT as #506 (below).
  · **Build rollback (#506) — revert a bad deploy, safety VERIFIED live 7/7.** Every
    React publish (build + revise) archives its whole dist as one JSON snapshot in R2
    (`builds/<slug>/<ts>.json`), keeps the newest 5. Owner endpoints: `GET …/builds`
    lists snapshots newest-first; `POST …/rollback {key}` rewrites that snapshot's dist
    to `sites/<slug>/` — the live site reverts in one call. Owner-scoped via the
    generated source uid; keys prefix-scoped to the slug; delete sweeps `builds/<slug>/`.
    Reverts what SERVES; source is unchanged so a later AI edit rebuilds from newest
    (edit-after-rollback = roll forward — documented caveat). **Free safety proof: 7/7**
    (builds/rollback on a non-owned or absent site → 401 before any R2 read; foreign-
    slug key → 400; missing slug/key → 400; no-auth → 401). The FULL archive→rollback
    cycle needs one real published build to seed a snapshot — owner chose NOT to spend
    (~$0.05 Anthropic) on a test build 2026-07-21, so that half verifies on the next
    real build. Owner-facing, no build-prompt change.
  · **GAP PASS COMPLETE (2026-07-21).** After the stack-category review, closed every
    backend gap except DNS (owner's skip): rate-limiting #500, validation #501, search
    #502, observability #503, backup/restore #504, build-rollback #506 — all verified
    live (rollback: safety only, per owner's no-spend call). Remaining knowns: custom
    domains (infra), email key (owner sets GO_FARTHER_API_KEY → verify/reset emails go
    live), true FTS5 / Durable-Object realtime / Analytics-Engine metrics (all "scale
    upgrades", current versions work). **The backend stack is ~complete — flagged to
    owner 2026-07-21 that the higher-value work now is (1) OWNER-FACING UI for the
    backend-only endpoints (export/backup/restore/rollback/metrics have no button yet)
    and (2) a BACKEND_RULES consolidation for build-prompt bloat. Next new-capability
    candidate: AI-as-a-primitive (built apps call an LLM via the platform).**
  · **Observability (#503) — per-app request/error counts, VERIFIED live 9/10.** Every
    `/api/db/<slug>/*` response status is captured at the top-level handler, buffered
    in-isolate, batch-flushed (~every 10 hits) into the site's own D1 `_metrics` table
    as daily `{reqs,errs}` totals — durable usage WITHOUT a write-per-request. Owner
    endpoint `GET /api/site/backend/metrics?slug=&days=` → the daily series + totals
    (flushes the live buffer first). Owner-facing, no build-prompt change. **Approximate
    BY DESIGN** (per-isolate buffering: counts stranded in another isolate's sub-
    threshold buffer are missed until it flushes). **Proof (zero AI/fal): 9/10** —
    baseline 0, then ~23/26 reqs + 3/6 errs counted (the shortfall IS the documented
    per-isolate approximation, NOT a bug), errs<reqs, a dated day-row persisted, totals
    grew with more traffic, no-auth→401, and the public API can't reach `_metrics`
    (404). For exact counts we'd need Analytics Engine / a durable counter (scale
    upgrade). Cleaned up.
  · **Search upgrade (#502) — multi-word + relevance ranking, VERIFIED live 10/10.** `q=`
    was a literal substring match; now it splits into words and requires EVERY word to
    appear in SOME declared column (AND of terms, OR across columns) — `q=miami beach`
    matches rows with both words in any field/order. With `q` and no explicit sort,
    results rank by relevance (how many term×column pairs hit), best first. True FTS5
    (stemming/prefix) stays the scale upgrade (like Durable Objects for realtime).
    **Proof (zero AI/fal): 10/10** — "miami beach"→only the both-words row, "beach
    austin"→0, reversed "loft miami" still matched, a city-only "miami" match ranked
    LAST, `sort=title` overrode ranking, and it combined with `where`+`total`. Cleaned.
  · **Validation (#501) — server-side write validation, VERIFIED live 14/14.** A schema
    column can declare `required:true`, `max:<n>`, or `format:email|url|number`; the data
    API rejects bad writes with 400 + a message across EVERY write path (single POST,
    batch, upsert, PATCH-present-fields). Required fires only on insert; a hard 100k-char
    cap guards every field. Rules persist in the schema next to refs. **Proof (zero AI/
    fal): 14/14** — missing/empty required → 400, bad email/number/url → 400, over-`max`
    → 400, fully-valid + optional-omitted rows → 200, a batch with one bad email rejected
    WHOLE (nothing landed), 100k field capped. Cleaned up.
  · **GAP-CLOSING PASS (owner 2026-07-21, "build all of them, skip dns"):** after the
    stack-category review, closing the real gaps — rate limiting ✅ (#500), then
    validation, full-text search, observability, backups/rollback. Email-key + custom
    domains stay owner-gated. Each free to verify.
  · **Rate limiting (#500) — built apps' API now throttled, VERIFIED live.** Per-site +
    per-visitor-IP burst limiter on `/api/db/*`: reads 300/min, writes 60/min, auth
    30/min, email-send (reset/verify request) 10/min (dropped neutrally — no reveal, no
    inbox flood). 429 + Retry-After over the limit. Fixed 60s window, in-isolate counter
    with stale-window eviction — ZERO new infra (a strict GLOBAL limit would need KV/
    Durable Objects; per-isolate still meaningfully caps abuse). Transparent to apps (no
    build-prompt change). **Proof (zero AI/fal):** auth capped at EXACTLY 30/min (30×401
    then 15×429), writes at EXACTLY 60/min (60×200 then 20×429), 20 quick reads all 200,
    throttle body friendly ("please wait a minute", no internals). (The lone red check
    in the harness was a TEST-REGEX false positive — its no-leak guard matched "fal"
    inside the JSON word "false"; not a real leak.) Cleaned up.
  · **Data export (#499) — owner downloads a built-app table, VERIFIED live 13/13.**
    `GET /api/site/backend/export?slug=&table=&format=csv|json` streams the table as a
    CSV or JSON attachment (backups, GDPR, analysis). isibi-authed + owner-scoped;
    `_users` limited to safe cols (NEVER password hashes); cap 5000 rows; proper CSV
    escaping. **Owner-facing — ZERO builder-rules cost** (doesn't touch the build
    prompt; this is the "add capability without taxing every build" strategy from the
    bloat note). **Proof (zero AI/fal): 13/13** — CSV with header + escaped tricky value
    (comma/quote/newline → doubled quotes, wrapped), JSON array intact, `_users` export
    carried role/verified but NO pass_hash/pass_salt, no-auth → 401, unknown table →
    404. Cleaned up. **TODO (tiny, needs a screenshot):** add a ⤓ Export button to the
    Data panel in the Cloud UI — endpoint's live, just no button yet.
  · **PROMPT-BLOAT NOTE (flagged to owner 2026-07-21):** every layer appends to
    BACKEND_RULES (fed to the AI on EVERY build), which is now long — costs input tokens
    per build + can dilute the important rules. Owner chose "keep adding layers" anyway,
    so I'm now favoring layers that are OWNER-FACING or AUTOMATIC (near-zero builder-
    rules footprint) and keeping any new builder-rules text to one tight line. If build
    quality/cost ever suffers, the fix is a BACKEND_RULES consolidation/compression pass
    (parked option).
  · **Batch insert (#498) — many rows in one call, VERIFIED live 12/12.** `POST {rows:
    [{…},{…}]}` (array under `rows`, ≤100) to `/rows/<table>` inserts them all in one
    statement (CSV import, seeding, bulk) → `{inserted:N}`. All write modes, same auth +
    owner stamping; union of declared cols across the batch (missing → NULL). **Proof
    (zero AI/fal): 12/12** — collect batch of 3, ragged rows (missing email → NULL), a
    `user` batch stamped owner_id per row with A/B isolation, boolean coerced, and a
    150-row payload capped to 100. Cleaned up.
  · **Upsert (#497) — create-or-update by a key, VERIFIED live 14/14.** `POST /rows/
    <table>?upsert=<col>` updates the row already matching `<col>` instead of inserting
    a duplicate, else inserts; response carries `{created}`. Powers per-user settings,
    like/vote toggles, saved progress — any "one row per X." For user/feed tables the
    match is scoped to the signed-in user's OWN rows; collect/admin match globally. No
    DB-level UNIQUE needed (tiny race window, fine at app scale). **Proof (zero AI/fal):
    14/14** — a user's `settings?upsert=key` kept exactly one row per key and updated
    in place, a new key added a row, two users stayed independent (A never clobbered
    B), an `admin` config singleton updated by name, and a non-admin upsert on the
    admin table 403'd. Cleaned up.
  · **Relations (#495 forward + #496 reverse) — linked tables, joined in ONE call,
    VERIFIED live (10/10 forward + 9/9 reverse).** A schema column declares a foreign key with `ref`
    (`{"name":"post_id","type":"integer","ref":"posts"}`). FORWARD: `?expand=<fk_col>`
    (≤4) attaches each row's PARENT under the fk name minus `_id` (post_id → `post`).
    REVERSE (#496): `?children=<child_table>` (≤3) attaches each parent's CHILDREN as an
    array under the child table name (`posts?children=comments` → each post has a
    `comments` array). Both batched (one grouped query each, no N+1; children capped
    500 total / 50 per parent). FKs are metadata-only (D1 FKs stay off) — the platform
    joins. **SAFETY (verified):** a table is joined ONLY if it's public-read (display/
    feed/admin); expanding to a `user`/`collect` table is REFUSED so private rows never
    leak. Forward proof 10/10 (comments→posts correct, single-row expands, no-expand
    stays plain, bogus col ignored, user-table expand refused). So `GET /rows/posts/
    <id>?children=comments` = a post + all its comments in one request. Cleaned up.
  · **Realtime (#494) — live updates with NO new infra, VERIFIED live 13/13.** No
    Durable Objects / WebSockets (would've meant new bindings + cost + hard-to-test);
    instead a cursor-poll primitive: `GET /api/db/<slug>/rows/<table>/changes?since=
    <id>` returns only rows NEWER than the caller's cursor (ascending) + a fresh
    `{cursor}` + `{count}`. `&wait=1` LONG-POLLS up to ~20s (2s D1 checks), returning
    the instant a new row lands — near-instant chat/feeds with ~10× fewer requests, no
    push infra. Visibility mirrors the table (collect no-read; user sees only its own
    new rows). Appends-only (edits/deletes reconcile via a re-list). Builder rules give
    the chat loop (seed cursor from a DESC list, then poll changes?since=cursor&wait=1).
    **Proof (zero AI/fal): 13/13** on feed+user+collect — since=0 tail, incremental
    since=cursor returns only newer rows w/ advancing cursor, empty when caught up; the
    `wait=1` long-poll BLOCKED then RETURNED a row written mid-wait in **4.3s** (real
    push feel, not instant, not the full 20s); a `user` table surfaced only the
    caller's own new rows (401 without login); a `collect` table 403'd. Cleaned up.
  · **Roles/permissions (#492) — VERIFIED live 17/17.** Built-site users now carry a
    `role`; the FIRST person to sign up becomes `'admin'` automatically (owns the
    app), everyone after is `'user'`. signup/login/me return `role` (+`verified`) and
    role rides in the session token. New access mode **`admin`** = public READ, but
    only an admin site-user can create/edit/delete (a real in-app CMS — blog/catalog/
    events the owner manages from a logged-in admin screen, unlike `display` which has
    no in-app editor). Non-admin write → 403 'admins only'; anon write → 401; everyone
    GETs. New `_users` columns (role + verification) migrate in via a per-warm-isolate
    cached idempotent ALTER (not paid on every auth call); new sites get them from the
    CREATE. Owner's `_users` read now shows role+verified too (member admin view).
    **Proof (zero AI/fal):** two signups → admin + user; admin POST/PATCH/DELETE ok,
    user + anon blocked (403/401), edits/deletes stuck, public reads worked. Cleaned.
  · **Email verification (#493) — flag + endpoints live; happy-path flip pending the
    email key (same gate as reset).** On signup the platform auto-emails a signed 24h
    'confirm your email' link → the worker-hosted `/verify` page flips the user's
    `verified` 0→1 (idempotent, on-brand). Apps get a `verified` flag on the `user`
    object; they can gate features on it + offer a 'Resend' button → `POST /auth/
    verify-request` (Bearer or {email}, neutral response, already-verified sends
    nothing). Most apps can ignore it. **The actual email only sends once GO_FARTHER_
    API_KEY is set as a Worker secret** (still pending — SAME blocker as password
    reset; see the reminder below). Verified live: signup returns `verified:0`, /me
    shows 0, `/verify` with a bad/absent token renders the 'invalid/expired' page,
    verify-request returns neutral ok. The token→flip happy path goes live with the
    email key. Builder rules document the flag + resend.
  · **Why we hand-build these (owner asked 2026-07-20):** Supabase (which powers
    ISIBI's OWN backend) ships auth + a query API + storage pre-assembled — but a
    Supabase project is heavy + costs per-project, so it can't be "one backend per
    built app × thousands." The built sites run on Cloudflare (D1 + R2 + Worker),
    which is built for database-per-tenant (cheap, instant, ~unlimited) but gives
    RAW primitives — no batteries. So we build the convenience layer ONCE on CF and
    every built app inherits it. Batteries-included-but-heavy (Supabase, our app) vs
    raw-but-infinitely-cheap-to-multiply (Cloudflare, the built apps).
  · **Stats/Aggregations (#491) — dashboards computed server-side, VERIFIED live.**
    `GET /api/db/<slug>/rows/<table>/stats` → `{count}` + optional `sum`/`avg`/`min`/
    `max=<col>` (declared numeric cols, repeatable) + optional `group=<col>` for a
    per-value breakdown (`{groups:[{value:'paid',count:3,sum:{amount:600}},…]}`,
    sorted count-desc). Reuses the query layer's `where`/`q` (shared `buildD1Filter`)
    so you can stat a filtered slice. Read visibility mirrors the table: display/feed
    over ALL rows, `user` over the caller's OWN rows (login req'd), `collect` (write-
    only) exposes nothing. Agg + group cols validated against the table's schema;
    everything parameterized. BACKEND_RULES tells the builder to use it for dashboard
    cards/charts instead of pulling rows and reducing in JS. **Proof (zero AI/fal —
    seeded an `orders` display table directly): 16/16** — count=6, sum=875, min50/
    max300, avg≈145.83; group=status→paid(3,600)/pending(2,200)/refunded(1,75) sorted
    desc; `where=paid`→(3,600) and `where=amount>=150`→(3,650); safety: a bogus agg
    col is ignored (count still returned), a bad group col falls back to plain count,
    and a `);DROP TABLE` value left the table intact. Throwaway backend deleted.
  · **Search/Query (#490) — server-side filter/sort/paginate on the data API,
    VERIFIED live.** Before this, a list read returned newest-N and the built app
    had to fetch everything and filter in the browser — fine for a demo, useless for
    a real listings/directory/feed page. Now the `display`/`feed`/`user` list GETs
    (`/api/db/<slug>/rows/<table>`) accept: `where=<col>:<op>:<value>` (REPEATABLE,
    AND-ed; op = eq|ne|lt|lte|gt|gte|contains), `q=<text>` (free-text LIKE across the
    table's declared columns), `sort=<col>&order=asc|desc`, `limit`(≤200)+`offset`,
    and the response now also carries `{total}` (matched count, for pagination /
    "X results"). Columns are validated against the table's OWN schema and every
    value is parameterized (`buildD1List` helper) — no injection surface; `user`
    mode stays scoped to `owner_id`. BACKEND_RULES tells the builder to wire filter
    UIs (dropdowns, a search box, sliders) to re-fetch with these params.
    **Proof (zero AI/fal spend — provisioned a display table directly and hit the
    endpoint):** seeded 6 listings across 3 cities; 17/17 checks passed —
    `where=beds:gte:3`→3 rows, repeatable AND (`beds>=3 & price<=3M`)→2, `q=miami`→3,
    `sort=price asc`→ascending, `limit=2&offset=2`→clean pagination with `total:6`,
    and safety: a bad sort col falls back to `id` (no crash) and a `'; DROP TABLE'`
    value matched 0 rows with the table intact (parameterized). Throwaway backend
    deleted (0 left).
  · **Functions + Secrets (#486) — the big one, VERIFIED live end-to-end.** The
    runtime (`/api/site/fn`), webhook, scheduler, step interpreter, secrets vault +
    encryption already existed for static sites, and the runtime resolves via
    `site_functions` by slug (no published_sites coupling) → already React-ready.
    Added: secrets POST accepts React sites (ownership via sitesrc uid, stored
    published_site_id=null); build-time provisioning (`parseFunctionSpecs` pulls
    `isibi.functions.json`, `persistSiteFunctions` writes it — done event reports
    `functions:N`); a functions+secrets BACKEND_RULES section (fetch/email/checkout/
    respond steps, `{{secret.NAME}}` server-side); Secrets + Edge-functions Cloud
    cards go Live for React; delete wipes site_secrets + site_functions.
    **Proof:** Haiku-built "Northwind contact → Slack via webhook" app declared a
    real `send-slack-message` fn (fetch `{{secret.SLACK_WEBHOOK}}` + templated
    input), provisioned `functions:1`, published_site_id=null. Live: owner added the
    secret (listed by name only, value never returned) → fn ran {ok:true}. Then a
    deterministic echo fn PROVED server-side secret injection — a known secret value
    appeared in the outbound request to httpbin, never in the browser. Delete cleaned
    up fns+secrets (0 left). So React apps can now do 3rd-party integrations,
    payments (Stripe checkout step), and email — keys stay server-side.
  · **Files (#484):** the upload primitive (endpoint + R2 + `/u/<slug>/<file>`
    serving + owner file mgmt + delete-on-wipe) already existed for static sites;
    only blocker was `/api/site/upload` requiring a `published_sites` row React
    builds never create. Now it accepts an R2-published React build too. Added a
    FILES section to the React BACKEND_RULES (wire `<input type=file>` → upload →
    persist the returned URL in a row). VERIFIED live end-to-end (see Haiku note).
- **HAIKU builds are viable (2026-07-20, #483 added `{model:'haiku'}` to react-build).**
  Built "Rosterly — team directory w/ login + photo upload" on Haiku 4.5: compiled
  **first try** (no fix loop, `fixed:0`), phases generating→images→compiling→
  publishing→database, wired BOTH the D1 backend AND the new /api/site/upload, and
  `backend:true`. **Cost 7 credits vs ~31 on Sonnet — ~¼ the price.** Full live
  chain worked: signup → upload a PNG (served back 200 image/png) → create a
  `team_members` (user-mode: name/role/photo) row with the photo URL → read back,
  per-user isolated. So Haiku is a real option for a cheaper/faster "draft" build
  tier (default stays Sonnet). Metering is per-model (Haiku rates). Test data wiped.

- **🔴 BIG ONE — real end-to-end build bug (2026-07-20, #481), found by actually
  building.** Built "a task manager with login" via `/api/site/react-build`. The
  model generated a complete compiling app that calls `/api/db/<slug>/auth/*` +
  `/rows/tasks`, BUT never emitted `isibi.schema.json` → `backend=false`, no D1
  provisioned → the shipped app's login AND tasks both 404 "this site has no backend
  yet". Site loads 200 but its whole purpose is silently broken. Models omit the
  schema often enough that a prompt tweak alone isn't safe. **FIXED with a safety
  net:** after generation, if any file calls the backend API (`/auth/signup|login`
  or `/rows/<table>`) but no schema was declared, a targeted repair (`SCHEMA_REPAIR_
  RULES`) asks the model to emit JUST the schema — inferred from its own code — then
  provisions it before publish. Only fires when schema missing AND backend used
  (normal builds cost nothing extra). Also strengthened BACKEND_RULES (CRITICAL note).
  **Re-verified live end-to-end:** rebuilt same prompt → `backend=true`, phase order
  now ends `…publishing → database`; on the LIVE site signup works, task create+read
  works, and a second visitor sees an empty list (user-mode isolation intact).
  Two transient notes: (1) the FIRST attempt errored "generated project came out
  incomplete" (flaky/truncated gen — the "try again" message is correct; retry
  succeeded) — worth watching if it recurs often. (2) Auto-fix loop ran (fixing×1-2)
  and recovered both times. **FOLLOW-UP:** apply the same schema safety-net to
  `/api/site/react-revise` (a revise that adds login/data to an informational site),
  gated on "no backend exists yet" — not in #481.

- **Cloud panel was reading the OLD static-site store for React sites (2026-07-20).**
  A React site's More▸Cloud cards (Members/Submissions/Database/Secrets/Functions/
  Files) called the legacy Supabase endpoints, which resolve via a `published_sites`
  row that React builds NEVER create — so every card silently returned `[]` (200,
  not an error) even when the site had real data in D1. **FIXED (#472, owner chose
  "rewire to D1"):** for React sites w/ a backend, Members→D1 `_users`, Submissions→
  D1 `collect` tables, Database→opens the Data panel. Secrets/Functions/Files/Emails/
  Payments have no equivalent for a static React SPA (no server-exec surface) → shown
  as "Soon" instead of broken-empty. Legacy non-React sites keep the old panels.
  Verified: owner reads _users (email+joined, no hash leak) + collect tables (5/5).
  **NB legacy endpoints still live for old static sites**, untested this round:
  /api/site/{publish,preview,unpublish,analytics,auth/*,members,secrets,collections,
  data,functions,fn,upload,files,form,submissions} + /api/site/build-health.

- **Schema dedupe bug (2026-07-20, #474).** A schema with DUPLICATE column names,
  or one where the model declared id/created_at/owner_id itself (rules say not to,
  but models don't always comply), made `applySiteSchema` emit a CREATE TABLE with
  two same-named columns → D1 error 7500 → backend provision 502'd. react-build
  swallows that, so the site would ship with a silently-broken backend. **FIXED:**
  managed columns from the model are skipped (we always add our own) and duplicate
  names de-duped. Re-verified 7/7 (dup+managed OK, 2MB value OK, dup table names OK,
  30-table schema capped to 24).
- **Deep security audit (2026-07-20) — all AIRTIGHT:** the public data API cannot
  reach the internal tables — `/api/db/<slug>/rows/_meta` (holds the auth signing
  secret) / `_users` (password hashes) / `_ping` all 404 with NO leak, even with
  case tricks (`_USERS`, `_Meta`). Reserved SQL-keyword identifiers (a table named
  `order`, columns `select`/`group`/`default`/`where`) create/insert/read fine.
  Slug-squat blocked (owner B can't ensure/reschema owner A's slug). Token tampering
  (flipped payload OR signature) rejected; original still valid.
- **TWO OPEN DESIGN GAPS (flagged, not yet decided):** (1) **No per-user cap on
  `/api/site/backend/ensure`** — an authed user could loop it and provision unlimited
  D1 databases (account cap 50k) → resource-exhaustion vector. Needs a cap or rate
  limit (what number is the owner's call). (2) **D1 visitor auth has NO password
  reset** — `/api/db/<slug>/auth/` is signup/login/me only; a visitor who forgets
  their password on a built app is locked out forever. Any app with logins needs it.

Bugs found by testing this session: normalizeSchema (shape drift), the feed gap,
the misleading scoped-write response (#467), the schema-overwrite-on-revise (#468),
boolean columns not round-tripping (#470), the schema-dedupe crash (#474), and the
Cloud panel reading the wrong
store for React sites (#472). All fixed + live-verified. The backend's access
control (cross-user, cross-owner, cross-site, collect-read, injection) held up
clean. Test accounts/sites all deleted.

---

## How the owner likes things done

- Explanations in **plain English**, not jargon dumps. Walk things "layer by
  layer" when touring the code.
- Show UI changes as **screenshots** in chat (owner reviews visually).
- Small, surgical changes — don't restyle or refactor beyond what's asked.
- One thing at a time. Owner prefers reviewing/fixing bugs one-by-one over big batches.
- Ship flow: change → commit → open PR → squash-merge to `main` (auto-deploys).
- **Desktop-first, no mobile** (owner, 2026-07-16): "I'm not preparing my app
  to be mobile friendly honestly." Don't build or pitch mobile layout work
  unless the owner re-opens it.

---

## Parked (owner said hold — do not build until re-opened)

- **Home preset system (2026-07-12):** the 8-preset lineup (Blitz Motion +
  Bag Drop / Morning Ritual / Street Take / Perfect Loop / Retro Rewind /
  Shelf Wars / Week One) is ON HOLD per the owner — "forget about them for
  now." Keep the assets: Blitz Motion has an owner-approved sample prompt
  (Tropical Elixir style, 12s 9:16, @image_1 product reference, 10-cut
  choreography, ends on readable-label packshot) and a model pick
  (Seedance 2.0 · 12s · 9:16 · 1080p). Presets = director instruction
  templates (fixed choreography skeleton + product description/world filled
  from the attached image). Home cards stay display-only (PR #349) meanwhile.

- **Voice/audio lane on the landing filmstrip (built + REMOVED twice, 2026-07-13):**
  a third drifting row of playable waveform tiles under the two image/video rows
  on the "Made with isibi" strip. Round 1: compact (186×76) → owner "came out
  very ugly, delete that" → reverted. Round 2: re-added bigger (300×118),
  merged, then owner said "wrong chat, delete the voice thing" → reverted off
  `main` again. **Not a design rejection the 2nd time — it was merged to the
  wrong project/chat.** Fully off `main`. If it's genuinely wanted here later,
  confirm scope with the owner first; the bigger 300×118 version is what they'd
  approved visually.

- **Declined (2026-07-12):** Luma **Reframe** (video + Photon image outpaint-to-new-ratio,
  on fal) — offered, owner said no. Don't re-pitch unless they bring it up.
  Runway integration also discussed: not on fal (needs its own API pipeline) — neither
  added nor declined, just informed.

## Direction (2026-07-12): AI-native, Studio retired

- **Vision:** the whole platform is "talk to isibi, it makes/edits." Everything
  is chatbox-driven. Studio (the traditional iMovie editor) was the odd one out.
- **Studio DROPPED (owner: "drop the studio and the video editor thing", chose
  "pure AI, drop it all"):** removed the Studio view, sidebar nav, Studio-only
  topbar/dropdown, all `sb-*`/`studio-*` handlers, and deleted `public/studio.js`
  (~3.4k lines: shot planning, timeline, manual tools, film stitching, free
  on-device trims). **KEPT `public/ffmpeg-edit.js`** — the QR burn depends on it
  (its `sbFF*` helpers). Dead studio CSS in styles.css left in place (harmless;
  sweep later if desired).
- **AI video editing wired into the Builder (done 2026-07-12).** The pattern:
  attach a Video clip to an editing model → the worker routes to that model's
  edit endpoint (`bareEdit` flag suppresses duration/ratio/resolution for the
  prompt+video-only endpoints). Wired + fal-verified endpoints:
  - **Gemini Omni Flash** → `google/gemini-omni-flash/edit` (prompt + video_url;
    conversational swap/relight/stabilize/bg). Regional note: fal blocks editing
    uploaded videos for EEA/Switzerland/UK users.
  - **Kling o3 Pro** → `.../o3/pro/video-to-video/edit` (prompt + video_url +
    optional style `image_urls` ≤4 + keep_audio; elements/shot_type not exposed).
  - **Veo 3.1** → `fal-ai/veo3.1/extend-video` (prompt + video_url; continue/lengthen).
  - **Ray 3.2** video-to-video + **Kling LipSync** already worked.
  Each got `caps.clip:true` + an EDIT/EXTEND tag in the picker. Pricing reuses
  the model's existing per-second rate (edit endpoints belong to models already
  in VIDEO_USD) — PROVISIONAL, verify on the fal sweep. Not-in-roster editors
  still available if wanted: Happy Horse 1.0, Kling o1, VOID (object removal).

## 2026-07-20 — React builder: the "code -1 / code 400" wall = Anthropic account out of API credits (NOT a code bug)

The first live React build (`/api/site/react-build`) kept failing in ~2s with a
generic 400. Surfaced the real upstream `detail` via a temporary version marker:

> "Your credit balance is too low to access the Anthropic API. Please go to
> Plans & Billing to upgrade or purchase credits." (request_id req_011CdD…)

**Root cause:** the Anthropic account behind the app's `ANTHROPIC_API_KEY` is out
of API credits. Nothing wrong with the request shape (model `claude-sonnet-5`,
max_tokens 16000, system+messages — all valid; 128K output cap, no beta header
needed). This is an **account-billing** blocker, not code.

**Impact:** every Claude-Sonnet-5 feature on the same key is down until topped up
— the React builder, the classic Sonnet builder (`/api/site`), the AI Orchestrator
(`/api/direct`), and the security scan. (Generation of images/video via fal is on a
separate provider/balance and is unaffected.)

**Owner action needed:** top up API credits at console.anthropic.com → Plans &
Billing (this is the *Anthropic API* balance, separate from any Claude.ai
subscription). Once funded, the React build test can complete immediately.

**Code cleanup shipped (PRs #436→#437):** the react-build gen-error path now logs
the real upstream reason server-side (`console.error`) and returns a generic
"builder is busy — try again" to the client (no provider/billing text leaked).

Test hygiene: throwaway account (166c40d9…, rb-…@example.com, 500 test credits via
SQL — never touched the real ✦ balance) fully deleted after the diagnosis.

---

## In progress — awaiting owner sign-off (NOT merged to main)

### Website builder — real EDGE FUNCTIONS (Path A, 2026-07-18)
- **Status:** ✅ SHIPPED to main + deployed + live-tested 2026-07-18 (owner said
  "deploy and run test"). Every property verified on production (results below).
- **The decision (why Path A):** the owner wanted the model to build "edge
  functions" like Lovable (describe backend logic in chat → model builds it →
  appears in the Cloud panel → runs live). Walked the owner through the real
  fork: the moment the model writes *arbitrary code*, something has to RUN it,
  and it can't be our Worker (would run with our service key + all-user data).
  Three paths — **A: declared function-specs on the shared backend we already
  own** (≈$0, no per-site infra, nothing to sandbox); **B: a Supabase project
  per site** (true Lovable parity but a compute cost *per published site*, worst
  shape for a product with lots of free sites); **C: Cloudflare Workers for
  Platforms** (multi-tenant, cheap-at-rest, but a ~$25/mo enterprise add-on).
  Owner picked **A** ("do the shared") — and it's not throwaway: the spec layer
  + Cloud UI are exactly what B/C would sit behind later, so a single site can
  graduate to its own house when a paying customer actually needs arbitrary code.
  Scoping brief artifact: https://claude.ai/code/artifact/cf61e9f8-ffdc-4a9e-96f1-0fb1e0db02b9
- **How it works:** the model emits a bounded **function SPEC** (a trigger→steps
  recipe), never code. The generator declares one as
  `<script type="application/isibi-fn" data-name="X">{"steps":[…]}</script>` in
  <head> and calls it from the site JS via `POST /api/site/fn {slug,fn,input}`.
  The Worker interprets the spec against primitives we already own. Actions:
  **read** (a public collection), **save** (to a collection), **fetch** (an
  external HTTPS API, SSRF-guarded via the existing `safeFetch`), **respond**
  (JSON back to the browser). Templating: `{{input.x}}`, `{{steps.<as>.<path>}}`,
  and `{{secret.NAME}}`. **Secret isolation is the safety core:** `{{secret.*}}`
  resolves ONLY inside a fetch request (server-side) — in respond/save it
  collapses to "", so a plaintext key can never be echoed to a visitor or written
  to a public collection (verified with a hostile-respond test). Hard bounds:
  ≤8 steps, ≤2 fetch/run, 8s per network op, 32 KB response reads, plus a
  per-slug in-isolate rate limit. No credit charge (bounded, like /api/site/form).
- **Where:**
  - `worker.js`: `decryptSecret`, the interpreter (`runSiteFunction` +
    `normalizeFnSpec`/`extractSiteFunctions`/`resolveStr`/`loadSiteSecrets`/
    `persistSiteFunctions`/`fnRateOk`), endpoints `POST /api/site/fn` (public
    runtime) + `GET/DELETE /api/site/functions` (owner). Build/revise extract +
    persist declared blocks and STRIP them from the hosted HTML (spec never
    ships publicly). SITE_RULES gained the EDGE FUNCTIONS protocol (+never-fake).
  - `public/chat.js` + `styles.css`: Cloud → **Edge functions** card is live;
    `siteFunctions()` modal lists each function's trigger + step-flow, with delete.
  - Supabase: `site_functions` table (owner-scoped RLS, mirrors `site_secrets`).
    **Also patched `delete_account()`** to clear every `site_*` owner table
    (secrets/collections/functions/submissions/domains/visitor accounts) — those
    were ALL orphaning on account deletion before (pre-existing gap; CLAUDE.md
    says deletion is a full wipe). `published_sites` + `site_hits` + the R2 site
    files are still NOT wiped on deletion — separate follow-up (R2 can't be
    reached from Postgres; needs a Worker/client purge).
- **Live test (2026-07-18, all pass, throwaway data cleaned up after):**
  respond+input templating ✓ · save→read→count (records landed, count flows) ✓ ·
  external fetch from the deployed Worker (GitHub zen, 200) ✓ · **SSRF block** —
  a fetch at the cloud-metadata IP (169.254.169.254) returns status 0 / empty,
  safeFetch refused it ✓ · unknown fn → 404 ✓ · **secret injection** — a real
  vault secret decrypts on the Worker and lands in the outbound header the echo
  service reflects ✓ · **secret isolation** — the same secret returned BLANK when
  a function tried to leak it via respond ✓ · **encrypted at rest**
  (`leaks_plaintext:false`) ✓. Local: 16/16 logic tests + encrypt/decrypt
  round-trip ✓. (Test note: `site_collections.owner_id` has an FK to auth.users,
  so a save only works under a real owner — always true for real functions.)
- **Known v1.1 nits (not blocking):**
  1. Template paths don't span hyphens — `{{steps.h.body.headers.x-secret}}`
     won't resolve a hyphenated JSON key (regex is `[a-zA-Z0-9_.]`). Rare (most
     API fields are snake/camelCase); widen the charset to include `-` when we
     next touch it. Everything non-hyphenated resolves fine.
  2. No pause/enable toggle in the panel yet (delete works; `enabled` flips only
     in the DB). Add a toggle if wanted.
  3. `email` action deliberately not shipped — decide the abuse posture first.
- **Still NOT wiped on account deletion (follow-up):** `published_sites` +
  `site_hits` + the R2 site files. R2 can't be reached from Postgres, so it needs
  a Worker/client purge on delete. The site_* owner tables ARE now wiped.

### Website builder — DETECT & FIX errors (2026-07-18)
- **Status:** ✅ shipped to main + deployed. The Lovable feature the owner
  singled out (image 9: "app detects errors, click fix, it fixes").
- **What:** the live preview now watches the built site for REAL runtime bugs —
  uncaught JS errors + unhandled promise rejections — via an error shim injected
  into the preview blob (`sitePreviewSrc`, preview-ONLY; published pages never
  carry it). The shim `postMessage`s each error to the workspace, which shows a
  red "N issues detected · Fix with AI · ×" chip at the bottom-left of the
  preview. One click sends the exact error messages through the normal revise
  flow ("find the root cause and fix it, changing as little else as possible"),
  so it snapshots history + swaps the page like any edit. Errors reset on every
  page (re)load; the badge repaints in place (never re-renders the iframe, which
  would re-trigger). Charge = a normal revise.
- **Where:** `public/chat.js` (`sitePreviewErrs`/`collectPreviewErr`/
  `paintPreviewErrBadge`, the errShim in `sitePreviewSrc`, the message listener,
  the `#stFixBar` markup + handlers), `public/styles.css` (`.st-fixbar`).
- **Low false-positive by design:** generated sites load no external scripts
  (SITE_RULES bans CDN JS) and maps are nested iframes (their errors don't bubble
  to the preview's onerror), so essentially every caught error is a real bug in
  the site's own inline JS. Verified end-to-end headless: a page calling an
  undefined function on load → error caught through the sandboxed cross-origin
  iframe → badge appears "1 issue detected".
- **Distinct from `siteErr`:** that card is for a GENERATION failure (the build
  call itself broke). This chip is for a successfully-built page that misbehaves.
- **Blank-preview follow-up (2026-07-18, owner hit it live):** owner built a
  real-estate site; the **thumbnail rendered fine but the workspace preview was
  black**. Root cause: the card thumbnail uses `srcdoc sandbox=""` (scripts OFF)
  so it shows the raw HTML; the main preview runs scripts, and the site's own JS
  hid all content on load (scroll-reveal) then broke → black. Two fixes shipped:
  (1) **generator never-blank rule** in SITE_RULES — content MUST render with CSS
  alone, JS enhancement only, animations degrade to visible, try/catch around
  risky JS (fixes NEW builds). (2) **blank-detection in the preview shim** — after
  load it checks whether anything is actually visible in the viewport (via
  `Element.checkVisibility({opacityProperty})`, which sees through ancestor
  opacity); if the DOM has content but nothing shows, it reports a synthetic
  "page renders blank" so the Fix chip appears even when no error was thrown.
  Verified headless: fires on wrapper-hidden pages + throws; no false positives
  on healthy or dark-hero designs. Existing sites built before this need a
  refresh + Fix chip (or a revise) since the rule only governs new builds.

### Website builder — function TRIGGERS: webhook + scheduled (2026-07-18)
- **Status:** ✅ shipped to main + deployed + live-tested. Owner picked this from
  the "more technical, like edge functions" backlog.
- **What:** edge functions gained two triggers beyond the site's own JS calling
  `/api/site/fn`:
  1. **Webhook** — `POST https://isibi.ai/api/site/hook/<slug>/<name>`; the
     ENTIRE POST body becomes the function's `input` (so Stripe/Zapier/etc. post
     their native payload). Shares the load+run path with `/api/site/fn`
     (`invokeSiteFunctionByName`). Same bounds + per-slug rate limit. The Cloud →
     Edge functions panel shows each function's copyable webhook URL.
  2. **Scheduled** — spec `"schedule":{"everyMinutes":N}` (clamped 5…43200). Runs
     on the EXISTING 2-min cron (`scheduled()` → `runScheduledSiteFunctions`),
     input `{scheduled:true}`. `schedule_minutes` + `last_run` columns on
     site_functions; last_run is stamped BEFORE running so a slow job can't
     double-fire; a 30s grace keeps a 2-min tick from skipping an hourly job.
     Panel shows an amber Hourly/Daily/Every-Nm badge.
- **Where:** worker.js (`invokeSiteFunctionByName`, `runScheduledSiteFunctions`,
  the `/api/site/hook/` route, `scheduled()` hook, normalizeFnSpec schedule
  parse, persist writes schedule_minutes, functions GET returns it, SITE_RULES
  TRIGGERS paragraph), chat.js/styles.css (`fn-sch` badge + `fn-hook` URL row +
  copy). Migration `site_functions_scheduling`.
- **Live test (throwaway data, cleaned up):** webhook — POSTed
  `{event:"payment.succeeded",data:{amount:4999}}` → function got it, nested
  `{{input.data.amount}}` resolved to 4999 ✓; unknown fn → 404 ✓. Scheduled —
  a 5-min function fired on the real cron (`cron_runs:1`, `last_run` stamped),
  did not double-fire ✓.
- **Next backlog (owner's picks):** FILE UPLOADS (visitor uploads → R2 →
  collection URL) is the next build. Queryable DB was DECLINED for now — the
  model does client-side filter/sort/search in the site's own JS for typical
  sites (<100 records); only build server-side query if a collection outgrows
  the 100-record fetch cap.

### Website builder — FILE UPLOADS (2026-07-18)
- **Status:** ✅ shipped to main + deployed + live-tested. Owner's 2nd pick.
- **What:** published sites can accept visitor uploads (listing photo, avatar,
  resume). `POST /api/site/upload` (public, fail-soft) takes a base64 data URL →
  mime-allowlisted to images (PNG/JPG/WebP/GIF) + PDF (NO svg/html, so no
  stored-XSS), ≤6 MB, per-slug count cap (300), only for a real site → stored in
  R2 under `uploads/<slug>/` → returns a permanent URL served from
  `/u/<slug>/<file>` (nosniff, content-disposition inline, immutable cache).
  The site saves that URL into a collection to keep it. SITE_RULES has the upload
  protocol (file input → FileReader data URL → POST → persist res.url).
- **Where:** worker.js (`/api/site/upload` POST+OPTIONS, the `/u/<slug>/<file>`
  R2 serve route, SITE_RULES FILE UPLOADS paragraph). No new table (R2 only).
- **Live test (throwaway site, DB row cleaned):** upload a 1×1 PNG → permanent
  URL ✓; served back = 70 bytes, `content-type: image/png`, nosniff, valid PNG
  ✓; HTML-masquerade data URL → 415 ✓; bogus slug (no site) → "not live yet" ✓.
  (One 70-byte test PNG remains in R2 — wrangler isn't authed in the session to
  delete it; immaterial.)
- **v1.1 gap — CLOSED 2026-07-18:** built FILE MANAGEMENT (Cloud → Files).
  `GET/DELETE /api/site/files` (owner auth; ownership proven by reading the site's
  owner-only published_sites row under the caller's JWT) list R2 objects under
  `uploads/<slug>/` and delete one. `siteFiles()` grid modal — image thumbnails /
  PDF chip, size, delete. Live-tested end-to-end (upload → owner lists it → delete
  → gone → unauth = 401), throwaway user + the R2 object both cleaned up.

### Website builder — QUERYABLE DATABASE (2026-07-18)
- **Status:** ✅ shipped to main + deployed + live-tested. (Earlier I'd said the
  model could do client-side filtering; owner asked to build the server side, so
  now both are possible — server query is better for real datasets + paging.)
- **What:** `GET /api/site/data` now filters/sorts/searches/paginates. Done
  SAFELY in the Worker: when any query param is present it pulls the whole
  collection (≤500 storage cap) and queries in-memory — no raw query is ever
  exposed to a visitor, so there's no injection surface. Params:
  `where=<field>:<op>:<value>` (REPEATABLE; op eq|ne|lt|lte|gt|gte|contains|in;
  numeric ops compare as numbers), `q=<free text>` (across string fields),
  `sort=<field>&order=asc|desc`, `limit`(≤100)+`offset`. Response gains `{total}`
  (matched count) beside `{records}`. Plain "latest N" (no params) stays on the
  original cheap path, and the wrapped `{data,created_at}` row shape is
  unchanged, so existing sites keep working. SITE_RULES tells the generator to
  query on the server for anything beyond a short list (build filter UIs that
  re-fetch with params, not fetch-all-then-filter).
- **Where:** worker.js (`applySiteQuery` helper + the `/api/site/data` GET branch
  + SITE_RULES QUERY paragraph). No schema change.
- **Tested:** 12/12 unit tests (multi-clause filter, numeric range, in/contains,
  free-text, sort asc/desc incl. string, pagination, injection-ish value → safe
  no-match). Live on real listings: Miami under $2M → 1 result; beds≥3 sorted by
  price; search "villa"; price desc; page (limit2/offset2) with total. Throwaway
  records cleaned up. (Note: right after each deploy, Cloudflare edge nodes update
  unevenly for ~30-60s, so a query can briefly hit old code — settles quickly.)
- **Ceiling:** in-Worker query covers up to the 500-record collection cap. Past
  that we'd move to real SQL-side filtering; not needed until a collection is
  genuinely that large.

### Website builder — ATTACH IMAGES to the builder (2026-07-18)
- **Status:** ✅ shipped to main + deployed. UI + routing verified; the full
  build path (host → vision → embed) NOT live-tested yet (a real build spends the
  owner's credits — offered to run one on request).
- **What:** the builder composer (BOTH the home "What are we building" box and the
  workspace revise box) can attach up to 3 images (≤5 MB, png/jpg/webp/gif). On
  build/revise they ride in `body.images` (base64 data URLs). The engine, for each:
  (1) hosts it in R2 under `assets/<siteId>/` → a public URL served from
  `/a/<siteId>/<file>` (nosniff, immutable), and (2) passes it to **Gemini's
  vision** (inlineData). A dynamic `assetLine` tells the generator: if it's a
  LOGO/product photo → embed a real `<img src="<hosted url>">`; if it's a design
  REFERENCE → match palette/layout but don't embed; decide from the brief. Vision
  goes to the PLAN phase (build) + the revise call; the hosted URLs fold into the
  design system so every page can use the logo. Image input tokens are already
  captured by the metered billing (usageMetadata) — no separate charge logic.
- **Where:** worker.js (`/a/` serve route, `geminiCall` 4th `imgParts` arg, the
  image-prep block that hosts + builds imageParts/assetLine, plan + page + revise
  calls updated), chat.js (`siteAttach` state + `siteAttachOpen`/`siteAttachFiles`/
  `paintAttachStrip`, attach button in both composers, `images` in siteSend, new
  `image` icon), styles.css (`.st-attach`/`.st-att`/`.st-attbtn`). The attach strip
  repaints in place (no full re-render) so the prompt text isn't lost on attach.
- **Verified:** `/a/<siteId>/<file>` route live (404s cleanly for a missing asset);
  UI screenshot approved. TODO on next real build: confirm a logo actually embeds
  and a reference actually shifts the design.
- **Next picks (owner):** FILE MANAGEMENT (list+delete uploads) then PAYMENTS.

### Website builder — PAYMENTS (Stripe, owner's own key) (2026-07-18)
- **Status:** ✅ shipped to main + deployed. Security gate live-tested; the actual
  Stripe checkout call needs a real Stripe key to fully exercise (owner adds
  theirs) — offered.
- **Model:** each SITE OWNER uses their OWN Stripe account (no Connect, no platform
  fee, no onboarding) — they paste their Stripe secret key into Cloud → Secrets as
  STRIPE_KEY. Built on the functions/secrets/webhooks stack.
- **What:**
  1. **checkout action** — a new function step `{do:"checkout", secret:"STRIPE_KEY",
     amount:<cents>, currency, name, quantity, mode:"payment"|"subscription",
     interval, success_url, cancel_url, as}` creates a real Stripe Checkout
     Session (form-POST to api.stripe.com). The key goes ONLY to Stripe; only the
     returned {url,id} is captured. Buy button calls the fn via /api/site/fn and
     redirects to the url. amount/urls support templating.
  2. **Signature-verified order webhooks** — a function with `"verify":"stripe"`
     at the top of its spec only runs when the `Stripe-Signature` header HMACs
     (SHA-256, 5-min replay window) against the site's STRIPE_WEBHOOK_SECRET. The
     hook route now reads the RAW body for verification. A forged/tampered/unsigned
     event is 400'd and never runs → can't record a fake paid order. Owner pastes
     the fn's webhook URL into Stripe (checkout.session.completed only) + adds the
     signing secret as STRIPE_WEBHOOK_SECRET.
- **Where:** worker.js (`hmacSha256Hex`/`ctEqHex`/`verifyStripeSig`, `checkout`
  action in runSiteFunction + normalizeFnSpec + `verify` field, hook route raw-body
  + verification, SITE_RULES PAYMENTS paragraph). No schema change (reuses
  site_functions + site_secrets + site_collections).
- **Tested:** 7/7 unit (valid/wrong-secret/tampered/replay/malformed sig) + live:
  no-sig webhook → 400, valid-sig → runs+saves order, tampered-body+same-sig →
  400, checkout-without-key → refuses (empty url, no Stripe call). Throwaway
  user/site/secret/functions all cleaned up.
- **Not yet:** a live end-to-end paid checkout (needs a real Stripe test key).
- **Payments setup card — DONE 2026-07-18:** Cloud → Payments card (credit-card
  icon) opens `sitePayments()`, a 3-step guide (Stripe key in Secrets → ask the
  builder for a Buy button → optional signature-verified order webhook). Mirrors
  the Emails guide. With this, EVERY Cloud card is now Live (no "Soon" left):
  Members · Submissions · Database · Emails · Secrets · Edge functions · Payments
  · Files.

### Website builder — EMAIL (owner's own provider) (2026-07-18)
- **Status:** ✅ shipped to main + deployed. Guard live-tested; a real send needs
  the owner's provider key. Owner asked for this ("so user can bring their email")
  — same bring-your-own-key model as payments.
- **What:** new `email` function action sends through the SITE OWNER's OWN email
  provider — **Resend** (default), **SendGrid**, or **Postmark** — using their key
  from the vault (e.g. RESEND_KEY). Correct per-provider request shape (Resend
  {from,to,subject,html}; SendGrid personalizations/content; Postmark
  From/To/Subject/HtmlBody). Key + recipients go ONLY to the provider; only
  {ok,status} is captured. Guards cleanly when unconfigured (no key/from/to →
  error, no send). from/to/subject/html support {{templates}}.
- **Where:** worker.js (`email` action in runSiteFunction + normalizeFnSpec +
  FN_ACTIONS, SITE_RULES EMAIL paragraph — welcome/notify/receipt patterns, and
  "wire a contact form to a FUNCTION to email the owner"). chat.js/styles.css:
  the **Emails** Cloud card flipped from Soon → live, opens `siteEmails()` — a
  2-step setup guide (add provider key in Secrets → ask the builder).
- **Tested:** unconfigured email step → "email not configured" error, no send ✓
  (live, throwaway function cleaned up). Provider payload shapes match each API's
  docs. A real send is one provider key away.
- **Note:** this is the SITE's transactional email (owner's provider). It's
  SEPARATE from isibi's own auth emails (Go Farther via the send-email Edge
  Function) — those are unchanged. (Visitor-auth password reset now DOES ride on
  this same owner-provider email — see the next section.)

### Website builder — VISITOR PASSWORD RESET (2026-07-19)
- **Status:** ✅ shipped to main + deployed. Owner asked for "Visitor password
  reset." Builds on the visitor-auth backend (site_users) + the owner-provider
  email above — a site's visitors can now reset a forgotten password by email.
- **What:** two new backend endpoints (bring-your-own-email; no platform sender):
  - `POST /api/site/auth/reset-request` `{slug,email}` — **ALWAYS returns
    `{ok:true}`** (no account-enumeration: a caller can't tell if the email
    exists). If it does, it mints a **single-use, 45-min HMAC token** bound to the
    current password hash (`pv = sha256(password_hash).slice(0,16)`, `purpose:
    "reset"`) and emails a link `https://isibi.ai/s/<slug>/reset?token=…` through
    the **site owner's own** provider (`sendSiteEmailByConvention` → EMAIL_FROM +
    RESEND/SENDGRID/POSTMARK key from the vault). Sent via `ctx.waitUntil` so the
    response is instant. No email configured → request still succeeds silently,
    nothing sent (bring-your-own, no fallback). Honeypot + body-size guarded.
  - `POST /api/site/auth/reset` `{token,password}` — verifies the token
    (purpose+expiry+signature), re-reads the user, and checks the token's `pv`
    still equals the CURRENT hash → **single-use** (a used or superseded link is
    dead). Sets the new hash (PBKDF2, min 8 chars) and returns a **fresh session
    token** so the visitor lands logged-in.
- **Email helper refactor:** pulled provider-send out of the `email` function
  action into a shared `postProviderEmail(provider,key,from,to,subject,html)` →
  `{ok,status}`; the action and reset both call it. `sendSiteEmailByConvention`
  picks the provider from whichever key is in the vault.
- **SITE_RULES:** new PASSWORD RESET paragraph teaches the generator to build (1) a
  forgot-password form → `/api/site/auth/reset-request`, always showing the SAME
  neutral "if that email has an account we sent a link" (no user-exists leak), and
  (2) a real page at path **`/reset`** that reads `?token=` and POSTs to
  `/api/site/auth/reset`, storing the returned session on success. Tells the user
  they MUST set EMAIL_FROM + a provider key in Secrets or no link is sent.
- **Serving:** `/s/<slug>/reset` resolves to the generated `reset.html` in R2;
  the `?token=` query survives (pathname-only routing) and is read client-side.
- **No new schema** (reuses site_users + site_secrets). No owner-facing UI change —
  the Emails/Secrets cards already cover the one setup step (add email creds).

## 2026-07-19 — Builder: conversational gate (chat vs build)
Owner: typing "hey" as the first message kicked off a full ~200-credit build; it
"should be a bit conversational too." Root cause: the builder treated EVERY first
message as a build (isBuild = no pages yet), no chat notion.
- **Fix:** a cheap intent classify runs at the top of /api/site (build + revise).
  Greeting / thanks / small talk / question / too-vague → returns
  `{chat:"<warm 1-2 sentence reply>"}` (no build, ~1 credit). Biased hard toward
  acting so any real brief or concrete change still builds/edits. Client shows
  `d.chat` as an assistant message, no site change.
- **Live-verified** (throwaway acct, deleted): "hey" → "Hey there! What kind of
  site are we making today—maybe a landing page for a cozy coffee shop?" (1
  credit, no build); "can you make online stores?" → "Yes, absolutely! What kind
  of products…" (1 credit). Real briefs still build (bias + the earlier full
  build verification). Note: first hit timed out on edge-propagation lag, fine
  after.

## 2026-07-19 — LIVE VERIFICATION of the new builder pipeline ✅
Owner OK'd the spend. Ran a real build + edit on a throwaway account (800 credits
set, fully deleted after via delete_account — which also re-verified that wipe).
- **Build:** "modern real estate agency like Zillow" → 4 pages (Home, Properties,
  Sell Your Home, Find an Agent), **209 credits, ~3 min**. Results:
  - **Brand consistent:** "Veridian Estates" on all 4 pages, ZERO "isibi" leak.
  - **Composed chrome CONFIRMED:** header + footer BYTE-IDENTICAL across all 4
    pages (string-diff), same wordmark, nav links all resolve to the 4 real paths.
    Verified visually too — Home + Listings share the exact same header.
  - **Favicon + OG meta** present on all 4 pages.
  - **On-subject images CONFIRMED:** downloaded a generated image → a stunning
    on-brief luxury concrete-glass ocean-view home (NOT an astronaut). The image
    fix works. Listings grid = static cards; past the image budget they degrade to
    tasteful gradients (safe fallback), not broken/reused images.
  - Design quality is genuinely upscale (editorial serif hero "Where Space Becomes
    Art", real copy, filter bars) — not AI-slop.
- **Surgical edit CONFIRMED:** "change hero to 'Find Your Forever Home' + make the
  Browse Portfolio button forest green" → **5 credits, 6.8 sec** (vs 209/3min for a
  build). Char-diff showed EXACTLY 2 changed regions: the headline text and the
  button's `background-color:#22543d`. Everything else byte-identical. Rendered:
  new headline + green button, all else intact. This is the reliability headline.
- **Known tradeoff surfaced:** SITE_MAX_IMAGES is small relative to a listings-heavy
  site (Properties grid got 2 real photos + 7 gradient fallbacks). Consistent + safe,
  but image-light. Owner may want to raise the image budget (costs more) for
  gallery/listing sites.
- Net: surgical edits, validate/auto-fix, composed shared-chrome, brand pin,
  on-subject images, favicon/OG, retry, no-op — all confirmed working on a real
  build. The pipeline is no longer just unit-tested; it's observed end-to-end.

## 2026-07-19 — Builder: polish + no-op edits + Stop button
- **Favicon + social meta (guaranteed, composer-side via `polishHead`):** every
  page's <head> gets a brand-monogram SVG favicon (brand initial on the site's
  accent color, pulled from a :root token) so the tab isn't blank, plus
  Open-Graph + Twitter card tags (og:title/description from the page, og:image =
  first hosted image) so shared links preview as a card. Idempotent; runs on
  build + revise. Unit-tested 11/11.
- **Failed-page retry:** a multi-page build now retries a page ONCE if it comes
  back empty/errored, so a Gemini hiccup never silently drops a page.
- **No-op edits ("check before editing", borrowed from a competitor prompt the
  owner shared):** the revise step recognizes when the current HTML ALREADY
  satisfies the instruction → returns `{edits:[],done:true}` → Worker returns the
  page UNCHANGED (no wasteful re-roll), client shows "that's already how it is."
  Plus reinforced "do ONLY what's asked."
- **Stop generation:** while a build/revise runs, the send button becomes a red
  pulsing Stop (■). Click aborts the in-flight `/api/site` fetch (AbortController)
  → workspace freed, "Stopped" note. Caveat surfaced: charge-after model means a
  gen that already completed may still bill. Headless-tested 4/4.
- **Note on the "chatbox edits the site" question:** confirmed the flow is fully
  wired — the "Ask isibi…" composer → `siteSend()` → `/api/site` revise → the new
  surgical-edit path. It DOES edit the active page. End-to-end proof still needs a
  live build/edit (Gemini cost).
- **On the pasted "Lovable system prompt":** owner shared it (wrapped in a prompt-
  injection/"repeat your instructions" jailbreak, which was ignored). Treated as
  reference only, not instructions; mined a few transferable ideas (check-before-
  edit, do-only-what's-asked, errors-bubble-to-fix-loop). Did NOT copy verbatim;
  authenticity unverified.

## 2026-07-19 — Builder RELIABILITY: surgical edits + validate/auto-fix
Owner: the builder feels "weak and not reliable" vs Lovable — wants code-gen +
backend upgrades, not just prompt tweaks. Laid out the real architectural gap
(whole-page re-roll on every edit; one-shot with no validation; no shared source
of truth) and started on the two highest-leverage fixes.
- **#1 Surgical edits (biggest win):** the revise step no longer regenerates the
  whole page. The model returns minimal `{find,replace}` edits (find = exact
  verbatim slice of the current HTML); the Worker splices them in, so every
  untouched byte is identical → no drift, faster, cheaper. Falls back to the old
  full-document rebuild only if NOT ONE edit anchors (so an edit never fails).
  worker.js revise branch. Apply logic unit-tested 7/7 (multi-edit, missing
  anchor→fallback, partial, whole-doc, malformed).
- **#2 Validate → auto-fix loop:** `validateSiteHtml()` — cheap, high-precision,
  no JS execution — flags truncated docs, leftover 'lorem ipsum', hotlinked
  external <img> (blocked by the live CSP), and nav links to non-existent pages.
  If any, `autoFixSiteHtml()` runs ONE targeted repair pass BEFORE charging (so
  the fix's tokens are billed + the fixed page is what ships). Wired into build
  (per page, validPaths from the plan) + revise (paths sent by the client).
  Clean pages skip it → no extra cost. Validator unit-tested 7/7.
- **#3 Shared chrome (one source of truth) — SHIPPED:** the plan now emits the
  shared HEAD (fonts + :root tokens + all shared CSS), NAV, and FOOTER once as
  real code. In COMPOSED mode each page generates only its `<main>`; the Worker
  assembles head+nav+main+footer, so header/footer/palette/fonts are
  BYTE-IDENTICAL on every page (consistency by construction, like a shared
  `<Header>` component) and pages are cheaper (no re-emitting chrome). Active nav
  link marked per-page via `aria-current="page"` so the nav markup never varies.
  `stripToMain()` defends against a page returning a stray full doc. Falls back to
  full-page generation if the plan doesn't yield a usable kit. DESIGN_BAR split
  into DESIGN_DIRECTOR (aesthetics) + SITE_RULES so composed pages skip the
  single-document mandate. Composition unit-tested 9/9 (head/footer identical,
  nav identical minus active marker, fragment + stray-full-doc extraction).
- **Still on the roadmap:** #4 stronger model / two-pass (engine is Gemini Flash);
  #5 typed per-site DB tables.
- **All three (surgical + validate + shared-chrome) are DEPLOYED but the
  AI-dependent behavior is NOT yet observed on a live build** — deterministic
  logic is unit-tested; a real build/edit (Gemini + fal cost) is needed to confirm
  the model produces a good kit + main fragments + edit patches end-to-end.
- **Verification pending:** end-to-end needs a real build/revise (Gemini + fal =
  real API cost). Deterministic logic is unit-tested; a live rebuild will confirm
  the whole new pipeline (brand pin + surgical + validate + image rules).

## 2026-07-19 — Builder: collapsible chat rail + cross-page consistency
Owner flagged three things on the real-estate site: (1) the chatbox should be
hideable; (2) design is inconsistent — logo/brand name changes per page
("Vanguard & Co." on Home, "Aura Est." on Listings, even "isibi" on Sell); (3)
off-topic images (astronauts on property cards).
- **Collapsible chat rail (frontend):** topbar toggle (panel icon) hides/shows
  `.st-rail` via a CSS class on `.st-ws` — NO re-render, so the preview iframe
  never reloads and a half-typed message survives. `siteRailHidden` state,
  `.st-ws.st-rail-hidden .st-rail{display:none}`, stage takes full width.
  Headless-tested 5/5 + screenshot.
- **Brand drift + "isibi" leak (worker prompts):** root cause — the plan defined
  art direction but never pinned a fixed brand NAME, so each page (generated in
  parallel) invented its own; and the page/revise prompts literally said "You are
  isibi Websites", which leaked "isibi" as the site's logo. Fix: plan now returns
  a `brand` field (exact name, never "isibi") and leads the shared `design`
  paragraph with it; page + revise prompts dropped the "isibi Websites" identity
  and explicitly forbid renaming / using "isibi". So every page renders the same
  wordmark.
- **Off-subject images (worker prompts):** DESIGN_BAR photography now requires
  every image to depict the site's REAL subject/industry (no astronauts on a
  property site), and repeated card grids (listings/products/gallery) must be
  STATIC `<img data-gen>` per item — not JS-built with a hardcoded/placeholder src
  or one image reused for many items. Over-budget data-gen imgs already fall back
  to a soft gradient (injectSiteImages), so many-card grids never break.
- **NOT yet live-verified:** the generation changes only show on a NEW build/
  revise (Gemini, ~a little credit). Deployed; a test regen needs the owner's OK
  on the small spend.

## 2026-07-19 — FIXED: blank workspace preview (CSP inheritance)
Owner: a built site (real-estate/Zillow clone) showed BLACK in the workspace
Preview, but rendered perfectly when Downloaded and when Published. Compared the
generated code to Lovable's on the way (isibi = single self-contained HTML file
per page w/ inline <style>+<script>; Lovable = full React/TS codebase — noted for
the owner, no action).
- **Root cause (reproduced, not guessed):** the preview loaded the page via a
  `blob:` URL, and blob/srcdoc iframes **inherit the parent's CSP**. The app's CSP
  is `script-src 'self'` (NO 'unsafe-inline', by design — app XSS protection), so
  the generated site's **inline `<script>` was blocked** → no JS → JS-built content
  never rendered → black. Styles were fine (style-src has 'unsafe-inline'); scripts
  were the killer. The published `/s/` route serves `script-src 'self' 'unsafe-inline'`,
  so live + download work. Proved with a faithful Playwright repro: same page under
  the app CSP = 0 cards + "Refused to execute inline script"; under the website CSP
  = full render, 6 cards.
- **Fix (no change to generated sites):** the workspace iframe no longer uses a
  blob. `loadSitePreview()` POSTs the shim-injected page to **`/api/site/preview`**
  (auth'd; one rolling R2 slot per user, `preview/<uid>.html`, overwritten each
  render) and loads it from **`/preview/<uid>/<nonce>`**. `harden()` now treats
  `/preview/` like `/s/` → serves it with the **website CSP** (inline scripts run),
  so the preview matches production exactly. Blob stays as a fallback only if the
  round-trip fails (offline / signed-out).
- **Files:** worker.js (`harden()` /preview/ branch, `/preview/<uid>/<nonce>` R2
  serve route, `POST /api/site/preview`), public/chat.js (`sitePreviewSrc` split
  into `sitePreviewHtml` + async `loadSitePreview`; 2 callers updated).
- **Verified live:** POST → `/preview/<uid>/<nonce>`; GET → 200 with
  `script-src 'self' 'unsafe-inline'` + the page's inline script/style intact.
  Repro rendered the full site (6 cards, working JS). Throwaway user cleaned up.
- **Note:** the errShim `blankCheck` ("page renders blank on load") was firing a
  false "your JS hides content" hint for pages that were actually fine — because
  the REAL cause was our CSP, not the site. Now that the preview runs JS, that
  hint only fires for genuinely-broken sites again.

## Shipped

- **Workspace restructure — Builder is home, other views float (2026-07-15):**
  owner: "delete home and all the stuff in it, and builder will be the new home,
  all the other options will be floating logo in the screen for now." Done:
  the old **Home landing** (`viewLanding`/`renderLanding`) and the whole sidebar
  **Workspace nav** (the 6-item Home/Builder/Gallery/Products/Avatar/Media Agent
  list) were removed. The **Builder chatbox** (`viewHome`) is now the home screen
  and the only thing `enterApp` opens. The **sidebar stays slim** — chats only
  (owner picked "Keep slim sidebar for chats"). Gallery/Products/Avatar/Media
  Agent moved to a **floating logo menu, top-right** (owner picked "Top-right"):
  `#floatNav` (a `.float-logo` button under the profile pill) opens `#floatMenu`
  with the 4 `.float-item` links; `toggleFloatMenu`/`closeFloatMenu`, outside-click
  closes, picking a view closes it. `showView('landing')` now redirects to `'home'`
  so nothing that still asks for the old landing breaks (`renderLanding` is dead).
  Gallery's "Newest first" sort + Avatar's Generate/Import buttons got a 52px
  right pad so they clear the fixed float-logo lane.

- **Public marketing landing (2026-07-12, redesigned 2026-07-13, owner approved
  "main" 2026-07-13 → merged):** logged-out
  visitors see a marketing page BEFORE the auth gate (owner picked option 1).
  In-page `#marketing` section (no new URLs / Worker routing / Supabase redirect
  changes). Boot: signed-in → `enterApp`; logged-out → `showMarketing()`; CTAs
  (`data-mkt`) → `openAuthFrom()` opens the gate; gate "← Back" (`#authHome`) →
  back to landing. **Design = Morphic style** (owner: "i kinda want it like that
  one" → https://godly.design/site/morphic/): dark cinematic, compact
  left-aligned hero ("Generate the impossible."), filmstrip of output under the
  hero, two-tone section headings (bold white line + muted grey line), model
  ticker, Home-screen replica + 3 captions, preset card rail, six "acts"
  feature grid, Plus/Pro/Max pricing, giant "Your premiere starts tonight."
  close, ghost "isibi" wordmark in the footer — all in isibi's pink→amber.
  **Media slots (owner will supply the images/videos):** drop files at
  `public/mkt/f1.jpg` … `f14.jpg` (filmstrip: row 1 = f1–f7, row 2 = f8–f14,
  16:9, ~600px wide is plenty) and `public/mkt/p1.jpg` … `p8.jpg` (preset
  cards, 16:10). Styled placeholder gradients show until a file lands — no
  code change needed to swap them in. Videos: say the word and specific
  filmstrip cells get wired to `<video>` (files as `/mkt/f{n}.mp4`).

- **Auth is a popup now (owner request, 2026-07-13):** the full-screen sign-in
  page (login-bg video background) is gone. Sign up / sign in open as a centered
  modal OVER the marketing landing (dimmed + blurred backdrop). Closes via ✕
  (top-right, was "← Back"), backdrop click, or Esc — all return to the landing
  (Esc ignored for signed-in users so a mid-session re-auth can't be dismissed).
  Gate hidden by default (inline display:none, like #marketing) so it can't
  flash at boot. login-bg.jpg/.webm/.mp4 files kept in the repo (unused by auth).

## Bug log

_Status key: 🔴 open · 🟡 in progress · ✅ fixed_

<!-- Newest first. Template:
### <short title>
- **Status:** 🔴 open
- **Reported:** <date>
- **Where:** <page / file:line>
- **What:** <plain-English description of the bug>
- **Fix:** <what was done, once fixed> (PR #___)
-->

### Video-model schema audit round 3 (2026-07-16) — 2 fixed, 6 catalogued
- **Status:** ✅ fixes shipped; the catalogued items await owner decisions
- **Reported:** 2026-07-16 — owner: "now that we checked the image models, we
  gotta check the video models." Method: fresh fal OpenAPI schema pulled for all
  **29 endpoints** across the 11 video models, diffed against worker wiring +
  chat.js UI + billing (no fal credits spent).
- **Fixed 1 (money):** Seedance's schema `duration` default is **"auto"** (model
  picks the length, up to 15s) — a duration-less submit (tampered client; the
  real UI always sends one) would render up to 15s while billing fell back to
  the 5s base (~3× undercharge, worst case ~$16 at 4K). Worker now pins
  `duration:"5"` whenever none is given, so the render always matches the bill.
  Every other family's schema default already equals its billing base — checked.
- **Fixed 2 (feature):** **Kling multi-shot now works with a start image /
  first-&-last frames.** fal takes `multi_prompt` on Kling's i2v endpoints too
  (the old code comment claimed t2v-only — the fresh schema disproved it). New
  shared `shotsApply()` gate client-side (a clip still disables shots — the o3
  edit endpoint has no multi_prompt), worker gate relaxed to the i2v endpoint,
  director's shotsCapable updated + told the sequence opens on the attached
  frame. Parity bench: all 27 existing + 4 new i2v-shot cases pass.
- **Verified clean:** every model's durations/ratios/resolutions match schema
  exactly (incl. Veo 4s/6s + 4K, Ray 21:9/3:4/4:3, Kling 3–15s, Gemini 3–10s);
  all special billing bases (Veo extend 7s / ref 8s, clip edits on measured
  length, Ray i2s + 5s lock, LipSync per-5s, OmniHuman per-sec, shot sums,
  Seedance vref 0.6×(in+out)); Seedance `generate_audio` confirmed free in
  schema text; prompt caps per family.
- **Round-3b (same day, owner: "add that stuff"): four knobs wired**, all
  director-driven (no new UI), all price-neutral, all riding the existing
  extras rail (sanitizeExtras → body → worker re-validates):
  1. ✅ **Seedance `bitrate_mode:"high"`** (full+fast; mini's schema lacks it) —
     fal's pricing page has NO bitrate dimension (checked 2026-07-16), so it's a
     free bigger-file/higher-quality encode. Director sets it when the user asks
     for max quality / a crisp master.
  2. ✅ **Kling `shot_type:"intelligent"`** — the model auto-directs the cut
     structure; set when the user asks the model to decide the cuts. Suppressed
     next to an explicit shot list and on the o3 edit endpoint.
  3. ✅ **Kling v3 `cfg_scale` 0–1** — prompt-adherence dial ("follow it
     exactly" ~0.8 / "go loose" ~0.2). o3 has no such field — gated off there.
  4. ✅ **Ray v2v per-signal `controls`** (pose/depth/normals/trajectory/face,
     each with its dial) — set when the user says what to keep/free on a clip
     re-render ("keep my face, loosen the camera"). Precedence: controls >
     edit-strength dial > auto_controls (fal rejects combos; exactly one sent).
     `sanitizeRayControls()` shared by /api/direct and /api/video.
  - 20-case functional test on the new sanitizers/gates + full 31-case price
    parity bench: all pass.
- **Round-3c (same day, owner: "pretty sure there are still missing stuff"):
  the owner was right — a CATALOG probe (not just param-diffing endpoints we
  already used) found 12 unwired endpoints; all wired:**
  1. ✅ **Veo 3.1 Fast** — the whole family (t2v/i2v/first-last/reference/
     extend), ~2.7× cheaper than full Veo ($0.15/s audio-on, $0.10 off;
     4k $0.35/$0.30). New picker entry; all generic Veo code paths apply.
  2. ✅ **Kling o3 Standard** — cheaper o3 (t2v/i2v/reference/edit; $0.112/s
     audio-on, $0.084 off, edit $0.126/s). New picker entry.
  3. ✅ **Kling o3 reference-to-video (pro + standard)** — ≤4 reference images
     bound as native **@Image1–4 prompt tags** (Seedance-style), optional
     start/end frames, shot-lists allowed. o3 models now have caps.ref:4; the
     director cites tags (and inside shot prompts); same per-second rate as t2v.
  4. ✅ **OmniHuman v1.5** — $0.16/s, 720p/1080p picker (billed the same),
     optional typed text guides motion/emotion. New picker entry next to v1.
  5. ✅ **Kling LipSync text-to-video** — attach a clip and just TYPE the words
     (no audio upload): Kling voices them itself. Curated 7-voice English picker
     (Narrator default; the schema's other ~39 voices are Chinese — skipped).
     Same per-5s input-clip billing as the audio mode.
  - Parity: 9 new cases + all 31 existing pass. Voice section reuses the audio
    voices UI (labels + preview suppressed for Kling ids).
  - **Probed and confirmed NOT to exist** (so nobody re-hunts): Kling v3
    v2v-edit/elements-endpoint/effects, o3 motion-control, Gemini omni non-flash
    tiers, Seedance pro/first-last/v2v, Ray ref/extend/modify, OmniHuman multi.
  - **Found but NOT wired:** `o3/pro/video-to-video/reference` (re-render a clip
    WITH reference images, $0.168/s output) — its `duration` input is nullable
    with undocumented output-length semantics; billing it blind risks under-
    charging. Needs one cheap live job when the fal balance lands. Clip+refs
    meanwhile still works via the o3 edit endpoint (image_urls).
- **Round-3d (2026-07-16, owner: "Kling elements + bitrate sanity check"):**
  - ✅ **Kling character elements SHIPPED (v1)** — a new **Characters** attach
    row on all four Kling models (o3 pro/std, v3 pro/std): up to 4 characters,
    each ONE frontal image, badged **@Element1–4** with tap-to-cite chips in
    the composer (same rail as @ImageN). Identity holds across the video.
    Routing: o3 + characters (no clip) → reference-to-video (characters and
    style refs can combine, start/end frames ride along) · o3 + clip →
    edit endpoint (fal caps characters+refs at 4 COMBINED — characters get the
    slots first, pre-send guard blocks over-cap) · v3 → i2v only, so a start
    image is REQUIRED (friendly pre-send message points at o3 otherwise).
    Director cites @ElementN (incl. inside shot prompts) and can see the first
    character image. @ElementN tag hygiene mirrors @ImageN (dangling dropped).
    Price-neutral (elements are an input on already-priced endpoints).
    10-case routing/hygiene test + full 40-case parity bench pass.
    **v2 later (if wanted):** per-character angle shots (fal takes 1–3
    `reference_image_urls` per element) — needs a per-slot "+ angles" UI.
  - 🟡 **Seedance bitrate_mode billing** — three independent FREE signals say
    high bitrate is not billed (pricing page has no bitrate dimension; the
    token formula h×w×dur×24/1024 has no bitrate term; web sweep finds zero
    mention). Final 100% = one live job, folded into the fal-balance live sweep.
- **Still NOT wired (deliberate):**
  1. **Veo `seed` + `safety_tolerance` (1–6)** — defaults kept: seed has no
     reproducibility story in the chat flow; safety_tolerance is a policy knob.
  - Seedance "auto" duration as a UI pick: skipped on purpose — can't price an
    unknown output length.

### Model-wide fal input-validation audit (2026-07-14) — most fixed, 2 deferred
- **Status:** ✅ main gaps fixed; two low-risk items intentionally deferred (below)
- **Reported:** 2026-07-14 — after a v2v edit 422'd ~50× (root cause: clip was 15.10s, over Kling's strict **15.05s** cap; our attach check had a 0.5s grace so it slipped through). Owner: "check that now for every model."
- **Where:** every video/image/audio endpoint. Audited each against its live fal OpenAPI schema (`fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>`).
- **What / Fixed:**
  - Clip duration tolerance now matches fal's exactly (0.05s, was 0.5s) — `CLIP_LIMITS`/`clipIssue` in chat.js.
  - **Veo reference-to-video** locks duration to `"8s"`; we were sending the user's 4/6/8 → 422. Worker now forces `"8s"` for that endpoint.
  - **Audio limits** added (`AUDIO_LIMITS`/`audioIssue`, chat.js): Kling LipSync (.mp3 ≤5MB 2-60s), OmniHuman (≤30s), Seedance ref audio (MP3/WAV ≤15MB ≤15s) — validated at attach + send.
  - **Ray prompt cap** was defaulting to 20000 on t2v/i2v; real cap is 6000 (all `luma/`). Worker clamp fixed.
  - Clips are staged to **fal storage** (hosted URL) before submit (`falUpload`, worker) — data URIs worked for the duration probe, but hosted URLs are universally accepted and keep request bodies small.
  - fal's exact rejection reason is now surfaced in chat (`falErrorDetail`) + auto-refund on any terminal 4xx.
- **Confirmed already-correct:** Kling v3 `start_image_url`; Veo `first_frame_url`/`last_frame_url`; Seedance fast/mini 480p/720p tiers; Ray v2v & Gemini edit have no clip limits; Kling prompt cap 2500.
- **Formerly-deferred items — BUILT 2026-07-14 (owner: "sure do that"):**
  1. **fps auto-conform** — `sbFFProbeFps`/`sbFFFps` (ffmpeg-edit.js) probe the attached clip's real fps via the on-device engine; `normalizeClipFps()` (chat.js) re-encodes out-of-range clips to the nearest bound (e.g. 23.98 → 24 for Kling o3) automatically, free, with a chat note. Runs at attach + on model switch.
  2. **Image dimension checks** — `imgMeta`/`imageAttachIssue()` measure every image slot (image/end/first/last) and bounce Kling-bound images under 300×300 or outside aspect 0.40–2.50 at attach, re-checked on model switch.
  3. Also: image models' min prompt length (nano-banana-pro = 3 chars) guarded in raw mode.

### Pricing audit — fal bills per ENDPOINT, not per model (2026-07-15)
- **Status:** ✅ fixed
- **Reported:** owner noticed the successful Kling o3 v2v edit billed **$2.52** on fal while the app charged 263 credits ($2.10) — the edit endpoint bills $0.168/s, a 20% premium over t2v's $0.14/s. Root cause of the class: price tables keyed rates by MODEL while fal prices each ENDPOINT separately. Swept all 31 endpoints' pricing pages.
- **Fixed (both `VIDEO_USD`/`VIDEO_PRICE` worker+client tables):**
  - Kling o3 v2v edit → own `v2s` rate $0.168/s (15s edit now quotes/charges 315 credits).
  - **Veo extend** outputs a const 7s clip → billed at 7s regardless of the duration picker ($2.80/350 credits, audio-on rate).
  - **Ray i2v** is priced BELOW t2v (5s 720p $0.30 vs $1.00) and 10s is unavailable from a start image → new `i2s` tier + duration forced to 5s (was overcharging ~3×).
  - **Kling LipSync** bills the INPUT VIDEO's seconds rolled up to 5s steps ($0.014/s) — we billed per audio seconds (could undercharge 10×). Now billed from the client-measured clip length (clamped 2–10s; unknown bills the 10s max).
  - **gpt-image-2** is token-billed; High 1024² ≈ $0.211 → flat rate raised $0.12 → $0.22.
  - Seedance per-second nudges: std 720p 0.304 / 1080p 0.682; fast 480p 0.135 / 720p 0.242; mini 480p 0.0725.
- **Verified correct:** Veo tiers (audio-on rates), Ray t2v/v2v + HDR 2×/EXR 3×, Gemini ~0.13/s, Kling t2v/i2v all tiers, nano-banana $0.15 (4K would be 2× — we only render 1K), all ElevenLabs rates.
- **Lesson recorded:** any new model/endpoint must have BOTH its input schema AND its pricing page checked before wiring (they differ per endpoint under the same model name).

### delete_account() can leave orphaned usage_log rows + storage objects (FOR AUDIT)
- **Status:** 🟡 one-time cleanup done 2026-07-14; root fix deferred (owner: "later, just note it for audits")
- **Reported:** 2026-07-14 (owner deleted their `aniascristian@gmail.com` test account and asked to verify)
- **Where:** Postgres `public.delete_account()` — its `delete from usage_log` and the storage clause `owner=uid`; also the client Delete-account flow in `public/chat.js`.
- **What:** Audit after the deletion found the auth user + identity, chats, credits, user_memory, user_plan, video_editor_plan, and all GoTrue child rows (sessions/refresh_tokens/identities) GONE — but **3 `usage_log` rows** and **1 storage object** (`media/test/hello.txt`, owner = the deleted uid `144474c8-bb38-4ffc-a867-d9fb54c31bcd`) were left behind. No `purchases` existed (those are intentionally KEPT as a financial record anyway).
- **Cleanup done:** deleted the 3 usage_log rows; deleted the storage object using the same `storage.allow_delete_query` GUC that `delete_account` uses (direct `DELETE FROM storage.objects` is blocked by the `storage.protect_delete()` trigger). Re-verified: **0 orphans anywhere.**
- **Likely cause:** the account was probably removed OUTSIDE the app's `delete_account()` RPC (e.g. straight from the Supabase dashboard) — cascade FKs then clear chats/credits/etc., but `usage_log` and `storage.objects` don't auto-cascade so they orphan. If instead the app's own "Delete account" button was used and these still leaked, `delete_account()` has a real gap (its usage_log delete + `owner=uid` storage clause should have caught both).
- **Reusable audit (run for any deleted account / general sweep):** for a given uid, or generally, count rows whose owner is NOT in `auth.users` across: `usage_log`, `storage.objects` (bucket `media`, by `owner`), `chats`, `credits`, `user_memory`, `user_plan`, `video_editor_plan`, `auth.sessions`, `auth.refresh_tokens`, `auth.identities`. All should be **0**. (`purchases` orphans are expected/OK.)
- **Fix (deferred, owner said later):** harden `delete_account()` (or add ON DELETE CASCADE / a cleanup trigger) so `usage_log` + `storage.objects` are always cleared regardless of deletion path; optionally a periodic orphan-sweep job.

### Added Luma Ray 3.2 to the video roster (owner request, 2026-07-12)
- **Status:** ✅ done
- **Where:** `worker.js` (allowlist, VIDEO_USD, isRay field handling),
  `public/chat.js` (MODEL_OPTS, menu row, providerOf, VIDEO_PRICE), `docs/MODELS.md`
- **What:** fal endpoint `luma/agent/ray/v3.2/text-to-video` (+ `/image-to-video`
  via the standard suffix swap). 5s/10s ("Ns" string), 540p/720p/1080p, six
  ratios, image + first-&-last frames (`image_url`/`end_image_url`), no
  reference mode, no audio. fal pricing → per-sec: 540p $0.10 · 720p $0.20 ·
  1080p $0.40 (t2v rates used for both paths — never undercharge). HDR/EXR and
  keyframes exist on the API but are NOT exposed yet (HDR doubles cost).
- **Untested on a real render** — fal balance still empty; verify on the live
  sweep when topped up.
- **HDR toggle added (owner request):** Settings panel shows an "HDR · 2× price"
  Off/On section for models with `opts.hdr` (Ray only). Guardrails both ways:
  turning HDR on bumps 540p→720p and 10s→5s; picking 540p/10s turns HDR off.
  Price quote doubles live; worker validates independently (`wantHdr` — wrong
  combos are neither sent to fal nor charged) and `creditCost` bills 2×.
- **Loop / EXR / video-to-video added (owner: "add all of those", 2026-07-12):**
  (1) **Seamless loop** — free Off/On in Settings; 5s SDR only, exclusive with
  HDR, dropped server-side alongside end frames/keyframes. (2) **EXR** — the
  HDR section is now Off / On·2× / On+EXR·3×; sidecar link is delivered as a
  chat message after the render (fal links expire in days). (3) **Video-to-video**
  — attaching a Video clip on Ray routes to `/video-to-video` (re-render the
  clip); "Clip edit mode" section: Auto (auto_controls) or adhere/flex/reimagine
  (sent at mid intensity `_2`); keyframes may combine; no aspect_ratio (source
  framing wins); billed at its own higher rates (`v2s`: 540p $0.144 · 720p
  $0.216 · 1080p $0.432 per sec) in both quote and charge. Granular v2v
  `controls` (pose/depth/face/trajectory) exist on fal but are folded into
  Auto for v1.
- **Keyframes added (owner request, full 64):** new "Keyframes" attach row,
  Ray-only (`caps.kf: 64`) — up to 64 images, numbered tiles in a 2-up grid,
  attach order = playback order, mutually exclusive with the other image inputs.
  Worker rides the i2v endpoint: `keyframes` + `keyframe_indexes` spaced evenly
  across the clip (24fps: 0–120 for 5s, 0–240 for 10s). No timeline UI yet —
  even spacing is the v1; a drag-to-time timeline is the future upgrade
  (pairs with the preset system). No extra charge (fal bills by video length).

### Builder: reference images must be visibly defined as @Image1, @Image2…
- **Status:** ✅ done
- **Reported:** 2026-07-11
- **Where:** `public/chat.js` `renderRefList()` / `showApInfo()`; `public/styles.css` `.slot-tag`
- **What:** For models that take reference images, the owner wants the chat to
  define them as @image1 etc. The backend already did (director writes the tags
  into Seedance prompts; worker appends "Feature @Image1…" to raw prompts and
  strips dangling tags) — but the UI never told the USER the tags exist.
- **Fix:** Each reference thumbnail now wears an @ImageN badge, and the ref-row
  tooltip teaches the syntax. First pass was Seedance-only; owner directed it to
  apply to ALL reference-capable models — so badges show wherever a Reference
  row exists, and the worker translates @ImageN → "reference image N" for
  tagless families (Veo) instead of stripping, keeping the sentence intact. The
  director is likewise told user-cited @ImageN on Veo means that reference.
- **In the chat too:** sending a message with references now drops a thumbnail
  strip under the user bubble (right-aligned), each thumb tagged @ImageN — the
  thread records which image each cited tag pointed at. Thumbs are downscaled
  (≤168px JPEG) before persisting so the localStorage chat budget + Supabase
  chat sync stay small; strip type is `{t:'refs', imgs:[…]}` in chat msgs.
- **In the chatbox too:** while references are attached, the composer shows one
  clickable @ImageN chip per image (micro-thumbnail + tag); tapping inserts the
  tag at the cursor (`renderRefChips`/`insertAtCursor`).

### Media Agent: wide panel on EVERY tab (superseded the Videos-only widening)
- **Status:** ✅ done
- **Reported:** 2026-07-11
- **Where:** `public/styles.css` `.ma-page` / `.ytg` / `.grid`
- **What:** First pass widened only YouTube → Videos (PR #352). Owner then said
  every tab — including all Instagram tabs — should use that wide size.
- **Fix:** `.ma-page` is now always 1420px max (the `.wide` toggle was removed);
  YouTube videos run 4-up (~332px cards, same as the old 2-up/720px), IG posts
  run 6-up (~215px tiles, same as the old 3-up). Column counts step down on
  narrower windows so cards keep their size. (PR #___)
- **Preference:** grids scale by ADDING COLUMNS, never by growing cards.

### YouTube Videos tab: deleted-video tombstones shown + no thumbnails on real videos
- **Status:** ✅ fixed
- **Reported:** 2026-07-11
- **Where:** `worker.js` — `youtubeVideos()` (~line 1180) + the CSP `img-src` (~line 382)
- **What:** (1) The Videos tab listed "Deleted video" placeholder cards (YouTube
  keeps tombstones for deleted uploads in the channel list). (2) Real videos
  showed empty boxes instead of thumbnails. (3) Owner also wants thumbs at full
  quality.
- **Cause:** (1) No tombstone filter. (2) The Content-Security-Policy `img-src`
  didn't include `i.ytimg.com`, so the browser silently refused every YouTube
  thumbnail (same would bite Instagram post thumbs via `cdninstagram/fbcdn`).
  (3) Worker picked the 320px `medium` thumb first.
- **Fix:** Filter tombstones server-side (title "Deleted video" AND no
  thumbnails, so a legit video with that name survives); add
  `*.ytimg.com`, `*.cdninstagram.com`, `*.fbcdn.net` to `img-src`; pick the
  largest thumb available (maxres → standard → high → medium → default). (PR #___)

### White scrollbar after "Settings" tab in Media Agent panel
- **Status:** ✅ fixed
- **Reported:** 2026-07-11
- **Where:** `public/styles.css` `.sec-tabs` (~line 995)
- **What:** A white browser scrollbar stub painted right after the Settings tab
  on the Media Agent panel (Windows Chrome default scrollbar on the dark theme).
- **Cause:** `.sec-tabs` sets `overflow-x: auto`; per CSS rules that makes
  `overflow-y` compute to auto too, and the tab buttons overflow the strip by a
  couple px → browser painted a tiny default (white) vertical scrollbar.
- **Fix:** `overflow-y: hidden` + hidden scrollbars on `.sec-tabs` (same idiom
  as `.studio-thread`); tabs still scroll by wheel/touch if they overflow. (PR #___)

### Home page got a chatbox (owner request, 2026-07-12)
- **Status:** ✅ done
- **Where:** `public/chat.js` `renderLanding()`; `public/styles.css` `.lp-compose`
- **What:** A composer on the Home page (same panel style as the Builder's),
  docked at the BOTTOM (owner: "put it on the bottom" — sticky, pins low on
  short pages, stays in view over a scrolling grid). Typing + Enter/send starts
  a FRESH chat, switches to the Builder, and fires the message through the
  normal send path (orchestrator included) — the user lands mid-conversation.
- **Preset cards re-wired (2026-07-12, supersedes the display-only interim):**
  clicking a card pins it as a removable amber CHIP in the Home chatbox
  (reference: a "3D object generation ×" pill the owner showed) + switches mode
  to the card's kind. The user types just their idea; on send the preset's
  prompt rides along as "Creative direction — follow this preset: …" for the
  director. × unpins; chip clears after send and on view re-render. Sending
  with only a chip (no typed idea) sends the raw preset prompt.
- **Cards fully wired (owner: "actual thing behind the screen", 2026-07-12):**
  every one of the 19 presets is now a real RIG — a director-grade prompt
  (rewritten, ~70-100 words each, craft language + guardrails) PLUS a pinned
  model/ratio/duration/resolution matched to MODELS.md strengths (e.g. UGC
  testimonial → Seedance 2.0 · 9:16 · 10s; Sale announcement → GPT Image 2 ·
  1:1; Floating product → Ray 3.2 · 1:1 · 5s; Epic establishing → Veo 3.1).
  `applyPresetRig()` applies it at send time, validating every value against
  the model's real options so a stale rig can't produce an invalid job.
- **Two new Marketing cards (owner's references, 2026-07-12):**
  (1) **Product Animation** — exploded-view rig: components separate in
  synchronized suspension, camera drifts through, parts reassemble into the
  hero shot (reference: a camera-lens exploded-view card the owner liked).
  (2) **From product URL** (`urlScan: true`) — pin chip, paste a store link,
  send: `lpGo` scans it via the existing `/api/product/scan`, the product's
  image auto-attaches as the start image, its name/price/desc feed the
  director, and the ad preset runs 9:16. Chip shows "Reading the page…"
  during the scan; bad links keep the text and explain in the placeholder.
- **QR burned into product-URL videos (owner request, 2026-07-12):** videos
  generated in a "From product URL" chat get a scannable QR (→ the product
  page) burned into the bottom-right corner BEFORE saving — real pixels, so
  downloads/re-shares carry the link forever. Pipeline: vendored MIT
  `qrcode-generator` (`public/vendor/qrcode.js`, CSP-safe) → `qrPngFor()`
  canvas PNG → `sbFFQr()` in ffmpeg-edit.js (on-device ffmpeg overlay via
  scale2ref at ~22% of video height, same encode args as the caption burner) →
  base64 `/api/save` (Studio-film path, 29 MB cap). `chat.productUrl` marks
  the chat at send; the burn hooks the delivery loop and falls back to the
  normal unburned save on ANY failure (free tier/no storage → temp link, no
  QR — burned copies can't persist without gallery storage). Untested against
  a real render (fal balance) — verify in the sweep.
- **Conversational QR control (owner request, 2026-07-12):** the user can now
  direct the QR in plain chat — "put a qr code from second 3 to 4", "add a QR to
  <url> for the last 3 seconds", "qr at the end", "no qr". `parseQrDirective()`
  (client-side) extracts want/remove, URL (falls back to `chat.productUrl`), and
  a timing window (from-to / last-N / first-N / at-the-end / at-the-start / at-
  second-N, resolved against the clip `duration`), and returns a CLEANED message
  (QR clause + URL stripped) so "qr code" never enters the generation prompt.
  `send()` stashes it on `chat.qr`; the burn step honors it (timed window via
  ffmpeg `enable=between(t,a,b)` in `sbFFQr`), product-URL auto-burn is the
  fallback, `off` suppresses. Model-agnostic (post-process on whatever mp4 fal
  returns — Seedance/Veo/Ray all identical). Want-but-no-URL → asks for the link.
  Parser unit-tested; timed burn verified in ffmpeg only by construction (live
  render pending fal balance).
- **QR position by voice (owner request, 2026-07-12):** the user can also say
  where — "qr top-left", "bottom-left corner", "center". `parseQrDirective`
  returns `pos` (tl/tr/bl/br/c); `sbFFQr` maps it to the overlay x:y (default
  bottom-right). `send()` MERGES a new directive onto the prior `chat.qr` so a
  follow-up tweak ("move it top-left") keeps the earlier url/timing. Matters for
  social: bottom-right collides with Reels/TikTok action buttons, so bottom-left
  or top is the clean spot on 9:16.
- **QR is BURNED CLIENT-SIDE, not by the model or server:** the generation model
  (Seedance/Veo/Ray) never sees "QR" — the instruction is stripped from the
  prompt. The Worker only proxies fal + saves. The QR is stamped in the user's
  BROWSER via on-device ffmpeg (ffmpeg.wasm) after the video returns, then the
  burned copy is uploaded to save. Fully model-agnostic.
- **⚠ Model picks are PROVISIONAL:** owner said (2026-07-12) they will dictate
  the right model per preset later — treat the current assignments as
  placeholders and expect a revision pass when the owner provides their list.

### Home-page preset cards must not hand off to the Builder (interim)
- **Status:** ✅ done (interim behavior)
- **Reported:** 2026-07-11
- **Where:** `public/chat.js` `renderPresetsInto()` / `usePreset()` (~line 934)
- **What:** Clicking a starter card on Home ("Product hero ad", "UGC testimonial"…)
  switched to the Builder with the preset prompt loaded. Owner wants generation to
  eventually happen ON the Home page itself; until that's built, cards shouldn't
  navigate anywhere.
- **Fix:** Unwired the card click (cards are display-only for now). `usePreset()`
  kept intact for the future generate-on-Home flow. (PR #___)
- **TODO later:** build generate-in-place on Home and re-wire the cards to it.

### Attachments cleared when switching to a non-supporting model — NOT a bug (owner's call)
- **Status:** ✅ working as intended — do not change
- **Reported:** 2026-07-11
- **Where:** `public/chat.js` `updateAttachVisibility()` (~line 384)
- **What:** Attach an image → switch to a model without image support → switch
  back: the image is gone. The code deliberately deletes incompatible
  attachments on model switch (rather than hiding them) so a stale attachment
  can never be silently sent to a model that can't use it (send code doesn't
  gate by caps).
- **Decision:** Owner reviewed 2026-07-11 and prefers this behavior. Leave as is.

### Messages leak across all chats — thread never repaints on switch
- **Status:** ✅ fixed
- **Reported:** 2026-07-11
- **Where:** `public/chat.js` — duplicate `renderThread` (1592 + 5112)
- **What:** Typing in one chat showed the same messages in every chat. Each chat's
  stored `msgs` were actually separate; the bug was that switching chats never
  redrew the thread, so the screen stayed frozen on the last chat's messages.
- **Cause:** Two top-level functions were both named `renderThread` — the real
  chat one (1592) and an unrelated Media Agent Instagram-DM one (5112). JS lets
  the last declaration win, so every chat-thread repaint call actually hit the
  DM version, which no-ops when there's no DM panel (`#maDmThread` missing).
- **Fix:** Renamed the Media Agent DM function (and its single caller) to
  `renderDmThread`, freeing `renderThread` to be the real chat repaint again. (PR #348)

### Model capabilities wired up — @Video refs, Kling shot-lists, Gemini i2v, GPT ratio fix
- **Status:** ✅ shipped
- **Reported:** 2026-07-15 — owner: "add everything a model supports … lock in."
- **What (four things, after auditing every model's live fal schema):**
  1. **Seedance `@Video1` reference** — you can now drop a video clip alongside
     your image refs on Seedance (all 3 tiers) → it rides into reference-to-video
     as `video_urls` (@Video1), a motion/subject reference for a fresh scene. New
     clip slot on Seedance + a `@Video1` composer chip. Priced at t2v rates (a
     reference, not a re-render). Mini also gained reference-to-video (its old
     "no ref endpoint" note was stale — verified on fal).
  2. **Kling `multi_prompt` shot-lists** — Kling o3/v3 t2v can render a CUT
     sequence of distinct shots in one video. Director-driven (AI-native, no new
     knobs): the composer returns a `shots` array [{prompt, duration}] when you
     ask for a montage/multi-beat sequence; the Plan card shows the shot
     breakdown. Billed on the SUM of shot seconds at the model rate (quote ==
     charge, float-verified). Only on pure t2v (nothing attached).
  3. **Gemini image-to-video** — a whole fal endpoint we never wired. Gemini now
     has a start-frame (image) slot → `google/gemini-omni-flash/image-to-video`.
  4. **Bug fix: GPT Image 2 aspect ratio** — it has no `aspect_ratio` field
     (sizes via `image_size`), so a picked ratio was silently dropped and every
     render came out landscape 4:3. Now maps ratio → `image_size` enum.
- **Where:** `worker.js` (routing/billing/compose tool), `public/chat.js` (caps,
  clip/audio limits, chips, shots threading, pricing), `public/styles.css`.
- **Deferred on purpose (need fal cost-deltas or lower value):** `generate_audio`
  toggle (enabling audio where it's OFF by default — e.g. Kling o3 — risks
  undercharging until we verify fal's delta; most models already default audio
  ON, priced in), image quality/resolution tiers (nano-banana 2K/4K, gpt-image-2
  `quality` — price levers, need repricing), Kling "elements" character mode
  (@Element multi-angle consistency — bigger feature), ElevenLabs voice tuning
  (stability/style/speed — no price impact, marginal). All catalogued from the
  per-model schema audit.

### Round-2 audit (owner asked: "check the missing stuff again, check credits too") — 33 confirmed findings, fixed 2026-07-15
- **Status:** ✅ fixed (the fix batch below); rest documented
- **Money bugs found & fixed (quote == charge re-verified, 27-case parity test):**
  1. **Kling o3 was billing audio-ON ($0.14/s) for SILENT renders** — o3's
     `generate_audio` defaults false (every other family: true). Fix: o3 t2v/i2v
     now send `generate_audio:true` — the video you pay for has sound.
  2. **o3/Gemini clip edits billed the duration PICKER; fal bills the CLIP's
     length** (the owner's $2.52 15s edit proved it — we'd charged for 5s).
     Fix: bill the clip's server-measured length (o3 ≤15s; Gemini capped at 30s
     — our product cap, attach-validated).
  3. **Veo reference-to-video always renders 8s but billed the 4/6s pick** —
     fix: bill 8s (both sides).
  4. **Seedance @Video reference pricing** — fal prices video input at 0.6×rate
     over (input+output) seconds; we billed flat t2v × output. Fixed to the
     0.6×(in+out) basis (covers both readings of fal's page; relax later if a
     live job bills less).
  5. **Auto-mode multi-shot could show ✦79 and charge ✦788** — Auto now posts
     "🎬 Multi-shot: N shots · Xs total — ✦YYY" in the chat before billing
     (Plan card was already exact).
  6. **/api/direct kept the fee when the AI call failed** — every terminal
     failure path (fetch error, upstream !ok, no tool output, stream break,
     research come-up-empty) now reverses the fee via a new `credit_back(target,
     amount)` RPC (SECURITY DEFINER, **service_role-only EXECUTE, ≤10 credits
     per call** — worker-authorized only, not client-callable).
  7. **gen_charges insert was fire-and-forget** — a failed insert after a
     dropped reply made a charged render unrecoverable AND unrefundable. Now
     awaited with one retry before responding.
  8. **Compose could truncate a big multi-shot answer** (max_tokens 4000, and
     thinking shares the budget) → user paid, got local fallback. Raised to 8000.
  9. Phantom Seedance-fast 1080p price tier deleted (no such tier on fal).
- **Free upgrades wired:** nano-banana now renders **2K** (same $0.15 as 1K on
  fal — verified; 4K is 2× and stays unwired). Veo `auto_fix:true` normalized on
  all Veo endpoints (i2v defaulted false → content-policy trips failed instead
  of self-healing).
- **Director-driven knobs wired (owner's call: AI sets them, no new UI):**
  - **"silent/no sound"** → `sound:false` → `generate_audio:false` (Seedance/
    Kling/Veo; o3-edit `keep_audio:false`) — AND bills the cheaper audio-off
    tier where fal has one (Veo halves; v3 pro 0.112, v3 std 0.084, o3 0.112).
  - **"no people / avoid text"** → `negative` → `negative_prompt` on Kling v3
    (APPENDED to fal's quality-guard default, never replacing it) and Veo.
  - **"say it slower / more expressive"** → ElevenLabs `speed`/`stability`/
    `style` (v3 model: stability only). Price-neutral.
  - All ride the same pending→review-card→generateMedia lifecycle as shots.
- **Seedance @Video clip band:** fal caps reference clips at ~0.41-0.93MP pixel
  AREA (1280×720 fits; 1080p doesn't). Attach now auto-downscales oversized
  clips on-device for free (`sbFFScale`, same pattern as the fps conform);
  under-480p clips are rejected with the reason.
- **nano-banana full ratio list** (3:2, 2:3, 4:5, 5:4, 21:9 added — per-model
  `IMAGE_RATIOS`; GPT Image 2 keeps its 5 mappable presets).
- **Round-1 wiring re-verified correct** by schema re-fetch: multi_prompt rules
  (prompt omitted when shots sent — v3 requires that), Gemini integer duration,
  GPT image_size enum values, no cross-endpoint leaks (gates proven).
- **Known exposures documented, NOT charged for yet (need one live job each to
  verify):** Kling v3 "voice control" third price tier ($0.196/$0.154 —
  trigger mechanism unknown, possibly dialogue in prompt); whether fal's
  multi-shot total length == sum of shot durations; Gemini /edit regional
  restriction (EEA/CH/UK) possibly binding on the fal account; Seedance
  bitrate_mode. **Add all four to the fal-balance live sweep list.**
- **Deliberately skipped (reasons on file, don't re-flag):** Kling v3
  `cfg_scale` (no reliable user-language signal), Veo `safety_tolerance`
  (moderation dial, platform decision), `seed` (rerun means fresh sample),
  Seedance duration/aspect "auto" (unbillable/low value), nano `sync_mode` +
  `output_format`, Kling **elements** mode (character consistency — real
  feature, deferred to its own pass: needs elements↔image_urls live testing
  and the voice_id half trips the voice-control price tier).

### Post-round-2 free checks (2026-07-15, same day)
- **Supabase security advisors run:** one real WARN actioned — the six dead
  add-on RPCs from the removed Orchestrator/Video-Editor products
  (`orchestrator_status` was ANON-callable) are now **dropped** from the live DB
  (migration `drop_dead_addon_rpcs`; zero code references, verified incl. the
  demo copies). Remaining WARNs are by-design (auth-callable credits/storage
  RPCs; deny-all RLS tables). One recommendation for the owner: enable
  **leaked-password protection** (HaveIBeenPwned check) in Supabase Auth
  settings — one toggle, dashboard or Management API.
- **`sbFFScale` verified headless in a real browser engine:** a 1920×1080 H.264
  clip conformed to 1278×718 (917,604 px — inside Seedance's reference band),
  16:9 preserved, even dims, audio intact, duration intact; output re-probed
  with native ffmpeg. (Headless note: plain Chromium has no H.264 *decoder*, so
  in-browser playback of the result can't be asserted there — real
  Chrome/Safari decode it fine.)
- **Still not live-tested (needs fal credit, owner's go):** the four sweep
  items above + first real runs of multi-shot / @Video ref / Gemini i2v /
  silent-flag billing.

### Gallery no longer loses saved media when a chat is deleted (2026-07-15)
- **Bug the owner hit:** saved a dog image, later deleted the chat it was in,
  and it vanished from the Gallery — but Storage still showed 1.2 MB used.
- **Root cause:** `galleryItems()` rebuilt the whole gallery by scanning
  `chatStore.chats[].msgs[]` for media messages. So a saved file only showed if
  a chat message still pointed at it — delete the chat, lose the card, and the
  file is orphaned in storage (still billed against the quota). "Save to
  gallery" was really just "a media message exists in a chat."
- **Fix:** the Gallery now reads what's ACTUALLY in the caller's storage.
  - New RPC `list_media()` (SECURITY DEFINER, auth-only, mirrors
    `storage_status()`'s `media/<uid>/` prefix scope) → returns each object's
    name/size/created_at.
  - New `GET /api/gallery` → maps rows to `{url, kind (from extension), size,
    at (parsed from the `<ms>-` filename)}`.
  - `galleryItems()` now merges: **storage is authoritative for existence**;
    chat messages only overlay prompt/poster when the originating chat still
    exists. A file whose chat was deleted still shows (no prompt). Falls back to
    the old chat-derived view if `/api/gallery` hasn't loaded / failed.
  - `galleryDelete` still removes the file + chat msg, and now also drops it
    from the storage-list cache. `refreshGallery()` fetches on gallery open.
- **Recovers the owner's dog automatically** (it was always in storage —
  `1216004` bytes, matches the 1.2 MB the bar showed). Also fixes the orphaned-
  storage class of bug for everyone, cross-device.
- Still open (documented, from the round-3 audit, NOT yet fixed): Stripe
  chargeback handling, the auto-reply prompt-injection surface, `delete_account`
  not clearing `gen_charges`, the jobs-record cap, and the CSP nit.

### Images no longer "render again" on every refresh (2026-07-16)
- **Owner's report:** every refresh, images anywhere (chat, gallery, avatars)
  visibly re-render / paint top-down. "Is that normal, or can it just appear
  there."
- **Two causes, both fixed:**
  1. `/api/save` uploaded to Supabase Storage with NO cache-control header →
     the browser re-downloaded every multi-MB original on every refresh.
     Filenames are unique (`<ms>-…`) and files immutable, so uploads now send
     `cache-control: max-age=31536000` — after first view, media comes from
     the browser cache instantly. **Only NEWLY saved files get this** —
     already-uploaded objects keep their old metadata (would need a re-copy
     migration to backfill; not done, old files just stay slower).
  2. Big JPEGs paint top-down while downloading. All saved-media `<img>`s
     (chat `buildMedia`, gallery grid, avatar cards + creator result) now use
     `.img-fade`/`.img-ready`: invisible until fully loaded, then a 0.22s
     fade-in — images appear whole, never half-painted. Plus
     `decoding=async` + `loading=lazy`.
- Headless-verified on all three surfaces (fade class applies, ready fires,
  no page errors). Product thumbs skipped on purpose — they're inline data
  URIs (instant already).

### Avatar page went invisible — CSP vs inline handlers (2026-07-16)
- **Owner's report:** "AVATAR NEVER RENDERED" — blank card where the avatar
  thumbnail should be, right after the fade-in deploy.
- **Root cause (mine):** the avatar fade was wired with an inline
  `onload="..."` attribute. The worker's CSP has NO 'unsafe-inline' for
  scripts, so in production the handler never ran → `.img-fade` stayed at
  opacity 0 forever. The headless test passed because the local test server
  didn't send the CSP header.
- **Fixes:** avatar thumbs + creator result rewired via addEventListener
  (the app's convention); also killed the only other inline handler
  (`onerror="this.remove()"` on Builder preview photos — silently dead under
  CSP too). **Harness lesson, applied:** the fade test server now sends the
  production `script-src` so an inline-handler regression fails locally.

### Gallery delete no longer touches the chat (and vice versa) (2026-07-16)
- **Owner's call:** deleting from the gallery must not remove the chat copy;
  deleting from a chat must not remove the gallery copy (that half already
  worked). Confirm text was literally "Delete this from your gallery and its
  chat?" — no more.
- **Mechanics** (one stored file, reference-counted by location):
  - Gallery delete, file still shown in a chat → new `POST /api/media/unlist`
    MOVES it to `media/<uid>/chat/<file>` (service key — bucket RLS has no
    UPDATE policy; caller's own top-level prefix strictly enforced), client
    rewrites every referencing chat message to the new URL. Still counts
    against the storage cap (the file exists). `/api/gallery` filters
    `<uid>/chat/` out of the listing; the chat-scan fallbacks + picker skip
    chat-only URLs too. If the move fails, nothing is deleted (card comes
    back; a chat message is never left broken).
  - Gallery delete, nothing references it → hard delete (frees space), as before.
  - Chat delete of a chat-only file's LAST reference → hard delete (it's
    invisible everywhere by then). Same sweep when deleting a whole chat.
  - `storageWipeOwn` (account deletion) now also sweeps the `chat/` subfolder.
- **Known edge:** another device whose chat sync hasn't pulled the rewritten
  URL yet can 404 the old URL and self-heal-remove the message before syncing.
  Narrow window; accepted.

### Product scan: pictureless products fixed (2026-07-16)
- **Owner's report:** "PRODUCT IS NOT CACHING IT" — Molly's Suds product card
  saved with a name but the 📦 placeholder. Balance dropped exactly 3 credits
  → it was the AI lookup path (walled Walmart listing).
- **Why images went missing:**
  1. AI path: web_search returns TEXT — Claude's "direct image links" are
     often stale or guessed, so all candidates 403/404'd → name, no image.
  2. Normal path: only ONE extracted image was tried, and stores like Shopify
     burst-throttle (429) a second hit from the same egress right after the
     page fetch → single candidate dies, no picture.
- **Fixes (worker):** `extractProduct` now returns `images` (≤4 deduped
  candidates, priority order); shared `inlineImageDataUri()` helper retries
  once on 429/5xx (1.2s backoff); normal path walks all candidates. AI path:
  `report_product` gains `page_urls` (≤2 alternate product PAGES, brand site
  first, never the blocked store) — when every direct image link fails, the
  worker scans those pages with the normal extractor and inlines from there
  (brand sites rarely wall robots; verified mollyssuds.com serves isibiBot
  fine, image is 80KB). Prompt also tells Claude image URLs must be ones it
  actually SAW, not guessed paths.
- Owner's existing pictureless card: remove + re-run the lookup (or scan the
  brand-site link directly — free path, no wall).

### AI lookup returned the AMAZON LOGO as the product photo (2026-07-16)
- **Owner's screenshot:** Molly's Suds card wearing the Amazon smile logo.
- **Chain of failure:** the new rescue-pages path → Claude offered an
  amazon.com page (despite "never the blocked store") → Amazon 200s its
  captcha wall → extractor's og:image on that page IS the Amazon logo →
  junk filter only covered the last-resort <img> scan, not og:image → logo
  inlined as "the product".
- **Guards added (worker):** `JUNK_IMG_RE` (logo/sprite/icon/captcha/…) now
  filters EVERY candidate — extractor's og/JSON-LD list AND Claude's direct
  links; `WALL_RE` hoisted + applied to rescue pages (skip walled pages
  outright); rescue-page title must share ≥1 real word with the product
  name; hard host blocklist on rescue pages (amazon/walmart/target/bestbuy/
  costco/samsclub/homedepot/lowes) since they all wall robots; prompt now
  names those stores as forbidden page_urls.
- Unit-tested: real Shopify page keeps all 4 candidates; a mock Amazon
  captcha page yields ZERO candidates and trips WALL_RE.

### Orchestrator edited image 1 when told "image 5" + fake transparency (2026-07-16)
- **Owner caught both live.** "EDIT IMAGE 5, TRANSPARENT BACKGROUND" → the
  plan confidently described IMAGE 1's content ("the woman, white tee, cream
  jeans"), and the render came back with a fake grey CHECKERBOARD painted
  into the pixels.
- **Cause 1 (wrong image):** `directorImage()` sent the director ONLY the
  main image — with 5 attached it literally couldn't see 2-5, so any "image
  N" request got planned against image 1 while parroting the user's words.
  Fix: it now sends ALL attached images in panel order (downscaled by count:
  1024px ≤2 imgs / 640px ≤6 / 512px above, ≤14, ~12M char server cap), the
  worker labels each block "Image 1"…"Image N", and ask/compose prompts say
  to LOOK at the named one, never assume the first. Verified headless: 5
  color-coded canvases come through in exact order.
- **Cause 2 (fake transparency):** no model in the lineup can output real
  alpha (checked NBP + GPT Image 2 fal schemas — no background param;
  Gemini-family can't do alpha at all). New TRANSPARENCY LIMIT line in the
  ask + compose/edit prompts: say it's not possible, steer to a clean solid
  white (or user-picked solid) background instead.
- **Proper follow-up (not built):** fal hosts dedicated background-removal
  models (BiRefNet / rembg, ~cents) that return REAL alpha PNGs — wiring one
  as a "remove background" edit path would make this an honest yes. Needs
  the fal balance + owner's go.

### "Codes not sending" — was Sign UP with an existing account (2026-07-16)
- Owner hit Sign Up with an already-registered email → GoTrue's
  anti-enumeration returns 200 + a FAKE user (empty `identities`) and sends
  NO email → the UI went to "check your email" and nothing ever came.
- Verified the pipeline is healthy end-to-end while diagnosing: hook fires,
  send-email function 200s, Go Farther mailer up (401 unauth = alive), and a
  live /otp test invoked the function fine.
- **Fix:** `Auth.signUp` now detects the empty-identities response and throws
  "That account already exists — sign in instead." — shown on the form
  instead of the dead-end code screen. (Server keeps its anti-enumeration;
  this is client-side UX only.)
- NB the send-email hook returns 200 BEFORE the background Go Farther send
  (5s hook deadline) — a mailer failure is invisible to GoTrue by design;
  it lands in the edge function's console logs only.

### Avatars + products now follow the account (2026-07-16)
- **Owner's find:** avatars/products showed on the PC but not the laptop —
  they were localStorage-only ("stored locally for now").
- **Built:** `user_assets` table (avatars jsonb, products jsonb, updated_at;
  RLS own-row select/insert/update; FK cascade → account deletion cleans it).
  Client mirrors the memory sync: saveAvatars/saveProducts → touchAssets →
  debounced pushAssets upsert; pullAssets at boot with whole-object
  last-writer-wins. Images compacted to ≤800px JPEG q.82 before push (small
  ones and hosted URLs pass through untouched; scheme-filtered on pull) — the
  device that created an asset keeps its full-res copy until another device
  edits the collection, so worst case the OTHER device generates from an
  800px product photo.
- Headless-verified: remote row adopted at boot, local edit pushes with
  merge-duplicates, an older remote never clobbers newer local.

### 14-image edit refused by Gemini → director now sends only the images it uses (2026-07-16)
- **Owner's test:** "EDIT IMAGE 10, ADD A WHITE BACKGROUND" with 14 attached →
  the plan targeted image 10 CORRECTLY (numbering fix works), but fal 422'd:
  "Could not generate images with the given prompts and images." $0 charged,
  auto-refund worked. fal request log: "error validating the input", 2.27s.
- **Two causes addressed:**
  1. All 14 images went as inline data URIs — a huge request, and one stray
     attachment (the batch included a Messi photo — real-person content) can
     get the WHOLE render refused by Gemini even when untouched.
  2. New `useImages` field on the compose/revise tool: the director lists the
     panel numbers the prompt actually uses, in reference order; the client
     sends ONLY those (positions in the prompt refer to that selection).
     Worker safety net: >4 images or >5MB inline → stage data URIs on fal
     storage (falUpload, per-image fallback to inline) before submitting.
- Verified headless: useImages [3,1] of three attached → body carries exactly
  3rd-as-main + 1st-as-extra. Retest the 14-image edit live.

### Products feature removed entirely (2026-07-16)
- **Owner's call:** "I DONT THINK PRODUCT SHOULD A THING BRO" — the whole
  Products library is gone: the page/tab, URL scanner + AI lookup, the
  "Generate ad" flow, the Product picker source, and the Home "From product
  URL" preset (it depended on the deleted `/api/product/scan` endpoint).
- **Worker:** `/api/product/scan` route + its helper stack removed
  (extractProduct, safeFetch + SSRF guard, inlineImageDataUri, etc.).
- **Client:** all renderProducts/scan/create code out; `user_assets` sync is
  avatars-only now (`?select=avatars`); the `products` column in `user_assets`
  is orphaned but harmless. `zephyr_products_v1` stays in the wipe lists so
  account deletion / sign-out still clears the legacy key on old devices.
- **Kept on purpose:** `downscaleImage` (avatar import), QR-burn (still fires
  from any URL typed in a message — only the preset's auto-stamp of
  `chat.productUrl` is gone; old chats with a stored productUrl still burn),
  the "Product" preset CATEGORY on Home (pack shot / floating product / macro
  — those are creative presets, not the library), and the `.pr-head`/`.pr-or`/
  `.pr-manual` header CSS (the Avatar page uses that pattern). A new `avUid()`
  replaces the deleted `prUid()` for avatar IDs.

### Gallery import: device files + paste-a-link (2026-07-16)
- **Owner's ask:** "WE NEED TO ADD LIKE AN IMPORT THING IN GALLERY" + "ADD THE
  FETCH THING IN GALLERY" ("same thing we had for product" — the URL box).
- **Built (gallery header, right side):** an ⤒ Import button (device pick,
  multi-file, ≤12 per batch, image/video/audio with 8.5/29/14 MB caps) and an
  import-from-link box with the gradient → go button. Both go through the
  normal `/api/save` gates: no plan → pricing sheet client-side / 402
  server-side, GB cap enforced, magic-byte validation, free-user watermark
  path untouched.
- **Worker:** new `/api/import/fetch` — server-side fetch of the pasted URL
  (the product scanner's SSRF guard + safeFetch resurrected for it); a direct
  media link returns base64+kind, an HTML page gets one hop to its og:image /
  twitter:image / link image_src. `/api/save` gained an audio base64 branch
  (MP3/WAV/OGG/M4A by magic bytes, ≤20M chars) so audio imports work.
- **Found while wiring it: `sbToast` never existed.** Three call sites were
  guarded with `typeof sbToast === 'function'` — the storage-full avatar
  warning and friends have been silently vanishing. Defined it (bottom-center
  glass toast, 5s); import errors use it too.
- Headless-verified: 3-kind batch posts base64 per file, oversized file
  skipped with a toast, 402 stops the batch after one request, cap-0 click
  opens pricing instead of the file picker, link flow pipes fetch→save and
  clears the box, junk input never leaves the page, server errors toast.

### Import-from-link: Walmart fix + the ✦3 AI rescue (2026-07-16)
- **Owner's report:** Walmart link → "no image found on that page" ("FIX THE
  FETCH THING"), then "MAKE SURE YOU CHARGE THE 3 CREDITS PLS".
- **Why it failed:** Walmart's PerimeterX wall returns 200 with a "Robot or
  human?" page — no og:image — and the v1 fetch used a bot-ish UA with only a
  basic og/twitter regex.
- **Fixed (worker, /api/import/fetch):** Chrome UA + Accept-Language on every
  fetch; the product scanner's full extraction stack ported back as
  `pageImageCandidates` (JSON-LD any-@type → og/twitter → microdata → link
  image_src → lazy-load/srcset <img> scan), candidates tried in order with a
  429/5xx retry + page Referer; wall detection checked only AFTER extraction
  comes up empty (v1 checked first and false-positived on Wikipedia, which
  mentions "captcha" in its head scripts).
- **AI rescue (the 3 credits):** when the free path still comes up dry, the
  route auto-falls-back to the product scanner's escape hatch — Sonnet 5 +
  web_search (max 2) identifies the product/subject and returns direct CDN
  image links + up to 2 alternate open pages (brand site first, never the
  big-box walls), each tried through the SSRF guard. ✦3 charged up front,
  refunded on EVERY failure path (lookup fail, no image sticks, oversize,
  wrong type), `scanai` quota 20/day. Clean fetches still charge nothing.
  Response carries `balance`; the client repaints the credit pill. The go
  button now reads "→ ✦3" (worst-case price up front, old product-box style).
- Live-tested extraction: Wikipedia → real image (was false-walled in v1),
  Walmart + IMDb → wall detected, would route to the AI rescue. 11 unit tests
  on pageImageCandidates against the shipped code. NOT live-tested: the paid
  Claude lookup itself (real money — needs an owner test with a Walmart link).

### Gallery audio cards redesigned + scroll-lag fix (2026-07-16)
- **Owner:** "FOR THE AUDIOS … I NEED BETTER DESIGN" + "FEELS KINDA LAGGY
  SCROLLING UP AND DOWN ON THAT PAGE, WHY?"
- **Audio cards:** native `<audio controls>` rows (grey browser chrome, dead
  0:00/0:00) replaced with a custom card — pink→amber equalizer bars that
  dance while playing, gradient round play/pause, seekable progress track,
  tabular time. Playing one card pauses the rest (`buildAudioCard`, gallery
  only for now; the chat's audio messages still use the native player — ask
  before touching those).
- **The lag:** every card on the page stayed fully live — a dozen `<video>`
  elements each holding a decoder + full-res originals painting off-screen.
  Fix: `content-visibility: auto` + `contain-intrinsic-size` on `.g-item`,
  so the browser skips layout/paint/decode for cards outside the viewport.
- Headless-verified: cards render (no native controls), duration paints,
  exclusive playback, content-visibility computed 'auto'. Seek verified
  against a range-serving audio server (Playwright's route stub can't serve
  ranges — Chromium clamps seeks to 0 on it; real Supabase storage serves
  ranges fine).

### Gallery scroll lag round 2: real thumbnails (2026-07-16)
- **Owner:** still "feels slow" scrolling the gallery after content-visibility.
- **Root cause:** the grid was downloading + decoding multi-MB FULL-RES
  originals at ~300px card size (one sampled PNG: 1.6MB, 1179×2556).
- **Fix:** Supabase image transformations are ENABLED on this project
  (verified live) — grid cards now load
  `render/image/public/media/…?width=560&height=350&resize=cover&quality=75&format=webp`
  (same sampled image: 14KB, >100× lighter). Lightbox + downloads still use
  the original file. Any transform error (oversized file, plan change) falls
  back per-image to the original URL. The gallery/avatar picker grid uses the
  same thumbs for display while picking still attaches the original.
- **Billing note:** Supabase counts UNIQUE origin images transformed (cached
  variants are free after the first). Pro plan includes 100 origin
  images/month, then $5 per 1000 — trivial at current volume, keep in mind at
  scale.
- Headless-verified: grid uses render URLs, 400 → per-image fallback to the
  original, videos/data-URIs untouched, lightbox opens the original.

### GPT resolution row locks on auto ratio (2026-07-16)
- **Owner's find:** "when I switch resolutions the price doesn't change, only
  quality" — all their test shots were on `auto` ratio, where the resolution
  picker did NOTHING (no size is sent to OpenAI at auto since a pixel size
  implies a shape; billing is the 1K tier by design, owner's earlier call).
- **Fix:** the RESOLUTION row now dims + blocks clicks while ratio is `auto`,
  with a note ("On auto ratio the model picks the size — billed as 1K.
  Choose a ratio to set resolution"); it unlocks live when a concrete ratio
  is picked. The settings chip also stops showing a size at auto (was
  "auto · high · 4K" — misleading).
- Verified: lock/unlock toggles with ratio picks, price flips ✦29 (auto,
  1K tier) ↔ ✦52 (16:9 · high · 4K), summary chip drops the size at auto.
- Price audit the same session: ALL 264 GPT+Nano combos (ratio × quality ×
  size × 1-4 images) swept through estimatePrice() — every one matches the
  fal sheet; totals are ceil'd once (not per image), same as the worker
  charges.

### GPT 1K resolution removed from the picker (2026-07-16)
- **Owner:** "1K and 2K cost the same — then delete 1K." Correct read: fal
  bills GPT Image 2's 1K and 2K identically (per quality tier), so 1K was a
  strictly-worse pick. The picker is now 2K/4K with 2K the default — same as
  Nano's row.
- Client-only change; the worker still accepts '1K' from stale cached
  clients (same price), and a stale saved per-model gptSize of '1K' falls
  back to 2K on model pick. The settings chip hides the 2K default.

### GPT 'auto' ratio removed (2026-07-16, owner's call)
- "DELETE THE AUTO THING" — asked with the tradeoff spelled out (auto kept a
  source photo's shape on edits; without it a concrete ratio reframes), owner
  chose full removal. GPT's ratio picker is now 1:1 / 16:9 / 9:16 / 4:3 / 3:4,
  default 1:1; every run sends explicit dimensions and bills the real tier.
  **Edits now reframe the source to the picked ratio** — if a user complains
  about portrait photos coming back square, this is why; the fix is picking
  9:16 before editing (or revisiting an edits-keep-shape behavior).
- The auto-only machinery went with it: the resolution-row lock + note
  (lived one deploy, abe4979), and the summary-chip auto guard. A stale saved
  ratio of 'auto' falls back to 1:1; the worker still accepts 'auto' from
  stale clients. Nano keeps its 'auto' (different semantics, no billing
  quirk).

### Manual Sound on/off toggle (2026-07-16)
- **Owner (testing Veo):** "THERE'S NO OPTION TO HAVE AUDIO ON AND OFF" —
  silent renders only existed via the director inferring them from the
  user's words. Added a Sound On/Off section to the settings panel for the
  sound-capable families (SOUND_MODELS_RE = seedance | kling v3/o3 | veo —
  mirrors the worker's gate).
- Off sends `sound:false` (the existing worker path: generate_audio=false +
  the aoff billing rate where fal lists one — Veo, Seedance, Kling v3; o3
  has no discount, just silence). The manual toggle wins over the director's
  inference; the chip shows "· Silent"; per-chat composer state persists it;
  non-capable models never see the toggle and reset it to On.
- Verified: Veo Fast 8s 720p ✦150→✦100 and Veo 4k ✦600→✦400 on toggle, wire
  body carries sound:false, Sora shows no section.

### "Image to image" → "Edit image" (2026-07-16)
- Owner's call: users think in verbs. The single-slot row on GPT + Nano is
  now titled "Edit image" (video mode keeps plain "Image"); the row tooltip,
  the reference-row tooltip's either/or line, and the DIRECTOR's routing
  hint (the reference-images block in the worker) all use the same words.

### Veo's clip row renamed "Extend clip" (2026-07-16)
- Owner's call. Per-model title via #titleClip (like titleImage): /veo/ →
  "Extend clip"; every other family keeps "Video clip" — on Ray / Kling o3 /
  Gemini the same row means EDIT the clip, and on Seedance it's a motion
  reference, so a global rename would have lied there.

### Video-mode "Image" row renamed "Image to video" (2026-07-16)
- Owner's call, same naming sweep as Edit image / Extend clip. Image mode
  keeps "Edit image".

### Veo attach rows fully exclusive (2026-07-16)
- **Owner:** "the 4 of them can't be activated at the same time" — right in
  spirit, but the UI allowed staging several and the worker's routing
  silently ignored the losers (refs > extend > first/last > image).
- **Enforced, Veo only:** the clip now joins the existing image/flf/ref
  exclusivity web in BOTH directions (attach a clip → the other rows clear;
  attach anything else → the staged clip clears). Other families keep their
  legitimate combos: Ray v2v + start image/keyframes, Kling o3 edit +
  refs/elements, Seedance clip-as-reference.
- Verified headless in all directions + Ray combo intact.

### Veo extend caps fixed against the live schema (2026-07-16)
- Checked every Veo cap against fal's OpenAPI schemas: durations (4s/6s/8s),
  resolutions, ratios, ref 8s lock, extend 7s output — all matched. Two
  fixes from the sweep:
  1. Extend INPUT cap was 8s, which blocked re-extending an already-extended
     video. fal allows extending up to 30s total → input cap is now 23s
     (30 − the fixed 7s output). Billing unchanged (extends bill 7s output).
  2. New aspect pre-check on extend inputs: the schema requires a 16:9 or
     9:16 clip; a square clip used to die at fal after the wait+refund, now
     it's bounced at attach with the reason (5% tolerance for encoder
     rounding like 1920×1088).

### Exact errors surfaced to users (2026-07-16)
- **Owner:** "make sure you show users the exact error." Two paths were
  swallowing detail (the 422-rejection path already quoted fal verbatim):
  1. Submit-time failures (friendlyFail) bucketed everything into canned
     lines with the raw error console-only → now the friendly line carries
     fal's exact detail appended: … (exact error: "duration: must be one of
     4s, 6s, 8s"). Quota/balance/unknown-model lines stay clean (no useful
     upstream detail there).
  2. Mid-render FAILED/ERROR showed a generic "couldn't finish" → the client
     now fetches the failed job's response payload and quotes fal's reason:
     ⚠️ The model couldn't finish — exact error: "…" + the refund note.
- Verified headless on both paths (validation detail + a FAILED render with
  a codec error), refunds intact.

### Attached clips show a real thumbnail (2026-07-16)
- **Owner (Veo test #1):** the Extend clip slot showed a generic "🎬 clip"
  chip. Now readClipMeta captures the clip's first frame (seek → canvas →
  jpeg) after validation passes and the slot renders it full-width like the
  image slots, with a small 🎬+duration tag (duration hidden when the file
  doesn't report one — recorded webms often don't). The <video> src is
  released only after capture (it used to be cleared before, which would
  have blocked seeking). Chip stays as the placeholder while capturing.
- CSS: clip slot joined the 190px thumbnail group; its fixed 96px chip-era
  height became min-height so the card grows around the frame.

### Staged attachments survive refresh (2026-07-16, every model)
- **Owner:** "when I refresh the page it loses the attached stuff."
  stagedByChat was in-memory only (the old comment said "too big for
  localStorage" — a clip data URI can be 25MB+).
- **Built:** each chat's staged snapshot mirrors into IndexedDB
  (zephyr_staged_v1): written debounced 400ms from a one-time wrap around
  the attach renderers (renderAttach/ExtraImages/RefList/ElList/KfList/
  MaskState — so every attach, clear, exclusivity eviction, and thumbnail
  capture persists), hydrated at boot (enterApp) and on chat switch, row
  deleted when a send consumes the inputs / the chat is deleted / snapshot
  empties, whole DB cleared on sign-out and account-switch wipes.
- Covers ALL slots: image/avatar/audio/clip (incl. the new thumbnail +
  clipMeta), first/last, refs, elements, keyframes, inpaint mask, extras,
  and the audio waveform state.
- Verified headless: stage → reload → restored (counter intact); clear →
  reload → stays empty.

### Staged stashes expire after 7 days + boot GC (2026-07-16)
- Follow-up hardening on the refresh persistence (owner's go-ahead): every
  persisted stash is timestamped; hydrate refuses (and deletes) anything
  older than 7 days so a weeks-old forgotten photo can never silently ride
  along on — and re-route — a fresh send. A boot sweep also garbage-collects
  expired rows and rows whose chat no longer exists, so forgotten 25MB clips
  don't sit in the browser forever.

### Wordmark → back to the landing page (2026-07-16)
- Owner's ask: the top-left isibi logo now returns to the marketing landing
  in its signed-in form (goLanding → enterLandingAuthed + showMarketing):
  profile pill stays live top-right, the landing chatbox re-enters the
  studio, and the app keeps all its state behind the inert shell (verified:
  staged refs survive the round-trip). Previously the logo just went to the
  Builder view.

### Landing loops resume on wordmark return (2026-07-16)
- Owner: "the moving frames are not moving" when returning via the logo — the
  browser pauses the landing's autoplay video loops while it's hidden and
  never resumes them (only a fresh load autoplays). showMarketing now
  re-kicks any paused video in the landing on every show. Same page as
  always — it just looked like a new static one because of the frozen loops.

## ═══ SESSION RECAP: image-model testing → Veo testing (2026-07-16/17) ═══
One-place index of the stretch from the GPT/Nano settings testing through
the Veo live-test prep. Detailed entries for each item are above; commit
hashes for archaeology.

**Image models (GPT Image 2 + Nano Banana Pro):**
- Price audit: owner's 8 Nano + GPT screenshots verified, then ALL 264
  ratio×quality×size×count combos swept through estimatePrice() — all match
  fal's sheet; totals ceil'd once, same as the worker charges. (no code)
- GPT resolution row locked while ratio=auto with a note (abe4979) — then
  superseded by the next two:
- 1K deleted from the GPT picker (fal bills 1K/2K identically → strictly
  worse; 2K default now) (bffc52c)
- 'auto' ratio deleted from GPT (asked with the edits-reframe tradeoff
  spelled out; picker is 1:1/16:9/9:16/4:3/3:4, default 1:1; every run
  sends explicit dims and bills the real tier) (fdad16f)
- Charge audit: worker's real creditCost extracted and compared to the UI
  quote on all 120 GPT combos + a captured wire body — identical; tamper
  edges (bad quality/size/num, stale auto) all fail safe. (no code)
- Renamed "Image to image" → "Edit image" (row, tooltips, director wording)
  (03c68ca)

**Veo 3.1 + 3.1 Fast prep:**
- Full price table built + verified against fal's LIVE pages (720p/1080p
  same bracket, 4k up; audio-off discounts; margins: ~36% membership /
  ~43% top-up per credit after the $0.008 fal basis). All 216 UI combos
  (model×ratio×res×dur×sound×path incl. the 8s ref lock and 7s extend
  lock) match the worker's charge. (no code)
- Manual Sound On/Off toggle for Veo/Seedance/Kling v3+o3 — Off bills fal's
  audio-off rate, chip shows "Silent", manual beats director (08ee13d)
- "Extend clip" rename (Veo only — Ray/o3/Gemini keep "Video clip", theirs
  means edit) (353917c); "Image to video" rename in video mode (6368eaa)
- Veo's 4 attach rows made strictly mutually exclusive, both directions;
  other families keep their real combos (3686612)
- Extend caps fixed vs the live OpenAPI schema: input cap 8s→23s (chained
  extends up to fal's 30s ceiling now work), plus an instant 16:9|9:16
  aspect pre-check at attach (1597313)
- Exact fal errors now shown to users on EVERY failure path (submit-time,
  mid-render FAILED, 422 rejects) with refund notes (8fcf044)

**In-app fixes found while testing:**
- Clip attach slot shows the video's real first frame + duration tag
  instead of a generic chip (18240ce)
- Staged attachments survive page refresh — IndexedDB per chat, all slots
  on all models (2c93346); hardened with 7-day expiry + boot GC so a stale
  stash never ambushes a send and clips don't hoard disk (93d97cf)
- Wordmark → the signed-in landing page (same page as post-signin, no new
  page) (6c6ecd6); landing's autoplay loops resume on return (62578e6)

**Live Veo tests:** A1 exclusivity ✓ · A2 square-clip aspect bounce ✓ ·
next: A3 free price-flips, then B4 (first paid run, ✦50) onward per the
checklist in the chat.

### Veo duration picker locks on fixed-length runs (2026-07-17)
- **Owner (test A3):** with a reference attached the duration snapped to 8s
  but the picker still let you choose other seconds while the price
  (rightly) never moved — billing was already fixed at 8s on both sides,
  the picker was just lying. Same latent issue on extend (+7s fixed).
- **Fix:** with refs or an extend clip staged on Veo the Duration chips dim
  + go inert with a note ("Reference runs always render 8s…" / "Extending
  always adds 7s…"); refs snap the value to 8s, extend's summary chip reads
  "+7s"; clicks are ignored while locked (pickSetting guard). Unlocks the
  moment the attachment clears; synced from updateSendPrice so every
  attach/model change re-evaluates. Seedance refs stay unlocked (no fixed
  length there).

### @Image chips become a mention picker (2026-07-17)
- **Owner:** the @Image1 chip bar auto-appeared in the composer the moment a
  reference was attached — "don't make it appear… only when I go @".
- Now it's mention-style: hidden by default; typing an @token in the prompt
  (input/keyup/click/focus all re-evaluate the caret) pops the staged
  refs/elements/@Video1 as chips; clicking one REPLACES the partial "@im…"
  with the full tag plus a trailing space (which also closes the picker);
  typing @ again reopens it. The @ImageN badges on the attach-panel
  thumbnails stay — they're how you know which number is which.

### fal balance pre-flight + honest queue status (2026-07-17)
- **Found live by the owner:** fal balance went NEGATIVE mid-testing; fal
  still ACCEPTED the image-to-video job and left it queued forever — the
  user gets charged isibi credits for a render that never runs.
- **Worker:** new falBalanceUSD() (official Platform API: GET
  api.fal.ai/v1/account/billing, cached 60s/isolate). Every generation
  submit now pre-flights it: balance < $0.50 → 503 "generations are briefly
  paused… (you were not charged)" BEFORE any charge. Fails open on unknown
  (endpoint down or FAL_KEY not admin-scoped) so monitoring can never block
  paying users. NOTE: if FAL_KEY lacks billing scope the gate silently does
  nothing — verify while the balance is negative: a submit should bounce
  instantly with the paused message; if it queues instead, mint an
  admin-scoped key.
- **Client:** friendlyFail maps the 503 to a clean no-charge message, and a
  job stuck IN_QUEUE >2.5min swaps the eternal "#0…" for an honest "Still
  queued on fal — unusually backed up… you'll see the exact error and get
  your credits back."
- The stuck job from the discovery: it stays resumable (boot-resume record);
  once fal is topped up it should finish and deliver, or fail with the
  exact error + refund.

### Balance-gate message reworded (2026-07-17)
- Owner's wording call: the pre-flight refusal now reads "Our generation
  servers are temporarily down — we're working on it. Check back soon; you
  were not charged." (server + client matched; old "briefly paused" text
  still recognized by the client for cache-skew).

### Error-message audit + no more silent render loss (2026-07-17)
- Full sweep of every user-facing failure message (catalog in the chat log).
  One red finding fixed immediately, per the owner's "renders can't get
  paused": boot-resume used to DROP a job record after 4 failed re-attach
  attempts — a paid render vanishing silently. finishDeadJob now resolves
  terminally: fal says COMPLETED → delivery retried each boot until it
  lands; otherwise → requestRefund (server re-verifies with fal) + a chat
  message with the refund amount, or an apology when fal actually ran it.
- Clarified: fal never pauses renders — "paused" was only ever our tab's
  polling; this closes the one path where re-attaching gave up.
- Remaining smaller gaps (queued): refund-failure goes unmentioned in the
  failure message; voice-preview errors are silent; gallery-delete failures
  silently restore the card; sync failures have no persistent-breakage
  signal; avatar-gen timeout path unverified; attach errors mix alert()/
  chat/toast styles.

### fal never appears in user-facing text (2026-07-17, owner's rule)
- Standing rule going forward: users must never learn we run on fal.
- Rewrote the six messages that named it (render no longer available /
  keeps going "on our servers" / still queued / timed out / "The model
  rejected this render" / balance-exhausted now reads as the servers-down
  notice), and every quoted exact-error is scrubbed first: provider URLs
  removed, standalone fal tokens → "the render service" (word-boundary
  safe — false/falcon survive).
- Known residual (not user-visible in the UI, only devtools): the network
  tab shows queue.fal.run inside /api/video/poll?url=… params. Hiding that
  needs worker-side request-id mapping — flagged as optional hardening.

### Safari blank video cards fixed (2026-07-17)
- **Owner:** some gallery items only render when the mouse passes over them.
  Cause: Safari doesn't PAINT a metadata-loaded video's first frame until a
  decode is forced — our hover-play was the force, so poster-less video
  cards sat blank until hover. Images were fine (thumbnails).
- Fix: on loadedmetadata, seek 1ms in (the standard Safari nudge) — forces
  the first frame to paint without playing. Applied to gallery cards
  (poster-less only) and chat-thread players. Note: headless verify clamps
  the seek to 0 because route stubs can't serve byte ranges — real storage
  does (proved earlier with the audio-card seek against a range server).

## 📋 AUDIT LIST (owner-flagged, DO LATER — not yet built)
- ~~Attach pickers must ALL offer both sources~~ — ✅ BUILT 2026-07-17 (see
  entry below). Original note: in video mode
  the pickers (Reference to video, Extend clip, First & last frame, image
  slot, characters/keyframes…) go STRAIGHT to the device file dialog — no
  "isibi gallery / Your device" source menu like image mode's Edit-image/
  Reference rows have (openImgSrc). Owner: "make sure for every picker it
  asks for both — check every single model." Sweep EVERY attach slot on
  EVERY model (13 video + 2 image + audio): each should open the source
  chooser (gallery + device; avatar where it makes sense; kind-filtered —
  video slots list gallery VIDEOS, audio slots gallery audio). Videos in
  the gallery picker will need video thumbnails in the grid.
- (Also queued from the error-message audit: refund-failure unmentioned;
  voice-preview fails silent; gallery-delete failure silently restores the
  card; persistent sync breakage has no signal; avatar-gen timeout path
  unverified; attach errors mix alert()/chat/toast styles.)

### AI error-explainer leaked fal (2026-07-17, caught live by the owner)
- The orchestrator's error step wrote "You've hit your balance limit on Fal
  — head to fal.ai/dashboard/billing…" straight into a user chat. The
  provider scrub covered canned messages + quoted errors but not the
  AI-written explanation.
- Fixed both ends: the error step's system prompt now forbids naming any
  backend provider or pointing to external dashboards (balance problems =
  "generations are briefly paused, check back soon"), AND the client scrubs
  the explainer's reply through scrubProvider before display.
- Context of the failure itself: a submit was rejected for balance right
  after the top-up — if it recurs with balance present, check fal's
  dashboard for a separate SPENDING-LIMIT setting.

### Video references: director now sees (and uses) ALL of them (2026-07-17)
- **Owner's E11 test:** 3 refs attached on Veo Fast, open prompt → the
  composed prompt described ONLY the truck. Cause: in video mode
  directorImage() sent just refList[0] (the "start image" slot logic), so
  the director literally couldn't see refs 2-3; all 3 still went to fal but
  a prompt that never cites a ref gives it ~no influence.
- **Fix (mirrors the image-mode default-to-all rule):**
  - Client: reference runs send EVERY ref (≤9, downscaled) + imageCount.
  - Worker: imageCount accepted for video; new video multiImgLine — labels
    Image 1..N, LOOK at each, write ONE scene citing @Image1…@ImageN, USE
    EVERY reference unless the user's own words exclude one; ask-step +
    context lines updated (no more "a start image" claim on ref runs).
  - Existing plumbing handles the rest: @ImageN tags bind natively on
    Seedance/Kling o3 and translate to "reference image N" for Veo.
- Verified headless: compose wire carries images[3] + imageCount 3, kind
  video. Owner should re-run the 3-ref test live after deploy.

### Universal source chooser on every attach slot (2026-07-17)
- **Owner (hit it live during Veo testing):** video-mode pickers went
  straight to the device dialog. Now EVERY media slot (image-to-video,
  end frame, first/last, references, characters, keyframes, extend clip,
  audio — every model) opens the source menu: isibi gallery + Your device,
  with Avatar added on image slots when avatars exist.
- Kind-aware library: the clip slot lists gallery VIDEOS (video tiles with
  the first-frame nudge), audio slots list gallery AUDIO (♪ tiles), image
  slots the image thumbnails. Multi-slots (refs/characters/keyframes) get
  the multi-select Add bar capped at the remaining room.
- A gallery pick is fetched into a File and pushed through the SAME hidden-
  input change path as a device pick — so every existing validation (size
  caps, magic bytes, Veo exclusivity, clip thumbnail + fps conform, billing
  measurement) applies identically. Gallery-header ⤒ Import stays a direct
  dialog on purpose.
- Verified headless: ref slot multi-picks 2 gallery images through the full
  conform pipeline; clip slot lists video tiles; menus per slot correct.

### Platform errors can no longer be blamed on the user (2026-07-17)
- **Owner's screenshot:** a render failed and the chat said "Your account
  has run out of credits" — while the owner had ✦867. The raw failure was
  the render provider's OWN balance lock (see below); the AI error-explainer
  saw the word "balance" and invented a story about the USER's credits.
- **Fix, two layers:**
  - chat.js: known platform-side errors (briefly paused / servers
    temporarily down / exhausted balance / user is locked) now BYPASS the
    AI explainer entirely and get the deterministic friendlyFail message
    ("our render servers…", never "your account").
  - worker.js error-step prompt: explicitly forbidden from claiming the
    user's account/credits/balance ran out unless the raw error literally
    says "not enough credits" — platform balance problems are OUR
    infrastructure, not the user's.
- **Root cause of the failure itself (owner asked "I have $8 in fal, so
  what happened?"):** the provider LOCKS an account whose balance goes
  negative, and there's a KNOWN BUG where the lock doesn't always auto-clear
  after topping back up (fal-ai/fal issue #922 — "Account locked despite
  positive balance"). Our balance went negative during testing, was
  recharged to $8, but the lock lingered and a submit bounced with
  "User is locked. Reason: Exhausted balance." It usually clears on its
  own shortly; if it sticks, fal support has to release it manually.
- Verified headless: platform-flavored job errors never call /api/direct
  (explainer skipped), the delivered chat message is the canned
  servers-down text with no provider name.

### Director flow survives chat switches (2026-07-17)
- **Owner hit it live:** attached a clip for extend, orchestrator started
  "writing the prompt", they switched chats — and the flow died silently.
  Every stage of the director pipeline had a "user left, stop here" guard
  that THREW AWAY the finished work.
- **Fix:** the pipeline snapshots the origin chat's composer state (kind,
  attachments, context, last prompt) before its first AI call and keeps
  going in the background on that snapshot. If the user is still away when
  the prompt is finished, it's persisted into the ORIGIN chat as an
  approval card — switching back shows it priced and ready to run. This
  applies in BOTH Plan and Auto mode: Auto deliberately does NOT fire a
  billed generation while another chat's composer state is live on screen;
  the card is the safe landing.
- Typing indicators only ever show in the origin thread; nothing pops into
  the chat the user switched to. Rerun/revise follow-ups still require
  staying on the chat (they anchor to its live last-prompt).
- Verified headless both ways: switch-away mid-compose → review card
  persisted + renders on return, no generation fired, other chat clean;
  stay-put in Auto → generates immediately as before.

### Chatbox settings are authoritative — director's sound override removed (2026-07-17)
- **Owner rule (stated while planning the G14 test):** "the orchestrator has
  no power to change anything that's set on the chatbox." Generations run
  with exactly what the chatbox shows — sound toggle, duration, resolution,
  ratio — the director's words never silently change a setting (or a price).
- Sound was the ONE chatbox setting the director could override (an
  earlier design: "make it silent" in words → extras.sound=false → cheaper
  render without touching the toggle). Removed on all three layers:
  client ignores a director sound flag (sanitizeExtras strips it, including
  from review cards saved before the rule), the gen request only ever
  carries the toggle's value, and the worker's write_prompt tool no longer
  even offers the model a sound field.
- Instead the ASK step now tells the user: silent video = flip the Sound
  switch in the settings (and that it costs less) — then proceeds with the
  creative request. The director advises about settings; it never drives them.
- Everything else in extras stays director-drivable on purpose — negative
  prompt, Kling cfg/auto-cuts, Seedance bitrate, Ray controls, voice
  delivery — none of those have chatbox controls and all are price-neutral.
- Verified headless: compose returning sound:false → price quote unchanged
  and job body carries no sound flag (toggle on) / sound:false (toggle off).

### Content-filter rejections: auto-reword offer + filter-aware composer (2026-07-17)
- **Owner's 4 AM tentacle saga:** Veo 422'd the "guy with tentacles falls"
  extend three times, even after the composer softened the wording. Two
  real gaps + one hard lesson:
  - Gap 1: the auto-reword (error step's fixedPrompt) only ran on SUBMIT
    failures — a rejection on the poll/result path (where content-filter
    422s actually land) showed the canned message and stopped. Now those
    paths call offerReword(): after the deterministic message (exact error
    + refund, unchanged), the director quietly rewords the prompt and an
    approval card lands in the origin chat — "approve to try again".
    Applied on both the FAILED-status and 4xx-result paths, video+image,
    only when the error is content-filter-flavored.
  - Gap 2: the COMPOSER was writing filter-bait ("grotesque… wet, slimy…
    grafted"). The video prompt-writer now has a craft rule: strict content
    checkers reject whole renders on trigger words — phrase visceral/impact
    ideas neutrally or comedically.
  - The lesson: on an EXTEND, the checker also scans the SOURCE CLIP's
    frames. The tentacle-man clip itself is what kept tripping it — no
    wording passes. That's a provider-side hard block, not an app bug;
    the refunds fired correctly every time (3 × ✦132 back).
- Verified headless: 422-with-checker-detail on the result path → exact-
  error message + refund note, then the reword lead-in + approval card
  (persisted + rendered), error step called once.

### Extends get their own continuation writer (2026-07-17)
- **Owner's screenshot:** an approved extend prompt re-narrated the ENTIRE
  source clip (the tentacle grafting, the slide, the landing — all footage
  that already exists) and closed with "for the 8s clip" on a +7s extend.
  Result quality was "a little buggy" — re-describing makes the model try
  to REPLAY events that already happened, which is exactly what glitchy,
  morphing extensions look like.
- Cause: the worker had no extend writer — a Veo clip attach fell into the
  video-to-video EDIT branch (restyle language, "state the change to the
  footage"), and the ask/context lines called it an edit with
  "clip length: 8s" from the duration picker.
- Fix (worker, new `veoExtend` split alongside `clipIsSeedanceRef`):
  - Dedicated continuation-writer compose branch: describe ONLY the new 7
    seconds, open from the final frame's exact state, 1-2 new beats, same
    tone/camera/style unless the user changes them, never re-narrate the
    clip, never state a total length; content-checker-safe phrasing.
  - Context lines: "this run EXTENDS the attached clip by a fixed 7
    seconds" replaces "clip length: Ns"; ask step describes the clip as an
    extend (+7s), not an edit; revise's overstuffed-fix says "7s extension".
- Kling o3 / Ray clip edits keep the edit writer; Seedance @Video1 keeps
  the reference writer — this only splits Veo extends out.

### Veo 3.1 Lite added (2026-07-17)
- Owner spotted fal's new budget tier and asked for it. Third Veo variant in
  the group flyout: "Veo 3.1 Lite · Google · cheapest · audio".
- Schema-verified: ONLY t2v + i2v endpoints (no extend / first-&-last /
  reference rows), 4/6/8s, 720p/1080p (no 4k), 16:9|9:16, generate_audio.
- Pricing (verified verbatim on fal's page): 720p $0.05/s sound · $0.03
  silent; 1080p $0.08/s · $0.05 silent. UNLIKE Standard/Fast, 1080p costs
  more than 720p — the resolution picker moves the price on this tier.
  Credits at 8s: ✦50 (720p) / ✦30 silent / ✦80 (1080p) / ✦50 silent.
- Verified headless: in the Veo flyout, all four price points, res list has
  no 4k, only the Image-to-video attach row renders. Untested live (pennies
  when the owner wants: one ✦50 t2v).

### fal-balance probe + admin key (2026-07-17, the "plenty of money" mystery)
- The 4:48 AM refusal investigation, concluded: the worker's FAL_KEY was
  API-scoped and could NOT read billing (probe returned null) — so the
  low-balance guard had never fired (fails open on null by design), and the
  502s were fal REJECTING submits at the door with money visible ($4.95) —
  fal's lock-flap bug (fal-ai/fal#922), same as yesterday.
- Owner created an ADMIN-scoped key and updated the FAL_KEY GitHub secret;
  after redeploy the probe reads the live balance (usd 4.95, guard armed).
- New owner-only endpoint GET /api/fal-balance (allowlisted to the owner's
  two emails), cache-busted, returns {usd, note}. Console one-liner:
  await (await apiFetch('/api/fal-balance')).json()
- If the lock-flap recurs with balance present: fal support ticket, or a
  small $1-5 top-up often re-triggers the unlock.

### Veo Lite: first-&-last row added (2026-07-17)
- Owner swept fal's Veo catalog (13 endpoints) against ours right after the
  Lite launch and caught the one gap: veo3.1/lite/first-last-frame-to-video
  exists (fal's docs search had hidden it). caps.flf flipped on — rows,
  exclusivity and the worker's generic endpoint build all apply unchanged.
  Lite still genuinely lacks extend + reference. Verified headless: Lite
  shows exactly Image-to-video + First & last frame rows.

### Ray 3.2 catalog sweep: Reframe wired + keyframes cleared + 30s clip cap (2026-07-17)
- Owner swept fal's Ray catalog (4 endpoints). t2v/i2v/v2v were wired;
  **Reframe** (generative outpaint to a NEW aspect ratio) was missing — now
  built with zero new UI: attach a clip on Ray, pick a DIFFERENT ratio in
  settings → the run routes to .../reframe; keep the clip's own ratio →
  plain v2v edit as before. On clip attach the ratio picker SNAPS to the
  clip's native aspect, so reframe is always an explicit user choice
  (chatbox-is-boss rule); a ratio-section note explains the switch, and
  the duration picker locks (reframe keeps the source length).
- Pricing (verified on fal's page; billed per started SOURCE second, 30s
  schema cap): 540p $0.06/s · 720p $0.12/s · 1080p $0.36/s → r2s tier in
  both price tables; worker bills from its own byte-measured clip length
  (tamper-proof), no HDR billing on reframe. Ray clips now cap at 30s on
  attach (reframe's schema limit; v2v documents none).
- Director: reframe runs get a dedicated rule — describe ONLY what fills
  the newly revealed canvas, never edits to the footage.
- The owner's "keyframes not wired" report checked out fine headless: the
  + opens the gallery/device chooser on-screen and keyframes ride the body
  → worker → fal i2v with spaced indexes (stale tab suspected).
- Verified headless end-to-end: native ratio → v2v ✦135; flip to 9:16 →
  reframe ✦45 (3s clip · 720p), duration locked, note shown, body carries
  reframe:true + ratio. Live test pending (needs fal balance).

### OmniHuman removed (2026-07-17, owner's call)
- Both tiers (1.0 + 1.5) pulled everywhere: model picker + group flyout,
  MODEL_OPTS, audio caps, both price tables, worker allowlist,
  PROMPTLESS_VIDEO, and the portrait+voice endpoint branch. Kling LipSync
  keeps the entire audio-length billing pipeline (byte-measured, ≤30s) —
  only the omnihuman half of its gate was dropped. The generic audioPerSec
  price mechanism stays (unused) for the next audio-billed model.
- A user whose saved composer still points at OmniHuman degrades safely:
  no rows, no price, and a send answers "that model isn't available — pick
  another from the menu."
- Verified headless: 13 video models listed (no OmniHuman anywhere), no
  page errors, LipSync rows intact (clip + audio).

### Catalog sweeps: Seedance ✓ 9/9 · Gemini has a missing endpoint (2026-07-17)
- Seedance: all 9 fal endpoints covered (t2v/i2v/reference × Std/Fast/Mini).
  CAPABILITY gap inside reference: fal takes up to 3 VIDEO refs + 3 AUDIO
  refs; we wire one @Video1 + one audio. Multi video/audio refs = UI (list
  slots) + @VideoN/@AudioN tags + billing basis for multiple clips — noted
  for the owner to green-light, not built.
- Gemini Omni Flash: t2v/i2v/edit wired; **reference-to-video MISSING**
  (schema: prompt + image_urls, inline <IMAGE_REF_0> role tags, 16:9|9:16,
  3-10s; pricing not on the API page — needs the model page check before
  wiring).

### Gemini Omni Flash reference-to-video wired (2026-07-17)
- The missing 4th Gemini endpoint (owner's catalog sweep). References row
  (≤6 — fal documents no cap; ours) with @ImageN badges; the worker
  translates our 1-based @ImageN into Gemini's NATIVE 0-based <IMAGE_REF_N>
  tags (dangling/off-modality tags dropped), and untagged raw prompts get
  every ref cited automatically. Despite the catalog copy, the schema takes
  image refs ONLY (no video/audio params — verified 2026-07-17).
- Pricing: same ~$0.13/s def rate as Gemini t2v (verified on the model
  page) — the existing price entry covers it, ✦130 at 8s.
- Clip ↔ refs are mutually exclusive on Gemini (its edit endpoint takes no
  refs, its ref endpoint no clip) — same both-directions clearing as Veo.
- Verified headless: row 0/6, price, exclusivity both ways, tag badges,
  body carries refs; worker branch mirrors Veo/Kling-o3 routing.

### Seedance multi video/audio references (@Video1-3 / @Audio1-3) (2026-07-17)
- Owner green-lit closing the capability gap from the catalog sweep. Slot #1
  stays the normal clip/audio attach (ALL existing validation untouched);
  Seedance-only "+" tiles add up to 2 more of each, enforcing fal's caps at
  attach: videos MP4/MOV, each ~480-720p area band, combined 2-15s, ≤50MB
  total; audios combined ≤15s, ≤15MB per file. Extras aren't auto-downscaled
  (slot #1 is) — out-of-band ones bounce with the fix instructions.
- Chips: typing @ offers @Video1..N and (new) @Audio1..N; tags reconcile in
  the worker as before (dangling ones dropped, raw prompts get all @VideoN
  cited). Director context announces the counts so composed prompts cite
  every reference.
- Billing: the 0.6× (input + output) seconds basis now uses the COMBINED
  byte-measured input seconds, server-side; ANY unmeasurable clip → the 15s
  never-undercharge max. Worker validates combined size/duration (400s),
  stages each extra on fal storage.
- Persistence: extras ride the per-chat staged snapshots (memory + the
  refresh-proof IndexedDB mirror) and clear when slot #1 drops or the model
  switches away from Seedance.
- Verified headless end-to-end (real files through the real file inputs);
  the combined-duration bounce branch is code-reviewed but its headless run
  hit webm metadata flakiness — worth one live poke when convenient.

### Ray 3.2 removed (2026-07-17, owner's call: "overrated")
- Pulled from the picker, MODEL_OPTS, CLIP_LIMITS, both price tables, and
  the worker allowlist. The "Floating product" landing example re-stamped
  onto Seedance 2.0. A stale saved Ray selection degrades to the
  unknown-model message like OmniHuman's did.
- What went with it (noted before removal, owner confirmed anyway): the
  Reframe outpaint built this morning, the cheapest i2v tier in the app,
  keyframes (≤64), HDR/EXR, per-signal edit controls.
- Ray-only machinery (keyframes row + lists, HDR/loop pickers, edit dial,
  reframe helpers, worker isRay routing/billing) left DORMANT in code —
  unreachable behind the allowlist / caps, flagged with comments — so a
  future Ray/Luma return is a re-wire, not a rebuild. The kf/vx staged-
  snapshot fields stay tolerated in restoreStaged.
- Verified headless: 12 video models, no Ray anywhere user-facing, stale
  selection safe, LipSync rows intact, no page errors.

### Lite first-&-last 422 + NEW VERIFICATION STANDARD (2026-07-17)
- **Owner hit it live (and rightly called it out):** a 4s first-&-last run
  on Lite bounced twice with 422 "duration: Input should be '8s'" (refunds
  fired correctly both times). Root cause: fal's DOCS pages list a 4s/6s/8s
  duration enum for endpoints where the LIVE validation disagrees.
- **New standard (owner's rule: "check fal first, detail by detail"):**
  endpoints are verified against fal's machine OpenAPI schema
  (fal.ai/api/openapi/queue/openapi.json?endpoint_id=…) — the same source
  their live validation runs on — never just the rendered docs page.
- Machine-schema audit of everything shipped today:
  - Lite t2v: duration enum 4s/6s/8s ✓ (all free)
  - Lite i2v: duration enum 4s/6s/8s ✓ (all free — first fix over-locked
    it; corrected)
  - Lite first-&-last: duration CONST "8s" → picker locks to 8s (the veo
    ref-lock mechanism, note included), worker forces "8s" and bills 8.
  - Gemini reference-to-video: image_urls REQUIRED, maxItems 10 → our cap
    raised 6→10 (was a guess); prompt cap 20k matches.
  - Seedance reference (all 3 tiers): video_urls/audio_urls arrays
    confirmed; our 3/3/9 caps and Mini's no-bitrate/no-1080p handling all
    match the machine schema.
- Verified headless: Lite t2v/i2v free at 4s (✦25), flf locked (✦50, note,
  snap), Gemini cap 10.

### Full machine-schema audit: all 33 endpoints, one billing fix (2026-07-17)
- Following the Lite flf lesson, every wired endpoint (Veo Std/Fast/Lite ×
  their sub-endpoints, Seedance ×6, Kling ×12, Gemini ×3, LipSync ×2) was
  pulled from fal's OpenAPI and compared field-by-field against our
  pickers, forces and billing.
- CLEAN: everything except one finding. Notably Std/Fast first-&-last are
  genuinely 4s/6s/8s-free (only Lite's is const 8s); Seedance's 4s minimum
  matches our picker; Kling o3's audio-off default, missing i2v aspect, and
  3-15s enums all match; both reference endpoints are const 8s (already
  forced); LipSync's required fields match.
- FIXED — extend overbilling at 4k: Veo extend-video (Std + Fast) has
  resolution CONST 720p (output is always 720p; we never sent resolution —
  correct) but billing used the PICKED tier: 4k selected + extend charged
  ✦525 for a $2.80 render. Both quote and charge now use the 720p tier on
  extends regardless of the picker.

### Tiered Veo picker rows (owner's reference design, 2026-07-17)
- Owner sent a reference screenshot: per-variant rows with the provider
  logo, a gold max-resolution badge (monitor icon + 4K/1080p) and a colored
  tier pill — PREMIUM (purple) / CLASSIC (blue) / BASIC (teal), check on
  the active pick. Built as a `tier` field on MODEL_LISTS entries: tiered
  rows swap their note-tags and generic chips for the badge pair; untiered
  rows render exactly as before. Applied to the three Veo variants; any
  family can adopt it by adding tier fields.

### Tier design extended: multicolor Google G + Seedance tiers (2026-07-17)
- Owner's follow-up references: the Veo rows now use Google's official
  multicolor G (logos/google.svg was a white mono glyph), and Seedance got
  the same tier treatment — Standard PREMIUM 4K · Fast CLASSIC 720p ·
  Mini BASIC 720p. Res badges derive from each model's real caps.

### Picker polish round (2026-07-17)
- Active-variant chips removed from all three grouped rows (Veo/Seedance/
  Kling) — owner's call; the flyout ✓ carries the selection.
- LATER (owner: "i will do kling and gemini later"): tier badges for the
  Kling five and Gemini — waiting on the owner's tier labels; one-line
  `tier:` field per entry when they come.

### Extend locks the resolution picker to 720p (2026-07-17)
- Owner caught the UI half of the extend-resolution finding: billing was
  fixed to the 720p tier this morning but the picker still offered
  1080p/4k on extend runs. With a clip attached on Veo the resolution
  section now locks to 720p (snap + note, same mechanism as the duration
  lock), and unlocks when the clip is removed.

### LATER — Seedance price re-verification (owner, 2026-07-17)
- fal's Seedance endpoint pages don't show cost cards, so today's money
  sweep couldn't cross-check the family the way Veo was checked. Our
  stored rates (per second, no audio discount): Std 480p $0.14 · 720p
  $0.304 · 1080p $0.682 · 4k $1.59; Fast $0.135/$0.242; Mini
  $0.0725/$0.155; video-ref runs 0.6× rate × (combined input + output
  seconds). These predate the machine-schema standard — when fal surfaces
  pricing (pricing page, or one cheap live run checked against the fal
  dashboard charge), reconcile against these numbers.
- Also open from the Veo sweep: whether Fast REFERENCE at 4k bills the 4k
  tier (Std's card says yes for Std; Fast's card is written flat). We
  charge the 4k tier — house-safe; one live 4k Fast ref settles it.

### Veo money audit COMPLETE — owner-verified (2026-07-17)
- The owner walked every fal cost card across all 13 Veo endpoints
  (Std/Fast/Lite × t2v, i2v, first-&-last, reference, extend where they
  exist) against our quotes: every one matches to the credit, including
  the 8s locks (references, Lite flf), the 7s/720p extend consts, and
  Lite's resolution-dependent pricing. Also confirmed: fal's docs cite
  impossible example durations ("5 second video") on enums that don't
  include 5s — schema remains the only trustworthy source.
- Open niche question stands: Fast reference at 4k (tier vs flat billing).

### Veo expected-credits reference (owner: front-end check pending)
The owner will verify these on the frontend later — every combo the app
should quote AND charge:

Veo 3.1 (Standard) — t2v / i2v / first-&-last (4s · 6s · 8s):
  720p/1080p sound  ✦200 · ✦300 · ✦400
  720p/1080p silent ✦100 · ✦150 · ✦200
  4K sound          ✦300 · ✦450 · ✦600
  4K silent         ✦150 · ✦225 · ✦300
  Reference (8s lock): ✦400 / ✦200 · 4K ✦600 / ✦400
  Extend (+7s, 720p pin): ✦350 / ✦175

Veo 3.1 Fast — t2v / i2v / first-&-last (4s · 6s · 8s):
  720p/1080p sound  ✦75 · ✦113 · ✦150
  720p/1080p silent ✦50 · ✦75  · ✦100
  4K sound          ✦175 · ✦263 · ✦350
  4K silent         ✦150 · ✦225 · ✦300
  Reference (8s lock): ✦150 / ✦100 · 4K ✦350 / ✦300 (tier-vs-flat open)
  Extend (+7s, 720p pin): ✦132 / ✦88

Veo 3.1 Lite — t2v / i2v (4s · 6s · 8s):
  720p sound  ✦25 · ✦38 · ✦50     720p silent  ✦15 · ✦23 · ✦30
  1080p sound ✦40 · ✦60 · ✦80     1080p silent ✦25 · ✦38 · ✦50
  First-&-last (8s lock): 720p ✦50 / ✦30 · 1080p ✦80 / ✦50
  (No reference / extend / 4K on Lite.)

Fractional-looking cells are correct ceilings (✦113 = $0.90, ✦263 =
$2.10, ✦38 = $0.30, ✦23 = $0.18) — rounding is always up.

### First-&-last merged into the Image-to-video row (owner's design, 2026-07-17)
- Owner (after seeing fal's Seedance form): ONE "Image to video" row with
  the start slot + an optional "End frame · optional" slot, replacing the
  separate First-&-last row — applied across every video model that had
  both (Veo ×3, Seedance ×3, Kling ×4). Row header counts n/2.
- Zero rewiring risk by design: the slots are a re-skin over the proven
  ffirst/flast machinery. Filling the end slot silently converts
  image→ffirst (+flast); removing the end demotes back to a plain start;
  clearing the start drops the pair. The worker, Veo's flf endpoints,
  Lite's 8s lock, pricing and director context all see the exact same
  states as before (verified headless: body sends first+last, lite8 lock
  fires, demotion/promotion both ways, counter 2/2).
- The rowFlf DOM stays (hidden) — no model shows it anymore.

### Seedance: one combined "Reference to video n/12" row (owner's design, 2026-07-17)
- Owner: instead of three separate rows (Audio 0/3 · Video clip 0/3 ·
  Reference 0/9), Seedance now shows ONE "Reference to video" row counting
  n/12 (fal's cross-modal total), with three labeled groups inside —
  IMAGES n/9, VIDEOS n/3, AUDIO n/3.
- Zero-rewire implementation: the existing controls (clip slot, @Video2-3
  tiles, audio slot, @Audio2-3 tiles) are RELOCATED into the groups when a
  Seedance model is selected, and moved back for every other model — same
  ids, handlers, validators; LipSync's rows verified intact round-trip.
- NEW enforcement fal always had but our split rows never checked: ≤12
  files TOTAL across modalities (9+3+3=15 possible) — attach-time toast
  client-side + a 400 guard in the worker.
- Verified headless: rows hidden/relocated, header 4/12 with mixed refs,
  labels track per-modality, LipSync round-trip clean, no page errors.

### Reference row groups → 3-icon modality toggles (owner refined, 2026-07-17)
- Owner's follow-up on the combined row: instead of three stacked labeled
  sections, the row now has a segmented switcher of three icon tabs (image
  / video / audio, each carrying its n/cap count, active tab in the split
  gradient) showing ONE modality's slots at a time. Default tab: images.
  Non-Seedance models keep the plain image group with the tabs hidden.
- Verified headless: tabs render/switch/count correctly, only-one-group
  visibility, Veo fallback intact, no page errors.

### Reference-tab polish: waveform bleed + clip label (owner caught, 2026-07-17)
- Relocating the audio/clip controls out of their rows detached them from
  their #rowAudio/#rowClip-scoped CSS — the empty audio slot's waveform
  rendered unstyled and bled across the tabs. Every scoped selector now
  has a #srAudGroup/#srVidGroup twin, so both slots keep their exact old
  styling wherever they live. The clip tile also reads "+ Video" inside
  the Reference row (it's a reference there, not the old Video-clip row).

### Reference caps now visible up front (owner asked, 2026-07-17)
- The fal limits used to surface only as bounce toasts on violation; each
  reference tab now shows its caps line permanently: images "up to 9 ·
  @Image1… · 12 files max total", videos "up to 3 · MP4/MOV · 2-15s
  combined · near 480-720p", audio "up to 3 · MP3/WAV · 15s combined ·
  needs an image or video ref too". Mini's schema verbatim-confirmed
  identical to Std/Fast (incl. the 12-file total).

### Caps: no UI text, loud rejection instead (owner reversed, 2026-07-17)
- The just-added per-tab caps hint was removed same-day (owner: "don't put
  the cap there — whenever it exceeds, just reject it and tell the user
  why"). Every cap on Seedance + Veo attach flows now rejects with the
  reason; the previously SILENT count-cap drops got toasts: over-cap ref
  images (Veo "capped at 3", Seedance "capped at 9"), 4th video ref, 4th
  audio ref. The existing loud checks (combined duration/size/format/
  12-total/pixel band/clip validation) were already compliant.

### OVERNIGHT PLATFORM AUDIT (2026-07-17, owner asleep — findings only, nothing fixed)
Scope: full frontend click-through headless (Media Agent skipped, no
generations), attach/settings/price sweep across all 17 models, staged-
persistence reload test, and a scripted diff of every wired endpoint
against fal's machine schemas.

FINDINGS (to fix when owner says so):
1. Landing filmstrip 404 spam — /mkt/f1…f14.jpg don't exist, so every
   landing view fires ~14 failed requests (console noise, wasted
   round-trips). Known backlog item ("user adds the files") but worth
   either dropping placeholder files or gating the strip until they exist.
2. CLAUDE.md drift — it still describes the floating logo menu
   (#floatNav/#floatMenu, toggleFloatMenu); the app actually uses the
   Gallery/Avatar/Media Agent TOP BAR now. Doc-only fix.
3. (Standing, already noted) Seedance Fast/Mini + reference price cards
   unverified; Fast-reference-at-4k tier question; 0.6× video-ref billing
   basis pending one live check.

PASSED CLEAN (notable):
- Zero page errors anywhere; zero broken handlers; no generation attempts
  leaked from the audit itself.
- Every duration×resolution×sound price combo on all 12 video models
  quotes non-empty; image + audio pricing fine.
- Machine-schema diff across all wired endpoints: every picker value
  inside fal's enums, no unsurfaced fal capability. (After today's fixes.)
- Chats new/switch/delete/search, sidebar, orchestrator toggle, effort
  menu, mention chips show/hide, credits overlay (tiers + storage caps +
  close), gallery grid/audio card/import box/storage bar, lightbox
  open/close, landing round-trip via logo, profile controls present.
- Merged Image-to-video pair, reference extras (@Video2-3/@Audio2-3), and
  refs all survive a REAL page reload via the staged IndexedDB mirror.
- Stale model ids (removed OmniHuman/Ray) degrade without errors.
- fal admin-key note: the key lives in Worker secrets (not readable from
  the dev box) — deep checks ran against fal's public machine-schema API;
  the owner-only /api/fal-balance probe remains the live-balance window.

### DEEP MULTI-AGENT AUDIT (2026-07-17 overnight, findings only — NOTHING fixed)
159 agents · 10 dimensions · every finding double-verified by adversarial skeptics.
74 raw → 61 CONFIRMED (survived both skeptics) · 9 plausible · 4 refuted.
Breakdown: 9 high · 19 medium · 33 low. Full evidence per finding below.


#### HIGH (9)
- **worker.js:2244** <billing-parity> — Veo extend with the Sound toggle off is billed at the audio-off (aoff) discount, but generate_audio:false is never sent to the extend endpoint (bareEdit excludes it) — the render is produced with audio at fal's audio-on price while the user is charged roughly half of it.
  - evidence: worker.js:2244 only applies the silent flag when !bareEdit: `else if (soundOff && !bareEdit && (isSeedance || isKlingV3 || isVeo)) input.generate_audio = false;` — Veo extend sets bareEdit=true (worker.js:2050-2054), so the request never asks for a silent render. Yet worker.js:2460 passes `soundOff` to creditCost unconditionally, and creditCost (worker.js:227) then picks the aoff tier: Veo extend bills aoff 720p $0.20/s x 7s = $1.40 (175 credits) instead of the audio-on $0.40/s x 7s = $2.80 (350 credits) the render actually costs. Same for fal-ai/veo3.1/fast ($0.10 vs $0.15/s). The client quot
- **public/chat.js:304** <state-machine> — Merged Image-to-video row: the image<->ffirst promote/demote conversion is dead code, so attaching the End frame silently deletes the start image and strands an invisible `flast` that skews pricing and rides the send as a start-less `last` frame.
  - evidence: Image kinds take the readImageConformed path and `return` at line 307, so the conversion written for them at lines 338-352 (`kind === 'flast' && mergedFlf() && !attachments.ffirst && attachments.image` -> promote image to ffirst) sits inside the clip/audio-only `reader.onload` (line 309, gated by `kind === 'clip' || kind === 'audio'` at 287) and can never run. The live flast path instead hits line 304 `clearImageInputsExcept('flf')`, which nulls `attachments.image` (line 1585). Repro on any merged model (Veo 3.1 x3, Seedance x3, Kling v3/o3 — all have `caps.image`+`caps.flf`, lines 33/40/67/74
- **worker.js:2814** <error-paths> — Stripe webhook swallows set_plan failure: a paid membership's storage tier/plan silently never activates, and Stripe is told the delivery succeeded so it never retries
  - evidence: In the invoice.paid handler, add_credits failure correctly returns 500 so Stripe retries (line 2799), but the set_plan call (lines 2804-2813) is wrapped in `try {...} catch {} // credits already granted; a plan-set hiccup shouldn't fail the webhook` and the handler then returns `Response.json({ received: true })` (200). If set_plan fails (Supabase blip, 10s timeout), the user has just paid $24.99-$99.99 for a membership whose gallery-storage benefit (user_plan tier + plan_until) is never recorded — /api/storage returns cap 0, every save 402s with reason 'free', and the UI tells this paying cus
- **public/chat.js:7314** <error-paths> — Avatar generation poll loop never checks for terminal fal failure and never refunds: a FAILED job leaves the user staring at a spinner for the full 5 minutes, then shows 'Timed out' with the credit silently kept
  - evidence: acGenerate's poll loop (lines 7314-7318) is `while (Date.now() < deadline) { ... if (state === 'COMPLETED') break; await sleep(3500) }` — unlike the main flow (pollAndDeliver line 5260, which breaks on FAILED/ERROR/CANCELED, fetches the exact error, and calls requestRefund at 5272) and even the voice preview (line 2634), there is no FAILED/ERROR/CANCELED check. A fal-side failure spins the 'Creating your avatar… this takes a few seconds' stage for 5 full minutes, then fails as 'Timed out — please try again' (7319) with no reason. requestRefund is never called anywhere in acGenerate (grep confi
- **public/chat.js:7327** <error-paths> — Avatar creation silently persists an expiring temporary fal URL when the gallery save fails or is blocked — the avatar (and its cross-device sync copy) rots dead within days with no warning
  - evidence: `try { const saved = await saveOutput(url, 'image'); if (saved && saved.url) finalUrl = saved.url; } catch (e) {}` then the avatar is persisted with `image: finalUrl` (7332) — on any save failure or 402 block, finalUrl stays the temporary fal URL. For EVERY free account this is the guaranteed path (cap 0 → 402 reason 'free', trySave returns {url:null, block:'free'}), yet unlike the chat flow — which explicitly delivers 'ℹ️ Saving to your gallery is a paid feature — this one is a temporary link' (line 5415) — the avatar flow says nothing. Worse, saveAvatars → touchAssets → pushAssets syncs the 
- **worker.js:3587** <director-prompts> — The user-facing ask step is handed the raw fal-branded model id ('target model: fal-ai/...') with no provider-nondisclosure instruction - only the error step forbids naming fal - so a user asking 'which model will you use?' can get 'fal-ai/kling-video/...' streamed back verbatim, violating the never-show-fal rule.
  - evidence: worker.js:3587 pushes 'target model: ' + genModel into ctxBits, and the ask system prompt appends Context: ctxLine at worker.js:3673. Model ids literally contain the provider name (chat.js:48 'fal-ai/kling-video/v3/pro/text-to-video', chat.js:60 'fal-ai/veo3.1', defaults 'fal-ai/nano-banana-pro' and 'fal-ai/elevenlabs/tts/eleven-v3'). The never-name-provider rule exists ONLY in the error step (worker.js:3689 'NEVER name any backend provider... (fal, fal.ai, replicate, etc.)'); ask/compose/revise carry no such rule, the ask reply streams straight into the chat (chat.js:5764, stream: true), and 
- **worker.js:2159** <director-prompts> — Tag-protocol mismatch on Kling o3 clip edits with style refs: refLine tells the director to cite @Image1..@Image4 tags, but the reconciler only counts image tags on reference-to-video endpoints, so on the /video-to-video/edit endpoint every @ImageN is stripped - producing a mangled paid edit instruction with the uploaded refs left uncited.
  - evidence: refLine (worker.js:3621-3623) matches /seedance|kling-video\/o3/ whenever refCount>0 - the client sends refCount unconditionally when refs exist (chat.js:5642), including with a clip attached - and the video edit-writer template includes refLine (worker.js:3720), so the director writes @ImageN tags into o3 edit instructions. The o3 edit path routes to model.replace('/text-to-video','/video-to-video/edit') and attaches refs as input.image_urls (worker.js:2042-2048), but the reconciler sets isRefEndpoint = endpoint.includes('/reference-to-video') (worker.js:2159) so imgN=0, falling into the else
- **public/chat.js:6082** <ux-deadends> — Plan-mode review card's 'Generate ✦N' price is frozen at card-build time and is never re-quoted when the user changes model/duration/resolution/sound afterwards — and on re-render it prices with the CURRENT composer mode instead of the card's own mode, so the quote can be wildly wrong while approval charges the real (different) amount.
  - evidence: buildReviewCard sets the price once: `allow.textContent = 'Generate ' + (estimatePrice(m === 'audio' ? prompt : undefined, shots, extras && extras.sound) || '✦')` (chat.js:6082). estimatePrice branches on the GLOBAL `mode`/`model`/`duration`/`quality` (chat.js:4480-4572), and nothing repaints the thread on a settings change — setMode (chat.js:2227-2241) and every Settings pick call only buildOptMenus/updateSendPrice, never renderThread (renderThread is only called on chat switch/boot/sync, chat.js:3374). Reachable path A (stale quote): Plan mode → send request → card shows e.g. 'Generate ✦63' 
- **public/chat.js:5371** <refresh-resume> — Refresh during the save/deliver phase silently strands a completed, charged render for up to 1 hour: the delivery claim is taken by the now-dead tab, and the boot-resume that hits the claimed key bumps tries, pauses with autoResume=false, and shows NO message.
  - evidence: pollAndDeliver claims delivery (line 5371 claimDelivery(statusUrl)) BEFORE the save phase — which can run for minutes (saveOutput retries, burnImageWatermark, saveVideoWithQr's ffmpeg burn, lines 5379-5411) — and only clears the record at endGen (5413). If the tab dies in that window, the claim (keyed by TAB_ID, blocking for 3600e3 ms per claimAt check at line 4065) belongs to a dead tab. On the next boot, resumeOne re-polls, sees COMPLETED, fetches the result, then line 5371 returns false → `jobBumpTries(origin); pauseGen(origin, false); return;` — no deliverAgent call, no scheduleResume (aut

#### MEDIUM (19)
- **public/chat.js:4550** <billing-parity> — Gemini clip-edit quote uses the browser-measured clip duration, but the worker can only byte-measure mp4/mov — any other container (e.g. webm) makes clipSecondsReal 0 and bills the 30s maximum, so the user sees a quote for the real length and is charged up to ~6x more.
  - evidence: Client quote (chat.js:4548-4550): `clipEditSecs = Math.min(clipEditMax, Math.ceil((clipMeta && clipMeta.dur) || clipEditMax))` — browsers decode webm fine, so a 5s webm quotes 0.13*5 = $0.65 (82 credits). Worker: videoDurationFromDataUri (worker.js:270-279) parses only mp4/mov moov/mvhd, so a webm clip yields clipSecondsReal=0 and worker.js:2418 bills the max: `Math.min(clipEditMax, Math.ceil(clipSecondsReal || clipEditMax))` = 30s -> 0.13*30 = $3.90 (488 credits). CLIP_LIMITS has no format restriction for Gemini (chat.js:442, only maxDur:30; the o3 edit is protected by its mp4/mov formats lis
- **public/chat.js:4978** <provider-leak> — Error-step output is only half-scrubbed: data.reply goes through scrubProvider but data.prompt (fixedPrompt, written by Claude from the RAW fal error) is rendered into review cards unscrubbed — in explainFailure and offerReword.
  - evidence: Line 4977 scrubs the reply ('deliverAgent(origin, scrubProvider(data.reply))' with a comment noting a real fal-naming leak slipped through 2026-07-17), but line 4978 'if (data.prompt ...) reviewPrompt(data.prompt)' and offerReword lines 5002-5003 'saveToChat(origin, { t: "review", prompt: String(data.prompt) ... }); threadAppend(buildReviewCard(String(data.prompt), kind))' display the model-authored prompt with no scrub. The error step's input is the verbatim upstream error (worker.js:3770 'Raw error: ${errText}', up to 700 chars including fal hostnames), so the same incident class that alread
- **public/chat.js:8420** <dom-consistency> — Media Agent chat (agent Q&A) is fully orphaned: agentRenderThread targets #maThread, which no HTML or JS template creates, and agentSend is only reachable from buttons agentRenderThread itself renders — the whole feature (AGENT_SUGGESTIONS, /api/social/agent call) is unreachable dead code.
  - evidence: chat.js:8420 `const thread = document.getElementById('maThread'); if (!thread) return;` — grep for maThread across public/ finds a producer only in the unused demo folder public/demo-hero-2/chat.js:6109, never in public/index.html or public/chat.js templates. renderMediaAgent (chat.js:7393) builds only #appSwitch/#appMain, and renderSection (chat.js:7473+) routes to analytics/posts/dms/comments/autoreply with no agent-chat section. agentRenderThread is called only from agentSend (8446, 8461), and agentSend only from the .ma-suggest buttons agentRenderThread renders (8428) — a closed loop with 
- **public/chat.js:670** <state-machine> — awDecode has no swap/identity guard (unlike readClipMeta line 372 and measureAttachedImage line 592): a slow decode of a replaced or cleared audio clip stamps the OLD clip's awDur/awPeaks onto current state, which can wrongly auto-reject the newly attached valid audio and mis-quote lip-sync pricing.
  - evidence: awDecode (lines 654-686) unconditionally sets `awPeaks`/`awDur = audio.duration` (669-670) and then runs `audioIssue()` (678) with no check that `attachments.audio` still equals the dataUrl it was decoding — the exact guard readClipMeta uses (`attachments.clip !== dataUri`, line 372). Race: attach clip A (e.g. 70s, over Kling LipSync's 60s cap), immediately re-pick valid clip B; onAttach resets awDur=0/awDecoding=true (line 316, whose comment states the invariant: 'a send in this window must not bill the old length') and starts decode B, but decode A (decodeAudioData of a large mp3 takes secon
- **public/chat.js:5427** <state-machine> — Post-delivery 'inputs were consumed' cleanup clears attachments/extraImages/refList/elList but omits kfList, vxList and axList (and leaves clipMeta set), so Ray keyframes silently ride the NEXT prompt at the i2v price tier, and Seedance leaves orphaned @Video2-3/@Audio2-3 entries whose debounced persist immediately resurrects the state the code just deleted from IndexedDB.
  - evidence: Lines 5426-5436: only `attachments` keys, `extraImages`, `refList`, `elList` are cleared. Leftovers: (a) kfList — next send in the same chat posts `keyframes: kfList.slice()` (5097) and prices as startImg (4523) even though the comment at 5421 says inputs must not 'ride the next prompt'; (b) vxList/axList survive with slot #1 (`attachments.clip`/`attachments.audio`) now null — an impossible state the attach flow prevents (clearAttach lines 874-875 drops extras with slot #1): renderVxList still paints tagged @Video2-3 slots with no @Video1, srTotal (1722-1725) counts them against the 12-file ca
- **public/chat.js:295** <state-machine> — Async image-attach callbacks are neither slot- nor chat-scoped: a slow readImageConformed resolving after a chat switch writes the old chat's image into the NEW chat's staged attachments (cross-chat leak into the next send), and on quick same-slot re-picks the last-RESOLVED file wins over the last-attached one.
  - evidence: onAttach's `.then` (293-306) does `attachments[kind] = uri` with no guard; readImageConformed is multi-second for oversized files (>8MB triggers Image decode + iterative canvas re-encodes, lines 261-275 — the code's own comment says 15-25MB PNGs from the app's 4K outputs are the normal case). switchChat (3634-3648) is freely clickable meanwhile and runs restoreStaged for the new chat — the late resolve then lands the previous chat's image into the live `attachments` of the new chat, gets picked up by the debounced stashStaged under the new chat's id, and rides its next generation. The list att
- **public/chat.js:4280** <error-paths> — retryPendingSaves silently drops queued gallery saves after the chat explicitly promised 'It'll land there on its own' — the media stays on a temp URL that expires, with no follow-up message
  - evidence: When a mid-session save fails transiently, the user is told '⏳ Still saving this to your gallery — big files can take a minute. It'll land there on its own.' (5418). But in retryPendingSaves: line 4276 `if (Date.now() - (p.at || 0) > 6 * 24 * 3600e3) continue;` silently discards saves older than 6 days, and line 4280 `else if (block) { /* paid gate (free/full) — retrying won't help, drop it */ }` silently discards a save that later hits the 402 gate (plan lapsed or cap filled between generation and retry). In both cases the chat message keeps its temporary fal URL, which expires — a paid rende
- **public/chat.js:9468** <error-paths> — galleryDelete removes the card from the UI before the server operation and surfaces nothing on failure — both the unlist path (catch {}) and the hard-delete path (Auth.storageDelete result ignored) fail silently
  - evidence: Line 9446 `el.remove()` runs before any network call. Referenced path: the /api/media/unlist POST is in `try {...} catch {}` (9448-9468) and a non-ok response leaves j null so nothing happens — the code's own comment admits 'the card comes back on the next gallery load', but the user is shown a successful delete now and a resurrected card later with no explanation; sbToast (9172) exists and is unused here. Unreferenced path (9471): `try { await Auth.storageDelete(m[1]); } catch {}` — auth.js:182-190 shows storageDelete returns res.ok, and this boolean is ignored, so a failed DELETE (expired to
- **public/chat.js:5575** <error-paths> — pushAssets (avatar cross-device sync) never checks the response and never requeues on failure — a 4xx (expired token, RLS) or network error silently loses the sync, unlike pushChats which requeues both
  - evidence: pushAssets wraps its upsert in `try { await fetch(ASSETS_ENDPOINT...) } catch {}` (5569-5580) with no `res.ok` check and no retry/requeue — contrast pushChats, which on !up.ok re-adds ids to syncDirty and calls scheduleSync (3234) and requeues on network error (3244-3248). A single failed push means avatars edited on device A never reach device B until the NEXT avatar edit happens to fire touchAssets; worse, the LWW timestamp (assetsAt, already bumped at 5543) makes device A also ignore the stale server row on future pulls (5597), so the divergence is permanent and invisible. pushMemory (5504-
- **worker.js:2445** <worker-routes> — GPT Image 2 2K/4K billing guard for 'auto' ratio is dead code — a request with ratio absent or 'auto' plus size '4K' is billed the 4K tier ($0.41) while no explicit dimensions are ever sent, so fal renders/bills the ~1K default (~$0.22): a ~2x overcharge the code explicitly says must not happen.
  - evidence: Line 2445: `gptSize: gptSize && ratio === "auto" ? "1K" : gptSize` — but `ratio` (lines 1875-1878) is validated by `/^\d{1,2}:\d{1,2}$/` and is otherwise null, so it can NEVER equal the string "auto"; body.ratio='auto' yields ratio=null. With ratio null, line 2357-2359 `gptSizePx(ratio, gptSize)` returns null (no image_size sent) and the generic ratio branch at 2298 is skipped, yet the un-downgraded gptSize ('2K'/'4K') still reaches creditCost → GPT_PRICE['4K'] (line 109-115). The comment at 2443-2444 states "At 'auto' ratio there are no explicit dimensions — 2K/4K can't apply, so they must no
- **worker.js:4276** <worker-routes> — /api/import/fetch AI-rescue path ignores useCredits' -1 insufficient-balance return: on a race the ✦3 lookup runs without ever debiting, every failure path then mints +3 credits the user never paid via creditBack, and on success the client pill is sent balance:-1.
  - evidence: Lines 4275-4277: `let newBalance = null; try { newBalance = await useCredits(auth, AI_CR); } catch {...}` — only the throw (ledger down) is handled. Per the function contract (worker.js:384-385, "Returns the new balance, or -1 when the balance is too low"), a concurrent spend between the readCredits pre-check (4272-4274) and this debit returns -1, which is never checked. Contrast the generation route, which checks `if (!(balanceAfter >= 0))` and cancels (4524-4527). Consequences: (a) the paid Sonnet+web_search lookup runs with no charge; (b) `refund()` (4278) / `creditBack(env, user.id, 3)` (4
- **worker.js:4394** <worker-routes> — /api/save — the route that legitimately receives the largest client payloads (up to ~40MB base64 video) — has no tooLargeBody backstop: request.json() buffers and parses an arbitrarily large body before any size check runs.
  - evidence: Lines 4390-4396: `if (url.pathname === "/api/save" ...) { const user = await authUser(request); ... body = await request.json(); }` with no Content-Length guard; the per-kind caps (b64.length > 40_000_000 at 4414, 20M at 4430, 12M at 4448) apply only AFTER the whole body is buffered and JSON-parsed. Every other body-heavy route has the backstop: generation 100MB (line 1696), /api/direct 60MB (line 3318), stripe webhook 256KB (line 2713) — tooLargeBody (line 804) returns a clean 413 by Content-Length. An authed user posting a near-plan-limit body (Workers allows 100-500MB) forces full buffering
- **worker.js:3746** <director-prompts> — multiImgLine (the multi-reference image guidance including the useImages selection protocol) is spliced only into the image-EDIT compose branch, where it can never render because the client makes an edit base and reference images mutually exclusive - and its text even contradicts that branch's own header ('there is no edit base' inside 'this is an EDIT'). The actual multi-reference image compose branch gets no multi-image guidance at all, and the video variant of multiImgLine is used in no template.
  - evidence: multiImgLine is defined at worker.js:3607-3611 and used ONLY at worker.js:3746, inside the branch gated on kind==='image' && hasImage (worker.js:3740). chat.js:1022-1028 ('either ONE edit base or references, never both'; line 1028 clears extraImages when attachments.image is set in image mode) means imageCount>1 implies hasImage=false, so the branch condition and imageCount>1 never coexist - the guidance is dead. The from-scratch image branch (worker.js:3748-3758) that actually handles multi-reference runs includes no multiImgLine, leaving only the ctx bit (worker.js:3592) and the useImages to
- **worker.js:3624** <director-prompts> — Gemini reference-to-video runs get the tagless-family refLine ('refer to it naturally... not by tag') even though Gemini binds references natively via tags - the worker translates @ImageN into Gemini's <IMAGE_REF_N> form - so the director is steered away from the only binding mechanism; per-ref placement is lost and binding degrades to the generic appended 'Feature @Image1, @Image2.' fallback clause.
  - evidence: refLine's tag branch regex is /seedance|kling-video\/o3/ (worker.js:3622), so 'google/gemini-omni-flash' falls to the else branch (worker.js:3624) instructing natural wording like 'the subject from reference image N', not tags. But the reconciler's Gemini branch (worker.js:2171-2177) translates @ImageN to 0-based <IMAGE_REF_N> - the native binding per chat.js:55-57 ('bound as native <IMAGE_REF_N> tags - the worker translates our @ImageN') - and only literal @ImageN is translated; the phrase 'reference image 2' is never converted. With no tags in the director's prompt, worker.js:2030-2031 appen
- **public/chat.js:6103** <ux-deadends> — Approving a multi-shot Plan card after switching to a non-Kling video model silently drops the whole shot list — the user approves a numbered shot breakdown but gets a single plain render with no notice that the plan changed.
  - evidence: The card renders the shot list (chat.js:6066-6076, gated by `shotsApply(model)` evaluated at BUILD time, chat.js:6052) and its approve handler passes the captured shots to `generateMedia(prompt, { announce:false, shots, extras })` (chat.js:6103). generateMedia re-gates with the CURRENT model: `const genShots = (kind === 'video' && shotsApply(model) && sanitizeShots(opts.shots)) || null` (chat.js:5049) — shotsApply (chat.js:5702) is Kling-only. Reachable path: Plan mode on Kling o3 → ask for a montage → card shows 'Here's the shot list — approve to run it' with N shots → open the model menu, pi
- **public/chat.js:9255** <ux-deadends> — Gallery import-from-link with a non-URL string is a silent no-op: the only feedback is written to the input's placeholder, which is invisible while the typed text is still in the box.
  - evidence: importGalleryUrl: `if (!m) { if (inp) inp.placeholder = 'That needs a full link (https://…)'; return; }` (chat.js:9254-9255) — the input's value is not cleared, and an HTML placeholder only renders when the field is empty, so the message never shows. Reachable path: floating logo menu → Gallery → paste/type anything without 'https://' (e.g. 'molly's suds detergent' or 'www.example.com/photo.jpg' — the regex at chat.js:9254 requires the scheme) into #galImportUrl → press Enter (KEYDOWN_ACTIONS 'gal-import-url', chat.js:9620) or click the '→ ✦3' button → the function returns before disabling any
- **public/chat.js:4300** <refresh-resume> — finishDeadJob's 'keep retrying DELIVERY each boot (tries pinned below the cap)' is false: resumeJobs deletes dead records from localStorage (jobsWrite(live)) before finishDeadJob runs, and resumeOne({...j, tries:3}) never re-persists the record — so the final delivery attempt is in-memory only and any interruption loses the completed paid render permanently and silently.
  - evidence: Line 4298-4300: `const dead = jobs.filter((j) => (j.tries || 0) >= 4); jobsWrite(live);` — dead records are removed from storage. finishDeadJob's COMPLETED branch (line 4318) then calls `resumeOne({ ...j, tries: 3 })` with the comment 'keep retrying DELIVERY each boot … until the file actually lands', but nothing writes the record back (jobRecord is only called in generateMedia and recoverJob). If that attempt fails — network pause path calls jobBumpTries/pauseGen→scheduleResume, both of which operate on jobsLoad() where the record no longer exists (scheduleResume's find at 4384 returns nothin
- **public/chat.js:4385** <refresh-resume> — scheduleResume requires rec.statusUrl, so a provisional (idem-only) record from a reply lost mid-submit is never recovered in-session — the user is told 'checking whether that render went through…' but no check runs until the next full page reload or a manual re-send.
  - evidence: generateMedia's catch (line 5198) delivers '⚠️ Connection dropped — checking whether that render went through…' and calls pauseGen(origin), whose autoResume path calls scheduleResume (line 4031). But scheduleResume (line 4385) is `if (rec && rec.statusUrl) resumeOne(rec);` — the provisional record written at line 5080 has an idem and NO statusUrl, so the timer fires and does nothing. resumeOne itself handles the idem-only case correctly (line 4341 → recoverJob), so the filter is the only blocker. The maybe-charged job (worker charges after fal accepts) sits unrecovered — and its loader gone — 
- **public/chat.js:5034** <refresh-resume> — A record whose tries reach 4 mid-session (via the 45s scheduleResume cycle) stalls silently after the app promised auto-pickup, and a new send in that chat then overwrites the dead record (the pending check filters tries<4), so the charged render never reaches finishDeadJob's refund/notice at next boot.
  - evidence: Each failed in-session resume bumps tries (e.g. lines 5234, 5299, 5446) and re-schedules; after the 4th failure scheduleResume's `(j.tries || 0) < 4` filter (line 4384) finds nothing, so the render — whose last user-visible message was 'the app will pick it back up automatically' — silently stops being retried until a reload triggers finishDeadJob. If instead the user sends a new generation in that chat first, generateMedia's guard `jobsLoad().find((j) => j.chatId === origin && (j.statusUrl || j.idem) && (j.tries || 0) < 4)` (line 5034) skips the dead record and jobRecord at line 5080 (which r

#### LOW (33)
- **public/chat.js:4501** <billing-parity> — Audio (TTS) quote caps the billed character count at 2,000 but the worker charges up to 4,000 characters — a director-composed voice script between 2,000-4,000 chars (plan-mode approval bypasses the 2,000-char send guard) is quoted at up to half what is charged.
  - evidence: Client quote (chat.js:4501): `const chars = Math.min(2000, raw.trim().length)` with the comment 'Match the server's cap', and the send() guard (chat.js:6147-6152) claims 'Voice is capped at 2,000 characters server-side'. But the worker slices the prompt at 4000 (worker.js:1706), sends the full text to ElevenLabs with no 2000 cap (worker.js:1909 `input.text = prompt` — only the LipSync text mode slices at 2000, worker.js:1942), and charges `chars: prompt.length` (worker.js:2440), i.e. up to 4000 chars. The plan-mode review card prices via estimatePrice(prompt) (chat.js:6082) and its approve han
- **worker.js:2445** <billing-parity> — The GPT Image 2 'auto'-ratio billing demotion is dead code: ratio is regex-normalized to null before the check, so `ratio === "auto"` can never be true — a request with ratio 'auto' plus size 2K/4K is billed the 2K/4K tier while no dimensions are sent and the render comes out 1K-class (4K high: 52 credits charged for a ~$0.21 render).
  - evidence: worker.js:1875-1878 normalizes ratio with `/^\d{1,2}:\d{1,2}$/` — 'auto' fails and ratio becomes null. worker.js:2445 then evaluates `gptSize: gptSize && ratio === "auto" ? "1K" : gptSize` — never true, so gptSize stays '4K'; meanwhile gptSizePx(null, ...) (worker.js:2358, regex at 120-121) returns null, so no explicit width/height is sent and the image renders at the schema-default 1K class. Charge: GPT_PRICE 4K high $0.41 = 52 credits vs real fal cost ~$0.211 and vs the client quote which prices 'auto' as 1K (chat.js:4485: `GPT_PRICE[ratio === 'auto' ? '1K' : gptSize]` = 29 credits). Current
- **public/chat.js:5919** <provider-leak> — Director replies outside the error step bypass scrubProvider: the ask-step reply (deliverAgent(origin, res.reply)), its live-streamed deltas, and the Media Agent reply are all rendered unscrubbed, despite the 4974 comment framing scrubbing as defense-in-depth for AI output.
  - evidence: chat.js:5919 'if (res.reply) deliverAgent(origin, res.reply);' and the SSE delta path at 5789 'if (ev.d && onDelta) onDelta(ev.d);' render Claude output with no scrub; chat.js:8456 'agentMsgs.push({ role: "assistant", content: d.reply })' does the same for the Media Agent. These steps normally never see fal error text (low probability), but the codebase's own stance after the 2026-07-17 incident is 'scrub AI output anyway' (comment at 4974-4976) and only explainFailure actually does.
- **public/chat.js:8308** <dom-consistency> — renderPublish is dead code: its only call site is inside itself (the platform-tab click it wires), so it can never run — the live YouTube/Instagram composers (openYtComposer/openPostComposer) build the #maPublish markup inline and duplicate it.
  - evidence: grep for renderPublish finds exactly two references: the definition (chat.js:8308) and the recursive call from its own tab buttons (chat.js:8343 `b.onclick = () => { ... renderPublish(); }`). The #maPublish container it targets is created only by openYtComposer (chat.js:7653) and openPostComposer (chat.js:7830), both of which render their own complete publish UI and never invoke renderPublish.
- **public/styles.css:2052** <dom-consistency> — `.sb-toast` is defined three times with conflicting rules: a #sbToasts-scoped variant using .in/.prog modifiers that no JS ever creates or toggles (styles.css:1715-1728), and two competing fixed-position .show toasts (2052-2061 vs 2869-2877, z-index 120 vs 400) where only the last block effectively wins for the live sbToast().
  - evidence: styles.css:1715 `#sbToasts { position: fixed; ... }` — 'sbToasts' appears nowhere in chat.js or index.html, and no JS adds class 'in' or 'prog' to a toast (grep confirms). styles.css:2052 and 2869 both declare `.sb-toast { position: fixed; left: 50%; bottom: ...; opacity: 0 }` + `.sb-toast.show` with different z-index/background/padding; the only creator is sbToast() (chat.js:9172-9184, className 'sb-toast', toggles 'show'), so the 2052 block is shadowed dead weight — edits to it silently do nothing.
- **public/chat.js:3510** <state-machine> — awPlayer is not invalidated on chat switch: restoreStaged swaps awPeaks/awName/awDur to the new chat's staged audio but leaves awPlayer bound to the previous chat's clip, so the play button plays the WRONG chat's audio (and a clip playing at switch time keeps playing over the new chat).
  - evidence: restoreStaged (3501-3518) restores awDur/awPeaks/awName/awSize/awType (3510-3511) and re-renders via renderAttach('audio') (3514), but renderAudioSlot only pauses/nulls awPlayer in its EMPTY branch (762) — when the incoming chat has its own staged audio, the 'has' branch (749-758) keeps the stale player. awToggle (732-746) then sees `awPlayer` non-null and calls `awPlayer.play()` on the previous chat's Audio element while the slot shows the current chat's filename, duration, and waveform. Repro: stage audio X in chat A, press play (or just play/pause once), switch to chat B which has audio Y s
- **public/chat.js:3679** <state-machine> — deleteChat of the active chat calls restoreStaged on the fallback chat but never hydrateStaged, so that chat's refresh-persisted staged attachments don't appear — and the empty in-memory stash created on the next switch-out then deletes the IndexedDB record for good.
  - evidence: Line 3677-3680: `if (wasActive) { applyComposerState(...); restoreStaged(chatStore.active); }` — no hydrateStaged, unlike switchChat (3644-3645) and boot (6560). If the fallback chat had staged inputs persisted before a refresh and hasn't been visited this session (no stagedByChat entry), restoreStaged renders an empty panel over a DB record that still holds them. Worse, the next switchChat AWAY from it runs stashStaged (3638, creating an empty in-memory snapshot) and `stagedDbPut(outId, null)` (3640, since stagedHasContent is false), permanently destroying the persisted stash; hydrateStaged o
- **public/chat.js:9053** <error-paths> — Gallery server-list fetch failure is indistinguishable from an empty gallery: a fresh device with /api/gallery down shows 'Nothing here yet — everything you generate lands in your gallery' to a paying user whose media exists
  - evidence: loadServerGallery (9053-9061) swallows both non-ok responses and thrown errors (`catch {}`), leaving serverGallery null. galleryItems then falls back to the chat-derived local view (9087) — reasonable on the originating device, but on a new device/browser (no local chats yet, pullChats may also have failed silently at 3271) the grid renders empty and renderGallery shows the definitive-sounding empty state at 9323 ('Nothing here yet…') with no 'couldn't load your gallery — retry' distinction. sbToast exists and could disambiguate. The same-device fallback behavior itself is a deliberate, commen
- **public/chat.js:2641** <error-paths> — Voice preview failure surfaces only as a bare '⚠' glyph for 1.6 seconds — no reason, no toast, and the spent TTS credit is never refund-requested even when fal reports FAILED
  - evidence: previewVoice's catch (2641-2643) sets `btn.textContent = '⚠'` then restores '▶' after 1600ms — that is the entire failure surface for a paid action (/api/audio charges credits; the 402/insufficient-credits case also lands here with no explanation). The loop does detect terminal fal states (line 2634 breaks on FAILED/ERROR/CANCELED) and job.status_url is in scope, but unlike every generation path it never calls requestRefund, so a fal-confirmed-failed preview quietly keeps the charge. Owner-notes 1181 lists 'voice-preview errors are silent' as queued — confirmed, with the refund omission as the
- **worker.js:3170** <worker-routes> — /api/social/comment/reply is the only social WRITE endpoint with no useQuota gate — unlimited public Instagram comment posts per day — and its catch leaks raw exception text to the client.
  - evidence: Lines 3170-3187: after auth + COMPOSIO_API_KEY check the route goes straight to composioExecute — no `useQuota` call. Sibling write routes are gated: /api/social/dm/send `useQuota(request, "dm", 200)` (line 3063), /api/social/publish `useQuota(request, "publish", 30)` (line 3084); even the read routes carry `analytics` 120/day. Each call is a metered Composio execution against Meta's ~750/hr comment-reply cap (docs/media-agent.md line 68), so an abusive/looping client can burn the Composio meter and the user's Meta rate limit unbounded. Additionally line 3185 returns `String((e && e.message) |
- **worker.js:4116** <worker-routes> — /api/cancel and /api/video/poll validate only the fal URL shape, not ownership — any authenticated user who obtains another user's status_url can poll or cancel that user's queued render.
  - evidence: Lines 4116-4134 (/api/cancel) and 4575-4594 (/api/video/poll): both check `authUser(request)` and a `^https://queue\.fal\.run/...` regex, then execute with the server FAL_KEY; neither cross-checks the request_id against the caller's gen_charges rows (which exist and carry user_id — used by /api/refund at 4183-4192 and the idempotency lookup at 1728-1731). Request ids are unguessable UUIDs delivered only to the owning client, and a maliciously cancelled job is refundable via the client's CANCELED flow (public/chat.js:5260-5272), so exposure is low — but the pattern diverges from /api/refund, wh
- **worker.js:4225** <worker-routes> — /api/import/fetch's free path has no quota or rate limit — any authenticated user gets an unmetered server-side fetch proxy (up to ~29MB returned as base64 per call, unlimited calls/day); only the paid AI-rescue branch is quota'd (scanai 20/day).
  - evidence: Lines 4206-4252: after authUser the route safeFetches the user URL and (for HTML) walks image candidates with retries, returning base64 media to the client — the only useQuota call in the route is inside the AI branch (line 4268, `useQuota(request, "scanai", 20)`). SSRF is well guarded (safeFetch/hostIsBlocked, lines 756-793) and sizes are capped (MAXES line 4222, readCapped), but a scripted client can invoke it in a tight loop as a free CORS-bypass/download proxy, burning Worker CPU and egress. CLAUDE.md documents the scanai quota but no gate exists on the clean-fetch path; every comparably a
- **worker.js:3966** <worker-routes> — Documented director model routing diverges from code: CLAUDE.md says "Sonnet 5 handles High/Ultra/Max plus the ask/error/studio steps", but /api/direct routes ask/error/studio (and Low/Medium compose/revise) to Haiku 4.5.
  - evidence: Lines 3966-3969: `const dirModel = (step === "compose" || step === "revise") && (effort === "high" || effort === "ultra" || effort === "max") ? "claude-sonnet-5" : "claude-haiku-4-5";` — so ask, error, and studio always run Haiku (the in-code comment at 3960-3965 describes this as an A/B-verified split; research alone still runs Sonnet, line 3417). CLAUDE.md's /api/direct description says Sonnet handles "the ask/error/studio steps", and no owner-notes entry records the switch (grep for haiku/A-B in docs/owner-notes.md returns nothing). Billing is consistent with the cheaper model (orchestrator
- **worker.js:3633** <director-prompts> — vidRefLine always describes a single video reference 'labelled @Video1' even when 2-3 Seedance video refs are attached, contradicting the ctx line in the same prompt ('cite them as @Video1...@Video3'); since Seedance only uses references the prompt cites and the auto-append fallback fires only when NO tag is present, @Video2/@Video3 are likely to go uncited and be silently ignored.
  - evidence: worker.js:3633-3635: vidRefLine is gated only on clipIsSeedanceRef and hardcodes 'a VIDEO clip as a reference (labelled @Video1)... weave @Video1 into the prompt', with no vidRefN plural form. The same composed prompt's ctx line (worker.js:3595-3597) says 'N video clips ARE attached as references - cite them as @Video1...@VideoN' when vidRefN>1 (client sends 1+vxList.length, chat.js:5638). Seedance ignores uncited refs (worker.js:1990: 'Seedance only uses a reference the prompt CITES') and the tag-append fallback (worker.js:1995) only triggers when the prompt contains no @Image/@Video tag at a
- **worker.js:3504** <director-prompts> — Stale comment above the director-knobs block still claims 'sound' is a director-driven knob ('the AI sets these from the user's words... generate_audio / o3-edit keep_audio'), contradicting the current design: the write_prompt tool schema has no sound field, the ask prompt declares sound controlled ONLY by the user's toggle, and the client explicitly ignores any director sound value.
  - evidence: worker.js:3503-3506 comment: 'Director-driven knobs (owner's call: the AI sets these from the user's words, no new UI). sound: families with an audio-track switch (generate_audio / o3-edit keep_audio).' But the write_prompt schema (worker.js:3880-3943) exposes negative/cfg/bitrate/controls/tune/shots/useImages and no sound field; the ask SOUND rule (worker.js:3669) says the audio track 'is controlled ONLY by the user's Sound toggle... you cannot change it'; and chat.js:5667-5669 ('a director-returned sound:false is IGNORED', owner rule 2026-07-17) plus chat.js:5111 ('chatbox toggle only - neve
- **CLAUDE.md:6** <dead-drift> — Doc drift: CLAUDE.md describes navigation as a floating logo menu (#floatNav/#floatMenu, .float-logo/.float-item, toggleFloatMenu) — none of that exists; navigation is now top tabs plus a profile-pop menu, and two views (Integrations, Settings) are undocumented.
  - evidence: grep for floatNav|floatMenu|float-logo|float-item|toggleFloatMenu across public/ and worker.js returns zero hits (styles.css included). Actual mechanism: public/index.html lines 220-224 have .top-tab buttons data-view=gallery/avatar/mediaAgent plus a #topBack button, and index.html lines 210-211 put Integrations/Settings in the profile pop. public/chat.js showView() (line 9485) handles 'integrations' and 'settings' views (lines 9501-9502) and KNOWN_VIEWS at chat.js:6556 is ['home','gallery','avatar','mediaAgent','integrations','settings']. docs/owner-notes.md lines 95-99 repeat the same stale 
- **CLAUDE.md:11** <dead-drift> — Doc drift: CLAUDE.md says 'Sonnet 5 handles High/Ultra/Max plus the ask/error/studio steps' — in code Sonnet is used ONLY for High/Ultra/Max compose/revise; ask, error and studio run on Haiku.
  - evidence: worker.js:3966-3969: const dirModel = (step === "compose" || step === "revise") && (effort === "high" || effort === "ultra" || effort === "max") ? "claude-sonnet-5" : "claude-haiku-4-5"; with the comment at 3960-3964: 'Sonnet earns its price ONLY on High/Ultra/Max creative prompt-writing (compose/revise). Everything else runs on Haiku — the routing/classification ask step ..., the low-stakes error/studio steps'. orchestratorCostMicros (worker.js:952-958) also prices ask/error/studio as Haiku.
- **CLAUDE.md:47** <dead-drift> — Doc drift: CLAUDE.md's live-sweep line says '13 video + 11 image models'; the current allowlists have 12 video endpoints and only 2 image models, and the 2026-07-17 removals of Ray 3.2 and OmniHuman are not reflected anywhere in CLAUDE.md.
  - evidence: worker.js:6-22 VIDEO_MODELS contains 12 entries (3 Seedance, 2 Kling v3, Gemini, veo3.1 + fast + lite, 2 Kling o3, LipSync) with the in-code note '(Ray 3.2 removed 2026-07-17, owner's call...)'; worker.js:31-34 IMAGE_MODELS is just fal-ai/nano-banana-pro and openai/gpt-image-2. chat.js MODEL_OPTS (line 42) matches: 12 video picker entries, comments noting 'OmniHuman 1.0/1.5 were removed 2026-07-17'. CLAUDE.md never mentions veo3.1/lite either.
- **worker.js:3323** <dead-drift> — Dead code: /api/direct still accepts and fully implements the 'studio' director step (Studio was removed 2026-07-12) — no client code ever sends step:'studio', and CLAUDE.md line 11 still lists it as a live step.
  - evidence: worker.js:3323 let step = ["compose", "revise", "error", "studio", "research"].includes(body.step) ...; worker.js:3674-3688 carries the full 'You are isibi, the director of a shot-based video studio...' system prompt; orchestratorCostMicros comment (worker.js:946, 957) still prices the studio step. grep "'studio'" in public/chat.js returns zero hits — the only step values the client sends are error/ask/revise/compose/research (chat.js:4966, 4993, 5764, 5826, 5852, 6006). The step remains directly callable by any authed user (charges 0.5 credits, runs a Haiku call) for a feature that no longer 
- **public/chat.js:8746** <dead-drift> — Dead code: enterCrt() (8746), hideCrt() (8757) and crtNoSignal() (8881) are never called, and all three reference DOM ids that no longer exist in index.html (#crtSelect, #crtNote).
  - evidence: grep counts across public/*.js, index.html, worker.js show each name appears exactly once (its definition). enterCrt/hideCrt do getElementById('crtSelect') and crtNoSignal does getElementById('crtNote') — neither id exists in public/index.html (grep returns nothing; the CRT markup only has crtScreen/crtMenu/crtChatbox/crtLandInput). These are leftovers from the earlier 'CRT shown right after sign-in' design; the header comment at 8739-8743 still describes that flow (and a 'VHF knob' that has no markup), while the real flow is initCrt() at 8633 ('the CRT is now the landing itself'). paintCrt's 
- **public/chat.js:4777** <dead-drift> — Dead code: the membership 'output equivalence' helpers IMG_CR, VID_CR, roundTo, estImages, estVideos (chat.js 4777-4781) are defined but never used anywhere.
  - evidence: grep -c: IMG_CR appears 2× (definition + use inside estImages), VID_CR 2×, roundTo 3× (definition + the two est* bodies), and estImages/estVideos each appear exactly once (their own definitions) across chat.js/index.html/worker.js — nothing calls estImages/estVideos, so the whole 4777-4781 block is unreachable. The comment above it (4773-4776) also still says 'AI is the separate Orchestrator add-on now', contradicting the add-on's removal on 2026-07-14 (CLAUDE.md Credits section).
- **public/chat.js:4812** <dead-drift> — Doc drift in code: openCredits() header comment still describes it as 'Focused upsell for the AI Orchestrator add-on ($19.99/mo, at cost)' — the add-on was removed 2026-07-14 and openCredits is now the Plus/Pro/Max pricing page.
  - evidence: chat.js:4812-4813 '// Focused upsell for the AI Orchestrator add-on ($19.99/mo, at cost). Opened // from the locked Orchestrator switch and the pricing page's add-on band.' immediately above function openCredits(topupsOnly) which builds the membership overlay (MEMBERSHIPS at 4782 = Plus/Pro/Max $24.99/$49.99/$99.99). CLAUDE.md line 29 confirms 'The Orchestrator + Video Editor $19.99/mo add-ons were removed 2026-07-14' and 'Pricing page = openCredits()'. Neither the locked switch nor the add-on band exists (grep 'orch-up' in chat.js/index.html: zero hits).
- **public/styles.css:1643** <dead-drift> — Dead CSS: the removed sidebar workspace nav's rules (.side-nav, .nav-dd-* dropdown, .nav-ico/.nav-gal/.nav-proj/.nav-studio, .side-user/.side-foot/.side-email cluster) match nothing in the DOM or JS.
  - evidence: styles.css 1643-1680 defines .side-nav and the .nav-dd/.nav-dd-btn/.nav-dd-menu/.nav-dd-item/.nav-dd-sep/.nav-dd-account family; grep for 'side-nav', 'nav-dd', 'side-user', 'side-foot' across index.html/chat.js/auth.js returns zero hits (no dynamic construction of these prefixes either). The 6-item Workspace nav was removed 2026-07-15 (owner-notes 'Workspace restructure'), which documented removing the nav but not that its CSS was left behind — unlike the Studio CSS, which owner-notes explicitly records as intentionally kept.
- **public/styles.css:3424** <dead-drift> — Dead CSS: the removed Orchestrator/add-on upsell styles (.orch-up-* at 3424-3443, .addon-* at ~3348-3360, plus .up-modelbox/.up-mchip/.up-mrow etc.) have no matching markup or JS.
  - evidence: styles.css:3424 '.orch-up { text-align: left; ... }' through .orch-up-feat (3435) and styles.css:3348+ .addon-eyebrow/.addon-env/.addon-env-row etc.; grep for 'orch-up' and 'addon-' across index.html/chat.js/auth.js returns zero hits (checked for dynamic prefix construction too — none). These styled the $19.99/mo add-on upsell UI removed 2026-07-14.
- **public/styles.css:4298** <dead-drift> — Dead CSS: CRT 'set' prop rules — .crt-hud/.crt-rec (4298-4302), .crt-panel/.crt-plate (4329-4338), .crt-dial*/.crt-knob* (4340-4352), .crt-laurel, .crt-power — match nothing; the current CRT landing markup has no side panel, knobs, or HUD.
  - evidence: grep 'crt-panel|crt-knob|crt-dial|crt-hud|crt-plate|crt-power|crt-rec|crt-laurel|crtl-note' in public/index.html exits 1 (no matches); index.html's CRT block (lines 33-113) only contains crt-screen/crt-glass/crt-scan/crt-topbar/crt-crest/crt-menu/crt-stage/crt-inbox/crt-chatbox/crt-legal. chat.js builds no crt-knob elements either — its comment at 8742 ('The VHF knob turns with the channel') is stale along with the CSS.
- **public/styles.css:3511** <dead-drift> — Dead CSS: a large block of the replaced Morphic-style marketing landing survives — ~150 of the 314 .mkt-* rules (e.g. .mkt-hero 3511, .mkt-strip 3539, .mkt-pricing/.mkt-plan-*, .mkt-presets, .mkt-final, .mkt-foot-*) plus old Home-landing rules .lp-card/.lp-rec* (2448) match nothing; owner-notes still presents the Morphic design as the shipped landing.
  - evidence: An automated cross-reference of every class selector in styles.css against index.html + all JS flagged ~150 mkt-* classes and lp-card/lp-rec/lp-recent as unmatched (dynamic-construction check done: chat.js only builds 'mkt-c'+n cells and 'mb-p'+n slots, which were excluded). The live landing is the CRT variant (index.html:33 <div id="marketing" class="mkt mkt-crt">) with none of the hero/filmstrip-strip/pricing/footer sections. docs/owner-notes.md lines 103-121 ('Public marketing landing ... Design = Morphic style ... hero, filmstrip, model ticker, preset card rail, six acts feature grid, Plus
- **CLAUDE.md:29** <dead-drift> — Doc drift (minor): CLAUDE.md says "trySave treats 402 as terminal (lastSaveBlock)" — the identifier lastSaveBlock no longer exists; the 402-terminal behavior lives in trySave's returned block field.
  - evidence: grep 'lastSaveBlock' in public/chat.js returns zero hits. The actual mechanism: chat.js:4083 comment 'block is the non-transient 402 reason (free = paid-only, full = cap hit)' and trySave (4086) at 4095-4097 parses the 402 reason and returns it as block — behavior matches the doc, only the named identifier is stale.
- **public/chat.js:2597** <ux-deadends> — While a live TTS voice preview is generating (up to 90s), every other voice's ▶ button — and re-clicks of the same one — silently no-op: the `previewing` guard returns before any UI change on the clicked control.
  - evidence: previewVoice: `if (previewing) return;` (chat.js:2597) runs BEFORE `btn.disabled = true; btn.textContent = '…'` (chat.js:2600-2601), so a second click on any uncached voice does nothing visible. Compounding it, the control is a `<span class="set-voicebtn">` (chat.js:2742), so even the active button's `btn.disabled = true` is acknowledged as a no-op in the code's own comment (chat.js:2584: 'the preview control is a <span>, so btn.disabled is a no-op') — every ▶ stays visually clickable throughout. Reachable path: Settings panel → Voice section → click ▶ on voice A (no static /voices/*.mp3 files
- **public/chat.js:6114** <ux-deadends> — Denying (or approving) one review card wipes EVERY persisted review card in the chat — a second pending card (e.g. the auto-reword offer after a content-filter failure) silently vanishes on the next thread repaint or reload without the user ever acting on it.
  - evidence: clearReviews filters all review messages indiscriminately: `c.msgs = c.msgs.filter((mm) => mm.t !== 'review')` (chat.js:6111-6116), and it's called from both deny (chat.js:6083) and approve (chat.js:6091). Two cards can coexist in one chat: a content-filter kill posts a reworded-prompt review card via offerReword → saveToChat({t:'review',…}) (chat.js:5001-5003), and a subsequent Plan-mode message pushes a second one via reviewPrompt (chat.js:6124). Reachable path: Plan mode → render fails on the content filter → '✍️ …reworded to pass… Approve to try again:' card appears → user instead types a 
- **public/chat.js:5144** <refresh-resume> — Cancel-mid-submit's late response handler calls jobClear(origin) unconditionally by chatId — if the user cancelled and immediately started a NEW generation in the same chat, the old submit's late reply wipes the new run's job record, stripping the new charged run's refresh protection.
  - evidence: Line 5143-5144: `if (!alive()) { jobClear(origin); // cancelled mid-submit — drop the provisional…`. jobClear (line 4045) filters only on chatId, not on the run's idem. cancelGen deletes the chat from activeGens synchronously, so a new generateMedia can start and write its own record (provisional at 5080, or full record at 5188) while the old fetch is still resolving; when the old reply lands, !alive() is true (myGen differs) and jobClear removes whichever record is current — the NEW run's. The new run keeps working in-memory, but a refresh or dropped reply during it now loses the charged rend
- **public/chat.js:4043** <refresh-resume> — jobsWrite caps the job store at 8 records (slice(-8)) with no notice or refund for the dropped one — the 9th concurrently-outstanding paused/in-flight job silently evicts the oldest paid render's only recovery record.
  - evidence: Line 4043: `function jobsWrite(list) { try { localStorage.setItem(JOBS_KEY, JSON.stringify(list.slice(-8))); } catch {} }`. Records are one-per-chat and persist across sessions until terminal (paused jobs live for days across boots, bounded only by tries<4). A user running generations across many chats — or accumulating paused records during an outage — pushes the oldest record off the end silently: no finishDeadJob resolution, no refund attempt, no message, contradicting the 'every render must end visibly' rule (line 4302-4305). An explicit eviction that routes through finishDeadJob would pre
- **public/chat.js:4326** <refresh-resume> — finishDeadJob never attempts idem-based recovery for a dead provisional record (idem but no statusUrl): a job that WAS charged (reply lost, then 4 transient recovery failures) ends with no refund attempt and only an apologetic message, even though the worker's gen_charges lookup could have produced its statusUrl.
  - evidence: Line 4326: `const refunded = j.statusUrl ? await requestRefund(j.statusUrl) : 0;` — for an idem-only record the refund is skipped entirely and the user gets '…if credits were taken for it, use the same prompt to run it again' (line 4330), i.e. pay again. recoverJob (line 4358) shows the worker can resolve idem → status_url/response_url via the recover re-POST (worker.js:1726 gen_charges lookup), but finishDeadJob doesn't use it before giving up, so a charged-but-reply-lost job whose recovery hit 4 transient errors (each `catch { jobBumpTries }` at line 4375) is neither delivered nor refunded.
- **public/chat.js:6589** <refresh-resume> — doSignOut wipes JOBS_KEY and SAVES_KEY unconditionally — signing out while a charged render is paused/in-flight permanently discards its recovery record with no cancel, refund attempt, or notice, even when the same account signs back in.
  - evidence: Line 6588-6591 removes JOBS_KEY and SAVES_KEY (and the account-switch wipe at 6524 does the same). Unlike deleteChat (line 3651-3658), which cancels the active gen and refunds before jobClear, sign-out does neither: an in-flight job keeps running on fal (already charged under the charge-after-accepts flow) and its only client-side record is destroyed, so post-re-sign-in boot resume finds nothing and finishDeadJob never runs. The privacy wipe is intentional for a *different* next account, but for the common same-account sign-out/sign-in it silently loses a paid render; resolving or refunding ou

#### PLAUSIBLE (one skeptic refuted — worth a look, 9)
- worker.js:2508 <provider-leak> [medium] — briefErr passes raw upstream fal error text to the client unscrubbed on submit failure ({error:"submit failed", detail: briefErr(data)}); the worker has no scrubProvider equivalent, so provider hiding
- public/chat.js:3831 <provider-leak> [medium] — Temporary fal.media links delivered to save-blocked users surface the provider domain outside devtools: downloadMedia's fallback opens the raw fal.media URL in a new tab (address bar), and the media m
- worker.js:3675 <director-prompts> [medium] — The studio step's system prompt still sells the removed Studio UI: it tells users about an Export button that stitches shots on-device, export_style transitions, and free on-device trim/speed/reframe/
- worker.js:773 <security> [low] — SSRF guard never resolves DNS, so a public hostname pointing at a private IP is not blocked (DNS rebinding)
- worker.js:4581 <provider-leak> [low] — KNOWN/by-design exposure, noted per instructions: /api/video/poll?url=, /api/cancel and /api/refund carry full queue.fal.run URLs in request params/bodies, and the /api/video response returns fal stat
- public/chat.js:8746 <dom-consistency> [low] — Post-sign-in CRT selector remnants reference ids that exist nowhere: enterCrt looks for #crtSelect (never created, and enterCrt itself is never called), crtNoSignal for #crtNote, and the LIVE paintCrt
- public/chat.js:2508 <dom-consistency> [low] — The entire preset-chip subsystem (PRESET_CATS data, renderPresetsInto, usePreset, renderLpChip, applyPresetRig, ~200 lines) anchors to #lpInput/#lpChipHost/#lpHint, which are created only inside dead 
- public/chat.js:8973 <dom-consistency> [low] — initLeadHero references #leadPh and #leadWord, which exist in no HTML file; the function is itself uncalled (replaced by initCrtStage), so it is dead code whose type() closure would throw on the missi
- worker.js:4596 <worker-routes> [low] — Wrong-method requests to every /api/* route fall through to the static asset handler and return a 404 (asset not found) instead of 405 — e.g. GET /api/save or POST /api/credits gets an HTML-ish 404, a

### 9 HIGH audit findings FIXED (2026-07-17)
All nine high-severity findings from the deep multi-agent audit, fixed +
verified (client fixes headless, worker fixes by logic read):
- H1 (worker) Veo/Fast extend + Sound OFF now sends generate_audio:false on
  the extend endpoint (it accepts it despite bareEdit) — the render is
  silent, matching the audio-off charge. No more ~50% undercharge.
- H2 (client) Merged End-frame pairing was DEAD (lived in the clip/audio
  onload; image files return earlier). Moved into the readImageConformed
  branch — the ONLY place image kinds resolve. Verified: real file-input
  pairing image→ffirst+flast, counter 2/2, demote on end-remove.
- H3 (worker) Stripe invoice.paid now returns 500 if set_plan fails
  (add_credits is idempotent on ref, so Stripe's retry is safe) — paid
  memberships can't silently miss their storage tier.
- H4 (client) Avatar poll now handles FAILED/ERROR/CANCELED with the exact
  error + requestRefund, and refunds on timeout too (no resume machinery).
- H5 (client) Avatar save-block (free/full/error) now toasts that it's a
  temporary link instead of silently persisting/syncing a rotting fal URL.
- H6 (worker) Ask step no longer gets the raw fal model id — a friendly
  label map ("Kling o3 Pro" etc.) feeds the director, plus an explicit
  provider-nondisclosure rule in the ask prompt.
- H7 (worker) Kling o3 clip-edit @ImageN tags preserved — the reconciler
  now counts refs from the payload arrays (image_urls/video_urls/audio_urls)
  instead of the endpoint name, so o3 edits keep their style-ref tags.
- H8 (client) Plan review card price re-quotes live on every settings
  change (matches what approval charges), and a user mode switch drops the
  now-irrelevant card from thread + store. Verified headless.
- H9 (client) Refresh-during-save no longer strands a charged render: a
  delivery claim from a dead tab (different TAB_ID, >40s old) is taken over
  on the next resume tick, and the yield path reschedules instead of
  pausing dead.

### 18 MEDIUM audit findings FIXED (2026-07-17)
All mediums except the 2 Media-Agent ones (skipped per owner). Ray treated
as removed (keyframe remnants cleared defensively, not revived):
- Money: webm clip-edit quote now matches the worker's max-bill for
  unmeasurable containers; GPT auto-ratio 2K/4K demotion keyed off `!ratio`
  (the `=== "auto"` guard was dead → ~2× overcharge); import AI-rescue now
  aborts on use_credits -1 instead of proceeding + minting a false refund.
- Silent failures now surfaced: retryPendingSaves tells the origin chat when
  a queued save's temp link finally expires; galleryDelete restores the card
  + toasts on server failure (no phantom delete); pushAssets requeues on a
  rejected upsert (avatar sync).
- State machine: awDecode swap-guard (slow decode can't stamp the old clip);
  post-send cleanup now clears vxList/axList/kfList/clipMeta (extras no
  longer ride the next prompt at the wrong tier); async image-attach bails
  if the user switched chats mid-conform (no cross-chat leak).
- Worker: /api/save got a content-length backstop (~56MB) before json().
- Director prompts: multiImgLine moved to the references branch (it was in
  the edit branch where it can never render); Gemini refs now get the
  TAGGED guidance (it binds @ImageN natively via <IMAGE_REF_N>).
- UX: approving a Kling shot-list card after switching to a non-Kling model
  now warns instead of silently rendering a single clip; import-from-link
  with a non-URL toasts.
- Resume: finishDeadJob re-persists a bounded (dtries≤3) delivery retry so
  "retry each boot" is real; scheduleResume recovers idem-only provisional
  records in-session and resolves a mid-session tries-cap terminally
  (deliver or refund+message) instead of stalling.

### LOW audit findings — behavioral fixes + doc drift (2026-07-17)
FIXED (behavioral):
- Audio bills on chars ACTUALLY spoken (min(2000, len)) — a 2-4k plan-mode
  script no longer bills above the 2000-char quote.
- Voice-preview failure now refunds the TTS credit + toasts a reason
  (was a bare "⚠" glyph, credit silently kept).
- Denying/approving one review card clears ONLY that card — a second
  pending card (e.g. the content-filter reword offer) survives.
- awPlayer torn down on chat switch — the play button no longer plays the
  previous chat's audio.
- Sign-out now best-effort refunds any in-flight/paused charged render
  before wiping the local recovery records.
- /api/import/fetch free path is now rate-limited (useQuota "import" 120/day)
  — was an unmetered ~29MB server-side fetch relay.
- GPT auto-ratio overcharge (same dead guard as the medium) — fixed.
- Dead-code island removed: IMG_CR/VID_CR/roundTo/estImages/estVideos.
- openCredits header comment corrected (no longer the removed $19.99 add-on).
- CLAUDE.md drift corrected: nav (top tabs + profile menu, not floating
  logo), model routing (ask/error on Haiku; studio dead), model counts
  (12 video + 2 image; Ray/OmniHuman removed), trySave `block` field.

DEFERRED (deliberate — inert or near-unexploitable; sweeping risks the live
app for ~zero runtime benefit):
- Dead JS functions enterCrt/hideCrt/crtNoSignal + renderPublish (Media
  Agent) — never called; live only if some path invokes them (it doesn't).
  Left in place; they cost nothing at runtime and sit in the delicate
  landing/Media-Agent code.
- Dead CSS blocks (old sidebar nav, orchestrator upsell, CRT knobs, stale
  .mkt-*) and the triple .sb-toast (cascade already resolves to the correct
  z-index-400 block; toast is now load-bearing, so not touching it).
- worker `studio` director step — inert (no client sends step:'studio');
  removing risks the big director prompt ternary for no behavior change.
- /api/cancel + /api/video/poll ownership: the fal request IDs are random
  unguessable UUIDs only ever returned to the submitting client, so this is
  near-unexploitable; a proper per-user job→user map is an invasive change
  better done deliberately, not autonomously overnight.
SKIPPED per owner: the 2 Media-Agent findings (orphaned #maThread chat,
/api/social/comment/reply quota).

## 2026-07-17 — Provider-leak scrub (the two real "plausible" findings)

Standing owner rule (absolute): the user must NEVER see "fal" anywhere — not
in any error, anywhere. Two audit findings that survived as "plausible" were
in fact real leaks of the render service's name/host; fixed both:

- worker.js `briefErr()` returned upstream error text verbatim to the client
  (`{error:"submit failed", detail: briefErr(data)}`). Added a worker-side
  `scrubProvider()` (mirrors the frontend one — strips provider URLs, maps
  standalone `fal`/`fal-ai`/`fal.{ai,run,media}` tokens → "the render
  service"; `\bfal\b` never matches inside false/falcon) and routed every
  `briefErr` return through it.
- chat.js `downloadMedia()` catch-fallback did `window.open(rawUrl)` on a
  cross-origin fetch failure — for a temp-delivered (save-blocked) render
  that raw URL is the provider host, so the address bar would show it.
  Now only window.open our OWN hosts (blob:/data:/isibi.ai/supabase.co);
  any other host fails with an sbToast instead of exposing the URL.
- Also aligned the frontend `scrubProvider` with the worker's by adding the
  `fal-ai` whole-token rule (was leaving a "-ai" residue).

Verified headless: page loads clean, scrub kills "fal" in a sample host+token
string, provider host blocked from window.open, supabase/isibi hosts pass.

Latent (NOT fixed — unreachable): chat.js:5455 delivers `out.exr_file.url`
(a raw render-service URL) in chat. Only fires for `luma/` models, which
were all removed with Ray 3.2 — no luma entry remains in the picker, so the
branch is dead. Left untouched (editing dead code buys nothing). If a
luma/HDR model is ever re-added, route the EXR through trySave (own-host
permanent URL) instead of printing the raw link.

Defense-in-depth (NOT fixed — near-zero probability, not an error path):
the ask-step streamed deltas (chat.js onDelta) and the Media Agent reply
render Claude's conversational output unscrubbed. The final ask reply IS
scrubbed (chat.js:5046). These are model prose, not upstream error text,
so provider leakage is near-impossible; Media Agent is out of scope per
owner. Noted for completeness.

## 2026-07-17 — Ray 3.2: full dormant-code removal ("make sure everything from ray3.2 is gone")

Ray was delisted 2026-07-17 (no `luma/` model in either allowlist), but a large
dormant subsystem stayed behind gated on `model.startsWith('luma/')` — which no
model satisfies. Confirmed each piece was Ray-EXCLUSIVE (no live model declares
`hdr`/`loop`/`keyframes`/`controls`/`v2v` caps; Kling o3 + Gemini clip-edits use
their own branches) before excising it all:

- **chat.js:** removed `kfList` + the whole keyframes subsystem (kfCap/onAttachKf/
  removeKf/renderKfList), `hdrOn`/`exrOn`/`loopOn`/`editMode` globals + their
  Settings sections/pickSetting handlers/constraint-web/summary, `rayReframe`/
  `snapRayRatio`/`RATIO_NUMS`, the reframe duration-lock + ratio notes in
  veoDurLock/syncDurLock, the Luma badge (`/^luma\//`) + 'Luma' family filter,
  the HDR/reframe/keyframes/isRayI2V price branches, and the keyframes/reframe/
  controls/hdr/exr/loop/editMode fields from the /api/video payload,
  composerState, staging, and directorContext.
- **worker.js:** removed `sanitizeRayControls`/RayEditControls, the `isRay` decl +
  all three isRay routing branches (reframe / v2v / keyframes), `wantHdr`/
  `wantExr`/`wantLoop`, the `kfs` keyframes intake, `isRayV2V`, the HDR/EXR/loop
  input fields, the Ray i2s/r2s billing (isRayImgEndpoint/isRayStart5s/isReframeEp/
  reframeSecs), the luma prompt-cap, and the director's isReframeRun/rayCtlCapable
  (reframe prompt block, ctxBit, controls schema + parse). `creditCost` lost its
  `hdr/exr/i2v/reframe` params (no model has i2s/r2s tiers). NB: the MP4-box-parser
  `hdr` local and the Nano/Studio `reframe` (aspect re-crop) are unrelated — kept.
- **index.html:** removed `#rowKf` + `#fileKf`. **styles.css:** removed `#rowKf`
  selectors. **CLAUDE.md:** updated the removal note.

Verified headless: every remaining model (3 Veo · 3 Seedance · 3 Kling text +
LipSync · Gemini · 2 image · audio) builds its menu/opts/attach-panel/price with
zero page errors; Ray globals (`kfList`/`hdrOn`/`editMode`/`rayReframe`) are
undefined; `#rowKf`/`#fileKf` gone from the DOM; Kling o3 v2v price still
computes. Screenshot: Veo settings show only Aspect/Resolution/Duration/Sound;
attach rows are Image-to-video/Extend-clip/Reference — no Keyframes/HDR/Loop.

## 2026-07-17 — Media Agent: "Schedule post" tab (Instagram, FRONTEND ONLY)

New section tab in the Instagram Media Agent workspace, between Posts and DMs.
Owner asked to build the frontend now, backend later.

- Composer (reuses the .ma-publish publish-composer look): Media (device file →
  LOCAL preview only, no /api/save upload; or paste a public URL), Type
  (image/reel), Caption, and a `datetime-local` "When" picker (defaults ~1h out).
  A "Preview · not published yet" flag makes the not-live status explicit.
- "Schedule post" validates media + a FUTURE datetime, then appends a record to
  a per-browser queue in localStorage (`zephyr_ig_scheduled_v1`, capped 100).
- Queue cards: thumb (downscaled 400px for images, 🎬/🖼 icon otherwise),
  caption (or italic "No caption"), IMAGE/REEL pill, 📅 date·time, a gradient
  SCHEDULED status pill, and an × remove.
- NOTHING publishes — no backend call anywhere in this tab. Wiring the actual
  scheduled publish (Composio create-post fired at `when`, server-side queue +
  persistence, media upload to a public URL) is the pending next step.

Code: IG_SECTIONS + renderSection dispatch + renderSchedule/schPickFile/
schSubmit/schRemove/loadScheduled/saveScheduled in chat.js; `.sch-*` styles in
styles.css. Verified headless: tab renders, schedules, persists to localStorage,
counts, and removes with zero page errors (screenshotted composer + queue).

Follow-up (same day): the Schedule composer now also offers "🖼 From gallery"
— generalized openPubGalleryPicker to take an onPick callback (defaults to the
Posts composer's pubSelectMedia) and added schSelectGalleryMedia, which stages
the picked hosted URL (image URL doubles as the queue thumb; video uses its
poster) + sets the type + shows a preview with a REEL badge. Still frontend-only
(gallery URLs are already-hosted client-side; no new backend). Verified headless:
picker lists, selects image+video, queues, persists — no page errors.

Follow-up (same day): the Schedule post tab now shows ONLY the composer — the
queue list + "N scheduled" count + "Queue" header were removed (owner: "under
schedule post dont put anything"). Scheduling still persists to localStorage
and now confirms inline ("Scheduled for <date>.") then resets the composer for
the next post. Removed schRemove + the unused .sch-* queue CSS.

Follow-up (same day): the Schedule post tab is now TWO COLUMNS — composer on the
left, a month calendar on the right (owner: "on the right side put now a
calendar there with the posts there that are scheduled"). The calendar reads the
local queue, marks days that have posts (pink tint + up to 2 time chips + "+N"),
rings today, has prev/next month nav, and a click on a day opens that day's list
below the grid (thumb/icon · caption · time·type · remove ×). Scheduling jumps
the calendar to the new post's month + selects its day so it shows immediately.
Still frontend-only. New code: paintSchCal/schDayPanel/schPostsByDay/schRemovePost
+ helpers in chat.js; .sch-wrap/.sch-left/.sch-right/.scal-* in styles.css.

Follow-up (same day): calendar day cells now show the POST THUMBNAIL — each chip
is [thumb][compact time] (e.g. red image + "9am"); a video with no poster falls
back to a 🎬/🖼 icon. Added schTimeShort() for the tight chips (day-panel keeps
the full "9:00 AM"). Verified headless: real thumb data-URLs render as chip
backgrounds, icon fallback for no-thumb.

## 2026-07-18 — Builder buttons: "Outline" language (owner pick)

Explored 10 design directions in artifact mockups (5 recolors, then 5 button
languages on the untouched pink→amber palette). Owner picked **Outline**:
the gradient moves from fills to borders. Applied to styles.css (late block
so it wins the earlier fills):
- .send → hollow, 1.5px pink→amber gradient ring (padding-box/border-box
  trick), soft pink glow; hover deepens interior + glow; disabled keeps the
  ring, no glow (earlier box-shadow:none still applies).
- .send-price → gradient TEXT (background-clip:text), no more filled pill.
- .mode-btn.active → outlined with the gradient ring instead of the gradient
  fill; all .mode-btn carry a transparent 1px border so widths never shift.
Colors untouched. Verified headless on the real app (full screen + composer
close-up), no page errors. The mkt marketing composer reuses these classes
and inherits the same look — consistent by design.

## 2026-07-18 — Gemini edit: EEA/UK/Switzerland friendly error

The fal schema for google/gemini-omni-flash/edit states editing uploaded
videos is NOT available in the EEA, Switzerland or the UK (also: "voice
editing is not supported", and Google's own tip — simple prompts + "Keep
everything else the same." — which our edit-writer already follows). Added
region-rejection detection in BOTH failure surfaces (friendlyFail + the
terminal-4xx poll branch): a blocked EU/UK/CH user now gets "the model maker
blocks it in the EU, UK and Switzerland — pick a Kling o3 model for clip
edits instead" plus the refund note, instead of a raw validation shrug.
Verified headless: fires on the schema's exact wording; content-filter and
validation branches unaffected; no provider named.

Follow-up: owner — no model suggestion in the regional error. Both messages
now state only the cause ("the model maker blocks it in the EU, UK and
Switzerland") + the refund note; the "pick Kling o3 instead" line is gone.

## 2026-07-18 — Website Builder: standalone view, FRONTEND ONLY (v1)

The landing's "WEBSITE / MOBILE APP" channel becomes a real product surface.
Owner's calls: SEPARATE UI (not a chatbox mode) — the only thing it shares
with the media builder is the ✦ credit ledger; V1 = generate + preview +
iterate (no hosting); engine will be Opus + Gemini (owner supplies the Gemini
key later) through the same credit system — BUILD THE FRONTEND NOW.

Built: a "Websites" top-bar tab → viewSites.
- Start screen: brief textarea + "Build it ✦25" (Outline-language button) +
  a grid of saved projects (live srcdoc thumbnails, delete).
- Workspace: left chat rail (thread + "Update site ✦10" revise composer),
  right preview stage with desktop/tablet/phone viewport toggles + Download
  HTML (Blob a[download]). Back → project list.
- Projects persist in localStorage (zephyr_sites_v1, 20 projects × 200KB html
  × last 40 msgs). NOTHING calls any API yet — Generate renders a clearly
  labeled SAMPLE single-file page (CSS-only, prompt-derived accent hue) so
  the loop is testable; flags read "engine hooks up next".
- Engine-phase notes: (1) preview iframes are srcdoc + fully sandboxed and
  inherit the app CSP — inline styles OK, inline <script> BLOCKED, so
  JS-bearing generated sites need a serving route with a relaxed CSP (the
  /mkt/demo* pattern) or a sandbox/CSP rework; (2) credit_back caps refunds
  at 10 credits/call — a ✦25 site fee needs a loop or a raised cap on the
  refund path; (3) UI never names the engine/providers (checked in tests).
- Landing's WEBSITE option stays data-live="0" until the engine is real.

Verified headless end to end: create→build→revise→device toggles→download
enabled→back→thumbnail card→reopen→delete, zero page errors (the sandboxed
preview correctly blocks storage access from inside). Screenshots reviewed.

Follow-up (owner correction): the Websites TAB was wrong — the builder is a
separate product whose ONLY door is the landing's WEBSITE / MOBILE APP
channel. Changes: (1) top-bar Websites tab REMOVED; (2) selecting the WEBSITE
channel on the landing (or typing a brief there and hitting Enter) points the
boot view at 'sites' and routes through auth into the standalone builder —
the typed text arrives as the first site brief (pendingSiteBrief, consumed by
enterApp; never a media prompt); (3) while the sites view is open a body
class (in-sites) hides ALL studio chrome — chats sidebar, Gallery/Avatar/
Media-Agent tabs, the Back arrow — only the profile bubble (shared account/
credits surface) remains; leaving via profile→Settings etc. restores the
chrome; (4) backing out of the auth popup clears the brief and resets the
boot view to home so the next login doesn't land in sites by accident.
OPEN QUESTION for owner: a signed-in user who leaves the sites view has no
way back in (signed-in visits skip the landing) — decide later whether the
account menu gets a "Websites" row or the landing stays reachable signed-in.
Verified headless: landing→channel→brief→auth→standalone builder with chrome
hidden; exit restores chrome; no Websites tab anywhere; zero page errors.

Follow-up (owner reference: Lovable screenshot): the Websites workspace now
MIRRORS Lovable's anatomy, skinned in isibi dark + pink→amber —
- top bar: ← back · project name + "Previewing last saved version" ·
  centered ◉ Preview pill + "Homepage" + refresh · devices, ⤓ download,
  Share, Publish (Share/Publish are visual-only: sbToast "publishing arrives
  with the build engine"; Publish disabled until a build exists);
- left rail: session date stamp + SAMPLE ENGINE flag, Lovable-style messages
  (grey right-aligned user bubbles, plain agent text with a working copy ⧉
  action), "Ask isibi…" composer with + (inert), Build ▾ selector chip,
  gradient ✦ price, round gradient-ring send;
- right: the preview dominating in one rounded shadowed card;
- start screen: centered hero "What are we building?" (Lovable-home style).
All flows re-verified headless (create/build/revise/devices/download/list/
reopen/delete), zero page errors.

BACKLOG (owner, 2026-07-18 — do NOT build yet): Website Builder "Publish"
hosting. Owner is considering a GitHub-repo-per-generated-site model (Pages).
Alternative pitched: Cloudflare-native hosting (Workers static assets / R2
under isibi.ai subdomains — no third-party coupling, instant deploys, own
domain). Decide when the engine phase starts. No work authorized yet.

ENGINE PLAN (owner, 2026-07-18 — for the Website Builder engine phase):
owner's call on models: "Gemini is better at design, Claude better at backend/
architecture." Agreed pipeline: (1) build ✦25 = Claude-cheap spec → Gemini
visual generation → Claude hardening (semantics/a11y/SEO/form wiring);
(2) revision ✦10 = route by intent (visual → Gemini, functional → Claude)
via a cheap classifier, same pattern as the director's effort routing.
Opus reserved for heavy architecture; Gemini Pro on the visual pass keeps
✦25/✦10 margins healthy. Needs GEMINI key from owner (pending) — not built.

ENGINE PLAN amendment (owner, 2026-07-18): Claude side is OPUS ONLY — no
Haiku/Sonnet anywhere in the Website Builder (owner's explicit call). Cost
consequence: a full build runs ~$0.55-0.65 (Opus spec + Gemini visual +
Opus hardening), so ✦25 would lose money → reprice at engine time (working
range ✦50-75 build / ✦15-25 revision; pin from real token measurements).
Pure-visual revisions route to Gemini alone (no Claude call at all); the
revision-intent router must NOT be Haiku/Sonnet — use a keyword heuristic
or Gemini Flash.

Follow-up: GEMINI_API_KEY (already in the GitHub secrets vault, owner
confirmed the exact name) is now wired into deploy.yml — uploads to the
Worker on every deploy alongside FAL/ANTHROPIC/etc. Unused until the engine
lands. Model pinned by live docs check (ai.google.dev, 2026-07-18): Google's
flagship is **Gemini 3.1 Pro** (`gemini-3.1-pro-preview`) — that's the
design-pass model per the owner's "their best LLM" call; re-verify the id
at wiring time (preview ids rotate; fall back to the newest stable Pro).
NOTE: if the deploy fails on the secret upload, the vault name doesn't
match GEMINI_API_KEY exactly — check the Actions log.

## 2026-07-18 — WEBSITE BUILDER ENGINE WIRED (owner: "engine time")

The builder is REAL now. Worker route POST /api/site (before /api/direct):
- Models: design pass = Gemini 3.1 Pro (`gemini-3.1-pro-preview`, verified
  as Google's flagship on ai.google.dev same day); engineering pass =
  Opus (`claude-opus-4-8`). NO Haiku/Sonnet anywhere (owner's call).
- build (✦60): Gemini designs the full single-file site from the brief →
  Opus hardens (semantics/a11y/responsive/SEO, design preserved verbatim);
  a hardening glitch ships the draft rather than failing the paid build.
- revise (✦20): keyword-routed — functional/correctness instructions → Opus,
  visual → Gemini alone. Router is a regex, deliberately not a model call.
- Money: `useQuota("site", 40)`/day BEFORE the charge; `use_credits` up
  front (402 → not enough, cost in body); EVERY terminal failure refunds the
  full fee via a credit_back LOOP (RPC caps 10/call → 6 calls for ✦60).
  ✦60/✦20 are the owner-approved range midpoints; token counts are logged
  (console: "site design tokens" / "site build tokens") — tune from real
  usage. Errors to the client are provider-neutral ("build failed").
- Single-file contract enforced in both prompts: no external resources,
  inline CSS/JS only, responsive 360px+, semantic + SEO meta, forms inert
  (action="#") until hosting/backends land.
- CSP: added `frame-src 'self' blob:` — the preview now renders from a Blob
  URL in a sandbox="allow-scripts" iframe (opaque origin, no app access);
  srcdoc would inherit the app CSP and kill generated sites' own JS.
Frontend: siteSend calls the real engine (first message = build, later =
revise), busy state holds ~1-2 min, replies cover ok/402/429/501/refund,
✦ pill refreshes after every call; prices now ✦60/✦20 everywhere; SAMPLE
machinery deleted; hero flag now "Beta"; localStorage html cap 400KB.
Verified headless with a mocked /api/site: build→blob preview (scripts
sandbox-run), revise request carries current html, 402 + refund messages,
no provider names anywhere. REAL end-to-end needs a live build (keys only
exist on the Worker) — owner runs the first one.
KNOWN EDGE (accepted, same exposure as /api/direct): a connection drop
after the server charged but before the response lands loses the fee with
no auto-retry — revisit with idempotency keys if it ever bites.

## 2026-07-18 — Audit round-2 fixes: BILLING batch (money)

- **Delete account now cancels Stripe FIRST** (chat.js delete handler): calls
  /api/billing/cancel {confirm,immediate} while still authed, then deletes.
  If cancel genuinely fails (502 cancel_failed / network), the delete is
  ABORTED with a message — fails safe (never orphan a live subscription on a
  deleted account = "billed forever"). 501 (payments off) / active:false /
  cancelled:true all proceed. Fixes the HIGH.
- **/api/billing/cancel cancels ALL live subs, added `immediate` mode**
  (worker): collects every live subscription across the caller's customers
  (was: first only) so a duplicate-buy can't leave one billing; immediate=true
  DELETEs each now (used by account deletion), else cancel_at_period_end each.
- **Duplicate-membership guard in /api/checkout** (worker): a plan checkout
  now 409s if the caller already has any live subscription (top-ups exempt);
  fails OPEN if Stripe is unreachable so a first-time buyer is never blocked.
  Client shows the 409 reason in the pricing modal. Fixes the HIGH.
- **TTS undercharge fixed** (worker): input.text is now sliced to 2,000 chars
  — the SAME cap billing uses (was sending up to 4,000 uncut → fal billed us
  up to 2× the charge). Fixes the HIGH.
NOTE: the delete→cancel Stripe path is logic/syntax-verified + fail-safe by
construction; a real-Stripe smoke test (delete a test account that has a live
sub, confirm the sub ends) is worth doing once with a throwaway account.

## 2026-07-18 — Audit round-2 fixes: DATA-LOSS batch

- **Transient media error no longer deletes the message** (buildMedia
  el.onerror): a media element error fires on offline / Supabase 5xx / flaky
  connection too — the old code spliced the message AND synced the deletion,
  permanent loss for a blip. Now it collapses to a "hiccup" note and only
  self-heals (drop + sync) when a Range-GET probe returns a real 404/410;
  offline or any other status keeps the message. Verified headless.
- **zephyr_assets_at_v1 wiped on sign-out AND account-switch** + the in-memory
  `assetsAt` reset to 0 in both paths. Was surviving → the next account's
  pullAssets bailed (remoteAt <= stale clock) and a first edit clobbered their
  server avatars. Fixes the (3 duplicate) HIGH findings.
- **Mid-session re-auth account switch** (finishAuth): a 401 pops the gate via
  showAuthGate() directly (authEntry stays 'stay') → routed to the landing,
  skipping enterApp's account-switch wipe → previous account's chats/avatars
  shown and synced under the NEW account. finishAuth now forces enterApp()
  (full reset) whenever the authed uid != stored owner. Fixes the HIGH.

## 2026-07-18 — Audit round-2 fixes: REFUND / JOB-RECOVERY batch

- **Avatar renders now survive a refresh** (chat.js): the charged render is
  registered in JOBS_KEY under a reserved '__avatar__' key at submit and
  cleared in `finally`. If a refresh/tab-close skips the finally, boot-resume
  (resumeJobs → resumeAvatarJob) recovers it: fal COMPLETED → save the avatar;
  stuck/failed → cancel + refund. The sign-out sweep already refunds any
  pending job (avatar included). Fixes the HIGH (lost credits on refresh).
- **finishDeadJob cancels before refunding** (chat.js): a job wedged IN_QUEUE
  forever is never terminal, so /api/refund couldn't credit it. New
  cancelThenRefund() cancels first (→ CANCELED) so the refund lands. finishDeadJob
  now uses it. Fixes the HIGH.
- **recoverJob no longer destroys the record on a lookup blip** (worker): the
  idem-recovery gen_charges lookup now returns a retryable 503 when it FAILS
  (not-ok/throws/unparseable) — only a SUCCESSFUL lookup that finds no charge
  row falls through to the no-prompt 400 that tells the client to drop the
  record. The client already treats 503 as transient (bumpTries). Fixes the
  HIGH (a transient DB failure was destroying the only recovery record for a
  possibly-charged job).
Verified headless: avatar recover-on-complete + cancel-then-refund-when-stuck,
finishDeadJob cancel-before-refund, all green.

## 2026-07-18 — Audit round-2 fixes: import overcharge + remaining leak flagged

- **Import AI-rescue no longer charges users who can't save** (worker
  /api/import/fetch): before charging ✦3 for the paid image lookup, it now
  checks storageStatus — a cap-0 user (free/lapsed/top-up-only) gets the
  402 {reason:"free"} upgrade block UNCHARGED, instead of paying ✦3 for an
  image the subsequent /api/save would 402 on anyway. Fails open (ledger
  unreachable → proceed) so a real member is never wrongly blocked. Fixes HIGH.

## 2026-07-18 — demo-hero clones: deleted 1 & 3, kept 2 + closed the serve gap

- Owner reviewed all three demo-hero* clones (screenshots) and chose:
  **delete demo-hero (archived landing) + demo-hero-3 (CRT landing), keep
  demo-hero-2** (the full current-app clone — auth.js/chat.js/index.html/
  styles.css) as the design reference.
- **Caught a bug in the prior route guard**: the `448a211` block used
  `/^\/demo-hero(\/|$)/i`, which only matched the bare `/demo-hero` — the
  numbered dirs `/demo-hero-2/` and `/demo-hero-3/` slipped through and were
  STILL BEING SERVED LIVE. demo-hero-2 is the pre-scrub clone (207 "fal"
  mentions in its chat.js), so the leaky one was exactly the one still exposed.
  Widened to `/^\/demo-hero(-\d+)?(\/|$)/i` so every numbered variant 404s.
  demo-hero-2 now stays in the repo as reference but is never served.

## 2026-07-18 — Free-tier video/audio leak CLOSED: same-origin stream proxy (owner picked "a")

- Owner chose option (a): build the streaming proxy, accept the bandwidth.
- **Worker**: two new routes.
  - `POST /api/media-token` (auth'd) — AES-GCM-seals a provider media URL into
    an opaque token. Key is SHA-256(FAL_KEY + "|media-proxy-v1") — no new secret
    to provision. Token = base64url(iv‖ciphertext) of `{u,e}` (url + 7-day
    expiry). Only provider-host URLs seal (regex-gated); returns 400 otherwise.
  - `GET /api/m/<token>` (NO auth — a <video> src carries no Authorization
    header, so the encrypted token IS the capability; only URLs the server
    itself sealed will decrypt). Forwards Range for seeking; streams `up.body`
    same-origin; passes back ONLY a safe header allowlist (content-type/length/
    range, accept-ranges, last-modified, etag) so no provider-identifying header
    leaks. Tampered/expired/wrong-host tokens → 404.
- **Client**: `proxyMediaUrl(u)` mints the token and returns `/api/m/<token>`;
  wired into BOTH temp-link paths in buildMedia — the free/full `block` path and
  the transient `saveFailed` path (video/audio only; images already ride a
  data: URL via the client watermark). Retries the mint 2× (same-origin+authed,
  so effectively always succeeds); only a total failure falls back to the raw
  link (playback beats a broken card). Pending-save records now carry `disp`
  (the shown proxy src) alongside the raw url, so the eventual permanent-URL
  swap + expiry warning still find the right message. downloadMedia now accepts
  same-origin `/api/m/` paths.
- Net: a free-tier / over-cap video or audio render is delivered on a same-
  origin src — right-click "copy address" and devtools both show isibi.ai, never
  the provider. Cost: Worker egress for every free-tier temp-link play (accepted).

REMAINING MINOR LEAK (not yet fixed — flag):
- **EXR sidecar link** (chat.js ~5341) is delivered as a raw provider URL inside
  a plain-text "download it soon" chat line (pro HDR frame data). It's a text
  download link, not a player src, but it still spells out the provider host.
  Lower priority (niche pro feature) but violates the same rule — proxy or drop
  it in a later pass. → DONE 2026-07-18: dropped the EXR block entirely (dead
  code since the Ray/HDR pipeline was excised — no model returns exr_file).

## 2026-07-18 — Audit re-verification pass + 2 remaining fixes

- Re-verified the 19 confirmed MEDIUM findings (+ leak/security) from the Jul-17
  audit against CURRENT code (line numbers had drifted). Result: the vast
  majority were ALREADY FIXED by later work — all money mediums (webm clip 30s
  overcharge → clipMeasurable guard; GPT 4K auto → 1K bill; import-rescue -1 →
  402 guard; /api/save tooLargeBody backstop), the two state-machine races
  (awDecode identity guard, onAttach chat-scope guard), pushAssets requeue, the
  director-prompt mismatches (multiImgLine now in from-scratch branch, gemini in
  the tag branch), plan-card shot-drop (now warns), gallery non-URL (sbToast),
  and the whole refresh/resume cluster (finishDeadJob re-persist + dtries cap,
  scheduleResume idem recovery + terminal tries>=4 resolve, error-step prompt
  scrub). Genuinely still-open, now FIXED this pass:
  - **Provider-leak (chat.js): ask reply + SSE deltas + Media-Agent reply were
    rendered UNSCRUBBED** (only the error step got scrubbed 2026-07-17). Fixed
    at the source: directorAsk now returns scrubProvider(reply) on both the
    streaming and non-streaming paths, onDelta scrubs each delta, and the
    Media-Agent reply is scrubbed. Closes the absolute never-name-the-provider
    rule for the conversational paths.
  - **galleryDelete hard-delete swallowed a non-throwing failure**: storageDelete
    returns res.ok (false on 4xx/expired token) without throwing, but the code
    set ok=true regardless → phantom delete that reappears on next load with no
    message. Now captures the boolean → toast + card restored on failure.
- LEFT ALONE (per owner's "skip Media Agent"): the orphaned Media-Agent
  agent-chat (#maThread/agentRenderThread/agentSend/AGENT_SUGGESTIONS) is
  confirmed unreachable dead code — harmless, can delete on the owner's word.
- Bounded residual (not a regression): a new send in the ~45s window after a job
  hits tries==4 can still clobber the dead record before finishDeadJob refunds —
  down from permanent silent loss to a narrow race. Noted, not urgent.

## 2026-07-18 — Low-severity re-verify pass (33 low + 9 plausible)

Re-verified all 42 low/plausible audit findings against current code. The large
majority were ALREADY FIXED by later work (audio 2000-char billing parity, GPT
auto-ratio demotion, director leak scrub, awPlayer teardown on chat switch,
voice-preview refund, clearReviews per-card, sign-out refund, quota on the free
import path, all the CLAUDE.md doc-drift lines, dead helper blocks, etc.).

Fixed this batch (real-value opens):
- **deleteChat didn't hydrateStaged** — deleting the active chat left the
  fallback chat's refresh-persisted staged inputs hidden (switchChat + boot both
  hydrate; deleteChat didn't). Added hydrateStaged, mirroring switchChat.
- **Gallery load-failure looked like an empty gallery** — a failed /api/gallery
  fetch left serverGallery null and showed "Nothing here yet" on a device that
  DOES have saved media. Added a galleryLoadFailed flag → "Couldn't load your
  gallery just now — check your connection and reopen it."
- **`studio` director step** removed from the /api/direct allowlist (Studio was
  deleted; no client sends it) so a stray step:"studio" falls back to "ask"
  instead of reaching the dead studio branch.
- **vidRefLine only cited @Video1** for multi-clip Seedance reference runs (the
  ctx line already pluralized) — extra staged clips went uncited/inert. Now
  pluralizes to @Video1…@VideoN when >1.
- Stale "sound is director-driven" comment corrected (sound follows the user's
  toggle only, owner rule 2026-07-17).

Still OPEN, deliberately deferred (see the audit report):
- **Pure dead code / dead CSS** (renderPublish, enterCrt/hideCrt/crtNoSignal,
  initLeadHero, preset-chip/renderLanding block, 4 dead CSS blocks, triple
  .sb-toast) — cosmetic only, zero user impact; a bulk-deletion sweep in the
  live app carries more regression risk than value. Do as a dedicated cleanup
  when desired.
- **Refresh/resume money-edges** (jobsWrite slice(-8) silent eviction; finishDeadJob
  no idem recovery/refund for provisional records; cancel-then-new-send jobClear
  scoped by chatId) — narrow charged-render edge cases in the resume machinery;
  worth doing but they touch the just-reworked resume code, so batching them
  carefully & separately.
- **Infra/security decisions**: SSRF DNS-rebinding (no trivial Workers fix),
  /api/cancel+poll ownership check (adds a DB round-trip to a hot path), /api/*
  wrong-method → 404 not 405 (cosmetic).
- **Media Agent** comment-reply route (missing quota + raw error string) — LEFT
  per owner's "skip Media Agent".

## 2026-07-18 — Audit buckets 2 & 3 (resume-edges + infra), and what's deferred

Bucket 2 — resume/refund edges:
- **Cancel-mid-submit now clears ONLY its own record** (jobClearByIdem) instead
  of the whole chat — a new run started in the same chat after a cancel keeps
  its refresh protection.
- **finishDeadJob now attempts an idem recovery** for provisional (idem-only,
  no statusUrl) records before the refund/apology — a charged render whose submit
  reply was lost can be recovered + delivered instead of only apologized for.
- **jobs cap raised 8→24**: routing an evicted record through finishDeadJob would
  wrongly CANCEL a still-live render, so a bigger buffer is the safe mitigation
  for the (already rare) silent-eviction edge.

Bucket 3 — infra:
- **Unmatched /api/* now returns JSON 404** instead of falling through to the
  static asset handler (which served the app's HTML shell to API callers).

Bucket 1 — dead code (done in the prior commit): removed ~320 lines of dead
landing/preset/CRT JS. renderPublish left (Media Agent, standing rule).

DELIBERATELY DEFERRED (with reasons — these are NOT clear wins):
- **Dead CSS** (sidebar-nav / addon / crt-knob / mkt-hero blocks): 100% inert
  unused selectors, but they're scattered and interleaved with LIVE rules
  (.mkt-cell/.mkt-c*/.lp-panel used by the live CRT landing via string-concat
  class names). Excising them risks the live landing for zero user benefit. Do
  as a dedicated, screenshot-verified cleanup if ever wanted.
- **/api/cancel + /api/video/poll ownership check**: a strict gen_charges
  ownership gate would RACE the charge-after-accept write (the row often doesn't
  exist yet when a mid-submit cancel fires) and 403 legitimate cancels; the op
  is already gated by an unguessable fal request-id (very low exposure). Not
  worth breaking real cancels + a DB round-trip on the hot poll path.
- **SSRF DNS-rebinding in safeFetch**: no clean Cloudflare Workers fix (no DNS
  primitive; would need a DoH pre-resolve adding latency to every import). Impact
  is also lower on Workers (no cloud-metadata service to reach) and the literal-IP
  guard covers the common case. Behind auth + quota. Left as documented residual.
- **Media Agent comment-reply route** (missing quota + raw error string): left
  per owner's "skip Media Agent".

## 2026-07-18 — FOUC fix: app shell flashed behind the landing on refresh

Owner noticed: refreshing the landing briefly flashed the app UI (top-bar
tabs / chatbox) for a frame. Cause: `.shell` (the app) had no display:none —
it was only made `inert` behind the landing — while `#marketing`/`#authGate`
start hidden. So on a fresh load the shell painted for one frame before
showMarketing() ran. Fix: `.shell` now starts `style="display:none"` in the
HTML and enterApp() reveals it (`shell.style.display=''`) — the single authed
entry point. Logged-out never calls enterApp, so the shell never paints on the
landing. Verified headless: logged-out, .shell=none from DOM-ready, marketing=flex.

## 2026-07-18 — Website Builder: Opus pass removed, Gemini-only

Owner funded the Gemini key and called it: drop the Opus hardening/architecture
pass — the Website Builder engine is now **Gemini-only** (gemini-3.1-pro-preview).
- build: ONE Gemini pass that both designs AND engineers the site (the old
  Opus-hardening requirements — semantics, 360/768/1200 responsive, a11y, robust
  JS — are folded into the Gemini build prompt).
- revise: all instructions (visual OR functional) go to Gemini; the keyword
  functional/visual routing to Opus is gone.
- Removed SITE_OPUS_MODEL + opusCall; /api/site now needs only GEMINI_API_KEY
  (ANTHROPIC_API_KEY still required elsewhere for /api/direct).
- Pricing UNCHANGED for now (build ✦60 / revise ✦20). Charge timing is already
  correct: credits are only taken when the user clicks Build AFTER typing a brief
  (the /api/site call), never on page load or an empty box — the ✦60 is just the
  price label. NOTE: with Opus gone the real per-build cost dropped a lot, so the
  ✦60/✦20 price is now high-margin — pending owner decision on whether to lower.

## 2026-07-18 — Website Builder: metered billing + send button (no flat fee)

Owner: make it a send button; credits drawn automatically from the REAL cost now
that we have the Gemini key. Done:
- **UI**: "Build it ✦60" → "Build it ↑" (send button, no price). Workspace
  composer ✦20/✦60 chip removed (the ↑ send stays). Hint now: "Credits are based
  on what each build actually uses — and refunded if it fails." Success message
  shows the actual charge, e.g. "(✦13 used)".
- **Billing (worker /api/site)**: metered on real Gemini tokens. Pricing pinned
  from Google's page — gemini-3.1-pro-preview: $2/M in · $12/M out (≤200k-token
  prompts; $4/$18 above), output billed INCLUDING thinking tokens. 1 credit =
  $0.008. Flow: reserve the MAX this call could cost (known input chars/4 + the
  24576 output cap) via use_credits so work is never unpaid → run → refund down
  to the measured usage (usageMetadata: promptTokenCount + candidatesTokenCount +
  thoughtsTokenCount). Full reserve refunded on failure. Response carries the
  actual `cost` + net `balance`; token+credit line is console-logged per call.
- Net effect: a typical build (~8k output) now costs ~13 credits instead of the
  old flat 60 — users usually pay LESS, and always exactly what it cost.

## 2026-07-18 — Website Builder engine → gemini-3.5-flash (fixes the 429)

The 3.1-pro-PREVIEW model 429'd at Paid Tier 1 (preview models get near-zero
quota until the account tiers up — a Google-side limit, not billing; owner's key
IS paid/active). Switched to **gemini-3.5-flash** — the current GA flagship, so
full Tier-1 quota + latest model. Metering repriced to its rate: $1.50/M in,
$9/M out (flat, thinking incl.). Thinking set to "low" (3.5-flash defaults to
medium; thinkingConfig.thinkingLevel is the right field — validated because the
3.1 call reached 429, i.e. passed request validation, not 400). Everything else
(reserve→refund metering, send button, refunds) unchanged. A typical build now
lands around ~9 credits.

## TODO (owner-flagged 2026-07-18) — Website Builder refund is off
- Owner noticed the credit REFUND in the Website Builder came back wrong (net
  balance didn't fully restore on a failed/refunded build — e.g. reserve ✦37
  but balance dropped ~✦17). Suspect: the metered reserve→refund model leans on
  credit_back, which is designed for SMALL (≤10/call) orchestrator reversals and
  may cap/guard total reversal — so a big reserve refund is partial. Revisit the
  billing model: likely switch from "reserve max + credit_back the overage" to
  charging the ACTUAL cost once (use_credits after the call, with a balance
  pre-check) so no large reversal is ever needed. Deferred per owner — fix later.

## 2026-07-18 — Website Builder QUALITY jump (owner: "looks like AI slop")
Three levers, all in /api/site:
- **Real fonts**: SITE_RULES now ALLOWS Google Fonts (<link> to fonts.googleapis.com)
  — the ONLY external resource permitted (still no CDN scripts/frameworks, no
  external images: CSS art + inline SVG only). System-font-only was a big part of
  the generic look. Loads fine in the blob-URL preview (opaque origin, no CSP) and
  in the exported site.
- **Design-director prompt**: build system prompt rewritten as an award-studio
  lead designer with an explicit anti-AI-slop rulebook (distinctive art direction,
  typography as identity, chosen neutrals + restrained accent, editorial/asymmetric
  layout, CSS depth+motion, real on-brand copy) + a list of slop tells to avoid.
- **Thinking**: build now runs at thinkingLevel "high" (design reasoning is where
  quality comes from); revise stays "low" (surgical, cheap). MAX_OUT_TOK 32768→60000
  for room. A high-thinking build now runs ~30-35 credits (metered, still refunded
  to actual); revisions stay cheap.

## 2026-07-18 — Website Builder: REAL image generation (Nano Banana Pro) + billing rewrite
Closes the Lovable gap (they generate photos; now so do we — with our own models):
- **Design pass** emits <img data-gen="<art-directed photo prompt>" data-ar="16:9"> (no
  src) for the hero + up to 4 key visuals; SITE_RULES + build prompt teach the protocol.
- **Server-side pipeline** (worker helpers genOneSiteImage/storeSiteImage/injectSiteImages):
  generate each with Nano Banana Pro via fal's SYNC endpoint (fal.run/fal-ai/nano-banana-pro,
  2K), download → upload to the user's Supabase storage (media/<uid>/site/), swap the real
  hosted URL into the HTML. Generated in PARALLEL. Failures fall back to a gradient data-URI
  placeholder (build never breaks). Cap SITE_MAX_IMAGES=4.
- **Billing rewritten to CHARGE-AFTER-SUCCESS** (fixes the refund undercount the owner flagged):
  no more reserve→credit_back. Flow: readCredits pre-check (≥ worst-case Gemini) → build →
  charge measured Gemini cost → generate images capped to what the remaining balance affords
  → charge per generated image ($0.15=19cr each). Nothing is charged before success, so a
  failure needs NO refund. Response reports actual total cost + net balance.
- Cost: a full build now ≈ Gemini (~25-35cr, high thinking) + up to 4×19 = ~75cr images ≈
  100-110 credits (~$0.85) when it uses the full image budget; fewer images → less. Revisions
  stay cheap (low thinking, usually no new images).
- NOTE: latency is now ~1.5-2.5 min/build (high-thinking Gemini + parallel image gen). If
  Cloudflare/edge ever times out the long request, move /api/site to an async job (return a
  token, poll) — watch for it.

## 2026-07-18 — Website Builder: REAL multi-page (owner: the page switcher should work)
The "Homepage" picker was a placeholder; now it's real multi-page.
- **Engine = two-phase** (worker /api/site build): (1) a PLAN pass (high thinking)
  returns JSON {pages:[{path,name,purpose}], design:"<shared design system: palette
  hexes, Google Font pairing, nav, footer, voice, motifs>"} — decides how many pages
  the brief justifies (1 for a landing, up to 5); (2) each page generated in PARALLEL
  against that shared design system + a nav linking all pages, so the site reads as one
  brand. Images: site-wide budget (SITE_MAX_IMAGES=6) distributed across pages.
  Response: {pages:[{path,name,html}], design}. Revise targets the ACTIVE page (body
  carries html+path+design) → {html, path}. Token metering now ACCUMULATES across all
  the calls; charge-after-success unchanged.
- **Client**: site model = pages[] + active + design (legacy single-`html` sites read as
  one Home page, migrated on first revise). Workspace top-bar picker (st-pagepick) lists
  pages and switches the active one; preview + download + reload follow the active page;
  sub-label shows "N pages". Preview nav: a shim injected into each page intercepts
  internal "/path" link clicks and postMessages the parent (bindSiteNav) to switch the
  picker — so clicking the site's own nav navigates the preview.
- Cost/latency scale with page count (each page = its own high-thinking Gemini pass +
  images). A multi-page build can run several minutes; if the edge ever times out the
  long request, move /api/site to an async job (noted).

## 2026-07-18 — Website Builder: make buttons/forms actually WORK (owner: theirs work, ours didn't)
Our sites looked great but were static — dead buttons, inert forms. Fixed:
- **Engine**: SITE_RULES now mandates working interactions — every CTA/nav link uses
  href="#id" and smooth-scrolls to a section id; mobile menu + tabs/accordions/sliders
  genuinely function; FORMS preventDefault and show an inline success state ("You're on
  the list ✓") since there's no backend yet (never a real-submit, never a dead form); no
  placeholder "#" links. (Replaced the old "forms use action=# inert" rule.)
- **Preview sandbox** widened allow-scripts → "allow-scripts allow-forms allow-popups" so
  the wired forms/links actually run in the preview iframe (was allow-scripts only, which
  blocked form behavior).
- CAUGHT A SELF-INFLICTED BUG mid-edit: a stray backslash made the SITE_RULES string
  close as \"; (escaped) → it was swallowing following code. Fixed; verified the runtime
  value (2034 chars, clean close).

## 2026-07-18 — HOSTING milestone 1: Publish live to R2 (isibi.ai/s/<slug>)
Owner set up the Cloudflare side: R2 bucket `isibi-sites` created; the isibi-app
build token already had Workers R2 Storage:Edit + SSL&Certificates:Edit (so custom
domains are covered later too).
- **wrangler.jsonc**: R2 binding SITES_BUCKET → isibi-sites.
- **DB** (Supabase): published_sites (owner, slug, pages[{path,key}], RLS own-row) +
  site_domains (for custom domains next). Applied via MCP.
- **Worker**: POST /api/site/publish — writes each page to R2 (sites/<slug>/<page>.html),
  rewrites internal <a> nav links to the /s/<slug>/ prefix (so multi-page nav works
  live), upserts the published_sites row under the caller's JWT; republish reuses the
  slug. Serve route: GET /s/<slug>/<page> streams the HTML from R2 (60s cache).
  harden() gives /s/ a PERMISSIVE website CSP (own inline style/script + Google Fonts +
  Supabase images; still no external scripts) instead of the strict app policy.
- **Client**: Publish button → sitePublish() posts the pages, drops the live URL in the
  thread (linkified) + a toast; button flips to "Republish"; Share copies the live link.
  site.liveUrl/published persisted.
NEXT: custom domains (Cloudflare for SaaS) — needs the for-SaaS enablement + fallback
origin in the dashboard, then /api/site/domain to create custom_hostnames + serve by Host.

## 2026-07-18 — HOSTING milestone 2: real forms backend
Generated-site forms now actually save, and the owner reads them.
- **DB**: site_form_submissions (published_site_id, user_id, slug, form, data jsonb).
  RLS: owner-only SELECT; NO insert policy — only the service-role Worker inserts.
- **Worker**: POST /api/site/form (PUBLIC, anonymous) — caps payload (≤30 fields,
  values ≤2k), honeypot (_hp) drops bots, validates the slug against published_sites,
  inserts via the service key. Fails SOFT (always ok:true) + CORS (*) + OPTIONS preflight
  so it works from a live site (and later custom domains). GET /api/site/submissions
  (authed) returns the owner's submissions via their JWT (RLS-scoped).
- **Engine**: SITE_RULES forms now fire-and-forget POST to /api/site/form with
  {slug:(from /s/<slug> in the URL), form, data} + a hidden _hp honeypot, then show the
  success state. In the preview (no /s/ slug) it just no-ops → shows success, stores nothing.
- **Client**: published sites get a 📥 Inbox button in the workspace top bar → siteInbox()
  modal lists submissions (form name, fields, timestamp), newest first. site.slug stored on publish.

## 2026-07-18 — HOSTING milestone 3: real visitor-auth backend (+ live-map fix)
Stress-tested the builder with "user login" + "live map" (checkout deferred by owner).
Findings: map degraded HONESTLY to a real OpenStreetMap iframe (good) but our publish
CSP had no frame-src so it broke on /s/; login was FAKED (ungated /dashboard, "simulation
API" — it did NOT transmit the password though). Owner's call: build the REAL auth backend.
- **DB**: site_users (published_site_id, owner_id→auth.users cascade, slug, email citext,
  password_hash, created_at, last_login_at; unique (published_site_id,email)). RLS: owner
  SELECT only (auth.uid()=owner_id); NO write policy — only the service-role Worker writes.
  Cascades on site delete AND account delete.
- **Worker (brains, storage=Supabase)**: PBKDF2 (100k, SHA-256, 16-byte salt) hashing +
  HMAC-SHA256 signed stateless session tokens (30d), signing key derived from
  SUPABASE_SERVICE_KEY (no new secret). Endpoints:
  · POST /api/site/auth/signup {slug,email,password} → hash+insert, returns {ok,token,email}
  · POST /api/site/auth/login → verify (constant-time), returns {ok,token,email}
  · GET  /api/site/auth/me (Bearer) → validates token for member-page guards
  · GET  /api/site/members?slug= (owner JWT, RLS) → the site's sign-ups
  Validation: email regex, password 8–200, dup→friendly error, honeypot, empty-slug→
  "not published yet". Unit-tested crypto (12/12) + live e2e (signup/login/wrong-pw/me/
  tamper/dup/bad-email/short-pw/bad-slug all correct; DB confirmed pbkdf2, no plaintext).
- **Engine (SITE_RULES)**: wires login/signup/member-pages to the real endpoints (store
  token in localStorage zephyr_site_auth_<slug>, guard member pages via /me, real logout,
  show the member's REAL email); NEVER-FAKE guardrail (no pretend login, no ungated
  dashboard, no password field posting to the form inbox, honest degrade). LIVE-MAP protocol:
  real OSM iframe embed for address/find-us (the one allowed iframe). Publish CSP now allows
  frame-src for OSM + Google Maps.
- **Client**: published sites get a 👥 Members button next to 📥 Inbox → siteMembers() modal
  (email, joined, last login).
- **Note**: accounts work on the PUBLISHED site (real slug), not the in-builder preview —
  same as forms. Member-page gating is client-side (standard for static sites); the accounts/
  passwords/sessions themselves are fully real + server-side. Deployed 4ef7096.

## 2026-07-18 — Preview parity: real identity on BUILD (not just publish)
Owner asked why auth only worked on the public URL (Lovable's preview works). Answer:
our preview is an isolated blob iframe with no site identity until publish. Fix: give
every site a real identity the moment it's built.
- **Worker /api/site build**: after the pages are built it mints (or reuses by site_id)
  a slug and inserts a DRAFT published_sites row (pages stay off R2 — a draft isn't
  publicly served, publish still does that), returns {slug}. The row existing is what
  /api/site/auth + /api/site/form validate against, so accounts/forms work in preview.
- **SITE_RULES**: generated sites now define siteSlug() (reads window.__SITE_SLUG__ first,
  else the /s/<slug> path) + a throw-safe `store` helper (try/catch localStorage → in-mem
  fallback, so it never crashes in the sandboxed preview). Forms + auth use them.
- **Client**: build sends siteId + stores the returned draft slug; sitePreviewSrc injects
  window.__SITE_SLUG__ into the blob preview (runs before the site's JS); 📥 Inbox + 👥
  Members now show as soon as the site has a slug (draft), not only after publish.
- **Note/limit**: signup/login/forms/maps now work in the preview (real backend calls,
  real accounts — visible in Members). Full logged-in navigation ACROSS member pages still
  needs the live URL (the sandbox can't persist a session across blob page-swaps); on the
  published /s/<slug> it all works. True in-preview session nav would need a separate preview
  origin (ties to the deferred custom-domain work).

## 2026-07-18 — Website Builder workspace: Lovable-style chrome + wired Analytics/History
Reskinned the workspace to mirror Lovable (owner reference), then wired two for real.
- **View tabs**: Preview / Code / More. Code = page file list + read-only HTML (line
  numbers, per-page download). More = Analytics / Cloud / Security / SEO sub-nav.
- **History rail** (⟲): lists every version; **Restore** rolls back (snapshots current
  first so it's undoable). Snapshots stored in site.history (cap 8) in localStorage;
  sitesSave drops history first if storage is tight so current state always persists.
- **Publish panel**: live URL / visibility / visitors / Republish / Copy (Unpublish soon).
- **"Try to fix"** error card over the preview on a failed build/revise → re-runs a fix.
- **Icons**: all workspace emoji replaced with a monochrome inline-SVG set (currentColor).
- **Analytics WIRED (real)**: site_hits table + site_analytics() RPC (owner-scoped).
  Worker logs one hit per served /s/<slug> page (ctx.waitUntil, bots skipped, IP hashed
  → distinct-hash = visitors). GET /api/site/analytics. Panel shows real Visitors/Page
  views/Views-per-visit + 7-day bar chart. Live-tested: 5 browser hits logged, Googlebot
  skipped, RPC returned the right totals, ownership guard rejects non-owned slugs.
- Still visual-only (full features, not quick wires): Cloud Database/Emails/Secrets/Edge,
  Security scan, SEO→head-tag injection, Unpublish.

## 2026-07-18 — Wired: Unpublish, live Cloud cards, Opus security scan
- **Unpublish** (real): POST /api/site/unpublish deletes the site's R2 objects
  (live pages 404) but KEEPS the published_sites row + slug, so Republish (reuses
  slug by site_id) restores the SAME URL and members/submissions survive. Wired to
  the Publish panel's Unpublish button. Live-tested: 200 → 404 → republish same slug 200.
- **Cloud cards**: Members / Submissions cards clickable → open the real Members /
  Inbox panels (when the site has a slug).
- **Security scan (REAL — Opus 4.8)**: POST /api/site/scan sends the generated code
  to claude-opus-4-8 with a report_findings tool; returns structured findings
  {severity, title, detail, page}; charged 8 credits ONLY on success (402 if short).
  Panel: "Deep security scan · Run scan" → severity-coloured issue cards, or
  "No issues found". Live-tested on a planted-vuln page: found all 4 (critical
  hardcoded key, high XSS via location.hash, high http:// mixed content, low
  target=_blank tabnabbing) with correct severities; charged 8 credits.
- Still genuine backend PRODUCTS (not wires), left "Soon": Cloud Database / Emails /
  Secrets / Edge functions, and SEO→head-tag injection (owner said skip SEO for now).

## 2026-07-18 — Wired: Cloud → Database (collections)
Public, displayable data store the generated site both writes and reads — for
dynamic content (testimonials/reviews, menus, guestbooks, listings). Forms stay
the PRIVATE inbox; collections are PUBLIC by design.
- **DB**: site_collections (published_site_id/owner_id/slug/collection/data jsonb).
  RLS owner read+delete; service-key writes; FK cascade on site/account delete.
- **Worker**: POST /api/site/data (anon, fail-soft, honeypot drops bots — check is on
  data._hp not just body, fixed in testing; ≤500 records/collection cap) ·
  GET /api/site/data?slug=&collection= (PUBLIC read, newest-first, cap 100) ·
  GET /api/site/collections?slug= (owner list, RLS).
- **SITE_RULES**: collections protocol — save via /api/site/data {slug,collection,data}
  + _hp honeypot; render by GET on load; PUBLIC + newest-first.
- **Client**: Cloud → Database card is Live + opens a modal grouping records by
  collection (owner view). Reuses the si-modal styling.
- Live-tested: 2 reviews saved + read back publicly, owner list grouped by collection,
  bot honeypot dropped (0 records after the fix).
- Remaining Cloud "Soon" (real products, not wires): Emails, Secrets, Edge functions.

## 2026-07-18 — Wired: Cloud → Secrets (encrypted vault)
Owner-managed secrets vault — same contract as Lovable's Secrets page.
- **DB**: site_secrets (owner_id/slug/name unique, value_encrypted, timestamps).
  RLS owner read+delete; service-key encrypted writes; FK cascade.
- **Crypto**: AES-GCM, key derived from SUPABASE_SERVICE_KEY (siteSecretKey/encryptSecret).
  Values encrypted before storage; NEVER returned (list = name + timestamps only;
  rotate = re-POST; delete). No decrypt path yet — consumed server-side by Edge
  functions (the next build).
- **Worker**: POST (verify slug ownership → encrypt → upsert on owner_id,slug,name) /
  GET (names only) / DELETE /api/site/secrets (owner JWT + RLS).
- **Client**: Cloud → Secrets card live → vault modal (add name/value, list w/ dates,
  delete). Reuses si-modal.
- Live-tested: add → stored AES-GCM (leaks_plaintext=false) → list returns no value →
  rotate updates the row → delete removes it. (First POST 404'd on edge-propagation lag,
  fine a second later.)
- Remaining Cloud "Soon": Emails, Edge functions (Edge functions = the consumer that
  reads these secrets server-side).

## 2026-07-19 — Bugfix: Website-Builder site photos leaking into the Gallery
- **Owner reported:** the Gallery showed ~6 photos they never generated (real-estate
  houses/interiors). Investigated: NOT a leak — they were in the owner's own
  aniascristian bucket under `media/<uid>/site/`. Root cause: the Website Builder
  generates real photos for a site (`storeSiteImage`, Nano Banana Pro, worker.js
  ~2241) and saves them to `media/<uid>/site/…` with the user's JWT, so they landed
  in the same bucket the Gallery lists → surfaced as gallery cards.
- **Owner's rule:** only media generated in the chat image/video/audio generator
  belongs in the Gallery. Builder site images do not.
- **Fix:** `/api/gallery` already skipped the `<uid>/chat/` subfolder; extended that
  filter to also skip `<uid>/site/` (one predicate, worker.js ~3573). Covers every
  consumer of the list (Gallery view + attach-from-gallery picker) since it's the
  single source. Verified the filter against the real filenames (drops site/+chat/,
  keeps bare `<uid>/<file>` chat generations).
- **Left intact on purpose:** the site images stay in storage (the published site
  references them by direct public URL — deleting them would break the live site),
  and they still count toward the storage cap (they do occupy space). Only the
  Gallery *display* changed. Owner just refreshes the Gallery and the 6 are gone.

## 2026-07-19 — Full Website-Builder test sweep (backend + frontend)
Owner asked to "run tests on the website builder, front end and backend." Ran a
live integration sweep against isibi.ai + a headless frontend smoke test.
- **Backend 48/48** (throwaway isibi user + published site + 2 seeded fns, all
  torn down): serving (`/s/<slug>`, `/reset`, `?token` survives, 404); visitor
  auth (signup/dup-block/login/wrong-pw/`/me`/bad-token 401); password reset
  (always-ok/no-enum, garbage+short-pw rejected); forms (stored, honeypot dropped,
  owner inbox); database (save+read, honeypot dropped, **query engine**
  where/sort/limit/total/free-text all correct); edge functions (`/fn` runs +
  save-step persists, unknown 404, **webhook runs**, **stripe-verify w/o signature
  → 400**); uploads (PNG stored+serves, SVG→415, no-slug→400, owner list); secrets
  (store/list-names-only/**plaintext never returned**); owner reads
  (members/analytics/gallery); **auth guards** (all owner endpoints 401 w/o JWT).
  Also incidentally verified unpublish (site → 404) during teardown.
- **Frontend 12/12** (headless, session injected, served locally): boots with
  **zero uncaught JS errors**; all 8 Cloud fns defined+wired
  (siteFunctions/Files/Emails/Payments/Secrets/Members + showView/renderGallery);
  Payments + Emails guide modals render correctly (screenshotted). Modals guard
  correctly when no site is open (sbToast, no throw).
- **No product bugs found.** Red marks during the run were all test-harness bugs
  (wrong field name, doubled data on re-runs, modal called without its `site` arg).
- **Round 2 — security/guard sweep, 12/12** (public endpoints, seeded site torn
  down): **SSRF guard verified live** — edge-function `fetch` to cloud-metadata
  `169.254.169.254` and to `127.0.0.1` both BLOCKED (safeFetch → null → step
  status 0, target never hit); public HTTPS host reachable. Checkout w/o STRIPE_KEY
  refuses (no stripe url, error surfaced); email w/o RESEND_KEY doesn't send. **All
  query operators** correct: `in` (comma-separated), `ne`, `contains`, range
  (`gte`+`lte`), `sort`, `limit`+`offset` paging, `total`. Unknown fn → 404,
  malformed numeric filter doesn't crash. Rate limiter (120/min/slug) is
  per-isolate best-effort — not trippable reliably from outside (CF spreads the
  burst); code verified in review.
- **Not run (costs money, pending owner OK):** the 3 paid AI paths — site
  generation (Gemini), security scan (Opus), builder image-gen (fal).

## 2026-07-19 — Builder Attach: choose device vs. gallery
Owner: the builder's **Attach** button should ask *where from* — a device file
or one of the user's own isibi gallery creations — instead of jumping straight
to the file picker.
- **What:** `siteAttachOpen()` now opens a small "Add an image" chooser (si-modal)
  with two options: **From device** (the old file-input flow, moved to
  `siteAttachDevice()`) and **From your gallery** (`siteAttachGallery()`).
- **Gallery picker:** grid of the user's IMAGE gallery items (reuses
  `galleryItems()` → filtered to `kind==='image'`, so it honors the earlier
  site-image exclusion — only real chat generations show). Multi-select up to the
  remaining slots (3 total), amber border + gradient check on selected, a
  gradient **Add N** button. On Add, each pick is fetched as a blob and turned
  into a data URL via `galleryUrlToData()` (Supabase public bucket is CORS-open,
  so the canvas is never tainted); only downscales (≤1600px JPEG) when a file
  would blow the 5 MB attach cap. Same `{data,name}` shape the device path +
  worker (`images[].data` → Gemini inlineData) already expect — no backend change.
- **CSS:** `.stac-opts/.stac-opt` (chooser rows) + `.stg-grid/.stg-cell/.stg-check/
  .stg-foot/.stg-add` (picker) in styles.css.
- **Tested:** headless 6/6 — chooser shows both options; picker renders cells,
  Add disabled until selection, "Add 2" after picking two, selection capped at 3,
  zero JS errors. Screenshotted both (chooser + picker), on-brand.

## 2026-07-20 — Builder: chat-driven page management (add / remove / global edit / regenerate)
Owner (from the "what else" list): do #4 (streaming) plus #1-3 — add a page,
edit across all pages, regenerate a page — **all driven by CHAT, no UI:** "that
gotta be for the chat, like user telling the ai to do it, i dont want ui for
that." Also confirmed #5: yes, an edit/revise CAN add more images (revise runs
`injectSiteImages`), so image budget stays conservative (SITE_MAX_IMAGES=6).
This note covers #1-3 (chat-routed page ops). #4 streaming is the next step.

- **How it routes:** the existing conversational-gate classify (the one call that
  already runs on every revise to decide chat-vs-act) now ALSO returns, when a
  site is open, a `kind` ∈ {edit, global, addpage, removepage, regenerate} + a
  `page` name. No extra Gemini call — folded into the gate. Biased to `edit`
  (the safe default) when unsure. The client sends the full page set
  (`pages:[{path,name,html}]`) on every revise so site-wide ops have every page.
- **global** — "make the footer say X on every page", "change the nav color
  across the site": ONE surgical find/replace set computed from the open page,
  then applied to EVERY page. Safe because the shared chrome/CSS is byte-identical
  across pages (the #3 composition guarantee), so an anchor in one page anchors in
  all. If nothing anchors, falls through to a normal single-page edit.
- **addpage** — "add a contact page", "create a blog": generates the new page's
  `<main>` + a COMPLETE new shared nav that includes a link to it; `replaceNav()`
  swaps that nav into every existing page (marking each page's own active link via
  `markActiveNav`), and the new page is composed onto the shared shell
  (`extractSiteKit` recovers head/nav/footer from an existing page). New page
  appended; client's page-picker shows it automatically.
- **removepage** — "delete the about page": drops the page (never home) and strips
  its nav link (incl. an enclosing `<li>`) from every remaining page.
- **regenerate** — "redesign this page", "start the home page over": rebuilds ONE
  page's `<main>` from scratch onto the UNCHANGED shared shell (chrome identical),
  replacing just that page.
- **Return shape:** all four return the full updated page set `{pages, active}`;
  the client replaces `s.pages`, sets the active page, snapshots for history, and
  re-renders (picker + preview update). Single-page `edit` is unchanged
  (`{html, path}` + surgical/no-op/fallback).
- **New helpers (worker.js):** `extractSiteKit(html)` (strips per-page title/
  desc/og/twitter/favicon + aria-current → the neutral shared shell), `replaceNav`,
  `shipPages` (charge tokens + image pass within budget + polishHead + persist
  edge fns, per op). Metered like every builder call (charge-after).
- **Tested:** 29/29 pure-helper unit tests (extract/compose/replaceNav/nav-strip/
  global-anchor/regen/stripToMain) green before deploy. Live sweep pending deploy.

## 2026-07-20 — Builder #4: live streaming build progress
Owner wanted the build to feel alive instead of one static "Building…" for a
minute+. The build step (`/api/site`, step=build) now STREAMS NDJSON instead of
returning one JSON blob:
- **Worker:** wraps the build in a `TransformStream`; `emit()` writes one JSON
  line per event — `{ev:"status",msg}` at each phase (Planning → Designing N
  pages → Adding photos), `{ev:"page",name}` as EACH page finishes generating
  (fires from inside the parallel map), and a terminal `{ev:"done", …same
  payload the JSON build returned}` or `{ev:"error",code}`. `ctx.waitUntil(run())`
  keeps the async writer alive after the handler returns the open stream. Billing
  unchanged (charge-after, inside the run). Revise stays plain JSON (it's fast).
- **Client:** `readSiteStream()` reads the NDJSON, calls `siteBuildStatus()` to
  update the live step line IN PLACE (`.st-busy` in the thread / `.st-empty` on
  the stage) with NO full re-render (which would reload the preview iframe
  mid-build). The terminal event is reduced to the same object shape the old code
  handled, so the existing result branches are untouched. Detected via
  `Content-Type: application/x-ndjson`; Stop (AbortController) still cancels it.
- **Tested:** real chunked-NDJSON Node server + Playwright, 12/12 — live line
  transitions through Planning → "Designing 2 pages…" → "Home ✓/About ✓", final
  applies (2 pages, slug, ✦cost, success msg, busy cleared, page picker appears);
  a mid-stream `{ev:"error"}` surfaces the failure card + "(code 502)" and applies
  no pages; zero uncaught JS errors. Screenshotted the built result (renders).

## 2026-07-20 — Builder: site + URL named after the AI brand, not the raw prompt
Owner: the project cards / URL shouldn't be the raw first message ("hey", "make
me a website") — the builder should name the site itself. It already picks a
BRAND in the plan pass (e.g. "HEY STUDIO"); now that brand becomes the identity:
- **Worker:** the build `{ev:"done"}` payload now includes `brand`; the draft
  slug is derived from the brand (→ `hey-studio-ab12cd`) instead of the brief,
  and the `published_sites.title` is the brand too.
- **Client:** on a successful build, the project card is renamed from the raw
  prompt to `d.brand` (capped 40 chars). Applies to NEW builds; existing cards
  keep their old names (no retroactive rename). The URL slug is brand-derived
  server-side, so publish/preview links read as the brand.
- **Tested:** E2E 13/13 — card renames to "Brew Coffee Co", slug carried from the
  stream, all prior streaming/routing assertions still green.

## 2026-07-20 — Builder: live "activity log" during a build (Claude-Code style)
Owner: the streamed steps worked but felt slow/sparse — long silent gaps between
the server's checkpoints (plan → each page → photos). Wanted it to look
continuously live, like Claude Code narrating its process in a running sub-thread.
- **Client ticker:** a `setInterval` (1.5s) rotates an ACTIVE line through
  phase-appropriate phrases (plan: "Planning the pages / Choosing a design
  direction / Picking fonts…"; design: "Designing {page} / Writing the copy for
  {page} / Styling components…"; photos: "Art-directing the photos / Generating
  imagery…"), so words keep moving even during a single long Gemini call. Starts
  the instant Send is hit → zero dead air before the first server event.
- **Running log:** finished checkpoints accumulate as dim `✓` lines
  ("✓ Planned the pages", "✓ Home", "✓ Listings"); the current step is the
  bright pulsing line. Rendered in BOTH the chat rail and the empty stage during
  the first build. Painted in place (no re-render → preview iframe doesn't flash).
- **Server:** status events now carry `phase` (plan/design/photos) + the real
  page-name list, so the ticker can weave in the actual pages and the active line
  prefers pages not yet ✓.
- Revise (fast) keeps a simple "Working" pulse. `st-livelog`/`st-ll` CSS added.
- **Tested:** E2E 15/15 (ticker shows plan+design words, "Planned the pages ✓"
  checkpoint, real page names, ≥3 moving frames, final build applies, brand
  rename, streamed-error path); screenshotted the mid-build log (rail + stage).

## 2026-07-20 — Builder: absorb model rate-limits (429) instead of failing
Owner hit "That build didn't come together (code 429)" during rapid testing. 429
= the Gemini API rate-limited the key (a burst of builds, each firing plan + all
pages at once, tripped the per-minute cap). Not the daily build quota (that shows
a different message) and nothing was charged.
- **Worker (geminiCall):** now RETRIES transient 429/500/503 with backoff
  (1.5s → 4s → 8s, up to 4 attempts) before throwing. A short wait clears a
  per-minute rate cap, so most bursts now recover silently. Non-rate errors and
  the final attempt still throw as before.
- **Client:** a 429/503 that still gets through shows a friendly "⏳ The builder's
  busy right now — give it a few seconds, then send again" (no scary error card,
  no charge) instead of the generic "didn't come together (code N)".
- **NOTE for owner:** if 429s persist even after the retries, the Gemini API key's
  quota (per-minute or per-day) is genuinely exhausted and needs a higher tier on
  the Google AI side — that's an account/billing change, not a code fix.

## 2026-07-20 — Builder: resilient geminiCall + real error codes (code -1 was hiding the cause)
Owner hit "That build didn't come together (code -1)" intermittently even on
Tier 1 (huge quota). Root problem: -1 = a thrown Error with no HTTP status
("build returned no pages"), which MASKED the real per-page failure. Most likely
cause is empty model responses (a transient blip, or high-thinking eating the
whole token budget → finishReason MAX_TOKENS with no visible text).
- **geminiCall rewrite:** now retries BOTH transient HTTP (429/500/503) AND empty
  responses, with backoff (1.2/3/6s, 4 attempts). On a MAX_TOKENS empty it drops
  the thinking level to "low" for the retry so there's room for real output. Also
  retries network errors. The thrown error now always carries the TRUE status.
- **"no pages" error** now reports the real underlying status/detail (429 / 0-empty
  / http) instead of a bare -1, so the next failure (if any) is diagnosable from
  the code shown to the owner.
- Net effect: transient empties/rate-blips now self-heal; a genuine failure shows
  an honest code. Regression E2E 15/15.

## 2026-07-20 — Builder: model fallback when gemini-3.5-flash is overloaded (503)
The honest error codes (prev fix) revealed the real failure: **code 503** —
Google's `gemini-3.5-flash` was overloaded/unavailable on their side (not quota,
not our bug), and it persisted through the in-model retries.
- **Fix:** geminiCall now keeps a stable fallback (`GEMINI_FALLBACK =
  gemini-2.5-flash`). On a 503/500 from the primary, it switches to the fallback
  model for the remaining retry attempts — so a capacity blip on one model no
  longer kills the build. 429 (rate) still just retries on the primary.
- Both are cheap Flash models; the credit metering padding covers the small
  price difference on the rare fallback path.
- Regression E2E 15/15.

## 2026-07-20 — Builder engine switched: Gemini Flash → Claude Sonnet 5 (owner's call)
After the Gemini 503/429 saga, owner chose to move the website-builder engine to
**Claude Sonnet 5** — the same model class Lovable runs on (much stronger design +
code), on the owner's Anthropic key (far higher limits than Gemini's Tier-1 quota).
- **`geminiCall` now calls the Anthropic Messages API** (`claude-sonnet-5`), same
  `(system, user, thinking, imgParts)` signature so every build/revise call site is
  unchanged. Kept the name `geminiCall` to avoid churn (it's just the internal
  helper). `thinking` "high" → max_tokens `MAX_OUT_TOK` (20000), "low" → 8000. No
  extended thinking (keeps it fast, like Lovable). Retries 429/500/503/**529
  (overloaded)** + empty/truncated with backoff; errors carry the true status.
- **Guard** switched `GEMINI_API_KEY` → `ANTHROPIC_API_KEY` (already a Worker
  secret, used by the director + scan). Gemini model/fallback consts removed.
- **Image attachments** now sent in Anthropic format
  (`{type:image, source:{type:base64,media_type,data}}`).
- **Billing repriced** to Sonnet 5 rates: `toCredits = ceil((in*3e-6 +
  out*15e-6)/0.008)` (was Gemini's 1.5e-6/9e-6). A typical build now costs the
  user meaningfully more credits, matching the ~$0.5–0.9 real API spend — so the
  owner isn't eating the difference. `MAX_OUT_TOK` 60000→20000 (Anthropic output
  cap; thinking no longer shares the budget).
- Image GENERATION (site photos) is unaffected — that's a separate path, not the
  text engine.
- Client unchanged; E2E 15/15. Live build test pending owner.

## 2026-07-20 — Builder: kill the black flash when switching pages
Owner: switching pages showed a <1s black screen (Lovable doesn't). Cause: the
page picker called renderSites() → full workspace re-render → the iframe element
was DESTROYED and recreated (a fresh iframe paints blank until its src loads), and
only THEN did loadSitePreview POST for the new URL — so there was a guaranteed
blank window, on a near-black iframe bg.
- **Fix:** new `switchSitePage(path)` swaps the page IN PLACE (preview view only):
  keeps the SAME iframe (browser holds the current page visible until the new one
  commits → seamless), and just updates the picker label, the "on" state, the URL
  chip, and reloads the iframe's content. Wired the picker items + the in-preview
  link nav (postMessage shim) to it; Code/More views still full-render.
- Iframe bg `#0c0b10` → `#fff` so any residual sub-frame gap reads as a normal
  white page load, not a black void.
- **Tested:** headless 9/9 — iframe element identity survives two switches (proves
  no recreate), picker/URL/active update correctly, white bg, zero JS errors.

## 2026-07-20 — React builder: PROJECT KICKOFF (owner: go full Vite/React like Lovable)
Owner decided to move the builder from static HTML to real React apps (Lovable
parity), hosted all-on-Cloudflare (Worker + **Cloudflare Containers** for the
build + R2). Chosen over no-build React and over StackBlitz WebContainers (that's
non-commercial-free / Enterprise-contact-sales only). Cloudflare Containers cost:
$5/mo Workers Paid base incl. ~200-300 builds/mo, then ~pennies/build.
Building in PHASES; the live static-HTML builder stays working until React is proven.

- **Phase 0 (DONE, validated locally):** a Vite+React+Tailwind project compiles to
  a static `dist/` with RELATIVE asset paths (`./assets/…`) → serves from the
  existing `/s/<slug>/` R2 path with NO hosting change. npm i ~16s, `vite build`
  ~1.5s. Key insight: the built React app is just static files — publish path is
  unchanged; only a build STEP is added.
- **Phase 1 (DONE, tested 9/9):** the container build-service — `builder/`
  (Dockerfile + build-server.mjs + template/ + pinned deps: react, react-router-dom,
  lucide-react, tailwind). The image bakes deps so each build is just `vite build`
  (~2.4s round-trip incl. a multi-file app with router+components+state). Server
  contract: `POST /build {files}` → `{ok:true, files:dist}` or `{ok:false, error}`
  (compile errors returned, not crashed — feeds the Phase-4 auto-fix loop). Path
  writes allow-listed (index.html/vite/tailwind/postcss/src only; traversal +
  node_modules blocked). Docker daemon isn't in the sandbox so the IMAGE build is
  untested here, but the server logic is proven against the real pinned deps.
- **Phases remaining:** 2 = rewrite the generator so Sonnet emits a Vite/React
  project (highest risk = AI producing compilable code; needs live spend to test);
  3 = Worker↔Container orchestration + R2 publish (needs **Cloudflare Containers
  enabled on the account** — owner step); 4 = build-error auto-fix loop + live code
  view + cutover from static HTML.

## 2026-07-20 — React builder Phase 2 (DONE, validated): generation format + parser
The generator contract for emitting a React/Vite PROJECT (not static HTML):
- **`builder/react-gen.mjs`** — `parseGeneratedFiles(text)` + `REACT_RULES` +
  `REACT_DEPS`. Sonnet emits the whole project as `===FILE: <path>===` blocks
  (delimiter format, NOT JSON — avoids escaping code); the parser turns that into
  `{path: source}` ready for the build-service. Strips accidental ``` fences.
- **REACT_RULES** contract: required files (index.html, src/main.jsx w/ **HashRouter**,
  src/App.jsx <Routes>, src/index.css, src/pages/*, src/components/*, optional
  tailwind.config.js); import ONLY the pinned deps (react, react-router-dom,
  lucide-react, clsx, tailwind-merge); Tailwind classes only; real content, no dead
  controls; images via `@@IMG:<prompt>@@` STATIC-literal tokens (platform swaps in
  hosted URLs before build).
- **Two real findings baked in:** (1) **HashRouter, not BrowserRouter** — the site
  serves from `/s/<slug>/` sub-path on static R2, so hash routing is required (no
  server rewrites, works under any base). (2) `@@IMG@@` tokens must be static string
  literals (no runtime `+`/`${}`), else they can't be safely swapped/embedded.
- **Validated 11/11 end-to-end** (`react-pipeline-test.mjs`): a realistic 12-file
  wedding-photographer app (router + reusable components + state + forms + images)
  → parse → resolve images → build-service → **rendered React SPA screenshotted**
  (Fraunces font, custom Tailwind theme compiled, client-side routing Home↔Gallery,
  zero runtime errors). Build ~2.7s. Screenshot: scratchpad/react_home.png.
- **Still Phase 3/4:** wire into the Worker (Sonnet call w/ REACT_RULES → parse →
  image inject → Cloudflare Container build → R2), needs Containers on the account
  (confirmed available) + image-token injection at source level; then auto-fix loop.

## 2026-07-20 — React builder Phase 3a: container infra + health check (DEPLOY TEST)
First change that touches the LIVE deploy config — done minimally + reversibly to
prove Cloudflare Containers deploys on the account before wiring the React pipeline.
- **wrangler.jsonc:** added `containers` (class BuildContainer, image
  ./builder/Dockerfile, max_instances 5, instance_type "standard" = 4GiB) +
  `durable_objects` binding BUILD_CONTAINER + `migrations` v1 new_sqlite_classes.
- **worker.js:** `import {Container,getContainer} from "@cloudflare/containers"` +
  `export class BuildContainer extends Container {defaultPort 8080; sleepAfter 3m}`
  + a `GET /api/site/build-health` (auth'd) that pings the container /health and
  reports status + cold-start latency. Static builder path UNTOUCHED.
- **package.json + lockfile:** added @cloudflare/containers@0.3.7 (npm ci verified).
- **Deploy risk:** a bad container-config field fails `wrangler deploy` → the live
  Worker keeps running the OLD version (not broken), so it's safe to test on main;
  revert the merge if the deploy errors. First deploy also builds+pushes the Docker
  image (adds a few min) and may need Containers fully enabled/billing on the acct.
- NEXT (3b): wire Sonnet(REACT_RULES)→parse→image-inject→container build→R2 behind
  a flag, then a live React build test.

## 2026-07-20 — React builder Phase 3b: live pipeline (Sonnet→container→R2)
Wired the full React build path behind its own endpoint; the static builder is
untouched.
- **worker.js:** `import {parseGeneratedFiles,REACT_RULES} from "./builder/react-gen.mjs"`
  (wrangler bundles it). New `injectReactImages()` (source-level @@IMG@@ → generated
  hosted URLs, budgeted). `R2_MIME` map. **`/s/<slug>/` serve route extended** to
  serve React dist: root/no-ext → index.html, a path WITH an extension → that exact
  object w/ real content-type (assets/*.js|css). Static sites unchanged (no-ext →
  .html) — unit-tested 7/7.
- **`POST /api/site/react-build`** (auth): Sonnet(REACT_RULES, max 32k) →
  parseGeneratedFiles → injectReactImages → container `/build` → store dist to
  sites/<slug>/… → returns {url:/s/<slug>/, cost, files, buildMs}. Metered at
  Sonnet rates + images (charge-after). A compile failure returns
  {ok:false, stage:"build", error} (for the Phase-4 auto-fix loop), no build charge.
  NOT wired into the client yet — tested by direct call.
- Live paid test (one real React build ≈ Sonnet + up to 6 images ≈ ~$1) pending
  owner go.
