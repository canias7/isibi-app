# 2026-10-23 — decide-money-6: a credit floor at filing (audit A13-2, #126)

**The finding.** Queued edits and additions were filed with no balance read.
The job then made its model calls, the reserve was refused, the publish gate
withheld the result, and the platform paid for the calls.

**The owner's choice.** Refuse at filing when the balance is below **5 credits**,
for paid work only.

## What changed

- `builder/publish-pages.mjs`, next to `MIN_CREDITS`:
  - `FILING_FLOOR = 5` and `FILING_REFUSAL_MSG`.
  - `filingIsFree(...)`: free by rule are the logo step and a page removed or
    moved (`page` with `remove` or `rename`). A hand-over is not free, because
    the edit route drops a hand-over's page verbs. An addition is never free.
    At acceptance, parts held back (`alsoAsked`) make the work paid.
  - `filingFloorRefusal(...)`: returns the 402 body or `null`. A read that
    throws or returns something other than a finite number fails open and is
    logged (`filing floor: …`).
- `worker.js`, at three places where work is filed:
  1. **The edit route's queued fork** checks the floor before `enqueueEditJob`,
     using the caller's own `readCredits`.
  2. **The add-on route's queued fork** checks the floor before `addonAsRequest`
     and `enqueueEditJob`. The work is always paid.
  3. **The routing route's acceptance of a request** checks before
     `acceptRequest`. It reuses the route's own balance read (`rBal`), less
     this routing call's charge. If `rBal` was not read, the check fails open.
     An answer to a part's question (a resume) is not checked here.
- The refusal is status 402, with this body:
  `{ ok: false, error: "not enough credits", need: "credits", cost: 0, floor: 5, msg }`.
  Nothing is filed, no `edit_create` call is made, nothing is queued and no
  model is called. On the routing route, the router's own call has already
  happened and is charged as before.
- **Founders.** `get_credits` answers the founder sentinel (1,000,000), so a
  founder is never below the floor. The test fixture's `get_credits` now
  answers that sentinel for `founder`, as the live function does.
- **Free routes are not touched.** Publish, restore, discard and the platform
  rebuild do not file through these forks.
- `public/chat.js`: the routing reply's handler now shows a `need: "credits"`
  refusal with the server's sentence and puts the message back in the box.
  Before this change, a refusal there fell to `routeActionable` and was "lost".
  The edit and add-on routes' refusals already showed `msg` through
  `readRouteReply`'s `refusal` branch.

**Customer sentence:** "You're out of credits — top up to keep changing your site."
It is new UI text, so it needs a screenshot.

## Tests

`test/filing-floor.test.mjs` has 12 cases, all through the real Worker on
`fixtures/request-flow.mjs`:

- **Edit route.** Balance 1 is refused, with no row, no queue and no model.
  Balances 10 and 5 are filed. Removal, move and logo at balance 0 are filed. A
  hand-over carrying `remove` at 0 is refused. A founder at 0 is filed. A
  failed balance read files and logs.
- **Add-on route.** Balance 1 is refused, with nothing accepted and no model.
  Balance 10 is filed.
- **Request flow.** At balance 1 the router answers, then the message is refused
  with nothing accepted or filed and only the router's call made. Balance 10 is
  accepted. A page removal at balance 1 is accepted.

**Red check.** With `worker.js` and `publish-pages.mjs` taken from `a8fbfe876`,
5 cases fail: edit at balance 1, the hand-over, the failed read's log line,
the add-on at balance 1, and the request flow at balance 1.

**Sweep.** 5 mutants were run. All 5 were killed: the floor set to 1, logo
counted as paid, the hand-over check removed, the check failing closed, and the
add-on counted as free. The comment-only control survived. Each file was
restored from a saved copy.

**Affected files.** These are green: addon-queue, addon-row, credit-debit,
edit-job, edit-queue, publish-pages, refund-founder-guard, request-flow-page,
request-flow, undo-newer-work, site-busy and edit-canary (470 tests). The 15
files that read the route-reply code in chat.js are also green (683 tests).

`addon-queue`'s guard ("the edit route files under no explicit op") first
caught an `op: "edit"` in the new call. That call now leaves `op` out, so the
default applies.

## Known limits

These are kept separate, not fixed here:

- **A retry with the same key below the floor.** A retry of an edit or addition
  already filed under that key, sent after the job's reserve has taken the
  balance below 5, is answered with the refusal instead of the original receipt.
  The job filed first still runs. A retry on the routing route is not affected,
  because it is answered from the earlier acceptance before the check.
- **A resumed part is not checked.** An answer to a part's question files that
  part without the check. That part's reserve still applies.
- **The synchronous edit path is not checked.** It runs when async is off and
  has its own reserve. The finding is about queued filing.
