# A validated correction made reachable (2026-10-13, built offline)

Built on the owner's word, from the design in
`docs/history/2026-10-13-correction-reuse-design.md`. Free: no paid call,
image generation, merge, deploy or container build. Run 141 stays closed, and
**its cause stays unconfirmed**: its stored preparation record
(`requests/fold-lane-bakery/71b20ee310bf857b0310a9918215f201/prep/p1-1.json`)
is still unread. What is shown here is that the shape it most likely had
(R141 3) is now reused.

## 1. The rule, amended in scope only

**Before** (2026-10-11, `docs/history/2026-10-11-validation-scheduling.md`
§1; `readPrepared` in `builder/prepared.mjs`): a refused answer is "kept for
diagnosis and never staged, replayed or handed to a continuation", so every
reader "gives it to nobody".

**Now**:
- **Unchanged.** A refused or cut-off **answer** is never staged, replayed,
  handed to a continuation, shown to a model or applied. VA 0–5 and UA 0–6
  pass unchanged (UA 0 pins `used()`'s exact shape, so the new count is a
  separate `skips()`).
- **Added.** The refusal's **facts** may guide a replay:
  - the reason code;
  - the exact correction feedback sent;
  - the requirement entries the refused answer listed;
  - `cleanIn`, the SHA-256 of what the cleaner judged beyond the request (for
    the Add-on: the site it cleaned against, and today).

  Those are exactly what the live path already carries into its one
  correction. The requirement entries are grounded again in the customer's
  own words by whoever reads them (`groundRequirements`), and the refused
  design itself is never among them.

The rule text is amended where it lives: the comment block above
`readRefusal`, `readPrepared`'s own comment, and a dated amendment note under
§1 of the validation-scheduling record.

## 2. What was built

### The shared mechanism (`builder/prepared.mjs`, any route)

| Piece | What it does |
|---|---|
| `rejectReply(reply, why, facts)` | The refusing step may hand the refusal's facts. They are read strictly (`readRefusal`) and held beside the verdict, by reply identity. Facts that do not read are not kept. |
| The recorder | Writes `refusal` beside `unusable` only for a refusal by its step, never for a cut-off. The `reply` stays in that record for diagnosis, as before. |
| `readRefusal` | Exactly `feedback`, `superseded` and `cleanIn`, nothing beside them. Feedback is a non-empty string of at most 16,000 characters. `superseded` is at most 500 plain objects. `cleanIn` is a 64-character hex digest. At most 256 KiB in all. It returns a copy, or null. |
| `readPrepared` | Refused entries stay out of `calls` and in `discarded`, as before. A new `refusals` list holds `{ h, why, feedback, superseded, cleanIn }`, never a reply. An older record with no facts yields none. |
| `stagedRecord` | Writes a record for a job: the usable answers, plus each refusal as an entry `{ h, unusable, refusal }` with **no reply**. |
| `replayer.wrap(send, { refusals: true })` | Only a caller that declares it handles prior refusals is affected. On an exact fingerprint match with no usable answer recorded and the refusal unspent: no call is made, no reply is returned, and `PriorRefusal` is **thrown** with the facts. A caller that did not declare it never sees a refusal: its call is made as before. |
| `PriorRefusal.take()` | The caller's acceptance, once. It is counted in `skips()` and noted by any recorder the call passed through, as facts with no reply. A caller that declines simply asks again, and nothing is counted. |
| `valueDigest` | The canonical SHA-256 of plain JSON. Anything else (a Map, a Set, a Date, a function, NaN) gives `""`, and `""` never matches. |

### The first adopter: the Add-on designer (`worker.js`)

- **Recording.** The turn's refusal of the **first** request's answer marks
  the reply with its facts. The facts are its feedback, its requirement
  entries, and the `cleanIn` of `{ site: aSite, today }`, which is exactly
  what `cleanAdd` judges against. A refusal of a re-asked answer
  (`aNeedsAgain`) carries no facts.
- **Use.** The first designer request opts in, whether made early
  (`aStartReady`) or at the turn. On a `PriorRefusal`, the turn digests its
  own `{ site: aSite, today }`. **Only when the digests are equal**:
  1. the refusal is taken;
  2. the turn marks `correct` with `skipped: 1`;
  3. it keeps the recorded requirement entries as superseded;
  4. it sends the correction with the recorded feedback.

  The correction request is built by the same code from the same inputs, so
  only an exact fingerprint match answers it from the record. Otherwise the
  model is asked. Either way the answer passes the job's own `cleanAdd`
  before anything is applied, and a second refusal is final (422, no cost).
  There is never a third designer call.
- **Fallback.** When the digests differ, the reason is unreadable, or the
  reason is `nothing`, the refusal is declined. The trace shows
  `start {again, prior: "declined"}` and the first request is asked now, as
  before.
- **An early answer that meets a prior refusal** is never ready early. Its
  turn decides it.
- **Staging carries the facts.** `stagePreparation` (both branches) and
  `stageKept` (a paused job's kept facts, never its replies) do so, and the
  job builds its replayer from `stagedRecord`.
- **Counts:**
  - `jobs/prepared/<id>.use.json` gains `skipped`, served on the request's
    view as `prepUse[].skipped` (null when not written);
  - the skipped call's mark is `{ …, replayed: false, skipped: true }`;
  - the skipped request is not counted `scoped` (it asked no model);
  - `fresh` and `replayed` count only calls answered or made.
- **Money.** The skipped call was the preparation's, and ours. The job bills
  the replayed correction once, through its own reserve, as any replayed
  answer (CR 1: the job is charged exactly what a job with no refusal is).

### Reusable across routes

The mechanism has no Add-on knowledge. To adopt it, a step:
1. passes `{ refusals: true }` through `jobSend(job, send, opts)` on its
   first request;
2. hands `rejectReply` its facts with its own `cleanIn`;
3. handles `priorRefusalOf(error)` with its own digest check.

The text and data steps' bounded corrections could adopt it next. They have
not; until they do, they behave exactly as before.

## 3. Tests

**New, `test/correction-reuse.test.mjs` (9):**

| Case | What it shows |
|---|---|
| CR 1 | Through the real Worker, on run 141's site and shape: the job asks the designer **0** times (`skipped 1`, `replayed 3`, `fresh 0`, `scoped 3`). The marks show the skipped call. The staged record holds the refusal as `{h, refusal, unusable}` with no reply, and the job's own kept record holds it the same way. The refused design's markers appear in **no** stored object outside the preparation's own diagnostic record, nor in the view or any page. The run is charged exactly what the same run with no refusal is, and no charge is made twice. |
| CR 2 | Changed validation context: the staged `cleanIn` is not the job's. The refusal is declined, and the first request is asked again (its text equals the preparation's first request). The new answer lands, `skipped 0`. |
| CR 3 | A rejected correction: the preparation's correction was refused too. The job skips to the correction request, whose text equals the preparation's correction request byte for byte. No usable answer exists for it, so it is asked once. That makes three designer calls in all, none of them a third call by the job, and the new answer lands. |
| CR 4 / 4b | An older record (no facts), and malformed facts reaching the job (feedback missing): the job behaves exactly as before. |
| CR 5 | Every malformed field gives no facts, and the reader returns a copy. A refusal recorded with bad facts carries none, and a cut-off reply never carries facts. A caller that did not opt in makes its call, and `used()` keeps its old shape. An opted-in caller gets a throw (never a reply), taken once, counted only when taken, and spent. A different request never meets it. |
| CR 6 | Continuation, at the readers: a taken refusal is kept as facts with no reply. Read back, it is a refusal and never an answer. Re-staged, it is taken again under the same rule. A refused reply the job itself kept for diagnosis is never in `calls`, and its content is never staged. |
| CR 7 | The digest: key order does not matter, any value does, and a value that is not plain JSON gives `""`. |
| CR 8 | Continuation through the real queue. One Add-on, page then component. The page's first design is refused (the page exists) and corrected, then the component's designer asks. The paused job's kept record holds the refusal's facts, and its refused reply is not readable as an answer. After the answer, the page designer is not asked again (`skipped 1` on the next job). The refused design is in no staged record and no page, and nothing is charged twice. |

**Changed:**
- **R141 3** now asserts the reuse: `skipped 1`, `replayed 3`, `fresh 0`, and
  the designer asked twice in all (by the preparation only). Its header says
  what it asserted before.
- **`prepared-scope`'s exact `requestView` shape** gains `skipped`.

**Unchanged and passing:** VA 0–5 (`validation-reuse`) and UA 0–6
(`continuation-unusable`).

## 4. What this proves, and what it does not

- **Proven, with supplied answers only:**
  - the mechanism reaches the recorded correction exactly when the first
    request and the cleaner input match;
  - it falls back to asking whenever evidence is missing, malformed or
    different;
  - it never puts refused content into a request, a staged or kept record, a
    view or a page, and charges exactly as a job with no refusal.
- **CR 2 is a tampered digest, not a real change of context.** On run 141's
  shape no natural change alters the cleaner's input without also altering
  the designer's request: the scoped request and `aSite` change together. So
  the case is made by rewriting the staged digest. CR 7 shows that any change
  in value changes the digest.
- **Not shown live.** Run 141's own record is still unread, so whether its
  refusal was this shape remains unconfirmed. A real model may answer the
  correction differently from the recorded one only when its request differs,
  and then it is asked, as before.
- **Limits:**
  - only the Add-on designer's first request adopts it;
  - a refusal of a re-asked answer (`aNeedsAgain`) carries no facts, so it is
    asked again as before;
  - the text and data steps do not adopt it.

## Verification

- **Focused:**
  - `correction-reuse` 9/9;
  - `parallel-reuse-run141` 5/5;
  - `validation-reuse` and `continuation-unusable` (VA 0–5, UA 0–6)
    unchanged and passing;
  - `part-marks` 5/5;
  - `prepared-scope` passing.
- **Red check**, in a throwaway worktree: the branch head's `worker.js` with
  the new `prepared.mjs`, `request.mjs` and tests.
  - **Fail, as required:** CR 1, CR 3, CR 8 and R141 3, because the old
    Worker asks again.
  - **Also fail:** CR 2, CR 4 and CR 4b. They need the new staging and the
    `skipped` count, which the old Worker lacks.
  - **Hold:** CR 5–7 (the pure readers, which are new code), and
    R141 1, 2, 4 and 5.
  - Against the old `prepared.mjs` the file cannot load.
- **Sweep:** 25 of 25 mutants killed; both comment controls survived. The
  first pass left two mutants alive:
  - facts read beside a cut-off verdict;
  - a non-opted caller meeting a refusal.

  Each was a test gap, closed in CR 5 (a forged cut-off entry, and a plain
  caller fingerprinted beside a usable answer). Both were then killed.

  The mutants covered:
  - the readers (refusals dropped, any verdict, extra keys, hex, plain
    objects);
  - the replayer (opt-in ignored, hashing gated, not spent, take not counted,
    taken twice);
  - the recorder (no note, facts on a cut-off);
  - staging (refusals dropped, plain staging in `stagePreparation`, kept
    refusals dropped in `stageKept`, the job's replayer built without
    `stagedRecord`);
  - the digest (lax);
  - the turn (digest check removed, early start not opted in, facts not
    recorded, feedback altered, a skipped call counted `scoped`, `skipped` not
    written).
- **Full suite:** `10735 / 10735 / 0 / 0` locally.
  - The first run had six failures. Five were guards whose landmarks moved,
    re-anchored with dated notes: `addon-queue`'s `aQuick` and `aCounted`,
    the `let ranFirst` landmark in `requirement-coverage` and twice in
    `site-add`, and `parallel-plan`'s exact `readPrepared` shape.
  - The sixth was REOPEN 1, the known load-sensitive case (backlog). It
    passed alone and in the rerun.
- **Commit `372f8ae0`.**
  - CI: unit tests run 38334767137, `10735 / 10691 / 0 / 44 skipped` (the
    totals match); site build run 38334767139, success.
  - Image prediction (from the commit): `eda28cb21064287d` (production) →
    `4444d9d53d906b8d`, 205 inputs.
  - Nothing merged, deployed or built.
