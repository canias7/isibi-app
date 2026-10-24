# 2026-10-24 — A model provider that is down is waited for (branch `provider-retry`, not merged, not deployed)

The owner's design, in `docs/plans/2026-10-24-model-failures.md` (on `rec-2265b`):
only the provider-side kinds (503, 502, 504, 500, 429, a dropped connection,
and an error sent inside the stream with no status, e.g. xAI's `unavailable`)
are retried. Only the call that failed is sent again, every 5 minutes, with no
attempt count. Past the job's deadline the job is parked and the tick resumes
it. The customer sees a fixed grey notice, never one a model writes. Nothing
was spent, no model was called, and nothing was written live.

## 1. What changed

- **`builder/provider-retry.mjs` (new, in both Dockerfile COPY lines).**
  `providerFailure` decides what is retryable and maps the provider's word to a
  code (`unavailable` → 503, `overloaded` → 529, rate limited → 429). It never
  retries: billing or quota (even on a 429), 401/403, 400, 404, 402, our own
  timeout, our own missing-key sentence, or a cut-off answer.
  `withProviderRetry` waits 5 minutes (a 429 waits longer if the provider asks)
  and has no attempt count. With a deadline, it waits only while
  `now + wait + 3 min ≤ deadline`. Otherwise it **parks**: it rethrows the
  call's own error marked `parked: true` with `providerWait`
  (`{facts, notice, resumeAt}`), so existing handling still reads status and
  detail. With no deadline it parks at once and never sleeps. Stop is read
  every 10 s while waiting. The module also holds the notice texts, exactly as
  the owner wrote them, plus `panelRow`, the park record, and `wakeDecision`
  (the tick's choice).
- **`builder/build-call.mjs`.** `patientCall` takes `wait` and wraps itself in
  `withProviderRetry`. This reverses A23-3 for the retryable kinds, and the
  comment cites the owner. A 429's `retry-after` header is now kept on the
  error. `retryHere` still refuses: the retry happens where the call failed,
  every 5 minutes, and is never bought a second time straight away from the
  Worker.
- **`worker.js`.**
  - `callBuilderModel` is used for routing, every rung, the add-on judge and
    designers, compile repair, the security scan and the talk. It goes through
    the wait, along with `pagesCall` (the page writer) and the container
    fallback.
    - The deadline is `JOB_DEADLINE_AT` (container jobs).
    - Stop is `JOB_STOP` plus the job's cancel.
    - The job's sink (`PROVIDER_WAIT`) writes the notice to
      `jobs/<id>.wait.json`.
    - The job's journal (`CALL_JOURNAL`, `jobs/<id>.calls/<key>.json`) answers
      every call a resumed job already finished.
  - `runQueuedSiteEdit` (edits, add-ons, request parts) and
    `runQueuedSiteBuild` park a job whose call parked:
    - its stored request is put back;
    - the record goes to `jobs/waiting/<id>.json`;
    - the lease is held under the job's own name for 600 s;
    - nothing is finalized, refunded or moved on.
  - A resumed job reads Stop before anything runs. "Stopped. Nothing was built
    or charged for this part." is followed by the normal refund.
  - `runProviderWaits` runs on the 2-minute cron. It resends due jobs under the
    holder's name and drops the record of a row that has ended.
  - The routing route answers `{waiting, wait, cost: 0}` when the router's
    provider is down. Nothing is routed, run or charged.
  - The job polls (`/api/site/edit/<id>`, `/api/site/build/<id>`) and the
    request view (each open part) carry `wait`.
  - The add-on's `aDown` keeps `providerError` (the parsed type and capped
    words) and `wait`.
- **`builder/site-ask.mjs`.** `routeMessage`'s fallback carries the notice.
- **`builder/request.mjs`.** `readRoute` reads a waiting answer as `waiting`.
  A part routed while its provider is down is routed again with no count,
  never marked `routing-failed`.
- **`builder/design-repair.mjs`.** The design's one transient retry is folded
  in: a parked or stopped call returns `{kind: "waiting", retry: null}`.
  Waiting already happens inside the call.
- **`builder/build-server.mjs`.** The container's `/model` service waits
  inside the call until its own cap and shows the notice on `/model/result`,
  which the Worker's poll passes to the job's sink.
- **The page** (`public/edit-poll.js`, `public/chat.js`, `public/styles.css`):
  - the grey box (`noticeHTML`), with one page-wide countdown timer;
  - on the chat thread: routing waits, with an automatic resend when the
    countdown ends and then the recovery line;
  - on the job's thread;
  - on the job card;
  - on the request part's panel row ("⚠ Events page · Grok 503 · retrying in
    4:59");
  - only status.x.ai and status.claude.com are allowed as links.

## 2. Coverage by path

| Path | Waits in-job | Parks + tick resume | Notice reaches page |
|---|---|---|---|
| Routing (the request's own call, inline) | parks at once | the page resends after the countdown | chat box |
| A request part's routing job | yes (container deadline) | yes | panel row |
| Edits, every rung (via `callBuilderModel`/`pagesCall`) | yes | yes | job thread, job card |
| Add-ons (judge, designers, writer) | yes | yes | job thread, panel row |
| Request parts (edit/add-on jobs) | yes | yes, dependents stay waiting | panel row |
| First build, queued/container | yes | yes (job kept, resent by holder) | build poll → thread |
| First build, inline | parks at once (no deadline) | no job to park: existing failure handling, with the notice on the error | — |
| Compile repair, visual review, security scan | yes (via `callBuilderModel`) | through their job | through their job |
| Container `/model` page writing | yes, inside the service until its cap | the service's failure, as before | via `/model/result` → job sink |
| Replies/progress writers | yes (they use `callBuilderModel`); a failed writer still falls back | not needed | — |

## 3. Limits, stated

- **The site is held for the wait, not freed.** The row's lease stays under
  the job's name (600 s, the claim RPCs' ceiling) so that the lost sweep does
  not refund and close it. The container is freed. Truly freeing the site
  needs a `waiting` row state in SQL (not written).
- The journal matches a call by its exact request. A request that differs on
  resume (for example a timestamp in its prompt) is asked again, which costs
  model spend but not customer credits: the edit reserve is idempotent per
  job/seq, and the build debit is idempotent by ref.
- A parked build's stored token can expire if the outage outlasts it.
- A part's job stopped with DELETE `/api/site/edit/<id>` is re-filed by the
  request driver (existing behaviour). The part's own Stop works.
- Nothing has been shown live (no paid runs).

## 4. Tests, red check, sweep, suite, image

- `test/provider-retry.test.mjs`: 14 cases (classification, exact texts, 429
  wait, the real call with an in-stream `unavailable`, 429 retry-after,
  dropped connection, non-retryable thrown once, park, Stop, tick decision,
  routing waiting, the page's renderer).
- `test/provider-retry-request.test.mjs`: 3 cases through the real request
  flow:
  - **PRQ1 (Saltmarsh):** the Events add-on hits 503 mid-job, parks, and its
    dependent waits. The carved part's routing hits it twice. Then everything
    finishes, each job charged once, and the judge is asked exactly twice.
  - **PRQ3:** the request's own routing call waits at no cost.
  - **PRQ2:** Stop while parked ends the part with no charge.
- Updated guards: `test/lane-stream.test.mjs` and
  `test/container-transport.test.mjs` take the new pass-throughs.
  `test/fixtures/request-flow.mjs` lets a case answer with a provider
  `Response`.
- **Red check** (the new tests over `origin/main` 692087cde, with the new module
  copied in so the imports resolve): 7 of 16 fail. These are PR7, PR8, PR10,
  PR13, PR14, PRQ1 and PRQ2; PRQ3 was added after the red run. The 9 that pass
  test only the new module itself.
- **Sweep**, from a verified-green baseline: 18 of 19 mutants killed, and the
  comment-only control survived. The deadline mutant was killed by a hang: the
  focused run timed out. **The survivor is "Stop not read inside a wait"**:
  PR11's stub sets Stop during the sleep, and the loop's own check before the
  next try catches it. It is a second safety check, recorded rather than
  widened.
- **Full suite** (12,487 tests): 12,478 pass, 3 skipped, 6 fail.
  - 3 were mine and are fixed: the source-read leaf guard
    (`test/container-model.test.mjs`, updated to allow the leaf
    `provider-retry.mjs`), the browser watcher's cut-out scope
    (`test/addon-failure.test.mjs`, the new calls now guarded with `typeof`;
    135 of 135 pass), and `test/container-images.test.mjs`, which needs the new
    file committed.
  - 2 were load flakes: `build-queue-wiring` and `written-frame-edit` both
    pass on their own (13 of 13 and 16 of 16).
- Screenshots: chat, panel row, job view, and the recovery and Stop lines, in
  the session scratchpad `shots-retry/`.
