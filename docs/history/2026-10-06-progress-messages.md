# Model-written progress while an Edit or Add-on runs (2026-10-06, on the branch)

The owner, approving the plan with corrections:
*"Proceed with model-written progress for Edit and Add-on using the
recommended defaults: the existing selected quick model, platform-absorbed
narration cost, progress retained above the final reply, both request and
standalone-job paths, and fixed status labels alongside natural model-written
messages. Incorporate these corrections into the plan and implementation: do
not claim that matching says metadata proves the prose truthful; ground the
model in verified facts, distinguish designed, saved, applied and published
outcomes, test contradictory prose with otherwise valid metadata, and document
the remaining model limitation without adding keyword-based message filters.
Define one writer per job with recoverable persistence, queue delivery and
index updates; recovery must work without another milestone or an open
browser. Tie background recording to the existing Worker/container task
lifecycle rather than detached promises. Check authoritative job state and
writer ownership before starting and committing narration so completion,
failure, cancellation or a newer attempt cannot produce stale updates after
the final reply. Make cross-device discovery work for both supported paths
and state the actual retention window. Preserve execution, publishing,
customer charges and final replies. Keep instructions concise rather than
relying on an arbitrary short character limit that silently suppresses useful
updates. Add focused tests for these races, interrupted writes, duplicate
delivery, ambiguous or false completion claims, reloads and a fresh device;
log actual model attempts, tokens and latency rather than promising exact call
counts. Keep the feature off by default, push the implementation and evidence
for review, and update owner-notes. No merge, deployment, container image
build, paid test or unrelated backlog work."*

**Built on the branch, off by default** (`PROGRESS_REPLIES`, an optional
secret with an `|| 'off'` fallback). Not merged, not deployed, no image built,
nothing pressed or spent. Shown with supplied model answers only: no real
model has written a line. The design, as built, with every correction and
where it is met, is `docs/investigations/progress-messages-plan.md` (§0 and
§2); this file is the record of the work and its evidence.

## 1. What was built

- **The module** (`builder/site-progress.mjs`, pure): the switch; the job's
  record and its strict reader; the milestones' facts in seven states
  (decided, designed, prepared, applied, doing, next, notdone; no published
  state); the one writer's rules (claim under a lease, batch, commit, fail,
  close); the job-row verdict; the short instructions; the forced tool
  `write_progress { text, says }`; the check of `says`; the call (at most two
  attempts).
- **The Worker** (`worker.js`): the record's store, changed only by
  compare-and-swap (`progressUpdate`); the recorder (`makeProgress`) made where
  the job is claimed, its writes on one chain and each handed to the
  invocation's `waitUntil`, the record closed before the job's outcome is
  written; the writer (`runProgressTask`, a queue task), reading the job's
  row before the call and before the commit; the cron's recovery
  (`runProgressSweep`); the gateway's door for the container; the job poll,
  the request read and list joined at read time, and the standalone jobs on
  the requests list (`jobs`); the milestones in the edit route (plan,
  publish, correct, publish again) and the add-on route (picked, designed,
  schema, pages, publish).
- **The gateway and the container**: `/progress` under the job's own token
  (`builder/job-gateway.mjs`), `env.JOB_PROGRESS` (`builder/container-env.mjs`),
  the switch carried in (`builder/edit-job.mjs`), the module in the image
  (`Dockerfile`).
- **The page** (`public/chat.js`, `public/edit-poll.js`, `public/styles.css`):
  each request part's lines under its fixed label, the newest live, muted
  once ended; Path B's newest line where "Thinking" was; a watched job's lines
  kept on its reply with the job named; a standalone job found from another
  device drawn as a card (fixed label and lines) and followed to its reply,
  said, never applied.

## 2. Found and fixed during the work

- **The requests list asked for the oldest 20 standalone jobs of the day**
  (`order=created_at.asc&limit=20`), so on a busy site the job running now
  could be left off. It asks for the newest 20 and hands them out oldest
  first (`STANDALONE_JOBS_MAX`), with FIND 2 and two mutants. The test
  platform's job table now applies a read's `order` and `limit`, as the Data
  API does; the 210 cases that use the platform pass with it.
- **The first sweep hung**: a mutant left a case waiting on a gate its flow
  never reached while the held job's heartbeat kept the process alive. A
  case's gate now fails the case after 20 seconds (`gate()` in
  `test/progress-flow.test.mjs`).
- **The sweep's survivors**, each a missing case, now each a case (the first
  seven from the first run, before it was stopped; the last from the full run
  on `5cfebd0a`):

| Survivor | The case that kills it |
|---|---|
| a job that threw does not close its record | THREW: the failure path closes the record before its refund, read from the source (no free flow makes a route throw: every route returns its failures as answers) |
| a row that could not be read closes the record | ROW UNREAD: no call, the record kept open, the try made again after its wait, the line written |
| a task does not ask again for what it leaves waiting | MANY: after its eight lines, the milestone recorded during its last call gets a task with no cron and no page |
| a stale run's milestone lands on a newer run's record | GATEWAY: a milestone from a run that did not open the record is refused (409) and not recorded |
| a stale run closes a newer run's record | GATEWAY: that run's close closes nothing |
| a record that did not open is never opened again | OPEN: the opening's read fails; the record is opened again before the first milestone |
| a write is a detached promise, not held by the invocation | LIFE: with progress on, the job's `waitUntil` is handed one more promise per write (the opening, each milestone, the close) than with it off |
| *(the full run's one survivor)* an add-on's "designed" milestone not recorded | ADD-ON: an add-on run to its end records picked, designed, pages and publish, in that order, each fact in its state |

- **The gateway test's title named a pre-scoped build, and its body did not
  test one**: it does now (403, nothing recorded).

## 3. The evidence

- **The commits**: `9c931540` (the implementation and its tests), `5cfebd0a`
  (the live steps ask the build predicate once — the one failure the full
  suite found on `9c931540`, below) and `49ba56bd` (the ADD-ON case, closing
  the sweep's survivor).
- **The focused tests**, all with supplied model answers:
  `test/progress.test.mjs` 19, `test/progress-flow.test.mjs` 27,
  `test/progress-page.test.mjs` 9, all passing;
  `test/progress-browser.test.mjs` 3 in real Chromium, passing locally and
  skipped on unit CI (no browser there). The 210 cases of every file that uses
  the test platform pass with its new order, limit and read fault.
- **The full suite**: on `9c931540`, `9649 / 9648 / 1 / 0` locally. The one
  failure was a guard doing its job (`test/build-panel.test.mjs`, "the rail
  and the stage panel ask the ONE predicate"): the progress bubble had made
  the rail ask `stBuildRunning()` a second time. Fixed in `5cfebd0a` (one gate
  holding both returns, the markup unchanged; `test/topbar-layout.test.mjs`
  re-anchored to read the gate as a block). On `5cfebd0a`:
  `9649 / 9649 / 0 / 0` locally; on `49ba56bd`: `9650 / 9650 / 0 / 0` locally.
- **Unit CI**: run 37492106699 on `9c931540`, `9649 / 9630 / 1 / 18` — the
  same one failure, nothing else; the 18 skipped are the real-browser cases
  (15 already there, these 3 among them). Run 37493442069 on `5cfebd0a`:
  `9649 / 9631 / 0 / 18`, green. The run on this record's own commit is read
  after its push.
- **Site build**: run 37492106792 on `9c931540`, every job green: "404 checks
  in 27 sections across 4 shards" (inputs `edd40cbe07a38d5c`, 3,973 files).
  The later commits changed no site-build path and started none.
- **The image, predicted, not built**: main `b2409b3c` → `c7fe818d446dd957`
  (194 inputs, deploy 2185's image); the branch at `9c931540`, `5cfebd0a` and
  `49ba56bd` → `4a3e09b1d0c8056f` (195 inputs). Seven inputs differ:
  `Dockerfile`, `worker.js`, `builder/container-env.mjs`,
  `builder/edit-job.mjs`, `builder/job-gateway.mjs`, `builder/request.mjs` and
  the new `builder/site-progress.mjs`. A merge would roll the image.
- **The sweep** (`scripts/mutants/progress.json`, 81 mutants and 4
  comment-only controls over the module, the Worker's wiring, the gateway, the
  container, the request view, the page and the poll reader, against the three
  files above): the first run was stopped twice: once when a mutant hung a
  case (now a case's gate fails after 20 seconds), and once to commit; before
  it stopped it had found **seven survivors**, each closed by a case (§2). The
  full run on `5cfebd0a`: **81 mutants, 80 killed, 1 survived, 0 never
  applied, all 4 controls surviving**. The survivor, the add-on's "designed"
  milestone taken out, had no case; the ADD-ON case (`49ba56bd`) closes it,
  and the survivor rerun alone was killed (1 of 1, its control surviving).
- **The screenshots** (real Chromium, in this conversation): a request's card
  running and finished, a page-filed job running and finished, and a fresh
  device finding both.
- **Live state, read**: balance 9, the ledger's last row 397, no job open
  (nothing spent by this work).

## 4. What it does not show

As in the plan's §7: no real model has written a line, and its words, time
and cost are unmeasured; the check reads `says`, not the words, so
contradictory words with a right `says` are committed (PROSE 1, CLAIM 3), and
nothing filters words by keyword; one residual window when the job's own
close fails (in the backlog); "saved" is not reported on its own; the bounds
(50 running jobs a cron tick, the 20 most recent standalone jobs, 200
milestones a record) are stated where they apply.
