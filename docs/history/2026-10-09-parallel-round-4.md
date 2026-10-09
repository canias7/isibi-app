# Parallel tasks, round 4: how a picture's purchase ended, stage by stage (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers and a stand-in image service only**, through the real Worker
> routes, request driver, queue consumer, build consumer and build resume,
> on a wire that refuses anything it was not set up for. No real model,
> image service or live site was asked anything.

The owner's order (2026-10-09, continuing from `f19e73f3`): close the
remaining purchase-outcome gap across Edit, Add-on and Build, and make the
test harness reject unexpected network requests. Codex's aggregate local
verification of round 3 was interrupted by its own automatic approval review,
which flagged possible access to the outside image service, so **that run is
not counted as passed**.

## 1. What Codex reproduced

Through the real request-flow fixture:
1. accept the TikTok-plus-photo request;
2. fail the next `uploads/<slug>/` write during the preparation;
3. deliver the preparation, then settle the request.

The mocked image service made the picture, the store failed, `makeSitePhoto`
answered no address, and `purchaseOnce` wrote `none`. The applying job then
bought it again: **two provider calls, both tasks done**. A missing stored
address does not prove that no purchase occurred.

## 2. The stages, told apart (`ad98d5f3`)

`genSitePhoto` threw on every failure, and `makeSitePhoto` turned every throw
into "no picture". It is now three stages, and the purchase hears each one:

| Stage | What the service's answer shows | The purchase record |
|---|---|---|
| **refused** | a 4xx other than a timeout, or a 200 naming no image: nothing was made. No key: refused before anything leaves | `none`: it may be bought again |
| **unknown** | the call left and no readable answer came back: a lost connection, a timeout, a 5xx, a 200 that does not read. It may have been made and paid for | left `buying`: unknown, held, never bought again on a guess |
| **generated** | made: the answer names where the service holds it | **`generated`, with its `source`**, written before the download |
| **download** failed | the made picture could not be fetched (three tries) | stays `generated` |
| **store** failed | it could not be put in the library (three tries) | its tagged photograph is looked for (a store whose answer was lost); otherwise it stays `generated` |
| **unusable** | made, and not a picture we may serve, or too big | `none` |
| stored | | `bought`, with its address |

- `askSitePhoto` is the call alone; `storeSitePhoto` downloads, sniffs,
  hashes and puts a picture **already made** — it never asks for a new one;
  `makeSitePhoto` runs them and tells the purchase it answers
  (`meta.generated(source)`, awaited before the download, and
  `meta.report(out)`).
- **A `generated` record is finished on the same picture by whoever reads it
  next**: the part's job, the driver's look on every step
  (`purchasesKnown`), a resumed build's image step. Not finished yet, the
  reader answers `store-pending`: a preparation ends `uncertain`, a job holds
  its part (nothing published, nothing charged), and the held answer says the
  picture was made and is being saved.
- **Only a refusal, a description never sent, or an unusable picture ends a
  purchase `none`.** A `generate` that throws before reporting is unknown.
- **Buy again** (the customer's say-so) releases a `generated` record too.
- Shared everywhere the purchase mechanism is used: the picture step's
  generator, the add-on's photographs and a first build's photo task all buy
  through `purchaseOnce` and hand its hooks to `makeSitePhoto` (a wiring
  guard holds the picture step's pass-through).

**Kept as they were**: the conditional claim (atomic ownership), the tag
lookup for a purchase that landed, the customer's buy-again, and an
independent part carrying on while one is held.

## 3. The harness

- **The real `fetch` is never put back.** The request-flow, build-lifecycle
  and build-route fixtures used to restore it when a case ended, so work a
  case left running could reach the network. They now put back
  `test/fixtures/no-network.mjs`'s blocking fetch: loopback, `data:` and
  `blob:` pass; anything else is refused and recorded.
- **Every catch-all records what it was not set up for** (the 503 a stand-in
  answers for an unknown address). The cron's other sweeps — scheduled
  functions, pending domains, the webhook queue and its cleanup, the rebuild
  queue — are answered explicitly.
- **A case ends once its background work settled**: the request-flow
  platform tracks every invocation a helper starts, and `P.settle()` waits
  for them with the stand-ins in place before closing. The build fixtures
  settle every background task, including ones started while others ran.
- The new file and the four parallel files block the network, settle each
  case, assert that nothing unexpected was asked for, and end with a check
  that nothing reached the blocking fetch.

## 4. Build

- **Retained and verified**: a first build's photographs are bought beside
  its page generation and joined at the image step (round 3).
- **The recorded untested case is now driven** (BLD 7): the first run buys
  nothing beside the pages (balance held for them); the resume's photo task
  begins all four and the image service holds them; the image step meets
  four purchases in flight, waits for each — none read as unknown, none
  bought twice — and places every picture.
- **A store failure beside the pages** (BLD 6): one photograph's store fails
  on every try of the task; its record keeps the source, the build is handed
  on with nothing in flight, and the resume's image step stores that picture.

## 5. Capability table

| Path | Parallel work |
|---|---|
| Edit: text, menu, picture, look, data, rules | full preparation beside another task's job; one purchase per picture across preparation, retakes and the job, now staged |
| Edit: page | full preparation: the rewrite and the tweak |
| Add-on, no new database; list entries | full preparation; its photographs bought by its job through the purchase record |
| Add-on that needs a new database | preparation up to its design (the provisioning boundary) |
| Edit: logo | routing only |
| Build: design | the existing design graph, unchanged |
| **Build: photographs** | **overlap the page generation**, joined at the image step, durable across resume and retry |
| Build: provisioning, schema, seed, fonts, compile, render check, publish | **sequential** |
| Writes to one site | one at a time, unchanged |

Build overlaps its photographs with its page generation and nothing else; it
is not "all Build tasks parallel".

## 6. Results

- **Commits**: `ad98d5f3` (the staged purchase, the harness, the tests),
  `d9e627ac` (the harness's own tests: the blocking fetch, and a case settling its held work), `22efbd19` (three cases the sweep asked for), and the records.
- **New cases**: 21, which takes the suite from 10200 to 10221: `test/purchase-outcomes.test.mjs` has 13 (PO 1–10, NET 1, NET 2 and a network check); `test/build-parallel.test.mjs` gains BLD 6, BLD 7, BLD 8 and a network check; each of the four parallel files gains a network check. PUR 6 now expects `generated` where it expected `buying`; the wiring and media guards were re-anchored to the staged chain; the add-on fixture gained an image key.
- **Red check**: run on `f19e73f3` with the new tests and fixtures copied in, before PO 9, PO 10, BLD 8, NET 1 and NET 2 were written: **8 of 17 fail**, each at its expected point. BLD 6 and PO 1–7 fail; for example PO 1 finds no photograph stored after the preparation (no retry), and PO 6 finds the purchase recorded `none` where it should stay `buying`. Nine pass there: BLD 1–5, BLD 7 (the in-flight join already worked in round 3, and is now driven), PO 8 (the refusal control) and both network checks.
- **Sweep**: **19 of 19 product mutants killed, and the comment-only control survived.** The first round killed 16 of 19 (on `d9e627ac`). Its three survivors became PO 9 (the tag is looked for before a download), PO 10 (buy-again releases a `generated` record) and BLD 8 (no key, no call), and the second round killed all three. One harness mutant, letting the blocking fetch through, was left out on purpose: run, it would send NET 1's request to the real image service.
- **Focused regressions**: 60 files (the parallel, build, purchase, publish-pages, image, site-images, site-reply, wiring, add-on and media files): **`1546 / 1546 / 0 / 0`** on `22efbd19`.
- **Full suite**: **`10221 / 10221 / 0 / 0`** on `22efbd19`. An earlier run on `ad98d5f3` read `10218 / 10218 / 0 / 0`; it started before NET 1 and NET 2 were committed and picked them up while running.
- **Required CI**: green. Unit tests on `22efbd19` (run 37876115564): **`10221 / 10180 / 0 / 41`**, whose total equals the local `10221` (CI skips 41 browser cases). Unit tests on `d9e627ac` (run 37875202176): `10218 / 10177 / 0 / 41`. Site build on `d9e627ac` (run 37875202126): green. `22efbd19` changes test files only, so it starts no site build.
- **Image** (predicted, not built): production `335396c8c0e0fbcb` → **`62a50cbb752edcc7`** (202 inputs). Round 3 had predicted `3200859f5ffd7283`; `worker.js` changed since.

## 7. Mocked versus live

- **Mocked**: every model answer, the image service (its refusals, its lost
  answers and 5xx, its downloads), the store's failures, Supabase's RPCs,
  the queue, the container.
- **Not shown live**: the real service's answers to a timeout or a 5xx
  (whether it made and charged the picture); how long its source addresses
  stay fetchable.

## 8. Remaining gaps

- **A call whose answer never came back** (a lost connection, a timeout, a
  5xx) stays unknown. The image service's synchronous endpoint has no
  idempotency key and no lookup, so it is held. It is bought again only on
  the customer's say-so, or it expires after a day.
- **A made picture's source address can expire.** How long the service
  keeps it is not measured. One that expires before any reader stores it
  leaves the part held until the customer's buy-again (PO 10).
- **Photographs bought outside the purchase mechanism.** A picture step or
  add-on that is not a request part has no purchase record. It gets the
  stage split and the retries, but a picture made and not stored there is
  told as not made (and not charged), and is not finished later.
- **An add-on's unknown photograph** still ends its part partial; it is not
  held and resumed.
- **Build overlaps only its photographs** with its page generation. The
  rest of a first build stays in order, and there is no live progress line
  during a build.
- **The harness guard covers what the fixtures route**: the new file, the
  four parallel files and the build fixtures. Other test files that stub
  `fetch` themselves keep their own catch-alls. Their leftover work now
  meets the blocking fetch rather than the real one wherever it goes
  through these fixtures, but no audit of every file was made.
- **No real-model, real-image-service or live run.**
