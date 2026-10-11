# 2026-10-11 — Requirements held across a clarification and restored on resume; one consolidated acceptance sweep

Codex reviewed `6c2d3887`: 217 focused tests passed, CI was green, round 11's
requirement-identity failures stay fixed, and the page/function/API/job
overlap cases pass offline. Those improvements are kept. One reproduction
remained: requirements were lost across a clarification and its resume.
This round fixes that as one shared continuation rule, then runs one
consolidated mocked acceptance sweep over the existing parallel flows.

**Commits**:
- `f153bae8`: the change and its tests;
- `3a3a313d`: cases for the paths the first sweep left unproven (§4);
- the commit carrying these records and the acceptance pin.

**Image prediction**: production `8d6dbcea93252fbb` → `d9800cfea19e7cee`
(205 inputs, on `3a3a313d`, whose product files are `f153bae8`'s; was
`2b5ff083fe725602`). Not built.

No merge, deploy, container build, paid call, real image, fal call, balance
change or flag change. Every provider was mocked; real images are
unverified. Build flags and the 1-page / 15-component limits are unchanged.

## 1. The reproduction

An About-page FAQ with collapsible and searchable answers, through the real
request-flow fixture:
1. The first component answer names `/does-not-exist` and records both
   requirements.
2. The cleaner refuses it, and its correction asks "Above or below the
   story?".
3. The customer answers "Below".
4. The resumed designer returns a valid `/about` design, and the writer
   builds static cards.

The outcomes, by what the resumed designer repeats:
- **Control**, it repeats both: both reached the judge, the stored answer
  and the reply, and the request was partial.
- **Failure 1**, it repeats only collapsible: searchable disappeared from
  all of those places.
- **Failure 2**, it repeats neither: the judge never ran, and the request
  finished done with no missing requirements.

RI 5 passed only because its supplied resumed answer repeated both.

**Cause.** A designer's question ends the add-on job. The answer resumes the
whole addition in a new job, and that job's only source of requirements was
whatever the resumed model answered. The refused answer's requirements (and
the correction's carried ones) lived only in the first job's memory.

## 2. The rule: requirements are held with the request part, not remembered by the model

`worker.js` (the job runner, staging, the add-on loop) and
`builder/site-requirements.mjs`.

- **Held before pausing.** Every add-on exit that ends on the customer's
  question holds the part's requirements (`aHold`):
  - the picker's;
  - a designer's (including a correction's, and the judge's on hand-offs);
  - the final judge's;
  - the page writer's.

  The held list is everything grounded so far, plus anything handed in and
  not yet resolved (§ repeated questions). Each entry keeps its id, step,
  basis, quoted words and hand-off (`step`, `answers`). A `covered` claim
  becomes `unsupported`, because the design that claimed it was never built.
  No design and no item reference is kept, so a refused design stays
  unavailable for execution and replay.
- **Durable, under the paused job's own id.** In the job runner's `finally`,
  before the job's end is recorded, the list is written to
  `jobs/prepared/<job>.held.json`, beside the answers the job kept.
- **Staged for the part's next job.** `stageHeld` runs with `stageKept`. It
  reads the request part's job records and takes the latest paused job
  (`clarify` or `uncertain`) that held something. It copies that list to
  `jobs/prepared/<next job>.held-in.json`, which the next job reads as its
  own object. It never reads the site's latest-answer document, which any
  other addition may have rewritten.
- **Restored and reconciled.**
  - When a step's designer answers, the held requirements of that step are
    reconciled with its answer (`carrySuperseded`, `keepIds`). One it marks
    as restated (`replaces`), the same hand-off answered, or the same need
    word for word replaces it.
  - Anything else is carried, keeping its held id where no entry in play has
    it, so a hand-off is handed to the later step that needs it.
  - What was held for a step that did not run this time is carried before
    the judgment (`aRestoreLeft`).
- **The resumed designer is shown what its step held.** Only the designer
  whose question was answered is shown the list, by id (`heldNote`), so it
  can mark which one it restates. Its request changed with the answer
  anyway. Every other designer's request stays the one it made before, so
  its kept answer is replayed and nothing it did is asked, applied or
  charged again.
- **Only the customer can take one away.** A model leaving a requirement out
  never cancels it. Every held requirement reaches the judge, which is shown
  the customer's answers. If they said they no longer want something, the
  judge sets it aside as unrelated; otherwise it is judged and told.
- **Requirements written beside a question** are now read and held. Before,
  `runAdd` dropped them with the question.

## 3. What each kind of question now does

| Paused by | Held | On resume | Evidence |
|---|---|---|---|
| a correction's question | the refused answer's grounded requirements, carried | reconciled with the resumed design, shown to it by id | RR 0–3, RR 9–11 |
| a designer's own question | what it wrote beside the question, and earlier steps' requirements | the same | RR 4 |
| the page writer's question | every designer's requirements, carried ones included | designers replayed; held reconciled with them | RR 5, RR 5b |
| the judge's question | everything | every designer and the picker are shown the answer; held restored even for a step the picker drops | RR 6, RR 12 |
| a second question before the held step runs | what it was handed, unused | the latest pause is staged | RR 7, RR 13 |
| a dependency re-ask after the resume | — | the re-asked answer is reconciled the same way; the table is made once | RR 8 |

## 4. Tests (all mocked, through the real driver, queue consumer, routes and job runner)

`test/requirement-resume.test.mjs` (new, 17 cases). Each case reads:
- the judge's actual input;
- the durable records;
- the final status and the parts not done;
- the stored answer's `requirementsTold`;
- the reply writer's facts.

The cases:
- **RR 0** control: the resumed designer repeats both.
- **RR 1**: Codex's failure 1. **RR 2**: Codex's failure 2.
- **RR 3**: the resumed designer is shown the held ids. It restates
  collapsible in new words and marks `replaces`, so it is told once.
  Searchable keeps its held id at the judge.
- **RR 4**: an ordinary designer question with both requirements beside it.
  They are held as `unsupported`, never `covered`.
- **RR 5**: the page writer asks after a valid design. The designer is asked
  once, and the requirements are told once.
- **RR 5b**: the page writer asks after a corrected design. The refused
  answer is not replayed, so searchable comes only from the held list.
- **RR 6**: the judge asks.
- **RR 7**: repeated questions. The second pause adds a requirement, and the
  latest record is the one staged.
- **RR 8**: a dependency re-ask after the resume, beside a table. The table
  designer is asked once and the table made once.
- **RR 9**: restart and duplicate delivery over failure 2. Nothing is
  charged twice.
- **RR 10**: an explicit scope change ("no search after all"). The held
  requirement reaches the judge, which is shown the answer and sets it
  aside.
- **RR 10 control**: without that sentence, the model's omission does not
  cancel it.
- **RR 11**: the durable record. It is under the paused job's id, with ids,
  the asker, and no claim or reference to the refused design. The next job
  is staged exactly that list, with the site's latest answer blanked first.
- **RR 12**: a judge question, then a picker that leaves the component out.
  Its held requirements are still judged and told.
- **RR 13**: a second pause, by the picker, before the held step runs. It
  holds what it was handed.
- **RR 14**: a held hand-off to a later step (QR) is reconciled at the
  component's turn and handed to the QR designer.

Re-anchored: `requirement-coverage`'s brief landmark. The hand-off brief is
`aBriefHanded`, `aTold` is still filled only where it is composed, and the
designer is handed `aBriefHanded + aHeldShown(k)`. RI 5 is kept; RR 0–2
prove the property RI 5 only appeared to.

## 5. The consolidated mocked acceptance sweep

Every existing Build/Edit/Add-on parallel-flow file, grouped by what it
proves and run group by group on `3a3a313d`:

| Group | Files | Tests | Result |
|---|---|---|---|
| independent work (overlap, scoped preparation, Build parallel, the step pool) | 10 | 112 | 112 pass |
| genuine dependencies (planning, readiness, ordered parts, prepared scope) | 6 | 92 | 92 pass |
| clarification and resume (requirements, corrections, continuation, unusable answers, live clarify, hand-over, Build resume) | 11 | 156 | 156 pass |
| partial failure (purchase outcomes and recovery, preparation ownership, partial evidence, pending photos, findings, reconcile, spend bound, entry points) | 10 | 107 | 107 pass |

That is 37 files and 467 tests, with none failing or skipped. The groups and
files are listed in the script kept with the session (`accept12.sh`).

## 6. Remaining work, by kind

### Implementation defects known now

- None open in the parallel flows' offline behaviour.
- The gaps below are limits, decisions or unmeasured behaviour. No test
  shows any of them doing the wrong thing.

### Limits of the implementation (behaviour as designed, recorded)

- **Labels are taken at acceptance** (round 11).
- **Uncertain equivalence errs toward telling twice** (round 11). A
  restatement neither marked nor word for word is told beside the original.
- **A held requirement is only as good as its grounding.** It is grounded
  again against the request on resume; one whose quote is gone is set aside
  as ungrounded, not told.
- **Build-path refusals are not marked.** An early-refused designer can make
  3 calls. A step preparation never handed over is unused model work.
  (Rounds 10–11.)
- **Real waits**: a new page's writer, structural page changes, and routings
  that name no targets (round 11 §5).

### Behaviour awaiting live verification (nothing here is deployed or pressed)

- whether real designers mark `replaces`, for corrections and for held
  requirements;
- whether real judges set a held requirement aside only when the customer's
  answer says so;
- whether real routers name `new-function:` / `new-api:` / `new-job:`
  targets;
- the real gain of preparing beside other work, given real latency;
- real images (fal off limits).

## 7. Verification

- **Red check** (the new file over `6c2d3887`'s product files, in a
  throwaway worktree, with the first 13 cases): **11 fail and 2 pass**.
  - The 2 that pass are the control (RR 0) and the writer question after a
    valid design (RR 5), where replaying the designer had already recovered
    the requirements.
  - Every other case fails, both reproductions included.
- **Mutation sweep** (`sweep17`, 5 test files; every anchor checked to occur
  once): 15 product mutants and a comment-only control.
  - **First run**, from `f153bae8`: the control survived, and 9 of 15 were
    killed.
  - **The 6 survivors** were each examined, and each was a path no case
    reached:
    - a page writer's hold;
    - holding what was handed and unused;
    - staging the latest pause;
    - reconciling at the step's turn;
    - restoring a step that did not run;
    - a held claim made `unsupported`.
  - RR 4's record check, RR 5b, RR 7's second requirement, RR 12, RR 13 and
    RR 14 were added (`3a3a313d`).
  - **Second run**, from `3a3a313d`: the control survived, and **15 of 15
    were killed**.
- **Full suite** on `3a3a313d`: `10592 / 10592 / 0 / 0` (+17 over round 11's 10575: the 17 RR cases).
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI**: unit tests 38185779044 `success` on `ac7e57d6` (the code of `3a3a313d` plus these records and the pin); site build 38184558303 `success` on `f153bae8`, whose product files `3a3a313d` keeps (site build does not run on a push of documents and tests only); unit 38184558314 on `f153bae8` `success`.
