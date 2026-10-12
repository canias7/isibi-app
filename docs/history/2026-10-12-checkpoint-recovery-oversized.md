# 2026-10-12 — A checkpoint that cannot be read is recovered by the server; an oversized one, and an oversized answer, are kept whole

Codex independently passed 314 focused tests on `29fc95af`. Round 13's fixes
are kept. This round finishes the recovery gaps that round left open.

**Commits**:
- `985607c7`: the change and its tests;
- `ed6dbb7b`: RC 13, for the one path the sweep showed no case reached (§5);
- the commit carrying these records and the acceptance pin.

**Image prediction**: production `8d6dbcea93252fbb` → `b4fd90bc5733635b` (205
inputs, on `985607c7`, whose product files `ed6dbb7b` keeps; was `31811cf56e30d18c`). Not built.

No merge, deploy, container build, paid call, real image, fal call, balance
change or flag change. Every provider was mocked; real images are
unverified. Build flags and the 1-page / 15-component limits are unchanged.

## 1. What was open

- **A checkpoint read that kept failing used up the part.** Round 13 ran the
  part again twice, then failed it (`checkpoint-unread`). The accepted request
  was over; the customer had to send it again.
- **The oversized fallback re-ran model work.** A checkpoint the store refused
  and too large to ride in the answer (`HELD_INLINE_MAX`) became a refusal
  that ran the paused job again. A refused designer answer is never replayed,
  so the outcome depended on the model asking the same question again.
- **Found while testing it: a finished answer over 200,000 characters was
  cut.** The runner stored `bodyText.slice(0, 200000)`. Cut in the middle, it
  no longer read, and the request took the job as "done (what it changed was
  not recorded)". An addition that told 384 requirements unfinished came back
  done.
- **Found while testing it: each recovery try wrote its own reply.** A try
  that stopped at the checkpoint guard was given a model-written reply ("The
  addition did not go through…", with the routing cost repeated), one model
  call per try.

## 2. Recovery: the server picks the part up again

`builder/request.mjs` (settle, the next step, the request's state) and
`worker.js` (the job runner, the add-on route, the driver).

- **A new part state, `recovering`.** A checkpoint that could not be saved or
  read just now leaves the part `recovering` on its request.
  - Nothing is applied or charged, and no question is acknowledged.
  - The checkpoint and the paused job's kept answers stay.
  - The record holds `recover: { tries, since, next }`. The next try is a
    time on the record, so a restart loses nothing: the two-minute sweep moves
    every unfinished request on through the existing driver
    (`advanceRequest`).
- **Bounded retries with a growing wait** (`heldRecoverDelay`): the first try
  at once, then 30 s, doubling to at most 30 minutes, for as long as any
  request waits (`WAIT_MS`, a day). Past that the part fails, saying why,
  with everything still stored.
- **Only a checkpoint known lost fails at once**: malformed, or missing with
  no copy on the request. A record that is not there, or not JSON, is now an
  answer (`missing` / `malformed`), never mistaken for a store failure; only a
  read that throws is `unreadable`, which recovers.
- **The rest of the request goes on.**
  - An independent part runs and finishes while one recovers.
  - A part that needs it stays blocked; once it resumes and finishes in part,
    the dependent is not run, saying which part it needed, as before.
  - A stop cancels a recovering part; no sweep files another try.
  - Ownership, idempotent filing (one key per try) and duplicate delivery are
    the driver's existing rules, unchanged.
- **A part that never paused reads no checkpoint.** Its job body says whether
  the part paused (`paused`). Before, a part with nothing to resume still read
  the staged copy, and a store outage refused its job too.
- **Statuses stay truthful.**
  - The request is `running` while a part recovers.
  - The page shows "Picking this up again", and the model-written task line is
    the `planned` one.
  - The request's own reply, if one is written meanwhile (a go-ahead), says
    nothing has been changed for that part and it is picked up by itself.
  - A part that finally fails says its saved requirements could not be read
    back and it was not run on a shorter list.
- **A try is not an outcome.** A job that stopped at the checkpoint guard has
  no reply of its own; its part's state and the request's reply say what is
  happening.

## 3. Oversized: kept whole, through one persistence rule

`builder/site-requirements.mjs` (`heldDelta`, `applyHeldDelta`),
`worker.js` (`resolveHeld`, the runner's fallback, `spillAnswer`,
`hydrateAnswer`, `editGet`) and `builder/request.mjs` (`keptCheckpoint`).

- **A checkpoint carried as what changed.** When the store refuses a
  checkpoint, the answer now carries what changed since the checkpoint the
  job resumed from:
  - entries kept exactly are not carried again;
  - an entry kept word for word under another id (the resumed designer's own
    numbering takes its id) is a rename;
  - changed or new entries are added; anything else is dropped.

  The part keeps it on that job (`end.heldDelta`). Staging resolves the
  chain: store, then the part's whole copy, then the delta over its base,
  each step complete with its exact count, reaching only earlier jobs of the
  same part. A job carries what it found, never everything before it again.
- **A finished answer kept whole.** An answer over the row's
  `ANSWER_INLINE_MAX` is written beside the job (`jobs/answers/<id>.json`),
  read back the same, and the row keeps where it is. Every reader of a job's
  row goes through `editGet`, which puts it back:
  - the request driver;
  - the job poll;
  - the reply writer;
  - the rebuild filer.

  When it cannot be read just now, the readers wait (the driver settles the
  job on a later step). When the store never took it, the part says its
  outcome was not recorded: partial, never done.

## 4. Tests

`test/requirement-recovery.test.mjs` (new, 13 cases), through the real
driver, queue consumer, two-minute sweep, routes and job runner. They read
the judge's real inputs, the durable records, the final statuses, the stored
`requirementsTold` and the reply writer's facts.

| Case | What it shows |
|---|---|
| **RC 1** | **the requested case**: storage down past the old window; `recovering`, tries spaced, nothing applied, charged or replied; then a restart (every queued message lost) and the store back; the same request resumes by itself: one question, no designer asked again, both requirements judged, stored and told |
| RC 2 | the wait grows (0, 30 s … 30 min) and is bounded; a day unreadable ends it failed, saying why, its checkpoint still stored |
| RC 3 | duplicate delivery of every message and sweep while recovering: one try per wait, nothing charged twice, then resumed |
| RC 4 | a stop while recovering: stopped, no further try, nothing applied or charged |
| RC 5 | a genuinely empty checkpoint unreadable for a while: recovering, never "missing"; resumed with its verified empty set; done |
| RC 6 | an independent sibling finishes while the addition recovers; the addition then resumes; partial, both told |
| RC 7 | a dependent part waits while the addition recovers, and is not run once it finishes in part |
| **RC 8** | **the oversized case**: 32 questions × 12 long requirements (well above `HELD_INLINE_MAX`), every checkpoint write refused, the final designer listing none; every pause acknowledged, no designer asked again, all 384 judged, stored, unfinished and given to the reply writer; the finished answer kept whole beside its job |
| RC 9 | how: each pause after the first is a delta (12 added, nothing dropped, earlier ones renamed), counted 12 … 384, the last far smaller than the whole |
| RC 10 | the delta read back: kept, renamed, changed, removed; a base of another size refused |
| RC 11 | the whole answer unreadable for a while: the driver waits and then tells all 384 — never "done, not recorded" |
| RC 12 | the whole answer never kept: the part is told its outcome was not recorded — partial, never done |
| RC 13 | an addition that never paused, while every checkpoint read fails: it reads none and finishes |

**Changed elsewhere**:
- CK 3 now expects one try, then an honest failure: a checkpoint known lost
  no longer waits.
- `input-budget` is re-anchored on `ANSWER_INLINE_MAX`, and asserts the
  answer is spilled, never cut.
- The fixture gained `failGetFrom` (let N reads through, then fail M), and
  its `answerOf` reads a spilled answer back as `editGet` does.

## 5. Verification

- **Red check** (the new file over `29fc95af`'s product files, in a throwaway
  worktree, missing functions read through namespace imports): **all 12
  fail** (RC 13 was added after the sweep).
  - RC 1, 3, 5, 6 and 7 end `failed checkpoint-unread`: the old "two retries,
    then fail".
  - RC 8 and 11 end in three `held-retry` jobs: the oversized fallback
    running the work again. RC 12 never reaches its answer.
  - RC 10 fails because the function is missing.
- **Mutation sweep** (`sweep19`, 4 test files; every anchor checked to
  occur once): 14 product mutants and a comment-only control, from
  `985607c7`.
  - The control survived, and **13 of 14 were killed**: lost never / always,
    no backoff, no day bound, never resumed, not `running`, a reply per
    try, no delta, no rename, an unresolved chain, the answer cut again, an
    unreadable spill settled, an unsaved spill read as done.
  - **The survivor, `paused-ignored`** (every request job reads a
    checkpoint), was a path no case reached: RC 6's sibling is a text edit,
    and only the add-on route refuses on an unreadable checkpoint. RC 13
    (`ed6dbb7b`) reaches it: it passes on the code and fails with that
    mutant in place, checked by hand.
- **Full suite**: `10623 / 10623 / 0 / 0` on `ed6dbb7b` (+13 over round 13's 10610: the 13 RC cases)
- **Consolidated acceptance sweep** on `ed6dbb7b` (round 12's groups, the new file in clarification and resume): 39 files, **498 / 498** — independent work 112, genuine dependencies 92, clarification and resume 187 (13 files), partial failure 107.
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI**: unit tests 38191442871 and site build 38191442850 `success` on `985607c7`; unit tests 38192045211 `success` on `ed6dbb7b`.

## 6. Remaining work, by kind

### Implementation defects known now

- None reproduced and open in these paths.

### Not yet checked

- **Over-cap entries written beside a question.** One step keeps at most
  twelve requirements (`MAX_REQUIREMENTS`). The rest are recorded as
  `over-cap` and told as not checked. Whether a paused step's over-cap
  entries are still told after the resume has not been tested.

### Limits (as designed, recorded)

- **A delta still has a bound.** It grows by one short rename per earlier
  requirement (about 30 bytes), so the answer's bound is reached only at
  several thousand held requirements. Past it, the pause is
  `checkpoint-unsaved` and recovers by running the paused job again.
- **A spill the store never took** leaves the part partial with its outcome
  unrecorded: honest, but what that job did is not itemised.
- **A day of recovery, then failure**: a store down longer than `WAIT_MS`
  ends the part as failed, and the customer would ask again.
- Labels are taken at acceptance. Uncertain equivalence is told twice. Build
  refusals are unmarked. The real waits are unchanged (rounds 11–12).

### Behaviour awaiting live verification

- R2's real failure modes and timings, against the 30 s … 30 min schedule;
- the sweep's real cadence after a restart;
- whether real designers mark `replaces`; whether real judges set aside only
  on the customer's words; whether real routers name the new targets;
- the real latency gain;
- real images (fal off limits).
