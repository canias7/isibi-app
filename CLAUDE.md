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
> **PRUNED AGAIN 2026-09-09 (owner's call: "clean up the md files, they are big"
> → "I mean to delete old stuff").** It had grown back to 10,004 lines and is
> **3,808 now — 6,210 deleted, and nothing rewritten**: whole entries cut
> out, not condensed: the chrome log (the start screen's cards, the code tab, the
> offline flag, the mobile column, fifteen entries), the build-progress and
> code-streaming entries, the job-runner stage records (stages 1a–9), the addon
> harness runs 21–37, the language-translation runs, the lane-sweep and gap-sweep
> logs, and the nested suite-count chains. **All of it is in git: `git show
> 7104c87b:CLAUDE.md`.** Every one of those entries described work that is
> shipped, merged and live, so what it said is now what the code does.
>
> **PRUNED AGAIN 2026-09-11 (owner: "do a claude md clean up").** It had grown
> back to 7,883 and is **3,933 now — 3,950 lines lighter**, and this time the ~40 dated
> change-log entries between "The published site" and "Editing a site" were
> COMPRESSED rather than only cut: every one described work that is shipped,
> merged and live, so the LAW in them (the flags and their defaults, the two
> bounds, the measured arithmetic, the rules from each fix) was folded into four
> standing sections — **The code explorer**, **The two splits**, **The
> instruments**, **Rules from recent fixes** — and the narrative of how each got
> there was cut. Five new traps went into THE TRAPS rather than staying as
> stories. **The full record is in git: `git show 5cfd4e58:CLAUDE.md`.**
>
> **Keep it this way.** Add an entry when a decision is made or a trap is found;
> when an entry becomes history rather than law, cut it. A fact that is true
> today belongs here. A story about how it got true belongs in git.
>
> **AND WHEN AN ENTRY IS COMPRESSED RATHER THAN CUT, KEEP THE NUMBERS.** A
> measurement is the one part of a shipped entry that stays law: the timings, the
> arithmetic that closed, the bounds and the flag defaults are what the next
> decision is made from, and re-deriving one costs a paid build.

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
- **A MERGE RUNS THE DEPLOY AND NOTHING ELSE (2026-09-09, owner: *"REMOVE ALL
  THOSE WORKFLOWS FROM THE MERGE THING, I JUST WANT THE MERGE THING THERE, THATS
  IT"*).** A push to main used to start twenty-three workflows; it starts one.
  Every other automatic trigger is **parked** — commented out in its own `on:`
  block under a note saying so — and every one of those workflows keeps
  `workflow_dispatch`, so nothing was deleted and nothing became unreachable:
  putting one back is uncommenting a block. `unit tests`, `site build` and
  `answer read` had no branch filter at all, so they take `branches-ignore:
  [main]` instead and still run on every FEATURE-branch push, which is where
  their answer is actionable and one push before the merge reads the same tree.
  **`test/merge-triggers.test.mjs` is a CENSUS**, not a list: it walks the
  directory and requires the answer to be exactly `deploy.yml`, so a workflow
  added next month with a copied `push: branches: [main]` fails by existing.
  **THE COST, STATED: nothing is checked automatically on main any more.** The
  five smokes, the three probes and the unit suite all ran on a merge and all
  ran for free; that safety net is now a button somebody has to press. Run what
  matters by hand before anything that matters.
- **The paid workflows were OPT-IN from 2026-08-30 and are DISPATCH-ONLY since
  2026-09-09** (owner: *"flip them, don't spend any"*, then the merge rule
  above). `build smoke`, `edit smoke`, `page gen eval` and `schema gen eval` used
  to run when the commit message contained **`[smoke]`**; no push starts any of
  them now, so the marker arms nothing and the wall is the trigger rather than
  the gate. **The gates are kept anyway**, because a parked trigger is meant to
  be restorable and restoring one without its gate is how the old default comes
  back by accident. A push with no marker cost nothing, which was the whole
  point: the older gate ran them unless you opted OUT, and in one session seven
  pushes went out without the marker and six bought a run — **five of those were
  merge commits**, whose message git writes itself and which can therefore never
  carry any marker at all.
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
workflows.
**AND SOME OF THOSE DO NOT DEPLOY AT ALL — `deploy.yml` carries a
`paths-ignore`** (`**.md`, `docs/**`, `LICENSE`, `test/**`, `scripts/**`), so a
push touching only those produces **NO RUN**, not a fast one. Proven on
`024005de` (CLAUDE.md + owner-notes, 2026-09-12): no deploy run exists for it,
by design. Look that up before hunting a missing deploy or blaming the API's
stale snapshot — a `public/`-only push DOES deploy, since `public/` is served.
**THE ROLL IS DECIDED BY THE WHOLE PUSH, NEVER BY ITS TIP COMMIT** — the trap
below has the instance and the two honest ways to ask. After any code push, wait **15–20 minutes** before firing
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
modules added), which is a layer input. The
step's line: `built isibi-app-sitebuildcontainer:e86…54e47 (registry
answered 404; 155 inputs off ./Dockerfile)`, then `EDIT` on the app.
**AND THAT MEASUREMENT IS TAKEN — deploy 2044 (2026-09-08 00:00Z, the dense-log
rail): the image step 2m05s, the whole deploy 3m01s.** The first push that
changed the worker tree (`worker.js`, `builder/gen-code.mjs`) and NOTHING above
it — not the Dockerfile, not `.dockerignore`, not `lovable/template/` — so the
apt and template layers were reused and it came in **under 2029's 2m20s**, as
predicted. The container rolled all the same (`EDIT`,
`5ca52dd70ee…fbe3` → `cbc80…2b96d`, applied 00:03:37Z; the game image `no
changes`), the drain found no live leases in 1 s, Wrangler 28 s, and the gate
was left to expire on success. **So the band for a worker-tree push is ~2m05s
of image and ~3m of deploy, and the 15–20 minute hold still applies** — the
hold is about the ROLL, which happens whatever the image step cost.
**AND THAT BAND IS NOT A PROPERTY OF WHAT CHANGED — CORRECTED 2026-09-08 by
deploy 2053.** That push touched `worker.js` and `builder/site-ask.mjs` and
nothing above them: 2044's shape exactly, so by the sentence above it should
have reused the apt and template layers and come in near 2m05s. It took
**2m56s and rebuilt every layer** — the log reads `#7 DONE 48.0s` for the
apt/Chromium install and `#10 DONE 9.4s` for the template's own `npm ci`, both
from nothing, with ~81 s more spent pushing the new layers. **Nothing is wrong
with the skip logic**: the registry answered 404 for the new tag, so a build was
correct. What is wrong is the inference. Layer reuse here depends on the GitHub
runner's LOCAL Docker cache, and a runner is ephemeral — there is no registry
cache import in this workflow — so a cold runner rebuilds everything whatever
the diff touched. **Treat 2m05s as the best case and ~3m as the ordinary one,
and never read a slow image step as evidence that something above the worker
tree changed.** **AND THE INFERENCE FAILS IN THE OTHER DIRECTION TOO — deploy
2091 (2026-09-12, the template's `package.json`/`package-lock.json` renamed).
That push changed the `npm ci` layer's own input, which is as far above the
worker tree as an input gets, and a commit message written before the run
predicted "at or above the ~3m band" on exactly that reasoning. Measured:
**image 2m27s, whole deploy 3m13s**, green. So a FAST image step is no more
evidence that the diff was small than a slow one is that it was large; the
runner's cache decides, and no inference from the diff to the band is available
either way. Whether to import a registry cache and make the band real is
open, and unmeasured either way.

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

`design_schema` is one tool, **93,598 characters**, in the cached block. Property
order IS generation order. **23 properties, 15 required**; a first build sends 22
of them (14 required, **64,076 characters**), and the system text is 1,962.
**RE-MEASURED 2026-09-10** by evaluating the tool through `readSchemaTool()` and
taking `JSON.stringify(...).length`: this line said 93,852 / 24 / 23 and the two
property counts were each one high — the order below has 23 names, which is what
the count has to match. **`components` alone is 32,603 of a first build's 64,076
— half of it** — because it carries the kit's component menu.

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
- **`favicon` / `wordmark` — ONE FIELD EACH, CARRYING A FORM (2026-09-07).** The
  tool is unchanged and still asks for a DRAWING (or, for the wordmark, the
  literal `text`), because that is a good thing to ask a model for and a form
  object is not; the merge normalises the answer on the way out. What each field
  STORES is `{form:"text"|"initials"} | {form:"svg", svg} | {form:"image", url}`,
  and the third is the picture the `logo` rung uploads — so a mark has one home,
  one door and no precedence ladder, and a new form simply replaces the one
  before it. `builder/site-mark.mjs` owns the shape, the compatibility fold for
  every site still on the old `config.logo`/`config.icon` pair, the ONE wire
  projection, and `markUrlOk`, which is the single copy of what may reach a
  generated `src`. A model must not outrank a person is `mergeLook`'s `asked`
  flag: an edit the customer named replaces, a design step's volunteered answer
  leaves an uploaded mark alone.
  `cleanFavicon` is still the drawing's validator — an allow-list that **refuses
  whole**: 18 elements, ~50 attributes, no `script`, no `href` of any kind,
  entities decoded before the danger checks. We own the document element, the
  model owns the shapes. And the two readers stay two: a favicon is forced
  square, a wordmark is sized from its own viewBox, because the header constrains
  by height.
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

## The code explorer

The Code tab shows the customer's whole project. **Four groups, by what a file
IS** — `Pages` · `Components` · `Made by the build` · `Shared with every site` —
and **inside each one, the real directory tree.**

- **A heading is a folder and so is every directory under it**: it folds, it
  carries a COUNT of everything beneath it, and one chevron turns. The count is
  what makes a folded folder honest rather than hidden — a bare heading over
  nothing reads as the thing being missing.
- **`null` IS A THIRD STATE, and it is the whole of the first draw.** The stored
  fold preference is `null` until the customer touches something, which is NOT an
  empty Set: uninitialised opens the CHAIN holding the file on screen and folds
  everything else; an empty Set is somebody who closed every folder, and
  re-deriving for them would re-open one on the next click for ever. The recorded
  "cannot-tell must never read as a value", pointed at a preference. The default
  is derived from the OPEN FILE, never a hardcoded `page` — a rebuild can find
  the preference null while the chosen file is a component.
- **A CHAIN OF ONE-CHILD DIRECTORIES IS ONE ROW** — `src/routes/-parts`, never
  `src` then `routes` then `-parts`. VS Code's compact folders, and it earns its
  place because our paths are deep and narrow: every page and component lives
  under `src/routes/`, so without it the Pages group is a ladder with one file at
  the bottom. **ONE COLLAPSE RULE, ASKED IN BOTH PLACES** — the renderer walks the
  tree and `stOpenGroups` walks it again to name the chain; two copies would drift
  into a folder drawn under a key the toggle cannot match, a row that does nothing
  when clicked.
- **THE DRAW IS NOT THE FETCH.** `loadSiteCode` asks the server and hands the
  answer to `drawSiteCode`; both click handlers redraw from the answer they close
  over. A fold is a preference, not a question for the server — routing it back
  through the fetch would buy eighteen files over the wire to hide four rows, and
  a blip would replace the whole panel with an apology.
- **DEPTH IS ONE NUMBER THE ROW CARRIES (`--d`)**, never a wrapper per level, and
  its rule must sit BELOW `.st-file`'s `padding` shorthand or it loses on source
  order and the tree draws flat.
- **A FILE'S ICON COMES FROM ITS OWN NAME, AND THE TREE IS A–Z (2026-09-12, owner
  holding Lovable's explorer beside ours: *"ok do that"*).** Every row asked
  `ic('code', 13)`, so a readme, a lock file and a stylesheet were the same
  chevron pair and the panel read as a LIST of strings; and `stDirTree` never
  sorted, so the root came out in the order the file list arrived in.
  **`stFileIcon` is the resolver and the ORDER OF ITS RULES IS THE WHOLE OF IT**:
  a lock file BY NAME first (`package-lock.json` is json, and braces there would
  be true and useless), then by extension, then a dotfile with no extension is
  configuration (`sliders`, because a cog needs eight teeth and they smudge into
  an asterisk at 13px — drawn both ways before choosing), then `code` as a
  fallback that is REACHED, since a blank icon column is worse than a slightly
  wrong glyph. The five new glyphs live in `ST_ICONS` so they inherit `ic()`'s
  stroke-only emitter, and **a guard derives the resolver's own answers and
  requires each to exist in that table** — `ic()` answers `ST_ICONS[name] || ''`,
  so a renamed glyph draws an EMPTY `<svg>` with nothing failing anywhere.
  **`stSortTree` sorts on LOWERCASE CODE POINTS, never `localeCompare`**, which
  commonly ignores leading punctuation and would scatter the dotfiles in among
  the letters; ties fall back to the raw name so the order is total. It sorts
  folders and files at every level, and folders still lead.
  **IT OVERRIDES A WRITTEN DECISION, deliberately**: `FOUNDATION_PATHS` says
  "Never alphabetical — `components.json` is not where anybody starts reading a
  project", which is right about READING a project and wrong for FINDING one file
  among twenty-five, which is what this panel is for. The list keeps its order (it
  is also the download's) and its comment now says the tree no longer inherits it.
  **Still different from theirs, and not done**: no search box, no per-row menu,
  and our four headings against their one flat root.
- **WHAT IS OUT, AND BOTH HALVES WERE DECIDED**: `src/components/**` (3,394 kit
  files, 9.5 MB — a dependency, and it would be in every isolate); the template's
  DEMO routes, because the image DELETES them (derived from the Dockerfile's own
  `find src/routes … -delete`); and `src/site-brand.ts`, whose template copy is a
  STUB the container overwrites per build.
- **THE SITE'S OWN FILE WINS A PATH THE SHARED SET ALSO CLAIMS** — today only
  `src/styles.css`. One path, one file: a tree showing it twice under two headings
  is a project nobody has, and the download collapses the two anyway.
- **AN UNNAMEABLE FILE IS SHOWN AS `unplaced/<n>.txt` WITH A NOTE, never dropped**
  (owner: *"don't silently omit files"*).
- **`builder/foundation-files.mjs` IS THE SHARED SET — 25 files, 489,115 bytes,
  GENERATED** by `builder/gen-foundation.mjs`, because the Worker has no
  filesystem and the template lives in the image. It is a COPY and a copy drifts,
  so the guard re-runs the generator and compares.
- **THE PROJECT ROOT IS SHOWN WHOLE — all twelve files (2026-09-12, owner,
  holding up Lovable's explorer beside ours: *"i [want] it to show it too"*).**
  It listed the four the BUILD reads (`package.json`, `tsconfig.json`,
  `vite.config.ts`, `components.json`) and left eight out, so a customer saw the
  part of their project our pipeline happens to consume. **Every one of the
  twelve was already in the template and already tracked** — nothing was
  generated and nothing new is stored; only the list moved. The eight:
  `README.md`, `AGENTS.md`, `eslint.config.js`, `.prettierrc`,
  `.prettierignore`, `tsconfig.kit.json`, `.gitignore` and the lock file.
  **The lock file is the one that makes the download a PROJECT**: without it an
  install resolves to whatever is newest rather than what the site was built
  against. **Its cost, measured before it went in** — 310,981 bytes raw against
  the other eleven's ~24,000, and the Worker hands the whole set to the browser
  on every Code-tab open — but **gzipped the payload went 60,781 → 126,616**,
  about 66 KB more per open, and that is what travels. The raw bound stays at
  600,000 with ~110,000 left, so the next file added here is a decision.
  **A CENSUS DERIVED FROM GIT is what stops this recurring**: every tracked file
  at the template root must be in `FOUNDATION_PATHS`, both the list and the
  ignore rules coming from git, so a root file added next month fails by
  existing and a generated one can never enter.
- **AND SHOWING THE ROOT PUT `package.json` IN FRONT OF EVERY CUSTOMER, where it
  read `"name": "isibi-lovable-clone"`** — the pre-2026-08-30 brand, and a name
  that called the product a clone of a competitor. Nothing about the change
  caused it; the change is what made it visible. **Renamed to `gofarther-site`
  the same day** (owner: *"change the name and merge"*), and **the lock file is
  half the change, not a ripple**: `npm ci` refuses a lock whose name disagrees
  with `package.json`, and the name is in the lock TWICE — the root `name` and
  `packages[""].name` — so all three move together or the container's own
  `npm ci` (Dockerfile, the line above the template COPY) fails at image build.
  Proven locally, not asserted: `npm ci --dry-run --offline` over the renamed
  pair resolved the whole tree and exited 0, which it cannot do past a name
  mismatch. The bundle went 489,115 → 489,100 bytes, which is the arithmetic of
  the rename (5 characters shorter, three times) and nothing else.
  **Two more the same scan found and did NOT touch, both still there**:
  `AGENTS.md` opens "This project was generated by isibi" — one line, one word,
  the owner's whenever they want it — and `src/lib/error-reporting.ts` posts
  `isibi:runtime-error` to a listener that **exists nowhere in this codebase**,
  a live-looking contract with nothing at the other end, inherited from the
  template's origin. Neither is a name a build reads, so neither can break one.
  **NOTHING ASSERTED THE THREE AGREED UNTIL THIS RENAME**, because until it they
  agreed by never having been touched — a habit, not a property, and the edit is
  what ended it. `test/template-deps.test.mjs` derives the name from
  `package.json` and asks the lock's two, with both observers proved alive
  first and the npm name rule DRIVEN over six shapes it must refuse and four it
  must take (one real value cannot prove a regex, and there is no second
  manifest to rename). **Sweep: 7 mutants, 7 killed, none survived, none
  unapplied, the comment-only control survived** — the lock forgotten whole,
  either of its two names missed, the manifest forgotten instead, a nameless
  manifest, a lock with no root entry, and a name npm refuses.
  **AND THE REDUNDANCY WAS MEASURED RATHER THAN ASSUMED, both ways.** All seven
  die under `test/foundation-files.test.mjs` ALONE as well, because both files
  are bundled and any wrong name makes the committed copy stale — which reads
  exactly like one of the two walls being pointless. It is not, and the case
  that separates them was measured by hand: a partial rename WITH the bundle
  regenerated leaves the staleness guard satisfied (7 pass, 0 fail) and the new
  one the only thing that fails (3 pass, 1 fail). That is the likely mistake,
  not the unlikely one. Said in the test too, because a sweep cannot say it and
  the next session deletes what nothing appears to need.
- **A SEARCH BOX, AND IT SEARCHES THE CODE (2026-09-12, owner holding Lovable's
  "Search code" beside ours: *"add the search box too"*).** At the top of the
  tree column, matching a file's PATH **or its CONTENTS** — the whole project is
  already in the browser (`stSrcFiles` hands the tab every file and the Download
  zips the same list), so searching the text costs no request and no server
  work, and a box labelled "Search code" that filtered filenames alone would be
  this app's dead-control finding wearing a new coat. **Measured: ~1.15 ms per
  keystroke** over the 25 shared files (489,130 bytes) on every query shape,
  a one-letter one included; the tree redraw around it is the larger cost.
  - **A ROW SAYS WHY IT IS THERE.** A contents match carries the number of times
    the words appear, in the folder count's own column; a name-only match carries
    nothing, so a numberless row means it matched the name you can already read.
    Counting stops just above `ST_FIND_MAX` (99) and the label is
    `ST_FIND_MAX + '+'`, never a second literal — a DISPLAY bound that cannot
    change the answer, since one hit is enough to be in the list.
  - **THE KEYSTROKE REDRAWS THE TREE AND NOTHING ELSE.** `drawSiteCode` replaces
    the whole panel's HTML, so routing a filter through it destroys the input
    mid-word (focus and caret gone after one character) and rebuilds the `<pre>`
    beside it, scrolling the file being read back to its first line. `paintTree`
    is the ONE place that builds the rows and binds them — called on the first
    paint and on every keystroke — and the field, the count line and the clear
    button are written once, with only their text and one class changing. The
    file's own "THE DRAW IS NOT THE FETCH" argument, one layer in.
  - **A FILTERED TREE IS DRAWN OPEN AND STORES NOTHING.** `ST_ALL_OPEN`
    (`{has: () => true}`) rather than a Set walked out of the filtered tree,
    which would be a second copy of `stCollapse`'s rule; `siteCodeOpenGroups` is
    untouched, so clearing the box puts the tree back as the customer left it —
    and a fold clicked DURING a search materialises its default from the whole
    project, never from the results.
  - **THE OPEN FILE IS CHOSEN FROM THE WHOLE PROJECT, NEVER FROM THE RESULTS.**
    Typing must not swap out what is being read; picked from the results, a query
    excluding it falls to `files[0]` and the customer's file does not come back
    when the box is cleared. Only a FULL draw recomputes it, so the shape that
    shows the wrong reading is a reload or a fold click with a query already up.
  - **TWO SENTENCES, because a filtered tree that looks unfiltered is a lying
    instrument.** `stFindSaid` ("5 of 28 files") is empty and `display: none`
    when nothing is filtered, so the line APPEARING is the sign; `stFindNone`
    ("No file matches “kayak”.") is never a blank column. They split on escaping
    and it is stated in both: the count goes into `textContent` and must not be
    escaped, the sentence into `innerHTML` and must be.
  - The query survives a project switch deliberately — `siteCodeOpen` already
    does, and a carried-over query is VISIBLE where a carried-over filename is not.
  - **AND IT SHIPPED A WIDTH REGRESSION THE SAME NIGHT, FOUND LIVE BY THE OWNER
    (*"everytime i click it the screen vibrates"*).** Splitting the column into a
    fixed head over a scroller moved `overflow-y: auto` off `.st-code-tree` — and
    **any overflow but `visible` makes a flex item's automatic minimum size ZERO**,
    which is what had actually been pinning the column at its `flex: 0 0 210px`.
    With `overflow: visible` restored, `min-width: auto` took over and the column
    refused to shrink below its widest row: opening a folder with a long label
    (`src/routes/-parts`) widened it and shutting it narrowed it again, so **every
    fold click moved the editor beside it sideways.** `min-width: 0` is the one
    declaration that says out loud what the overflow used to say by accident.
    **MEASURED in a real browser over seven fold states**: 193px throughout before
    the search box, **209px or 224px** after, constant again with the line.
    The recorded "a rule true because of a layer below it expires when that layer
    moves" — the width was true BECAUSE of the overflow, not because of the basis,
    and nothing said so because nobody had written it down. **No markup assertion
    can see this and neither can one that checks the rule exists**: it takes a
    render, which is how it was found and how it was proved. Sweep 3/3 with the
    defect itself as a mutant, the comment-only control surviving.
  **Guards**: `test/site-source.test.mjs` drives the filter, the tree, the rows,
  the three renderers and the tab end to end, plus the CSS both ways.
  **Sweep: 39 mutants, 39 killed, none survived, none unapplied, both
  comment-only controls survived — three survived the first pass and every one
  was a guard gap, not the product's**: the open file picked from the results
  (the keystroke path never recomputes it, so only a full draw with a query up
  can see it), the fold default derived from the filtered list (visible only on
  the FIRST click, when there is no stored choice to honour), and a glyph a
  CALLER asks for by literal — `ic('x', 12)` in the search box — dropped from
  `ST_ICONS`, which the derived icon guard could not see because it reads
  `stFileIcon`'s RETURNS. That guard now also derives every `ic('<name>'` in the
  file and asks the table for it: **18 names asked for, 0 missing**, measured
  before it shipped. One mutant never applied: its anchor spelled `“` where
  the source carries the character itself.
- **A MENU ON EVERY FILE ROW, AND THE "READ ONLY" PILL IS GONE (2026-09-12,
  owner: *"add the ... menu on each row"* / *"delete the thing that says read
  only"*).** The last item from Lovable's explorer, and the pill this panel had
  carried since the Code tab became real.
  - **THREE ENTRIES, BECAUSE THE PANEL DOES NOT WRITE** — `Copy path`,
    `Copy contents`, `Download` (`ST_ROW_ACTS`, and the menu is DERIVED from it).
    Rename, delete and new-file are what an editor's row menu holds and each
    would be a control promising what the Code tab cannot do; the customer
    changes their site by asking in the chat. `Download` repeats the bar's button
    deliberately: the bar downloads the file that is OPEN, this one the row you
    are pointing at, without opening it.
  - **THE HANDLE IS ON FILES AND ON NO FOLDER.** Every entry acts on one file's
    BYTES — its path, its contents, its download — and a folder has none, so a
    handle there opens a menu with nothing in it that works. A menu is the
    easiest place in the app to hide a dead control.
  - **THE ROW IS A WRAPPER AROUND TWO BUTTONS, and that is forced, not tidiness.**
    A `<button>` inside a `<button>` is invalid and browsers recover by HOISTING
    the inner one out — the handle would land beside the row on its own line,
    firing the wrong handler. `--d` stays on the FILE button: moved up to the
    wrapper it indents the handle with the name and pushes it off a deep row.
    The knock-on is silent and was caught by hand: `.st-file` stopped being a
    SIBLING of the next group heading, so `.st-file + .st-code-h` matched nothing
    and every group after the first ran into the files above it.
  - **ONE MENU FOR THE WHOLE TREE**, moved to whichever row asked. Twenty-eight
    rows would otherwise carry twenty-eight hidden menus and a second place for
    the open state to live. `position: fixed` off the handle's own rect (the
    210px column scrolls, so anything else is clipped by the one box it must
    escape), flipped up when there is no room below, and DISMISSED on that scroll
    rather than left pointing at a different file — `closeApInfo`'s own reasoning
    one panel over, and the failure here would be copying the wrong file.
  - **`stRowMenuAct` TAKES ITS DEPS**, so what each entry reads is drivable
    without a clipboard or a disk. Copy path copies the FULL path (it is what you
    paste into an import); copy contents copies the WHOLE file, never the pane's
    120,000-character clip; download saves under the BASENAME. A file it cannot
    find does nothing and says nothing, and an empty one is said rather than
    "copied".
  - **THE PILL WENT AND THE BEHAVIOUR DID NOT.** The panel is still read-only —
    the guard asserts the `<pre>` and the absence of any editor beside the
    absence of the label, because an absence check over a bar that stopped being
    drawn would pass by accident.
  **THE RENDER CAUGHT A DEFECT NO GUARD WOULD HAVE**: the menu painted with
  `var(--panel)`, which is `rgba(51,49,61,0.055)` — a surface on the media side's
  dark chrome and 5.5% ink on this cream paper, so the tree rows read straight
  through it and both sets of words fought. `var(--bg)` and a heavier shadow.
  That is the screenshot rule earning its place: it is the only instrument that
  sees it, and it saw it before the merge.
  **Sweep: 24 mutants, 24 killed, none survived, none unapplied, both
  comment-only controls survived — three survived the first pass and every one
  was a guard gap**: the handle announced as the whole PATH (nothing read the
  label's contents, so a screen reader got the folder chain on every row), the
  opacity above, and — for the second time in one night — a SUBSTRING observer:
  `assert.ok(html.includes("st-code-bar"))` is satisfied by `st-code-bar2`, so
  the check meant to prove the bar was still there passed over a panel that had
  lost it. Both instances are in this file's markup now: assert `class="x"` with
  its quote, never the bare name.
- **A CLICK REPAINTS A COLUMN, NEVER THE PANEL (2026-09-12, owner: *"screen
  vibrates everytime i click on one of them"* — the SECOND report, on a panel
  whose first vibration had been found and fixed the same night).** The width
  regression above is real and was only half of it: it fires on a FOLD, because
  it is about the column re-measuring. This one fires on **every click, a file
  click included**, and the cause is one element over.
  **`.st-code` CARRIES AN ENTRANCE ANIMATION** (`styles.css`, "builder
  Preview/Code/More/Data panels re-render on switch → animate each in"), and
  `drawSiteCode` rebuilt `.st-code` from scratch on every row and fold click — so
  a brand-new element entered the document and the entrance ran again.
  **MEASURED in a real browser, frame by frame: the whole panel drops 8.00px,
  fades to opacity 0 and slides back over 220 ms, on every press**; rewriting only
  the rows moves it **0.00px**, which is the control. `docs/edits/code-click-twitch.png`
  is the same frame, 60 ms after the same click, both ways.
  The animation was correct for as long as this panel was only ever built on a TAB
  SWITCH — the recorded "a rule true because of a layer below it expires when that
  layer moves", and nothing announced it when the Code tab started rebuilding
  itself.
  **`stCodeFileHtml` is the editor column's own renderer** and `paintFile` is the
  one place that calls it, beside `paintTree` for the rows; `drawSiteCode` writes
  an EMPTY shell and lets each fill its column, so neither is written twice. A row
  click is `paintFile(); paintTree();` — the tree TOO, because with no stored fold
  preference the open chain is derived from the file being read, so a click
  changes which folders stand open and moving one `on` class by hand would leave
  the tree describing the file before it. A fold click is `paintTree()` alone.
  `drawSiteCode` now has exactly one caller: `loadSiteCode`.
  **TWO OTHER DEFECTS CAME OUT WITH IT, both invisible while the panel was being
  rebuilt anyway**: the tree's scroll offset was lost on every click (`innerHTML`
  empties the box, which clamps `scrollTop` to 0 — so `paintTree` reads it before
  and restores it after, and the SEARCH BOX resets to 0 itself, because a new set
  of results is a new list), and folding a directory rebuilt the editor beside it,
  scrolling the file being read back to line 1. Clicking the file already open is
  refused for the same reason.
  **A STILL SCREENSHOT CANNOT SEE THIS CLASS AT ALL** — the defect exists for a
  fifth of a second — so "the render looks right" was never evidence. What sees it
  is sampling one element's rect across `requestAnimationFrame`.
  **Sweep: 18 mutants, 18 killed, 0 survived, 0 never applied, 2 comment-only
  controls survived.** Five survived the first pass: ONE WAS INERT and was proven
  so rather than hunted — it moved `const wasAt = rows.scrollTop` below the
  `stCodeFind` call, which does not touch `rows`, so the read was still before the
  wipe; replaced with one that moves it past the write. The other four were guard
  gaps, every one a branch nothing drove: clicking the file already open, a row
  naming a file the project has not got (which would reach `stCodeFileHtml(undefined)`
  and throw), the 120,000-character clip, and whether the source is escaped. The
  rest: either click rebuilding the panel, a click repainting one of the two, the
  bar keeping the old name, the Download button not rebound after its element was
  replaced, the shell writing the editor inline again, the scroll never restored.
  **AND THE NEW COMMENT BLOCK LANDED CARRYING `—` ESCAPES** where the file
  has 1,383 real em dashes against 21 pre-existing escapes — harmless inside a
  comment, wrong-looking in source, and it made a mutant's anchor unfindable.
  Mine were normalised; the 21 were left alone.
- **EVERY SCROLLING BOX IN THE PANEL RESERVES ITS SCROLLBAR'S LANE (2026-09-12,
  owner on WINDOWS: *"still vibrates"* — the THIRD report of one symptom on this
  panel in one night, and the third distinct cause).** Folding a group is exactly
  what changes the rows box's HEIGHT, so it is exactly what makes the scrollbar
  appear and disappear — MEASURED across the real fold states at a 760px panel:
  open PAGES and it scrolls, fold it and it fits, open `shared/src` and it
  scrolls again. **On Windows and Linux that bar is CLASSIC and takes ~17px out
  of the CONTENT box**, so in a 210px column every file name jumps 8% of the
  column sideways on every click. `scrollbar-gutter: stable` on `.st-code-rows`
  and `.st-code-scroll`; **`stable`, never `stable both-edges`**, which reserves
  a second lane the panel has no room for and which the guard pins by VALUE
  rather than by prefix (a sweep survivor: `/scrollbar-gutter: stable/` matches
  `stable both-edges` as a substring).
  **THE RENDER CANNOT PROVE THIS ONE, WHICH IS WHY IT TOOK THREE GOES.** Headless
  Chromium uses OVERLAY scrollbars, which take NO width, so the measurement reads
  0px whether the column is steady or jumping — it read "nothing moves" in
  precisely the case that moves, and `--disable-features=OverlayScrollbar` did
  not change it. The recorded "a negative assertion must prove its observer is
  alive", pointed at a browser: **a zero from a blind instrument is not evidence
  of absence.** So the SHEET is the assertion and it is DERIVED — every
  `.st-code-*` rule carrying `overflow: auto` must carry the gutter, found by
  walking the rules rather than naming today's two, with a floor on how many were
  found so the scan cannot go quiet.
  **THE THREE CAUSES, because the shape is the lesson**: (1) the column growing to
  its widest row, fold clicks only; (2) the panel replaying its entrance
  animation, every click; (3) this, every fold but only where scrollbars take
  width. Each was real, each was measured, and each explained only part of what
  the owner saw — **a fix for the right symptom is not a fix for the right
  cause**, and the honest tell was that the owner had to report it again.
  **What cracked it was one fact from the owner's side of the screen** — which OS
  — after two rounds of instruments that could not see past their own defaults.
  Sweep 4/4, control survived. **PROVEN LIVE the same night** — deploy 2098,
  the owner on Windows: *"it works now"*, after two fixes that were each real
  and each left the panel moving. The live stylesheet carries the gutter on
  both boxes (read back off `gofarther.dev/styles.css`), and GitHub's run
  listing was still answering `in_progress` with a frozen `updated_at` while
  it was working on the owner's screen — the recorded stale-snapshot trap,
  settled by asking the served file rather than the control plane.
- **THE PROJECT A CUSTOMER DOWNLOADS CAN BUILD — the kit files their pages
  import (2026-09-12, owner holding Lovable's tree beside ours: *"look at all of
  this, we dont have all of it"*).** The comparison found something worse than a
  parity gap. **The Code tab showed 28 files and the Download zipped the same
  28 — and `src/routes/__root.tsx`, ONE OF THOSE 28, imports
  `@/components/ui/sonner`.** The zip carried the importer and not the module,
  so `npm run build` on a downloaded project could not resolve its own first
  import. It was a folder of source, not a project.
  **IT IS THE CLOSURE, NOT THE KIT, AND THE MEASUREMENT IS THE WHOLE DESIGN.**
  The kit is 3,394 files and 17 MB (2,112 under `src/components/ui` alone), and
  the first plan was a name manifest plus lazy contents. Then it was measured:
  a SITE has the files its pages import transitively, and over **100 real
  generated sites from the corpus that is 9 to 53 files, 26,092 to 126,082
  bytes, with ZERO specifiers resolving to nothing** — the same order as the 25
  shared files already sent, and the same order as Lovable's whole
  `components/ui` (~50). So there is nothing to lazy-load, no R2 kit upload and
  no per-file route: it travels with the source the way `parts` does.
  **`builder/kit-closure.mjs`** is the resolver — dependency-free, reader
  INJECTED because it runs in three places with nothing in common (the
  container's disk, a fake map, the corpus scan). Imports, re-exports and
  dynamic imports; **the extension order IS the resolver** (`.tsx` before the
  bare path, or a directory beats the file the bundler takes); cycles terminate
  on the RESOLVED path, because a kit that re-exports through barrels has them;
  a file the project already HAS is **walked but not re-sent** (`src/lib/utils.ts`
  is bundled and imports things of its own); an unresolved specifier is NAMED,
  never dropped; a stable sort, so two builds of an unchanged site store the
  same bytes; `MAX_KIT_FILES` 400 is a ceiling that REPORTS rather than
  truncating in silence — the worst real site needs 53.
  **THE CONTAINER RESOLVES IT** because it is the only place both halves exist
  at once: the Worker can work out WHICH files a site needs and not what is in
  them. Seeded from the routes DIRECTORY rather than the payload, so a salvage
  stub's or a repair round's imports count; its reader is fenced with
  `path.resolve` and a prefix test, because every specifier came out of source a
  MODEL wrote; a throw there cannot lose a built, paid-for site (`kitError`).
  **THE WORKER STORES IT at `source/<slug>/kit.json` ON BOTH PUBLISH PATHS** —
  the build path and the edit spine, so an edit that adds a component stores the
  dependency it pulled in — **subtracts what it already bundles, DERIVED from
  `FOUNDATION_FILES`** (a copy of that list in the image would be two lists of
  the same thing with a deploy between them), refuses an absolute or climbing
  path a second time, and answers it from `/api/site/source`.
  **ITS OWN HEADING, `Design system`, never folded into `Shared with every
  site`**: which of these a site has is a fact about THAT site, so two sites show
  different counts and one heading over both would be a lie about half its rows.
  **A site that has not published since this shipped gets `[]`** — the explorer
  shows exactly what it showed before, no error and nothing to explain, and it
  fills in on that site's next publish.
  **Sweep: 25 mutants, 25 killed, 0 survived, none unapplied, both comment-only
  controls survived. SIX survived the first pass and every one was a guard gap**
  — and THREE were the same recorded trap: **a positional guard cannot see a
  dead branch.** `if (false) await saveSiteKit(…)` leaves the call exactly where
  a count finds it, so the store read as wired while nothing was ever written;
  each call's OWN condition is read now. The other three: the container's fence
  and its directory seed were never asserted, and the subtraction was read
  (`foundationPaths()` is called either way) rather than DRIVEN — it is driven
  against the real bundle AND a second one now, which is the only thing that
  separates derived from hardcoded. **The driven case then met the
  free-identifier trap through the door that entry describes**: `KIT_KEY` is a
  free name in a carried scope, so the store threw inside its own catch and
  answered `false`, which reads exactly like a refused write.
  **Two older guards went red and were re-anchored, not appeased**: the
  explorer's READ CENSUS gained a fourth read (the right place for that cost to
  have to be written down), and the state-copy guard required `saveSiteParts`
  and `writeHead` to be ADJACENT when the property is that the MARKER IS LAST —
  it derives every write in the copy and asserts each sits above the marker.
  **The two things the same comparison found and did NOT change**: their
  `src/assets` carries 7 photographs because their builder writes generated
  images into the project and ours is genuinely empty (every picture is a
  placeholder — fal balance is empty), and their root has `bun.lock` /
  `bunfig.toml` where ours has `package-lock.json`, which is a package manager
  and not a gap.
- **A SHARED FILE MUST BE ONE THE REPOSITORY HAS, and the guard asks GIT rather
  than the filesystem.** `src/routeTree.gen.ts` was in the list: TanStack
  regenerates it per build, the template's own `.gitignore` names it, and
  `fs.existsSync` passed on any machine that had ever built — baking THAT
  MACHINE'S copy into the committed module, so the explorer showed customers a
  file no checkout has, listing routes no site has. Found by a red CI run.
  `git ls-files` now, derived, so the next generated file cannot enter either.

**OPEN, named and not fixed: the `tweak` rung targets pages by ROUTE**, so a
layout tweak on a split site falls to the `page` rung (~1 → ~1–3 credits).
Degradation, not breakage; every other rung goes through `site-files.mjs`'s
adapter and is unaffected.

---

## The two splits

Both are live. The DESIGN call and the PAGE call each used to be one long
model call; each can now be several agents at once, behind per-account flags.

### The design step

Three shapes exist and the flags choose between them.

| shape | agents | how |
|---|---|---|
| one call | 1 | 22 properties in property order — the default for everyone |
| waves | 4 | `identity` · then `plan` ∥ `look` · then `detail` |
| graph | 16 | `builder/design-graph.mjs` — twelve start at once, longest chain three |

- **`DESIGN_SPLIT_CANARY` defaults to the building account** (uid
  `22175f41-6fbf-49d7-b039-a65078a0141c`); **`DESIGN_GRAPH_CANARY` defaults to
  `-`, which `readCanaryList` drops** — nobody, until the owner names a uid in a
  GitHub secret. Both `*_EVERYONE` flags are `off`, so every customer still gets
  the single call. **Both doors are asked and the GRAPH wins by a stated line**,
  because computing the waves only when the graph declined would leave the waves
  door unasked on a graph build, which from a stored row is indistinguishable
  from a waves door that is shut.
- **THE EDGES ARE THE TOOL'S STATED DEPENDENCIES, and most of what sounds like
  one is not.** Only seven of 22 fields carry a sequencing phrase in their own
  prose; four earn an edge (`css`←theme, `shape`←components, `wordmark`←identity,
  `behavior`←shape) and three were read again and dropped. `behavior`←`shape` is
  the one edge that is JUDGEMENT rather than the tool's — it had been relying on
  property order to carry a dependency it never wrote down.
- **A CYCLE HANGS, IT DOES NOT THROW**, which is why `graphOrder` exists: two
  promises awaiting each other sit there until the job's clock kills the build
  with everything charged and nothing to show. Kahn's algorithm answers `[]` for
  a cycle, a self-need, a dangling need, a duplicate or a nameless agent, and
  `[]` means "use the waves, or the one call".
- **A NEED IS SATISFIED WHEN ITS AGENT DID NOT FAIL, never when it ANSWERED.** A
  model that declines the tool and replies in prose is a FAILED call; a model
  that calls the tool and declares no field has ANSWERED, and that is correct for
  four of the eight optional fields.
- **`MAX_GRAPH_INFLIGHT` IS 8 AND IS NOT THE GRAPH'S WIDTH.** One answers how
  many sockets one process may hold, the other how many fields are independent.

### The page step

`builder/page-bands.mjs` cuts a page into its planned bands and
`builder/page-parts.mjs` turns each declared component into its own agent; the
container runs them as ONE job holding N calls.

- **`BAND_SPLIT_CANARY` defaults to the building account**, `BAND_SPLIT_EVERYONE`
  is `off`.
- **A BAND IS A COMPONENT, NEVER A JSX FRAGMENT** — state sits at page scope in
  real generated pages and which band wants `useState` cannot be known before it
  is written, so fragments would force every band to agree in advance about a
  hook above all of them. Each band becomes `src/routes/-parts/<name>.tsx`; the
  page keeps the route export and the `SiteChrome` composition.
- **A PART IS THE SAME KIND OF THING A BAND IS** — one file, one component, one
  agent — so bands and parts ride ONE list. **BANDS FIRST, PARTS AFTER**, because
  `bandsFromAnswers` pairs an answer to a band by its raw index.
- **A FAILED BAND OR PART IS STUBBED, NEVER DROPPED.** A missing band is a page
  short a section; a missing PART is `vite` refusing the build, because the page
  already imports it.
- **THE CACHED SYSTEM BLOCK IS `pageRulesFor`'s, BY IDENTITY** for bands and
  parts alike — a band obeys the same rules a page does, so a separate block
  would be a second copy of every one of them and a cold prefix per build.
- **A BAND IS TOLD ABOUT ITS NEIGHBOURS AND NEVER SHOWN THEM.** It has to know
  they exist or band 3 writes its own hero and every agent closes with a call to
  action; it cannot be shown their source, because they are being written at the
  same moment.
- **TWO BOUNDS, NOT ONE.** `MAX_MODEL_FANOUT` (8) is how many calls may be in the
  air; `MAX_FANOUT_REQS` (16) is how long a list one job may carry. Tied
  together, a plan of nine pieces could not be SENT and the whole page went out
  in ONE call. A long list QUEUES now — eight start, the rest take a permit as
  one frees — and **a list that fits takes no permit at all**, so every fan-out
  that shipped before behaves byte for byte as it did.
- **THE CALL'S CLOCK STARTS AFTER ITS PERMIT, never before it**, or `agentMs`
  grows with the QUEUE rather than the work and the overlap flatters itself.
- **`runFanout` IS SHARED**, because `Promise.all` rejects on the first failure —
  which here would throw away every agent that answered because one did not —
  and every entry carries its INDEX, the only thing tying an answer back to what
  it was asked of once they finish out of order.

### What the splits are worth, measured

**The design split's arithmetic is `min(plan, look)` and that is algebra off the
wave shape, not a measurement needing more runs.** Waves are 1-2-1, so `agentMs`
is `i + p + l + d` and `waveMs` is `i + max(p, l) + d`: the overlap is whichever
of the two finishes FIRST. Confirmed to the millisecond on
`ravenscroft-and-fyne` (overlap 78,560 = `planMs` exactly). The four earlier
overlaps (51,865 · 65,191 · 66,008 · 66,181) were each that build's own
`min(plan, look)`, so the spread was never noise.

**And a floor follows.** Three of the four agents run ALONE, so the waves cannot
go below `identity + plan + detail` = **183,852 ms** however fast `look` becomes.
To go under it the WAVES have to widen.

**The graph does widen them.** `sowerby-forge` read `graph: 16, waveMs 159,599,
agentMs 527,944` — below the whole prior range rather than inside it (single call
175,259 / 197,248; waves 185,607 / 190,859 / 237,686 / 237,763). **The arithmetic
closes twice**: the sixteen parts sum to `agentMs` exactly, and
`components 29,354 → shape 65,452 → behavior 64,793` = **159,599 = `waveMs`
exactly**, so that three-link chain IS the design step.

- **THE WALL IS `components → shape → behavior`**, with `theme → css` second at
  113,397 — 46,202 ms of slack behind it. So breaking the last link is worth
  about 46 s and no more, because `css` becomes the wall.
- **AND THE RECORD WAS WRONG ABOUT WHY `look` WAS SLOW.** It blamed the two
  drawings; split apart, `wordmark` + `favicon` are 83,426 together and `css`
  ALONE is 93,013. The stylesheet is the slow one — on a brief that asks for one;
  `css` omits itself otherwise (29,763 on `ben-crowe-guitar`).
- **THE FIELD COUNT DOES NOT PREDICT THE TIME**: `identity` answers 11 fields in
  21,906 ms, `look` 4 in 132,394. What costs time is the KIND of answer.

**The page split is a different shape and it wins where the design split does
not** — one wave, N wide, on a call several times longer, so the fixed per-call
cost is a much smaller slice.

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
  same nine-piece shape written in one call. The split saved 17,571 ms, because
  **the part is the wall**: all eight bands finished inside 147 s and the tide
  chart alone took 348 s. **A fan-out cannot beat its slowest piece**, so more
  sockets buy nothing on that shape — worth knowing before anybody reads
  `MAX_MODEL_FANOUT` as the lever.

**OPEN: Stage C, regrouping the graph from these times.** The lever is the
three-link chain; `behavior ← shape` is both the most valuable edge to question
and the least evidenced, being the one edge that is judgement rather than the
tool's own words.

---

## The instruments

Every one of these is free and reads off a stored row.

- **`design` step** — `waves`/`agents` (or `graph`), `agentMs` (every agent's own
  call time, summed) and `waveMs` (the wall). **`agentMs − waveMs` IS the
  overlap**, stored as the two numbers rather than the difference, since a
  derived value beside its inputs is two lists of the same thing. Plus a time per
  agent (`<name>Ms`), keyed by NAME.
- **`bands` step** — `bands`/`wrote`, `parts`/`wroteParts`, the same two
  timings, and a time per piece keyed by POSITION (`b1Ms` … `bNMs`, `p1Ms`).
  **Position, not name**, because `bandName` can reach 21 characters and `tr.at`
  cuts a key at 16: two bands agreeing far enough in would arrive as ONE key with
  the later overwriting the earlier — a wrong number wearing a right one's name,
  the only way this instrument can lie rather than go quiet.
- **`bands:<reason>`** — a split that does NOT happen says which of the walls
  stopped it (`revise`, `thin`, `door`, `nofanout`). The reason rides in the
  step's NAME because `tr.at` keeps finite numbers only and drops everything
  else; `budgetStage` reads the `bands:` prefix as it already reads `prov:` and
  `resume:`. **The order is the code's order, which is a limitation rather than a
  ranking** — a build reports the wall it actually met.
- **`genMs`** on the collector's `resume:finish` step — fire-to-collection, the
  only measurement available on BOTH the split and the single-call path. **It was
  worthless until the wake** (below): with the collector arriving on a timer it
  measured the TIMER, and it reads exactly as plausible.
- **`GET /api/site/runtime?slug=`** — owner-gated, booleans only: the effective
  `async`, `runner`, `design`, `graph`, `bands` and the switches behind them,
  plus the deploy sha. Never a value, never a canary LIST, and `readCanaryList`
  is deliberately NOT imported into `worker.js`. It exists because those flags
  are GitHub secrets with a workflow `|| fallback`: reading `deploy.yml` tells
  you the default, not the deployment.
- **`GET /api/site/build-health`** — which container image a COLD START gets. The
  deploy stamps the image id into the image itself (last line of the Dockerfile,
  from git objects at HEAD so it cannot move), `/health` answers
  `ok <templateId> <imageId>`, and an unstamped image says `unstamped` rather
  than guessing.

**THE FINISHED ANSWER WAKES ITS OWN COLLECTOR.** `/api/site/genresult` enqueues
the collector the moment it stores the answer, after the release and only for a
report whose binding was proved. Before that, ~253 seconds of every build were
spent idle against `RESUME_FIRST_SECONDS` — a constant whose own comment said
"nothing has ever come back inside four minutes", true when written and falsified
by the band split's 93,375 ms. **The belt stays at 240**, for a container that
dies after generating and before posting. Two messages per job is the ordinary
case now, and it is safe on walls that already existed.

---

## Rules from recent fixes

- **TYPING IN THE START BOX IS A FRESH BUILD, NEVER A REVISE** (owner: *"if i
  type in this chatbox its gotta be a fresh build no matter what, unless i select
  a site"*). A build claims its slug BEFORE it generates, so a failed build
  leaves the name held and its own retry came back as a revise of the
  placeholder. Three conditions, each a refusal to guess: the DESIGNER chose the
  name (a customer's own name is never moved), the chat is POSITIVELY known to
  own no site (`mine === null`, never truthiness — a blip must not buy a second
  paid site), and the name is held BY US (a stranger's keeps its 409). The
  trailing number is REPLACED, not stacked. Settled at the SLUG, above
  `env.JOB_SCOPE(slug)`, or the job is scoped to a name it is not building.
- **A FAILED BUILD REVERSES ITS DESIGN CHARGE.** `ourFault(stage)` had governed
  the PAGE bill and never the design's, whose deposit and settle are taken before
  the page call — so once a build had started nothing could reverse it, and the
  browser said "you weren't charged" off a literal. Both conditions: our fault
  AND no live site, since a salvaged build was delivered. The collector has no
  ledger, so it reverses BY REF (`REVERSE_WHOLE` is a CEILING, never an amount —
  the ledger stays the authority). `ok` is the only field separating "nothing to
  reverse" from "could not reverse".
- **RULE 7 NAMES `SafeImage`'s MODULE.** It orders `<SafeImage>` on every picture
  and never said where it comes from; every other kit component arrives through
  the ≤15 the design step named, so the one component the rules make MANDATORY is
  the one whose path may never arrive. A missing module is the one class `vite`
  cannot bundle around. `repairImports` also rewrites a `@/components/…` path
  that names no file to the one kit module exporting what is imported — 2,385 of
  2,412 exported names belong to exactly one module — and refuses to guess three
  ways. Zero false alarms over 3,736 real files.
- **ALL FIFTEEN REMOVABLE LANES CAN BE TAKEN OFF, not nine.** The removal verb
  lived inside `eLayer === "look"`, so six lanes that DISPATCH never reached it:
  nothing failed, the target rung did its best, and the STORED field kept saying
  the site had the thing. `DOOR_LAYERS` is derived from the two meanings that had
  been collapsed into one constant. **`page` is NOT widened and must never be** —
  `remove` there means delete the whole page.
- **THE PREVIEW PANEL RUNS THE SITE'S OWN JAVASCRIPT.** It framed a published
  site with no `allow-same-origin`, so nothing it loaded could run and the panel
  painted the server-rendered document and stopped. `frameSandbox(url)` decides
  per URL and FAILS CLOSED — our own origin keeps the tight flags, because
  `allow-scripts allow-same-origin` on a frame same-origin with the app can reach
  in and take its own sandbox off. The start screen's thumbnails stay tight
  deliberately: 51 sites is 51 React bundles to paint 51 postage stamps.
- **THE BUILDER PICKER REACHES THE ROUTING CALL** and sits on the START SCREEN
  too, which is where the first build is asked for. `siteRoute` had been posting
  without it, so every routing call on the platform ran on the default whatever
  the customer chose — and the whole point of the picker is that no single
  provider decides every message. The effort dial is PARKED: off the row, off
  both bodies, machinery kept with the three lines that restore it.
- **A PROJECT HAS AN ADDRESS** — `gofarther.dev/projects/<id>`, the id
  `siteCreate` already minted. Not the slug: a slug is renameable and does not
  exist until the build finishes, which is the eight-minute window where a stable
  address is worth most. `openProject(id, mode)` is the ONE way either screen
  opens, the boot reads the ADDRESS before the remembered view, and an id that
  names nothing corrects the address rather than lying.
- **A LIVE WIRE IS GREEN.** On a start-screen card the wire from the database to
  the thing it serves is `--wire-live: #00c853`; the app's wire is always false,
  written as a value rather than omitted so the day a mobile app owns a database
  it is a change somebody makes on purpose.
- **A PUBLISHED SITE'S RUNTIME ERRORS REACH THE PREVIEW PANEL (2026-09-12, owner:
  *"fix"*).** Every generated site carries `src/lib/error-reporting.ts`, which on
  any throw posts `{type:"isibi:runtime-error", report}` to `window.parent`. It
  was written for this panel and **the panel only ever read `__siteErr`**, so the
  message arrived at a listener that dropped it. **Which preview you are looking
  at is what decided it**: `errShim` — the reporter that DOES reach
  `collectPreviewErr` — is injected by `sitePreviewHtml`, which serves the blob
  DRAFT preview only, so a published site framed at its own URL has no shim and
  its own module is the only reporter it has. That is the ordinary case now: the
  throw reached the visitor's console and `/api/db/<slug>/error`, and the owner
  watching the preview saw a blank panel and no badge. `previewErrFromReport`
  adapts one to the other (`msg`, and `info` = route · source, because a boundary
  throw and a rejected promise need different fixes); `collectPreviewErr` already
  clips, de-duplicates and bounds at six. **The general shape: two halves built
  to meet and not wired, where the half that DID work covered the case anybody
  testing would look at.**
  **THE WIRE STRING STAYS `isibi:runtime-error`** — every site published before
  today bakes that literal into its frozen bundle, so renaming the sender means
  accepting both spellings for as long as any un-republished site exists. It is
  on the do-not-rename table now, and so is `isibi-marquee`, **which was found
  sitting beside `isibi-ambient` and `isibi-reveal` and NOT on it** — the same
  class of baked animation name, the hole that table exists to close.
  **AND THE BRAND SCAN'S EXEMPTION IS DERIVED FROM THAT TABLE**, not widened by
  hand: a file shipping a protected name is shipping DATA, exactly as chat.js
  ships `zephyr_session_v1`, so being on the table is what makes a name exempt.
  Its surfaces list now derives the template's prose from `FOUNDATION_PATHS`
  too — `README.md` was named by hand and `AGENTS.md` was not, which was fine
  while the Code tab showed four root files and stopped being fine the day it
  showed the root whole: `AGENTS.md` opened "This project was generated by
  isibi" in front of every customer with nothing asserting otherwise. Now
  "generated by [Go Farther](https://gofarther.dev)", and **proven red then
  green** by putting the old line back.

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
| `logo` | the header logo or tab icon — the attachment IS which picture, stored as that mark's `image` form | 0 |
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
`VERB_LANES`, `ESCALATE_LANES` and `UNBUILT_LANES`.
**FOR A FIELD'S LAYER, CALL `laneLayer(field)` — NEVER READ `LANE_LAYER`
(2026-09-08).** That map is keyed by GROUP (`plan` covers `purpose`,
`components` and `shape`; `rename` covers `slug`), so indexing it by a field
name answers `undefined` for three lanes that dispatch perfectly well, and
`undefined` reads as "this lane has no layer" — which is exactly how an
own-lane looks. This line used to name the map, and reading it that way is
what put the wrong split into two files and the wrong number into a section
heading, an hour after the census guard beside it derived the right one.
The map's only reader in the product IS `laneLayer`; it is exported for
sessions to print, and printing it is the trap.

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
**ONE MARK, SEVERAL FORMS — AND THE WALL THAT STOOD HERE FOR ONE MORNING IS
GONE (2026-09-07, owner: *"instead of it being 3 things or 4 or 5, its gotta be
one, wordmark, but it can be made in svg, etc etc etc"* → *"exactly yeah"*).**
The first answer to run 41 was a wall at the picker (`UPLOAD_SHADOWS`) refusing
such an ask for `cost: 0`. It was honest and it was a symptom: **three fields per
mark with the precedence between them a layer away.** `config.logo` (an uploaded
raster, the logo rung), `look.wordmark` (the word `text`, or a drawing) and the
name in type under both — and the identical split one field over for the tab
icon: `config.icon`, `look.favicon`, `initialsMark()`. Six storage locations, two
doors, three names for two slots.
**NOW ONE FIELD PER MARK, CARRYING A FORM** (`builder/site-mark.mjs`,
dependency-free apart from the two drawing readers, imported by the container):

    look.wordmark = {form:"text"} | {form:"svg", svg} | {form:"image", url}
    look.favicon  = {form:"initials"} | {form:"svg", svg} | {form:"image", url}

A new form REPLACES the one before it, so run 41's ask simply works: there is
nothing to shadow and nothing to refuse.
**PROVENANCE IS DERIVED, NEVER STORED.** *"A model must not outrank a person"*
(owner, 2026-08-28) survives as `ownedMark`, which reads the FORM: only a person
can produce `image` (the model cannot mint an upload URL) and only the model
produces `svg` (an uploaded SVG is refused — `/u/` serves inline from the site's
own origin, so one would be stored XSS). A stored `set: "owner"` field would be a
second value that can disagree with the first, the trap `dir` is derived to avoid
one module over — said in the module, with the note that admitting an uploaded
SVG is what would make provenance a real field.
**AND THAT RULE NOW LIVES IN `mergeLook`, UNDER A NEW `asked` FLAG.** A DESIGN
STEP answers every field whether or not anybody mentioned it, so a rebuild leaves
an uploaded mark alone — run 16 is that case and only the baker's precedence
saved it. An EDIT LANE runs only for the fields the customer named, so its answer
always replaces. **The flag DEFAULTS TO PROTECT**, because of which way being
wrong hurts: wrong toward "keep the person's file" costs an edit that does not
take effect and can be said again; wrong toward "replace" silently deletes
artwork somebody uploaded.
**NOTHING MOVES.** `markOf` folds a site still carrying the old pair — every live
site today — with the old precedence exactly, and the merge normalises to a form
on the way out, so the new shape is written the first time anybody touches a mark
and every published site's frozen `server.js` bakes the same string it bakes now.
The `qrList` rule. `markRemove` is what a removal leaves behind: the drawing the
upload was hiding on a legacy site, the floor on a site already on the new shape,
and the reply names which (`markWords`) instead of promising the floor.
**THE WIRE IS UNCHANGED AND `markWire` IS THE ONE PROJECTION.** The container's
baker re-validates whatever it is handed (hand-written payloads, version skew) so
it keeps its own ladder as a belt — and the Worker sends exactly ONE half of each
pair now, so that ladder can never fire, which the guard pins rather than leaving
a dead precedence to rot. Every one of those four fields has been the site of a
"read here and never put on the wire" bug; one reader for all four is what stops
the next path forgetting one.
**AND ONE COPY OF THE URL RULE.** The regex pair deciding what may reach a
customer's generated `src` was written out TWICE — inline in `writeSiteBrand` and
again in `siteIconFrom` — for one refusal about `javascript:` URLs, the recorded
"two lists of the same thing" with the worst possible subject. `markUrlOk` owns
it, both import it, and the guard DRIVES it against ten shapes it must refuse and
two it must admit instead of matching a fragment of a regex in a file.
**FOUR DEFECTS THE SUITE CAUGHT THAT A READ WOULD NOT HAVE, all in the new
code.** (1) The fold INVERTED the precedence it promised to keep — `readMark`
parsed the legacy drawn string before the upload was consulted — so fretwork-1's
next publish would have taken the owner's own logo off; found by driving it with
that site's real stored shape. (2) The logo rung patched `{ look: { wordmark } }`
and `withConfig` replaces a named field WHOLE, which would have taken the theme,
the brand, the description and every language off the site; it reads and merges
now, and REFUSES rather than writing when the read fails. (3) `lookWithMarks`
turned an absent look into `{}` and the edit path's thin-look gate keys on
`!priorLook`, so a site with neither a look nor a stylesheet stopped being refused
and went all the way to a real compile. (4) `MARKS` used in `currentStateNote` and
never imported — run 22's `TOKEN` trap for the THIRD time in one session, with
`node --check` passing again; every touched module is now LOADED, not parsed.
`test/site-mark.test.mjs` (18) keeps the two things worth having from the deleted
wall's guard — the pair DERIVED from the baker's own two branches in both
directions, and the driven route with the lane's tool COUNTED, inverted: the
property was "the 292-second call is never made" and it is now "the call is made
and the site's stored mark really becomes the drawing" — plus `readMark` over
both shapes and every refusal, the fold on fretwork-1's own shape, the removal,
`ownedMark` over every form, the projection's one-half-per-pair, the merge rule
driven both ways, the note, the Worker's hops, the wall's absence with a live
observer, the removal's whole sentence chain DRIVEN, `siteIconFrom`'s refusal
driven, and four route cases with two controls. Full suite **5,419**.
**Sweep: 48 mutants, 47 killed, none survived, none unapplied, the comment-only
control survived — SEVEN survived the first pass and every one was a guard gap,
not the product's**: `markUnder` answering for a drawing nothing covers, the two
readers' sizing swapped (INERT against a 64×64 fixture — the favicon forces a
square and the wordmark reads its own viewBox, so only a NON-square document
tells them apart), and the removal's three hops — the rung discarding the stored
form, the sentence ignoring it, the route's save answering nothing — none of
which anything drove, plus `siteIconFrom`'s refusal, which had no driver at all.
One anchor was AMBIGUOUS and never applied: the build path's
`priorLook = lookWithMarks(cfg.config)` at ten spaces is a SUBSTRING of the lane
path's at sixteen, the recorded "a mutant whose anchor is a substring of
another's"; re-anchored with its neighbour and killed. The rest: the fold
inverting the ladder, an unreadable form falling to the floor, the upload
losing to the drawing, a removal always flooring, `ownedMark` counting a
drawing, the form read by truthiness, a coerced url, a non-https url admitted,
the payload sending both halves of a pair, the floor going silent, `markWire`
projecting one mark, `lookWithMarks` making an object out of nothing or dropping
every other key, a favicon reading `text`, a drawing stored unvalidated,
`sameMark` blind to the drawing, one sentence for both marks; the merge letting
a volunteered mark win, protecting against a named lane, defaulting to replace,
not normalising or normalising an absent mark, `FIELD_KEEPS` refusing the form,
the note silent about an upload or truncating a drawing; and on the Worker every
projection and every fold cut in turn, both merges' flags swapped, the rung
writing an unread look, and the baker admitting any url shape.
**SIXTEEN OLDER GUARDS WENT RED AND WERE RE-ANCHORED, NOT APPEASED**, each naming
which spelling moved and why — and three of them are DRIVEN now where they read a
regex fragment or walked a byte window between two lines that no longer exist
(the favicon/wordmark pair in the build args was the window this repo has been
outrun by three times; it cannot be separated any more, because it is not two
lines). One INVERTED deliberately: "the logo is its OWN stored field, never a
member of the look" was true because `mergeLook` rebuilt from `EDIT_FIELDS`
alone, and that reason expired when a mark became an edit field — the recorded
"a rule true because of a layer below it expires when that layer moves".
**PROVEN LIVE BY RUN 42 (2026-09-07 04:37Z, `harness: lane`, `lanes: wordmark`,
"Redraw the header wordmark as the letters CGS in a bold serif, black on
transparent", 503 → 502).** Job `da70ae7b…`, **1 credit, 176 s**,
`moved: ["wordmark"]`, `changed: []` — no page source touched, only the mark —
37 files, `mtqdjyhg-bizsag` → `mtqr2tnz-yqyqvv`. **The proof is one line of the
harness's own reading: `/logo.svg` 0 → 245 bytes.** That file was a 404 before
this run, which IS run 41's defect: the drawing was stored, the build published,
2 credits taken, and the upload's `if (!logoValue)` meant no file was ever
written. The served header now carries `<img src="/logo.svg" alt="Crookes Guitar
School">` — `CGS` in Georgia bold serif, black on transparent, 245 bytes
(`docs/edits/mark-run42-header.png`, read off the served page through a local
mirror; `mark-run42-logo.svg` is the file itself). The striped test PNG is off
the page, which answers the first of the two owner questions this entry used to
carry.
**And the header is the only instrument that can say the stored form changed.**
`writeSiteBrand` could never bake a drawing while `config.logo` was set, so a
drawn mark in the header proves BOTH hops at once: `markWire` sent the drawing
and not the upload (one half per pair), and the merge normalised the lane's
answer to `{form:"svg", svg}` on a site that was carrying the old pair. There is
still no route that hands the stored look back — the second owner question stands
— so a publish remains the only way to LOOK at a mark.
Trace `e_mtqr2akbz6xqqlxm`: `pick_lanes` 9.6 s, **`lane:wordmark` 11.8 s**
(221 chars answered — against runs 11/12/40 cut dead at 240,000 ms and run 41's
292 s; this answer was short enough that the streamed ceiling was not tested
again), the compile ~120 s, `stage` 15.3 s, `publish:gate` ok, `activate` from
`01788733184386-yboq08` to `01788755899622-6w90uf`, `worker:put` **200** with
`uploaded: true`, then `commit ok` — **the corrected activation's served-not-
merely-not-refused rule on a real publish** — `prune 0` (the parent kept),
`dead: 0`. Both languages `cached: true, missing: 0`, so nothing extra was
charged. Two render findings, neither this change's: React #418 on `/` and `/es`
at phone width, `/` now naming its own text ("the server rendered “Llun” where
the browser then rendered “Mon”"), which is task #80's Welsh ICU gap between the
container's Node and its Chromium; and `deadSelectors: 2`
(`[data-slot="cta-band"] [data-slot="button"]`, `[data-slot="hero-split"] h1`),
left over from an earlier css edit and reported rather than enforced.
**Still not proven live**: the removal. `markRemove` on a site now carrying
`{form:"svg"}` should answer the FLOOR with `markWords` naming it, where the same
ask on a legacy site reveals the drawing the upload was hiding — free, and it
takes the CGS mark back off, so it is the owner's call.

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
  not naming it. **PROVEN LIVE by run 36** (in git).

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
  read twice. Full suite 5,018 green. **PROVEN LIVE by run 37** (in git).

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
- **Balance: 244 credits** (read off the ledger 2026-09-11 17:56Z, after
  `saltmarsh-kayak-co-2` took 275 → 244 — **31 credits**, the most expensive
  build measured on this account: `:deposit` 2, `:settle` 7, `:pages` 20, plus
  ~2 for routing. Nine pieces and a hand-written tide chart is what that buys).
  Before it, the two FAILED `saltmarsh-kayak-co` attempts took 298 → 275 with no
  reversal row — the defect the charging fix closes, and **those 19 credits are
  still owed**. Before those,
  `ben-crowe-guitar` took 318 → 298 — **20 credits**, and
  `sowerby-forge` took 332 → 318 — the Stage B graph build, 14 credits.
  It was 502 on 2026-09-07 04:44Z, after run 42 took 503 → 502. It was topped
  up to 505 on 2026-09-06 19:12Z on the owner's
  *"Top it up"*: a DIRECT GRANT of 500, not a purchase — `add_credits`
  is mint-key gated and the secret is not in a session, so the grant mirrors
  that function's body minus the mint check, one `purchases` row under
  `ref 'grant:session_…:2026-09-06'` with **`amount_cents` 0**, the ref its
  idempotency, proven by a re-run that moved nothing. It was 5 before, and
  unchanged since 2026-09-04 20:48Z; run 37 took 24 → 7, run 38 7 → 6, run 39
  6 → 5; then run 41 took 505 → 503 and run 42 503 → 502. It was **0**
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
- **The building account is `aniascristian@gmail.com`, not the session's own
  address.** It owns every live site and holds that balance. Look at the wrong
  row and the balance reads as zero.
- **Analytics is collecting** and has been since the CSP fix on 2026-08-15: 451
  pageloads in the 7 days to 2026-08-28 across ~25 hostnames. Config
  `53fa6238…`, token `16ed2075…`, `auto_install: true`. `rum report` reads it
  free and read-only.
- **`site build` is 382/382, RE-MEASURED LOCALLY 2026-09-12** — and the
  re-measure is why it is trustworthy today. The 382 was stamped on 2026-09-09
  from a local run and nothing re-read it for three days; the line then said
  "the next CI run of this workflow is what re-reads the number", and what
  actually re-read it was this one, which came back **381 passed, 1 failed**.
  The failure was the harness's own hardcoded fan-out ceiling, not the product
  (the trap entry has it): the count was right and the run was red, and a count
  nobody re-measured is a claim ahead of its evidence in BOTH directions.
  Before that, CI had read `373 passed, 0 failed` on runs 1065 and 1066 once
  the cap moved to 35 minutes.
  The unit suite is 6,077 (2026-09-12, the project-root census, the template
  name guard, the preview-error channel, the code tree's icons and sort, the
  search box, the tree column's width, the row menu, the click twitch, the
  scrollbar gutter, the kit closure and the derived harness ceiling; 86.6 s
  local).
  **Run it as `node --test "test/*.test.mjs"`** — the quoted glob, which is what
  `package.json` runs. `node --test test/` reads the directory as a MODULE path
  on this Node and answers `MODULE_NOT_FOUND` as one failing "test", which is a
  red run that looks like a broken suite and is a wrong command.
  **In this sandbox the
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

**AND THE GUARD CAN COVER THE CHAIN AND STILL MISS A HOP (2026-09-08, the Code
tab, found LIVE by the owner a day after it shipped).** Making Code real took
three hops — draw the tab, render the host, fetch into it. The guard asserted the
tab twice, asserted the loader, drove both handlers, and never read the branch
that renders the host, which kept its old `!isReact &&` and was therefore false
on every site that has ever built. The sweep even killed "the Code tab gated on
`isReact` again" and called that the defect itself. **A hop nobody listed is a
hop nobody guards**: derive the chain from the value's route — producer, host,
consumer — and assert each link, rather than the hops that were on your mind when
you wrote the change. The tell here was available for free: the pane's condition
and the function it calls asked the SAME question in opposite directions.

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
**AND ITS QUIETEST FORM IS PINNING A LIST BY ITS LAST ELEMENT (2026-09-09).**
`deploy-gate` asserted its five names as `…STALE_QUEUED_S,\s+\} from
"./builder/edit-job.mjs";` — the closing brace and all — so it went red because
an unrelated name arrived BELOW them, reporting the deploy gate as unwired by a
change that did not touch it. Being last in a list is almost never the property;
membership is. Read the block and assert each name in it.

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

**AND PROSE ONE SECTION OVER CAN STEAL A LANDMARK THAT WAS UNIQUE (2026-09-08).**
`site-contact.test.mjs` windowed the router's `nav` clause as
`slice(indexOf('"nav"'), indexOf('"page"'))` — correct while `"page"` appeared
only where the `page` layer is described. The removal work added a sentence to
the `look` clause naming layer `"page"` as the one exception, and `look` sits
EARLIER, so the window became `slice(bigger, smaller)`: the empty string, which
matches nothing and reported the socials and the footer as missing from a clause
that still says both. **Search the closing landmark FROM the opening one**
(`indexOf(end, at)`) and assert `end > at`; a landmark is only unique until
somebody writes about it upstream, and a description that explains its own
exceptions will always name the other sections.

**A NEGATIVE LIST IS THE WRONG WALL WHEN THE INPUT IS CALLER-SUPPLIED
(2026-09-08, found by a guard on the change that introduced it).** The lane
door was written `eRemove && !OWN_REMOVAL_LAYERS.includes(eLayer)` — "open for a
removal on anything that does not answer removals itself", which reads correctly
and is correct about every layer the ROUTER can produce, because `readEdit`
strips the flag elsewhere. The edit route reads `remove` off the REQUEST BODY,
so `{layer: "data", remove: true}` walked straight through a wall that only knew
what to exclude. **Ask the positive list** — the one derived from the same
constant the producer filters on — and the wall then admits exactly what the
field is read for, whoever sent it. The general shape: a validated producer and
an unvalidated door reach the same consumer, and a deny-list at the door is a
claim about the producer, not about the input.

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
**AND TWO REDUNDANT DEFENCES CANNOT BE KILLED ONE AT A TIME (2026-09-09).** The
trigger reader skips comment lines AND matches an event key as `[a-z_]` right
after exactly two spaces — either alone keeps a parked trigger from reading as
live, so cutting the skip changed no answer on any of 33 workflows across five
questions each, and read as a test gap. **A survivor here is not always a
missing check; sometimes it is a second wall.** Prove it inert by MEASURING both
versions over the real corpus, then mutate the PAIR, which must die. Say in the
code that the redundancy is deliberate — a sweep cannot say it, and the next
session deletes what nothing appears to need.

**NOTHING GUARDED WHICH WORKFLOWS A MERGE STARTS (2026-09-09).** Twenty-two
automatic triggers came off `.github/workflows/` in one commit — five smokes
chained to the Deploy, three probes, the unit suite, thirteen path-filtered —
and **all 5,722 tests stayed green.** Not one guard anywhere asserted what runs
on a push to main, so the CI configuration was the one part of this repository
with no census over it at all, while being the part that decides what gets
checked and what gets spent. `test/merge-triggers.test.mjs` is that census now.
**The general shape: the thing that runs your guards is not itself guarded
unless somebody writes it down** — and it fails silently in the safe-looking
direction, because a workflow that stops running produces no red run to notice.

**A mutant that never applied.** The mirror. `grep -qF "$to"` is vacuous when the
replacement is empty or common — verify by CHECKSUM. **A sweep whose control never
applied is a sweep with no control.**

**Two lists of the same thing.** Routes in a matcher and in a dispatch condition;
a scanner's list and the kit's. They drift, and the drift is silent. Derive one
from the other, in BOTH directions where the scan can stop matching.
**AND A HAND-TYPED CONSTANT IN A CHECK IS ONE OF THEM (2026-09-12, the container
harness).** `site build` came back **381 passed, 1 failed** on a change that
touches neither the fan-out nor the model path: "a fan-out over the container's
own ceiling is refused, never truncated" posted NINE requests, and nine was over
the wall on 2026-09-10 when the check was written and legal from 2026-09-11 when
the two bounds split (`MAX_MODEL_FANOUT` 8 sockets, `MAX_FANOUT_REQS` 16 list
length — the split's whole point being that a plan of nine pieces can be SENT).
`git merge-base --is-ancestor` settles the order in one command: the check came
first, the ceiling moved under it. **So the failure named the product and the
defect was in the check**, which is this file's own "a rule true because of a
layer below it expires when that layer moves" trap wearing a red test as its
costume — and the reason it went unread for a day is the Live-state line already
flagging `382/382` as a local number nobody re-measured. It imports
`MAX_FANOUT_REQS` and sends `+ 1` now. **A check that hardcodes a number the
product exports is a second copy of that number with no guard between them**, and
the three-request job above it is what keeps the observer alive without a second
case.

**A LOOKUP KEYED AT A DIFFERENT GRANULARITY THAN THE THING YOU ASK IT
(2026-09-08).** `LANE_LAYER` is keyed by GROUP and `laneLayer(field)` is the
resolver; indexing the map by a field name answers `undefined` for the three
lanes inside the `plan` group — and `undefined` there is a legitimate value,
meaning *this lane has no layer of its own*. So the wrong reading produced a
plausible, wrong split, which went into a section heading, two files and an
owner note before anything noticed. **The miss and a real answer were the same
value**, which is this repo's own "cannot-tell must never read as
nothing-there" one layer down: when a map's absent key means something, ask
its resolver, not the map. The tell was free and I walked past it — the
derived numbers did not add up to the split written beside them.

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

**LOADING A MODULE PROVES ITS IMPORTS, NOT THE IDENTIFIERS INSIDE ITS FUNCTIONS
(2026-09-07, and it reached MAIN).** De-duplicating the mark URL rule deleted
`const logoOk` from `writeSiteBrand` and left one reference to it in the return
statement — `refused: (!!raw && !logoOk) || …`. **`&&` SHORT-CIRCUITS**, so a
build with no logo never evaluates it and every unit test, every source scan and
a real `node builder/build-server.mjs` that started and listened all passed. A
build WITH a logo threw `logoOk is not defined`. The container harness caught it
— eight failures, one cause: two logo cases directly and six more reading a
stamp off the build that never happened — and it caught it AFTER the merge,
because I had reasoned that starting the service was the risk and skipped the
25-minute wait for `site build`.
**THE FOURTH FREE-IDENTIFIER MISS IN ONE SESSION** (run 22's `TOKEN`, `eMark`,
`MARKS`, this) and the first that a module LOAD did not catch: an import graph
resolves at load, a free identifier inside a function body resolves when that
line runs, and a short-circuited operand may never run at all.
**AND IT HAPPENS IN A TEST SCOPE TOO, WHERE IT IS SILENT IN BOTH DIRECTIONS
(2026-09-12).** `test/site-source.test.mjs` carries the tree renderer out of
`chat.js` into a `new Function` scope; `stCodeRows` gained `ST_FIND_MAX` behind
`f.hits ? … : ''` and `stCodeTree` gained `ST_ALL_OPEN` behind `all ? … :`, and
every case in that file went on passing against a scope that had NEITHER — no
missing import, no parse error, just two operands nothing in the fixtures
happened to evaluate. `konst(name)` pulls a top-level one-line `const` out of the
file so a carried function's constants are carried like its functions. **When a
carried function gains a new free name, add it to the scope even if the suite is
green** — green here means the fixtures never took that branch. **The check that
finds this class is grep for every identifier a change deletes**, in both
directions — and for anything the baker touches, the container harness, which is
the only thing that runs `writeSiteBrand` with a real logo. Its 25 minutes are
not optional on a change to `build-server.mjs`; that is what they are for.

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

**AN API THAT SERVES A STALE SNAPSHOT AND SAYS SO IN A FIELD NOBODY READS
(2026-09-10, deploy 2069).** GitHub's job listing kept answering `in_progress`
for a container-image step that had finished at 02:53:39Z, and it was read here
as a 32-minute hang on a deploy that took 3m27s — reported to the owner as a
stuck deploy, with an invented consequence about the deploy gate holding
customers' edits for 45 minutes. **The tell was free and in the response**: the
run's own `updated_at` stayed at 02:50:57Z while the step timestamps beside it
moved, which is a cached snapshot saying it is one. Read `updated_at` before
believing a status, and prefer the COMPLETED run's timings to any in-flight
poll. The general shape is this file's own screenshot rule pointed at a control
plane — **when the instrument and the thing disagree, suspect the instrument
first** — and the cost of getting it wrong in this direction is a false alarm,
which this file rates worse than a miss.
**IT HAPPENED AGAIN THE NEXT DAY AND THE TELL ABOVE DID NOT WORK (2026-09-10,
`unit tests` run 2413).** The suite step finished at 20:49:11Z and three
different endpoints — the run listing, `get_workflow_job`, and the check-run —
all answered `in_progress` with unmoved step timestamps for ~15 minutes after.
**This time `updated_at` was frozen TOO** (20:47:38Z, beside step stamps that
had also not moved), so there was no internal disagreement to spot: the
sentence above says to read `updated_at` before believing a status, and a
snapshot stale in every field passes that test. So the corrected rule is
narrower. `updated_at` moving BEHIND the steps proves staleness; it agreeing
with them proves nothing, because a whole snapshot can be old. **What settles
it is the step's own expected duration** — this suite step has taken 80–84 s on
every run of this workflow, so anything past a few minutes is the instrument
until a later poll says otherwise. Wait and re-poll; do not report a hang, and
do not report a pass either.
**A FOURTH INSTANCE PUTS A BAND ON HOW LONG IT CAN LIE (2026-09-11, `unit
tests` run 2432).** The suite step ran 01:41:38Z → 01:42:57Z — **79 seconds**,
inside the measured band — and five polls over ~25 minutes returned the SAME
snapshot byte for byte, `in_progress` on that step. `updated_at` sat at
01:41:23Z against step stamps at 01:41:38Z, which is the proving direction, so
the tell worked and it still took twenty-five minutes to clear. **So the tell
says the reading is stale; it says nothing about when the truth arrives.** The
free thing to do while waiting is rule out the OTHER explanation locally: the
whole suite on the same tree, and the changed guard files on their own, which
is what made "the instrument" the only reading left.

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

**…AND "IN THE BACKGROUND" IS NOT `nohup … &` (2026-09-08, hit anyway, in a
runner that HAS the trap).** `scripts/mutate.mjs` restores on every exit path,
and it never got one: run as `nohup node scripts/mutate.mjs … &` inside a
background tool call, the harness reaped the tracked wrapper the instant `&`
returned and the runner became an orphan nobody owned. Its log read as though
it had stopped after two mutants — and `builder/build-answer.mjs` was sitting
in the tree carrying a live mutant, which `git diff` found and `git status`
would not have explained. **Run the sweep as the background call's own
command**: no `nohup`, no `&`.
Two more things worth having from it. The second run, started while the orphan
still had a mutant applied, **correctly refused a red baseline** — the wall
working, and the reason to keep it. And the two processes wrote one log at
different offsets, so the file interleaved into something that read like a
clean 28-mutant run with a plausible survivor list: **`pgrep -f
scripts/mutate.mjs` before believing any sweep result**, because a sweep whose
tree moved under it proves nothing and does not say so.

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
**AND THAT ENTRY'S OWN PREMISE HAS SINCE EXPIRED — corrected in place rather
than left standing (2026-09-12).** `deploy.yml` gained a `paths-ignore` on
2026-09-03 naming `**.md`, `docs/**`, `LICENSE`, `test/**` and `scripts/**`, so
the two pushes that caused the damage above would not deploy at all today. What
survives is the half that is still law: **every push the filter does not catch
rolls the container**, and that has nothing to do with `builder/`.

**A COMMIT SAYS WHAT A COMMIT CHANGED; THE DEPLOY FIRES ON THE PUSH
(2026-09-12, written into two commit messages the same night).** The tip two
commits of one push each ended "no image input moves, so nothing rolls" — TRUE
of each commit read alone, and false about the deploy they triggered, because
the three commits UNDER them had moved `worker.js`, the `Dockerfile` and five
builder modules. Deploy 2090's log settles it: `built
isibi-app-sitebuildcontainer:6…b7cabe28d…f48a (registry answered 404; 172
inputs off ./Dockerfile)`, then `EDIT isibi-app-sitebuildcontainer`,
`f779f569…7b…8667` → `6…b7cabe28d…f48a`, `SUCCESS Modified application`,
**applied 23:58:22Z** — so the hold ran to ~00:13–00:18Z on a push whose last
two commit messages both said nothing would roll. The game image `reused`
(registry answered 200) and its app `no changes`, which is the control: the
skip logic was working perfectly and the CLAIM was the wrong one.
**This is the recorded merge-diffstat trap wearing its other face**: that one
is a diff against the wrong BASE, this one is a diff over the wrong RANGE. Both
answer a question about a push by reading one commit. **The roll question has
exactly two honest answers**: `git diff --name-only <what main had>..<what you
pushed>` before the push, and the deploy's own image step after it. A per-commit
"nothing rolls" line is fine as a note about that commit and must never be read
as the hold being off.

**A CHECK THAT ASKS THE FILESYSTEM IS ASKING THE WRONG THING (2026-09-11, found
by a RED CI run).** `fs.existsSync` said a file was there and git had never heard
of it: `src/routeTree.gen.ts` is regenerated by every build and the template's own
`.gitignore` names it, so on any machine that had ever built, the generator read
it happily and baked THAT MACHINE'S copy into a committed module — shown to
customers as "shared with every site", a file no checkout has. Green locally,
ENOENT in CI. **When a check is about what the REPOSITORY holds, ask git**
(`git ls-files`), derive the list rather than naming the one file that got in,
and prove the observer alive first — an empty listing makes every assertion
vacuous.

**THE THING THAT RUNS YOUR GUARDS IS NOT ITSELF GUARDED (2026-09-11).**
`scripts/mutate.mjs` decides what every sweep here means and nothing asserted
anything about it, which is the same shape this file already records for the CI
triggers. Two of its properties had gone wrong in practice, and the second is the
instructive one: **a `process.on("SIGTERM")` handler in a SYNCHRONOUS loop
swallows the signal entirely** — installing a listener replaces Node's default
(die), and a handler is dispatched through the event loop, which a loop of
`execFileSync` never returns to. Measured: four iterations, the handler never
fired once, exit 0. So `kill` did nothing, `kill -9` was the only thing that
worked, and that leaves a live mutant in the tree. **And the obvious fix is
INERT**: adding `process.exit()` to a handler that never runs reads exactly like
a fix. The loop awaits now. **A sweep cannot mutate its own runner**, so those
guards are proved by hand — said out loud rather than counted.
**AND A CONTROL MUST BE DECLARED, NOT MERELY LABELLED (2026-09-12).** The runner
reads `control: true` off a spec entry; four recent specs named theirs only in
the LABEL (`"CONTROL — a comment only, which must survive"`), so `isControl` was
false for every one of them. Two consequences, and the second is the real one.
The tally printed the controls as ordinary survivors, which is why entries here
carried hand-adjusted numbers that no run ever produced (`20 mutants, 18 killed,
0 survived` — 20 counting the controls, 18 not). And **the runner's own
`CONTROL WAS KILLED` branch was never armed**, so a control that stopped being
comment-only would have printed as a kill and read as a win: the sweep's one
check on its own honesty, off, in the sweeps that reported it working. Declared
now in all four, and re-run: **18/18, 4/4, 25/25, 7/7, every control surviving**
— the numbers above are what the runner printed, not what was reasoned from it.

**A DEFECT THAT ONLY EXISTS IN TIME IS INVISIBLE TO EVERY STILL (2026-09-12).**
An entrance animation on an element that something started rebuilding by itself is
a twitch on every interaction — 8px and a fade, 220 ms, on every click of the Code
tab's file tree (the explorer entry has it). **No markup assertion, no CSS
existence check and no screenshot can see it**: the finished panel is pixel-perfect
in every still, and the only reading that shows it is one element's rect sampled
across `requestAnimationFrame` after the interaction. The screenshot rule two traps
up is about a still lying; this is a still being SILENT, which is worse, because
the picture looks like evidence. When an owner reports movement, measure across
frames — and note that an animation is the one kind of rule whose correctness
depends on how often its element is created, which nothing in a stylesheet can say.
**And a first fix for the right symptom is not a fix for the right cause**: the
width regression on the same panel the same night was real, measured, and covered
only the FOLD path, so the file path went on twitching and the owner had to report
it twice.

**A CSS RULE CAN BE CORRECT AND STILL LOSE (2026-09-11).** `padding-left` written
above a `.st-file { padding: … }` shorthand loses on source order alone, at equal
specificity — so the nested file tree drew every row flush left while the markup
carried the right depth all along. **No assertion about the markup can see it**,
and neither can one that checks the rule EXISTS: the test has to check it sits
below every shorthand that rewrites it, and that it READS the value it is meant
to (a rule indenting every row by a fixed step satisfies both of the others).
Found by looking at the render, which is the only instrument that sees it.

**A FIXTURE TOO SHALLOW TO SEPARATE THE TWO READINGS (2026-09-11, a sweep
survivor).** The tree's chain walk must skip as many segments as a collapsed
folder chain SWALLOWED; advancing one at a time is wrong, and every fixture
agreed with both readings because `src/routes/-parts` swallows every segment
there is — nothing follows the chain for the walk to get wrong. The shape that
separates them is a folder BELOW a collapsed chain. Same family as
`partNameOf`'s `.tsx` test and the `String(["a"])` cases: **when a mutant
survives, ask what input would make the two readings differ, not whether the code
looks right.**

**AND AN AD-HOC CHECK CAN FAIL TO APPLY ITS OWN MUTATION (2026-09-11).** Deciding
whether that survivor was inert, an inline `node -e` whose quote escaping
silently no-op'd the `replace` compared the original code against itself and
answered INERT. The recorded "a mutant that never applied reads exactly like a
killed one", now in the instrument written to classify a survivor — and believing
it would have shipped a real defect with a note calling it harmless. **Any
hand-rolled mutation check must REFUSE to run when the source did not change.**

**A SWEEP DOES NOT NEED THE WHOLE SUITE, AND SAYING SO IS NOT A SHORTCUT
(2026-09-11, owner: *"Why this is taiking so long"*).** `scripts/mutate.mjs`
takes a test-file list; given none it runs everything, so 45 mutants each re-ran
all 6,025 tests at ~90 s — ~70 minutes for a browser-only change. The files that
can see the change are 2,313 tests in **32 s**. **The rule that keeps it honest:
a SURVIVOR is re-checked against the whole suite before it is believed**, since a
narrow list can only produce a false survivor, never a false kill.

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

**AND ITS MIRROR: A POSITIONAL GUARD CANNOT SEE A DEAD BRANCH (2026-09-09,
found by the sweep on the project router).** Vacuous ordering is a landmark that
went AWAY; this is a landmark that stayed exactly where it was while the code
around it stopped running. `if (bootProject !== undefined) { … }` mutated to
`if (false) { … }` leaves every landmark in the file at the same offset, so a
guard reading their order passes over a boot that ignores the address entirely.
The same shape kills a check on a call site: `if (false) foo()` leaves `foo(` in
the file, which is why the addon work already records reading a call's own
`if (` rather than its position. **A position is not a behaviour** — when what
you mean to assert is "this runs", cut the block out and RUN it (both the boot
and `openProject`'s re-draw are driven now); keep the positional check only for
what a drive genuinely cannot see, like an ordering inside the block whose
consequence is in code the drive stubs out.

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
