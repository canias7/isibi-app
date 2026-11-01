# The builder app and the agent builder: rules from shipped fixes

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). The agent builder's
> half that lives in this app, and the browser app's rules (the start box, the
> preview panel, the SEO tab, model context and limits, the page list, Publish
> and Refresh, the toolbar, the customer's screen as the browser composes it).
> `agent-builder/CLAUDE.md` is the agent product's own record. The short
> summary CLAUDE.md kept moved here in the second pass (`git show
> 28bdc97f:CLAUDE.md`) and is the first section below.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## The builder app and the agent builder, in brief

The full rules are `docs/app-rules.md`, with the model table (each model's
context window, output limit and price); the agent builder was deleted on 2026-11-01.

- **The agent builder was deleted on 2026-11-01** (see below).
- **In the builder app**: typing in the start box is a fresh build, never a
  revise; a failed build reverses its design charge (by ref, never an amount);
  the preview panel runs the site's own JavaScript, sandboxed per URL
  (`frameSandbox`); a project has an address (`/projects/<id>`); a published
  site's runtime errors reach the panel over `isibi:runtime-error`, a wire
  string on the do-not-rename table; the SEO tab shows and saves the real head
  (the description is patched in the sidecar, which is the deployment; the
  title is read-only); every small call follows the builder picker
  (`BUILD_MODELS.quick`); the page list is read from the server
  (`GET /api/site/routes`). Context is not a limit anywhere today (the biggest
  call is ~20,000 tokens); the wall a build meets is the wire.

---

## Rules from recent fixes

Each of these is shipped and live. What is kept is the RULE and the NUMBERS.

### The agent builder

**Deleted 2026-11-01 on the owner's word** (branch `remove-agent-builder`): the Agents view, `/api/agent/*`, `agent-store.mjs`, the `agent-runs` queue binding and the separate `agent-builder/` product are gone. Its rules as they stood are in history (`git show dc31084dc:docs/app-rules.md`).

### The rest

- **TYPING IN THE START BOX IS A FRESH BUILD, NEVER A REVISE.** Three
  conditions, each a refusal to guess: the DESIGNER chose the name, the chat is
  POSITIVELY known to own no site (`mine === null`, never truthiness — a blip
  must not buy a second paid site), and the name is held BY US. The trailing
  number is REPLACED, not stacked. Settled at the SLUG, above `env.JOB_SCOPE`.
- **A FAILED BUILD REVERSES ITS DESIGN CHARGE.** Both conditions: our fault AND
  no live site, since a salvaged build was delivered. The collector has no
  ledger, so it reverses BY REF (`REVERSE_WHOLE` is a CEILING, never an amount).
  `ok` is the only field separating "nothing to reverse" from "could not".
- **RULE 7 NAMES `SafeImage`'s MODULE.** It orders `<SafeImage>` on every
  picture and never said where it comes from — the one component the rules make
  MANDATORY is the one whose path may never arrive, and a missing module is the
  one class `vite` cannot bundle around. `repairImports` also rewrites a
  `@/components/…` path naming no file to the one kit module exporting what is
  imported — **2,385 of 2,412 exported names belong to exactly one module** —
  and refuses to guess three ways. **Zero false alarms over 3,736 real files.**
- **THE PREVIEW PANEL RUNS THE SITE'S OWN JAVASCRIPT.** `frameSandbox(url)`
  decides per URL and FAILS CLOSED: our own origin keeps the tight flags,
  because `allow-scripts allow-same-origin` on a frame same-origin with the app
  can reach in and take its own sandbox off. The start screen's thumbnails stay
  tight deliberately — 51 sites is 51 React bundles to paint 51 postage stamps.
- **A PROJECT HAS AN ADDRESS** — `gofarther.dev/projects/<id>`. Not the slug: a
  slug is renameable and does not exist until the build finishes, which is the
  eight-minute window where a stable address is worth most. `openProject(id,
  mode)` is the ONE way either screen opens; an id naming nothing corrects the
  address rather than lying.
- **A PUBLISHED SITE'S RUNTIME ERRORS REACH THE PREVIEW PANEL.** Every generated
  site posts `isibi:runtime-error` to `window.parent`; the panel only ever read
  `__siteErr`. The half that DID work covers the blob DRAFT preview only, so a
  published site framed at its own URL had no reporter — **the ordinary case**.
  The general shape: *two halves built to meet and not wired, where the working
  half covers the case anybody testing would look at.* **THE WIRE STRING STAYS
  `isibi:runtime-error`** — every site published before today bakes that literal
  into its frozen bundle. It is on the do-not-rename table with
  `isibi-marquee`, and **the brand scan's exemption is DERIVED from that
  table**.
- **THE PHOTOGRAPH PIPELINE OPERATES ON THE FILES THE MODEL WROTE, NOT ON
  `pages`.** **Five steps did that work and every one read `pages`** — so a
  band-split build's PARTS were never planned, bought, counted or SWEPT, and the
  token shipped into the bundle as a literal the page drew as alt text.
  **MEASURED live: 11 `SafeImage`s, 9 correct and 2 raw `<img>` carrying the
  token.** Cost one 30-credit build. `imageSources(pages, parts)` is the ONE
  reader, so a sixth step asks it and cannot forget; **it is for READING only**,
  because `applyImages` writes each file back into the list it came from — never
  over the union sliced apart by length. **`lintPages` is deliberately NOT
  widened**: measured over the 100-site corpus (324 files) a page presented at a
  part path produces **322 findings against 222**, the 100 extra all one rule.
  **Open.**
- **THE SEO & SOCIAL TAB SHOWS THE SITE'S REAL HEAD.** It was eleven lines of
  hardcoded markup stating **three false facts about the customer's own
  business** — a suffix no site has ever served, grey prose where a real
  description was stored, and "Generate · soon" for a card the container has
  composed for weeks. **A step past the dead-control finding**: a dead control
  does nothing; this one ANSWERED, wrongly. **THE SPLIT IS `site-runtime.ts`'s
  OWN**: `description` and `image` are PUBLISH-TIME and live in the R2 sidecar,
  so **patching that one key IS the deployment** — no container, no compile, no
  credits; `title` is BUILD-TIME, baked as `SITE_NAME`. **THE TITLE IS
  DELIBERATELY READ-ONLY**, because `SITE_NAME` paints the header, the share
  card and `og:site_name`. `MAX_HEAD_DESCRIPTION` **300, DERIVED** from the
  publish path's own slice; `GOOD_DESCRIPTION` 50–160 is **advisory only**;
  `cleanHeadDescription` REFUSES a non-string instead of coercing;
  `pickableImages`' two filters are both load-bearing (a stranger's upload must
  never become the business's preview; an og:image at a PDF renders NOTHING,
  silently). The POST **READS AND MERGES the look** — `withConfig` replaces a
  named field WHOLE, so a bare `{look: {description}}` strips the theme, brand,
  mark and every language. **AND THE APP'S OWN `img-src` REFUSED THE CARD** —
  this panel is the first thing to put a SITE's origin in front of the app's
  browser, and **a CSP refusal on an `<img>` is silent**. `https://*.<SITE_ZONE>`
  joins `img-src`, derived the way `frame-src` already derives the same
  wildcard — **so the app already runs those origins' SCRIPTS in a frame, and an
  image is strictly less capable**. `connect-src` is deliberately NOT widened.
  **A FALSE BELIEF ABOUT CSP NEARLY WENT INTO THE GUARD**: a real `*.host`
  source matches ANY subdomain depth. The matcher is deliberately ONE label,
  which is the SAFE direction — it can report a refusal a browser would allow
  and can never report an admission a browser would refuse.
- **HOW FULL THE MODEL'S CONTEXT WINDOW GETS** — More → Model context. **It
  answers what the NEXT call carries, not only what the last one did**, which is
  why it has anything to draw. **MEASURED: first build 64,115 chars of tool +
  1,962 system ≈ 22,070 tokens; a revise 93,637 + 1,962 ≈ 32,718** — **2.2% of
  Claude's window and 4.4% of Grok's**. **The design tool is 96.8% of that call
  and the customer's brief is 0.2%.** **The total is EXACT and the parts are
  ESTIMATED, and the report says which** — characters at this repo's own 3:1,
  SCALED to the provider's real input total. **All three input kinds count**:
  billing prices a cached read at a tenth, the window does not care. **AN
  UNKNOWN MODEL HAS NO PERCENTAGE** — never of a guessed denominator and never
  0%. **The bar is a fill gauge against the window**, and drawn as composition
  alone every row read 100% full whatever the model — the picture and the figure
  said opposite things, and only a render could see it.
- **THE PLATFORM KNOWS WHAT EACH MODEL WILL ACCEPT** — read from the providers'
  own docs; **these move, so re-read rather than trusting this table**:

  | model | context | max output | $ / MTok in · out |
  |---|---|---|---|
  | `grok-4.7` (default since 2026-10-24) | **500K** | **no stated limit** | $2 · $6 |
  | `grok-4.6` (before; still priced and sized for old rows) | **500K** | **no stated limit** | $2 · $6 |
  | `claude-sonnet-5` | **1M** | 128K | $2 · $10 |
  | `claude-opus-5` | **1M** | 128K | $5 · $25 |

  **CONTEXT IS NOT A CONSTRAINT ANYWHERE TODAY**: the biggest thing sent is
  ~20,000 tokens against a 500,000 floor — 25× headroom on the smallest. **The
  wall a build meets is the WIRE.** Every `*_MAX_TOKENS` is an OUTPUT ceiling;
  not one is an input bound. **KEYED BY MODEL ID, NEVER BY PICKER** — `design`
  and `pages` are separate entries. **THREE STATES FOR AN OUTPUT LIMIT**: a
  number, **`Infinity`** (a provider that states none), `null` (no row). Writing
  "no limit" as null too would be two nulls meaning opposite things. **The guard
  with teeth**: every ceiling the platform really sends must fit inside the
  SMALLEST `maxOutput` any picker can reach — the largest sent is 30,000 against
  a floor of 128,000 — and **the floor is asserted FINITE**, or taking the MAX
  by mistake makes it `Infinity` and the check says nothing while staying green.
- **THE PAGE LIST ONLY EVER EXISTED IN THE BROWSER THAT BUILT THE SITE.**
  `sitePages` reads `site.pages` out of localStorage; a site adopted off
  `/api/site/list` has none, so every page but the home page was unreachable in
  the preview on every other machine. **Nothing failed and nothing logged** — a
  label is a correct rendering of an empty list. **TWO READERS OF THAT EMPTY
  LIST, and the second is the tell**: the subtitle also said "Previewing last
  saved version" on a three-page site. `GET /api/site/routes?slug=` is its own
  route because `/api/site/source` hands back **489,100 bytes** to answer a
  dropdown. **PATHS ONLY** — the browser composes display names, so a second
  composer on the wire would be two lists of one thing. **Measured cost: the bar
  settles ~39px once** per adopted site. **OPEN**: the preview frame runs the
  site's own JS, so a click inside it really navigates and nothing tells the
  picker or the URL chip.
- **`/api/site/source` CARRIES `reads`, ONE BOOLEAN PER STORE.** Four loaders
  collapsed a failed read into an empty list, and **`loadConfig` had answered
  `{ok, why}` since it was written and the route dropped it on the floor** — so
  a bucket that threw answered byte-identically to a site with nothing on it,
  and a comparison taken across it said *"nothing was added and nothing was
  lost"*. **The 200 and `ok: true` stay** (the explorer is read-only and must
  get everything readable); what was missing was the ability to say so.
  **`complete` is three states and `null` is the one that matters** — an older
  Worker sends no `reads` and CANNOT SAY, and reading its silence as "complete"
  is how an instrument goes back to reporting an unread store as an empty site.
- **PUBLISH IS A DOOR ON THE WORKSPACE BAR, AND IT IS NOT THE BUTTON THAT WAS
  DELETED.** The old one was drawn `isReact ? '' : …` — it appeared ONLY on a
  project that had never built, the single state in which it had nothing to
  open. **It is not a dead control**: three working actions behind it and one
  true sentence. **The title carries the honesty, because the label cannot.**
  DIMMED rather than hidden before the first build.
- **THE REFRESH BUTTON DID NOTHING ON ANY REAL SITE, AND IT IS THE PUBLISH
  BUTTON'S DEFECT ONE CONTROL LEFT.** `if (f && curHtml)` is the STATIC path,
  and a React site's pages are written `html: ''`. **Two instances in one bar in
  one night says the class is worth its own sweep**: every handler still gated
  on `curHtml` or `site.html` against a render that asks `isReact`. **Not
  done.** **The bump is not cosmetic** — assigning `fr.src` a value it already
  holds does not reload an iframe. `sitePreviewSrc` is the ONE expression.
- **THE WHOLE RIGHT-HAND GROUP IS PREVIEW-ONLY.** Both side groups are
  `flex: 1 1 0` and split to min-content, so a block REMOVED on a view change
  moves the centred tabs at every width — the bug three earlier attempts had to
  learn. The four wear `st-tb-pv-off`: **`visibility: hidden`, never
  `display: none`**. ONE wrapper, not four classes, because four separately
  hidden children still collapse the gaps between them. **MEASURED across six
  widths (1024–1920): 0.00px tab shift**, the group 375.4px in both views. **The
  bar's wrapping below ~1180px is pre-existing** (48.97px at 1180+, 57.19 at
  1100, 71.19 at 1024, 85.19 at 960 — byte-identical before and after).
- **NO GUTTER BETWEEN THE CHAT AND THE PREVIEW.** `.st-body`'s `gap: .8rem` was
  **12.8px** of page background between two cards that are one workspace. **The
  visible gutter IS the flex gap**, because at `data-dev="desktop"` `.st-frame`
  is `width: 100%`. 12.8 → 0, and **the preview gains all of it** (825.2 →
  838px at 1320px). It only ever separated those two.
- **A LIVE WIRE IS GREEN** (`--wire-live: #00c853`). The app's wire is always
  false, written as a value rather than omitted so the day a mobile app owns a
  database it is a change somebody makes on purpose.
- **THE BUILDER PICKER REACHES THE ROUTING CALL** and sits on the START SCREEN,
  which is where the first build is asked for. `siteRoute` had been posting
  without it, so every routing call ran on the default whatever the customer
  chose. The effort dial is PARKED, with the three lines that restore it.
- **THE CUSTOMER'S SCREEN IS THE BROWSER'S OWN COMPOSER, EXECUTED.** A harness
  that re-composes the reply is a second copy of it. `browserReply` loads
  `public/chat.js` and runs `addonAnswer` — **the SELECTION, not only
  `addonReplyText`**, which is the SUCCESS composer: the browser has four
  answers and running only the composer labelled `"✅ Done."` on a refusal that
  published nothing. **`httpOk` is `Response.ok` and is not derivable from the
  body** — `{ok:false}` reaches the refusal branch at ANY status, so the pair
  that separates them is a body claiming success at a FAILING status.
  **`httpOkOf(status)` has three states and the third REFUSES.** No external
  action can occur, structurally: the two arms that reach outside are INJECTED
  recorders and `siteById` answers `null`, so the local-record mutation block is
  skipped and `sitesSave` is unreachable.

---
