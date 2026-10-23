# 2026-10-23 — The parallel card (branch `parallel-card`, not merged, not deployed)

The owner's approved design (mock `b3.html`, left column, without the progress
bar): when one message becomes several parallel parts (a REQUEST_FLOW request
with two or more parts), the thread shows ONE card instead of one long reply
per part.

## What the customer sees

1. **An opening line written by the model** saying it will work on the N
   changes side by side. The task-lines writer (`writeTasks`,
   `builder/site-progress.mjs`) is told the fact of the split
   (`THE REQUEST WAS SPLIT INTO N CHANGES …`, only when a request has two or
   more parts) and writes `opening`; the same call writes each part's short
   `title`. Both travel `commitTasks` → the progress record → `saidOf` /
   `saidForRequest` (`worker.js`) → `requestView` (`opening`) → the page
   (`EditPoll.taskSaid` keeps `title`). No line is written in the code: with
   no opening written none is shown; a row without a title is named by the
   model's line for its state (as today's card names it), and with no lines
   written, by the customer's own words (the existing fallback convention).
2. **One card**: header "Working on N changes · K done" (once ended: "N
   changes · K done · F didn't work"), then one row per part: a grey dot
   (filled done, spinning ring working, dashed ring needs you, empty ring
   waiting or did not work), the title, a small state label (done,
   working…, needs you, waiting, didn't work; a part prepared beside another
   part's job keeps today's chip, "Working on it alongside" / "Ready, applying
   next"), a caret.
3. **Each row is a dropdown** with that part's own text: its live progress
   lines while working, its model-written reply once finished (the replies
   that were separate chat messages are drawn inside the row and left off
   the thread). A closed row's dropdown is drawn `hidden`, so its text stays
   in the page for readers (the canary). The working row opens by itself and closes when done; the
   others are closed; any can be toggled (a toggle holds until the row's
   state moves on). A failed part shows its reply and **Try again**, which
   sends that part's own words as a new message (`siteSend(words, true)`,
   leaving the composer's draft alone; there is no single-part retry path).
   The existing Go-ahead and Buy-again buttons stay on their parts.
4. **A soft box under the card**: the live question with its answer buttons
   (the existing question path) while working; once the request ends, the
   request's own model-written summary (the existing `for: 'end'` reply).

A single-part message keeps today's card (`siteRequestHTML`) and thread.
After a reload, on any device, the card's message carries a snapshot of the
view (`rq`, `siteParSnap`), saved with the chat on the server (`chatSig`
counts it so it is sent).

## Code

- `public/chat.js`: one block after `siteRequestHTML` (`SITE_PAR_STATE`,
  `SITE_PAR_LABEL`, `siteParOpen`, `siteParView`, `siteParState`,
  `siteParSnap`, `siteParHidden`, `siteReqCardHTML`, `siteParClick`,
  `siteParRetry`); the thread render filters `siteParHidden` and draws
  `siteReqCardHTML`; the thread's click delegation asks `siteParClick` first;
  `siteRequestStart`/`siteRequestShow` take the snapshot.
- The word-by-word reveal (`TypeIn`) skips `.st-par` as it skips `.st-req`
  (the card is redrawn on every poll, which restarted the reveal and blanked
  its text).
- `scripts/canary-ui.mjs` (the canary's page reader): reads the parallel
  card's parts (`.st-par-part`: title, label, lines) as it reads today's, and
  aligns the thread with the kept messages less those the card holds
  (`siteParHidden`). **For the owner**: on a split message the canary now
  sees each part's reply inside the card, not as a thread message.
- `public/styles.css`: one block, `.st-par-*`, greys only.
- `builder/site-progress.mjs`: `title` and `opening` in the task tool,
  `taskRequest({ split })`, `readTasks`, `writeTasks`, `commitTasks`,
  `readProgressRecord`, `saidOf`.
- `builder/request.mjs`: `requestView` carries `opening`.
- `worker.js`: `writeTaskLines` passes `split` and commits `opening`;
  `saidForRequest` hands `opening` on.
- `public/edit-poll.js`: `taskSaid` keeps `title`.
- Tests: `test/parallel-card.test.mjs` (9 cases: the card for 8 parts, the
  state mapping, the toggles, the auto-open working row, Try again → the send
  path, the soft box, single part unchanged, reload from the snapshot, the
  opening line and titles from the writer's facts with no sentence in the
  card's code). The page harness (`test/fixtures/browser-page.mjs`) and
  `test/site-entry-inventory.test.mjs` take the new functions; the census of
  composer sends accepts Try again's `words, true`. Browser tests that drew
  a split message with today's card now read the parallel card:
  `test/progress-browser.test.mjs` (TENSES, CARDS, PARALLEL),
  `test/preview-keep-browser.test.mjs` (KEEP 1: "working…"),
  `test/draft-ui-browser.test.mjs` (DFU4: its labels are now "waiting",
  "needs you", then "done"; the old card said "Waiting for part 2" and
  "Saved as a draft" — **a decision for the owner**: under draft-first the
  short label says "done" for a part saved as a draft; the summary says it).

## Checks

- Red: the new file fails on `origin/main`'s code (the functions are absent).
- Sweep: 14 mutants over chat.js, site-progress.mjs and request.mjs, all 14
  killed; the comment-only control survived. Files restored from saved copies
  and compared byte for byte.
- Full suite (`node --test "test/*.test.mjs"`): `12313 / 12307 / 3 / 3`. The three: the no-generated-deps symlink case (expected here), and two timing cases that pass on their own (`canary-ui` 85/85, `media-verify` browser mode 1/1).
- Screenshots (real chat.js functions and the real styles.css, a simulated
  8-part request with stub writer text): working, a question waiting, a
  failed part opened, finished.

Nothing spent, no model called, no live writes.
