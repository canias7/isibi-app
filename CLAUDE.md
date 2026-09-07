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
- **R2** — everything that is not rows: `builds/<slug>/<version>/` (every
  publish since stage 7, immutable: the dist under `client/`, the script as
  `server.js`, the state under `state/`, the manifest last), `current/<slug>.json`
  (the ONE mutable pointer: which build is live), `sites/` (the legacy served
  prefix — frozen for a site until its next publish, and still where
  `site.live` and the early placeholder live), `source/` (page source),
  `uploads/`, `versions/` (the legacy copy archive), `backups/`, `sitemeta/`,
  `config/`, `orphans/`, `jobs/`.
- **Media Agent** — Instagram/YouTube manager via Composio. Read + comment
  auto-reply live; DM auto-reply blocked on Meta App Review. Details in
  `docs/media-agent.md`.
- **Universal memory** — auto-learned creative taste applied to every media
  generation. Backend only, no UI, deliberately.

## Deploy

Push to `main` → GitHub Actions → Wrangler → Cloudflare Workers → gofarther.dev.
**A CONTAINER IMAGE IS BUILT ONLY WHEN ITS INPUTS CHANGED (2026-09-04, owner:
*"Ok yeah lets do that"*).** `.github/scripts/container-images.mjs` runs
before the Wrangler step: for each container whose `image` is a Dockerfile
path it hashes the git objects the Dockerfile COPYs (plus the Dockerfile and
its `.dockerignore`) into a 16-hex id, builds and pushes
`isibi-app-<class>:<id>` only when the registry lacks that tag (once more on
a failure — the registry's 500s are what failed two deploys on 2026-09-04),
and rewrites the CHECKOUT's `wrangler.jsonc` to reference
`registry.cloudflare.com/<account>/<name>:<id>` — the FULL reference, the
account id off the step's own env: **deploy run 2016 (12:22Z) built and pushed
the site image and then refused the config**, because Wrangler's validator
(`isDockerfile`) parses a non-file image with `new URL("https://" + image)` and
a bare `name:tag` is an invalid URL, the tag reading as a port. (Its deploy-time
`resolveImageName` WOULD have expanded a bare name — the validator runs first.)
**THE REGISTRY IS ASKED FOR THE TAG BY NAME — a HEAD on its manifest**
(`/v2/<account>/<name>/manifests/<id>`) with a five-minute pull-only credential
minted through the account's containers API, the way Wrangler's own `images
delete` finds one. NOT `wrangler containers images list`: that fetches ONE page
of the catalog (`/v2/_catalog?tags=true`) and never the next, and on deploys
2017 and 2018 its answer was three repositories — the site image's ABSENT,
though pushed three times and referenced by the deploy, and the game
repository's tags the old eight-hex ones only — so both images were rebuilt
on every deploy: 4m18s and 4m31s instead of 15 minutes, and never "reused".
A registry that cannot be asked (anything but 200 or 404, or a credential it
will not mint) BUILDS and says so in the log, because a build is always right
and only slow and a wrong skip ships a stale image.
**A deploy that references an image builds nothing and rolls nothing unless
the reference moved.** MEASURED on deploy 2018: both images rebuilt under
their unchanged tags, and Wrangler's container deploy answered "no changes"
for both apps — a rebuild under the same tag rolls nothing; the roll is decided
by the reference, which moves only when an input changed. The repository's own
config keeps the Dockerfile paths and never carries the account's registry
path, so a hand `wrangler deploy` behaves as it always did.
**What rolls the container is a change to an image INPUT — and SINCE
2026-09-05 THE WORKER'S OWN MODULE GRAPH IS ONE.** The site image carries
`worker.js` and every module it imports as the job runtime (task #93, the
section "THE JOB RUNS INSIDE THE SITE'S CONTAINER"), so a push that changes
`worker.js`, `site-add.mjs`, `edit-job.mjs`, `page-gen.mjs` or any of the
115 files in that closure rebuilds the image and rolls the container, exactly
as a change to the Dockerfile, `.dockerignore`, `lovable/template/` or
`theme-candidates/` always did. What still reuses the image: a push that
touches only `docs/`, `test/`, `scripts/`, `public/`, `supabase/` or the
workflows. After any code push, wait **15–20 minutes** before firing
container work that must run the new code (an instance started seconds after
"deploy completed" is still on the previous image). Between 2026-09-04 and
2026-09-05 a Worker-only push rolled nothing; that property was traded for
the runner, knowingly. Measured
before the change: 14 and 15 minutes per deploy, on pushes that changed
nothing under either Dockerfile. **The base image is not an input**: an
upstream `node:22-slim` update reaches the image only when something here
changes; to force a rebuild, change the Dockerfile (a comment is enough).
`test/container-images.test.mjs` drives every decision and the flow with
fakes, and reads the wiring (the step between the queue check and the deploy,
the two Wrangler versions equal, no `images list`, the probe handed in with
the step's token, one credential per run). Sweep of the probe: **23 mutants,
23 killed, none unapplied, the comment-only control survived** — a 404 read
as present, a 200 as absent, an unknown answer as either, the manifest
fetched whole, the credential or the Accept dropped, the account off the
path, a push or a day-long credential, the bearer dropped, a refusal
unnamed, the wrong API route, the Basic user wrong, an empty token
accepted, an unknown answer skipping the build, a throwing probe escaping,
could-not-tell silent, a 404 said as unasked, the answer off the log, the
retry dropped, the probe not required, a credential per image. **BOTH HALVES PROVEN LIVE.** Deploy 2018: "no changes" on a rebuilt tag
(the roll). Deploy 2019 (13:33Z, the first with the probe): `reused` for both
images, the registry answering 200 to each HEAD, the image step 1.4 s, the
whole deploy **47 seconds** (14–15 minutes before the skip, ~4.5 with the
listing), "no changes" on both container apps. A docs/test-only push is a
one-minute deploy that rolls nothing; a push that changes an image input —
which every Worker code push is since 2026-09-05 — builds, rolls, and needs
the 15–20 minute hold: **3m09s measured on deploy 2029**, the image step
2m20s with every layer rebuilt (the first build off the root context); a
later push that changes only the worker tree should reuse the apt and
template layers and come in under that — measure it, do not assume it.
**MEASURED on deploy 2030 (2026-09-05 23:35Z, the merge of stages 1a–3b
and 8): the image step 2m33s, the whole deploy 3m28s** — NOT under 2029's
2m20s, and that push changed the Dockerfile's own COPY line (two builder
modules added), which is a layer input; the first push that changes the
worker tree and nothing above it is still the measurement to take. The
step's line: `built isibi-app-sitebuildcontainer:e86…54e47 (registry
answered 404; 155 inputs off ./Dockerfile)`, then `EDIT` on the app.

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
(`site_rebuild`, no credits — **a few at a time, side by side, since
2026-09-04**: `site-rebuild.mjs` `BATCH` was 1 because "the build service is
`oneAtATime` for the whole platform", a reason that expired on 2026-08-25 when
every site got its own container lane, and nothing announced it — the recorded
"a rule true because of a layer below it expires when that layer moves" trap,
found by the capacity review: 30 sites an hour, so 1,000 sites in 33 h and
100,000 in 139 days. Now 8 per two-minute tick and `drainRebuild` runs the
rows CONCURRENTLY, each chain its own promise settling into one summary —
concurrent because eight in series is sixteen minutes and a cron invocation is
dead at fifteen; the claim covers the overlap as before, and the only edit that
waits behind a rebuild is an edit of the site being rebuilt, exactly as at 1.
240 an hour, 5,760 a day; a batch size, raise it once a real platform-wide
republish has been measured. **AND SINCE 2026-09-06 (stage 9) THE TICK ONLY
FILES**: each due row becomes an edit job for the site's owner, run by the
ordinary consumer in the site's own container, and the drain reads the job's
answer on a later tick — so the batch is no longer bounded by the cron
invocation at all, and a rebuild gets the lease, the deploy gate and the
sweeps every other job has. `test/site-rebuild.test.mjs` drives the
concurrency — every rebuild of a tick started before any returns — and the
per-chain isolation; the two guards that pinned `BATCH === 1` and its reason
were re-anchored. Sweep 8/8, control survived; suite 5,045. Not proven live:
the next platform-wide republish is the measurement).

- **EVERY PUBLISH IS IMMUTABLE AND THE SCRIPT READS ITS OWN PREFIX (2026-09-05,
  stage 7 of the architecture plan, owner: *"ok go"*).** A publish used to write
  its dist over the ONE served prefix (`sites/<slug>/`), sweep what it did not
  write, upload a script that named that prefix, and roll back by copying an
  old dist over the same keys — two writers to one address, and every failure
  under it was a window (a script ahead of its files 404ing every stylesheet,
  a mid-session visitor asking for a chunk the sweep took, a rollback half
  copied, a job dead between the files and the script). Now
  `site-builds.mjs` (root, dependency-free, driven with a fake R2 that keeps
  etags and honours `onlyIf`): every publish is STAGED under
  `builds/<slug>/<version>/` — `client/…` (the dist, sitemap and robots and
  card included), `server.js`, `state/{pages,parts,config,sidecar}.json`, and
  `manifest.json` LAST so a prefix with one is whole — and ACTIVATED by one
  write of `current/<slug>.json`: `{version, build, parent, job, activatedAt}`.
  The version is minted by the Worker BEFORE the compile (`mintVersion`, the
  14-digit-plus-tail id `site-versions.mjs` always used), sent in the container
  payload and baked as `SITE_VERSION` beside `SITE_BUILD`; the script's asset
  branch reads `builds/<slug>/<SITE_VERSION>/client` and answers
  `x-site-version`. **The order is the safety argument**: compose (sitemap,
  robots, the sidecar — a read of the previous sidecar for the redirect map,
  nothing written live) → stage (additive; a gate that refuses or a job that
  dies leaves the live site as it was and a prefix the cap prunes) → the gate
  (`edit_may_publish`, unchanged) → activate: the pointer, CONDITIONAL on the
  etag read after the gate (a stale holder answers `superseded` and touches
  nothing — the wall stage 6 will also lock in Postgres), then the sidecar
  (before the script, so a new isolate reads the new head), the live marker
  at its old address `sites/<slug>/site.live` (where every script, old and
  new, probes), the script, the commit (`edit_committed`, only once the script
  is up), and the state copy into the editable locations (best-effort; the
  site is live). A failed script upload leaves the pointer ahead of the live
  script and does NOT commit: the state stage 3b's reconcile reads. **THE
  POINTER IS `current/<slug>.json`, NOT THE PLAN'S `sites/<slug>/current.json`**:
  that prefix is served verbatim by every script built before this (the file
  would be fetchable) and is the prefix the legacy sweep wipes. **The legacy
  prefix is FROZEN**: a script with no `SITE_VERSION` reads `sites/<slug>/`
  for ever, so a version-aware publish never writes or sweeps it; it stays
  as it was until the site's next publish uploads a version-aware script.
  **ONE FALLBACK HOP, BAKED**: `SITE_PARENT` is the pointer's version when
  the build started; an asset the own prefix lacks is tried once against the
  parent's prefix (or `sites/<slug>/` when there is none) — the in-session
  grace `site-sweep.mjs` gave by deferring deletes, as a read — and pruning
  (`MAX_VERSIONS` prefixes) never takes the pointer's version or its parent.
  The platform's own readers resolve through the pointer (`sitePointer`, 30 s
  per isolate, cleared by activation and delete): the fallback serve path,
  which answers `robots.txt` and `sitemap.xml` on every request and the rest
  when the script is absent, and the card lookup. `listVersions` and
  `listBuilds` merge (`mergeVersions`, newest first, `layout: "build"` on the
  new rows); **`restoreVersion` is the ONE restore for both layouts**: a
  build-layout version is an activation (its own `server.js`, its sidecar,
  its state copied back — the config's baked fields merged over what stands
  through `withConfig`, so `verify` and `share` survive; answers
  `activated: true`, which `putBackOnline` reads as the script being up), a
  legacy one is `rollbackVersion`'s copy path with the POINTER DROPPED (the
  site is back on the legacy layout the old script reads). Delete takes
  `builds/<slug>/` and the pointer; the gateway wall admits `builds/<slug>/`
  and `current/<slug>.json`; the Dockerfile carries the module. `x-site-build`
  and its wait are unchanged. **What did NOT change**: the early placeholder
  and the extensionless fallback still read `sites/<slug>/index.html`;
  `site.live` and the take-down (`deleteSitePrefix`) are where they were;
  `edit_publish_mark` records the build id as before (the version rides on
  the spine's result and the manifest — no migration); nothing on the media
  side. **Guards**: `test/site-builds.test.mjs` drives the module (staging,
  the manifest last, activation order, the conditional pointer against a
  stale holder, a failed upload not committing, the list, the read, the
  prune keeping the parent, the delete) and reads both publish paths, the
  script, the container's baking, the fallback, the card, the delete, the
  restore and the wall; the container harness (`site build`) executes a real
  bundle built with a version against a bucket laid out as a staged build
  (own prefix, the parent's hop, never the legacy one when a parent exists,
  a malformed version baking as none). **Thirty-one older guards went red
  for the change and were re-anchored, not appeased** — every one pinned to
  the live-prefix writer (`writeSiteDistToR2`), the copy archive
  (`archiveVersion`), the sweep on the publish path, the `r2:dist` mark, the
  sidecar's inline put, the marker in the dist, the `.html`-last sort, or
  the rollback route's spelling — each naming the spelling that moved and
  the property that stayed. **Sweep: 41 mutants, 41 killed, none unapplied,
  three comment-only controls survived** — the pointer written
  unconditionally, a failed condition activating on, a refused upload read as
  up, the commit over a script that is not up, the state copy unfenced, the
  list oldest first or offering a scriptless build, pruning taking the parent
  or a nonsense cap pruning harder, a deleted site keeping its pointer, the
  readers ignoring the pointer, the state keeping the owner's settings, a junk
  pointer read as one, the marker never written, the script up before the
  sidecar, a manifest naming no files listed or restored; on the Worker the
  spine's activation unconditional, its prune taking the parent, either
  payload dropping the version, the fallback reading the legacy prefix only,
  a deleted site keeping its builds, a legacy restore leaving the pointer, a
  restore not putting the config back, a failed stage or activation ignored,
  the cache not cleared, the commit without a job, the version never minted,
  an activated version's script uploaded again; the script always reading the
  legacy prefix, its hop gone, its header unsent; a malformed version baked,
  the script's answer without its version; the wall refusing the prefix or
  the pointer; an activated restore settled again; the image without the
  module. **Two survived the first pass, and neither was the product's**: one
  was INERT (a placeholder manifest written before the client files is
  overwritten by the real one and refused by every reader — deleted and
  replaced by the two readers' filters, both then driven to a kill), and one
  slipped a guard that compared an absolute offset with a relative one and
  passed on the cache clear inside `restoreVersion`, three thousand lines
  away (re-anchored inside the spine, killed). **`site build` 349/349
  through the real container** (338 before; the eleven are the version case).
  **Not proven live**: the first publish after the
  deploy carrying this is the proof (a css edit on fretwork-1, then a
  rollback: the site should serve `x-site-version`, `robots.txt` should
  resolve through the pointer, and `/api/site/<slug>/versions` should list
  a `layout: "build"` row); every existing site stays on its legacy prefix
  until its next publish, which is the compatibility half — a Worker deploy
  changes nothing a visitor sees until a site republishes. The deploy rolls
  the container (the template's `server.ts` and `site-brand.ts` are image
  inputs), so the 15–20 minute hold applies.
- **AN ACTIVATION THAT CANNOT SERVE UNDOES ITSELF (2026-09-06, owner: *"the
  failed-upload behavior is a blocking publishing defect: afterActivate
  advances editable state even when the new script is not serving. A later
  edit carrying that state forward is not a successful recovery
  guarantee"*).** Stage 7 answered a failed script upload with `ok: true`: the
  pointer had moved, `commit` was skipped and `afterActivate` ran anyway — so
  the editable source, the parts and the head marker advanced to a version no
  visitor had ever been served, and stage 6's repair, seeing head and pointer
  agree, found nothing to fix. Three corrections and a wall.
  **WHICH VERSION IS AUTHORITATIVE, stated once**: `current/<slug>.json`, and
  everything else is derived from it — visitors are served the prefix the LIVE
  SCRIPT bakes (so the pointer is authoritative only while the script naming
  it is up), the next edit reads `source/<slug>/` which the repair reconciles
  with the pointer on every claim, and 3b's reconcile compares pointer, live
  stamps and staged version. `lost-upload` is now a narrow residue instead of
  the ordinary outcome.
  (1) **SERVED, NOT MERELY NOT-REFUSED.** `uploaded` counted every answer but
  an explicit refusal, and `putSiteWorker` answers `null` when there is no
  script to send OR no credentials to send it with — so a Worker with no
  dispatch credentials moved every pointer it touched. Only `ok === true`
  counts.
  (2) **THE UNDO.** The pointer goes back to `previous`, CONDITIONAL on our
  own etag, so a newer publish that landed while ours was failing is never
  clobbered; with no previous it is a read-then-delete, named rather than
  papered over (R2 has no conditional delete). `commit` and `afterActivate`
  do not run, and the answer is `not-served` with its own sentence. **The
  sidecar and the live marker are reversible too** — both are written BEFORE
  the script by the ordering argument above, so without the undo a failed
  publish leaves the OLD page wearing the NEW head, which is the same
  half-applied publish one key over. A previous value we could not READ
  records nothing and its key is left alone: cannot-tell must never read as
  there-was-nothing, which would turn an undo into a delete of a live sidecar.
  (3) **THE COLLECTOR'S LEASE.** `activateBuild` takes `assertLease`, re-asked
  with no await between it and the pointer write. The etag stops a holder
  whose pointer moved; it cannot stop one that lost its LEASE while nobody
  published, because the etag still matches — which is exactly the resumed
  collector's shape. `runResumedSiteBuild` builds the hook from the lease it
  holds (`edit_beat` under its own name) and hands it through
  `buildAndPublishPages`; only an explicit `false` vetoes, a hook that throws
  proceeds and says so. Its log line stopped promising a publish.
  (4) **FIRST ACTIVATION IS CREATE-IF-ABSENT.** It was an unconditional write
  whenever the caller read no pointer, with stage 6's per-site lock the only
  thing between two first publishes — a wall borrowing its safety from another
  layer, this repository's own recorded trap. `etagDoesNotMatch: "*"` puts the
  race in the store; the loser answers `superseded`.
  **Guards**: `test/publish-integrity.test.mjs` (25) drives the whole contract
  against a fake R2 with R2's own conditional-write semantics — five upload
  answers, both undo legs and their races, the sidecar branch by branch, the
  three lease shapes each with its control, first-activation racing, the
  end-to-end failed upload (old site still served, next edit reading the right
  source, nothing committed), recovery refused over a newer publication, and
  `compileMsg` DRIVEN rather than read.
  **THE TEST FIXTURE WAS THE LESS-CAPABLE FAKE**: `installCompiler` never
  returned a `worker`, which cost nothing while every answer counted as
  uploaded; both real payloads carry `worker: true` and the container packages
  a script for each. It answers with one now, stamped the way the container
  stamps it, and ten driven publishes reach the dispatch API — a leg they had
  never exercised. **Sweep: 35 mutants, 35 killed, none unapplied, the
  comment-only control survived — seven survived the first pass and every one
  was a guard gap, not the product's**: a falsy-but-not-`false` lease answer
  (only an explicit `false` may veto, and nothing drove `undefined`), an
  unreadable previous value (a fixture whose read failed FOREVER could not
  tell "recorded nothing" from "recorded null", because the undo's own read
  threw too — it takes a read that fails ONCE), the spine's `previous: null`
  (a `/previous:/` match is satisfied by the field with the undo removed), the
  beat's answer thrown away, the lease-lost sentence gated off with the string
  still in the source (so `compileMsg` is evaluated now, not read), an
  unvalidated deploy id, and an unfenced undo. One mutant was INERT and was
  replaced rather than tested: the two reversible writes are independent keys,
  so their undo ORDER cannot be observed. Nine older guards went red and were
  re-anchored, not appeased. Suite 5393.
  **Not proven live, and the failed-upload path cannot be provoked on
  purpose** — it needs a real dispatch failure, the same shape as 3b's
  reconcile. What the next publish DOES prove is that the corrected activation
  still ships: see the canary plan in `docs/owner-notes.md`.
- **AN AUTHENTICATED READ-ONLY RUNTIME DIAGNOSTIC (2026-09-06).** `GET
  /api/site/runtime?slug=` answers, for the caller's OWN site: `async` and
  `runner` (the two effective eligibilities), `asyncOn` / `asyncEveryone` /
  `runnerOn` / `runnerEveryone` (the switches behind them), `runnerBindings`
  and `runnerKeyed` (the rest of the fire's chain, so a `runner: false` names
  which link is missing), and `deploy` — the sha, through `deployIdOf`, the
  same reader the claim uses. **Booleans and the sha only**: never a value,
  never a canary LIST, and `readCanaryList` is not imported into `worker.js`
  at all, so no later edit of the route is one line from handing back other
  customers' slugs. Owner-gated like the answer and migrations routes: a
  signed-in stranger gets the 404 a missing site gets. **Why it exists**:
  those four flags are GitHub secrets uploaded at every deploy, and
  `deploy.yml` supplies a fallback for each — so the workflow's `|| 'off'` is
  what the Worker runs only while nobody has ever set that secret, a fact the
  repository cannot know. An audit that reads the workflow is reading a
  default, not the deployment; nothing else leaves a trace (a job fired at a
  container logs, a job NOT fired logs nothing), so "is the runner on for this
  site" had no authorized answer at all.
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
| `text` | words in the page source | 1 (one small call; the old "0" was the Haiku-era rounding, measured 1 on run 10) |
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

**A publish that translates something new is charged for the translation on
top of the rung's own price (run 39, 2026-09-04)** — one call per extra
language, on the picked model, reserved by the spine before its compile and
floored at 1 like every charge. A monolingual site and a cached bilingual one
pay nothing more; the platform rebuild never pays.

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

**A LANE'S OUTPUT CEILING IS WHAT ITS FIELD CAN STORE (task #47, 2026-09-06,
owner: *"SO FIX ?"*).** Every lane was given `LANE_EDIT_MAX_TOKENS` — 16,000,
sized for the stylesheet. The `wordmark` lane DRAWS, and a drawn answer is a
long generation: on Grok, the default picker and ~3x slower at code, it ran the
whole `QUICK_CALL_MS` and was cut off on runs 11 and 12, charging nothing and
changing nothing, twice. **That call ceiling cannot be raised** — 240 s against
an egress that hangs up an idle connection at ~270 s, so the wire is the real
bound. So the ANSWER is bounded instead, which is the wall rather than the
rule: a wordmark over `MAX_WORDMARK` is refused by `cleanWordmark` whatever it
cost, so 16,000 tokens buys eight times more generation time than any answer we
would keep. `laneMaxTokens(field)` derives from `FIELD_STORE_CAP` — `MAX_CSS`,
`MAX_WORDMARK`, `MAX_FAVICON`, **the refusals themselves and never a second
list beside them** — at three characters per token (SVG and CSS tokenise worse
than prose) with a quarter of slack for the tool envelope. **It can only ever
REDUCE**: `Math.min` with the shared ceiling leaves `css` byte-for-byte what it
was and a field with no cap unchanged, so no working lane got slower or
tighter. Measured: wordmark **16,000 → 3,334**, favicon **→ 1,667**, everything
else untouched. `tokensForChars` is split out so the floor (`LANE_MIN_TOKENS`,
1,000) can be DRIVEN — a sweep found it inert against today's caps, the
smallest of which lands well above it. **A pre-existing gap is named rather
than closed here**: `MAX_CSS` is 60,000 characters and the shared ceiling
expresses about 48,000, which was true before this and is left alone, because
raising it would buy the css lane exactly the generation time the wordmark was
cut for; an overrun is a NAMED failure (`runLane` reports a `max_tokens` stop),
never half a stylesheet stored. **Sweep: 8 mutants, 8 killed, none unapplied,
the comment-only control survived — two survived the first pass**, the floor
(inert against every cap in use, so split out and driven) and the caps being
plausible invented numbers rather than the imported refusals (asserted by
identity now).

**AND RUN 40 DISPROVED IT (2026-09-06, owner: *"stream the lane call"*).** The
proof this entry asked for — the next `wordmark` ask on Grok, ~1 credit — was
dispatched and came back a THIRD timeout: job `73e8a7d1…`, `state: failed`,
`billing: none`, **cost 0**, the site unmoved, `waitedMs: 240000`, `call:
"lane"`, `kind: "TimeoutError"`. **The plumbing was right and the reasoning was
wrong.** Driven rather than read: `editRequest` for `wordmark` really does carry
`max_tokens: 3334`, so the ceiling IS on the wire — but generation time follows
the tokens actually EMITTED, not the ceiling they are allowed to reach, and
**the tell is which failure came back**: a bound ceiling stops with a
`max_tokens` stop, and this stopped with a timeout, so the model had not reached
3,334 when our own `AbortSignal` cut it. Lowering a budget truncates a long
answer; it cannot make a slow one finish sooner. The cap stays — it is still the
right wall on what may be STORED — but it was never the binding constraint.
**THE BINDING CONSTRAINT IS THE WIRE, AND THE SMALL CALLS STREAM NOW.**
`QUICK_CALL_MS` is 240 s only because the egress hangs up an IDLE connection at
~270 s; streaming is what stops it being idle, and `build-call.mjs` has folded a
streamed transcript back into the non-streaming shape — usage and all, both
providers — since the container needed one. Two hops: `callBuilderModel`'s
Worker wrapper FORWARDS `opts` (it had dropped a fourth argument the module has
taken for months — the recorded wiring trap, found by a live timeout because
every guard drove the MODULE), and `quickSend` passes `{ stream: true }` and
clamps a queued call to `QUICK_STREAM_MS` (480,000) instead of the flat 240 s.
**The synchronous path keeps 240 s deliberately**: off the queue the bound is
the CUSTOMER'S connection (~273 s, run 21), which streaming to a provider does
nothing for. **480,000 is a chosen bound, not a measured one**, and the comment
says so; the job's own clock is the real bound whenever there is a job.
**THE FIRST CUT SET IT TO `BUILDER_CALL_MS` AND `build-budget`'s GUARD CAUGHT
IT** — a build's ten minutes handed to a classifier, exactly the regression that
assertion exists for. The change was fixed, not the guard; and the guard was
TIGHTENED, because its `doesNotMatch` listed `BUILD_BUDGET_MS|CONTAINER_CALL_MS`
and never `BUILDER_CALL_MS`, so it caught the mistake by luck through a
different assertion going red. It names all three now.
`test/lane-stream.test.mjs` (5) EVALUATES the real `quickSend` out of worker.js
with `callBuilderModel` recorded, because a missing hop is invisible to a text
read — `picked-model`'s own lesson. **Sweep: 8 mutants, 8 killed, none survived,
none unapplied, the comment-only control survived** — the wrapper dropping
`opts` or taking them and not passing them, `quickSend` handing none, the flag
off, the queued clamp back to 240 s, the streamed ceiling as a build's clock
(the first cut), the synchronous path given the streamed ceiling, and the job
able to make a call only BIGGER. Full suite 5,398. **MERGED AND DEPLOYED**
(owner: *"Ok merge"*): main fast-forwarded `b2428351` → `72c639ff` at 21:48Z,
**deploy run 2035 green in 3m07s** — the gate set in 1 s, the image step 2m17s
so the site image was BUILT and the container app `EDIT`ed onto
`isibi-app-sitebuildcontainer:f93d8236b725db6e` at 21:51:41Z, the drain finding
no live leases, Wrangler 22 s, the gate left to expire on success. **Not proven
live**: the next `wordmark` ask on Grok is the proof, ~1 credit — and this entry
is the record of what it costs to mark one proven early. **That one run settles
three things at once**, because fretwork-1 is still on the LEGACY publish layout
(read live: it serves no `x-site-version`): the streamed call, the first
`current/<slug>.json` activation under stage 7, and the publication-integrity
work. And a timeout there would read differently from run 40's — the ceiling is
480 s now, so it would be a genuinely slow generation rather than our own wall.

**RUN 41 PROVED THE STREAMING AND FOUND A LANE THAT CHARGES FOR AN INVISIBLE
CHANGE (2026-09-06/07, owner: *"Ran"* → *"we gotta fix it"*).** The proof the
entry above asked for came back green on the half it was testing:
`lane:wordmark` ran **292,336 ms** and FINISHED, where runs 11, 12 and 40 were
each cut at exactly 240,000 ms for nothing — 52 seconds past the old wall, job
`2b9b2201…`, `done`, `finalized`, **2 credits**, `moved: ["wordmark"]`, build
`mtnfl34h-8uuf06` → `mtqdjyhg-bizsag`. **Two other entries' proofs rode on it**:
fretwork-1 served no `x-site-version` before and now serves
`01788733184386-yboq08`, so that publish was the site's FIRST activation under
stage 7's immutable layout and the corrected activation carried it (36 files,
render check ok, nothing left leased).
**AND THE SITE DID NOT MOVE, CORRECTLY.** `writeSiteBrand` bakes a designed mark
ONLY when the owner uploaded none — `if (!logoValue)` for the wordmark and
`if (!icon)` for the favicon, *"a model must not outrank a person"* in its own
comment — and fretwork-1's header carries an uploaded PNG since run 16. So the
lane drew 612 characters of SVG, stored it, published a whole build, took 2
credits and reported success for something no visitor could ever be shown:
**doing less than was asked while saying it was done**, the one failure this
path exists to avoid. The precedence is right and stays; what was wrong is that
the lane could not SEE it.
**THE WALL IS AT THE PICKER AND COSTS NOTHING.** `UPLOAD_SHADOWS`
(`site-lanes.mjs`, `{wordmark: "logo", favicon: "icon"}`) with `shadowedBy` and
`shadowedRefusal`; the edit route's picker widens its existing config read to
serve both walls (`wallConfig`, the whole config — the uploads are their own
fields BESIDE `look`, never members of it, which is why the logo rung stores
outside it) and answers 422 with `cost: 0` and a sentence naming the upload and
offering the way through. **The offer is real rather than aspirational**:
`runLogoEdit(deps, { remove: true })` removes the picture today on a rung the
ladder prices at 0, and a guard holds the sentence to that mechanism — the
recorded trap is a hint promising something nobody built. **It is an OFFER, not
an action**: removing a picture a person uploaded because a lane inferred they
meant to is the one reading of "redraw the header wordmark" that cannot be taken
back. **A read that FAILED lets the lane run** — here the danger inverts, since
reading cannot-tell as "there IS an upload" would refuse a change that would
have worked — and **a cleared upload is not an upload**, because the logo rung
clears by writing `""` and truthiness would lock the lane out for ever.
**TWO FIELDS, WHICH IS THE POINT OF THE MAP.** The favicon has the identical
shape and would have cost the identical credit the first time anyone asked for
one on a site with an uploaded icon; nothing announced it, and an `if` on
`wordmark` would have shipped with it open. Full suite **5,411**.
`test/upload-shadow.test.mjs` (13)
DERIVES the pair from the baker's own two branches in BOTH directions, and
drives the wall through the real route with the lane's tool COUNTED — the
property is not that a refusal exists but that the 292-second call is never
made — with two controls (no upload → the lane runs; a cleared upload → the lane
runs) without which a wall that refused everything would pass. **Sweep: 13
mutants, 13 killed, none survived, none unapplied, the comment-only control
survived** — the wall gone, the refusal charging, marking-and-falling-through,
the upload read by truthiness, the config read only for the addon wall, a failed
read still refusing, the sentence dropped, the map forgetting the favicon,
`shadowedBy` answering off the prototype, the sentence dropping "weren't
charged" or the offer, one sentence for both fields, and a sentence for a field
nothing shadows.
**TWO TRAPS HIT WHILE BUILDING IT, BOTH RECORDED ONES.** (1) The trace mark was
written as `eMark(...)`, a function that does not exist; `node --input-type=module
--check` PASSED, because a free identifier is legal, and it would have thrown
`ReferenceError` on the refusal path live — run 22's `TOKEN` exactly, caught by
grep rather than by the parse. (2) A `git checkout --` restore trap on the sweep
fired on its NORMAL exit and wiped the uncommitted work; the runner already
restores in its own `finally`, so the belt was redundant and destructive. **The
rule: snapshot to a copy, never `git checkout` a tree carrying uncommitted
work.**
**Not proven live**: the refusal needs the deploy, and its proof is FREE — the
same wordmark ask should come back in seconds with `cost: 0` and the sentence.
Two things are the owner's: that test PNG is still fretwork-1's header logo and
probably should not be, and there is no way to LOOK at a stored wordmark without
publishing it (it lives in the site's config in R2 and no route hands the stored
look back).

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
  **EACH PATH HAS A REPAIR PATH (owner, 2026-09-04: *"try to fix it, if not
  fix, send as it is"* → *"addon path shouldnt trigger build path"* → *"each
  path has a repair path"*).** An addition the site's own check says broke a
  page used to ship as it was (the ship-it rule applied to a render
  finding). The BUILD repairs on that report (`site-repair.mjs`, `deps.repair`
  in `publishPages`); the EDIT path has its correction round; the ADD step
  now has ITS OWN, in its own module. **The first cut ran the BUILD's repair
  module inside the shared publish spine, gated to the addon, and was moved
  the same day**: the owner's rule is that the add step does not trigger the
  build path, and the spine is every path's.
  - **The spine offers ONE SEAM and knows nothing about repair.**
    `recompileAndPublish` takes `afterCompile`, a hook called after the
    compile verdict and the dead-css refusal and BEFORE the publish gate —
    nothing in R2 yet — with `{ built, pages, langs, job, recompile }`;
    `recompile(list)` is the same compile on a corrected list, the language
    variants re-assembled off the cache (`filesFor`, the ONE assembly the
    first compile uses too). An answer replaces `built` and `pages` only
    when it is a compiled build; a hook that throws is logged and ignored.
    The spine imports nothing from `site-repair.mjs` and names no repair.
    ONLY the addon route hands a hook in; the edit lanes and the rebuild
    drain hand nothing and are byte-for-byte what they were
    (`test/spine-repair.test.mjs` counts the call sites).
  - **The ADD step's round is `addRepairRound` in `site-add.mjs`, driven
    with fakes**, with its own wording (`ADD_REPAIR_RULES`: an addition to a
    LIVE site, which keeps the design system it was written into and may not
    touch the rest of the site) and its own scope — ONLY the pages this
    addition added or changed (`touched`), never a page it did not write,
    however broken. What it shares with the build's pass is the MECHANISM:
    the tweak rung (`runTweak`, whose guards keep the words and the route,
    calibrated at 0 false alarms over 1,640 real tweaks — eight guards
    copied is how five copies of one route mapping happened), the render
    check's own `SERIOUS` kinds, and `stripLangPrefix` (a variant's crash is
    its primary page's: `/es/gear` → `gear.tsx`; run 34's report named only
    the variants). Never a line of the build's wording, never
    `site-repair.mjs` — `test/site-add.test.mjs` walks the imports and the
    words both ways. Four answers, each named: no report → nothing; nothing
    serious on a page this addition wrote → nothing; work but no room on
    the job's clock → `time`, the routes named, NOTHING spent; else one
    cheap fix per broken page (`MAX_ADD_REPAIRS` 3, the picked model's
    `quick` slot) and a second compile through the seam's `recompile` —
    shipped and STORED when it compiles, the original shipped when it does
    not (never worse than not trying).
  - **The room is `canRepair`** on the job's budget — `REPAIR_FLOOR_MS` = a
    call (60 s) + a compile (180) + the sweep (60) + the terminal writes
    (15), asked in the hook before the model call: off run 34's `phase_ms`,
    the function addon reached its publish at ~385 s of 840 and would have
    had room, the api addon at ~200 s too, the two-kind table addon at
    ~540 s would not and is shipped as it is, said so.
  - **Billing**: under a job the round's usage is reserved as sequence #2
    (`aCharge(bill, seq)`) INSIDE the hook, before the spine's gate, so
    everything charged is charged before the commit point; synchronously it
    joins the one collect. The route reads the round back off its own
    closure (`aRepairRound` — not `aRepair`, which the addon route already
    used for the import dedupe; the trap below), never off the spine's
    answer.
  - **The customer**: quiet on a fix that held; "I ran out of time to try a
    fix for /gear, so it's published as it is" or "I tried a fix for /gear
    and it didn't hold, so it's published as it was" otherwise
    (`addRepairNote`, on the reply's render sentence); the reply carries
    `repair` for the harness, whose BROKEN note says whether a fix was
    tried.
  - **What it does not do**: a crash inside a `-parts/` component is
    reported against the PAGE that holds it, so the model is handed the page
    file and answers `cannot` or fiddles — the build has the same edge.
  **Not proven live**: fretwork-1's pages all render now, so the next addon
  whose page throws is the proof; the harness prints the round. The first
  cut's deploy (run 2015, `f866fed8`) failed on Cloudflare's registry push
  and went green on the owner's re-run at 12:03Z; the seam and the add
  step's own round ship after it.
  **Sweep of the redo: 34 mutants, 33 killed, none unapplied, the
  comment-only control survived — and the one survivor was INERT, deleted
  rather than tested.** The round's own pre-send size check duplicated
  `tweakable`, which `runTweak` asks before it sends and which answers the
  identical `too-big` with nothing spent, so removing the copy changed no
  behaviour: the recorded "inert mutants" trap and "two lists of the same
  thing", found the hour the copy was written. Each of the 33 a hop cut
  back — the seam not gated on a function, a throwing hook escaping, a
  non-build answer replacing the build, `built` or `pages` alone replaced,
  the recompile on the old files, the languages not handed, the spine
  importing the build's repair, the addon handing no hook, the scope
  dropped, the room forced, the reserve as #1 or with nothing to reserve,
  the hook always replacing, the round on the rung's default model, the
  sync collect and the job charge without the round, the reply without the
  sentence; and inside the round: the scope, the variant mapping, the
  serious filter and the cap dropped, no room still running, a failed
  second build shipping, a refused fix compiling anyway, the usage dropped,
  a compile throw escaping, the rules falling back to the tweak lanes', the
  design-system sentence dropped, the model not passed, both customer
  sentences silenced, a success announced. **Re-run whole on the renamed
  source** (the `aRepair` collision, in the traps): 33 mutants, 33 killed,
  none unapplied, control survived; suite 5,000 green.
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

- **RUN 35 (2026-09-04 13:45Z, `harness: addon`, `component` alone — the
  first addon on the Worker carrying the seam and the ADD step's own repair
  round; 57 → 41): THE ROUND RAN LIVE AND ANSWERED `clean`; THE HARNESS'S
  LIE IS ITS ELEVENTH FALSE ALARM.** Job `768f393f…`, receipt in 2.3 s,
  published 13:54:15, **469 s for 16 credits**, `mtma6kia-rldbzk` →
  `mtn0gbvz-j6l2e2`, `changed: ["index.tsx"]`, `added: []`, 37 files.
  `phase_ms`: the picker 5.9 s, `add:component` 21.6 s, the page call
  152.9 s, `publish:1` 278 s (archive 26.8 s, `r2:dist` 17.9 s), the seam
  0 ms. **The seam**: `repair: { ran: false, why: "clean" }` — the render
  check's only findings were the three `-parts/` 404s (task #44) on routes
  the addition did not write, so the round had nothing in scope and spent
  nothing. **The page**: fretwork-1 ALREADY carried this exact section from
  run 22 (Sam H., Priya N., Jordan P.), so the designer, asked for it again,
  added no second band and rewrote the three quotes shorter under the same
  names ("Couldn't hold a pick last month — now I play three chords" …): 60
  characters fewer on the home page, which the harness's check (80 new
  characters of quotes) read as *"the addition is not on the site"*. Run
  30's shape: an ask naming a thing the site already has, the product
  declining to duplicate it, the harness written for a site without it
  (`docs/edits/addon-run35-testimonials.png` is the section as served; the
  run-22 screenshot is the before). **Two things the customer read are
  wrong, both reply wording**: `addonReplyText` says *"✅ Done — linked it
  from /"* for a component that changed the home page and added nothing
  (`changed` is worded as the link to a new page), and the render tail says
  *"3 pages threw an error"* for the `-parts/` 404s on a site whose pages
  all render (task #44, customer-visible on every addon reply now). **And a
  product question, owner's call**: a second ask for a section the site has
  rewrote the customer's existing quotes without being asked to — the edit
  path's "nothing unasked-for moves" has no counterpart on the add path for
  a thing that already exists (the wall covers `qr` and `three` only). The
  harness's ask should name a section the site lacks before the case runs
  again. The runner committed `docs/edits/addon-sweep-results.json` to main
  (`3c7e96a9`).
- **A SECOND ONE (owner, 2026-09-04, answering run 35: *"add a second
  one"*).** An ask for a section the site already has ADDS a second one,
  after the first, and the first is left exactly as it is. Three hops.
  (1) **The rule rides BOTH hops** beside the design rule: `ADD_DESIGN_RULE`
  gained "AN ADDITION IS ALWAYS A NEW THING … in ADDITION to it, after it,
  as a second one … left exactly as it is: not reworded, not restyled, not
  merged into the new one, not replaced"; the `component` kind's hint,
  `keep` and `addDirective` line say a like section is a SECOND one placed
  after the first, byte-identical. (2) **THE WALL, in the addon route**,
  after the merge's escalate and BEFORE the job gate and the bill: every
  page the addition CHANGED (an existing page — one it added has no before)
  must still say every word it said. `keptProse(before, after)` in
  `site-tweak.mjs` is the SUBSET of `sameProse` over `extractText`'s reading
  (calibrated at 0 false alarms over 1,640 real tweaks), counted as a
  multiset, so a quote carried twice and returned once is lost. A page that
  lost words is refused 422 `rewrote`, **cost 0**, `lost` on the wire,
  `rewroteMsg` naming the page and up to two of the words ("I couldn't add
  that without changing what's already on the home page — it would have
  lost “…” and “…”. Nothing was published. Ask again and I'll add it as a
  new section and leave the rest exactly as it is."), `aMark("kept")` in
  the trace. A refusal, not a climb, and not a correction round yet —
  measure how often the model does it first. (3) **The harness's
  `component` check reads what was LOST** as well as what was added
  (`lostSentences`: a sentence of 25+ characters the page said must still
  be on it), and its ask stays the testimonials one, which on fretwork-1
  now proves the decision — a second band with new quotes, the first three
  intact. **A false-alarm risk, named**: segments compare as they are, so a
  writer that retypes a sentence with a changed full stop loses it; the
  tweak rung measured 0 in 1,640 under the same reading, and the failure
  mode is a free refusal with the words named. Guards:
  `test/add-second-one.test.mjs` (keptProse driven with run 22's quotes
  against run 35's rewrite and against a second band; the rule on both hops
  and the kind's wording; `rewroteMsg`; the wall's placement, inputs,
  refusal, and the browser's `msg` path), `test/addon-sweep.test.mjs` (run
  35's shape refused, a second band accepted, `lostSentences` driven).
  **Sweep: 20 mutants, 20 killed, none unapplied, the comment-only control
  survived** — the rule sentence dropped or letting the first change, the
  hint reading a like section as an edit, the keep answering nothing, the
  directive's second-one line dropped, keptProse always ok / ignoring
  counts / demanding equality / reading only the after, the wall dropped /
  reading the added pages / charging / without the sentence / without the
  trace / comparing the new page with itself, the sentence without the
  page or the words, the harness ignoring a loss / never finding one /
  not naming it. **PROVEN LIVE by run 36, below.**
- **RUN 36 (2026-09-04 14:47Z, `harness: addon`, `component` again — the
  first on the Worker carrying the second-one rule and wall; 41 → 24): THE
  DECISION IS PROVEN LIVE, AND THE REPAIR ROUND'S CLOCK IS THE FINDING.**
  Job `e2908b65…`, 747 s for **17 credits**, `mtn0gbvz-j6l2e2` →
  `mtn2pqqq-0q059t`, `changed: ["index.tsx"]`, `added: []`, 37 files. The
  home page gained 310 characters and the harness's own count says
  *"everything it said is still there"*. On the page: the run-35 band
  untouched byte for byte (Sam H., Priya N., Jordan P.), and a SECOND band
  under it with three new quotes ("I had never held a guitar, and after
  six weeks I can play three songs my kids recognise" …) — full-width
  stacked cards where the first band is three across
  (`docs/edits/addon-run36-testimonials.png`). The wall passed it (`kept:
  ok`). **The verdict was BROKEN, and rightly by the harness's rule**: the
  render check found `/es`, the Spanish variant, throwing React #418 (a
  hydration text mismatch — the SSR'd document serves and the English
  page is clean; run 34 saw the same class on `/es` and `/fr`) beside the
  three `-parts/` 404s (task #44). So the ADD step's round RAN LIVE for
  the first time — and answered `refused` with reason `send`:
  `phase_ms.repair` is exactly **240,000**, the tweak call on Grok's quick
  slot hit `QUICK_CALL_MS` (task #47's cap) and was cut off, nothing came
  back, and the page shipped as it was with the sentence "I tried a fix
  for / and it didn't hold, so it's published as it was" (and "4 pages
  threw an error" — three of them task #44). **The ship-as-is path is
  proven end to end; what it cost is the finding**: `REPAIR_FLOOR_MS`
  budgets 60 s for the call and the call took 240; `publish:1` was 445 s
  and the job ended at 747 of 840. The round needs its own call cap — the
  room left minus the compile, the sweep and the terminal writes, bounded
  well under the quick-call cap — or a page call that runs long leaves a
  repair that runs out the clock. The next fix. The runner committed the
  results file to main (`3285b8ed`).

- **RUN 36 FOLLOW-UPS (2026-09-04, owner: *"lets go back to the addon
  issues we had"*).** Four of the five; the fifth — the second band laid out
  differently from the first (#82) — is a design call and is the owner's.
  (1) **THE REPAIR CALL RIDES ITS OWN CLOCK (#79).** `makeEditBudget` has
  `repairMs()` — what is left less the second compile, the sweep and the
  terminal writes (`MIN_BUILD_MS + PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS`)
  — and `capMs(cap, { repairing: true })` caps a call at it; `repairClock(budget)`
  is the view `quickSend` is handed for the round, IN PLACE OF `aQuick`, whose
  clock holds back the two reserves alone (right for every call before the
  first compile, and what let run 36's fix run the whole 240 s ceiling into
  the room its own recompile needed). `canRepair(needMs)` refuses BEFORE
  buying when the room cannot hold the MEASURED need: the addon route times
  its page call and hands in `aPagesMs / aPagesWrote`, because a fix re-emits
  the file that call wrote on the same model and no better estimate exists
  in the job; zero when nothing was measured, which is the old floor — a call
  is never refused for a number we do not have. Run 36's shape (140 s of
  room against a page the model had spent 153 s writing) is now refused for
  0 and said so, instead of bought and cut at 240 s with the job at 747 of
  840. The `repair start` trace mark carries `roomMs` and `needMs`.
  (2) **`-parts/` OUT OF THE RENDER CHECK (#44).** `routePaths()` skips a
  name starting with `-`, the `routeFileIgnorePrefix` our vite config pins:
  every reply on fretwork-1 since run 22 said "3 pages threw an error" for
  three components that were never pages, and the check's 25 s budget spent
  its first three navigations on their 404s. Driven: the walk is lifted out
  of `build-server.mjs` and run over a fake tree (`test/site-tsx.test.mjs`);
  the container harness's own-parts build asserts the render report names no
  `-parts` route. **A container image input — the push rolls the container.**
  (3) **THE REPLY'S WORDING (#81).** `updated /` for a changed page with
  nothing added; `linked it from /` only beside an added page — the same rule
  in `addonReplyText` (chat.js) and `addonReply` (site-addon.mjs), both driven.
  (4) **#80 IS INSTRUMENTED, NOT FIXED, AND ITS PREMISE WAS WRONG.** The
  served build (`mtn2pqqq-0q059t`) hydrates CLEAN in this sandbox on `/es`,
  `/fr` and `/`, at 1280×900 and 375×812, with the site's API answering 200
  or 404, with each of its four chunks delayed in turn: 239 text nodes,
  server and browser identical, every time (`scratchpad/es-hydrate.mjs`, a
  curl mirror of the served page under a local server, the diff taken in
  Chromium). The container's check saw #418 on `/es` (runs 34 and 36) and
  `/fr` (34) and NEVER OPENED `/`: read in directory order the variants came
  first, the 25 s budget cut run 34 at eight routes, and "the English page is
  clean" was a claim about a page nobody looked at — the "negative assertion
  must prove its observer is alive" trap, in the render check. Two changes,
  both container-side. `checkOrder(routes, prefixes)` (site-render.mjs) opens
  `/` first, then the primary pages, then the language variants, matched on a
  whole segment (`/eshop` is not Spanish); `build-server.mjs` derives the
  prefixes from `payload.langs.extra`. And **a hydration mismatch names
  itself**: the harness keeps the document the server sent (the navigation
  response), and when React reports a mismatch `hydrationProbe` — serialised
  into the page like `probe`, reaching for nothing outside it — walks the
  served document's text nodes against the DOM the browser regenerated and
  answers the first pair that differs; `hydrationDetail` writes the finding
  as `React error #418 (hydration mismatch) — the server rendered “…” where
  the browser then rendered “…” (at main>section>h3)`, at twice the usual
  detail clip so the browser's half survives. That sentence is what the
  customer's reply carries and what the repair round hands the model. Proven
  through the real container by a page that disagrees with itself on purpose
  (`hydrate-diff` in `test/integration/site-build.mjs`). **Two facts found on
  the way, worth having**: fretwork-1's PRIMARY language is Welsh — the bundle
  bakes `SITE_LANG = "cy"` and the switcher shows "Cymraeg" as current on an
  English page (the lane sweep's `lang` case set it; `og:locale` says `cy`
  and Chrome offers to translate); and Node 22 has Welsh locale data while
  Chromium 141 does not (`Intl.DateTimeFormat("cy", { month: "long" })` →
  "Medi" against "September") — the ICU class `build-server.mjs` already
  records for `langLabel`. Nothing on the page formats with `cy` today (the
  calendar and the price list say `"en-GB"`, the model's part says `void 0`),
  so it is not THIS mismatch; it is the one waiting for the first page that
  passes the site's language to a date. What the next addon run on fretwork-1
  will show is the actual differing text, on `/` first. **IT DID — run 37,
  the same day: "the server rendered “Llun” where the browser then rendered
  “Mon” (at div>div[week-strip]>button>span)".** The run-37 entry below has
  the cause and what it is not.
  **Sweep: 23 mutants, 23 killed, none unapplied, the comment-only control
  survived** — the room forgetting the compile, the gate ignoring the need or
  dropping the floor, the repairing cap read as the plain one, the clock view
  plain or flat without a budget, the need always zero, the room asked bare,
  the send back on `aQuick`, the page call not timed; the `-` skip cut to
  `if (false)`; both replies back to "linked it from"; the diff never taken,
  the served document not kept, the browser's text dropped, the React link
  kept, the detail clipped short, any React error read as hydration, the
  order an identity, a variant matched by prefix, the container handing the
  check unordered routes, the probe reaching for module scope. `site build`
  331/331 through the real container; suite 5,013 green.

- **A SECOND ONE COPIES THE FIRST'S DESIGN (#82; owner, 2026-09-04: *"Yes,
  new components should copy existing design"*).** Run 36's second band was
  stacked full-width cards under a first band of three across — the words
  landed, every sentence stayed, the wall passed it, and the page carried
  two designs of one thing. Three hops, none of which existed.
  (1) **The rule, on both models.** `ADD_DESIGN_RULE` gained "AND A SECOND
  ONE IS BUILT THE WAY THE FIRST IS BUILT … the same component — the kit
  part it calls, or the part written for this site — called the same way,
  in the same wrapper, with the same layout … Only the words are new … the
  one that was there first is the one to copy", riding `ADD_SYSTEM` and
  heading the fold's directive as the rest of the rule does; the `component`
  kind's hint and `keep` say a like section is a second one BUILT FROM THE
  SAME COMPONENT the first is built from, and the page writer's component
  line says the same wrapper and the same layout classes, "not a different
  component that shows the same kind of thing".
  (2) **The FACT the designer needs.** A rule to name the first one's
  component is empty when the designer has never been told what the page is
  built from. `pageComponents(sources)` (site-add.mjs) reads each stored
  page's imports — `@/components/ui/*` is the kit, `@/routes/-parts/*` the
  site's own parts, an alias read as the kit's name, `@/lib/*` not a
  component — keyed by route; the addon route hands it in as
  `aSite.builtFrom`, and `siteNote` prints "/ is built from: SiteChrome,
  TestimonialGrid, …; and its own parts ChordDiagram. A second one of
  something it already has is built from the same component as the first."
  per page, and nothing for a page that imports nothing.
  (3) **The harness reads the served page's STRUCTURE, never its words**
  (`scripts/addon-sweep.mjs`). `skeletonOf` is the tag tree with each
  element's `data-slot` and its LAYOUT classes only — grid, columns, flex,
  gap, space, widths; never colour, type or radius, which the design system
  holds constant — a run of identical siblings collapsed to one, so a grid
  of three and a grid of four read the same and a grid and a stack do not;
  an `<svg>` is a leaf. `sectionsOf` is the top-level `<section>`s (a nested
  one stays inside its parent), `newSections` what the page gained by its
  words, and `builtLike(before, after, like)` finds the FIRST section of the
  kind (`TESTIMONIALS_LIKE`, the kit's `testimonial-grid` slot) and fails a
  new section built differently, naming both skeletons. The `component`
  case's verdict carries it beside the words and the loss: "built the way
  the first one is", or "BUILT DIFFERENTLY from the band it should copy —
  new “…” is section(div{max-w-6xl space-y-6}(div[card]…)) where the first
  is section(div{max-w-6xl}(div[testimonial-grid]{gap-4 grid lg:grid-cols-3
  sm:grid-cols-2}(div[card]…)))" — run 36's page, as the fixture, fails it.
  **The fixtures are the served page**: `test/fixtures/testimonial-bands.mjs`
  holds both bands as fretwork-1 serves them (read through a local mirror),
  ONE copy for `test/copy-design.test.mjs` and `test/addon-sweep.test.mjs`.
  The older component-case guard held a snapshot with no `html` at all (the
  harness's carries one) and a quote typed `“First…` where the served page
  is `“<!-- -->First…` — React's SSR marker between two text nodes, a space
  once stripped — and went red for the change; it reads `text` off `html`
  through the harness's own `strip` (exported for it) and the lost sentence
  off `lostSentences` itself now. Guards: `test/copy-design.test.mjs` — the
  rule on both hops, the directive, `pageComponents` driven, the note and
  the worker hop, the structure reader driven with run 36's bands, the
  component case. **Sweep: 33 mutants, 33 killed, none unapplied, the
  comment-only control survived — four survived the first pass, every one a
  property the guard described and did not drive** (the recorded "a guard
  proves the branch it drives"): the `<svg>` leaf (an added icon read as a
  difference either way; two icons differing only inside now read the same),
  the model being the FIRST like section (a reader taking the LAST would
  take the new band as its own model and pass everything — a two-across
  grid beside a three-across one drives it), every new section judged (a
  copy followed by a stack), and the first-of-its-kind answer's `ok` (its
  note alone was read). The rest: the rule sentence dropped, copying the
  newest, letting the layout differ, the hint and the keep without the
  component, the directive's copy line dropped or allowing another
  component, parts read as kit, an alias read as its local name, `@/lib`
  read as a component, a page with no imports guessed, keyed by file, the
  note line dropped or without parts or without the sentence or printed for
  an empty page, the route handing `{}`, the reader always agreeing or
  agreeing on nothing, layout or slot ignored, items counted, no new section
  passing, `newSections` empty, the note unnamed, the case ignoring the
  verdict or its note, the kind matched by any section, a nested section
  read twice. Full suite 5,018 green. **PROVEN LIVE by run 37, below.**

- **RUN 37 (2026-09-04 18:45Z, `harness: addon`, `component` again — the
  first on the Worker carrying the copy-the-first's-design rule and the
  built-from fact; 24 → 7): THE DECISION IS PROVEN LIVE, AND THE `BROKEN`
  VERDICT IS #80 NAMING ITS TEXT.** Job `b9f6943a…`, receipt in 3.0 s,
  published 18:55:57, **541 s for 17 credits**, `mtn2pqqq-0q059t` →
  `mtnbaddj-a3d38n`, `changed: ["index.tsx"]`, `added: []`, `kept: []`, 37
  files. `phase_ms`: the picker 7.3 s, `add:component` 44.0 s, the page
  call **299.8 s** (Grok, one page), `publish:1` 180.2 s (archive 29.7,
  `r2:dist` 19.7), the seam 0 ms. **On the page**
  (`docs/edits/addon-run37-testimonials.png`, read off the served page
  through a local mirror): the run-35 grid untouched byte for byte, a NEW
  grid directly under it — `TestimonialGrid`, three across, the same card,
  three new quotes ("I couldn't play a chord when I started — after a few
  weeks I was strumming my first song" …) — and the run-36 stacked band
  below both, untouched. The harness's own reader: 16 sections from 15, one
  new by its words, `builtLike` "built the way the first one is",
  `lostSentences` none, home text 2,356 → 2,689. The designer was told "/
  is built from: … TestimonialGrid …" and named it; the page writer put the
  new one after the first, where the directive says. **The verdict was
  BROKEN, by the harness's rule, and the finding is the one #80 was
  instrumented for**: the render check, opening `/` first now, reported `/
  threw: React error #418 (hydration mismatch) — the server rendered “Llun”
  where the browser then rendered “Mon” (at div>div[week-strip]>button>span)`
  (phone viewport) and `/es threw: React error #418 (hydration mismatch) —
  no differing text was found once the page had settled`; `checked: 6,
  pages: 6, partial: true`.
  **THE CAUSE, read without a model call.** `week-strip.tsx` formats its
  day labels with `toLocaleDateString(undefined, { weekday: "short" })`, and
  `site-locale.ts` pins an absent locale to `SITE_LANG` on BOTH sides — "cy"
  on fretwork-1 since the lane sweep's `lang` case — which is right and
  deterministic in intent; what differs is the ICU DATA behind "cy": the
  container's Node 22 has Welsh ("Llun"), its Chromium does not and falls
  back to English ("Mon"). Exactly the class recorded this morning, and the
  page that "passes the site's language to a date" was the week strip all
  along — through the pin, not a `cy` literal, which is why a grep for one
  found nothing. **What it is not**: a defect a visitor on Chrome sees. The
  live site's own server render says "Mon" (workerd has no Welsh either)
  and the sandbox's Chromium hydrates the served `mtnbaddj-a3d38n`
  IDENTICALLY — 257 text nodes, server and browser the same — so the nine
  clean reproductions were reading the live pair, which agrees, while the
  check reads the container pair, which does not. A visitor whose browser
  DOES carry Welsh (Firefox ships it) gets the live mismatch the other way
  round — "Mon" served, "Llun" regenerated — a recoverable #418 and a
  client re-render, not a broken page. **The repair round refused for 0,
  as #79 was built to**: `repair: { ran: false, why: "time", routes: ["/"]
  }` — the page call had taken 300 s for one page and the room at the seam
  was about 100 s — and the reply said "I ran out of time to try a fix for
  /, so it's published as it is". Right by construction and right by luck:
  no fix a page writer can make puts locale data into a browser.
  **OPEN, owner's call — the fix is a platform decision, not a page fix.**
  (a) Format with the site's language only when the check's Chromium has
  its data, else with English — decided at build time in the container
  and BAKED beside `SITE_LANG` the way `langLabel` is — so every visitor
  sees the same thing, which for a Welsh site is the English day names
  Chrome shows today. (b) Keep the server's text on hydration for
  locale-formatted nodes (`suppressHydrationWarning`), which the prototype
  patch cannot reach: a kit edit per component, holding until the model
  writes the next one without it. (c) Read a #418 whose two texts are one
  date in two locales as a note rather than a `threw`, leaving the Firefox
  case as it is. Each of the first two rolls the container. **Until one is
  chosen, every addon on fretwork-1 will be BROKEN on this finding and the
  harness's exit red, with the product right** — a verdict on a property of
  the container's pair of runtimes, now with the cause on the wire instead
  of a number.

- **THE SECOND LANGUAGE NEVER TRANSLATED, AND NOTHING SAID SO (2026-09-04,
  owner: *"when i switch languages they dont change, you see it?"* → *"we
  need to see why the edit path didnt do it right, lets try it again"*).**
  fretwork-1 serves `/es` and `/fr` with the English words under `<html
  lang="es">` and `"fr"`, since the lane sweep's `langs` case added both on
  2026-09-01/02 — and that case judged the switcher and the head, never a
  translated word, so it called the lane proven. **What the spine does**: on
  every publish it translates each extra language's missing strings
  (`translateStrings`, ONE call per language) and assembles the variant off
  the cache; a failed translation falls back to the primary wording BY
  DESIGN — it must not fail the customer's edit — and the only record was
  `console.error("translate failed", …)` in the Worker's log. The recorded
  "a failure that cannot name itself", on the one step of the spine with no
  trace mark. **Known and not known**: the call is `claude-haiku-4-5` on
  Anthropic — the one small call NOT moved to the picker's model on
  2026-08-31, when Anthropic refused on billing and run 93 died in 5.3 s —
  the languages were added the day after, and every string of both variants
  is English, so no call has succeeded since. The exact error is NOT read:
  the Worker's log is reachable only through the `container logs` workflow
  (its window is hard-coded in the YAML and set by a push). **So the
  instrument first, the fix on the evidence** — the owner's call, to see it
  through the edit path: the spine marks `translate:<tag>` start / ok /
  fail on the trace with `missing`, `why` and `error`, carries one outcome
  per language on its result (`langs`, `cached: true` when nothing was
  asked) and the look reply carries it (`langs: pub.langs`); the harness's
  `langs` case asks for a language the site LACKS (German — asking for one
  it has answers "already" and publishes nothing), reads `/de`'s words
  against the home page's through the addon harness's own `strip` and
  `lostSentences` (translated means at least half the primary's sentences
  are gone from the variant), re-reads the variant until the home page's
  build serves it, and prints the spine's account. The build path's copy of
  the loop is unchanged. Guards: `test/wiring.test.mjs`,
  `test/lane-sweep.test.mjs`. **Sweep: 14 mutants, 14 killed, none
  unapplied, the comment-only control survived** — the start and outcome
  marks dropped, the reason dropped, a cached language unaccounted, the
  result and the reply without `langs`, the fallback removed; the ask naming
  a language the site has, the case without a variant, the check ignoring
  the words or the switcher, the runner reading once or dropping the words,
  the note without the account.
  **RUN 38 (2026-09-04 20:15Z, `harness: lane`, `lanes: langs`, "Also offer
  the site in German", 7 → 6): THE INSTRUMENT ANSWERED ON ITS FIRST RUN.**
  Job `b94ff5d2…`, **1 credit, 221 s**, `mtnbaddj-a3d38n` → `mtne9wtv-qf042o`.
  The lane itself works: `pick_lanes` named `langs` in 4.3 s, the lane
  answered in 4.3 s, `moved: ["langs"]`, `/de` answers 200 on the new build
  and the switcher reads Cymraeg · Français · Español · Deutsch. The
  harness's verdict was `LIE`, rightly: "0 of 23 primary sentences
  translated away" — `/de` is the English words. **The trace names it**:
  `translate:de start {missing: 88, strings: 88, cached: 0}` →
  `translate:de fail {why: "call", error: "anthropic 400"}` in **251 ms**,
  `failed_phase: translate:de`; and NO mark for `es` or `fr` — their caches
  were "full", so nothing was asked. **Two defects, both structural.**
  (1) The call was the one small call still pinned to `claude-haiku-4-5`
  through `anthropicMessages` — Anthropic by address, not by name — after
  run 94 moved the router, the picker and the rungs, and it answered 400 in
  a quarter of a second (the helper kept the API's own words on `e.detail`
  and the instrument carried only the status; fixed, below). (2) **A failed
  round poisoned the cache**: `nextCache` writes a string with no
  translation as ITSELF — right for a name the model was asked about and
  left alone, and written before a call could fail wholesale — so the
  first failed publish stored every string of `es` and `fr` as English,
  `missingFrom` found nothing missing ever after, and no publish asked
  again. "A rule true because of a layer below it expires when that layer
  moves": the rule assumed the model always answered.
  **THE FIX (owner: *"if model is selected to grok everything gotta be on
  grok, and if selected other ones its gotta be on other ones"*).**
  `translateStrings` takes `models` and sends through `quickSend` on the
  picker's `quick` slot — the sender that routes on the model's provider
  and translates the request at the boundary — refusing `unconfigured`
  before the call when the key is missing, Haiku's `thinking` field gone
  with the pin, and a failed call's `e.detail` clipped onto the error. The
  spine takes `models` (the edit route hands `modelsFor(eb.picker)` in
  through `pendingPublish`, the addon route hands `aModels`, the build route
  stores `picker` beside `model` in the design and the consumer hands
  `modelsFor(design.picker)` into `buildAndPublishPages`, which resolves the
  same from `picker` when a caller hands none — `test/build-params.test.mjs`
  caught the stored picker arriving undestructured; the rebuild drain gets
  the default). `untranslated(cache)` (site-translate)
  reads a cache whose every value is its key as no cache and the loop
  starts the language over (`healed: true` on the start mark);
  `nextCache(have, strings, null)` is a failed round, keeping only what
  was already translated so the next publish asks again; the write-back
  compares against the cache as read, so a healed language is not
  rewritten. The build path's copy of the loop mirrors both rules. **The
  reply carries the account through the MERGE** — run 38 printed "the
  spine's account: none" because the look branch read `pub.langs` off the
  deferred publish's stub (the "dropped field has a twin one hop over"
  shape, on the field written to end the guessing); `langs` and
  `langsRefused` now come from `finalPub` where `files` and `render` do.
  Guards: `test/wiring.test.mjs` (the provider, the models through every
  route, the two cache rules on both loops, the merge),
  `test/site-langs.test.mjs` (`nextCache(…, null)`, `untranslated`).
  `test/spine-repair.test.mjs` went red for the change — it pinned the seam
  hook as the LAST parameter of the spine's signature — and was re-anchored
  on the hook being taken and defaulted, wherever it sits. **Sweep: 24
  mutants, 24 killed, none unapplied, the comment-only control survived**
  (22 in the first pass, then two for the builder's own fallback after
  `build-params` caught the undestructured picker) — the pin back to Haiku,
  the call sent to Anthropic by address, a missing key not refused, the
  detail dropped; the spine ignoring or not handing the models, the edit
  route, the addon route, the build consumer and the build loop each handing
  none, the builder ignoring the stored picker, the design storing no
  picker; a failed round still poisoning (spine and build),
  the failure not remembered, a poisoned cache not healed (spine and build),
  a healed cache never written, `nextCache(…, null)` writing fallbacks,
  `untranslated` always false, reading empty as poisoned, reading one real
  translation as poisoned; the merge dropping `langs` or the refused list.
  **The case asks for German OFF now** ("Stop offering the site in
  German"): run 38 left the site at `MAX_EXTRA_LANGS`, so asking for German
  again answers "already" and publishes nothing and a fourth language is
  refused at the cap, while a removal publishes just the same, and the
  proof is the SPANISH page — its poisoned cache read as none, both
  languages asked again on Grok, `/es` translated, `/de` a 404 (the harness
  reads both, re-reading a stale edge copy until the new build serves it),
  the account in the reply.
  **RUN 39 (2026-09-04 20:47Z, `harness: lane`, `lanes: langs`, "Stop
  offering the site in German", 6 → 5): THE SECOND LANGUAGE IS PROVEN LIVE,
  ON GROK.** Job `8a6affbc…`, trace `e_mtnfesxolqq0bydi`, **1 credit,
  682 s**, `mtne9wtv-qf042o` → `mtnfl34h-8uuf06`. The picker named `langs`
  in 4.2 s, the lane answered in 4.2 s, and the spine did what it had
  never done on this site: `translate:fr start {missing: 88, strings: 88,
  cached: 0, healed: true}` → `ok` in **152.6 s**, `translate:es` the same
  → `ok` in **124.3 s**, both on `grok-4.6`, and the reply carries `langs:
  [{fr, 88, ok}, {es, 88, ok}]` through the merge. On the site: `/es` in
  Spanish — "Reservar una clase de guitarra", "Los ocho primeros acordes",
  the chord names, the opening hours, the quotes
  (`docs/edits/lane-run39-es.png`, the whole page; `-top.png` the fold) —
  `/fr` in French, `/de` a 404, the switcher Cymraeg · Français · Español.
  The harness's verdict, `ok`: "19 of 23 primary sentences translated away;
  /de answers 404 (gone)" — the first green `langs` case that read a
  translated word. `publish:1` 664 s: the two translations 277 s in
  series, the compile ~216 s, `archive` **139 s** (38 s on run 38).
  **Four findings on the way, none the fix's — the first fixed the same
  night, the other three filed (#87–#89):**
  (1) **THE TRANSLATION CALLS WERE NOT BILLED ON THE EDIT PATH — FIXED THE
  SAME NIGHT (owner: *"ok charge it properly, go"*).** The spine carried
  their usage on its result (`langUsage` — "so somebody can bill them", its
  own comment) and the edit route read it nowhere: every rung's publish is
  deferred through `publishStep`, the one spine runs below the loop as
  `finalPub`, the merged reply's `cost` is the sum of the steps' own
  charges — each computed BEFORE the spine ran — and the rungs that hand
  their `xPub` to `eCharge` hand the deferred STUB, which has no usage: the
  argument was right when each rung published synchronously and went inert
  when the publish was deferred ("a rule true because of a layer below it
  expires when that layer moves"). **Now the spine charges them through the
  caller's own funnel**: `recompileAndPublish` takes `charge` and calls it
  ONCE with every translation call of the publish, after the last
  translation and BEFORE the compile and the gate — the addon repair round's
  rule, so under a job the reserve stands when `edit_may_publish` reads the
  row and a free rung that translated is `reserved`, not `exempt`; a funnel
  that throws never fails the publish; `translate:charge` is marked;
  `langCharged` rides the result. The edit route hands `eCharge` itself
  (`pendingPublish.charge`) — one more sequenced reserve under a job, one
  more collect otherwise, priced by the same `pageCredits`, pushed onto the
  same `billedAll` — and the merged reply's `cost` adds `finalPub.langCharged`.
  The addon route hands `aChargeLangs`: reserve **#3** under a job (the bill
  is #1, the repair round #2; `edit_reserve` is idempotent per sequence and
  asks no order of them), the usage joining the one synchronous collect. The
  owner's wording edit — the words are free, their translation is not, and
  it is the one edit that always has new strings — collects on the owner's
  balance and says `cost`. The BUILD path's copy of the loop, which
  discarded `got.usage` outright ("a pre-existing gap", its own comment),
  keeps it now: it rides the compile result (`built.langUsage`) and
  `publishPages` folds it into the ONE `pageCredits` that prices the build —
  one rounding, no second floor. The platform rebuild drain hands no funnel
  and translates for nothing, as it always did. `langCost` is gone. **The
  second charge floors at 1 like every charge** — a bilingual edit that
  translates something costs a credit more; the owner chose that over
  folding it into the lanes' bill, which under a job is placed before the
  spine can know what the translations cost. **And the driven case found a
  second gap under the first**: `translateStrings` handed out the API's RAW
  usage (`input_tokens`…, no `model`), which `pageCredits` reads as no
  tokens on no model — so a translation on the bill would have cost its
  floor and nothing of what it really cost. It reads through `laneUsage`
  now, the lanes' own reader. Guards: `test/wiring.test.mjs` (the spine's
  body by brace depth — the first draft walked the PARAMETER list's braces
  and called them the body — the block's place between the cache write and
  the compile, both routes' funnels, the wording edit, the drain's absence,
  the build hop); `test/edit-path.test.mjs` DRIVES a bilingual site through
  the real route against the ledger: two charges, `cost` their sum, three
  calls on the receipt on one model, the translation cached;
  `test/publish-pages.test.mjs` drives the build's one bill with a
  translation dear enough to show. Four guards went red for the change and
  were re-anchored, not appeased (the charge-after-work scan reading the
  funnel's arrow as a charge; the addon's collect line and job sum; the
  deferred publish's object). **Sweep: 23 mutants, 23 killed, none
  unapplied, the comment-only control survived — one survived the first
  pass and it was the guard's fault**: the drain's window ended at its label,
  so a funnel inserted a line below was never in view. **Not proven live**:
  the next bilingual publish with something new to translate is the proof —
  "Also offer the site in German" on fretwork-1 (a third language, 88
  strings: lane 1 + translation 1, balance 5 → 3), or a wording change on
  its home page.
  (2) **WHAT STAYED ENGLISH IS TEXT THE PAGE SOURCE DOES NOT CARRY**:
  `collectStrings` reads the pages, so the kit components' built-in labels
  (Your name / Email / Send, Opening hours, Closed, the calendar's legend),
  the QR caption (baked from the stored list's `label`) and the text inside
  the site's own `-parts/` are never asked about. A variant is translated
  exactly as far as the page source goes.
  **SIZED 2026-09-06 (task #89) AND IT IS THREE FEATURES, NOT A FIX — owner's
  call which, if any.** They share a sentence and nothing else. (a) **The
  site's own `-parts/`**: `translatePages` gives each language its own PAGE
  file through `pageForLang`, but the parts are written once and shared by
  every language, so translating them needs per-language part copies AND the
  variant pages' imports rewritten to their own — a naming rule, the
  container's write loop, the cap, and a guard that a variant never imports
  the primary's part. Medium, self-contained, and the smallest visible win (a
  word or two per site). (b) **The QR caption**: baked into `site-brand.ts`
  from the stored list's `label`, one string per code, so it needs a
  per-language value baked or looked up. Small, but it touches what every
  publish bakes. (c) **The kit's own labels**: 2,112 components with English
  written into them, and the most VISIBLE of the three — a contact form says
  Your name / Email / Send under any `<html lang>`. That is a kit-wide
  internationalisation project, not a translation fix, and it is where the
  customer's complaint actually comes from. **Doing (a) or (b) alone leaves
  the page mixed**, which is the same complaint, so the order that pays is
  (c) first or none.
  (3) **THE RENDER CHECK REPORTED A 6 s NAVIGATION TIMEOUT AS `threw`** on
  `/` at the phone viewport (`page.goto: Timeout 6000ms exceeded`,
  `checked: 4, partial: true`), and the customer's reply says "/ threw an
  error" for a container that was slow, not a page that broke — an
  instrument's timeout wearing the page's failure, the recorded "a failure
  that cannot name itself". **FIXED 2026-09-06 (task #87, owner: *"SO FIX
  ?"*), as its own kind outside `SERIOUS`.** `isNavTimeout` is ONE predicate
  with two readers — `render-check.mjs` holds the real Error and Playwright
  names a navigation timeout `TimeoutError`, `readPage` sees only the string
  it kept — so the catch sets `obs.timedOut` and the message is the belt for
  an observation that travelled as JSON and lost it; each half is driven
  alone, because a flag with an unmatched message and a message with no flag
  are both real (the check clips to 200 characters and Playwright's wording
  moves between versions). `slow` is NOT serious, deliberately: the repair
  round must not buy a fix for a page that never failed and the harness must
  not stop a run on it — which is what run 39 cost. **`resolveSlow` escalates
  the one case where we CAN tell**: every route is opened at two widths, so a
  route whose EVERY attempt timed out is `threw` after all ("did not open at
  any width"), while **one** attempt that timed out stays `slow` — the loop
  stops at a budget, so a route can be opened once and never again, which is
  run 39's own shape, and escalating that would put us back to blaming a page
  nobody managed to look at twice. Cannot-tell must never read as broken, the
  mirror of the rule this codebase already keeps. `crashedRoutes` in the addon
  harness DERIVES from `SERIOUS` now instead of listing `threw` and `blank` by
  hand — the same set said twice, which would have disagreed the moment `slow`
  arrived. **Sweep: 21 mutants, 21 killed, none unapplied, two comment-only
  controls survived — two survived the first pass and both were the guards'**:
  a truthy-rather-than-strict flag (every fixture set it to `true`, so the
  coercion was invisible) and Playwright's error NAME going unread (the
  fixture's message also matched the regex, so the belt answered for it).
  Both driven and re-run to a kill. Full suite 5,362. **Not proven live**: the
  next slow container is the proof, and the line to read is `/ took longer to
  open than the check waits` where the reply used to say `/ threw an error`.
  (4) **LANGUAGES TRANSLATED ONE AT A TIME**, 124–153 s each on Grok: a site
  with three fresh caches spent ~7 minutes of the 840 s job before the compile
  had started. **FIXED 2026-09-06 (task #88, owner: *"SO FIX ?"*)** — both
  loops, the spine's and the build path's, run their languages through ONE
  `Promise.all` and fold the answers afterwards. The calls never depended on
  each other: each asks about the same strings for a different tag. Run 39's
  277 s of French-then-Spanish becomes the slower of the two, ~153 s.
  **`Promise.all` cannot reject here, and that is a property rather than
  luck**: `translateStrings` catches everything and answers `{ok: false}`, so
  "a failed translation is not a failed publish" survives intact — and a
  rejection would have taken the publish down under the serial version too,
  there being no try around the await. **THE FOLD IS SEPARATE AND ORDERED**:
  the calls settle in whatever order they finish, but `langOutcomes`,
  `langUsage` and `nextStrings` are built in `siteLangs` order, so the wire is
  the same whichever came back first; the trace marks stay INSIDE the call, in
  completion order, because they are timestamped events and folding them would
  report every language as having taken as long as the slowest.
  `collectStrings` is read ONCE for all of them in three places (both loops and
  `filesFor`) — it never depended on the tag and was being re-run per language.
  **Sweep: 17 mutants, 17 killed, none unapplied, the comment-only control
  survived — one survived the first pass and it was a real guard gap**: the
  build path's write-back comparing against the healed cache rather than the
  cache as read, which the spine's half has been guarded on since run 38 and
  this one never was. It bites on the one shape that is not cosmetic — a
  language healed and then failing merges to `{}`, equal to the healed value,
  so it would read as unchanged and leave the poison on disk. Guarded and
  re-run to a kill. Four older guards went red for the change and were
  re-anchored, not appeased, each naming the spelling that moved. Full suite
  5,363. **Not proven live**: the next multilingual publish is the proof, and
  the tell is two `translate:<tag> start` marks with overlapping timestamps.

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

**A CONTAINER WITH NO ROOM IS WAITED FOR, NOT FAILED (2026-09-04, the
capacity review; owner: *"im more concerned about the container/worker"*).**
`@cloudflare/containers` answers a start the account cannot make as a
RESPONSE, never a throw: a plain-text **503** ("There is no Container
instance available…" — the account's concurrent ceiling, verified against
Cloudflare's limits page as 6 TiB / 1,500 vCPU, ~1,536 live `standard-1`,
or an image still provisioning after a deploy), a **429** ("you are
requesting too many containers per second", threshold undocumented), and a
**500** "Failed to start container: …" for anything else. Neither publish
path recognised them: the spine parsed the text as JSON, threw on it, and
told the customer *"didn't compile — try describing it differently"*
(refunded, but `ours: false` and the customer's words blamed); the build
path retried once with no delay and shipped a placeholder. Now
`builder/container-room.mjs` (dependency-free, driven with a fake clock):
`containerRoom(status, text)` classifies ONE answer — the status AND the
words, a JSON body never (the build server judged something), unknown text
never (a wait is right only for a failure known to pass) — and
`withRoom(call, { deadline, floorMs })` repeats the call with jittered
backoff (`rate` 1→8 s, `full` 5→30 s, never faster than the 2.5 s cold
start) while the next wait plus the compile's floor (`MIN_BUILD_MS`) still
fits before the caller's cap; each attempt's own signal is what is LEFT of
that one deadline, so the wait and the call share a clock. Both compile
call sites go through it, the payload built once as `cPayload` /
`bPayload` before the loop — six guards pinned to the inline body, the
fetch's own signal and the two-term `ours` disjunction went red and were
re-anchored on the property, each naming the spelling that moved. When the
wait runs out: the spine answers `room`, marks `ours`, and `compileMsg`
says which of the three (`roomSentence` — full is minutes, rate a moment, a
start failure not waited for); the build path answers `stage: "build"`
(free, `ourFault`) with `room`, `publish-pages` skips its immediate retry
and the note says "had no room… send it again in a few minutes". Trace:
`container wait {kind, attempt, delayMs}` per wait, `start` carries
`waited` and `tries`. `test/container-room.test.mjs` reads the library's
OWN three answers out of node_modules (a reworded library is a wall that
stopped matching), drives the loop, drives `compileMsg`, and reads both
call sites; `test/publish-pages.test.mjs` drives the no-room build.
**Sweep: 24 mutants, 24 killed, none unapplied, the comment-only control
survived — one survived the first pass and it was INERT against the
fixtures** (the JSON rule: every JSON fixture also lacked the words, so
the status-and-words check refused them anyway; two fixtures carrying the
words inside JSON made it load-bearing). Suite 5,044. **Not proven live**:
it needs the account full or a burst of starts, which is a launch, not a
harness — the trace's `container wait` mark is what will show it.

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

### THE JOB RUNS INSIDE THE SITE'S CONTAINER (2026-09-05, task #93)

Owner: *"most of the stuff should be in the users container, not our worker"*
→ *"yeah that stuff gotta run on container tho"*. A queued edit or addon held a
Worker queue invocation for its whole length — routing, lanes, the page call,
the translations, the compile wait, the publish — under a fifteen-minute
ceiling, 250 at a time, and evicted by every deploy (#52). Now **the Worker's
own module runs inside the site's container as the job runtime**: the SAME
`worker.js`, imported under Node, executing the SAME consumer function, and the
Worker's consumer only fires the job and returns. One definition of the
pipeline; the whole suite still describes the thing that runs.

```
queue consumer ─► fireContainerJob ─► POST /job/run on laneName(job.slug) ─► returns in seconds
                                          │
              build-server.mjs spawns  node --import worker-register.mjs container-job.mjs
              (a CLEAN env; the launch — job id, gateway url + token, the string secrets — on STDIN)
                                          │
              container-job.mjs → makeContainerEnv → import("../worker.js") under the loader
              → worker.runContainerJob(env, ctx, { kind: "edit", id }) = runQueuedSiteEdit, to the end
                                          │
              R2 through the gateway: https://gofarther.dev/api/job/<id>/r2?key=…  (a signed, slug-scoped token)
              the compile: getContainer(…).fetch("http://build/build") → the shim → http://127.0.0.1:8080/build
```

- **The loader** (`builder/worker-loader.mjs`, registered by
  `worker-register.mjs` through `node --import`): three mappings and nothing
  else — `cloudflare:*` → `cloudflare-shim.mjs` (the DO base classes as
  shells; nothing instantiates one on this path), `@cloudflare/containers` →
  `containers-shim.mjs` (`getContainer(…).fetch` rewrites `http://build/…` to
  the build service on localhost; **the lane name is ignored, because the job
  runs IN that lane**), `@cf-wasm/photon` → its own Node build — plus an
  extension repair for the containers library's extensionless relative import.
  Measured: `worker.js` imports under Node in ~555 ms.
- **The gateway** (`builder/job-gateway.mjs`, BOTH ENDS in one module so the
  shim is driven against the real handler): a `v1.<payload>.<sig>` token —
  `{ id, slug, uid, exp }`, HMAC-SHA256 under a key DERIVED from
  `SITE_SECRETS_KEY` and never that key itself — minted by the consumer,
  verified on every request, nothing stored, expiring with the job's clock plus
  `JOB_TOKEN_GRACE_S` (900 s) for the finalize. `allowedJobKey` is the wall:
  the site's six prefixes (`sites/ source/ versions/ uploads/ backups/ builds/`
  + slug), its config object, its pointer (`current/<slug>.json`), its sidecar
  (`sitemeta/<slug>.json`) and its orphan marker (`orphans/<slug>.json`), the
  job's own `jobs/` objects by id; `..` refused. **A key outside it is 403 AND
  LOGGED WITH THE KEY** (`job gateway refused: out-of-scope`), so the first
  live job on a site says exactly which key it needed that the list lacks,
  and the answer is a line there, never a wider wall. **STAGE 4a (2026-09-05,
  owner: *"go"*) ADDED THE SIDECAR AND THE MARKER, AND TYPED THE REFUSAL.**
  Every publish reads the previous sidecar for its redirect map and writes the
  new one at activation, and the read is fenced as best-effort — so the first
  runner publish would have lost the site's redirects and share tags with
  nothing in the reply; `test/container-runtime.test.mjs` had asserted both
  keys REFUSED. The wall spells them (the module is dependency-free for the
  container's sake) and `test/gateway-refusal.test.mjs` holds the spelling to
  `siteMetaKey`, `P_ORPHANS`, `POINTER_KEY` and `CONFIG_KEY` — every
  single-object key the Worker writes for a site, admitted for that site and
  refused for another. And `GatewayBucket` throws `GatewayError` — `code`
  (`forbidden` for 401/403, nothing a retry fixes; `transient` for the rest),
  `status`, `key`, `op` — where it threw a plain Error on every non-2xx but
  404 and 412, so a refused key read exactly like an R2 outage and reached
  the customer as "our build service was restarting". The spine's stage and
  activation catches carry `code` and `key` onto the refusal and the trace
  (the activation is WRAPPED now: a store that refuses the pointer write
  threw out of the module and escaped to the route's catch), and `compileMsg`
  names a forbidden write as ours with the key — "our storage refused to
  write “sitemeta/…”, so nothing was changed. This is on us" — while a
  transient one keeps the restarting sentence; a forbidden code that is
  theirs is still theirs. `compileMsg` is DRIVEN (evaluated out of the
  source with `roomSentence` stubbed) rather than read. Runtime round-trips
  through the real handler for both keys, a 403 and a 401 as `forbidden`, a
  500 as `transient`, a batch delete naming the key it stopped on. **Sweep:
  18 mutants, 18 killed, none unapplied, three comment-only controls
  survived** — every refusal reading as transient, a refused token as
  transient, `get` / `put` / `list` back on a plain throw, the batch
  refusal losing the key the wall named, the status not kept; the wall
  refusing the sidecar, refusing the marker, admitting every site's
  sidecar; the spine's stage catch and stage refusal dropping the code and
  key, a throw out of activation reading as a publish, the activation
  refusal dropping them, the sentence never naming a refused write, the
  sentence without the key, a refused write that is theirs named as ours,
  the stage mark without the code and key. Full suite 5,148 green. **Not
  proven live** — the proof is the 5a canary's first job through the
  runner, whose publish now writes both keys through the wall. Mounted at the top of `handleRequest` on the APP zone only. R2's
  own shapes on both sides: metadata as headers, `onlyIf` as `x-gf-if-*`, a
  failed condition 412 → the shim answers `null` the way R2 does (the resume's
  claim depends on it), a missing object 404 → `null`.
- **The env** (`builder/container-env.mjs`): the string secrets as they are,
  `SITES_BUCKET` = `GatewayBucket`, `BUILD_QUEUE` = a loud refusal (nothing on
  the edit path sends), `SITE_BUILD_CONTAINER` = a marker the shim ignores,
  `SITE_ROUTES` absent (an optional cache whose miss falls back to Supabase),
  `SUPABASE_SERVICE_KEY` and `CREDITS_MINT_SECRET` = **`SB_MARKER`, a tell and
  never a credential** (stage 4b, below), nothing else. `ctx.waitUntil`
  collects and the runner drains it before it exits.
- **THE SECRETS TRAVEL ON STDIN, NEVER IN THE ENVIRONMENT** — `build-keys.mjs`'s
  rule (the container executes model-written page code in a child that
  inherits env). `JOB_ENV_NAMES` is an explicit list: the provider keys, Neon,
  fal, the CF token and account, the secrets key, the flags; never Stripe,
  Composio or Domain Connect — **and since stage 4b never the service key or
  the mint.** The model's page code never runs in that process — the render
  child gets its clean env from the build server, as before.
- **SUPABASE THROUGH THE GATEWAY — THE SERVICE KEY AND THE MINT SECRET LEFT THE
  JOB PROCESS (2026-09-06, stage 4b, owner: *"finish the missing steps"*).**
  Until this the job process held both for the job's length, because the
  Worker's code reaches Postgres directly — `editRpc` (41 call sites, every
  `edit_*` RPC with the mint as `p_mint`), `svcHeaders` (41 more) and eighteen
  inline header builders, all of it `worker.js` against the module constant
  `SUPABASE_URL` (never an env value; inventoried before the design, not
  guessed). Now: **the launch is v2** (`sb: { url: SUPABASE_URL }`, no
  Supabase credential — `readLaunch` refuses a launch carrying either name
  (`LAUNCH_NEVER`), and refuses v1, which is the pre-4b Worker's inline path
  through the 400; the new Worker's v2 on an old image is the same 400, the
  same path); **`makeContainerEnv` puts `SB_MARKER` (`gf-gateway`) under both
  names**, so every helper's own presence check (`if (!env.SUPABASE_SERVICE_KEY)`)
  passes untouched — zero call-site changes; **the runner installs
  `gatewayFetch` in front of the process** (`installGatewayFetch`, before the
  import and the env, restored after), which sends a request to the Supabase
  ORIGIN that presents the marker as `apikey` or bearer to the gateway's
  `/sb/<path>` with the job token, the path, query, body and the caller's own
  `signal` kept, and lets everything else out untouched — the customer's own
  calls (the anon key with their JWT, `authUser`, `credit_debit`), the
  providers, Neon, the CF API, the build service, the R2 gateway itself; **the
  Worker's handler injects the real key and mint** and forwards, for what
  `sbDecision` admits: `SB_RPCS` (the twelve `edit_*` RPCs a job makes, each
  bound `p_id` = the token's job; `edit_handoff`'s `p_slug` bound when named;
  `deploy_gate_read` unbound; `credit_reverse` bound to the owner and to a
  `build:<id>…` ref — the build path's, for 5b) and `SB_TABLES` (a read's
  bound filter present as `eq.<the token's value>` — PostgREST ANDs top-level
  filters, so one confines the rest; a write's every row carrying the bound
  fields; `site_aliases` readable by any label because an address is public;
  no `PATCH` anywhere; a `select` with `(` or `!` refused as an embed; the
  body RE-SERIALISED from what was checked so a duplicate key cannot pass one
  value to the wall and another to Postgres). Anything else — the sweeps,
  `edit_create`, `rebuild_claim`, `add_credits`, the auth admin API, storage,
  functions, the Worker's tables — is **403 and LOGGED with the op and the
  reason** (`job gateway refused: sb-out-of-scope`), the R2 wall's rule: the
  first live job says which call it needed that the list lacks, and the answer
  is a line in `SB_RPCS`/`SB_TABLES`, never the key back in the container. **An
  RPC Supabase refused comes back as its STATUS with a scrubbed body** —
  PostgREST quotes the request it refused, and that request carries the mint
  (the reason `editRpc` never read a body); a table error keeps its body (no
  platform secret in a table request; the customer's `detail` names the
  constraint). `site-secrets.mjs` refuses the marker as v1 key material and
  writes nothing under it (v1 derived the vault key from the service key's
  name, with a fallback chain that would have quietly derived a key from a
  constant in this repository). The token check, the id match, the 1 MB cap
  and a 20 s forward clock are the branch's; a Supabase that cannot be reached
  is 502. Guards: `test/sb-gateway.test.mjs` — the wall rule by rule with
  literals, the handler against a fake Supabase (the forward, the injection,
  the scrubbed RPC error, the passed table error, 401/403/503/502/413), the
  shim (what is rewritten, what goes out by identity), **THE REAL CONSUMER
  END TO END** (`runJob` → the real `runContainerJob` inside a container env
  whose fetch is the shim, wired to the real handler, wired to a fake
  Postgres: its claim, takeover and refund arrive with the real key and mint,
  and nothing that left the container carried either — every request on the
  wire the gateway's, the job token its bearer, the marker its mint), the
  launch, the runner's install and restore, the env's markers, the list, the
  vault, and the lists held to the code (every admitted RPC is one the Worker
  calls; every `editRpc` call is admitted or named Worker-only; every job-path
  helper's table is admitted with its method, read off the helper);
  `test/container-job.test.mjs` re-anchored (v2 launches; the spawned real
  runner's claim read off a real socket at a gateway STUB — the `/sb/` path,
  the bearer, the marker; the secrets guard holding the helpers' reads to the
  markers; the fire driven: v2, the origin, no credential in the launch; the
  Worker's mount driven: its own key and mint on the forward, a Worker-only
  RPC refused); the container harness's `/job/run` case drives the same
  through the real service (a v1 launch 400, a leaking v2 launch 400 naming
  the name, the claim on the stub's socket) — **`site build` 359/359**
  (355 before). **Sweep: 42 mutants, 39 killed, none survived, none
  unapplied, three comment-only controls survived** — the RPC binding
  ignored, the optional binding never bound, a job's own mint admitted, the
  marker forwarded as the mint, an RPC or a table outside the list admitted,
  the bound filter not required, a written row not bound, an embedded
  select admitted, a method the rule lacks admitted, the write forwarded as
  sent, the job's bearer forwarded to Postgres, an RPC's error body passed
  back, a refusal not logged, no Supabase read as configured, the body cap
  dropped, another job's ref reversed, every response header handed back, a
  request header outside the list forwarded; the customer's own call routed
  through the gateway, the origin not the belt, the marker travelling as an
  apikey, the token not sent, the caller's clock dropped, the env without
  the markers, a handed key surviving into the env; a v1 launch admitted, a
  launch with the credential admitted, the origin not required, the shim
  never installed, the process's fetch not put back, the env built without
  the origin; the two names back on the list; the fire sending v1, naming
  no origin, still sending the credential; the mount handing no Supabase;
  the marker deriving a v1 key, a secret written under it. **One survived
  the first pass and it was the guard's fault**: the restore of the
  process's fetch was asserted AFTER the test's own `finally` had restored
  it — vacuous by construction, the recorded "a guard proves the branch it
  drives" shape; read before the test's restore now, re-run to a kill. Full
  suite 5,294 on the 4b tree (5,275 + the eighteen and the mount case).
  **What the wall does NOT cover,
  stated**: a job's vault reads (none on the job path today; a v1 row is
  "cannot decrypt" in the container); the Worker-side reconcile's dispatch
  probe (`env.SITE_WORKERS`, a binding the container never had — `live` is
  null there, the verdict `unknown`, said once); the build path's
  `credit_debit` (the customer's own JWT, not a platform secret — direct).
  **Not proven live**: fretwork-1's first edit through the runner (the 5a
  canary) proves both — `job runner: fired <id>` and no `sb-out-of-scope`
  line; a refused op names the call the list lacks. The merge rolls the
  container (`worker.js` and the builder modules are image inputs).
- **The build service** (`POST /job/run`, answers in this order): 413 (over
  1 MB), 400 (a launch it cannot read), **503 while the Worker tree does not
  import** — `checkWorkerTree`, asked ONCE at startup by spawning
  `container-job.mjs --check`, so a tree missing a module becomes the Worker's
  inline path rather than a child nobody is waiting on — 409 (that id already
  running here), 429 (`MAX_JOBS` 4), 500 (the spawn failed), 200
  `{ ok, id, pid }`. The child: `cleanChildEnv` (PATH, HOME, LANG, NODE_ENV,
  the port, the id — nothing of the service's own), outside `oneAtATime` (the
  job's own compile comes back through `/build` under it; on the chain the job
  would wait on itself), holding `_busy` for the child's life so the idle
  clock cannot stop the container under a running job. `GET /job/<id>` reads
  the record; the child's lines are logged as `job <id> out: …`.
- **The fork** (`fireContainerJob`): off → no read at all; the job object is
  READ AND LEFT (the runner reads and deletes it after its own claim); the
  flags per identity; no secrets key → inline; the fire waits for room
  (`withRoom`, `JOB_FIRE_MS` 90 s, one clock across the attempts); `fired`
  ONLY on 200 `{ ok: true }`. Anything else — 404 (an older image without the
  endpoint), 429, 503, a throw — is the consumer running the job itself
  exactly as before, said so in the log (`job runner: inline <id> — <why>`).
- **Flags — THE CANARY NAMES `fretwork-1` BY THE DEPLOY'S OWN DEFAULT SINCE
  2026-09-06 (stage 5a, owner: *"finish the missing steps"*); THE BROAD FLAG
  IS OFF.** `JOB_RUNNER_CANARY` (identities; `-` is nobody; no wildcard) and
  `JOB_RUNNER_EVERYONE` (affirmative words only) — `EDIT_ASYNC`'s two-door
  pattern. Both were off from 2026-09-04 to 2026-09-06. This session cannot
  set a GitHub secret, so the canary went on through `deploy.yml`'s fallback
  (`|| 'fretwork-1'`); a secret still overrides it — `-` turns it off, another
  slug moves it. `test/container-job.test.mjs` holds the shipped defaults to
  ONE site — a slug, never an account — and the broad flag off (it held both
  to "off" before; re-anchored, the comment says which property moved).
  **Turning the second word on is stage 5e and is the owner's** — the bullet
  below says what the flip is and what it changes.
- **The image — `Dockerfile` IS AT THE REPOSITORY ROOT NOW.** `builder/Dockerfile`
  is gone, `wrangler.jsonc` says `./Dockerfile`, the root `.dockerignore` keeps
  the context small, and every COPY source is root-relative
  (`builder/build-server.mjs`). The Worker's module graph is laid out under
  `/app/worker/` exactly as the repository is — the root modules, `builder/`,
  `builder/theme-candidates/`, `builder-game/game-gen.mjs`, **115 files in the
  closure** — with `npm ci --omit=dev` off the ROOT lockfile.
  `test/dockerfile.test.mjs` walks the closure from `container-job.mjs`
  through `worker.js` (the walker descends `.js` now; a dynamic import that
  leaves a tree is the other program's), checks each file lands where its
  imports expect (`builder/x.mjs` → `./worker/builder/`), that every bare
  package is a production dependency, a builtin or a shim, and that no COPY
  source is dockerignored. The game image is untouched.
- **THE COST, STATED: A WORKER PUSH ROLLS THE CONTAINER AGAIN.** `worker.js`
  and the builder modules are image INPUTS now (`container-images.test.mjs`
  says so by name), so the 2026-09-04 property "a Worker-only push rolls
  nothing" is gone for as long as the container carries the Worker's code —
  which is the design. **MEASURED on deploy 2029 (2026-09-05 00:22Z, the
  first off the root context): the image step 2m20s** — every layer rebuilt
  (the moved Dockerfile's instructions matched nothing cached: apt 35 s, the
  template's `npm ci` 13 s, the worker tree's 1 s, the push 64 s), 151
  inputs, `built isibi-app-sitebuildcontainer:b8fa5420d4b3a898`, Wrangler's
  container deploy `EDIT`ing the app from `d902dc4c…` to it — **the whole
  deploy 3m09s**, the roll at 00:25:10Z. **The 15–20 minute hold before
  container work applies to EVERY code push now.** Docs, test and harness
  pushes still build nothing (the test-only push that followed ran no deploy
  at all: `deploy.yml` ignores those paths).
- **Version skew inside the roll window**: a job fired in the minutes after a
  deploy may run on the PREVIOUS image's Worker tree. A tree without
  `runContainerJob` is refused at the door (503 → inline); a tree that has it
  runs the previous deploy's code for that job.
- **Guards**: `test/container-runtime.test.mjs` (the loader, the real import
  in a spawn, the token, the scope, the shim round-trips against the real
  handler and a fake R2, the env, the ctx), `test/container-job.test.mjs`
  (the launch, `runJob`, the entrypoint on a bad launch, **THE REAL RUNNER ON
  A SECRETLESS LAUNCH, END TO END** — the Worker imported under the loader,
  the consumer run to its own `no-service-key` refusal with no network, exit
  0; `checkWorkerTree` and `startJob` DRIVEN out of the build server's source
  with the real spawn; the flags; the secrets list held to `editRpc`'s reads;
  the fork through the real queue handler in every case; the gateway mount
  through `worker.fetch`), `test/dockerfile.test.mjs` (the worker tree), and
  the container harness's `/job/run` case through the real service. **Sweep:
  69 mutants, 69 killed, none unapplied, the comment-only control survived** —
  66 in the first pass; of the three survivors one was the sweep's own inert
  mutant (two branches, both 401 — the recorded trap, replaced), and two were
  real gaps each closed by a guard and re-run to a kill: the mount matched
  anywhere in a path (now anchored at its start, `/s/<slug>/api/job/…` is a
  site's route), and the runner's failure exit was unobserved (now driven: a
  runner started without the loader says so on its one line and exits 1).
  **The end-to-end runner test killed a dispatch mutant the text read had
  covered** (`runContainerJob` sending an edit to the build consumer) — the
  reason it exists.
- **NOT PROVEN LIVE — AND THE CANARY IS ON FOR `fretwork-1` SINCE 2026-09-06
  (the flags bullet above).** The proof is the owner's dispatch: one edit on
  fretwork-1 (~1 credit, `lane-sweep.yml`, any acting lane); the Worker log
  says `job runner: fired <id>`, the build service's log carries `job <id>
  out: {"job":…,"started":true}` … `"done":true`, and the reply arrives
  through the poll route as always. The plan's other two canary cases are
  free at today's balance (5 credits, read live 2026-09-06): an add-on ask is
  the refused-reservation stop (stage 1a: the credits sentence, the build
  unmoved, nothing charged), and the second edit's job through the runtime is
  the repeat. Then `JOB_RUNNER_EVERYONE=on` is stage 5e, the owner's, after
  4b and 5d and the proof.
- **A CHILD IS STOPPED WHEN IT SHOULD BE (2026-09-06, stage 5d, owner:
  *"finish the missing steps"*).** Nothing stopped the job PROCESS before
  this: the job's budget refuses the next phase and the sweep closes a
  lapsed lease, but a child wedged in an await that never settles held the
  container busy for ever (`_busy` stays raised for its life, so the idle
  clock never stopped the instance and the SIGTERM drain waited its
  thirteen minutes on it). Now `builder/job-clock.mjs` (dependency-free;
  the budget spelled as `DEFAULT_JOB_MS` and held equal to `EDIT_JOB_MS` by
  its guard): **the launch carries `deadlineAt`** (the consumer's clock plus
  `EDIT_JOB_MS`; `readDeadline` reads it strictly, now plus the budget for a
  launch naming none), **the build service arms a terminator per child**
  (`makeTerminator`, in `TERMS` beside `JOBS`): SIGTERM `JOB_KILL_GRACE_MS`
  (60 s) past the deadline, SIGKILL `JOB_TERM_GRACE_MS` (30 s) later,
  cleared when the child ends; `stopJob(id, why)` behind **`DELETE
  /job/<id>`** (200 `{stopping, why: cancel}`, 404 unknown, 409 ended); the
  drain giving up stops every running child (`stopJobChildren("drain")`)
  and leaves `JOB_STOP_GRACE_MS` later. The record carries `deadlineAt`,
  `stopping: <why>` while it is being stopped, `stopped: <why>` once ended.
  **SIGTERM is a stop, not a death**: the runner aborts `env.JOB_STOP` (an
  `AbortController` `makeContainerEnv` sets), `makeJobCtx.gate` answers
  `{ go: false, why: "stopped" }` FIRST — ahead of `cancelled` and `budget`,
  the one reason about to become true whatever the others say — and
  `editStopped` refunds as `failed` with its own sentence; a job that cannot
  reach a gate is ended by the runner's belt after `JOB_STOP_GRACE_MS`
  (20 s, `unref`'d, exit `STOPPED_EXIT_CODE` 4), under the service's kill. A
  customer's cancel still travels through the beat (`edit_cancel` → the
  row's flag → the next beat → the gate), unchanged. Guards:
  `test/job-clock.test.mjs` (8, the policy with fake timers),
  `test/job-stop.test.mjs` (9: the launch, the runner's stop driven
  in-process with a fake process, `startJob`/`stopJob`/`stopJobChildren`
  driven with fake terminators and a fake spawn, A REAL CHILD stopped
  through SIGTERM past its deadline, the routes and the drain read, the
  gate driven out of the source, the sentence and the fire read); the
  container harness's `DELETE /job/<id>` case through the real service.
  **Sweep: 40 mutants, 37 killed, none surviving, none unapplied, three
  comment-only controls survived — four survived the first pass, and only
  one was the product's.** C9, a SIGKILL that throws escaping the service's
  timer callback (the guard drove a throwing kill through `stop` and
  `clear` and never FIRED the kill timer — a case added, killed). S5 and
  S6 were INERT: the record's `state` read beside the terminator lookup in
  `stopJob` and `stopJobChildren` — an entry is made at spawn and removed
  in the same synchronous block that records the end, so "has a terminator"
  and "the record says running" are one fact; the redundant read is
  deleted rather than tested and the two mutants re-aimed at what is left,
  both killed. S11, the terminator's kill sending nothing, was the guard's:
  the real-child case accepted a natural end (exit 0) and its gateway stub
  answered at 25 s, inside the window, so a child nobody signalled passed;
  the stub holds a minute now and only the runner's exit code or the
  signal counts — killed. (And this sweep's `S2`, the timers outliving the
  child, took fifteen minutes to be caught: the spawned test process could
  not exit under a pending fourteen-minute timer, which is the finding
  itself, seen from the sweep.)
  **What it does not do, stated**: a stop does not interrupt a model call
  in flight — the job ends at the next gate or by the belt, and the
  reserve is returned by the job's own refund or, if the belt ended it, by
  the lease sweep; the Worker's cancel route does not reach the service's
  DELETE (the beat is the cancel's path; the DELETE is an operator's).
- **A BUILD RUNS INSIDE THE SITE'S CONTAINER (2026-09-06, stage 5b/5c,
  owner: *"finish the missing steps"*).** The edit and addon jobs ran in
  the container since task #93; a build still held a Worker queue slot for
  its design and FIRED its generation into the resume chain — short looks
  every minute, refires, a give-up — because the consumer had fifteen
  minutes and a generation alone can take ten. Now, for the identities the
  runner flags admit, **the Worker's consumer claims the row, puts the job
  object back, fires `kind: "build"` at the site's lane with its own lease
  name as `holder`, and returns**; the runner takes the lease over by name
  (the launch's slug on the handoff) and runs the WHOLE build there —
  design, generation, compile, publish — with **no fire and no resume**:
  `canFire` is false where the queue refuses (`refusingQueue.refusing`),
  so the generation goes to the build service next door through
  `containerPagesCall` and the job waits for it, under
  `CONTAINER_BUILD_BUDGET_MS` (27 min; the launch's clock is
  `BUILD_JOB_MS`, 30 min, the token's expiry and the 5d deadline minted
  from it) instead of the consumer's thirteen; the budget reads
  `env.JOB_STOP`, so a stopped build refuses its next stage and publishes
  the stand-in. **THE TOKEN'S SCOPE FOLLOWS THE NAME** (`buildFireIdentity`):
  a revise, or a chosen name nobody holds, is scoped to the site from the
  start (the wall's uid binding on the claim's row keeps a stranger out; a
  claim lost to a race is the build's own "that name is taken"); a name
  ANOTHER account holds is never fired — the inline path answers its 409
  in seconds with no token minted for a site that is not the customer's;
  a build with NO name yet is fired PRE-SCOPED — `pre: true` in the token
  and the launch, the placeholder `pre-<id>` as its slug and its lane, a
  wall that opens only the job's own `jobs/` objects and the id- and
  uid-bound calls (never a slug-bound one, not even for the placeholder)
  — and `runSiteBuild` asks the env's `JOB_SCOPE` hook the moment the
  designer names the site, BEFORE the recorder, the ownership check and
  the claim: the gateway's **`POST /api/job/<id>/scope {slug}`** re-mints
  the token for a name that is free or this owner's own (read FRESH,
  never the memoized lookup), 403 `taken` for a stranger's (the claim's
  own refusal shape, refunded, 409), 503 when the owner cannot be read
  (refunded, 503 — cannot-tell is never free), 403 on a token that is not
  pre-scoped, 400 on a name the platform would not claim (a non-string
  refused, never coerced). Both shims carry the new token after
  (`rescopeJob`: the fetch shim reads `gateway.token` at call time, the
  bucket's `token` is reassigned). **The row learns the name from the
  holder** after the claim (`rowLearnsSlug`, a self-handoff —
  `edit_handoff` from the holder's name to itself, the one RPC that sets a
  row's slug), since a build that runs whole never fires the handoff that
  used to. What the runner cannot take — no room, an older image, a
  refusal, the flags off, a row the consumer does not hold, an owner that
  cannot be resolved — is the Worker building exactly as before, the
  object taken back, said in the log. **The resume chain stays** for the
  builds the Worker runs itself. Guards: `test/build-runner.test.mjs`
  (22) — the numbers, the budget's stop, the pre-scope token and both
  walls under it, the scope op through the real handler, the launch, the
  env and the shim's re-scope, the fork DRIVEN through `worker.queue` six
  ways, the runner's takeover DRIVEN through `runContainerJob`, `canFire`
  evaluated out of the source, the build route's scope hook DRIVEN through
  the real route, every hop read by order; the container harness runs a
  build launch through the real runner to the consumer's own "nothing to
  run". Two older guards re-anchored, not appeased: the fire's `kind` and
  the launch's clock are the caller's now. **Sweep: 64 mutants, 61 killed, none surviving, none unapplied, three comment-only controls survived — two survived the first pass and both were the guard's: G3 (the reader's own check that a `pre` token names the placeholder, removed) passed because no test forged a token the mint refuses — one is signed by hand under the derived key now and refused at verify; G16 (the R2 read handed to the ordinary wall without `pre`) passed because the key the case asked for is one the ordinary wall refuses under the placeholder slug anyway — every R2 op is asked under the pre token for the placeholder's OWN prefix now, which only the pre wall refuses, and the re-minted token is driven through the same ops. Both re-run to a kill.** Suite 5,333;
  `site build` 373/373 (367 before; the six are the build-launch case). **Not proven live**: the canary is the owner's — a
  revise of fretwork-1 (~17 credits; the deploy's default canary names it),
  or a first build with the owner's uid in `JOB_RUNNER_CANARY`; the Worker
  log says `job runner: fired build <id> into fretwork-1's lane`, the
  build service's log carries the child's lines, the trace has no
  `resume:` mark. Stated residues: a runner whose fresh claim answers
  `site-busy` (the consumer's lease lapsed under a slow container start)
  cannot re-send and builds anyway, the pointer deciding — the edit path's
  own residue; a build stopped by the deadline keeps its design debit (the
  sweep's `external` refund moves nothing), as an evicted consumer's
  always did; a first build's pre-scoped lane is a container of its own for
  that build's length.
- **THE BROAD ROLLOUT IS CODE-READY, AND THE FLIP IS ONE VALUE (2026-09-06,
  stage 5e, owner: *"finish the missing steps"*).** Every dependency the plan
  named is shipped — recovery in 2a and 2c, the deploy gate in 3a, the
  reconcile in 3b, credential narrowing in 4b, deadlines in 5d, serialization
  in 6, and builds in 5b/5c — and the flag itself was built with the runner
  (task #93) and is driven: `jobRunnerFor` under the broad word reaches a site
  and an account the canary never names, and the consumer is DRIVEN through
  `worker.queue` firing for exactly such a site with no inline run
  (`test/container-job.test.mjs`). **So there is no code to write for the flip,
  and the flip is the owner's**: set the GitHub secret `JOB_RUNNER_EVERYONE` to
  an affirmative word (`on`, `1`, `true`, `yes` — anything else, including
  `off` and the deploy's own default, is off) and redeploy. Every signed-in
  owner's queued edit, add-on and build then runs in that site's own container;
  the canary keeps whatever it names either way, and turning the secret back to
  `off` and redeploying is the whole rollback — never a revert. What does NOT
  change: a container that cannot take a job (no room, an older image, a
  refusal, a row this consumer does not hold) is the Worker's consumer running
  it exactly as before, said in the log.
- **WHAT THE FLIP MAKES REACHABLE, AND THE FIX THAT IS THIS STAGE'S ONLY CODE.**
  With one canary site the account is never full because of us. With every
  site's jobs going through the fire they share the account's container ceiling
  (~1,536 live `standard-1`), and a fire that meets no room WAITS —
  `withRoom`, `JOB_FIRE_MS` 90 s — before the consumer falls back to running
  the job itself. **Ninety seconds of waiting plus a fresh 840 s budget is 930
  against a platform ceiling of 900**: the job would be evicted with half a
  minute still on its clock, running no catch and no finally — run 17's shape,
  reached by capacity rather than by a deploy, and the sixty seconds
  `EDIT_JOB_MS`'s own comment reserves for the teardown are exactly what the
  wait spends. Now **the inline fallback's budget is what the invocation has
  left**: the queue handler takes `deliveredAt` per message, both fire paths
  hand it down, and `inlineBudgetMs(startedAt, want)` (edit-job.mjs, driven)
  answers the smaller of what the job wants and `CONSUMER_CEILING_MS −
  TERMINAL_RESERVE_MS − spent`, floored at 1 s because `makeEditBudget` reads a
  non-positive total as its default — which is the 840 s this refuses. A fire
  that returned at once leaves ~884 s against a want of 840, so it is a no-op
  on every path that does not wait, which is every path today; it bites only
  when something before the job took real time, and then the job ends at its
  own gates with a sentence and a refund instead of an eviction. **The
  container's dispatch does NOT carry it** — inside the site's container the
  ceiling is the launch's deadline (5d), not a fifteen-minute invocation, and a
  `startedAt` there would cut every container build from twenty-seven minutes
  to whatever is left of a Worker clock that does not exist; the guard asserts
  its absence. Guards: `test/broad-rollout.test.mjs` (5) — the arithmetic that
  makes the cap necessary, the decision driven (nothing spent, the headroom, a
  whole fire window, nothing left, a clock that is not one, a want that is not
  one, a clock ahead of us), the handler's per-message clock and both
  hand-downs, each consumer's capped budget and the container's uncapped one,
  and the flip's own properties. The elapsed cannot be driven end to end
  without a real 45-second wait — that is where the cap begins to bite — so the
  decision is a function and the call sites are read by landmark, which the
  sweep covers by cutting each hop. **Five older guards went red for the change
  and were re-anchored, not appeased**, each naming the spelling that moved:
  the build's budget line (the stop signal is the property), the handler's two
  inline calls (the order and the lease are), the edit consumer's signature
  (the three ways in are), and the build message's `tries`. **Sweep: 13
  mutants, 13 killed, none unapplied, the comment-only control survived — one
  survived the first pass and it was the guard's**: a clock ahead of ours
  buying time was asserted against a want the ceiling never binds, so the
  clamp was invisible; driven against the container's longer want now, re-run
  to a kill. **Not proven live**: the cap needs a full account, which is a
  launch rather than a harness — the line to read is `edit queue: <id> inline
  budget cut to <n>s`, beside `job runner: waiting for room`.
- **Later phases**: Supabase through the gateway shipped as stage 4b, the
  child's clock as stage 5d, builds through the runner — whole, under a
  longer clock, no fire and no resume — as stage 5b/5c, and the broad flip's
  readiness as stage 5e (the bullets above), and the platform rebuild as a
  job with a sweep of the litter under `jobs/` as stage 9 (its own section).
  What is left of the plan: nothing.

  **MERGED AND DEPLOYED (owner, 2026-09-06: *"MERGE"*).** Main was
  fast-forwarded from `924e007f` to `69118b6f` at 04:33Z — twelve commits:
  stages 4b, 5d (two), 5b/5c, 5e and 9, plus the stamp correction, the
  `site build` cap, tasks #87, #88 and #47, and the two assessments. Main had
  nothing of its own. **Deploy run 2032, green in 3m05s**: the gate set in 1 s;
  the image step 2m20s, so the site image was BUILT and the container app
  `EDIT`ed off stage 8's `e86…54e47` onto a new tag, applied 04:37:23Z;
  `deploy gate (drain)` found no live leases and returned at once; Wrangler
  23 s; the clear step on success left the gate to expire. All four triggers
  and both queue ends redeployed. **The 15–20 minute hold ends ~04:57Z** — every
  stage from 4b onward is live from then, and the plan's remaining work is the
  owner's: the `JOB_RUNNER_EVERYONE` flip and the canary proofs.

  **#52's interrupted-job answer is MOSTLY MITIGATED RATHER THAN OPEN, and
  what is left of it needs the owner (assessed 2026-09-06).** Run 17's shape
  was a queue invocation evicted nine minutes after a deploy, running no catch
  and no finally. Since then: the job runner (#93) moved edits, add-ons and
  builds INTO the site's container, where a Worker isolate's eviction cannot
  reach them; stage 3a gates the old code and drains running leases before a
  deploy, which is that cause addressed at its root; and 2a, 2c and 3b recover
  the row afterwards. **The residue is a couple of minutes of "Thinking"**: a
  holder that dies leaves the row claimed with a lapsed lease, and the sweep
  settles it on its next two-minute tick while the browser polls. Closing that
  needs `edit_get` to hand back `lease_expires_at`, which it does not — a
  DATABASE FUNCTION CHANGE, so the owner's go. **And the other half was always
  the owner's**: whether a job cancelled before it made a model call may be
  re-run. Worth stating either way: a lapsed lease is evidence and not proof
  (beats are late before they are absent), so whatever is built must not
  answer "interrupted" as a terminal verdict — cannot-tell must never read as
  broken, the rule task #87 records one path over.

### A BUILD HAS A ROW, AND ONE LEASE MOVES ALONG ITS CHAIN (2026-09-05, stage 2c)

Owner: *"go"*. A build had an R2 record with an etag claim and charge marks
(`build-resume.mjs`) and nothing else — no row, no lease, no heartbeat, no
sweep. A consumer evicted mid-design (run 17's shape, nine minutes after a
deploy) or a resume chain the queue stopped delivering (run 41) left the
customer with the stand-in page and a browser polling `pending` to its own
twenty-minute bound; nothing could say the build was gone, because nothing
held it. Now:

```
route ──edit_create (op build, billed external)──► row: queued
consumer ──edit_claim, edit_beat every 30 s──► claimed          (the design)
fire ──edit_handoff(consumer → container:<genId>, 1800 s, generating, slug)──► generating
container ──beats every 60 s under its own name, TTL 600──► (the generation)
report ──edit_handoff(container → same owner, 300 s)──► released, owner kept
collector ──edit_claim, or edit_handoff(container → resume:<x>) by name──► the publish
close ──edit_finalize(null, ok) | edit_refund(failed)──► done | failed
sweep ──an expired lease nobody renewed──► lost, nothing moved
```

- **THE ROW IS AN INSTRUMENT, NEVER THE AUTHORITY.** Every money and site
  decision on the build path stays with the R2 record (`alreadyCharged`, the
  etag claim). A build that cannot file, claim or hand off its row builds
  exactly as it did before this existed; a look that cannot claim the row
  still does its work; a row that reads `lost` does not stop a resume that
  is alive. What the row buys is a verdict for the customer and an operator,
  and a sweep that closes a chain nobody will come back to. Every helper in
  `worker.js` beside `makeJobCtx` answers rather than throws; the vocabulary
  and the verdict are `builder/build-lease.mjs`, dependency-free and driven.
- **`external` billing, decided from the op.** The build's money moves through
  `credit_debit` under `build:<jobId>` refs (stage 1c), never a reserve on
  this row, so `edit_refund` and `edit_reconcile` never move it. `none`
  behaves identically inside every RPC; the word says why a forty-credit
  build's row reads `cost 0`. `edit_create` sets it from `p_op = 'build'`, so
  no caller can file a build under a reserve. Migration
  `20260905190147_build_rows_lease_chain` (named for the remote version):
  the state CHECK gains `generating`, the billing CHECK gains `external`,
  `edit_create` REPLACED in place, `edit_handoff(p_id, p_owner, p_next,
  p_ttl ≤ 3600, p_state, p_slug, p_mint)` NEW — the holder moves the lease
  to a named next holder or, with `p_next` null, RELEASES it (the owner kept,
  only the expiry moves); state and slug set only when named; a stranger is
  `not-holder`, a terminal or reviewed row refused as `edit_claim` refuses
  it. Both read back with `pg_get_functiondef` into the live snapshot;
  `test/build-jobs.test.mjs` holds them equal byte for byte.
- **The slug at filing time.** A revise names its site and the review wall
  applies; a first build has no name yet and is filed under `build:<jobId>`
  — a placeholder no site can be, NEVER the empty string (`edit_create`
  matches a reviewed slug by equality, and a build row parked under `''`
  would refuse every first build on the platform for ever). The handoff at
  fire time, which knows the slug, sets the real one; a build that never
  fires keeps the placeholder, which is the honest answer for a refusal.
- **The release is `RELEASE_TTL_S` = 300, NOT "now".** The plan said the
  report shortens the lease to now; a release to now followed by the sweep's
  two-minute tick would mark a build lost sixty seconds before its collector
  claimed it, and the collector would then publish a site the customer had
  just been told was gone. Five minutes is five missed looks. A released
  lease is not yet expired, so the collector's plain `edit_claim` answers
  `leased` — the TAKEOVER BY NAME is the mechanism (`claimBuildRow`: claim,
  then `edit_handoff` from `container:<genId>`, which the record names),
  and it is the same mechanism for a container whose report never landed.
- **The container beats through the REPORT ROUTE'S OWN CREDENTIAL, not the
  gateway's job token** — the plan's wording. The generation runs under
  `/model/start`, which holds no job token until 5b puts builds through the
  runner; the report token is the credential that route already has, and a
  beat or a release is bound to the row through the RESUME RECORD (the
  token AND the generation id it carries — `genBound`), so naming a row is
  never more than the token was minted for. The fire's `report` object
  carries `job`, `beat` (our zone's `/api/site/genbeat`) and `beatMs`; the
  container echoes `job` and its own `gen` on the report (the route strips
  them before storing the answer) and beats `{job, gen}` with the token in
  the header; `edit_beat` under `container:<genId>` for 600 s is the wall
  under the binding. The cadence is the Worker's, floored at 5 s in the
  container (the harness asks for that), never the container's choice.
- **The poll route's verdict (`rowVerdict`).** No answer object and a row
  that says `lost` with a claimed slug is shaped AS A PLACEHOLDER BUILD —
  200, `slug`, `page: "placeholder"`, the sentence in `notes` — because the
  browser's success gate is `r.ok && d.slug` and inside it `page` picks the
  ⚠️ sentence and the slug is RECORDED, which it must be: the stand-in is
  live at a name the project owns, and a project that forgets it sends the
  next message as a fresh first build against it and gets a 409. `lost`
  with nothing claimed, `failed`, `cancelled` and `done`-with-no-object
  ("already collected") answer 410 with their sentences. The answer object
  always wins (read first); a pending answer now carries `state`. No
  browser change was needed. The POST's own wait asks the row every tenth
  look (~30 s), so a consumer evicted mid-design answers the customer in two
  or three minutes instead of sixteen.
- **The sweep is untouched**: a build row falls into its own `lost` branch,
  `edit_refund` on `external` moving nothing. `EDIT_PHASES` knows
  `generating`; `test/edit-job.test.mjs` derives the CHECK from the NEWEST
  applied file that spells it (a guard pinned to the birth file went red for
  the change).
- **Stated residues.** A handoff both RPC attempts refuse leaves the lease
  with a consumer whose beats end with its invocation, so the row may read
  `lost` while the build finishes — said in the log, never a stopped build.
  A row whose queue message is never delivered sits `queued` with no lease
  and is not swept (stage 3a's territory); the POST's wait still ends at
  sixteen minutes for it. The container→Worker beat leg is the one hop not
  driven end to end: the harness proves the report's `job`/`gen` on the real
  wire and a settled generation sends no beat; the beat's send is read out
  of the source.
- **Driven on the live database, rolled back**: `scripts/edit-rpc-check.sql`
  section 19 — RED at FAIL 70 against the old `edit_create` (`queued none`),
  **21 of 21 after the migration, ALL 113 CHECKS PASSED whole**; its first
  green run tripped on plpgsql's own ambiguity (the block declares `slug`
  and the section read the column by that bare name — qualified, nothing
  about the product). `test/build-jobs.test.mjs` (31): the vocabulary, the
  migration and the snapshot, the check's order, every Worker hop read, and
  DRIVEN — the poll route's five answers through `worker.fetch` against a
  stubbed `edit_get`, the beat route bound and unbound six ways, the report
  route's release and its stored answer, and the consumer through
  `worker.queue` claiming, running and closing (claimed, rowless, leased).
  Five older guards went red for the change and were re-anchored, not
  appeased: the fire's report regex (two fields pinned), the poll route's
  FIRST return (the verdict now precedes the pending answer), the CHECK's
  source file, `buildAndPublishPages`' signature END (`billRef = null })`),
  and the auth audit's public count (five → six, `/api/site/genbeat`).
  **Sweep: 48 mutants, 48 killed, none unapplied, three comment-only controls
  survived** — the placeholder slug as the empty string, a lost build with
  a slug not shaped as a placeholder, a build in flight read as lost, an
  ok:false refusal read as done, another generation's container binding,
  the release sweepable before the collector's next look, the handoff not
  the generation bound, an array read as a slug; the route filing under the
  edit op, a refused row stopping the build, a failed enqueue leaving its
  row, the consumer beating without the lease, the lease not reaching the
  build, the row never closed, the fire handing nothing off, the design
  carrying the job id, buildArgs and the fire dropping it, the collector
  unable to name the holder or calling itself the holder unclaimed, a refire
  moving nothing or not handed the lease, no takeover on `leased`, no retry,
  the handoff on the consumer's TTL, the release moving the owner, a fired
  build closed by the consumer, the report never releasing, the beat route
  token-blind or on the wrong TTL, the poll route without its verdict, the
  wait never asking, the beat outliving the work, the row read owner-blind,
  a beat bound by job alone; the module without `generating`; the container
  never starting its timer, the report unnamed, the beat without its token,
  the timer outliving the generation, the cadence unfloored; both SQL files
  billing every row external or letting anyone move the lease, the CHECK
  without `generating`, the snapshot drifting; the check losing the
  no-money proof or the stranger's call; the image without the module.
  **One survived the first pass and it was the guard's fault**: the sweep
  cut the stranger's handoff CALL out of the check and left the second
  `FAIL 72d` line (the owner read back unchanged), which passes trivially
  when nobody tried — the order guard read the message and not the call;
  it reads both now, re-run to a kill. Full suite 5,191.
- **Not proven live.** The deploy rolls the container (`worker.js` and
  `build-server.mjs` are image inputs), so the 15–20 minute hold applies.
  The canary is the owner's: one build on a test slug — the row should go
  `queued` → `claimed` → `generating` → `done`, `x-site-build` moving; the
  lost path is proven by the check and needs no spend. A first build under
  the placeholder slug proves the handoff's slug write.

### ONE JOB PER SITE AT A TIME (2026-09-05, stage 6)

Owner: *"go"*. `edit_create` checked review and the idempotency key and
nothing about the SITE, so two edits with different keys, an edit and an
addon, an edit and a revise, or an edit and the platform rebuild ran at once
on one site — only the browser's own in-flight set stopped a second submit,
per tab. Compiles serialised per lane; the writes did not, and stage 7's
conditional pointer stops only a holder whose pointer moved under it, never
a publish built from a source another job changed after it was read. Now:

```
claim ──private.site_busy(slug, self): pg_advisory_xact_lock('site:'||slug), then the question──►
   │  nobody  → claimed (the row's `deferrals` on the answer)
   │  another → deferrals + 1, phase 'waiting', {claimed:false, error:'site-busy', other, deferrals, gave_up}
   │              ≤ 45 → the QUEUE CONSUMER re-sends its own message, delay SITE_BUSY_DEFER_S (60 s)
   │              > 45 → edit_refund('failed', the reason on the row) INSIDE the RPC; the consumer stores the 409
commit ──edit_committed: the holder AND lease_expires_at > now()──► {ok, published} | {ok:false, error: terminal|not-holder|lease-expired|refused}
rebuild ──rebuild_claim(slug, sec): the same lock, the same question──► won (running_until marked) | busy {other} | running
```

- **THE LOCK IS THE CLAIM, AND THE CLAIM COMES FIRST.** `private.site_busy(p_slug,
  p_self)` takes `pg_advisory_xact_lock(hashtext('site:' || slug))` for the
  rest of the transaction and only then asks: another row on the slug — not
  terminal, not reviewed, never the row asking — with `(lease_owner is not
  null and lease_expires_at > now()) or state = 'publishing'` (a publisher
  whose lease lapsed may still have shipped and the sweep settles it within a
  tick, so a new job waits for that rather than racing it); else `'rebuild'`
  while `site_rebuild.running_until > now()`; else nobody. Revoked from
  public, anon and authenticated. `edit_claim` answers its OWN refusals first
  (needs-review, terminal, settled, a live `leased`) and asks the site after,
  so a job's own lease is never read as the site being busy; a first build's
  placeholder slug (`build:<jobId>`) is never busy because no other row can
  carry it. ONE JOB PER SITE, not one per customer: two sites of one owner run
  side by side. Migration `20260905200655_site_serialization` (named for the
  remote version): `edit_jobs.deferrals`, `site_rebuild.running_until`, the
  helper, `edit_claim` and `edit_committed` REPLACED in place, `edit_get`
  carrying `deferrals`, `edit_handoff` naming the row's `uid` on success,
  `rebuild_claim` NEW and service-role only; all six read back with
  `pg_get_functiondef` into the live snapshot, which `test/site-busy.test.mjs`
  holds equal byte for byte.
- **THE QUEUE CONSUMER CLAIMS BEFORE IT ASKS A CONTAINER — the handler's
  order moved.** It fired first and let the runtime claim; now the claim
  decides, and the fire carries the holder's name (`holder` on the launch,
  admitted by `readLaunch` in a minted owner's shape and nothing else), the
  runner takes the lease over BY NAME (`runQueuedSiteEdit`'s `takeOver`: a
  fresh claim answers `leased`, `edit_handoff` moves it from the consumer's
  name to the runner's, the row's `uid` and `slug` off the handoff's answer —
  which is why the handoff names the uid now), and the inline run reuses the
  claim it holds (`claim: held`) — never a second claim. **The container's
  runtime NEVER sees a busy claim and cannot re-send** (it has no queue): the
  consumer is the one that waits. `deferEditJob`: `BUILD_QUEUE.send({kind,
  id}, {delaySeconds: 60})` once per refusal; a claim the RPC gave up on
  stores the customer's sentence through `edit_finalize(p_ok: false)` as a
  409 with `BUSY_EDIT_MSG` (the row is already failed and refunded inside the
  RPC, so the reply is the only thing left to write). The lease is renewed
  while the fire waits for room (`buildRowBeat`, cleared before the inline
  run, which beats for itself).
- **THE NUMBERS ARE BOUNDED FROM BOTH ENDS.** `MAX_SITE_BUSY_DEFERRALS` 45
  (the Worker's copy of the RPC's `deferred > 45`, held equal by the guard) ×
  `SITE_BUSY_DEFER_S` 60 = 45 minutes of waiting: under the browser's own
  watch (400 looks × 8 s ≈ 53 min), so a waiting edit is still being watched
  when it gives up, and above a generation's 1800 s handoff, so an edit filed
  against a site mid-build outlives the build. The poll route carries
  `waiting: true` on a pending answer once the row has been deferred; the
  browser does not read it yet (the field is on the wire for 3b's sentence).
- **A BUILD ROW WAITS THE SAME WAY, AND THE COLLECTOR DOES NOT.**
  `claimBuildRow` answers busy as its own case because its two callers do
  opposite things with it: the fresh consumer (`runQueuedSiteBuild`) puts the
  raw job object BACK and re-sends `{kind: JOB_KIND, id}` with the delay; a
  build the RPC gave up on reverses its deposit (`credit_reverse` under
  `build:<id>:deposit`, reason `busy`) and stores a 409 with
  `BUSY_BUILD_MSG`, which `rowVerdict` reads off the row's own `error.kind`
  as 410 `busy: true` (any other failed row keeps the build's sentence). The
  collector (`runResumedSiteBuild`) LOGS a busy answer and goes on — a stated
  residue, not an oversight: the early stand-in publishes under the slug the
  build claims at fire time, and a lost generation whose lease lapsed is
  "busy with this build's own chain"; the pointer's conditional write decides
  what lands.
- **THE COMMIT NEEDS A LIVE LEASE.** `edit_committed` adds `lease_expires_at
  > now()` to its owner check and says why it refused; the spine reads the
  answer, marks `commit fail {why}` on the trace, logs it, and does NOT
  finalize — the third wall on a stale holder, after the prefix-confined
  writes (4a) and the conditional pointer (7). A refused commit leaves the
  row to the consumer's own refund, which ends it in review with the money
  question open (3b reads it).
- **THE PLATFORM REBUILD ASKS THE SAME LOCK.** `rebuild_claim(p_slug, p_sec)`
  replaces the drain's PATCH claim: `'rebuild'` → `running: true` (a previous
  tick's rebuild still running), another job → `busy {other}`, else the
  conditional update — `next_try_at <= now()` re-stated so two ticks cannot
  both win — sets `next_try_at` AND `running_until`. `drainOne` reads
  `"busy"` as a DEFERRAL (`BUSY_DEFER_SEC` 300 s, `attempts` unchanged,
  `out.busy++`, the reason "site busy: a job holds it"), never an attempt
  and never a lost claim; the `defer` PATCH clears `running_until`, as the
  forget does. The mark is what the NEXT edit's claim reads while the
  rebuild's compile runs — the two doors share one wall.
- **THE EDITABLE COPY IS REPAIRED BEFORE AN EDITING READER READS IT.** Every
  state copy ends with `source/<slug>/head.json` (`HEAD_KEY`, `{version,
  at}`, written LAST by the spine's activation, the build's publish and
  `restoreVersion`), and `ensureEditableState(env, slug)` — behind
  `loadSiteSourceForEdit`, the reader the four editing call sites use (the
  edit route's `eSrc`, the addon's `aSrc`, the revise's `priorPages`, the
  drain's `rebuild`; the three non-editing reads stay on `loadSiteSource`) —
  reads the pointer UNCACHED (`readPointer`, not `sitePointer`'s 30 s),
  answers `repairNeeded({pointer, head})` (no pointer → nothing, the legacy
  layout; no marker, or a marker naming another version → repair; the same
  → the config belt alone), and `repairEditable` copies `pages.json` and
  `parts.json` out of `builds/<slug>/<version>/state/`, merges the version's
  baked config through `withConfig` (`REPAIR_CONFIG_FIELDS` =
  `STATE_CONFIG_FIELDS` less `langStrings` — the translation cache is the
  edit path's own record and is never rolled back; drift judged by `sameJson`,
  key-order-blind; written only when it differs, so an ordinary claim writes
  nothing), NEVER the sidecar (the rename lane patches it, and a repair would
  undo a rename), and marks LAST. "No marker + a pointer" repairs: right for
  a site published by stage 7's code before the marker existed, whose copy IS
  the pointer's build (the copy is a no-op in content and the marker then
  stops it repeating), and safe because a claim holds the site while it runs.
  What it puts back: a failed activation that left the pointer ahead of the
  copy (7's "a failed script upload leaves the pointer ahead"), or a state
  copy that died half-written, before the next edit reads it as the site.
- **Guards.** `test/site-busy.test.mjs` (19): the numbers, the migration's
  order and grants, the six functions' snapshot equal byte for byte, section
  20's order, `rowVerdict`, the edit consumer DRIVEN through `worker.queue`
  five ways (busy re-sent with the delay, given up and finalized with the
  sentence, claimed once and fired with the holder, refused answers, a
  re-send that fails), the runner's takeover driven, the launch's `holder`,
  the build consumer driven (busy re-put and re-sent; given up, reversed and
  stored as 409), the poll's `waiting`, and every Worker hop read (the
  handler's order, `deferEditJob`, `claimBuildRow`, the collector going on,
  the spine's commit read, the drain's claim and defer, the four readers by
  name with exactly four bare `loadSiteSource(env, …)` call sites left, the
  three markers, `ensureEditableState`). `test/site-builds.test.mjs` +4 (the
  marker's round trip, `repairNeeded`, the copy's order and what it never
  touches, the config fields and `sameJson`); `test/site-rebuild.test.mjs`
  +1 (the busy deferral); `test/site-rebuild-wiring.test.mjs` +1, its three
  claim guards re-anchored on `rebuild_claim`'s body out of the newest
  migration; `test/container-job.test.mjs` +1 (busy → re-sent, nothing
  fired; the drive's stub answers the claim, now that the handler claims
  first); `test/build-jobs.test.mjs` #24 and #32 re-anchored (the newest
  migration defining `edit_handoff`; `rowVerdict` handed the row's error);
  `test/page-gen.test.mjs`'s revise-anchor guard re-anchored on the reader's
  spelling — seven older guards red for the change, each naming which
  spelling moved and why, none appeased. **Driven on the live database,
  rolled back**: section 20 RED at FAIL 81 against the old `edit_claim` ("a
  second job claimed a site another job holds"), **24 of 24 after the
  migration, ALL 137 CHECKS PASSED whole** — after the whole script first
  went RED at FAIL 46: section 16 (2026-09-02) filed its free job on a slug
  section 15's job still held, the new wall refused it `site-busy`,
  `edit_exempt` on the unclaimed row answered `lease-lost`, and the "a
  reserved job was exempted" check read that as the exemption being granted.
  An older section assuming two jobs could share a site is the one red a
  serialisation change is SUPPOSED to produce; j9 files on its own slug now,
  with the comment beside it.
- **Sweep: 64 mutants — 61 killed, none survived, none unapplied, three
  comment-only controls survived** — the lock dropped, a lapsed publisher no
  longer holding the site, the rebuild's mark ignored, a row its own blocker,
  the cap gone, the give-up failing nothing, the refusal uncounted, the
  commit without the live-lease check, the rebuild's claim not re-stating
  dueness / leaving no mark / never asking the site / granted to nobody,
  `edit_get` without the count, a handoff without the uid, the helper granted
  to a caller; the handler firing unclaimed, a busy claim not deferred, the
  fire without the holder, the inline run claiming again, the runner ignoring
  the holder, the takeover never tried, the re-send without its delay, a
  given-up job re-sent, the give-up storing no reply, the build's claim blind
  to busy, the object not put back, the deposit kept, the give-up as a server
  error, the collector stopping on busy, the verdict without the row's
  reason, the commit's answer ignored, the poll silent, the drain reading
  busy as lost, a deferred row keeping its mark, each of the four readers
  past the repair, the wrapper never repairing, each of the three copies
  without the marker, the repair on the cached pointer or never repairing,
  the config put back without drift; the marker before the copy, no marker
  as no repair, another version as no repair, the sidecar written, the
  translation cache restored, drift by key order, a stateless build marking
  anyway; a busy site as an attempt or a lost claim; the launch dropping the
  holder, the runner keeping it; the cap drifting, the delay a few seconds;
  a busy build in the build's sentence; the check without the refusal or the
  money. Full suite **5,217**.
- **Stated residues.** A job whose re-send fails sits `queued` with no lease
  until the stale sweep sends it again (3a, the next section). A refused commit ends in review through the
  consumer's refund (3b). The collector going on when refused (above). The
  browser does not yet say "waiting". **AND A WINDOW THAT IS OPEN NOW, until
  the deploy carrying this Worker**: the migration is live and the Worker on
  main is not, so a second job filed against a busy site is refused
  `site-busy` by the new `edit_claim`, and the OLD consumer reads any
  non-claim as "not claimed" and returns — no re-send, nothing charged, the
  row `queued` with no lease and the browser polling to its own bound. Before
  the migration that second job ran concurrently; after the deploy it waits.
  A build is untouched by the window: the Worker on main today (nine commits
  behind this branch when stage 6 was pushed, before stage 2c) files no build
  row and never asks, and 2c's consumer builds on a refused claim anyway (the
  row is an instrument). The deploy closes the window; nothing else does.
- **Not proven live.** The deploy rolls the container (`worker.js`,
  `site-builds.mjs` and `container-job.mjs` are image inputs; the 15–20
  minute hold applies). The canary is free: two edits on fretwork-1 a few
  seconds apart — the second's row should show `deferrals ≥ 1` and `phase
  waiting`, the log "deferred — the site is busy with <the first's id>", and
  the second should publish AFTER the first, `x-site-build` moving twice in
  order; the drain's busy defer needs a `site_rebuild` row filed while an
  edit runs; the repair shows on the first claim of a site that has a pointer
  as "editable state: <slug> no-head → repaired from <version>" in the log
  (a legacy site, no pointer, is left alone), and nothing on the site changes.

### A DEPLOY WAITS FOR RUNNING JOBS AND GATES THE OLD CODE, AND A QUEUED ROW NOBODY PICKED UP IS SWEPT (2026-09-05, stage 3a)

Owner: *"ok go"*. Run 17's shape: a deploy rolls the Worker and the platform
evicts the old isolates minutes later — a queue invocation carrying a
customer's edit was `canceled` nine minutes after the 17:31 deploy, no
catch, no finally, the lease lapsing under the sweep and the change lost.
The isolate has no drain of its own and `deploy.yml` had no gate: the
"15–20 minute hold" after a push was a rule for humans firing container
work, never for the queue, which keeps delivering. And stage 6 left a row
it twice called "3a's territory": a `queued` row with no lease that nothing
touches — its message never delivered, its consumer evicted before the
claim landed, a re-send that failed — sat queued for ever behind a browser
polling to its own bound.

```
deploy.yml  set ──► private.platform_flags {name: deploy, deploy_id: <sha>, expires_at: now + 45 min}
            (the container images)
            drain ──► deploy_gate_read every 15 s until live leases = 0 | 14 min | 3 unread ──► wrangler deploy, DEPLOY_ID = <sha> (a var)
            clear, if: always() ──► success: LEFT TO EXPIRE · failure/cancelled: cleared, own id only
consumer ──edit_claim(…, p_deploy: DEPLOY_ID)──► private.gate_blocks: a live gate under ANOTHER id
            → private.claim_deferred('deploy-gated'): deferrals + 1, phase waiting  (stage 6's body, one for both reasons)
            → the consumer re-sends its message, delay 60 s · past 45: failed through the refund, GATED_*_MSG
cron ──edit_sweep_stale(600 s)──► queued, no lease, untouched a window: marked stale, SENT AGAIN once
            → still untouched a window later: failed, STALE_*_MSG, a build's deposit reversed
build-server ──POST /job/run while _stopping──► 503 {error: "stopping"} FIRST ──► the consumer runs the job inline
```

- **THE GATE IS ONE ROW AND ONE COMPARISON.** `private.platform_flags`
  (`name` pk, `deploy_id`, `started_at`, `expires_at`, `updated_at`),
  revoked from public, anon and authenticated; the deploy is the row named
  `deploy`. `private.gate_blocks(p_deploy)`: a caller naming NO deploy is
  never blocked (a hand `wrangler deploy`, the container's runtime — whose
  env carries no `DEPLOY_ID` by construction, `JOB_ENV_NAMES` does not list
  it, and whose own claim is a takeover by name); a gate that names a
  deploy, has not expired, and names a DIFFERENT id answers that id; the
  gate's own id — the new code — claims straight through. **`edit_claim` is
  DROPPED and re-created** as `edit_claim(p_id, p_owner, p_ttl, p_mint,
  p_deploy text default null)`: `CREATE OR REPLACE` with a new parameter
  leaves the old four-argument overload beside the new one, and the DEFAULT
  is what lets the Worker on main, which names four arguments, keep
  claiming through the migration. Its own answers come first (needs-review,
  terminal, settled, a live `leased`), the gate second, the site's lock
  third — a job's own lease never reads as gated or busy, and a first
  build's placeholder slug is never busy.
- **ONE DEFERRAL BODY FOR BOTH REASONS.** `private.claim_deferred(p_id,
  p_kind, p_other, p_state, p_mint)` is stage 6's site-busy body lifted out
  and called for `site-busy` and `deploy-gated` alike: deferrals + 1, phase
  `waiting`; past the cap, `edit_refund(…, 'failed', …)` inside the RPC with
  `error = {kind, phase: queued, other, deferrals}` and `gave_up: true` on
  the answer. The cap is ONE literal (`if deferred > 45 then`), and
  `test/deploy-gate.test.mjs` holds it equal to `MAX_SITE_BUSY_DEFERRALS`;
  `test/site-busy.test.mjs` reads it off whichever migration spells it
  now. The Worker side: `deferredClaim(c)` answers for both kinds,
  `deferEditJob` re-sends `{kind, id}` through `resendMessage` — ONE cadence
  for every deferral, `SITE_BUSY_DEFER_S` — and a give-up stores a 409 with
  `GATED_EDIT_MSG` or `BUSY_EDIT_MSG` through `edit_finalize(p_ok: false)`.
  `claimBuildRow` answers `busy: true, gated`: the fresh build consumer puts
  its object back and re-sends, a give-up reverses the deposit under
  `gated` (or `busy`) and stores the 409 — `rowVerdict` reads it as 410
  `gated: true` with `GATED_BUILD_MSG` — and the collector goes on, as it
  does for busy (2c's stated residue stands).
- **THREE RPCs, SERVICE-ROLE ONLY.** `deploy_gate_set(p_deploy_id, p_ttl
  60..7200, p_mint)` upserts the row and says what it replaced (`previous`,
  `previous_active`); `deploy_gate_clear(p_deploy_id, p_mint)` clears ONLY
  its own id (`{cleared, holder}` — an overlapping newer deploy's gate is
  never released by an older one's failure); `deploy_gate_read(p_deploy,
  p_mint)` answers the gate (`active`, `deploy_id`, `started_at`,
  `expires_at`, `blocks` for the caller's id) and `live` — the count of
  unexpired leases in `edit_jobs`, with up to twenty rows — which is what
  the drain waits on. FAIL 99 reads the grants out of `pg_proc`.
- **THE WORKFLOW: THREE STEPS, AND NONE OF THEM CAN FAIL THE DEPLOY.**
  `.github/scripts/deploy-gate.mjs` — every decision a function taking its
  clock and its fetch, `main` the thin wiring, and NEVER a non-zero exit: a
  gate that cannot be set, a drain that cannot read, a clear that cannot
  land is the ungated deploy of yesterday, said loudly in the step's log.
  `set` runs BEFORE the container images, so the gate stands for the whole
  image build and the deploy (`DEFAULT_TTL_S` 2700 = the drain's 14 + the
  images + the deploy + the propagation window after; the expiry is what
  bounds a workflow killed before its clear step). `drain` runs immediately
  before `Deploy with Wrangler`: `deploy_gate_read` every `DRAIN_TICK_S`
  15 s until `live` is zero, or `DRAIN_MAX_S` 840 s (under the queue's own
  fifteen), or `READ_FAILS_MAX` 3 unread in a row — then deploys
  REGARDLESS, saying which: a generation is bounded at thirty minutes, the
  wait at fourteen, and a job cut by the roll is what 2a and 2c recover.
  `clear` runs `if: always()` with `DEPLOY_OUTCOME: ${{ job.status }}`: on
  SUCCESS the gate is LEFT TO EXPIRE — the new isolates claim through it
  and the old ones, which keep receiving deliveries for minutes after a
  deploy, defer until they are gone; on failure or cancellation the old
  Worker is still the live one and its id is not the gate's, so our own id
  is cleared at once and it claims again. `DEPLOY_ID` is `github.sha` and
  reaches the Worker as a `vars:` entry of the wrangler-action step (the
  block is new; it is a value the log may print, not a secret). A gate step
  missing a secret logs "NOT SET — … rolls ungated, as every deploy before
  2026-09-05 did".
- **A GATE THAT CANNOT BE READ DEFERS ONCE.** `unreadClaim(c)` — no answer,
  `rpc`, `rpc-shape` — is its own case, because no answer means the gate
  could not be asked either: the consumer re-sends its own message carrying
  `tries + 1` (`readTries`: an integer 0..9 on the message, else absent;
  all three message readers carry it) bounded by `CLAIM_RETRY_MAX` 1, and
  the second time the row is left `queued`, said in the log, for the stale
  sweep — never built on an isolate a deploy may be about to evict, and
  never waited for ever on a database that is down. The build consumer puts
  its object back before re-sending. **The collector asks the gate
  DIRECTLY** (`deployGate(env)`, `deploy_gate_read` with its own id): its
  row is the container's while it generates, so a row claim cannot carry
  the answer, and a gated look re-sends `packResumeMessage(id)` with the
  delay before touching its record — bounded by the gate's own expiry, the
  answer held in R2 however long the look takes to come back.
- **THE STALE SWEEP.** `edit_sweep_stale(p_after 60..3600, p_limit, p_mint)`,
  called by `runLostEditJobs` on every cron tick with `STALE_QUEUED_S` 600:
  a `queued` row with no lease that nothing has touched for the window.
  First look: `phase = 'stale'`, deferrals + 1, handed back in `resend`
  with its op; a row already marked: `edit_refund('failed', 'never picked
  up')` with `error = {kind: stale, …}`, handed back in `failed` with its
  uid and slug. `runStaleEditJobs(env)` (exported, driven) sends a `resend`
  row's own message NOW — the wait it recovers from was already ten
  minutes; a build op is `{kind: JOB_KIND, id}`, anything else the edit
  kind — and `closeStaleJob` closes a `failed` one: a build reverses
  `build:<id>:deposit` under `stale` and writes the result object (409,
  `stage: queue`, `error: stale`; `rowVerdict` → 410 `stale: true`,
  `STALE_BUILD_MSG`), an edit or addon stores `STALE_EDIT_MSG` through
  `edit_finalize(p_ok: false)`. The window is longer than a deferral's
  delay plus a claim, so a message in flight is never swept (the numbers
  guard reads that).
- **THE CONTAINER'S DOOR.** `POST /job/run` answers 503 `{ok: false,
  error: "stopping"}` FIRST while `_stopping`, before it reads the launch:
  the fork reads any non-200 as "run inline" — the shape an older image's
  404 already had — so a job fired at a container being shut down runs in
  the consumer instead of in a child the shutdown will kill. Driven through
  the real service by the harness's last case (a hold, SIGTERM, `/busy`
  answering `stopping: true` and still busy, the 503, `GET /job/<id>` 404).
- **WHAT IS NOT GATED, DELIBERATELY.** The platform rebuild drain
  (`rebuild_claim`, a cron's own clock, one compile per row — a rebuild cut
  by the roll is retried by its own `attempts`), and every claim that
  names no deploy (above).
- **Guards.** `test/deploy-gate.test.mjs` (23): the numbers; the migration
  (the row and its comparison, one deferral body, the claim's order, the
  DROP before the CREATE and the re-issued grants); the seven functions in
  the live snapshot byte for byte; section 21's order; the workflow's three
  `run:` lines and the `vars` entry (a count of the script's NAME was 4 —
  the set step's comment names it; "prose contains the thing it forbids");
  the script's every function driven with a fake fetch and clock (`readEnv`;
  `rpc` — the mint in the body and the key in the headers, a refusal's
  STATUS only, never its body, which quotes the request and so the mint;
  `set`; `drain` to zero, to the clock, to three unreads; `clear` on
  success, failure and another's gate; `main`); the consumer DRIVEN through
  `worker.queue` — a gated claim re-sent with the delay and nothing run, an
  unread claim re-sent once with `tries` and left the second time, a gated
  build re-put and re-sent, past the cap the deposit reversed and the 409
  stored, an unread build asked once, the collector's gate before its
  record; the stale sweep driven (a re-send now, a failed edit's sentence,
  a failed build's deposit); the hops read; the container's door driven;
  the poll routes' two new sentences. Seven older guards went red for the
  change and were re-anchored, not appeased — the handler's spelling
  (`claimArgs`, `deferredClaim || unreadClaim`), `deferEditJob`'s shape,
  `claimBuildRow`'s reverse reason, the snapshot of `edit_claim` now read
  against the newest migration DEFINING it, the cap off `if deferred > N
  then` wherever it lives, `build-resume-wiring`'s every-writer guard
  (it pinned `uid:` and the stale writer records the owner as the
  shorthand `uid,` — the property is the owner, not the colon; a writer
  with no owner still fails it, driven both ways before the re-anchor),
  and `build-jobs` #11 — **which had been RED
  since the stage-6 push**: it pinned the check script's header stamp
  `(stage 2c): ALL 113 CHECKS PASSED`, stage 6 restamped the header to 137
  AFTER its suite run, as the stamping rule asks, and re-ran nothing that
  reads the stamp; the `unit tests` run on that push was red and unread.
  The guard reads the stage-2c line by name now (the header keeps every
  stamp as its own line). The trap entry is in the traps.
- **Driven on the live database, rolled back**: section 21 of
  `scripts/edit-rpc-check.sql` (FAIL 90–99, 28 checks; it clears the live
  gate first, inside the transaction) — a claim with no gate, the gate set
  and read three ways (it blocks an older id, not its own, not a reader
  naming none), an older deploy refused and counted on the row, the gate's
  own deploy through it, a nameless claim through it, the cap failing the
  row with its reason and no money moved, a stranger's clear refused with
  the holder named and the gate still standing, the own clear, an expired
  gate, the newest deploy overwriting and reporting what it replaced (live
  or not), an overwritten deploy's clear not releasing the newer gate, the
  live-lease count following the leases, a stale row handed back and
  marked, not picked again inside the window, failed a window later with
  the reason and whose it is, no money, a fresh row and a claimed row
  never swept, the grants: **28 of 28 first run, ALL 165 CHECKS PASSED
  whole. NO RED BASELINE EXISTS**, and it is said in both headers: against
  the old functions the section stops on "function does not exist", which
  proves nothing about behaviour — the driven proof is the green run.
- **Sweep: 75 mutants, 75 killed, none survived, none unapplied, three
  comment-only controls survived** (Worker, script and SQL each) — in the
  SQL, applied to the migration AND the snapshot together so the
  byte-equality guard was neutral: a caller naming no deploy blocked, an
  expired gate still blocking, the gate blocking its own deploy, the cap
  gone, the refusal not counted, the give-up failing nothing, the claim
  never asking the gate, the old four-argument claim left beside the new,
  the new claim granted to nobody, the newest deploy not overwriting, a
  clear clearing any deploy's gate, the reader never saying it blocks, the
  second stale look failing nothing, a stale row never marked, the stale
  sweep taking leased rows, the writer or the table granted to callers, the
  failed answer not saying whose; in the Worker, the claim never naming the
  deploy, an unreadable claim not deferred, either retry unbounded or
  without its count, a gated give-up wearing or stored as the busy
  sentence, a re-send without its delay, an unreadable build claim read as
  no row, a gated build not waited or read as busy, the gated deposit
  reversed under the busy reason, the build or the look going on after
  deferring, either message count not handed in, a nameless Worker asking
  the gate, an unreadable gate read as open or never deferring, the gate's
  answer ignored, the stale sweep never run, a stale build's message sent
  as an edit's, a stale re-send delayed, a stale build keeping its deposit,
  a stale edit wearing the build's sentence, a stale build's answer saying
  nothing came back, the runner's fresh claim spelled bare; in the modules,
  the retry more than once, any string a deploy id, only nothing
  unreadable, the stale window inside a deferral's reach, each message
  reader dropping its count or taking junk, either row sentence lost, the
  door taking launches while stopping; in the script, a successful deploy
  clearing its gate, the drain waiting ten times its bound or past the
  queue's fifteen minutes or asking a dead database for ever, a set with no
  credentials reaching for the database, the mint off the body, the
  drain's read naming the deploy, the clear naming another id, the gate
  outliving the wait a gated job is allowed; in the workflow, the clear
  only on success, the var never bound, the drain step setting instead,
  the clear not told the outcome; the check losing either money read; the
  harness never stopping the service. Full suite **5,240** (5,217 + the
  twenty-three). `site build`
  **355/355** through the real container (349 stamped at stage 7; stage
  2c added two — the report naming its job and generation, no beat for a
  settled generation — and never restamped the count, the same shape as
  the header stamp above; the stopping case's four).
- **Stated residues.** (a) **The window is DIFFERENT from stage 6's.** The
  migration is live and the Worker on main is not, and nothing changes for
  it: its four-named-argument claim resolves through the DEFAULT, no gate
  exists until a deploy sets one, and the FIRST deploy carrying this Worker
  is the one that sets it. During that deploy the OLD consumers — which
  know neither `deploy-gated` nor the re-send — read the refusal as "not
  claimed" and return, so a job delivered to an old isolate inside that
  first gated window is left `queued` with no lease: exactly the row the
  stale sweep, running on the NEW code two ticks later, sends again. The
  first gated deploy costs an affected job up to ten minutes, never the
  job; every deploy after it defers as designed. (b) The collector goes on
  when the ROW claim says gated after the gate read said open — a
  seconds-wide race — and when the site is busy (2c). (c) A resume look
  deferred by the gate does not bump `looks`, so a generation under a gate
  waits the gate's length on top of its own. (d) The rebuild drain is not
  gated (above). (e) Version skew inside the roll window: a job fired at
  the new container in the minutes after a deploy runs the previous image's
  tree (task #93). (f) A stale re-send for a build whose job object is gone
  — the route died between the row and the object — is picked up by a
  consumer that finds nothing to run and returns; the row is failed a
  window later, deposit back. (g) The browser does not yet say "waiting"
  or "a deploy is rolling" (3b's sentence). (h) `deploy_gate_read`'s
  `live` counts `edit_jobs` leases only: a running platform rebuild is not
  a lease and does not hold the drain.
- **Not proven live.** The migration is live and inert until the first
  deploy carrying `deploy.yml` (a docs/test push runs no deploy; this push
  changes `worker.js`, `build-server.mjs` and the builder modules, so the
  container rolls and the 15–20 minute hold applies). What the first
  deploy's log will show: `deploy gate: set for <sha> until <time>` before
  the images, `deploy drain: no live leases after 0s — deploying` (or `N
  live leases after Ns — <slug> <state> (<s>s left)` lines until zero or
  the clock), and `deploy gate: left to expire for <sha>` after. The
  canary is free: an edit on fretwork-1, then a push to main while it runs
  — the edit should finish and finalize on the old isolate (the drain
  waits for its lease), the deploy roll, and the Worker log on a second
  edit filed inside the gate's window on an OLD isolate say `edit queue:
  <id> deferred — a deploy is rolling (<sha>)`; the stale sweep needs a
  stale row to exist and says `stale sweep: <id> sent again`.

### A ROW UNDER REVIEW IS DECIDED FROM THE POINTER, THE LIVE SCRIPT AND THE STAGED VERSION — ACKNOWLEDGMENT LOST VERSUS SUPERSEDED (2026-09-05, stage 3b)

Owner: *"ok go"*. A job that began publishing and never recorded its commit
— its consumer died, its script upload timed out, the lease wall (stage 6)
refused the commit, or an activation answered a failure after
`edit_may_publish` had already stamped `publish_started_at` — landed in
review: the money untouched, the site closed to new edits, and a person
asked for `kept` or `refunded` with no instrument to form the answer.
EVERY failure past the gate went there, the harmless ones included: a
superseded pointer write touches nothing and still parked the row. Stage 7
made the question answerable by comparison, and this stage asks it.

```
a row under review ──► FACTS: the pointer (uncached) · the live script's x-site-build / x-site-version (ONE probe through the dispatch stub)
                              · the site's builds (manifests, carrying `job` now) · OURS = the manifest naming the job, else its build id, else the pointer's own `job`
   live is ours                          KEPT (landed)                 edit_reconcile(true), the recovered reply stored unless the handler's own is
   pointer ours, live older              RETRY (lost-upload)           builds/<slug>/<v>/server.js uploaded again to the same name, the live script asked again → kept (upload-retried) | unknown
   pointer newer, built ON ours          KEPT (superseded-built-on)    the ancestry's `parent` links reach ours
   pointer newer, from before ours       REFUNDED (superseded-not-built-on)
   pointer older, none, nothing staged   REFUNDED (never-activated · never-staged)
   a fact unreadable · live ahead of the pointer · a manifest gone · the retry refused or exhausted      UNKNOWN — stays in review, said once per isolate
three doors: the consumer, the moment its refund answers needs-review · the sweep tick, every row under review · GET /api/site/reconcile (the owner: dry, or apply=1)
```

- **THE VERDICT IS A PURE FUNCTION AND ITS ORDER IS THE ARGUMENT.**
  `builder/site-reconcile.mjs` (dependency-free, driven with literal facts):
  unreadable facts first, because every later rule assumes them; then
  whether anything of ours was staged at all (nothing → refunded, unless
  a legacy-layout upload landed, which only the live build id can say);
  then the live script, which settles a landed upload WHATEVER the pointer
  says (by version, or by build id for a script with no version stamp);
  then the pointer against ours — equal is a lost upload, newer is
  superseded, older or absent is never activated. **The ancestry walk** (each
  manifest's `parent` is the pointer when THAT publish began; the pointer's
  own `parent` stands in for its manifest) answers `on` when ours is an
  ancestor of what is live, `off` when the chain passes below ours or a
  publish in it began with no pointer at all, `broken` when a manifest it
  needs is gone — and it rests on stage 6: under the per-site claim a later
  publish began after ours ended, so ours activated before it began exactly
  when ours is in its chain. Version ids order as strings, so older and
  newer are one comparison. `RECONCILE_KINDS` names every kind; the two
  refunded sentences (`NEVER_LIVE_MSG`, `OVERTAKEN_MSG`) say the money came
  back; a kept job gets the sweep's own recovered shape (stage 2a) naming
  its kind, which the browser already renders as "published, the details
  were lost". `publicFacts` is what an owner may read: no etag, no body.
- **THE FACTS, EACH READ SO A FAILURE TO READ IS ITS OWN ANSWER.**
  `reconcileFacts` reads the pointer UNCACHED (`readPointer`, never the
  serve path's 30 s `sitePointer`; a throw is `undefined`, no pointer is
  `null`), lists the builds (`listBuilds` rows carry `job` now — a job that
  never recorded its build id is still decidable), and asks the live script
  through `probeSiteWorker` — a sibling of `confirmSiteWorker` in
  `site-dispatch.mjs`, one probe of the same file through the same stub,
  no polling, both stamps, `null` when nothing can be read and never a
  guess, because the reconcile refunds on the strength of it.
  **`readEditRows` is the ONE read of `edit_jobs` outside the `edit_*`
  RPCs** (PostgREST with the service key, the `site_aliases` convention):
  the reconcile needs the publish marks `edit_get` does not hand back and a
  LIST of the rows under review, which no RPC answers; it moves nothing,
  and `null` (a failed read) is never read as "no rows".
- **THE RETRY IS SAFE BECAUSE THE PREFIX IS IMMUTABLE.** The pointer names
  our version and the live script is older, so the script under
  `builds/<slug>/<version>/server.js` — the bytes the activation tried to
  upload — goes to the same name through `putSiteWorker` (which confirms
  and clears the placeholder as every publish does), and NOTHING else
  moves: not the pointer, not the sidecar, not the state copy. Then the
  live script is asked again, and only a script that answers our version is
  kept (`upload-retried`); an accepted PUT that does not serve, a refusal,
  no credentials, no staged script are each their own `unknown`, said.
  **Capped per isolate at `RECONCILE_RETRY_MAX` (3)**, because a refusal
  that repeats (a token scope, a namespace gone) would otherwise repeat a
  Cloudflare API call every sweep tick for ever. A live script NEWER than
  the pointer is `live-ahead`, never retried: the activation order forbids
  it, and a retry would put our script over a newer one.
- **APPLIED THROUGH THE PERSON'S OWN DOOR.** `edit_reconcile` keeps or
  refunds exactly as a hand verdict does — and refuses a row not in review,
  so a sweep tick racing a person loses harmlessly (section 22's FAIL 102)
  — then `edit_finalize` stores the customer's sentence, which it writes
  whatever the state (on a refunded row it answers `not-published` and the
  reply is there; FAIL 101c–e). **A kept row that already holds the
  handler's own reply keeps it**: it says what the change did, which
  "recovered" never can. An `unknown` applies nothing and is logged once
  per isolate per row and kind; the row is READ AGAIN every tick,
  deliberately — its facts can change (a late upload landing, a newer
  publish standing).
- **THREE DOORS, ONE FUNCTION.** `reconcileEditJob(env, id, hint)` — the
  consumer calls it the moment any of its three publish-time refunds
  answers `needs-review` (`reconcileAfterRefund`; the two refunds before
  the replay never reach review and are left alone); `runReviewReconcile`
  reads every row under review on each cron tick, after the lost and stale
  sweeps, and says what it did; `GET /api/site/reconcile?slug=&job=&apply=1`
  is the owner's window — the site's rows of THEIRS under review (by uid,
  under the ownership check every owner route makes), the facts as read
  now and the verdict, DRY unless `apply=1`. `scripts/reconcile-check.mjs`
  and the `reconcile check` workflow (dispatch-only, free; `apply` a
  boolean input off by default, read as affirmative words only) call it.
  A build's row is skipped at every door — its money is external and its
  publish has no review path; one parked by the exhausted sweep is a
  person's.
- **THE BROWSER SAYS "WAITING" (the sentence stage 6 and 3a promised).**
  `EditPoll.waitingMessage(body)` answers one fixed sentence when a
  pending poll carries `waiting: true` (the site's lock or a deploy's gate
  refused the claim at least once) and `""` otherwise; `watchEditJob`'s
  wait branch puts it on `siteBuild.waitNote` and repaints, and the live
  steps' "Thinking" line carries it, escaped. A refunded reconcile reply
  prints its `msg` through the readers' existing `msg` branch; a kept one
  is `recovered`.
- **Guards.** `test/site-reconcile.test.mjs` (17): the verdict rule
  by rule and in order (the matrix meets ten-plus kinds and each is a named
  one), the ancestry six ways, `findMine`, the reply shapes and the owner's
  facts, the probe with a fake stub, `listBuilds` carrying `job`; the
  Worker DRIVEN through the real module against a fake bucket laid out as
  a staged site, a fake dispatch namespace and stubbed RPCs — landed, the
  handler's reply kept, never-activated, overtaken (its own sentence),
  built-on, a refused verdict, unknown four ways, skip two ways, the retry
  landing (the PUT to the dispatch namespace, then the verdict), refused
  and capped, accepted but not serving, no credentials, no staged script;
  the consumer through the real queue handler (a refund routed to review
  reconciled inside the delivery, a refund that landed not); the sweep's
  door; the owner's route (401, 404 on a stranger's site, dry with facts,
  apply, 400, 503, another owner's row unseen); the hops read; the script
  and the workflow; the check's section; the browser's sentence and its
  two hops. **Driven on the live database, rolled back**: section 22 (FAIL
  100–102, 11 checks) — a row routed to review kept with the money
  standing and its recovered reply readable as the poll reads it; another
  refunded with the reserve back and the sentence stored on the FAILED
  row; a settled row refusing a second verdict: **11 of 11 first run, ALL
  176 CHECKS PASSED whole.** No function changed; the section drives two
  properties of the existing RPCs the reconcile rests on and nothing had
  driven. The stamp was re-read by its guard after it was written (3a's
  trap).
- **Sweep: 53 mutants, 53 killed, none survived, none unapplied, three
  comment-only controls survived** (the module, the Worker, the poll module
  each) — in the module: an unreadable pointer or list deciding, the
  pointer's job no longer naming a pruned version, a legacy upload that
  landed refunded, a build id with no live read refunded, a script with no
  version stamp not ours by its build id, no pointer read as landed, a live
  script ahead of the pointer retried over, an older pointer walking the
  ancestry, ours in the chain never found, the chain passing below ours
  read as on, a missing manifest read as off, a publish that began with no
  pointer read as on, a row marked before the upload never found by its
  build id, an overtaken change given the never-live sentence, a retry
  storing a recovered reply, a script with no build stamp answering, the
  owner's facts carrying the etag, a listed build forgetting its job; in
  the Worker: a row not under review or a build's reconciled, a lost upload
  never retried, every verdict applied as kept, a kept row's own reply
  overwritten, a refused verdict storing a reply, an unreadable table read
  as no rows, an unreadable pointer read as none, no dispatch binding read
  as a blank live script, the retry cap a hundred higher or never counted,
  an accepted upload kept without asking the live script, a refused upload
  going on to the probe, no credentials or no staged script unsaid, every
  refund reconciled, the consumer's first refund site not reconciling, the
  sweep tick never reconciling or reading the wrong rows, the tick's
  summary counting nothing, the route answering a stranger, showing
  another owner's row, applying on a dry read, reading rows not under
  review, looking a bad job id up, a refunded reply finalized as ok; the
  poll saying waiting on a poll that is not, the wait branch never asking,
  the thinking line never carrying the sentence; the script applying on
  any word, the workflow running on a push; the check losing the money
  read or its count; the image without the module. Full suite **5,257**
  (5,240 + the seventeen). The container harness
  was not re-run: nothing under `builder/build-server.mjs` or the template
  changed, and the one container-side consequence — the worker tree the
  image copies gaining a module — is what `test/dockerfile.test.mjs` and
  `test/container-images.test.mjs` read (the first went red the hour the
  module was written, the recorded trap, and the second until the module
  was in git at HEAD).
- **Stated residues.** (a) **The collector's re-run rule is unchanged**: a
  build whose look marked its record charged and then died still refuses
  to run again on the mark alone (`alreadyCharged`) — the older plan's
  build half, filed as its own task; the pages debit is idempotent by ref
  since 1c, so the rule guards a duplicate PUBLISH now, not a double
  charge. (b) An `unknown` row is re-read every tick and its retry capped
  at three PER ISOLATE — a cron isolate's memory resets with it, so a row
  whose upload is refused for ever costs a few API calls a day, said once
  per isolate. (c) The ancestry argument needs stage 6's serialization; the
  same push carries both. (d) The versions API rows carry `job` now (the
  owner's own job ids). (e) `live-ahead` and `chain-broken` are a person's
  — the owner's route shows why. (f) A kept `superseded-built-on` charges
  for a change a later revise may have redrawn: it WAS live, the same rule
  as any change followed by a revise. (g) The consumer's reconcile runs
  inside the delivery after the refund, a few R2 reads and one probe;
  under the job runner (task #93) it runs in the container with the same
  facts. (h) No row under review exists today (read live: 0), so the
  sweep's door is inert until the next mid-publish failure.
- **Not proven live.** The deploy rolls the container (`worker.js`,
  `site-builds.mjs` and the builder modules are image inputs; the 15–20
  minute hold applies). The canary needs a row under review, and none can
  be made without breaking a publish on purpose: the next mid-publish
  failure is the proof, and the log line is `reconcile: <id> kept|refunded
  (<kind>) — <why>` (or `unknown (<kind>) — … — left in review`) beside the
  consumer's refund, then `review reconcile: {…}` on the tick. Free today:
  the `reconcile check` workflow on fretwork-1 answers `rows: []` for 0.

### THE ADD-ON'S SCHEMA IS APPLIED AFTER THE COMPILE, UNDER A MIGRATION RECORD (2026-09-05, stage 8)

Owner: *"keep going"* (the next stage whose dependencies were met; 4b and
5d wait on the owner's 5a canary). An addition that touched the site's
database applied its schema BEFORE the page call and the compile, and a
publish that then failed kept the tables and said "your site is untouched":
run 33 left `waiting_list` on fretwork-1 with no page showing it, and no
record anywhere said which job made it, what it made, or that the page
never came. **Nothing in the page call, the compile or the render check
needs the schema applied** — the page call reads the SPEC, the render check
answers every `/api/` request with `[]` and `/auth/` with 401 — so the apply
is the last thing before the spine's publish gate now, under a record.

```
pickers · designers · seed net · #1 reserve (unchanged, before any write)
   │  aSpec = unionSpec(stored, merged)      ← what the page writer is shown
   ▼
page call · compile · render check · repair round (#2)
   │  the seam: aCharges.refused() > 0 → skip the apply (the spine's third ask refuses next)
   │            record `pending` → applySiteSchema → jobs → seed rows → the report on the record
   │            a refused apply → { refuse: { error: "schema" } } → the spine returns before staging
   ▼
the third ask · staging · the gate · activation · commit
   │  landed  → record `applied` (the version that went live)
   │  failed  → record `applied_without_page`, the reply LEADS with its sentence
pageless (a job, an internal function): the apply runs directly, `applied` at once
```

- **The seam offers two more things and knows nothing about schemas.**
  `afterCompile` is handed `version` (minted before the compile, the id the
  manifest carries), and may answer `{ refuse: { error, detail, ours } }`:
  the spine returns `{ok:false, error, ours, detail}` after the hook's own
  catch and before the build is replaced — still after the compile verdict
  and the dead-css refusal, before the third reservation ask, the staging
  and the gate. Nothing written, nothing activated, the consumer's refund
  clean. Only an object naming an error is a refusal; anything else reads
  as before, and the edit lanes and the rebuild drain hand no hook.
- **`aApplyBackend` is a closure built inside the backend block** (where
  `merged` and the seed are in scope, after sequence #1 and its refusal) and
  called exactly twice: the pageless path with no version, the hook with the
  publish's. Provisioning (`ensureSiteBackend`) stays where it was, before
  the page call — a database made for a page that never came is a database
  the next ask reuses. `aSpec = unionSpec(aSpec, merged)` (site-add.mjs,
  driven) is what the page writer is shown: the merged tables whole, this
  addition's functions, connections and jobs first and the stored ones it
  did not name after — what `loadSiteSchema` would answer after the apply,
  described before it.
- **The record**: `builder/site-migrations.mjs`, dependency-free, at
  `source/<slug>/migrations.json` (the answer store's pattern, admitted by
  the gateway wall's `source/` prefix — the runner writes it). One per job
  (`aJob.id`, or `sync:<trace cid>` synchronously), newest first,
  `MAX_MIGRATIONS` 50: `{job, slug, at, version, status, provisioned,
  tables: {added, altered, applied, refused}, functions: {designed, made,
  errors}, apis, jobs, seeded, publish}`. Filed `pending` BEFORE the first
  statement; `withApplied` folds the engine's own report by the names it
  writes (`made`, `made.functions`, `made.functionErrors`,
  `made.refusedRules` — derived from `site-schema.mjs` by the guard, so a
  new report field is folded or named; `authGrants` is the deliberate
  omission); `applied` with the version once the page is live;
  `applied_without_page` when the publish after the apply failed, with the
  publish's error; `failed` when the apply refused, with the scrubbed
  detail. **An instrument, never the authority**: every store read and
  write is best-effort and answers rather than throws — a record that could
  not be written never fails the addition it records. **No automatic
  reversal** (owner's rule): a table this job created, with zero rows and
  nothing referencing it, MAY be dropped by the deferred DELETE step and
  nothing else; the record is what that step will read. **Stated residue:
  the engine reports per table only at its end** — a `CREATE TABLE IF NOT
  EXISTS` it cannot run THROWS out of `applySiteSchema` (line ~1130, no
  try around it), so a `failed` record carries the error and not the list
  of tables that landed before it; the CREATE is idempotent, so the next
  ask re-runs it whole. Listing statements applied and refused per table
  is the engine's change, not the record's, and was not made here.
- **What the customer reads.** A refused apply: `error: "schema"`, 502,
  `ours: true`, "That change needed the site's database and it couldn't be
  applied — this is on us, and your site is untouched" — TRUE by
  construction now, since nothing was activated. A publish that failed
  after the apply: `migrationNote` LEADS the reply ("The database changes
  for this were made — now storing gear — but the page didn't publish, so
  the site is showing what it showed before. Ask again and I'll add the
  page without making the tables twice.") before the compile sentence,
  because "your site is untouched" would be a lie about the database and
  the merge is idempotent (an existing table takes new columns only).
  Every addon reply carries `migration` (`migrationSummary`), absent when no
  tier was designed. The browser needed no change: `msg` on failure, "now
  storing" on success, as before.
- **3b's reconcile settles a pending record** by the verdict, after the
  money and the stored reply, inside its own try: kept → `applied` with the
  job's own version, refunded → `applied_without_page`; another job's
  record and a settled one are left alone (driven). **`GET
  /api/site/migrations?slug=`** reads the list, owner-gated as the answer
  route is, read-only.
- **Guards.** `test/site-migrations.test.mjs` (18): the module driven
  (the key under the wall, junk reads, the fresh record, the fold off the
  engine's report shape with the names derived from the engine, the
  upsert and the cap, the mark and the settled time, the note and the
  summary), `unionSpec` driven, the seam read by order, the addon route
  read by order and absence (the closure built once and called twice, the
  apply inside it and nowhere inline, the record filed before the first
  statement, the hook's order — reserve #2, the swap, the gate, the ledger
  skip, the apply, the refusal, the swap returned — the pageless path's
  direct apply before its charge, the failure branch by its BRACES, the
  applied mark after the branch closes), the store helpers, the reconcile
  hop, the route; DRIVEN through the real router: the owner's route six
  ways, and the reconcile settling a pending record three ways against a
  staged fake site. **Six older guards went red or went stale for the
  change and were re-anchored, not appeased**: `spine-repair`'s hook
  signature (it takes `version`) and its last return (`aSwap`);
  `site-add`, `addon-queue` and `site-addon` read "the pageless answer
  after the schema apply" as a TEXT POSITION, which stayed true after the
  apply moved into a closure above the block and became a claim about
  nothing — each reads the pageless block's own `await aApplyBackend(null)`
  before its charge now. `edit-reserve-refused` and `api-auth` still hold:
  sequence #1 precedes the closure's construction, inside the backend
  block, so the reserve still precedes the DDL on both paths.
- **Sweep: 51 mutants, 48 killed, none survived, none unapplied, three
  comment-only controls survived** (the module, the Worker, the add module
  each) — in the module: a record with no job kept, a fresh record not
  pending, a non-string version kept, the applied names not lowercased, the
  refused rules dropped, a function error unbounded, a new record at the
  back, the same job's earlier record kept beside the new, any word a state,
  no settled time, a settled record read as pending, the note speaking for
  every state, the note without the tables, the summary without the
  version; in the add module: the page call shown the stored tables only,
  the stored entries the merge did not name dropped, the stored copy of a
  re-declared function winning; in the Worker: the seam ignoring a refusal,
  a refusal read as theirs, the hook not handed the version, the pageless
  path never applying, the hook applying for a ledger that refused or when
  nothing was designed, a refused apply publishing anyway, the pending
  record never filed, a refused apply marking nothing or answering ok, the
  report never folded, a landed pageless apply left pending, a refused
  pageless apply as a 422, a failed publish after the apply marking
  nothing, a refused apply marked applied_without_page or wearing the
  compile's name, the customer not told what stands, a landed publish left
  pending, either reply dropping the record, the reconcile marking every
  record applied or never settling one, a store that cannot be read
  throwing out of the addition, the route answering a stranger or asking no
  sign-in, the record's job the trace even under a job, the page call
  reading the stored spec, the seam's refusal read again after the swap,
  the store writing a shape the reader cannot read, a settle for a job with
  no record writing anyway; the image without the module. **One survived
  the first pass, and it was the sweep's own**: W28 was written to MOVE the
  seam's refusal read past the build swap and instead ADDED a second, looser
  read beside the early one (`seamOut.refuse` with no `error`), so every
  well-formed refusal still returned early and the order checks, which see
  only the first read, passed. A behavioural change all the same — a
  malformed hook answer became a refusal — and the seam guard now forbids
  any refusal read after the replacement and counts the condition once;
  re-run, killed. Its first draft counted `seamOut.refuse.error` and went
  red on the clean tree, because the RETURN line names the field too — the
  count reads the condition's own spelling now. Full suite **5,275**
  (5,257 + the eighteen), run on the restored tree after the sweep.
- **MERGED AND DEPLOYED (owner, 2026-09-05: *"ok lets merge then"*).**
  Main was fast-forwarded to the branch tip (`12fff44b`, fourteen commits:
  stages 1a–3b and 8 in one push; main had nothing of its own and
  `merge-tree` was clean) at 23:35Z. **Deploy run 2030, the FIRST GATED
  DEPLOY, green in 3m28s**: `deploy gate (set)` 1 s; the image step 2m33s —
  `built isibi-app-sitebuildcontainer:e86…54e47 (registry answered 404;
  155 inputs off ./Dockerfile)`, pushed, so the container ROLLED from
  `b8fa5420d4b3a898` (`EDIT isibi-app-sitebuildcontainer`, applied
  23:39:07Z; the game image `no changes`); `deploy drain: no live leases
  after 1s — deploying` (nothing was running); Wrangler 21 s, `DEPLOY_ID`
  as a var; the clear step on success: `deploy gate: left to expire for
  12fff44b… — the new isolates claim through it, the old ones defer until
  they are gone`. Both `unit tests` runs for the commit (2260 on the
  branch, 2261 on main) green. The 15–20 minute hold after the roll ends
  ~23:55Z; the gate expires ~00:21Z. The migrations of stages 1a–3b, live
  and inert until now, have their Worker.
- **Not proven live.** The
  proof is the next backend addon on fretwork-1 (~12–21 credits, owner's
  call): the reply carries `migration.status: "applied"` with the version,
  `/api/site/migrations?slug=fretwork-1` lists it, and the trace carries
  `schema start/ok` AFTER `repair` and before `stage`. The
  `applied_without_page` shape needs a publish that fails after the seam,
  which cannot be made on purpose. No database function changed; the
  container harness was not re-run (no container-side code changed; the
  image guards read the module).

### THE PLATFORM REBUILD IS A JOB, AND `jobs/` IS SWEPT (2026-09-06, stage 9)

Owner: *"finish the missing steps"* — the plan's last row, and its two halves
are unrelated except that both are litter the job machinery left behind.

**A REBUILD IS A JOB NOW, AND THE CRON ONLY FILES IT.** It used to run inside
the tick: `recompileAndPublish` awaited there, eight sites at a time, every one
bounded by the fifteen minutes an invocation gets and none of them holding a
lease. A tick that ran out of clock left a container mid-compile with nothing
recording it; a deploy rolled under it (3a gates the queue, never the cron);
and none of the recovery the edit path grew — the row, the lease, the
heartbeat, the stale sweep, the reconcile — applied to a rebuild at all.

```
cron tick ──rebuild_claim (the site's own lock, unchanged)──► enqueueEditJob(op "rebuild", the OWNER's uid)
          ──defer the row PENDING_DEFER_SEC, no attempt, "handed to job <id>"──► returns
consumer  ──the ordinary edit consumer, in the site's container when the flags admit──►
          POST /api/site/<slug>/rebuild   (INTERNAL: a replay marker is the only way in)
          ──loadSiteSourceForEdit → recompileAndPublish(label "platform rebuild", job)──► 200, the spine's own answer
a later tick ──enqueueEditJob with the SAME key answers `duplicate` + the job id──► edit_get
          terminal → the stored reply IS `verdictFor`'s input → forget | defer | park
```

- **THE ROW IS STILL THE QUEUE, and the drain still makes every verdict.** The
  job does not touch `site_rebuild` — that would need the gateway wall to admit
  a PATCH, which no job has and none should — so the drain reads the job's own
  answer on a later tick and applies `verdictFor` exactly as it always did:
  `done` forgets the row, `retry` backs off, `stuck` parks at the last rung with
  its reason. What is new is `pending`, read FIRST: the job has not answered,
  so no attempt is counted and no rung climbed — the busy branch's rule, for the
  same reason.
- **`rebuildIdem` IS WHAT MAKES THAT POSSIBLE WITHOUT A COLUMN.** `edit_create`
  keys on `(uid, slug, op, idem_key)`, so asking twice inside one attempt
  answers the SAME job — that is how a later tick finds the job it filed
  instead of filing a second one. The key is the row's `enqueued_at` (written
  once by the operator sweep's insert, never touched by the drain — the
  generation) and its `attempts` (a failed rebuild deserves a fresh job, not
  the old one's answer). A row whose stamp cannot be read is REFUSED a name
  rather than given a guessed one: a key that changed every tick would file a
  rebuild every two minutes. **No migration and no new column**; the `due` read
  carries one more field.
- **THE ROUTE IS INTERNAL AND REFUSES ANYTHING THAT IS NOT A REPLAY.** There is
  no owner-facing rebuild button and this is not one — an owner reaching it
  directly would be unbounded free container time, once per press. The replay
  marker is minted server-side and lives only in the service-role job object,
  so requiring it is requiring the queue. `editReplayUser` is offered to
  `(ed || ad || rb)` and nothing else; the route answers 404 without a marker,
  before it reads anything, and takes the same `assertOwner` gate every route
  in that block takes.
- **IT COSTS NOTHING, and that is now a property of the job rather than of the
  cron.** No model call on the path, so the job reserves nothing and the
  publish gate exempts it (`edit_exempt`, the free-rung state) — driven end to
  end. The spine is handed no charge funnel, so translations stay free on a
  rebuild as they always were.
- **THE DELAY IS NOT POLITENESS.** `rebuild_claim` marks the row
  (`running_until`), which is exactly what `site_busy` reads as "the platform
  is rebuilding this site" — so the job's own `edit_claim` would race the
  deferral that clears it. `REBUILD_START_DELAY_S` (5 s) on the send is longer
  than the two writes between; a delivery that beats it anyway costs one
  deferral and heals itself.
- **What this buys**: the tick returns in a second instead of holding an
  invocation; a rebuild gets a lease, a heartbeat and the sweeps; it is
  DEFERRED BY A DEPLOY GATE (3a's stated residue (d) — "the rebuild drain is
  not gated" — is closed by the job's own claim naming `DEPLOY_ID`); it runs in
  the site's container under the runner flags; and it is serialized against the
  customer's own edits by the same lock, from both sides.

**AND NOTHING SWEPT `jobs/` — the code said so in three places.** Every object
under it is deleted on its happy path; what is left is the unhappy ones: a
build whose message was never delivered, an answer nobody came back for, a
resume record whose collector never came, a request whose row was failed before
any consumer claimed it. **And they are not all small**: a build's stored
request carries the customer's whole POST body, up to 24MB with attachments —
"a stranded record is a few kilobytes" was true of the resume record and never
of the job. `builder/job-retention.mjs` (dependency-free, driven): age alone
decides, because the longest a job can legitimately hold one is bounded from
every side (14 min of budget, 30 in the container, 45 of deferrals, 53 of the
browser's watch) and `JOB_RETENTION_MS` is **seven days** — so the sweep reads
no row and takes no lease. **A rotation, not a scan**: one nibble of the prefix
per tick (`jobs/7`, `jobs/edit/7`), the sixteen coming round every 32 minutes,
because R2 lists lexicographically and a fixed page would hide its tail for
ever. An object whose `uploaded` cannot be read is KEPT (cannot-tell is never
nothing-there, pointed at a delete); a key outside `jobs/` is never returned
whatever the listing said; one delete call for the batch, capped at 100.

- **Guards**: `test/job-retention.test.mjs` (5) — the window against the four
  bounds it rests on, the rotation's coverage, what is old enough and what is
  never touched, a tick driven (both prefixes, one delete, a quiet tick, a
  failed listing, a failed delete, deps that are not deps), and the cron's own
  hop; `test/rebuild-job.test.mjs` (11) — the key, the pending verdict, the
  drain's branch driven, the Worker's dep DRIVEN THROUGH THE REAL CRON against
  a fake Supabase (filed, found again, done, parked, lost, under review, no
  stamp, no owner, busy), the route's gate through the real router, and **the
  whole loop through the real queue consumer**: a filed job replays into the
  route, compiles once, reaches no model, reserves nothing, is exempted, and
  stores an answer `verdictFor` reads as `done`.
- **Six older guards went red for the change and were re-anchored, not
  appeased**: the replay identity's route set in two files (three routes now,
  and the third files no job of its own — the census names who files instead),
  `enqueueEditJob`'s parameter list (the op and its default are the property),
  the editing readers (the rebuild's read moved one hop into the route), and
  the image's input list (the new module, caught by the walk the hour it was
  written — the recorded trap, again).
- **Sweep: 26 mutants, 26 killed, none unapplied, two comment-only controls
  survived — one survived the first pass and it was the guard's**: the cron's
  call to the retention sweep was READ, and `if (false)` leaves a call exactly
  where a regex looks for it (the recorded trap). Driven through the real cron
  now, and re-run to a kill.
  Full suite **5,354**.
- **Not proven live.** The next platform republish is the proof, and it is
  free: file a `site_rebuild` row and watch one tick file a job
  (`site rebuild: {"pending":1…}`), the consumer publish it, and a later tick
  forget the row. The retention sweep is inert until something is a week old —
  `job retention:` appears only when it takes something out. The deploy rolls
  the container (`worker.js` and the builder modules are image inputs), so the
  15–20 minute hold applies.

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

**A FOUNDER IS NEVER CREDITED BACK (2026-09-05, stage 1b of the architecture
plan, owner: *"ok go 1b"*).** `use_credits`, `use_credits_for` and
`get_credits` answer the founder sentinel (1000000) before any debit, and
until this day `credit_back` and `refund_charge` credited a founder like
anyone else — a build refund after a failure, or the media side's refund of a
failed generation, would have paid back money never taken. Unreachable only
while the one founder had no `credits` row; a purchase or a grant on that
account would have armed it. Now both are decided by `private.founders` — the
mirror of the check `use_credits` makes, NEVER a balance threshold — and
answer without writing for a founder: `credit_back`'s one UPDATE is gated in
its WHERE, `refund_charge` refuses before the row lock and leaves the charge
row as it is, returning 0. Migration
`supabase/applied/20260905154557_founder_guard_on_refunds.sql`, applied live
through the Supabase connector and read back with `pg_get_functiondef` into
the live snapshot beside it — which holds those two now as well as every
`edit_*` — both still `service_role`-only (read from `pg_proc.proacl`, not
assumed). **Driven on the live database, rolled back**:
`scripts/edit-rpc-check.sql` sections 14b (as a founder — `use_credits`
answers the sentinel and moves nothing, `credit_back` moves nothing,
`refund_charge` answers 0 and leaves the row) and 16b (the same two still pay
a customer back, once, and a repeat is refused; the control without which a
guard that refused EVERYONE would pass) — **run RED against the old bodies
first (FAIL 48: `credit_back` paid a founder, 494 → 496, taken back by the
rollback) and GREEN after the migration: ALL 65 CHECKS PASSED**, driving as a
funded non-founder account. The block impersonates the user for `use_credits`
by setting the request's jwt claims (`set_config`, transaction-local), which is
how a function keyed on `auth.uid()` is driven from a console.
`test/refund-founder-guard.test.mjs` reads the record: the guard ahead of every
write in both bodies, the grants, the snapshot equal to the migration byte for
byte (a hand edit to either shows), the check driving both as a founder and
then as a customer, in that order. The edit path never needed this —
`edit_reserve` marks a founder's job `exempt` and `edit_refund` refunds only
`reserved` — and what 1b does NOT do is refund a customer who became a founder
after a real debit: the plan's stage 1c reads the debit row instead of the
account. **The migration file is named for the REMOTE version** (read back
from the migration list after the apply, as the folder's README asks); the
previous entry (`…034000_edit_exempt_free_rung` for a remote `…035009`) was
not, so line the two up by name, not by number.

**EXEMPTION AND DEBIT ARE EXPLICIT RESULTS ON THE BUILD PATH (2026-09-05,
stage 1c, owner: *"ok go 1c"*).** The build route paid with `use_credits`,
whose answer is a balance or -1: a founder's call answered the sentinel and
the route read it as a debit; a short balance answered -1 and `collectCredits`
took what it could; and every refund was a NUMBER the route remembered
(`refundCredits(schemaCost + SITE_BUILD_FEE)`), handed to `credit_back`, which
credited it whether or not it had ever been taken. Now the ledger says what it
did. Two RPCs, migration
`supabase/applied/20260905161410_credit_debit_and_reverse.sql` (named for the
remote version), read back with `pg_get_functiondef` into the live snapshot:
- **`credit_debit(p_amount, p_ref, p_reason, p_partial)`** — caller-scoped
  (`auth.uid()`), answers `{ok, exempt, taken, repeat, prior, balance, short}`.
  A founder answers `exempt` with nothing taken and NO row, decided by
  `private.founders` before the grant insert; the account row is locked
  BEFORE the repeat check, so a duplicate delivery waits and then meets the
  first one's row (`repeat: true, prior: <what it took>`); a bill above the
  balance is refused whole (`ok: false, error: "insufficient"`) unless
  `p_partial`, when it takes what is there and says `short`; a real debit
  writes a `credit_events` row of kind `build` under the caller's ref.
  Granted to `authenticated` and `service_role`.
- **`credit_reverse(p_target, p_ref, p_reason, p_amount)`** — service-role
  only; finds the debit row by ref AND account (one account's ref can never be
  reversed onto another), refunds `least(p_amount, debited − already)` and
  writes the refund row under the reversal's own reason (`debit` refused as a
  reason), so a retried reversal answers `repeat`, two reversals of one debit
  never exceed it, and `already` rides on every answer so a re-run build can
  tell "returned before" from "kept". **It reads the row and never the
  founders table**: a founder at debit time wrote no row and gets 0; a
  customer who became a founder after a real debit still has the row and is
  paid back — the case 1b could not cover.
**The route is a ledger of refs.** `billRef = "build:" + (jobId ||
randomUUID())` — the JOB'S id under the queue, so a duplicate delivery
re-running the body meets its own rows — and `debitRef(step)` names each
debit: `:deposit`, `:settle`, `:pages`. `bill` (ref → `{taken, back}`),
`owed()`, `noteDebit` (exempt → the route's `exempt` flag; a repeat remembered
at `prior`), `giveBack(ref, reason, amount)` (records `back` from the ledger's
`already + refunded`, sets `refundShort` when the reversal did not land or
left more than asked), `refundFields()` (NO amount any more: reverses every
ref for what stays, recomputes `refundShort` from `owed()`). The deposit is an
explicit whole debit; a refused one is the 402 with no balance clause; the
floor reads the balance the ledger answered plus what it took (a founder is
not gated: nothing is being spent); under the floor the deposit is reversed
under `floor`; the settle is a PARTIAL debit under `:settle` and a cheaper
call reverses the deposit's own row under `settle`; a failed design call
reverses under `design` and the reply's `cost` is `owed()`; the six later
refusals `await refundFields()`; `schemaCost = owed()`. The pages debit rides
`billRef + ":pages"` through `buildAndPublishPages`' `useCredits` dep
(partial), falling back to `collectCredits` for a resume record stored before
the ref existed, and **`billRef` is in `buildArgs`** so a resume debits under
the SAME ref. `publishPages`' `settle` reads the ledger's object — `taken`
for `cost`/`charged`, `exempt` and `repeat` carried on its reply; the number
and void contracts untouched — and the route's reply carries `exempt: true`
(its own flag, or the pages') instead of claiming a charge; `notes` is left
the model's (the salvage note's rule: its own field, never a sentence glued
on). `scripts/build-as-owner.mjs` step 5 prints it. **What stays**: the
media side on `use_credits` with 1b's founder guard as the belt; the edit
path's sequenced reserves; `use_credits` itself, for every caller not moved.
**Driven on the live database, rolled back**: `scripts/edit-rpc-check.sql`
sections 14c (as a founder — exempt, no row, a reversal of that ref answers
0) and 17 (as a customer — the debit and its row, a repeat with `prior`, a
refusal whole, a partial that says `short` and is reversed bounded, a settle
of 1 then a refund of 2 bounded by the debit less the first, a retried
reversal `repeat`, a stranger's reversal 0, three rows on the ledger):
**ALL 78 CHECKS PASSED.** `test/credit-debit.test.mjs` DRIVES the route
through `worker.fetch` against a stubbed ledger — a founder, under the floor,
a failed design, a reversal refused, a reversal short, a reversal that counts
`already`, an account that cannot pay, a duplicate delivery — and reads the
helpers, the route's refs and flags, the record and the check;
`test/publish-pages.test.mjs` drives the object contract; the must-list in
`test/edit-matrix.test.mjs` names the eight new FAIL messages. Thirteen
older guards went red for the change and were re-anchored, not appeased,
each naming the spelling that moved (the deposit's `useCredits(auth,
SITE_BUILD_FEE)`, `collectCredits(auth, settle`, `refundCredits(`, the
design catch's window, the settle regexes, `balanceAfter + SITE_BUILD_FEE <
floor` and `creditBack(env, bu.id, SITE_BUILD_FEE)` in `build-models`, the
design refusal's literal `cost: 0,` in `model-xai`, and `picker = null,
models = null })` pinned as the END of the page builder's signature in
`wiring`) — and one of them was a byte window, `stageAt + 400`, in the guard
whose own comment records fixing a byte window: the tail was outrun by the
comment above `cost:` growing one sentence, and it ends at a landmark inside
the reply now. **Three false alarms in the new guards, each the guard's
fault**: the sentinel
forbidden as `1000000)` matched the partial debit's rounding
(`floor(… * 1000000) / 1000000`; it forbids `return 1000000` now); a
"weren't charged" sentence demanded in `notes`, against the module's own
rule; and the route's one free hop between the deposit and the design call —
`use_quota` for the sitelinks read, fail-open, no credits — read as an
unstubbed ledger call. **Sweep: 41 mutants, 41 killed, none unapplied, three
comment-only controls survived** (one applied to the migration AND the
snapshot together, so the byte-equality guard was neutral and every SQL
mutant had to be caught by a property) — the helpers reading a founder as a
customer, dropping `repeat` or `prior`, a refused or short reversal read as
landed, a throw on the recovery path; the route's flag not set, a repeat
remembered at 0, `back` never recorded or ignoring `already`, `refundShort`
never set, the deposit and floor gates gone, the balance quoted without the
deposit, the floor reversal under the wrong reason, the design catch
reversing nothing or answering 0, a founder settled or "given back",
`schemaCost` assumed, the pages debit off the ref, the ref not stored, the
reply without `exempt`, `refundFields` reversing 1 or never short; the
pages settle taking the bill, dropping `exempt` or `repeat`, or reading the
object as void; the SQL granting a founder a row first, the repeat checked
before the lock, a part taken unasked, the ref matched without the account,
a reversal unbounded, `already` read before the lock, the reversal reading
the founders table, the service function granted to callers, the repeat
answer without `prior`; the check losing a case, its founder debit partial,
its customer half run as a founder. Full suite 5,122 green. **One survived the first pass and it was
the RUNNER's**: `String.prototype.replace` read the `$'` at the end of the
mutant's regex literal as "the text after the match", so the file changed,
the checksum said applied, and the mutant that landed was not the one
written — the recorded "a mutant that never applied", one layer down, past
a checksum. The runner replaces through a function now and verifies the
landed text IS the written text; re-run, killed. **Not proven live**: the migration is live and inert
until the Worker carrying the route deploys (nothing calls the two functions
before that); the first build after it is the proof, and the owner's own
builds are the founder case — `exempt=true` on the owner-build log's step 5.

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
  `lane:correct` **134s**, `publish:1` 95s, `publish:2` 120s. Only
  `fretwork-1` was on the allowlist until 2026-09-04; **THE WIDE DOOR IS
  OPEN SINCE THEN** (owner, after the capacity review: *"lets start
  fixing"*). Off the allowlist every edit ran on the customer's own
  connection, reset at ~273 s (an addon died at 257 s on run 21), and a
  compile alone is 150–220 s — so most edits and every addon failed for
  every customer but one. `EDIT_ASYNC_EVERYONE` (`editAsyncEveryone`,
  affirmative words only, `on` by default in `deploy.yml`, a GitHub secret
  to turn off) puts every signed-in owner's edit and addon through the
  queue; `EDIT_ASYNC` off still stops everything in one step, and the
  allowlist still refuses a wildcard, which is why the widening is its own
  variable rather than an entry. `test/edit-job.test.mjs`; sweep 8/8,
  control survived. Builds were never on this fork: always queued, streamed
  and resumable.
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
  timed out at the cap again (task 47 — **FIXED 2026-09-06**: the ceiling
  below); `action` no-change because run 11
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
- **Balance: 505 credits** (read off the ledger 2026-09-06 19:12Z after the
  owner's *"Top it up"*: a DIRECT GRANT of 500, not a purchase — `add_credits`
  is mint-key gated and the secret is not in a session, so the grant mirrors
  that function's body minus the mint check, one `purchases` row under
  `ref 'grant:session_…:2026-09-06'` with **`amount_cents` 0**, the ref its
  idempotency, proven by a re-run that moved nothing. It was 5 before, and
  unchanged since 2026-09-04 20:48Z; run 37 took 24 → 7, run 38 7 → 6, run 39
  6 → 5.) It was **0**
  on 08-29;
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
- **`site build` is 373/373** against the real container — **and CI has read
  that number since the cap moved to 35 minutes**: runs 1065 and 1066 both
  printed `373 passed, 0 failed`, where stage 5b/5c's own run had been killed
  at the 25-minute wall and the count stood on a local run alone (2026-09-06, stage
  5b's six: a build launch taken by `POST /job/run`, the real runner's
  build consumer run to its end, started as a build naming the launch's
  site and holder, the job's own object read through the gateway with
  the job token, nothing to run said, the container not busy after; 367
  earlier the same day, stage
  5d's eight: a launch with a deadline taken and its record carrying it,
  the child running, `DELETE /job/<id>` answering 200 `{stopping, why:
  cancel}`, the real child ended under the stop grace with `stopped:
  cancel` on its record, by the runner's own exit code or the signal and
  never the kill, a second DELETE 409, an unknown job 404, the container
  not busy after; 359 earlier the same day, stage
  4b's four: a v1 launch refused 400 by name, a v2 launch carrying a
  credential refused 400 naming it, the real runner's claim read off a
  gateway stub's socket with the job token as its bearer, the marker as
  its mint; 355 on 2026-09-05, stage
  3a's stopping case added four — a hold, SIGTERM under it with the service
  reporting `stopping` and staying up, `POST /job/run` answering 503
  `{error: stopping}`, no job record left — and stage 2c's two, the report
  naming its job and generation and no beat for a settled generation, were
  measured for the first time on this run: 349 earlier the same day, stage
  7's version case added eleven: a site built with a version answers
  `x-site-version`, serves an asset from its OWN prefix, a previous build's
  chunk from the PARENT's, never the legacy prefix when a parent exists, a
  404 for a file nobody has; a versionless script sends no header and reads
  the legacy prefix as before; a malformed version bakes as none — the
  bundle EXECUTED against a bucket laid out as a staged build; 338 earlier
  the same day, when the job runner's door added seven: `POST /job/run` refusing an unreadable
  launch, taking a good one, the real runner run to the consumer's own
  refusal with exit 0, its lines in the job's tail, busy released, `GET
  /job/<id>` for a job never run; 331 on 2026-09-04 after the
  run-36 follow-ups added five: the own-parts build's render report naming
  no `-parts` route, and the `hydrate-diff` page — builds, the browser
  reports the mismatch as a throw on `/`, the finding names both texts, as
  a hydration mismatch by name; 326 on 2026-09-03 after the QR list's two-code
  build and the pre-list payload added sixteen); the unit suite is 5,411
  (2026-09-07, after the upload-shadow wall's thirteen in
  `test/upload-shadow.test.mjs` — the pair DERIVED from the baker's own two
  branches in both directions, the sentence held to a mechanism that exists,
  the wall's placement and its two fail-open rules, and the refusal DRIVEN
  through the real route with the lane's tool counted, beside the two controls
  that stop a wall which refuses everything from passing; 5,398 before it,
  after the streamed lane call's five in
  `test/lane-stream.test.mjs` — the real `quickSend` EVALUATED out of
  worker.js with `callBuilderModel` recorded: the flag reaching the module on
  both caller shapes, the queued ceiling above 240 s and below a build's, the
  job still only making it smaller, the synchronous path still at 240 s, and
  the wrapper's own forwarding read; before it publication integrity's
  twenty-five in `test/publish-integrity.test.mjs` — five upload answers,
  both undo legs and their races, the sidecar branch by branch, the three
  lease shapes each with its control, first-activation racing, the
  end-to-end failed upload, recovery refused over a newer publication, and
  `compileMsg` driven; 5,368 before them, after task #47's five in
  `test/edit-lanes.test.mjs` — the
  derivation and its clamp, the stylesheet untouched beside the drawn marks
  really bounded, the request carrying its own ceiling, the caps asserted to BE
  the refusals, and the floor driven; before it task #88's one — both language loops driven for real
  overlap and read for an ordered fold that never awaits; and before it
  task #87's eight in `test/site-render.test.mjs` — the
  classification driven both ways with its control, the predicate's two
  halves each driven alone, the escalation at two attempts and its refusal
  at one, a route saved by its sibling, every other kind left alone, the
  check's own wiring read, and the customer's sentence; plus the addon
  harness's slow case; 5,354 after stage 9's sixteen — `test/job-retention.test.mjs`'s
  five, the window against the bounds it rests on, the rotation, what is
  old enough and what is never touched, a tick driven and the cron's hop;
  and `test/rebuild-job.test.mjs`'s eleven, the key, the pending verdict, the
  drain's branch, the Worker's dep DRIVEN through the real cron, the
  route's gate through the real router, the retention sweep driven on that
  same tick, and the whole loop through the real queue consumer; 5,338 the
  same day, after stage 5e's five in
  `test/broad-rollout.test.mjs` — the
  arithmetic that makes the inline budget's cap necessary, the decision
  driven, the handler's per-message clock and both hand-downs, each
  consumer's capped budget beside the container's uncapped one, and the
  broad flag's own properties; 5,333 the same day,
  after stage 5b/5c's twenty-two in `test/build-runner.test.mjs`
  — the numbers, the budget's stop, the pre-scope token and both walls, the
  scope op, the launch, the env and the shim, the fork DRIVEN six ways, the
  runner's takeover DRIVEN, `canFire` evaluated, the build route's scope
  hook DRIVEN, the hops read; 5,311 the same day, after stage 5d's seventeen — `test/job-clock.test.mjs`'s
  eight, the policy with fake timers, and `test/job-stop.test.mjs`'s nine,
  the launch, the runner's stop, the service driven with fakes, a real
  child stopped, the routes, the drain, the gate, the sentence and the
  fire; 5,294 the same day, after stage 4b's eighteen in `test/sb-gateway.test.mjs` —
  the wall rule by rule, the handler against a fake Supabase, the shim, the
  real consumer end to end inside a container env, the launch, the runner,
  the env, the list, the vault, the lists held to the code — and the
  Worker's mount driven in `container-job`; 5,275
  on 2026-09-05, after stage 8's eighteen in `test/site-migrations.test.mjs`
  — the record module driven with the engine's own report names, the spec
  union driven, the seam and the addon route read by order and absence,
  the owner's route and the reconcile's settle DRIVEN; 5,257 the same day
  after stage 3b's seventeen in `test/site-reconcile.test.mjs`
  — the verdict rule by rule, the ancestry, the reply shapes, the probe,
  the Worker's reconcile DRIVEN against a staged fake site with a fake
  dispatch namespace, the consumer and the sweep's door and the owner's
  route driven, the hops, the script and the workflow, the check's
  section, the browser's waiting sentence; 5,240 the same day after stage 3a's twenty-three in `test/deploy-gate.test.mjs`
  — the numbers, the migration and the snapshot, the check's order, the
  workflow's three steps, the script's every function driven against a
  fake fetch and clock, the edit and build consumers and the collector
  DRIVEN through `worker.queue` under a gate and under a database that
  will not answer, the stale sweep driven, the container's door and the
  poll routes; 5,217 the same day after stage 6's twenty-six — `test/site-busy.test.mjs`'s
  nineteen: the numbers, the migration and the snapshot, the check's order,
  the edit and build consumers, the runner's takeover and the poll DRIVEN,
  every Worker hop read; plus the repair's four in `site-builds`, the busy
  deferral in `site-rebuild` and its wiring, and the busy re-send in
  `container-job`; 5,191 the same day after stage 2c's thirty-one in `test/build-jobs.test.mjs` —
  the row's vocabulary, the migration and the snapshot, the check's order,
  every Worker hop, and the poll, beat, report and consumer DRIVEN; 5,160
  the same day after stage 2b's three in `test/edit-poll.test.mjs` — the
  record driven, bounded at the write and the read; the poll after a resume;
  the wiring read; 5,157 the same day after stage 2a's nine — `test/sweep-recovery.test.mjs`'s
  eight, the migration and its column, the sweep's branches and their order,
  the snapshot equal byte for byte, the grants, the check's three rows, the
  Worker's log and both readers; and `test/edit-poll.test.mjs`'s recovered
  case, `isRecovered` and the sentence driven; 5,148 the same day after stage
  4a's five — `test/gateway-refusal.test.mjs`'s
  three, `compileMsg` driven and the wall's keys derived from their writers,
  and the runtime's two, the typed refusal through the real handler and the
  shim's round-trips for the sidecar and the marker; 5,143 the same day
  after stage 7's twenty-one — `test/site-builds.test.mjs`'s
  twenty, the module driven against a fake R2 that keeps etags and honours
  `onlyIf` plus the wiring of both publish paths, the script, the container,
  the fallback, the card, the delete, the restore and the wall, and
  `site-live`'s activated-restore case; 5,122 the same day after stage 1c's
  sixteen — `test/credit-debit.test.mjs`'s
  fifteen, the route DRIVEN eight ways against a stubbed ledger plus the
  helpers, the refs, the record and the check read, and the pages settle's
  object contract in `publish-pages`; 5,106 the same day after stage 1b's six —
  `test/refund-founder-guard.test.mjs`,
  which reads the record of the founder guard; 5,100 the same day after stage
  1a-ii/iii's twelve — the two rungs' `before` hook
  driven six ways, the synchronous route driven three ways against a stubbed
  ledger, and the stage's own source guards; 5,088 the same day after stage
  1a-i's nine — the five driven consumer cases and four source guards; before
  them 5,079
  (2026-09-05, after the refused-reservation guards — five driven consumer
  runs and four source reads in `test/edit-reserve-refused.test.mjs` — and
  before them 5,079 after the job runner's guards — the runtime's thirteen, the
  runner's sixteen, the Dockerfile guard's five — and before them the drain's
  concurrency case, the wide door's three and
  container room's sixteen —
  the library's three answers, the loop, both call sites, the no-room
  build — and before them the translation charge's three — the spine's funnel and
  every route's hop read, the bilingual edit DRIVEN against the ledger, the
  build's one bill driven — the translation fix's two — the picked model and the
  cache rules — the translation instrument's two — the spine's marks
  and the harness's langs case — and the copy-the-first's-design guards' five — the rule on
  both hops, the directive, `pageComponents` driven, the note and the route's
  hop, the structure reader with run 36's bands — and before them the run-36
  follow-ups' six cases — the repair call's room, the driven `routePaths`
  walk, the hydration detail, the probe's scope, the route order, the
  harness wiring — the second-one guards' five and the registry probe's
  two). **In this sandbox the
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
**And `slice(start, -1)` is the OTHER half of that trap (2026-09-05)**: the
report-send guard's closing landmark was `async function sweepModelJobs(` —
declared WITHOUT `async` — so its window was the whole rest of build-server.mjs,
passed on any `catch` anywhere below, and went red for a `throw` inside a string
a thousand lines away. A missing END landmark is a window that swallows the file.

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
re-typed. (`resumeEditJob` had no callers until stage 2b, 2026-09-05 — said out
loud rather than left to be found, since wiring it starts real behaviour on page
load; the entry below the sweep's records how it was wired, and the `lost`
answer is what a record from before that day still gets.)

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

**A COMMITTED JOB WITH NO FINALIZE HELD A SWEEP SLOT FOR EVER (2026-09-05,
stage 2a of the architecture plan, owner: *"go"*; found by the plan's audit,
never live — zero such rows).** The trap one entry up, one state over:
"answered, nothing to ship" got its terminal state on 2026-09-01; "shipped,
never answered" had none. A job that died after `edit_committed` and before
`edit_finalize` sat `publishing` with `published_at` set: `edit_sweep_lost`
called the refund, which refused it as `published` (rightly — the change is
live), the sweep counted that as LOST, updated nothing, and selected the row
again every two-minute tick — one of the batch's twenty slots held for ever,
the poll route answering 202 to a browser whose `wait` branch has no bound,
and only a hand `edit_finalize` closing it. **Driven RED against the live body
before the fix** (`scripts/edit-rpc-check.sql` section 18, FAIL 65: the live
sweep answering `{lost: 1, refunded: 0}` for a committed row), then migration
`20260905175752_sweep_finalizes_committed` (applied through the connector,
read back with `pg_get_functiondef` into the live snapshot): a `published`
refusal FINALIZES the row with a reply the poll route can serve — the
consumer's own stored shape `{status, type, body}`, the body as TEXT (the
route serves a terminal row's reply only when `res.body` is a string), saying
`{ok: true, recovered: true, job, cost, build}`; the reserve stands, as for
any shipped edit, and a late real finalize still wins (`result =
coalesce(p_result, result)` on a row already `done`). `edit_jobs.sweep_tries`
counts every attempt, FIRST, so a refusal with no branch (`no-job`,
`terminal`: a race this tick lost, counted `stuck`) still moves the row toward
the ceiling; a row five ticks could not settle is PARKED in review before a
sixth try — `review_note` "sweep exhausted", out of the batch, its site closed
to new edits as every review row's is, the money untouched, a person settling
it through `edit_reconcile` — with the sweep's own conditions re-asked at the
write so a row another caller moved is left alone. No answer the RPCs give
today leaves a row in the batch after one tick; the ceiling is the belt for
the shape nobody has named yet. The Worker logs the five counts when any is
positive. **The browser renders it as what it is**: `EditPoll.isRecovered`
(ok AND recovered — nothing writes the other shape, and reading it as a
success would put a green tick over a failure) and `outcomeMessage("recovered")`
— "✅ Your change was published — but the details of what it did were lost
along the way" — asked by BOTH readers (`editReply`, `addonReplyText`) before
any layer or count, because the stored reply reaches whichever reader the
route that filed the job uses; `applyEditResult` / `applyAddonResult` already
refresh the balance and bump the preview. Section 18: **14 of 14 on the
migrated database, rolled back** — a committed row finalized, money untouched,
the reply readable as the route reads it, not swept again; a row at five
parked with its note, money untouched, left alone by the next tick,
reconciled; a row at four settled, not parked — the control without which a
sweep that parked everything would pass. `test/sweep-recovery.test.mjs` reads
the record (the migration and its column, the snapshot equal byte for byte,
the check's three rows, the Worker's log, both readers) and
`test/edit-poll.test.mjs` drives the browser half. **Sweep: 28 mutants, 28
killed, none unapplied, four comment-only controls survived** (every SQL
mutant applied to the migration AND the snapshot together, so the
byte-equality guard was neutral and a property had to catch it) — the
published branch never firing, the body stored as an object, the reply
saying ok false, the finalize asked as not-ok, a recovered job counted as
lost, the attempt never counted, the ceiling at five hundred, the park
unconditional or without its note, a parked row still attempted, exhausted
counted unparked, the batch never reading the counter, the answer without
the count, the column nullable, a refusal with no branch dropped, the grant
dropped; the check no longer requiring the count, not reading the balance,
losing its control, never reconciling; the Worker's log dropping the count,
gated on lost and review alone, the grace hardcoded; recovered without ok
read as a success, the sentence saying untouched, either reader never
asking, `editReply` answering Done. **The whole check script: ALL 92 CHECKS
PASSED, rolled back.** Full suite 5,157 green — three older guards went red
for the change and were re-anchored, not appeased: the drivers that evaluate
`editReply` and `addonReplyText` out of chat.js (`site-addon`, `site-apply`
×2) built the functions in a scope with no `EditPoll`, and now hand the real
poll module in, so the recovered branch is driven there too. **Not proven
live**: the deploy carrying the Worker and `public/` is the proof's
precondition; the database half is live and harmless on its own (the old
Worker reads `lost`, `review` and `refunded` off the sweep's answer and
ignores the rest). No live row has ever had the shape.

**A REFRESH MID-EDIT LOST SIGHT OF THE JOB, AND THE FIX HAD BEEN WRITTEN AND
LEFT UNWIRED (2026-09-05, stage 2b of the architecture plan, owner: *"ok
go"*; `public/` only — builds nothing, rolls nothing).** `resumeEditJob`
existed, `resumableJob` and the stored-reply poll existed, and no caller
reached them (recorded two entries up, deliberately): a customer who
refreshed while an edit ran came back to the project list with their
message on the thread and no reply ever, while the job ran on and charged as
normal. Wired now, in three hops. (1) **The record carries the ask.** Both
enqueue sites (`siteEdit`, `siteAddon`) remember `{ ask, op, layer, page }`
beside the job id — the customer's own words, which route filed the job, and
the coordinates a sideways hop re-posts with — bounded as STRINGS at the
write AND at the read (`ASK_MAX` 2000, the send box's own cap; `RESUME_OPS`;
`String(["look"])` is "look", the recorded coercion), one record per site,
an hour at most, never a body, a marker or an attachment (a logo is a
megabyte of base64, and its job is already filed). `resumableRecord` is the
reader; `resumableJob` still answers the id. A record from before the ask
was stored resumes with no ask and no fallback, and an escalate then reads
as `lost` — the sentence written for exactly that case while it had no
caller. (2) **The open workspace resumes its site's job before it is drawn**
(`resumeOpenSite`, from `renderSites`, so a card click after a refresh is
the trigger): the send path's own tail as `finish`, the revise on the stored
ask as the fallback (`reactSend(…, 'revise', …)`, without the attachments),
the reader the route that filed the job uses (`addonAnswer` for an addon
record), and busy plus the step rows set ONLY once a watch really started —
a site with nothing to resume must not be stuck busy. (3) **One watch per
job per page** (`editWatched`): the resume runs on every render the
workspace gets (every reply triggers one), and the exactly-once latch inside
a watch is per WATCH, so without the guard a job already being watched would
gain a second watcher and the reply would print twice. Taken at the top of
`watchEditJob`, released on the three ends (gone, reply, ended) and NOT on
gave-up, so a render cannot start the next four hundred attempts on a job
the page has already given up on — the sentence says to reload, and a
reload is what resumes it. Two older guards went red for the change and
were re-anchored, not appeased: the addon-queue pin on the remember call's
spelling (it carries the ask and the route now) and its count of
`addonAnswer` mentions (four: the resumed watch's reader is the fourth).
`test/edit-poll.test.mjs` drives the record (bounded at the write and at
the read, a planted hostile record, the hour, the old shape) and reads the
wiring (the hook, the latch and its three releases, the ask-and-fallback
pair, the reader, busy after the start). **Sweep: 22 mutants, 22 killed,
none unapplied, three comment-only controls survived** — the ask stored
unbounded or blank, an unknown route stored, a non-string layer coerced at
the write, the read trusting a non-string ask or page, an unknown route
read as an addon, the hour bound dropped, `resumableJob` answering nothing;
the resume never running, a second watcher on a watched job, an addon
record read with the edit tail, the fallback handed without the ask, busy
set before the watch started, a busy site resumed over its own edit, the
fallback a build instead of the revise, the latch never taken, released on
gave-up or not released on the reply, the edit route storing no ask, the
addon route storing its job as an edit, the resumed reply not re-drawing
the workspace. **The write-side bounds were only catchable once the guard
read the RAW store**: the read validates again, deliberately, so a writer
that stored junk passed every read while the record outgrew its cap in
storage — the "a guard proves the branch it drives" shape, met on the
first draft of this guard. Full suite 5,160 green — one older guard went
red for the change and was re-anchored, not appeased: `test/site-ask`'s
`routeBlock` closed on a comment hundreds of lines past `siteRoute`, so it
swallowed every function between (the recorded overlapping-window trap) and
read the resumed tail's message push as `siteRoute` pushing a third; it
closes on the next top-level declaration now. **Not proven live**: a
refresh during a lane run on fretwork-1 with the reply appearing after the
site is reopened is the proof — free, on the next push, which builds
nothing and rolls nothing.

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

**A REFUSED RESERVATION READ AS A FREE RUNG (2026-09-05, found by driving,
never live).** The state above made a second gap: a reserve the ledger
REFUSED — `insufficient`, or a transport failure — answered 0 from the funnel
exactly as a rung with no model call does, `reserves()` stayed at zero, the
spine exempted the job, the gate granted `exempt`, and the work shipped for
nothing; a later reserve refused after an earlier one landed shipped with the
later work unpaid. Nothing logged it: `editRpc` logs only transport failures
and the funnel returned 0 silently. Driven against the real consumer under
fakes: refused #1 → `edit_exempt` → published, cost 0; #2 refused after #1
landed → published, the translation unpaid. Reachable at any balance below a
bill, which the owner's own account (5 credits against a 12–21-credit addon)
was. **FIXED 2026-09-05 (stage 1a-i of the architecture plan, owner: *"ok
start"*):** the job context counts refusals apart from reserves (`refused()`,
`refusals()`, `noteRefusal`), both funnels record the ledger's own reason on
any answer but ok and still return 0, and the spine asks `unbilled()` THREE
times — before the translations, after the translation charge and before the
compile, and before the free-rung step and the gate — answering `error:
"unbilled"` (`ours` false for `insufficient`, true for a dead ledger) so
nothing is compiled or written; the consumer's own refund returns whatever did
land, and `compileMsg` names the reason BEFORE its `ours` test ("there aren't
enough credits for it, so it wasn't published and nothing was charged" —
"wasn't published", not "nothing was changed", because a rung that writes rows
before it reserves has already written them). A job that reserved NOTHING is
still exempted as before: the two zeros are different zeros now.
`test/edit-reserve-refused.test.mjs` DRIVES the consumer through
`worker.queue` for five cases (first refused, later refused, a dead ledger, a
duplicate delivery's `repeat` answer counting as landed, a page removal still
exempted) and reads the funnels, the context, the three asks and the sentence
out of the source. **Sweep: 12 mutants, 12 killed, none unapplied, the
comment-only control survived.** Not proven live; the proof is free — an
addon ask on fretwork-1 at a balance below its bill now answers the credits
sentence with the build unmoved.
**THE REST OF STAGE 1a SHIPPED THE SAME DAY (1a-ii/iii, owner: *"o k"*): THE
RESERVE PRECEDES THE FIRST WRITE, AND THE SYNCHRONOUS PATH COUNTS ITS
REFUSALS.** The `data` and `rules` rungs and the pageless addon placed their
reserve AFTER the write, so a refusal there stopped the publish and left the
rows or the DDL made. Now `runDataEdit` and `runRulesEdit` take a
`before(usage)` hook, asked once the model has answered and BEFORE the first
statement: the route's hook charges through `eCharge` and answers whether the
ledger refused (`eCharges.refused()`); a no, or a hook that throws, answers
`reason: "unbilled"` with nothing applied, and the route returns
`unbilledReply` (402 for `insufficient`, 503 for a dead ledger, the same two
sentences, cost 0). The rungs' success replies read the cost the hook already
took (`dBilled` / `rBilled`), so nothing bills twice. The addon route places
sequence #1 — the picker's, the designers' and the seed's usage — BEFORE
`applySiteSchema` under a job and stops on a refusal before any DDL; the page
call is then sequence #4 for its own usage alone (the bill no longer re-counts
the design), and the pageless path answers the number #1 took. The synchronous
path: `eCharge` records `insufficient` when `collectCredits` took nothing of a
positive bill and `rpc` when it threw; `eCharges` reads the job's count under
a job and the sync ledger otherwise; the spine takes `charges` as its
accounting view (`acct = charges || job`); and a refused final publish on the
sync path refunds what was taken (`syncLedger.taken`) and answers `error:
"unbilled"` instead of wearing `compile`. What it does NOT reverse, said
rather than hidden: a reorder that reserved and then could not publish leaves
the rows saved and the sentence opens "Your rows are saved." Guards:
`test/edit-reserve-refused.test.mjs` DRIVES the synchronous route through
`worker.fetch` against a stubbed ledger (refused → 402 and the credits
sentence with no compile; a dead ledger → 503; healthy → published, one
compile, cost ≥ 1) and reads the two rungs' `before` wiring, the addon's #1
between the seed and the apply, the #4, the stop before the look store, the
sync ledger and the refund; `test/site-apply.test.mjs` and
`test/site-rules.test.mjs` drive the hook (a refusal applies nothing, a throw
is a refusal, yes or absent applies, not asked when nothing matched).
**A backend addon under a job pays two roundings now** — #1 prices the design
and the seed before the DDL, when the page call's cost cannot be known, and
#4 the page call alone; a synchronous addon, and any addon that designed no
backend tier, still pays one variadic bill (`test/api-auth.test.mjs` asserts
the gate by brace depth). The trade the translation charge made on run 39,
for the same reason. Ten older guards went red for the change and were
re-anchored, not appeased — each pinned to a spelling
(`collectCredits(eAuth, pageCredits(...parts))`, `aCost = await
aCharge(aBill)`, the addon's reserve and bill landmarks, the pageless charge
sitting AFTER the apply, the data refusal's `cost: await eCharge(dOut.usage)`,
the wall's page-bill landmark, `const aBill = pageCredits(`, the spine's
`charge = null }` as its LAST parameter, the deferred publish's object ending
at `charge`, and a 900-byte window on the addon's publish call that the
`charges` line outran — the recorded byte-window trap, walked by brace depth
now), each naming which spelling moved and why — and THREE driven fixtures
(`test/edit-path.test.mjs`, `test/edit-nobackend.test.mjs`,
`test/site-public-url.test.mjs`) answered `use_credits` with a catch-all 503,
which the new rule rightly reads as a dead ledger, so each answers the ledger
healthily unless a case says otherwise. **Sweep: 20 mutants, 20 killed, none
unapplied, two comment-only controls survived** — one mutant's anchor named
the wrong comment on the first pass (NOT APPLIED, the recorded trap) and was
re-anchored and re-run to a kill. The addon's own funnel is still guarded by
a source read, not a drive: no driven addon route harness exists.

**A `const` CALLED ABOVE ITS OWN LINE PASSES THE PARSE CHECK AND EVERY TEXT
GUARD (2026-09-05, stage 1a-ii).** The addon route's first reserve was written
above the backend block and called `aCharge` — a `const` closure declared
BELOW that block, in the same scope. `node --input-type=module --check` passed
(the temporal dead zone is a runtime error, not a parse error), every source
guard found its landmarks, and a backend addon under a job would have thrown
`ReferenceError` on its first reserve, after the designers had run and before
anything was charged. Found only because the new guard asserted the ORDER of
landmarks — the closure above the reserve, the reserve above the apply — and
could not find the closure where the reserve needed it. The closure and its
reader moved above the block, with a pointer comment left where they were.
**When a call is moved earlier in a function, check what it calls is declared
earlier still**; a text read certifies the layer below the break, and the
honest check is a drive, which the addon route still lacks.

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

**A BLANKER ERASES THE LANDMARK THE GUARD NEEDS (2026-09-05, found by stage 3b,
the mirror of "prose contains the thing it forbids").** The check script's
section headers are `--` comment lines, and the section-22 guard looked for
"22. A RECONCILE STORES…" in the BLANKED text, where every comment is spaces:
"section 22 is missing" for a section that was there. Blanking is for scans
that FORBID a spelling; a scan that REQUIRES one finds its boundaries on the
raw text and blanks only the body between them. The same guard had a second
false alarm of its own the same hour: the owner lookup memoizes per slug for
five minutes, so a "stranger's site" case that reused the owner's slug read the
owner. A memoized reader in a driven test needs its own key per case.

**A STAMP WRITTEN AFTER THE RUN IS A CHANGE THE SUITE HAS NOT SEEN (2026-09-05,
found by stage 3a).** `test/build-jobs.test.mjs` #11 pinned the check script's
header to `(stage 2c): ALL 113 CHECKS PASSED`. Stage 6 ran its suite — 5,217
green — THEN restamped the header to 137, exactly as the rule at the top says
to (a number only after its run), and pushed. Nothing that READS the stamp was
re-run; the `unit tests` run on that push was red, and nobody read it (the
entry two below, again). The stamping rule and the re-run rule pull opposite
ways, and the honest order is: run, stamp, then **re-run whatever reads the
stamp** — a guard, a workflow, a doc test — before the push. The guard reads the
stage-2c line by its own name now, since the header keeps every stamp as its
own line; a guard on the NEWEST stamp is a guard that goes red on every stage.
The count is the same shape one layer over: stage 2c added two checks to the
container harness and left the `site build` line at stage 7's 349, so the next
run to read it (3a's) answered 355 for a change that added four. **A count
nobody re-measured is a claim ahead of its evidence, the same as a number
stamped early.**
**AND A NUMBER STAMPED IN TWO PLACES DRIFTS WHEN ONLY ONE IS CORRECTED
(2026-09-06, stage 9).** Its sweep and suite numbers were written into the
commit message, `docs/owner-notes.md`, this file's own stage section AND the
`site build` / unit-suite line under Live state — four copies — and the
correction after the real run reached three of them, leaving the stage
section claiming 24 mutants and a suite of 5,353 beside a Live-state line
saying 5,354. Nothing failed: no guard reads these, which is exactly why the
drift is silent. **"Two lists of the same thing" applies to measurements as
much as to code** — so when a number is corrected, grep for every copy of the
OLD value before believing the correction landed, and re-read the file after.

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

**`node --check worker.js` PASSES A FILE THAT DOES NOT PARSE (2026-09-04, the
seam).** The add step's round landed in the addon route as `let aRepair`,
seventy lines below the import dedupe's `const aRepair` in the SAME block.
`node --check worker.js` exited 0. The seven guard files and the 34-mutant
sweep were green, because every one of them reads the Worker as TEXT; the
full suite caught it only because five tests in `edit-path` and `gen-probe`
evaluate the Worker as a module and got `Identifier 'aRepair' has already
been declared`. Measured on Node 22.22: this package declares no `"type"`,
so `--check` on a `.js` does not parse it as a module — with detection off
it fails on the first `import`, with `--experimental-default-type=module` it
refuses the duplicate, and by default it says nothing. **The honest parse is
flag-free: `node --input-type=module --check < worker.js`**, and
`test/spine-repair.test.mjs` runs exactly that, so a sweep set that reads the
Worker as text carries one check that compiles it. The recorded "a chain
test that read the modules instead of running them", one layer down: a text
read certifies at the layer below the break, and a name already taken in
the scope is invisible to it. The round is `aRepairRound` now.

**A LISTING THAT ANSWERS ONE PAGE (2026-09-04, deploys 2017 and 2018).** The
image skip asked `wrangler containers images list` whether a tag existed and
believed its "no": the listing is ONE fetch of `/v2/_catalog?tags=true`, never
paged, and the site image's repository was not in the page at all while the
deploy two steps later referenced it. Two deploys rebuilt both images off an
absence that was the instrument's, and the step printed nothing that could say
so — the diagnostic line came first, the fix second. The recorded "a negative
assertion must prove its observer is alive", pointed at a registry: an absence
read off a list is only as good as the list is complete, so ask for the thing
BY NAME (a HEAD on the manifest) rather than for the list it should be in.
And when an instrument's answer decides a slow-versus-stale trade, make
"could not tell" its own answer and choose the slow side out loud.

**A REPORT CUT BY ITS BUDGET READ AS A VERDICT ON PAGES IT NEVER OPENED
(2026-09-04, runs 34 and 36).** The render check reported `/es` and `/fr`
throwing and said nothing about `/`, and three sessions read that as "the
English page is clean" — it had not been opened: the routes came in directory
order, the variants first, and the 25 s budget cut the run at eight routes,
with `cut: true` in the report and no reader of it. The recorded "a negative
assertion must prove its observer is alive", pointed at a list of pages: an
absence in a report is only as good as the report's coverage, and a report
that can stop early has to say what it did not reach before anybody reads
what it found. Fixed by opening `/` first and the primary pages before their
translations (the page every visitor sees, and the page the variants are
translations of), which is where a fixed budget buys the most; the diagnosis
itself — WHICH text differed — needed an instrument, because React's
production error is a number and a link, and the round that repairs on it
was being handed the number. When a check reports a code, make the check
say the thing the code stands for.

**A TEXT-ORDER GUARD SURVIVES A MOVE INTO A CLOSURE (2026-09-05, stage 8).**
Three guards asserted "the pageless answer comes AFTER the schema apply" as
`indexOf(apply) < indexOf(pageless)`, and every one of them stayed GREEN
when the apply moved into a closure declared above the pageless block and
RUN from inside it and from the seam hook two hundred lines below. The
text order they read had not changed; the run order had inverted for the
page path entirely. A position in the file is a claim about run order only
while the code between the two landmarks is straight-line — the moment one
side becomes a function, the guard is reading the layer below the break
(the recorded chain-test trap, in its cheapest form). Each now reads the
CALL inside the block it describes (`await aApplyBackend(null)` before the
charge), and the new guard counts the closure's call sites and where each
sits. **Two of the re-anchors then failed to LOAD**: a `const closure` and
a `const charge` collided with locals the same test already declared,
`node --test` reported the whole file as one `not ok`, and a glance at the
counts read as two failing cases. A re-anchor lands in a scope it did not
write; check the name is free.

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
