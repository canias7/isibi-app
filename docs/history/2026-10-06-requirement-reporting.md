# Every requirement a customer is told about reaches the reply model, one fact each (2026-10-06, on the branch)

The owner, after the incomplete-judgment fix passed Codex's review
(`2026-10-06-incomplete-judgment.md`):
*"The incomplete-judgment fix passes Codex review; keep it and the earlier
corrections. Now separately close the documented requirement-reporting
truncation gap without reopening the wider audit. Codex reproduced four
distinct requested requirements with missing outcomes: requirementNote
includes only the first three, and addonReplyFacts passes only those three to
the reply model, losing the fourth even when the requirements array contains
it. Fix this universally across the affected outcome categories: every
distinct requested outcome must reach the reply model and its existing
completeness checks, with accurate states and legitimate deduplication
preserved. Prefer complete structured outcome facts and let the model write
the customer's response naturally; don't solve this with more hardcoded
customer messages, site-specific rules, a larger arbitrary cutoff, or "and
more" hiding which work remains. Add focused tests above the current
two/three-item cutoffs, including mixed outcomes, and verify that the full
reporting path preserves them. Keep the documented refusal-path limitation
visible as a separate item. Push the correction, run relevant tests and
required CI, and update owner-notes with the exact commit, results and
remaining gaps. Keep everything unmerged; no deployment, container image
build or paid retest yet."*

**The fix is on the branch only** (`95f5a9d0`): not merged, not deployed, no
image built, nothing pressed or spent. It is shown with supplied model
answers through the real routes, not live.

## 1. The reproduction

Codex's case reproduced exactly before anything changed, at the module and
for free. There were four requirements, each judged and each left undone (no
model call):

- `requirementNote` said *"Still to do: Each signup gets a confirmation email;
  The owner gets a text for each signup; Signups are sent to the mailing
  list."*, which is three of the four;
- `addonReplyFacts` gave the reply model that note as **one** `not-done` fact,
  so the fourth ("Each signup gets a calendar invite") was in no fact. And
  the reply writer's completeness check, which requires every fact's id in
  the model's `covers`, could only ask whether that one sentence was covered.

Reading the whole path found the same cut in every sentence of the note:

| sentence | named | the rest |
|---|---|---|
| "One thing your site can't do yet: …" | 3 | "And N more like it." |
| "Still to do: …" | 3 | silent |
| "And this one is waiting on another part … that didn't work: …" | 2 | silent |
| "I've set that up, but I can't confirm from here that …" | 2 | silent |
| "Scheduled as you asked: …" | 2 | silent |
| "I can't see from here whether …" | 2 | silent |

It reached the customer two ways:

- **through the reply model**: the note was one fact, and always a `not-done`
  one, even for "I've set that up, but I can't confirm…";
- **through the browser's own composition**, shown when there is no model
  reply: it prints the note verbatim (`addonReplyText`).

The answer's `requirements` field held every open entry, but it carries raw
entries with no outcome, and nothing that tells the customer reads it.

## 2. What it does now

- **One report, whole.** `requirementReport` (`builder/site-requirements.mjs`)
  makes the selection the note always made, unchanged, and returns every
  requirement the customer hears about as `{ need, told, state, why? }`:
  - `told` is the sentence it belongs to: `unsupported`, `still-to-do`,
    `blocked`, `set-up`, `scheduled` or `unseen`;
  - `state` is what `requirementOutcomes` found;
  - `why` is kept where its sentence gives a reason (`unsupported`,
    `blocked`).

  No cut, no count.
- **The route sends it** (`requirementsTold`), beside the note's other
  sentences (`coverOther`: the property counts, the missing pages, the
  dropped fields and QR codes, the seed skips, the tables nothing can fill).
- **Each requirement is its own fact** (`addonReplyFacts`, `coverFacts`), so
  the reply writer's existing completeness check holds the model to every
  one: one left out is asked for again by name, and left out twice the reply
  is not used. The note is never also a fact beside them.
- **The kind is the state's.**

  | told | fact kind |
  |---|---|
  | site can't do it yet, not done, waiting on a part that failed | `not-done` |
  | set up and unchecked, scheduled and not yet seen running | `note` (done, with something worth knowing) |
  | nobody could see whether it is there | `not-done` |

  The last row follows the owner's rule of 2026-09-15: *"'I've set that up'
  is inappropriate when implementation is unknown."* It is never called done.
  The fact's text says exactly what is known.
- **The facts are statements for the model, which writes the reply.** For
  example: *"Not done: Each signup gets a calendar invite."* or *"Set up, but
  nothing here can check that it works: Each signup is kept so the owner can
  read them."* No new sentence reaches the customer from them.
- **The note the browser prints** is written from the same report. It is the
  same sentences as before, with every need named and "And N more like it."
  gone. When nothing was cut, its words are identical.
- **Deduplication.** The note's rule is kept: a hand-off an answer speaks for,
  an answer a finding overrules, or an answer a request speaks for is not
  said twice. One exact rule is added: the same need in the same sentence,
  whatever its case or spacing, is said once. One need told two different
  ways is two outcomes.
- **An answer stored before this change** has no list, so its whole note is
  one fact, as before. The same goes for a list that does not read (an entry
  told some unknown way, a need that is not words, an empty list): it is not
  trusted to be whole, and the note is used instead. The note is now complete
  either way.
- **What the placeholder line says while a reply is written**
  (`replyOutcomeOf`). An addition whose only caveats are "set up and
  unchecked" or "scheduled" now reads "Done — writing up what changed…",
  because that work was set up; before, the whole note counted as not done.
  Anything not done or unseen still reads "Partly done".

No change under `public/`: the browser prints the server's sentence as
before. It is now whole.

## 3. What changed

- `builder/site-requirements.mjs`: `requirementReport` and `TOLD`;
  `toldNote` (the requirements' sentences, uncut); `propertyNote` (the
  property counts, unchanged); and `requirementNote`, now composed from those
  three.
- `builder/site-reply.mjs`: `TOLD_FACTS` and `coverFacts`. `addonReplyFacts`
  takes the requirements one fact each, and `coverOther` as one fact.
- `worker.js`: the add-on route makes the report once (`aRep`), and sends
  `coverNote` (written from it, whole), `requirementsTold` and `coverOther`.
- Tests:
  - `test/requirement-told.test.mjs`, new, 12 cases;
  - re-anchored: seven judgment cases (`addon-judgment`, onto one fact per
    requirement), JUDGE 14 (the report is the route's reader), and two hop
    guards in `requirement-coverage` (the report's call, the note's
    composition).

## 4. Verification

- **The tests** (`test/requirement-told.test.mjs`, 12 cases), above every old
  cut, the outcomes mixed:
  - **TOLD 1, the report**: 20 requirements of all six kinds, out of order,
    come back in the note's order with their states, and a reason only where
    the sentence gives one. Four can't-do-yet, four still-to-do (one of them a
    covered claim whose step failed), three waiting on a failed part, three
    set up (one `configured`), three scheduled, three unseen;
  - **TOLD 2, the note**: every need in its own sentence, each said once, no
    count. The words are identical when nothing was cut, and the property
    counts come after;
  - **TOLD 3, deduplication**:
    - one need twice in one sentence, whatever its case or spacing, is said
      once;
    - one need told two ways is two facts of two kinds;
    - run 50's reconciled hand-off is said once, whether the two entries word
      the need the same or differently (the second is the case only the
      existing `spoken` rule settles);
  - **TOLD 4, the facts**: one per requirement, in order, each of its state's
    kind, with the exact texts. The note's other sentences are one fact. The
    note is never a fact beside them. The placeholder outcome is "partly",
    "done" for set-up and scheduled only, and "partly" for unseen only. An
    answer stored before the list keeps the whole note as one fact, and so do
    four kinds of list that do not read, and an empty one;
  - **TOLD 5, the reply writer's own check**: every requirement is in the
    model's request by its id; one left out is asked for again by name; left
    out twice, the reply is not used (`uncovered`);
  - **TOLD 6–9, the real add-on route**, each above its old cut:
    - Codex's four undone requirements;
    - mixed: four can't-do-yet, four still-to-do, two set up and three
      unseen, across two designers;
    - three waiting on a function the database refused;
    - three scheduled jobs.

    The note, the browser's composed screen, the facts and the list each
    have every one;
  - **TOLD 10, the whole path in a request**: an edit and an addition. The
    addition's four undone requirements are in the answer its job stored,
    and the background reply writer is given each as its own fact. The reply
    it kept explains every one;
  - **TOLD 11** pins the refusal item as it stands (§5);
  - **TOLD 12**: a page the writer did not produce, beside four undone
    requirements. Its sentence is one fact beside theirs, and the note has
    both.
- **Re-anchored**:
  - seven judgment cases (JUDGE 7, 9, 10, 18, 19, 21 and 22), from the note
    as one `not-done` fact onto one fact per requirement with its kind; three
    of them now also assert the note is not a fact beside them;
  - JUDGE 14: the report is the route's reader, held to `judged: true`;
  - two hop guards in `requirement-coverage`: the report's call carries the
    three evidence inputs, and the note is composed from it and from the
    other sentences.
- **The red check**: the new file against `497c47b0` (the branch before this
  fix) in a separate worktree, the three new exports bound to nothing there.
  **12 of 12 fail.** The route and request cases fail on the omission itself:
  - TOLD 6: the note named three of the four;
  - TOLD 7: the note said "And 1 more like it.";
  - TOLD 8: the screen lost the third blocked requirement;
  - TOLD 9: the note named two of the three scheduled;
  - TOLD 10: the background writer was never given "The gallery has a
    slideshow" — it got one fact, the cut note;
  - TOLD 12: the whole note was one fact.

  TOLD 1–5 fail at the missing functions, and TOLD 11 at the missing list.
- **The sweep** (`scripts/mutants/requirement-told.json`, 35 planted defects
  and 3 comment-only controls over the three modules, run against
  `requirement-told`, `addon-judgment`, `requirement-coverage`, `addon-route`
  and `model-replies` from a green baseline): **35 of 35 killed on the first
  run**, and the 3 controls survived. The planted defects:
  - a cut put back in each kind's list, in the report and in the note;
  - the deduplication removed, widened, or made case-sensitive;
  - the `spoken` rule removed;
  - a reason on every entry;
  - the state lost;
  - unseen told as set up;
  - each kind's fact as the wrong kind;
  - the list ignored, or the note given beside it;
  - the other sentences dropped or not sent;
  - four kinds of unreadable list trusted;
  - the route not sending the list, or writing the note from a cut list;
  - the report made without judging in force.
- **The related files**: 911 of 911 across the 24 that read the note, the
  facts or the route.
- **The suite**: `9537 / 9537 / 0 / 0` here (the 9,525 before and the 12 new
  cases), in 234 s, the real-browser cases included. The earlier corrections
  are among them, unchanged and green: run 101's three, the requirement
  judgment and the incomplete judgment.
- **CI** on `52307af6` (this fix's code, `95f5a9d0`, with its records on
  top), complete and green:
  - **unit tests** (run 37428756462): `9537 / 9525 / 0 / 12`. The total
    matches the local run; CI skips the same 12 as before (its usual 6 and the
    6 real-browser cases);
  - **the site build** (run 37428756480): all seven jobs and the gate passed.
    The gate reads *"ALL CHECKS: 404 checks in 27 sections across 4 shards,
    every job green"* (shard 1: 108 checks in 1 section; shard 2: 75 in 2;
    shard 3: 158 in 16; shard 4: 62 in 8), for commit `52307af6` and
    site-build inputs `48b57fb94e6b3d04` (3,972 files).
- **The image** (predicted, not built): `7107b9a349d84ca8` at the branch
  before this fix becomes `140199b61e2581c4`. There are 194 inputs, none
  under `public/`. Three differ (`builder/site-reply.mjs`,
  `builder/site-requirements.mjs`, `worker.js`), and five from deploy 2184's
  `589e3e4e85a20066` (those three, `builder/site-add.mjs` and
  `builder/site-addon.mjs`). A merge would build it, and nothing was built.

## 5. Remaining gaps, kept separate

- **A refusal's requirements never reach the customer** (corrected here: it
  is broader than the incomplete-judgment fix recorded it). When a
  designer's part is refused (`ok: false`, 422), the answer carries the whole
  list and a complete note. But the reply's facts are the refusal's own, and
  the browser prints only the refusal's sentence. So a requirement it lists,
  such as "One thing your site can't do yet: People can pay by bank
  transfer", reaches neither, **whether or not the judgment finished**.
  Nothing is applied or charged on that path. Pinned by TOLD 11, so a change
  to it is deliberate. A backlog item.
- **The note's other sentences still name three, then "and N more"**: the
  missing pages, the QR codes that went with them, the seed skips and the
  tables nothing can fill (`missingPagesNote`, `deadQrNote`, `seedSkipNote`,
  `populationNote`). They are about the change, not requirements, and now
  reach the reply model as one fact (`coverOther`), as before. Found here,
  not fixed, and a backlog item.
- **A designer's requirements past its twelfth are set aside at intake**
  (`over-cap`, by name, in the developer record) and never told. That is a
  ceiling on what is accepted (documented in `docs/addon-path.md`), not on
  what is reported. A test here hit it. A backlog item.
- **Nothing here is shown live.** A real reply model's wording, with many
  requirements, is untested; the completeness check holds it to naming each.
