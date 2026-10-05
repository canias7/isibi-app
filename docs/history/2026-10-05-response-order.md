# A site's table list, in order: a newer read stands, an addition stays (2026-10-05, on the branch)

The owner, passing the three-answer round's review
(`2026-10-05-inventory.md`): *"The three-state inventory fix passes review:
nonempty, confirmed empty and unavailable now remain distinct. Keep the branch
unmerged and finish the response-order correction in the shared browser logic.
I reproduced this using the actual siteRoute function with supplied transport:
start with tables ["sessions","trainers"], send two routing calls, resolve the
newer call with ["sessions","trainers"], then resolve the older call with
["sessions"]. Because the newer answer changes no values, tablesAt remains
unchanged and the older answer removes trainers; the next request sends only
sessions, and an unavailable authoritative lookup passes that incomplete
inventory to the model. The empty equivalent also reproduces: a newer []
confirming an already-empty cache is followed by an older ["old_bookings"],
which restores stale names. Track accepted inventory observations even when
their contents are unchanged, distinguish superseded routing responses from
additions completing during a call, and prevent older routing results from
undoing newer confirmed inventory while preserving new additions. Fix this
universally without special cases for these names. Extend the existing focused
tests with unchanged nonempty and unchanged empty confirmations, reversed
response order, additions finishing during routing, and the next request with
an unavailable server lookup; assert both browser hints and actual model input.
Preserve the passing three-state, ownership, timeout, refresh and
reply-placement behavior."*

**On the branch only**: not merged, not deployed, no image built, nothing
pressed or spent. Shown with the page's own functions, the real Worker route
and supplied database and router answers; not shown live.

## 1. The gap

The page told how old a routing answer was by whether its own list had changed
while the call was out (`tablesAt`), and that mark moved only when the list's
contents did. So:
- **an answer that confirmed what the page held left no mark**, and an older
  answer arriving after it was taken whole. In the owner's reproduction the
  later call's `["sessions","trainers"]` changed nothing, the earlier call's
  `["sessions"]` then took `trainers` away, the next request sent `sessions`
  alone, and with the route's own read unavailable that was all the router was
  told. The same with none: a later `[]` on a page already empty, then the
  earlier `["old_bookings"]` brought it back;
- **a newer routing answer and an addition finishing were one mark**, and
  either way a late answer's names were only added, so a name the late answer
  had rightly found gone stayed (`old_rates`, in INV 10 and 11 below).

## 2. What changed (`public/chat.js` only)

**One clock** (`siteTablesOrder`) puts in order every routing call as it goes
out and every addition as it is applied: this page's own (`applyAddonResult`),
another browser's reconciled here (`siteReqRefresh`), and a build's. For each
site it keeps the clock of the call whose answer was taken last (`seen`), and
when each addition's table joined (`added`).

**A routing answer's read** (`siteTablesRead`):
- **taken whenever no answer to a later call has been**, even one that changes
  nothing: taking it is what puts every earlier call's answer behind it;
- **taken as the site's list**, with the tables an addition put there after
  its call went out, which its read may have missed, and nothing else of the
  old list: a name the read found gone goes;
- **an answer to an earlier call than the one taken last changes nothing**: it
  can neither take a table away nor bring one back;
- a call whose read could not answer has its place on the clock, but puts
  nothing behind it: it read nothing.

**An addition's tables** (`siteTablesAdd`): a union, never a replace, each
name marked with when it joined. The three writers that joined lists by hand
now go through it; the build path joins exactly as before, now marked.

**In memory only**: a reload has no call out, and looks afresh. The record's
`tablesAt`, the previous round's mark, is gone (it was never merged).

**Unchanged**: the Worker (the three answers, the ownership check, the 3 s
bound on each lookup); each reply's place with its request; the model's
replies; the refresh fixes.

## 3. Tests

`test/request-inventory.test.mjs`, 5 new cases. Each goes through the page's
own `siteRoute` to the real Worker route, and ends on the next message with
the route's own read unavailable, so what the page sends then is all the
router is told. Each reads the page's list, what the next call sends, and the
router's site section:
- **INV 8**, the owner's reproduction: the page holds `sessions` and
  `trainers`; the later call confirms both and arrives first; the earlier
  call, which read `sessions` alone, arrives after. The page keeps both; the
  next call sends both, and the router is told both.
- **INV 9**, the owner's empty reproduction: the later call says none on a
  page already empty; the earlier call's `old_bookings` arrives after.
  Nothing comes back; the next call sends none, and the router is told
  nothing.
- **INV 10**, an addition finishing during a call, this page's own and another
  browser's: the answer takes `old_rates` away (gone from the site) and keeps
  `coaches` (the addition's). The next call sends both, and the router is told
  both.
- **INV 11**, reversed order with an addition finishing while both calls are
  out, this page's own and another browser's: the later answer keeps
  `lessons` and drops `old_rates`; the earlier one, still holding `old_rates`,
  changes nothing. The next call sends `lanes`, `lessons` and `swimmers`, and
  the router is told them.
- **INV 12**, a boundary: a later call whose read could not answer puts
  nothing behind it, so the earlier call's read (`pitches`, `teams`),
  arriving after, is taken.

Also changed:
- the file's own harness answered the edit at `/api/site/edit`, an address
  the page never posts to (it posts `/api/site/<slug>/edit`), so every edit
  there got the default answer. It now answers at the page's address, which
  the new cases count to know each routing answer was handled. INV 1 to 7
  are unchanged and pass;
- `test/site-ask.test.mjs`, "THE DIGEST'S TABLE LIST IS FED": the build
  handler and the addon lane hand their names to `siteTablesAdd`, and the
  union is asserted there;
- the nine page harnesses that run `siteRoute`, `applyAddonResult` or
  `reactSend` (`addon-failure`, `edit-lock`, `edit-reply-validation`,
  `edit-result-display`, `handover-operations`, `handover-resume`,
  `reply-held-page`, `site-entry-inventory`, `site-route-failure`) and
  `test/fixtures/browser-page.mjs` cut the clock and the two functions.

## 4. Checks

- **Red check** on `260b44db` (the three-answer round), in a throwaway
  worktree with the old page and harness and this round's inventory file:
  **INV 8, 9, 10 and 11 fail there**, each at the page's list: `trainers`
  taken away; `old_bookings` brought back; `old_rates` kept, twice. Run past
  those assertions, the old page then sent `["sessions"]` and the router was
  told `["sessions"]` (INV 8), and `["old_bookings"]` both times (INV 9): the
  owner's consequences, measured. INV 1 to 7 and 12 pass there (12 is a
  boundary the old page met too). The updated guard fails there by
  construction: it names the new function.
- **Mutation sweep**, from a green baseline of the inventory, reconcile,
  site-ask and live-refresh test files (145 tests): **14 of 14 killed**, all
  3 comment-only controls surviving, `chat.js` restored and checked by hash.
  Each mutant put one defect back:
  - an answer to an earlier call than the one taken last taken (an older
    answer undoing a newer read); an answer taken not tracked at all; an
    answer that changes nothing not tracked (the owner's reproduction);
  - an answer dropping the tables an addition put there while its call was
    out; an answer only adding (the old rule); the additions kept being
    those from before the call went out, not after;
  - an answer put in order by when it arrives, not when its call went out; a
    routing call taking no place on the clock;
  - an addition's tables not marked with when they joined; an addition taking
    no place on the clock; an addition's tables replacing the list;
  - another browser's addition, this page's own, and a build's not reaching
    the list (the build's held by the guard alone).
- **The full suite**: `9474 / 9474 / 0 / 0` locally, from 9,469 by the 5
  new cases. Unit CI and the site build: read after the push (below).
- **The image**: unchanged. Nothing this round touched is one of its inputs
  (`public/` and the tests are not), so it is still `589e3e4e85a20066`,
  the image the three-answer round set (from `386607152d4cb319` at
  `main`). A merge would build it; nothing was built.
- **No screenshots**: nothing on screen changes; what changes is what the
  page sends next and what the router is told, read in the cases above.

## 5. What is not shown

- **Live**: nothing here has run against the real site or a real model.
- **The build path's mark is held by the guard, not driven**: a build
  finishing while a routing call is out is not reached by the page's own
  flow (a build starts from a routing answer, and the page is busy while it
  runs).
- **An answer the page does not act on** (stopped, or unusable) is not taken,
  as before: its read is lost, and the next call reads again.
- **Two tabs of one browser** keep their own clocks and lists, and each one's
  save can overwrite the other's list, as before.
- **The router is told at most 24 names**; the page keeps 48, as before.
- The limit the three-answer round recorded (a routing answer older than a
  change only adding names, so a lost name stayed) is gone: an older answer
  now changes nothing, and an answer with an addition beside it drops what
  its read found gone.
