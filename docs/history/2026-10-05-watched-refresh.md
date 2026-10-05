# Work finished while the page watches, and history finished before it looked (2026-10-05, on the branch)

The owner, reviewing the placement fix (`2026-10-05-reply-placement.md`):
*"Keep the placement fix unmerged and fix this regression: siteRequestJobReply
treats every request with own:false as historical and passes blank
origin/slug and a null site into the result reader. That also includes
requests still running when this browser opens. I reproduced a request
observed as started completing with added:["src/routes/gallery.tsx"] and
tables:["bookings"]: its model reply appears and the job enters shown[], but
the page picker stays at "/", the table list stays empty and previewV does
not advance. The own:true control updates all three. Distinguish completed
history already reflected in the loaded site from work that completes while
this browser is watching. Refresh the current published preview and
page/table metadata when needed without replaying old edits, recreating undo
offers, restoring obsolete questions, or overwriting newer state with an
older job's result. Preserve the request/job-based reply placement."*

**On the branch only**: not merged, not deployed, no image built, nothing
pressed or spent. Shown with supplied answers; not shown live.

## 1. The regression

The placement fix decided whether to apply a request part's outcome by who
sent the request. A request this browser learned of from the server (`own:
false`) was only said, whether its part had finished long before or was
finishing while the page watched. So another browser's request, open in a
second browser while it ran, finished with its reply on the thread and
nothing else: the page list, the table list and the preview stayed as they
were, exactly as reproduced.

## 2. What decides it now: when the job finished (`public/chat.js`)

- **The page's first look at each request is recorded** (`siteReqSeen`, in
  memory, per page life): the jobs it had already finished by then. A request
  this page sends is recorded empty, so nothing it does is history here,
  even when the server finishes a part before the page's first look.
- **A job finished before that first look is history.** The preview the page
  loaded already shows it, so it is only said: no preview move, table, undo
  offer, words for the message box, block or question. That now holds for
  this browser's own requests too, when they finished while it was closed;
  before, a reopened page replayed them.
- **History's page list alone is read again**, when its job added or took
  away pages: from the server, never replayed from the job, as for watched
  work below. The list a page opens with only gains pages (`siteRoutesApply`,
  so that a build landing during the read keeps its pages), so a page taken
  away while this browser was closed would otherwise stay in its picker. On
  `main`, replaying such a request (one ended within a day) happened to take
  the page away; history that is only said no longer does. Added before the
  push, after the second sweep.
- **A job finished while the page watched is applied**:
  - for a request this page sent, by the reader, exactly as before: preview,
    pages, tables, undo offer, box, question;
  - for another browser's request, it is said, and the site's current state
    is brought up to date (`siteReqRefresh`): the preview moves to what is
    published now (the workspace, frame and all, is drawn when the request's
    reading ends, after every part); the tables the job made join the page's
    list; and when the job added or took away pages, the page list is read
    again from the server (`siteRoutesSync`). Only for a job that went
    through. No undo offer, no words for the box, no question, no block:
    those belong to the browser that sent it.
- **The page list is read again, never replayed from the job**, so an older
  job read late cannot undo a newer change:
  - each read is fresh, never the answer of one already on its way
    (`siteRoutesRead`'s `fresh`);
  - only the latest read begun is applied;
  - a read is never applied over a list that changed while it was out (this
    page's own change, or another read's); the list is read once more
    instead.
  - Pages the server no longer keeps leave the list, new ones join it, and a
    kept page keeps its name and markup.
- **A question is made live once a page, whoever sent its request**: a
  waiting question the page finds live, or makes live, is never made live
  again by a later reading, so an answer or a cancel sent meanwhile is not
  undone by a reading taken before it. A waiting question whose job was
  only said (history, or another browser's) is made live by the request's own
  reading.
- **The placement is unchanged**: every reply still goes with its request and
  job.

## 3. Tests

`test/request-live-refresh.test.mjs`, 13 cases. The page's own functions run
in a VM against a scripted server: each case says when a job finishes, what
its stored answer says (the owner's shape: `added:
["src/routes/gallery.tsx"]`, `tables: ["bookings"]`), what pages the site
keeps, and which answers are held back.
- **LIVE 1**: another browser open while a request runs. When its addition
  finishes, the preview moves, the page list is read again (`/`, `/gallery`)
  and `bookings` joins the tables, once. Looking again changes nothing and
  reads nothing. No undo offer, question or words in the box.
- **LIVE 1 control**: the same addition sent from this page is applied by the
  reader, all three, with nothing read from the server.
- **LIVE 1b**: a request sent from this page whose part the server finished
  before the page's first look is still applied.
- **LIVE 2**: a page taken away while watched leaves the list as the server
  now keeps it, and the preview moves. No undo is offered for that browser's
  deleted row.
- **LIVE 3**: history is only said. Another browser's finished requests, and
  this browser's own finished while it was closed: no table, preview or undo
  applied. Their page changes are read again from the server, once: the list
  becomes the server's (a page taken away goes, and a page a later change
  made comes, which no replay of the jobs could give), and a kept page keeps
  its own name. A history job that changed no page reads nothing.
- **LIVE 4**: a routing answer lost on its way back though the server took
  the message, then a reload. The request is picked up, its card goes after
  the message, and its addition finishing afterwards updates the preview,
  pages and tables, its reply under its card.
- **LIVE 5**: a page added by one request and taken away by a later one
  stays away when the page reads the later removal first and the older
  addition late.
- **LIVE 6**: a read of the pages begun before a newer change is never
  applied over it, and a list this page changed while a read was out is read
  again rather than overwritten.
- **LIVE 7**: a question this browser's own request asked while it was
  closed is made live once on reopening, under its card. Once cleared here,
  a reading taken before does not bring it back.
- **LIVE 7b**: the same for a question asked while the page watches.
- **LIVE 8**: a refused or asking part finishing while watched refreshes
  nothing.
- **LIVE 9**: a fresh read of the pages never takes an older read's answer,
  and stays the shared one until it answers.
- **LIVE 10**: another browser's change that adds no page, finishing while
  watched: a text edit, an addition of only a table, and one whose reply is
  still being written. What each drawing of the workspace reads is recorded:
  the last drawing comes after the preview moved (the request's reading draws
  it when it ends). The table joins the list, nothing reads the pages, and
  the held reply settles later in its place with nothing applied again. The
  same text edit sent from this page is drawn at the new preview, as before.

The harness list in `test/fixtures/browser-page.mjs` gained `siteReqRefresh`,
`siteRoutesSync`, `siteReqSeen` and `siteRoutesSyncs`.

## 4. Checks

- **Red check** on the page as it was at `22dd7e53` (the placement fix), in a
  throwaway worktree: **8 of the 13 fail there** — LIVE 1, 2, 4, 5, 6 and 10
  (nothing refreshed for another browser's watched work), LIVE 3 (the page
  taken away while closed stays: nothing read) and LIVE 9 (a fresh read
  answered by the one already on its way). The other 5 pass there, as they
  must: LIVE 1 control and 1b (this page's own work), LIVE 7 and 7b (its
  questions, reached there through the reader) and LIVE 8 (a refused or
  asking part, which refreshed nothing there either).
- **Checked, not a defect**: while making the screenshots I suspected the
  workspace was not drawn again after the preview moved, since the reply is
  drawn before it moves. It is: the request's reading draws the workspace
  when it ends (`siteRequestShow`), after every part. Measured by the second
  sweep: a line added for it survived its own removal, so it was taken out;
  the third sweep's mutant that removes the reading's own drawing fails
  LIVE 10.
- **Mutation sweeps**, each from a green baseline of the refresh, placement,
  request-page, held-reply and page-picker test files, every file restored
  and checked by hash:
  - the first, on the correction as first written: **17 of 17 killed**, both
    comment-only controls surviving;
  - the second, with a drawing line added after the preview's move: 17 of
    19 killed, the 2 survivors being that line's own mutants (so the line was
    taken out; "Checked, not a defect" above);
  - the third, on the code as pushed: **23 of 23 killed**, all 3
    comment-only controls surviving.
  - Each mutant put one defect back: every job history (the regression) or
    every job watched; this browser's own history replayed; a job this page
    did not apply itself refreshing nothing, history refreshed as if
    watched, or watched work refreshed as history; a request sent here
    counting the server's early finish as history; the first look never
    recorded; a refused job refreshing; no preview move; no table; the page
    list replayed from the job (watched, or history); history's page changes
    not read again; history going on to move the preview and tables; the
    request's reading ending without drawing the workspace; an older read
    applied after a newer one; a read applied over a list changed meanwhile,
    or never read again; a fresh read sharing an older one's answer; an older
    read taking the newer one off the shared reads; and the question rule's
    two halves.
- **The full suite**: `9440 / 9440 / 0 / 0` locally, from 9,427 by the 13
  cases. Unit CI on the pushed commit: in the handoff.
- **Screenshots** (headless Chromium, the repo's own `public/`, every answer
  supplied): a second browser open while another browser's addition runs,
  which finishes with the owner's shape. **Before** (`22dd7e53`'s page): the
  reply under its card, the picker a single page, no tables, the preview at
  `?v=3`. **After**: the picker as the server keeps it (Home, Gallery),
  `bookings` among the tables, the preview at `?v=4` showing the new site.
  The site's preview is a stub that answers an address the frame has already
  loaded as it was (the site's pages are served `max-age=60`, and
  Playwright's routing turns the browser cache off).

## 5. Found while doing this, recorded separately (`docs/backlog.md`)

**The first move of a site with no stored version keeps `?v=1`**, already in
the backlog (2026-10-04). The watched refresh moves `previewV` as every other
change does, so on a site another browser adopted from the list (it has
none) the first move leaves the frame's address as it was, and a cache may
answer it for up to a minute. Not changed here: a test pins the address's
one spelling and the `?v=1` of a site never revised, and this page's own
changes and the Refresh button share it.

**A partial table list stops the router reading the site's own.** The routing
route fills in the site's table names only when the page sends none. A page
that applies one addition's tables to an empty list (this browser's own
addition, as before, and now another browser's watched one) then sends just
those, so the router is no longer told the site's older tables. This was
there before this change; it is not fixed here.

## 6. What is not shown

- **Live**: nothing here has run against the real site or a real model.
- **History's page list at a first open** is read once for each finished job
  that added or took away pages; only the latest read begun is applied, so a
  last read that fails leaves the list as the page opened it, until the next
  change or reload.
- **A page whose first look at a request fails** takes its first successful
  look as the line: a job that finished during the failed attempts counts as
  history there.
- **This browser's own requests, watched,** still apply a job's page list
  from the job, as before; another browser's, and all history, are read
  again from the server.
