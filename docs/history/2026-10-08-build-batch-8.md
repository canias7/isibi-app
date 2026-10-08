# The eighth Build batch: one narration per set of facts, pictures from what pages render, ordinary inline failures told (2026-10-08)

Codex reviewed `ff1fd469`, independently passed all 65 focused tests and
confirmed CI green; those fixes are kept. Codex then found three remaining
gaps, which this pass closes to finish the Build batch.

Nothing was merged, deployed or built. There was no paid call, no paid retest,
and no SQL was applied. The limits of 1 page and 15 components, the spending
safeguards and the .txt reminder are unchanged.

## 1. No repeated narration while a refund is short

**What Codex showed.**
- The pages refund was kept unavailable across two real recovery passes,
  with storage working normally.
- Both passes recorded the same return of 4 and `short: true`.
- The second pass dropped the saved narration and called the reply model
  again with an identical request.

**The cause.** While `settled` was false, each pass built the settlement
record fresh and wrote it over the old one, dropping `narration`.

**What changed.**
- **Every write of the settlement record keeps its explanation**
  (`putSettlementMark`). It reads the record, keeps the newer of the two
  explanations (`newerNarration`), and puts conditionally on what it read,
  deciding again when another pass got in between.
- **An explanation is tied to the facts it explains.**
  - `narrationKey` is a stable fingerprint of the build's facts (keys
    sorted).
  - The record keeps `key` and `settlementKey` with the text or state.
- **One retry contract for every pass** (`narrationPlan`):

| Situation | What happens |
|---|---|
| a finished explanation (written, or the writer could not answer) for these facts | reused |
| an attempt for these facts claimed and its outcome unknown (a pass still running, a save that failed) | held: never paid for again |
| the record or the kept context unreadable this pass | held: nothing new is asked, though a finished explanation of the same settlement is reused |
| none, one for different facts, or one never attempted (switch off) | the writer may be asked, after a claim |

- **The claim comes before the call.**
  - The record gains `narration: { state: "attempting", key, … }`, written
    conditionally (`claimNarration`).
  - An overlapping pass that claimed first wins, and this one holds.
  - A claim that cannot be written means nothing is paid for that pass.
- **The outcome is saved over its own claim only** (`saveNarration`). When
  the save fails:
  - the answer still carries the text;
  - the claim stands, so later passes hold;
  - a hold keeps an explanation already delivered in the slot for the same
    facts, rather than replacing it with the facts alone.
- **When the amount or outcome genuinely changes**, the key changes, and the
  explanation is written again rather than the stale one reused.
- **The kept context's read now tells absent from unreadable**
  (`readKeptContext`), so a failed read never looks like changed facts.

## 2. Picture publication from what the routes render

**What Codex showed.** A page that never imports or renders a separate
component holding a bought photograph was published. `pictureStages`
searched every source file for the address, marked it published, and the
reply writer was told it was on the site.

**What changed.**
- **`picturesShown`** (`builder/rendered-pictures.mjs`) reads the published
  route files and parts with the injected TypeScript parser, through the
  render analysis the menus already use. That analysis was refactored into
  `analyseRender` in `rendered-menus.mjs`, so the CERTAIN / MAYBE / DEAD
  rules are written once.
  - Each address is `yes`, `no` or `unknown`.
  - It follows a route's component into the components it certainly
    renders, across files, through `-parts/<name>` imports.
  - **yes**: a certainly rendered element's attribute is the address, as a
    string or a never-changed `const`.
  - **no**: every reachable file parsed, and no live string, template or JSX
    text holds the address. Its only occurrences are in files no route
    imports, in comments, in declarations nothing names, or in untaken arms.
  - **unknown**: anything else. That covers no parser, a file that did not
    parse, or a reach only through a condition, a `.map` or a prop.
- **Stages** (`pictureStages`, now given `shown`):

| stage | meaning |
|---|---|
| published | the site went live and a published route certainly renders it |
| unconfirmed | the site went live with the address in its files; whether a page shows it could not be established |
| not-shown | the site went live with the address in its files, and no published page renders it |
| in-source | in the final source; nothing went live |
| stored | in no final source |

- **The publish passes its parser** (`deps.parser`, `tweakParser` in the
  Worker). A Worker bundle resolves none, so in production today a
  published picture is told as **unconfirmed**. That is the narrower fact
  the evidence supports.
- **One outcome for both readers.** The reply writer is told "shown on a
  published page" only for `published`, and is told not to say a picture is
  on the site when it is `unconfirmed`. The page's labels follow the same
  five stages.

## 3. The ordinary inline failures, model-written

**What changed.**
- **A `failure` fact** (`buildFacts`, `BUILD_FAILURE_KINDS`) for the ordinary
  stops, carrying what the build cost by the route's own ledger reading:
  - `design-unusable`, `design-truncated`, `design-timeout`;
  - `held-unread`;
  - `generate-failed`, `compile-failed`.
- **Narrated by the shared flow**:
  - the design stop;
  - the held-unread refusal;
  - the inline final answer of a placeholder build;
  - the resumed build's final answer.
  The writer is told the facts (`buildReplyFacts`).
- **Outages keep their fixed messages and get no failure fact**:
  - the provider out of balance or busy;
  - no room to compile;
  - unconfirmed live pages;
  - provisioning;
  - 402, 429, 501, 503.
- **The page** (`buildFailureView`):
  - an ordinary stop on either branch, success (a placeholder build) or
    error, leads with the reply writer's account;
  - otherwise it shows a plain "The build didn't finish." with the outage
    note and the labels, never the canned explanation;
  - the deterministic cost label (`failureCostLine`) is shown either way.
- **Every error branch** (`endTold`) keeps its fixed sentence and shows any
  narration, recorded facts or refund the answer carries. That includes the
  402 credits refusal and the 503 outage.

## Tests

- **`test/build-batch-8.test.mjs`**: 19 cases, offline.
  - **1, through the real producer, consumer and recovery**:
    - Codex's exact reproduction (two passes, return 4, short: one call);
    - a control where the facts change (the rest returned: a new
      explanation, the stale one not reused);
    - overlapping passes (the second never calls);
    - the narration's save failing (no second call, the delivered text
      kept);
    - the claim failing (no call that pass, one call later);
    - a pass whose view of the record goes stale (no second call);
    - two passes racing at the claim (one call);
    - the pure rule.
  - **2, through `publishPages` with the real parser**:
    - Codex's reproduction (a part never imported or rendered: not shown);
    - a control where the part is imported and rendered (published);
    - imported but never rendered (not shown);
    - rendered behind a condition (unconfirmed);
    - a comment and an unused string (no);
    - a component disconnected by salvage (not shown);
    - no parser (unconfirmed);
    - a real queued build through the Worker, buying a picture its page
      renders (shown).
  - **3, through the real inline route**:
    - the designer unusable, narrated;
    - the same with the writer down (unavailable, fact kept);
    - an outage control (provider out of balance: fixed message, no fact, no
      call);
    - the page writer failing (generate-failed, narrated, the answer's own
      cost);
    - every failure kind's fact and money.
- **`test/build-facts-browser.test.mjs`**: 5 new cases in real Chromium, with
  screenshots:
  - an ordinary stop on the error branch, narrated;
  - the same unavailable;
  - an ordinary stop on the success branch (a placeholder);
  - a 402 refusal carrying a refund;
  - the picture labels for published, unconfirmed and not shown.
- **Updated**:
  - `build-batch-7`, `build-outcome-facts` and the earlier browser case for
    the stage wording;
  - `build-batch-7`'s publish cases pass the parser;
  - the `handover-operations` and `handover-resume` page harnesses include
    the new helpers;
  - fixtures: `driveBuild` takes `onFetch`.
- **Before**, on `ff1fd469`'s code with the new names given inert stand-ins:
  **21 of 28 fail.** The 7 that pass are controls and the seventh batch's
  cases.
  - The reproductions fail on the defect itself: "the second pass paid the
    reply model again for the same facts"; the photograph marked published;
    no failure fact.

**Mocked versus live.**
- Every model answer is a stand-in: the designer, the page writer and the
  reply writer. The ledger is a stand-in. R2 is a Map with R2's conditions.
- The TypeScript parser is the real one (Node), and the same reader the
  container uses.
- In a deployed Worker the parser resolves to nothing, so the live answer
  for a published picture is "unconfirmed". The `yes` and `no` readings are
  shown here only under Node.
- No real reply call was made. Nothing ran against production.

## Measured

- **Commit**: `ae905c3e`.
- **Sweep**: 21 of 21 killed, and the comment-only control survived
  (`scripts/mutants/build-batch-t-2026-10-08.json`). The first pass killed
  18 of 22, with 4 survivors, each answered before the second pass:
  - **"the settlement rewrite drops it"** and **"the merge ignores the
    stored one"** masked each other: either path alone kept the
    explanation. The in-memory carry was redundant and is gone, and a test
    where this pass's view of the record goes stale (another pass narrates
    while it refunds) now holds the merge.
  - **"the claim is not conditional"**: a test where two passes race at
    the claim, both having read no claim.
  - **"the parser is not injected"**: a real queued build buys a picture
    its page renders, and the Worker's resume reports it shown. Making that
    test finish in a second found the photo cutoff's timer never being
    cleared; it now is.
- **Full suite**: `10109 / 10109 / 0 / 0` locally, on the committed tree. A
  first run had 5 failures, all guards and harnesses:
  - the Dockerfile's worker tree gained `rendered-pictures.mjs`;
  - the held-unread exit passes the raw picker to the narrator, keeping one
    `modelsFor(body.picker)` and no `picker: body.picker`;
  - the 503 guard accepts `endTold`;
  - the `edit-lock` page harness gained the told-line helpers.
  A second run's one failure was the image-inputs test reading the new
  file before it was committed; it passes at HEAD.
- **Required CI on `ae905c3e`**:
  - unit tests run 37799832496: `10109 / 10072 / 0 / 37`. The totals match;
    CI skips the browser cases, 5 of them new;
  - site build run 37799832581: 8 of 8 jobs green.
- **The next image, predicted** (not built): `fbb1e9a1d0b70b11`, 199 inputs.

## Remaining gaps

- **Visibility in production stays unconfirmed** until the build's publish
  runs where the parser resolves (the container), or the parser is bundled.
- **A crashed or unsaved attempt leaves its claim standing**: later passes
  for the same facts never narrate. They deliver the facts (and keep any
  text already delivered). There is no time-out after which a claim may be
  retried.
- **The picture reader is bounded**:
  - it follows `-parts/<name>` imports, a `src` given as a string or a
    single `const`, and the same certainty rules as the menus;
  - `style` backgrounds, computed addresses, props and `.map` lists read as
    unknown, never shown;
  - a page's own picture never reached by its route reads as unknown unless
    proven dead.
- **Provisioning and schema failures** keep their technical answers (no
  message beyond the cost words), as outages.
- **Narration with a real model is unmeasured**: wording and cost per build,
  recovery, failed resume and inline failure.
- **Still open from earlier batches**:
  - the add-on's 240-character description cut;
  - the link count of 2;
  - P6–P11, and the first audit's open items;
  - `build_debit.sql` not applied;
  - recovery objects never deleted.
- **The .txt reminder** stays recorded for later.
