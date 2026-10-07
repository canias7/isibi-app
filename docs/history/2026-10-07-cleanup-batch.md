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
| B5 | `645f58a5` | A database started before a failure is kept against its site — said never duplicated; not so until §9 (`570adb45`) |
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
| **5. Late provisioning**: a project made before a failure kept against the site or written down, meant never to be duplicated (§9: not so until `570adb45`), ownership kept, nothing potentially used deleted | `645f58a5` + `cd8fe7eb`: before any drop the slug's row is read back (ours / another project's / none / unknown — nothing dropped on unknown); a project of unknown recording, or whose drop failed, written down beside the site's source (never its connection string); the next attempt settles every such note of the same account before it makes another, and makes none over one it cannot remove or read; every failure after the record says `recorded: true` with its stage; the add-on tells a project kept (`projectKept`), never "nothing was changed"; a claim answer that cannot be read is cannot-tell; another account's project row is never this site's database | `test/late-provision.test.mjs` (10, two through the add-on route); red check 10 of 10; sweep 52: 45, then 7 of 7; the follow-up's mutant killed |
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

## 7. The correction round (Codex's review of `430a3a64`, 2026-10-07)

Codex reviewed `430a3a64` and reproduced four groups of defects; the owner
asked for them, and the batch's remaining gaps, to be finished together:
*"Continue the existing cleanup batch … resolve these findings together
before calling it complete … Keep the implementation universal: shared
structured evidence and state rules, natural model-written narration, no
site-specific patches, canned customer explanations or exact-prose tests."*
Still on the branch, unmerged; nothing deployed, no container built, no model
called, no paid run, nothing restored.

### The commits, in order

| # | Commit | What |
|---|---|---|
| C1 | `71e47213` | Provisioning: every create written down first; unrecorded projects claimed, never dropped on "no row" |
| C2 | `b1a2ebb0` | What a part's tries left standing reaches every reader: view, queued reply, card, job outcome |
| C3 | `5d09f018` | Data changes: equality decided on the whole typed values, never on what is shown |
| C4 | `b3ba67f0` | Seed outcomes: every starter row told by its place, from one row-by-row record |
| C4b | `be72a031` | Image: the worker tree carries the seed-row reader the job runner now imports |
| C5a | `ed431b50` | Tables an addition left standing without going through are known when its failure is read |
| C5b | `81f80406` | A column the database refused is never offered as one the site has |
| C5c | `282da3e1` | Late undo offers check the server for newer work; another tab's save no longer erases or resurrects evidence |
| C5d | `32a2e9ca` | Preview browser test: the frame's content checked against what the server has published |

### Finding → fix → tests

| Finding | The fix | The tests |
|---|---|---|
| **1. Provisioning recovery**: settling read the slug's row before an earlier attempt's claim became visible, dropped the now-recorded project, made another, lost the claim and built inside the deleted project; a failed drop then a failed note left an untracked project and the next attempt made a second | `71e47213` (`site-provision.mjs`, `site-db.mjs`, `worker.js`): a note is written under a fresh attempt id before any create, and the Neon project's own name carries the id, so a create whose answer was lost is found by exact name; a project is dropped only when the slug's row names another project (the one answer an in-flight claim cannot overtake); every other unrecorded project is claimed by the same atomic claim, never dropped, and one queued for teardown is never claimed; nothing new is made while this account's earlier attempt is unsettled, each open note named; another account's note is never touched; a create's error is read by HTTP's meaning (4xx and 503 made nothing, other 5xx searched at once, 504 and no answer wait out the attempt's lease — superseded by §9: only Neon's own refusal made nothing, and no wait or empty search proves it); a note is cleared only when its project is the site's, gone, being torn down or proved never made (§9: or refused by Neon itself — "proved never made" is gone); the add-on no longer promises that trying again fixes an unsettled state | `test/late-provision.test.mjs` rewritten (28: Codex's ordering, the double failure, lost creates, failed clears, three controlled interleavings, account isolation, route cases) and `test/site-provision.test.mjs` (60); red check 25 of 25 fail on `430a3a64`; sweep 47 + control: 41 killed, 6 survived → cases added → 6 of 6 |
| **2. Partial evidence end to end**: `requestView` dropped a part's `left`, so the request reply and its queued writer said a part stopped after its table went in "changed nothing"; settle's stop branch ignored the job's database record | `b1a2ebb0` (`builder/request.mjs`, `site-reply.mjs`, `worker.js`, `public/chat.js`): `requestView` carries `left`; the stop branch reads the answer and the database record (`leftOfRow`), and the driver, job poll and job list read the record for any ended job whose answer does not settle it (`wantsEvidence`); an earlier try's standing work stays on the part across a retry, refusal, question and stop under one rule (`endUnfinished`); the job's outcome reads a stop or death over a standing table as partial; the card labels a stopped part that left something | `test/partial-evidence.test.mjs` (10, through the real Worker, queue and request reply writer, the serialized view, the card, the job poll and job list); red check 7 of 8 fail on `71e47213` (the finished-retry control passes on both); sweep 20 + control: 18, then 2 of 2 after two cases |
| **3. Data change equality**: values compared after cutting to 200 characters, so long different values read as the same | `5d09f018` (`builder/site-apply.mjs`, `site-reply.mjs`): `same` decided on the whole typed values (true only when the before was read and the after came back; absent when either is unknown); `wasUnknown` never null; `readBack: false` per field; shortening only for showing, marked (`wasCut`, `nowCut`, `differsPastCut`); the facts follow | `test/data-change-evidence.test.mjs` DATA 7–10 and DATA 1 updated; red check 5 fail on `b1a2ebb0`; sweep 13 of 13 |
| **4. Seed outcomes**: over the limit plus none going in gave contradictory claims in the note and the facts | `b3ba67f0` (`site-schema.mjs`, new `builder/seed-rows.mjs`, `site-add.mjs`, `site-reply.mjs`, `worker.js`): the engine records each table's rows by their place (in, refused, named no column, past the limit, never tried); one strict reader; warnings, facts and fallback note derived from it; the add-on cleaner no longer drops malformed rows or cuts at twelve before the engine (that renumbered rows and hid the overflow). `be72a031`: the image's worker tree carries the new module (`test/dockerfile.test.mjs` caught its absence) | `test/seed-outcome.test.mjs` (8, checking the evidence each account carries, not its sentences; two through the add-on route); red check 8 of 8 fail on `5d09f018`; sweep 30 + control: 29, then 1 of 1 |
| **5a. Table inventory after a failed or stopped addition** | `ed431b50`: `GET /api/site/routes?tables=1` answers the routing route's own inventory (`routeTableNames`; names, empty, or `null` when it cannot tell); the page reads standing tables from the evidence (a failure's outcome, a stopped or dead job's database record), keeps the named ones at once, and reads the site's list again on the routing clock; wired at every place a page learns an addition ended, never inside the shared reader the paid runs' harness executes | `test/standing-tables.test.mjs` (6); red check 6 of 6 fail on `b3ba67f0`; sweep 18 of 18 after one case |
| **5b. Rejected columns** | `81f80406`: the engine takes a refused column out of what it treats as created (grants, public projection, stored declaration, rules) and the declaration's union never restores it; `liveDeclared` cuts each declared table to the columns its catalog rows name; the designers' reader (`specForAddon`, both branches) and the data step read through it; an unreadable catalog stops the data step at no cost | `test/rejected-columns.test.mjs` (6); red check 3 of 3 behavioural cases fail on `ed431b50`; sweep 15 of 15 after three cases |
| **5c. Late undo versus newer work; two tabs** | `282da3e1`: `GET /api/site/request/<slug>/<key>?newer=1` (`newerWorkSince` over `edit_jobs`: true, false, or `null`); a late first read keeps the offer only on the server's plain false, and looks at the thread again after the wait; the offer carries `undoAt`; a save after another tab's write (`storage`) takes in its request records, own marks, shown jobs, closes, the later view, found jobs' cards and the newer undo offer — never the thread | `test/undo-newer-work.test.mjs` (6); red check: the server and page cases fail on `81f80406`, the two-tab cases cannot load; sweep 22 of 22 after the two-tab cases were made decisive |
| **5d. The preview browser test** | `32a2e9ca`: the test's server serves what it has published (its own record), parts publish one at a time, and the frame's content is compared with that record after each | old KEEP 1 passes against a page whose preview never moves past its first published change; the new one fails it; all four cases pass on the current page in Chromium |

### Details worth keeping

- **Attempt notes are the write-ahead record.** A note (`source/<slug>/neon-unrecorded/<attempt>.json`, never a connection string) exists before any create; the Neon project's name carries the attempt id. "No row" is never a reason to drop: only a row naming another project is.
- **What cannot be established stays unresolved and actionable**: an unreadable note, a project that cannot be read or removed, or a create whose answer neither landed nor was refused within the lease keeps the site from making another database, the note naming what to settle; the customer is told a database may have been started and is set aside to be checked, never that trying again will fix it.
- **The seed record is strict**: one fate per designed row, every row once, the overflow count checked; a record that does not add up is never read, and a stored entry carrying one is cannot-tell.
- **The undo contract is unchanged.** "Newer work" means any edit, addition, request part or rewrite filed on the site after the request's acceptance, from any tab or device, less the request's own.
- **Cross-tab merging is evidence only**: each tab's thread stays its own, as before.

### Tests run in this round

- Each change: its own cases, a red check on the commit before it, a sweep with a comment-only control, and its related suites (the numbers are in the commit messages and the table above; the largest related runs: 2811 of 2811 for the seed change, 4346 of 4346 for the inventory change, 4824 of 4824 for the rejected columns, 4570 of 4570 for the undo and two-tab change).
- The full unit suite once at the end (`32a2e9ca`, the repo root, Chromium present): **9863 tests, 9863 pass, 0 fail, 0 skipped**.
- Unit CI: green on `32a2e9ca` (run 37631248299, `9863 / 9841 / 0 / 22`, the total matching the local run, the 22 real-browser cases skipped as on every CI run); red once on `b3ba67f0` (run 37617079560, `9845 / 9822 / 1 / 22`: the image test's case that the worker tree carries everything the job runner imports, fixed in `be72a031` and reproduced locally on `b3ba67f0`), green on every push since. Site build green on `282da3e1` (run 37630057430, all eight jobs), the last commit touching its paths.

### What stays open after the round

- Nothing here ran against a real model or the live site.
- **Provisioning**: Neon's search by name and its paging are used as documented, not measured live; the 15-minute attempt lease is an assumption about how long a lost create can take to land; an unresolved attempt needs the owner to settle it by hand.
- **Rejected columns**: a declaration an earlier apply left behind stays in `_meta`; the designers' reader and the data step cut it, but readers through `loadSiteSchema` (the Data panel, the runtime hooks) still read it.
- **Late undo**: work that leaves no `edit_jobs` row (an inline run with the queue off) is not seen, nor a request accepted elsewhere in the instant before its first job is filed. A live (not late) offer on another device is unchanged.
- **Two tabs**: only tabs of one browser share storage; the thread is not merged; another tab's evidence is taken in at this tab's next save after the write.
- **The browser preview test** runs where Chromium is installed; unit CI skips it.
- **The test platform** now filters job-table reads by owner, site and creation time; it still answers every column a read asks for.

## 8. The follow-up pass (the same request, sent again, 2026-10-07)

The owner's request arrived a second time, word for word, after §7 was handed
over. Nothing was restarted. Each limitation the handoff named was checked
against the guarantee it falls under; the ones within reach were closed, and
the rest keep their cause. Still on the branch, unmerged; nothing deployed, no
container built, no model called, no paid run, nothing restored.

### The commits

| # | Commit | What |
|---|---|---|
| D1 | `dc531bef` | Put-back offers checked against the table; late undo sees requests before their first job |
| D2 | `320d6767` | Rejected columns: an addition that makes a table is covered for the page writer too (a test; no code change) |
| D1b | `a921a64d` | Late undo: the queue flag is read at the request handler's one fork (the full suite's one failure, below) |

### Finding → fix → tests

| What was still open | The fix | The tests |
|---|---|---|
| **Late undo saw only `edit_jobs` rows**: a request taken on elsewhere before its first job was filed, edits run with the queue off, and the Data panel left no row | `dc531bef`. **Where the offer is used**: the data step checks each row the page offers to put back against the table as it reads it (`freshRecent`, `builder/site-apply.mjs`): a row whose id is back, or whose values sit in a live row under the table's own declared columns, is set aside — the platform's own columns (`id`, `created_at`, `owner_id`, `updated_at`) are never compared, since a row put back gets new ones; a table that filled the step's read is read once more to `PUT_BACK_READ_MAX` (1,000) rows, only when an offered row names it, and a table longer than that cannot show a row gone, so its rows are set aside. This covers a late or a live offer, whoever changed the table. **Where the offer is kept**: `newerWorkSince` also reads the site's request markers (written before a request's record and its first job) by the acceptance time in each marker's body, never its upload time (a marker is written again at its end); a marker that cannot be read, a list that does not end, or a site whose edits are no longer queued answers cannot tell | `test/put-back-guard.test.mjs` (4: the rule, a table read in part, two cases through the real edit route); NEWER 4 in `test/undo-newer-work.test.mjs` (the real Worker; the real acceptance with its first filing refused; a marker rewritten after the request with a later upload time; unreadable, failed, swept-away and same-instant markers; a list that does not end; the queue off); red check on `6945ab3a`: PUT 3, PUT 4 and NEWER 4 fail, NEWER 1–3 and TABS 2 pass on both; sweep 25 + control: 24 killed, the platform-column filter survived, killed after a case whose declaration lists those columns; the control survived |
| **Rejected columns: readers of the stored schema beyond the designers** | `320d6767`, no code change. Every reader that hands columns to a model was checked: the add-on's designers, the data step, the rules step and the page rung read through the live-column cut since `81f80406`. The add-on reads the stored copy back after its apply, and that copy still declares a column an earlier apply left behind — but the page writer and its lint run before the apply, on the designers' cut spec, and the copy read back feeds only the reply's connections (`aSpec.apis`). A cut added there during this pass was taken out again before committing: it would have read the catalog after every apply for no reader | COL 3c in `test/rejected-columns.test.mjs`: an addition that makes a table and a page — the page writer never offered the stale column, the new table offered, the control column offered when the table has it, the stored copy after the apply shown still declaring it. It passes before and after: a regression guard, not a red check |

### Tests run in this pass

- Each change: its own cases, the red check above, the sweep, and the related suites (the rows stand-in's nine users 220 of 220 after it learnt `LIMIT`; the four files touched 106 of 106).
- The full unit suite once, at `320d6767` (the repo root, Chromium present): **9869 tests, 9868 pass, 1 fail, 0 skipped**. The failure was a real one: `test/edit-job.test.mjs`'s guard that `worker.js` reads the canary configuration at exactly one place, the request handler's fork — the queue check in `newerWorkSince` had become a second reader. Fixed in `a921a64d` (the route reads it and hands the answer down); the failing file and the three beside it (`undo-newer-work`, `request-reconcile`, `put-back-guard`) then 48 of 48, and the sweep's queue mutant, moved to the new line, killed with the control surviving. Nothing else was run again.
- Unit CI after the follow-up pass: red on `320d6767` (run 37641938704, `9869 / 9846 / 1 / 22`: the same canary-reader guard) and green on `a921a64d` (run 37642914421, `9869 / 9847 / 0 / 22`, the total matching the local run); site build green on `a921a64d` (run 37642914499, all eight jobs), its run on `320d6767` marked failed with the seven jobs that ran all green and the eighth, the aggregate, never created, during GitHub server errors between 15:10 and 15:19 UTC.

### What stays open after the pass

- **Late undo, when the offer is kept**: a Data panel write is still not counted then (it files nothing); what it would change is checked when the offer is used.
- **The put-back check** sets an offer aside when an identical entry remains (two entries alike, one taken off: "put that back" then has nothing offered, and the model sees the remaining one), and for a table over 1,000 rows.
- **Rejected columns**: a declaration an earlier apply left behind stays in `_meta`; the Data panel, the runtime hooks, the backups and the reply's read after an apply still read it, and none of them hands columns to a designer.
- **Provisioning**: unchanged from §7 — Neon's search by name and its paging are used as documented, not measured live (that needs the live provider, which this round may not touch), and an unresolved attempt is the owner's to settle.

## 9. Codex's latest database recovery findings (reported on `78a83b39`, 2026-10-07)

New findings, apart from the provisioning fixes of §7 (`71e47213`), which they
correct in two of its readings. The owner: *"This push does not address
Codex's latest database recovery findings … Fix the shared recovery rule:
uncertain creation or incomplete discovery must retain durable evidence and
must not authorize a replacement create … neither elapsed time nor an
immediate empty search establishes that creation never happened without a
documented provider guarantee."* On the branch, unmerged; nothing deployed, no
container built, no live resource provisioned, no model called, no paid run.

### Reproduced before the fix

Against the real `ensureSiteBackend` and `findSiteProjects` at `78a83b39`
(stand-in deps; the provider makes the project, then answers 503):

| Case | `78a83b39` | `570adb45` |
|---|---|---|
| Seen at once, attempt 1 | 503 → 1 project, 0 notes | claimed, the site's → 1 project, 0 notes |
| Seen at once, attempt 2 | 503 → **2 projects**, 0 notes | reused → 1 project, 0 notes |
| Seen after two searches, attempts 1–2 | 503 → **1, then 2 projects**, 0 notes | `create-outcome-unknown`, then `not-visible` → 1 project, 1 note |
| Seen after two searches, attempts 3–4 | 503 → **3, then 4 projects**, 0 notes | claimed, then reused → 1 project, 0 notes |
| Full pages repeating their cursor | answered `[]` after 2 page reads | `{ complete: false, reason: "repeated-cursor" }` |

### The commit

| # | Commit | What |
|---|---|---|
| E1 | `570adb45` | Provisioning recovery: an uncertain create keeps its note; an unfinished listing is never absence |

### What changed

- **One rule for an uncertain create** (`site-provision.mjs`, rule 6). Only a
  refusal Neon itself answered says nothing was made: `site-db.mjs` marks it
  (`refused`) where the status and the body are both known — a 4xx by which
  HTTP says the request was refused as asked (400, 401, 402, 403, 404, 405,
  406, 410, 411, 412, 413, 414, 415, 422, 423, 428, 431), carrying Neon's own
  error body (`{ message }`). Not 408, 409, 425 or 429; never a 5xx; never a
  page some proxy put in front of Neon. Every other answer — a 503 among
  them, which used to clear the note — keeps the note, marked `uncertain`
  with the status it got (`answered`).
- **Reconciled through the attempt's own identity**: the project is looked
  for by the attempt's exact name and claimed for the site when found, with
  the ownership checks as before; a project the site's row does not name is
  dropped only when the row names another (rule 2), and never one the row
  names.
- **No conclusion from absence**: neither the lease running out nor a search
  that finds nothing makes a create "never made". A note whose project does
  not show stays open — `create-outcome-unknown` for the attempt's own
  failure, `in-progress` while an unanswered create's lease runs,
  `not-visible` after — and no second project is made for the site until it
  shows and is claimed, or the owner settles the note by hand.
- **The search says whether it reached its end** (`findSiteProjects` answers
  `{ complete, projects, reason? }`): complete only on a page shorter than
  the limit asked for (Neon's documented paging end); `repeated-cursor` (a
  cursor already sent, a cycle back to one included), `no-cursor` (a full
  page with nothing to go on with), `page-limit`, `malformed` (no list, or an
  entry that is not a project); a failed read throws. Each reaches the open
  note's reason (`search-repeated-cursor`, `search-no-cursor`,
  `search-page-limit`, `search-malformed`, `search-failed`,
  `search-unreadable`); none clears a note or lets a create run.
- **A clear that fails is still settled next time** (rule 5): a refused
  create, and a project its own attempt removed after its create threw, are
  marked on the note (`refused`, `removed`) before it is cleared — only once
  the project is gone, so no other attempt can claim one being dropped.

### The tests

| Case | What it asserts (counts of projects and surviving notes throughout) |
|---|---|
| CODEX 3 | the 503 after the create: seen at once — claimed, 1 project, 0 notes, the next attempt reuses it; seen only later — 1 project and 1 note (uncertain, 503, the attempt's name) through retries at once, past the lease and long after, then claimed: 1 project, 0 notes; made nothing — 0 projects, 1 note, held |
| CODEX 4 | the repeated cursor through the real search (2 page reads, not complete); every incomplete ending through the provisioner keeps the note and makes nothing, past the lease too, until a completed listing finds the project; a failed read and an answer that is not a search's hold the same way |
| SEARCH 1 | every ending of the real search: an empty first page and a short page with a cursor are complete; a cycle, a full page with no cursor, the page limit and a malformed page are not, with what was found on the way; a refused read and an unknown organisation throw |
| REFUSE 1 | through the real create: 400, 403, 422 with Neon's body are refusals; 503, 502, 409, 429, 408 with the same body are not; a 403 whose body is a page is not |
| CLEAN 1 | safe cleanup: an uncertain attempt's project that shows after the site has another is dropped because the row names the other; a failed drop keeps both and the note; not yet seen, nothing is dropped and the site carries on |
| CLEAR 2 | failed clears of a refused note and of a removed-project note are settled by the next attempt, which makes the one project |
| LOST 2, LOST 4, PROV 6, NAME 1 | rewritten from the old rules: an unanswered create stays open after the lease; each of 503, 500, 502, 504, 408, 409, 429 claims the project when it shows and holds when it does not; only Neon's own refusal clears; a 403 that is not Neon's refusal is uncertain; the search's answer is the classified outcome |
| ROUTE 7 (`test/addon-failure-outcome.test.mjs`) | through the add-on route: Neon's own refusal makes nothing and says so; a bare 503 says a database may have been started and is set aside to be checked, never "nothing was changed" |

- Red check on `78a83b39`: 14 of 121 fail — 11 for the behaviour (ROUTE 7, LOST 2, LOST 4, CODEX 3, CODEX 4, SEARCH 1, REFUSE 1, CLEAN 1, CLEAR 2, PROV 6, NAME 1), 3 only because the harness answers the search's new shape (DOUBLE 1, LOST 1, ADOPT 2; their behaviour is unchanged).
- Sweep (`scripts/mutants/provision-uncertain.json`): 25 of 25 killed — the search endings, the refusal mark, a 503 clearing the note again, absence clearing it, the lease, the marks before a clear, the reasons — and the comment-only control survived.
- Related: every test file reaching provisioning or the Neon module, 56 files, 2007 of 2007.
- The regression gate: `570adb45`, the repo root, Chromium present: **9875 tests, 9875 pass, 0 fail, 0 skipped**
- Unit CI on `570adb45`: run 37674861322, `9875 / 9853 / 0 / 22`, the total matching the local run (the 22 real-browser cases skipped, as on every CI run). **Site build on `570adb45` (run 37674861320) is not a complete reading**: the published-site checks, shards 3 and 4 (158 and 62 checks) and the kit job's first steps (`page-gen` and `publish-pages` 398 of 398, `kit-typecheck` 4 passed, `kit-render` all passed) are green; the other four jobs (the theme checks, shards 1 and 2, the rest of the kit job) stopped at their 20-minute limit inside `npx playwright install --with-deps chromium`, apt waiting on Ubuntu's `noble-security` index from 19:30 UTC, before any of their tests started, so `all checks` failed on those three cancelled jobs and the two missing shard reports. The eight steps that never ran, run locally on `570adb45` with Chromium as the workflow runs them, all pass: contrast-cases 16 of 16; kit-a11y, kit-effects and kit-paint all passed; theme-seam 11 of 11; theme-render 29 of 29; `site-build.mjs` shard 1 109 of 109 (`style-overrides`) and shard 2 76 of 76 (`logo-and-serving`, `dead-link`), both complete. A local run is not the gate: CI's own reading needs the failed jobs re-run, which is your press; I did not try it. The records commit changes no input of these checks (the gate's fingerprint `de6345b9058cd1cc`, 3974 files, the same at both), so a green re-run counts for it too.

### What stays open

- **An attempt whose outcome cannot be established waits for the owner.** A create Neon answered with anything but its own refusal, whose project never shows under its attempt's name, keeps that site from making a database until settled by hand: check the Neon console for the name in the note (`source/<slug>/neon-unrecorded/<attempt>.json`); leave the note when a project carries it, for the next attempt to claim once Neon's listing shows it. Deleting the note is the owner's judgment that no project carries the name and none will appear — the code no longer draws that from absence or time — and a project that appeared afterwards would not be tracked.
- **What is trusted**: Neon's own refusal is taken to mean nothing was made on HTTP's meaning of those statuses — no Neon document says it. Neon's `search`, `cursor` and `limit`, its paging ending on a short page, and its error body (`message`) are from its API reference; nothing here has listed or provisioned on a live account.
- **The first-build route** answers an unsettled attempt with its generic 502 (`stage: reconcile_project` or `create_project`, the upstream status), with no sentence of its own; not changed here. The add-on route says a database may have been started and is set aside to be checked.
- **Another account racing the same free name** still gets its own project and the slug's 409, as before.
