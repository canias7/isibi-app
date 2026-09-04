# Go Farther

> **Read `docs/owner-notes.md` at the start of every session** — the owner's
> running log and how they like things done. Keep it updated.
>
> **PRUNED 2026-08-28 (owner's call: "delete whats old and we dont need
> anymore").** This file was 3,786 lines of change-by-change history and loaded
> into every session's context. What it says now is what is TRUE TODAY, plus the
> standing decisions and the traps that keep costing sessions. **The full record
> — every entry, every measurement, every reversal, from 2026-07-20 to
> 2026-08-28 — is in git: `git show 6393b134:CLAUDE.md`.** Nothing was lost; it
> stopped being loaded. When you need to know *why* something is the way it is
> and this file does not say, that command is the answer.
>
> **Keep it this way.** Add an entry when a decision is made or a trap is found;
> when an entry becomes history rather than law, cut it. A fact that is true
> today belongs here. A story about how it got true belongs in git.

---

## Two halves, one Worker

Both are **Go Farther** now — one brand, renamed 2026-08-30. They were "Zephyr"
and "the builder"; the names below say what each half DOES, because that is the
distinction that still exists once the branding does not.

- **The media side** — an AI image/video/voice generator at **gofarther.dev**.
  Live, has paying customers, unrelated to the builder except that both run out
  of `worker.js`.
- **The site builder** — a customer describes a business in chat and gets a
  published website at **`<slug>.gofarther.app`**. `gofarther.dev` is the tool
  they use; `.app` is theirs. The builder is the active work.

---

## Working rules

- **Always show UI changes as screenshots in the chat** — render it headless and
  send the image. The owner reviews everything visually.
- **The owner directs design; don't restyle beyond what's asked.**
- **Don't spend fal credits or model calls on tests without asking first.**
- **Work on the designated branch**, not on main directly.
- **Never write GitHub's own skip-CI marker anywhere** — not in a commit message,
  not in a PR body, not while explaining it. GitHub scans the whole message and
  suppresses every workflow for that push: main moves, nothing deploys, nothing
  tests, and there is no red run to notice. **Done twice, both times inside prose
  about the rule itself.** In prose call it "the skip-CI marker" and never spell
  it. `test/deploy-secrets.test.mjs` holds the half that lives in the tree.
- **The paid workflows are OPT-IN as of 2026-08-30** (owner: *"flip them, don't
  spend any"*). `build smoke`, `edit smoke`, `page gen eval` and `schema gen
  eval` run only when the commit message contains **`[smoke]`**, or when somebody
  starts them by hand with `workflow_dispatch`. A push with no marker costs
  nothing, which is the whole point: the old gate ran them unless you opted OUT,
  and in one session seven pushes went out without the marker and six bought a
  run — **five of those were merge commits**, whose message git writes itself and
  which can therefore never carry any marker at all.
  `[skip smoke]` still appears all over the history and is harmless: it does not
  contain the opt-in marker, which `test/deploy-secrets.test.mjs` asserts against
  the real string so a future rename cannot silently re-arm every old commit.
  **AND THE OPT-IN MARKER IS NEVER SPELLED IN PROSE EITHER — 2026-09-01, and it
  cost a run.** The rule two bullets up says exactly this about the skip-CI
  marker and stops one line short of saying it about this one. A commit
  explaining that *the previous* commit had bought a build spelled the marker
  while doing so, and armed itself: `build smoke` fired a second time, on a
  commit whose whole purpose was to describe the first. Same trap, different
  marker, and the gate reads the message with no idea it is being quoted. In
  prose call it **the smoke opt-in marker** and never write it — the only place
  it belongs is a commit that is deliberately buying the run.
  **The cost of this is that nothing catches a regression by accident any more.**
  Run the smokes by hand before anything that matters.
- **Never commit while a mutation sweep is running.** A killed sweep skips its
  `finally` and leaves a live mutant in the tree.
- **Every change ships with**: guard tests, a mutation sweep from a verified-green
  baseline with a comment-only control that must survive, the full unit suite,
  entries here and in owner-notes, and a push.
- **Stamp measured numbers only AFTER the run.** A result written before the run
  ends is a claim ahead of its evidence.

---

## Structure

- **`public/`** — the media frontend, plain HTML/CSS/JS: `index.html` (the
  chatbox, the only page), `styles.css`, `chat.js` (which is also the builder's
  client), `auth.js` (Supabase email/password + email-code via GoTrue fetch).
- **`worker.js`** — the Cloudflare Worker. Serves assets; the media side's
  `/api/video|image|audio` (fal.ai queue, per-kind model allowlists),
  `/api/direct` (the director — effort-routed Haiku/Sonnet, tool-use for
  structured output, a `research` step on Sonnet + `web_search_20250305`),
  `/api/import/fetch`, `/api/save`; and the builder's whole `/api/site/*` and
  `/api/db/*` surface. **It CAN be imported by tests** — the belief that it could
  not is why twelve features shipped dead; see the traps below.
- **`builder/`** — the site builder. `lovable/template/` is the kit and the app
  scaffold (React 19 + Tailwind v4 + TanStack Start; 2,112 components in
  `src/components/ui/`, plus ~880 chart primitives under `charts/lib/`);
  `build-server.mjs` is the container's HTTP service;
  `page-gen.mjs`, `publish-pages.mjs`, `site-*.mjs` are plain modules, importable
  and tested outside the Worker.
- **Supabase** (`ujrqdmmtcptvimazlhom`) — platform auth, the credit ledger, the
  `media` bucket, `site_backends` / `site_project` / `site_builds`.
- **Neon** — one project per SITE, holding that site's own database.
- **R2** — everything that is not rows: `sites/` (published), `source/` (page
  source), `uploads/`, `versions/`, `backups/`, `sitemeta/`, `config/`,
  `orphans/`, `jobs/`.
- **Media Agent** — Instagram/YouTube manager via Composio. Read + comment
  auto-reply live; DM auto-reply blocked on Meta App Review. Details in
  `docs/media-agent.md`.
- **Universal memory** — auto-learned creative taste applied to every media
  generation. Backend only, no UI, deliberately.

## Deploy

Push to `main` → GitHub Actions → Wrangler → Cloudflare Workers → gofarther.dev.
~3–4 minutes, and **a push that touches `builder/` rolls the container image**:
wait **15–20 minutes** before firing a build that must run the new code. An
instance started seconds after "deploy completed" is still on the previous image.

Secrets live in GitHub Actions and upload to the Worker each deploy. **An
optional secret must carry a `|| fallback`; a required one must not** — listing a
name with no value fails the WHOLE deploy (three merges shipped nothing that way).

---

## How a site gets built

`POST /api/site/react-build` (also `/api/site/build`, `/api/site/react-revise`) —
auth-gated, idempotent, a slug claimed by whoever builds it first (409).

1. **Route** (`/api/site/route`, Haiku, ~0.3 credits) — is this a build, a
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

## What the design call decides

`design_schema` is one tool, **93,852 characters**, in the cached block. Property
order IS generation order. **24 properties, 15 required**; a first build sends 23
of them (14 required).

**The order, measured by evaluating the tool rather than reading it** — the list
below drifted twice before, so re-derive it, don't trust this line:

> `brand` · `slug` · `description` · `kind` · `purpose` · `pages` · `components` ·
> `tsx` · `theme` · `wordmark` · `favicon` · `shape` · `images` · `qr` ·
> `css` · `backend` · `action` · `lang` · `langs` · `three` · `behavior` ·
> `needsWeb` · `webQueries`

Only `tsx`, `qr`, `css`, `lang`, `langs`, `three`, `needsWeb` and
`webQueries` are optional.
**`seeds` and `share` are NOT fields** — `seeds` came off on 2026-08-23 and
`share` never existed (the share image is chosen at publish time, not designed).

- **`brand`, `slug`, `description`** — answered FIRST, before anything about the
  look. `brand` is the site's name and therefore its `<title>` and `og:title`;
  **the name stays inside the brief** — the brief's own name verbatim when it
  gives one, otherwise a name for the type of business the customer asked for.
  Four consecutive nameless-CRM runs invented names for the wrong business.
- **`kind`** — `shopfront | tool`. Decided before the plan, because every
  planning answer is an answer about the kind. **A tool's front page IS the
  tool**: no hero, no
  marketing bands, no team section, no closing pitch, and `planBudget` answers
  **0 photographs** — arithmetic, not prose, because the model ignored "no
  photographs anywhere" on four consecutive builds.
- **`purpose`, `pages`, `components`, `shape`, `images`** — the plan (`action`
  sits later, after `backend`, but belongs to this group by meaning: the ONE
  thing the site most wants done, in the business's own words).
  `MAX_PAGES` in the PLAN is **1** (the front page is the site) and
  `MAX_COMPONENTS` **15**, a ceiling with **no floor** — a floor is a quota and a
  model fills a quota. **`page-gen.mjs` keeps its own `MAX_PAGES = 6`
  deliberately**: a full revise hands every stored page back through validation,
  so capping there would delete pages off a live multi-page site on an unrelated
  edit. New builds are one page because the PLAN is.
  **One page is one job**: a band that is really a second screen is left out, not
  stacked below. `shape` carries the 13 universal site shapes as reference —
  named geometry, no trade and no kit component, so nothing can be pasted.
- **`theme`** — one of a 100-name shortlist, out of a 500-theme registry
  (`builder/site-theme-registry.mjs`). `FIELD_KEEPS.theme` judges against all 500,
  so a stored off-shortlist theme survives every merge.
- **`favicon`** — a complete SVG document the model draws. `cleanFavicon` is an
  allow-list that **refuses whole**: 18 elements, ~50 attributes, no `script`,
  no `href` of any kind, entities decoded before the danger checks. We own the
  document element, the model owns the shapes.
- **`wordmark`** — the literal `text` (the name in type, the right answer for
  most) or one drawn SVG. Sized from its own viewBox, because the header
  constrains by height.
- **`css`** — the model's own stylesheet, appended LAST so it wins on source
  order. The 500 themes are the base; this is the layer a customer asks for.
- **`lang` / `langs`** — the language the pages are written in, and every other
  language the site is also offered in. **`needsWeb` / `webQueries`** — whether
  writing this site's copy needs facts the model may not have, and the 1–3
  searches to run if so.
- **`tsx`** (2026-08-29, owner: *"what if customer wants something that we dont
  have in our library… a tsx step that generates stuff… its gotta be after the
  components step"*) — **the escape hatch for the 2,112-component kit.** Answered
  IMMEDIATELY after `components`, by a model that has just searched the kit and
  come up short. **Optional; absent is the ordinary answer.** Each entry is
  `name` · `does` (and what the kit could not do) · `props`.
  **It DECLARES; the page step writes the source** — the owner's call when asked
  directly, and the `images` division: the design call answers 22 fields under a
  ten-minute cap, the page call streams and has no clock, and the default builder
  model is Grok, ~3× slower writing code.
  **The files land in `src/routes/-parts/<name>.tsx`, and both halves of that are
  load-bearing.** Under `src/routes` because `resetRoutes` wipes that directory
  and *nothing else* between builds, and the container is long-lived and shared —
  anywhere else is in the next customer's site. Prefixed `-` because that is what
  keeps a component from being published as a route, **pinned as
  `routeFileIgnorePrefix` in our own vite config** rather than inherited from
  @tanstack/router-generator's default.
  `write_pages` returns them in **`parts`, never in `pages`** — a component in the
  page list would be counted against the page cap, put in the nav manifest,
  published in `sitemap.xml`, and stubbed by salvage.
  **The spine re-sends them on every publish** (`source/<slug>/parts.json`), which
  is not an optimisation: a page importing a component that is not sent does not
  compile, so without it the first typo fix after a build takes the site down.
- **`gif` — RETIRED 2026-08-31** (owner: *"delete the gif step for now"*). It
  worked and it is still live: `washhouse-1` and `washhouse-3` serve one today,
  the laundrette's being a drum — outer ring, three dots on an `animateTransform`
  turning 360° over 6s — in **534 bytes**. **What ended it was the NAME, not the
  feature.** The owner asked for a "gif" and this draws an animated SVG: smaller,
  sharper, themes with the page, and does NOT play where a GIF plays — pasted
  into a message, an email or a social post it is a still or nothing. The one
  thing the word promises is the one thing it cannot do.
  **What went**: the field from `design_schema`, and the `gif` edit lane with it
  (a lane for a field the build no longer produces edits nothing —
  `test/edit-lanes.test.mjs` asserts the two name sets both ways, and this is the
  first time that guard fired in the subtracting direction).
  **What stayed, deliberately**: `gif` on `EDIT_FIELDS`, exactly as `seeds` and
  `family` are kept after leaving the design step — `mergeLook` rebuilds from
  that array ALONE, so dropping the name strips the two live sites on their next
  unrelated edit. And the whole render path: `GIF_FIELD`, `cleanGif`, both
  container payloads, `marksDirective`'s gif half. `site-marks.test.mjs` still
  asserts every hop from storage onward for BOTH marks, which is what keeps those
  two sites working; only hop 1 now says `gif` is absent from the tool.
  **To put it back**: restore the one property and the lane. Nothing else moved.
  **Sweep 4/4 caught, comment-only control survived** — and two of the four are
  the ones worth having: `gif` dropping off `EDIT_FIELDS`, and the container
  skipping `cleanGif` on the stored document. Both would take a live site's
  artwork off or serve it unvalidated with the field long gone from the tool.
  The scanner notes are worth keeping either way — `cleanMark` takes its tag/attr
  sets as PARAMETERS and has three callers, `GIF_ATTRS` is derived from
  `FAVICON_ATTRS` so the two cannot diverge, and the indirection risk is real:
  `<animate attributeName="href">` names its target in a VALUE, so a document
  that cannot *write* `href` could animate one in — `attributeName` is checked
  against the same set the scanner admits, and `animateMotion` is refused
  outright (its child is `<mpath href>`).
- **`qr`** (2026-08-29, owner: *"qr code maker as optional"*; **A LIST SINCE
  2026-09-03**, owner: *"it should carry more"*) — up to `MAX_QRS` (6) named
  codes, each `{ name, points, label }`, all three required. **We draw them, the
  model never does**: a QR is Reed-Solomon
  over a spec with 40 sizes and 8 masks, and its failure mode is a code that
  looks perfect and does not scan — unfalsifiable by every instrument here except
  a phone. `qrcode-generator` (one file, no deps) is bundled into the Worker;
  `qrSvg` emits ONE `<path>` merging horizontal runs (**4,206 chars vs the
  library's 8,464** for a real URL). Generated at build time from the stored
  strings, never stored as a picture — a stored SVG would be a second copy of
  `points` that can disagree with it. `test/site-marks.test.mjs` re-derives the
  module set from the emitted path and compares it against the library's own
  `isDark`, which is the only ground truth available without a camera. The
  payload is held to real business schemes; `javascript:` and `data:` are refused.
  **The name is the file and the binding**: `qr-wifi.svg` and `SITE_QRS.wifi`
  (`{ src, label }`), an identifier — lowercase letters and digits, `QR_NAME` —
  because `SITE_QRS.join-our-wifi` is a subtraction to JavaScript. **The old
  single code reads as one entry named `qr`** through `qrList`, keeping `qr.svg`
  and `SITE_QR`/`SITE_QR_LABEL`, so every site published before the list serves
  the bytes it served; nothing migrates, and the store becomes a list the first
  time a lane or the addon answers. `builder/site-qr-list.mjs` (the names, the
  files, `qrList`, `patchQr`, `qrUnplaced`, the refusal sentences) is
  DEPENDENCY-FREE because the container imports it to name the files — **and the
  image must COPY it** (see the trap: the suite's import walk caught it missing
  from the Dockerfile the hour it was written). The edit lane answers a PATCH to
  one code by name, never the list; the addon appends one and refuses only a
  duplicate (same name or same destination); the look branch's place step asks
  the page rung for the codes no page shows, by name (`qrPlaceAsk`). `three` is
  now the one field a site carries one of (`SINGLE_FIELDS`); `qr` stays on
  `ADD_ONLY_FIELDS`, because the edit path still may not CREATE one.
  `test/site-qr-list.test.mjs` drives the module and reads every hop; the
  container harness compiles a two-code site AND the pre-list single payload.
- **`three`** — a 3D/WebGL element, optional the way `css` is, absent on nearly
  every site. **Fully wired 2026-08-30**, and it took TWO hops because it shipped
  needing both: onto `EDIT_FIELDS` so `mergeLook` stops discarding it, and into
  the page directive (`sceneDirective`). The second is the instructive one — after
  the storage fix the field stored, survived revises and showed in the
  current-state note, so it read as working from every angle except the only one
  that mattered. **The prompt needed no change**: the page rules already said a
  canvas is written "ONLY where the design step asked for it in as many words",
  which was a gate on a signal that had no way of reaching the gate.
- **`behavior`** (2026-08-29, owner: *"update only the frontend design step to
  plan behavior"*) — **what every interactive thing on the page DOES.** One entry
  per control, six required properties: `control` (which element, as it reads on
  the page) · `on` (what triggers it) · `does` · `affects` (what changes or
  opens) · `result` (what the visitor sees) · `source` (`component | custom` —
  does the kit component already do this, or must behaviour be written).
  **Answered LAST of the design fields**, because a control cannot be described
  before the page that holds it exists; the web pair below it is the search gate,
  not a design field. **Compelled**, with `[]` a real answer and `MAX_BEHAVIOR`
  (12) a ceiling with no floor. The item shape lives in `site-plan.mjs` as
  `BEHAVIOR_ITEM` because the edit lane answers the SAME items and may not import
  from `worker.js` — one object, never two copies. **It decides and RECORDS;
  nothing generates from it yet** (owner: *"do not implement the behavior yet"*).
- **`backend`** (tables, functions, apis, jobs) — the ONLY property dropped from
  a first build. `FRONTEND_SCHEMA_TOOL` derives itself by destructuring `backend`
  out and filtering it from `required`, so the two can never disagree. It is
  **29,189 of the 93,852 — 31.1%** off the wire on every first build.

**Every design decision is anchored on a revise.** `EDIT_FIELDS` + `mergeLook`:
absent means unchanged, so a colour change cannot re-roll the theme.
`currentStateNote` shows the model what is stored, derived from `EDIT_FIELDS` so
a new field cannot be changeable-but-invisible.

---

## The published site

**Each site is its own Worker script** in a dispatch namespace. A Worker cannot
load code at runtime, so "one Worker serving whichever site was asked for" is
impossible — which is why a framework upgrade means republishing every site
(`site_rebuilds`, one at a time, no credits).

- **One public address**: `<slug>.gofarther.app`. `/s/<slug>/` 301s to it and is
  the internal addressing scheme. A custom domain returns to ITSELF.
- **The document is rendered per request** from `__root.tsx` — there is no
  prerender step and no HTML in the dist.
- **The head** is the baked half (`site-brand.ts`, written per build) plus the
  publish-time half (the R2 sidecar): title, description, canonical, og:* (url,
  site_name, type, locale + alternates, image + dimensions for the composed card
  only, alt), twitter:card, theme-color, verification tags, icon, apple-touch-icon.
  **`og:url` and the canonical are ONE expression** so they cannot disagree, and
  that expression NORMALISES the join: `siteUrlFor` ends its answer with a slash
  (it names a site) and the router's pathname starts with one (it is a path), so
  concatenating them shipped `//menu` on every route but the home page. Strip the
  origin's trailing slashes, put exactly one back; `here` is `""` on the home
  page, which is how the home page keeps its own.
- **The share card** is composed free at build time — the name (or the drawn
  wordmark) and the description on the theme's paper, screenshotted at 1200×630
  into `dist/client/card.png`. Precedence for `og:image`: **the owner's chosen
  upload → any owner upload → the card. Never a visitor's file.**
- **Assets are relative** (`base: "./"`), so the platform rewrites them absolute;
  `robots.txt` and `sitemap.xml` carry a placeholder origin substituted at serve
  time, because the same bytes serve at three addresses.
- **A route the site does not have is a 404**, and a renamed page redirects — both
  read out of a manifest in the head.
- **`dir` follows the language**, derived from the script, and the kit is on
  logical utilities so it really mirrors.

---

## Editing a site — the ladder

The router picks a layer; each falls through to the one above it when it cannot
express the change. Cheapest first:

| Layer | What it changes | Cost |
|---|---|---|
| `text` | words in the page source | 0 credits |
| `data` | rows, and a list's ORDER | ~0.3 |
| `rules` | schema features enforced in Postgres or read from `_meta` | ~0.3 |
| `look` | the EDIT PATH — 17 lanes, 8 of which act (see below) | 1 |
| `picture` | swap or reframe a photograph (matched on its alt text) | ~0.3 |
| `logo` | the header logo — the attachment IS which picture | 0 |
| `nav` | menu, header button, footer contact/social/legal, in-body links | ~0.3 |
| `page` | one page's layout, via `tweak` (Haiku, minimal patch) | ~1–3 |
| `addon` | a real page rewrite | ~25 |

**`sameProse` is the guarantee the page layer cannot make**: a tweak that moved
the words is thrown away. Measured 0 false alarms over 1,640 real tweaks.

### ADD ALWAYS GOES TO THE ADDON STEP (owner, 2026-09-02)

*"Add will always go in addon"* — and the one carve-out is the owner's too:
*"tsx does exist tho, is literally everything on the page, it could be
changing a component, is changing tsx."* **The line is at the THING, not the
page**: does what the customer names exist on the site now? It does — EDIT
changes it (words, colours, stylesheet, button, menu, pictures, languages,
what a control does, and the page's own code). It does not — ADDON makes it
(a page, a table, a section, a QR code, a 3D scene, a photograph where there
is none). Until 2026-09-02 the router said the opposite in as many words
("sounds like an addon and is an EDIT"), because the line sat at the page.
**Four hops, each guarded in `test/add-goes-to-addon.test.mjs`:**
- the router's wording (`site-ask.mjs`) — the English word IS the question now;
- **a wall at the edit route's PICKER** (`ADD_ONLY_FIELDS = ["qr","three"]`,
  `hasLookField`): a picked field the stored look lacks escalates `addon`
  with `layer: "addon"`. At the picker and NOT in the look step — the first
  draft sat after the look step's `no-look` and `three` is a dispatched lane
  that never runs that step, so "add a 3D scene" walked past it. `tsx` is
  deliberately off the list. The config is read without a connection and a
  read that fails lets the lane run: cannot-tell must never read as
  nothing-there;
- **the browser's `escalateAction` answers `addon`** for that layer and runs
  the addon route with the same sentence. Before this, every escalate that
  was not a sideways hop fell to `up` — the ~25-credit full revise — so the
  middle rung was unreachable from an edit, and the `pages add` escalate had
  been landing on the revise all along;
- **the addon step keeps what it designs.** It ran the designer anchored on
  the stored look and read only `tables` and the pages off the answer — a
  designed `qr` was dropped. Now: `mergeLook` + `readCss`, the page call told
  the bindings (`tsx/gif/qr/three`), the look STORED just before the publish
  (after every refusal, so a refused addon leaves the site as it was) and
  reverted on a failed one, parts merged and handed to the spine, `moved` in
  the reply. **And it no longer refuses a site without a database** — the
  `look`/`logo` dead gate again, one step over: a first build provisions
  none, so `no-backend` had sent every "add a QR code" on most of the
  platform to a rebuild. `{ tables: [] }` is the truth about such a site; a
  table designed for it was a named 422, not a climb — and **since 2026-09-03
  it MAKES the database** (the backend entry in the ADD section below).
The lane sweep's asks changed to match: `qr`, `three`, `tsx`, `components`
now EDIT what fretwork-1 has (a caption, the pick's speed, the chord-diagram
component, the accordion swapped), because "Add a QR code…" is an addon ask
and the harness posts straight to the edit route. Sweep: **23 mutants, 23
killed, control survived** — two needed a guard that reads a call's own
`if (` rather than its position, since `if (false)` leaves the call exactly
where a position check looks for it. **The addon step has NOT run live on a
database-less site yet** — and since 2026-09-03 what it would do there is
make the database (the backend entry below); the proof needs a frontend-only
site on the allowlist, owner's call.

---

### THE EDIT PATH IS ITS OWN PATH (2026-08-29)

**Read `docs/architecture.md` first** — the owner's own drawing of the whole
system: one BUILD step makes the site, then EDIT / ADDON / DELETE act on it and
each publishes back through the one spine. **The site is the centre, not the
paths.**

Owner: *"it should be 2 separated path tho, idk why you are mixing the build with
the edit path"*, and on what the edit step IS: *"customer says edit this, and
booom you go edit it"* — pure action, no design round.

**`look` used to call `designSiteSchema`** — the BUILD's function, the build's
tool, the build's system text — to change one colour on a live site. 84,817
characters of instructions for inventing a business from nothing, nineteen
properties of which eighteen the change had no business opening. **And the two
framings fought**: the build's `css` description opens "ONLY WHEN ASKED… OMIT
this field entirely unless", which a customer's edit reads as *don't touch the
stylesheet*, so `EDIT_RULE` had to name that clause and overrule it in prose.

Now: **`builder/site-lanes.mjs`, which imports nothing from `worker.js`.**

```
customer ──► pick_lanes ──► edit_site ──► publish
             haiku          one per lane   ONCE
             2,811 chars    1 property     however many ran
             17 names       0 required
```

**Twenty-one lanes and EVERY ONE ACTS** (owner, 2026-08-29: *"i need all the 17
lanes acting"* — seventeen then; twenty-two once `three`, `behavior`, `tsx`, `gif`
and `qr` arrived, and twenty-one since `gif` was retired on 2026-08-31).
`pick_lanes` runs ABOVE the layer dispatch, so it is the front door for all
twenty-one and what it names decides which layer runs.
**DERIVE THIS LIST, DO NOT TRUST IT** — it has gone stale twice. `node -e` over
`site-lanes.mjs` and print `LANE_FIELDS`, `OWN_LANES`, `DISPATCHED_LANES`,
`VERB_LANES`, `ESCALATE_LANES`, `UNBUILT_LANES` and `LANE_LAYER`.

**`OWN_LANES` is a group name, not a verdict** — renamed from `ACTING_LANES` on
2026-08-29 after the owner asked *"i thought all of them were act?"* twice. It
means *the ones this module edits itself*; the dispatched, verb and escalate lanes all
do real work too, just on another rung. **ALL 21 act in the plain sense since
`slug` shipped — `UNBUILT_LANES` is empty.**

- **10 act here** — `css theme brand description wordmark favicon qr lang
  langs behavior`. The first eight are a plain string, enum or short list, which is why
  this module owns its own shapes; `behavior` is the one exception and shares
  `BEHAVIOR_ITEM` from `site-plan.mjs`, the only module both paths may read.
  **Every one but `css` is a key on the stored look and must be on `EDIT_FIELDS`**
  — the lane reads `priorLook[field]` and writes through `mergeLook`, so a lane
  missing from that list bills and changes nothing, silently, at both ends.
  Asserted in `test/edit-lanes.test.mjs`; `css` is excluded by name because the
  stylesheet has its own `_meta` key.
- **9 dispatch** — `images`→`picture`, `action`→`nav`, `backend`→`rules`,
  `slug`→`rename`, `shape`/`components`/`purpose`/`three`/`tsx`→`page`. Nothing reads a STORED plan (the
  container gets the pages, the theme and the stylesheet), so `shape` is not a
  value to save, it is a job for the rung that rewrites pages. All of them already
  had cheap shipping implementations; nothing was missing but the wire.
- **1 verb lane** — `pages`, which is three capabilities behind one field:
  `remove` and `move` are the `page` rung, `add` is the addon route. The router
  answers a VERB beside the lane. **No default** — an unreadable verb refuses,
  and this is the ONE place in the edit path where the bias inverts, because a
  wrong guess here takes a page off somebody's site. A verb aimed at a page the
  site does not have is `no-page`, checked against the real route list.
- **1 escalates** — `kind`→`build`. A rebuild is what it IS, the capability
  exists one rung up, and it is NOT a dispatch: `build` is not an edit layer, and
  the guard asserting every dispatch target appears in `EDIT_LAYERS` is what
  caught the first attempt to make it one.
- **0 unbuilt.** `slug` was the last one and it shipped as an ALIAS rather than a
  move — it dispatches to `rename`. The group is kept because it is a real state
  a future lane can be in, and `test/edit-lanes.test.mjs` asserts it is empty and
  names anything that lands back in it.

The five groups are a **total, disjoint partition**, asserted in
`test/edit-lanes.test.mjs` — and each is a different sentence to a customer, so
collapsing any two loses a real distinction. A dispatched lane must never target
`look` — that is the door it came through, and the ask lands back where it
started.

**A RULE PER LANE, IN FOUR NAMED PARTS** (owner: *"i want a rule per everysingle
one of them, just like we did for css"*). `is` · `yours` · `wide` · `keep`, and
only `wide` is genuinely per-field: it names how THIS field gets over-answered.
`css` gets a token where a rule was asked for; `brand` gets a name improved
instead of copied; `lang` gets the site TRANSLATED; `langs` gets the list
replaced when one was being added. Structural, not prose — `laneRule` throws if a
part is missing, so a lane cannot ship as a description with no ceiling.

**ONE PUBLISH PER MESSAGE** (owner: *"if the act was 2 things then 1 publish"*).
The eight branches call `publishStep`, which collects pages and answers success;
the spine runs once below the loop. `eSrc` carries forward between rungs, or the
single publish ships whichever step ran last. A config snapshot taken before any
rung runs is restored if that publish fails.

**The name sets are asserted in BOTH directions** (`test/edit-lanes.test.mjs`) —
a field added to the build with no lane is a part of a site nobody can change
again; a lane for a field the build stopped producing edits nothing.

**The wall, not the rule.** A `css` lane cannot re-theme or rename a site because
its tool has one property and there is nowhere to put the answer. A rule in prose
is one a model eventually reads past.

**The contract is still two opposite halves and they must arrive together**
(owner, 2026-08-28: *"it's free css — the model can edit anything on the page…
but when they ask one thing, you only edit one thing"*) — now in `EDIT_SYSTEM`
and each lane's own description, with no build framing to overrule:

- **Unlimited in WHAT.** The sheet is the whole look and it is the model's to
  edit; nothing on the page is out of reach.
- **Strict in HOW MUCH.** As many edits as there were asks and **never more**;
  each **only as wide as it was asked** — a rule on a control, not a new value
  for a token every component repaints from; and **nothing unasked-for moves.**

Either half alone misleads: permission without a ceiling invites a redesign, a
ceiling without permission reads as "don't touch anything". Stated as the
mechanism, never as a ban-list: a list covers tonight's control and the next
request is always a different one.

**Two asks run two lanes in turn** (owner: *"run both lanes in turn"*), each shown
only its own field's stored value, and **one publish** covers the message.
Measured: **5,606 of tool for a colour change (router + `css` lane), 7,476 for a
behaviour change, against 89,195**, still **1 credit** — `pageCredits` is
variadic and rounds once with a floor of 1, and the routing call is billed once
per MESSAGE rather than once per rung (a sweep caught that double-count; it is
now watched against the ledger, not against our own arithmetic).

**EVERY SMALL CALL FOLLOWS THE PICKER, NOT A HARDCODED MODEL** (owner,
2026-08-31: *"we are gonna get rid of haiku routing, we are gonna use for routing
the same model is picked, if grok is picked then that will be it"*).
`BUILD_MODELS` has a third slot, **`quick`**, equal to that picker's own model —
grok→`grok-4.6`, sonnet→`claude-sonnet-5`, opus→`claude-opus-5` — and the intent
router, the lane picker and all eight rungs (`text` `data` `nav` `picture`
`rules` `tweak` `seed`, plus the acting lanes) resolve through it.
**WHAT IT COST TO LEARN**: run 93 bought a `css` edit and got a **503 in 5.3
seconds having spent nothing**, because every one of those was pinned to
`claude-haiku-4-5` and Anthropic refused on billing. Builds were fine the whole
time — generation was already on the picked model — so *the platform's cheap
ladder was entirely behind one provider while its expensive half was not*.
**Two guards, and the second is the one that matters**: `test/build-models.test.mjs`
scans the eight modules for a pinned model id (comments blanked — every one of
them now names Haiku while explaining that it is gone), and
`test/picked-model.test.mjs` DRIVES each runner with a sentinel and reads the
request that would have gone out. Only the second catches the real failure — a
sweep found `routeMessage` taking a `model` and never passing it to
`askRequest`, which every static check reads as correct.

**Every prompt in there is a PLACEHOLDER** and marked so (owner: *"i will tell you
the prompt later"*). One `hint` and one `edit` string per lane in the `LANES`
table; swapping the wording in is a find-and-replace.

**The look lane is now databaseless in fact, not by permission.** Its
`SELECT v FROM _meta` fed the designer a `tables:` list; with no designer there is
nothing to feed, so the query is gone. `test/site-apply.test.mjs` asserts the
lane issues no SQL at all.

**And the `page` lane had the same dead gate, found only because three lanes now
dispatch to it.** Its `_meta` read was ungated, so on a frontend-only site
`sqlQuery(null, …)` threw and it escalated `no-meta` — the rewrite half dead on
the majority of the platform. `{ tables: [] }` is the truth about such a site;
`null` is kept for a site that HAS a database whose `_meta` could not be read,
because cannot-tell must never read as nothing-there.

### RENAMING A SITE IS AN ALIAS, NOT A MOVE (2026-08-29)

`slug`→`rename`, and **nothing moves**. A slug keys five Supabase tables, seven
R2 prefixes and one dispatch script; R2 has no rename, so a "real" move is a loop
of PUTs with no transaction — a copy that dies halfway leaves the site half at
each address with nothing to roll back to.

**And the move needs everything the alias needs anyway.** Either way the platform
must remember the old name belongs to this site: the old address has to keep
working (customers print it, and we now generate **QR codes** pointing at it) and
the old name has to stay CLAIMED, or the next build of `shoeroom-1` takes over an
address a live site still redirects from. So the alias record IS the feature and
the copy is pure added risk.

**THE STORAGE SLUG AND THE PUBLIC ADDRESS CAN NOW DIFFER, and nothing may assume
they are equal.** `slug` stays the storage key — every R2 prefix, every table,
the dispatch script, and `SITE_SLUG` baked into the page (which addresses the
site's own API, so it MUST stay the key). The one place the distinction is
load-bearing is the canonical link and `og:url`: both are baked into the R2
sidecar at publish time — and are read per request out of its `origin`.
**Two hops carry it, and until 2026-09-02 neither existed** — found by run 17,
the first live rename (`fretwork-1` → `crookes-guitar`): the alias rows landed,
both addresses answered the right way, and the new address served a canonical
naming the old one. (1) `publicUrlFor(env, slug)` — `siteUrlFor` over
`publicNameFor` — is the ONE reader of the public address: the spine, the
build, the resume reply and the checkout return. Both publish sites had handed
`siteUrlFor` the STORAGE slug, so even the republish the lane used to make
would have baked the old address back, and so would every later colour change;
`publicNameFor` had no consumer at all. (2) The rename lane patches that one
sidecar key the moment the alias is current — the share and verify routes'
pattern: the site's Worker reads its head out of the sidecar, so the R2 write
IS the deployment — and no longer republishes (no container, nothing a lost
lease can leave half-done). `test/site-public-url.test.mjs` DRIVES both through
`worker.fetch` and reads the sidecar write; `site-alias.test.mjs` had read the
chain and certified it. **PROVEN LIVE by run 19** (fretwork-1 → crookes-guitar
→ fretwork-1: 16 s, 1 credit, head right in the same second). **A rename
settles everywhere within five minutes**: the alias caches are 300 s per
isolate and only the lane's own isolate forgets at once, so an edge that cached
the old row before the rename keeps serving the old name as current until its
entry expires. A site may return to its own storage name (run 18 found the site
check refusing it as "taken by another site").

**AN OLD NAME CAN BE FORGOTTEN (owner, 2026-09-02: *"so now theres 2? isnt
when you do the change the old one is gone?" … "yea i want that"*).** "Forget
the old address crookes-guitar" on the address lane deletes that name's row:
the address stops answering (a 404 that is never cached — the name may be a
site again tomorrow) and the name is free for anyone to claim. It is a
deliberate second step, never a side effect of a rename, because it cannot be
undone once somebody else takes the name. **One request both checks and
deletes** — `DELETE site_aliases?alias=eq.X&slug=eq.<site>&current=is.false`
with `return=representation`: nothing removed is "not one of this site's old
addresses"; the current name is refused by name first. The model is shown the
site's old names (`formerNamesFor`) and answers `forget` INSTEAD of `name`; a
name in the same answer wins. **The storage name is the one label a deleted
row cannot make disappear** — no row reads as a never-renamed site — so
`resolveAlias` has a fourth case: no row AND the site this label names answers
to another name → gone. The serve path asks `publicNameFor(env, zoneSlug)` for
a row-less label (cached per slug, the miss included), and `/s/<slug>/` now
redirects to the site's CURRENT name so our own addressing survives a forgotten
storage name. Driven in `test/site-public-url.test.mjs`; the harness has a held
`forget` case (`lanes: forget`, chosen by key, skipped before spending when the
site has no old name). It settles everywhere within the same five minutes.

`site_aliases (alias PK, slug, uid, current)`, with **one current name per site
enforced by a partial unique index** rather than by us — two rows claiming to be
a site's live address is a state no application check survives concurrency.

**The cache rule INVERTS from `hostRoutes`.** There a miss is rare and must not be
cached; here the miss is every site that has never been renamed, so not caching
it would put a Supabase round trip in front of every page load on the platform.
The miss is cached as `NO_ALIAS`; a lookup that FAILED caches nothing — including
the failure that matters most, the table not existing yet.

**The table is LIVE** (created by hand 2026-08-30, no migration runner here):
`site_aliases`, RLS on with no policies — service-role only, the posture
`user_site_project` has. The one-current-per-site index was proved by INSERTING a
second current row and watching Postgres refuse it, not by reading `pg_indexes`.

**The code still degrades cleanly if the table goes away**, and that path is worth
keeping: `aliasRowFor` answers null on any read failure and `resolveAlias` reads a
null row as "no alias", so the platform falls back to exactly its old behaviour
rather than erroring. It is still a named gap in the live check, now for the
second reason only — a live rename claims a real address that the
old-name-stays-claimed rule then forbids ever releasing.

**The bias inverts here, and it is the second place on the platform that happens**
(after the `pages` verb): a message with no name in it is REFUSED, never guessed,
because the old address 301s forever after. `cleanAlias` refuses rather than
repairs for the same reason — the first draft turned "déjà vu café" into
`dj-vu-caf`.

---

### THE ADD STEP IS ITS OWN PATH TOO (2026-09-02)

Owner: *"ok now that you have a big idea of what we want, lets start building
the addon part."* The addon route called `designSiteSchema` — the build's
93,852-character tool anchored on the stored look — to add one page or one
code, and read four fields off the answer (`tables`, `qr`, `three`, `tsx`);
the plan it designed for the addition was thrown away and the page call got
the customer's sentence and no plan. Now **`builder/site-add.mjs`, which
imports nothing from `worker.js`** — the edit step's split, for the step that
ADDS:

```
customer ──► pick_adds ──► add_to_site ──► [make the db] ──► the page call ──► ONE PUBLISH
             picked model   one per kind    first touch     (addon mode)
             1,936 chars    1 property      then apply      a job alone: no page
             9 kinds        0 required      the backend     call, no publish
```

- **Nine kinds, the intent router's own list**: `table` · `function` · `api`
  · `job` · `page` · `component` · `qr` · `three` act here; `photo` dispatches
  to the `picture` rung (the one that places a photograph and prices it; this
  step never buys one — and that rung fills only a slot the page already has,
  which on a site with no photograph is none: run 25, the gap below). **Order
  is run order** — a table before the function that reads it, both before
  the job that runs the function, all before the page that shows them.
  `ADD_KINDS`, `OWN_ADDS`, `DISPATCHED_ADDS`, `BACKEND_ADDS`, `addLayer` —
  derive, don't trust.
  **A SECTION IS A COMPONENT** (owner, 2026-09-02: *"section is just adding a
  new component, so its a tsx step that adds components"*). The page is a
  tsx file made of components; what a customer calls a section, a form, a
  map or an FAQ is a component the page does not have yet. The kind names
  THE component — a kit part by name (the page call is shown its exact
  props) or one written for this site (`TSX_ITEM`, the build's own escape
  hatch, landing in `parts`) — and where on which page. An answer naming
  neither is refused (`no-component`): a band the page writer would have to
  invent is the reading the owner corrected.
- **One tool per kind, one property, nothing required** — the wall, not the
  rule: a `component` tool cannot re-theme the site because there is nowhere
  to put the answer. Inside the property the kind's own `required` stands (a
  page with no path is not a page). A four-part rule per kind (`is` · `yours`
  · `wide` · `keep`), `composeRule` refusing a missing part.
- **THE UNIVERSAL RULE (owner, 2026-09-02: *"anytime something new is added
  it needs to keep the design system, meaning the themes, css etc, whatever
  it had already, shape, all the things that form the page"*).**
  `ADD_DESIGN_RULE`, ONE string sent to BOTH models that have to hold it: it
  rides `ADD_SYSTEM` (every kind's designer) and heads the fold's directive
  (the page writer), and `test/site-add.test.mjs` asserts both hops carry
  the same sentence — either alone is half a rule.
- **NO LOW LIMITS WHILE TESTING (owner: *"no limit on things that can be
  added, like the pages, new components, at least not a low limit for now
  since we are testing"*).** `MAX_ADDS` is the count of kinds (a message may
  name every kind it asks for); `page`, `component`, `table`, `function`,
  `api` and `job` answer LISTS (`LIST_ADDS`) capped at what a site can hold —
  `MAX_ADD_PAGES` 6 (the page writer keeps six), `MAX_ADD_COMPONENTS` 12,
  `MAX_ADD_TABLES` 6, `MAX_ADD_FUNCTIONS` 6, `MAX_ADD_APIS` 4, `MAX_ADD_JOBS`
  4 (the engine keeps eight of each tier) — and every
  list rule says "as many as they asked for, and not one more". `cleanAdd`
  keeps every usable entry and names the rest (`skipped`, carried to the
  reply as `notAdded` with the refusal sentence); it refuses only when no
  entry is usable, with the first entry's reason.
- **What it shares with the build are SHAPES, never wording**: the table item
  (**`TABLE_ITEM`, lifted out of `design_schema` into `builder/site-table.mjs`
  for exactly this**, byte-identical on the wire — `readSchemaTool` binds it;
  every guard that read the item's text out of worker.js reads it there now,
  with the `items: TABLE_ITEM` binding asserted beside — **and the other three
  tiers followed it on 2026-09-03: `FUNCTION_ITEM`, `API_ITEM`, `JOB_ITEM`,
  seven more guards re-anchored the same way**), `TSX_ITEM`, the kit's
  `COMPONENT_MENU`, `TOOL_DIRECTIVE`. The `BEHAVIOR_ITEM` precedent.
- **The fold (`foldAdds`) is the hop the old route never had**: the page call
  gets a directive for the addition (file, route, LAYOUT, numbered bands, kit
  parts, where it links from) riding the brief, and the union of kit parts
  through `plan.components` so it is shown their exact props. `tsx` is
  APPENDED to the stored list by name — the old `mergeLook(aLook, designed)`
  REPLACED it, so a new part on a site that had one forgot the first on its
  next revise. `qr`/`three`/`tables`/`seed` fold as before; `aDesigned` keeps
  its name so the store-before-publish / revert-on-failure guards still read.
- **Refusals are sentences, never climbs** (`addRefusal`, `alreadyReply`): a
  code or a scene the site already carries — read the way the edit route's
  wall reads it, stored look OR page source (`ADD_ONLY_FIELDS` and
  `ADD_EVIDENCE`, the same two lists, so the two doors never bounce a customer
  between them; `test/site-add.test.mjs` asserts every add-only field is a
  kind); a page the site has; a code with no destination; a section on a
  many-page site that names no page (a one-page site lands on its page); a
  function with no body, a connection that is not https, a job naming a
  function the site may not run. (A table on a site with no database was one
  of these, refused before any call, until 2026-09-03 — it makes the database
  now; the backend entry below.) Only a picker
  that names nothing escalates to the revise. **A photo beside another kind
  is set aside and said** (`skipped`), because the hop carries one sentence to
  one rung.
- **The browser hops sideways** on an escalate that names an edit layer
  (`siteAddon` → `siteEdit`, handed-off), instead of falling to the ~25-credit
  revise. An escalate naming nothing still falls.
- **Every small call is the picker's model** (`aModels.quick`); every usage —
  the picker's, each add's, the page call's, the seed net's — rides ONE
  `pageCredits` (`...aDesignUsage`, a list now).
- **On the wire**: 1,936 of picker + 1,299 (`three`) / 1,570 (`qr`) / 20,045
  (`table`) / ~35,000 (`page`, `section` — the kit's menu is most of it),
  against 93,852. **Every prompt is a placeholder**, marked so.
- **RUN 21 (2026-09-03 01:25Z, `harness: addon`, case `component`, 207 → 207):
  THE FIRST LIVE ADDON WAS RESET AT 257.6s** — `ECONNRESET` on the inbound
  socket, `NO ANSWER`, nothing charged, the site untouched. The ~273s wall the
  edit path left on 2026-09-01, met on the one route still on the customer's
  connection: the addon route had no queue fork. An addition is a picker, a
  designer per kind, a whole page call on the pages model and a container
  compile — four to eight minutes on Grok — so no part of it can fit.
  **Fixed in the tree the same night, as the edit route's own shape.** The
  addon route files a job through the same queue (`enqueueEditJob` with
  `op: "addon"` — the op is in the idempotency index, so an addon and an edit
  are never one job), the same consumer replays the stored POST, the same
  poll route hands back the stored reply, the same flag and allowlist decide
  it, and the four answers to a filed job (`bad-idem`, `needs-review`, queue
  refused, the receipt) are ONE function both routes return (`enqueueReply`).
  Inside the replay: the replay identity resolves for `(ed || ad)` and no
  other route; every small call rides the job's clock through `aQuick` and
  the page call through its budget argument; cancel and budget are re-asked
  before the page call and before the publish; the bill is ONE number,
  RESERVED before the publish under a job (the spine's gate grants only
  `reserved`/`exempt`, and a job that reserved nothing would be exempted and
  ship free) and collected after it synchronously; the spine is handed `job`
  and `trace`. The browser mints a key per POST and watches a 202 through
  `watchEditJob` with the addon's own reader (`addonAnswer` — the
  `editAnswer` shape, one reader for both paths); the harness sends a key and
  watches a 202 with the one `watchJob` the photo hop already used.
  `test/addon-queue.test.mjs` reads every hop. **Sweep: 21 mutants, 21
  killed, none unapplied, the comment-only control survived** — each a hop
  cut back (the identity offered to the edit route only, the enqueue gated
  on the raw header, the addon filed as an edit, a call off the clock, the
  reserve after the publish, the spine without the job, a gate not asked, a
  receipt read as the reply, a lost ask starting a rewrite, the harness
  posting without a key or giving up before the consumer). Five older guards
  went red for the change and were re-anchored, not appeased — each pinned
  to a spelling (`ed ?`, `return editAnswer(`, `!r.ok`, `"addon")`, the
  siteAddon window) and each now names which spelling moved and why.
  **RUN 22 (2026-09-03 09:32Z, `harness: addon`, `component,page,qr,three,
  photo`, 207 → 195): THE QUEUED ADDON IS PROVEN LIVE ON ITS FIRST CASE** —
  the receipt came back in 2.9s (job `c41d969c…`, `op: addon`), the consumer
  claimed it, reserved **12 credits** at 09:36:12 immediately before the
  publish, published at 09:38:23 and finalized — **5m36s from POST to a
  live site**, `x-site-build` `mtkckb7z-znn7zw` → `mtlbyjzt-6c6lf7`, reply
  `ok` with `index.tsx` changed, 25 files, render check clean. Three short
  quotes from beginner students sit under the QR block in the site's own
  cards (`docs/edits/addon-run22-component.png`, read off the served page).
  **AND THE HARNESS DIED FIVE SECONDS AFTER PRINTING "watching"**:
  `watchJob` sat at module scope and read `TOKEN`, a local of `main`, so the
  first poll threw `ReferenceError: TOKEN is not defined`; the run ended
  red at 09:32:54 with no results file while the job it had stopped
  watching went on to publish. Same family as the five edge false alarms:
  the product was right, the instrument was not. Fixed: the token is a
  parameter both callers pass, the reader and the sleep are injectable, and
  the loop's four answers are DRIVEN in `test/addon-sweep.test.mjs` (a
  guard that reads the text for `TOKEN` beside it). Sweep: **7 mutants, 7
  killed, control survived.** The other four cases never ran.
  **RUN 23 (2026-09-03 10:00Z, `page,qr,three,photo`, 195 → 182): `page`
  PROVEN THROUGH THE QUEUE** — receipt 2.9s (job `a2440b15…`), reserved
  **13** before the publish, published 10:08:01, **6m39s from POST to
  live**, `mtlbyjzt-6c6lf7` → `mtld0p1h-llm1ci`, `prices.tsx` added and
  `index.tsx` changed (the nav link), 30 files. `/prices` is a real page:
  the shell, a `SectionHeader`, and the kit's `PriceList` over
  `useRows("lessons")` — the table run 16's rebuild seeded — four rows,
  £0/£18/£30/£40 (`docs/edits/addon-run23-page.png`, rendered with the live
  rows); one `problems` note (no `head` on the route). The ask said "a
  30-minute lesson, an hour, a block of five"; the page kept that sentence
  as its subline and listed the site's OWN lessons instead of inventing
  three — the data is the site's, the wording is the ask's (owner's call
  whether that is the right answer). **The harness called it a LIE**: it
  read `/sitemap.xml` two seconds after the publish and the edge, which
  caches the sitemap separately from the document, still served the old
  list; a minute later it listed `/prices`. The seventh edge false alarm,
  the product right again. Fixed: the snapshot is re-taken, bounded 90 s,
  until the sitemap lists every new route, before the routes are read and
  the verdict given (`test/addon-sweep.test.mjs`; sweep **4 mutants, 4
  killed, control survived**). **The run stopped on that verdict, so `qr`,
  `three` and `photo` have still not run** — re-dispatch **`qr,three,photo`**
  after the deploy carrying the fix and the roll. And a mirror of the served
  page in this sandbox showed an EMPTY price list for ten minutes — its rows
  come through the site's own `/api/db/<slug>/data/` path, which a mirror
  cannot reach — **a page whose content is fetched is not judged from its
  HTML**; the rows were read through that path and served to the mirror
  before the screenshot was believed.
  **RUN 24 (2026-09-03 10:48Z, `qr,three,photo`, 182 → 170): `qr` REFUSED
  HONESTLY, `three` PROVEN THROUGH THE QUEUE** — `qr` answered `already`
  in 19.9s for nothing ("This site already has a QR code — ask me to
  change where it points…"), build unmoved; `three` filed at 10:49:23,
  reserved **12**, published 10:57:34 — **8m14s**, `mtld0p1h-llm1ci` →
  `mtlesaq6-sz6j1q`, `index.tsx` changed, `moved: ["three"]`, 30 files —
  a `<canvas>` under the booking heading, "A guitar you can turn / Drag
  with the mouse to spin it round", real three.js (`docs/edits/
  addon-run24-three.png`, software WebGL). **The right answer was to ADD**:
  run 16's rebuild had redrawn the earlier scene away and stored no
  `three`, so the wall found nothing on the look or the page. **And the
  harness called it a LIE** — the `qr`/`three`/`table` cases were written
  for the site of 2026-09-02 (no database, a code and a scene on the page)
  and their checks accepted only the refusal; the eighth false alarm. Fixed:
  `eitherWay` judges both outcomes off the page — a refusal is honest only
  when the mark (`qr.svg`, `<canvas>`) was there and the build stayed put; a
  publish only when it was not, is now, and the build moved; `table` reads
  the reply's `tables`. Driven per case from `REFUSAL_FIXTURES`, which the
  guard requires for every refusal case by name. Sweep: **7 mutants, 7
  killed, control survived — one only after the guard it showed was
  missing** (a publish on a site that already carried the thing, which the
  wall should have refused, passed with `!had` dropped).
  **RUN 25 (2026-09-03 11:15Z, `photo`, 170 → 170): THE HOP IS PROVEN, AND
  IT LANDS ON A RUNG THAT CANNOT PLACE A NEW PHOTOGRAPH** — the first green
  addon run. The addon job answered its escalate in 12s (`layer: picture`,
  `kind: photo`, 0 credits), the harness hopped to the edit route, and the
  picture rung's queued job answered `no-slots` in 3s: the site has been a
  `tool` since run 16's rebuild, built with 0 photographs, so there is no
  `SafeImage` and no image prop for the rung to fill. Nothing bought,
  nothing published; fal's balance was never asked. **THE GAP**: the ADD
  line above says a photograph where there is none is the addon's to make,
  but `photo` DISPATCHES to the picture rung, which only fills a slot that
  exists — so on a site with no photograph, "add a photograph of the
  teaching room" escalates twice (`layer`, then `no-slots`) and the browser
  falls to the ~25-credit revise for a request the middle rung should
  answer. The honest shape is a `component` addition (a figure or a hero
  carrying the photograph) with the picture rung filling it afterwards, or
  the `photo` kind adding the slot itself. **Owner's call; filed.** With
  that, every addon kind has run live: `component` and `page` and `three`
  publish, `qr` refuses honestly, `photo` hops; `table` has not been asked
  on a site that can take one.
- **A SITE CARRIES SEVERAL QR CODES (owner, 2026-09-03: *"But a site cant
  have 2 or more qr codes?" … "Yes, it should carry more"*).** Run 24's honest
  refusal was a consequence of the SHAPE — one `{ points, label }`, one file,
  one binding, nowhere to keep a second — not a rule anybody chose. The shape
  is in the `qr` bullet of the design section; what changed on THIS path: the
  `qr` kind answers `name` (required, derived from the caption when the model
  gives none), `cleanAdd` refuses `same-name` / `same-code` / `no-name` /
  `bad-destination` / `too-many` against the STORED list (read through
  `qrList`, so a pre-list site's one code counts as `qr`), `foldAdds` APPENDS
  by name — the `tsx` rule, for the same reason — `siteNote` lists every code
  with both halves, the directive names `SITE_QRS.<name>`, the already-wall
  iterates `SINGLE_FIELDS` (`three` alone) and `alreadyReply("qr")` is gone.
  The harness's `qr` case counts DISTINCT code files on the page, so a second
  code is a publish and a refusal is honest only with a code there and the
  build unmoved. **Taking a code OFF is the deferred DELETE step, not the
  lane**: the old hint said "also taking it off the site" with no mechanism
  behind it — `CLEARABLE_LISTS` is `langs` alone and `hasValue({})` is
  silence — so the new hint no longer promises it. **Sweep: 22 mutants, 22
  killed, none unapplied, the comment-only control survived** — each a hop cut
  back (the first code's file moving, the old single code dropped at the
  reader, at the container and at the note, a repeated name kept, a guess on
  a site with several, a bad destination stored, the old binding counting for
  every code, the patch stored AS the list, the already-wall back on `qr`,
  the evidence reading the old binding only, the place step firing with
  nothing to place, the addon note handed the object, both codes written to
  one file, a same-destination code allowed, the fold replacing, the
  directive and the note listing the first code only, the merge keeping junk,
  the lane compelling a name, the harness counting any code, the image
  without the module). Full suite 4,879.
  **PROVEN LIVE BY RUN 29 (below): fretwork-1 serves `qr.svg` and
  `qr-prices.svg`, 13 credits.** Runs 26–28 before it declined for 0 each,
  and each decline was a fact the designer had not been told — the entries
  below are the record.
  **RUN 26 (2026-09-03 12:53Z, `qr`, 170 → 170): THE DESIGNER ANSWERED
  NOTHING, HONESTLY.** The first time the `qr` designer has ever run live
  (runs 21–24 never reached it: the wall refused first). The picker named
  `qr` in 23 s, the designer answered nothing in 21 s, the route answered
  422 `declined` ("I couldn't work out what to add from that"), cost 0,
  build unmoved (job `add453b86…`, trace `e_mtlj0cy29y1ubo1a`, `add:qr`
  `answered: false`). **The cause was in the prompt, read back locally
  without a model call**: the note told the designer the site's PAGES
  (`/`, `/prices`) and never its ADDRESS, the tool said `points` is "a full
  URL", and the rule says NEVER INVENT THE DESTINATION — so "a code that
  opens the booking page" had no destination it had been given, and
  answering nothing is exactly what the rule asks. The rule is right; the
  note was missing the one fact that makes a site's own pages real.
  **Fixed**: the addon block reads `publicUrlFor(env, ownerSlug)` — the one
  reader of the public address — into `aSite.url` (blank on a failed read,
  never a refusal); `siteNote` prints "Its address is … — a code that opens
  one of its own pages carries that address with the page's route (…)", with
  one of the site's real pages resolved as the example; `cleanAdd` resolves
  a bare route against that address (`siteAddress`), refusing `no-such-page`
  for a route the site lacks and `no-address` when none could be read —
  never a guessed origin; the tool's `points` says a route is an answer and
  the rule excepts the site's own pages from never-invent. Driven in
  `test/site-add.test.mjs` (the note, the resolution, both refusals, the
  worker hop read). **Sweep: 8 mutants, 8 killed, none unapplied, the
  comment-only control survived** — the address not handed, never read,
  left out of the note, a route not resolved, a missing page accepted, a
  missing address guessed as an origin, the tool silent on routes, the rule
  keeping never-invent whole. **Still not proven live** — the same
  dispatch after the deploy and the roll is the proof. The owner dispatched
  run 26 four minutes after the deploy, inside the roll window; it did not
  matter this time only because nothing reached the container.
  **THE DEPLOY CARRYING THE FIX FAILED ON CLOUDFLARE'S SIDE (14:50Z,
  `5d4a40b8`)**: the image built and pushed, then Wrangler's read-back of
  the Worker version it had just uploaded answered "version could not be
  found" (code 10046). This session's GitHub integration is refused for
  re-runs and dispatches (403 on both), so the owner clicked "Re-run
  failed jobs"; attempt 2 succeeded at 15:23Z. **Run 27 (15:12Z, `qr`,
  170 → 170) ran BETWEEN the two** — against the Worker without the fix —
  and declined again in 154 s for 0, as it had to. A deploy's failure is
  read before the next paid run, not after.
  **RUN 28 (15:44Z, `qr`, 170 → 170): DECLINED AGAIN WITH THE ADDRESS IN
  THE NOTE** — picker 45 s, designer 59 s, `answered: false`, 0 credits,
  build unmoved. So the address was necessary and not sufficient, and the
  diagnosis had been a guess dressed as a reading. **Two things fixed, and
  the second is the one that matters.** (1) The note listed the site's
  pages as ROUTES ALONE (`/`, `/prices`); the ask names "the booking page";
  no route says booking, and the never-invent rule then reads as "there is
  no such page". The home page's own headline is "Book a guitar lesson"
  and the nav calls it "Book" — the site knew, the designer was never
  told. `pageLabels(sources, planPages)` reads each page's `<h1>` out of the
  stored source (JSX and tags stripped; a wordless heading counts as none)
  with the stored plan's name as the fallback, `aSite.labels` carries it,
  and the note prints `Its pages are: / ("Book a guitar lesson"), /prices
  ("Lesson Prices")`. Every kind that lands on a page had the same gap.
  (2) **EVERY DESIGNER'S RAW REPLY IS KEPT** — `source/<slug>/addon-answer.json`,
  written the moment the add loop ends and before a decline can return
  (`runAdd` hands the reply up as `raw`), read back by the owner through
  `GET /api/site/answer?slug=&kind=addon`, and the harness prints what each
  designer said the moment a case is `declined`. Three live declines had
  been diagnosed from a boolean; run 90's lesson, one path over: a record
  nothing can read is where the answer already was. **Sweep: 10 mutants, 10
  killed, none unapplied, the comment-only control survived — two survived
  the first pass and both were the tests' fault**: the "wordless heading"
  fixture was merely EMPTY (which any code drops), and the keep-before-
  decline order was asserted by presence rather than position, so a keep
  moved past the `continue` — the one reply worth reading never kept —
  passed. Both guards now drive the case they name.
  **The harness's ask now names the page by its route's own word** (owner,
  16:15Z: *"yeah lets try that"*): "Add a QR code that opens the prices
  page". The list is what the case proves; "the booking page" — a customer's
  looser phrasing for a home page headed "Book a guitar lesson" — is a
  designer question, now answerable from the labelled note, and is tested
  apart from the list.
  **RUN 29 (2026-09-03 16:54Z, `qr`, 170 → 157): THE SECOND QR CODE IS
  PROVEN LIVE.** Picker 6 s, designer 18 s (it ANSWERED: the route
  `/prices`, resolved against the address into
  `https://fretwork-1.gofarther.app/prices` — `qr-prices.svg` re-draws
  byte-for-byte from that string, and `qr.svg` from `tel:01144960123`,
  the only ground truth short of a phone), page call 210 s, publish 194 s;
  **13 credits reserved before the publish, finalized; 438 s from POST to
  the harness's verdict**, `mtlesaq6-sz6j1q` → `mtlrs753-4k2o86`,
  `index.tsx` changed, `moved: ["qr"]`, 31 files, render check clean. The
  harness's own count: "QR codes: 1 on the page before, 2 after; build
  moved" — the first `ok` verdict on this case in nine dispatches. On the
  page: "Scan for prices" beside the enquiry form; "Scan to ring and book"
  untouched further down (`docs/edits/addon-run29-qr.png`, the band;
  `addon-run29-qr-page.png`, the whole page; both read off the served
  page through a local mirror). **Every hop the list needed is now live**:
  a second entry stored beside the first, a second file under its own
  name, `SITE_QRS.prices` in the page, the old binding still serving the
  old code. What the three declines cost: 0 credits and four hours, and
  they bought the address line, the page labels and the kept replies.
- **Sweep: 19 mutants, 19 killed, the comment-only control survived, none
  unapplied** — each a fix cut back to a failure (the cap, the run order, the
  stored parts dropped, a page added twice, the home route reading as none,
  a required kind, a silent missing rule part, unnumbered bands, a truncation
  read as an answer, "already" off the look alone, a photo hop dropping the
  page beside it, one bill of three, the kit parts never reaching the page
  call, the sideways hop falling to the revise, the item unbound in the eval
  scope, `payment` gone from the shared shape). **The guards that read the
  table item's text out of worker.js went red on the lift — thirteen files,
  every one anchored on the item living in the tool** — and each was
  re-anchored on the property (the item where it lives, plus the `items:
  TABLE_ITEM` binding asserted beside it), never appeased.
  **The section→component reframe's own sweep: 6 mutants, 6 killed, control
  survived — one after a guard was added for it.** The harness's component
  check cut to "words landed = true" survived, because the guard drove the
  check only against an unchanged site, where `changed: []` fails it for
  another reason: the recorded "a guard proves the branch it drives" shape.
  It is driven now with a reply that claims the change on a moved build and
  no new words on the page, which is the lie the check exists to catch.
  **The two rules' sweep: 8 mutants, 8 killed, control survived** — the rule
  dropped from either hop, the kind cap back to three, a left-out entry
  vanishing, a page added twice in one answer, a list kind answering one
  thing, the page cap outrunning the page writer's, the route dropping the
  left-out entries from the reply.

- **THE BACKEND IS THE ADDON'S, AND A SITE GETS ITS DATABASE ON FIRST TOUCH
  (owner, 2026-09-03: *"the build step doesnt have backend so its gonna be on
  the addon step if needed … if customer touches it then neon db is
  created"*).** A first build sends none of the four backend tiers, so every
  function a page calls, every outside service a page reads live and every
  job that runs on a timer is added HERE. Three more kinds beside `table` —
  `function` · `api` · `job` (`BACKEND_ADDS`), each the build's own item shape
  (`FUNCTION_ITEM`, `API_ITEM`, `JOB_ITEM`, lifted into `builder/site-table.mjs`
  beside the table's and bound in `design_schema` by identity — seven guards
  that read those items' text out of worker.js went red on the lift and were
  re-anchored on the item where it lives plus the `items: X_ITEM` binding,
  never appeased) in this step's framing, a four-part rule each, lists capped
  at 6 / 4 / 4 (the engine keeps eight of each tier). **The first of any of
  the four designed for a site with no database MAKES the database**, through
  the build route's own `ensureSiteBackend` (the slug's project, claimed
  atomically, auth and the Data API on, idempotent on a retry), gated under a
  job, before the schema is applied; a failed provision is a named 502 that
  is `ours`, nothing charged, nothing changed, stage and scrubbed detail on
  the wire. **The two `no-database` refusals are gone.** `backendDesigned`
  (site-add.mjs, driven) decides "this change touches the database"; then
  `mergeAddonSchema` → `normalizeSchema` → `applySiteSchema` add what is new
  and leave what is there, a function is `CREATE OR REPLACE`d, the jobs are
  registered by `persistSiteJobs`, and the reply says what the engine really
  MADE: `functions` (only those that created — `made.functions`),
  `apis`, `jobs`, `functionErrors` by name, `needsSecrets` (every
  `{{SECRET}}` a new connection wants under Cloud → Secrets), `provisioned`;
  `addonReplyText` says each ("scheduled remind_tomorrow (every day)",
  "Your site has its own database now.").
  **Three hops that were not obvious, each a sweep target:**
  (1) **each kind is its own call, so the job designer must be TOLD the
  function the function designer just declared** — the route appends designed
  functions to `aSite.functions` (internal ones to `aSite.jobFns`, the only
  kind the engine lets a job run) as they are cleaned, `siteNote` prints "The
  functions a scheduled job may run are: …", and `cleanAdd("job")` admits a
  job only against `jobFns`; without it every "remind them the day before"
  designed the builder and then refused the job for naming a function the
  site did not have. (2) **a job on a STORED internal function is re-attached
  after `normalizeSchema`**, which keeps a job only when its function is
  declared in the same spec — right for a build, a silent drop here, where a
  stored function has no body to re-send (re-sending one would `CREATE OR
  REPLACE` the live function with nothing). (3) **the function designer is
  shown each table WITH its columns** (`aSite.columns`, "name type"): a `sql`
  body is parsed at CREATE, so a guessed column is a function that does not
  exist. **A job, or an internal function alone, changes no page**
  (`pageless`, driven): the route bills the small calls through the ONE charge
  closure (`aCharge`, shared with the page path — the reserve under a job, the
  collect otherwise) and answers in the page path's shape with nothing added,
  changed or moved, no page call, no compile. The intent router is told the
  backend is an addition; the harness has a case per kind (`function`, `api`,
  `job`, judged off the reply's own evidence by `blindBackend` because a
  database leaves no mark on the page; the `job` case is `pageless` and the
  runner does not wait for the edge on it); the workflow lists nine cases.
  **Sweep: 54 mutants, 53 killed in the sweep's six files, the comment-only
  control survived, none unapplied** — the one survivor (`design_schema`
  binding `{ ...API_ITEM }` instead of the item) is killed by
  `test/site-apis.test.mjs`'s binding guard, which sits outside that set, and
  a copy is byte-identical on the wire either way. Full suite 4,889 green.
  The replies as the customer reads them: `docs/edits/addon-backend-replies.png`.
  **Not proven live**: the
  three new kinds can be proven on fretwork-1 (~12–15 credits each for the
  two that publish, ~2 for the job, owner's call); the provision needs a
  frontend-only site on the allowlist.

- **JOBS, DESIGNED FIRST (owner, 2026-09-03: *"lets design it first then at
  the end you can push all you want"* → *"ok do jobs"* → *"go"*; delete
  stays on the edit path).** Four decisions, three built, the fourth falls
  out of the second. (1) **The runner sends now** — the backlog entry above.
  (2) **A clock time.** `everyMinutes` alone made "every day at nine" into
  "every 1440 minutes from whenever it was added". `JOB_ITEM` gains an
  optional `at` ("HH:MM", the site's local time) for a daily-or-slower job;
  the zone is NOT the model's — the browser sends its IANA zone with the
  addon POST (`tz`), the route reads it through `validTimeZone` (asked of
  Intl, never a list) and stamps it on each cleaned job that carries `at`;
  `normalizeJob` keeps both (and drops `at` off a sub-daily job, which
  `cleanAdd` refuses first by name, `bad-time`); `persistSiteJobs` writes
  them into the row's `spec`; `dueJobs` runs a clock-time job once its
  latest occurrence (`lastDueAt`, computed from Intl's own view of the
  zone) is behind now AND after the last run — **or after the job was
  REGISTERED for one that has never run**, which is why the cron's select
  carries `updated_at`: a daily 09:00 added at three in the afternoon waits
  for the morning instead of firing on the next tick, and the interval
  still applies on top so a weekly 09:00 waits the week. Absent zone reads
  as UTC. `jobEvery` (site-add) and `jobWords` (chat.js) both say "every
  day at 09:00 (Europe/London)", the zone only when it is not the
  browser's own. (3) **Run now.** `POST /api/site/<slug>/jobs {name, run:
  true}` — owner-scoped, the SAME `jobDeps` under `force` (the stamp lands
  without the dueness clause: the press is the decision), `recordJobOutcome`
  writes where the panel reads, the sentence comes back and the panel toasts
  it; a `Run now` button beside the On/Paused switch. It sends for real, on
  the owner's own key. (4) The first-run timing was the interval-only
  shape; with `at` it is gone. Guards driven in `test/site-jobs.test.mjs`
  (`lastDueAt` across London/New York/Tokyo/UTC and the winter offset,
  `dueJobs` clock-time cases, the three connection reads, the shared deps,
  the run-now route, the panel) and `test/site-add.test.mjs` (the `AT_RE`
  twin, `bad-time`, the fold with the zone, `jobEvery`, the route's stamp).
  **Sweep: 29 mutants, 29 killed, none survived, none unapplied, the
  comment-only control survived.** Full suite 4,895 green after two guards
  were re-anchored for the change, both the recorded traps: a 6,400-byte
  window on the jobs panel (`site-jobs-visible`) that the Run now handler
  pushed the toggle's reload out of, and the runner window in `site-notify`
  ending at the next top-level declaration — which became `jobDeps`, where
  the deps now live. The panel as the owner sees it:
  `docs/edits/jobs-panel-run-now.png`. **Not proven live**: the fix and
  the button need the deploy; a real send needs a mail key in a site's
  Secrets, which none of the owner's sites has pasted.

- **THE BACKEND SERVICES ROUND (owner, 2026-09-03: *"ok add those"*, after
  the 24-item capability list).** Five asks; four built, one found already
  there. Every one is a platform piece — a credential or a network call or
  a file the model cannot hold — so none of it is a model step.
  (1) **CSV import.** `site-csv.mjs` (dependency-free: RFC 4180 with `""`,
  quoted line breaks, CRLF/CR, a BOM, Excel's `;` and tabs sniffed off the
  header line; a cell read AS ITS COLUMN — empty is NULL, `3/9/2026` is
  day-first, `yes/no` is boolean, json re-serialised the way `pickWritable`
  stores it; headers matched to columns case- and space-insensitively) and
  `handleOwnerImport` in `site-owner.mjs`: the same door as the one-row POST
  — the site's own table, declared-not-managed columns, **never a
  member-written table (409)** — a hundred rows an INSERT, **a batch
  Postgres refuses retried a row at a time so the bad line names itself**
  ("line 14: price is required") and the other ninety-nine go in; an outage
  stops it where it is and the reply says so (`stopped`), because the rows
  before it are in. Not a transaction, deliberately. `POST
  /api/site/<slug>/rows/<table>/import` (its own matcher `im`, in the one
  list; `text/csv` body, 2 MB, refused on `content-length` first); the Data
  panel's **Import CSV** beside **+ Add**, gated exactly as it is
  (`docs/edits/data-panel-import.png`), the reply read back as one sentence
  (`importWords`). No upsert: a file that both adds and edits needs a key
  column nobody has chosen.
  (2) **One submission, once.** `site-idem.mjs`: the kit's `useCreateRow`
  and `useCheckout` send an `Idempotency-Key` (a UUID minted per component
  and **renewed only after a success** — a refusal retried with the field
  fixed keeps the key, and a refusal is never remembered, so the corrected
  one reaches Postgres); the data proxy reads it AFTER the spam gate and
  BEFORE the upstream write, answers a repeat with the stored 2xx for ten
  minutes (`x-idempotent-replay: 1`), scoped by site and table; checkout
  the same, cloning the reply. ONE store at module scope (`SITE_IDEM` —
  per request it would forget the first press before the second arrived)
  with an in-isolate map that catches the double-click, and
  `SITE_API_CACHE` KV across isolates, eventually consistent: two presses
  seconds apart on DIFFERENT isolates can both reach Postgres, which is
  named in the module rather than papered over (`unique` and `noOverlap`
  still refuse the copy by name).
  (3) **A job that DOES something.** A function may answer `{"did": "cleared
  12 expired holds"}` — a string, its own words, never a number read as
  "rows" — and `runJob` reports it (`did`), `jobOutcome` says "Done — …";
  read after `jobsSkip` (ours) and before the messages, so a list stays
  messages. Before this a housekeeping run read as "returned not a list":
  broken SQL, said of SQL that had just worked. The function and job kinds
  teach the shape and name clearing out old rows; the router knows clearing
  out is a timer job.
  (4) **Reset and verification.** Neon's docs, read rather than guessed: a
  password reset is a LINK the shared provider sends; verification on the
  shared provider is a CODE (the email-OTP plugin). `useRequestReset` now
  sends `redirectTo` = this page's origin+pathname (never `href`: a stale
  `?token=` would ride along), `resetToken()` reads `?token=` off the URL,
  `useResetPassword` → `{ newPassword }` posts `reset-password`;
  `useSendVerification` → `email-otp/send-verification-otp` with `type:
  "email-verification"`, `useVerifyEmail` → `email-otp/verify-email` and
  refetches `member.verified`. A 404 on the send says "email codes are not
  switched on for this site" — **whether Neon's managed deployment has the
  plugin on is NOT proven**; the free member smoke drives all three (a
  made-up token and a wrong code must be refused, a send must not 5xx).
  The page rules teach the four names and that the reset lands on the page
  that asked, never a page of its own.
  (5) **Inbound webhook signature — already there.** `site-inbound.mjs`
  `authorize`: a header secret or an HMAC over the raw body, fail-closed
  404, no replay guard (sender-specific). The function kind's hint now says
  the platform checks the sender's signature, so the designer does not
  write one.
  Sweep: **46 mutants, 46 killed, control survived** — two survived the
  first pass and both were the tests' fault: the managed-column filter was
  inert against a fixture that declared no managed column (a spec can),
  and the per-row retry's outage stop was never driven (the batch-level one
  was); one never applied until its anchor was re-spelled (`—` in the
  source, a dash in the sweep). `test/site-csv`, `site-import`, `site-idem`,
  `member-reset`, and the jobs suite. Every endpoint contract is Better
  Auth's documented one, read this session. Deployed 19:44Z (run 2011).
  **ONE SUBMISSION, ONCE IS PROVEN LIVE, BOTH HALVES, FOR 0 CREDITS**: two
  POSTs with one key to fretwork-1's `bookings` (19:59Z) — the first 201,
  the second 201 with `x-idempotent-replay: 1` and an identical body, the
  row written once; and run 30's republish put the new kit on the site, so
  its bundle carries `Idempotency-Key` now. The import, the reset and the
  code are not proven live (the owner's token, an inbox).
- **RUN 30 (2026-09-03 20:01Z, `harness: addon`, `table,function,api,job`,
  157 → 141): THE TABLE CASE WAS THE HARNESS'S TENTH FALSE ALARM, AND THE
  PRODUCT WAS RIGHT AGAIN.** The ask, "Add a booking form so students can
  book a trial lesson with their name, email and preferred day", landed on
  a site whose rebuild in run 16 had ALREADY given it a `bookings` table and
  a form on it. The picker named `component`, the designer added a
  trial-lesson form writing `{name, email, appointment_date, notes: "Trial
  lesson"}` into the table the site had — its own rule: "a second table for
  a thing one of them already holds is a site that disagrees with itself" —
  and published in 659 s for 16 credits, `mtlrs753-4k2o86` →
  `mtlyl3y7-iu4asu`, "Book a trial" and "preferred day" on the page
  (`docs/edits/addon-run30-trial-form.png`). The harness's check demanded
  `tables.length > 0`, printed "the addition is not on the site; made []"
  and STOPPED the run, so `function`, `api` and `job` never ran and spent
  nothing. **Fixed in the harness, not the product**: the case asks for a
  thing no table the site has can hold (a waiting list with the instrument
  played), and a publish that made no table now says what that can mean.
  `test/addon-sweep.test.mjs` pins the ask away from the form the site has
  and drives the check both ways. **Re-dispatch `table,function,api,job`
  FROM THE BRANCH** — the harness runs from whichever ref is picked, and a
  push to main would roll the container for a harness-only change.
  **RUNS 31 AND 32 (20:26Z and 22:16Z, 141 → 125 → 108) WERE THE SAME RUN
  AGAIN, DISPATCHED FROM MAIN** before the fix was on it: the old ask, the
  same `component` answer (the trial form re-placed, still one band), 503 s
  and 567 s, the same LIE, the same stop — 33 more credits on a false alarm
  that was already diagnosed. **The dropdown decides which harness runs; a
  fix on the branch is not a fix until the run is dispatched from the
  branch.** Merged to main after run 32 for that reason, at the price of a
  container roll, so the next dispatch works from either ref.
  **RUN 33 (23:17Z, from main at the fixed harness, 108 → 108): THE
  WAITING-LIST ASK RAN OUT OF CLOCK, AND THE CLOCK WAS OURS.** The picker
  named `table` AND `component` (a table and the form that writes to it),
  both designers answered (19 s and 94 s), the page call took 390 s on Grok,
  and the publish began at 545 s with 235 s of the thirteen-minute job left
  — past `expired()`, so the gate said go — and the container call, capped
  at what was left MINUS the two reserves (90 + 15 s), was cut at 129 s of
  the 157 s a compile measured on run 32. 681 s, `TimeoutError`, `billing:
  refunded`, 0 credits, and the reply said "That addition didn't compile —
  try describing it differently": the customer's words blamed for our
  budget, and the harness then overwrote the route's own `failed` with
  "LIE: reply says ok". Read out of `edit_jobs.result` and the trace, not
  the log. **Four fixes, each a measurement**: `EDIT_JOB_MS` 780 → 840 s
  (the teardown room was a 120 s guess; run 33 measured 4.3 s from the
  deadline to the terminal write); `PUBLISH_RESERVE_MS` 90 → 60 s (the R2
  sweep measured 38.8 s on run 32's trace); a **publish floor** —
  `PUBLISH_FLOOR_MS` = compile 180 + sweep 60 + terminal 15 s, asked by the
  job gate for the `build` phase BEFORE the reserve, answered `time` with
  its own sentence, nothing charged; and the spine's container catch
  carries `timedOut`, which `compileMsg` reads before the read/restarting
  fallback. With the new numbers run 33's shape has a 220 s compile cap
  against 157 s measured. The waiting-list table may sit in fretwork-1's
  database with no page showing it — the schema is applied before the page
  call and is not reverted on a failed publish (the look is) — so the
  harness's table ask names a third subject, a second-hand gear board.
  `test/publish-clock.test.mjs` and `test/edit-job.test.mjs` pin the four.
  **Sweep: 12 mutants, 12 killed, control survived** — one (the reserve back
  to 90 s) survived the first pass because the longer clock alone makes run
  33's shape fit; the reserve is now bounded from ABOVE too, at twice the
  measured sweep, since every second held back is a second the compile is
  denied. Deploy and re-dispatch `table,function,api,job` after the roll.
  **RUN 31 (20:26Z, 141 → 125) WAS THE SAME RUN AGAIN, DISPATCHED FROM
  MAIN** before the fix was on it: the old ask, the same `component`
  answer (the form re-placed below the chords, still one band), 503 s,
  `mtlyl3y7-iu4asu` → `mtlzemiw-huj9or`, the same LIE, the same stop —
  16 more credits on a false alarm that was already diagnosed. **The
  dropdown decides which harness runs; a fix on the branch is not a fix
  until the run is dispatched from the branch.**
  **RUN 34 (2026-09-04 00:22Z, from main, `table,function,api,job`,
  108 → 57): ALL FOUR BACKEND KINDS RAN LIVE, THE OLD HARNESS CALLED EVERY
  ONE `ok`, AND THE FIRST SHIPPED A PAGE THAT CRASHES.** Read off
  `edit_jobs`, the workflow log and the served site.
  - `table` (job `926d417c…`, 770 s, **21**): the picker named `table` +
    `page`, the `gear` table was made, `/gear` added (`gear.tsx`),
    `index.tsx` and `prices.tsx` changed (the nav link), build
    `mtm80c2o-3fzzvi`. **The render check's own report said 7 of 8 checked
    routes threw**: `/gear`, `/es/gear`, `/fr/gear` with `useFormField
    should be used within <FormItem>` (a form label used as an ordinary
    label, outside the FormField → FormItem nesting), `/es` and `/fr` with
    React #418 (hydration), and three `-parts/` 404s (task #44, which
    inflates every note). `renderNote` ("I had a look at the finished
    pages: 7 pages threw an error") rode the reply and the browser prints
    it on both paths (`renderTail`). The harness read neither and printed
    OK — **its own screenshot of `/gear` is the error card**
    (`docs/edits/addon-01-table-page.png`). Live: `/gear` serves a
    3,022-byte shell (the server render fell back) and the boundary's
    "This page didn't load" to every visitor; the home page renders.
  - `function` (`6fd85d3a…`, 617 s, **19**): `bookings_on_day` created, a
    `day-space-lookup` part on the home page ("Space on a preferred day"),
    `mtm8fcke-msstf3`.
  - `api` (`551545f9…`, 423 s, **10**): the `gbp_eur` connection made,
    `prices.tsx` changed, `mtm8ozl3-vo4zwg`. Live, the connection answers
    **502 "that service redirected, which this connection does not
    follow"**: `api.frankfurter.app/latest` 301s to
    `api.frankfurter.dev/v1/latest`, and `site-apis.mjs` refuses a redirect
    by design (a third-party read that redirects is a misconfigured
    endpoint, said rather than chased). The page's own code shows the rate
    only when it arrives (`t != null ? … : null`), so a visitor sees the
    four lessons and no rate (`docs/edits/addon-run34-prices.png`, mirrored
    with the site's API proxied live). **The refusal is the product's and
    right; the stale host was the harness's** — the ask names
    `api.frankfurter.dev/v1` now.
  - `job` (`f663c267…`, 91 s, **1**, pageless): `lesson_reminders` +
    `remind_tomorrow` registered in `site_functions` — `{at: "09:00", fn:
    "lesson_reminders", tz: "Europe/London"}`, `schedule_minutes` 1440,
    enabled, never run — no publish, build unmoved. With no mail key in the
    site's Secrets it says so at nine instead of sending.
  **Three fixes** (sweep: **17 mutants, 17 killed, none unapplied, the
  comment-only control survived** — one only after its guard was
  tightened: a conditional `useId` survived a read that looked for the hook
  right after the `?`; every hook in `useFormField` is now required to be
  the whole statement). (1) **The kit's wall**: `useFormField` no longer
  throws outside `FormItem`/`FormField` — a bare `<FormLabel>` or
  `<FormControl>` renders with a `useId` fallback and no field state, and
  inside a real form nothing changes. `test/kit-form.test.mjs` DRIVES it:
  the file transpiled with the root's TypeScript and rendered with
  react-dom/server, bare and inside a real react-hook-form carrying an
  error. **Eight packages are declared at the root for it, at the
  template's ranges** (react, react-dom, react-hook-form, the two Radix
  primitives, cva, clsx, tailwind-merge — CI's unit job installs the root
  only; the template's copy is used when present; no skip). `Figure`'s
  lesson again: the signature list cannot say "only inside a FormItem"
  because a nesting is not a prop, so the obvious use is made to work.
  (2) **The harness reads the site's own render verdict**:
  `crashedRoutes(body)` — a `threw`/`blank` finding on a real route, never
  `-parts/` — turns a verdict that was `ok` into `BROKEN`, `stopsRun` ends
  the run on it, the exit regex counts it red; the guard drives both with
  run 34's findings and reads the regex out of the exit line instead of
  pinning it. (3) The api ask names the host that answers.
  **A false fix caught before it shipped**: `addonReplyText` was about to
  gain the render note on the reading that the reply dropped it — the call
  site already appends it through `renderTail(a)` for both paths, so the
  change would have printed the sentence twice. Reverted.
  **THE REPAIR PASS IS ON THE ADDON'S PUBLISH (owner, 2026-09-04: *"try to
  fix it, if not fix, send as it is"*).** An addition the site's own check
  says broke a page used to ship as it was (the ship-it rule applied to a
  render finding): the BUILD ran the repair pass on that report
  (`repairPages`, the tweak rung, one file, ~3 credits) and the addon did
  not, because the spine's reason for the EDIT lanes getting none —
  "re-checking pages the customer just changed by hand" — was written
  before an addon existed. Now `recompileAndPublish` takes a `repair`
  (`{ send, model, charge }`) and ONLY the addon route hands one in; the
  edit lanes and the rebuild drain are byte-for-byte what they were
  (`test/spine-repair.test.mjs` counts the call sites). The decision is
  **`repairRound` in `site-repair.mjs`, driven with fakes**: no report →
  nothing; nothing serious on a page this publish wrote → nothing; work but
  no room on the job's clock → `time`, the routes named, NOTHING spent;
  else one cheap fix per broken page (`MAX_REPAIRS` 3, the picked model's
  `quick` slot) and a SECOND compile — the corrected list re-assembled with
  its language variants off the cache (`filesFor`, the one assembly the
  first compile uses too) — shipped and STORED when it compiles, the
  original shipped when it does not (never worse than not trying). The hop
  sits after the compile verdict and the dead-css refusal and BEFORE the
  publish gate, so whichever build stood is what is written, archived,
  stored and uploaded. **The room is `canRepair`** — `REPAIR_FLOOR_MS` = a
  call (60 s) + a compile (180) + the sweep (60) + the terminal writes (15),
  asked before the model call: off run 34's `phase_ms`, the function addon
  reached its publish at ~385 s of 840 and would have had room, the api
  addon at ~200 s too, the two-kind table addon at ~540 s would not and is
  shipped as it is, said so. **A language variant is its primary page**:
  `repairBrief` strips a leading segment that is one of the site's OWN
  prefixes (`/es/gear` → `gear.tsx`, `/es` → `index.tsx`; `/de/gear` on a
  site with no German is still nobody's page) — without it run 34's report,
  which named only the variants, bought nothing. **Billing**: under a job
  the round's usage is reserved as sequence #2 (`aCharge(bill, seq)`)
  inside the spine before the gate, so everything charged is charged before
  the commit point; synchronously it joins the one collect. **The
  customer**: quiet on a fix that held (`repairNote`'s rule); "I ran out of
  time to try a fix for /gear, so it's published as it is" or "I tried a
  fix for /gear and it didn't hold, so it's published as it was" otherwise
  (`repairRoundNote`, on the reply's render sentence); the reply carries
  `repair` for the harness, whose BROKEN note now says whether a fix was
  tried. **What it does not do**: a crash inside a `-parts/` component is
  reported against the PAGE that holds it, so the model is handed the page
  file and answers `cannot` or fiddles — the build has the same edge. **Not
  proven live**: fretwork-1's pages all render now, so the next addon whose
  page throws is the proof; the harness prints the round. **THE DEPLOY
  CARRYING IT FAILED ON CLOUDFLARE'S SIDE (02:25Z, deploy run 2015,
  `f866fed8`)**: the image built, the push to `registry.cloudflare.com`
  retried its layers for minutes and ended in a 500, Wrangler stopped
  before the Worker upload — nothing half-deployed, the live Worker is
  `72403ded`'s, the repair pass is not live until the owner clicks "Re-run
  failed jobs" (this session's integration is 403 on re-runs, as on the
  14:50Z failure). The second registry failure in twelve hours. **Sweep: 28
  mutants, 28 killed, none unapplied, the comment-only control survived** —
  each a hop cut back (the variant not mapped, any segment mapped, the model
  not passed, a round with no room still running, a failed second build
  shipping, a refused fix compiling anyway, the usage dropped, a throwing
  compile escaping, the two sentences silenced, a success announced, the
  floor without the call, `canRepair` always, the hop not gated on a send,
  the room forced, `built` or `pages` not replaced, the second compile on
  the old files, the prefixes not passed, the charge dropped, the answer
  without the round, the addon handing none, the charge as #1, the sequence
  hardcoded, the collect without the round, the job charge not added, the
  reply without the sentence, the loop assembling too). Four guards went
  red for the change and were re-anchored, not appeased — `aCharge`'s
  arity, the sync collect's spelling, the file assembly, the spine's
  parameter order — each saying which spelling moved.
  **PROVEN LIVE 01:39Z**: main pushed 01:06Z, deploy green 01:12Z, a
  `site_rebuild` row filed at 01:29Z with `next_try_at` four minutes out
  (past the roll window), drained by the cron for 0 credits —
  `mtm8ozl3-vo4zwg` → `mtma6kia-rldbzk`, `/gear` a 13,825-byte document
  (was the 3,022-byte shell), `/es/gear` and `/fr/gear` 14,005, the home
  page and both variants ~54,500; the mirrored page renders the listing
  form with no page error (`docs/edits/addon-run34-gear-after.png`; the
  error card it replaced is `addon-run34-gear.png`). **Run 33's
  waiting list IS in the database**: the data path answers 403 for
  `waiting_list` (a table with no public read, like `gear` and `bookings`)
  and 404 for a name that is not a table — the schema was applied before
  the page call and the cut compile reverted only the look. A table no
  page shows; taking it off is the deferred DELETE step.

**DELETE deferred** (owner's call).

---

Every cheap edit republishes through `recompileAndPublish` — the shared spine.
**Anything a build bakes must be sent by that spine too**, or a typo fix silently
strips it.

**And the same refusal sat in the SPINE, one layer below the lanes** — fixing the
two lane gates only moved the traffic onto a third. `recompileAndPublish` opened
with `if (!db)` too, and **every publishing lane goes through it** (`text`, `nav`,
`picture`, `logo`, `look`, `data`; the edit block has no other publish path), so
the whole cheap ladder was shut for **20 of 47 sites** — their `site_backends`
row exists with `neon_db` empty, so `siteBackendBySlug` answers null. The refusal
is real but was asking the wrong question: what it guards is a **deleted** site
publishing stripped and being archived as a success, which is a question about
the SITE, so it now asks `siteOwnerBySlug` and only when there is no connection.
On the edit path the route's ownership check already answers 404 first; the
spine's check earns its place for the platform `rebuild` caller, which verifies
no ownership. **A lane that reports every publish failure as `compile` hides
this**: a read-refusal and a killed container wore one sentence ("our build
service was restarting"), which cost two live runs and a wrong diagnosis.

**A lane may only refuse over a database it actually QUERIES.** `data` and
`rules` read and enforce rows, so they require one. `look` and `logo` do not:
the stylesheet, the look and the logo all live in R2, and `configDeps` reaches
for the connection only to fill a legacy `_meta` fallback it already guards. Both
lanes nevertheless opened with `if (!xdb) return escalate("no-backend")` — and
since a first build provisions no database, that refused **most sites on the
platform**, sending every colour change and every logo swap up to the full page
rewrite: ~17 credits measured on `shoeroom-1`, on a rung meant to cost under one
and, for `logo`, nothing at all. Fixed 2026-08-28. The look lane's `_meta` read
is the one thing there that truly needs a connection, so it is gated on `if (edb)`
— **without that, relaxing the gate only trades a wrong refusal for a
`sqlQuery(null, …)` throw the same catch escalates as `no-meta`.**

---

## Data, auth, payments, mail

- **Neon per site.** `site-schema.mjs` is the engine: `isibi.schema.json` in,
  DDL out. Access is **two axes** (`read` × `write`), with five preset names as
  shorthands — `normalizeSchema` stamps `access: "collect"` on a pair-declared
  table, so **always ask `resolveAccess(t)`, never the preset name** (that misread
  has cost five separate bugs).
- **RLS on every table**, keyed on `app_user_id()`. `read: "none"` emits NO SELECT
  policy — the write-only guarantee is the ABSENCE of the statement.
- **Neon Auth** is identity (`neon_auth."user"`, UUID). Always schema-qualified
  and quoted: bare `FROM user` resolves to the `USER` value function and returns
  a wrong answer rather than erroring.
- **Neon's Data API** is the data path; ours was deleted. `/api/db/<slug>/*` is
  transport only.
- **Payments = the owner's OWN Stripe key**, in the site's own `_secrets`. Not
  Connect; we are never in the money flow. **The price comes from the site's own
  rows, never the browser** — a payable table gets no public INSERT grant at all.
- **Mail from a site to its customers = the owner's own key.** `env.EMAIL` is
  OURS (login codes, 200/day) and the builder may not touch it.
- **The line**: we provide hosting, the database, the data API and member sign-in.
  Anything that spends the owner's money or sends mail as their business is
  bring-your-own. The test for anything new: does it need a credential AND a
  network call? Then it is platform code, because a published site is static
  files and Postgres on Neon has no HTTP client.

---

## Credits & monetization

1 credit = $0.008 of fal cost. Postgres RPCs: `get_credits`/`use_credits` (20
granted on first touch), `add_credits` (service-role, mint-key gated, idempotent
on `purchases.ref`), `credit_back` (≤10/call), `is_paid`. Stripe live since
2026-07-08 — memberships Plus/Pro/Max ($24.99/$49.99/$99.99) plus top-ups; the
webhook verifies its HMAC and mints. Free accounts get watermarks; gallery
storage is a membership benefit (10/50/100 GB).

**`use_credits` is a GATE, not a till**: a bill larger than the balance debits
ZERO and returns -1. `collectCredits` takes what is there and `billed` records
what the work cost.

---

## Live state (2026-08-28)

- **Owner's live sites**: `northgroup-9` … `northgroup-17`, `markbook-1`,
  `shoeroom-1`, plus older `fold-lane-bakery`, `harbourside-roast`,
  `the-lido-cafe`, `oak-and-ash`, `forno-and-co`. **Reusing one of those slugs
  REVISES that site.**
- **THE QUEUED EDIT PATH IS PROVEN LIVE (2026-09-01, `fretwork-1`, job
  `b760bd3912b465c9a7dc708df58eed8e`).** POST 202 in 1.5s; claimed, routed,
  `css` lane, first publish refused by verification (`dead-css`: the rule
  targeted `header [data-slot="button"]` and the header button is a
  `site-link`), correction round re-targeted `[data-slot=cta-band]
  [data-slot=button]`, second publish shipped — **414.5s end to end**, one
  sequenced reserve of 2 credits (`ref …#1`), `billing: finalized`, live
  `x-site-build` `mtholxpx-rg59n3` → `mtj1iv41-9cmwjw`, nothing left leased.
  **The correction round's first live proof** rode on it. `edit_finalize`
  writes no ledger row and moves no balance — the sequenced reserves ARE the
  charges, metered on real usage via `pageCredits`; finalize is a state flip.
  The routing call cost **2** on Grok (not the ~0.3 quoted below, which was
  Haiku). Phase timings worth having: `pick_lanes` 7.5s, `lane:css` 47s,
  `lane:correct` **134s**, `publish:1` 95s, `publish:2` 120s. Still only
  `fretwork-1` on the allowlist; **general traffic is NOT enabled.**
- **THE LANE SWEEP RAN, 19 OF 21 LANES, ON `fretwork-1` THROUGH THE QUEUE
  (2026-09-01/02, `.github/workflows/lane-sweep.yml`, `scripts/lane-sweep.mjs`,
  screenshots in `docs/edits/`).** One real ask per lane, judged by reading the
  live site after each publish, never by the reply. **Proven on the site**:
  `css theme brand description wordmark favicon lang langs purpose components
  shape three` (12). **Half**: `qr` — `/qr.svg` is served and decodes, and
  nothing on the page places it. **Correct refusals**: `backend` (no
  database), `pages` with verb `add` (points at the addon route, which the
  queue does not run; `remove`/`move` untested). **Broken, all refunded, all
  filed as task cards**: `behavior` (the intent router sends it to the nav rung,
  which answers `no-menu`), `action` (the nav rung wrote source that does not
  parse), `images` (`no-slots`: `imageSlots` wants a literal alt), `tsx` (the
  new part is never sent to the container, so vite cannot load it).
  **ALL FOUR FIXED IN THE TREE 2026-09-02, AND THE QR'S OTHER HALF WITH THEM —
  none proven live yet; the seventh sweep (`wordmark behavior qr action tsx
  kind slug`, the owner's list) is what proves them.** Every root cause was
  found without a model call: `action` — `applyAction` keyed "is there a
  button" on `action`, which is ALSO null for a COMPUTED button (`label:
  buying ? "Browse" : "Sell"`, fretwork-1's header), so it took the insertion
  branch with no `insertAt` and `slice(0, undefined)` wrote the whole file
  twice around the attribute (found by driving the 332-page corpus and
  PARSING every result: one page broke, the same shape); now keyed on `inner`,
  and a computed button is replaced literal-for-expression. `images` — every
  hero on the platform is `<HeroSplit image={null} imageAlt="…" />`, a
  picture carried as PROPS, which the scanner did not address; a component
  with `image`/`imageAlt` or `src`/`alt` is now a slot, `focusBound` (no
  reframe, honestly refused). `tsx` — the page rung read `pages` off
  `validatePages` and dropped `parts`; now merged over the stored list by
  name (`mergeParts`), handed to `publishStep`, CARRIED across a later rung's
  publish the way `renamed` accumulates, sent by the spine and stored beside
  the source after the gate. `behavior` — the picker read "when someone
  presses the button, open the dialler" as WHERE THE BUTTON POINTS; the two
  hints now name each other's job (`test/lane-hints.test.mjs` pins the
  cross-reference, never the wording — the prompts are the owner's
  placeholders). `qr` — made and never placed: the look branch now adds one
  page step with a fixed ask of its own (`QR_PLACE_ASK`) when no page mentions
  `SITE_QR`, and the page rung's brief now carries the stored `tsx`/`qr`/
  `three` so a page edit knows the bindings exist. **Held**:
  `slug`, `kind` — never under `all`, only when named; when named, the
  harness now follows `kind`'s escalate to the rebuild route and watches it,
  and reads a rename off BOTH addresses (`crookes-guitar`, 301 from the old).
  Sweep for the five fixes and the harness: **23 mutants, 23 killed, control
  survived** — each mutant a fix cut back to the failure measured live.
  **RUN 11, THE SEVENTH SWEEP (2026-09-02 12:32–12:44, 255 → 247), read
  off the SITE, not the log:** `qr` **PROVEN** — placed under the contact
  band with its caption (`docs/edits/14-*`); `action` **half** — the words
  changed on the computed button that doubled the file twice, and the link
  went `tel:+441144960123` → `/` because `navDigest` told the model
  "(there is no button)" for a button with computed words; `wordmark`
  failed on Grok's speed (the 240s `QUICK_CALL_MS` cap, nothing charged);
  `behavior` routed to its own lane for the first time and answered
  already-so, honestly (the kit accordion already closes the others).
  `tsx`, `kind`, `slug` did not run: the sweep stopped on `action`. **The
  harness misread both proofs**: its edge wait and already-so verdict were
  keyed on `moved` alone (the nav rung reports `changed`, the qr page step
  only `files`) and its action check read a `site-link` slot the new
  anchor no longer carried. All fixed in the tree with the digest fix
  (`knownAction`): 10 mutants, 10 killed, control survived. Re-dispatch:
  `wordmark,action,tsx,kind,slug`.
  **RUN 12 (2026-09-02 14:38–14:56, lanes `all`, 247 → 238):** `qr`
  **PROVEN AS AN EDIT** (caption changed, code untouched,
  `docs/edits/16-*`); seven look lanes already-so, honestly; `wordmark`
  timed out at the cap again (task 47); `action` no-change because run 11
  had already set the words (the link is still `/` — the next ask must
  NAME the link); `images` finds the hero slot now and fal has no balance
  to buy a photo; **`tsx` escalated no-change on a PART-ONLY change** (the
  model rewrote the component and handed the page back unchanged; the rung
  compared pages only — `partMoved` now counts a new or differing part);
  **`three` hit the add-only wall** because the page rung stores no design
  field and the stored look said "no scene" while the page had a canvas —
  `ADD_EVIDENCE` reads the page source (`SITE_QR`, a fiber `<Canvas>`) as
  proof the thing exists; **from `shape` on, xAI answered 403: the owner's
  Grok credits ran out**, and every customer sentence said "busy" —
  `upstreamKind(detail, status)` now classes 401/402/403 as refused and
  billing (on us, never "try again") and reads xAI's credit wording; every
  caller passes the status, guarded. Sweep 11/11, control survived.
  `kind`/`slug` never run under `all`. **Grok top-up before the next run.**
  **RUN 13 (2026-09-02 15:22, after the top-up, `action,tsx,three,kind,slug`,
  238 → 237):** `action` **PROVEN with both halves** — "Book a free lesson",
  ringing `tel:0114 496 0123` (`docs/edits/17-*`) — and the harness then
  called it a LIE ten seconds after the publish: **a probe without the
  `x-site-build` header has an empty id, "" is never equal to the old id,
  the edge wait broke at once, and the snapshot read the old build.** Third
  edge false alarm; fixed at both ends (a real, differing id ends the wait;
  the snapshot is re-taken until it shows that id). The product was right
  every time. Re-dispatch `tsx,three,kind,slug`.
  **RUN 14 (2026-09-02 15:53, `tsx,three,kind,slug`):** `tsx` **PROVEN as
  an edit of the page's own code** — "Fingering" above all eight chord
  diagrams, the page file byte-identical, only the component changed
  (`docs/edits/18-*`, 8 credits); `three` **PUBLISHED** the same way (25
  files, canvas kept, page unchanged, 4 credits) and **the harness's own
  `three` check called it a lie** because it demanded a changed PAGE
  whenever the reply listed one — a component-only publish lists none.
  Fixed: any of `changed`/`files`/html-moved counts, the edge wait's own
  rule. **The fourth harness false alarm of the day, and the product was
  right in all four.** `kind`/`slug` did not run; re-dispatch `kind,slug`.
  **RUN 16 (2026-09-02 16:52, typed `kind,slug.`):** `kind` **PROVEN LIVE**
  — escalated to a rebuild in 10 s for 0, the harness followed it to the
  build route, and the site came back a booking tool with **its first Neon
  database (2 tables, seeded)** — **17 credits, 225 → 208**, the revise
  price (`docs/edits/20-*`). **A rebuild keeps what the DESIGN stores**
  (name, description, favicon, langs, qr, the uploaded logo — run 10's
  striped test PNG, which could not publish then, is the header logo now)
  **and redraws everything the page rungs did** (the 3D pick, "Fingering",
  the action button and its dial link, the hero). By construction, not a
  defect. `slug` **NEVER RAN**: the full stop made `slug.` a name the
  harness did not know and `chooseLanes` dropped it silently — fixed, a
  stranger refuses before sign-in (see the trap). `crookes-guitar` is 404.
  **RUN 17 (2026-09-02 17:38, `slug` alone, twelve minutes after a push):**
  the rename LANDED on the addresses — `crookes-guitar` 200, `fretwork-1`
  301 to it, alias rows old-then-new at 17:39:49 — and the queued job was
  **LOST**: the consumer's heartbeat stopped at 17:40:37, inside the
  container's roll window, the lease expired at 17:42:07 and `edit_sweep_lost`
  refunded the 1 credit at 17:44:17; no trace row, `publish_started_at` null,
  phase still `routing` (task #52). **The Worker's log, read by hand**: a
  container instance booted at 17:39:51, the consumer POSTed the compile at
  17:39:56, the heartbeat ran 41 s more, then NOTHING from our code until
  the sweeper at 17:44:18 — no error, no exception. A silent isolate death
  mid-call. **ANSWERED by an aimed read** (`container-logs.mjs` prints
  `$workers.outcome` now, and `LOG_FROM`/`LOG_TO` aim the window, because
  the newest-900 cap reaches only ~40 min back through the backup noise):
  the queue invocation carrying the job (started 17:39:35, the job's own
  creation) ended **`canceled`** at 17:40:49 after 74.7 s wall / 107 ms
  CPU, and the container DO's fetch for it ended `canceled` at 61 s. Not
  CPU, not memory, no exception: **the platform evicted the isolate, nine
  minutes after the 17:31 deploy**. A cancellation runs no catch and no
  finally, so nothing refunded or finalized until `edit_sweep_lost`. **The
  15–20 minute post-push window is unsafe for RUNNING queued jobs too**,
  not only for firing container work. Open (owner's call): the poll route
  answering "interrupted" as soon as a running job's lease is past expiry,
  and whether a canceled job that made no model call may be re-run. The harness said `failed` and the run
  ended GREEN (fixed: `failed` is red). **And the canonical at the new address
  still named the old one, which the lost publish did not cause** — see the
  rename section: both hops were missing, and the harness's check read the
  addresses and not the head (fixed: it reads the canonical, follows the
  alias once at the start, and flips the target so the lane can run again).
  **`fretwork-1` answers at `crookes-guitar.gofarther.app` now**; the harness
  keeps `site: fretwork-1`, the storage slug the API keys on. The live head is
  corrected by a free platform republish (`site_rebuild` row, no model call)
  once the deploy carrying `publicUrlFor` is on.
  **RUN 18 (18:22, `slug` alone):** the harness flipped the target to
  `fretwork-1` and the lane refused it in 13 s as *taken by another site*
  — the storage slug IS a site, this one, and the site check did not know
  whose. Fixed (`wanted === ownerSlug` skips the site check; the alias check
  already read that row as the site's own), refunded, and the run was RED —
  the first `failed` to show as one. **A rename touches no container now**,
  so the re-run needs only the Worker deploy, not the roll.
  **RUN 19 (18:53, `slug` alone): `slug` PROVEN END TO END** — the way
  back to `fretwork-1` in 16 s for 1 credit, the head patched in the same
  second (canonical and og:url name the new address), `crookes-guitar`
  301s to it, no container. **The harness called it a LIE — the fifth false
  alarm today, and the product was right every time**: it read the old
  address 20 s after the rename, when an edge still holding the alias row
  it cached BEFORE the rename served the site instead of redirecting.
  `aliasRoutes`/`aliasCurrent` live 300 s per isolate and only the lane's
  own isolate forgets at once, so **a rename settles everywhere within five
  minutes**; the harness now waits for both addresses up to that lifetime.
  Shorter caches are the owner's call (a Supabase read per uncached request
  is the price). **Both held lanes are proven live; the site is back at
  `fretwork-1`.**
  **Not one lie from the
  product**; every "LIE" the harness printed was the harness (an edge race, an
  inline-svg assumption, an og:locale count) and each is now a case in
  `test/lane-sweep.test.mjs`. Whole effort, canary included: **309 → 274, 35
  credits**; sweep five alone (11 lanes, 26 minutes) 296 → 274. The harness
  fixes live on branch `claude/help-needed-ehlwlj`; a dispatch from `main` runs
  the old harness (done three times), so merge or dispatch from the branch.
  **Merged to main 2026-09-02 01:31.**
- **THE GAP SWEEP (2026-09-02, `scripts/gap-sweep.mjs`, behind the
  `harness: gap` input of `lane-sweep.yml` — one workflow file, because GitHub
  lists only workflows that exist on the default branch; the harness word is
  read trimmed and lowercased after run 9 died on `gap `).** The rungs no lane
  reaches, on the EDIT PATH only (owner: *"IM TALKING ABOUT THE EDIT PATH, NOT
  THE ADDON"*). Owner narrowed it to two cases; the others (cancel, move,
  move-back, remove, data, rules, backend, the last six on `the-lido-cafe`)
  are written and unrun. **`text` PROVEN** (run 10): the intent router picked
  `text` for a wording change, all four occurrences changed, published in
  2.5 min, **3 credits (routing 2, rung 1)**. **`logo` COULD NOT PUBLISH THROUGH
  THE QUEUE (fixed the same night, see the trap; re-run pending)**: the lane makes no model call, so the consumer never places a
  reserve and `billing` stays `none`; `edit_may_publish` grants only
  `reserved` or `exempt`, answered `unbilled`, the spine returned
  `not-granted`, and the lane's catch told the customer *"That didn't
  compile"* — the container had compiled it (23 files, status 200). Filed.
  **Every zero-cost rung queued will hit this gate** — `pages remove` and
  `pages move` make no model call either. The synchronous path has no gate
  (`if (job)`), so the identical edit works on a site off the allowlist.
- **A SECOND FULL LANE SWEEP RAN BY MISTAKE (run 8, 2026-09-02 01:42, the
  harness box left on `lane`)** and is the idempotence measurement: every look
  lane answered *"already looks like that"* for 1 credit and published
  nothing; theme and the four page-rung lanes escalated `no-change` for 0;
  the four broken lanes failed identically and were refunded; **`tsx` passed
  this time** (the model kept the component in the page instead of writing a
  part file the edit path never sends — 1 for 2, the task card stands).
  19 lanes, 19 minutes, 16 credits.
- **Balance: 57 credits** (read by the harness 2026-09-04 00:57Z, after run
  34's four backend cases: 21 + 19 + 10 + 1). It was **0** on 08-29;
  a stale number is worse than none here, because `buildFloor` refuses before
  spending and the refusal reads as a broken build. **Read the ledger, do not
  trust this line.**
- **A BUILD AND A REVISE COST DIFFERENT MONEY, BOTH MEASURED.** A first build on
  grok is **~45 credits** (run 80, `ashgrove-1`, one page, 2 photographs: 45
  billed, 47 with the routing call) — **but that is the TOP of a range, not the
  price**: run 91 (`coalhole-2`, one page, 8,967 chars, 0 photographs bought)
  cost **11**, ledger 341→330. Four times' difference between two first builds on
  the same model, so quote a range or measure the run. A REVISE of the same site is **17** (run 83:
  9 billed for the build, 17 off the balance with routing) — it anchors to the
  stored design, so the expensive fresh-decision half does not re-run. The
  workflow carried "~130" for nine days, a Sonnet-era guess nothing could check,
  because **nothing records what a build costs**: `gen_charges` is the media
  side's image ledger and `site_builds` has no cost column. The balance before
  and after IS the measurement.
- **PROVEN LIVE 2026-08-30 by run 83 on `ashgrove-1`** — the 3D scene (real
  three.js + @react-three/fiber, a chair modelled from `boxGeometry` and
  `cylinderGeometry`, drag-to-turn hand-written because `drei` is not a
  dependency), the favicon, the wordmark, the head pack (canonical and `og:url`
  agreeing, no `//`), `og:image` precedence choosing an owner upload over the
  composed card, and the `kind: tool` image arithmetic answering **0
  photographs**. The QR and the animated mark did NOT appear on this build and
  are proven a different way — see below.
  **The three.js runtime is 992 KB of JavaScript**, which is the real price of
  the `three` field and lands on every site that asks for a scene.
- **The building account is `aniascristian@gmail.com`, not the session's own
  address.** It owns every live site and holds that balance. Look at the wrong
  row and the balance reads as zero.
- **Analytics is collecting** and has been since the CSP fix on 2026-08-15: 451
  pageloads in the 7 days to 2026-08-28 across ~25 hostnames. Config
  `53fa6238…`, token `16ed2075…`, `auto_install: true`. `rum report` reads it
  free and read-only.
- **`site build` is 326/326** against the real container (2026-09-03, the QR
  list's two-code build and the pre-list payload added sixteen); the unit
  suite is 4,985 (2026-09-04, after the repair pass on the addon's publish:
  the round driven with fakes, the floor, the spine's wiring by landmark). **In this sandbox the
  harness needs `playwright-core` at the root the way `site-build.yml`
  installs it** (`npm i --no-save playwright-core@<the template's playwright
  version>`) — without it the six card and touch-icon checks fail with
  "Cannot find package", which is the environment, not the product.
  **Run it with nothing else of its own already running.** It binds a fixed port,
  so a leftover `build-server.mjs` from an earlier run makes the new one's
  `listen` throw and every streaming leg report "0 reports arrived" — six red
  checks that look like the feature and are the port. Killing the harness by PID
  is not enough: it orphans that child. Check `pgrep -a -f build-server.mjs`
  first and kill what you find, by PID.
- **Default builder model is Grok** (`DEFAULT_PICKER`), ~3.5× cheaper than Sonnet
  on a comparable site and ~3× slower on the pages call. Sonnet is one click away.
- **A cold new account is one credit short of building**: `buildFloor(sonnet)` is
  20, the grant is 20, and the routing call spends 1 first. Owner's call is to
  fund the test account rather than raise the grant; `test/build-models.test.mjs`
  pins it.

---

## THE TRAPS

Every one of these has cost at least one session, most of them several. Read this
before writing a guard.

**The wiring layer.** Twelve-plus features have shipped DEAD with the module
perfectly correct and one hop cut: a value computed and never forwarded, a dep
injected and never called, a field decided and never put on the wire. From
outside, "the model did not set it" and "we did not forward it" are the same
`undefined`. **Before rewording a prompt because a field came back empty, check
that the field can arrive.** Assert the CHAIN, end to end, and derive it from the
producer rather than listing today's hops.

**Latest, and it is the purest instance yet: `three`, shipped dead 2026-08-29 and
found the next day.** A design field added with its lane, its guards and a green
suite — and left off `EDIT_FIELDS`. `mergeLook` rebuilds its output from that
array ALONE, so the model designed a 3D scene on every build and the answer was
discarded before anything could store or read it. Nothing failed and nothing
logged. **The one-command check that finds this class in seconds:** for every
design field, count consumer references — but count them the way the value really
travels. A dotted `designed.<field>` scan answers 0 for `purpose`, `pages`,
`shape`, `images`, `action` and `backend`, all of which are perfectly wired, because
they travel as a DERIVED walk over `PLAN_KEYS`. So the honest test is membership:
**a design field must be in `PLAN_KEYS`, or on `EDIT_FIELDS`, or have a named
per-field hop (`readCss` is the model for that) — a field in none of the three is
dead.** `three` was in none of the three; `behavior` is on `EDIT_FIELDS`.

**Assert the property, not the spelling.** The single most repeated own-goal here.
A guard pinned to `foo(a, b)` goes red the moment an honest third argument
arrives, reporting that the feature is gone. Anchor on what must be TRUE.

**Never size a source-read window in bytes.** Ten-plus instances. This repo puts
its reasoning in comments, so any byte window is outrun by the next comment.
Window from landmark to landmark, and assert both landmarks exist — `indexOf`
answering -1 gives `slice(-1, -1)` = `""`, which passes every assertion inside it.

**Overlapping windows.** A window that runs to a NAMED neighbour swallows whatever
is inserted between them, and a mutation in the wrong half then passes. Derive the
closing landmark from the next sibling.

**Prose contains the thing it forbids.** A comment explaining a deletion spells
the deleted name; a comment arguing for a class name contains that class name.
Nine-plus instances, several inside the guard written for that very trap. **Blank
whole-line comments (length-preserving) before any scan.**

**A negative assertion must prove its observer is alive.** `[].every(...)` is
`true`. A loop over an empty collection contributes no checks to fail. Assert a
floor on what was scanned before believing an absence.

**Inert mutants.** Sixteen-plus recorded. A mutation that changes no behaviour
reads exactly like a test gap and costs a hunt through checks that are fine.
Before believing a survivor, prove the mutation changed something.

**A mutant that never applied.** The mirror. `grep -qF "$to"` is vacuous when the
replacement is empty or common — verify by CHECKSUM. **A sweep whose control never
applied is a sweep with no control.**

**Two lists of the same thing.** Routes in a matcher and in a dispatch condition;
a scanner's list and the kit's. They drift, and the drift is silent. Derive one
from the other, in BOTH directions where the scan can stop matching.

**`String(["a"])` is `"a"`.** Shipped as a real bug three times — a one-element
array passing as a role, an access level, a language. Refuse a non-string; never
coerce.

**`X["constructor"]` is truthy.** Shipped once in the Stripe plan lookup and
nearly again three times since. `Object.hasOwn`, never truthiness, for any
caller-supplied key.

**Flat scans where depth matters.** Written wrong five-plus times. `\(([^)]*)\)`
stops at the first `)`, which is usually inside a nested call. Argument lists,
object literals and selector lists all need a depth-aware splitter.

**A fixture in a different shape from reality.** `setTotp`'s fake did a partial
update the real one could not; a path fixture used a shape the pipeline never
produces. A fake that is MORE capable hides bugs exactly like one that is less —
and so does one that differs by a single character. The og:url/canonical fixture
stored `https://slug.gofarther.app` while `siteUrlFor`, the ONLY writer of that
field, returns it WITH a trailing slash; every non-home route emitted
`https://slug.gofarther.app//menu` as both its canonical and its og:url, and the
container harness certified it for a day. **Derive a fixture from its real
producer.** A hand-typed constant is a second copy of what a value looks like,
and two copies drift silently — this IS "two lists of the same thing".

**A `//` in a URL is not a cosmetic defect.** `https://host//menu` parses as the
host `menu` under protocol-relative rules, so a wrong canonical does not name a
wrong PAGE of the site — it names a different SITE. Assert an address by parsing
it (`new URL(u).pathname`, `.host`), never only by string equality against an
expectation the test assembled the same wrong way.

**A rule true because of a layer below it expires when that layer moves,
and nothing announces it.** `#/` hrefs were correct under hash history; a
comment's reasoning about `ctx.waitUntil` was true until the queue landed. When
something one layer down changes, re-ask what rested on it.

**A false alarm is worse than a miss.** A check that flags correct code teaches
the model — and the next session — away from something that works. Any new lint
measures its false-alarm rate against the real corpus and must reach ZERO before
it ships.

**A failure that cannot name itself.** Seven-plus instances: four different causes
wearing one sentence, a status with no reason, a report that died with the socket.
When two failures need opposite fixes, they must be distinguishable from outside.
**Latest, 2026-08-29:** `compileMsg` answered "our build service was restarting"
for BOTH a killed container and a read that never got the site's design, so a
databaseless site's refusal read as container churn — the next move was a settle
delay that fixed nothing, because nothing had restarted. The honest half was on
the wire the whole time (`pub.error`, and `detail` beside it); only the sentence
collapsed it, and the harness printing that answer did not log `detail`. **A
harness that hides the diagnostic half of a response turns every failure into a
guess** — cost two live runs.

**`pgrep -f` / `pkill -f` match your own shell.** Ten-plus instances — the harness
wraps the command in a shell whose command line contains the pattern, so
`pkill -f x` kills the thing running it (exit 144, empty log) and
`until ! pgrep -f x` never exits. Kill by PID; watch a log's tail.

**A CHAIN TEST THAT READ THE MODULES INSTEAD OF RUNNING THEM (2026-08-30,
found while checking why run 83 shipped no QR).** `test/site-marks.test.mjs`
has a case literally called "THE CHAIN — both marks reach the site, and survive
every later publish", and it is honest about what it reads — but it reads
SOURCE. **Nothing had ever compiled a build carrying a `gif` or a `qr`.** Same
shape as run 80: `three` was declared, installed, present, correctly named in
the prompt, and unimportable. A chain asserted by reading is a chain asserted at
the layer below the break.
**Where the risk actually sat is not where a source read would look.**
`writeSiteBrand` puts the artwork in `public/animated.svg` and `public/qr.svg`
and only the PATH in the generated module — so there is no string-escaping
hazard at all, and instead the live questions are whether Vite copies `public/`
into `dist/client/` and whether the publish sweeps it. A build can compile
perfectly and ship a page pointing at two 404s.
Closed by a container case (`MARKS_INDEX`) that sends both, with the artwork
DERIVED from `qrSvg` and `cleanGif` rather than hand-typed, and asserts four
things a file listing alone cannot: the build succeeds, both files are in the
published output, the built page references both paths, and the caption survives
as alt text. Green first run — **both marks were correct all along, only
unproven.**
**And the reason run 83 had no QR was not a defect.** The brief says every chair
leaves with a card carrying a code you scan; the QR belongs on the PRINTED CARD
pointing at the site, and the site's job is to RESOLVE the code — which is
exactly the `chairs` table it built. A QR on the page would have been the site
linking to itself. Worth remembering before reading a missing optional field as
a dead wire: **`qr` is offered on every build** (`FRONTEND_SCHEMA_TOOL`
destructures out `backend` and nothing else), so absence is a judgement, not a gap.

**AN AUDIT OF THE CONTAINER'S INPUTS FOUND THE NEXT `three` (2026-08-30).**
The container reads 28 fields off a build payload. Comparing that list against
everything `test/integration/site-build.mjs` has ever SENT found **`parts` had
never been exercised** — the `tsx` escape hatch, the way out of the 2,112-piece
kit, wired on 2026-08-29 and never once compiled. Exactly the shape that cost
run 80. Closed the same day with a fixture proving four things a source read
cannot: the component compiles, its markup reaches the bundle, it is NOT
published as a route (what `routeFileIgnorePrefix: "-"` buys), and it is not in
`sitemap.xml`. Green first run — it was correct all along, only unproven.
**The audit itself is the reusable part**: derive the consumer's real input
surface (`payload.<field>` in `build-server.mjs`), derive what the harness
sends, and diff them. Still unexercised after this: `langs`, `fontFiles`,
`pageTokens`, `description`.

**FOUR PAID BUILDS DIED ON A GATE THAT DID NOT HAVE TO EXIST (2026-08-30).**
Runs 80, 82, 84 and 85 all ended `page=placeholder` at `stage: typecheck`, every
one of them a TYPE error, every one leaving a charged customer with nothing. The
whole time, **the bundler did not care**: `tsc --noEmit` is a gate WE impose and
Vite strips types with esbuild without checking them. Measured on the exact page
that killed 84 and 85 — `tsc` exit 2 with TS2322, `vite build` exit 0, 2,186
modules in 6.95s. **The sites would all have shipped.**
The typecheck reports now and only `vite build` refuses, which is the honest
split: a type error is a claim about types, a vite failure is code that will not
become a bundle. **The general shape: before hardening a gate, check whether the
layer below it needs the gate at all** — four builds were spent teaching a
checker to pass when nothing downstream was asking it to.
Its corollary is that `salvage` now has nothing to do on the build path (it keys
on `stage: "typecheck"`, which no longer exists), on top of already being
unreachable for one-page sites. Left in place rather than deleted: it is the
answer if a refusing stage ever returns.

**SALVAGE CANNOT FIRE ON A NEW BUILD, AND HAS NOT SINCE `MAX_PAGES` BECAME 1
(found 2026-08-30 by run 84).** `site-plan.mjs` plans **one** page and that page
is `index.tsx`; `publish-pages.mjs` refuses to stub when `index.tsx` is the page
that failed. Both are correct in isolation and together they mean the only page
a new build has is the one page salvage will not replace — so the whole mechanism
is unreachable for every new site. It was right when a site had five pages
(stubbing the home page while four work is worse than refusing) and became a
no-op the moment the plan went 5→1. **Nothing announced it**, which is this
repo's own "a rule true because of a layer below it expires when that layer
moves" trap, caught only because three of four paid builds in one day ended
`page=placeholder`. The early placeholder is still the real safety net and it
works, so nobody gets nothing — but the SECOND net has been dead for weeks.
Deliberately not fixed: whether a broken home page should ship as an apology stub
or keep its placeholder is a product call, and the placeholder is arguably the
better page. **Open, owner's call.**

**TWO KIT COMPONENTS WHOSE NAMES DO NOT DISTINGUISH THEM (2026-08-30, run 84,
8 credits).** `Figure` draws its own picture from a `src` prop and takes NO
children; `MediaCaption` takes the picture as a child. Both are captioned
figures. Told to render the QR as its own `<img src={SITE_QR}>` and show it with
its caption, the model reached for the one whose NAME matched the job and the
build died at typecheck with TS2322. **This is `marksDirective`'s own rule one
level up** — it already says the bindings are named exactly "because they are
generated: a page that guesses `SITE_GIF` does not compile". A page that guesses
which figure holds children does not compile either. The directive now names the
component, and `test/site-marks.test.mjs` reads that name OUT of the directive
and checks the component really accepts children, so a rename cannot make the
guard lie. **The general shape: when the kit has two components for one job, the
prompt must pick, because a name is not a contract.**

**TWO KIT COMPONENTS WHOSE NAMES DO NOT DISTINGUISH THEM (2026-08-30, runs 84
and 85, 22 credits).** `Figure` drew its own picture from a `src` prop and took
NO children; `MediaCaption` took the picture as a child. Both are captioned
figures. Told to render a QR as its own `<img src={SITE_QR}>` and show it with
its caption, the model reached for the one whose NAME matched the job and the
build died at typecheck with TS2322 — **twice, in two generations, at two
different lines**. **The signature list already said `Figure` took no children**
(`component-api.mjs` is generated from the real props and is in the prompt), and
the model passed them anyway; naming the right component in the directive was
tried between the two runs and run 85 read past that too. **So the fix is the
wall, not the rule**: `Figure` takes children now (`children ?? <SafeImage>`),
which removes the choice instead of governing it. Regenerating
`component-api.mjs` is the hop that carries it to the model — two tests catch
that file going stale, which is how the change reaches the prompt at all.
**The general shape: when the kit has two components for one job and their names
do not say which is which, a prompt cannot fix it — make the obvious name work.**

**A DIRECTIVE FIX THAT WAS INERT BECAUSE THE DIRECTIVE NEVER FIRED (2026-08-30).**
Between runs 84 and 85 I changed `marksDirective`'s QR paragraph to name the
right component. It changed nothing, because that paragraph is emitted ONLY when
a `qr` exists and neither run designed one — I fixed prose the model never saw
and then read the identical failure as "the model ignored it". **Before
concluding a prompt change did not work, check the prompt actually contained
it.** The tell was in the builder's own reply both times: it described the wifi
as something to COPY off the screen, never to scan.

**THE QR RULE IS STRICTER THAN THE REST OF THE DESIGN STEP, so a first build can
almost never have one (2026-08-30, open).** `QR_FIELD` says "NEVER INVENT THE
DESTINATION… it points at something the brief actually gives you, or it does not
exist" — while every other field invents placeholder detail freely, and the same
builds invented a door code, a phone number and an address, each flagged "swap
them for the real ones". A brief that says *scan the wifi off the screen* gives
no real password, so the model correctly declined and printed it as text.
`WIFI:`, `tel:`, `mailto:` and `geo:` are all accepted by `readQrText`, so the
machinery is not the limit — the rule is. **Whether a QR may use a placeholder
like everything else is a product call; owner's.**

**A UNIT CONVENTION STATED ONLY IN PROSE (2026-08-30, run 83, live on
`ashgrove-1`).** `OptionPricedList` says in its own doc comment "All arithmetic
in integer minor units". The generated page passed the database's `price` —
`1640`, meaning £1640 — straight into `delta`, which wants pence, so the kit
correctly drew **+£16.40** while the page's own total, treating the same rows as
pounds, drew **£1880.00**. Both on screen, one above the other. Nothing failed:
tsc passes, the render check passes, the numbers are all plausible. **A
convention a model must READ is a convention a model will eventually read past**,
and this one is invisible to every instrument we have because both renderings are
well-formed. The fix shape is a type (a `Minor` branded number) or a prop name
that carries the unit (`deltaMinor`), not a firmer sentence. Not fixed — the
owner has not asked.

**AN INSTRUMENT THAT REPORTS CORRECT CODE AS BROKEN — the screenshot version
(2026-08-30).** A `fullPage: true` capture of a site using `animation-timeline:
view()` shows every below-the-fold section BLANK, because Chromium expands the
viewport for the capture and scroll-driven progress is computed against it: the
sections sit at `opacity: 0` with their real height, so the page reads as
enormous empty gaps. Scrolling first does not fix it — the animation is not
sticky, it re-hides. I was one sentence from reporting a published site as
broken. **Screenshot each section scrolled INTO VIEW and assert its computed
opacity**, which is what proved all seven were fine. The general form is this
repo's own rule pointed at itself: when the instrument and the thing disagree,
suspect the instrument first, and this is the second time in one day that the
harness rather than the product was the bug (the other was `compileMsg`
collapsing two causes into one sentence).

**A PROMISE TO THE MODEL THAT NOTHING EVER COMPILED (2026-08-30, two paid
builds).** The page rules advertise five importable packages. **Fixtures
importing them: 0 of 5. Real generated pages using them: 0 of 324.** All five
were promises nobody had checked, and `three` was simply the first one a model
reached for — it ships no type declarations, `@types/three` was never installed,
and `tsc` refused. **A package-list guard cannot catch this**: `three` WAS in
package.json, installed and present, and still unimportable. Only a real `tsc`
against the real template tells DECLARED from USABLE. And the reachability half
is the general lesson: the 3D field had been dead until that same day, so no page
had ever imported it and the defect could not be hit. **Wiring a feature up is
what makes its defects reachable — a feature that has never run has never been
tested, however green the suite is.** `test/template-deps.test.mjs` and the
`PROMISED_PAGE` fixture.

**A GENERATED PAGE BROKE A KIT FILE IT HAD NEVER SEEN (2026-08-30, the second
paid build).** A model wrote a configurator and declared `validateSearch` with
REQUIRED fields on `/`. In TanStack a route's search contract is part of its
TYPE, so that retyped `/` for the whole app and every `<Link to="/">` in the KIT
stopped compiling — files the model cannot see and could not have fixed. Salvage
rightly refused to stub a foreign file, so the whole build died at typecheck.
**The property is LITERAL vs WIDENED, not `Link` vs anchor**: `to="/"` binds to
that route's generated type, `to={to}` with `to: string` carries no contract —
which is why `SiteLink` was fine in the same program and is correct code a
blanket ban would have flagged. A kit file names a route with `<a href>` (`/` is
the only mount a Start bundle is served at — `test/site-seo.test.mjs`) or with
`SiteLink`. `test/template-links.test.mjs` + the `SEARCHY_INDEX` fixture.
**Two sub-traps hit while writing that guard, both recorded ones**: its first
draft banned both forms and so flagged `SiteLink`; and its comment-blanker
tracked `'` as a string opener, which is right for JavaScript and WRONG for TSX —
`<h1>This page didn't load</h1>` opened an apostrophe that swallowed the comment
below it, so the guard false-alarmed on the three files it had just been written
to certify. **JSX text is not JavaScript.**

**A CI STEP THAT DOES NOT INSTALL WHAT THE TESTS IMPORT — and five commits of
red nobody looked at (2026-08-30).** `site-build.yml` ran two test files under
"both modules are dependency-free, so no install is needed", which was TRUE when
written and false the moment `site-qr.mjs` imported `qrcode-generator`. The step
failed with "Cannot find package"; the same tests passed locally, where the
dependency is installed. **The check and the thing it checks disagreed about the
environment, which is the one disagreement a test cannot report on itself.**
Two habits, both cheap: read CI after a push (five went unread), and never let a
workflow assert a property about the code in a COMMENT — `test/workflow-deps.test.mjs`
now asserts it. Its first draft walked the import graph and false-alarmed on
`import` statements inside STRING fixtures; the shipped version is blunt (every
`node --test` step installs first) because a check that flags correct code is
worse than no check.

**A DIAGNOSTIC FIELD IS NOT A SUBSTITUTE FOR THE ARTIFACT (2026-08-30, run 90).**
`coalhole-1` died in the BUNDLER — `SyntaxError: Identifier 'createFileRoute' has
already been declared. (3:9)`, the model having written the same import twice —
and the page was gone: the container recycled, the answer only ever in a Worker's
memory. Four rounds of the owner asking *why was it repeated* and every answer was
a guess. **`publish-pages.mjs` already said "the pages are gone the moment this
returns" in THREE separate comments**, each one a past session that hit this wall
and bought a narrower field instead of the file — `out.error`, then `out.cited`,
then the `validate` exit keeping `problems`. Three payments for a fraction of one
thing. Now `deps.keep` stores the raw tool payload ONCE, straight after
`generate` and before anything can refuse it — not in the failure branches, of
which there are four plus a throw, because this file's own `settle` comment
already states the rule that a new failure mode is classified in one place rather
than remembered at each call site. Its own R2 key, never `pages.json`: that one is
the revise anchor and is written only on success precisely so a broken answer
cannot become the site's source. `GET /api/site/answer` reads it back
(owner-gated), and `scripts/build-as-owner.mjs` step 5b prints it — **a record
nothing can read is where run 90's page already was.**
**And the ship-it-anyway change does not cover this**: a syntax error is not a
type error. Vite strips types without checking them but still has to PARSE, so a
file it cannot parse yields no bundle at all.
**THE WALL SHIPPED 2026-08-31** — `dedupeImports` in `page-gen.mjs`, called from
`validatePages` for pages AND parts (one program, one failure). It scans the
import HEADER only (stopping at the first thing that is not an import, comment
or blank, so page prose containing the word can never be reached), compares whole
STATEMENTS rather than lines — `  Button,` legitimately repeats inside two
different multi-line imports, and a line-level dedupe deletes it and breaks a
working page — and drops an exact repeat, which is a no-op. `normImport` removes
LAYOUT only (whitespace, a dangling comma, the trailing `;`); name order and
quote style are a stated miss, pinned by a test, because every step from
comparing text to understanding statements is a step toward collapsing two
imports that differ. **0 false alarms over 3,736 real files** (the 324-page
corpus + the 3,412-file kit), which is the bar this repo sets before a check
ships. **NOT a prompt rule**, and the owner asked directly: the prompt does not
contain that import line at all, so forbidding it means writing it down (the
"prose contains the thing it forbids" trap), and runs 84/85 already measured what
a rule buys — the signature list said `Figure` took no children, the model passed
children anyway, the directive was rewritten in between, and run 85 read past
that too.

**A HARNESS THAT PASSED WITHOUT TESTING ANYTHING (2026-09-01, the first paid
canary).** `edit-canary.mjs` POSTed the paid edit with `layer: ""` and got a
complete, clean round trip: **202 in 1.0s, queued, claimed, replayed, terminal
in 7.9s**, `billing: none`, `cost: 0`, ledger empty, balance unmoved at 309,
site's `x-site-build` unchanged. Every one of those readings is what a healthy
async path looks like, and **not one model call, lane, compile or publish had
happened** — the edit route does not decide its own layer, `/api/site/route`
does, and an edit posted without one matches none of the nine branches and falls
through to `escalate("layer")`.
**This is the wiring trap seen from the CALLER's side, and worse than the usual
shape because the missing hop wore the costume of success.** The edit route's
own `layer:` field carries a comment about that same field being dropped from
the ROUTE's response — the identical cut, one hop upstream, recorded as the
tenth instance. The harness simply never made the call that produces it.
**The general shape: a green harness proves the path it took, not the path you
meant.** The fix is a refusal, not a fixture — the canary now routes first and
**refuses to spend** when the router names no layer, because the danger is that
a blind post PASSES. And a terminal answer is no longer a pass: the verdict is
`ok: true`, since an escalate is a legitimate product answer and a failed
canary.

**AND THE DEFECT UNDER THAT ONE WAS BIGGER: THE CLIENT NEVER TERMINATED ON A
QUEUED JOB THAT PRODUCED A REPLY (2026-09-01, live behind the canary flag).**
A finished job hands back its STORED REPLY — the same object the synchronous
path returns, which the poll route's own comment calls "one object, reached two
ways" — and that object has no job-state field, because it never needed one. So
`classify(body.status)` answered `running` on every completed edit, and the
`wait` branch has no attempt bound: the browser polled a finished, charged,
PUBLISHED edit for ever behind a spinner. Every queued success and every queued
escalate; only the outcomes that store NO reply — lost, cancelled — terminated
at all. Driven and confirmed against both real stored bodies.
**Neither the body nor the status could carry the distinction.** The body is the
synchronous reply unchanged, and changing it breaks the property that makes the
rollback safe. The status is the stored reply's own — 200, 422, 503 — while the
poll route has its own 503 for a row it could not read, so by number alone a
stored 503 is a transient one and gets retried until the client gives up. So it
is STATED: `FINAL_HEADER`, set on that branch and nowhere else, and `readPoll`
with its four cases in a stated order.
**The general shape, and it is the wiring trap inverted**: the producer was
correct, the consumer was correct, and the two disagreed about *which of them
was speaking*. When one endpoint answers in two voices, the voice has to be on
the wire — inferring it from the payload works until the payload is something
you did not write.

**AND ONE HOP OVER FROM THAT: A QUEUED ESCALATE RENDERED AS "✅ Done."** The queued reply body
IS the synchronous one — the consumer stores exactly what the route returned —
but only the synchronous path ever read it. `watchEditJob` applied every
terminal answer as an outcome and `editReply` ends `return '✅ Done.'`, so a
queued edit that could not be made told the customer it had been, bumped the
preview to show an unchanged site, and **never ran the revise that is the whole
safety argument for trying a cheap rung first**. Doing less than they asked and
reporting success, which is the failure the edit path is written to avoid.
Fixed with ONE decision both paths call: `EditPoll.escalateAction` answers
`hop` / `up` / `lost`, and `chat.js` acts on it — the decision in the module a
test can drive, because chat.js cannot be imported and "cheap thing or
expensive thing" is a question about money.
**Its third answer is the one that had no name before**: a watch resumed after a
refresh holds the job id and nothing else, so falling through to `fallback`
there would start a ~25-credit rewrite on page load for a sentence nobody
re-typed. (`resumeEditJob` has no callers today — said out loud rather than left
to be found, since wiring it starts real behaviour on page load.)

**AND A THIRD IN THE SAME TAIL: `apply()` BUMPED THE PREVIEW AND NOTHING ELSE.**
The synchronous success path also drops a DELETED PAGE from the site picker and
remembers — or clears — the undo rows. The queued copy did neither, so a queued
`page` edit left a deleted page on offer, and a queued `data` edit stored no
undo and never cleared a stale one from an earlier synchronous edit: a standing
offer to re-add a row that is already back. **Three defects in one duplicated
tail, none of which fails, logs, or is visible until a customer deletes
something.** All three are gone because the tail is one function now
(`editAnswer` + `applyEditResult`), which is what "two lists of the same thing"
has been saying all along.

**A KEY WHOSE INVARIANT EXPIRED WHEN THE LAYER BELOW IT MOVED (2026-09-01).**
The idempotency key was minted per ASK, and the sideways hop deliberately reused
it — correct while an escalate created nothing on the server. The queue ended
that: `edit_create` keys on `(uid, slug, op, idem_key)` and **the layer is not
in it**, so a hop carrying the first key does not file the cheaper job at all —
it matches the row that just escalated, comes back `duplicate: true`, and the
hop silently becomes a no-op. Now one key per SUBMISSION, `handedOff` bounding
it at two. This repo's own "a rule true because of a layer below it expires when
that layer moves" trap, and **the guard that should have caught it passed
vacuously**: `lastIndexOf("if (!handedOff) {", mint)` finds the guard whether
the mint is inside it or a hundred lines below, so `guard < mint` was true
either way. Anchored on the guard's CLOSE now. A placement check that cannot
observe placement is worse than none.

**A KILLED SWEEP LEAVES A LIVE MUTANT — and the rule two sections up says so
(2026-09-01, hit anyway).** The restore sat at the end of the run function, so a
2-minute tool timeout mid-suite left `escalateAction`'s `hasAsk` gate deleted in
the tree. Caught only because the guard written for it was failing, which is the
good outcome and not a plan. **Put the restore on a `trap … EXIT INT TERM HUP`
and run the sweep in the background**, where nothing can time it out.

**`supabase/applied/` IS NOT THE RECORD OF WHAT IS LIVE (2026-09-01).** Four
migrations applied earlier that day — phase stats, phase write, the sequenced
reserve, finalize-always-stores-result — were never written to the folder, and
the reserve fix was edited into `110952` in place. Rewriting `edit_finalize`
from the folder's text silently dropped the always-store-result behaviour, and
only the committed DB check (FAIL 9b) noticed, minutes later. **Before
redefining any RPC, read it out of the database** (`pg_get_functiondef`), not
out of this folder; a live snapshot of every `edit_*` function now sits beside
the migrations for exactly that reason.

**AN OK ANSWER WITH NOTHING TO PUBLISH HAD NO TERMINAL STATE (2026-09-01,
the second lane sweep).** "Your site already looks like that — nothing to
change" is `ok: true` with `moved: []` and no publish, and the consumer's
`shipped` read it as shipped: `edit_finalize` refused it (`published_at` null),
the `!shipped` refund branch was skipped, and the job sat non-terminal until
`edit_sweep_lost` declared it **lost and refunded it** ~150 s after a 22 s
answer. The poll route hands back a stored reply only once the state is
terminal, so the customer waited the whole 150 s for a sentence that was ready
at 22. Found because the sweep asked for a heading that was already dark red.
**Fixed at the RPC**: `edit_finalize(p_id, p_result, p_ok, p_mint)` finalizes
an ok answer when publishing never BEGAN; the mid-publish ambiguity
`needs_review` exists for is untouched, and the old three-argument form stays
as a wrapper (`p_ok := false`) so the Worker running before the deploy keeps
working. Billing follows the synchronous path: the reserve stands.
**The general shape**: a state machine with a terminal state only for "shipped"
and "failed" has no name for "answered, nothing to ship", and the nameless case
falls to whichever sweeper finds it first.

**A ZERO-COST RUNG CANNOT PUBLISH THROUGH THE QUEUE, AND THE REFUSAL WEARS
THE COMPILE'S SENTENCE (2026-09-02, run 10, the logo lane).** The consumer
reserves credits when a rung first reports model usage; a rung that makes no
model call never does, so its job's `billing` stays `none`. `edit_may_publish`
— the last check before anything is written — grants only `reserved` or
`exempt`, so it answered `unbilled`, the spine returned `not-granted`, and the
logo lane's own catch, written for a compile that failed, told the customer
*"That didn't compile, so your site is untouched"* while the container had
just compiled it. Two traps in one: a gate written for the paid rungs
disqualifying the free one (the `look`/`logo` `no-backend` gate, one layer
over), and a failure that cannot name itself — `detail: "unbilled"` was on
the wire and the sentence collapsed it. **FIXED THE SAME NIGHT**, as a state
rather than a looser gate: `edit_exempt` (migration `20260902034000`, read
back into the live snapshot) marks a `none` job `exempt` for the consumer
that holds its lease and refuses a job that has in fact reserved (`billed`);
the job context counts successful reserves (`noteReserve` / `reserves()`);
the spine exempts a zero-reserve job immediately before `edit_may_publish`;
`not-granted` is now `ours: true` and `compileMsg` names the gate's reason.
Section 16 of `scripts/edit-rpc-check.sql` drives it (7 checks, and its first
draft filed the free job on a slug section 15 had just put under review — a
site under review takes no new edits, so every check read `no-job`).

**A PUSH TO MAIN ROLLS THE CONTAINER UNDER WHATEVER IS RUNNING (2026-09-01,
the first lane sweep).** Two pushes that touched only `scripts/` and `test/`
each ran `deploy.yml`; the second finished at 20:30:16 and the sweep reached its
fourth lane at 20:32. `description` waited the full **600 s** container cap on
an instance being recycled and died "aborted due to timeout"; `wordmark` got a
plain-text `Container …` body and died on a JSON parse; `favicon` at 20:47 got
the warm new instance and passed. Both refunded correctly, both reported as
"didn't compile" — `compileMsg` again, with the truth sitting in `detail`.
**The deploy rule above says "a push that touches `builder/`"; it is every
push.** Never push while a live run is in flight, and after any push wait
15–20 minutes before firing anything that needs the container.

**Re-run the thing the change is asserted by.** Appeasing a false alarm in one
checker while never re-running the harness that actually proves the change has
shipped red twice.

**`unit tests` WAS RED ON EVERY PUSH TO MAIN FOR A DAY AND NOBODY READ IT
(2026-09-02, FIFTEEN runs, 12:25Z to 20:20Z — the fix's own commit message
says four, which was the count before the whole history was read).** The
`action` lane's corpus guard
(`test/site-nav.test.mjs`, "applyAction over the whole corpus never writes a
page TypeScript cannot parse") required the KIT's TypeScript — resolved from
`builder/lovable/template/` — and CI's `npm ci` installs the ROOT's
dependencies only, so the guard failed in CI on the day it shipped and on
every push after, green locally every time. The recorded "CI step that does
not install what the tests import" trap, on a guard written the same day as
the fix for it, and the recorded "read CI after a push" habit, skipped four
times. Fixed by declaring `typescript` at the root (the version the template
resolves) and letting the guard take either copy — it still REFUSES to skip,
because a corpus scan that never runs in CI proves nothing there. Proven by
hiding the template's copy and running the guard on the root's. **Read the
`unit tests` run after every push; a red one is a day of pushes shipping
unchecked.**

**The container harness sees what the unit suite structurally cannot.** A CSS
change, a compiled stylesheet, a rendered head, a real PNG's dimensions — all
invisible to a source read. `site build` is the strongest free signal here.

**A guard watching the layer below the break.** It asserts the plumbing and not
the connection: "the query selects the column" while nothing carries it onward.

**A gate that outlives its reason, guarding a dependency the code no longer has.**
The `look`/`logo` lanes refused any site without a database long after the
stylesheet moved to R2 and first builds stopped provisioning one — so the gate
protected nothing and disqualified the majority case. Two tells, both present:
the requirement was never *used* (the connection was passed only to a function
that guards it), and **the fix for the very same symptom sat unreachable below
it** — `!priorLook && !priorCss` exists so a thin-look site is not escalated, and
no databaseless site ever got that far. When a gate and a later accommodation
address the same complaint, one of them is dead; find out which.

**Vacuous ordering.** `indexOf(a) < indexOf(b)` passes when `a` is the thing
deleted (-1 < anything). Prove both anchors exist first.

**One prompt written for two jobs, where the second has to argue with the first.**
`design_schema` was shared by the build and the `look` edit, so a customer's
colour change was sent "ONLY WHEN ASKED… OMIT this field entirely unless" — the
right instruction for a first build and, on an edit, a plain "don't touch the
stylesheet". The fix at the time was to make `EDIT_RULE` **name that clause and
overrule it**, which works and is a tell: a prompt that has to quote and reverse
another prompt in the same call is two jobs wearing one tool. Split them.
Measured when they were: 84,817 characters of tool down to 4,012, and the
overruling paragraph simply deleted. **When two callers need opposite framings of
the same field, the field is not what they share — the SHAPE is.**

**A guard that goes red for the change rather than for a bug.** Four fired at
once on this split, all of them pinned to a spelling rather than a property: an
import list asserted as exactly two names (an honest third arrived), a count of
`designSiteSchema(` call sites, a floor of "two designer assignments" when one
stopped being a designer's, and `css: priorCss,` as the only shape a stored sheet
may reach a model in. Each reported a feature as broken that was working. The
tell is that the failure message describes something nobody did — re-anchor,
don't appease, and **say in the comment which spelling moved and why**, or the
next session re-pins it.

**A read whose only consumer went, and the query stayed.** The look lane kept
`SELECT v FROM _meta WHERE k = 'schema'` to hand the DESIGNER a table list; when
the designer left, the round-trip stayed — on every colour change, feeding a
parameter that no longer existed. Nothing fails, nothing logs, the bill is a
Postgres call per edit. **When you delete a consumer, grep for what fed it.**

---

**TWO NULLS THAT MEANT DIFFERENT THINGS, AND A SLICE ON `undefined` (2026-09-02,
the `action` lane, two paid runs).** `readAction` answers null for a header
with no button AND for a header whose button is COMPUTED — a label or href
that is an expression. `applyAction` keyed "is there a button" on that one
null, so a computed button took the INSERTION branch, which has no
`insertAt`, and `src.slice(0, undefined)` is the whole file: the page came
back as itself, then the attribute, then itself again, and vite said
`Unexpected token (181:9)` — line 181 being the first line after the page's
last. **Found deterministically**: drive the writer over the 332-page corpus
and PARSE every result with the template's own TypeScript. One page broke,
`marketplace/index.tsx`, the exact shape of fretwork-1's header. That audit is
`test/site-nav.test.mjs`'s corpus case now, and it is the reusable part — a
writer that emits source is proven by parsing what it emits, over every real
page there is, not by reading the writer. The same audit over the picture
scanner found the `images` failure without a model call: 0 slots on a site
whose main photograph is a component prop. **When a lane fails live, drive
its module over the corpus before buying a second run.**

**A DROPPED FIELD HAS A TWIN ONE HOP OVER (2026-09-02, the `tsx` lane).** The
page rung read `pages` off `validatePages` and dropped `parts` — the wiring
trap, ordinary. Fixing that hop exposed the next: `publishStep` rebuilds
`pendingPublish` from the LAST rung's args, so "add a component and change
the button" would have handed the spine the nav rung's args and the build's
stored parts, and the page's import would not compile. `renamed` already
accumulated across rungs for the same reason; `parts` now does too. **When a
value is added to a chain that collects across steps, check every collector
on the chain, not only the producer** — the collector was written before the
value existed and cannot know to keep it.

**A DIGEST THAT REPORTS A COMPUTED VALUE AS ABSENT (2026-09-02, run 11, the
`action` lane, live on fretwork-1).** `readAction` answers null for the
whole button when EITHER half is an expression — right for the writer,
which must not rewrite an expression as text — and `navDigest` read that
null as "(there is no button)". Asked to change the WORDS of a button whose
words are computed and whose link is a literal `tel:`, the model wrote a
new button and had to invent its link: `/`. The site's one working control
became a link to itself, on a request about wording, and the reply said
"The button now says…". Nothing failed. **Two nulls that mean different
things is the `action` trap one entry up, now on the READ side**: "cannot
read this" and "there is nothing here" reached the model as one sentence.
`knownAction` carries each half as it stands (`null` = computed, `""` =
absent, a string = the text), and the digest states both and tells the
model to keep the half it was not asked about. **The general shape: when a
reader answers null for "unreadable", check what every consumer says out
loud for that null** — a writer that skips is safe, a prompt that says
"absent" is not.

**A MUTANT WHOSE ANCHOR IS A SUBSTRING OF ANOTHER'S (2026-09-02).** The
sweep's ambiguity check (`indexOf !== lastIndexOf`) refused a mutant whose
8-space-indented line was contained in its 14-space twin — correctly, and
it read as NEVER APPLIED until re-anchored on the preceding line. The
mirror trap ("a mutant that never applied") says verify by checksum; this
one says **anchor on enough context to be unique, and when two sites share
a shape, mutate each with its neighbour in the anchor.** And the obj-form
twin of that mutant SURVIVED for a real reason — the guard drove only the
JSX form — which is the "a negative assertion must prove its observer is
alive" trap for a positive one: a guard proves the branch it drives.

**A NAME THE HARNESS DID NOT KNOW WAS DROPPED WITHOUT A WORD (2026-09-02,
run 16).** The lanes box said `kind,slug.` and `chooseLanes` filtered the
list down to the names it knew, so the run was `kind` alone, ended green,
and the rename never happened. Run 9's `gap ` one input over — and the one
input that costs nothing to get wrong is the one that decides what the
money buys. A stranger now REFUSES before sign-in, naming itself and the
real names; punctuation at the ends of a name is forgiven; both harnesses,
because the workflow feeds one box to both. **A filter on a person's input
is a silent drop; a check is a sentence.**

**THE RENAME'S CANONICAL HOP — READ, CERTIFIED, NEVER WIRED (2026-09-02, run
17).** `test/site-alias.test.mjs` had a case called "THE CHAIN" whose hop 4
asserted the rename branch calls `publishStep`, and it did. What a source read
could not see: the spine's `url:` handed `siteUrlFor` the STORAGE slug, so the
republish rebaked the old address, and `publicNameFor` — written for exactly
this — had no consumer anywhere. The harness's check read both addresses and
never the head, so the one live proof passed on the half that worked. The
`site-marks` shape again: **a chain asserted by reading is asserted at the
layer below the break.** The guard now drives the route and reads the sidecar
write, and the harness reads the canonical at the new address.

**A SECOND ROUTE UNDER THE SAME WALL, AND THE FORK WAS BUILT ON ONE
(2026-09-03, run 21).** The edit path left the customer's connection on
2026-09-01 because a synchronous edit is reset at ~273s. The reasoning was
written on the edit route, the fork was built on the edit route, and the
addon route — same connection, same wall, LONGER work — stayed synchronous.
The first addon ever fired on the live site died at 257.6s with `ECONNRESET`,
which is the wall (the probes measured 273–300s; it is a range, not a
number). Nothing failed inside our code: the isolate kept running and the
reply had nowhere to go, so from outside it was `NO ANSWER` and a site that
did not move. **When an infrastructure limit is found on one route, list
every route that runs under it before fixing one.** The tell was in the
tree the whole time: the addon harness's own `node:https` comment said "an
addon outlives 300s" while posting synchronously to a route that could not.

**A FREE IDENTIFIER THAT HAPPENS TO BE DEFINED SOMEWHERE ELSE IN THE FILE
(2026-09-03, run 22).** The harness's `watchJob` was lifted to module scope
so two callers could share it, and kept reading `TOKEN` — a local of
`main`, where the inline loop it replaced had lived. `node --check` passes
(a free name is legal), the guard read the function's text and found every
landmark, the sweep killed every mutant, and the first real call threw
`ReferenceError` five seconds into the run. **A function moved out of the
scope it was written in must be DRIVEN once, with its inputs handed in**;
a text read cannot see scope. The fix shape is the parameter, and the
guard is the call.

**A MODULE THE CONTAINER IMPORTS AND THE IMAGE DID NOT CARRY (2026-09-03, the
QR list).** `site-qr-list.mjs` was written dependency-free precisely so the
container could import it; `build-server.mjs` imported it; every guard on the
container's write loop passed by reading the source; and the Dockerfile's COPY
line did not name it. The image would have built, the service would have died
at import with MODULE_NOT_FOUND on the first build after the deploy, and the
customer would have read it as *"our build service was restarting"* — the
sentence that has already hidden two other causes. `test/dockerfile.test.mjs`'s
transitive import walk (written 2026-08-20 for this exact shape) went red in
the same suite run. **It is the one guard here that compares the consumer's
ENVIRONMENT with the code**, the CI-install trap's lesson one layer down: a
new import in a container module is a new name on that COPY line, and only a
check that derives the list from the imports notices. The source reads in
`site-marks` and `site-qr-list` could never have.

**A CHECK THAT REPORTS IS ONLY AS GOOD AS ITS READERS (2026-09-04, run 34).**
The render check opened every route of the gear addon, saw seven throw, and
said so — in `render.findings`, in `renderNote`, in the customer's reply. The
publish shipped it (the ship-it rule), which is a decision; the harness
called the case `ok` and took a screenshot of the error card as its proof,
which is not. A report nobody acts on and nobody reads is a page that is
down with a receipt. **When a check is report-only, list its readers**: the
customer (the reply sentence), the harness (a verdict), the repair pass (the
build had one; the addon got it the same day — the entry in the ADD
section). Each missing reader is a way the finding ships silently. And the cause was a kit primitive that THROWS when
used outside its nesting — the `Figure` shape: a rule the signature list
cannot express is a rule the model will break, so the obvious use is made to
work rather than described.

## Backlog

- **`three` is done** (2026-08-30) — the entry above records what it cost.
- **The availability calendar's own legend (open, live on `fretwork-1` since
  run 16).** `availability-calendar.tsx` prints "Each square is the night
  beginning on that date… Prices are per night for the whole property" —
  written for a self-catering let, now on a guitar diary. The model reached
  for the component and did not override the copy. A legend the model must
  answer, or one that says nothing about the trade, fixes the class; a
  firmer sentence does not.
- **The price-unit mismatch (open, live on `ashgrove-1`).** A kit component
  documents "integer minor units"; the model feeds it major-unit database rows,
  so one control says £16.40 and the total says £1880.00. See the trap entry.
  A branded type or a `deltaMinor` prop name fixes the class; a firmer sentence
  does not.
- **The raw-hex-colour finding (open, THIRD run running).** Runs 80, 82 and 83
  all reported it — run 83's was `index.tsx: writes the raw colour "#e7e3db"`.
  Detected and reported on every build, never enforced, so it ships every time.
- **The dead-control finding (open).** On `northgroup-17` the stage filters,
  "New deal" and the deal rows are all `<a href="#pipeline">`, and 15 of 24
  in-page links point at the section they already sit inside — dead by
  construction, while the reply claims the filters run. A lint for a control that
  goes nowhere is the next thing.
- **`env.EMAIL` daily quota is 200** across login codes AND every site's booking
  notifications. Worth watching, not yet a problem.
- **Scheduled-jobs tier — FIXED 2026-09-03** (owner: *"go"*). 26 jobs registered,
  zero sends ever: three deps of the runner read `siteNeonProject` (the Neon
  PROJECT ROW) where the DATABASE CONNECTION was wanted, so the schema read as
  empty and every job wrote "this job is no longer part of the site". All three
  read `siteBackendBySlug` now, in ONE `jobDeps` shared with the owner's
  "Run now". A site with no mail key in Secrets still sends nothing and says so;
  the 26 registered jobs run for real from the next deploy. **Not proven live.**
- **Static voice previews** — the owner drops MP3s at `public/voices/<name>.mp3`.
- **Real background removal** — needs a fal utility wired as an orchestrator step;
  blocked on a fal top-up.
- **fal balance is empty**, so no generated photograph has ever been bought on a
  site. Every `SafeImage` on every published site draws its placeholder.
- **Mobile layout for the app is deliberately NOT being done** (owner's call,
  desktop-first).
