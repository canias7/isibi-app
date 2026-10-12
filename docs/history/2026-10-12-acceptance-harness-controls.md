# 2026-10-12 — Round 17: the acceptance harness's two false positives

**The review**: Codex reviewed `3869478b` (round 16's image-free Add-on
scenarios and their records). 168 focused tests passed and three
browser-dependent tests were skipped; CI was green. Two independent negative
controls showed the harness passing what it should refuse. The product fixes
and the round-16 scenarios are kept.

**Commits**:
- `1eac62c1`: the fixes and their tests;
- the commit carrying these records.

**Scope**: the acceptance harness only (`scripts/canary-requests.mjs`,
`scripts/canary-read-job.mjs`, `scripts/canary-ui.mjs`), its tests and the
plan. No product file, container input, billing or flag changed; the predicted
image stays `1e30b6fb56b51794`. No paid call, fal call, merge, deploy or
container build.

## 1. Facts: a wrong amount passed

- **The control**: `acc-addon-inner` asks for "£25 a head, cheese included".
  The section check required only the fragments "a head" and "cheese", so a
  section saying "£50 a head, cheese included" passed every section check.
- **The rule now** (`factChecks`, used by `sections` and by new pages): each
  page or section names every fact the message asks for.
  - `facts`: each fact is stated, whole and undenied, by one of its own
    listed wordings. The list is how equivalent wording is allowed ("£25 per
    person", "Monday to Friday mornings"); there is no looser match.
  - `only`: every amount of money, day of the week and time of day the added
    words state must be one asked for. A different amount, a second amount
    beside the right one, a weekend for weekday mornings or an evening for a
    morning fails.
  - `denies`: claims the customer said no to must not be made.
  - A question in the added words is not a claim, and an answer's leading
    "No," does not deny the sentence after it ("No, it is made with rye
    flour"). A "not" inside the sentence still denies it.
  - When facts are named, they replace the literal fragments as the anchor:
    the page must not already have stated every fact, and the served page is
    judged on the positive facts too.
- **The scenarios now carry every fact**:
  - `acc-addon-inner`: the page names Clifton, Redland and Montpelier, on
    weekdays, in the morning, with no other day or time; the section says
    £25 a head with the cheese included, no other amount, and never "cheese
    not included".
  - `acc-addon-edit`: the list is updated, every Monday, in the morning, with
    no other day or time.
  - `acc-addon-pair`: dogs are welcome, inside, never "outside only"; the
    starter is made with rye flour and is not gluten-free, never claimed
    gluten-free.

## 2. Attribution: an older job's trace was claimed

- **The control**: the lookup read traces by end time but competing jobs by
  creation time, looking back 30 minutes. A job created at 08:00 that ended
  at 10:04 was missed when checking a job created at 10:00, although its
  trace was read. With only that trace returned, `addonDesignOverlap`
  declared the 10:00 job's designers overlapped.
- **The fix**, conservative and not a wider window:
  - **jobs chosen by what they ran**: every job on the site created before
    the window's end and still updated after the earliest returned trace
    began (or never updated). A page of rows as long as the read limit, or a
    row without its id or creation time, leaves the read incomplete;
  - **a trace counts as the job's only** when the job has finished, the read
    is complete and holds the job, exactly one trace ran inside the job's own
    run (its creation to its last update, a minute's slack either side), and
    no other job ran beside that trace. A trace that began before the job
    existed is never its;
  - otherwise `candidate-only` (two traces inside the run, or another job
    beside it) or `unknown` (a failed or cut read, an unfinished job, a
    trace that does not say when it ran or dropped events, or no trace
    inside the run).

## 3. Tests

`test/acceptance-addon-free.test.mjs`, now 16 cases (7 new, 3 rewritten):

| Case | What it shows |
|---|---|
| FACTS, the inner section | £25 a head passes, also as "£25 per person, including cheese"; £50 (Codex's control), no amount, a second amount, cheese not included, and a served page saying otherwise each fail by name |
| FACTS, the inner page | the three places on weekday mornings pass, also as Monday to Friday; a missing place, Saturdays, weekends or afternoons fail |
| FACTS, the edit section | every Monday morning passes, also as "on Mondays, first thing in the morning"; Tuesday, Monday and Thursday, or Monday evening fail |
| FACTS, the pair's sections | dogs welcome inside passes; not welcome, or outside only, fails. "No, it is made with rye flour" and "not gluten-free: made from rye flour" pass; claimed gluten-free, wheat flour, or rye flour denied fail |
| EVERY NEW SCENARIO NAMES ITS FACTS | every section and page carries facts, with the amount, day and time held to `only` |
| DESIGNERS, GENUINE AND SEQUENTIAL | the job alone with its own trace: crossing designers overlapped, one after another not |
| DESIGNERS, CODEX'S OLDER JOB | the 08:00–10:04 trace alone: unknown (the job's own trace is missing), whether or not the older job was read; both traces: candidate-only, naming the older job |
| DESIGNERS, MISSING AND AMBIGUOUS | no trace, a trace from before the job, two traces inside its run, a job beside it, a job still running with no end: never a verdict; a job well after the trace does not count |
| DESIGNERS, INCOMPLETE READS | a failed or cut read, the job missing from it, an unfinished job, a job or trace without times, dropped events: unknown |
| THE READ-JOB BOX | through the real lookup: jobs read by last update since the earliest trace began, never by a creation lookback; a full page is incomplete; the printed verdict follows |

## 4. Verification

- **Red check** (the new file over `3869478b`'s scripts, in a throwaway
  worktree): **9 of 16 fail**. The 7 that pass are the unchanged checks and
  the genuine and sequential controls, which must pass on both.
- **Mutation sweep** (`sweep22`, 4 test files, every anchor checked to occur
  once): 21 product mutants and a comment-only control.
  - The first pass killed 19 and two survived: the weekend reading, and the
    served-page fact check for sections. Each was a question about the tests;
    two cases were added ("at weekends"; a section stored right and served
    wrong), and both were then killed.
  - **21 of 21 killed**, the control surviving.
- **Full suite** on the round's tree: `10657 / 10657 / 0 / 0` (+7).
- **Consolidated acceptance sweep**: 41 files, **531 / 531** (independent
  work 131, dependencies 92, clarification and resume 201, partial failure
  107).
- **Required CI**: unit tests 38201146344 `success` on `1eac62c1` (10657
  tests, 10616 passed, 0 failed, 41 skipped).

## 5. What remains

- **Equivalent wording is a list**, written per fact. A live answer phrased in
  a way no list holds ("we'd love to see your dog in the shop") fails, and
  is then read by a person, never passed by a looser rule.
- **Only amounts, days and times of day are checked for contradiction.** A
  contradicting place ("not Redland") is caught by the denial rule; an extra
  place nobody asked for is not refused.
- **Attribution needs the job alone on the site while its trace ran.** A busy
  site gives `candidate-only`; a job column on `edit_traces` would remove the
  limit, and is a product and schema change not made here. The slack between
  a job's last update and its trace is one minute.
- Paid acceptance stays blocked until the owner's spending decision.
