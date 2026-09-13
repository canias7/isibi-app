# Running the three addon requests by hand

Owner, 2026-09-13: *"Prepare the exact three addon test requests and the GitHub
Lane Sweep settings I need to run them manually. Include how to create the
disposable test site first and what result to check for each request."*

**Why this is a run book and not a run.** A session here cannot dispatch either
workflow — `POST /actions/workflows/<file>/dispatches` answers **403 Resource
not accessible by integration**, the recorded 2026-09-03 scope wall, re-verified
today on the free `answer read` workflow — and no `SUPABASE_SERVICE_KEY` exists
in a session, which the harness needs to sign in as the owner. Either alone is
enough. So every number below is what to READ, not what was read.

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
   against what is on `main`.

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

### Ask A — does the picker hear storage that was never named

```
Let customers submit repair requests and log in to see their own requests and status updates.
```

**What it is for.** Not one of the words *database*, *table*, *store* or *save*
appears in it, and it cannot work without a table. Until 2026-09-13 the picker
got 402 characters and the customer's sentence with no description of the site
at all, so a sentence like this had nothing to route on. It now gets the same
site note the designers read, plus the instruction to read what an ask NEEDS
rather than only what it names — *"whether or not they mention a database,
storing or a table … and also sign-in, accounts, members, profiles"*.

**What to check, in four places:**

1. **The run log** — `the picker chose: ["table", …]`. If `table` is absent, the
   change did not reach the live behaviour and nothing below matters.
2. **The reply** — `provisioned: true` and *"Your site has its own database
   now."* This is the first backend touch on a frontend-only site, which is the
   path that had never run live.
3. **The coverage record**, printed under `coverage record: {...}`:
   - a `covered` line for submitting a request, naming the table;
   - a `covered` line for a member seeing only their own, naming
     `access: user` (or `read: own, write: own`);
   - status updates are either `covered` by a status column or
     `elsewhere → page`.
4. **The site** — the Data panel lists the new table; the page carries a form.

**The customer sentence should be EMPTY or near it.** `requirementNote` says
only what is outstanding *after the whole change ran*, and a requirement handed
to the page step is covered once that step runs. A sentence here means something
really was left open — read which.

---

### Ask B — does an unsupported requirement reach the customer

```
On each repair request, keep a record of every change to its status, so we can see who changed what and when.
```

**What it is for.** This is the acceptance case the guard reproduces, live.
`history` is a real feature of the schema engine — it creates a snapshot table
and a trigger — and it appears **0 times** in `TABLE_ITEM`, so the designer
cannot ask for it. Before this change it was invisible to both diagnostics: the
model could not express it, and nothing said so. The requirement now has to come
back `unsupported` with a reason.

**What to check:**

1. **The run log** — a line reading
   `· unsupported: "…" — …`, with the `why` in a customer's terms.
2. **The customer sentence** — it must open
   **"One thing your site can't do yet:"** and carry the need and the reason.
   This is the half that was silent before.
3. **What it still shipped.** An unsupported requirement is not a refusal: the
   step should still add whatever it CAN (a status column, or a notes table),
   and the reply should say so. A run that refuses the whole ask is a different
   finding and worth reporting as one.
4. **`· properties the tool does not offer: [...]`** — if the model reached for
   `history` by name anyway, it shows up here, and the customer gets the
   count-only clause (*"I also asked the database for a guarantee it doesn't
   offer"*) with no property name in it. Either outcome is a pass; which one
   happened is the interesting part.

---

### Ask C — does the ceiling allow a table nobody named

```
Let customers pick a drop-off slot when they book a repair, and stop two people taking the same slot.
```

**What it is for.** The ceiling moved off a COUNT. It used to read *"as many
tables as the things they NAMED, and not one more"*, which refuses the
supporting table a feature cannot work without — a bookings table pointing at a
slot nothing defines. It now reads *the smallest set of tables that makes what
they asked for actually work*, and this ask is the rule's own worked example.

**What to check:**

1. **Two tables, not one** — a booking and the slot it points at. The slot is
   the table the customer never named.
2. **`because` is filled in on the unnamed one**, saying what breaks without it.
   Visible in the developer record (below); a supporting table with an empty
   `because` is the rule half-obeyed.
3. **The guarantee is on the slot** — `unique`, or `noOverlap` if the model read
   the lengths as varying. `unique` alone catches only exact collisions.
4. **The coverage list** should carry *"the same slot cannot be taken twice"* as
   `covered`, naming the guarantee.
5. **It must not round the model off.** No customers table, no staff table, no
   categories table. The rule forbids exactly that, and a run that adds one is a
   real finding.

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

---

## Cost

| | measured |
|---|---|
| the disposable build | **11–45** credits (runs 91 and 80) |
| an addon that publishes | **~12–15** (run 29 measured 13) |
| three asks | **~35–45** |
| **total** | **~50–90** |

---

## One ordering decision, stated rather than assumed

The managed-column permission fix changes the GRANTs the engine emits. Any table
these three asks create gets **column-scoped** write grants only if that fix is
live when they run. The site is disposable, so nothing is lost either way — but
running the three asks after that fix deploys proves both changes at once, and
running them before proves only the tables step and leaves the new tables on the
old table-wide grants.

If the fix is merged first, the ordinary rule applies: it touches `site-rls.mjs`
and `site-schema.mjs`, both in the Worker's module graph and therefore image
inputs, so the container rolls and the **15–20 minute hold** applies before
firing anything that must run the new code.
