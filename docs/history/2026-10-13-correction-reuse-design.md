# Making a validated correction reachable (design, 2026-10-13; not implemented)

**Status**: a design for the owner's decision. Nothing in it is built. It
changes the scope of a reviewed rule, named below, rather than weakening it
silently.

## The gap (run 141's likely shape, reproduced offline as R141 3)

A preparation asks a designer and gets an answer that the step's own cleaner
refuses (for example `no-page`):
- the refusal is marked (`rejectReply`);
- the designer is asked once more with the reason (`feedback`);
- the corrected answer is recorded as usable.

Then the part's job runs with byte-identical inputs. Its first designer
request matches the refused entry, which is never replayed, so the job asks
the model again:
- the paid correction is never reached;
- with a real model the new answer differs, so every request built on it
  (judge, page writer) is asked again too.

## The rule that has to change, by name

**Where it lives:**
- `builder/prepared.mjs`, `readPrepared`: "An entry whose reply cannot be given
  again … is left out of `calls` and named in `discarded` … so every reader — a
  job's staging, its replayer, the next job's staging of what this one kept —
  gives it to nobody."
- `docs/history/2026-10-11-validation-scheduling.md` §1: "A refused answer is
  therefore kept for diagnosis and never staged, replayed or handed to a
  continuation."
- Pinned by `test/validation-reuse.test.mjs` (VA 0–5) and
  `test/continuation-unusable.test.mjs` (UA 0–6).

**What stays exactly as it is:** a refused or cut-off **answer** is never
staged, replayed, handed to a continuation, shown to a model or applied. VA 0–5
and UA 0–6 keep passing unchanged.

**What changes:** the refusal's **facts**, not its answer, become staged:
- the reason code;
- the exact correction feedback that was sent;
- the requirements it superseded;
- a digest of what the cleaner judged.

With those, a job whose first request and cleaner input are identical can go
straight to the recorded correction. The rule text is amended to say this. It
is not loosened anywhere else.

## The design

### 1. Recording (the preparation, and any job)

`rejectReply(reply, why, facts)` gains an optional `facts` argument, written by
the refusing step at the moment it refuses:

- `feedback`: the exact string the correction request carries. For the add-on
  that is `addRefusal(why, k) + " (" + why + ")" + supersededNote(superseded)`,
  already built at that point (`worker.js` near `aFeedback`).
- `superseded`: the refused answer's requirement entries, as
  `carrySuperseded` reads them today. The live path already carries these from
  a refused answer, so this is the same trust as today.
- `cleanIn`: the SHA-256 of what the cleaner judged against, beyond the
  request itself. For the add-on: the canonical form of the site view handed
  to `cleanAdd` (`aSite`) plus `today`. The cleaner reads `aSite`, which can
  hold another kind's results that the request (built from `aSiteFor(k)`) does
  not.

The recorder writes them beside the verdict: `{ h, reply, unusable:
"rejected:add:no-page", refusal: { feedback, superseded, cleanIn } }`. The
`reply` stays in the stored record for diagnosis, as now.

### 2. Reading back (`readPrepared`)

- Refused entries stay out of `calls`, unchanged.
- A new output, `refusals: [{ h, why, feedback, superseded, cleanIn }]`, is
  read strictly:
  - the reply is never in it;
  - a malformed field drops the entry;
  - a record written before this design has no `refusal`, and yields none.
- `discarded` is unchanged.

### 3. Replaying (`replayer`)

A refused entry is matched, never answered. The replayer's `wrap(send)`
transport sees the request exactly as sent: part section, context and all. So
the **exact-input match stays the fingerprint of the final request**. When an
unspent refusal has that fingerprint:
- the transport does not call `send`;
- it does not return the refused reply;
- it returns a typed marker reply, `{ priorRefusal: { why, feedback,
  superseded, cleanIn } }`, that only a step which declared it handles prior
  refusals will accept. The add-on designer's `runAdd` would say so through an
  option, and every other caller treats the marker as a failed call.
- the refusal is spent (once, like any entry), and the call is counted in a new
  `skipped` figure in `used()`, never as `replayed`.

### 4. The step (the add-on designer's turn)

When `runAdd` answers with a prior refusal:

1. **The cleaner input must match.** The turn computes its own `cleanIn` from
   the `aSite` and `today` it would clean against. If that differs, the marker
   is dropped and the first request is sent to the model now (the refusal is
   already spent, so the replayer passes it through). The result is exactly
   today's behaviour.
2. **It matches.** Then:
   - the turn takes the recorded `superseded` as `aSupersededReq`;
   - it marks the step `correct` (with the recorded `why`) in the trace, as
     today;
   - it sends the correction with the recorded `feedback`.

   That correction request is built by the same code from the same inputs, so
   its fingerprint is the recorded correction's, and the replayer answers it
   exactly. If anything differs, the model is asked, as today.
3. **The correction is validated by the job's own cleaner before anything is
   applied**, exactly as a fresh correction is. A second refusal is final
   (422, no cost), as today; there is never a third call.
4. **Early starts (`aLanded`/`aStartReady`)**: a designer whose early request
   meets a prior refusal is not ready early. Its turn decides it, as a refused
   early answer is handled today.

### 5. Why a rejected answer cannot reach publication

- **The refused reply never leaves the stored record.** It is not in `calls`
  or `refusals`, and the marker reply carries no content.
- **What is applied is only an answer the job's own cleaner accepted at use
  time.** That is the replayed correction, or a fresh answer.
- **The facts carried are the ones the live path already carries** after a
  refusal (reason, feedback, superseded requirements). Nothing new from the
  refused answer reaches a model or a page.
- **A mismatch anywhere** (request fingerprint, cleaner input, correction
  fingerprint) falls back to today's behaviour, never to the refused answer.

### 6. Money

- The skipped first call was paid by the preparation, which is ours, as today.
- The job bills the replayed correction once, through its own reserve, as any
  replayed answer.
- The trace shows `correct` with `skipped` 1.

## Tests it would need (written first, red on today's code)

- **CR 1:**
  - setup: the preparation's first design is refused and corrected (R141 3's
    setup);
  - expected: the job asks the designer **zero** times; it replays the
    correction, the judge and the writer exactly (`skipped 1`, `replayed 3`,
    `fresh 0`); the published page carries the correction; the refused page
    never appears anywhere.
- **CR 2:** the cleaner input differs (another kind's result changed `aSite`).
  No skip: the first request goes to the model, as today.
- **CR 3:** the recorded correction was itself refused. The job asks fresh, and
  there is no third call.
- **CR 4:** a record written before the design (no `refusal`) behaves exactly
  as today.
- **CR 5:** VA 0–5 and UA 0–6 unchanged. Any caller that has not declared it
  handles prior refusals treats the marker as a failed call.
- **CR 6:** no request, stored record view, reply fact or published file
  contains the refused answer's content.

## Scope

- Only the add-on designer adopts it first. The text and data steps also have
  bounded corrections, and could adopt the same transport marker later, each
  with its own `cleanIn`.
- Cost of the change: `builder/prepared.mjs` (recorder, `readPrepared`,
  replayer) and the add-on turn in `worker.js`. `worker.js` is a container
  input, so it needs an image build to deploy.

**The owner's decision**: whether to amend the rule as above. Until then the
current behaviour stands: the correction is unreachable, and the job asks
again.
