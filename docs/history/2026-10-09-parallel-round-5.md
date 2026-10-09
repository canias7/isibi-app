# Parallel tasks, round 5: pending add-on photos, Build's ready inputs, Build's live lines, and a seven-task batch (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers and a stand-in image service only**, through the real Worker
> routes, request driver, queue consumer, cron, build consumer and build
> resume, on a wire that refuses anything it was not set up for. Nothing
> here says how a real model answers, how good its work is, or how long
> anything takes live.

The owner's order (2026-10-09), after Codex reviewed `bc35a9b6` and ran 61
focused tests that all passed (purchase recovery, the in-flight Build image
join, the network guards): keep those fixes, do not restart the purchase
audit without a concrete regression, and close the remaining user-facing
gaps in one batch.

## 1. Add-on photographs waiting on a purchase (`b4fe40cb`)

Before: an add-on whose photograph's purchase could not be told (a lost
answer, a picture made and not stored) published its page with an empty
frame and ended the part **partial**. Nothing came back for that frame.

Now:
- **The frame is marked.** `markPending` (`builder/site-images.mjs`) turns
  the token's `src="…"` into `src="" data-pending-photo="<purchase id>"`. The
  page is published as before; only that frame waits.
- **The part is held, not ended.** The add-on answers `pendingPhotos` (id,
  description, slot, file). The request driver sets the part `uncertain`
  with `why: photos-pending`, records that the addition is already published
  (`published: true`) and keeps what is still to place (`place`).
- **When the purchase is known, a placement step runs**, not the addition.
  `purchaseResolved` turns the part into a picture job carrying `place`: the
  picture route reads each purchase on its record (`purchaseOnce`, never
  bought blindly), puts each photograph into exactly its marked frame,
  publishes once and charges the photographs it placed, by count.
  - A purchase still unknown keeps it held (`heldPurchase`).
  - A frame a later change took away (`frame-gone`), or a purchase that
    ended with no picture, is told in `notPlaced` and the part ends partial
    with that reason.
- **Independent parts carry on** meanwhile, and the customer resends
  nothing.
- **Held past a day with nobody able to tell**: the addition is live, so the
  part ends **partial** (`photos-unconfirmed`), never "expired".
- **What the customer is told**: a `pendingPhotos` fact says the photograph
  is not on the page yet, why, that it was not bought again, and that it
  will be placed by itself. A `notPlaced` fact says why a photograph was not
  placed. The card reads **"Added — photo still being confirmed"**
  (screenshot sent in the chat).
- Tests: `test/addon-pending-photo.test.mjs`, APH 1–4 and a network check:
  store failure then automatic placement; a lost answer then buy-again; the
  frame gone; expiry.

## 2. Build: what actually depends on what (`458080fb`)

Read from the code, step by step:

| Step | Needs | Overlaps now |
|---|---|---|
| research | the brief | already an early promise (unchanged) |
| design | the brief | the existing design graph (unchanged, not counted as new) |
| provisioning | the design's tables | — feeds schema, jobs and seed |
| schema, seed | the database | — |
| look merge | the stored look | — |
| page writing | the design | — |
| photographs | the design | beside the page writing (round 3) |
| **fonts** | the design's CSS | **started at the image step, beside the photographs** |
| **translations** | the written pages' words | **started at the image step, beside the photographs** |
| compile, render check, publish | everything above | — |

- **Fonts** (`fontsFor`): fetched once, lazily. The first run, which hands
  the page writing to the container and never compiles, fetches none. The
  resume starts the fetch at the image step and the compile awaits that one
  answer.
- **Translations** (`translationsBeside`): each language's missing strings
  are asked at the image step. The compile's own loop receives that answer
  once, through a local shadow of `translateStrings`, so its loop, rounds
  and checks are unchanged.
- Both are settled at the end, so nothing is left running.
- **Kept sequential on purpose**: provisioning → schema → seed (each needs
  the previous one), the look merge, the compile, the render check and the
  publication. The one-page and fifteen-component maxima are unchanged.
- Test: BLD 9 (`test/build-parallel.test.mjs`). The purchases are held until
  both the fonts and the French translation have been asked for: one fonts
  fetch and one translation call, both made before any photograph's
  purchase ended, and every picture placed.

## 3. Build: live lines written by the model (`b59ba99b`)

- **A first build has its own progress record** (`op: "build"`), opened as
  soon as its site's address is known. Steps before that are kept and sent
  then.
- **Each step the build's trace really records becomes facts**
  (`buildStepFacts`): designed; the database prepared; tables made;
  starting entries filled; the pages being written; photographs started
  beside them; the page writing out; **waiting for N photographs still
  being bought**; **a photograph recovered rather than bought again**;
  photographs placed; the compile and render check before publication.
- **Preparation is never called published.** Every fact that names
  publication says "not published yet" or "before it is published", and no
  fact is stated as applied. The build's own reply says what was published.
- The existing progress writer turns the facts into the model's lines.
- **The resume takes the record over** under its own lease
  (`takeOverRecord`). The old run's delivery numbers are dropped so the new
  run's milestones are not read as repeats. The record closes at the
  build's end.
- **The two-minute progress sweep now covers build jobs**, so a lost message
  is asked for again.
- **The poll** returns the lines on the hand-on answer and while pending,
  and the stage panel draws them under its rows (screenshot sent in the
  chat).
- Tests (`test/build-parallel.test.mjs`):
  - BLD 10: through the real consumer, progress task, poll and resume. The
    record's marks come from real steps; the lines are the writer's; the
    poll carries them; the resume takes the record over, says it recovered
    the made-but-unsaved photograph, says the compile comes before
    publication, and closes the record.
  - BLD 11: the wait is on the record and written by the model **while the
    purchases are still held**.
  - BLD 12: the lost message is found by the sweep.

## 4. The seven-task batch (`8410e6a2`)

`test/parallel-batch.test.mjs`: one message, seven tasks, more than the
three preparations allowed at once (`PREP_MAX_LIVE`):

| # | Task | Kind | What it exercises |
|---|---|---|---|
| 0 | TikTok link on the Visit page | text | runs first; its model call is held |
| 1 | a loaf photograph on the home page | picture | independent; its store fails three times (**recoverable failure**) |
| 2 | a gallery link in the menu | menu | named before the page it needs (**reverse order**) |
| 3 | the home heading | text | shares the home page with 1 (**conflict**) |
| 4 | a shop-front photograph on the Visit page | picture | shares the Visit page with 0; asks a question (**clarification**) |
| 5 | the About heading bigger | page tweak | independent of 0 |
| 6 | a gallery page | addition | creates the page 2 links to |

Every step after the message is the queue's or the cron's, with no page
open. The one exception is the answer to the question, which is the
customer's own message.

**What the first case proves:**
- **Limit**: three preparations claimed at acceptance (parts 1, 3, 4); the
  other two waited, and no more than three ever ran at once.
- **Overlap**: while task 0's job sat in its model call, the loaf photograph
  was chosen and bought, and five other tasks were routed. Two of them (5
  and 6) were routed only after an earlier preparation freed its slot.
- **Waits that must stay**: the heading's step waited for the photograph
  (same page); the shop photo's question waited for the TikTok change (same
  page); the About tweak waited, because the page step's fallback writer is
  shown every page. Each of those preparations stopped at its routing.
- **The menu link** ran after the gallery page existed.
- **The recoverable failure**: the loaf preparation ended uncertain. The
  part's job stored the same made picture; it was never asked of the image
  service again.
- **The clarification** paused only its task. The answer resumed it without
  the message being sent again.
- **Every change kept**: the link, both photographs, the heading beside the
  photograph, the About heading with its words kept, the gallery page, and
  the menu link exactly once on every menu.
- **Nothing done twice**:
  - eight routing calls: the message, six parts, and the answer;
  - one call per text, tweak, menu and addition step;
  - three picture calls: the loaf; and the shop's question and its answered
    request;
  - two purchases;
  - six publishes (the menu link was already there, put by the addition,
    so its part was satisfied with nothing published);
  - no job charged twice; each photograph billed once, to the job that
    placed it; the job that asked the question charged nothing.

**The second case** delivers every queued message twice and reaches the same
end state, with the same counts.

**What the batch found and fixed.** A preparation that ends uncertain
(its photograph made and not stored) had answered its routing and its step's
picture call, but `stagePrepared` staged only the attempt before it. So the
part's routing job and run job asked both calls again. They now receive the
uncertain attempt's own recorded answers as well. The picture itself stays
the part's logical purchase.

## 5. Capability table

| Path | What overlaps | What stays sequential |
|---|---|---|
| Edit: text, menu, picture, look, data, rules | full preparation beside another task's job; one purchase per picture | a step whose inputs an earlier, unapplied part writes (same page, menu, page list) |
| Edit: page (tweak, rewrite) | full preparation when no earlier part writes a page | behind any earlier unapplied page write: its writer's fallback is shown every page |
| Add-on, no new database; list entries | full preparation; photographs through the purchase record; **a photograph whose purchase is unknown is placed later into its marked frame** | its work waits for earlier page changes (its writer reads the pages); a later routing waits for an addition (it changes the page list) |
| Add-on needing a new database | preparation up to its design | provisioning onward |
| Edit: logo | routing only | its step |
| Build: design | the existing design graph (unchanged) | — |
| Build: photographs | beside the page writing, joined at the image step | — |
| **Build: fonts, translations** | **beside the photographs, from the image step** | — |
| Build: provisioning, schema, seed, look merge, compile, render check, publish | — | **sequential**: each needs the previous one's output |
| Writes to one site | — | one at a time (the site's lock) |
| Preparation slots | up to 3 at once; a freed slot is refilled when a preparation ends | — |

## 6. Results

- **Commits**:
  - `b4fe40cb` (pending add-on photos);
  - `458080fb` (fonts and translations beside the photographs);
  - `b59ba99b` (Build's live lines);
  - `8410e6a2` (the uncertain preparation's own answers, and the batch);
  - `8753a065` (three guards re-anchored, and BLD 12);
  - `be9803a0` (APH 5, from the sweep);
  - and the records.
- **Red check** on `bc35a9b6`, with the new tests and fixtures copied in:
  **9 of 9 new behaviour cases fail**, each at its expected point:
  - APH 1–4: the photograph ends `purchase-unconfirmed` instead of being
    placed;
  - BLD 9: "the first run fetched fonts it never uses";
  - BLD 10: "the first run opened no progress record";
  - BLD 11: no line said the build was waiting;
  - BATCH and BATCH 2: "a routing was asked twice", 9 against 8.
  The controls pass there: BLD 1–8 and the network checks (11 of 20 in all).
  BLD 12 was written after the red check.
- **Sweep**: **20 of 20 product mutants killed, and the comment-only control
  survived.**
  - The first round (on `8753a065`, 21 mutants over the seven touched test
    files) killed 19 of 20. The survivor, `place-no-hold` (the placement
    step ignoring a purchase still unknown), had no case reaching it.
  - It became APH 5, and the second round killed it, the control again
    surviving.
  - No mutant touched the network block.
- **Full suite**: **`10234 / 10234 / 0 / 0`** on `be9803a0`. That is
  round 4's 10221 plus 13 new cases: APH 1–5 and a network check; BLD 9–12;
  BATCH, BATCH 2 and a network check.
  - An earlier run on `8410e6a2` read `10232 / 10228 / 4 / 0`. Four guards
    had been moved by the round, all re-anchored in `8753a065`:
    - the picture lane's billing guard took the placement step's response;
    - three rail harnesses lacked the new line renderer.
- **Required CI**: green on `be9803a0`.
  - Unit tests (run 37882218749): **`10234 / 10193 / 0 / 41`**, whose total
    equals the local count (CI skips 41 browser cases).
  - Site build on `8410e6a2` (run 37881463668): green. Only tests changed
    after it, so no later site build ran.
  - Unit tests on `8410e6a2` (run 37881463764) failed on the same four
    guards: `10232 / 10187 / 4 / 41`.
- **Image** (predicted, not built): production `335396c8c0e0fbcb` →
  **`54baf083174f53a5`** (202 inputs). Round 4 had predicted
  `62a50cbb752edcc7`; `worker.js` changed since.

## 7. Mocked versus live

- **Mocked**: every model answer (routing, text, pictures, tweak, menu,
  add-on, page writer, translation, progress lines), the image service and
  its store failures, fonts, Supabase's RPCs and job table, the queue, the
  cron and the container.
- **Not shown**:
  - live overlap or timing;
  - whether a real model writes good lines from these facts;
  - whether a real router names targets well enough for the waits;
  - the real image service's behaviour on a lost answer.

## 8. Remaining gaps

- **An add-on photograph cut off by the add-on's own time limit** (still in
  flight when the step's wait ended) is not marked; it is told as
  unconfirmed, as before.
- **A token that is not a whole `src="…"` attribute** cannot be marked; it
  is swept as before and told.
- **Photographs bought outside a request part or a build** have no purchase
  record (unchanged).
- **The image provider has no idempotency key or lookup**: a lost answer
  stays unknown and held (unchanged).
- **A page step waits behind any earlier page write**, because its fallback
  writer is shown every page.
- **Build live lines** are written on the queued build path. A build run
  inline by the route (not queued) writes none.
- **The picker for a build's lines** is the default quick model; the build's
  own picker is not carried to its record.
- **No real-model, real image service or live run.**
