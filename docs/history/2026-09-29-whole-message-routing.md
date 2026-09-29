# The router chooses one answer over the whole message, by what a route can make on every page (2026-09-29; merged and deployed in deploy 2170, runtime-confirmed by run 65)

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

> **This is the first wording (`465efe11`), superseded the same day.** The
> owner's review found it chose by the changes' kind; it now chooses by what
> a route can make on every page (*The owner's correction: by targets, never
> by kind*, below).

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

## The owner's correction: by targets, never by kind (the same day; `2771ed3f`)

Owner, 2026-09-29, before any merge: *"One correction before merging: the
new whole-message rule still chooses by operation kind without fully
accounting for target scope. "Each layer above is the answer when every
change they ask for is its kind" conflicts with the page route's one-page
limit. Two layout changes on different pages are the same kind, but that
route cannot execute both. The following clause sends only changes of
different kinds to look. Make the universal rule depend on whether a route
can execute the entire request across all its targets. Preserve a
specialized route when it can do everything requested. Otherwise, use look
when its existing scoped execution can complete everything, including
same-kind changes on different pages. Defer only work that cannot run
together. Reconcile the older multi-page routing instructions with that
rule. Keep the correction small; do not hardcode examples, force all mixed
requests into look, or redesign execution. Update the new guard so it no
longer enshrines "same kind" as sufficient. … Keep supplied-answer evidence
separate from real-model routing proof. Report the revised wording and
focused validation. Keep Test 8's request and acceptance unchanged. No paid
calls, retries, merge, or deployment yet."*

### What the first wording got wrong

For two layout changes on two different pages, the tool said different
things in different places:
- **the first wording's closing rule**: both changes are `page`'s kind, so
  the answer is `page`, which "edits the single page you name and leaves the
  rest exactly as they are";
- **its next sentence** sent only changes *of different kinds* to `look`, so
  that pair was never sent there;
- **the `page` clause's older multi-page line** sent a change meant to land
  on several pages to `addon`, the add-on step: "Answer "addon" for those; it
  can touch the pages a visitor would look on". It was written before the
  frame's details were `nav`'s and before `look` placed each change on its own
  page;
- while **`look`'s own paragraph** says "a section on one page and a section
  on another" is one `look` answer, each placed where it belongs (its scoped
  page steps, deploy 2166), and **the `page` field** says to leave the page
  out when the changes are on more than one page.

The first wording's `alsoAsked` exception also named `look` as the answer
("then the answer is "look""). That would have taken a mix away from a
specialized layer that can make all of it: a menu change and the header's
button are both `nav`'s, and `look` reaches both through the menu editor's
lane.

### What changed (three strings in `builder/site-ask.mjs`, with their comments; the route is unchanged)

1. **The `layer` field's closing paragraph now chooses by what a route can
   make on every page.** It is still the field's last words:
   *"ONE ANSWER FOR THE WHOLE MESSAGE, CHOSEN AFTER READING EVERY CHANGE THEY
   ASK FOR AND WHERE EACH ONE IS — NEVER FROM THE FIRST CHANGE ALONE. A layer
   other than "look" is the answer when it can make all of them, on every
   page each one is on. When none can, answer "look" if it can make them all
   (what it reaches is listed under `alsoAsked`), and hold nothing back: it
   makes each change on its own page, so changes on different pages are one
   "look" answer even when they are all of one kind. Hold a change back only
   when no one answer can make it with the rest."*
2. **The `page` clause's multi-page line is reconciled with it.** "Answer
   "addon" for those; it can touch the pages a visitor would look on." became
   *"The answer for those is whichever can make the change on every page it
   lands on, as the last paragraph of this field says."*
3. **`alsoAsked`'s exception names no answer of its own.** "never for a part
   "look" can make along with everything else they asked: then the answer is
   "look", whatever the first change was." became *"never for a part one
   answer can make along with everything else they asked: give that answer,
   whatever the first change was (the last paragraph of `layer` says
   which)."*

**How the tool now reads each case.** This is its text; no model was called:
- **one change, or several that one specialized layer can make on every page
  they are on** (a menu change alone, a menu change and the button, a page
  deletion, one page's layout): that layer, as before;
- **changes of one kind on different pages** (two layout changes on two
  pages): `page` cannot make both, so the answer is `look`, which runs one
  page step per page, each with only its own words;
- **a mix `look` can make** (Test 8's menu item and band): `look`, with
  nothing held back;
- **a mix no one answer can make**: its answer, with the rest held back, as
  before (*What it keeps*, above).

The other multi-page instructions already agreed and are unchanged:
- `look`'s own paragraph ("a section on one page and a section on another"
  is one `look` answer, with `page` left out);
- the `page` field (left out when the changes are on more than one page);
- `alsoAsked`'s head ("SEVERAL CHANGES ARE ONE TURN WHEN YOUR ANSWER CAN
  MAKE THEM ALL").

**Size.** The tool grew by 182 characters over the first wording and by 710
over `main`, measured as JSON:

| | `main` | first wording | now |
|---|---|---|---|
| the whole tool | 24,117 | 24,645 | 24,827 |
| the `layer` description | 10,520 | 10,980 | 11,128 |
| `alsoAsked` | 1,741 | 1,804 | 1,842 |

### Validation of the correction (measured)

**The evidence boundary is unchanged.** These checks prove what the router is
TOLD and what the route DOES with each answer (supplied answers). **Whether a
real router answers `look` for changes of one kind on different pages, or
for Test 8's mix, is not measured.**

- **The guard, revised.** It is the same case in `test/site-ask.test.mjs`;
  no case was added. The closing rule:
  - must not say "is its kind";
  - must read every change "AND WHERE EACH ONE IS";
  - must make a layer other than `look` the answer "when it can make all of
    them, on every page each one is on";
  - must answer `look` only "When none can", and say "changes on different
    pages are one "look" answer even when they are all of one kind".

  `alsoAsked` must not say "then the answer is "look"". The rest is as
  before: nothing held back from a `look` answer, the limit on holding back,
  layer names only, the legitimate holds, and "A MENU CHANGE IS "nav"".
- **The older multi-page case, revised.** In `test/site-apply.test.mjs`, "the
  rules say a multi-page change is NOT a page edit" now:
  - requires the reconciled line;
  - requires the rule that line points at to be the field's last paragraph;
  - refuses "Answer "addon" for those".
- **Red check.** On the first wording's module (`465efe11`) and on `main`'s
  (`47dea9c0`), 195 of `site-ask` and `site-apply`'s 197 cases pass, and
  exactly the two revised cases fail. All 197 pass on the correction.
- **Mutation sweep.** The baseline was green (924 across the 26
  router-related files). All 16 mutants were killed:
  - the closing rule removed, or moved to the field's head;
  - "where each one is" dropped;
  - one kind made enough again;
  - "on every page each one is on" dropped;
  - `look` only for different kinds;
  - changes of one kind on different pages no longer `look`;
  - every mix sent to `look`;
  - a `look` answer split across turns;
  - no limit on holding back;
  - a worked example added;
  - `alsoAsked` naming `look` as the answer again;
  - `alsoAsked`'s exception reverted to "when you answered look";
  - several pages sent to `addon` again;
  - a legitimate hold dropped;
  - a menu change alone no longer `nav`.

  The three comment-only controls survived. The module and both test files
  were restored byte for byte.
- **The routing contract and the execution boundaries, existing tests**: 924
  of 924 across the 26 files. By name, with supplied answers:
  - **`edit-op-scope.test.mjs`, 20 of 20.** Among them:
    - **the existing two-page case**, "changes to two different pages: each
      page's writer is shown its own page and handed its own words" (a
      `look` answer with no page: one page step per page, each with only its
      own words);
    - run 52 as the router really answered, sync and job;
    - the legitimate holds (an addition beside a look change and a look
      change beside an addition, neither run; held-back words that cannot be
      found, refused at no cost);
    - the single-change controls (a named page; the whole site);
    - the look door's menu-plus-layout, menu-alone and button-alone cases,
      sync and queued.
  - **`edit-removal-door.test.mjs`, 18 of 18**: run 47, THEN, menu plus
    layout on the removal door and its two controls, picture plus remove,
    and take it off.
- **Test 8's unchanged request, replayed on `2771ed3f`** (scratch, not
  committed), 2 of 2, sync and queued alike:
  - **run 63's answer** does exactly what run 63 did (the picker and the menu
    editor; the band deferred; `visit.tsx` the menu-only `ddd1fe39…`);
  - **the `look` answer** calls the picker, the page writer and the menu
    editor. The menu editor is handed exactly "Take Gallery out of the
    menu", and the page writer exactly the band's words on `visit.tsx`, which
    comes out as Test 8's expected `c67011db…`.
- **Full unit suite**: `8297 / 8297 / 0 / 0` locally, the same 8,297 (two
  cases revised, none added).
- **Required CI on `2771ed3f`**:
  - `unit tests`: run 36622422731 (job 109590890729), `completed` /
    `success`, `8297 / 8293 / 0 / 4` read from the job's log;
  - `site build`: run 36622422715 (job 109590890424), `completed` /
    `success`. Every count, read from its own step's log, matches the
    recorded twelve (TAP 397, kit-typecheck 4, site-build 404,
    contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
    site-runtime 47, and kit-render, kit-a11y, kit-effects and kit-paint
    `all passed`). Only the two expected `##[error]`
    annotations appear (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`,
    inside the case that compiles a broken page on purpose), and CI skips
    the same four unit cases as before.
- **The image.** This is informational: nothing is merged or deployed.
  `2771ed3f` predicts `abf47dfeceba3c5c` (188 inputs, 158 paths). `main`
  (`47dea9c0`) predicts `dd4f72842234135b`, and the first wording
  `ce8f51050098d883`. A merge would roll the image.

### Limits, stated

- **No model was called.** The router's answer for any message is a
  prediction from its text.
- **"Can make" is the router's own judgment**, drawn from the tool's
  descriptions of each layer and of what `look` reaches. Nothing checks that
  judgment before the route runs. A wrong answer is handled as before: a
  held-back part is taken out before anything runs, and a scope that fails
  its check is withheld.
- **Test 8's request, expected results, recovery and cost are unchanged.**

## Merged and deployed (deploy 2170, the same day)

The owner's word: *"Merge the reviewed branch through
907840c67497b2624f1a2febfdb27b947ca5222a into main and deploy, after
confirming no unreviewed changes have entered the branch."* `main` was
fast-forwarded from `47dea9c0` to `907840c6` at 20:28:25 UTC. Checked first:
- the branch on GitHub was exactly `907840c6`;
- the router module's only non-comment change against `main` is the three
  reviewed strings;
- nothing was in flight;
- CI was green on the candidate;
- the rollback was verified in a throwaway worktree, giving main's own tree
  (`4bc05306…`).

Deploy run 2170 (36626580809) finished `success` at 20:31:31 UTC:
- `DEPLOY_ID` `907840c6…`;
- `abf47dfeceba3c5c` built from 188 inputs, as predicted;
- the container moved `dd4f72842234135b` → `abf47dfeceba3c5c` under
  `SUCCESS Modified application`.

The readings are in `docs/deploy-record.md`.

**Runtime-confirmed by the owner's free press, run 65** (21:51 UTC, on
`fold-lane-bakery`): both readers answer `907840c67497`, a cold container
gets `abf47dfeceba3c5c`, the free job finished at cost 0, and the balance
read 28. **Even so, whether a real router answers `look` for a
mix like Test 8's is not measured**: only Test 8's paid run, after the
owner's approval, can show it. Test 8 stays open, with its request, expected
results and recovery version (`01790468089054-8btpep`) unchanged.
