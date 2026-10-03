# Question limits: the owner's third review (2026-10-03)

**On the branch `claude/help-needed-ehlwlj`, for review. Not merged, not
deployed, no live run.** Nothing was spent, no model was called, nothing was
changed on a site, and no container was built. Every outcome below is shown
with supplied model answers through the product's own code. The round it
reviews is `docs/history/2026-10-02-clarify-continuity.md` (`09029550`,
`5430b254`); the code is `a38adac3`.

**The owner's order:** *"Fix the clarification limit behavior before
deployment. clarifyTransport currently strips question fields at the limit
and dropQuestion removes an unresolved question while retaining proposed
edits. Never treat a question limit or repeated question as permission to
act. If a model still needs clarification, preserve the pending request,
relevant answers, unfinished operations, and attachments; suppress changes
accompanying that unresolved question. Stop automatic retry loops while
keeping a user-driven way to clarify or cancel, without requiring the
original request to be retyped. Apply the same rule to the router and
downstream edit/add-on calls. Add regressions for both the repeated-question
threshold and total-answer limit, including responses containing a question
plus proposed changes; assert no uncertain mutation, publication, or
execution charge, and verify that a later clear answer resumes only
unfinished work. Keep the corrected answer-retention behavior and
first-build behavior unchanged. Run focused tests and required CI, update
docs/owner-notes.md and the audit, then push for review. Keep deployment and
paid testing pending."*

It overrules two limits the last round left: N52 (the router closed
questions once a waiting request carried 11 answers) and N55 (a step's
question past 12 answers was not kept), and the forced action behind both.

## 1. What was wrong on `09029550`

Two numbers bounded a request's questions — the same question put to the
customer twice (`MAX_SAME_ASK`), and 12 answers on one request
(`MAX_ASKED`) — and at either one, the model was made to act on a guess:

- **A step's model, at the repeated-question threshold**, was sent the
  request again with the question field taken off its tool
  (`stripQuestion`), and any question in its reply was taken out
  (`dropQuestion`) while everything else in the reply was kept. A model
  that asked a third time *and* proposed a change beside its question had
  the change made, published and charged.
- **Past 12 answers**, no call was offered a question at all, and a question
  in a reply was taken out the same way.
- **The router, at the threshold**, was sent the request again under
  *"Questions are closed for this message"*, so it had to choose work; and
  once a waiting request carried 11 answers, the next message's router was
  told the same.
- **A step's question at 12 answers** was not kept (`clarify-closed`): its
  part was left alone and its words put back in the message box — the
  answers already given were lost with it, and the request had to be sent
  again. `packAsk` refused a record carrying 12 answers, and the routing
  route's settlement would have refused a 13th answer as too long.

Measured on `09029550` (a throwaway worktree, the new route cases run over
the old code): 9 of the 11 new cases fail, each for that reason — the
photo's new focus made beside the unresolved question, the router sent
again with questions closed, the addition applied beside the designer's
question, the step at the limit not offered its question. The other two
hold on both versions (the limits' own pin, and the router's one re-send
below both limits, which keeps its question).

## 2. What changed (`a38adac3`)

### Every call is offered its question, and a reply that asks comes back with it
- `clarifyTransport` no longer strips or drops anything: `stripQuestion` and
  `dropQuestion` are gone. Every model call a step makes is sent with its
  tools as the step built them, question field included, however many
  answers the request carries.
- Below both limits, a model that asks what was already answered is still
  sent its answer back once (unchanged from the last round). **At the
  repeated-question threshold, or once the request carries 12 answers, it
  is not sent again**: its reply is returned exactly as it came, question
  and all.
- Every step reads its model's question before anything else in the reply
  and does nothing proposed beside it — the text, data, rules, picture and
  menu steps, the quick and full page writers, the look lanes, the removal
  picker, the look picker, the add-on picker and every add-on designer
  (each confirmed in its own code; unchanged). So a question plus proposed
  changes asks the question and changes nothing.

### The router holds the same way
- `canAsk` no longer counts answers: a live site's router is offered its
  question however many the waiting request carries.
- A question the router already has an answer to, at the threshold or past
  the limit, is **held under a note and never sent again**
  (`clarify-again`, with no `clarify-reused` before it). Work it proposed
  beside the question (a layer, a page) is named and set aside
  (`edit-fields-ignored`). Below both limits, the one re-send with the
  answer is unchanged, and it still offers the question.

### What a held question keeps
- The request — word for word, or only the unfinished part when other parts
  of the message were made — every answer that part needs, the parts put
  off earlier, whether files came with it, the round and the note. A step's
  question at 12 answers is kept like any other: `clarify-closed` is gone
  from `askReport`, and `packAsk` accepts a full list.

### The total-answer limit is a window, never an ending
- `appendAnswer` adds an answer to a request already carrying 12 by letting
  go of the one it needs least: the oldest `handled` answer first (about a
  part no longer held, never shown to a model again), then the earlier
  answer to a question answered again since, then the oldest. The router's
  repeat check and the routing route's settlement both read the list
  through it, so they see the same answers. An answer over 500 characters is
  still refused, with the question kept.

### The note at the threshold
- Below the threshold, unchanged: *"Your answer — “the nice one” — didn’t
  settle this, so I need to ask once more."*
- At it: *"I’ve asked this before, and your answers — “the nice one”, then
  “the nicer one” — haven’t settled it. Answer once more, or cancel this
  request and nothing more will be done for it."* It names the last two
  answers, cut to fit 300 characters, offers both ways on, and never claims
  nothing changed (beside a step's question, other parts of the message may
  have been made).

### The ways on are the customer's
- Answer — typed, or one of the numbered answers — or **Cancel this
  request** (Esc), which is free and names what the request had put off.
  Nothing is retyped: an answer resumes the waiting request. Nothing is
  re-sent to a model on our own at the threshold or past the limit.

### Unchanged
- The first build: its router and page writer pinned byte for byte (the 42
  pinned cases pass unchanged).
- The answers' retention from the last round (what each unfinished part
  keeps, `handled`, the reuse below the limits), the 500-character answer,
  and the failures where no question can be kept.

## 3. Checks

**Cases: 8949 → 8960 (+11)**
- `test/live-clarify-limits.test.mjs` (new, 11 cases), every model asking
  *and* proposing a change, through the real routing, edit, add-on and
  question routes, synchronously and as queued jobs:
  - **the threshold at an edit step**, sync and job: the photo step,
    answered twice, asks again beside a new focus. It is called once and
    offered its question; the focus is neither stored, published nor
    charged while the heading beside it is; the question keeps the photo's
    part, every answer and the threshold note. The customer's next answer
    meets the router asking it again beside a proposed layer: held, never
    sent again, the layer set aside, only the routing call billed. The
    clear answer resumes the photo alone, shown every answer; the heading
    is neither written nor charged again;
  - **the threshold at the router**: held under the note with the request
    word for word, both answers, the put-off part and its files; a reload
    gives the card back; a clear answer resumes without retyping; Cancel
    closes it free, once, naming the put-off part;
  - **the threshold at the add-on**: the job's designer asks again beside a
    schedule after the function's designer finished — nothing applied,
    registered or charged, the designer never sent again; the clear answer
    applies the whole addition once; and the add-on picker likewise;
  - **the total-answer limit at the router**: the twelfth answer is still
    met with a question; the thirteenth lets go of the handled answer, and
    a question already answered is held, never sent again; a clear answer
    lets go of the earlier answer to the question answered again and
    resumes the request word for word;
  - **the total-answer limit at an edit step**, sync and job: carrying 12
    answers, the move's writer is offered its question and asks one it has
    an answer to, beside the moved page — never sent again; the move is
    neither made, published nor charged while the heading is; the
    thirteenth answer takes the finished heading's place and resumes the
    move alone;
  - **the total-answer limit at the add-on**: the designer is offered its
    question, nothing is applied, and the question keeps all 12 answers;
  - **below both, the router's one re-send still offers its question**, at
    one answer and at eleven — a property both versions keep, added because
    the sweep showed nothing guarded it (below).
- The contract file (+3, −1): the transport at the threshold and past the
  limit (offered, returned as it came, never sent again; below them, one
  re-send that still offers the question), `appendAnswer`'s three tiers and
  its refusals, the threshold note, a full list keeping its question, and
  the router offered a question at 11 and 12 answers. The old case pinning
  the strip and the drop is removed.
- The continuity file (−2): the router acting after the same question twice,
  and a request at the cap acting on a guess — the behaviours this round
  removes; a pointer to the new file is left in their place.

**Red check**: the new file over `09029550`'s code (a throwaway worktree
at `5430b254`, which adds only records; `appendAnswer`, which does not exist
there, stubbed as a plain append): **9 of its 11 cases fail**, each for the
forced-guess reason — the photo's focus stored (`changed: ["contact.tsx"]`),
the router sent again at the threshold, the addition applied beside the
designer's question (`ok: true`), the add-on picker's question dropped and
designing begun, the router at its twelfth answer told questions are
closed, the move's writer not offered its question at the limit. The two
that pass are the limits' own pin and the router's re-send below both
limits, which both versions keep.

**Mutation sweep** (`scripts/mutate.mjs`, each change undone alone, the old
behaviours among the mutants), over `clarify.mjs`, `site-ask.mjs` and
`worker.js`, against the six clarify files: **25 mutants** — the transport
re-sending at either limit or one too late, the old strip and the old drop,
`packAsk` refusing a full list, each of `appendAnswer`'s tiers and its
refusals, the note's threshold variant, the router's old `canAsk` count, the
router re-sending at either limit, its held question losing its note, its
repeat check reading an uncompacted list, the settlement refusing a
thirteenth answer, `askReport`'s old `clarify-closed` and a repeat's
missing note. 24 killed on the first pass; the one survivor (the router's
re-send below both limits closing questions) was a gap, closed by the new
case above, then killed. **25 of 25 killed**; 2 comment-only controls
survived every run.

**Suite and container**
- Full suite `8960 / 8960 / 0 / 0` locally, on the tree committed as
  `a38adac3`.
- The image: `main` (`f9979497`) `a4409e55d3f3eb09` (189 inputs) → the branch
  `11d56d2824119c12` (191 inputs, 161 distinct; the last round's branch was
  `68e35e1debf88e38`), predicted with the deploy's own `containerInputs` and
  `imageId`. Three inputs changed this round (`worker.js`,
  `builder/clarify.mjs`, `builder/site-ask.mjs`). Nothing was built.
- Screenshots (in our chat, and `docs/edits/clarify-limits-threshold.png`,
  `clarify-limits-cancelled.png`): the third asking under the threshold
  note, with its numbered answers and Cancel; and Cancel's free close.
  Rendered in a real Chromium from the app's own files with supplied
  answers; the note's words are `againNote`'s own.

## 4. What this does not show, and the limits it leaves

Changed by this round:
- **N52 is superseded**: the router is offered its question however many
  answers the waiting request carries.
- **N55 is superseded**: a step's question at 12 answers is kept with
  everything its request needs; every call is offered its question.
- **N53 is narrowed**: a repeat below both limits still costs one extra
  model call, ours and unbilled; at the threshold or past the limit it
  costs none.
- **N54 is restated**: 12 is now the total-answer limit — how many answers a
  request keeps, and past which nothing is sent again on our own — and
  twice is the repeated-question threshold; 500 characters per answer is
  unchanged. Still our numbers, yours to move.

New (the audit's §3.0):
- **N56** (limit, by design): past 12 answers, a new answer takes the place
  of the one the request needs least; when none is handled and no question
  was answered twice, that is the oldest, which an unfinished part may still
  need. A model that needs it asks again, and the customer answers or
  cancels; nothing is done without it.
- **N57** (behaviour, by design): nothing ends a question but the customer —
  an answer that settles it, a new request, or Cancel — or its expiry after
  a day (`ASK_TTL_MS`, unchanged). A model that keeps asking keeps the
  request waiting; there is no point at which a guess is made instead.
- **N58** (untested model behaviour): whether a real model, shown answers
  that did not settle its question, asks a better one rather than the same
  one, and whether a real router and real steps leave proposed changes out
  when they ask. Needs real models.

Unchanged and still open: N28, N46 and N48 (real models' asking), N29, N32,
N35, N38, N39, N42, N43, N45, N49, N50, N51.

## 5. Decisions that are the owner's

- Your review of this round.
- The numbers in N54 (12, 500, twice) and the threshold note's words.
- Still open: whether the answer's routing call stays charged (N32), and
  whether the chat shows a reply's line breaks (N39; the note and its
  question read as one paragraph).
- Then, on your word: one merge and deploy of everything on the branch, the
  free runtime check, and the grouped live batch.

## 6. CI

Read from the runs on the branch after the push of `a38adac3`, each from its
own job log:
- **Unit tests** (run 37087266116): `8960 / 8956 / 0 / 4`, the local total;
  CI skips its usual four.
- **Site build** (run 37087266079): all 8 jobs green; the gate printed
  *"ALL CHECKS: 404 checks in 27 sections across 4 shards, every job green"*
  at inputs `d731baeb9c58196e` (3,969 files).
