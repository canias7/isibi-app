# Go Farther

A customer describes a business in chat at **gofarther.dev** and gets a
published website at **`<slug>.gofarther.app`**. The site builder is the only
product: the media side was deleted on 2026-09-12 (`docs/platform.md`).

> **This file is the entry point**: the working rules, the approval
> boundaries, where things stand, the essentials of deploying and testing, and
> a map of the docs, which hold the full rules and the records.
>
> **At the start of every session, read
> [`docs/owner-preferences.md`](docs/owner-preferences.md)**: how the owner
> likes things done, and what needs their approval.
> [`docs/owner-notes.md`](docs/owner-notes.md) is the owner's running log (over
> 23,000 lines, newest entries first). **Search it when you need the history
> of a decision; don't read it whole.** Add a dated, plain-English entry to it
> for each change, and add a preference to `docs/owner-preferences.md`
> whenever the owner states one.
>
> **Keep this file short: it holds what is true now and the rules.** A
> change's story goes in a dated file under `docs/history/` and in the
> checklist; a deploy's readings go in `docs/deploy-record.md`; an open item
> goes in `docs/backlog.md`; topic law goes in its topic doc. When you compress
> an entry, keep its numbers. On 2026-09-28 this file went from 15,182 lines to
> 1,815 and then to 336, and nothing was deleted:
> [`docs/history/README.md`](docs/history/README.md) maps where every line went,
> and the full old file is `git show 86eb5703:CLAUDE.md`.
>
> **Nothing reads this file from disk. Two docs are read by tests**:
> `docs/owner-notes.md`'s "Names that must not be renamed" table (by
> `test/brand-rename.test.mjs` and `test/media-deleted.test.mjs`), and
> `docs/components.md` (compared byte for byte by
> `test/components-doc.test.mjs`). Keep both as they are.

## Where things stand (2026-09-30)

- **`main` is `80ece106`, deploy 2172** (2026-09-30 06:57 UTC, a
  fast-forward of 5 commits from `29111010`, on the owner's word to merge the
  reviewed branch through `80ece106`; one deploy run, green, on `80ece106`;
  it built image `e71f7bae88b9ecf1` from 188 inputs, as predicted on both
  ends, and the container moved `cdb624837e099719` → `e71f7bae88b9ecf1` at
  07:00:33). Nothing under `public/` changed. **Runtime-confirmed by the
  owner's free press, run 76** (07:49 UTC, from `main` on
  `fold-lane-bakery`): both readers answered `80ece10644a9`, a cold
  container got `e71f7bae88b9ecf1`, and queued jobs and the runner were on;
  nothing was charged. It carries **the row-removal routing correction**
  (below). `docs/deploy-record.md`.
- **Deploy 2171** (`29111010`, 2026-09-30 05:30 UTC, image
  `cdb624837e099719`, predicted on both ends; the served `chat.js` and
  `site-list.js` byte-identical to the merged files) is **credited by the
  owner as deployed; its own runtime check was never pressed**. Deploy 2172
  runs its code plus the routing correction, so run 76, which confirmed
  2172, is the runtime check of this code too (2171's own image was never
  read by a press). It carries **Lane 1's four corrections and the review
  round** (below).
- **Deploy 2170** (`907840c6`, 2026-09-29 20:28 UTC, image
  `abf47dfeceba3c5c`, predicted on both ends) was **runtime-confirmed by the
  owner's free press, run 65** (21:51 UTC, on `fold-lane-bakery`). It
  carries **the router's whole-message rule, by targets** (below).
- **Deploy 2168** (`47dea9c0`, 2026-09-29 16:35 UTC, a fast-forward from
  `cb981a4a`; the one push started two deploy runs a second apart, 2168 and
  2169, both green on the same commit, and both built image
  `dd4f72842234135b`, predicted on both ends) was **runtime-confirmed by the
  owner's free press, run 62** (16:57 UTC, on `fold-lane-bakery`): both
  readers answered `47dea9c01fbf`, a cold container got `dd4f72842234135b`,
  and queued jobs and the runner were on. Nothing under `public/` changed. It
  carries **the look door's menu lane** (below).
- **Deploy 2167** (`cb981a4a`, 2026-09-29 14:03 UTC, image
  `65ce683607928f0e`, predicted on both ends and built; a fast-forward from
  `a64729ad`) was **runtime-confirmed by the owner's free press, run 59**
  (14:53 UTC, on `fold-lane-bakery`): both readers answered `cb981a4ad1d3`, a
  cold container got `65ce683607928f0e`, and queued jobs and the runner were
  on. The served `chat.js` is
  byte-identical to the merged file (788,171 bytes, `82f36de3…`). It carries
  **the photo-removal correction**: "take the photo off" takes the
  photograph's element off (`remove`, found in the page's syntax tree), "keep
  the space" empties the frame (`clear`), contradictions and what cannot be
  taken off safely are refused by name, and `photosTakenOff` drives the undo
  hint. **Its limits stand**: a photo held by a larger block or written inside
  code is refused (20 of 210 on the stored test pages); an emptied wrapper
  with its own meaning is kept (21 of 190); two photos sharing a description
  are refused; a job run inline in the Worker, with no parser, refuses every
  removal. A real picture model answered `remove` for a removal in Test 7's
  run 60 (closed by the owner).
  `docs/history/2026-09-29-photo-removal.md`.
- **Deploy 2166** (`a64729ad`, 2026-09-29 02:51 UTC, image
  `6fbaccad82fe879d`) was **runtime-confirmed by the owner's free press, run
  54** (03:36 UTC, on `fold-lane-bakery`): both
  readers answer `a64729ad741a`, a cold container gets `6fbaccad82fe879d`, and
  queued jobs and the runner are on. The served `chat.js` and `edit-poll.js`
  are byte-identical to the merged files. On top of deploy 2165 it carries the
  canary's read of the description stored in a site's settings (`2a7767cc`:
  `readStoredHead`, the app's own SEO route read in every inventory) and **the
  per-operation scope fix (`9a79fc2d`) with its correction after the owner's
  review (`9ed7da51`)**: the router puts off only what its answer cannot do
  this turn; a part it puts off is taken out of the message before anything
  runs (`heldBack`, echoed as `deferred`, refused at no cost when it cannot be
  found: `route/held-unread`); and the picker names each change's page and
  words (`scopes`), so each runs on its own page with its own words. **An
  answer with no scope metadata runs as before. On a scoped answer, a change
  whose page is not a path or whose words are not in the message, a page the
  site does not have, and a picked lane left unscoped are withheld at no cost
  with their own sentence (`picker/scope-unread`, `page/no-page`) while the
  rest runs: never widened to the whole message, never sent to the home
  page.** The withholding is proven with supplied answers
  (`test/edit-op-scope.test.mjs`, and the scoped door case in
  `test/edit-removal-door.test.mjs`); run 57 exercised the scoped path live,
  where nothing needed withholding. `docs/history/2026-09-29-op-scope.md`.
- **Deploy 2165** (`f5e941f4`, image `8a10715339cdc780`) was runtime-confirmed
  by the owner's free press, run 51 (2026-09-28 22:57 UTC, on
  `fold-lane-bakery`): both readers answered `f5e941f494fd`, a cold container
  `8a10715339cdc780`, with queued jobs and the runner on. It carries the
  redirect fix (a publish reads the stored sidecar through `manifestFromCsv`):
  run 52's publish kept the bakery's stored redirect, read at once and ten
  minutes later. Redirects dropped between 2026-08-17 and that deploy are not
  rebuilt.
- **The branch `claude/help-needed-ehlwlj`** is `main` (`80ece106`) plus
  the canary's fixture check (`3229272e`, made to prove its read whole in
  `fc06edde`: `scripts/`, `test/` and the
  canary's workflow, none of them a Worker file or a container input) and
  documents. A press from the branch runs the branch's canary script against
  main's Worker. The `expect_rows` box exists only there.
- **The canary's opt-in fixture check** (2026-09-30, after run 77, on the
  owner's word; `3229272e`, and `fc06edde` after the owner's review of it;
  **on the branch, pushed for review, not merged**). The `expect_rows` box takes one JSON object: `table`,
  `baseline` (16–64 hex, the start of the canonical sha256 of the rows
  other than the target) and `target` (the one row's fields).
  - The box is read before the sign-in: malformed, or beside another mode,
    it exits 2 with no network call.
  - Above the modes and the spend switch, the table is read as the site's
    own read serves it, **and the read must prove it is the whole table**
    (`fc06edde`, the owner's review: any 200 list used to pass, so an answer
    leaving a row out matched a baseline of the rows it held). It asks the
    Data API for its count (`Prefer: count=exact`) and keeps the
    `Content-Range`, which the Worker passes through (measured: 200 `0-3/4`
    whole, 206 `0-1/4` partial, `*/0` empty, `0-3/*` without the count).
    Whole is `0-(n-1)/n` or `*/0`; a 206 or a count above the rows served
    is `incomplete`; no header, a `*` count or a header that does not
    describe the rows is `completeness-unknown`. Then the target must match
    exactly one row, and the other rows must digest to the baseline. Any
    stop exits 1 before any routing call, at no cost, with the reading in
    `fixture.json`. With spend `no` it is a free rehearsal.
  - **One reader on purpose.** The owner route's driver hands NUMERIC and
    BIGINT back as text and dates as Date objects, so it cannot be held to
    digests taken from the site's read. A first version that required the
    two readers to agree was dropped before the push: it would have stopped
    correct setups on such tables, and its stub had given both readers the
    same rows. A table only the owner can read cannot be checked this way.
  - Tests: 25 cases in `test/canary-fixture.test.mjs`, including the real
    script end to end under an in-process network stub that answers the
    count contract as the Data API does (`test/fixtures/canary-stub.mjs`):
    a partial 200 and the API's 206 stop as `incomplete`, a `*` count and
    no header as `completeness-unknown`, each with no routing call, no paid
    edit and nothing after the read; the whole table as named routes once;
    the owner route is never read. 3 placement guards in
    `test/edit-canary.test.mjs`.
  - Red check on `fc06edde`'s tests over `3229272e`'s script: the partial
    and unverifiable answers were routed and edited there (the owner's
    false pass, reproduced); 8 fail, 40 pass. Sweep: 30 of 30 killed, 2
    controls survived. Full suite `8388 / 8388 / 0 / 0` locally and `8388 /
    8384 / 0 / 4` on unit CI (run 36765527935 on `08da9b48`, the records on
    top of `fc06edde`). (At `3229272e`: 18 of 18; full suite `8383 / 8383 /
    0 / 0` locally and `8383 / 8379 / 0 / 4` on unit CI, run 36758456675
    on `11bb6a14`.)
  - `docs/history/2026-09-30-fixture-check.md`.
- **A stored row taken off its list is routed to `data`** (2026-09-30, on
  the owner's word before the paid row-deletion test; `4e3ef512`; the owner
  passed its review, and it is **merged and deployed in deploy 2172,
  runtime-confirmed by run 76**). The router's tool gave such a removal
  two answers: `look`'s removal clause claimed every removal ("whatever the
  something is", a whole page its one exception), `data`'s clause one row of
  a list, and `look`'s reach under `alsoAsked`, which the whole-message rule
  reads, said "taking something off". On the look door no lane deletes a
  row. **The fix is three strings in `builder/site-ask.mjs`**: the `data`
  clause claims an existing row taken off; `look`'s removal clause has two
  exceptions, a whole page (still `page` with `remove`) and a stored row
  (`data`), both before "anything else"; `look`'s reach excepts a stored row.
  The whole-message rule, the `intent`, `page`, `remove` and `rename` fields,
  and add-row and ordering (2a, 2b) are unchanged. Tests
  (`test/router-row-removal.test.mjs`, 9 cases): the wording, the request the
  real routing route sends, supplied answers through that route, and
  controls; red check (exactly the 6 wording and request cases fail on the
  old wording); sweep 16 of 16, 2 controls survived; the 62 router-related
  files and 1a's `data-remove-wording` 2,351 of 2,351; full suite `8360 /
  8360 / 0 / 0` locally; required CI green on `4e3ef512` (unit 36677496812:
  `8360 / 8356 / 0 / 4`; site build 36677496840: the twelve counts) and on
  `80ece106` (unit 36679661698: `8360 / 8356 / 0 / 4`; documents only
  since `4e3ef512`).
  **One live sample since**: run 77's real router, told the table names by
  the route, answered `data` for a row taken off the list (the row was
  absent, so nothing was deleted: the delete test is not yet shown). The image rolled
  `cdb624837e099719` → `e71f7bae88b9ecf1`, as predicted.
  `docs/history/2026-09-30-row-removal-routing.md`.
- **Balance 13** on the building account after run 77 (Lane 4's delete,
  pressed before its temporary row existed, 2026-09-30 08:29 UTC): 15 → 13,
  routing 2; the job's reserve of 1 refunded (ledger rows 343 and 344), no
  job open, and nothing since (read at 17:12). Before it, **15** after run 74 (Batch 1's refused
  B2, 2026-09-30 02:11 UTC): 17 → 15, routing 2, and no edit; read again by
  run 76 (07:50 UTC, free), with no ledger row after 342 and no job open.
  Before it,
  **17** after run 72 (Batch 1's A2, 01:19 UTC): 19 → 17, routing 2, and no
  ledger row for the removal (`exempt`), with no job open. Before it, **19** after run 71
  (Batch 1's B1, 01:06 UTC): 22 → 19, routing 2 and the job's reserve of 1
  (ledger row 342). Before it, **22** after run 66 (Test
  8's second paid run, 2026-09-29 21:57–22:00 UTC): 28 → 22, routing 2 and the job's
  reserves of 3 and 1 (ledger rows 340 and 341), with no job open; read
  again by the free restore (run 67) at 22:24, with no row after 341, and
  on 2026-09-30 at 00:41 after Batch 1's runs 68–70, which charged nothing. Before it,
  28 after run 63 (Test 8's first paid run, 2026-09-29 17:03 UTC): routing 2
  and the job's reserve of 2, ledger row 339, read again after the free restore (run 64) at 17:30, with no row after
  339 and no job open, and again at 21:35 after deploy 2170 and by run 65 at
  21:51 (the same).
  Before it, 32 after run 60, unchanged through runs 61 and 62. The unit
  suite is **8,351** on `main` (`29111010`): `8351 / 8351 / 0 / 0` locally
  (on `ce992066`, the same code) and `8351 / 8347 / 0 / 4` on CI (run
  36671505759 on `29111010`).
- **Closed by the owner, not to be repeated**: live test 2 (run 32); Test 3
  (run 34) with the stylesheet corrections (deploy 2161); the kit-heading fix
  (2162); Test 4a (runs 37 and 39); Test 4b's D1 (run 42) and the conditional
  recovery write (2163); the scoped rules acceptance (run 44 — `lido-axes-b`'s
  bookings stay closed); Test 5's page removal (run 49) and restoration (run 50)
  with the removal-door correction (2164); Test 6 (runs 57 and 58: a
  site-wide description and a Visit-only move stored and published from one
  message, unrelated content preserved, the redirects kept, and `8btpep`
  restored free); Test 7 (runs 60 and 61: a photograph's element taken off
  `/visit` with no placeholder and the home band moved, published together,
  unrelated content preserved, and `8btpep` restored free); Test 8 (runs 66
  and 67: a menu item taken out and the Visit band moved from one message,
  routed `look` by the real router, both published exactly as expected, and
  `8btpep` restored free; runs 63 and 64 kept as history); Batch 1's group A
  (runs 72 and 75: a removed page answering 301 home, read 14 and 25 minutes
  after publication, not immediately, and `8btpep` restored exactly and free;
  no rerun for an immediate reading); Batch 1's B1, credited (run 71: one
  field changed through a blank database link).
- **Test 6 is closed by the owner** (2026-09-29) for exactly what runs 57 and
  58 showed: one message's site-wide description and Visit-only band move,
  both stored and published; unrelated content preserved; the existing
  redirects kept; and the original version restored without charge. **Kept
  separate**: the reply omission (review #9) and the withholding paths (a
  part put off, a scope that fails its check), shown only with supplied
  answers. Component preservation is untested there (the fixture has none),
  and **real-model mixed work through the removal door is not reached by a
  natural message**: the router's instructions make several changes one
  `look` answer (Test 7's routing review).
  The record is the checklist's *Test 6*.
- **Test 7 is closed by the owner** (2026-09-29) for the customer behavior
  runs 60 and 61 showed: the Visit photograph's element removed without a
  placeholder, the home band moved, both published together in one message
  through the look door, unrelated site content preserved, and the original
  version (`8btpep`) restored free. **The stored home page's missing final
  newline is accepted as a specific nonfunctional exception for this
  acceptance only**: it stays recorded (backlog), no byte-for-byte
  preservation is claimed for that file, and no other whitespace change is
  exempt. **Kept separate**: the reply omission (review #9) and the remaining
  photo-removal limits (backlog). Not to be repeated. The photo-removal
  correction behind it is deployed in 2167 (`remove` takes the element off,
  `clear` keeps the space when asked). The record is the checklist's *Test 7*
  (*Run 60*, *Run 61*, *Closed*) and `docs/history/2026-09-29-photo-removal.md`.
- **The look door's menu lane is corrected, merged and deployed in 2168**
  (2026-09-29; runtime-confirmed by run 62). A menu change beside other work is routed `look`,
  and no lane there described the menu's items: the one lane that runs the
  menu editor (`action`) said "only that button", and run 47's real picker
  read "Take Gallery out of the menu." as `behavior`, which changed nothing.
  Reproduced through the route with supplied answers; **the fix is that lane's
  description** (the menu's items and the button), with `behavior` pointing
  there; the route is unchanged, because a scoped answer already hands the
  menu editor only the menu's words. 19 route cases, sync and queued: both
  executors with their own words, unrelated links kept, both partial
  outcomes, ordinary menu and button edits. Shown with supplied answers, and
  live by Test 8's run 66 (the real picker placed the menu change there).
  Required CI green on `f2783aef` (unit 36595193059: `8296 / 8292 / 0 / 4`;
  site build 36595193255: the twelve counts) and on `47dea9c0` (unit
  36597948276); the image rolled to `dd4f72842234135b`, as predicted.
  `docs/history/2026-09-29-menu-lane.md`.
- **Test 8 ran as run 63** (2026-09-29 17:02–17:06 UTC, 4 credits): one
  message, *Take Gallery out of the menu. Then, on the Visit page only, put
  the "Order a collection so we hold a loaf" band above "Come to the
  bakery".*, on `fold-lane-bakery` at `8btpep`. **The router answered `nav`
  with `remove` and held the band back (`alsoAsked`)**, against its own rule
  that several changes `look` can make are one `look` answer (backlog). So the
  removal door's menu step ran alone: Gallery out of every menu with the
  expected bodies, the gallery page kept, everything else preserved, one
  publish (`t5obxx`), the money exact; the band was not moved or charged, and
  the reply asked for it next (the held-back path's first live run since
  deploy 2166). **The look door was not reached**, so the real picker placing
  the menu change on the menu editor's lane is still shown only with
  supplied answers. **The free restore (run 64, 17:29 UTC) put `8btpep`
  back**, checked (stored pages equal to the fixture, markup and pixels
  identical to the before-read, no charge). **The owner recorded run 63 as a
  partial outcome** (the menu removal succeeded, the Visit move was deferred)
  **and accepted run 64**; the intended mixed-request acceptance remains open,
  and every earlier closure stays credited. The record is the checklist's
  *Test 8* (*Run 63*, *Run 64*, *The owner's review*). **Pressed again as run
  66** (21:56–22:00 UTC, 6 credits) after deploy 2170: the real router
  answered `look` with nothing held back, the look door's picker placed the
  band on `shape` and the menu change on the menu editor's lane (`action`),
  and both changes were stored and published exactly as expected (one
  publish, `li1j0y`, built from `8btpep`; everything else preserved, read at
  once and ten minutes later; `/order` and `/starter` identical to the
  pixel). Every acceptance item is met; the reply still names only the look
  (review #9, kept separate). **The free restore (run 67, 22:23 UTC) put
  `8btpep` back**, checked (stored pages byte-identical to the fixture,
  markup and pixels identical to the pre-test reading, no charge). **Closed
  by the owner** (2026-09-29) for the exact combined request run 66 proved,
  with recovery verified by run 67; runs 63 and 64 stay as history, and there
  are no further reruns. The record is the checklist's *Test 8* (*Run 66*,
  *Run 67*, *Closed*).
- **The router chooses one answer over the whole message, by what a route
  can make on every page** (2026-09-29: `465efe11`, then `2771ed3f` after the
  owner's review of its first wording; **merged and deployed in deploy 2170**
  (`907840c6`, image `abf47dfeceba3c5c` as predicted) and
  **runtime-confirmed by run 65**). Run 63's `nav` + `remove` + `alsoAsked` came from instructions
  that disagreed: each layer's clause named the answer for the change a
  message leads with ("A MENU CHANGE IS "nav"", `remove` for a menu item),
  the several-changes rule sat inside `look`'s own paragraph, and
  `alsoAsked` judged a hold against the answer already chosen. The first
  wording chose by kind, which the owner corrected: two layout changes on two
  pages are one kind, and `page` edits one page. **The fix is three strings
  in `builder/site-ask.mjs`**: the `layer` field ends on one rule over the
  whole message, **by targets, never by kind** (a layer other than `look` is
  the answer when it can make every change on every page each one is on;
  when none can, `look`, if it can make them all, with nothing held back, so
  changes of one kind on different pages are `look`; a change is held back
  only when no one answer can make it with the rest); the `page` clause's
  older multi-page line (it said `addon`) points at that rule; and
  `alsoAsked` spares a part one answer can make with the rest, whatever the
  first change was, naming no answer of its own. The route is unchanged.
  Guard revised (one kind is no longer enough); red check (exactly the 2
  revised cases of 197 fail on the first wording and on `main`); sweep (16
  of 16, 3 controls survived); the existing two-page, single-change,
  menu-plus-layout and hold cases (20 of 20 and 18 of 18, supplied answers);
  Test 8's request replayed with both answers (2 of 2); full suite `8297 /
  8297 / 0 / 0`; required CI green on `2771ed3f` (unit 36622422731: `8297 /
  8293 / 0 / 4`; site build 36622422715: the twelve counts). **Its first live
  reading is Test 8's run 66: the real router answered `look` for that mix,
  with nothing held back** (one sample; how often, and for other messages,
  is not measured). The image rolled to `abf47dfeceba3c5c`, as predicted. `docs/history/2026-09-29-whole-message-routing.md`.
- **Batch 1: group A accepted, B1 credited, row 4 waits for the owner's free write** (2026-09-29,
  after Test 8's closure; corrected 2026-09-30 after the owner's review, and
  approved the same day at an estimated 5–8 credits, not a cap). **Two groups are ready**, on
  different sites with different controls, each paid press with its route
  enforced:
  - **A**, item 1's open half (a removed page answering 301 home), on
    `fold-lane-bakery`: the free restore to run 63's `01790701419976-t5obxx`
    (Gallery already out of the menus, so nothing else names `/gallery`),
    "Remove the gallery page." expecting `layer=page page=/gallery
    remove=true alsoAsked=none`, the addresses read without following
    redirects at once and ten minutes later, then the free restore to
    `8btpep`.
  - **B**, the data item's missing-reference half only, on `fretwork-1`
    (`incomplete`): a `lessons` price changed and put back by a second
    message, each expecting `layer=data alsoAsked=none`, against the full
    four-row baseline (736 bytes, `a4f1dc30…`), with a recovery for every
    kind of unintended difference. A saved page version restores no row, and
    no recovery write is made during preparation.

  **Round 1, as pressed (2026-09-30).**
  - **A1 is done** (run 68, free). The bakery is live at `t5obxx`: the five
    stored pages hash as recorded, `/gallery` answers 200 and no page links
    to it, and `/the-starter` still answers 301.
  - **B1 at first did not run.** Run 69 had the route box blank and was
    cancelled before routing. Run 70 was pressed from `main`, which has no
    route box. Its router answered `addon` with `failed` in 0.4 s at cost 0,
    and the canary refused before posting. Runs 68–70 charged nothing.
  - **B1 then ran as run 71** (01:05–01:07 UTC, from the branch, route box
    filled), and every pass item is met:
    - the route matched (`data`, nothing held back, cost 2);
    - job `12fde9b8…` ran in the container, found the database through the
      blank link, and `applied` exactly `lessons` row 4's `price` (`failed`
      0);
    - rows 1–3 are identical and row 4 differs only in price, 40 → 42;
    - `/prices` shows £42 (the only pixels changed are the digit), nothing
      was published, and `neon_db` is still blank;
    - it cost 3: routing 2 and ledger row 342 (`12fde9b8…#1`), 22 → 19.
  - **Why the routing call failed**: the xAI account's balance was empty
    (the owner's finding; they added credits at about 01:00 UTC). The route
    keeps no reason (backlog). The request builds normally for those inputs
    (measured free), so the throw came from the model call (grok-4.6).
  - **Round 2 was handed over at 01:12 UTC**: A2 ("Remove the gallery
    page.") and B2 (the price back to £40), a minute apart.
  - **A2 ran as run 72** (01:18–01:22 UTC), and every pass item is met:
    - the route matched (`page`, `/gallery`, `remove`, cost 2);
    - job `16aaaddf…` removed only `gallery.tsx` (`exempt`, cost 0) and
      published `yuy16h` from `t5obxx`; the other four pages are
      byte-identical;
    - `/gallery`, `/gallery/` and `/gallery?…` answer 301 to the home page,
      read at 01:35 and 01:46 UTC, identical; `/the-starter` still answers
      301;
    - it cost 2 (routing only, no ledger row), 19 → 17.
  - **Run 73 (A3's press) never started**: the image id was in the route
    box, which refused before the sign-in, at no cost.
  - **Run 74 (B2) was refused by the route check**: the router answered
    `text` (cost 2), so the edit was never posted, and row 4's price is
    still 42. It is the check's first live refusal, and the `text` answer
    is a backlog finding.
  - **A3 ran as run 75** (02:20–02:22 UTC, free): RESTORED `8btpep`, the
    five stored pages byte-identical to the fixture, `/gallery` 200 again,
    `/the-starter` still 301, the sitemap five pages, nothing charged. Group
    A is complete.
  - **The owner's review (2026-09-30).**
    - **Group A is accepted** for the 301 home and the exact free
      restoration. The timing limit stays explicit: the redirects were read
      14 and 25 minutes after publication, not immediately. There is no
      rerun for an immediate reading.
    - **B1 is credited** (the missing-reference data edit).
    - **B2's `text` misroute is a separate finding**. It is not counted as
      passed and not retried with a model.
    - **Row 4's recovery is the owner's own free write**: the Data panel, or,
      where its button is dark on a blank-link site (a backlog finding), the
      conditional `UPDATE` in the Neon console.
    - After the owner confirms: all four rows and every field against the
      baseline, the displayed price, the version, no charge and no open job.
      Then the batch's recovery closes, with the routing finding kept.
    - **Read after the owner's report of the put-back (08:15–08:19 UTC)**:
      row 4 is still 42 in the database and £42 on `/prices`, and nothing
      else changed (rows 1–3, versions, money, queue). The recovery stays
      open.
    - **Traced, free, not settled** (`docs/history/2026-09-30-fixture-check.md`).
      Supabase's own request logs hold no session check or owner lookup
      from the Data panel in the 24 hours to 17:25 UTC: every session check
      for the building account is a canary run's, and there is no owner
      lookup for fretwork-1 outside the runs. That fits no Save reaching
      the Worker but does not prove it: a request that stopped before those
      calls, or one the logs did not keep, would leave no trace there.
      Neither a user error nor an app defect is shown. The owner's
      observation is asked for: what Save displayed, and the price after
      reopening the panel. Row 4 still reads 42 at 18:22 UTC (the site's
      own read, free).
    - Spent: 7 (22 → 15).

  **Estimates, not limits**: A about 1–2 credits, B about 4–6, about 5–8
  together. Nothing caps a request or the batch; the only hard bound is the
  balance of 22. **The canary now enforces a press's expected route**
  (`expect_route`, `scripts/canary-route.mjs`; merged with deploy 2171's
  push, so a press from `main` or the branch runs it). It is read before the sign-in; the
  router's answer is saved to `routing.json` before any refusal; a mismatch
  is refused above the edit POST; a match is posted unchanged. Verified with
  9 new cases, a red check on `da24ce1b`, the real script under an in-process
  network stub (11 scenarios), a sweep of 29 mutants all killed with 2
  controls surviving, and the full suite `8306 / 8306 / 0 / 0` locally and
  `8306 / 8302 / 0 / 4` on CI (run 36648622383 on `b87430c7`).
  **The remaining six are the owner's list**: redirect home; data add,
  delete and reorder plus the missing reference; broader rules; picture
  replacement; a first-attempt component; a follow-up after a failure or
  escalation. A protection refusing a real model's answer is kept separate.
  The four not in the batch are not ready. The record is the checklist's
  *Batch 1* and `docs/history/2026-09-30-expected-route.md`.
- **Lane 1's four corrections are merged and deployed in deploy 2171**
  (built 2026-09-30 on the owner's word; `docs/history/2026-09-30-lane1.md`;
  its code runtime-confirmed under deploy 2172 by run 76). **The owner credited the implementation
  and its CI**, and the two diagnostic fixes from their review (`ce992066`,
  below) passed review; required CI is green on the merged candidate
  `29111010` (unit 36671505759, `8351 / 8347 / 0 / 4`; site build
  36671505766, the twelve counts):
  - **1a** (`19f6e480`): the data picker is sent to `remove` for a
    deletion, with add-row wording and routing unchanged;
  - **1b** (`fe20e6cd`, `d19652c4`, `ce992066`): a failed routing call
    carries `failure`, from allow-lists only (the step, provider, status,
    billing, error class, and a provider's code only from its own finite
    table, never coerced), with the same fallback and no charge; the
    canary prints it; the tests read the Worker's log as well as the
    reply;
  - **1c** (`b12dd43b`, `bd81a60e`): the site list's `db` comes from `backendState`
    (`null` when a lookup fails, never a no); adoption keeps the server's
    yes; the owner data routes open a blank-link database read-only; the
    Data panel no longer calls a failed read "no tables";
  - **1d** (`a02c2003`, `d19652c4`): when the browser sent no table
    names, the route tells the router the verified owner's own, by name
    only, in at most 3 s, failing open; its log line names the slug and a
    known error class, and the route cache's KV line it reaches
    (`ce992066`) names the operation and a known error class.

  Every correction was red-checked and swept (8/8, 25/25, 17/17, 15/15
  and the KV line's 9/9 killed, every control survived). The full suite on
  `ce992066` is `8351 / 8351 / 0 / 0` locally. The image rolled
  `abf47dfeceba3c5c` → `cdb624837e099719`, as predicted, and the served
  `public/chat.js` and `public/site-list.js` are the merged bytes.
  **Real-model evidence**: 1d only, in run 77 (the route told the real
  router four table names, and it answered `data`); the rest is shown with
  supplied answers only. B2 stays failed and its recovery open until the
  owner's free write and my checks.
- **The rest of the next independent work** (2026-09-30, free analysis only;
  the checklist's *Next independent work*).
  - **Lane 2**, seven decisions that are the owner's, in parallel: which
    step adds a row, whether ordering is `data`, the rules fixture, the
    picture swap's scope, the component definition, the follow-up
    scenario, and healing the blank links.
  - **Lane 3**, the router wording, after the decisions in lane 2.
  - **Lane 4**, one bounded press per open item after one merge. Nothing
    accepted is repeated. The merge is deploy 2171. **The delete is the next
    unaccepted live test**: the checklist's *Lane 4's delete* (a throwaway
    row the owner adds on `fretwork-1`, taken off by one message, expected
    route `data`, about 3 credits). **Pressed as run 77 (08:28 UTC) before
    its temporary row was added and with B2's recovery open**: the real
    router answered `data` (matched), the picker found no such row
    (`no-match`, refunded), nothing changed, 2 credits. **The owner recorded
    run 77 as a failed deletion acceptance** and credited separately its
    correct live routing and its refunded no-match result. The deletion is
    still unshown. **A new press is prepared only after the price recovery
    and the temporary row have both been read back and verified.**
- **The short edit-path checklist** (demonstrated live · tested only with
  supplied model output · untested, material gaps first) is the top of
  `docs/investigations/edit-path-checklist.md`, and every test's plan, readings
  and closure are recorded there.
- **Parked or kept separate by the owner**: React #418 (hydration); the
  translator reading page code as text; D2 and D3 (grants apply and a real
  order on `fold-lane-bakery`); model-written replies; `lido-axes-b`'s
  still-visible booking invitation; the lost redirects; the QR code pointing at
  a removed page; the bare not-found text on Start sites; a multi-step look
  reply naming only the look (review #9); and the saved-version list naming
  only a publish's first change.
- **Codex's investigations** — the add-on escalation correction, the edit-path
  milestone and the literal-text guard — are in `docs/investigations/`.

## Approval boundaries

The owner's own words for each rule are in `docs/owner-preferences.md`.

- **Spending.** No paid run, model call or fal purchase without the owner's
  approval. Propose the exact request and a cost estimate first. An estimate
  is not a cap: nothing enforces a per-request limit, so the balance is the
  only bound.
- **Presses.** The owner presses every workflow run. A session's dispatch
  answers **403** (it lacks `actions: write`), even for a free check: try once
  only when asked, never retry, and hand over the exact inputs, naming each
  form box by its **description** (the form shows descriptions, not input
  names).
- **Git.** Work on `claude/help-needed-ehlwlj`. Merge to `main` and deploy
  only when the owner says so. No pull request unless asked.
- **Closed stays closed.** Don't repeat a closed test, or spend a run only to
  check it again. Closing is the owner's decision, after their own review.
- **Live data.** No booking, order, row write, grants apply, site deletion or
  database restore on a live site without approval. `lido-axes-b`'s bookings
  stay closed, and D2 and D3 are parked.
- **Secrets.** Never read a secret's value: select non-secret columns only,
  and record a secret's name, never its hint. Never mint or read an owner
  credential, and never describe how the account was topped up.
- **Network.** Never turn off TLS verification or unset `HTTPS_PROXY`, and
  never add the proxy CA to Chromium.
- **Scope.** Keep a found issue separate: record it in the backlog rather than
  widening the current milestone to fix it. No keyword- or fixture-specific
  rules. No broad sweep, new harness or redesign unless the owner asks.

## Working rules

- **Always show UI changes as screenshots in the chat** — render it headless and
  send the image. The owner reviews everything visually.
- **The owner directs design; don't restyle beyond what's asked.**
- **Don't spend fal credits or model calls on tests without asking first.**
- **Work on the designated branch**, not on main directly.
- **Never write GitHub's own skip-CI marker anywhere** — not in a commit message,
  not in a PR body, not while explaining it. GitHub scans the whole message and
  suppresses every workflow for that push: main moves, nothing deploys, nothing
  tests, and there is no red run to notice. **Done twice, both times inside prose
  about the rule itself.** In prose call it "the skip-CI marker" and never spell
  it. `test/deploy-secrets.test.mjs` holds the half that lives in the tree.
- **A merge runs the deploy and nothing else** (owner, 2026-09-09). Every
  other workflow is dispatch-only, except that `unit tests` still runs on
  every feature-branch push, and `site build` and `answer read` on one that
  touches their paths. So **nothing is checked automatically on `main`**: run
  what matters by hand before anything that matters.
  `test/merge-triggers.test.mjs` requires `deploy.yml` to be the only workflow
  a push to main starts.
- **The paid workflows are dispatch-only** (`build smoke`, `edit smoke`, `page
  gen eval`, `schema gen eval`), and their commit-marker gates are kept.
  **Never spell the smoke opt-in marker either**: a commit that quoted it
  bought a run (2026-09-01). Both rules in full are in `docs/deploy.md`.
- **Never commit while a mutation sweep is running.** A killed sweep skips its
  `finally` and leaves a live mutant in the tree.
- **Every change ships with**: guard tests, a mutation sweep from a verified-green
  baseline with a comment-only control that must survive, the full unit suite,
  entries here and in owner-notes, and a push.
- **Stamp measured numbers only AFTER the run.** A result written before the run
  ends is a claim ahead of its evidence.
- **Customer replies should EVENTUALLY be model-written from authoritative
  operation results** (owner, 2026-09-24: *"Record my future preference:
  customer replies should eventually be model-written from authoritative
  operation results. Do not implement that redesign now."*). Recorded, not
  started. Until then replies are composed deterministically in `editReply` —
  and the half that carries over is already the rule: **what a reply states
  comes from what the operations really did** (`pageOps`, `partial`, the diff,
  the ledger), never from the request's wording. **Kept for that work, not
  reopened** (owner, closing D1, 2026-09-27): the data rung's "✅ Updated one
  entry in loaves." names the table and not the change, because `applied`
  carries only the table, the row id and the column; the rules rung's "changed
  whether it's open" is the same kind of sentence.
- **Where a change is recorded now**: in this file, only what changed in the
  current state; the story in a dated file under `docs/history/` and in the
  checklist; a plain-English entry in `docs/owner-notes.md`. **The scope of
  the tests follows the owner's request**: recent rounds asked for focused
  tests and targeted probes, not a broad sweep.

## Where the code lives

The full map is `docs/platform.md`.

- **`public/`**: the browser app, plain HTML, CSS and JS with no build step —
  `index.html`, `styles.css`, `chat.js` (the builder's client and the agent
  builder's), `auth.js`, `edit-poll.js`, `site-list.js`, `site-zip.js`.
- **`worker.js`**: the Cloudflare Worker — the assets and the whole
  `/api/site/*`, `/api/db/*` and `/api/agent/*` surface. Tests can import it.
- **`builder/`**: the site builder. `lovable/template/` is the kit (React 19,
  Tailwind v4, TanStack Start, 2,112 components); `build-server.mjs` is the
  container's service; the rest are plain modules tested outside the Worker.
- **Supabase** (`ujrqdmmtcptvimazlhom`): sign-in, the credit ledger, the site
  tables (`site_backends`, `site_project`, `site_builds`) and the edit queue.
  **Neon**: one project per site. **R2**: every published build, the live
  pointer `current/<slug>.json`, page source and uploads.
- **`agent-builder/`** is a separate product with its own `CLAUDE.md`.

## Deploying, in brief

The rules in full are `docs/deploy.md`; each deploy's readings go in
`docs/deploy-record.md`.

- A push to `main` deploys (GitHub Actions, then Wrangler, then Cloudflare). A
  push that touches only `**.md`, `docs/**`, `LICENSE`, `test/**` or
  `scripts/**` starts **no deploy run**; one that touches a workflow does.
- **The container image is rebuilt only when its inputs change.** Before the
  push, predict the image id over both ends (`containerInputs` and `imageId`
  in `.github/scripts/container-images.mjs`); afterwards, read the log's
  `built` or `reused` line and its `-`/`+` image pair. Today there are 188
  inputs (158 distinct paths). GitHub masks each run of `1`s as `***`.
- **After an image roll, wait 15–20 minutes** before container work that must
  run the new code. A push that rolls nothing owes no wait.
- **A green deploy is not a runtime confirmation.** Say "deployed, not
  runtime-confirmed" until an authenticated read of `/api/site/build-health`
  (the owner's free canary press) answers with the new sha and image. When
  `public/` changed, byte-compare the served file with the merged one, taking
  the before reading first.
- **Before a merge**, check that nothing is in flight (Actions runs and edit
  jobs), required CI is green on the candidate, the image is predicted, and
  the rollback is verified in a throwaway worktree. A fast-forward's rollback
  is `git revert --no-commit <base>..<candidate>`, which must give back main's
  own tree.
- An optional secret needs a `|| fallback` in `deploy.yml`; a required one must
  not have one.

## The product, in brief

- **A build** (`POST /api/site/react-build`): route, design (one
  `design_schema` call), provision a Neon database only when tables are
  declared, generate (`write_pages`), compile (`tsc` reports; only `vite build`
  refuses), render check in a real Chromium, salvage, publish. The model's raw
  answer is kept at `source/<slug>/answer.json`. `docs/build-path.md`.
- **An edit** climbs a ladder, cheapest first: `text` · `data` · `rules` ·
  `look` · `picture` · `logo` · `nav` · `page` · `addon`. It climbs only where
  the climb is classified (`builder/edit-failure.mjs`); anything else is told
  to the customer at no cost for the edit. **Read `docs/architecture.md`
  first**, then `docs/edit-path.md`.
- **"Add" goes to the add-on step** (`builder/site-add.mjs`); an edit changes
  what is already there. `docs/addon-path.md`, which also has what is proven
  live for each add-on kind.
- **Every job runs in the site's own container, with no clock**: a 50-minute
  deadline and a 90-second lease. `docs/containers-and-jobs.md`.
- **Data, payments and mail**: one Neon database per site, with RLS on every
  table (ask `resolveAccess(t)`, never the preset name). Payments use the
  owner's own Stripe key and mail the owner's own key; `env.EMAIL` is ours,
  and the builder may not touch it. `docs/site-database.md`,
  `docs/platform.md`.
- **Credits**: 1 credit is $0.008. `use_credits` is a gate, not a till; a
  founder is never credited back; the build path debits and reverses by ref
  (`credit_debit`, `credit_reverse`). `docs/platform.md`.

## Live state

**Read the ledger; do not trust a number here.** A stale balance makes
`buildFloor` refuse before spending, and the refusal reads as a broken build.
Every earlier reading — the balance since run 9, the suite and site-build
stamps, how each was taken — is in `docs/history/2026-09-28-live-state.md`.

- **Balance 13** after run 77 (Lane 4's delete pressed before its
  temporary row existed, 2026-09-30 08:29 UTC): 15 → 13, routing 2; the
  job's reserve of 1 refunded (ledger rows 343 and 344); nothing since, read
  at 17:12. Before it: 15 after run 74 (Batch 1's B2,
  refused by the route check, 2026-09-30 02:11 UTC): 17 → 15, routing 2
  only; read again by run 76 (the free runtime check, 07:50 UTC), with no
  ledger row after 342 and no job open. Before it: 17 after run 72 (Batch 1's A2, 01:19 UTC): 19 → 17,
  routing 2 and no ledger row (the removal is `exempt`). Before it: 19 after run 71 (Batch 1's B1, 01:06 UTC): 22 →
  19, routing 2 and the job's reserve of 1 (ledger row 342). Before it: 22 after run 66 (Test 8's second paid run,
  2026-09-29 22:00 UTC): 28 → 22, routing 2 and the job's reserves of 3
  and 1 (ledger rows 340 and 341). Before it: 28 after run 63 (Test 8's paid
  run, 2026-09-29 17:03 UTC): 32 → 28, routing 2 and the job's reserve of 2
  (ledger row 339), read again at 17:30 after the free restore (run 64), with
  no row after 339, and at 21:35 after deploy 2170 and by run 65 at 21:51 (the
  same). Before it: 32 after run 60 (Test 7's paid run,
  2026-09-29 15:07 UTC): 37 → 32, routing 2 and reserves of 2 and 1 (ledger
  rows 337 and 338), read again at 15:27, at 15:37 after the free
  restore (run 61) and at 16:57 by run 62, with no row after 338. Before it:
  37 after run 57 (2026-09-29 04:19 UTC; ledger rows 335 and 336, read again
  at 05:04, and unchanged through runs 58 and 59). Before that: 45 at run 50's end
  (2026-09-28 18:41 UTC): run 49 took it 50 → 45 (routing 2 + 1 and the menu
  edit's reserve of 2, ledger row 333; the page removal `exempt`). Run 51
  (22:57 UTC, free) read 45 again. Run 52 (Test 6's paid run) took it 45 → 42:
  routing 2 and the job's reserve of 1 (ledger row 334). Run 54 (free,
  2026-09-29 03:36 UTC) read 42 again, with no ledger row after 334. Run 57
  (the Test 6 retry, 04:18 UTC) took it 42 → 37: routing 2 and reserves of 1
  and 2. `GET /api/fal-balance` answers fal's balance separately.
- **The building account is `aniascristian@gmail.com`**, not the session's own
  address. It owns every live site and holds that balance; look at the wrong
  row and the balance reads zero.
- **Live sites**: `northgroup-5`, `-9` … `-17`, `markbook-1`, `shoeroom-1`,
  `repairbench-1`, `fretwork-1`, `ashgrove-1`, `washhouse-1`,
  `ben-crowe-guitar`, and the older `fold-lane-bakery`, `harbourside-roast`,
  `the-lido-cafe`, `oak-and-ash`, `forno-and-co`. **Reusing one of those slugs
  revises that site.** The test fixtures now: `fold-lane-bakery` live at
  `01790468089054-8btpep` (put back by Batch 1's A3, run 75, byte-identical
  to the fixture),
  `fretwork-1` at `01790404806543-kk6qsh` (Test 3's removal kept; `lessons`
  row 4's price is 42 after B1; B2 was refused by the route check, so it
  waits for the owner's put-back), and
  `lido-axes-b` with its bookings closed (run 44, kept).
- **What things cost, measured** — routing 1–2 per message (it moves with the
  prompt cache); the page rung 6–22 (runs 21–37); a data or rules edit 1 (a
  data edit that matches no row 0, its reserve refunded: run 77); a
  reframe 1; a site description 1 (runs 52 and 57); a quick-writer page step 2
  (run 57); a quick-writer move with a photograph removal in one job 3 (run
  60); a menu edit 2 (runs 49 and 63); a menu edit and a page move through the
  look door in one job 4 (run 66); the logo rung, a page move and a
  page removal 0 (`exempt`); a
  first build 11–45; a revise of the same site 17; an add-on 2–13 (runs
  47–52). **Quote a range or measure the run.** Nothing enforces a per-request
  cap (`edit_reserve` raises only above 100,000), so the balance is the only
  bound. The default builder model is grok (`DEFAULT_PICKER`), and a cold new
  account is one credit short of building (`buildFloor` 20 against a grant of
  20, the routing call spending 1 first).
- **The unit suite is 8,360** (`80ece106`, deploy 2172): `8360 / 8360 / 0 /
  0` locally (on `4e3ef512`, the same code), where the two `sheet-rtl`
  browser cases run because the template's dependencies are installed, and
  `8360 / 8356 / 0 / 4` on CI (runs 36677496812 on `4e3ef512` and
  36679661698 on `80ece106`) — **compare the totals, never `pass`**; CI
  skips four. (Before the row-removal routing correction: 8,351 at
  `29111010`, `8351 / 8351 / 0 / 0` locally and `8351 / 8347 / 0 / 4` on CI,
  run 36671505759. Before Lane 1: 8,297 at
  `907840c6`, `8297 / 8297 / 0 / 0` locally and `8297 / 8293 / 0 / 4` on CI,
  runs 36622422731 and 36625806573. Before the router's correction: 8,296 at `47dea9c0`, `8296 / 8296 / 0 / 0`
  locally and `8296 / 8292 / 0 / 4` on CI, runs 36595193059 and
  36597948276. Before the menu-lane correction:
  8,277 at `cb981a4a`, `8277 / 8277 / 0 / 0` locally and `8277 / 8273 / 0 / 4`
  on CI, runs 36539848541 and 36542727770. Before the photo-removal
  correction: 8,241 at `9ed7da51`, `8241 / 8239 / 0 / 2` locally and `8241 /
  8237 / 0 / 4` on CI, run 36511517996.) **`site build`** reads the same
  twelve counts green on `9ed7da51` (run 36511518084), on `4ee123d2` (run
  36539848416), on `f2783aef` (run 36595193255), on `2771ed3f` (run
  36622422715), on `29111010` (run 36671505766) and on `4e3ef512` (run
  36677496840), each read from each step's log: TAP 397, kit-typecheck 4, site-build **404** (382 plus the browser
  control's 22), contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47, and kit-render, kit-a11y,
  kit-effects and kit-paint `all passed` (census 7 + 4 + 1 = 12). Its two
  `##[error]` annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17)
  TS2339`) sit inside the case that compiles a broken page on purpose.
- **Running the suite here**: `node --test "test/*.test.mjs"` with the glob
  quoted; `playwright-core` at the root (`npm i --no-save`, the template's
  version); a worktree needs `node_modules` linked in; nothing of ours already
  running (`pgrep -af build-server.mjs`, then kill by PID); a shallow clone can
  fail `site-searchpath`'s ancestry case, so unshallow it; a worktree in a
  directory `nobody` cannot enter (the scratchpad is one) fails
  `render-sandbox`'s privilege-drop case, so run the full suite from a
  world-readable path. **Measure a baseline
  in a worktree; never subtract from a paragraph.** The stamp chain ends at the
  last commit that moved a test or product file.
- **Reading CI**: read a job's own top-level fields (`status`, `conclusion`),
  never a pattern over its JSON (every step carries the same keys); ask for runs
  by branch, never by `?head_sha=` (it answers 0 for shas that have runs); count
  distinct result numbers, not lines (a byte-order mark hides one); read counts
  from the per-step log files; the site-build job has twenty steps and the API
  answers 23.

## The traps, in brief

Every trap cost at least one session. **Read `docs/traps.md` before writing a
guard, a sweep, a harness or a CI reader.** The ones met most often:

- **The wiring layer.** A module can be right with one hop cut. Before
  rewording a prompt because a field came back empty, check that the field can
  arrive, following the chain from the producer.
- **Assert the property, not the spelling.** Read source landmark to landmark,
  never by bytes, and assert that both landmarks exist first.
- **A negative assertion must prove its observer is alive** (`[].every()` is
  `true`). Blank comments before a scan: prose contains the thing it forbids.
- **A surviving mutant is a question about the mutant first.** Measure both
  versions, check every anchor before the run, never commit while a sweep
  runs, and never restore with `git checkout` (it restores HEAD, not your
  edits).
- **`pgrep -f` and `pkill -f` match your own shell.** Wait on a PID.
- **Cannot-tell must never read as a value.** Refuse a non-string rather than
  coerce it (`String(["a"])` is `"a"`), and use `Object.hasOwn` for a caller's
  key.
- **A fixture must come from its real producer**, including a supplied router
  answer, which must be the one the router is told to give (run 47).
- **A green harness proves the path it took.** Judge a test by what its
  operations did (the stored reply, the publishes, the source, the addresses),
  never by counting replies (run 47).
- **A rule that is true because of a layer below it expires when that layer
  moves**, and nothing announces it.
- **Read CI from a job's top-level fields**, ask for runs by branch (never
  `?head_sha=`), and compare suite totals, never `pass`.

## Where everything else lives

| Doc | What it holds |
|---|---|
| `docs/owner-preferences.md` | how the owner likes things done, and the approval boundaries — read at session start |
| `docs/owner-notes.md` | the owner's running log, newest first — read on demand; it holds the "Names that must not be renamed" table |
| `docs/investigations/edit-path-checklist.md` | the short edit-path checklist, and every test's plan, readings and closure (Test 6's plan is there) |
| `docs/architecture.md` | the owner's drawing: build, then edit / add-on / delete on one spine |
| `docs/edit-path.md` | the ladder, what the edit path does now, what an edit may add, what the page rung preserves, the 21 lanes, renaming |
| `docs/addon-path.md` | the add-on in brief, what is proven live per kind, its kinds and requirement report, photographs, QR codes, outside connections |
| `docs/site-database.md` | the four backend states, the `search_path` pin, column-scoped write grants |
| `docs/containers-and-jobs.md` | no clock in the container, the model-call transport, where a job ran, the probes |
| `docs/build-path.md` | how a site gets built, the design call, the published site, the code explorer, the design and page splits |
| `docs/instruments.md` | the free instruments, what a paid harness refuses, the edit canary and its modes |
| `docs/app-rules.md` | the builder app's rules, the model table, and the agent builder's half in this app |
| `docs/platform.md` | the two halves, where the code lives, data, auth, payments and mail, credits |
| `docs/deploy.md` | what a push starts, the paid workflows, the image predictor, runtime confirmation, the served-file check, secrets, rollback |
| `docs/deploy-record.md` | every deploy's image prediction and timings, 2137 → 2172 (add new ones here) |
| `docs/traps.md` | the full trap catalogue |
| `docs/backlog.md` | the open items: a one-line index, then each in full |
| `docs/history/` | dated records of every run and fix round, 2026-09-21 → 09-28, and the old status and live-state sections — indexed in `docs/history/README.md` |
| `docs/investigations/` | the milestone, text-preservation and add-on escalation investigations |
| `docs/components.md` | the kit's component list, generated (a test compares it byte for byte) |
| `agent-builder/CLAUDE.md` | the agent product's own record |
