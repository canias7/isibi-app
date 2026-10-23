# The owner's decisions on five job findings (2026-10-23)

Branch `decide-g-jobs`, from `origin/main` (`a8fbfe876`). The owner chose an
option for each of five findings the audit rounds left open
(`docs/audits/2026-10-17-builder-audit.md`; options in
`docs/history/2026-10-23-r2-g2.md`, `r1-g4.md` and `r2-g4.md`). Offline only:
nothing paid, no model calls, no live writes. Not merged or deployed. No
Supabase change is needed, so nothing was written under `supabase/proposed/`.

## 12 · #243 S7-4: the next edit could overwrite a crashed job's paid change. Fixed (option 1: wait)

- **What was wrong.** With `PARALLEL_WRITES` on, a reader that did not hold
  the site's publish turn and found it held answered `turn-held` and read the
  editable copy as current. A job that died between its draft record and its
  editable copy keeps its turn for up to 10 minutes, so the next edit read the
  copy without the dead job's change and saved over it.
- **Fix.** A checked reader (`loadSiteSourceForEdit` with `checked`, which every
  edit, add-on, revise and rebuild read uses) now asks `ensureEditableState`
  to wait out a dead holder (`waitDead`). A holder is dead when its turn has
  not lapsed and was last renewed at least `TURN_STALE_MS` (75 s) ago
  (`turnLooksDead`, `builder/publish-turn.mjs`): a live job renews every 30 s
  and Publish every 60 s, and another writer can only claim beside a job whose
  90-second lease has already lapsed. The reader polls until the turn lapses
  (at most a turn's life and a minute, `turnOfDeadHolder` in `worker.js`), takes
  it, repairs the copy from the draft under it, and gives it back. A live
  holder is left to itself as before, and a job never waits for its own turn
  (`mine`: `publishBeside` and the edit and add-on routes pass the turn they
  hold).
- **Test.** `test/decide-jobs.test.mjs` "S7-4 A CHECKED READER WAITS OUT…"
  (red on the old code: it read `turn-held` and left the copy unrepaired) and
  "S7-4 turnLooksDead". Spelling guards re-anchored in
  `test/site-busy.test.mjs` and `test/site-files.test.mjs`.

## 16 · #108 A08-6: a draining or full container failed the job at once. Fixed (option 1: defer)

- **What was wrong.** A container draining after SIGTERM answers `503
  {"error":"stopping"}` for up to 13 minutes, and a full one `429`. The edit
  consumer asked a 503 three times 2 s apart and read a 429 as final, then
  failed the job `no-container`.
- **Fix.** `fireOutcome` (`builder/edit-job.mjs`) answers `defer` for those
  two. The edit consumer keeps the row's lease under its own name for
  `FIRE_DEFER_HOLD_S` (the delay plus a minute, `edit_handoff` with no next
  holder), so the site stays in line for the job, and sends the message again
  `SITE_BUSY_DEFER_S` (about a minute) out, carrying the lease's name and a
  count (`holder`, `fireWaits`). The next delivery takes the lease over by
  that name (`takeDeferredLease`) instead of claiming afresh; a lease that
  lapsed or moved is a fresh claim. After `FIRE_DEFER_MAX` deferrals (enough
  to cover the 13-minute drain), or when the message cannot be sent, the job
  fails `no-container` as before. Nothing is spent before a fire.
- **Not done: builds.** A build's run record has started before its fire, so
  deferring it is a different change. A build keeps exactly what it had (a
  429 stops, a draining 503 is asked again three times).
- **Tests.** `test/decide-jobs.test.mjs`, three "A08-6" cases (red on the old
  code: failed at once). The `fireOutcome` table in
  `test/container-job.test.mjs` now has the `defer` arm.

## 17 · #109 A08-7: nothing tied a launch to an image. Fixed (option 1: record it)

- The build service names its image in the `/job/run` answer (`image:
  IMAGE_ID`, or `unstamped`). `fireContainerJob` reads it (`firedImageOf`:
  anything else is `unknown`, never a value), writes the job's run mark
  (`runMarkKey`: `jobs/edit/<id>.ran.json`, or `jobs/<id>.ran.json` for a
  build, inside the retention sweep's prefixes) and logs it. Nothing is
  refused on it yet; options 2 and 3 stay open.
- **Test.** `test/decide-jobs.test.mjs` "A08-7…" (red on the old code: no mark).

## 18 · #260 S1-7: a paused job's checkpoint read was refused in the container. Fixed (option 2)

- **Fix.** `stageHeld` (`worker.js`) asks the checkpoint again while the store
  fails (`HELD_TRIES`) and now answers what happened. When a checkpoint the
  part must resume from could not be staged for a reason that recovers (a read
  or a write that failed), the edit consumer files nothing: the job goes back
  on the queue a minute out with its lease kept (`stageWaits`, at most
  `STAGE_WAIT_MAX` = 5), only when it would run in a container (the Worker can
  read the checkpoint itself). A checkpoint known missing or malformed is not
  waited for. Past the bound the job runs, and its own read answers.
- **The refusal is said as one.** A checkpoint the container's wall refused
  is now `checkpoint-refused` on the part (`recoverHeld`, `builder/request.mjs`),
  and the reply says the service running the part was not allowed to read it
  back, on our side (`builder/site-reply.mjs`), rather than that it could not
  be read. No gateway scope was widened.
- **Tests.** `test/decide-jobs.test.mjs` "S1-7…" (red on the old code: fired
  with nothing staged); `test/requirement-checkpoint.test.mjs` CK 7c now
  expects `checkpoint-refused` (red on the old code).

## 19 · #107 A08-5 and #261 S2-4: one realistic side-by-side test. Added (option 1 of each)

- **DH10** (`test/draft-handoff.test.mjs`): with `DRAFT_FIRST` and
  `PARALLEL_WRITES` on, one message with a site description and a page line
  becomes a look part and a text part. Both jobs run in the container at once
  (their model calls are shown to overlap), every storage call through the
  Worker's real gateway. The look job takes the turn from its start and writes
  the description through the wire under its fence; the text job takes the
  turn after it and publishes rebased. Nothing is refused by the wall, both
  parts end done as two draft revisions, and the live pointer, script and
  price do not move. It passes on the old code too: it is coverage, not a fix.
- Not done: `containerEnvOf`'s production mode (no copied bindings) and moving
  every fired-job file onto it (option 3 of #107), and #261's options 2 and 3.

## Sweep

Eleven mutants, each applied to a saved copy and restored from it (never from
git), run against `test/decide-jobs.test.mjs` and
`test/requirement-checkpoint.test.mjs`: 10 of 10 killed, and the comment-only
control survived. Killed: 429 not deferred, `stopping` not deferred, the defer
bound off by one, no takeover by name, the image never read, staging never
retried, no dead-turn wait, the caller's own turn waited for (the S7-4 case
times out; the runner counts that as cancelled, not failed), the refusal said
as unread, and the stale threshold set to a turn's whole life. DH10 is
coverage and had no mutant of its own.

## Tests run

31 affected files, 909 of 909 passing: `decide-jobs`, `draft-handoff`,
`container-job`, `build-runner`, `requirement-checkpoint`,
`requirement-recovery`, `site-busy`, `site-files`, `site-source`, `site-mark`,
`turn-fence`, `request-flow`, `concurrent-writes`, `parallel-publish-media`,
`job-stop`, `door-turn`, `edit-queue`, `deploy-gate`, `rebuild-job`,
`publish-integrity`, `audit-58-59`, `build-audit-batch`, `addon-runtime-paths`,
`dockerfile`, `page-gen`, `page-picker`, `site-rebuild-wiring`,
`job-retention`, `site-reply`, `request-plan`, `job-gateway`. The full suite
was not run.
