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
