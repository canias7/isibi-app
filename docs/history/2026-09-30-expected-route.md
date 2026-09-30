# 2026-09-30 — The canary enforces the route a paid press expects

## Why

Batch 1 (the checklist's *Batch 1*) claimed that group A's press would be
answered `page` + `remove` for `/gallery`, and group B's `data`, each with
nothing held back. The owner's review found that nothing enforced this.
`scripts/edit-canary.mjs` refused an answer only when it was not an edit or
named no layer, and then posted whatever the router said.

So a `nav` answer (run 63's shape), a different page, or a part held back
would still have bought an edit of another kind, to be judged afterwards
against expectations it never met. And `routing.json` was written only after
the watch, so a refusal kept no record of the answer it refused.

## What changed (on the branch, not merged)

- **`scripts/canary-route.mjs`** (new): `readExpectRoute`, `routeVerdict`,
  `expectSaid`, `mismatchSaid`.
  - The expectation is space-separated `key=value` over the router's own
    fields. `intent` and `layer` are checked against the router's own lists;
    `page` and `rename` are a path or `none`; `remove` and `tab` are
    `true`/`false`, absent reading as false the way the edit POST reads them;
    `alsoAsked=none` means nothing held back.
  - Only the named fields are judged.
  - Cannot-tell is a mismatch: a non-boolean flag or a non-string path is
    reported, never coerced.
- **`scripts/edit-canary.mjs`**:
  - The box is read before the sign-in. A malformed one, or one beside a
    read, a restore or a scenario, refuses with exit 2 at no cost.
  - The router's answer (and, when set, the expectation and its verdict) is
    written to `routing.json` the moment it arrives, and only there.
  - A mismatch is refused above the edit POST with exit 1, so the routing
    call is spent and nothing else is.
  - A match is posted exactly as it came, because the POST body never reads
    the expectation.
- **`.github/workflows/edit-canary.yml`**: the `expect_route` box, passed as
  `CANARY_EXPECT_ROUTE`. It is the form's 11th input. GitHub has allowed 25
  since its changelog of 2025-12-04, and `lane-sweep.yml`'s 11-input form has
  been dispatched four times since 2026-09-16, so `test/canary-ui.test.mjs`'s
  cap of ten was stale and is now 25.

## Verification

- **Tests**:
  - `test/canary-route.test.mjs`, 5 cases. The verdict is judged on the
    Worker's own `/api/site/route` replies to supplied router answers: A's
    removal, run 63's `nav` answer, a gallery edit without a removal, another
    page removed, a move, a part held back, the add-on step, B's data answer,
    data with a part held back, text and look.
  - 4 source-order guards in `test/edit-canary.test.mjs`.
- **Red check on `da24ce1b`**: the new file fails, and 3 of the 4 new guards
  fail. The fourth guards the pass-through and passes on both trees.
- **The real script under an in-process network stub** (scratch, not
  committed; `fetch` and `https.request` replaced, so nothing leaves the
  machine), with router answers taken from the Worker's own route. There were
  11 scenarios:
  - every mismatch wrote `routing.json` with its verdict, exited 1, and never
    reached the edit POST;
  - every match posted a body identical to the same answer's run with no
    expectation, apart from the random retry key;
  - a malformed box and a box beside a restore exited 2 with no network call;
  - a free run routed nothing.

  On `da24ce1b` the same stub showed the defect: every mismatch, and even the
  malformed box, reached the edit POST.
- **Mutation sweep** (`scripts/mutants/canary-expect-route.json`): 29 mutants
  and 2 comment-only controls.
  - The first pass killed 28. The survivor was real: an unknown key whose value
    was a path or `none` would have passed, because the test's `colour=red`
    was refused only by the later path check.
  - After the test was tightened, the second pass killed 29 of 29, and both
    controls survived.
- **Full suite**: `8306 / 8306 / 0 / 0` locally (8,297 plus the 9 new cases).

## What it does not do

- It enforces what the router answered, not what the edit then does; the
  acceptance items still judge the operations.
- A refused press says which route the router chose, and nothing about the
  edit path, which never ran.
- It caps no charge. The routing call is spent either way, and the rung that
  runs charges what it charges.
