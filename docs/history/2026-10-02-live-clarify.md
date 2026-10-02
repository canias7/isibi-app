# Questions back on a site that exists (2026-10-02)

**On the branch `claude/help-needed-ehlwlj`, for review. Not merged, not
deployed, no live run.** Nothing was spent, no model was called, nothing was
changed on a site, and no container was built. Every outcome below is shown
with supplied model answers through the product's own code.

**The owner's order:** *"Implement model-driven clarification for
existing-site edit and add-on requests only; preserve current first-build
behavior. Let the router ask a targeted question when missing information
materially affects which path, target, or operation to choose, instead of
converting clarification into add-on work. Let edit and add-on steps request
clarification too when they discover missing details after routing. Use
existing site context before asking, accept typed answers and useful
optional choices, and preserve the original request, attachments, scope,
deferred parts, and completed work across the answer and page refresh.
Resume with the answer incorporated without repeating completed changes or
charges; support cancellation and a changed request, and prevent stale
answers from triggering work. Clear requests should proceed directly,
technical failures should remain technical failures, and intent and
questions must come from the model without customer-keyword or site-specific
hardcoding. Add focused tests for ambiguous routing, missing details inside
each path, answer-to-resume, refresh, cancellation, stale answers, mixed
requests, and unchanged first-build behavior. Run relevant fast checks and
required CI, update the audit and docs/owner-notes.md, and push for review.
Keep deployment and paid testing pending so we can combine the approved
changes."*

Batches 1 and 2 of the whole-router audit, and batch 2's review fixes, are on
the same branch and wait for the same combined deploy.

## 1. What was wrong before

On a site that exists, a question the router wanted to ask was not allowed.
The reader overruled it to the live site's fallback, `addon`, with the
reason `clarify-closed`, so a request the router could not place became paid
add-on work. Measured free on `a8ed6b73` (this branch's base) with a supplied
router answer `{intent: "clarify", question: …}` on a live site:

| Tree | What the route answered |
|---|---|
| `a8ed6b73` | `intent: "addon"`, decision `fallback`, reason `clarify-closed` |
| this branch | `intent: "clarify"`, the model's own question, decision `model` |

No step after routing could ask anything either: a picker that could not
tell which thing was meant had to guess, refuse, or hand the work on.

## 2. The contract: one live question per site

`builder/clarify.mjs` (new) holds it, and every path uses it.

- **The question is the model's.** The router, and each step's own model,
  may answer with a question (`QUESTION_FIELD`: the words, and up to four
  optional answers). Code reads it (`readAsk`, one reader) and never writes
  one. No customer word decides whether to ask.
- **One live question per site**, kept in R2 at
  `source/<slug>/question.json`, inside the prefixes a job may write (the
  gateway's `allowedJobKey`), so a step inside a queued job can keep its
  question. The record holds the owner, the site, which stage asked
  (`route`, or the step), the question count, the request the answer resumes,
  the parts put off before it, the time, whether the message carried files,
  and a status: `pending`, `answered`, `cancelled` or `superseded`. A question
  lives 24 hours.
- **It closes once.** Answering, replacing or cancelling writes the new
  status on the same etag (`onlyIf.etagMatches`); of two answers to one
  question only one can act (`closeAsk`, `raced` for the loser).
- **Two questions per request at most** (`MAX_ASK_ROUNDS = 2`). The router
  is told how many are left; past that, a question is shown as plain words
  with nothing waiting (`clarify-spent`), never turned into work.
- **The first build is unchanged.** Its tool, its request and its reader are
  byte-identical to `a8ed6b73` (42 pinned hashes, measured on both trees),
  and it never reads or writes a site's question.

## 3. The routing call (`POST /api/site/route`)

- **Before the model**: a message that answers names the question
  (`ask: {id, chosen}`). The route reads the live question first and refuses
  anything but this owner's pending, unexpired question with HTTP 409
  `stale-question`, at no cost and with no model asked: answered, cancelled,
  replaced, expired, another owner's, another question, a malformed id, or a
  claim on a first build. A message that names no question closes the live
  one as replaced, so an older tab can never answer it later.
- **The router is shown what waits** (the request and the question) and
  says in `answered` whether the message answers it or asks for something
  else. A pressed answer counts as an answer whatever the router says.
- **An answer resumes the waiting request** with the question and the answer
  added (`answeredRequest`: the request, then *"They were asked: …"* and
  *"They answered: …"*, at most 2,000 characters; longer is refused at no
  cost with 422 `answer-too-long`, and the question stays open). The reply
  carries `ask: {answered: true, round, putOff}`: the request to run, its
  question count, and what it put off before the question.
- **A changed request** closes the question as replaced and is routed on its
  own words (`ask: {answered: false}`).
- **A new question** is kept only once the site is confirmed this caller's,
  then named by its id. A resumed request may ask one more, keeping what the
  first put off and whether the request had files.
- **Technical failures stay technical**: an unusable question (`failure.kind
  answer`), a store that cannot be read or written (`store`), or a site that
  is not the caller's each fail the call at no cost with nothing kept.
- **Money**: a routing call that asks is charged like any other. The
  answer's routing call is charged too. That is a decision for the owner
  (§8).

## 4. The steps (edit and add-on routes, sync and queued)

- **Each step may ask** when it finds a detail missing after routing: the
  look picker and the picture door, the text, data, rules, picture, menu and
  page steps, and the add-on picker (`pick_adds`). A step that asks writes
  nothing and is charged nothing (`stepAsk`: `error: clarify`, `cost: 0`,
  `unchanged`; the queued path refunds the reserve).
- **The question is kept by the route's ending** (`askReport`), named by its
  id, with what the answer must still do:
  - asked alone, the whole request;
  - asked beside work that ran (a mixed request), only that step's own words
    (`askRemainder`), so the answer never redoes or recharges what ran;
  - the parts put off before (the resumed request's `putOff`) and by this
    message (`deferred`) both, so the answer still names them;
  - whether the message carried files.
- **Past the budget** a step's question is said as words with no id.
- **A question that cannot be kept** is said as our failure
  (`clarify-unkept`, 503), never offered as a question nobody can answer.
- **What a resumed request put off before its question** rides as `putOff`,
  separate from this message's `deferred`, is named on every ending
  (`heldReport`) and is never run.

## 5. The page (`public/chat.js`, `public/edit-poll.js`)

- **The card**: the question's words last, its answers numbered (keys 1–4)
  and *Cancel this request* (Esc) always there, drawn only under the live
  question's message, with the existing `.st-opts` styles and no new CSS. An
  answered or replaced question keeps its words and loses its buttons.
- **Answers**: typed in the composer, or pressed. A typed answer takes the
  composer's files, as any message does; a pressed one leaves them where
  they are. The router decides whether a typed reply answers or asks for
  something else.
- **Files across the answer and a reload**: the request's files are kept
  beside its question, in memory and in this browser's IndexedDB
  (`gf-ask-files`, entries dropped after 24 hours), never in localStorage.
  An answer sends them with the resumed request. A browser that no longer
  has them (another device, blocked storage) holds the answer and asks for
  the file again, instead of answering without it.
- **The reload check**, once per site per page load: the server's live
  question puts a missing card back and takes off one that was answered,
  cancelled, replaced or expired. An unreadable answer, or one that lands
  after the page started something, changes nothing.
- **Cancel** closes the question on the server once, at no cost, and names
  what the request had put off.
- **Stale or too-long answers**: the route's own sentence; a stale card
  comes off.
- **The question count and the parts put off** travel through every post,
  hop, queued job record and resumed watch.

**Found and fixed while writing the page's tests**: when the router asked a
second question after an answer, the page's reader required an instruction
the route never sends with a question, so it said *"I couldn't work out what
to do with that"* and dropped the new question. It now accepts a second
question (an answer settles with a request to run only when it is work).
The case fails on the code before the fix (measured) and passes after.

Screenshots, rendered in a real Chromium from the app's own files with
supplied server answers (sent in the chat, and kept as
`docs/edits/live-clarify-1-card.png`, `…-2-answered.png`,
`…-3-step-question.png` and `…-4-cancelled.png`, clipped to the chat): the
card, the card after a pressed answer (its words kept, its buttons gone), a
step's question after work that ran, and a cancel. The success sentence in
them ("✅ Done.") is the supplied reply's, not a real one.

## 6. Checks

### 6.1 New tests (61 cases)

- `test/live-clarify-contract.test.mjs` (17): the stored question's fields
  and limits, `askLive`, a single-use close with a race, damaged records,
  `answeredRequest`, `readAsk`, the question key inside a job's wall, the
  first-build pin (42 hashes), the live router's budget wording, asking,
  unusable asks, the spent budget, answered / chosen / unread, a clear
  request, no add-on conversion, `QUESTION_FIELD` on nine tools, each step's
  question (text, data, rules, picture, menu, page), the picker questions
  (look, door, add-on), `heldReport`'s `putOff`, and the browser poller's
  hand-over and job records.
- `test/live-clarify-route.test.mjs` (21), through the real routes, with the
  browser's own post cut out of `chat.js`, synchronously and as queued jobs
  where the path differs: the router asks; a clear request goes straight
  through; the first build never touches a question; technical failures
  (unreadable question, store read and write failures, an answer whose close
  cannot be written, no address to keep a question, another owner's site);
  a typed answer resumes; a pressed answer; a changed request; a message
  naming no question replaces the waiting one; eight stale answers and two at
  once; an answer too long; a second question keeping the parts put off and
  the files; the owner route's read and cancel (another owner, twice, a bad
  body, expired); the look picker asking (sync and queued); the text step
  asking (with files); a mixed request; past the budget; a step's question
  on a resumed request keeping both kinds of put-off part; `putOff` named on
  endings and never run; a resumed request reaching the step with the answer
  in it (sync and queued); the add-on picker asking; a question that cannot
  be kept.
- `test/live-clarify-browser.test.mjs` (23), the page's real handlers in a
  VM: the card; a question with no answers offered; files kept with the
  question; a typed answer; a pressed answer by click and by key; keys only
  while the card is on the thread; a changed request; the router asking
  again; files across a reload (IndexedDB) and the day-old entries pruned;
  a browser without the files; a stale answer; an answer too long; a failed
  route on an answer; a settlement the page cannot read; cancel by button,
  Esc and after another tab; a failed cancel; the reload check (answered
  elsewhere, missing, words already on the thread, replaced, unreadable,
  busy, late); a step's question; a mixed reply and past the budget; the
  add-on's question; the first build's interview unchanged.

### 6.2 Red checks

- The three files fail to load on `a8ed6b73` (the module and the page's
  handlers are not there).
- The behaviour probe of §1: the live-site question became `addon`
  (`clarify-closed`) on `a8ed6b73`.
- The second-question fix of §5: its case fails with the fix reverted and
  passes with it.

### 6.3 Existing tests changed (21 files)

Each change is a re-anchored pin or a widened harness, with its reason in
the file:
- **The page's harnesses** cut the new question block (`ASK_FNS`/`ASK_LINES`
  in `test/fixtures/browser-ask.mjs`) wherever the cut functions now reach
  it: seven harnesses, and both of the sweep script's readers (which now
  read a question message and return it).
- **Pins on lines that changed**: the answered branch's brief, `go`'s
  put-off parts, `attached` with the kept files, the step's files on hops
  and watches, `doneText`, `rememberJob` and `resumeEditJob`'s fields, the
  question branch's window end, the add-on step's import allow-list
  (`./clarify.mjs`), the picker's size ratio (one tenth to one eighth: the
  question field is 884 characters), two windows re-derived (8,000 → 9,000
  and the site-files ceiling), and the canary's key extraction.
- **`route-decision`**: `clarify-closed` now pinned on a first build with
  its questions spent; three new codes (`clarify-spent`, `answered-unread`,
  `answered-ignored`).
- **`site-route-failure`**: its two controls rewritten for live questions
  (with ids); a question without a valid id is not acted on.

### 6.4 Mutation sweeps

Run with `scripts/mutate.mjs` from a verified-green baseline, each with
comment-only controls:
- **Server** (`builder/clarify.mjs`, `builder/site-ask.mjs`, `worker.js`;
  the contract and route tests): 40 of 40 killed, 3 controls survived.
- **Page** (`public/chat.js`; the page tests and `site-route-failure`): 36
  of 37 at first. The survivor removed the check that refuses a malformed
  answer settlement; no case sent one. Closed by the new case *a settlement
  the page cannot read* (§6.1), then 1 of 1 killed with its control
  surviving: 37 of 37 in all.

### 6.5 Full suite, CI and the container

In §9, stamped after each run.

## 7. What this does not show, and the limits it leaves

N28–N40 in the audit's §3.0 and in `docs/backlog.md`:
- **Nothing is shown with real models** (N28): whether a real router asks
  a good question when it should, and acts when it can, is a live
  measurement.
- **A side question replaces the waiting one** (N29): any message that
  names no question closes the live one, including a side question in
  another tab.
- **The answer and the request share 2,000 characters** (N30); a longer
  pair is refused, at no cost, with the question kept.
- **Past two questions a question is words** (N31), with nothing waiting.
- **The answer's routing call is charged** (N32): the owner's decision.
- **Not every model call asks** (N33): the per-lane calls, the full page
  writer and the add-on's designers do not; only the pickers and the steps
  named in §4.
- **A step's question beside other work is kept only when what it leaves
  to do can be told apart from what ran** (N34): its own words, or the
  message less every other step's own words. When another step ran on the
  whole message, or on a fixed request, that part is left alone and said as
  not kept (*"…so I left that part alone. Send it again"*), so an answer can
  never redo work that ran.
- **Files survive a reload only in the same browser** (N35); another device
  or blocked storage is asked to attach them again.
- **A second router question that cannot be kept after the first was
  answered uses the answer up** (N36): the call fails as ours, and the
  request must be sent again.
- **The question field adds 884 characters** to every look-picker call
  (N37).
- **The add-on step is still never sent attachments** (N38), as before.
- **A question's words in a multi-line reply run into one paragraph** on
  the thread (N39): the thread shows a reply's line breaks as spaces, as
  it does for every multi-line reply today. Not restyled (yours to decide).
- **The sweep readers return the question** (N40) for a future paid batch;
  no batch reads it yet.

## 8. Decisions that are the owner's

- The answer's routing call is charged like any other routing call (1–2
  credits). It could be made free; that needs a rule for who pays when the
  router asks.
- Whether the thread should show a reply's line breaks (N39).

## 9. The container, the full suite and CI

- **Full suite, locally**: `8901 / 8900 / 1 / 0` on the working tree before
  the commit (the one failure the image census, which needs every image
  input committed: `builder/clarify.mjs` was new), then `8901 / 8901 / 0 /
  0` at the commit `4d2f10ed`, with `test/container-images.test.mjs` 17 of
  17. The suite was 8,840 before this round; the 61 new cases make 8,901.
- **Unit CI** on `4d2f10ed` (run 37032417202): `8901 / 8897 / 0 / 4`, the
  same total; CI skips its usual four.
- **Site build** on `4d2f10ed` (run 37032417218): all 8 jobs green; the gate printed "ALL CHECKS: 404 checks in 27 sections across 4 shards, every job green" at inputs `f20743cc5aef66e5` (3,969 files).
- **The container**: predicted over both ends with the deploy's own
  `containerInputs` and `imageId`: `main` (`f9979497`) gives
  `a4409e55d3f3eb09` (189 inputs, 159 distinct: deploy 2179's image), and
  the branch gives `836ed46c411ade1f` (191 inputs, 161 distinct; the new
  module is one of them). A merge would roll the image; nothing was built.
