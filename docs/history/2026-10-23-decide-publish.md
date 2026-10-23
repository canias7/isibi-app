# The owner's publish decisions (2026-10-23)

Branch `decide-g-publish`, from `origin/main` `a8fbfe876`. Offline only: nothing
paid, no model calls, no live writes, nothing merged or deployed. The finding
numbers are the rows of "Every kept finding, by severity" in
`docs/audits/2026-10-17-builder-audit.md`; the options are the ones set out in
`docs/history/2026-10-23-r1-g4.md` (#144), `…-r1-g6.md` (#118/#119),
`…-r1-g7.md` (#195), `…-r2-g1.md` (#216, #247) and `…-r2-g2.md` (#219).

| # | Finding | Owner's choice | Done |
|---|---|---|---|
| 9 | #195 A32-2 | split into batches; charge nothing for a refused round; stop retrying until the words change | yes |
| 10 | #118 A11-5, #119 A11-6 | offline wins until Back online; Publish and the background clean-up never bring an offline site back | yes |
| 11 | #219 A38-5 | prune old builds at each Publish: keep live, the previous version, all drafts and the last 20 | yes |
| 13 | #144 A17-5 | a platform rebuild publishes directly when the site has no unpublished draft; a draft otherwise | yes |
| 14 | #247 A07-6 | new site names at most 43 characters; existing sites untouched | yes |
| 15 | #216 A36-4 | the router and reply instructions say changes are drafts until Publish; "publish my changes" points to the button | yes |

## 9 · #195: translations in batches, a lasting failure remembered

- **Batches** (`builder/site-translate.mjs` `translationBatches`): a language's
  missing strings go in calls of at most 150 strings and 6,000 characters (as
  sent, JSON): about a quarter of the 8,000-token answer in English, so a
  language at twice the tokens still fits. Order is kept; nothing is asked
  twice. At most three calls at once per language (`translateMissing` in
  `worker.js`), on the spine and on the build path (the build's early
  "translations beside the photographs" asks batch by batch too, so the
  compile still reuses its answers).
- **Each batch's successes are kept**; a failed batch's strings stay missing
  (`nextCache`'s new `failed` set) and are never cached as themselves.
- **Charged only for a usable batch.** A refused round was already uncharged
  since A32-1; that rule now holds per batch. An answer cut off at its limit
  (`stop_reason: "max_tokens"`) is read as a `size` failure.
- **A lasting failure** (`size`, `shape`, `length`, `unusable`) is remembered by
  the batch's key (FNV-1a of its words in order) under `langStrings._stuck`
  (`STUCK_KEY`; a language tag never starts with `_`, so no new config field).
  Such a batch is not asked again, or billed, until its words change; only this
  round's keys are kept, so the list cannot grow. A passing failure (the call
  failed, no key) is still retried on the next change.
- **The customer is told** (`langNote`): a lasting failure says "I won't try
  those words again until you change them"; a passing one keeps "I'll try again
  on your next change"; a partly translated language counts the phrases left
  behind.
- **Not done** (not chosen): moving translation out of the publish turn.

## 10 · #118/#119: offline wins until Back online

- **An offline marker** `site-offline/<slug>.json` in R2, written by the offline
  route before the site goes down (removed again if the take-down fails) and
  removed only once Back online has landed. `offlineMarked` answers true,
  false, or null (could not tell); everything that would make a site live reads
  null as offline.
- **Publish** (`publishDraft`, set-aside, `runPublication`) refuses on an
  offline site before any journal is written: 409, "Your site is off the web,
  so nothing was published. Press “Put it back online” first, then Publish."
  The publication recovery and the script-note sweep skip offline sites (the
  sweep's notes wait for Back online). The build's stand-in page is not put
  over an offline site. The platform rebuild never goes live on one (item 13).
- **Taking a site offline retires an open publication** on the etag read
  (`abandoned: "offline"`), and the reply adds "A publish that was under way was
  stopped; press Publish again once the site is back online."
- **The site list** (`/api/sites`): under draft-first a build after the switch
  is no longer read as a publish; for exactly those rows the list asks the live
  marker (`sites/<slug>/site.live`): present, online; absent, offline;
  unreadable, cannot tell. Without draft-first the old rule stands.
- **The job gateway** may read its own site's marker (read-only) so a container
  build sees it; it can never write it.
- **Limit**: a publication whose runner is already past the check when the site
  is taken offline can still finish; the window is the runner's own switch.

## 11 · #219: old builds pruned at each Publish

- After a Publish marks the draft published (`markApplied`), `pruneAtPublish`
  keeps the newest 20 builds (`PUBLISH_KEEP_BUILDS`), the version just
  published, the one it replaced (`j.from`) and the pointer's parent, and every
  draft revision not yet published (`draftKeeps`). It prunes only when the
  pointer is on the published version and the draft record reads; otherwise it
  keeps everything until the next Publish. Best-effort: never the publish's
  answer. Build ids of 1–6 characters after the stamp are all kept when named.

## 13 · #144: the platform rebuild

- `recompileAndPublish` takes `liveWhenClean`, passed only by the platform
  rebuild route. Under draft-first it activates live when `rebuildGoesLive`:
  the site has a live version, nothing saved and unpublished in its draft, and
  is certainly not offline. Then the draft record follows the new live version
  (`rebaseDraft`, as a Versions restore does), so the old one never reads as an
  unpublished draft. Otherwise it saves the draft, as before; a draft record
  that cannot be read keeps the draft.
- The drain (`site-rebuild.mjs`): a draft-only rebuild is done (the row goes:
  the patch reaches visitors at the owner's next Publish) and counted as
  `drafted`, never as `rebuilt`.

## 14 · #247: new names at most 43 characters

- `MAX_NEW_SLUG = 43` and `capNewSlug` (`site-draft.mjs`). A customer naming a
  NEW site (the lookup answered "free") over 43 characters is refused before
  any money moves: 400, cost 0, "That site name is too long: a new site's name
  can be at most 43 characters. Say a shorter name in your next message, e.g.
  "call it …"." The designer's invented name is cut to 43, and the designer is
  told the cap; `freeSlugFor`'s numbered candidates fit too. An existing site,
  or a lookup that could not tell, keeps its name; `cleanSlug` still reads 60.

## 15 · #216: drafts until Publish, told to the router and the reply

- `siteDigest` (the router's site block) adds `DRAFT_FIRST_FACT` when the route
  sets `draftFirst` from the Worker's own switch (never the browser's body):
  every change is a draft until the Publish button above the site; nothing the
  router routes publishes; "publish my changes" / "make it live" is answered
  "ask" with a pointer to the Publish button.
- The reply's own context (`siteContextBlock`, already told about drafts by
  A36-4) adds the same pointer.

## Tests

- New: `test/decide-publish.test.mjs` (20 cases: the pure rules, the route
  refusal and the designer's cut through `driveBuild`, the router's request
  through the real routing route, and the wiring of each offline check);
  `test/draft-first.test.mjs` DPO1, DPO2 (offline), DPP1, DPP2 (prune), DPR1,
  DPR2 (rebuild), through the real routes and store; `test/edit-path.test.mjs`
  three "audit #195" cases driven through the edit route;
  `test/fresh-build-slug.test.mjs` one case (a numbered candidate fits 43).
- Updated guards (the property kept, the spelling moved): `edit-path` and
  `translate-unsafe` (a lasting failure is told as lasting), `site-langs`,
  `wiring` (five assertions on the translation loop), `edit-reserve-refused`
  (the spine's signature), `site-offline` (the list asks the rule twice).
- **Red on the old code** (the product files copied aside and restored by
  copy, never `git checkout`): with all old product files, DPO1, DPO2, DPP1,
  DPR1, DPR2, both "audit #195" batch/stuck cases, both A32-1 cases (their new
  wording) fail, and `decide-publish` and `fresh-build-slug` fail to load
  (missing exports); with only the old `worker.js` under the new modules, 9 of
  `decide-publish`'s 20 fail. DPP2 and "a cut-off round is never charged" pass
  on the old code by design: no prune ran at all, and A32-1 already left a
  refused round uncharged; they guard the new code.
- **Sweep** (from a green baseline, 109/109 on the three driven files; each
  mutant applied to a saved copy and restored by copy): 14 mutants, all killed
  in the end (#247 cap at 60; the digest's switch; the body's word over the
  Worker's; cannot-tell read as online; a draft rebuild counted rebuilt; no
  prune cap; the recovery ignoring the marker; Publish asking after the
  journal; one batch for everything; a remembered batch asked again; a lasting
  failure not remembered; a failed batch cached as itself; Back online keeping
  the marker). Two survived the first pass (the recovery's skip, covered by
  `runPublication`'s own gate; the count cap, hidden by the character cap):
  DPO2 now asserts the journal is not taken over and the unit case tests the
  count cap alone; both were killed on the re-run. The comment-only control
  survived (109/109).
- **Affected files**: every test file naming translation, offline, the rebuild
  drain, the digest, the gateway's readable keys, the stand-in page, the prune,
  the preview label, `freeSlugFor`, the conversation module or the spine (117
  files) plus the new one: 3,006 tests, 3,003 pass, 2 skipped, 1 failed under
  load (`app-builder` QUEUE, a timing case this change does not touch), which
  passes alone (11/11). The full suite was not run.

## Screenshots

`shots-pub/` in the session's scratchpad: the name-too-long reply, the Publish
refusal toast, the offline reply with an abandoned publish, and the three
translation notes, each at 900 and 390 pixels, in `public/styles.css`.
