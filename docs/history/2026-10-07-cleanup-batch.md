# The Edit/Add-on cleanup batch (2026-10-07)

On the branch `claude/help-needed-ehlwlj`, unmerged. Nothing deployed, no
container built, no model called, no paid run, nothing restored on a live
site. `main` stays `bcc22295`.

## 1. What the owner asked

*"I want one substantial, coordinated Edit/Add-on cleanup batch instead of
fixing one small issue, stopping, and waiting for another prompt. … Our goal
is that a customer can ask for multiple edits and additions naturally, have
every requirement accounted for and executed through the correct routes
without resending work or keeping the browser open, and receive accurate,
natural model-written explanations throughout."* Seven items: progress
clarity; failure and partial-success reporting; no silent losses in
requirements and warnings; outcome precision; late provisioning; completion
display; the task titles' missing usage. Customer narration stays
model-written; code supplies the facts and enforces execution,
authorization, billing and state. The batch also un-parked the
twelve-requirement intake limit the backlog had kept parked on the owner's
word (2026-10-06).

## 2. The commits, in order

| # | Commit | What |
|---|---|---|
| B7 | `0ee8e782` | Narration usage: an account with a known missing call is never passed off as whole |
| B1 | `c3655841` | Progress lines: the writer is told the kind of work, the request's other parts and the real pages |
| B2 | `af396d14` | Failure, stop and crash exits keep and tell what already stands |
| B3 | `fe1be3ca` | Requirements, warnings and their lists keep every entry |
| B4 | `9a3e4bce` | Data changes name their entry and values; each table piece is checked |
| B5 | `645f58a5` | A database started before a failure is kept against its site, never duplicated |
| B6 | `09b2309b` | Completion is shown as the server has it: undo kept, one preview move, lists reconciled |
| B8 | `cd8fe7eb` | Combinations through the real request flow; a project the create left is written down |
| — | `5680a18b` | Browser keep test: published changes found together load the frame once |
| B9 | (this record) | The consolidated handoff, the backlog, this file |

## 3. Issue → code → test

| Owner's item | The code | The tests |
|---|---|---|
| **1. Progress clarity**: the narration given the operation, the targets, the milestone, the request's other parts; preparing, applying, publishing and published told apart | `c3655841`: the add-on's pages milestone recorded after the merge and the menu links settle, by kind (new, changed, link only), each address once; the schema milestone names what comes next only where something does; every job's record keeps its place in its request, and the writer reads the other parts with their states, under one rule that they are separate work | two flows through the real Worker (an edit then an add-on in one request; run 105's merge-and-link shape); red check: both fail on the old Worker; sweep 23 of 23 |
| **2. Failure and partial success**: every exit after work begins; what changed, was published, is unpublished, refused or unknown; status, part, job, reply and developer record agreeing | `af396d14`: reconcile settles the database record before its reply; reply records tagged with the answer they were written from; a dead job's record settled from its evidence and printed by both page paths; request parts keep what a job left (partial, never "before it changed anything"); edit stops carry landed steps; add-on gate stops carry outcome and coverage; the developer record rewritten by the failure door | red check: 23 of 517 fail on the old code, every new behavioural case; sweep 46 of 54, then 9 of 9; related suites 3364 of 3364 |
| **3. No silent losses**: requirements past twelve, warning lists cut at three or four, page lists cut, refused seed rows numbered wrong, unfillable tables unexplained | `fe1be3ca`: requirements past the twelve a step keeps track of kept by name with their step and told as not checked and why (a real limit: each is judged, and the judgment's answer is bounded; the designer is told to ask which comes first); refused rows numbered by their place in the design; rows past the limit by count; a table with every row refused said as none in; what nothing can fill read from what the engine put in; no cut left in a brief, the developer record, the wire's lists, the page notes or the browser's lines | `test/no-silent-loss.test.mjs` (15); sweep 52, 46 then 6 of 6 |
| **4. Outcome precision**: the data change's entry, field and before/after values; each column or setting of a table judged on its own | `9a3e4bce`: every data write hands its row back, and the answer carries `changes` (entry by its list's words, field from the value read to the value kept, values cut at 200 for the reply only); settings and columns are carriers of their own, checked against the table as applied; the engine records a column it could not add | `test/data-change-evidence.test.mjs` (6), `test/requirement-pieces.test.mjs` (8); red check 14 of 14; sweep 60: 54, one equivalent dropped, 5 of 5 |
| **5. Late provisioning**: a project made before a failure kept against the site or written down, never duplicated, ownership kept, nothing potentially used deleted | `645f58a5` + `cd8fe7eb`: before any drop the slug's row is read back (ours / another project's / none / unknown — nothing dropped on unknown); a project of unknown recording, or whose drop failed, written down beside the site's source (never its connection string); the next attempt settles every such note of the same account before it makes another, and makes none over one it cannot remove or read; every failure after the record says `recorded: true` with its stage; the add-on tells a project kept (`projectKept`), never "nothing was changed"; a claim answer that cannot be read is cannot-tell; another account's project row is never this site's database | `test/late-provision.test.mjs` (10, two through the add-on route); red check 10 of 10; sweep 52: 45, then 7 of 7; the follow-up's mutant killed |
| **6. Completion display**: late first reads losing the undo offer; repeated preview reloads; stale page and table lists across tabs and fresh sessions; never complete because the browser stopped watching | `09b2309b`: one undo keeper (`siteUndoKeep`), kept on a late read of this page's own request unless something was asked since; a preview hold (`sitePreviewHold`) making one move per reading and per look; a fresh look with nothing in flight takes the server's page list whole; a tab coming back into view looks again (once in 15 s); a watch that gave up no longer marks its job shown | `test/completion-display.test.mjs` (7); red check 7 of 7 on the old page; sweep 36: 32, then 4 of 4; every test reading the page script 4627 of 4627; screenshots in Chromium |
| **7. The task titles' usage** | `0ee8e782`: the step owes each request one task-lines call and says the account is INCOMPLETE, naming the request, when none is read; an unread narration line is kept and shown; the writers log the cached input with the fresh (one formatter, `usageLogLine`) | the real writer's line read by the real reader; run 105's reading replayed; red check 9 fail on the old; sweep 17 of 17 |
| **Combinations** | — | `test/batch-combinations.test.mjs` (3): an edit that lands beside an addition refused after its table went in; the same delivered twice; the same read by a fresh session. All three fail on `006d0e0a`, the batch's start |

## 4. Details worth keeping

- **The twelve-requirement limit is a processing limit, kept and told.**
  Each requirement is judged, and the judgment's answer is bounded, so the
  twelve a step keeps track of stays. Past it nothing is set aside in
  silence: each is kept by name with its step, told as not checked and why,
  and leaves the part done in part.
- **The undo offer's contract is unchanged**: the rows the latest data edit
  took away, three as the next message carries them, replaced by a later
  removal and cleared by an addition. What changed is who keeps it: this
  page's own request read late keeps it too. No whole-request rollback was
  added.
- **The preview hold is per site.** Two readings that run at the same moment
  (two requests finishing together) share one move. A hold lets go by
  itself after 20 s, so a reading that never answers cannot keep a published
  change off the frame.
- **The page list.** With anything in flight (a message being handled, a
  build, a watched job, a running request or found job) a page's list still
  only gains pages; with nothing in flight the server's published list is
  the site's, read fresh, and a list that changes while it is read is read
  again once.
- **Shared with the first build**: the provisioner and the schema engine.
  The build route's code is untouched. For a build, the provisioner now
  lists the site's notes before it creates a project (an unreadable listing
  stops the create), and its failure paths record as above. The engine now
  records a column it could not add among its refused rules; nothing the
  build does reads that list, so its behaviour there is unchanged.
- **Two test fixtures had fixed dates** that aged past the page's two-day
  keep this morning (`test/request-live-refresh.test.mjs`,
  `test/request-reconcile.test.mjs`); they now read an hour before the
  real clock.
- **Two `test/site-add.test.mjs` pins** had been failing since `af396d14`,
  missed because that file was not in that change's related set; they were
  re-anchored in `645f58a5`.

## 5. Tests run

- Each change: its own focused files, a red check on the commit before it,
  a mutation sweep from a green baseline with a comment-only control, and
  its related suites (numbers in §3).
- **The full unit suite once the batch was ready**, at `cd8fe7eb`, from the
  repo root (`node --test "test/*.test.mjs"`, Chromium present): **9805
  tests, 9804 pass, 1 fail, 0 skipped**. The one failure was KEEP 1
  (`test/preview-keep-browser.test.mjs`), a real-Chromium case the display
  change's related set missed (it serves `public/` as a folder): it took the
  preview's address for a count of publishes. Corrected in `5680a18b` to the
  owner's rule (at most one load per published change, each newer, ending
  on the newest); its file then 4 of 4. Nothing else was run again.
- **Screenshots** of the visible states, in Chromium with the app's own files
  and a scripted server: a page opening on three finished requests (one new
  preview address for all three), a job found after a watch gave up, and a
  request done in part read from another session.

## 6. What is not shown, and what stays open

- **Nothing here ran against a real model or the live site.** Every model
  answer is supplied by a test; nothing is evidence of what a real model
  writes.
- **Live verification that would be worth a run**, none of it done:
  - a multi-part request whose second part is refused after its table went
    in, the replies written by the real model (that they lead with what is
    live, and name nothing as unchanged);
  - a data removal read late by the sending tab, then "put that back";
  - the preview's one move with several parts finishing, on the real site;
  - a provision that fails after its project (needs a failing Neon stage;
    not reproducible safely on a live site).
- **Remaining gaps**, each in `docs/backlog.md`:
  - a table a refused addition left standing joins the page's table list
    at the next routing answer (the route reads the site's inventory), not
    when the failure is read;
  - a project whose create call's answer was lost entirely (no id came
    back) is still invisible: no listing of the account's projects by name
    reconciles it;
  - a note that cannot be read, or a project that cannot be removed, stops
    every create on that site until the owner settles it by hand, and the
    customer is told to try again;
  - two tabs of one browser still write their own copy of the site's thread
    to storage, last writer wins; a returning tab re-reads the server's
    requests and jobs, not the other tab's thread;
  - the late undo read sees only this page's thread, so work done on
    another device since is not seen by it;
  - the engine keeps a column it could not add declared in the site's
    stored schema;
  - the task titles' historical usage stays unverified; missing telemetry
    is never read as zero.
