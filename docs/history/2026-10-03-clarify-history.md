# The answer history: the owner's fourth review (2026-10-03)

**On the branch `claude/help-needed-ehlwlj`, for review. Not merged, not
deployed, no live run.** Nothing was spent, no model was called, nothing was
changed on a site, and no container was built. Every outcome below is shown
with supplied model answers through the product's own code. The round it
reviews is `docs/history/2026-10-03-clarify-limits.md` (`a38adac3`,
`9b3f00be`); the code is `5cbd5239`.

**The owner's order:** *"Fix only the remaining answer-retention issue:
appendAnswer must not discard an answer needed by unfinished work merely
because 12 answers already exist. Separate the stored clarification history
from any bounded model-input window; preserve relevant answers durably and
retrieve them for the operations that need them. Do not infer irrelevance
from age or assume a later answer to the same question replaces all earlier
details. Add a regression with 13 distinct answers where the oldest
Contact-photo answer remains necessary, then verify refresh and resume
preserve it without repeating completed work or asking the user to supply it
again. Keep the corrected question-limit behavior, run focused tests and
required CI, update the handoff and audit, and push. Keep deployment and paid
testing pending; avoid unrelated changes."*

It overrules N56, the limit the third review left: past 12 answers a new
answer took the place of the one the request "needed least" — at worst the
oldest.

## 1. What was wrong on `a38adac3`

One number did two jobs. `MAX_ASKED` (12) was the total-answer limit — past
it nothing is sent to a model again on our own — and it was also the size of
the request's whole history:

- **`appendAnswer` kept at most 12.** The thirteenth answer made room by
  letting go of one: a `handled` answer first, else the earlier answer to a
  question answered again since, else the oldest. With thirteen distinct
  answers and none handled, the oldest went, whether or not an unfinished
  part still needed it. The second tier assumed a later answer to the same
  question replaces every detail of the earlier one.
- **Every reader stopped at 12 too**: `readContext` (the stored question,
  the routing answer, the edit and add-on posts, a queued job) and the
  browser's `contextOf` (`CONTEXT_MAX`). A list of 13 could not be read and
  was refused as `context-unread`, so no hop could have carried a longer
  history even if one had been kept.

**Reproduced on `9b3f00be`** (the records on `a38adac3`) with the new
regression (§3): a heading and a photo change in one message; the heading
is made; the photo step still needs the very first answer — that the photo
is the one on the Contact page — while the answers grow to thirteen. Both
modes fail at the thirteenth answer: *"the stored question let an answer go
at thirteen — the oldest, the Contact photo, was pushed out"*. With that
assertion taken out (a scratch copy), the resumed photo step is no longer
shown which photo is meant and asks the customer *"Which photo do you mean —
one on Home or the one on Contact?"* again (`error: "clarify"`), sync and
queued.

## 2. What changed (`5cbd5239`)

### The history is a history; the limit only stops our re-asking
- **`MAX_HISTORY = 64`** (`builder/site-ask.mjs`, re-exported by
  `builder/clarify.mjs`): how many answers one request's history holds — a
  size bound on what is stored and carried, never a window. `readContext`
  reads up to 64 on every hop; the browser carries up to 64 (`CONTEXT_MAX`
  in `public/edit-poll.js`, the same number as its bound on a request's
  question count, `ASKED_MAX`).
- **`MAX_ASKED` (12) bounds no storage.** It is only the total-answer limit:
  past it nothing is sent to a model again on our own — the third review's
  behaviour, unchanged (`clarifyTransport`, the router's re-ask).
- **`appendAnswer` lets go of nothing still needed.** The new answer joins
  the end and every answer before it stays — however old, and whether or
  not its question was answered again since: each answer can carry a detail
  of its own. The age tier and the "answered again" tier are gone.
- **Only at the history's own bound is room made**, and only by the first
  `handled` answer: one the picker named only for work that ran, failed or
  was withheld, never shown to a model again, kept only to answer the same
  question if it comes back. When all 64 are still needed, none is let go:
  `appendAnswer` returns `null`.

### A full history refuses; it never forgets
- **The routing route's settlement** tells the two refusals apart: an
  answer too long to keep is refused as before (`answer-too-long`); an
  answer a full history cannot take is refused as **`answers-full`** — 422,
  cost 0, the question still waiting, the stored record untouched —
  saying: *"Your request already has as many answers beside it as I can
  keep, and every one is still needed, so I can't take another without
  forgetting one you gave. Nothing was changed or charged. Your request is
  still waiting — press Cancel on the question and send what's left of it as
  a new message."*
- **The browser** treats it like the too-long answer: the question card
  stays, with its Cancel; the route's sentence is said; what they typed
  comes back to the box (`public/chat.js`).

### What a model is shown is retrieved, never windowed
Unchanged in code, now driven past 12 answers: the picker and the router are
shown every answer still needed; each step is shown the answers the picker
named for its change and those it named for none (`eCtxOf`); the add-on's
designers every answer still needed; a handled answer is never shown. The
repeat check (the router's and each step's question note) reads the whole
history, so an old answer still counts as theirs.

### Unchanged
- The question limits of the third review: at the repeated-question
  threshold (twice) and past the total-answer limit (12) nothing is re-sent
  on our own; the question goes to the customer under its note, and nothing
  beside an unresolved question is made, published or charged.
- The first build; the 500-character answer; what the picker names for each
  change (`answers`) and `askRemainder`'s `handled` marking.

## 3. How it was checked

**Cases `8960` → `8972`.**
- **`test/live-clarify-history.test.mjs`** (11, new, through the real
  routes; sync and queued where a job can run):
  - **Thirteen distinct answers and the oldest still needed** (the owner's
    regression): the heading is made (its writer shown none of the photo's
    answers) and the photo step asks a twelfth question; the router asks a
    thirteenth and a fourteenth, each time shown the Contact answer; the
    stored question holds all thirteen distinct answers, the Contact one
    first, and so does the record a reload reads (no model called); the
    clear answer resumes the photo alone; the browser's post, its job record
    across a reload and its hand-over carry all fourteen; the picker is
    shown all fourteen; the photo step is shown every answer still needed,
    the Contact one first, and acts on it — nobody is asked which photo
    again; the heading is neither written nor charged again; the only
    question write afterwards is its close.
  - **Retrieved for the change that needs it**: thirteen answers posted,
    two about the heading and eleven about the photo, the oldest among
    them; the heading's writer is shown exactly its two, the photo step
    exactly its eleven, oldest first; both changes made.
  - **The oldest still counts**, at the router and at a step (sync, queued):
    past the limit, a model asking the Contact question again is never sent
    again, and its question is kept under a note naming the Contact answer
    — never put as new; the step's proposed change is not made or charged;
    every answer is kept.
  - **The picker's own question** past the limit (sync, queued) keeps the
    whole request with all thirteen answers; nothing runs or is charged.
  - **A full history**: 64 needed answers → `answers-full`, 422, cost 0,
    nothing charged, the record byte-identical and still pending; an answer
    over 500 characters there is still `answer-too-long`; with one handled
    answer among the 64, it alone makes room and the request resumes word
    for word.
  - **The add-on past the limit**: thirteen answers reach the designers,
    the oldest first, and the addition is made once; a designer that asks
    keeps all thirteen with its question, nothing applied or registered.
- **The contract file**: a stored question keeps 13 and 64 answers;
  `readContext` and the browser read 13 and 64 whole and refuse 65; a
  hand-over carries them. `appendAnswer`'s case is rewritten: thirteen
  distinct answers all kept; every answer to a question answered again
  kept; a handled answer kept below the bound; at the bound the first
  handled answer alone makes room; all 64 needed → `null`, the list given
  untouched; 64 answers to seven questions each keeping every earlier one;
  the refusals.
- **The limits file**: the router's thirteenth answer joins all twelve, the
  handled one included, and the clear answer keeps both answers to the
  question asked again (fourteen); the edit step's thirteenth keeps the
  finished heading's answer, handled and never shown; the limits' pin adds
  `MAX_HISTORY ≥ 14`.
- **The continuity file**: the unreadable list is now 65 answers.
- **The browser file** (+1): `answers-full` keeps the card and gives the
  typed answer back.

**Red check**: the new and changed cases over `9b3f00be`'s code (a throwaway
worktree; the old code given its own bound as a name, `MAX_HISTORY =
MAX_ASKED`, so the files load): **20 of 91 fail**, each for the old window —
the oldest pushed out at the thirteenth answer (both modes); a request
carrying thirteen answers refused as `context-unread` at the edit route (six
cases) and the add-on route; the router not recognising the oldest answer
when asked it again; a full history of twelve taking another answer by
letting the oldest go; the thirteenth answer at the router and at an edit
step letting an earlier one go; `readContext` and the browser not reading
thirteen; a stored question refusing thirteen; `appendAnswer`'s own case;
the limits' pin (`MAX_HISTORY ≥ 14`); and the browser answering an
`answers-full` refusal with its generic *"I couldn’t work out what to do
with that just now"* instead of the route's sentence. The other 71 pass on
both.

**Mutation sweep** (`scripts/mutate.mjs`, each change undone alone, over
`site-ask.mjs`, `worker.js`, `public/chat.js` and `public/edit-poll.js`,
against the eight clarify files): **19 mutants** — the old tiers at twelve,
a later answer replacing the earlier, the oldest needed answer let go at
the bound, no room made by a handled answer, room made at the question
limit, room made by the last handled answer, `readContext` and the browser
bounded at twelve, the history set back to twelve, the router's repeat check
over the latest twelve, the browser not handling or clearing the card on
`answers-full`, the settlement calling a full history too long or keeping
the answer by forgetting the oldest, a step's question note over the latest
twelve, steps shown the latest twelve, the edit picker's and the add-on
designer's questions keeping the latest twelve, the designers shown the
latest twelve. 17 killed on the first pass; the two survivors (a question
asked by the edit picker, and one asked by an add-on designer, keeping only
the latest twelve) were gaps, closed by the picker's case and the
designer's half of the add-on case above, then killed. **19 of 19 killed**;
3 comment-only controls survived every run.

**Suite and container**
- Full suite `8972 / 8972 / 0 / 0` locally, on the tree committed as
  `5cbd5239`. The records commit on top of it changes no code and one
  comment: the new test file's header, which now names every case it holds
  (its 11 cases pass unchanged).
- The image: `main` (`f9979497`) `a4409e55d3f3eb09` (189 inputs) → the
  branch `8bfc67dc695e65cc` (191 inputs, 161 distinct; the last round's
  branch was `11d56d2824119c12`), predicted with the deploy's own
  `containerInputs` and `imageId`. Three inputs changed this round
  (`worker.js`, `builder/clarify.mjs`, `builder/site-ask.mjs`); the browser
  files are not container inputs. Nothing was built.
- Screenshot (in our chat, and `docs/edits/clarify-history-full.png`): the
  `answers-full` refusal under the waiting question, its Cancel still on
  the card and the typed answer back in the box. Rendered in a real
  Chromium from the app's own files with supplied answers; the sentence is
  read from `worker.js`.

## 4. What this does not show, and the limits it leaves

Changed by this round:
- **N56 is superseded**: no answer is let go for its age or because its
  question was answered again; past 12 answers every answer stays.
- **N54 is restated**: 12 is the total-answer limit, past which nothing is
  sent to a model again on our own, and bounds no storage; 64 answers is the
  history's size bound; twice is the repeated-question threshold; 500
  characters per answer is unchanged. Still our numbers, yours to move.

New (the audit's §3.0):
- **N59** (limit, by design): a request's history holds 64 answers. At 64
  only a `handled` answer can make room; when all 64 are still needed, a
  further answer is refused at no cost with the question still waiting
  (`answers-full`), and going on means Cancel and sending what is left as a
  new message. Reaching it takes 52 rounds past the point where our own
  re-asking stops, every one of them the customer's.
- **N60** (cost): a long history makes every call shown it longer. At their
  longest, 64 answers are about 47,000 characters in the picker's and the
  router's input (each answer up to 500, each question up to 240); real
  answers are short.

Unchanged and still open: N57, N58, and N28, N29, N32, N35, N38, N39, N42,
N43, N45, N46, N48, N49, N50, N51. N58 (whether real models ask better
questions) now also covers whether a real picker names an old answer for the
change that needs it.

## 5. Decisions that are the owner's

- Your review of this round.
- The numbers in N54 and N59 (12, 64, 500, twice) and the `answers-full`
  sentence.
- Still open: whether the answer's routing call stays charged (N32), and
  whether the chat shows a reply's line breaks (N39).
- Then, on your word: one merge and deploy of everything on the branch, the
  free runtime check, and the grouped live batch.

## 6. CI

Read from the runs on the branch after the push of `5cbd5239`, each from
its own job log:
- **Unit tests** (run 37090241036): `8972 / 8968 / 0 / 4`, the local total;
  CI skips its usual four.
- **Site build** (run 37090241073): all 8 jobs green; the gate printed
  *"ALL CHECKS: 404 checks in 27 sections across 4 shards, every job green"*
  for commit `5cbd5239` at inputs `71ce2ead86af780b` (3,969 files).
- The records commit on top (`94e79672`) ran unit tests again (run
  37090418289): `8972 / 8968 / 0 / 4`.
