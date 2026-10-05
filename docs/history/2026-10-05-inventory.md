# The site's tables as three answers: names, none, or cannot tell (2026-10-05, on the branch)

The owner, passing the reconcile round's review
(`2026-10-05-reconcile.md`): *"The preview, delayed-first-read and
nonempty-inventory corrections pass review. Keep the branch unmerged and fix
the remaining inventory distinction universally: routeTableNames returns []
both when the authoritative inventory is successfully empty and when it cannot
be read, and routeDigest only replaces browser names when names.length is
nonzero. I reproduced readStoredSpec returning {ok:true,tables:[]} while the
browser sends ["appointments"]; the router still receives appointments,
exactly as it does on a read failure. Preserve successful nonempty,
successful empty, and unavailable results distinctly through the reader,
routing digest and response. A successful empty inventory must tell the model
there are no tables; browser hints should be fallback only when the
authoritative read is unavailable. Check the browser's tablesFilled handling
too, since it currently ignores empty results and only unions names:
preserve the success distinction without letting an older response erase a
newer addition. Test empty sites with stale hints, removal of the last table,
nonempty inventories, genuine read failures and out-of-order responses using
varied names. Assert the actual model input and subsequent browser routing
behavior. Preserve ownership checks, lookup bounds, reply placement and the
completed refresh fixes."*

**On the branch only**: not merged, not deployed, no image built, nothing
pressed or spent. Shown with the real Worker route and supplied database and
router answers; not shown live.

## 1. The gap

"This site has no tables" and "we could not read its tables" were one value.
`routeTableNames` answered `[]` for both, and `routeDigest` replaced the
browser's names only with a list that had names in it. So a site with none
was routed on whatever the browser held — `appointments`, in the owner's
reproduction — exactly as a failed read was. The model was never told a site
had no tables: an empty list wrote no line at all, the same silence as not
knowing. And the browser ignored an empty answer and only ever added names,
so a name the site no longer had stayed in its list for good.

## 2. Three answers, kept apart

**The reader** (`worker.js`, `routeTableNames`):
- the site's names when it has some;
- an EMPTY list when it has none. That covers a site with no database (the
  backend reader's `none`), and a database the catalog confirms holds no
  application tables (`readSchemaState`'s `ok` with no tables: `empty`, or
  `stored` with none left);
- `null` when they cannot be told: not the owner, a backend that cannot tell
  (it throws), a schema that cannot be read, tables none of whose names can
  be told safely, or a read past its bound.

**The digest and the call** (`routeDigest`, the routing route):
- names replace the browser's;
- **an empty list replaces them too**: the router is told
  **"It has no database tables."** in the site section, where the names go
  (`siteDigest`, from the route's own word `tablesNone`, never from anything
  the browser sends), and the decision names it (`tables-none`, a new context
  code);
- the browser's names are sent on only when the read could not answer (`null`).

**The response** (`tablesFilled`):
- the names when the route read some;
- `[]` when it read none;
- absent when it could not read them.

**The page** (`public/chat.js`, where the routing answer is handled):
- **a list, empty or not, becomes the page's list**: a name the site no longer
  has goes, and a site with none is held to none, so the next call sends
  nothing stale;
- **unless the page's list changed while the call was out**: an addition
  finished, this page's own or another browser's, or another routing answer
  came first. Each such change is marked on the record (`tablesAt`), and the
  call noted the mark when it went out. Then the answer is older than the
  change, and its names are only added: an older answer never takes away
  what a newer one or an addition put there;
- no list (absent): the page's names stand;
- a list holding anything but names is no list, refused rather than coerced.

**Unchanged**: the ownership check first, read-only, names only; each lookup
bounded at 3 s and failing open; each reply's place with its request; the
model's written replies; the preview, late-first-read and nonempty-inventory
corrections.

## 3. Tests

`test/route-table-names.test.mjs`, the real Worker route with the site's
database and the router stubbed, reading the site section the router was
sent:
- an empty database: the site section ends "It has no database tables.",
  `tablesFilled: []`, `tables-none`;
- an empty site with a stale hint (`appointments`): read, told none, never
  appointments — the owner's reproduction;
- a stored schema with no live tables left (the last one, `waitlist`, taken
  away): none;
- a site with no database at all (`members` hinted): none, and no database
  read;
- a nonempty site (`classes`, `members`): its own names, the stale hint
  gone, `tables-filled`;
- a read that cannot answer, six ways (the ownership read, the project row,
  the derived database, the catalog, the stored schema, another owner's
  slug): the browser's names (`appointments`, `rooms`) stand, or nothing is
  said when it sent none — never none, never `tablesFilled`;
- tables that exist but none of whose names can be told (`my rooms`): not
  none, so the browser's names stand.

`test/request-inventory.test.mjs`, 7 cases: the page's own functions in a VM,
its routing requests sent to the real Worker route with a database that
changes between calls. Each reads what the router was told and what the
page sends next:
- **INV 1**, an empty site and a stale hint. Told none; the page lets go of
  `appointments`; a later call whose read fails is told nothing.
- **INV 2**, the last table taken away. Told `waitlist` while it is there,
  none once it is gone, nothing (not `waitlist`) when the next read fails.
- **INV 3**, a nonempty site. `classes` and `members` replace the page's stale
  hint, and are what it sends when the next read fails.
- **INV 4**, a read failing three ways. The page's names (`rooms`, `guests`)
  are the router's, and the page keeps them.
- **INV 5**, out of order between two routing answers. The later read
  (`studios`, `lockers`; or `lockers`) arrives first; the earlier one (fewer
  tables, or none) arrives after and takes nothing away. The next call
  settles the list.
- **INV 6**, out of order against an addition, this page's own and another
  browser's. A routing answer saying none, read before the addition finished,
  arrives after it; `rentals` stays.
- **INV 7**, a list holding a number. Refused; the page's names stand and are
  what it sends next.

Also changed:
- `test/route-decision.test.mjs`: a case for `tables-none`; the route's
  stub site has no database, so its decisions now carry `tables-none`;
- `test/live-clarify-continue`, `-continuity` and `-limits`: their fixture's
  site has no database (`test/fixtures/live-ask.mjs`, a comment there says
  so), so their decisions carry `tables-none` too.

## 4. Checks

- **Red check** on `5186866a` (the reconcile round), in a throwaway worktree
  with this round's tests: **12 fail there**:
  - INV 1, 2, 3 and 6 (the router told `appointments`; the page keeping a
    stale name; none read as unknown);
  - the four none cases (empty database, stale hint, last table taken away,
    no database);
  - the four decision cases that name `tables-none`.
  The rest pass there, as they must: the failure modes keeping the hints,
  the nonempty and unnameable cases, the out-of-order union (INV 4 and 5),
  and the Lane 1d cases. INV 7, written after the red check, passes there
  too: the old page filtered the number out and only added names, so its
  list was unchanged either way. The sweep's mutant that takes such a list
  fails it.
- **Mutation sweep**, from a green baseline of the table-name, decision,
  inventory, reconcile and router test files: **17 of 18 killed**, all 3
  comment-only controls surviving, every file restored and checked by hash.
  - The killed ones put back, one each: an unreadable schema read as none; a
    site with no database read as cannot-tell; unnameable tables read as
    none; an empty answer dropped (the old rule); the route not passing on
    none; the response not telling none from cannot-tell; the site section
    silent for none; the request built without the route's word; the
    decision not naming none; the page ignoring an empty answer (the old
    rule); the page taking a list with a non-name; the page only adding (the
    old rule); the page always replacing; the call not noting where the list
    stood; and the three changes to the list not marked (the page's keep,
    another browser's addition, this page's own).
  - **The survivor is equivalent**: the owner check inside `routeTableNames`
    answering `[]` instead of `null`. Its one caller, `routeDigest`, verifies
    ownership first and calls it only for the owner, so that line cannot be
    reached. It stays as a belt for any later caller, answering cannot-tell.
    The ownership check that is reached — routeDigest's — is held by the
    stranger cases.
- **The full suite**: `9469 / 9469 / 0 / 0` locally, from 9,456 by 13 (the
  6 routing cases and the 7 page cases; the empty-database case was rewritten
  in place). Unit CI `9469 / 9463 / 0 / 6` on `685a922c` (run
  37282482632): the totals match, and CI skips its usual 4 and the 2
  browser cases, which need a browser. The site build is green on
  `685a922c` (run 37282482599): all 8 jobs, the gate reading 404 checks in
  27 sections across 4 shards; its inputs are now `23a4d36259d3fb7a` (3,972
  files), `worker.js` being one.
- **The image**, predicted with `containerInputs` and `imageId`:
  `386607152d4cb319` at `main` (`cd817fee`), `da027774faa35eaf` at
  `c3fff062` and `5186866a` (the reconcile round), and
  **`589e3e4e85a20066` at `685a922c`**: 194 inputs, `worker.js` and
  `builder/site-ask.mjs` among them, none under `public/`. A merge would
  build it; nothing was built.
- **No screenshots**: nothing on screen changes; what changes is what the
  router is told and what the page sends next, read in the cases above.

## 5. What is not shown

- **Live**: nothing here has run against the real site or a real model.
- **A routing answer older than a change to the page's list** only adds
  names, so a name the site lost between that answer's read and the change
  stays until the next routing call reads the site again.
- **The router is told at most 24 table names**, as before.
