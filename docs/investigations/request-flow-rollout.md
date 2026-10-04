# The combined request flow: rollout and real-model validation (revised plan, for your approval)

Prepared 2026-10-03; **revised 2026-10-04 after your review**. **The product is
frozen** at `567409ce`. The instruments it needs (Phase A) are at `dd632b96`:
scripts, tests and the canary form's help text only, no product file.

**Status (2026-10-04, after deploy 2181)**: Phase B ran on your word. `main` was
fast-forwarded to `f69c873c` and deployed once, as deploy 2181. The image
`882477e1bbbe8cbe` was built and rolled as predicted. `REQUEST_FLOW` was
uploaded `off` and `MODEL_REPLIES` `on`, the workflow's fallbacks, read in the
deploy log. The served files are byte-identical to the merged ones.
**Runtime-confirmed by your free press, run 93** (02:02 UTC): both readers
answered `f69c873cc6e0`, a cold container `882477e1bbbe8cbe`, and nothing was
charged. The session's own dispatch had answered 403. **Phase C is done**: deploy 2182 (02:12 UTC), your
redeploy of `f69c873c` with `REQUEST_FLOW` from a secret; the image was reused,
and the log masks the value (and every `on`). **Phase D passed**: `rq-canary`,
run 94 (02:16–02:20 UTC), taken on as a request and finished by the server,
every check `ok`, 4 credits (137 → 133); so the switch is live. **Phase E (R1–R5)
can now be one press**, `rq-batch` (built on your word; §3.1). **Phase E began
as run 95**: R1 made the description change and the Classes page, but its
menu link failed (`no-menu`) and its parts' replies were not the model's.
The batch stopped after it, as built; R1 cost 21, and the batch has spent 25.
**Both findings are looked into, free** (`docs/investigations/request-batch-findings.md`):
the add-on links a new page from one page's menu, and the menu step then finds
nothing to add; every reply call on R1's parts ran into its 12 s ceiling.
Fixes are proposed for your choice, and R2–R5 wait for them.
**Both are now fixed on the branch, on your word** (not merged or deployed;
nothing paid run; `docs/investigations/request-batch-findings.md`, *What is
fixed*): an addition names its items and code puts each into every list in its
scope that lacks it, and a reply is written on the server once the job's
outcome and money are final, never by a read. Shown with supplied model answers
only. **Your review of the fixes** found four more things, now done on the
branch (`docs/history/2026-10-04-review-round.md`): a footer addition accounts
for every page it names; a retry is never claimed before its time; the page
applies a job's outcome at once and follows its reply on its own; and R2–R5
can be one press, `rq-batch-r2` (§3.1). **Next, after your merge and
deploy**: the free runtime press, then one focused paid press, `rq-menu-link`
(§4: the bakery's Classes link put into the three menus that lack it, its
reply the model's own; 3–9), then R2–R5 in one press. R2–R5 and RW have not
been pressed. The presses' record:
`docs/history/2026-10-04-request-batch.md`. The record: `docs/history/2026-10-04-deploy-2181.md`.

Your first order: *"Freeze this implementation and prepare the concrete rollout
and real-model validation batch without executing it yet. Use a compact set of
realistic messages covering Edit plus Add-on in both orders, multiple
operations, a prerequisite mentioned later, a deferred menu link or row,
clarification and resume, attachments, and closed-tab continuation. State the
exact messages, expected site changes and request statuses, how you will verify
charges and natural model-written replies, and the estimated total cost with a
spending cap. Include the deployment and REQUEST_FLOW activation steps, the
request-mode canary, and how to stop new requests while allowing accepted work
to finish. Keep any full-rewrite test separately identified with its cost."*

Your review of it (2026-10-03), in full: *"Proceed with the free preparation
only: fix the expired-date test fixtures using a controlled test clock,
implement the planned canary options and scenarios, verify them with focused
tests, and push with green CI. Keep product behavior frozen. Revise the rollout
plan to capture routing evidence from the actual end-to-end requests instead of
paying for seven separate preliminary routing probes; a prior model answer does
not guarantee the next one. Record valid alternative execution paths
accurately, distinguishing a successful user outcome from coverage of a
particular internal handoff. Correct the spending language: the proposed
100-credit threshold is checked between requests and is not an enforced ceiling
while a request runs; show the revised estimate and potential overrun clearly.
Also correct "never allowed" claims where enforcement is only browser polling
followed by Stop: identify which restrictions are enforced before server
execution and which are merely detected afterward, including during the
closed-tab test. Do not introduce a broad new control system; report any
concrete restriction needed before running the batch. Keep the optional full
rewrite separate, model-written replies enabled in the proposed test
configuration, and demo changes as they are afterward. Save the final plan and
handoff in the repo. No merge, deployment, switch activation, paid calls or
container rebuild yet."*

**What changed in this revision**:
- **No routing press.** The seven-probe press (the old Phase C and Appendix A)
  is gone. Each press records the router's answer to its own message, and the
  request that came of it (§3, Phase E; Appendix A).
- **Outcome and coverage are separate verdicts** (§4.1): the checks say whether
  the site ended up as asked; the coverage says which internal hand-over the
  run went through, and never fails a press.
- **The spending language is corrected** (§7): 100 is a threshold I check
  between presses, not a ceiling while a request runs. The estimate is now
  **36–90**, likely about 50, with the possible overrun shown.
- **The "never allowed" list is replaced** by what is enforced, and when
  (§4.2): what the page would post is refused before it leaves; what the
  server runs is only detected afterward and stopped; what an allowed step
  decides inside its own route is seen only in the after-read.
- **The instruments are built and tested** (Phase A, done), including the
  date fix with a controlled clock.

## 0. In one screen

- **Order**: instruments (done, free) → merge and deploy, switch off → free
  runtime press → switch on → request-mode canary → R1–R5. RW, the full
  rewrite, stays separate and runs only on its own approval (§9).
- **The batch**: six presses on `fold-lane-bakery`, the same messages as
  before. R3 has a second message, the answer to a question. Together they
  cover Edit plus Add-on in both orders, several operations, a prerequisite
  named later, a menu link the add-on sets aside, a step's question and its
  answer, an attached file read by a later part, and a request finished with
  its tab closed — each **where the router and the steps take that path**,
  which is recorded per press (§4.1).
- **Cost**: about **36–90 credits** for the six presses, likely about 50,
  against a balance of **137** (read 2026-10-04 00:22 UTC). **100 is a
  threshold I check between presses, not a ceiling**: once a message is sent,
  nothing stops its parts on cost. The plausible overrun is in §7.
- **Enforcement, in one line**: refused before it leaves — anything the page
  itself would start (a build, the rewrite's go-ahead, an edit or add-on of its
  own); detected afterward and stopped — a part the server runs at a layer the
  press does not allow (read every 3 s, every 20 s with the tab closed; a fast
  part can finish first); seen only in the after-read — what an allowed step
  decides inside its own route (§4.2).
- **Concrete restriction needed before the batch**: none is required, by your
  demo-site rule and with the recoveries in §4.3. One choice is yours there
  (R2's wording, if you want a new table to be less likely; no wording rules it
  out).
- **Model-written replies**: on in the proposed configuration
  (`MODEL_REPLIES` at its default). **Demo changes stay** afterwards.
- **Stopping new requests**: `REQUEST_FLOW` off and redeploy; accepted
  requests still finish (§8).

## 1. Where things stand (read 2026-10-04, free)

- **`main` is `f69c873c`** (deploy 2181, 2026-10-04): the reviewed changes and
  this round's instruments, merged. The branch (`claude/help-needed-ehlwlj`)
  is `main` plus records.
- **The container image** is `882477e1bbbe8cbe` (194 inputs), built and
  rolled by deploy 2181 at 01:04:54 UTC, as predicted (from
  `8bfc67dc695e65cc`).
- **The building account**: balance **137**, last ledger row 355
  (2026-10-02 06:49 UTC), no job open (read 2026-10-04 02:04 UTC, after the
  runtime press).
- **The runtime check**: passed, as your free press run 93 (02:02 UTC): both
  readers `f69c873cc6e0`, a cold container `882477e1bbbe8cbe`, nothing
  charged.
- **Unit CI was red from 2026-10-03 23:00 UTC for a reason of the calendar's**:
  three one-time job tests dated their job `2026-10-03`, a past date once that
  day ended in London. **Fixed** (Phase A, item 0).
- **`fold-lane-bakery` (Harbour Loaf)** is live at `01790923788063-bp9rcv`
  (served pages read 2026-10-03 23:00 and 23:53 UTC; the same today):
  - `/`: *Harbour Loaf*; *Fed every morning since we opened*; *Order a loaf for
    collection*;
  - `/order`: *Order a loaf*; *Pick a loaf and a collection slot*;
  - `/visit`: *Come to the bakery*; *The shutters and the street*; *Order a
    collection so we hold a loaf*;
  - `/gallery`: *Our Gallery*; *Photographs of the bakery's work*;
  - `/starter`: *This page isn't finished yet* (no header or footer);
  - the menu: on `/` and `/gallery` Today's bake, The starter, Visit, Gallery,
    Order; on `/order` and `/visit` the same without Gallery;
  - the footer: one Instagram link; the logo `/u/fold-lane-bakery/2cc633d7….png`
    (the canary's `ui-logo.png`);
  - the description: *Neighbourhood sourdough in Bristol. Browse today's bake
    and order a loaf for collection.*;
  - `loaves`, read whole as the site serves it (`0-6/7`, 23:53 UTC): Country
    White 4.8, Dark Rye 5.2, Seeded Wholemeal 5.4, Olive & Rosemary 5.8,
    Walnut Levain 6, Sea Salt Focaccia 4.5, Rye & Caraway 5.

## 2. What the merge carries

A fast-forward of `main` to the branch puts five reviewed changes live at
once, plus this round's instruments:

| Change | Switch, and its default when unset | What a customer sees |
|---|---|---|
| Model-written replies (`b17747ed`, `906bacbe`, `ddfe44f8`) | `MODEL_REPLIES`, **on** | an edit's or add-on's ending explained by the quick model from the facts of what happened. Not charged; about a third to half a credit of model cost each, ours |
| Information limits, batch 1 (`2a17e2cb`) | none | one size policy; questions and options whole; at most three files per request; the page list read from the site |
| The mixed-work fixes (`460ab6e5`) | none | every executed step's result kept and named; no silent drops; add-on declines named |
| Footer lists and the menu (`13c22ea3`) | none | no limit of eight footer links or ten menu items; each refusal named |
| The combined request flow (`b1d96b3d`, `b7564f82`, `4fd05e68`, `567409ce`) | `REQUEST_FLOW`, **off** | nothing, while off; on, a site's message becomes a request the server finishes |
| The batch's instruments (`dd632b96`) | none | nothing: the canary, its tests and the canary form's help text |

Three files a visitor's browser loads change: `public/chat.js`,
`public/edit-poll.js` and `public/styles.css`. Each gets the served-file check
(Phase B).

**`MODEL_REPLIES` is on in the proposed configuration**: it goes live with the
merge at its default, and the batch's reply checks need it.

## 3. The steps, in order

**Phase A — the instruments. Done, free, on the branch** (no product file, no
deploy, no paid call):
- **0. The one-time job tests' date, on a controlled clock.**
  `test/addon-route.test.mjs` runs its five one-time job cases on a clock fixed
  at 2026-10-02 12:00 UTC (`t.mock.timers`, `Date` only), so the job's date
  `2026-10-03` is always tomorrow there. With the clock moved to 2026-10-04,
  exactly the three expired cases fail, as before the fix.
- **The canary's request mode** (`scripts/canary-ui.mjs`, Appendix A):
  - `request: true`: the browser's wall refuses any edit or add-on the page
    itself would post; a message not taken on as a request stops the press;
  - `until: "question"`: a message ends once a part waits on a step's question
    and the page shows it; the next message is then typed into the composer as
    the answer. The router's own question ends it too, recorded as the other
    path. If no question comes, the answer is not sent;
  - `away: true`: once the page has drawn the request's card, the tab is
    closed; the request is then read only through the requests list, which
    moves nothing, every 20 s, from the canary's own session; once it has
    ended, a new tab opens the site and must show it ended. Any read of the
    request's own route while the tab is closed is recorded, and fails;
  - `ms`: a message's own time bound, at most 30 minutes, and a press's bounds
    together at most 30, so a press ends inside the workflow's 45 with its
    record written;
  - `addon: true`: the add-on step beside the listed edit layers;
  - **the routing evidence of each message** (`routingEvidence`): the router's
    own answer to it, the parts it held back and their order, whether the answer
    was the model's, and each part's words, status and route as the request
    began and ended;
  - **the publishes in the order they were made** (`chainOrdered`): a request
    runs its parts in the order their needs allow, not their numbers;
  - **a later message's jobs are only its own**: R3's answer never re-reads or
    re-charges the first message's jobs.
- **The verdict** (`scripts/canary-requests.mjs`, new): each press's
  **checks** (§4.1), its **replies**, and, apart from both, its **coverage**.
- **The scenarios** of Appendix B, and **a second logo picture**,
  `test/fixtures/ui-logo-2.png` (240×240, a green disc, 1,224 bytes, sha256
  `38d29a04…9d1c0e`), since the live logo already is `ui-logo.png`.
- **The canary form's scenario box** names the new scenarios
  (`.github/workflows/edit-canary.yml`, help text only).
- **Proven with**: 38 focused cases (`test/canary-requests.test.mjs`), among
  them the driver end to end through a stand-in app (the switch not live, R3's
  question and answer, R5's closed tab, a read of the request's route while
  away, a wall hit while away, a missing reader, a message's own bound), the
  verdict against the bakery's own stored
  pages changed by the product's own writers, and the readers that run inside
  the app run in a VM; the full suite; a mutation sweep; CI (the handoff has
  the numbers).

**Phase B — the merge and its deploy, on your word "merge".**
1. **Before**:
   - nothing in flight: no Actions run, and no open job (a free read);
   - unit tests and the site build green on the candidate;
   - the image predicted over both ends again (`b8d12ff9` →
     `8bfc67dc695e65cc`, the candidate → expected `882477e1bbbe8cbe`);
   - the rollback verified in a throwaway worktree: `git revert --no-commit
     b8d12ff9..<candidate>` must give back `b8d12ff9`'s tree;
   - the three served files read before the deploy lands.
2. **Your GitHub secrets**: `REQUEST_FLOW` unset or `off`. `MODEL_REPLIES`
   unset (its default, on).
3. I fast-forward `main` to the candidate and push. One deploy run follows. It
   waits for live job leases (up to 14 minutes) before it deploys.
4. **I read the log**: `built …:882477e1bbbe8cbe (registry answered 404; 194
   inputs …)`; the pair `- …8bfc67dc695e65cc` / `+ …882477e1bbbe8cbe` and
   `SUCCESS Modified application`; each served file byte-identical to the
   merged one.
5. **Container work waits 15–20 minutes** after the roll.
6. **Your free runtime press** (§3.1). It passes when the log reads
   `build-health 200 deploy=<sha12> image=882477e1bbbe8cbe` and `runtime 200 …
   async=true runner=true`, every free check is `ok`, and nothing is charged.
   Until then the deploy is *deployed, not runtime-confirmed*.
7. Deploy 2181 goes into `docs/deploy-record.md`.

**Phase C — the switch on** (yours; free):
1. GitHub → the repository's Settings → Secrets and variables → Actions: set
   `REQUEST_FLOW` to `on`.
2. Actions → *Deploy to Cloudflare* → *Run workflow* → branch `main` → *Run*.
   It redeploys the same commit with the secret uploaded; the image step reads
   `reused`, nothing rolls, and there is no wait.

No free read shows the switch: `/api/site/runtime` reports neither
`REQUEST_FLOW` nor `MODEL_REPLIES` (backlog). The request-mode canary is the
reading.

**Phase D — the request-mode canary** (one paid press, 2–5 credits): scenario
`rq-canary`.
- **It passes when** the message was taken on as a request, the page posted no
  edit of its own, the one part ran at `text` or `look` and the request ended
  done, `/visit`'s first heading reads *Come and see us* and nothing else
  moved, the reply is the model's own and on screen, and the money closes.
- **If no request is opened**, the switch is not live: the page's own edit is
  refused before it leaves, so the press costs its routing call, changes
  nothing, stops, and the batch does not start.

**Phase E — the batch**, R1 to R5, one paid press each, in that order (§4).
**Before each press** I read the ledger and press only if what the batch has
spent so far plus the press's upper estimate is at most 100; otherwise I stop
and come back to you (§7).
- **Or in one press** (`rq-batch`, 2026-10-04, on your word): the canary runs
  R1–R5 in that order itself, one at a time, each as its own press. It applies
  the same rule between presses, from its own box (the spend before it) and
  each press's measured spend, and it also stops after a press that fails
  (`docs/instruments.md`).
- **R2–R5 in one press** (`rq-batch-r2`, 2026-10-04, on your word): the same,
  from R2, after run 95 did R1. Its box is the batch's spend before it, at
  least 25 (rq-canary 4, R1 21) plus the focused check's.
- **The routing evidence comes from these presses themselves.** There is no
  separate routing press: a probe's answer does not bind the next answer to the
  same words, so the evidence that matters is the router's answer to the very
  message that ran. Each press records, for each message: the routing call's
  own answer (the part it makes and where, the parts held back, their order,
  whether the answer was the model's own), and the request as it began and
  ended (each part's words, status and route, and its jobs). It costs nothing
  beyond the press.

**Phase F — the full-rewrite test RW**, separately, only on its own approval
(§9).

**Afterwards**: each press's evidence goes into the checklist and a dated
history file, the numbers stamped only after the runs. Nothing is pressed
twice to check it again.

### 3.1 The boxes, by their descriptions

**Every press**: "Use workflow from" `main`. Every box not named is left as it
is. `<sha>` is **`f69c873c`**, `main` after the fast-forward (deploy 2181).

**The free runtime press (Phase B)**:
- "Run the ONE paid edit as well (yes/no)": `no`;
- "Refuse to spend unless the Worker reports this deploy sha (prefix, >=7
  chars). Blank = read and print only.": `<sha>`;
- "Refuse to spend unless a cold container reports this image id (exact).
  Blank = read and print only.": `882477e1bbbe8cbe`.

**Each canary press (Phases D and E)**:
- "Run the ONE paid edit as well (yes/no)": `yes`;
- "RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …": the
  scenario's name (`rq-canary`, `rq-1-classes`, `rq-2-wholesale`,
  `rq-3-facebook`, `rq-4-logo`, `rq-5-away`);
- "The site to edit. Defaults to the canary site; name another to run this
  against it. Not needed with read_job.": `fold-lane-bakery`;
- the deploy sha box: `<sha>`; the image box: `882477e1bbbe8cbe`;
- "What to change" and the probe-list box: blank.

**The focused check of run 95's fixes (`rq-menu-link`)**, after they are
merged and deployed: as each canary press above, with the scenario box
`rq-menu-link`, and the deploy sha and image boxes as that deploy names them.

**The whole batch in one press (`rq-batch`)**:
- "Use workflow from": **`claude/help-needed-ehlwlj`**, since the mode is on
  the branch and not on `main`;
- "Run the ONE paid edit as well (yes/no)": `yes`;
- the scenario box: `rq-batch`;
- "REQUEST BATCH ONLY (rq-batch): the credits the batch has already spent
  before this press …": `4`;
- the site `fold-lane-bakery`, the deploy sha box `f69c873c`, the image box
  `882477e1bbbe8cbe`; "What to change" and the probe-list box blank.

**R2–R5 in one press (`rq-batch-r2`)**, after the focused check, once the
continuation is merged and deployed:
- "Use workflow from": `main`;
- "Run the ONE paid edit as well (yes/no)": `yes`;
- the scenario box: `rq-batch-r2`;
- "REQUEST BATCH ONLY (rq-batch, rq-batch-r2): the credits the batch has
  already spent before this press …": 25 plus what the focused check cost
  (its own money check says it);
- the site `fold-lane-bakery`; the deploy sha and image boxes as that deploy
  names them; every other box blank.
- At the upper estimates — the focused check's 9, then R2 25, R3 12, R4 7 and
  R5 17 — the batch reaches 95 of 100, so every press fits.

## 4. The batch

Every press runs on `fold-lane-bakery`, through the real app in a real
browser, signed in as its owner, and is judged against its own before-read, so
an earlier press's change does not spoil a later one. **Demo changes stay
afterwards** (your rule): no restore and no separate rehearsal; each paid
press's own preflight checks the deploy and the image first.

| Press | The message (exactly) | What it is for | Estimate |
|---|---|---|---|
| **rq-canary** `rq-canary` | On the Visit page, change the heading 'Come to the bakery' to 'Come and see us'. | request mode live | 2–5 |
| **R1** `rq-1-classes` | Change the site description to say we now run Saturday bread-making classes, put a link to the new Classes page in the menu, and add a Classes page that explains the classes. | Edit and Add-on, the edit first; several operations; a prerequisite named later | 9–24 |
| **R2** `rq-2-wholesale` | Add a Wholesale page for cafés that want to order loaves in bulk and put a link to it in the menu, then change the Walnut Levain's price to £6.20. | Add-on first, then Edit; a menu link the add-on sets aside | 10–25 |
| **R3** `rq-3-facebook` | 1. On the Visit page, change the heading 'The shutters and the street' to 'Our shop on the street', and add a link to our Facebook page in the footer. 2. *(the answer)* It's facebook.com/harbourloafbristol | a step's question and the answer resuming it; another part going ahead meanwhile | 4–12 |
| **R4** `rq-4-logo` | Change the home page heading 'Fed every morning since we opened' to 'Fed every morning since 2019', and use the attached picture as our logo. *(with `ui-logo-2.png` attached)* | an attachment read by a later part | 3–7 |
| **R5** `rq-5-away` | Add a line to the Order page saying orders close at 8pm the night before, and change the Gallery page heading 'Photographs of the bakery's work' to 'Photographs from the bakery'. | the tab closed once the request is taken on: the server finishes alone | 8–17 |
| **The fixes' check** `rq-menu-link` (2026-10-04, pressed before R2–R5) | Put the Classes page in the menu on every page. | run 95's two fixes, live: the Classes link R1 left in two of five menus put into the three that lack it, the two that have it and the starter page (no menu) as they were; its reply the model's own, written in the background | 3–9 |

### 4.1 Outcome, and the paths that reach it

**Two verdicts per press, never mixed.**
- **The checks** say whether the customer got what they asked for, and nothing
  else: the request was taken on and ended with every part done at a route the
  press allows; the site holds exactly the named changes; everything not named
  is as it was (every stored page byte for byte apart from the named places, no
  page gone, the stored components, the stored description and every header
  logo unless named, and the owner's table listing: the same tables, rules,
  columns and row counts); no part started before a part it needed had
  finished; each reply is the model's own and on screen; the money closes. A
  failed check fails the press.
- **The coverage** says which internal hand-over the run went through: whether
  a part waited for another, whether the add-on step set the menu link aside,
  whether a step asked the question rather than the router, whether the file
  went to a later part. It is recorded, covered or not, and **never fails a
  press**: the router and each step choose their own path, and the same message
  can reach the same outcome by another valid path. A press whose checks pass
  but whose path skipped a hand-over is a success for the customer and a gap in
  coverage, recorded as both.

**Per press** (the checks first, then each valid path and what it covers):

**rq-canary**
- *Checks*: `/visit`'s first heading reads *Come and see us*, that text only.
- *Valid paths*: the text rung or the look door, one part either way. No
  coverage is claimed beyond request mode itself.
- *Not a success*: the router asking a question (no request opens; the press
  stops after its routing charge), or a part at another layer (stopped, §4.2).

**R1**
- *Checks*: the stored description names Saturday, bread-making and classes,
  and the home page serves it; one new page about the classes, at whatever
  address the add-on chooses, stored and served 200; every menu that had items
  gains *Classes* → that page and keeps its own; nothing else changed; no part
  started before a part it needs.
- *Valid paths*:
  - three parts — the description (look), the menu link (nav, or look through
    its menu lane) waiting for the page, the page (add-on): covers Edit and
    Add-on, several parts, and **the prerequisite named later**;
  - two parts — the look door makes the description and the link, waiting for
    the page: covers the same;
  - the add-on makes the page and hands the link on as an addition after it,
    the description apart: covers Edit and Add-on and several parts; nothing
    waited, so the prerequisite is **not covered**;
  - the router sends the page ask to the page rung, which hands it to the
    add-on: the same outcome, with one hand-over more.
- *Not a success*: a router question; the description or the link left for a
  later message; any page but the new one changed.

**R2**
- *Checks*: one new page about wholesale, stored and served 200; every menu
  gains *Wholesale* → it; `loaves` id 5 6 → 6.2, shown *£6.20* on `/order`, on
  both readers, and nothing else in the table; nothing else changed — **no new
  table**.
- *Valid paths*:
  - two router parts, the add-on's and the price's; the add-on step sets the
    menu link aside as a part of its own, in its own words, run by the menu
    editor after the page: covers Add-on then Edit, several parts, and **the
    set-aside**;
  - three router parts — page, link, price — the link waiting for the page: the
    same site; the set-aside is **not covered** (recorded as a finding, not a
    pass of the set-aside).
- *Not a success*: the add-on reading "order loaves in bulk" as an order form
  with a new table — the canary fails the press on it, and whether that outcome
  is acceptable is yours to judge (§4.3); the price not changed.

**R3**
- *Checks*, after both messages: `/visit`'s second heading reads *Our shop on
  the street*; every footer keeps its Instagram link and gains one link to
  `facebook.com/harbourloafbristol`; after the first message, one part waiting
  on its question with nothing else running.
- *Valid paths*:
  - the heading part runs; the Facebook part's step asks for the address; the
    answer resumes that part: covers **the step's question**, **the answer
    resuming it**, and several parts;
  - the router asks for the address first, with no request opened; the answer
    is routed whole and opens the request: the same site; neither the step's
    question nor the resume is covered.
- *Not a success*: a step guessing an address — the request ends without the
  question, the answer is not sent, and the footer link check fails.

**R4**
- *Checks*: the home heading reads *Fed every morning since 2019*; the file
  rode the routing call byte for byte; every header draws
  `/u/fold-lane-bakery/38d29a0457eedf0f9778d4a9f4104d27.png`, and the bytes
  served there are the file's.
- *Valid paths*:
  - the heading first, the logo part later reading the request's file: covers
    **a file read by a later part**;
  - the logo part first: the same site; the later-part hand-over is not
    covered.
- *Not a success*: the logo routed to the picture step (not allowed, §4.2).

**R5**
- *Checks*: `/order` gains a line stating that orders close at 8pm (any
  spelling of the time) the night before, undenied, and loses nothing;
  `/gallery`'s second heading reads *Photographs from the bakery*; the request
  ended while no page was open, nothing read its route meanwhile, and the tab
  opened afterwards showed it ended with every reply.
- *Valid paths*:
  - two parts, the line by the add-on and the heading by the text rung or the
    look door: covers several parts and **the closed tab**;
  - one look part making both: the same site; several parts not covered.
- *Not a success*: the request not ending inside its bound; the line on
  another page.

**If a press does not pass**, it is reported with its evidence and not run
again without your word. If the request flow itself misbehaves (parts out of
order, a part run twice, money that does not close), the batch stops there and
**the switch goes off by §8** while the evidence is read.

### 4.2 What is enforced, and when

The earlier plan listed things "never allowed" in any press. That overstated
it. The canary enforces some restrictions **before anything reaches the
server**; for others it only **detects afterward**, by reading the request and
sending its Stop; and some it **does not see at all** until the after-read.

| Restriction | How | Before the server runs it? | With the tab closed (R5) | If it slips |
|---|---|---|---|---|
| No build or revise started by the page | the browser's wall aborts `react-build`, `build` and `react-revise` | **Yes, refused before it leaves** | no page is open to start one, and the server starts no build for a request part except through the go-ahead | — |
| No full rewrite | the go-ahead's POST is aborted in the browser; the server runs the rewrite only after that go-ahead | **Yes**: the rewrite cannot start | no page is open to press it | a part left waiting for it is detected and the request stopped, so it does not wait a day |
| No edit or add-on posted by the page itself | the browser's wall (`request: true`) | **Yes, refused before it leaves** | no page is open | the press stops: the switch is not live |
| The deploy and the image are the expected ones | the paid press's preflight, before the first message | **Yes**: nothing is sent otherwise | the same | — |
| A part runs only at a layer the press lists, and the add-on only where it is opened | the canary reads the request and, on a part routed elsewhere, sends the request's own Stop | **No — detected afterward.** The server files a part's job before the canary can see where it went (part 0's job is filed before the routing answer reaches the page). The Stop starts nothing new and asks the part's job to cancel: the job is refused at its publish gate and refunded, and a part already publishing completes. A job stopped while still queued makes its model calls first (refunded). Whether a step that writes rows or rules without publishing pages is refused before its write is not shown here, so such a step is taken as able to complete. **A fast part can finish first** (a rules change, or a page removal, which is free) | read every **20 s** through the requests list, and stopped by the canary's own Stop, so the window is wider than with the tab open (3 s) | the after-read reports what changed; a page change can be put back from the saved version for free, on your word |
| What an allowed step decides inside its own route | nothing at the wall: R1 and R2 allow the page rung, which can rewrite, remove or rename a page; R1, R2, R3 and R5 open the add-on, which can add a table or buy a photograph | **No, and not detected by the wall at all**: the route is one the press allows | the same | **seen only in the after-read** (the stored pages, the served pages, the owner's table listing) and in the job's reply and cost; reported as a change beyond the named ones |
| A press's spend | its budget, checked before each message (R3 has two) | **No**: never while a request runs | the same | §7 |
| The batch's 100 | my reading of the ledger between presses | **Not enforced by anything**; a threshold | the same | §7 |

So: rules, photographs, new tables, and removing, moving or renaming a page
are **not prevented**. Rules changes are outside every press's layers and
would be stopped once seen; the page rung's moves (in R1 and R2) and the
add-on's tables and photographs (where it is open) are not even seen until
the after-read. None of the six messages asks for any of them.

### 4.3 Residual risks, and the restriction question

**No concrete restriction is required to run the batch**, by your demo-site
rule: anything a press changes by mistake is recorded by the after-read, the
stored pages can be put back from their saved versions for free, and nothing
in the batch can start the full rewrite or a build. What can still happen,
none of it likely, each with its bound:
1. **R2 may get an order form and a new table.** The add-on's own instructions
   read "a booking page" as a page and a table, and "cafés that want to order
   loaves in bulk" can be read the same way. The canary fails the press on it
   (*the site's tables are as they were*); the table and the form stay unless
   you ask. If you would rather not risk that path, the message could ask for
   *"a Wholesale page telling cafés how to order loaves in bulk"* — yours to
   choose; I have not changed it.
2. **A part routed outside a press's layers can finish before the Stop**
   (most likely a fast one, or one that writes rows or rules without
   publishing pages). The after-read shows it; a page change can be put back
   for free; anything else is reported for your decision.
3. **A photograph bought by the add-on** (about 18.75 credits each) — only if
   its picker names one, which none of the messages asks for.

Preventing 2 or 3 rather than detecting them would need the product itself to
refuse a part's route before filing its job — a product change, outside this
freeze, and the broad control you asked me not to add. I do not propose it for
this batch.

## 5. How the charges are verified

**For every press, three readings must agree.**
1. **The canary's money check** (`moneyVerdict`), automatic: the balance before
   less the balance after equals the routing calls' own stated costs (R3's
   answer included) plus each of the request's jobs' ledger debits less
   refunds — its routing jobs, its steps, its hand-overs, each read once even
   when two messages belong to one request; each job's row cost equals its
   debits; a job exempt or never reserved has no ledger row.
2. **My read of the ledger after the press** (free; non-secret columns of
   `credit_events` and `edit_jobs`), every new row by id: the message's
   routing charge once (`route:<slug>:<key>`); each later part's routing job
   once (`<job>#1`); each step's reserves (`<job>#n`) and refunds (the bare job
   id); no reference twice; the sum equal to the balance's move.
3. **The replies**: any charge a reply states matches the rows.

**Expected shape**: one routing charge per message; one routing reserve per
later part; each step's own charge; R3's answer adds one routing call and the
resumed step's work, nothing for the part already done; a step that asks
charges nothing for the edit (as built, not yet measured live); R4's logo step
is exempt.

## 6. How the model-written replies are verified

`MODEL_REPLIES` is **on** in the proposed configuration (its default).

**Checked by the canary**, for every part: its job's stored answer carries the
model's reply (`replySource: "model"`), and that text is on screen in the
browser; a step's question is on screen on its card; the request's own reply,
when it has one, is read the same way. A reply composed because the model's
could not be had **fails the reply check** and is recorded as composed, never
passed as the model's.

**Read by me against the request's own facts** (parts and statuses, each job's
changes, the before and after, the ledger), pass or fail per reply, quoting it:
1. **Done**: says what was done, each change with its page or list, and only
   what the operations did.
2. **Not done**: says plainly what was not done and why.
3. **Waiting**: R3's question asks for the one missing detail, and nothing the
   message gave.
4. **Money**: any charge stated is the one the rows show.
5. **No internals**: no layer, lane or job names, no ids, no status codes.
6. **Natural**: reads as a person would say it, not a template.

All the parts done means no request-level reply, so the expected replies are
one per part. **Not charged**: each reply is a quick-model call billed to us,
about a third to half a credit of model cost; the batch makes about 12–14.

## 7. Cost, the threshold and the possible overrun

**Measured references**: routing 1–3 a message, about 1.3 on average (runs
90–92); a text, data or menu step about 1; a look-door step 2–4 (run 66); a
line added by the add-on 7 (run 92); a page added by the add-on 2–13 (runs
47–51), taken here as 5–15; the page rung 6–22 (runs 21–37); the logo step
exempt; an add-on that rewrote every page for a new page 28, once
(`docs/addon-path.md`); a photograph about 18.75 (`IMAGE_USD / CREDIT_USD`).

| Press | Estimate | Likely | Beyond the estimate if… |
|---|---|---|---|
| rq-canary | 2–5 | 2.3 | a part runs at a layer it should not before the Stop reaches it |
| R1 | 9–24 | 14 | the add-on rewrites every page for the new one (28 once), the page rung runs before handing over (6–22), or a photograph is bought (≈18.75) |
| R2 | 10–25 | 14 | the same, or a table and form are added (§4.3) |
| R3 (two messages) | 4–12 | 6 | the question is asked again |
| R4 | 3–7 | 3.6 | little: the logo step is exempt |
| R5 | 8–17 | 11 | the add-on rewrites the page, or a photograph is bought |
| **The six presses** | **36–90** | **about 50** | |
| RW, separately (§9) | 12–50 if its go-ahead is pressed; about 2 if not | | a revise measured once at 17; first builds 11–45 |

**The threshold of 100 is a check between presses, not a ceiling.**
- **Before each press** I read the ledger and press only if the batch's spend
  so far plus that press's upper estimate is at most 100. If not, I stop and
  come back to you.
- **While a press runs, nothing caps it.** Its budget is checked before each
  message and never after a message is sent: the request's parts run on the
  server, and the product enforces no per-request cap (`edit_reserve` refuses
  only above 100,000). The one hard bound is the balance: a reserve the balance
  cannot cover is refused.
- **So the batch can pass 100** only when a press costs more than its upper
  estimate after the rule above let it start, and **by that excess**. With
  every press at its upper estimate the batch spends 90. The plausible worst
  single press is its upper estimate plus 28 (an add-on rewriting every page)
  plus about 18.75 per photograph: for R2, about 25 + 28 + 18.75 ≈ 72. After
  such a press the rule stops the batch at the next press that no longer fits.
- **The balance is 137** (read 2026-10-04 00:22 UTC); it is the only bound
  nothing can pass.
- **RW has its own threshold of 50** and runs only if at least 50 credits are
  left after the batch, which also clears the build path's floor of 20.

## 8. Stopping new requests while accepted work finishes, and rolling back

**To stop new requests**: set the GitHub secret `REQUEST_FLOW` to `off`;
Actions → *Deploy to Cloudflare* → *Run workflow* → `main`. It takes effect
when that run finishes: its drain waits for live job leases (up to 14
minutes), then deploys in about a minute; the image is reused.

**From then on a new message is not taken on as a request**, and the page
drives its steps as before. **Accepted requests finish**: the switch is read in
one place only, where the routing call accepts a message (`requestFlowOn` in
`worker.js`'s routing route), while each job's end, the two-minute sweep
(`runRequestSweep`, cron `*/2`) and the request's routes (follow, Stop, the
go-ahead) keep working with it off.

**Other switches**: one request — its card's *Stop the rest* ends whatever has
not started (a part already publishing completes); replies —
`MODEL_REPLIES` → `off` and redeploy the same way.

**Rolling the code back**: the range revert verified in Phase B, pushed to
`main`; the deploy reuses `8bfc67dc695e65cc`. **Turn the switch off first**,
and let accepted requests end (or Stop them): the old code neither moves a
request on nor sweeps it.

## 9. The full-rewrite test (RW), separately

**The message**: *We're changing what we do: turn this website from a bakery
shop into a booking tool for our Saturday bread-making classes.*

**Why this message**: a request reaches the full rewrite's go-ahead only when a
step finds a change only a rebuild can make; a change of the site's kind is the
one natural case (`picker/build`).

**No probe first** (your review): a probe's answer would not bind RW's own
answer anyway.

**How it runs, and the risk that comes with your own chat**:
- **In your own chat in the app**, as planned: you type the message; expected,
  one part routed `look`, waiting for your go-ahead, with the request's reply
  saying what the rewrite is, why and its measured cost; you press the go-ahead
  or *Stop the rest* (free).
- **Your own chat has no wall.** If the router answers `build` instead, no
  request opens and your page starts the full revise at once, on the old path:
  11–45 credits, and not a test of the go-ahead. The dropped probe could not
  have ruled that out either.
- **A walled way exists, not built**: a canary scenario that sends RW with
  builds refused in the browser, follows the request until a part waits for
  the go-ahead, records the go-ahead reply and its cost, and ends without
  pressing it or stopping it, leaving the decision to you in your own app. A
  `build` answer would then cost its routing call only. It is a small option of
  the kind already built (`until`), not a control system. Say if you want it
  before RW.
- **If pressed**: the existing queued build rebuilds the site as a booking
  tool; one rewrite under one id, charged once (`build:<id>:*`); the request
  ends `done`. I verify the ledger, the build's row, the request's statuses
  and every served page afterwards.

**Cost**: routing about 1.3, the step before the climb 0–2, the rebuild 11–45
(17 measured for a revise): **12–50 if pressed**, about 2 if it stops before.
Its own approval, its own threshold of 50, and only if 50 are left.
**Afterwards**: the bakery would no longer be a bakery. RW runs last; the
version before it is recorded so a free restore can put it back, and by your
demo rule it stays as it is unless you ask.

## 10. What this batch cannot show

- How often a message takes each path: each message is routed once per press,
  by one model, and each press is run once.
- A row set aside beside a page, and several devices following one request at
  once: shown with supplied answers only.
- Any site but the bakery, or any phrasing but these.
- The full rewrite's go-ahead, unless RW reaches it.
- A request on a site whose owner has edits unqueued (`EDIT_ASYNC` off for
  them): the switch then does nothing there, as built.

## 11. Decisions that are yours

1. **The plan as revised, and the threshold of 100 checked between presses**:
   the merge on your word, the runtime press, the switch, the canary, R1–R5.
2. **R2's wording** (§4.3): as it stands (a new table possible, and failed by
   the canary if it comes), or the version that asks only for a page.
3. **RW**: whether to run it after the batch, in your own chat (with the risk
   in §9) or through the walled scenario (to be built on your word first); and
   whether to restore the bakery afterwards (free).
4. **The demo changes stay**, by your rule, unless you say otherwise.

**Found while preparing, and kept separate** (`docs/backlog.md`):
- `REQUEST_FLOW` has no allowlist: on applies to every owner whose edits are
  queued. Today every live site belongs to the building account.
- The runtime read cannot show either new switch.
- A request part's question drawn from its step's reply is kept by the page
  without its request and part (the page's question reader keeps the id, the
  words and the answers); nothing a customer sees depends on it today. The
  canary matches a question by its id for this reason.

## Appendix A: the canary's request mode, as built

**What a press records**, per message (`ui.json`, and in words in `ui.txt`):
- the routing evidence: the router's answer to this message (intent, layer,
  page, cost), the parts held back and their order (`alsoAsked`, `dependsOn`),
  the decision's source and the model's own intent and layer, a resumed part
  for an answer, and each part's words, status and route as the request began
  and ended;
- every view of the request the canary read, each time the statuses changed
  (`trail`), which the job-order check reads;
- the question a message ended on, whose it was (a step's, matched by its id,
  or the router's own), and its words;
- for a closed-tab message: when the tab closed, each read of the requests list,
  when the request ended, any read of its own route meanwhile (there must be
  none), and what the tab opened afterwards showed;
- each part's job's stored answer as the page read it, and every reply on
  screen; the request's own reply with its source.

**The checks** (`requestBatchVerdict` in `scripts/canary-requests.mjs`):
- per message: one routing call carrying its words exactly; no edit or add-on
  posted by the page; taken on as a request; ended with every part done at an
  allowed route, nothing stopped by the wall — or, for a message that ends on a
  question, one part waiting on a step's question with nothing else running,
  or the router's own question with no request opened; a file on the routing
  call byte for byte; for a closed-tab message, ended while no page was open,
  no read of its route meanwhile, and the reopened tab showing it ended;
- per message: no part started before a part it needs (the order the routing
  answer gave, mapped onto the request's parts, checked against every view
  read; a message whose answer named no order passes and says so);
- the site: each named change (a heading's words only, the stored and served
  description, a new page found by what it says and served 200, a menu link to
  that page on every menu, a footer link to the exact profile beside the old
  ones, a line stating the words undenied, the logo by its own bytes, the row
  by both readers and the page that shows it), and everything not named as it
  was (every stored page byte for byte apart from the named places, no page
  gone, no page or component added beyond a new page's own, every page that was
  served still served 200, the description and the header logos unless named,
  the owner's table listing);
- the replies: each the model's own and on screen;
- the money (`moneyVerdict`).

**The coverage** (recorded, never a check): `edit-and-addon`,
`several-parts`, `waits-for-prerequisite`, `addon-sets-aside`,
`step-question`, `answer-resumes`, `file-to-later-part`, `closed-tab`.

## Appendix B: the scenarios (`scripts/canary-ui.mjs`)

**Every scenario**: site `fold-lane-bakery`; `request: true`; its budget is its
upper estimate, checked before each message; its messages' bounds together at
most 30 minutes, inside the workflow's 45; checked against its own before-read.

| Scenario | Budget | Edit layers | Add-on | Messages |
|---|---|---|---|---|
| `rq-canary` | 6 | text, look | shut | one, 12 min |
| `rq-1-classes` | 25 | look, text, nav, page | open | one, 25 min |
| `rq-2-wholesale` | 26 | data, nav, look, page | open | one, 25 min; the row checked from a fresh baseline and kept |
| `rq-3-facebook` | 13 | text, look, nav | open | 1. ends on the question, 14 min; 2. the answer, 14 min |
| `rq-4-logo` | 8 | text, look, logo | shut | one with `ui-logo-2.png` attached, 12 min |
| `rq-5-away` | 18 | text, look | open | one, the tab closed once taken on, 25 min |
| `rq-menu-link` | 10 | nav, look | open | one, 14 min; judged by `menuFinish`: every menu that lacked the link gained exactly it, each menu that had it as it was |

**Changed from the earlier plan**: the bounds are 25 minutes (not 30) for R1,
R2 and R5, and 14 + 14 (not 20 + 20) for R3, so a press's messages leave at
least a quarter of an hour of the workflow's 45 for its preflight and reads;
R2 also allows `look`, because the router may send the menu link through the
look door's menu lane, a path that reaches the same site.
