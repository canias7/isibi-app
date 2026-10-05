# The canary fix merged, the batch's findings closed (2026-10-05)

The owner, after reviewing run 99 (`2026-10-05-batch-r2.md`): *"Run 99 passed
review. Merge the reviewed scripts, tests and documentation into main after
confirming the diff still contains only those files; this should trigger no
deployment or container rebuild. Close the completed batch findings and
correct stale backlog statements that still say the reply handling has not
been demonstrated live."* And: *"Record menu-label inconsistency and vague
data-edit replies as remaining follow-ups. Leave demo changes in place, and
do not repeat the completed batch or start the separate rewrite test."*

Nothing was spent, pressed, built or deployed. The bakery keeps every change
the batch made.

## 1. The merge

- **The diff, checked first**: `e84b8e7e..cd817fee` is 8 commits and 19
  files (2,704 lines in, 134 out):
  - 4 scripts: `scripts/canary-replies.mjs` (new), `canary-ui.mjs`,
    `canary-requests.mjs` and `canary-read-job.mjs`;
  - 4 tests: `test/canary-replies.test.mjs` (new), the stand-in page
    `test/fixtures/canary-held-app.mjs` (new), `canary-read-job.test.mjs`
    and `canary-requests.test.mjs`;
  - 11 documents.

  Nothing under `public/`, `builder/` or `.github/`, and not `worker.js` or
  the Wrangler file. Every path is in `deploy.yml`'s `paths-ignore`
  (`**.md`, `docs/**`, `scripts/**`, `test/**`).
- **The image**, predicted over both ends: `386607152d4cb319` at each, 194
  inputs (164 distinct paths), none different.
- **The rollback**, in a throwaway worktree: `git revert --no-commit
  e84b8e7e..cd817fee` gives back `e84b8e7e`'s own tree.
- **Fast-forwarded** `main` from `e84b8e7e` to `cd817fee` (pushed at 03:23:48
  UTC). **No workflow run started on `main`**: its newest runs are still
  deploy 2183's and runs 96 and 97, all on `e84b8e7e` (read again at the
  closure). The branch push of `cd817fee` ran the unit tests, green (run
  37258298134).
- **So the live Worker is still deploy 2183** (`e84b8e7e`, image
  `386607152d4cb319`). `main` is ahead of it by scripts, tests and documents
  only. A press's `expect_deploy` box stays `e84b8e7e`.

## 2. Closed, on the owner's word

Each was taken out of the backlog's index and its full list:

1. **A menu link handed from the add-on step to the menu step failed with
   `no-menu`** (F1, run 95's R1). Fixed live in run 97: *Classes* went into
   the three menus that lacked it. Fixed again in run 99's R2: the add-on put
   the Wholesale link into every menu by code.
2. **A multi-part request's parts got no model-written reply** (F2, run 95).
   Run 97's part reply was written by the model in the background, found by
   run 98's free read. In run 99, all eight of R2–R5's part replies were the
   model's own and on screen, and three settled in place after their
   requests ended. R1's own request reply was also written in the background
   and served, during run 97.
3. **The page applied a part's result only when its reply was shown.** Fixed
   in the review round and deployed in 2183: the outcome applies at once,
   and the reply's place is held, then settled. The held line was seen live
   in run 97; held replies settled on the page in run 99.
4. **The Stop control still showed while a finished job's reply was
   written.** It went with the same fix: the job's watch ends when its
   outcome arrives.
5. **The UI canary judged a request part's reply before it was written** (run
   97). The reply watch was run live as run 99 and is merged by §1.

The findings record says the same (`docs/investigations/request-batch-findings.md`,
*Closed*), and so does the checklist's run-99 entry.

## 3. Stale statements corrected

- **The backlog's model-written replies item (MR1)**, in the index and in
  full, said no real model had written a reply. It now says that real models
  have written replies live: run 94's one-fact reply, R1's request reply
  (during run 97), run 97's part reply (read by run 98) and all eight of
  R2–R5's (run 99). Still unmeasured: faithfulness beyond the replies read
  one by one, another language, and the reply call's own time and cost (the
  `reply:` log lines were not read).
- **MR3** described the reply call as made at the first poll, bounded at
  12 s and 20 s. It now adds the bounds since deploy 2183: the queue writes
  a job's reply once its outcome and money are final, never at a read, and a
  synchronous reply is bounded at 30 s per call and 45 s in all. The call's
  own time is still unmeasured.
- **The findings record**: its opening said F2 was "not yet shown live for a
  part", and its run-97 section said the settling in place was "not yet seen
  live". Both now point to runs 98 and 99.
- **The checklist**: the canary's "not yet run live" and run 98's "not yet
  live: its settling in place" each now say "since, in run 99".
- The five closed items' own "not yet live" lines went out with them. The
  other backlog lines that say "not shown live" are about other work (the
  add-on `row` kind, the router audit) and stay as they are.

## 4. Remaining follow-ups, recorded

- **The new page's own menu names it differently**: the item already existed
  and is now marked a remaining follow-up. On `/wholesale` the menu says
  "Wholesale", before Order; on every other page it says "Wholesale Orders",
  after Order.
- **A data edit's reply cannot name the change**: a new item. In run 99's R2
  the reply said *"I've updated one of the loaves"*. The data step reports
  only the table, the row and the column (`applied`), so no reply can state
  the value. This is the limit the owner kept for the reply work when
  closing D1.

## 5. Still open

- **Earlier requests' replies placed under a new message**: the product bug.
  It is fixed on the branch next, on the same word, and kept for review with
  no deploy (`2026-10-05-reply-placement.md`).
- **The read-only lookup's `REPLY` wording** for a job with no reply on it.
- **The preview's first refresh** on a site with no stored version keeps
  `?v=1`.
- **RW**, the separate full-rewrite test: not started, as told.
