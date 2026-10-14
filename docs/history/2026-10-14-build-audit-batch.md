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
