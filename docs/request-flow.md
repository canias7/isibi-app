# One message, several parts, finished on the server

> **Built on `claude/help-needed-ehlwlj` (2026-10-03, `b1d96b3d`, and the
> owner's review fixes after it), unmerged and undeployed, and off by
> default** (`REQUEST_FLOW`). The owner's order: *"one user message can
> request multiple edits and additions, and all accepted parts are
> remembered and processed without the user resending them or keeping the
> browser open."* The plan it came from, with the places the build departs
> from it, is `docs/investigations/edit-addon-one-request-plan.md`. The
> story of the first round is `docs/history/2026-10-03-combined-requests.md`;
> the review fixes are `docs/history/2026-10-03-request-review-fixes.md`.
>
> **Evidence: supplied model answers only.** Every test drives the real
> Worker, but every model answer in it is supplied by the test. No real model
> has been asked any of these messages (`docs/backlog.md`, *The combined
> request flow*).

## In brief

- With `REQUEST_FLOW` on, a message on a site that exists, sent with its
  key, where edits are queued for that owner and site (`editAsyncFor`), is
  **accepted by the routing call as a request** when the routing answer is
  work (`edit` or `addon`). The server then runs every part, with no page
  open. Anything else (a question about the site, a question back, the full
  rewrite asked for, a routing failure, a plan whose held parts cannot be
  found in the message) is answered as it always was.
- **The model decides what the parts are and which needs which**: the
  router's `alsoAsked` and `dependsOn`, the picker's `elsewhere`, the look
  door's held additions, the add-on step's set-aside kinds and its own words
  for each (`scopes`), and each part's own routing. **Code checks the plan,
  orders it, and keeps every part's state.** No keyword and no word position
  decides anything. Position only breaks ties between unrelated parts.
- **Every step of a part is an ordinary queued job** (`edit_jobs`), under a
  key derived from the message's key, so filing it twice finds the same row.
  The existing claim, lease, site lock, reserves, publish marks, refunds,
  sweeps and reconcile apply unchanged, and **one job of a request runs at a
  time**, against the site as the part before left it.
- **A part only the full rewrite can make waits for the customer's
  go-ahead on the request itself**, with its files kept. The press runs the
  existing queued build, and its result settles back into the part.
- **A part is done only when its step did everything it was asked.** An
  `ok` answer that names something it did not do is `partial`, and nothing
  that needs it runs.
- **First Build is unchanged**, and with the switch off nothing changes.

## Where it lives (R2, the site bucket; no migration)

| Key | What | Lifetime |
|---|---|---|
| `requests-live/<slug>/<key>` | the marker the sweep lists: `{ at, endedAt }`. **Written first, create-only** | deleted by the sweep a day after the request ended, or 15 minutes after it was written when no record ever landed |
| `requests/<slug>/<key>.json` | the record (below). Created once (`etagDoesNotMatch: "*"`), moved only on the etag it was read under | until the site is deleted |
| `requests/<slug>/<key>/files/<sha256>.<ext>` | the message's files, and an answer's, content-addressed (at most `MAX_ATTACHMENTS`, 3) | deleted when the request ends — kept while a part waits for its go-ahead |
| `requests/<slug>/<key>/reply.json` | the request's own reply, written once after it ended | until the site is deleted |
| `requests/<slug>/<key>/reply-approval-<n>-<seq>.json` | the reply for one go-ahead a part waits on, written once | until the site is deleted |
| `requests/<slug>/<answer key>.json`, `kind: "answer"` | an answer that resumed a part: the same answer sent again gets the same reply | until the site is deleted |
| `requests/sweep-cursor.json` | where the sweep stopped listing markers | overwritten every tick |
| `jobs/<id>.json`, `jobs/<id>.result.json` | an approved rewrite's stored job and its answer: the existing queued build's own objects | the job deleted when the consumer reads it; the answer kept (the build's own residue) |

The markers have a root of their own because `live` is a valid slug. Under
`requests/`, a site called `live` would share every marker's prefix.
**Deleting a site deletes both prefixes** (`deleteSiteFor`): the markers
first, so the sweep never moves on a request for a site that is gone, then
the records and files. Both go before the registration row, as the backups
do.

**The record** holds the message, the key, the owner and the site, and the
page's choices every part needs: the picked model, the time zone, the undo
rows and the site digest. It also holds the files, the answers given
(`context`), the routing answer that accepted it (handed back to a duplicate
of the same message), the routing cost, `stop`, and the parts.

**A part** holds:
- its own words, found in the message;
- where it came from (the message, the router, a step that left it, or an
  earlier question);
- the parts it needs (`needs`, the model's);
- the route it runs with (op, layer, page, `remove`, `rename`, the
  hand-over and its count, and whether the add-on step handed it over);
- its jobs, each `{ key, kind, op, id, seq, end }` — `kind` is `route`,
  `run` or `rewrite`;
- its status and why, and what it did not do (`notDone`) when it was done
  in part;
- its question while it waits, or when it began waiting for its go-ahead
  and when that was given (`approval: { at, job }`);
- a short account of what it did, which later parts are shown.

## Statuses

A part is never said to be done, or being done, before its own job's row
says so.

| Status | Meaning |
|---|---|
| `blocked` | a part it needs is not finished |
| `ready` | it may run; no job filed yet |
| `queued` | its job is filed, not yet claimed (an approved rewrite included) |
| `started` | its job is claimed and running |
| `waiting` | it asked a question |
| `approval` | only the full rewrite of every page can make it; it waits for the customer's go-ahead. **Not an ending**: what needs it waits too |
| `unverified` | its job began publishing and could not confirm it (held for review) |
| `done` | its job finished and did everything asked; `why: unrecorded` when the sweep kept a publish whose answer it could not read |
| `partial` | its job finished `ok` but named something it did not do (`notDone`), or left words for later that no part holds. An ending, and a bad one for what needs it |
| `failed` | its job ended with its own reason (`why`) |
| `not-run` | never started: a part it needs did not finish (`why: needs:<n>`) |
| `cancelled` | stopped (`stopped`) or its question cancelled (`question-cancelled`) |
| `expired` | its question went unanswered for a day (`unanswered`), or its go-ahead was not given in a day (`unapproved`) |
| `refused` | its relations formed a cycle (`order-unclear`) |
| `needs-rewrite` | kept only so a record written before the go-ahead existed still reads; nothing writes it now |

The request is `running`, `waiting`, `review` or `blocked` while unfinished.
Once every part has ended it is `done`, `partial`, `failed` or `stopped`
(`partial` when some part was done, in whole or in part).

## The plan, and parts found later

- **Part 0** is the message less the router's held parts (`alsoAsked`), and
  runs with the routing answer that accepted it, sent exactly as the page
  would have sent it. Each held part is a part of its own, routed when its
  turn comes, against the site as it is then. That routing is a job
  replaying `POST /api/site/route`.
- **`dependsOn`** (the router's, by number) becomes `needs`. Part 0 that
  needs a later part waits for it, and is routed again on its own words.
  Parts in a cycle are `refused`; no order is guessed.
- **A step that leaves words for later** adds parts to the same request: the
  picker's `elsewhere`, the look door's held additions, a routing job's
  `alsoAsked`, a question's put-off parts, and **the add-on step's
  set-asides** (below). Each must be the customer's own words, shorter than
  the part it came from (so a chain always ends), and not a part already.
- **The add-on step's set-asides** (2026-10-03, the owner's review). A
  frame item beside a page or section (`skipped: ["frame"]`), or a list
  entry beside other kinds (`notAdded`), used to come back inside an `ok`
  answer, and the request read only `deferred`. Now the add-on picker names
  the customer's own words for each kind it picked (`scopes`). A kind the
  step sets aside, whose words the Worker finds in the instruction
  (`wordsIn`), goes into `deferred` — so it becomes a part of its own,
  routed and run like any other — and into the answer's `setAside`, and it
  is no longer said to be skipped. A set-aside with no words of the
  customer's stays in `skipped` or `notAdded`, so the part is `partial`.
- **Who may run**: an independent part runs whatever happened elsewhere. A
  part runs when every part it needs is `done` — **never `partial`, and
  never because the answer said `ok`** — with the parts carved from those.
  A part whose prerequisite failed, was done only in part, was stopped,
  expired or was refused is `not-run`, and says which. A part a step left
  for later runs after that step's part has ended, or is waiting on a
  question. A part that needs one waiting for its go-ahead stays `blocked`
  until that part ends.

## What counts as done

`notDoneOf(answer, op)` lists what an answer says it did not do:
- an edit's `partial` (not its questions), `notBuilt`, `keptParts`,
  `unseenParts`, `dropped` (not duplicates), `refusedLinks` and `failed`;
- an addition's `notAdded`, `declined`, `skipped`, `missingPages` and
  `droppedFields`.

Any of those makes the part `partial`, kept on the part (`notDone`). So does
a word the step left for later (`deferred`) that no part of the request
holds, because it was not found in the message.

## What moves a request

One function, `advanceRequest`. It reads the record and the rows of its
live jobs (`edit_get`), takes one step (`nextStep`), writes on the etag it
read under (no write when nothing moved), files at most one job, and records
the job's id. A writer that loses the race reads again (at most six rounds),
so two drivers at once file one job under one key. Before the step it also
looks for **a go-ahead's build a press filed and never recorded** (below).
Its callers:

1. the routing call that accepted the message;
2. **a part's job ending**: in the Worker's consumer directly
   (`requestJobEnded`); in the site's container through the gateway's
   `POST /api/job/<id>/next` (`JOB_NEXT`). That call is bound to the job's
   own token, and the Worker checks that the request names the job;
3. **an approved rewrite ending**, the same two ways (`requestRewriteEnded`);
4. an answer to a part's question, that question cancelled, or a part's
   go-ahead;
5. the page's `GET` of the request, and the same message sent again;
6. **the two-minute cron** (`runRequestSweep`), the guarantee: one page of
   100 markers per tick, each tick starting where the last stopped.

Any of 1–5 can be lost. The sweep moves the request within one cycle of the
markers.

## The checkpoints

**Accepting the message** (the routing call).
- **The marker is written before the record** (2026-10-03, the owner's
  review): the sweep finds a request only by its marker, so a record
  written first, with the call dying before its marker, was a saved request
  nothing would move on without a resend. Now any record has a marker. The
  marker is create-only; one that cannot be written stops the acceptance
  before anything is saved, its files are deleted, and the page holds the
  message for sending again.
- A marker whose record never landed (the call died between the two) is
  cleared by the sweep once it is 15 minutes old (`ORPHAN_MARKER_MS`).
- Charged once per message key: `credit_debit` with ref
  `route:<slug>:<key>`, reason `route`. A retry that reaches the model again
  is not charged again. A routing call that failed is not charged.
- The same key again (a lost response, a second tab) is answered from the
  stored acceptance: no model call, no charge, and no question closed or
  read again.

**Routing a later part** (a routing job).
- Charged through the job's own reserve (`edit_reserve(p_id, 1, cost)`, ref
  `<job>#1`), so a redelivered job is charged once.
- A routing call that fails on our side is asked once more, then the part
  fails (`routing-failed`), uncharged.
- A stop before it asks a model ends it at its gate: refunded, cost 0.

**Running a part** (an edit or add-on job).
- The replayed body is exactly the page's for the same decision (`jobBody`,
  compared field by field with `siteEdit` and `siteAddon`).
- Its own reserves, refunds and publish behave as for a message sent by
  hand.
- A job that ended with no answer at all is filed once more under the next
  key, its money already back. After the retry the part fails (`no-answer`).

**The full rewrite's go-ahead** (2026-10-03, the owner's review).
- A step that only the full rewrite can make — a climb, a second hand-over,
  a loop, more than three hand-overs, or an answer routed to a rewrite —
  puts the part in `approval`, with its files kept. What needs it stays
  `blocked`; independent parts go on.
- `POST /api/site/request/<slug>/<key>/approve` `{ part }` files the
  rewrite **through the existing queued build**: its row (`edit_create`,
  op `build`, billed `external`), its stored job (the revise the page posts
  to `/api/site/react-revise`, with the part's words, the request's files,
  the picked model and the customer's session), and its queue message. The
  consumer, design, page writer, compile, publish and charging are the
  build's own. First Build and a page's own revise are unchanged.
- **Every press of one go-ahead files one row**: the job id is derived from
  the request, the part and that job's number (`rewriteJobId`), and it is
  also the row's idempotency key. A request's rewrite **runs only under its
  own row's lease**: a second delivery whose claim is refused (another
  consumer holds it, or it ended) builds nothing. So a second press, another
  device's press, or a redelivered message runs it once.
- **The press files first, then records** the go-ahead on the part. A press
  that dies after filing is found by the next step, which looks for a row
  under the id the press derived and records it — unless the row is still
  queued with no stored job (a press that failed and was told so), which
  the next press files again. A send that fails deletes the stored job it
  wrote, so it is not counted given.
- **Stop reaches it**: a stop cancels a recorded rewrite through its row,
  and also the id a waiting part's press would use, so a build filed and not
  yet recorded ends at its gate. The consumer also reads the request before
  it starts: a rewrite whose part no longer waits for it (stopped, lapsed,
  the request gone) ends cancelled with nothing designed or charged.
- **Its result settles back** from the build's own answer
  (`jobs/<id>.result.json`, `settleRewrite`): `done` only when it published
  the site (`page: "app"`); `partial` when it salvaged a page it could not
  write; `failed` when it wrote no pages (`rewrite-not-written`; a revise
  leaves the live site as it was) or failed outright; `cancelled` when it
  was stopped. Its cost is the build's own `cost`; an answer naming none
  leaves the part's money unknown, never zero. Then the parts that needed
  it run.
- A go-ahead not given in a day lapses: `expired`, `unapproved`.

**Publication**.
- One publish per part that changed something, each its own saved version.
- A job that died mid-publish is held for review. The part is `unverified`,
  and the request starts nothing else until the existing reconcile, or a
  person, settles it.
- A site paused for review refuses new jobs (`needs-review`). The part keeps
  its place and says `site-review`.

## Questions

- A part's question, from its routing or its step, takes the site's one
  question slot **only when the slot is free** (`storeAskIfFree`). It never
  replaces a question the customer is answering. Otherwise it waits on the
  part (`queued`) and is offered when the slot frees.
- The question record names its request and part. The answer goes through
  the ordinary routing call, which reads it with the part's waiting words.
  The part then runs with that decision, with no second routing call.
- An answer's own files join the request's. Past three in all, nothing is
  sent, nothing is charged, and the question stays open
  (`answer-files-full`).
- An answer met with the next question keeps the part waiting.
- Cancelling the question ends that part (`question-cancelled`); what
  needed it is not run.
- Unanswered for a day, it expires.
- Independent parts go on meanwhile.

## Hand-overs, on the server

The page's `escalateAction`, now the server's (`handOff`):
- an edit step naming another layer hops to it once, marked as a hand-over;
- an edit naming the add-on goes there, unless the add-on handed it over;
- the add-on naming an edit layer hands it there as an addition;
- a second hand-over, a climb on the same layer, a loop back, or more than
  three, waits for the go-ahead (`approval`).

## Stop the rest

`DELETE /api/site/request/<slug>/<key>` uses the existing cancellation:
- nothing new starts, and a waiting go-ahead can no longer be given;
- the running job is asked to cancel through `edit_cancel`. Before it
  publishes it ends cancelled and refunded; after, `too-late`, and it is
  done. An approved rewrite not yet started ends at its gate;
- parts not yet started are `cancelled`, and done parts stay done.

## What every model call of a part is shown

The original message, what the parts before it did, and every answer so far
(`partBlock` through `clarifyTransport`). So "it" and "that page" keep the
meaning they had in the message. A routing job is shown the same.

## What the customer reads

- **Each part's own reply** is its job's model-written reply, written once
  by the job poll. Its facts mark it as part of a longer request, so the
  other parts are said to be done separately by the same request, and never
  "send it next".
- **The request's own replies**: one while it waits only on a go-ahead —
  what waits, why only the full rewrite can make it, that a full rewrite of
  the same site was measured at 17 credits, that it starts only from the
  button and lapses in a day — and one once it has ended, covering what no
  job's reply explains: a part done only in part, not run (and whether its
  prerequisite failed or was done only in part), stopped, lapsed, expired,
  or made by the rewrite (what it cost, and that every page was written
  again). Each is model-written from the request's facts
  (`requestReplyFacts`), once, kept, and named (`replyFor`) so a page shows
  each once.
- **What a part that did not finish was charged is read from its jobs'
  rows**: each job's finalized reserves, recorded when it ended
  (`chargedOf`), and nothing for one refunded, exempt or never reserved; a
  rewrite's from its build's answer. A view with no number makes no claim
  about money.
- **The message's routing charge is said once**: by part 0's own reply when
  part 0 ran on the answer that accepted the message, else by the request's
  reply (`routedUnsaid`).
- **Fixed sentences are kept to genuine technical failures**: the page lost
  sight of the request after 30 failed reads, a stop that could not be sent,
  or a go-ahead the page could not confirm.
- **The card** under the message lists each part's words and status — *Partly
  done*, *Needs your go-ahead* with its button, *Full rewrite queued* or *in
  progress* once given — with *Stop the rest* while anything is left.

## The owner's routes

- `GET /api/site/request/<slug>/<key>` moves the request on, then answers
  its view, and a reply when there is one (`replyFor`: `approval:<n>:<seq>`
  or `end`).
- `DELETE` on the same path stops the rest.
- `POST …/approve` `{ part }` gives a part its go-ahead: 200 with the view
  (given now or already), 409 `not-waiting` with the view, 503 when it could
  not be filed (nothing given; press again).
- `GET /api/site/requests/<slug>` answers this owner's requests on the site
  that are unfinished or ended within a day, at most 50.
- Anything not the owner's answers 404. A view carries no owner id and no
  file keys.

## The page

- It follows the request and never files, hands on, retries or rewrites a
  step: a part's go-ahead is a press the server records.
- Its state for each request is kept on the site's own record for two days.
- On opening a site it picks that site's requests up from the server, so
  progress, questions and a given go-ahead survive a reload or another
  device.
- A message held after a failed send keeps its key in memory, so sending
  the same words again is the same request.

## The UI canary in request mode

`scripts/canary-ui.mjs` follows a message the server took on (its routing
answer names a request) until the request has ended and the page has shown
all of it. The request's card is not taken for a reply. Its jobs — every id
the request filed — are what the chain and the money read. **The wall
cannot abort a job the server files**, so in request mode it is the
request's own Stop, sent through the page's session the moment a part is
routed where the message may not go, or waits for the go-ahead, which no
scenario gives (`requestWall`). The go-ahead's POST is refused like the
rewrite route. A request's files are checked on the routing call. Shown with
a stand-in page only; no request-mode canary run has been pressed.

## The switch

`REQUEST_FLOW` takes an affirmative word, read where a message is accepted
(`requestFlowOn`). The deploy default is `off`. Requests already accepted go
on to their end either way.

To turn it on:
1. merge and deploy (the image rolls);
2. a free canary press, then a paid UI canary press in request mode, on the
   owner's word;
3. set the secret to `on` and redeploy.

## Limits, as built

- **Supplied model answers only.** No real-model evidence: not for the
  add-on picker's `scopes`, the router's relations, or any reply.
- **A set-aside addition needs the picker's words for it.** With none, or
  words not found in the message, the addition is `partial` and what needs
  it is not run; nothing guesses the words.
- **The page still drives its steps when edits are not queued** for an owner
  and site (`EDIT_ASYNC` off for them), as before.
- **The sweep reads 100 markers per tick.** A request whose job-end call
  was lost waits up to `ceil(markers / 100)` ticks.
- **A marker with no record** is listed by the sweep until it is 15 minutes
  old.
- **The per-site list shows at most 50 requests.**
- **Records, answer pointers and replies have no retention window.** They go
  when the site is deleted. Files go when the request ends.
- **A run job stopped while queued still makes its model calls.** It is
  caught at the publish gate and refunded.
- **An approved rewrite stopped after it started runs to its end**: the
  build has no gate between its stages for a stop. Its result is recorded as
  it is.
- **A rewrite's press that died after creating the row and before storing
  its job** leaves a queued row, which the next step does not count as
  given. The next press files it. With no further press, the stale sweep
  fails that row after about 20 minutes, the next step records it, and the
  part fails with it (`stale`): said as a failure on our side, nothing
  charged. The customer can ask again.
- **A rewrite whose generation resumed in a later delivery** settles at the
  next look or sweep, not at once.
- **The go-ahead's job carries the session of the press**, as the page's
  revise does. A press whose session has lapsed by the time the queue
  delivers it is refused by the build like any revise.
- **A publish held for review holds the request** until the reconcile, or a
  person, settles it.
- **A later part's routing runs in the site's container**, so a cold
  container adds its start time.
- **Part 0's words on the card show the other parts as "…".**
- **The ledger names the message's routing charge `build`**, with reason
  `route`, because that is the kind `credit_debit` records.
