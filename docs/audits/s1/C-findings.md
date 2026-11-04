# Audit s1, reader C: the request state machine (offline, read-only)

Branch `claude/cool-fermat-a06gie`, 2026-11-04. Probes are pure-function runs of
`builder/request.mjs` (no network, no model). Probe scripts are in the session's scratchpad (p1–p3).

## C-1 (high) A go-ahead on a full rewrite starts while another request runs on the site
- **Where:** `worker.js:25542` (`approveRequestPart` → `approvePart`) then `worker.js:25558` (`advanceRequest`); `builder/request.mjs:2629` (`approvePart`).
- **Summary:** A part waiting for approval puts its request in the `waiting` state, which releases the line. Pressing the go-ahead files the rewrite at once. It never goes through `resumeInLine`, unlike an answer or a credit top-up.
- **What the customer sees:** Their whole site is rebuilt at the same time as an edit from a later message. Either one's publish can overwrite the other's, and the chat shows two requests working.
- **Scenario:** Request A asks "start over?" and its part goes to `approval`. The customer sends message B, and B starts because A holds nothing. The customer then presses the go-ahead on A. `approvePart` sets the part to `queued` with a pending rewrite job, and `rec.queued` stays false. `advanceRequest` skips the queue check (`base.queued === true` is false) and `nextStep` files the build while B's job runs. The start-over answer path (`resumeRequestPart` → `approveRequestPart`) is affected the same way: `resumeInLine` is applied first, but `approveRequestPart` then reads and advances the record on its own.
- **Confidence:** End-to-end reading (worker and module). Not run live.

## C-2 (high) An addition posted to the add-on route bypasses the message queue
- **Where:** `worker.js:25160` (`addonAsRequest` calls `acceptRequest` without `queue: true`); `worker.js:24988` (`if (queue && !answered) draft.queued = true`).
- **Summary:** Only the routing route passes `queue: true`. An add-on post becomes a request that is never queued, so it is filed at once whatever else runs on the site.
- **What the customer sees:** Two requests run on one site together (for example a gallery addition beside an edit), against "one request runs on a site at a time". The later one may lose its publish turn or re-run. The chat shows two "working" lines.
- **Scenario:** Request A is running. An add-on post arrives (an edit's hand-over, an older page, or the page acting on a routing answer) with key K. `acceptRequest(..., queue defaults to false)` gives a draft without `queued`, and `advanceRequest` files K's job immediately.
- **Confidence:** End-to-end reading.

## C-3 (high) A resumed request that still has a running job lets another request start beside it
- **Where:** `builder/request.mjs:804` (`resumeInLine`), `:787` (`queueBlockers`), `:770` (`aheadInLine`); `worker.js:24769-24779`.
- **Summary:** `resumeInLine` marks the whole request `queued` even when its other parts still have live jobs. `queueBlockers` then ignores that request's real running state, because the `holdsQueue` clause only applies to `o.queued !== true`. An earlier-resumed request is therefore let out while this one is still running.
- **What the customer sees:** Two requests run on the site at once. Meanwhile the first request's running job is not read: `advanceRequest` returns early while the request is queued and never reads its job rows. Its part keeps showing "working" after its job has ended, until the other request finishes.
- **Probe (confirmed):** D is queued, resumed after a top-up, at `queuedAt` 3000. A2 has part 0 `ready` (its question just answered) and part 1 `started` with a live job, and is put back in line at `queuedAt` 4000. `queueBlockers(D, [A2, D])` returns `[]`, so D starts. `queueBlockers(A2, [A2, D])` returns `["d…"]`. This needs a request with a part running beside a paused or asking part: a `split_work` split, or `PARALLEL_WRITES=on`, which is on in production.
- **Confidence:** Confirmed by probe on the pure functions. The worker path was traced by reading.

## C-4 (medium) The "review" state hides running parts, so the line is released
- **Where:** `builder/request.mjs:2398-2402` (`settleState` checks `unverified` first) and `:747-752` (`holdsQueue` only counts `running`).
- **Summary:** One part under review (`needs_review`) makes the whole request `review`, even while another part's job is `started`. `holdsQueue` then returns false.
- **What the customer sees:** A queued message starts while the earlier request is still making changes, so two requests run at once. While that part is under review the page also shows the earlier request as "review" rather than "working".
- **Probe (confirmed):** Request A has parts `["unverified", "started"]`. `settleState` gives `review`, and `holdsQueue(A)` is `false`. Queued B with `queueBlockers(B, [A, B])` gives `[]`.
- **Confidence:** Confirmed by probe. This needs several jobs at once, which `PARALLEL_WRITES=on` allows.

## C-5 (medium) A top-up made before the first balance reading never resumes the paused part, and Continue answers "no credits"
- **Where:** `builder/request.mjs:2430-2440` (`creditsDecision`); `worker.js:25378` (`creditsStep`, called before `nextStep`, so not in the same step that records the pause); `worker.js:~25398` (`requestCredits`, the Continue button).
- **Summary:** The pause does not record the balance when it happens. The first balance reading after the pause becomes the base, so credits added before that reading count as the base and not as a top-up.
- **What the customer sees:** They see "paused for credits", top up straight away, and nothing resumes. Pressing Continue answers 409 `no-credits` because the balance is not above the base, even though they just paid. The part stays paused until they top up a second time.
- **Probe (confirmed):** The paused record has no `credits`, and the balance is already 110 after the top-up. `creditsDecision(P, 110)` returns `act: "base"` with base 110, and the next reading at 110 returns `wait`. In `requestCredits`, `bal (110) > base (110)` is false and `ready` is not set, so the answer is 409.
- **Gap:** From the job's end to the next `advanceRequest`, which is a page look, or the sweep within about 2 minutes when no page is open.
- **Confidence:** Confirmed by probe for the decision. The timing was found by reading.

## C-6 (medium) A part held on a purchase resumes without waiting in line
- **Where:** `worker.js:24751-24756` (`purchaseResolved` in `advanceRequest`), which happens before and outside `resumeInLine`.
- **Summary:** An `uncertain` part puts the request in `waiting`, which releases the line. When the purchase is resolved the part goes back to `ready` and runs at once.
- **What the customer sees:** The photo placement step publishes alongside whichever request started in the meantime.
- **Confidence:** Plausible, from reading. Same root as C-1: only the answer and credits paths call `resumeInLine`.

## C-7 (medium) An answered message that is not tied to a request part skips the queue
- **Where:** `worker.js:24988` (`if (queue && !answered)`).
- **Summary:** When `ask.answered` is true but the waiting question has no `requestKey` (an older question, or one whose slot was not a request part), the message becomes a new request that is never queued.
- **What the customer sees:** Their answer runs immediately beside the running request.
- **Confidence:** Plausible, from reading. How often a question without a `requestKey` still reaches this path under agent-only was not measured.

## C-8 (low) The agent's question expires after 24 hours, and an answer after that resumes nothing
- **Where:** `builder/request.mjs:2066` (`WAIT_MS`, `waiting` → `expired`); `worker.js:~25190` (the answer finds no waiting part and becomes `gone`).
- **Summary:** "A question the agent asks waits for the answer". In code it waits only 24 hours, then the part ends as `expired`/`unanswered`, and a later answer is shown the ended request.
- **What the customer sees:** They answer the next day and nothing happens to that work.
- **Confidence:** Confirmed by reading. Whether the owner wants a limit here is the owner's decision.

## C-9 (low) A job row in a state the module does not know leaves the part "working" for ever
- **Where:** `builder/request.mjs:2040-2042` (only `LIVE_JOB` and `ENDED_JOB` are handled).
- **Summary:** A row whose `state` is in neither list leaves the part `queued`, and nothing settles it.
- **What the customer sees:** The request stays "working" and holds the line.
- **Probe (confirmed):** `{ ok: true, state: "weird" }` leaves the part `queued`, the request `running`, and nothing filed. The database's own states are all listed today (done, failed, cancelled, lost and the live ones), so this only bites if a new state is added.
- **Confidence:** Confirmed by probe. Latent.

## C-10 (low) Removing a part of a queued request has no effect until the line clears
- **Where:** `worker.js:24769-24778` (a queued request returns before `nextStep`); `builder/request.mjs:2464` (`stopPart`).
- **Summary:** `stopParts` is recorded, but the cancellation in `nextStep` does not run while the request is queued.
- **What the customer sees:** A removed part still shows as waiting. If every part is removed, the request keeps holding the line (`holdsQueue` returns true for `queued`) until the request ahead ends.
- **Confidence:** End-to-end reading.

## Checked and found sound
- A whole-request stop cancels every part that is not running, including `credits`, `waiting`, `approval`, `recovering` and `uncertain` (their jobs have ended, so `currentJob` is null).
- A queued request that is stopped ends with no job filed.
- A cancelled row ends the request as `failed`/`stopped`.
- A row with no answer is retried once (`RETRIES`), then fails.
- `done` with no readable answer is `recovered`, not counted as success.
- A failed row with an empty body is retried once, then `unreadable`.
- A split into 2 parts with one paused for credits: the pause, top-up, `resumeCredits` and `resumeInLine` path works when the reading comes before the top-up.
- `joinableRequest` keeps paused or asking requests from taking new messages.
- `creditsPaused` excludes parts that were stopped.

## Functions read
`builder/request.mjs`:
- Planning and the queue: `newRequest`, `planParts` (call sites only), `splitParts`, `joinableRequest`, `holdsQueue`, `queuedBefore`, `aheadInLine`, `queueBlockers`, `releaseQueue`, `resumeInLine`, `appendParts` (start).
- Reading answers: `answerOf`, `askOf`, `readRun`, `answerless`, `chargedOf`, `editJobOutcome`.
- Stepping and settling: `settle` (whole), `nextStep` (whole), `settleState`, `requestMaking`.
- Credits: `creditsPaused`, `creditsAuto`, `setCreditsAuto`, `creditsDecision`, `resumeCredits`.
- Stopping and jobs: `stoppedPart`, `stopPart`, `partJobId`, `liveJobIds`.
- Questions and approval: `questionsToOffer`, `noteOffered`, `noteJobId`, `noteFilingRefused`, `answerPart`, `askedAgain`, `cancelPart`, `approvePart`, `heldFromOf`, `askedPart`.
- The view: `requestView` (first 70 lines).

`builder/request-plan.mjs`: `effectiveTargets`, `conflicts`, `applyOrder`, `clearToPrepare`, `besideConflict`, `holdsConfig`, `clearToWrite`, `paused`.

Other files:
- `builder/job-progress.mjs`, `builder/site-chat.mjs`, `builder/run-step.mjs`, `request-limits.mjs` and `rate-limit.mjs` were read whole. None of their findings bear on a customer of the request flow; a note on `clampFields` is below.
- `worker.js` call sites: `advanceRequest`, `startNextInLine`, `siteQueueAhead`, `acceptRequest`, `resumeRequestPart`, `addonAsRequest` (head), `stopRequest`, `creditsStep`, `requestCredits`, `approveRequestPart` (its calls only).

## Not finished
- **`builder/request.mjs`:** `carveParts`, `refuseCycles` and `addonSplit` were skimmed only. Not read: `settleRewrite`, `recoverHeld`, the preparation functions (`takePrep`, `notePrepared`, `readPrepStep`), `partOf`/`jobBody` and the rest of `requestView`/`oneReplyView`.
- **`builder/site-dispatch.mjs`:** export list only. It uploads site workers and is outside the request state machine.
- **`builder/request-plan.mjs`:** `inferNeeds` (rest), `stepInputs` and the `*Scope` functions were not read.
- **`rate-limit.mjs`:** note only. `clampFields` silently cuts a string longer than 20,000 characters on a public data write, and the limiter is per isolate. Neither is a request-flow finding.
