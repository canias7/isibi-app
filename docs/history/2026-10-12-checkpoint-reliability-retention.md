# 2026-10-12 — The requirements checkpoint is required state, and it keeps every one

Codex reviewed `f5c12482`: 252 focused tests passed, including round 12's
clarification and resume failures and the parallel-work cases. Those fixes
are kept. Two new reproductions showed that round 12's checkpoint was
best-effort and capped. Both are fixed here.

**Correction to round 12's handoff.** It said "no open implementation defect
is known in the parallel flows' offline behaviour". That was wrong: both
reproductions below were open defects in that code. They are closed by this
round's commits.

**Commits**:
- `03b758ec`: the change and its tests;
- `a5054e40`: two cases the first sweep showed were missing (§5);
- the commit carrying these records and the acceptance pin.

**Image prediction**: production `8d6dbcea93252fbb` → `31811cf56e30d18c`
(205 inputs, on `a5054e40`, whose product files are `03b758ec`'s; was
`d9800cfea19e7cee`). Not built.

No merge, deploy, container build, paid call, real image, fal call, balance
change or flag change. Every provider was mocked; real images are
unverified. Build flags and the 1-page / 15-component limits are unchanged.

## 1. The reproductions

Both use the FAQ clarification case: collapsible and searchable answers,
both recorded before the question, neither repeated by the resumed designer.
The normal control finishes partial.

- **Storage, write.** One failed bucket write of the paused job's
  `.held.json` was logged, but the question was still accepted. After
  "Below", the request finished done, with no judge call and nothing
  missing.
- **Storage, read.** With the checkpoint and staging both succeeding, one
  failed read of the resumed job's `.held-in.json` also finished done,
  although the saved requirements were still in the store.
- **Size.** Twelve distinct, grounded requirements were written beside each
  of six successive questions, all present in the original request. The
  final designer lists none. Five rounds kept all 60. Six rounds kept 60 of
  72 (`MAX_HELD`), and the first twelve never reached judgment or reporting.

## 2. Storage: the checkpoint is required, not best effort

`worker.js` (the job runner, staging, the add-on route) and
`builder/request.mjs` (settling a job, the next job's body).

- **Saved and proved before the question stands** (`saveHeldCheckpoint`).
  - A paused job's checkpoint is `{ complete: true, count, requirements,
    asked }`. An empty one is a real answer, not a missing one.
  - It is written, read back and compared (count, ids, needs), up to three
    times.
  - Only a verified save lets the question through. The job's answer then
    carries `heldCheckpoint: { count }`, and the part records it on that job
    (`end.held`).
- **When the store will not take it.** The whole checkpoint rides in the
  job's own answer, and the request part keeps it on that job
  (`end.heldList`). That write is conditional, and the request advances on
  it, so the question is acknowledged only once the copy holds.
  - An answer too large to carry it (`HELD_INLINE_MAX`, under the stored
    answer's 200,000 bound) becomes a recoverable refusal
    (`checkpoint-unsaved`) instead of a question.
  - That oversized path is not exercised end to end; see §6.
- **The resumed job knows exactly what it resumes from.** Its job body names
  the checkpoint (`heldFrom`: the latest job of the part that paused on a
  question, and its verified count).
  - Staging copies that checkpoint only, from the store or the request's
    copy, and only when it reads back complete with that count.
  - The job reads the staged copy, or failing that the paused job's own
    record, each up to three times (`readHeldIn`).
  - A missing, unreadable or malformed checkpoint, or one holding another
    count, is `failed`. It is never an empty list, and never an older
    checkpoint.
- **A job that cannot read it does nothing.**
  - The add-on route returns `checkpoint-unread` before any model call: no
    design, no apply, no charge.
  - The part then runs again as a new job (`held-retry`, up to
    `HELD_RETRIES` = 2 more jobs). The paused job's answers are replayed
    (`stageKept` now includes `held-retry` jobs), so no successful model
    work is asked for again.
  - If it still cannot read the checkpoint, the part **fails, saying why**
    (`checkpoint-unread`). Nothing is applied, nothing is charged, and the
    saved requirements and kept answers remain.
- **Kept**:
  - request and part ownership (staging reads only the part's own job
    records);
  - idempotent staging and duplicate delivery;
  - explicit scope cancellations through the judge (round 12's RR 10, still
    green).

## 3. Size: nothing accepted is dropped

- **`MAX_HELD` is gone**, and nothing replaces it. `holdRequirements` and
  `readHeld` keep every requirement; a checkpoint's count is what it holds.
- **The judgment runs in bounded batches** (`JUDGE_BATCH` = 24 per call).
  Each batch's verdicts are merged, and each call's usage is billed as
  before. A batch that fails or asks is the judgment's answer, as one call's
  was. The batch size bounds a call, not the set.
- **A part's not-done list is no longer cut to 24**, in all four places
  `builder/request.mjs` did that. With 72 unfinished requirements, the part
  reports all 72.

## 4. Tests

`test/requirement-checkpoint.test.mjs` (new, 18 cases), through the real
driver, queue consumer, routes and job runner. They read the judge's real
inputs, the durable records, the final statuses, the stored
`requirementsTold` and the reply writer's facts.

| Case | What it shows |
|---|---|
| **CK 0** control | the FAQ case, no fault: both judged, stored and told; partial |
| CK 0r | the record: `complete`, `count: 2`, and the part's `end.held: 2` |
| **CK 1** | **Codex's write reproduction**: one failed write is retried and read back; both told; partial |
| CK 2 | every write of the first job fails: the checkpoint is kept on the request, the question stands after that, and both are told; no designer asked again |
| CK 3 | neither the store nor the request's copy can be read: after the bounded retries the part fails, saying why; no judge, nothing applied or charged |
| **CK 4** | **Codex's read reproduction**: one failed read of the staged copy is retried; both told |
| CK 5 | both the staged copy and the paused job's record are unreadable for a whole job: it stops (`held-retry`), the part runs again, and both are told; no designer asked again |
| CK 6 | a malformed checkpoint (count ≠ list): the part fails honestly, never with fewer requirements |
| CK 7 | a missing checkpoint: fails honestly, not an empty set |
| CK 8 | a genuinely empty checkpoint: `complete`, `count: 0`, staged as such; the request is done |
| CK 9 control | two pauses: the second checkpoint (3) is the one resumed |
| CK 9 | the latest checkpoint unreadable, an older one readable: the older scope is never used; the part fails honestly |
| CK 10 | duplicate delivery over a checkpoint the store first refuses: both told, nothing charged twice |
| **CK 11** control | five questions × 12: all 60 judged, stored and told |
| **CK 11** | **Codex's size reproduction**: six questions × 12: all 72 judged, stored and told |
| CK 11r | each checkpoint holds 12 … 72; every judgment call holds ≤ 24; the part reports all 72 unfinished |
| CK 12 | a write that answers as landed and stores nothing is caught by its read-back |
| CK 13 | the reader: complete, empty, legacy and malformed records, the expected count, and 150 kept |

The fixture gained `dropPut` (a write that answers as landed and stores
nothing). Two tests that read source code by its exact text were re-anchored
on `resStatus`: `edit-queue`'s finalize landmark, and `input-budget`'s stored
answer bound. The latter now also checks that `HELD_INLINE_MAX` is under that
bound.

## 5. Verification

- **Red check** (the new file over `f5c12482`'s product files, in a
  throwaway worktree):
  - **the controls pass**: CK 0 (partial) and CK 11 control (60 kept);
  - **every reproduction fails as reported**:
    - CK 1 and CK 4: "the judge never ran";
    - CK 11: "12 never reached the judge: …option 01… option 12";
  - so do the other new cases (14 of 16 in that run fail; CK 12 and CK 13
    were added later).
- **Mutation sweep** (`sweep18`, 4 test files; every anchor checked to
  occur once): 14 product mutants and a comment-only control.
  - **First run**, from `03b758ec`: the control survived, and 10 of 14 were
    killed.
  - **Survivors examined**:
    - `save-unverified`: no case had a write that answers as landed and
      never lands. Added CK 12, with the fixture's `dropPut`.
    - `count-mismatch-accepted` and `expect-ignored-legacy`: the expected
      count masked the reader's own rules on the route path. Added CK 13,
      on the reader directly.
    - `staged-copy-unchecked`: **equivalent today**. A job's staged copy is
      written only from its designated checkpoint, and is also checked for
      its count. It is kept as a guard.
  - **Second run**, from `a5054e40`: the control survived, and **13 of 14
    were killed**. The one survivor is the guard above.
- **Full suite** on `a5054e40`: `10610 / 10610 / 0 / 0` (+18 over round 12's 10592: the 18 CK cases).
- **Consolidated acceptance sweep** on `a5054e40` (round 12's groups, with
  the new file in clarification and resume): 38 files, **485 / 485** — independent work 112, genuine dependencies 92, clarification and resume 174 (12 files), partial failure 107.
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI**: __CI__

## 6. Remaining work, by kind

### Implementation defects known now

- **None reproduced and open.** Both of this round's reproductions are
  closed, and every case above passes.
- The next item is a path not exercised, not a reproduced defect: an answer
  too large to carry its checkpoint becomes `checkpoint-unsaved` and goes
  through the same bounded part retry. That retry runs the paused job's
  unreplayable calls again (a refused designer answer is never replayed), so
  its outcome depends on the model. It would take a checkpoint of roughly
  300 or more requirements.

### Limits (as designed, recorded)

- A part that cannot read its checkpoint after the bounded retries **fails**.
  It keeps every saved record, but nothing resumes it automatically; the
  customer would have to ask again. That is honest, but it is not automatic
  recovery.
- Labels are taken at acceptance. Uncertain equivalence is told twice. Build
  refusals are unmarked. The real waits are unchanged (rounds 11–12).

### Behaviour awaiting live verification

- the store's real failure modes (R2), and whether three tries cover them;
- whether real designers mark `replaces`;
- whether real judges set aside only on the customer's words;
- whether real routers name the new targets;
- the real latency gain;
- real images (fal off limits).
