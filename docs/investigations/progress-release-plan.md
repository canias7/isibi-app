# The progress release and its one live check: one stage to authorize (2026-10-06)

The owner, after Codex confirmed the progress corrections on `7abe6c3d`:
*"Close this correction round and prepare one release plus one combined live
Edit/Add-on verification using the existing canary and a demo site. Choose
fresh changes that exercise both routes automatically, capture actual
first-person progress before completion, verify the published results and
final replies, and check recovery after closing the originating tab and
reopening on a fresh browser session. Record the real model wording,
attempts, tokens, latency and platform narration cost, confirming narration
adds no customer charge. Reuse the controlled tests for failure scenarios;
don't repeat the broad audit or schedule several container builds. Give me
the exact release steps, expected image, test message, estimated credit
requirement and hard spending cap; the last recorded balance is 9. Include
the bounded-retry and process-loss limitations honestly. Prepare everything
now, but keep the branch unmerged and progress off until I approve the
deployment, single container roll and paid test."*

**Prepared, not executed.** Nothing is merged, deployed, built or pressed,
`PROGRESS_REPLIES` is not set, and nothing is spent. The press is a new
canary scenario, `lv-progress` (§4), prepared on the branch for review with
this plan. **The balance does not cover it** (§5): at 9 the press refuses at
no cost.

**In one view:**
- **The release**: one fast-forward of `main` (`b2409b3c` → the candidate)
  and the one deploy that push starts. It builds the container image once,
  **`c7fe818d446dd957` → `5f946c22d42a1b10`**, and releases the progress
  code dark (the deploy's fallback for `PROGRESS_REPLIES` is `off`).
- **The switch**: the owner sets the secret `PROGRESS_REPLIES` to `on` and
  dispatches *Deploy to Cloudflare* on `main`. That deploy reuses the image,
  so nothing rolls a second time.
- **The test message** (one message, sent in the real app on
  `fold-lane-bakery`):

  > Add an FAQ page with a link in the menu, answering what customers ask us most: how long a sourdough loaf keeps, how best to store it, and when we're open. And change the Classes page heading 'Spend a Saturday morning with the starter' to 'Spend a Saturday morning at the bench'.

- **The money**: about **20 credits** expected (16–26). The press needs a
  balance of 28 to 32 before it sends anything. **The hard cap is 32**:
  raise the balance from 9 to exactly 32, and no charge can take it below
  zero (§5).

## 1. What is released

**The candidate** is the branch's tip at the merge. `main` is `b2409b3c`
(deploy 2185, image `c7fe818d446dd957`, live and runtime-confirmed by run
102). It is an ancestor of the branch, so the merge is one fast-forward. At
this writing the branch is `main` plus 17 commits to `7abe6c3d`, then this
preparation's own (§4.6). Their content, in order:

| Commit | What | Review |
|---|---|---|
| `dfab8148` … `df53b4c1` (7 commits) | the records of deploy 2185 and run 103 | docs only |
| `fa3a25ad` | the progress plan | docs only; the owner's corrections are mapped in its §0 |
| `9c931540`, `5cfebd0a`, `49ba56bd` (records `ecbe624e`) | model-written progress during Edit and Add-on, off by default: the job records its milestones, and the picked quick model writes a short line for the customer from them, shown under the request's part (or in place of "Thinking") until the final reply | the owner; Codex reproduced the gaps that `84d46faf` closed |
| `dd446201` (records `ba8a12dc`) | the owner's wording clarification: first person, each task named by the model's own line for its state | the owner |
| `84d46faf` (records `1dbfb367`, `7abe6c3d`) | the gaps: each card's state and line come from the job's real outcome, no line after the final reply, a failed milestone delivery is retried without doubling, and the canary reads a reply apart from kept progress | **Codex, at `7abe6c3d`**: the outcome labels, the late-progress suppression, the delivery retries without duplicate milestones, and the separate final-reply reading |
| this preparation's commits (§4.6) | the `lv-progress` scenario, the narration usage step (canary and canary workflow only), and the records | for review with this plan |

**What reaches production**:
- the Worker: `worker.js`;
- the container: `builder/site-progress.mjs` (new), `builder/container-env.mjs`, `builder/edit-job.mjs`, `builder/job-gateway.mjs` and `builder/request.mjs`. The `Dockerfile` copies the new module into the image;
- the deploy: `deploy.yml` passes `PROGRESS_REPLIES` to the Worker, with
  the fallback `off`;
- three served files: `public/chat.js`, `public/edit-poll.js` and `public/styles.css`.

The canary scripts, the canary workflow, the tests and the docs deploy
nothing.

**The one container image build**: `c7fe818d446dd957` (live) →
**`5f946c22d42a1b10`**, predicted on both ends. It has 195 inputs, one more
than before (the new module), and none under `public/`. Five inputs differ:
`builder/container-env.mjs`, `builder/job-gateway.mjs`,
`builder/request.mjs`, `builder/site-progress.mjs` and `worker.js`. It is
predicted again at this preparation's commits (none of its files is an
input) and at the final candidate before the merge.

**Off until switched**: with `PROGRESS_REPLIES` unset, the deploy passes
`off`. Then nothing is recorded, no narration task is sent, and every answer
is the same as with the code absent. So the merge's deploy changes nothing a
customer sees until the switch (§2.7).

## 2. The stage, in order

What one authorization covers. Every step is free except §2.9:

1. **Before the merge** (the session):
   - nothing in flight: no Actions run in progress or queued, read twice
     (the second right before the push), and no open job in `edit_jobs`;
   - unit CI green on the candidate itself, with the same total as the
     local run; the site build green with the candidate's inputs
     fingerprint, or nothing it reads changed since its last green run
     (run 37515372064 on `84d46faf`, inputs `979f94b2735bc0a2`);
   - the image predicted on both ends: `c7fe818d446dd957` →
     `5f946c22d42a1b10`;
   - the rollback verified in a throwaway worktree: `git revert --no-commit
     b2409b3c..<candidate>` gives back `main`'s own tree;
   - the served files read before the push. Today they are deploy 2185's:
     `chat.js` 903,533 bytes `dd876c6f37ce2661…`, `edit-poll.js` 50,048
     bytes `b2a9aba6847158ec…`, `styles.css` 349,252 bytes
     `54f6dd2bc51f8b0f…`;
   - **`PROGRESS_REPLIES` not among the repository's secrets**, read by
     name only, so the deploy passes its fallback `off`. If it is there,
     the session stops and asks;
   - the balance and the ledger's last row read;
   - no commit carrying the skip-CI marker.
2. **The merge** (the session): `main` `b2409b3c` → the candidate, one
   fast-forward push. **The deploy is that push**: *Deploy to Cloudflare*
   runs on it by itself and takes no inputs.
3. **The deploy, read** (the session):
   - one run, `success`;
   - the log's `IMAGE SiteBuildContainer: built …:5f946c22d42a1b10 (… 195
     inputs …)`, and the container's `- …:c7fe818d446dd957` / `+
     …:5f946c22d42a1b10`;
   - Wrangler uploading `chat.js`, `edit-poll.js` and `styles.css`, and the
     secrets, with `PROGRESS_REPLIES` printed `off` (a fallback prints
     plain; a secret holding `on` prints masked).
4. **The served files** (the session), each byte-identical to the merged
   file: `chat.js` 920,280 bytes `0e68e3242f209272…`, `edit-poll.js` 52,888
   bytes `fa71335f4a27a26c…`, `styles.css` 350,604 bytes
   `d7474cd77f6acc90…`.
5. **The image window**: the session waits 15–20 minutes after the image
   rolls, once, and says when it is over.
6. **The free runtime check** (the owner's press, §3.1): both readers answer
   the merged commit, a cold container answers `5f946c22d42a1b10`, queued
   jobs and the runner are on, and nothing is charged. Progress is still
   off.
7. **The switch** (the owner, §3.2): set the repository secret
   `PROGRESS_REPLIES` to `on`, then dispatch *Deploy to Cloudflare* on
   `main`. The session reads that run:
   - `success`, with the image `reused …:5f946c22d42a1b10` and Wrangler's
     container step answering `no changes`. So nothing rolls and no image
     window is owed. **The merge's deploy is the single container roll.**
   - `PROGRESS_REPLIES` printed masked where step 3 printed `off`.

   The log cannot show the value itself. The press reads it for free before
   sending anything (§4.2).
8. **The funds** (the owner, §5): raise the balance to **exactly 32**. Add
   nothing while the press runs.
9. **The paid live check** (the owner's press, §3.3), only after 6, 7 and 8.
10. **The readings and the record** (the session, free): the press's log and
    evidence, the narration usage (§4.4), the site read back, the ledger
    rows by the press's own refs, and the records (history, deploy record,
    handoff, checklist).

A failure at any step stops the stage there, said, and nothing after it runs
without the owner's word.

**To turn progress off again**: set `PROGRESS_REPLIES` to `off` (or delete
it) and dispatch *Deploy to Cloudflare* on `main`. Nothing rolls, and
nothing else changes.

## 3. The presses and the switch, box by box

The canary workflow is *edit canary*. Each box is named by its description,
as the form shows it. **The merged commit** is the candidate, given as eight
characters (the session's report names it). Every box not listed is left as
it is: blank, or its default where it has one.

### 3.1 The free runtime check (after step 5)

"Use workflow from": `main`

"Run the ONE paid edit as well (yes/no)": `no`

"Refuse to spend unless the Worker reports this deploy sha (prefix, >=7
chars). Blank = read and print only.": `<the merged commit, 8 characters>`

"Refuse to spend unless a cold container reports this image id (exact). Blank
= read and print only.": `5f946c22d42a1b10`

It passes when both readers answer the merged commit, a cold container
answers `5f946c22d42a1b10`, every zero-cost confirmation passes, and the
balance does not move.

### 3.2 The switch (step 7)

1. In GitHub: the repository's *Settings → Secrets and variables → Actions*,
   a repository secret named `PROGRESS_REPLIES`, value `on`.
2. *Actions → Deploy to Cloudflare → Run workflow*, "Use workflow from":
   `main`. It takes no inputs.

### 3.3 The paid live check (step 9)

"Use workflow from": `main`

"Run the ONE paid edit as well (yes/no)": `yes`

"RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …":
`lv-progress`

"The site to edit. Defaults to the canary site; name another to run this
against it. Not needed with read_job.": `fold-lane-bakery`

"Refuse to spend unless the Worker reports this deploy sha (prefix, >=7
chars). Blank = read and print only.": `<the merged commit, 8 characters>`
(the switch's deploy runs the same commit, so the Worker still reports it)

"Refuse to spend unless a cold container reports this image id (exact). Blank
= read and print only.": `5f946c22d42a1b10`

"What to change", "REQUEST BATCH ONLY …", "Rules test only …", "Refuse to post
the paid edit unless the router answers this …", "Refuse to route or spend
unless one table …", "ROUTING-ONLY BATCH …", "READ ONE EXISTING JOB AND STOP
…" and "PUT ONE SAVED VERSION BACK …": blank.

## 4. The live check

### 4.1 The message, and why these changes

`lv-progress` (`scripts/canary-ui.mjs`) runs in the real app in a real
Chromium, signed in as the building account, on `fold-lane-bakery`
(REQUEST_FLOW on). One message is typed and sent:

> Add an FAQ page with a link in the menu, answering what customers ask us most: how long a sourdough loaf keeps, how best to store it, and when we're open. And change the Classes page heading 'Spend a Saturday morning with the starter' to 'Spend a Saturday morning at the bench'.

- **Both routes, automatically**: one message carries an addition (a new
  page and its menu link, which goes to the add-on step) and a change to
  what is there (a heading, an edit). No route is named. The router takes
  it on as a request with parts, as in runs 101 and 103.
- **Fresh**: the bakery has no FAQ page (`/faq` answered 404 at this
  writing) and no menu item for one. No earlier press asked for either or
  touched this heading (the scenario test checks every earlier scenario's
  words).
- **The heading**, read live at this writing: `/classes` "Bread Classes",
  "Bread-making at the bakery", then **"Spend a Saturday morning with the
  starter"**. The published page's code carries it once, as the story
  lead's headline. The component also uses the headline as its picture's
  label and caption, so those change with the heading: one value in the
  source, changed once.
- **No form and no table**: the answers are to be written on the page, so
  no table is expected. Unlike run 103, no visitor's entry is sent.

### 4.2 What the press does, in order

1. **Before anything is sent**, each step free:
   - the deploy and the image, as every press;
   - **the funds**: it refuses unless the balance is at least 28 (the
     budget, `fundsFirst`) and at most 32 (**the hard cap**, `cap`);
   - **progress on**: it refuses unless the requests list carries `jobs`,
     which the Worker adds only with `PROGRESS_REPLIES` on
     (`progressOnRefusal`).

   Any refusal: the message is typed and not sent, so no routing call and
   no charge.
2. **The sending tab**: the message is sent, and the request's card is read
   about every second. Each change to what it draws is kept (the parts'
   words, labels, progress lines and status). This continues until a
   progress line is on screen while the request still runs, or the request
   ends, or 6 minutes pass. The add-on's first milestone ("picked") comes
   before any design work, so a first line is expected within a few
   minutes.
3. **The tab is closed**, as a customer closes it.
4. **No page open, 30 seconds**: the request is read through the requests
   list alone, and any read of its own route then is recorded (there must
   be none). A part routed somewhere the scenario does not allow is stopped
   through the request's own Stop.
5. **A fresh browser session**: the canary's account signs in afresh (a
   second magic-link session). A new browser context holds nothing of the
   first tab's. It opens the site, must find the request on the server and
   draw its card, and is followed, each change kept, until it shows the
   request closed with every part's reply on screen. The message's whole
   bound is 25 minutes.
6. **The replies, settled**: each part's reply is waited for on that page,
   read apart from the progress kept above it, until every one is written
   or has failed for good.
7. **The site, the money and the narration**: read as every request press,
   then the narration check (§4.3) and the ids file for the usage step
   (§4.4).

### 4.3 What must hold

**It passes when every check passes** (the press prints each one):
- **the request**: one routing call with the message's words, taken on as a
  request; every part ended done at a route the press allows (text, look,
  nav or page for the heading; the add-on step for the page); nothing
  stopped by the press's wall;
- **the pages**:
  - one new page whose served words include "keep" and "store", stored and
    served 200;
  - every page's menu gained a link whose words include "FAQ", pointing at
    it, each keeping its own items, and every served header links it;
  - `/classes` reads "Spend a Saturday morning at the bench", the page's
    source changed in that one place only;
  - every other stored page, component, logo and the description as they
    were;
- **the tables**: as they were (none asked for);
- **the replies**: every reply the model's own, on screen, read apart from
  the kept progress;
- **the money**: the press's own charges (routing by its keys, jobs by
  theirs) add up to the balance's move;
- **the progress** (`progressChecks`, eight checks):
  1. a progress line was on screen in the tab that sent the message while
     the request still ran;
  2. that tab was then closed, the request still running;
  3. with no page open, the request was read through the requests list
     alone, and nothing read its own route;
  4. a fresh browser session, signed in afresh as the same account, found
     the request on the server and drew its card;
  5. the fresh session showed every progress line the sending tab had shown;
  6. the fresh session followed the request to its end, every part's reply
     on screen;
  7. while a part ran, its card named it by the model's own line for doing
     it;
  8. at its end every part was done, and named by the model's own line for
     having done it;
- **narration added no charge**: the balance moved by exactly this press's
  own routing and jobs, and no other ledger row was written while it ran
  (`narrationChargeVerdict`; the window's ledger rows are printed).

**Recorded, never judged** (no length, no keyword):
- **every progress line's words**, as drawn, with when each was first seen,
  in which part and on which page (the sending tab or the fresh session);
- **each task's lines**, for every state the model wrote, and the words each
  card showed;
- **whether each part showed a line** (`progress-each-part`, coverage only).

### 4.4 The narration's usage (free, read-only)

A new workflow step, *narration usage (free, read-only)*, runs after the
press whether or not it passed, before the evidence is kept. It reads the
Worker's own log lines for the press's ids: each job's narration record and
each request's. It uses the free telemetry query `container-logs.yml` makes
(`dry: true`: nothing kept, no container started, nothing charged), with
CI's Cloudflare token. That token has read Workers Logs before: the
`container-logs` read of 2026-08-30 returned 166 events, as that
workflow's own notes record. The press itself is never handed it.

It writes `narration.json` beside the evidence and prints, for each writer
call:
- whether it wrote;
- the model;
- its milestones and facts, or its tasks;
- its **attempts**;
- its **tokens in and out**;
- its **time** (the call's own, in ms).

Beside them it prints every delivery that gave up (`not delivered after N
tries`, `given up after N tries`, `milestone refused`), and the totals:
calls, attempts, tokens, time (sum, median, most), and **the platform's
cost in dollars and credits**, at the platform's own rates.

**Latency** is read two ways: each call's own time from its log line, and
from the send to each line's first appearance on screen, from the press's
snapshots.

If the logs cannot be read, it says so and names where to read them instead
(the dashboard: *Workers & Pages → isibi-app → Logs*, searching `progress:`
between the press's times). It never fails the run.

### 4.5 What stays

The demo-site rule: the FAQ page, its menu links and the Classes heading
stay. Nothing is put back by the press. A saved version can be restored
free later (the restore box), if the owner wants.

### 4.6 This preparation's commits

- **The scenario** `lv-progress` in `scripts/canary-ui.mjs`:
  - the step mode `away: "fresh"` (`followFresh`), and the second sign-in
    the driver is handed (`signIn` in `scripts/edit-canary.mjs`, the one
    sign-in reused);
  - the card reader (`cards` in `readComposerInPage`; `progressSnapshot`,
    `keepSnapshot`);
  - the preflight refusals (`capRefusal`, `progressOnRefusal`);
  - the no-charge verdict (`narrationChargeVerdict`);
  - its account in the log (`describeUi`).
- **The checks** in `scripts/canary-requests.mjs`: `progressChecks` and the
  coverage `progress-each-part`.
- **The usage reader** `scripts/narration-usage.mjs` and its workflow step.
- **The tests**:
  - `test/canary-progress.test.mjs`, 21 cases: the press end to end through
    the stand-in app (its harness moved to `test/fixtures/canary-rq-app.mjs`
    and shared with `test/canary-requests.test.mjs`); each refusal; each
    check failing alone on its own defect; the usage reader; the wiring;
  - case 7 of `test/progress-browser.test.mjs`: the card reader in real
    Chromium against the real page code.
- **The sweeps**:
  - `scripts/mutants/progress-release.json`: 51 mutants, 4 controls. The
    first run killed 48. The 3 survivors each got a case and were killed on
    a rerun:
    - a doing line on a part that was not running;
    - the median of three calls;
    - the usage step's `if: always()`, which the workflow test had read off
      the next step's comment.

    Run again on the finished tree, after the budget and the cap were set:
    51 of 51 killed, the 4 controls surviving;
  - `scripts/mutants/progress-release-cards.json`: the card reader, in real
    Chromium: 7 of 7 killed, the control surviving.

## 5. The cost, the budget and the hard cap

| Part | Measured on the same shape | Estimate |
|---|---|---|
| routing, one call | R2, runs 101 and 103: 3 each | 1–3 |
| the add-on: a page and its menu link | run 99's R2 (the Wholesale page and its menu link, no form or table): 12; runs 101 and 103 (a page with a form and a table): 16 and 18; the requirement judgment, newer than R2: about +1 | 12–18 |
| the second part's own routing job | R2: 1; runs 101 and 103: 3 each | 1–3 |
| the heading | runs 101 and 103: 2 each | 2 |
| **the narration** (progress lines and task lines) | absorbed by the platform: no ledger row, no reserve, no refund | **0 to the account** |
| the fresh session, the waits, the usage step and every read | no model call | 0 |
| **in all, charged to the account** | | **about 16–26; most likely about 20** |

**The narration's own cost, to the platform**: estimated at about 0.15–0.35
credit per writer call at `grok-4.6`, unmeasured. This press measures it
(§4.4). By construction the number of calls is not promised. Expect a
handful: one or two for the request's task lines, a few for the add-on's
milestones, and one or two for the heading's.

**The budget, 28**: the press sends nothing unless the balance covers that.
A request the server has taken on runs to its end whatever the balance, so
a press started short would end with a part refused for want of credits on
a live site.

**The hard cap, 32**:
- **How it is enforced**: every charge path refuses rather than overdraws.
  - The edit reserve: *"a bill larger than the balance moves nothing"*,
    `insufficient`.
  - The build debit refuses the same way.
  - The routing gate is a gate, not a till.

  So the balance at the press is the most the press can spend, whatever
  the models do. The press refuses to start above 32, so that bound is the
  cap.
- **What it cannot do**: nothing enforces a per-request limit below the
  balance. And if a charge is refused at the cap, that part fails on the
  live site after the earlier parts were paid. The press then fails
  visibly, and nothing is retried.
- **Don't add credits while the press runs**: that raises the bound.

**At the last reading the balance was 9** (23:01 UTC on 6 October; the
ledger's last row 397, no job open). **Raise it to exactly 32** (+23)
before the press. The deploy, the runtime check, the switch's deploy and the
usage step cost nothing.

## 6. What the evidence is, kept apart

### 6.1 Shown by controlled tests only (supplied model answers, failures made on purpose; not live)

Each of these is shown in the unit suite through the real modules, the
Worker's routes and the page's own code, much of it in real Chromium. **None
is exercised by the live check**, which is a success path: nothing is made
to fail on a live site.
- **Delivery failures**: a milestone whose delivery fails is retried on the
  waits in §7, never doubled, and a refusal is never resent.
- **The writer failing**: given up after two tries, with no line, and the
  job and its money unchanged.
- **The close race**: no line appears after the final reply, on any reader.
- **Outcome labels**: partly done, waiting for an answer, handed over,
  checking it published, not done and stopped, each card naming the model's
  line for that state. A job held for review is never shown as happening
  now.
- **Lines committed but unconfirmed**: never shown.
- **Reloads and another device**: tested in real Chromium.
- **The same job with the switch off**: identical execution, publishing,
  money and final reply.

The tests are `test/progress.test.mjs`, `progress-flow`, `progress-gaps`,
`progress-page` and `progress-browser`. Codex's reproduction is OUTCOME 1 in
`progress-gaps`. Their record is in
`docs/history/2026-10-06-progress-messages.md`.

### 6.2 What the live check would prove

On the deployed code, with real models and real money:
- **the first real progress lines**, written by the real model from real
  milestones, in the first person. They appear on screen before the request
  completes and persist on the server: a fresh browser session, signed in
  afresh, shows them all again;
- **the first real task lines**, each part named by the model's own line for
  its state, running and done;
- **recovery after closing the tab**: the request runs on with no page open,
  and a fresh session finds it and follows it to its end;
- **the success path end to end** with progress on: routing, the request
  driver's parts, the add-on making a page with its menu link, the heading
  edit, the publishes and the model-written replies;
- **the measured cost of narration**, from the real calls' tokens, and that
  it added no charge to the account;
- **the release itself**: the new image and the three new served files.

### 6.3 What it does not prove

- **No failure path** (§6.1): no delivery failure, writer failure, partial
  outcome, question or hand-over is reached, by design.
- **One request on one site, one sample**: how often lines arrive, their
  wording and their cost on other messages and models are not measured.
- **The fresh session is the same customer** on another browser or device,
  not another person.
- **The words are recorded, not judged.**

## 7. The limitations, stated plainly

These stand after the release. They are in the backlog and in the progress
plan's §7.
- **Bounded retry**: when the job's container cannot deliver a milestone to
  the Worker (a 429, any 5xx such as the gateway's 503 while the Worker's
  store is down, or no answer at all), the recorder keeps it and tries again after 250 ms, then 0.5, 1, 2, 4, 8 and 15 seconds. That is
  8 tries over about 31 seconds while the job runs, plus one last try at the
  job's end. A refusal is never resent. The close is tried once. A Worker
  store outage longer than that loses those milestones' lines; the job
  itself is not affected.
- **Process loss**: the recorder lives in the job's container process.
  Milestones still waiting for delivery are lost if that process dies (a
  crash, the container stopped or replaced). The job's outcome is handled as
  before. A milestone that reached the record but whose line was never
  written is asked for again by the cron. One that never reached the record
  is gone.
- **An unconfirmed line is never shown**: a true line whose confirmation
  does not land before its job ends is never shown.
- **The words are not checked**: only the state each line is written for is
  constrained. A line whose state is right and whose words say otherwise
  would be shown. The owner said: stated and tested, not filtered. The same
  holds for the task lines.
- **The cost is a floor**: it is priced from the log line's tokens at the
  platform's rates, without cached input. The provider's bill is the ground
  truth.
- **The tokens are the writer calls'**: the queue, the store writes and the
  page's polls cost no model call and are not counted.
- **The press's own bounds**:
  - the first line must show within 6 minutes in the sending tab;
  - the fresh session must follow the request to its end within the
    message's 25 minutes.
- **The page-word checks are words**: if the model writes the FAQ page
  without the words "keep" and "store", or names its menu link otherwise
  than "FAQ", those checks fail without a fault in the change. A new table
  fails "the tables are as they were". The session would read the page and
  say which.

## 8. If it fails, and what is parked

- **If a check fails**: the record says which and why. Nothing is pressed
  again, repaired or put back without the owner's word. The pages can be put
  back free from a saved version.
- **If the merge or the deploy fails**: nothing is pressed. The rollback is
  the revert verified in §2.1. **If the switch's deploy fails**: progress
  stays off and the release stands.
- **If progress misbehaves live**: turn it off (§2's last paragraph). There
  is no roll and no other change.
- **Parked, not in this stage**: the unrelated backlog, First Build and RW,
  and the run 103 leftovers on the bakery (the owner's).
