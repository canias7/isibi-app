# Build content preservation: photos, briefs, answers, sections, actions (2026-10-08)

After the fourth recovery batch, the owner asked for the prepared
content-preservation work. The constraints:
- keep 1 page and 15 selected components;
- review every other limit on its own;
- never keep an arbitrary cut and merely warn afterwards;
- keep customer explanations model-written from verified facts.

The approach follows `docs/investigations/build-limits-2026-10-08.md`,
"P3–P5, revised". Nothing was merged, deployed or built, and there was no
paid call.

## What changed

**Briefs and clarification answers (first build).**

| Where | Before | Now |
|---|---|---|
| Browser composer (`siteSend`) | message cut to 2,000 characters | whole, up to the one-message policy (`siteTooLong`, 16,000); past it nothing is sent, the words go back in the box, and the numbers are said — as a message to a live site always was |
| Browser typed answer (`siteAnswer`) | cut to 200 | whole, under the same check, labelled as an answer (also for a live site's question) |
| Route the composer posts to (`/api/site/route`) | first builds excluded from the policy | the same refusal at no cost, before any model |
| Questions model (`site-ask.mjs` `MAX_MESSAGE`) | read a 2,000 prefix | reads the whole message (= `MAX_INPUT_CHARS`) |
| Build route (`buildHeld`) | the brief cut to `REWRITE_MAX_CHARS` (4,000) | the brief read whole; a rewrite's `prompt`/`instruction` keeps that read, so the Edit path's rewrite guard is unchanged |
| Build route (`clarifiedBrief(...)`) | `.slice(0, 5000)` | each part held to one message (16,000) and the whole to one request (48,000); past either, a 422 `brief-too-long` at cost 0, before the deposit and any model |

**Photos.** `pageImages` no longer cuts the designer's list at
`MAX_PAGES * 2` (two).
- Every requested picture stays in the plan the page writer reads.
- How many are bought is decided downstream by the real constraints:
  `IMAGE_CAP`, the balance and the time budget.
- The customer's own photographs cost nothing and are never cut
  (`imageBrief`).

**Sections and actions** (`normalizePlan`).
- **Sections**: every line is kept whole. The 8-line count and the
  120-character cut are gone, bounded only by the one-message input budget.
  `MAX_SECTIONS` is now the page writer's band count: `bandsOf` writes any
  sections past it together in the last band, so the same number of model
  calls carries every section. The design tool's text says so.
- **Actions**: the 3-action count and the 80-character cut are gone; every
  action is kept whole.

**Unchanged**: `MAX_PAGES` 1, `MAX_COMPONENTS` 15, and every timeout,
provider bound, security control and spending safeguard.

## Tests

- **`test/build-content-preservation.test.mjs`**, 8 cases through the real
  build route, the real ask route and the real plan code:
  - a 9,000-character brief and a 900-character answer reach the designer
    whole;
  - a brief past one message is refused before the deposit and before any
    model;
  - an answer past one message, or brief and answers past one request in
    all, is refused; at the bound it builds;
  - a first build's 6,000-character message reaches the questions model
    whole; one past one message is refused at no cost;
  - five pictures, three of them the customer's own: all five stay in the
    plan, and all three own photos are stored and placed;
  - seven pictures stay in the plan;
  - 12 sections of 250 characters and 5 actions of 110 characters are kept
    whole, components stay at 15 and pages at 1;
  - 12 sections become 8 bands, with every section in one.
- **`test/build-content-browser.test.mjs`**, 3 cases in real Chromium:
  - a 5,000-character first-build message is sent whole;
  - a 16,001-character one is refused with its numbers and the words go
    back in the box;
  - a 600-character typed answer is sent whole.
  - Screenshots were taken and shown to the owner.
- **Updated pins**, which assert the old cuts: `input-budget`, `site-ask`
  (×2), `site-plan` (the cap case now pins the two kept maximums) and
  `handover-resume`.
- **Before**, on `3357b115`'s code: 10 of 11 fail. The one that passes, all
  three own photos stored, is a control. The stored look was never cut at
  two; the cut was in the plan the writer reads, which case 6 covers.
- **Sweep**: 14 of 14 killed, the comment-only control survived
  (`scripts/mutants/build-content-2026-10-08.json`).

## Remaining gaps (from the limits inventory, not taken in this batch)

- **The page writer is offered only the photographs the budget allows**
  (`imageBrief` slices to it). Requested pictures past `IMAGE_CAP` reach no
  writer and are not yet named in the build's facts.
- **Purpose** (400 characters) and **image descriptions** (240) are still cut
  silently.
- **Research facts** (2,500) and **linked-page text** (4,000) are still cut;
  links past two are still ignored.
- **A section or band whose writer failed** is still published as an empty
  stub with no fact for the reply (P2).
- **`behavior`** is still never read at build time (P7).
- **The refusal sentence** in the browser says "beside your site", even
  before a site exists. That is the existing wording, unchanged; the owner
  directs wording.
- **The build's reply** is still composed in code from its facts (an existing
  limitation); no new canned narration was added.
- **`MAX_CLARIFY`** (3 question/answer pairs) stays: the conversation asks at
  most three, and the composer cannot send a fourth.
