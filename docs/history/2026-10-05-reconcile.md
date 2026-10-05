# The site the page shows, reconciled with what is published now (2026-10-05, on the branch)

The owner, reviewing the watched-refresh correction
(`2026-10-05-watched-refresh.md`): *"Keep this unmerged and finish these three
gaps together. The original observed-running case now works, but a fresh
browser's first refresh leaves the actual preview URL unchanged at ?v=1; fix
the shared refresh behavior and test the rendered iframe URL, not merely
previewV increasing. Also, siteReqSeen treats everything completed by the
first successful request read as already reflected in the loaded site.
Reproduction: the browser loads the old site, its first request read is
delayed or fails, the job completes, and the next read finds it done; the
reply appears and the request closes, but previewV stays unchanged and tables
remain empty. Reconcile the currently published state without assuming the
first request read and the loaded preview represent the same moment, while
preserving history deduplication and avoiding old undo offers or questions.
Finally, stop treating an addition's table names as a complete site
inventory: with existing loaves and newly added bookings, routeDigest
currently receives only bookings and makes zero authoritative table reads.
Ensure subsequent routing retains access to the complete current inventory
for both local and cross-browser additions. Cover these cases together with
repeated polls and out-of-order responses, using the actual refresh and
routing paths. Preserve request/job-based reply placement and model-written
explanations."*

**On the branch only**: not merged, not deployed, no image built, nothing
pressed or spent. Shown with supplied answers, the real Worker route and a
real Chromium; not shown live.

## 1. The three gaps

1. **A site's first move kept its address.** The preview's address carried
   `previewV || 1`, and every move is `(previewV || 0) + 1`. A site record
   with no `previewV` — a fresh browser's, or one adopted from the list — was
   drawn at `?v=1`, and its first move set `previewV` to 1: the frame asked
   for the address it already had, and a cache may answer that with the page
   as it was (the site's pages are served `public, max-age=60`). In the
   backlog since 2026-10-04; another browser's work reconciled on a fresh
   record made it the usual case.
2. **A first read that failed or came late made a finished job history.** The
   page took everything finished by its first successful read of a request to
   be in the site it had loaded. A first read that failed, or answered late,
   found done a job the loaded preview had never seen: the reply appeared and
   the request closed, and the preview and the tables stayed as they were.
3. **An addition's tables stood for the site's.** A page whose list was empty
   kept an addition's tables (its own addition, or another browser's it
   watched) and then sent just those, and the route read the site's own names
   only when a page sent none: for a site with `loaves` and a new `bookings`,
   the router was told `bookings` alone, and nothing was read.

## 2. What changed

**The address** (`public/chat.js`, `sitePreviewSrc`):
- a site never moved is drawn at `?v=0`, so every move changes the address
  the frame is given — a revise, an edit or addition this page applies,
  another browser's work reconciled, the Refresh button;
- one token, at the one place the address is made; the moves are unchanged.

**Reconciled, whenever it finished** (`siteRequestJobReply`,
`siteReqRefresh`):
- the reader — the outcome as this page's own, with its undo offer, words for
  the message box, block and question — runs only for a job of a request this
  page sent that finished after the page first looked at it;
- every other finished job, another browser's or this browser's own found done
  at the first look, is said and reconciled:
  - the preview moved on to what is published now;
  - the job's tables kept;
  - the page list read again from the server when the job changed pages;
- **whenever it finished**: the page cannot tell whether its preview was
  loaded before or after a job published, so no job is taken to be in the
  site it loaded;
- once a job (`st.shown`, and its reply's mark on the thread): repeated
  polls, two readings and a reload do nothing again;
- nothing of the reader's comes back: no undo offer, no words for the box, no
  question. A waiting question is still made live once a page, by the
  request's own reading;
- what it costs: a page opening a site with requests finished in the last day
  moves its preview once for each of their jobs. That is one more fetch of
  the published page for each, never a replay.

**The whole table inventory** (`worker.js`, `routeDigest`; `public/chat.js`,
`siteRoute`):
- the route reads the site's table names for its verified owner on every
  routing call, whatever the page sent. The names read replace the page's;
  the page's stand only when the read cannot answer (bounded at 3 s, failing
  open, as before);
- the page keeps the names the route read (`tablesFilled`) with its own, so a
  later routing call whose read cannot answer still sends the whole list. It
  adds, and never drops: a routing answer read before a newer change loses
  nothing the page holds;
- `worker.js` is one of the container image's inputs, so a merge would build
  a new image (predicted below). Nothing was built.

**Unchanged**: each reply's place with its request and job, and the model's
written replies.

## 3. Tests

`test/request-reconcile.test.mjs`, 10 cases. The page's own functions run in
a VM against a scripted server, opened with `frame: true`: each drawing runs
the render's own frame step, cut out of `renderSites`, and the address it
gives the preview frame is what the cases read. The routing cases send the
request the page built to the real Worker's `POST /api/site/route`, with the
site's database (`loaves`, `bookings`) and the router stubbed at the network.
- **RECON 1**: a fresh browser. Another browser's addition finishing, and this
  page's own, each move the frame from `?v=0` to `?v=1`; looking again moves
  nothing.
- **RECON 2**, the owner's reproduction: the first read of the request
  fails, the job finishes, the next read finds it done. The reply appears
  once and the request closes; the frame's address moves, `bookings` is kept,
  the page list is read again. No undo offer, question or words in the box.
  Polls after it change nothing.
- **RECON 2b**: the first read late instead, answering after the job
  finished. Reconciled the same.
- **RECON 2c**: reloaded while the request ran. The request's own read finds
  it done; the list of requests, asked at the reload, answers late and stale.
  Nothing is put back or reconciled twice.
- **RECON 3**: this browser's own request, the page reloaded while it ran,
  its first read failing. Reconciled — the frame, the pages as the server
  keeps them — with no undo offered for the row it took.
- **RECON 4**: history from before the page opened. Shown once and
  reconciled once, never replayed; a reload changes nothing.
- **RECON 5**: out of order. Two jobs' answers are read in reverse order:
  each reconciled once, both tables kept, the pages as the server keeps them.
- **RECON 6**: this page's own addition. The page holds only `bookings`, and
  the next message's routing tells the router `loaves` and `bookings`, read
  from the site. The page keeps them, so a later call whose read fails still
  sends both.
- **RECON 7**: the same for another browser's addition, finished while the
  page watched.
- **RECON 8**: out of order across the two paths. A routing answer read
  before another browser's addition finished arrives after it; the page keeps
  every name.

`test/request-refresh-browser.test.mjs`, 2 cases, in a real Chromium with the
repo's own `public/` and every answer supplied, reading the address off the
frame the workspace drew (`#stFrame`): a fresh browser watching another
browser's addition finish, and the owner's reproduction. Skipped where no
browser is installed, as on unit CI; the same path runs there through the
render's frame step above.

Also changed:
- `test/preview-reload.test.mjs`: a never-moved site is at `?v=0`; the
  address guard counts the address's one spelling; two new cases — a site
  never moved, whose first press asks for a new address, and every move in
  `chat.js`, read off the file, changing the address from any version.
- `test/route-table-names.test.mjs`: "names the browser already sent stand,
  and no table name is looked up" is replaced by an addition's names alone
  (the site read, the router told `loaves` and `bookings`), names the site
  does not have replaced, and four failure modes where the page's names
  stand.
- Expectations that followed the old rule: LIVE 3 (history reconciled),
  and PLACE 1, 4 and 6 (an earlier request's jobs move the preview once each,
  and nothing of them is replayed).
- The harness (`test/fixtures/browser-page.mjs`) gained `frame: true`, and
  `sitePreviewSrc`, `loadSiteFrame`, `frameSandbox` and `FRAME_SANDBOX`.

## 4. Checks

- **Red check** on `f2c4a543` (the watched-refresh correction), in a throwaway
  worktree with this round's tests and harness: **16 fail there**:
  - the three address cases;
  - RECON 1, 2, 2b, 2c, 3, 4, 6, 7 and 8 (the frame kept its address; the
    route made no read of the site's tables);
  - both browser cases (the frame's address never changed within 30 s);
  - the two inventory cases.
  The rest pass there, as they must: RECON 5 (an ordering guard), the
  fallback case, and the unchanged address, Refresh and Lane 1d cases.
- **Mutation sweep**, from a green baseline of the reconcile, refresh,
  placement, request-page, held-reply, page-picker, Refresh, table-name and
  route-decision test files: **12 of 12 killed**, all 3 comment-only controls
  surviving, every file restored and checked by hash. Each mutant put one
  defect back:
  - a site never moved at 1 again;
  - a job the first read found done taken to be in the loaded site (the
    first-look assumption back);
  - nothing reconciled for a job the reader did not apply;
  - this browser's own history applied by the reader (its undo offer back);
  - this page's own watched work reconciled instead of applied;
  - a reconciled job not moving the preview, or its tables not kept;
  - the page not keeping the route's names, or the route's names replacing
    the page's and losing a newer one;
  - the route reading the site's names only when the page sent none (the old
    rule), the names read standing only then, and a read that cannot answer
    dropping the page's names too.
- **The full suite**: `9456 / 9456 / 0 / 0` locally, from 9,440 by 16 cases
  (10 + 2 new files, 2 address cases, and the inventory cases' net 2). Unit
  CI: CI-RECON
- **The image**: IMAGE-RECON
- **Screenshots** (headless Chromium, the repo's own `public/`, every answer
  supplied): the owner's reproduction on a fresh browser.
  - **Before** (`f2c4a543`'s page): the reply under its card and the picker
    with Gallery (history's page list was read), but the frame at `?v=1`
    throughout, so the old site, and no tables.
  - **After**: the frame moved from `?v=0` to `?v=1`, the new site shown,
    `bookings` kept.
  - The stub answers an address the frame has already loaded as it first
    did: the site's pages are served `max-age=60`, and Playwright's routing
    turns the browser cache off.

## 5. What is not shown

- **Live**: nothing here has run against the real site or a real model.
- **This browser's own job found done by a late or failed first read** is
  reconciled without its undo offer.
- **When the route's read cannot answer**, the router is told the page's
  names: the whole list once the page has kept a read, otherwise possibly an
  addition's alone.
- **The page list a page opens with** still only gains pages; history's page
  changes are read again.
- **A page opening many finished requests** moves its preview once per job.
