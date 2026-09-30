# 2026-09-30 — Decision 2b: a list sorted site-wide is `data`, on one named page it is `page`

On the branch, not merged and not deployed; no model was called and nothing
was spent. The owner's decision and scope correction, after Test 10 was
prepared:

> Proceed with decision 2b, with this scope correction:
>
> Use the existing data-sort lane for site-wide sorting by an existing column.
> Requests limited to one page should use the existing page editor while the
> data sorter remains site-wide. Do not add the proposed "whatever page they
> saw it" rule. Different pages may intentionally use different orders.
>
> Implement the general routing rule, preserving the existing whole-message
> handling and other edit routes. Add focused coverage for a list appearing
> on two pages: a site-wide request changes both; a page-specific request
> changes only the named page.
>
> Commit the successful-sort route coverage currently left in scratch,
> including the queued path, publication, unchanged rows, and correct
> billing.
>
> For Test 10, make the intended scope explicit: "Across the site, list the
> loaves from cheapest to most expensive." Keep the bakery fixture and
> preservation checks. Record the revised request and credit estimate.

## 1. The rule (`builder/site-ask.mjs`, two sentences, nothing else)

- **In the `data` clause**, after the row-removal sentence (which keeps its
  place as the clause's second line):

  > SORTING ONE OF THOSE LISTS ACROSS THE SITE IS THIS LAYER TOO: when they
  > want a list in order of something every entry already has — cheapest
  > first, A to Z, newest at the top — and do not limit it to one page, it is
  > re-sorted on every page that shows it. When they limit it to ONE page they
  > name, it is "page" instead, and only that page changes: different pages
  > may show the same list in different orders. Placing one entry by hand
  > ("put that one first") is not a sort.

- **In the `page` clause**, after its opening line and before "ONE PAGE, AND
  ONLY ONE":

  > THE ORDER OF A LIST ON ONE PAGE THEY NAME IS THIS LAYER TOO — "on the
  > services page, show the cheapest first": only that page's list is
  > re-sorted, and every other page that shows the same list keeps its own
  > order. Not limited to one page, the same sort is "data".

- **Unchanged**: the whole-message rule (still the field's last paragraph),
  `alsoAsked`, the `page`, `remove` and `rename` fields, every other clause,
  the data picker and the page writers. No "whatever page they saw it" rule
  exists anywhere the router reads. A hand-placed entry is named as no sort
  and routed nowhere by these sentences. The two new lines are the only lines
  in the `layer` field that speak of sorting.
- **The route semantics already fit**: `readEdit` drops a page from a `data`
  answer (the sorter has no page to be limited to) and keeps a page the site
  has on a `page` answer.

## 2. The tests

- **`test/router-list-sort.test.mjs`** (10 cases): the two sentences, their
  places, the correction both ways round (a named page is `page`, anything
  else `data`), no seen-on-this-page rule anywhere the router reads, the
  hand-placed entry, universality (only layers and the two examples quoted;
  no demo site, table or Test 10 words), the whole-message rule and
  `alsoAsked` unchanged, and through the real `POST /api/site/route` with
  supplied answers: the request carries both sentences and the tables they
  point at; a `data` answer goes on with no page and Test 10's press
  (`layer=data alsoAsked=none`) would post it; a `page` answer to Test 10's
  request is refused by that press; a page-limited answer keeps its page.
- **`test/edit-list-sort.test.mjs`** (7 cases), every hop driven (the
  routing route, the browser's own `siteEdit` POST, the edit route, the
  browser's composer), every model answer supplied:
  - **the bakery at `8btpep`** (its stored pages are `fixtures/run47/` byte
    for byte; its six `loaves` rows as read whole on 2026-09-30), Test 10's
    request, synchronous and queued: exactly `order.tsx` line 97 changed,
    the other four pages byte-identical; one compile carrying the stored
    page and one publish upload; the rows read and never written (no UPDATE,
    INSERT, DELETE or schema statement); one charge of 1 for the picker (a
    debit on the synchronous path; on the job path one sequenced reserve,
    finalized, never refunded, and no debit beside it), the publication
    uncharged, the routing call charged once at the routing route; the
    screen *"✅ loaves now comes out in order of price, lowest first — on 1
    page."* This is the scratch rehearsal of Test 10's preparation, now
    committed, with the queued path added;
  - **a list on two pages** (`loaves` read on `/` and `/menu`, `/visit`
    reading nothing):
    - a site-wide request, synchronous and queued: both reads re-sorted, each
      page changed in that one line, `/visit` untouched, no page writer
      called, one charge, *"… — on 2 pages."*;
    - a request limited to `/menu` through the quick writer, synchronous and
      queued: only `menu.tsx` re-sorted, the home page still `name` asc, no
      data step, nothing written, one charge, *"✅ Updated /menu."*;
    - the same through the full writer (the quick writer declining, as its
      rules send "a change to what the page LISTS" there): only `menu.tsx`
      re-sorted, `reordered: ["loaves"]`, and the reply names the other page
      without rewriting it.
- **Red check** (the new files over the previous router wording, `479fb7fc`):
  exactly the 7 wording cases fail; the 7 route cases and the 3 route-handling
  controls pass, because they cover behaviour that already existed.
- **Sweep** (its own worktree, byte-identical to the working tree, a green
  baseline of 17 of 17): 22 of 22 mutants killed, 3 comment-only controls
  survived. The mutants: each sentence removed, weakened, reversed (the
  dropped seen-on-this-page rule), moved or given a fixture word; sorting
  written into `alsoAsked` or the closing rule; the sort lane rewriting only
  the first page or flipping the direction; the picker not shown the lists;
  a sort never published; a row written on the sort path; the edit charged
  twice; the job reserving one credit too many; the page rung editing the
  home page; the other page not named; the sort sentence not shown.
- **The existing router tests**: the 29 files that read the router's wording,
  967 of 967, before the new files were added.
- **Full suite**: `8420 / 8420 / 0 / 0` locally (8,403 before, plus the 17
  new cases), run from the working tree after the sweep had finished.
- **Unit CI**: read after the push (the handoff in `docs/owner-notes.md`).

## 3. Test 10, revised

- **The request** (65 characters, 65 bytes, sha256 `22c96bd9338a8a31…`):
  *"Across the site, list the loaves from cheapest to most expensive."* It
  states the scope, as the owner asked.
- **The fixture, the expected changes and the preservation checks** are
  unchanged (the checklist's *Test 10*). The route box: `layer=data
  alsoAsked=none`.
- **Credits**: about **2–3**, an estimate and not a cap: routing 1–2 and the
  data step's picker 1; the publication is not charged (the committed
  coverage shows one charge of 1 on both paths). The balance was 6 at its
  last reading (22:27 UTC).
- **Before it can run**: the owner's review, then a merge and a deploy (the
  router's file is a container input, so the image rolls and container work
  waits 15–20 minutes), a free runtime check, the free rehearsal, and the
  paid press. None of it is done or asked for yet.

## 4. Found on the way (backlog)

- A page-limited sort that reaches `data` anyway (a routing mistake) is
  applied on every page: the sort lane has no page scope. Its reply names how
  many pages changed.
- The quick writer's rules send "a change to what the page LISTS" to
  `cannot`, so a one-page re-sort may fall to the full writer (6–22 credits)
  where a one-line change would do. Read, not measured.
- A one-page re-sort through the quick writer does not say the list is shown
  on other pages; the full writer's reply does (`reordered`).
