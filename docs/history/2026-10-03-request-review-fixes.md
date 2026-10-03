# The combined request flow: the owner's review fixes (2026-10-03)

On the owner's order, for review on `claude/help-needed-ehlwlj`.
**Unmerged, undeployed, and off by default** (`REQUEST_FLOW`). No container
was built, no model was called, nothing was spent, and no migration was
applied: none is needed. First Build is unchanged.

- Code: `4fd05e68`.
- How it works now: `docs/request-flow.md`.
- The first round: `docs/history/2026-10-03-combined-requests.md`.

## 1. The order

> Keep the combined flow unmerged, undeployed and off while fixing these
> specific review findings. First, deferred additions still escape the
> coordinator: the add-on returns skipped:["frame"] or notAdded for a row
> beside other kinds, but request.mjs reads only deferred and treats ok:true
> as complete. I independently exercised nextStep with a successful page
> addition and skipped:["frame"]: it marked the whole part done and queued a
> dependent operation on the missing link. Preserve model-authored scope
> words for these additions and turn executable deferred work into durable
> request parts; distinguish genuine refusals and partial outcomes, and never
> satisfy dependencies merely because the enclosing response has ok:true.
> Cover page plus menu link, additions plus row, and dependent work through
> the actual routes, checking final site state and request status. Second,
> close the acceptance recovery gap: createRequestRecord precedes
> settleRequestMarker, while the sweep discovers only markers. A crash
> between them leaves a saved request undiscoverable without a resend; J5
> currently resends and therefore does not prove browser-independent
> recovery. Make persisted acceptance recoverable across that boundary using
> the smallest reliable change, and test recovery with no browser, resend or
> direct request GET, including interrupted marker writes. Third, keep the
> full-rewrite approval attached to the original request: needs-rewrite
> currently ends the part, marks dependents not-run, deletes request files
> when the request ends, and siteRequestRewrite starts separate browser work.
> Preserve a waiting approval state and attachments, record the approval
> durably, and use the existing rewrite executor without changing first
> Build; settle its result back into the request and resume eligible
> dependents. Verify approval after reload or from another device, duplicate
> approval, failure and cancellation. Adapt the UI canary for request mode
> on this branch before rollout, rather than leaving that implementation
> until after deployment. Keep tests focused on these concrete gaps,
> preserve the model-driven routing and natural replies, update the docs
> with accurate remaining limitations, and push for review. No merge,
> deployment, paid calls, live migration or container rebuild.

## 2. Additions set aside, and outcomes done only in part

**Reproduced as the owner described**: a successful page addition with
`skipped: ["frame"]` marked the whole part `done` and filed the part that
needed the missing link.

**The model's words for each kind** (`builder/site-add.mjs`). The add-on
picker's tool gains `scopes`: for each kind it picks, the customer's own
words for it. `readAddScopes` returns them raw; site-add may not import the
router's module, so the Worker checks them (`wordsIn`, against the step's
own instruction).

**Carried as parts** (`worker.js`, the add-on route). A frame item set aside
beside a page or section, and a list entry set aside beside other kinds
(`row-alone`), are carried when their words are found: they go into the
answer's held parts, so `deferred` names them and the request carves each
into a part of its own; the answer also lists them in `setAside`, and a
carried frame item is no longer said to be skipped (`aSkippedSaid`). A kind
with no words of the customer's stays in `skipped` or `notAdded`. The
hop-plus-row refusal is unchanged.

**Done means everything asked** (`builder/request.mjs`). `notDoneOf(answer,
op)` reads what an answer says it did not do (§ *What counts as done* in
`docs/request-flow.md`). Any of it, or a deferred word no part holds
(`carried`), makes the part `partial`, with `notDone` kept. `partial` is an
ending and counts as broken for what needs it, so a dependent is `not-run`;
the request ends `partial` when some part was done in whole or in part.

**What the customer reads**: a part done only in part — "its own reply
above says what was made and what was not" — and a part not started
because its prerequisite "was only partly done". The page labels it *Partly
done*.

**Tests** (`test/request-flow.test.mjs`, through the real routes with the
menu step and a site database that remembers):
- **M1**: a page and a menu link from one message; the link becomes its own
  part in the customer's words and the menu step makes it; final menus and
  pages checked.
- **M2**: additions and a list entry; the entry becomes its own part and is
  written as a row.
- **M3**: work that needs the set-aside link runs after the link's own part,
  against the menu the link made.
- **M4**: no words for the link: the addition is `partial`, the dependent is
  `not-run`, nothing is charged for it, and the facts say so.

Plus the decision cases in `test/request-plan.test.mjs`: every answer field
`notDoneOf` reads, an edit's `skipped` not read as an addition's, a partial
part 0 holding its dependent, words left over that are not the customer's,
and words that are all of the part (§7).

## 3. The acceptance, recoverable across its two writes

**The smallest change**: the marker is written **before** the record,
create-only. The sweep lists markers, so any record that exists now has
one. A marker that cannot be written stops the acceptance before anything
is saved; the files copied for it are deleted and the page holds the
message (`failed: true`). A marker whose record never landed is cleared by
the sweep once it is 15 minutes old (`ORPHAN_MARKER_MS`). The separate
marker write after the record is gone.

**Tests**:
- **J5** (rewritten): the routing call dies just after the record is
  written. **No browser, no resend and no `GET` of the request**: the
  two-minute sweep alone finds it and finishes every part, charged once.
- **J5b**: a resend after that is answered as a duplicate, with no second
  routing call or charge.
- **J8**: the marker write fails outright: nothing saved, nothing filed, the
  files deleted, the message held, the routing charge one.
- **J9**: the marker lands and the call dies before the record: nothing was
  accepted, and the sweep clears the lone marker once it is old enough.

## 4. The full rewrite's go-ahead, kept on the request

**What it was**: `needs-rewrite` ended the part, its dependents were
`not-run`, the request ended and let its files go, and the card's button ran
the page's own revise in the browser (`siteRequestRewrite`), outside the
request.

**What it is now**:
- **Waiting, not ended** (`approval`): the part keeps its place, what needs
  it stays `blocked`, independent parts go on, and the request keeps its
  files. Unanswered for a day it lapses (`expired`, `unapproved`).
- **The press** (`POST /api/site/request/<slug>/<key>/approve` `{ part }`)
  files the rewrite **through the existing queued build** — its row, its
  stored job (the revise the page posts, with the part's words, the
  request's files, the picked model and the customer's session) and its
  message — then records the go-ahead on the part. The build's consumer,
  design, page writer, compile, publish and charging are unchanged, and so
  is first Build.
- **One build per go-ahead**: its id is derived from the request, the part
  and that job's number, and is its row's idempotency key, so every press —
  a second one, another device's — reaches the same row. **A request's
  rewrite runs only under its own row's lease**: a delivery whose claim is
  refused builds nothing. (The build consumer otherwise builds when a claim
  is refused; a page's revise and first Build keep that.)
- **Crashes**: a press that dies after filing is recorded by the next step,
  which looks for the row under the derived id; a row still queued with no
  stored job is not counted given, and the next press files it; a send that
  fails deletes the stored job it wrote.
- **Stop**: cancels a recorded rewrite through its row and the id a waiting
  part's press would use; and the consumer reads the request before it
  starts, so a rewrite whose part no longer waits for it ends cancelled,
  nothing designed or charged.
- **Settled back** from the build's own answer: `done` only for a published
  site (`page: "app"`) — a placeholder answers `ok` with no site written,
  found by the experiment that first ran the real build on the test platform
  — `partial` for a salvage, `failed` with `rewrite-not-written` or the
  build's reason, `cancelled` when stopped. Its cost is the build's `cost`;
  an answer naming none leaves the part's money unknown. The end moves the
  request on (`requestRewriteEnded`: directly in the Worker, through the
  gateway's `/next` in the container), and the parts that needed it run.
- **Replies**: one while the request waits only on a go-ahead, keyed by that
  go-ahead (`replyFor: approval:<n>:<seq>`), saying what waits, why, the
  measured 17 credits, the button and the day; at the end, a part the
  rewrite made (every page written again, what it cost), one it could not
  write, or a go-ahead not given.
- **The page**: a *Rewrite the whole site for this* button posting to the
  request's go-ahead; *Starting…* while the press is in flight; *Full
  rewrite queued* or *in progress* once given; each request reply shown once
  by its `replyFor`. `siteRequestRewrite` and the page's copy of the files
  are gone.

**Tests** (the real queued build on the test platform: its designer and page
writer supplied, its compile the stand-in container):
- **N1**: the part waits with its files; the press stores the revise with
  the part's words and the request's file; the build runs and publishes the
  rewritten page; the part is `done` with the build's own cost, which the
  ledger's build rows match; the part that needed it runs after; the files
  go when the request ends; the end facts name the rewrite and its cost.
- **N2**: three presses, one from another device's session: one row, one
  build, run once with every message delivered twice; the very job the
  presses stored, written back and sent again after it ended, runs nothing
  and charges nothing; a reload and the site's request list show it given.
- **N3**: a press whose queue send fails is answered 503, the next look does
  not count it given, and the next press files the same row; the build
  writes no pages, so the part fails `rewrite-not-written`, the dependent is
  `not-run`, the site is unchanged, and the cost is the build's own.
- **N4**: stopped while waiting, the press is refused 409 and nothing is
  filed; stopped after the press, the rewrite ends at its gate before it
  designs or spends; and a press that read the request before the stop and
  filed after it is ended by the consumer's own read of the request.
- **N5**: a press dies after the row and before its stored job (the next
  press files it); a press dies after storing its job (no browser: the
  sweep's look records it, and the stale sweep sends it, once); a press
  whose record write fails, then Stop (the stop reaches its unrecorded
  build, which never designs).
- **N6**: a go-ahead not given in a day lapses; the dependent is `not-run`;
  the request ends and lets its files go; the facts say why.
- **N7**: a rewrite that ended where its request's step was lost moves the
  request on through `/next` under its own build's token; another build's
  token moves nothing.
- **F3** now waits for the go-ahead instead of ending, with its reply once.
- **PAGE 5** (the real page functions): the button; nothing starts until it
  is pressed; one POST to the go-ahead, never the rewrite route; another
  device's old button reaches the same rewrite; a reload reads it given; the
  server runs it with every page closed and the page shows both parts done
  and each reply once, after more than one look.

## 5. The UI canary in request mode

`scripts/canary-ui.mjs`:
- a request's card is not a reply (`card` in the page read; `newReplies`);
- a message whose routing answer names a request (`requestKeyOf`) is
  followed until the request has ended and the page has shown all of it,
  its view read through the page's own session every three seconds;
- **the wall, for work the server files, is the request's own Stop**
  (`requestWall`): a part routed outside the message's or scenario's
  layers, to the add-on step where the scenario never opens it, to an edit
  an additions scenario did not get from the add-on step (the view's
  `addition`), or waiting for the go-ahead. The Stop is let through the
  browser's wall for the scenario's own site only; the go-ahead's POST is
  refused like the rewrite route;
- its jobs are every id the request's view names (`requestJobsOf`), for the
  chain and the money; `requestVerdict` passes a request only with one
  routing call carrying the words, no edit posted from the page, and every
  part done where allowed;
- `scripts/edit-canary.mjs` checks a request's file on the routing call
  (`routeCallOf`); `scripts/canary-additions.mjs` reads a request's one part
  and only the answering step's reply.

Seven cases in `test/canary-ui.test.mjs`, through the stand-in page with a
request mode. **No request-mode canary press has been made.**

## 6. Guards kept

- `test/build-jobs.test.mjs` pins `if (row.row) {`: kept, with the answer
  parsed above it.
- `test/deploy-gate.test.mjs` pins the build-lease import's last names:
  `CANCELLED_MSG` sits earlier in that line.
- `test/site-add.test.mjs`: re-anchored to `skipped: aSkippedSaid,`, with
  the filter asserted.
- `test/canary-ui.test.mjs` forbids the routing route's path in edit-canary's
  UI branch and pins one import line: the routing call is read through
  `routeCallOf`, imported on a line of its own.

## 7. Verification

- **Red check** (this round's tests over `d5d383cc`'s code, in a worktree):
  F3, N1–N7, J5, J8, J9 and M1–M4 fail; J5b passes on both (a resend was
  already a duplicate); `canary-ui`, `request-plan` and `request-flow-page`
  fail to load, since the functions they read do not exist there; the
  re-anchored site-add guard fails.
- **Sweep**: 41 mutants over the Worker, the request module, the reply
  facts, the page and the canary, with five comment-only controls. The
  first run killed 38. The three survivors were test gaps, each closed and
  then killed in a rerun:
  - words in the message that are all of a part reached `carried`'s last
    line, which no case reached: a plan case added;
  - N2's stray carried a made-up one-letter job that the build refused
    early, so the lease rule was never what stopped it: it now replays the
    very job the presses stored;
  - PAGE 5 looked once while the go-ahead waited: it now looks twice.

  41 of 41, the controls 5 of 5, every file restored by hash.
- **Full suite**: `9228 / 9228 / 0 / 0` locally (from `9205`: 23 new cases,
  14 flow, 2 decision and 7 canary; PAGE 5 and J5 rewritten in place).
- **Screenshots**: the go-ahead waiting, given and done, and a part done in
  part, in Chromium, every API call answered by the real Worker on the test
  platform.

## 8. Remaining limits

The list is `docs/request-flow.md` § *Limits, as built*. In short:
supplied model answers only; a set-aside addition needs the picker's words;
a started rewrite runs to its end after a stop; a press dying between the
row and its stored job leaves a row the stale sweep fails if nobody presses
again; a resumed build settles at the next look; the go-ahead's job carries
the session of the press.

**Found and kept separate** (`docs/backlog.md`): a part may be carved from
its parent's words less a trailing full stop, which counts as shorter.

## 9. Not done

No merge, no deploy, no paid call or model call, no live migration, no
container build. The image moves with the code, predicted over both ends
(`containerInputs` and `imageId`) and not built: `main` (`b8d12ff9`)
`8bfc67dc695e65cc` (191 inputs) → `4fd05e68` `ca9a89c7bed78b38` (194
inputs); the branch before this round, `d5d383cc`, was `1a5437e9464f41e2`.
