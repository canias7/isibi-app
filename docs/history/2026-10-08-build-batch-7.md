# The seventh Build batch: settlement delivery that survives read failures, pictures grounded in publication, explanations on every path (2026-10-08)

Codex reviewed `1a294654`, independently passed 49 focused tests and
confirmed CI green; those passes are kept. Codex then found three remaining
reporting and delivery gaps, which this batch closes together.

Nothing was merged, deployed or built. There was no paid call, no paid retest,
and no SQL was applied. The limits of 1 page and 15 components are unchanged.

## 1. Settlement delivery survives read failures

**What Codex showed.**
- The real resume was held before its final result write.
- Recovery finished meanwhile, recording a refund of 6.
- During the resume's conditional-write retry, the settlement record's read
  was failed.
- The result:
  - the final answer erased the refund;
  - the record still said `delivered: true`;
  - nothing was pending;
  - later recovery ticks never repaired it.

**The cause.** `storeBuildResult` treated an unreadable settlement record
exactly as an absent one, and recovery skipped every row whose record said
delivered.

**What changed.**
- **Unreadable is not absent** (`storeBuildResult`).
  - When the record cannot be read, the writer keeps the facts the slot
    already carries (`knownSettlement`). Those are a terminal answer's
    `settlement`, or recovery's answer's `settlement` /
    `buildFacts.settlement`. On a recovery answer older than both, they are
    its own `recovered` / `refunded` / `refundShort`.
  - An answer that says nothing about money yields nothing; nothing is
    guessed.
  - The build is listed as pending (`recovery/pending/<id>`, why
    `settlement-unread`), so the reconciliation is kept durably.
  - A caller that already holds the facts passes them and makes no second
    read. Recovery's own delivery is such a caller.
- **Recovery repairs** (a new `repair` role in `nextResult`).
  - A settled and delivered row is revisited while it is pending.
  - The repair only adds the recorded facts to a terminal answer that lacks
    them.
  - It never writes into an empty (collected) slot, never replaces
    recovery's own answer, never refunds, and never reruns the build, the
    purchase or a debit.
  - The row stays pending until the repair has looked; an unreadable record
    keeps it pending.
  - A pending row recovery never took as lost behaves as follows: with no
    record, nothing was settled and the entry is dropped; with a settled
    record, it is repaired the same way.

## 2. Pictures grounded in the final publication

**What Codex showed.** `publishPages` was driven with a successful purchase
followed by a compilation failure. The page was the placeholder and nothing
was published, yet `buildReplyFacts` told the model "Photographs made and put
on the site."

**What changed.**
- **Three outcomes are kept apart.**
  - A bought picture is `made` with `stage: "stored"` and its address.
  - `pictureStages` then reads the final sources (after salvage) and whether
    the publish completed:

| stage | meaning |
|---|---|
| published | its address is in the final source, and the site went live |
| in-source | its address is in the final source, and nothing went live (compilation failed, salvage did not rescue it, or the publish was refused or threw) |
| stored | its address is in no final source (a stubbed page, a placeholder, or never written in) |

- **Where it is applied**: `publishPages` stages the pictures on the
  compilation-failure exit, on a publish that throws (the error now carries
  `images`), and after a completed publish. A failed resume's answer now
  includes those picture facts.
- **What is told.**
  - `buildReplyFacts` says "published on the site" only for `published`.
  - `in-source` and `stored` are told as not on the site.
  - The page's fact labels follow the same split.
- **A shot still running when the wait ends is unknown, not failed.**
  - `buySitePhotos` records each shot's own ending: `refused` (the provider
    answered with no picture, or the call threw) and `unresolved` (no answer
    when the wait ended).
  - `pictureOutcomes` reads an unresolved shot as
    `unknown / still-pending`, never `failed`.
  - A record without the two lists (an older hook) keeps the sixth batch's
    reading.

## 3. The model-written explanation on every path

**What Codex showed.**
- Recovery never called the narrator.
- A failed resume's catch answer bypassed it.
- `chat.js` called `buildToldLines` only in its successful-response branch,
  so facts carried by an error response disappeared from the chat.

**What changed.**
- **Recovery's answer is narrated** from its facts (`narrateBuild`, on the
  background budget), and its fixed `msg` and accounting stay.
  - **The one attempt is kept** on the settlement record (`narration`: the
    text, or the state and why). A tick that retries delivery reuses it and
    never pays for the same explanation twice.
  - A writer that was down is not retried by later ticks.
- **A failed resume's answer is narrated** the same way. Its fixed `error`
  and its accounting stay.
- **"Never attempted" is not "failed".** With `MODEL_REPLIES` off, the answer
  says `replyState: "not-attempted"` (`replyWhy: "off"`).
  - The page lists the record under a plain heading ("What was recorded
    about this build:").
  - "Unavailable" (the writer was asked and could not answer) keeps the
    fixed outage line.
- **The chat shows a failed answer's told lines too.**
  - The generic failure branch keeps the fixed failure sentence as the
    message.
  - It shows the narration, or the facts and the refund line, in the note,
    the same as a finished build's.
  - The fixed technical outage messages (402, 429, 501, 503) are unchanged.
  - Deterministic accounting labels stay.

## Tests

- **`test/build-batch-7.test.mjs`**: 16 cases, offline.
  - **1, through the real producer, consumer, resume and recovery**:
    - Codex's exact reproduction;
    - a collected slot with the record unreadable, where the final is
      written without facts and the next tick adds the refund once;
    - the record still unreadable on the repair tick (kept pending, nothing
      written), then repaired;
    - a control with every read working;
    - the pure rule.
  - **2, through `publishPages`**:
    - Codex's compile-failure reproduction;
    - salvage, where one picture is published and the stubbed page's is
      stored;
    - a refused publish, whose error carries the pictures;
    - a control, a clean publish;
    - `pictureStages` exactly.
  - **2b, through the Worker's own `buySitePhotos`** (its source, run with
    the real picture helpers, a stand-in provider and a mocked clock):
    - one picture bought, one refused, one still running at the cutoff;
    - a control.
  - **3, through recovery and the real resume**:
    - recovery narrated once, its attempt reused after a failed delivery
      write;
    - the writer down (unavailable, not retried);
    - a control with the switch off (not attempted, no call);
    - a failed resume (its publish refused) narrated.
- **`test/build-facts-browser.test.mjs`**: 4 new cases in real Chromium,
  through the page's generic failure branch, with screenshots:
  - a lost build's 410, narrated;
  - a failed resume's 500 with the writer unavailable;
  - narration never attempted;
  - a control with no facts.
- **Updated**:
  - `build-outcome-facts`: the switch-off case now expects `not-attempted`,
    and the made picture carries its stage;
  - the earlier browser case: a made picture's label follows its stage;
  - `test/fixtures/build-lifecycle.mjs`: a case's own fetch answers
    (`over`), and the reply stand-in exported.
- **Before**, on `1a294654`'s code (the two new names given inert
  stand-ins): **19 of 23 fail.** The 4 that pass are controls.
- **Sweep**: 21 of 21 killed, the comment-only control survived
  (`scripts/mutants/build-batch-s-2026-10-08.json`).

**Mocked versus live.**
- Every model answer is a stand-in: the designer, the page writer and the
  reply writer.
- The image provider is a stand-in.
- The ledger is a stand-in, not Postgres.
- R2 is a Map with R2's conditions; a read failure is injected by
  replacing `get` for one key.
- Nothing ran against production. No real reply call was made, so the
  quality and cost of narration (inline, background, recovery,
  failed-resume) are unmeasured.

## Measured

- **Commit**: `f3221a9a`.
- **Full suite**: `10085 / 10085 / 0 / 0` locally. A first run had 2
  failures, both guards pinned to the old shape:
  - `wiring`'s per-shot reason guard was re-scoped to the new `else` block;
  - `handover-operations`' page harness gained the three told-line helpers,
    which the failure branch now calls.
- **Required CI on `f3221a9a`**:
  - unit tests run 37784973579: `10085 / 10053 / 0 / 32`. The totals match;
    CI skips the browser cases, 4 of them new;
  - site build run 37784973566: 8 of 8 jobs green.
- **The next image, predicted** (not built): `47b0d2fd2274633a`, 198 inputs.
  `publish-pages.mjs` and `site-images.mjs` are image inputs, so it moved
  from the sixth batch's `f3c7f6235ff045af`.

## Remaining gaps

- **Narration with a real model is unmeasured**: its wording quality, and
  its cost per build, per recovery and per failed resume.
- **A recovery narration that could not be kept** (the record's write
  failed) is still delivered, but a later retry of that delivery may ask
  the writer again.
- **An inline build's own failure exits** (not the resume) are not narrated.
  They are fixed failure messages, as before.
- **A pending repair waits for the build's row to be read.** A row the
  recovery read cannot see stays pending until it can.
- **Recovery objects are never deleted**, as before.
- **The fifth and sixth batches' limits stand**:
  - the add-on's 240-character description cut;
  - the link count of 2;
  - linked text's cost per writer;
  - long descriptions unmeasured against the image provider;
  - P6–P11.
- **The .txt reminder** (an oversized pasted message becomes a complete
  attachment) stays recorded for later.
