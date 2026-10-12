# 2026-10-12 — The next image-free Add-on batch, after P1 and P2

## The request

The owner, after option A (P1, run 128, and P2, run 129) closed:

> Keep P1/P2 closed and do not rerun them. Prepare the next smallest
> image-free Add-on verification batch using the existing scenarios and
> evidence. Account for P1's actual routing results: S7 split into parts, so
> it cannot prove concurrency inside one Add-on; S9 batched, which by itself
> proves no concurrency. … Do not force routing or hardcode a special case
> just to make the tests pass.

## What the code says about each P1 sample

**S9: two questions sections, batched as one Add-on.** Add-on designers run
per kind: `pickAdds` names kinds, and `designWaits` schedules one designer per
kind. Two sections are one kind (`component`), so they get one designer.
Nothing inside the job can run beside it.

**S7: a new page and a questions section, split into parts.**
- *Inside one Add-on* it is not reachable, because the router split it.
- *Across parts* it is not independent:
  - the held section is a scoped addition, and `stepInputs` gives it
    `pagelist`, `theme` and its own page;
  - the page part writes `new-page:/delivery`, which feeds `pagelist`;
  - so `clearToPrepare` holds the section's preparation until the page's
    part has ended.
- That wait is a real dependency in the current rules: the section's picker
  is shown which pages the site has. It was not changed.
- PI 35 runs it through the real route with supplied answers. The section's
  designer starts only after the page's part, nothing is staged for it
  (`prepUse.staged === "no"`), and its job works afresh (`fresh ≥ 1`,
  `replayed 0`).

**S8: a questions section and a heading, split into an Edit part and a held
Add-on part.** These are independent:
- the heading's text job writes `page:/gallery`;
- the section reads `pagelist`, `theme` and `page:/bake-list`;
- `clearToPrepare` is true.

PI 29 runs both orders offline.

## What is proposed

1. **K0, the probe `acceptance-split-2`.** One routing call for K's message;
   nothing is applied. About 1–3 credits.
2. **K, `acc-addon-kinds`**, only if K0 comes back as one `addon` answer with
   nothing held back.
   - It asks for a questions section on `/visit` and one line on `/order`:
     `component` and `words`.
   - Neither kind changes what another designer is shown (`changes` is true
     only for a schema kind or `page`). So `designWaits` gives both
     designers nothing to wait for, whatever the picker says they use.
   - PI 34 runs the real route with no `uses` at all, and the two designers
     meet.
   - Evidence:
     - the free read-job lookup on the Add-on's job (`addonDesignOverlap`)
       must say `overlapped`;
     - `sections` must hold every fact on both pages, stored and served;
     - every other page byte for byte;
     - one charge per job.
   - About 9–19 credits.
3. **E, `acc-addon-edit` (S8).**
   - Evidence:
     - `overlapVerdict`: the held Add-on part's preparation against the
       heading job, by recorded intervals;
     - `reuseVerdict`: exact (`staged yes`, `replayed ≥ 1`, `fresh 0`);
     - every fact on `/bake-list` and the Gallery heading;
     - no duplicate charge.
   - About 9–20 credits.

**Two independent Add-on parts** would need a message the router splits into
two additions that read nothing the other writes. P1 has no such sample,
because it batched S9. E is the nearest across-parts case that P1 confirmed.

**Prerequisites**:
- A spending decision. The P1/P2 opt-in is not extended, and the 100-credit
  guard blocks all three at 950.
- `IMAGE_PURCHASES` off for K and E, with a redeploy, and back on after.
- K0 before K.

**Subsequent live gaps**: the missing-context clarification (`acc-needs`) and
the image-free first Build.

## Changes

- `scripts/canary-ui.mjs`:
  - `acc-addon-kinds` is new;
  - `acc-addon-inner` (S7) is unchanged, with a note that it is not proposed
    after P1.
- `scripts/router-probes/acceptance-split-2.json` is new. `acceptance-split-1`
  is untouched, as P1 ran it.
- `.github/workflows/edit-canary.yml`: the scenario box's description names
  `acc-addon-kinds` and marks `acc-addon-inner` not proposed. A test requires
  the box to name every scenario. A merge of this file would start a deploy
  run with the image reused; the presses can run from the branch without
  one.
- Tests:
  - `test/parallel-addon-independent.test.mjs`: PI 34 and PI 35.
  - `test/acceptance-addon-free.test.mjs`:
    - what each scenario demands, after P1;
    - K's line and section facts;
    - the K0 probe, with P1's batch untouched;
    - `designWaits` for the two kinds.
  - Guard lists in `acceptance-entry-points`, `acceptance-spend-bound` and
    `canary-form`.
- No product code changed.

## Verification

- **Red check.** 7 of the new scenario cases fail on the committed scripts.
  PI 34 and PI 35 pass on both, because they describe product rules this
  round leaves unchanged; the sweep's product mutants are what guard them.
- **Sweep: 12 of 12 killed, and 2 comment-only controls survived.** The
  mutants were:
  - every kind waits;
  - a section counted as fact-changing;
  - the page list blind to a new page;
  - K without its inner reading;
  - K demanding request-level overlap;
  - K's line without its morning fact, its denial or its time-of-day limit;
  - K's line on the wrong page;
  - the probe's words drifting from K's;
  - the probe not an acceptance batch;
  - K unnamed in the form.

  Every file matched its pre-sweep hash afterwards.
- **Full suite** `10678 / 10678 / 0 / 0` locally (10672 before). Unit CI is
  green on `1f33c80a` (run 38268505150): `10678 / 10637 / 0 / 41`.
- **The container image is unchanged**: no input was touched.
