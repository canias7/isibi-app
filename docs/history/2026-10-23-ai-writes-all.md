# 2026-10-23 — The first build writes everything itself (`build-ai-writes-all`)

The owner's decision, 2026-10-23: **"the AI should write everything, that's
the point."** Branch `build-ai-writes-all`, from `origin/main` `edb9f7a30`.
Not merged, not deployed. Nothing paid, no model called, no live write.

## What changed, per item

1. **Six bands, enforced where the plan is read.** `normalizePlan`
   (`builder/site-plan.mjs`, `pageShapes`) keeps at most `MAX_SECTIONS` (6)
   bands per page; the design's own lines past the sixth leave the page and are
   named in a new optional `notBuilt` list, whole and in order. The design is
   asked for `notBuilt` on the first build's tool (`NOT_BUILT_FIELD`, right
   after `shape`): every further page, every section that did not make the
   best six, and every feature that needs stored data (no first build has a
   database). Short phrases from the design's own judgement; no keyword rule
   of ours. `withNotBuilt` puts the design's list in front of the cut bands.
   The " — then — " fold in `bandsOf` (`builder/page-bands.mjs`) is gone; a
   hand-made shape with more bands is cut to six, never folded.
   `directiveFromPlan` tells the writers what is left for later, so none fakes
   it. The shape field's wording no longer asks for kit component names.
2. **No kit menu.** The first build's design tool (`FRONTEND_SCHEMA_TOOL`,
   `worker.js`) drops `components` (the 15-name manifest, with the 2,112-name
   menu in its description) and `tsx` beside `backend`. The design graph lost
   its `components` agent (and `shape` waits for nothing); `tsx` left the
   graph's `extras` and the waves' `detail`. With no `components`, no
   first-build page brief carries "THE COMPONENTS THIS SITE NEEDS". A revise
   keeps `SITE_SCHEMA_TOOL` unchanged.
3. **The writers write their own components.** Every writer on the split path
   (each band, the header, the footer) gets `OWN_PARTS_RULE` in its user
   message: import nothing from `@/components/ui/`, write every part the band
   needs inside its one function, paint only with the theme's semantic tokens.
   The theme foundation stays (tokens, Tailwind, fonts, the site stylesheet,
   the theme registry). Plumbing stays importable: a module the brief's own
   directive names by path (picture, 3D scene, code), `LangSwitch`, and
   `@/site-brand` (logo, languages). The cached system block (`pageRulesFor`)
   is unchanged — it is shared with every edit and still describes the kit for
   the sites built from it — so the rule is said in the user message and said
   to win. Kit imports are **counted, not refused** (`kitImportCount`, on the
   `bands` mark as `kitImports`): a kit import still compiles, and refusing it
   would stub a whole band. On a website the custom-part declarations are
   superseded (no `tsx` on a first build; `generateSiteBands` runs parts only
   for a phone app). Compile check, repair/salvage and the Chromium render
   check are unchanged.
4. **The header and footer are model-written.** `FRAME` (`SiteHeader`,
   `SiteFooter`): two more writers run beside the bands (`frameRequest`,
   `framePrompt`), told the site's name and one-line description, its pages
   (`chromeFor` still computes these facts), the primary action, the logo
   (`SITE_LOGO`) and languages (`LangSwitch`), what is not built, and — with
   no database — never to write a form that pretends to save. Contact details
   and socials come only from the brief. Their answers become
   `-parts/site-header.tsx` and `-parts/site-footer.tsx`, checked and stubbed
   like a band; the shell (`pageShell` with `frame`) draws the skip link, one
   focusable `<main>` and the theme background, and no `SiteChrome`. A phone
   app keeps `AppChrome`. Their timings ride as slots `c1`, `c2`; the row
   carries `frame`, `wroteFrame`, `kitImports`.
5. **The reply's facts.** `buildFacts` takes `notBuilt` (strings only) and
   `noDatabase` (a real boolean only); `buildReplyFacts` turns each into a
   fact for the model reply writer (`narrateBuild`): each thing asked for and
   not built, "it can be asked for next, as an addition", and "this build made
   no database". Both build answers hand them over on first builds only: the
   inline one (`buildArgs.plan.notBuilt`, `!db`) and the collected one
   (`design.plan.notBuilt`, `!rBackend`). The browser's fixed "Built X…"
   stays only as the existing fallback.

## Tests

- New: `test/ai-writes-all.test.mjs`, 15 cases. Red check against
  `origin/main`'s product files (swapped in place from `git show`, restored
  from saved copies): 14 of 15 fail; the one that passes is the brief-manifest
  case, a property of its input (a plan with no `components`) that the old code
  already had — the kit-menu red is carried by the tool and agent cases.
- Changed only what the decision changed: the frontend tool's census
  (`frontend-build`), the design graph's and waves' fixtures (a `pages` agent
  stands in for the gone `components` one; `shape` waits for nothing), the cap
  and the no-fold cases (`site-plan`, `build-content-preservation`), the band
  fan-outs that now carry the frame (`band-build`, `build-content-outcomes`),
  the parts cases (now a phone app's, where parts stand: `page-parts`), the
  timing cases (the bands alone, a phone app's fan-out: `split-timing`), the
  collected answer's census (`buildFacts`, `replyState`, `replyWhy` now
  present on a first build: `build-answer`), and the schema harness binds
  `NOT_BUILT_FIELD`.
- Also `build-parallel-route` (the graph is 15 agents; the local fan-out
  carries 5 bands + the header and footer = 7 requests).
- **Sweep** (after the runs, from a green baseline of 151 cases over 7 files,
  restored from saved copies): 14 of 14 mutants killed (cap removed, overflow
  not named, design list dropped, fold restored, kit menu kept, `notBuilt` not
  asked, band not told own parts, no frame writers, frame not composed, frame
  not told no-database, `noDatabase` dropped, `notBuilt` not told to the reply,
  inline answer omitting the facts, design list never reaching the plan); the
  comment-only control survived.
- **Full suite** (`node --test "test/*.test.mjs"`, after the last change):
  `12319 / 12315 / 1 / 3` (total / pass / fail / skipped); the one failure is
  `no-generated-deps`' symlink case, expected with `node_modules` linked in.
  (A first run read `12319 / 12312 / 4 / 3`: the two `build-parallel-route`
  cases fixed above, `no-generated-deps`, and `media-verify`'s browser case,
  which passed alone, 11 of 11, and in the second run — load beside another
  session's suite.)
- **Integration checks** (`test/integration/*`): not run — the template's
  dependencies are not installed in this worktree and the disk had under
  300 MB free, too little to install them.
- **Image prediction** (`containerInputs`/`imageId`, the working tree against
  `origin/main`): site image `145239c1c143183b` → `83a06ec75544fb29` (226
  inputs, 194 distinct paths; changed: `worker.js` and six `builder/` modules);
  the app image `65022ce71e3d7274` unchanged.

## Risks for the first live build

- The cached page rules still say "THE KIT FOR EVERY CONTROL"; the user-message
  rule says it wins, but a model may still import kit parts. Counted on the row
  (`kitImports`), not refused.
- A hand-written header/footer may skip the mobile menu, mis-link, or
  overflow; one page means no page links, so the header is mostly the name and
  the action.
- A frame writer that fails leaves a stub that renders nothing: a page with no
  header or no footer.
- Edits on new sites: the menu/nav editor and the logo rung read `SiteChrome`
  props in the page; a site built this way has its nav in
  `-parts/site-header.tsx`, so menu edits will likely refuse (no menu found)
  until those lanes learn the written frame. Existing sites keep their files
  and are unaffected.
- Two more model calls per first build (header, footer), each sharing the
  cached system block: a little more cost and the fan-out's slowest call may
  now be a frame writer.
- The single-call fallback (`bands:sync|door|nofanout|thin`) still uses the
  kit and `SiteChrome`, and now gets no manifest on a first build.
- The cap now also applies when a stored plan with more than six bands is
  re-read (plans before 2026-10-21 allowed eight); the overflow then sits in
  `plan.notBuilt`, which only a first build's reply reads.
