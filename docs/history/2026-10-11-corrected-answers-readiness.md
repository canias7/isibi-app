# 2026-10-11 — A corrected answer takes the whole path; a step starts when what it reads has been written

Codex reviewed `4074eb38`: 157 focused tests passed and CI was green, but
two new behavioural reproductions failed while their controls passed. Both
are fixed here. The batch then took up the broad Add-on scopes. One attempt
was measured, found to prepare against unfinished prerequisites, and
reverted. What is true about those scopes is recorded in §3.

**Commits**: `79a94d3f` (the change and its tests), and the commit carrying
these records and the acceptance pin. **Image prediction**: production
`8d6dbcea93252fbb` → `c84110ecba368cb9` (205 inputs, on `79a94d3f`; was
`43652f925edb50f7`). Not built. No merge, deploy, container build, paid call,
real image, fal call, balance change or flag change. Every provider was
mocked. Build flags and the 1-page / 15-component limits are unchanged.

## 1. Finding 1: a corrected Add-on answer was only half processed

**Reproduction** (Codex): an About-page FAQ with collapsible answers.
- The first component answer names `/does-not-exist` and lists no
  requirements.
- The correction names `/about` and lists the explicitly requested
  collapsible-answer requirement.
- The page writer builds ordinary static cards.

When that valid answer came on the first call, the requirement judge ran and
the request was correctly partial, with the requirement still to do. When it
came through the correction, the judge never ran and the request said done.

**Cause.** In the designer loop, requirement grounding, suggestions, skipped
requirements, the trace mark and the stored diagnostic record were all taken
from the first answer before the cleaner's correction. Replacing `ran` with
the correction left all of that undone for the answer actually built.

**Fix** (`worker.js`, the Add-on designer loop). The cleaner reads each
answer **first**, right after the designer's call and its `needs` re-ask.
- A refused answer:
  - is marked (`rejectReply`), so no record replays it;
  - has its usage billed;
  - is kept in the stored record as superseded (`superseded: <reason>`);
  - is corrected **once**, with the cleaner's reason, through `aNeedsAgain`,
    so a correction that needs a result it was not shown is asked again with
    it, the reason kept.
- Then **one path** processes whichever answer is final: grounding and
  hand-offs, dependency needs, the question, a design of nothing,
  suggestions, skipped entries, usage, the trace and the stored record. A
  second refusal is still the answer (422, nothing applied), after its
  requirements are judged.
- **Superseded metadata is reconciled** (`carrySuperseded`,
  `builder/site-requirements.mjs`).
  - The refused answer's design, suggestions and skipped entries are
    superseded; the record keeps them.
  - A requirement it grounded in the customer's words that the correction no
    longer lists is still something they asked for. It is carried with
    `status: "unsupported"` and `superseded: true`, without its old claim of
    covering, so the judge hears it and the customer is told.
  - The same quoted words, or the same hand-off answered, is the same
    requirement, so a reworded requirement is told once.

## 2. Finding 2: a step's readiness was decided once, when the queue was made

**Reproduction** (Codex): one Look request.
- Change the Visit heading and fill its empty image frame (step 1).
- Change the unrelated Home heading, with its model answer held (step 2).
- Choose a picture for the Visit page (step 3), which reads what step 1
  writes.

Step 1 finished first, but picture selection did not start until Home
finished. With the Visit step removed and the same finished Visit page
stored, picture selection overlapped Home.

**Cause.** `stepClearAhead` checked every earlier step once, when the
preparation queue was built, and left a dependent step off the queue for
good, even after its prerequisite had applied.

**Fix** (`worker.js`, in-job step preparation). This is a shared rule for
every layer a step prepares, not a picture patch.
- Each queued step carries its **outstanding prerequisites** (`stepNeeds`):
  the earlier, non-withheld steps whose writes reach what it reads.
- At the top of every turn, every earlier turn has applied. The pool is
  refilled there (`eFill`), **before** the turn waits on anything. Each
  queued step whose prerequisites are all done is started, in turn order,
  within `STEP_AHEAD_MAX` at once. A step whose turn has begun is dropped
  from the queue and makes its own calls.
- **The updated inputs.** Each rung keeps its change in the job until the
  one publish, so the store still holds the site as the message arrived. A
  step's preparation is now handed the job's current pages (`replayPrepared`,
  `pages`), and the edit route reads them when it runs as a prepared step. It
  reads exactly what its turn will read, so its turn replays it.
- **Unchanged**: the bound; ordered, once-only writes; exact-request reuse;
  no purchase by a preparation (`buy: false`); a step never prepared before
  its prerequisites have applied.
- `stepClearAhead` is gone: it was the one-time check.

## 3. The broad Add-on scopes: what was tried, measured and kept

**Tried: design first.** An Add-on part making a new page was planned on the
page list, the look, the menu and its own tables. While an earlier part
still wrote a page, its preparation was run *design only*: picker and
designers, stopping before the page writer.

**Measured and reverted.** In the seven-task BATCH case the Add-on picker
was then asked twice, with byte-identical messages, so the request differed
in content.
- The picker and designers are shown **each page's own headline** (`labels`,
  run 28, so "the booking page" can be found by what it says), and the
  picker is shown **the site's photographs**.
- The Home heading part changed a headline ("Harbour Loaf" → "Harbour Loaf
  Bakery"), and a photo part changes the photo list.

The design stage therefore genuinely reads content those parts write.
Preparing it beside them would be preparing against unfinished
prerequisites, which the batch rules forbid; the extra call was the evidence.
The planner and wiring were reverted. **An addition making a page,
function, API or job still waits for parts that write pages.** That is a
genuine dependency through headlines and photographs, not an avoidable one.

**Kept: designers are shown only what they use** (`noteFor`,
`builder/site-add.mjs`).
- The site's photographs go to the **photo** designer only, whose `src` may
  be one of them and whose cleaner checks it.
- Each page's build ("built from") goes to frontend designers only. Schema
  designers (table, entry, function, API, schedule) are shown neither.
- A photograph placed beside a page or section designer no longer changes
  its request.

**What it would take to narrow the rest.** Two inputs, one of them a product
decision:
- Show the picker and designers stable page names instead of live
  headlines. That changes what they can match "the booking page" against.
- Give the picker the photograph list only when the request involves a
  picture.

Functions, APIs and jobs have no target kind of their own, so a part making
one is planned by its named tables (schema-only, round 9) or as the whole
site until its own routing names more.

## 4. Tests (all mocked, through the real driver, queue consumer, routes, job runner)

`test/corrected-answer.test.mjs`:
- **CA 0** control: the valid answer first; judged; partial with the
  requirement still to do.
- **CA 1**: Codex's reproduction. The judge runs on the corrected answer;
  partial with the requirement still to do; 2 calls.
- **CA 2**: a requirement only the refused answer listed is still judged and
  told, never claimed covered.
- **CA 3**: a changed requirement (same quoted words, new wording): only the
  correction's is told, once.
- **CA 4**: a correction that asks. The job waits on that question; after
  the answer the designer is asked once more, never answered from the
  refused reply; partial; 3 calls.
- **CA 5**: a correction that needs a result it was not shown. Asked again,
  shown the table **and** the reason; lands; the table made once; 3 calls.
- **CA 6**: a second invalid answer. Refused, nothing applied, its
  requirement judged first; exactly 2 calls.
- **CA 7**: duplicate delivery and restart over the reproduction. Still
  partial, 2 calls, nothing charged twice.
- **CA 8**: `carrySuperseded`'s rules.

`test/step-pool.test.mjs`:
- **SP 6**: Codex's reproduction. The picture step is prepared after the
  Visit step applied and before the held Home step finished; asked once;
  shown the frame as the Visit step left it; every change lands once; one
  photograph bought.
- **SP 6 control**: no Visit step, the finished Visit page stored. It
  overlaps Home.
- SP 0–5 still pass: the bounded refilled pool, the genuine dependency,
  reverse order, a question, a refusal, duplicate delivery and restart.
  SP 1's picture step is now prepared once its prerequisite has applied, and
  is still asked once.

**Re-anchored on the property they guard** (each had read the old
spelling):
- `site-add`'s route-order landmark: the cleaner is still handed `aSite`
  plus `today`.
- `requirement-coverage`'s HOPS test. The collect is still reached by every
  answer. The one block between the call and the collect is the correction,
  and it is asserted to hold no `continue`, `return` or `break`.
- `site-busy`'s editable-copy reader. Every edit that publishes still reads
  through the repairing reader; a prepared step publishes nothing.

## 5. Operation inventory (changes from round 9's §5)

### Inside one Edit

| Work | Now | Evidence |
|---|---|---|
| **a step waiting on earlier steps** | **started the moment they have applied, against the job's pages; within the bound** | **SP 6, SP 6 control, SP 1** |

### Inside one Add-on

| Work | Now | Evidence |
|---|---|---|
| **a corrected answer** | **the same full processing as a first answer; superseded requirements carried** | **CA 0–8** |
| **page and section designers** | **not shown photographs; schema designers not shown page builds** | SCHEMA-ONLY, BATCH (unchanged counts) |

### Between parts of one request

| Part | Planned as reading | Evidence |
|---|---|---|
| addition making a page, function, API or job | page list, theme, menu, pages, pictures — **a genuine dependency** (headlines, photographs) | BATCH, the plan's picture case |

### Remaining gaps

- **Additions making a page** wait for parts writing pages, because their
  designers read headlines and the picker reads photographs. Narrowing this
  needs the product decision in §3.
- **Functions, APIs and jobs** have no target kind; with no named table they
  are whole-site until their routing names more.
- **Build-path refusals** are not marked (a failed build replays nothing).
- **An early-refused designer** can make 3 calls in all (early, turn, one
  correction).
- **A step preparation never handed over** (its step skipped as already
  done) is unused model work, ours.

## 6. Verification

- **Red check** (this round's new tests over `4074eb38`'s product files, in a
  throwaway worktree):
  - the behaviour cases fail: CA 1 (Codex's reproduction), CA 3, CA 5, CA 7,
    CA 8 and SP 6 (Codex's second reproduction);
  - the 11 controls pass: CA 0, CA 2, CA 4 and CA 6 (where the old order
    happened to process the right answer), SP 0–5 and the SP 6 control.
- **First full suite** (before the revert in §3): `10561 / 10553 / 8 / 0`.
  - Six failures encoded the planning rule this round tried and reverted:
    PI 9, PI 10, BATCH, BATCH 2, the plan's picture case and P7 MIXED. With
    the revert they pass unchanged; BATCH is what measured the redundant
    picker call.
  - Two were landmark readers of moved code, re-anchored on the property
    they guard: `requirement-coverage` HOPS and `site-busy`. (`site-add`'s
    landmark was re-anchored before that run.)
- **Full suite** on `79a94d3f`: `10559 / 10559 / 0 / 0` (+11 over round 9's
  10548: CA 0–8, SP 6, SP 6 control).
- **Mutation sweep** (`sweep15`, 5 test files, from the committed `79a94d3f`;
  every anchor checked to occur once): 10 product mutants and a comment-only
  control. The control survived and **10 of 10 were killed**:
  - the superseded requirement not carried;
  - the correction skipping the `needs` re-ask, or losing its reason there;
  - a carried requirement keeping its claim, or matched by its wording;
  - the pool ignoring prerequisites, or not refilled at each turn;
  - a step's preparation reading the store;
  - the route ignoring the job's pages;
  - photographs shown to every designer.
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI**:
  - unit tests 38167492883 `success` on `0096c972` (the code of `79a94d3f`
    plus these records and the pin);
  - site build 38167153946 `success` on `79a94d3f`.
  - The unit run on `79a94d3f` (38167153958) was `cancelled` by the
    workflow's own `cancel-in-progress` when `0096c972` was pushed, not by a
    failure. Site build does not run on a push of documents and tests only.

## 7. Not verified live

Nothing here is deployed or pressed. These are unmeasured:
- how often real designers' corrections change their requirements;
- whether real routers name the Visit step's frame write tightly enough for
  the picture step to start right after it;
- the real gain of refilling at each turn, given real provider latency.
