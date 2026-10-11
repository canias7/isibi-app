# 2026-10-11 — The final acceptance batch, prepared (not pressed)

> **THIS FILE IS HISTORY, NOT INSTRUCTIONS.** The instructions to follow now,
> with the current image id (`f9c4097ed179c5f8`), the blocked state and the
> live proposal, are in [`docs/acceptance-current.md`](../acceptance-current.md).
> Image ids, stages, budgets and press boxes below are as they stood in each
> round, kept as written for the record.

> **Corrected by round 3 (`958cd703`, after Codex's review of `542a6c34`).**
> The spend wall and the per-press ceilings first written here were not
> bounds: the wall reacted only after charges appeared and could not see
> several jobs finish between two reads, and each ceiling was a historical
> job cost that nothing enforced. They are removed from the code, the tests
> and these records. **The only enforced bound is the account balance** (§6).
> Sections 1, 3 to 6 and 8 below are rewritten to the current truth, and
> round 3 is §9.
>
> **Corrected again by round 4 (§10, after Codex's review of `23861838`).**
> Round 3 told the owner to set the account's whole balance to 100 before
> each stage. **That is withdrawn: lowering or resetting the account balance
> is not a test budget, and no separate test budget exists yet.** Every paid
> acceptance entry point (the request presses, the image-free Build and now
> the routing-only probe batch) refuses while the balance is above 100, so
> at today's balance **paid acceptance is blocked**, and stays blocked until a
> real test budget exists. Nothing here asks for the balance to change.

Codex reviewed `5504bb55`: 164 focused tests passed, CI green, and
independent checks confirmed the stale-value correction and the image-only
fresh-call counting. **Both corrections are closed as verified offline.**

The owner then asked for the final acceptance batch to be prepared, not run:
- the existing harness's verdicts should read the per-job `prepUse` evidence;
- the image-spending restriction should be enforced in the execution path;
- image-free scenarios, one real-model case, offline rehearsal with
  negative controls, and the commands, deployment requirements, costs and
  enforceable caps, ready for approval.

**Commits**: `1e853d92` (the harness and the switch), with records after.
**Nothing was executed**: no paid test, image generation, image retry, merge,
deploy or container build. fal stays funded and off limits.

## 1. What changed

**The image-purchase switch, in the execution path**:
- `IMAGE_PURCHASES=off` refuses every photograph at `makeSitePhoto`
  (`worker.js`), before anything leaves for the image service. It is the one
  place a photograph is bought: every build, edit, add-on, placement and
  preparation path reaches it, and the only `fal.run/` post sits behind it.
  The outcome is `refused`, which every caller already reports as not made
  and not paid for.
- Container jobs get the switch too (`JOB_ENV_NAMES`).
- `/api/site/runtime` reports it as `imagePurchases`, and the free runtime
  press prints it.
- **Deploy fallback `'on'`**: production is unchanged until the owner sets
  the secret.
- **Proof**: through the real request driver, a message asking for a
  photograph makes no provider call with the switch off, and its one call
  with it on (the control). On `5504bb55` the same off case made the call
  (`actual: 1`).

**The press's verdicts read the per-job evidence** (`reuseVerdict` in
`scripts/canary-requests.mjs`):
- **Every run job must have evidence that reads**: `known`, whole-number
  `replayed`, `rebased` and `fresh`, and `staged` of yes, no or unreadable.
  It fails on a job listed as not known, a run job with no entry, a count
  that is not a number, or any `rebased` above 0. Missing evidence is never
  read as zero.
- **Exact reuse** (staged yes, replayed ≥ 1, fresh 0) is told apart from a
  prepared job that also asked a model (replayed ≥ 1, fresh ≥ 1).
- With `overlapped`, the exact reuse must be by a part whose prepared step
  overlapped other work, as shown by the recorded intervals
  (`overlapVerdict`, unchanged).
- The final-state checks (headings, pages, menus, rows) are unchanged.

**The real-model observation** (`needsObservation`): for the named part it
records `asked-again`, `exact`, `not-prepared` or `unknown`, off the
evidence. It passes nothing and fails nothing. The press's verdict lists it
under *unverified* as one sample. The final state judges whether the
result is right.

**The press refuses to buy images**: a scenario marked `images: "none"`
sends nothing, rehearsal or not, unless the live Worker answers
`imagePurchases: false`. The image-free Build check does the same.

**The spend wall** (withdrawn in round 3): a polling threshold that pressed
the request's Stop once a polled sum of charges reached the budget. It could
act only after a charge was visible and could miss several jobs finishing
between reads, so it bounded nothing. It is gone, with its `ceiling` fields.

**The image-free first Build** (`BUILD_CHECK_NO_IMAGES`, owner workflow
`mode: check-no-images`):
- a fresh slug, and a brief that asks for no photographs;
- it refuses unless the live Worker buys none;
- its uploads must hold no image and its page must place none of its own;
- its overlap must come from page bands or design agents, never photographs.
- (round 3) before paying it reads the account's own flags and refuses unless
  an image-free parallel mode is on (§9).

## 2. Why the scenarios look as they do

- **The real router splits a message only into what it holds back**
  (`planParts`). One text answer can change headings on several pages, and
  one data answer can change rows in several tables. So two headings, or two
  prices, become one part with nothing to run beside it.
- **Independent page and table work** is therefore a heading beside a price:
  two parts. That shape has been split live before (run 119, lv-parallel).
- **Neither demo site has a second display table** (read live and free on
  2026-10-11: the bakery has `loaves`; fretwork-1 has `lessons`, and its
  `gear` is not readable to visitors). So the real-model case uses the text
  step: a heading that must repeat another page's heading, which a step
  shown only its own page cannot know.

## 3. The batch, in order (round 3) — HISTORICAL

*Superseded by `docs/acceptance-current.md`; kept as the round-3 record.*

All on **fold-lane-bakery**, in request mode, each buying no image. Each
row-changing press starts from the table the one before leaves, so a press
that finds anything else refuses before sending. The headings and the table
were read live and free on 2026-10-11; the Wholesale and Tasting Evenings
headings were read again, free, for round 3.

**Stage 1** (blocked: see §6):

| Order | Press | The message | What it shows | Estimate |
|---|---|---|---|---|
| 0 | routing probe `acceptance-split-1` | every message below, routed and nothing applied | what the real router does with each: batched (one answer, nothing held back) or parts (a change held back) | 6–18 |
| 1 | `acc-pages-real` | *Change the Wholesale page heading 'Bread for the counter' to 'Bread for your counter', and change the Tasting Evenings page heading 'Join the waiting list' to 'Join our waiting list'.* | both headings changed; the real router's shape recorded (batched, parts in turn, or parts concurrent), **no concurrency demanded** | 2–8 |
| 2 | `acc-page-table` | *Change the Wholesale page heading 'Daily bread for Bristol cafés' to 'Daily bread for Bristol cafés and delis', and change the Country White's price to £4.90.* | **only if probe S3 made parts**: heading; Country White 4.8 → 4.9; intervals; ≥ 1 exact reuse by an overlapping part | 4–12 |
| 3 | `acc-table-page` | *Change the Walnut Levain's price to £6.30, and change the home page heading 'Fed every morning since 2019' to 'Fed by hand every morning since 2019'.* (tab closed, fresh session) | **only if probe S4 made parts**: as 2, and progress | 4–12 |
| 4 | `acc-needs` | *Change the Seeded Wholemeal's price to £5.50, and change the Order page heading 'Pick a loaf and a time to collect it' so it says exactly the same as the main heading on our Visit page.* | /order heading becomes "Come and see us"; Seeded 5.4 → 5.5; evidence; **whether the model asked, read from its own answer, recorded and unverified** | 4–14 |

**Stage 2** (blocked: see §6):

| Order | Press | The message | What it shows | Estimate |
|---|---|---|---|---|
| 5 | `acc-mixed` | *Add a Bulk Orders page explaining how cafés can order bread in bulk: a minimum order of ten loaves, and orders in by 2pm for delivery the next morning. Put a link to it in the menu, and change the Olive & Rosemary's price to £5.90.* | the page by its words; its menu link waits for it; Olive 5.8 → 5.9; intervals; ≥ 1 exact reuse | 17–34 |
| 6 | Build `check-no-images` | the Saltmarsh cheese counter brief (no photographs) on `saltmarsh-cheese-counter` | one page, ≤ 15 components, overlap by bands or design, order, progress, closure, no image stored or placed, money | 11–40 |

**Estimates, not limits**: stage 1 about 20–64, stage 2 about 28–74, the whole
batch about 48–138. A press that spends more than its estimate **fails its
own check**, but nothing stops it part way: the balance is the bound (§6).
Row 2 or 3 is skipped when its probe shows the router batching the message
or asking a question back: that is recorded as the router's behaviour, never
as a pass or a failure of concurrency.

**Estimate sources** (measured): routing 1–3 per message and 1–3 per held
part; a text job 1–2; a data job 1; an add-on with a page 12–18, its
requirement judgment about 1; a menu step 1–2; a first build 11–45 (the top
with two photographs, which this one cannot buy).

## 4. What must happen first (the owner's) — HISTORICAL

*Superseded: the image id below (`62b0dae10edebdf5`, round 3's prediction) is
not current. Follow `docs/acceptance-current.md` §5.*

1. Review and approve this batch: the messages, the estimates, the stages.
2. **Set the repository secret `IMAGE_PURCHASES` to `off`.** **This affects
   every customer, not only the tests**: while it is off, no build, edit or
   add-on anywhere buys a photograph, and pages that would have had one are
   reported as missing it.
3. **Merge the branch to `main`** (a fast-forward). That is one deploy run.
   The container image rolls `8d6dbcea93252fbb` → `62b0dae10edebdf5`
   (predicted on `958cd703`, not built), because the Worker changed.
4. Wait 15–20 minutes for the image window.
5. **The free runtime press** (*edit canary*, every paid box blank or `no`):
   it must print the new deploy sha, the new image and
   `imagePurchases=false`.
6. **For the Build only**: a free rehearsal of the Build (*build as owner*,
   `check-no-images`, spend not `yes`) reads the account's build flags before
   anything else is paid. One of `design`, `graph` or `bandsEveryone` must
   already be on: if none is, it stops saying so and naming each flag's
   value, and its saved record holds `flags`. **Nothing is switched on for
   the test**; with none on, the Build stays unrun.
7. **A separate test budget** (§6, §10). None exists; until one does,
   every paid press above refuses and only the free rehearsals can be
   pressed. Lowering the account's balance is not the step.

## 5. The presses (each the owner's, in order) — HISTORICAL

*Superseded, image id included. Follow `docs/acceptance-current.md` §5.*

**The probe**, workflow *edit canary*: the routing-only batch box =
`acceptance-split-1`, spend `yes`. It routes six messages, applies nothing,
and writes each answer with its shape (`batched` or `parts`).

**Requests**, workflow *edit canary*, one press each. The boxes, by their
descriptions:
- **The site to edit…**: `fold-lane-bakery`
- **RUN A NAMED SCENARIO IN A REAL BROWSER…**: `acc-pages-real`, then
  `acc-page-table` and `acc-table-page` if their probes made parts, then
  `acc-needs`; in stage 2, `acc-mixed`
- **Run the ONE paid edit as well (yes/no)**: `yes`
- **Refuse to spend unless the Worker reports this deploy sha…**: the merge
  sha
- **Refuse to spend unless a cold container reports this image id…**:
  `62b0dae10edebdf5`

Every other box stays blank. With the spend box `no`, each is a free
rehearsal that stops before sending, and still refuses if photographs are
bought or the balance is above 100. Stop at the first failure and review it
before the next press.

**The Build**, workflow *build as owner*:
- **build | edit | check …**: `check-no-images`
- **check only: yes sends the build…**: `yes`

## 6. How spending is bounded (round 3)

**The enforced bound is the account balance, and only that.**
- **Why it holds**: every charge is taken by the server inside one statement
  on the account row. `use_credits` and the edit reserve take
  `balance >= cost` or nothing; `credit_debit` takes at most what is there
  (`supabase/applied/20260901222000_live_snapshot_edit_rpcs.sql`,
  `20260905161410_credit_debit_and_reverse.sql`). The building account is
  not a founder, so nothing exempts it. So the account never goes below
  zero, and **net credits spent from a balance of B are at most B**. That
  covers routing, running jobs, retries, redelivered messages and work
  prepared at the same time, and it does not depend on a browser being open
  or on the test runner surviving.
- **What the presses add**: every acceptance entry point (the request
  presses, the image-free Build and the routing-only probe batch) sends
  nothing while the balance is above `ACCEPTANCE_CAP` (100), and nothing
  unless it covers the press's estimate (`acceptancePreflight`,
  `buildPrerequisites`). **This is a refusal, not a test budget.** The
  balance it would rely on is the whole account's, and lowering it is not a
  way to make one. At today's balance every paid acceptance press refuses.
- **Provider cost is not credits**: preparation model calls are platform
  cost, recorded per request (`provCost`), not taken from the balance.
- **What is no longer claimed**: no polling threshold, no per-press
  ceiling, no per-request cap on the server. A press can overrun its
  estimate; it then fails its own check (`overBudgetVerdict`; for the Build,
  the money check), and the balance is what stopped it.
- **No image can be bought**: the switch is checked in the Worker and in
  every container job before the image service is called, and every press
  refuses unless the live Worker reports it off.
- **Paid acceptance is blocked (round 4).** No separate test budget exists.
  Until there is one, only the free rehearsals run: each reads its
  prerequisites and reports every one a paid press would refuse on. Making a
  test budget is a billing change, not part of this correction.

## 7. Rehearsed offline (supplied answers)

*As written for round 2 (`1e853d92`). The spend-wall cases below were
removed in round 3; its tests are in §9.*

**`test/canary-acceptance.test.mjs`** (13 cases):
- each scenario as written, with the table chain;
- `reuseVerdict` on every shape of evidence;
- `needsObservation` and its place under *unverified*;
- the spend wall and the image refusal;
- `acc-page-table` through the **real canary driver** against the stand-in
  app:
  - the positive press;
  - one negative control at a time, each failing its own check and nothing
    else: no concurrency, evidence not known, a count missing, fresh where
    exact was required, a run job with no evidence;
  - the requested change never made: the row check fails while the evidence
    and intervals pass;
  - the image guard stopping the press before its message: purchases on,
    the runtime unreadable or throwing, no reader;
  - the spend wall pressing Stop, with its control;
- the wiring.

**`test/canary-build.test.mjs`** (+4 cases): the image-free spec; its
refusals; end to end offline with an image stored, a photograph placed,
uploads unread and an overlap only photographs could show, each failing;
the wiring.

**`test/image-purchase-switch.test.mjs`** (3 cases): the switch through the
real request flow, its control, and the wiring.

**Verification**:
- **Red check on `5504bb55`**: with `IMAGE_PURCHASES=off`, the add-on's
  photograph was still asked of the provider (`expected: 0, actual: 1`). The
  new verdicts and scenarios do not exist there.
- **Sweep**: 24 of 24 mutants killed; the comment-only control survived.
  Every file was checked restored by checksum. The mutants cover:
  - `reuseVerdict`: not known, counts, a run job with no entry, a re-base,
    exact against fresh, overlapped, staged, nothing served;
  - the batch verdict's wiring and `needsObservation`;
  - the spend wall: its threshold, an unknown charge, the baseline, its
    wiring;
  - the image refusal and the press's preflight;
  - the Worker's switch, its reader, the container passthrough and the
    runtime field;
  - the Build's preflight, its no-image checks and its photograph-free
    overlap.
- **Related suites**: the canary files 595 of 595 and the Build file 21 of
  21. Doc tests 32 of 32.
- **Full suite**: `10425 / 10425 / 0 / 0` locally on the code of
  `1e853d92`.
- **Image prediction**: production `8d6dbcea93252fbb` →
  `9547695841a6c5ac` (205 inputs). Not built.
- **CI on `aa02672f`** (code plus records, one push): unit tests
  38123355384 green (4 m 56 s); site build 38123355338 green (all eight
  jobs).

## 8. What stays open — the completion criteria

- **Run the batch live**, after the owner's approval and §4, in two stages.
  Each press passes every requested change in the final state, no image
  bought, and its spend within its estimate. Concurrency (intervals) and
  exact reuse are judged only where the router made parts (rows 2, 3, 5).
- **The real router's shape for each message**, from the probe and from
  `acc-pages-real`: recorded as observed, one sample each.
- **The real model's answer in `acc-needs`**, from its own `needs` count:
  one observation, not a rate. With no count, it stays unknown.
- **The Build's overlap must show by bands or design agents** on the
  account's existing flags; with none on, the Build stays unrun.
- **Put `IMAGE_PURCHASES` back** to `on` (or leave it off) by the owner's
  choice, with a redeploy. Until then no customer gets photographs.
- **Carried**: real images unverified; two substantive steps at once never
  shown live; table/table work cannot be pressed on either demo site (each
  has one table visitors can read), so it is probed through routing only
  (two rows of one table).

## 9. Round 3 — Codex's review of `542a6c34`

Codex: 58 focused tests passed and CI was green; the image-purchase guard
and the `prepUse` evidence checks were verified and are kept. Found:
1. **False spending guarantees.** `spendWall` reacted only after a charge
   appeared; several jobs could finish between two polls; the ceilings were
   historical maximum job costs, enforceable by nothing. The Build preflight
   accepted a balance of 971 with a budget of 40, and `buildMoneyVerdict`
   accepted a simulated build charge of 60.
2. **The Build's prerequisites were not checked before spending.**
3. **The coverage did not follow the real router**: supplied split answers
   stood in for what the router does with page/page and table/table
   requests, and an extra model call was read as the model asking.

**Commits**: `958cd703` (code), with records after.

**What changed**:
- **The balance as the bound**: `spendWall`, `chargedSum` and every
  `ceiling` removed. `ACCEPTANCE_CAP = 100` on every acceptance scenario
  (`capRefusal`) and on the Build (`buildPreflight`). The Build's money check
  fails above its budget (`max`), and a request press adds the check *this
  press spent no more than its estimate* (`overBudgetVerdict`, from the
  press's own charges after the end).
- **The Build's prerequisites** (`buildFlagsVerdict`): read from
  `/api/site/runtime` before anything is paid. It needs a 200 with
  `design`, `graph`, `bandsEveryone` and `bands` all booleans, and one of
  `design`, `graph` or `bandsEveryone` on. `bands` alone does not count: its
  canary list can name the site rather than the account. All three modes
  leave a mark the overlap verdict can measure (graph mode records its waves
  on the design mark). Nothing changes a flag, and the Build's page and
  component limits are unchanged.
- **The real router's shape** (`routingShape`): `batched` (one part: one
  step made every change in one call, never reported as parallel work),
  `parts-in-turn`, `parts-concurrent` (only by recorded intervals) or
  `unknown`, with what the route held back. Recorded under *unverified*,
  never a check. The probe report prints the same reading per answer
  (`shapeSaid`). **The router's instructions say same-layer changes are one
  answer; that is the code's reading, not live evidence**, which is what the
  probe and `acc-pages-real` are for.
- **Direct evidence of the model asking** (`prepUse` v3): the text and data
  steps note each scoped answer, and each that said `needs`, where they read
  it (`deps.seen` in `builder/site-apply.mjs`, `noteSeen` in `worker.js`).
  The per-job evidence carries `scoped` and `needs`; the view serves them,
  `null` when missing. `needsObservation` answers `asked` (needs ≥ 1),
  `did-not-ask` (scoped, needs 0), `not-scoped`, or `unknown`. A fresh call
  beside a replay, with no count, is `unknown`.

**Tests** (offline; supplied answers wherever a model would answer):
- `test/acceptance-spend-bound.test.mjs` (new, 4 cases), through the real
  request driver, queue consumer and routes, **no browser and no press**:
  - control: with room, both row changes land and are charged;
  - **charges far above every estimate** against a balance of 6: refused by
    the ledger before any row is written, never below zero, net ≤ 6;
  - **room for exactly one priced-up job, every message delivered twice**,
    all jobs left to finish between reads: exactly one charged, the second
    refused, the retry charging nothing more, net within the balance;
  - every press and the Build refuse at 971, send at 100, and carry no
    ceiling.
- `test/canary-acceptance.test.mjs` (13 → 16): `needsObservation` on direct
  evidence (an extra call alone is `unknown`); `routingShape`;
  `overBudgetVerdict` and the cap; **late, lost and coarse polling** (nothing
  seen until the end, both parts ending between two reads, a read answering
  nothing): the same verdict every time and no Stop pressed; charges far above
  the estimate failing only after the end; the press refusing at 971; the
  wiring of the over-estimate check; the probe batch reading and its shape
  line.
- `test/canary-build.test.mjs` (+2): the prerequisites (no mode on, bands
  only through the canary list, flags not reported, 971) each stop the Build
  before it sends, with no flag changed; one mode passes; Codex's 60 against
  40 fails through `buildMoneyVerdict` and through `runBuildCheck`.
- `test/parallel-independent.test.mjs`: the real Worker path records
  `scoped`/`needs` (IND 1: 1 and 0 for the prepared step, 0 and 0 for the
  unprepared one; IND 4 and IND 5: 1 and 1).
- `test/prepared-scope.test.mjs`: the view serves `scoped`/`needs`, `null`
  for evidence written before v3.

**Verification**:
- **Red check on `542a6c34`**: the Build preflight answers `""` (sends) at a
  balance of 971 against a budget of 40; `buildMoneyVerdict` passes a
  60-credit build against 40; the acceptance scenarios carry ceilings 14,
  14, 17 and 53 and no cap. IND 1, 4 and 5 fail there on the missing
  `scoped`/`needs`.
- **Sweep**: 27 of 27 mutants killed, both comment-only controls survived,
  every file restored by checksum. One survivor in the first pass (the
  canary's over-estimate check switched off by its guard) was killed by a
  pinned wiring line. The mutants cover the cap's value and comparison, the
  over-estimate verdict, the Build's cap, money maximum and its wiring, each
  flag rule, each `needsObservation` rule, each `routingShape` rule and its
  "none" reading, the Worker's two counters, the evidence write and read,
  both step notes, the view, the canary's check and the probe line's "none"
  reading.
- **Related suites**: 1,652 of 1,652 (canary, acceptance, request, parallel,
  site-apply, edit-canary, build and workflow files). Doc tests 32 of 32.
- **Full suite**: `10425 → 10434`, `10434 / 10434 / 0 / 0` locally on the
  code of `958cd703`.
- **Image prediction**: production `8d6dbcea93252fbb` → `62b0dae10edebdf5`
  (205 inputs). Not built.
- **CI on `87a48491`** (code plus records, one push, nothing pushed while it ran): unit tests 38126054995 green (4 m 41 s); site build 38126055016 green (all eight jobs).

**Remaining gaps**:
- **The spending bound is the balance the owner sets.** There is still no
  per-request or per-press cap on the server; a press can overrun its
  estimate within the balance and is then reported as failing.
- **The real router's batching is unverified** until the probe runs.
- **The model asking for missing context is unverified** until `acc-needs`
  runs, and then only one sample. Evidence written before this deploy has no
  counts and reads `unknown`.
- **The Build's flags** are the account's as they stand. If none of the
  three modes is on, the Build stays unrun.
- **Two substantive steps at once** remain unshown live.

## 10. Round 4 — Codex's review of `23861838`

Codex: 66 focused tests passed and CI was green; additional offline
reproductions found three gaps.
1. **The routing-only `acceptance-split-1` branch** of
   `scripts/edit-canary.mjs` checked only a minimum balance and **routed at
   971**, despite the plan's 100-credit restriction.
2. **The Build's "free" prerequisite rehearsal at 971 returned no flags**:
   `runBuildCheck` refused on the balance before it called the runtime.
3. **`runTextEdit` and `runDataEdit` noted the scoped answer only after the
   widened call succeeded**: a scoped answer that said `needs: true`
   followed by a widened call that threw left no evidence.

And the owner: **remove the instructions to lower or reset the account
balance**. No separate test budget exists; record that gap and keep paid
acceptance blocked, without changing balances or starting a billing
redesign.

**Commits**: `fdc678ca` (code), with records after.

**What changed**:
- **One paid preflight for every acceptance entry point**
  (`acceptancePreflight` in `scripts/canary-ui.mjs`): the balance read,
  enough for the estimate, no more than `ACCEPTANCE_CAP`; every item
  reported. The probe batch file now says `"acceptance": true`
  (`readProbeBatch` accepts true or nothing), and the probe branch applies
  the preflight before any routing call. In a rehearsal it reports what a
  paid press would refuse on; a paid press with anything unmet refuses with
  *Paid acceptance is blocked: no separate test budget exists*, saves the
  unmet items, and routes nothing.
- **The Build reads every prerequisite before deciding**
  (`buildPrerequisites` and `runBuildCheck`): the balance read, enough for the
  estimate, within the cap, the slug free, and, for the image-free Build,
  the image switch and the account's flags. The runtime route is a free read,
  so it is asked whatever the balance says. The record carries `prereqs`,
  `unmet`, `imagesOff` and `flags` (with each flag's raw value, `null` when
  not read). A rehearsal lists **every** unmet prerequisite. A paid press
  refuses on any of them **before its one paid call** (the strict check).
- **The scoped answer is evidence when it arrives** (`builder/site-apply.mjs`):
  each step notes `deps.seen("needs" | "scope")` right after the scoped
  answer is received, with that answer's own explicit `needs`, before any
  widened call. A widened call that then throws cannot erase it. The job's
  evidence is written in the job handler's `finally` (`worker.js`), so it is
  kept however the handler ends. Execution, retries and charging are
  unchanged: a failed call is still `reason: "send"` with `usage: null`.
- **Records and workflow descriptions**: no instruction to set, lower or reset
  the balance. Both workflow descriptions say paid acceptance is blocked
  with no test budget.

**Tests** (offline; every network call stubbed or in-process):
- `test/acceptance-entry-points.test.mjs` (new, 9 cases). The **real
  scripts** run in a child process under an in-process network stub
  (`test/fixtures/canary-stub.mjs`, and the new
  `test/fixtures/build-check-stub.mjs` for `scripts/build-check.mjs`):
  - the shared preflight;
  - **probe, paid, at 971**: exit 1, no routing call, the refusal and the
    unmet item saved, and no wording asking for a balance change;
  - **probe, rehearsal, at 971**: exit 0, no routing call, what a paid
    press would refuse on;
  - probe controls: at 96 every message is routed once; at 10 it refuses
    before routing;
  - **Build, rehearsal, at 971**: the runtime is read, the image switch and
    flags are recorded, the cap is listed as unmet, and the build is never
    posted;
  - Build, rehearsal, nothing ready: all three unmet items listed;
  - **Build, paid, at 971**: never posted. Control: within the cap with
    everything met, the paid call is made (to the stub);
  - the request presses carry the same cap, and their driver-level refusal
    at 971 is in `test/canary-acceptance.test.mjs`;
  - no workflow or acceptance script tells the owner to change their
    balance, and the probe batch is marked as acceptance.
- `test/canary-build.test.mjs` (+1): the rehearsal at 971 through
  `runBuildCheck`: flags and image switch read, every unmet item listed (the
  cap; the cap, slug, photographs and modes together), an unreadable runtime
  giving `null` flags, and the strict paid refusal.
- `test/prepared-scope.test.mjs` (+2), text and data: needs then a failing
  widened call notes `needs` (outcome `send`, no usage, nothing written);
  needs then success notes it once; a scoped answer without needs is
  `scope`; a first call that fails notes nothing; unscoped notes nothing.
- `test/parallel-independent.test.mjs` (+2, IND 9 data and IND 10 text),
  through the real driver, queue consumer, job and view: the job's
  replayed scoped answer says `needs` and its widened call throws. **The
  saved job evidence** (`jobs/prepared/<id>.use.json`, v3) **and the request
  view both say `scoped: 1, needs: 1`**, the part fails as a failed call
  does, and nothing it would have changed is changed.

**Verification**:
- **Red check on `23861838`**: the old real canary routed all 6 probes at
  971 (exit 0); the old real Build script at 971 made no runtime read and
  saved no flags; IND 9 and IND 10 and both new unit cases fail (the
  evidence says no `needs`); the Build rehearsal cases fail.
- **Sweep**: 16 of 16 mutants killed, both comment-only controls survived,
  every file restored by checksum. One survivor in the first pass (the probe
  reader accepting any `acceptance` value) was killed by an added case. The
  mutants cover the shared preflight's cap and estimate items, the probe
  branch's refusal and its use of the preflight, the batch flag and its
  validation, the Build's runtime read being gated on the balance (Codex's
  defect), its strict refusal, its listing of every unmet item, its cap and
  estimate items and its flag record, both receipt-time notes, the Worker's
  `needs` counter and the saved `needs`.
- **Related suites**: 1,669 of 1,669 before the last added case; the
  entry-point file 10 of 10. Doc tests 32 of 32.
- **Full suite**: `10434 → 10449`, `10449 / 10449 / 0 / 0` locally on the
  code of `fdc678ca`.
- **Image prediction**: production `8d6dbcea93252fbb` → `f9c4097ed179c5f8`
  (205 inputs). Not built.
- **CI on `72c49a5e`** (code plus records, one push, nothing pushed while
  it ran): unit tests 38129426568 green (5 m 41 s); site build 38129426790
  green (all eight jobs).

**Remaining blockers**:
- **No separate test budget exists, so paid acceptance is blocked.** Every
  paid acceptance press refuses at today's balance. Making a test budget is a
  billing change for another round.
- The evidence write moved into the job handler's `finally` is not exercised
  by a test where the handler itself throws; the tested downstream failure
  is the widened model call.
- Carried: the real router's batching, the model asking for missing context
  and two substantive steps at once are unverified live; real images
  unverified.

## 11. Round 5 — Codex's review of `72c49a5e`: closed, and the last case covered

Codex: 81 focused tests passed, and independent checks confirmed the round-4
fixes. **The three round-4 findings are closed, verified offline**: the
probe batch's paid preflight, the Build rehearsal reporting every
prerequisite, and `needs` evidence kept when the answer arrives.

**The handler-throws case** (round 4's open item) is now covered:
- **IND 11** (`test/parallel-independent.test.mjs`), text, through the real
  driver, queue consumer, job and view. The job's replayed scoped answer
  says `needs`, its widened call answers, and then the handler throws out of
  `handleRequest` itself: the route's reply throws, and so does the
  route-level catch's own reply. (`Response.json` is made to throw twice for
  this case only; no product code is touched.) The job fails as an escaped
  throw does (*edit queue: job failed … the handler threw*). The saved job
  evidence (`jobs/prepared/<id>.use.json`, v3) and the request view still say
  `scoped: 1, needs: 1` for that job. The part is then run again by the
  existing retry, unchanged.
- **Red check**: with the evidence write moved back after the `finally` (the
  placement before round 4), IND 11 fails and IND 9 and 10 still pass.
  Restored by checksum.
- **What did not work, for the record**: storage faults after the widened
  call (failed reads, failed writes, every storage call outside the job's
  own keys) never made the handler throw. The route catches them, and the
  part fails as `compile`, with the evidence intact. A genuine escape needed
  the route's reply and its catch's reply both to fail.

**The instructions are separated from this history**: `docs/acceptance-current.md`
holds what to follow now (image `f9c4097ed179c5f8`, paid acceptance blocked,
the minimal live proposal, the spending decision). §3 to §5 here are marked
historical.

**Commits**: `d4689dd2` (tests and documents), with records after. No product
code changed; the predicted image stays `f9c4097ed179c5f8`.

**Results**: IND 11 passes, and is red against the old placement; full suite
`10451 / 10451 / 0 / 0` locally on `d4689dd2`; doc tests 32 of 32. CI on
`d4689dd2` is recorded in the owner-notes handoff once it completes.
