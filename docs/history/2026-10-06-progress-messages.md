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

## 5. The wording round (2026-10-06, after the first push)

The owner, after the screenshots of the first build: *"One wording
clarification: make the assistant's task summaries and progress updates
conversational and first-person. “Change the Gallery heading” reads like a
command; I want the tone of “Okay, I’ll update the Gallery heading” or “I’m
updating it now.” These are tone examples, not templates. Let the model
generate the wording naturally from context, matching whether the work is
planned, happening or finished. Don’t add hardcoded prefixes to the user’s
words."*

**What was built** (the design is the plan's §2.10):

- **The progress lines**: `PROGRESS_SYSTEM` now opens with the model as the
  website builder telling the customer itself, and adds one rule: the first
  person, naturally and conversationally — next facts as what it will do,
  doing facts as what it is doing now, the rest as what it has done or could
  not do. No example line; the owner's examples are not quoted to the model.
- **The task summaries**: a card's title was the customer's own words (also
  what the job runs on), so it read as a command. The model now writes each
  task's line once for every state it can be in (`write_tasks`, four states:
  planned, doing, done, notdone), and **code picks the one for the status the
  server gives**, so a line can never claim a state its task is not in. Until
  the lines come, or if they never do, the title is the customer's words with
  nothing put before them.
- **Kept and written** on the same record, lease and queue as the progress
  lines: a page-filed job's one task on its own record (asked for at its
  opening); a request's parts on the request's own narration record, opened
  at the acceptance and given every part carved later — by the driver as it
  saves the part, and by the cron for anything missed. A task's lines carry
  no state, so they are committed even after the job ended.
- **Read** on the job poll, the requests list's found jobs, and a request's
  read and list (`said`), strictly on the page (all four states or none).

**Found during the round**: a part carved from another after the acceptance
(a job's held additions) would have kept the customer's words for good,
because the request's narration was opened once with the parts known then.
The narration is now kept to the request's parts (create-or-add), the driver
adds a carved part as it saves it, and only the tasks still without lines are
sent to the model. NAMES 5 shows it on the queue alone, with no cron; it fails
with the driver's addition taken out (checked by hand before the sweep).

**A slip of mine, repaired**: while checking NAMES 5 against a disabled
driver hook by hand, I backed `worker.js` up with an unset path variable, so
the backup went to `/worker.js.bak` and my restore copied an older scratch
copy over the file. It was noticed at once (the diff had grown to 836 lines
and 30 flow cases failed), and the file was restored from `/worker.js.bak`,
the copy taken just before the edit; the diff and every focused case were
checked again after it. The stray copy at the filesystem root could not be
removed from this session (a safety check refuses it) and is outside the
repository.

**The sweep found one more, a test's fault taken by the new record**: the full
run of the spec (140 mutants and 6 comment-only controls: the first build's
and this round's) killed 139; the one survivor was the first build's
"a record that did not open is never opened again". Its case, OPEN, fails
the next read of any progress record once, and the request's narration,
opened at the acceptance, is now read first: it took the fault, and the job's
own opening was never made to fail. OPEN now aims the fault at a job's own
record. Rerun with the 17 page mutants (the page's new block had been moved
above the progress lines' comment after the sweep, its code unchanged) and
the 6 controls: 18 of 18 killed, every control surviving.

**The evidence so far** (all with supplied model answers; nothing pressed or
spent):

- **The focused cases**: `test/progress.test.mjs` 25 (TASKS 1–5 and PROSE 3
  new, PROSE 2 extended), `test/progress-flow.test.mjs` 35 (NAMES 1–8 new;
  OFF, LOG and OPEN extended), `test/progress-page.test.mjs` 13 (four SAID
  cases new), all passing; `test/progress-browser.test.mjs` 4 in real
  Chromium (TENSES new; Path A and the fresh device extended), passing
  locally.
- **The sweep**: as above — 140 mutants, 139 killed, the survivor closed by
  OPEN's aim and killed on its rerun; 0 never applied; all 6 controls
  surviving.
- **The instructions**: `PROGRESS_SYSTEM` 1,490 characters, `TASK_SYSTEM`
  853; no example line in either, no length checked anywhere.
- **The screenshots** (real Chromium, in this conversation): three parts at
  once in the past, present and future tense, then all finished; a request's
  part named by its doing line while it runs; a fresh device's two cards.
- **The commit**: `dd446201` (the code, its tests and the spec).
- **The full suite** on it: `9669 / 9669 / 0 / 0` locally (19 more than
  before, the round's new cases: 6 + 8 + 4 + 1).
- **Unit CI** on it: run 37502463796, `9669 / 9650 / 0 / 19`, green; the 19
  skipped are the real-browser cases (TENSES the new one), and the total
  matches the local run.
- **Site build** on it: run 37502463614, every job green: "404 checks in 27
  sections across 4 shards" (inputs `8442e8c495d45135`, 3,973 files).
- **The image, predicted, not built**: main `b2409b3c` → `c7fe818d446dd957`
  (194 inputs); `dd446201` → `141b0dcc2a92d926` (195 inputs). Against the
  first build's `ecbe624e` (`4a3e09b1d0c8056f`), three inputs differ:
  `builder/request.mjs`, `builder/site-progress.mjs` and `worker.js`. A merge
  would roll the image.
- **Live state, read** (17:17 UTC): balance 9, the ledger's last row 397, no
  job open — nothing spent.

## 6. The gaps round (2026-10-06, after the wording round's push)

The owner, after Codex reproduced a partial result shown as finished: *"Fix
the remaining progress-feature gaps on claude/help-needed-ehlwlj. Codex
reproduced a standalone partial result being displayed as fully finished:
siteJobFollow treats HTTP success plus ok:true as done, and siteJobCardHTML
then selects the prewritten completion sentence even when the response names
unfinished work. Derive the displayed state and model-written summary from
the actual outcome across Edit and Add-on, covering partial results,
clarification, handoffs and unverified outcomes; unverified must not select a
sentence saying the requested change is actively happening. Keep the
language natural and model-generated, with no hardcoded conversational
prefixes or keyword filters. Close the documented race where a failed or
timed-out progress close lets a writer commit after its last job-state check
and after finalization; ensure stale narration cannot appear through
polling, request views, reloads or another device, without holding up job
completion indefinitely. Fix makeProgress dropping a milestone when
JOB_PROGRESS fails: retain its identity and retry automatically while
appropriate, without needing another milestone or an open browser, and
prevent duplicates when the first delivery landed but its response was lost.
Also fix the documented UI canary issue so final-reply checks read the reply
itself separately from retained progress. Add focused behavioral tests
reproducing these failures, including the close-write failure at the actual
race boundary and container delivery failure, then push the fixes and update
owner-notes with exact commits, results and remaining limitations. Keep the
feature off and the branch unmerged; no deployment, container image build,
paid retest or unrelated backlog work."*

**Reproduced first.** Thirteen cases were written against the code as it
stood (`ba8a12dc`), through the real Worker and the page's real functions
answered by it, and each failed for the reason named:

- **Codex's reproduction** (OUTCOME 1): a page-filed addition whose menu
  link was set aside answered `ok: true`; the poll served no outcome, and
  another device's card read **Finished** with the model's done line.
- A question and a hand-over were called **Not done** (OUTCOME 2); a job
  held for review, **Finished** or **Not done** (OUTCOME 3); a request's
  part held for review was named by its **doing** line (OUTCOME 5).
- **At the race boundary** (RACE 1, RACE 2): the writer past its last row
  check, the job's close refused by the store on all six of its tries, the
  job finalized, and only then the commit: the finished job's answer carried
  the line ("the finished job's answer carries the line committed after its
  end").
- **Container delivery** (RECORDER 1–4): a milestone whose call failed
  before reaching the Worker was dropped ("the milestone whose delivery
  failed was dropped"), one landed whose answer was lost was never sent
  again, the gateway's store failure was answered as a refusal, and with a
  failure on the first milestone the record's milestones came in as
  `designed, pages, publish` only; in the Worker, the store failing one read
  dropped it too (RECORDER 5).
- **The canary** (real Chromium, and a stand-in thread on unit CI): the
  reader's text of a failed job's reply began with its first kept line
  ("0:05I found the Gallery heading…"), so the failure check missed the
  warning.

**What was built** (the design is the plan's §2.5, §2.6, §2.7, §2.10 and the
new §2.11):

- **Each job's own outcome**, read by the server from its row and stored
  answer (`editJobOutcome`, `settle`'s own readings for one job), served on
  the poll and the requests list's found jobs with progress on; the card's
  label and the model's line are picked from it. Task lines are written in
  seven states (planned, doing, waiting, unconfirmed, done, partial,
  notdone), so a part or job held for review shows its unconfirmed line,
  never its doing line; one waiting on the customer, its waiting line; one
  done in part, its partial line; a hand-over, Handed over beside its
  planned line. The model still writes every word; code only picks which
  line, and nothing is put before anything.
- **No line after the final reply**: a line is committed unconfirmed and
  shown by no reader until a read of the job's row made after it finds the
  job still running — the writer's own third read, the next writer's first,
  or the two-minute cron. A commit that lands after the job's end finds no
  such read and stays unshown everywhere. The close is tried once and never
  holds the job's end.
- **A milestone kept and sent again**: the recorder sends each delivery as
  one body under its own number, again after 250 ms, 0.5, 1, 2, 4, 8 and
  15 s while the job runs, on its own timer; a try that landed and whose
  answer was lost is recorded once; a refusal (409) is never sent again; the
  Worker's store failure is answered `retry` (503 through the gateway, which
  the container's sender reads as worth trying again, as it does a 429 or
  any 5xx); order is kept; the job's end allows one last try.
- **The canary's reader** cuts a reply's kept lines out of its text and reads
  them apart (`progress`).

**Found during the round**:

- `jobOutcome` was already the name of the timer jobs' function in
  `worker.js` (from `site-jobs.mjs`): the new one is `editJobOutcome`.
- Four of the new cases had mistakes of mine, each caught on its first run
  and fixed in the case, not the product: the fixture's `answerOf` takes a
  row, not an id; a stop on a queued job in the fixture only marks the row,
  so the control stops a running job instead; RACE 3's second fault took the
  cron's own read; and RECORDER 4 first failed its milestone past the job's
  end, where giving up is the rule. That last one also showed that a job
  ending before a delivery's first failure gave it only one try, so the rule
  became "one more try at once once the end is asked for, and no more".
  (RECORDER 5's fault, aimed wrongly at first, was caught by the red check:
  below.)
- **The sweep's two survivors** (below), each a case that did not isolate
  what it claimed: OFF never looked for `outcome` with progress off, and
  RACE 4's next writer's own commit also confirmed the earlier line, so its
  first-read confirmation was never alone. Both cases were tightened.

**The evidence** (all with supplied model answers; nothing pressed or
spent):

- **The red check**, in throwaway worktrees at `ba8a12dc` with the page
  fixture as it stood there:
  - **Written first**: the 13 reproduction cases (OUTCOME 1–5, RACE 1–3,
    RECORDER 1–5), 13 of 13 failing, each for the reason it names. On the
    first run RECORDER 5 passed: its one-read fault was taken by the
    opening's own read (asking for its task writer), which the code already
    survived; aimed at the first milestone's own read (once the record shows
    the ask), it failed with the rest. The other files' new cases failed
    too: the canary's reader on a stand-in thread, FOUND's follow and the
    four SAID cases on the page, `test/progress.test.mjs` at its import (the
    new names did not exist), and in real Chromium CANARY and OUTCOMES, while
    the four earlier browser cases passed.
  - **Again on the final files**, before the push, with only two imports
    made indirect in the throwaway copy so that the file loads on the old
    code: `test/progress-gaps.test.mjs` 18 of 19 failing. The six cases
    added during the build are among them: OUTCOME 0 (`editJobOutcome` did
    not exist), OUTCOME 6 (no outcome), OUTCOME 7 (the list's read did not
    ask for `needs_review`), RACE 4 (no line was ever confirmed) and NAMES 9
    (no batch, so its own precondition failed). RECORDER 6 passed, as a
    guard should: the old recorder also made a missed opening again before
    the next milestone. `test/progress-page.test.mjs` with
    `test/canary-replies.test.mjs`: 7 of 44 failing (the canary's reader,
    FOUND's follow, the four SAID cases, and OUTCOME, where a finished
    answer without an outcome read Finished); the other 37 passed.
- **The focused cases**, all passing on `84d46faf`:
  `test/progress-gaps.test.mjs` 19 (new), `test/progress.test.mjs` 25,
  `test/progress-flow.test.mjs` 35, `test/progress-page.test.mjs` 14
  (OUTCOME new), `test/progress-browser.test.mjs` 6 in real Chromium
  (CANARY and OUTCOMES new), `test/canary-replies.test.mjs` 30 (the reader
  on a stand-in thread new) and `test/canary-requests.test.mjs` 47.
- **The sweeps**, each from a green baseline, with comment-only controls:
  - the new spec, `scripts/mutants/progress-gaps.json`: 60 mutants and 4
    controls over eight files (`builder/request.mjs`, `worker.js`,
    `builder/site-progress.mjs`, `builder/job-gateway.mjs`,
    `builder/container-env.mjs`, `public/chat.js`, `public/edit-poll.js`,
    `scripts/canary-ui.mjs`), run against the five focused unit files: 58
    killed, 0 never applied, every control surviving. The two survivors
    (above) were closed by OFF and RACE 4, and both were killed on their
    rerun (2 of 2, the control surviving).
  - the earlier spec, `scripts/mutants/progress.json` (146 entries): the 15
    mutants whose anchors this round moved were re-pointed and run with 6
    controls: 14 killed, every control surviving. The survivor was the first
    build's "a record that did not open is never opened again": OPEN's store
    failure is now answered as worth retrying, so its opening lands on its
    own retry and the opening made again before the next milestone was never
    needed alone. RECORDER 6 (a refusal, which is never resent) closes it;
    killed on its rerun (1 of 1, the control surviving).
- **The instructions**: `TASK_SYSTEM` 1,133 characters (853 before: the
  waiting, unconfirmed and partial states and "Give no reasons" added);
  `PROGRESS_SYSTEM` unchanged at 1,490. Still no example line, and no length
  checked anywhere.
- **The full suite** on `84d46faf`: `9692 / 9692 / 0 / 0` locally (23 more
  than before: 19 + 1 + 2 + 1, the round's new cases).
- **Unit CI** on it: run 37515371950, `9692 / 9671 / 0 / 21`, green; the 21
  skipped are the real-browser cases (CANARY and OUTCOMES the new ones), and
  the total matches the local run.
- **Site build** on it: run 37515372064, every job green: "404 checks in 27
  sections across 4 shards" (inputs `979f94b2735bc0a2`, 3,973 files). Shard
  3 was still running when the records were first committed (`1dbfb367`,
  19:08 UTC); its result is stamped here after the run.
- **The records commit** `1dbfb367`: unit CI run 37516767766, `9692 / 9671
  / 0 / 21`, green, the same totals.
- **The image, predicted, not built**: `84d46faf` → `5f946c22d42a1b10` (195
  inputs, 165 distinct paths). Against `ba8a12dc` (`141b0dcc2a92d926`) five
  inputs differ: `builder/container-env.mjs`, `builder/job-gateway.mjs`,
  `builder/request.mjs`, `builder/site-progress.mjs` and `worker.js`. Main
  stays at `b2409b3c` (`c7fe818d446dd957`); a merge would roll the image.
- **The screenshots** (real Chromium, in this conversation): another
  device's four cards — Partly done, Checking it published, Waiting for your
  answer and Handed over, each with the model's line for that outcome — and
  a failed job's reply with its kept lines above it, which the canary now
  reads apart.
- **Live state, read** (18:58 UTC): balance 9, the ledger's last row 397, no
  job open — nothing spent.

**What it does not show, and the limits that stay** (the plan's §7):

- No real model has written a line in any of the seven states; their
  wording, tense and cost are unmeasured until a live press with the switch
  on.
- The words are still not checked: a line whose state is right and whose
  words say otherwise would be shown.
- A true line whose confirmation never landed before its job ended (the
  writer's read after its commit failed, and no other writer or cron tick
  came in time) is never shown: the price of never showing a late one.
- A milestone is given up after about half a minute of failed deliveries
  (eight tries), or at the job's end after one last try, and its facts are
  then never narrated. The recorder lives in the job's own process: if that
  process dies, its waiting milestones go with it.
- A hand-over's card shows its planned line beside "Handed over" even when
  the page that filed the job is closed, so nothing continues until that
  page is opened again. A card whose finished answer carries no outcome shows
  "Ended" and the customer's words.
- The test platform answers every column of a job-table read (the backlog),
  so the outcome's two reads are pinned from the source (OUTCOME 7).

## 7. The round closed, and the release prepared (2026-10-06, late)

**Closed by Codex's review.** The owner: *"Codex reviewed 7abe6c3d and
independently confirmed the corrected outcome labels, suppression of late
progress, automatic delivery retries without duplicate milestones, and
separate final-reply reading. Close this correction round and prepare one
release plus one combined live Edit/Add-on verification using the existing
canary and a demo site."* The full request is quoted at the top of
`docs/investigations/progress-release-plan.md`. That is the stage to
authorize: one merge and its one image roll, the switch, and one paid press.
**Nothing in it has been executed**: not merged, not deployed, no image
built, `PROGRESS_REPLIES` not set, nothing pressed or spent.

**The press, `lv-progress`** (canary scripts, the canary workflow and tests
only; no product file changed, so the image stays `5f946c22d42a1b10`):
- **The message**, one, on `fold-lane-bakery`: an FAQ page with a link in
  the menu (the add-on) and the Classes heading 'Spend a Saturday morning
  with the starter' → 'Spend a Saturday morning at the bench' (an edit).
  - Read live at 23:06 UTC (version `01791295110535-tgh1l6`, run 103's last
    publish): `/classes` 200 with that heading; `/faq` 404; the home page
    links `/`, `/bake-list`, `/classes`, `/gallery`, `/order`, `/starter`,
    `/tasting-evenings`, `/visit` and `/wholesale`, with no FAQ.
  - The published page's code carries the heading once, as the story lead's
    headline. That component also draws its picture's label and caption from
    the headline.
  - No earlier scenario asked for either change.
- **The step mode `away: "fresh"`**:
  - the sending tab watches the request's card until a progress line shows
    while the request runs (at most 6 minutes), then is closed;
  - the list alone is read for 30 s;
  - a fresh browser session follows the request to its end: a new context,
    signed in afresh with a second magic-link session of the same account.
- **The checks**: eight progress checks (`progressChecks`), the coverage
  `progress-each-part`, and **the no-charge check**
  (`narrationChargeVerdict`): the balance moved by exactly the press's own
  routing and jobs, and no other ledger row was written while it ran.
- **The preflight**:
  - the funds: budget 28;
  - **the hard cap, 32**: the press refuses above it, and every charge
    refuses rather than overdraws. Read in `edit_reserve` (*"a bill larger
    than the balance moves nothing"*) and `credit_debit` (`insufficient`);
  - progress on: the requests list carries `jobs` only with
    `PROGRESS_REPLIES` on, `[]` even when its read fails.
- **The usage step** (`scripts/narration-usage.mjs`, a workflow step of its
  own after the press, free and read-only): each narration call's attempts,
  tokens, time and model from the Worker's own log lines, with the
  platform's cost at its own rates (a floor).
- **The estimate**: about 20 credits charged to the account, range 16–26.
  - R2 of run 99 (a page with its menu link, no form or table): add-on 12.
  - Runs 101 and 103 (a page with a form and a table): 16 and 18.
  - The requirement judgment is newer than R2: about +1.
  - The narration is absorbed by the platform.

**The evidence so far**:
- `test/canary-progress.test.mjs`, 21 cases, passing; case 7 of
  `test/progress-browser.test.mjs` (the card reader in real Chromium),
  passing.
- The five canary files together: 192 of 192 after the budget and cap were
  set.
- **The sweep of the canary code** (`scripts/mutants/progress-release.json`,
  51 mutants, 4 controls). The first run killed 48, and every control
  survived. The 3 survivors each got a case and were killed on a rerun (3 of
  3, the 2 controls surviving):
  - a doing line shown on a part that was not running;
  - the median of three calls, where two calls had made the fastest one
    pass;
  - the usage step's `if: always()`. The workflow test read each step's
    chunk, which runs on to the next step's comment, and that comment says
    `if: always()` in prose: the recorded trap. The test now blanks
    comments first.
- **The same sweep on the finished tree**, after the budget and the cap
  were set: 51 of 51 killed, the 4 controls surviving.
- **The card reader's sweep** (`scripts/mutants/progress-release-cards.json`,
  real Chromium): 7 of 7 killed, the control surviving.
- **The full suite** on the finished tree: `9714 / 9714 / 0 / 0` locally,
  22 more than `84d46faf`'s 9,692 (the 21 new canary cases and the new
  browser case). Its first run failed once: `ci-browser-order` requires every
  script a workflow runs to be named in its path filter, the parked one
  included, and the canary workflow's parked filter did not name
  `scripts/narration-usage.mjs`. It does now, and the rerun was clean.
- **Balance 9**, read at 23:01 UTC: the ledger's last row 397, no job open,
  nothing spent.
