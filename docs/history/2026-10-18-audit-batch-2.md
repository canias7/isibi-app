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

## Step 6: held row changes are tried when they are held (A09-3, A09-2 part a)

- **The finding.** Under draft-first, the data step and the add-on's entry step held a row change without asking the database. A price of "£4.20" in a number column, or a name already on a unique list, was held and billed. It then failed only at Publish.
- **The fix.** `sqlRehearse` (`site-db.mjs`) runs the statement the live path would send, then forces a rollback.
  - It runs as `WITH rehearsed AS (…) SELECT 1 / (count − count)`, so the closing division always fails after the write, and Postgres keeps nothing.
  - The data step rehearses an update or insert on a table it read live. A refusal of class 22 or 23 is not held, and the reply says why ("That change couldn't be saved: … Nothing was changed.").
  - The add-on's entry step rehearses each entry before anything is reserved or marked. A refusal answers 422 `row-refused`, with cost 0.
  - A missing table (a held new list), or a database that does not answer, still holds the change as before.
  - Known limits:
    - an identity column advances on a rehearsed insert, so the ids get a gap but no row is stored;
    - two held new rows that clash with each other are not caught here; Publish's own check (step 7) covers that;
    - the data step bills before its writes, on the live path as well, so a refused data change carries the step's usual charge, as a refused live write does.
- **Tests.**
  - DFH1 (`test/draft-first.test.mjs`): "£4.20" and a duplicate "Dark Rye" are refused with their reasons; the draft and the live rows are untouched; a good change is still held.
  - DFH2 (`test/addon-row.test.mjs`, sync and queued): a duplicate entry is refused with no reserve or mark; a new name is not refused; an entry for a table that is not live yet is not refused.
  - The stand-in database learnt rehearsals and `dropTable`.
  - Red on the old worker: 3 of 3 fail.
- **Sweep and suite.** Sweep `audit-batch-2-6.json`: 8 of 8 killed, control survived (H4's anchor was fixed; the not-live case was added after H5 first survived). Full suite `11472 / 11470 / 0 / 2`.

## Step 7: Publish never drops held new rows on a clash (A09-2)

- **The finding.** A held new row clashed with a value added on the live site after it was held, for example a second "Spelt" on a unique list. Publish's insert answered 23505. That was taken for "this publication already ran": the step was marked done, every held new row was dropped, and Publish answered ok.
- **The fix, in two parts.**
  - **Before the switch, in the start phase:** every held change and new row is rehearsed with `sqlRehearse`. A class 22 or 23 refusal stops Publish through `before()`. The journal is retired, nothing is live, and the reason is named ("a held change can't be saved: an entry with that value is already there — nothing changed on your live site").
  - **After the switch:** a 23505 counts as a repeat only when this publication's own `_meta` key is there. Otherwise the step stops (`keep`), unmarked. Step 8 gives such a stop its end state.
- **Tests.**
  - DFH3: Spelt held, a live Spelt added, then Publish. It is refused before the switch; the live version, rows and record are unchanged; once the live one is renamed, the same revision publishes.
  - DFH4: rehearsals unanswered, so the clash meets the insert itself. The publication is not finished, the inserts are not marked done, the record is not marked, and there is still one Spelt.
  - Both were red on the old code (Publish answered ok).
- **Sweep and suite.** Sweep `audit-batch-2-7.json`: 5 of 5 killed, control survived. P4 first survived because deleting the line crashed instead of treating the clash as a repeat, so the mutant was rewritten as the old behaviour exactly. Full suite `11474 / 11472 / 0 / 2`.

## Step 8: no endless retries — temporary stops back off, permanent ones are blocked (A06-4, A09-3 part b)

- **The finding.** Every stop after the switch was kept and retried by the two-minute sweep forever. A held value Postgres refuses never finishes, and every later Publish ran it first (`finishFirst`) and stopped on it again, so Publish was wedged for good. The sweep also counted such sites against its ten turns, so ten stuck sites starved the rest.
- **The fix.**
  - `site-draft.mjs`:
    - `publishStopKind` treats Postgres classes 22 and 23, 42P01 and 42703 as permanent, and everything else as temporary;
    - `publishNextTry` pauses 2, 4, 8, 16 minutes, then 30 at most;
    - `PUBLISH_MAX_ATTEMPTS` is 8;
    - `journalBlocked`;
    - `clickPlan` answers `blocked` for another revision's click.
  - `runPublication`'s `keep` takes the error:
    - a permanent stop, or the eighth try, is stored with `blocked: { stage, why, at }` and answers 409 "…can't be finished: <reason> — it won't be retried on its own; set it aside or change it, then press Publish";
    - otherwise it stores `nextTry`.
  - Row refusals name their reason. Step 7's clash is permanent.
  - The sweep skips blocked journals and ones not yet due, and counts only the ones it runs.
  - A click on another revision answers 409 naming the blocked one. The owner's own click on the blocked revision clears the block and tries once more.
  - The route passes `blocked` through.
  - The design's silent `skipped` was not adopted. Skipping a change without the owner's say would lose it, so step 9's set-aside is the owner's choice instead.
- **Tests.**
  - DFH5 covers the clash after the switch:
    - it is blocked with a 409 and its reason;
    - an hour on, the sweep runs nothing;
    - a newer revision's click is told and does not re-run it;
    - a temporary fault at the eighth try is blocked;
    - the owner's click, once the clash is gone, finishes it, and the finished journal carries no block.
  - DFH6: a journal not yet due is not run; with one turn per tick, a blocked site does not keep a stale one behind it.
  - SD-B: the stop kinds, the pause and the click rule.
  - DFP4, DFR8 and DFR10 now move their clock past the pause before trying again. That is the new behaviour, and their assertions are otherwise unchanged.
  - Red on the old code: DFH5 and DFH6 fail.
- **Sweep and suite.** Sweep `audit-batch-2-8.json`: 12 of 12 killed, control survived. B10 and B12 first survived; the attempt cap and the cleared block were then added to DFH5. Full suite `11477 / 11475 / 0 / 2`.

## Step 9: Set aside, and the card that offers it (A06-4 part c)

- **The route.** `POST /api/site/:slug/publish/set-aside {revision}` has its own matcher, `sa`, and its branch sits after Publish's, so DFB8's owner-check guard still holds.
  - It is accepted only for a blocked journal on the revision it names.
  - It takes the journal over on its etag with `setAside: true` and runs the publication on.
- **Under `setAside`:**
  - a held change the database refuses for good is skipped and recorded in `skipped` (stage, table, reason), and the rest carries on;
  - new rows go one at a time, each beside its own `_meta` key, so a repeat still adds each row once;
  - a temporary stop still stops, and nothing is skipped for it;
  - Publish's and set-aside's answers both carry `skipped`, and `publishingNow` carries `blocked` into the draft state.
- **The card.** In `siteDraftPanel` (`public/chat.js`), a blocked publication replaces the ordinary panel. It shows "Publishing stopped" and "1 change could not be published", with the reason and **Set aside** and **Edit** buttons. Edit closes the panel and focuses the chat box (`stRevise`). The toast says how many changes were set aside. New styles `.sp-blocked*` are in `styles.css`.
  - The screenshot is in the session scratchpad, `setaside-card.png`.
- **Known limit.** A later revision that edits a row that was set aside names a row that never went in; its own publication then stops before its switch with that error, and nothing goes live.
- **Tests.**
  - DFH7 starts with Barley, Spelt and Oat held and a live Spelt added, so Publish is blocked:
    - the draft state names the block;
    - a temporary fault during set-aside stops it and skips nothing;
    - pressed again, Barley and Oat go in once each, the Spelt is skipped and named, and the revision is marked published;
    - a newer revision then publishes, and set-aside with nothing blocked is refused.
  - SB1 (`test/draft-blocked-card.test.mjs`, Chromium) runs the panel's own function on the app's stylesheet:
    - the card, both buttons and no ordinary Publish button;
    - Set aside sends `{ revision: 3 }` to the route;
    - Edit focuses the chat box;
    - without a block, there is no card.
  - Both were red on the old code.
- **Sweep and suite.** Sweep `audit-batch-2-9.json`: 10 of 10 killed, control survived. S5 and S6 first survived; DFH7 then gained the three-row order and the temporary fault. Full suite `11479 / 11477 / 0 / 2`.

## Step 10: the publish-turn wait has its own limit (A03-3)

- **The finding.** Parallel parts of one message wait for the site's publish turn. The wait had no limit but the job's 50-minute budget. Every store fault except a 403 was waited as well. The timeout answered `turn`, which is an overlap loss, so the part was re-run up to twice, and its reply blamed "another change".
- **The fix.**
  - `builder/publish-turn.mjs` gains `TURN_WAIT_MS`, twice a turn's 10-minute life, overridable with `PUBLISH_TURN_WAIT_MS`.
  - It also gains `TURN_UNREAD_MAX = 5`: five failed reads in a row end the wait, and a good read starts the count again.
  - `takeTurn` marks `waitedOut` or `unreadable`. `turnStop` turns those marks into `turn-timeout` and `turn-unreadable`. Neither is in `OVERLAP_LOSSES`, so neither is re-run, and each says "nothing was changed".
  - The customer's reply uses the "something went wrong on our side" sentence that `turn-refused` uses, never "another change".
  - The 403 refusal and Stop are unchanged.
  - **Not done here:** a stuck holder releasing its turn (`renewTurn`), and running a request's parts in turn rather than polling. Both are larger and kept in the backlog.
- **Tests (`test/audit-batch-1.test.mjs`).**
  - T1c: a turn held by another job, and a budget that never ends, gives up at the limit as `waitedOut`.
  - T1d: five failed reads end the wait as `unreadable`; a good read in between starts the count again (8 reads).
  - T1e: both codes, their sentences, and that neither is an overlap loss.
  - The tests press Stop once their timer runs out, so a loop that never ends cannot hang the run.
  - Red on the old code: 3 of 3 fail. The first red run, before Stop was wired in, never finished and was stopped at 300 seconds.
- **Sweep and suite.** Sweep `audit-batch-2-10.json`: 8 of 8 killed, control survived. Full suite `11482 / 11480 / 0 / 2`.

## Step 11: a Versions restore moves the draft with it (A06-2)

- **The finding.** Under draft-first, restoring an older version moved the live site but left the draft record naming the newer version. Three things followed:
  - the panel offered the newer version as unpublished;
  - the next edit's repair copied the newer pages back over the restored ones;
  - the next Publish quietly undid the restore.
- **The fix.**
  - `rebaseDraft` (`site-draft.mjs`) makes the restored version the draft's version and base, as a revision already published, on the etag. It writes nothing when unpublished work is held.
  - The restore route (`/versions/restore`), under draft-first:
    - answers 409 while the draft holds unpublished changes ("publish them first"), so nothing held is buried;
    - answers 409 for a version that was never published;
    - moves the draft after a successful activation.
  - `ensureEditableState` prefers the draft's version only when it is live or unpublished, so a restore that stops before moving the draft is not undone by the next edit.
  - Back online, which shares `restoreVersion`, is unchanged: it keeps an unpublished draft (DFO1).
  - **Kept as is:** restoring while changes are unpublished is refused rather than rebasing them, because their code versions were built on the newer pages. A "discard the draft" action would be the owner's call (backlog).
- **Tests.**
  - DFH8: published, then restored, so the draft reads published on the restored version; the next edit starts from the restored pages and its Publish keeps them live; with a change held, a restore is refused and changes nothing.
  - DFH8b: the draft's move fails after the restore, and the next edit keeps the restored pages.
  - SD-R: `rebaseDraft`'s record, its refusal, and its idempotence.
  - Red on the old code: 2 of 2 fail.
- **Sweep and suite.** Sweep `audit-batch-2-11.json`: 7 of 7 killed, control survived. R6 first survived, and DFH8b was then added. Full suite `11485 / 11483 / 0 / 2`.
