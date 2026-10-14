# The image-free Build parallelism audit: one consolidated batch, prepared (2026-10-14)

The owner, after run 152 closed the Edit/Add-on clarify-and-resume gap:
*"prepare the next image-free Build parallelism audit as one consolidated
batch, keeping the existing page/component limits. Keep reporting fixes
unmerged, paid opt-ins closed, and do not deploy, rebuild, buy images or start
another paid test."*

**Prepared, not pressed. Nothing was spent, deployed or built.** Production
stays `fef80b9b`, image `4444d9d53d906b8d`, balance 783.

## 1. What the audit must show live

A first Build, with no photograph bought, that does independent work at the
same time, judged from the build's own recorded times:
- **Overlap.** Either at least two page bands were written inside one wave,
  or the design's agents ran at once (`buildOverlapVerdict`, with
  photographs excluded). Photographs may not supply the overlap: this build
  buys none.
- **Order.** Nothing started before what it needs (`buildOrderVerdict`).
- **Progress.** The live lines were model-written and kept with the job
  (`buildProgressVerdict`).
- **Closure.** The build was followed from a fresh sign-in after the sender
  let go (`buildClosureVerdict`).
- **Shape.** One page, at most 15 kit components (`buildShapeVerdict`).
- **No image.** None stored, none placed (`buildNoImageVerdict`).
- **Money.** One build, charged by its own refs, nothing later
  (`buildMoneyVerdict`).

## 2. The existing limits, kept

Unchanged:
- `MAX_PAGES` is 1 in the plan (the page writer keeps its own 6, so a revise
  never deletes pages);
- `MAX_COMPONENTS` is 15;
- the image switch is the existing `IMAGE_PURCHASES`.

No flag is switched on to manufacture a pass. If no image-free parallel mode
is already on for the account (`design`, `graph` or `bandsEveryone`, read off
`/api/site/runtime`), the build stays unrun and the reason is recorded.

## 3. What is already shown offline

All with supplied model answers through the real routes:
- the Build parallel orchestration and its order (`test/build-parallel.test.mjs`,
  T2);
- readiness-driven designer starts (AI1, `test/design-waves.test.mjs`);
- the page bands (`test/band-build.test.mjs`);
- the batch-7/8/9 Build corrections and the first-Build audit
  (`test/build-audit-batch.test.mjs`);
- the press's verdicts, positive and negative (`test/canary-build.test.mjs`,
  "NO PHOTOGRAPH" cases);
- the entry points (`test/acceptance-entry-points.test.mjs`).

The press, `check-no-images` on `saltmarsh-cheese-counter` (a fresh slug,
verified free before the call), has never been pressed. The 2026-10-11 batch
held it as stage 2, row 6, and it was blocked: there was no way to run it
above the 100-credit cap.

## 4. Prepared this round (scripts and tests only)

1. **The Build press's balance opt-in, closed** (`BUILD_BALANCE_OPT_IN = []`,
   `readBuildOptIn` in `scripts/canary-build.mjs`; the *build as owner*
   form's new box *"CLOSED: …"*, `accept_balance` → `OWNER_ACCEPT_BALANCE`).
   - It mirrors the UI presses' box: the owner names one mode, by commit, for
     one run.
   - The box then lets that mode run only while the balance is **exactly**
     the number typed. The hard cap is replaced, never removed.
   - Read before the sign-in: malformed, closed or for another mode, it
     refuses with exit 2 and reads nothing.
   - Tests: BUILD OPT-IN 1–3. Sweep: its four mutants killed.
2. **The estimate by every valid route.** `check-no-images` is now **about
   11–45** (budget 45, was 40):
   - first builds measured 11–45 (runs 21–37);
   - a build can take its corrective design call, a page repair or a salvage,
     each a valid route;
   - so the estimate keeps the measured top rather than subtracting the
     photographs it cannot buy.

   A build that takes more fails its own check; only the balance bounds it.

## 5. The batch, in order (each step the owner's)

| # | Step | Cost |
|---|---|---|
| 1 | The owner's approval of this one run, at about 11–45 credits | — |
| 2 | A commit names `check-no-images` in `BUILD_BALANCE_OPT_IN` (the form says so) | — |
| 3 | `IMAGE_PURCHASES` **off**, then *Deploy to Cloudflare* on `main` (no code change; the image is reused) | free |
| 4 | **Free rehearsal:** *build as owner*, mode `check-no-images`, spend `no`, balance box blank. It reads the image switch, the account's flags, the slug and the balance, and lists every unmet prerequisite. The balance's cap shows unmet with the box blank; that is expected. **If no parallel mode is on, stop here:** nothing is switched on, and the batch is recorded as blocked by the account's flags | free |
| 5 | **The paid press:** the same, spend `yes`, the balance box = the exact balance then | about 11–45 |
| 6 | `IMAGE_PURCHASES` **on**, redeploy `main`, then the free edit-canary check reading `imagePurchases=true` | free |
| 7 | The opt-in is closed again; the record and handoff are written | — |

**Not exercised, never retried:** a build whose overlap came only from
something other than bands or design agents, or a build that never overlapped
because the account's mode was off. That is recorded as the build's behaviour
or the account's state, never as a pass.

## 6. Open before step 4

- **Whether an image-free parallel mode is on for the account is not
  known.** The deploy log shows `BAND_SPLIT_EVERYONE`,
  `DESIGN_SPLIT_EVERYONE` and `DESIGN_GRAPH_EVERYONE` as `off`. The
  canary-scoped values are masked, and only the runtime read (step 4) says
  what the account gets.
- **Image purchases off stops photographs for every customer** while it is
  off (the existing switch), as for runs 144, 150 and 152.

## 7. Step 4's first press: run 114 never read anything (2026-10-14)

The owner pressed the free rehearsal as asked (*build as owner*, mode
`check-no-images`, spend `no`, balance box blank). **It died before the
sign-in**: `ERR_MODULE_NOT_FOUND 'typescript'`. Nothing was read, spent or
changed.

- **Cause, a workflow defect, not the build.** `build-check.mjs` imports
  `canary-requests.mjs`, which gained the `typescript` parser on 2026-10-12
  (6dae03bc). The *build as owner* workflow had no install step, so the Build
  check has been unrunnable since then. The last successful run of that
  workflow was 2026-10-10.
- **Fix, on the branch only** (a workflow change; `main` and the deploy are
  untouched): an `npm ci` step before the script runs, and a guard in
  `test/build-as-owner.test.mjs`. The guard walks the script's import
  closure: static imports, plus dynamic imports of local files, which is how
  build-as-owner reaches build-check. A lazy dynamic import of a package
  inside a function is not counted (canary-ui's `playwright`, which falls
  back to `playwright-core`). It requires `build-check.mjs` and `typescript`
  to be reached, every package to be declared, and the install to come
  before the run. Red check: on the workflow without the step it fails
  (`not ok 11`), and with it it passes (11 of 11).
- **Read free beforehand from the database:** `saltmarsh-cheese-counter` is
  free (no backend row, no build row, the host answers 404); the balance is
  783, the last ledger row 466, and no job is open. The flags and the image
  switch are read only by the rehearsal, from `/api/site/runtime`.

**Next:** the owner presses the same rehearsal again from
`claude/help-needed-ehlwlj`. Then record `design`, `graph`, `bands`,
`bandsEveryone` and `imagePurchases` as read.
- If an image-free mode (`design` or `graph`) is on, record it and what the
  paid press could show.
- If none is on, prepare the account-scoped change for review: the account's
  uid in the `DESIGN_SPLIT_CANARY` or `DESIGN_GRAPH_CANARY` secret. The
  deploy fallbacks suggest `design` may already be on, but that is not
  confirmed.

The prerequisites the rehearsal lists as unmet are expected and are not
failures: image purchases on, and the 100-credit cap below a balance of 783.
**The 11–45 figure is an estimate, not a limit.** Nothing enforces it; only
the balance bounds the spend.

**CI vs local.** GitHub's unit run on `fb5f01f3` is green: 10,784 passed, 44
skipped, 0 failed. The earlier local failure (REOPEN 1, a timing test) was
this machine's only. It did not reproduce on CI, and it is not a code
failure.

## 8. Step 4 done: run 115, the free rehearsal (2026-10-14 11:34 UTC)

The owner pressed it again from `claude/help-needed-ehlwlj` at `0d92f16e`.
Mode `check-no-images`, spend `no`, the balance box blank. The install step
ran (`npm ci`, 18 packages). The script signed in and read everything; the
run is green. **Nothing was sent:** `sent: false`, no routing or build
calls, nothing charged. Read from artifact 11889739463, `build-check.json`:

| What | Read |
|---|---|
| The sender | uid `22175f41…` (the building account) |
| The slug `saltmarsh-cheese-counter` | free: backends 200 with no rows, builds 200 with no rows, host 404 |
| The balance | 783 |
| The image switch | `imagePurchases: true` (photographs are still bought) |
| `design` (design agents at once) | **true** |
| `graph` (the design as a graph) | **true** |
| `bands` (through a canary list) | true |
| `bandsEveryone` | false |
| Modes counted | "design agents at once", "the design as a graph" |

**Two prerequisites are unmet, both expected:**
- the balance, 783, is above the press's hard cap of 100 (the balance box
  was blank);
- the live Worker still buys photographs (`IMAGE_PURCHASES` is on).

Neither is a defect, and neither stops this free reading. Every other
prerequisite is met: the balance was read, it covers the estimate, the slug
is free, and an image-free parallel mode is on.

**What this means for the paid press (step 5).** An image-free parallel
mode is already on for the account: the design split and the design graph.
So nothing needs switching on, and no account-scoped change is prepared.
The press can show overlap through the design's agents: at least two design
agents whose calls together took longer than the wave
(`buildOverlapVerdict`, by `design`). With `bands` true through a canary
list, the build can also show page bands written in one wave, if the build
writes two or more bands. That is a possible second form, not something the
flags guarantee. Photographs cannot supply the overlap: the press passes
`photos: false`, and image purchases will be off.

**What it cannot show.** A build whose design runs as one call, or whose
agents finish one after another, shows no overlap. That is recorded as the
build's behaviour, not a pass, and it is not retried. Bands for everyone
stay off; the press measures this account only.

**A reporting defect, noted, not fixed here** (backlog). A met
prerequisite in `build-check.json` keeps the sentence written for its unmet
case. "The balance covers the estimate of 45" reads `ok: true` with "the
balance, 783, does not cover this press's budget of 45". The console line
and the verdict read `ok` correctly. Only the JSON's `why` is wrong for a
met item (`buildPrerequisites`, `scripts/canary-build.mjs` ~527–531).

**The estimate is not a limit.** About 11–45 credits is what first builds
measured (runs 21–37), across every valid route. Nothing in the product
stops a build at 45. The press's hard cap compares the balance before
sending, and the balance box pins the run to the exact balance then. Once
sent, only the balance bounds the spend.

**The next step is the owner's.** Steps 1–3 of §5:
1. approve one paid run at about 11–45 credits;
2. a commit naming `check-no-images` in `BUILD_BALANCE_OPT_IN`;
3. `IMAGE_PURCHASES` off, then *Deploy to Cloudflare* on `main`. No code
   change: `main` stays `fef80b9b` and the image `4444d9d53d906b8d` is
   reused.

After that, a free rehearsal must read `imagePurchases=false` before the
paid press (spend `yes`, the balance box set to the exact balance). The
switch is turned back on afterwards (step 6). None of this has been done.

## 9. The paid press: run 117, and the steps around it (2026-10-14)

The owner: *"I approve one check-no-images Build test at the estimated 11–45
credits, understanding that this is an estimate rather than an enforced cap.
Open the opt-in for this scenario only."*

### The steps, as run

| Step | Run | Reading |
|---|---|---|
| Opt-in opened for `check-no-images` alone | `4586c678` | the form box named it; every other mode still refused |
| `IMAGE_PURCHASES` off, *Deploy to Cloudflare* on `main` | deploy 2207 (12:08–12:09 UTC) | green on `fef80b9b`; container `4444d9d53d906b8d`, "no changes" (not rebuilt) |
| Free preflight | run 116 (12:09 UTC) | the live Worker buys no photograph; slug free; balance 783; design and graph on; only the cap unmet (box blank). It started 36 s after the deploy, but its reads came after the new version uploaded (12:09:15) and read `imagePurchases=false` |
| Ledger before | (12:12) | balance 783, last row 466, no edit job open |
| **The paid press** | **run 117** (12:21:04–12:27:15 UTC), spend `yes`, balance box 783 | every prerequisite met; sent once |
| Opt-in closed | `5056b7a8` | `BUILD_BALANCE_OPT_IN = []`, the box says CLOSED |
| `IMAGE_PURCHASES` on, redeploy `main` | deploy 2208 (13:08–13:09 UTC) | green on `fef80b9b`; container "no changes" |
| Free check of the restored state | run 118 (13:10 UTC) | "the live Worker still buys photographs": purchases are on again; balance 773 |

### What the build did (its own record, `site_builds` for `saltmarsh-cheese-counter`)

The row reads **done, ok, page `app`**, finished at 12:29:11 UTC. Total
459,330 ms from the request. Its steps, in order:

| Step | ms | Notes |
|---|---|---|
| auth, body, gate | 188, 1, 877 | |
| design-recovery | 129,004 | `attempts: 0`: the design came back usable first time; this mark carries the design call's time |
| design | 0 | `in 17751`, `out 821`, **no `graph`, no `waves`, no `agents`**: one call |
| owner, normalize | 897, 2 | |
| provision, schema, seed | 180, 447, 0 | `db 0`, `tables 0`: the frontend-only first build |
| merge, gen | 315, 580 | |
| **bands:sync** | 2 | the page written as one band, not bands at once |
| fonts | 203,927 | `beside 1`: the page generation ran beside it in the container |
| img | 3 | `viaContainer 1`; no photograph (switch off) |
| compile, container, og | 97, 105,601, 283 | |
| pages | 16,926 | `genMs 203543`, `tscMs 17295`, `viteMs 48708`, `renderMs 31261`, `publishMs 11995`, `credits 4` |

**Published:** https://saltmarsh-cheese-counter.gofarther.app answers 200,
title "Saltmarsh". It serves one route, `/`, with headings "Cheese boards,
made up two days ahead", "How to order a board", "Tuesday to Saturday, nine
till four", "Order a board". It has no `<img>`.

**Charges, each once, on one build ref `b6360027…`:**
- ledger row 467: deposit −2 (12:21:33);
- ledger row 468: settle −4 (12:23:43);
- ledger row 469: pages −4 (12:29:11).

That is **10 credits, 783 → 773**, within the 11–45 estimate. No later row
(read at 13:11: last row 469, balance 773, no job open).

### What the press concluded, and why most of it is the press's misreading

The press posted the build and waited on the same request. That connection
ended at about 285 s (12:26:08, status 0, no job), the Cloudflare reset
recorded in the route's own comment. The build went on under `waitUntil` and
finished three minutes later. The press then read the source and the record
**before the build ended**, so its "pages: []", "0 components", "done false",
"the pages never came back" and the money check ("no job to attribute
charges to") describe a build still running. They are not the build's
result.

### The verdict, item by item, from the evidence

| Item | Result |
|---|---|
| **Overlap (design agents or page bands)** | **Not exercised.** The design ran as one call (no `graph` or `waves` mark, which the route writes only when it takes a parallel path), and the page was one band (`bands:sync`). The account's flags read `design` and `graph` true; enabled flags are not overlap. |
| Dependency order | Met on the build's own trace: design → (no database) → generation → compile → container → publish |
| Published result | Met: the site is live, one route, no photograph |
| One page, ≤15 components | One route served; **component count not verified** (the press read the source before the end; an owner read is needed to read it now) |
| Progress lines | **Not exercised**: none served; the press had no job to read them from |
| Fresh-session recovery | **Not exercised**: no job was handed back, so the fresh session had nothing to follow |
| No image | Met: none bought, none placed |
| Charges | Met by the ledger: 10 credits on one build ref, each row once, nothing after |

Not retried, as instructed.

### The wider finding: no first build has used the parallel design since 2026-09-13

`site_builds`, the last twelve builds:
- `repairbench-1` (09-13), `hebden-bike-repair` (09-12),
  `saltmarsh-kayak-co(-2)` (09-11), `ben-crowe-guitar` and `sowerby-forge`
  (09-11) ran the design **graph, 16 agents**; repairbench-1 and hebden also
  wrote **8 bands at once**;
- `the-hot-plate` (10-04) and `saltmarsh-cheese-counter` (10-14, run 117)
  ran **one design call and `bands:sync`**.

In the route, `useGraph` needs `splitGraph(...)` to return agents **and**
`designGraphFor(env, { uid })`. The runtime route reports `graph: true`
from the same function on the same uid. The design-graph census still passes
offline (`test/design-graph.test.mjs`, 31 of 31: the frontend tool splits
into the 16 agents). So the live build takes neither parallel door, and the
cause is **not established**. No test drives the real build route with the
graph flag on and asserts which designer ran. Candidates to check, free and
offline:
- whether `firstBuild` or `editState` reaches the split as a revise on this
  path;
- whether the page plan's one page (`MAX_PAGES` 1) is what turns bands into
  `sync`. A one-page plan may never have more than one band, so page-band
  overlap may be impossible by design under the kept limits.

### What it means

The image-free Build audit is **blocked by the build path itself, not by the
account's flags**. Another paid press would show the same single call until
the cause is found. **Next (free):** a reproduction through the real
`/api/site/react-build` route with supplied model answers and the graph flag
on, asserting which designer runs and how many bands a one-page plan
produces. Separately, the press should follow a build by its slug's record
when the request answers nothing (backlog).
