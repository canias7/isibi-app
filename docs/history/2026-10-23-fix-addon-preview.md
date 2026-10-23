# 2026-10-23 — Add-on compile repair, no orphan database, preview loading state, /sentinel as a message (`fix-addon-preview`, not merged, not deployed)

Branched from `origin/slash-commands` (`2ebe12f9f`, main + the slash menu).
Root causes were investigated live on `saltmarsh-and-sparrow` the same day.
Nothing spent, no model called, no live writes.

## 1. An add-on that did not compile got no repair

**Cause.** The page writer emitted `import … from "/components/ui/section-header"`
(no `@`). vite failed. `repairImports` (`builder/page-gen.mjs`) matched `@/`
only; the add step's model repair round runs at the spine's seam, after a
SUCCESSFUL compile, so the route gave up.

**Fix.**
- `repairImports(pages, { parts })` first rewrites a misspelt alias
  (`/`, `/app/`, `/src/`, `src/`, `~/`, `@components`, bare `components/`, and
  for kit modules `./`/`../` chains) to `@/…` **only when the target exists**:
  a kit `ui/` module the kit has (`kitPathExists`), or `routes/-parts/<name>`
  for a component in the site's parts. Nothing else is guessed (`aliasFor`).
  Every caller passes the parts it knows (add-on: written + stored; page rung
  and build: their own).
- `recompileAndPublish` takes `onCompileFail`: on a compile that failed on
  the CODE (not a killed container, a timeout or no room) it is handed the
  compiler's message once and may answer a corrected build (`recompile`);
  otherwise the failure stands as before. Forwarded through `publishBeside`.
- The add-on route's hook runs `compileRepairRound`
  (`builder/compile-repair.mjs`): at most 3 pages, only pages this addition
  wrote (named by the error first), the error cut to 4,000 characters, the
  job's clock asked first, one model round, one recompile. **Charged only when
  it fixed the build** (reserve #6); a failed addition still costs nothing.
- The edit page rung does not go through this route's hook (it publishes
  through its own lane); it gets the deterministic alias repair only.

## 2. An orphan database when the add-on failed

**Cause.** `ensureSiteBackend` started beside the page writer; a compile that
then failed left the new Neon project with nothing undoing it.

**Decision.** Tearing a provision down touches four stores on a live site
(the project row whose delete enqueues `neon_teardown`, the backend row, the
route, Neon) and no existing path undoes a provision on a site that stays. So
the instructed alternative: **on the page path the provision waits for the
seam** — after a successful compile (and the compile repair), right before
the schema's apply. The pageless path (no compile) starts it as before. A
provision that fails at the seam is answered as the provision's own failure
(`aProvFailed`), never as a compile. The reply's facts follow the evidence:
a stopped or failed addition now reports no database made.

**Tests reversed on purpose** (they pinned the orphan as the outcome):
`addon-failure-outcome` ROUTE 5 and PROV 4's second half,
`failure-evidence-flow` STOP 1. `late-provision` PROV 8–12 now write a page,
so their provision failures are reached at the seam.

## 3. The preview flashed "This site isn't published yet…"

**Cause.** `siteDraftState` starts empty; the first paint pointed the frame at
the live address until `loadDraftState` answered.

**Fix** (`public/chat.js`, `public/styles.css`):
- Until the draft reading is in, `sitePreviewSrc` answers `''` and the frame
  shows a neutral loading state (`.st-frame-loading`, "Loading your preview…").
- The last draft address the frame showed is remembered per site (memory and
  `sessionStorage`, try/catch) and opens at once on reopen; a reading that
  says nothing is unpublished forgets it.
- A never-published site (`state: 'unpublished'`) whose draft preview is not
  ready waits too, never showing the live placeholder. A published site's
  live address is shown as before while its draft is prepared.
- The first reading repaints the workspace even when the frame key did not
  move; a failed first reading falls back to the live address.

## 4. /sentinel is the customer talking to the model

- `/sentinel` sends **"/sentinel — please run a deep security check of my
  site"** as an ordinary message (`siteSend`), shown in the thread, through
  the router.
- The router's `security` answer (typed or plain words, one path) now goes to
  `siteSecurityOffer`, never straight to the paid scan (that was the plain-words
  defect). It reads `GET /security?estimate=1&say=1&message=…`: the server
  sizes the scan with `planScan` (areas and reviewers by the site's files and
  tables, unchanged) and the reply writer writes the offer (what it will check,
  the price) and a working line from facts (`builder/security-say.mjs`).
- Confirm: "Yes, run the check" / "Not now" (no price on the button; the price
  is in the model's words). The scan is the panel's handler, posted with
  `say: true`; the server writes the report in the model's words from what it
  found. With replies off or no text written, the page shows the bare facts.

**Live progress talk (added scope).** `deepScan` now also reports `area`
(each area as it finishes) and `verdict` (each challenged problem) beside
`hunt` and `challenge`. When the chat asks (`say`), the route keeps each event
under the scan's key (`security/<slug>/progress-<key>.json`); the page polls
`GET /security?progress=<key>` every 4 s while the scan runs, and each event is
worded once by the reply writer from `securityProgressFacts` (facts only).
Nothing the customer reads or the writer is given names Cloudflare.

## Tests

- New: `test/addon-compile-repair.test.mjs` (9), `test/preview-loading.test.mjs`
  (5), `test/security-say.test.mjs` (4); rewritten: `test/slash-commands.test.mjs`
  (11), `test/site-security.test.mjs` (two guards).
- Red on the old code: every new case and every rewritten guard fails with
  the product files put back to `2ebe12f9f` (22 failing, compile-repair's
  file failing on import).
- Mutation sweep, from a green baseline, over the five focused files: 18 of 18
  mutants killed (one re-confirmed by hand: the sweep's 1 MB stdout cap hid its
  summary), the comment-only control survived.
- Progress talk: 2 more cases in `test/security-say.test.mjs`; 3 of 3 mutants
  killed, comment control survived.
- Full suite: one run before the last fixes read `12333 / 12317 / 13 / 3`; every
  failure was then fixed or explained (guards re-anchored to the new
  provision, `quickSend` count, Dockerfile COPY for the two new modules,
  composer-sends census, DPF function guards; `media-verify` browser mode fails
  on `origin/main` too; the node_modules symlink case is the known one;
  `canary-reopen-browser` REOPEN 1 failed once under four parallel suites and
  passed 5 of 5 alone). The final full run was skipped on the coordinator's
  word (it runs once on the combined branches); the 17 affected files pass
  (766 / 766).

## Screenshots (stub model text; real styles.css, real chat.js functions)

Scratchpad `shots-addonfix/`: `1-preview-loading.png`, `2-sentinel-message.png`.
