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

## Step 4 (2026-10-18): the revise Build holds the merged spec, or nothing (A06-3 writer)

- **Finding**: a revise of a published site under draft-first held whatever spec its designer returned, `{tables:[]}` when it declared none, so the held op named fewer tables than the draft had.
- **Fix**: `reviseHeldSpec(overlay, spec)` in `site-draft.mjs` (`mergeSpec(overlay, spec)`, `null` when no table, function or api is declared, the spec as given when no overlay is readable); the revise in `worker.js` reads the live schema plus the held ops when holding and applies nothing when the answer is `null`.
- **Red check**: AB4 in `test/site-draft.test.mjs` fails with the product files stashed (1 of 1 fails).
- **Sweep**: `scripts/mutants/audit-batch-2-4.json`, 7 of 7 killed, the control survived.
- **Suite**: `11464 / 11462 / 0 / 2`. Two spelling guards updated (`test/frontend-build.test.mjs`, `test/site-access-revise.test.mjs`): the apply is now `applySiteSchema(db, schemaSpec)`, and the guard checks it starts from the guarded `spec`.

## Step 5 — the schema read: unreadable is never empty (A09-4, A09-7), 2026-10-18

- **Finding**: `applySiteSchema` read `_meta.schema` through `loadSiteSchema`, which answers `{tables: []}` for a read that threw; a cold compute therefore looked like an empty store, the merge was skipped and the `_meta` write replaced the stored tables, functions, connections and jobs with the run's partial list (A09-4). At Publish, `newTablesOf` did the same with `.catch(() => null)`, so every held table counted as new and the start phase applied the whole held spec, held rules included, to the live database (A09-7).
- **Fix**: `applySiteSchema` reads with `readSiteSchema` first, before any DDL (the identity functions and grants included), retries once, and throws `meta-unreadable` (`transient: true`) before anything is written. `readSiteSchema` reads a missing `_meta` table (42P01, or Postgres's own words) as `no-meta`, an empty store, so a brand-new database's first apply still runs. `newTablesOf` does the same read and retry; the start phase answers 503 "your database didn't answer — nothing was changed on your live site; press Publish again" and keeps the journal at `start` (not retired).
- **Red check**: with `site-schema.mjs` and `worker.js` stashed, 3 of the 4 new cases fail: the apply resolved and wrote `{tables:[gallery]}`, the retry control saw 1 read, and DFA7's Publish answered 200 over an unreadable read. The brand-new-database control passes on both.
- **Sweep**: `scripts/mutants/audit-batch-2-5.json`, 7 of 7 killed, the control survived.
- **Suite**: `11469 / 11467 / 0 / 2`. One spelling guard updated (`test/schema-parse.test.mjs`): it counted `await loadSiteSchema(uuid)` once, and the apply now reads `readSiteSchema` with one retry.
