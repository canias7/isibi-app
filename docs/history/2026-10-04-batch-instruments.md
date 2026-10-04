# The request batch's instruments, built; the rollout plan revised (2026-10-04)

On the owner's review of the rollout plan, for review on
`claude/help-needed-ehlwlj`. **Free preparation only**: no merge, no deploy, no
switch, no paid call or model call, no container built. **The product is
frozen**: no file under `public/`, `builder/` or `worker.js` changed. The plan
is `docs/investigations/request-flow-rollout.md`; the round before is
`docs/history/2026-10-03-recovery-gaps.md`.

- Code: `dd632b96`.

## 1. The order

> Proceed with the free preparation only: fix the expired-date test fixtures
> using a controlled test clock, implement the planned canary options and
> scenarios, verify them with focused tests, and push with green CI. Keep
> product behavior frozen. Revise the rollout plan to capture routing evidence
> from the actual end-to-end requests instead of paying for seven separate
> preliminary routing probes; a prior model answer does not guarantee the next
> one. Record valid alternative execution paths accurately, distinguishing a
> successful user outcome from coverage of a particular internal handoff.
> Correct the spending language: the proposed 100-credit threshold is checked
> between requests and is not an enforced ceiling while a request runs; show
> the revised estimate and potential overrun clearly. Also correct "never
> allowed" claims where enforcement is only browser polling followed by Stop:
> identify which restrictions are enforced before server execution and which
> are merely detected afterward, including during the closed-tab test. Do not
> introduce a broad new control system; report any concrete restriction needed
> before running the batch. Keep the optional full rewrite separate,
> model-written replies enabled in the proposed test configuration, and demo
> changes as they are afterward. Save the final plan and handoff in the repo.
> No merge, deployment, switch activation, paid calls or container rebuild yet.

## 2. The expired-date tests, on a controlled clock

`test/addon-route.test.mjs` dated its one-time jobs `2026-10-03`. Once that
day ended in London (23:00 UTC), the add-on rightly refused them as
`past-date`, and three cases failed on `main` and the branch alike (unit CI
`9237 / 9230 / 3 / 4` on the plan's documents-only pushes).

**The fix**: the five one-time job cases run on a clock fixed at 2026-10-02
12:00 UTC (`JOB_CLOCK`, `t.mock.timers.enable({ apis: ["Date"], now })`), so
`new Date()` and `Date.now()` both read it and the job's date is always the
next day there. The add-on reads its "today" from `new Date()` in the job's own
time zone, so the controlled clock is what it sees.

**Verified both ways**: with the clock at 2026-10-02, all six related cases
pass; with it moved to 2026-10-04, exactly the three expired cases fail again.

## 3. The canary's request mode, as planned

`scripts/canary-ui.mjs` (the driver), `scripts/canary-requests.mjs` (new, the
verdict), and `scripts/edit-canary.mjs` (the wiring):
- **`request: true`**: the browser's wall refuses any edit or add-on the page
  itself would post (`wallRefusal`); a message not taken on as a request stops
  the press, having cost its routing call.
- **`until: "question"`**: a message ends once a part waits on a step's
  question, nothing else is about to run or running, every reply so far is on
  screen, and the page draws that question's card (`questionShown`). The next
  message is typed into the composer, which is how the page answers. The
  router's own question ends it too, with no request opened, recorded as the
  other path. A message whose request ends without the question sends no
  answer.
- **`away: true`**: once the page has drawn the request's card, the tab is
  closed. The request is then read only through `GET
  /api/site/requests/<slug>` (which only reads; checked in the Worker:
  `loadRequest` is a read) every 20 s, from the canary's own session
  (`requestsNow`); a part routed outside the walls is stopped with the
  request's own Stop from that session (`stopNow`). Any read of the request's
  own route by a page of the run's browser while the tab is closed is
  recorded (`context.on("request")`). Once it has ended, a new tab opens the
  site through the same steps as the first (`openWorkspace`) and must show
  the request closed with every reply.
- **`ms`**: a message's own bound (`stepBoundMs`), at most 30 minutes; a
  press's bounds together at most 30 (`UI_PRESS_MAX_MS`), so a press ends
  inside the workflow's 45 with its record written.
- **`addon: true`**: the add-on step beside the listed edit layers
  (`requestWall`, `requestVerdict`, `routeAllowed`).
- **The routing evidence of each message** (`routingEvidence`): the routing
  call's own answer to it — intent, layer, page, cost, the parts held back and
  their order (`alsoAsked`, `dependsOn`), the decision's source and the
  model's own intent and layer, a resumed part — and each part's words,
  status and route as the request began and ended.
- **Every view read is kept** when the statuses change (`trail`), for the
  job-order check.
- **A later message's jobs are only its own**: R3's answer names the
  request's jobs the first message did not, so none is read or charged twice.
- **The publishes in the order they were made** (`chainOrdered`), walked by
  their own parent links: a request runs its parts in the order their needs
  allow, not their numbers.
- **The inventory keeps each page's status**, which a new page is judged by.
- **The canary form's scenario box** names the six scenarios
  (`.github/workflows/edit-canary.yml`, help text only).

**The six scenarios** (Appendix B of the plan): `rq-canary`, `rq-1-classes`,
`rq-2-wholesale` (with the Walnut Levain row, kept, from a baseline taken just
before its message), `rq-3-facebook`, `rq-4-logo` (with the new
`test/fixtures/ui-logo-2.png`, a 240×240 green disc, 1,224 bytes, sha256
`38d29a04…9d1c0e`) and `rq-5-away`. Two changes from the plan as first
written: the bounds are 25 minutes for R1, R2 and R5 and 14 + 14 for R3, so a
press's messages leave at least a quarter of an hour of the workflow's 45; and
R2 also allows `look`, since the router may send the menu link through the
look door's menu lane.

## 4. The verdict: checks, replies, coverage

`requestBatchVerdict` (`scripts/canary-requests.mjs`):
- **checks**, which fail the press: per message, its request (one routing
  call with its words, nothing posted by the page, ended with every part done
  at an allowed route, nothing walled — or the question as above — a file on
  the routing call, the closed-tab conditions); no part started before a part
  it needs (`jobOrderVerdict`: the routing answer's order mapped onto the
  parts, checked against every view read); the site (each named change, and
  everything not named as it was: every stored page byte for byte apart from
  the named places, no page gone, no page or component added beyond a new
  page's own, every page served before still served 200, the description and
  the header logos unless named, the owner's table listing — the same tables,
  rules, columns and row counts);
- **replies**, which fail the press: each part's reply the model's own
  (`replySource: "model"`) and on screen; a question on screen; each job judged
  once, in the message that showed it;
- **coverage**, which never does: `edit-and-addon`, `several-parts`,
  `waits-for-prerequisite`, `addon-sets-aside`, `step-question`,
  `answer-resumes`, `file-to-later-part`, `closed-tab`, each covered or not
  with why.

`scripts/edit-canary.mjs` reads the owner's table listing before the browser
opens and after the after-read, hashes the logo's served bytes for R4, judges
the press inside the paid branch, closes its money, prints the coverage
without a check, and keeps the verdict in `ui.json` and `ui.txt`.

## 5. Found while building

- **The page keeps a step's question without its request.** A request part's
  question drawn from its step's own reply is read by `clarifyOf`, which keeps
  the id, the words and the answers and drops the request and part; only a
  question drawn from the request's card keeps them. The page needs them only
  for a question about files, which a step's reply never carries, so nothing a
  customer sees depends on it (backlog). **The canary's first question stop
  required them, and would never have fired in R3's press**: the message would
  have run to its bound and the answer never been sent. It now matches the
  question by its id, and checks the request and part only where the page
  notes them; a mutant restoring the old rule is killed by both the unit case
  and the end-to-end case.
- **An empty list of words to look for passed** (`[].every()`): both readers
  now refuse it.

## 6. Verification

- **Focused**: 38 cases in `test/canary-requests.test.mjs`:
  - the scenarios (the plan's words, carried by the plan, budgets, walls,
    bounds, the question followed by its answer, the tab closed only on the
    last message, the logo file and its bytes, R2's row);
  - the wall in request mode and the add-on door;
  - the question stop, both ways the page keeps a question;
  - the routing evidence, the publishes' order, a heading changed in one place
    only, times and denials, stems;
  - one message as a request, a question message, a closed-tab message;
  - the job order; the replies;
  - what landed, on the bakery's own stored pages (`test/fixtures/run47`)
    changed by the product's own writers (`applyNav`, `applyChromeList`):
    R1, R3, R5, R4, R2 and a one-heading press, each passing as written and
    failing on every wrong outcome tried;
  - coverage, never in the checks;
  - the driver end to end through a stand-in app: the switch not live, R3's
    question and answer (both ways the page keeps a question), no question,
    the router's question, R5's closed tab, a read of the request's route
    while away, a wall hit while away, a run with no list reader, a
    message's own bound;
  - the canary's wiring;
  - the readers that run inside the app, run in a VM against the page's own
    data shapes.
- **The existing canary suites**: unchanged in count and green; three source
  guards updated for the new one-line call's readers, the new Stop write and
  the new key in `ui.json`.
- **Red check**: the new tests cannot load on the old code (the module and its
  exports are new), so the sweep stands for it.
- **Sweep** (61 mutants, 3 comment-only controls, every file restored by hash):
  first 56 of 61, with five survivors, each answered — four test gaps (nothing
  read the request's route while away; the reopened tab's wait was never
  needed by the stand-in, which now shows one job's reply per look; no table
  changed its row count; the new page in the fixture had no header, so the
  logo filter for pages served before was never needed) and one equivalent
  mutant (a "nothing else running" term the next term implies), removed as
  dead code. Then after the four gaps were closed and the dead term removed, 60 of 61 on the second run; the last survivor (the reopened tab's wait) was killed once the stand-in followed a request only after the workspace opened, a few looks late, as a reopened page does; a third full run: **61 of 61, the 3 controls surviving**, every file restored by hash.
- **Full suite**: `9275 / 9275 / 0 / 0` locally (from `9237`: the 38 new cases).
- **CI on the push**: unit tests `9275 / 9271 / 0 / 4` on `141fd496` (run 37166044440), the local total exactly, CI skipping four as always; green again after the date fix. The site build was not started: no path it watches changed (no builder, Worker or container input); its last run on the branch, 37159581943, was green.

## 7. The plan, revised

`docs/investigations/request-flow-rollout.md`: no routing press (each press
records the router's answer to its own message); per press, the checks and
each valid path with what it covers; the cost as a threshold of 100 checked
between presses, **36–90** likely about 50, with the possible overrun (a press
past its estimate, by an add-on rewriting every page, 28 once, or a
photograph, about 18.75, bounded only by the balance of 137); what is
enforced before the server runs anything, what is detected afterward (every
3 s, every 20 s with the tab closed) and what only the after-read sees; no
concrete restriction required, with R2's wording offered as the owner's
choice; RW separate, with the risk of running it in the owner's own chat
named and a walled scenario offered, not built.

## 8. Not done

No merge, no deploy, no switch, no paid call or model call, no container
build. The image is unchanged by this round (scripts and tests are not
container inputs): `main` `8bfc67dc695e65cc` → the branch `882477e1bbbe8cbe`,
predicted, not built.
