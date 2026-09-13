# Running the three addon requests by hand

Owner, 2026-09-13: *"Prepare the exact three addon test requests and the GitHub
Lane Sweep settings I need to run them manually. Include how to create the
disposable test site first and what result to check for each request."*

> **STATUS: NOTHING HERE HAS BEEN RUN.** Every acceptance check below is written
> and unexecuted. No disposable site exists, no request has been sent, no credit
> has been spent. A session cannot fire either workflow —
> `workflow_dispatch` answers **403** for this integration, and no
> `SUPABASE_SERVICE_KEY` exists here — so this is a document, and every result
> in it is a prediction until you run it.

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

**How many sites this leaves exposed is unmeasured.** CLAUDE.md records 20 of
47 sites with `neon_db` empty (so no tables at all); the rest need counting
against which have a `collect` or member-write table. That count, and whether to
write a backfill that calls `applySiteSchema` over every site's stored spec, is
a decision rather than a bug fix — and it is the one thing about this change
worth deciding before the three asks run, because a disposable site built after
the deploy tests the new path and tells you nothing about the old ones.

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

**Both tests are against Postgres through PostgREST, so they close the one thing
the unit guards cannot.** Everything proved so far is about what the engine
*emits*; `test/integration/neon-e2e.mjs` carries the probe that drives real
Postgres and needs `NEON_API_KEY`, which no session here has.

---

## Deployment and migration status

| | state |
|---|---|
| **Permission fix** | **committed and pushed to `claude/help-needed-ehlwlj`, NOT merged, NOT deployed** |
| **Tables-step / coverage change** | merged and live before this session |
| **Database migration needed** | **none** — the fix changes emitted DDL only; there is no schema migration, no RPC change and nothing to apply to Supabase |
| **Backfill for existing sites** | **none exists**, and one is not part of this change — see the gap above |
| **Live tests** | **all unrun** |

**When it merges**, it touches `site-rls.mjs` and `site-schema.mjs`, both in the
Worker's module graph and therefore image inputs — so the container rebuilds and
rolls, and the **15–20 minute hold** applies before firing anything that must run
the new code.

**Ordering.** Running the three asks after the fix deploys proves both changes at
once and gives the new grants on the disposable site's tables. Running them
before proves only the tables step. The site is disposable, so nothing is lost
either way — but the permission tests in the section above require the fix to be
live, so they are the deciding factor.
