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
- **`qr`** (2026-08-29, owner: *"qr code maker as optional"*) — `{ points, label
  }`, both required. **We draw it, the model never does**: a QR is Reed-Solomon
  over a spec with 40 sizes and 8 masks, and its failure mode is a code that
  looks perfect and does not scan — unfalsifiable by every instrument here except
  a phone. `qrcode-generator` (one file, no deps) is bundled into the Worker;
  `qrSvg` emits ONE `<path>` merging horizontal runs (**4,206 chars vs the
  library's 8,464** for a real URL). Generated at build time from the two stored
  strings, never stored as a picture — a stored SVG would be a second copy of
  `points` that can disagree with it. `test/site-marks.test.mjs` re-derives the
  module set from the emitted path and compares it against the library's own
  `isDark`, which is the only ground truth available without a camera. The
  payload is held to real business schemes; `javascript:` and `data:` are refused.
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
  table designed for it is a named 422, not a climb.
The lane sweep's asks changed to match: `qr`, `three`, `tsx`, `components`
now EDIT what fretwork-1 has (a caption, the pick's speed, the chord-diagram
component, the accordion swapped), because "Add a QR code…" is an addon ask
and the harness posts straight to the edit route. Sweep: **23 mutants, 23
killed, control survived** — two needed a guard that reads a call's own
`if (` rather than its position, since `if (false)` leaves the call exactly
where a position check looks for it. **The addon step has NOT run live on a
database-less site yet**; a gap case for it is ~25 credits, owner's call.

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
sidecar at publish time, so **a rename republishes** or the site tells every
crawler its real address is the old one.

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

**Still mixed, and next: the ADDON step**, which calls `designSiteSchema` with the
same 84.8k build tool to add one page. **DELETE deferred** (owner's call).

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
- **Balance: 255 credits** (read from the ledger 2026-09-02 03:20, after run
  10). It was **0** on 08-29;
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
- **`site build` is 310/310** against the real container; the unit suite is 4,576.
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

## Backlog

- **`three` is done** (2026-08-30) — the entry above records what it cost.
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
- **Scheduled-jobs tier**: 26 jobs registered, zero sends ever — three call sites
  pass a Supabase ROW where a connection string is wanted. Not fixed deliberately
  (fixing it starts 26 real senders; owner's call).
- **Static voice previews** — the owner drops MP3s at `public/voices/<name>.mp3`.
- **Real background removal** — needs a fal utility wired as an orchestrator step;
  blocked on a fal top-up.
- **fal balance is empty**, so no generated photograph has ever been bought on a
  site. Every `SafeImage` on every published site draws its placeholder.
- **Mobile layout for the app is deliberately NOT being done** (owner's call,
  desktop-first).
