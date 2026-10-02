# Questions back: the owner's review (2026-10-02)

**On the branch `claude/help-needed-ehlwlj`, for review. Not merged, not
deployed, no live run.** Nothing was spent, no model was called, nothing was
changed on a site, and no container was built. Every outcome below is shown
with supplied model answers through the product's own code. The round it
reviews is `docs/history/2026-10-02-live-clarify.md`; the code is `2965e405`.

**The owner's order:** *"Finish the edit/add-on clarification feature before
deployment. Fix askRemainder so overlapping model scopes cannot put completed
work back into the resumed request; verify actual resumed model inputs and
that completed changes and charges never repeat. Extend clarification into
the edit models and add-on designers that currently cannot ask when missing
details become apparent after picking the path, preserving completed and
remaining operations. Remove the two-question dead end: never display a
question whose answer cannot resume the original request; retain an
answerable continuation, with protection against repeating the same
unanswered question. Make request replacement and question transitions
reliable: do not continue with a replacement when closing the old question
fails or loses a race, and preserve recoverable state if storing the next
question fails. Reconcile contradictory prompts, including the add-on
picker's instruction to choose the closest kind when uncertain. Add focused
regressions for overlapping scopes, a downstream designer asking after
earlier work completed, a third necessary clarification, failed and raced
replacement, and recovery after a failed question transition. Keep intent
model-driven, preserve first-build behavior, run relevant fast tests and
required CI, update the audit and docs/owner-notes.md, and push for review.
Keep deployment and paid live testing pending."*

## 1. What was wrong on `22184a46`

- **Overlapping scopes put work that ran back in.** `askRemainder` took the
  other steps' words out of the turn, not out of the asking step's own
  words. When the picker gave the asking step words that held a change made
  beside it (*"Change the description to … Then put the order band above
  the other one"* as the page step's words, beside the description lane),
  the question was kept with the description change in it, and the answer
  would have resumed it: the router, the picker and the page writer read it
  again.
- **Some models could not ask.** The look lanes (`edit_site`), the removal
  picker (`take_off`), the page rung's full writer (`write_pages`) and the
  add-on designers (`add_to_site`) had no question field, so a detail they
  found missing became a guess or a refusal.
- **The two-question dead end.** Past two questions per request
  (`MAX_ASK_ROUNDS`), a step's question was shown as words with nothing
  waiting: an answer to it started a fresh request.
- **Replacement went on regardless.** A new message beside a waiting
  question closed it and routed even when the close threw or another writer
  had moved first; and an answer met with the next question was two writes
  (close, then store), so a failed second write used the answer up (N36).
- **Contradictory prompts.** The add-on picker said *"If you cannot tell,
  choose the closest one"* and required a kind (`minItems: 1`) beside a
  question field that says to ask; the live router said *"WHEN YOU CANNOT
  TELL, ANSWER addon"*; the look picker required a lane; the removal,
  page-verb and picture wording told the models to decide on a guess.
- **Found while verifying the resumed inputs**: a step the picker scoped ran
  on its change's own words only, and a resumed request's answers are its
  last lines, in no change's words, so **a scoped step was resumed without
  the answer it asked for**. Nothing on the old branch tested a scoped
  resume's model input.

## 2. What changed (`2965e405`)

**What a step's question leaves to do** (`worker.js` `askRemainder`)
- Every other step's own words are taken out of the asking step's own words
  by position (`wordsLess`), whether that step ran, failed or was withheld.
- When nothing of the asking part can be told apart from what ran (another
  step ran on the whole turn, or every word of the asking part is another
  step's), the question is not kept (`clarify-mixed`) and that part is said
  as left alone: never resumed with work that ran.
- **The request's earlier answers** (`answerLines`, the lines
  `answeredRequest` appended) go with what is left **while nothing was made
  beside the question**. Beside a change that was made they stay out: which
  change an earlier answer was about cannot be told, and one about the
  change made would have the resumed picker make it again. The question then
  records as asked only the questions its request still answers
  (`askedIn`), so it may be asked again and answered (N41).

**Every step of a resumed request is handed its answers** (the step loop)
- Each scoped step and each lane is handed the request's answers after its
  own words (`withAnswers`), as a step on the whole turn always was. Where
  they sit in the message is untouched: every cut still reads the words the
  picker gave.

**The models that could not ask now can** (each asks with nothing written
and nothing charged for the edit)
- **The look lanes** (`editTool(field)` is `withQuestion`): one lane asking
  makes the whole look step ask, and every lane that answered is set aside
  with it, as for a model that is down. The stylesheet correction round,
  which re-aims a change already made, is offered no question (`ask:
  false`).
- **The removal picker** (`takeOffTool`): it asks instead of naming an entry
  on a guess; the look step asks and takes nothing off.
- **The page rung's full writer** (`SITE_PAGES_TOOL_ASK`, page mode only):
  the build's and revise's writers are unchanged, measured byte for byte
  (build `5f88c5a2f738b9eb`, revise `66e12434e0bde0a2`, add-on
  `f58a2d99f8705356` on both trees).
- **The add-on designers** (`addTool` is `withQuestion`): a designer's
  question holds the whole addition. Designers that answered before it are
  not applied (their raw answers go into the add-on's answer record, as
  every add-on's do, and are not reused); nothing is created, registered or
  charged, and the answer resumes the whole addition, every designer run
  again with the answer in its request. The first round's designer calls
  are ours.

**No question its answer cannot resume** (`askReport`, the routing route)
- No budget: `MAX_ASK_ROUNDS` and `clarify-spent` are gone; a question is
  kept, with its id, whenever its answer can resume the request.
- **A repeat is never asked**: a question whose words match one this request
  asked (`askRepeat`: case, accents, spacing and punctuation set aside) ends
  the request, said and uncharged (`question-ended`, `why: "repeat"`, at the
  router; `clarify-repeat` at a step), and an answered question is closed.
- **A question no answer could fit beside is never asked** (`askRoom`: the
  request, the question and an answer as long as its longest option, never
  under 40 characters, within one message): `question-ended`, `why:
  "room"`, with a fresh request back in the message box (`resume`); at a
  step `clarify-no-room`, with what was left back in the box.
- **The router is told what this request asked**, not a count: *"WHAT THIS
  REQUEST HAS ALREADY ASKED THEM — never ask any of these again; their
  answers are in the request"*. A question where none could be kept (no
  live site to keep it on) is an unusable answer: the call fails at no cost
  (`clarify-unkeepable`), never routed on a guess.
- **A step's question the store refuses** is written again after 150 ms
  (`storeAskTwice`); refused twice, it is not kept (`clarify-unkept`, 503,
  ours), its sentence names the question, and what was left goes back to the
  message box (`resume`).
- The page draws no question without an id (`clarifyOf`).

**Reliable replacement and transitions** (the routing route,
`builder/clarify.mjs`)
- A new message beside a waiting question: a read that fails, or a close
  that throws, stops it as ours at no cost (`failure.kind: "store"`); a close
  another writer beat stops it as `409 question-busy`, said, and the page
  puts the message back in the box. Nothing is routed or charged either way.
- The same when the router reads a message as a new request rather than an
  answer: nothing is dispatched or charged unless the waiting question
  closed.
- **An answer met with the next question is one write** (`replaceAsk`): the
  next question is written over the answered one on its etag. A write that
  fails leaves the answered question waiting, so the same answer sent again
  goes through; a write another writer beat is refused as stale (409), with
  no question shown that was never kept.

**Prompts reconciled** (intent stays the models'; no customer words are read)
- The add-on picker: *"If you cannot tell which kind they mean and the
  choice matters, name none and ask them (`question`) instead of guessing.
  When one kind plainly fits better than the others, name it."* — no
  `minItems`.
- The live router's tie-break: *"WHEN YOU CANNOT TELL WHETHER IT IS A CHANGE
  OR AN ADDITION, ASK THEM ("clarify") where a question may be asked …; only
  where questions are closed, answer "addon""*. The first build's router is
  unchanged.
- The look picker (no `minItems`), the door picker, the removal property,
  the page verb, the picture's place and `PICTURE_SYSTEM` each say to ask
  instead of guessing where they said to decide.

**The page** (`public/chat.js`, `public/edit-poll.js`)
- `question-busy` puts the message back in the box and clears the card;
  `question-ended` clears the card and, for a fresh request too long to ask
  about, puts it back in the box; a reply's `resume` goes back in the box
  with the message's files (`holdResume`); a malformed `resume` makes the
  reply unreadable.
- The questions a request asked travel with it (`asked`): the routing
  answer, the edit and add-on posts, a queued job's stored record and its
  hand-over; an unreadable list is not acted on.

## 3. Checks

**New cases: 32** (`8901` → `8933`)
- `test/live-clarify-continue.test.mjs`, 19 cases through the real routes
  (synchronously and as queued jobs), reading what each model was really
  sent (`seen.inputs`, `seen.picks`, `seen.lanes`, `seen.routerAsked`):
  - **overlapping scopes**, sync and job: the record keeps only the page
    step's own part; the router answering it, the resumed picker and the
    resumed page writer are never shown the description change; the
    description lane is never called again; each part is charged once;
  - nothing of the asking part told apart from what ran (the same words, no
    scopes): not kept, said, nothing back in the box;
  - **a resumed request's answers reach the one scoped step**, and stay with
    what is left when that step asks with nothing made beside it;
  - **beside a change that was made, an earlier answer stays out**: the
    description lane is handed the router's answer and makes the change; the
    page step's question resumes only the page step, records only itself as
    asked, and the router, the picker and the writer on the answer never see
    the description's answer;
  - **a lane asks after another lane answered**, beside a page change that
    runs: the look step changes nothing, the page change is made, the answer
    resumes the look step whole;
  - the full page writer asks; the removal picker asks;
  - **a downstream designer asks after an earlier designer completed**
    (function then job, through the add-on route): nothing applied,
    registered or charged; resumed, every designer is handed the answer and
    the addition is applied once;
  - **a third necessary question**: the router asks twice and a step a third
    time, each kept with its id; the last answer resumes the original
    request with all three answers;
  - the same question never twice, at the router and at a step;
  - a question no answer could resume, at the router (fresh and resumed) and
    at a step;
  - **failed and raced replacement**: a new message whose close throws or
    loses, a request read as new whose close throws or loses, and a waiting
    question that cannot be read — none routed or charged;
  - **recovery after a failed transition**: storing the next question fails
    (only that write) and the answered question is still waiting, so the
    same answer goes through on the second try, and only then is the first
    used up; the next question's write beaten by another writer is stale;
  - a step's store blip is ridden out; a store that stays down puts what was
    left back in the box, without the change that ran.
- The contract file, 9: `answerLines` and `askedIn`, `askRepeat`, `askRoom`,
  `replaceAsk` (throw, raced, closed, won, invalid next), each model that
  now asks (`runLane`, the correction round, `runTakeOff`, `runAdd`, the
  page writer in page mode against a build), the page-writer pins, the
  reconciled prompts, the picture system text, hand-overs carrying `asked`.
- The page, 3: a not-kept step question's `resume` back in the box with the
  files (alone, beside work that ran, and a malformed one refused);
  `question-busy` and `question-ended`; the questions list forwarded and an
  unreadable one not acted on.
- `test/route-decision.test.mjs`, 1: `addReason`.

**Existing tests changed**
- The route file's two-question case is now the third question kept and
  answerable; slug-less asking is unusable (`clarify-unkeepable`), not a
  fallback; the unkept case asserts `resume`.
- 12 cases in 10 other files pinned the shapes this round changed on
  purpose, each re-anchored with its reason in the file: a lane's tool is
  its field and the question (`QUESTION_FIELD` itself; `editTool(field,
  {ask:false})` has none) in `edit-lanes`, `edit-path` (2), `site-behavior`
  and `site-marks`; the removal picker's in `take-off`; the designers' in
  `site-add` and `addon-row`; no `minItems` and the ask sentence in
  `site-add` and `edit-removal-door`; the step loop's answers line in
  `edit-parts`; the job record's `asked` in `edit-poll` (2 assertions).

**Red check by mutation** (`scripts/mutate.mjs`, each fix undone alone)
- Server: 37 mutants — the remainder's three cuts and its answers rule,
  `askedIn`, both answers hand-offs, the step ending's repeat, room, retry
  and resume, all twelve route transitions, the router's unkeepable check, `replaceAsk`'s condition, the
  four models' questions (lanes, removal picker, page writer, designers)
  and their returns, the reconciled add-on prompt and both helpers. 32
  killed on the first pass; the 5 survivors were gaps, each closed by a new
  case (a step's room check, a waiting question that cannot be read, the
  next question written beside the answered one, a lost replacement read as
  kept, the removal picker's question ignored), then killed.
- Page: 8 mutants; 7 killed, the survivor (a malformed `resume` accepted)
  closed by asserting the reply is unreadable, then killed.
- 4 comment-only controls survived every run. **45 of 45 killed.**

**Suite and container**
- Full suite `8933 / 8933 / 0 / 0` locally, on the tree committed as
  `2965e405`.
- The image: `main` (`f9979497`) `a4409e55d3f3eb09` (189 inputs) → the branch
  `7b863327f98367c9` (191 inputs, 161 distinct), predicted on both ends with
  the deploy's own `containerInputs` and `imageId`. Nothing was built.
- Screenshots (in our chat, and `docs/edits/live-clarify-{busy,repeat,
  unkept,room}.png`): rendered in a real Chromium from the app's own files
  with supplied answers. No new styling.

## 4. What this does not show, and the limits it leaves

N28–N47 in the audit's §3.0 and in `docs/backlog.md`. Changed by this round:
- **N31 is superseded**: there is no count; a question is kept whenever its
  answer can resume the request (N47 says how a request ends instead).
- **N33 is narrowed**: the look lanes, the removal picker, the one-page full
  writer and the add-on designers ask; N44 names what still does not.
- **N34 is extended**: overlapping scopes are cut, and the answers rule is
  N41.
- **N36 is fixed**: one conditional write; a failed write leaves the
  answered question waiting (tested).

New:
- **N41** (by design): beside a change that was made, a step's question
  resumes without the request's earlier answers, and records as asked only
  what its request still answers.
- **N42** (by design): a step's question our store refuses twice is not
  kept; what was left goes back to the box to be sent again.
- **N43** (cost): the question field rides every lane call, the removal
  picker and every designer call; the page rung's full writer has its own
  tool, so its prompt cache is separate from the build's.
- **N44** (by design): the add-on's page writer, the build's writers and the
  stylesheet correction round do not ask.
- **N45** (found, kept separate): a few fixed refusals end *"Say which one"*
  (`takeOffRefusal`'s unread case, lines in `builder/edit-failure.mjs`); an
  answer typed to one starts a fresh request.
- **N46** (untested model behaviour): whether the real lanes, removal
  picker, page writer and designers ask only when a detail matters.
- **N47** (by design): a question asked again ends the request
  (`question-ended` / `clarify-repeat`), and so does a request too long to
  carry an answer (`clarify-no-room`); the customer sends it again.

## 5. Decisions that are the owner's

- Your review of this round (and of the first round and batch 2's review
  fixes, all on the branch).
- N41's trade: beside a change that was made, an earlier answer is left out
  rather than risk the change being made again; the cost is that the
  remaining part may be asked a question the request had answered.
- Still open from the first round: whether the answer's routing call stays
  charged (N32), and whether the chat shows a reply's line breaks (N39).
- Then, on your word: one merge and deploy of everything on the branch, the
  free runtime check, and the grouped live batch.

## 6. CI

Read from the runs on the branch after the push of `2965e405`, each from its
own job log:
- **Unit tests** (run 37077217887): `8933 / 8929 / 0 / 4`, the local total;
  CI skips its usual four.
- **Site build** (run 37077217768): all 8 jobs green; the gate printed
  *"ALL CHECKS: 404 checks in 27 sections across 4 shards, every job green"*
  at inputs `d2ece143761bb753` (3,969 files).
