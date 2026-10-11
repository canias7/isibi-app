# 2026-10-11 — An answer its step refused is never given again; a refilling step pool; schema-only parts

Codex reviewed `fb50298e`, independently passed 203 focused tests and
confirmed CI green. **Closed as fixed offline**: the provider-truncation
replay finding (round 8, `a87060ba`). Codex then reproduced two more
findings. Both are fixed here first, and the batch then closes the
broad-scope gaps where that was practical.

**Commits**: `00ee1c40` (the change and its tests), `3e5d1a4b` (the
recorder entry keeps only `h` and `reply` as fields; a source landmark
re-anchored), and the commit carrying these records and the acceptance pin. **Image prediction**: production `8d6dbcea93252fbb` → `43652f925edb50f7`
(205 inputs, on `3e5d1a4b`; was `494735051df65e57`). Not built. No
merge, deploy, container build, paid call, real image, fal call, balance
change or flag change. Every provider was mocked. Build flags and the
1-page / 15-component limits are unchanged.

## 1. Finding 1: a complete answer its step refused was replayed

One Add-on asked for an independent table and an About-page FAQ, both
`uses: []`. The table's designer asks a question. Beside it, the component's
designer returns a **complete** tool response that places the FAQ on
`/does-not-exist`. That reply passes the provider-level check
(`unusableReply`: it finished, and its input is an object). The component's
cleaner (`cleanAdd`) then refuses its page (`no-page`). After the table's
question is answered, the component's identical request was answered from
the kept record, refused again with no new call, and the request failed.
Codex's control removed only that cached reply: the next call was valid and
the request completed. The paused-job filter (round 8) does not protect this
case, because a paused job can hold *another* task's refused answer.

**Cause.** Reuse was decided by the reply alone (it arrived and finished)
and by the request bytes (identical). It never asked whether the step that
read the reply could use it.

**Fix: the step's own validation gates reuse, at the shared boundary**
(`builder/prepared.mjs`).
- `rejectReply(reply, why)` lets the step that validates a reply mark it
  when it refuses it. The mark is held by reply identity (a `WeakMap`). The
  reply object travels unchanged through the transport, `clarifyTransport`,
  the recorder and the replayer, so the mark reaches whatever recorded it.
- The recorder's `unusable` verdict is now read when the record is written.
  It is the provider verdict, or `rejected:<step>:<reason>`. So a reply
  refused *after* it was recorded is still written with its verdict. The
  verdict is a non-enumerable getter written by the entry's own `toJSON`,
  so an entry's fields stay its fingerprint and its answer.
- `readPrepared` already leaves out every entry with a verdict and names it
  in `discarded`. A refused answer is therefore kept for diagnosis and never
  staged, replayed or handed to a continuation: not in this job, not in a
  later job, and not from an early answer. The `.kept.json` files are never
  rewritten.

**Where the add-on marks it** (`worker.js`, every add-on kind, through the
one cleaner):
- **An early answer** (`aLanded`): a designer that ran beside the others and
  whose answer the cleaner refuses is marked. It is never ready early, and
  its turn decides it.
- **At its turn**: a refused answer is marked, and the designer is asked
  **once** more with a structured reason. That reason is the cleaner's own
  customer sentence plus its code, e.g. *"That page isn't on the site
  (no-page)"*, sent through `runAdd({ feedback })` → `addRequest`'s
  *"YOUR LAST ANSWER COULD NOT BE USED, so nothing of it was built: … Answer
  again with that put right. If what they asked cannot be done on this site,
  design nothing; if it depends on something only they can tell you, ask
  them."* Both calls are real work and both are billed by the job's own
  reserve. The second answer then goes through the normal path:
  - usable: it is applied;
  - a question: the job pauses on it as any question does;
  - nothing designed: declined;
  - refused again: the addition is refused exactly as before (422, no
    cost). **There is never a third call.**
- **Never retried, never marked**: the model's own answers. A design of
  nothing (`nothing`) is the model declining, and it stays replayable: asked
  early beside a question, it is given again from the record. A question and
  a no-op are also its answers.

**Edit lanes and the page writer.** These follow from existing rules and
are pinned, not changed:
- In a multi-step edit, a step's prepared answer is that step's one call, so
  a refusal at its turn is exactly the refusal of an answer made then (SP 4).
- When a step asks, `askRemainder` resumes only the asking step's words, so
  a sibling whose answer was refused is never re-run from the record (SP 3).
- The add-on page writer runs last, after every designer, so nothing it
  writes is kept across another stage's question.

## 2. Finding 2: `STEP_AHEAD_MAX` capped how many steps were prepared

One Look/Edit request with six independent page-heading tweaks, each on its
own page. Step 1 was held while steps 2–4 were prepared beside it. They
finished, and steps 5 and 6 never took the freed places: they started only
when step 1 finished (red check: `start home, menu, visit, story; end menu,
visit, story; end home; start order …`). The constant limited the total
number of steps selected for preparation, not the number running at once.

**Fix** (`worker.js`, the in-job step preparation): a bounded pool.
- Every step that is clear ahead goes on a queue: a dispatched model-calling
  layer, not withheld, not a removal or rename, and nothing earlier writes
  what it reads (`stepClearAhead`).
- At most `STEP_AHEAD_MAX` (3) preparations run **at once**. When one
  finishes, `fill()` starts the next queued step whose turn has not begun.
- A step whose turn comes before its preparation started is skipped by the
  queue (`i <= eStepAt`) and makes its own calls. So no step is ever asked
  twice.
- Unchanged: application in order, one step at a time; each prepared call
  replayed only on its byte-identical request; no picture bought by a
  preparation (`buy: false`); the job's locks, reserve, recovery and
  publication gates.

## 3. The broad-scope gaps

- **Schema-only request parts** (`builder/request-plan.mjs`, `schemaOnly`).
  An addition whose every router-named write is a table (`data:` or
  `new-data:`) and which declares no reads is planned as reading the page
  list, the look and **its own tables by name**. Before, it read every page,
  the menu and the pictures. So it no longer waits for a part that writes a
  page or a picture, or that changes another table's rows.
  - The table designer (and the entry, function, API and schedule
    designers) is no longer shown the site's photographs or each page's
    kit list (`noteFor` in `builder/site-add.mjs`). It never used them, and
    a photograph placed beside it changed its request, so the prepared
    answer was asked again for nothing (measured: the second request
    differed only in the *"Its own photographs"* line).
  - A designer that decides a page should show the table makes its page
    writer read pages no plan promised. The job's exact-request check asks
    that writer again, never this plan.
- **Page rewrites and sibling text.** Already page-scoped, now pinned. The
  page rung's rewrite runs `priorPagesBlock` in mode `"page"`: that page's
  source, and the other pages **by name only**. A sibling page's words
  changing between preparation and job leaves its request unchanged, so the
  prepared answer is applied (REVALIDATED control). The planner comment that
  said a rewrite is shown its siblings in full was wrong, and is corrected.
- **Missing targets.** Already handled by model discovery, now pinned. A
  part the first routing named no targets for is taken to touch the whole
  site. Its own routing call (which may run early: a routing writes nothing)
  names its targets, `addTargets` adopts them, and from then its step is
  prepared as a named part (DISCOVERED). A part whose own routing still names
  nothing stays whole-site and runs in order. Nothing is guessed from words.

## 4. Tests (all mocked, through the real driver, queue consumer, routes, job runner)

`test/validation-reuse.test.mjs`:
- **VA 0**: the mark travels with the record. A reply refused after it was
  recorded is written with `rejected:add:no-page` and read back as
  discarded; the unrefused reply beside it is kept.
- **VA 1**: Codex's reproduction. Table 2 calls, component 2, picker 1;
  both land; the table is made once; the refused reply is kept with its
  verdict; nothing is charged twice.
- **VA 2**: one correction at the step's own turn. The second request
  carries the reason, the first does not; the FAQ lands.
- **VA 3**: a second refusal is the answer. Exactly 2 calls, the page
  untouched.
- **VA 4**: the model's own refusal (nothing designed) gets 1 call; a
  question gets 1 call and is kept.
- **VA 5**: duplicate delivery and restart over the reproduction. Every
  message after the answer is delivered twice at once, then everything is
  delivered again: still 2 and 2 calls, the table made once.
- **VA 6**: a no-op answered early is still the answer. It is never marked
  refused and never asked again.

`test/step-pool.test.mjs` (six heading tweaks on six pages):
- **SP 0**: Codex's reproduction. With step 1 held, steps 5 and 6 start
  before it finishes; at most 3 preparations at once; every heading lands;
  each tweak is asked once.
- **SP 1**: a genuine dependency waits. A picture step on the Visit page,
  which the Visit heading step writes, is asked once, after that step, and
  shown the frame it left; the independent steps are prepared.
- **SP 2**: preparations finishing in reverse order still apply in order,
  each asked once.
- **SP 3**: a prepared step asks. The question is asked once, not twice;
  only that step is asked again after the answer, with the resumed request
  its own words; every heading lands.
- **SP 4**: a prepared answer its step refuses is refused at its turn,
  asked once, its page unchanged, the others landed.
- **SP 5**: duplicate delivery and restart. Each tweak is asked once, each
  heading lands once, nothing is charged twice.

`test/parallel-prep-paths.test.mjs`:
- **SCHEMA-ONLY**: a storage-only table is designed while the home page's
  photograph is bought, answered once, made once, and no page writer is
  asked.
- **REVALIDATED control**: a sibling's words changed between preparation and
  job; the rewrite is asked once and both changes are kept.
- **DISCOVERED**: a part with no first-routing targets takes `identity` from
  its own routing and is prepared beside the photograph's job.

## 5. Operation inventory (changes from round 8's §4)

### Between parts of one request

| Part | Planned as reading | Evidence |
|---|---|---|
| **addition writing only tables** | **page list, theme, its own tables** | **SCHEMA-ONLY, PATH add-on row** |
| **part with no first-routing targets** | **whole site until its own routing names them** | **DISCOVERED** |
| addition making a page, function, API or job | page list, theme, menu, pages, pictures | — (gap below) |

### Inside one Edit

| Work | Now | Evidence |
|---|---|---|
| **later steps of a multi-step edit** | **bounded pool of 3 at once, refilled as each finishes; writes in turn** | **SP 0–5, GN 5, GN 5b** |

### Continuation (every path)

| Rule | Evidence |
|---|---|
| **a complete answer its step refused is never replayed (early, at its turn, from a kept record); one correction with the step's reason; a second refusal is final** | **VA 0–5** |
| **the model's own refusal, question and no-op are never retried or marked** | **VA 4, VA 6** |

### Remaining implementation gaps

- **Additions making a page, function, API or job** are still planned as
  reading every page and picture. Functions and jobs read the stored schema;
  a page reads the pages beside it. Not narrowed here: a function's designer
  may name a page.
- **Rejection marks cover the add-on designers** (every kind, through
  `cleanAdd`). Edit lanes reach the same result through the rules in §1. The
  Build path's design and page calls are not marked; their refusals end the
  build, and nothing of a failed build is replayed.
- **The correction is one re-ask per designer turn.** A designer refused
  early and then refused at its turn gets that one correction, so 3 calls in
  all (early, turn, correction). The early call is the parallel work a
  question did not block.
- **A step preparation that is never handed over** (its step skipped as
  already done) is still unused model work, ours.

## 6. Verification

- **Red check** (this round's tests over `fb50298e`'s product files, in a
  throwaway worktree): exactly the new behaviour cases fail, VA 0, 1, 2, 3
  and 5, SP 0 and SCHEMA-ONLY (7). The 22 controls pass: VA 4, VA 6, SP 1–5,
  REVALIDATED control, DISCOVERED and the existing PATH and GN cases. SP 0's
  log on the old code: `start home, menu, visit, story; end menu, visit,
  story; end home; start order`.
- **First full suite** (on `00ee1c40`): `10548 / 10546 / 2 / 0`. Both failures
  were caused by this change and are fixed in `3e5d1a4b`:
  - `prepared-scope` requires a record entry's fields to be `h` and `reply`
    only, and the new verdict getter was enumerable. It is now
    non-enumerable, written by `toJSON`.
  - `site-add`'s route-landmark test read `const clean = cleanAdd(…)`, which
    is now `let` for the one correction. The test is re-anchored.
- **Full suite** on `3e5d1a4b`: `10548 / 10548 / 0 / 0` (+16 over round 8's
  10532: VA 0–6, SP 0–5, SCHEMA-ONLY, REVALIDATED control, DISCOVERED).
- **Mutation sweep** (`sweep14`, 5 test files, from the committed
  `3e5d1a4b`; every anchor checked to occur once): 13 product mutants and a
  comment-only control. The control survived and 12 were killed. The one
  survivor is *a step whose turn began is still taken by the pool*
  (`i <= eStepAt` removed). It is unreachable today: the queue is in turn
  order, a turn awaits its own preparation, and each finished preparation
  starts the queue head before the next turn begins, so a queued step is
  always started before its turn. It is kept as the guard against a step's
  call being made twice.
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI**: on the records commit (pending at writing; read and stamped in the next commit).

## 7. Not verified live

Nothing here is deployed or pressed. These are unmeasured:
- how often real designers answer with a destination the site does not
  have, and how often one correction puts it right;
- how much a real six-step edit gains from the refilled pool, given real
  provider latency;
- whether real routers name only tables for storage-only additions often
  enough for the narrowed plan to apply.
