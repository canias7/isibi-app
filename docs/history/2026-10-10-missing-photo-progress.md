# A failed photograph stays missing in every later progress line (2026-10-10)

## The finding

The approved Add-on press (Actions run 38049499667, `fold-lane-bakery`) added a
Meet the Bakers page and its menu links. Its one photograph was planned,
offered and not made (`photos: planned 1, offered 1, made 0`, in 2.6 s). At
356 s, a model-written progress line said the page was added *"with a
photograph of you shaping loaves at the bench"*.

**The owner confirmed that fal's balance is empty** and asked for that to be
treated as the known reason image generation is unavailable. The image retry
and the Build test stay paused until they fund fal. No top-up, deploy or paid
test.

## Why the line said it

- The pages milestone is recorded **before** any photograph is bought. It
  said "New page written, not published yet: /bakers" and nothing about the
  photograph.
- **No milestone came from the purchase.** Whatever the purchase did, made,
  refused or thrown, the writer was never told.
- The writer's context carries the customer's own words ("…with a photograph
  of us shaping loaves at the bench"). With no fact about the photograph,
  those words were the only thing it read about it.

## The fix: what the writer is told (the lines stay model-written)

1. **The pages milestone names each photograph still to make**, by its
   description, as `next`: "…not on the page yet" (`addonPagesFacts`,
   `photos`).
2. **A photographs milestone after every purchase outcome** (`addonPhotosFacts`,
   marked `photos` in the add-on route):
   - made and placed: `prepared`, "…was made and put on the page. Not
     published yet.";
   - refused, failed, not affordable, or the whole purchase thrown: `notdone`,
     "The photograph “…” could not be made, so its place on the page is left
     empty.";
   - a purchase nobody can tell yet (the answer lost) is not judged here: the
     publish milestone already says it is still being confirmed, as before.

   It is marked on all three paths: the purchase's result, its `catch`, and
   the case where the balance could pay for none.
3. **Every later line is told what is still not made.** `missingFacts(rec)`
   lists every `notdone` fact already said, given up or set aside.
   `progressContext` adds it after the earlier updates, as "STILL NOT MADE IN
   THIS WORK (these stay missing; never say or suggest any of them was
   made)". A `notdone` fact still in the batch is in the batch, not the list.
   This covers every job kind that records `notdone` facts, including an
   edit's failed step on a correction's line.
4. **Two writer rules** (`PROGRESS_SYSTEM`):
   - what they asked for is not what was made: describe only with what the
     facts say, never with details from the request that no fact states,
     such as a photograph;
   - anything still not made stays missing in every update.
5. **The build path** marks `photos-missing` from the purchase's own result:
   the tokens tried or past what could be paid for, less what was made. It is
   said as `notdone` ("4 photographs could not be made, so their places on the
   pages are left empty."), on the live lines and in every later one. It is
   mapped to the `publish` phase in `build-budget.mjs` and added to the
   canary's list of fixed build sentences.

Nothing the successful work did changes: the page, its menu links, the other
pages, the reply and the billing are untouched. A photograph not made was
already not charged (`made`, never `planned`).

## Verification (offline, supplied model, stand-in services)

- `test/progress-missing-photo.test.mjs`, 10 cases:
  - **MPH 1**: through the real Worker (routing, add-on route, queue consumer,
    request driver), with the photo service answering 403 "Exhausted
    balance":
    - the Visit change and the new page are kept, with an empty frame and no
      token;
    - the pages milestone says the photograph is still to make;
    - the photographs milestone says it was not made, by its description;
    - no fact anywhere states it as made;
    - it is not charged.
  - **MPH 1's later lines**: the route's real milestones are replayed through
    the writer's own functions (`claimWriter`, `batchFor`, `progressContext`,
    `progressRequest`, `commitLine`), a line per milestone and with pages and
    photographs in one line. Every request after the one carrying the
    not-made fact lists it as still not made.
  - The replay is needed because in this harness the job ends before a queued
    writer task is delivered, so no line is written live.
  - **MPH 2** (control): the photograph made. It is said made and placed, no
    line is told anything is missing, and it is charged once.
  - **MPH 3** (control): the answer lost. It is said as still being
    confirmed, never made or not made, and not charged.
  - **MPH 4–8**: the facts, the missing list (said, given up, set aside, once,
    pending excluded), the request's order, the two rules, and the build step.
  - **MPH 9**: the wiring. The Worker's writer hands its claimed record to the
    context, the photographs milestone is marked on all three purchase
    outcomes, the pages milestone gets the photographs, and the build's mark
    comes from the purchase's result.
- **BLD 13** (`test/build-parallel.test.mjs`): a first build with every
  picture refused. The pages are published with no token and nothing stored;
  `build-photos-missing` says four not made, before the compile; nothing says
  placed; every later replayed line lists them as still not made.
- **Red check** on the old product code with the new tests:
  - BLD 13 fails;
  - the new file does not load, because the exports it tests do not exist.
- **Sweep**: 18 of 18 mutants killed, the comment-only control survived.
- **Full suite** locally: `10331 / 10331 / 0 / 0`. **Image** predicted `8d6dbcea93252fbb` → `21350e8c8a057be4` (204 inputs, 173 paths). CI is stamped in the owner-notes handoff.

## Limits, kept explicit

- **Real-model wording is not measured.** The writer here is supplied, and
  nothing in code reads a line's words (the standing limit in
  `site-progress.mjs`). What is proven is what the writer is told on every
  line.
- **Live lines are not shown being written mid-job in the request harness.**
  The later-line property is shown by replaying the route's real milestones
  through the writer's functions.
- **A build whose whole image step throws** says nothing about missing
  photographs: only a purchase that returns is counted.
- **In the request harness, the refused photograph's part ends `done`.**
  Live, the press ended `partial@addon`. The harness does not reproduce what
  made it partial live, and these cases do not assert the part's status.
- Not deployed, not pressed.
