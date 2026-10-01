# 2026-10-01 — The sort rule's scope: "not limited to one page" is not "across the site"

**Passed by the owner through `322c2430`, merged and deployed in deploy 2174
(2026-10-01, image `b8c8789aa8e395d6`; §7).** No model was called and nothing
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
  so, or they name no page"*), as it was before the correction. **Confirmed
  by the owner** when passing the correction: *"Keep the default that an
  unqualified list-sorting request applies site-wide."*

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
- **Unit CI**: `8427 / 8423 / 0 / 4` on `99837db1` (run 36795891188; the
  total matches, and CI skips its four), read from the job's own fields and
  its `npm test` step's log.
- **Site build** (it ran because the router's file is an image path): green on `99837db1` (run 36795891162), the twelve counts read from each
  step's log as before: TAP 397, kit-typecheck 4, site-build 404,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47, and kit-render, kit-a11y, kit-effects and kit-paint `all
  passed`. Its two `##[error]` annotations (`index.tsx(50,13) TS2322`,
  `menu.tsx(27,17) TS2339`) are the known ones, inside the case that compiles
  a broken page on purpose.

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

## 7. The owner's review, the merge, deploy 2174 and Test 10's baseline

- **The review** (2026-10-01): *"The scope correction passes review through
  322c2430. Keep the default that an unqualified list-sorting request applies
  site-wide."* So a sort that names no page stays `data`, as §2 reads it.
  *"Keep selected-page real-model behavior marked unproven; don't expand this
  into extra paid tests."* No press is planned for a selection.
- **The merge and deploy**: a fast-forward of 22 commits, `8908b59d` →
  `322c2430`, pushed at 00:58:41Z on the owner's word. Before the push:
  nothing in flight on GitHub or in `edit_jobs`; unit CI green on
  `322c2430` itself (run 36798198283, `8427 / 8423 / 0 / 4`); the image
  predicted over both ends (`e71f7bae88b9ecf1` → `b8c8789aa8e395d6`, 188
  inputs, one moved: `builder/site-ask.mjs`); the rollback checked in a
  throwaway worktree. **One deploy run, 2174** (36798842190), green. Its log
  answered `built …:b8c8789aa8e395d6`, and Wrangler moved the container
  `e71f7bae88b9ecf1` → `b8c8789aa8e395d6` at 01:01:45Z. **The deployed
  commit is `322c2430` and the image `b8c8789aa8e395d6`, both as predicted.**
  Nothing under `public/` changed. The readings are in
  `docs/deploy-record.md`. **Deployed, not runtime-confirmed** until the
  owner's free press reads build-health.
- **Test 10's baseline, read free and read-only** (as a visitor, every
  write request aborted; the demo as it stands):
  - **the table, whole**: `loaves` through the site's own read, at 01:00:37
    and again at 01:10:41 UTC, after the roll, byte-identical: 200,
    `Content-Range: 0-5/6`, 1,045 bytes, sha256 `ef870ebc…`. The same six
    rows as on 2026-09-30: Country White 4.8, Dark Rye 5.2, Seeded Wholemeal
    5.4, Olive & Rosemary 5.8, Walnut Levain 6 and Sea Salt Focaccia 4.5,
    ids 1–6, `photo` null. The canary's own functions turned it into the
    rows box, read back `as named`: target row 6 with every field, and the
    other five digesting to `093f2130a37a6704`;
  - **the pages** (01:04 UTC, after the roll): the sitemap's five, read
    without following redirects, all 200 at `01790468089054-8btpep` (build
    `muj2gzlo-iptyvw`): `/` 11,634 bytes (`31256cdc…`), `/gallery` 17,912
    (`4646c1a4…`), `/order` 15,425 (`980e0c02…`), `/starter` 3,087
    (`d1a3ef86…`, the stub page with no menu, as before), `/visit` 12,803
    (`2faf5e62…`);
  - **the displayed order**: only `/order` reads the table
    (`loaves?select=*&order=name.asc`), and it shows Country White £4.80,
    Dark Rye £5.20, Olive & Rosemary £5.80, Sea Salt Focaccia £4.50,
    Seeded Wholemeal £5.40 and Walnut Levain £6.00. No other page made a
    data request;
  - **the redirects**: `/the-starter` 301 → `/starter` (`public,
    max-age=600`), keeping a query, and `/the-starter/` the same; `/gallery`
    with a query and with a trailing slash 200; an unknown page 404;
  - **screenshots** of the five pages, for the pixel checks after the paid
    run;
  - **the stored page sources** are not readable as a visitor. The free
    press's own inventory reads them (`before/source.json`), with the
    versions and every page's markup, and its fixture check reads the table
    again (`fixture.json`).
- **One free press does both jobs.** The canary's preflight reads
  build-health and the runtime, and refuses on another sha or image. Its
  free checks, inventory, balance and fixture check all run before the
  spend switch, and a press with spend `no` stops there: *"CANARY_SPEND is
  not 1 — stopping before the paid edit. Nothing was charged."* The route
  box is accepted on a free run and routes nothing, so the free press
  carries the paid press's boxes unchanged except the spend switch. The
  boxes are in the checklist's *Test 10*.
- **The authorized free dispatch, tried once** at 01:22:02 UTC, 20 minutes
  after the roll, from `main` with exactly those boxes: **refused, `403
  Resource not accessible by integration`**, the known blocker (the
  session's token lacks `actions: write`). Not retried. No run started: the
  newest edit canary run is still run 82, so the owner's press will be run
  83. Checked just before: balance 6, last ledger row 348 and none after,
  no job open on any account (the newest from 2026-09-30 22:22), and no
  workflow run in progress.
- **Still to come**: the owner's free press. It confirms the runtime (sha
  and image), reads the stored page sources (`before/source.json`, expected
  to equal `test/fixtures/run47/*.before.tsx`, as run 75 left them), and
  reads the table again against the rows box. **The paid press is handed
  over only after that passes**, and pressed only on the owner's approval.
