# The combined request flow: rollout and real-model validation (plan for your approval)

Prepared 2026-10-03, after you passed the two recovery fixes. **Nothing in
this plan has been done**: nothing merged, deployed, spent, pressed or built.
**The implementation is frozen** at the branch as it stands (`04c93f1f`; the
code is `567409ce`). The only changes before the merge are instrument and
test-fixture changes (§3, Phase A), and those wait for your approval.

Your order: *"Freeze this implementation and prepare the concrete rollout and
real-model validation batch without executing it yet. Use a compact set of
realistic messages covering Edit plus Add-on in both orders, multiple
operations, a prerequisite mentioned later, a deferred menu link or row,
clarification and resume, attachments, and closed-tab continuation. State the
exact messages, expected site changes and request statuses, how you will verify
charges and natural model-written replies, and the estimated total cost with a
spending cap. Include the deployment and REQUEST_FLOW activation steps, the
request-mode canary, and how to stop new requests while allowing accepted work
to finish. Keep any full-rewrite test separately identified with its cost."*

## 0. In one screen

- **Order**: instruments prepared (free) → merge and deploy, switch off →
  free runtime press → routing controls → switch on → request-mode canary →
  the batch R1–R5. RW, the full-rewrite test, comes last, separately, and only
  if you approve it on its own.
- **The batch**: five messages on `fold-lane-bakery`. R3 has a second turn,
  the answer to a question. Together they cover:
  - Edit plus Add-on in both orders;
  - several operations in one message;
  - a prerequisite named later;
  - a menu link the add-on sets aside;
  - a step's question and its answer;
  - an attached file read by a later part;
  - a request finished with its tab closed.
- **Cost**: about **43–101 credits** for everything but RW, likely about 59.
  The proposed cap is **100**, against a balance of **137** read today. RW is
  **12–50 credits** if it reaches the go-ahead and you press it, about 2 if
  not. It has its own cap of 50 and runs only if 50 are left.
- **Stopping new requests**: set `REQUEST_FLOW` to `off` and redeploy. Every
  accepted request still finishes, because the switch is read only where a
  message is accepted (§8).

## 1. Where things stand (read today, free)

- **The branch** (`claude/help-needed-ehlwlj`, tip `04c93f1f`) is `main`
  (`b8d12ff9`, deploy 2180) plus 31 commits.
- **The container image**: `main` predicts `8bfc67dc695e65cc` (191 inputs).
  The branch predicts `882477e1bbbe8cbe` (194 inputs), so a merge rolls the
  image. Nothing is built.
- **The building account**: balance **137**, last ledger row 355
  (2026-10-02 06:49 UTC), no job open (`credit_events`, `credits`,
  `edit_jobs`; read 2026-10-03 23:05 UTC).
- **Deploy 2180's free runtime press was never made.** The merge's press
  stands for it.
- **`fold-lane-bakery` (Harbour Loaf)** is live at `01790923788063-bp9rcv`,
  read from its served pages at 23:00 UTC:
  - pages:
    - `/`: *Harbour Loaf*; sections *Fed every morning since we opened* and
      *Order a loaf for collection*; photographs of the storefront and a
      sourdough boule;
    - `/order`: *Order a loaf*; *Pick a loaf and a collection slot*;
    - `/visit`: *Come to the bakery*; *The shutters and the street*; *Order a
      collection so we hold a loaf*; a QR code to `/gallery`; the counter and
      the boule photographs;
    - `/gallery`: *Our Gallery*; *Photographs of the bakery's work*;
    - `/starter`, which shows *This page isn't finished yet*;
  - the menu:
    - on `/` and `/gallery`: Today's bake, The starter, Visit, Gallery,
      Order;
    - on `/order` and `/visit`: the same without Gallery;
  - the header buttons: *Order a loaf* and *Call us* (`tel:0117 496 0000`);
  - the footer: one Instagram link;
  - the logo: `/u/fold-lane-bakery/2cc633d7….png`, byte-identical to the
    canary's `test/fixtures/ui-logo.png`;
  - the description: *Neighbourhood sourdough in Bristol. Browse today's bake
    and order a loaf for collection.*;
  - `loaves`, read whole as the site serves it (`0-6/7`):
    - Country White 4.8, Dark Rye 5.2, Seeded Wholemeal 5.4;
    - Olive & Rosemary 5.8, Walnut Levain 6, Sea Salt Focaccia 4.5;
    - Rye & Caraway 5.

## 2. What the merge carries

A fast-forward of `main` to the branch puts five reviewed changes live at
once. Each is on the branch today, unmerged:

| Change | Switch, and its default when unset | What a customer sees |
|---|---|---|
| Model-written replies (`b17747ed`, `906bacbe`, `ddfe44f8`) | `MODEL_REPLIES`, **on** | an edit's or add-on's ending explained by the quick model from the facts of what happened. Not charged; about a third to half a credit of model cost each, ours |
| Information limits, batch 1 (`2a17e2cb`) | none | one size policy (16,000 characters a message, 48,000 a request); questions and options whole; at most three files per request, said before anything runs; the page list read from the site |
| The mixed-work fixes (`460ab6e5`) | none | every executed step's result kept and named; no silent drops at the lane or step counts; several parts left for later; add-on declines named |
| Footer lists and the menu (`13c22ea3`) | none | no limit of eight footer links or ten menu items; each refusal named |
| The combined request flow (`b1d96b3d`, `b7564f82`, `4fd05e68`, `567409ce`) | `REQUEST_FLOW`, **off** | nothing, while off; on, a site's message becomes a request the server finishes |

Three files a visitor's browser loads change: `public/chat.js`,
`public/edit-poll.js` and `public/styles.css`. Each gets the served-file
check (§3, Phase B).

**`MODEL_REPLIES` goes live with the merge unless you set its GitHub secret
to `off` first.** The batch's reply checks need it on, and I recommend
leaving it at its default (§11).

## 3. The steps, in order

**Phase A — the instruments, free, after your approval** (scripts and test
fixtures only; no product file, no deploy, no paid call):
- **The canary's request mode** (`scripts/canary-ui.mjs`) gains:
  - `until: "question"`: a step ends when a part waits on its question and
    the page shows it. The next `say` is then typed as the answer, which is
    how the page sends one (`siteAskReply`);
  - `away: true`: once the server has taken the message on, the tab is
    closed. The request is then read only through `GET
    /api/site/requests/<slug>`, which moves nothing, every 20 seconds until it
    has ended. Then a new tab opens the site and must show the ended request.
    A read of the request's own route while away fails the step;
  - `ms`: a step's own time bound. The default is 12 minutes, the most 30, so
    a press stays under the workflow's 45;
  - `addon: true`: opens the add-on step beside the listed edit layers. The
    present `adds` allows only edits the add-on handed over, and these
    messages mix in edits of their own;
  - `request: true`: the browser's wall refuses any edit or add-on the page
    itself would post. In request mode the page posts none, so if the switch
    is not live the press costs only its routing call, changes nothing, and
    sends nothing more;
  - new checks:
    - a page added (stored before and after, answered 200, its heading on
      topic);
    - the description changed (only that field of the stored config);
    - a heading changed (that text only, on that page);
    - the logo replaced by the attached file (§4, R4);
    - the job order (one part's job ended before another's began).

  The existing checks are reused: menu link, footer link, words, row, money,
  files, wall and replies.
- **The scenarios** of Appendix B, and **the probe list** of Appendix A
  (`scripts/router-probes/request-flow-1.json`). The probe list as printed
  there passes the batch reader (`readProbeBatch`: 7 probes, sha256
  `eda0d61e…`).
- **A second logo picture**, `test/fixtures/ui-logo-2.png`: a 240×240 green
  disc, 1,224 bytes, sha256
  `38d29a0457eedf0f9778d4a9f4104d279fffe622c2f61a22e0989d92ee9d1c0e`. It is
  needed because the live logo already is `ui-logo.png`.
- **The help text** of the canary form's scenario box names the new
  scenarios (`.github/workflows/edit-canary.yml`). It deploys only with the
  merge.
- Proven with the stand-in page (`test/fixtures/browser-page.mjs`), then the
  full suite and CI, then pushed to the branch.

**Phase B — the merge and its deploy, on your word "merge".**
1. **Before**:
   - nothing in flight: no Actions run, and no open job (a free read);
   - unit tests and the site build green on the candidate;
   - the image predicted over both ends again (`b8d12ff9` →
     `8bfc67dc695e65cc`, the candidate → expected `882477e1bbbe8cbe`);
   - the rollback verified in a throwaway worktree: `git revert --no-commit
     b8d12ff9..<candidate>` must give back `b8d12ff9`'s tree;
   - the three served files read before the deploy lands.
2. **Your GitHub secrets**: `REQUEST_FLOW` unset or `off`. `MODEL_REPLIES` as
   you decide (§11).
3. I fast-forward `main` to the candidate and push. One deploy run follows.
   It waits for live job leases (up to 14 minutes) before it deploys.
4. **I read the log**:
   - `built …:882477e1bbbe8cbe (registry answered 404; 194 inputs …)`;
   - the image pair `- …8bfc67dc695e65cc` / `+ …882477e1bbbe8cbe` and
     `SUCCESS Modified application`;
   - each served file byte-identical to the merged one (`git show
     <merged>:public/<file>`).
5. **Container work waits 15–20 minutes** after the roll.
6. **Your free runtime press** (the boxes are in §3.1). It passes when the
   log reads `build-health 200 deploy=<sha12> image=882477e1bbbe8cbe` and
   `runtime 200 … async=true runner=true`, every free check is `ok`, and
   nothing is charged. Until then the deploy is *deployed, not
   runtime-confirmed*.
7. Deploy 2181 goes into `docs/deploy-record.md`.

**Phase C — the routing controls** (one paid press, 7–11 credits). Each of
Appendix A's seven messages is routed once with the real router. Nothing is
edited, added, built or published. It shows, for each message:
- part 0's route;
- the other parts (`alsoAsked`);
- the order the model gives (`dependsOn`, kept whole in
  `routing-probes.json`).

**Go/no-go per message**: a message answered `edit` or `addon`, its own
changes named and none dropped, goes ahead. A message answered `ask`,
`clarify` or `build`, or one that drops a change, is brought back to you
before its press. It would not open a request, or would test something else.
The switch can still be off here: a probe posts no request key either way.

**Phase D — the switch on** (yours; free):
1. GitHub → the repository's Settings → Secrets and variables → Actions:
   set `REQUEST_FLOW` to `on`.
2. Actions → *Deploy to Cloudflare* → *Run workflow* → branch `main` →
   *Run*. It redeploys the same commit with the secret uploaded. The image
   step reads `reused`, nothing rolls, and there is no wait.

**No free read shows the switch**: `/api/site/runtime` reports neither
`REQUEST_FLOW` nor `MODEL_REPLIES` (backlog). The request-mode canary is the
reading.

**Phase E — the request-mode canary** (one paid press, 2–5 credits):
scenario `rq-canary`.
- **It passes when**:
  - the routing answer names a request;
  - the page posts no edit of its own;
  - the server runs the one part to its end;
  - the page's card shows it done;
  - the reply is the model's;
  - the money closes.
- **If no request is opened**, the switch is not live. `request: true`
  refuses the edit the page would then post itself, so the press costs only
  its routing call, changes nothing, and the batch does not start.

**Phase F — the batch**, R1 to R5, one paid press each, in that order
(§4). **Before each press**, I read the ledger and check that the press's
upper estimate fits in what is left of the cap. If it does not, I stop and
come back to you.

**Phase G — the full-rewrite test RW**, separately (§9).

**Afterwards**: each press's evidence goes into the checklist and a dated
history file, the numbers stamped only after the runs. Nothing is pressed
twice to check it again.

### 3.1 The boxes, by their descriptions

**Every press**: "Use workflow from" `main`. Every box not named is left as
it is. `<sha>` is `main`'s first 8 characters after the fast-forward; I give
it to you at the merge.

**The free runtime press (Phase B)**:
- "Run the ONE paid edit as well (yes/no)": `no`;
- "Refuse to spend unless the Worker reports this deploy sha (prefix, >=7
  chars). Blank = read and print only.": `<sha>`;
- "Refuse to spend unless a cold container reports this image id (exact).
  Blank = read and print only.": `882477e1bbbe8cbe`.

**The routing controls (Phase C)**:
- "Run the ONE paid edit as well (yes/no)": `yes`;
- "ROUTING-ONLY BATCH: the name of a committed probe list in
  scripts/router-probes (e.g. router-audit-1). …": `request-flow-1`;
- the deploy sha box: `<sha>`; the image box: `882477e1bbbe8cbe`;
- "What to change", the scenario, job, version, expected-route and
  expected-rows boxes: blank.

**Each canary press (Phases E and F)**:
- "Run the ONE paid edit as well (yes/no)": `yes`;
- "RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …": the
  scenario's name (`rq-canary`, `rq-1-classes`, `rq-2-wholesale`,
  `rq-3-facebook`, `rq-4-logo`, `rq-5-away`);
- "The site to edit. Defaults to the canary site; name another to run this
  against it. Not needed with read_job.": `fold-lane-bakery`;
- the deploy sha box: `<sha>`; the image box: `882477e1bbbe8cbe`;
- "What to change" and the probe-list box: blank.

## 4. The batch

Every press runs on `fold-lane-bakery`, through the real app in a real
browser, signed in as its owner. Each is judged against its own before-read,
so an earlier press's change does not spoil a later one. **Demo changes are
kept afterwards** (your rule): there is no restore and no separate rehearsal,
and each paid press's own preflight checks the deploy and the image first.

**Never allowed in any press**:
- the full rewrite, or its go-ahead;
- removing, moving or renaming a page;
- rules, photographs, or a new database table.

A part routed to any of them is stopped at once through the request's own
Stop, and recorded. **No message asks for a photograph, so nothing is
bought from fal.**

| Press | The message (exactly) | Covers | Expected request | Estimate |
|---|---|---|---|---|
| **rq-canary** | On the Visit page, change the heading 'Come to the bakery' to 'Come and see us'. | request mode live | one part (`text` or `look`), `done`; request `done` | 2–5 |
| **R1** `rq-1-classes` | Change the site description to say we now run Saturday bread-making classes, put a link to the new Classes page in the menu, and add a Classes page that explains the classes. | Edit and Add-on, edit first; several operations; a prerequisite named later | every part `done`, request `done`; the menu link's work after the page | 9–24 |
| **R2** `rq-2-wholesale` | Add a Wholesale page for cafés that want to order loaves in bulk and put a link to it in the menu, then change the Walnut Levain's price to £6.20. | Add-on first, then Edit; a menu link the add-on sets aside | three parts `done` (the page, the set-aside link, the price); request `done` | 10–25 |
| **R3** `rq-3-facebook` | 1. On the Visit page, change the heading 'The shutters and the street' to 'Our shop on the street', and add a link to our Facebook page in the footer. 2. *(the answer)* It's facebook.com/harbourloafbristol | a step's question and the answer resuming it; an independent part going ahead | after turn 1: heading `done`, Facebook `waiting` with a question about the address; after turn 2: both `done`, request `done` | 4–12 |
| **R4** `rq-4-logo` | Change the home page heading 'Fed every morning since we opened' to 'Fed every morning since 2019', and use the attached picture as our logo. *(with `ui-logo-2.png` attached)* | an attachment read by a later part | heading part `done`, logo part `done`; request `done` | 3–7 |
| **R5** `rq-5-away` | Add a line to the Order page saying orders close at 8pm the night before, and change the Gallery page heading 'Photographs of the bakery's work' to 'Photographs from the bakery'. | the tab closed straight after sending: the server finishes alone | every part `done` while no page is open; the reopened tab shows it ended | 8–17 |

### What each press must leave on the site

Each list is checked against that press's own before-read, and **everything
not named must be unchanged**: every other stored page byte for byte apart
from the named places, the stored config, and every row.

**rq-canary**:
- `/visit`'s first heading reads *Come and see us*, and *Come to the bakery*
  is gone from it.

**R1**:
- the description says the bakery now runs Saturday bread-making classes
  (only that field changed);
- a new page `/classes`, answering 200, explains the classes;
- every page with a menu gains *Classes* → `/classes` and keeps every item
  it had;
- the menu link is made only after the page exists (the job order);
- the router may plan this as two parts or three. For example: the look door
  makes the description and the link, waiting for the page; or the
  description, the link and the page are three parts, the link waiting for
  the page. Either passes.

**R2**:
- a new page `/wholesale`, answering 200, is about cafés ordering in bulk;
- every menu gains *Wholesale* → `/wholesale`, keeping its items;
- `loaves` id 5 (Walnut Levain) reads 6.2 and shows *£6.20* on `/order`;
- the other six rows are unchanged, read whole (`0-6/7`);
- the menu link is its own part, carved from the add-on step's own words
  (`scopes`), which is the first real-model evidence for that;
- if the router lists the link as a part of its own instead, the site comes
  out the same but the add-on's set-aside is not exercised. That is recorded
  as a finding, not a pass of the set-aside.

**R3**:
- `/visit`'s second heading reads *Our shop on the street*;
- after the answer, every footer keeps its Instagram link and gains one
  Facebook link to `facebook.com/harbourloafbristol`;
- before the answer, nothing about Facebook is on the site.

**R4**:
- the home page heading reads *Fed every morning since 2019*;
- the routing call carried the file byte for byte (sha256 `38d29a04…`);
- every page's header logo is
  `/u/fold-lane-bakery/38d29a0457eedf0f9778d4a9f4104d27.png`;
- the served file's sha256 is the attached file's, so the exact bytes
  reached the logo step.

**R5**:
- `/order` gains one line saying orders close at 8pm the night before;
- `/gallery`'s second heading reads *Photographs from the bakery*;
- the request ended while no page was open, and nothing read the request's
  own route meanwhile;
- the tab opened afterwards shows the request ended, every part done, and
  its replies.

### If a press does not go as expected

A press that fails a check is reported with its evidence and not run again
without your word. If a message takes another path (for example the router
asks a question first, or a step makes a guess instead of asking in R3), that
is a finding, recorded as it happened.

If the request flow itself misbehaves (parts out of order, a part run twice,
money that does not close), the batch stops there, and **the switch goes off
by §8** while the evidence is read.

## 5. How the charges are verified

**For every press, three readings must agree.**
1. **The canary's money check** (`moneyVerdict`):
   - the balance before less the balance after equals the routing calls' own
     stated costs plus each of the request's jobs' ledger debits less
     refunds;
   - each job's row cost equals its debits;
   - a job exempt or never reserved has no ledger row.
2. **My read of the ledger after the press** (free; non-secret columns of
   `credit_events` and `edit_jobs`), every new row by id:
   - the message's routing charge exactly once (`route:<slug>:<key>`, reason
     `route`), and none for the same message sent again;
   - each later part's routing job charged once through its own reserve
     (`<job>#1`);
   - each step's reserves (`<job>#n`), and refunds by the bare job id;
   - no reference twice;
   - the sum equal to the balance's move.
3. **The replies**: any charge a reply states matches the rows. A request's
   own reply states each unfinished part's charge from its jobs' rows.

**Expected shape, per press**:
- one routing charge for the message;
- one routing reserve per later part;
- each step's own charge;
- R3's answer adds one routing call, the resumed step's work and nothing for
  the part already done;
- a step that asks charges nothing for the edit, as built and tested with
  supplied answers (not yet measured live);
- R4's logo step is exempt (no ledger row).

## 6. How the model-written replies are verified

**Captured by the canary**:
- each reply as the page shows it (browser-visible text);
- the answer each came from, which carries its source (`model`);
- R3's question card.

A reply that could not be had shows the old composed sentence. That is
recorded as such, never passed as the model's.

**I read every reply against the request's own facts**:
- the parts and statuses;
- each job's applied changes and targets;
- the site's before and after;
- the ledger.

**I record a pass or fail per reply, quoting it**:
1. **Done**: says what was done, each change with its page or list, and only
   what the operations did.
2. **Not done**: says plainly what was not done and why, and never calls
   unfinished work done.
3. **Waiting**: R3's question asks for the one missing detail in plain words,
   and does not ask again for anything the message gave.
4. **Money**: any charge stated is the one the rows show.
5. **No internals**: no layer, lane or job names, no ids, no status codes.
6. **Natural**: reads as a person would say it, not a template, with no
   sentence repeated from another part's reply.

**All the parts done means no request-level reply** (`nothing-to-add`), so
the expected replies are one per part. R3's question is the step's own. RW's
waiting part has the request's go-ahead reply, which states what it is, why,
and the measured cost.

**Not charged**: each reply is a quick-model call billed to us, not the
customer, at about a third to half a credit of model cost. The batch makes
about 12–14, about 4–7 credits' worth, which is not on the ledger.

## 7. Cost and the cap

**Measured references**:
- routing: 1–3 a message, about 1.3 on average (runs 90–92);
- a text, data or menu step: about 1;
- a look-door step: 2–4 (run 66 made a move and a menu change for 4);
- a line added by the add-on: 7 (run 92);
- a page added by the add-on: 2–13 (runs 47–51). Taken here as 5–15, for a
  page with its own writer;
- the logo step: exempt;
- a revise of a whole site: 17 (once); first builds 11–45.

| Press | Estimate | Likely |
|---|---|---|
| Routing controls (7 probes) | 7–11 | 9 |
| rq-canary | 2–5 | 2.3 |
| R1 | 9–24 | 14 |
| R2 | 10–25 | 14 |
| R3 (two turns) | 4–12 | 6 |
| R4 | 3–7 | 3.6 |
| R5 | 8–17 | 11 |
| **Everything but RW** | **43–101** | **about 59** |
| RW, separately (§9) | 12–50 if pressed; about 2 if not reached | about 20 |

**The proposed cap is 100 credits** for everything but RW, out of the 137
read today.
- **These are estimates, not limits.** Nothing in the product enforces a
  per-request cap; the balance is the only bound.
- **The cap is enforced between presses.** Before each press I read the
  ledger. If the press's upper estimate does not fit in what is left, I stop
  and come back to you.
- **Within a press**, a scenario's budget is checked before each message.
  Once sent, a request's parts run on the server, so a press's own bound is
  its message's upper estimate.
- **RW has its own cap of 50** and runs only if at least 50 credits are left
  after the batch. That also clears the build path's floor of 20.

## 8. Stopping new requests while accepted work finishes, and rolling back

**To stop new requests**:
1. Set the GitHub secret `REQUEST_FLOW` to `off`.
2. Actions → *Deploy to Cloudflare* → *Run workflow* → `main`.
3. It takes effect when that run finishes. Its drain waits for live job
   leases, up to 14 minutes, then deploys in about a minute; the image is
   reused, with no roll and no wait.

**From then on, a new message is not taken on as a request**, and the page
drives its steps exactly as before.

**Accepted requests finish.** The switch is read in one place only, where
the routing call accepts a message (`requestFlowOn` in `worker.js`'s routing
route). These keep working with it off:
- each job's end;
- the two-minute sweep (`runRequestSweep`, cron `*/2`);
- the request's routes: follow, Stop, the go-ahead.

So every accepted request goes on to its end, and a page opened later still
shows it.

**Other switches**:
- **One request**: its card's *Stop the rest* ends whatever has not started.
  A part already publishing completes.
- **Replies**: `MODEL_REPLIES` → `off` and redeploy the same way. Replies are
  then composed as before, with nothing else changed.

**Rolling the code back**:
- the range revert verified in Phase B (`git revert --no-commit
  b8d12ff9..<candidate>`, one commit), pushed to `main`;
- the deploy reuses `8bfc67dc695e65cc`, which the registry holds.

**Turn the switch off first**, and let accepted requests end (or Stop them)
before rolling the code back. The old code neither moves a request on nor
sweeps it, so an unfinished request would be left as it stood.

## 9. The full-rewrite test (RW), separately

**The message**: *We're changing what we do: turn this website from a bakery
shop into a booking tool for our Saturday bread-making classes.*

**Why this message.** A request reaches the full rewrite's go-ahead only when
a step finds a change only a rebuild can make. A change of the site's kind
is the one natural case (`picker/build`).

**What may happen instead.** A message that itself asks for the rewrite is
answered `build`, which opens no request and takes the page's old path. The
live matrix found no natural message that reliably reaches the go-ahead. So
**RW is exploratory**: probe RQRW in the routing controls shows the router's
answer for about 1.3 credits first, and if it is `build`, RW is not run.

**How it runs**:
- **in your own chat in the app**, not the canary, because the canary walls
  the go-ahead by design. You type the message;
- **expected**: one part, routed `look`, waiting for your go-ahead, with the
  request's reply saying what the rewrite is, why, and its measured cost;
- **you decide** whether to press the go-ahead or *Stop the rest*, which is
  free;
- **if pressed**, the existing queued build rebuilds the site as a booking
  tool. That is one rewrite under one id, charged once (`build:<id>:*`
  refs), and the request ends `done`;
- **I verify afterwards**:
  - the ledger rows and the build's job row;
  - the request's statuses on your page (a screenshot or your word);
  - every served page.

**Cost**: routing about 1.3, the step before the climb 0–2, and the rebuild
11–45 (17 measured for a revise), so **12–50 if pressed**, about 2 if it stops
before. It runs only on its own approval, with its own cap of 50, and only if
50 are left.

**Afterwards**: the bakery would no longer be a bakery. RW runs last, and the
version before it is recorded so a free restore can put the bakery back. By
your demo rule it stays as it is unless you ask.

## 10. What this batch cannot show

- How often a message takes each path: every message is routed once, by one
  model.
- A row set aside beside a page (the menu link was chosen instead), and
  several devices following one request at once. Both are shown with
  supplied answers only.
- Any site but the bakery, or any phrasing but these.
- The full rewrite's go-ahead, unless RW reaches it.
- A request on a site whose owner has edits unqueued (`EDIT_ASYNC` off for
  them): the switch then does nothing there, as built.

## 11. Decisions that are yours

1. **The plan as a whole and its cap of 100**: the instruments first (free),
   then the merge on your word, the runtime press, the routing controls, the
   switch, the canary and R1–R5.
2. **`MODEL_REPLIES` at the merge**: left at its default, **on**, which I
   recommend because the batch reads the replies; or set to `off` until
   Phase D.
3. **R3 and R5**:
   - by the canary's two new step options (recommended): walled, budgeted,
     and every call recorded;
   - or by your own chat in the app, with me verifying afterwards from the
     ledger, the job rows and the served pages.
4. **RW**: whether to run it after the batch, on its cap of 50, and whether to
   restore the bakery afterwards (free).
5. **The demo changes stay**, by your rule, unless you say otherwise.

**Found while preparing, and kept separate** (`docs/backlog.md`):
- `REQUEST_FLOW` has no allowlist: on applies to every owner whose edits are
  queued. Today every live site belongs to the building account.
- The runtime read cannot show either new switch.

## Appendix A: the routing controls, `scripts/router-probes/request-flow-1.json`

Committed only on your approval, exactly as below (sha256
`eda0d61e9302aadb5f5377410ddb9190dcb1a118ac43cd906bb7d4da480c8ed8`; the press
prints it):

```json
{
  "batch": "request-flow-1",
  "probes": [
    {
      "id": "RQ0",
      "site": "fold-lane-bakery",
      "name": "Harbour Loaf",
      "message": "On the Visit page, change the heading 'Come to the bakery' to 'Come and see us'.",
      "given": "/visit's first heading reads 'Come to the bakery' (served page read 2026-10-03 23:00 UTC; live version 01790923788063-bp9rcv).",
      "intended": [
        { "intent": "edit", "layer": "text", "alsoAsked": "none" },
        { "intent": "edit", "layer": "look", "alsoAsked": "none" }
      ],
      "basis": "one exact wording change on one named page: an edit, with nothing held back",
      "note": "The request-mode canary's message (rq-canary)."
    },
    {
      "id": "RQ1",
      "site": "fold-lane-bakery",
      "name": "Harbour Loaf",
      "message": "Change the site description to say we now run Saturday bread-making classes, put a link to the new Classes page in the menu, and add a Classes page that explains the classes.",
      "given": "No /classes page. The menu on / and /gallery reads Today's bake, The starter, Visit, Gallery, Order; on /order and /visit it has no Gallery. The description reads 'Neighbourhood sourdough in Bristol. Browse today's bake and order a loaf for collection.' (served pages read 2026-10-03 23:00 UTC).",
      "intended": [
        { "intent": "edit", "layer": "look", "alsoAsked": "some", "held": "add a Classes page that explains the classes", "runs": "Change the site description to say we now run Saturday bread-making classes" },
        { "intent": "addon", "alsoAsked": "some", "held": "Change the site description to say we now run Saturday bread-making classes", "runs": "add a Classes page that explains the classes" },
        { "intent": "edit", "layer": "look", "alsoAsked": "some", "held": "put a link to the new Classes page in the menu, and add a Classes page that explains the classes", "runs": "Change the site description to say we now run Saturday bread-making classes" }
      ],
      "basis": "three changes no one answer makes: the page is the add-on's; the menu link needs that page, which the message names later (dependsOn)",
      "note": "Read dependsOn too: the change holding the menu link must be numbered to wait for the Classes page."
    },
    {
      "id": "RQ2",
      "site": "fold-lane-bakery",
      "name": "Harbour Loaf",
      "message": "Add a Wholesale page for cafés that want to order loaves in bulk and put a link to it in the menu, then change the Walnut Levain's price to £6.20.",
      "given": "No /wholesale page. The site's own read of loaves answers whole (0-6/7): Walnut Levain is id 5 at 6 (read 2026-10-03 23:00 UTC).",
      "intended": [
        { "intent": "addon", "alsoAsked": "some", "held": "change the Walnut Levain's price to £6.20", "runs": "Add a Wholesale page for cafés that want to order loaves in bulk" },
        { "intent": "edit", "layer": "data", "alsoAsked": "some", "held": "Add a Wholesale page for cafés that want to order loaves in bulk and put a link to it in the menu", "runs": "change the Walnut Levain's price to £6.20" }
      ],
      "basis": "an addition (a page with its menu link) and an edit of one stored row: two answers, nothing dropped",
      "note": "With the add-on first, its step is expected to set the menu link aside as a part of its own, in its picker's words (scopes)."
    },
    {
      "id": "RQ3",
      "site": "fold-lane-bakery",
      "name": "Harbour Loaf",
      "message": "On the Visit page, change the heading 'The shutters and the street' to 'Our shop on the street', and add a link to our Facebook page in the footer.",
      "given": "/visit's second heading reads 'The shutters and the street'. Every footer has one Instagram link and no Facebook link (served pages read 2026-10-03 23:00 UTC).",
      "intended": [
        { "intent": "edit", "layer": "text", "alsoAsked": "some", "held": "add a link to our Facebook page in the footer", "runs": "change the heading 'The shutters and the street' to 'Our shop on the street'" },
        { "intent": "edit", "layer": "look", "alsoAsked": "some", "held": "add a link to our Facebook page in the footer", "runs": "change the heading 'The shutters and the street' to 'Our shop on the street'" },
        { "intent": "addon", "alsoAsked": "some", "held": "change the heading 'The shutters and the street' to 'Our shop on the street'", "runs": "add a link to our Facebook page in the footer" }
      ],
      "basis": "the missing Facebook address does not decide the route, so the router must not ask; the step making the link asks for it",
      "note": "A clarify answer here is a finding: R3 would then begin with the router's question instead of a step's."
    },
    {
      "id": "RQ4",
      "site": "fold-lane-bakery",
      "name": "Harbour Loaf",
      "message": "Change the home page heading 'Fed every morning since we opened' to 'Fed every morning since 2019', and use the attached picture as our logo.",
      "attached": true,
      "given": "The home page has a heading 'Fed every morning since we opened'. The header logo is /u/fold-lane-bakery/2cc633d73b2d5ab38d29d94cf15c9ce6.png, the canary's ui-logo.png (served pages read 2026-10-03 23:00 UTC).",
      "intended": [
        { "intent": "edit", "layer": "text", "alsoAsked": "some", "held": "use the attached picture as our logo", "runs": "Change the home page heading 'Fed every morning since we opened' to 'Fed every morning since 2019'" },
        { "intent": "edit", "layer": "look", "alsoAsked": "some", "held": "use the attached picture as our logo", "runs": "Change the home page heading 'Fed every morning since we opened' to 'Fed every morning since 2019'" },
        { "intent": "edit", "layer": "logo", "alsoAsked": "some", "held": "Change the home page heading 'Fed every morning since we opened' to 'Fed every morning since 2019'", "runs": "use the attached picture as our logo" }
      ],
      "basis": "a wording change and a logo from the attached file: no one answer makes both",
      "note": "The probe says a file is attached but sends none; the paid press attaches the picture."
    },
    {
      "id": "RQ5",
      "site": "fold-lane-bakery",
      "name": "Harbour Loaf",
      "message": "Add a line to the Order page saying orders close at 8pm the night before, and change the Gallery page heading 'Photographs of the bakery's work' to 'Photographs from the bakery'.",
      "given": "/order says nothing about when orders close. /gallery's second heading reads 'Photographs of the bakery's work' (served pages read 2026-10-03 23:00 UTC).",
      "intended": [
        { "intent": "addon", "alsoAsked": "some", "held": "change the Gallery page heading 'Photographs of the bakery's work' to 'Photographs from the bakery'", "runs": "Add a line to the Order page saying orders close at 8pm the night before" },
        { "intent": "edit", "layer": "text", "alsoAsked": "some", "held": "Add a line to the Order page saying orders close at 8pm the night before", "runs": "change the Gallery page heading 'Photographs of the bakery's work' to 'Photographs from the bakery'" },
        { "intent": "edit", "layer": "look", "alsoAsked": "none" }
      ],
      "basis": "a new line on one page and a wording change on another: an addition and an edit, or one look answer making both",
      "note": "R5 is sent with the tab then closed; the routing answer is the same either way."
    },
    {
      "id": "RQRW",
      "site": "fold-lane-bakery",
      "name": "Harbour Loaf",
      "message": "We're changing what we do: turn this website from a bakery shop into a booking tool for our Saturday bread-making classes.",
      "given": "The site is a shopfront: five pages (/, /order, /visit, /gallery, /starter), a loaves list and an order form (served pages read 2026-10-03 23:00 UTC).",
      "intended": [
        { "intent": "edit", "layer": "look", "alsoAsked": "none" }
      ],
      "basis": "a change of the site's kind is the look door's to read as one only a rebuild makes (picker/build), which is what reaches the request's go-ahead",
      "note": "The separate full-rewrite test (RW). Answered build, the message itself asks for the rewrite, opens no request, and RW is not run."
    }
  ]
}
```

A `clarify` answer to any probe keeps one pending question on the bakery
until the next message replaces it. The request-mode canary's message does.

## Appendix B: the scenarios (`scripts/canary-ui.mjs`, committed on approval)

**Every scenario**:
- site `fold-lane-bakery`; `request: true`;
- its budget is its upper estimate, checked before each message;
- the always-refused list of §4 applies;
- "nothing else changed" is checked against its own before-read.

| Scenario | Budget | Edit layers allowed | Add-on | Steps |
|---|---|---|---|---|
| `rq-canary` | 6 | text, look | shut | `say` RQ0's message |
| `rq-1-classes` | 25 | look, text, nav, page (a page ask the page rung hands to the add-on) | open | `say` RQ1's message, `ms` 30 min |
| `rq-2-wholesale` | 26 | data, nav, page (as above) | open | `say` RQ2's message, `ms` 30 min |
| `rq-3-facebook` | 13 | text, look, nav | open | 1. `say` RQ3's message, `until: "question"`, `ms` 20 min; 2. `say` *It's facebook.com/harbourloafbristol*, `ms` 20 min |
| `rq-4-logo` | 8 | text, look, logo | shut | `attach` `test/fixtures/ui-logo-2.png`, `say` RQ4's message |
| `rq-5-away` | 18 | text, look | open | `say` RQ5's message, `away: true`, `ms` 30 min |

**The checks each must pass**:
- **every press**:
  - the request opened;
  - one routing call carried the words (and R4's file);
  - no edit posted from the page;
  - every part done where allowed, nothing stopped;
  - the money closed;
  - each reply's source is `model`;
- **rq-canary**: the `/visit` heading changed;
- **R1**:
  - the description changed;
  - `/classes` added;
  - *Classes* → `/classes` on every menu;
  - the link's job after the page's;
- **R2**:
  - `/wholesale` added;
  - *Wholesale* → `/wholesale` on every menu;
  - `loaves` id 5 6 → 6.2, shown *£6.20* on `/order`, the other rows
    unchanged;
  - the link part carved from the add-on's words;
- **R3**:
  - after turn 1, one part waiting with its question;
  - after turn 2, the `/visit` heading changed and a Facebook link to
    `facebook.com/harbourloafbristol` in every footer, Instagram kept;
- **R4**:
  - the home heading changed;
  - the logo is `/u/fold-lane-bakery/38d29a0457eedf0f9778d4a9f4104d27.png`
    on every page;
  - the served bytes' sha256 is `38d29a04…`;
- **R5**:
  - the request ended while away, with no read of its own route;
  - the reopened tab shows it ended;
  - the `/order` line added;
  - the `/gallery` heading changed.
