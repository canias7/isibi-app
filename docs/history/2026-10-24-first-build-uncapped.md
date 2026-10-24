# 2026-10-24 — The first build has no page, section or component cap

Branch `first-build-uncapped` from `origin/main` `692087cde`. Not merged, not
deployed. Nothing spent and no model called: every test uses stubbed writers.

## The owner's word

*"eliminate the sections, the cap on the sections, the cap on the pages, the
cap on the components on the first build"*. The section cap was there because
builds made *"one full page full of themes"* (one long page). The owner now
wants real multi-page first builds with no artificial limit.

## Caps removed

| Where | Before | Now |
|---|---|---|
| `builder/site-plan.mjs` `MAX_PAGES` | 1 (`pageList` cut at it) | infinity, no cut |
| `builder/site-plan.mjs` `MAX_COMPONENTS` | 15 (`normalizePlan` sliced) | infinity, no slice |
| `builder/site-plan.mjs` `MAX_SECTIONS` | 6 (bands past it went to `notBuilt`; tool `maxItems: 6`) | infinity, every band kept, no `maxItems` |
| `builder/site-plan.mjs` `MAX_NOT_BUILT` | 12 (`maxItems` on the tool) | infinity, no `maxItems`; nothing planned is moved into it |
| `builder/page-gen.mjs` `MAX_PAGES` | 6 (`validatePages` kept the first six and reported it) | infinity, every page kept |
| `builder/page-bands.mjs` `MAX_BANDS` | `= MAX_SECTIONS` (6) | follows: infinity |
| `builder/model-fanout.mjs` `MAX_FANOUT_REQS` | 16 (a longer list went to the single call) | 512 (a memory bound) |
| `scripts/canary-build.mjs` shape verdict | "exactly 1 page", "at most 15 components" | "its pages, the front page among them" |

The tool text changed with it. `pages` now asks for every page the site needs,
with no limit, one subject a page and "/" required. `shape` asks for an entry
for every page and any number of bands. The one-job law now says a second
screen becomes its own page, where it used to be left out. `notBuilt` names
only what a first build cannot make (it has no back end), never a page or a
section.

The add-on step keeps its own bounds. Its 15-component manifest is now its own
constant, `MAX_ADD_MANIFEST` in `site-add.mjs`, and `MAX_ADD_PAGES` stays 6.

## What had to change downstream

- **The writer splits every page.** A plan of several pages used to be refused
  the band split (`bands:pages`) and went to one `write_pages` call, which
  cannot hold a ten-page site under one output ceiling. `pagesPlan` in
  `page-bands.mjs` now splits every page. Each page's bands, then one header
  and one footer for the whole site, go out in ONE fan-out: one job, one
  resume, derived deterministically from the stored plan. `generateSiteBands`
  then assembles one page per route.
  - Band names are numbered across the whole site, so every band file is unique.
  - Later pages import the first page's `site-header` / `site-footer`
    (`assembleBands` `frameFiles`), so the site never gets `site-header-2`.
  - Each band is told its page (`THIS PAGE`).
  - A page the design did not arrange still gets one band (`WHOLE_PAGE_BAND`),
    so it is never dropped.
  - One page keeps the one-page rule (fewer than 2 bands is `thin`, which goes
    to the single call).
- **The frame links every page.** `chromeFor` already listed every planned page
  in the header/footer facts (and only when there are more than one). The new
  test drives it through the frame writers.
- **The design graph.** `shape` and `images` now wait for `pages`. Each names
  page paths, and a path the site does not have is dropped. With one page that
  path was always "/".
- **Revise.** A full revise of an old multi-page site can drop no page now,
  either in the plan reader or in the page writer.
- **Database.** Unchanged. A first build still has no database (the design
  system prompt), so no tables are declared across pages.

## Still bounding (kept, not changed)

These are safety, cost and concurrency bounds, not page, section or component
caps:

- **Concurrency.** `MAX_MODEL_FANOUT` 8 (band calls at once) and
  `MAX_GRAPH_INFLIGHT` 8 are unchanged.
- **`MAX_FANOUT_REQS` 512.** Above 512 requests in one first build (for
  example 50 pages of 10 bands), the container refuses the list
  (`bands:nofanout`) and the single call writes the site. No page is dropped,
  but one model call cannot hold a site that size well.
- **`IMAGE_CAP` 6.** At most six bought photographs per build, a spending
  safeguard. More pages do not mean more pictures.
- **`site-repair.mjs` `MAX_REPAIRS` 3.** At most three broken pages are
  repaired by a model per build. Pages beyond that are reported, not repaired.
- **`site-translate.mjs` `MAX_STRINGS` 900.** On a multi-language site, a big
  multi-page site can pass 900 strings, and the strings past 900 are not
  translated. This is worth a separate review.
- **`site-render.mjs` `MAX_FINDINGS` 24.** Limits the render report's
  findings, not the pages checked.
- **`public/chat.js`.** Keeps the cached markup of the first 6 pages only. This
  is a browser cache, and page identity comes from the server (2026-10-03).
- **Character and file-size limits.** `MAX_PAGE_CHARS`, `MAX_TSX`,
  `SITE_PAGES_MAX_TOKENS` per band call, and `MAX_FRAME_CHARS` 24,000 for the
  header and footer.
- **Time.** The 50-minute job deadline.

## Time and cost, expected (not measured)

- **Band writing.** A measured 8-band page (`repairbench-1`) took 69 s of wall
  time for 416 s of calls, about 52 s per call. N band requests run in
  `ceil(N/8)` rounds.
  - 10 pages of 3 to 5 bands plus the frame is 32 to 52 requests, so 4 to 7
    rounds, about 4 to 8 minutes. One page took about 70 s.
  - 10 pages of 8 bands is 82 requests, 11 rounds, about 10 to 15 minutes.
  - The local poll's deadline grows with the rounds (`rounds × callMs`).
    Together with the design (about 2 to 4 min), the compile and the render
    check (more routes), a ten-page build should fit the 50-minute deadline.
    A 30-page site of 8 bands (242 requests, 31 rounds) might not.
- **Cost.** Each band call pays the cached rules block plus fresh output. The
  page step's bill grows about linearly with the band count. A first build
  measured 11 to 45 credits at one page. Ten pages is plausibly 3 to 6 times
  the page step, about 40 to 150 credits per first build.
- **Cold accounts.** `buildFloor` (20) is a floor check, not a cap. Larger
  builds will run cold accounts out of credits sooner.

## Verification

- **Guard test.** `test/first-build-uncapped.test.mjs` has 7 cases. A
  ten-page, thirty-section, forty-component design goes through
  `normalizePlan`, `pagesPlan`, `bandRefusal`, the real `chromeFor`, then
  `generateSiteBands` with stub writers that answer what each writer is told,
  then `validatePages`.
  - Nothing is dropped.
  - There are 30 band files and exactly one header and one footer.
  - The header and the footer each link all 10 pages.
  - A stored nine-page site keeps all nine on revise.
  - The design graph hands the pages to `shape` and `images`.
  - Plus a wiring read of `worker.js`.
- **Red check against `origin/main`.**
  - With main's `site-plan`, `page-gen`, `model-fanout` and `design-graph`
    (keeping the new splitter), 6 of 7 cases fail. The wiring read passes,
    since it reads the new `worker.js`.
  - With main's `page-bands` and `worker.js` too, the file cannot load (no
    `pagesPlan`/`WHOLE_PAGE_BAND`).
- **Updated tests.** 17 existing test files pinned the old caps (1 page, 15
  components, 6 bands, the 16-request list, `bands:pages` for two pages, the
  canary's "exactly 1 page"). They now pin the absence of the caps.
- **Mutation sweep.** 19 mutants: 17 killed, and the comment-only control
  survived. The one other survivor ("shape stops waiting for pages") was
  inert: it appended `needs: undefined` before the real `needs: ["pages"]`, so
  the later key won. `design-graph.test.mjs` asserts `needs("shape")` is
  `["pages"]`, which a real removal fails.
- **Full suite.** Run from the worktree with `node_modules` linked: 12,465
  tests, 12,457 pass, 5 fail, 3 skipped.
  - Four of the failures were old cap pins: `band-refusal` (two pages),
    `build-attribution` and `build-parallel-route` (×2, "exactly 1 page").
    They were updated afterwards, and those files pass (59 of 59, with
    `canary-build`).
  - The fifth is the known environment-only node_modules-symlink case.
- **Image prediction.**
  - SiteBuildContainer `0bae00a7003bcc23` → `546840dd0f2d1562` (231 inputs,
    199 paths): **the site image rolls**.
  - AppBuildContainer `65022ce71e3d7274` stays.
  - A deploy needs the owner's specific permission and a ~20 minute wait for
    builds.

## Proposed paid check (not run)

One first build of a fresh slug, through the build canary, with a brief that
asks for about six distinct pages (home, menu, catering, story, visit,
contact). Estimate 40 to 90 credits.

Read from the trace and the stored source:

- the `bands` mark: bands = the planned count, wrote = bands, wroteFrame = 2;
- no `bands:pages` refusal;
- every planned page stored;
- one `site-header` and one `site-footer` that link every page;
- the job time against the 50-minute deadline.
