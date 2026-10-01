# 2026-10-01 — The sort rule's scope: "not limited to one page" is not "across the site"

On the branch, not merged and not deployed; no model was called and nothing
was spent. The owner's review of decision 2b's rule
(`docs/history/2026-09-30-sort-routing.md`):

> Fix one scope issue in the new routing rule: "not limited to one page" does
> not mean "site-wide."
>
> Use data-sort when the requested change applies across the site. Keep a
> one-page request on the page editor. A request limited to a selected group
> of pages must preserve that selection; never expand it to every page
> showing the table.
>
> Correct both broad phrases in builder/site-ask.mjs and the corresponding
> tests and documentation. Preserve the existing whole-message handling. If
> no existing route supports a requested selection, report that limitation
> rather than silently widening the change. Do not build another capability
> for this correction.
>
> Add focused coverage for three pages showing the same list, with a request
> naming two and explicitly excluding the third. Clearly distinguish checking
> the router's instructions from proving a real model's choice.

## 1. The defect

The first wording sent to `data` every sort "not limited to one page": the
data clause said *"and do not limit it to one page"*, and the page clause
closed on *"Not limited to one page, the same sort is "data"."* A request
naming two pages of three is not limited to one page, so it read as `data`,
and the sort lane (`applySort`) has no page scope: the page left out is
re-sorted too. Shown with a supplied `data` answer to the three-page request
below: `sortChanged` names all three pages, and the reply says *"… — on 3
pages."*

## 2. The correction (`builder/site-ask.mjs`, the same two sentences)

- **The `data` clause** (still its third line):

  > SORTING ONE OF THOSE LISTS ACROSS THE WHOLE SITE IS THIS LAYER TOO: when
  > they want a list in order of something every entry already has —
  > cheapest first, A to Z, newest at the top — everywhere it is shown (they
  > say so, or they name no page), it is re-sorted on every page that shows
  > it, all at once. THIS LAYER CANNOT LEAVE A PAGE OUT, so it is never the
  > answer when they limit the sort to some of the pages that show the list:
  > ONE page they name is "page", and several pages they name, or every page
  > but the ones they exclude, is a change on each of those pages and on no
  > other, which the last paragraph of this field decides. A page they left
  > out keeps its order: different pages may show the same list in different
  > orders. Placing one entry by hand ("put that one first") is not a sort.

- **The `page` clause** (still its second line):

  > THE ORDER OF A LIST ON ONE PAGE THEY NAME IS THIS LAYER TOO — "on the
  > services page, show the cheapest first": only that page's list is
  > re-sorted, and every other page that shows the same list keeps its own
  > order. Across the whole site the same sort is "data". On SEVERAL pages
  > they name it is neither — this layer edits one page, and "data" cannot
  > leave a page out — so the last paragraph of this field decides it, and a
  > page they left out is never re-sorted.

- **Unchanged**: the whole-message rule (the field's closing paragraph),
  `alsoAsked`, the `page`, `remove` and `rename` fields, every other clause,
  the pickers and the writers. A selection is pointed at the closing rule,
  as the page clause's several-pages line already points there, rather than
  at a layer of its own.
- **A request that names no page** is read as across the site (*"they say
  so, or they name no page"*), as it was before the correction. That reading
  is mine, recorded for the owner to confirm or correct.

## 3. What carries a selection today, traced without a model

- **`data`**: every page that shows the list, always. It has no page scope,
  so it can never carry a selection.
- **`page`**: one page.
- **`look`**, the closing rule's answer for changes on several pages:
  - its picker scopes each change to a page (its tool: *"The same part on two
    pages is two entries"*), and each page lane (`purpose`, `components`,
    `shape`, `three`, `tsx`) runs one page step on its own page, handed only
    that change's words: the quick writer, then the full writer
    (`runLayer("page", …)`, the page editor the owner chose for one page);
  - two scoped steps on different pages stay two operations
    (`mergePageSteps` and `samePageOperation` both compare the page);
  - no lane on that door reaches `data` (`laneLayer`: page, picture, nav,
    rules, rename). So a selection given to `look` is made page by page and
    is never widened.
- **So an existing route carries the owner's three-page case**, and nothing
  new was built. What is not known, and kept separate (§6):
  - which lane a real picker names for a list's order: no lane's description
    names one (a page lane makes the change; `backend` reaches the rules
    step, which sorts nothing; anything else changes nothing; none widens);
  - the cost: the quick writer is told to decline *"a change to what the page
    LISTS"*, so each named page likely costs the full writer, 6–22 credits a
    page, against about 1 for the sorter across the site;
  - the reply: *"✅ Updated the look."*, naming neither page.
- **If no answer can make a selection**, the closing rule holds it back and
  the reply says so (*"I only did one thing this time. Say “…” and I'll do
  that next."*). Nothing is widened, and nothing was added for it.

## 4. The tests: instructions, supplied answers, and what neither shows

Every test name now says which kind it is:
- **instructions**: what the router is TOLD, the tool as defined and the
  request the real `POST /api/site/route` sends. It proves the rule is
  stated, never that a model follows it;
- **structure**: a fact about the code the instructions rely on;
- **supplied answers**: a model answer is given, and the real route's
  handling of it is read. It proves what the route does with each answer,
  never which answer a real model gives.

No test shows which answer a real router or picker gives. Only a live press
after a merge and a deploy can, and none has been made for this rule.

- **`test/router-list-sort.test.mjs`**, 14 cases (10 before):
  - instructions (9): the whole-site sentence and its place; the two broad
    phrases gone from everything the router reads; a selection never `data`,
    a page left out keeping its order, the closing rule deciding; one named
    page is `page`; no seen-on-this-page rule; the hand-placed entry;
    universality (no site, page, table or request words); the whole-message
    rule, `alsoAsked` and every other clause unchanged; and the request the
    real routing route sends (both sentences, the pages and tables they point
    at, no broad phrase);
  - structure (1): no lane on the look door reaches the sorter;
  - supplied answers (4): Test 10's three, as before, and the three-page
    request: a `look` answer goes on with no page and nothing held back, and
    a press expecting `layer=look alsoAsked=none` posts it; the route passes
    a `data` answer on unchanged, so only the instructions, and on a press
    the route box, stand between a selection and the sorter.
- **`test/edit-list-sort.test.mjs`**, 10 cases (7 before), every one
  supplied answers:
  - the 7 before, renamed *"supplied answers: …"* with their assertions
    unchanged; one comment added, that the quick writer's answer in the
    one-page case is not the one its rules point to;
  - **three pages showing the same list** (`/`, `/menu`, `/order`; `/visit`
    reads nothing) and *"On the home page and the menu page, but not the
    order page, list the loaves from cheapest to most expensive."*,
    synchronous and queued:
    - the router's `look`, no page;
    - the picker scoping one page lane twice;
    - each step shown its own file and only the change's words;
    - `/` and `/menu` re-sorted, one line each;
    - `/order` and `/visit` byte-identical;
    - no sort reported, no data step, no row written;
    - one compile, carrying `/order` unchanged, and one upload;
    - one charge per page step, the picker's call billed once:
      - two debits when direct;
      - two sequenced reserves, finalized once and never refunded, when
        queued;
    - the screen *"✅ Updated the look."*;
  - **the same request answered `data`**, which the instructions forbid: all
    three pages re-sorted, *"… — on 3 pages."*
- **Red check** (the new files over the previous wording, `3c4e201a`):
  exactly the 8 instruction cases that read the corrected sentences fail.
  The other 16 pass: the 10 chain cases, the structure case, the unchanged
  half of the one-page sentence, and the 4 route cases.
- **Sweep** (its own worktree, byte-identical to the working tree, a green
  baseline of 24 of 24): 24 of 24 mutants killed, 3 comment-only controls
  survived. The mutants:
  - each broad phrase put back;
  - the data sentence taking a selection, or naming `look` past the closing
    rule;
  - the exclusion form dropped;
  - one named page sent to `data`;
  - several named pages sent to `data`;
  - the left-out page's order not promised, in either sentence;
  - "no page named" no longer meaning the whole site;
  - a fixture page in the rule;
  - sorting written into `alsoAsked` or the closing rule;
  - a look lane reaching the sorter;
  - two scoped steps on different pages merged, or one absorbed as already
    done;
  - every scoped step sent to the first page;
  - the writers handed the whole message;
  - the picker billed once per step;
  - the job reserving one credit too many;
  - a sort never published;
  - a row written on the sort path;
  - the sort lane rewriting only the first page.
- **The other router tests**: the 29 files that read the router's wording,
  967 of 967, on the corrected wording.
- **Full suite**: `8427 / 8427 / 0 / 0` locally (8,420 before, plus the 7
  new cases), run from the working tree after the sweep had finished.
- **Unit CI and the site build**: read after the push (the handoff in
  `docs/owner-notes.md`).

## 5. Test 10

Unchanged. *"Across the site, list the loaves from cheapest to most
expensive."* says its scope, so it is `data` under the corrected rule; the
route box stays `layer=data alsoAsked=none`; about 2–3 credits; the bakery
fixture and the preservation checks as they were. Not run.

## 6. Found on the way (backlog)

- The look picker is told of no lane for a list's order, so which lane a real
  picker names for a selection is unknown (a page lane makes it, `backend`
  sorts nothing, none widens).
- A selection costs the full writer on each named page (the quick writer is
  told to decline list changes): likely 6–22 credits a page, against about 1
  for the sorter across the site. Read, not measured.
- The look door's reply for a selection is *"✅ Updated the look."*, naming
  neither page: a case of the parked multi-step look reply (review #9).
- Only the router's instructions keep a selection from the sorter. The route
  reads no page out of the message, so a `data` answer to a selection
  re-sorts the pages left out, and says *"— on 3 pages."*. On a press, the
  route box refuses it before any edit. No code guard was added: it would be
  a keyword rule.
