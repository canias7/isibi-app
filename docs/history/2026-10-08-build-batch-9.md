# The ninth Build batch: a first Build's design recovered, not abandoned (2026-10-08)

Codex reviewed `8180a7cf`, passed 84 focused tests and independently
reproduced a first Build receiving an unusable design: exactly one
`design_schema` call, then `design-unusable`, with no corrective attempt. The
eighth batch's fixes are kept.

This pass makes the AI correct its own design mistakes inside the same Build.
The model asks the customer something only when a decision is genuinely
theirs, and the Build stops only when recovery is exhausted or something
outside it blocks the work.

Nothing was merged, deployed or built. There was no paid call, no paid retest,
and no SQL was applied. The limits of 1 page and 15 components, the spending
safeguards and the .txt reminder are unchanged.

## What existed, and what was reused

Inspected before anything was added:

- **The first build's question round** (`public/chat.js`).
  - The router can ask a question before a first build.
  - The round keeps the brief, the answers so far and the files on the site
    (`site.clarify`).
  - Its answer runs the build again with the original brief and the answers
    (`qa`).
- **The shared question field** (`withQuestion`, `readAsk` in
  `builder/clarify.mjs`). Every step's tool can carry a model-written question
  through it.
- **The provider error reading** (`upstreamKind`, `isCallTimeout`, and
  `retryHere`'s rule in `build-call.mjs`):
  - billing;
  - status;
  - error type;
  - our own clock;
  - no answer at all.
- **Later-stage repairs, kept as they are**:
  - pages that fail to compile are repaired (`repairPages`), and that repair's
    usage is charged with the pages;
  - salvage stubs only the page that is still broken.

The design step had none of this. Whatever the designer returned was checked
once (`designUsable`). If the check failed, the build stopped and gave the
deposit back.

## What changed

### 1. One decision about what went wrong (`builder/design-repair.mjs`, pure)

`designFailure` reads the designer's ending:

| kind | when | what happens |
|---|---|---|
| `malformed` | no tool call, required parts missing or empty, an incomplete split design | one corrective attempt (`repair`) |
| `truncated` | the answer ran out of room | one corrective attempt: complete, tighter, nothing dropped |
| `transient` | the provider busy or rate-limited (408, 409, 425, 429, 500, 502, 503, 504, 529, or an overloaded, rate-limit or API error type), or no response at all | the same request once more (`again`) |
| `account` | billing, quota, 401 or 403 | never retried |
| `rejected` | any other 4xx (a request the provider refuses, ours) | never retried |
| `timeout` | our own time ceiling | never retried |

`mayRetry` applies three bounds:
- **One corrective attempt** and **one provider retry** per design. Each is
  counted from the durable record, so a redelivery counts what an earlier
  delivery did.
- **No call is started** with less than `DESIGN_RETRY_FLOOR_MS` (150 s) left
  in the build's budget. That is long enough for a design that still leaves
  time for its pages.

### 2. The corrective attempt (`recoverDesign` in `worker.js`)

- **It runs on the same request.** It gets the same brief, the same earlier
  answers and the same attached files. `repairNote` adds:
  - the validation failures by name;
  - what the model already wrote. That text is cut only past 16,000
    characters, **and the note says it was cut**;
  - "keep every page, feature, table and requirement the request asks for —
    never drop one to fit";
  - "use their words, their earlier answers and their files to settle what
    you can". It may ask in `question` **only** if a decision that is theirs
    alone blocks a complete design.
- **Every designer mode hands its ending to it**: the single call, the waves
  and the graph.
  - Waves and graph now return what they already knew (`partial`) when they
    end incomplete or cut off. A cut-off single call returns its partial tool
    input.
  - The corrective call is the single-call designer that every mode already
    shares, with the first build's own tool (`frontendOnly` passed through,
    never a literal) plus the shared question field.
- **The answer is validated again.** A usable design goes on in the **same
  build**: the same deposit, the same job and the same steps after it. A
  usable design always wins over a question asked beside it.
- **A busy provider or a dropped connection** is asked once more, without
  being told it made a mistake.
- **A revise keeps its single path.** Only a first build recovers this way.

### 3. Attempts are durable and attached to the job

- **Recorded before they are made**: `jobs/<id>.design.json`,
  `{ v: 1, attempts: [{ retry, kind, why, at }] }`. The record is written
  before each extra call.
- **A redelivered job** reads the record and does not repeat an attempt
  already made.
- **An attempt that cannot be recorded is not made** (`attempt-unrecorded`).
- **A record that cannot be read allows no attempt** (`attempts-unreadable`).
  A duplicate is never risked.
- **An inline build has no job id**, so it keeps its attempts in memory. A
  closed browser on a queued build changes nothing: the consumer runs the
  recovery, and the record carries what was done to the resume that finishes
  the build.

### 4. Money

- **A repaired design** settles every design call's usage: the first answer
  and the repair, summed (`addUsage`). This goes through the existing
  settlement (`schemaSettlement`), the same rule as the page repair's usage.
  No completed call is charged twice, and there is one rounding.
- **A question** gives the deposit back in full. Nothing is built, and no
  database is made.
- **An exhausted recovery** stops as before, with the deposit given back in
  full. That includes the extra call's cost, which is ours.
- **Bounded cost**: at most two extra design calls per build (one repair and
  one retry), each about one more design call's usage (a repair's request is
  the first request plus the note). The added cost has not been measured,
  and nothing caps it beyond the existing settlement and the balance.

### 5. What the customer is told

- **A repaired design.**
  - The build's facts carry `design: { outcome: "repaired", attempts }`.
  - The reply writer is told, for example: "the designer's first plan came
    back incomplete, and it was asked to correct it. That worked: the build
    went on with everything they asked for, and nothing was dropped."
- **A question.**
  - The build answers `intent: "clarify"`, `stage: "design"`, with the
    model's own words and answers (none to four).
  - The page opens the first build's existing question round. A typed answer
    is always taken; buttons appear when answers were offered.
  - The answer runs the same brief again with it. That answer goes through
    the existing routing call (1–2 credits).
- **An exhausted recovery.**
  - The failure fact is joined by what was tried: "…that did not produce a
    usable plan either. Their request itself was fine and does not need to be
    shortened."
  - **The truncated stop no longer tells them to describe fewer things**,
    neither in its fixed sentence nor in the writer's fact. The time-ceiling
    fact no longer suggests a shorter description.
- **Outages keep their fixed messages**: account, billing and rejected.

## Tests

- **`test/build-batch-9.test.mjs`, 22 cases, offline.**
  - **Pure**:
    - the classification table;
    - the bounds;
    - the note (the failures, the earlier answer, the cut marker, and a
      short answer shown whole);
    - the outcome (a design wins over a question);
    - the facts (only real readings; no "fewer things").
  - **The real inline route**:
    - **Codex's reproduction**: no tool call, then one corrective call. It is
      told "did not use the design tool", given the same first-build tool
      plus the question field, and the same build goes on. The settled usage
      is 100 + 300 in and 50 + 70 out;
    - a truncated answer: the repair is shown the earlier answer through a
      marker that is not in the brief;
    - a busy provider (529): asked again, not told it erred;
    - controls: billing and a rejected 400 make one call each, with the
      deposit returned; a usable design makes one call and carries no
      recovery;
    - a question: 200, `clarify`, the model's words, cost 0, no database,
      no pages, the deposit returned;
    - still unusable: two calls, never a third, then `design-unusable` with
      `exhausted`, cost 0, and the fact naming what was tried;
    - a truncated stop: no "fewer things" in the message;
    - **the waves designer**: agents that leave `purpose` out end incomplete.
      The single corrective call is shown what the agents wrote (by their
      slug, absent from the first request), and the build goes on;
    - the waves module's unusable ending carries `partial`.
  - **The job**:
    - the attempt is recorded before its call;
    - a redelivered job with the repair recorded makes no call;
    - an unreadable record, or a write that fails, makes no call;
    - with too little time left, no call is made;
    - a cut-off corrective call's usage is summed;
    - the bounds across kinds (repair, then retry, never more);
    - **the queued job with the browser closed**:
      - the consumer repairs, fires the same build, and records one attempt;
      - the resume's final answer carries the repaired design fact;
      - a redelivery of the job reaches the design again and makes no second
        corrective call. An observer checks that it did reach the design.
- **`test/design-question-browser.test.mjs`, 3 cases in real Chromium**, with
  a screenshot shown in the chat:
  - the designer's question opens the round, and the answer runs the build
    again with the original brief and `qa`;
  - a question with no answers offered is answered by typing;
  - control: answers that are not words are no question.
- **Updated guards**, each because the property moved on purpose:
  - `build-audit-batch` H4 expects the one corrective call;
  - `frontend-build` counts three `designSiteSchema` names (the declaration,
    the route and the recovery) and accepts the defaulted `repair` parameter
    after the frontend flag;
  - `build-budget` knows the `design-recovery` mark;
  - `api-auth`'s classifier rule is met as every caller meets it;
  - `build-params` (the recovery's record rides on the resume's design, not
    on `buildAndPublishPages`' arguments);
  - `build-resume-wiring` (the question branch sits after the credit refresh,
    so the fired-build branch never returns early);
  - `build-audit-batch` M7's record spelling is unchanged.
- **Fixtures**:
  - `driveBuild` takes a `design` function answering each call in turn;
  - `fireInterim` takes `onDesign` and keeps every design request.

**Mocked versus live.**
- Every model answer is a stand-in: the designer, the split agents and the
  reply writer. The ledger is a stand-in, and R2 is a Map with R2's
  conditions.
- No real designer has been asked to correct itself. How often a real
  corrective attempt succeeds, what it costs and how its question reads are
  unmeasured.
- Nothing ran against production.

## Measured

- **Commits**:
  - `e19f5adf`: the recovery, facts, chat and tests;
  - `26f0080f`: the guards;
  - `241720dc`: the tests that answer the first sweep;
  - plus these records.
- **Before**, on `8180a7cf`'s code with `design-repair.mjs` supplied but
  nothing wired: **18 of 25 fail.**
  - The 7 that pass are the 4 pure cases of the supplied module and the 3
    controls.
  - The reproduction fails on the defect itself: 1 designer call where 2 were
    expected.
- **Sweep** (`scripts/mutants/build-batch-9-2026-10-08.json`): **31 of 31
  killed, and the comment-only control survived.**
  - The first pass killed 26 of 32 (the control included). Its 5 real
    survivors were answered before the second pass:
    - **the earlier answer not shown**, and **the truncated partial
      dropped**: the assertion matched "Harbour Loaf", which the brief itself
      contains. They now match a marker absent from the first request, with
      an observer;
    - **a thrown call's usage lost**: a case where the corrective call is
      itself cut off;
    - **the frontend flag lost**: the corrective call's tool is compared
      with the first call's;
    - **the recovery not kept on the resume**: the queued case now finishes
      the resume and reads its final answer.
- **Full suite**: `10133 / 10133 / 0 / 0` locally, on `26f0080f`. A first
  run on `e19f5adf` had 6 failures, all guards, each listed above. The
  sweep's test additions came after that run.
- **Required CI on `241720dc`: green.**
  - Unit tests run 37808492484: `10134 / 10094 / 0 / 40`. The total is the
    local `10133` plus the one case `241720dc` added; CI skips the browser
    cases, 3 of them new.
  - Site build run 37808492447: 8 of 8 jobs green.
- **The next image, predicted** (not built): `18d409f0090515bd`, from 200
  inputs. The new `design-repair.mjs` is copied into the image.

## Where the same recovery principle is still missing

Recorded, not started (no architecture rewrite):

- **A revise's design** still stops at the first unusable or cut-off answer.
  It could use the same `recoverDesign`, but its tool is the whole
  backend-capable one and its failure costs differ.
- **The page writer** (`write_pages`): a failed or empty answer gives the
  placeholder (`generate-failed`), told by the writer. The customer must send
  it again; there is no corrective attempt from the stored design.
  `repairPages` covers only pages that were written and do not compile.
- **The seed top-up** (`topUpSeed`): one call. A failure leaves the starter
  rows missing, told as such. It is not retried.
- **Provisioning** keeps its own write-ahead recovery (an earlier batch). Its
  failures stay technical answers.
- **No live progress during a first build's design**: the model-written
  progress recorder serves edit and add-on jobs. The recovery leaves a trace
  mark (`design-recovery`) and facts in the final answer, not a live line.
- **The question's answer re-runs the whole build**: a new first design call,
  and the earlier unusable answer is not reused.
- **The 150-second floor** is an estimate from measured design times, not a
  measurement of a corrective call.

## Remaining gaps

- **A real model's corrective attempt is unmeasured**: its success rate,
  cost, and the wording of its questions.
- **Attempt records** (`jobs/<id>.design.json`) are never deleted, like the
  other recovery objects.
- **Still open from earlier batches**:
  - picture visibility "unconfirmed" in production;
  - a narration claim never retried;
  - the add-on's 240-character cut;
  - the link count of 2;
  - P6–P11;
  - `build_debit.sql` not applied;
  - recovery objects never deleted.
- **The .txt reminder** stays recorded for later.
