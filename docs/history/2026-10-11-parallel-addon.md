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
- **Required CI** on the branch: recorded in owner-notes once read.

### Still not shown live

- The real router splitting a request into these parts, real page writers
  and real image generation: every overlap here is with supplied answers and
  a mocked image service, with the network blocked.
- **The clock gate on early buying** has no route test (the sweep's
  survivor above).
- A preparation buys early **only beside another part's live job**; a part
  prepared alone still buys in its job, as before.
