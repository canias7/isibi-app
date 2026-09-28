# The build path: the design call, the published site, the code explorer and the two splits

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). **How a site
> gets built** and a short summary of this file, which CLAUDE.md kept, moved
> here in the second pass (`git show 28bdc97f:CLAUDE.md`) and are the first
> two sections below. Read this before
> changing the design tool, the published site's head or serving, the Code tab,
> or the design and page splits.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## How a site gets built

`POST /api/site/react-build` (also `/api/site/build`, `/api/site/react-revise`) —
auth-gated, idempotent, a slug claimed by whoever builds it first (409).

1. **Route** (`/api/site/route`, **2 credits on run 9, 2026-09-21 — ONE
   MEASUREMENT AND NOT A PRICE.** The long-standing *"Haiku, ~0.3"* is stale:
   every small call follows the picker now and the picker is grok. But routing
   is **metered on real tokens like everything else**, so 2 is what THAT message
   cost, not what the next one will. **The honest statement is that the ladder's
   per-rung prices do NOT include the route at all** — a message costs its rung
   PLUS a routing call of unmeasured size — and anyone quoting a total owes a
   range or a run. ⚠ This entry first read *"the real floor for any message is
   the rung's price PLUS 2"*, which is a price generalised from n=1) — is this a build, a
   question, a clarify round, or one of the cheap edit layers? **Every unclear
   case resolves to work, never to prose**: a wrong "build" is visible and
   undoable, a wrong "ask" is indistinguishable from the builder being broken.
2. **Design** (`design_schema`, one tool call) — the model answers the whole plan.
3. **Provision** — a Neon project + database, but **only if the spec declares
   tables or the site already has one**. A first build is frontend-only by
   default, so most sites never get a database.
4. **Generate** (`write_pages`) — ONE model call, no repair pass.
5. **Compile** — `tsc --noEmit` then `vite build` in the container. **The
   typecheck REPORTS; only `vite build` refuses** (owner, 2026-08-30: *"I want
   it to ship as it is, dont matter if its anything broken, even after is
   reviewed by the compiler"*). `tsc` is a gate we impose — Vite strips types
   with esbuild and never checks them — so a tree tsc refuses still bundles,
   measured on the page that killed runs 84/85: **tsc exit 2, vite exit 0,
   2,186 modules, 6.95s**. The errors ride out as `typeErrors` and reach the
   customer as a `problems` line. A vite failure still refuses: there is
   genuinely nothing to ship.
6. **Render check** — a real Chromium opens every route at two widths.
7. **Salvage** — a page that will not compile is replaced by a stub, never a live
   page (`livePages`), and the build publishes.
8. **Publish** — write-then-sweep into R2, then upload the site's own Worker
   script.

**The model's answer is kept whether or not it builds** — `deps.keep`, called once
straight after generation, storing the raw tool payload at `source/<slug>/answer.json`
(never `pages.json`, which is the revise anchor and success-only). Read back by
`GET /api/site/answer?slug=` for the site's owner; printed into the owner-build
log by step 5b when a build does not publish clean, and by `scripts/answer-read.mjs`
(the `answer read` workflow) at any time, free. Run 90 is why. **PROVEN LIVE on
run 91**: `coalhole-2`'s page read back whole out of R2 after the build.
**Two readers, deliberately.** Step 5b sees only a build the runner watched to
the end — and run 91 is the proof that is not enough: it stopped watching at
10.1 minutes with the generation unfinished, so `haveAnswer` was false and both
step 5 and step 5b were skipped on a build that had already published. A log is
a snapshot; the store is the record.

**The build fires and the Worker walks away.** A queue consumer runs it (15
minutes guaranteed); the generation itself runs in the CONTAINER (no clock) and
**streams**, because an idle wire is hung up at ~270s by the egress. The answer
is POSTed to `/api/site/genresult` and stored in R2, so a recycled container
cannot lose it. A later short invocation collects it. The whole-build budget is
13 minutes with a 4-minute publish reserve; the early placeholder goes up the
moment the design lands, so no failure can leave the customer with nothing.

**Billing**: metered on real token usage, priced per model from ONE table, four
token kinds priced apart (fresh / output / cache read 0.1× / cache write 1.25×),
rounded ONCE across all calls in a build. `ourFault(stage)` exempts our own
failures. A placeholder costs nothing. `buildFloor(model)` gates up front and
refunds if it refuses.

---

## The build path, in brief

The full law is `docs/build-path.md`; read it before changing the design tool,
the published site's head or serving, the Code tab, or the splits.

- **The design call** (`design_schema`, one tool) is **97,142 characters**: 23
  properties in generation order, 15 required. A first build sends 22 of them
  (14 required, **64,076 characters**; `components` alone is 32,603 of it) and
  drops only `backend` (33,045), by `FRONTEND_SCHEMA_TOOL`; the system text is
  1,962. **Re-measure with `readSchemaTool()`** (`test/integration/schema-tool.mjs`)
  rather than trusting a number here; the totals have drifted and been stamped
  wrong before. The order: `brand · slug · description · kind · purpose · pages
  · components · tsx · theme · wordmark · favicon · shape · images · qr · css ·
  backend · action · lang · langs · three · behavior · needsWeb · webQueries`.
- **Plan limits**: `MAX_PAGES` is 1 in the plan (the page generator keeps its
  own 6, so a revise never deletes pages), `MAX_COMPONENTS` 15 with no floor,
  `MAX_QRS` 6, `MAX_BEHAVIOR` 12; a 100-name theme shortlist out of 500. Every
  design decision is anchored on a revise (`EDIT_FIELDS` + `mergeLook`: absent
  means unchanged). A favicon or wordmark stores `{form: text | initials | svg
  | image}`, provenance is derived, and an uploaded SVG is refused. QR codes are
  drawn by us, never stored as pictures. `behavior` decides and records and
  generates nothing yet. `gif` is retired and stays on `EDIT_FIELDS`.
- **The published site**: each site is its own Worker script in a dispatch
  namespace. Every publish is staged whole under `builds/<slug>/<version>/` and
  activated by one conditional write of `current/<slug>.json` (the version is
  minted before the compile and baked as `SITE_VERSION`; one fallback hop to
  `SITE_PARENT`; `MAX_VERSIONS` 10, never pruning the live version or its
  parent). An activation that cannot serve undoes itself, and `restoreVersion`
  is the one restore. The canonical and `og:url` are one normalised expression;
  a route the site does not have is a 404 and a renamed or removed one
  redirects, both read from the sidecar's manifest. A platform-wide republish
  files 8 sites per two-minute tick as ordinary edit jobs.
- **The finished answer wakes its own collector**: `/api/site/genresult`
  enqueues the collector as soon as it stores a build's answer;
  `RESUME_FIRST_SECONDS` (240) is only the belt for a container that dies
  before posting.
- **The code explorer** is one tree from the project root: a folder's key is
  its path, ownership is drawn in ink (`own` fails closed), the root's twelve
  files are always drawn, `null` is a third fold state, the shared set is
  `builder/foundation-files.mjs` (25 files, 489,115 bytes, generated, compared
  and asked of git), and a downloaded project carries the kit files its pages
  import (9 to 53 files over 100 real sites, none unresolved).
- **The two splits**: the design step runs as one call, 4 waves or a 16-agent
  graph (`DESIGN_SPLIT_CANARY` is the building account, `DESIGN_GRAPH_CANARY`
  nobody, both `*_EVERYONE` off); the page step as bands plus parts
  (`BAND_SPLIT_CANARY` the building account). `MAX_MODEL_FANOUT` 8 in the air,
  `MAX_FANOUT_REQS` 16 per job. Measured: the waves save `min(plan, look)` and
  cannot go below ~183,852 ms; the graph's wall is `components → shape →
  behavior`; a band split cut a page call to 93,375 ms against 180–407 s in one
  call; a fan-out cannot beat its slowest piece.

---

## What the design call decides

`design_schema` is one tool, **97,142 characters**, in the cached block.
Property order IS generation order. **23 properties, 15 required**; a first
build sends 22 of them (14 required, **64,076 characters**), and the system
text is 1,962. **`components` alone is 32,603 of a first build's 64,076 — half
of it** — because it carries the kit's component menu. `backend` is **33,045 of
the 97,142 — 34.0%** and is the ONLY property dropped from a first build:
`FRONTEND_SCHEMA_TOOL` derives itself by destructuring it out and filtering it
from `required`, so the two can never disagree.

**⚠ RE-MEASURE THESE, DO NOT TRUST THEM.** The total has drifted three times
and been stamped wrong in sixteen files at once; the way to ask is
`readSchemaTool()` from `test/integration/schema-tool.mjs`, which answers
`{tool, frontendTool, system}`, and `JSON.stringify(...).length` on the first
two. **Every figure above was re-derived that way on 2026-09-20 and all eight
matched, the order and the optional list included** — so this paragraph is an
instruction and not a hedge. **Take `.length` on `system` directly**: stringify
it and you count its quotes and read 1,968.
**THE TWO NUMBERS ARE TWO NUMBERS AND ONLY ONE MOVES**: everything the api tier
has added lives under `backend`, so **the first build's 64,076 has never moved
at all** — measured byte-identical across three shas rather than reasoned
about. *A number nobody re-measured is a claim ahead of its evidence, and a
stamp taken mid-branch goes stale before the branch ends.*

**The order, measured by evaluating the tool rather than reading it** — this
list has gone stale twice, so re-derive it:

> `brand` · `slug` · `description` · `kind` · `purpose` · `pages` ·
> `components` · `tsx` · `theme` · `wordmark` · `favicon` · `shape` · `images` ·
> `qr` · `css` · `backend` · `action` · `lang` · `langs` · `three` ·
> `behavior` · `needsWeb` · `webQueries`

Only `tsx`, `qr`, `css`, `lang`, `langs`, `three`, `needsWeb` and `webQueries`
are optional. **`seeds` and `share` are NOT fields** — `seeds` came off
2026-08-23 and `share` never existed (the share image is chosen at publish
time, not designed).

- **`brand`, `slug`, `description`** — answered FIRST, before anything about the
  look. **The name stays inside the brief**: the brief's own name verbatim when
  it gives one, otherwise a name for the type of business asked for. Four
  consecutive nameless-CRM runs invented names for the wrong business.
- **`kind`** — `shopfront | tool`, decided before the plan, because every
  planning answer is an answer about the kind. **A tool's front page IS the
  tool**: no hero, no marketing bands, no team section, and `planBudget` answers
  **0 photographs** — arithmetic, not prose, because the model ignored "no
  photographs anywhere" on four consecutive builds.
- **`purpose`, `pages`, `components`, `shape`, `images`** — the plan.
  `MAX_PAGES` in the PLAN is **1** (the front page is the site) and
  `MAX_COMPONENTS` **15**, a ceiling with **no floor** — a floor is a quota and
  a model fills a quota. **`page-gen.mjs` keeps its own `MAX_PAGES = 6`
  deliberately**: a full revise hands every stored page back through validation,
  so capping there would delete pages off a live multi-page site on an unrelated
  edit. **One page is one job**: a band that is really a second screen is left
  out, not stacked below. `shape` carries the 13 universal site shapes as
  reference — named geometry, no trade and no kit component.
- **`theme`** — one of a 100-name shortlist out of a 500-theme registry
  (`builder/site-theme-registry.mjs`). `FIELD_KEEPS.theme` judges against all
  500, so a stored off-shortlist theme survives every merge.
- **`favicon` / `wordmark` — ONE FIELD EACH, CARRYING A FORM.** The tool asks
  for a DRAWING (or, for the wordmark, the literal `text`), because that is a
  good thing to ask a model for; the merge normalises the answer on the way out.
  Each STORES `{form:"text"|"initials"} | {form:"svg", svg} | {form:"image",
  url}` — the third being the picture the `logo` rung uploads — so a mark has
  one home, one door and no precedence ladder. `builder/site-mark.mjs` owns the
  shape, the fold for every site still on the old `config.logo`/`config.icon`
  pair, the ONE wire projection, and `markUrlOk`, the single copy of what may
  reach a generated `src`. **A model must not outrank a person** is `mergeLook`'s
  `asked` flag: an edit the customer named replaces, a design step's volunteered
  answer leaves an uploaded mark alone. **PROVENANCE IS DERIVED, NEVER
  STORED** — only a person can produce `image` (the model cannot mint an upload
  URL) and only the model produces `svg`; **an uploaded SVG is refused**, since
  `/u/` serves inline from the site's own origin and one would be stored XSS.
  `cleanFavicon` is the drawing's validator — an allow-list that **refuses
  whole**: 18 elements, ~50 attributes, no `script`, no `href` of any kind,
  entities decoded before the danger checks. We own the document element, the
  model owns the shapes. The two readers stay two: a favicon is forced square,
  a wordmark sized from its own viewBox, because the header constrains by height.
- **`css`** — the model's own stylesheet, appended LAST so it wins on source
  order. The 500 themes are the base; this is the layer a customer asks for.
- **`lang` / `langs`** — the language the pages are written in, and every other
  language the site is offered in. **`needsWeb` / `webQueries`** — whether the
  copy needs facts the model may not have, and the 1–3 searches to run if so.
- **`tsx`** — **the escape hatch for the 2,112-component kit**, answered
  IMMEDIATELY after `components` by a model that has just searched it and come
  up short. Optional; absent is the ordinary answer. Each entry is `name` ·
  `does` · `props`. **It DECLARES; the page step writes the source.** The files
  land in `src/routes/-parts/<name>.tsx` and **both halves of that are
  load-bearing**: under `src/routes` because `resetRoutes` wipes that directory
  and *nothing else* between builds on a long-lived shared container, and
  prefixed `-` because that is what keeps a component from being published as a
  route — **pinned as `routeFileIgnorePrefix` in our own vite config** rather
  than inherited. `write_pages` returns them in **`parts`, never in `pages`** —
  a component in the page list would be counted against the page cap, put in the
  nav manifest, published in `sitemap.xml`, and stubbed by salvage. **The spine
  re-sends them on every publish** (`source/<slug>/parts.json`), which is not an
  optimisation: a page importing a component that is not sent does not compile,
  so without it the first typo fix after a build takes the site down.
- **`qr`** — up to `MAX_QRS` (**6**) named codes, each `{name, points, label}`,
  all three required. **We draw them, the model never does**: a QR is
  Reed-Solomon over a spec with 40 sizes and 8 masks, and its failure mode is a
  code that looks perfect and does not scan — unfalsifiable by every instrument
  here except a phone. `qrcode-generator` (one file, no deps) is bundled;
  `qrSvg` emits ONE `<path>` merging horizontal runs (**4,206 chars vs the
  library's 8,464** for a real URL). Generated at build time from the stored
  strings, **never stored as a picture** — a stored SVG would be a second copy
  of `points` that can disagree with it. `test/site-marks.test.mjs` re-derives
  the module set from the emitted path and compares it against the library's own
  `isDark`, the only ground truth available without a camera. `javascript:` and
  `data:` are refused. **The name is the file and the binding**: `qr-wifi.svg`
  and `SITE_QRS.wifi`, an identifier (`QR_NAME`), because `SITE_QRS.join-our-wifi`
  is a subtraction to JavaScript. **The old single code reads as one entry named
  `qr`** through `qrList`, keeping `qr.svg` and `SITE_QR`/`SITE_QR_LABEL`, so
  every site published before the list serves the bytes it served.
  `builder/site-qr-list.mjs` is DEPENDENCY-FREE because the container imports it
  to name the files — **and the image must COPY it**.
- **`three`** — a 3D/WebGL element, optional the way `css` is, absent on nearly
  every site. It took TWO hops to ship because it needed both: onto
  `EDIT_FIELDS` so `mergeLook` stops discarding it, and into the page directive
  (`sceneDirective`). **The second is the instructive one** — after the storage
  fix it stored, survived revises and showed in the current-state note, so it
  read as working from every angle except the only one that mattered. The prompt
  needed no change: the page rules already said a canvas is written "ONLY where
  the design step asked for it in as many words", which was a gate on a signal
  that had no way of reaching the gate.
- **`behavior`** — **what every interactive thing on the page DOES.** One entry
  per control, six required properties: `control` · `on` · `does` · `affects` ·
  `result` · `source` (`component | custom`). **Answered LAST of the design
  fields**, because a control cannot be described before the page that holds it
  exists. **Compelled**, with `[]` a real answer and `MAX_BEHAVIOR` (**12**) a
  ceiling with no floor. The item shape lives in `site-plan.mjs` as
  `BEHAVIOR_ITEM` because the edit lane answers the SAME items and may not
  import from `worker.js`. **It decides and RECORDS; nothing generates from it
  yet** (owner: *"do not implement the behavior yet"*).
- **`gif` — RETIRED 2026-08-31.** It worked and is still live: `washhouse-1`
  and `washhouse-3` serve one today, the laundrette's a drum in **534 bytes**.
  **What ended it was the NAME**: the owner asked for a "gif" and this draws an
  animated SVG — smaller, sharper, themes with the page, and does NOT play where
  a GIF plays. What went: the field, and the `gif` edit lane with it. **What
  stayed, deliberately**: `gif` on `EDIT_FIELDS` (exactly as `seeds` and
  `family` are kept), because `mergeLook` rebuilds from that array ALONE and
  dropping the name strips the two live sites on their next unrelated edit; and
  the whole render path (`GIF_FIELD`, `cleanGif`, both container payloads,
  `marksDirective`'s gif half). To put it back: restore the one property and the
  lane. **`cleanMark` takes its tag/attr sets as PARAMETERS** and has three
  callers; `GIF_ATTRS` is DERIVED from `FAVICON_ATTRS` so the two cannot
  diverge; and the indirection risk is real — `<animate attributeName="href">`
  names its target in a VALUE, so `attributeName` is checked against the same
  set the scanner admits and `animateMotion` is refused outright (its child is
  `<mpath href>`).

**Every design decision is anchored on a revise.** `EDIT_FIELDS` + `mergeLook`:
absent means unchanged, so a colour change cannot re-roll the theme.
`currentStateNote` shows the model what is stored, derived from `EDIT_FIELDS` so
a new field cannot be changeable-but-invisible.

---

## The published site

**Each site is its own Worker script** in a dispatch namespace. A Worker cannot
load code at runtime, so "one Worker serving whichever site was asked for" is
impossible — which is why a framework upgrade means republishing every site
(`site_rebuild`, no credits). **`site-rebuild.mjs` `BATCH` is 8 per two-minute
tick and `drainRebuild` runs the rows CONCURRENTLY**, each chain its own promise
settling into one summary — concurrent because eight in series is sixteen
minutes and a cron invocation is dead at fifteen. 240 an hour, 5,760 a day.
`BATCH` was 1 because "the build service is `oneAtATime` for the whole
platform", a reason that expired on 2026-08-25 when every site got its own
container lane, and nothing announced it. **SINCE 2026-09-06 THE TICK ONLY
FILES**: each due row becomes an edit job run by the ordinary consumer in the
site's own container, so the batch is no longer bounded by the cron invocation
and a rebuild gets the lease, the deploy gate and the sweeps every job has.
Not proven live: the next platform-wide republish is the measurement.

**EVERY PUBLISH IS IMMUTABLE AND THE SCRIPT READS ITS OWN PREFIX (stage 7,
2026-09-05).** A publish used to write its dist over the ONE served prefix,
sweep what it did not write, and roll back by copying an old dist over the same
keys — two writers to one address, and every failure under it was a window.
Now `site-builds.mjs` (root, dependency-free): every publish is STAGED under
`builds/<slug>/<version>/` — `client/…`, `server.js`, `state/{pages,parts,config,sidecar}.json`,
and `manifest.json` LAST so a prefix with one is whole — and ACTIVATED by one
write of `current/<slug>.json`: `{version, build, parent, job, activatedAt}`.
The version is minted by the Worker BEFORE the compile (`mintVersion`), sent in
the container payload and baked as `SITE_VERSION`; the script's asset branch
reads `builds/<slug>/<SITE_VERSION>/client` and answers `x-site-version`.

- **THE ORDER IS THE SAFETY ARGUMENT**: compose → stage (additive; a refusal or
  a dead job leaves the live site as it was) → the gate (`edit_may_publish`) →
  activate: the pointer CONDITIONAL on the etag read after the gate (a stale
  holder answers `superseded`), then the sidecar (before the script, so a new
  isolate reads the new head), the live marker at `sites/<slug>/site.live`, the
  script, the commit (`edit_committed`, only once the script is up), and the
  state copy into the editable locations.
- **WHICH VERSION IS AUTHORITATIVE**: `current/<slug>.json`, and everything else
  is derived — visitors are served the prefix the LIVE SCRIPT bakes, so the
  pointer is authoritative only while the script naming it is up.
- **THE POINTER IS `current/<slug>.json`, NOT `sites/<slug>/current.json`**:
  that prefix is served verbatim by every older script and is what the legacy
  sweep wipes. **The legacy prefix is FROZEN** — a script with no
  `SITE_VERSION` reads `sites/<slug>/` for ever, so a version-aware publish
  never writes or sweeps it.
- **ONE FALLBACK HOP, BAKED**: `SITE_PARENT` is the pointer's version when the
  build started; an asset the own prefix lacks is tried once against the
  parent's prefix. Pruning (`MAX_VERSIONS`) never takes the pointer's version or
  its parent.
- **`restoreVersion` IS THE ONE RESTORE FOR BOTH LAYOUTS**: a build-layout
  version is an activation (its own `server.js`, its sidecar, its state copied
  back, the config's baked fields merged through `withConfig` so `verify` and
  `share` survive); a legacy one is the copy path with the POINTER DROPPED.

**AN ACTIVATION THAT CANNOT SERVE UNDOES ITSELF (2026-09-06).** Stage 7
answered a failed script upload with `ok: true` — the pointer had moved, the
commit was skipped and `afterActivate` ran anyway, so the editable source
advanced to a version no visitor had been served. Four corrections:

1. **SERVED, NOT MERELY NOT-REFUSED.** `putSiteWorker` answers `null` when
   there is no script to send OR no credentials to send it with, so a Worker
   with no dispatch credentials moved every pointer it touched. Only
   `ok === true` counts.
2. **THE UNDO.** The pointer goes back to `previous`, CONDITIONAL on our own
   etag, so a newer publish that landed meanwhile is never clobbered; with no
   previous it is a read-then-delete, named rather than papered over (R2 has no
   conditional delete). The sidecar and the live marker are reversible too —
   both are written BEFORE the script, so without the undo a failed publish
   leaves the OLD page wearing the NEW head. **A previous value we could not
   READ records nothing and its key is left alone**: cannot-tell must never read
   as there-was-nothing, which would turn an undo into a delete of a live
   sidecar.
3. **THE COLLECTOR'S LEASE.** `activateBuild` takes `assertLease`, re-asked with
   no await between it and the pointer write. The etag stops a holder whose
   pointer moved; it cannot stop one that lost its LEASE while nobody published.
   Only an explicit `false` vetoes; a hook that throws proceeds and says so.
4. **FIRST ACTIVATION IS CREATE-IF-ABSENT** (`etagDoesNotMatch: "*"`), putting
   the race in the store rather than borrowing safety from another layer's lock.

**AN AUTHENTICATED READ-ONLY RUNTIME DIAGNOSTIC.** `GET /api/site/runtime?slug=`
answers, for the caller's OWN site: `async` and `runner` (the effective
eligibilities), the switches behind them, `runnerBindings`/`runnerKeyed` so a
`runner: false` names which link is missing, and `deploy` (the sha, through
`deployIdOf`). **Booleans and the sha only** — never a value, never a canary
LIST, and `readCanaryList` is not imported into `worker.js` at all, so no later
edit is one line from handing back other customers' slugs. Owner-gated: a
signed-in stranger gets the 404 a missing site gets.

- **One public address**: `<slug>.gofarther.app`. `/s/<slug>/` 301s to it and is
  the internal addressing scheme. A custom domain returns to ITSELF.
- **The document is rendered per request** from `__root.tsx` — no prerender
  step and no HTML in the dist. **A page can therefore embed `Date.now()` and be
  date-derived**, which is why a byte count is only comparable within one
  rendered UTC date and a content hash would differ on every request. See the
  trap.
- **The head** is the baked half (`site-brand.ts`, per build) plus the
  publish-time half (the R2 sidecar): title, description, canonical, og:* (url,
  site_name, type, locale + alternates, image + dimensions for the composed card
  only, alt), twitter:card, theme-color, verification tags, icon,
  apple-touch-icon. **`og:url` and the canonical are ONE expression** so they
  cannot disagree, and that expression NORMALISES the join: `siteUrlFor` ends
  its answer with a slash and the router's pathname starts with one, so
  concatenating them shipped `//menu` on every route but the home page.
- **The share card** is composed free at build time — the name (or the drawn
  wordmark) and the description on the theme's paper, screenshotted at 1200×630
  into `dist/client/card.png`. Precedence for `og:image`: **the owner's chosen
  upload → any owner upload → the card. Never a visitor's file.**
- **Assets are relative** (`base: "./"`), so the platform rewrites them
  absolute; `robots.txt` and `sitemap.xml` carry a placeholder origin
  substituted at serve time, because the same bytes serve at three addresses.
- **A route the site does not have is a 404**, and a renamed page redirects —
  both read out of a manifest in the head.
- **`dir` follows the language**, derived from the script, and the kit is on
  logical utilities so it really mirrors.

## The code explorer

The Code tab shows the customer's whole project **as ONE tree from its root**.
Five category headings were deleted 2026-09-12 (owner, holding Lovable's
explorer beside ours: *"ITS BY FOLDERS"*): they drew `src/routes` twice and put
no row where the file really lives.

- **A FOLDER'S KEY IS ITS PATH**, and it carries a COUNT of everything beneath
  it — the count is what makes a folded folder honest rather than hidden.
- **WHOSE FILE IT IS, IN INK** — the one thing a directory tree cannot say.
  `ST_FILE_KINDS`: the customer's own (`page`, `part`, `asset`) in full ink, the
  platform's (`kit`, `shared`) muted. The words ride in `title`, because ink is
  a hierarchy and never a label. **`own` FAILS CLOSED.**
- **THE PROJECT ROOT'S OWN FILES ARE ALWAYS DRAWN** — all twelve. The lock file
  is what makes the download a PROJECT. Measured: 310,981 bytes raw, but gzipped
  the payload went 60,781 → 126,616 — **~66 KB more per open**, and that is what
  travels. The raw bound is 600,000 with ~110,000 left, so the next file added
  here is a decision. **A CENSUS DERIVED FROM GIT** requires every tracked file
  at the template root to be in `FOUNDATION_PATHS`.
- **`null` IS A THIRD STATE.** The stored fold preference is `null` until the
  customer touches something, which is NOT an empty Set: uninitialised opens the
  CHAIN holding the file on screen; an empty Set is somebody who closed
  everything. **It resets on a project switch — to `null`, not to empty.**
- **A CHAIN OF ONE-CHILD DIRECTORIES IS ONE ROW** (VS Code's compact folders),
  and the collapse rule is asked in BOTH places from one definition.
- **THE DRAW IS NOT THE FETCH.** A fold is a preference, not a question for the
  server.
- **DEPTH IS ONE NUMBER THE ROW CARRIES (`--d`)**, and its rule must sit BELOW
  `.st-file`'s `padding` shorthand or the tree draws flat.
- **A FILE'S ICON COMES FROM ITS OWN NAME** and the tree is A–Z. `stFileIcon`'s
  RULE ORDER is the whole of it: lock file by NAME first, then extension, then a
  dotfile with no extension is configuration, then `code` as a reached fallback.
  `stSortTree` sorts on LOWERCASE CODE POINTS, never `localeCompare`, which
  scatters dotfiles.
- **A SEARCH BOX THAT SEARCHES THE CODE**, path or contents — the whole project
  is already in the browser, so it costs no request. **Measured ~1.15 ms per
  keystroke** over the 25 shared files (489,130 bytes). A contents match carries
  a hit count; a name-only match carries nothing.
- **A MENU ON EVERY FILE ROW** — `Copy path`, `Copy contents`, `Download`
  (`ST_ROW_ACTS`, and the menu is DERIVED from it). No rename/delete/new: each
  would promise what the Code tab cannot do. **The handle is on files and on no
  folder.** The row is a wrapper around TWO buttons because a `<button>` inside
  a `<button>` is invalid and browsers HOIST the inner one out.
- **WHAT IS OUT**: `src/components/**` (3,394 kit files, 9.5 MB), the template's
  DEMO routes (derived from the Dockerfile's own `find … -delete`), and
  `src/site-brand.ts`, whose template copy is a stub. **The site's own file wins
  a path the shared set also claims.** An unnameable file shows as
  `unplaced/<n>.txt` with a note, never dropped.
- **`builder/foundation-files.mjs` IS THE SHARED SET — 25 files, 489,115 bytes,
  GENERATED**, because the Worker has no filesystem. It is a COPY and a copy
  drifts, so the guard re-runs the generator and compares. **A shared file must
  be one the REPOSITORY has, and the guard asks GIT** — `fs.existsSync` once
  baked one machine's generated `routeTree.gen.ts` into the committed module.
- **THE DOWNLOADED PROJECT CAN BUILD — the kit files its pages import.** Over
  100 real sites that is **9 to 53 files, 26,092–126,082 bytes, ZERO unresolved
  specifiers**, so there is nothing to lazy-load. `builder/kit-closure.mjs`
  resolves it with the reader INJECTED; **the extension order IS the resolver**;
  cycles terminate on the RESOLVED path; an unresolved specifier is NAMED.
  `MAX_KIT_FILES` 400 REPORTS rather than truncating. **THE CONTAINER RESOLVES
  IT**, being the only place both halves exist at once, seeded from the routes
  DIRECTORY so a salvage stub's imports count, fenced with `path.resolve`.
  Stored at `source/<slug>/kit.json` on BOTH publish paths.
- **A site that has not published since this shipped gets `[]`**, and **THE
  WORKER CANNOT BACKFILL IT** (the walk needs each kit file's CONTENTS, which
  live only in the image). `site_rebuild` is the free backfill and has not been
  run — **open**, and such a site draws no `Design system` folder and no
  sentence, so the silence explains nothing.
- **WHAT A SITE REALLY USES, with no auth and no publish**: every kit component
  stamps `data-slot`, so `curl --compressed <slug>.gofarther.app | grep -o
  'data-slot="[^"]*"'` answers it.

**THREE SEPARATE CAUSES OF ONE SYMPTOM — the owner reported "the screen
vibrates" THREE times, and each fix was real and left the panel moving.** The
lesson is the shape: *a fix for the right symptom is not a fix for the right
cause*, and the honest tell was having to be told again.

1. **The column grew to its widest row.** Splitting the column moved
   `overflow-y: auto` off `.st-code-tree` — and **any overflow but `visible`
   makes a flex item's automatic minimum size ZERO**, which is what had been
   pinning it. `min-width: 0` says out loud what the overflow said by accident.
   **MEASURED over seven fold states: 193px throughout before, 209 or 224
   after, constant again with the line.**
2. **The panel replayed its entrance animation.** **MEASURED frame by frame: the
   whole panel drops 8.00px, fades to opacity 0 and slides back over 220 ms, on
   every press**; rewriting only the rows moves it **0.00px**. **A STILL
   SCREENSHOT CANNOT SEE THIS CLASS AT ALL** — what sees it is sampling one
   element's rect across `requestAnimationFrame`.
3. **The scrollbar's lane.** On Windows and Linux a CLASSIC bar takes ~17px out
   of the CONTENT box — 8% of a 210px column. `scrollbar-gutter: stable`,
   **never `stable both-edges`**, pinned by VALUE. **THE RENDER COULD NOT PROVE
   THIS ONE**: headless Chromium uses OVERLAY scrollbars, which take NO width.
   The SHEET is the assertion and it is DERIVED. **What cracked it was one fact
   from the owner's side of the screen: which OS.**

## The two splits

Both are live. The DESIGN call and the PAGE call each used to be one long model
call; each can now be several agents at once, behind per-account flags.

### The design step

| shape | agents | how |
|---|---|---|
| one call | 1 | 22 properties in property order — the default for everyone |
| waves | 4 | `identity` · then `plan` ∥ `look` · then `detail` |
| graph | 16 | `builder/design-graph.mjs` — twelve start at once, longest chain three |

- **`DESIGN_SPLIT_CANARY` defaults to the building account**;
  **`DESIGN_GRAPH_CANARY` defaults to `-`, which `readCanaryList` drops** —
  nobody, until the owner names a uid. Both `*_EVERYONE` flags are `off`.
  **Both doors are asked and the GRAPH wins by a stated line**, because
  computing the waves only when the graph declined would leave the waves door
  unasked on a graph build, which from a stored row is indistinguishable from a
  waves door that is shut.
- **THE EDGES ARE THE TOOL'S STATED DEPENDENCIES, and most of what sounds like
  one is not.** Only seven of 22 fields carry a sequencing phrase in their own
  prose; four earn an edge (`css`←theme, `shape`←components, `wordmark`←identity,
  `behavior`←shape) and three were read again and dropped. `behavior`←`shape` is
  the one edge that is JUDGEMENT rather than the tool's.
- **A CYCLE HANGS, IT DOES NOT THROW**, which is why `graphOrder` exists: two
  promises awaiting each other sit there until the job's clock kills the build
  with everything charged and nothing to show. Kahn's algorithm answers `[]` for
  a cycle, a self-need, a dangling need, a duplicate or a nameless agent, and
  `[]` means "use the waves, or the one call".
- **A NEED IS SATISFIED WHEN ITS AGENT DID NOT FAIL, never when it ANSWERED.** A
  model that declines the tool and replies in prose is a FAILED call; one that
  calls the tool and declares no field has ANSWERED, and that is correct for
  four of the eight optional fields.
- **`MAX_GRAPH_INFLIGHT` IS 8 AND IS NOT THE GRAPH'S WIDTH.**

### The page step

`builder/page-bands.mjs` cuts a page into its planned bands and
`builder/page-parts.mjs` turns each declared component into its own agent; the
container runs them as ONE job holding N calls. **`BAND_SPLIT_CANARY` defaults
to the building account**, `BAND_SPLIT_EVERYONE` is `off`.

- **A BAND IS A COMPONENT, NEVER A JSX FRAGMENT** — state sits at page scope in
  real generated pages and which band wants `useState` cannot be known before it
  is written, so fragments would force every band to agree in advance about a
  hook above all of them.
- **A PART IS THE SAME KIND OF THING A BAND IS**, so bands and parts ride ONE
  list. **BANDS FIRST, PARTS AFTER**, because `bandsFromAnswers` pairs an answer
  to a band by its raw index.
- **A FAILED BAND OR PART IS STUBBED, NEVER DROPPED.** A missing band is a page
  short a section; a missing PART is `vite` refusing the build, because the page
  already imports it.
- **THE CACHED SYSTEM BLOCK IS `pageRulesFor`'s, BY IDENTITY** for bands and
  parts alike — a separate block would be a second copy of every rule and a cold
  prefix per build.
- **A BAND IS TOLD ABOUT ITS NEIGHBOURS AND NEVER SHOWN THEM.** It has to know
  they exist or band 3 writes its own hero; it cannot be shown their source,
  because they are being written at the same moment.
- **TWO BOUNDS, NOT ONE.** `MAX_MODEL_FANOUT` (8) is how many calls may be in
  the air; `MAX_FANOUT_REQS` (16) is how long a list one job may carry. Tied
  together, a plan of nine pieces could not be SENT and the whole page went out
  in ONE call. A long list QUEUES now, and **a list that fits takes no permit at
  all**, so every fan-out that shipped before behaves byte for byte as it did.
- **THE CALL'S CLOCK STARTS AFTER ITS PERMIT**, or `agentMs` grows with the
  QUEUE rather than the work and the overlap flatters itself.
- **`runFanout` IS SHARED**, because `Promise.all` rejects on the first failure —
  which here would throw away every agent that answered because one did not —
  and every entry carries its INDEX, the only thing tying an answer back to what
  it was asked of once they finish out of order.

### What the splits are worth, measured

**The design split's arithmetic is `min(plan, look)`, and that is algebra off
the wave shape rather than a measurement needing more runs.** Waves are 1-2-1,
so `agentMs` is `i + p + l + d` and `waveMs` is `i + max(p, l) + d`. Confirmed
to the millisecond on `ravenscroft-and-fyne` (overlap 78,560 = `planMs`
exactly); the four earlier overlaps (51,865 · 65,191 · 66,008 · 66,181) were
each that build's own `min(plan, look)`, so the spread was never noise.
**A floor follows**: three of the four agents run ALONE, so the waves cannot go
below `identity + plan + detail` = **183,852 ms** however fast `look` becomes.

**The graph does widen them.** `sowerby-forge` read `graph: 16, waveMs 159,599,
agentMs 527,944` — below the whole prior range (single call 175,259 / 197,248;
waves 185,607 / 190,859 / 237,686 / 237,763). **The arithmetic closes twice**:
the sixteen parts sum to `agentMs` exactly, and `components 29,354 → shape
65,452 → behavior 64,793` = **159,599 = `waveMs` exactly**.

- **THE WALL IS `components → shape → behavior`**, with `theme → css` second at
  113,397 — 46,202 ms of slack behind it. So breaking the last link is worth
  about 46 s and no more.
- **AND THE RECORD WAS WRONG ABOUT WHY `look` WAS SLOW.** It blamed the two
  drawings; split apart, `wordmark` + `favicon` are 83,426 together and `css`
  ALONE is 93,013 — on a brief that asks for one (`css` omits itself otherwise:
  29,763 on `ben-crowe-guitar`).
- **THE FIELD COUNT DOES NOT PREDICT THE TIME**: `identity` answers 11 fields in
  21,906 ms, `look` 4 in 132,394. What costs time is the KIND of answer.

**The page split wins where the design split does not** — one wave, N wide, on a
call several times longer, so the fixed per-call cost is a much smaller slice.

| build | page call | how |
|---|---|---|
| `kestrel-bindery` | **93,375** | 7 bands, one wave (`agentMs` 424,444) |
| `marlow-and-tide` | **180,456** | one call |
| `ben-crowe-guitar` | **407,694** | one call — nine pieces, refused the split |
| `saltmarsh-kayak-co-2` | **390,123** | 8 bands + 1 part, the queue |

- **THE QUEUE IS PROVEN AND THE ARITHMETIC NAMES THE WAITER.**
  `saltmarsh-kayak-co-2` planned nine pieces against eight sockets: `waveMs`
  381,833 against a slowest piece of 347,868 — **the step took longer than
  anything in it**, impossible under eight-or-fewer where the two are equal by
  construction. The part is sent last, so it started at 381,833 − 347,868 =
  33,965, and the band that freed the first permit was b7 at **33,860**. 105 ms
  apart. The nine sum to `agentMs` exactly.
- **AND THE REFUSAL IT REPLACED WOULD HAVE COST 3%.** `ben-crowe-guitar` was the
  same nine-piece shape in one call; the split saved 17,571 ms, because **the
  part is the wall**: all eight bands finished inside 147 s and the tide chart
  alone took 348 s. **A fan-out cannot beat its slowest piece**, so more sockets
  buy nothing on that shape — worth knowing before anybody reads
  `MAX_MODEL_FANOUT` as the lever.

**OPEN: Stage C, regrouping the graph from these times.** The lever is the
three-link chain; `behavior ← shape` is both the most valuable edge to question
and the least evidenced, being the one edge that is judgement rather than the
tool's own words.
