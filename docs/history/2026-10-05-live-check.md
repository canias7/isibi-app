# The response-order correction closed; the live check prepared (2026-10-05, on the branch)

The owner: *"The response-order correction at 80bba1f6 passes Codex review,
including independent reproductions of unchanged nonempty and empty
confirmations, reversed response order, concurrent additions and unavailable
later lookups. Close this correction in the handoff and stop expanding this
audit. Prepare one combined live Edit/Add-on verification covering correct
reply placement, preview refresh, updated page/table inventory and completion
with the tab closed, using existing passing evidence to avoid redundant
cases. Give the exact deployment workflow inputs, runtime checks, test
instruction and estimated credit cost together so we can authorize the next
stage in one go. Keep the current no-merge, no-deployment and no-paid-retest
hold until that authorization; first Build and RW remain outside scope."*

**On the branch only**: not merged, not deployed, no image built, nothing
pressed or spent.

## 1. Closed

**The response-order correction** (`80bba1f6`,
`2026-10-05-response-order.md`) **is closed by the owner**, on Codex's
review and its independent reproductions. With it the run of page
corrections since the placement fix (placement, watched refresh, reconcile,
the three answers, the order) is complete on the branch, and the audit is
not widened further.

## 2. The stage to authorize

`docs/investigations/live-check.md`: the merge and its one deploy (no
workflow inputs: the fast-forward push is the deploy), the readings after it,
the image window, the free runtime check, and one paid press, `lv-reopen`,
with every box spelled out, what passes, what it costs (about 17–27 credits,
an estimate) and what it does not show. It reuses R1–R5's live evidence
rather than repeating it.

## 3. The press, built (scripts and tests only)

- **`lv-reopen`** (`scripts/canary-ui.mjs`), on `fold-lane-bakery` in request
  mode: message 1, an edit and an add-on that makes a Bake List page with its
  own table, sent with its tab then closed; message 2, a heading, from the tab
  opened afterwards.
- **The driver**: a closed-tab message may now be followed by more. Once the
  tab opened afterwards has shown it ended, that tab is marked as the run's
  and every later message is held to it (the first tab's mark kept in
  `tabs`). Every other scenario runs as before.
- **What the canary reads now**, read only: the preview frame's address and
  the page's own lists of pages and tables before each send and once each is
  done; every address the frame loads, by tab; each message's place on its
  thread and the jobs its replies are marked with.
- **Its checks** (`liveChecks`, and the one-new-table expectation in
  `outcomeChecks`), only for a scenario that asks: placement, the preview's
  newer address and its load, and the table and page inventory through both
  routing calls and both of the page's lists. `docs/instruments.md` has them
  in full.
- **The workflow's scenario box** names it (its own test requires every
  scenario named), with a comment.

## 4. Tests and checks

`test/canary-requests.test.mjs`, 6 new cases, through the stand-in app the
request batch's tests drive (now with a preview frame, the page's own lists,
each reply marked with its job, and the routing call carrying the page's
tables):
- the scenario's shape: the plan's words, request mode, the add-on open, its
  walls, budget and time, the tab closed on the first message only;
- **end to end**: the first tab closed, the request ended with no page open,
  the reopened tab reconciling it (the preview `?v=0` → `?v=2`, the new page
  and table in its lists), the second message from that tab (`?v=3`), its
  routing call carrying every table; all 15 live checks pass, and the
  press's own verdict carries them, while a scenario that does not ask is
  judged as before;
- **the old page**, two ways: a request found done in the reopened tab not
  reconciled (5 checks fail by name: both preview checks, both lists, the
  second call's tables), and another request's reply drawn after a message
  (exactly the placement check fails);
- each live check failing alone on its own defect, read off a real record;
- the table expectation: one collect table with an email column passes; two
  new tables, a readable one, one without the column, or an old table
  changed each fail; a scenario that asks for none still fails on a new one.

Also changed: `test/canary-replies.test.mjs`'s line for other requests'
replies, whose wording changed ("judged by the live check alone").

- **A flaw found and fixed while testing**: the first version of "that tab's
  preview loaded the newer address" passed when the address had not moved,
  because the tab had loaded that same address when it opened. It now needs
  a newer address and a load of it; the old-page case holds it.
- **Mutation sweep**, from a green baseline of the request, reply and UI
  canary test files (160 tests): **22 of 22 killed**, all 3 comment-only
  controls surviving, both scripts restored and checked by hash. The first
  run killed 21: no case had the second routing answer leave the new table
  out while the page kept exactly what it read, so "the second answer's
  tables are not judged" survived. That case was added and the sweep run
  again whole. Each mutant put one defect in:
  - placement: another request's reply after a message, a message's own
    reply before it, or the earlier message's replies after the next, not
    judged;
  - the preview: an address that did not move passing as newer; loads looked
    for in the first tab only, or in any tab;
  - the inventory: the first answer's tables, the page's own pages or
    tables, the second call's tables, the second answer's tables, or the
    page's tables after it, not judged; the live checks left out of the
    press's verdict;
  - the new table: any number passing; its rules, its column, or the other
    tables not judged;
  - the driver: the reopened tab not made the run's; the view before the send
    or once done not kept; the preview's loads not recorded; the message's
    place on its thread not kept.
- **The full suite**: `9480 / 9480 / 0 / 0` locally, from 9,474 by the 6
  new cases. Unit CI `9480 / 9474 / 0 / 6` on `a245463f` (run 37300930331):
  the totals match, CI skipping its usual 4 and the 2 browser cases. The site
  build did not run: nothing it covers changed (its last run, green on
  `685a922c`, run 37282482599, covers the Worker as it still is).
- **The image**: unchanged. Scripts, tests, documents and the canary's
  workflow are not its inputs, so it is still `589e3e4e85a20066` (predicted;
  the three-answer round set it).

## 5. What is not shown

- **Live**: the press has not run; this is what the owner's authorization
  would run.
- **The real page in a real browser through this scenario**: the stand-in
  app models the page; the real page's refresh was shown in Chromium by the
  reconcile round's BROWSER 1 and 2, with supplied answers.
