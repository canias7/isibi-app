# 2026-10-24 — the file picker on edits (branch `edit-file-picker`, not merged, not deployed)

The owner asked (2026-10-24) to finish the file picker (`builder/file-picker.mjs`,
deployed in 2266) for edits: call it wherever an edit sends whole-site context,
same threshold (> 8 pages or > 60,000 characters), fail open, usage on each
path's one charge, the `file_pick` mark. From `origin/main` `692087cde`. Nothing
spent, no model called (stubbed wires), no live write.

## 1. Where an edit sends what, before and after

| Path | Before | After |
|---|---|---|
| Page rung, components | picked (2266) | unchanged |
| Page rung, other pages | not narrowed | `only: ePick.only.pages` passed to the writer; the rewrite block (`priorPagesBlock`, through `reviseSent(pages, { only })`) shows the picked pages and names the rest as withheld |
| Add-on, whole-site writer | picked (2266) | unchanged, but see §2 |
| Add-on, scoped writer (first pass) | not picked | not picked: already shown only its scope's pages and their components (`aView`, `aViewParts`) |
| Add-on, scoped writer widened after a breach (`aWriterFor(false)`) | **whole site, never picked** | picked once, here; its pages and parts narrowed; billed on the same page bill |
| Look door field lanes (`runLane`) | one field's value (or the stylesheet with the landmark and theme notes) | unchanged: no pages or components are sent |
| Look door page steps | run through the page rung | covered by the page-rung change |
| Tweak (`runTweak`) | one file | unchanged |
| Compile repair (`compileRepairRounds`) | only the pages this change wrote that the error names, at most `MAX_FILES` | unchanged |
| Frame edits (`frameEditRequest`) | the header/footer and the route list | unchanged (confirmed: two files and the routes) |

**A limit on the page rung, said plainly.** In page mode the writer is shown only
the target page; other pages are listed by name and their source is not sent. Their source is
sent only in the rewrite fallback: a target too large to show alone (over
`MAX_PRIOR_CHARS`, 90,000) or one that cannot be found. A stored page has passed
the validator's 48,000-character limit, so in practice the fallback is
reached only for a target that cannot be found. That is why the test drives a 96,000-character home
page and reads what the route **sent**: the writer's answer is then refused
downstream (`no-page-back`, cost 0). So the change is a guarantee for a path that
real sites rarely reach. It does not save money on ordinary edits.

## 2. Two defects found in 2266's add-on wiring, fixed (in scope: the design's own rules)

- **The required pages were never required.** `aKeepPages` holds route ids
  (`/about`), and `requiredFiles` matches a page's stored path (`about.tsx`), so
  none of the pages an addition touches was guaranteed. A pick that left them
  out withheld them. Now `aPickTargets()` passes the stored paths. Both add-on pick
  calls use it.
- **The synchronous add-on bill left the pick out.** The job's `aBill` carried
  `aPick.usage`; the no-job charge (`if (!aJob) aCost = …`) did not. Added.

## 3. Tests

`test/edit-file-picker.test.mjs`, 7 cases, through the real routes with a stubbed
wire:
- page rung above the threshold: other pages withheld by name, only the picked
  one shown; a failed pick shows every page; below the threshold no picker call;
- the add-on: the scoped writer is not picked for; widened after a breach it is,
  once, and sees its own page and the picked one, with the others named; its
  own page is not in `unseenPages`; the pick's usage is on the bill (charged
  vs a control with the same answers and the default usage); a failed widened
  pick sends the whole site;
- the rewrite block under the window with and without a pick.

The add-on fixture (`test/fixtures/addon-route.mjs`) gained `scope` in the posted
body and `stubUsage` on a supplied answer (both shapes, Anthropic and xAI).

- **Red check** against `origin/main`'s `worker.js` and `builder/page-gen.mjs`
  (the new test and fixture kept): 3 of 6 fail (page rung withholding, the
  widened pick, its fail-open), and the rest pass, as they should. (The 7th case was
  added after the sweep's first round, see below.)
- **Sweep** (restored from saved copies, nothing committed during it): 8 of 8
  mutants killed, and the comment-only control survived. A first round had "the block ignores
  the pick" surviving (the page-rung fixture is over the window either way).
  The under-window case was added and kills it.
- **Full suite** (local, with node_modules linked, the machine shared with
  other suites): cut off at its 50-minute timeout after 10,113 top-level
  results (10,107 ok, 3 of them skips, and 6 not ok), so there is no final
  count. The 6 that failed:
  - `addon-queue`'s "one bill" placement guard. It was real: its pattern admits
    only a bare name as an extra term. Fixed (`aPickUsage`), and the file is now
    green.
  - the node_modules-symlink case (environment only);
  - media-verify's browser mode (environment only);
  - three browser cases under load (REOPEN 1, RC 12, PAGE 1). Rerun on their own,
    their three files are 29 of 29 green.

## 4. Overlaps

`worker.js` (page rung around `ePick`; add-on around `aPick`, the breach
widening, and the sync charge), `builder/page-gen.mjs` (`reviseSent`,
`priorPagesBlock`'s rewrite branch), `test/fixtures/addon-route.mjs` (two
additive options). These may touch the same regions as `addon-uncapped`,
`rebuild-scope`, `repair-everywhere` and `device-scope`, which also edit the
add-on writer and page-gen.
