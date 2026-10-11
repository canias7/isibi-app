# 2026-10-11 — Requirement identity across a correction; an addition's design separated from its page writer

Codex reviewed `7f5e753b`: 168 focused tests passed, including round 10's
corrected-answer and newly-ready-step reproductions, so those fixes are kept.
Two new request-flow reproductions showed `carrySuperseded` losing a
requirement the customer asked for. Both are fixed here, by changing what a
requirement's identity is. The batch then took up the Add-on parallel-work
gaps round 10 left open (its §3 and §5).

**Commits**:
- `c44dd774`: the change and its tests;
- `2c7e33b1`: `site-busy`'s reader re-anchored on the new label read;
- `90dc6a00`: the redundant schema-only arm of `designOnly` dropped (§6);
- the commit carrying these records and the acceptance pin. **Image prediction**: production
`8d6dbcea93252fbb` → `2b5ff083fe725602` (205 inputs, on `90dc6a00`; was
`c84110ecba368cb9`). Not built. No merge, deploy, container build, paid call,
real image, fal call, balance change or flag change. Every provider was
mocked; real images are unverified. Build flags and the 1-page /
15-component limits are unchanged.

## 1. The two reproductions

Both are FAQ additions whose first component answer is refused by the cleaner
and corrected once (round 10's path).

- **Control**: a valid first answer lists two requirements, collapsible
  answers and searchable answers. Both are judged and both are told
  unfinished.
- **Failure 1**: the refused answer lists both under one quote, "collapsible
  and searchable answers". The correction keeps only collapsible. The
  searchable requirement was dropped.
- **Failure 2**: the refused answer's collapsible requirement is
  `component#0`, and the correction's distinct searchable one is
  `component#0` too. The searchable requirement was lost.

**Cause.** `carrySuperseded` treated two things as identity that are not:
- **the quoted words**: a quote grounds a requirement in what the customer
  said; one quote can ground several requirements;
- **the id**: each attempt numbers its own entries from `#0`, so the refused
  answer's `component#0` and the correction's are unrelated.

## 2. The fix: identity is only what is established

`builder/site-requirements.mjs`, `worker.js` (the Add-on designer loop).

- **The designer says what it restates.** Every requirement item has an
  optional `replaces`: for a correction only, the id of the earlier
  requirement it restates. The correction is shown the earlier list by id
  (`supersededNote`, appended to the cleaner's reason). It is told that a
  requirement it no longer lists is still something the customer asked for,
  and that they will be told so.
- **An earlier requirement is replaced only where that is established**:
  - the correction marks it (`replaces` names its id);
  - the correction answers the same hand-off (`answers`);
  - the correction states the same need, word for word (normalised).
- **Anything else is kept.** A shared quote, a similar wording or a paraphrase
  is uncertain equivalence. The earlier requirement is carried and the judge
  hears both, so nothing asked for is dropped on a guess. The cost of a wrong
  guess here is one requirement told twice, never one lost.
- **Collision-free ids.** A carried requirement gets a fresh id,
  `<step>#s<n>`. The id is unique against the correction's own entries, every
  other designer's entries in the same addition, and the other carried
  entries. The judge's verdicts are keyed by id, so two entries can no longer
  share one verdict.
- **Hand-offs keep their reference.** A carried `elsewhere` entry stays a
  hand-off, with its step and `answers`, under its fresh id. A carried
  `covered` claim still loses its claim (`unsupported`, round 10), since the
  design it pointed at is not the one used.
- **Paraphrases.** The same sentence is not assumed to mean the same thing,
  and a different sentence is not assumed to mean something different. Only
  the designer's own `replaces`, or an identical need, settles it.

## 3. The Add-on gaps: designing separated from writing

Round 10 found that a new page's preparation genuinely waited for parts
writing pages. Its picker and designers were shown each page's **live**
headline and the site's photographs, so a heading edit or a photograph
changed their requests. Round 10 recorded that as a dependency. This round
separates what each stage needs.

- **Pages are identified by what they said when the message was read.**
  At acceptance the request records each page's label (`labels`, its
  headline, from `pageLabels`). The label goes into every Add-on part's job
  body. The Add-on route shows those labels over the stored ones, for the
  pages the part is shown (only its own pages under a scope). "The booking
  page" is still found by what the page says. Another part's headline change
  no longer changes this addition's request. A page added since has no
  recorded label, so its own label is used.
- **The picker is shown what it uses**: `noteFor("pick", …)`, so no
  photographs. Round 10 had already taken photographs off every designer but
  the photo designer, and page builds off schema designers.
- **What a new page is designed on** (`newPageDesign`,
  `builder/request-plan.mjs`). This covers an addition whose named writes are
  a new page plus sections, components, pictures, the menu or tables, and
  which declares no reads. It is planned on:
  - the page list;
  - the look;
  - the menu;
  - its own tables;
  - **what pages are built from** (`kits`, a new input).

  `kits` changes with a page's structure (a section, a component, a layout, a
  new page, a header or footer, the whole site). It does not change with the
  page's words or the photograph in an existing frame, so a text step and a
  picture step do not feed it.
- **Design only.** While an earlier unfinished part still writes page content
  (`designOnly`), the addition's preparation runs the picker and designers and
  stops right before the page writer (`aPrepStop`). The writer copies the
  pages beside the new one, so the job asks it once, against the pages as
  they then are. Exact-request reuse replays the prepared picker and designer
  answers.
- **A schema-only addition needs no such rule.** An outside connection or a
  public function always publishes, and a designer may decide to show a
  table, so each can reach the page writer. But a preparation with a table,
  function, connection or job to apply already stops before its first reserve
  and write, which is before the writer. Its writer is always asked at its
  job. A first version also stopped these parts at the writer; the sweep
  showed that arm could never be reached, and it was dropped (§6).
- **Functions, APIs and jobs have target kinds.** These are `function:`,
  `new-function:`, `api:`, `new-api:`, `job:` and `new-job:` (router
  vocabulary in `builder/site-ask.mjs`; planner in `TARGET_KINDS`, `NAMED`,
  `MADE_AS`). The schema-only rule now covers every backend kind. Such an
  addition is planned on the page list, the look, its own named targets and
  the tables it declares it reads. It no longer falls back to the whole site.
- **Unchanged**:
  - writes stay in the apply order, once each;
  - exact-request reuse;
  - the bounded pool;
  - no purchase by a preparation;
  - reuse across a question and a restart;
  - an addition that **declares** a read of a page (or a function reading a
    table an earlier part changes) still waits. That is a real dependency.

## 4. Tests (all mocked, through the real driver, queue consumer, routes and job runner)

`test/requirement-identity.test.mjs` (new). Each case checks:
- the judge's actual input (every id unique, every need present);
- the stored answer's `requirementsTold`;
- the request's final status and the parts not done;
- the reply writer's facts, the text the model writes from.

The cases:
- **RI 0** control: the valid answer with both requirements.
- **RI 1**: Codex's failure 1.
- **RI 2**: Codex's failure 2.
- **RI 3**: reordered and several requirements. The correction rewords
  collapsible, marked `replaces: component#1`, and was shown that id.
  Numbered is carried. Three requirements in all, none told twice.
- **RI 4**: a refused answer's `elsewhere` hand-off is carried as a hand-off
  under a fresh `component#s<n>` id.
- **RI 5**: a correction that asks. After the customer answers, the work
  resumes and both requirements are told.
- **RI 6**: a correction that needs a table result it was not shown. It is
  re-asked and shown the earlier requirements by id. Searchable is carried.
- **RI 7**: duplicate delivery and restart over failure 2. Distinct ids,
  nothing charged twice.

`test/corrected-answer.test.mjs`:
- **CA 3** now marks the replacement (`replaces`).
- **CA 3b** (new): the same quote with a new wording, unmarked. Both are kept
  and told.
- **CA 8** rewritten for the rules in §2.

`test/parallel-prep-paths.test.mjs`: a held **text** edit on the Visit page is
a new first task, so the overlap is not image-only.
- **R11 PAGE**: a gallery page beside the held text edit. The picker and
  designer are answered while the edit is held. The writer is asked once, at
  its job, after the edit applied. Both changes land.
- **R11 LABELS**: the earlier part changes the Visit headline. The picker and
  designer are asked once and still identify `/visit ("Come to the bakery")`.
  They are never shown the new words. The picker is shown no photographs.
- **R11 PAGE control**: the same addition declaring a read of `/visit`
  waits. Its designer is not asked while the edit is held.
- **R11 FUNCTION**: a function over a stored table, designed beside the held
  text edit and made once by its own job.
- **R11 FUNCTION control**: the same function beside a change to that table
  waits.
- **R11 JOB**: a function and its schedule, designed beside the held text
  edit and registered once.
- **R11 API**: an outside connection, designed beside the held text edit.
  Its preparation stops before its first reserve, so its writer is asked
  once, at its job, against the edited Visit page. It is
  billed in its two stages (#1 before the apply, #4 after the publish), each
  once.

**Re-read for the new behaviour** (each had encoded round 10's dependency):
- `parallel-requests` **P7 MIXED**: the addition's design is now prepared
  beside the edit. Its writer is asked once, after the edit, and shown the
  edited page.
- `parallel-plan`: a new page beside a picture is designed beside it (design
  only). Control: beside a row change, prepared whole.
- `parallel-addon-independent` **PI 9**: a new page's inputs are
  `pagelist, theme, menu, kits`; a declared read keeps the whole site.
- **PI 6**: the picker's and designer's requests show the headline as
  understood, so they are unchanged and replayed (2). The writer, whose
  input changed, is asked again. The change made in between is kept.
- **PI 11** caught a leak in the first wiring: the label snapshot showed a
  scoped part every page's label. It is now filtered to the pages the part is
  shown.
- Landmark readers re-anchored on the property they guard:
  `requirement-coverage` (the picker still gets the site, through `noteFor`)
  and `site-add` (labels, the request's over the stored).

## 5. Operation inventory (changes from round 10's §5)

### Inside one Add-on

| Work | Now | Evidence |
|---|---|---|
| **a corrected answer's requirements** | **replaced only where marked, by the same hand-off, or by the same need; everything else carried under a fresh, unique id** | **RI 0–7, CA 3, 3b, 8** |
| **the picker** | **not shown photographs** | R11 LABELS |

### Between parts of one request

| Part | Planned as reading | Evidence |
|---|---|---|
| **addition making a page** (no declared reads) | **page list, look, menu, what pages are built from, its own tables. Designed beside parts that change words or pictures; its writer waits for parts writing pages** | **R11 PAGE, R11 LABELS, P7 MIXED, the plan's picture case** |
| **addition making a function, API or job** | **page list, look, its named targets and declared tables; designed beside unrelated edits, and any page writer it reaches is asked at its job** | **R11 FUNCTION, R11 JOB, R11 API** |
| addition declaring a read of a page, or of a table an earlier part changes | the whole site / that table — **a real dependency, waits** | R11 PAGE control, R11 FUNCTION control |

### What still creates a dependency, honestly

- **A new page's writer** reads the pages beside it, so it waits for any
  earlier part writing a page's content. This is the one stage that truly
  copies those pages.
- **A part that changes a page's structure** (a layout tweak, a section, a
  component, a header or footer) feeds `kits`. A new page's design waits for
  it.
- **A routing that names no targets** is still the whole site until its own
  routing names more (round 9's discovery).
- **A schema-only addition's apply and its writer** are the job's: its
  preparation stops before its first reserve and write.

### Remaining gaps

- **Labels are taken at acceptance.** A page renamed between two messages is
  identified by its new headline only from the next request. A request
  accepted while its source read fails has no labels and uses the stored
  ones, which is round 10's behaviour.
- **Uncertain equivalence errs toward telling twice.** A real designer that
  restates a requirement without marking `replaces`, and with different
  wording, gets both told. Whether real designers mark it is unmeasured.
- **Build-path refusals** are still not marked. An early-refused designer can
  still make 3 calls. A step preparation never handed over is still unused
  model work. All three are carried from round 10.

## 6. Verification

- **Red check** (this round's new and changed tests over `7f5e753b`'s product
  files, in a throwaway worktree, with `designOnly` stubbed):
  - **17 fail**:
    - both reproductions: RI 1 and RI 2;
    - RI 3, RI 4, RI 6, RI 7;
    - CA 3b and CA 8;
    - R11 PAGE, LABELS, FUNCTION, JOB and API;
    - P7 MIXED, PI 6, PI 9, and the plan's picture case.
  - **Controls pass**: RI 0, RI 5, CA 0–7 but 3b, the R11 PAGE control and
    the R11 FUNCTION control. 92 of 109 tests pass in all.
- **First full suite** on `c44dd774`: `10575 / 10574 / 1 / 0`.
  - The one failure was `site-busy`'s count of bare source reads (7 → 8).
    The eighth is the request's label read at acceptance, which only reads
    headlines and never publishes or edits.
  - It is re-anchored on that read by name (`2c7e33b1`).
- **Mutation sweep** (`sweep16`, 8 test files, from the committed
  `2c7e33b1`; every anchor checked to occur once): 19 product mutants and a
  comment-only control. The control survived. **17 of 19 were killed**:
  - a correction's `replaces` mark ignored, or the same need not compared;
  - a carried entry keeping its old id, or ignoring the ids passed in;
  - a hand-off carried as unsupported;
  - `replaces` not cleaned;
  - the correction not shown the earlier ids;
  - the label snapshot ignored, not stored, not handed to the job, or shown
    beyond a scoped part's pages;
  - the picker shown photographs;
  - design-only not passed or not stopped;
  - a text step feeding `kits`;
  - a new page planned on the pages and pictures;
  - the function target kind removed.

  **Two survived, each examined:**
  - **`carry-ignores-other-ids`** (the worker not passing the other
    designers' ids to `carrySuperseded`). This is equivalent today. A carried
    id is `<step>#s<n>`, and each step's designer runs once per addition, so
    another designer's entries never share a step prefix. The rule itself
    (taken ids are avoided) is killed in CA 8. The wiring is kept as a guard
    for the day a step runs twice.
  - **`schema-only-writer-runs`** (`designOnly` without its schema-only arm).
    This was unreachable: a preparation with a schema to apply stops before
    its first reserve, which is before the writer (`worker.js`, the backend
    block). The arm was dropped (`90dc6a00`), and §3 and §5 above say so.
- **Full suite** on `90dc6a00`: `10575 / 10575 / 0 / 0` (+16 over round 10's
  10559).
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI**: __CI__

## 7. Not verified live

Nothing here is deployed or pressed. These are unmeasured:
- whether real designers mark `replaces` when they restate a requirement;
- whether real routers name `new-function:` / `new-api:` / `new-job:`
  targets for such additions;
- the real gain of designing a new page beside an edit, given real provider
  latency.
