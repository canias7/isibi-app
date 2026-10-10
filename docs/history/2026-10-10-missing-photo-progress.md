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
- **Superseded by the second round below**:
  - lines written mid-job (now the real queued writer, PLW 1–4);
  - the thrown Build image step (now counted, uncertain apart from known);
  - the refused photograph's part ending `done` in the harness (found and
    fixed: the add-on's own evidence).
- Not deployed, not pressed.

## Second round (2026-10-10, after Codex's review of `f2ae6556`)

Codex independently passed the 24 missing-photo and Build-parallel tests on
`f2ae6556` (CI there: unit 38051538891 and site build 38051538922, both
green). The owner kept the empty fal balance as confirmed and asked for the
remaining gaps to be finished in this same correction.

### 1. The Add-on fixture ended `done`, the live request `partial`: found and fixed

- **Why live was partial.** The live designer wrote two requirements:
  - "The page shows a photograph of the bakers shaping loaves at the bench";
  - "A Meet the Bakers page with a link in the menu".

  The requirement evidence found no photograph made, so the first was told
  `still-to-do` (state `missing`) and the part became `partial@addon`
  (the run's stored answer, job `a547111c…`).
- **Why the fixture was done.** The fixture's designers wrote no
  requirement. With none, nothing in the add-on's answer said the photograph
  was not made: `notAdded` named a photograph only when its purchase was
  unconfirmed. So the part's status hung on a model writing a requirement.
- **Reproduced through the real route**, with the live request's words and
  requirements and a judge that answers by kind. The part ends `partial`,
  "The page shows a photograph…" is `still-to-do`/`missing`, and the page
  requirement is `set-up`/`unverified`, as live (MPH 10).
- **The layer fixed: the add-on's own evidence.** Every photograph the design
  asked for that the purchase did not make (refused, failed, or not
  affordable) is now `notAdded` with `why: "photo-not-made"`
  (`photosNotMade`, `builder/site-images.mjs`).
  - A photograph is skipped when it was made, is waiting on a purchase
    nobody can tell yet, or is already told unconfirmed.
  - A photograph a requirement names (by description, short name or page) is
    left to that requirement, so it is told once: MPH 10 asserts a single
    not-done entry.
  - A thrown purchase is told `purchase-unconfirmed`, never "not made".
- **Through the route**:
  - no requirement: `partial`, not done `[{ what: <description>, why:
    "photo-not-made" }]`, the reply writer given "…couldn't be made…", and
    nothing charged for the photograph (MPH 11);
  - control, the photograph made: `done`, nothing not added, charged once;
  - MPH 1's two-part request now asserts `["done", "partial"]` with the
    photograph not made.

### 2. A Build image step that throws: accurate facts, uncertain apart from known

- The build's `photos-missing` milestone is now read from each offered
  picture's own outcome (`pictureOutcomes`). It is read on the answer **and
  on the error** (`withPictureFacts` puts the outcomes on a thrown error), by
  `buildPhotoOutcome`, `builder/site-progress.mjs`. It counts three things
  apart:
  - **missing**: known not made, either refused or failed, or never tried;
  - **unsure**: nobody can tell, either a lost answer or a thrown step;
    never bought again;
  - **stored**: made and saved by the photo task before the step threw. It
    is said as saved and not placed, never lost (read from the photo task's
    own results).
- Each count is its own `notdone` fact, worded for what is true, and each
  stays as said on every later line.
- The missing list's header became "NOT DONE IN THIS WORK, AS IT STANDS (each
  stays exactly as said here…)", so a saved photograph is not told it "was
  never made".
- **The Add-on's thrown purchase is likewise unsure.** It is said "could not
  be confirmed as made", and its `notAdded` reads `purchase-unconfirmed`;
  before, its milestone said "could not be made".

### 3. The real queued writer while the job runs, with controlled timing

`test/progress-live-writer.test.mjs` holds an add-on job at three points:
- the photo service's call;
- the publish milestone's write to the record. The route does not wait for
  its milestones, so it goes on to its compile, which is held too;
- the compile, after the publish milestone landed.

At each point every queued writer task for the job is delivered to the real
queue consumer, which claims the writer, reads the job row (unfinished,
unpublished), calls the model and commits. Each request's whole text is
kept. Results:
- **PLW 1, refused**:
  - the line at the photo call says the photograph is still to make;
  - the next line is handed it `notdone` alone;
  - the later line, still during the job, carries "NOT DONE IN THIS WORK …
    could not be made" in its context;
  - three lines are committed;
  - the part ends `partial`, the reply writer is given it, nothing is charged
    for it, and the provider is called once.
- **PLW 2, storage failure** (made, never stored): pending on every line,
  never made or not made. The frame is marked, the part `uncertain`
  (`photos-pending`), bought once, never `photo-not-made`.
- **PLW 3, uncertain** (answer lost): pending on every line; a later sweep
  buys nothing again; not charged.
- **PLW 4, successful placement**: handed made and placed (not published); no
  line is told anything is not done; `done`; charged once.
- **A thrown image step** cannot be reached through either route offline:
  every fault inside a purchase is caught per photograph. Its facts are shown
  from the real producer of a thrown step's outcomes (MPH 13, MPH 14) and its
  wiring by source guards (MPH 9, MPH 14).
- **The Build path through its route**: BLD 13 (refused: "4 photographs could
  not be made") and BLD 14 (answers lost: "4 photographs could not be
  confirmed as made …", the resume buying nothing again).

### What the tests prove, and what they do not

- **Proven, model inputs**: the exact text each progress, reply and judge
  request carries, built by the product's own code. This covers the live
  writer path during a running job, the reply writer's facts and the
  requirement path. It includes which facts each line covers and in which
  state, and that the code commits only a line listing every fact in its own
  state.
- **Proven, outcomes**: the pages, statuses, not-done lists, purchases,
  provider calls and ledger reserves.
- **Not proven, real-model wording**: every model here is supplied (it
  repeats each fact as given). Nothing in code reads a line's words, so a
  real model could still word a line against its facts. The instructions and
  the facts are what stand against that, and no real-model call was made.
- **Not proven live**: nothing deployed or pressed. The image retry and the
  paid Build test stay paused until fal is funded.

### Verification

- **Tests**:
  - `test/progress-missing-photo.test.mjs`: 15 cases;
  - `test/progress-live-writer.test.mjs`: 5;
  - BLD 13 and BLD 14.
- **Red check** on `f2ae6556`'s product code:
  - PLW 1, BLD 13 and BLD 14 fail;
  - the missing-photo file cannot load (its new exports);
  - the storage-failure, uncertain and success controls pass there, as
    controls should.
- **Sweep**: 14 of 14 mutants killed; the comment-only control survived.
- **The 236 test files touching photographs, progress or add-ons**: 6,412 of
  6,412.
- **Full suite** locally: `10342 / 10342 / 0 / 0`. **Image and CI**: in the owner-notes handoff, stamped after the
  runs.
