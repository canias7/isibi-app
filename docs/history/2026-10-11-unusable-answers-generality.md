# 2026-10-11 — An answer that arrived is not one that can be given again; the generality gaps closed

Codex reviewed `648964d5`, passed 111 focused tests and confirmed CI green.
**Closed as fixed offline**: the independent-function wait (SCH 1), the
ready-component wait (SCH 2) and successful-answer reuse across a question
(SCH 4, PI 30, PI 31, PL 2). Codex then reproduced a continuation bug, fixed
first here, and the batch went on to the documented generality gaps.

**Commits**: `a87060ba` (the change and its tests), `7b9d77f4` (acceptance
pin), with records after. **Image prediction**: production
`8d6dbcea93252fbb` → `494735051df65e57` (205 inputs, on `a87060ba`; was
`4b8665dd0256e3f9`). Not built. No merge,
deploy, container build, paid call, real image, fal call, balance change or
flag change. Every provider mocked. Build flags and the 1-page /
15-component limits unchanged.

## 1. The bug: a cut-off reply kept and replayed

One Add-on, an independent table and a FAQ component, both `uses: []`. The
table's designer asks whether to keep an email address; beside it the
component's designer answers with a provider reply cut off at
`stop_reason: max_tokens`. The first job rightly waits for the table's
answer, but its `.kept.json` held the cut-off reply with the rest. After
"No", the table's designer ran again, and the component's identical request
was answered from that record. The request failed, and that designer was
never asked again. Codex's control (only that cached reply removed): both
changes complete, the table made once.

**Cause.** The record, stage and replay path treated "the transport returned"
as "this answer can be given again". It never judged the reply itself.

**Fix, at the one boundary every recorded answer passes**
(`builder/prepared.mjs`):
- `unusableReply(reply)` says why a reply cannot be given again, reading its
  shape and stop reason only:
  - unfinished: `max_tokens`, `pause_turn`, `model_context_window_exceeded`,
    or a raw `finish_reason: "length"`;
  - an error body;
  - content that is not a list, or a tool call whose input is not an object;
  - not a reply at all.
  A complete answer keeps its meaning, whatever it says: a design, a question
  back, a refusal, prose that changes nothing.
- **Recorded**: the recorder keeps such a reply *with its verdict*
  (`unusable`), for diagnosis, and it is never replayed.
- **Read**: `readPrepared` leaves out every entry marked unusable, *or judged
  unusable now*, so records stored before this rule are covered. It names
  each one in `discarded` (`{ h, why }`). Every reader goes through it: a
  job's staging, its replayer, and the next job's staging of what this one
  kept (`stageKept`).
- **Staged only from a job that paused** (`stageKept`): it ended on the
  customer's question (`clarify`) or on a purchase nobody could tell
  (`uncertain`). Every answer such a job kept was accepted or never read by
  its step. A job that ended any other way may have failed *because of* one of
  its complete-looking answers, and nothing says which, so its answers are
  never staged and the next run asks again.
- The call is then made again through the job's own reserve and limits, as
  any call with no recorded answer is. Nothing else is retried. The `.kept.json`
  files are never rewritten, so the diagnostic history stays.

## 2. The generality gaps (shared rules, no task-name exceptions)

**a. Ready work past a question.** When an addition's loop ends on a
designer's question (`aAskedBy`), every designer that neither is that
designer nor uses its result keeps going. It starts as its inputs become
ready, and its answer is kept with the job. The step then waits for all of
them, round after round, as each answer readies the next. The customer's
answer resumes only the asker and what uses it. Any other ending (a
failure, a refusal) still starts nothing more (`aLoopDone`).

**b. Schema-only additions write no page.** A table's designer names the page
that lists or collects it (`shows`), and is now told to leave that out only
when nothing should (storage asked for by itself). `pageless` treats a table
as needing no page when it names none AND its own access lets nobody on the
site read it or write to it (`resolveAccess`: read `none`, write `none`), like
scheduled jobs and internal functions. Then there is no page writer, compile
or publish; the schema is applied directly on the existing pageless path.
The access is a structural fact: no page could list or collect such a table.
The missing field alone is not trusted: the first draft used it, and the full
suite showed tables visitors submit to without a `shows` that still need
their form (`addon-route` COLLISION/BYPASS, `addon-failure-outcome` ROUTE 5,
`mixed-work`, `site-add`).

**c. Named Look, Rules and Page changes consume scoped inputs.**
- *Rules*: a rule change the router named for tables (`data:x`, no reads)
  now has a declared scope (`prepScope`), carried by its job body exactly as
  a data change's is. Its step is shown those tables only, the rest by name
  (`runRulesEdit` → `scopedData`). It may answer `needs`, and is then asked
  again with every table, both calls billed. A scoped answer can name only
  its tables.
- *Look*: the picker is shown the site's name and page list, and each value
  lane its own field. When every named write is the look itself (`theme`,
  `identity`) or a named page, the part is planned as reading only those plus
  the page list (`lookInputs`).
- *Page*: a change named for one page is first asked of the tweak, which is
  shown that page's file only, so it is planned as reading that page and the
  page list (`pageInputs`). A rewrite fallback (shown the pages beside it, to
  copy their design) whose siblings changed meanwhile is asked again by its
  job's exact-request check.

**d. A multi-step Edit prepares its steps' model work together.** The steps
still write in turn, in the load-bearing order. Before the loop, each later
step that makes model calls (`text`, `picture`, `nav`, `page`, `data`,
`rules`, at most 3) is prepared beside the earlier steps. It goes through
the very route a request part's preparation uses (`replayPrepared`), with its
own layer, page, words and answers:
- every call is recorded;
- nothing is written, charged or bought (`buy: false` — a step's picture is
  bought by the step itself, once, through the job's own guard).

When its turn comes, what it recorded joins the job's replayer
(`replayer.add`). An exact request is answered from it and billed once, by
this job. A request the earlier step changed is made fresh.

**Only steps that are clear ahead** (`stepReach`, `stepClearAhead`): the
request planner's rule, one level down. A later step is prepared only when
no earlier step writes anything it reads:
- a page step reaches its page;
- a text or picture step reaches the pages its own scoped ops name (`on`),
  or every page;
- the menu reaches every page;
- data and rules reach the tables;
- the look's values step reaches the whole site (renaming the business
  rewrites its name on every page).

**Shown the same answers as its turn**: the full answer list with the step's
own indices (`told`), so its requests are byte for byte its turn's.

The first draft prepared every later step. The full suite showed what that
costs:
- a page step later merged into an earlier one was prepared for nothing
  (`edit-page-once`);
- a picture step on a page an earlier step rewrote was asked again
  (`edit-removal-door`);
- answers shown as a subset changed the clarification transport's request
  (`live-clarify-limits`).

**e. The last writer stage that could not ask.** The Add-on's page writer is
offered the question form (`SITE_PAGES_TOOL_ASK` in `addon` mode). It may
ask before anything is applied: the schema waits for the compile and the
publish for both, and the first reserve is refunded as on any answer that
ships nothing. The question names its asker (`add:pages`), so the picker and
designers are not shown the answer and are replayed. Only the writer is
asked again.

## 3. Tests (all mocked, through the real driver, queue consumer, routes, job runner)

`test/continuation-unusable.test.mjs` (new):
- **UA 0** the boundary: which replies can be given again, the verdict kept
  with the record, records stored before the rule read under it, replay
  counts exact.
- **UA 1** Codex's reproduction. After "No": picker 1, table 2, component 2;
  both land; the table made once; the cut-off reply still in the first job's
  record, marked; nothing charged twice.
- **UA 2** the same with every kept record rewritten into the earlier format
  (no verdict).
- **UA 3** a usable page design beside the cut-off FAQ: the page replayed
  (1 call), the FAQ and the table asked again.
- **UA 4a** a kept answer is checked against what its call read: another
  writer changes the About page's text (which the designer is not shown).
  The design is replayed (1 call), and the page writer writes onto the page
  as it now is.
- **UA 4b** a kept answer whose own input changed: a page added to the
  list, which the designer is shown, so it is asked again.
- **UA 5** duplicate delivery and restart: every message after the answer
  delivered twice at once, then every message the request ever sent
  delivered again. Still 2 calls to each designer, the table made once,
  nothing charged twice.
- **UA 6** the Edit equivalent: the name lane asks while the description
  lane's reply is cut off. After the answer, both lanes are asked again
  (2 each) and both land.

`test/parallel-readiness.test.mjs`:
- **SCH 5** (now ready work past a question): the table asks while a slow
  page designer is out and a component uses the page. The page's answer is
  kept, and the component is designed before the step asks. After the
  answer, only the table is asked again: page 1, component 1, picker 1.
- **SCH 6**: a step that fails starts nothing more; the component is never
  asked.

`test/parallel-generality.test.mjs` (new):
- **GN 1** a table asked for as storage alone: made; no page writer;
  every page unchanged. **GN 1 control**: a table a page shows runs the writer
  once.
- **GN 5** a two-step look change (a page tweak and a photograph): the
  later step's `choose_pictures` meets the earlier step's tweak; each is
  called once; both land; one picture bought.
- **GN 5b** control: the earlier step writes the page the picture step works
  on, so the picture step is not prepared (a genuine dependency waits). Its
  one call is made after the frame changed and is shown it as it now is.
- **GN 6** the add-on page writer asks. Nothing is applied, and the question
  names `add:pages`. After the answer: picker 1, designer 1, writer 2 (shown
  the answer); lands; nothing charged twice.

`test/parallel-prep-paths.test.mjs`:
- **GN 2** a named look (`identity`) is prepared while a photograph is placed
  on the home page.
- **GN 3** a named rules change (`data:loaves`) is prepared while a row of
  another table changes. It is shown loaves only (hours named as not shown),
  and both changes are kept.
- **GN 3b** a scoped rules answer that says `needs` is asked again with
  every table; the second answer is the one applied.
- **GN 4** a named Visit page change is prepared while a photograph is
  placed on the home page; its tweak is shown the Visit file only.

Revised:
- **BATCH** (`parallel-batch`): the About page's tweak is now prepared
  beside the first task's job (it was asserted to wait). The once-per-call
  check confirms its job replayed it.
- **readPrepared keys** (`parallel-plan`): the new `discarded` field. A keyed
  entry with no reply is named `not-a-reply`.
- **list sort, three pages (job)** (`edit-list-sort`): the same calls in any
  order across the two page steps. The /menu step is prepared beside the /
  step; each call is still made once.
- **prepScope** (`prepared-scope`): a rules change named for a table is
  narrowed to it; a rules write beyond tables, or naming nothing, is not.
- **the writer contract** (`live-clarify-contract`): the first build's and a
  revise's page requests are still pinned byte for byte. An add-on's writer
  is offered the question, and its request with the plain tool put back is
  the pinned bytes.

The fixture (`request-flow.mjs`) can answer with a raw provider reply
(`{ __raw }`) and read or write stored objects (`objectKeys`, `readObj`,
`writeObj`).

## 4. Operation inventory: what overlaps, what waits, what is still a gap

**Overlaps** means the model work of independent tasks runs at the same
time, proven by a rendezvous or held-gate test. Writes are applied one job
at a time, in dependency order; a reused answer is accepted only by exact
replay.

### Between parts of one request

| Part | Planned as reading | Evidence |
|---|---|---|
| text / data, named | their pages / tables (`prepScope`) | IND 1–8, PI 29 |
| **rules, named** | **its tables (`prepScope`), shown only them, `needs` widens** | **GN 3, GN 3b** |
| **look, named (`theme`/`identity`/pages)** | **page list, theme, its named pages** | **GN 2** |
| **page, named one page** | **page list and that page** | **GN 4, BATCH** |
| addition on existing named pages | page list, theme, its pages (`addonScope`) | PI 2, PI 3, PI 29 |
| photograph | pictures | P1 |
| menu | menu, page list | PC 2, PC 3 |
| addition making a table/function/API/job/page | page list, theme, menu, pages, pictures | — (gap below) |
| logo | the whole site | — (necessary: it rewrites the shared frame) |

### Inside one Add-on

| Work | Now | Evidence |
|---|---|---|
| independent designers | together, each shown only what it uses | PI 24, SCH 1 |
| a designer using another's result | starts as soon as that result is ready | SCH 2, SCH 3 |
| **ready designers when another asks** | **keep going; answers kept** | **SCH 5** |
| a designer that failed | nothing more started | SCH 6 |
| **table nothing shows** | **no page writer, compile or publish** | **GN 1** |
| **page writer asks** | **asks; only it is asked again** | **GN 6** |
| apply: provision → schema → publish | in order (writes) | existing |

### Inside one Edit

| Work | Now | Evidence |
|---|---|---|
| look-door lanes | together; when one asks, the others finish and are kept | PL 1, PL 2 |
| **later steps of a multi-step edit** | **model work prepared beside earlier steps; writes in turn** | **GN 5, GN 5b** |

### Continuation (every path)

| Rule | Evidence |
|---|---|
| a cut-off, paused, error or malformed reply is never replayed (recorded, staged, read, replayed; stored records too) | UA 0–3, UA 6 |
| a kept answer is reused only on its exact request (what it read) | UA 4a, UA 4b |
| staging only from paused jobs; idempotent under redelivery | UA 5, PI 31 |

### What legitimately waits

- Writes, one job at a time (site lock, one publish per job).
- A task that consumes another's output: a component on a new page, a
  function over a new table, a job running a new function.
- An addition is applied whole; a question pauses its apply.
- The logo step, which rewrites the frame every page shares.
- The steps of one edit apply in their load-bearing order: values before page
  source.

### Remaining implementation gaps

- **An addition that makes a table, function, API, job or page, as its own
  part,** is still planned as reading every page and picture. Inside the
  step it no longer writes pages it does not need (GN 1), but the planner
  cannot know before the picker runs whether a page will be written.
- **A page rewrite** (the tweak's fallback) is shown its siblings in full; a
  design summary would let an unrelated sibling edit leave it standing.
- **An unnamed look, rules or page change** (no router targets) is still
  planned as reading the whole site.
- **In-job step preparation** covers at most 3 later steps, and only steps
  whose layer makes model calls. A step's preparation that is never handed
  over (a step skipped as already done) is unused model work, ours.
- **Semantic unusability**: an answer complete at the provider but rejected
  by its step (e.g. a tool input missing a required field) is not marked
  unusable at the boundary. That is covered by staging only from paused
  jobs: a job that fails on it is never replayed. A step that reads such an
  answer and then pauses for a question remains possible, but its step has
  already rejected it in that job.

## 5. Verification

- **Red check** (this round's tests over `648964d5`'s product files, in a
  throwaway worktree):
  - every new behaviour case fails: UA 0, 1, 2, 3, 5, 6; GN 1, 2, 3, 3b, 4,
    5, 6; SCH 5;
  - the controls pass: UA 4a and 4b (reuse is already exact), the GN 1
    control, GN 5b, SCH 6, the existing PATH cases and SCH 1–4.
  14 fail, 21 pass.
- **First full suite** (before the corrections in §2b and §2d): 19 failures,
  each traced to a cause:
  - the field-only pageless rule, now grounded in access;
  - steps prepared that were not clear ahead, or shown a subset of their
    answers, now `stepReach`/`stepClearAhead`/`told`;
  - three tests that encoded rules this round changes (call order,
    rules never narrowed, the add-on writer offered no question);
  - one source-window guard whose ceiling the new `on` line crossed,
    re-anchored with its measurement.
- **Mutation sweep** (`sweep13`, 15 test files, from the committed
  `a87060ba`): 21 product mutants and a comment-only control. The control
  survived and 20 were killed.
  The one survivor is *staging from any earlier job*, not only paused ones.
  Across these files every re-run part's earlier job paused (measured in
  round 7 by logging every earlier job's ending), so no current path reaches
  it. It is kept as the guard against replaying an answer a failed job may
  have failed on.
- **Full suite** on the committed `a87060ba` (with the pin): `10532 / 10532 / 0 /
  0` locally (`10514` at `648964d5`: round 7's 10513 plus SCH 5, added in its records;
  +18 here: UA 0, 1, 2, 3, 4a, 4b, 5, 6; GN 1 and its control, GN 2, GN 3,
  GN 3b, GN 4, GN 5, GN 5b, GN 6; SCH 6).
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI** on `7b9d77f4` (the code of `a87060ba` plus the pin): unit
  tests 38158754597 `success`, site build 38158754632 `success`.

## 6. Not verified live

Nothing here is deployed or pressed. These are unmeasured:
- how often real providers cut replies off beside a question;
- whether a real table designer leaves `shows` out only when it should;
- whether real routers name look, rules and page targets often enough for
  the scoped plans to apply;
- how often an in-job step preparation matches its turn exactly;
- whether a real page writer asks only when it should.

Provider concurrency limits are not measured. The universal feature stays
unfinished.
