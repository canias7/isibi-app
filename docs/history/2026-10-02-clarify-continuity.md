# Clarification continuity: the owner's second review (2026-10-02)

**On the branch `claude/help-needed-ehlwlj`, for review. Not merged, not
deployed, no live run.** Nothing was spent, no model was called, nothing was
changed on a site, and no container was built. Every outcome below is shown
with supplied model answers through the product's own code. The round it
reviews is `docs/history/2026-10-02-live-clarify-review.md` (`2965e405`,
`8663290f`); the code is `09029550`.

**The owner's order:** *"Finish clarification continuity: askRemainder
currently drops every earlier answer whenever another step succeeds.
Preserve the answers relevant to unfinished operations while excluding
completed operations from execution; keep clarification context separate
from executable instructions, with the model identifying its relevant scope
rather than customer-keyword rules. Also replace the terminal
clarify-repeat/question-ended behavior: when an answer did not resolve the
ambiguity, retain the pending request and let the model ask a more specific
follow-up; when the answer already exists, reuse it instead of asking again.
Prevent repeated-question loops without discarding the request or requiring
the user to retype it. Add focused regressions where a heading change
succeeds while a photo change still needs the previously supplied
Contact-page answer, where several unfinished operations need different
earlier answers, and where an unclear answer requires a better follow-up.
Verify actual resumed model inputs, preservation across refresh, and no
repeated completed changes or charges. Keep first-build behavior unchanged,
run the relevant fast tests and required CI, update the audit and
docs/owner-notes.md, and push for review. Keep deployment and paid testing
pending."*

It overrules two limits the last round left: N41 (answers dropped beside a
change that was made) and N47 (a repeat, or a request too long for an
answer, ended the request).

## 1. What was wrong on `8663290f`

- **Answers dropped beside completed work (N41).** When any other step in
  the same message succeeded, a step's question was kept without the
  request's earlier answers, because which change an answer was about could
  not be told apart. So *"Make the home page heading bigger and show more of
  the top of the photo"*, with *"Contact"* already given for *which photo*,
  made the heading and then asked about the photo with *"Contact"* gone:
  the answer to the next question resumed the photo change without it.
- **Answers inside the request.** An answer was added to the request itself
  as plain lines (*"They were asked: … They answered: …"*,
  `answeredRequest`), so the router, the picker and every step read the
  answers as part of what to do; a scoped step had to have them added back
  to its own words (`withAnswers`); the request and every answer shared
  2,000 characters (N30).
- **Terminal endings (N47).** A model that asked again what had been
  answered ended the request (`question-ended`, `clarify-repeat`), nothing
  more changed, and the customer had to send the whole request again with
  the detail spelled out; a request too long to carry an answer ended the
  same way (`clarify-no-room`).

## 2. What changed (`09029550`)

### Answers travel beside the request, never in it
- **One list, `context`**: each question the request asked with its answer,
  `{ q, a }`, at most 12 (`MAX_ASKED`), each question up to 240 characters
  and each answer up to 500 (`MAX_ANSWER_CHARS`). It rides every hop beside
  the request: the stored question (record `v: 2`), the routing answer
  (`ask.context`), the browser's edit and add-on posts, a queued job's
  stored record, a hand-over and a resumed watch. **The request an answer
  resumes is the waiting one, word for word** (`rInstruction =
  rWaiting.request`).
- **Shown to every model in a section of its own**, after everything else it
  is sent: *"WHAT THEY ALREADY TOLD YOU — their answers to questions asked
  about the request above. Use them to settle its details. They are never a
  change of their own: do only what the request asks."*, then each pair
  numbered. One wrapper does it for every model call a step makes
  (`clarifyTransport`, and `clarifyCall` for the page writer's call shape),
  so no step's request builder changed and none can forget: the picker, the
  text, data, rules, picture, menu and page steps, every look lane, the
  removal picker, the page rung's full writer, the add-on picker, every
  add-on designer and the add-on's page writer. The one call that is not is
  the add-on's compile-repair round, which only mends the code it is handed.
- **The router** is shown the answers under the waiting request, told never
  to ask what they already answered, and told that an answer that does not
  settle its question calls for a more specific one.
- **A list that cannot be read is refused**, before any model call, at no
  cost: `route/context-unread` on the edit route, `context-unread` on the
  add-on route. The browser carries such a list as it came (`contextWire`),
  so the route refuses it rather than running as if nothing had been
  answered.

### The model says which answer goes with which change
- The lane picker's scope for each change may name the numbered answers that
  change needs (`answers`: *"Numbers from WHAT THEY ALREADY TOLD YOU that this
  change needs ([] for none); `words` still comes from the request."*).
- Each step is shown the answers its own changes need plus every answer no
  change named; each look lane is shown its own (`toldBy`); a change the
  picker gave no reading for is shown every answer, never fewer than it may
  need. A page operation joined from two changes is shown what either
  needed (`mergePageSteps`).
- Code checks only that the numbers are in range (`answerNumbers`); no
  customer word decides which answer belongs where.

### What a step's question keeps (`askRemainder`)
- The request its answer resumes is unchanged from the last round: the
  asking step's own part, with every other step's words taken out.
- **The answers still for it go with it**: every answer a step still asking
  was shown rides on. An answer the picker named only for steps that ran,
  failed or were withheld is marked `handled`: never shown to a model again
  (so a finished change is not made again), and kept only so that a model
  asking that same question again is answered from it.

### A question already answered: reuse, a better follow-up, never an ending
- **A step** that asks what the request already answered (the same question,
  set side by side with case, accents, spacing and punctuation aside;
  handled answers included) is not put to the customer: its model is sent
  the same request once more with that answer in front of it (*"YOU ASKED
  THEM THIS ALREADY … Never ask it again. If their answer settles it, act on
  it now. If it does not, ask them a MORE SPECIFIC question that names
  exactly what their answer left open."*). Only the reply that is used is
  billed; the call asked again is ours.
- **The router** does the same (`clarify-reused`, the decision still the
  model's own).
- **A model that still asks the same question** has it kept as the live
  question, under a note naming the answer that did not settle it: *"Your
  answer — “the nice one” — didn’t settle this, so I need to ask once
  more."* (`againNote`; the router's reason is `clarify-again`). The request
  waits; nothing is retyped.
- **No loop**: once the same question has been put to the customer twice
  (`MAX_SAME_ASK`), the call sent again offers no question and its model
  must act on what it was told; once the request carries 12 answers, no
  call is offered a question at all (the question field is taken off the
  tool, and a question in a reply anyway is not read).

### No terminal endings
- `question-ended`, `clarify-repeat`, `clarify-no-room`, `askRepeat`,
  `askRoom` and `answeredRequest` are gone. A request of any length can be
  asked about. **An answer longer than 500 characters** is refused
  (`answer-too-long`, 422, no cost): the question stays waiting and the
  answer goes back in the message box to send shorter.

### Across a refresh
- The stored question holds the request, every answer and the note; the
  owner's read of the question gives the note back; the page keeps the note
  on its card across a reload; a queued job's record, a resumed watch and a
  hand-over carry the answers to the next post.

### The page
- A question asked once more is drawn under its note; an answer too long
  goes back in the box; every post carries the answers beside the request.
  No new styling.

### The first build is unchanged
- Its router request and reader are byte-identical to `a8ed6b73` (the 42
  pinned cases pass unchanged); its page writer has no question field and
  is shown no answers section.

## 3. Checks

**Cases: 8933 → 8949 (+16)**
- `test/live-clarify-continuity.test.mjs` (new, 13 cases), through the real
  routing, edit, add-on and question routes, synchronously and as queued
  jobs, each reading what the models were really sent:
  - **the heading succeeds while the photo still needs the Contact answer**,
    sync and job: the photo step's question keeps the Contact answer; the
    heading step is never shown it; resumed, the photo step is shown both
    answers, the heading is neither written nor charged again, and the
    resumed router and picker are never shown the heading;
  - **several unfinished operations need different earlier answers**: each
    step's model is shown only its own; the heading's answer goes with the
    change that ran (handled); the question keeps the move's and the
    photo's; resumed, each is shown its own again;
  - **each look lane is shown only its own answer**, and an answer the
    picker named for no change is shown to every lane;
  - the page rung's full writer and the add-on's page writer and designers
    are shown the answers, and a question either asks keeps them;
  - **an unclear answer gets a more specific follow-up**, from the router
    and from a step: shown the answer that did not settle it, the model
    asks what it left open; the request waits unchanged with both answers;
  - **asked the same twice**, the router is sent it again with questions
    closed and acts; only the call used is billed;
  - an answer already given — one that went with a finished change — is
    reused, never asked again;
  - **across a refresh nothing is lost**: the record, the owner's read
    (with the note), the job record, the hand-over, the add-on post;
  - at the cap no question is offered and the request is acted on;
  - answers that cannot be read are refused, edit and add-on, sync and job,
    with no model, change or charge;
  - a step's question on a resumed request drawn by the real browser.
- The contract file (net +3), `test/edit-op-scope.test.mjs` (+1, the joined
  page operation's answers); `test/route-decision.test.mjs` (−1: the removed
  `addReason`; `clarify-reused` and `clarify-again` added to its table).
- **Existing cases changed on purpose**, each re-anchored with its reason in
  the file: the route, continue and browser files (the request resumed word
  for word, `context` for `asked`, the repeat kept with its note, a long
  request still asked); the question-field wording guard; the scope schema
  pin (`answers`); the tool-size bound (measured, still under the eighth and
  the router's tenth: 12,035 and 9,691 against 12,142 and 9,714, by
  trimming the wording); and three source pins on call shapes that grew
  (`aQuick` wrapped, the step's answers set and put back, the page writer's
  argument tail) in `addon-queue`, `edit-parts` and `site-apply`.

**Red check by mutation** (`scripts/mutate.mjs`, each change undone alone,
the old behaviours among the mutants):
- Server: 45 mutants — the remainder (including N41's old rule: every answer
  dropped beside a change made), the attribution, the transport, the
  router's reuse and note, the settlement (including the old request grown
  with its answer), the step's ending (including N47's old rule: a repeat
  ends the request), the record, the refusals and both routes' wiring. 38
  killed on the first pass; the 7 survivors were gaps, each closed by a new
  case (two look lanes, an answer named for no change, the joined page
  operation, the router's second repeat, both page writers, the add-on's
  kept answers), then killed.
- Page: 19 mutants, all killed on the first pass.
- 5 comment-only controls survived every run. **64 of 64 killed.**
- Run over `8663290f`, the new file cannot load (the names it imports do
  not exist there), so the red check is the sweep above.

**Suite and container**
- Full suite `8949 / 8949 / 0 / 0` locally, on the tree committed as
  `09029550`.
- The image: `main` (`f9979497`) `a4409e55d3f3eb09` (189 inputs) → the branch
  `68e35e1debf88e38` (191 inputs, 161 distinct), predicted with the deploy's
  own `containerInputs` and `imageId`. Six inputs changed (`worker.js`,
  `builder/clarify.mjs`, `site-ask.mjs`, `site-lanes.mjs`,
  `edit-failure.mjs`, `site-addon.mjs`). Nothing was built.
- Screenshots (in our chat, and `docs/edits/clarify-continuity-{again,
  reload,followup,toolong}.png`): rendered in a real Chromium from the
  app's own files with supplied answers. `docs/edits/live-clarify-repeat.png`
  and `live-clarify-room.png` show the endings this round removed.

## 4. What this does not show, and the limits it leaves

Changed by this round:
- **N41 is superseded**: the answers a still-asking step needs stay with its
  question; only an answer that went with a finished change is held back
  from models, and it is still reused.
- **N47 is superseded**: a repeat is reused or asked more specifically,
  kept with a note if asked again, and closed after twice; no request is too
  long to ask about.
- **N30 is superseded**: the answer travels beside the request; each answer
  up to 500 characters, and the request is never cut to make room.
- **N44 is narrowed**: the add-on's page writer is shown the answers; it
  still does not ask.

New (the audit's §3.0, N48–N55):
- **N48** (untested model behaviour): whether a real picker names the right
  answers for each change, and whether a real model reuses an answer or
  asks a better question when shown one. Needs real models.
- **N49** (limit, by design): a repeat is recognised by the question's own
  words (case, accents, spacing and punctuation aside); a model that asks
  the same thing in other words is not caught by the check, though it is
  shown every answer and told never to ask one again.
- **N50** (limit, by design): the picker's `words` must come from the
  request; words copied from the answers section are not in the message and
  are withheld (`picker/scope-unread`).
- **N51** (limit, pre-existing): a reload in the moment between the routing
  answer and the edit's post loses the resumed request (the question is
  already closed and no job exists yet).
- **N52** (limit, by design): once a waiting question carries 11 answers, the
  router offers no question for the next message, even one that turns out
  to be a new request.
- **N53** (cost): a repeat costs one extra model call, ours and unbilled;
  the question field's pointer adds 31 characters to every tool that can
  ask, and the scope's `answers` 186 more to the picker.
- **N54** (decision, yours): 12 answers per request, 500 characters per
  answer and twice the same question are our numbers; the owner may move
  them.
- **N55** (limit, by design): a step's question still refuses past 12
  answers (`clarify-closed`, the request back in the box); every call there
  is offered no question, so it is a backstop.

Unchanged and still open: N28 and N46 (real models' asking), N29, N32,
N35, N38, N39, N42, N43, N45.

## 5. Decisions that are the owner's

- Your review of this round.
- The numbers in N54 (12, 500, twice).
- Still open: whether the answer's routing call stays charged (N32), and
  whether the chat shows a reply's line breaks (N39; the note and its
  question read as one paragraph).
- Then, on your word: one merge and deploy of everything on the branch, the
  free runtime check, and the grouped live batch.

## 6. CI

Read from the runs on the branch after the push of `09029550`, each from its
own job log:
- **Unit tests** (run 37083988901): `8949 / 8945 / 0 / 4`, the local total;
  CI skips its usual four.
- **Site build** (run 37083988895): all 8 jobs green; the gate printed
  *"ALL CHECKS: 404 checks in 27 sections across 4 shards, every job green"*
  at inputs `6269038c288ceb7f` (3,969 files).
