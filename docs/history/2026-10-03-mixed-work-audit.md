# The mixed-work audit: many changes from one message (2026-10-03)

On the owner's word, for review: **an audit and tests only** — nothing
implemented, merged or deployed; no container built; no model called;
nothing spent; Build untouched. The remaining information-limits batches
(2–4) are **paused** at the owner's word. The report, with the capability
matrix, the findings, the untested cases, the real-model batch and the ranked
fixes, is `docs/investigations/mixed-work-audit.md`; this file is the record
of how it was made and what was measured.

## 1. The order

> Pause the remaining information-limits batches. Our next priority is
> whether the builder can complete many different requested changes together
> across Edit and Add-on. Audit and test the existing implementation end to
> end, covering every supported edit operation and add-on kind, using the
> actual registered capabilities rather than assuming a list is complete …
> Distinguish clearly between several tasks completed from one user message,
> several model calls, and tasks actually running concurrently. Build one
> consolidated capability matrix … Use grouped, focused tests through real
> production routes with supplied model answers to establish execution
> behavior without paid calls. For every scenario, compare requested
> operations and targets against actual changes, publication, pending work,
> failures and the final customer-visible reply … Separately prepare a
> compact real-model test batch … do not run paid calls until approved …
> Record one consolidated report with proven capabilities, concrete
> reproduced failures, untested cases, and the smallest grouped fixes ranked
> by how much mixed-request capability they unlock. This round is audit and
> testing only: do not implement new fixes, merge, deploy, or change first
> Build. Finish with a plain-English answer to "What different things can
> our builder do together from one message today, and what specifically
> prevents it from doing more?"

## 2. How it was done

1. **The registered capabilities, from the code**: `EDIT_LAYERS` (9),
   `LANE_FIELDS` (21) with each lane's rung (`laneLayer`, `OWN_LANES`,
   `laneEscalate`, `laneVerbs`), `MAX_LANES` (4), `ADD_KINDS` (12) with
   `DISPATCHED_ADDS`, `MAKES_PAGES`, `BACKEND_ADDS`, and every per-message
   count. The first case of the new file pins them, so the matrix cannot
   drift from the code silently.
2. **The flow, read in the code**: the router's whole-message rule and
   `alsoAsked`; the look door (`pickLanes`, scopes, lanes into steps,
   `mergePageSteps`, `pageStepDone`); the step loop ("RUN EVERY STEP IN
   TURN", `worker.js` 26341); the shadowed publish (`publishStep`, 22293) and
   the one publish (26469); billing (`eCharge`, the picker billed once); the
   hand-overs between Edit and Add-on (W15 escalation and deferral; `frame`
   and `row` set aside); the add-on's designer loop in `ADD_KINDS` order with
   the site rebuilt after each kind (28346–28591), validation before any
   apply, one migration, one page writer, one publish; the site lock
   (`site_serialization`).
3. **Exploratory probes** (scratch scripts, not kept) through the real
   routes, then **20 cases committed** in `test/mixed-work.test.mjs`. The
   edit cases run on the bakery's own five stored pages (`fixtures/run47`),
   so a menu, a photograph and a section are the real ones; the add-on cases
   use the add-on route's own harness (the site database faked in Neon's wire
   shape, the job registry, the compiler). Each case reads what really
   happened — the stored pages, look and stylesheet, the menus, the
   photographs, the database statements, the registered jobs, the publishes,
   the ledger — and both readings of the reply: the page's own composer (what
   main shows today) and the facts a model-written reply would be given.
4. **Existing evidence re-run** rather than repeated: nine suites, 252 cases
   (the report's §10).

## 3. What was found

The report holds the matrix and the plain-English answer. In one line each:

- **Works**: up to four different edit kinds across pages, in turn, one
  publish; the same kind on several pages; three changes on one page, each
  later step on the earlier one's result; a failing step beside others,
  named; a question beside others, the rest done, the answer charged once;
  up to all twelve addition kinds together, in dependency order (a table, a
  function reading it, an API, a job running the function), one publish, one
  charge; a new page and what goes on it; additions past their limits
  named; held and set-aside parts named.
- **MW1**: beside a look or page change, a photograph change and a menu
  change are made but never told (both readers ignore them on a `look`
  answer; the merge keeps one `msg`).
- **MW2**: a fifth lane is dropped without a word.
- **MW3**: a second part the answer cannot make, beside one it held, can
  vanish (no coverage accounting on the edit side; `alsoAsked` holds one).
- **MW4**: changes of one kind past a step's count are dropped without a word
  (the ninth photograph shown; the menu, row and rules caps by the code).
- **MW5**: a QR code or 3D scene that was added is never named.
- **MW6**: an addition's declined part vanishes.
- **MW7**: a schedule faster than every 15 minutes is slowed without saying so.
- **MW8**: the page's own reply names no page for page steps alone.
- **By design, said**: an edit and an addition never finish together (the
  other half is held for the next message); an addition is all-or-nothing on
  a failed check; nothing runs concurrently (in turn within a message, one job
  per site across messages).

## 4. Measured

- **`test/mixed-work.test.mjs`**: 20 cases, 20 passing as recorded. A
  finding's case asserts the defect as it happens, so it passes today and
  turns red when the defect is fixed.
- **Evidence suites re-run**: 252 of 252.

## 5. The sweep, the suite, the image and CI

- **Mutation sweep** (a scratch script, not kept: every anchor checked
  before any file is touched, every file restored from memory and its hash
  compared): **13 of 13 mutants caught, both comment-only controls (in
  `worker.js` and `site-add.mjs`) left alone.** The mutants put back a cut or
  a check the cases rely on: a fifth lane run and only three run, a failed
  step stopping the publish, the next designer not shown the new table or
  function, a page's contents not told the page is coming, a row beside a
  page designed instead of set aside, a declined designer refusing the whole
  addition, the job interval left unraised, additions past their cap not
  named, a ninth photograph removal run, a held-back part not carried on
  the answer — and two that put a finding's fix in place (a look answer's
  step sentence reaching the facts, MW1; a QR code named, MW5), each caught
  by its finding's case.
- **The first sweep left three alive (10 of 13)**, each a question about the
  mutant first:
  - *a row beside a page designed instead of set aside*: a gap in the case —
    it read the set-aside note and the reply, not whether a row designer
    ran. The case now asserts the page's designer ran and no row designer
    did (the observer proven alive first).
  - *the job interval not raised*: the interval is raised at **two layers**,
    the add-on's cleaner (`builder/site-add.mjs`, `everyAsked`) and
    `normalizeJob` (`site-jobs.mjs`), so either one alone is redundant for
    the stored value. The mutant now removes both, and MW7's case catches
    it. Recorded with MW7.
  - *a ninth photograph change run*: the mutant was on the loop's last line,
    which a removal never reaches — a removal stops the loop in its own
    branch. Re-aimed at that branch's break, it is caught by MW4's case.
- **Full suite**: `9090 / 9090 / 0 / 0` locally, from `9070 / 9070 / 0 / 0`
  measured at `c088fc52` in a worktree the same way — the 20 new cases
  exactly.
- **The image**: no container input is under `test/` or `docs/`, so this
  round cannot move it. Predicted over both ends with the repository's own
  predictor: the branch `2635a0a1fb74f8c3` (193 inputs, batch 1's module
  included), main `8bfc67dc695e65cc` (191) — unchanged from batch 1's
  record. Nothing built.
- **CI**: §6, after the push.
