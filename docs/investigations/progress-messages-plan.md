# Model-written progress messages during Edit and Add-on (2026-10-06)

**Built on `claude/help-needed-ehlwlj`, off by default, not merged, not
deployed, no image built, no paid test run.** The plan was written first (its
trace is §1, unchanged); the owner then approved it with corrections, and the
design sections below describe what was built. Where the build departs from
the first plan, the section says so. **The wording round** (the owner's
clarification after the first build: first person, and each task named by the
model's own line for the state it is in) is §2.10.

The owner's request for the plan: *"Now prepare the concrete implementation
plan for model-written progress messages during Edit and Add-on only. …
The model should naturally explain what it is doing, what it found and what
happens next, grounded in actual execution facts; ordinary progress messages
must not be hardcoded templates. Updates must persist, survive reopening or
switching devices, avoid duplicates during retries, and never claim an action
finished before it did. Keep work independent of the browser and preserve the
final reply."*

## 0. The owner's go-ahead, decisions and corrections (2026-10-06)

The go-ahead, in full: *"Proceed with model-written progress for Edit and
Add-on using the recommended defaults: the existing selected quick model,
platform-absorbed narration cost, progress retained above the final reply,
both request and standalone-job paths, and fixed status labels alongside
natural model-written messages. Incorporate these corrections into the plan
and implementation: do not claim that matching says metadata proves the prose
truthful; ground the model in verified facts, distinguish designed, saved,
applied and published outcomes, test contradictory prose with otherwise valid
metadata, and document the remaining model limitation without adding
keyword-based message filters. Define one writer per job with recoverable
persistence, queue delivery and index updates; recovery must work without
another milestone or an open browser. Tie background recording to the
existing Worker/container task lifecycle rather than detached promises. Check
authoritative job state and writer ownership before starting and committing
narration so completion, failure, cancellation or a newer attempt cannot
produce stale updates after the final reply. Make cross-device discovery work
for both supported paths and state the actual retention window. Preserve
execution, publishing, customer charges and final replies. Keep instructions
concise rather than relying on an arbitrary short character limit that
silently suppresses useful updates. Add focused tests for these races,
interrupted writes, duplicate delivery, ambiguous or false completion claims,
reloads and a fresh device; log actual model attempts, tokens and latency
rather than promising exact call counts. Keep the feature off by default,
push the implementation and evidence for review, and update owner-notes. No
merge, deployment, container image build, paid test or unrelated backlog
work."*

**The five decisions of §8, all taken as recommended:**

| Decision | Taken | Where |
|---|---|---|
| The model | the customer's selected quick model (`modelsFor(picker).quick`; `grok-4.6` by default) | §2.4 |
| Billing | absorbed by the platform: no ledger row, no reserve, no refund | §5 |
| After the reply | the lines stay above the final reply, muted | §2.7 |
| Paths | both: a request's parts (Path A) and the page-filed standalone job (Path B) | §2.7, §2.8 |
| Labels | the fixed status labels stay; the model's lines are drawn beside them | §2.7 |

**The corrections, and where each is met:**

| Correction | What was built |
|---|---|
| Matching `says` does not prove the prose truthful | §2.5: the check reads what the model **says it did**, never its words. An update whose `says` is right and whose words claim the page is live **is committed**; this is the stated limitation, pinned by two tests (PROSE 1, CLAIM 3), with no keyword filter |
| Ground the model in verified facts; designed, saved, applied, published told apart | §2.1: facts come from each step's own result, with seven states. **"Saved" cannot be reported separately on this path** (§2.1 says why), so a page is "prepared" until its publish starts; **"published" has no state at all**: only the final reply says it |
| One writer per job; recoverable persistence, queue delivery, index updates; recovery with no other milestone and no browser | §2.2–§2.4, §2.6: one record per job, changed only by compare-and-swap on its etag, which is also its own index; one writer at a time under a lease; recovery by the writer's own re-ask and by the two-minute cron |
| Tie recording to the Worker/container task lifecycle, not detached promises | §2.3: every write is registered with the invocation's `ctx.waitUntil`; the job's end waits for them and closes the record **before** the outcome is written |
| Check job state and writer ownership before the call and before the commit | §2.5: the job's row is read fresh before the call and again before the commit; the commit needs a live lease of its own on an open record. One residual window is stated |
| Cross-device discovery on both paths; the real retention window | §2.8: requests as before, standalone jobs on the requests list; seven days after the record's last write, with the rotation's real caveats |
| Execution, publishing, charges and final replies preserved | §5, and the SAME test (identical work, money and final reply with the switch on and off) |
| Concise instructions; no arbitrary character limit | §2.4: no length is checked or cut anywhere; the call's output budget is not a cut (an answer that reaches it is retried, never shortened) |
| Focused tests for races, interrupted writes, duplicates, false claims, reloads and a fresh device | §6 |
| Log attempts, tokens and latency; promise no call count | §4 |
| Off by default | §2.9 |

**The wording clarification, after the first build** (2026-10-06), in full:
*"One wording clarification: make the assistant's task summaries and progress
updates conversational and first-person. “Change the Gallery heading” reads
like a command; I want the tone of “Okay, I’ll update the Gallery heading” or
“I’m updating it now.” These are tone examples, not templates. Let the model
generate the wording naturally from context, matching whether the work is
planned, happening or finished. Don’t add hardcoded prefixes to the user’s
words."* What was built for it is §2.10: one first-person rule in the progress
lines' instructions, and each task's title written by the model in every state
it can be in, the state chosen by code from the status. Neither set of
instructions quotes the owner's examples, and nothing is put before the
customer's words.

## 1. What existed before the build (traced, 2026-10-06; line numbers as of `fa3a25ad`)

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

## 2. The design, as built

### 2.1 Milestones: what really happened, in seven states

At chosen points the running job records a **milestone**: a list of facts,
each written by code from that step's own result, with a state. The model
only puts them into words.

| Path | Milestone | Recorded when | Facts |
|---|---|---|---|
| Edit | `plan` | the steps are chosen, before any runs | **decided**: what will change, in the builder's terms (a withheld step is not a plan); **next**: make it |
| Edit | `publish` | the first publish starts | per step that worked, **prepared** (a page change) or **applied** (a `data` or `rules` change, which is in the database already); per step that failed and was not made good by a later one, **notdone**; **doing**: publishing |
| Edit | `correct` | a correction of a style rule starts | **doing**: correcting |
| Edit | `publish` | the second publish starts | **doing**: publishing again |
| Add-on | `picked` | the kinds are chosen | **decided**: what will be added; **next**: design it |
| Add-on | `designed` | each kind's design returns | **designed** (not built), with its name, place and columns where the design has them; **next**: the next kind, or building |
| Add-on | `schema` | the database change applied | **applied**: the tables made or changed, functions, timed tasks; **next**: the pages |
| Add-on | `pages` | the pages are written | **prepared**: the pages, not published; **next**: publishing |
| Add-on | `publish` | the publish starts | **doing**: publishing |

**The states**, as the model is told them:

- `decided`: worked out what to do; nothing has changed yet.
- `designed`: designed; nothing has been built yet.
- `prepared`: made in the builder but not published; visitors cannot see it.
- `applied`: in effect in the site's database.
- `doing`: happening now; not finished.
- `next`: planned; not started.
- `notdone`: could not be made; the final message will say why.

**Why "saved" is not its own state.** A page's change is kept in memory until
the publish, which stores the source and publishes it as one step
(`publishSpine`). There is no moment between "written" and "publishing" when
the source is saved and the job could say so. So a written page is
`prepared` until its publish starts, and the publish is `doing`. A database
change is `applied`, because it is.

**Why there is no "published" state.** Whether the site went live is said by
the final reply alone, written from the job's outcome as before. A progress
line can say only that publishing has started.

**Queued stays queued**: nothing is recorded before the job starts, so a
card shows "Queued" until then.

### 2.2 One record per job, which is its own index

*Changed from the first plan*, which had one object per milestone plus an
index object: that was two things to keep in step. Now:

- **One object per job**: `jobs/<id>.progress.json`. It holds the job's
  owner, site, kind, the run that opened it, the customer's words, the
  picked model, the site's pages, the milestones (each `pending`, `said`,
  `skipped` or `failed`, with its facts), the written lines, the writer's
  lease, the try count, the retry time, the last ask, and whether it is
  closed and why.
- **Read strictly** (`readProgressRecord`): one milestone, fact or line that
  does not read makes the whole record unreadable, never shorter, and
  nothing is written over a record that does not read.
- **Changed only by compare-and-swap** (`progressUpdate`): read, decide on
  what was read, write on that etag; a write that loses to another is
  decided again on what that one left, six times, then given up and logged.
- **It is its own index.** A reader reads one object; there is no second
  object to update or to fall out of step. Jobs themselves are found from
  `edit_jobs`: the poll by id, discovery by owner and site (§2.8).
- **Duplicates**: the recorder numbers each milestone (`seq`); a write made
  again because its first answer was lost finds its number on the record and
  adds nothing (`already`). Fact ids come from the record's own counter, so
  they never repeat within a job.
- **A bound real jobs do not approach**: a record takes at most 200
  milestones (an edit records at most four, an add-on four plus one per kind);
  a 201st is refused and logged.

### 2.3 The recorder, on the job's own lifecycle

- **Made where the job is claimed** (`makeProgress` in `runQueuedSiteEdit`)
  and carried on the job's context (`makeJobCtx`), so the edit and add-on
  routes record through `eJob.progress` / `aJob.progress`. Null with the
  switch off.
- **No detached promise**: the writes run one after another on one chain,
  and each is registered with the invocation's `ctx.waitUntil` (the
  Worker's, or the container's, which drains before the process exits). The
  job's work never waits for a write, and a write can never throw into it.
- **The job's end closes the record before its outcome is written**:
  `close("ended")` after the work and before `edit_finalize`, and
  `close("failed")` in the failure path before the refund. The close waits
  for the milestones already on their way, bounded at 10 seconds so a store
  that hangs cannot hold the job's outcome. Every route returns its failures
  as an answer (a failed store read or write, a refused call, a missing key:
  each tried, none throws), so the second close is the backstop for an
  exception nobody expected; its place before the refund is held by the
  source (THREW).
- **In the container**, which has no queue, the writes go through the job
  gateway's `/progress`, under the job's own token: its id, site and owner
  come from the token, never from the body; a pre-scoped build is refused
  (403); the body is bounded at 1 MiB (413); only `begin`, `mark` and
  `close` are accepted (400).
- **A record that did not open** is opened again before the next milestone,
  so one failed write at the start does not cost the job its lines.

### 2.4 The one writer, and the call

- **One queued task per job at a time** (`{ kind: "edit-progress", id, uid }`),
  run by the queue consumer (`runProgressTask`).
- **The lease** (`claimWriter`): 135 seconds (the call's 75-second deadline
  plus a minute). Another writer's live lease keeps a second out; a writer
  whose claim landed but whose answer was lost finds the lease its own. A
  try is counted at the claim, so a writer that dies counts too. After two
  tries, what waits is given up (`failed`, reason kept) with no call.
- **When a writer is asked for** (`writerNeeded`): only when a milestone
  waits, no lease is live, no retry is due, and no ask is within its
  60-second grace. The ask is written on the record before the message is
  sent, so two that ask at once send one.
- **One line covers everything waiting** (`batchFor`): the settled facts of
  every waiting milestone, and "doing" and "next" only from the last (an
  earlier "publishing now" is no longer true once a correction began).
- **The model**: the customer's selected quick model; one forced tool call,
  `write_progress { text, says }`. It is shown their site, its pages, their
  words, the lines already written, and each fact as `[fN] (state) text`.
- **The instructions are short** (`PROGRESS_SYSTEM`, 1,490 characters):
  the model is the website builder telling the customer itself; the seven
  states; **the first person, naturally and conversationally — next facts as
  what it will do, doing facts as what it is doing now, the rest as what it
  has done or could not do** (the wording round, §2.10); describe each fact
  as its state says and nothing else; never say or suggest anything is
  published or live or that the request is finished; do not repeat earlier
  lines; the customer's words and language; "usually a sentence or two"; no
  worked example.
- **No character limit.** Nothing measures or cuts the text. The call's
  output budget (1,000 tokens) is the transport's, not a cut: an answer that
  reaches it is read as cut and tried again, never shortened.
- **A wrong answer is asked once more**, told what it left out, misstated or
  put an id in. A second failure, or an unreadable answer, is a failed try:
  tried again 20 seconds later (one more try), then given up. Per batch:
  at most two tries of at most two calls.
- **Up to eight lines per task**; then the writer asks again for whatever is
  left, so nothing it leaves waits for another milestone or a page.

### 2.5 What may be committed, and what is checked

**The job's row decides** (`jobVerdict`, read fresh from `edit_jobs` with the
service key, **before the call and again before the commit**):

| Row | Verdict | Result |
|---|---|---|
| running, under the run that recorded the milestones, lease live | ok | the call, or the commit |
| could not be read | unread | a failed try (tried again later), never "gone" |
| missing, or another owner's | gone | the record closed |
| done, failed, cancelled or lost | ended | the record closed |
| cancel asked for | cancelled | the record closed |
| held for review | review | the record closed |
| another run holds it | superseded | the record closed |
| its lease ran out | stalled | the record closed |

**The commit itself** (`commitLine`) needs the writer's own live lease on an
**open** record, on the etag the commit read. The job's end closes the record
first, so a commit read before the close loses the compare-and-swap, and one
read after it finds the record closed.

**The remaining window, stated.** If the job's own close fails (the store
fails, or 10 seconds pass), the writer's second row read is the only guard
left. A writer that passed that read just before the job finalized can then
commit one line after the outcome is written: one store write's time. The
line was true when checked (its facts were recorded during the run), but it
would stand after the final reply. Not removed; recorded here.

**What the check of the model's answer proves, and what it does not.**
`readProgress` checks the model's own account of what it described: every
fact's id in `says`, each in its true state, no fact in two states, no id in
the words, words not blank. **It does not read the words.** An update whose
`says` is exactly right and whose words say the page is live passes, and is
committed: PROSE 1 pins it on the module, CLAIM 3 through the route. What
stands against it: the instructions forbid it; no fact ever carries a
published state; and the final reply, written from what happened, follows.
**No keyword filter** reads the words (the owner's instruction). How often a
real model does this is not measured: no paid test has run.

### 2.6 Recovery, with no other milestone and no page

- **The writer asks again** for whatever it leaves waiting, at the end of
  every task (`askProgress`).
- **The two-minute cron** (`runProgressSweep`) reads up to 50 running edit
  and add-on jobs (newest first) and asks for a writer wherever a milestone
  waits and nobody is on it: a lost queue message, an evicted writer, a
  retry whose message never came.
- **A writer that died after its claim** holds the record until its lease
  runs out (135 seconds); then the cron asks, a new writer claims, and its
  try counts against the two.
- **A milestone write whose answer was lost** is made again by the store's
  own loop and recorded once (`already`), and a writer is asked again when
  none holds the record.
- **Its limit**: the cron reads 50 running jobs per tick; on a platform with
  more than 50 running at once, the rest wait for a later tick in which they
  are among the 50 most recently updated.

### 2.7 Reading and showing them

- **The job poll**: a running job's answer carries `progress: [{ n, ms,
  text }]` (each line with how far into the job it came); a finished job's
  stored answer carries them too (`withProgressLines`), so a page that missed
  the last of them, or reopens it, still has them. The final reply's own
  fields are unchanged.
- **A request's read and the requests list** join each run job's lines at the
  look (`progressForRequest` → `requestView`), never written onto the
  request, so the driver's etag is never fought for them.
- **The page**:
  - `EditPoll.progressLines` reads well-formed lines and drops the rest,
    with no length limit;
  - **Path A**: each part's lines under its fixed label, the newest marked
    live while it runs, muted once it ended, above its reply;
  - **Path B**: while the page watches its own job, the newest line where
    "Thinking" was (a waiting sentence keeps its place first); at the end,
    the lines are kept on the reply (`m.prog`) with the job named on it
    (`m.jobs`), drawn muted above it;
  - **never thread messages of their own**: the 40 kept messages are
    untouched, and every reading of the server draws the lines again.

### 2.8 Another device, and how long it lasts

- **Path A**: requests are listed by the server as before (unfinished, or
  ended within a day), each part with its lines.
- **Path B**: the requests list now also carries `jobs`: this owner's
  standalone edit and add-on jobs on the site, running or ended within 24
  hours, whose record opened — each with its words, its state and its lines.
  The list holds the most recent 20. A page that does not already show one
  (its own watch, the job it remembers, a reply it shows or holds, a card)
  draws a card where it falls in time: the words, a fixed label ("Queued",
  "In progress", "Finished", "Not done", "Stopped") and the lines; then it
  follows the job to its reply. **Said, never applied**: the page that filed
  the job is the one that hops, falls back or offers an undo; this page only
  brings its preview up to date, as it does for another browser's request.
- **Retention, as it really is**: the record lives under `jobs/`, so the
  existing rotation removes it **seven days after its last write**
  (`JOB_RETENTION_MS`, by the object's upload time). Each two-minute tick
  visits one of 16 key prefixes, so a record goes on the first visit after
  it turns seven days old, within about 32 minutes; later when its prefix
  holds more than 300 objects (one listing's limit) or more than 100 are due
  at once (one tick's deletes). Until then the poll serves its lines. A
  standalone job is discoverable for 24 hours after its last update; a
  request's lines for as long as the request is listed; a page's own copy
  on a reply lives as long as that thread keeps the message (40 per site, in
  that browser).

### 2.9 The switch

`PROGRESS_REPLIES`, **off by default**: on only for the exact value "on"
(trimmed, any case). An optional secret with an `|| 'off'` fallback in
`deploy.yml`, carried to the container (`JOB_ENV_NAMES`). Off: nothing is
recorded, no task is sent, and no answer carries `progress`, `jobs` or `said`
(the OFF test), so every title is the customer's words, as before.

### 2.10 Each task named by the model's own line, in every state (the wording round)

**Why.** A task's title on the page — a request part's, a found job's card's —
was the customer's own words, which are also what the job runs on, so it read
as a command ("Change the Gallery heading"). The words stay what the jobs run
on; the title is now the model's.

- **The model writes each task's line once for every state it can be in**:
  one forced call, `write_tasks { tasks: [{ id, planned, doing, done, notdone
  }] }`, for every task still without lines, shown their site, their message
  and each task as `[tN] words`. The instructions (`TASK_SYSTEM`, 853
  characters) define the four states (planned: say you will do it; doing: say
  you are doing it; done: say you did it; notdone: say so, with no reason —
  the final message gives it), ask for the first person, naturally and
  conversationally, the task in the model's own words and never the
  customer's words handed back as an instruction, never "published" or
  "live", the customer's language, usually one sentence. No example line,
  and no length checked.
- **The check reads the answer's shape, never its words** (`readTasks`): every
  task by its id, a line with words in every state, no id in any line; a
  first answer that misses one is asked once more, told which.
- **Code picks the line from the status the server gives**, so no line can
  claim a state the task is not in, and a line written after the job ended
  claims nothing:
  - a request's part (`SITE_SAID_FOR`): waiting for another part, next,
    queued, waiting for an answer, needing a go-ahead or a full rewrite →
    planned; in progress, or checking it published → doing; done → done;
    partly done, not done, not run, stopped, question expired, refused → not
    done;
  - a found job's card (`SITE_JOB_SAID`): queued → planned; finished → done;
    not done or stopped → not done; anything else → doing.

  The fixed label stays beside the line ("Partly done" beside the not-done
  line, for instance).
- **Until the lines are written, or when they cannot be**, the title is the
  customer's words exactly as they were: nothing is put before them, and the
  page reads the lines strictly (`EditPoll.taskSaid`: all four states with
  words in them, or none at all).
- **Where they are kept**:
  - **a page-filed job's one task** on the job's own record (`taskWords`,
    `tasks`): its words given when the record opens (`begin` with `task:
    true`, sent only for a job the page filed, told apart from a request's
    part by the request its stored body carries), and a writer asked at
    once, so the card can be named while the job's first step runs;
  - **a request's parts** on the request's own narration record (`op:
    "request"`, under an id of 32 hex characters made from the site and the
    request's key, in `jobs/` with the same seven-day rotation, never on the
    request record, whose etag stays the driver's): opened at the acceptance,
    held by its `waitUntil`; **a part carved from another later** (a job's
    held additions, `carveParts`) is added by the driver as it saves that
    part (`syncRequestTasks`, create-or-add by compare-and-swap), and the
    cron's sweep adds any part those miss.
- **The writer** is the same one writer on the same record, lease and queue.
  The task lines go first, on tries of their own (`taskTries`, given up as
  `tasksWhy` after two), so a failing call for them never costs the milestones
  their lines. Only the tasks with no lines yet are sent; a commit keeps the
  lines already written; a part added while a call ran still waits, and the
  writer is asked again for it; adding a part begins the tries again.
  **Their lines say no state, so they are committed on the lease alone**,
  even on a closed record: a job that ended before its lines came still gets
  them, for the card that shows it finished.
- **Recovery**, with no page: a job that ended before its task's lines were
  written is asked for again by the cron (ended jobs of the last day, the 50
  most recently updated a tick); a request whose narration never opened is
  opened by the cron from the request, and one whose ask was lost is asked
  for again — while the request runs, and for 16½ minutes after it ends (the
  final reply's own horizon and grace).
- **Read and shown**, joined at the look and never written onto anything
  else: the job poll (`said`, running and finished), the requests list's
  found jobs (`said`), a request's read and the requests list
  (`parts[n].said`). A later reading brings lines to a card already drawn,
  and a found job's follow takes them from the poll.
- **Billing and the log**: absorbed, as the progress lines are; each call
  logged as `progress: tasks <id> written | not written (<why>) model
  <model> tasks <n> attempts <n> tokens <in>/<out> ms <ms>`.

## 3. The files

| File | What changed |
|---|---|
| `builder/site-progress.mjs` (new) | the switch, the record and its strict reader, milestones and their facts, the writer's rules (claim, batch, commit, fail, close), the row verdict, the instructions, the tool, the check and the call. Pure, no I/O. **The wording round**: the first-person rule; the tasks' words and lines on the record, their writer's rules (`tasksNeeded`, `unwrittenTasks`, `commitTasks`, `failTasks`, `addTasks`, `saidOf`), and their call (`TASK_TOOL`, `TASK_SYSTEM`, `taskRequest`, `readTasks`, `writeTasks`) |
| `worker.js` | the store (compare-and-swap), the recorder (`makeProgress`) on the job's context, the close at the job's end, the writer (`runProgressTask`), the queue branch, the cron's sweep, the gateway's door, the poll, the request read and list (`jobs`), and the milestones in the edit and add-on routes. **The wording round**: a page-filed job's task at its opening; the task lines first in the writer (`writeTaskLines`); the request's narration (`syncRequestTasks` at the acceptance and in the driver, `ensureRequestTasks` in the request sweep, `saidForRequest`); ended jobs in the progress sweep; `said` on the poll, the found jobs and a request's read and list |
| `builder/job-gateway.mjs` | `/progress`, bound to the job's own token |
| `builder/container-env.mjs` | `env.JOB_PROGRESS`, through the gateway |
| `builder/edit-job.mjs` | `PROGRESS_REPLIES` carried to the container |
| `builder/request.mjs` | `requestView` takes the lines by job and adds them to each part; and each part's own lines in every state (`said`) |
| `public/edit-poll.js` | `progressLines`; `taskSaid` (all four states, or none) |
| `public/chat.js` | the lines on a part's card, Path B's bubble, the lines kept on a watched job's reply, the found job's card and its follow; each title by the line for its status (`SITE_SAID_FOR`, `SITE_JOB_SAID`, `siteSaidFor`), the customer's words until then |
| `public/styles.css` | the lines' style, the live marker, the muted ended lines |
| `.github/workflows/deploy.yml` | the secret, with its `|| 'off'` fallback |
| `Dockerfile` | the new module copied into the image |

Not touched: the final reply's facts, instructions, records and placement;
billing; the request driver's decisions; first Build.

## 4. Calls, time and cost

### 4.1 Calls: logged, not promised

No count is promised: how many lines a job gets depends on how its
milestones fall against the writer's pace, since a line covers everything
waiting. The bounds that hold by construction: none before the job starts,
none during routing, a question or a refusal, none once the record is
closed; per batch at most two tries of at most two calls.

**Every writer call is logged**, which is where the real numbers come from:

    progress: <job> written | not written (<why>) model <model> milestones <n> facts <n> attempts <n> tokens <in>/<out> ms <ms>

with `progress: <job> given up after 2 tries` and `progress: <job> milestone
refused — <why>` beside it. The task lines' call (§2.10) is logged the same
way:

    progress: tasks <id> written | not written (<why>) model <model> tasks <n> attempts <n> tokens <in>/<out> ms <ms>

A request makes one such call for the parts it was accepted with, and one
more for each batch of parts carved later; a page-filed job makes one. Each is
at most two tries of at most two calls; no total is promised.

### 4.2 Added time

- **On the job**: a milestone is one store write (and, when a writer is
  needed, one queue send), not awaited by the job's work. The job's end
  waits for the writes on their way and the close, bounded at 10 seconds,
  normally one store round trip.
- **From a milestone to the screen**: the queue's pickup, the call, then the
  page's next poll. Not measured live; the log line gives each call's time.

### 4.3 Cost (estimates, unmeasured)

- About **0.15–0.35 credit per call at `grok-4.6`**, judged from the final
  reply's 0.4–0.6 with its larger instructions and longer answer; a customer
  who picked a Claude model costs several times more. Unmeasured until a
  live run with the switch on.
- **Absorbed** (§5), and measured only by the log line.
- **The task lines' call** (§2.10) is of the same size or smaller — four short
  lines per task in one answer — so about the same per call, estimated and
  unmeasured.

## 5. Billing

**Absorbed by the platform, as the owner decided**: no ledger row, no
reserve, no refund. A job's cost and ledger rows are exactly what they are
with the switch off (the SAME test: identical execution, publishing, money
and final reply). A failed, skipped or given-up line changes nothing in the
money.

## 6. Focused tests, as built

All free: supplied model answers, the real Worker on the in-memory platform
(`test/fixtures/request-flow.mjs`), the page's real functions in a VM, and
real Chromium for the drawing.

- **`test/progress.test.mjs`** (the module): the switch; the record, strict
  and whole; the batch; the one writer (claim, lease, own claim, tries,
  retry, skew, commit, failure, close); the job's row (every verdict, a row
  that cannot be read never read as gone); the facts of both paths (a
  database change applied, a page prepared, a withheld step no plan, a
  failure made good not told); the check (left out, misstated, two states,
  ids, cut, unreadable; **no length limit**); **PROSE 1: contradictory prose
  with otherwise valid metadata is accepted** (the limitation, pinned);
  PROSE 2: the instructions forbid published, live and finished, define every
  state, carry no worked example and set no length; the call (what the model
  is shown, the one re-ask told why).
- **`test/progress-flow.test.mjs`** (through the real routes):
  - RUN 1: a milestone becomes a line on the poll and the request's view,
    with nothing private;
  - **the races**: the job completes during the call (RACE 1); the customer
    stops it (RACE 2); a newer run before the call, and between the call and
    the commit (RACE 3); a stalled lease and a failed job (RACE 4) — none
    commits a line after the job's end;
  - **duplicate delivery** (DUP): one claim and one call;
  - **recovery with no milestone and no page** (LOST, WRITE 3): the cron
    asks once the grace has passed; a writer dead after its claim is
    replaced after its lease;
  - **interrupted writes** (WRITE 1, WRITE 2, OPEN): a milestone write that
    fails or whose answer is lost is recorded once and a writer still asked;
    a commit whose answer is lost is one line and no second call; an opening
    that fails is made again before the first milestone;
  - **the job's row unread** (ROW UNREAD): no call, the record kept open,
    the try made again after its wait, and the line written;
  - **a writer's own re-ask** (MANY): after its eight lines, the milestone
    recorded during its last call gets a task with no cron and no page;
  - **the failure path** (THREW): the close before the refund, read from the
    source, since no free flow makes a route throw;
  - **the lifecycle** (LIFE): each of the recorder's writes is handed to the
    job's own `waitUntil` (one more promise per write than with progress
    off);
  - **false completion claims** (CLAIM 1–3): a misstated state asked again
    and corrected; a model that keeps misstating gives no line and the
    milestone is given up while the job, its money and its reply go on;
    **contradictory prose through the route is committed** and the final
    reply is unchanged;
  - SAME (execution, publishing, money and final reply identical on and off),
    OFF, FIND (another device finds a standalone job; never another owner's,
    never a request's job, never past a day), FIND 2 (a busy day: the twenty
    most recent, oldest first, the running job never hidden), KEEP (the
    seven-day rotation), GATEWAY (the container's way, the token's ids, a
    pre-scoped build, a bad op, a body too large, no token, and a run that
    did not open the record: its milestone refused, its close closing
    nothing), LOG (attempts, tokens, time), EDIT (an edit's milestones, never
    "published"), ADD-ON (an add-on's milestones in order, each fact in its
    state);
  - a gate a case never reaches fails the case after 20 seconds instead of
    hanging the run (found when a mutant hung the first sweep).
- **`test/progress-page.test.mjs`** (the page's real functions, no browser,
  so unit CI runs them): the poll reader; a part's lines drawn and escaped,
  live only while it runs; a found job drawn once, in time, followed to its
  reply (said once, never applied), and not drawn where this page already
  shows it (watched, remembered, shown, held, carded); a request's reply
  never put under a found job's card; the watch's newest line painted where
  "Thinking" was and kept on its reply with the job named; the bubble's
  order (a waiting sentence first).
- **`test/progress-browser.test.mjs`** (real Chromium; skipped where there is
  none, as on unit CI): Path A with a reload, Path B with a reload and no
  doubling, and a **fresh device** finding both; the screenshots.
- **The wording round's cases** (§2.10), all with supplied answers:
  - the module: TASKS 1–5 (the record with the tasks' words and lines, read
    strictly; the writer's rules, the lines first on tries of their own and
    on the lease alone, even on a closed record; the check reads shape, not
    words; the call and its one re-ask; a part added later, only it asked
    for, the lines already written kept, a part added during a call still
    waiting, and the tries begun again); PROSE 2 and PROSE 3 (the first
    person asked for in both instructions, no example line, no length);
  - through the real routes: NAMES 1 (a request's part named on the
    request's narration, not on its job), NAMES 2 (a page-filed job's task,
    its lines before the milestone's line, on the poll and the list, kept on
    the finished answer), NAMES 3 (a call that keeps failing: the words kept,
    tried again, given up, the milestones still written), NAMES 4 (a job
    that ended first, its writer's message lost: the cron's sweep of ended
    jobs), NAMES 5 (a part carved mid-request, named by the driver on the
    queue alone, with no cron, and written alone), NAMES 6 (the opening asks
    for a writer before any milestone; with no task, nothing), NAMES 7 (a
    narration that never opened, opened by the sweep while the work runs),
    NAMES 8 (a request that ended first, its ask lost: asked again within
    the horizon); OFF (no `said` anywhere); LOG (the task call measured);
    OPEN (its one-shot fault now aimed at the job's own record, since the
    request's narration is read first at the acceptance);
  - the page, no browser: SAID (the strict reader; every status to its
    line, never another state's; the words as they are without lines or
    with a state missing; a found job's card by its state; a later reading
    and the follow bring lines to a drawn card);
  - real Chromium: Path A named by its words until its lines come, then by
    its doing and done lines through a reload; a fresh device's two cards by
    their lines; TENSES (three parts at once: past, present and future, each
    moving to its next line as its status moves).

**The checks**, in full in `docs/history/2026-10-06-progress-messages.md`
§3: the four files above (19, 27, 9 and 3 cases); the sweep over the module
and its wiring (81 mutants and 4 comment-only controls: 80 killed on its full
run, the one survivor closed by the ADD-ON case and killed on its own rerun,
after the first run's seven survivors had each become a case); the full suite
`9650 / 9650 / 0 / 0` locally; unit CI green on `5cfebd0a`; the site build
green on `9c931540`; the image predicted, not built.

**The wording round's checks** (the history file's §5): the four files at 25,
35, 13 and 4 cases; the whole spec swept again with this round's mutants (140
mutants and 6 comment-only controls: 139 killed, the one survivor — OPEN's
one-shot fault taken by the request's new narration record — closed by aiming
the fault at the job's own record, and killed on its rerun with the page
mutants, 18 of 18, every control surviving); the full suite `9669 / 9669 / 0
/ 0` locally on `dd446201`, and unit CI green on it (run 37502463796, `9669 /
9650 / 0 / 19`, the 19 real-browser cases skipped there); the site build
green on it (run 37502463614, 404 checks in 27 sections across 4 shards); the
image predicted `141b0dcc2a92d926` (195 inputs), not built.

## 7. What this does not show, and the limits that stay

- **No real model has written a line.** Every answer in every test is
  supplied. How a real model words its lines, how often it says something
  its facts do not (§2.5), how long a call takes and what it costs are all
  unmeasured until the switch is on for a live press, which is yours to
  decide.
- **The words are not checked** (§2.5): an update whose `says` is right and
  whose words call the page live is committed. Stated, tested, not filtered.
- **One residual window** (§2.5): a line committed after the outcome when
  the job's own close fails and the writer had already passed its second
  row read.
- **"Saved" is not reported on its own** (§2.1): a page change is
  "prepared" until its publish starts.
- **Bounds**: the cron reads 50 running jobs a tick (§2.6); the requests
  list holds the 20 most recent standalone jobs of the last day (§2.8); a
  record takes 200 milestones (§2.2). Each is logged or stated where it
  applies; no line's text is ever cut.
- **The facts are in the builder's own terms** (a page's address, a step's
  fields), and the model is told to say them in the customer's words and
  language; how well it does that is part of the unmeasured live behavior.
- **The task lines (§2.10), likewise unmeasured**: no real model has written
  one, so how naturally it phrases them, and whether each state's line reads
  in its own tense, is unknown until a live press. Their words are not
  checked either: a done line that called the change live would be shown.
- **A task's lines do not know its outcome**: they are written before it
  ends, so the done line says what was done in general terms, and the final
  reply says what really happened. A partly done part shows its not-done
  line beside the "Partly done" label.
- **The customer's words show** until the lines come (one queue round and one
  call; for a part carved later, from the driver's save of that part), and
  for good when their tries are spent or a request would hold more than 50
  tasks (`PROGRESS_MAX_TASKS`).

## 8. Decisions

All five of the first plan's decisions were taken as recommended (§0). What
remains yours, when you want it: turning `PROGRESS_REPLIES` on in a deploy,
and a paid live press to read the first real lines and their cost (about
0.15–0.35 credit per call, estimated, absorbed).
