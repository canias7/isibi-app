# Remaining edit-path checklist

## The short checklist (2026-09-28, after Test 5 and the redirect fix)

**Closed by the owner (2026-09-28): Test 5's removal (run 49) and its
restoration (run 50).**
- **Run 49**, from one browser tab:
  - "Take Gallery out of the menu." reached the menu rung through the removal
    door; the real picker, told the routed change, listed nothing else; exactly
    the Gallery link came off four menus;
  - "Remove the gallery page.", sent only after that stored success, removed
    `gallery.tsx` alone, free;
  - 5 credits.
- **Run 50**, free: version `8btpep` is back; `/gallery` serves itself,
  `/the-starter` redirects to `/starter`, and the stored pages equal the
  before-read byte for byte.

**Closed by the owner (2026-09-29): Test 6, for exactly what runs 57 and 58
showed.**
- **Run 57**, one message: the site's default description stored and
  published on `/` and `/starter` (the three pages with their own kept them),
  and the Visit band moved on `/visit` only; unrelated content preserved and
  the stored redirect kept; 5 credits.
- **Run 58**, free: version `8btpep` is back, stored and published, with
  nothing charged.
- Kept separate: the reply omission (review #9) and the withholding paths
  (supplied answers only).

**Closed by the owner (2026-09-29): Test 7, for the customer behavior runs 60
and 61 showed.**
- **Run 60**, one message through the look door: the Visit photograph's
  element taken off with no placeholder, and the home page's band moved;
  both published together, the rest of the site preserved; 5 credits.
- **Run 61**, free: version `8btpep` is back, stored and published.
- The stored home page's missing final newline is accepted as a specific
  nonfunctional exception for this acceptance only; it stays recorded, and
  no other whitespace change is exempt.
- Kept separate: the reply omission (review #9) and the remaining
  photo-removal limits.

**Closed by the owner (2026-09-29): Test 8, for the exact combined request
run 66 proved, with recovery verified by run 67.**
- **Run 66**, one message (*Take Gallery out of the menu. Then, on the Visit
  page only, put the "Order a collection so we hold a loaf" band above "Come
  to the bakery".*): the real router answered `look` with nothing held back;
  the look door's picker placed the band on `shape` and the menu change on
  the menu editor's lane (`action`); both stored and published exactly as
  expected, in one publish, the rest preserved; 6 credits.
- **Run 67**, free: version `8btpep` is back, stored and published.
- Kept as history: run 63 (a partial outcome: the router held the band back)
  and its restore, run 64. No further Test 8 reruns.
- Kept separate: the reply omission (review #9) and the saved-version list's
  label naming only the first change (backlog).

**Closed by the owner (2026-09-30): the row check's first live run (run 79)
and the AI row deletion (run 80)** (*Lane 4's delete*, below).
- **Run 79**, free, from `main`: the canary read `fretwork-1`'s `lessons`
  whole (`0-3/4`), found the target (id 2, "Group of three") as named and
  the other three rows digesting to `47c5b2217d6d6453`, and stopped before
  any routing call; nothing charged.
- **Run 80**, one normal message through the real edit route (*We don't do
  the Group of three any more, please take it off the price list.*): the
  real router answered `data` and the route check matched; the job removed
  exactly `lessons` id 2; the other three rows are unchanged, byte for
  byte; `/` and `/prices` no longer show it, with nothing published; the
  balance went 13 → 10 (routing 2, the job's 1 finalized, ledger row 345),
  with no job open; 3 credits.
- The demo data stays as it stands (the owner's rule): three rows, nothing
  restored.
- Kept separate: the reply cutting each deleted field at 40 characters
  (backlog).

**Closed by the owner (2026-09-30): Test 9, for the demonstrated no-match
failure followed by a successful edit in the same tab** (runs 81 and 82;
*Test 9*, below). The additional data, website, refund, billing and
no-reload checks are accepted. The demo data stays unchanged, and the test
is not to be repeated.
- **Run 81**, free: the rehearsal opened the app, read the table and both
  pages at £42, typed message 1 and sent nothing.
- **Run 82**, from one browser tab, never reloaded:
  - *"We've stopped running the Weekend workshop, please take it off the
    price list."*: routed `data`; the data step matched nothing
    (`no-match`); the app drew the warning; the job's reserve of 1 was
    refunded; the table was the baseline on both readers, byte for byte;
  - *"Please change the Hour one-to-one's price to £45."*, sent from that
    same tab: routed `data`; exactly `lessons` id 4's price, 42 → 45;
    *"✅ Updated one entry in lessons."*; ids 1 and 3 unchanged; `/prices`
    and `/` show £45, with nothing published;
  - 4 credits (10 → 6): routing 2 and 1, message 1's edit 0 once refunded
    (ledger rows 346 and 347), message 2's edit 1 (row 348); no job open.
- The demo data stays as it stands: the Hour one-to-one is £45.

**Closed by the owner (2026-10-01): Test 10, for run 84's demonstrated
request.**
- **Run 84**, one message, *"Across the site, list the loaves from cheapest to
  most expensive."*:
  - the real router answered `data`, with nothing held back;
  - exactly `order.tsx` line 97 changed (sorted by price, lowest first), and
    the site published once;
  - `/order` lists the loaves cheapest first;
  - no row was written, and the rest of the site is identical;
  - 3 credits.
- **The money, verified independently in Supabase** by the owner's reviewer:
  the job done, billing finalized, cost 1, `needs_review` false; one ledger
  row (349, a reservation of −1) and nothing more for it; with routing's 2,
  3 in all; balance 3, no job open.
- The bakery stays at version `dgmag4`. A sort limited to a selection of
  pages stays unproven with real models. Not to be repeated.

**Test 11, one item added to an existing list: prepared, then its
capability built (2026-10-01, on the owner's word), corrected in three
rounds and merged and deployed in deploy 2175 the same day, its code
unchanged in deploy 2176 (the CI change) and runtime-confirmed by run 85;
pressed as run 86 and refused by the route check: the real router answered
`edit`/`data`, not `addon`, because its wording has no rule for an added
row; 2 credits, nothing added, not passed. The router's wording is corrected
on the owner's word and merged and deployed in deploy 2177 (`25faac78`,
image `9a71a6384b4206a2`, rolled at 23:05:58 UTC) and runtime-confirmed
by run 87. **The paid retry passed as run 88**: the route answered
`addon`, the `row` kind saved exactly one entry (id 7, "Rye & Caraway"),
the six existing rows and every page unchanged, the reply true; 5 credits
(routing 3, the add-on 2). That proves the saved-row outcome, not the raw
model's choice: the route's reply cannot show whether `addon` was the
model's own answer or a conversion (the router audit's R3). For the owner's
review and closure**
(*Test 11*, below). Under the owner's rule (*"Add will always
go in addon"*) the request reaches the add-on step, and **none of its nine
kinds added a row to a table the site already has**: a table's seed fills
only an empty table, and every plausible answer ended in a refusal or in a
false success (a hand-written card published on `/order`, the list
unchanged). **Built**: a tenth add-on kind, `row`, that writes a new entry to
a display list the site already stores with the data step's own
parameterised insert (shared, not copied), returns the row the database
saved with its own id, and changes no page; one statement saves the entries
and the request's key together, so a duplicate submission or a replayed job
saves nothing twice and charges once; and the canary can post an add-on
press when its route box says `intent=addon`. Shown with supplied answers
only: **real model routing and the real picker are unproven** until a live
run exercises them. `docs/history/2026-10-01-add-row.md`.

**Broad real-model batches: proposed 2026-10-01, then paused by the owner
the same day to focus on Test 11's routing; nothing sent or spent**
(*Broad real-model batches*, below). Four
chats typed in the normal app, with the builder choosing its own routes:
the bakery (eight messages, Test 11's addition carried in as 1.1), the
repair workshop's backend (three), and two first builds, Lune Yoga
(members, bookings, time zones) and Kiln Coffee (stock, checkout, two
languages). Follow-ups come in a second round in the same chats. The
estimate is 135–330 credits against a balance of 101. Nothing in it is to
be pressed until the owner lifts the pause. The owner's order (2026-10-01):
Test 11's retry first, then a router audit with its own focused routing
tests, before any broader test resumes.

**Lane 1 (2026-09-30): four corrections, merged and deployed in deploy 2171
(`29111010`, image `cdb624837e099719`; the deployment credited by the owner),
the code runtime-confirmed under deploy 2172 by run 76**
(*Next independent work*, below; `docs/history/2026-09-30-lane1.md`):
- the data picker is sent to `remove` for a deletion;
- a failed routing call names why, from allow-lists only;
- a blank database link counts as a database, from the site list to the
  Data panel;
- the router is told the verified owner's table names when the browser sent
  none.

Each was red-checked, swept, and shown through the real routes with
supplied answers only. No real model was called. Required CI is green on
the merged candidate itself (unit 36671505759, `8351 / 8347 / 0 / 4`; site
build 36671505766, the twelve counts), and the served `chat.js` and
`site-list.js` are the merged bytes. B2 stays failed and its price
recovery open. The next unaccepted live test, the delete (*Lane 4*), is
prepared below and not run.

**The row-removal routing (2026-09-30): corrected, merged and deployed in
deploy 2172 (`80ece106`, image `e71f7bae88b9ecf1`), runtime-confirmed by
run 76** (`4e3ef512`; `docs/history/2026-09-30-row-removal-routing.md`). The router's
instructions gave a stored row taken off its list two answers, `look` and
`data`; now it is `data`, said in the `data` clause, at `look`'s exceptions
after the whole page, and in `look`'s reach. The whole-page exception, the
whole-message rule and the open decisions are unchanged. Required CI is
green on `4e3ef512` (unit 36677496812, `8360 / 8356 / 0 / 4`; site build
36677496840, the twelve counts). Instruction and supplied-answer evidence
only; no model was called.

**Batch 1 (2026-09-30): group A accepted by the owner, B1 credited, and
B's row 4 waits for the owner's free write** (*The owner's review of
Batch 1*, below). Group A is accepted for the 301 home and the exact free
restoration, with its timing limit explicit: the redirects were read 14
and 25 minutes after publication, not immediately. B1's missing-reference
data edit is credited. B2's `text` misroute is a separate finding, not
counted as passed and not retried with a model. A3 (run 75) restored
`8btpep` exactly, free. Before it, run 73 (A3) never started (the image id was in the
route box), and run 74 (B2) was refused by the route check (the router
answered `text`), for 2 credits and no change (*Runs 73 and 74*, below).
Before that: A2 (run 72) removed `/gallery`, which answers 301 home,
read twice, for 2 credits (*A2 as run 72*, below). A1, the free restore to
`t5obxx` (run 68), is done and checked. B1 ran as run 71 after runs 69 and
70 went nowhere (a blank route box; a press
from `main` whose routing call failed on an empty xAI balance). It changed
exactly row 4's price, 40 → 42, through the blank-link path in the site's
container, for 3 credits (*B1, pressed again as run 71*, below). The batch:
two acceptance groups that can run side by side on different sites,
each paid press with its route enforced by the canary's new expected-route
box (on the branch). **A** (item 1's open half): from saved version
`t5obxx`, "Remove the gallery page." on `fold-lane-bakery`, the removed
page's addresses read for a 301 home, then the free restore to `8btpep`.
**B** (the data item's missing reference only): a `lessons` price changed
and put back on `fretwork-1`, against the full four-row baseline with a
recovery for every kind of unintended difference. Estimates, not limits:
about 1–2 and 4–6 credits, 5–8 together; the only hard bound is the balance
of 22. The other four of the owner's six are not ready (*Batch 1*, below).

**The look door's menu lane is merged, deployed and runtime-confirmed**
(`47dea9c0`, deploy 2168 with a second run of the same push, 2169,
2026-09-29 16:39 UTC, image `dd4f72842234135b` as predicted; the owner's free
press, run 62, read both at 16:57 UTC): the menu editor's lane now describes
the menu's items, shown only with supplied answers.

**Test 8 ran as run 63** (below), a menu item taken out and the Visit band
moved in one message, with real models: the router answered `nav` with
`remove` and held the band back (`alsoAsked`), so Gallery came out of every
menu exactly and the band was not moved; 4 credits. The look door was not
reached, so the real picker placing the menu change on the menu editor's lane
is still shown only with supplied answers. The free restore (run 64) put
`8btpep` back, checked. **The owner recorded run 63 as a partial outcome**
(the menu removal succeeded, the Visit move was deferred) and accepted run
64; the intended mixed-request acceptance remains open. **The router now
chooses one answer over the whole message, by what a route can make on every
page, never by kind** (the owner's correction of the first wording the same
day; merged and deployed in deploy 2170, `907840c6`, image
`abf47dfeceba3c5c` as predicted, runtime-confirmed by run 65): the acceptance
is prepared again, unchanged (*Test 8*, below). **Pressed again as run 66**
(21:56 UTC): the real router answered `look` with nothing held back; the look
door's picker placed the band on `shape` and the menu change on the menu
editor's lane (`action`); both changes were stored and published exactly as
expected, in one publish (`li1j0y`), for 6 credits. Every acceptance item is
met. The free restore (run 67, 22:23 UTC) put `8btpep` back, checked
(stored pages byte-identical to the fixture, markup and pixels identical to
the pre-test reading, no charge). **Closed by the owner** the same day, for
the exact combined request run 66 proved, with recovery verified by run 67.

**The redirect carry-over fix is merged and deployed** (`f5e941f4`, deploy
2165, 2026-09-28 19:07 UTC, image `8a10715339cdc780`; runtime-confirmed by
the owner's free press, run 51, at 22:57 UTC):
- a publish now carries the redirects the previous one stored, and a removed
  page gets its own 301 home;
- it is proven through the real edit route and dispatcher with supplied answers
  (4 cases), and run 52's publish kept the bakery's stored redirect live, read
  at once and ten minutes later;
- it preserves saved mappings from now on and reconstructs none.

**Proven live** (credited; not to be rerun)
- **Page edits.**
  - The quick writer: runs 9, 17 and 32.
  - The full writer: runs 11, 21, 24, 26, 34 and 37.
  - A component's wording and calculation: runs 21, 24 and 26.
  - A correct section removal let through by the text guard and the judge:
    run 34.
  - A photographed page keeping its photographs, with the kit-heading fix:
    run 37.
- **A logo from an attachment, a picture reframe and a page move** (39); the
  logo and the move were free.
- **Two changes in one message through the look door, one on a named page**
  (57): a site-wide description and a Visit-only move, with a publish
  keeping the stored redirects (52, 57) and a restore putting the saved
  description back (53, 58).
- **A photograph's element taken off one page and a band moved on another,
  in one message through the look door** (60), and restored free (61).
- **A menu item taken out and a band moved on another page, in one message,
  routed `look` by the real router** (66), and restored free (67).
- **One database row changed and put back** (42).
- **One database row changed on a site whose database link is blank**
  (71, Batch 1's B1; the put-back is the owner's own write).
- **One new entry added to a list the site already keeps** (88, Test 11):
  routed `addon` after the router fix, written by the add-on step's `row`
  kind, the six existing rows and every page unchanged. This is the saved-row
  outcome; it is not proof of the raw model's choice, which the route's
  reply cannot show (the router audit's R3). For the owner's review.
- **One database row deleted by a normal AI request**, on a site whose
  database link is blank (80), after the row check read the table whole
  and as named, live and free (79). Closed by the owner.
- **A removed page answering 301 home** (72, Batch 1's A2), read 14 and
  25 minutes after publication, not immediately, and the site restored
  exactly and free (75). Accepted by the owner with that limit.
- **A follow-up after a failure, from the same tab** (82): a data request
  that matched nothing, shown as a warning with its edit refunded and
  nothing changed, then a data edit sent from the same tab, never reloaded,
  that changed exactly one price. Closed by the owner, not to be repeated.
- **A rules closing enforced by the database** (44), for that closing only.
- **A menu link removed through the removal door with a real picker, then the
  page removed** (49).
- **Restoring a saved version**, including over a removed page (20, 22, 50).
- **Second messages from one tab** (39), and a second message sent only after
  the first's stored success (49).
- **The machinery around every edit** (runs 32–50): the queue and billing, the
  reply on screen, the after-read at the job's own version, and the money
  closing exactly.
- **Older code, path coverage only**: the look lanes, the menu, the site
  address and the text rung (2026-09-01 to 09-07).

**Outstanding acceptance** (not yet shown live; each has controlled tests)
1. **The redirect fix live**: the first half, a publish keeping a site's
   stored redirects, is credited (runs 52 and 57, closed with Test 6). A
   removed page answering 301 home is **accepted by the owner with Batch
   1's group A** (runs 72 and 75; read 14 and 25 minutes after
   publication, not immediately; no rerun for an immediate reading).
2. **A protection refusing a real model's answer**: the photograph wall, the
   link and component judge, the text guard, reply validation and the failure
   classification. Live, each has only let a correct answer through. Kept
   separate from the owner's remaining six (2026-09-29): live evidence of a
   guard rejecting an answer is recorded on its own, never substituted for the
   follow-up case.
3. **Two changes in one message**, which is two separate items:
   - **through the look door: closed with Test 6** (run 57; *Proven live*,
     above). The fix's withholding paths (a part put off, a scope that fails
     its check) are kept separate: shown only with supplied answers;
   - **through the removal door, with a real model**: a `nav` or `picture`
     removal given other work, where the picker is told the routed change and
     lists anything else separately. Only supplied answers have exercised it.
     Run 49's real picker was given no other work, and Test 6 did not reach
     this door. **No natural message reaches it with other work**: the
     router's instructions make several changes in one message one `look`
     answer, a menu link as much as a photograph (Test 7's *routing review*,
     below), so the door gets other work only if the router departs from
     them. Whether this needs a live test at all is the owner's call; none is
     proposed. Test 7 showed the customer capability through the look door
     (runs 60 and 61, closed by the owner).

   A second message after a hop or a failure is outstanding too: one of the
   owner's remaining six (2026-09-29). **The failure half is prepared as Test
   9** (2026-09-30, the owner's word; the UI scenario `9-follow-up`, below):
   a request that fails visibly, then a normal one from the same tab.
   **Closed by the owner** (run 82, 2026-09-30) for the demonstrated
   no-match failure followed by a successful edit in the same tab. A
   follow-up after a hop stays unprepared.
4. **A named page other than the home page** on a look edit: **closed with
   Test 6** (run 57): the picker scoped the move to `/visit`, and only
   `visit.tsx` changed.
5. **The data rung beyond one row**: adding, removing or reordering rows, and a
   site whose database link is blank. **The blank link is credited** (Batch
   1's B1, run 71); B2's put-back was misrouted `text` and is a finding, not
   a pass. **Removing is closed by the owner** (run 80, after the row
   check's first live run, 79; the data picker's delete instructions were
   corrected first, Lane 1a, deploy 2171). Adding goes to the add-on step
   (the owner, 2026-10-01), whose `row` kind is merged and deployed (deploy
   2175) and not yet shown live (*Test 11*).
   **Reordering is closed by the owner** (Test 10, run 84, 2026-10-01).
6. **The rules rung beyond one closing**: reopening, closing by taking write
   access away, limits, and any other wording or site.
7. **The picture swap**: a new photograph into a slot. Not ready: no natural
   message can hand the picture step a new photograph without buying one
   from fal (backlog).
8. **An older site's first schema change through a real form**: the
   column-scoped write grants (D2 and D3 are parked).
9. **A correct component from the original request on the first attempt** (B).
10. **What a real model decided where nothing records it**: why a quick attempt
    did not publish, the writer's prompt, and the judge's and the text guard's
    verdicts.
11. **Outside the edit path, listed so they are not lost**: the add-on through
    the browser since deploy 2154, and the photo add-on kind (fal funding).

**Closed by the owner on controlled tests, with no live run proposed**: the
stylesheet scope and rule keys (deploy 2161).

**Recorded separately** (each its own item, none part of any acceptance)
- **Redirects dropped between 2026-08-17 and deploy 2165**: not reconstructed.
- **A QR code that points at a removed page**: the removal does not see it.
- **The branded not-found page**: a Start site answers a bare "Not found".
- **Found while preparing Test 6** (read in the code, not driven live):
  - the header's button loses the kit's `data-slot="button"` marker on every
    page, so a stylesheet rule written against that marker never reaches it;
  - the render check judges each selector of a list on its own, so a rule
    naming elements a site doesn't render forces a correction round.
- **Found by Test 7's routing review** (read in the code, not driven live):
  - no look-door lane describes a menu item, so a menu link taken out beside
    another change depends on the picker stretching `action` or `behavior`
    (run 47's real picker named `behavior`, which did nothing). **Corrected
    2026-09-29, merged and deployed in deploy 2168 (`47dea9c0`, image
    `dd4f72842234135b`) and runtime-confirmed by run 62**: the menu editor's lane now
    describes the menu's items, and a scoped answer hands the menu editor only
    the menu's words; shown with supplied answers, sync and queued, and **live
    by Test 8's run 66**, where the real picker placed the menu change on
    that lane (`docs/history/2026-09-29-menu-lane.md`);
  - the photograph lane tells the picker a removal takes the slot away; the
    picture rung kept the slot, and the kit drew its placeholder there:
    **reproduced and rendered; corrected 2026-09-29 (`remove` takes the
    element off, `clear` keeps the space when asked), deployed in deploy 2167
    and runtime-confirmed by run 59; shown with real models by run 60 and
    closed with Test 7 by the owner** (*Test 7 → Implemented*, *Run 60* and
    *Closed*, below). What
    the targeted editor still cannot take off is refused and recorded as a
    capability limit (backlog).
- Also recorded:
  - the closed-bookings UX gap;
  - the three Test 4a findings;
  - the rules reply's literal asterisks;
  - a literal heading naming its whole section whether or not it renders;
  - a reply saying a second part was not done when it was (`alsoAsked`);
  - its mirror, found by run 52: a half the router put off (`alsoAsked`) is
    still attempted, on the home page, and the reply says both that the home
    page could not be changed and that the put-off change comes next (fixed
    2026-09-29 and deployed in 2166);
  - found by that fix: five stylesheet rules match nothing the app serves, and
    the reachability guard counts them live only through a router sentence's
    line break;
  - a multi-step look reply naming the look change and not a page change made
    beside it (review #9). Run 57's reply shows it live ("✅ Updated the look
    — the description."), judged separately from Test 6;
  - the build path's money sentences and the two refund policies.

Deferred by the owner: hydration (#418), translation, model-written replies,
and drafts surviving a refresh.

## The router audit (2026-10-02; corrected after the owner's review; decision reporting and the routing-only batch merged and deployed in deploy 2178; the batch not yet pressed; nothing spent)

The owner's order, once Test 11's result was verified: audit the router
before any broader test resumes. The audit is
[`router-audit.md`](router-audit.md). It covers the actual decision flow,
fourteen contradictions and gaps (R1–R14) with line references, and the
routing test.

- **Corrected to the owner's policy** (2026-10-02): *"all new additions belong
  to the add-on path, including new menu links, footer links and header
  buttons."*
  - Every addition's intended outcome is the add-on path.
  - The add-on step's missing capabilities are listed: a menu link, a footer
    link or detail, the header button, and one line on a page.
  - The test matrix separates intended behaviour, current implementation and
    observed model behaviour, and every predicted downstream consequence is
    marked unverified.
  - Test 11 (run 88) keeps its saved-row outcome and is no longer read as
    proof of the raw model's choice (the *Test 11* section below).
- **The most serious findings**:
  - R1: the router's `nav`, `picture` and `page` examples contradict the
    policy, and the add-on step lacks those kinds;
  - R2: the router is told to decide by attachments it is never told about,
    and only the logo step receives a file;
  - R3: seven unusable answers silently become a paid add-on.
- **Built for review** (no merge, deploy or spend):
  - **decision-source reporting**: the route's reply says `model`, `fallback`
    or `rule`, with 42 fixed reason codes, one per fallback and normalization
    branch;
  - **the routing-only batch mode**: one box naming a committed probe list;
    the batch's own runtime check before spending; a wall that makes an edit,
    an add-on, a build, a publish or a restore impossible.
  - **Checked**: 36 new tests (every code reached by its own branch; the
    real canary script driven end to end under the in-process stub); the
    red check (15 integration tests fail on the old Worker and canary, 35
    module tests pass); a sweep of 84 mutants, 82 killed and the two misses
    killed by two added cases, both controls surviving; the full suite
    `8579 / 8579 / 0 / 0`; required CI green on `1a8290e7` (unit
    36949313322 `8579 / 8575 / 0 / 4`; site build 36949313442, 404 checks
    in 27 sections). A merge would roll the image `9a71a6384b4206a2` →
    `a412daac10dbc936` (predicted). The record is
    `docs/history/2026-10-02-route-decision.md`.
- **The batch**: all 18 probes in one press (`router-audit-1`), about 36–54
  credits. It needed the merge and deploy of the decision report first,
  which is done (deploy 2178, below).
- **Your review of the batch** (2026-10-02): the decision report passed. Two
  batch defects were corrected before any merge, deploy or spend:
  - **C1 and C2's held-back part.** It used to match any nonempty text, so
    `addon` holding back the addition matched, and so did unrelated text.
    Each intended hold now names the part held back and the part its own
    route makes. The answer is read with the route's own locator
    (`heldBack`) over the probe's message, so the wrong clause, text not in
    the message, part of a clause, more than the other part, or the whole
    message differs;
  - **F1 is on the Visit page**, which shows one photograph (`d5d59152….jpg`)
    at `dgmag4`, from run 88's before-read and a fresh read. `/starter`
    shows none. The probe records this starting condition (`given`);
  - still 18 probes (sha256 `3296363a…d9d8c53b`). Checked: 24 batch tests;
    the red check (7 fail on the committed code, 4 with the old rule alone);
    a sweep of 26 mutants, with its 4 gaps closed; the full suite
    `8581 / 8581 / 0 / 0` locally (8,579 and the two new tests); unit CI
    36953647381 `8581 / 8577 / 0 / 4`, and the site build reused (same
    inputs fingerprint). The record is
    `docs/history/2026-10-02-route-decision.md` §7.
- **Merged and deployed in deploy 2178** (2026-10-02, on the owner's word
  *"merge and deploy and then i will run it"*): a fast-forward of 12
  commits, `25faac78` → `706c9b66`, at 02:18:36Z, with CI reused (unit
  36953951717 on `706c9b66`, `8581 / 8577 / 0 / 4`; the site build's
  inputs unchanged since run 36949313442). The image was built as predicted
  and rolled `9a71a6384b4206a2` → `a412daac10dbc936` at 02:22:23Z.
  **Deployed, not runtime-confirmed**: the batch's own press is the runtime
  check, not before 02:43 UTC. Before it: balance 96, ledger row 350, no
  job open; the bakery still at `dgmag4`, with `/visit`'s one photograph
  (02:30 UTC). `docs/deploy-record.md`.
- The broad plan below stays paused.

## Broad real-model batches — four chats through the normal app (proposed 2026-10-01 on the owner's word; paused by the owner the same day; nothing sent or spent)

**Paused by the owner (2026-10-01)**: *"Pause the broad test plan and
batch-runner work. Focus only on the routing issue from run 86."* The plan
below stays as written, for when the pause is lifted; nothing in it is
approved, and no batch runner is being built.

The owner asked for broad real-model testing in a few substantial requests:
- through the normal app, with the builder choosing its own routes;
- each instruction verified independently against the pages, the data and
  the behaviour;
- closed tests not repeated as their own projects, and Test 11's addition
  carried in with its own acceptance;
- follow-ups in the same chat, judged apart from the first messages.

This section is the plan for approval: the exact messages, the attachments
and fixtures, the checks, and the cost.

### Before any message

- **No approved deployment is pending.** Deploy 2176 (`78a95a47`) is done
  and was runtime-confirmed by run 85.
- **Message 1.1 needs the router fix** (`710ad704`; *Test 11 → The router
  fix*). It is on the branch with required CI green (unit 36914783961,
  `8543 / 8539 / 0 / 4`; site build 36914784000), and not merged.
  - Without it, run 86's real router answered `edit`/`data` for an added
    loaf.
  - Merging is a fast-forward: `main` is the branch's ancestor, and
    everything after `710ad704` is documents, so its CI stands.
  - The image would roll `c051f625db27b5b7` → `9a71a6384b4206a2`. A 15–20
    minute wait and one free runtime check (your press) follow.
- **Balance 101**: the ledger's last row is 349, and no job is open (read
  after run 86's top-up).

### How the messages are sent

- **Recommended: you type them in the real app** (gofarther.dev, signed in
  as the building account).
  - One chat per site below, one message at a time, each sent after the
    previous reply.
  - Nothing gates or forces a route: whatever the builder answers is what
    runs.
- **I verify each one independently, free**:
  - the jobs, their stored replies and charges (Supabase, non-secret
    columns only);
  - the published pages, heads, redirects and assets;
  - the public data reads;
  - Playwright as a visitor, at desktop and phone width (390 × 844).
  - A free canary inventory (your press, spend `no`) reads the stored pages
    and the tables a visitor cannot.
- **Why not the existing tools**:
  - the canary's API mode sends one message per press, and posts an add-on
    answer only when its route box expects one;
  - its UI mode runs only named scenarios and blocks add-ons and builds;
  - no workflow builds through the router.

  So they would gate routes, and none can carry a chat.
- **Alternative, only on your word**: a canary batch runner (one tab, a list
  of messages, attachments, a phone viewport, posting whatever the router
  answers). It is new harness work with its own tests, and not started.
- **Two rounds.**
  1. Round 1: every first message, chats 1–4. I verify and report.
  2. Round 2: the follow-ups in the same chats, and the visitor flows. I
     verify and report.
- **How the money is read**: routing writes no ledger row, so routing is
  measured as a total per round (the balance before and after, less the
  jobs' ledger rows). Each job's charge is its own row.

### The app's limits, respected

- **Length**: every message is under 2,000 characters. That is the
  composer's cut, and it applies to a first build's brief too (`siteSend`
  in `public/chat.js` cuts every message at 2,000; the server's 4,000 is not
  reachable from the composer).
- **Look lanes**: one message runs at most 4. Message 1.3 is written for
  four: the stylesheet, the tab icon, the menu and button, and the page's
  shape.
- **New entries**: they go alone, because `row` beside other kinds is set
  aside. Message 1.1 asks for nothing else, with three entries (at most 12).
- **Add-ons**: at most 10 kinds and no attachment. Message 1.4 asks for
  seven things.
- **Attachments**: at most 3 a message, images up to 5 MB, PDFs up to
  3.5 MB.
  - An edit takes an image only for the logo; message 1.7 tests what
    happens otherwise.
  - Links are read only on a build; message 1.8 tests what happens
    otherwise.

### Attachments

In `docs/test-fixtures/broad-batches/`, made free with Chromium.

| file | for | bytes | sha256 | what it holds |
|---|---|---|---|---|
| `lune-yoga-logo.png` | 3.1 | 9,545 | `2a7a014a19ccc8a3…` | a crescent mark, "LUNE YOGA", 512 × 512 |
| `lune-yoga-timetable.pdf` | 3.1 | 31,610 | `83257638e71c1061…` | 8 weekly classes, 3 teachers, 3 prices, capacity 12, the 2-hour rule |
| `kiln-coffee-logo.png` | 4.1 | 6,760 | `a9056d782c55730c…` | a kiln-and-flame mark, "KILN COFFEE", 512 × 512 |
| `kiln-coffee-price-list.pdf` | 4.1 | 29,569 | `891f9f855bbf8212…` | 14 coffees (3 light, 7 medium, 4 dark); Rwanda Huye stock 0; Costa Rica Tarrazú stock 3; delivery £3.95, free over £30 |
| `harbour-loaf-window.jpg` | 1.7 (and 1.F5 if needed) | 52,603 | `47f45273f956cd73…` | a drawing of the bakery's window, 1600 × 1066 |

### What you provide

1. **Your word to merge `710ad704` and deploy**, for message 1.1.
2. **A top-up**: the estimate is 135–330 credits against 101 (*Cost*,
   below).
3. **Chat 3: two member accounts** on addresses whose mail you read
   (plus-addresses of your own mailbox work).
   - You sign up, sign in, sign out and reset on your phone; I hand you the
     steps and verify from the site and a free inventory.
   - Or say if I should use a throwaway inbox service instead.
4. **Chat 4: a Stripe test key**, entered by you in Kiln Coffee's secrets
   after the build (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). I never
   read either. Without them the checkout is recorded as blocked, and the
   rest runs.
5. **Approval for the visitor writes** listed under each chat. All of them
   stay as demo data.
6. **fal**: the two builds may buy photographs if fal has a balance. I read
   it before and after; say "no photos" if you want none bought.

### Chat 1 — `fold-lane-bakery` (at `dgmag4`; every intended change stays)

**1.1 — three new loaves, carrying Test 11** (271 characters)
```text
Add three loaves to today's loaves: Rye & Caraway at £5.00, described as "A light rye with toasted caraway."; Spelt Sourdough at £5.60, described as "Nutty spelt with a long, slow rise."; and Cinnamon Knot at £3.20, described as "A sweet twisted bun with cinnamon sugar."
```
- **Expected**: `addon`, the `row` kind, nothing held back. The route is
  observed, never gated.
- **Test 11's own acceptance (Rye & Caraway)**:
  - exactly that row: name, price 5, the description, photo null, and the id
    the database gives it;
  - on `/order` in price order, and an order-form choice carrying its id;
  - the reply names it.
  - **Any route other than `addon` fails Test 11 on routing**, whatever
    else happens.
- **Also**:
  - Spelt Sourdough (5.6) and Cinnamon Knot (3.2) exact;
  - the six existing rows unchanged;
  - no page changed and nothing published;
  - `/order` lists nine, Cinnamon Knot (£3.20) first and Rye & Caraway
    fourth;
  - the reply names all three.
- **Estimate**: 3–6 credits.

**1.2 — two prices or descriptions changed, one loaf taken off** (251)
```text
Update today's loaves: Dark Rye is now £5.40 and its description should read "Dense, malty rye with a dark crust."; change Walnut Levain's description to "Toasted walnuts folded through a long-fermented dough."; and take Olive & Rosemary off the list.
```
- **Expected**: `edit`, `data`.
- Dark Rye (id 2): price 5.4 and the new description.
- Walnut Levain (id 5): the new description; price still 6.
- Olive & Rosemary (id 4): gone.
- Every other row unchanged; nothing published; `/order` lists eight in
  price order.
- The reply matches each change, or names what it did not do.
- **Estimate**: 2–5.

**1.3 — the look, one button, the menu, a section** (470)
```text
Give the whole site a warmer look: a cream background, dark brown text, and deep green for buttons and links, with a serif typeface for headings. Make all the Order a loaf buttons fully rounded pills, and change the one in the header to read "Order for collection". Change the tab icon to a simple wheat sheaf. Take The starter out of the menu but keep its page. On the home page, move the "Order a loaf for collection" section above "Fed every morning since we opened".
```
- **Expected**: `edit`, `look`, nothing held back.
- **On every page** (computed styles): a cream background, dark brown text,
  deep green buttons and links, and serif headings.
- **The buttons**: the Order a loaf buttons fully rounded; the header's
  reads "Order for collection" and still goes to `/order`.
- **The tab icon**: a wheat sheaf (the served icon changes).
- **The menu**: The starter gone from every menu; `/starter` still answers
  200, and `/the-starter` still 301.
- **The home page**: "Order a loaf for collection" above "Fed every morning
  since we opened", with nothing else moved.
- **Unchanged**: words, data, photos, and every other piece of content.
- **The reply** names each change. A reply naming only the look is review #9
  (recorded already, not new).
- **Estimate**: 6–14.

**1.4 — seven new things** (900)
```text
Please add these to the site: 1) a new FAQ page, linked in the menu, answering five questions: how to order (online, for collection), when to collect (08:00 to 13:00), allergens (we bake with wheat, rye, spelt, sesame and walnuts, so nothing is free of them), how to pay (card or cash when you collect), and what our starter is (fed every morning since we opened); 2) a QR code on the Visit page that opens the order page; 3) on the order page, above today's loaves, a search box and an "Under £5" filter, showing six loaves at a time with Next and Previous buttons; 4) on the order page, a small calculator where a customer picks loaves and quantities and sees the total price; 5) a slowly turning 3D loaf at the top of the Gallery page; 6) a "Call the bakery" button on the Visit page that rings 0117 496 0000 when tapped; 7) today's loaves with their prices on the home page and on the Visit page.
```
- **Expected**: `addon`, with the kinds the builder picks (likely a page, a
  QR code, components and a 3D scene).
- **`/faq`**: in the menu, five answers carrying the facts given, its own
  title.
- **`/visit`**: a QR code that decodes to the order page, and "Call the
  bakery" linking `tel:` to 0117 496 0000.
- **`/order`**:
  - search: "rye" finds Rye & Caraway and Dark Rye;
  - "Under £5": Cinnamon Knot, Sea Salt Focaccia, Country White;
  - six at a time with Next and Previous: eight loaves make 6 + 2;
  - the order form still offers every loaf;
  - the calculator: 2 × Country White + 1 × Dark Rye = £15.00, at 1.2's
    prices.
- **`/gallery`**: a turning 3D loaf, no console errors, the photographs
  kept.
- **`/` and `/visit`**: today's loaves with their prices.
- **Unchanged**: every row, and unrelated content.
- **The reply** names what was added and anything set aside.
- **Estimate**: 12–30.

**1.5 — a sort on two chosen pages** (135)

This is the case Test 10 left open: a sort limited to a selection of pages,
unproven with real models.
```text
On the home page and the Visit page, list the loaves in alphabetical order. Keep the order page sorted from cheapest to most expensive.
```
- **Expected**: whatever the builder picks. A selection of pages is never
  the data sorter.
- `/` and `/visit` list the loaves A–Z, Cinnamon Knot to Walnut Levain.
- `/order` is still cheapest first.
- No row written.
- **Estimate**: 4–12.

**1.6 — a mixed message: a price and a new page** (138)
```text
Seeded Wholemeal is now £5.60. Also, please add a Gift vouchers page offering £10, £25 and £50 vouchers, bought and collected in the shop.
```
- **Expected**: one answer. Either both parts are done, or one is done and
  the other held back and named.
- **If done**: Seeded Wholemeal (id 3) at 5.6; `/gift-vouchers` offering
  £10, £25 and £50, bought and collected in the shop, in the menu.
- **What was not done** is named, not claimed. Nothing else changed.
- **Estimate**: 3–12.

**1.7 — an attached photo for a page's picture** (97; attach
`harbour-loaf-window.jpg`)
```text
Please use the attached photo as the main picture on the Visit page, in place of the current one.
```
- **Expected**: unsupported, because an edit takes an image only for the
  logo.
- **Pass**: a clear refusal or question, nothing changed, and no claim that
  the photo was used.
- If the Visit picture does become the attachment, it is recorded as a new
  capability.
- **Estimate**: 1–4.

**1.8 — a link in an edit, and the unfinished page** (310)
```text
Please finish The starter page: explain what a sourdough starter is and give a short history of sourdough, based on https://en.wikipedia.org/wiki/Sourdough and written in our own words; say that ours has been fed every morning since we opened; and give the page its own tab title, "The starter — Harbour Loaf".
```
- **Expected**: `edit`, most likely the page writer. The link is not read on
  an edit.
- `/starter` no longer says "This page isn't finished yet". It explains a
  starter, gives a short history, and says ours is fed every morning.
- Its tab title is "The starter — Harbour Loaf" (today it is "Harbour
  Loaf").
- The other pages are unchanged.
- **The reply must not claim it read the link.**
- **Estimate**: 8–24.

**Round 2: follow-ups in the same chat**, each judged apart from the first
messages.

- **1.F1, a reference to the chat** (43):
  ```text
  Make the last loaf you added £3.50 instead.
  ```
  - Expected: unsupported. The router and the steps see no chat history.
  - Pass: Cinnamon Knot at 3.5 and nothing else, or an honest question.
  - Fail: another row changed, or a claim without a change.
- **1.F2, "the same style"** (96):
  ```text
  Make the Call the bakery button the same style as the Order for collection button in the header.
  ```
  - Pass: the two buttons' computed styles match, and nothing else changed.
  - If 1.3 or 1.4 did not make either button, the wording is adjusted then
    and shown to you before you send it.
- **1.F3, a correction** (59):
  ```text
  Sorry, I got Dark Rye wrong: it should be £5.30, not £5.40.
  ```
  - Pass: Dark Rye at 5.3, and nothing else.
- **1.F4, completion after a hand-off**, sent only if 1.6 held a part back
  (49):
  ```text
  Yes, please go ahead with the part you held back.
  ```
  - Pass: that part done as asked, or an honest reply that it cannot see
    it.
- **1.F5, completion after a failure.**
  - Written from the builder's own reply to whichever first message failed,
    and shown to you before you send it.
  - If 1.7 was refused: attach the same photo, with *"Then use the attached
    photo as our logo instead."* The logo path is proven (run 39); here it
    is only the completion.
- **Estimate**: 8–25 for the five.

### Chat 2 — `repairbench-1` ("Hebden Bike Repair": the backend)

Its home page already has a "Book a repair" form (name, bike, drop-off day)
writing to `bookings`, open Tuesday to Saturday. No existing table gains a
column here: that is the parked schema-change item (D2).

**2.1 — a quote form with a photo** (357)
```text
Please add a Get a quote page, linked in the menu, with a form asking for the customer's name, email, phone, bike type (road, mountain, hybrid or e-bike), what is wrong (at least 20 characters) and an optional photo of the bike. Save each request with the status "new", and email us when one arrives. Visitors can send a request but never see anyone else's.
```
- **Expected**: `addon` (a table, a page, a form with an upload, a
  notification).
- The page in the menu, with the fields asked for.
- The email format, the 20-character minimum and the bike types enforced by
  the page and by the database.
- The optional photo stored as an upload; the status "new".
- A visitor can send a request but cannot read any.
- The existing pages, tables, functions and both jobs unchanged.
- **The email**: no mail key is set, so the reply should name it as your
  step, and the form should still save.
- **Visitor writes**: one valid request with a photo; three invalid ones,
  each expected refused, with no row.
- **Estimate**: 8–20.

**2.2 — a daily limit on the existing booking form** (227)
```text
We take at most five drop-offs a day. On the Book a repair form, show how many places are left for the chosen day, refuse a booking once that day has five, and only accept days from Tuesday to Saturday that are not in the past.
```
- **Expected**: whatever the builder picks (rules, a function, the page).
- The form shows the places left for a chosen day.
- Sundays, Mondays and past days refused.
- A sixth booking for one day refused by the database, not only by the page.
- The three existing bookings unchanged.
- **Visitor writes**: five bookings for Tuesday 27 October, then a sixth
  (expected refused); one for a Monday (expected refused).
- **Estimate**: 4–12.

**2.3 — a morning job, and a keyed weather panel without its key**
(279)
```text
Every Tuesday to Saturday at 07:30 UK time, count that day's drop-offs and save the number, and show this morning's count on the Workshop Load page. Also add a panel to the home page showing today's weather forecast for Hebden Bridge from OpenWeather; I'll add the API key later.
```
- **Expected**: `addon` (a job, an outside connection, a panel).
- **The job**: registered for Tuesday to Saturday at 07:30 Europe/London.
  **Its first automatic run is read on the next such morning** (Friday 2
  October at 06:30 UTC, if sent tonight). A job running on its own tick has
  never been shown live. The count appears on `/workshop-load`.
- **The weather panel without a key**: an understandable message on the
  page, not a blank or a raw error. The reply names the missing OpenWeather
  key as your step.
- **Left alone**: the one-time job `count_bookings_once` (3 October, 09:00).
  "Run now" is never pressed.
- **Estimate**: 6–15.

**2.F1 — a correction** (52)
```text
Actually, we can take six drop-offs a day, not five.
```
- The limit reads six; the day with five shows one place left; a sixth
  booking for it is accepted (one visitor write).
- **Estimate**: 2–8.

### Chat 3 — a first build: Lune Yoga (a new slug; members, bookings, time zones)

**3.1 — the brief** (1,092; attach `lune-yoga-logo.png` and
`lune-yoga-timetable.pdf`)
```text
Build a website for Lune Yoga, a small yoga studio at Unit 3, Lantern Yard, Bristol. Use the attached logo, and take the weekly timetable, teachers and prices from the attached PDF. Write the Hatha and Vinyasa class descriptions from https://en.wikipedia.org/wiki/Hatha_yoga and https://en.wikipedia.org/wiki/Vinyasa, in our own words.

Members make an account with their email: sign up, sign in, sign out, and reset a forgotten password. A signed-in member can book a place in a class, see their own upcoming bookings, cancel one, or move it to another class, up to 2 hours before it starts. Each class holds at most 12 people; when one is full, booking is refused and it shows "Full". Members never see other members' bookings. Members can add a profile photo.

I am the admin: I add, edit and cancel classes, and see every booking with the member's name.

Show all times in UK time, correctly on both sides of the clock change on 25 October.

Pages: Home, Timetable (filter by day and by class type), My bookings, Account, and Admin. Calm and simple: off-white, deep blue, plenty of space.
```
- **The build**:
  - a new slug, with no live site revised (`lune-yoga` answers 404 today);
  - the logo in the header;
  - the eight classes, teachers, lengths and three prices exactly as in the
    PDF;
  - the Hatha and Vinyasa descriptions drawn from the two links, in its own
    words;
  - the pages asked for, each opening by direct link;
  - titles, a description, a share image and a tab icon.
- **Members** (you, two accounts):
  - sign up, sign in, sign out, and reset by email;
  - a member books, sees their own bookings, cancels one and moves one;
  - the other member cannot see them;
  - nothing can be cancelled or moved inside 2 hours.
- **Capacity**: the 13th booking refused and "Full" shown. It is tried on a
  class you set to capacity 1 as admin, if the admin page allows; otherwise
  it is recorded as not exercised.
- **Times**: in UK time, on both sides of 25 October.
- **The admin**: sees every booking with names, and edits classes.
- **Uploads**: a profile photo, for its own member only.
- **Persistence**: after a reload and in a new session.
- **Phone width**: the menu, forms, dialogs and buttons work.
- **Estimate**: 25–45.

**3.F1 — reminders and a waiting list** (206)
```text
Please email each member a reminder at 18:00 UK time the evening before their class, and add a waiting list: when someone cancels a place in a full class, give it to the first person waiting and email them.
```
- The job at 18:00 Europe/London.
- The waiting list gives a freed place to the first member waiting
  (exercised with the two accounts).
- Mail without a key is named as your step.
- **Estimate**: 8–20.

**3.F2 — "the same style", and "that" filter** (112)
```text
Make the Book buttons the same style as the Sign up button, and put that class-type filter on the home page too.
```
- The computed styles match, and the class-type filter works on `/`.
- **Estimate**: 2–10.

### Chat 4 — a first build: Kiln Coffee (shop, stock, checkout, two languages)

**4.1 — the brief** (1,247; attach `kiln-coffee-logo.png` and
`kiln-coffee-price-list.pdf`)
```text
Build an online shop for Kiln Coffee, a small coffee roaster in Leeds. Use the attached logo, and take the coffees, origins, roasts, tasting notes, prices and stock from the attached price list (14 coffees).

The shop lists the coffees with a search box, filters by roast (light, medium, dark) and by origin, and shows 6 coffees per page with page numbers. Each coffee has its own page with its own link. Customers add coffees to a basket, change quantities, and see each line's total, the subtotal, delivery (£3.95, free on orders over £30) and the total. Nobody can order more bags than we have in stock, and a coffee with no stock shows "Sold out".

Checkout takes card payment with Stripe. After paying, the customer sees an order confirmation with an order number and what they bought. Each order is saved with its items, total and a status (paid, roasted, shipped), and stock goes down by the bags bought. I am the admin: I see every order, change its status, and update stock and prices.

Pages: Shop, a page for each coffee, Basket, Checkout, Order confirmation, Admin, and About. Warm and modern: cream, charcoal and a copper accent. Make the site available in English and Welsh, with the coffee names and prices exactly the same in both.
```
- **The catalogue**:
  - the 14 coffees exactly as in the PDF;
  - search: "Colombia" finds 3 (Colombia Huila, Kiln House Espresso, Night
    Shift Decaf);
  - filters: light 3, medium 7, dark 4;
  - 6 a page, so 3 pages;
  - a page per coffee, opening by direct link;
  - Rwanda Huye "Sold out", and 4 bags of Costa Rica Tarrazú refused (stock
    3).
- **The basket**: 2 × Colombia Huila + 1 × Kenya Nyeri AA = £27.50, plus
  £3.95 delivery = £31.45. Adding Brazil Cerrado makes £35.00, with free
  delivery.
- **The checkout, with your test key**:
  - the test card 4242 4242 4242 4242 pays;
  - a confirmation with an order number and the items;
  - the order saved as paid, with its items and total;
  - stock down by the bags bought.
  - Without the key: an understandable message, and no order marked paid.
- **The admin**: changes a status and a stock figure.
- **English and Welsh**: the same names and prices, with the basket and the
  checkout working in Welsh. **You deferred translation, and the translator
  is parked.** The sentence is in because you listed multilingual work; say
  if it stays out, and it comes out.
- **Also**: titles, a description, a share image and a tab icon;
  persistence; phone width.
- **Visitor writes**: one or two test-mode orders.
- **Estimate**: 25–45.

**4.F1 — gift wrap, and a coffee of the month** (127)
```text
Add a gift wrap option at checkout for £2.50, and feature the Ethiopia Yirgacheffe on the home page as our coffee of the month.
```
- £2.50 added once to the total.
- Ethiopia Yirgacheffe featured on `/`, linking to its page.
- **Estimate**: 6–15.

**4.F2 — a correction by reference** (86)
```text
That free-delivery threshold is wrong: make delivery free on orders over £35, not £30.
```
- The £31.45 basket now pays delivery; £35 and over is free; in both
  languages.
- **Estimate**: 2–8.

### For every message

- **The route** the builder chose, and anything held back (the job's
  record).
- **What each operation did**: the stored source, the rows, the publishes.
- **The reply**, checked against that, and each part classed as completed,
  failed, ignored, deferred or unsupported.
- **Unrelated content**, compared with the before-read.
- **The money**: the ledger's job rows, the balance, and no job open.

**Not used:**
- `lido-axes-b`: its bookings stay closed, and it is kept byte for byte;
- `fretwork-1`: its blank link and the parked translator;
- D2 and D3: no order on the bakery, and no grants apply;
- repairbench's one-time job.

**Closed tests** (Tests 2–10, D1, the run-44 rules closing, the deletion,
and Batch 1's A and B1) are not repeated as their own tests. Where a closed
capability sits inside a bigger message (a menu link, a section move), it is
there only as part of the mix.

### Cost (estimates, not limits)

| chat | messages | credits |
|---|---|---|
| 1 — the bakery | 8, then up to 5 follow-ups | 47–132 |
| 2 — repairbench | 3, then 1 | 20–55 |
| 3 — Lune Yoga | a build, then 2 | 35–75 |
| 4 — Kiln Coffee | a build, then 2 | 33–68 |
| **all four** | **22** | **135–330** (about $1.08–2.64) |

- Routing (1–2 a message) is included.
- Nothing caps a request: the balance is the only bound.
- At 101, chats 1 and 2 may fit. Chats 3 and 4 need a top-up of about 230
  to cover the high ends.
- fal purchases are not included.

### The order

1. **Your approval**: the messages, the merge, the top-up, the fixtures and
   the visitor writes.
2. **I fast-forward `main`** to the branch and read the deploy. After the
   image rolls and 15–20 minutes, you press one free runtime check.
3. **I take the before-reads** (free).
4. **Round 1**: you send the first messages of chats 1–4. I verify and
   report.
5. **Round 2**: the follow-ups and the visitor flows (yours on the phone for
   the members; mine as a visitor elsewhere). I verify and report.
6. **Records**: this section, a dated history file and the owner-notes
   handoff; commit and push.

## Batch 1 — a removed page's 301 home, and a row changed on a site whose database link is blank, run side by side (proposed 2026-09-29 after Test 8's closure; corrected after the owner's review: the canary now enforces each press's expected route, the costs keep estimates apart from enforced limits, group B's recovery covers every row and field, and the remaining six are the owner's list; approved 2026-09-30; Round 1 done: A1's free restore (run 68) checked, and B1 (run 71, after runs 69 and 70 went nowhere) changed exactly row 4's price for 3 credits; A2 (run 72) removed `/gallery`, which answers 301 home, read twice, for 2 credits; run 73 (A3) never started, and run 74 (B2) was refused by the route check when the router answered `text`, for 2 credits and no change; A3 (run 75) restored `8btpep` exactly, free; the owner accepted group A (the redirects read 14 and 25 minutes after publication, not immediately) and credited B1; B2's misroute kept as a separate finding, not counted as passed nor retried with a model; row 4 left for the owner's free write)

The owner asked for the next bounded batch: up to three independent
acceptance groups from the remaining six, on existing ready fixtures and
workflows, preferring checks that can genuinely overlap, and not forcing three
when only two are ready. **Two are ready.** Nothing was spent, no live fixture
or row was changed, and nothing was merged or deployed while preparing it.

### The owner's review, and what it changed (2026-09-29)

1. **The plain canary did not enforce the routes this plan claimed.** It
   refused only an answer that was not an edit or named no layer, then posted
   whatever the router said. Corrected by the smallest generic, opt-in check
   (*The expected-route check*, below): A's press requires the page removal of
   `/gallery` and B's presses the data route, each with nothing held back.
2. **The cost claims.** Estimates are now kept apart from what is enforced.
   "10 at worst" and "the balance can't run dry" are withdrawn: nothing
   enforced either (*Cost*, below).
3. **Group B's recovery.** Setting row 4's price back cannot repair another
   row or field. The four-row baseline is now recorded in full, with a
   recovery for each kind of unintended difference. A saved page version
   restores no database row.
4. **The remaining six are the owner's list**, below. A protection refusing a
   real model's answer is kept separate, not counted among the six.

### The remaining six (the owner's list), and which are ready

| # | Item | Ready? | Why |
|---|---|---|---|
| 1 | Redirect home: a removed page answers 301 home (item 1's open half) | **Yes: group A** | Saved version `t5obxx` (run 63's publish) is the fixture with only the Gallery menu links taken out. There, no page but the gallery's own file names `"/gallery"`, so "Remove the gallery page." passes the link rule, and the restore mode reaches the version for free. |
| 2 | The data rung: adding, deleting and reordering rows, and a missing (blank) database reference (item 5) | **Only the missing reference: group B** | `fretwork-1`'s database reference is blank, and its `lessons` table is public with 4 rows. **Adding** needs the owner's ruling on which step adds a row to a list the site has: the router follows "Add will always go in addon", while the data picker can insert. **Deleting**: the data picker is told both to delete a row and to return nothing when asked to delete, so a live delete is likely refused until that sentence is corrected. **Reordering**: the router says nothing about a list's order, and a misroute to the page writer costs 6–22; only the bakery can take it (a publish on `fretwork-1` reaches the parked translator, and `lido-axes-b` has no saved versions), which clashes with group A. All three are in the backlog. |
| 3 | Broader rules (item 6) | No | Its one fixture's bookings stay closed (`lido-axes-b`), and reopening them is the natural next case. The bakery's orders are D2 and D3 (parked), and the rules harness is wired to `lido-axes-b`. A new fixture is the owner's decision. |
| 4 | Picture replacement (item 7) | No | An attached photograph reaches only the logo step. The picker is shown bare file names, never which file fills which slot. Its one other source, `describe`, buys a fal photograph (about 18.75 credits) whenever the balance affords one, which it does at 22. Needs product work first (backlog). |
| 5 | A correct component on the first attempt (item 9) | No | No fixture has a component, and a component request is an add-on (2–13) or a page rewrite (6–22) with an outcome nobody can fix in advance. |
| 6 | A follow-up message after a failure or an escalation (item 3's second half) | No | It needs a second message in the same browser session after a classified failure or hop. Only the canary's UI mode sends a second message from one tab, and no scenario for this exists: a scripts change and a deliberate first-message failure, both the owner's decision. |

**Kept separate, not one of the six**: a protection refusing a real model's
answer (item 2). Live evidence of a guard rejecting an answer is recorded on
its own if a run produces it, and is never substituted for the follow-up case.

**Group B covers only part of the data item**: the missing reference.
Adding, deleting and reordering rows stay open.

### The expected-route check (built for this batch, on the branch; not merged)

- **A new box on the edit canary**, "Refuse to post the paid edit unless the
  router answers this…" (`expect_route`, passed as `CANARY_EXPECT_ROUTE`),
  read by `scripts/canary-route.mjs`.
- **Its form**: space-separated `key=value` over the router's own fields:
  - `intent` and `layer`, checked against the router's own lists;
  - `page` and `rename`, each a path or `none`;
  - `remove` and `tab`, each `true` or `false`, where absent reads as false,
    as the edit POST reads it;
  - `alsoAsked=none`, meaning nothing held back.

  Only the fields named are judged. Nothing in it knows a site, a page or a
  sentence.
- **Read whole before the sign-in.** A malformed box refuses at no cost
  (exit 2), and so does a filled box beside a read, a restore or a scenario,
  which make no routing call of the script's own.
- **On a paid press:**
  - the router's answer is written to `routing.json` the moment it arrives.
    It used to be written after the watch, so a refusal kept no record of the
    answer it refused.
  - a mismatch is refused above the edit POST: the routing call is spent and
    nothing else is.
  - a match is posted exactly as it came, because the POST body never reads
    the expectation.
- **Cannot-tell is a mismatch.** A flag that is not a boolean, or a path that
  is not a string, is reported as unreadable and never coerced.
- **Verification**:
  - **Tests**: 5 cases in `test/canary-route.test.mjs`, where the verdict is
    judged on the Worker's own `/api/site/route` replies to supplied router
    answers: A's removal, run 63's `nav` answer, a gallery edit without a
    removal, another page removed, a move, a part held back, the add-on step,
    B's data answer, data with a part held back, text and look. Plus 4
    source-order guards in `test/edit-canary.test.mjs`. The stale ten-input
    cap in `test/canary-ui.test.mjs` is now 25: GitHub's changelog of
    2025-12-04, and `lane-sweep.yml`'s 11-input form dispatched four times
    since 2026-09-16.
  - **Red check on `da24ce1b`**: the new test file fails, and 3 of the 4 new
    guards fail. The fourth guards the pass-through and passes on both trees.
  - **The real script, driven under an in-process network stub** (no request
    can leave the machine), with router answers taken from the Worker's own
    route. There were 11 scenarios:
    - each mismatch (run 63's answer, the edit without a removal, data with a
      part held back, the add-on step) wrote `routing.json` with its verdict,
      exited 1 and never reached the edit POST;
    - each match posted a body identical, apart from the random retry key, to
      the same answer's run with no expectation;
    - a malformed box and a box beside a restore exited 2 with no network call
      at all;
    - a free run routed nothing.

    **On `da24ce1b` the same stub showed the defect**: every mismatch, and even
    the malformed box, reached the edit POST.
  - **Mutation sweep** (`scripts/mutants/canary-expect-route.json`): 29 mutants
    and 2 comment-only controls, against the two test files. The first pass
    killed 28 of 29. The survivor was real: an unknown key whose value was a
    path or `none` would pass, because the test's `colour=red` was refused
    only by the later path check. The test now requires that refusal for such
    values, and the second pass killed 29 of 29; both controls survived.
  - **Full suite**: `8306 / 8306 / 0 / 0` locally (8,297 before, plus the 9 new
    cases), and `8306 / 8302 / 0 / 4` on CI (unit tests run 36648622383 on
    `b87430c7`; CI skips the usual four).

### Group A — a removed page answers 301 home (item 1's open half)

- **The gap.** Keeping stored redirects across a publish is credited (runs 52
  and 57). A removed page answering 301 home has never been seen live: run
  49's redirect check failed on the publish defect fixed in deploy 2165, and
  no page has been removed since.
- **Target**: `fold-lane-bakery`, from saved version `01790701419976-t5obxx`
  back to `01790468089054-8btpep`.
  - `t5obxx` is run 63's publish: `8btpep` with the Gallery link out of the
    menus and nothing else changed. Its pages, in characters and sha256:
    - `index.tsx` 2,378, `637b7793…`
    - `order.tsx` 9,241, `0a0b5f41…`
    - `starter.tsx` 951, `37fb0e17…`
    - `visit.tsx` 4,028, `ddd1fe39…`
    - `gallery.tsx` 2,946, `da53a375…`
  - Run 63 read `/the-starter` → 301 `/starter` at `t5obxx`.
  - Read from run 63's stored source: no page but `gallery.tsx` names
    `"/gallery"`. `visit.tsx` draws the QR code through `SITE_QRS.gallery`,
    which the removal rule does not read (backlog).
- **Control**: `washhouse-3`.
- **Deployment**: 2170, `907840c67497b2624f1a2febfdb27b947ca5222a`, image
  `abf47dfeceba3c5c`, runtime-confirmed by run 65. `main` has not moved since.
  The presses run the canary from the branch, against main's Worker.
- **Request**: `Remove the gallery page.` (24 characters, sha256
  `ee4c723ee681dfb2…`). It is the sentence run 49 sent as Test 5's second
  message. This group judges the address; the removal itself stays closed
  with Test 5.
- **Expected route, enforced**:
  `intent=edit layer=page page=/gallery remove=true alsoAsked=none`.
- **Before** (read 2026-09-29 23:20 UTC at `8btpep`, redirects not followed):
  - `/gallery`, `/gallery?ref=menu&x=1` and `/gallery/` answer 200;
  - `/the-starter` answers 301 → `/starter` with `public, max-age=600`, with
    the query kept and the trailing slash too;
  - `/nonexistent-page` answers 404;
  - the sitemap lists five pages.
- **Steps, one after another**:
  1. **Free: restore `t5obxx`.** Pass:
     - the canary reports RESTORED at `t5obxx`;
     - its restored source equals run 63's (the hashes above);
     - `/gallery` answers 200 at `t5obxx`;
     - `/the-starter` answers 301 → `/starter`.
  2. **Paid: the request, with the expected route.** Pass:
     1. `request.json` carries the sentence (sha256 above).
     2. `routing.json` carries the router's answer and a verdict that
        matches: `edit`, layer `page`, page `/gallery`, `remove: true`,
        nothing held back.
     3. The job removes `gallery.tsx` and nothing else: the other four stored
        pages are byte-identical to `t5obxx`'s. Billing is `exempt`, cost 0,
        with one publish built from `t5obxx`.
     4. Read by me, free, without following redirects, at once and again at
        least ten minutes after the publish (the canary's own after-read
        follows redirects and reads only the new sitemap's pages):
        - `/gallery` → 301 to `https://fold-lane-bakery.gofarther.app/`, with
          `cache-control: public, max-age=600`;
        - `/gallery?ref=menu&x=1` → 301 to `/?ref=menu&x=1`;
        - `/gallery/` → 301 to `/`;
        - `/the-starter` → 301 to `/starter` (kept);
        - `/nonexistent-page` → 404;
        - `/`, `/order`, `/starter` and `/visit` → 200 at the new version,
          their markup identical to `t5obxx`'s apart from the build's script
          names;
        - the sitemap lists the four.
     5. Money: the run's own routing charge, and no ledger row for the job.
     - **Expected, not judged**:
       - the canary's `FAIL  no route lost an on-page photograph ->
         /gallery:1`. The removed page took its own copy of the header logo
         with it, and the plain path compares a removed route against
         nothing. It still exits on `published`.
       - the QR code on `/visit` now leads to the 301 (backlog).
  3. **Free: restore `8btpep`.** Pass:
     - RESTORED at `8btpep`;
     - `/gallery` answers 200 again, with the query and the trailing slash;
     - `/the-starter` answers 301 → `/starter`;
     - `/nonexistent-page` answers 404, and the sitemap lists five;
     - the stored pages are byte-identical to the fixture;
     - nothing is charged.

     This is also the first live restore over a stored `/gallery=/` (run 50
     came before the fix). If a 301 is still served at once, it is read again
     after ten minutes, to tell a cached answer from a stale map.
- **Recovery**: step 3, the free restore to `8btpep`. Group A changes pages
  and the stored redirects, never a database row.
- **What each other outcome means**:
  - The router answers anything other than the expected route: the canary
    refuses to post the edit, and only the routing call is spent. Item 1
    stays open, and step 3 still runs.
  - The removal is refused (`kept`): nothing changes, and the edit costs 0.
    This is a finding (something still names the page). Step 3 still runs.
  - The page is removed but an address answers otherwise: item 1 fails, as a
    product finding. Step 3 still runs.

### Group B — a row changed on a site whose database link is blank (item 5, the missing reference only)

- **The gap.** On an `incomplete` site the data rung has to work out the
  database connection itself: the container has no lookup cache to hide the
  blank reference. Only supplied answers show it (`test/edit-failure.test.mjs`);
  no live data edit has run on such a site.
- **Target**: `fretwork-1`, live at `01790404806543-kk6qsh`.
  - Its backend is `incomplete` (read 23:14 UTC, non-secret columns only): the
    `site_backends` row's `neon_db` is blank, and the `site_project` row is
    there.
  - `lessons` is publicly readable with 4 rows. `/prices` draws them at
    runtime in price order (£0, £18, £30, £40), and the site's four languages
    share them.
  - Its two jobs that aren't `done` or `failed` are `lost` from 2026-09-01 and
    09-02, leases long expired and refunded. Nothing is open.
- **Control**: `washhouse-2`. It is the account's own site, has no database,
  has never had a job, and answers 200.
- **Deployment**: the same.
- **Requests**:
  1. `Change the price of the Hour one-to-one lesson to £42.` (54 characters,
     55 bytes, sha256 `7f45e82209eeb602…`)
  2. `Change the price of the Hour one-to-one lesson back to £40.` (59
     characters, 60 bytes, sha256 `9f9f1ef56a33beb3…`)

  The router is sent the site's pages and no table names. That is what the
  real app sent in run 42 as well, and that router still answered `data`.
- **Expected route, enforced on both presses**:
  `intent=edit layer=data alsoAsked=none`.
- **The baseline, in full**: `GET
  https://gofarther.dev/api/db/fretwork-1/data/lessons?select=*&order=id.asc`,
  read at 22:50, 23:20 and 23:59 UTC on 2026-09-29, identical each time.
  736 bytes, sha256
  `a4f1dc305d7d6326efb3b3d976c29edeebfc895a8c30a71db8038859475cf6ea`. The
  served body has one space after each of the first three `},`; this copy
  drops those three spaces, and the sha256 is of the served bytes:

  ```json
  [{"id":1,"name":"First lesson","description":"A free 45-minute taster in Crookes. Bring a guitar if you have one; there is a spare if not.","price":0,"duration":"45 minutes","created_at":"2026-09-02 16:57:02"},
   {"id":2,"name":"Group of three","description":"Share a 45-minute lesson with two other beginners. Eighteen pounds each.","price":18,"duration":"45 minutes","created_at":"2026-09-02 16:57:02"},
   {"id":3,"name":"One-to-one","description":"A private 45-minute lesson. Beginners welcome.","price":30,"duration":"45 minutes","created_at":"2026-09-02 16:57:02"},
   {"id":4,"name":"Hour one-to-one","description":"A full hour when 45 minutes is not enough.","price":40,"duration":"60 minutes","created_at":"2026-09-02 16:57:02"}]
  ```

  `/`, `/prices`, `/gear` and `/fr/prices` are at `kk6qsh`, and `/prices`
  is drawn in Chromium as the before picture. After each step the rows are
  compared with this baseline, and each difference is checked against the
  job's own stored `applied` (which rows and columns it wrote). A difference
  the job does not account for is reported, never "recovered", until its
  cause is known: it may be someone else's change.
- **Steps, one after another**:
  1. **Paid: request 1, with the expected route.** Pass:
     1. `request.json` carries it, and `routing.json` carries a verdict that
        matches: `edit`, layer `data`, nothing held back.
     2. The job:
        - it ran in the site's container: its trace's `run` mark reads
          `where: "container"`;
        - it found the database without the reference: no
          `data/backend-unreadable`, `no-backend` or `no-meta`;
        - its stored result is `ok: true`, `layer: "data"`, with `applied`
          exactly `[{ table: "lessons", id: 4, columns: ["price"] }]` and
          `failed` empty;
        - it has one ledger reserve, `<job>#1`.
     3. The rows, compared field by field with the baseline: ids 1–3
        identical, and id 4 identical apart from `price: 42`. No row added
        or missing.
     4. `/prices` shows "Hour one-to-one … £42" in the same order. Every page
        is still at `kk6qsh`: nothing was published.
     5. The backend row's `neon_db` is still blank: the rung writes nothing to
        the reference.
     - **Expected, not judged**:
       - the reply "✅ Updated one entry in lessons." (the data rung's kept
         wording);
       - the canary's "CANARY PASSED … published", with the comparison
         UNVERIFIED because a row edit names no version.

     **If step 1 changed anything besides row 4's price, step 2 is not
     sent.** Step 2 can only set that one price, so the recovery below is
     used instead, and group B stops as a finding.
  2. **Paid, only after I've read step 1 and it changed exactly row 4's
     price: request 2, with the same expected route.** Pass: the same path,
     and the rows read back byte-identical to the baseline (736 bytes,
     `a4f1dc30…`). `/prices` matches the before picture.
- **Recovery, at row level, for every difference from the baseline.** A
  saved page version does not restore database rows: the free restore to
  `kk6qsh` puts back pages only. **No recovery write is made during
  preparation.** Each one below is the owner's action, or needs the owner's
  approval, at the time.

  | Difference found after a step | Recovery | Exact? |
  |---|---|---|
  | Row 4's price is 42 and nothing else differs (step 1 as intended) | Step 2, through the product | Exact, if step 2 does only that |
  | Row 4's price still differs after step 2, or step 2 was refused | The owner, in the app's Data panel signed in as the building account: row 4, price back to `40`, Save | Exact: the panel re-saves the row's other fields as they are, and none is empty, so its blank-for-null does not arise |
  | Another field of row 4 changed (`name`, `description`, `duration`) | The Data panel: row 4, each changed field back to its baseline value above | Exact |
  | A field of row 1, 2 or 3 changed | The Data panel: that row, each changed field back to its baseline value above | Exact |
  | A row added (an id not in the baseline) | The Data panel: delete that row | Exact for the four rows (the id sequence has moved on, which nothing shows) |
  | One of the four rows deleted | The Data panel: add a row with its baseline `name`, `description`, `price` and `duration` | **Not exact**: `id` and `created_at` are set by the database, so the row returns under a new id and time. `/prices`, which orders by price, reads the same. An exact return needs a database restore, which is a separate approval and also reverts every other change in that database since, its bookings included. |
  | An `id` or `created_at` changed | Not something the data rung can write (it writes only the columns it offers, and never `id`). Stop and report; no write. | — |
  | Another table changed (`bookings`, `gear`) | The data rung is offered display tables only, which on this site is `lessons`. Stop and report; no write without the owner's approval. | — |
  | A page or the version changed (a data edit publishes nothing) | The free restore to `01790404806543-kk6qsh`, pages only | Exact for pages; it restores no row |
  | The backend reference (`neon_db`) written | Not something the data rung writes. Report it. | — |

  After any recovery, the rows are read again and compared with the baseline
  byte for byte; the page is drawn again and compared with the before
  picture.
- **What each other outcome means**:
  - The router answers anything other than the expected route: the canary
    refuses to post the edit, and only the routing call is spent. A `text`
    answer is possible, since the router is sent no table names, and would be
    a routing finding.
  - `data/backend-unreadable`, `no-backend` or `no-meta`: the blank-link path
    failed live. That is the finding this group exists to find, and the edit
    costs nothing.
  - A no-match (422): the picker read the rows and matched none. It is
    charged, and it is a finding.
  - Another row or field changed: the recovery table above, and a finding.

### Running A and B side by side

Checked read-only in the code and the database on 2026-09-29:
- **Targets and controls don't meet.** There are four different sites: A's
  target `fold-lane-bakery` and control `washhouse-3`, and B's target
  `fretwork-1` and control `washhouse-2`. Every press files a free test job
  (cost 0) on its own target and its own control, and no site is both.
- **Nothing on the account puts them in a queue.**
  - The only edit lock is per site: `edit_claim` → `site_busy`, an advisory
    lock on the slug.
  - The idempotency key is per POST.
  - The queue runs 250 jobs at once, with one container per site.
  - The workflow has no concurrency group.

  The one contention on the account is signing in: each press mints its own
  link. So press them a minute apart; a clash would fail before anything is
  spent.
- **Every charge can be attributed.**
  - Routing leaves no ledger row. Each run's routing charge is in its own log
    (`routed in …: … cost=N`), which is what the Worker collected.
  - A job's charges are ledger rows whose ref is the job's id: `<job>#n`, and a
    refund is `<job>`. The removal is `exempt` and has no row.
  - The account-wide "balance before / after (moved)" lines the plain canary
    prints are shared during an overlap, so they are not read. On this path
    they are only printed, never judged.
- **Attribution needs no code change.**
  - The checks that misattribute are all in the browser scenarios: their money
    verdicts, their budget stop, and the put-back-only scenario's
    "nothing spent" check, each reading the account's balance. This batch uses
    none of them, only the plain paid edit and the restore mode.
  - Money closes afterwards, per run, from the run's own evidence: its routing
    line plus its jobs' ledger rows.
  - It closes for the batch as a whole when three things hold:
    - 22 (last ledger row 341) minus the balance after equals the routing
      lines plus the ledger rows;
    - every ledger row after 341 belongs to one of the batch's jobs;
    - no other job ran on the account in that window.
  - Nothing else should spend on the account during the batch. If something
    does, the closure shows an unattributed difference rather than misreading
    it.
- **For later, not needed now.** If a run should judge its own money while
  overlapped, the browser scenarios' three balance checks can use the run's
  own routing charges and its jobs' ledger net (scripts only, no deploy).
  Giving the routing charge its own ledger ref would need a Worker change.

### Cost

- **Estimates, from measured runs; not limits:**
  - A: about 1–2 credits for routing (run 49's routing for this sentence was
    1). The removal itself is `exempt`, measured at 0 in run 49.
  - B: about 2–3 per message, routing 1–2 plus the data rung's reserve (run
    42: routing 2 and the edit 1). About 4–6 for both messages.
  - The batch: about 5–8.
- **Enforced limits:**
  - **None per request or per batch.** `edit_reserve` refuses only above
    100,000.
  - **The one hard bound is the balance, 22** (read 23:14 UTC; last ledger
    row 341; no job open). `edit_reserve` refuses a reserve larger than the
    balance and takes nothing, and the routing charge takes at most what is
    left. So the balance cannot go below zero.
  - The batch can still spend more than estimated. A later reserve the
    balance cannot cover fails that job, is refunded, and shows in its run.
- **What the expected-route check changes**: a press whose router answer
  differs is stopped after routing, so it spends its routing charge and
  nothing else. It does not cap the routing charge, or the charge of the rung
  that runs.

### The presses

All from the branch `claude/help-needed-ehlwlj`, whose canary has the
expected-route box, against main's Worker (deploy 2170). Leave every box not
named here as it is (blank); the expected-route box stays blank on the two
restores, which refuse it. There are three rounds, and you tell me after each
one:
1. **Round 1**, a minute apart:
   - **A1**, free: "Run the ONE paid edit as well" `no`; "PUT ONE SAVED VERSION
     BACK, THEN READ IT AND STOP" `01790701419976-t5obxx`; "The site to edit"
     `fold-lane-bakery`; "A second site…" `washhouse-3`; and the two "Refuse to
     spend unless…" boxes, `907840c67497b2624f1a2febfdb27b947ca5222a` and
     `abf47dfeceba3c5c`.
   - **B1**, paid: "Run the ONE paid edit as well" `yes`; "What to change"
     request 1; "The site to edit" `fretwork-1`; "A second site…"
     `washhouse-2`; "Refuse to post the paid edit unless the router answers
     this…" `intent=edit layer=data alsoAsked=none`; and the same two
     expectations.
2. **Round 2**, after I've read round 1, a minute apart:
   - **A2**, paid: `yes`; "What to change" `Remove the gallery page.`;
     `fold-lane-bakery`; `washhouse-3`; the route
     `intent=edit layer=page page=/gallery remove=true alsoAsked=none`; the
     same two expectations.
   - **B2**, paid, only if B1 changed exactly row 4's price: `yes`; request 2;
     `fretwork-1`; `washhouse-2`; the route
     `intent=edit layer=data alsoAsked=none`; the same two expectations.
3. **Round 3**, at least ten minutes after A2's publish, once I've read it
   twice:
   - **A3**, free: `no`; "PUT ONE SAVED VERSION BACK…"
     `01790468089054-8btpep`; `fold-lane-bakery`; `washhouse-3`; the same two
     expectations.

### Approved; Round 1 handed over (2026-09-30)

**The owner accepted the expected-route correction and approved the batch**:
the requests and the intended fixture changes, an estimated 5–8 credits
understood as no cap, from `claude/help-needed-ehlwlj` with the route guard,
against the confirmed deployment (2170). No merge, deployment, further test
campaign or product fix. B2 goes only if B1 changed exactly row 4's price;
an unexpected change is reviewed, never swept back by a broad database
restore. Per-job accounting, no automatic retries, closed tests stay closed.
This batch can close only the redirect gap and the missing-reference part of
the data item.

**Read just before hand-over** (2026-09-30 00:13–00:14 UTC, free, read-only):
- the branch's form carries all 11 boxes, the expected-route box among them,
  wired to `CANARY_EXPECT_ROUTE`; `main` is `907840c6`;
- `lessons` on `fretwork-1`: 736 bytes, sha256 `a4f1dc30…`, byte-identical to
  the baseline above (its fourth identical read);
- `fretwork-1` live at `kk6qsh`, its `neon_db` still blank and its project row
  present; `fold-lane-bakery` live at `8btpep`;
- the balance 22, the last ledger row 341 (run 66's), no job open anywhere,
  and no Actions run in flight.

**Round 1** is A1 (the free restore to `t5obxx`) and B1 (the £42 data edit,
with its expected route), pressed a minute apart; Round 2 is handed over only
after Round 1's results are read.

### Round 1 as pressed (runs 68–70, 2026-09-30)

**A1 is done and checked (run 68, 00:27:09–00:28:02 UTC, from the branch,
free).**
- The canary printed RESTORED. The POST answered 200 (24 files, 0 swept),
  and the site itself reported `01790701419976-t5obxx` on the first read.
- The five stored pages hash exactly as `t5obxx` was recorded: index
  `637b7793`, order `0a0b5f41`, starter `37fb0e17`, visit `ddd1fe39`,
  gallery `da53a375`.
- Read at 00:40:56 UTC without following redirects:
  - every page answers 200 on `t5obxx`;
  - `/gallery` answers 200, with a query and with a trailing slash too;
  - `/the-starter` answers 301 to `/starter`, keeping a query;
  - an unknown page answers 404;
  - the sitemap still lists `/gallery`, because the page exists until A2.
- No served page links to `/gallery`: the count is 0 on all five. The same
  count finds the other menu links (the home page has 3 each for `/order`,
  `/visit` and `/starter`; `/order`, `/visit` and `/gallery` have 1–2 each),
  and `/starter` has no links at all, as before. A first count, which read
  the pages as binary, found nothing at all and was discarded.
- Nothing was charged. The free check's two jobs (`6df758af…` on the bakery,
  `6066dd73…` on `washhouse-3`) ended `billing none`, cost 0.

**B1 has not run.**
- **Run 69** (00:32:46–00:33:25 UTC, from the branch) had spend `yes`, the
  £42 request, `fretwork-1`, `washhouse-2` and both expectations, **but the
  expected-route box was blank** (`CANARY_EXPECT_ROUTE` empty). It was
  cancelled during the before-read. Its last line is the complete source read
  at 00:33:21.7, and the cancel came at 00:33:22.3, before the balance read
  and before the routing call. Nothing was routed, posted or charged. Its
  free jobs (`8b1addc7…` on `fretwork-1`, `9e5d760e…` on `washhouse-2`) ended
  `billing none`, cost 0.
- **Run 70** (00:36:55–00:37:33 UTC, **from `main`**, whose form has no
  expected-route box, so it ran without the check) had the same inputs.
  - The preflight and free checks passed: deploy `907840c67497`, image
    `abf47dfeceba3c5c`, and free jobs `555cc3f9…` and `d13e7dba…`, both
    `billing none`, cost 0. The balance read 22.
  - **The router answered `{"ok":true,"intent":"addon","cost":0,"failed":true}`
    in 0.4 s.** That is the Worker's fallback when the routing model call
    throws.
  - The canary refused to spend because no edit layer was named (exit 1).
    Nothing was posted or charged.
  - Had the router answered normally, this press would have posted the edit
    with no route check.

**Money.** The balance is 22.000000 and the last ledger row is still 341
(run 66's), read at 00:41 UTC, so runs 68–70 charged nothing. No job is open.

**`fretwork-1` is untouched.** It is live at `kk6qsh` on `/`, `/prices`,
`/gear` and `/fr/prices`. `lessons` is byte-identical to the baseline (736
bytes, `a4f1dc30…`, read at 00:40:56 UTC; its fifth identical read).

**Why the router failed: the provider refused; our records could not say so.**
- `routeMessage` wraps the request build and the model call in a bare
  `catch`, and the route forwards only the flag. Nothing logs, stores or
  returns the error, so the evidence cannot say whether the provider refused
  (an outage, a rate limit, billing or a key) or the call died on the way.
- Measured free, with a stub sender that never touches a network: the
  router's request for run 70's exact inputs builds normally. The sender is
  reached, and the request is 29,947 bytes with the same keys as the one
  built for run 66's inputs (30,067 bytes). A throwing sender reproduces run
  70's answer exactly. So the throw came from the model call, not from the
  request. The model was grok-4.6 on xAI, because the canary names no picker
  and the default picker is grok.
- The same code routed run 66 at 21:56 UTC, and nothing has been deployed
  since.
- The xAI status page refused a plain read (403).
- The gap is recorded in the backlog (*a failed routing call records no
  reason*), not changed.
- **The cause, found by the owner** (2026-09-30, reported about 01:03 UTC):
  the xAI account's balance was empty, and they have added credits. That
  is a provider refusal, the same class as the 2026-08-12 billing outage.
  Nothing on our side could have shown it: the preflight and the ledger read
  only our own credits.

**Where the batch stood after run 70.** A1 was done, and A2 waited for Round 2. B1 was
approved and had not run. It needs a press from the branch with the route box
filled. Pressing again is the owner's decision (no automatic retries). If the
router fails again, the press costs nothing and stops before the edit.

### B1, pressed again as run 71 (2026-09-30 01:05–01:07 UTC, 3 credits)

Pressed by the owner after topping up xAI, from the branch at `19c33650`,
with all seven boxes as handed over, the route box included. **Every pass
item of step 1 is met.**
- **The route.** The log printed `EXPECTED ROUTE intent=edit layer=data
  alsoAsked=none` before the sign-in. The router answered `edit`, `data` and
  nothing held back, in 8.2 s at cost 2. `routing.json` carries the answer,
  the expectation and the verdict `{"ok":true,"diffs":[]}`, and the answer
  was posted as it came.
- **The job** is `12fde9b8de72d587d50e6968ec960434`: posted 202 at 01:06:24,
  claimed, and settled at 01:06:38 with a stored final reply.
  - It ran in the site's container: trace `e_munen0kg7qqev69c` has one mark,
    `run ok`, `where: "container"`, 6,433 ms, `ok` and no failed phase.
  - The stored result is `ok: true`, layer `data`, `applied` exactly
    `[{table: "lessons", id: 4, columns: ["price"]}]`, and `failed: 0`. No
    `data/backend-unreadable`, `no-backend` or `no-meta`: the blank-link path
    found the database live. That is the missing-reference half this group
    exists to show.
  - The job row reads `done`, billing `finalized`, cost 1, nothing
    published.
- **The rows**, read at 01:09:08 UTC and compared field by field with the
  baseline: ids 1–3 identical in all six fields; id 4 identical apart from
  `price` 40 → 42; no row added or missing. The body is 736 bytes, sha256
  `2ec299b8…`, unchanged when read again at 01:11:52.
- **The page.** `/prices`, drawn in Chromium at `kk6qsh`, shows "Hour
  one-to-one … £42" last, in the same order (£0, £18, £30, £42), read from
  `lessons?order=price.asc`. Compared with the before picture (2026-09-29
  23:12), 103 pixels differ, all inside one 10 × 12 box at the price's last
  digit; the same comparison of a picture with itself finds 0. The three
  `gbp_eur` 502s were there before (Test 3).
- **Nothing published.** `/`, `/prices`, `/gear` and `/fr/prices` are still
  at `kk6qsh`. The served markup of `/`, `/gear` and `/prices` differs from
  the before-read only in the 12 bytes of two render timestamps per page
  (`u:17907303…`). The stored source is byte-identical, and the stored
  description is unchanged.
- **The reference.** `neon_db` is still blank, and the project row is
  present.
- **Money, per job**:
  - routing 2 (the log's `cost=2`; routing leaves no ledger row);
  - the job's one reserve, ledger row 342 (`12fde9b8…#1`, −1, balance after
    19);
  - 22 − 19 = 3 = 2 + 1, exactly;
  - the free check's two jobs (`a403bffb…` on `fretwork-1`, `7ae967b5…` on
    `washhouse-2`) ended `billing none`, cost 0, and no job is open.
- **Expected, not judged**: the reply "✅ Updated one entry in lessons."
  (the data rung's kept wording), and the canary's "CANARY PASSED … published"
  with the comparison UNVERIFIED, because a row edit names no version.

**So B2 may go**: B1 changed exactly row 4's price.

### Round 2 handed over (2026-09-30 01:12 UTC)

Read just before: the bakery at `t5obxx` (`/gallery` 200 on every page;
`/the-starter` 301), `fretwork-1` at `kk6qsh` with `lessons` at `2ec299b8…`,
the balance 19, and no job open. The two presses go a minute apart:
- **A2**, paid: `Remove the gallery page.` on `fold-lane-bakery` (control
  `washhouse-3`), route `intent=edit layer=page page=/gallery remove=true
  alsoAsked=none`. After it: the addresses read without following
  redirects, at once and ten minutes later.
- **B2**, paid: `Change the price of the Hour one-to-one lesson back to
  £40.` on `fretwork-1` (control `washhouse-2`), route `intent=edit
  layer=data alsoAsked=none`. Pass: the rows read back byte-identical to the
  baseline (736 bytes, `a4f1dc30…`), and `/prices` matches the before
  picture.

The estimates, not caps, are A2 1–2 (routing; a page removal is `exempt`)
and B2 2–3, against the balance of 19. The batch has spent 3 so far. Round 3
is A3, the free restore to `8btpep`, handed over after A2's second reading.

### A2 as run 72 (2026-09-30 01:18–01:22 UTC, 2 credits)

Pressed alone (B2 not yet pressed), from the branch at `6f2273aa`, with the
route box filled. **Every pass item of step 2 is met.**
- **The request**: `request.json` carries `Remove the gallery page.`, 24
  characters, sha256 `ee4c723ee681dfb2…`.
- **The route.** The router answered `edit`, `page`, `/gallery`,
  `remove: true`, nothing held back, in 5.6 s at cost 2. `routing.json`
  carries the verdict `{"ok":true,"diffs":[]}`, and the answer was posted as
  it came.
- **The job** is `16aaaddf6cc9beb648e7ad77038f447c`: queued, claimed, and
  settled after 145.6 s. It ran in the container: trace
  `e_munf3mf6qlcrs1a1`, `run ok`, `where: "container"`, 23 marks, 133,062 ms,
  `ok`. Its reply: `pageOps` `[{page: "/gallery", removed: ["gallery.tsx"]}]`,
  cost 0. The job row reads `done`, billing `exempt`, cost 0, published at
  01:21:33.
  - **One publish, `01790731167044-yuy16h`, built from `t5obxx`**, which the
    canary's after-read matched on its first read. The comparison is
    VERIFIED.
  - The stored source now has four pages, each byte-identical to `t5obxx`'s
    (index `637b7793`, order `0a0b5f41`, starter `37fb0e17`, visit
    `ddd1fe39`). `gallery.tsx` is gone, there are still no stored components,
    and the stored description is unchanged.
- **The addresses**, read by me without following redirects at 01:35:34 and
  again at 01:46:14 UTC. That is 14 and 25 minutes after the publish, so
  there was no reading "at once". The two readings are line for line
  identical:
  - `/gallery` → 301 to `https://fold-lane-bakery.gofarther.app/`, with
    `public, max-age=600`;
  - `/gallery?ref=menu&x=1` → 301 to `/?ref=menu&x=1`;
  - `/gallery/` → 301 to `/`;
  - `/the-starter` → 301 to `/starter` (kept), with the query and the
    trailing slash too;
  - `/nonexistent-page` → 404;
  - `/`, `/order`, `/starter` and `/visit` → 200 at `yuy16h`;
  - the sitemap lists four pages.
  - In Chromium, opening `/gallery` and following the 301 as a navigation
    lands on `/`, the home page, whose menu has no Gallery. A first render
    that followed the redirect inside the fetch left the browser at
    `/gallery` and drew the client router's own 404. That is a harness
    artifact, not what a visitor sees, and it was discarded.
- **The markup** of `/`, `/order`, `/starter` and `/visit` is identical to
  `t5obxx`'s apart from the build's script names. The same rebuild also
  preloads one or two fewer chunks on `/`, `/order` and `/visit`
  (`cta-band` and `section-header` are no longer listed as their own
  chunks), with no change to the text.
- **Money**: routing 2, and no ledger row for the job; 19 → 17. The free
  check's two jobs (`a2befd93…` on the bakery, `62a49f0a…` on `washhouse-3`)
  ended `billing none`, cost 0, and no job is open.
- **Expected, not judged**:
  - the canary's `FAIL  no route lost an on-page photograph -> /gallery:1`,
    as predicted;
  - the reply "✅ Took /gallery off the site. Every publish is kept, so say
    the word if you want it back.";
  - the QR code on `/visit` now leads to the 301 (backlog).

**So the removed page's 301 home, item 1's open half, has now been seen
live, read twice.** Closing it is the owner's decision.

### Round 3 handed over (2026-09-30 01:47 UTC)

A3, free: restore `01790468089054-8btpep` on `fold-lane-bakery`, with the
route box blank (the canary refuses a route beside a restore). Pass, as
planned:
- RESTORED at `8btpep`;
- `/gallery` answers 200 again, with the query and the trailing slash;
- `/the-starter` answers 301 → `/starter`;
- `/nonexistent-page` answers 404, and the sitemap lists five;
- the stored pages are byte-identical to the fixture;
- nothing is charged.

B2 was handed over in Round 2 and has not been pressed. It may run beside
A3, a minute apart.

### Runs 73 and 74 (2026-09-30 02:08–02:12 UTC): neither changed anything

- **Run 73 (A3's press, 02:08:32 UTC) never started.** The image id
  `abf47dfeceba3c5c` went into the route box ("Refuse to post the paid edit
  unless the router answers this…"), and the image box was left blank. The
  canary refused before signing in (`REFUSING THE EXPECTED ROUTE:
  "abf47dfeceba3c5c" is not key=value`, exit 2). There was no sign-in, no
  job, no restore and no charge. The bakery is still at `yuy16h`, with the
  gallery removed. This is the malformed-box refusal working live.
- **Run 74 (B2, 02:10:45 UTC)** ran from the branch with every box as handed
  over. **The router answered `edit` with layer `text`, not `data`,** in
  26.9 s at cost 2. The canary refused to post the edit: `REFUSING TO POST
  THE EDIT: not the route this press expected — layer: expected data, the
  router answered text.`
  - `routing.json` holds the answer, the expectation and the verdict
    `{"ok":false,"diffs":[{"key":"layer","want":"data","got":"text","readable":true}]}`,
    written before the refusal.
  - Only the routing call was spent. No edit job was filed: the free
    check's two jobs, `4c5797bd…` and `811538072…`, ended `billing none`,
    cost 0. There was no ledger row, and the balance went 17 → 15.
  - **This is the expected-route check's first live refusal.** A mismatch
    was stopped above the edit POST, with its evidence kept and only the
    routing call spent, as it was built to do.
  - The router was sent the three pages and no table names (`tables: []`).
    B1's sentence, the same change forward, was answered `data` (run 71);
    the plan named a `text` answer as possible for this reason. The real
    app sends table names only when the browser has them from a build or
    revise in that browser; a fresh browser, like the canary and run 42's UI
    run, sends none. It is recorded in the backlog as a routing finding (one
    sample each way) and not changed.
- **`lessons` is unchanged since B1**: row 4's price is still 42, and the
  body is still 736 bytes, sha256 `2ec299b8…`, read at 02:12:56 UTC.
  `fretwork-1` is still at `kk6qsh`.
- **Where the batch stands (02:15 UTC)**:
  - A3 still needs a correct press, with the route box blank.
  - Group B's row 4 needs recovering. The plan's row for "step 2 was
    refused" is the owner's own edit in the app's Data panel: row 4, price
    back to 40, Save. It is free and exact. Pressing B2 again is also
    possible: it is another routing call, and the router could answer
    `text` again.
  - Money so far: 22 → 15, 7 credits. That is routing 2 + 2 + 2 (runs 71,
    72 and 74) and ledger row 342 (1). The estimate was 5–8, and it is not
    a cap.

### A3 as run 75 (2026-09-30 02:20–02:22 UTC, free): the bakery is back on `8btpep`

Pressed from the branch at `502d971a` with only the four restore boxes
filled. The deploy, image and route boxes were blank, as handed over: a free
restore needs neither expectation. The preflight printed deploy
`907840c67497` and image `abf47dfeceba3c5c`, the confirmed deployment.
**Every pass item of step 3 is met.**
- **RESTORED**: live before `yuy16h`; the POST answered 200 (24 files, 0
  swept); the site reported `01790468089054-8btpep` itself on the first
  read.
- **The stored pages are byte-identical to the fixture**,
  `test/fixtures/run47/*.before.tsx`:
  - `index.tsx` 2,445 bytes, `51b5af6a`;
  - `order.tsx` 9,277 bytes, `4ead778e`;
  - `starter.tsx` 951 bytes, `37fb0e17`;
  - `visit.tsx` 4,055 bytes, `bdb02abe`;
  - `gallery.tsx` 3,017 bytes, `4e8b82aa`;
  - no stored components.
- **The addresses**, read at 02:22:49 UTC without following redirects:
  - every page answers 200 at `8btpep`;
  - `/gallery` answers 200 again, with the query and the trailing slash;
  - `/the-starter` answers 301 → `/starter` (and its query and slash);
  - `/nonexistent-page` answers 404;
  - the sitemap lists five pages.
  - The Gallery links are back where `8btpep` has them: 2 on `/` and 2 on
    `/gallery`. `/order` and `/visit` have none, as before: their sizes,
    15,412 and 12,782 bytes, are the same at `t5obxx` and `8btpep`.
- **Nothing charged**: balance 15, no ledger row after 342. The free check's
  two jobs (`b5916eaa…` on the bakery, `5b5352d1…` on `washhouse-3`) ended
  `billing none`, cost 0, and no job is open.

**Group A is complete**: from `t5obxx`, the removal (A2) answered 301 home,
read twice, and the fixture is back to `8btpep`, exactly. Group B's put-back
of row 4 (still 42, `2ec299b8…` at 02:22:49) is the one step left, and it
is the owner's.

### The owner's review of Batch 1 (2026-09-30)

- **Group A is accepted** for the demonstrated behavior: a removed page's
  address answers 301 to the home page (run 72), and the site was restored
  exactly and free (run 75). **The timing limit stays explicit**: the
  redirects were read 14 and 25 minutes after publication, not immediately.
  **There is no rerun solely for that missing immediate reading.**
- **B1 is credited**: the missing-reference data edit (run 71) changed
  exactly the one field through the blank link.
- **B2's `text` misroute (run 74) is a separate finding** (backlog). The
  reversal is **not counted as passed** and **not retried with a model**.
- **Row 4's recovery is the owner's own free write**: the Data panel, or,
  if its Data button is dark for this site, the one conditional `UPDATE` in
  the Neon console (below). After the owner confirms, all four rows and
  every field are compared with the baseline, the displayed price is
  checked, and so are the unchanged page version, no charge and no open job.
  Then the batch's recovery closes, with the routing finding kept.
- **Found while giving the steps** (read in the code; backlog): on a browser
  that did not build `fretwork-1`, the app may show its Data button dark.
  The site list says whether a site has a database from `site_backends.neon_db`
  alone (`db: !!r.neon_db`), and that link is blank here. The Worker's
  owner-rows route itself resolves through the route cache first, so a Save
  can still land once the panel is open. The fallback needs no model: Neon
  project `super-hat-47366810`, branch `br-long-bird-aukew6zm`, database
  `site_fretwork_1`, with `UPDATE lessons SET price = 40 WHERE id = 4 AND
  price = 42 RETURNING id, name, price;`, which must return exactly one
  row.
- **Row 4's put-back, read after the owner's report (2026-09-30 08:15–08:19
  UTC): not landed, so the recovery stays open.** The owner wrote *"Verify
  my price restoration"*. What the reads found:
  - the public read of `lessons` answered 736 bytes, `2ec299b8…`, which is
    B1's state: rows 1–3 identical to the baseline, row 4 different only in
    price (42, where the baseline has 40), and no fifth row. The answer
    carries no cache headers. The owner's Data panel opens the same
    database, since `ownerSiteConn` asks `siteBackendBySlug` first, as the
    public read does;
  - `/prices`, drawn in Chromium, shows "Hour one-to-one … £42";
  - every page is at `kk6qsh`;
  - the balance is 15 (unchanged since 02:11:48), with no ledger row after
    342, no job since run 76's two free ones, and none open;
  - `neon_db` is still blank;
  - the fallback's coordinates match `site_project`: project
    `super-hat-47366810`, branch `br-long-bird-aukew6zm`.

  So no write reached the database the site reads. How the attempt went is
  the owner's to say: the panel's message, or the console's row count. Not
  closed, and B2's model run stays failed.
- **Why the £40 did not land: traced, not settled (2026-09-30, free, no
  live write; `docs/history/2026-09-30-fixture-check.md`).** The owner asked
  for the save path traced, with neither user error assumed nor an app bug
  declared without evidence.
  - **The path**: the panel's Save sends `PATCH
    /api/site/<slug>/rows/<table>/<id>`. A failure is a toast, and the form
    stays open. A success reloads the rows from the server. In the Worker the
    request goes session check (`/auth/v1/user`) → owner lookup
    (`site_backends?slug=eq.…&select=uid`) → `ownerSiteConn` →
    `UPDATE … WHERE id=?`, and no row changed answers 404.
  - **The target** resolves through the same `siteBackendBySlug` as the
    site's own read.
  - **Supabase's own request logs** (non-secret fields; the canary runs as
    the positive control) hold no session check or owner lookup from the
    Data panel in the 24 hours to 17:25 UTC:
    - every session check for the building account is inside a canary run;
    - there is no owner lookup for fretwork-1 between 07:00 and 08:19;
    - there is no sign-in but the canary's, and no site-list read.
  - **That fits no Save reaching the Worker, but does not prove it** (the
    owner's correction): a request that stopped before those calls, or one
    the logs did not keep, would leave no trace there. Neither a user error
    nor an app defect is shown.
  - **Not decided without the owner's observation**: what Save displayed,
    and the price after reopening the panel.
  - **Not measured for fretwork-1**: whether the owner route and the
    site's read agree. The fixture check reads only the site's own read, so
    it does not measure this; the owner's observation settles it.
  - **Read again at 18:22 UTC** (the site's own read, free): four rows, row
    4 still 42, rows 1–3 unchanged. Both prepared fixture boxes answer
    `target-missing` on that body.
  - **Read again at 19:40 UTC**, whole (`0-3/4`, the guard's own read):
    rows 1–3 every field as the baseline, row 4 differing only in price
    (42), no other row. The owner's two answers are asked for again; the
    temporary row and the rehearsal wait for the £40.
  - **Read again at 20:04 UTC**, after run 78, the same way: the same four
    rows, row 4 still 42.
  - **Read again at 20:13 UTC**: the same. **The owner asked for one
    observed Save** through the Data panel (42 → 40), capturing what Save
    displays and the price after reopening; the steps were handed over
    after this read (`docs/history/2026-09-30-fixture-check.md` §6), and the
    result is awaited.
  - **The owner then authorized the correction through the owner save
    path** (2026-09-30, this correction only, no model call). Read first at
    20:26 UTC: still 42 (whole, `0-3/4`). **Blocked at sign-in**: the save
    route takes only the owner's own session, which a session may not mint
    or read; the live probe answered `401` and nothing was written. The way
    forward is the owner's choice (§7 of that history).

### What it will not establish

- **Group A**:
  - removing a page that something still links to (the rule refuses it, as
    run 47 showed live);
  - a removal and a menu change in one message (never run, and the router's
    own text pulls both ways);
  - where the QR code leads (backlog).
- **Group B**:
  - adding, deleting or reordering a row (not ready, above);
  - a site whose database is `none` or `unreadable`;
  - a data edit on a `ready` site (run 42, already credited).
- **Either**: a refused press shows only which route the router chose. It
  says nothing about the edit path, which never ran.

## Next independent work (prepared 2026-09-30 by free analysis only; nothing started)

The owner asked for the next independent work from the remaining checklist,
using free analysis only, with parallel execution wherever dependencies
allow. It must not repeat accepted tests or grow into another testing
campaign. Everything below was read in the code and the records. No model
was called, nothing live was changed, and nothing is built until the owner
approves it.

### Where the remaining items stand

- **Closed or credited by Batch 1**: redirect home (group A, accepted with
  its timing limit), and the data rung's blank link (B1).
- **Still open**:
  - adding a row to a list (deleting is closed by the owner: run 80,
    2026-09-30; reordering closed by the owner: Test 10, run 84,
    2026-10-01). Adding goes to the add-on step, whose `row` kind is merged
    and deployed (deploy 2175) and not shown live (*Test 11*);
  - broader rules;
  - the picture swap;
  - a correct component on the first attempt;
  - a follow-up message after a failure or an escalation (the failure half
    closed by the owner: Test 9, run 82, 2026-09-30; the escalation half
    unprepared).
- **Kept separate**: a protection refusing a real model's answer. Run 74's
  refusal was the canary's own route check, not a product protection, and is
  not counted for it.
- **Found by Batch 1, all in the backlog**:
  - a failed routing call records no reason;
  - a put-back routed `text` because no table names were sent;
  - the Data button is dark on a blank-link site.

### Lane 1: four small corrections, each unblocking something, buildable in parallel now

**Built on the branch 2026-09-30** (the owner: *"Proceed with Lane 1's four
corrections on the designated branch"*), **and merged and deployed the same
day in deploy 2171** (the owner: *"The two diagnostic fixes passed review.
Continue from candidate 291110103024a68da9d0bca525a9d2302d5bd1f2."*):
`907840c6` → `29111010` at 05:30:28 UTC, the image `abf47dfeceba3c5c` →
`cdb624837e099719` as predicted, deployed and not yet runtime-confirmed
(`docs/deploy-record.md`); its code was runtime-confirmed later that day
under deploy 2172, by run 76. Each correction was:
- reproduced through the real route first (a red check);
- fixed in its own commit: 1a `19f6e480`, 1b `fe20e6cd`, 1c `b12dd43b` with
  a follow-up `bd81a60e`, 1d `a02c2003`, and `d19652c4` for 1b's and 1d's log
  lines;
- swept in its own worktree. Every mutant was killed and every comment-only
  control survived: 8 of 8, 17 of 17, 17 of 17 and 15 of 15.

**The owner credited the implementation and its CI** (the unit and site
build runs on `dfaf8f7c`), and their review found two diagnostic gaps, closed
in `ce992066`:
- a provider's code is named only from a finite table by provider
  (Anthropic's nine documented codes; xAI's `insufficient_quota`), and no
  code is coerced from a non-string (`upstreamKind`, `xaiErrorDetail`);
- the route cache's KV log line, which 1d's lookup reaches, names the
  operation and a known error class, never the error's text.

Both were red-checked (8 new cases failed on `3a728968`, every control
passed) and swept: 25 of 25, 15 of 15 and 9 of 9, every control
survived. The full suite on `ce992066` is `8351 / 8351 / 0 / 0`. What changed, what the
tests drive and what they cannot establish are in
`docs/history/2026-09-30-lane1.md`. Found along the way and corrected with
1c: the card's click dropped the server's yes, so even a lit Data button
opened no Data view on a fresh browser. The owner routes also needed the KV
cache to open a blank-link database, and the panel said "No data tables yet."
on a failed read. **Real-model evidence: none.**

Each has its own file or hunk, its own guard cases through the real route
with supplied answers, a red check, a sweep with a comment-only control, and
a record. One merge and one deploy carry all four. `worker.js`,
`site-backend-state.mjs`, `builder/site-apply.mjs` and `builder/site-ask.mjs`
are container inputs, so the merge rolls the image once, and container work
waits 15–20 minutes after it.

| # | Correction | Unblocks | Where | Depends on |
|---|---|---|---|---|
| 1a | The data picker's `changes` sentence stops telling it to return nothing for a deletion, since the item's own `remove` field now does deletions (`DATA_TOOL`, `builder/site-apply.mjs:446`) | the delete half of the data item | `builder/site-apply.mjs` | nothing |
| 1b | A failed routing call carries its reason (the provider and status, never a secret) on the route's answer, and the canary prints it | the observability finding; run 70's empty balance would have named itself | `builder/site-ask.mjs` (the `catch` in `routeMessage`), `worker.js` (`/api/site/route`), `scripts/edit-canary.mjs` | nothing |
| 1c | The site list counts an `incomplete` site as having a database, through the one state function, so the owner's Data button opens | the dark Data button; the owner's own free recoveries on the four blank-link sites | `worker.js` (the list route), `site-backend-state.mjs` | nothing |
| 1d | When the digest names no tables, the route fills in the site's own table names (names only) before asking the router, and fails open to today's behavior if the lookup does not answer in time | the `text` misroute's cause; a fresh browser and the canary routing blind | `worker.js` (`/api/site/route`), through the owner-rows machinery (`siteBackendBySlug`, `loadSiteSchema`) | nothing. It changes inputs only, not the router's words, and is shown with supplied answers; how a real router then answers is not measured |

1a, 1b and 1c touch different code and can be built side by side. 1b and 1d
both touch `/api/site/route`, in different places (the reply and the
digest), so they are built one after the other in the same file.

### Lane 2: decisions only you can make, in parallel with lane 1

| # | Decision | Why it blocks | What each answer leads to |
|---|---|---|---|
| 2a | Which step adds a row to a list the site already has: the add-on step (your 2026-09-02 rule, *"Add will always go in addon"*) or the data picker, which can already insert | an "add a row" acceptance has no expected route until this is decided | **Answered by the owner (2026-10-01): the add-on step** (*"Respect my existing rule: 'Add will always go in addon.'"*). The earlier reading here, "no product change", was wrong: traced on 2026-10-01, no add-on kind adds a row to a table the site already has (*Test 11*). So it needs a product change and a canary change. **Both built on the branch on 2026-10-01** (the `row` kind and the canary's add-on press; not merged). |
| 2b | Whether reordering a list ("show the cheapest first") is `data` | the router says nothing about order, and a misroute to the page writer costs 6–22. **Traced 2026-09-30** (*Test 10*): a list's order is page code on every demo site, the site-wide sort lane is in the data rung, and the router reaches it by no rule. **Decided by the owner, 2026-09-30, the scope corrected 2026-10-01**: a sort across the whole site is `data` (the site-wide sorter); a sort limited to one named page is `page`; a selection of pages is never sent to the sorter (the closing rule decides it); no "whatever page they saw it" rule | Built (lane 3's sort half), its scope corrected, and merged and deployed in deploy 2174; then Test 10. |
| 2c | The broader-rules fixture: reopening `lido-axes-b`'s bookings, which you asked to keep closed, or a new disposable site (a first build, 11–45) | its only fixture is closed by your instruction | either way, one bounded rules acceptance afterwards |
| 2d | Whether to take on the picture swap's product work: attachments reaching the picture step, the picker told which file fills which slot, and no fal purchase when a file is given | no natural message can reach it today without buying a photograph | yes: a product round of its own, later. No: it stays open. |
| 2e | What "a correct component on the first attempt" must show, and on which site | no fixture has one, and the outcome cannot be fixed in advance | a definition first; no work until then |
| 2f | Whether to add a UI-mode scenario for a follow-up after a failure: a free, deliberately failing first message, then a second one from the same tab | it needs a harness change, which is yours to ask for | yes: one scenario and one press later. **Asked for by the owner (2026-09-30)** and built as Test 9 (`9-follow-up`); its first message costs its routing call, and only its edit is refunded |
| 2g | Whether to heal the four blank links with the existing repair (maintenance on live rows) | 1c covers the button without it. Healing also ends the blank-link fixtures | yes: a free maintenance press. No: nothing |

### Lane 3: the router round, after 2a and 2b

**2b's half is built (2026-09-30), its scope corrected (2026-10-01), and
merged and deployed in deploy 2174**: the sort rule, *Test 10*'s decision,
closed by the owner after run 84. **2a is answered by the owner
(2026-10-01): the add-on step**, so there is no router wording left to do
for it.

Only if 2a answers `data` or 2b answers yes. It is a wording change to
`builder/site-ask.mjs`, the same kind as the whole-message rule round: a
guard, a red check, a sweep, and the existing router cases. It can share
lane 1's merge if the decisions come first; otherwise it takes its own.

### Lane 4: live closure, after the merge and one free runtime check

Each remaining item closes with at most one bounded press, proposed
separately with its cost, and only once its blocker is gone. None repeats an
accepted test.
- **Delete** (after 1a): on `fretwork-1`, one row deleted through the edit
  path. **Closed by the owner** (run 80, after run 79's free rehearsal,
  2026-09-30; *Lane 4's delete*, below).
- **Add**: 2a answered (the add-on step). *Test 11*'s row capability and
  the canary's add-on press are built on the branch (2026-10-01); the press
  waits on a merge, a deploy, a free runtime check and a top-up.
- **Reorder**: **closed by the owner** (Test 10, run 84, 2026-10-01).
- **Rules, picture swap and component**: after 2c–2e.
- **Follow-up after a failure**: closed by the owner (Test 9, run 82,
  2026-09-30).

The put-back routing (1d) needs no live test of its own. It would show up
in the next data press.

### What can run at once

- **Now, in parallel**: 1a, 1b and 1c, plus every decision in lane 2.
- **Then**: 1d after 1b (same route).
- **Then**: lane 3 once 2a and 2b are decided.
- **Then**: one merge, one free runtime check, and the lane 4 presses. Those
  on different sites can overlap a minute apart, as Batch 1's did.

## Test 11 — one item added to an existing list (prepared 2026-10-01 on the owner's word, after Test 10 was closed; free analysis only, nothing spent, no routing change; its capability — the add-on `row` kind — and the canary's add-on press built on the branch the same day on the owner's word, verified free, corrected in three rounds after the owner's reviews, and merged and deployed in deploy 2175 the same day (runtime check pending); real model routing unproven; the expectation corrected: the new entry's id is the database's, not necessarily 7)

**The owner**: *"Next, prepare the remaining 'add one item to an existing
list' test using free analysis only. Respect my existing rule: 'Add will
always go in addon.' Trace whether that route can add exactly one row to an
existing table. Identify the exact request, existing demo, current baseline,
expected result, unrelated content to preserve, testing support, and
estimated cost. If there is a concrete capability or testing gap, explain it
and propose the smallest next step. Don't change routing policy or start a
paid run during preparation."*

### The route under the owner's rule (traced 2026-10-01, free)

- **The router sends it to the add-on step.** Its `intent` field defines
  "addon" as "ADDING SOMETHING THE SITE DOES NOT HAVE YET". The question it
  asks is "does the thing they name exist on the site now?", and it closes
  with "WHEN YOU CANNOT TELL, ANSWER addon". Its `data` clause speaks of
  deleting a row only, and says so: "whether an added row is this layer or
  the add-on step is the owner's open decision, and nothing here says".
  Nothing was changed.
- **The add-on step has nine kinds** (`table · function · api · job · page
  · component · qr · three · photo`), and **none of them adds a row to a
  table the site already has**:
  - `table` creates a table, or gives an existing one a new column, payment
    or a public view. Its `seed` is "starter rows for the new table";
  - the seed is written by `seedSiteRows` (`site-schema.mjs`), which seeds
    display tables only and skips any table that already has rows;
  - `component` and `page` change page code, so a hand-written card is a
    band on the page, not an entry in the list.
- **The only code that inserts one row today is on the edit side**: the
  data step (`DATA_TOOL`: "LEAVE [id] OUT to add a new row", written by
  `runDataEdit`'s `INSERT`). The owner's rule does not route an addition
  there, and changing that would be a routing change, so it is not
  proposed.

### Rehearsed through the real add-on route (supplied answers, scratch, not committed)

`POST /api/site/<slug>/addon` with the request below, on a stand-in of the
bakery, through the add-on route's own test fixture:
- `loaves` is a public list that already has rows: the existence probe
  answers one row, and every insert into it is recorded;
- no model, container, credit or network is used.

Each answer a picker could plausibly give:

| the picker answers | the route's outcome | the customer reads | rows added |
|---|---|---|---|
| no kind | `no-add`, cost 0 | "I couldn't determine a supported addition from that message. Please clarify what you'd like to add." | 0 |
| `table`: `loaves` with no columns, one seed row | refused (`no-columns`), cost 0 | "That table would have nothing in it — say what it should hold." | 0 |
| `table`: `loaves` with its columns and one seed row; the page writer returns `/order` unchanged | `no-change`, cost 0 | "The builder produced no page changes for this addition. I've stopped instead of starting a full-site rewrite." | 0 |
| the same; the page writer adds a hand-written card | **published, `ok: true`**: the stored schema re-applied as it stood, and `seedSkipped: ["loaves: already has rows"]` | **"✅ Done — updated /order. I had starter rows ready for loaves and didn't put them in — that table isn't one visitors can read, so it starts empty."** | 0 |
| `component`: a kit part on `/order` | **published, `ok: true`** | "✅ Done — updated /order." | 0 |

**So the add-on route cannot add exactly one row to an existing table.** A
real model's answer ends in one of two ways:
- a refusal, costing nothing for the step;
- a false success: a hand-written card published on `/order` while `loaves`
  is unchanged. The new loaf is then missing from the order form's choices,
  the price order and the Data panel.

### Found on the way (backlog)

- **The seed-skip sentence drops its reason** (`seedSkipNote`). "loaves:
  already has rows" is told as "that table isn't one visitors can read, so
  it starts empty", which is wrong on both counts for `loaves`.
- **The add-on route's fixture reads every table as empty.** Its existence
  probe answers no rows, so with the fixture unchanged the same `table`
  answer *inserts* the seed row (`seeded: {loaves: 1}`). A test of adding a
  row built on it would pass where the product does not.

### Testing support

- **The canary could not press it** (as prepared): its one-request path
  refused unless the router answered `edit` with a layer ("REFUSING TO
  SPEND: the router did not name an edit layer"). **Built on the branch
  (2026-10-01)**: when the route box says `intent=addon` and the router
  answers `addon`, the canary posts the add-on request exactly as the
  browser's `siteAddon` does (`scripts/canary-addon.mjs`), watches the job,
  composes the customer's screen with the add route's own composer, and
  passes only on an `ok` answer, saying what was saved. Without
  `intent=addon` in the box an `addon` answer is still refused as before; an
  `edit` answer to a box expecting an addition is refused by the route check.
- **The rows box can pin the table before** the press: Test 10's box still
  reads `as named`. The after-checks would be free reads, as in Test 10.
- The UI mode follows the app's own add-on request, but would need a new
  named scenario.
- `scripts/addon-sweep.mjs` posts to the add-on route directly, so it skips
  the router. Its new `row` case runs only when typed by name, never under
  `all`, because it writes a real entry.

### The test (runnable once the branch is merged and deployed, after a free runtime check and a top-up)

- **Site**: `fold-lane-bakery` at `01790819484141-dgmag4`, as the owner left
  it after Test 10.
- **The request** (104 characters, 105 bytes, sha256 `7cc5f1ca7ec8bcc3…`):
  *Add one loaf to today's loaves: Rye & Caraway at £5.00, described as "A
  light rye with toasted caraway."* "Today's loaves" is the list's own label
  on `/order` (`order.tsx` line 165).
- **Expected route**: `intent=addon`, nothing held back (the route box
  `intent=addon alsoAsked=none`). The canary posts the router's `addon`
  answer to the add-on route only because the box says so.
- **The baseline** (read 2026-10-01 at 02:45 UTC, free, read-only, as a
  visitor; identical to the after-read of Test 10's run 84 at 01:57):
  - `loaves` read whole: 200, `0-5/6`, 1,045 bytes, sha256 `ef870ebc…`, the
    six rows of Test 10, and Test 10's rows box reads `as named`;
  - all five pages 200 at `01790819484141-dgmag4`, with the same bytes as at
    01:57;
  - `/order` requests `loaves?select=*&order=price.asc` and shows Sea Salt
    Focaccia £4.50, Country White £4.80, Dark Rye £5.20, Seeded Wholemeal
    £5.40, Olive & Rosemary £5.80, Walnut Levain £6.00;
  - all six redirect probes as at 01:57;
  - full-page screenshots of the five pages.
- **Expected result** (corrected 2026-10-01 on the owner's word: *"the new
  ID is database-assigned, not necessarily 7"*):
  - exactly one new row in `loaves`: `name` "Rye & Caraway", `price` 5,
    `description` "A light rye with toasted caraway.", `photo` null, with
    **the `id` the database assigns** and `created_at` its own. The id is
    read back, never predicted: from the add-on reply (`rows[0].id`, the row
    as stored) and from the whole-table read after the press. A visitor
    cannot read the sequence, and a table that has lost rows keeps counting
    past them (the stateful fixture starts its sequence at 12 to make that
    point);
  - **on `/order`, the new loaf in both the sorted list and the order form's
    choices.** On the bakery those are one control: "Today's loaves" is the
    order form's `RadioCards` group, fed by the page's own read
    (`/api/db/fold-lane-bakery/data/loaves?select=*&order=price.asc`, read
    free on 2026-10-01 as a visitor). So the check is two-fold on it:
    - the list: seven choices in price order, Rye & Caraway £5.00 third,
      after Sea Salt Focaccia £4.50 and Country White £4.80;
    - the choice: Rye & Caraway's card carries the new id as its value
      (each card's value is `String(l.id)`, read on the live page: today the
      six cards carry 6, 1, 2, 3, 4, 5), so the form would order that loaf.
      No order is placed: that would be a live write;
  - a reply naming the loaf, the list and the id the database gave it, from
    the browser's own composer: "✅ Done — added “Rye & Caraway” to loaves
    (entry N).".
- **Unrelated content to preserve**:
  - the six existing rows, every field (the whole-table read before and
    after);
  - no row written anywhere else. A visitor cannot read `orders`, so this
    rests on the job's own record of what it wrote;
  - the five stored pages byte-identical, and no new published version, if
    the addition changes no page;
  - `/`, `/gallery`, `/starter` and `/visit` pixel-identical;
  - on `/order`, the region above the list identical, and the region below
    it identical one card lower;
  - headings, menus, the stored description and the redirects unchanged.
- **Estimated cost, once runnable**: about 3–4 credits, not a cap. That is
  routing 1–2, plus the add-on's own charge: the picker and one row
  designer, billed once as `pageCredits` of their two usages, at least 1
  and measured at 2 for an add-on that changes no page
  (`docs/addon-path.md`). Under a job it is reserved before the write and
  refunded if the write fails; inline it is collected after the write. The
  balance is 3, so a top-up comes first.

### The smallest next step (proposed; then built on the owner's word, below)

1. **One add-on kind, `row`: a new entry in a list the site already stores.**
   - Its designer is shown each existing display table with its columns, and
     answers one entry per row they asked for, and not one more.
   - Each entry is cleaned against the stored schema: a table the site has;
     a display table only (never one visitors submit to, which would be a
     made-up submission); only the columns it has, never `id` or
     `created_at`.
   - It is written by the same parameterized `INSERT` the data step uses,
     shared rather than copied.
   - It changes no page: no page call, compile or publish, because the list
     is read live. It is billed once, like the add-ons that change no page.
   - The reply is composed from the rows really inserted.
   - Tests: through the real add-on route with supplied answers, on a
     stand-in where `loaves` already has rows (the case above), and the
     refusals (a table the site lacks, a table visitors submit to, an
     unknown column).
2. **The canary carries an add-on press**: with the route box
   `intent=addon`, an `addon` answer is posted to the add-on route as the
   browser posts it, instead of being refused.
3. Then the live test above, after a merge, a deploy, a free runtime check
   and a top-up.

No routing policy changes in any of it.

### Built on the branch (2026-10-01, on the owner's word; not merged or deployed)

**The owner**: *"Proceed with the bounded implementation for Test 11 on the
designated branch. Add support for inserting entries into an existing display
table through the add-on path, preserving 'Add will always go in addon.' Keep
it universal—no bakery-specific rules."* With: validation against the site's
stored schema and eligible display tables; the existing parameterised insert
shared, not copied, and the edit behaviour preserved; the inserted row and its
database-assigned id returned; rows, schema, permissions and page source
preserved, with no page-generation call or publication; the canary extended to
post the real add-on answer when the box expects `intent=addon`; a stateful
fixture with existing rows; the existing job and billing machinery; and *"No
merge, deployment, live data writes or paid calls yet. Leave demo data as it
stands."*

Steps 1 and 2 above, as built (`docs/history/2026-10-01-add-row.md`; the
kind's law is `docs/addon-path.md`, *THE `row` KIND*):
- **The `row` kind**: a display list the site stores (`rowTables`, by
  `resolveAccess` against the display preset, the data step's own
  condition), its declared columns only, `id` and `created_at` always the
  database's; each refusal named, at no cost.
- **The write**: the data step's own `insertStatement` and `rowValues`, moved
  to `builder/site-rows.mjs` and imported by both doors (the data step's
  statement byte for byte unchanged); every entry `RETURNING *`, beside the
  request's `_meta` key, in one statement.
- **The reply**: the rows as the database stored them, with their ids; no
  page call, compile or publish.
- **Duplicates and replays**: the key is read before the picker (a repeat
  answers what was saved, with no model call and no second charge), and two
  runs racing past it collide on `_meta`'s primary key, which rolls the
  loser back whole.
- **The money**: one charge with the existing machinery — under a job,
  reserved before the write and refunded by the consumer when the write
  fails; inline, collected after a write that landed.
- **The canary**: posts the router's `addon` answer only when the box says
  `intent=addon`; every other press is refused or posted exactly as before.

### Verified free (2026-10-01)

- **Red check**, the new tests on the code before (`c91d1c3e`): 44 tests, 42
  fail, 2 pass — the two controls (an unasked addition refused as before; an
  edit answer to a box expecting an addition refused by the route check).
  Before the fix the route answered `no-add` and wrote nothing.
- **After**: `test/addon-row.test.mjs` 35 of 35 and
  `test/canary-addon.test.mjs` 9 of 9 — preservation, five invalid targets,
  a decline, a partial answer, write failures (sync and queued, refunded),
  a duplicate entry, a missing `_meta`, a refused reserve, duplicate
  submission and five replay shapes with one row and one charge, two
  entries in order, and a row beside other kinds.
- **Postgres 16** (local): the real statement, untyped parameters, ids 12
  and 13 on a table that had lost rows, a replay refused whole on
  `_meta_pkey`, 22P02 and a unique key refused whole, 42P01 with no `_meta`.
- **Sweep**: 49 mutants, 3 comment-only controls; 47 killed and 2 survivors
  whose observations were then added (both killed on the re-run, the
  control surviving).
- **`/order`, read as a visitor**: the order form's choices are the price
  list, each choice's value the loaf's id; a preview with the entry in the
  page's own read showed it third, value 12.
- **Full suite** on the code commit `a54ceae4`: `8471 / 8471 / 0 / 0`
  locally (the base `c91d1c3e`: `8427 / 8427 / 0 / 0`, the 44 more being the
  two new files). Unit CI on `a15ef170`: run 36815036559, `8471 / 8467 /
  0 / 4` (CI skips its usual four). Site build run 36815036563 on
  `a15ef170`: green, the twelve counts as before (TAP 397, site-build 404).
- **The image rolls on merge**, predicted from git objects:
  `b8c8789aa8e395d6` → `66d4f686aed60de0` (189 inputs, 159 distinct).
- **Not shown**: real model routing, the real picker and designer, and any
  live write.

### Corrected after the owner's review of `f6532d66` (2026-10-01, on the branch; not merged or deployed)

**The owner**: *"Fix these two findings on f6532d66 before merge or
deployment. 1. Handle uncertain row-write outcomes correctly. […] After an
uncertain write or unreadable result, reconcile against the existing request
marker. If it confirms the insertion, return the saved result and settle
billing correctly. If the outcome remains unknown, report that uncertainty and
use the existing review machinery; don't claim nothing changed, invite a fresh
retry, or refund as a confirmed failure. […] 2. Enforce the new canary's
checks. In the addon branch, the after-read verdict must affect the final
pass/fail and exit status. A row-only success containing no saved rows must
fail. […] Keep Test 11 unproven live and accepted tests closed."*

- **Reproduced on `f6532d66`**: a committed entry whose answer was lost was
  answered *"nothing was added. Try again in a moment."*, its reserve
  refunded, and the next message saved it a second time (entries 12 and 13).
  The add-on press exited 0 on an unverified after-read and on a `row`
  success with no saved entry.
- **Corrected** (`docs/history/2026-10-01-add-row.md` §9): a thrown write is
  read as a duplicate, a definite refusal or not knowing; not knowing, and an
  answer that cannot be read back, are settled from the request's key —
  confirmed, the saved entries and one charge; unknown, said as unknown, a
  queued job put under review with the money held and the site paused, and
  the reconcile settling it from the key (an empty key closed before any
  refund); inline, nothing charged. A definite refusal is refused and
  refunded as before. The canary's add-on press passes only on an ok answer
  that, if entries-only, shows its saved entries, and an after-read that
  verified; otherwise exit 1. A pageless addition that verifies passes.
- **Verified free**: the red check on `f6532d66` (14 add-row and 4 canary
  cases fail; the definite-refusal controls, the pageless control and every
  earlier case pass); `test/addon-row.test.mjs` 51 of 51 and
  `test/canary-addon.test.mjs` 13 of 13; the full suite `8491 / 8491 / 0 / 0`
  on `31741f6f`; the image `b8c8789aa8e395d6` → `ae09ff19611cba11` on merge.
- **CI on `31741f6f`**: unit run 36818860221, `8491 / 8487 / 0 / 4`; site
  build run 36818860242, green, the twelve counts as before. **The sweep**
  (`scripts/mutants/row-uncertain.json`): 34 of 34 killed, the 3 controls
  survived.
- **Its limits were superseded by the next correction**: the owner's review
  of `31741f6f` found that a refused review mark still refunded a saved
  entry. That limit was recorded here, and a test asserted it.
- **Test 11 stays unproven live**; no accepted test is reopened.

### Corrected after the owner's review of `31741f6f` (2026-10-01, on the branch; not merged or deployed)

**The owner**: *"Fix the remaining unknown-outcome path on 31741f6f. In
aRowsUnknown, a failed edit_publish_mark still falls through to ordinary
failure/refund. […] Establish durable protection before issuing the row
write. If that protection cannot be confirmed, do not issue the write. Once a
write may have happened, the consumer and sweeper must preserve its uncertain
state until the request marker settles it. Keep refunds tied to confirmed
non-application, and billing claims tied to recorded outcomes. […] Also
correct addonVerdict's failure wording: a row-uncertain answer must not be
described as "a completed round trip that added nothing." […] Keep Test 11
unproven live and leave CLAUDE.md alone."*

- **The defect** (on `31741f6f`): the review mark came after a write the step
  could not see. A refused mark left the job unmarked, so the consumer
  refunded a saved entry, nothing held the site, and the next message saved
  it again. A test asserted that behaviour.
- **Corrected** (`docs/history/2026-10-01-add-row.md` §10):
  - **Protection is established before the write.** Under a job, after the
    reserve, `edit_publish_mark` is sent with the request's key, and a mark
    that is refused or unanswered means no statement is sent (`row-unprotected`,
    *"nothing was added"*, the reserve given back).
  - **Once marked, the job is never refunded as unsaved.** The consumer's
    refund, the lost-job sweep and a redelivery with no stored request all
    park it, and only the key settles it.
  - **The money is kept only on a recorded outcome** (`edit_committed`, after
    the entries were read back).
  - **A refunding review keeps the step's own definite reply.**
  - **The canary's line for an unsure answer** says the change may be on the
    site, never that the round trip added nothing.
- **Verified free**:
  - The red check on `31741f6f`: 14 of 61 add-row cases fail (12 with only
    the export added, the sweep case with the protection refused among them)
    and 2 of 15 canary cases fail.
  - `test/addon-row.test.mjs` 61 of 61 and `test/canary-addon.test.mjs` 15
    of 15.
  - The sweep (`row-uncertain.json`): 48 of 48 killed, the 3 controls
    survived. The add-row sweep was stopped at 21 of 49 killed, none
    surviving, to hand over.
  - The image rolls `b8c8789aa8e395d6` → `7e03604050b345c0` on merge.
  - The full suite: `8503 / 8503 / 0 / 0` locally (8,491 on `31741f6f`,
    plus the 10 and 2 new cases).
- **Remaining limits** (backlog, *THE ADD-ON `row` STEP'S KNOWN LIMITS*):
  - a site under review refuses new messages with the general "stopped while
    publishing" sentence;
  - inline (queue switch off only) nothing pauses the site;
  - a cancel does not stop the row write;
  - the site is not held busy between a dead consumer's lease and the sweep;
  - a definite refusal under a job is refunded through the review.
- **Test 11 stays unproven live**; no accepted test is reopened.

### Corrected after the owner's review of `c3e310e6` (2026-10-01, on the branch; not merged or deployed)

**The owner**: *"Fix the remaining pre-write race on c3e310e6. The reviewer
checked the live Supabase function read-only: edit_publish_mark checks only
`id = p_id AND lease_owner = p_owner`. It does not reject an expired,
terminal or refunded job, and edit_refund preserves lease_owner. […] Make
the pre-write guard establish that the job is both eligible to write and
protected. If refund or termination wins the race, issue no row write. […]
Reuse existing guarded job operations if they enforce this correctly. If a
database-function change is necessary, prepare it for review without
applying it live. Preserve exempt-account behavior. Add focused coverage for
this exact interleaving and the opposite ordering […] No merge, deployment,
live SQL changes, paid calls or live data writes. Test 11 remains unproven
live."*

- **The defect** (on `c3e310e6`, reproduced through the real route and
  consumer): the mark answers yes to a refunded job's holder. A consumer that
  stalled after its reserve, while the sweep refunded its unmarked job, wrote
  the entry on resuming: 7 entries, billing `refunded`, a success reply with
  its cost.
- **Corrected** (`docs/history/2026-10-01-add-row.md` §11), with no database
  change: the guard is three yeses, in this order.
  - **The gate**, `edit_may_publish`, the publish spine's own: one
    conditional update, granted only to the lease's live holder of a job not
    finished, refunded, cancelled or under review, and billed (`reserved`,
    or `exempt`), beginning the write in the same statement. A job no longer
    eligible is refused and never touched.
  - **The mark**, for the request's key, unchanged.
  - **The gate again, last**, so a refund that wins after the first gate
    (the consumer stalled past its publish lease) still stops the write.
  - A refund that loses finds the write begun and parks the job; the key
    settles it, as before. The step's definite reply is kept by the
    publish's reconcile too, for a job parked with no key.
- **Verified free**:
  - The red check on `c3e310e6`: 7 of 84 cases fail (69 add-row, 15
    canary). They include the reviewer's interleaving ("the entry was written
    after the refund won"), both eligibility cases, and the refund after the
    first gate ("a row was written by a job the review had refunded").
  - `test/addon-row.test.mjs` 69 of 69 and `test/canary-addon.test.mjs` 15
    of 15. The opposite ordering (protection wins; the uncertain write held
    until the key keeps it: one entry, one charge) and the exempt account
    pass, on `c3e310e6` too.
  - The sweep (`row-guard.json`, with the four moved `row-uncertain.json`
    mutants): 16 of 16 killed, the control surviving. One equivalent
    candidate was replaced (§11.5).
  - The full suite: `8511 / 8511 / 0 / 0` locally (8,503 on `c3e310e6`, plus
    the 8 new cases).
  - The image rolls `b8c8789aa8e395d6` → `c051f625db27b5b7` on merge. CI on
    `c3e310e6`: unit `8503 / 8499 / 0 / 4` (run 36828211851); the site build
    green (run 36828211849).
- **Closed limits**: a cancel asked before the statement now stops it, and
  the site is held busy from the gate on.
- **Remaining limits** (backlog): a consumer that dies after the gate holds
  its site until the publish lease runs out (about six minutes); a consumer
  that resumes after the review refunded its job parks it once more, settled
  again at once with no money moving; and the earlier ones (the general
  "stopped while publishing" sentence, inline, a definite refusal through
  the review).
- **Test 11 stays unproven live**; no accepted test is reopened.

### Merged and deployed (deploy 2175, 2026-10-01)

**The owner**: *"The fix on 2188f706 passes review. Wait for its site-build
CI to finish successfully. If it fails, diagnose and report before merging.
Once both required checks are green, merge the reviewed changes into main and
monitor deployment. Confirm the deployed commit and expected container image
from the actual build inputs. Then run the existing non-spending runtime
check. Try dispatch once; if it returns the known 403, stop and give me the
exact workflow inputs, each separately copyable. Deployment success and
runtime confirmation must be recorded separately. After runtime
confirmation, prepare Test 11's existing add-one-loaf request with the
current credit balance and updated cost estimate. Do not run the paid test
yet."*

- **CI on `2188f706`**: unit run 36832053188, `8511 / 8507 / 0 / 4`; the
  site build, run 36832053168, `success`, its twelve counts as recorded.
- **Merged**: `main` fast-forwarded `322c2430` → `2188f706` (10 commits) at
  08:09:23Z, after the rollback, the image prediction and the served
  `chat.js` before-reading.
- **Deployment, deploy 2175** (run 36834581890, `success`): the Worker's
  `DEPLOY_ID` is `2188f706…`; the image was built as predicted,
  `c051f625db27b5b7` from 189 inputs, and the container moved
  `b8c8789aa8e395d6` → `c051f625db27b5b7` at 08:17:51Z; `/chat.js` was the
  one asset uploaded, and the served file is byte-identical to the merged one.
  The drain found no live leases. `docs/deploy-record.md`.
- **Runtime confirmation**: pending. The session's one dispatch of the free
  canary press (08:32:55Z, after the image hold) answered 403 and was not
  retried; the press is the owner's.
- **The test itself is not run.** It is prepared after the runtime check
  reads the Worker and a cold container, with the balance that check reads.

### Deploy 2176, and the press prepared again (2026-10-01)

**The owner**, passing the CI change: *"Merge them into main and monitor
deployment. […] Confirm deployment succeeds and reuses image
c051f625db27b5b7. Then provide the exact inputs for ONE free runtime check
using the newly deployed commit. Don't request a separate check for the old
deployment or repeat the known 403 dispatch attempt. After runtime
confirmation, return to Test 11 […] Prepare it with the current balance and
estimated cost; paid execution remains pending approval."*

- **Deploy 2176** (run 36844328324, `success`): `main` fast-forwarded
  `2188f706` → `78a95a47` at 09:41:11Z, the CI change only. The image was
  reused, `c051f625db27b5b7` from 189 inputs, as predicted on both ends, and
  the Worker's `DEPLOY_ID` is `78a95a47…`. **The product code is deploy
  2175's**, so the one free runtime check names `78a95a47` and serves for
  both. No dispatch was attempted. `docs/deploy-record.md`.
- **The starting state, re-read** (09:43:29Z, free, as a visitor, with the
  canary's own fixture code):
  - `loaves` read whole: 200, `0-5/6`, 1,045 bytes, sha256 `ef870ebc…`,
    the same bytes as the baseline above;
  - the rows box below reads *"as named: 6 rows; the target is id 6, and the
    other 5 digest to 093f2130a37a6704"*;
  - the page's own read in price order: Sea Salt Focaccia £4.50 (id 6),
    Country White £4.80 (1), Dark Rye £5.20 (2), Seeded Wholemeal £5.40 (3),
    Olive & Rosemary £5.80 (4), Walnut Levain £6.00 (5);
  - `/`, `/order`, `/gallery`, `/starter` and `/visit` all 200 at
    `01790819484141-dgmag4`.
- **The paid press** (prepared, **not pressed**: it waits for the runtime
  check, the balance that check reads, and the owner's approval). Edit
  canary, from `main`:
  - "Run the ONE paid edit as well (yes/no)": `yes`;
  - "What to change. REQUIRED when spend=1 …": the request above, *Add one
    loaf to today's loaves: Rye & Caraway at £5.00, described as "A light rye
    with toasted caraway."*;
  - "The site to edit. …": `fold-lane-bakery`;
  - "Refuse to spend unless the Worker reports this deploy sha …":
    `78a95a47bfe5eaf3880fdcfd07f8bb4e083031b7`;
  - "Refuse to spend unless a cold container reports this image id (exact)
    …": `c051f625db27b5b7`;
  - "Refuse to post the paid edit unless the router answers this: …":
    `intent=addon alsoAsked=none`;
  - "Refuse to route or spend unless one table, read whole as the site serves
    it, is as named: …": Test 10's box, unchanged,
    `{"table":"loaves","baseline":"093f2130a37a6704","target":{"id":6,"name":"Sea Salt Focaccia","description":"A tray bake, heavy on the oil, finished with flaky salt.","price":4.5,"photo":null,"created_at":"2026-08-21 23:06:23"}}`;
  - every other box as it stands.
- **The cost**: about 3–4 credits, not a cap: routing 1–2, then the add-on
  step's own charge (the picker and the row designer, billed once, measured
  at 2 for an addition that changes no page). Under a job that charge is
  reserved **after** routing is paid and before the entry is written, and a
  refused reserve stops the step with nothing added. **So the balance must be
  at least 4 before the paid press (5 leaves a margin)**: at the last
  reading, 3, routing would be paid and the addition could then be refused.
  The runtime check reads the balance now.
- **Runtime-confirmed by the owner's free press, run 85** (36846351799,
  10:00 UTC, from `main` at `78a95a47`, spend `no`, on `fold-lane-bakery`):
  both readers answered `78a95a47bfe5`, a cold container answered
  `c051f625db27b5b7`, and queued jobs and the runner were on; the free job
  settled at cost 0 (`empty`); ALL FREE CHECKS PASSED; nothing was charged.
  Its before-read: the five pages at `01790819484141-dgmag4`, the source
  read complete. The evidence zip's digest is `35851d44…`, as the log
  printed. A free press reads the balance only; the ledger is read on a
  paid run.
- **The balance is 3** (run 85, 10:00:48 UTC), **below the 4 the paid press
  needs.** So Test 11 is prepared and **not pressable yet**: the balance has
  to be raised first (to at least 4, 5 for a margin), and the paid press
  needs the owner's approval. Its boxes are the ones above, unchanged.
- **The starting state, re-read after run 85** (10:01:39Z, free, as a
  visitor): `loaves` 200, `0-5/6`, 1,045 bytes, sha256 `ef870ebc…`, the rows
  box *"as named"*; the five pages 200 at `dgmag4`, the same bytes as at
  09:43. Nothing has changed.

### Run 86: the paid press, refused by the route check (2026-10-01)

- **The press**: edit canary run 86 (36908358798), pressed by the owner at
  18:38 UTC from `main` at `78a95a47`, spend `yes`, on `fold-lane-bakery`,
  with the boxes as handed over (deploy `78a95a47…`, image
  `c051f625db27b5b7`, route `intent=addon alsoAsked=none`, Test 10's rows
  box). It was pressed at a balance of 3, below the 4 asked for, with the
  owner's word *"also it may fail but top it up"*.
- **Every check before routing passed**:
  - both readers answered `78a95a47bfe5`, a cold container
    `c051f625db27b5b7`, and queued jobs and the runner were on;
  - the free job settled at cost 0, and ALL FREE CHECKS PASSED;
  - the source read was complete, with the five pages at `dgmag4`;
  - the balance read 3;
  - the rows box read *"as named: 6 rows; the target is id 6, and the other
    5 digest to 093f2130a37a6704"*.
- **The router answered `intent=edit layer=data`**: cost 2, 19.6 s,
  grok-4.6. The press sent no table names, so the route filled them
  (`loaves`, `orders`), as Lane 1d does.
- **The route check refused before posting the edit**: *"intent: expected
  addon, the router answered edit"*. Nothing else ran: no job, no row, no
  publish. The evidence zip's digest is `aa9bfea6…`.
- **The money**: 3 → 1 at 18:39:51 UTC, routing 2 only, read directly
  afterwards. Routing writes no ledger row (the last is still 349), and no
  job is open.
- **The bakery is unchanged** (18:41 UTC, free, as a visitor):
  - `loaves` 200, `0-5/6`, sha256 `ef870ebc…`, the rows box *"as named"*;
  - the five pages at `dgmag4`;
  - the pages' bytes differ from run 85's only in the render timestamp and
    the Visit page's live hours badge: "Open now … until 2 PM" at 10:00 UTC,
    "Closed … opens 8 AM tomorrow" at 18:39.
- **Why the router answered `data`** (read free in `builder/site-ask.mjs`):
  its wording never says where an added row goes.
  - The `intent` field's `addon` clause names a page, a table for something
    the site has no table for, and a section or similar on a page. It does
    not name an entry added to a list the site already stores.
  - Its tie-break asks *"does the thing they name exist on the site now? It
    does — "edit""*, and the loaves list exists.
  - The `data` clause says to prefer it *"whenever the thing being changed
    is one row of something the site lists"*.
  - The comment at that clause still reads *"whether an added row is this
    layer or the add-on step is the owner's open decision, and nothing here
    says"*.

  So the owner's rule (*"add will always go in addon"*) is not in the
  wording for a row, and the add-on step's `row` kind, built for Test 11, was
  not reached by the real router for this message. This is one sample.
- **Not checked**: whether the data step itself can add a row. Reading its
  tool was refused by this session's permission check, and was not tried
  again.
- **Status: Test 11 is not passed** (nothing was added). The route check did
  its job: the edit was not posted down a route the press did not expect,
  and only the routing call was paid.
- **The balance after the owner's top-up**: on the owner's word (*"top it
  up"*), it went 1 → 101 at 18:48:46 UTC. Read back at 18:49:27: 101, no job
  open, the ledger's last row still 349. Only the readings are recorded
  here.
- **Next is the owner's decision.** The recommendation is to put the owner's
  rule into the router's wording, so that an entry added to a list the site
  already stores is `addon`. It would be tested with supplied answers,
  merged and deployed on the owner's word, and Test 11 then pressed again
  (about 3–4). Pressing again without that change would most likely spend 2
  on the same answer.

### The router fix (2026-10-01, after run 86, on the owner's word; merged and deployed in deploy 2177 the same day, below)

**The owner**: *"Fix the router for Test 11. Adding a NEW record to an
existing table/list must select addon. The parent list already existing does
not make the new item an edit. […] Make this general across products,
services, team members, etc. No bakery-specific rule or keyword override.
Updating or deleting an existing row remains edit/data; preserve sorting scope
and mixed-request handling. […] Verify the actual request sent to the model;
supplied model answers prove downstream handling, not real classification.
Keep the canary's expected-addon guard. […] Don't merge, deploy, or retry the
paid test yet."*

- **The change** (`builder/site-ask.mjs`, wording only; the history and every
  sentence are in `docs/history/2026-10-01-addon-row-routing.md`). The rule
  is said in four places, for every kind of list:
  - the `addon` clause claims a new entry in a list the site already keeps
    (a product, service, dish, class, event or team member);
  - the edit/addon tie-break is asked of the thing itself, never of what it
    goes into;
  - the data clause prefers itself only for a row the site already stores,
    and sends a new entry to `addon` however cheap `data` is;
  - the system's cost rule says cost never makes a new entry an edit.

  The obsolete "owner's open decision" comment is gone.
- **Unchanged**: the route (no keyword rule), changing or deleting an
  existing row (`edit` + `data`), both sort sentences, the hold rule, the
  whole-message rule and the canary's route check.
- **Tests** (`test/router-row-add.test.mjs`, 12 cases), by what each shows:
  - **six read the wording**;
  - **two read the request as it leaves the real routing route**, to xAI
    with no picker (the canary's call and run 86's router) and to Anthropic;
  - **four supply the router's answer**, so they show handling and never
    classification:
    - `addon` goes on, and Test 11's box would post it;
    - run 86's `edit` + `data` comes out as given, with or without "add",
      and the box refuses it;
    - an update, a deletion and a site-wide sort stay data edits;
    - a mixed message keeps its hold.
  - **One guard revised** (`test/router-row-removal.test.mjs`): it required
    the data clause to say nothing about adding, from the 2026-09-30 *"Do not
    decide or change add-row routing"*.
- **Measured**:
  - the router's 48 test files: 1,758 of 1,759 before the guard's revision,
    the one failure being that guard;
  - red check on the old wording: 9 of 21 fail, the 8 wording and request
    cases and the revised guard. The 4 supplied-answer cases pass on both.
  - sweep: 19 of 19 killed, the 2 comment-only controls survived, nothing
    left unapplied;
  - after the revision, the router's 49 test files 1,771 of 1,771, and the
    full unit suite `8543 / 8543 / 0 / 0` locally;
  - **required CI green on `710ad704`**: unit tests run 36914783961,
    `8543 / 8539 / 0 / 4`; site build run 36914784000, *"ALL CHECKS: 404
    checks in 27 sections across 4 shards, every job green"* at inputs
    `899b2151f6729573`, the other counts as before.
- **A deploy would roll the image**, `c051f625db27b5b7` → `9a71a6384b4206a2`
  (189 inputs), because the router file is one of its inputs.
- **Real classification is not shown**: only a live press after a merge and a
  deploy can show which answer a real model gives. Test 11's paid press is
  not retried.

### Deploy 2177: the router fix merged, and Test 11's retry prepared (2026-10-01; not pressed)

**The owner**, after the broad plan: *"Pause the broad test plan and
batch-runner work. Focus only on the routing issue from run 86. Complete the
approved merge and deployment of the reviewed router fix through 25faac78,
reusing the existing passing CI evidence. Then prepare the original Test 11
request […] Keep the expected route intent=addon alsoAsked=none and verify
that exactly one correct item is added without unrelated changes. Use the
canary's existing runtime checks before spending. Provide the updated
deployment/image inputs and estimated cost before the paid retry. Don't
expand into other capabilities or treat mocked answers as proof that routing
works."*

**Checked before the merge** (22:46–22:50 UTC):
- **a fast-forward**: `main` (`78a95a47`) is an ancestor of `25faac78`;
  everything after `710ad704` is documents;
- **the existing CI, reused, not repeated**:
  - unit tests on `25faac78` itself, run 36916597462: `success`, **`8543 /
    8539 / 0 / 4`** (the total as on `710ad704`, run 36914783961);
  - site build run 36914784000 on `710ad704`: `success`, the gate *"ALL
    CHECKS: 404 checks in 27 sections across 4 shards, every job green"* at
    inputs `899b2151f6729573`. **`25faac78` prints the same fingerprint**
    (3,967 files), so that run covers it;
- **the image predicted at both ends**: `78a95a47` → `c051f625db27b5b7`,
  `25faac78` → **`9a71a6384b4206a2`** (189 inputs, 159 distinct paths). The
  router file is an input, so the image rolls;
- **the rollback**: reverting `78a95a47..25faac78` in a throwaway worktree
  gives main's own tree (`fe877d94…`);
- **nothing in flight**: no Actions run in progress or queued; no edit job
  open (the only two rows not `done` or `failed` are `lost` jobs from 1 and 2
  September, refunded);
- **nothing under `public/` changed**, so no served-file reading is owed.

**Merged and deployed: deploy 2177** (run 36937413961, `success`):
- `main` fast-forwarded `78a95a47` → **`25faac78`** at 22:50:07 UTC,
  through `25faac78` exactly (the branch's later commits, the paused broad
  plan, stay off `main`);
- **the image was built and rolled as predicted**: `built
  isibi-app-sitebuildcontainer:9a71a6384b4206a2 (registry answered 404; 189
  inputs off ./Dockerfile)`, then Wrangler's `- c051f625db27b5b7` / `+
  9a71a6384b4206a2` and `SUCCESS Modified application` at **23:05:58 UTC**;
- the Worker's `DEPLOY_ID` is `25faac78…`; no asset changed;
- the job took 15m50s, almost all of it one image layer's upload to the
  registry (about 13½ minutes); the build itself was quick
  (`docs/deploy-record.md`).

**Deployed, not runtime-confirmed.** Container work waits 15–20 minutes
after the roll, so the free runtime check is **not to be pressed before
23:26 UTC**. No dispatch is attempted (the known 403 is not repeated).

**Test 11's starting state, re-read** (22:52:06 UTC, free, as a visitor, with
the canary's own fixture code):
- `loaves` read whole: 200, `0-5/6`, 1,045 bytes, sha256 `ef870ebc…`, the
  same bytes as run 86's after-read;
- the rows box reads *"as named: 6 rows; the target is id 6, and the other 5
  digest to 093f2130a37a6704"*;
- in price order: Sea Salt Focaccia £4.50 (id 6), Country White £4.80 (1),
  Dark Rye £5.20 (2), Seeded Wholemeal £5.40 (3), Olive & Rosemary £5.80
  (4), Walnut Levain £6.00 (5);
- `/`, `/order`, `/gallery`, `/starter` and `/visit` all 200 at
  `01790819484141-dgmag4`.

**The money** (22:53 UTC, Supabase, non-secret columns): balance **101**,
unchanged since the top-up at 18:48:46; the ledger's last row is still 349;
no job open.

**Press 1, the free runtime check and rehearsal** (the owner's press; no
dispatch is attempted). Edit canary, from `main`, **only after
23:26 UTC**, so that the rolled image is serving:
- "Run the ONE paid edit as well (yes/no)": `no`;
- "What to change. REQUIRED when spend=1 …": exactly this one line (the
  request below):
  ```text
  Add one loaf to today's loaves: Rye & Caraway at £5.00, described as "A light rye with toasted caraway."
  ```
- "The site to edit. …": `fold-lane-bakery`;
- "Refuse to spend unless the Worker reports this deploy sha …":
  `25faac78e192ad6923544f90eb7cdb81c8e4c385`;
- "Refuse to spend unless a cold container reports this image id (exact)
  …": `9a71a6384b4206a2`;
- "Refuse to post the paid edit unless the router answers this: …":
  `intent=addon alsoAsked=none`;
- "Refuse to route or spend unless one table, read whole as the site serves
  it, is as named: …": Test 10's box, unchanged,
  `{"table":"loaves","baseline":"093f2130a37a6704","target":{"id":6,"name":"Sea Salt Focaccia","description":"A tray bake, heavy on the oil, finished with flaky salt.","price":4.5,"photo":null,"created_at":"2026-08-21 23:06:23"}}`;
- every other box as it stands.

What it shows, at no cost: both readers answer `25faac78e192`, a cold
container answers `9a71a6384b4206a2`, queued jobs and the runner are on, the
free job settles at cost 0, the route box is read (*"this run does not
spend, so it routes nothing"*), the table is read whole and as named, and it
stops before any routing call. **It does not route**, so it says nothing
about how the real router classifies the request.

**Press 2, the paid retry** (after press 1 passes, and only on the owner's
approval): the same boxes with "Run the ONE paid edit as well (yes/no)":
`yes`.
- **The request, the original, byte for byte as run 86 sent it** (104
  characters, 105 bytes, sha256 `7cc5f1ca7ec8bcc3…`; the quotes inside are
  straight double quotes): *Add one loaf to today's loaves: Rye & Caraway at
  £5.00, described as "A light rye with toasted caraway."*
- **The routing check**: the real router must answer `intent=addon` with
  nothing held back. Any other answer is refused before anything is posted,
  as run 86's was; only routing is paid. **This is the only evidence of real
  classification**: the router's supplied-answer tests prove handling, not
  what a real model chooses.
- **The canary's own checks after the add-on step**: it answered ok; its
  kinds are exactly `row` (printed as `step addon kinds=…`; any other kind,
  such as a hand-written card on `/order`, fails Test 11 whatever the
  canary's verdict says); it names the entry the database saved (`loaves #N “Rye & Caraway”`, with the
  row as stored); the after-read finds the five pages still at `dgmag4`
  (an entry publishes nothing) and the stored description unchanged; the
  balance moved by the charge.
- **My independent checks afterwards** (free, as a visitor, and Supabase):
  - `loaves` read whole: **7 rows** (`0-6/7`);
  - the six existing rows **byte-identical** to the baseline (ids 1–6, every
    field);
  - **exactly one new row**: `name` "Rye & Caraway", `price` 5,
    `description` "A light rye with toasted caraway.", `photo` null, the id
    the database gave it (read back, never predicted), `created_at` its own;
  - `/order`: seven choices in price order, Rye & Caraway £5.00 third (after
    Sea Salt Focaccia £4.50 and Country White £4.80), its card carrying the
    new id as its value. No order is placed;
  - nothing published: every page still at `dgmag4`; `/`, `/gallery`,
    `/starter` and `/visit` byte-identical apart from the render timestamp
    and the live hours badge;
  - **the money**: routing (no ledger row) plus one add-on charge row for the
    job; the balance down by their sum; no job open;
  - **the reply** names the loaf, the list and the id, and matches what was
    saved.
- **Estimate: about 3–4 credits**, not a cap: routing 1–2 (run 86's was 2),
  then the add-on step's own charge (the picker and the row designer, billed
  once, measured at 2 for an addition that changes no page), reserved after
  routing and before the entry is written. At a balance of 101 the money is
  no constraint.

**Not shown until press 2**: how the real router classifies this request
after the fix.

**Press 1 passed: run 87** (36940738610, the owner's press at 23:25:37 UTC,
19½ minutes after the roll, from `main` at `25faac78`, spend `no`, with the
boxes above):
- **the runtime**: both readers answered `25faac78e192`, and a cold
  container answered `9a71a6384b4206a2`; queued jobs and the runner on;
- **the zero-cost confirmations**: the async shapes on the bakery and on
  `washhouse-3`, a forged replay marker and a foreign poll both 404, and the
  free job settled `empty` at cost 0; **ALL FREE CHECKS PASSED**;
- **the before-read**: the source read complete; the five pages at
  `01790819484141-dgmag4`, the same byte sizes as the 22:52 read; the stored
  description unchanged; the balance 101;
- **the route box** read as `intent=addon alsoAsked=none`, *"this run does
  not spend, so it routes nothing"*;
- **the rows box**: *"as named: 6 rows; the target is id 6, and the other 5
  digest to 093f2130a37a6704"*;
- *"CANARY_SPEND is not 1 — stopping before the paid edit. Nothing was
  charged."* The evidence zip's digest is `73b0d215…`;
- **the money, read again in Supabase**: balance 101, the ledger's last row
  349, no job open; the two free jobs (`52ab9449…`, `c47d529b…`) `failed`
  with billing `none` and cost 0.

**Deploy 2177 is runtime-confirmed.** Press 2, the paid retry, is next, on
the owner's approval, with the same boxes and "Run the ONE paid edit as well
(yes/no)" `yes`. It sends run 86's request again, now to the deployed
wording, and it is the only evidence of how a real model now classifies
it.

### Run 88: the paid retry — every condition met (2026-10-01, 5 credits; for the owner's review)

- **The press**: edit canary run 88 (36942972947), pressed by the owner at
  23:51:04 UTC from `main` at `25faac78`, spend `yes`, on
  `fold-lane-bakery`, with the boxes above. Every check before routing
  passed again: both readers `25faac78e192`, a cold container
  `9a71a6384b4206a2`, ALL FREE CHECKS PASSED, the source read complete with
  the five pages at `dgmag4`, balance 101, the rows box *"as named"*.
- **The route answered `intent=addon`, with nothing held back**:
  `routed in 8.3s: intent=addon layer=- page=- cost=3`; *"the route matches
  the expectation (intent=addon alsoAsked=none); the answer is posted as it
  came"*. Run 86 sent the same sentence to the old wording and got
  `edit`/`data`. One sample: how often, and for other lists and wordings, is
  not measured. **Corrected 2026-10-02 (the owner's review of the router
  audit)**: this is the route's answer, not proof of the raw model's choice.
  The route turns several unusable answers into `addon` and its reply cannot
  say which happened (the audit's R3). For this sentence the realistic
  wrong answer (`edit`/`data`, run 86's) passes through unchanged and would
  have shown, so `addon` was very likely the model's own; the decision
  report, once deployed, is what can show it.
- **The add-on step**: job `b83b059c…`, posted 23:51:56, settled after 20.2
  s with a stored reply: `{"ok":true,"kinds":["row"],"rows":[{"table":
  "loaves","id":7,"label":"Rye & Caraway","row":{"id":7,"name":"Rye &
  Caraway","description":"A light rye with toasted caraway.","price":5,
  "photo":null,"created_at":"2026-10-01 23:52:15"}}],"added":[],
  "changed":[],"removed":[],"moved":[],"cost":2}`. **Kinds exactly `row`.**
- **The customer's reply**, from the browser's own composer: *"✅ Done —
  added “Rye & Caraway” to loaves (entry 7)."* It matches what was saved.
- **The canary's verdict**: the after-read VERIFIED (no publish; every page
  still `01790819484141-dgmag4`, the headings in the same order and the same
  word counts; the stored description unchanged): *"CANARY PASSED: the
  add-on step answered ok — saved loaves #7 “Rye & Caraway”; no page
  published; cost=2"*. The evidence zip's digest is `15972521…`.
- **Verified independently afterwards** (23:52–23:58 UTC, free):
  - **the table**, read whole as the site serves it: 200, **`0-6/7`**, 1,188
    bytes, sha256 `4fbe7da4…`. **The six existing rows are unchanged**: ids
    1–5 still digest to `093f2130a37a6704`, and id 6 is exactly as named.
    **Exactly one row beyond them**: id 7, "Rye & Caraway", price 5, "A light
    rye with toasted caraway.", photo null, `created_at` 2026-10-01
    23:52:15. The id is the database's;
  - **`/order` in a browser** (Chromium fed by Node's verified fetches; reads
    only): the page reads `loaves?select=*&order=price.asc` and lists seven
    choices, Sea Salt Focaccia £4.50 (6), Country White £4.80 (1), **Rye &
    Caraway £5.00 (7)**, Dark Rye £5.20 (2), Seeded Wholemeal £5.40 (3),
    Olive & Rosemary £5.80 (4), Walnut Levain £6.00 (5). The new card
    carries the value `7`, so the order form would order it. No order was
    placed. The only console errors were the harness's own refusals of
    Cloudflare's analytics POSTs (`/cdn-cgi/rum`);
  - **nothing else changed**: the five pages still serve `dgmag4` with their
    before-read sizes, and are byte-identical to run 86's before-read once
    the 13-digit render stamps and the live hours badge are masked;
  - **the money** (Supabase): 101 → **96**. Routing 3 writes no ledger row;
    the job's one row is 350 (`b83b059c…#1`, `reserve`, −2, balance after
    96), and the job is `done`, billing `finalized`, cost 2, `needs_review`
    false. Its `published_at` (23:52:15) is the job's write mark under the
    publish gate, not a site publish: every page still serves `dgmag4`. The
    two free jobs (`49be0006…` on the bakery, `df340b76…` on `washhouse-3`)
    are `failed`, billing `none`, cost 0. No job open.
- **Cost: 5 credits, one above the 3–4 estimate.** Routing cost 3, against
  the 1–2 measured before (run 86's was 2): the routing prompt is longer by
  the four new sentences, and routing's cost moves with the prompt cache.
- **Status: Test 11 passed on every condition**, for the owner's review and
  closure. What it shows: one new entry in a list the site already keeps,
  routed `addon` by the real router after the fix, written by the add-on
  step's `row` kind with the real picker and designer, exactly one row, no
  page changed, the reply true. What it does not show: other phrasings,
  other kinds of list, several entries in one message, or a mixed message.
  The demo data stays: the bakery now lists seven loaves.

## Test 10 — a stored list re-sorted, with real models (prepared 2026-09-30 on the owner's word, after Test 9 was closed; free preparation only; the order traced on all three demo sites; rehearsed with supplied answers through the real lane and the real edit route; decision 2b taken by the owner the same day with a scope correction: a sort across the whole site goes to the data sorter, a sort limited to one named page to the page editor, and no "whatever page they saw it" rule; the rule implemented on the branch with committed route coverage, and its scope corrected on 2026-10-01 so that a selection of pages is never sent to the sorter; passed by the owner and merged and deployed in deploy 2174 (2026-10-01); the request revised to state its scope; the baseline read; the authorized free dispatch refused (403); the owner's free press, run 83, confirmed the runtime and rehearsed Test 10, passing every check; the paid press run as run 84, 3 credits, every acceptance item met; closed by the owner the same day for run 84's demonstrated request, the bakery left at `dgmag4`, not to be repeated)

**The owner**: *"Next, prepare one list-reordering acceptance on an existing
demo site. First trace what controls its order: a stored ordering field, a
database query, or page code. Establish the supported edit path and choose a
request that visibly changes the order. Don't assume every reordering belongs
to the data layer or change routing policy merely to make the test pass.
Provide the exact request, expected route and changes, checks that unrelated
content stays unchanged, and credit estimate. If a product decision is
genuinely required, explain that specific decision with your
recommendation."*

### What controls a list's order (traced 2026-09-30, free)

**Page code, on every list of all three demo sites.** A page reads a list
with `useRows("<table>", { order, dir })`. The template's `pgQuery`
(`builder/lovable/template/src/lib/rows.ts`) turns those two values into the
Data API's `order=<column>.<dir>`, so Postgres does the sorting, by whatever
the page names. No table has an ordering field, and the schema's
`defaultSort` is acted on by nothing (`builder/site-order.mjs`).

| Site | List | Read on | Order today | Notes |
|---|---|---|---|---|
| `fold-lane-bakery` (`8btpep`) | `loaves` | `/order` | `name` asc | one page; columns `id`, `name`, `description`, `price`, `photo`, `created_at`; English only |
| `fretwork-1` (`kk6qsh`) | `lessons` | `/`, `/prices` | `price` asc | two pages; the site has Welsh, French and Spanish pages, so a publish reaches the parked translator |
| `fretwork-1` | `bookings` | `/` | `appointment_date` asc, at most 100 | visitors' bookings (`usePublicRows`), not a list the owner edits |
| `lido-axes-b` | `menu_items` | `/`, `/menu` | `name` asc | two pages; then grouped in page code by category, in the order of a `SECTION_ORDER` constant on each page, the home page showing two per category (from run 44's stored source) |

**Measured live on the bakery** (22:42–22:51 UTC, read-only):
- `/order` at `8btpep` sends `loaves?select=*&order=name.asc` and shows the
  six loaves A to Z;
- `loaves`, read whole (`0-5/6`, 1,045 bytes, sha256 `ef870ebc…`), has no
  ordering column, and its six prices are all different;
- every page answers 200 at `8btpep`, `/the-starter` answers 301 to
  `/starter`, and no page declares another language.

**So "the order" is three different things, and they live in different
places:**
1. **Which column a stored list is sorted by**: the list's read, in page
   code. The data rung's sort lane rewrites it on every page reading that
   table.
2. **How page code arranges the list after reading it**: `lido-axes-b`'s
   grouping by category, its `SECTION_ORDER`, and the home page's two per
   category. That is page code proper: the `page` rung, one page at a time.
3. **A hand-picked sequence** ("put the Walnut Levain first"): nothing can
   keep one. It needs a stored position per row, which is a schema change, a
   backfill and a page rewrite (`site-order.mjs`'s own note), and no lane
   does that.

The menu's order (`nav`) and a page's sections (`look`, `page`) are
separate again, already routed and shown live.

### The supported edit path, and where the router sends a reorder today

- **The sort lane, in the data rung** (`DATA_TOOL.order` →
  `readSortChange` → `applySort`, `builder/site-order.mjs`):
  - the picker is shown each list and the order it comes out in, and may
    answer one table, one of its columns and a direction;
  - the lane rewrites the `{ order, dir }` of every `useRows` call for that
    table, on every page, and the pages are published (the one data change
    that publishes). No row is written;
  - it refuses a column the list does not have (sorting by one would empty
    the list on every page) and a read whose options are computed.
- **The `page` rung can also change one page's read.** A writer model
  rewrites that one file (the quick writer about 2 credits, the full writer
  6–22). It never rewrites other pages showing the same list; it only
  reports them (`orderingMoved`).
- **The router has no clause for a list's order.**
  - `data` is described as rows: *"prefer it whenever the thing being
    changed is one row of something the site lists"*;
  - `page` includes *"lay a list out differently"*, on one page;
  - `nav` has the menu's order;
  - the look door has no lane for a list's sort (`behavior` is what a
    control does, `shape` a page's sections).

  So a real "list the loaves cheapest first" may be answered `data` or
  `page`, and which is unmeasured.

### Rehearsed free (scratch, not committed; supplied answers only)

- **The real lane** (`runDataEdit` on the bakery's stored `8btpep` pages and
  its live rows):
  - the picker is shown *"THE LISTS THIS SITE SHOWS, AND THE ORDER THEY COME
    OUT IN: loaves — ordered by name asc"* and *"WHAT EACH ONE MAY BE ORDERED
    BY: loaves: name, description, price, photo"*;
  - given `order: {table: "loaves", column: "price", dir: "asc"}`, it
    changes exactly one line of the whole site: `order.tsx` line 97,
    `{ order: "name", dir: "asc" }` → `{ order: "price", dir: "asc" }`. The
    four other pages are untouched, and no row is written;
  - its sentence: *"✅ loaves now comes out in order of price, lowest first
    — on 1 page."*
- **The real edit route and the browser's own reply handler** (the
  synchronous path, with `test/edit-failure.test.mjs`'s harness given the
  bakery's pages and rows):
  - status 200, one picker call, 1 credit;
  - no UPDATE, INSERT or DELETE;
  - one compile and one publish;
  - the stored `order.tsx` differs in that line alone, and the other four
    pages are byte-identical;
  - the screen shows the same sentence.
- **The lane's guards**, the same code:
  - "Put the Walnut Levain at the top" (a hand-picked sequence) ends
    `no-match`, which the customer reads as *"I couldn't match that to
    anything the site stores …"*. That is misleading (backlog);
  - "by popularity" (no such column) is refused, naming the list's columns;
  - "A to Z" (the order it already has): *"loaves already comes out in that
    order — nothing to change."*;
  - "most expensive first" writes the same line with `dir: "desc"`.
- **What a visitor would see** (a preview, read-only: the live `/order` with
  its own data request rewritten in the browser to `order=price.asc`, which
  is all the one line changes): Sea Salt Focaccia £4.50, Country White
  £4.80, Dark Rye £5.20, Seeded Wholemeal £5.40, Olive & Rosemary £5.80,
  Walnut Levain £6.00. Five of the six cards move. Compared pixel by pixel
  with the live page, only the card list differs (the box 369,354–807,672 of
  1280×1400).
- **Not shown**: what a real router or picker answers; the queued path's
  publish of a sort (read, not driven); anything live.

### The decision (2b), as the owner took it (2026-09-30)

**Prepared**: the expected route is part of the acceptance, and the router
had no rule for a list's order, so the same sentence could land on `data` or
`page`. I recommended `data` for a sort, with a clause sending a sort there
"on whatever page they saw it".

**Decided, with a scope correction**: *"Use the existing data-sort lane for
site-wide sorting by an existing column. Requests limited to one page should
use the existing page editor while the data sorter remains site-wide. Do not
add the proposed 'whatever page they saw it' rule. Different pages may
intentionally use different orders."*

**The rule, as first implemented** (`builder/site-ask.mjs`, two sentences;
**its scope corrected on 2026-10-01**, below, and merged and deployed in
deploy 2174):
- in the `data` clause, after the row-removal sentence: a sort by something
  every entry already has, **not limited to one page**, is `data`, and the
  list is re-sorted on every page that shows it; **limited to one page they
  name**, it is `page` instead, and only that page changes, because
  different pages may show the same list in different orders; a hand-placed
  entry is no sort;
- in the `page` clause, before "ONE PAGE, AND ONLY ONE": the order of a list
  on one page they name is this layer, only that page's list is re-sorted,
  and every other page keeps its own order; not limited to one page, the
  same sort is `data`.

**Left as it was**: the whole-message rule, `alsoAsked`, every other clause,
the data picker and the page writers. A hand-placed sequence, a list's
arrangement in page code (`lido-axes-b`'s grouping), the menu's order (`nav`)
and a page's sections (`look`, `page`) keep their routes. No "whatever page
they saw it" rule exists anywhere the router reads.

**Tests** (`docs/history/2026-09-30-sort-routing.md`):
- `test/router-list-sort.test.mjs`, 10 cases: the two sentences, their
  places, the correction both ways round, no seen-on-this-page rule,
  universality, the whole-message rule unchanged, and the real routing route
  with supplied answers (Test 10's press posts a `data` answer and refuses a
  `page` one);
- `test/edit-list-sort.test.mjs`, 7 cases through the whole chain (routing
  route, the browser's own POST, the edit route, the browser's composer):
  - the bakery at `8btpep` with Test 10's request, synchronous and queued:
    one line of `order.tsx`, one publication, no row written, one charge
    (the scratch rehearsal, now committed with the queued path);
  - a list on two pages: a site-wide request re-sorts both; a request
    limited to `/menu` re-sorts only `/menu`, through the quick writer
    (both paths) and through the full writer, whose reply names the other
    page without rewriting it;
- red check: exactly the 7 wording cases fail on the old wording, and the
  other 10 pass (they cover behaviour that already existed);
- sweep: 22 of 22 mutants killed, 3 comment-only controls survived;
- full suite `8420 / 8420 / 0 / 0` locally (8,403 plus the 17 new cases);
- unit CI `8420 / 8416 / 0 / 4` on `429aa75a` (run 36790235168), and site
  build green on the same commit (run 36790235176, the twelve counts as
  before).

### The scope correction (2026-10-01, after the owner's review)

**The owner**: *"Fix one scope issue in the new routing rule: 'not limited to
one page' does not mean 'site-wide.' Use data-sort when the requested change
applies across the site. Keep a one-page request on the page editor. A
request limited to a selected group of pages must preserve that selection;
never expand it to every page showing the table."* And: *"If no existing
route supports a requested selection, report that limitation rather than
silently widening the change. Do not build another capability for this
correction."*

**The defect**: both sentences sent to `data` every sort "not limited to one
page". A request naming two pages of three is that, and the sort lane has no
page scope, so the page left out was re-sorted too (a supplied `data` answer
to the three-page request re-sorts all three: *"… — on 3 pages."*).

**The correction** (the same two sentences; the whole-message rule,
`alsoAsked` and every other clause unchanged):
- `data`: a sort **across the whole site** (they say so, or name no page)
  re-sorts every page that shows the list. **It cannot leave a page out**, so
  it is never the answer when the sort is limited to some of those pages;
- one page they name is `page`, as before;
- several pages they name, or every page but those they exclude, is a change
  on each of those pages and on no other. The field's closing rule decides
  it, and a page left out keeps its order.

**What carries a selection, traced without a model**: `look`. Its picker
scopes the change once per named page, and each page lane runs one page step
on that page with only that change's words: the quick writer, then the full
writer. No lane on that door reaches the sorter. So an existing route
carries it, and nothing new was built. What is not known (backlog):
- which lane a real picker names: no lane's description names a list's
  order;
- the cost: likely the full writer on each page, 6–22 credits a page;
- the reply: *"✅ Updated the look."*, which names neither page.

**Tests, each named as what it is**: *instructions* (what the router is
told), *structure* (a fact about the code they rely on), *supplied answers*
(a model answer given, the route's handling read). None shows which answer a
real model gives; only a live press after a merge and a deploy can.
- `test/router-list-sort.test.mjs`, 14 cases: 9 instructions, 1 structure,
  4 supplied answers. They include the broad phrases gone from everything
  the router reads, a selection never `data`, no look lane reaching the
  sorter, and the three-page request: a `look` answer posted by a press
  expecting it, and a `data` answer passed on by the route and refused by
  that press;
- `test/edit-list-sort.test.mjs`, 10 cases, all supplied answers. The 7
  before keep their assertions (renamed, and one comment added: the quick
  writer's answer in the one-page case is not the one its rules point to).
  The new ones use three pages
  showing the same list and *"On the home page and the menu page, but not
  the order page, list the loaves from cheapest to most expensive."*:
  - synchronous and queued: `/` and `/menu` re-sorted, `/order` and `/visit`
    byte-identical, no sort, no row written, one publication, one charge
    per page step with the picker billed once;
  - the same request answered `data`: all three pages re-sorted.
- red check: exactly the 8 instruction cases that read the corrected
  sentences fail on the previous wording (`3c4e201a`), and the other 16
  pass;
- sweep: 24 of 24 mutants killed, 3 comment-only controls survived;
- the 29 other files that read the router's wording: 967 of 967;
- full suite `8427 / 8427 / 0 / 0` locally (8,420 plus the 7 new cases);
- unit CI `8427 / 8423 / 0 / 4` on `99837db1` (run 36795891188), and the
  site build on the same commit (run 36795891162): see
  `docs/history/2026-10-01-sort-scope.md`.

**Test 10 is unchanged by it**: its request says *"Across the site"*, so it
is `data` under the corrected rule, with the same route box, fixture, checks
and estimate.

### The acceptance (once the rule is merged and deployed; revised 2026-09-30)

- **Site**: `fold-lane-bakery` at `8btpep`, as it stands (the demo-site
  rule). Only `/order` reads `loaves`, there are no language pages and no
  translator, and the six distinct prices fix the new order completely.
- **The request** (65 characters, 65 bytes, sha256 `22c96bd9338a8a31…`):
  *"Across the site, list the loaves from cheapest to most expensive."* Its
  scope is stated, as the owner asked (it replaces the first draft, *"On the
  order page, …"*, which under the decided rule is a one-page request for the
  page editor).
- **Expected route**: `layer=data`, nothing held back (the route box:
  `layer=data alsoAsked=none`).
- **Expected changes, and nothing else**:
  - one stored line: `order.tsx` line 97, `order: "name"` →
    `order: "price"`, with `dir` still `asc`;
  - one publish, from `8btpep`, built from those pages;
  - `/order` sends `loaves?select=*&order=price.asc` and shows Sea Salt
    Focaccia £4.50, Country White £4.80, Dark Rye £5.20, Seeded Wholemeal
    £5.40, Olive & Rosemary £5.80, Walnut Levain £6.00;
  - the reply: *"✅ loaves now comes out in order of price, lowest first —
    on 1 page."*
- **Unrelated content stays unchanged**:
  - the table, read whole before and after (`0-5/6`): byte-identical
    (1,045 bytes, `ef870ebc…` today). No row is written, and the job's
    `applied` is empty;
  - the stored source: the other four pages byte-identical, and `order.tsx`
    identical apart from that line (the canary's before and after reads);
  - each card's own text: name, price and description as before, only
    their order changed;
  - the rest of `/order` (headings, the form, the collection times 08:00 to
    13:00 in their order, the footer): pixel-identical outside the card
    list;
  - `/`, `/starter`, `/visit` and `/gallery`: 200 at the new version,
    markup identical apart from its render stamps, and pixel-identical; the
    menu and the header's button unchanged; `/the-starter` still 301 to
    `/starter`;
  - one job for the message, and none left open.
- **Money**: about **2–3 credits**, an estimate and not a cap: routing 1–2
  and the data step's picker 1. The publication is not charged (the
  committed coverage shows one charge of 1 on both paths). The balance is 6
  (read again on 2026-10-01 at 01:12 UTC, last ledger row 348). If the route
  check refuses, 1–2.
- **The baseline, read 2026-10-01 around deploy 2174** (free, read-only, as
  a visitor, every write request aborted; the demo as it stands):
  - the table whole, at 01:00:37 and again at 01:10:41 UTC (after the roll),
    byte-identical: 200, `0-5/6`, 1,045 bytes, sha256 `ef870ebc…`, the same
    six rows as on 2026-09-30;
  - every sitemap page (`/`, `/gallery`, `/order`, `/starter`, `/visit`)
    200 at `01790468089054-8btpep`, read at 01:04 UTC;
  - `/order` requests `loaves?select=*&order=name.asc` and shows Country
    White £4.80, Dark Rye £5.20, Olive & Rosemary £5.80, Sea Salt Focaccia
    £4.50, Seeded Wholemeal £5.40, Walnut Levain £6.00;
  - redirects, not followed: `/the-starter` 301 → `/starter` (`public,
    max-age=600`), keeping a query, and `/the-starter/` the same; `/gallery`
    with a query and with a trailing slash 200; an unknown page 404;
  - a full-page screenshot of each page, for the pixel checks afterwards;
  - the stored page sources, from run 83's inventory (`before/source.json`):
    complete, the five pages byte-identical to
    `test/fixtures/run47/*.before.tsx`, no components; its fixture check
    read the table again, as named (`fixture.json`);
  - the page markup: run 83's capture has the 01:04 byte lengths, and a read
    at 01:45 is identical to it once the two per-request render stamps on
    each page (`u:` and 13 digits) are masked. The after-checks compare
    markup with those stamps masked.
- **The presses** (the owner's). The image rolled at 01:01:45Z, so container
  work waited until about 01:20Z. **The authorized free dispatch was tried
  once at 01:22:02Z and refused (`403 Resource not accessible by
  integration`); no run started.** The owner pressed the free press as
  **run 83** (36802348994, 01:42 UTC), and **it passed every check** below:
  both readers `322c24301da9`, the image `b8c8789aa8e395d6`, every free
  check, the source read complete, the table as named, the balance 6, and
  nothing charged. Edit canary, from `main` (`322c2430`):
  1. **The free press: runtime confirmation and rehearsal in one.** The boxes:
     - "Run the ONE paid edit as well (yes/no)": `no`;
     - "What to change. REQUIRED when spend=1 …": the request above;
     - "The site to edit. …": `fold-lane-bakery`;
     - "Refuse to spend unless the Worker reports this deploy sha …":
       `322c2430`;
     - "Refuse to spend unless a cold container reports this image id
       (exact) …": `b8c8789aa8e395d6`;
     - "Refuse to post the paid edit unless the router answers this: …":
       `layer=data alsoAsked=none`;
     - "Refuse to route or spend unless one table, read whole as the site
       serves it, is as named: …":
       `{"table":"loaves","baseline":"093f2130a37a6704","target":{"id":6,"name":"Sea Salt Focaccia","description":"A tray bake, heavy on the oil, finished with flaky salt.","price":4.5,"photo":null,"created_at":"2026-08-21 23:06:23"}}`
       (the whole table pinned: every field of one row, and the digest of
       the other five);
     - every other box as it stands: the job, version, scenario and rules
       boxes blank, and the second site `washhouse-3`.

     Pass:
     - `build-health 200 deploy=322c24301da9 image=b8c8789aa8e395d6`, and
       `runtime 200 deploy=322c24301da9 async=true runner=true`, so the two
       deploy readers agree, the Worker is the expected build, and a cold
       container gets the expected image;
     - `ALL FREE CHECKS PASSED`;
     - the source read is complete, with the five pages;
     - the fixture line: `as named: 6 rows; the target is id 6, and the
       other 5 digest to 093f2130a37a6704`;
     - the balance is read (6);
     - `CANARY_SPEND is not 1 — stopping before the paid edit. Nothing was
       charged.`, and the balance unchanged.
  2. **The paid press**, handed over after run 83 passed, and pressed only
     on the owner's approval (about 2–3 credits): the same
     boxes with "Run the ONE paid edit as well (yes/no)" `yes`. It reads the
     same fixture before the routing call, and refuses before any charge if
     a row moved.
- **What it will not show**: the site-wide rewrite on a list read on two
  pages (the bakery has one; shown with supplied answers only, in the
  committed two-page cases); a one-page sort through the page editor; a
  page-code arrangement; a hand-picked sequence; other sites; how often.

### Run 84, the paid press (2026-10-01): every acceptance item met; closed by the owner

Edit canary run 84 (36802989624, 01:50–01:53 UTC, from `main` at
`322c2430`, the boxes as handed over, spend `yes`), pressed on the owner's
approval. The preflight, the free checks, the before-read and the fixture
(`as named`) were as in run 83.
- **The route**: the real router answered `intent=edit layer=data`, nothing
  held back, in 9.6 s, cost 2. The route check matched, so the answer was
  posted as it came. The canary sent no table names, and the route filled
  them itself (`tablesFilled: loaves, orders`, Lane 1's 1d, live again).
- **The job** `7bf9cbcbad73bf4d86c2d379154604d3`: claimed in 5 s, `routing`
  until 112 s, `publishing` at 126 s, and a final stored reply at 129 s
  (`x-gf-edit: final`). The reply: `layer: data`, `sort: {loaves, price,
  asc}`, `sortChanged: ["order.tsx"]`, `applied: []`, `failed: 0`, `cost: 1`,
  from one picker call (grok-4.6, 1,401 tokens in, 35 out).
- **The stored source**: exactly `order.tsx` line 97 changed, from `order:
  "name"` to `order: "price"`, with `dir: "asc"` kept. It still has 291
  lines and its final newline. The other four pages are byte-identical, and
  equal to `test/fixtures/run47/*.before.tsx`.
- **One publish**: `01790819484141-dgmag4`, built from `8btpep`. The
  canary's comparison is `VERIFIED`: every page was read at `dgmag4`.
- **`/order`** (a visitor's read in Chromium, 01:57 UTC): it requests
  `loaves?select=*&order=price.asc` and shows Sea Salt Focaccia £4.50,
  Country White £4.80, Dark Rye £5.20, Seeded Wholemeal £5.40, Olive &
  Rosemary £5.80, Walnut Levain £6.00. Each card's text is as before; only
  their order changed.
- **The reply on screen**: *"✅ loaves now comes out in order of price,
  lowest first — on 1 page."*, and the browser would then refresh the
  balance.
- **The table**, read whole again at 01:57 UTC: `0-5/6`, 1,045 bytes,
  byte-identical to before and `as named`. No row was written.
- **Pixels** (full-page screenshots, before 01:04 and after 01:57): `/`,
  `/gallery`, `/starter` and `/visit` have 0 differing pixels. On `/order`,
  19,227 pixels differ, all within x 369–807, y 354–672, inside the card
  list (x 328–952, y 336–760).
- **Markup**: every page is identical before and after once the
  per-request `u:` stamps and the new build's hashed asset names are masked
  (the build renamed the hashed chunks the pages load).
- **Everything else**:
  - headings, the menu and the header's links are unchanged on every page,
    with the same photographs;
  - the stored description is unchanged, and there are no components
    (0 → 0);
  - all six redirect probes answer as before (`/the-starter` 301 to
    `/starter`, keeping a query and with a trailing slash; `/gallery` with
    a query or a trailing slash 200; an unknown page 404).
- **Money**: balance 6 → 3 on the canary's own reads before and after the
  paid edit: routing 2 and the job 1, within the estimate.
- **The job and the ledger**, which this session could not read (its
  Supabase connector had dropped out), **verified independently in Supabase
  by the owner's reviewer**: job `7bf9cbcbad73bf4d86c2d379154604d3` done,
  billing finalized, cost 1, `needs_review` false; ledger row 349, one
  reservation of −1, and no further ledger entry for the job; balance 3, no
  job open. With the routing call's 2, the run spent 3.
- **An observation (backlog)**: the job's row read `routing` through the
  sort, compile and check, and `publishing` only at the end.

### Closed (2026-10-01)

The owner: *"Test 10 passes review for run 84's demonstrated request. Mark it
closed and leave the bakery at version dgmag4. Keep selected-page real-model
behavior marked unproven; don't repeat accepted tests."* Closed for exactly
that request: a sort across the whole site, routed `data` by the real router
and made by the data step's sort lane. A one-page sort and a selection of
pages stay shown with supplied answers only. Not to be repeated.

## Test 9 — a follow-up after a failure, in the same chat tab (prepared 2026-09-30 on the owner's word, after runs 79 and 80 were closed; built on the branch as the canary's UI scenario `9-follow-up`, red-checked, swept, tested through the stand-in, and proven locally against the real app's code with supplied answers, which found and fixed a first-run modal that would have blocked the card at the current balance; the free rehearsal passed as run 81 the same evening; the owner pressed the paid run as run 82 the same evening, and every pass item was met, for 4 credits; closed by the owner the same day for the demonstrated no-match failure followed by a successful edit in the same tab, the filled-in checks accepted, the demo data kept, not to be repeated)

**The owner** (the message arrived cut off after the third item): *"Next,
prepare one bounded test of a follow-up after failure in the same chat tab:
1. A request produces a genuine, visible edit failure. 2. Without reloading,
a normal second request succeeds. 3. Verify the second message submits
correctly, its intended change happens,"*

**The checks after "its intended change happens" are mine**, taken from the
pass lists the owner set for the deletion (runs 79 and 80) and for D1. They
are flagged for the owner to confirm or correct:
- the first failure changed nothing, and its edit charge was refunded;
- unrelated rows are unchanged;
- the website reflects the change;
- billing is correct;
- no reload happened.

**Why the UI mode.** Only the canary's UI mode sends a second message from
the same tab: the real app in a real Chromium, signed in as the owner, one
tab, each message sent once the last reply is on screen and the composer is
idle. The API mode posts one edit (Lane 2's 2f).

### The fixture: `fretwork-1`'s `lessons`, as it stands

The owner's demo-site rule makes the table as it stands the baseline. Read
whole at 21:31:30 UTC (`0-2/3`, 541 bytes, sha256 `f2396dcb…`, the same
bytes run 80 left):

| id | name | price | shown on |
|---|---|---|---|
| 1 | First lesson | £0 | `/prices`, `/` |
| 3 | One-to-one | £30 | `/prices`, `/` |
| 4 | Hour one-to-one | £42 | `/prices`, `/` |

Every page is at `kk6qsh`. Both pages read the table live, and draw each
lesson as one line, `li > span` for its price: *"Hour one-to-one 60 minutes
A full hour when 45 minutes is not enough. £42"* (the home page adds
" Select"). A digit follows the name there, so the line is found by its
whole start (`shown.lead`), not by the name alone.

### The two messages (frozen in the scenario)

1. *"We've stopped running the Weekend workshop, please take it off the
   price list."* The site has no Weekend workshop, so the data step matches
   nothing: `no-match`, drawn as the app's warning (*"⚠️ I couldn't match
   that to anything the site stores — say which list it's in and I'll have
   another go. This edit cost you nothing. …"*), with the job's reserve
   refunded.
2. *"Please change the Hour one-to-one's price to £45."* An ordinary data
   edit: `lessons` id 4, price 42 → 45.

**Why this failure.** It is genuine: the real router and the real data
picker refuse an entry the site does not have, through the real edit route.
It is visible: the app draws it as a warning. Its edit charge comes back.
And it is bounded: taking off a row that does not exist cannot add or change
one, and the table is read straight after it anyway. It is run 77's path,
which the real models took once (`data`, then `no-match`, refunded); this
test uses it as the failure a follow-up comes after and credits nothing
twice.

### What the harness does (`scripts/canary-ui.mjs`, `9-follow-up`)

- **Before message 1**: reads `/prices`, then `/`, as a visitor (the Hour
  one-to-one line must show £42 on both), then the table on both readers
  (the owner route and the visitor route): id 4 must be the Hour one-to-one
  at 42. Otherwise nothing is sent.
- **No write of its own**: `restore: false` (the demo-site rule). The run
  asks no conditional write and plans no recovery, and its PATCH is swapped
  for a refusal that sends nothing and is counted, so no path can write.
- **The tab**: marked once the workspace opens (a token on the page's own
  window, and `performance.timeOrigin`). A reload or a move to another
  document loses both.
- **Message 1**, walled to `data`: any other kind of edit is aborted in the
  browser, so a misrouted message costs its routing call and changes
  nothing. After its reply:
  - `failureVerdict`: the job's stored reply is `ok: false`, `no-match`,
    names no row, the edit's cost 0; and a reply on screen is the warning
    carrying that reply's own sentence;
  - the table on both readers against the baseline (`untouchedVerdict`):
    field for field, no row added or gone, and a visitor's read byte for
    byte.
- **Message 2** is typed and sent only if both hold (`needs.failed`), and
  only if the page is still the marked document, checked right before its
  Send. Otherwise the run stops, and message 2's routing call is never
  spent.
- **After its reply**: the table on both readers, `/prices` and `/` again.
  Nothing is put back.

### Proven locally against the real app's code (free; supplied answers)

The UI mode's own kind of proof, as before its first press: the live
gofarther.dev files and the live `fretwork-1` site's files, fetched over
TLS-verified Node fetch and served into a real Chromium. Every call to the
app's API, to Supabase's auth and to the site's data is answered from a local
copy of the table. No live write, no model call, and a fake session, never an
owner credential. **It proves the driver and the app's own page code on this
flow, not the live platform's answers.**
- **It found a blocker first.** The first-run welcome modal
  (`maybeShowWelcome`) covers the page on a fresh browser whenever an unpaid
  balance is 1 to 20 and the browser stores no site. The canary's context is
  always fresh, and every earlier UI run had more than 20; at today's 10 the
  modal took the site card's click, so the rehearsal would have failed there.
  **The canary's plant now marks the greeting seen** (`WELCOME_SEEN_KEY`,
  `zephyr_welcome_v1`, the app's origin only, never over a held value), as a
  returning owner's browser holds it. The modal itself is a backlog item.
- **Then all four paths ran through the real page code**:
  - the rehearsal: signed in, card open, both pages and the table read,
    message 1 typed, nothing sent;
  - the flow as designed: the app drew *"⚠️ I couldn't match that to
    anything the site stores — say which list it's in and I'll have another
    go. This edit cost you nothing. Reading your message cost 2 credits."*,
    the composer came back usable, the table was the baseline, message 2
    went from the same tab, and the app composed exactly *"✅ Updated one
    entry in lessons."*; both pages then showed £45 with every other line as
    before, and the money closed (a reserve and its refund, then one
    reserve);
  - message 1 succeeding after all (a row taken off): message 2 was never
    typed, and the change was reported, not put back;
  - the page reloading itself after message 1's reply: the reply was flagged
    as read in another document, and message 2 was not sent.

### Pass (the canary's checks, paid)

1. **Message 1 failed as designed**: it left word for word, was routed to
   `data` and went out as one edit there; its stored reply is `no-match`,
   naming no row, its edit cost 0; the page showed that failure as a
   warning.
2. **The failure changed nothing**: the table after message 1 is the
   baseline on both readers, byte for byte.
3. **Message 2 was sent after that failure, from the tab the run opened,
   with no reload**, and each reply was read in that same tab.
4. **Message 2 submitted correctly**: word for word, routed to `data`, one
   edit there, the composer usable again after each reply.
5. **Its intended change happened**: its stored reply names exactly
   `lessons` id 4, `price`; the reply on screen is *"✅ Updated one entry in
   lessons."*; the database change is exactly id 4 price 42 → 45 and nothing
   else, on both readers.
6. **Unrelated rows unchanged**: ids 1 and 3, every field (the same check).
7. **The website reflects it**: `/prices` and `/` show £45 on the Hour
   one-to-one line and every other line as before; nothing published (the
   version list names neither job, neither job's row began a publish, every
   page still `kk6qsh`).
8. **Billing correct**: each message filed exactly one job; message 1's job
   is `refunded`, its reserve and refund netting to nothing; the balance
   moved by exactly both routing calls plus message 2's job's cost, which its
   row and the ledger both state.

### Cost, and what it will not show

**About 5 credits**, an estimate and not a cap: routing 1–2 per message,
message 1's edit 0 once refunded, message 2's data edit about 1 (so 3–5).
The scenario sends nothing more once 8 is spent (its budget), which bounds
the scenario, not a single request. The balance was 10 at its last reading
(run 80). If message 1 is misrouted or does not fail as designed, the run
stops after it, at about 2 to 3.

**It will not show**: a follow-up after other failures (a hop, an
escalation, a failure with no job); a follow-up that leans on the
conversation (message 2 names its own row); other sites; or how often any of
it happens.

### The presses (the owner's; the scenario is on the branch only)

**1. The free rehearsal.** Edit canary, "Use workflow from"
`claude/help-needed-ehlwlj`. Boxes, by description:
- "Run the ONE paid edit as well (yes/no)": `no`;
- "RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …":
  `9-follow-up`;
- "The site to edit": `fretwork-1`;
- every other box blank ("Refuse to post the paid edit unless the router
  answers this" and "Refuse to route or spend unless one table … is as
  named" must be blank: either beside a scenario refuses the run).

It should pass every free check, open the app signed in, read both pages and
the table, type message 1 and stop before Send. Nothing is sent, written or
charged.

**2. The paid run**, only after the rehearsal passes and the owner approves
the estimate. The same form, the same branch:
- "Run the ONE paid edit as well (yes/no)": `yes`;
- "RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …":
  `9-follow-up`;
- "The site to edit": `fretwork-1`;
- "Refuse to spend unless the Worker reports this deploy sha":
  `8908b59d2069dfb5f11fa679a8b33b649194fe77`;
- "Refuse to spend unless a cold container reports this image id":
  `e71f7bae88b9ecf1`;
- every other box blank.

**No recovery is owed** (the demo-site rule): the price stays at £45. Anything
unintended is reported and left for the owner.

### Run 81 — the free rehearsal passed (2026-09-30 22:14–22:15 UTC, free)

Edit canary run 81 (36784382993, from the branch at `bc313e9b`; evidence
artifact 11129406214), spend `no`, scenario `9-follow-up`, site
`fretwork-1`, every other box blank:
- **Preflight**: both readers answered `8908b59d2069`, a cold container
  `e71f7bae88b9ecf1`, and queued jobs and the runner were on. Every free
  check passed (its own two zero-cost probe jobs settled at cost 0, as on
  every run), and the balance read 10.
- **The app**: opened signed in as the building account, and the site's
  card opened its workspace with no modal in the way (the greeting mark,
  at a balance of 10). The tab was marked. No console or page error.
- **The table and the pages**, read just before the stop: `lessons` id 4
  is the Hour one-to-one at 42 on both readers, three rows, and a
  visitor's read of 541 bytes equal to the recorded table; `/prices` and
  `/` both show the line at £42.
- **No write**: no conditional write asked, no recovery planned, no PATCH
  (`writes` 0), and the page made no POST at all.
- **Stopped** with message 1 typed and not sent; the balance 10 → 10.

The owner pressed the paid run next, with the boxes above: run 82, below.

### Run 82 — the paid run: every pass item met (2026-09-30 22:21–22:23 UTC, 4 credits)

Edit canary run 82 (36785026124, job 110124270397, from the branch at
`709f8d9b`; evidence artifact 11128809989), spend `yes`, scenario
`9-follow-up`, site `fretwork-1`, the deploy and image boxes filled, every
other box blank. The canary ended *UI MODE PASSED: 2 messages sent*.
- **Preflight**: both readers answered `8908b59d2069`, a cold container
  `e71f7bae88b9ecf1`, and queued jobs and the runner were on. Every free
  check passed. Its own zero-cost probe jobs (`a2e7a1f4…` on `fretwork-1`,
  and `44429beb…` on the control, `washhouse-3`) settled `failed` at cost
  0, billing `none`, with no ledger row (read in Supabase). The balance was
  10.
- **Before message 1** (22:22:05 UTC): `lessons` id 4 read as the Hour
  one-to-one at 42 on both readers, three rows. The visitor's read equalled
  the recorded table. `/prices` and `/` both showed the line at £42, at
  `kk6qsh`.
- **Message 1**, *"We've stopped running the Weekend workshop, please take
  it off the price list."* (reply in 32 s):
  - it left word for word, the real router answered `data` (cost 2), and
    one edit went out: job `5cc0cc60…`;
  - in the container the data step matched nothing. The stored reply is 422
    `no-match` and names no row. The job's reserve of 1 (ledger row 346) was
    refunded at 22:22:35 UTC (row 347). The job is `failed` and
    `refunded`, and the page was served its edit cost as 0
    (`refunded: 1`);
  - on screen: *"⚠️ I couldn't match that to anything the site stores —
    say which list it's in and I'll have another go. This edit cost you
    nothing. Reading your message cost 2 credits."* The composer was usable
    again;
  - after it, the table was the baseline on both readers, byte for byte.
- **Message 2**, *"Please change the Hour one-to-one's price to £45."*,
  sent from the same tab (reply in 29 s):
  - at its Send, the tab's mark and time origin were the ones the run took
    when the workspace opened (`b5d170bc…`, the same project address), and
    both replies were read in that tab;
  - it left word for word, the real router answered `data` (cost 1), and
    one edit went out: job `c608d15d…`;
  - the stored reply is 200 and names exactly `lessons` id 4, `price`
    (`failed` 0). On screen: *"✅ Updated one entry in lessons."* The
    composer was usable again;
  - in the database, exactly id 4's price changed, 42 → 45, on both
    readers. Ids 1 and 3 are unchanged in every field, and no row was added
    or removed;
  - `/prices` and `/` show £45 on the Hour one-to-one line, with every
    other line as before. Nothing was published: no version names either
    job, neither job's row began a publish, and every page is still at
    `kk6qsh`. The stored source is byte-identical before and after. The
    served markup differs only in its render timestamps, because the pages
    read their prices live.
- **Money**: 10 → 6. That is routing 2 and 1 plus message 2's edit of 1
  (its reserve, ledger row 348, `finalized`). Message 1's reserve and
  refund net to nothing (rows 346 and 347, `refunded`). No job is open.
- **The browser**: one console error, the browser's own line for message
  1's poll answering 422, which is the failure's own status. No page error.
  The page sent four POSTs: route, edit, route, edit.
- **Nothing was put back** (the demo-site rule): the Hour one-to-one stays
  at £45.

**Read again independently, free, 22:27–22:28 UTC:**
- the site's own read of `lessons`, whole (`0-2/3`, 541 bytes, sha256
  `30f8ed88…`): ids 1, 3 and 4. Against the 21:31 read, only id 4's price
  differs, 42 → 45;
- `/prices` and `/`, read in a headless browser as a visitor: £0, £30 and
  £45, version `kk6qsh`;
- Supabase, non-secret columns only: balance 6; last ledger row 348 (rows
  346–348 as above); job `5cc0cc60…` `failed` and `refunded`; job
  `c608d15d…` `done`, `finalized`, cost 1. Neither job began a publish, and
  no job is open. The platform's terminal states are `done`, `failed`,
  `cancelled` and `lost`, so two `lost` jobs from 2026-09-01 and 09-02,
  both refunded, count as closed, not open.

**Against the pass list**, every item is met:
- 1 and 2: the failure, and the table after it;
- 3: the same tab, never reloaded;
- 4: message 2's request;
- 5 and 6: the change, and the rows left alone;
- 7: both pages, with nothing published;
- 8: one job per message, the refund, and the balance's move of 4.

The cost was 4, inside the estimate of 3 to 5.

**For the owner's review.** Closing is the owner's decision. The checks
after the owner's third item are mine until the owner confirms or corrects
them. What it does not show is unchanged (*Cost, and what it will not
show*, above).

### Closed by the owner (2026-09-30)

*"Run 82 passes review. Close Test 9 for the demonstrated no-match failure
followed by a successful edit in the same tab. The additional data,
website, refund, billing, and no-reload checks are accepted. Keep the demo
data unchanged and don't repeat this test."*
- **Closed for**: one request that failed visibly (`no-match` through the
  data rung, drawn as the app's warning, its edit refunded, nothing
  changed), followed from the same tab, never reloaded, by a normal request
  that changed exactly `lessons` id 4's price, 42 → 45.
- **Accepted**: the checks filled in after the owner's third item: the
  failure changed nothing and its charge came back; unrelated rows
  unchanged; the website reflects the change; billing correct; no reload.
- **Kept**: the demo data as it stands (the Hour one-to-one at £45).
- **Not repeated**: no rerun of Test 9.
- **Still open**: a follow-up after a hop (an escalation), unprepared; the
  other failure kinds listed under *Cost, and what it will not show*.

## Lane 4's delete — one row taken off `fretwork-1`'s price list, with real models (prepared 2026-09-30 after deploy 2171; its routing conflict corrected the same day on the owner's word, merged and deployed in deploy 2172, runtime-confirmed by run 76; pressed by the owner as run 77 the same day before its temporary row was added and with B2's recovery still open: the real router answered `data`, the picker found no such row, nothing changed, 2 credits; recorded by the owner as a failed deletion acceptance, its live routing and refunded no-match credited separately; the canary's fixture check added on the branch the same day; a new press prepared only after the price recovery and the temporary row are read back and verified; those two preconditions replaced the same day by the owner's demo-site rule, and the deletion re-prepared on the current table; the free rehearsal passed as run 79, the row check's first live run, and the paid deletion met every condition as run 80, for 3 credits; both closed by the owner the same day, the demo data kept as it stands)

The next unaccepted live test. It is the only Lane 4 item whose blocker is
gone (1a, deployed in 2171). Add, reorder, rules, the picture swap, the
component and the follow-up still wait on the owner's Lane 2 decisions.
Nothing accepted is repeated: B1 changed a field, and this removes a row.

**What it shows that supplied answers cannot.** 1a's route cases
(`test/data-remove-wording.test.mjs`) prove what the route does with a
supplied `remove` answer: one bound `DELETE` of the named row, the targeting
protections, and the reply. This press is for the real models:
- whether the real router routes a row deletion to `data`, now that it is
  told the site's table names (1d; the canary sends `tables: []`, so this is
  1d's first live reading);
- whether the real data picker answers `remove` for exactly the named row;
- whether the job deletes exactly that row in the site's container, through
  the blank link.

**The routing conflict, found in the code and corrected (`4e3ef512`; merged
and deployed in deploy 2172, `80ece106`, image `e71f7bae88b9ecf1`).** The router's `look` clause claimed every removal:
*"TAKING SOMETHING OFF THE SITE IS THIS LAYER, whatever the something is"*,
with a whole page as its one exception, and `look`'s reach under `alsoAsked`
said *"taking something off"*. The `data` clause said *"prefer it whenever
the thing being changed is one row of something the site lists"*. Neither
named a row taken off a list. The owner: *"Before the paid row-deletion test,
fix the specific router instruction conflict you found."* Now the `data`
clause claims an existing row taken off, `look`'s removal clause excepts a
stored row for `data` (after the whole page, still `page` with `remove`), and
`look`'s reach names no stored row
(`docs/history/2026-09-30-row-removal-routing.md`). **That is instruction
evidence only**: how a real router answers is what this press measures. The
canary's route check still refuses any answer other than `data` before the
edit is posted, so a misroute costs the routing call alone and changes
nothing.

**Preconditions, all free and in this order:**
1. **Deploy 2172 runtime-confirmed** by the owner's free press: both
   readers answering `80ece106` and a cold container `e71f7bae88b9ecf1`.
   Deploy 2172 runs deploy 2171's code plus the routing correction, so this
   one press is the runtime check for both (2171's own was never pressed).
   **Met: run 76** (2026-09-30 07:49–07:50 UTC, from `main`, spend `no`):
   `build-health 200 deploy=80ece10644a9 image=e71f7bae88b9ecf1`, `runtime
   200 deploy=80ece10644a9 async=true runner=true`, `ALL FREE CHECKS
   PASSED`; nothing charged (balance 15, no ledger row after 342, no job
   open, read independently).
2. **B2's recovery closed.** The owner puts row 4's price back to 40 in the
   Data panel, after checking in a private window that the panel opens on
   `fretwork-1`. My checks against the baseline: every row and every field
   (the served body byte-identical, 736 bytes, `a4f1dc30…`), `/prices`
   showing £40, every page at `kk6qsh`, the balance 15 with no ledger row
   after 342, no open job in the queue, and `neon_db` still blank. **The
   recovery closes the batch's recovery only: B2's model run stays failed**
   (the owner: *"Recovery does not turn B2's failed model run into a
   pass."*).
   **Not met at 08:19 UTC**: after the owner's report of the put-back, row 4
   still read 42 and `/prices` still showed £42 (*Batch 1*, the owner's
   review).
3. **The throwaway row**, the owner's own write in the Data panel (`lessons`,
   "+ Add", then "Add row"), shortly before the press, since it shows on the
   public `/prices` while it exists:

   | name | description | price | duration |
   |---|---|---|---|
   | `Ten-minute tune-up` | `A quick ten-minute check on how your practice is going.` | `10` | `10 minutes` |

   Then my read: five rows, the first four unchanged (the served body's first
   735 bytes equal the baseline's), and the fifth as entered, with its `id`
   and `created_at` recorded. `/prices` shows it.

**The request** (79 characters, 79 bytes, sha256 `50dc5e1f2b95e78e…`):

> We don't do the Ten-minute tune-up any more, please take it off the price list.

**The press** (paid, only after the owner's approval): edit canary, form
boxes by description:
- "Run the ONE paid edit as well": `yes`;
- "What to change. REQUIRED when spend=1": the request above, exactly;
- "The site to edit": `fretwork-1`;
- "Refuse to spend unless the Worker reports this deploy sha":
  `80ece10644a98bb90f376d7b6f85cb61b9a34680`;
- "Refuse to spend unless a cold container reports this image id":
  `e71f7bae88b9ecf1` (read from deploy 2172's log, as predicted);
- "Refuse to post the paid edit unless the router answers this":
  `intent=edit layer=data alsoAsked=none`;
- everything else blank.

**Pass**, judged by what the operations did:
1. **The route**: `request.json` carries the request, and `routing.json` a
   matching verdict (`edit`, `data`, nothing held back) with `tablesFilled`
   (the router was told the table names).
2. **The job**:
   - it ran in the container (`where: "container"`);
   - no `data/backend-unreadable`, `no-backend` or `no-meta`;
   - its stored result is `ok: true`, `layer: "data"`, with `applied` exactly
     one entry, `{ table: "lessons", id: <the throwaway id>, removed: true,
     was: … }`, whose `was` is the throwaway row;
   - `failed` is empty;
   - one ledger reserve, `<job>#1`.
3. **The rows**: the served body byte-identical to the baseline again (736
   bytes, `a4f1dc30…`).
4. **The site**: `/prices` shows the four lessons as in the before picture;
   every page is still at `kk6qsh` (nothing published); `neon_db` is still
   blank.
5. **The money**: the routing call (1–2) and the reserve of 1; exactly one new
   ledger row; the balance 15 → 12 or 13.
- **Expected, not judged**:
  - the reply, "removed one entry" with the row's contents and how to put it
    back (the kept deterministic wording);
  - the canary's "CANARY PASSED", with the comparison UNVERIFIED because a
    row edit names no version.

**Other outcomes and their recovery:**

| Outcome | Cost | Recovery |
|---|---|---|
| The route check refuses (the router did not answer `data`) | about 2 | The owner deletes the throwaway row in the Data panel (its ×, then "Delete this row?"), free. I read the body back to the baseline bytes. A routing finding for Lane 3; no retry with a model |
| The picker matches nothing (422, `no-match`) | about 3 | The same: the owner's ×, and my read |
| A baseline row deleted instead | about 3 | The owner re-adds it in the Data panel with its baseline values. **Not exact**: `id` and `created_at` are set by the database. An exact return needs a database restore, a separate approval that also reverts everything else since. The route refuses an id the picker was not shown, but not a wrong id it was shown, so this is the press's main risk |
| Anything else changed | — | Batch 1's row-level recovery table (*Batch 1*, above), field by field |

**Cost estimate: about 3 credits**: the routing call, 1–2, and the data
rung's one call, about 1. About 2 if the route check refuses. An estimate,
not a cap: nothing enforces a per-request limit, and the balance (15) is the
only bound.

### Run 77 (2026-09-30 08:27–08:29 UTC, 2 credits): pressed before its temporary row existed

The owner pressed the prepared press (36689829998, from `main` at
`80ece106`). All six boxes were as prepared: spend `yes`, the request
exactly (79 characters), `fretwork-1`, the sha, the image and the route.
**Two preconditions were not met at the press**:
- B2's recovery was still open: row 4 read 42 at 08:15–08:27;
- the temporary row was absent: `lessons` held four rows at 08:27:51, a
  minute before the press, and no "Ten-minute tune-up".

**What it showed:**
- **Preflight**: both readers answered `80ece10644a9`, a cold container
  `e71f7bae88b9ecf1`, and the free checks passed.
- **The route, live**: the canary sent `tables: []`, and the route told the
  real router four names (`tablesFilled`: `bookings`, `gear`, `lessons`,
  `waiting_list`). This is 1d's first live reading. The router (grok-4.6,
  37.8 s) answered `intent=edit layer=data`, with nothing held back and
  cost 2. The route check matched and posted the answer unchanged.
  - **This is the first real-router reading of the row-removal routing
    correction (deploy 2172)**. It is one sample, and the router is told
    table names, not rows, so the missing row did not bear on this answer.
- **The job**: job `67c6092f…` was claimed at 4 s and settled at 14.7 s
  with a stored 422, `no-match`. The data picker (grok-4.6, 13 tokens out)
  matched nothing, which is correct: no such row existed. Its message was
  *"I couldn't match that to anything the site stores — say which list it's
  in and I'll have another go."*
  - The edit cost 0. The job's reserve of 1 is ledger row 343
    (`67c6092f…#1`, −1), and the refund is ledger row 344 (+1).
  - The customer read: *"⚠️ I couldn't match that to anything the site
    stores — say which list it's in and I'll have another go. This edit
    cost you nothing. Reading your message cost 2 credits."*
- **Nothing changed**:
  - the stored source is byte-identical before and after (`9d74d9ca…`);
  - the three pages differ only in their render timestamps, and every page
    is at `kk6qsh`, so nothing was published;
  - components 3 → 3, and the stored description is unchanged;
  - `lessons` still answers 736 bytes, `2ec299b8…` (B1's state), read
    again at 17:12;
  - `neon_db` is still blank.
- **Money**: 15 → 13, all of it routing. No job is open, and there has
  been no activity since 08:30 (read at 17:12).

**What it does not show.** The core of this test is still unshown:
- the real picker answering `remove` for exactly the named row;
- the job deleting that row through the blank link;
- the list coming back to the baseline.

What run 77 adds is one live routing sample and the no-match path for a row
that does not exist, refunded. **Not a pass**, and not counted as the
delete test. Whether and when to press again is the owner's decision, in
the prepared order: B2's recovery closed first, then the temporary row and
my read of it, then the press, for about 3 credits from a balance of 13. A press repeats nothing accepted, since this test has no
acceptance. The canary has no fixture check before a paid data press
(backlog).

### The owner's review of run 77 (2026-09-30)

- **Run 77 is a failed deletion acceptance.** No row was deleted, so the
  deletion is still unshown.
- **Credited separately**:
  - its correct live routing: `data`, nothing held back, with the table
    names the route filled in;
  - its refunded no-match result: `no-match`, with the reserve refunded
    (ledger rows 343 and 344).
- **Before another paid run**, two pieces of free work, done the same day
  (`docs/history/2026-09-30-fixture-check.md`):
  - the £40 put-back's trace (*Batch 1*, the owner's review, below the
    put-back reading), not settled;
  - the canary's opt-in fixture check (`expect_rows`, `3229272e`, on the
    branch). It reads the table as the site's own read serves it and judges
    the baseline and the target row before any routing call.
  - **The owner's review of the check (2026-09-30)**: its existing coverage
    credited; a gap to close before a paid run. The read kept no headers and
    took any 200 list, so an answer leaving a row out passed (the owner's
    reproduction: `Content-Range: 0-1/3`). **Closed on the branch in
    `fc06edde`**: the read asks the Data API for its count and stops at no
    cost unless the answer is the whole table (`incomplete`,
    `completeness-unknown`), shown through the real script with no routing
    call, no paid edit and nothing after the read. **Passed the owner's
    review** (2026-09-30), and **merged and deployed in deploy 2173**
    (`8908b59d`, image reused). The owner's free press, run 78, confirmed
    that deploy's runtime with the `expect_rows` box blank, so it did not
    exercise the guard: **the guard has not yet run live** (only under the
    in-process stub).
- **A new deletion press is prepared only after the price recovery and the
  temporary row have both been read back and verified** (the owner). It is
  not prepared here.

### Re-prepared on the current table (2026-09-30, the owner's demo-site rule)

**The owner**: "Stop treating data restoration as a prerequisite. These are
demo sites; I don't require them restored after each test. Use whatever state
currently exists as the baseline." The £40 is not put back (row 4 stays at
42). The owner's earlier preconditions 2 and 3 above (B2's recovery and a
throwaway row entered by the owner) are replaced by the following.

**The baseline, read whole at 20:53:26 UTC**: 4 rows, `0-3/4`, 736 bytes,
sha256 `2ec299b8…` (First lesson 0, Group of three 18, One-to-one 30, Hour
one-to-one 42). The lessons show on `/` and `/prices`, both reading the table
live. Every page is at `kk6qsh`.

**The disposable row**: id 2, "Group of three", an existing demo row. I cannot
create one: the save needs the owner's session, and `lessons` refuses a
visitor's write. Its name is the only one no other name contains.

**The row check's box** (`expect_rows`), judged on that read by the canary's
own functions: parses, `as-named`, the other three rows digest to
`47c5b2217d6d6453`:

`{"table":"lessons","baseline":"47c5b2217d6d6453","target":{"id":2,"name":"Group of three","description":"Share a 45-minute lesson with two other beginners. Eighteen pounds each.","price":18,"duration":"45 minutes","created_at":"2026-09-02 16:57:02"}}`

**1. The free rehearsal (the owner's press, no cost).** Edit canary, "Use
workflow from" `main`. Boxes by description:
- "Run the ONE paid edit as well (yes/no)": `no`;
- "The site to edit": `fretwork-1`;
- "Refuse to route or spend unless one table, read whole as the site serves
  it, is as named": the box above;
- everything else blank.

It should print the row check `as-named` and stop before any routing call,
with nothing charged. It is the row check's first live run.
**Pressed as run 79 and passed** (36776533709, 21:00:35–21:01:06 UTC, from
`main`):
- `as named: 4 rows; the target is id 2, and the other 3 digest to
  47c5b2217d6d6453`;
- every free check passed, every page at `kk6qsh`, and the balance 13;
- it stopped before the paid edit: no routing call, nothing charged;
- the table was byte-identical before and after (21:00:47 and 21:01:50 UTC).

**2. The paid deletion (only after the rehearsal passes and the owner
approves the estimate).** The same form, "Use workflow from" `main`:
- "Run the ONE paid edit as well (yes/no)": `yes`;
- "What to change. REQUIRED when spend=1": `We don't do the Group of three any more, please take it off the price list.`;
- "The site to edit": `fretwork-1`;
- "Refuse to spend unless the Worker reports this deploy sha":
  `8908b59d2069dfb5f11fa679a8b33b649194fe77`;
- "Refuse to spend unless a cold container reports this image id":
  `e71f7bae88b9ecf1`;
- "Refuse to post the paid edit unless the router answers this":
  `intent=edit layer=data alsoAsked=none`;
- "Refuse to route or spend unless one table … is as named": the box above;
- everything else blank.

**Estimate: about 3 credits** (the routing call 1–2, the data edit about 1).
About 2 if the route check refuses; nothing if the row check stops it. An
estimate, not a cap. The balance was 13 at its last reading (run 78); the
rehearsal prints it again.

**Pass, as the owner set it, judged by what the operations did:**
1. **The correct row deleted**: the job's stored result is `ok: true`, layer
   `data`, with exactly one `applied` entry, `lessons` id 2 `removed`, whose
   `was` is the row above; nothing `failed`. The whole read after has three
   rows and no id 2.
2. **Unrelated rows unchanged**: the three remaining rows digest to
   `47c5b2217d6d6453…`, every field as before.
3. **The website reflects it**: `/` and `/prices` no longer show "Group of
   three" and show the other three as before; nothing is published (pages
   still at `kk6qsh`).
4. **Billing correct**: the routing call and the job's one reserve are
   debited, the job's billing is final at its own cost, the balance falls by
   exactly their sum, and no job is left open.

**No recovery is owed** (the owner's rule). A wrong row deleted, or anything
else unintended, is reported as a finding and left for the owner.

**Pressed as run 80** (36777080750, 21:05:21–21:06:20 UTC, from `main`, 3
credits). **Every condition was met**, pending the owner's review:
1. **The correct row deleted.** The real router answered `intent=edit
   layer=data` (cost 2), and the route check matched. Job `d03daa50…`
   applied exactly `lessons` id 2 `removed`, its `was` the row as it stood,
   at cost 1. The whole read after has ids 1, 3 and 4 only.
2. **Unrelated rows unchanged.** The three remaining rows digest to
   `47c5b2217d6d6453`, and the served body is the baseline minus row 2, byte
   for byte.
3. **The website reflects it.** `/` and `/prices` no longer show "Group of
   three", the other three lines are unchanged, and nothing was published
   (`kk6qsh`).
4. **Billing correct.** 13 → 10: routing 2 (in the balance only, as always)
   and the job's 1 (ledger row 345, `d03daa50…#1`, finalized). No job is
   open.

A separate cosmetic finding: the reply cuts each field at 40 characters
("…with two other , price 18"). It is in the backlog.
`docs/history/2026-09-30-fixture-check.md` §10.

### Closed by the owner (2026-09-30)

**The owner**: "Run 79's live fixture check and run 80's AI row deletion
pass review. Mark those acceptances closed in the active checklist. Keep the
demo data as it stands." Closed for what the two runs showed:
- **run 79**: the row check read one table whole and as named, live, and
  stopped before any routing call, at no cost;
- **run 80**: a normal AI request through the real edit route deleted
  exactly the named row; the other rows are unchanged; the website shows
  the deletion with nothing published; and the money is exact.

Not to be repeated. `fretwork-1`'s `lessons` stays at three rows (First
lesson £0, One-to-one £30, Hour one-to-one £42), and nothing is restored.
The reply's 40-character cut stays a separate backlog finding.

## Test 8 — a menu item taken out and a layout change on another page, in one message, with real models (proposed 2026-09-29 after deploy 2168; its free runtime check passed as run 62; pressed as run 63 the same day: the router answered `nav` with `remove` and held the band back, so only the menu change was made and the look door was not reached; the free restore, run 64, put everything back; the owner recorded run 63 as a partial outcome and accepted run 64, with the intended acceptance still open; the router's whole-message rule corrected on the branch the same day, made to choose by what a route can make on every page rather than by kind after the owner's review, and the acceptance prepared again, not run; the rule merged and deployed in deploy 2170 the same day and runtime-confirmed by run 65; pressed again as run 66 the same day: the router answered `look` with nothing held back, and both changes were stored and published exactly as expected, for 6 credits; every acceptance item met; the free restore, run 67, put everything back, checked; closed by the owner the same day for the exact combined request run 66 proved, with recovery verified by run 67, runs 63 and 64 kept as history, no further reruns)

Owner, 2026-09-29: *"Also prepare one bounded real-model acceptance using
the existing fixture and workflow: a menu-item removal combined with a layout
change on another page. Verify both actual changes, preservation of the
removed menu item's page, unrelated links and content, one publish, accurate
billing, and free restoration afterward. Keep the evidence boundary explicit:
supplied answers prove execution when the picker selects the correct lane;
the live test must establish the real picker does so. Return the exact
request, expected results, recovery version, and cost estimate before
spending."*

**The evidence boundary.** The committed route cases
(`test/edit-removal-door.test.mjs`, section 5) prove the execution **when the
picker places the menu change on the menu editor's lane with its own words**:
each executor handed only its own words, both changes in one publish,
unrelated content kept, either half's failure reported. They cannot show that
a real picker places it there; that is what this test is for. The router, the
picker, the menu editor and the page writer are all real models here, on the
live fixture, and the verdict is what is stored and published.

### The fixture: fold-lane-bakery at `01790468089054-8btpep`

Restored by run 61 (15:33 UTC) and verified then: the five stored pages
byte-identical to `test/fixtures/run47/*.before.tsx`, every route at `8btpep`.
**Read again by run 62** (16:57 UTC, free, the runtime check for deploy 2168):
the five stored pages byte-identical to the fixture (`index.tsx` 2,439
`51b5af6a…`, `order.tsx` 9,258 `4ead778e…`, `starter.tsx` 951 `37fb0e17…`,
`visit.tsx` 4,045 `bdb02abe…`, `gallery.tsx` 3,007 `4e8b82aa…`), no
components, the stored description as before, every route at `8btpep`, and
`/visit`'s headings "Come to the bakery | The shutters and the street | Order
a collection so we hold a loaf"; the balance 32. What this test turns on:
- **the menus** (header and footer): `/` and `/gallery` list Today's bake ·
  The starter · Visit · Gallery; `/visit` and `/order` list Today's bake · The
  starter · Visit; `/starter` has no menu. The "Order a loaf" button goes to
  `/order` on every page but `/starter`;
- **the Visit page**: "Come to the bakery" (with "The shutters and the
  street", the hours, the QR code that points to `/gallery`, and the counter
  photograph), then the "Order a collection so we hold a loaf" band;
- **`/gallery`**: its own page, reached from two menus and the Visit page's QR
  code.

### The request, proposed (frozen when approved)

Verbatim: 139 characters, all ASCII, sha256
`65b63d1d09513135a101dd46c59b52f914c6c9a639d2c5e3d27ebc0ec8633afa`.

> Take Gallery out of the menu. Then, on the Visit page only, put the "Order a collection so we hold a loaf" band above "Come to the bakery".

- **Why Gallery**: its page is the one the test must keep, and it is the one
  item whose removal leaves the same menu on every page. The menu editor
  writes one list into every page's menu, so taking "The starter" out instead
  would write the home page's list, Gallery included, into `/visit` and
  `/order`: a change nobody asked for.
- **Why the Visit move**: the Visit page's menu does not change, so each
  executor's work lands in files the other does not touch, and the move is a
  pure block swap, exact to the byte.
- **Stated plainly: both halves repeat operations already shown live on their
  own**: the Gallery link's removal through the router's own menu step (Test
  5, run 49) and this Visit band move (Test 6, run 57). What is new is the path:
  the look door, with the real picker placing the menu change on the menu
  editor's lane beside other work. Known-good halves keep a failure
  attributable to that path; a new layout operation can be chosen instead.

### Rehearsed free through the real edit route (scratch, not committed)

The exact sentence, routed `look`, with the picker's answer supplied as it is
now told to give it (`action` with "Take Gallery out of the menu"; `shape` on
`/visit` with the band's words), on the fixture's stored pages, sync and
queued alike:
- the calls are the picker, the page writer and the menu editor; the menu
  editor is handed exactly "Take Gallery out of the menu", and the page writer
  exactly the band's words, on `visit.tsx`;
- `layers` `["page", "nav"]`, `lanes` `["shape", "action"]`, `pageOps`
  `[{page: "/visit"}]`, no `partial`, one compile;
- the stored files below; the screen "✅ Updated the look." (review #9, kept
  separate).

### Acceptance — judged on the stored and published changes

The route's own record is evidence of the path and decides only item 8.
1. **The request**: `request.json` carries sha256 `65b63d1d…`.
2. **The menu item's removal**:
   - stored: every page's menu becomes Today's bake · The starter · Visit, and
     the files are exactly:
     - `index.tsx` 2,378 characters,
       `637b779375472391f93645d6b01c9dcd24038fbed3a947b9d976a47318b80891`;
     - `gallery.tsx` 2,946,
       `da53a37595977e4b4cb4ace4d31db2945fd1db1a9721c9cb5b3ee618d1ce907f`;
     - `order.tsx` 9,241,
       `0a0b5f41877a3b25f87329e2584d455ff1a56897d01b966dd04d6bc986c7b710`:
       the same three items, the array re-written on one line;
     - `starter.tsx` unchanged (951, `37fb0e17…`).

     These are the bodies Test 5 expected for "Take Gallery out of the menu."
     and run 49's real menu editor stored. Outside the menu arrays every one
     is byte-identical to the fixture;
   - published: the header and footer menus on `/` and `/gallery` no longer
     show Gallery; on `/visit` and `/order` they show the same three items as
     before.
3. **The removed item's page is kept**: `gallery.tsx` is still stored, only its
   menu changed; `/gallery` answers 200 at the new version with its own content
   as before ("Our Gallery", "Photographs of the bakery's work", its gallery
   and its empty picture slot); the sitemap still lists it; the Visit page's
   QR code still points to it.
4. **The layout change**:
   - stored: `visit.tsx` 4,028 characters,
     `c67011dbbf2a049012f793a59ec622f3e87e881b0998a374de7ed4b983b722f1`: outside
     its menu exactly the band move (Test 6's expected swap, `35b008fd…`),
     with its menu re-written with the same three items;
   - published: `/visit` reads the band, "Come to the bakery", then "The
     shutters and the street"; its markup is the two blocks swapped and
     nothing else; its photographs and QR code still show.
5. **Everything else preserved**:
   - `/order` and `/starter`: markup byte-identical, and identical to the
     pixel in a real browser;
   - `/` and `/gallery`: identical apart from the Gallery item in the header
     and the footer;
   - every page's head tags identical apart from the script names; the "Order
     a loaf" button and every in-body link unchanged;
   - the redirects (`/the-starter`, `?x=1` and the trailing slash answer 301 to
     `/starter` with `public, max-age=600`), the 404 and the sitemap as before,
     at once and ten minutes later;
   - the QR file, the stylesheet and the share card byte-identical; the stored
     description unchanged; no component before or after.
6. **One publish**, built from `8btpep`; the canary's comparison VERIFIED.
7. **Money**: the routing call plus the job's reserves, closing exactly against
   the ledger; the job `done` and `finalized`; nothing left open.
8. **The path, which only a live run shows**: the router answers `look`, and
   the job's stored reply names the lanes `shape` and `action` and the layers
   `page` and `nav`, with no `partial` (a withheld change would be there).
   That is the real picker placing the menu change on the menu editor's lane,
   with scopes that pass their check.

**Expected in the canary's own log**: `/visit` `order CHANGED`, the band's
heading first; the other four routes `order same` (the menus are not
headings); no photograph `LOST`; components `0 -> 0`, with its note that
component preservation stays untested. No `FAIL` line is expected.

### What each other outcome means, decided now

- **`look`, the picker names `action` and `shape`, both scoped**: the path
  intended. Items 1–8.
- **`look`, the picker names `behavior` or another lane for the menu words**:
  the menu editor does not run, the band ships, and `partial` names the other
  step. Item 2 fails: the new description did not steer the real picker.
- **`look`, the picker leaves the menu words out**: the band ships and the menu
  change is dropped without a word (the separately recorded omitted-operation
  gap). Item 2 fails.
- **`look`, a scope fails its check**: that change is withheld with its own
  sentence (`picker/scope-unread`) and the other ships. Item 2 or 4 fails; a
  finding about the real picker.
- **`nav` with `remove`, the removal door**: the router's own menu step runs,
  reading the whole message, and the picker adds the layout as `additional`
  work. Both changes may ship, but the look door's menu lane is not shown, so
  item 8 fails. Recorded as what happened: the removal door given other work,
  with real models, for the first time.
- **`nav` without `remove`**: only the menu editor runs, on the whole message;
  the band is not moved and nothing says so. A routing finding.
- **The band put off (`alsoAsked`)**: only the menu ships, and the reply says
  the band comes next. A finding about the router.
- **The gallery page read as the thing to take off** (`pages` remove):
  refused, because the home page's menu links to it; nothing is deleted. Item
  3 holds and item 2 fails.
- **The menu editor changes anything but the Gallery item** (a label, the
  order, the button): item 2 or 5 fails.
- **The quick writer declines and the full writer answers**: the same result,
  dearer.
- **A stored page that differs from its expected file only by its final
  newline**: not exempt. Test 7's exception was for that acceptance only, so
  the stored half of item 2 or 4 fails byte for byte; recorded against the
  backlog item (the quick writer stores the model's whole file as written),
  and the owner decides.
- **Anything beyond the two changes**: a failure.

### Recovery, free, and what it must show

The canary's restore mode to `01790468089054-8btpep`, the new version's
parent, which pruning keeps. Afterwards, run 61's checks: all five routes at
`8btpep`; the stored pages equal to the fixture; Gallery back in the menus on
`/` and `/gallery`; every head tag and the markup identical to the `8btpep`
before-read; the redirects, the sitemap, the QR file and the card as before;
the pages identical to the pixel in a real browser; no charge.

### Cost

An estimate, not a cap; each step rounds up to at least 1 credit. Routing
1–2 (runs 57 and 60: 2); the page step through the quick writer with the
picker's call, about 2 (run 57's Visit move: 2); the menu editor about 1–2
(run 49's menu edit: 2). **About 5–6 credits, up to about 25** if the full page
writer has to run (the page rung measured 6–22). The balance is 32.

### The presses

All from `main`.
1. **The free runtime check for deploy 2168**, from 16:55 UTC (the image
   rolled at 16:39): "Run the ONE paid edit as well" `no`; "The site to edit"
   `fold-lane-bakery`, so its before-read re-reads the fixture; the two "Refuse
   to spend unless…" boxes `47dea9c01fbf015c61a56db4281b3e3c5626a772` and
   `dd4f72842234135b`. **Pressed as run 62 (16:57 UTC): every check passed**
   (*The fixture*, above).
2. **The paid run, only after approval and after (1) passes**: "Run the ONE
   paid edit as well" `yes`; "What to change" the sentence above, exactly;
   "The site to edit" `fold-lane-bakery`; the same two expectations.
3. **The free restore, after the readings**: "Run the ONE paid edit as well"
   `no`; "PUT ONE SAVED VERSION BACK, THEN READ IT AND STOP"
   `01790468089054-8btpep`; "The site to edit" `fold-lane-bakery`; the same two
   expectations.

### What it will not establish

- The removal door given other work, unless the router answers `nav` with
  `remove`.
- A menu item added, renamed or reordered beside other work: only a removal
  is tested.
- The menu editor's other parts (the footer's details, social icons and small
  print, links in the copy, how the header sits), which still have no
  look-door lane (backlog).
- A change the picker leaves out entirely, which is dropped without a word
  (backlog); it would show here only as a failure.
- A reply naming both changes (review #9, kept separate).
- Component preservation (the fixture has none).

### Run 63 — the paid run: the router answered `nav` with `remove` and held the band back; Gallery came out of every menu, and the band was not moved (2026-09-29)

Pressed by the owner from `main` at `47dea9c0`
([run 36602046251](https://github.com/canias7/isibi-app/actions/runs/36602046251),
17:02:04–17:06:43 UTC; the evidence artifact `canary-evidence` is 46,005
bytes, sha256 `76c97741…`) with the spend box `yes` (`CANARY_SPEND: 1`), the
frozen request, `fold-lane-bakery` and the two expectations. The preflight
read `47dea9c01fbf` and `dd4f72842234135b` from both readers and a cold
container, every free check passed, the canary reads PASSED, and its
comparison is VERIFIED.
- **The path** (kept as evidence; it decides only item 8):
  - the router (39.1 s, cost 2) answered `layer: "nav"`, `remove: true`, and
    `alsoAsked`: *on the Visit page only, put the "Order a collection so we
    hold a loaf" band above "Come to the bakery"*. **The removal door, with
    the band held back**: the outcome decided in advance as *the band put
    off*, on the removal door. Its own `alsoAsked` description asks for
    `look` here: several changes are one turn when the answer can make them
    all (`look` names the menu and a band on any page), and a second request
    is held back only when the answer cannot do it this turn (backlog);
  - the job (`e067d0c6…`, created 17:03:20): the removal door's picker ran
    (`pick_lanes`, 5.9 s) and added nothing (the held-back words are taken
    out of the message before any step runs); the router's own menu step
    (`nav`, lane `action`) wrote the menu. Two model calls after routing (the
    picker and the menu editor, both grok-4.6); one publish (`publish:1` on the
    job row, 17:06:00–17:06:06, `8btpep` → `01790701419976-t5obxx`); `done`,
    `finalized`, cost 2;
  - the stored reply: `layers` `["nav"]`, `lanes` `["action"]`, `changed` the
    four pages with a menu, `deferred` the band's words, no `partial`, `links`
    Today's bake · The starter · Visit, `dropped` 0;
  - the screen: "✅ Updated the menu on 4 pages: Today's bake · The starter ·
    Visit." and then "I only did one thing this time. Say “on the Visit page
    only, put the "Order a collection so we hold a loaf" band above "Come to
    the bakery"” and I’ll do that next."
- **Acceptance**, judged on the stored and published changes, read from the
  run's evidence, the job row, the ledger and the live site. **Items 1–3 and
  5–7 hold. Item 4 fails (the band was held back, not moved), and so does item
  8 (the look door was not reached).**
  1. `request.json` carries sha256 `65b63d1d…` (139 characters, ASCII), and
     the router was sent the same sentence.
  2. **The menu item's removal — holds.** Stored: `index.tsx` 2,378
     characters `637b7793…`, `gallery.tsx` 2,946 `da53a375…` and `order.tsx`
     9,241 `0a0b5f41…`, exactly as expected; `starter.tsx` unchanged; and
     `visit.tsx` 4,028 `ddd1fe39…`, the menu-only body (run 49's, Test 5's
     expected), where Test 8 expected `c67011db…` with the band moved as well.
     Published: the header and footer menus on `/` and `/gallery` read
     Today's bake · The starter · Visit; on `/visit` and `/order` they are the
     same three items as before.
  3. **The removed item's page is kept — holds.** `gallery.tsx` is still
     stored, only its menu changed; `/gallery` answers 200 at `t5obxx` with
     "Our Gallery", "Photographs of the bakery's work", its gallery and its
     empty picture slot; the sitemap lists the five pages; the QR file the
     Visit page shows (`qr-gallery.svg`, `45f42f27…`) is unchanged.
  4. **The layout change — not made.** The router held it back: `visit.tsx`
     outside its menu is byte-identical to the fixture, and `/visit` still
     reads "Come to the bakery", "The shutters and the street", then "Order a
     collection so we hold a loaf". **Fails.**
  5. **Everything else preserved — holds.** `/visit`, `/order` and `/starter`:
     the served markup is identical apart from the build's script names and
     render values, and in a real Chromium 0 pixels differ. `/` and
     `/gallery`: the markup differs only by the two Gallery links, and 6,591
     pixels differ on each, all in the header menu and the footer, where the
     footer's middle column (Bristol, the hours) moves right as the menu
     narrows: the same text, re-laid out. Every page's head tags are identical
     apart from the script names; the "Order a loaf" button and every in-body
     link are unchanged. `/the-starter`, `?x=1` (the query kept) and the
     trailing slash answer 301 to `/starter` with `public, max-age=600`;
     `/nonexistent-page` answers 404; the sitemap lists the five; read at
     17:08:43 UTC and again at 17:16:15, ten minutes after the publish. The QR file, `/card.png`
     (`ce884f5b…`) and the stylesheet (`544ff34e…`) carry their recorded
     sha256s; the stored description is unchanged; no component before or
     after.
  6. **One publish**, built from `8btpep`; the canary's comparison is
     VERIFIED. Holds.
  7. **Money — holds.** 32 → 28: routing 2 and the job's reserve of 2 (ledger
     row 339, 17:03:39); the job `done`, `finalized`, cost 2; the two probe
     jobs (`a49a3fe2…` on the bakery, `e07c573f…` on `washhouse-3`) `failed`
     at cost 0 with billing `none`; no job open.
  8. **The path — fails.** The router answered `nav` with `remove`, so the look
     door was never reached, and the real picker placing the menu change on
     the menu editor's lane is **still shown only with supplied answers**.
- **What it does show, live, for the first time since deploy 2166: a part the
  router holds back is taken out before anything runs.** The band's words
  reached no executor and cost nothing, the rest ran, and the reply named them
  for the customer to send next (the held-back path had been shown only with
  supplied answers). The removal door's menu step also produced run 49's
  bodies exactly, a second time.
- **The finding, recorded separately (backlog), not changed**: for a menu
  removal beside a layout move on another page, the real router answered the
  removal door and held the move back, against its own `alsoAsked` rule;
  Test 7's routing review had expected `look` for this kind of message. One
  sample.
- **The customer's view**: Gallery gone from the menu, the page kept, and one
  sentence asking them to send the band move again. Nothing wrong was done;
  the second change needs a second message.
- **Next**: the free restore to `8btpep` (*Recovery*, above: done as run 64,
  below); whether Test 8 closes, and what to do about the router's choice,
  is the owner's decision.

### Run 64 — the free restore put everything back (2026-09-29)

Pressed by the owner from `main` at `47dea9c0`
([run 36605227896](https://github.com/canias7/isibi-app/actions/runs/36605227896),
17:28:55–17:29:59 UTC; the evidence artifact `canary-evidence` is 23,904
bytes, sha256 `774cd99f…`) with the spend box `no`, the restore box
`01790468089054-8btpep`, `fold-lane-bakery` and the two expectations. The
preflight read `47dea9c01fbf` and `dd4f72842234135b`, and every free check
passed.
- **The restore**: the version list held 13 versions, `t5obxx` live with
  `8btpep` as its parent; the restore answered 200 (`files: 24`, `swept: 0`),
  and the site reported `8btpep` itself on the first read after it.
- **What it must show** (*Recovery, free, and what it must show*), every item
  holding:
  - all five routes answer 200 at `8btpep` (read again live at 17:30:44 UTC);
  - the stored pages are byte-identical to `test/fixtures/run47/*.before.tsx`
    (`index.tsx` 2,439 `51b5af6a…`, `order.tsx` 9,258 `4ead778e…`,
    `starter.tsx` 951 `37fb0e17…`, `visit.tsx` 4,045 `bdb02abe…`,
    `gallery.tsx` 3,007 `4e8b82aa…`); no components; the stored description
    as before;
  - Gallery is back in the header and footer menus on `/` and `/gallery`,
    and `/visit` and `/order` keep their three items;
  - every page's served markup, head tags included, is identical to run 63's
    `8btpep` before-read apart from one line, the render script's
    timestamps;
  - `/the-starter`, `?x=1` (the query kept) and the trailing slash answer
    301 to `/starter` with `public, max-age=600`; `/nonexistent-page`
    answers 404; the sitemap lists the five; `qr-gallery.svg` (`45f42f27…`),
    `/card.png` (`ce884f5b…`) and the stylesheet (`544ff34e…`) carry their
    recorded sha256s;
  - in a real Chromium, the live pages drawn as run 63's were (GET only,
    reduced motion): all five are identical to the pixel to run 63's
    `8btpep` before-read, every image loaded, and there are 0 page errors.
    The three console errors on each page are the three `POST /cdn-cgi/rum`
    requests of Cloudflare's analytics beacon, which the browser wall
    refuses, as in runs 58 and 61;
  - **no charge**: the balance is 28 (last changed at 17:03:39 by run 63's
    reserve), no ledger row came after 339, the two zero-cost probe jobs
    (`f4bd53a0…` on the bakery, `9a014a2e…` on `washhouse-3`) ended `failed`
    at cost 0 with billing `none`, and no edit job is open.

### The owner's review of runs 63 and 64 (2026-09-29)

Owner, 2026-09-29: *"Accept run 64's restoration. Record run 63 as a partial
outcome: the menu removal succeeded, the Visit move was deferred, and the
intended mixed-request acceptance remains open. Keep the successful
restoration and previously closed tests credited."*
- **Run 63 is a partial outcome**: the menu removal succeeded (Gallery out of
  every menu with the expected bodies, its page kept, everything else
  preserved, one publish, the money exact), and the Visit move was deferred
  (held back by the router, neither made nor charged, and named in the reply).
- **The intended mixed-request acceptance remains open**: both changes from
  one message, with the real picker placing the menu change on the menu
  editor's lane, has not been shown live.
- **Run 64's restoration is accepted**: `8btpep` back, stored and published,
  with nothing charged.
- Every test closed before stays credited, and nothing here reopens one.
- **Next**: the routing defect, as one focused change (*After run 63: the
  router's whole-message rule*, below).

### After run 63: the router's whole-message rule, and the acceptance prepared again (2026-09-29; merged and deployed in deploy 2170, runtime-confirmed by run 65; not run)

**The correction** (`builder/site-ask.mjs`; the full record is
`docs/history/2026-09-29-whole-message-routing.md`). The router's tool
disagreed with itself about a message of more than one kind: each layer's
clause ("A MENU CHANGE IS "nav"", `remove` for a menu item) named the answer
for the change a message leads with; the several-changes rule sat inside
`look`'s own paragraph with only `look`'s own kinds; and `alsoAsked` judged a
hold against the answer already chosen, sparing a `look`-reachable part only
"when you answered "look"". Now the `layer` field ends on one rule over the
whole message, **by targets, never by kind** (the owner's review of the first
wording, the same day, below): a layer other than `look` is the answer when
it can make every change on every page each one is on; when none can,
`look`, if it can make them all, with nothing held back, so changes of one
kind on different pages are one `look` answer; a change is held back only
when no one answer can make it with the rest. The `page` clause's older
multi-page line, which sent a change on several pages to `addon`, points at
that rule, and `alsoAsked`'s exception holds "whatever the first change was"
and names no answer of its own. The route is unchanged.

**The owner's review of the first wording** (2026-09-29, before any merge):
*"the new whole-message rule still chooses by operation kind without fully
accounting for target scope. … Two layout changes on different pages are the
same kind, but that route cannot execute both. … Make the universal rule
depend on whether a route can execute the entire request across all its
targets. Preserve a specialized route when it can do everything requested.
Otherwise, use look when its existing scoped execution can complete
everything, including same-kind changes on different pages. Defer only work
that cannot run together. … Keep Test 8's request and acceptance
unchanged."* Done in `2771ed3f`; its wording and validation are the history
file's *The owner's correction: by targets, never by kind*.

**The evidence boundary, stated plainly**: the tests prove what the router is
TOLD (its tool's text) and what the route DOES with each answer (supplied
answers). Whether a real router now answers `look` for this message is not
measured; only a live run after a merge and a deploy can show it.

**The request, unchanged** (139 characters, sha256 `65b63d1d…`):

> Take Gallery out of the menu. Then, on the Visit page only, put the "Order a collection so we hold a loaf" band above "Come to the bakery".

**Expected results, unchanged**: items 1–8 of *Acceptance* above, with the
same stored files (`index.tsx` 2,378 `637b7793…`, `gallery.tsx` 2,946
`da53a375…`, `order.tsx` 9,241 `0a0b5f41…`, `visit.tsx` 4,028 `c67011db…`,
`starter.tsx` unchanged) and item 8 read as: the router answers `look` with
nothing held back (no `alsoAsked`, no `deferred`), and the job's stored reply
names the lanes `shape` and `action` and the layers `page` and `nav`, with no
`partial`. **Replayed free after the correction** through the real edit
route with supplied answers, sync and queued (scratch, not committed): with
the answer the corrected rule asks for (`look`, nothing held back), the
menu editor is handed exactly "Take Gallery out of the menu", the page writer
exactly the band's words on `visit.tsx`, and all five stored files equal the
expected ones above; with run 63's own answer, the route does exactly what
run 63 did (menu only, the held-back words in no model call, `visit.tsx` the
menu-only `ddd1fe39…`). Replayed again on `2771ed3f`, after the owner's
correction: 2 of 2, the same results.

**What each other outcome would mean now**:
- **`nav` with `remove` and the band held back again** (run 63's answer): the
  correction did not steer the real router; items 4 and 8 fail, and run 63's
  partial outcome repeats (menu only, band named for next time).
- **`nav` with `remove` and nothing held back**: the removal door carries the
  band as the picker's additional work, so both changes may ship; the menu
  editor then reads the whole message (the door's known limit), and item 8
  fails (the look door is not reached).
- The rest of *What each other outcome means*, above, stands.

**Recovery**: the free restore to `01790468089054-8btpep`, the version live
now (restored by run 64), which a new version would have as its parent.

**Cost**: an estimate, not a cap. Routing 1–2 (runs 57, 60 and 63: 2); the
Visit move through the quick writer about 2 (run 57); the menu editor about
1–2 (runs 49 and 63: 2). **About 5–6 credits, up to about 25** if the full
page writer has to run. The balance is 28.

**Before it can run**: the correction merged and deployed (it lives in the
Worker's routing call, and the lanes module the container loads imports the
same file, so the image rolls: `2771ed3f` predicts `abf47dfeceba3c5c`), then
the owner's free runtime check, then the paid press and the free restore,
each with the new deploy's identifiers. **Merged and deployed** (deploy 2170,
2026-09-29 20:28–20:31 UTC, `907840c6`, image `abf47dfeceba3c5c` built as
predicted; runtime-confirmed by run 65). The presses, all from `main`, every
other box left as it is:
1. **The free runtime check for deploy 2170**, now (the image rolled at
   20:31): "Run the ONE paid edit as well" `no`; "The site to edit"
   `fold-lane-bakery`; the two "Refuse to spend unless…" boxes
   `907840c67497b2624f1a2febfdb27b947ca5222a` and `abf47dfeceba3c5c`.
   **Pressed as run 65 (21:51 UTC): every check passed.** Both readers
   answered `907840c67497`, a cold container `abf47dfeceba3c5c`, and the
   free job was claimed and finished at cost 0. The before-read: the five
   stored pages byte-identical to the fixture (`51b5af6a…`, `4ead778e…`,
   `37fb0e17…`, `bdb02abe…`, `4e8b82aa…`), no components, the stored
   description as before, and every route at `8btpep`. The served markup
   of all five routes is identical to run 62's apart from each page's two
   render timestamps. The balance was 28.
2. **The paid run, only after the owner's approval and after (1) passes**:
   "Run the ONE paid edit as well" `yes`; "What to change" the request above,
   exactly; "The site to edit" `fold-lane-bakery`; the same two
   expectations. **Pressed as run 66 (21:56 UTC), with exactly these
   inputs: every acceptance item met** (*Run 66*, below).
3. **The free restore, after the readings**: "Run the ONE paid edit as
   well" `no`; "PUT ONE SAVED VERSION BACK, THEN READ IT AND STOP"
   `01790468089054-8btpep`; "The site to edit" `fold-lane-bakery`; the same
   two expectations. **Pressed as run 67 (22:23 UTC): everything put back,
   no charge** (*Run 67*, below).

### Run 66 — the paid run: the router answered `look`, and both changes were made from one message (2026-09-29)

Pressed by the owner at 21:56 UTC, from `main` at `907840c6` (deploy 2170,
runtime-confirmed by run 65). **The inputs, as the run recorded them**: the
paid edit `1`; "The site to edit" `fold-lane-bakery`; the request word for
word (139 characters, sha256 `65b63d1d…`); the two expectations
`907840c67497b2624f1a2febfdb27b947ca5222a` and `abf47dfeceba3c5c`; every
other box blank. The preflight matched both expectations, and the
before-read is the fixture exactly (the five stored pages byte-identical,
every route at `8btpep`, the balance 28).

**What the real models did**:
- **The router** (grok-4.6, 15.8 s, 2 credits) answered `intent: edit`,
  `layer: look`, with no `page` and no `alsoAsked`: **nothing was held
  back**. This is the first live reading of the whole-message rule; run 63's
  answer for the same message was `nav` + `remove` with the band held back.
- **The job** (`dfac763e…`, 178 s) ran through the look door. The picker
  placed the band on the page lane (`shape`, layer `page`, `/visit`) and the
  menu change on the menu editor's lane (`action`, layer `nav`): `layers`
  `["page","nav"]`, `lanes` `["shape","action"]`, `pageOps`
  `[{"page":"/visit"}]`, `changed` `index.tsx`, `order.tsx`, `visit.tsx`,
  `gallery.tsx`. The stored reply carries **no `partial` and no
  `deferred`**. It published once, `01790719081409-li1j0y`, built from
  `8btpep`, and the canary's comparison is VERIFIED.

**Judged against *Acceptance*, item by item**:
1. **The request**: sha256 `65b63d1d…`, as frozen.
2. **The menu item's removal**:
   - stored: `index.tsx` (2,378, `637b7793…`), `gallery.tsx` (2,946,
     `da53a375…`) and `order.tsx` (9,241, `0a0b5f41…`) are exactly the
     expected files, and `starter.tsx` is unchanged (`37fb0e17…`);
   - published: on `/` and `/gallery` the served markup is exactly the
     before-read minus the header's and the footer's Gallery links (build
     values masked); on `/visit` and `/order` the menus read the same three
     items as before.
3. **The gallery page is kept**: `gallery.tsx` is stored and `/gallery`
   answers 200 at `li1j0y` with its own headings and content; the sitemap
   still lists it; the Visit page's QR code still points to it (the QR file
   is unchanged, `45f42f27…`).
4. **The layout change**:
   - stored: `visit.tsx` (4,028, `c67011db…`) is exactly the expected file;
   - published: `/visit` reads "Order a collection so we hold a loaf",
     "Come to the bakery", "The shutters and the street". Its served markup
     equals the before-read with those two sections swapped and nothing
     else changed, and its photographs and QR code still show.
5. **Everything else is preserved**:
   - `/order` and `/starter`: markup identical apart from build values
     (script names and render timestamps), and identical to the pixel in a
     real browser (0 pixels differ);
   - `/` and `/gallery`: 6,591 pixels differ on each, all in the header menu
     and the footer menu;
   - every head tag is identical apart from the script names;
   - the redirects (`/the-starter`, `?x=1` and the trailing slash: 301 to
     `/starter`, `public, max-age=600`), the 404 and the sitemap are as
     before, read at once (22:02) and ten minutes later (22:12);
   - the QR file, the stylesheet (`544ff34e…`) and the share card
     (`ce884f5b…`) are byte-identical;
   - the stored description is unchanged, and there is no component before
     or after.
6. **One publish**, `li1j0y`, built from `8btpep`, VERIFIED.
7. **Money**: 28 → 22. Routing 2, then the job's reserves of 3 and 1
   (ledger rows 340 and 341), closing exactly against the job's cost of 4.
   The job is `done` and `finalized`, and nothing is left open (the run's
   free probe jobs ended at cost 0).
8. **The path**: the router answered `look`, and the stored reply names the
   lanes `shape` and `action` and the layers `page` and `nav`, with no
   `partial`. That is the real picker placing the menu change on the menu
   editor's lane, with scopes that passed their check.

**In the canary's own log**: `/visit` `order CHANGED` with the band's
heading first; the other four routes `order same`; no photograph `LOST`;
components `0 -> 0`, with its note that component preservation stays
untested. No `FAIL` line.

**In a real browser** (every page before and after, drawn the same way): 0
page errors and every image loaded, before and after.

**Kept separate, as before**: the customer reply reads "✅ Updated the
look." and names neither change, which is review #9 (a multi-step look reply
naming only the look), kept separate by the owner. Component preservation
is untested because the fixture has none.

**The evidence boundary**: this is one sample of the real router's choice
for this message. It shows that the rule can steer a real router to `look`
for this mix; it does not measure how often it does, or its choice for other
messages.

**Cost**: 6 credits, against the estimate of about 5–6. The balance is 22.

**Next**: the free restore (run 67, below), then the owner's review.

### Run 67 — the free restore put everything back (2026-09-29)

Pressed by the owner at 22:23 UTC, from `main` at `907840c6`, with the
restore inputs exactly as handed over: paid edit `0`, "PUT ONE SAVED VERSION
BACK" `01790468089054-8btpep`, `fold-lane-bakery`, and the two expectations.
The preflight matched both. The restore listed 13 versions, with run 66's
`li1j0y` live. It put back row 8, `8btpep` (the POST answered 200, 24 files),
and the site then reported `8btpep` itself on the first read.

**Checked afterwards**:
- **Stored pages**: the five stored pages are byte-identical to the fixture
  (`51b5af6a…`, `4ead778e…`, `37fb0e17…`, `bdb02abe…`, `4e8b82aa…`), and there
  is no component.
- **Served markup**: every page's markup is identical to the pre-test
  reading (run 66's before-read) apart from render timestamps, including the
  original build's script names.
- **Pixels**: all five pages match the pre-test renders exactly (0 pixels
  differ), with 0 page errors and every image loaded.
- **Live**: every route is at `8btpep`. Gallery is back in the header and
  footer menus on `/` and `/gallery`, and `/visit` reads "Come to the
  bakery", "The shutters and the street", then the band.
- **Unchanged**: the redirects (301 to `/starter`, `public, max-age=600`),
  the 404, the sitemap (all five), the QR file (`45f42f27…`), the stylesheet
  (`544ff34e…`) and the share card (`ce884f5b…`); the stored description is
  unchanged.
- **Money**: nothing was charged. The balance is 22, no ledger row after 341,
  and no job is open (only the run's free probe jobs, at cost 0).

**Seen in the restore's version list, kept separate** (backlog): run 66's
version is labelled "Take Gallery out of the menu.", which names only the
first of its two changes. Where the label comes from is not traced.

### Closed (2026-09-29)

Owner, 2026-09-29: *"Accept Test 8 for the exact combined request proven by
run 66, with recovery verified by run 67. Record it as closed and retain
earlier failed runs as history. No further Test 8 reruns. Keep the
reply-summary and saved-version-label issues in the separate backlog."*
- **Closed** for exactly what runs 66 and 67 showed: the combined request
  above, routed `look` by the real router with nothing held back, both
  changes stored and published exactly as expected in one publish, the
  rest preserved, the money exact (6 credits), and `8btpep` restored free.
- **Kept as history**: run 63 (the router answered `nav` + `remove` and held
  the band back, a partial outcome) and its restore, run 64.
- **Not to be repeated**: no further Test 8 reruns.
- **Kept separate** (backlog): the reply names only the look (review #9), and
  the saved-version list labels run 66's publish with its first change only.

## Test 7 — a photograph removal and a layout change on another page, in one message (proposed 2026-09-29; its claimed coverage narrowed the same day by a routing review the owner asked for: the customer capability through the look door, not the removal door; held the same day on the photo-removal mismatch, reproduced and a correction proposed for review; the correction implemented on the branch the same day with the owner's safeguards, and Test 7 now expects the element removed; merged and deployed the same day in deploy 2167 and runtime-confirmed by the owner's free press, run 59; approved by the owner and pressed as run 60 the same day: both changes stored and published, each on its own page, with the home page stored without its final newline; the free restore, run 61, put everything back; closed by the owner, 2026-09-29, for the customer behavior runs 60 and 61 showed, with the missing final newline accepted as a specific nonfunctional exception)

Owner, 2026-09-29: *"Prepare the next bounded acceptance: a removal combined
with another change in one message, through the removal path with a real
model. Use an existing suitable fixture and the existing workflow. Prefer a
photograph removal on one page plus a layout change on another, if the current
fixture supports clear before/after checks. … Verify actual stored and
published outcomes, including that neither operation is dropped or sent to the
wrong page. Give me the proposed test for review before spending."*

**What it covers** (narrowed by the routing review, below): **the customer
capability**. One message asks for a photograph removal on one page and a
layout change on another; both must happen, each on its own page, with
nothing else changed, judged on the stored and published site, with real
models, through whichever door the router opens. Under the router's current
instructions that is the look door. **It does not cover item 3's second
half**, the removal door given other work: no natural message reaches that
door with other work.

### The routing review (2026-09-29, asked for by the owner before spending)

Owner: *"Test 7's preservation and recovery plan looks sound, but its claimed
coverage needs resolving before spending. The proposal says it covers mixed
work through the removal path while acknowledging the router will probably
choose look. Do one focused code review of the existing routing rules: would
a menu-link removal combined with a separate page-layout change naturally
exercise the removal path more reliably? … Do not change routing prompts,
force a router answer, or tune wording to game the test. … Separate the
customer capability—both requested changes happening correctly—from
coverage of the alternate internal path."*

Read in `builder/site-ask.mjs`, `builder/site-lanes.mjs` and `worker.js` as
deployed (deploy 2166), against runs 47, 49 and 57. Nothing was changed.
- **A removal on its own goes to the removal door.** The router's `remove`
  field says, for `picture`, "true when a photograph should GO" and, for
  `nav`, "true when a menu item, a footer link or the header's button should
  GO — … "take Pricing out of the menu"". Runs 47 and 49 sent "Take Gallery
  out of the menu." on its own, and the router answered `nav` with `remove`
  both times.
- **Several changes in one message go to `look` when it can make them all,
  removals included.** `alsoAsked` says *"SEVERAL CHANGES ARE ONE TURN WHEN
  YOUR ANSWER CAN MAKE THEM ALL. "look" is worked out part by part"*, and
  lists "a photograph, the menu and the button" and "taking something off"
  among what it works out; `look` says *"SEVERAL CHANGES IN ONE MESSAGE ARE
  STILL ONE "look" ANSWER"* and that taking something off is `look` "whatever
  the something is". A layout change is not something `alsoAsked` may hold
  back (only an addition, a data change or a wording change). Neither clause
  treats the menu differently from the photograph, so **a menu link removed
  beside a layout change is routed `look` just as the photograph is**: neither
  reaches the removal door more reliably.
- **So the removal door gets other work only if the router departs from
  those instructions**, answering the removal alone for a message with more
  in it. Its handling of that work (the picker told the routed change,
  anything else listed as `additional`, each scoped) is shown only with
  supplied answers: `test/edit-removal-door.test.mjs`, the menu-and-band
  message with `nav`, the photo-and-band message with `picture`, and the
  scoped case. No natural message can be planned to reach it without forcing
  the router or rewording to steer it, which the owner has ruled out.
- **On the look door, a menu link is the weaker test of the customer
  capability.** None of the picker's lanes describes a menu item: `action`
  is "The site's primary button in the header … Only that button", and the
  only lane that mentions a menu is `behavior`, what a control does when
  used. Run 47's real picker, placing "Take Gallery out of the menu." among
  the lanes (before deploy 2164's correction), named `behavior`, whose step
  answered nothing (422, `look/no-change`). The removal door has run the
  router's own menu step since that correction, which is why run 49 worked;
  the look door has no such step. The one look-door test with a menu item
  (`test/edit-failure-paths.test.mjs`, a rename beside a footer colour)
  supplies `action` as the picker's answer. So a live run would most likely
  move the band and miss the menu link: a known gap (backlog), not the
  removal behaviour.
- **The photograph has its own lane on the look door** (`images`, "taking
  one off"), which goes to the picture rung's `clear`: the step the exact
  expected Visit page assumes. No live run has taken a photograph off (none
  is in *Proven live*, above). **Superseded 2026-09-29**: the picture rung
  now answers a removal with `remove`, and the expected Visit page is the
  element taken off (*Implemented*, below).
- **Found, recorded separately (backlog), not changed**: the missing menu
  lane above; and the photograph lane tells the picker that a removal takes
  the slot away ("the slot that held it goes with it, rather than being left
  empty"), while the picture rung's `clear` keeps it, "leaving the space
  empty", and the kit draws its placeholder there. Test 7's item 2 expects
  the placeholder, which is what the code does. (**Superseded 2026-09-29**:
  item 2 now expects the element removed; *Implemented*, below.)

**The outcome**: no suitable menu-link candidate. Test 7's request, checks,
recovery and cost stand, and what it claims is narrowed to the customer
capability.

### Held: taking a photo off leaves its space (reproduced 2026-09-29; a correction proposed for review, then implemented on the branch the same day with the owner's safeguards: *Implemented*, below)

Owner: *"However, the photo-removal contradiction directly affects Test 7, so
it cannot simply be parked while the test assumes the current implementation
is correct. The image lane promises the slot goes away; the picture executor
clears src and leaves a placeholder. Before spending, reproduce that mismatch
through the existing route and render the result using supplied model answers.
Show what the customer would see. Propose the smallest general correction that
distinguishes removing a photo element from explicitly clearing a photo while
keeping its space. Preserve unrelated content and existing swap/reframe
behavior. Do not hardcode the fixture, photo wording, or page. Return the
reproduction and concrete correction plan for review before implementation."*

**Reproduced through the real edit route** (scratch, not committed: the
harness of `test/edit-removal-door.test.mjs` on the bakery's stored pages,
every model answer supplied), sync and queued, on both doors:
- The message "Take the photograph of the counter and the morning board off
  the Visit page.", routed `picture` with `remove` (the removal door) and
  routed `look` (the look door), the picker naming `images` as the removal.
- What each model is told: the picker, "images — take a photograph off the
  page — the slot that held it goes with it, rather than being left empty";
  the picture model, whose only removal answer is `clear`, "True to REMOVE the
  picture from this slot, leaving the space empty."
- With that answer (`clear: true`) all four runs store the same Visit page:
  one line changes, `src="/u/…/d5d59152…jpg"` becomes `src=""`, and the
  `<SafeImage>` element stays. The other four pages are byte-identical; one
  compile; `photosRemoved: 1`, `photos: 1`.
- The screen: "✅ Took the picture off “The counter and morning board at
  Harbour Loaf”. One photograph is no longer on the site. If that was not what
  you wanted, say “put the photo back”. There is a space for a photo — upload
  yours in the Data panel and it’ll fill in."

**Rendered with the real build service** (`builder/build-server.mjs` in a
sandbox of the template, set up as `test/integration/site-runtime.mjs` does,
served by `test/integration/lib/serve-site.mjs`, drawn in Chromium): the
route's own compile request, with the live site's logo address, QR file and
default look added to it (the harness's stored config carries none of them),
identically before and after.
- **Before** (the saved pages): identical to the live `/visit`, 0 of 1280×1431
  pixels different.
- **After**: the photograph is gone, and the kit's placeholder (grey diagonal
  bands, an image icon, the photo's description as a caption) fills the same
  468×351 box. The location card and everything below stay where they were.

**The proposed correction, for review (not implemented)**: two answers where
there is one, and the removal made in code rather than by a model.
1. The picture tool (`PICTURE_TOOL`, `builder/site-picture.mjs`) gains
   `remove`: take the photograph off the page, the picture and the space it
   sits in both gone; the meaning of "take the photo off", "remove the
   picture", "we don't want a photo there". `clear` is narrowed to requests
   that ask to keep the space ("empty the frame", "leave a space for a new
   one") and keeps today's result exactly. An answer with both is read as
   `clear`, the one that keeps more.
2. `imageSlots` records each photo element's own span, and `applyPictures`
   takes a `remove` off the source by structure alone, with no model call:
   only a `<SafeImage>` or `<img>` that closes itself and stands as a child of
   an element (after a tag or a `}` that is not an arrow, before a `<` or a
   `{`), with its line when it has the line to itself; then any parent it
   leaves with nothing in it, while that parent is itself such a child,
   upwards. Everything else on the page is byte-identical. Removals run first,
   from the end of the file backwards; the page's other choices are then found
   again by page and alt and applied as today.
3. A picture it cannot take off on its own (a prop of a larger block such as
   `Figure` or `MediaObject`, or one written inside an expression such as
   `media={<SafeImage …/>}`) is refused by name, nothing changes, and the
   sentence offers to empty it and keep its space or to take the block off.
4. The reply names it: "✅ Took “…” off the page." In the browser, when a
   removed photograph left no space (`photosRemoved` above `photos`), the undo
   hint says to roll back to the previous build in Cloud → Versions instead of
   "say “put the photo back”", which the picture step cannot do once the slot
   is gone. The clear sentence, swaps, made pictures and reframes are
   unchanged.
5. Unchanged: the router, the lane picker and its lane texts (the `images`
   promise becomes true), the photo guard (a removal the picture step made is
   already in the pages the next step starts from), the accounting
   (`photosRemoved` counts it; `photos` stays 0, so no "There is a space"
   sentence) and the cost (the same one picture-model call).

**The rule on the stored test pages** (a scratch classifier over
`test/fixtures`): of 210 pictures the picture step can address, 190 are
elements it would take off, 21 of them with the one wrapper each leaves empty
(a `<section>` or a spacing `<div>`), none needing more; 18 are props of
`Figure` (16) or `MediaObject` (2) and 2 are `media={<SafeImage …/>}` values,
all 20 refused.

**What changes in the tests**: new unit cases for the span, the emptied
parent, the refusals, a removal beside a swap on one page, and both answers at
once; route cases, sync and queued, on both doors, with the keep-the-space
control reproducing today's output exactly; and the nine existing supplied
`clear` answers (`edit-page-protect` 5, `edit-page-photos`, `edit-page-once`,
`edit-removal-door`, `site-picture`) reviewed one by one against what the tool
will tell the model to answer. Then the mutation sweep with a comment-only
control, the full suite, unit CI and `site build`, screenshots of the reply,
and the image prediction.

**Test 7 is held** until the correction is reviewed, built, merged and
deployed. Its expected Visit page would become the fixture with the element's
six lines removed (by hand now: 3,801 characters, sha256 `263dd01e…`, to be
re-derived from the implemented code), and item 2 would read: `/visit` no
longer shows the counter photograph, nothing is drawn in its place, and the
location card sits at the top of the right column. Its request, the other
checks, the recovery and the cost stand. The missing menu lane stays a
separate backlog item.

The plan above is kept as the owner reviewed it. Where the implementation
departs from it, by the owner's safeguards or by what building it found, is
under *Implemented*, next.

### Implemented (2026-09-29; merged and deployed the same day in deploy 2167, `cb981a4a`, image `65ce683607928f0e`; runtime-confirmed by the owner's free press, run 59; shown live with real models by run 60; closed with Test 7 by the owner)

Owner: *"Implement the remove-versus-clear correction on the working branch,
with these safeguards: Use reliable TSX structure to identify the exact photo
element. … Do not automatically delete every parent that becomes empty. …
Remove a wrapper only when it is demonstrably just the removed photo's
container. Preserve exact target identity when applying several changes. …
If the model supplies contradictory actions such as remove and clear
together, report that operation as invalid rather than silently choosing
clear. Independently valid operations should still proceed. Carry an explicit
removal result into the reply and recovery hint; do not infer it from
photosRemoved > photos. For structures the targeted editor cannot safely
remove, give an accurate refusal without silently clearing the image or
removing a larger block. Record this as a remaining capability limit. … Update
Test 7 to expect actual element removal, and mark its old placeholder
expectations as superseded."* The full request and the record are
`docs/history/2026-09-29-photo-removal.md`.

**What was built**, each against a safeguard:
- **Structure, not neighbouring characters**: `photoRemoval` finds the
  photograph in the page's own syntax tree (the TypeScript reader the tweak
  rung uses, injected as the picture step's `parser`), at exactly the offset
  its slot was read from, and requires the node there to carry the slot's own
  tag. No reader, a page that does not parse cleanly, or no such node:
  `unchecked`, and nothing is cut.
- **Wrappers**: only a plain `div`, `span`, `figure` or `picture` with no
  attributes at all, whose only content is what is being removed and which
  itself stands as a child of an element, goes with the photograph. Any class,
  style, id, key, role, handler, spread, link, control, landmark or component
  keeps its wrapper, emptied.
- **Exact identity**: a removal is one more edit in the same pass as the
  page's other picture edits, at offsets from the same source; nothing is
  found again by page and description. Two photographs on one page with one
  description are refused by name (`same`).
- **Contradictions**: `remove` beside `clear`, a new picture or a framing,
  and `clear` beside a new picture, are refused by name (`conflict`), also when
  split over two entries; the other entries proceed. A removal that would take
  another chosen photograph with it (one inside its own attribute) is a
  conflict for both.
- **The explicit result**: the picture step's own count (`photosTakenOff`)
  reaches the reply, and the browser's undo hint reads it alone: "roll back to
  the previous build in Cloud → Versions". A photograph gone any other way keeps
  "say “put the photo back”".
- **Accurate refusals**: a photograph held as a prop of a larger block,
  written inside code, or with children is `part`: "I couldn't take “…” off on
  its own — it's part of a bigger block on the page — so I left it as it was.
  Say “empty that photo” to keep its space, or ask for the block to be taken
  off." Nothing is cleared or widened. The capability limit is in the backlog.
- **Kept working**: swaps, made pictures, reframes and keep-the-space (`clear`,
  now asked for by name, with exactly its old output and screen).

**Verification** (measured; the numbers are in the history file): a red
check on `17d1903c` (33 of 102 new and updated cases fail there, the
keep-the-space controls pass); a mutation sweep of 44 mutants (41 killed, the
3 survivors answered with tests and then killed; every comment-only control
survived); the full suite, 8,277 locally; CI on `4ee123d2` green (`unit
tests` 8277 / 8273 / 0 / 4, run 36539848541; `site build`, run 36539848416,
all twelve counts as on main); and renders from the route's own output with
the real build (sent to the owner): the counter's element gone and nothing
drawn in its place, the page 243 px shorter; clear, the old placeholder in the
kept frame. A merge would roll the container image to `65ce683607928f0e`.

**What Test 7 expects now**: item 2 below, rewritten. The Visit page the
route stores for Test 7's sentence, on both doors, sync and queued, with
supplied answers, is exactly the fixture less the counter's element (3,801
characters, sha256 `263dd01e…`), and the home page is exactly the move
(`0b64985c…`). **Runtime-confirmed by run 59** (2026-09-29 14:53 UTC, from
`main` on `fold-lane-bakery`): `build-health 200 deploy=cb981a4ad1d3
image=65ce683607928f0e` and `runtime 200 deploy=cb981a4ad1d3 async=true
runner=true`, every free check passed at no cost, and the balance read 37.
**Test 7 is held only for the owner's approval of the paid run**; its
request, recovery and cost stand.

### The fixture: fold-lane-bakery at `01790468089054-8btpep`

Restored by run 58 and read at 05:33 UTC; **read again by run 59 at 14:54
UTC, after deploy 2167: all five stored pages byte-identical to
`test/fixtures/run47/*.before.tsx`, the source read complete, no components,
every route at `8btpep`, and the stored description as before**, so the
expected hashes below hold for the live site. Test 6's fixture table below is its
record (stored pages, heads, menus, redirects, files). Its photograph slots,
as the picture rung sees them (`imageSlots`):
- `/`: "Harbour Loaf on a Bristol side street in the early morning"
  (`64eee06c…jpg`) and "A sourdough boule cooling after the morning bake"
  (`8e6bd481…jpg`);
- `/visit`: "The counter and morning board at Harbour Loaf"
  (`d5d59152…jpg`), its only slot;
- `/gallery`: "Harbour Loaf interior in warm morning light, with flour-dusted
  wooden counters and cooling racks of crusty loaves by the brick oven",
  already empty (`src=""`).

Each upload's name is the first 32 hex characters of its own sha256. The home
page's sections, in order: the hero, the front photograph, "Fed every morning
since we opened" with the boule, then the "Order a loaf for collection" band.
There are no components.

### The request, proposed (frozen when approved)

Verbatim: 191 characters, all ASCII, sha256
`9e4dcb228ce8c147d571598df88ce192f0af1a044eee25528ac50091ce5e595f`.

> Take the photograph of the counter and the morning board off the Visit page. Then, on the home page only, put the "Order a loaf for collection" band above "Fed every morning since we opened".

- **Why these two**: a photograph removal is the picture rung's `remove`
  (since 2026-09-29): the photograph's element comes off and nothing is drawn
  in its place, which is checkable exactly in the stored source and the served
  page. (*Superseded*: it was the picture rung's `clear`, the `src` emptied and
  the kit's placeholder drawn in its place.) The
  band move is a pure block swap on another page, checkable exactly too.
  Neither touches the stylesheet or the description, and nothing closed is
  repeated: Test 6 moved the Visit band, and this moves the home page's.
- **Why "the counter and the morning board"**: the Gallery page's empty slot
  also mentions counters. These words and the page name the Visit photograph
  alone.

### Rehearsed free through the real edit route (scratch, not committed; superseded 2026-09-29)

**Superseded by the implemented correction**: the committed route cases in
`test/edit-removal-door.test.mjs` (*MIXED*, both doors, sync and queued) now
rehearse the same sentence and expect the counter's element removed, the
Visit page exactly `263dd01e…`, and the screen "✅ Updated the look. One
photograph is no longer on the site. If that was not what you wanted, roll
back to the previous build in Cloud → Versions." The rehearsal below ran on the
old code and is kept as it was.


Every model answer was supplied, on the bakery's own stored pages
(`test/fixtures/run47/`, byte-identical to `8btpep`), with the harness of
`test/edit-removal-door.test.mjs`, sync and queued. All 9 cases pass:
- **The removal door** (router `picture` with `remove`, with and without
  `/visit` named; the picker's `additional: ["shape"]` scoped to `/` with the
  home words):
  - the calls are `pick_lanes`, `write_tweak` and `choose_pictures`;
  - the writer is handed `index.tsx` and the home words only, and the
    picture rung runs once, on the whole message;
  - `visit.tsx` is exactly the cleared slot and `index.tsx` exactly the swap,
    the other three pages are byte-identical, and there is one compile;
  - no `partial`, `pageOps [{page: "/"}]`, `photosRemoved: 1`, and the door's
    trace reads `{layer: "picture", routed: [], additional: ["shape"]}`.
- **The look door** (router `look` with no page; the picker's `images` and
  `shape`, each scoped): the same stored result, and the picture rung is
  handed only the photograph's words.
- **Caught if it happens**: a picture answer that clears the home boule
  instead leaves `visit.tsx` untouched and `index.tsx` not the swap; a door
  answer with no scopes, when the router named `/visit`, sends the layout
  there with the whole message, and the home move is dropped.
- **The screen, on both doors**: "✅ Updated the look. One photograph is no
  longer on the site. If that was not what you wanted, say “put the photo
  back”. There is a space for a photo — upload yours in the Data panel and
  it’ll fill in." It names no page change (review #9, kept separate).

### Acceptance — judged on the stored and published changes

The route's own record (the router's answer, the door, the picker's lists,
`layers`, `pageOps`) is kept as evidence of which path ran, and none of it
decides the verdict. Every item below must hold.
1. **The request**: `request.json` carries sha256 `9e4dcb22…`.
2. **The removal, stored and published** (rewritten 2026-09-29 for the
   implemented correction):
   - stored: `visit.tsx` is the fixture with exactly the counter's
     `<SafeImage>` element and its six lines taken out: 3,801 characters,
     sha256
     `263dd01eaaa4345c543038d8df75ab065d612a5ecd965cb1c8d1c8672958f5c6`.
     Nothing else in it differs, and its band stays last;
   - published: `/visit` no longer shows `d5d59152…jpg`, and **nothing is
     drawn where it was**: no image, no placeholder, no empty frame. The
     location card sits at the top of its column and the rest of the markup
     is unchanged. The upload itself is still served: a removal takes the
     photograph off the page, not out of the library;
   - **superseded** (the old code's result, not to be accepted): `visit.tsx`
     with only the `src` emptied (3,989 characters, sha256
     `46959b0d0ff57f169d9361692447cbee26aba26a127760f7f8770b45c629b4d0`), the
     slot drawing the placeholder, and a reply offering "There is a space for
     a photo". Any of these now means the picture model answered `clear` for a
     removal: a failure of item 2.
3. **The layout change, stored and published**:
   - stored: `index.tsx` is exactly the swap: 2,439 characters, sha256
     `0b64985c87e0ab1f402660fe830481b79ea5c976ac5a970130a5d41b3669e5ec`. The
     band (291 characters, `765c4f5f…`) and the "Fed every morning since we
     opened" section (628, `d5ccc270…`) are exchanged, and the part above
     (`f2944466…`), the part below (`1d4fa674…`) and the blank line between
     them are unchanged;
   - published: `/` reads "Harbour Loaf", "Order a loaf for collection",
     then "Fed every morning since we opened", in the served page and in a
     real browser. Its markup is the same two blocks swapped and nothing
     else, and both of its photographs still show.
4. **Neither dropped nor sent to the wrong page**:
   - `order.tsx`, `starter.tsx` and `gallery.tsx` are byte-identical to the
     table, and no component appears;
   - no photograph leaves `/` (the removal did not land on the home page),
     the Gallery slot is untouched, and the Visit band has not moved (the
     move did not land on `/visit`);
   - on `/order`, `/starter` and `/gallery` the markup is byte-identical, and
     the pixels are identical in a real browser.
5. **Everything else preserved**: every page's head tags are identical apart
   from the build's script names. The menus and links are identical (the
   home page's the same, reordered with the band). The redirects
   (`/the-starter`, `?x=1` and the trailing slash answer 301 to `/starter`,
   with `public, max-age=600`), the 404 and the sitemap read as before, at
   once and again ten minutes later. The QR file and the stylesheet are
   byte-identical.
6. **One publish**, built from `8btpep`, and the canary's comparison reads
   VERIFIED.
7. **Money**: the routing call plus the job's reserves, closing exactly
   against the ledger; the job reads `done` and `finalized`, and nothing is
   left open.

**Expected in the canary's own log, and not a failure**: `/visit photos
2->1 LOST 1` and `FAIL no route lost an on-page photograph -> /visit:1`. The
loss it counts is the one asked for. The run's exit is decided by the publish
alone (`process.exit(published ? 0 : 1)`), so a published run is green with
that line in it; the verdict is items 1–7.

### What each other outcome means, decided now

- **The router answers `look` with no page**: the look door, the route its
  instructions give. Items 1–7 holding shows the customer capability: a
  photograph removal beside a layout change on another page, in one message,
  both stored and published, each on its own page. **The removal door is not
  shown**, and no rewording is proposed to reach it (*The routing review*).
- **The router answers `picture` with `remove`**: the removal door, reached
  only because the router departed from its instructions for several
  changes. Items 1–7 holding would also show that door's handling of other
  work with real models: recorded as what happened, never planned for.
- **Either half put off** (`alsoAsked`): that half is held back and never
  runs, and only the other ships. Neither item is shown; a finding about the
  router, since its answer can make both changes.
- **The router answers `page` with `remove` on `/visit`** (the page read as
  the thing to take off): refused before anything is written, because other
  pages' menus link to `/visit`. Nothing changes; a routing finding.
- **The picture rung takes a home photograph off, or picks the Gallery
  slot**: the removal went to the wrong page, or was dropped. A failure.
- **The picture model answers `clear` for the removal** (keeping the space):
  the placeholder is drawn where the photograph was; item 2 fails, and it is a
  finding about the real model's reading of the tool.
- **The picture step refuses the removal** (`conflict`, `same`, `part` or
  `unchecked`): nothing is written for the photograph and the reply says why;
  item 2 fails. On this fixture only a contradictory model answer or a job
  run without the parser could cause one.
- **The picker ties `shape` to the routed change, answers no scopes, or
  scopes it to another page**: the move is dropped or runs on the wrong page.
  A failure, caught by `index.tsx` and `visit.tsx`.
- **A scope that fails its check**: withheld at no cost with its own
  sentence, and only the other change ships. Not shown; a finding about the
  real picker.
- **The quick writer declines and the full writer answers**: the same result,
  dearer (*Cost*, below).
- **Anything beyond the two changes**: a failure.

### Recovery, free, and what it must show

The canary's restore mode, to `01790468089054-8btpep`: the new version's
parent, which pruning keeps. Afterwards, run 58's checks: all five routes at
`8btpep`; the stored pages equal to the table; every head tag and the markup
identical to the `8btpep` before-read; the redirects, the sitemap, the QR file
and the card as before; the pages pixel-identical in a real browser; no
charge.

### Cost

An estimate, not a cap; each step rounds up to at least 1 credit. Routing
1–2 (run 57: 2); the page step through the quick writer, with the picker's
call, about 2 (run 57's move: 2); the picture step about 1 (a small choice
over four slots; no image is bought). **About 5–6 credits, up to about 25**
if the full page writer has to run (the page rung measured 6–22). The balance
is 37.

### The presses

Both from `main` (the branch adds only documents).
1. **The paid run, after approval** (approved and pressed as run 60): "Run the ONE paid edit as well" `yes`
   (the box already holds `no`: delete it and type `yes`); "What to change":
   the sentence above, exactly; "The site to edit": `fold-lane-bakery`; the
   two "Refuse to spend unless…" boxes
   `cb981a4ad1d3718da7df9d9da1efbb70c1cf3fa8` and `65ce683607928f0e` (deploy
   2167, runtime-confirmed by run 59; were `a64729ad…` and
   `6fbaccad82fe879d` before it); everything else as it is.
2. **The free restore, after the readings** (pressed as run 61): "Run the ONE paid edit as well"
   `no`; "PUT ONE SAVED VERSION BACK, THEN READ IT AND STOP"
   `01790468089054-8btpep`; "The site to edit" `fold-lane-bakery`; the same
   two "Refuse to spend unless…" values.

No separate free check is proposed: run 59 read the bakery at 14:54 UTC after
deploy 2167, and the paid run's own preflight and before-read come first.

### What it will not establish

The removal door given other work, which a natural message does not reach
(*The routing review*); a menu link removed beside other work, which the look
door has no lane for (backlog); component preservation (the fixture has none);
the withholding paths, unless a scope fails; a bought photograph (none is
bought); a reply naming both changes (review #9, kept separate).

### Run 60 — the paid run: both changes stored and published, each on its own page; the home page stored without its final newline (2026-09-29; closed with run 61 by the owner)

Pressed by the owner from `main` at `cb981a4a`
([run 36587530182](https://github.com/canias7/isibi-app/actions/runs/36587530182),
15:05:38–15:10:07 UTC; the evidence artifact `canary-evidence` is 45,838
bytes, sha256 `6dbad6c5…`) with the spend box `yes` (`CANARY_SPEND: 1`), the
frozen request, `fold-lane-bakery` and the two expectations. The preflight
read `cb981a4ad1d3` and `65ce683607928f0e` from both readers and a cold
container, every free check passed, the canary reads PASSED, and its
comparison is VERIFIED.
- **The path** (kept as evidence; it decides nothing):
  - the router: `look`, no page, nothing put off (17.7 s, cost 2): **the look
    door**, the route its instructions give, so the removal door is not shown
    (*What each other outcome means*);
  - the job (`3aac6339…`, created 15:06:36): the picker named `shape` and
    `images`; the move went through the page step's quick writer on `/`
    (`tweak: true`, `pageOps: [{page: "/"}]`); the picture step took the
    counter photograph off (`photosTakenOff: 1`, `photosRemoved: 1`); three
    model calls after routing (the picker, the quick writer, the picture
    choice); one publish (`publish:1` on the job row, 15:09:29–15:09:33,
    `8btpep` → `01790694429399-mjg7hp`); `done`, `finalized`, cost 3;
  - the job's stored reply carries no `partial` and nothing held back. Its
    `changed` lists only `visit.tsx`: the quick writer names no files, and
    its page is in `pageOps` (recorded separately, below).
- **Acceptance**, judged on the stored and published changes, read from the
  run's evidence, the job row, the ledger and the live site. **Items 1, 2 and
  4–7 hold. Item 3's published half holds; its stored half does not hold
  byte for byte**: the move is exact, and the file lost its final newline.
  1. `request.json` carries sha256 `9e4dcb22…` (191 characters, ASCII), and
     the router was sent the same sentence.
  2. **The removal, stored and published — holds.** `visit.tsx` is exactly
     the expected file: 3,801 characters, sha256 `263dd01e…`, with its final
     newline. Served, `/visit` lost exactly three lines of markup, the
     photograph's frame and its `<img>` (`d5d59152…jpg`), and nothing else:
     no image, no placeholder, no empty frame. The location card now sits at
     the top of its column. In a real Chromium the page is 243 px shorter
     (1,431 → 1,188): its top 312 rows and bottom 566 rows (the band and the
     footer) are identical to the pixel. The upload is still served (200,
     1,517,100 bytes, its name the first 32 hex characters of its sha256).
     The screen reads "✅ Updated the look. One photograph is no longer on the
     site. If that was not what you wanted, roll back to the previous build in
     Cloud → Versions.", the removal's sentence and hint, read off the picture
     step's own `photosTakenOff`. No superseded outcome appeared: no emptied
     `src`, no placeholder, no "There is a space for a photo".
  3. **The layout change — published: holds; stored: the swap is exact, but
     not byte for byte.** Stored, `index.tsx` is 2,438 characters, sha256
     `820cf33c64955450…`, where 2,439 and `0b64985c…` were expected: **the
     file lost its final newline, and that is the only difference**. With
     the newline put back it is byte-identical to the expected swap, so the
     band, the "Fed every morning since we opened" section, the part above
     and the blank line between them are exactly as expected; only the part
     below ends without its newline. Published, `/` reads "Harbour Loaf",
     "Order a loaf for collection", then "Fed every morning since we opened",
     in the served page and in a real Chromium; its markup is the band's nine
     lines moved above that section and nothing else; its height is the
     same (2,799), its top 1,021 rows and bottom 264 are identical to the
     pixel, and both of its photographs still show. **Why**: the quick writer
     answers with the whole file, and `readTweak` stores it as the model
     wrote it; nothing checks or restores whitespace the customer never sees.
     Run 57's quick-writer answer kept the newline; this one did not. The
     build and the served page are unaffected. Recorded separately, below;
     whether it affects the verdict is the owner's call.
  4. **Neither dropped nor sent to the wrong page — holds.** `order.tsx`,
     `starter.tsx` and `gallery.tsx` equal the table (`4ead778e…`,
     `37fb0e17…`, `4e8b82aa…`), and there is no component before or after.
     No photograph left `/` (the same three images, the logo and both
     photographs, at the same addresses, their bytes matching their names),
     the Gallery page is untouched, and the Visit band has not moved
     ("Come to the bakery", "The shutters and the street", then the band). On
     `/order`, `/starter` and `/gallery` the served markup is byte-identical,
     and in a real Chromium 0 pixels differ.
  5. **Everything else preserved — holds.** Every page's head tags are
     identical apart from the build's script names (`/`, `/gallery`, `/order`
     25 tags, `/visit` 28, `/starter` 21); the stylesheet link is unchanged.
     The header and footer menus are identical; every link is identical in
     order on the four other pages, and `/` has the same 15 links, the band's
     link to `/order` moved with it. Read without following at 15:13:56,
     15:20:42 and 15:24:06 UTC: `/the-starter`, `?x=1` and the trailing slash
     answer 301 to `/starter` (the query kept) with `public, max-age=600`;
     all five routes answer 200 at `mjg7hp`; the sitemap lists the five;
     `/nonexistent-page` answers 404. `qr-gallery.svg` (4,079 bytes,
     `45f42f27…`), the stylesheet (205,087, `544ff34e…`) and `/card.png`
     (31,778, `ce884f5b…`) carry their recorded sha256s. The stored
     description is unchanged.
  6. **One publish — holds**: `01790694429399-mjg7hp`, built from `8btpep`,
     VERIFIED, and seen on the first after-read. The parent `8btpep` is the
     restore target, and pruning keeps the new version and its parent
     (`pruneBuilds` with `keep: [version, parentVersion]`).
  7. **Money — holds.** 5 credits, closing exactly: routing 2 (37 → 35),
     then the reserves `#1` 2 (ledger row 337, 33) and `#2` 1 (row 338, 32),
     with no refund. Read again at 15:27 UTC: the balance is 32 (updated
     15:07:09), there is no ledger row after 338 and no edit job created
     after the run, the job is `done` and `finalized` at cost 3, and no edit
     job is open (the only rows not in a final state are two `lost` and
     `refunded` jobs on `fretwork-1` from 2026-09-01 and 09-02). The two
     zero-cost preflight jobs failed at cost 0, as they are built to. The
     estimate was about 5–6.
- **Expected in the canary's log, and not a failure**: `/visit photos 2->1
  LOST 1` and `FAIL no route lost an on-page photograph -> /visit:1`; the loss
  counted is the one asked for. Its components note: this fixture has none,
  so component preservation stays untested.
- **Seen in the pictures, and not this run's**: above "Fed every morning since
  we opened" the home page draws an empty picture frame, before and after.
  The kit's `StoryLead` always draws a picture, and the page gives it none
  (recorded separately, below).
- **Found, recorded separately** (backlog; none changed):
  - the quick writer stores the model's whole file as written, so whitespace
    outside the change can differ from the page it was given (this run:
    `index.tsx`'s final newline);
  - a look reply's `changed` lists only the steps that name their files; the
    quick writer names none, so this reply reads `changed: ["visit.tsx"]`
    beside `pageOps: [{page: "/"}]`. Nothing the customer reads uses it on a
    look reply; a model-written reply would (review #9's family);
  - the bakery's home page shows `StoryLead`'s empty frame (above).
- **What it shows** (closed by the owner for this, with the newline as a
  specific exception: *Closed*, below): the customer capability,
  through the look door, with real models: one message taking a photograph's
  element off one page and moving a band on another, both stored and
  published, each on its own page, with nothing else changed on the site,
  apart from the home page's final newline in storage. **What it does not
  show** is unchanged (*What it will not establish*, above).
- **Recovery**: the free restore to `01790468089054-8btpep` (*The presses*,
  item 2), pressed by the owner as run 61, below: everything is back.

### Run 61 — the free restore put everything back (2026-09-29)

Pressed by the owner from `main` at `cb981a4a`
([run 36591050919](https://github.com/canias7/isibi-app/actions/runs/36591050919),
15:33:03–15:34:34 UTC; the evidence artifact `canary-evidence` is 23,983
bytes, sha256 `1b08aaeb…`) with the spend box `no` (`CANARY_SPEND: 0`), the
restore box `01790468089054-8btpep`, `fold-lane-bakery` and the two
expectations. The preflight read `cb981a4ad1d3` and `65ce683607928f0e`, and
every free check passed.
- **The restore**: the version list held 13 versions, `mjg7hp` live with
  `8btpep` as its parent; the restore answered 200 (`files: 24`, `swept: 0`),
  and the site reported `8btpep` itself on three reads after it.
- **What it must show** (*Recovery, free, and what it must show*), every item
  holding:
  - all five routes answer 200 at `8btpep` (read again live at 15:35:16 UTC);
  - the stored pages equal the table and are byte-identical to
    `test/fixtures/run47/*.before.tsx`: `index.tsx` 2,439 characters
    (`51b5af6a…`, its final newline back), `visit.tsx` 4,045 (`bdb02abe…`),
    `order.tsx`, `starter.tsx` and `gallery.tsx` as before; no components; the
    stored description as before;
  - every page's served markup, head tags included, is identical to run 60's
    `8btpep` before-read apart from the render timestamps;
  - `/the-starter`, `?x=1` and the trailing slash answer 301 to `/starter`
    with `public, max-age=600`; `/nonexistent-page` answers 404; the sitemap
    lists the five; `qr-gallery.svg` (`45f42f27…`), the stylesheet
    (`544ff34e…`) and `/card.png` (`ce884f5b…`) carry their recorded
    sha256s, and every photograph's bytes match its name, the counter
    photograph's included;
  - in a real Chromium, the live pages drawn as run 60's were (GET only,
    reduced motion): all five are identical to the pixel to the `8btpep`
    before-read, every image loaded, and there are 0 page errors. The three
    console errors on each page are the three `POST /cdn-cgi/rum` requests of
    Cloudflare's analytics beacon, which the browser wall refuses, as in run
    58;
  - **no charge**: read at 15:37 UTC, the balance is 32 (last changed at
    15:07:09 by run 60's reserve), no ledger row came after 338, the two
    zero-cost probe jobs (`e896f679…` on the bakery, `2c5e4ec9…` on
    `washhouse-3`) ended `failed` at cost 0 with billing `none`, and no edit
    job is open.

### Closed by the owner (2026-09-29)

Owner, 2026-09-29: *"Close Test 7 for the customer behavior demonstrated by
runs 60 and 61: the Visit photograph's element removed without a placeholder,
the Home band moved, both published together, unrelated site content
preserved, and the original version restored free. Accept the missing final
newline as a specific nonfunctional exception for this acceptance. Keep it
recorded; do not claim byte-for-byte preservation or exempt other whitespace
changes generally. Keep the reply omission and remaining photo-removal
limitations separate. Do not repeat Test 7."*
- **Closed for**: one message, through the look door with real models, taking
  the Visit photograph's element off with no placeholder and moving the home
  page's band, both published together in one publish; the rest of the site
  preserved; and `8btpep` restored free (run 61).
- **The exception, for this acceptance only**: the stored `index.tsx` lost its
  final newline (2,438 characters, `820cf33c…`, against the expected 2,439,
  `0b64985c…`). It is accepted as nonfunctional here and stays recorded
  (backlog: the quick writer stores the model's whole file as written). **No
  byte-for-byte preservation is claimed for that file, and no other
  whitespace change is exempt**: any other acceptance still judges its stored
  files exactly.
- **Kept separate**: the reply omission (review #9: the reply names the look
  change and not the band move) and the remaining photo-removal limits
  (backlog: what the picture step cannot take off on its own).
- **Not to be repeated.**

## Test 6 — two changes in one message, one on a named page (prepared 2026-09-28, request clarified the same evening; the free check, run 51, passed; the paid run, run 52, shipped the description, and the router put the Visit move off to a later turn; the free restore, run 53, put everything back; the owner: run 52 does not close Test 6; the routing/execution mismatch it showed is fixed and deployed, 2026-09-29, deploy 2166, runtime-confirmed by the free check, run 54; the retry, run 57, stored and published both changes; the free restore, run 58, put everything back; closed by the owner, 2026-09-29, for exactly what runs 57 and 58 showed)

Owner, 2026-09-28: *"prepare one bounded test combining two requested changes
in one message, ideally also covering a named non-home page. Use an existing
fixture and workflow, establish exact before/after expectations and recovery,
and include preservation of existing redirects in the checks."* Then, on the
first draft: *"Clarify the request before freezing it: change the site's
default search description while keeping existing page-specific descriptions
unchanged, then move the named band on Visit only. Record that exact sentence
in the evidence. … For acceptance, judge the actual stored and published
changes, not only the chosen lane names. … Restore afterward and verify the
original metadata as well as pages and navigation. Keep the known reply
omission separate. This test covers mixed work through the look path; it does
not establish real-model mixed work through the removal path."*

**What it covers**, from the short checklist:
- **item 3, through the look door only**: two requested changes in one
  message, one for the whole site and one for a page, with one publish;
- **item 4**: a named page other than the home page on a look edit. The router
  must name `/visit`, or the page change goes to the home page;
- **item 1's first half**: the redirect fix's first live use. The publish must
  keep `/the-starter` → `/starter`.

**What it does not cover**:
- **mixed work through the removal door with a real model**: a `nav` or
  `picture` removal given other work, where the picker is told the routed
  change and lists anything else separately. Run 49's real picker was given no
  other work. That stays outstanding under item 3, whatever this test shows;
- a second message, a removed page's 301 home (nothing is removed), and a
  protection refusing a real answer (unless the page writer over-answers,
  below).

### The fixture: fold-lane-bakery at `01790468089054-8btpep`

Restored by run 50. Read again free on 2026-09-28 at 19:57, 20:09 and 20:40
UTC, with no difference between the readings, and by the free check, run 51,
at 22:57 UTC (*Run 51*, below): the stored pages equal the table byte for
byte, and each served page equals its 19:57 reading apart from the render
time the site writes into every response.

- **Stored pages** (run 50's before-read; sha256 in full):

  | page | chars | sha256 |
  |---|---|---|
  | `index.tsx` | 2,439 | `51b5af6af6ee25ca286ede451c0c7a847c5b9b0e1cea282c4ac96497a6a03ef7` |
  | `order.tsx` | 9,258 | `4ead778eea41faafea0e54936fbf0f45fe2914f008947f6128e8ee860a31c1ae` |
  | `starter.tsx` | 951 | `37fb0e176f22a44be663a9df9f9851095f9e472b229b62e146390d5e3dc1cd44` |
  | `visit.tsx` | 4,045 | `bdb02abecad96c5665618fa29d98deabea7f2020289e2f91d38f22d2d7843c0b` |
  | `gallery.tsx` | 3,007 | `4e8b82aa901741e0f5dbf0511f6f2331b5354f50bd5ee7bc9438d7bccb11ba1c` |

  There are no components.
- **The head of each page.** A page with no description of its own shows the
  site's default; three pages set their own in their source:

  | page | title | `description` and `og:description` | whose |
  |---|---|---|---|
  | `/` | Harbour Loaf | "Neighbourhood sourdough in Bristol. Browse today's bake and order a loaf for collection." | the site default |
  | `/starter` | Harbour Loaf | the same | the site default |
  | `/visit` | Visit — Harbour Loaf | "Opening hours and how to find the bakery in Bristol." | its own, in `visit.tsx` |
  | `/gallery` | Our Gallery — Harbour Loaf | "See photographs of the bakery and its work." | its own |
  | `/order` | Order a loaf — Harbour Loaf | "Choose a loaf from today's bake and a collection time at the counter." | its own |

  Every page also carries `og:title`, `og:site_name`, `og:type`, `og:locale`,
  `theme-color`, `site-slug`, `og:image` (the uploaded logo), `og:image:alt`,
  `twitter:card`, `og:url`, and the canonical, icon and apple-touch-icon links.
  Each page's full set of head tags is recorded, and it read identically at
  19:57 and 20:40.
- **The description stored in the site's settings**, first read by run 51:
  "Neighbourhood sourdough in Bristol. Browse today's bake and order a loaf
  for collection." It is the published default on `/` and `/starter`, so the
  settings and the served head agree before the test (*the one measurement
  added*, below).
- **The menus** (header and footer links):
  - `/` and `/gallery`: Today's bake, The starter, Visit, Gallery, and the
    "Order a loaf" button;
  - `/visit` and `/order`: the same without Gallery;
  - `/starter` is a stub page with no menu.
- **Routes and redirects** (read without following redirects):
  - all five routes answer 200 at `8btpep`, and the sitemap lists those five;
  - `/the-starter`, `/the-starter?x=1` and `/the-starter/` answer 301 to
    `/starter` (the query kept), with `cache-control: public, max-age=600`;
  - `/nonexistent-page` answers 404.
- **The Visit page's sections, in order**: "Come to the bakery" (the h1, then
  "The shutters and the street", the hours, the QR code and the counter
  photograph), then the "Order a collection so we hold a loaf" band.
- **Files**:
  - `qr-gallery.svg`: 4,079 bytes, sha256 `45f42f270f6cab21…`;
  - `/assets/index-C3kRA7Jc.css`: 205,087 bytes, sha256 `544ff34e85eac5df…`,
    with no stylesheet of the site's own;
  - `/card.png`, the share card: 31,778 bytes, sha256 `ce884f5b165def06…`. The
    build draws it from the description, and it is served; this site's
    `og:image` is the uploaded logo instead.
- **A real Chromium over TLS-verified live bytes**: each page's headings,
  buttons and colours are recorded, with 0 page errors.

### The request, frozen

Verbatim: 358 characters, all ASCII, sha256
`484b3febf7e0fe13632585045e93d14e33020486eda4dbbd170b2d480a44f734`. The
paid run's `request.json` must carry the same sha.

> Change the site's default search description, the one Google shows, to "Overnight sourdough from a Bristol side street, baked every morning and ready to collect at the counter." Where a page has its own description, leave that description as it is. Then, on the Visit page only, put the "Order a collection so we hold a loaf" band above "Come to the bakery".

**Why it was reworded.** The first draft (255 characters, sha256
`f894d3e4…`) asked for "the description that shows in Google". The Visit
page has a description of its own, so a page writer could fairly have read the
first half as being about that page's description. The frozen sentence names
the site's default, keeps every page's own description, and puts the move on
the Visit page only.

**Why these two changes:**
- **The description** is a whole-site look field, the `description` lane. It
  changes no page. Its stored value and its published value are both checkable
  exactly.
- **The band move** is a pure block move on a named page: the `shape` lane,
  sent to the page rung on `/visit`. It is checkable exactly in the stored
  source and in the served page.
- **Neither touches the stylesheet**, so the closed stylesheet work stays
  closed.
- **The router's own description of `look` covers both**: *"its one-line
  description"*, and *"a section, a band"* when the page is named.

### The one measurement added: the stored description

- **No existing reading showed it.** The canary's `source.json` holds pages
  and components, its saved HTML holds the served head, and the job's stored
  reply names the field it changed (`moved: ["description"]`) but never the
  value (rehearsed).
- **Why it matters.** The served head says what the last publish shipped; the
  settings are what the next publish will ship. An edit or a restore that left
  the two apart would stay invisible until an unrelated edit republished.
- **What was added** (on the branch, 2026-09-28):
  - the canary's inventory also reads the app's own SEO & Social route
    (`GET /api/site/<slug>/seo`, owner only, read-only);
  - it records the answer in `inventory.json`, prints it with the
    before-reading, and a paid run records both sides in `compare.json`;
  - `readStoredHead` (`scripts/canary-watch.mjs`) answers the description, or
    "cannot tell" for any other answer, never a made-up value. `""` is a real
    answer (no description set), and only from a route that answered.
- **Tests**:
  - 2 cases in `test/canary-watch.test.mjs`: the reader over 15 answer shapes,
    and the wiring, which fails on the canary without the read;
  - the 156 cases of the five canary test files pass;
  - the whole suite reads 8,207 / 8,205 / 0 / 2 locally, and unit CI run
    36481473984 on `f08c3ba1` reads 8,207 / 8,203 / 0 / 4 (the total matches;
    CI skips four), with both new cases found passing by name, 8,207 distinct
    results and no `not ok`;
  - no site build is owed: none of the files is on that workflow's paths.
- **Where the presses run.** `scripts/**` and `test/**` deploy nothing, and
  the change is not merged, so Test 6's presses are made from the branch. A
  branch press runs the branch's script against main's Worker, which is what
  the preflight checks (runs 36–47 were pressed that way).

### Rehearsed free through the real edit route (re-run with the frozen sentence)

Every model answer was supplied, on the bakery's own stored pages. These are
scratch cases, not committed. The frozen sentence gave the same outcomes as
the first draft.

- **Router `look` + page `/visit`, picker `description` + `shape`**, on both
  money paths:
  - the calls are `pick_lanes`, the description lane, and the quick writer
    shown `visit.tsx`;
  - there is one compile, `visit.tsx` is exactly the swap, and the other four
    pages are byte-identical;
  - the description is stored exactly;
  - two step charges;
  - the reply is "✅ Updated the look — the description."
- **The same, with the quick writer declining and the full writer answering
  the swap**: the same result, with the page step dearer.
- **Router `look` with no page**: the quick writer is shown `index.tsx`, so
  the page change goes to the home page.
- **Router `page` on `/visit`**: only the move, and the reply is "✅ Updated
  /visit."
- **The picker naming only one lane**: only that half happens. With
  `description` alone the move is dropped, and the reply still reads "✅
  Updated the look — the description."
- **The page writer also rewriting the Visit page's own description**:
  - the quick writer's word check refuses it;
  - the full writer's same answer publishes, because the text guard covers
    literal on-page wording only. The frozen sentence now says to leave it,
    so a live rewrite would be the model not following the request.

### Acceptance — judged on the stored and published changes

The route's own record (`lanes`, `layers`, `pageOps`, the routing answer) is
kept as evidence of which path ran, and none of it decides the verdict. Every
item below must hold.

1. **The request**: `request.json` carries sha256 `484b3feb…`.
2. **The description, stored and published**:
   - stored: the settings read the original before the run and exactly the
     new sentence after it;
   - published: `description` and `og:description` on `/` and `/starter` are
     exactly the new sentence;
   - `/visit`, `/gallery` and `/order` keep their own descriptions exactly;
   - every other head tag on all five pages is identical to the before
     reading.
3. **The band move, stored and published**:
   - stored: `visit.tsx` is the two sections swapped. The expected page is
     4,045 characters, sha256
     `35b008fdb4f1a49b948d2bb54ce9225af35b1504a71af54281c0283d1d455993`.
     Each section is byte-identical ("Come to the bakery" 1,734 characters,
     `84a1dd25…`; the band 344, `22b3ffeb…`), and so is everything outside
     them (`aa5eaaab…` above, which holds the page's own description, and
     `1d4fa674…` below). The whitespace between the two sections is inspected.
     Nothing else may differ;
   - published: on `/visit` the headings read "Order a collection so we hold
     a loaf", then "Come to the bakery", then "The shutters and the street",
     in the served page and in a real browser.
4. **Unrelated source and navigation preserved**:
   - the four other stored pages are byte-identical, and no component
     appears;
   - every page's menu (header and footer links) and its other links are
     identical to the before reading;
   - every page renders as before in a real browser, the photographs load,
     and there are no page errors.
5. **Redirects preserved**, read without following, when the new version is
   live and again ten minutes later (the 301's cache life):
   - `/the-starter`, `?x=1` and the trailing slash answer 301 to `/starter`,
     with `public, max-age=600`;
   - all five routes answer 200 at the new version, the sitemap lists the same
     five, and `/nonexistent-page` answers 404.
6. **One publish**: a version built from `8btpep`, and the canary's comparison
   reads VERIFIED.
7. **Money**: the balance moves by the routing call plus the job's reserves,
   closing exactly against the ledger; two reserves (`#1`, `#2`), no refund;
   the job reads `done` and `finalized`.

**Inspected, not pass conditions**: the QR file (expected byte-identical);
`/card.png` (expected to change, since it is drawn from the description); the
served stylesheet (expected unchanged, and any difference is explained).

**The reply, kept separate.** It is read through the browser's own composer
and checked for truth: "✅ Updated the look — the description." is true of
what it says. It does not mention the Visit page change; that is the known
reply omission (review #9: a multi-step look reply names no page edit beside
the look change), recorded on its own. It is neither a pass condition nor a
failure of this test.

### What each other outcome means, decided now

- **The router leaves `page` out**: the move goes to the home page. That is a
  named-page failure (item 4), caught by `index.tsx`'s hash. The home page's
  "Order a loaf for collection" band is the likely wrong target.
- **The router answers `page`, with the description in `alsoAsked`**: one
  change per turn, which is by design. The reply's tail is then accurate, and
  item 3 is not shown.
- **`alsoAsked` set while both changes shipped**: the recorded contradiction
  (the reply says one change was not made).
- **The picker names one lane**: half the request is silently dropped. A
  failure.
- **The Visit page's own description is rewritten too**: wider than asked,
  against the request's own words. A failure, and a known gap of the text
  guard.
- **`visit.tsx` changed beyond the swap, or any other page changed**: a
  failure.
- **The description stored in words other than those quoted**: the lane did
  not follow a literal ask. A failure.
- **The stored and published descriptions disagree after the run**: a finding
  about the publish, whatever else passed.
- **`/the-starter` answers 404**: the redirect fix failed live. This is the
  top finding.
- **Intent `addon`**: the canary refuses to spend beyond the routing call.

### Recovery, free, and what it must show

- The canary's restore mode, to `01790468089054-8btpep`. It will be the new
  version's parent, and pruning keeps a version's parent.
- **After the restore, every item must hold**:
  - all five routes answer at `8btpep`;
  - the stored pages are byte-identical to the table;
  - every page's head is identical to the before reading, so `/` and
    `/starter` show the original description again and the other three keep
    their own;
  - the stored description reads the original again. The restore code puts
    back the whole saved look (`STATE_CONFIG_FIELDS`); this is the first time
    that is observed rather than read in the code;
  - every page's menu and links are identical to the before reading;
  - the redirects, the sitemap and the QR file are as before, and `/card.png`
    is `ce884f5b…` again.
- Pressed right after the paid run's readings, so the fixture stays at its
  recorded state.

### Cost

An estimate, not a cap. Each step rounds up to at least 1 credit.
- routing: 1–2;
- the description step (the picker and the lane): about 2;
- the page step: about 2 through the quick writer (run 9: 2,413 in / 1,230 out
  on a 4,389-character page), or about 6 if the full writer has to run
  (run 37).

**About 5–6 credits, up to about 10.** The frozen sentence adds about 100
characters to each prompt, which does not move the estimate. The balance is
45.

### The presses

All three are `edit-canary.yml` from the branch `claude/help-needed-ehlwlj`.
1. **The free check for deploy 2165**: pressed by the owner as run 51, and
   passed (*Run 51*, below):
   - "Run the ONE paid edit as well": `no`;
   - the two "Refuse to spend unless…" boxes:
     `f5e941f494fd96c039eeee4e6f1d44120b80e062` and `8a10715339cdc780`;
   - "The site to edit": `fold-lane-bakery`;
   - everything else as it is.

   From the branch it also takes the first reading of the stored description.
   The canary reads the site named in "The site to edit", whose default is
   `fretwork-1`, so the box names the fixture (corrected 2026-09-28, before
   the press). From `main` it confirms the deploy just the same, without that
   reading.
2. **The paid run, after approval**:
   - "Run the ONE paid edit as well": `yes`;
   - "What to change": the frozen sentence above, pasted exactly;
   - "The site to edit": `fold-lane-bakery`;
   - the same two expectations;
   - everything else as it is.
3. **The recovery, free**:
   - "Run the ONE paid edit as well": `no`;
   - "PUT ONE SAVED VERSION BACK…": `01790468089054-8btpep`;
   - "The site to edit": `fold-lane-bakery`;
   - the same two expectations.

### Run 51 — the free check passed (2026-09-28)

Pressed by the owner from the branch at `37f90769` with the values in press 1
([run 36495325713](https://github.com/canias7/isibi-app/actions/runs/36495325713),
22:57 UTC, 38 seconds; the evidence artifact `canary-evidence` is 21,619
bytes, sha256 `3bb2190d…`).
- **Deploy 2165 is runtime-confirmed**: `build-health 200 deploy=f5e941f494fd
  image=8a10715339cdc780` and `runtime 200 deploy=f5e941f494fd async=true
  runner=true`. The two readers agree, and both expectations are met.
- **The free checks**: the bakery and the control (`washhouse-3`) each get
  the queued shape; a forged replay marker and another account's job answer
  404; the empty job settled in about 6 seconds with `reason: "empty"`,
  `cost: 0`. Both empty jobs read `failed` with billing `none` in the queue.
  `ALL FREE CHECKS PASSED`.
- **The fixture is unchanged**:
  - the five stored pages equal the table above, sha256 for sha256, and there
    are no components;
  - all five routes answer at `01790468089054-8btpep`, with the before-state's
    headings and photographs (`/visit`: "Come to the bakery", "The shutters
    and the street", "Order a collection so we hold a loaf");
  - each served page equals its 19:57 reading once the render time the site
    writes into every response (`u:` in the page's data, twice per page) is
    set aside. The two 19:57 readings of `/` differ in the same place, so the
    value changes on every request.
- **The stored description, first read**: "Neighbourhood sourdough in Bristol.
  Browse today's bake and order a loaf for collection." It equals the
  published default on `/` and `/starter`, so it is the "before" value for
  acceptance item 2.
- **Money**: the run read a balance of 45, and so does the table; the newest
  ledger row is still 333 (run 49's reserve). Nothing was charged.
- No edit job is left in flight on the bakery.

### Run 52 — the paid run: the description shipped, and the router put the Visit move off to a later turn (2026-09-28)

Pressed by the owner from the branch at `db7080f4` with the values in press 2
([run 36497835327](https://github.com/canias7/isibi-app/actions/runs/36497835327),
23:24–23:29 UTC; the evidence artifact is 46,305 bytes, sha256
`10c6d592…`). The preflight read deploy `f5e941f494fd` and image
`8a10715339cdc780` again, and every free check passed.

**What ran**
- **The router** (22.8 s, 2 credits): `intent: edit`, `layer: look`, **no
  page**, and `alsoAsked`: "on the Visit page only, put the "Order a
  collection so we hold a loaf" band above "Come to the bakery"". It read the
  move as a second change to another part of the site and put it off: one
  change per turn, as its tool description says.
- **The job** (`c7aab7629f77c268144699842781e18c`; its stored reply came
  209.8 s after the post): the picker named `description` and `shape`. The
  description lane wrote the new sentence. The `shape` step went to the page
  rung on `/`, because no page was named, and answered `page/no-change`. One
  publish, `01790637993219-u51eu0`, built from `8btpep`.
- **The reply**, through the browser's own composer: "✅ Updated the look — the
  description. ⚠️ I read the / page and couldn't find a change to make for
  that. Say what should look different, or which section you mean.", then "I
  only did one thing this time. Say “on the Visit page only, put the "Order a
  collection so we hold a loaf" band above "Come to the bakery"” and I’ll do
  that next."

**Acceptance, judged on what was stored and published**
1. **The request**: `request.json` carries sha256 `484b3feb…`. Holds.
2. **The description**: stored exactly (the original before, the new sentence
   after); `/` and `/starter` publish it in `description` and
   `og:description`; `/visit`, `/gallery` and `/order` keep their own; every
   other head tag on the five pages is identical. Holds.
3. **The band move**: **not made.** `visit.tsx` is still the before-page
   (`bdb02abe…`), not the expected swap (`35b008fd…`), and `/visit` still reads
   "Come to the bakery", "The shutters and the street", "Order a collection so
   we hold a loaf". **Fails.**
4. **Everything else preserved**: the other four stored pages are
   byte-identical, and there are still no components; every page's menus and
   links are identical; a real Chromium renders all five pages exactly as
   before (headings, sections, buttons, colours and text; every photograph
   loaded; 0 page errors). Holds.
5. **Redirects**: the publish kept the stored redirect, the redirect fix's
   first live use. Read at 23:29:12, as the new version went live, and at
   23:39:30: `/the-starter`, `?x=1` and the trailing slash answer 301 to
   `/starter` with `public, max-age=600`; all five routes answer 200 at the new
   version; the sitemap lists the same five; `/nonexistent-page` answers 404.
   Holds.
6. **One publish**: `01790637993219-u51eu0` from `8btpep`, and the comparison
   reads VERIFIED. Holds.
7. **Money**: 3 credits, closing exactly: the routing call 2 (45 → 43) and the
   job's one reserve of 1 (ledger row 334, `c7aab762…#1`, balance 42); no
   refund; the job reads `done`, `finalized`, cost 1. The plan expected two
   reserves; the page step changed nothing and charged nothing. Holds.

**Inspected**: the QR file is byte-identical; `/card.png` changed, as
expected (33,358 bytes, sha256 `467d9cdb…`); every page's build files, the
stylesheet among them, are unchanged.

**Against the outcomes decided in advance**: this is the router leaving
`page` out, in its one-change-per-turn form. Nothing reached the wrong page,
because the home page's writer found nothing to change. So **item 3 through
the look door and item 4 were not shown**, and item 1's first half (a publish
keeping stored redirects) was. The reply's tail is accurate about the move; the
⚠️ sentence before it is the finding below.

**Found, recorded separately** (`docs/backlog.md`): when the router puts half
of a message off (`alsoAsked`), the job is still sent the whole message. The
picker picked a lane for the put-off half and ran it on the home page, because
the only page named belonged to that half. It changed nothing and cost nothing
more, but the reply tells the customer both that the home page could not be
changed and that the move comes next.

**Next**: the free restore to `8btpep` (press 3), then the owner's review.

### Run 53 — the free restore put everything back (2026-09-28)

Pressed by the owner from the branch at `fc1f84c5` with the values in press 3
([run 36499761486](https://github.com/canias7/isibi-app/actions/runs/36499761486),
23:46–23:47 UTC). The preflight read `f5e941f494fd` and `8a10715339cdc780`
again, and every free check passed.
- **The restore**: the site listed 12 versions with run 52's
  `01790637993219-u51eu0` live; the app's own restore of `8btpep` answered 200
  (24 files, `worker: true`), and the site reported `8btpep` on the first read.
- **Stored**: the five pages equal the table, sha256 for sha256, with no
  components, and **the stored description reads the original again**. The
  restore puts back the whole saved look (`STATE_CONFIG_FIELDS`); this is the
  first time that was observed rather than read in the code.
- **Published**, read at 23:47:31, as `8btpep` went live: every page's head
  equals the before-reading (`/` and `/starter` show the original description
  again), and so do the menus, the links in order, the headings and the build
  files. The redirects, their cache life, the 404, the sitemap and the QR file
  are as before, and `/card.png` is `ce884f5b…` again (31,778 bytes).
- **Money**: nothing charged. The balance is 42, no ledger row after 334, and
  no edit job is left open on the bakery.

Test 6 is complete as run and waits for the owner's review: the description
half and the redirect carry-over shown live, the named-page move not made, and
the finding recorded separately.

### The owner's review, and the fix on the branch (2026-09-29)

Owner: *"Run 52 does not close Test 6. The description worked; the Visit move
did not. Run 53 restored the fixture successfully. Keep those results recorded
and do not repeat either run yet. Fix the general routing/execution mismatch
demonstrated here … Test 6 stays open."*

**The fix, at `9a79fc2d` on `claude/help-needed-ehlwlj`, not merged and not
deployed** (the story is `docs/history/2026-09-29-op-scope.md`; the suite
`8232 / 8230 / 0 / 2` locally and `8232 / 8228 / 0 / 4` on unit CI, run
36508164135; the mutation sweep 46 of 46 killed, both controls surviving; a
merge would roll the image to `ea3f680b3b227bd9`):
- **the router puts off only what its answer cannot do this turn**. Run 52's
  message is one `look` answer with no page, since its changes are on the
  whole site and a page;
- **a part put off is held back, never run**. The browser posts it and the
  edit and add-on routes take it out before anything runs (`heldBack`); the
  reply's tail comes from what the route really held back (`deferred`); words
  it cannot find are refused at no cost (`route/held-unread`);
- **each change runs with its own page and words**. The picker names them
  (`scopes`); the description lane is handed the description's words, and the
  Visit move is made on `/visit` with the Visit words alone.

**Proof: supplied model answers only.** Run 52's frozen sentence through the
real route and browser code (sync and queued), two pages in one message, the
put-off cases on both routes, a scoped removal beside a layout change on run
47's pages, the controls, and units. Nine of the eleven route cases and the
scoped door case are red on `37574455`; the two controls are green there. No
real router or picker has been measured on this: **whether a real router now
leaves the Visit move in the turn, and whether a real picker scopes it to
`/visit`, is what a live run would show.** None is proposed here; runs 52 and
53 are not repeated.

**Corrected after the owner's review (2026-09-29, `9ed7da51`; unit CI
`8241 / 8237 / 0 / 4`, `site build` green; merged and deployed as deploy
2166).**
The owner reproduced two ways round the scope: a page of `["/visit"]` read as
"no page" sent the Visit move to the home page's writer,
and words the request does not hold handed the Visit writer the whole request.
Now only an answer with no scope metadata at all runs the old way; on a scoped
answer an op that fails its check (a page that is not a path, words not in the
message, a page the site lacks) and a picked lane the answer left unscoped are
withheld, at no cost and with their own sentence, and the valid work beside
them still ships. Both reproductions are route cases, sync and queued: the
wrong writer is never called, no other change's words are forwarded, the
description is stored, and the reply says both. The story is the history
file's *The correction after the owner's review*.

### Run 54 — deploy 2166's free check (2026-09-29)

Pressed by the owner from `main` at `a64729ad`
([run 36517850642](https://github.com/canias7/isibi-app/actions/runs/36517850642),
03:35:58–03:36:40 UTC): "Run the ONE paid edit as well" `no`, "The site to
edit" `fold-lane-bakery`, and the two expectations `a64729ad…` and
`6fbaccad82fe879d`. All 14 checks passed, and the run stopped at "Nothing was
charged".
- **The preflight**: `build-health 200 deploy=a64729ad741a
  image=6fbaccad82fe879d` and `runtime 200 deploy=a64729ad741a async=true
  runner=true`; the two readers agree, and both expectations are met.
  `washhouse-3` reads `async=true`.
- **The queue and the runner**: the bakery's empty edit queued (`202`, job
  `15bc37e5…`), was claimed by a container (`c_qkne0ui2`) within 2 s, was
  refused `empty` at cost 0 and finalized after about 4 s. `washhouse-3`'s
  (`ac3fb591…`, container `c_8r80nnnn`) did the same. Both rows read
  `failed`, `billing none`, `cost 0`, and no job is queued or running. A job's
  row does not record which image its container ran; the cold-start image is
  `build-health`'s reading.
- **The fixture**, as recorded:
  - the five stored pages equal the table sha256 for sha256, with no
    components, and the stored description is the original;
  - all five routes answer at `8btpep`, and the Visit headings read "Come to
    the bakery", "The shutters and the street", then the band;
  - each page's title, `description` and `og:description`, and the header and
    footer menus, equal the table;
  - read publicly at 03:39 UTC: `/the-starter`, `?x=1` and the trailing slash
    answer 301 to `/starter` (the query kept) with `public, max-age=600`,
    `/nonexistent-page` answers 404, the sitemap lists the five routes, and
    `qr-gallery.svg` (4,079 bytes), the stylesheet (205,087) and `/card.png`
    (31,778) carry the recorded sha256s.
- **Money**: nothing charged. The balance is 42, and the ledger's last row is
  still 334.

**Deploy 2166 is runtime-confirmed.** The deploy's success was its own report
(run 36514259994); this is the live Worker and a cold container answering.

### The retry, for the owner's approval (2026-09-29; approved, and pressed as run 57, below)

The same frozen sentence, fixture, presses and recovery as run 52 and run 53,
on deploy 2166. That deploy tells the router that a change to the whole site
and a change to one page are one `look` answer with no page, and it has the
picker name each change's page and words (`scopes`).
- **The path expected** (kept as evidence; it decides nothing): the router
  answers `look` with no page and nothing put off; the picker names
  `description` and `shape`, with the shape scoped to `/visit` and the Visit
  words; the description lane is handed the description's words; the page
  step runs on `/visit` with the Visit words; one publish.
- **Acceptance**: items 1–7 of *Acceptance* above, unchanged, judged on the
  stored and published changes.
- **What each other outcome now means.** These rows replace the router rows of
  the table above for this deploy; the other rows stand:
  - the router puts the Visit move off (`alsoAsked`): the move is held back
    and never run, the reply says it comes next, and only the description
    ships. Item 3 is not shown;
  - the router answers `page` on `/visit` and puts the description off: the
    move ships and the description is held back. Item 3 is not shown;
  - the picker's Visit scope fails its check (a page that is not a path, or
    words not copied from the message): the move is withheld at no cost with
    its own sentence, and the description ships. Item 3 is not shown, and it
    is a finding about the real picker (the stated trade);
  - the picker answers with no scopes at all: the old path sends the move to
    the home page, since the router named none. A named-page failure, caught
    by `index.tsx`'s hash.
- **Recovery**: the free restore to `01790468089054-8btpep` (*Recovery*,
  above), then the same comparison as run 54.
- **Cost**: the estimate under *Cost* stands: about 5–6 credits, up to about
  10, against a balance of 42.
- **Kept separate**: the reply omission (review #9), and real-model mixed
  work through the removal door.

### Runs 55 and 56 — pressed with the request, but the spend box did not read `yes` (2026-09-29)

Pressed by the owner from `main` at `a64729ad`
([run 36519278886](https://github.com/canias7/isibi-app/actions/runs/36519278886),
03:55:17–03:55:52 UTC). "What to change" held the frozen sentence byte for
byte (358 bytes, sha256 `484b3feb…`), and the two expectations were set, but
the workflow computed `CANARY_SPEND: 0`: it is 1 only when the spend box reads
`yes` and the job and version boxes are empty, and those two were empty. The
box's own value is not in the log. So the run was run 54 again: every free
check passed at `a64729ad741a` and `6fbaccad82fe879d`, the bakery read as
recorded (all five routes at `8btpep`, the original stored description), and
it stopped before routing with "Nothing was charged". The balance is 42, the
ledger's last row is 334, and the only new jobs are the two refused free
checks (`cba4ba13…`, `1fb663b9…`, cost 0).

Run 56 ([36520163649](https://github.com/canias7/isibi-app/actions/runs/36520163649),
04:07:03–04:07:42 UTC) was the same: the request byte for byte, both
expectations, `CANARY_SPEND: 0`, every free check passed, nothing charged
(42, row 334), and two refused free jobs (`8f6bba24…`, `b83a0a09…`). The
spend box is a text box with `no` already in it (`default: 'no'`), and
neither the log nor GitHub's record of the run keeps what it held.
Neither run was the retry; it ran as run 57, below.

### Run 57 — the retry: both changes stored and published (2026-09-29; closed with run 58 by the owner)

Pressed by the owner from `main` at `a64729ad`
([run 36520994415](https://github.com/canias7/isibi-app/actions/runs/36520994415),
04:17:48–04:21:55 UTC; the evidence artifact `canary-evidence` is 46,077
bytes, sha256 `dcfffdb9…`) with the spend box `yes`, the frozen request,
`fold-lane-bakery` and the two expectations. The preflight read
`a64729ad741a` and `6fbaccad82fe879d`, every free check passed, the canary
reads PASSED, and its comparison is VERIFIED.
- **The path** (kept as evidence; it decides nothing):
  - the router: `look`, no page, nothing put off (14.6 s, cost 2);
  - the job (`1b7f6265…`): the picker named `description` and `shape`; the
    description lane answered 104 characters; the move went through the page
    step's quick writer on `/visit` (`tweak: true`); one publish (`publish:1`
    in the trace, 04:21:31–04:21:37 on the job row, `8btpep` → `c4usi2`,
    nothing pruned); `done`, `finalized`, cost 3;
  - the reply carries no `partial` and no held-back part. The
    `{ok: true, deferred: true}` in its `usage` is the page step handing its
    pages to that one publish (`worker.js`'s deferred-publish return), not
    held-back work.
- **Acceptance**, judged on the stored and published changes, read from the
  run's evidence against the table above. Every item holds:
  1. `request.json` carries sha256 `484b3feb…` (358 characters), and the
     router was sent the same sentence.
  2. The settings read the original before and exactly the new sentence
     after. `/` and `/starter` publish it as `description` and
     `og:description`; `/visit`, `/gallery` and `/order` keep their own; the
     titles are unchanged. Every other head tag is identical on all five
     pages apart from the script file names (`modulepreload` and the module
     script), which the build names by their content, and a page changed.
     The stylesheet link is unchanged.
  3. `visit.tsx` is byte for byte the expected swap (4,045 characters,
     `35b008fd…`). Read by their own landmarks, "Come to the bakery" (1,734
     characters, `84a1dd25…`), the band (344, `22b3ffeb…`), the part above
     (`aa5eaaab…`, holding the page's own description) and the part below
     (`1d4fa674…`) match the hashes recorded before the run, with the same
     blank line between the two sections. Served, `/visit`'s markup is the
     same two blocks swapped and nothing else, and its headings read the
     band, "Come to the bakery", then "The shutters and the street".
  4. The four other stored pages equal the table, and there is no component
     before or after. Every page's header and footer menus are identical and
     as recorded. Every link is identical in order on the four other pages,
     and `/visit` has the same 11 links, reordered with the band. Every page
     shows the same pictures at the same addresses, and each upload's name is
     the first 32 hex characters of its own sha256, so the same address is
     the same bytes. The page markup (scripts set aside) is byte-identical
     on the four other pages.
  5. Read without following at 04:24:00, 04:33:02 and 05:09:26 UTC:
     `/the-starter`, `?x=1` and the trailing slash answer 301 to `/starter`
     with `public, max-age=600`; all five routes answer 200 at `c4usi2`; the
     sitemap lists the five; `/nonexistent-page` answers 404.
  6. One publish: `01790655564541-c4usi2`, built from `8btpep`, VERIFIED, and
     seen on the first after-read.
  7. 5 credits, closing exactly: routing 2 (42 → 40), then the reserves `#1`
     1 (ledger row 335, 39) and `#2` 2 (row 336, 37), with no refund. Read
     again at 05:04 UTC: the balance is 37, there is no ledger row after 336,
     and no edit job is open anywhere. The estimate was about 5–6.
- **The review itself** (scratch, not committed): 68 checks over the
  evidence. Two failed on the first pass because of the script, not the
  site: a uniqueness test that found its own landmark, and section
  boundaries one newline wider than the plan's. Both were corrected before
  the verdict. Ten damaged copies of the evidence each fail at least one
  check: a reworded description, a dropped link, one changed character in
  `index.tsx`, a changed `og:title`, a dropped picture, a changed picture
  description, a changed heading, a changed class, a changed word inside the
  band, and a menu link dropped. The untouched copy passes all 68. The
  changed picture description went unseen at first, which is why the
  whole-markup check was added.
- **In a real Chromium**: every page, before and after, drawn the same way
  from the saved pages (GET only, reduced motion): 0 page errors, and every
  image loaded. `/`, `/starter`, `/gallery` and `/order` are identical to the
  pixel; on `/visit` only rows 56–1194, the two swapped sections, differ.
  Reduced motion, because the site fades each section in as it scrolls into
  view (`animation-timeline: view()`), which leaves a whole-page picture's
  lower band blank.
- **Inspected**: the QR file and the stylesheet are byte-identical;
  `/card.png` changed as expected (33,358 bytes, `467d9cdb…`). **A correction
  to what the session said in chat**: it called `/card.png` the picture a
  link preview shows. The fixture table above had it right: `siteOgImage`
  takes the owner's chosen share picture, then the owner's first own upload,
  and the composed card only as the floor, and every page's `og:image` is
  the logo upload (`2cc633d7…`), unchanged. What a preview takes from this
  change is the `og:description` line on `/` and `/starter`.
- **The reply, kept separate**: "✅ Updated the look — the description." It
  is true of what it says and does not mention the Visit move: the known
  omission (review #9), now seen live.
- **What run 57 does not show**: mixed work through the removal door with a
  real model (outstanding under item 3); component preservation (the fixture
  has no component, `0 → 0`, and the canary says so); and the fix's
  withholding paths (nothing was put off or withheld), which stay shown only
  with supplied answers.
- **Status**: both requested changes are shown in the stored and published
  site, with a real router and picker on deploy 2166. The owner, 2026-09-29:
  *"Keep Test 6 pending my review until the evidence and restoration are
  complete."* The free restore to `8btpep` (press 3) is run 58, below.

### Run 58 — the free restore put everything back (2026-09-29)

Pressed by the owner from `main` at `a64729ad` with the values in press 3
([run 36526545037](https://github.com/canias7/isibi-app/actions/runs/36526545037),
05:31:08–05:31:54 UTC; the evidence artifact is 23,960 bytes, sha256
`082313b9…`). The preflight read `a64729ad741a` and `6fbaccad82fe879d`, and
every free check passed.
- **The restore**: the site listed 13 versions with run 57's
  `01790655564541-c4usi2` live; the app's own restore of `8btpep` (row 5)
  answered 200 (24 files, `worker: true`), and the site reported `8btpep` on
  the first read.
- **Stored**: the five pages equal the table, sha256 for sha256, with no
  component, and the stored description reads the original again (the second
  time that is observed, after run 53).
- **Published**, read live at 05:33:41 UTC (public GETs, redirects not
  followed):
  - all five routes answer 200 at `8btpep`;
  - every page's head tags, script names included, and its page markup are
    identical to run 57's `8btpep` before-read. So `/` and `/starter` show
    the original description again, the other three keep their own, and the
    menus and links are as before. Run 58's own saved pages equal the same
    before-read;
  - `/the-starter`, `?x=1` and the trailing slash answer 301 to `/starter`
    with `public, max-age=600`; `/nonexistent-page` answers 404; the sitemap
    lists the five;
  - the QR file and the stylesheet carry their recorded sha256s, `/card.png`
    is `ce884f5b…` again (31,778 bytes), and every photo's bytes match its
    name.
- **In a real Chromium**, the live pages drawn as run 57's were (GET only,
  reduced motion): all five are identical to the pixel to the `8btpep`
  before-read, every image loaded, and there are 0 page errors. Each page
  logs three console errors: the three `POST /cdn-cgi/rum` requests of
  Cloudflare's analytics beacon, which the browser wall refuses as it
  refuses every non-GET. The pages the canary saves do not carry the beacon,
  and every earlier live read (2026-09-28 20:00, after run 52, after run 57)
  shows the same three.
- **Money**: nothing charged. The balance is 37 (unchanged since 04:19:23),
  the ledger's last row is still 336, and the only new jobs are the two
  refused free checks (`f09044fb…`, `e6d2c784…`, cost 0, billing `none`); no
  job is open.

**Test 6's evidence and restoration are complete.**

**Closed by the owner (2026-09-29)**: *"Close Test 6 for exactly what runs 57
and 58 demonstrated: the site-wide description and Visit-only move both stored
and published, unrelated content preserved, existing redirects retained, and
the original version restored without charge. Keep the reply omission and
untested withholding paths separate. Do not repeat this acceptance."*
What is closed is exactly that. The reply omission (review #9) and the fix's
withholding paths (a part put off, a scope that fails its check), which are
shown only with supplied answers, are kept separate, and component
preservation is untested here (the fixture has none).

### A visible alternative, not recommended

"Make the main heading on every page dark green (#1f4d2b)", through the
stylesheet lane. Each reason below was read in the code, not driven live:
- it would be the first live stylesheet edit since the owner closed the
  stylesheet work;
- its reply would add "The stylesheet sets none of the kit's own colour
  variables, so the site renders on the default palette.";
- the render check judges each selector of a list on its own, over pages
  rendered with empty data. So a rule naming heading levels the site doesn't
  use (`h3`–`h6` here) is judged dead and forces a correction round.

### Found while preparing, recorded separately

Neither is part of this test.
- **The header's button loses the kit's `data-slot="button"` marker on every
  page**, because `SiteLink` passes on only `href`, `className` and children.
  So a stylesheet rule written against the kit's own button hook never reaches
  the header's button.
- **The per-selector dead check**, above.

## The short checklist (2026-09-27, after D1 and the rules test)

**D1 is closed by the owner** after an independent review of run 42:
- exactly one price changed, on both readers;
- the browser showed £4.60;
- the conditional put-back restored £4.50;
- the page and component source was unchanged;
- it cost 3 credits.

The reply's generic wording ("✅ Updated one entry in loaves." names the table,
not the change) is kept for the later model-written-replies work and is not
reopened.

**The rules test passed its paid run** (run 44, the owner's press, 2026-09-27;
*press 3 read*, near the end of *the rules test, built*):
- one message closed `lido-axes-b`'s `bookings` table (the rules rung marked it
  closed);
- one real visitor booking afterwards, through the site's own form, was refused
  at the privilege check (403 `42501`), and no row was added;
- nothing was published, and the pages, the stylesheet, the stored source and
  the menu stayed the same;
- it cost 3 credits (routing 2 + the rules rung 1), matching the ledger.

The permissions read after it (press 4, `grants preview` run `36339825502`)
agrees: visitors hold nothing on `bookings`, and the menu's permissions are
unchanged. So every pass item holds. A booking that went through before the
edit was never measured. The site's bookings stay closed, and its pages still
show "Book a table".

**The rules acceptance is closed by the owner** (2026-09-27: *"Run 44 and the
after-permissions preview check out. Close the scoped rules acceptance"*). It
is closed for exactly what it showed:
- the booking permissions were removed;
- a real visitor submission was rejected;
- no row was added;
- the menu's permissions were unchanged;
- the stored pages and components were unchanged.

**The evidence boundary stays explicit.** No successful booking was measured
before the edit, so this proves this closure request, not every rules
operation (item 2 of the second list below stays open). Bookings stay closed.

**A separate UX gap, recorded and not part of this milestone** (the owner:
*"don't expand this milestone to fix it"*):
- after the closing, the pages still invite bookings ("Book a table" in the
  header and hero, and the `/book` form);
- a visitor who fills the form in is told only "That isn't available.", not
  that the café is fully booked.

Whether a closing message should also change the pages, and what the refusal
should say, is the owner's call.

Each list puts the material gaps first. The evidence is in the sections below,
and nothing in the first list is to be rerun.

**Demonstrated live**
- **The page rung.**
  - The quick writer: runs 9, 17 and 32.
  - The full writer: runs 11, 21, 24, 26, 34 and 37.
  - A component's wording and calculation: runs 21, 24 and 26.
  - The text guard and the judge letting a correct removal through: run 34.
  - A photographed page keeping both photographs, with the kit-heading fix:
    run 37.
- **A logo from an attachment, a picture reframe and a page move** (run 39),
  each published through the queue. The logo and the move were free.
- **One database row changed through the app and put back** (run 42, D1).
- **A rules change through the app, enforced by the database** (run 44):
  `bookings` closed on `lido-axes-b`, then a real visitor booking refused at
  the privilege check with no row added. Closed by the owner for this closure
  request only.
- **Second messages from one tab** after a finished job (run 39).
- **The machinery around every edit**, shown on every canary run and on
  recent deploys in runs 32–42:
  - the queue and billing;
  - the reply on screen;
  - the after-read at the job's own version;
  - the money closing exactly.

  Restoring a saved version is shown too (runs 20 and 22).
- **Older code, counted as path coverage only**: the look lanes, the menu, the
  site address and the text rung (2026-09-01 to 09-07).

**Tested only with supplied model output** (the route and the browser are
proven; a real model is not)
1. **A page removal** (`edit-page-verb`, `removal-door`). It has never
   published live. It makes no model call and the free restore undoes it.
   **But one message alone is refused on the existing multi-page sites**,
   because every page but the home page is linked from another page, so the
   prepared test (Test 5, next section) takes the menu link out first. Its
   paid run (run 47) sent the menu message to the wrong part of the editor
   and changed nothing. The owner held the correction's first two versions
   (2026-09-28): the first also dropped work asked for beside a removal, and
   the second read the request from how many lanes the picker named. The
   third is built on the branch at `d6f564a5`, not merged: the picker is told
   what the router already routed and names any other work in a list of its
   own. The removal is proven through the real route with supplied answers
   only.
2. **The rules rung beyond one closing**: reopening, the other way of closing
   (taking write access away), limits and the other rules, and any other
   wording or site. Run 44 closed one table once.
3. **A protection refusing a real model's answer.** The photograph wall, the
   link and component judge and the text guard have only been seen letting a
   correct answer through (runs 34 and 37). The same holds for reply
   validation, and for the failure classification (a refusal never buys the
   full rewrite), which live has met only run 31's credit refusal.
4. **A named page other than the home page** on a look edit
   (`edit-page-target`). Live only on `/`.
5. **The data rung beyond one row**: adding, removing and reordering rows, and a
   site whose database link is blank.
6. **Two changes in one message** (`edit-page-once`, `edit-page-verb`), and a
   second message after a hop or a failure (`edit-lock`,
   `edit-result-display`, `edit-failure-paths`).
7. **The picture swap** (a new photograph into a slot).
8. **The stylesheet scope and the rule keys** (deploy 2161, with a real-browser
   control in the site build). The owner closed it without a live css-lane run.

**Still untested** (no live run, and no test drives it end to end)
1. **An older site's first schema change, through a real form.** A site built
   before 2026-09-13 gets column-scoped write grants on its next schema change.
   That is proven only on a local PostgreSQL, and D2 and D3 are parked. Run 44
   made that first change on `lido-axes-b`, but it closed the only writable
   table, so the new write grants are not exercised. Reopening (item F) would
   exercise them, with one real booking that is then deleted.
2. **What a real model decided, where nothing records it**: why a quick attempt
   did not publish, the writer's prompt, and the judge's and the text guard's
   verdicts. So far these are inferred from what published.
3. **Outside this checklist, listed so they are not lost**: the add-on through
   the browser since deploy 2154 (the last live add-on was run 53), and the
   photo add-on kind, which waits on fal funding.

Deferred by the owner and not counted: hydration (#418), translation,
model-written replies, and drafts surviving a refresh.

**The rules test on `lido-axes-b`, a candidate site: its paid run passed
(run 44, 2026-09-27)** (revised 2026-09-27 on the owner's two corrections). It is the owner's
kept stylesheet-comparison site, not a disposable one: "spent" in its workflow
means only that its name is taken.
- One message, "We're fully booked, so stop taking bookings on the website for
  now.", should close that site's `bookings` table to visitors.
- Then one real visitor booking goes through the page's own form. It must be
  refused at the privilege check, with no row added.
- The pages, the stylesheet, the stored source and the menu are checked
  unchanged. Its database changes for good, so leaving bookings closed needs
  the owner's approval.
- The baseline, whether a booking goes through today, is not measured.
- It costs about 3 credits. The harness is built on the branch (`ebf53761`,
  scenario `4b-rules-close`), and since `717bb5b2` its booking is decided
  before it leaves the browser (*the booking gate*, closed by the owner after
  review). Both free checks pass: `grants preview` (run `36309691339`) read
  the starting permissions the test was written for, and the free rehearsal
  (`edit canary` run 43, `36333244182`) stopped exactly the marker booking in
  the browser and changed nothing.
- **The owner's paid press, run 44 (`36337146911`), passed every check it
  makes**: routed to `rules`, the rung marked `bookings` closed, and the one
  real booking afterwards was refused at the privilege check with no row
  added, for 3 credits. **Press 4, the permissions read after it (`grants
  preview` run `36339825502`), agrees**, so every pass item holds. Its
  bookings stay closed, as the owner approved by pressing it.
- **Closed by the owner (2026-09-27)** for this closure request, with no
  successful booking measured before the edit (above).

The scope, the checks, the cleanup, the notification account and the approval
items are in *the rules rung — the recommended next test, revised*, after
Test 4, and the built harness, its evidence and the exact presses are in *the
rules test, built* at the end of that section.

## Test 5 — a page removal and its restoration (prepared 2026-09-27; both free checks passed as runs 45 and 46; the paid press, run 47, stopped at its first message and changed nothing: a product finding, reproduced free; the owner approved a correction and held its first two versions — the first dropped work asked for beside a removal, the second read the request from how many lanes the picker named — and the third, which tells the picker what was routed and asks for other work by name, is merged and deployed in deploy 2164; the paid retry, run 49, removed the menu link and the page as asked (closed by the owner) and its redirect check failed on a publish defect, fixed at `2cf8461c` and merged and deployed at `f5e941f4` in deploy 2165; the free restore, run 50, put `8btpep` back; the removal and the restoration closed by the owner, 2026-09-28)

The owner: *"Prepare one bounded page-removal-and-restoration test using an
existing suitable fixture and the existing workflow. Capture the saved version
and complete source inventory before spending. Check the removed route,
navigation, unrelated pages/components, customer reply, and successful
restoration. First reconcile this against the existing acceptance checklist so
we don't repeat a closed test."*

### Reconciled against the checklist

It repeats nothing that is closed:
- **A page removal has never published through the queue** (the job census).
  Run 39 moved a page, which is a different verb; runs 34 and 37 removed
  sections, not pages.
- **Restoring a saved version has run live only on fretwork-1** (runs 20 and
  22). Restoring a removed page has never been done live.
- **The menu rung has not run on today's code.** The census lists two menu
  jobs, both from 2026-09-02, on older code.

### What the free preparation found

1. **A removal on its own is refused on every existing multi-page site.**
   - The removal refuses a page that another page's source still names
     (`mergeAddonPages`), and a generated site keeps a copy of its menu in
     every page file.
   - A survey of the building account's sites, read live (each sitemap and
     each page's links): 40 of the 42 asked answered, and 17 have more than one
     page. On those 17, every page but the home page is linked from at least
     one other page. The only exceptions are the `/deal` pages of two older CRM
     sites (northgroup-3 and northgroup-9), and their source was not read; a
     link drawn from data does not show in the page as served.
   - So on the bakery, "Remove the gallery page." alone answers, in the
     rehearsal: *"⚠️ I left /gallery — / still links to it. Ask me to take
     the link out first. Nothing on your site changed, and this edit cost you
     nothing. Reading your message cost 2 credits."* That holds on both money
     paths, through the page layer and through the look door.
   - **The refusal's stated reason has expired, and this is recorded, not
     changed.** The code comment says a link to a missing page "does not
     compile". Since 2026-08-30 a type error no longer stops a build, and a
     menu entry's `href` is a plain string that was never type-checked. What
     the refusal still prevents is a menu link that leads nowhere.
2. **So the test is two messages: the menu first, then the page.**
3. **The menu rung never lists the home page on the home page**, and the
   bakery's home page lists itself ("Today's bake → /").
   - So taking Gallery out of the menu also takes "Today's bake" out of the
     home page's own menu. That is a visible change nobody asked for.
   - The rung also rewrites every page's menu onto one line, which changes no
     visible item.
   - This was recorded as a finding and not changed. **It is fixed on the
     branch (2026-09-28, not merged)**, because the owner's acceptance for the
     corrected run is that the menu edit removes only the Gallery link: a home
     page keeps its link to itself when it already has one, and still never
     gains one.

### The test

- **Fixture: fold-lane-bakery.** All five routes serve
  `01790468089054-8btpep` (read live, 20:39Z), and the gallery page is named
  only by the home page's menu.
- **The two messages, exactly:**
  1. "Take Gallery out of the menu."
  2. "Remove the gallery page."

  These are the router's own examples: "take Pricing out of the menu" is the
  menu layer, and "Remove the gallery page" is the page layer with `remove`.
- **The workflow**: the existing edit canary's UI mode, with a new scenario,
  `5-page-remove`, on the branch. It sends both messages from one tab of the
  real app.
- **Each message has its own wall.** The first may leave the app only as a menu
  edit and the second only as a page edit; anything else is aborted in the
  browser, so a misrouted message costs its routing call and changes nothing.
  The budget is 8 credits, checked before each Send.
- **Before anything is spent**, the canary's free checks and its before-read
  run first: the saved version on every route and every page body.

### Expected results

These come from the free rehearsal, through the real edit route on the
bakery's stored pages, with the menu answer supplied. A real model may choose a
different list.

- **Message 1 (the menu):**
  - routed to the `nav` layer;
  - one job, finalized, about 1 credit;
  - it publishes a version built from `8btpep`;
  - the reply: "✅ Updated the menu on 4 pages: Today's bake · The starter ·
    Visit.";
  - every page's menu becomes "Today's bake · The starter · Visit", the home
    page's included (with the home-link fix; before it, the home page's menu
    became "The starter · Visit");
  - the starter page (a stub with no menu) is untouched.

  The expected bodies, if the model returns that list (re-computed 2026-09-28
  on the fixed menu rung, through the real edit route and by the rung's own
  writer, which agree):

  | page | before (chars, sha256) | after message 1 |
  | --- | --- | --- |
  | `index.tsx` | 2,439 `51b5af6af6ee25ca` | 2,378 `637b779375472391` (was 2,340 `d409219c9516b920` before the home-link fix) |
  | `order.tsx` | 9,258 `4ead778eea41faaf` | 9,241 `0a0b5f41877a3b25` |
  | `visit.tsx` | 4,045 `bdb02abecad96c56` | 4,028 `ddd1fe39e6d3d932` |
  | `gallery.tsx` | 3,007 `4e8b82aa901741e0` | 2,946 `da53a37595977e4b` |
  | `starter.tsx` | 951 `37fb0e176f22a44b` | unchanged |

- **Message 2 (the removal):**
  - routed to the `page` layer, page `/gallery`, `remove`;
  - one job, `exempt`, cost 0, no ledger row (the removal makes no model
    call);
  - it publishes a version built from message 1's;
  - the reply: "✅ Took /gallery off the site. Every publish is kept, so say
    the word if you want it back.";
  - `gallery.tsx` is gone, and the four other pages are byte-identical to
    after message 1.
- **The site afterwards:**
  - `/gallery` answers **301 to `/`**, because a route that existed in the
    last publish and is gone redirects home;
  - the sitemap lists four pages;
  - no page links to `/gallery`;
  - `/the-starter` still answers 301 to `/starter`;
  - the other pages' words, headings and photographs are unchanged apart from
    the menus.
- **Components:** the bakery stores none, so "components unchanged" is 0 → 0
  and says nothing here.
- **The chain:** `8btpep` → the menu's version → the removal's version,
  VERIFIED, with every page read at the last one.
- **Money:** routing 1–2 for each message, the menu about 1, and the removal 0,
  so about 3–5 credits. That is an estimate, not a cap. The balance is 53
  (read 20:40Z, the newest ledger row still run 44's).

### Recovery: the restore mode, free

- Press the existing restore mode with `restore_version`
  `01790468089054-8btpep`.
- It lists the site's versions and refuses a target that is not listed or not
  restorable. Then it posts the app's own restore call, waits until the site
  itself reports that version, and only then reads the site.
- **Pass**: every route serves `8btpep`, every page body is byte-identical to
  the before-read (the five hashes above), `/gallery` answers 200 again, the
  sitemap lists five pages, and the menus are as before.
- **`/gallery` is read without following redirects.** The canary's page reader
  follows a 301, so a redirect to the home page would still read as a page at
  `8btpep`; only the status says which it is.
- **Why the redirect should go**: the list of routes and redirects lives in the
  site's meta file, and a restore writes back that version's own copy of it
  (`restoreVersion` activates the build with its own sidecar), so `8btpep`'s
  list, with `/gallery` and without the new redirect, comes back. Read in the
  code, not yet seen live.
- Nothing else needs undoing: the test writes no database row, no design
  setting and no upload.
- `8btpep` stays restorable: the newest 10 versions are kept, plus the live
  one and its parent, and after the test it is the third newest.

### What each outcome would mean

- **Message 1 routed anywhere but `nav`** (runs 34 and 37 show the router can
  answer `look` for a page-shaped request): the wall stops its edit request in
  the browser, the run fails on "nothing outside the scenario was started",
  and it costs the routing call. Message 2 is still sent and should be refused
  ("I left /gallery — / still links to it"), at no edit cost. A routing
  finding, not a product defect.
- **Message 1 publishes but a page still names `/gallery`** (the model's list
  kept it, or it answered no change): message 2 is refused the same way. The
  refusal is then seen live, and the finding is about the menu answer.
- **Message 1 changes a page beyond its menu**: the menu tool can also rewrite
  the header button, links in the copy, the footer's contact details and lists
  and the header layout, but only the parts the model's answer names, and a
  correct answer to this message names only the menu. Anything more is the
  model over-answering, a finding about the real model, and the restore undoes
  it. A different but sensible menu list only changes the expected hashes, and
  is inspected, not failed.
- **Message 2 routed anywhere but `page`**: the wall stops it; the site keeps
  message 1's menu change until the restore.
- **Message 2 changes a page other than removing `gallery.tsx`**: the top
  finding of the test.
- **`/gallery` answers 404 rather than 301 after the removal**: the redirect
  rule did not run for a removal; a finding.
- **The restore leaves `/gallery` redirecting, or not listed**: the restore did
  not put the version's meta file back; a restore finding, and the site is left
  with a redirect until it is fixed.

### The presses

- **Free, first**:
  1. The restore mode pointed at the live version, `8btpep`, from `main`. It
     posts nothing, and it proves the recovery target is listed and
     restorable.
  2. The UI rehearsal of `5-page-remove` with spend `no`, from the branch. It
     types message 1 and stops.
- **Paid, after approval**: `5-page-remove` with spend `yes`, from the branch.
- **Free, straight after it**: the restore mode to `8btpep`.
- **Read again before handing them over (20:47Z)**: all five routes answered
  200 at `8btpep`, `/the-starter` 301 to `/starter`, an unknown address 404,
  and the sitemap five pages; the balance 53, the newest ledger row still run
  44's, no edit job since 18:30Z and none unfinished.
- **The session's one attempt at press 1 (20:48Z) answered 403** ("Resource
  not accessible by integration") and was not retried, so all four presses are
  the owner's.
- **Press 1 ran as run 45 and passed** (36355204326, the owner's, from `main`
  at `14df0225`, 22:24:56–22:25:47Z; nothing spent):
  - the preflight read `14df0225be90` / `9038e90ab1d5d7fe`, both readers
    agreeing, async and runner true;
  - the site lists 9 versions; row 1 is `8btpep` (parent `pi9qwd`, the page
    move's job), marked restorable;
  - it printed `RESTORED — the site already reported
    01790468089054-8btpep, so nothing was posted` (`why: already-live`,
    `posted: null`);
  - the source read was complete, and every route answered at `8btpep`;
  - all five stored bodies are byte-identical to the recorded before column,
    compared by full sha256. The control against the expected after-menu
    column differs on exactly the four files message 1 changes, and against
    the after-removal column it also finds the gallery extra;
  - the balance was 53.
- **Press 2 ran as run 46 and passed** (36356315217, from the branch at
  `539dce9a`, 22:44:14–22:45:10Z; nothing spent):
  - the same preflight and the same five bodies;
  - the app opened signed in and loaded the page list (`GET
    /api/site/routes?slug=fold-lane-bakery` 200; three GETs in all, nothing
    blocked);
  - it typed "Take Gallery out of the menu." and did not send it;
  - 0 console or page errors, and the balance 53 → 53.
- **Read-only after both (22:47Z)**: each run's two zero-cost confirmation
  jobs are `failed`/`none`/0, unpublished, and the newest ledger row is still
  run 44's reserve (id 332). The paid press is next.
- **⚠ A slip in the session's own check, caught before it was reported.** The
  first body comparison read a key the record does not have (`sha` against
  the stored `sha256`), so every file compared a blank with a blank and read
  identical. It was redone with the full hashes (both asserted 64 characters)
  and with the controls above, which must differ. That is the recorded "a
  negative assertion must prove its observer is alive" trap, met in a one-off
  script.
- **Press 3, the paid run, ran as run 47 and stopped at message 1**
  (36357524151, the owner's, from the branch at `5bad91f2`,
  23:05:43–23:09:25Z). It spent 3 credits on the two routing calls and changed
  nothing on the site. The next section has the finding.
- **Press 4, the restore, is not needed**: nothing published, so `8btpep` is
  still live on every route.

### Run 47: the menu message went to the wrong part of the editor

- **Before anything was spent**, the run matched runs 45 and 46:
  - the preflight read `14df0225be90` / `9038e90ab1d5d7fe`, both readers
    agreeing;
  - the source read was complete, every route was at `8btpep`, and all five
    bodies equal the before column;
  - the balance was 53.
- **Message 1, "Take Gallery out of the menu."**
  - The router answered `intent=edit layer=nav remove=true`, cost 2 (`6,771
    in / 23 out`). That is what its own instructions say: the `remove` field
    says, for layer `nav`, "true when a menu item … should GO", with "take
    Pricing out of the menu" as its example.
  - The app posted one edit at `nav` with `remove: true` (job `5b03bc99…`).
    The wall let it through, because it is a menu edit.
  - In the edit route, `nav` with `remove` opens the part-picker door
    (`DOOR_LAYERS` is `picture` and `nav`). The stored trace shows the picker
    answered `fields: ["behavior"]` after 83.9 seconds.
  - **No lane describes the items in the menu.** `action` says "only that
    button". The one lane whose description mentions a menu is `behavior`
    ("what something on the page DOES when someone uses it — … a menu …").
  - `behavior` is a look lane, so a look step ran it. Its model call answered
    nothing (`answered: false`, 0 characters), and the route answered
    `look/no-change`: 422, cost 0.
  - **The menu rung never ran.** When the picker names any lane, the router's
    own step is not added. It is put back only when the picker names nothing.
  - The screen: "⚠️ I couldn't work out how to change the site's look that
    way. Say which part — a colour, the fonts, a section — and what it should
    look like. Nothing on your site changed, and this edit cost you nothing.
    Reading your message cost 2 credits." Every clause is true of what
    happened, but it answers a question about the look that the customer never
    asked.
  - The job is `failed` / `none` / 0 and unpublished; the message took 111
    seconds.
- **Message 2, "Remove the gallery page."**
  - Routed `page page=/gallery remove=true`, cost 1 (7,168 cached / 113 fresh
    tokens); job `462b1887…`.
  - Refused `kept`, 422: "⚠️ I left /gallery — / still links to it. Ask me to
    take the link out first. Nothing on your site changed, and this edit cost
    you nothing. Reading your message cost 1 credit."
  - That is the refusal the outcome list predicted when message 1 leaves the
    link, and it is the link rule's first live answer; it had only been
    rehearsed.
- **Nothing changed**:
  - no version was published, and the chain reads VERIFIED at `8btpep`;
  - the stored bodies before and after are byte-identical to the before column
    (full sha256; the two after columns differ, as the controls must);
  - the route pages are identical once render times are masked;
  - read live at 23:09Z, every route answered 200 at `8btpep`, `/gallery`
    included.
- **Money: 53 → 50 = routing 2 + 1.** Both edits are `billing: none`, cost 0.
  There is no ledger row newer than run 44's reserve (id 332), because a
  routing charge writes none. Nothing is running.
- The two console errors are the browser's own "Failed to load resource … 422"
  for the two refusals' final polls. There were 0 page errors and nothing was
  blocked.
- **Reproduced free, exactly.** A scratch test drove the real `POST
  /api/site/<slug>/edit` on the bakery's stored pages, on both money paths,
  with every answer supplied:
  - `{layer: nav, remove: true}`, with the picker answering `behavior` and the
    lane answering nothing, gives the same 422;
  - through the browser's own composer it gives the same screen, word for word;
  - the models called are `pick_lanes` and `edit_site`, never `write_nav`, and
    nothing compiles.
- **The controls** (same test):
  - the picker naming nothing: the menu rung runs and the menu changes, for 3
    credits;
  - the picker naming `action`: the same;
  - `nav` without `remove`: the menu rung runs directly, for 2 credits.
- **⚠ The rehearsal supplied the wrong router answer, and that is the
  session's miss.** Test 5's free rehearsal posted this message as
  `{layer: "nav"}` without `remove`, although the router's instructions set
  `remove: true` for exactly this wording. So the rehearsal proved a path the
  live run never took. A supplied router answer has to be the one the router
  is told to give for that wording.
- **What it establishes**:
  - the router routes this sentence as instructed;
  - a menu-item removal meets the part-picker door, which has no lane for menu
    items;
  - when the picker names an unrelated lane, the menu rung never runs;
  - the page removal's link rule refuses live.

  It does not establish a page removal, the redirect or the restore; none of
  them ran.
- **The correction was proposed for the owner's approval, and approved on
  2026-09-28.** Its first version was held by the owner the same day, and the
  corrected version is built on the branch with its tests and is not merged:
  the next section.

### The correction, built (2026-09-28): the first version at `a9fc516a` and the second at `50b97183`, each held by the owner; the current route at `d6f564a5`, not merged

The owner, approving it: *"For a removal entering through nav or picture,
prevent the secondary lane selector from diverting it into an unrelated
editor. Preserve compatible selections and the existing fallback to the
router's original editor. Keep ordinary look requests and genuine removal
refusals unchanged."* And: *"receiving two replies is not page-removal
success. Stop before the dependent paid message if the menu edit fails, and
report the scenario as unsuccessful. Preserve the evidence."* Focused tests
and required CI only; no merge, deploy or paid run.

**The owner held the first version** (same day): *"Hold the merge: the
blanket doorLanes filter regresses genuine multi-part requests. Your new test
explicitly accepts dropping “move the opening hours up” from a photo-removal
request. The changed edit-page-verb test also previously required the layout
edit to succeed when the photo step refused; it now accepts losing that work.
My earlier instruction to constrain every secondary selection was too broad.
Correct the mechanism so the original nav/picture operation cannot be
displaced, while independently requested work remains executable. Preserve
per-step removal semantics: removing a photo must never make a layout step
delete its page."* With four demonstrations through the route (listed under
*the evidence*), keeping the home-link fix and the new harness checks, and
*"Do not redefine the older mixed-request success as an acceptable
refusal."*

- **The first version** (`a9fc516a`, `doorLanes`) kept only the picked lanes
  that lead back to the router's editor and dropped the rest. That fixed run
  47, and it also dropped a layout change asked for beside a photo removal.
  It is withdrawn. Its two stated "consequences" (this section at
  `417dcb83`) described that loss as acceptable; the owner did not accept
  them.

**The owner held the second version too** (same day): *"Hold the merge. The
blanket filter is gone, but doorAnswer still infers request identity from
fields.length. That leaves the mixed-request regression open. Independent
reproduction: keep your existing photo-removal-plus-layout request and change
the supplied picker fields from ["images","shape"] to ["shape"]. The layout
writer never runs. Both sync and queued cases fail; when the photo step
refuses, the valid layout work is lost too. The router already supplies the
photo operation. One additional selected lane can therefore represent a second
requested change. Conversely, two selected lanes do not prove two independent
requests. Replace the lane-count assumption with an explicit distinction
between the already-routed operation and additional requested work. Give the
selector that context and preserve the association through planning. Keep the
router's operation once, retain genuinely additional work, and keep removal
verbs scoped to their own operations. No keyword or fixture-specific rules."*
With both answers covered for the same request, run 47, the ordinary
single-operation controls and the partial success kept, and *"Check the
selector's actual input/tool contract as well as supplied answers."*

- **The second version** (`50b97183`, `doorAnswer`) always ran the router's
  own step, set a single picked lane on another editor aside as "the picker's
  reading of the one thing asked", and ran two or more picked lanes as
  separate requests: a guess about what was asked, made from how many lanes
  came back. **Reproduced on `1e0c3e34` through the route, on both money
  paths**: with `["shape"]` alone the page writer never ran; with the photo
  refused the reply was 422 and the layout was lost with it. It is withdrawn.

**Three changes.**
1. **The route** (`worker.js`; `pickLanes`, `doorDispatch` and the door's own
   tool in `builder/site-lanes.mjs`; `layerLine` in `builder/site-ask.mjs`).
   When the router opened the lane door for its own removal (`nav` or
   `picture` with `remove`):
   - **The picker is told what was already routed.** Above the customer's
     message it reads the routed change in the router's own words for that
     layer: `layerLine` reads the line the router's own `layer` description
     opens that layer with, so the two cannot drift apart. The system text
     says that change is being made whatever it answers.
   - **It answers two lists.** `additional` is anything else the message asks
     to change, and its description says an empty list is the ordinary
     answer. `routed` says which part of the site the routed change is about.
     Only `additional` becomes steps; `routed` is recorded and never run.
     `removes` and the page verb apply only to `additional`. The door's tool
     has no `fields` property at all, so an answer in the ordinary tool's
     shape, like run 47's recorded `fields: ["behavior"]`, names no work.
   - **The routed change's own lane**, when the picker lists it under
     `additional`, is that change: its editor is the router's editor and reads
     the whole sentence, so a second step there would be one operation twice.
   - **The router's own step runs exactly once**, with its verbs, where its
     lane would run in the picker's order (`doorDispatch`, unchanged from the
     second version).
   - **Nothing is inferred from how many lanes either list holds.**
   - The edit's trace records both lists (`door:answer`), in place of
     `door:set-aside`.
   - **The look door is untouched**: its picker request was captured before
     and after the change and is byte-identical.
2. **The menu editor** (`applyNav` in `builder/site-nav.mjs`), unchanged from
   the first version. A home page's menu keeps its link to the home page when
   it already has one; it still never gains one, and asking for that item to
   go still takes it off. This is decided per menu. It is part of this change
   because the owner's check is that the menu edit removes only the Gallery
   link: without it, the bakery's home page also loses "Today's bake" (item 3
   of *what the free preparation found*).
3. **The canary** (`scripts/canary-ui.mjs`, `scripts/canary-remove.mjs`,
   `scripts/edit-canary.mjs`), unchanged from the first version.
   - **Message 2 now depends on message 1.** It is sent only when message 1's
     job stored a success at the menu layer (`ok: true`, `layer: "nav"`).
     Anything else (no reply, no stored reply read, a refusal, a success at
     another layer) stops the run before message 2 is typed, so its routing
     call is never paid. The run fails and says why, and the evidence is
     uploaded as before (the upload step runs whatever the result).
   - **The scenario passes only on what its operations did**, nine checks:
     message 1's job stored a menu success whose menu has no link to
     `/gallery`; message 2's job stored a success that removed exactly
     `gallery.tsx`; both published, in order, and the after-read saw the last
     version; both source reads are complete; the stored source lost
     `gallery.tsx` and no other page; the components are byte for byte what
     they were; every other page changed only in its menu, which lost exactly
     the Gallery link; no other page links to `/gallery`; and `/gallery`,
     read without following redirects, is a 301 to the site's home page.
   - **Run 47 printed "UI MODE PASSED: 2 messages sent"** and its job was
     green, because both messages got a reply and the composer came back. Its
     own record fails 7 of the 9 checks, which a unit case drives.

**The evidence.** Every model answer is supplied.
- **Through the real edit route** (`test/edit-removal-door.test.mjs`, 41
  cases, up from 27, on run 47's own stored pages, their hashes asserted),
  with the router's actual request shapes, on both money paths where money
  moves. **Every door case also checks the request the picker actually
  received**: its tool (the two lists, `additional` required), the system
  text, the routed change in the router's words, and the customer's message
  last. The owner's list:
  1. **The same photo-removal-plus-layout request with both answers**: "Take
     the photo of the cooling loaf off the home page and put the order band
     above the starter story.", routed `picture` with `remove`, answered
     `{routed: ["images"], additional: ["shape"]}`, `{additional: ["images",
     "shape"], removes: ["images"]}`, and `{additional: ["shape"]}`. Each
     time the page writer runs first and then the picture editor takes the one
     photograph off; one compile; the stored home page is exactly the moved
     layout with that photograph's `src` emptied; the other four pages are
     byte for byte what they were; nothing is reported removed or moved. The
     screen: "✅ Updated the look. One photograph is no longer on the site. If
     that was not what you wanted, say “put the photo back”. There is a space
     for a photo — upload yours in the Data panel and it’ll fill in." Cost 5
     (3 + 2).
  2. **Run 47**, answered `{routed: ["behavior"], additional: []}` and with run
     47's own recorded answer `{fields: ["behavior"]}`: after the picker only
     the menu editor runs, only the Gallery link leaves every page's menu, the
     gallery page stays, and the screen says "✅ Updated the menu on 4 pages:
     Today's bake · The starter · Visit." Cost 3. **Then "Remove the gallery
     page."** removes `gallery.tsx` alone, with no model call and for nothing
     (queued: `exempt`).
  3. **Partial success when the photo removal fails**: the same request where
     the picture editor finds no such photograph, answered `{additional:
     ["shape"]}` and `{routed: ["images"], additional: ["shape"]}`. The layout
     ships exactly, and the screen says "✅ Updated /. ⚠️ I couldn't match that
     to any of the pictures on your site. That part still cost 2 credits."
     Cost 5.
  4. **Ordinary single-operation controls**: on either door an empty
     `additional` runs only the routed change, whether `routed` names the
     router's own lane, another lane or nothing; a page deletion or a database
     removal tied to the routed change deletes and refuses nothing; `nav`
     without `remove` never asks the picker; the look door's request and its
     refusal of a database removal are unchanged; a page another page still
     links to is still refused.
- **The menu message with other work beside it**, both money paths: "Take
  Gallery out of the menu and put the order band above the starter story.",
  answered with `behavior` tied to the routed change and `shape` as work, with
  `action` tied, and with `shape` alone. Each time the menu change and the
  layout both ship, nothing else runs, the screen says "✅ Updated the look.",
  and it costs 5.
- **The selector's contract, driven directly**: the door tool for every layer
  the router can open the door from (its properties, `required`, list types,
  enums and descriptions); the exact message and system text; the look
  request byte-identical for every value that is not a door removal (none, no
  `remove`, `remove` as a string, the look, page and logo layers, a list, a
  string); and 17 door answers read through `pickLanes`, including the lane
  cap.
- `edit-page-verb`'s one door case now supplies its answer in the door's shape
  (`{routed: ["images"], additional: ["shape"]}`); every outcome assertion is
  unchanged. `removal-door`'s census is re-anchored to the five places the
  route reads the door, and to the routed change sitting inside the picker
  call.
- **Red checks, re-run in throwaway worktrees.**
  - As written, the three test files fail the same **34 of 86** on the held
    second version and on main (with the kept menu-editor fix carried in).
    Every one fails first on the new contract, so the written tests alone
    cannot tell the two bases apart.
  - **Behaviour only** (answers translated to the old tool's nearest,
    `fields` = routed ∪ additional, and the contract assertions cut), the held
    version fails **10 of 41**: the two contract cases, and the owner's
    shapes, each on both money paths. Those are `["shape"]` alone with the
    photo shipped and refused, and the menu message with the extra work alone
    or with `behavior` tied to the removal. Main fails **22 of 41**.
- **Suites and CI**:
  - the 242 test files that can see the lanes, the router, the picker, the
    door or `worker.js`: 6,414 / 6,414;
  - the whole suite **8,201 / 8,199 / 0 / 2** locally, +14 against 8,187,
    exactly the file's 27 → 41;
  - **unit CI run `36444601748` on `d6f564a5`: 8,201 / 8,197 / 0 / 4**, the
    checkout at `d6f564a5`, all 86 cases of the three changed test files
    passing by name, 8,201 distinct results with no gap, none failing;
  - **`site build` run `36444602008` on `d6f564a5`** (15:34:28 → 15:55:53Z,
    21m25s, all twenty steps, the checkout at `d6f564a5`) read all twelve
    counts green out of its per-step files: TAP 397/397/0/0, kit-typecheck
    4, site-build 404, contrast-cases 16, theme-seam 11, theme-render 29,
    site-routing 14, site-runtime 47, and kit-render / kit-a11y /
    kit-effects / kit-paint `all passed` (census 7 + 4 + 1 = 12). The only
    `##[error]` lines are the two known annotations, `tsc`-format lines read
    9 / 2 / 7, and `site-build.mjs` took 15m29s;
  - the documents commit `a88e8567` starts no site build, and its unit run
    `36446630623` reads 8,201 / 8,197 / 0 / 4, so writing the notes moved
    the suite by zero.

  No mutation sweep (the owner's instruction).
- **The image**: `worker.js`, `builder/site-lanes.mjs` and
  `builder/site-ask.mjs` are container inputs (and `builder/site-nav.mjs`
  across the branch), so a merge rebuilds and rolls it. Predicted over
  `d6f564a5`: `a217f74c81122512` (188 inputs, 158 distinct paths), against
  main's `9038e90ab1d5d7fe` and the second version's `776b004f79e11a6a`,
  which the same predictor reproduces first.
- **The second version's numbers, kept**: unit CI run `36376498949` on
  `50b97183` read 8,188 / 8,184 / 0 / 4, and run `36376714716` on `d9e3f0f1`
  read 8,187 / 8,183 / 0 / 4; `site build` run `36376499742` on `50b97183`
  passed with all twelve counts green (site-build 404) in 22m33s. Its red
  checks: against main 10 of 63 failed, and against the held first version 15
  (9 on behaviour).

**What this still cannot tell.** Items 2 to 5 were re-driven through the
route on the current code, and item 7 through the route and the browser's own
composer.
1. **Whether a real picker fills the two lists as asked** is unmeasured; every
   answer is supplied.
2. **A lane the picker lists under `additional` runs.** With `behavior` and
   `shape` both as work for the menu message above, the menu change and the
   layout ship, the `behavior` lane runs and answers nothing, and the screen
   adds "⚠️ I couldn't work out how to change the site's look that way. Say
   which part — a colour, the fonts, a section — and what it should look
   like." The route honours the list it is given.
3. **A second request the picker files under `routed` does not run, and the
   screen does not say so.** "Take Gallery out of the menu and make the footer
   navy." answered `{routed: ["action", "css"], additional: []}`: only the
   menu changes, the stylesheet stays empty, and the screen says "✅ Updated
   the menu on 4 pages: …". **Named under `additional`, the same message now
   ships both** (the stylesheet and the menu, 3 + 2), where the second version
   set a lone `css` aside in silence. That old limit is closed when the picker
   answers as asked.
4. **A door answer with no readable `additional`** (run 47's recorded shape,
   or a list of non-strings) reads as nothing additional: the routed change
   runs alone.
5. **A part that ends the whole message on the look door still ends it here,
   and the router's change does not run either.** A database removal beside
   the menu message is refused whole (422: "⚠️ I didn't change anything,
   because the site's database — its tables, saved functions, outside
   connections and scheduled jobs — isn't something I take away from here.
   …"), with only the picker called. An addition beside the photo removal
   sends the whole message to the paid add-on route, and the photo stays.
   Read in the code, not driven: a page verb the picker gave no verb for, or
   a page that is not there, is a sentence for the whole message. These are
   the same on main, and changing them is a separate decision.
6. **Two operations are reported as one** ("✅ Updated the look." or "✅
   Updated the look — the design."), the recorded limitation of the
   multi-step composer.
7. **Found, not changed: the reply can say the second part was not done when
   it was.** The router's `alsoAsked` field tells it to copy out a second ask
   that belongs to a different part of the site, which is exactly a layout
   beside a photo removal, and the browser then appends a sentence. Driven
   through the route with `{additional: ["shape"]}` and a routing reply
   carrying `alsoAsked`: the layout shipped, and the screen read "✅ Updated
   the look. One photograph is no longer on the site. … I only did one thing
   this time. Say “put the order band above the starter story” and I’ll do
   that next." The same happens on the look door and on main's door whenever
   two lanes run, and it is likelier now that the door is asked for extra work
   by design. Matching that sentence to the lanes would be reading English.
   The options are the owner's: the route could say it ran extra work and the
   browser drop the sentence, or the router could leave `alsoAsked` out on a
   removal door.
8. Read, not driven: an additional page removal the picker gave no page name
   targets the router's page or the default page, as before.

**Not established by any of this**: what a real picker or menu model answers.
The page removal, the redirect and the restore still have never run live; the
re-run does that.

**The presses after the owner's review** (none dispatched; each the owner's):
1. merge and deploy; the container rolls, so the next press waits for the
   rollout;
2. the free canary from `main`, spend `no`, with the merge's sha and the
   deploy's image (predicted `a217f74c81122512`; re-predicted over the merge
   commit before the push);
3. the free rehearsal of `5-page-remove` from `main`;
4. the paid run of `5-page-remove`: about 4–6 credits, an estimate and not a
   cap (balance 50);
5. the free restore to `01790468089054-8btpep`, reading `/gallery` without
   following redirects.

### What it will not establish

- How a real model reads any other wording.
- The link rule's refusal: run 47's second message already showed it live, so
  the re-run does not repeat it.
- Components, which this site does not store.
- Hydration (#418) and translation, both parked.

### Run 49 — the removal passed; its redirect failed on a publish defect (2026-09-28; restored by run 50; the fix merged and deployed in deploy 2165; the removal and the restoration closed by the owner)

Deploy 2164 (`e4b15ef6`, image `a217f74c81122512`) carried the correction, and
the owner's free run 48 confirmed it live. **Run 49, the owner's paid retry
(36458780197), passed 8 of its 9 checks, and the owner closed the removal**:
- **message 1**, "Take Gallery out of the menu.": routed `nav` + `remove`; the
  real picker answered `{routed: [], additional: []}`; the Gallery link came off
  all four menus, and the home page kept "Today's bake";
- **message 2**, "Remove the gallery page.": sent only after message 1's stored
  success; it removed `gallery.tsx` alone, free;
- the stored bodies equal the expected ones, and no page links to `/gallery`;
- **cost**: 50 → 45, routing 2 + 1 and the menu edit 2.

**The ninth check failed: `/gallery` answered 404, not a 301 home.**
- **Live, before the restore**: `/gallery` and `/the-starter` (301 since run 39)
  answer the bare nine bytes `Not found` with no version stamp; a missing file
  answers the same bytes with the script's stamp.
- **So the plain text was not the script's answer.** It was the dispatcher's
  last resort, reached after the script's HTML not-found and a redirect lookup
  that found nothing. Nothing had been stored to find.
- **Cause**: since 2026-08-17 the publish handed `mergeRedirects` the parsed
  sidecar, whose lists are `routesCsv`/`redirectsCsv`, not the
  `{routes, redirects}` it reads. So a removed page never got a redirect, and
  the next publish dropped every stored one.
- **Fix, at `2cf8461c`, merged and deployed at `f5e941f4`** (deploy 2165,
  2026-09-28 19:07 UTC, image `8a10715339cdc780`): the read goes through
  `manifestFromCsv`, which the serving side has used since 2026-08-22.
- **Evidence**: `test/publish-redirects.test.mjs` runs three publishes through
  the real edit route, serves the result through the real dispatcher, and
  restores through the real route. It fails 4 of 4 on `e4b15ef6`, where it
  serves exactly the live answers, and passes 4 of 4 with the fix. Kept by the
  fix: a missing file, an unknown address, the query string, and a restored
  page that serves itself, also after the next publish.
- **Found, not changed**:
  - the branded not-found page is replaced by the bare text on every Start
    site;
  - a QR code on `/visit` still encodes the removed `/gallery` address,
    checked with `qrEncodes` against the live file. The removal's link rule
    reads page source, and a QR's destination lives in the design config.
- **The restore to `8btpep` ran as the owner's free run 50** (36466791459,
  18:40–18:41Z): preflight `e4b15ef6edc7` / `a217f74c81122512`, the site
  reporting `8btpep` after 7 reads, nothing charged, balance 45. Checked
  afterwards, read-only:
  - the run's own source read is complete and its five pages are
    byte-identical to run 49's before-read, `gallery.tsx` included;
  - `/`, `/gallery`, `/order`, `/starter` and `/visit` answer 200 at
    `8btpep`, read without following redirects, and each page's links equal
    run 49's before copy;
  - `/the-starter` 301s to `/starter` (the version's own staged map), and
    the sitemap lists the five pages;
  - a real browser reads the five routes as run 39 read the same version,
    except the kit's `OpenNow` line on `/visit`, which follows the clock.
- **Until deploy 2165, the next publish of any site dropped its stored
  redirects.** No queued publish or build ran between run 50 and that deploy
  (read-only). The fix preserves saved mappings from then on; it does not
  reconstruct the ones dropped since 2026-08-17.

## Remaining work after Test 3 (2026-09-26), and Test 4 prepared for approval

Test 3 (run 34) and the CSS-correction milestone (deploy 2161's batch) are
**closed by the owner**: no repeat run, no restoration, no further CSS work.
Runs 35 and 36 were free. **Test 4a's Part A ran as run 37** (your paid press,
8 credits), and **Parts B and C ran as run 39** (your paid press of the
canary's browser mode, 6 credits; run 38 was refused before signing in and
spent nothing). **Test 4a is closed by the owner** after an independent review
of run 39's workflow and evidence (2026-09-27), for the behaviours runs 37 and
39 demonstrated. The balance was 59 after Test 4a (read on the balance row at
2026-09-27 00:45Z) and is 56 after run 42 (read on the balance row at
06:13:03Z).

**The kit-heading defect is fixed, closed by the owner, and merged and
deployed**: main is `ab74d0d9` (deploy 2162, 2026-09-26 20:31 UTC, image
`369d7b1e5bae25b0`). It is **runtime-confirmed by your free press, run 35**
(21:08 UTC): both readers answered `ab74d0d94384` with image
`369d7b1e5bae25b0`. That press was also Test 4a's step 0, and step 0 ran again
as run 36 from the branch with the canary's reader fixed (below). The owner reproduced the
defect independently: the correct removal was refused with `SectionHeader`'s
`title` and accepted with the equivalent literal `<h2>`. The owner's review then
found one gap — a kit heading the page may not render (inside `{false && …}`,
`<div hidden>` or an unknown wrapper) still named its section — closed at
`5ec82214`, which is in the deploy. Test 4 below is split in two, each part with
its own approval; **4a is closed: its free step 0 ran as runs 35 and 36, Part A
passed as run 37, and Parts B and C passed as run 39, through the canary's new
UI mode (the real app in a real browser)**. **4b is now D1 alone** (owner,
2026-09-27): one price in the site's database, changed through the real app
and put back with no model call. It is built at `6602be37`, with tests, probes
and CI, and its free rehearsal passed as run 40. The owner then reproduced a
gap in the put-back: a change landing between its read and its write was
overwritten. **That is closed**: the write is now conditional in the owner
rows route itself, which is Worker code. The owner closed the correction after
review (165 focused tests), and it is **merged and deployed at `14df0225`
(deploy 2163, 2026-09-27 05:15 UTC, image `9038e90ab1d5d7fe`)**. **The fresh
free rehearsal on that deployment passed as run 41** (05:37 UTC; its preflight
is deploy 2163's runtime confirmation), and **the owner's paid press passed as
run 42** (06:03–06:05 UTC). The price went to £4.60 through the `data` layer and
showed on the order page. The canary's conditional write then put it back to
£4.50. It cost 3 credits (*the paid press ran as run 42*, in Test 4b). **D1 is
closed by the owner** after an independent review of run 42 (2026-09-27). D2
(the grants apply) and D3 (a real order) are parked as maintenance and
integration checks: applying grants through `grants preview` does not exercise
the rules rung. Step 0 (`grants preview` run 36286991932) is kept as evidence.
The rules rung is the recommended next test, on the candidate site
`lido-axes-b` (after Test 4).

### What is already shown live (credited, not rerun)

A read-only census of the **queued** edit jobs (`edit_jobs`, 2026-09-26,
07:40Z) lists every edit the queue has published: **51 jobs since
2026-09-01**. All of them are on fretwork-1 except one on fold-lane-bakery
(run 9).

**The census sees queued jobs only.** An edit that ran synchronously never
made a row: every edit before `EDIT_ASYNC_EVERYONE` opened on 2026-09-04, and
any later synchronous fallback. So a rung missing from it is missing from the
queue's record. That does not establish that no synchronous edit ever
exercised it.

| Rung or behaviour | Published through the queue |
| --- | --- |
| Page rung, quick writer | Runs 9, 17 and 32 (a block move, a one-line change, a section move); lane-sweep jobs on 2026-09-02 (shape, three). Run 9 kept both photographs, checked in a real browser. |
| Page rung, full writer | Runs 11, 21, 24, 26, 34 and 37 (34 and 37 on the current code; 34 with the text guard and the judge, 37 with the text guard on a page with photographs, both kept, and the kit-heading fix answering live); lane-sweep jobs on 2026-09-01/02 (three, components, purpose, tsx twice). |
| Look lanes | 32 jobs, 2026-09-01 to 09-07: css, brand, favicon, lang, langs, theme, description, wordmark, qr and behavior. One also placed a QR code through the page rung, the only live message that ran two rungs. |
| Menu | 2 jobs (the action lane), 2026-09-02. |
| Site address | 1 published and 1 refused and refunded, 2026-09-02. |
| Text | 1 job (gap-sweep run 10), 2026-09-02. |
| Logo | Run 39 (Test 4a's B1): a PNG attached in the real composer became the header logo, byte for byte; published free (`exempt`, no ledger row). |
| Picture (reframe) | Run 39 (B2): the named photograph moved to show the top, and nothing else; 1 credit. |
| Page move | Run 39 (B3): `/the-starter` → `/starter`, every link followed and the old address answers 301; published free (`exempt`). |
| Data (one row) | Run 42 (Test 4b's D1): one price, routed to the `data` layer, changed on the live database exactly as asked and shown on the order page, then put back by the canary; 3 credits. A row edit publishes no version, so this is an applied change, not a publish. |
| Second messages from one tab | Run 39: three messages from one browser tab, each after a finished job, each with its own job, reply and working composer. |
| Queue, billing, reply, after-read | Every canary run. Runs 33 and 34 ran on the current code. |

The jobs from 2026-09-01 to 09-07 ran on older code. They count as live
coverage of those rungs' paths, not as evidence about today's code, and they
are not rerun.

**Never published among the queued jobs inspected:** the rules rung and a page
removal. **The data rung changed its first row through the queue in run 42**
(2026-09-27). The census had 290 queued jobs since 2026-09-01, 197 of them
with a stored reply, and run 42's reply is the only one that names the `data`
layer or lists changed rows (read-only, 06:13Z). A row edit publishes no
version. **Run 39 (2026-09-27) was the first queued publish of the
logo rung, the picture rung and a page move**, and its logo and move jobs are
the only `exempt` jobs in the queue's history (a read-only count of
`edit_jobs` by billing state), so the free-rung path has now published through
the queue since `ed1e3b93` fixed its gate. Run 39 was also the first time
messages came from one browser tab rather than one scripted request each.

### Missing live evidence (not product defects)

Controlled tests cover each decision below, with supplied answers. What is
missing is a real model, the real browser or the live database.

1. **A second message in the same tab after a hop or a failure.** After a
   finished queued job it is shown (run 39). Controlled: `edit-lock`,
   `edit-result-display`, `edit-failure-paths`.
2. **The picture rung's swap** (a new picture into a slot). The reframe is
   shown (run 39). Controlled: `site-picture`, `edit-page-once`,
   `edit-failure`.
3. **The data rung beyond one row change.** Run 42 (D1) showed one price
   routed to `data`, changed live and put back. Still covered by controlled
   tests only (`site-apply`, `edit-failure`):
   - adding, removing and reordering rows;
   - a site whose backend reference is blank (`incomplete`).
4. **The rules rung on a site with a database.** Controlled:
   `edit-rules-backend`. Run 12 was blocked by a defect that has since been
   fixed. It is the recommended next test, on the candidate site
   `lido-axes-b` (after Test 4); neither D2 nor D3 would cover it.
5. **The first schema change on a site built before 2026-09-13**, which
   re-emits every table's grants in column-scoped form. Proven on a real
   PostgreSQL 16 locally (`local-pg-grants`), but not observed on a live form
   submission. D2 and D3 would have shown it on fold-lane-bakery, and both
   are parked.
6. **Real-model behaviour in general.** Why a quick attempt did not publish is
   not on the wire, and the writer's prompt is not captured.
7. **The add-on through the browser since deploy 2154.** This is outside this
   checklist; the last live add-on was run 53 (2026-09-20). Not proposed now.

**Shown live since, by run 37 (Test 4a's Part A), and moved to the table
above:** the full writer on a page with photographs (both kept), and the
kit-heading fix with a real model.

**Shown live since, by run 39 (Test 4a's Parts B and C), and moved to the
table above:** an attachment sent from the real composer (the logo rung's
`{name, data}` shape, fixed in `51e39e3c`), the logo rung and a page move
publishing through the queue as `exempt`, the picture rung's reframe, and
second messages after a finished job in one tab.

### Reproduced product defects, still open

1. **Review #9:** a multi-step look reply names only the look, even when a
   picture, menu or address change went through beside it.
2. **An add-only answer ends the whole message.** A QR code, a 3D element or
   an "add a page" in the look door stops everything, so an ordinary change in
   the same message never runs (next-task 5).
3. **A half-moved site address.** If the second alias write of an address
   change fails, the old name is demoted and the new one is never written
   (next-task 5).
4. **The reply shows three problems of N** with no "and N more" (run 11).
5. **The quick writer's reply carries empty `changed` and `moved` lists** (runs
   17, 32 and 34). They are not an inventory.

**Fixed, merged and deployed in deploy 2162:** the text guard could not name a
section whose heading comes from a kit component's prop (the next section).

### Recorded separately when Test 4a closed (2026-09-27, not fixed)

Three findings from run 39, kept apart from the closed test and from each
other. None blocks anything; none is being worked on.

1. **The logo reply says "on every page".** The placeholder `/starter` page has
   no header, so the logo shows on four of the five pages. Reply wording.
2. **The message bubble in the thread does not show the attached picture.** The
   words show; nothing stores an attachment on a thread message. The picture
   itself was sent and used.
3. **The canary's job reader says `exempt` means "a founder account".**
   `billingMeans` predates the free-rung exemption (`ed1e3b93`), which is what
   run 39's two exempt jobs were. Harness wording, not the product.

### Deliberately deferred (owner's decisions)

- Hydration (#418), translation (including page code read as text), and
  model-written replies.
- CSS: no further work, including the css lane dropping an earlier rule (#8)
  and a live css-lane run on deploy 2161's code.
- The full-site revise: no photograph wall, and `imageDirective(0)` on a
  photographed site.
- Money wording on the build path and in the add-on reader; the two refund
  policies; the routing charge, which is never refunded.
- Text-guard grammar limits (a site page name used as an ordinary word;
  trailing commentary).
- Drafts are session-only, and the needs-review sentence is never shown.
- The add-on route's no-layer climbs (the server-side classification).
- The photo add-on kind, which waits on fal funding.

### Free checks done for this assessment

- **The job census** above (read-only, queued jobs only).
- **Live reads of fold-lane-bakery** (07:14–07:34Z):
  - it still serves run 9's version, `01789969693841-xqi8vs`;
  - its five routes' HTML was saved;
  - the public `loaves` route answers 200 with six rows (Sea Salt Focaccia
    4.5);
  - `orders` answers 403 to a visitor, which is the shape a refused read takes.
- **A rehearsal of Test 4 — 13 of 13 pass.** It ran through the real edit
  route of the deployed tree, on fold-lane-bakery's stored pages (run 9's
  after-read), on both money paths, with every model answer supplied:
  - the logo, which makes no model call, is exempted and passes the publish
    gate;
  - the picture reframe changes only `focus="top"`;
  - the page move rewrites every reference and publishes free;
  - the removal of a section made only of kit props reaches the full writer
    and keeps both photographs;
  - an answer that also drops a photograph is withheld;
  - the same removal, answered to a request naming a different section, is
    refused;
  - the kit-heading defect reproduced — and on the branch with the fix, the
    same case publishes: 'Remove the "Today's bake" section from the home
    page.' on the real stored page, with and without the unused imports
    cleaned up, for route 2 + edit 3 in the rehearsal's prices.

  The rehearsal is scratch work and is not committed. The controlled tests
  already cover these decisions; this only pins them to this site's real
  pages.
- **The corpus heading census** behind the kit-heading fix.
- **The order form's fields**, read from the stored `order.tsx`: it writes
  `orders` with `customer_name`, `phone`, `loaf`, `pickup_date` and
  `pickup_time`, and reads `loaves`.
- **Data and rules were not rehearsed.** The uncertainty there is the router,
  since an adopted site sends it no table names, and the live database. Only a
  live run measures those.

### Test 4 — two parts, approved separately: 4a closed (runs 37 and 39); 4b is D1 alone, rehearsed free as runs 40 and 41, with its put-back write conditional; the paid press passed as run 42, and D1 is closed by the owner

Both parts run on fold-lane-bakery (Harbour Loaf): a database, three
photographs (two on the home page), five pages, and run 9's stored source
already read. **4a changes published pages only, and a free restore undoes all
of it. 4b writes to the site's database, which no restore reaches, so it has
its own approval and its own recovery.**

#### Test 4a — pages, photographs, an attachment and second messages

**Done on the deployed code: step 0 ran as runs 35 and 36, Part A passed as
run 37, and Parts B and C passed as run 39 (below).** Every press below is `edit-canary.yml`
(<https://github.com/canias7/isibi-app/actions/workflows/edit-canary.yml>, "Run
workflow"), with **"Use workflow from" set to `claude/help-needed-ehlwlj`**
until the canary's reader fix (below) is merged; a merge of it deploys nothing.
A branch press runs the branch's canary script against the live platform, and
the preflight checks the platform, so the two expectation boxes stay deploy
2162's. The GitHub form shows descriptions, not input names, so the boxes are
named here by their descriptions. **The two "Refuse to spend unless…" boxes
are the same on every press**, read off deploy 2162:
- "…the Worker reports this deploy sha…":
  `ab74d0d94384e85db252176eaca623ba131932a5`;
- "…a cold container reports this image id…": `369d7b1e5bae25b0`.

A press refuses to go on if either disagrees with the live platform, so none can
run against the previous build.

**Step 0 — your free press, first: the runtime confirmation, the restore target
and the before-read in one.**
- "Run the ONE paid edit as well": `no`.
- "What to change" and "READ ONE EXISTING JOB AND STOP": blank.
- "PUT ONE SAVED VERSION BACK, THEN READ IT AND STOP":
  `01789969693841-xqi8vs`. This is the version the site serves now, so nothing
  is posted.
- "The site to edit": `fold-lane-bakery`. "A second site…": `washhouse-3`.
- The two "Refuse to spend unless…" boxes: as above.

What it should print, and what each part establishes:
- `build-health 200 deploy=ab74d0d94384 image=369d7b1e5bae25b0` and `runtime
  200 … async=true runner=true`, with both readers agreeing. This is **deploy
  2162's runtime confirmation**: the live Worker answering, not the deploy
  reporting on itself.
- The balance, 73 unless something spends first.
- `RESTORE`: the site's version list, newest first, with
  `01789969693841-xqi8vs` as row 1 ("Live now") and not marked `NOT
  RESTORABLE`. Then **`RESTORED — the site already reported
  01789969693841-xqi8vs, so nothing was posted`**. That `RESTORED` is a no-op:
  the restore mode refuses an id the list does not carry or cannot restore, and
  posts nothing when the site already serves the id. So this press verifies the
  recovery target and changes nothing.
- The inventory, including `before/source.json`, which I compare with the five
  bodies below.
- It ends `RESTORE MODE — stopping before the paid edit. Nothing was charged.`

**Step 0 ran as run 35** ([36271891594](https://github.com/canias7/isibi-app/actions/runs/36271891594),
21:08:15 → 21:08:56Z, from `main`):
- **Deploy 2162 is runtime-confirmed**: `build-health 200 deploy=ab74d0d94384
  image=369d7b1e5bae25b0`, `runtime 200 … async=true runner=true`, both readers
  agreeing, every preflight check `ok`, and `ALL FREE CHECKS PASSED`.
- **The restore target is verified by the site's own list**: 5 versions, row 1
  `01789969693841-xqi8vs` ("Live now", parent `01789776828162-bdqv15`), not
  marked `NOT RESTORABLE`. Then `RESTORED — the site already reported …, so
  nothing was posted`.
- **Balance 73.** Every route answered `01789969693841-xqi8vs`, and the source
  read was complete (`reads` all true).
- **Four of the five bodies equal the record**: `index.tsx`,
  `the-starter.tsx`, `visit.tsx` and `gallery.tsx`.
- **`order.tsx` read back garbled, by the canary's own reader.** One en dash
  in its opening hours ("Wed–Sat 8–2") came back as three U+FFFD, so the read
  was 9,264 characters against 9,262. `call()` added each network chunk to a
  string, which decodes every chunk on its own. An en dash is three bytes, and
  a chunk boundary after the first yields exactly those three replacement
  characters (reproduced). The evidence that the stored page is intact:
  - the whole read held only those 3 replacement characters;
  - the route HTML, read another way, held none;
  - run 9's read of the same stored bytes held none — a broken reader can only
    garble bytes, never repair them — and nothing has written the page since.
- **The reader is fixed on the branch, not merged.** `call()` now collects the
  chunks and decodes them once; a guard drives the mechanism and checks the
  wiring (red on the unfixed script).
- **What it meant for Part A**: press step 0 once more from the branch, and
  `order.tsx` should read back as `4491c50d7cee45d8`. Run 36 did.

**Step 0 ran again as run 36, from the branch**
([36273488436](https://github.com/canias7/isibi-app/actions/runs/36273488436),
21:35:58 → 21:36:38Z). The checkout step fetched and checked out exactly
`8996cc1a`, the branch tip carrying the fixed reader.
- **The same platform**: `build-health 200 deploy=ab74d0d94384
  image=369d7b1e5bae25b0`, `runtime 200 … async=true runner=true`, both
  readers agreeing, every preflight check `ok`, `ALL FREE CHECKS PASSED`.
- **The same restore no-op**: the same five versions and `RESTORED — the site
  already reported …, so nothing was posted`. Its `restore.json` is
  byte-identical to run 35's.
- **Balance 73.** Every route answered `01789969693841-xqi8vs`, and the source
  read was complete.
- **All five bodies equal the record, byte for byte**: `index.tsx`
  `2c9421cf728d9823`, `order.tsx` `4491c50d7cee45d8`, `the-starter.tsx`
  `e1172965a3644f5f`, `visit.tsx` `0963e3bc45f1d949`, `gallery.tsx`
  `1c940e38d7fe6ab0`. The path set is the same and there are no components.
  - The whole read holds **0** replacement characters; run 35's held 3.
  - `order.tsx` is 9,262 characters and byte-identical to run 9's
    after-read.
  - The only difference from run 35's inventory is `order.tsx`'s character
    count, 9,264 → 9,262. The five route pages are identical to run 35's once
    digit runs (the render times) are masked.
- **So the reader fix is proven live, and the before-state Part A compares
  against is complete.** The supplied-answer rehearsal, re-run on the branch
  checkout, reads 13 of 13; its input (run 9's after-read) is byte-identical to
  run 36's read on all five bodies. That proves the route, never the model.
- **Next was Part A, from the same branch**: it ran as run 37 (below).

**The before-inventory, read free** (2026-09-26, 20:47–20:50Z):
- **Version.** All five routes (`/`, `/gallery`, `/order`, `/the-starter`,
  `/visit`) answer `x-site-version: 01789969693841-xqi8vs`.
- **`/`, in a real Chromium.** Every request was answered from a TLS-verified
  fetch, and nothing was typed or submitted.
  - Headings: Harbour Loaf · Fed every morning since we opened · Today's bake
    · Today's bake (the loaf list's own `h3`) · Order a loaf for collection.
  - 201 visible words. The loaf list shows six loaves with prices (Sea Salt
    Focaccia £4.50).
  - Both photographs load: 2400×1792, shown at 976×549 and 720×540. The boule
    photograph is at `object-position: 50% 50%`.
  - The header draws an SVG mark and "Harbour Loaf", with no image.
  - 0 console errors, 0 page errors, 0 failed requests.
- **The other pages.**
  - `/gallery`: Our Gallery · Photographs of the bakery's work; seven picture
    frames, all placeholders; 77 words.
  - `/order`: Order a loaf · Pick a loaf and a collection slot; 165 words.
  - `/visit`: Come to the bakery · The shutters and the street · Order a
    collection so we hold a loaf; one photograph and the gallery QR code; 116
    words.
  - **`/the-starter` is a salvage placeholder**: "This page isn't finished
    yet", 30 words, and no header.
- **Links to `/the-starter`** in the server HTML: nine (`/` 3, `/gallery` 2,
  `/order` 2, `/visit` 2). They come from the header menu, the footer and the
  home page's story block.
- **The stored bodies** are run 9's after-read. No job has touched the site
  since run 9 (the job table), and the live version is run 9's:
  - `index.tsx` `2c9421cf728d9823` (4,389 characters);
  - `order.tsx` `4491c50d7cee45d8`;
  - `the-starter.tsx` `e1172965a3644f5f`;
  - `visit.tsx` `0963e3bc45f1d949`;
  - `gallery.tsx` `1c940e38d7fe6ab0`;
  - no components.

  Step 0 re-reads them byte for byte.

**Part A — your paid canary press: the full writer on a page with photographs,
and the kit-heading fix, live.**
- **The form.**
  - "Run the ONE paid edit as well": `yes`.
  - "What to change": `Remove the "Today's bake" section from the home page.`
    That is 53 characters, all ASCII (straight quotes), sha256
    `26b7101c225656db1ec13ccff5873bd7fb64fca28ea79f2a1ad81bbbd5bfa9be`.
  - "READ ONE EXISTING JOB AND STOP" and "PUT ONE SAVED VERSION BACK": **blank**.
    A named version turns spending off.
  - "The site to edit": `fold-lane-bakery`. "A second site…": `washhouse-3`.
  - The two "Refuse to spend unless…" boxes: as above.
- **Why this sentence.** The section's heading is `<SectionHeader
  title="Today's bake">`, the case the fix exists for. The section holds three
  literal sentences (the loading error and the two empty-state lines), so the
  text guard must see them authorized by the heading. The quick writer cannot
  remove words, so the full writer runs, on a page whose two photographs sit in
  other sections.
- **It counts as the test only if** the request sha matches; the press's own
  before-read equals the five bodies above; the preflight passes; and a stored
  reply arrives.
- **Expected.**
  1. Routed to the page rung for `/`, directly or through `look`. This is
     expected, not guaranteed: a model routes it.
  2. The full writer publishes: `tweak` is absent, with `tweakUsage` (a quick
     attempt, which cannot remove words) and the full writer's `usage`.
  3. It publishes at the job's own version, and `compare.json` reads VERIFIED.
  4. `index.tsx` loses exactly the `<section>` holding `<SectionHeader
     title="Today's bake">`: 1,489 characters, covering the heading, the
     loading, error and empty lines, and the loaf list.
     - The imports it leaves unused (`Empty`, `MenuSection`, `SectionHeader`,
       `Skeleton`, `useRows`), the `Loaf` type and the `loaves` read may go
       too. That is noted, not failed.
     - Everything else stays byte-identical. That includes both `<SafeImage>`
       elements and the header menu's "Today's bake" item. That item is a link
       to `/` in `CHROME`, outside the section; no guard protects it, so the
       source comparison is what checks it.
     - The other four pages stay byte-identical.
  5. There is no `keepUsage`, since no literal link and no own component is
     lost. `problems` is empty, because the site's schema declares `loaves`:
     run 51's stored reply on this site read `backend: "ready"` and `problems:
     []` over a changed `index.tsx` that reads it.
  6. The reply is "✅ Updated /.", with the render check's note passed on.
  7. The balance moves by the routing charge plus the edit. The ledger's one
     reserve for the job equals the edit's cost.
  8. The live page, in a real Chromium (mine, free):
     - the headings are Harbour Loaf · Fed every morning since we opened ·
       Order a loaf for collection;
     - there is no "Today's bake" heading, no loaf name and no price;
     - visible words go from 201 to **82**: exactly the section's 119 go;
     - both photographs load, with no console errors or failed requests;
     - the other four pages read as before.
- **What a different result would mean.**
  - `prose-preservation`: either the fix is not what answered (check the
    deploy) or the writer also lost other literal prose. The refused answer is
    not stored, so which one is not established.
  - `tweak: true`: the quick writer published a removal of words, which it
    must never do.
  - `withheld` with `photosBlocked`, or `photosKept`: the writer dropped a
    photograph and the wall refused or restored it — the protection working
    live.
  - A reply calling `loaves` undeclared: the page rung's schema read, not the
    edit.
- **Cost:** route 2 + edit about 8–10, so about 10–12 (8–15), plus about 1
  if it is routed through `look`. An estimate, not a cap.

**Part A ran as run 37 and passed**
([36274691376](https://github.com/canias7/isibi-app/actions/runs/36274691376),
21:57:49 → 22:02:24Z, your paid press from the branch at `6ce873fc`). It counts
as the test: the request sha matches (`26b7101c…`, 53 characters, `source:
CANARY_INSTRUCTION`), its own before-read equals the five bodies, the
preflight read deploy 2162, and a stored reply arrived (HTTP 200 under
`x-gf-edit: final`, after 220.2 s, 65 polls, 0 transient). Against the expected
list:
1. **Routed through `look`.** Given the five pages, the router answered
   `intent=edit layer=look page=/` in 16.1 s for 2 credits (`6,769 in / 19
   out`). The lane picker chose `components` (`2,255 in / 20 out`), which
   reaches the page rung for `/`.
2. **The full writer published.** `tweak` is absent; `tweakUsage` is `1,894 in
   / 56 out`, a quick attempt that did not publish (why is not captured); the
   full writer is `15,257 in / 930 out`. The look door's reply lists all three
   billed calls in `usage.langUsage`.
3. **At the job's own version, VERIFIED.** `01789969693841-xqi8vs` →
   `01790460007724-qwlcka`, minted 22:00:07.724Z (0.46 s after the reserve);
   `published_at` 22:02:11.971Z. The after-read's wait matched on its first
   read.
4. **Exactly the section, and the code only it used.**
   - `index.tsx` went 4,389 → 2,435 characters (`2c9421cf728d9823` →
     `9ae87b30a1fa5d4a`). It is **byte-identical to the removal built by hand
     as the control**: the section's 39 lines, plus the `useRows`/`Row`,
     `Empty`, `MenuSection`, `SectionHeader` and `Skeleton` imports, the `Loaf`
     type and the `loaves` read.
   - 306 tokens were lost, all from those lines, and 0 gained.
   - Both `<SafeImage>` elements and the header menu's "Today's bake" item are
     unchanged. The other four pages are byte-identical, and there are no
     components before or after.
   - The checker was proved on six controls first: two correct removals pass,
     and collateral prose, a removed menu item, no change and a reworded line
     are each flagged.
5. **No `keepUsage`, and `problems: []`**, as expected. The text guard let the
   section's three literal sentences go, with the section named only by the kit
   heading: the case refused before deploy 2162. The verdict is inferred from
   the publish; it is not on the wire.
6. **The reply is "✅ Updated /."** No render note came with it; a render
   report rides on the reply only when the check failed or found something.
7. **Money closes exactly: 73 → 65 = route 2 + edit 6.** The ledger's one row
   for the job is a reserve of 6 (`balance_after 65`, ref `<job>#1`,
   22:00:07Z), with no refund, and the job reads `done`, `finalized`, cost 6.
   That is the bottom of the quoted 8–15.
8. **The live pages, in a real Chromium** (before at 21:58:39Z, after at
   22:02:27Z):
   - `/` reads Harbour Loaf · Fed every morning since we opened · Order a loaf
     for collection;
   - its text is the before text with exactly the section cut out: 201 → 82
     words, 0 gained, no loaf name and no price;
   - both photographs load at the same sizes, and the home page no longer asks
     for `/data/loaves`;
   - the other four pages read exactly as before;
   - there are 0 console errors, page errors, failed requests or non-OK
     responses on any page.

**What run 37 establishes**: on one sentence and one site, a real model's full
page rewrite removed exactly the named section on a page with photographs, both
photographs stayed, and the kit-heading fix let the correct removal through.
**Not established**: the writer's prompt, why the quick attempt did not publish,
and the text guard's own verdict. The link-and-component judge and the
photograph wall had nothing to protect here, so neither was exercised.

**Part B — the real app in a real browser, driven by the canary's new UI
mode: three messages, one tab, no reload.** No existing workflow drove the
signed-in app, and the session has no owner credentials and cannot dispatch.
A new workflow file would have no Run button until merged, so this is a MODE of
the existing canary, like the restore mode. It is on the branch, so a branch
dispatch offers its box (`ui_scenario`).
- **What it does:**
  - It signs in the way the canary already does: a magic link minted with the
    service key, then verified.
  - It plants that session where `auth.js` keeps one (`zephyr_session_v1`),
    only for gofarther.dev itself, before the page's first script runs. The
    site's own preview frame gets nothing.
  - It opens gofarther.dev/projects in a real Chromium, and opens Harbour
    Loaf's card on the start screen.
  - It attaches `test/fixtures/ui-logo.png` through the + button's own file
    chooser. The file is a 240×240 PNG of a loaf, 1,254 bytes, sha256
    `2cc633d73b2d5ab38d29d94cf15c9ce67980a2401ee005f99e89e0781a4c3df5`.
  - It types each message and presses Send only when the previous reply is on
    screen and the composer is idle: the busy flag down, Send drawn and live,
    no Stop button, no "Working" row, a box that takes typing.
  - After each reply it types into the box and checks Send is live, so
    "usable again" is a reading, not an assumption.
  - It records each reply exactly as shown, and each routing and edit request
    and reply, with an attachment reduced to its name, size and sha256. It
    also records every job each message filed and the balance before and after
    each message.
  - After the last message it finds each job's published version in the
    site's own list, and waits for the site to report the last one. It then
    takes the byte-level after-read, checks each publish was built from the one
    before it, and reads each job's row and ledger lines.
- **Where it stops, sending nothing more:**
  - a free check that failed;
  - the sign-in gate, another account, or no card for the site;
  - a file that never lands in the attachment strip, or words that do not land
    in the box;
  - a composer that is busy before a message;
  - a reply that does not come within 12 minutes;
  - a balance it cannot read, or 15 credits spent (checked before each
    message).

  Without `spend = yes` it stops before the first Send: a rehearsal that shows
  the app opens signed in and the file attaches.
- **What it blocks in the page:** any add-on, build or full-rewrite request.
  That is the paid work this scenario never asks for, so the request is
  aborted before it leaves the browser and recorded as BLOCKED. Whatever the
  page then says is the harness's doing, and the record says so.
- **Its limits, stated:**
  - The budget is checked between messages, so one message's own cost is never
    cut off mid-way. That cost includes a hand-off to another edit layer, which
    the page makes as a second edit request with its own job, as the real app
    does.
  - Every other request goes to the live Worker. So the replies are the real
    ones, and so is the money.
  - A blocked request fails the run and does not stop the scenario: the page
    answers it with its own not-knowing sentence, and the next message still
    goes.
- **Proven before any press, and what that proof is:**
  - Locally, against the real app's code: the live gofarther.dev files served
    into a real Chromium, with every API call answered in the page. It ran the
    three messages, a rehearsal, a refused session, a message misrouted to the
    add-on (blocked), and a job that never finished. That proves the driver,
    never the live platform's answers.
  - 22 unit cases, through a stand-in page that forces every stop; unit CI
    green on `ca3a6fae` (8,040 tests), all 22 found passing by name.
  - Targeted probes: 33 mutants, all killed; 3 comment-only controls, all
    surviving.
  - The canary's balance reader used to read an answer it could not parse as a
    balance of 0, which would switch off the budget stop. It answers "unknown"
    now, and unknown refuses (5 more probes, all killed).

Everything in the last column is read afterwards, free: the job rows and the
ledger (read-only), and the live pages in a real browser.

| # | Send exactly | Expected rung | Expected reply | Established afterwards | Credits |
| --- | --- | --- | --- | --- | --- |
| B1 | Attach a PNG or JPEG under 2 MB (not an SVG) with the + button, then `Use this picture as the logo.` | logo — expected, not guaranteed | "✅ That's your logo in the header now, on every page." | The header draws the image instead of today's SVG mark, on the four pages that have a header; `/the-starter` is the placeholder and has none. **The free path is established only by the job's own record**: its stored reply names the `logo` layer, its `billing` is `exempt`, and no ledger row names it. A different layer is a routing finding, not a logo-rung result. | 2 |
| B2 | `Show more of the top of the photo of the sourdough boule cooling.` | picture | "✅ Moved “A sourdough boule cooling after the morning bake” to show the top." | Only that image moves, from `object-position: 50% 50%` to the top; both photographs still load; the job's one reserve equals its cost. | ~3 |
| B3 | `Move the starter page to /starter.` | page (move) | "✅ Moved /the-starter to /starter." | `/starter` answers 200 with the same placeholder page; `/the-starter` answers 301 to `/starter`; no page links to `/the-starter` (nine do today). `exempt` only if the stored reply shows the page rung and the ledger holds no reserve; through `look`, the lane picker's call is billed instead. | 2 (3 through look) |

- **Second messages.** B2 and B3 each follow a finished job. Each must get its
  own job and reply, and the send box must come back after each. A message
  that is routed and then hangs means the per-ask latch has failed. The job
  rows show one job per message, in order.
- **Cost:** about 7–8 in total. The mode stops before a message once 15 are
  spent.
- **The press** (`edit-canary.yml`, "Use workflow from" = the branch
  `claude/help-needed-ehlwlj`, where the new box exists):
  - "RUN A SCENARIO THROUGH THE REAL APP IN A REAL BROWSER…"
    (`ui_scenario`) = `4a-part-b`;
  - "Run the ONE paid edit as well (yes/no)" (`spend`) = `yes`, which in this
    mode sends the scenario's messages;
  - "The site to edit…" = `fold-lane-bakery`; "A second site…" =
    `washhouse-3`;
  - "What to change…", "READ ONE EXISTING JOB…" and "PUT ONE SAVED VERSION
    BACK…" blank;
  - "Refuse to spend unless the Worker reports this deploy sha…" =
    `ab74d0d94384e85db252176eaca623ba131932a5`;
  - "Refuse to spend unless a cold container reports this image id…" =
    `369d7b1e5bae25b0`.

  The same form with spend = `no` is a free rehearsal. The artifact holds
  `ui.json`, `ui.txt`, a screenshot after each message, `job-<id>.txt` for each
  job, and the before and after source.

**Part C — the byte-level after-read, now taken by the UI mode itself.** Once
its last message has published, the mode waits for the site to report that
version and reads every stored body, so the whole sitting is compared byte for
byte. A separate free press is needed only if its chain reads UNVERIFIED. It
would use step 0's form with "PUT ONE SAVED VERSION BACK" **blank**; with the
version named, the press would restore it. What the after-read should show:
- `index.tsx` should change only by Part A's removal (known to the byte: run
  37's `9ae87b30a1fa5d4a`), B2's `focus="top"` and B3's links;
- `the-starter.tsx` should become `starter.tsx`;
- the other pages should change only by B3's links.

**Run 38 was refused before it signed in, and spent nothing**
([36281161831](https://github.com/canias7/isibi-app/actions/runs/36281161831),
2026-09-27 00:00Z). "The site to edit" was left at `fretwork-1`, and the
scenario is written for `fold-lane-bakery`, so the canary refused with exit 2
before any network call: *REFUSING THE UI MODE: scenario "4a-part-b" is written
for fold-lane-bakery, and the site box says fretwork-1*. The balance stayed 65,
no job or ledger row appeared, and both sites kept their versions. That is the
scenario-to-site wall working live.

**Parts B and C ran as run 39 and passed**
([36281551801](https://github.com/canias7/isibi-app/actions/runs/36281551801),
00:07:42 → 00:17:14Z, your paid press from the branch at `403f294e`; the
canary step took 8m43s). It counts as the test: the preflight read deploy 2162
(`ab74d0d94384`, image `369d7b1e5bae25b0`, async and runner true) with both
expectations matched, every free check passed, its own before-read (all reads
true) equals Part A's after-read on all five bodies, and each message got a
stored reply. Against the table:
- **B1, the logo — the logo rung, as expected.** Routed `layer=logo` for 2
  (`6,763 in / 15 out`). The file reached the edit request byte for byte
  (1,254 bytes, sha256 `2cc633d7…`). The job published free: its stored reply
  names the `logo` layer, `billing` is `exempt`, and no ledger row names it.
  The reply is the table's, word for word: "✅ That's your logo in the header
  now, on every page." 167 s from Send to reply.
- **B2, the reframe — the picture rung.** Routed `layer=picture` for **1**:
  that routing call read 7,168 prompt tokens from the cache and 117 fresh,
  where the other two read 512 and about 6,760. One model call (`1,401 in / 41
  out`), cost 1, `finalized`, and the job's one ledger row is that reserve of
  1. The reply is the table's, word for word. 164 s.
- **B3, the move — the page rung, directly.** Routed `layer=page
  page=/the-starter rename=/starter` for 2 (`6,764 in / 27 out`). The stored
  reply names the page layer with `pageOps` `[{page: "/the-starter",
  renamedTo: "/starter"}]`; `exempt`, no ledger row. The reply is the table's,
  word for word: "✅ Moved /the-starter to /starter." 147 s.
- **Second messages.** B2 and B3 each followed a finished job, and each got its
  own job and reply: one job per message, in order. After every reply the
  composer was usable again (busy down, Send drawn and live, no Stop, no
  "Working" row, and a box that took typing). Nothing outside the scenario was
  started (no BLOCKED request), and the page logged 0 console errors and 0 page
  errors.
- **Money closes exactly: 65 → 59 = routing 2 + 1 + 2, plus one edit of 1**, so
  6, under the quoted 7–8. The ledger holds one row for the three jobs (B2's
  reserve); a routing charge writes no row, as recorded.
- **The chain is VERIFIED**: `qwlcka → 4f73ev → pi9qwd → 8btpep`, each built
  from the one before, with the after-read taken at `8btpep`. The versions were
  minted at 00:09:18.987Z, 00:12:10.063Z and 00:14:49.054Z. A separate watch of
  the live site's version header saw them serve at 00:11:44Z, 00:14:24Z and
  00:17:06Z.

**Part C, read by run 39 itself: every stored page is exactly the expected
page, byte for byte.** The expected set was built by hand from the before-read,
the way each rung writes:
- B2: ` focus="top"` inserted just after `<SafeImage` on the boule's element;
- B3: every quoted `"/the-starter"` changed to `"/starter"` on all five pages
  (the route declaration included), and `the-starter.tsx` renamed
  `starter.tsx`;
- B1 changes no page: the logo lives in the stored look.

`index.tsx` goes 2,435 → 2,439 characters (`51b5af6af6ee25ca`); `order.tsx`
(`4ead778eea41faaf`), `gallery.tsx` (`4e8b82aa901741e0`), `visit.tsx`
(`bdb02abecad96c56`) and `starter.tsx` (`37fb0e176f22a44b`) each lose four
characters; there are still no components. The checker was proved on six
controls first: the correct set passes, and a missing reframe, a link left
behind, a collateral word change, the wrong focus value and an unrenamed file
are each flagged.

**The live site, in a real Chromium over TLS-verified live bytes** (before at
00:10:31Z on `qwlcka`, after on `8btpep`):
- the four pages with a header now draw the logo instead of the name, as a
  240×240 image shown at 28×28 with "Harbour Loaf" as its alt text, and **the
  bytes each page loaded are the test image byte for byte** (1,254 bytes,
  sha256 `2cc633d7…4c3df5`). The stored file's name is that hash's first 32
  hex digits, which is how `uploadName` names every upload;
- only the boule photograph moved: object-position `50% 50%` → `50% 0%`. The
  shopfront photograph, the visit page's photograph and the QR code are
  unchanged;
- `/the-starter` answers **301 → `/starter`**, `/starter` answers 200 with the
  same placeholder page, and the sitemap lists `/starter`. Links to
  `/the-starter` went 9 → 0 in the served HTML, and links to `/starter` 0 → 9;
- each page's rendered text, headings and pictures are otherwise identical,
  with 0 console errors, page errors, failed requests or non-OK responses.

**What run 39 establishes**: on one site, through the real app in a real
browser, a picture attached in the composer became the logo byte for byte; a
real model reframed the named photograph and nothing else; a page moved with
every link following and the old address redirecting; and three messages from
one tab each got their own job, reply and working composer. The logo rung, the
picture rung and a page move each published through the queue for the first
time, and the free-rung exemption published twice. **Not established**: a
second message after a hop or a failure, the picture swap, the data and rules
rungs (4b), and the writer's prompt.

**Found, not changed:**
- **The table's B1 row was wrong about the old mark.** It said the header
  would draw the image "instead of today's SVG mark". The old mark was the
  name in plain text; the header's one SVG is the mobile menu icon, before and
  after.
- **The canary's job reader names only one cause for `exempt`.** It prints
  "exempt — a founder account takes no debit and writes no row", and this
  account is not a founder (its routing calls were debited). Here `exempt` is
  the free rung: a step that makes no model call never reserves, so the
  publish exempts its job (the `publish:exempt:ok` mark on the matching
  traces). `billingMeans` in `scripts/canary-read-job.mjs` dates from when
  only a founder was exempt.
- **The logo reply says "on every page"**, and the placeholder page has no
  header, so the logo shows on four of the five. The table predicted this; it
  is a wording note.
- **The message bubble in the thread shows the words and not the attached
  picture**: nothing stores an attachment on a thread message, as recorded.
- **The workspace opened reading "Previewing last saved version"** (the page
  list not loaded yet) and read "5 pages" after the first reply. Every routing
  call carried the site's real page list, the first one included.

**Recovery for 4a — free, with no model call, and verified.** Use step 0's form
exactly: "PUT ONE SAVED VERSION BACK" = `01789969693841-xqi8vs`.
- **Why that version:**
  - every route answered it before Part A, and it is run 37's parent;
  - its first 14 digits mint it at 2026-09-21 05:48:13.841Z, inside run 9's job
    (created 05:47:43Z, published 05:50:09Z);
  - run 9 is the last job on the site;
  - step 0 shows the site's own list carrying it as restorable.
- **What it puts back, read in code** (`restoreVersion`):
  - the pages and components;
  - the look, whole — including the logo mark, since the logo rung stores its
    upload as `look.wordmark`;
  - the stylesheet;
  - the version's own script and head.

  So `/starter` stops answering and `/the-starter` serves again. The uploaded
  logo file stays stored, unused.
- **It survives 4a's publishes.** Pruning keeps the newest 10 builds plus the
  live one and its parent, and 4a makes four publishes (five with a correction
  round).

**4a total:** Part A cost 8 (run 37) and Parts B and C cost 6 (run 39): 14 in
all, against an estimate of about 17–20. The balance is 59 (read 2026-09-27
00:45:33Z). The site keeps 4a's changes; the recovery above undoes them for
free if you want that.

#### Test 4b — the database: D1 alone, built and rehearsed free as run 40; its put-back write made conditional, deployed in 2163 and rehearsed free again as run 41; the paid press passed as run 42 (2026-09-27) and D1 is closed by the owner; D2 and D3 parked; step 0 kept as evidence

**Narrowed by the owner (2026-09-27):** *"separate maintenance from edit-path
acceptance: applying grants through grants-preview does not exercise the rules
rung."* So 4b is now **D1 alone**: one row changed through the real app, and
put back with no model call. **D2** (the grants apply) and **D3** (one real
order under the new grants) are **parked**. They are a maintenance check and an
integration check, and neither closes rules-edit coverage. The rules rung is
the recommended next test, on the candidate site `lido-axes-b`, in the
section after Test 4.

**Free checks already done (2026-09-27, 01:31–01:39Z):**
- **The site's job history** (read-only, `edit_jobs`): its database has had no
  schema change since it was built on 2026-08-21. The one later add-on (run
  51, 2026-09-19) designed a page, a QR code and a photograph, and the add-on
  applies a schema only when it designs a backend. So its client write grants
  are still the table-wide form from before 2026-09-13, and the first schema
  change on it (any rules request, or an add-on with a table) will change more
  than it was asked to.
- **A visitor's read of the data API:** `loaves` answers 200 with six rows (ids
  1–6); the Sea Salt Focaccia is id 6 at 4.5, and no row has a photo. `orders`
  answers 403 (`permission denied for table orders`). Those six rows, as read,
  are D1's record: its fresh baseline is compared with them, and
  `4b-d1-restore` compares a visitor's read with them.
- **The live order page in a real Chromium** (version `8btpep`): it lists the
  six loaves with prices, the focaccia at £4.50. The form was filled and
  submitted with every write blocked inside the browser, so nothing was sent.
  It builds exactly one request: `POST /api/db/fold-lane-bakery/data/orders`
  with an `Idempotency-Key` header and the body `{customer_name, phone, loaf,
  pickup_date, pickup_time}` (the loaf as its id, a number). There is no
  spam-check field and no other column.
- **`grants preview` is the only existing reader of this site's stored schema
  and grants** (`backend repair` is scoped to five other sites). The session's
  dispatch of it answered 403, so step 0 was your press.

**Step 0, kept as maintenance evidence: `grants preview` run
[36286991932](https://github.com/canias7/isibi-app/actions/runs/36286991932)
(#1 in the list), the owner's free press, 2026-09-27 01:55:29Z, from `main` at
`ab74d0d9`.** It read this site's grants and what `grants preview` would do
with them, and met the gate D2 had: `orders` lists exactly the five form
fields under "would grant". **It is not edit-path coverage**: `grants preview`
writes grants directly and never goes through an edit.
- **It wrote nothing.** The env block reads `MODE: preview` and `SLUG:
  fold-lane-bakery`. The apply guard and the rollback download were both
  skipped, and the script's one writing path runs only in apply mode.
- **What it read**, verbatim: `fold-lane-bakery: 2 table(s), 1 carrying a
  table-wide client write`.
  - `ok loaves [read=public write=none] now: (no table-wide write)`.
  - `NEEDS orders [read=none write=anyone] now: anonymous INSERT,
    authenticated INSERT`, and `would grant: customer_name, phone, loaf,
    pickup_date, pickup_time`.
  - No missing-column note, no warning, and `0 site(s) could not be read`.

  **So the columns it would grant are exactly the five the form sends**, no
  more and no fewer.
- **The saved grants** (artifact `grants-before-state`, id 10920728641, 569
  bytes zipped, a 1,980-byte JSON, kept until 2026-12-26). Downloaded and read:
  - `loaves`: SELECT for `anonymous` and `authenticated`, table-level.
  - `orders`: INSERT for both roles, table-level.
  - No column-level grant and no other privilege for either role, so a
    visitor has no UPDATE or DELETE anywhere and no SELECT on `orders`.
- **D2's statements are known before it runs.** The preview records, per
  table, what an apply would issue.
  - `loaves`: `REVOKE ALL` from both roles, then `GRANT SELECT` to both. That
    is the same end state it has now.
  - `orders`: `REVOKE ALL` from both roles, then `GRANT INSERT
    ("customer_name", "phone", "loaf", "pickup_date", "pickup_time") ON
    "orders"` to each.
- **Its rollback is known too.** It was computed offline with the script's own
  `grantsFromAcls` over the downloaded file, with no database involved.
  - `loaves`: the same four statements.
  - `orders`: `REVOKE ALL` from both roles, then `GRANT INSERT ON "orders"` to
    each. That is today's table-wide form, exactly.

**D1 — a row, through the real app: built at `6602be37`, rehearsed free as run 40 (below); the put-back's write made conditional since (below), deployed in 2163, and rehearsed free again on that deployment as run 41 (below), which passed. The owner's paid press passed as run 42 (below), and the owner
closed D1 after an independent review of it (2026-09-27).** A new
scenario of the canary's UI mode, `4b-d1-price`, on fold-lane-bakery. One
message: "In today's bake list, change the Sea Salt Focaccia's price to
£4.60." (68 characters, 69 bytes, sha256 `550cf87497ef7a8f…`).

What the run does, in order:
1. The canary's free checks and its before-read, as on every run.
2. It signs in to the real app in a real Chromium, opens the site's card and
   types the message.
3. **Whether the put-back can be conditional** (added 2026-09-27, below). One
   PATCH of row 6 that no row can meet: `{"$set": {"price": "4.5"}, "$if":
   {"id": 0}}` asks for a row whose id is 6 and 0 at once. It changes nothing
   on any Worker. One with the conditional write runs the UPDATE, matches
   nothing and answers 409 conflict. One from before it finds nothing it can
   write in that body and answers 400 "nothing to update". **A paid run is
   sent only after a 409** (or a 404 if the row is gone). Anything else stops
   it before Send; the rehearsal reports the answer.
4. It reads the order page in a browser tab of its own, whose wall lets only a
   GET out, so the visitor's page can submit nothing. The focaccia's card must
   read £4.50.
5. **The fresh baseline, immediately before Send.** Both readers: the owner
   rows route (what the database holds) and the visitor data route (what the
   site's pages read, kept as text). Both must find row 6, named "Sea Salt
   Focaccia", with the price exactly 4.5. Otherwise nothing is sent and the
   run says why. The proposal's six-row record is compared with the baseline
   too; a difference is reported, not refused.
6. **Send.** The page's wall is a positive list of writes: the routing call,
   and one edit of this site at the `data` layer. Anything else (text, page,
   rules, look, the add-on, a build, the full rewrite, any other write) is
   aborted in the browser, recorded, and fails the run. A misroute costs the
   routing call and changes nothing. (The probe is the canary's own request,
   not the page's, so the wall never sees it.)
7. It waits for the reply, then reads both readers and the order page again.
8. **The recovery, with no model call.** It reads both readers once more, just
   before writing. Only if row 6 still reads exactly 4.6, the value this test
   set, does it write that one field back to the baseline's own value, through
   the owner rows route the Data panel uses, **as a conditional write**:
   `{"$set": {"price": 4.5}, "$if": {"name": "Sea Salt Focaccia", "price":
   4.6}}`. Postgres writes it only if, when the write runs, row 6 is still
   named that and still reads the value just read. Then it reads both readers
   and the order page back.

What the recovery refuses rather than writes:
- A value nobody here set (4.7, say, from a concurrent change), a missing row,
  or a row no longer named "Sea Salt Focaccia". Said, and nothing is written.
- Every other difference (another field, another row, a row added or gone).
  Reported, and never written back.
- A reply that never came. The job may still be writing, so the recovery is
  skipped and the run says to press the recovery scenario once the job has
  finished.
- **A write that lands between the recovery's read and its own write.** The
  recovery's write is conditional (below): Postgres writes the price only if,
  when the write runs, row 6 is still "Sea Salt Focaccia" and still reads
  the value the recovery just read. Otherwise nothing is written, and the run
  says CONFLICT and fails. It is never retried and never called restored.
  (This bullet used to record the gap as a limit; the owner reproduced it and
  had it closed, 2026-09-27.)

The checks (each one fails the run):
- **The exact request:** the routing call carries the message byte for byte;
  there is exactly one edit POST, at the `data` layer, with the same
  instruction.
- **The customer's reply, on the screen:** "✅ Updated one entry in loaves."
- **The job's stored reply:** `ok`, layer `data`, and `applied` exactly
  `[{table: "loaves", id: 6, columns: ["price"]}]`, with no files, no reorder
  and nothing failed.
- **The database change, on both readers:** row 6's price from 4.5 to 4.6,
  and nothing else.
- **The order page:** the focaccia's card at £4.60, and every other card as it
  was.
- **Nothing published:** no version in the chain, the job row's publish fields
  empty, and every route still on the before-read's version.
- **The money:** the balance moves by exactly the routing charge plus the
  job's own cost. The job is `finalized` with ledger debits equal to its cost
  and no refund (or `exempt` with no ledger row).
- **The condition probe:** the Worker answered the write no row can meet with
  409 conflict (or 404 for a row that is gone), and nothing changed.
- **The recovery:** the conditional write answered 200, said its condition
  held (`conditional: true`), and changed that one field alone; there was no
  conflict; the target row equals its baseline on both readers, and the
  visitor body byte for byte; the order page is back to every line it had.

**The recovery alone: `4b-d1-restore`.** For a run that could not finish its
recovery. It opens no app and sends no message. It reads the row; with spend
`yes` it writes the price back to 4.5 only if it reads 4.6 (in the type the
owner route reads it as), with the same condition as the automatic recovery,
and with spend `no` it only says what it would write. It compares the visitor
read with the proposal's record and reports any difference without writing
it. It asks the condition probe first too, and never sends its write to a
Worker that cannot enforce the condition.

**Evidence, none of it live:**
- `test/canary-rows.test.mjs` (17 cases, new): the decisions. They cover the
  price as a decimal ("4.60" is 4.6), the row lists, the fresh baseline, the
  change, the recovery's plan, the write's own answer, the restore verdict,
  both recovery paths over a supplied table (a concurrent 4.7 refused, another
  row's change kept), and the page's lines.
- `test/canary-ui.test.mjs` (22 → 37 cases): the scenario's facts, the wall,
  and the request, reply, money and nothing-published checks. Then the whole
  run through the driver, with a stand-in page and a supplied database:
  - the paid path: the page and both readers read with nothing between them
    and Send, then exactly one PATCH, `{price: "4.5"}`, after the Send;
  - the rehearsal, each baseline refusal, a concurrent change refused, another
    row's change kept, and a reply that never came;
  - the recovery scenario: a dry run, a write, nothing to do, a refusal, and
    the visitor tab's GET-only wall.
- **Probes** (`scripts/mutants/canary-rows.json`): 52 mutants, 52 killed, 0
  never applied, 3 comment-only controls surviving. They ran over the four
  changed files against seven test files, and the files were byte-identical
  afterwards. The first run left two survivors: `changeVerdict` ignoring the
  value a change started from, and `restored` asking the owner route alone.
  Both were fixtures too shallow to tell the readings apart, and one assertion
  each killed them.
- **The full suite, locally:** 8,073 tests, 8,071 pass, 0 fail, 2 skipped;
  +32, exactly the new cases.
- **Unit CI** (run 36290449793 on `6602be37`): 8,073 / 8,069 / 0 / 4 skipped.
  The total matches, and `pass` differs by CI's four skips. All 54 cases of
  the two files pass by name, with 8,073 distinct result numbers, no gap and
  no `not ok`. No site build fires, since none of the files is on its paths.
- **A local proof in a real Chromium** (scratch, not committed): the live
  app's code and the live order page's code, fetched with GET only, with every
  API answer and the `loaves` table supplied in memory. Six modes: paid,
  rehearsal, a misroute, a hang, a recovery dry run and a recovery write. Each
  behaved as described above, and no request but a GET left for the network.

**Not established until a live run** (written before the press): which layer
the router picks for this sentence, the data rung's real answer, and the live
database. Run 42 established all three, for this sentence on this site
(below).

**The free rehearsal ran as run 40 and passed** (`36291812275`, 2026-09-27
03:34:40 → 03:36:03Z; the owner's press from the branch at `95eb36da`; canary
step 38 s):
- **The env block:** spend 0, scenario `4b-d1-price`, site fold-lane-bakery,
  control washhouse-3; the instruction, job and version boxes blank; both
  expectations set.
- **The preflight:** build-health and runtime both answered `ab74d0d94384`
  with image `369d7b1e5bae25b0`; async and runner true; both readers agreeing.
  The zero-cost confirmations passed. Their two jobs are `failed`, billing
  `none`, cost 0, and published nothing.
- **The before-read:** complete (`reads` all true), every route on
  `01790468089054-8btpep` (run 39's last publish), and all five page bodies
  byte-identical to run 39's after-read, with no U+FFFD.
- **The app:** signed in as the building account, and the site's card opened.
  The message was typed and not sent (`ui-step-1-rehearsal.png`). The page
  made three GETs (the site list, the credits and the page list) and nothing
  else: 0 blocked, 0 console errors, 0 page errors.
- **The order page**, at `8btpep` in its GET-only tab, showed six cards,
  including "Sea Salt Focaccia £4.50 · A tray bake, heavy on the oil, finished
  with flaky salt."
- **The fresh baseline at 03:35:57.388Z:** six rows on both readers, and row 6,
  "Sea Salt Focaccia", at 4.5 on both.
  - **The owner route reads the price as a JSON number**, so the recovery will
    write the number 4.5 back. The unit cases drove the string form too.
  - The visitor read (1,045 bytes, sha256 `ef870ebcf8353634`) equals the
    proposal's six-row record.
- **The recovery's plan at the baseline:** none (`at-baseline`). The balance
  read 59 → 59.
- **Checked again by the session afterwards** (03:42Z, read-only):
  - the visitor route answers the same 1,045 bytes, sha256
    `ef870ebcf8353634`, with the focaccia at 4.5;
  - `/` and `/order` answer `01790468089054-8btpep`;
  - `edit_jobs` since 03:00Z holds only the two confirmation jobs;
  - `credit_events` has no row after run 39's reserve at 00:12:09Z;
  - the balance row reads 59.
- **So the paid press starts from an established before-state.** It is the same
  form with spend `yes`.

**The recovery's write is conditional (2026-09-27; closed by the owner after
review, and merged and deployed in deploy 2163).** The owner, after run 40: *"restoreRow/recoverRow read the price,
then call an unconditional owner PATCH. site-owner.mjs updates WHERE id=?
only. Reproduced locally: Recovery reads 4.6. Another writer changes the price
to 5.2 before PATCH executes. Recovery overwrites it with 4.5 and reports
restored. Make the recovery's expected-value check and write atomic … A
conflict must change nothing and be reported explicitly. Another pre-read does
not close this gap."*
- **Reproduced first**, through the real route, in both recoveries. A second
  writer set 5.2 after the recovery's read; the plain PATCH wrote 4.5 over it,
  and the account said RESTORED. On a real PostgreSQL 16 the plain statement
  did the same when the other write had committed first, and also when the
  other write held the row while the recovery's UPDATE waited.
- **The fix is in the owner rows route** (`site-owner.mjs`, which is Worker
  code). A PATCH body `{"$set": {…}, "$if": {…}}` becomes ONE statement:
  `UPDATE … SET … WHERE id=? AND "col" IS NOT DISTINCT FROM ? … RETURNING *`.
  Postgres judges the condition against the row as it stands when the write
  runs, so there is no window between a check and a write for another write to
  land in. The answers:
  - the row matched: 200, the row, and `conditional: true`;
  - the row no longer matched: nothing written, 409 `code: "conflict"`, with
    the row as read afterwards (that read decides nothing);
  - the row is gone: 404;
  - a malformed form: 400 `bad_condition`, before any statement. That covers
    an extra key, a condition on a column the table lacks, a `$set` key the
    route would drop, a value that is not a string, number, boolean or null,
    and an empty condition.
  - The plain PATCH is unchanged.
- **A Worker from before the form can refuse it, and can never make it
  unconditionally.** `$` never begins a column name, so such a Worker finds
  nothing it can write in the body and answers 400 "nothing to update" before
  any statement. This was measured by running the unfixed route itself
  (`HEAD`'s `site-owner.mjs`) on the recovery's body and the probe's: 400 and
  no statement, both times. A plain body, as a control, wrote.
- **The values go untyped, as the Neon driver sends them**, so Postgres casts
  each to its column's type: `'4.6'` matches a REAL 4.6 and a NUMERIC 4.60. A
  float8-typed 4.6 never matches a REAL 4.6 (measured).
- **The canary.** Both recoveries send `{"$set": {"price": <the baseline>},
  "$if": {"name": "Sea Salt Focaccia", "price": <the value just read>}}`.
  - A 409 is a CONFLICT: it gets its own line in the account, the check "no
    other write changed the row between the recovery's read and its write"
    fails, the final state reads NOT RESTORED, and nothing is retried.
  - A 200 without `conditional: true` is not taken as the recovery's write.
  - RESTORED is said only after a write that landed. A row back at its
    baseline because somebody else wrote it reads "AT BASELINE, but NOT by
    this recovery".
- **The probe, before anything changes.** It sends the write no row can meet
  (the row's own id and the id 0 at once). A Worker with the form answers 409
  (or 404 for a row that is gone) and changes nothing; one without it answers
  400.
  - The paid run is not sent unless the probe answered 409 or 404 (a
    "condition" stop).
  - `4b-d1-restore` never sends its write then.
  - The rehearsal reports the answer, and its check fails.
  - The probe is a write REQUEST to the live owner route that matches no row.
    On a real PostgreSQL the table's hash and the row's `xmin` are unchanged
    after it. The engine creates only row-level triggers, so an UPDATE of no
    rows fires none.
- **On a real PostgreSQL 16** (`test/integration/local-pg-owner-cas.mjs`, run
  by hand, not in CI). It uses the statement the real route builds, with
  placeholders converted by the real `toPgPlaceholders`/`pgParams` and the
  parameters sent untyped through psql's `\bind`, on REAL and NUMERIC
  columns. The control lands. A 5.2 committed before the write: UPDATE 0, and
  5.2 kept. Another transaction holding the row and committing 5.2 while the
  conditional write waits on its lock: UPDATE 0, and 5.2 kept. The plain
  statement overwrites in both cases. A concurrent change to another field:
  the price is written and the other field kept. A renamed row: nothing
  written. The probe: UPDATE 0, nothing changed.
  - **17 of 17 pass** on the final files. The conditional write waited
    1,491–1,504 ms on the other transaction's lock, then matched nothing.
- **Tests** (every competing write lands immediately before the owner route's
  UPDATE runs, through the real route over an in-memory table,
  `test/fixtures/owner-table.mjs`, new):
  - `test/site-owner.test.mjs`, 63 → 70 cases: one statement carrying every
    condition, conflict, gone, null and `id` conditions, the declared column
    name, every malformed form refused before any statement, and the plain
    PATCH unchanged.
  - `test/canary-rows.test.mjs`, 17 → 27: both recoveries against a
    competing write on NUMERIC and REAL columns, a row renamed or deleted, a
    competing write that puts the value back first, a change to another
    field, a Worker from before the form, a 200 that does not say its
    condition held, and the probe.
  - `test/canary-ui.test.mjs`, 37 → 41: the paid run's recovery and the
    standalone recovery with a competing write, a Worker without the form
    (the paid run sends nothing, the recovery writes nothing, the rehearsal
    reports it), and a probe whose transport throws.
- **Red on the unfixed product** (a worktree of `3e0c8d7e`, with only the new
  test files and fixture copied in, and the probe's two helpers appended so
  they load): **33 cases fail**, 6 of 70 in `site-owner`, 16 of 27 in
  `canary-rows` and 11 of 41 in `canary-ui`. Every race case fails on the
  overwritten value, "4.5 !== 5.2". The two UI race cases fail first on the
  request's shape; with that assertion cut, they fail on the overwritten
  value too.
- **Probes** (`scripts/mutants/owner-cas.json`): 37 mutants, 37 killed, 0
  survived, 0 never applied, 3 comment-only controls surviving. They ran over
  the four changed files against 13 test files, and the files were
  byte-identical afterwards.
  - The first run left one survivor. C-6 skipped an unknown column in the
    condition instead of refusing it. Alone, such a column also leaves no
    condition, so it was refused anyway; one case now puts it beside a known
    column, where skipping it would write on less than was asked.
  - D1's own spec (`scripts/mutants/canary-rows.json`, three mutants
    re-anchored to the new lines) re-ran over the final files: 52 of 52
    killed, 3 controls surviving.
- **The full suite, locally:** 8,094 tests, 8,092 pass, 0 fail, 2 skipped;
  +21 against 8,073, exactly the new cases.
- **Unit CI** (run 36294546760 on `5c000598`): 8,094 / 8,090 / 0 / 4 skipped
  (`duration_ms` 127,100). The total matches, and `pass` differs by CI's four
  skips. All 138 cases of the three changed files pass by name, with 8,094
  distinct result numbers, no gap and no `not ok`.
- **`site build`** (run 36294546743 on `5c000598`, 04:31:19 → 04:57:03Z,
  25m44s; all twenty steps green): TAP 397/397/0/0, kit-typecheck 4,
  site-build 404, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47, and kit-render / kit-a11y / kit-effects /
  kit-paint all passed; census 7 + 4 + 1 = 12. The only `##[error]` lines are
  the two known annotations. `site-build.mjs` took 18m43s.

**The order, because the fix is Worker code.** The paid press could not run
on deploy 2162: its route had no conditional write, so the probe answered 400
and the paid run stopped before Send. What it needed, in order:
1. **The owner's approval to merge and deploy — given and done (2026-09-27).**
   The owner closed the correction after review (165 focused tests, the
   product commit's unit CI and site build green): *"Once the current tip's CI
   passes, merge and deploy the reviewed changes, preserving any newer main
   commits."*
   - **Checked before the push:** unit CI on the tip `14df0225` (run
     36295887583) read 8,094 / 8,090 / 0 / 4; no workflow run in progress,
     queued, waiting or requested; no edit job in a live state; main unmoved
     at `ab74d0d9` and an ancestor of the tip, so nothing newer on main could
     be lost.
   - **Predicted, and re-read over the merged tree:** main (`ab74d0d9`)
     answered `369d7b1e5bae25b0`, the image runs 35 and 40 read live; the tip
     `14df0225` answered **`9038e90ab1d5d7fe`**, from 188 inputs and 158
     distinct paths, `site-owner.mjs` the only input among the 21 files.
   - **A rollback is clean:** reverting `ab74d0d9..14df0225` (17 commits) in a
     throwaway worktree gives tree `61271c36…`, main's own, so a rollback
     reuses `369d7b1e5bae25b0`.
   - **A fast-forward:** main `ab74d0d9` → **`14df0225`** at 05:11:56Z.
   - **Deploy 2163 ([run 36296506076](https://github.com/canias7/isibi-app/actions/runs/36296506076)),
     success, 05:12:02 → 05:15:03Z**, read off its own log: `DEPLOY_ID`
     `14df0225be90…` (masked in the log as `***4df0225be90e…`); the gate took
     over from `ab74d0d9…`; the image **built `9038e90ab1d5d7fe`** (the
     registry answered 404, 188 inputs, 0 cached layers, 2m10s) and **rolled
     from `369d7b1e5bae25b0`** under `SUCCESS Modified application`; the drain
     found no live leases; `No updated asset files to upload`, so there is no
     served-file check; a fresh Worker version. Gates 401 / 401 / 401 / 404 at
     05:15:42Z.
   - **Runtime-confirmed by the rehearsal, run 41** (below). The log above is
     the deploy reporting on itself; run 41's preflight read the live Worker's
     own sha (`14df0225be90`) and a cold container's image
     (`9038e90ab1d5d7fe`), both readers agreeing.
   - **The hold:** the image rolled at 05:15Z, so the rehearsal waited until
     05:31Z. The session's one dispatch attempt then (05:31:35Z, from `main`,
     spend `no`, both expectations set) answered **403 Resource not
     accessible by integration**, so the rehearsal was the owner's press. It
     was not retried.
2. **A fresh free rehearsal with the new identifiers — done: run 41 passed**
   (below). It made one PATCH that changes nothing, the probe, and the new
   route answered 409.
3. **The paid press**, the same form with spend `yes` — **done: run 42
   passed** (below).

**Ready-to-run inputs.** [`edit canary`](https://github.com/canias7/isibi-app/actions/workflows/edit-canary.yml)
→ Run workflow → **branch `main`**. Since the merge, main carries the UI mode
and both D1 scenarios, so the script, the Worker and the image it checks are
all main's. The boxes, by their descriptions:

| Box | Rehearsal (free) | The paid press |
| --- | --- | --- |
| Run the ONE paid edit as well (yes/no) | `no` | `yes` |
| What to change. REQUIRED when spend=1… | blank | blank |
| READ ONE EXISTING JOB AND STOP… | blank | blank |
| PUT ONE SAVED VERSION BACK… | blank | blank |
| RUN A NAMED SCENARIO IN A REAL BROWSER… | `4b-d1-price` | `4b-d1-price` |
| The site to edit… (defaults to `fretwork-1`) | **`fold-lane-bakery`** | **`fold-lane-bakery`** |
| A second site… | leave `washhouse-3` | leave `washhouse-3` |
| Refuse to spend unless the Worker reports this deploy sha… | **`14df0225be90e2637764ea33771d64f4a393b628`** | the same |
| Refuse to spend unless a cold container reports this image id… | **`9038e90ab1d5d7fe`** | the same |

- **The rehearsal** signs in, opens the card, types the message, asks the
  probe, reads the order page and the baseline, prints the recovery's plan at
  the baseline ("none"), and stops before Send. It changes nothing and spends
  nothing. **Its one write request is the probe**, which matches no row.
- **What the rehearsal must show:**
  - the preflight reads `14df0225be90` and `9038e90ab1d5d7fe` on both readers;
  - `condition  the Worker writes only while the row still matches: a
    conditional write no row can meet answered 409 and changed nothing`;
  - the baseline, read AFTER the probe: row 6, "Sea Salt Focaccia", 4.5 on
    both readers, and the visitor read byte-identical to the record (1,045
    bytes, sha256 `ef870ebcf8353634`);
  - the order page shows the focaccia at £4.50;
  - the recovery's plan at the baseline is "none";
  - the balance does not move.
- **The paid press** is the same form with spend `yes`.
- **If the paid run ends without its recovery**, press `4b-d1-restore` with the
  same boxes: first with spend `no`, to see what it would write, then with
  spend `yes`. It asks the probe too.
- **A conflict is not retried.** If another write lands between the
  recovery's read and its write, the run says CONFLICT, fails, and leaves the
  row as that write left it. Pressing `4b-d1-restore` then reads the row again
  and writes only if it reads 4.6.

**The fresh rehearsal ran as run 41 and passed** ([`36297687383`](https://github.com/canias7/isibi-app/actions/runs/36297687383),
2026-09-27 05:36:23 → 05:37:44Z; the owner's press from `main` at `14df0225`;
canary step 38 s):
- **The env block:** spend 0, scenario `4b-d1-price`, site fold-lane-bakery,
  control washhouse-3; the instruction, job and version boxes blank; both
  expectations set.
- **The preflight, deploy 2163's runtime confirmation:** build-health and
  runtime both answered `14df0225be90` with image `9038e90ab1d5d7fe`; async and
  runner true; both readers agreeing; both expectations matched. The zero-cost
  confirmations passed (both sites got the async shape, a forged replay and a
  stranger's poll answered 404, and the free job settled in ~8 s at cost 0).
  Their two jobs are `failed`, billing `none`, cost 0, and published nothing.
- **The before-read:** complete (`reads` all true), every route on
  `01790468089054-8btpep`, and all five page bodies byte-identical to run 40's
  before-read, with the same path set and no components. The control: against
  run 39's BEFORE-read the same comparison differs on every page.
- **The app:** signed in as the building account, the site's card opened, and
  the message typed and not sent (`ui-step-1-rehearsal.png` shows it in the
  composer over an empty thread). The page made three GETs (the credits, the
  site list, the page list) and nothing else: 0 blocked, 0 console errors,
  0 page errors.
- **The probe:** `capability: enforced`, status **409**. It runs first: the
  code's order is the probe, then the order page, then both readers
  (`scripts/canary-ui.mjs`), so everything below was read after it.
- **The order page** (05:37:28Z, at `8btpep`, in its GET-only tab): six cards,
  including "Sea Salt Focaccia £4.50 · A tray bake, heavy on the oil, finished
  with flaky salt."
- **The fresh baseline at 05:37:39.318Z:** six rows on both readers, the two
  lists equal, and row 6, "Sea Salt Focaccia", at 4.5 on both (a JSON number on
  the owner route). The visitor read is 1,045 bytes, sha256
  `ef870ebcf8353634`, byte-identical to run 40's and equal to the proposal's
  record.
- **The recovery's plan at the baseline:** none (`at-baseline`). The balance
  read 59 → 59.
- **Checked by the session afterwards** (05:46–05:48Z, read-only):
  - the visitor route answers the same 1,045 bytes, byte-identical to the
    05:16Z read and to run 40's, with the focaccia at 4.5;
  - `/` and `/order` answer `01790468089054-8btpep`;
  - a real Chromium, GET only, reads the same six cards on `/order`, the
    focaccia at £4.50, with no page errors;
  - the balance row reads 59 (05:48:40Z), `credit_events` has no row after
    run 39's reserve at 00:12:09Z, and `edit_jobs` since 05:30Z holds only the
    two confirmation jobs.
- **So the paid press starts from an established before-state on the deployed
  code.** It is the same form with spend `yes`, and it is the owner's call.

**The paid press ran as run 42 and passed** ([`36298962234`](https://github.com/canias7/isibi-app/actions/runs/36298962234),
2026-09-27 06:03:09 → 06:05:06Z; the owner's press from `main` at `14df0225`;
canary step 77 s). Everything below is read off the run's log and its
evidence artifact, then checked again by the session, read-only.
- **The env block:** spend 1, scenario `4b-d1-price`, site fold-lane-bakery,
  control washhouse-3; the instruction, job and version boxes blank; both
  expectations set.
- **The preflight:** build-health and runtime both answered `14df0225be90`
  with image `9038e90ab1d5d7fe`; async and runner true; both readers agreeing;
  both expectations matched. The zero-cost confirmations passed. Their two
  jobs are `failed`, billing `none`, cost 0, and published nothing.
- **The before-read:** complete (`reads` all true), every route on
  `01790468089054-8btpep`, and all five page bodies byte-identical to run 41's
  before-read. The control: against run 39's BEFORE-read the same comparison
  differs on every page.
- **Before Send**, in the code's order:
  - **The probe** answered **409** (`enforced`).
  - **The order page** (06:04:04Z, at `8btpep`) showed the focaccia at £4.50.
  - **The fresh baseline** (06:04:11.393Z): six rows on both readers, and row
    6 at 4.5 on both. The visitor read is 1,045 bytes, sha256
    `ef870ebcf8353634`, equal to the proposal's record. The recovery's plan
    at the baseline: none.
  - **The balance** read 59, so the budget check let the message go.
- **The request:**
  - The message left word for word.
  - The routing call answered `intent=edit layer=data`, cost 2 (`6,774 in /
    15 out`, 512 cached). It was sent the site's five pages and `tables: []`,
    which is what a browser sends for a site it adopted off the list, so the
    router picked `data` with no table names to go on.
  - Then exactly **one** edit POST, 202, at the `data` layer, with the same
    instruction: job `dfb7ca810fa2469395917b315c5db71f`.
  - Nothing else was started: 0 blocked, 0 console errors, 0 page errors.
- **The reply**, 36 s after Send: "✅ Updated one entry in loaves." (the
  scenario's expected sentence). The composer came back usable: not busy,
  Send live, no Stop button, no "Working" row, and the box took typing.
- **The stored reply** (200 under `x-gf-edit: final`):
  - `ok`, layer `data`, cost 1 (`1,370 in / 37 out`, 512 cached, one call);
  - `applied` exactly `[{table: "loaves", id: 6, columns: ["price"]}]`, and
    `failed: 0`.
- **The job row:**
  - `done`, billing `finalized`, cost 1;
  - created 06:04:24.140Z and settled 06:04:40.986Z;
  - `publish_started_at` and `published_at` empty.
  - The trace candidate ended 06:04:40.527Z after 11,769 ms, ok.
- **The database change, on both readers** (06:04:50.360Z): row 6's price
  4.5 → 4.6, and nothing else. No other field or row changed, and no row was
  added or removed. The visitor body is still 1,045 bytes and differs from
  the baseline in exactly one character, the `5` of `"price":4.5` (sha256
  `f939ed91502d913f`).
- **The order page after the edit** (06:04:50Z, at `8btpep`): the focaccia at
  **£4.60**, and the other five cards as they were.
- **The recovery**, with no model call:
  - It read both readers again at 06:04:52.968Z (4.6) and planned a patch
    (`reads-what-this-test-set`).
  - `PATCH /rows/loaves/6 {"$set":{"price":4.5},"$if":{"name":"Sea Salt
    Focaccia","price":4.6}}` answered **200**, with the route's `conditional:
    true` (the canary refuses a 200 without it) and the row back at 4.5.
  - There was no conflict.
  - **This is the first live conditional write that matched.** Run 41 showed
    the other side: a write no row can meet answered 409.
- **Restored** (06:04:53.484Z):
  - the row equals its baseline field for field on both readers;
  - the visitor body is byte-identical to the baseline (`ef870ebcf8353634`);
  - the order page is back to every line it had, the focaccia at £4.50.

  So the site showed £4.60 for seconds, not minutes: from the job's write
  (inside 06:04:24–06:04:41Z) to the put-back at 06:04:53Z.
- **Nothing published:**
  - no version names the job, and the job row's publish fields are empty;
  - the after-read (06:04:58Z) found every route still on `8btpep`, and the
    chain reads VERIFIED;
  - the five route pages are identical to the before-read once render times
    are masked (the control: a one-word change is seen);
  - the stored bodies are identical.
- **The money closes exactly: 59 → 56 = routing 2 + edit 1**, at the top of
  the 2–3 estimate. `credit_events` holds one row for the job, `reserve −1`,
  `balance_after 56`, ref `<job>#1`, at 06:04:40.179Z, and no refund. The
  routing charge writes no ledger row. The reserve's `after 56` puts the
  balance at 57 just before it.
- **Checked by the session afterwards** (06:13–06:17Z, read-only):
  - the balance row reads 56 (06:13:03Z);
  - `credit_events` since midnight holds only run 39's reserve and run 42's;
  - `edit_jobs` since 05:50Z holds only the two confirmation jobs and run
    42's job;
  - the visitor route answers 1,045 bytes, byte-identical to run 41's
    reading, with the focaccia at 4.5 (06:16:34Z);
  - all five routes answer 200 on `8btpep`;
  - a real Chromium, GET only, reads the same six cards on `/order` as after
    run 41, with the focaccia at £4.50, no page errors and no request but a
    GET (06:16:55Z).
- **What it established, for this sentence on this site:**
  - the router picks `data`;
  - the data rung changes exactly the one field on the live database, and its
    `applied` report matches the database;
  - the order page reads the new value at once, with no publish;
  - the reply and the composer behave;
  - the recovery's conditional write lands and puts the one field back.
- **What it did not establish:**
  - adding, removing or reordering rows;
  - a data edit on an `incomplete` site;
  - the rules rung;
  - the router's handling of any other wording.

**Cost, estimated before the press:** about 2–3 credits. That is the routing charge (1–2; run 39's three
routing calls cost 2, 1 and 2) plus the data rung's one call, rounded once
with a floor of 1. **That figure is an estimate, not a cap.** The scenario's
budget of 5 is checked only before a message is sent: `budgetRefusal` refuses
to send when the spend since the run began is already 5 or more, or when the
balance cannot be read. D1 sends one message, so the check cannot stop
anything, and it never caps what that one request costs. Nothing on the server
caps it either (`edit_reserve` refuses only above 100,000), so the balance is
the only bound. The rehearsal, the recovery and
`4b-d1-restore` are free. The balance was 59 before run 42 (read by run 41 at
05:37:23Z, on the balance row at 05:48:40Z, and by run 42 at 06:04:00Z).
**Measured on run 42: 3 credits**, routing 2 and the data rung's 1, at the
top of the estimate. The balance is now **56** (read by run 42 and on the
balance row at 06:13:03Z; the last ledger row is run 42's reserve at
06:04:40Z).

**D2 and D3 — parked (owner, 2026-09-27).** Kept prepared, not scheduled:
- **D2** is `grants preview` in `apply` mode on fold-lane-bakery, undone by its
  `rollback` mode with step 0's run ID (36286991932), within the artifact's 90
  days (until 2026-12-26). It is maintenance: it moves the site's grants to
  the column-scoped form every site now gets. What it would issue, and its
  rollback, are in step 0's record above.
  - A green run is not its check. A refused statement is logged as `REFUSED`
    and the verify after it as `FAIL`, but nothing sets an exit code, so the
    lines are the check.
  - The rollback box's description says "the run number", but it needs the run
    ID (36286991932, not 1).
  - After a correct rollback, `verify` reads `FAIL`, so the check is another
    `preview`, whose lines and recorded grants must equal step 0's.
- **D3** is one real order under those grants, from a real browser session.
  It is an integration check of the order form.
- **Neither exercises the rules rung, and neither closes rules-edit
  coverage.**
- **The rows scenario the proposal named `4b-rows-back` is not built.** D1's
  own recovery and `4b-d1-restore` do its row half, bounded to the one field
  D1 changes; its order-deletion half belonged to D3.

**Found on the way, not changed:**
- The Data panel's Save turns an empty (NULL) field into an empty string,
  because it sends every field as text. D1's recovery writes only the changed
  field for that reason.
- The API canary treats any successful edit reply as a publish, so for a data
  edit its page comparison would read `not-listed`. D1 runs through the UI
  mode, whose chain handles an edit that publishes nothing.
- ~~The owner rows route has no conditional write.~~ It has one now, deployed
  in 2163: *the recovery's write is conditional*, above.
- **The data rung's reply names the table, not what changed** (run 42). The
  customer asked for "the Sea Salt Focaccia's price" in "today's bake list";
  the screen said "✅ Updated one entry in loaves." The composer builds the
  sentence from `applied`, which carries only the table, the row id and the
  column names, so it cannot say which loaf or the new price. The sentence is
  true. This is recorded for the model-written replies preference and not
  changed. **The owner kept it there when closing D1, not reopened.**

**What Test 4 does not cover:** hydration, translation, model-written replies,
the add-on, a css-lane run, a page removal (the move exercises the same verb
and publish path), a hop between rungs, why a quick attempt did not publish,
and the rules rung (the recommended next test, next).

### The rules rung — the recommended next test, revised (2026-09-27; the harness built on the branch at `ebf53761`; its paid press passed as run 44; closed by the owner)

Owner, first: *"Prepare a separate rules-test proposal using an isolated fixture
or complete deterministic recovery."* Then: *"For the rules test, compare the
smallest isolated fixture against your proposed database restore approach.
First check whether an existing disposable fixture can avoid buying another
build. Do not implement a whole-database restore or run it against an active
site yet."* Then, on the first version of this section: *"Correct the fixture
claim. build-as-owner.yml uses “spent” to mean the slug was already claimed,
not that the site is disposable; it also says the comparison sites are kept."*
And: *"A GET on bookings already returns 403 before the change, so that is not
evidence that submitting bookings became forbidden. Include a valid booking
submission through the real visitor route after the rules edit, capture the
actual refusal, and confirm no row was inserted. Prepare exact cleanup and
account for notification side effects if the rule fails and the submission
succeeds. State separately whether baseline submission behavior was actually
measured."*

**Why it needs its own test.** A rules edit ends in one `applySiteSchema` over
the whole merged spec. Besides the rule asked for, that apply:
- rewrites the stored schema (`_meta`);
- drops and re-creates every table's policies;
- re-creates the helper and trigger functions;
- re-issues every table's grants.

On a site built before 2026-09-13, it also carries every engine change since.
Five rules cannot be taken off through an edit: `unique`, `uniqueci`,
`noOverlap`, `oncePerUser` and `maxRows`.

**The apply runs its statements one at a time and logs a failed one rather
than stopping.** So a "✅" in the reply does not prove the rule took effect. A
real booking being refused, and the grants read afterwards, do.

**The three ways, compared**

| | `lido-axes-b`, an existing site (a candidate) | A new throwaway site | Rewinding fold-lane-bakery's database (Neon's point-in-time restore) |
| --- | --- | --- | --- |
| Build credits | 0 | about 27–62 (a page build of 11–45, then an add-on that designs a table, about 12–13) | 0 |
| The rules test | about 3 | about 3 | about 3–4 |
| New tooling | a scenario with one visitor booking, and a no-publish check for the older page layout | a scenario with one visitor booking | a restore tool, and a rehearsal on a throwaway Neon project |
| Touches a site anyone uses | its pages, no; its database, yes (the owner's kept comparison site) | no | yes: it rewinds a live site's whole database |
| Afterwards | its database stays changed either way (bookings closed, or reopened in today's grant form), so it needs the owner's approval to repurpose it | the product's own delete | the restore, itself undoable through Neon's backup branch |
| An older site's first schema change | yes | no: a new site starts on today's grants | yes, then undone |

**`lido-axes-b` is a candidate, not a disposable site.** The first version of
this section called it a throwaway that its workflow calls "spent". That
misread the workflow.
- `build-as-owner.yml` says: "`lido-axes-b`, `lido-free-a` and `lido-cafe` are
  all spent — a slug is claimed by whoever builds it first, and ownership is
  what decides `revise`, so naming any of them again would be read as an edit
  of a husk rather than a fresh build." So "spent" means its name cannot be
  built fresh again. It says nothing about the site being disposable.
- The same file keeps it: "THE PREVIOUS TWO ARMS, KEPT because the comparison
  rests on them." Arm B (`lido-axes-b`) and arm A (`lido-free-a`) were built
  from one brief, and the comparison is a rule-level diff of their two
  stylesheets.
- **The test must leave that evidence as it is**, and checks it byte for byte:
  - the published stylesheet `/assets/index-glpAegzo.css`, 209,105 bytes,
    sha256 `6f7ca4bc53e559a7`, the one sheet on all three pages;
  - the three pages, each at `x-site-build: mt50cg7h-l19hre` with no version
    header (all read 07:24Z);
  - the stored source.

  A rules edit publishes nothing, so all three should stay as they are.
- **What the test changes for good is the database.** It would be this older
  site's first schema change, and the apply re-issues every table's grants in
  today's column-scoped form. Afterwards `bookings` is either left closed or
  reopened with a second rules message. Neither end state is today's database,
  and there is no restore.
- **So leaving bookings closed repurposes the site's database, and needs the
  owner's explicit approval** (item F below). Without it, the test does not run
  on `lido-axes-b`, and the fallback is a new site built for the test.
- **The rest, read-only on 2026-09-27**:
  - it is the owner's (the building account);
  - it has its own Neon project, and its database reference is present;
  - it has 0 edit jobs and 0 other addresses (re-read 07:25Z);
  - nothing in the repository's tests or tools reads it.
- **The other candidates, rejected**:
  - `lido-free-a`: its `/book` page does not load, and it is arm A of the same
    comparison;
  - the other lido copies: they answer 404;
  - `pierhead-lido` and `the-lido-cafe`: scripts and tests read them;
  - `repairbench-1`: it is the add-on bench, with scheduled jobs of its own.
- **A free new fixture cannot work.** A schema-only build (`{schema, slug}` and
  no brief, as `member-smoke` uses) gets a database for no model spend. But it
  publishes only a placeholder with no stored pages, so the app has no page
  list to route with and stops before sending, and the API canary refuses too.

**What a booking sends, read from the live page's own code (2026-09-27).**
- `/book` sends `POST /api/db/lido-axes-b/data/bookings` with a JSON body of
  exactly five fields:
  - `name` (two characters or more);
  - `phone` (six or more; the field's own placeholder is "07700 900123");
  - `party_size`, a number from 1 to 8;
  - `booking_date`, today or later;
  - `booking_time`, one of 15 half-hour slots from 10:00 to 17:00.
- It sends no idempotency key, so a repeated press could book twice. The test
  presses once and never retries.
- It asks for no row back, so a new row's id has to come from the owner's view
  of the table.
- It loads no bot check: the site's `/api/db/lido-axes-b/turnstile` answers
  `{}` (07:24Z).
- A booking that goes through shows "Table held — see you by the water." and
  then "We've got your table". A refused one shows its error as a pop-up, and
  this page turns Postgres's `42501` into "That isn't available.".

**What was measured before the edit, and what was not.**
- **This work has never submitted a booking to `lido-axes-b`, and nothing in
  the repository's tests or tools does. The baseline — that a booking would go
  through today — is NOT measured.**
- What exists is not a submission:
  - a visitor reading `bookings` gets 403, `42501`, "permission denied for
    table bookings" (re-read 07:24Z). That is the READ rule: a booking table
    is not public. It says nothing about submitting;
  - the form and its exact request (above);
  - the first `grants preview` press will read who may insert: that is
    configuration, not behaviour.
- The site's notification setting is on and its stamp (`notified_at`) is
  empty. That is consistent with no booking having gone through here since the
  site was built (the hook predates it), and proves nothing about whether one
  would.
- **So a pass rests on configuration before and behaviour after**: before the
  edit the visitor roles hold the insert privilege (press 1); after it a real
  booking is refused at the privilege check and no row appears (press 3), and
  the visitor roles hold nothing (press 4). That bookings worked before stays
  an inference.
- A measured baseline is an option (item G): one real booking before the edit.
  It inserts a row, which the cleanup below then deletes, and it sets off
  whatever the notification check below finds.

**What the result covers: closing bookings, and nothing wider.**
- **If it passes, it shows, for this message on this site through the real
  app:**
  - the message went to the rules step;
  - the rules step closed `bookings` to visitor bookings: one real booking was
    refused at the privilege check, and no row was added;
  - nothing was published, and the pages, the stylesheet, the stored source
    and the menu stayed the same;
  - the money matches the ledger.
- **It does not show**:
  - reopening;
  - limits, uniqueness, overlap or one-per-person rules;
  - member or owner scoping, or column-level rules;
  - confirmations, texts or webhooks;
  - any other wording, or any other site, including a newer one or one whose
    database link is missing;
  - which of two ways the model closes a table (marking it closed, or removing
    its write access), beyond this one run;
  - the row policies or the "closed" flag themselves: no existing reader reads
    them.

**The message.** Sent by a named UI-mode scenario, never as form text: "We're
fully booked, so stop taking bookings on the website for now." It is 67
characters, all ASCII, sha256 `3ccbae0b202aa2e2…`.
- "stop taking bookings" and "we're fully booked" are the rules tool's own
  examples for closing a table.
- "close the booking form" is the router's example for the rules layer.

**What is expected from the edit**:
- one routing call answering `intent=edit layer=rules`;
- one job, with one quick-model call (`write_table_rules`) that closes
  `bookings` and changes nothing else. It may mark the table closed
  (`retired`) or take its write access away; both refuse a visitor's booking
  at the privilege check;
- the ledger reserving before any schema change, and nothing published;
- the rung's reply "✅ **bookings** — changed whether it's open.", to which
  the browser adds "It’s live now — nothing needed rebuilding." The exact
  screen text is taken when the scenario is built;
- in `lido-axes-b`'s own database:
  - `bookings` closes to visitors, and its rows stay;
  - `_meta.schema` is rewritten;
  - every other table's policies and grants are re-issued with the same
    effect, so the menu stays readable;
  - the helper and trigger functions are re-created with today's pinned
    `search_path`;
  - `_secrets` and `_errors` are created if they are absent.

**The presses.** All four are the owner's, because a session's dispatch
answers 403. The two canary presses are dispatched from the branch, because
`scripts/` does not deploy.
1. **`grants preview`** (free; mode preview, site `lido-axes-b`). This is the
   before-state.
   - It reads, from the database's own catalog, which privileges the two
     visitor roles hold on each table, and prints each table's access as
     `_meta.schema` states it.
   - It does not read row policies or the "closed" flag.
   - Expected: `bookings` INSERT for the visitor roles, and `menu_items`
     SELECT.
2. **The free rehearsal** (the canary's UI mode, the new scenario, spend no).
   Nothing is written. It reads:
   - the preflight: both deploy readers, and the expected deploy and image;
   - the before-state: the stored source (which must read back complete),
     `x-site-build` on each route, the route pages, the stylesheet, and the
     menu (6 rows, 1,208 bytes, sha256 `f2b64cb26abe7c14`; the `8e1d493c…`
     first written here does not reproduce and is withdrawn — *two
     corrections*, below);
   - the owner's view of `bookings`: its exact row count and its newest ids;
   - the site's secret NAMES, from the owner's secrets list. That list also
     carries a few characters of each key; those are dropped before anything
     is recorded, and no value is ever read;
   - the site's notification setting and stamp;
   - the balance.

   Then:
   - the app opens the site and types the message without sending it;
   - a separate signed-out tab opens `/book`, fills in the marker booking
     through the page's own fields, and presses "Book a table" once. Its wall
     stops the request inside the browser and records exactly what would have
     been sent.
3. **The paid press** (the same with spend yes; about 3 credits).
   - Everything in press 2, then the message. Only the routing call and one
     `rules` edit may leave the app.
   - The job's stored reply must be a rules success that changed `bookings`
     and nothing else. **Only then** does the signed-out tab submit the marker
     booking, once, for real. Its wall lets exactly that one request out. The
     status, the response body and the page's own message are recorded.
   - Then the owner's view of `bookings` again: the count, the newest ids, and
     no row carrying the marker.
   - The unchanged checks:
     - `x-site-build` the same on every route, and no version header
       appearing;
     - the pages the same once render times are masked;
     - the stored source and the stylesheet byte-identical;
     - the menu read byte-identical;
     - the job's row showing no publish.
   - The notification stamp, and the ledger with the money closing exactly.
4. **`grants preview` again** (free): `bookings` holds nothing for either
   visitor role, and `menu_items` holds what it held in press 1.

**The marker booking.** It passes the page's own checks, involves nobody real,
and cannot be mistaken for a real booking:
- name: `Canary rules <run id>`;
- phone: `07700 900999`, in the range Ofcom reserves for drama, which no real
  phone has;
- party size: 2;
- date: 2099-12-31;
- time: 17:00.

It is valid for the form. Whether the table itself would take it is the
baseline that is not measured.

**How the booking's answer is read**:
- **Pass**:
  - HTTP 403, code `42501`, "permission denied for table bookings";
  - the page does not show "We've got your table" (its pop-up text is
    recorded; "That isn't available." is expected);
  - the row count and the newest ids are unchanged, and no row carries the
    marker;
  - the notification stamp is unchanged;
  - press 4 agrees.
- **Fail: the rule did not take effect.**
  - A 2xx: the booking went in, and the cleanup below runs.
  - A constraint or format refusal (`23xxx` or `22xxx`): Postgres checks the
    privilege before it looks at the row, so reaching those means visitors
    could still insert. There is no row and nothing to clean up, but the rule
    failed.
- **Partial**: `42501` with "new row violates row-level security policy". The
  booking is refused, but the insert privilege is still there. Press 4 shows
  which of the apply's statements landed.
- **Inconclusive**: any other answer. That covers a refusal before Postgres (a
  403 with code `turnstile`), another error code, a 5xx and a dropped request.
  The owner's view still says whether a row appeared.

**Exact cleanup, if the booking goes in.**
- **Find it**: exactly one id that is in the after-read and not in the
  before-read, whose row holds every marker value. For any other count nothing
  is deleted, and the ids are reported to the owner.
- **Delete it**: `DELETE /api/site/lido-axes-b/rows/bookings/<id>` through the
  owner rows route. That route deletes by primary key, and the id comes from an
  identity column, so it can only be the row this run's own booking created.
  - If the table keeps deleted rows (`trash`), the route answers `soft: true`:
    the row is hidden rather than gone, and the run says so.
- **Check it**: the count is back to the before-read, and no row carries the
  marker.
- **The limit, stated**: the route has no conditional delete, so the marker is
  checked just before the delete, not inside it. That matters only if somebody
  edits this test row in between, and even then the delete removes only this
  run's own row. A conditional delete (the conditional write's twin, one
  `DELETE … WHERE id = ? AND "col" IS NOT DISTINCT FROM ?`) would close that
  gap, but it is Worker code, needing a review, a merge and a deploy. It is
  offered, not proposed.
- **What the cleanup cannot undo**: the notification stamp on the platform's
  own record, and anything already sent (below).

**What a booking that goes in would set off.** A refused booking sets off
nothing: every hook below runs only after a successful insert.
- **An email to the site owner.** This site's notifications are on and have
  never fired, so the platform stamps `site_backends.notified_at` whether or
  not anything is sent. An email goes out only if the site's own secrets hold
  a mail key (`RESEND_KEY`, `SENDGRID_KEY` or `POSTMARK_KEY`) and `EMAIL_FROM`.
  Then one email, "New bookings on lido-axes-b", listing the marker values,
  goes to the site owner's own address (the building account). It cannot be
  recalled. The platform's own login sender is never used for this.
- **A confirmation email to the visitor**: impossible here. It needs the table
  to declare one and the row to carry an email address, and the form collects
  none.
- **A text to the visitor**: only if the table declares one and the secrets
  hold an SMS key (`TWILIO_SID` with `TWILIO_TOKEN`, `MESSAGEBIRD_KEY`, or
  `VONAGE_KEY` with `VONAGE_SECRET`) and `SMS_FROM`. It would go to the marker
  number, which no real phone has, but the provider may still charge the site
  owner for the attempt.
- **A webhook**: only if the table declares one and the secrets hold a
  `WEBHOOK_URL`. It would send the row to that address and record the attempt
  in `_meta`.
- **The rehearsal's list of secret names decides which of these are
  possible.** With none of those keys present, a booking that goes in sends
  nothing anywhere: it leaves the row, which the cleanup deletes, and the
  stamp. If any is present, the paid press waits until the owner approves that
  consequence by name (item E).

**Stop conditions, all before the paid call**:
- press 1:
  - no `_meta.schema`;
  - `bookings` or `menu_items` missing, or any other table present;
  - the visitor roles cannot insert into `bookings` (then a refusal afterwards
    would show nothing new);
- press 2:
  - the stored source does not read back complete, or the app has no page
    list;
  - a `TURNSTILE_*` secret, because a bot check could refuse the booking for
    its own reason;
  - a mail, SMS or webhook key the owner has not approved;
  - the recorded booking request differs from the one above;
  - the balance is unreadable;
- the preflight fails.

During the paid press:
- if the router answers anything but `rules`, the wall stops the edit, only
  the routing call is spent, and no booking is submitted;
- if the reply is not a rules success that changed `bookings`, no booking is
  submitted.

**Cost**: about 3 credits. Routing is 1–2, and the rules call is about 1 (its
prompt measures about 6,700 characters, about 2,200 tokens). That is an
estimate, not a cap: the balance is the only bound, and it is 56 (read 07:25Z;
the last ledger row is run 42's, 06:04:40Z). The free presses and the visitor
booking cost no credits.

**The approval scope, item by item.** Item A is done (*the rules test, built*,
below); nothing else is approved or pressed.
- **A. Build the harness on the branch**: code and tests only, with no spend
  and no press. **Done 2026-09-27 (`ebf53761`).**
- **B. The three free presses**: `grants preview` before; the free rehearsal,
  which also reads the secret names and the bookings count; and `grants
  preview` after the paid press.
- **C. The paid press**, about 3 credits: the rules message, then one real
  visitor booking that is expected to be refused. Approving C accepts that
  `lido-axes-b`'s database changes for good (its first schema change).
- **D. If the booking goes in** (the rule failed): delete exactly that one test
  row in the same run (recommended). Without this approval, the run stops and
  reports the row's id for a separate decision.
- **E. Only if the rehearsal finds such a key**: whatever it would send if the
  booking went in — an email to the owner's own address, a text attempt to a
  number nobody has, or the row sent to the webhook address.
- **F. `lido-axes-b`'s end state**, one of:
  - leave `bookings` closed. This repurposes the site's database; its pages,
    its stylesheet and its stored source stay as they are;
  - reopen it with a second rules message ("Start taking bookings on the
    website again."), about 3 more credits. The grants come back in today's
    column-scoped form, so the database is still not today's. Checking the
    reopening needs a booking that should go in: a real row, deleted afterwards
    the same way, with the same notification check. That booking would also be
    the first live proof of column-scoped write grants through a real form
    (untested item 1 at the top).
- **G. A measured baseline** (optional, and not recommended by default): one
  real booking before the edit, cleaned up the same way.

#### The rules test, built (2026-09-27, `ebf53761`; the free checks passed, the paid press passed as run 44, and the permissions read after it agrees)

Owner: *"Proceed with building the bounded rules-test harness and focused tests
on the branch. … Accept either supported way of closing bookings based on the
actual applied result and behavior; don't require wording specific to only one
implementation. Keep the evidence boundary explicit … No paid dispatch, live
booking submission, database mutation or site deletion yet."*

Item A is done: the canary's browser mode has a scenario, `4b-rules-close`,
and the form one new box. `scripts/canary-rules.mjs` holds every decision and
is pure; `scripts/canary-ui.mjs` drives the app and the booking tab;
`scripts/edit-canary.mjs` reads and checks. In the order a run takes:

- **Before anything, the app's page list is read**: without one the app stops
  before routing a message, so the run would test nothing.
- **The start, read immediately before the message** (both presses):
  - the owner's view: every table's access label and exact row count (the
    tables must be exactly `bookings` and `menu_items`, and visitors must still
    be able to add to `bookings`), and `bookings`' newest 50 rows by id. A row
    carrying the marker's name prefix ("Canary rules ") is an earlier run's
    leftover and stops the paid press;
  - the site's secret NAMES. The owner's list also carries a few characters of
    each key; they are dropped before anything is recorded, and no value is
    read;
  - the notification setting and stamp, with the service key, selecting
    `notify` and `notified_at` only;
  - a visitor's side: the menu read byte for byte (1,208 bytes, sha256
    `f2b64cb26abe7c14`), a visitor's read of `bookings` refused as recorded
    (403, `42501`), and the surface: `/`, `/book` and `/menu` on build
    `mt50cg7h-l19hre` with no version header, and the one stylesheet
    (`/assets/index-glpAegzo.css`, 209,105 bytes, `6f7ca4bc…`) byte for byte.
- **The rehearsal** (spend no) types the message and does not send it. A
  signed-out tab opens `/book`, waits until the form is interactive, fills in
  the marker booking through the page's own fields, checks the form holds
  exactly those values, and presses "Book a table" once. The tab's wall stops
  the request inside the browser and records what would have been sent: it
  must be exactly the marker's five fields, and the gate the paid press uses
  must say it would let that request out (*the booking gate*, below). The
  owner's view of `bookings` is then read again and must be unchanged.
- **The paid press** (spend yes) sends nothing unless every start reading is
  where the test was written to start and every send a booking could set off
  is approved (below). Then:
  - the message goes; only the routing call and one edit at the `rules` layer
    may leave the page, and exactly one job must be filed;
  - **closing is read off what the job applied and what the listing shows,
    never off the reply's wording.** The job's stored reply must be a rules
    success naming exactly `bookings`, whose changed fields are only
    `retired`, `write` (and `read`), with at least one of the first two. The
    listing afterwards must agree: if `write` changed, the label is now "read
    none / write none"; the read rule never moves; no other table's access
    moves; the same tables are there. **Either way of closing passes.** The
    screen must start with a tick and name `bookings`; no more of its wording
    is required;
  - **only then** does the tab submit the marker booking, once. Its wall
    decides before anything leaves (*the booking gate*, below): only the
    first request that is exactly the marker's five fields and values, with
    no query string and no `prefer` or `authorization` header, goes out.
    Anything else is stopped in the browser, recorded with its reason, and
    reads inconclusive. The status, the body and the page's own words are
    recorded, and the answer classified as above (pass, fail, partial,
    inconclusive). A pass also needs the page not to show a successful
    booking;
  - the owner's view again: every new row is named, as ours (every marker
    value) or somebody else's, and a row that went is named too. They are
    never offset against each other;
  - if a row carrying the marker went in: the cleanup below;
  - nothing published, from readers that do not borrow from each other: the
    site's version list, the job's own row, the surface (the build header on
    every route, no version header appearing, the pages the same once render
    times are masked, the stylesheet byte for byte), and the stored source
    file by file;
  - the stamp unchanged, the menu byte-identical, and a visitor's read of
    `bookings` refused as before;
  - the money: the balance's move must be exactly the routing call's cost plus
    what the job's row and the ledger both say it took.
- **The cleanup, only with approval.** With `cleanup` in the approvals box:
  exactly one new row holding every marker value is chosen; it is read again
  just before the delete; it is deleted by id through the owner route; and the
  count is checked back with no marker left (a table that keeps deleted rows
  is said as hidden). Without approval, or with none or several candidates,
  nothing is deleted and the ids are reported. The route has no conditional
  delete, so the marker is checked just before the delete, not inside it.
- **The approvals box** ("Rules test only (4b-rules-close): what you approve if
  its test booking goes in anyway."): any of `cleanup`, `email`, `text`,
  `webhook`, comma or space separated. It is read whole before the sign-in. An
  unknown word refuses, and so does a filled box beside any other run. The
  paid press refuses while a send the site's secrets make possible is not
  approved, or while the secret names cannot be read; a bot-check secret
  (`TURNSTILE_*`) refuses outright.
- **The evidence boundary, printed by every run**: with no measured successful
  booking before the edit, a pass shows the configuration changing and a
  refusal afterwards, not a measured change from accepted to refused.
- **What it cannot see.** The reply carries field names only and the listing
  never shows the closed flag, so a reply that recorded `retired` passes the
  closing check whether the table really closed or not. The booking is the
  other half: on a table that did not close it goes in, which fails the run
  (and the cleanup runs if approved).

**The evidence (2026-09-27).**
- **Cases**: `test/canary-rules.test.mjs`, 31, drives every decision:
  classification, the census, insertion, cleanup, secret names, what a secret
  can send, the approvals, the stamp, closing both ways, the surface, the
  stored source and the no-publish verdict. `test/canary-ui.test.mjs` gains
  13 (41 → 54) through a stand-in database and booking tab: the rehearsal and
  a second read after its press, both ways of closing, no booking without a
  closing reply, a booking that goes in with and without approval, somebody
  else's row, answers that are not the privilege refusal, a second request, a
  form that does not hold the marker, the start refusals, and the wiring and
  approvals censuses. Three older guards were re-anchored to what they assert,
  because the run now reads the page list (`/api/site/routes` matched the
  routing-call pattern) and can delete (the census of the canary's own
  writes).
- **Red on the unchanged head `a819d13a`**, with only the pure module copied
  in: 15 of 70 fail — the rules file whole (the scenario is not there), the 13
  new cases, and the re-anchored writes census (it names the cleanup's
  delete). That is red by construction; the probes are the evidence.
- **Probes** (`scripts/mutants/canary-rules.json`, over seven canary test
  files): 84 mutants, 84 killed, 0 never applied, 3 comment-only controls
  surviving, and the probed files byte-identical afterwards. Two survived the
  first run, and each got a case first: a row that went counted as nothing (a
  stale count beside a row gone), and the rehearsal's after-read reusing the
  start.
- **A real browser against the live `/book` page**, read-only: a local
  Chromium ran the booking tab with every GET fetched through a
  TLS-verified reader and every write answered in the page. 24 GETs reached
  the network, to the site alone, and nothing else did.
  - The rehearsal stopped the request, which held exactly the marker's five
    fields; the page said "Failed to fetch".
  - A 403 `42501` answered in the page read as a pass, and the page said
    "That isn't available.".
  - A 201 answered in the page read as a fail, and the page said "Table held —
    see you by the water."
  - The surface, the stylesheet, the menu and the refused read of `bookings`
    matched the record.
- **The suite**: locally `8138 / 8136 / 0 / 2` (+44 against the parent's
  8,094, exactly the new cases); unit CI run `36307245182` on `ebf53761`:
  `8138 / 8134 / 0 / 4` (`duration_ms` 100,302), 8,138 distinct result
  numbers with no gap and zero `not ok`, and all 100 cases of the three
  touched test files passing by name. No `site build` fires: none of the
  files is on its paths.

**Two corrections.**
- `ebf53761`'s commit message says a closed table is "gone from" the listing.
  It is not: a closed (`retired`) table stays in the owner's listing with its
  label unchanged, and the check requires the same tables before and after.
  The code does this; the message was wrong.
- The proposal quoted the menu read as sha256 `8e1d493cd891abc8`. That does
  not reproduce: the menu answers 1,208 bytes, `f2b64cb26abe7c14`, for the
  plain, the `select=*` and the ordered read alike (~08:50Z). The harness
  records `f2b64cb2…`; the earlier figure is withdrawn.

**What a booking that goes in would set off, as found.** A refused booking
sets off nothing.
- The site's notifications are on and have never fired (`notified_at` empty,
  read 08:37Z), so the platform would stamp its own record. The stamp is
  written before any send, and the cleanup cannot undo it.
- A confirmation email to the booker is impossible: the form collects no
  email address.
- A text to the marker number would be refused by the sender where the number
  comes straight from the row: it has no country code.
- An email to the owner, a text from a function, or a webhook: only if the
  site's secrets make it possible. Only the owner's rehearsal can read the
  secret names, and the paid press will not start until any such send is
  approved in the box.
- The free checks every canary run makes also file two zero-cost empty edit
  jobs, on `lido-axes-b` and on `washhouse-3`. They change nothing.

**The exact presses.** All are the owner's; a session's dispatch answers 403.
The form shows descriptions, not names, so each box is named by its
description.
1. **`grants preview`, from `main`**, free:
   - "preview (reads only) | verify (reads only) | apply (WRITES grants) |
     rollback": `preview`;
   - "One site, e.g. fretwork-1. …": `lido-axes-b`;
   - the other two boxes blank.
2. **`edit canary`, from branch `claude/help-needed-ehlwlj`** (the scenario is
   there only), free:
   - "Run the ONE paid edit as well (yes/no)": `no`;
   - "RUN A NAMED SCENARIO IN A REAL BROWSER …": `4b-rules-close`;
   - "Rules test only (4b-rules-close): what you approve …": what press 3 will
     carry, e.g. `cleanup`, so the rehearsal checks the start exactly as the
     paid press will;
   - "The site to edit. …": `lido-axes-b` (not the default `fretwork-1`);
   - "A second site, …": as is (`washhouse-3`);
   - "Refuse to spend unless the Worker reports this deploy sha …":
     `14df0225be90e2637764ea33771d64f4a393b628`;
   - "Refuse to spend unless a cold container reports this image id …":
     `9038e90ab1d5d7fe`;
   - every other box blank.
3. **The same as 2 with "Run the ONE paid edit as well (yes/no)" `yes`**,
   pressed only after 1 and 2 are read and pass. About 3 credits.
4. **`grants preview` again**, as 1: `bookings` should hold nothing for either
   visitor role, and `menu_items` what it held in 1.

**The restore stays a later option, not built.** Neon restores a root branch to
its own past: `POST /projects/{id}/branches/{branch}/restore`, with an LSN or a
timestamp and `preserve_under_name`. It replaces all data and schema on the
branch and keeps the old state as a backup branch. Before it could be used:
- a tool that refuses unless all of these hold:
  - the project holds only that site's database;
  - the branch is a root branch;
  - the point is inside retention;
  - nothing but the test's own change has happened since;
- a rehearsal on a throwaway Neon project first.

It is the way to test a rules change on a site people use. The owner has said
not to build it or run it against an active site yet. The earlier plan (R0–R2
on fold-lane-bakery) is in git: `git show
4d385201:docs/investigations/edit-path-checklist.md`.

#### The booking gate: decided before the request leaves (2026-09-27, `717bb5b2`; closed by the owner; nothing paid approved or pressed)

Owner, having reproduced it against the real helper with an injected browser:
*"In bookInPage, the first POST to the booking endpoint is forwarded whenever
submit=true. bookingBodyVerdict runs later, after the request has already
left. … Run the existing bookingBodyVerdict inside the request interceptor
before forwarding. Only the exact marker payload may leave. … Do not rewrite
the submitted payload to make it pass."*

**CLOSED BY THE OWNER (2026-09-27)** after an independent review: *"the wrong
payload is blocked before transmission, the valid control passes, and 105
focused tests passed."*

- **The defect.** With the paid press on, the booking tab forwarded the first
  POST to the bookings endpoint whatever it held, and its body was checked
  afterwards, once it had reached the database. The owner's case: the form
  held the marker's phone, the page's code sent another, and that request went
  out. A row like that is also the one the cleanup cannot find, because the
  cleanup looks for every marker value.
- **The fix.** `bookingGate` (`scripts/canary-rules.mjs`, pure) runs inside
  the interceptor, before the request is handed on, and wraps the existing
  `bookingBodyVerdict`. The paid press lets a request out only when all of
  these hold:
  - it is the first booking request the tab has seen;
  - its body is exactly the marker's five fields and values, in their types;
  - its URL carries no query string;
  - it carries no `prefer` and no `authorization` header.

  Anything else is aborted in the browser, recorded with the gate's reason,
  and never rewritten. The run then reads **inconclusive ("never sent")**:
  nothing reached the database, so there is nothing to classify and nothing
  to clean up.
- **Why the query string and the two headers** (read in `worker.js`, not
  driven live). The platform's data route passes the query string and
  `content-type`, `authorization`, `accept`, `prefer` and `cookie` on to the
  site's database API.
  - `Prefer: return=representation` asks for the new row back. That needs a
    read permission visitors do not have on `bookings`, so Postgres refuses
    with the same "permission denied for table bookings" a closed table gives:
    a false pass.
  - An `authorization` header makes it a member's request, not a visitor's.
  - A query string can change what the database API does with the write.

  The live page sends none of them: its request is a plain JSON POST to
  `/api/db/lido-axes-b/data/bookings`, read out of the live bundle and shown
  passing the gate in a real browser (below). A case pins the proxy's list
  of forwarded headers, so a new one is noticed.
- **Service workers are blocked** in the booking tab. A request a service
  worker makes for the page can go round the page's route handlers. The site
  registers none today (no `serviceWorker` in the page or any of its seven
  scripts); the block means the wall does not depend on that.
- **The rehearsal** now also asks the gate: the request it stopped must be
  one the paid press would let out. **The paid press** checks that the
  request went out and was the exact one.
- **What it costs.** A request the gate stops in the paid press is stopped
  after the message has gone, so the rules change is already made and paid
  for, and the run reads inconclusive. The rehearsal asks the same gate first,
  so a page whose request would be stopped is found for free.

**The evidence.**
- **Cases**: `test/canary-rules.test.mjs` 31 → 33 (the gate over every shape,
  and a census of the headers the data route passes on);
  `test/canary-ui.test.mjs` 54 → 57:
  - the owner's reproduction: the form holds the marker's phone and the page
    sends `07700 900111`. The request is stopped, never reaches the service,
    and no row, stamp, delete or cleanup follows; the run reads inconclusive;
  - eleven altered requests, each stopped before it leaves: malformed JSON, no
    body, a list, a changed value, a changed type, a missing field, an extra
    field, a query string, a `prefer` header, an `authorization` header, and
    headers that cannot be read;
  - a stopped request that the page retries, even exactly: stopped too;
  - the valid one-request control, the rehearsal and the second-request case,
    updated to say what the gate decided.
- **Red on the previous commit `7db03084`** (the pure gate appended so the
  file loads): 7 of 90 fail. They are the rehearsal, the valid control, the
  second-request case, the three rejection cases and the census. The
  reproduction fails first on `sent: true` for the altered request. With its
  first four assertions cut, it fails on "the request left the tab": the
  booking carrying `07700 900111` reached the service stand-in.
- **Probes** (`scripts/mutants/canary-rules.json`, G-1 to G-16, over seven
  canary test files): 16 of 16 killed, 3 comment-only controls surviving, and
  the probed files byte-identical afterwards. The spec holds 103 entries.
- **A real Chromium against the live `/book` page**, locally: every GET was
  fetched through a TLS-verified reader and every write answered in the page.
  - The page's own request passed the gate and read as a pass on a 403
    `42501` answered in the page ("That isn't available.").
  - A page made to send another phone, to add `Prefer:
    return=representation`, or to add `?on_conflict=id` was each stopped
    before it left, read inconclusive, and the page said "Failed to fetch".
  - 32 requests reached the network, all GETs to the site; no write did.
- **The suite**: locally `8143 / 8141 / 0 / 2` (+5, exactly the new cases).
  Unit CI run `36308781985` on `717bb5b2`: `8143 / 8139 / 0 / 4`
  (`duration_ms` 114,210), 8,143 distinct result numbers with no gap, zero
  `not ok`, and all five new cases passing by name. No `site build` fires:
  none of the files is on its paths. The documents commit after it,
  `8990bee5`, reads the same four numbers on unit CI run `36309049041`
  (`duration_ms` 103,247), so it moved the suite by zero.

**The free preparation checks (2026-09-27, 09:11–09:18Z).**
- **The two free presses, tried once each from the session**: `grants
  preview` (from `main`, `preview`, `lido-axes-b`) and the rehearsal (from the
  branch, spend `no`). Both answered **403** and were not retried; they are
  the owner's presses.
- **Tried once more at about 09:27Z**, when the owner asked for the two free
  checks: both answered **403** again and were not retried. They went to the
  owner with their exact inputs (the owner's notes, 2026-09-27, *"You closed
  the booking check"*).
- **Read-only, and each as recorded**:
  - `main` is still `14df0225`;
  - the balance is 56, and the newest ledger row is run 42's reserve
    (06:04:40Z), so nothing has been spent since;
  - `lido-axes-b`: notifications on, never fired, not offline. No queued edit
    job has ever been filed for it (the table holds queued jobs only). No edit
    job anywhere is running: the only two not `done`, `failed` or `cancelled`
    are `lost` and refunded, from 2026-09-01 and 09-02;
  - `/`, `/book` and `/menu` answer 200 on build `mt50cg7h-l19hre` with no
    version header; the stylesheet is 209,105 bytes, `6f7ca4bc…`; the menu
    read is 1,208 bytes, `f2b64cb26abe7c14`; a visitor's read of `bookings`
    answers 403 `42501`;
  - the Worker's gates answer 401 / 401 / 401 / 404. That shows it is up and
    routing, and says nothing about which build answers.
- **What only the owner's presses can read**: the deploy sha and image (the
  preflight), the owner's view of `bookings` (count and rows), and the site's
  secret names.
- **A reading of mine that was wrong, and why.** My first stylesheet hash read
  `484438e4…`. The command piped the download through `tee >(wc -c)`, and the
  byte count went into the same pipe as the file, so the hash covered the
  file plus the count. Downloaded to a file and read on its own, it is the
  recorded 209,105 bytes, `6f7ca4bc…`.

**Press 1 read: `grants preview` run `36309691339` (the owner's, 2026-09-27
09:32Z).**
- **Nothing was written.** From `main` at `14df0225`, 09:32:17 → 09:32:43Z.
  The env block reads `MODE: preview` and `SLUG: lido-axes-b`. The two steps
  that can write, the apply guard and the rollback download, were skipped.
- **Its lines, verbatim:**
  - `lido-axes-b: 2 table(s), 1 carrying a table-wide client write`;
  - `ok  menu_items  [read=public write=none]  now: (no table-wide write)`;
  - `NEEDS bookings  [read=none write=anyone]  now: anonymous INSERT,
    authenticated INSERT`, and under it `would grant: name, phone,
    party_size, booking_date, booking_time`;
  - `0 site(s) could not be read`.
- **Its artifact records the grants themselves**: `grants-before-state`, id
  `10928500920`, a 565-byte zip (sha256 `a88c3681…`) holding a 2,003-byte
  JSON (sha256 `39a98569…`), kept until 2026-12-26.
  - `bookings`: INSERT for both visitor roles, table-wide, and nothing else.
    There is no SELECT, which agrees with a visitor's read answering 403
    `42501`.
  - `menu_items`: SELECT for both visitor roles, table-wide, and nothing
    else.
- **So the starting permissions are the ones the test was written for.**
  Visitors may add a booking and may not read one. They may read the menu and
  may not change it. The site's stored schema says the same: `bookings` read
  none, write anyone; `menu_items` read public, write none.
- **The insert privilege is the older, table-wide form**: it covers every
  column, not only the form's five. The five columns a grants apply would
  narrow it to are exactly the five the booking form sends. That apply is
  maintenance and is not part of this test; the rules edit re-writes these
  grants itself.
- **What it does not show**: row policies and the closed flag, which it does
  not read, and whether a booking would really go through. That is
  configuration, not behaviour.
- **Press 4 is compared against this artifact.** After the rules edit,
  `bookings` should hold nothing for either visitor role, and `menu_items`
  SELECT for both, exactly as here.
- **Read again at 09:40:29Z, read-only**: the balance is 56, the newest ledger
  row is still run 42's reserve (06:04:40Z), no edit job has been filed
  anywhere since 06:10Z, none has ever been filed for `lido-axes-b`, and its
  notifications are on and have never fired.

**Press 2 read: the free rehearsal, `edit canary` run 43 (`36333244182`, the
owner's, from the branch at `a2a989ad`, 2026-09-27 16:26:22 → 16:27:46Z;
canary step 38 s).** It passed, and it sent, booked and wrote nothing.
- **The env block**: `CANARY_SPEND: 0`, `CANARY_UI: 4b-rules-close`,
  `CANARY_ALLOW: cleanup`, `CANARY_SLUG: lido-axes-b`, `CONTROL_SLUG:
  washhouse-3`. The instruction, read-job and restore boxes are blank, and
  both expectations are set.
- **The build answering**: `build-health 200 deploy=14df0225be90
  image=9038e90ab1d5d7fe` and `runtime 200 … async=true runner=true`.
  - The two readers agree, and both expectations match.
  - `main` is still `14df0225`, re-read at 16:37Z.
  - The paid press runs the same scripts: no file under `scripts/` has
    changed since the gate commit `717bb5b2`, and every commit after it is
    documents only.
- **The zero-cost confirmations passed.**
  - Both sites got the queued shape: job `9e783678…` on `lido-axes-b` and
    `df8feb12…` on `washhouse-3`.
  - A forged replay and a stranger's poll each answered 404.
  - The free job settled in about 6 s as `escalate empty, cost 0`.
  - Read afterwards on `edit_jobs`, both are `failed`, billing `none`, cost 0,
    never published.
  - **The `lido-axes-b` one is the first edit job ever filed for that site.**
    So press 1's *"none has ever been filed"* no longer holds; that job
    changed nothing.
- **The inventory is complete**: `reads` all true.
  - Three pages (`index.tsx`, `menu.tsx`, `book.tsx`) and no components.
  - Every route answered 200 on build `mt50cg7h-l19hre`, with no version
    header.
  - The stylesheet is the recorded 209,105 bytes, byte for byte
    (`6f7ca4bc…`).
  - The app reads the page list as `/ /menu /book`. The balance is 56.
- **The starting point: all eight checks `ok`.**
  - **The site has no secrets at all** (names `[]`). So a booking can send no
    email, text or webhook, and there is no bot check. There were no key
    values or hints to drop.
  - Notifications are on, and the stamp has never been set.
  - The tables are `bookings` and `menu_items`.
    - `bookings` is `collect` (read none, write anyone). It has 0 rows and
      the columns `name, phone, party_size, booking_date, booking_time`.
    - `menu_items` is `display` (read public, write none), with 6 rows.
  - The owner's view of `bookings`: 0 rows, no ids, no marker.
  - A visitor's read of `bookings` answers 403 `42501` "permission denied for
    table bookings".
  - The menu read answers 200 with 1,208 bytes, sha256 `f2b64cb26abe7c14…`,
    the recorded bytes.
- **The app**:
  - It opened signed in as the building account, on the card
    `srv_lido-axes-b`.
  - It typed the message and did not send it. The screenshot shows it in the
    composer over an empty thread.
  - It made three GETs (the site list, the credits, the page list). Nothing
    was blocked, and there were 0 console or page errors.
- **The booking, stopped in the browser.**
  - The form became interactive and was filled with the marker booking. "Book
    a table" was pressed once.
  - The one booking request held exactly `{"name":"Canary rules
    36333244182","phone":"07700 900999","party_size":2,
    "booking_date":"2099-12-31","booking_time":"17:00"}`.
  - The gate read it as the one exact request (`exact: true`).
  - The rehearsal stopped it (`net::ERR_BLOCKED_BY_CLIENT`), so no answer
    arrived. The page showed "Failed to fetch".
  - `bookings` read 0 rows before and after, with no marker.
- **The booking tab's other requests, measured.** Its console shows four
  blocked requests, and its list of other writes is empty. The wall blocks a
  request to a `/cdn-cgi/` path without listing it.
  - Measured locally the same afternoon, with the rehearsal's own
    `bookInPage` and every request that is not a GET listed, the page issues
    exactly four:
    - three `POST /cdn-cgi/rum`, Cloudflare's page-view analytics beacon. The
      edge adds its script to the page when a browser asks for the page; a
      Node fetch gets the page without it, which is why the canary's saved
      HTML does not show it;
    - the booking.
  - All four end blocked in the browser, and only GETs reached the network.
  - So the booking page makes no other write, and the paid run's wall blocks
    those three beacons the same way.
- **A wording defect in the rehearsal's own line, not changed.** The line is
  *"the booking page made no other write -> not read"*. The check passes only
  on a real, empty list; the detail prints "not read" because an empty list
  joins to nothing. It is in the rehearsal branch only. It is left as it is so
  that the paid press runs exactly the harness this rehearsal ran.
- **The evidence boundary was printed.** The balance went 56 → 56, and 0 of 1
  messages were sent.
- **The artifact**: `canary-evidence`, id `10936721575`, 1,890,208 bytes,
  sha256 `8edc3e27…`. That equals the digest the upload printed.
- **Read again at 16:37Z, read-only.**
  - The balance is 56. The newest ledger row is still run 42's reserve (id
    331, 06:04:40Z), and nothing has been written to the ledger since.
  - The only edit jobs since run 42 are this run's two confirmations.
  - Nothing is running: 292 jobs in all, 168 done, 122 failed, and 2 `lost`
    from 1–2 September.
  - `lido-axes-b`'s notifications are on and have never fired.
  - Unit CI on `a2a989ad` (run `36310169094`) reads `8143 / 8139 / 0 / 4`.
- **So both free checks pass, and press 3 waits for the owner's approval.**

**Press 3 read: the paid rules test, `edit canary` run 44 (`36337146911`, the
owner's, from the branch at `d64072ec`, 2026-09-27 17:29:46 → 17:31:44Z;
canary step 73 s).** It passed every check it makes. The last pass item, press
4 (the permissions read after the edit), has not been pressed yet.
- **The env block**: `CANARY_SPEND: 1`, `CANARY_UI: 4b-rules-close`,
  `CANARY_ALLOW: cleanup`, `CANARY_SLUG: lido-axes-b`, `CONTROL_SLUG:
  washhouse-3`. The instruction, read-job and restore boxes are blank, and
  both expectations are set. The checkout fetched `d64072ec`; no script has
  changed since `717bb5b2`, so this ran exactly the harness run 43 rehearsed.
- **The build answering**: `build-health 200 deploy=14df0225be90
  image=9038e90ab1d5d7fe` and `runtime 200 … async=true runner=true`. The two
  readers agree, and both expectations match.
- **The zero-cost confirmations passed**: job `2dff97cf…` on `lido-axes-b` and
  `7fd69935…` on `washhouse-3`, both `failed`, billing `none`, cost 0, never
  published; a forged replay and a stranger's poll answered 404; the free job
  settled in about 8 s as `escalate empty, cost 0`.
- **The inventory is complete** (`reads` all true): three pages and no
  components, every route 200 on build `mt50cg7h-l19hre` with no version
  header. The balance was 56, and the app read the page list `/ /menu /book`.
- **The starting point: all eight checks `ok`, as in run 43** (read
  17:30:51–17:30:59Z): no secrets, so no send was possible; notifications on
  and the stamp never set; `bookings` collect with 0 rows and `menu_items`
  display with 6; the owner's view of `bookings` 0 rows; a visitor's read of
  `bookings` 403 `42501`; the menu 1,208 bytes, `f2b64cb2…`; every page on the
  build and the stylesheet byte for byte.
- **The message, sent once through the real app** (about 17:31:06Z):
  - routed `intent=edit layer=rules`, 2 credits (`6,771 in / 18 out`, 512
    cached). The browser sent the three page paths and `tables: []`;
  - one edit POST at `rules`, answered 202 with job `46d167e1…`;
  - the reply on screen 31 s after Send: "✅ **bookings** — changed whether
    it's open. It’s live now — nothing needed rebuilding." The composer was
    usable again. Nothing was blocked, and there were 0 console or page errors.
- **The job's stored reply**: `ok`, layer `rules`, cost 1 (one quick-model
  call, `1,864 in / 24 out`, 512 cached), `applied` exactly
  `[{table: bookings, fields: [retired]}]`, and nothing refused.
  - **So the model closed the table by marking it closed (`retired`)**, not by
    taking its write access away. In the schema engine a closed table gets no
    row policy at all, both visitor roles have every privilege revoked, and it
    gets no public view (`site-rls.mjs`: `policiesFor`, `grantsFor` and the
    view builder each return early for a closed table).
  - The owner's listing still reads `bookings` as `collect` with 0 rows, as
    designed: it shows access, not the closed flag. The closing check passed
    on the stored reply (only `bookings`, only `retired`) and a listing that
    did not move.
- **The job row**: `done`, `finalized`, cost 1, created 17:31:06.800Z, updated
  17:31:27.466Z, no publish started or finished. Its trace ran 12,175 ms and
  ended ok.
- **The booking, after the edit** (17:31:34Z):
  - The form became interactive and was filled with the marker booking, and
    "Book a table" was pressed once.
  - The one request was exactly `{"name":"Canary rules
    36337146911","phone":"07700 900999","party_size":2,
    "booking_date":"2099-12-31","booking_time":"17:00"}`. The gate read it as
    the one exact request and let it out.
  - It answered **403 `{"code":"42501","message":"permission denied for table
    bookings","details":null,"hint":null}`**, and the page showed the pop-up
    "That isn't available.", never "We've got your table".
  - **Verdict: PASS, refused at the privilege check.**
  - The tab's other requests were the three `/cdn-cgi/rum` beacons, blocked in
    the browser, and the browser's own report of the 403. Its list of other
    writes is empty.
- **After the booking** (17:31:36–17:31:38Z):
  - no row was added: the owner's view of `bookings` read 0 before and after,
    with no new id and no marker. There was nothing to clean up, so no delete
    was sent;
  - the notification stamp: never before and never after;
  - the menu read: 200, 1,208 bytes, the same sha;
  - a visitor's read of `bookings`: still 403 `42501`;
  - every page on the same build and byte for byte once render times are
    masked, and the stylesheet byte for byte.
- **Nothing published**: the version list answered 200 with no publish; the job
  row says no publish began; the stored source is byte-identical (the before
  and after `source.json` share sha256 `273556ba…`); and the route pages
  differ only in their render times.
- **The money closes: 56 → 53 = routing 2 + edit 1.** The ledger holds one row
  for the job: `reserve −1`, `balance_after 53`, ref `<job>#1`, 17:31:24.377Z,
  and no refund. The routing call writes no ledger row, as recorded.
- **The evidence boundary was printed**: no booking was submitted before the
  edit, so this shows the configuration changing and a booking refused
  afterwards, not a measured change from a booking that went through to one
  that was refused.
- **The artifact**: `canary-evidence`, id `10938135578`, 1,902,224 bytes,
  sha256 `8e97f926…`. That equals the digest the upload printed.
- **Checked by the session afterwards (17:52–17:55Z, read-only).**
  - The balance row reads 53, updated at the reserve (17:31:24Z). The only
    ledger row since run 42's is this job's reserve (id 332).
  - `edit_jobs`: this run's three jobs as above. Nothing is running: 295 jobs
    in all, 169 done, 124 failed, and 2 `lost` from 1–2 September.
  - **Of the 202 queued jobs with a stored reply, this is the only one naming
    the `rules` layer**: the rules rung's first queued success. It changed the
    database and published nothing, by design.
  - `lido-axes-b`: notifications on, `notified_at` empty, not offline.
  - The live `/`, `/book` and `/menu` answer 200 on build `mt50cg7h-l19hre`,
    byte for byte the run's after-read once render times are masked. The
    stylesheet is 209,105 bytes, `6f7ca4bc…`; the menu read is 1,208 bytes,
    `f2b64cb2…`; a visitor's read of `bookings` answers 403 `42501`.
- **What it establishes**, for this message on this site through the real app:
  the router chose `rules`; the rules rung closed `bookings` in one quick call
  for 1 credit; afterwards one real visitor booking through the site's own
  form was refused at the privilege check and added no row; nothing was
  published, and the pages, the stylesheet, the stored source and the menu
  stayed the same; the money matches the ledger.
- **What it does not establish**:
  - that a booking went through before the edit (not measured);
  - the permissions read directly after the edit: that is press 4;
  - reopening, the other way of closing (taking write access away), any other
    rule, wording or site.
- **Two findings, recorded and not changed**:
  1. **The reply shows literal asterisks.** `rulesReply`
     (`builder/site-rules.mjs`) writes the table name as `**bookings**`, and
     the chat shows replies as plain text, so the customer sees "✅
     **bookings** — changed whether it's open." with the asterisks (the run's
     screenshot). Kept with the model-written replies work, beside the generic
     "changed whether it's open".
  2. **The site still invites bookings.** The rules rung changes the database
     and publishes nothing, so the header's and the hero's "Book a table"
     buttons and the `/book` form stay. A visitor who fills it in is told
     "That isn't available.", not that the café is fully booked. The request
     was "stop taking bookings on the website"; the database half is done and
     the page half is not. Whether such a message should also change the
     pages is the owner's call.
- **The state it leaves**: `lido-axes-b`'s `bookings` is closed and stays
  closed, as the owner approved by pressing it; its rows (0) stay. Reopening is
  one more rules message (for example "Start taking bookings on the website
  again", about 3 credits). It would reopen the table in today's form, insert
  on the form's five columns only, not the old table-wide grant. Nothing is
  reopened.
- **Press 4, as predicted from the code before it ran**: `grants preview`
  from `main`, as press 1:
  - `bookings`: no privilege for either visitor role, and its planned
    statements are only the two `REVOKE ALL` lines. **Its printed line will
    still read `[read=none write=anyone]`**, because the preview prints the
    table's access pair and not the closed flag. The artifact's recorded
    grants (`beforeAcls`) and its `statements` are what show it closed. It
    should read `ok`, since nothing table-wide is left;
  - `menu_items`: SELECT for both visitor roles, table-wide, exactly as in
    press 1 (artifact `10928500920`).

**Press 4 read: `grants preview` run `36339825502` (the owner's, 2026-09-27
18:13:07 → 18:13:27Z).** It agrees with the prediction, so every pass item of
the rules test holds.
- **Nothing was written.** From `main` at `14df0225`. The env block reads
  `MODE: preview` and `SLUG: lido-axes-b`. The apply guard and the rollback
  download were skipped.
- **Its lines, verbatim:**
  - `lido-axes-b: 2 table(s), 0 carrying a table-wide client write`;
  - `ok  menu_items  [read=public write=none]  now: (no table-wide write)`;
  - `ok  bookings  [read=none write=anyone]  now: (no table-wide write)`;
  - `0 site(s) and 0 table(s) carry a table-wide client write; 0 site(s) could
    not be read`.
- **Its artifact**: `grants-before-state`, id `10938338900`, a 499-byte zip
  (sha256 `06e67590…`, equal to the digest the upload printed) holding a
  1,265-byte JSON (sha256 `75daa541…`), kept until 2026-12-26.
- **Compared field by field with press 1's artifact (`10928500920`):**
  - `bookings`: the recorded grants went from INSERT for both visitor roles,
    table-wide, to **none**. The planned statements went from the two `REVOKE
    ALL` lines and two `GRANT INSERT` on the form's five columns to **the two
    `REVOKE ALL` lines alone**. That is what `grantsFor` answers for a closed
    table, so the site's stored schema records `bookings` as closed.
  - `menu_items`: the recorded grants and the planned statements are
    **identical** (SELECT for both visitor roles, table-wide).
- **The printed `bookings` line still reads `[read=none write=anyone]`**, as
  predicted: the preview prints the table's access pair, which closing does
  not change.
- **What it does not read**: the row policies. The code drops every policy on
  a closed table; nothing here reads them. The refusal run 44's booking met
  was at the privilege check, which needs no policy to be read.
- **Read again afterwards, read-only**: the balance is 53, the newest ledger
  row is still run 44's reserve (id 332), no edit job has been filed since
  17:35Z, and `lido-axes-b`'s notifications are on and have never fired.
- **So the rules test's pass items all hold**: the refusal at the privilege
  check (run 44), no row added, the stamp unchanged, nothing published, the
  money matching the ledger, and the permissions after the edit (press 4).
  Closing it is the owner's call after review.

**Closed by the owner (2026-09-27)**, scoped to this closure request. The
booking permissions were removed, a real visitor submission was rejected, no
row was added, the menu's permissions were unchanged, and the stored pages and
components were unchanged. No successful booking was measured before the edit,
so this proves this closure request, not every rules operation. Bookings stay
closed. The pages' remaining invitation and the generic refusal are a separate
UX gap (the top of this file), not part of this milestone.

## A section headed by the kit — fixed (2026-09-26), merged and deployed in deploy 2162

**The defect.** The text guard named a section only by a literal
`<h1>`–`<h6>`, or by a `<section>`'s id or aria-label. A page built from the
kit writes `<SectionHeader title="Today's bake" />`, which a visitor sees as an
`<h2>`. So 'Remove the "Today's bake" section from the home page.' was
refused with a correct answer (409 `prose-preservation`,
`unconfirmed-target`), and the refusal asked for the heading the request had
given. The owner reproduced it independently: refused with `SectionHeader`'s
`title`, accepted with the equivalent literal `<h2>`.

**The rule now.** A kit component's heading names the section it opens, and
only where all of this is established; anything short of it stays uncertain,
which names nothing and so authorizes nothing.
- **Which component is the page's own import**, never the tag's spelling:
  `@/components/ui/<module>` (the template's one path alias; `.tsx` allowed),
  by name, under any alias (`SectionHeader as Heading`) or namespace
  (`UI.SectionHeader`). A default import, a type-only import, a local component
  called SectionHeader, a relative path, a name two imports bind and a name the
  page declares again are not it.
- **Which prop heads it** comes from `builder/kit-headings.mjs`, generated by
  `builder/gen-kit-headings.mjs` from each component's own source with the
  TypeScript parser: the prop the component always shows whole in a visible
  `<h1>` or `<h2>`. "Always" means one `return`, reached from the function body
  itself; nothing around the heading but plain HTML elements, a fragment or
  brackets; no condition but the prop's own truthiness; and nothing hiding it.
  **Of 64 components that show a prop as a heading's whole text, 20 qualify**,
  `SectionHeader.title` among them. Of the 44 left out:
  - 19 are card titles in an `<h3>` (`DishCard`, `PractitionerCard` …): naming
    a card must not authorize the section around it;
  - 19 can return without the heading (`CounterServices` …);
  - 6 are left out for other reasons: three `<h3>`s with a further reason, a
    condition on another prop (`HouseRules`), a heading reached through a
    variable (`StoryLead`), and one inside another component (`WelcomeCard`).

  A `title` shown in no heading at all (`Callout`) is not even
  a candidate. `test/kit-headings.test.mjs` re-derives the table and compares,
  so a kit change cannot leave a stale copy granting permission.
- **The value is a literal** (`title="…"` or `title={"…"}`), given once, on an
  element with no spread and nothing hiding it. A computed or template title is
  not known here.
- **It opens its section**: nothing that could show a heading comes before it
  there, whether a literal heading or another component. A second kit heading
  further down (a widget's title, a call to action) names that part, not the
  section around it. The literal reader keeps its own rule.
- **It names the whole section and nothing narrower.** "The X section" and "X"
  grant; "the X heading" and "the text under X" do not, because the kit's words
  are a prop, not prose the guard reads. They still count as a mention, so a
  name a kit heading shares with any other heading grants nothing.

**Measured over the 324-page corpus, with the product's own reader before and
after.**
- The table's components are used 890 times, 878 of them with a literal value;
  `SectionHeader.title` is 839 of them.
- Of the 616 sections that hold literal prose, 287 had a name before and 573
  have one now: 286 gained, none lost, and 43 still have none.
- Pages where no prose section had a name went from 86 to 10.
- The earlier scratch census counted 555 prose sections, with a different
  reader; its count of 329 unnamed agrees with this one.

**Evidence.** `test/edit-page-keep.test.mjs` gains 30 cases, and
`test/kit-headings.test.mjs` is new with 5. Every answer is supplied.
- **Through the real edit route, on both money paths:**
  - the `SectionHeader`-headed section's removal publishes, with both
    photographs and the site's own order form kept and no judge call;
  - the literal `<h2>` equivalent publishes too (the control);
  - that removal plus an unrelated paragraph lost is refused, for a kit and for
    a literal heading;
  - a request naming another page grants nothing, for both;
  - duplicate headings grant nothing, kit with kit and kit with literal;
  - a removal that also loses a photograph is withheld by the photograph wall;
  - one that also drops the order form is withheld when the judge finds it was
    not asked.
- **On the synchronous path:**
  - an alias and a namespace import publish;
  - a page's own SectionHeader, the name declared again on the page, a title on
    a component that shows it in no heading (`Callout`), a computed title and a
    heading that does not open its section each name nothing and refuse;
  - "the text under" a kit heading grants nothing while the literal heading's
    does;
  - a kit heading sharing its name with a literal one makes "the text under"
    it ambiguous.
- **A unit case** over every import and value shape, including a missing or
  throwing import reader (the kit's headings stay uncertain, the literal ones
  still name).
- **Red on the unfixed `6db00c42`: exactly 5 of the first 29** — the unit case,
  the kit removal on both paths, the alias and the namespace import. The 24
  refusals and controls pass on both. The 30th case was added after the red run
  for a probe and cannot be red there (the old code refuses everything
  kit-headed).
- **The owner's own reproduction pair is cases 2 and 3**: refused and accepted
  on the unfixed tree, both accepted now.
- **The rehearsal on fold-lane-bakery's real stored page** (scratch) now
  publishes the removal.

- **Probes, not a sweep** (`scripts/mutants/kit-headings.json`, over the four
  test files that can see the change):
  - 31 mutants: 30 killed, 1 survived, none that never applied, and both
    comment-only controls survived.
  - The survivor, a default import taken for the component, was inert by
    construction: a default import binds `default`, which no table key can be.
    So the clause was removed rather than kept, and the spec keeps the other 30.
  - The three swept files were byte-identical to their backups afterwards.
- **Suite 8,008 locally** (`8008 / 8006 / 0 / 2`), +35 against 7,973 — exactly
  the new cases.
- **CI on `2f2fed58`**: unit run `36231283319` reads `8008 / 8004 / 0 / 4`
  (the total matches; `pass` differs by CI's four skips). All 35 new cases pass
  by name, and none of the parent run's 7,973 names is missing. There are 8,008
  distinct result numbers and zero `not ok`. **`site build` run `36231283322`
  on `2f2fed58` passed**, all twenty steps (08:56:38 → 09:17:07Z, 20m29s),
  with all twelve counts read out of its per-step files: TAP 397/397/0/0,
  kit-typecheck 4, site-build 404, contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47, and kit-render /
  kit-a11y / kit-effects / kit-paint `all passed`; census 7 + 4 + 1 = 12. The
  only `##[error]` lines are the two known annotations, and `site-build.mjs`
  took 14m44s.
- **The image.** `builder/kit-headings.mjs` joined the Dockerfile's worker COPY
  line, so a merge rebuilds. The predicted id at `2f2fed58` is
  `209c520fb8b06cd3`, from 188 inputs (158 distinct paths); main reads
  `05750a5120d33570` (187), as recorded.

**The rendering context — the owner's review of `2f2fed58`, closed on the
branch at `5ec82214`.** The owner found one gap before merging: the heading's
own attributes were checked, but not what surrounds it. For 'Remove the
‘Today’s bake’ section from the home page.', `2f2fed58` accepted deleting this
whole section:

```
<section>
  {false && <SectionHeader title="Today’s bake" />}
  <p>Keep this unrelated public information.</p>
</section>
```

It did the same with the heading inside `<div hidden>` or an unknown
`<Opaque>` wrapper. *"A heading that cannot be established as rendering must
not authorize deletion of visible siblings."* Reproduced first: 15 of 15 such
shapes were accepted.

- **The rule now.** A kit heading names its section only where it renders
  whenever the section does:
  - nothing on the heading may hide it: `hidden`, `aria-hidden`, `style`,
    `popover`, a spread, a hiding class, or a class that is not a quoted
    string;
  - every step between it and its section is a fragment or one of a fixed list
    of plain HTML elements that show their children (`div`, `span`, `header`,
    `footer`, `main`, `nav`, `aside`, `p`, the list elements, `a` and a few
    more), with nothing hiding it by the same rule;
  - anything else leaves it uncertain: a braced expression (a condition, either
    arm of a ternary, a fallback, a `.map`, even a bare `{<…/>}` or a prop
    value), a component or member tag (`<Opaque>`, `<ui.Box>`,
    `<motion.div>`), or an element that does not simply show its children
    (`<details>`, `<dialog>`, `<template>`, `<noscript>`, `<svg>`, a custom
    element);
  - the section's own attributes are not asked: they show or hide the heading
    and its neighbours together;
  - an uncertain heading still comes first, so a heading after it does not
    open the section.
- **One class rule for the heading and every step**, the kit table's own:
  `hidden`, `invisible` or `sr-only`, with any breakpoint or state prefix
  (`md:hidden`, `group-hover:invisible`). Two effects on the heading element
  itself: `overflow-hidden` no longer counts as hiding (the old word-boundary
  test read it as `hidden`), and a computed or template class now counts as
  uncertain.
- **Measured over the 324-page corpus, with the product's own reader: no
  change.** All 573 named prose sections stay named and none loses its name.
  Every literal name is unchanged, and 701 sections carry a kit name before
  and after. Of the 796 kit headings inside sections, 372 stand directly in
  them, 419 sit behind plain `<div>`s (one also passing through an `<aside>`),
  and 5 sit behind a condition or the kit's `MediaObject`. Those 5 already
  named nothing on `2f2fed58`, because something came before them.
- **Test 4a's Part A is unaffected**: the rehearsal on fold-lane-bakery's real
  stored pages (scratch) still publishes the "Today's bake" removal, 13 of 13.
- **Evidence.** 9 new cases in `test/edit-page-keep.test.mjs`, every answer
  supplied:
  - a unit case: 37 shapes that do not establish rendering name nothing — all
    37 named the section on `2f2fed58` — and 9 positive controls name it
    (directly, behind nested `<div>`s with `overflow-hidden`, a `<header>`, a
    fragment, an id with a literal class, a braced literal class, an alias, a
    namespace, and the heading's own `overflow-hidden`). It also covers the
    uncertain-first rule and the section's own attributes;
  - through the real edit route on both money paths: the owner's three shapes
    are refused (409 `prose-preservation`, `unconfirmed-target`, nothing
    compiled or stored, no charge or reservation, nothing bought by the
    browser); the same heading inside ordinary visible elements publishes,
    with both photographs and the order form kept;
  - **red on `2f2fed58`: exactly 7 of the 39 kit cases** — the unit case and
    the six route refusals. The two route controls and all 30 earlier kit
    cases pass on both. The unit case fails first there on its one loosened
    control (the heading's own `overflow-hidden`); with that control cut, it
    fails on the owner's `{false && …}` section;
  - **a positive control caught a trap before it shipped**: the parser
    adapter's `k()` reads a template literal back as `FirstTemplateToken`, an
    alias in TypeScript's kind enum, so a check against
    `NoSubstitutionTemplateLiteral` could never match. A class is now read only
    as a quoted string, which is how the title value was already read;
  - **the value reader's own spread check was dead** once the heading's
    attributes are cleared first, so it was removed; K-10, K-11 and K-12 in
    `scripts/mutants/kit-headings.json` are re-anchored to the shared check;
  - **probes, not a sweep**, over the same four test files (`edit-page-keep`,
    `kit-headings`, `site-tweak`, `edit-page-contract`):
    `scripts/mutants/kit-render.json`, one mutant per clause of the rule, 22
    mutants, 22 killed, 0 survived, 0 never applied, its comment-only control
    surviving; and `kit-headings.json` re-run, 30 mutants, 30 killed, both
    controls surviving. The three probed files were byte-identical to their
    pre-probe copies afterwards;
  - **suite 8,017 locally** (`# tests 8017 / # pass 8015 / # fail 0 /
    # skipped 2`, `duration_ms 117,272`), +9 against 8,008, exactly the new
    cases;
  - **CI on `5ec82214`**: unit run `36234086257` reads `# tests 8017 / # pass
    8013 / # fail 0 / # skipped 4` (`duration_ms 119,899`); the total
    matches, and `pass` differs by CI's four skips. All 9 new cases pass by
    name, and none of the parent run's names is missing (run `36231869456` on
    `e240f78a`, 8,008). There are 8,017 distinct result numbers and zero
    `not ok`. **`site build` run `36234086268` on `5ec82214` passed**, all
    twenty steps (09:52:35 → 10:17:13Z, 24m38s), with all twelve counts read
    out of its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build
    404, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
    site-runtime 47, and kit-render / kit-a11y / kit-effects / kit-paint `all
    passed`; census 7 + 4 + 1 = 12. The only `##[error]` lines are the two
    known annotations, and `site-build.mjs` took 17m59s.
- **The image.** `builder/page-prose.mjs` is an image input, so a merge
  rebuilds. The predicted id at `5ec82214` is `369d7b1e5bae25b0`, from 188
  inputs (158 distinct paths); the same reader reproduces `2f2fed58`'s
  `209c520fb8b06cd3` and main's `05750a5120d33570`. **Deploy 2162 built and
  rolled exactly that id** when `ab74d0d9` was merged (2026-09-26, 20:31 UTC).

**Limits.**
- Every writer and judge answer is supplied, so what a real model writes is
  unproven until Test 4a's Part A.
- A heading this rule leaves uncertain still refuses, as before the fix: a
  component that can return without it, one that shows it through a variable,
  a computed title, and a kit heading that does not open its section.
- A class that hides through CSS this check does not read — the site's own
  stylesheet, `opacity-0`, a zero size — is not read, here or in the kit
  table.
- A kit wrapper that always shows its children (a layout component) is
  treated as unknown: the table describes headings, not wrappers.
- **Found, not changed: the literal reader has no rendering check.**
  `{false && <h2>Today’s bake</h2>}`, `<div hidden><h2>…</h2></div>` and
  `<Opaque><h2>…</h2></Opaque>` each name the section, and removing its
  visible paragraph is accepted (measured). In the corpus, 4 of the 278 literal
  headings with words inside sections sit behind a condition. The owner
  bounded this correction to the kit recognition, so aligning the literal
  reader is separate work.
- **Found, not changed:** the literal reader names a section by **every**
  literal heading inside it. So "Remove the ‘Sourdough’ section", naming a
  card's `<h3>`, authorizes the whole enclosing section's prose. The kit rule
  is deliberately narrower (h1/h2 only, the heading that opens the section).
  Aligning the literal reader is separate work.

## The two findings from the rollback round (2026-09-26), and the two rule-key defects found in their review — merged and deployed at `0de188ff` (deploy 2161); CLOSED by the owner 2026-09-26

After reviewing the merged batch, the owner asked for both findings to be
closed together before the paid Test 3. The work was to use focused tests and
required CI, and to come back for review before another merge or deployment.
The owner's review passed at `0de188ff` (288 focused tests), and the batch was
then merged and deployed as deploy 2161 (see *Merged and deployed at
`0de188ff`* below). Nothing that spends was dispatched. Every model answer in
the evidence is supplied, so the tests prove what the route and the browser do
with an answer, never what a real model answers. **Deploy 2161 is
runtime-confirmed** by your free canary, run 33 (see *Merged and deployed at
`0de188ff`*). The session's own attempt had answered 403.

| Item | Status | Evidence |
| --- | --- | --- |
| An old stylesheet rule that matched nothing held an unrelated edit, and the correction round rewrote the stylesheet nobody asked about | reproduced defect, fixed; deployed in 2161 | A publish is held only for the rules this request wrote. On the unfixed code the menu edit ran a correction and a second build, and the stored sheet was rewritten (each checked on its own). |
| A new rule that points at nothing is still held and corrected | demonstrated (both money paths) | The correction is asked about that rule alone, never the old one. The job's second publish checks the corrected rule, and the correction that lands is stored. |
| A container still on the previous image | demonstrated (job) | It judges every rule, and the route's own filter still holds the publish for the new rule alone. |
| A failure of ours whose restore was refused too said only "our build service was restarting", while the change stayed saved and the next edit shipped it | reproduced defect, fixed; deployed in 2161 | Every arm of the failed-publish sentence now says the change is still saved when the restore failed. Driven on both money paths, plus a gate refusal, a real compile failure and a cancel. |
| The add-on route logged a revert that failed and still called the site untouched | reproduced defect (the same class, one route over), fixed; deployed in 2161 | The reply now says the addition is still saved. |
| Review finding: the rule key collapsed whitespace inside quoted values, so a lane that respaced `[data-label="a  b"]` to one space shipped a selector matching nothing, unjudged | reproduced defect (both money paths), fixed; deployed in 2161 | The compiler was sent `cssVerify: []`, the job committed, and the screen said the look was updated. Now the respaced rule is sent to be judged, found dead against the page, and corrected (both paths), or refused when the correction still misses (job). |
| The same collapse on quoted declarations, quoted at-rule conditions, escapes and whitespace before a colon inside a selector | reproduced (unit), fixed; deployed in 2161 | Thirteen more pairs answered `[]` on the old module, each measured; each is now named. A quoted declaration and a quoted `@scope` root are also driven through the route. |
| The harmless formatting control | demonstrated, kept | A sheet answered back with only the whitespace CSS ignores is sent to be judged for nothing (both paths); also held over 1,500 random sheets carrying quoted values and escapes. ⚠ That property's generator was degenerate and barely formatted anything until item 4 (below). Made exact and re-measured, it still holds. |
| Second review finding: a comment read as whitespace. The key made `.a/**/.b` (the compound `.a.b`) and `.a .b` (a descendant) one rule, and `plainSelectors` handed the judge `.a    .b` for the first | reproduced defect (both money paths), fixed; deployed in 2161 | On `e49a370c` the lane's `.a .b` shipped with `cssVerify: []`, nothing judged, and "Updated the look". Now it is sent, found dead against the page and corrected (both paths), or refused (job). A new rule written with a comment is judged as the compound it is. |
| Which spelling reaches the page | demonstrated in a real Chromium | A browser control in the site build (`site-build.mjs`) establishes the fixture table the unit cases judge by. |
| Harmless formatting and a comment spelled another way | demonstrated, kept | A comment beside whitespace, a brace, a semicolon, a comma, a colon or a bracket names nothing; the same boundary spelled `/* x */` names nothing (both paths). |

**1. A publish is held only for the rules this request wrote.**
- The route records the sheet the css lane was shown and the sheet it stored.
  The rules that differ between the two are this request's
  (`changedSelectors`). Only those are sent to the build service
  (`cssVerify`), and only those can hold the publish.
- "Differ" is decided per rule: the at-rules around it, its selector list and
  its declarations. Whitespace that CSS ignores does not count. A rule the
  request recoloured is judged even though its selector is old, because the
  request wrote it.
- The build service judges exactly the named rules the sheet has
  (`selectorsToJudge`). With no list it judges every rule, which is what every
  build and every publish that asks nothing does.
- Scoping the measurement, not only the decision, keeps a new rule in view.
  The report caps its dead list at 24 and the judge caps its selectors at 300.
  Both count from the top of the sheet, where old rules sit, while a lane
  appends its new rule last.
- The spine also filters the report by the list. That is the belt for a
  container still on the previous image, which judges every rule whatever it
  is sent.
- The hand-over to the publish is made only once a changed sheet is stored. It
  used to be made when the css lane was picked, before the lane had answered.
- One walker serves `plainSelectors` and `changedSelectors`, because the gate
  matches the two lists by equality. Before the change, the old and new
  `plainSelectors` were compared over 27,622 stylesheet-like inputs (4,848 with
  selectors), and no difference was found.

**2. A failed restore is said by every formatter.**
- `compileMsg` takes the restore's result (`kept`) on every arm. Where an arm
  said "nothing was changed", it now says "your live site wasn't changed". Every
  answer then ends with one sentence: "The change itself is still saved,
  though, so it could go out with your next edit."
- That sentence (`KEPT_CHANGE_NOTE`) is one constant, shared by `compileMsg`,
  the stop helper `editStopped`, the correction round's catch, and the add-on
  route's failure reply.
- The route's own compile sentence now reads "That didn't compile, so your live
  site wasn't changed." when the change stays saved.
- Nothing claims a rollback or a refund. Each path's money is stated from what
  it recorded: the direct path keeps what it collected, and a queued job is
  refunded by the consumer.
- "Not published" and "not saved" are separate statements. The first sentence
  says the change did not go through; the second says it is still saved.
- The exact screens, driven:
  - Direct, the store refusing the publish: "⚠️ That didn't go through — our
    build service was restarting. Try again in a moment. The change itself is
    still saved, though, so it could go out with your next edit. This edit
    cost 2 credits. Reading your message cost 2 credits." The ledger holds the
    one debit of 2.
  - Queued, the same: the same first three sentences, then "This edit cost you
    nothing." The job is refunded.

**3. A quoted value, an escape or a selector's own whitespace is part of the
rule** (the owner's review of item 1: *"Preserve meaningful whitespace and
escapes inside quoted selectors, declarations and at-rule conditions. Normalize
only where equivalence is established; uncertain differences should remain
changed."*).
- **Reproduced first**, through the real edit route on both money paths. The
  page carries `data-label="a  b"`, and the css lane, picked beside a menu
  change, answered the sheet back with the value respaced to one space. The
  compiler was sent `cssVerify: []`, one build shipped the broken selector, the
  job committed, and the screen said "✅ Updated the look — the design. …".
- **The cause was two layers.** The key collapsed whitespace and stripped it
  around punctuation everywhere, strings included. It also read the walker's
  blanked copy, where comment-shaped text inside a string had become spaces.
- **The fix is bounded to the key.** The walker also cuts each rule's own text
  at its offsets. The key reads that text keeping strings, escapes and unquoted
  `url(…)` as written. Whitespace is dropped only where CSS defines it as
  nothing: at either end; next to a comma; next to a block's `{`, `}` or `;`;
  next to a declaration's own colon and its `!`; next to a feature's colon in a
  condition. Empty declarations are dropped too. Every colon in a selector
  keeps its whitespace. What the build service judges is unchanged.
- **The direction:** anything else reads as changed and is judged. That covers
  quote style, an empty selector-list item, a no-break space, whitespace inside
  an unquoted `url()`, and a second colon in a value. One equivalence is new:
  empty declarations, which the old key read as changed.

**4. A comment is a token boundary, not whitespace** (the owner's second
review: *"Preserve selector meaning across both readers. Do not simply delete
every comment and concatenate tokens; that can change token boundaries. Keep
uncertain differences classified as changed."*).
- **Reproduced first**, on `e49a370c`, through the real edit route on both money
  paths. The page carries `<p className="a b">` and nothing inside it. The
  stored rule `.a/**/.b{…}` reaches it; the lane answered `.a .b{…}`, which
  reaches nothing. The compiler was sent `cssVerify: []`, nothing was judged,
  the sheet was stored and published, and the screen said "✅ Updated the look —
  the design. …".
- **Two readers, one cause.** CSS consumes a comment without producing
  whitespace, so `.a/**/.b` is the compound `.a.b`: a real Chromium serialises
  that rule as `.a.b` and applies it to the paragraph. The key read the comment
  as whitespace, so the two spellings were one rule. And `plainSelectors` cut
  its selectors from the comment-blanked copy, handing the judge `.a    .b` for
  the compound — a descendant, the wrong meaning. (It also blanked a
  comment-shaped attribute value, `[data-x="/* a */"]`, into spaces.)
- **Why not just delete comments.** A comment is not nothing everywhere: `a/**/b`
  is two tokens and `ab` one; so are `1/**/.5` and `1.5`.
- **The rule, shared by both readers:**
  - A comment touching whitespace, or at either end, is part of that whitespace.
  - A comment beside a delimiter no token merges across is nothing. The
    delimiters are `{ } ; , : [ ] )` on either side, plus `(` and `>` before
    the comment. `x(` would make a function, and `-->` the end of an HTML
    comment.
  - Any other comment is kept as a boundary, spelled `/**/`. So an uncertain
    difference (`.a/**/.b` against `.a.b`) reads as changed and is judged.
- **What the judge is handed.** Each selector is cut from the sheet's own text
  at the offsets the blanked copy gave. It is respelled only where a comment
  touched it, so a comment-free selector is byte-for-byte what it was.
- **During a roll, stated.** The build service spells the judged strings and
  the edit route names them, and the gate matches the two by equality. A job
  runs both halves in one container image. So only an edit that runs in the
  Worker, against a container still on the previous image, can leave a
  comment-bearing selector it changed unjudged, until the roll completes.
  Comment-free selectors are spelled identically by both versions.
- **Evidence:**
  - **Old against new `plainSelectors`**: 0 differences over 21,332
    comment-free inputs (4,440 with selectors). The inputs are the tests'
    literals, the theme registry and a fuzzer on an exact generator.
  - **The judged strings, audited in a real Chromium (run locally, not
    committed)**: 6,000 random selectors with comments placed at random
    (4,254 of them respelled). For every one, the browser's own parse and its
    `querySelectorAll` read the written selector and the judged string
    identically, or refuse both. The old reader fails the same audit on
    1,959 of the 6,000.
  - **Unit tests**: `test/css-scope.test.mjs` goes from 9 to 12 cases: the
    owner's pair and the fixture table; a comment CSS reads as nothing; and a
    comment beside what may merge, read as changed. The formatting property
    now also wraps every delimiter in a bare comment (49,134 comments, naming
    nothing).
  - **Route tests**: `test/edit-failure-paths.test.mjs` goes from 47 to 55
    cases, judged by the browser's table:
    - the rewritten rule is sent, found dead and corrected (both paths);
    - it is refused when the correction still misses (job), and the next edit
      ships the stored rule;
    - a new rule written with a comment is judged as the compound it is and
      ships with no correction (both paths);
    - formatting, and the same boundary spelled `/* x */`, send nothing (both
      paths).
  - **The browser control**: `test/integration/site-build.mjs` runs in the
    site-build workflow with a real Chromium. For every spelling in
    `test/fixtures/comment-boundary.mjs` it checks three things:
    - that the page's cascade applies the rule as written or does not;
    - that `plainSelectors` hands the judge the table's string;
    - that the page's own `querySelectorAll` agrees with the cascade.

    It then runs the real render check over the owner's pair, which reports
    `.a .b` dead and `.a/**/.b` alive.
  - Run locally: 22 of 22 checks pass. On the old reader 5 fail, and its render
    check reports both rules dead. The workflow now runs when the table
    changes.
  - **Red on `e49a370c`: 9 of 67 in the two files.** Those are the three new
    unit tests and six route cases. The two route formatting controls, both
    properties and every retained case pass there.
  - **The first cut judged junk, found by measuring the count changes.**
    With the 200-character bound lifted, 9 of 203 remained, each junk with no
    name in it (`~/**/+`). The kept boundary's `*` read as the universal
    selector. No false alarm could follow (the browser throws, and a throw is a
    hit), but it counted as judged. Fixed in `9aef0ca2`: now 194 of 194 count
    changes are the length bound, none downward.
  - The unit formatting control fails on the old code only on two lines:
    `.a>/**/.b` and `.a/**/[x]`. The old key read those comments as
    descendant spaces (`.a    [x]`, which is the wrong meaning) and named the
    rules. That is the safe direction.
  - The 67 focused files read 2,016 / 2,016. The suite locally reads
    `7973 / 7971 / 0 / 2` (+11: `css-scope` +3, `edit-failure-paths` +8).
  - **Unit CI** on `3cee046f` (run 36220333869) reads `7973 / 7969 / 0 / 4`,
    with all 20 cases of the two changed test files found passing by name,
    7,973 distinct result numbers and no failure.
  - **Unit CI** on `9aef0ca2` (run 36220840818) and on the documents commit
    `0de188ff` (run 36220937877) both read `7973 / 7969 / 0 / 4`, with the 20
    cases of the two changed test files passing by name on both.
  - **Site build on `9aef0ca2`** (run 36220840763, 21m00s, all twenty steps)
    has all twelve counts green: TAP 397, site-build **404** (382 plus the
    control's 22) and the rest as recorded, with only the two known
    annotations. **The browser control, read from that run's own step file:
    22 ok, 0 FAIL.** For each of the six spellings, the cascade applies the
    rule exactly where the table says; `plainSelectors` hands the judge the
    table's string; and `querySelectorAll` agrees with the cascade. The real
    render check, asked about `.a/**/.b` and `.a .b`, reports exactly
    `.a .b` dead.
  - The parent `3cee046f`'s site build (run 36220333864) passed the same way.
    It is on record, and not used in place of `9aef0ca2`'s.
  - There was no mutation sweep, per the instruction; the red run is the
    evidence the cases bite.
- **⚠ Found in my own evidence, fixed: the property tests' random generator
  was degenerate.** `(seed * 1103515245 + 12345) & 0x7fffffff` overflows 2^53,
  so every seed became a multiple of 512 and `rnd(2)` answered 0 in 19,920 of
  20,000 calls. Consequences:
  - Item 3's formatting property inserted formatting only 183 times across its
    1,500 sheets.
  - The gate battery respaced a sheet 3 times in 3,000 pairs and used 6 of its
    12 selectors.

  Now it uses exact 32-bit arithmetic read from the high bits:
  - 24,558 random insertions, plus 49,134 bare comments;
  - every way a lane answers a sheet reached 475–513 times;
  - both properties still hold.

  The floors now prove it: a floor on the insertions, and every way reached.

**What these cases assert.** Each one checks the stored configuration, the exact
browser reply, the ledger and the next edit:
- The menu-edit case: the next edit builds once with the same sheet.
- The failed-restore case: the next edit ships the saved change, exactly as the
  sentence warns.
- The controls: when the restore lands, nothing is said about a saved change,
  and the next edit does not ship it.

**Evidence.**
- `test/edit-failure-paths.test.mjs` goes from 29 to 39 cases: 4 removed and 14
  added. The 4 removed were the previous round's "the correction was the only
  config write" cases and their controls. Their premise, a correction running on
  an unchanged sheet, is exactly the defect this fixes, so the shape cannot be
  built any more. `test/css-scope.test.mjs` is new, with 5 cases. The add-on
  route gains 1 case.
- **Red on the unfixed `222d1182`: 14 failures.** Those are the 12 new behaviour
  cases and 2 re-anchored guards. The new cases that pass there should pass
  there: the two restore-lands controls, the cancel case (its sentence was
  already right), the reachability case, and css-scope's four reader cases.
- **Re-anchored, not appeased**: four older guards read the exact code this
  changes (`edit-queue`, `site-migrations`, `edit-reserve-refused`,
  `publish-clock`). `publish-clock` sat outside the 47 focused files, and only
  the full suite found it. It now asserts the order it cares about, and an
  order mutant turns it red.
- **Probes, not a sweep**: `scripts/mutants/css-scope.json` killed 19 of 19,
  with 0 survived, 0 never applied and the control surviving. Separately,
  `rollback-gaps.json` killed 2 of 2 with its control surviving. Both ran over
  47 focused files, and every swept file was byte-identical afterwards.
- **Two walls, measured by hand**:
  - With the correction's write flag removed alone, every case passes, because
    a correction always follows the look step's own flagged write. With it
    removed beside the look step's flag, 14 cases fail.
  - With the look step's `cssMoved` condition removed alone, every case passes,
    because an unmoved sheet names no rule. With it removed beside a
    whole-sheet list (the defect back), 6 cases fail.
  - Both are kept, and the reason is written in the code.
  - `rollback-gaps.json` drops R-1, the flag alone, and re-anchors R-3.
- The 47 focused files read 1,682 / 1,682. The full suite reads
  `7950 / 7948 / 0 / 2` locally: +16 against 7,934, which is 10 + 5 + 1 net
  new cases.
- **Unit CI** on `c084e5c5` (run 36213341827) reads `7950 / 7946 / 0 / 4`,
  with all 24 new or re-anchored cases passing by name.
- **Site build** on `c084e5c5` (run 36213341839, 24m39s, all twenty steps)
  has all twelve counts green: TAP 397, site-build 382, and the rest as
  recorded. The only annotations are the two known ones.
- **Item 3's evidence:**
  - `test/css-scope.test.mjs` goes from 5 to 9 cases. They cover the reproduced
    shapes, the formatting control with quoted values present, the
    equivalences CSS does not establish, and a property over 1,500 random
    sheets (3,470 selectors judged; 1,428 sheets carrying a quoted value).
  - `test/edit-failure-paths.test.mjs` goes from 39 to 47. The page judge reads
    an attribute selector against the value the page's own source carries.
  - **Red on the unfixed `933168ea`: 8 of 56**: the three new unit tests and
    the five route cases carrying the defect. The unit formatting control fails
    there only on its two empty-declaration lines, which the old key read as
    changed (the safe direction).
  - The 49 focused files read 1,728 / 1,728. The suite locally reads
    `7962 / 7960 / 0 / 2` (+12).
  - **Unit CI** on `991b9204` (run 36216866723) reads `7962 / 7958 / 0 / 4`,
    with all twelve new cases and the battery passing by name.
  - **Site build** on `991b9204` (run 36216866790, 22m42s, all twenty steps)
    has all twelve counts green (TAP 397, site-build 382, and the rest as
    recorded) and only the two known annotations.
  - There was no mutation sweep, per the instruction; the red run is the
    evidence the cases bite.
- **Checked by shape only**: the add-on route's schema-refusal sentence when
  the revert is refused too. The add-on's compile arm is driven. But no harness
  makes the add-on's database apply refuse, and that arm's plain sentence has
  only ever been asserted by shape (`site-migrations`); the new variant is
  asserted the same way.

**Found on the way, not changed:**
- Beside an unchanged look, the menu change is not named in the reply; it reads
  only "The requested styling was already in place." This is the look branch's
  recorded limitation (review #9).
- The look step's own rollback block after `publishStep` is unreachable,
  because `publishStep` defers and always answers ok. Its guard in `site-apply`
  pins it.
- **The walker does not honour a backslash-escaped quote, and a rule after one
  is invisible to both readers.** `.q{content:"\""} header button{color:red}`
  gives `plainSelectors` `[".q"]`, so a broken rule written after such a
  declaration is never judged. The build service's own selection is blind the
  same way. Pre-existing, and not introduced by scoping. Fixing it changes what
  every build judges, which is beyond the key.
- After a correction that restores the sheet the site had, the screen still
  says "✅ Updated the look — the design. …" and names no menu change. The
  reply is composed from the lane's first answer (review #9's class).
- The check reads a rule's own selector, never an `@scope` root or another
  condition.

**The press that confirmed deploy 2161 at runtime — free, pressed by you as
run 33** (see *Merged and deployed at `0de188ff`*). It also confirms
everything deploy 2160 carried, since 2161 runs that code too. The form shows
each box's description:
- <https://github.com/canias7/isibi-app/actions/workflows/edit-canary.yml>, run
  from `main`.
- "Run the ONE paid edit as well": `no`.
- "Refuse to spend unless the Worker reports this deploy sha":
  `0de188ff2d3a00d8096b01f8616c507aea2bbce4`.
- "Refuse to spend unless a cold container reports this image id":
  `05750a5120d33570`.
- Every other box at its default.

## The consolidated milestone (2026-09-25, late) — merged and deployed at `7384ddba` (2026-09-26)

The owner asked for one batch across six areas. Each item below is marked
**demonstrated**, **reproduced defect** (now fixed), **unverified** or
**deferred**. The batch was reviewed at `4f6ab55c` and merged and deployed with
the rollback round at `7384ddba` (deploy 2160). Every model answer in the
evidence is supplied, so the tests prove what the route and the browser do with
an answer, never that a real model gives it.

### 1. Target selection

| Item | Status | Evidence |
| --- | --- | --- |
| A quoted or unreadable page after "on" dropped out unread (`d6f5e55e`) | reproduced defect, fixed | Independent review: 188 focused tests, both CI checks green. |
| "Remove the ‘Chords’ section on the menu" removed it from `/` on a site with `/menu` | reproduced defect, fixed (`01222bab`) | The guard reads the site's own page names: each page's last address segment and every label its own menu links with. 13 cases, red 6 of 201 on the parent. Probes `page-names.json`: 18 killed, 2 controls. |
| An unknown or shared page name authorising another page | demonstrated | A name two pages share names neither; words that name no page on the site ("at the top") keep their meaning. |
| Quoted replacement text kept as data; collateral-removal controls | demonstrated | The existing `edit-page-keep` controls pass unchanged. |

### 2. Failure and billing paths

| Item | Status | Evidence |
| --- | --- | --- |
| A routing answer that cannot be acted on dropped the message's words and files | reproduced defect, fixed (`9e70f093`) | `lost()` holds them on the site they came from. 9 cases red on the parent; the 33 stop cases in `site-route-failure` now assert the hold. |
| Unintended paid reconstruction from an edit or add-on escalation | demonstrated, no new defect | `EDIT_FAILURES` census, the add-on correction (`5cb8592`), and reply validation on both readers. Ordinary add-on failures stop with a sentence; the add-on route asks for a rebuild only when saved state is verified missing (the conditions are listed below this table). |
| A stopped edit's unpublished design was shipped by the next edit | reproduced defect, fixed (`324bc47a`) | Cancel, correction still missing, no time left: the design is put back. 3 of 4 red on the parent. |
| The logo rung read bare strings, not the composer's `{name, data}` | reproduced defect, fixed (`51e39e3c`) | 4 of 5 red on the parent. |
| Refusal and partial wording: the routing charge, the charged refused step, "nothing was charged" | reproduced defect, fixed (`908c12ee`) | Server sentences say what happened; the browser states the edit's cost from the reply and the routing call's from the routing reply. A finished job's cost comes from its own row. A refused step's charge is on its entry and said beside the change that shipped. 8 of 15 red on the parent. Probes `edit-money.json`: 17 killed, 2 controls. |
| An unknown outcome sent the customer to the preview, which cannot show a data or rules change | reproduced defect, fixed (`a3efddef`) | It now says asking again could make the change twice. Red on the parent over four layers and three unknown shapes. |
| A change that went through before a failed publish was called untouched | reproduced defect, fixed (`90efa38d`) | A new address, a table rule and a saved row are named ("Part of it did go through, though: …"). 6 of 7 red on the parent, the control green on both. Probes `landed-changes.json`: 11 killed, 1 control. |

**When the add-on route may ask for a rebuild.** A no-layer escalate from the
add-on route is the only add-on answer the browser turns into the full
rewrite, and the route produces one in exactly one place: the
`reconstruct: true` call in `worker.js` (`addonFailure` ignores the flag for
every reason but `no-source` and `no-meta`). It is reached only when every one
of these holds, in this order; each earlier failure stops with its own
sentence instead:

1. The message is not empty, and the picked model's key is configured.
2. The editable-state check passes and the page read succeeds
   (`loadSiteSourceForEdit` with `checked: true`). A failed read or a failed
   recovery stops (`editable-state`, `no-source`).
3. The database state is readable (`siteBackendDetail` is not `unreadable`).
4. The strict config read succeeds and, when the site has a database, the
   schema read succeeds (`specForAddon`). The spec must be well formed: a
   `tables` list, each with a name and a columns list. Otherwise it stops
   (`no-meta`).
5. It is not a stylesheet with no saved look. That is existing design, and it
   stops (`no-look`).
6. The saved state is positively missing: the page list read back empty
   (`no-source`), or no saved look and no stylesheet (`no-meta`).
7. The build configuration is present: the site database, the service key and
   the model key. Otherwise it stops (`unconfigured`).
8. The remaining component files read back under a strict read. Otherwise it
   stops (`no-meta`).

Only then does it answer `{ok: false, escalate: true, reason}` with no layer.
The browser climbs on that shape alone (`readAddonReply`'s `climb`); a
malformed escalate stops. The one other hop is a photograph asked for alone,
which goes sideways to the picture layer as a single edit, not a rebuild.

### 3. Database context on full rewrites

| Item | Status | Evidence |
| --- | --- | --- |
| An `incomplete` site's revise gave the writer the frontend rules | reproduced defect, fixed (`80ce60f4`) | The four-state reader resolves and proves the database read-only; the writer gets the database rules and the stored digest. |
| An unreachable database was treated as no database | reproduced defect, fixed (`80ce60f4`) | The revise stops, refunded, with `backend-unreadable`. |
| A `ready` site's revise digest lacked the site's functions | reproduced defect, fixed (`80ce60f4`) | Tables, functions and outside connections merge by name, the request's own entry winning. |
| Nothing repairs or provisions | demonstrated | Every query is a read; no reference write and no provisioning call, asserted. 5 cases, red 4 of 5 on the parent. |
| The new stop also fired on a first build, right after its database was made | reproduced defect, fixed (`8f66dfb9`) | Found while recording `80ce60f4`: a first build with a supplied schema, provisioned, catalog read refused, stopped with the revise's sentence. The stop is now for a revise alone; a first build builds on the schema it just applied, as before. 1 case, red on `80ce60f4`. Probes `revise-backend.json`: 9 killed, 1 control. |

### 4. Free coverage across the edit paths

All controlled, all with supplied answers. **No coverage test was added
without a concrete gap, and none was found.**

- **A second message after success, refusal and failure:** `edit-lock` (25
  two-message cases), `edit-result-display`, and the next-edit checks in
  `edit-failure-paths`.
- **Photographs:** preserved, restored and refused (`withheld`) on both
  writers, with authorised removal kept: `edit-page-photos`,
  `edit-page-protect`.
- **Deliberate component modification:** `edit-page-context` ("one changed
  component leaves the other exactly as it was", rendered with React) and the
  `edit-page-contract` route cases. Live: runs 21 and 24 changed
  `day-space-lookup`.
- **Picture, data and rules edits:** `edit-failure` (the data rung on an
  `incomplete` site, a component's photograph), `edit-rules-backend`,
  `edit-page-once` (the picture step), and the landed-change cases.
- **Partial success and queued completion:** `edit-failure` (mixed and
  all-refused), `edit-page-once` and `edit-failure-paths` (both money paths),
  `edit-reply-validation` and `edit-lock` (queued).

**Unverified live:** the full writer with the text guard and the judge; a
second message from the same browser; photographs; a live add-on; the picture,
data and rules rungs.

### 5. Deferred and known limits

- #418 (phone-width hydration) stays open.
- **Build path money wording.** "You weren't charged", `BUSY_BUILD_MSG`,
  `GATED_BUILD_MSG`, `STALE_BUILD_MSG`, the build timeout and `NO_CONTAINER_MSG`
  do not mention the routing charge. "Your database is live" is also said on a
  site that has none.
- **Add-on money wording.** The add-on reader states no routing charge, and
  `lostPhotosMsg` still says "nothing was charged".
- **Two money policies.** The synchronous path keeps a failed publish's
  collections, while the job path refunds them. A job also refunds a rename,
  row or rule that landed before its publish failed. Both are now reported
  from the ledger.
- **Text-guard grammar limits.** A site page name used as an ordinary word after
  on/in/from reads as that page and fails closed. Trailing commentary voids a
  clause.
- **The two rollback edges: closed** (the next round, `edit-failure-paths`).
  - *The correction's write flag* was the only record of a write when the css
    lane answered the stylesheet unchanged beside a step that publishes, and a
    stale rule then started the correction round. **That shape was the
    stylesheet-scope defect, and it cannot be built any more** (fixed on the
    branch, see the top section). A correction now always follows the look
    step's own flagged write, so the flag is a second wall rather than the only
    one. Measured by hand: with the flag alone removed, every case passes; with
    it removed beside the look step's flag, 14 cases fail. The four cases that
    drove the old shape went with it. The direct path's corrected build refused
    by the store is still driven, with the old sheet put back and a next edit
    that does not ship the correction.
  - *The verify catch* cannot be reached by any failure the round can meet,
    because every operation inside it handles its own. Driven at each
    boundary: the correction's model call failing, its write refused, and the
    corrected build refused by the store and by the publish gate. Each lands
    on its own named outcome and puts the design back. With a marker in the
    catch, the whole suite (7,934 tests) reached it zero times. The catch
    stays as the defence against a defect in our own code.
- **A failed restore after a publish failure of ours was not said — fixed,
  merged and deployed in deploy 2161** (the top section). `compileMsg`
  answered a failure of ours (and a refused reservation) with its own
  sentence, which dropped the one carrying "the change is saved". Every arm now
  takes the restore's result.
- **The stylesheet check read the whole stored sheet, not this message's rules
  — fixed, merged and deployed in deploy 2161** (the top section). A rule left
  dead by an earlier change started the correction round on any later message
  that picked the css lane, and the correction rewrote a rule the customer
  never mentioned. A publish is now held only for the rules the request wrote.
- **A new cost.** A `ready` site whose tables cannot be recovered now has its
  revise refused, where before it was revised with the partial spec.
- Drafts last for the session only. The needs-review enqueue sentence is never
  shown.
- Real-model compliance is unproven throughout.

### 6. Live acceptance — Test 3: pressed as run 34, all seven items hold; CLOSED by the owner (2026-09-26)

**The result.** Run 34 (run 36224239033, your paid press, from `main` at
`0de188ff`) counts as the test, and every acceptance item below holds:
1. **It counts as the test.** The request sha matches (63 characters). Its own
   before-read equals the six bodies, the preflight passed with both
   expectations, and a stored terminal reply arrived.
2. **Published at the job's own version.** A stored 200 arrived under
   `x-gf-edit: final` at 376.5 s. `x-site-version` moved to
   `01790404806543-kk6qsh`, minted 06:40:06Z inside the run. `compare.json`
   reads VERIFIED.
3. **The removal, in the stored source.** The chords block is gone; the unused
   `ChordDiagram` import and the `CHORDS` data went too (noted, not failed).
   Every other block and all other code is byte-identical, and the page lost
   exactly the removed code's 487 tokens and gained none. It is byte-identical
   to the removal built by hand as the evaluator's control.
4. **The other five files** are byte-identical. `chord-diagram` is still
   stored.
5. **The live page, in a real Chromium at `kk6qsh`:**
   - the headings are in the expected order, with 0 chord diagrams;
   - the rendered text is the before-reading's (taken at 06:39Z) with only the
     chords section cut out, 543 → 450 words;
   - the guitar draws and turns, and the day box is right for four days
     against the real `bookings_on_day`;
   - 0 console errors, 0 failed requests;
   - `/prices` and `/gear` render identically, and `/prices`' three `gbp_eur`
     502s were there before the edit too;
   - `/fr` and `/es` lost the section too.
6. **Money.** 91 → 73 = route 2 + edit 16. The ledger holds one reserve of 16
   (balance after 73) and no refund; the job is `finalized`, cost 16.
7. **The reply**, *"✅ Updated /. …"*, is true. The render check's #418 finding
   (on `/`, `/es` and `/fr` at phone width) is passed on, not verified.

**Which writer ran.** The router chose `look` for `/`, and the lane picker
chose `components`, which runs the page rung. The quick writer was attempted
(`tweakUsage` 8,359 in / 67 out), followed by the full writer. Why the quick
attempt did not publish was not captured, and its usage alone does not
establish that it declined. The full writer made the change
(25,077 in / 8,011 out), and the judge ran (`keepUsage` 931 in / 46 out). So
full-writer coverage is claimed, and both preservation checks, which run on
the full writer's answer before anything publishes, let this answer through.
Neither verdict is on the wire. This is also the first live run where the
router named a page on a `look` answer (`/`, which is also the default).

**What it does not show:** one sentence on one site, with the writer's prompt
and the verdicts not captured. #418 stays open. The site now serves the
section removed; the restore mode puts `01790360265159-n7mtnq` back for free.

The preparation, as it stood before the press:

Run 32 stays closed. **The prerequisite is met**: this batch is merged and
deployed (see the deploy entry), so a dispatch from `main` carries the page-name
resolution, the quoted-page reader and the canary's after-read wait.

- **The request, pasted verbatim into the "What to change" box:**
  "Remove the ‘The first eight chords’ section from the home page." — 63
  characters, 67 bytes (curly quotes U+2018 and U+2019), sha256
  `48bdbf475e1718e6ceaab4fee3a9941d13477f719616d262216a87dcbf2be823`.
- **The press:** `edit-canary.yml`, run from `main`. The form shows each
  box's description rather than its name:
  - "Run the ONE paid edit as well": `yes`.
  - "What to change": the sentence above.
  - "The site to edit": `fretwork-1`. "A second site…": `washhouse-3`.
  - "READ ONE EXISTING JOB AND STOP" and "PUT ONE SAVED VERSION BACK": blank.
  - "Refuse to spend unless the Worker reports this deploy sha": `0de188ff2d3a00d8096b01f8616c507aea2bbce4`.
  - "Refuse to spend unless a cold container reports this image id": `05750a5120d33570`.
- **These two values name deploy 2161**, read off its own log (see *Merged
  and deployed at `0de188ff`*, below). The top section's fixes are in it. The
  sentence's supplied-answer check was re-run on the deployed code (about
  05:58Z): the correct removal passes, with or without the unused import and
  with or without the page list, and a collateral loss or the wrong page is
  refused. Neither is on the
  expected path: one needs the css lane picked, the other a failure of ours
  whose restore also fails. Which rung the router picks is itself part of what
  Test 3 measures, so that is an expectation, not a promise.
- **The starting state:** live `01790360265159-n7mtnq`: the header read again
  on `/`, `/prices` and `/gear` at 05:38:24Z on 2026-09-26. The headings were
  last read at 01:01:55Z, in run 32's order, on the same version. The press's own
  before-read must equal these six stored bodies:
  - `index.tsx` `6bb1fb500f7df623`;
  - `prices.tsx` `0d2d72dee56a2a71`;
  - `gear.tsx` `d580389f971cdd31`;
  - `chord-diagram` `d0c20d52f91d69d2`;
  - `trial-booking-form` `4b66386c0ad46092`;
  - `day-space-lookup` `4b162037f67df545`.
- **What records which writer ran.** `routing.json` holds the router's intent,
  layer and page, and the page list it was given. `terminal.json` holds the
  stored reply whole, which tells the writers apart:
  - `tweak: true` means the quick writer published and the full writer did not
    run. The quick writer cannot drop words, so on this sentence that outcome
    would itself be a finding.
  - `tweak` absent with `usage` present on a published page edit means the
    full writer published; `usage` carries its model and tokens.
  - `tweakUsage` means a quick attempt was made first.
  - `keepUsage` means the preservation judge ran.
  - A refusal names its reason. `prose-preservation` (with `proseBlocked`) is
    the text guard, which is asked only of the full writer's answer.
    `withheld` (with `contentBlocked`) is the judge refusing item by item.
    `contentUnchecked` means the judge failed.

  Full-writer coverage is claimed only when `tweak` is absent and the full
  writer's `usage` is on the reply.
- **Acceptance.** Each item is read from the evidence bundle and a real browser:
  1. **It counts as the test** only if the request sha matches, the press's
     own before-read equals the six bodies, the preflight passes with both
     expectations, and a stored terminal reply arrived.
  2. **Published at the job's own version.** The stored 200 arrives under
     `x-gf-edit: final`, and `x-site-version` moves to a version minted inside
     the run's window. `compare.json` says VERIFIED, with every after-page read
     at that version.
  3. **The requested removal, in the stored source.** `index.tsx` loses the
     section headed "The first eight chords", with its `ChordDiagram` grid. The
     `ChordDiagram` import and the `CHORDS` data serve only that block, so
     either may go too; that is noted, not failed. Every other top-level render
     block and the code above the render stay byte-identical.
  4. **Other pages and component bodies:** the other five files stay
     byte-identical. The `chord-diagram` file stays stored even though no page
     renders it: nothing deletes a component file.
  5. **The live page at that version.** The headings read, in order: Book a
     guitar lesson · A guitar you can turn · September 2026 · Space on a
     preferred day · Book a trial lesson · Book a trial lesson. There are no
     chord diagrams, the guitar canvas draws, and the day box answers the real
     `bookings_on_day`. `/prices` and `/gear` keep their headings and word
     lists. Console errors and failed requests are counted.
  6. **Money.** The balance moves by exactly the routing charge plus the edit's
     cost, and the edit's cost matches the ledger rows for its job.
  7. **The reply the customer sees** (`customer-reply.txt`) is checked against
     the bundle. The render check's #418 finding is passed on, not verified.
- **Cost:** about 18–27 credits, an estimate and not a cap. That is the
  routing charge (2), the full writer (~12–15, as in runs 21, 24 and 26), a
  quick attempt (from under 1 when it stops at once up to ~6 when it
  rewrites the page first, as in run 24), and the judge (~1). The balance is
  91, read by run 33's free press (unchanged since run 32's end).
- **The starting state, read by run 33 (06:24Z):** all three routes answer
  `01790360265159-n7mtnq`. The six stored bodies are byte-identical to run
  32's after-read, with the same path set, and each matches its recorded hash.
  The paid run's own before-read must equal this, or it is not Test 3.
- **Reversible for free** with the restore mode (`01790360265159-n7mtnq`).
- **Limits:** one sentence on one site, and the writer's prompt is not
  captured. A text-guard refusal names no text and the refused answer is not
  stored, so a refusal cannot be blamed on the model. A publish is checked
  against the stored bodies and the live page, never taken as proof of
  preservation.

### Required CI

- **Unit:** run 36206886612 on `7384ddba` reads `7934 / 7930 / 0 / 4`. The
  seven new rollback cases and the kept control pass by name, with 7,934
  distinct result numbers and no `not ok`. Locally the suite reads
  `7934 / 7932 / 0 / 2`, and the 25 test files the milestone touched read
  1,002 / 1,002. The reviewed product tip `8f66dfb9` read `7927 / 7923 / 0 / 4`
  (run 36202704161).
- **Site build:** runs 36200973701 (`90efa38d`), 36201665364 (`80ce60f4`) and
  36202704088 (`8f66dfb9`). Each has all twelve counts green (TAP 397,
  site-build 382, and the rest as recorded) and only the two known
  annotations. The rollback round changed no file on the site build's paths,
  so the product tree it merged is `8f66dfb9`'s.

### Merged and deployed (2026-09-26)

Main was fast-forwarded `c2fa000c` → `7384ddba` (21 commits), which deployed as
deploy 2160 (run 36207057160, success, 01:02:52 → 01:05:53Z):
- The Worker reports `DEPLOY_ID` `7384ddba…`.
- The image was built as predicted, `c3cc126e45e93815` (187 inputs), and
  rolled over from `a51d8b32e5869576`.
- The served `chat.js` (786,047 bytes) and `edit-poll.js` (29,659 bytes) are
  byte-identical to the merged files.
- The rollback was verified before the push: it restores main's own tree.

A green deploy is Wrangler reporting on itself. **The runtime confirmation is
the free canary press** with both expectations set. The session's own dispatch
was re-tested at 01:22Z, once the image rollout had settled, and answered 403
again, so the press is yours:
- `edit-canary.yml`, run from `main`.
- "Run the ONE paid edit as well": `no`.
- "Refuse to spend unless the Worker reports this deploy sha":
  `7384ddbac4ba05b7251c52aa53d6fc9e018a9699`.
- "Refuse to spend unless a cold container reports this image id":
  `c3cc126e45e93815`.
- Every other box at its default.

The same press takes the before-read Test 3 starts from. *(Superseded: deploy
2161 below moved both values, and nobody pressed this one. Run 33 then
confirmed 2161, which runs all of 2160's code.)*

### Merged and deployed at `0de188ff` (2026-09-26)

The top section's batch passed the owner's review at `0de188ff`. Its site build
on `9aef0ca2` passed, browser control included (the top section's evidence).
Main was then fast-forwarded `7384ddba` → `0de188ff` (9 commits, 20 files) at
05:49:22Z, which deployed as deploy 2161 (run 36221930265, success, 05:49:27 →
05:52:15Z):
- Before the push: main was unmoved, nothing was in flight, and the rollback
  (`git revert --no-commit 7384ddba..0de188ff`) gives main's own tree back.
- The image was predicted from the merged tree as `05750a5120d33570` (187
  inputs), and the deploy **built exactly that** (the registry answered 404).
  It rolled over from `c3cc126e45e93815` under `SUCCESS Modified application`.
- The Worker reports `DEPLOY_ID` `0de188ff…`; Wrangler's new version is
  `c7c5567…`.
- `public/` did not change, so no asset was uploaded and there is no
  served-file check. The served `chat.js` stayed byte-identical to the merged
  file.
- The auth gates answer 401 / 401 / 401 / 404.

A green deploy is Wrangler reporting on itself. The session's one attempt at
the free press, made at 06:08:20Z after the rollout hold, answered **403
Resource not accessible by integration** and was not retried.

**Runtime-confirmed by your free press, run 33** (run 36223626560, from
`main`, 06:23:55 → 06:24:37Z, spending off, both expectations in their own
boxes):
- `build-health 200 deploy=0de188ff2d3a image=05750a5120d33570` and
  `runtime 200 deploy=0de188ff2d3a async=true runner=true` (the control,
  washhouse-3, async too).
- Every preflight check is `ok`, including "the Worker is the expected build"
  and "a cold container gets the expected image".
- The zero-cost checks pass. The free job settled in about 6 s as
  `{"ok":false,"escalate":true,"reason":"empty","cost":0}`.
- `ALL FREE CHECKS PASSED`. The balance was 91, and the run stopped before the
  paid edit with nothing charged.
- Its before-read is Test 3's starting state (section 6 above).

This is the live Worker answering. Deploy 2160's own moment was never read
live, but every commit it shipped is in `0de188ff`.

### Stopping point

Deploys 2160 and 2161 are merged and deployed, and **2161 is
runtime-confirmed** by your free press, run 33, which also confirms 2160's code.
**Test 3 ran as your paid press, run 34, and all seven acceptance items hold**
(section 6). Nothing further is dispatched.

## Status after run 32 (2026-09-25)

*Superseded by the milestone section above. Its "still open" items for the
billing sentences, the charged refused step, the full revise on `incomplete`
sites, dropped attachments and the "Check the preview" wording are now fixed on
the branch.*

**Closed since this record was written.** Each of these is merged, deployed and
live:
- queued refusal redraw escape;
- preview invalidation after a synchronous scheduling exception;
- the queued one-hop marker (all three by the edit-path milestone, deploy
  2158);
- literal-text loss on the full page writer, for parsed literal JSX prose and
  its request grammar (deploy 2158);
- the credit-refusal wording that states the edit charge and the routing charge
  apart (deploy 2159, runtime-confirmed by run 32's preflight).

**Shown live.** Run 32 (canary 36172189711): one real-model edit through the
quick writer. The edit moved a section on fretwork-1 and kept the surrounding
source byte for byte. Routing, the queue, the publish, billing (route 2 + edit 8
against a single reserve) and the reply are all confirmed. A real Chromium,
rendering TLS-verified live bytes, confirmed the order, the 3D guitar and the
availability box against the real `bookings_on_day` (1 → "5 places left.",
0 → "Six places left.").

**Still not shown live.**
- The full page writer on this deployment, with the text guard and the judge
  in `keepCheck`.
- A second message from the same browser.
- Photographs.
- A live add-on, and the picture, data and rules rungs.

**Still open.**
- #418 (phone-width hydration).
- The text guard's scope limits. The two ordinary page-qualified phrasings it
  refused with a correct answer are fixed on the branch (`ce913d06` + `8c0d67a1`), not
  merged. So is the bypass where a quoted or unreadable page after "on" dropped
  out unread (`d6f5e55e`). See [text preservation](edit-text-preservation.md).
- Next-task 4's other billing sentences and the charged refused step.
- The full revise on `incomplete` sites.
- Attachments dropped by an unusable routing answer.
- The add-on route's no-layer climbs.
- The "Check the preview" wording on an unknown outcome.

**Harness.** The canary's early after-read is fixed on
`claude/help-needed-ehlwlj` (`72885ca9`, not merged).

**Next.** Test 3 is revised and not dispatched: "Remove the ‘The first eight
chords’ section from the home page.", after `ce913d06` + `8c0d67a1` + `d6f5e55e` are merged and deployed,
about 17–25 credits. A publish is read against the actual stored output and the
live page; a refusal is read by its reason, which for the text guard does not
say which text.

---

Historical closure record. The subsequent owner-authorized [full edit-path
review](edit-path-milestone.md) records the queued marker, refusal-display and
preview-ordering corrections on the review branch. Closed deployments below
remain closed; they were not rechecked.

Scope: current product at `5cb8592`, the recorded reviews and canary 28. This is
not a new lane audit. Escalation correction and deployment verification are
closed; no further deployment checks, retries or paid runs are requested.

## Demonstrated behavior (with the evidence boundary)

| Behavior | Evidence |
| --- | --- |
| Correct Worker/container identity, async and runner flags | Live non-spending canary 36096052737, 2026-09-25 04:50:36 UTC: `5cb8592661ff`, `b83b0611aeecce8f`, both flags true. Balance 3. |
| Empty edit queues and reaches its stored terminal refusal; forged replay and unknown-job poll are rejected | Same live canary. This did not call a model or demonstrate a content edit. |
| Failed/unreadable add-on state and unusable answers stop; verified absence alone permits reconstruction; photo handoff and successful additions remain | Actual Worker responses through direct and queued browser handlers with stubbed providers: `test/addon-failure.test.mjs`, `test/addon-route.test.mjs`. Independent review and required CI green. |
| Untrusted edit/add-on replies cannot authorize success or another operation | `readRouteReply`, `readEditReply`, `readAddonReply`; controlled reply tests in `test/edit-reply-validation.test.mjs`, `test/addon-failure.test.mjs`. |
| Ask lock survives handoffs, releases once, blocks duplicate presses; old completions do not unlock newer requests | `siteEdit`, `editAsk`, `editAskDone`; `test/edit-lock.test.mjs`. Previously corrected, not reopened. |
| Edit-side result-display failure preserves known success and permits a next message | `applyEditResult`; `test/edit-result-display.test.mjs`, including credit-scheduling and redraw fault injection. Previously corrected, not reopened. |
| Served browser code matches reviewed code | Recorded byte comparison of live `chat.js`. Draft isolation, routing and preservation behavior also have controlled tests; those tests do not prove every real model response. |

## Implemented, but not established by this live verification

- A nonempty model-backed edit/addition through the real browser, queue, model,
  compiler, publish and result-display chain on this deployment.
- Its exact requested change, preservation of unrelated content/behavior,
  visible preview, truthful partial-result wording and per-operation billing.
- Live reconstruction and photo handoff with real providers. Controlled tests
  cover their decisions; the empty-edit canary does not exercise them.

These are missing observations, **not product defects**. Do not repeat completed
deployment checks or spend credits merely to relabel the same evidence.

## Known remaining defects and limits

| Item | Current-code evidence and precise scope |
| --- | --- |
| Add-on known-success fallback redraw — CLOSED, deployed at a5741864 | The owner independently reproduced an escaped queued display error; publication and request cleanup succeeded. The fallback now uses the existing edit-side guarded finish. Focused regressions cover direct/queued double failures, the subsequent message and a newer request started during redraw. Ordinary success-redraw controls remain. |
| Queued refusal redraw can escape | `watchEditJob` invokes the outcome reader from its async step; refusal branches call `finish` without containing a redraw exception. Recorded impact: the sentence remains and the request frees, but a rejection can escape. No new live incident is claimed. |
| Preview invalidation can be skipped after a synchronous scheduling exception | `applyEditResult` and `applyAddonResult` call `scheduleCreditRefresh()` before incrementing `previewV`. The injected synchronous throw is recorded. **Do not describe this as every failed balance request:** the actual scheduler defers `fetchCredits` in a timer, so an ordinary later network failure does not establish this sequence. |
| Queued handoff loses the one-hop marker | `watchEditJob` supplies `handedOff:false` to its reader, whereas `escalatedEdit` uses that flag for the hop limit. Latent guard gap: the recorded current data→text and picture→page destinations do not hop again. Not evidence of a current live loop. |

Drafts surviving site switches but not browser reload are an intentional
in-memory limit (`siteDraft`, `sitesSave`), not a newly found defect. The silent
duplicate latch is likewise a deliberate secondary guard, not a stranded-request
regression. Translation and model-written replies remain parked.

## Fallback-display correction closed

The owner independently reproduced the queued add-on double display failure.
The regression also failed before the patch with “the redraw failed” escaping.
The existing edit-side guard now contains that fallback redraw exception.

All 179 focused tests pass in edit-result-display, edit-lock and addon-failure:
one truthful success, no rewrite or extra handoff, busy/lock released, subsequent
message completes, and an older completion leaves a newer request alone.
The harness reads normalize CRLF so these controls also run on Windows.

This is an escaped display error, not a failed publication or stranded request.
Independent review accepted the patch and all 179 focused tests. Required unit
CI [36098613431](https://github.com/canias7/isibi-app/actions/runs/36098613431)
passed (7,710 passed, zero failures). Site-build was not required for these paths.

Merged by fast-forward from unchanged main at 41abeaa5 to a5741864.
[Deployment 2157](https://github.com/canias7/isibi-app/actions/runs/36099179983)
succeeded on 2026-09-25 at 05:35:53 UTC, deploying reviewed commit
`a57418643340b67f9d51210c903dbe18e1e532f3`. The deployment log reports the
existing SiteBuildContainer image reused; this is deployment-log evidence, not
a new runtime container observation. No container check or canary was run.

At 05:36:30 UTC, both https://gofarther.dev/chat.js and its cache-busted URL
returned HTTP 200 and were byte-identical to the reviewed git blob: 781,511 bytes,
SHA-256 `d873ddb00e7375f7b9ace05ad92954eb4947f8d98802ff45b5bbff14e34a2c36`.
This verifies the served correction. No paid run. Other checklist items remain
separate and unchanged; no next sweep or additional correction is started.
