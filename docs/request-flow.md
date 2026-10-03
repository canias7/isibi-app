# One message, several parts, finished on the server

> **Built on `claude/help-needed-ehlwlj` (2026-10-03, `b1d96b3d`), unmerged
> and undeployed, and off by default** (`REQUEST_FLOW`). The owner's order:
> *"one user message can request multiple edits and additions, and all
> accepted parts are remembered and processed without the user resending
> them or keeping the browser open."* The plan it came from, with the
> places the build departs from it, is
> `docs/investigations/edit-addon-one-request-plan.md`. The story of the
> round is `docs/history/2026-10-03-combined-requests.md`.
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
  door's held additions, and each part's own routing. **Code checks the
  plan, orders it, and keeps every part's state.** No keyword and no word
  position decides anything. Position only breaks ties between unrelated
  parts.
- **Every step of a part is an ordinary queued job** (`edit_jobs`), under a
  key derived from the message's key, so filing it twice finds the same row.
  The existing claim, lease, site lock, reserves, publish marks, refunds,
  sweeps and reconcile apply unchanged, and **one job of a request runs at a
  time**, against the site as the part before left it.
- **First Build is unchanged**, and with the switch off nothing changes.

## Where it lives (R2, the site bucket; no migration)

| Key | What | Lifetime |
|---|---|---|
| `requests/<slug>/<key>.json` | the record (below). Created once (`etagDoesNotMatch: "*"`), moved only on the etag it was read under | until the site is deleted |
| `requests/<slug>/<key>/files/<sha256>.<ext>` | the message's files, and an answer's, content-addressed (at most `MAX_ATTACHMENTS`, 3) | deleted when the request ends |
| `requests/<slug>/<key>/reply.json` | the request's own reply, written once after it ended | until the site is deleted |
| `requests/<slug>/<answer key>.json`, `kind: "answer"` | an answer that resumed a part: the same answer sent again gets the same reply | until the site is deleted |
| `requests-live/<slug>/<key>` | the marker the sweep lists: `{ at, endedAt }` | deleted by the sweep a day after the request ended |
| `requests/sweep-cursor.json` | where the sweep stopped listing markers | overwritten every tick |

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
  hand-over and its count);
- its jobs, each `{ key, kind, op, id, seq, end }`;
- its status and why;
- its question while it waits;
- a short account of what it did, which later parts are shown.

## Statuses

A part is never said to be done, or being done, before its own job's row
says so.

| Status | Meaning |
|---|---|
| `blocked` | a part it needs is not finished |
| `ready` | it may run; no job filed yet |
| `queued` | its job is filed, not yet claimed |
| `started` | its job is claimed and running |
| `waiting` | it asked a question |
| `unverified` | its job began publishing and could not confirm it (held for review) |
| `done` | its job finished and said what changed; `why: unrecorded` when the sweep kept a publish whose answer it could not read |
| `failed` | its job ended with its own reason (`why`) |
| `not-run` | never started: a part it needs did not finish (`why: needs:<n>`) |
| `cancelled` | stopped (`stopped`) or its question cancelled (`question-cancelled`) |
| `needs-rewrite` | only the full rewrite of every page could make it; never started without the customer's press |
| `expired` | its question went unanswered for a day |
| `refused` | its relations formed a cycle (`order-unclear`) |

The request is `running`, `waiting`, `review` or `blocked` while unfinished.
Once every part has ended it is `done`, `partial`, `failed` or `stopped`.

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
  `alsoAsked`, a question's put-off parts. Each must be the customer's own
  words, shorter than the part it came from (so a chain always ends), and not
  a part already.
- **Who may run**: an independent part runs whatever happened elsewhere. A
  part runs when every part it needs is `done`, with the parts carved from
  those. A part whose prerequisite failed, was stopped, expired, was refused
  or needs the rewrite is `not-run`, and says which. A part a step left for
  later runs after that step's part has ended or is waiting on a question.

## What moves a request

One function, `advanceRequest`. It reads the record and the rows of its
live jobs (`edit_get`), takes one step (`nextStep`), writes on the etag it
read under (no write when nothing moved), files at most one job, and records
the job's id. A writer that loses the race reads again (at most six rounds),
so two drivers at once file one job under one key. Its callers:

1. the routing call that accepted the message;
2. **a part's job ending**: in the Worker's consumer directly
   (`requestJobEnded`); in the site's container through the gateway's
   `POST /api/job/<id>/next` (`JOB_NEXT`). That call is bound to the job's
   own token, and the Worker checks that the request names the job;
3. an answer to a part's question, or that question cancelled;
4. the page's `GET` of the request, and the same message sent again;
5. **the two-minute cron** (`runRequestSweep`), the guarantee: one page of
   100 markers per tick, each tick starting where the last stopped.

Any of 1–4 can be lost. The sweep moves the request within one cycle of the
markers.

## The checkpoints

**Routing the message** (the accepting call).
- Charged once per message key: `credit_debit` with ref
  `route:<slug>:<key>`, reason `route`. A retry that reaches the model again
  is not charged again.
- A routing call that failed is not charged.
- The same key again (a lost response, a second tab) is answered from the
  stored acceptance: no model call, no charge, and no question closed or
  read again.
- When our store fails around a usable answer, the reply has the routing
  call's own failure shape. The page holds the message, with its key, for
  sending again.

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
  key, its money already back. Here "no answer" means the stale sweep's, a
  missing container, or a service shut down under it. After the retry the
  part fails (`no-answer`).

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
  three, is `needs-rewrite`.

**The full rewrite is never started without the customer's press.** The card
offers *Rewrite the site for this*, which runs the page's own revise on that
part's words.

## Stop the rest

`DELETE /api/site/request/<slug>/<key>` uses the existing cancellation:
- nothing new starts;
- the running job is asked to cancel through `edit_cancel`. Before it
  publishes it ends cancelled and refunded; after, `too-late`, and it is
  done;
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
- **The request's own reply**, once it has ended, covers what no job's reply
  explains (a part not run, stopped, needing the rewrite, expired). It is
  model-written from the request's facts (`requestReplyFacts`), once, and
  kept.
- **What a part that did not finish was charged is read from its jobs'
  rows**: each job's finalized reserves, recorded when it ended
  (`chargedOf`), and nothing for one refunded, exempt or never reserved. A
  later part's own routing is charged before it runs, so a part stopped
  after its routing says what that cost, never "nothing". A view with no
  number makes no claim about money.
- **The message's routing charge is said once**: by part 0's own reply when
  part 0 ran on the answer that accepted the message, else by the request's
  reply (`routedUnsaid`). That covers a part 0 routed again, never run, or
  stopped before its step.
- **Fixed sentences are kept to genuine technical failures**: the page lost
  sight of the request after 30 failed reads, or a stop that could not be
  sent.
- **The card** under the message lists each part's words and status, with
  *Stop the rest* while anything is left.

## The owner's routes

- `GET /api/site/request/<slug>/<key>` moves the request on, then answers
  its view. Once the request has ended, it answers the reply too.
- `DELETE` on the same path stops the rest.
- `GET /api/site/requests/<slug>` answers this owner's requests on the site
  that are unfinished or ended within a day, at most 50.
- Anything not the owner's answers 404. A view carries no owner id and no
  file keys.

## The page

- It follows the request and never files, hands on or retries a step.
- Its state for each request is kept on the site's own record for two days.
- On opening a site it picks that site's requests up from the server, so
  progress and questions survive a reload or another device.
- A message held after a failed send keeps its key in memory, so sending
  the same words again is the same request.

## The switch

`REQUEST_FLOW` takes an affirmative word, read where a message is accepted
(`requestFlowOn`). The deploy default is `off`, because the UI canary
(`scripts/canary-ui.mjs`) expects the page to post its own edit. Requests
already accepted go on to their end either way.

To turn it on:
1. merge and deploy (the image rolls);
2. adapt the UI canary;
3. set the secret to `on` and redeploy.

## Limits, as built

- **Supplied model answers only.** No real-model evidence.
- **The page still drives its steps when edits are not queued** for an owner
  and site (`EDIT_ASYNC` off for them), as before.
- **The sweep reads 100 markers per tick.** A request whose job-end call
  was lost waits up to `ceil(markers / 100)` ticks.
- **The per-site list shows at most 50 requests.**
- **Records, answer pointers and replies have no retention window.** They go
  when the site is deleted. Files go when the request ends.
- **A run job stopped while queued still makes its model calls.** It is
  caught at the publish gate and refunded: the job runner's behavior today,
  which a routing job does not share (its gate is before its model call).
- **A publish held for review holds the request** until the reconcile, or a
  person, settles it.
- **A later part's routing runs in the site's container**, so a cold
  container adds its start time.
- **The full rewrite's go-ahead uses the message's files only while the page
  still holds them in memory.**
- **Part 0's words on the card show the other parts as "…".**
- **The ledger names the message's routing charge `build`**, with reason
  `route`, because that is the kind `credit_debit` records.
