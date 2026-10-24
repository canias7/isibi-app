# 2026-10-24 — pay only for what landed (branch `standin-refund`, not merged, not deployed)

The owner (2026-10-24): if 20 things are asked and 1 ends up a stand-in or
kept as it was, charge only for what worked. Branch from
`origin/standin-everywhere` (`8cf6beed4`). Nothing spent, no model called,
nothing live written: every model answer and every compile in the tests is a
stub.

## 1. Before

`standin-everywhere` salvages an edit or add-on file by file (`kept`,
`standIn`), and a first build stands in a band or page (`salvaged`,
`salvagedParts`). The writer's charge (the page rung's, the add-on writer's,
the build's page writer and band writers) was still billed in full for the
files that did not land; the tests showed the bill equal to the clean change.

## 2. What changed

- **`builder/change-salvage.mjs`** (pure): `landedBill({ writer, others,
  written, salvaged, perFile })` answers `{ full, landed, refund, hit, of }`.
  The writer's usage is scaled by the share that landed and the bill re-priced
  with its one rounding (`pageCredits(...others, ...writerScaled)`); `refund =
  full − landed`, never negative, never above the bill. The share is **by each
  salvaged file's own usage** when every one has it (`perFile`), otherwise **by
  count** (salvaged files the writer produced ÷ files it produced). Only the
  writer's share moves: routing, design, keep-checks, repairs, translations and
  photographs on the same bill stay. Helpers: `salvageKey`, `partKey`,
  `scaleUsage`.
- **Build** (`builder/publish-pages.mjs` `settle`): on `published`, the stand-in
  pages (`salvaged`) and bands (`salvagedParts`) are taken off **before the one
  pages debit** (`credit_debit` under `build:<id>:pages`), so nothing is taken
  and given back. Per-file usage comes from the band fan-out:
  `generateSiteBands` now returns `fileUsage` (`-parts/<name>.tsx` → that
  writer's own usage, bands then frame then declared parts, only when that
  order provably matches the files). Without it (one-call builds), by count
  over the pages and parts the writer returned. `out.salvageRefund = { credits,
  files }`; `out.cost`/`billed` are the reduced debit. A founder's debit answers
  `exempt` and takes nothing; nothing on this path credits an account.
- **Edit** (`worker.js`, the edit route): `eCharge` records each charge's parts,
  what it took and, under a job, its reserve ref (`<job>#<seq>`). The page rung
  records its writer bill (writer = the page writer's usage; written = the page
  and every component it changed against the stored parts), only when its
  charge took something. **After the one publish went out** with `salvaged`,
  each writer bill's `landedBill` refund, bounded by what that charge took, is
  given back: under a job by `credit_reverse(uid, "<job>#<seq>", "salvage",
  n)` (bounded by that ledger row; a founder's reserve wrote no row and took
  0); synchronously by `credit_back` in its 10-credit chunks (founder-guarded
  in SQL). `merged.cost` is reduced by what really went back, and
  `salvageRefund: { credits, files }` rides the body.
- **Add-on** (`worker.js`, the add-on route): written = the writer's validated
  pages and its fresh parts. After the publish, the writer's share is given
  back, bounded by what that charge took: under a job by the writer's own
  reserve ref (`#1`, or `#4` when `#1` went ahead of a schema apply) through
  `credit_reverse`; synchronously, after the one collect (left exactly as it
  was, so the existing guards on its place hold), through `credit_back` in its
  10-credit chunks. `salvageRefund` on the body; `cost` is the real charge.
- **Reply facts**: `salvageRefundFact` (builder/site-reply.mjs), called by
  `salvageFact` (edit and add-on) and by the build facts (`buildFacts` carries
  `salvageRefund`): "They were not charged for the part that did not land: N
  credits of the writing for it were taken off the bill, and the cost stated
  is what they paid." Said only when something was given back.

## 3. Limits, stated

- `edit_jobs.cost` keeps the reserved total after a job's salvage reversal (the
  ledger rows are right). `edit_refund` refuses a published job, so no double
  refund there; `edit_reconcile`'s refund of `j.cost` on a review row is not
  reached by a job whose publish completed, but the column overstates the
  charge by the reversed amount. A SQL change would be an owner decision.
- A synchronous edit for a founder: `use_credits` answers the founder sentinel
  and `collectCredits` reports the bill as taken (existing behaviour); the
  salvage `credit_back` is a no-op in SQL for a founder, so nothing is minted,
  but the stated refund mirrors the stated (unreal) charge.
- Only the page rung's writer is refunded on the edit path (it is the writer a
  salvaged file comes from); other rungs write no page source.

## 4. Tests

`test/standin-refund.test.mjs`, 6 cases: the arithmetic (by count, by each
file's own usage, nothing salvaged, a salvaged file the writer did not write,
others untouched, everything salvaged bounded); **edit through the real
`POST /api/site/<slug>/edit`**: 1 of 4 written files (home + 3 bands) kept as
it was → the same reserve as the clean change, then a quarter of the writer's
charge back through `credit_back`, `cost` = clean − refund, reply fact; no
salvage → nothing back, cost unchanged; **add-on through the real route**: 1
of 3 new pages standing in → the same collect, then a third of the writer's
share back through `credit_back`, `cost` = clean − refund; no salvage
unchanged; **build through `publishPages`** (the build's
own billing seam): a stand-in band charged nothing of its own fifth (per-file
usage), by count a quarter without per-file usage, no salvage unchanged;
**founder**: an exempt build takes nothing and the reduction sits ahead of the
one debit with no credit call, and the job paths are bounded by the reserve's
own take (source guard); **bands**: the fan-out's `fileUsage` is keyed as
salvage names files, one writer each. Fixtures: `writeUsage` and `backs`
(`credit_back` answered 204 and recorded) on the add-on route stub.

Existing guards kept green by placement, not by re-anchoring: the add-on's
reserve and synchronous collect lines are unchanged; the edit funnel's ok line
is shorter (`eTook`), so its 1,400-byte window still reaches the refusal; the
edit refund sits above the picture readers' window and the stated cost is
reduced after the `merged` literal; the build's `const c = pageCredits(...)`
line is unchanged and the debit takes `owed`.

## 5. Readings

- **Red check** against `origin/standin-everywhere` (new `change-salvage.mjs`
  and an unwired `salvageRefundFact` copied in so the file loads): 5 of 6 fail
  (edit, add-on, build, founder guard, bands); the pure case passes on both.
- **Sweep**: 22 of 23 mutants killed; the comment-only control survived. The
  survivor counts the writer's usage again in `others` on the edit bill: the
  pricing is linear, so the refund is the same up to rounding (near-equivalent).
  An earlier run had two more survivors (the band `fileUsage` key, unexercised
  until the bands case; a mutant written so it changed nothing), both closed.
- **Full suite** (from the worktree, world-readable, `node_modules` linked):
  `12484 / 12479 / 2 / 3`. The two failures are environmental:
  `no-generated-deps` (the linked `node_modules`) and
  `canary-reopen-browser`'s REOPEN 1 (a browser case; it fails the same way on
  `origin/standin-everywhere` here, and reads only `public/` and `scripts/`,
  which this branch does not touch). A first run had 8 more, all source guards
  on lines this change had moved; the code was re-placed rather than the
  guards re-anchored (above).
- **Image prediction**: `origin/main` (`692087cde`) site `0bae00a7003bcc23`
  (231 inputs, 199 paths), app `65022ce71e3d7274`; `origin/standin-everywhere`
  site `978436c8eafa4b7b` (232 inputs); this head: see below.
