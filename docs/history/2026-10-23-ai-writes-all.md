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

## Second round: the three gaps before it can ship (`ab966c4ea`)

Nothing paid, no model called, no live write.

1. **Menu, button, footer and logo edits on a written frame.** A site has a
   written frame when `site-header` and/or `site-footer` are stored parts and
   no page names `SiteChrome` (`writtenFrame`, `builder/site-frame.mjs`; a fact
   about the files, no keyword rule). On such a site the `nav` rung (which the
   look door's `action` lane and the add-on step's frame additions also reach)
   runs `runFrameEdit` instead of the menu editor: one quick call is shown the
   change, the site's routes and both files whole, and answers each file it
   changed, whole (`edit_frame`). Each answered file is checked before
   anything is stored (default export kept, no `SiteChrome`, nothing from the
   kit but `safe-image`/`lang-switch`, every internal `to=`/`href=` one of the
   site's routes); a file answered unchanged is not a change ("already so",
   `satisfied`, not charged on a job); a bad file refuses the whole answer.
   Then `publishStep` compiles the pages with the new parts, so a file that
   does not build leaves the site untouched. The logo rung on such a site
   stores the logo as before and, in the same publish, runs the frame edit
   with the customer's words and the note that `SITE_LOGO` is set ("put a logo
   next to the name"); a frame edit that fails leaves the logo publish as it
   was. A `SiteChrome` site never enters either path.
2. **Own-parts rules.** `pageRulesFor(spec, kind, { ownParts })`: an own-parts
   site's cached block replaces rule 3 ("THE KIT FOR EVERY CONTROL") with
   "NO KIT: WRITE EVERY CONTROL YOURSELF", the shadcn form wiring with plain
   elements, the chart rule with "no chart modules", drops `## Charts`, and
   ends with a block that wins (plumbing paths only, tokens only, no
   `SiteChrome`, the header/footer parts by path). A kit site's block is
   byte-identical (cache kept); a phone app keeps its block. The first
   build's band and frame writers read it; the page rung and the addition's
   writer pass `ownParts: ownPartsSite(pages, parts)`, and `pagesRequest` adds
   `OWN_PARTS_NOTE` to the message.
3. **The single-call fallback.** On a first website build (not a revise, not
   a phone app) the one `write_pages` call reads the own-parts block and its
   brief ends with `ownFallbackDirective`: write `site-header` and
   `site-footer` in `parts` (default exports `SiteHeader`/`SiteFooter`), from
   the frame writers' facts, composed like `pageShell`, no `SiteChrome`. So
   the fallback lands the same two files the band path writes, and item 1's
   detection finds them. The Dockerfile copies `builder/site-frame.mjs`.

### Tests

- New: `test/written-frame-edit.test.mjs`, 16 cases (module, the real edit
  route on a written frame for the menu, the footer link, the header button,
  a refused route, a kit-site control, the logo; the rules blocks; the edit
  request; the fallback directive and its wiring).
- Red check against the branch's prior product files (swapped in place from
  `git show HEAD`, restored from saved copies): with the prior `worker.js`, 7
  of 16 fail (every route case but the kit control, the edit wiring, the
  fallback wiring); with the prior `page-bands.mjs` the file cannot load (no
  `ownFallbackDirective`), and the prior `page-gen.mjs` has no `ownParts`.
- Changed only what the decision changed: `page-bands` (the band's block is
  the own-parts block), `edit-page-rpc-state` (the band equals an own-parts
  page call; the state paragraph rides both). Every existing `SiteChrome`
  menu, logo and edit test is unchanged and green (`menu-per-page`,
  `site-nav`, `edit-failure-paths`, and the rest).
- **Sweep** (from a green file, restored from saved copies, nothing committed
  during it): 12 of 12 mutants killed (SiteChrome ignored, route check off,
  unchanged read as a change, nav never taking the frame path, the logo
  publish dropping the parts, `ownParts` ignored, kit rule kept, bands on the
  kit block, the page rung not told, the fallback not own-parts, the fallback
  brief without the directive, the directive without the facts); the
  comment-only control survived.
- **Full suite** after the last change: `12335 / 12331 / 1 / 3`; the one
  failure is `no-generated-deps`' symlink case (`node_modules` linked in).
- **Image prediction** (`containerInputs`/`imageId` over the commit):
  `origin/main` `145239c1c143183b` (226 inputs, 194 paths) to `ab966c4ea`
  `3472236405d03300` (227 inputs, 195 paths: `site-frame.mjs` joined);
  the app image `65022ce71e3d7274` unchanged.

### Risks still open

- The frame edit is one quick-model rewrite of a whole file; a model may
  still restyle or reword beyond the ask. Checked mechanically (routes, kit,
  export, compile), not judged by the keep check the page rung uses.
- The add-on step's menu-link writer for a NEW page (`applyAdditions` in the
  add-on route) still writes `SiteChrome` links; on a written frame a new
  page is not added to the menu until the customer asks.
- The fallback is told, not forced: a model may still wrap the page in
  `SiteChrome` or import kit parts; nothing refuses it, and kit imports are
  only counted on the band path.
- Other lanes that write TSX (the look door's quick writers, `runTweak`) are
  not told own parts; they restyle existing code and their prompts do not
  push the kit.
- A logo added on a written frame now costs the frame edit's call (the logo
  rung was free).
