# The sixth Build batch: one delivery rule, outcome facts across the handoff, explanations from facts (2026-10-08)

Codex reviewed `366dc581` and independently passed all 20 focused tests of
the fifth batch. Those fixes are kept. Codex then found four remaining gaps,
which this batch closes together.

Nothing was merged, deployed or built. There was no paid call, and no SQL was
applied.

## 1. Result delivery across every writer

**What Codex showed.** They held the real resume immediately before its
final write. Recovery finished meanwhile: a refund of 6 was recorded, with
`deliveredAs: "recovery"`. Then the resume was released. Its unconditional
write replaced recovery's answer and the refund with it, and later recovery
ticks left that inconsistent answer untouched.

**What changed.** There is one rule for every writer of the answer slot.
- **The writers**: the queue consumer, the resume, recovery, and the
  platform's own busy, stale and stop answers.
- **How each writes** (`storeBuildResult`):
  - it reads the slot and recovery's settlement record;
  - it asks the pure `nextResult` what the slot should hold;
  - it writes only if the slot is still what it read;
  - if another writer got in between, it reads again and decides again.
- **The rule** (`builder/build-job.mjs`):

| Incoming answer | What happens |
|---|---|
| interim | written only into an empty slot, or over another interim answer |
| final | the build's own answer is the authority on publication; it is written carrying recovery's settlement facts (`settlementFacts`), the authority on money |
| recovery | written over anything except a terminal answer; a terminal answer is kept and gains only the settlement facts it lacks |

- **The result**: in either order, the slot ends holding the build's answer
  with the refund. When the build never wrote a final answer, it ends holding
  recovery's answer.
- **The "recovery owns" check** before the consumer's and the resume's
  writes is kept as an early exit. Correctness no longer depends on it.

## 2. Context facts across the background handoff

**What happened.** A queued build with three links finished through the real
resume with neither `context` nor `contextNote`. Its unread and unopened
links were never explained.

**What changed.**
- **The first invocation keeps the facts.** Before it hands the generation
  over, it writes the structured facts (`contextFacts`) to
  `jobs/<id>.context.json`. They contain no credential and no page text.
- **Four source states stay apart**:
  - used;
  - partial, with how much was kept, out of how much, and the allowance;
  - unread, with the reason;
  - unopened, with the reason.

  `contextSummary` now keeps `unopened` apart from `failed`. The web lookup's
  outcome is recorded too.
- **Who carries them**:
  - the resume's final answer;
  - a failed resume's answer;
  - recovery's answer;
  - a refire, which reuses the job id and therefore reads the same object.

## 3. Picture facts, independent of the purchase's return

**What changed.** `withPictureFacts` wraps the purchase.
- **If the purchase returns**: its result plus the not-offered list and
  `pictures`.
- **If it throws**: the same error, carrying what was known before it — the
  planned identities and the not-offered reasons. The pictures it was buying
  read `unknown`, never made or failed.

`pictureOutcomes` decides each picture's state from the purchase's own
record (`attempted`, `notTried`, `bought`), never from a guess:

| Status | Meaning |
|---|---|
| own | the customer's own photograph |
| not-offered | past what one build buys, with the reason |
| made | bought |
| failed | attempted and not bought |
| not-attempted | written but past what the purchase could afford: library, time or budget |
| not-placed | offered, but the writer wrote no picture for it |
| unknown | the purchase threw |

`publishPages` keeps these facts on its catch path too.

## 4. Ordinary explanations, model-written from facts

**What changed.**
- **The facts.** The answer carries `buildFacts`: pictures, sources,
  research, unwritten sections, stand-in pages and settlement.
- **The narration.** `narrateBuild` asks the existing reply writer
  (`MODEL_REPLIES`, `writeReply`) to tell them, from `buildReplyFacts`. It
  runs on both the inline answer and the resumed one.
  - The resume uses the background budget.
  - The writer is told the customer's own words (`ownWords`), not the
    linked pages' text.
- **When the writer can't** (switch off, provider down, a fact left out):
  - the answer says `replyState: "unavailable"` and keeps every fact;
  - the page shows one fixed outage line and the recorded facts as terse
    labels.

  Nothing is invented.
- **The money line** (refund, still being returned, or went live) is
  deterministic accounting.
- **Last batch's fixed sentences are withdrawn**: `notOfferedNote`,
  `unwrittenNote`, and the link-cut and unopened sentences.
- **The older notes** (`contextNote`, `imagesNote`, `salvageNote`) are no
  longer shown whenever facts or a model account exist. The other notes are
  unchanged.

## Tests

- **`test/build-result-delivery.test.mjs`**: 4 new cases, through the real
  producer, consumer and resume, with the browser closed.
  - **Codex's order**: the resume is held before its write and recovery
    finishes first. The final answer keeps the refund, and later ticks
    agree and move no money.
  - **The other order**: recovery is held at its write and the final answer
    lands first. Recovery's write is refused, re-decided, and adds the
    refund.
  - **A control**: recovery claimed first, so the late resume writes
    nothing.
  - **A final answer stored before recovery**: it gains the facts once and
    keeps every field.
  - **The queue consumer's own final answer** racing recovery, in both
    orders.

  Two older cases were updated: a kept final answer now also carries the
  settlement facts.
- **`test/build-outcome-facts.test.mjs`**: 12 cases.
  - Three links through the real resume: used, partial and unopened, with
    the browser closed.
  - An unread link stays unread.
  - Recovery's answer carries the context and the settlement.
  - A build with no links keeps no context.
  - The reply writer on: the model's account, with the partial and
    unopened links among its facts, and the linked text kept out of the
    request.
  - The writer down: unavailable, facts kept.
  - Every fact state.
  - A purchase that throws, and one that returns.
  - The publish catch path.
  - A control.
  - The inline route.
- **`test/build-facts-browser.test.mjs`**: 3 cases in real Chromium, with
  screenshots shown to the owner.
  - the model's account shown, without the old sentences;
  - the writer unavailable: the outage line, the facts and the refund line;
  - a control: an answer with neither keeps the old notes.
- **Updated**:
  - `build-content-outcomes` asserts facts instead of the withdrawn
    sentences;
  - source guards in `build-answer`, `build-jobs`, `build-resume-wiring`,
    `image-parts` and `worker-imports` were re-scoped to the new shapes;
  - `handover-resume` includes the new browser helpers in its VM.
- **Before**, on `366dc581`'s modules (new names given inert stand-ins):
  15 of 26 fail. The 11 that pass are controls or the fifth batch's
  already-fixed cases.
- **Sweep**: 19 of 19 killed, and the comment-only control survived
  (`scripts/mutants/build-batch-r-2026-10-08.json`). On the first pass, one
  survivor (the unwritten list dropped from `buildFacts`) got its own
  assertion.

**Mocked versus live.**
- Every model answer is a stand-in: the designer, the page writer and the
  reply writer.
- The ledger is a stand-in, not Postgres.
- R2 is a Map with R2's conditions.
- Nothing ran against production. No real reply writer was called, so the
  quality of real narration is unmeasured.

## Measured

- **Commit**: `04f94e9e`.
- **Full suite**: `10065 / 10065 / 0 / 0` locally. A first run had 13
  failures:
  - 12 were source guards and harnesses pinned to the old shapes, re-scoped
    as listed;
  - 1 was `canary-reopen-browser` under load, which passes alone with and
    without these changes.
- **Required CI on `04f94e9e`**:
  - unit tests run 37778846275: `10065 / 10037 / 0 / 28`. The totals match;
    CI skips the browser cases.
  - site build run 37778846271: 8 of 8 green.
- **The next image, predicted** (not built): `f3c7f6235ff045af`, 198 inputs.

## Remaining gaps

- **Narration is unmeasured with a real model.** Its cost per build (one
  unbilled reply call, inline or background) is not yet measured live.
- **A settlement record that cannot be read** when a final answer is
  written leaves that answer without the refund. Recovery's next pass adds
  it only while the row is still pending; once delivery is recorded, the
  answer is not revisited.
- **Recovery's own answer is not narrated.** It is a fixed state message
  plus the facts, without a reply-writer call.
- **The outage line and fact labels are fixed text in the page**, by design
  (a technical outage message and a data listing).
- **The fifth batch's limits stand**:
  - the add-on's 240-character description cut;
  - the link count of 2;
  - linked text's cost per writer;
  - long descriptions unmeasured against the image provider;
  - P6–P11.
