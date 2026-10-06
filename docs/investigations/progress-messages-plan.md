# Model-written progress messages during Edit and Add-on: the implementation plan (2026-10-06)

The owner, after Codex closed the release verification: *"Now prepare the
concrete implementation plan for model-written progress messages during Edit
and Add-on only. Trace the existing server job events, request driver, reply
writer and chat delivery, and identify what can be reused. The model should
naturally explain what it is doing, what it found and what happens next,
grounded in actual execution facts; ordinary progress messages must not be
hardcoded templates. Updates must persist, survive reopening or switching
devices, avoid duplicates during retries, and never claim an action finished
before it did. Keep work independent of the browser and preserve the final
reply. Explain the exact files involved, when model calls happen, expected
additional latency and cost, billing implications and focused tests. Give me
that plan before changing product code."*

**A plan, nothing built.** No product file is changed by it. First Build,
deployment, paid tests and the unrelated backlog stay out of this work.

## 1. What exists today (traced, 2026-10-06)

### 1.1 The job, while it runs

- **One body of code**: an Edit or Add-on job is the Worker's own route code.
  In the container, `builder/container-job.mjs` loads `worker.js` and calls
  `runContainerJob` → `runQueuedSiteEdit` (`worker.js:15239`), which replays
  the stored request into the edit or add-on route. A job without a container
  runs the same code inline in the Worker.
- **The execution events already exist, but only in memory**: the trace's
  `mark()` (`builder/edit-trace.mjs:171`) pushes `{p, s, ms, d}` onto an
  array. The trace is written once, when the job ends (`flushEditTrace`, one
  POST to `edit_traces`), keyed by a random `cid` with no job column, capped
  at 80 events (`MAX_EVENTS`, `:37`). Nothing is visible while the job runs.
- **The boundaries are real** (from run 103's add-on, seconds since the job
  started): `pick_adds:ok` 29.6 → `add:table:ok` 90.8 → `add:page:ok` 165.1 →
  `judge:final:ok` 234.9 → `pages:ok` 339.5 → `menu-links:ok` 339.6 →
  `publish:1:start` 339.9 → `publish:1:ok` 473.8. The edit ladder marks
  `pick_lanes`, each layer it runs (`runLayer`: data, rules, rename, nav,
  picture, logo, text, look, page), then `publish:1` (and `publish:2` after a
  correction).
- **What a client can see**: the job poll (`GET /api/site/edit/<job>`,
  `worker.js:22447-22521`) answers a running job with `status`, `phase`,
  `ms`, `cost`, `cancel`, `waiting`. Every Edit and Add-on heartbeat passes
  `p_phase: null` (`worker.js:5665`, `15114`), so `phase` reads only
  `waiting` or `stale`; the browser ignores it for edits anyway.
- **Re-runs**: the stored request object is deleted when the runner takes the
  job (`worker.js:15309`) and the queue has `max_retries: 0`, so the same job
  id practically never runs twice; a lost job is refunded and ended by the
  two-minute sweep. Within one run some phases repeat on purpose (a killed
  compile retried, `publish:2` after a correction, `judge:<kind>:again`). In
  a request, a step that ended with no answer is retried once **as a new job
  id**.

### 1.2 The request driver

- Requests live in R2 (`requests/<slug>/<key>.json`), written only on the
  etag they were read under; `advanceRequest` (`worker.js:14628`) writes only
  when something moved. Each part's work is an ordinary `edit_jobs` row.
- The browser reads `GET /api/site/request/<slug>/<key>` (`requestView`,
  `builder/request.mjs:1193`) and fetches each finished part's reply through
  the job poll. **A new field on the record itself would fight the driver
  for the record's etag**, so progress must not be stored there.
- `requestReplyFacts` already states in-progress facts for a request's own
  reply ("Being done now: …", "Queued, not started yet: …",
  `builder/site-reply.mjs:1208`, `1214`).

### 1.3 The reply writer (the closest existing pattern)

- **Facts, not templates**: `builder/site-reply.mjs` builds a fact list (ids
  by kind: changed, not-done, pending, question, note, money, undo,
  nothing). One forced tool call, `write_reply {reply, covers}`
  (`REPLY_TOOL`, `:193`), must cover every fact id; `readReply` (`:1279`)
  checks that and the length; `writeReply` (`:1310`) makes at most two calls.
- **In the background, on the server**: a queued job's reply is asked for
  after it ends (`askReply`, `worker.js:6488`, a create-only R2 record at
  `edit-replies/<job>.json` plus one queue task), written by the queue
  consumer (`runReplyTask` `:6581`, `claimReply` `:6535`, `settleReply`
  `:6565`) under a lease, with up to three attempts, and served by the job
  poll. A read never calls the model. The container asks through the job
  gateway's `/reply` (`builder/job-gateway.mjs:672`,
  `builder/container-env.mjs:269`).
- **The model**: the customer's picked model's quick model (default
  `grok-4.6`), streamed through `quickSend` (`worker.js:4062`).
- **Not charged**: *"the reply is not charged to the customer, so the ledger
  never shows it"* (`worker.js:6340`); estimated 0.4–0.6 credit per reply at
  the default model, measured only by a log line.
- **Why it cannot be reused as it is**: its rules open *"The builder's code
  has already done the work"* (`REPLY_SYSTEM`, `:218`), and its record holds
  one reply per job. Progress needs its own instructions, its own records and
  its own check.

### 1.4 The browser

- **Path A** (requests, on in production): the request card
  (`siteRequestHTML`, `public/chat.js:10044`) shows each part's words and a
  fixed status label ("Queued", "In progress", …); `siteRequestFollow`
  (`:9776`) polls with backoff from 0.9 s up to 8 s; each part's reply is
  placed with its request and deduplicated by job (`siteRequestShow`
  `:9821`, `siteReqSay` `:9733`).
- **Path B** (the page-driven job watch, still used when no request is made):
  a "Thinking" bubble (`reactLiveStepsHTML`, `:8844`) until the reply.
- **The thread lives only in the browser** (localStorage, the last 40
  messages per site), so anything that must survive another device has to
  come from the server. Requests started elsewhere are listed by the server
  (unfinished or ended within a day) when the site is opened.
- `public/edit-poll.js` admits only fixed sentences or a model reply checked
  by `modelReply` (`:210`); a new model-written kind needs its own reader.

### 1.5 What the owner has already said

- *"The browser should display progress and supply clarification"*; *"Make
  progress and questions recoverable after reopening the site or using
  another device"*; *"Report queued work as queued until it actually
  starts"* (`docs/owner-preferences.md`).
- The fixed live labels were kept on purpose on 2026-10-03 ("status, not
  replies"). This plan keeps them and adds the model's words beneath.

## 2. The design

### 2.1 Milestones: execution facts the job records as they happen

At chosen boundaries the running job records a **milestone**: what really
happened, from the step's own result, never from the request's wording.

| Path | Milestone | Recorded when | Facts (from the result) | State |
|---|---|---|---|---|
| Add-on | `picked` | `pick_adds` ok | the kinds chosen and what each is for | done |
| Add-on | `judged` | `judge:final` ok | each requirement's verdict: to build, or a suggestion | done |
| Add-on | `designed:<kind>` | `add:<kind>` ok | e.g. the table's name, columns and who may read or send; the page's route and purpose | done (designed, not yet applied) |
| Add-on | `schema` | `schema` ok | the tables now in the database | done |
| Add-on | `pages` | `pages` ok, then `menu-links` ok | the pages written, the menus that gained a link | done (in the source, not live) |
| Edit | `found` | `pick_lanes` ok | what kind of change, on which page, which element | done |
| Edit | `changed:<layer>` | each `runLayer` that applied | what changed in the source (e.g. `changed`, the layer's own account) | done (not live) |
| Both | `publishing` | `publish:1` start (and `publish:2`) | that publishing has started | **doing** |

Rules:
- **Done means done**: a milestone is done only after its effect returned
  ok (the design returned, the schema applied, the page stored). Publishing
  is recorded only as **started**. **There is no "published" or "finished"
  milestone**: being live is said by the final reply alone, as today.
- **What happens next** comes from the job's own plan at that moment (the
  kinds still to make, the pages still to write, that publishing follows),
  passed as `next` facts, never as done.
- **Queued stays queued**: nothing is recorded before the job starts, so the
  card keeps "Queued" until then.

### 2.2 Records, keys and retries

- **One R2 object per milestone**: `edit-progress/<job>/<nn>.json`, written
  create-only (`etagDoesNotMatch:"*"`), where `nn` is the milestone's order in
  the run and repeated phases count up (`publishing` for `publish:1`, then
  again for `publish:2`). The same run gives the same keys, so a duplicate
  write is refused and never queued twice.
- **The record**: `{v, job, n, stage, at, facts, next, state, text?, says?,
  attempts, lease?, retryAt?, why?}`, with states `pending | writing |
  written | merged | skipped | failed`, read strictly like `readReplyRecord`.
- **An index for readers**: after a message is written, the writer updates
  `edit-progress/<job>/index.json` (etag compare-and-swap) with the written
  messages in order, so a poll reads one object, not a listing.
- **A request step retried as a new job** keeps its own progress under its
  own job id: the first job's messages stay true (it was doing that), and the
  new job's follow.
- **The same job id run again** (only possible if a runner died between the
  takeover and the delete): its milestones meet the same keys, so nothing is
  doubled; first write wins.

### 2.3 Writing the message (the model calls)

- **Asked, not awaited**: recording a milestone is one small write and one
  queue task (`{kind:"edit-progress", id, n}`), the pattern of `askReply` and
  `sendReplyTask`. The job carries on at once; it never waits for the model
  and never fails because of it.
- **Written by the queue consumer** (`runProgressTask`, beside
  `runReplyTask`), under a claim and lease like `claimReply`/`settleReply`,
  with the same model transport and model as the final reply (the customer's
  picked model's quick model; `grok-4.6` by default).
- **Coalesced so nothing is lost and calls stay few**: one writer per job at a
  time. If more milestones arrived while a message was being written, the
  next call writes **one** message covering all of them and marks the others
  `merged` into it. A lost task is recovered by the next milestone's writer,
  which picks up every unwritten one.
- **Stops at the end**: once the job's final reply has been asked for,
  unwritten milestones are marked `skipped` and no further call is made. The
  final reply is the account of the outcome.
- **What the model is given**: the customer's words, the site's name and
  pages (as `replyContext` gives them), every done milestone's facts so far,
  the new milestone(s), the `next` facts, and the progress messages already
  written (so it does not repeat itself), in the customer's language.
- **What it must return**: a forced tool call, `write_progress {text,
  says}`, where `says` lists each fact id it used and how it described it:
  `done`, `doing` or `next`.

### 2.4 Never claiming an action finished before it did

Checked in code (`readProgress`, the analogue of `readReply`), not by
matching words, so it holds in any language:
- every new fact id is in `says`;
- each fact is described as its true state: a `doing` or `next` fact
  declared `done` is a refusal;
- no `[id]` in the text, and a length cap (about 400 characters);
- **one retry**, told what was wrong (as `writeReply` does); a second
  failure writes nothing (`failed`), and the fixed status label stays.

The instructions say it plainly: only done facts may be called finished; the
current step is still running; next steps are plans; never say the change is
live or published, because the final reply will. The only fixed wording in
the feature is those instructions; every message is the model's.

### 2.5 Reading and showing them

- **The job poll** (`worker.js:22447-22521`) adds `progress: [{n, at,
  text}]`, the written messages in order, to the running answer and to the
  finished one (for reopening), from the index. The final reply's fields are
  untouched.
- **The request GET** (`worker.js:22539-22606`) joins each live or finished
  part's job progress at read time, so `requestView` carries it without the
  record ever being written for it. `requestView` takes the joined map as an
  argument and stays pure.
- **The browser**:
  - `public/edit-poll.js` gets `progressLines(body)`, which admits only
    well-formed entries (`n`, `at`, model text within the cap), beside
    `modelReply`;
  - Path A shows the lines in the request card under the part they belong
    to, beneath its fixed label, keyed by `job:n` so a repeated poll never
    draws one twice;
  - Path B shows the latest line in place of "Thinking", the way
    `waitNote` already replaces it;
  - **they are never saved as thread messages**, so the 40-message history
    is untouched: every view (a reload, another device) reads them from the
    server again;
  - when the part's final reply arrives, its progress lines stay above it,
    muted, and stop changing. The final reply is placed exactly as today.

### 2.6 Independent of the browser

The job records milestones, the queue consumer writes the messages, and the
records live in R2. Nothing depends on a page being open: a customer who
closes the tab and opens the site on a phone later sees the same messages,
through the request list and the job poll.

### 2.7 The switch

`PROGRESS_REPLIES`, read like `MODEL_REPLIES`, **off** by default (an
optional secret with an `|| 'off'` fallback in `deploy.yml`). Off: no
milestone is recorded, no task is sent, and every answer is byte for byte
what it is today.

## 3. The files

| File | What changes |
|---|---|
| `builder/site-progress.mjs` (new) | the milestone table (stage → facts from the step's result, state, next), the record reader, the coalescing decision, the writer's instructions and `write_progress` tool, `readProgress`'s checks, the constants (cap, attempts, lease). Pure, no I/O, tested alone |
| `worker.js` | a progress recorder made where the edit (`ed` branch, from `:23208`) and add-on (`aMark`, `:28773`) traces are made, called at the boundaries in §2.1; `askProgress` (create-only write and queue task); the queue branch for `edit-progress` beside the reply task, and `runProgressTask`; the job poll and the request GET adding `progress`; the Worker side of the gateway's `/progress`; retention beside the reply records in `runJobRetention`; the switch |
| `builder/job-gateway.mjs` | a `/progress` route (beside `/reply`, `:672`), the job's identity from the gateway, never from the body |
| `builder/container-env.mjs` | `env.JOB_PROGRESS` (beside `JOB_REPLY`, `:269`) |
| `builder/request.mjs` | `requestView` takes an optional progress map and adds each part's lines |
| `public/edit-poll.js` | `progressLines(body)` |
| `public/chat.js` | the lines in `siteRequestHTML`; Path B's bubble in `reactLiveStepsHTML`; the follows passing them through (`siteRequestFollow`, `watchEditJob`) |
| `public/styles.css` | one muted line style (shown to the owner as screenshots) |
| `.github/workflows/deploy.yml` | the `PROGRESS_REPLIES` secret with its `|| 'off'` fallback |
| docs | `docs/request-flow.md`, `docs/edit-path.md` (the reply section), `docs/containers-and-jobs.md` (the gateway route), a history file |
| tests | new `test/progress-*.test.mjs` files (§6) |

Not touched: the final reply's facts, instructions, records and placement;
billing; the request driver's decisions; first Build.

## 4. When the model is called, the added time, and the cost

### 4.1 Calls

- **One call per message, coalesced**: about **3–6 per add-on job** (picked,
  judged, designed, pages, publishing; close milestones merge) and **1–3 per
  edit job** (found, changed, publishing). Run 103's request would have made
  about 5–7.
- **Never during routing, a question or a refusal**: only a running Edit or
  Add-on job records milestones.
- **None after the final reply is asked for.**

### 4.2 Added time

- **On the job itself: almost none.** A milestone is one gateway call (one
  R2 write and one queue send, about 50–200 ms, not awaited by the job's
  work). Nothing waits for the model.
- **From milestone to screen**: about 3–15 s: the queue picks the task up in
  about 0.5–2 s, the call takes about 1.5–5 s at `grok-4.6` (about 1.2–2k
  tokens in, 60–150 out), and the page's next poll comes within 0.9–8 s.
- **For an add-on like run 103's** (about 8 minutes): messages at roughly 30
  s, 90 s, 165 s, 235 s and 340 s instead of nothing until the reply.

### 4.3 Cost (estimates, to be measured)

- **About 0.15–0.35 credit per message at `grok-4.6`**, judged from the
  final reply's 0.4–0.6 with its larger instructions and longer answer: about
  **0.5–2 credits per add-on job and 0.2–1 per edit job**. A customer who
  picked a Claude model costs several times more.
- **Measured** by a log line per call (kind, attempts, tokens in and out,
  milliseconds), like the reply's (`worker.js:6344`). The first live press
  after the build reads it.

## 5. Billing

- **Recommended: absorbed, like the final reply.** Not charged to the
  customer, no ledger row, no reserve, no refund. The job's cost and its
  ledger rows are exactly what they are with the switch off. A failed or
  skipped message changes nothing in the money.
- **The alternative, the owner's to choose**: charge progress as a job
  reserve of its own (another `<job>#n`). That ties progress to the refund
  rules (a refunded job would refund it too) and makes a failed message
  something to account for. The open question about charging for replies
  (MR2) is the same question; deciding both together is simplest.
- **A cost bound without cutting**: coalescing keeps calls to the number of
  pauses, not milestones, and nothing after the final reply. No milestone is
  dropped to save cost; at worst several are merged into one message.

## 6. Focused tests

- **The milestones** (pure, from real producers' outputs): each stage's facts
  come from the step's own result (fixtures captured from `pickAdds`,
  `runAdd`, the layers and the publish marks); `done` only after the effect
  returned ok; `publishing` only ever `doing`; no `published` milestone
  exists; repeated phases get their own keys; the same run gives the same
  keys.
- **The check**: `readProgress` refuses a missing fact id, a `doing` or
  `next` fact declared `done`, an `[id]` in the text and an overlong text;
  one retry is told why; a second failure writes nothing.
- **Coalescing and order**: milestones arriving during a write become one
  next message; none is lost; the index stays in order; after the final reply
  is asked for, the rest are `skipped` and no call is made.
- **Records and claims**: a duplicate milestone write is refused and sends no
  second task; a task delivered twice makes one model call; a live lease
  keeps a second writer out; a retry waits for `retryAt`.
- **Through the real routes, with supplied model answers** (the existing
  route harnesses): an add-on run records its milestones in order with the
  real results' facts; an edit run likewise; a run that fails part-way (e.g.
  the schema refused) records nothing done that was not done, and its failure
  reply is byte for byte as it is today.
- **The job poll and the request GET**: running answers carry the written
  lines in order; finished answers carry them plus the final reply, whose
  fields are unchanged; the request GET writes nothing for progress (the
  record's etag unchanged by a read).
- **The money**: no ledger row from progress; a job's cost identical with
  the switch on and off; a writer failure leaves the job's outcome and money
  unchanged.
- **The switch off**: no record, no task, and every answer byte for byte as
  today.
- **The browser, in a real Chromium against pages served in the test**: the
  lines appear under the right part once across repeated polls; a reload and
  a fresh browser (another device) show them again from the server; the
  40-message thread is unchanged; the final reply is placed as today and the
  lines stop changing; Path B's bubble shows the latest line instead of
  "Thinking"; screenshots for the owner.
- **A sweep** over the new module and its wiring, with comment-only controls,
  and the full suite.

## 7. Order of work, and what it needs

1. `builder/site-progress.mjs` and its tests.
2. The records, the writer and its queue branch, with tests.
3. The recorder at the boundaries in the two routes, with route tests.
4. The poll and the request GET.
5. The browser, with screenshots.
6. Records, the sweep, the suite, CI, and a push for review. **No merge,
   deploy or paid test**: those wait for the owner's word, as always.

## 8. Decisions for the owner

1. **Billing**: absorb (recommended) or charge (§5).
2. **The model**: the customer's picked model (recommended, as for replies)
   or always the fast default, which bounds the cost.
3. **After the reply**: keep the written lines above the final reply, muted
   (recommended), or hide them once it arrives.
4. **Path B**: include the page-driven watch (recommended; small), or
   requests only.
5. **The fixed labels**: keep them beside the model's lines (recommended), or
   let the lines replace them.
