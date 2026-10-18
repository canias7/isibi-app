# Audit batch 2 (2026-10-18)

Audit fixes 11–20 from `docs/audits/2026-10-17-builder-audit.md`, one commit each, on `codex-work-into-claude`. Offline; nothing spent.

## Step 1 — held schema and jobs combine by name (A06-3, A04-1 core)

- **Finding.** `specOverlay` and `publishPlan` kept only the latest held schema op and the latest jobs op. A rewrite holding `{tables:[]}` hid the live `loaves` from later edits and dropped a held `gallery` from Publish (A06-3); a second add-on's spec, which carries only tables, dropped the first add-on's `daily_summary`, and a second jobs op dropped job `daily` (A04-1).
- **Fix** (`site-draft.mjs`). New `mergeSpec(base, next)`: tables, functions, apis and jobs by lower-cased name, the later entry winning, other keys from `next`. New `combineHeld(liveSpec, ops, { upTo, setAside })`: spec and jobs merged in order, set-aside keys skipped. `specOverlay` is `combineHeld(...).spec`; `publishPlan` merges `plan.spec` and `plan.jobs` by name (null when no such op, as before). The writers (the add-on's carried overlay, the jobs hold, the revise Build) and `worker.js`'s `withStoredSpec` are later steps.
- **Red check.** The two new cases (`test/site-draft.test.mjs`) fail on the old bodies with the new exports present (9 pass, 2 fail); the control passes on both.
- **Sweep.** `scripts/mutants/audit-batch-2-1.json`: 9 of 9 killed, the comment-only control survived. (A first M9, an empty-object base for the plan's spec, was equivalent and was replaced by `upTo` ignored, with a case added.)
- **Suite.** `11459 / 11457 / 0 / 2` locally.

## Step 2 (2026-10-18): starter rows have refs (A28-3)

- **Finding**: a held starter row (seed) showed the model a negative id with
  no ref; a held update or removal of it was kept by that id, and Publish ran
  `UPDATE/DELETE ... WHERE id = -2`, matching nothing, and reported success.
- **Fix** (`site-draft.mjs`): each starter row is `seed:<table>:<n>:<place>`
  in `rowsOverlay`'s `tempRefs`; `publishPlan` copies the seeds and folds a
  held update into its starter row, drops a removed one; a negative id with
  no ref, an unknown starter ref, or a change to a starter row already
  removed answers `{ ok: false, error: STARTER_MISSING }` there and in
  `combineHeld`. The finish's `RETURNING id` backstop is a later step.
- **Red check**: the two new cases fail on step 1's code (11 pass, 2 fail).
- **Sweep**: `scripts/mutants/audit-batch-2-2.json`, 12 of 12 killed, the
  control survived.
- **Suite**: `11461 / 11459 / 0 / 2` locally.

## Step 3 (2026-10-18): the add-on carries the whole overlay; jobs union (A04-1, the writer)

- **Finding.** Under a draft, a second add-on's held schema op carried only its own functions, apis and jobs, and its held jobs op only its own jobs; the first add-on's held function and job reached Publish only because step 1's plan merges by name.
- **Fix.** `mergeAddonSchema` (`builder/site-addon.mjs`) takes a prior spec as well as a table list and unions `functions`, `apis` and `jobs` by lower-cased name, this message's entry winning; `declared` still names only what this message designed. The add-on route (`worker.js`) hands it the overlay when it read a draft (`aDraftView ? aSpec : aSpec.tables`), and the table list otherwise, so the live path is unchanged (a stored function has no body to re-send). The held jobs op is the overlay's jobs merged with this add-on's, through the same `merged.jobs`.
- **Tests.** `test/site-addon.test.mjs` AB2-3 (the union, the table-list path unchanged, a control) and the route's call; two spelling guards re-anchored to the new call (`site-addon.test.mjs` "THE ROUTE HANDS OVER THE WHOLE DESIGNED SPEC", `site-add.test.mjs`'s order guard), their expectation superseded. Shown at module and source level; not driven through the add-on route under a draft (the harness has no draft store).
- **Red check.** Both AB2-3 cases fail on the code before the change.
- **Sweep.** `scripts/mutants/audit-batch-2-3.json`: 7 of 7 killed, the comment-only control survived.
- **Full suite.** `11463 / 11461 / 0 / 2`.
