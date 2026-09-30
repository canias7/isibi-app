# The site database: the four backend states, the search_path pin, column-scoped grants

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). Its first
> section below is the short summary CLAUDE.md kept, moved here in the second
> pass (`git show 28bdc97f:CLAUDE.md`); **Data, auth, payments, mail** is in
> `docs/platform.md`. Read this
> before touching a site's backend lookup, its schema recovery, its function
> definitions or its grants.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

### The site database, in brief

The full law is `docs/site-database.md`.

- **"No database" is four states** (`site-backend-state.mjs`): `ready`, `none`
  (the only state in which "no tables" is true), `incomplete` (the database is
  real and `site_backends.neon_db` is blank) and `unreadable` (asked first).
  `siteBackendDetail` resolves and proves; the container has no `SITE_ROUTES`
  cache, which is why an `incomplete` site looked fine in the Worker and broke
  in a job. **Four sites are still `incomplete`**: `ashgrove-1`, `fretwork-1`,
  `northgroup-5`, `washhouse-1`.
- **The site list and the owner data routes read the four states too**
  (Lane 1c, 2026-09-30, on the branch, not merged):
  - `/api/site/list` answers `db: true` for `ready` and `incomplete`, `false`
    for `none`, and `null` for `unreadable`: a failed project read, never a
    no. Its one extra read runs only for blank rows, is scoped to the
    caller's uid and blank slugs, and selects `slug` only;
  - the browser keeps the three answers, carries a yes onto the record it
    adopts, and says "Couldn't check…" for `null`;
  - the owner data routes (the Data panel's reads and saves, the CSV import,
    the export) open the database through `ownerSiteConn`: the fast reader,
    then `siteBackendDetail`, read-only. An incomplete link is proved and
    never healed, and an unreadable one is the block's 500, never "no such
    site";
  - the router's table-name lookup (Lane 1d) uses the same reader, after
    verifying ownership.
- **The catalog is asked first** (`readSchemaState`, `specForAddon`): a missing
  `_meta` row is not an empty database; recovery (`site-schema-recover.mjs`) is
  read-only, derives access from the live policies and grants, and refuses
  rather than guesses.
- **Every function the engine creates pins `search_path` to `public, pg_temp`**
  (`FN_SEARCH_PATH`; naming `pg_temp` is the fix, because `TEMP` is granted to
  PUBLIC by default). Model-written functions on sites built before the pin are
  never re-pinned (backlog).
- **Write grants are column-scoped** (`GRANT INSERT ("a", "b")`); a site keeps
  its old table-wide grants until its next schema change. Applying grants
  through `grants preview` is maintenance and never goes through the rules rung.
- **The owner rows route takes a conditional write**: `{"$set": {…}, "$if":
  {…}}` is one `UPDATE … WHERE` statement, 409 `conflict` when the row no
  longer matches; no column can begin with `$`, so an older Worker refuses the
  form rather than doing it unconditionally. **A data edit publishes no
  version**, and the Data panel's Save is not an exact recovery (it sends every
  field as text, so a NULL comes back as `''`).
- **The rules rung closes a table by marking it `retired`**: no row policy,
  every visitor privilege revoked, no public view. A closed table stays in the
  owner's listing with its label unchanged, so the refusal a visitor meets is
  the proof, not the listing.

---

### THE FOUR STATES "NO DATABASE" MEANT (2026-09-15)

`siteBackendBySlug` answers ONE `null` for four different facts, and
`site-backend-state.mjs` is the one pure function that tells them apart — shared
by the Worker, the job child and `scripts/backend-repair.mjs`.

| state | means |
|---|---|
| `ready` | `site_backends.neon_db` names a database |
| `none` | no name AND no `site_project` row — **the only state in which `{tables: []}` is true** |
| `incomplete` | no name but a project row EXISTS: the database is real, the REFERENCE is missing |
| `unreadable` | a lookup threw. Asked FIRST, so a partial answer never decides a state |

- **THE KV CACHE IS WHY IT HID FOR A YEAR OF DEPLOYS.** `lookupRoute` checks
  `env.SITE_ROUTES` first, so in the WORKER an `incomplete` site resolves out of
  the cache. **`SITE_ROUTES` is ABSENT in the container**, so when the addon
  moved behind `JOB_RUNNER_EVERYONE` it met the blank column. A repair that
  consulted the cache would report every affected site as healthy, which is why
  `siteBackendDetail` reads Supabase and never `siteBackendBySlug`.
- **THE ROOT IS ONE LINE, IN THE PROVISION.** `saveBackend` is an INSERT with
  `resolution=ignore-duplicates`: for a site whose first build was frontend-only
  the row ALREADY EXISTS with `neon_db: ""`, so the claim is a no-op for ever.
  `ensureSiteBackend` writes it now, **from the connection it is about to hand
  back** rather than re-deriving off the slug.
- **`incomplete` IS RESOLVED AND THEN PROVED** — a name that derives is not a
  database that answers, so it is probed; a probe that fails is `unreadable`,
  never `none`.
- **`readSchemaState` ASKS THE CATALOG FIRST**, and the order is the fix. Four
  outcomes: `stored` (with `missing` naming live tables the spec does not
  declare), `empty` (the catalog CONFIRMS none), `tables-without-metadata`
  (recoverable), `unreadable`. **A catalog we could not read is `unreadable`,
  never "no tables".** In the Worker, `specForAddon` RECOVERS or STOPS, and it
  is READ-ONLY.
- **RECOVERING A DROPPED DECLARATION** — `site-schema-recover.mjs`.
  `reconcileSpec` keeps every stored entry EXACTLY as it stands and rebuilds an
  entry for each table the database has and the spec does not. `deriveAccess` is
  the inverse of `grantsFor`/`policiesFor`; **a table whose access cannot be
  derived is NAMED and left out, never guessed.**
- **THE SIXTEEN-CELL ROUND-TRIP CAUGHT A REAL BUG IN THAT DERIVATION.**
  `policiesFor` writes BOTH member levels against `app_user_id()`, so "mentions
  the function" called **seven of sixteen cells** `own` that are `members` — the
  direction that NARROWS a live table's access. **It is the EQUALITY that
  separates them**, and the guard asserts all sixteen exactly rather than a
  floor, because a floor is what let it sit under a passing assertion.
- **RECOVERY MUST NOT CHANGE BEHAVIOUR ONE APPLY LATER.** Rebuilding
  `{name, columns, read, write}` drops every flag: a `trash` table whose live
  policy reads `((owner_id = app_user_id()) AND (deleted_at IS NULL))` recovers
  without it and `policiesFor` emits the first half alone — **every soft-deleted
  row visible again on the next schema change, days later**. Flags are DERIVED
  from the artifacts the engine leaves (`DERIVED_FLAGS`), and the rebuilt
  declaration is run back through the REAL `policiesFor`/`grantsFor`, INJECTED
  as `emit`, and compared. **The policy comparison is EXACT and the grant
  comparison is ONE-SIDED**, and the asymmetry is deliberate: every apply DROPs
  and re-CREATEs policies from the declaration, so the live policy IS the
  fingerprint — while a site that has had no schema change since 2026-09-13
  still carries table-wide write grants the next apply narrows. **With no `emit`
  every recovery is `uncertain`.**
- **A POLICY FINGERPRINT MUST NOT ERASE WHAT A POLICY MEANS.** A shape answering
  the SET OF FACTS a predicate mentions gave `IS NULL` and `IS NOT NULL` the
  same answer, and `AND` the same as `OR`. It is a CANONICAL BOOLEAN TREE:
  `AND`/`OR`/`NOT` are structure, each operand keeps its own text, `AND`/`OR`
  operands are SORTED (both commutative), and **what is normalised away is only
  what POSTGRES ITSELF rewrites**. A predicate this cannot parse is REFUSED,
  never compared, and **a refusal must never fold into the `""` an ABSENT clause
  answers**.
- **THE LEXER RUNS ON THE RAW TEXT, ONE TOKEN AT A TIME.** A regex over the
  whole string cannot tell a quoted identifier from the word it spells:
  `"true"` (a boolean column named `true`) folded to `true`, AND's identity, and
  took a whole conjunct with it; `'APPROVED'` became `'approved'`;
  `other_table.col` became `col`. **`SYNTAX_WORDS` is DERIVED FROM THE
  COMPARATOR** (`BOOL_WORD ∪ {not, true}`), not from Postgres's reserved list,
  and **the unquoting is SYMMETRIC**, which is what makes that sufficient.
  **EACH EQUIVALENCE IS MEASURED AND THERE ARE EXACTLY TWO**: our emitter writes
  8 distinct predicates across all 16 cells and **ZERO casts**, so `::text`
  directly after a string literal is dropped and nothing else is; and a
  qualifier naming **the table the policy is ON** is dropped and no other —
  **with no table name nothing is stripped.**
- **FOUR THINGS ONLY A REAL POSTGRES COULD HAVE SAID**, each a defect in code
  that read correctly: `information_schema.column_privileges` EXPANDS a
  table-level grant across every column; the predicate fingerprint kept the
  TABLE QUALIFIER (`"notes"."owner_id"` against `(owner_id = …)`) and **no
  fixture would have shown it, because a fixture writes both sides in one
  hand**; `GRANT INSERT ("body","title"), UPDATE ("body","title")` split flat
  into the column `"update(title"`; and **`payment` is an OBJECT, not a
  boolean**, so the probe's first `payment: true` fixture created no payment
  columns and the arm passed while proving nothing.
- **AND THE SWEEP FOUND A FALSE ALARM IN THE FIX.** The payable refusal keyed on
  all five `PAYMENT_COLUMNS`, so a `display` price list declaring `currency`
  read as payable. `currency` and `amount_total` are ordinary words a designer
  writes; `payment_status` is not, and the engine creates all five together.
- **IDENTITY IS THE AUTHORITATIVE MAPPING, AS A CHAIN FROM THE SLUG OUTWARD**:
  the `site_project` row found UNDER THIS SLUG → a connection NAMING
  `dbNameForSite(slug)` → `SELECT current_database()` agreeing. Comparing the
  catalog with `_meta` FROM THAT SAME DATABASE establishes only that it is
  internally CONSISTENT. **Every link is required and there is no "probably"**:
  `ok === proven` always. **The wall is in `writeRef`, not at its call site.**
  **And `site_project.neon_conn` is the PROJECT's connection**, whose path is
  `/neondb` on every real row — so the resolution moved INTO `survey`, the one
  place holding the project row and the intended name at once, and *the thing
  proved and the thing queried cannot come apart again*.
- **THE THREE TASKS ARE SEPARATE.** `workList` covers `ready` **and**
  `incomplete`, because **every site is `ready` the moment its reference is
  repaired** — a filter on `backfill` made the rerun the run that can never
  finish the job.
- **`--verify` MUST EXIT NONZERO ON A FAILED POSTCONDITION.** Both scripts
  printed a failure and exited **0**, which any shell, runbook or workflow step
  reads as a pass. **In verify mode "nothing to do" is not a pass**, and it
  falls THROUGH to the tally so one place decides. **An exit code is not
  observable from inside the module**, so `test/repair-commands.test.mjs` spawns
  both as real PROCESSES with ONE `globalThis.fetch` preloaded — Supabase is
  plain `fetch` and Neon is `fetch` over HTTP, so nothing is re-implemented; the
  scenario is a JSON file the preload writes back on exit, because
  apply → verify → repeat is three PROCESSES.
- **AND A STEP THAT PIPES INTO `tee` REPORTS TEE'S STATUS** unless the shell is
  said out loud. GitHub's UNSPECIFIED Linux shell is `bash -e {0}` — `set -e`
  with **no `pipefail`**. **MEASURED with a stub exiting 1: under `bash -e` the
  step exits 0; under `shell: bash` it exits 1; the log is byte-identical (73
  bytes) either way.** This is the `--verify` defect one layer up, and the two
  walls are independent. **PROVEN LIVE** by `backend repair` run 5, the first
  failing run of either workflow.
- **ABSENT TABLE AND ABSENT ROW ARE SEPARATE CASES.** The `_meta` write was one
  `INSERT … ON CONFLICT`, so the `tables-without-metadata` state — the one the
  recovery exists for — was correct and unwritable. `META_TABLE_SQL` is exported
  from `site-schema.mjs` and `applySiteSchema` uses it too, so a repair cannot
  create a `_meta` the platform would not have.
- **THE SCOPE IS A WALL IN THE SCRIPT.** `REPAIR_SITES` names five sites by hand
  and `workList` asks it FIRST; a `--slug` off the list is refused BY NAME with
  exit 2 and nothing is read — **a silent filter prints "nothing to do", which
  reads as "that site was already fine"**, the one answer a person running a
  repair must never get by accident.
- **`--apply-reference` IS A MODE, NOT A SECOND INPUT.** A flag beside `--apply`
  would be a two-field invariant, and a forgotten flag fails OPEN.
  `WRITES_REFERENCE` and `WRITES_META` are two frozen lists and both gates read
  them and nothing else; **an unknown mode writes NOTHING**. **WITHHELD IS NOT
  NOT-YET**: a preview reports what an apply WOULD do, `apply-reference` what it
  DELIBERATELY DID NOT on a run that wrote something else, tallied separately so
  `0 schema(s) recovered` cannot be misread. The confirm gate uses
  `startsWith(mode, 'apply')` deliberately — a list of two names would be a
  second copy of the first, and a prefix test errs toward DEMANDING confirmation.
- **A FORM VALUE COULD SELECT THE MODE, PAST THE APPROVAL GATE.** The step built
  ONE string and expanded it unquoted, so `column="drop_off_day --apply"` word-
  split into more arguments and the LAST mode flag won — while the confirm gate
  had seen `counts`. **The gate and the parser were answering about different
  runs.** Two walls, measured independent: a quoted bash ARRAY, and `parseArgs`
  REFUSING rather than guessing (two different mode flags, the same flag twice,
  a value missing or shaped like a flag, an unrecognised argument — **never
  silently ignored**), answering `{…, error}` and refusing with **exit 2 ABOVE
  the credential check**, because the argv is what the caller can fix.
- **A NARROW READ-ONLY AGGREGATE.** `--counts` groups by a column, and it
  **cannot return a name** by two properties rather than by discipline: the mode
  is on neither write list, and the grouping column must be a **DATE OR TIME
  type asked of the catalog** — a positive, type-derived rule, never a deny-list
  of column names. `GROUP BY 1 ORDER BY 2 DESC, 1` by ordinal. **Widening
  `COUNTS_TYPES` to text is the wrong fix** — the type rule is the entire reason
  `customer_name` cannot be grouped — and **a cast is worse**, because Postgres
  quotes the offending VALUE in its error. The one narrow exception is an exact
  triple (`repairbench-1` · `bookings` · `drop_off_day`), asked only after the
  general rule refuses, with the value projected through a SHAPE regex so an
  unusable value never leaves Postgres, `bad` separating "not date-shaped" from
  a genuine NULL, **a failed read reported by SQLSTATE and never by message**,
  and the arithmetic printed so it can be seen to close.

### `search_path` — the premise was wrong, and the fix is one clause

**THE PREMISE THAT KEPT IT OPEN WAS FALSE.** The earlier probe said the
escalation needs a caller who can put a schema ahead of `public` AND create an
object in it, and measured four `CREATE` privileges to say nobody can. **The
four checks are true and the premise is incomplete**: `TEMP` on the database is
granted to **PUBLIC by Postgres's own default**, and an unlisted `pg_temp` is
searched **FIRST** for relations — so the caller never touches their own
`search_path` either. **MEASURED on a real PostgreSQL 16**: a role refused
`SELECT` on the table outright creates `pg_temp.bookings` and the definer
function counting the owner's three rows answers **1**. Same for `plpgsql`, and
**same through an INVOKER callee** — so pinning only the definer leaves the hole
one hop along.

**NAMING `pg_temp` IS THE FIX. NAMING `public` IS NOT, AND THE TWO LOOK ALIKE.**
Measured: `SET search_path = pg_catalog, public` with an unqualified body is
redirected **exactly as an unpinned function is**. The guard asserts the ORDER
and the sweep mutates it. `FN_SEARCH_PATH = "public, pg_temp"` on every model
function (definer AND invoker) and every trigger function; `pg_catalog, pg_temp`
on the three identity helpers — those three were SAFE, but **safe only because
every relation in their bodies is schema-qualified**, an argument about the
bodies that expires the first time one is edited.

- **14 OF THE 15 FUNCTIONS THE ENGINE CREATES PINNED NOTHING.** The platform's
  own Supabase side is clean: 69 functions, **0** unpinned definer functions —
  the one grep hit was the phrase inside a COMMENT.
- **THE PIN TRUSTS `public`**, so "public is not writable by untrusted roles" is
  a requirement this KEEPS, not a premise it retired. Case 9 pins the trusted
  set to exactly `["public", "pg_temp"]`. Whether a writable `public` is
  exploitable UNDER this pin is **UNMEASURED** — a draft tried and could not.
- **THE SCOPE, measured twice**: `app_user_id()`/`app_team_id()` and every
  trigger function are RE-PINNED on a site's next schema change; **every
  model-written function is NOT TOUCHED, not now and not ever**, because
  `_meta.functions` stores no body and `normalizeSchema` drops a bodiless
  function. **And that last row is the high-value half**, since the model's
  functions are the `SECURITY DEFINER` ones GRANTed to `anonymous`. The one path
  that reaches them is an addon that RE-DECLARES with a body.
- **THE REACH IS LAZY AND PER-SITE.** `applySiteSchema` has three callers and
  all three are customer-driven; **no customer database is touched by this**.
  And `_meta.functions` carries no body and no config, so **a stored spec can
  never say whether a site's live functions are pinned** — `pg_proc.proconfig`
  is the only reader.
- **THE PROBE'S OWN CONTROL MUST BE AN IMMUTABLE COMMIT.** `OLD_REF` defaulted
  to `HEAD`, so the moment the fix was committed every BEFORE case inverted and
  the probe reported the PIN as broken; moving it to `origin/main` is the same
  defect deferred to merge day — which is exactly when somebody re-runs the
  documented command. **The property is IMMUTABILITY**: every moving form is a
  NAME, and a hex object id is the only thing git will not re-point. The
  run-time refusal is KEPT beside the sha, because the two answer different
  questions, and **the two guards are split the same way** and proved in both
  directions (an immutable but POST-fix sha passes one and fails the other).

### The write grants are column-scoped (2026-09-13)

**THE INSERT HALF WAS THE WIDER ONE AND AN EARLIER PASS CALLED IT A PASS.** That
reading asked *can a member UPDATE this table at all*, the right precondition
for UPDATE and the wrong question for INSERT: `write: anyone` — the `collect`
preset, **the commonest table this platform builds** — emitted `GRANT INSERT ON
"<t>" TO anonymous`, table-wide, to a visitor signed in to nothing.

```
GRANT INSERT ("name", "email", "detail") ON "requests" TO anonymous;
GRANT SELECT, DELETE ON "requests" TO authenticated;
GRANT INSERT ("title"), UPDATE ("title") ON "requests" TO authenticated;
```

- **POSTGRES HAS TWO GRAMMARS AND THEY CANNOT BE MIXED** — `GRANT SELECT, INSERT
  (a)` is a syntax error. `DELETE` takes no column list; **`SELECT` stays
  table-wide deliberately**, because a member must read `id` and `created_at` to
  render a row.
- **A GRANT, NOT A TRIGGER.** A BEFORE INSERT trigger forcing the managed columns
  would re-state every DDL DEFAULT in a second place.
- **`writableColumns(t, created)` USES THE REALLY-CREATED LIST**: a GRANT naming
  a column the table has not got fails WHOLE, and one absent name would leave a
  site silently refusing every form submission.
- **REVOKING A TABLE PRIVILEGE AUTOMATICALLY REVOKES ITS COLUMN PRIVILEGES**, so
  the `REVOKE ALL` pair at the head of `grantsFor` covers a table moving
  `user` → `display`. **That pair is why this is worth anything on a live
  site**: Postgres keeps BOTH levels and the table-level one still covers every
  column, so a narrow grant added beside the old one would change nothing.
- **MEASURED over all 16 read×write cells**: PASS for `write: none` and
  `write: anyone` (every payment column is in this class, a payable table being
  taken out of the write grants entirely); FAIL for `write: own` and
  `write: members`, where the UPDATE policy names only `owner_id` so `id`,
  `created_at`, `updated_at` and the flag columns had nothing in the SQL
  stopping a member writing them — on `members`, **any row**. **The answer
  depends only on the WRITE axis**, pinned.
- **THE INFERENCE IS CLOSED BY A REAL POSTGRESQL 16** —
  `test/integration/local-pg-grants.mjs`, **29 cases, no Neon, no network**, and
  **nothing typed in it**: the DDL comes out of the real `applySiteSchema` and
  the OLD grants come out of GIT at run time, so the "existing table" half is
  the state a real pre-fix apply LEFT. **`owner_id` and `deleted_at` were
  already out of reach and RLS is why** — said out loud rather than letting the
  fix take credit for a wall it did not build.
- **EVERY ANSWER IS READ FOR ITS REASON, IN BOTH DIRECTIONS**, because a refusal
  from the wrong gate reads exactly like the fix working. **And an ALLOWED that
  touched no row is not an allowed write**: `UPDATE … WHERE` matching nothing
  SUCCEEDS and RLS filters rows out in SILENCE — **three cases read as
  successful writes until the command tag was parsed.**
- **THE ON-SPLIT IS LOAD-BEARING**: the verb comes from BEFORE the `ON`, because
  `GRANT SELECT ON "update"` contains the word UPDATE. The two readings diverge
  on **7 of 16 cells** for that name and **0 of 16** for any other.
- **THE REACH: nothing triggers the fix on its own.** Per-site and lazy — an
  existing site keeps its table-wide grants until its owner next changes
  something schema-shaped, which may be never. **Open.**
  `scripts/grants-backfill.mjs` is ready (preview default, apply, verify,
  rollback; grants only; the column list the INTERSECTION of the stored schema
  and what the table really has; **verification has two halves**, because a table
  where the REVOKE landed and the GRANT did not satisfies the first and cannot
  take a booking). **Not run.**
- **THE INVENTORY: 70 sites, 31 with a Neon project, 39 frontend-only.**
- **ONE LIVE CREDENTIAL RULE.** The risk is not the deliberate log line; it is
  **a driver error whose MESSAGE quotes the URL it was handed**. `safeErr` is the
  one scrubber, and **the rule is the URL's own grammar rather than a list of
  secrets**: any `scheme://user:password@` becomes `scheme://***@`. A list has to
  be kept, and the one it misses is the one that leaks. **The HOST is
  deliberately kept.**

---
