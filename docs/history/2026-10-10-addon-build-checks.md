# The Add-on-with-photograph and first-Build checks, prepared (2026-10-10)

Codex reviewed `2399f359` and confirmed run 118 (runtime) and run 119 (live).
On the owner's word, the dispatch-order correction is closed as verified for
the demonstrated case (`2026-10-10-run119.md`, *Closed*). This round prepares
the two remaining checks together.

Nothing was merged, deployed or built. No paid call, no model call, no
balance change and no live write was made. Every reading below is a free
GET or a read-only select.

## What was reused

- **The request canary** (`scripts/canary-ui.mjs`, `edit-canary.mjs`,
  `canary-requests.mjs`):
  - request mode, `away: "fresh"` (the tab closed once a progress line
    shows, then a fresh browser session signed in afresh);
  - `expect.progress` (the model's own lines, eight checks);
  - `newPagesFound` and `outcomeChecks`, which hold every existing page
    byte for byte apart from the named changes;
  - the money check by the press's own charges (`ownMoneyVerdict`);
  - the funds-first and hard-cap preflight.
- **The build's own records**: the `site_builds` trace (steps with their
  numbers), the build poll's served progress lines, the stored source
  (`GET /api/site/source`), the owner's upload list
  (`GET /api/site/<slug>/uploads`) and the ledger (`credit_events`).
- **The build-as-owner workflow**: its admin sign-in, deploy wait and
  artifact.

## The concrete gaps found

1. **The Add-on press had no photograph check.** `newPagesFound` found the
   page by its words only. A page placed with one of the site's earlier
   pictures, or with none, or a photograph bought twice, passed. Red check:
   on the code before this round, such an add-on got no photograph check at
   all; it now fails on *"the site's uploads gained exactly 1 new image"*.
2. **No first-Build press checked anything.** `build-as-owner.mjs` logs a
   build and asserts nothing. The UI canary refuses builds (`blocksPost`).
3. **Build overlap is recorded as durations, not intervals.** That is still
   proof. Real rows of the building account, read 2026-10-10:
   - `repairbench-1` (2026-09-13): 16 design agents, `agentMs` 519,892
     inside `waveMs` 232,324; 8 page bands, `agentMs` 416,144 inside
     `waveMs` 69,459;
   - `the-hot-plate` (2026-10-04): a single-call design and `bands:sync`
     (no split).

   A sum of calls longer than the wall they fit inside means two calls ran
   at once. The band split is on for the building account by default
   (`BAND_SPLIT_CANARY` falls back to its uid in `deploy.yml`). The design
   graph's default is off. Photographs that finish while the pages are
   written leave no end time the press can read: the purchase records are
   in R2, which the runner cannot read.
4. **The browser has no way back to a build in flight.** `followBuildJob`
   runs only in the tab that sent the build. A closed and reopened browser
   does not re-attach (the build itself carries on, server-side). **This is
   a product gap**, recorded and not fixed here; the build check tests the
   API path instead.

## The Add-on press: `lv-addon-photo`

One message on `fold-lane-bakery`, in request mode:

> Add a Meet the Bakers page with a link in the menu, introducing the three
> of us who bake through the night, with a photograph of us shaping loaves at
> the bench.

Read live before choosing it (free GETs): the bakery's pages are `/`,
`/allergens`, `/bake-list`, `/classes`, `/faq`, `/gallery`, `/order`,
`/starter`, `/tasting-evenings`, `/visit` and `/wholesale`. None is about
its bakers, and no scenario has asked for one.

**Pass conditions** (every one must pass):
- the request's own checks, its job order and the replies on screen;
- **the new page**: a route the sitemap did not have, about "baker", served
  200, with a stored page file;
- **the menu**: every page's menu gained one labelled link to it and kept
  every item in order, and every served header links it;
- **the photograph** (`photoChecks`, new):
  1. the new page's stored file shows exactly one of the site's own
     photographs;
  2. the served page draws it with words describing it (`alt`, at least
     three characters);
  3. its address serves an image (200, `image/*`, over 1,000 bytes);
  4. the site's uploads, read before and after, gained exactly one new
     image, and it is the one placed: bought once, none stored twice, none
     taken from the site's earlier pictures;
- **everything else as it was**: every existing stored page byte for byte
  apart from the menu link; no page removed; no other file or component
  added beyond the new page's; the description, the logos and the tables
  as they were; every page served before still 200;
- **progress and closure**: a line on screen live in the sending tab; that
  tab closed while the request ran; the list alone read; a fresh session
  signed in afresh found it, showed every earlier line and followed it to
  its end; each part named by the model's own lines;
- **money**: its own charges add up and are no more than the balance's move.

**Fail conditions**: any check above failing; the preflight stopping it
(balance below 45 or above 1018, `REQUEST_FLOW` or `PROGRESS_REPLIES` off).

**Expected cost: about 33–41 credits.** The routing call 1–3; the add-on
with a page and its menu link 12–18 (runs 99, 101 and 103); the requirement
judgment about 1; the photograph 19 (fal's 0.15 dollars at 0.008 a credit).
**Budget 45, hard cap 1018.** The page and the photograph stay.

**The boxes** (edit canary, *Run workflow*): *RUN A NAMED SCENARIO…* →
`lv-addon-photo`; the spend box → `yes`. Nothing else.

## The first-Build check: `build-as-owner`, mode `check`

One fresh build of **`copperleaf-tea-room`** (it answers 404 today, read
free), with a brief that asks for one page and photographs of the room and
the cakes. Implemented in `scripts/canary-build.mjs` (verdicts and driver)
and `scripts/build-check.mjs` (its network), reached from
`build-as-owner.mjs`.

**How it runs**:
1. sign in;
2. read the balance;
3. confirm the slug is not a site;
4. **stop unless spend is `yes`** (a free rehearsal);
5. mark the ledger;
6. POST the build;
7. **the sending session makes no further call**;
8. sign in afresh and poll the build every 6 s to its end (at most 25
   minutes);
9. read the trace, the source, the served page, each photograph's bytes and
   the uploads;
10. wait 60 s and read the balance and the ledger.

**Pass conditions** (19 checks, every one must pass):
- **closure**: accepted 202 with a job; the sender silent after it; a
  session signed in afresh as the same account read the build's own final
  answer (ok, naming the site); the site serves 200;
- **shape**: the source read whole; **exactly one page**; **at most 15
  components drawn** (every kit module the page imports apart from the
  chrome, plus every component written for the site). This is stricter
  than the plan's own cap, which bounds the names the designer may choose;
- **overlap, by recorded evidence**: the bands' summed calls past their
  wave's wall by at least 1 s with two or more bands written; or the design
  agents' the same; or a photograph begun before `gen` and still being
  bought (`photos-wait`) when the pages came back;
- **order**: the record reads done and ok. The design comes before the
  database and the pages; the database before the pages; the pages and the
  photographs joined before the compile; the compile before the publish;
- **progress**: a line served while the build ran (202); every line the
  model's own sentence, never a step's fixed fact (all 106 of them are
  checked); no line lost or rewritten between reads;
- **photographs**: at least one placed; each drawn with words describing it;
  each address serving an image; every image stored is placed, or recorded
  unused by the trace (`photos-joined.unused`). An image nothing accounts for
  is a second purchase;
- **money**: every `build:<job>` ref debited once; the net more than nothing
  and no more than the balance's move; other activity told, never failing.

**Fail conditions**: any check failing. Most likely:
- **the overlap check**, if the band split was refused (`bands:<why>` in
  the trace), the design was a single call, and every photograph finished
  while the pages were written. The check then fails and names what it
  saw; it is not loosened;
- **the component count**, if the page imports more than 15 kit modules.

**Expected cost: about 30–65 credits.** A first build has measured 11–45
(`ashgrove-1` 45 with two photographs); each photograph about 19, inside the
pages' charge. **Budget 70, hard cap 1018.** The site stays.

**The boxes** (build as owner, *Run workflow*): *build | edit | check …* →
`check`; *check only: yes sends the build* → `yes`. Leave the rest. With
`no`, the press runs the free preflight and stops.

## Dependencies and publishing

- **The add-on**: the existing request checks hold the order. The page's job
  runs and publishes before its menu link is reported. The photograph is
  placed in the same publish, or marked pending and placed by the placement
  step (round 5). The uploads read after the request ends sees it either
  way.
- **The build**: the order check above, read off the trace.

## The deployed image supports both

- **The branch's product code is byte for byte deployed `main`**
  (`f96cbfd5`, deploy 2191): `git diff origin/main` over `worker.js`,
  `builder/`, `public/`, `site-uploads.mjs`, the `Dockerfile`,
  `wrangler.jsonc` and `.github/scripts/` is empty. This round changed only
  `scripts/`, `test/` and two workflow files. `scripts` and `test` are in
  `.dockerignore`, and the presses run on the GitHub runner.
- **The predicted image for `4273ba32`** is `8d6dbcea93252fbb` (204
  inputs), the deployed one. **No container
  rebuild and no deploy is needed** before either press.
- **What the presses rely on is deployed**:
  - the build trace marks (photos beside the pages, bands, design);
  - the build poll's progress lines (`PROGRESS_REPLIES` on since deploy
    2186);
  - `purchaseOnce` and the add-on's pending frames;
  - the source and upload routes.
- **Both presses refuse when a switch is off.** The add-on press's
  preflight reads progress on. The build check reads whatever the build
  records, and fails on a missing record rather than passing.

## Tests

- **`test/canary-addon-photo.test.mjs`**, 8 cases:
  - the scenario guard;
  - the photograph's four checks, passing;
  - every failure, each caught by its own check: none placed, two placed,
    no words, a dead address, an earlier picture, bought twice, the bought
    one not the placed one, a document, unreadable uploads;
  - the readers;
  - the verdict carried through `outcomeChecks` and `requestBatchVerdict`,
    passing, while a changed existing page still fails;
  - the press's readings in order (uploads before the send; bytes and
    uploads after; handed to the verdict);
  - the press driven end to end offline through the real canary driver
    (`runUi`): sent once, first line live, tab closed, fresh session, every
    progress and reply check passing;
  - the preflight at 44 and 1019.
- **`test/canary-build.test.mjs`**, 14 cases. Every verdict on the real
  recorded shapes above and on every failure:
  - the shape;
  - the overlap: bands, design, photos; and the-hot-plate, photos finished
    in time, one band, within the slack, a wait before the pages, malformed
    steps;
  - the order: each step out of place;
  - the progress: fixed fact, lost line, rewritten line, end-only lines;
  - the closure;
  - the photographs: an extra image, which passes when the trace records it
    unused;
  - the money: twice, above the move, nothing, another job's ref;
  - the preflight;
  - the press end to end offline under a stand-in for every network call:
    one POST by the first session, every poll by the fresh one, 19 checks
    passing;
  - its failures reaching the verdict;
  - the free rehearsal and the refusals;
  - the wiring into `build-as-owner` and its workflow.
- **Lists updated**: the funds-first and menu-word scenario lists, and the
  scenario box's description.
- **Red check**: both files fail at import on the code before this round.
  The reused-picture add-on gets no photograph check there, and the
  uploads check here.
- **Sweep**: 33 mutants, 33 killed, 2 comment-only controls survived. The
  first pass left 4 survivors:
  - 3 were test gaps (the photograph checks not required to pass through
    the press's verdict; `done: false` not tried; a fact line that also
    rewrote a line), each closed by an assertion;
  - 1 was an equivalent mutant: a `<meta>` strip that could never matter,
    since only `<img>` tags are read. That dead line was removed.
- **Full suite**: `10317 / 10317 / 0 / 0` locally, on `4273ba32`'s code
  (10295 before this round, plus the 22 new cases).

## Limits, kept explicit

- **The build's browser closure is tested on the API path.** The browser
  itself has no way back to a build in flight (gap 4).
- **The overlap proof depends on what the build records.** It can fail
  honestly on a build whose parallel work left no interval.
- **"Bought once" is read from the uploads and the trace.** The purchase
  records in R2 are not readable by a press.
- **The component count is every component drawn**, not the plan's names.
- **Neither press has run.** Its costs are estimates from measured runs, not
  limits. Only the balance window bounds a press.
