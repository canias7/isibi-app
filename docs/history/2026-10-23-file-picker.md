# 2026-10-23 — the file picker (idea #21, bolt.diy)

Branch `file-picker` from `origin/main` `c89732649`. Not merged, not deployed;
nothing paid, no model call, no live write.

**Note:** the ideas doc listed #21 as discarded by the owner (2026-10-22).
This branch was built on the owner's later request relayed in this session;
the ideas doc now marks it built on a branch.

## What it does

On a big site, one cheap quick-model call (`modelsFor(picker).quick`, sent
through `quickSend(env, "file-pick")` wrapped in `jobSend` so a job records and
replays it) is given the customer's request and a compact index of the site's
files: each page by path and each component as `-parts/<name>`, with its size,
exported names and `h1`–`h3` headings, and no code. It answers through the
`pick_files` tool (at most `PICK_MAX` = 12 names).

The code only enforces the rules. The model does the picking, and there are no
keyword rules.
- **Always included:** the pages the router's scope names, every component
  they import (followed through components that import components, `./x`
  inside `-parts/`), and the site's own shell (`site-header`, `site-footer`).
- **Bounded:** at most 12 picked files, and only names that exist.
- **Fail open:** a throw, no tool answer, or no usable name gives `only: null`,
  and the writer gets exactly today's context.

A file the picker does not choose is **withheld, never dropped**. The picked
names go to `priorPagesSent(…, { only })` and `partsSent(…, { only })`, which
name the file and protect it the same way as a file over the window. The prompt
and the route's wall read the same selection.

## The threshold, and why

Measured over the 100 stored corpus sites (`test/fixtures/corpus`): 1–6
pages, 3,384–50,780 characters of page source, median 4 pages and 26,192
characters. The picker runs only on **more than 8 pages, or more than 60,000
characters of pages and components together** (`PICK_MIN_PAGES`,
`PICK_MIN_CHARS` in `builder/file-picker.mjs`). Both are above every corpus
site, so no ordinary site makes the call. The 17-page site of 2026-09-17 is
over it.

## Which writers use it

- **The edit path's page rung** (`mode: "page"`): it already sends only the
  target page's source, so the picker narrows the **components** it is shown
  (`partsOnly`, and the wall's `partsSent`).
- **The add-on's page writer** (`mode: "addon"`), whole-site writer only (a
  scoped writer is narrowed already): **pages** (`only` through
  `generateSitePages` → `pagesRequest` → `pagesPrompt` → `priorPagesBlock`, and
  the route's own `priorPagesSent`) and **components**. Targets are
  `aKeepPages`.
- **Not wired**: the look door's lanes, the text step and the tweak rung each
  work on one named page or one file already, so there is nothing to narrow.
  The build path writes from nothing.

## Billing and trace

The picker's usage goes on the same bill as the writer. On the page rung it
goes into that rung's one `eCharge(…)`. On the add-on it goes into `aBill`, in
both branches. The trace mark is `file_pick` with `{ status, chosen, total,
required }`, or `{ status: "fail", why, total }`.

## Tests (`test/file-picker.test.mjs`, 7 cases; page rung through the real route, stubbed wire)

- The threshold sits above every corpus site.
- Below the threshold: no picker call, and every part shown.
- Above it: the writer's prompt has the picked part, the router-named page and
  the parts it imports (including through another part); unpicked extras are
  absent; the index has no code; the picker's 1,000,000-token usage shows in
  the edit's cost.
- The wall reads the same pick, so an unshown part is not replaced.
- A failed picker, or one that names nothing usable, sends the full window.
- The module: the required set, bounds, an unusable answer is still billed,
  and a throw.
- The add-on request withholds unpicked pages by name.

**Red on the old code** (`worker.js` and `page-gen.mjs` from HEAD, with the new
module present): 3 of 6 failed. These were the big-site route case, the
fail-open case (the picker was never tried) and the add-on request. The
below-threshold case passed on both, as it should.

**Sweep**: 10 mutants, run from a saved copy of each file and restored from
it. 8 of the 9 real mutants were killed, and the comment-only control survived.
**One survivor, measured equivalent**: the page rung's wall without `only`. A
returned part that the page does not import is already held by `partsHeld`, and
every part it does import is required. It is kept so that the prompt and the
wall cannot disagree, and the code says so.

## Suite and image

See the commit's records in `docs/owner-notes.md` (totals) and below.
