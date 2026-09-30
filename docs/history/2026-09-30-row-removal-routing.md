# A stored row taken off its list is routed to `data` (2026-09-30; on the branch, required CI green, not merged)

## The owner's request

Owner, 2026-09-30, after crediting deploy 2171: *"Before the paid
row-deletion test, fix the specific router instruction conflict you found:
Removing an existing stored database row must reach the data route. Preserve
whole-page deletion and existing handling of other removals. Preserve the
whole-message rule based on what each route can execute across its targets.
Do not decide or change add-row routing, reordering, or the other pending
product decisions. Use a universal rule, with no fixture names or keyword
shortcuts. Make the smallest change on the designated branch. Add focused
regression coverage, demonstrate the regression against the old wording, run
targeted mutation checks and required CI. Clearly distinguish
instruction/execution evidence from a real model's route choice. Push for
review; do not merge or deploy yet."*

## The conflict (found while preparing Lane 4's delete)

The router's tool (`ASK_TOOL` in `builder/site-ask.mjs`) gave "take that
entry off the list" two answers:
- **`look`'s removal clause** claimed every removal: *"TAKING SOMETHING OFF
  THE SITE IS THIS LAYER, whatever the something is"*, with *"THE ONE
  EXCEPTION IS A WHOLE PAGE"*;
- **`data`'s clause** claimed *"one row of something the site lists"*;
- **`look`'s reach under `alsoAsked`**, which the closing whole-message rule
  reads (*"what it reaches is listed under `alsoAsked`"*), ended on *"taking
  something off"* with no exception.

What each route can execute decides which claim is right. On the look door
no lane deletes a row: `backend` dispatches to the rules rung, which changes
who may read or add, and no lane dispatches to `data`. The data step deletes a
row itself (the row's `remove`, `DATA_TOOL`, since 1a).

## The change: three strings, nothing else

`builder/site-ask.mjs`, three strings and their comments:
1. **The `data` clause** gains a second line: *"TAKING AN EXISTING ROW OFF ONE
   OF THOSE LISTS IS THIS LAYER TOO: when an entry the site stores should no
   longer be there, its row is deleted from the table that holds it, and every
   page showing that list stops showing it."*
2. **`look`'s removal clause** now has two exceptions, both before the
   sentence that gives `look` everything else:
   - *"THE FIRST EXCEPTION IS A WHOLE PAGE."* The page sentence is unchanged:
     `page` with `remove`, *"a page is deleted there and nowhere else"*;
   - *"THE SECOND IS A ROW THE SITE STORES. An existing entry taken off one of
     the lists kept in the tables named above is layer "data" — its row is
     deleted there and nowhere else."*;
   - then, on its own line as before, *"Taking a SECTION, a picture, a band
     or anything else OFF a page that stays is this layer."*
3. **`look`'s reach under `alsoAsked`**: *"taking something off (but not a row
   the site stores: that is "data")"*.

The tool grew by 452 characters (24,827 → 25,279 as JSON; the `layer`
description 11,128 → 11,526, `alsoAsked` 1,842 → 1,890).

**Unchanged, compared field by field against the old tool**: `intent`,
`page`, `remove`, `rename`, `tab`, `answer` and `question`, the tool's name
and description, the required list, and the `layer` field's closing
whole-message paragraph. The route and the executors are untouched.

**What it does not decide.** Nothing new mentions adding a row or the order of
a list, so 2a and 2b stay open. The rule names the tables only as the digest's
*"tables named above"*: no site, table, page or customer sentence.

## Validation (measured)

**The evidence boundary.** Everything below proves what the router is TOLD
(its tool, and the request the real routing route sends) and what the route
DOES with an answer (supplied, never a model). **Whether a real router now
answers `data` for a row taken off a list is not measured**: only a live
press after a merge and a deploy can show it.

- **The regression file** (`test/router-row-removal.test.mjs`, 9 cases):
  - **the wording** (5): the `data` clause claims taking an existing row off
    and says the row is deleted from its table on every page showing the list;
    `look`'s claim and examples are kept, the whole page is the first
    exception (still `page` with `remove`), the stored row the second (`data`),
    and both come before "anything else"; `look`'s reach names no stored row,
    the closing rule is still the field's last line and says nothing about
    rows, and a `data` change beside another kind is still a hold; the new
    sentences quote only layer names and name no fixture; nothing new says
    how a row is added or ordered, `data` stays off the `remove` field;
  - **through the real `POST /api/site/route`** (3), the router's answer
    supplied: the request as it leaves carries the three new sentences and
    names the site's tables (*"Its database tables are: …"*); an
    `{intent: "edit", layer: "data"}` answer goes on as a data edit with no
    removal flag and nothing held back, and the prepared press's route check
    (`intent=edit layer=data alsoAsked=none`) would post it; a `look` answer
    for the same message is refused by that check before anything is posted;
  - **controls** (1): a whole page keeps its `remove` flag, and `picture`,
    `nav` and `logo` removals keep theirs.
- **`test/removal-door.test.mjs`**: its whole-page guard read the old
  sentence (*"THE ONE EXCEPTION IS A WHOLE PAGE"*); it now reads the property:
  a whole page is excepted and goes to `page` with `remove` and nowhere else.
  It passes on the old wording and the new.
- **Red check** (the two test files over the old `builder/site-ask.mjs`, blob
  `c062a685`, in a throwaway worktree): exactly the 6 wording and request
  cases failed; the 3 supplied-answer route cases and the removal-door file's
  10 cases passed (13 of 19).
- **Mutation sweep** (`scripts/mutants/router-row-removal.json`, its own
  worktree at `4e3ef512`, over the regression file, `removal-door` and
  `site-ask`, a green baseline of 129): 16 of 16 killed, both comment-only
  controls survived, the module restored byte for byte. The mutants:
  - the data sentence dropped, widened to any row, or made to claim adding;
  - the stored-row exception dropped, sent to `look` or to `page`, said
    after "anything else", or given a fixture's table or a quoted sentence;
  - the whole page made "the one exception" again, or stripped of `remove`;
  - `look`'s reach claiming every removal again, or sending the row to `page`;
  - the data sentence speaking about order;
  - the whole-message rule reworded about rows;
  - the `remove` flag asked of `data` answers.
- **Existing router tests**: every test file that reads the router's module,
  the lanes or the routing route (62 files) and 1a's
  `data-remove-wording`: 2,351 of 2,351.
- **Execution of a data deletion** is 1a's, unchanged: the edit route with a
  supplied `remove` answer deletes exactly the named row, one bound
  `DELETE`, behind the targeting protections
  (`test/data-remove-wording.test.mjs`).
- **Full unit suite on `4e3ef512`**: `8360 / 8360 / 0 / 0` locally (8,351
  plus the 9 new cases).
- **Required CI on `4e3ef512`**: `unit tests` run 36677496812 (job
  109765534992) `completed` / `success`, `8360 / 8356 / 0 / 4` read from the
  job's log (CI skips the same four); `site build` run 36677496840 (job
  109765534709) `completed` / `success`, every count read from its own
  step's log matching the recorded twelve (TAP 397, kit-typecheck 4,
  site-build 404, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47, and kit-render, kit-a11y, kit-effects
  and kit-paint `all passed`), with only the two expected `##[error]`
  annotations. The records commit `c5088b0c` (documents only) ran `unit
  tests` 36677675342, `completed` / `success`.
- **The image** (informational; nothing is merged): `builder/site-ask.mjs` is
  a container input, so a merge would roll `cdb624837e099719` →
  `e71f7bae88b9ecf1` (188 inputs, 158 distinct paths).

## Limits, stated

- **No model was called.** The real router's answer for a row taken off a
  list is a prediction from its instructions, not a measurement.
- **A mixed message** (a row taken off beside a change of another kind) is
  decided by the unchanged closing rule and `alsoAsked`'s hold for a `data`
  change beside another kind: one part goes this turn, the other is held
  back. Shown only in the instructions.
- **The look door still has no lane for a row.** A `look` answer given anyway
  still meets the lane picker, where nothing deletes a row; that is unchanged
  here, and the prepared press's route check refuses such an answer before
  anything is posted.
- **Kept separate**: add-row routing (2a), ordering (2b) and the other Lane 2
  decisions.
