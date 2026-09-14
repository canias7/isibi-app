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

2. **Is the queue on, and is the RUNNER on.** `GET /api/site/runtime?slug=<any
   site you own>` in a signed-in browser. It answers `async`, `asyncOn`,
   `asyncEveryone`, **`runner`, `runnerOn`, `runnerEveryone`, `runnerBindings`,
   `runnerKeyed`** and the deploy sha — owner-gated, booleans only, free.
   **Read it rather than `deploy.yml`**: that file's `|| fallback` is the
   default that runs only while nobody has ever set the secret, so the workflow
   tells you the default and never the deployment.
   `async: false` means each addon is one long synchronous request against the
   ~273 s customer-connection wall, which a table-plus-page addition can outrun.
   **`runner: false` means the addon runs INLINE in the Worker**, where the
   fourteen-minute ceiling that killed run 44 still applies whatever the
   container's clock says — and a `false` there names which link is missing
   (`runnerBindings`, `runnerKeyed`). Deploy 2115 sets `JOB_RUNNER_EVERYONE` to
   `on`, so this should read `true` for every site now.

3. **The deploy the runs will hit.** The same route answers the sha. Match it
   against what is on `main`, and against the migration status at the foot of
   this file.

---

## Before the paid runs: the two free probes (2026-09-14)

Owner: *"Test duration and transport separately. Controlled test executing
inside the container for >15 minutes, then finishing and publishing. Test the
long AI connection separately so proof doesn't depend on the model randomly
answering slowly."*

**Both cost nothing — no model call, no credit, no row, no ledger** — and both
run through the real `/job/run` door in a real job child, which is most of the
point: the busy hold, the launch's own deadline and the terminator armed off it
are three of the things being measured.

**They need the deploy first**, and the push that carries them moves `worker.js`
and `builder/`, so the image rebuilds and the container rolls: **wait the 15–20
minute hold** before firing either, or the probe measures the previous image.

### The door: `job probe`, and it is one button

**https://github.com/canias7/isibi-app/actions/workflows/job-probe.yml** →
**Run workflow**. Dispatch-only, no marker, nothing to paste.

**It only appears in the Actions list once the file is on `main`** — GitHub lists
a dispatchable workflow from the DEFAULT branch and nowhere else (`lane-sweep.yml`
records the same rule, which is why the three harnesses share one file). That is
why this rides the merge rather than staying on the branch. Leave *Use workflow
from* on `main`.

The route is owner-gated by `authUser`, so running it by hand means holding a
session token — which is the one thing that must not be passed around. The
service key is already a GitHub Actions secret, so the workflow signs in on the
runner (the admin magic-link path `container-hold-probe` has used for months),
prints every secret as a length and never a value, and uploads its log
`if: always()` — because a NOT PROVEN or a CANNOT TELL is a reading, and a
reading nobody can read back is an instrument with no dial.

Its first step prints **which deploy answered** (`/api/site/runtime`) and
whether `runner` is on, so the run says what it measured rather than leaving it
to be inferred from a timestamp.

#### Run 1 failed in 17 seconds, and what it cost was one argument

**2026-09-14 05:53Z, the first press.** Steps 0–3 were perfect — the sign-in
landed, every secret printed as a length, and step 3 read the live Worker as
deploy `b062e30a` with `runner: true`. Step 4 answered:

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**The route was throwing.** `newJobId` takes its randomness as a REQUIRED
parameter — the module is pure on purpose, so there is no default behind it —
and the probe route called it bare where both other call sites in `worker.js`
pass `(b) => crypto.getRandomValues(b)`. `fill(bytes)` threw `TypeError`,
`handleRequest` has no try/catch, and **an uncaught throw inside a route leaves
Cloudflare to answer — in HTML**. Fixed in `2c3f2a37`.

**Two things nothing here could see, and both are now guarded.** The route was
asserted by READING it, and every landmark that read looks for was exactly where
it looks — the recorded *a text read certifies at the layer below the break*.
It is DRIVEN now (`test/job-probe.test.mjs`, POST and GET both, through
`worker.fetch` against a stubbed `/auth/v1/user`), plus a depth-aware census that
every `newJobId(` call is handed a generator. And the runner itself did
`.then(r => r.json())`, which throws away the status, the content-type and the
body — *a failure that cannot name itself*, in the instrument built to name
failures. It reads all three now, so the same shape would have printed
`HTTP 500 text/html — the body is not JSON: "<!DOCTYPE html>…"` and named the
cause in one line.

**Nothing was spent and nothing was left running**: the throw is above the
container fetch, so no job was ever launched and no lane was held.

### Probe 1 — duration

Inputs: `probe` = **`hold`**, `ms` = **`1200000`**. (Or, by hand:)

```
POST /api/site/job-probe          {"probe":"hold","ms":1200000}
GET  /api/site/job-probe?id=<id>
```

Twenty minutes, which is past the number in question. The POST answers at once
with the id; the GET reads the job's own record back off the build service.

**What to read, and WHEN each half arrives** — found by reading the consumer
rather than trusting the plan: `build-server.mjs` writes a job's `tail` **only
in its `close` handler**. A *running* record carries `{state, kind, startedAt,
pid, touchedAt, deadlineAt}` and no tail at all.

- **While it runs**, `state: "running"` past the elapsed time in question IS the
  duration answer, and that is what the workflow's polling reads out loud.
- **At the end**, `ms`, `code`, `signal`, `stopped` and the once-a-minute pulse
  tail arrive together. `ms` should be ≥ 1,200,000 with `code: 0` and no
  `signal`. A `stopped` value, or a tail that ends near minute fourteen, is the
  old ceiling still in force.
- **A 404 is not a completion.** `GET /job/<id>` answers 404 both for an id the
  service never saw and for one whose record went with a recycled container, so
  the runner reports that as CANNOT TELL and exits non-zero. Cannot-tell must
  not read as an answer.

**What it does NOT prove, stated rather than glossed**: the lease surviving
(that is `edit_sweep_lost` selecting on `lease_expires_at` and never on elapsed,
which is a Postgres property), the handoff TTL, and **publishing** — that last
one is the real addon run's job, below.

### Probe 2 — the long connection, with no model in it

Same workflow. Inputs: `probe` = **`wire`**, `ms` = **`300000`**,
`everyMs` = **`20000`**. (Or, by hand:)

```
POST /api/site/job-probe   {"probe":"wire","ms":300000,"everyMs":20000}
GET  /api/site/job-probe?id=<id>
```

Two long connections in turn — never raced — through the **same `node:https`
sender a model call uses. `quiet` sends nothing until it answers, which is what
a non-streaming provider call looks like on the wire; `trickle` sends a byte
every tick, which is what `stream: true` produces.

**The probe names its own reading** rather than leaving two rows to be read by
eye, and all four mean different next moves:

| reading | what it means |
|---|---|
| `idle-kill` | quiet died, trickle lived — **run 45's 270-second reading holds and streaming IS the fix** |
| `no-wall` | both lived — **the failure was NOT REPRODUCED. That is not the same as settling the historical cause** (owner, 2026-09-14). Run 45 may have died of something else, or of a condition not present at probe time — a different egress path, a busier account, a transient. It removes one hypothesis and proves no other. |
| `lifetime-cap` | both died — streaming cannot beat it and the next fix has to be something else |
| `quiet-survived-trickle-did-not` | nothing expected this; read both `wire` fields before concluding anything |
| `hung` | an arm **never answered and never died** — and this is checked FIRST, because the other four readings are unsafe when one arm produced no result at all. Added 2026-09-14 after run 3, where the probe itself had no clock and sat on a black-holed socket until the job's deadline. Each arm now carries its own `AbortSignal`, the ask plus a minute (`wireCallBoundMs`), so a hang is *reported* rather than run out. |

**IF YOU GET `hung`, IT IS NOT THE SAME AS A KILL AND MUST NOT BE READ AS ONE.**
A kill means something along the path closed the connection; a hang means nothing
ever came back. Reading a hang as `idle-kill` would say *"streaming is the fix"*
about a socket streaming does nothing for.

### Re-reading a probe that is already running (2026-09-14)

Same workflow, and it is the **`jobId`** box. Paste the id step 4 printed on an
earlier run and leave everything else alone: the run **skips the fire** and reads
that job back, using the same polling and printing the same verdicts. Leave the
box empty to fire a new probe, exactly as before.

The fire is skipped rather than made idempotent, deliberately — a second launch
of the same shape would take a second build lane to answer a question already in
flight.

**A job whose container has recycled is gone**, and `GET /job/<id>` answers 404
both for an id the service never saw and for one it has forgotten. So the
read-back is for a probe still running, not for rescuing a run that ended hours
ago — run 3's own id (`37b59fa9076189d57275b2703868f3d3`) is almost certainly in
that second category.

**`no-wall` is the reading most likely to be over-read, which is why it is
spelled out twice.** A probe that does not reproduce a failure has measured its
own run and nothing else; the honest next move is to repeat it, and to keep
`callFailure`'s `wire` field on the real addon path so the next genuine failure
carries its own account rather than needing a probe at all.

**And read each half's `wire` field, which is the falsifier**: `headersMs: -1,
chars: 0` is a death before any byte moved; `chars > 0` is a death with the
stream open. `cause` carries the underlying error code.

**WHAT THE PROBE CANNOT ATTRIBUTE, AND WHY IT STILL ANSWERS.** A dead connection
looks identical from the container whether the *container's own egress* killed it
or the *gateway Worker at the other end* gave up holding the response. The probe
cannot tell those apart, and a reading that named one of them would be claiming
more than it measured.

**The trickle arm is what makes that not matter, and it is doing double duty.**
Both arms are the same path, the same endpoint and the same duration — the only
difference is whether bytes move. So `idle-kill` (quiet dies, trickle lives) says
the path *can* hold a connection that long, and what killed the other one was the
silence. That is the whole finding, and it is true of whichever end did the
killing — which is also why the fix is the same either way. Read the reading as
*"silence is what dies"*, not as *"Cloudflare's egress did it"*.

**Until one of these runs, the eleven milliseconds between run 45's death
(270,025 ms) and `build-call.mjs`'s recorded wall (270,036 ms) are strong
evidence and NOT proof**, and this file will not call them one.

---

## Step 0 — the disposable site

> ### ⚠ `repairbench-1` ALREADY EXISTS AND IS PROBABLY DIRTY (measured 2026-09-14 05:07Z)
>
> It answers **200**, `x-site-build: mu0gbc8t-ba1r4i`, `x-site-version:
> 01789342481159-bukcse` — **published 2026-09-13T23:34:41Z**, which is BEFORE
> run 44. Its served page is the marketing build and nothing else: the only
> `data-slot`s on it are `hero`, `gallery`, `price-list`, `service-card`,
> `testimonial-grid`, `contact-card`, `opening-hours`, `location-card`,
> `cta-band`, `badge`, `status-dot` and the chrome. **No form, no member area.**
>
> **But run 44 MADE ITS DATABASE and then died at 12m22s without publishing.**
> The schema is applied before the publish, so the tables ask A is meant to
> create may already be there while the page that uses them is not. If they are,
> ask A is no longer a test of *provisioning on first touch*, and the add step's
> "you already have that" wall may refuse it outright — **a paid run that buys
> nothing.**
>
> **ONE FREE CHECK DECIDES IT, and it is worth doing before spending:** open
> `repairbench-1` in the app and look at its **Data** panel.
>
> - **No database** → run ask A on `repairbench-1` exactly as written below.
>   That is the owner's item 3 read literally, and it tests everything.
> - **A database, with tables** → build a **fresh** disposable site first
>   (`repairbench-2`, same brief) and run ask A there. Rerunning on a dirty site
>   would measure the wall, not the work.
>
> Either way the ASK is unchanged. Only the slug moves.

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

**THREE changes are now live.** The permission fix merged 2026-09-13 (deploy
2114); **the container clock merged 2026-09-14 (deploy 2115)**, which decides
whether ask A can finish at all; and **the two probes and their door merged
2026-09-14 (deploy 2116)**.

| | state |
|---|---|
| **`main`** | `b062e30a` (fast-forward from `345a4b3f`, 35 files) |
| **deploy** | run **2116**, green, 2026-09-14 **05:31:14 → 05:34:04Z**, 2m50s |
| **release checks before the merge** | `unit tests` run **2519** green; `site build` run **1131** green, all 20 steps, `site-build.mjs` **382 passed, 0 failed** in 17m51s (kit-typecheck 4, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14, site-runtime 47, every one 0 failed) |
| **the image** | **BUILT** — the step's own line: `built isibi-app-sitebuildcontainer:bbaadcf0342800bd (registry answered 404; 180 inputs off ./Dockerfile)`, step **2m01s** |
| **the container** | **ROLLED** — `EDIT isibi-app-sitebuildcontainer`, `d009cb2fc5f6053e` → `bbaadcf0342800bd`, `SUCCESS Modified application`, applied **05:33:55Z**. Read out of the log, never inferred from the step's duration |
| **the 15–20 minute hold** | runs to **~05:49–05:54Z** — fire nothing at the container before then |
| **the drain** | `no live leases after 1s — deploying` |
| **deploy gate** | left to expire on success |
| **served assets** | exactly **two** uploaded (`/chat.js`, `/edit-poll.js`, 84 already uploaded), and **both hash byte-for-byte identical to source** — `chat.js` `cf50a72ddee43d1f`, `edit-poll.js` `6de38f0c05eb0e51` |
| **`JOB_RUNNER_EVERYONE`** | **`on`** in the deploy's own environment block |
| **the probe route is really wired** | `/api/site/job-probe` **404 → 401** across this deploy, with `/api/nope-not-a-route` **404** as the control. An unmatched path falls to `env.ASSETS` and 404s, so 401-against-404 is the free token-less discriminator |
| **Database migration needed** | **none** for any of the three |
| **Backfill for existing sites** | **written, guarded, driven against a real Postgres, NOT executed** — `scripts/grants-backfill.mjs`, and the owner's standing instruction is preview only |
| **Live probe runs** | **duration PROVEN, transport UNREAD.** Run 2 held a job child **1,200,182 ms — 20 minutes — inside the container**, `code: 0`, no `signal`, `stopped: null`, 20 of 20 pulses, with 30.2 minutes of deadline left: past 12m22s (run 44's death), past 14 min (the old `EDIT_JOB_MS`) and past 15 min (the consumer ceiling), with the deadline counting DOWN the whole way. Run 1 crashed in 17 s (`newJobId` called bare — fixed `a4d0f5e5`); run 3 came back **NOT PROVEN** because the probe carried no clock and sat on a black-holed socket (fixed — the `hung` reading, `f2e47b8e`). **The wire shape has still never produced a reading, and re-running it is free.** |
| **Live addon tests** | **all unrun** |
| **`workflow_dispatch` from a session** | **403**, re-measured 2026-09-14 **04:47Z** against `container-hold-probe.yml`: *Resource not accessible by integration* |

**What deploy 2115 changed, and why it matters to ask A.** Run 44's addon died
at **12m22s** against a **12m45s** wall — `EDIT_JOB_MS` (14 minutes) less the
publish and terminal reserves — with the database made, the page written and
nothing published. That wall was sized for a Cloudflare ISOLATE and the work had
already moved into the container, which has no such ceiling. So:

- **the container's work budget is now `Infinity`** — no stopwatch on the work
  at all, which is the owner's own instruction (*"Containers shouldn't have a
  time limit"*);
- **a 50-minute deadline remains**, and it is a credential lifetime and a
  wedge-breaker, not a work budget. It is capped at 57.5 minutes by a live
  Postgres RPC (`edit_handoff` raises `bad ttl` past 3600 s), so lifting it is a
  migration;
- **`MAX_BUSY_HOLD_MS` is derived** (52.5 min) rather than typed. It had been
  equal to the job deadline, which stopped the container 60 seconds *before* the
  SIGTERM that lets a job end gracefully — a shipped defect found while checking
  what the new deadline would break;
- **`JOB_RUNNER_EVERYONE` is `on`** in the deploy, so every site's edits and
  addons run in the container. Before this it named one site (`fretwork-1`)
  through the canary, which is why run 44's addon on `repairbench-1` ran inline
  in the Worker where fourteen minutes is correct and unavoidable.

**THE PROOF BAR FOR ASK A, set before the run so it cannot be moved after it.**
Run 44's chain died at 12m22s against a 12m45s wall. **The clock fix is proven
by an addon whose work runs past 12m45s and publishes anyway.** If ask A comes
in under that, it proves the container path works and says **nothing** about the
clock — a longer ask would then be needed to settle it. Read the run's elapsed
time and say which of the two happened; do not report a fast green run as proof
of the clock.

**The roll was read out of the log, never inferred from the step's duration** —
this repository warns against that inference in both directions.

**What is NOT proven about the container, named rather than glossed.** That a
COLD START really lands on `d009cb2fc5f6053e` is answered by
`GET /api/site/build-health`, which is auth-gated and needs a signed-in session
no agent here has. Without a token it answers **401**, `/api/site/runtime`
beside it **401**, and a made-up path **404** — so both routes are matched and
gated, which is as far as this goes. The first container job after the hold is
the other proof, and the three asks below are that job.

**`GET /api/site/runtime?slug=repairbench-1` is worth one free read before ask
A**, in a signed-in browser: it answers `runner` and the switches behind it, and
`runner: true` there is what says the addon will run in the container rather
than inline. Reading `deploy.yml` tells you the default, never the deployment.

**Ordering, now settled.** Both fixes are live, so running the three asks proves
them together and gives the disposable site's tables the new column-scoped
grants from the moment they are created.

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

### 1b and 1c. The two free probes — BEFORE anything is spent

**<https://github.com/canias7/isibi-app/actions/workflows/job-probe.yml>**
→ *Run workflow*.

**1b (`hold`) IS ALREADY PROVEN and does not need re-running** — probe run 2
held a job child **1,200,182 ms, 20 minutes, `code: 0`, 20 of 20 pulses**, with
30.2 minutes of deadline left. Fire it again only if the container or its clock
changes.

**1c (`wire`) IS THE ONE STILL TO RUN.** It has never produced a reading: run 1
crashed in 17 seconds on a route defect, and run 3 hung because the probe itself
carried no clock. Both are fixed, and it costs nothing.

They cost nothing, so they come first on the ordering rule this file already
uses: *a free run that can invalidate a paid one goes first.* If `wire` comes
back `lifetime-cap`, the transport fix is the wrong fix and the next change is
something else.

| field | 1b — duration *(already proven)* | **1c — transport** |
|---|---|---|
| Use workflow from | `main` | **`main`** |
| `probe` | `hold` | **`wire`** |
| `ms` | `1200000` | **`300000`** |
| `everyMs` | *(leave default)* | **`20000`** |
| `site` | `fretwork-1` | **`fretwork-1`** |
| `jobId` | *(leave empty)* | *(leave empty)* |

`site` is read ONLY to ask `/api/site/runtime` which deploy is live and whether
`runner` is on — nothing is built, edited or published on it. Leave `jobId`
empty to fire; it is only for re-reading a probe that is already running (see
"Re-reading a probe that is already running" above).

**Roughly 26 minutes and 16 minutes of wall-clock**, and they share one build
lane, so read the first before firing the second. Each uploads a
`job-probe-<shape>` artifact with its whole log, whatever the outcome — and the
`wire` shape can no longer sit past its own bound: each of its two connections
carries a six-minute clock and a hang is reported as `hung` rather than run out.

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
