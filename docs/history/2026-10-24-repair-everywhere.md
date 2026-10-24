# 2026-10-24 — compile repair everywhere (branch `repair-everywhere`, not merged, not deployed)

The owner: "the repair has to be everywhere … like literally everywhere".
Branch from `origin/main` `692087cde` (deploy 2266). Nothing spent, no model
called, nothing live written: every model answer and every compile in the
tests is a stub.

## 1. The live failure

`driftwood-and-daughters-2`, 2026-10-24 03:19, `site_builds.error`:

    src/routes/-parts/band-1-bleed.tsx (2:7): "default" is not exported by "src/components/ui/safe-image.tsx"

- The build's compile repair (`publishPages`) built `known` from the PAGES
  only. Bands live in `sitePartsForBuild` (`v.parts`), so the cited file was
  not known, `n` was 0 and the loop broke with no step recorded.
- Salvage refused: the home page imports the band ("the home page is the one
  that failed").
- The build fell to the placeholder. A deterministic fix existed: the kit
  exports by name only, so `import SafeImage from` should have been
  `import { SafeImage } from`.

## 2. The audit: every place code is compiled or published

There are two compile entry points in the Worker (`new Request("http://build/build"`):
`recompileAndPublish` (worker.js ~18303, inside the function at ~17716) and
the build route's `compile` dep for `publishPages` (worker.js ~19930). The
container's `build-server.mjs` runs `tsc --noEmit` then `vite build`
(build-server.mjs:2513–2525) for both; its `/job/run` runs the Worker's own
module, so container jobs take the same two paths.

| Path | Where (file:line on this branch) | Compiles through | Repair before | Repair after |
|---|---|---|---|---|
| First build | builder/publish-pages.mjs ~1660–1730 (`publishPages`), dep at worker.js ~19930 | publishPages | pages only; a cited part (band, frame) skipped silently | pages **and parts**; repaired part written to `sitePartsForBuild`/`v.parts`; every skip recorded |
| Revise | same `publishPages` (worker.js `react-build`, revise) | publishPages | pages only | pages and parts |
| Single-call fallback (`enforceFallbackFrame`) | builder/page-bands.mjs:1629, worker.js ~19616 | its output goes to publishPages | pages only | pages and parts (the frame parts are parts) |
| Pre-fix of imports (build) | builder/publish-pages.mjs ~1445/1453 (`repairImports` on pages and parts) | publishPages | path and member names | **plus the binding style** (default vs named) by the module's real exports |
| Shared publish seam `recompileAndPublish` | worker.js ~17716; hook at ~18380–18430 | the container | pages only (`touched`, else pages named) | pages and the site's parts (`withParts`), corrected parts returned to `siteParts`, sent, staged and saved (`partsRepaired`); a failure not offered to the hook says why (`compile-repair skip`: no-hook, killed, timeout, room) |
| Pre-fix of imports (seam) | worker.js ~17900 | the container | **none** | `repairImports` over pages and parts on every publish |
| `publishBeside` (parallel writes) | worker.js ~17664 | the seam | as the seam | as the seam |
| Edit rungs: text, data, rules, look (and its lanes), picture, logo, nav, page | worker.js edit route → `pendingPublish` → the seam | the seam | pages this change wrote | any file the error cites, pages or parts, else the pages written |
| Tweak (`site-tweak.mjs`) | builder/site-tweak.mjs:159 note; publishes via the seam | the seam | as edits | as edits |
| Add-on (own hook `aOnCompileFail`) | worker.js ~46705 (`compileRepairRounds`) | the seam | pages it wrote | its hook now receives the parts too; a cited part is repaired (`pagesForError`) |
| Add-on repair round after compile (`aAfterCompile`) | worker.js ~46650 | runs after a good compile | n/a (not a compile failure) | unchanged |
| Frame edits (`runFrameEdit`, `addFrameLinks`, `writtenFrame`) | builder/site-frame.mjs:55/242; worker.js ~38191, ~38718, ~46014 | the seam (parts) | a frame part the error cited was never repaired | repaired at the seam |
| "Back online" | worker.js ~48400 | the seam | pages | pages and parts |
| Rebuild drain | worker.js ~35505 | the seam | pages | pages and parts |
| Restore a stored version | worker.js:15504 `restoreVersion` | **no compile**: activates the stored build and script | n/a | n/a (nothing compiles) |
| Owner source route / preview | read only | no compile | n/a | n/a |
| Site CSS the model wrote | `css` rides the payload; the render check judges it | not a `.ts(x)` citation | not in scope | not in scope: a stylesheet fault is not cited by `tsc`/`vite` as a file the writer can patch; recorded, not widened |
| Agent builder | `agent-builder/` | its own product | not changed | not changed (noted only) |

## 3. What changed

- `builder/compile-repair.mjs`: `partFiles`, `withParts`, `splitParts`,
  `isKitFile`; `pagesForError` offers every cited file the build owns (pages
  and parts, written by this change or not; never a kit file), else the files
  the change wrote; a part is sent as a component (`inPart`).
- `builder/site-repair.mjs`: `compileBrief`/`compileRepairPages` send a part
  as a component (no address, `inPart`).
- `builder/publish-pages.mjs`: the build's repair loop works on
  `withParts(pages, sitePartsForBuild)`; the second compile carries the
  corrected parts; a fix that compiled writes them to `v.parts`
  (`compileRepair.parts`); a failed round puts the parts back. Steps:
  `compile-fix-skip` (`off`, `not-the-code`, `kit-only`, `no-owned-file`,
  `time`), `compile-fixing`, `compile-fixed`, `compile-fix-failed`
  (`refused`, `same-error`, `compile`).
- Salvage: a part the home page imports is stubbed (`homeParts`) instead of
  refusing the build; a broken home page itself still refuses, and a part a
  published page uses still keeps the site as it is. The stand-in
  (`partStandIn`) keeps the default export and every named export, drawing
  nothing. `buildFacts({ salvagedParts })` → `standIn`, and the build reply
  says which section stands in.
- `builder/page-gen.mjs` `repairImports`: the binding style is matched to the
  module's real exports. A default import of a kit module becomes the named
  import (same name, else the module's PascalCase name, else its one export,
  aliased to the local name). A part's exports are read from its source:
  named import of a default-only part becomes default; default import of a
  part with no default becomes named. Anything the export list cannot settle
  is left for the compiler. Guarded by a test that no kit module has a
  default export.
- `worker.js` `recompileAndPublish`: the pre-fix on every publish; the parts
  offered to the hook and taken back; repaired parts saved; skip reasons.
- Charges as before: repair charged only when it fixed; up to 2 rounds;
  `BUILD_REPAIR` default on. No new module (no Dockerfile change).

## 4. Tests

`test/repair-everywhere.test.mjs`, 12 cases: the live error replayed through
the real `publishPages` (band repaired, recompiled, written back); salvage of
a band home imports (stand-in, published, reply fact); the salvage plan's
three rules; the stand-in's exports; the skip and failed steps; the pre-fix
through `publishPages` and by every rule; the kit guard; the shared round on
a cited part the change did not write (the add-on's hook path); the edit
seam through the real `POST /api/site/<slug>/edit` with a stored band; a
frame part at the same seam; a placement guard on the seam.

Existing tests updated to the new rules: `addon-compile-repair` (an untouched
cited page is now offered), `build-repair` (repair off now records
`compile-fix-skip: off`), `compile-repair-all` (the seam guard's new form),
`publish-pages` (a part home imports is stubbed).

- **Red check** against `origin/main` (`692087cde`), the new file with
  fallbacks for the new exports: 11 of 12 fail; the kit guard (a fact about
  the kit) passes on both.
- **Sweep**: 20 of 20 mutants killed; the comment-only control survived.
  Restored from saved copies, compared byte for byte.
- **Full suite**: see §5.

## 5. Readings

**Full suite** (`node --test "test/*.test.mjs"`, world-readable worktree, `node_modules` linked then removed): `12470 / 12462 / 5 / 3` (tests / pass / fail / skipped). Two of the five were placement guards anchored to the old spelling (`test/edit-parts.test.mjs` hop on `saveSiteParts(…, parts, …)`, `test/site-tsx.test.mjs` hop 9 on `const siteParts`), re-anchored to the same property and green (42 / 42 with the build-budget files). The other three are the known environment-only cases: `no-generated-deps` (the linked `node_modules` symlink), `media-verify` (browser mode) and `canary-reopen-browser` (a real browser under load).

**Image prediction** (`.github/scripts/container-images.mjs`, `containerInputs` + `imageId` over git objects): site image `0bae00a7003bcc23` (main `692087cde`) → `d4825d2bd61fa606` (head, code commit `aaff77a0e`), 231 inputs on both ends, so it is rebuilt and rolled on merge (wait 15–20 minutes before container work). App image `65022ce71e3d7274` on both, reused. No new builder module, so no Dockerfile change.
