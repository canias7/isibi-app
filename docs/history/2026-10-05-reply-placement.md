# Each request's replies with that request (2026-10-05, on the branch)

The owner, after passing run 99's review (the rest of the message is
`2026-10-05-merge-and-closures.md`): *"Then fix the product bug that appends
historical requests' replies beneath a new message: preserve each reply's
association with its original request and place it with that request,
including delayed model replies, questions, reloads and opening the site in
another browser. Keep the composer usable while history loads, preserve
existing conversations, and prevent duplicate messages or reapplying
completed changes. Use request/job identity rather than matching message
wording, and keep normal explanations model-written. Test a new message sent
before history finishes loading, historical and current replies arriving in
either order, duplicate polls, pending replies settling, and reloads. Keep
this product fix on the branch for review without deployment or paid tests
yet."*

**On the branch only**: not merged, not deployed, no image built, nothing
pressed or spent. Shown with supplied answers and the real Worker, and in
screenshots rendered headless; not shown live.

## 1. The bug

The page pushed every message to the bottom of the thread. On opening a site,
it asks the server for the site's requests (`siteRequestsCheck`) and follows
each one this browser has not finished with; a browser that has never opened
the site has finished with none. When a message was sent before that answer
came back, every earlier request's card and replies were drawn under it,
where they read as its replies: five in run 97, and 7, 10 and 12 in three
presses of run 99. A request's later reply went to the bottom the same way,
under anything sent since.

Reading the code turned up three related faults, fixed with it:
- **Another device's request was applied again** when its replies were drawn:
  its preview move, page list, undo offer, words put back in the message box,
  a block on the site, and its question made live. A question that had been
  answered could become the live one, so the next message would be sent as
  its answer.
- **A request's question could be drawn twice**: once by the open-time check
  of the site's live question (`siteAskCheck`), and once by the request's own
  reading of the job that asked it.
- **Nothing on the thread said which request a reply belonged to**, so a
  second reading of a request whose record was lost (another tab writing over
  it) could draw its replies again.

## 2. What the page does now (`public/chat.js`)

- **Every message a request writes carries its key** (`req`):
  - a part's reply carries its job too (`job`), held or settled;
  - the request's own reply carries which one it is (`for`: `end`, or the
    go-ahead's);
  - so do its questions, an answer to its question and what the page says
    of that answer (one lost on its way back, or held for its files), a
    cancel of it and the cancel's acknowledgement, and the page's own "lost
    sight" and "couldn't stop" lines.
- **The message that started a request is its own**: the page knows it by the
  key it was sent under (`siteMsgsSent`, in memory, the key the server names
  the request by), and marks it `req` when the routing reply takes it on.
  Ordinary messages keep their stored shape.
- **A request's next message goes after the last of its own on the thread**
  (`siteReqPut`), never at the bottom under a message sent since.
- **A request with no card on the thread gets one where it falls in time**
  (`siteReqCardAt`):
  - under the message that started it, when that is on the thread;
  - otherwise above the first message that is newer: anything sent from this
    page since it opened (newer than any request the page learns of later),
    or a request made after it by the server's clock, taken from the head of
    that request's messages;
  - at the end when nothing is newer.
- **Another device's request is only said here** (`own: false` on a record
  the page picked up, `true` once it sends a message for it). Its replies are
  the same words, the model's or the page's own sentence, but the reader is
  given no site, address or page, so nothing of this page's is changed by
  them. **Corrected after the owner's review** (`2026-10-05-watched-refresh.md`):
  that applied to every such request, even one still running, so work
  finishing while the page watched never reached its page list, tables or
  preview. It is now decided by when the job finished: what had finished
  before the page's first look is history and only said (its page list
  alone read again from the server when it changed pages), and what
  finishes while it watches is applied. **Corrected again**
  (`2026-10-05-reconcile.md`): every finished job the page's own reader did
  not apply is reconciled with what is published now, whenever it finished,
  and never replayed. A question it still waits on is made live by
  the request's own reading (`siteRequestShow`), once a page.
- **A request's question is drawn by that request's reading only**: the
  open-time check keeps it live and follows the request, which draws it under
  its card after what its parts said.
- **Nothing is said twice**: a part's reply already on the thread under its job,
  or the request's own reply under its name, is not said again, even when the
  page's record of the request is lost.
- **An older thread** (from before these marks) keeps its order: a request's
  next reply goes after the unmarked replies standing right under its card,
  and a request the page picks up goes above the unmarked message that asked
  for an older card, never between them.
- **The composer is never held** while the site's requests load, as before;
  the change adds no wait.

## 3. The canary (scripts only)

So the instrument reads a fixed page correctly:
- `newReplies` counts a message's replies after the message itself, so an
  earlier request put above it once it is sent is not read as its replies.
- The page reader reports each reply's job mark (`job`), and a held reply's
  place is found again by it (`trackHeld`), so messages put above the place
  later do not move it out from under the watch. A place now marked with
  another job is never read as this one's.
- A page without the marks (deploy 2183's) is read as before.

## 4. Tests

`test/request-reply-placement.test.mjs`, 14 cases. The page's own functions
run in a VM with every request answered by the real Worker on the stateful
platform. Earlier requests are made
by another device's routing calls. The thread is read by identity: each
message's request and job, never its words.
- **PLACE 1**: another browser, a message sent before the earlier requests are
  read. The composer takes it at once. The earlier requests go above it, oldest
  first, each reply under its own card, and this message's card and reply go
  under it. Nothing of theirs is applied here: one preview move, this
  message's; no question; nothing in the box; no step posted. The three
  replies read alike ("Changed the description."), so only identity tells
  them apart.
- **PLACE 1b**: the earlier requests arrive while the message's own routing
  reply is still out. They go above it all the same, and its card goes under
  it when the reply comes.
- **PLACE 2** (×2): an earlier request's reply and this message's arrive in
  either order (each job poll held back, then released), and the thread ends
  the same.
- **PLACE 3**: duplicate polls. Looking again, two readings of one request at
  once, and a page whose record of the requests is lost all add nothing.
- **PLACE 4**: an earlier request's part reply still being written holds its
  place under its card, above a message sent since, and settles there.
- **PLACE 4b**: an earlier request's own reply, written late (a stopped
  request), goes under its card; once, and not again on a page whose record is
  lost.
- **PLACE 5**: reloads. The thread comes back as kept, nothing said or applied
  again. A request still running at a reload keeps its reply with it, under a
  message sent right after the reload.
- **PLACE 6**: questions. One already answered on the other device is shown
  under its card and not made live. One still waiting is made live under its
  card, drawn once. Its answer here joins that request, and the reply it
  brings comes after it.
- **PLACE 6b**: a question another device's request asks while this page is
  open (so the open-time check had none to keep) is drawn once under its
  card and made live by the request's own reading.
- **PLACE 7**: an older thread from before the marks. Its messages keep their
  order, and a request's reply still to come goes after that request's
  earlier, unmarked reply.
- **PLACE 8**: a question of another device's request cancelled here. The
  cancel and its acknowledgement go with the request, and so does the reply
  the request ends with. A reading taken before the cancel does not make the
  question live again.
- **PLACE 9**: an older thread's card stays under the message that asked for
  it. A request picked up from the server goes above them both.
- **PLACE 10**: an answer whose routing reply is lost on its way back, though
  the server took it. The answer and the page's sentence about it stay with
  the request, and the reply the answer brings comes after them.

The canary: 2 cases (`test/canary-ui.test.mjs`: replies after the message;
`test/canary-replies.test.mjs`: a place found again by its mark, a place
marked with another job refused, an unmarked page as before), and the
reader's pairing case extended to the mark.

The harness lists gained the new functions: `siteSentMsg` and `siteMsgsSent`
in `test/fixtures/browser-ask.mjs`, and the placement functions and
`siteReqAsked` in `test/fixtures/browser-page.mjs`.

## 5. Checks

- **Red check**, in a throwaway worktree at `83f2601d` (main's page):
  - all 14 placement cases fail on the page as it is on `main`;
  - with the scripts as they are on `main`, exactly the 2 new canary cases
    fail, and 112 pass.
- **Mutation sweep**, from a green baseline of the placement, request-page,
  held-reply and both canary test files:
  - **24 of 27 killed** at first, with 3 comment-only controls surviving.
  - The 3 survivors were gaps, each closed by its own case: the "sent from
    this page" time (PLACE 1b), an answer's mark before its routing reply
    (PLACE 10), and a question arising after the page opened (PLACE 6b).
  - Re-run on those 3 and on the change made since (what the page says of an
    answer goes with its request): **4 of 4 killed**, the control surviving,
    each killed by its intended case.
  - Every file was restored and checked by hash.
- **The full suite**: `9427 / 9427 / 0 / 0` locally, from 9,411 by the 14
  placement cases and the 2 canary cases; unit CI `9427 / 9423 / 0 / 4` on
  `22dd7e53` (run 37263890210; CI skips four).
- **The image**, predicted over `main` (`cd817fee`) and the branch
  (`22dd7e53`): `386607152d4cb319` at both, 194 inputs, none different. The
  page is the Worker's asset, not the container's, so a merge would deploy it
  without building an image.
- **Screenshots** (headless Chromium, the repo's own `public/`, every answer
  supplied): a fresh browser, a message sent before two earlier requests were
  read. **Before** (main's page): both earlier cards and their replies land
  under the new message, one card apart from its reply. **After**: the earlier
  requests sit above the message in the order they were made, each reply under
  its own card, and the message's card and reply under it.

## 6. What is not shown

- **Live**: nothing here has run against the real site or a real model.
- **Not changed**: an ended request's own reply with no record is still asked
  for whenever it is read, however old (the backlog's other half of this
  item).
- **A request's card placed by time** compares the server's clock with the
  server's clock only. A message sent from this page counts as newer than
  anything the page learns of later, so the browser's clock is never
  compared.
