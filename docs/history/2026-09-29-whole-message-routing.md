# The router chooses one answer over the whole message (2026-09-29; on the branch, not merged, not deployed)

## The owner's request

Owner, 2026-09-29, after Test 8's paid run (run 63) and its free restore (run
64): *"Now address the routing defect as one focused change. Trace the
instructions that produced `nav + remove + alsoAsked` for a request the
existing look path could complete together. Resolve conflicting instructions
so the router considers the whole request before choosing a path or deferring
any operation. Implement the smallest universal correction on the working
branch. Preserve efficient routing for single changes and legitimate
deferrals for work that cannot run together. Keep deferred words excluded
from execution and each executable operation scoped to its own words and
page. Do not hardcode the bakery, page names, request wording, or force every
mixed request into look. Use the existing tests to check the affected routing
contract and execution boundaries. Clearly distinguish controlled execution
evidence from proof that a real model chooses the correct route. Keep
unrelated gaps separate. … No paid model calls, retries, merge, or deployment
yet."*

## What produced `nav` + `remove` + `alsoAsked` (the trace)

Run 63 sent *Take Gallery out of the menu. Then, on the Visit page only, put
the "Order a collection so we hold a loaf" band above "Come to the bakery".*
The router (grok-4.6) answered `layer: "nav"`, `remove: true`, with the Visit
move in `alsoAsked`. Every instruction it followed is in the router's tool
(`ASK_TOOL` in `builder/site-ask.mjs`), and they disagree about a message
whose changes are of different kinds:
- **The single-kind clauses name the first change's answer.** Under `nav`:
  "THE MENU — which items are in it, what order they come in, taking one
  out"; under `page`: "A MENU CHANGE IS "nav", NOT THIS AND NOT "addon""; and
  `remove`: "For layer "nav": true when a menu item … should GO". Each reads as
  the whole rule when a message leads with its kind.
- **The multi-change clause lives inside `look`'s own paragraph**: "SEVERAL
  CHANGES IN ONE MESSAGE ARE STILL ONE "look" ANSWER — the site's description
  and a band on the visit page, a section on one page and a section on
  another". Its examples are all `look`'s own kinds, and it sits before the
  menu clauses, so a message that opens with a menu item never meets it as a
  rule over the menu.
- **The hold-back rule is judged against the answer already chosen**:
  `alsoAsked` holds back "ONLY WHEN IT NEEDS SOMETHING YOUR ANSWER CANNOT DO
  THIS TURN", and spares a part `look` can reach only "when you answered
  "look"". Once the first change had chosen `nav`, the band move was
  something THAT answer could not do, so holding it back followed the letter
  of the rule.
- **Nothing told the router to read every change before choosing.** Yet `look`
  could make both: its menu lane (`action`, corrected in deploy 2168) takes an
  item out of the menu, and its layout lane moves a band on a named page. And
  the removal door that `nav` + `remove` opened carries other work too (the
  picker's `additional` list); the router is not told that, and this change
  does not add it (below).

## What changed (`builder/site-ask.mjs`, two strings and their comments)

- **A closing paragraph for the `layer` field**, its last words, the position
  this file has measured as a field's strongest (the `remove` field's closing
  line, the `intent` tie-break):
  *"ONE ANSWER FOR THE WHOLE MESSAGE, CHOSEN AFTER READING EVERY CHANGE THEY
  ASK FOR — NEVER FROM THE FIRST ONE ALONE. Each layer above is the answer when
  every change they ask for is its kind. When they ask for changes of
  different kinds and "look" can make all of them (what it reaches is listed
  under `alsoAsked`), answer "look" and hold nothing back: it makes each change
  where it belongs. Hold a change back only when no one answer can make it with
  the rest."*
- **`alsoAsked`'s exception no longer depends on the answer already chosen**:
  "never for a second part "look" can reach when you answered "look"" became
  *"never for a part "look" can make along with everything else they asked:
  then the answer is "look", whatever the first change was."*

**What it keeps.** A message whose changes are all one kind still gets that
kind's own layer, however many changes (a menu change alone is still `nav`, a
page deletion still `page` with `remove`). A mix `look` cannot make keeps its
answer and its hold: an addition beside a change, a change beside an
addition, a list's rows or a page's exact words beside a change of another
kind, a page deletion or an attached logo beside anything, and the footer's
details (no look-door lane reaches them, backlog). So not every mix goes to
`look`. The route is unchanged: a held-back part is still taken out before
anything runs (`heldBack`), and on the look door each change still runs with
its own words and page (`scopes`).

**What it does not do.** It names no site, page or request, and quotes no
customer sentence (a guard holds the closing paragraph to layer names only).
It does not tell the router that a removal answer carries other work: on that
door the router's own step reads the whole message (unchanged since deploy
2164), so steering a mix there would hand the menu editor words that are not
its own; `look` is the path where every change runs on its own words.

**The tool grew by 528 characters** (24,117 → 24,645 as JSON; the `layer`
description 10,520 → 10,980, `alsoAsked` 1,741 → 1,804). No size guard covers
the router's tool.

## Validation (measured)

**The evidence boundary.** Everything below proves what the router is TOLD
(its tool's text) and what the route DOES with each answer (supplied
answers, never a model). **Whether a real router now answers `look` for a mix
like run 63's is not measured**: only a live run after a merge and a deploy
can show it.

- **The guard** (`test/site-ask.test.mjs`, one case): the rule is the `layer`
  field's last paragraph; it is about the whole message and every change, and
  never the first alone; a single kind keeps its own layer; a mix `look` can
  make entirely is `look` with nothing held back; a change is held back only
  when no one answer can make it with the rest; everything it quotes is a
  layer's name (no worked example); `alsoAsked`'s exception holds whatever
  the first change was; and the legitimate holds (an addition beside a
  change, a change beside an addition, `data` or `text` beside another kind)
  and "A MENU CHANGE IS "nav"" are kept.
- **Red check**: on the uncorrected module, 1 of `site-ask.test.mjs`'s 110
  cases fails, the new guard; all 110 pass on the corrected one.
- **Mutation sweep**: from a green baseline (924 across the
  26 test files that read the router's module, the lanes and the
  doors), 12 mutants, all killed: the rule removed, moved to the head of the
  field, without its whole-message clause, without the single-kind clause,
  sending every mix to `look`, letting a `look` mix be split, without the
  hold-back limit, with a worked example added; `alsoAsked`'s exception
  reverted, its "whatever the first change was" dropped; a legitimate hold
  dropped; a menu change alone sent to `look` (2 failures: the guard and the
  menu clause's own). Both comment-only controls survived, and the module was
  restored byte for byte.
- **The routing contract and the execution boundaries, existing tests**:
  924 of 924 across those 26 files, among
  them the routing contract (`site-ask`, `removal-door`, `site-nav`,
  `site-contact`, `site-layout`, `site-page-look`, `site-focus`,
  `ask-router-display`), deferred words excluded from execution
  (`edit-op-scope`: a held-back part is taken out before anything runs, on the
  edit and add-on routes) and each operation on its own words and page
  (`edit-removal-door`, section 5: the look door's menu lane and a layout
  change, sync and queued).
- **Test 8's unchanged request through the real edit route, both answers
  supplied** (scratch, not committed), sync and queued alike:
  - **run 63's own answer** (`nav`, `remove`, the move in `alsoAsked`): the
    calls are the removal door's picker and the menu editor only; the
    held-back words reach no model call; the reply carries them as
    `deferred` and the screen reads run 63's two sentences; the stored files
    are exactly run 63's (`visit.tsx` the menu-only `ddd1fe39…`). The route
    did what that answer said, then and now;
  - **the answer the corrected rule asks for** (`look`, nothing held back):
    the picker, the page writer and the menu editor; the menu editor handed
    exactly "Take Gallery out of the menu", the page writer exactly the
    band's words on `visit.tsx`; layers `page` and `nav`, lanes `shape` and
    `action`, `pageOps` `/visit`; all five stored files equal Test 8's
    expected ones.
- **Full unit suite**: `8297 / 8297 / 0 / 0` locally (8,296 on `main` plus the
  one new case).
- **Required CI on `465efe11`**: `unit tests` run 36608607282 (job 109543954132) `completed` / `success`, `8297 / 8293 / 0 / 4` read from the job's log (CI skips the same four); `site build` run 36608607274 (job 109543955266) `completed` / `success`, every count read from its own step's log matching the recorded twelve (TAP 397, kit-typecheck 4, site-build 404, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14, site-runtime 47, and kit-render, kit-a11y, kit-effects and kit-paint `all passed`), with only the two expected `##[error]` annotations (the broken page compiled on purpose).
- **The image** (informational; nothing is merged or deployed):
  `builder/site-ask.mjs` is a container input (the lanes module imports it),
  so a merge would roll the image: `main` (`47dea9c0`) predicts
  `dd4f72842234135b`, deploy 2168's own, and `465efe11` predicts `ce8f51050098d883`
  (188 inputs, 158 paths).

## Limits, stated

- **No model was called.** The router's new answer for any message is a
  prediction from its instructions, not a measurement.
- **The removal door still reads the whole message for the router's own
  step** (unchanged since deploy 2164). The correction steers a mix `look` can
  make away from it; a removal answer given anyway still carries the rest as
  the picker's additional work.
- **A mix `look` cannot make keeps its hold**, which is the owner's rule for
  work that cannot run together; the footer's details are one such part
  (no look-door lane reaches them, backlog).
- **Kept separate** (backlog): a change a scoped answer leaves out is dropped
  without a word; the menu editor's other parts have no look-door lane; the
  reply names only the look (review #9).

