# 2026-10-24 — No add-on limits, and the frame that was lost (branch `addon-uncapped`)

From `origin/main` `692087cde`. Not merged, not deployed. Nothing spent, no
model called (every model answer in the tests is a stub wire), no live write.

## The owner's word

*"No addon limits"* (2026-10-24), and earlier *"no limit on things that can be
added"* (2026-09-02). Found live the same day on **driftwood-and-daughters**:
the add-on caps, applied per kind and independently, kept the Hire and Events
pages and dropped the tables behind their forms; and the header/footer
("frame") item asked for beside them was set aside twice and then lost.

## 1. The caps (`builder/site-add.mjs`)

Every cap is now `UNCAPPED` (`Infinity`):

| constant | old | new |
|---|---|---|
| `MAX_ADDS` (kinds a message names) | 12 | unbounded |
| `MAX_ADD_PAGES` | 6 | unbounded |
| `MAX_ADD_COMPONENTS` | 12 | unbounded |
| `MAX_ADD_TABLES` | 6 | unbounded |
| `MAX_ADD_ROWS` | 12 | unbounded |
| `MAX_ADD_FUNCTIONS` | 6 | unbounded |
| `MAX_ADD_APIS` | 4 | unbounded |
| `MAX_ADD_JOBS` | 4 | unbounded |
| `MAX_SECTIONS` (bands a new page) | 12 | unbounded |
| `MAX_OWN_PHOTOS` (own photographs shown) | 12 | unbounded |
| `MAX_ADD_WORDS` (lines of words) | 6 | unbounded |
| `MAX_SHOWN_TABLES` / `MAX_SHOWN_COLUMNS` (the record's digest) | 12 / 24 | unbounded |
| `MAX_ADD_MANIFEST` (kit components one added page/section names; was site-plan's `MAX_COMPONENTS`) | 15 | unbounded |
| `MAX_JUDGE_ITEMS` (the judge's input) | 80 | 400 (still counted past it) |

- The per-kind cap code in `cleanAdd` keeps every usable entry; the one count
  left is `photo` at `IMAGE_CAP` (6, site-images.mjs: the photographs one
  change may buy, shared with the build), still named `over-cap`, and its
  sentence no longer asks the customer to send anything again.
- The `maxItems` lines that read these constants left the picker's and the
  designer's schemas (JSON cannot carry `Infinity`).
- **The coupling** (a page kept and its tables dropped) cannot happen: nothing
  is cut. If a bound ever returns, the page batches below already give every
  batch the tables, functions, connections and jobs its pages use.

## 2. Many pages: parallel page writers

One page call answers in one bounded reply (`SITE_PAGES_MAX_TOKENS` 30,000), so
nine new pages from one writer would run out of room or time. Past
`ADD_PAGE_BATCH` (3) new pages, `foldAdds` returns `batchDirectives`
(`pageBatchDirectives`): each batch keeps the shared blocks (the rule, the
tables, functions, connections, jobs, the requirement brief), its own new pages
and every block placed on one of them; a block placed on an existing page goes
to the first batch only, so no page is written twice; each is told the other
new pages exist, to link to and never return. The route (`worker.js`, the
add-on's page call) runs the writers with `Promise.all` inside the same job and
`mergePageBatches` makes the one answer read below (pages by path, parts by
name, usage summed; any ask asks, any blank batch writes nothing, as one writer
would). Up to 3 new pages: one writer, exactly as before. The design graph and
wave concurrency limits are unchanged.

**Relied on, from `first-build-uncapped`:** page-gen's `MAX_PAGES` (6) is how
many pages `validatePages` keeps of one reply, and the add-on validates the
merged reply once. Until that branch makes it unlimited, pages past the sixth
of one addition are named as missing (`missingPages`), never silent; the route
guard asserts exactly that and tightens to all nine with no edit once it lands.

## 3. The frame set aside twice and lost

- **Worker** (`aFrameHop`): when the frame is picked beside other kinds, the
  other kinds run as before and the answer (pageless and page paths) carries
  `frameHop: { layer: "nav", words }`: its own words, or the part's whole
  instruction when it has none.
- **Request** (`frameFollowOn`, `builder/request.mjs`): on that answer the
  request makes a part that runs the menu/frame editor as an addition
  (`fromAddon`, the same hand-off a frame alone gets), even when the words are
  the whole part's (which `carveParts` skips), once, never beside a part
  already holding those words; the frame no longer counts as "set aside" on
  the parent.
- **Reply** (`heldFacts`, `builder/site-reply.mjs`): a held entry is promised
  as "its own part of the same request" only when the request can carve it:
  words outside the part are another part already; words inside it only when
  shorter than the whole. The request's own carve result (`carved`) wins when
  passed. The handed-on frame is said as done next by the menu editor. The
  part's words reach it through `partWords` (the add-on sets `aReplyOut.request`
  inside a request).

## 4. Tests, red, sweep, suite

- New: `test/addon-uncapped.test.mjs`, 9 cases (the constants; nine pages,
  twelve tables, eight functions kept by the cleaner; the batch directives; the
  merge; the route's parallel writers; **through the real route** nine pages,
  twelve tables and three functions with three write_pages calls and no table
  left out; the frame hand-on on both answers; `frameFollowOn`; `heldFacts`).
- Re-anchored to the new contract: `site-add` (5 cases), `addon-row` (2),
  `mixed-work` (seven tables and five feeds all added), `addon-steps` (2),
  `requirement-pieces` (400), `request-flow` M4 (the link with no words is now
  handed on), `progress-gaps` OUTCOME 5 (its partial part now comes from a
  set-aside row).
- Red check against `origin/main`'s four product files: 9 of 9 new cases fail
  (the file's imports are missing there; run through a namespace import so each
  case reports), and the re-anchored mixed-work, addon-steps and M4 cases fail.
- Sweep and suite: see the branch's commit and the report.

**Results (measured after the runs).** Sweep (`addon-uncapped`, `requirement-pieces`, `site-add`, `addon-steps`, and request-flow's M4): 21 of 21 mutants killed, the comment-only control survived; `MAX_ADD_MANIFEST` set back to 15 by hand: killed (2 fail). Full suite from the worktree (world-readable, `node_modules` linked, removed before the commit): `12467 / 12461 / 3 / 3`; the three failures are environment only (`no-generated-deps`' symlink case, the media browser mode, and one browser case, REOPEN 1, under a load average of 52; all three pass or are known env-only in the earlier run, `12467 / 12454+` with the same env set).

**Combining with `first-build-uncapped`:** that branch moves the add-on's component bound into its own `MAX_ADD_MANIFEST = 15` and keeps `MAX_ADD_PAGES = 6`; this branch's `MAX_ADD_MANIFEST = UNCAPPED` and `MAX_ADD_PAGES = UNCAPPED` must win in the merge, and its `maxItems: MAX_ADD_MANIFEST` lines must go.
