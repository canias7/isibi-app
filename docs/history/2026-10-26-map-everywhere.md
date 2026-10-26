# The site map in every model call (2026-10-26)

**Why.** Live test 11 on driftwood-and-daughters-5: "put the reviews section above the lessons section" asked "Which component is the reviews section?" twice, even after being told the heading. `mapFor` had cases only for router, text, addon, row/rowNote, frame, reply and diagnose; the page rung, look lanes, nav, data, rules and picture saw no map, and the map had no block-to-words record.

## What changed
- `builder/site-map.mjs`
  - `blocksOf(source, partSrc)`: each page's composed `-parts/` components in render order, with the first three visible texts of each part. Stored as `pages[].blocks`.
  - `buildSiteMap` also takes `redirects`, `languages` and `rowCounts`; tables carry `rows`.
  - `siteSlice(map, kind, {page})`: every section (blocks, frame, tables with `*` required and row counts, page↔table links, key facts, photos, redirects, languages), the step's own section first, within 5,200 characters.
  - `withMapNote` / `mapSend` / `mapCall`: the slice is appended to the request's **system** turn once (marked `THE SITE AS IT STANDS`); an empty slice sends the call unchanged; a failed read fails open.
- `worker.js`
  - `siteMapNow` reads the map without saving (`refreshSiteMap(..., { save: false })`), falls back to the saved copy, is memoised 20 s per site, and is refreshed by every save. 4 s limit.
  - `refreshSiteMap` uses `specForAddon` (live columns, recovered tables), counts rows per table (≤24, read-only), reads redirects from the sidecar and languages from the stored look.
  - Wrapped: `eQuick` (every edit step and lane, frame, rename, keep checks), `aQuick` (every add-on call), the edit and add-on page writers (`mappedCall` around `pagesCall`), file picks, compile repairs (seam, build, add-on), the visual review, the build's page writer and repair deps, the reply writers (narrate, repeat note, widening question, scan reply) and the security scan.
  - The map goes **inside** `jobSend`, so a prepared answer is still replayed for the same request, and one slice is used for the whole job, so a repeated call is the same request.

## Left out, each named in `test/site-map-everywhere.test.mjs`
Transport definitions; the phone-app product; chat compaction; first-build design calls and seed rows (no site yet, or slug not yet chosen); the default `generateSitePages` transport (callers with a site pass a mapped send); `composeModelReply` and `diagnoseEnded` (already given the map); progress lines; `translateStrings` (no site in scope); the router (own budgeted inventory); the conversation (already given the verified owner's key facts; wrapping it read another owner's site in `input-handoffs`).

## Held by the owner
Today's date is not in the map (date handling on hold).

## Checks
- Guard: `test/site-map-everywhere.test.mjs`, 7 cases. It finds every `quickSend(`/`quickSendLive(`/`pagesCall(env)`/`callBuilderModel(` site in worker.js by pattern (≥30 found) and requires `mappedSend(`/`mappedCall(` on the line or a named exemption; stale exemptions fail too.
- Red: fails on the branch head before the change (import of the new exports).
- Sweep: 9 of 9 mutants killed; the comment-only control survived.
- Spelling guards updated for the wrapped lines: `addon-queue`, `build-repair`, `security-say`, `site-security`, `spine-repair`, `wiring`, `progress-more`.
- Full suite: 12,883 tests, 12,878 pass, 3 fail, 2 skipped. The failures: `site-secrets` (fails on `main` too), `canary-reopen-browser` REOPEN 1 (passes alone), and `progress-more` THE WIRING (a spelling guard, fixed after the run; passes).

**Full suite on `09e2dc19c` (all five changes):** 12,893 tests: 12,889 pass, 2 fail, 2 skipped. The 2 failures: `site-secrets` (fails on `main` too) and `canary-reopen-browser` REOPEN 1 (passes alone).
