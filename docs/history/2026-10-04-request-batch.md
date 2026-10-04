# The request batch, pressed (2026-10-04)

The owner's presses of the request batch on `fold-lane-bakery`, in the order
of `docs/investigations/request-flow-rollout.md` (Phases D and E), each judged
by `scripts/canary-requests.mjs`: checks and replies fail a press, coverage
never does. Deploy 2181 (`f69c873c`, image `882477e1bbbe8cbe`) runs the code;
deploy 2182 set `REQUEST_FLOW` from a secret
(`docs/history/2026-10-04-deploy-2181.md` §11).

**The spend so far: 4** (the threshold of 100 is checked between presses).

## 1. `rq-canary` — run 94: passed, so the switch is live

**Run 94** (37170558577), pressed by the owner from `main` at `f69c873c`,
2026-10-04 02:16:38–02:20:42 UTC, spend `yes`, the scenario `rq-canary` on
`fold-lane-bakery`, with the deploy and image boxes filled.
- **The preflight**: `ALL FREE CHECKS PASSED` (the Worker `f69c873c…`, a
  cold container `882477e1bbbe8cbe`, the zero-cost job settled `empty` at
  cost 0); balance 137.
- **The message**, typed into the real app: *On the Visit page, change the
  heading 'Come to the bakery' to 'Come and see us'.*
- **The routing call's own answer**: `{"intent":"edit","layer":"text","cost":3}`,
  the model's own (`edit/text`), nothing held back, no file attached.
- **The request**: `03e480007a6f9a1416b6e42b813ce6cf`, taken on and ended
  `done`: one part, `0:done@text`, its job `82e2a76cfcb0d8dbc1e86bc162693c61`
  (created 02:18:04, published 02:20:08, `done` at 02:20:13; billing
  `finalized`, cost 1). **The page posted no edit of its own**: the server ran
  the part. So `REQUEST_FLOW` is live.
- **The reply**, on screen in the same tab after 153 s, the model's own:
  *✅ On the Visit page, the heading now reads "Come and see us".* The
  composer was usable again. No console or page error.
- **What landed**: one publish, `01791080294555-wsl8c9` from
  `01790923788063-bp9rcv`, the chain verified. `/visit` now reads *Come and
  see us* | *The shutters and the street* | *Order a collection so we hold a
  loaf*. The other four pages kept their headings.
- **Every check `ok`** (19 checks and 2 reply checks), among them:
  - one routing call with the words exactly;
  - nothing walled; the order kept;
  - every stored page byte for byte as it was apart from the named heading;
  - every component as it was; no page or component added or removed;
  - every page served before still `200`;
  - the description and the header logos as they were;
  - the tables as they were.
- **The money closes**: routing 3 + the job's 1 = 4, 137 → 133. Ledger rows
  356 (`route`, −3, ref `route:fold-lane-bakery:03e48000…`, the request's
  key) and 357 (`edit` `reserve`, −1, ref `82e2a76c…#1`). Read at 02:23:19
  UTC: balance 133, last row 357, no job open, no live lease.
- **Coverage**: none listed for this press, by design (it covers no
  hand-over).
- `UI MODE PASSED: 1 message sent`. The demo change stays (the owner's rule).

**Next: R1–R5**, now in one press (§2). Before it: spent 4, and at their upper
estimates the five reach 89, within 100.

## 2. One press for R1–R5, built (on the owner's word)

The owner asked whether all five could run at once. They cannot run at the
same time: all five change the same site, each press judges the site and the
balance as its own, and the check between presses is the batch's only brake.
They can run in one press, one after another. The owner: *"yeah do that
better"*.

- **`rq-batch`** (`scripts/canary-batch.mjs`): the scenario box's name, which
  the canary hands on before anything is signed in.
  - It runs `scripts/edit-canary.mjs` once per press, in this order: R1
    `rq-1-classes`, R2 `rq-2-wholesale`, R3 `rq-3-facebook`, R4
    `rq-4-logo`, R5 `rq-5-away`.
  - Each press is the run the form would start for it: its own preflight,
    before-read, checks, money and evidence directory
    (`canary-evidence/<scenario>/`). It is not handed the batch's box.
  - Never two at once: the next starts only once the last has exited.
- **It stops itself**:
  - before a press whose upper estimate (24, 25, 12, 7 and 17, each its
    scenario's budget less one, the plan's §7) would take the batch's spend
    past 100. The batch's spend is the box's spend so far (4 after
    `rq-canary`) plus each press's measured spend;
  - after a press that fails (any non-zero exit, a killed one included);
  - after a press whose spend cannot be read off its own record.

  A stop at the threshold answers 0; a failure 1; a refusal 2, before
  anything. At their upper estimates all five fit: 4 + 24 + 25 + 12 + 7 + 17
  = 89. Only a press past its estimate can make the batch stop early.
- **The workflow**:
  - one new box, the batch's spend so far: refused blank beside `rq-batch`,
    and refused filled beside any other run;
  - `timeout-minutes` 180 for this mode alone (its worst case is 145
    minutes: every message at its bound and six minutes per press beyond);
    45 for every other run;
  - the scenario box names the mode. The canary step is unchanged.
- **Pressed from the branch** ("Use workflow from" `claude/help-needed-ehlwlj`):
  the mode is not on `main`, and needs no merge or deploy. The press checks
  the live Worker against its own deploy and image boxes.
- **Proven, free**:
  - 18 cases in `test/canary-batch.test.mjs`:
    - the order and the upper estimates, held to the scenarios' budgets and
      the plan's cost table;
    - the workflow's limit, box, environment line and help text;
    - the canary's hand-on, above the sign-in;
    - the box, fit and spend readers, with cannot-tell never read as a value;
    - the batch driven through every stop: all five made, a failed press, a
      stop at the threshold (exactly 100 fitting), an unreadable spend, a
      rehearsal, and no overlap;
    - the whole batch refused before anything;
    - the real canary script end to end with a stand-in press: the five in
      order, one at a time, each with its own scenario and evidence and
      without the box; stopped after a failure, a missing record and a
      killed press, and before a press past 100; refused with 2.
  - The sweep: 37 mutants, all caught; the 3 comment-only controls survived;
    every file restored by hash.
  - The canary's suites, 422 of 422 across its files; one guard taught the
    new limit's form (`test/canary-requests.test.mjs`'s timeout reader).
  - The full suite: `9293 / 9293 / 0 / 0` locally, from 9,275 by the 18 new
    cases.
- **Nothing was spent building it**, and no product file changed.
