# 2026-10-23 — The compile repair on every path that writes code (`compile-repair-all`, not merged, not deployed)

Branched from `origin/combine-1023b` (`c28f63e86`). Owner's brief, widened the
same evening: every path that writes code and compiles/publishes gets the
compile-failure repair the add-on had (`docs/history/2026-10-23-fix-addon-preview.md`),
ideally once at the shared seam, up to two rounds, charged only when it fixed
the build. Nothing spent, no model called, no live writes.

## The two compile entry points

Every path that compiles code reaches the container through one of two
functions (guarded: `test/compile-repair-all.test.mjs` GUARD):

1. **`recompileAndPublish`** (and `publishBeside`, which calls back into it;
   `publishSpine` is an alias). Callers: the edit route's one publish (every
   rung: text, look door and its quick writers, tweak, page, picture, logo,
   nav, frame edit `runFrameEdit`), the add-on, the rebuild at 35281, the
   restore/"Back online" paths, the publish closure at 11632.
2. **`publishPages`**: first builds, band path and single-call fallback alike,
   and revises of the same site.

## 1. The seam (`worker.js`)

- `recompileAndPublish` takes `touched` and `chargeRepair`. When a caller
  brings no `onCompileFail`, it uses **`seamCompileRepair`**: on a compile that
  failed on the CODE (not killed, not timed out, not out of room: the add-on's
  existing distinction, unchanged) it runs `compileRepairRounds`
  (`builder/compile-repair.mjs`): up to **2 rounds**, each fed the latest
  compiler error (cut to 4,000 characters), at most 3 pages a round, only
  pages in `touched` (absent: any page the error names), the job's clock
  (`canRepair`) asked before each round, then one recompile per round.
- **Charged only when it fixed the build**, through `chargeRepair`, else the
  caller's `charge` funnel; a caller with neither gets it free.
- Trace marks `compile-repair:seam` start / ok / fail / skip, with rounds,
  pages repaired, why, credits.
- The publish answer carries `compileRepaired: { pages, rounds, charged }`
  only when it fixed the build.
- **Edit route**: `pendingPublish` passes `touched: writtenPaths(eSrcAt0, eSrc)`
  (the pages this message changed or added) and
  `chargeRepair: (usage) => eCharge(...usage)` (the edit's own bill: a
  sequenced reserve under a job, the collect synchronously). The merged reply's
  `cost` adds `compileRepaired.charged`, and carries `compileRepaired`.
- **Add-on**: keeps its own hook, now `compileRepairRounds` (two rounds, the
  clock asked before each), reserve #6 as before; its reply carries
  `compileRepaired`.

## 2. First builds (`builder/publish-pages.mjs`)

- The build's repair (ideas #11–#13, `compileRepairPages`) was behind
  `BUILD_REPAIR`, off. **`buildRepairOn` is now on by default**; `0`, `false`,
  `off`, `no` turn it off.
- **Up to 2 rounds** (`MAX_COMPILE_ROUNDS`) before salvage, each on the
  previous round's corrected pages and the previous compile's own error, each
  only while that error is still a code failure (`salvageable`: no killed
  step, no unreachable service, no room failure), each after asking the
  build's clock (`deps.compileRepairRoom`: the build budget has
  `BUILD_REPAIR_NEED_MS` = 120 s left; a container build's clock is infinite).
- **Billing**: the build bills one `pageCredits` call over `repairUsage`
  (settled by `build_debit`'s pages ref). The rounds' usage now joins
  `repairUsage` **only when a recompile came back ok**, so the repair folds
  into the existing pages charge, one rounding, and a failed repair costs
  nothing. No new ledger ref.
- Still failing: salvage stubs the ORIGINAL page, exactly as before.
- No room for the first round: `compileRepairSkipped: "time"`, salvage as before.
- `buildFacts` carries `compileRepaired: { pages, rounds }` from
  `compileRepair.fixed` only.

## Reply facts (`builder/site-reply.mjs`)

`compileRepairFact`: one `note` — "The first version of “menu” did not
compile; it was corrected automatically (on a second try), and the corrected
version is what was saved." — on edits, add-ons and builds, only from the
pages a round really fixed. The words the customer reads are the reply
writer's.

## Limits

- A component (`-parts/<name>.tsx`) the error names is not offered to the
  repair: on a build it is still stubbed by salvage (`partStub`); on an edit the
  seam's recompile sends the pages only. Pages on own-parts sites are repaired
  as kit sites' are.
- A caller with no charge funnel (the restore paths) repairs free.
- A round whose answer is the page unchanged is refused by the tweak reader, so
  the second round can end without a compile (seen in
  `addon-compile-repair`'s still-failing case).

## Tests

- New `test/compile-repair-all.test.mjs` (7): the edit page rung through the
  real `POST /api/site/<slug>/edit` (repaired once and charged; a second round
  fed the second error; still failing after two rounds → today's refusal,
  uncharged; a killed container → no round), the module's rounds and clock,
  the GUARD over every publish entry point, and the reply facts.
- `test/build-repair.test.mjs`: NEVER WORSE rewritten (two rounds, uncharged),
  ROUND TWO and THE CLOCK added, the switch test reversed (on by default).
- Updated where behaviour changed: `addon-compile-repair` (round two asked),
  `tweak-fallback` (the seam's repair asks the tweak tool after the rewrite).
- Red on the old code: with the product files put back to `c28f63e86`
  (compile-repair.mjs kept new so the file imports), 5 of 7 new cases fail
  (the killed-container case and the module case are controls) and the 4
  new/rewritten build cases fail.
- Mutation sweep over the four focused files: **16 of 16 killed**, the
  comment-only control survived (one mutant, round two fed the old error,
  survived first and was killed after a module case was added).
- Full suite (`node --test "test/*.test.mjs"`): **12412 / 12407 / 2 / 3** (tests / pass / fail / skipped). The two failures are the known env-only ones: `media-verify` browser mode and the node_modules symlink case. A first run before three guards were re-anchored read `12412 / 12403 / 6 / 3` (the same two, `canary-reopen-browser` REOPEN 1 timing, and `edit-reserve-refused`, `progress-more`, `wiring` anchors on the edit funnel line and the build deps order, fixed by keeping `pendingPublish`'s line whole, moving `compileRepairRoom` below `note`, and letting `wiring`'s cost guard accept the repair's addition).
- Sweep re-run after those moves: 15 of 15 killed, control survived.
