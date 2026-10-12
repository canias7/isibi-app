# 2026-10-12 — Every accepted requirement is kept, however many one step writes

Codex independently passed 327 focused tests on `703faade` and confirmed CI
was green. Round 14's recovery and oversized-answer fixes are kept. This
round fixes the remaining requirement loss.

**Commits**:
- `754c4eb4`: the change and its tests;
- the commit carrying these records and the acceptance pin.

**Image prediction**: production `8d6dbcea93252fbb` → `1e30b6fb56b51794`
(205 inputs, on `754c4eb4`; was `b4fd90bc5733635b`). Not built.

No merge, deploy, container build, paid call, real image, fal call, balance
change or flag change. Every provider was mocked; real images are
unverified. Build flags and the 1-page / 15-component limits are unchanged.

## 1. The reproduction

In the checkpoint fixture, one component designer asked a question while
writing down 13 distinct requirements, each one in the customer's own
message. The customer answered, and the resumed designer returned a valid
design repeating none.

- **The 12-requirement control passed.**
- **With 13, the 13th disappeared**:
  - the checkpoint held 12;
  - the judge saw 12;
  - `requirementsTold` had 12;
  - the reply facts left the 13th out.

## 2. The trace

| Stage | What happened to the 13th |
|---|---|
| Reading (`cleanRequirements`, `builder/site-requirements.mjs`) | one step kept at most twelve (`MAX_REQUIREMENTS`); the 13th went to `skipped` as `over-cap` |
| The designer's tool (`builder/site-add.mjs`) | `maxItems: 12`, and "At most 12: … ask them which part to do first" |
| Clarification and persistence (`aHold`, the checkpoint) | only the kept list is held; `skipped` is not, so the 13th was not in the checkpoint |
| Resume | the resumed designer did not repeat it, and nothing else carried it |
| Judgment (`aJudge`) | judges the kept list only; the 13th never reached it |
| Reporting (`requirementReport`, `overCapNeeds`) | an `over-cap` entry was told as "not checked", but only from the answer of the job that read it, and that job ended on the question |

So the set-aside entry lived only in the paused job's answer, which no later
stage read. Even without a question it was never judged, so an addition
whose twelve were met could finish done with the 13th unmet (RS 13 below).

## 3. The fix: nothing accepted is set aside

- **`cleanRequirements` keeps every readable entry.** None is skipped for
  being one too many. The number a step writes is bounded only by what one
  answer can say.
- **The designer tools carry no `maxItems`.** Their instruction now reads:
  "List every one, however many — there is no limit, and none you list is
  set aside."
- **The judgment keeps its bounded batches** (`JUDGE_BATCH`, 24 per call,
  round 13). What is processed in pieces is the judgment, never the set.
- **One rule, at the reader.** Every requirement list a model writes goes
  through `cleanRequirements`, so the fix holds for all of these questions:
  - a designer's;
  - a correction's;
  - the picker's (it holds what it was handed);
  - the judge's;
  - the page writer's.
- **Records written before this change** may still hold `over-cap`
  entries. They are still told, by their own words, as not checked then
  (`OVER_CAP_WHY`, in the past tense; `LEGACY_REQUIREMENTS_CAP` = 12 only
  names the old limit).

## 4. Tests

`test/requirement-scope.test.mjs` (new, 14 cases), through the real
driver, queue consumer, routes, job runner and checkpoint. Each case reads:
- the judge's real input;
- the durable checkpoints and the part's pauses;
- the final status;
- the stored `requirementsTold`;
- the reply writer's facts.

| Case | What it shows |
|---|---|
| RS 1 control | 11 beside the designer's question: all held, judged, stored, unfinished, told |
| RS 2 control | 12 (the old ceiling): all |
| **RS 3** | **Codex's reproduction**: 13; checkpoint 13, judge 13, stored 13, the reply carries the 13th; the designer asked only twice |
| RS 4 | 40 beside one question: every one, judged in batches of at most 24 |
| RS 5 | a correction's question over a refused design with 13; no designer call made again |
| RS 6 | the picker's question (reached through a judge's question): the picker's own pause holds the 13 it was handed |
| RS 7 | the judge's question over a design with 13: the judge was asked about all 13 |
| RS 8 | the page writer's question over a design with 13 |
| RS 9 | three repeated questions, 13 each: checkpoints 13, 26, 39; all 39 told; four designer calls |
| RS 10 | a restart at every step (one delivery, the rest lost, the sweep fires): all 13 |
| RS 11 | the customer cancels one ("no option 13 after all"): it still reaches the judge, which sets it aside; the other 12 are unfinished |
| RS 12 | duplicate delivery of every message: all 13, nothing charged twice |
| **RS 13** | **every retained requirement met, the omitted 13th not**: the resumed designer restates the first 12; the judge finds them carried; the request is partial with the 13th unfinished, never done |
| RS 13 control | all 13 restated and met: done |

**Re-anchored on the new rule:**
- `no-silent-loss`: LIMIT 1, LIMIT 2, TOOL 1, and a new LIMIT 1b for records
  written before;
- `requirement-coverage`: the list keeps every readable entry, and the tool
  carries no `maxItems`;
- two stale comments (`requirement-told`, `requirement-recovery`).

## 5. Verification

- **Red check** (the new file over `703faade`'s product files, in a
  throwaway worktree):
  - **both controls pass**;
  - **all 12 other cases fail**, including RS 13 with "the request finished
    done with a requirement unmet".
- **Mutation sweep** (`sweep20`, 4 test files, every anchor checked to occur
  once): 7 product mutants and a comment-only control, from `754c4eb4`.
  - The control survived, and **7 of 7 were killed**: the intake cap (plain
    and named), the schema's ceiling, the instruction's ceiling, a cap on
    the hold, a single judgment batch, and records from before told in
    silence.
- **Full suite** on `754c4eb4`: `10638 / 10638 / 0 / 0` (+15 over round
  14's 10623: the 14 RS cases and LIMIT 1b).
- **Consolidated acceptance sweep** on `754c4eb4` (the new file in
  clarification and resume): 40 files, **512 / 512** — independent work
  112, genuine dependencies 92, clarification and resume 201 (14 files),
  partial failure 107.
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI**: unit tests 38195628173 and site build 38195628259 `success` on `754c4eb4`.

## 6. Remaining work, by kind

### Implementation defects known now

- None reproduced and open in these paths.

### Limits (as designed, recorded)

- **How many one answer can say.** A step's list is no longer capped, but
  one model answer is still bounded by its output tokens. A real designer
  asked for hundreds would be cut off (`max_tokens`). That is named as
  truncation, as before, never as a shorter list.
- **The judge is shown at most 80 designed things** (`MAX_JUDGE_ITEMS`).
  That is a separate list (carriers, not requirements); what does not fit
  is counted in the record. Not changed here.
- From rounds 13–14: a delta's bound sits at several thousand requirements;
  an unsaved spill is told as unrecorded; recovery gives up after a day.

### Behaviour awaiting live verification

- whether real designers list more than twelve now that the tool allows it,
  and whether they still ask which part to do first when there are very
  many;
- R2's real failure modes and the sweep's real cadence;
- whether real designers mark `replaces`, real judges set aside only on the
  customer's words, and real routers name the new targets;
- the real latency gain;
- real images (fal off limits).
