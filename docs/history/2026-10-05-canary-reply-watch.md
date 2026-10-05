# The canary waits for a request's replies (2026-10-05)

The owner, after run 97 (`2026-10-04-deploy-2183.md` §7):

> Fix the canary's pending-reply handling now, keeping this change to scripts
> and tests so no deployment or container rebuild is needed. Request
> completion does not mean its model-written replies have finished: track the
> current request's job IDs and wait within a bounded deadline for their
> replies to settle and actually appear on screen before judging them. Cover
> normal completion, clarification steps, and the closed-tab/reopen path;
> followAway currently also stops when the request is closed. Distinguish
> pending, model-written, failed and timed-out replies, and ensure unrelated
> historical replies cannot satisfy or block the current request's verdict.
> Add focused regression tests for delayed success, failure, timeout, reload
> and historical replies arriving during a new request. Keep the
> historical-message placement issue recorded as an unresolved product bug;
> waiting for history in the test does not fix it. Prepare the free read-only
> lookup for existing job f666481af2ef5410b14e00b9ad0da43d to establish
> whether run 97's reply was written, without resending the edit. If your
> workflow-launch permission is still blocked, give me the exact fields after
> preparing the fix. Do not repeat rq-menu-link, R1 or the earlier canary,
> restore changes, or rebuild anything. Push the instrument fix and evidence
> for review, with R2–R5 still pending and batch_spent at 29.

**Scripts and tests only.** No product file, no workflow file and nothing under
`public/`, `builder/` or `worker.js` changed, so the push starts no deploy run
and builds no image. Nothing was pressed or spent. Everything below is shown
with a stand-in page and supplied answers; nothing here is live evidence.

## 1. The gap, as run 97 showed it

Since deploy 2183 the page closes a request once each part's outcome is
applied, while a part's reply may still be written in the background: its place
is held on the thread by a message carrying the job's id (`held.job`), drawn as
the waiting line, and settled later by the page's own follow of that job. The
UI canary ended a request-mode message when the page closed the request
(`followStep`, and `followAway` in the tab opened afterwards), so it judged
run 97's reply 8 s after its job ended, while the answer still said `pending`,
and called it "composed". Its "reply on screen" was every assistant message
after the send, so five replies to other requests, drawn there by the page,
were counted as message 1's reply.

## 2. What changed

**`scripts/canary-replies.mjs` (new), the reply readers**, shared by the wait
and the verdict:
- **A reply's state is read off its own job**, from the page's own polls of
  that job (the answers handed back under `x-gf-edit: final`, which the canary
  records): `model` (the model's words, read exactly as the page reads them,
  `EditPoll.modelReply`), `pending`, `failed`, `question` (a step's question
  with no reply owed), `composed` (no model reply on it, none owed), `none` (a
  hand-over, which shows nothing), `unread`, and `timeout` (still pending, or
  still held on screen, when the time ran out; or held until the page itself
  stopped waiting).
- **Its place on screen is found by the job's own id** where the page holds
  one: the message that held the reply's place is the one it settles into
  (`trackHeld`, kept per page life, so a reload or a tab opened afresh reads
  them again; a kept place that now holds another job's reply is dropped).
  Otherwise **by the job's own words, counted against every other job whose
  answer carries the same words** (reply or question words, any request): never
  fewer messages carrying them than jobs that need them, so another request's
  message in the same words never stands in.
- **The request's own reply** counts once the page's own record says it showed
  this request's reply (`replied`) and its words are on screen; one still
  pending holds the wait, one that failed does not.
- **The verdict's words for each state** (`replyFailure`): written but not on
  screen; timed out; failed (the page showed its own sentence); composed;
  unread.

**`scripts/canary-ui.mjs`, the wait** (`watchReplies`):
- After every message the server took on as a request has ended — the
  ordinary end, a step's question (`until: "question"`), or the tab opened
  afterwards showing it ended (`away`) — **the canary waits on that request's
  own reply-bearing jobs** (each part's `jobs`, never a hand-over or a routing
  job, never one an earlier message of the same request was judged on), on the
  page that shows them, **until every reply is written or has failed for good
  and is on screen**, re-reading the request for its own reply.
- **The deadline**: the message's own bound, and never less than
  `UI_REPLY_FLOOR_MS` (60 s) after the request ended. The floor is counted in
  the press's time: every request scenario's bounds plus a floor per message
  stay inside `UI_PRESS_MAX_MS` (R3's two messages: 28 + 2 × 1 = 30 minutes).
  A separate, longer reply budget would have needed the workflow's time limit
  raised, and a workflow change starts a deploy run.
- **Nothing else on the thread is waited for or counted**: another request's
  replies, wherever the page draws them, neither hold the wait up nor stand in
  for this request's.
- **The message's reply on screen** (`reply`, which edit-canary's "message N got
  a reply on screen" reads) is now this request's own replies only, never the
  waiting line; every other reply drawn after the message is kept apart as
  `otherReplies` and printed, never counted.
- **The in-page readers**: each message's held job (read off the page's own
  thread, only while the drawn and kept counts agree), whether the waiting line
  is drawn, the page's life (`performance.timeOrigin`), and whether the page
  showed a request's own reply; the request reader also hands back a pending
  or failed reply's state.
- **The account** prints each job's reply state, whether it is on screen, when
  it was first pending and when it settled, whether the time ran out, and how
  many other replies were drawn after the message.

**`scripts/canary-requests.mjs`, the verdict**: `repliesOf` reads the watched
replies; a message recorded the old way is read with the same states, so a
reply whose last answer was still pending there says it was judged before it
was written, never "composed"; a request's message whose replies were not
watched fails on that.

**`scripts/canary-read-job.mjs`, the read-only lookup**: its account now has a
`REPLY` line, read by the same readers: written by the model (with the words),
still pending, failed, a hand-over, or none on the answer (§5).

**Unchanged, on purpose**: where the page draws other requests' replies. It is
an open product bug (`docs/backlog.md`); the canary does not wait for history
before sending, and ignores it when judging.

## 3. The tests (supplied answers, a stand-in page)

`test/fixtures/canary-held-app.mjs` is a stand-in page that does what the real
one does since deploy 2183: it holds a pending reply's place with the job's id,
follows every held job until its reply settles in place, closes a request with
held replies still pending, draws other requests' replies at the end of the
thread after the new message, keeps held marks across a reload, and can lag a
redraw behind its answer.

`test/canary-replies.test.mjs`, 28 cases:
- through the real `runUi` and the real verdict: **delayed success** (the
  request closes first, the reply is written six looks later, the canary
  waits); **failure** (told as failed, the wait ending at once); **timeout**
  (the waiting line never taken for a reply, nothing answering the message);
  the **deadline** with and without the floor; a **reload** in the middle of the
  wait; **a step's question** (the heading's reply waited for before the
  answer is sent; the answer's own reply in its turn) and a question whose
  reply is still being written; **the closed tab** (the reply still being
  written in the tab opened afterwards); **history** that cannot block (a held
  reply never written), cannot satisfy (this reply never written, another's in
  its very words drawn after the message), cannot stand in by its words, and
  cannot stand in by a held place; the request's own reply, written and
  failed; a reply answered before it is drawn;
- the readers one by one, run 97's own recorded shape judged again, the page's
  own reader and the request reader run in a sandbox, and the wiring.

`test/canary-read-job.test.mjs`: 2 cases for the `REPLY` line and the read's
bound. `test/canary-requests.test.mjs`: one expectation updated (the in-page
reader now reads `replied` and `replies`).

**The red check**, on the branch's last commit before the change (`60ec1503`),
in a throwaway worktree given the new reply module (it has no old
counterpart), the stand-in and the tests, plus one inert exported constant so
the test file loads:
- `test/canary-replies.test.mjs`: **19 of 28 fail**; the 9 that pass are the new
  module's own pure cases;
- `test/canary-read-job.test.mjs` does not load (the old module has no reply
  line);
- `test/canary-requests.test.mjs`: only the updated reader expectation fails;
  no unchanged case fails.
- **The old canary's own verdicts** on the new stand-in: delayed success, a
  false failure ("composed"), with the waiting line as the reply on screen;
  history, other requests' replies counted as this message's reply on screen.

**The sweeps**, from a verified-green baseline, each mutant putting one defect
back, every file restored and checked by hash:
- the first: **28 of 32 killed**, 3 comment-only controls surviving. The four
  survivors were gaps in the tests: a kept place now holding another job's
  reply; a question beside a written reply asked in the same words by another
  request; a written reply settling before it is drawn (the canary has the
  answer a moment before the page redraws); drawn and kept counts that
  disagree;
- the second, with those four tested and four mutants of the `REPLY` line:
  **8 of 8 killed**, 3 controls surviving.

**The suite and CI**: §6.

## 4. What a press now shows

A request-mode press's account gains, per message, a line such as
`replies, watched 9 s after the request: f666… model, on screen (pending at
203 s, settled at 210 s)`, and, when the page drew other requests' replies
after the message, `also drawn after the message, not this request's (never
counted; …): 5`. Its reply checks name the state: the model's own and on
screen; failed; timed out; composed; unread.

## 5. The read-only lookup for run 97's job

The canary's read-one-job mode on `f666481af2ef5410b14e00b9ad0da43d` reads the
job's row, its ledger rows and trace candidates, and polls the job once as the
owner; it posts nothing and resends nothing. With this branch it prints the
`REPLY` line; the whole answer is also kept in its evidence file
(`job-<id>.json`, `poll.body`).

**What the poll itself can do**: the poll route never calls the model. It hands
back the reply's record as it is. A record still pending past its 15-minute
horizon is marked failed by the read. A job that ended more than two hours ago
with no record is not asked for a reply by a read. So the answer comes back with
no reply and no state, exactly as one owed nothing does, and the `REPLY` line
says that it cannot tell those apart. Run 97's job ended at 23:34:21 UTC on
2026-10-04, well past both.

**The press**: §7.

## 6. The suite and CI

- **The full unit suite, locally**: `9411 / 9411 / 0 / 0` (before the change
  `9381`; the 30 new cases are the 28 in `test/canary-replies.test.mjs` and the
  2 in `test/canary-read-job.test.mjs`).
- **Unit CI**: run 37247801770 (`push` on `66279cd4`, the code at `cfe6688a`
  with the records on top), `success`, `9411 / 9407 / 0 / 4` — the local total
  exactly, CI skipping four as always. The run on `cfe6688a` itself
  (37247745937) was cancelled by that second push. No other workflow ran:
  nothing under the site build's paths changed, and no deploy run started.

## 7. The press

**The session's one dispatch** of the lookup (00:29:58 UTC, from the branch,
`read_job` `f666481af2ef5410b14e00b9ad0da43d`, every other box as it is)
answered **403** *"Resource not accessible by integration"*, as a session's
dispatch always has. Tried once, as asked, and not retried: the press is the
owner's. Its boxes, by their descriptions:
- "Use workflow from": `claude/help-needed-ehlwlj`, so it prints the `REPLY`
  line;
- "READ ONE EXISTING JOB AND STOP: a job id. Spends nothing, changes nothing,
  and ignores every input below.": `f666481af2ef5410b14e00b9ad0da43d`;
- every other box as it is ("Run the ONE paid edit as well (yes/no)" stays
  `no`).

**R2–R5 are still unpressed**, and the batch's spend is **29** (rq-canary 4,
R1 21, the focused check 4). Money at 00:29 UTC: balance 91, last ledger row
369, no job open.
