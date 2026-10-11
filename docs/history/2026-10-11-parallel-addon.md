# 2026-10-11 — Independent work inside an Add-on, and Add-on parts beside each other

The owner's goal: *"when a user requests independent tasks — for example,
generate an image and create a component — both should actively run at the
same time. Only work that genuinely needs another task's result should
wait."* Codex checked `ecb7484a`: 57 existing parallel tests passed with
mocked providers, but the capability was only partly there.

**Commits**: `82194718` (the change and its tests), with records after.
**Image prediction**: production `8d6dbcea93252fbb` → `d8f11fccd7446ba8`
(205 inputs, on `82194718`). Not built.
**Base**: `ecb7484a`. No merge, deploy, container build, paid call, real
image, fal call, balance change or flag change.

## 1. The gaps, reproduced first

Each is a committed case in `test/parallel-addon-independent.test.mjs`
that **failed on `ecb7484a`'s code**. They go through the real request
driver, queue consumer, routes and job runner, with supplied model answers
and mocked pictures. Each independent pair meets at a **rendezvous**: a
mocked call that cannot finish until the other task's call has started (or
2.5 s pass). So a pass proves both were running at once. Queued statuses
or a routing overlap would not.

1. **Inside one Add-on (PI 1)**:
   - The designers ran one after another. The component designer arrived
     2.5 s after the photo designer gave up.
   - The photograph was bought only after `generateSitePages` had returned
     (`buySitePhotos` came after it).
2. **Two parts, image first (PI 2)**: the component's part could not be
   prepared beside the photograph's job.
   - `stepInputs` planned every Add-on as reading
     `pagelist, theme, menu, pages, images`.
   - The photograph's `images` write therefore "fed" it.
3. **Two parts, component first (PI 3)**: the same block in the other
   direction. A `new-component:` write fed every `page:` input.

**Red checks** on the final tests:
- the planner reverted to `ecb7484a`: PI 2 and PI 3 fail, each part meets
  no one;
- the Worker's scope switched off (`aScopeIn = null`), planner kept: PI 2
  and PI 3 fail on the evidence. The second part's job **replayed 0 and
  asked 3 fresh** (picker, designer, page writer): its prepared requests no
  longer matched, because its designers and page writer were still shown
  the page the first part had changed.

So changing the planner alone would only have bought wasted calls. The
model inputs had to be narrowed to what the plan says the part reads.

## 2. What changed

### Inside one Add-on (`worker.js`, the add-on route)

- **Designers start together.** Before the loop, every designer from the
  current one up to the next one that changes the site's facts
  (`aChangesSite`: a schema kind or `page`, which rebuild `aSite`) is
  started at once.
  - Each early answer is kept with the exact request it was made from.
  - In its turn, a designer's early answer is used **only if its request is
    still byte-identical** (the same site facts and the same hand-off brief
    from `requirementBrief`). Otherwise it is asked again (`aMark("add:<kind>",
    "again")`).
  - So a designer that genuinely needs an earlier designer's result (a
    schema change, a judged requirement handed to it) never acts on a stale
    answer.
- **Photographs are bought beside the page writer.** The photo designer's
  descriptions are all the purchase needs. So `startBuildPhotos`, the Build
  path's task, now with a `part` and a `reserve`, starts them under the
  job's logical purchase before `generateSitePages`.
  - Integration still waits for both. `buySitePhotos` runs after the page
    writer has placed the tokens, and its buyer joins each in-flight
    purchase (`purchaseBuyer`'s `pending`).
  - A purchase still out when the step's own wait ends becomes durable
    pending work, as before.
  - Not in a preparation (`!aPrep`), which never buys.
- **A joined purchase's own ending is the answer** (`purchaseBuyer`). Found
  by PI 8:
  - re-reading the record after the join turned an image-service refusal
    (`none`) into a second purchase;
  - now the joined task's result is returned;
  - a bought one is plain reuse, so a recovery is not told twice (Build's
    BLD 10 guards that).
  - This also covers the Build path, which uses the same buyer.

### Between parts (`builder/request-plan.mjs`, `builder/request.mjs`, `worker.js`)

- **`addonScope(part)`**: an Add-on part whose every named write lands on
  pages the router named, and which declares no read, is scoped to those
  pages. Such a write is the page itself (`page:`), a component made or
  changed for it (`new-component:`, `component:`), or a picture placed on
  it (`images`).
  - No scope for a new page (its writer copies the pages beside it), a
    menu, a table, the whole site, a declared read, a routing or an edit
    step.
  - **`stepInputs`** for a scoped Add-on is `pagelist, theme, page:<each>`.
- **What a part places lands on the pages it names** (`partFeeds`, used by
  `clearToPrepare`):
  - an `images` or `new-component:` write feeds a page input only if the
    writer names that page;
  - with no page named, it may land anywhere, as before;
  - `component:` (an existing component, which may render anywhere), the
    look, the menu and the rest are unchanged;
  - **`conflicts` is unchanged.**
- **`jobBody`** sends `scope` on a prepared Add-on part's body (its
  preparation and its job alike), as it already did for a text or data
  step.
- **The add-on route honours it** (`stepScopeOf(ab.scope)`; a scope naming
  a page the site has not got is no scope).
  - **Picker and designers**: they still get the whole page list. Their
    `builtFrom`, `labels`, `photos`, `parts` and `tsx` facts come from the
    scoped pages only.
  - **Page writer**: it sees the scoped pages' source, their photographs,
    the components those pages import, and only the declarations those
    import or this change adds.
  - **Protection**: every other stored component is protected by name
    (`aHiddenParts`), as a withheld one is, without being listed. The home
    page is kept in the window only when it is in the scope.
  - **Fallback**: if a designer names a page outside the scope, the page
    writer is widened back to the whole site (`aMark("scope", "widened")`).
    A prepared answer is then decided by the job's exact-request check.

**Safety does not rest on the plan.** Writes are still applied one at a
time under the site lock, and every job re-reads the site. A prepared
answer is reused only for a byte-identical request. A plan that is wrong
(a write the router did not declare) costs a re-asked call, never a wrong
change (PI 6).

## 3. The evidence (offline, mocked providers)

`test/parallel-addon-independent.test.mjs`, 11 cases (and JUDGE 18):

| Case | What it shows |
|---|---|
| PI 1 | One Add-on, photo + component: both designers meet; the purchase meets the page writer; both on the site; 1 image, 1 upload, 2 designer calls, 1 page call |
| PI 2 | Two parts, image first: the photograph's purchase (part 0's job) meets the component's designer (part 1's preparation); part 1's job `staged yes, replayed ≥ 3, fresh 0`; both land; 1 image; 2 designer calls |
| PI 3 | Two parts, component first: part 0's page writer meets part 1's photo designer; the same replay evidence; both land |
| PI 4 | Shared target (both write `page:/visit`): never meet (the first waits out its limit), the second starts after; both land; 1 image |
| PI 5 | Genuine dependency (the photo part reads `component:faq`, which part 0 creates): `needs [0]` recorded; never meet; both land |
| PI 6 | Stale prepared answer: the component's own page changed under its preparation (a write no plan declared); its job `replayed 0, fresh ≥ 3`; the change lands on the page as it now is |
| PI 7 | The job and the preparation each delivered twice at once: 1 image, 2 designer calls, no ledger reference twice, one routing charge, three jobs (as a single delivery); exact replay |
| PI 8 | The picture service refuses: the photograph's part fails with its job's reserve refunded (net 0); the component's part lands, replayed exactly; the picture is asked for once |
| PI 9 | `addonScope` / `stepInputs`: which writes earn a scope, and which never do |
| PI 10 | The landing rule, both orders; same page, no page named, an existing component and the look still hold a part back; an ended part holds nothing |
| PI 11 | What the scoped part is shown: its designer and page writer never see the Visit heading, the home page's component or its source; that component, returned by its writer, is refused and the stored one kept; exact replay |
| JUDGE 18 | A hand-off between designers started together: the photo designer's early answer (no hand-off) is discarded and it is asked again with it |

**Split across routes vs batched into one Add-on**: PI 1 is one Add-on;
PI 2 to PI 8 are two parts routed separately. Both task orders: PI 2 and
PI 3.

**Red checks** (each on the final tests):
- PI 2, PI 3: fail with the planner reverted, and fail on the evidence with
  the Worker's scope off (`replayed 0, fresh 3`);
- PI 8: fails with the old join (the refused picture asked for twice);
- JUDGE 18: fails when an early designer answer is used without checking its
  request (`test/addon-judgment.test.mjs`).

**Mutation sweep** (from a green full suite; files restored by checksum):
24 product mutants, **23 killed**. The one survivor is `partFeeds` answering
`false` where a placed write lands on a page a step reads. It is equivalent
today: every step that reads one page also writes it, so `conflicts`
already holds the part back there. This is written at the code. Two
comment-only controls survived. One condition the sweep found equivalent (the
home page kept in a scoped writer's window, which never holds it) was
removed.

**Full suite**: `10451 → 10463`, `10463 / 10463 / 0 / 0` locally on
`82194718`'s code. That is 10 PI cases here, PI 11 (what a scoped part is
shown and cannot replace) and JUDGE 18; five source pins were re-anchored to
the renamed inputs. Build and Edit concurrency (`build-parallel`,
`parallel-independent`, `prepared-scope`) and browser-closed execution
(`addon-pending-forms`, `addon-queue`) are in it and green.

**CI on `300b56b4`** (the change and its records, one push): unit tests
38135429070 green; site build 38135429085 green.

## 4. What stays unverified (live)

- **Nothing here ran against a real model, a real image service or the
  live Worker.** Every model answer was supplied and every picture mocked;
  fal was not called.
- **Whether the real router splits "add a photo to Visit and a questions
  section to About" into two parts with these targets**, or batches it into
  one Add-on. Both paths are covered offline; which one a real message
  takes is unmeasured. (It is P1 of `docs/acceptance-current.md`'s
  proposal, for page/table messages.)
- **Whether a real designer, shown only its scoped pages, still chooses
  well.** A photograph designer under a Visit scope no longer sees the
  photographs on other pages, so it cannot reuse one of them there. The
  page writer is shown fewer components. Both are deliberate narrowings of
  a prepared part's inputs; an unprepared part still sees the whole site.
- **Real images**: unverified, as before.
- **Add-on writes the target vocabulary has no word for**: a QR code, a 3D
  scene, a theme declaration, a new table. They are not in a scoped part's
  planned inputs. If one lands beside a scoped preparation, its request no
  longer matches and the job asks again. It costs calls and is never a
  wrong change.

## 5. Round 2 — Codex's review of `d7a00395`: four gaps, fixed together

Codex passed 99 focused tests on `d7a00395` independently, then reproduced
four gaps with mocked providers. **Commits**: `ef8ea26d` (the change and its
tests), with records after. No merge, deploy, container build, paid call,
real image, fal call, balance or flag change.

### The four gaps, each a failing case first (red on `d7a00395`'s code)

1. **PI 3 strengthened** (`first: "faq", photoAt: "image", faqAt: "pages"`).
   The component's writer timed out waiting for the image generation, which
   only began afterwards, in the photograph part's job; overlapping its
   designer was not enough. PI 2 was strengthened the same way
   (`faqAt: "pages"`).
2. **The scoped writer's output boundary** (PI 12, both ways; PI 11). An
   About writer that also returned `index.tsx`, or took a page away, had that
   applied (`replayed 3, fresh 0`). `aPagesSent.withheld` only covered the
   scoped input list.
3. **Capacity before spending** (PI 13). With 200 files the early path called
   the image service and stored a 201st. PI 14 (199 files) is the control,
   green before and after.
4. **An early task's whole life** (PI 15, PI 16). With the image call held
   and the page writer throwing, the request ended failed with a purchase
   left `buying`; released later, the upload was stored and the request never
   said so.

Red check: with `d7a00395`'s `worker.js` and `builder/request.mjs` and this
round's tests, PI 3, PI 11, both PI 12, PI 13, PI 15 and PI 16 fail; PI 14
passes on both.

### What changed

- **A photograph can be made in its part's preparation**, under the part's
  logical purchase. This uses the preparation's own buyer (`rec.image`), which
  notes the purchase on its attempt before making it.
  - It happens only when the preparation runs **beside another part's live
    job** (`beside`: a part queued or started). That is when it overlaps
    something; otherwise the job buys exactly as before.
  - The part's job finds the purchase `bought` and reuses it: one
    generation, no second charge.
  - In PI 3 the image call meets the component's page writer.
- **Every way the add-on route ends joins the photographs it began**
  (`earlyPhotosEnd`), within the image step's own wait:
  - a preparation leaves them on its attempt's notes;
  - a failure or a question reports a stored one as saved in the uploads
    and not on the site (the failure outcome's `photos`, state
    `unpublished`);
  - one still being made when the wait ends is handed on as `held`.
- **The driver holds the part on that purchase**: a refusal naming `held`
  is held like `purchase-unconfirmed`. Once the purchase is known, the part
  runs again, reusing it (PI 16: one generation, one file, placed).
  - Each early purchase's identity is recorded before any waiting
    (`startBuildPhotos` keeps `idents`).
- **Capacity, balance and clock come before spending**. An early purchase
  begins only when every shot passes the image step's gates first:
  - the balance (the shots are already cut by it);
  - the job's clock (`photoWait(...).buy`);
  - room in the library.
  - Room counts only files that are not this part's own purchases (their
    ids), in the early start and in the image step (`buySitePhotos`'s new
    `own`). A file this part already stored is never counted against it
    twice.
- **The scoped writer's output boundary** (`aBreach`). A scoped writer whose
  answer changes an existing page outside its scope, takes one away, or
  returns a stored component it was never shown, is not applied. The writer
  is asked again with the whole site as it is now (`aWriterFor(false)`), and
  only that answer reaches the merge and its existing walls.
  - Exact request matching alone no longer stands in for checking what the
    answer writes.
  - PI 11 now asserts this re-ask instead of the earlier refusal.

### Evidence

- `test/parallel-addon-independent.test.mjs`: 17 cases, all green. New this
  round: PI 12 (two cases), PI 13, PI 14, PI 15 and PI 16; PI 2, PI 3 and
  PI 11 strengthened. Every pair still meets at a rendezvous that cannot
  finish until both have started.
- **Adapted, not weakened**: RT 4 (`test/addon-runtime-paths.test.mjs`) runs
  its jobs fired into the container, so the photograph's preparation now
  buys beside the other part's job. Its store fault was raised from 3 to 6
  failures, so that the frame is still held as the case intends.
- **Four source pins re-anchored to the new code**:
  - `site-add` (the plan built in `aWriterFor`);
  - `ship-anyway` (the image step's slice now ends at its own function);
  - `worker-imports` (the headroom expression);
  - PI 11's own assertions.
- **Mutation sweep**: 22 product mutants, **18 killed**, both controls
  survived. The survivors:
  - **the clock gate on early buying** (`photoWait(...).buy`). No route test
    reaches a job whose clock lets the editing gate pass but not a purchase:
    the job's budget depends on its delivery and a test cannot set it. The
    image step's own identical gate still bounds what is placed and charged.
    **Recorded as a gap.**
  - **the room check** (`aRoom >= aShots.length`). Equivalent for one
    photograph, because the early task's own room cap enforces it.
  - **the early count's own-file exclusion**. Equivalent in outcome: the
    image step counts again with the same exclusion.
  - **the guard skipping a finished addition**. Equivalent: a finished
    addition's photographs were joined by the image step, and it has no
    failure outcome to add to.

- **Full suite** on `ef8ea26d`'s code: `10469 / 10469 / 0 / 0` locally
  (`10463` before this round; the 6 new cases are PI 12's two, PI 13, PI 14,
  PI 15 and PI 16). The three doc tests stay
  32 of 32.
- **Image**: the predicted image moves `d8f11fccd7446ba8` →
  **`15fd0e0ba5555f38`** (205 inputs, 174 paths, on `ef8ea26d`; not built).
  `docs/acceptance-current.md` and its guard name the new id.
- **Required CI** on `6356083c` (the records on `ef8ea26d`): unit tests
  38139938283 and site build 38139938215, both `success` (read from each
  run's own `conclusion`).

### Still not shown live

- The real router splitting a request into these parts, real page writers
  and real image generation: every overlap here is with supplied answers and
  a mocked image service, with the network blocked.
- **The clock gate on early buying** has no route test (the sweep's
  survivor above).
- A preparation buys early **only beside another part's live job**; a part
  prepared alone still buys in its job, as before.

## 6. Round 3 — Codex's review of `902fc7f0`: two purchase-lifecycle gaps

Codex passed 114 focused tests on `902fc7f0` independently: real image
generation overlaps the component writer in both orders, and the scoped-page
and capacity regressions hold. Two gaps remained, both one rule — **a
JavaScript promise that settled is not a purchase whose outcome is known, and
an outcome that is known is not made again by a later step of the same
request**. **Commits**: `ed113138` (the change and its tests), with records
after. No merge, deploy, container build, paid call, real image, fal call,
balance or flag change.

### The gaps, each a failing case first (red on `902fc7f0`'s code)

1. **A refusal asked again** (PI 17; PI 18, every message delivered twice).
   `twoParts({ first: "faq", photoAt: "image", faqAt: "pages", refuse: true
   })`: the photograph's preparation, beside the component's page writer,
   was refused, and the part's own job asked the image service again —
   `purchaseOnce` read the `none` record as "may be begun again". PO 8
   (`test/purchase-outcomes.test.mjs`) asserted exactly that second call; it
   is converted (below).
2. **A settled promise counted as a known purchase** (PI 19, PI 20, PI 21).
   `earlyPhotosEnd` put every result into its `done` set, so a result marked
   `unknown` was never held:
   - PI 19 — the image call's answer lost (a connection reset) and the page
     writer 529s: the request ended failed, the purchase left `buying`, and
     nothing held;
   - PI 20 — the first three upload writes fail and the writer 529s: the
     picture made, its source on the record (`generated`), the request ended
     failed and nothing finished storing it;
   - PI 21 — PI 20's lifecycle through a question: once stored, the part
     runs again, asks the customer something, and the answer resumes it.

PI 23 (the reply facts) was red too. PI 22 and its control pass on both
versions: they close the clock-gate gap recorded in §5, below.

### What changed

- **A purchase that ended with nothing is definitive for the rest of its
  request** (`purchaseOnce`). A refusal the image service answered, or a
  picture made and found unusable, is read as `none` by whoever meets it
  next — the part's job after its preparation, a redelivery, a step run
  again after a question — and never begun again on a read.
  - **Only the customer's explicit buy-again begins it again**
    (`released`), as before; PI 19 uses it and it works unchanged.
  - **An ending the image service never saw is not one** (`asked: false` on
    the record): no key, the image-purchase switch off, an empty
    description. Nothing was asked, made or paid for, so it may be begun once
    that has changed. The existing Build case that first runs with no key
    and then resumes with one (`build-batch-8` case 2) needs exactly this;
    it failed under the first cut of the rule and passes under this one.
- **An early task is read by each purchase's ending, not its promise**
  (`earlyPhotosEnd`): stored (told as saved and not on the site); ended with
  nothing (no hold); unknown, with its own reason (`unconfirmed`,
  `store-pending`, an unreadable record); a buyer that threw (`unconfirmed`);
  no ending yet (`in-flight`). Every held purchase keeps its identity — from
  its buyer, its result, or computed from whose purchase it is and what it
  is (`identOf`) — so the request holds the part on exactly it.
  - The existing driver then does the rest, unchanged: `purchasesKnown`
    finishes a `generated` purchase on the **same picture** (downloaded
    again from its source, stored, never generated again), and the part runs
    again and reuses it.
- **What the customer is told follows the purchase's state.**
  - The request view names each held picture **with its reason** (`why`),
    so a picture made and not saved yet is not shown as a purchase nobody
    can tell.
  - A failed addition's reply facts name each held picture by its reason
    (`heldPhotoFacts`): made and not saved yet (saved later, never made
    again, no buy-again offered), or not known (not bought again; buy-again
    named with its cost); in a request, carried on by itself. A failure
    whose cause is ours (a provider 529, say) is a technical answer with no
    model-written reply, as before; the card reads the view.
- **The clock gate on early buying has a test** (PI 22). The platform's
  injected clock moves the job's own clock while the designers answer; the
  production limits are untouched. With 80 seconds left (below the publish
  reserve plus the slowest shot) nothing is asked of the image service and
  the job stops at its publish gate for time, charging nothing; with 400
  seconds (past the publish gate's 255) the same addition buys once and
  publishes. Removing the gate makes PI 22 fail: the early purchase starts
  and lands after the job's answer.
  - PI 22 waits a moment before reading, because such a purchase is not
    waited for by the route (its clock says no wait); without that wait the
    removed gate's purchase landed in the next case's stand-ins instead.

### Adapted, not weakened

- **PO 8 converted**: it asserted that a refusal recorded by the preparation
  let the part's job ask again (two provider calls). It now asserts the
  refusal is final: one call, nothing stored, the other task done, the
  picture's own job netting to nothing.
- **Three pins re-anchored**: `image-purchase-switch` (the switch's
  refusal now says `asked: false`), `wiring` (the one silent ending, the
  empty prompt, now says `asked: false`), and PUR 4 (the view's held
  purchase now carries its reason).

### Evidence

- `test/parallel-addon-independent.test.mjs`: 25 cases, all green (PI 17–23
  new; PI 22 has a control). With PO 8, the build resume, PUR 4 and the two
  pins: 121 of 121 across the six files touched.
- **Red check** (`902fc7f0`'s product code, this round's tests, in a
  throwaway worktree): PI 17, 18, 19, 20, 21, 23 and PO 8 fail; PI 22 and
  its control pass on both (the gate existed; PI 22 proves its removal is
  seen).
- **Mutation sweep** (`run7`, 10 test files, from a green baseline of 164):
  19 mutants, **15 killed**, both comment-only controls survived. Every
  rule above is killed: the refusal kept, `asked: false` honoured at the
  key, the switch, the record and the reader, the unknown reason held (and
  held with its own reason, not a generic one), `in-flight` held, the view's
  reason, the reply facts and their buy-again clause, and the clock gate.
  The survivors:
  - **a buyer that threw is held** (`threw` → `unconfirmed`): no route
    reaches it — `purchaseBuyer` never throws (its own failures end in
    `purchaseOnce`'s states), and the prep buyer's ending is the
    preparation's to tell. Kept as the conservative reading.
  - **the identity fallbacks** (from the result, and `identOf`), two
    mutants: every buyer tells its identity before waiting, so no case has
    a purchase without one. Kept so that a buyer that does not tell it is
    still held by the identity it must have.
  - **the reused refusal's own reason** (`error: "photo " + why`): what a
    reused ending says in the image step's error field; the reply's
    photograph facts read the refusal from the requirement verdicts, not
    this text.
- **Full suite** on `ed113138`: `10477 / 10477 / 0 / 0` locally (`10469`
  before; the 8 new cases are PI 17–21, PI 22 and its control, and PI 23).
  The three doc tests stay 32 of 32.
- **Required CI**: site build 38143149597 on `ed113138`; unit tests
  38143184967 on `afa0f4e4` and 38143684213 on `aa691d00`, all `success`
  (`ed113138`'s own unit run was cancelled by the next push; the code is
  the same).
- **Image**: the predicted image moves `15fd0e0ba5555f38` →
  **`eb7e55f950c105cc`** (205 inputs, 174 paths, on `ed113138`; not built).
  `docs/acceptance-current.md` and its guard name the new id.

### Still not shown live

- Everything here runs through the real driver, consumer, routes and job
  runner with supplied model answers and a mocked image service, the network
  blocked. A real refusal, a real lost image answer and a real store failure
  have not been seen live.
- The buy-again button on a held part is offered for any held purchase,
  including one made and not saved yet (`store-pending`), where the picture
  exists and saving it is retried by itself; the view now carries the reason,
  and the page does not yet read it (a page change, not made in this round).
- Real router splitting, real writers and real images remain as in §5.

## 7. Round 4 — the recovery card follows each purchase's state

Codex passed 169 focused tests on `2454494b`. **The two purchase-lifecycle
findings of round 3 are closed as fixed offline** (a refused image asked for
again; an unknown early purchase counted as done), and the image/component
overlap in both orders stays as it was. What remained was the recovery
handoff documented in §6: the card showed one status and one action for every
held purchase. **Commits**: `a8bee8af` (the change and its tests), with
records after. No merge, deploy, container build, paid call, real image, fal
call, balance or flag change.

### What changed

- **Each held purchase has a state, read by the server** (`heldPurchaseState`
  in `builder/request.mjs`), and the view carries it per purchase and for the
  part (`purchaseState`, the most uncertain of them; `buyAgain`, true only
  when one is unknown):
  - `saving` — made and not stored yet: the same picture is saved by itself;
  - `running` — still being made, **only within the image call's own time**
    (`PHOTO_RUNNING_MS`, 300 seconds: the 120-second call, its three
    30-second downloads and the store, with room); past it, nobody can tell;
  - `placing` — the purchase is known and its frame could not be read just
    now;
  - `unknown` — begun and not known to have ended, or made but no longer
    handed over by the image service (`source-unreachable`, below).
- **The card shows that state** (`siteRequestHTML`): "Saving a picture
  already made", "Picture still being made", "Putting the picture in", or
  "Checking a picture purchase" — and **the cost-aware "Buy the picture
  again (may cost again)" only for an unknown purchase**. An addition already
  live says which ("Added — photo being saved"). These are fixed status and
  button labels; the conversational explanations stay model-written from the
  reply facts. A view kept from before these fields reads as unknown, which
  is what it said then. The page does not post a press for a part whose
  view offers no buy-again, and two clicks post once (the existing
  `rebuying` guard).
- **A press reads every purchase record again before acting**
  (`releaseHeldPurchases`), so a stale card or a part with purchases in
  different states never lets a made picture go or buys a running one again:
  - made and not stored (`generated`): the same picture is saved now, never
    released — unless its source no longer hands it over (the download
    fails), when it is released like any purchase nobody can tell;
  - still `buying` with its photograph stored: recorded bought;
  - still `buying` within its running time: left running;
  - still `buying` otherwise (or a record that does not read): released, on
    its etag;
  - anything else: already known.
  - A release that loses to another writer reads the record again, so a
    second press that raced the first finds it released and does nothing
    more; the answer says how many were released and which were kept, and
    their state.
- **The driver records what it observes** while finishing a made picture
  (`heldReasons`): our store failing keeps `store-pending`; the source no
  longer answering becomes `source-unreachable`, which the card shows as
  unknown with the buy-again, and the reply facts tell by that reason.
  Recovery with the browser closed is the driver's own sweep, as before.

### Evidence

- `test/purchase-recovery-card.test.mjs`, 9 cases, all through the real
  driver, routes, job runner and page code with a mocked image service and
  the network blocked:
  - RC 1: each state from its reason, `running` only within its time, the
    part's state the most uncertain, the reason the driver observes kept;
  - RC 2: the card's label and button for each state, mixed, an addition
    already live, and a view kept from before these fields;
  - RC 3: two clicks post once; a part offering no buy-again posts nothing;
  - RC 4: stored-but-unsaved — `saving`, no button; a stale press releases
    nothing and keeps the made picture; with no page open, the driver saves
    the same picture once storage answers (one generation);
  - RC 5: still running — `running`, no button; a press releases nothing;
    the call lands and the part finishes (one generation);
  - RC 6: unknown pressed twice at once — released once, neither press
    fails, bought again exactly once;
  - RC 7: mixed (one made-not-saved, one unknown) — a press releases only
    the unknown one; both photographs placed, three generations, never four;
  - RC 8: a made picture whose source no longer hands it over turns
    `unknown` and is released by a press;
  - RC 9: a purchase that landed but whose record never said so (its later
    writes lost), pressed after its running time — recorded bought, nothing
    released, never bought again.
- **Adapted**: the page fixture (`test/fixtures/browser-page.mjs`) carries
  the two new label tables and `siteRequestBuyAgain`; two view pins (PI 19,
  PUR 4) now include the state. PO 10 (made, source gone, buy-again buys
  once) passes unchanged under the new rule.
- **Red check**: on `2454494b`'s code the new file does not load (its
  exports and the card's tables do not exist there); per-rule evidence is
  the sweep.
- **Mutation sweep** (`run8`, 6 test files, from a green baseline of 74):
  17 product mutants, **all 17 killed**; both comment-only controls
  survived. The one first survivor — the press's check for a photograph
  already stored — was killed by adding RC 9.
- **Full suite** on `a8bee8af`: `10486 / 10486 / 0 / 0` locally (`10477`
  before; the 9 new cases are RC 1–9). The three doc tests stay 32 of 32.
- **Image**: the predicted image moves `eb7e55f950c105cc` →
  **`12c7c953c370f188`** (205 inputs, 174 paths, on `a8bee8af`; not
  built). `d7edc66c` moves the acceptance pin.
- **The card, as drawn** (screenshot shown in the chat, rendered in
  Chromium from the page's own code): saving, running, unknown, mixed, and
  an addition already live with its photo being saved.

### Still not shown live

- A real stored-but-unsaved, still-running or unknown purchase, the card on
  a real page, and a real press. Everything here uses supplied model answers
  and a mocked image service.
- `PHOTO_RUNNING_MS` (300 seconds) is reasoned from the image call's own
  limits, not measured on real calls.
