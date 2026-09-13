# Running the three addon requests by hand

Owner, 2026-09-13: *"Prepare the exact three addon test requests and the GitHub
Lane Sweep settings I need to run them manually. Include how to create the
disposable test site first and what result to check for each request."*

> **STATUS: NO ADDON REQUEST HAS BEEN RUN.** Every acceptance check in
> Steps 0–3 below is written and unexecuted. No disposable site exists, no
> request has been sent, no credit has been spent. A session cannot fire either
> workflow — `workflow_dispatch` answers **403** for this integration
> (re-measured 2026-09-13), and no `SUPABASE_SERVICE_KEY` exists here — so this
> half is a document, and every result in it is a prediction until you run it.
>
> **THE PERMISSION WORK IS DIFFERENT AND HAS BEEN RUN.** Its four checks are
> measured against a real PostgreSQL 16 — see *These two tests have now been
> run* below — and the backfill's whole cycle (preview, apply, verify, apply
> again, rollback) is driven against one too. What is **not** run is the
> backfill itself against production, which is deliberate and waiting on the
> owner.

**ACCEPTANCE CHECKS CORRECTED 2026-09-13** after the owner read the first draft.
The five corrections are marked ⚠ where they apply, because each one was a check
that would have passed a broken feature or failed a working one.

---

## Before anything: three free checks

1. **The ledger.** `credits` on the building account,
   `aniascristian@gmail.com` — **not** the session's own address, which owns
   nothing. Last recorded: **244** on 2026-09-11, and CLAUDE.md's own rule is
   that a stale number is worse than none, because `buildFloor` refuses before
   spending and the refusal reads as a broken build.

2. **Is the queue on for this account.** `GET /api/site/runtime?slug=<any site
   you own>` in a signed-in browser. It answers `async`, `asyncOn`,
   `asyncEveryone` and the deploy sha — owner-gated, booleans only, free.
   **Read it rather than `deploy.yml`**: that file's `EDIT_ASYNC: ${{ secrets.EDIT_ASYNC || 'off' }}`
   is the default that runs only while nobody has ever set the secret, so the
   workflow tells you the default and never the deployment.
   `async: false` means each addon is one long synchronous request against the
   ~273 s customer-connection wall, which a table-plus-page addition can outrun.

3. **The deploy the runs will hit.** The same route answers the sha. Match it
   against what is on `main`, and against the migration status at the foot of
   this file.

---

## Step 0 — the disposable site

Workflow **`build as owner`** → *Run workflow*.

**Run it from the `main` branch.** Its first step polls
`actions/workflows/deploy.yml/runs?head_sha=<this sha>`, and `deploy.yml` fires
only on a push to `main` — so a dispatch from a feature branch finds no deploy
run for its sha and dies at ten minutes having spent nothing.

| input | value |
|---|---|
| `mode` | `build` |
| `slug` | a name **never used before** — e.g. `repairbench-1` |
| `instruction` | *(leave blank — build only)* |
| `layer` | *(leave `look` — ignored on a build)* |
| `picker` | `grok` |
| `brief` | the paragraph below |

> A back-street bicycle repair workshop in Hebden Bridge. Two mechanics, a
> bench, a queue of bikes. Servicing, wheel builds, gear and brake work, and
> whatever somebody wheels through the door. Open Tuesday to Saturday, 9 to 5.
> We want a simple front page that says what we do, what it roughly costs, and
> how to find us.

**The brief must not ask for a database.** A first build is frontend-only by
default, and that is the precondition for all three asks: the first backend
touch is what MAKES the Neon project, which is half of what ask A proves. A
brief mentioning accounts or bookings would provision one early and quietly
remove the thing being tested.

**A fresh slug, not a reused one.** A slug is claimed by whoever builds it
first, and ownership is what decides `revise` — re-using a claimed name makes
the run an edit of an existing site, which anchors to the stored design and
never re-runs the decide-everything half.

**Cost, as a measured range rather than a number:** a first build on Grok has
been measured at **11** (run 91, `coalhole-2`) and **45** (run 80, `ashgrove-1`)
credits. Four times' difference between two first builds on the same model, so
quote the range or measure the run.

**Check before going on:** the site answers 200 at
`https://<slug>.gofarther.app`, and its Data panel shows **no database**. If it
has one, the brief provisioned it and asks A–C measure something else.

---

## Steps 1–3 — the three asks

Workflow **`lane sweep`** → *Run workflow*, once per ask.

**Same settings every time except `ask`:**

| input | value |
|---|---|
| `confirm` | `spend` |
| `harness` | `addon` |
| `lanes` | `all` *(ignored when `ask` is given — the run prints that it is ignored)* |
| `site` | the slug from step 0 |
| `dbsite` | *(leave default — gap harness only)* |
| `ask` | **one of the three below** |
| `picker` | `grok` |
| `budget` | `80` |

`confirm` forgives whitespace and case (`raw.trim().toLowerCase() === "spend"`).
The `ask` box is cut at **2000 characters**, which is the route's own cap; all
three are far under it, and a cut would be printed rather than silent.

**Run them in order, one at a time, and read each before firing the next.**
Asks B and C build on the table ask A creates — if A produced no table, B and C
measure nothing. A site is claimed while a job runs, so two at once answers
`site-busy` anyway.

---

## ⚠ A standing rule for every "elsewhere → page" requirement

**Correction 3.** The first draft treated a requirement handed to the page step
as covered once that step ran. **That is `requirementNote`'s own rule and it is
not an acceptance check** — `ran` is the list of kinds that produced work, which
says the page step executed and says nothing about what the page contains.

So on every ask below, for each requirement the coverage record marks
`elsewhere → page`, **open the published page and confirm the thing is there**.
The run's own verdict cannot do this for you: the harness reads the page's
structure and its words, not whether a named capability is present.

A requirement marked `elsewhere → page` whose page does not deliver it is a
**FAIL**, and it is the most likely silent failure of the three asks, because
every automated signal in the run says covered.

---

### Ask A — storage that was never named, and rows two customers cannot share

```
Let customers submit repair requests and log in to see their own requests and status updates.
```

**What it is for.** Not one of the words *database*, *table*, *store* or *save*
appears in it, and it cannot work without a table. Until 2026-09-13 the picker
got 402 characters and the customer's sentence with no description of the site
at all, so a sentence like this had nothing to route on. It now gets the same
site note the designers read, plus the instruction to read what an ask NEEDS
rather than only what it names.

**⚠ Correction 4: the first draft stopped at "a form appears and a table
exists", which is the shape of the feature and not the feature.** The ask has
three verbs — submit, log in, see their own — and the third is the one with a
security consequence. Check all of it, in order, and stop at the first failure:

1. **The picker heard it.** Run log: `the picker chose: ["table", …]`. If
   `table` is absent, nothing below matters and this is the finding.
2. **The database was made.** Reply carries `provisioned: true` and *"Your site
   has its own database now."* This is the first backend touch on a
   frontend-only site — a path that had never run live.
3. **A submission persists.** Open the published page, submit a request as an
   anonymous visitor, then read the row back through the Data panel. **A 2xx is
   not persistence** — a form that posts and drops the row answers 2xx.
   *(If the design made the table members-only rather than public, submitting
   requires sign-in first; that is a legitimate design and step 4 covers it.)*
4. **Two separate customers, and this is the real check.** Register **two**
   member accounts on the site. As customer 1, submit a request. As customer 2,
   submit a different one. Then:
   - customer 1 sees their own request and **not** customer 2's;
   - customer 2 sees their own and **not** customer 1's;
   - each sees their own status updates.

   **Do this twice: through the page, and through the Data API directly** —
   `GET /api/db/<slug>/rows/<table>` with customer 2's token. The page might
   filter in the browser, which is not isolation; the API answer is what proves
   RLS is doing it. Customer 2's token returning customer 1's row is a **FAIL**
   and the most serious outcome any of these three asks can produce.
5. **Status updates are reachable.** Whoever the design says may change a
   status can change one, and the customer sees the new value.
6. **The coverage record** should carry each of those as `covered` naming the
   table and its access level, or `elsewhere → page` — in which case the
   standing rule above applies.

**The customer sentence may be empty and that is fine** — `requirementNote`
reports only what is outstanding after the whole change ran. An empty sentence
is not evidence that steps 3–5 passed; only steps 3–5 are.

---

### Ask B — a change history, or an honest account of why not

```
On each repair request, keep a record of every change to its status, so we can see who changed what and when.
```

**⚠ Correction 1: the first draft required `unsupported`, which is wrong in two
directions.** It would have failed a working feature, and it assumed the only
route to a change history is the engine's own `history` flag — which is not
offered by `TABLE_ITEM` but is also not the only way to build one.

**The supported alternative is an ordinary table**, and it should be considered
first: a `status_changes` table (request ref, old value, new value, who, when)
uses nothing but properties the tool already offers, and is a complete, working
answer. So there are three acceptable outcomes and one failure:

| outcome | verdict |
|---|---|
| **A working history** — a table (or equivalent) that records each change, readable by whoever the design says | **PASS**, and the best one |
| **A partial capability, named** — e.g. it reaches for `audit`/`history` and the reply says what does and does not work | **PASS** if the limitation is stated accurately |
| **An honest `unsupported`** with a reason a person can act on | **PASS** |
| **Silence** — no history, no mention, nothing in the coverage record | **FAIL**, and this is what the change was meant to end |

**If it builds a history table, check it actually records:** change a request's
status, then confirm a row appeared with the old value, the new value, an actor
and a timestamp. A table that exists and is never written to is the repo's own
most-repeated defect and would read as a pass from the reply alone.

**If it answers `unsupported`,** the customer sentence should open **"One thing
your site can't do yet:"** and carry the reason. Check the reason is *true* —
an accurate limitation is a pass, an invented one is a fail.

**Also read `· properties the tool does not offer: [...]`.** If the model asked
for `history` by name, that line names it and the customer gets the count-only
clause. Informative either way; not itself the verdict.

**Known caveat if it does use the engine's flags:** CLAUDE.md records `audit`
and `history` as writing correctly to tables **nothing can read** — so a reply
claiming a working history built on those flags needs step 1 above (read a row
back) before it counts as a pass.

---

### Ask C — two customers cannot take one slot, including at the same moment

```
Let customers pick a drop-off slot when they book a repair, and stop two people taking the same slot.
```

**⚠ Correction 2: the first draft checked for two tables and a `unique` slot
definition. Both were wrong.**

- **Two tables is not the property.** The ceiling changed from a count to "the
  smallest set that makes it work", so the number of tables is the model's call.
  A design that gets exclusivity right with one table passes; a design with two
  tables and no constraint fails.
- **A unique slot definition does not prevent double booking.** `unique` on a
  `slots` table stops two *slots* with the same name. It says nothing about two
  *bookings* pointing at the same slot. That is a different constraint on a
  different table, and conflating them is exactly how this ships broken.

**What actually enforces it** — verified by reading the engine, both of which
are real Postgres constraints and therefore safe under simultaneity:

| declared | emitted | catches |
|---|---|---|
| `unique` on the booking's slot reference | `CREATE UNIQUE INDEX … ON "<bookings>" (…)`, optionally partial | two bookings naming the same slot |
| `noOverlap` on the booking's time range | `ALTER TABLE … ADD CONSTRAINT … EXCLUDE USING gist (… WITH =, int4range(…) WITH &&)` | overlapping intervals, including different lengths |

Either is sufficient. Neither is a check-then-write, so **a race is refused by
Postgres itself** rather than by application timing.

**Check, in order:**

1. **Find the constraint.** Whatever shape it designed, there must be a
   constraint on the **booking** table — not only on the slot table. If you
   cannot name which statement refuses the second booking, that is the finding.
2. **⚠ Read `refusedRules` / the reply's refusal list — the silent-failure
   case.** `noOverlap` is emitted **only for integer start/end columns**; a
   text or date column is skipped with `why: "start and end must be integer
   columns"`, and a failed `EXCLUDE` is also reported there. So a design can
   declare exclusivity, have it silently not exist, and read as a success
   everywhere else. `GET /api/site/answer?slug=&kind=addon` carries this.
3. **Sequential double-booking.** Book a slot. Book the same slot again. The
   second must be refused, with a message a customer can act on — not a 500.
4. **Simultaneous double-booking, which is the check the owner asked for.**
   Two concurrent POSTs for the same slot, fired together:

   ```
   for i in 1 2; do curl -s -o /tmp/r$i -w "%{http_code}\n" \
     -X POST "https://<slug>.gofarther.app/api/db/<slug>/rows/<bookings>" \
     -H 'content-type: application/json' \
     -d '{"slot_id": <same id>, …}' & done; wait
   ```

   **Exactly one 2xx.** Two 2xx is a FAIL. Note the submission-idempotency
   layer is *not* the guard here — CLAUDE.md records that two presses on
   different isolates can both reach Postgres, and that `unique` and
   `noOverlap` are what refuse the copy. Send **different** idempotency keys
   (or none) so the constraint is what is being tested, not the cache.
5. **It must not round the model off.** No customers table, no staff table, no
   categories table unless one is genuinely load-bearing. A table the ask never
   named must fill in `because` with what breaks without it — visible in the
   developer record.

---

## Reading a run afterwards, for free

`GET /api/site/answer?slug=<slug>&kind=addon` — owner-gated, free, any time.
It hands back `source/<slug>/addon-answer.json`: every designer's raw reply plus
the full coverage record — the counts, every requirement with its status and
reason, the unreadable entries, the invalid property names, and the hand-off
map. Run 28's three blind declines are why that file exists: a boolean is not a
diagnosis.

The run log's own verdict word is one of:

| verdict | what it means |
|---|---|
| `reported` | it shipped, and the run prints what was made and what was left open |
| `refused` | the step said no and said why — **the product working**, not a failure |
| `escalated` | it handed the ask to another rung |
| `LIE` | it claimed a change the site does not show — the one real failure |
| `failed (server)` | a 5xx |

**A `reported` verdict is not a pass.** It means the run shipped and printed
what it did. The acceptance checks above are what decide each ask.

---

## Cost

| | measured |
|---|---|
| the disposable build | **11–45** credits (runs 91 and 80) |
| an addon that publishes | **~12–15** (run 29 measured 13) |
| three asks | **~35–45** |
| **total** | **~50–90** |

---

## ⚠ How the permission fix reaches existing tables

**Correction 5**, and the answer has two halves — one verified, one a real gap.

### The emitted SQL does remove the old grant

The owner is right that this needed checking: `GRANT INSERT (a, b) ON t TO r`
does **not** replace `GRANT INSERT ON t TO r`. Postgres keeps both, and the
table-level privilege still covers every column — so a narrower grant added
beside the old one would change nothing at all on any site built before today.

What makes it real is the pair that **heads `grantsFor` and runs before every
GRANT**:

```
REVOKE ALL ON "<table>" FROM anonymous;
REVOKE ALL ON "<table>" FROM authenticated;
```

Three things were verified rather than assumed:

- **It is emitted for every table on every cell**, retired ones included, and
  `site-rls.test.mjs` already pins that the last REVOKE precedes the first
  GRANT in every one of the sixteen read×write cells.
- **It removes column privileges too**, from the Postgres documentation: *"When
  revoking privileges on a table, the corresponding column privileges (if any)
  are automatically revoked on each column of the table, as well."* So the
  sequence is complete in both directions and idempotent.
- **The apply loop walks `spec.tables`, not a delta** — so one call re-issues
  REVOKE-then-GRANT for **every table on the site**, not only the one being
  changed. A new guard case in `test/managed-column-writes.test.mjs` drives the
  real loop over pre-existing tables and asserts the pair reaches the database
  before any grant does, with an alive-observer check that a narrow grant was
  in fact emitted.

### The gap: nothing triggers it on its own

`applySiteSchema` has exactly three callers, all customer-driven:

| caller | fires when |
|---|---|
| the build path | a build that has a database |
| the `rules` rung | an edit that changes schema features |
| the addon route | an addition that touches the backend |

**There is no backfill, no migration and no cron.** A site whose schema is never
touched again keeps its table-wide grants indefinitely. `site_rebuild`
republishes the site's bundle and does **not** call `applySiteSchema`, so it is
not a backfill either.

So the honest statement is: **the fix is correct and its reach is per-site and
lazy.** Sites created after the deploy get it on their first backend touch;
existing sites get it whenever their owner next changes something schema-shaped,
which may be never.

So the honest statement is: **the fix is correct and its reach is per-site and
lazy** — which is why the backfill below exists.

### The inventory, measured 2026-09-13 (read-only)

| | count |
|---|---|
| sites in `site_backends` | **70** |
| of those, with a Neon project (`site_project` row) | **31** |
| frontend-only, so no tables and nothing to fix | **39** |
| **candidates for the backfill** | **31** |

Ownership: **66** of the 70 sites belong to the building account; the other
**four** belong to three other accounts (`esmoke-fixture`, `esmoke-fixture-r1`,
`smoke-mt5igr76-jdd38`, `smoke-mt6fxehk-vt4l1` — all smoke fixtures).

**Which of the 31 actually carry a table-wide client write is NOT measured
here**, and the reason is deliberate: answering it means reading each site's
`_meta.schema`, which lives inside that site's own Neon database and needs the
connection string out of `site_project.neon_conn`. That is a live credential,
and reading it into a session transcript is not something to do for a count.
`scripts/grants-backfill.mjs --preview` answers it exactly, from where the
credentials already live, and writes nothing.

### ⚠ Four sites the platform's own reader cannot resolve

Found while taking the inventory, and it decides what the backfill can reach:
**`northgroup-5`, `ashgrove-1`, `washhouse-1` and `fretwork-1` each have a Neon
project and an EMPTY `site_backends.neon_db`.**

`claimSiteSlug` writes the row with `neon_db: ""` on a first build (frontend-only
is the default), and the only writer of that column is `saveBackend` — a POST
carrying `resolution=ignore-duplicates`, which is an insert and cannot update the
row that is already there. Measured: the only two PATCHes to `site_backends`
anywhere in the Worker are the offline flag and the notify flag. So when a later
addon provisions the database, `site_project` gets its row and `neon_db` stays
empty for ever, and `siteBackendBySlug` answers `conn: null` for that site.

**This is its own defect, outside the permission work**, and it is recorded as
one. What it means here is that a backfill resolving through `neon_db` would
silently skip exactly the four sites nobody is watching — so the script derives
the name with `dbNameForSite(slug)` instead (what `build-smoke` already does),
prefers the recorded name when there is one, and says out loud which sites it
reached the derived way.

### The backfill: `scripts/grants-backfill.mjs`

Grants only — the REVOKE pair and the GRANTs `grantsFor` emits, per table. No
DDL, no policy, no `_meta` write. That is what makes it *targeted* rather than
"call `applySiteSchema` on everything", which would re-run a hundred statements
per site to change two.

```
node scripts/grants-backfill.mjs --preview                      # writes NOTHING
node scripts/grants-backfill.mjs --apply --slug <one-site>      # one site first
node scripts/grants-backfill.mjs --verify
node scripts/grants-backfill.mjs --rollback <before-state.json>
```

Needs `SUPABASE_SERVICE_KEY` only, so it runs from CI or a machine that has one.

- **Preview** lists every table on every site with its access pair, what it
  grants now, and what it would grant — plus anything the stored schema names
  that the table has not got, which is left out of the grant on purpose (a GRANT
  naming a missing column fails WHOLE, and `applySiteSchema` logs a failed
  statement and carries on, so one absent name would leave a site silently
  refusing form submissions). It writes a **before-state file** either way.
- **Apply** issues the statements and verifies immediately.
- **Verify** has two halves and the second is what stops the first being
  vacuous: no client role holds a table-level INSERT or UPDATE, **and** the
  column grants that replaced them name exactly the writable columns. A site
  where the REVOKE ran and the GRANT did not satisfies the first perfectly and
  cannot take a booking.
- **Rollback** re-issues the recorded ACLs. It is a real recovery, not a
  hand-wave: the before-state file carries each table's real `relacl` and
  `attacl` entries and the rollback rebuilds GRANT statements from them.

**Recommended order**: `--preview` and read it; `--apply --slug` on ONE site that
has a form, and test a real submission on it; then `--apply` for the rest;
`--verify`. Keep the before-state file until you are satisfied.

**Data safety**: every statement is a GRANT or a REVOKE. There is no DML and no
DDL anywhere in the script, so no row can be touched — proved rather than
asserted, against a real Postgres, in the drive described below.

### ⚠ Test legitimate writes and refused managed writes separately

Correction 5's second half. One combined check cannot distinguish "the grant is
too tight" from "the grant is too loose", and the two failures need opposite
fixes. On a table the disposable site really has:

**Test 1 — a legitimate submission still works.** As the role the table is for
(anonymous for `collect`, a signed-in member for `user`/`feed`), write only the
declared columns. **Expect 2xx and a row.** A failure here means the column list
is missing a column the form sends — the regression this change could cause, and
the more likely of the two.

**Test 2 — a managed column is refused.** The same role, same table, same
statement, plus one platform-managed column:

```
{"…the normal fields…", "created_at": "2020-01-01T00:00:00Z"}
```

and separately `id`, `owner_id`, and — where the flags created them — `pinned`,
`position`, `deleted_at`. **Expect a refusal naming the column** (Postgres says
`permission denied for column …`). A 2xx here means the old table-wide grant is
still standing, which on an existing site is exactly what the REVOKE is for and
is worth reporting immediately.

Run test 1 first: if legitimate writes are broken, test 2's refusals prove
nothing about permissions.

### These two tests have now been run — against a real Postgres, not against Neon

`test/integration/local-pg-grants.mjs` runs the engine's own statements into a
local PostgreSQL 16 and measures what Postgres does with them. It needs no Neon,
no Supabase and no network:

```
pg_ctlcluster 16 main start
node test/integration/local-pg-grants.mjs
```

**29 cases, all as expected.** Three tables shaped like the ones the builder
really makes (`collect`, `user`, `feed` — the last two with `trash`, `ordered`
and `pinnable` so `deleted_at`, `position` and `pinned` are real columns), plus
a read-only `display` table as the control.

| | under the OLD grants | under the fix |
|---|---|---|
| anonymous submits a legitimate form | allowed | **allowed** |
| anonymous chooses `id` | **allowed** | `permission denied for table` |
| anonymous backdates `created_at` | **allowed** | `permission denied for table` |
| anonymous forges `updated_at` | **allowed** | `permission denied for table` |
| member edits its own row's words | allowed | **allowed** |
| member edits `created_at` / `id` | **allowed** | `permission denied for table` |
| member pins / positions its own feed row | **allowed** | `permission denied for table` |
| member reads and deletes its own rows | allowed | **allowed** |

Plus: **rows untouched** (the pre-fix seeded row still reads back), and a
**second apply is byte-identical** in privileges and rows.

**Two managed columns were already out of reach and RLS is why** — `owner_id`
fails the UPDATE policy's `WITH CHECK (owner_id = app_user_id())`, and
`deleted_at` fails the same clause's live-row predicate. Said here rather than
letting the fix take credit for a wall it did not build. The fix adds a second
gate over both; it is the **only** gate over `id`, `created_at`, `updated_at`,
`pinned` and `position`.

**Every answer is read for its reason, and both directions mattered.** A refusal
from the wrong gate reads exactly like the fix working, so each case names the
gate it is about and a refusal from a different one fails it. And an ALLOWED
that touched no row is not an allowed write: `UPDATE … WHERE` matching nothing
SUCCEEDS and RLS filters rows out in silence, so three cases read as successful
writes until the command tag was parsed.

**What is still not closed**: that Neon's PostgREST layer presents these
refusals to a browser the way the panel expects. `test/integration/neon-e2e.mjs`
is the probe for that and needs `NEON_API_KEY`, which no session here has.

---

## Deployment and migration status

**The permission fix is MERGED AND LIVE.** Owner, 2026-09-13: *"The local
PostgreSQL results are sufficient to move forward with the permission fix.
Deploy the tested fix through the required release checks."*

| | state |
|---|---|
| **`main`** | `9d2c8e7c` (fast-forward from `ec2ee66f`) |
| **deploy** | run **2114**, green, 2026-09-13 **22:16:21 → 22:19:29Z**, 3m08s |
| **release checks before the merge** | `unit tests` run **2510** green on the branch tip; `site build` run **1126** green on `8e8ac5eb`, all 20 steps, `site-build.mjs` 14m44s |
| **the image** | **BUILT** — the step's own line: `built isibi-app-sitebuildcontainer:84b673ca78ee27ae (registry answered 404; 174 inputs off ./Dockerfile)`, step 22:16:45 → 22:19:04 = 2m19s |
| **the container** | **ROLLED** — `EDIT isibi-app-sitebuildcontainer` at **22:19:18Z**, `de4c74e6aa86…d32` → `84b673ca78ee27ae`, `SUCCESS Modified application` |
| **the 15–20 minute hold** | ran to **~22:34–22:39Z** |
| **deploy gate** | left to expire on success |
| **Database migration needed** | **none** — the fix changes emitted DDL only; no schema migration, no RPC change, nothing to apply to Supabase |
| **Backfill for existing sites** | **written, guarded, driven against a real Postgres, NOT executed** — `scripts/grants-backfill.mjs`, and the owner's standing instruction is preview only |
| **Live addon tests** | **all unrun** |
| **`workflow_dispatch` from a session** | **403**, re-measured 2026-09-13 against `lane-sweep.yml` |

**The roll was read out of the log, never inferred from the step's duration** —
this repository warns against that inference in both directions, and the 2m19s
image step is consistent with a build only by coincidence.

**What is NOT proven about the container, named rather than glossed.** That a
COLD START really lands on `84b673ca78ee27ae` is answered by
`GET /api/site/build-health`, which is auth-gated and needs a signed-in session
no agent here has. Without a token it answers **401**, and a made-up path
answers **404** — so the route is matched and gated, which is as far as this
goes. The first container job after the hold is the other proof, and the three
asks below are that job.

**No served asset changed**, so there is no file-hash check for this deploy:
the push moves `site-rls.mjs` and `site-schema.mjs`, both bundled into the
Worker script rather than served, and `public/` is untouched. Wrangler's
`Current Version ID: 095520ae-357…-453c-8a36-65a620774e88` is the deploy's own
record of what went up.

**Ordering, now settled.** The fix is live, so running the three asks now proves
both changes at once and gives the disposable site's tables the new
column-scoped grants from the moment they are created.

---

## The exact runs to fire

A session cannot dispatch any of these — `workflow_dispatch` answers **403**
for this integration — so each is a page to open and a form to fill.

### 1. The disposable site

**<https://github.com/canias7/isibi-app/actions/workflows/build-as-owner.yml>**
→ *Run workflow*. **Use branch `main`**: the first step polls
`deploy.yml`'s runs for its own sha, and `deploy.yml` fires only on a push to
`main`, so a dispatch from a feature branch finds nothing and dies at ten
minutes having spent nothing.

| field | value to type |
|---|---|
| Use workflow from | `main` |
| `mode` | `build` |
| `slug` | `repairbench-1` |
| `instruction` | *(leave blank)* |
| `layer` | `look` *(ignored on a build)* |
| `picker` | `grok` |
| `brief` | the paragraph in **Step 0** above, copied whole |

Then check, before going on: `https://repairbench-1.gofarther.app` answers 200,
and its Data panel shows **no database**.

### 2–4. The three asks

**<https://github.com/canias7/isibi-app/actions/workflows/lane-sweep.yml>**
→ *Run workflow*, **once per ask, in order, reading each before firing the
next**. A site is claimed while a job runs, so two at once answers `site-busy`.

| field | value to type |
|---|---|
| Use workflow from | `main` |
| `confirm` | `spend` |
| `harness` | `addon` |
| `lanes` | `all` *(ignored when `ask` is given; the run says so)* |
| `site` | `repairbench-1` |
| `dbsite` | *(leave default)* |
| `ask` | **one of the three below** |
| `picker` | `grok` |
| `budget` | `80` |

**Ask A** — copy this line exactly:

```
Let customers submit repair requests and log in to see their own requests and status updates.
```

**Ask B**:

```
On each repair request, keep a record of every change to its status, so we can see who changed what and when.
```

**Ask C**:

```
Let customers pick a drop-off slot when they book a repair, and stop two people taking the same slot.
```

What to check in each run's output is in **Ask A / B / C** above — those
acceptance checks are what decide a pass, not the run's own green tick.

### 5. The backfill preview (reads only, writes nothing)

**<https://github.com/canias7/isibi-app/actions/workflows/grants-preview.yml>**
→ *Run workflow*. Leave every field at its default:

| field | value |
|---|---|
| `mode` | `preview` |
| `confirm` | *(blank)* |
| `slug` | *(blank — every site with a Neon project)* |
| `run_id` | *(blank)* |

Every statement a preview issues is a SELECT, and
`test/integration/local-pg-grants.mjs` drives that against a real Postgres:
the rows and the privileges are identical before and after it runs. **It does
not appear in the Actions sidebar until this workflow is on `main`.**
