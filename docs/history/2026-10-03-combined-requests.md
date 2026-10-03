# One message, several parts, finished on the server (2026-10-03)

On the owner's order, for review on `claude/help-needed-ehlwlj`.
**Unmerged, undeployed, and off by default** (`REQUEST_FLOW`). No container
was built, no model was called, nothing was spent, and no migration was
applied: none is needed. First Build is unchanged, and the limits audit was
not reopened.

- Code: `b1d96b3d` (the flow) and `b7564f82` (each unfinished part's charge
  read from its jobs' rows; the tests the sweep asked for).
- How it works now: `docs/request-flow.md`.
- The plan it came from: `docs/investigations/edit-addon-one-request-plan.md`.

## 1. The order

> Go ahead and implement the combined Edit/Add-on request flow on this
> branch, reusing our existing router, executors and job machinery. The goal
> is that one user message can request multiple edits and additions, and all
> accepted parts are remembered and processed without the user resending
> them or keeping the browser open. Keep first Build unchanged. Let the model
> identify each operation, its scope, target and dependencies using the
> actual capabilities of each route—do not reduce routing to “change means
> Edit, add means Add-on,” hardcode keywords or add example-specific rules.
> Code should validate the plan and manage execution, ordering, persistence
> and recovery. Store the original request, each part, clarification answers
> and durable attachment references on the server; preserve context so
> references like “it” remain meaningful. Run parts sequentially against the
> latest site state, keeping each part’s existing publish and charging
> behavior. Move the existing browser-driven handoffs to server coordination
> and reuse existing leases, site locks, idempotency, publication checkpoints
> and billing records wherever possible. An explicitly requested part should
> run without another confirmation merely because it crosses an internal
> route; retain existing credit checks and ask when proceeding would
> materially change the requested scope, including a full rewrite fallback.
> If a part needs clarification, have the model ask naturally and resume
> that part after the answer; independent parts may continue, while
> dependent parts wait or remain unrun if their prerequisite fails. Prevent
> duplicate execution and charging across retries, lost responses, duplicate
> delivery and multiple tabs, including the initial routing call; do not
> claim existing job recovery alone proves the new coordination is correct.
> Keep completed parts completed and preserve every unfinished part with an
> accurate status and reason. Provide a stop-remaining-work control using
> existing cancellation behavior. Normal customer-facing explanations must
> remain model-written from authoritative results; do not expand hardcoded
> conversational templates, and keep technical fallback messages limited to
> genuine technical failures. Make progress and questions recoverable after
> reopening the site or using another device. Use the smallest coherent
> implementation, document any necessary new storage or infrastructure, and
> avoid unrelated refactors or reopening the broader limits audit. Verify
> the actual flow with grouped free tests covering both route orders,
> multiple operations, prerequisites mentioned later, clarification and
> resume, attachments, closed-tab continuation, existing handoffs, partial
> failure, cancellation, duplicate delivery and crashes around publication
> and charging; check final site changes, stored statuses, customer-visible
> facts and ledger outcomes. Clearly distinguish supplied-model-answer tests
> from real-model evidence. Update the implementation docs and handoff with
> what is complete, what remains and any limitations, then push for review.
> Keep everything unmerged and undeployed; no live database migration, paid
> model calls or container image rebuild yet. If a required step needs
> those, finish the reviewable code and migration first and report the
> exact remaining action.

## 2. What was built

`docs/request-flow.md` is the full account. In short:

- **`builder/request.mjs`** (new) holds the decisions, with no storage or
  network:
  - the record and the parts;
  - the plan from the routing answer (`planParts`, with `dependsOn` and
    cycles refused);
  - parts found later (`carveParts`);
  - what a job's stored answer means for its part (`settle`, `readRun`,
    `readRoute`, `answerless`);
  - the hand-overs (`handOff`);
  - the next job, one at a time (`nextStep`);
  - answers (`answerPart`, `askedAgain`, `cancelPart`);
  - the replayed bodies (`jobBody`, the page's own);
  - the view (`requestView`) and each job's charge (`chargedOf`).
- **The router** names which held part needs which (`dependsOn`, read whole
  or not at all: `readDepends` in `builder/site-ask.mjs`). Every model call
  of a part is shown the original message, what earlier parts did, and the
  answers (`partBlock`, `withPart`, through `clarifyTransport`).
- **`worker.js`**:
  - **acceptance in the routing route**, keyed by the message (the switch,
    and `editAsyncFor`);
  - **storage in the site bucket**: the record, the files, the markers and
    the answer pointers, each with a create-only first write and
    compare-and-set updates;
  - **routing jobs**: the routing route replayed under the job's marker, with
    a gate before the model call and the charge through the job's reserve;
  - **the driver** (`advanceRequest`) and its callers: the consumer, the
    gateway's `/next`, answers, a question's cancel, the page, duplicates,
    and the two-minute sweep with a cursor;
  - **the owner's routes**: `GET`/`DELETE /api/site/request/<slug>/<key>` and
    `GET /api/site/requests/<slug>`;
  - **site deletion** removes the requests.
- **`builder/clarify.mjs`**: a question names its request and part, and
  `storeAskIfFree` puts a part's question in the slot only when the slot is
  free.
- **`builder/job-gateway.mjs` and `builder/container-env.mjs`**: the
  gateway's `/next` op, bound to the job's token, and `JOB_NEXT` in a site
  job's container.
- **`builder/site-reply.mjs`**:
  - a part's reply says the other parts are done separately by the same
    request (`inRequest`);
  - the request's own facts (`requestReplyFacts`), each unfinished part's
    charge from its rows, and the message's routing charge said once;
  - a question cancelled ends only its part.
- **`public/chat.js` and `styles.css`**: the page follows the request, with
  its card, statuses, *Stop the rest*, each part's reply, its question, and
  the rewrite button. It picks requests up on open, and a held message keeps
  its key.
- **`Dockerfile`** carries `builder/request.mjs`. **`deploy.yml`** uploads
  `REQUEST_FLOW`, default `off`.

## 3. Where it departs from the plan, and why

| The plan | As built | Why |
|---|---|---|
| A Postgres table, `edit_requests`, needing a migration (D8) | A record in the site bucket: create-only, then compare-and-set on its etag | The order rules out a live migration. The bucket already gives both writes, as the site's question record uses them. Nothing that needs a query (the sweep, the list) is more than a prefix listing |
| Accepted at the edit or add-on route's 202 | Accepted at the routing call | It is the first step that sees the whole message and the router's held parts. Part 0's run is then an ordinary job too, and the routing charge can be keyed by the message |
| D7: key part 0's routing charge by the message, "not in the first version" | Done: `credit_debit` with ref `route:<slug>:<key>` | The order: *"including the initial routing call"* |
| D2: a stored policy, A or B | B only | The order: *"independent parts may continue, while dependent parts wait or remain unrun"* |
| D4: the full rewrite as a question | The part waits as `needs-rewrite`. Its card has a button, and the request's reply says the measured cost | *"ask when proceeding would materially change the requested scope, including a full rewrite fallback"*. The press is the answer |
| `request_live` | `GET /api/site/requests/<slug>`, over the markers | No table to query |
| D9: a second message queued behind the first | Its own request. The two requests' jobs take turns under the site's lock, each still one at a time | The lock already orders them. Merging requests by their words would be a guess |

The others hold as proposed: D1 (later parts run without another press), D3
(a reply per part and one for what none explains), D5 (one retry of a job
with no answer) and D6 (a day on a question).

## 4. How it was checked (all free; supplied model answers only)

**No real model was asked anything.** Every model answer in these tests,
including the router's, the picker's, each lane's, the add-on's, the page
writer's and the reply writer's, is supplied by the test. They prove the
code's handling of those answers, not what a real model answers.

**The tests**:
- `test/request-flow.test.mjs`, 44 cases through the real Worker on a
  stateful platform (`test/fixtures/request-flow.mjs`). Its `edit_jobs`,
  ledger, bucket, queue and clock keep state as the real ones do, and it can
  crash an invocation at any call. Each case reads what happened: the stored
  pages and look, the record and job rows, the reply writer's facts, and
  every ledger row. The groups:
  - A, both route orders and three operations;
  - B, a prerequisite named later, and one that fails;
  - C, questions: from a part's routing, from a step beside an independent
    part, waiting for the slot, cancelled, expired;
  - D, attachments, the message's and an answer's;
  - E, the closed tab (the sweep), another device, the sweep's pages, site
    deletion, the container's `/next`, and looks and owners;
  - F, the hand-overs, their bounds, and body parity with the page;
  - G, a routing failure;
  - H, Stop: before anything, after a part, mid-publish, after a lost
    filing, mid-step; and the charge facts;
  - I, duplicates: a resent message, two tabs, every job delivered twice, an
    answer resent;
  - J, crashes: after a charge, after a publish, mid-publish, after the
    routing debit, after the record, a stored request that failed to write,
    after the row;
  - K, a part's reply;
  - L, the switch off, and first Build untouched.
- `test/request-flow-page.test.mjs`: 6 cases. The page's own functions run
  against the real Worker: following, another device, a question answered on
  the card, Stop with the request's reply shown once, the rewrite button, and
  a lost answer resent under the same key.
- `test/request-plan.test.mjs`: 29 decision cases.
- Re-anchored guards: `addon-queue`, `canary-probes`, `edit-poll`,
  `publish-pages`, `route-decision`, `site-apply`, `site-ask`.

**Red check**, run in a worktree at the code before this round
(`70980129`):
- the new and changed tests over the old code: **12 of 442 fail, 430
  pass**. The three new files fail whole (no request module), and nine
  re-anchored guards fail;
- the new code with only the Worker put back: **46 of 79 fail**, every case
  that goes through the Worker's acceptance. The decision cases, the
  body-parity case, the hand-over bound case and the switch-off and
  first-build cases pass;
- the new code with only the page put back: the page file fails whole, and
  the other 73 pass.

**Mutation sweeps**, from a verified-green baseline, with every file restored
and checked by hash:
- **first sweep: 40 of 46 caught**, all 4 comment-only controls survived.
  The six survivors were:
  - a job filed after a stop not cancelled;
  - the record written without its compare-and-set;
  - another owner's request read or stopped;
  - another owner's request listed;
  - a look that writes when nothing moved;
  - the request's own reply never shown.

  Each was a gap in the tests, not in the code. Tests H4, H5, E6 and PAGE 4
  were added for them;
- **second sweep, with the six charge mutants added: 52 of 52 caught**, all
  4 controls survived.

**Full suite**: `9200 / 9200 / 0 / 0` on `b1d96b3d`, and
`9205 / 9205 / 0 / 0` on `b7564f82` (from `9126`).

**CI on the push, green**:
- unit tests `9205 / 9201 / 0 / 4` on `9b348401` (the code and these
  records; run 37144978406). The total is the local one exactly, and CI
  skips four, as always;
- the site build on the same commit: 404 checks in 27 sections across 4
  shards, every job green (run 37144978309).

**The image would roll on a merge**: main `8bfc67dc695e65cc` (191 inputs),
this code `1a5437e9464f41e2` (194 inputs). The new input is
`builder/request.mjs`; the other two come from earlier rounds on this
branch. Predicted only; nothing built.

**Screenshots** of the request's card, rendered headless in Chromium from
the page's own markup and styles and sent in the chat:
- a request accepted;
- every part done;
- a part asking;
- the answer taken;
- stopped;
- a part needing the rewrite;
- the same request on another device.

## 5. Found and fixed during the round

- **The sweep could not get past its first page of markers.** It listed
  from the first key every tick, and markers stay a day after their
  request ends. It now keeps a cursor (E3).
- **A site called `live` would have shared every marker's prefix.**
  Deleting it would have wiped them all. The markers moved to
  `requests-live/`.
- **Deleting a site left its requests**, and an unfinished one would have
  routed its next part, a paid call, for a site that was gone. They are
  wiped now, markers first (E4).
- **The container's `/next` was untested.** E5 drives it three ways: the
  container's call, the gateway's checks, and the Worker's own mount.
- **The request's reply said "Nothing was charged for it" without
  evidence.** A later part's own routing is charged before it runs. It is
  now read from the jobs' rows (H6).

## 6. Found and kept separate (`docs/backlog.md`)

- **A run job stopped while still queued makes its model calls anyway.**
  It is caught at its publish gate and refunded: the job runner's behavior
  today. A routing job checks its gate before its model call.
- **Deleting a site leaves `source/<slug>/` behind**: the page source, the
  stored answers and the question record. So a slug's next owner could
  inherit them. This predates this round.
- **The UI canary expects the page to post its own edit.** The edit canary
  has no request mode.
- **Request records, answer pointers and replies have no retention
  window.** They go with the site.

## 7. What remains

1. **The owner's review**, and a merge on their word. The image rolls (§4).
2. **Before the switch goes on**: adapt the UI canary
   (`scripts/canary-ui.mjs`) to a request the server runs. Then set the
   `REQUEST_FLOW` secret to `on` and redeploy.
3. **Real-model evidence**: a small batch of real messages through a live
   site, paid, needing the owner's approval with the exact messages and an
   estimate. Not prepared in this round.
4. **No migration, and no new infrastructure** beyond the bucket prefixes
   above and the cron the sweeps already use.
