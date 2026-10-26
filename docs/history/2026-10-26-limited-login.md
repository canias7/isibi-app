# 2026-10-26 — Each site database gets a second, limited login

Branch `limited-login` (from `origin/main` `8f29c37d3`). Not merged, not
deployed. **Inert until `supabase/proposed/site_app_conn.sql` is applied** (the
owner's word): until then the Worker reads the column's absence as "no limited
login yet", every path stays on the owner's login, and the backfill tick does
nothing.

## The owner's request

> Each site's database gets a SECOND, limited login (Postgres role) used for
> everyday work, so a bug or leaked password can only change rows, never
> drop/alter tables or change permissions.

## What was built

- **`site-app-login.mjs`** (new). The role `<db>_app` (the database name cut to
  59, plus `_app`), made **in SQL on the owner's connection**, not through
  Neon's roles endpoint: a Neon-API role is made a member of `neon_superuser`
  (CREATEROLE, CREATEDB, BYPASSRLS through membership), which is what this
  login exists not to have. The statements, all idempotent:
  - `CREATE ROLE … LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
    NOREPLICATION NOBYPASSRLS` when absent; `ALTER ROLE … WITH LOGIN PASSWORD`
    (32 random bytes, hex) every time;
  - `REVOKE CREATE ON SCHEMA public FROM PUBLIC` and from the role;
  - `GRANT CONNECT` on its database, `USAGE` on `public`,
    `SELECT, INSERT, UPDATE, DELETE` on all tables, `USAGE, SELECT` on all
    sequences, `EXECUTE` on all functions, and the same three as the owner's
    `ALTER DEFAULT PRIVILEGES`, so a table the owner makes later is covered;
  - one row policy, `gf_app_rows … TO <db>_app USING (true) WITH CHECK
    (true)`, on every table with RLS on.
  - Then a **read-back** from `pg_roles` (login yes; super, createdb,
    createrole, replication, bypassrls, inherit no; member of 0 roles; owns 0
    relations; no CREATE on `public`). Anything else is refused and nothing is
    stored.
- **RLS, kept exactly as it was for the path it replaces.** Every server path
  connected as the tables' owner, and an owner is not subject to its tables'
  policies: the Worker saw every row and filtered itself (`owner_id = ?`). No
  per-request identity is set on those connections (`app_user_id()` reads the
  visitor's JWT only on the Data API's `anonymous`/`authenticated` roles, which
  are untouched). The `gf_app_rows` policy gives the limited login that same
  view **under RLS rather than around it**: without the policy it sees nothing
  (measured), and it has no BYPASSRLS.
- **New tables**: `applySiteSchema` emits `appRowPolicySql(table)` after each
  table's own policies: a `DO` block naming the role from
  `current_database()` by the same rule, a no-op on a database with no limited
  login. **Recovery ignores that policy** (`RECOVER_QUERIES.policies` excludes
  `gf_app_rows`), or its `USING (true)` would be read as a public read.
- **Stored separately**: `site_project.app_conn` (proposed SQL), the same table
  as `neon_conn` (RLS on, no policies: service key only). Never logged or
  returned: the save asks back only `slug`; `scrubSecrets` already covers any
  `postgres://` string; `safeLoginError` also takes out the bare password and
  any `PASSWORD '…'`.
- **Worker** (`worker.js`):
  - `siteAppConn` (cached 5 minutes, "none" cached too), `siteRowConn`
    (limited, else `siteBackendBySlug`), `ownerRowConn` (limited, else
    `ownerSiteConn`). **The owner's login is the fallback only when the site
    has no limited login yet** (empty column, or a 400 naming the missing
    column); a lookup that fails throws, never reads as "none".
  - **New sites**: `ensureSiteBackend` makes the login after the database is
    recorded (best-effort; a container job cannot write `site_project`, so a
    site first provisioned in a container gets it from the tick).
  - **Backfill**: `runAppLoginBackfill` on the 2-minute tick, 3 sites a tick,
    sites with an empty `app_conn` by slug after an R2 cursor
    (`site-app-login/cursor.txt`), walking past a failing site and wrapping at
    the end; a failure leaves the column empty, so a later lap retries;
    `ensureAppLogin` is idempotent. A no-op until the column exists.
  - The site's delete forgets the cached login.

## Classification: call site → login

**Row work → the limited login** (`siteRowConn` / `ownerRowConn`):

| Call site | What it does |
|---|---|
| `jobDeps` (`callFn`, `credentials`, `smsCredentials`) | a site's scheduled jobs: its declared function, mail/SMS keys from `_secrets` |
| `backupDeps` (nightly backup) | reads every table and `_meta` |
| `routeTableNames`, `routeDigest`, `readConverseContext` | the router's and the chat's reads |
| `diagnoseTools` `list_site` | read-only explore tool |
| `refreshSiteMap` | row counts (read-only transaction) and the config read |
| `previewFtsRows` | the draft preview's search rows (read-only) |
| `proxySiteService` | the visitor Data/Auth proxy's service base, created-row lookup, webhook note |
| `/api/db/:slug/api`, `/hook/`, `/error` (insert, prune), `/turnstile`, `/checkout`, `/uploads` | visitor routes through our server |
| `/api/stripe/site/` | the order's payment status `UPDATE`, `_secrets` read |
| `rowReviewFacts` | `_meta` markers |
| `ownerDeps.dbFor` | the owner's Data panel: reads, saves, CSV import, export, tables, the scan inputs |
| the data rung (`ddb`) | builder row edits, their rehearsals and reads |
| the page rung (`eDb`), the logo/look/language/config reads (`ldb`, `edb`, `eLangRead`, `preEditConfig`, `patchSiteConfig`) | `_meta` reads |
| `stampFences`, the language cache write | config reads |
| the owner's vault, webhook note, errors panel, verification settings | `_secrets`, `_meta`, `_errors` |

**Schema/admin work → the owner's login, and why:**

| Call site | Why it stays |
|---|---|
| `ensureSiteBackend` and its `saveAuthInfo`/`saveDataInfo` | creates `_meta`; Neon Auth and the Data API |
| `applySiteSchema` (build, revise, add-on, rules), seeding | DDL, RLS, policies, grants, functions, triggers |
| the rules rung (`rBack`), the add-on (`aBack`), rehearsal branches | schema changes |
| `runPublication` (`siteDbFor`) | applies the held schema's new tables and then the held rows, in one runner |
| `flushSiteMetrics` | runs `CREATE TABLE IF NOT EXISTS _metrics` on every flush (the role cannot run it even when the table exists: measured 42501) |
| `/error`'s heal | `CREATE TABLE IF NOT EXISTS _errors` on a missing table only; the insert stays on the limited login |
| `frameTablesOf` / `specForAddon` recovery | reads `information_schema.role_table_grants`, which shows a non-owner only the grants it is party to, so recovery would derive the wrong access |
| the members route (`handleOwnerMembers`) | reads and writes `neon_auth."user"`, Neon's own schema; granting there is admin work |
| the build's revise read (`revConn`), the edit reconstruct read (`siteBackendDetail`) | inside the build and the reconstruct, which are schema work; read-only and rare |
| `recompileAndPublish` (`db`) | the shared publish spine; it only reads the config through it, so it could move, but it is left as it was |
| `siteBackendDetail`'s probe, site delete, teardown, `scripts/backend-repair.mjs`, `scripts/grants-backfill.mjs` | repair, restore, permission maintenance |

## Proof

- **Real PostgreSQL 16, no Neon** (`test/integration/local-pg-app-login.mjs`,
  28 of 28): an owner that is not a superuser (CREATEROLE, as Neon's owner
  is) runs the shipping statements; as the limited login, rows read (all of
  them, as the owner saw), inserted, updated, deleted, `_meta` written, a
  function called; `CREATE TABLE`, `CREATE TABLE IF NOT EXISTS` on an existing
  table, `DROP TABLE`, `ALTER TABLE`, disabling RLS, `DROP POLICY`, `TRUNCATE`,
  `CREATE ROLE`, `ALTER ROLE … BYPASSRLS`, `CREATE FUNCTION`, `CREATE SCHEMA`
  all refused with 42501; a `GRANT` changes nothing (Postgres only warns); with
  the row policy dropped the login sees 0 rows (RLS applies); a table the owner
  makes later is written through the default privileges and `appRowPolicySql`;
  a second run succeeds, the old password stops working, one policy per table.
- **Unit tests** (`test/limited-login.test.mjs`, 24 cases, fake DB and stubbed
  Supabase): the statements, the read-back, the connection, errors without
  secrets, the backfill (bounded, idempotent, retried, inert), the resolvers
  (limited; owner fallback for four kinds of "none"; three kinds of cannot-tell
  throw), the save, a failed provision's log lines, the tick, and which call
  sites take which login.
- **Red check**: on `origin/main`'s `worker.js`, `site-schema.mjs` and
  `site-schema-recover.mjs`, 10 of the 24 fail (the 14 that pass test the new
  module alone).
- **Sweep**: 22 of 22 mutants killed, 2 comment-only controls survived (after
  one equivalent mutant was rewritten and two test gaps closed: a bare
  password in an error, and a failure in the middle of one tick).
- **Full unit suite** (locally, before the commit): `12917 / 12912 / 2 / 3`.
  The two failures were of the working tree, not the code: a new file not yet
  a git object (`container-images`) and a `node_modules` symlink the session
  used (`no-generated-deps`); both pass on the commit `a5b3dd465` with the
  link removed (19 of 19). Five existing source guards were re-anchored to the
  new resolver names (`site-apply`, `site-ask`, `site-backup`, `site-jobs`,
  `site-db`), one fake in `route-table-names` stops counting the login lookup
  as a project-row read, and `Dockerfile` carries the new module into the
  worker tree.

## Not proven live

- Nothing ran on Neon. That `neondb_owner` may `CREATE ROLE` in SQL, that the
  new login connects through Neon's HTTP driver, and Neon's password rules for
  SQL-made roles are not measured. A Postgres 14 project whose `public` the
  owner does not own would keep PUBLIC's CREATE: the read-back refuses that
  site (`can_create`), and it stays on the owner's login.
- **Older shared projects** (one project per user, several site databases):
  PUBLIC has CONNECT on every database by default, so a limited login can
  connect to a sibling database in the same project, where it holds only what
  PUBLIC holds. Backlog.
- A site's own `SECURITY INVOKER` function called by a scheduled job now runs
  as the limited login; one that does DDL would now be refused (intended).
