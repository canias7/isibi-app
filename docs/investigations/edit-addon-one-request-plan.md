# Finishing Edit and Add-on work from one request: the plan, revised (built on the branch, 2026-10-03)

> **The order** (owner, 2026-10-03, the review of the first plan): *"the
> proposed browser-driven continuation can stall after the tab closes, and
> moving pending to running before routing does not by itself define how
> execution then claims the same part or how a crash is recovered. Reuse the
> existing server job runner, leases and idempotency mechanisms wherever
> possible so an accepted request can progress without an open browser; the
> browser should display progress and supply clarification, not be the only
> trigger for unfinished work. Specify routing, execution, publication and
> charge checkpoints separately, including recovery after a lost response, a
> crash before or after a publish, and duplicate requests from another tab.
> Preserve the original request, each operation's scope and target, relevant
> answers, and durable attachment references … Explain how multiple dependent
> operations are ordered even when the user mentions prerequisites later in the
> sentence; let the model identify those relationships, with code enforcing
> execution state … Define what happens when a continued part itself defers
> work, asks a question, fails, or changes the site address; prevent cycles,
> duplicate execution, duplicate charging and accidental loss of unrelated
> pending parts. Keep independent-work continuation versus stop-on-failure as
> an explicit proposed policy … Report queued work as queued until it actually
> starts, and distinguish completed work from failed, waiting and unverified
> work throughout. Keep this the smallest extension of existing executors and
> job machinery, with sequential writes and first Build unchanged; do not
> implement the cross-route continuation yet."*
>
> **Status now: built on `claude/help-needed-ehlwlj` (2026-10-03, `b1d96b3d`
> and `b7564f82`), unmerged and undeployed, and off by default
> (`REQUEST_FLOW`).** How it works as built is `docs/request-flow.md`.
> Where the build departs from this plan, and why, is
> `docs/history/2026-10-03-combined-requests.md` §3:
> - the record is in the site bucket, so no migration is needed;
> - a message is accepted at the routing call;
> - the routing charge is keyed by the message (D7);
> - only failure policy B is built;
> - the full rewrite waits for a button.
>
> The plan below is kept as it was proposed.
>
> **Status when written: a proposal for your review. Nothing in it is built.** It replaces
> the first plan (2026-10-03, `ddbde31a`/`f26e00e2`), whose browser-driven
> chain §1 explains. It builds on the mixed-work fixes on
> `claude/help-needed-ehlwlj` (unmerged): several parts left for later per
> message, each named by its own words.

## 1. What the first plan got wrong, and the principle that replaces it

- **The browser drove the chain.** The page routed and posted each later
  part after showing the one before. Close the tab between parts and the
  request stops, with the rest accepted and never run.
- **A part had its own `pending → running` mark, separate from any job.**
  Nothing said how the job that runs the part claims it, and a crash after
  the mark left the part "running" for ever: no lease covered it, and no
  sweep could tell a live part from a dead one.

**The principle now: a part's state is its jobs' rows.** Each step of a part
(routing it, running it, each hand-over) is an ordinary row in `edit_jobs`,
filed under a key derived from the request, so filing it twice finds the same
row. The claim, the lease, the heartbeat, the site's lock, the reserves, the
publish marks, the refund, the reconcile and the sweeps are the job runner's,
unchanged. A small **driver** reads those rows and files the next one. Nothing
holds a mark that a crash can leave behind.

## 2. Where the other half goes today (traced, unchanged since the first plan)

A message reaches **one route**. Whatever that route cannot make is carried on
its answer in the customer's own words, and the customer is asked to send it
again:

| Who leaves it for later | The field on the answer | Its words kept? | What the customer reads |
|---|---|---|---|
| **The router**: a part no single answer can make with the rest (`alsoAsked`, a list on a site since this branch) | `deferred` | yes, checked against the message (`heldParts`) | *"I only did part of it this time. Say “…”, then “…”, and I'll do those next."* (`alsoTail` in `public/chat.js`) |
| **The look door**: an addition beside other edit work (W15, `lookHeld`) | `deferred` (with the router's) | yes | the same sentence |
| **The edit picker**: a part no lane here can make (`elsewhere`, this branch) | `deferred` (with the router's) | yes, checked (`readElsewhere`) | the same sentence |
| **A resumed question's request**: parts put off before the question, carried in | `putOff` | yes | the same sentence |
| **The add-on step**: a new list entry (`row`) or a menu link (`frame`) beside other kinds | `notAdded` (`row-alone`), `skipped: ["frame"]` | **no**: the add-on picker answers kinds only | *"A new entry for one of the site's lists is a step of its own …"* |

And three hand-overs are **chained by the browser today** (`escalatedEdit` in
`public/chat.js`, decided by `EditPoll.escalateAction`):

- an edit step that finds an addition hands the same message to the add-on
  route;
- a step that names another edit layer hops sideways to it;
- the add-on hands a lone menu link to the menu step, which may not hand it
  back.

They stall the same way when the tab closes after the first job ends. This
plan moves them to the server with the held parts.

## 3. The design in one paragraph

When the browser posts a message to the edit or add-on route (the existing
acceptance point, the 202), the route stores a **request** record: the
original message, durable copies of its files, the answers given, and its
**parts**. Each part has its own words, its scope and target, and the parts it
needs done first, as the model named them. The route then files the first part
that may run, as an ordinary queued job. Each job reaches a terminal state
through the existing runner. Then the **driver** reads the rows, records the
part's outcome, adds any parts that job left for later, and files the next
runnable part's job.

The driver runs:
- in the Worker's consumer after an inline job;
- from the container through one new gateway call after a container job;
- after an answer is recorded;
- from the two-minute cron, for any request whose next step is missing.

So the request finishes with no browser open. The browser follows the
request and carries answers to its questions. It never files a part.

This is the pattern the platform rebuild drain already uses
(`runSiteRebuild`, `site-rebuild.mjs`). There, the row is the queue, the job
never touches it, `rebuildIdem` names each attempt so filing it twice finds
the same job, and a job that ended with no readable answer is retried under
the next attempt's name.

## 4. What it reuses, unchanged

| Mechanism | Where | What it gives a request |
|---|---|---|
| `edit_jobs` row, unique on `(uid, slug, op, idem_key)` | `edit_create` | one job per derived key: a second filing answers the first job (`duplicate`), never a second run |
| row, then object, then message | `enqueueEditJob` | a part job's stored POST, replayed later; a lost step is found by the stale sweep |
| the replay of a stored POST through the real handler | `runQueuedSiteEdit`, `editReplayUser` | every part runs the same code, gates and publish decisions as a message sent by hand |
| claim, takeover by name, lease 90 s, beat 30 s | `edit_claim`, `edit_handoff`, `edit_beat` | one runner per part job; a dead runner's lease lapses |
| one job per site, deferred 67 s when busy, capped | `edit_claim` under the site lock, `deferEditJob` | sequential writes, across parts and across requests |
| deploy gate | `edit_claim(p_deploy)` | a part never starts in an isolate being evicted |
| sequenced reserves, ledger unique on `(ref, reason)` | `edit_reserve(p_id, p_seq, …)`, ref `job#seq` | each model call of a part job charged once, whatever is redelivered |
| publish marks | `edit_may_publish`, `edit_publish_mark`, `edit_committed`, `edit_finalize` | one publish per part that changed something, each its own saved version |
| refund, conditional at the database | `edit_refund` | refuses a published job; routes a mid-publish one to review |
| lost and stale sweeps, every 2 minutes | `edit_sweep_lost`, `edit_sweep_stale` (`runLostEditJobs`) | a dead job is refunded, finalized as recovered, or parked for review |
| the reconcile | `site-reconcile.mjs`, `runReviewReconcile` | a publish that might have landed is settled from the pointer, the live script and the staged version |
| a site under review takes no new jobs | `edit_create` (`needs-review`) | no part builds on a publish nobody has confirmed |
| cancel | `edit_cancel` (`DELETE /api/site/edit/<id>`) | the live part stops before it publishes; `too-late` after |
| the question record, one live per site, closed once on its etag, 24 h | `clarify.mjs` (`packAsk`, `closeAsk`, `ASK_TTL_MS`) | a part's question and its answer |
| answers beside the words, shown to the step that needs them | `clarifyTransport`, `readContext`, the picker's `told` | what earlier answers settled reaches each later part |
| the size policy | `input-budget.mjs`: 16,000 characters a message, 48,000 carried | a request carries its parts and answers inside the existing budget, refused past it, never cut |

## 5. The one new record: the request

### 5.1 The row

A Postgres table beside `edit_jobs`. It needs a migration, applied only on
your word (decision D8): service role only, RLS on, no client access, the same
mint check as the edit RPCs. **`edit_jobs` itself does not change.**

| Column | What it holds |
|---|---|
| `id` | 32 hex, minted at acceptance |
| `uid`, `slug` | the owner and the site's **storage** slug (never the public address, §9.4) |
| `idem_key` | the browser's key for the message (32 hex, `EditPoll.newIdemKey`); **unique `(uid, slug, idem_key)`** |
| `message` | the original message, whole (inside `MAX_INPUT_CHARS`) |
| `files` | `[{ key, sha256, type, bytes, name, from }]`: durable copies (§5.4) |
| `context` | the answers given, in `readContext`'s shape, each marked with the part that asked |
| `policy` | `independent` or `stop` (§10, decision D2) |
| `parts` | §5.2 |
| `state` | `running`, `waiting`, `review`, or terminal: `done`, `partial`, `failed`, `cancelled`, `expired` |
| `version` | compare-and-set: every write names the version it read |
| `created_at`, `updated_at`, `due_at` | `due_at` is when the cron should look again |

Five RPCs, each small:
- `request_create`: idempotent on the unique key; refuses `needs-review` as
  `edit_create` does, so nothing is accepted that cannot run;
- `request_cas`: a write on the version read, refused when another writer
  moved it first;
- `request_get` and `request_live`: owner-scoped reads, by id, and by site
  (the site's unfinished requests, and those finished in the last 24 hours);
- `request_due`: the cron's selection.

**The decisions live in a pure module (`builder/request.mjs`), not in SQL**,
so they are tested without a database. The database's part is atomicity and
uniqueness, which a rolled-back check script drives (§16).

### 5.2 A part

| Field | What it is |
|---|---|
| `n` | its number, stable for the life of the request |
| `words` | its exact words, found in `message` (`wordsIn`); for the part the router answers first, the message with every held part taken out (`heldBack`, as the routes compute today) |
| `at` | where its words start in the message: the tie-break among parts with no relation (§8), never a dependency |
| `source` | `router`, `picker`, `look`, `addon`, or the number of the part it was carved from (`parent`) |
| `needs` | the parts it needs done first, as the model named them (§8), plus its parent when carved from one |
| `route` | the routing answer it runs with, once routed: `intent`, `layer`, `page`, `remove`, `rename`, `tab`, `handOver` |
| `attempts`, `hops` | which job keys may exist for it (§6.3) |
| `question` | while it waits: the question's id, text, options and round |
| `outcome` | once terminal: `{ status, job, said }`, where the job's stored answer is the authority (its `steps`, targets, `partial`, publishes) and `said` is a short summary for later parts (§5.3) |
| `status` | derived from its jobs' rows at every driver step (§6.4), stored so a read needs no join |

**Scope and target per operation stay where they are now**: the routing
answer names the layer and page; inside the part, the picker's `scopes` name
each change's page and words; each step's outcome carries its target (`steps`,
`partial`, `refusedLinks`, `dropped`: the mixed-work fixes). The request keeps
a reference to the job whose stored answer holds them. It does not keep a
second copy that could disagree.

### 5.3 What a continued part's job is given, so "it" keeps its meaning

A part's words alone can lose their referent: in *"Add a gallery page and put
it in the menu"*, the part *"put it in the menu"* does not say what "it" is.
So every model call made for a part is shown one more section, after
everything else it holds. It is added by the same wrapper that shows the
answers already given (`clarifyTransport`), so no step's request builder
changes:

- **the whole original message**, labelled as the request this part came
  from, *only to know what its words refer to, never a reason to do more*;
- **what earlier parts did**: each done part's words and its `said` summary,
  for example *"added the page /gallery"* or *"renamed the site to
  harbour-loaf"*;
- **the answers given so far**, as today (`context`, with `told` choosing what
  each step is shown).

The part's **own words stay the only thing it may act on**, and every step's
scope checks are unchanged. Nothing is paraphrased: the model reads the
customer's own message, and code never rewrites a part into words of its own.

### 5.4 Files: durable references, not a boolean

Today a message's files live in the browser. The question record keeps only
`attached: true`. Of the edit and add-on routes, only the logo step receives
the files (`images` is posted on the `logo` layer alone, `public/chat.js`).
The full rewrite takes them too, but it is the build's pipeline (§9.5). A part
that runs later needs them on the server:

- at acceptance, each file in the POST is stored once, content-hashed, under
  `jobs/request/<slug>/<idem_key>/<sha256>.<ext>`. Storing them again on a
  duplicate POST writes the same bytes to the same key. The row keeps
  `{ key, sha256, type, bytes, name, from: "message" }`;
- **an answer's own files** are stored the same way, `from: "answer:<round>"`;
- when the driver files a part's job, it copies the files that part's step
  reads into the job's stored body, as `images`, exactly as the page posts
  them now: today, the part routed to the `logo` layer. So the job is
  self-contained, and **the job gateway's wall does not widen** (a container
  job reads only its own `jobs/edit/<id>`);
- `runJobRetention` (which removes `jobs/` objects older than a week) skips a
  request's prefix while the request is not terminal;
- a file that is missing when a part needs it fails that part with that reason
  and the file's name. Nothing runs without it.

## 6. The driver: who moves a request forward

### 6.1 When it runs (one function, four callers)

`advanceRequest(env, requestId)`, idempotent, runs a single step:

1. **The edit or add-on route, at acceptance**: it files the first part that
   may run.
2. **After a part job reaches a terminal state.** In the Worker's consumer
   (an inline job), right after `edit_finalize` or `edit_refund`. In the
   container, which has no queue and may not call `edit_create`
   (`SB_RPCS`), through **one new gateway op, `POST /api/job/<id>/next`**.
   It is bound to the job's own signed token and takes no argument, so it can
   only advance the request that job belongs to.
3. **The answer path**, after an answer is recorded for a waiting part (§9.2).
4. **The cron, every 2 minutes**, after `runLostEditJobs`
   (`runRequestSweep`). It steps every live request whose `due_at` has passed.
   This is the guarantee: callers 1–3 are fast paths, and any of them can be
   lost (a dropped gateway call, an isolate evicted between the finalize and
   the step) without stalling anything.

### 6.2 One step

```
read the request (version v) and the job rows its parts' keys name
for each part with a terminal job not yet recorded:
    record the outcome (route answer / execution result / hand-over / failure)
    add the parts that job left for later (§9.1)
derive every part's status (§6.4); apply the policy (§10)
if no job of this request is live and some part may run:
    choose it: every part it needs (and every part carved from those) is done;
               among several, the earliest in the message
    record the job about to be filed (attempts or hops + 1)
write the request on version v (refused: read again, start over)
file that job through enqueueEditJob under its derived key
set due_at: soon while a job is live, later while waiting
```

**One live job per request.** That gives sequential writes within a request,
and the site's lock already gives them across requests. **Write, then file**:
a crash between the two leaves a recorded attempt with no row. The next step
files it under the same key. A step that loses the version race files nothing.
A second driver that computed the same thing files the same key and gets the
first row back. When `enqueueEditJob` answers `duplicate` for a job still
`queued` whose stored object is missing (the first filer died after the row),
the driver stores the object again from the request row and sends the message
again. A second message is harmless, because the claim refuses it.

### 6.3 Names: one job per attempt

With `K` the browser's key:

| Job | Op | Key |
|---|---|---|
| part 0, as posted by the browser (unchanged) | `edit` / `addon` | `K` |
| routing part n, attempt k | `route` (new op name; `op` is free text, as `rebuild` already is) | `K-r<n>-<k>` |
| running part n, attempt k, hand-over h | `edit` / `addon` | `K-p<n>-<k>-<h>` |

All fit `edit_create`'s `^[A-Za-z0-9_-]{16,64}$`. **No column is added to
`edit_jobs`**: the request is found from a job by its key's prefix, and a
job's part by its suffix.

### 6.4 A part's status is read from its jobs

| Status | Read from | Said to the customer as |
|---|---|---|
| `blocked` | a part it needs is not done yet | *waiting for “…” first* |
| `queued` | its job's row is `queued` (filed, **not claimed**) | **queued, not started** |
| `started` | its routing or running job is claimed (`claimed`, `routing`, `editing`, `building`, `publishing`, …) | being done now |
| `waiting` | it asked a question (§9.2) | the question, with its options |
| `done` | its job ended `done` with a stored answer saying what changed (published) or that nothing needed to | done: what changed, and on which page |
| `done-unrecorded` | the sweep finalized it as `recovered`: it went live, and the details of what it did were lost | published; what it changed was not recorded |
| `unverified` | its job is in review (`needs_review`): publishing began and was not confirmed | not known yet whether it went live; checking |
| `failed` | its job ended with its own reason | failed, with that reason |
| `not-run` | never filed: a part it needs failed, was cancelled or expired, or policy `stop` (§10) | not started, and why |
| `cancelled` | stopped by the customer before it published | stopped |
| `expired` | its question went unanswered for 24 hours | not done; the question it asked |

**Queued stays queued until a runner claims its job.** Nothing describes a
part as being done, or done, before its own row says so.

## 7. The four checkpoints, separately

### 7.1 Routing

- **Part 0** is routed by the browser's existing call (`/api/site/route`),
  before acceptance, charged through `collectCredits` as today.
- **Every later part is routed by a `route` job.** Its stored POST is
  `/api/site/route` with the part's words as `message`, the request's id and
  part, and the answers given. The consumer replays it like any job. The
  routing route gains three things under a replay (`editReplayUser`, the same
  door the edit route uses):
  1. it builds the site's digest from the store, where the browser would have
     sent it (the page list and table names are read from the store already);
  2. it charges the call through **the job's own reserve**
     (`edit_reserve(job, 1)`, ledger ref `job#1`) instead of the bearer
     collect, because a job holds no token;
  3. it skips the waiting-question read, because a part's words are not an
     answer.
- The routing answer becomes the part's `route`:
  - `edit` or `addon`: it runs next (§7.2);
  - `clarify`: the part waits (§9.2);
  - `ask` (a question about the site): the part is done, the answer is its
    outcome, and nothing is published.
- The routing answer's own parts left for later, with their relations, join
  the request (§9.1).

### 7.2 Execution

- A part's running job is stored as **exactly the POST the page sends after
  routing today**: the part's words, the routing answer's fields, the answers,
  the files its step reads (§5.4), `askRound`, and `request: { id, part }`.
  `runQueuedSiteEdit` replays it through the real handler. Claim, lease,
  budget (50 minutes, `JOB_MAX_MS`), the site's lock, deferrals and cancel are
  the runner's.
- **Hand-overs move to the server.** The job's stored answer names its
  escalation, as today. The driver files the next job for the **same part**
  (hand-over `h + 1`), using today's rules, which move from
  `EditPoll.escalateAction` and `EditPoll.handOver` into `builder/request.mjs`:
  - an edit naming `addon` goes to the add-on route, unless the add-on handed
    this part over (then the chain stops, `fromAddon`);
  - a step naming another layer hops to it;
  - at most two hand-overs per part, as `handedOff` bounds them today;
  - a hand-over carries where it goes and the part's context, never the first
    answer's verbs (W1).
- **The full rewrite (`up`) is not started by the driver** (§9.5).

### 7.3 Publication

- **Unchanged per job**: `edit_may_publish` → `edit_publish_mark`
  (`publish_started_at`) → stage → pointer → `edit_committed`
  (`published_at`) → `edit_finalize`. One publish per part that changed
  something, so each part is its own saved version and can be rolled back on
  its own.
- A later part reads the site from the store when it starts (pages, look,
  schema, tables), so **it sees what earlier parts published**. A menu link
  routed after "add a gallery page" finds `/gallery` among the pages.
- Between parts the live site shows the parts done so far. The request's
  status says which parts those are (§13).

### 7.4 Charges

- **Every model call made for a later part is charged through its own jobs'
  sequenced reserves** (`edit_reserve(job, seq)`, ledger ref `job#seq`,
  unique on `(ref, reason)`). A redelivered message, a takeover or a second
  driver never charges twice.
- **A new attempt is filed only once the previous attempt holds no money**:
  its billing is `none`, `refunded` or `exempt`, never `reserved` or
  `finalized`. So the customer is charged once for a part, net, however many
  times our side retried it. The model cost of a retry is ours.
- **Only a job that ended without running to an answer is retried**
  (`answerless`, decision D5):
  - no stored answer at all (a lapsed lease, a consumer that threw, a missing
    request object);
  - or the stale sweep's own `stale` answer (never claimed).
  - Its publish never began, and it holds no money. A job that answered,
    even with a refusal or the busy sentence, is that part's outcome.
- A part that is `blocked`, `not-run`, `cancelled` or `expired` was never
  filed and was charged nothing.
- The refund and the finalize are the runner's, per job, as today.
- Part 0's routing call stays as today. Before acceptance, a lost routing
  response that the page asks again is routed and charged again. Nothing was
  accepted, so nothing runs twice. Decision D7 is whether to key that call by
  the message's key as well.
- **Founders** are `exempt` on every job, as today.

### 7.5 Recovery, case by case

| What happens | What the machinery does | Charged | What the customer reads |
|---|---|---|---|
| The 202 to the browser is lost | the page retries with the same key: `request_create` answers the existing request | once | the request as it stands |
| Another tab, or a reload, posts the same message again with the same key | the same | once | the same request |
| The response to an answer is lost, and the page sends the answer again | the question is already closed on its etag, and the routing route refuses a closed question before any model call (`askLive`, as today), so the second answer changes nothing; the part is already routed and filed | once (the first answer's routing call) | the part's status: queued, or started |
| Two tabs answer the same question at once | exactly one closes it (`closeAsk` on the etag); the other is told it was answered elsewhere | once | the part's status |
| The driver dies between its write and filing | the cron's step files the recorded attempt under the same key | once | queued, then the part |
| `edit_create` landed but its answer was lost | the next filing answers `duplicate`; the driver stores the object again and sends again (§6.2) | once | queued |
| The row exists, but its object and message never landed | the driver repairs it; failing that, the stale sweep sends it again once, then fails it as `stale` (never claimed), and the driver files attempt 2 (§7.4) | once (attempt 1 held nothing) | queued, then the part |
| A queue message is delivered twice | the second claim finds the job leased or terminal and leaves | once | — |
| The runner dies **before** `publish_started_at` | the lease lapses; `edit_sweep_lost` refunds; the job is `lost` with no answer; the driver files attempt 2 (D5: once) | once, net | the part, or *"stopped before it changed anything; nothing charged"* when attempt 2 is spent too |
| The runner dies **after** `publish_started_at`, before `published_at` | the refund routes it to review; the site takes no new jobs; the request is `review`; `runReviewReconcile` decides `kept` (the part is done) or `refunded` (failed, nothing live), and the cron's step continues | as decided | `unverified` until settled; nothing else runs meanwhile |
| The runner dies **after** `published_at`, before the finalize | `edit_sweep_lost` finalizes it as `recovered`; the driver records `done-unrecorded` and continues | the reserve stands (the change is live) | published; what it changed was not recorded |
| The routing job dies after its reserve | the sweep refunds it; attempt 2 routes again | once, net | queued, then the part |
| The gateway's `next` call is lost | the cron's step | — | — |
| A deploy rolls mid-request | claims are refused under the gate and deferred, as for any job | — | queued |
| The site is held by another request's job | the claim is deferred 67 s, up to the cap; past it, the job fails with the busy sentence, which is that part's reason (§10 applies) | nothing (it never ran) | that part's reason |

## 8. Order: relations named by the model, enforced by code

**The router names the relations. Code decides what may run.** Two new
fields go on the site's routing tool (`LIVE_ASK_TOOL`). The first build's
tool (`ASK_TOOL`) is unchanged, and its hash stays pinned by
`live-clarify-contract`:

- each `alsoAsked` item may be `{ words, needs }`, where `needs` lists the
  positions of the changes it needs done first: `0` is the change this answer
  makes now, and `1…` are the items of `alsoAsked`, in order. A plain string,
  today's shape, states no relation;
- `needsFirst`: the positions (`1…`) that **the change this answer makes**
  needs done first.

One paragraph is added to the site instructions, next to the whole-message
rule: *when one change needs another to exist or be done first — a link to a
page that is still to be made, a code for an address that is still to change
— answer a change that needs nothing else first; hold back the rest; and for
each change, say which others it needs, wherever they come in the message.*

Code (`readParts` in `builder/request.mjs`) then:

- checks every position, refuses a part that needs itself, and builds the
  graph over the request's parts. **A cycle makes those relations unusable.**
  The parts involved are not run on a guessed order. Each is named: *"I
  couldn't tell which of these has to happen first."*;
- **holds part 0 back when `needsFirst` names anything.** Its prerequisites
  run first, and part 0 is **routed again** when its turn comes (a `route`
  job), against the site as it then is. The browser's routing answer was made
  before its prerequisite existed;
- runs a part only when every part it needs, and every part carved from
  those, is `done` (§9.1);
- orders parts with no relation between them by where they start in the
  message. **That is a tie-break, never a dependency.**

**A prerequisite mentioned later in the sentence**: *"Put a Gallery link in
the menu once you've added a gallery page with our six photos."*

- The router may answer `addon` for the page and hold back the link with
  `needs: [0]`. The link runs after the page, and the menu step finds
  `/gallery`.
- Or `addon` may make the page and set the menu link aside as a `frame` kind.
  The link is then a part carved from the page's part, and runs after it by
  structure.
- Or the router may answer `nav` for the link with `needsFirst: [1]`. Code
  holds the link, runs the page, then routes the link again.

**The limit, stated**: the relation is the model's judgement. If the model
misses one, the dependent part runs first, and the steps' own existence checks
refuse it, named:
- *"There's no /gallery page on the site yet, so I left “Gallery” out"* (the
  menu step's `no-such-page`);
- a function on a table that does not exist is refused.

Nothing is corrupted. The routing call may be spent (1–2 credits measured),
and the customer sends that part again. It is not retried on its own,
because a retry after the prerequisite exists would be a guess about the
cause.

## 9. When a continued part …

### 9.1 … leaves work for later

- **Sources**: a `route` job's `alsoAsked`; the picker's `elsewhere`; the look
  door's held additions; the add-on's set-aside `row` and `frame`, once the
  add-on picker names each kind's words (a `scopes` list `[{ kind, words }]`,
  checked with `wordsIn`, the one change §15 makes to the add-on step).
- Each becomes **a new part of the same request**, never a new request:
  - its words are found word for word in the message;
  - its relations come from the answer that left it (positions mapped onto
    request parts), and it **needs its parent**, because only the parent's
    run knows it is separate;
  - a part that needed the parent also needs every part carved from it,
    since its words included theirs.
- **Cycles cannot form**:
  - a carved part's words are **strictly shorter** than its parent's, so a
    chain of carvings ends;
  - an answer that leaves a part's own whole words for later is that part
    failing with *no progress*, named;
  - words identical to, or contained in, an existing part's are that part,
    not a second one.
- Parts left for later stay inside `MAX_CARRIED_CHARS` (48,000), as today.

### 9.2 … asks a question

- The question is stored exactly as today, in the site's question record
  (`packAsk`), with `request` set to the part's words, and **two new optional
  fields, `requestId` and `part`** (record v3; v2 is still read). The request
  keeps a copy (`question`).
- The part is `waiting`. A part that needs it stays `blocked`. Others follow
  the policy (§10).
- **Answering it is the existing answer path**: the page posts the answer to
  `/api/site/route`, and the route closes the question once, on its etag.
  For a question with `requestId`:
  - the answer joins the request's `context` (marked with that part), and an
    answer's files are stored with the request;
  - **that same routing call has already decided the waiting part with the
    answer beside it, as it does today** (`routeMessage` is given the waiting
    request and its question as `pending`). The decision becomes the part's
    `route`, the driver steps, and the part's running job is filed. There is
    no second routing call. If that call asks again, the part keeps waiting
    on the new question, its round counting up as today;
  - only that part resumes. Done parts are never run again (their keys
    already hold terminal rows), and other waiting or queued parts are not
    touched.
- **Expiry**: after 24 hours (`ASK_TTL_MS`) the part is `expired`. It is
  named with its question, and parts that need it are `not-run`.
- **Superseded**: there is still one live question per site. When a newer
  question takes the record, the request keeps its part's question, and the
  cron's step offers it again (stored again with a new id, the same round)
  once the record is free, until it expires. The page shows every waiting
  part's question from the requests it follows, not only the record's.

### 9.3 … fails

- Its own reason is its outcome (its job's stored answer). Parts that need it
  are `not-run`: *"it needed “…”, which didn't work"*. Other parts follow the
  policy (§10).
- **Not retried**, unless its job ended with no answer at all (§7.4, D5). A
  failure with a reason is a fact about the request, not about our side.

### 9.4 … changes the site's address

- A rename is an **alias** (`site-alias.mjs`). The storage slug never moves,
  and *"nothing anywhere may assume they are equal"*. The request, its jobs'
  keys, the question record and the site's lock all key on the storage slug,
  so the request continues as it was.
- Later parts read the current public address when they publish
  (`publicUrlFor`). A QR code or a link made after the rename uses the new
  address, and words naming the old address still reach the site (it
  redirects). A code meant for the new address needs the rename: the model's
  relation orders them (§8).
- *"Forget the old address"* stays its own part, as today.

### 9.5 … needs the full rewrite

The add-on's escalation that names no layer starts `/api/site/react-revise`
today: the build's pipeline, a revise measured at 17 credits, which reads the
first 4,000 characters of a request (`REWRITE_MAX_CHARS`). It is first Build's
machinery, which this plan leaves unchanged. So **the driver does not start
it**. The part waits with a yes-or-no question naming the measured cost, and
a yes starts the rewrite from the page, as today. Decision D4.

### 9.6 … is cancelled

`DELETE /api/site/request/<id>` ("stop the rest"):
- every part not yet filed is marked `cancelled`;
- the live job is asked to cancel (`edit_cancel`), which stops it before it
  publishes and answers `too-late` after;
- done parts stay done, each its own saved version.

## 10. The failure policy, for your decision (D2)

Stored per request (`policy`), so it is one setting either way.

| | **A. Stop everything after a failure** | **B. Stop only what depends on it; continue the rest** |
|---|---|---|
| After a failure | nothing else starts; every unstarted part is `not-run`, named | parts that need the failed part (directly, or through a carved part) are `not-run`; independent parts run |
| While a question waits | everything after it waits | independent parts run while it waits |
| Credits | nothing is spent after a failure | independent parts spend what they cost, as if sent by hand |
| Relies on | nothing beyond the failure itself | the model's relations (§8); a missed relation is caught by the steps' existence checks, refused and named, at the cost of its routing call (1–2 credits measured) |
| What the customer re-sends | every part after the failure | only the failed part and what needed it |
| Predictability | one rule, the same for every message | the outcome depends on the relations the model named |

**Proposed: B**, because the customer asked for every part, and the steps
already refuse work whose prerequisite is missing. **A** stays one setting
away if you prefer the stricter first version. Either way, a failure never
undoes a done part: each part is its own saved version.

## 11. Cycles, duplicates and unrelated parts: what guarantees each

| Must not happen | Guaranteed by |
|---|---|
| A cycle in the order | the graph check refuses cyclic relations whole (§8); carvings strictly shrink (§9.1); at most two hand-overs per part, and the add-on's own hand-over may not come back (§7.2) |
| A part run twice | one job per derived key (`edit_jobs` unique); the claim and lease; one live job per request; the version compare-and-set on the request |
| A part charged twice | reserves unique per `(job#seq, reserve)`; a new attempt only once the previous holds no money (§7.4) |
| A duplicate request | `request_create` unique on `(uid, slug, idem_key)` |
| An unrelated part lost | a request's parts change only through that request's driver; a new message is a new request, never merged or replaced; a superseded question keeps its part (§9.2); cancel and policy act on one request; a terminal request names every part that did not finish, with its reason |
| Work while a publish is unconfirmed | `edit_create` refuses a site under review; the request waits in `review` |

**The same words typed again in another tab, with a new key**, are a second
request: the owner's own action, run after the first (the site's lock). The
plan does not merge requests by their words, because that would be a guess.
Every tab shows the site's live requests (`request_live`), so the first one is
visible before a second is sent. Decision D9 is whether a second message
should instead be refused while the first is unfinished.

## 12. Where continuation applies

**Only where edits are queued** (`editAsyncFor`: the flag and its allow
list). On the synchronous path, parts left for later stay exactly as today:
each is named by its words and left for the customer to send. A first build,
its interview and its pipeline are untouched. A request needs a site that
exists.

## 13. What the customer reads

- **One message, its parts, each with its status** (§6.4), its words, and,
  when done, what changed and on which page. **Queued** is said as queued
  until the part's job is claimed. **Done** comes only from the part job's
  stored answer. **Unverified** and **done-unrecorded** are said as what they
  are, never as done.
- **Replies stay model-written from the facts** (`site-reply.mjs`), fed per
  part from each job's stored answer, plus the request's statuses. The
  instructions gain one rule: a queued, blocked or waiting part is never
  described as being done or done. The page's own composer is the fallback,
  as now.
- Today's *"Say “…” and I'll do that next"* becomes, for a request,
  *"Queued: “…”"*, and the part's own reply when it finishes. Decision D3 is
  whether that is one reply per part or one summary when the request ends.
- **After the tab closed**: the page asks for the site's live and
  recently finished requests when it opens. It shows each part's reply,
  written on its first read, as a job's is today (`servedModelReply`), and
  each waiting question.

## 14. The smallest set, by requirement

| Requirement | The one piece that meets it |
|---|---|
| progress with no browser | the driver, with the cron as its guarantee |
| the claim, lease and crash recovery for every step | each step is an `edit_jobs` row; nothing new |
| no duplicate execution or charge | derived keys, reserves per job, a new attempt only after a refund |
| the request preserved whole | the request row (message, files, answers, parts) |
| "it" keeps its meaning | the part's section in `clarifyTransport` (§5.3) |
| relations named by the model | two fields on the site's routing tool, one paragraph |
| set-aside additions keep their words | the add-on picker's `scopes` |
| a later part routed by the server | the routing route accepts a replay and charges through the job |
| questions on a later part | two optional fields on the question record |
| hand-overs without the browser | the escalation rules move into `request.mjs` |
| the container finishes a part | one gateway op |
| the browser follows | three routes (§15) and the page's follow code |

## 15. The exact files

| File | Change |
|---|---|
| `supabase/applied/<version>_edit_requests.sql` (new, applied on your word) | the `edit_requests` table and its five RPCs (§5.1), mint-checked, service role only; the live snapshot read back after the apply, as the other migrations are |
| `scripts/edit-rpc-check.sql` | new sections, run rolled back (§16) |
| `builder/request.mjs` (new) | pure: `readParts` (words, positions, graph, cycles, strict carving), `nextStep` (outcomes, statuses, policy, the next job), `partStatus(row)`, `answerless(row)`, `partKey`, the stored bodies of `route` and running jobs, the escalation rules (moved from `public/edit-poll.js`), the part's context section |
| `builder/site-ask.mjs` | `LIVE_ASK_TOOL`: `alsoAsked` items `{ words, needs }`, `needsFirst`; the one paragraph; `readAlso` reads both shapes. `ASK_TOOL` untouched |
| `builder/site-add.mjs` | the add-on picker's `scopes` (`[{ kind, words }]`, `wordsIn`-checked); set-aside `row` and `frame` keep their words |
| `builder/clarify.mjs` | the question record's optional `requestId` and `part`; `clarifyTransport` shows the part's section |
| `builder/job-gateway.mjs` | the `/next` op, bound to the token's job |
| `builder/site-reply.mjs` | a request's parts and statuses in the facts; the never-before-it-starts rule |
| `worker.js` | the edit and add-on routes' queued branch accepts a request (files, `request_create`, the first step); the routing route under a replay (the digest from the store, the job's reserve, no question read, a part's question stored with its request); the answer path for a request's question; the driver and its three callers (the consumer after the finalize, the gateway op, `runRequestSweep` in the cron); `GET /api/site/request/<id>`, `DELETE /api/site/request/<id>`, `GET /api/site/requests?slug=`; per-part replies; `runJobRetention` keeps a live request's files |
| `public/edit-poll.js` | following a request (statuses, the poll); no escalation for a job that belongs to a request |
| `public/chat.js` | the parts and their statuses; *"Queued: …"*; every waiting part's question; "stop the rest"; on opening, the site's requests |
| `docs/edit-path.md`, `docs/containers-and-jobs.md`, `docs/addon-path.md` | the request, the driver, the statuses |
| tests | §16 |

## 16. Tests, grouped

All of them are free. They run through the real routes with supplied model
answers: the queued path's in-process harness (`test/fixtures/worker-harness.mjs`,
as `test/mixed-work.test.mjs` drives it), the consumer and the cron called as
the platform calls them, and an in-memory `edit_jobs` and `edit_requests` that
honour uniqueness, the version check and the reserve's ledger. The SQL
properties are driven against the real database by
`scripts/edit-rpc-check.sql`, which rolls back. Each case checks the final
pages, the publishes, the ledger, and the text the browser shows.

1. **One message, Edit plus Add-on.**
   - *"Change the hero title to Fresh bread daily and add a booking form"*:
     the router answers `text` and holds back the form. Part 0 publishes; the
     driver routes part 1 (`addon`) and runs it; two publishes; the ledger
     holds the lead routing, part 0's reserve, part 1's routing reserve and
     its add-on reserve, each once.
   - The reverse order (an addition, then an edit).
   - The add-on's set-aside `frame` and `row` becoming parts with their words.
   - The look door's held addition.
   - An edit escalating to the add-on, and a sideways hop, with no browser
     between the jobs.
   - The request on the synchronous path, unchanged.
2. **Dependency ordering.**
   - The prerequisite mentioned later (§8): all three router shapes.
   - `needsFirst`: part 0 held back and routed again after its prerequisite.
   - A cycle: nothing run on a guessed order, each part named.
   - Independent parts in message order, and a relation that overrides that
     order.
   - A carved part inherited by the parts that needed its parent.
   - A missed relation refused by the step's existence check and named.
   - A failed prerequisite: its dependents `not-run` under A and B, and
     independents run under B only.
3. **Clarification.**
   - A later part asks: the request waits; the answer resumes only that part,
     with no second routing call; the other parts' rows are untouched.
   - An answer with a file: the file stored with the request and given to the
     part that reads it.
   - The question superseded by a newer one, then offered again.
   - Expiry at 24 hours: `expired`, and its dependents `not-run`.
   - A question in part 0.
   - The lead routing call's own question, before acceptance: unchanged.
4. **Closed-tab recovery.**
   - No poll at all after the 202: every part completes through the consumer
     (inline), the gateway's `next` (container), and the cron when `next` is
     dropped.
   - Each crash point of §7.5, driven: after `edit_create` before the object;
     after the routing reserve; before `publish_started_at` (attempt 2,
     charged once net); after it (review, then the reconcile's `kept` and
     `refunded`); after `published_at` (`done-unrecorded`); the driver dying
     between its write and filing.
   - A deploy gate standing mid-request.
5. **Duplicate delivery.**
   - A queue message delivered twice: one set of model calls, ledger rows
     once.
   - Two drivers stepping one request at once: one job per key, one message.
   - The same POST again (a retry, a reload, another tab): one request, one
     job.
   - The same words with a new key: a second request, run after the first,
     not merged.
   - An answer sent twice after a lost response, and two tabs answering at
     once: one routing call, one running job, the other answer refused
     before any model call.
   - `edit_reserve` repeated for one `(job, seq)`: charged once.
   - A new attempt refused while the previous one holds money.
6. **Unchanged** (guards): `ASK_TOOL`'s pinned hash; the build route and the
   revise untouched; the synchronous path's answers byte-identical; the job
   gateway's wall unchanged except for `/next`.

## 17. Product decisions remaining

| # | Decision | Proposed |
|---|---|---|
| D1 | **Later parts spend without a second press**: each later part's routing (1–2 credits measured) plus its own steps' measured costs | approve as a spending rule, with "stop the rest" visible from the first part |
| D2 | The failure policy (§10) | B: stop only what depends on the failure |
| D3 | One reply per part as it finishes, or one summary when the request ends | per part while the page is open; one summary for parts that finished while it was closed |
| D4 | The full rewrite (§9.5): started by the driver, or a yes-or-no question | a question naming the measured cost |
| D5 | Automatic retry of a part job that ended with no answer at all | once (attempt 2), then failed with the reason |
| D6 | How long a request may wait on a question | 24 hours, the question record's own lifetime |
| D7 | Key part 0's routing charge by the message's key, so a lost routing response is never charged twice | not in the first version; a separate change |
| D8 | Apply the `edit_requests` migration to the live database | only on your word, after the rolled-back check passes |
| D9 | A second message while a request is unfinished: queued behind it, or refused until it ends | queued behind it (the site's lock already orders them) |

## 18. Not proposed

These are left out, and each would be a redesign, done only on your word:
- running parts at the same time;
- one publish across several parts or routes;
- the first routing call routing every part's route;
- merging requests by their words;
- automatic retries of a part that failed for a reason;
- a change to first Build, the revise, the publish spine, the ledger RPCs or
  the sweeps.
