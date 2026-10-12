# 2026-10-12 — Two independent Add-on parts: the case, and one execution proposal

## The request

The owner, after the image-free Add-on batch (K0, K, E) was prepared:

> Keep the prepared cases and P1/P2 closed. Finish the remaining planning gap
> in one pass: propose a natural image-free request that could exercise two
> independent Add-on parts, explain from their actual read/write dependencies
> why they can overlap, and state what routing result would make the case
> eligible. Do not force routing or change product behavior to fit the test;
> if no suitable case exists under current rules, explain that plainly and
> keep it marked unverified. Keep this separate from the existing
> Add-on-plus-Edit case. Give me one consolidated execution proposal …

## How two Add-on parts can arise under the current rules

- **The router answers one message with one answer.** Several additions are
  one `addon` answer: P1 batched S9's two sections into one. One addition of
  one kind gives one designer, with nothing to overlap.
- **A part is held back only when the chosen answer cannot make it**
  (`alsoAsked`). An addition beside a change is one such case.
- **On a live site `alsoAsked` is a list**, "one entry for each" separate
  request (`LIVE_ALSO_AT`, `builder/site-ask.mjs`). The request flow carves
  one part per entry (`carveParts`, `builder/request.mjs`).
- So two Add-on parts arise only when an **edit** answer holds back **two
  additions as two entries**. Each is later routed on its own as `addon`.
- Nothing in the code forces or prefers that shape, and P1 never showed it.
  The case is therefore proposed with a probe first, and stays unverified
  unless the probe shows it.

## The request (M)

*On the bakers page, change the heading 'Who mixes while Bristol sleeps' to
'Who mixes while the city sleeps'. Also add a short questions section to the
Tasting Evenings page answering 'How much is an evening?' with '£25 a head,
cheese included.' And add a short note to the Classes page saying 'Classes are
for ages 12 and up.'*

- **Natural.** A heading wording change plus two small additions on two
  other pages.
- **Its pages are its own.** No other prepared case touches them: K uses
  `/visit` and `/order`, E uses `/bake-list` and `/gallery`.
- **The words were read off the live pages on 2026-10-12**:
  - `/bakers`' heading is "Who mixes while Bristol sleeps";
  - `/tasting-evenings` gives no price;
  - `/classes` says nothing about age.
- **Not "Meet the Bakers".** A guard keeps other scenarios from re-asking
  for that page (`lv-addon-photo`'s), so the message says "the bakers page".

## Why its two Add-on parts can overlap: read/write dependencies

- **Scope.** A held addition whose named writes all land on one page is
  scoped to it (`addonScope`). Its preparation then reads `pagelist`,
  `theme` and that page (`stepInputs`).
- **Writes**:
  - the heading's text job writes `page:/bakers`;
  - the section writes `page:/tasting-evenings` (and its new component, if
    named);
  - the note writes `page:/classes` (and its own).
- **No conflict.** Nothing writes a new page, the page list or the theme, so
  no part feeds another's inputs. `clearToPrepare` holds neither addition for
  the heading or for the other.
- **What would make one wait**:
  - the same new component named for both (`conflicts`);
  - a new page (it feeds `pagelist`: S7's case, PI 35).
- **Offline**:
  - PI 36 (`test/parallel-addon-independent.test.mjs`) runs this shape
    through the real route with supplied answers. Both Add-on parts are
    prepared beside the heading's job, their designers meet at a rendezvous,
    and both jobs replay their preparation exactly.
  - A new free case checks `clearToPrepare` directly, with both waiting
    controls.

## Eligibility (M0, routing only, `acceptance-split-3`)

**M is pressed only if the saved answer is all of these:**
- an edit answer for the heading;
- `alsoAsked` holds both additions as two separate entries;
- each addition's `targets` writes only its own page (at most its own new
  component, not one shared), with no reads;
- no `dependsOn` between them.

**Anything else** leaves the case unverified, and M is not pressed: one
`addon` answer, one held entry, a shared component, a target outside its
page, a relation, or a question back.

## The evidence reader added

- **The gap.** `overlapVerdict` counted any part's prepared step beside any
  other part's job. An Add-on part beside the heading's job would therefore
  have passed as "two Add-on parts at once".
- **`overlapVerdict(steps, { route })`** now counts only parts routed there,
  on both sides. Fewer than two such parts is missing evidence.
- **The scenario asks for it by name**:
  - `expect.overlap: "addon-parts"` adds a check limited to Add-on parts;
  - `reuse.overlapped: "addon-parts"` requires the exact reuse to be by an
    Add-on part that overlapped another Add-on part's work.
- **Coverage `addon-parts`** means two or more Add-on parts, all finished.
- **Nothing else changed.** Existing scenarios and their checks are
  unchanged, and no product code changed.

## Changes

- `scripts/canary-requests.mjs`: `overlapVerdict`'s route filter, the
  `addon-parts` overlap check, `reuseVerdict`'s `overlapped: "addon-parts"`,
  and the coverage `addon-parts`.
- `scripts/canary-ui.mjs`: the scenario `acc-addon-two-parts`.
- `scripts/router-probes/acceptance-split-3.json` (new).
  `acceptance-split-1` and `-2` are untouched.
- `.github/workflows/edit-canary.yml`: the scenario box's description names
  `acc-addon-two-parts`. A merge of this file starts a deploy run, with the
  image reused.
- Tests:
  - `test/acceptance-addon-free.test.mjs`: 8 new cases (what it demands, the
    Classes and Tasting Evenings facts, the probe, the dependency rules, the
    Add-on-only overlap, the press's check names, the coverage).
  - `test/parallel-addon-independent.test.mjs`: PI 36.
  - Guard lists in `acceptance-entry-points`, `acceptance-spend-bound`,
    `canary-form`.

## Verification

- **Red check.** Run against the committed scripts, 8 of the new cases fail:
  the scenario is missing, the probe is missing, and the Add-on-only overlap,
  the reuse limit, the check names and the coverage are not there. Two cases
  pass on both sides: the dependency case and PI 36. They describe product
  rules this round leaves unchanged.
- **Sweep: 16 of 16 killed, and 2 comment-only controls survived.**
  - The mutants: the route filter ignored; the fewer-than-two guard removed;
    the reuse limit ignored; the press never asking; coverage passing with
    one Add-on part or with an unfinished one; the scenario demanding only
    request-level overlap, exact reuse by one part, or unlimited reuse
    overlap; the Classes denial or fact dropped; the Tasting Evenings denial
    dropped; the heading on another page; the probe's words drifting; the
    probe not an acceptance batch; the scenario unnamed in the form.
  - Two survived the first pass:
    - The cheese denial: the case also lacked the asked fact, so it failed
      for that reason. A case that states every fact beside the denied claim
      now kills it.
    - The unnamed form: its guard (`test/canary-ui.test.mjs`, "the scenario
      box names every scenario there is") was outside the sweep's file list.
      Re-run against that file, it is killed.
  - Every file matched its pre-sweep hash afterwards.
- **Full suite** `10687 / 10687 / 0 / 0` locally (10678 before). Unit CI is
  green on `4bae2dbb` (run 38272842925, `success`).
- **The container image is unchanged**: no input was touched.

## Correction: the reuse count tied to overlap (the owner's reproduction)

**The defect.** `reuseVerdict` counted exact reuse over every route, then
asked only that *one* exact part had overlapped. The owner reproduced a
false pass: Add-on parts 2 and 3 overlapping, exact reuse by Edit part 1 and
Add-on part 2, Add-on part 3 fresh. `{ exact: 2, overlapped: "addon-parts" }`
passed.

**The rule now** (`scripts/canary-requests.mjs`):
- **Overlap-tied counts.** Wherever a reuse count is tied to overlap,
  `exact` is the number of **distinct parts** that both answered exactly
  and whose own prepared step overlapped other work:
  - for `overlapped: "addon-parts"`, the overlap must be with another Add-on
    part's work;
  - for `overlapped: true`, any other part's work counts.
- **All of them must qualify**, never one standing for the rest. Without
  `overlapped`, `exact` counts distinct jobs.
- **Duplicate evidence never counts twice**:
  - the same job listed again with the same counts is one;
  - listed with different counts, or under two parts, it fails as
    unreadable;
  - one part's two jobs are one qualifying part.
- **New output.** The verdict returns `qualifying`, and its summary names
  those parts.

**Tests** (`test/acceptance-addon-free.test.mjs`, 5 new):
- the owner's reproduction (fails);
- reuse on another route never counting (fails for Add-on parts; under the
  general rule it is a control that passes);
- insufficient qualifying reuse (an exact part beside nothing does not make
  up the count, under either rule);
- duplicate evidence (same job twice, conflicting entries, a job under two
  parts, one part's two jobs);
- a positive control where both Add-on parts qualify (passes).

One existing assertion in `test/canary-acceptance.test.mjs` was updated
for the new failure wording; the case itself is unchanged.

**Verification**:
- **Red check.** The reproduction and the other new cases fail on the
  previous code.
- **Sweep: 6 of 6 meaningful mutants killed, 1 equivalent, and the
  comment-only control survived.**
  - Killed: one qualifying part enough; parts not deduplicated; the same
    job counted twice; a conflicting duplicate accepted; the overlap read
    not limited to Add-on parts; the overlap ignored.
  - Equivalent: dropping the per-part route condition. The overlap read is
    already limited to Add-on parts. The condition is kept as a second
    guard.
- **Focused files:** 39 / 39.
- **Full suite** locally: `10692 / 10691 / 1 / 0`.
  - The one failure is `test/progress-live-writer.test.mjs` "PLW 4"
    (photo-placement progress lines). This change touches neither that test
    nor the product code it covers.
  - The file passes 5 / 5 on its own, three runs out of three, so it is
    recorded as a timing failure under the full suite's load, not as fixed.
- **Unit CI** green on `0dce4ea2` (run 38276858485, `success`).

**Closed by the owner** (2026-10-12) after review: the original false pass is
rejected, both qualifying Add-on parts pass, and duplicate evidence does not
inflate the count. No further audit. PLW 4 stays in `docs/backlog.md` as an
intermittent failure, not fixed.

## The live batch (K0, K, E, M0, M), 2026-10-12, approved by the owner

**Totals**:
- 74 credits (950 → 876), inside the 37–82 estimate, ledger rows 437–449;
- image purchases off between deploys 2195 and 2196;
- the image was reused both times;
- no merge;
- the opt-in (`ec8f0fc9`) admitted only these five presses.

**The runs**:
- **K0, run 131**: `addon`, batched. 3 credits.
- **M0, run 133**: `edit · text`, with two separate held entries, each
  writing only its own page, and no relation. Eligible. 3 credits.
  - Its evidence was read through the GitHub connector's artifact
    download.
  - Run 132 had refused at no cost first: the probe file's `basis` was
    over 200 characters. Fixed in `cb8ce827`, with a reader guard.
- **K, run 135**: the live router split the message into two Add-on parts,
  so inside one Add-on was not reached.
  - Part 1's preparation overlapped part 0's Add-on job for 84.3 s, and was
    replayed exactly.
  - The served `/visit` FAQ is collapsed, so the served check failed on it.
  - 30 credits.
- **E, run 137**: the router answered `addon` and held the heading back.
  - The Add-on part failed at `kept`: its output would have changed the
    Gallery heading. No charge.
  - The heading was done. Its preparation overlapped the Add-on job for
    14.1 s and was replayed exactly.
  - 8 credits.
- **M, run 138**: routing as M0.
  - The two Add-on parts' preparations ran together for 94.0 s.
  - Both were replayed exactly, and the strict reuse check passed.
  - `/bakers` and `/classes` passed. `/tasting-evenings` failed two checker
    limits: the FAQ is in both render branches, and it is collapsed when
    served.
  - 30 credits.
- **Runs 134 and 136** refused at no cost: the form's box mix-up.
- **Run 139** (free): `imagePurchases=true` after deploy 2196.

## After the batch: E's failure traced and fixed, K/M's checker limits fixed (offline)

The owner, closing the paid batch: *"prioritize the real failure from E/run
137 … Fix the general task-isolation cause without hardcoding pages or
weakening preservation guards, while retaining enough original context to
understand references … verify the existing K/M FAQs through free browser
interaction … Only then correct the evidence checker … No paid reruns, image
generation, merge, deployment or container build."*

### 1. E (run 137): the trace

- **The message**: *Add a short questions section to the Bake List page
  answering 'When is the list updated?' with 'Every Monday morning.' And
  change the Gallery page heading 'Photographs from our ovens' to
  'Photographs straight from our ovens'.*
- **Routing**: `addon`, with the heading held back (`alsoAsked`).
  - Part 0 (the Add-on) ran with `instruction` = the whole message and the
    heading in `alsoAsked`.
  - Part 1 (the heading) became its own part.
- **Scoped instruction.** The Add-on route took the held words out
  (`heldParts`, checked on the real strings). Its picker, designers and
  page-writer brief read only the Bake List sentence.
- **What every model call was also shown.** Every model call of a part goes
  through `clarifyTransport` → `withPart`. That appended `partBlock`, which
  quoted **the whole original message, the held heading change unmarked**,
  under only "Do only what this part asks".
- **The page writer's inputs**: every page, Gallery included, plus that
  block.
- **The returned changes**:
  - it wrote the section and, on `gallery.tsx`, the new heading;
  - the `kept` guard found "Photographs from our ovens" lost and refused the
    whole job (`error: "rewrote"`, `lost: [{ path: "gallery.tsx" }]`), with
    no charge;
  - part 1 then made the heading change itself.
- **The cause** is general: any part whose step writes several pages could
  act on another part's words in the reference block.

### 2. The fix (`83c9015a`)

- **`partOf`** (`builder/request.mjs`) now also carries `others`: offsets
  into the message where every other part's own words stand.
  - It never includes this part's own words, or a refused part.
  - A part whose words hold this one's (the one it was carved from) is not
    marked.
  - Part 0's words (the message with the held parts taken out) are the text
    outside every other part's words.
- **The readers** validate the offsets: `readRequestOf` and `readPartOf`
  (with `readSpans`) take integers, in order and not overlapping, only
  against the message exactly as sent. Anything else is no marks, shown as
  before.
- **The three routes** pass `others` through: routing (`rPart`), edit
  (`ePartShown`) and Add-on (`aPartShown`).
- **`partBlock`** keeps the message whole, so references still read. It
  wraps each other part as `⟦ANOTHER PART: …⟧` and adds the rule: never
  make any change they ask for, not on a page this step writes, not inside
  what this part adds, even when a page you are writing is the page they
  name.
- **No guard changed.** `kept`, `mergeAddonPages` and the scope checks are
  as they were, and no page is named in code.

**Regression**:
- **PI 37** (`test/parallel-addon-independent.test.mjs`). An Add-on part and
  an edit part from one message run through the real routes.
  - The stand-in page writer makes every change it is shown unmarked.
  - Every Add-on call (picker, designer, writer) sees the heading only
    marked, and the edit step sees the addition only marked.
  - Both parts finish. Only the asked pages change.
  - The edit part's preparation ran beside the Add-on job and was replayed
    exactly (`staged: yes, fresh: 0`).
  - No double charge.
  - **On the old code it fails exactly as run 137 did**: `[failed, rewrote]`
    and `[done]`.
- **ISO 1** (`test/request-plan.test.mjs`): marks both ways, the whole
  message kept, unreadable offsets ignored, a refused part and a carved
  part.
- Two expectations were updated (`request-flow` C1, the routing body test).

**Not shown live**: a real model may still ignore the marks. The `kept`
guard stays the backstop.

### 3. K/M FAQs, verified free in a browser (before any checker change)

The pages were opened in Chromium. Every request was served through a Node
fetch that verifies TLS (traps.md), and anything other than a read was
refused. Nothing was submitted or written.
- **`/visit`** (K): "Can I bring my dog?" is collapsed, and opens to "Dogs
  are welcome inside."
- **`/tasting-evenings`** (M): "How much is an evening?" is collapsed, and
  opens to "£25 a head, cheese included." The form (name, email) was not
  touched.
- **`/classes`** (M): "Classes are for ages 12 and up." is shown once, with
  no accordion.
- Each shows its section once.
- **The success state was read from the stored source, not by submitting.**
  `if (sent) return (…FAQ…)`, then the default `return (…form…FAQ…)`. The
  two branches are never on screen together, and each has the FAQ once.

### 4. The checker (`6dae03bc`)

- **Opened reads.** `readOpenedPage` (`scripts/canary-ui.mjs`) opens a page
  in its own context:
  - every closed disclosure (`aria-expanded="false"`, a closed `<details>`)
    is pressed once;
  - never a button inside a form, a submit button, or anything in the
    header, a menu or a dialog;
  - every request other than a read is stopped and recorded.
- The canary takes this read for each route a scenario expects a section on
  (`openReadRoutes`), on the before and the after inventory, as
  `route*.open.html`.
- The served section check uses the opened pair when both exist, and the
  served HTML otherwise.
- **Render states.** `renderStates` reads the syntax tree (TypeScript) for
  exclusive branches: `if … return` with the rest of its block, `if …
  else`, and `? :`. `&&` never counts.
  - `storedSectionStates` gives each state the part of each added run it
    shows, so copies in the two arms of a `? :` are one per state.
  - `sectionStateChecks` refuses a state with two stating sections. At least
    one state must have exactly one, and every distinct stating section is
    judged on every fact.
  - More than 6 branch points, or a file that does not parse, judges the
    whole file as before.
- **New: an answer said twice** (`onceChecks`). A fact-stating sentence said
  twice in one section fails. Side-by-side copies used to read as one
  section and pass, a limit round 18 recorded.

**Tests**:
- `test/acceptance-addon-free.test.mjs`: BRANCHES 1–2, OPENED 1–2.
- `test/canary-open-read.test.mjs`: OPEN 1–2, in real Chromium.
- One source guard widened in `test/canary-requests.test.mjs`.
- **Still refused**:
  - two copies in one branch, side by side or apart;
  - `&&` beside a copy;
  - a wrong amount in either branch;
  - no answer in any branch;
  - an opened wrong or missing answer;
  - only one of the two opened reads.

### 5. Verification

- **Red checks**:
  - PI 37 fails on the old product code, as run 137 did.
  - All new checker cases fail on the old scripts. BRANCHES 2 fails there
    too: the old checker passed side-by-side duplicates.
- **Sweep: 28 meaningful mutants, 26 killed, and both comment-only controls
  survived.** Every file matched its pre-sweep hash.
  - Two survive singly: the carved-parent skip and the own-words filter.
    Each covers the other, and the two together are killed.
  - The first round's other two survivors (the `else` branch, a non-submit
    button inside a form) gained cases and were then killed.
- **Focused**: the 75 files touching parts and routing, 1363 / 1363;
  the checker files, 225 / 225.
- **Full suite** on `6dae03bc`: `10701 / 10701 / 0 / 0` locally (PLW 4
  passed this time; it stays recorded as intermittent).
- **The image would move.** `builder/request.mjs` and `builder/site-ask.mjs`
  are inputs, so the prediction is `1e30b6fb56b51794` → **`eda28cb21064287d`**
  (205 inputs). A merge would build a container image. None was built.

### 6. Remaining gaps

- The isolation fix is offline: no real model has seen the marks.
- The opened read has not run live; it needs a UI press and Chromium in the
  workflow, as UI scenarios already install.
- The Add-on's own coverage judge still reads a collapsed answer as
  "unseen".
- Inside-one-Add-on concurrency, the missing-context clarification and the
  image-free first Build remain **unverified**.
- The form's scenario/batch box confusion is still open.
- PLW 4 is intermittent, not fixed.
