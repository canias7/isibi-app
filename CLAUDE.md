# Go Farther

> **Read `docs/owner-notes.md` at the start of every session** — the owner's
> running log and how they like things done. Keep it updated.
>
> **PRUNED 2026-09-14 (owner: "our claude.md is really big, you can delete
> almost all the old stuff bro").** It was **7,615 lines and is 3,157 — 4,458
> deleted, 58.5%**, and this is the fourth prune: 3,786 → (2026-08-28) → 10,004 →
> (09-09) 3,808 → 7,883 → (09-11) 3,933 → 7,615 → **3,157**. Each time the file
> grew back by accreting the STORY of every shipped change beside its law.
> **The totals are the file as it stands; the per-section figures below are the
> CUT's own** — the same commit then wrote this change's entry back into the
> probe section, which is why the two do not add up and why saying so beats
> letting a stamp drift.
>
> **What went this time, and the rule that decided it: a fact that is true today
> belongs here; a story about how it got true belongs in git.** Two whole
> sections were pure history and are now a paragraph each — the media side's five
> deletion stages (686 lines; it is deleted, and what survives is what was KEPT
> and why) and the dead-code deletion (187). Five more were COMPRESSED rather
> than cut, every rule and **every measured number** carried across and only the
> narrative dropped: the code explorer (553 → 135), Rules from recent fixes
> (885 → 184), the container clock and the two probes (585 → 185), the add step
> (550 → 136), the edit path (423 → 175), the tables step and the column grants
> (658 → 130), and **THE TRAPS (1,482 → 330, with every one of the ~85 traps kept
> as its rule plus its measurement)**.
>
> **The full record is in git: `git show a4d0f5e5:CLAUDE.md`** — every entry,
> every sweep tally, every live-deploy record, from 2026-09-05 to 2026-09-14.
> Earlier ones: `git show 6393b134:CLAUDE.md`, `7104c87b`, `5cfd4e58`.
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
  of `worker.js`. **BEING DELETED since 2026-09-12 — see the section below.**
- **The site builder** — a customer describes a business in chat and gets a
  published website at **`<slug>.gofarther.app`**. `gofarther.dev` is the tool
  they use; `.app` is theirs. The builder is the active work, and after the
  deletion it is the only work.

---

## The media side is gone (deleted 2026-09-12, five stages)

`gofarther.dev` served an AI image/video/voice generator from the beginning. It
is deleted: the composer, the gallery, the director, `/api/video|image|audio`,
the Media Agent, the avatar, the universal memory, the game builder, and the
customers' 53 stored generations. **~23,000 lines across five stages, each its
own commit with the suite green before the next.** The builder is the only work.

**What was KEPT, each checked rather than assumed**: the membership tiers, the
credit ledger and every RPC under it (`gen_charges` is a live Postgres table
with `refund_charge` over it — money history), `usage_log` (it reads as
media-era and is the BUILDER's quota), `safeFetch`/`hostIsBlocked` (the outbound
webhook takes a customer's URL), and **fal for the builder's own photographs** —
`genSitePhoto` calls `fal.run` DIRECTLY where the media side called
`queue.fal.run`, so deleting `/api/image` could never take a site's pictures
with it. The 108 site-builder uploads under `<uid>/site/` (162 MB) stay.

**`home` IS AN ALIAS FOR `sites`, NOT A VIEW.** `KNOWN_VIEWS` is
`['sites','settings']` and anything else falls back to the builder — a
refresh-proof `zephyr_view_v1` of `gallery` would otherwise paint an empty main.
The alias and the fallback are deliberately redundant and the sweep proved it;
both are kept because they say different things.

**The landing page still carries the media side's CRT channel selector, its
model pipeline and `providerOf`** — deliberately, because rewriting it is a
design job the owner directs. Both landing doors open the builder and the
non-website channels are inert. It is the one piece still standing.

**The full record of all five stages is in git: `git show a4d0f5e5:CLAUDE.md`.**

---

## The dead-code deletion (2026-09-13)

Owner: *"CAREFULLY DELETE THE DEAD CODE"*. Four commits, ~1,400 lines of
`worker.js` and `public/chat.js`, four whole modules, a 1.5 MB wasm dependency,
and **2,280 lines of unreachable CSS**. Deploy 2112. The law that survives:

- **THE LINE IS "DEAD BY CONSTRUCTION" versus "DEAD ONLY GIVEN STORED DATA".** A
  declaration nothing references, or a branch whose condition cannot be true from
  the code alone, is measurable here and went. A branch reachable only from a
  record in a customer's localStorage is not measurable from this machine and
  STAYED — `chat.js` keeps every legacy-`html` arm. Nothing today writes a
  non-empty `html`, so they are unreachable for every site the platform can make
  and cannot be proven unreachable for a record written by a version that no
  longer exists.
- **`public/styles.css` is held at ZERO unreachable rules** by
  `test/css-reachable.test.mjs` with an EMPTY `KEEP` list. It went 7,210 lines /
  484,036 bytes → **4,930 / 327,903**; the live served sheet is 156,133 bytes
  lighter on every page load. **A prefix is the TAIL of a literal before a `+`,
  not the literal** — that is what makes `'<div class="mkt-cell mkt-c' + n` read
  as live. False-alarm rate measured four ways and is zero, including a real
  Chromium comparing all 1,744 elements across five pages at two widths.
- **A comment goes only when EVERY rule it introduces goes** — "section
  boundaries are not subject boundaries" is this file's own trap, and the
  heading reading "Avatar creator" covers the auth gate's rules.
- **A CSS SYNTAX ERROR SHIPPED FOR A DAY** because a deletion cut a two-line rule
  in half; a browser recovers by discarding text until the next `}`, silently.
  The guard asserts the braces balance, and `braceReport` is exported and DRIVEN.
- **Deliberately parked**: `cancelEditJob` (the CLOSING LANDMARK of eight guard
  windows — re-anchor before cutting), the effort dial, the 80 test-only exports.
- **OPEN**: `GET /preview/<uid>/<nonce>` is served and **nothing anywhere writes
  that object**, so it has answered "Preview not ready" to every request it has
  ever had. A route with no WRITER is a shape `client-routes.test.mjs` cannot
  see; it is recorded in that file's `KNOWN_DEAD` prose.
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
- **The Media Agent and the universal memory are GONE** (stages 2b–4). The agent
  was an Instagram/YouTube manager over Composio — read and comment auto-reply
  live, DM auto-reply blocked on Meta App Review — and the memory was
  auto-learned creative taste applied to every media generation, backend only and
  deliberately with no UI. Both went with the media side, along with
  `docs/media-agent.md` and the Composio credential. `git show
  6393b134:CLAUDE.md` and the deleted document in history are where they are
  described, if either is ever wanted back.

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
**THE IMAGE ID CAN BE COMPUTED BEFORE THE PUSH, AND THAT IS WORTH MORE THAN
ANOTHER TIMING — PROVEN on deploy 2119 (2026-09-15 00:23:24→00:26:12Z, green in
2m48s; image step 2m08s).** `containerInputs`/`imageId` are pure functions of
the git objects the Dockerfile COPYs, so running them over a ref answers what
that ref's image id WILL be — `git rev-parse <ref>:<path>` and `git show` are
the whole reader. Computed before merging: `origin/main` → `e35d9f28b49f5f2c`
(**which matched the image the live container was actually on**, so the
arithmetic was cross-checked against reality rather than only against itself)
and the branch tip → `16cb42353dc4a343`. The deploy then printed `built
isibi-app-sitebuildcontainer:16cb42353dc4a343 (registry answered 404; 180
inputs off ./Dockerfile)` and rolled the container at 00:26:06Z
(`e35d9f28b49f5f2c` → `16cb42353dc4a343`, `SUCCESS Modified application`).
**Two things follow.** A rollback's speed is PREDICTABLE: a revert restores the
tree main had, which hashes to an id the registry already holds, so the image
step says `reused`. And "is this commit an image input?" has an exact answer —
if the id does not move, nothing an image is built from moved, which is a
stronger statement than reading a `paths` list.
**AND ONE SERVED FILE IS A FREE WORKER-SIDE CHECK.** When a deploy uploads an
asset, that file is fetchable with no token: 2119 uploaded `/chat.js` and the
live bytes are IDENTICAL to the merged tree (589,434 bytes, sha256
`c6f27211c5586d0f`). It only works when `public/` changed — the standby is the
gate discriminator (`/api/site/build-health` **401**, `/api/site/runtime`
**401**, `/api/nope-not-a-route` **404**).

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

The Code tab shows the customer's whole project **as ONE tree from its root** —
the directory it really is on disk. Five category headings were deleted
2026-09-12 (owner, holding Lovable's explorer beside ours: *"ITS BY FOLDERS"*):
they drew `src/routes` twice and put no row where the file really lives.

- **A FOLDER'S KEY IS ITS PATH.** A folder folds, carries a COUNT of everything
  beneath it, and one chevron turns — the count is what makes a folded folder
  honest rather than hidden.
- **WHOSE FILE IT IS, IN INK** — the one thing a directory tree cannot say.
  `ST_FILE_KINDS`: the customer's own files (`page`, `part`, `asset`) draw in
  full ink, the platform's (`kit`, `shared`) stay muted. The words ride in
  `title`, because ink is a hierarchy and never a label. **`own` FAILS CLOSED**:
  a kind nothing recognises is not the customer's.
- **THE PROJECT ROOT'S OWN FILES ARE ALWAYS DRAWN** — all twelve, nothing above
  them to fold away. The lock file is what makes the download a PROJECT.
  Measured: 310,981 bytes raw, but gzipped the payload went 60,781 → 126,616 —
  ~66 KB more per open, and that is what travels. The raw bound is 600,000 with
  ~110,000 left, so the next file added here is a decision. **A CENSUS DERIVED
  FROM GIT** requires every tracked file at the template root to be in
  `FOUNDATION_PATHS`, so one added next month fails by existing.
- **`null` IS A THIRD STATE.** The stored fold preference is `null` until the
  customer touches something, which is NOT an empty Set: uninitialised opens the
  CHAIN holding the file on screen; an empty Set is somebody who closed
  everything. **It resets on a project switch** — to `null`, not to empty.
- **A CHAIN OF ONE-CHILD DIRECTORIES IS ONE ROW** (VS Code's compact folders),
  and the collapse rule is asked in BOTH places from one definition.
- **THE DRAW IS NOT THE FETCH.** A fold is a preference, not a question for the
  server. `paintTree` and `paintFile` each repaint one column; `drawSiteCode`
  writes an empty shell and has exactly one caller.
- **DEPTH IS ONE NUMBER THE ROW CARRIES (`--d`)**, and its rule must sit BELOW
  `.st-file`'s `padding` shorthand or the tree draws flat.
- **A FILE'S ICON COMES FROM ITS OWN NAME** and the tree is A–Z. `stFileIcon`'s
  RULE ORDER is the whole of it: lock file by NAME first, then extension, then a
  dotfile with no extension is configuration, then `code` as a reached fallback.
  `stSortTree` sorts on LOWERCASE CODE POINTS, never `localeCompare`, which
  scatters dotfiles. It overrides `FOUNDATION_PATHS`' "never alphabetical"
  deliberately — that is right for READING a project and wrong for FINDING one
  file among twenty-five.
- **A SEARCH BOX THAT SEARCHES THE CODE**, path or contents — the whole project
  is already in the browser, so it costs no request. **Measured ~1.15 ms per
  keystroke** over the 25 shared files (489,130 bytes). A row says why it is
  there: a contents match carries a hit count, a name-only match carries
  nothing. A filtered tree is drawn open and stores nothing; the open file is
  chosen from the WHOLE project, never from the results.
- **A MENU ON EVERY FILE ROW** — `Copy path`, `Copy contents`, `Download`
  (`ST_ROW_ACTS`, and the menu is DERIVED from it). No rename/delete/new: each
  would promise what the Code tab cannot do. **The handle is on files and on no
  folder** — every entry acts on one file's BYTES. The row is a wrapper around
  TWO buttons because a `<button>` inside a `<button>` is invalid and browsers
  HOIST the inner one out. ONE menu for the whole tree, `position: fixed` off
  the handle's rect, dismissed on scroll.
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
- **THE DOWNLOADED PROJECT CAN BUILD — the kit files its pages import.**
  `__root.tsx` imports `@/components/ui/sonner` and the zip carried the importer
  and not the module. **It is the CLOSURE, not the kit**: over 100 real sites
  that is **9 to 53 files, 26,092–126,082 bytes, ZERO unresolved specifiers**, so
  there is nothing to lazy-load. `builder/kit-closure.mjs` resolves it with the
  reader INJECTED; **the extension order IS the resolver**; cycles terminate on
  the RESOLVED path; a file the project already HAS is walked but not re-sent; an
  unresolved specifier is NAMED. `MAX_KIT_FILES` 400 REPORTS rather than
  truncating. **THE CONTAINER RESOLVES IT** because it is the only place both
  halves exist at once, seeded from the routes DIRECTORY so a salvage stub's
  imports count, fenced with `path.resolve` because every specifier came out of
  source a MODEL wrote. Stored at `source/<slug>/kit.json` on BOTH publish paths,
  subtracting what is already bundled, DERIVED from `FOUNDATION_FILES`.
- **A site that has not published since this shipped gets `[]`** and the explorer
  shows what it showed before. **THE WORKER CANNOT BACKFILL IT**: the closure
  walk needs each kit file's CONTENTS, which live only in the container image.
  `site_rebuild` is the free backfill and has not been run — **open**.
- **WHAT A SITE REALLY USES, with no auth and no publish**: every kit component
  stamps `data-slot`, so
  `curl --compressed <slug>.gofarther.app | grep -o 'data-slot="[^"]*"'` answers
  it. `ben-crowe-guitar` reads 18 distinct, mid-band.
- **OPEN**: a site published before the closure shipped draws no `Design system`
  folder and no sentence, so the silence explains nothing. A line in the tree is
  the fix.

**THREE SEPARATE CAUSES OF ONE SYMPTOM — the owner reported "the screen
vibrates" THREE times, and each fix was real and left the panel moving.** The
lesson is the shape: *a fix for the right symptom is not a fix for the right
cause*, and the honest tell was having to be told again.

1. **The column grew to its widest row** (fold clicks only). Splitting the column
   moved `overflow-y: auto` off `.st-code-tree` — and **any overflow but
   `visible` makes a flex item's automatic minimum size ZERO**, which is what had
   been pinning the column at `flex: 0 0 210px`. `min-width: 0` says out loud
   what the overflow said by accident. **MEASURED over seven fold states: 193px
   throughout before, 209 or 224 after, constant again with the line.**
2. **The panel replayed its entrance animation** (every click). `.st-code`
   carries one, and the panel started rebuilding itself. **MEASURED frame by
   frame: the whole panel drops 8.00px, fades to opacity 0 and slides back over
   220 ms, on every press**; rewriting only the rows moves it **0.00px**. **A
   STILL SCREENSHOT CANNOT SEE THIS CLASS AT ALL** — what sees it is sampling one
   element's rect across `requestAnimationFrame`.
3. **The scrollbar's lane** (every fold, only where scrollbars take width). On
   Windows and Linux a CLASSIC bar takes ~17px out of the CONTENT box — 8% of a
   210px column. `scrollbar-gutter: stable`, **never `stable both-edges`**, pinned
   by VALUE (a sweep survivor: `/scrollbar-gutter: stable/` matches the wider
   value as a substring). **THE RENDER COULD NOT PROVE THIS ONE**: headless
   Chromium uses OVERLAY scrollbars, which take NO width, so it read 0px in
   precisely the case that moves. The SHEET is the assertion and it is DERIVED —
   every `.st-code-*` rule with `overflow: auto` must carry the gutter.
   **What cracked it was one fact from the owner's side of the screen: which OS.**

**PROVEN LIVE** — deploy 2098, the owner on Windows: *"it works now"*; deploy
2102 for the one tree, *"OK GOOD, I CAN SEE IT NOW"*.

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

**A PAID HARNESS RUN REFUSES TO SPEND AGAINST THE WRONG BUILD (2026-09-15,
owner: *"Verify that both the Worker and the container executing the test use
the merged changes. Elapsed rollout time alone is insufficient evidence."*).**
`scripts/addon-sweep.mjs` asks `/api/site/build-health` (the Worker's
`DEPLOY_ID` **and** the container's cold-start image, in one call) plus
`/api/site/runtime` as a second reader, **before the browser, the balance or
the first post** — a refusal there has spent nothing, which is the only reason
it can be a refusal rather than a warning printed over a run already under way.
`expect_deploy` and `expect_image` on `lane-sweep.yml`'s form are the demands.

- **TWO HALVES, AND A ROLLOUT MOVES THEM SEPARATELY** — the Worker can be new
  while an instance started seconds earlier is still on the previous image, so
  the two expectations are two, not one.
- **CANNOT-TELL IS A REFUSAL, NEVER A MATCH.** `unstamped` arrives as `""`
  through `healthImage` and refuses; so does a route that failed. The wrong
  direction is the expensive one — a run against the PREVIOUS build produces a
  complete, plausible, green-looking result about code that is not under test.
- **A SHA MATCHES BY PREFIX, FLOORED AT 7 ON BOTH SIDES; AN IMAGE ID MATCHES
  WHOLE.** A prefix of a hash is not a weaker claim, it is a different one.
- **THE TWO READERS MUST AGREE, and that is asked with no expectation set** — a
  disagreement means a roll is in flight, which is a fact about the platform
  rather than about what the caller wanted.
- **`codeRefusals` AND `expectedCode` ARE PURE AND EXPORTED** because the
  wrapper needs two authenticated routes and a cold container: "a wall nobody
  can drive is a wall nobody is guarding", in the branch whose wrong answer
  costs credits. **The env pair was two module constants until a sweep killed
  it** — two mutants cutting the expectations out of the call SURVIVED every
  guard, since a constant handed over and one not handed over look identical
  from outside. `expectedCode(env)` makes that hop drivable; the census reads
  the workflow's own forwarding lines and requires the two name sets equal
  **both ways**.
  **Sweep: 29 mutants, 29 killed, 0 survived, 0 never applied, 2 comment-only
  controls survived** (3 survived the first pass and all three were this hop).
  **One older guard was re-anchored, not appeased**: the ban on the harness
  reaching the build route was the bare prefix `/api/site/build`, which
  `/api/site/build-health` contains — the recorded "a needle that can match a
  LONGER NAME cannot prove a class", met from the forbidding side, reporting a
  free read-only probe as the paid route that makes a whole site. It ends at a
  path boundary now and the observer is proved alive in both directions.

**AND A SESSION CANNOT PRESS THE BUTTON — MEASURED 2026-09-15, and it decides
what a live check can promise.** Every paid harness here is `workflow_dispatch`
only, by the standing rule that a default which could run it by accident would
make the expensive thing the default. A dispatch needs GitHub's **`actions:
write`**, and the session's GitHub App does not have it: the MCP tool and a
direct REST POST with the right endpoint, headers and body both answer **`403
Resource not accessible by integration`**, `GH_TOKEN` and `GITHUB_TOKEN` are the
SAME credential, and the installation's permissions read back empty. **The three
ways round are all forbidden** — asking for the service key (the owner ruled it
out), adding a push trigger to a money-spending workflow (inventing the
accidental-spend door that workflow exists to close), or running the harness
locally (same key). **So a live paid check is the OWNER'S press, always**, and
what a session can do is everything up to it: merge, deploy, verify both halves
of which-code-is-answering, record the baseline, and leave the dispatch armed
with `expect_deploy` and `expect_image` filled in so the press cannot test the
wrong build. Plan the work that way rather than discovering it at the end.

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

Each of these is shipped and live. What is kept is the RULE and the NUMBERS; the
story of how each got there is in `git show a4d0f5e5:CLAUDE.md`.

- **THERE IS A THIRD VIEW: `agents`, the agent builder** (2026-09-15, owner: *"under
  the A for the profile thing, put agent builder"*). A profile-menu row opens it,
  `renderAgents` draws it, and it is a view in THIS app rather than a page on the agent
  Worker's own domain — which would have meant a second sign-in to reach a menu item.
  **ITS LIST LIVED IN `localStorage` FOR ONE DAY** and is on the account now — the
  section below has the storage. **`AGENTS_KEY` STAYS ON THE ACCOUNT-SWITCH WIPE
  LIST**: localStorage belongs to the browser, not the account, so without it the next
  person signing in on this machine inherits the last one's written instructions, and
  that is now doubly true because those records are what the import offers.
  **A ROW OPENS THE CONVERSATION; the instructions are behind the pencil**, and the
  row's preview line is the last message once there is one. **NOTHING PRETENDS TO
  ANSWER**: no model is wired to it, so there is no bubble from the agent — not even
  one saying so — because a reply that is not a reply is the dead control that ANSWERS,
  wrongly. The thread says it under the box before you send.
  **`AGENT_THREAD_MAX` (200) STOPPED BEING A STORAGE BOUND** and is the number the
  IMPORT may carry: the server bounds the thread READ (`MAX_THREAD` 500, newest first
  and turned round), so the browser's own cap now governs the one place it still
  decides how much it hands over.
- **THE AGENT BUILDER'S AGENTS ARE ON THE ACCOUNT (2026-09-15).** The screen kept
  them in `localStorage` for one day; they live in the `agent` schema now —
  `agent.agents` and `agent.agent_messages`, **separate from `agent.runs` and
  `agent.run_entries` by construction**, with no foreign key between the halves:
  one is mutable prose somebody wrote and edits, the other an append-only fenced
  journal of work that ran. Seven operations under `/api/agent/*`, and
  `agent-store.mjs` (root, dependency-free, on the Dockerfile's COPY line) owns
  all of them.
- **RLS IS THE BELT AND THE URL FILTER IS THE WALL, and only saying so keeps them
  apart.** Policies on both tables key on `agent.tenant_id()`, which reads the
  request's own JWT — that protects the `authenticated` role. It protects nothing
  on this path: `service_role` carries BYPASSRLS, so the only thing between one
  customer and another's written instructions is `tenant_id=eq.` in the query
  `worker.js` sends. **A suite that only ever signs in as one account cannot see
  that**, so most of the guards read the REQUEST THAT WENT OUT rather than the
  answer that came back. Its consequence is the shape of `update`, `remove` and
  `ownsAgent`: the tenant is in the FILTER, so "somebody else's id" and "an id
  that does not exist" are one answer (no rows) and one 404 — a stranger cannot
  confirm that another account's agent exists.
- **THE TENANT IS `authUser(request).id` AND NOTHING ELSE.** No route reads an
  account, uid, owner or tenant off the body or the query string, asserted as a
  census over the handler's own reads; an unreadable tenant REFUSES rather than
  running an unfiltered query. The block is gated ONCE, above all seven, which is
  stricter than seven gates — an eighth route cannot be added ungated because
  there is nowhere to add it that is not already behind it.
- **A REPLY IS IMPOSSIBLE RATHER THAN ABSENT.** `check (role = 'user')` on the
  column, and no `role` is ever sent — not by the store, not by the handler, not
  by the import. Saving a message does not pretend to execute anything.
- **`agent.agent_overview` IS A VIEW, AND `security_invoker = true` IS THE WHOLE
  SAFETY ARGUMENT** — without it the view runs as its OWNER and is a hole through
  the RLS on both base tables. PostgREST can embed a child relation with its own
  order and limit, which would have done this with no migration; it is not used
  because **nothing here can run PostgREST**, so that query could only be asserted
  from documentation. A view is plain SQL and `test/integration/pg-schema.mjs`
  drives it on a real PostgreSQL. Dropping the option turns five checks red.
- **`agent.import_agent` IS ONE TRANSACTION BECAUSE THE IMPORT CAN BE PRESSED
  TWICE.** The local store is never deleted, so a loop of inserts would leave half
  an agent or a second copy of a whole one. `execute` revoked from `public` and
  granted to `service_role` alone — it takes the tenant as an argument, and that
  grant is the only reason a tenant argument is safe.
- **NOTHING DELETES WHAT SOMEBODY TYPED INTO A BROWSER.** The legacy agents are
  OFFERED with a count and a button, and the offer is drawn only once the server
  has answered a list for this account — uploading written instructions into an
  account that cannot be established is the one mistake here that cannot be taken
  back. An imported record is MARKED (`imported`, `importedAt`) and keeps every
  field it had. `AGENTS_KEY` stays on the account-switch wipe list.
- **A FAILED READ IS NOT AN EMPTY ACCOUNT AND A FAILED SAVE KEEPS THE WORDS.**
  `null` for "not asked yet" against `[]` for "this account has none" is what
  makes loading, empty and failed three screens; a failed read leaves the rows it
  had. The composer is rebuilt from `innerHTML`, so a draft living only in the DOM
  would be wiped by the very re-render that shows the error — `agentDraft` is
  written before anything can fail and is read back for the agent it was typed
  against.
- **MEASURED**: caps are the columns' own check constraints, read back out of the
  migration by the guard (200 / 8000 / 8000); `MAX_AGENTS` 200, `MAX_THREAD` 500
  newest-first-then-reversed, `MAX_IMPORT_MESSAGES` 200 asserted at or under the
  function's own 500, `MAX_IMPORT_BODY` 2 MB and only the import may carry it.
  Real PostgreSQL 16: **185 → 243 checks, 0 failed**. Suite **6,532**.
  **Sweep: 48 mutants, 48 killed, 0 survived, 0 never applied, 2 comment-only
  controls survived** — five survived pass 1 and **every one was a gap in the new
  guards, not the product's**: the store's own "matched no row" branches (every
  other case drove a FAKE store, so `update`/`remove` answering a row for zero
  matches was invisible), a fixture passing the same id as `newId` and as the body
  (the recorded "too shallow to separate the two readings"), `agentBodyMax` never
  driven per path, and a speaker the HANDLER could add before the store saw it.
- **SIX OLDER GUARDS RE-ANCHORED, NOT APPEASED**, and two of them are a class
  worth naming: `client-routes` and `wiring` both resolve a route by finding its
  literal in `worker.js`, and **a route family dispatched from an IMPORTED list
  has no literal there** — four working routes came back as dead client calls, a
  false alarm on correct code. Both ask both places now, and the module's list is
  admitted ONLY because the dispatch itself is asserted. The same premise cost
  `api-auth` the opposite mistake: it found `/api/agent/import` inside a ternary,
  read it as a dispatch point whose gate must FOLLOW, and reported a gated route
  as open — fixed in the code (`agentBodyMax(path)`) rather than in the guard,
  and a new case covers the whole family, because a route family invisible to
  that census is the silent direction.
- **NOT PROVEN LIVE.** The migrations are applied and the four relations resolve
  in PostgREST's schema cache (`42501`, the schema-grant wall, not `PGRST202/205`).
  Nothing else has run against the deployed Worker: the two-account check needs a
  merge, because there is one Worker and `deploy.yml` is the only way to it.
#### …AND FOUR DEFECTS IN IT, EACH REPRODUCED BEFORE IT WAS FIXED (2026-09-15)

Owner, on PR #929: *"Fix DELETE schema selection… Make imports safe to retry…
Preserve legacy local agents safely… Keep delayed responses in their original
conversation."* Every one was driven before and after; none is a source read.

1. **THE DELETE COULD NEVER HAVE WORKED, AND THE GUARD WRITTEN FOR IT ASSERTED
   THE DEFECT AS CORRECT.** `req` took a `write` option and `remove` omitted it,
   so the DELETE went out with `Accept-Profile`, which **PostgREST ignores on a
   write** — it resolved against `public`, where `agents` does not exist.
   MEASURED off the store, per verb: eight requests carried `content-profile` or
   `accept-profile` correctly and the DELETE alone carried the read header. The
   guard's own comment explained why that was fine — *"the DELETE is the one
   write with no body and therefore no content-profile to set"* — and that
   reasoning is wrong: **the profile names the RELATION, not a body.** Derived
   from the VERB now (`WRITE_VERBS`), so there is no option left for a call site
   to forget, and the guard is a census over every request the store can make
   with the read and the DELETE both proved present.
2. **ATOMIC IS NOT IDEMPOTENT.** `import_agent` closed the half-imported agent
   and left the one beside it open: the agent is created, the ANSWER is lost, and
   from the browser that is indistinguishable from a request that never arrived —
   so the obvious second press made a second agent with a second copy of the
   conversation. The identity is the browser's own record id, which every legacy
   record already carries and which is stable across retries, **scoped by tenant
   and enforced by a partial unique index** on `(tenant_id, import_key)`.
   `on conflict … do nothing` then the read, so two presses racing both answer the
   winner's id; the message loop is skipped on that path, because answering the
   right id while re-running it doubles the conversation on every retry — the
   defect in a different hat. **The four-argument signature is DROPPED, not left
   as an overload**: Postgres would keep both and a caller that forgot the key
   would silently get the one with no identity at all. The API REQUIRES a key
   (`cleanImportKey`, the tenant's charset rather than `cleanId`, because the
   oldest records carry `String(Date.now()) + Math.random().toString(16)` and
   turning exactly those away would strand the ones most worth preserving).
3. **THE ACCOUNT SWITCH STILL DELETED WHAT SOMEBODY TYPED**, and a guard demanded
   it. `AGENTS_KEY` was on `enterApp`'s wipe list, which satisfies "the next
   account must not see them" by destroying the only copy of agents written
   before this screen had an account behind it. **The property was never "delete
   them"; it is "show them only to the account they own"**, which is a filter:
   the switch STAMPS every unstamped record with the OUTGOING uid — the one
   moment that identity is known — and `agentsLocal` answers only what the
   current account owns, `[]` with nobody signed in. **AND THE SENTENCE THAT USED
   TO CLOSE THIS PARAGRAPH WAS FALSE**: it read *"unstamped means 'never been
   through a switch', which can only be the current account's"*, which `doSignOut`
   falsifies by erasing the marker. The fifth finding below is that hole; the
   claim now runs on every sign-in, takes the MARKER, and an unstamped record is
   shown to nobody. `agentMarkImported`
   maps over the WHOLE store, never the filtered view: mapping the view and
   writing it back is the wipe returning through the back door, inside the
   function whose job is to preserve.
4. **A DELAYED ANSWER LANDED WHEREVER THE SCREEN HAD GOT TO.** `agentSend`
   captured nothing, so a message typed into A appeared in B — a message nobody
   sent, in a conversation somebody was reading — and a failure for A put a red
   sentence under B's box. `agentBind()` is taken before the request and
   `agentSame`/`agentSameEdit` asked after it, comparing **both the conversation
   and the ACCOUNT**; nothing that fails may write. The message draft is keyed by
   agent (`agentMsgDrafts`) rather than one string for the screen, so A's unsent
   words wait in A. The same wall is on the thread read, the list read, the save,
   the delete and the import — including the import's THROW path, which had none.
   **A refused answer never means the work failed**: it is saved, and appears the
   next time that conversation is opened.

**Guards**: `test/agent-binding.test.mjs` (**19**, new) loads `public/chat.js`
the way the browser does — the page's own script list, derived from `index.html`
— and drives the real functions with responses it can hold open, release, and
land after moving the screen. Two fixture traps paid for on the way in: **a
classic script's `let`/`const` are NOT properties of the global object** (four
cases passed VACUOUSLY reading their own writes back off the sandbox), and **an
array built inside a vm has that realm's `Array.prototype`**, which
`assert.deepEqual` rejects — correct code failing with a message about the value.
`agent-api` 41 → 42, and six older guards re-anchored.

**Sweep: 26 mutants, 26 killed, 0 survived, 0 never applied, 2 comment-only
controls survived.** Four survived pass 1; three were guard gaps and **one was
INERT and is recorded rather than hunted**: the import loop's top-of-iteration
account check cannot differ from the one below the request, because nothing
between them awaits. The wall that CAN be driven was kept, and writing the
measurement down found a real gap next to it — the `catch` had no check at all.
Plus **three SQL mutants on a real PostgreSQL**, all caught: a retry that raises,
a retry that re-inserts the conversation, and an identity not scoped to the
tenant.
#### …AND THE FIFTH: WHOSE THE LEGACY RECORDS ARE, ACROSS A SIGN-OUT (2026-09-15)

Owner: *"`doSignOut()` removes `zephyr_owner_v1` without first assigning
ownership to unstamped legacy agents. `agentsLocal()` then allows unstamped
records through for any signed-in account… Unknown ownership must mean hidden
and not importable — not 'belongs to whoever signs in next.'"*

**FINDING 3 ABOVE WAS HALF A FIX AND ITS OWN REASONING NAMED THE HOLE.** It
said unstamped means "never been through a switch, which can only be the current
account's" — and `doSignOut` erases the marker that carries the outgoing
identity, so after one sign-out every one of A's records is unstamped with
nothing left to place them. B signs in, sees them, and the import copies them
into B's account for good. **A rule true because of a layer below it expires
when that layer moves**, where the layer is the sign-out three hundred lines
away in the same file.

**THE MARKER IS THE ONE AUTHORITY, EVERYWHERE, and that is the whole design.**
`zephyr_owner_v1` is the only thing in a browser that says which account was
last in it, so it is the only thing that can establish whose an unstamped legacy
record is. Both doors now read it and neither reads who is present:

- **`enterApp`** — `prevOwner ? agentsClaimFor(prevOwner) : agentsSealUnknown()`,
  ABOVE the `setItem` that moves the marker. Claiming for the arriving `uid`
  instead is the bug through a different door, and it is one of the sweep's
  mutants. **The claim now runs for EVERY sign-in**, not only a switch: the
  ordinary upgrade is the same person with records written before this code
  stamped anything, and it needs the claim as much as a switch does.
- **`doSignOut`** — the claim runs BEFORE the wipe (`Auth.signOut()` is below it,
  so the identity still exists), and it takes the MARKER rather than
  `Auth.userId()`. **The two can disagree and the case that separates them is
  driven**: a browser whose store refused the boot's write is signed in as B with
  the marker still naming A, and the unstamped records really are A's.

**AND THE MARKER NEVER MOVES AHEAD OF THE OWNERSHIP RECORD.** `agentsStore`
READS THE VALUE BACK rather than trusting `setItem`, so `agentsClaimFor` and
`agentsSealUnknown` answer whether the write landed; `enterApp` gates the marker
write on that, and `doSignOut` KEEPS the marker when the claim failed — it is
the only other place the answer exists, and erasing it would lose it. **Nothing
is exposed either way**, because the reader is an exact match. **The cost is
stated in the code**: while that write keeps failing, every reload re-runs the
cache wipe (those keys are caches; the price is re-fetching them).

**`agentOwns(a, uid)` IS THE ONE PREDICATE — `!!uid && !!a && a.uid === uid`.**
No pass for an unstamped record, and the direction is deliberate: the cost of
being wrong here is somebody having to write an agent again, against one person
reading another's written instructions.

**`AGENT_OWNER_UNKNOWN` (`'?unknown'`) IS A VALUE, NOT AN ABSENCE, AND THAT IS
THE POINT.** An unclaimed record can still be claimed by whatever next
establishes an identity; a SEALED one can never be, because no uuid equals
`?unknown`. Without it the seal would be laundered one sign-in later: this
visit's own marker would read as "the same account as last time". **The seal is
permanent** — `agentsClaimFor` never overwrites a stamp.
**THE COST, STATED: a browser whose last sign-out ran the old code has no marker,
so its records are preserved and PERMANENTLY HIDDEN, from everyone including the
person who wrote them.** That is the requirement met rather than a regression.

**THE IMPORT ASKS THE SAME PREDICATE AT THE POINT IT WOULD SEND, and it is not a
second copy of anything.** `agentImport` reads `agentsStored()` — the store, not
the offer — and asks `agentOwns(a, agentUid())` per record. The list asks "what
may I show"; this asks "may I send THIS", and they are different questions with
different consequences. **It is NOT redundant with the binding check** (`bound.uid
!== agentUid()`, which asks whether the account changed since the press):
measured, signed in as B with A's records in the browser, the binding check is
satisfied from the first line to the last and the ownership test is the only
refusal. **Silent, deliberately** — naming the skips would tell the person that
another account has records in this browser, which is what the filter exists to
prevent.

**Guards**: `test/agent-binding.test.mjs` **19 → 27**, all eight driving the
page's real boot and the real `doSignOut` (a second `loadScreen` over the same
`store` IS the reload a sign-out ends with, so the sequence under test is the one
a person performs). The four the owner named, plus: B arriving on A's browser
with no sign-out, the sign-out's marker-versus-present authority, the refused
write in BOTH shapes a browser really refuses (`QuotaExceededError`, and a write
accepted that does not persist — only the read-back sees the second), and the
control that a working store DOES forget the account. **Each import case asserts
the action had a record in hand** (`agentsStored().filter(r => !r.imported)`),
because "nothing was sent" is a negative assertion.

**Three older guards re-anchored, not appeased, and TWO WERE BYTE WINDOWS OUTRUN
BY THIS CHANGE'S OWN PARAGRAPHS** — the recorded trap, twice in one change:
`agent-builder-view`'s `branch.slice(0, 1800)` and `media-deleted`'s
`slice(i - 1200, i)` both stopped finding calls that had not moved. Both window
landmark-to-landmark now. The third is the one that matters: the view guard was
pinned to `/!a\.uid \|\| a\.uid === uid/` — **it asserted the defect as
correct**, which is the same shape as finding 1's guard above, and it reads the
property (`agentOwns` exact, no unstamped pass, no signed-out pass) now.
`media-deleted`'s owner-key census moved off "the marker is in sign-out's wipe
list" and onto the ORDER: the claim occurs before the removal.

**Sweep: 17 mutants, 17 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** — the reader passing an unstamped record (the defect itself),
the reader unfiltered, a marker-less browser claimed for whoever arrived, one left
unstamped rather than sealed, the boot claiming for `uid` instead of the marker,
the marker moving with ownership unrecorded, the seal stamping nothing, the claim
re-assigning an owned record, the claim answering true over a refused write, the
store trusting `setItem`, sign-out not claiming at all, sign-out claiming for
`Auth.userId()`, sign-out forgetting the account unconditionally, the marker back
in the unconditional wipe list, the import's ownership test dropped, the import
asking `!a.uid` instead (so a SEALED record is sent), and the offer counting the
store. **Suite 6,560** — 6,552 + 8, and the arithmetic closes exactly.

**AND THE SWEEP RAN TWICE BECAUSE THE FIRST TALLY WAS NOT TRUSTWORTHY — the
recorded "A CONTROL MUST BE DECLARED, NOT MERELY LABELLED", met again.** The
runner reads `m.control`; the spec said `isControl`, so both controls were run as
ordinary mutants, printed as SURVIVORS, tallied `0 comment-only controls`, and the
runner's own `CONTROL WAS KILLED` branch — its one check on its own honesty — was
never armed. The 17 product mutants died on both passes; the tally above is one
run's own answer, which is the only kind worth stamping.

**NOT PROVEN LIVE.** Every measurement is from driving `public/chat.js` in a real
page scope; nothing is merged or deployed.
- **ADDING A VIEW NOW MEANS SATISFYING A PROPERTY, NOT A COUNT.**
  `test/media-deleted.test.mjs` pinned `KNOWN_VIEWS` to exactly `["settings","sites"]`,
  which was bought by a survivor that added `viewGallery` back — a door to a screen whose
  renderer was deleted. Freezing the count protected that and failed identically for
  every later view, dead or alive; the agent builder was the first legitimate addition
  and showed the difference. It now forbids the deleted media views BY NAME, forbids
  `home`/`landing` (aliases `showView` resolves, never views — listing one paints an
  empty main), and requires **every** known view to have a `render…` call, which catches
  a door-to-nothing under any name. Re-anchored, not appeased: proved against three
  breakages — gallery restored, a view with no renderer, `home` listed as a view.
  Suite **6,483** (6,481 pass, 2 skipped); the agent builder's own guard holds 7 of them.
- **TYPING IN THE START BOX IS A FRESH BUILD, NEVER A REVISE** (owner). Three
  conditions, each a refusal to guess: the DESIGNER chose the name, the chat is
  POSITIVELY known to own no site (`mine === null`, never truthiness — a blip
  must not buy a second paid site), and the name is held BY US. The trailing
  number is REPLACED, not stacked. Settled at the SLUG, above `env.JOB_SCOPE`.
- **A FAILED BUILD REVERSES ITS DESIGN CHARGE.** Both conditions: our fault AND
  no live site, since a salvaged build was delivered. The collector has no
  ledger, so it reverses BY REF (`REVERSE_WHOLE` is a CEILING, never an amount).
  `ok` is the only field separating "nothing to reverse" from "could not".
- **RULE 7 NAMES `SafeImage`'s MODULE.** It orders `<SafeImage>` on every picture
  and never said where it comes from — the one component the rules make MANDATORY
  is the one whose path may never arrive, and a missing module is the one class
  `vite` cannot bundle around. `repairImports` also rewrites a `@/components/…`
  path naming no file to the one kit module exporting what is imported — **2,385
  of 2,412 exported names belong to exactly one module** — and refuses to guess
  three ways. **Zero false alarms over 3,736 real files.**
- **ALL FIFTEEN REMOVABLE LANES CAN BE TAKEN OFF, not nine.** The removal verb
  lived inside `eLayer === "look"`, so six dispatching lanes never reached it:
  nothing failed and the STORED field kept saying the site had the thing.
  `DOOR_LAYERS` is derived from the two meanings collapsed into one constant.
  **`page` is NOT widened and must never be** — `remove` there deletes the page.
- **THE PREVIEW PANEL RUNS THE SITE'S OWN JAVASCRIPT.** `frameSandbox(url)`
  decides per URL and FAILS CLOSED: our own origin keeps the tight flags, because
  `allow-scripts allow-same-origin` on a frame same-origin with the app can reach
  in and take its own sandbox off. The start screen's thumbnails stay tight
  deliberately — 51 sites is 51 React bundles to paint 51 postage stamps.
- **THE BUILDER PICKER REACHES THE ROUTING CALL** and sits on the START SCREEN,
  which is where the first build is asked for. `siteRoute` had been posting
  without it, so every routing call ran on the default whatever the customer
  chose. The effort dial is PARKED, with the three lines that restore it.
- **A PROJECT HAS AN ADDRESS** — `gofarther.dev/projects/<id>`. Not the slug: a
  slug is renameable and does not exist until the build finishes, which is the
  eight-minute window where a stable address is worth most. `openProject(id,
  mode)` is the ONE way either screen opens; an id naming nothing corrects the
  address rather than lying.
- **A LIVE WIRE IS GREEN** (`--wire-live: #00c853`). The app's wire is always
  false, written as a value rather than omitted so the day a mobile app owns a
  database it is a change somebody makes on purpose.
- **A PUBLISHED SITE'S RUNTIME ERRORS REACH THE PREVIEW PANEL.** Every generated
  site posts `isibi:runtime-error` to `window.parent`; the panel only ever read
  `__siteErr`. The half that DID work (`errShim`) covers the blob DRAFT preview
  only, so a published site framed at its own URL had no reporter — **the
  ordinary case**. The general shape: *two halves built to meet and not wired,
  where the working half covers the case anybody testing would look at.* **THE
  WIRE STRING STAYS `isibi:runtime-error`** — every site published before today
  bakes that literal into its frozen bundle. It is on the do-not-rename table,
  with `isibi-marquee`, and **the brand scan's exemption is DERIVED from that
  table**: a file shipping a protected name is shipping DATA.
- **THE PHOTOGRAPH PIPELINE OPERATES ON THE FILES THE MODEL WROTE, NOT ON
  `pages`.** The model writes `@@IMG:…@@` into the `src`; a later step swaps each
  for a URL. **Five steps did that work and every one read `pages`** — so a
  band-split build's PARTS were never planned, bought, counted or SWEPT, and the
  token shipped into the bundle as a literal the page drew as alt text.
  **MEASURED live: 11 `SafeImage`s, 9 correct and 2 raw `<img>` carrying the
  token.** Cost one 30-credit build. `imageSources(pages, parts)` is the ONE
  reader, so a sixth step asks it and cannot forget; **it is for READING only**,
  because `applyImages` writes each file back into the list it came from — never
  over the union sliced apart by length, which is how a fix of this shape breaks
  again in silence. **`lintPages` is deliberately NOT widened**: measured over the
  100-site corpus (324 files) a page presented at a part path produces **322
  findings against 222**, the 100 extra all one rule. **Open.**
- **THE SEO & SOCIAL TAB SHOWS THE SITE'S REAL HEAD.** It was eleven lines of
  hardcoded markup stating **three false facts about the customer's own
  business** — a `— built with Go Farther` suffix no site has ever served, grey
  prose where a real description was stored, and "Generate · soon" for a card the
  container has composed for weeks. **A step past the dead-control finding**: a
  dead control does nothing; this one ANSWERED, wrongly. **THE SPLIT IS
  `site-runtime.ts`'s OWN**: `description` and `image` are PUBLISH-TIME and live
  in the R2 sidecar, so **patching that one key IS the deployment** — no
  container, no compile, no credits; `title` is BUILD-TIME, baked as `SITE_NAME`.
  **THE TITLE IS DELIBERATELY READ-ONLY**: `SITE_NAME` paints the header, the
  share card and `og:site_name`, so an override reaching only `<title>` desyncs
  four things. `MAX_HEAD_DESCRIPTION` **300, DERIVED** from the publish path's own
  slice; `GOOD_DESCRIPTION` 50–160 is **advisory only**; `cleanHeadDescription`
  REFUSES a non-string instead of coercing; `pickableImages`' two filters are both
  load-bearing (a stranger's upload must never become the business's preview; an
  og:image at a PDF renders NOTHING, silently). The POST **READS AND MERGES the
  look** — `withConfig` replaces a named field WHOLE, so a bare `{look:
  {description}}` strips the theme, brand, mark and every language.
  **AND THE APP'S OWN `img-src` REFUSED THE CARD** — this panel is the first
  thing to put a SITE's origin in front of the app's browser, and **a CSP refusal
  on an `<img>` is silent**. `https://*.<SITE_ZONE>` joins `img-src`, derived the
  way `frame-src` already derives the same wildcard — **so the app already runs
  those origins' SCRIPTS in a frame, and an image is strictly less capable**.
  `connect-src` is deliberately NOT widened; the published site's CSP is
  untouched. **A FALSE BELIEF ABOUT CSP NEARLY WENT INTO THE GUARD**: a real
  `*.host` source matches ANY subdomain depth. The matcher is deliberately ONE
  label, which is the SAFE direction — it can report a refusal a browser would
  allow and can never report an admission a browser would refuse.
- **HOW FULL THE MODEL'S CONTEXT WINDOW GETS** — More → Model context. **It
  answers what the NEXT call carries, not only what the last one did**, which is
  why it has anything to draw: a historical-only panel is empty on all 51 sites.
  **MEASURED: first build 64,115 chars of tool + 1,962 system ≈ 22,070 tokens; a
  revise 93,637 + 1,962 ≈ 32,718** — **2.2% of Claude's window and 4.4% of
  Grok's**. **The design tool is 96.8% of that call and the customer's brief is
  0.2%.** Built from `designRequest`, lifted out so the panel weighs the real
  object. **The total is EXACT and the parts are ESTIMATED, and the report says
  which** — characters at this repo's own 3:1, SCALED to the provider's real
  input total. **All three input kinds count**: billing prices a cached read at a
  tenth, the window does not care. **AN UNKNOWN MODEL HAS NO PERCENTAGE** —
  never of a guessed denominator and never 0%. **The bar is a fill gauge against
  the window**, and drawn as composition alone every row read 100% full whatever
  the model — the picture and the figure said opposite things, and only a render
  could see it. The resulting sliver IS the finding; a minimum band width would
  make every row legible by making every row a lie.
- **THE PLATFORM KNOWS WHAT EACH MODEL WILL ACCEPT.** Read from the providers'
  own docs — **these move, so re-read rather than trusting this table**:

  | model | context | max output | $ / MTok in · out |
  |---|---|---|---|
  | `grok-4.6` (default) | **500K** | **no stated limit** | $2 · $6 |
  | `claude-sonnet-5` | **1M** | 128K | $2 · $10 |
  | `claude-opus-5` | **1M** | 128K | $5 · $25 |

  **CONTEXT IS NOT A CONSTRAINT ANYWHERE TODAY**: the biggest thing sent is
  ~20,000 tokens against a 500,000 floor — 25× headroom on the smallest.
  **The wall a build meets is the WIRE.** Every `*_MAX_TOKENS` is an OUTPUT
  ceiling; not one is an input bound. **KEYED BY MODEL ID, NEVER BY PICKER** —
  `design` and `pages` are separate entries, so a limit hung on the picker is
  wrong for one of them the day a mixed picker exists. **THREE STATES FOR AN
  OUTPUT LIMIT**: a number, **`Infinity`** (a provider that states none), `null`
  (no row). Writing "no limit" as null too would be two nulls meaning opposite
  things. **An unknown model answers `null` and never 0.** Nothing reads it yet
  and that is the owner's call — know the number, spend it second. **The guard
  with teeth**: every ceiling the platform really sends must fit inside the
  SMALLEST `maxOutput` any picker can reach — the largest sent is 30,000 against
  a floor of 128,000. **The floor is asserted FINITE**, or taking the MAX by
  mistake makes it `Infinity` and the check says nothing while staying green.
- **NO GUTTER BETWEEN THE CHAT AND THE PREVIEW.** `.st-body`'s `gap: .8rem` was
  **12.8px** of page background between two cards that are one workspace. **The
  visible gutter IS the flex gap**, because at `data-dev="desktop"` `.st-frame`
  is `width: 100%`. 12.8 → 0, and **the preview gains all of it** (825.2 → 838px
  at 1320px). It only ever separated those two: the mobile panel is
  `position: absolute` and was never a flex item.
- **THE PAGE LIST ONLY EVER EXISTED IN THE BROWSER THAT BUILT THE SITE.**
  `sitePages` reads `site.pages` out of localStorage; a site adopted off
  `/api/site/list` has none, so every page but the home page was unreachable in
  the preview on every other machine. **Nothing failed and nothing logged** — a
  label is a correct rendering of an empty list. **TWO READERS OF THAT EMPTY
  LIST, and the second is the tell**: the subtitle also said "Previewing last
  saved version" on a three-page site. `GET /api/site/routes?slug=` is its own
  route because `/api/site/source` hands back **489,100 bytes** to answer a
  dropdown; both read one store through one reader. **PATHS ONLY** — the browser
  composes display names, so a second composer on the wire would be two lists of
  one thing. **Measured cost: the bar settles ~39px once** per adopted site.
  **OPEN**: the preview frame runs the site's own JS, so a click inside it really
  navigates and nothing tells the picker or the URL chip.
- **PUBLISH IS A DOOR ON THE WORKSPACE BAR, AND IT IS NOT THE BUTTON THAT WAS
  DELETED.** The old one was drawn `isReact ? '' : …` — it appeared ONLY on a
  project that had never built, the single state in which it had nothing to open.
  This one is gated on `site.slug`. **It is not a dead control**: three working
  actions behind it (the live URL, Copy link, Take offline / Put back online) and
  one true sentence saying every change goes live on its own. **The title carries
  the honesty, because the label cannot.** DIMMED rather than hidden before the
  first build. **No state is read at the bar, deliberately** — the panel's own
  copy is better (`SiteList.offlineFor` prefers the server's answer).
- **THE REFRESH BUTTON DID NOTHING ON ANY REAL SITE, AND IT IS THE PUBLISH
  BUTTON'S DEFECT ONE CONTROL LEFT.** `if (f && curHtml)` is the STATIC path, and
  a React site's pages are written `html: ''`. **Two instances in one bar in one
  night says the class is worth its own sweep**: every handler still gated on
  `curHtml` or `site.html` against a render that asks `isReact`. **Not done.**
  **The bump is not cosmetic** — assigning `fr.src` a value it already holds does
  not reload an iframe, so a re-point without moving `previewV` is a second dead
  button. A refresh clears the collected preview errors. **The legacy branch is
  KEPT** — it is what a site with stored HTML is for. `sitePreviewSrc` is the ONE
  expression (it was written inline twice and this needed a third).
- **THE WHOLE RIGHT-HAND GROUP IS PREVIEW-ONLY.** Both side groups are
  `flex: 1 1 0` and split to min-content, so a block REMOVED on a view change
  moves the centred tabs at every width — the bug three earlier attempts had to
  learn. The four wear `st-tb-pv-off`: **`visibility: hidden`, never
  `display: none`**. ONE wrapper, not four classes, because four separately
  hidden children still collapse the gaps between them. **MEASURED across six
  widths (1024–1920): 0.00px tab shift**, the group 375.4px in both views. **The
  bar's wrapping below ~1180px is pre-existing** (48.97px at 1180+, 57.19 at
  1100, 71.19 at 1024, 85.19 at 960 — byte-identical before and after). **One
  cost, named**: the whole-project Download leaves the Code tab, where you would
  most want it.


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

### EVERY RUNG RUNS IN THE SITE'S CONTAINER, AND THE CONTAINER HAS NO CLOCK

Owner, 2026-09-14: *"addon, edit and build gotta run on the container, just like
the build path"* → ***"Containers shouldn't have a time limit."***

**THE CLOCK WAS THE TRAP IN THE MONEY PATH.** `EDIT_JOB_MS` is 840,000 —
fourteen minutes, and every word of its reasoning is about a Cloudflare ISOLATE
(`CONSUMER_CEILING_MS` stops a consumer at fifteen). Inside the container there
is no such ceiling. Builds moved across on 2026-09-06 and got their own pair;
the edit branch was wired the same day and **passed no budget at all**, so it
fell back to the Worker's number. *A rule true because of a layer below it
expires when that layer moves* — fourth recorded time, first in the path that
spends money. It cost run 44 an addon at 12m22s with the database made, the page
written and nothing published.

**EVERY LIMIT ON A CONTAINER JOB HERE IS OURS.** There is no platform ceiling to
fit inside, so the only question is what each bound is FOR — and "how long the
work may take" turned out not to be one of the answers.

| bound | now | what it governs |
|---|---|---|
| `CONTAINER_*_BUDGET_MS` | **`Infinity`** | the WORK — `expired()`, `spendable()`, every gate |
| `CONTAINER_EDIT_JOB_MS` / `BUILD_JOB_MS` | **50 min** | the token's life; SIGTERM to a wedged child |
| `MAX_BUSY_HOLD_MS` | **52.5 min, derived** | how long a BUSY container is held — the bill |
| per call: `STEP_TIMEOUT` 30 min, `CONTAINER_CALL_MS`/`BUILDER_CALL_MS` 600 s, `QUICK_STREAM_MS` 480 s, `QUICK_CALL_MS` 240 s | unchanged | each model call and each subprocess |

**THE LEASE IS A LIVENESS CHECK AND NOT A DURATION CAP** — this is what makes
the removal safe rather than merely permitted. `edit_sweep_lost` selects on
`lease_expires_at < now() - p_grace` and **never on elapsed**, `LEASE_TTL_S` 90,
`HEARTBEAT_S` 30. A job that keeps beating is NEVER swept however long it runs;
a job that dies is reclaimed in ~90 seconds. What the lease cannot see is a
process that is alive, heartbeating and looping — our own bug — and that is the
one thing the deadline is for, beside the credential.

**FIFTY MINUTES IS A LIVE RPC, NOT A PREFERENCE.** `HANDOFF_TTL_S` is DERIVED as
`MAX_BUSY_HOLD_MS / 1000` and `edit_handoff` raises `bad ttl` past **3600 s**, so
`deadline + JOB_KILL_GRACE_MS + JOB_TERM_GRACE_MS + 60s ≤ 3600s` caps the
deadline at **57.5 minutes**. Fifty leaves 450 seconds. **Lifting it is a
migration**, not a constant this repo can move.

**`MAX_BUSY_HOLD_MS` WAS A SHIPPED DEFECT.** It was 30 minutes while
`BUILD_JOB_MS` was ALSO 30, and the build service stops a child at its deadline
+ `JOB_KILL_GRACE_MS` (60 s) and kills it `JOB_TERM_GRACE_MS` (30 s) later — so
a job that ran to its deadline had its CONTAINER stopped a minute BEFORE the
SIGTERM that lets it end as a job. **The graceful path was unreachable at exactly
the moment it exists for**, and the symptom would read as the container crashing.
DERIVED now: **deadline 50.0 → SIGTERM 51.0 → SIGKILL 51.5, hold ends 52.5.**

**`Infinity` IS A STATED ANSWER AND BOTH READERS REFUSED IT** — the recorded
"cannot-tell must never read as a value" with the two swapped.
`Number.isFinite(Infinity)` is false, so `inlineBudgetMs` handed the container's
own "no clock" want `EDIT_JOB_MS` and `makeBudget` handed it `BUILD_BUDGET_MS`,
**each falling back to a Worker-sized number for the one input where the default
is the MOST wrong answer available**. Both take it now — and **the clamp still
governs**: `Math.min(Infinity, left)` is `left`, so a WORKER delivery is still
bounded by what its isolate has left. **Every per-call ceiling survives it**
(`capMs` is `min(cap, room)`), which was the whole safety argument and was
asserted nowhere until it was driven.

**`builder/job-duration.mjs` IS THE ONE SETTING.** `JOB_MAX_MS`, and everything
else is `jobDurationPlan()`: `BUILD_JOB_MS`, `CONTAINER_EDIT_JOB_MS`,
`MAX_BUSY_HOLD_MS`, `HANDOFF_TTL_S`, `SITE_BUSY_DEFER_S`, the browser's
`POLL_GIVE_UP_MS`. **`readJobMaxMs(env)` reads `JOB_MAX_MINUTES` and MAY ONLY
SHORTEN** — every other number is fixed at IMPORT, so a LONGER setting moves the
deadline past all of them. **It shipped with no call site** in the first cut of
the change whose whole point was configurability; `fireContainerJob` is the one
consumer, and the guard DRIVES it because a source read cannot tell a wired
reader from an unwired one.

**THE QUEUE WAS SILENTLY SHORT.** A job behind another waited `60s × 45 = 2,700s`
in front of a job that may run **3,000** — failed before the job it waited for
could finish. `SITE_BUSY_DEFER_S` is derived now (**67 s**), because the 45 is
the database's literal and the cadence is what gives.

**`JOB_RUNNER_EVERYONE` IS `on` IN THE DEPLOY.** The canary is KEPT rather than
made decorative: it is the state the platform falls back to if the broad flag is
turned off. **Reading `deploy.yml` tells you the DEFAULT, not the deployment** —
that line is only what runs while nobody has ever SET the secret, and
`GET /api/site/runtime?slug=` is the one thing that can say which is live.

**WHAT IT COSTS**: every site's jobs share the account's container ceiling. A
fire that finds no room WAITS (`JOB_FIRE_MS`, 90 s) and the consumer then runs
the job on what is left of its own invocation. Worst case is the old behaviour
ninety seconds later, never an eviction.

### THE JOB'S MODEL CALLS TAKE THE CONTAINER'S OWN TRANSPORT

**Run 45 died at 270,025 ms with `fetch failed`** — eleven milliseconds from
`build-call.mjs`'s own recorded `model call failed after 270036 ms — socket hang
up`. `longPost` and `{stream: true}` were handed in from exactly **three call
sites, all in `build-server.mjs`**; the addon and edit page call took the
module's default — **Node's undici global `fetch`, unstreamed**. **THE FLIP IS
WHAT MADE IT REACHABLE**: that path was safe for months because it only ever ran
in workerd, and turning `JOB_RUNNER_EVERYONE` on moved it behind the container's
egress. *A rule true because of a layer below it expires when that layer moves*,
where the layer moved because we moved it.

- **`builder/long-post.mjs` is the transport**, lifted out verbatim so the JOB
  CHILD can use it. **`worker.js` must NEVER import it** — it pulls `node:http`
  in. The job env carries it (`MODEL_SEND`, `MODEL_STREAM`), so one
  `callBuilderModel` serves both sides and the Worker's path is byte for byte
  what it was.
- **TWO TRANSPORTS, TWO PROBLEMS, SEPARABLE ON PURPOSE.** undici's 300 s HEADERS
  timeout cannot be raised by an `AbortSignal` at all — that is what the
  `node:https` sender beats. A connection closed for carrying NO BYTES is what
  `stream: true` beats. Either alone leaves the other.
- **`callFailure(e)` IS THE FALSIFIER**: `error.cause.code`, the error's `name`,
  and `e.wire` — `{headersMs, chars}`. **`headersMs: -1, chars: 0` is a quiet
  connection killed by the egress, which streaming fixes; `chars > 0` is a
  LIFETIME cap, which streaming cannot.** Until this, a failed page call recorded
  one word.
- **`node:https` HAS NO TIMEOUT OF ANY KIND UNLESS ONE IS ASKED FOR** — its own
  comment. Every real model call carries `AbortSignal.timeout(callMs)`
  (`build-call.mjs`), so nothing customer-facing can hang. The probe forgot one
  and paid for it (below).

**LIVE EVIDENCE, from two stored traces on `repairbench-1`, same site, same ask,
2½ hours apart:** run 44's page call **459,465 ms → OK, 3 files** (in the
Worker); run 45's **270,025 ms → `fetch failed`** (in the container), which is
`522129 − 252104` out of the trace itself. Neither trace carries the `where`
field — it shipped after both — so the attribution rests on the durations plus
the flip landing between the deploys.

### WHERE THE JOB RAN IS RECORDED, AND THE WORKER FALLBACK IS NOT SILENT

**`runner: true` IS ELIGIBILITY, NOT EXECUTION** (the owner's own correction).
`JOB_WHERE` and `JOB_DEADLINE_AT` are set by `makeContainerEnv` and
`jobRunDetail(env)` rides the `run` mark: `{where, deadlineAt, deadlineInMs}`.
**The Worker's own answer is `"worker"` by DEFAULT**, so a record that cannot
tell reads as the Worker and never flatters itself.

`fireOutcome(fire)` splits every answer four ways, and the default is strict:

| answer | means |
|---|---|
| `fired` — **including HTTP 409** | the container has it. 409 is `/job/run`'s duplicate guard; reading it as anything else makes one job two sets of calls and two charges |
| `inline` — `off`, `no-binding`, `not-this-one` | the runner was never asked for |
| `retry` — `room:`, `fetch:`, any 5xx | transient. `FIRE_RETRY_MAX` 3, `FIRE_RETRY_MS` 2000 |
| `stop` — **everything else, unknown reasons included** | finalize 503 `no-container`, nothing charged |

**`stop` IS SAFE BECAUSE NOTHING IS SPENT BEFORE THE FIRE** — there is no reserve
to reverse, which is the whole reason a refusal can be a refusal rather than a
fallback. And the customer is told; a row that stopped without a finalize is a
poll that spins for ever.

### TWO PROBES: A JOB THAT RUNS LONG, AND A WIRE WITH NO MODEL IN IT

`builder/job-probe.mjs`, fired through **`POST|GET /api/site/job-probe`**, both
free — no model call, no credit, no row, no ledger — and both through the REAL
`/job/run` door in a real job child, because `_busy`, the launch's deadline and
the terminator armed off it are three of the things being measured.

- **`hold`** occupies a child for as long as it is asked (default **20 minutes**),
  **pulsing once a minute**. The pulse is the reading, not the final line: an
  absent final line is also what a crash produces. **It touches no row and no
  lease on purpose** — the other links are Postgres properties and are checked
  there, and **publishing is the real addon run's job**.
- **`wire`** holds two long connections in turn — **never raced**, because a
  concurrent pair leaves the reading open to "the second kept the first's path
  warm" — through the **same `node:https` sender a model call uses**. `quiet`
  sends nothing until it answers; `trickle` sends a byte every tick. **The probe
  NAMES the reading**: `idle-kill` (streaming is the fix) · `no-wall` (**the
  failure was NOT REPRODUCED — that is not the same as settling the historical
  cause**, the owner's own correction) · `lifetime-cap` (streaming cannot beat
  it) · `quiet-survived-trickle-did-not` · **`hung`**.
- **WHAT THE WIRE PROBE CANNOT ATTRIBUTE.** A dead connection looks identical
  from the container whether the container's egress killed it or the gateway
  Worker gave up holding the response. **The trickle arm is what makes that not
  matter**: same path, same endpoint, same duration, only the bytes differ — so
  `idle-kill` says the path CAN hold a connection that long and what killed the
  other was the silence, true of whichever end did it. Read it as *"silence is
  what dies"*, never as *"Cloudflare's egress did it"*.
- **THE `/wire` OP CARRIES NO DATA IN EITHER DIRECTION** — a space per tick and
  one JSON line out. **A mode nobody recognises answers `null`, never a default**:
  a `trickle` silently answered as `quiet` would report a wall never measured.
  The trickle's writer is held on `waitUntil`, or a Worker cancels it the moment
  the response returns.
- **`runJob` BRANCHES BEFORE `importWorker`** — a probe measures this process and
  its socket, and several hundred modules in front of it measure something else.
- **THE VERDICT LINE CAN FALL OFF THE WIRE.** `build-server.mjs` keeps a job's
  last five stdout lines and **slices each at 300 characters**, and that tail is
  the ONLY thing readable once the child closes. MEASURED: the whole-answer line
  for a realistic failure is **exactly 300** with `reading` last — no margin.
  **Two defences, each measured sufficient alone and the redundancy declared**:
  `reading` moved ahead of the two long rows, and a short line of its own.
- **A RUNNING RECORD HAS NO TAIL.** `build-server.mjs` writes `tail` **only in
  its `close` handler**, so `state: "running"` past the elapsed time IS the live
  duration answer; the pulse arrives with `ms`/`code`/`signal` at the end.
- **A 404 IS NOT A COMPLETION.** `GET /job/<id>` answers 404 both for an id the
  service never saw and for one whose record went with a recycled container.

**`PROBE_MAX_MS` SITS UNDER `JOB_MAX_MS`** (minus five minutes, DERIVED), so an
instrument can never hold a container longer than the work it measures — and the
caller's number is **CLAMPED rather than refused**, because an instrument that
errors on a too-big argument is one somebody re-runs smaller and mis-reads. The
default ask is past fifteen minutes, or running it proves nothing. **An unknown
shape is REFUSED BY NAME**: a shape silently becoming `hold` would report a
duration answer to somebody who asked about the transport.

The route is owner-gated, **ALWAYS pre-scoped** (the token opens nothing in R2),
on the hold probe's own lane (a caller-chosen lane starves a real build), carries
**no secrets at all**, and takes its clock from `readJobMaxMs`.

**THE DOOR IS `.github/workflows/job-probe.yml` + `scripts/job-probe.mjs`**,
because `POST /api/site/job-probe` is owner-gated and handing over the call means
handing over a session token — which the owner ruled out (*"Don't ask me to share
secrets"*). Dispatch-only; signs in on the runner with the service key already in
GitHub Actions; every secret printed as a LENGTH; the log uploaded `if: always()`.
Step 3 prints **which deploy answered** and whether `runner` is on — with
`runner: false` an addon runs INLINE where fourteen minutes still applies, so a
duration reading would be about the wrong layer.

#### What the two live runs proved, and the three defects they found

**DURATION: PROVEN (2026-09-14, probe run 2).** A job child ran **1,200,182 ms —
20 minutes — inside the container, `code: 0`, no `signal`, `stopped: null`, 20 of
20 pulses**, with 30.2 minutes of deadline left. It passed 12m22s (run 44's
death), 14 min (the old `EDIT_JOB_MS`) and 15 min (the consumer ceiling). The
deadline counted DOWN the whole way, which is the 50-minute container clock
rather than an isolate's 14.

**TRANSPORT: UNREAD**, and three instrument defects are why.

1. **`newJobId` WAS CALLED BARE and the route threw** (run 1, 17 seconds). It
   takes its randomness as a REQUIRED parameter — the module is pure on purpose —
   and both other call sites pass `(b) => crypto.getRandomValues(b)`. `worker.js`'s
   `fetch` has **no try/catch around `handleRequest`**, so an uncaught throw is
   answered by Cloudflare **in HTML**, and a caller doing `.json()` gets
   `Unexpected token '<'`. **The route was asserted by READING it** and every
   landmark was where it looks — and the guard SAID a drive was impossible
   "because the route is owner-gated", which is false: `authUser` asks
   `/auth/v1/user`, so a stubbed global fetch is the whole cost. **A stated
   impossibility nobody re-tested is how a route ships throwing.**
2. **THE RUNNER THREW AWAY THE STATUS.** `.then(r => r.json())` drops the status,
   the content-type and the body — *a failure that cannot name itself*, in the
   instrument built to name failures. One `readJson` now at all three reads,
   because **the status separates the three shapes this route fails in**: 401 is a
   token that did not take, 404 is a Worker without the route, a 5xx with HTML is
   the Worker throwing. A non-JSON answer MID-POLL asks again rather than falling
   through, since reading a blip as an ending invents a finished job.
3. **`wireCall` PASSED NO ABORTSIGNAL** (run 3). A black-holed socket sat there
   until the JOB's deadline; the watcher gave up at 16 minutes with the child
   alive and the verdict unreadable. **THREE OUTCOMES, NOT TWO**: answered, died
   before the bound (a reset — `wire` says which kind), and **`hung`** — never
   answered, never reset. They need three different fixes, so collapsing the last
   two is the one way this instrument can mislead rather than go quiet. `hung` is
   asked FIRST, because reading a hang as `idle-kill` would say "streaming is the
   fix" about a socket streaming does nothing for. `wireCallBoundMs(ms)` is the
   ask plus a minute; the `timer` is INJECTED so the one branch that matters most
   can be driven at all; the runner's watch bound is DERIVED from it.
4. **A PROBE COULD ONLY BE READ BACK BY THE RUN THAT FIRED IT** — an instrument
   that cannot re-read its own dial. `PROBE_JOB_ID` / the `jobId` input skips the
   fire and reuses the same polling and verdicts, so a re-read says the same
   things in the same words. **The fire is skipped rather than made idempotent**:
   a second launch of the same shape would take a second lane to answer a
   question already in flight.

**AND THE ROUTE IS DRIVEN NOW, WHICH IS WHAT DEFECT 1 COST.** The guard said a
drive was impossible "because the route is owner-gated"; `authUser` asks
`/auth/v1/user`, so a stubbed global fetch and a fake DO namespace are the whole
cost, and both POST and GET go through `worker.fetch` — the launch payload read
with `readLaunch`, the lane asserted, and a bare `newJobId` proved red. **A
stated impossibility is a claim, and this one had never been tested.**
**Sweep: 14 mutants, 14 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** — each arm losing its clock, both arms sharing one signal
(so the second reports `hung` without being tried), `hung` forced false and
forced true, `hung` no longer asked first, the bound not outlasting the ask, the
slack collapsed to 1, junk `ms` giving a zero bound, the runner guessing its
watch bound again, the read-back id coerced, the read-back firing anyway, the
workflow dropping `PROBE_JOB_ID`, and the artifact path diverging from the
script's own log name. **Every anchor was checked to occur exactly once before
the run.** **Suite 6,316.**

**MERGED AND LIVE — deploy 2118, 2026-09-14 08:29:23→08:32:35Z, green in
3m12s**, on `main` `a4d0f5e5` → `3d7acaf5` (8 files, fast-forward). The image
**BUILT** (step 2m18s) and the container **`EDIT`ed at 08:32:25Z**,
`fadb4940…46c23c5` → `e35d9f28b49f5f2c`, `SUCCESS Modified application` — **read
out of the log's own diff rather than inferred from the step's duration**, so
**the 15–20 minute hold ran to ~08:47–08:52Z**. The drain was instant and the
gate was left to expire on success.
**NO SERVED ASSET CHANGED, so there is no file-hash check for this deploy** —
Wrangler read 99 files and answered `No updated asset files to upload`, which is
right: `public/` is untouched and `builder/job-probe.mjs` is bundled into the
script. What stands in is the gate discriminator: `/api/site/job-probe` **401**,
`/api/site/runtime` **401**, `/api/nope-not-a-route` **404**.
**Release checks before the merge**: `unit tests` run **2523** green (suite step
104 s); `site build` run **1133** green, all twenty steps, **`site-build.mjs`
382 passed / 0 failed in 14m53s**, with contrast-cases 16, theme-seam 11,
theme-render 29, site-routing 14, site-runtime 47 beside it — **read out of the
job's own log rather than carried over, and the FOURTH independent run to answer
382** (1114, 1117, 1127, 1133).
**THE TIP WAS ONE COMMIT PAST THE HARNESS AND THAT WAS CHECKED, NOT ASSUMED**:
`3d7acaf5` is docs-only over `5b2a2df7`, and the docs-only push triggered no
`site build` at all — which is exactly what makes 1133's green cover the tip. *A
green harness on an ancestor is only evidence when nothing between it and the
tip is an image input.*

**AND THE REPAIRBENCH-1 TRACES ARE THE STRONGER EVIDENCE ANYWAY** — a controlled
before/after nobody set up on purpose. Same site, same ask, 2½ hours apart, both
stored: run 44's page call **459,465 ms → OK, 3 files** and run 45's **270,025 ms
→ `fetch failed`**, which is `522129 − 252104` out of the trace itself. The
runner flip landed between the two deploys. **Neither trace carries the `where`
field** (it shipped after both), so the attribution rests on the durations plus
that ordering; the next run's trace names it outright. Run 44 then died at
`why: "time"` with the page WRITTEN and `changed: 1` — the clock, one step from
done — and **both runs refunded 6 credits**.
**Its database exists and its TABLES DO NOT**: the schema is applied AFTER the
compile and neither run compiled, so `repairbench-1` is provisioned-but-empty. A
rerun there tests everything that failed except provisioning-on-first-touch,
which is already spent. **And it is a FIFTH instance** of the blank-`neon_db`
defect in the backlog.

**STILL NOT PROVEN**: the transport reading, and publishing. The trace evidence
above stands on its own and is stronger than the probe anyway.


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

**Read `docs/architecture.md` first** — the owner's own drawing: one BUILD step
makes the site, then EDIT / ADDON / DELETE act on it and each publishes back
through the one spine. **The site is the centre, not the paths.**

Owner: *"it should be 2 separated path tho, idk why you are mixing the build with
the edit path"*, and on what the edit step IS: *"customer says edit this, and
booom you go edit it"* — pure action, no design round.

**`look` used to call `designSiteSchema`** — the BUILD's function, tool and
system text — to change one colour on a live site: **84,817 characters** of
instructions for inventing a business from nothing. **And the two framings
fought**: the build's `css` description opens "ONLY WHEN ASKED… OMIT this field
entirely unless", which an edit reads as *don't touch the stylesheet*, so
`EDIT_RULE` had to name that clause and overrule it in prose. Now
**`builder/site-lanes.mjs`, which imports nothing from `worker.js`**:

```
customer ──► pick_lanes ──► edit_site ──► publish
             haiku          one per lane   ONCE
             2,811 chars    1 property     however many ran
             17 names       0 required
```

**Twenty-one lanes and EVERY ONE ACTS.** `pick_lanes` runs ABOVE the layer
dispatch, so it is the front door for all twenty-one. **DERIVE THIS LIST, DO NOT
TRUST IT** — it has gone stale twice: `node -e` over `site-lanes.mjs` and print
`LANE_FIELDS`, `OWN_LANES`, `DISPATCHED_LANES`, `VERB_LANES`, `ESCALATE_LANES`,
`UNBUILT_LANES`.

**FOR A FIELD'S LAYER, CALL `laneLayer(field)` — NEVER READ `LANE_LAYER`.** That
map is keyed by GROUP, so indexing it by a field name answers `undefined` for
three lanes that dispatch perfectly well — and `undefined` reads as "this lane
has no layer", which is exactly how an own-lane looks. Reading it that way put
the wrong split into two files and the wrong number into a heading.

- **10 act here** — `css theme brand description wordmark favicon qr lang langs
  behavior`. **Every one but `css` must be on `EDIT_FIELDS`** — the lane reads
  `priorLook[field]` and writes through `mergeLook`, so a lane missing from that
  list bills and changes nothing, silently, at both ends.
- **9 dispatch** — `images`→`picture`, `action`→`nav`, `backend`→`rules`,
  `slug`→`rename`, `shape`/`components`/`purpose`/`three`/`tsx`→`page`. Nothing
  reads a STORED plan, so `shape` is not a value to save — it is a job for the
  rung that rewrites pages.
- **1 verb lane** — `pages`: `remove` and `move` are the `page` rung, `add` is the
  addon route. **No default** — an unreadable verb refuses, and this is the ONE
  place where the bias inverts, because a wrong guess takes a page off a site.
- **1 escalates** — `kind`→`build`. A rebuild is what it IS, and it is NOT a
  dispatch: `build` is not an edit layer.
- **0 unbuilt.** The five groups are a **total, disjoint partition** — each is a
  different sentence to a customer, so collapsing any two loses a real
  distinction. **A dispatched lane must never target `look`** — that is the door
  it came through.

**`OWN_LANES` is a group name, not a verdict** (renamed after the owner asked
*"i thought all of them were act?"* twice). It means *the ones this module edits
itself*.

**A RULE PER LANE, IN FOUR NAMED PARTS** (owner: *"i want a rule per everysingle
one of them"*): `is` · `yours` · `wide` · `keep`, and only `wide` is genuinely
per-field — it names how THIS field gets over-answered. `css` gets a token where
a rule was asked for; `brand` gets a name improved instead of copied; `lang` gets
the site TRANSLATED. Structural, not prose: `laneRule` THROWS if a part is
missing, so a lane cannot ship as a description with no ceiling.

**THE CONTRACT IS TWO OPPOSITE HALVES AND THEY MUST ARRIVE TOGETHER** (owner:
*"it's free css — the model can edit anything on the page… but when they ask one
thing, you only edit one thing"*):

- **Unlimited in WHAT.** The sheet is the whole look and it is the model's to
  edit; nothing on the page is out of reach.
- **Strict in HOW MUCH.** As many edits as there were asks and **never more**;
  each **only as wide as it was asked**; **nothing unasked-for moves.**

Either half alone misleads: permission without a ceiling invites a redesign, a
ceiling without permission reads as "don't touch anything". **Stated as the
mechanism, never as a ban-list** — a list covers tonight's control and the next
request is always a different one.

**THE WALL, NOT THE RULE.** A `css` lane cannot re-theme or rename a site because
its tool has one property and there is nowhere to put the answer. A rule in prose
is one a model eventually reads past.

**ONE PUBLISH PER MESSAGE** (owner: *"if the act was 2 things then 1 publish"*).
The eight branches call `publishStep`; the spine runs once below the loop.
`eSrc` carries forward between rungs. A config snapshot taken before any rung
runs is restored if that publish fails. **Measured: 5,606 of tool for a colour
change against 89,195, still 1 credit** — `pageCredits` is variadic and rounds
once with a floor of 1, and the routing call is billed once per MESSAGE.

**The name sets are asserted in BOTH directions** — a field added to the build
with no lane is a part of a site nobody can change again; a lane for a field the
build stopped producing edits nothing.

**A LANE'S OUTPUT CEILING IS WHAT ITS FIELD CAN STORE.** `laneMaxTokens(field)`
derives from `FIELD_STORE_CAP` — **the refusals themselves and never a second
list beside them** — at three characters per token with a quarter of slack. **It
can only ever REDUCE** (`Math.min` with the shared ceiling), so no working lane
got tighter: wordmark **16,000 → 3,334**, favicon **→ 1,667**, everything else
untouched. **A pre-existing gap is named**: `MAX_CSS` is 60,000 characters and
the shared ceiling expresses about 48,000; an overrun is a NAMED failure, never
half a stylesheet stored.

**AND THE CEILING WAS NEVER THE BINDING CONSTRAINT — run 40 disproved it.** The
next `wordmark` ask came back a THIRD timeout at exactly 240,000 ms, cost 0.
**The tell is which failure came back**: a bound ceiling stops with a
`max_tokens` stop, and this stopped with a TIMEOUT, so the model had not reached
3,334 when our own `AbortSignal` cut it. **Lowering a budget truncates a long
answer; it cannot make a slow one finish sooner.**
**THE BINDING CONSTRAINT IS THE WIRE**: `QUICK_CALL_MS` is 240 s only because the
egress hangs up an IDLE connection at ~270 s, and **streaming is what stops it
being idle**. Two hops: `callBuilderModel`'s Worker wrapper FORWARDS `opts` (it
had dropped a fourth argument the module has taken for months — the wiring trap,
found by a live timeout because every guard drove the MODULE), and `quickSend`
passes `{stream: true}` and clamps a queued call to `QUICK_STREAM_MS` (480,000).
**The synchronous path keeps 240 s deliberately** — off the queue the bound is
the CUSTOMER'S connection (~273 s), which streaming to a provider does nothing
for. **480,000 is a chosen bound, not a measured one.** **PROVEN by run 41**:
`lane:wordmark` ran **292,336 ms and FINISHED**, where runs 11, 12 and 40 were
each cut at exactly 240,000 for nothing.

**EVERY SMALL CALL FOLLOWS THE PICKER, NOT A HARDCODED MODEL** (owner: *"if grok
is picked then that will be it"*). `BUILD_MODELS` has a third slot, **`quick`**,
equal to the picker's own model. **WHAT IT COST TO LEARN**: run 93 bought a `css`
edit and got a **503 in 5.3 seconds having spent nothing**, because every cheap
rung was pinned to `claude-haiku-4-5` and Anthropic refused on billing — *the
platform's cheap ladder was entirely behind one provider while its expensive half
was not*. Two guards, and **the second is the one that matters**: a source scan
for a pinned id (comments blanked — every one now names Haiku while explaining it
is gone), and `picked-model.test.mjs`, which DRIVES each runner with a sentinel
and reads the request that would have gone out. Only the second caught
`routeMessage` taking a `model` and never passing it on.

**ONE MARK, SEVERAL FORMS** (owner: *"instead of it being 3 things or 4 or 5, its
gotta be one, wordmark, but it can be made in svg, etc"*). It was **six storage
locations, two doors, three names for two slots**. Now one field per mark
carrying a FORM (`builder/site-mark.mjs`):

    look.wordmark = {form:"text"} | {form:"svg", svg} | {form:"image", url}
    look.favicon  = {form:"initials"} | {form:"svg", svg} | {form:"image", url}

- **PROVENANCE IS DERIVED, NEVER STORED.** *"A model must not outrank a person"*
  survives as `ownedMark`, which reads the FORM: only a person can produce
  `image` (the model cannot mint an upload URL) and only the model produces `svg`
  (**an uploaded SVG is refused** — `/u/` serves inline from the site's own
  origin, so one would be stored XSS). A stored `set: "owner"` field would be a
  second value that can disagree with the first.
- **THE RULE LIVES IN `mergeLook` UNDER AN `asked` FLAG.** A DESIGN STEP answers
  every field whether or not anybody mentioned it, so a rebuild leaves an uploaded
  mark alone; an EDIT LANE runs only for named fields, so its answer replaces.
  **The flag DEFAULTS TO PROTECT**, because of which way being wrong hurts: an
  edit that does not take effect can be said again; deleted artwork cannot.
- **NOTHING MOVES.** `markOf` folds a site still carrying the old pair with the
  old precedence exactly, and the merge normalises on the way out — so every
  published site's frozen `server.js` bakes the same string it bakes now.
- **ONE COPY OF THE URL RULE.** The regex pair deciding what may reach a generated
  `src` was written out TWICE for one refusal about `javascript:` URLs.
  `markUrlOk` owns it and the guard DRIVES it over ten shapes it must refuse.
- **RUN 41 IS WHY**: the lane drew 612 characters of SVG, stored it, published a
  whole build and took 2 credits **for something no visitor could ever see**,
  because `writeSiteBrand` bakes a designed mark ONLY when the owner uploaded
  none. The precedence is right and stays; what was wrong is that the lane could
  not SEE it. **PROVEN by run 42**: `/logo.svg` **0 → 245 bytes**, and the header
  is the only instrument that can say the stored form changed.

**A PUBLISH THAT TRANSLATES SOMETHING NEW IS CHARGED FOR THE TRANSLATION** on top
of the rung's own price — one call per extra language, floored at 1. A
monolingual site and a cached bilingual one pay nothing more; the platform
rebuild never pays.

**Every prompt in there is a PLACEHOLDER** and marked so (owner: *"i will tell
you the prompt later"*).


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

`builder/site-add.mjs`, which imports nothing from `worker.js` — the edit step's
split, for the step that ADDS:

```
customer ──► pick_adds ──► add_to_site ──► [make the db] ──► the page call ──► ONE PUBLISH
             picked model   one per kind    first touch     (addon mode)
             1,936 chars    1 property       then apply      a job alone: no page
             9 kinds        0 required       the backend     call, no publish
```

**Nine kinds, and ORDER IS RUN ORDER** — a table before the function that reads
it, both before the job that runs it, all before the page that shows them.
`ADD_KINDS`, `OWN_ADDS`, `DISPATCHED_ADDS`, `BACKEND_ADDS`, `addLayer` —
**derive, don't trust**.

| kind | makes | cap |
|---|---|---|
| `table` · `function` · `api` · `job` | `BACKEND_ADDS` — the four that touch the database | 6 · 6 · 4 · 4 |
| `page` | a new page | 6 |
| `component` | a section / form / map / FAQ | 12 |
| `qr` | a QR code | 6 per site |
| `three` | a 3D/WebGL element | 1 per site (`SINGLE_FIELDS`) |
| `photo` | **the only one that leaves** — dispatches to the `picture` rung | — |

`MAX_ADDS` is 9 (a message may name every kind it asks for); six answer LISTS
(`LIST_ADDS`). **No low limits while testing** (owner) — every list rule says "as
many as they asked for, and not one more".

- **A SECTION IS A COMPONENT** (owner: *"section is just adding a new component,
  so its a tsx step"*). The kind NAMES the component — a kit part by name, or one
  written for this site (`TSX_ITEM`) — and where on which page. An answer naming
  neither is refused `no-component`: a band the page writer would have to invent
  is the reading the owner corrected.
- **One tool per kind, one property, nothing required** — the wall, not the rule:
  a `component` tool cannot re-theme the site because there is nowhere to put the
  answer. A four-part rule per kind (`is` · `yours` · `wide` · `keep`),
  `composeRule` refusing a missing part.
- **THE UNIVERSAL RULE** (owner: *"anytime something new is added it needs to keep
  the design system"*). `ADD_DESIGN_RULE`, ONE string sent to BOTH models that
  have to hold it — `ADD_SYSTEM` and the fold's directive — and the guard asserts
  both hops carry the same sentence, because either alone is half a rule.
- **AN ADDITION IS ALWAYS A NEW THING.** An ask for a section the site already
  has ADDS a second one, after the first, and the first is left exactly as it is.
  **THE WALL, not the rule**: every page the addition CHANGED must still say every
  word it said. `keptProse` is the SUBSET of `sameProse` counted as a MULTISET, so
  a quote carried twice and returned once is lost. A page that lost words is
  refused 422 `rewrote`, **cost 0**, with up to two of the lost words named.
- **AND A SECOND ONE COPIES THE FIRST'S DESIGN** — same component, same wrapper,
  same layout; only the words are new, and **the one that was there first is the
  one to copy**. A rule to name the first one's component is empty without the
  FACT, so `pageComponents(sources)` reads each stored page's imports and
  `siteNote` prints "/ is built from: SiteChrome, TestimonialGrid, …".
- **Refusals are sentences, never climbs** (`addRefusal`, `alreadyReply`): a code
  or scene the site already carries (read from the stored look OR the page source
  — `ADD_ONLY_FIELDS` and `ADD_EVIDENCE`, the same two lists, so the two doors
  never bounce a customer between them), a page it has, a code with no
  destination, a section on a many-page site naming no page. Only a picker that
  names nothing escalates to the revise. **A photo beside another kind is set
  aside and SAID** — the hop carries one sentence to one rung.
- **THE SITE'S OWN ADDRESS AND ITS PAGE LABELS ARE IN THE NOTE.** A QR "that opens
  the booking page" has no destination unless the designer is told the address
  (`publicUrlFor`) and what each page is CALLED (`pageLabels`, read from each
  page's `<h1>`) — three live declines cost 0 credits and bought exactly those
  two facts. `cleanAdd` resolves a bare route against that address, refusing
  `no-such-page` and `no-address` rather than guessing an origin.
- **EVERY DESIGNER'S RAW REPLY IS KEPT** at `source/<slug>/addon-answer.json`,
  written the moment the add loop ends and BEFORE a decline can return, readable
  through `GET /api/site/answer?slug=&kind=addon`. Three live declines had been
  diagnosed from a boolean.
- **THE FOLD IS THE HOP THE OLD ROUTE NEVER HAD**: the page call gets a directive
  for the addition (file, route, LAYOUT, numbered bands, kit parts, where it links
  from) plus the union of kit parts through `plan.components`. **`tsx` is APPENDED
  by name** — the old `mergeLook` REPLACED it, so a new part on a site that had
  one forgot the first on its next revise.
- **The browser hops SIDEWAYS** on an escalate naming an edit layer, instead of
  falling to the ~25-credit revise.
- **On the wire**: 1,936 picker + 1,299 (`three`) / 1,570 (`qr`) / 20,045
  (`table`) / ~35,000 (`page`, `section`) against 93,852. Every prompt is a
  PLACEHOLDER and marked so.

**THE BACKEND IS THE ADDON'S** (owner: *"the build step doesnt have backend so
its gonna be on the addon step … if customer touches it then neon db is
created"*). **The first of any of the four tiers designed for a site with no
database MAKES the database**, through the build route's own `ensureSiteBackend`
— claimed atomically, idempotent on a retry, gated under a job, before the schema
is applied. A failed provision is a named 502 that is `ours`: nothing charged,
nothing changed. Three hops that were not obvious:

1. **each kind is its own call, so the job designer must be TOLD the function the
   function designer just declared** — designed functions are appended to
   `aSite.functions` (internal ones to `aSite.jobFns`, the only kind a job may
   run) as they are cleaned, and `cleanAdd("job")` admits a job only against
   `jobFns`. Without it every "remind them the day before" designed the builder
   and then refused the job for naming a function the site did not have.
2. **a job on a STORED internal function is re-attached after `normalizeSchema`**,
   which keeps a job only when its function is declared in the same spec — right
   for a build, a silent drop here, where re-sending a stored function would
   `CREATE OR REPLACE` the live one with nothing.
3. **the function designer is shown each table WITH its columns** — a `sql` body
   is parsed at CREATE, so a guessed column is a function that does not exist.

**A job, or an internal function alone, changes no page** (`pageless`): billed
through the ONE charge closure, answered in the page path's shape with nothing
added, changed or moved, no page call, no compile.

**JOBS**: `JOB_ITEM` carries an optional `at` ("HH:MM", the site's local time)
for a daily-or-slower job — `everyMinutes` alone made "every day at nine" into
"every 1440 minutes from whenever it was added". **The zone is NOT the model's**:
the browser sends its IANA zone with the POST, read through `validTimeZone`
(asked of Intl, never a list). `dueJobs` runs a clock-time job once its latest
occurrence is behind now AND after the last run — **or after the job was
REGISTERED for one that has never run**, so a daily 09:00 added at three in the
afternoon waits for the morning. **Run now**: `POST /api/site/<slug>/jobs {name,
run: true}`, owner-scoped, the SAME `jobDeps` under `force` — the press is the
decision. A function may answer `{"did": "cleared 12 expired holds"}` — **its own
words, never a number read as "rows"** — reported after `jobsSkip` and before the
messages, so a list stays messages.

**THE PLATFORM-SIDE SERVICES** (each needs a credential AND a network call, so
none is a model step): **CSV import** (`site-csv.mjs`, RFC 4180 with quoted line
breaks, BOM, Excel's `;`, a cell read AS ITS COLUMN; a hundred rows an INSERT, a
batch Postgres refuses **retried a row at a time so the bad line names itself**,
an outage stopping it where it is and saying so — **not a transaction,
deliberately**; **never a member-written table**); **one submission, once**
(`site-idem.mjs`: an `Idempotency-Key` renewed only after a SUCCESS, so a refusal
retried with the field fixed keeps the key; ONE store at module scope plus KV
across isolates, **eventually consistent — two presses on different isolates can
both reach Postgres, named rather than papered over**); **member reset and
verification** (a LINK for reset, a CODE for verification — Neon's docs, read
rather than guessed; a 404 on send says email codes are not switched on);
**inbound webhook signatures** (already there — `authorize`, fail-closed 404, no
replay guard).


### THE TABLES STEP SAYS WHAT IT COULD NOT COVER (2026-09-13)

Owner: *"Implement structured requirement coverage, not just free-text notes…
Keep this metadata separate from database definitions… Make unresolved
requirements affect completion reporting… Validate model-authored properties
before applying changes."*

**THE AUDIT THAT PROMPTED IT INVERTED ITS OWN PREMISE.** `normalizeSchema` keeps
**51** table keys and `TABLE_ITEM` offers **27**, so 24 are never offered — and
**18 of those 24 do nothing at all**. Six do real work (`trash`, `slug`,
`writeRoles` fully; `ordered` on insert only; `audit` and `history` writing
correctly to tables nothing can read), and of 9 unverified COLUMN properties
**two** do (`unique`, `default`). The tool is not hiding 24 capabilities; it is
hiding **6** and carrying 18 names that read as capability and cost nothing to
remove. **Nothing is exposed and nothing is removed**, by the owner's
instruction: verify through the real application path first.

- **THE METADATA RIDES BESIDE THE DESIGN, NEVER INSIDE IT.**
  `builder/site-requirements.mjs` owns `REQUIREMENT_ITEM` — `need` · `status`
  (`covered` | `elsewhere` | `unsupported`) · `by` | `step` | `why` — as a
  SIBLING of the kind on the add tool. Inside `TABLE_ITEM` it would reach
  `design_schema` (which binds that item by identity), enlarge the build's
  93,598-character tool, and become a promise the schema ENGINE must keep.
- **`readAddAnswer` HAD TO CHANGE SHAPE.** It returned `use.input[kind]`, so any
  sibling the model wrote was dropped **one hop after it was written** — the
  tool correct, the model correct, every later step correct, the value gone. It
  answers `{value, requirements, skipped}` now.
- **THE LIST IS COLLECTED ABOVE the decline check, the cleaner's refusal and the
  truncation check** — precisely the three cases where the reason is the only
  thing worth reading. `foldAdds` reads it off ALL the answers, not the folded
  ones. Counts only on the trace (`tr.at` keeps finite numbers); the needs are
  the customer's own words and go to the developer record.
- **THE CEILING MOVED OFF A COUNT.** "as many tables as the things they NAMED"
  refuses the supporting table a feature cannot work without. It is the
  **smallest COMPLETE data model** now, and a table they did not name must fill
  in `because` with what breaks without it. **The old count rule is asserted
  GONE**, not merely outnumbered — both at once is a contradiction the model
  resolves by picking one, and which one is not observable from here.
- **THE PICKER WAS 402 CHARACTERS AND THE CUSTOMER'S SENTENCE** — no site, and no
  word connecting a feature to its storage, so *"add a login page"* had nothing to
  route on. It gets the same note the designers read (so both halves see ONE
  description of the site) and the instruction to read what an ask NEEDS.
  **The live behavioural half is unproven.**
- **VALIDATION BEFORE ANYTHING IS APPLIED, OVER THE MODEL'S OWN TABLES** — never
  the folded spec and never the normaliser's output, which is the difference
  between feedback somebody can act on and a derived field. `droppedFields` and
  `refusedFields` are REUSED rather than a third list, so **every documented
  alias survives by construction**.
- **What the customer hears** is only what is outstanding AFTER the whole change
  ran. An invalid property is said as *"a guarantee it doesn't offer"* **without
  its name** — `encryptAtRest` is no use to anybody; the count is what they can
  act on.
- **`enforceRefs` IS enforced** — BEFORE INSERT / BEFORE UPDATE triggers per ref
  column raising `'missing parent'`, a NULL reference allowed. There is no FK DDL
  anywhere, deliberately, so both earlier findings are true and about different
  mechanisms.

### …AND SO DO THE OTHER FIVE STEPS (2026-09-14)

Owner: *"We're extending the Tables review to function, api, job, page, and
component. Our goal is that each step designs its part completely, receives the
information it needs, and clearly reports anything it cannot deliver."*

**THE OBSERVER WAS NEVER ALIVE ABOVE THE TABLE TIER.** `droppedFields` and
`refusedFields` were gated on `k === "table"` in the route — and the two readers
themselves iterated `declaredTables(spec)`, so `droppedFields({functions: […]})`
answered `[]` whatever it was handed. Three of the four tiers the engine
normalises had no reach report and no refusal report of any kind: a clean sweep
over nothing, indistinguishable from a designer that stayed inside the tool.
Measured before the change: `droppedFields({functions:[{name,encryptAtRest:true}]})`
→ `[]`. **`auditTier(spec, tier, context)` is one core**; `refusedFields`,
`droppedFields` and the new `unbuiltItems` are thin wrappers, all three defaulting
to `tier: "table"` so every existing call site means what it meant. **A/B over 64
specs against the old readers: ZERO differences on `reached`, ONE on `refused`.**

- **VALIDATED WITH ITS DEPENDENCIES PRESENT** (owner's correction). Measured:
  `normalizeSchema({jobs:[job]}).jobs` is **`undefined`** — the job vanishes,
  its function absent — and a function `returns: "setof bookings"` vanishes
  without `bookings`. Both are CORRECT normalisation and the wrong question. The
  item is normalised INSIDE the accumulated proposal, and only its own tier's
  list is replaced (siblings in a tier are never one another's dependency). The
  answer is found **by NAME, never by position**: a normaliser that drops an
  earlier sibling shifts every index behind it.
- **`unbuilt` IS THE REPORT THAT ONLY EXISTS ABOVE THE TABLE TIER.** A table
  that fails is nearly always a table with a refused field; a function whose
  body names an internal table, one whose return type names a table nobody
  declared, and a job whose function did not survive are dropped **WHOLE** — no
  field to point at, no trace anywhere, and the customer told the feature was
  added.
- **`scanned` RIDES BESIDE THE THREE LISTS**, because every one of them is a
  NEGATIVE assertion and `[].every(...)` is `true`.
- **A REFUSAL ASKS WHETHER THE FIELD'S EFFECT WAS LIVE, not whether its key
  survived — and BOTH ways of being wrong were measured.** `cacheSeconds: 300`
  is kept as **`ttl: 300`**, so "declared truthy, kept falsy" reports a REFUSAL
  on every connection that declares a cache window; `maxRows: -5` is kept as
  **`maxRows: 0`**, and zero means NO CAP (`if (t.maxRows > 0)`), so byte-equality
  calls a refused guarantee honoured. That second one is the single A/B
  divergence above, and **the old reader was right about it**.

**THE BASELINE AND THE PROPOSAL ARE TWO SPECS.** `aBaseline` is the stored spec
and is never written to — it is what `added` versus `altered` is decided against
and what a refused addition leaves the site as. `aProposed` accumulates every
cleaned item in `ADD_KINDS` order and `aSite = siteFacts(aProposed)` is rebuilt
after each kind. **Until now exactly TWO facts crossed between the kinds' own
model calls** — `functions` and `jobFns`, pushed by hand so a job could name a
function designed a call earlier. The `api` designer could not see the table just
designed; the `page` designer was handed a description built from the stored spec
alone, describing a site that no longer matched what the same message had already
decided. `siteNote` marks each proposed name **"(being added by this same
change)"**, so a designer can rely on it AND know it is not there yet.

**ONE NUMBER PER BODY WALL, AND THE CLEANER REFUSES RATHER THAN CUTS.**
`MAX_FN_BODY` (`site-schema.mjs`) and `MAX_API_BODY` (`site-apis.mjs`) are both
**4000** and both exported; `builder/site-add.mjs` imports them. The function
wall had been **8,000 in the cleaner against the engine's 4,000** — two copies of
one number, drifted by a factor of two, so a body in between passed the cleaner
whole, was reported as added, and reached Postgres as 4,000 characters of a
statement. **The API half needs a real POST to see at all**: a GET's body
normalises to `""` whatever it declared, which is how an earlier read concluded
there was no cap. Measured through a POST: **5,000 in, 4,000 out, silently.** The
slice stays as a belt for a payload that never met the cleaner.

**AND THE LIST CAP WAS A SILENT DROP ONE LINE ABOVE THE LIST THAT NAMES DROPS.**
`.slice(0, cap)` ran BEFORE the loop that fills `skipped`, so seven connections
against `MAX_ADD_APIS` of four lost three with nothing on the wire and the
customer told it was done. `over-cap` is its own token and its own sentence —
never `too-many`, which is about a site that already carries as many QR codes as
it can and is a different thing to say.

**COVERAGE ON ALL SIX DESIGNING KINDS.** `REQUIREMENT_ADDS` was `["table"]` and
is `table · function · api · job · page · component`, derived from the kinds'
own flag and censused both ways against `addLayer` — a dispatched kind (`photo`)
has no tool to answer in and can never be on it. `REQUIREMENT_ITEM` stays **ONE
object by identity** across all six; only two nouns were ever table-specific.
`COVERAGE_STEPS` gained `table`, so a page step can hand a storage requirement
back. `cleanRequirements(raw, kind)` stamps `from`, because a `covered` entry
names no step and without it a claim made by a step that then refused everything
could never be tied to that refusal.

**COMPLETION HAS THREE STATES, NOT TWO** (owner: *"Something existing does not
prove the requirement works"*). `requirementNote` read "the step that owns it
ran" as covered, so a planned page was taken as proof of *"customers see only
their own bookings"*. `REQUIREMENT_STATES` is `delivered · failed · unverified`:

| state | when |
|---|---|
| `failed` | `unsupported`, or the owning step is in `failed`, or it never ran |
| `delivered` | `covered` AND `by` names an identifier this change really created |
| `unverified` | everything else — the step ran and produced something, and nothing here ties it to THIS claim |

**THE EVIDENCE IS ASYMMETRIC AND THAT IS WHY THE THREE ARE SEPARATE.** A call to
a function that failed proves a problem; the absence of one proves nothing.
`evidenceName` is **word-bounded, never `includes`** — `bookings` must not match
inside `bookings_old`, or a claim name-dropping a table we did NOT make reads as
proof we did — and a name under three characters is never evidence. The customer
hears *"I've set that up, but I can't confirm from here that …"*, which is an
invitation to check rather than a warning. The record carries the three states
**beside** the three statuses: a status is what the model SAID, a state is what
became of it.

**A FAILED JOB REGISTRATION IS SAID.** The catch logged to a console nobody reads
and left `aJobs` as it was, so the reply said *"scheduled a reminder every day at
09:00"* about something nothing would ever run. Its comment claimed "a job that
did not register is a job the next publish registers" — `persistSiteJobs` has
**two call sites and the other is the BUILD route**, so on this path that is a
full rebuild. `jobErrors` rides beside `functionErrors` on both replies, `aJobs`
is cleared, the step is marked failed for the coverage, and the browser prints it.
A function the database refused was already reported and now fails its step too.

**A CONNECTION OR A CALLABLE FUNCTION IS A BACKEND.** `siteHasTables` is a true
fact and stays; `siteHasBackend` is what the three callers wanted. **Four places
agreed and all four were wrong** about a site with one connection and no tables:
the rules said *"THIS SITE HAS NO DATABASE… there is no API to call"*, rule 11
(call a declared function) was stripped by NUMBER, `pagesRequest` said *"THIS
SITE'S DATA / There is none"*, and `schemaDigest`'s early return sat **above**
`fnLines` and `apiLines`. The connection was designed, applied and served — and
unreachable from every page. **An INTERNAL function is deliberately not a
backend**: it is REVOKEd from PUBLIC and the digest already filters it out. **The
trade is stated**: such a site now gets the full rules including sentences about
tables it has not got, and the digest says *"(the schema declares no tables)"* in
as many words — the smaller error, and the reverse has already cost a whole tier.

**Guards**: `test/addon-steps.test.mjs` (**19**) drives the behaviour — the
four-tier census against the real item shapes both ways, the three tiers that
answered `[]`, the dead-observer control, a dependent item alone versus in the
proposal, a sibling designed one call earlier, the two rename/refusal
measurements, the GET that proves nothing beside the POST that does, both body
walls at their boundary, the cap's named drops, the proposal's accumulation with
the baseline untouched, the marked note, the six kinds, `siteHasBackend` over
four shapes, the digest, and `jobErrors` on both sides of the wire. Five older
guards went red and were **re-anchored, not appeased**, each naming the spelling
that moved: `REQUIREMENT_ADDS === ["table"]`, the `if (k === "table")` gate,
`const aSite = {` (twice), the exact four-property `requirementRecord` call, and
`declaredTables(spec)` counted at two call sites.

**Sweep: 39 mutants, 39 killed, 0 survived, 0 never applied, 2 comment-only
controls survived.** Six survived the first pass and **two of those were INERT,
proven by measurement rather than hunted**: `keptItem` finding by NAME instead of
by position (only the item's own tier list is replaced, so a one-item list in
gives at most one out — measured over six probes including a colliding name), and
`effectAllFalsy`'s "removal destroyed the item" guard (every shape whose REQUIRED
field is binned is dropped whole, so no field-level question is ever asked, and
no tier has an optional field whose removal destroys the item). Both are **kept
and declared deliberate in the code**, because a sweep cannot say so and the next
session deletes what nothing appears to need; both were replaced by an observable
mutant of the same line. **The other four were real guard gaps, all in the
ROUTE**: the gate narrowing back to `k === "table"` (the recorded "a positional
guard cannot see a dead branch", in its NARROWING form — the audit call stays at
exactly the offset every assertion looked for), `aMadeNames` answering `[]` so
every `covered` claim silently becomes `unverified`, `requirementNote` composed
without `failed`/`names` while the developer record kept them, and the trace
mark's `done: 0` — a wrong number wearing a right one's name. **One false alarm,
in my own new guard**: forbidding a kind literal anywhere above the audit went red
on the item reader's own `k === "table" ? (e && e.table) : e`, which is correct
and must stay; it reads the GATE alone now. **Full suite 6,336 green** — 6,316 +
19 + 1, and the arithmetic closes exactly.

**CLOSED, 2026-09-14**: an api `method: "PUT"` normalising to `GET` — a declared
value replaced by a different VALID value, which neither `reached` nor `refused`
covers — is now `changed`, the audit's third report. See the section below.
**NOT PROVEN LIVE**: every measurement here is from driving the modules; nothing
has run against a real customer message. The addon rerun on `repairbench-1` is
the cheapest live proof and is the owner's call.

### …AND FOUR MORE GAPS, EACH CLOSED THROUGH THE ROUTE (2026-09-14)

Owner, on the change above, before it merged: *"Validation still happens after
information is lost… 'Delivered' still means a name matched… Extending an
existing table damages the proposed context… The promised requirement handoffs
are incomplete."* Plus the instruction that shaped the whole round:
***"Demonstrate these cases through the relevant route, including what the
customer is told. Helper tests and source-text assertions alone missed these
connections."***

**ALL FOUR WERE INVISIBLE TO A MODULE TEST AND TO A SOURCE SCAN, and all four
are one line of output away through `POST /api/site/<slug>/addon`.**
`test/fixtures/addon-route.mjs` drives it end to end on the PAGELESS path — a
job and an internal function change no page — so the picker, every designer, the
cleaner, the audit, a real `applySiteSchema` over a fake Neon and the customer's
own sentence all run with no container, no compile, no credit and no network.
The add call's KIND is read off the request (`add_to_site`'s one property is
named by the kind), never guessed from call order. **Neon's rows come back as
ARRAYS with `fields`** — its driver's own wire shape; an object row makes it
throw `c.map`.

1. **THE VALIDATION READ THE CLEANED ITEM, and for three of four tiers the
   cleaner had already binned what it was looking for.** `cleanAdd` REBUILDS a
   `function`, `api` or `job` out of the keys it knows; only `table` spreads
   (`{...t, name, columns}`), which is the accident that made the table tier
   look as though this all worked. MEASURED through the route, a function answer
   carrying `encryptAtRest: true, retries: 3`: `clean.skipped: []`, an audit of
   the cleaned item `reached: []`, an audit of the DECLARED item
   `reached: ["encryptAtRest","retries"]`, and **the reply carried no
   `invalidProps` and the customer heard nothing.** `auditTier` now takes
   `{ sent }` — a Map of name → the item that really goes into the engine — and
   reads the keys off the MODEL'S declaration, so a key the CLEANER removed
   reads exactly like one the ENGINE removed. **By NAME, never by position**: a
   cleaner that refuses one item shifts every index behind it. A declared item
   with no entry in `sent` is counted in `scanned` and nothing else — the
   cleaner's own refusal already has a sentence, and reporting it again as
   `unbuilt` would say the ENGINE dropped something it never received.
   **AND NORMALISING WHAT WAS SENT IS NOT THE SAME AS NORMALISING THE
   DECLARATION — found by a sweep survivor, MEASURED over ten shapes, ONE of
   which divides them and it is a privacy guarantee.** `internal: "yes"` is
   truthy and is not `true`, so the cleaner writes `internal: false` and the
   function is created PUBLIC, callable by every visitor: from what was SENT
   that reads `refused: ["internal"]` (the guarantee is gone), from the
   DECLARATION `changed: ["internal"]` (it is there, differently). `refused` is
   the true one.
   **`changed` IS THE THIRD REPORT AND IT CLOSES THE RECORDED OPEN CLASS**: a
   declared value the pipeline KEPT under another value — `method: "PUT"` stored
   as `"GET"`, `everyMinutes: 5` raised to the floor — which neither `reached`
   (the key reached something) nor `refused` (the effect is live) covers.
   **Scalars only, deliberately, and `scalar()` IS load-bearing**: a list of
   OBJECTS stringifies to `[object Object]` whichever objects it holds, so
   `columns` can never look changed with or without the guard — the first
   control written for it was vacuous — but a list of STRINGS can: `params`
   declared `["ok","not ok!"]` reaches the engine as `["ok"]`. A shortened list
   is a refusal of the entry, not a change of the list, and reporting whole
   lists would fire on every table there is. Developer-facing (`changedProps`);
   the customer's clause is still about lost GUARANTEES, because a property name
   is not something they can act on.
2. **`delivered` MEANT A NAME MATCHED, AGAINST THE PROPOSED DESIGN — and both
   halves of that were wrong.** `aMadeNames` read the names off the CLEANED
   answers, so nothing that happened in Postgres could change the verdict.
   MEASURED through the route: `CREATE OR REPLACE FUNCTION` answered with a
   syntax error, `functionErrors` on the reply, the job registered against a
   function that does not exist — **and the requirement claiming it scored
   `delivered` with the customer told nothing.** Two corrections. (a) The
   evidence is the APPLIED result: `aTables`/`aAltered` from the merge,
   `aFunctions` the ones the engine reports CREATED (a failure is in `aFnErrors`
   and never here), `aApis`/`aJobs` what it kept — EMPTY until `aApplyBackend`
   has run, which is the honest answer, and **a job whose function the database
   refused is left out entirely**, because its schedule is real and the work it
   does is not. (b) **EXISTENCE IS NOT DELIVERY.** `claimEvidence` needs a
   CHECKED GUARANTEE on top of the name: each applied item carries `holds`
   (words from a closed vocabulary true of it) and `fails` (words from that same
   vocabulary that are false), and **`fails` is asked FIRST** — a claim saying
   `bookings access user` about a table applied as `collect` disagrees with the
   database, and reading on for an incidental word that happens to hold would
   let it buy itself a verdict.
   **`appliedFacts` OWNS BOTH AND LIVES IN `builder/site-add.mjs`, NOT IN THE
   ROUTE** — because a sweep mutant that emptied `fails` SURVIVED: the only
   route path that applies a table is the one that then wants a container and a
   compile, so the wall could not be driven where it lived. **A wall nobody can
   drive is a wall nobody is guarding.** The vocabulary is the ENGINE'S OWN
   (`ACCESS_PRESETS` ∪ `READ_LEVELS` ∪ `WRITE_LEVELS`, the level through
   `resolveAccess`), never a second list.
   **WHY THIS CANNOT CRY WOLF, STATED**: every reading moves a requirement
   towards `unverified` and never towards `failed` — there is no corpus of real
   `by` claims to measure a false-alarm rate against, so the only safe direction
   is the one that costs a sentence inviting the customer to check. A false
   "I can't confirm" costs a look; a false "done" costs them the guarantee.
   **AND THE STORED COVERAGE IS RE-WRITTEN AFTER THE APPLY** (both paths): the
   write above the loop survives a refusal and a decline and is decided against
   an empty applied result, which is honest at that point and is not the final
   answer.
3. **AN EXTENSION REPLACED THE TABLE in every later designer's picture of the
   site.** `proposedSpec` replaced by name, which is right for the three
   spec-level tiers (`CREATE OR REPLACE` means a function named again IS the new
   body, whole) and wrong for a table: the commonest addition there is — "add a
   notes field to the booking form" — arrives as one column and no access.
   MEASURED through the route, stored `bookings` being `who, slot, phone` with
   `access: "user"`, the function designer one call later was handed:
   `bookings (notes text) — access collect — being added by this same change`.
   Three columns gone, `collect` (anyone writes, nobody reads — the OPPOSITE of
   what the site enforces) stamped by the normaliser on a table that declared no
   access, and a table the site has had since it was built marked as new.
   **The merge is the APPLY'S OWN now** — `mergeAddonSchema`, the one the
   publish really runs — so the proposal describes the database that is coming
   rather than a second idea of what an extension does; and `aNewNames` skips an
   item the cleaner answered `exists` for, so an extension is not marked new.
4. **ONLY `elsewhere: page` WAS EVER FORWARDED.** `requirementBrief` was general
   and had exactly ONE caller. Six kinds answer requirements and any may hand one
   to any other, so a function step writing "it goes out every morning at nine —
   that is the job step's" reached nobody: the job designer ran a minute later
   knowing nothing about it, and **the customer was told the change was made.**
   The route composes the brief for each kind before its own call, from what has
   been collected SO FAR — which is exactly "the receiving step is still ahead",
   because the kinds run in `ADD_KINDS` order. **`told`, NOT "the step ran"**:
   `requirementOutcomes` reads the steps really HANDED a requirement, stamped
   where the brief is composed, so a hand-off BACK to a step that already ran
   (or to `edit`, which no add kind owns) stays outstanding instead of being
   settled by a call that never heard it. The two are different questions and
   only one of them is about this requirement. **And the sentence names what the
   step IS** — a sweep survivor: the block can reach all six kinds and still
   tell five of them their requirement is "what this page has to make possible".

**Guards**: `test/addon-route.test.mjs` (**12**) drives all four through the real
route and asserts on the customer's own sentence. `test/addon-steps.test.mjs`
gains **seven** module-level cases (the `sent` measurement, pair-by-name,
`changed` over a real clamp, `proposedSpec`'s merge, the `internal: "yes"`
divergence, the list control that proves `scalar` load-bearing, and
`appliedFacts` over both directions of the access check).

**Twelve older guards went red and were re-anchored, not appeased**, each naming
the spelling that moved — including the three thin audit wrappers pinned to
`return auditTier(spec, tier, context)`, which went red on an honest fourth
argument: **the recorded "assert the property, not the spelling" trap, in the
guard written for it.** **One re-anchor collided with a `const` already in the
file** (`factsAt`), which makes node report the WHOLE file as one failing test:
the recorded "a re-anchor lands in a scope it did not write", met in the file
that records it.

**AND THE TEMPORAL DEAD ZONE BIT TWICE, both times in the money path's own
route.** The applied-result `let`s sat seventy lines below the two `aCoverage()`
exits inside the kinds loop, so a refusal composing the coverage threw
`ReferenceError` — which `node --check` cannot see and no source guard can
either. Caught the first time by reading and the second time by the driven route
answering with the throw in it. **Declare what a closure reads above its first
possible call, not above its obvious one.**

**NOT PROVEN LIVE.** Every measurement here is from driving the real route
against stubbed seams; nothing has run against a real customer message. The
`repairbench-1` addon rerun is still the cheapest live proof and is the owner's
call.

### …AND FOUR OUTSTANDING FIXES, ALL FIVE CASES DRIVEN (2026-09-14)

Owner: *"Correct requirement evidence… Prevent silent permission changes…
Block failed dependencies… Make omission messages accurate"*, and the
demonstrations named one by one: ***"malformed privacy input, explicit false,
public versus internal functions, failed function → blocked job, and
configuration present → behavior still unverified."***

**1. THE EVIDENCE WAS HARDCODED, IN THE READER WRITTEN TO STOP EXACTLY THAT.**
`appliedFacts` gave every applied function `holds: ["internal","function"]` and
every connection `holds: ["connection","api"]` — literals, whatever was really
applied — so *"send_reminder is internal, so no visitor can call it"* scored
`delivered` against a function created PUBLIC. It reads the applied settings
now: a function's visibility TWO-SIDED (`holds:["internal"], fails:["public"]`
or the reverse, so a claim on the wrong side is a contradiction rather than a
silence), its `returns` words and its argument names; a connection's HOST, verb
(with the other verb in `fails`), parameters and cache window.
**A CONNECTION PROVES CONFIGURATION AND NEVER BEHAVIOUR** (the owner's own
sentence): an api is not DDL — it is stored in `_meta.schema` — so "applied"
means STORED, nothing has called the service and nothing has checked the key.
The vocabulary carries no word about what a page will SEE, so *"visitors see
the live forecast"* stays `unverified` while *"the forecast is read from
api.test"* is delivered. Measured through the route:
`{"name":"send_reminder","holds":["internal","void"],"fails":["public"]}`,
`{"name":"pub_fn","holds":["public","int","tok"],"fails":["internal"]}`,
`{"name":"weather","holds":["api.test","get","city","300"],"fails":["post"]}`.

**2. TWO PERMISSION VALUES WERE CHANGED IN SILENCE, AT THE HEAD OF THE
CLEANER.** `internal: v.internal === true` read ANY non-`true` value as public:
`internal: "yes"` — truthy, and a plausible thing for a model to write — was
cleaned to `false`, the function created with `GRANT EXECUTE … TO anonymous`,
`ok` returned and `skipped` empty. Refused by name now (`bad-internal`):
cannot-tell must never read as the most permissive answer available.
**AND `definer: false` IS A REQUEST, NOT NOISE** — it asks for INVOKER rights,
LESS privilege, and the ENGINE supports it (`normalizeSchema` applies
`f.definer !== false`); this step cannot carry the key, so it is refused
(`no-invoker`) rather than silently inverted into a SECURITY DEFINER function.
Both are asked BEFORE anything else about the item, so a privacy problem is
always the reason the customer hears. `definer: true` still builds — the
refusal is a refusal, not a ban on the tier.

**3. A JOB WHOSE NEW FUNCTION FAILED WAS STILL REGISTERED.** The first pass took
such a job out of the EVIDENCE only, so the reply stopped calling the
requirement delivered and went on writing a row into `site_functions`: every
firing would write *"this job is no longer part of the site"*, for ever, on a
schedule the customer was told was set up. The block is **per job, by the name
of the function IT runs** — a job on a function this change did not touch is
untouched — and it takes the job off `aJobs`, off `merged.jobs` (which is what
`persistSiteJobs` really upserts), marks the `job` step failed for the coverage,
and **names the failed dependency**, because "couldn't be set up" gives nobody
anything to do. `appliedFacts` keeps its own `dead` skip and **the redundancy is
declared in the code**: the route's wall is about what the site really runs,
this one about what may be quoted back as evidence.

**4. ONE SENTENCE WAS ANSWERING TWO OPPOSITE FINDINGS.** *"I asked the database
for a guarantee it doesn't offer"* was said about `encryptAtRest`, which the
ENGINE has never heard of, and about `language`, which the engine supports
perfectly (`normalizeSchema` reads `f.language`, the DDL says `LANGUAGE
plpgsql`) and the ADDON's own cleaner drops. The second is false and sends the
customer to argue with the wrong layer. **`engineWouldUse` asks the engine
directly** — put the declared value onto what was really SENT and normalise
again; if the answer moves the engine had a use for it and the addon lost it —
so the two are separated by measurement rather than by a hand-kept list.
`unexpressed` is the audit's fourth bucket, `unexpressedProps` its own field on
the wire and on the record, and the customer gets its own clause: *"one setting
the design asked for isn't something this kind of change can carry through…
say it again on its own and I'll have another go."* **ALWAYS FALSE WITH NO
`sent` MAP, and that is correct**: with nothing cleaned, the declaration IS what
reached the engine. **Counts, never names** — the same rule as the clause above
it, and naming them here would be the "expose hidden settings" the owner ruled
out in the same message. Measured:
`{"reached":["encryptAtRest"],"refused":[],"changed":[],"unexpressed":["language"]}`.

**THE FIXTURE WAS THE LESS-CAPABLE FAKE, TWICE, AND BOTH HALVES WERE HIDING THE
SUBJECT.** (a) `_meta` answered the site's ORIGINAL schema to every read, so the
post-apply spec every verdict is decided from was frozen: nothing a change
created could ever be found and every claim about a function or a connection
scored `unverified` for the fixture's reason. It remembers what the apply wrote
now, captured off `applySiteSchema`'s own statement and its own parameter.
(b) The read was pinned to ONE SPELLING of the query — the route writes
`WHERE k = 'schema'` and `loadSiteSchema` writes `WHERE k='schema'` — so every
`loadSiteSchema` call fell to the catch-all and read as `{tables: []}`. **The
recorded "assert the property, not the spelling" trap, on the answering side.**
And `SUPABASE_SERVICE_KEY` is in the env now, because `persistSiteJobs` returns
at its first line without one: a job blocked on the REPLY and a job blocked in
the DATABASE were indistinguishable until the registry was stubbed.

**A PUBLIC FUNCTION AND A CONNECTION CANNOT BE PAGELESS, and that is the product
being right.** Both exist to be read BY A PAGE, so `pageless` is false and the
route writes one — which is why those two demonstrations opt into
`installCompiler()` and the dispatch stub and the other three do not. The
compile and the script upload are the only things stubbed on that path.

**Guards**: `test/addon-route.test.mjs` is **19** (12 + the seven here), each of
the five named cases driven through `POST /api/site/<slug>/addon` and asserted
on the customer's own sentence, plus the control that makes the job block a
block rather than a ban — one function refused, one created, one job surviving
and **`site_functions` agreeing with the reply**.

**Three older guards went red and were re-anchored, not appeased.** The empty
audit shape gained `unexpressed` (and now asserts the real answer's key set, so
a bucket added next month cannot be reported by the route and missing here); the
`internal: "yes"` divergence measurement lost its producer, since the cleaner
now refuses that shape — the refusal is asserted first and the sent item built
by hand, which is honest for a MODULE case about `auditTier`'s input contract;
and `cleanAdd`'s own case stopped asserting that `internal` is coerced and
started asserting that it is refused, with `definer: false` beside it.
**AND ONE EXPECTATION MOVED RATHER THAN BROKE**: a claim resting on a function
the database refused used to read `unverified` — nothing had failed and nothing
could confirm it — and now reads `failed`, because the job step really does
fail. Both are honest about the same change; the second is the stronger one.

**KEPT RECORDED, NOT FIXED** (the owner's instruction): the api tier has **no
credential-guidance field**, so a required secret reaches the owner as a bare
name (`WEATHER_KEY`) with nothing saying where to get one; and `params` is a
**name allow-list with no types and no required flag**, so a connection cannot
say which parameter a page must supply. Both are capability work.
**`search_path` STAYS EXPLICITLY UNRESOLVED** — every model function is
`SECURITY DEFINER` with no `SET search_path`, and whether that is exploitable
here depends on the role's real permissions and on which execution paths are
reachable, neither of which has been checked. `scripts/grants-backfill.mjs
--preview` is the pattern for asking where the credentials already live.

**NOT PROVEN LIVE.** Every measurement is from driving the real route against
stubbed seams. The `repairbench-1` addon rerun is still the cheapest live proof
and is the owner's call.

### …AND FIVE BOUNDED FIXES, PLUS A CORRECTION TO THE AUDIT'S OWN WORDING (2026-09-14)

Owner: *"Finish the completion correction… Report missing pages… Validate page
and component declarations before cleaning discards information… Fix component
targeting and name validation… Document the existing SMS contract in both
function and job instructions"*, and: ***"Correct the audit wording: SMS is
undocumented to the designer; native one-time scheduling is absent. Those are
different limitations from 'the model can never do it.'"***

**THE CORRECTION FIRST, BECAUSE IT IS ABOUT A CLAIM THIS FILE WOULD HAVE KEPT.**
The audit written the same day said a generated function *"can never produce a
text"* and implied one-time scheduling was impossible. **Both overstate, and
the accurate statements point at different fixes.** SMS is **UNDOCUMENTED TO
THE DESIGNER** — every hop of it works and has for weeks (`shapeMessages` reads
`channel`, `runJob` sends `"sms"` through `sendSms` with the number parsed and
the SMS credential, everything else through `send`), so a model writing
`channel: "sms"` out of its own knowledge would have been sent as a text on any
day of that time. **MEASURED across all six add tools (123,554 characters): the
word `channel` occurred ZERO times in the `function` tool and ZERO in the `job`
tool**, while the job rule told the owner to paste an SMS key in Settings.
Native **one-time scheduling is ABSENT** — `JOB_ITEM` carries `everyMinutes` and
an optional `at`, and no run-once field — which is a missing field, not a
missing capability. *An impossibility and an undocumented capability need
opposite work, and only one of them was true.*

1. **CONFIGURATION IS RECORDED AND NEVER PROMOTED.** `claimEvidence` returned
   one verdict for two different kinds of fact, so the word `user` inside a
   permission setting settled *"each customer sees only their own repairs"*.
   Every `made` entry now carries **`checked`** beside `holds` and `fails`, and
   the ask order is `fails` (a contradiction) → `checked` (a behaviour really
   exercised → `delivered`) → `holds` (configuration → recorded as
   `configured`, state stays `unverified`). **NOTHING FILLS `checked` TODAY**
   and that is declared in `appliedFacts` rather than left to be inferred — the
   guard drives all five applied kinds and asserts every `checked` is empty,
   because a mutant filling one in makes the split decorative and every
   configuration word a delivery again. **It is not a second keyword rule**: it
   is the same reader with its answer split in two.
2. **A PAGE THAT WAS ASKED FOR AND IS NOT THERE IS NAMED.** `foldAdds` has
   computed `files` since it was written — its own comment says why — and
   **MEASURED: the route reads `designed`, `directive` and `components` off
   that fold and had never once read `files`.** So two pages asked for and one
   returned published the one, reported it added, and said nothing about the
   other. `missingPages(requested, survived)` compares **by file BASENAME**
   (the merge answers `gallery.tsx` on one path and `src/routes/gallery.tsx` on
   another) and is computed **BELOW THE PUBLISH**, against `aMerge.added` +
   `changed` — what was compiled and shipped — so a page the writer never
   returned, one salvage replaced and one the merge refused all read the same.
   **The answer is ROUTES**, because that is the customer's word and the one
   thing they can act on. A missing page adds `page` to `aFailedKinds`, and
   **the record is re-written afterwards** (a fourth `aSaveAnswer`), because
   the copy stored above the publish says the page step succeeded.
3. **THE FRONTEND KINDS GET THEIR OWN VALIDATOR.** `SPEC_OF_KIND` names the
   four SCHEMA tiers, so the audit block was skipped for `page` and `component`
   entirely — **MEASURED: a page declaring `seoTitle` and `cacheForever`
   cleaned to its eight known keys with `skipped: []` and nothing anywhere
   saying so.** `auditFrontend(kind, declared, cleaned)` is the validator
   appropriate to THEIR pipeline (the cleaner and the directive, not the schema
   engine): `{scanned, reached, changed, unexpressed}`, the offered set read
   off `addTool(kind)` so it cannot drift, pooling into the SAME customer
   clauses the schema tiers use. **THE OFFERED SET IS THE KIND'S OWN** — a page
   declaring `where` (a COMPONENT property) is unsupported, and a union set
   would read it as clean; driven both ways round, because the union is wrong
   in one direction only. **PAIRED BY POSITION AND ONLY WHEN THE COUNTS AGREE**:
   a page has no name to pair on, so a length mismatch answers `scanned: 0`
   rather than auditing one declaration against another's answer. **`scalarHere`
   is load-bearing and its case is not vacuous here**: `sections` is a list of
   STRINGS, so a list the cap shortened would read as `changed` without it — the
   recorded `params` finding one tier over, and the wrong sentence (a shortened
   list is a refusal of the entries, not a change of the list).
4. **A MISSING DESTINATION IS REFUSED, AND A KIT NAME IS CHECKED AGAINST THE
   KIT.** `onPage` fell through to `/` whenever the answer named no route, so on
   a multi-page site a section meant for `/about` was built on the front page
   and reported as done. **The one-page shortcut STAYS** — there the home page
   is not a guess, it is the only answer there is — and the fall-through is
   gone. And the `component` and `page` tools both promise in as many words that
   *"naming a component that does not exist is refused"*; **MEASURED, it was
   not**: `components: ["not-a-kit-part"]` passed whole into the directive as
   *"the kit component: not-a-kit-part — its exact props are listed above"*
   about something with no props. `KIT_COMPONENTS` is derived from
   `COMPONENT_MENU` (2,112 entries, the same catalog the tool offers), an
   unknown name is **DROPPED AND NAMED** rather than refusing the item — one
   real part and one typo is mostly right, and `no-component` still fires when
   nothing usable is left — and **`tsx` IS UNTOUCHED**, because a part written
   for this site is not in the kit by definition and refusing it would close
   the escape hatch the kit exists to have. `unknownComponents` is
   developer-facing; a component name is not something a customer can act on.
5. **THE SMS CONTRACT IS ONE STRING SENT TO BOTH STEPS.** `MESSAGE_CONTRACT` —
   `{channel, to, subject, body}`, `"email"` or `"sms"`, **absent or unknown is
   EMAILED** (email costs the owner nothing per send), an email needs all three
   of `to`/`subject`/`body`, a text needs `to` and `body` and takes **NO
   `subject`**, and each channel has its own key so a message whose channel has
   no key is HELD rather than lost. **ONE string, not two copies**, asserted
   into both tools by identity. **The default is asserted against `shapeMessages`
   itself, never against the sentence** — a prompt describing behaviour the code
   does not have is this repository's recorded "promise nothing ever compiled".
   Driven through `runJob` with both providers stubbed:
   `{channel:"sms", to:"07700 900000"}` reaches `sendSms` as `+447700900000`
   with the SMS credential, the email beside it reaches `send` with the email
   credential, and a text on a site with no SMS key is `sent: 1, failed: 0,
   unsent: 1`.

**A STUB IN THE REAL PARSER'S SHAPE**: the first draft's `phone` read
`/\d{7}/` against `"07700 900000"`, which has **no run of seven consecutive
digits**, so the message was dropped and the case reported the feature broken.
Digits first, then the test — the recorded "a fixture in a different shape from
reality", in the fixture written to prove a format is accepted.

**Guards**: `test/job-sms-contract.test.mjs` (**5**, new) — the census over both
tools plus the driven runtime; `test/addon-route.test.mjs` **20 → 27**, each
fix driven through `POST /api/site/<slug>/addon` and asserted on the customer's
own sentence (a missing page named plus its control, page `reached`, component
`changed`, page `unexpressed`, the multi-page `no-page` refusal, an unknown kit
name dropped with the valid one and the TSX beside it surviving);
`test/addon-steps.test.mjs` **26 → 32**.

**Five older guards went red and were re-anchored, not appeased**, each naming
the property that moved: `requirement-coverage`'s aSaveAnswer count (3 → 4), its
`coverNote` anchor, its case 14 and case 15 for configuration no longer
silencing a behavioural need, its case 17's counts, and `site-add`'s
`onPage` fall-through — which is an expectation that MOVED rather than broke,
since it asserted the very guess fix 4 removes. **TWO of those re-anchors hit
recorded traps in the guard written for them.** (a) The schema tier's validation
window was sized IN BYTES and ran to a distant neighbour; the frontend audit
was inserted between the two landmarks and the window grew silently from ~2.6 KB
to **4,261 bytes**, reporting the schema validator as broken by a block that is
not it. It ends at the next SIBLING now — and at **CODE, never the heading
comment**, because `W` is the BLANKED source and a comment landmark is erased
before the scan runs. (b) The can't-confirm clause joins its needs
(`"…that A; or that B"`), so pinning either to its own copy of the opening words
is a spelling; the clause is split once and both needs read out of it.

**Two fixture names were invented rather than real** and the kit check found
them: `form-shell` is not one of the 2,112. The two guards that used it are
about the DIRECTIVE and the FOLD, so their fixtures use `form-section` (real)
**and the drop is asserted beside it** rather than instead of it — a fixture
change that appeases a check without asserting what changed is the same thing
as deleting the check.

**Sweep: 39 mutants, 34 killed, 5 survived, 0 never applied, 2 comment-only
controls survived on the first pass — and every one of the five was a gap in
the new guards, not the product's.** `appliedFacts` claiming a table's
configuration as exercised behaviour (the recorded **"a wall nobody can drive
is a wall nobody is guarding"**: the only ROUTE path that applies a table wants
a container and a compile, so it is closed at the module with all five kinds
driven); the route's `unexpressed` pool emptied (both route cases drove
`reached` and `changed` and nothing drove the third); the offered set typed as
the union of both kinds; `scalarHere` removed; and `scanned` pinned to 1. Second
pass: **39 mutants, 39 killed, 0 survived, 0 never applied, 2 controls
survived.**

**Suite 6,379** — 6,363 + 6 (`addon-route`) + 5 (`addon-steps`) + 5
(`job-sms-contract`) before the survivors were closed, then + 1 route case and
+ 1 module case. **CI has read it: `unit tests` run 2530 on the tip.**

#### What each of these is evidence FOR, and where that stops

Owner, 2026-09-14, on the SMS half: *"The stubbed test proves the runtime calls
the sender correctly. It does not prove real delivery."*

- **THE SMS EVIDENCE IS AN ARGUMENT, NEVER A DELIVERY.** `sendSms` is replaced
  by a recorder in every case, so the last hop the guard sees is what was
  HANDED to the sender: the right sender, the parsed number, the SMS
  credential, and a hold (`unsent`, never `failed`) when that credential is
  absent. It cannot prove a provider accepts the payload, that a handset
  receives it, that the number FORMAT the provider wants is the one this
  produces, or that a real site's key works. **NO REAL TEXT HAS BEEN SENT AND
  NONE MAY BE until the owner names a test recipient** — a text reaches a real
  phone belonging to a real person, which is not the place to discover a wrong
  number. The file's own header says all of this.
- **`checked` IS EMPTY AND THAT IS THE CORRECT ANSWER FOR THIS CHANGE.** Owner:
  *"Don't populate it from configuration, keyword matches, or this one
  successful test as though every future generated feature were verified."*
  The three wrong fillings are named in `appliedFacts`' own comment —
  configuration (copying `holds`, which collapses the distinction), a keyword
  match (`claimEvidence` already asks that, so the claim would be its own
  evidence), and one passing live run (which proves one site's one feature
  worked once, where `checked` is read for every generated feature after it).
  The guard drives all five applied kinds and asserts every `checked` is `[]`,
  so filling one is a red run rather than a drift.

#### Kept recorded, not fixed — the four open items this round did not close

1. **A DISCARDED `language`.** The engine reads `f.language` and emits `LANGUAGE
   plpgsql`; the ADDON's cleaner drops the key. It is reported honestly now
   (the `unexpressed` bucket, its own customer clause) and is **still lost** —
   the fix is the cleaner carrying it, which is capability work.
2. **THE API TIER HAS NO CREDENTIAL-GUIDANCE FIELD, AND `params` CARRIES NO
   TYPES OR REQUIRED FLAG.** A required secret reaches the owner as a bare name
   (`WEATHER_KEY`) with nothing saying where to get one, and a connection cannot
   say which parameter a page must supply.
3. **NATIVE ONE-TIME SCHEDULING IS ABSENT.** `JOB_ITEM` carries `everyMinutes`
   and an optional `at` and no run-once field. **A missing field, not a missing
   capability** — the wording correction above is exactly this distinction.
4. **`search_path` STAYS EXPLICITLY UNRESOLVED.** Every model function is
   `SECURITY DEFINER` with no `SET search_path`; whether that is exploitable
   here depends on the role's real permissions and on which execution paths are
   reachable, and **neither has been checked**. Not "safe" and not "a hole" —
   unmeasured, and saying so is the point. `scripts/grants-backfill.mjs
   --preview` is the pattern for asking where the credentials already live.

**THERE IS NO ISOLATED PLACE TO PROVE IT — A LIVE CHECK IS A PRODUCTION DEPLOY
(2026-09-14).** **The platform has ONE Worker** — `isibi-app` in
`wrangler.jsonc`, no `env` block, bound to `gofarther.dev`, `www.gofarther.dev`
and the `gofarther.app` zone — and the addon's work runs in the site's
CONTAINER, whose image is built by that same deploy. So a live check needs BOTH
halves to be the candidate build, and the only way to get there is `deploy.yml`,
which fires on a push to `main` (or a `workflow_dispatch` that deploys whatever
ref it is given **to that same production Worker**). **There is no staging, no
preview environment and no second Worker**; `OWNER_BASE_URL` overrides the
harness's target and there is nothing else to point it at.

### AND IT WAS PROVEN LIVE — the reporting works, and it caught a real defect (2026-09-15)

Owner: *"You may merge PR #928 and deploy this patch, then complete the
controlled live verification… Verify that both the Worker and the container
executing the test use the merged changes. Elapsed rollout time alone is
insufficient evidence."*

**Merged `4bd5a919` to `main` (fast-forward), deploy 2119 green in 2m48s.**
Then two dispatched `lane sweep` runs on `repairbench-1`, the owner pressing the
button (a session has no `actions: write` — see the rule above). **Setup and
behaviour are separate runs deliberately**, because a baseline bought inside the
run under test cannot be told from the thing being tested.

- **Run 46 (setup, 8 credits, 293 s)** — *"Add a table that stores repair
  bookings: the customer's name, the bike, and the day they're bringing it
  in."* Made `bookings` (`customer_name`, `bike`, `drop_off_day`, `collect`).
- **Run 47 (the test, 13 credits, 506 s, balance 174 → 161)** — *"Add a page at
  /status that shows how many repairs are booked, and a function the page calls
  to count them."* Routed `table · function · page`.

**BOTH HALVES OF WHICH-CODE-IS-ANSWERING WERE PROVED BEFORE EITHER RUN SPENT A
CREDIT**, which is what the pre-flight is for: `worker deploy:
4bd5a9191593743b0e61c00d1a1b2caeffe1b933 [build-health 200]`, `container image
(cold start, lane health-probe): 16cb42353dc4a343 health="ok 850968e5fecd
16cb42353dc4a343"`, the runtime route agreeing, then `the code under test is the
code answering — proceeding`.

**WHAT SHIPPED, VERIFIED FROM OUTSIDE.** `/status` **404 → 200** (5,970 bytes,
`x-site-version 01789437370636-f11bde`, build `mu1zo5lj-y6ovi1` →
`mu20t4j1-ziyak2`), in `sitemap.xml`, linked from the header, on the site's own
design. Its route chunk calls `useRpc("count_booked_repairs", {})`, and that
function answers the site's real public route —
`POST /api/db/repairbench-1/data/rpc/count_booked_repairs` — **HTTP 200**.

**AND IT ANSWERS `0` ON A SITE WITH THREE BOOKINGS.** A fresh `201` insert into
`bookings` immediately before and after left the count at `0`, which is the
control that rules out "the rows were never there".

**THE CAUSE IS THE BLANK `neon_db` BACKLOG DEFECT, and the chain is four lines
of the addon route.** `let adb = await siteBackendBySlug(env, ownerSlug)`
answers null because `site_backends.neon_db` is `''` (read live, still `''`
after both runs — **a fourth confirmation**); the very next line is `let aSpec =
adb ? null : { tables: [] }`, and the `_meta.schema` read sits under `if (adb)`.
**So the designers were told, truthfully as far as the route could tell, that
the site had no tables** — the table designer's own words: *"I'll add a repairs
table so the status page's count function has booked jobs to count."* It made
`repairs`; the function counts `repairs`; `bookings` is never looked at. The
same falsy `adb` drove `aProvisioned = true`, so the reply says **"AND THE SITE
GOT ITS DATABASE FOR IT"** about a site that has had one since run 46.

**AND `repairs` IS EMPTY BY CONSTRUCTION, which is a second, independent
mistake.** It was declared `read: "none", write: "none"` — the `admin` pair —
so nothing can write to it (measured: `42501 permission denied for table
repairs` to an anonymous POST) **and `seedSiteRows` skips it**, because that
function seeds the `display` pair and nothing else, by a rule with its own
measured history. The designer answered a seed of starter rows and the seed was
correctly discarded. **So the page reads `0` today and would read `0` for ever.**

**THE MERGE COMPOUNDS IT, PROVEN BY DRIVING THE REAL FUNCTION**:
`mergeAddonSchema({tables: []}, …)` answers `["repairs"]` where
`mergeAddonSchema({tables: [bookings]}, …)` answers `["bookings","repairs"]`.
So the spec written back to `_meta.schema` declares only `repairs` — **the
physical `bookings` table survives and its DECLARATION is gone**, which is the
state the next addon on that site starts from.

**WHAT THE PATCH UNDER TEST DID, AND IT IS EXACTLY WHAT IT WAS BUILT FOR.** The
coverage record reads **`{total: 7, covered: 4, elsewhere: 3, unsupported: 0,
unreadable: 0, delivered: 0, failed: 0, unverified: 7, configured: 1}`** —
**`delivered: 0`**, on a change where a name match alone would have delivered
three claims, and `configured: 1` where the old reader would have promoted
configuration to delivery. The customer was told: *"I've set that up, but I
can't confirm from here that Booked repairs are stored so the count is a real
number of jobs; or that Visitors see a count, not customer names or what is
wrong with the bike — have a look and tell me if it isn't right."* **The first
of those two clauses is the defect, named to the customer before anybody looked
at the page.** Three hand-offs stayed outstanding (`STILL OWED`) rather than
being settled by steps that never heard them. `checked` stays empty.

**WHAT IS STILL NOT PROVEN, and none of it is the reporting.** The `seeded`/
`skipped` report is written into the migration record and **reaches nobody** —
`"repairs: only display tables are seeded"` is a concrete sentence the customer
could act on and does not get. No SMS has been sent. And the run pushed its own
screenshot commit to `main` (existing `lane-sweep.yml` behaviour, `6b72131` and
`1f2d98e`), which is worth knowing before reading main's history.

### THE FOUR STATES "NO DATABASE" MEANT (2026-09-15)

Owner, after run 47: *"Stop treating an unavailable existing backend as an empty
site… Resolve the existing backend or stop the dependent addon steps with a
specific explanation. Do not design against tables: [] when the existing schema
is unknown."*

**`siteBackendBySlug` ANSWERS ONE `null` FOR FOUR DIFFERENT FACTS**, and
`site-backend-state.mjs` is the one pure function that tells them apart —
shared by the Worker, the job child and `scripts/backend-repair.mjs`, so a
repair run by hand and a repair run by a build can never disagree about what a
site is.

| state | means |
|---|---|
| `ready` | `site_backends.neon_db` names a database |
| `none` | no name AND no `site_project` row — genuinely frontend-only, and **the only state in which `{tables: []}` is true** |
| `incomplete` | no name but a project row EXISTS: the database is real, the REFERENCE is missing |
| `unreadable` | a lookup threw. Asked FIRST, so a partial answer never decides a state |

**AND THE KV CACHE IS WHY IT HID FOR A YEAR OF DEPLOYS.** `lookupRoute` checks
`env.SITE_ROUTES` before Supabase, so in the WORKER an `incomplete` site
resolves out of the cache whichever build last provisioned it wrote, and
nothing looks wrong — the data proxy answers today for exactly that reason.
**`builder/container-env.mjs` says in as many words that `SITE_ROUTES` is ABSENT
in the container**, so when the addon moved behind `JOB_RUNNER_EVERYONE` it
started reading Supabase directly and met the blank column. *A rule true because
of a layer below it expires when that layer moves* — and a repair that consulted
the cache would report every affected site as healthy, which is why
`siteBackendDetail` reads Supabase and never `siteBackendBySlug`.

**`incomplete` IS RESOLVED AND THEN PROVED, in that order.** The name derives
(`dbNameForSite`) and the project row carries the credential, so a connection can
be built — but **a name that derives is not a database that answers**, so it is
probed with one trivial query first. A probe that fails answers `unreadable` with
its own reason, never `none`.

**THE ROOT IS ONE LINE, AND IT IS IN THE PROVISION.** `saveBackend` inside
`ensureSiteBackendPure` is an INSERT with `resolution=ignore-duplicates`: for a
site whose first build was frontend-only the row ALREADY EXISTS with
`neon_db: ""`, so the claim is a no-op and the column stays empty for ever.
`ensureSiteBackend` writes it now, **from the connection it is about to hand
back** rather than re-deriving off the slug — the two agree today (MEASURED over
ten slugs) and the difference is which question it asks, which is recorded in
the code as deliberate rather than left for a sweep to read as a gap.

**THE SCHEMA READ HAS THREE OUTCOMES, NOT TWO.** `readStoredSpec` separates a
stored spec, a read that SUCCEEDED and found nothing (a database provisioned and
never applied to — honestly empty, and refusing it would make the first backend
addition on such a site impossible), and a read that FAILED or will not parse
(unknown → stop). `_meta` not existing is the second case, matched on Postgres's
own wording and on nothing else.

**RECOVERING A DROPPED DECLARATION** — `site-schema-recover.mjs`. An addon
writes `_meta.schema` WHOLE, so a route that read `{tables: []}` published a spec
with the site's earlier tables missing while the tables themselves carried on
holding rows. `reconcileSpec` keeps every stored entry EXACTLY as it stands (it
carries metadata no catalog can rebuild) and rebuilds an entry for each table the
database has and the spec does not. `deriveAccess` is the inverse of `grantsFor`
and `policiesFor`; **a table whose access cannot be derived is NAMED and left
out, never guessed**, because a wrong pair written back has the next apply
re-issue grants on a live table. The flags no catalog can prove (`payment`,
`timestamps`, `writeRoles`, …) are reported rather than invented.

**THE SIXTEEN-CELL ROUND-TRIP CAUGHT A REAL BUG IN THAT DERIVATION.**
`policiesFor` writes BOTH member levels against `app_user_id()` — `own` is
`"t"."owner_id" = app_user_id()`, `members` is `app_user_id() IS NOT NULL` — so
"mentions the function" called **seven of sixteen cells** `own` that are
`members`, in the direction that NARROWS a live table's access. It is the
EQUALITY that separates them. The guard asserts all sixteen exactly rather than a
floor, because a floor is what let it sit under a passing assertion.

**A DEPENDENCY CHECK, NOT A BLANKET REFUSAL** (owner: *"No client write grant
does not mean no writer: a function, job, import, or server operation may
populate the table"*). `missingPopulation` names a table only when this change
gave it a READER and nothing anywhere can fill it — a seed, a declared function
body, a job body or a client write grant all count, so every `display` table and
price list on the platform stays silent. **It reports; it never refuses.** The
owner's own Data panel is deliberately NOT counted as a path (it would make the
check vacuous) and is named in the sentence instead.

**AND THE SEED SKIPS REACH THE CUSTOMER.** `seedSiteRows` has answered
`{seeded, skipped}` since it was written and the skip list went into the
migration record, where only a developer with a token could read it —
`"repairs: only display tables are seeded"` is the single sentence that can say
why a brand-new table arrived empty, and run 47's customer never saw it. It is
accurate by construction: the engine only records a skip against the design's own
seed keys, so it can never imply seeding was required where it was not.

**`scripts/backend-repair.mjs`** — preview by default, `--apply` the only mode
that writes, `--verify` re-reads. **It verifies identity before writing**: the
plan says `backfill` (only `incomplete`; `ready` and `none` skipped by NAME), the
derived database ANSWERS, and it holds tables the stored spec declares. A
database that answers and holds none of them is REFUSED — writing the reference
there would point the platform at somebody else's data — and an empty one is
`unproven` rather than `verified`, because rounding that up is the reading this
whole change exists to stop. Repeatable by construction: the reference write is
fenced in the STORE (`unsetDbFilter`, both spellings of unset), and the recovery
only ADDS. Nothing here creates a database, drops a table or deletes a row.

**THE DERIVATION IS PROVEN OVER THE WHOLE CORPUS, credential-free: 27 of 27
sites with a recorded `neon_db` equal `dbNameForSite(slug)`, zero mismatches**,
and exactly **five** sites are `incomplete` — `ashgrove-1`, `fretwork-1`,
`northgroup-5`, `repairbench-1`, `washhouse-1`. Three sites are blank with no
project row and must NOT be touched.

**Guards**: `test/backend-repair.test.mjs` (**22**) drives the modules and the
script — every permission fixture DERIVED from `grantsFor`/`policiesFor` rather
than typed, because a hand-typed permission is a second copy of the emitter.
`test/addon-route.test.mjs` **27 → 40**, every state and both reports driven
through `POST /api/site/<slug>/addon` with no paid model call — including, for
the first time, **the whole provision path end to end** (Neon's control plane
stubbed in its own response shapes), because the line that fixes this at its root
sits at the end of a provision and a sweep mutant deleting it survived
everything until that existed: *a wall nobody can drive is a wall nobody is
guarding.*

**Three older guards went red and were re-anchored, not appeased**: the
Dockerfile's transitive import walk (the new module was missing from the image —
*staging is not enough*, and it is the guard written for exactly that), the
`let adb = await siteBackendBySlug(env, ownerSlug);` spelling, and the inline
`SELECT v FROM _meta` query. **Sweep: 45 mutants, 45 killed, 0 survived, 0 never
applied, 2 comment-only controls survived.** Fifteen survived the first pass and
**every one was a guard gap, not the product's**; two of the last three were the
recorded shapes rather than gaps and are declared in the code — swapping
`dbNameFromConn` for `dbNameForSite` is INERT (measured: the two agree on every
slug, because the connection is built from the second), and `seedSkipNote`'s two
empty checks are a deliberate PAIR, mutated together. **Suite 6,422** — 6,387 +
22 + 13, and the arithmetic closes exactly.

**NOT RUN LIVE, and the reason is a credential rather than a judgement.** The
backfill and the schema recovery both need `SUPABASE_SERVICE_KEY` and a Neon
connection; this session has neither (`scripts/grants-backfill.mjs` is in the
same position and for the same reason). The five sites are still `incomplete`,
and `count_booked_repairs` still counts `repairs` and answers `0`. **The owner's
press is what runs it**, exactly as with every paid harness here.
**CORRECTED 2026-09-15 by the first live preview**: this paragraph also said
`repairbench-1`'s `bookings` declaration was missing, and the preview measured
otherwise — the stored spec declares two tables and nothing live is undeclared.
See the preview entry at the end of the next section.

### …AND FIVE GAPS IN THAT REPAIR, EACH REPRODUCED BEFORE IT WAS FIXED (2026-09-15)

Owner, on the repair above: *"Enforce the identity condition… Separate reference
repair, schema recovery, and verification… Prove an existing database is empty…
Preserve behavior through the next apply… Finish the specific repairbench-1
repair."* Every one was DRIVEN before and after; nothing here is a source read.

**1. IDENTITY WAS CIRCULAR AND NON-BLOCKING.** `proveIdentity` compared the
catalog with `_meta` FROM THAT SAME DATABASE, which establishes that a database
is internally CONSISTENT and says nothing whatever about whose it is — and it
answered `ok: true, unproven: true` for a database holding a stranger's tables,
which the only caller read as `ok`. **Reproduced: a database answering
`["orders","products"]` with no `_meta` came back `{"ok":true,"unproven":true}`
and the write went straight to Supabase.** Identity is the AUTHORITATIVE MAPPING
now, as a chain from the site's own slug outward: the `site_project` row found
UNDER THIS SLUG → the connection built from it NAMING `dbNameForSite(slug)` →
`SELECT current_database()` agreeing. **Every link is required and there is no
"probably"**: `ok === proven` always, and `unproven` is gone. **The wall is in
`writeRef`, not at its call site** — a wall nobody can drive is a wall nobody is
guarding, and the guard proves an unproven proof never opens a socket, with the
control that a proven one does.

**2. THE THREE TASKS WERE ONE LOOP.** `main` filtered on `act === "backfill"`,
so a site with a good reference and a broken declaration was never looked at —
**and every site is in exactly that state the moment its reference is repaired**,
which makes the rerun the run that can never finish the job. `workList` is the
separation, spelled once and exported: `ready` **and** `incomplete`, because a
`ready` site is here for its SCHEMA and its reference is skipped BY NAME inside
`repairSite`. The demonstration the owner asked for is driven end to end —
reference written → recovery fails on the permission read → rerun, now `ready`,
completes the recovery — and neither task gates the other in EITHER direction.
**`--verify` used to parse the flag and then do nothing but skip the writes**; it
connects and reads five postconditions back now, and the one that matters is
"every live table declared", which is the run-47 state.

**3. "EMPTY" WAS AN INFERENCE.** A missing `_meta`, or a `_meta` with no schema
row, answered `{tables: []}` — from the absence of ONE ROW to the absence of
every table. **`readSchemaState` asks the CATALOG FIRST**, and the order is the
fix. Four outcomes: `stored` (with `missing` naming live tables the spec does not
declare — repairbench-1 today), `empty` (the catalog CONFIRMS no application
tables, the only state in which `{tables: []}` is true), `tables-without-metadata`
(recoverable), `unreadable`. A catalog we could not read is `unreadable`, never
"no tables". In the Worker, `specForAddon` RECOVERS the missing tables or STOPS —
the owner's own words, in that order — and it is READ-ONLY: nothing is written to
`_meta` as a side effect of reading it.

**4. RECOVERY CHANGED BEHAVIOUR ONE APPLY LATER — and this is the one proven
against a real PostgreSQL 16.** The first cut rebuilt `{name, columns, read,
write}` and dropped every flag. **Reproduced: a `trash` table whose live SELECT
policy reads `USING ((owner_id = app_user_id()) AND (deleted_at IS NULL))`
recovered without the flag, and `policiesFor` on that declaration emits
`USING (owner_id = app_user_id())`** — every soft-deleted row visible again on
the next schema change, days later, with nothing connecting the two. Two fixes
and only the second is a wall: flags are DERIVED from the artifacts the engine
leaves (a column it owns, or a trigger it names — `DERIVED_FLAGS`, read off
`site-schema.mjs`'s own DDL, with the `trg_<t>_del` read separating `sync` from
`timestamps`); and **the rebuilt declaration is run back through the REAL
`policiesFor`/`grantsFor`, INJECTED as `emit`, and compared with the database**.
**The policy comparison is EXACT and the grant comparison is ONE-SIDED**, and the
asymmetry is deliberate: every apply DROPs and re-CREATEs a table's policies from
its declaration, so the live policy IS the fingerprint of the true declaration
and any difference is ours — while a site that has had no schema change since
2026-09-13 still carries table-wide write grants and the next apply narrows them,
which is the platform's own fix. So grants are asked only "could this let a
client write something the database does not already let them write". **With no
`emit` every recovery is `uncertain`**: a caller that cannot verify must not
write, and an uncertain table is kept out of the spec entirely so the next apply
does not touch it.

**PROVEN BY POSTGRES, TWICE OVER — `test/integration/local-pg-recover.mjs`.**
Apply five tables spanning the flag space with the real `applySiteSchema` →
snapshot the permission surface → forget every declaration → recover → apply the
recovery → snapshot again → DIFF. **4 recovered and re-applied with NO change to
any policy, grant or column; `orders` (payable) correctly refused.** And the
NEGATIVE CONTROL is what makes that worth anything: the PRE-FIX algorithm on the
same databases **changed `notes` (lost its `deleted_at` filter) and `posts` (lost
both `expires_at` and `publish_at`)**.

**FOUR THINGS ONLY A REAL POSTGRES COULD HAVE SAID**, and every one was a defect
in code that read correctly:
- **`information_schema.column_privileges` EXPANDS a table-level grant across
  every column** — measured, not read off the docs. A table-wide `GRANT SELECT`
  on a four-column table appears there as four SELECT rows, so the column list
  means "column-scoped" only where `role_table_grants` has no row for the same
  pair. `RECOVER_QUERIES.grants` carries `lvl` for exactly that.
- **The predicate fingerprint kept the TABLE QUALIFIER.** `policiesFor` writes
  `"notes"."owner_id" = app_user_id()` and `pg_policies` stores
  `(owner_id = app_user_id())`; the emitted side carried a bare `notes` into the
  residue and fired `other` on all four commands of every member table. **No
  fixture would have shown it, because a fixture writes both sides in one hand.**
- **`GRANT INSERT ("body","title"), UPDATE ("body","title")` split flat** into
  the column `"update(title"` — the repository's own most-repeated regex trap, on
  the emitter for the member-write cell, which is `user` and `feed`.
- **`payment` IS AN OBJECT, NOT A BOOLEAN.** `normalizePayment` answers
  `{from, price, name, currency}` and `null` for anything else, so the probe's
  first `payment: true` fixture created no payment columns at all and the arm
  passed while proving nothing. A payable table is `uncertain` by name now
  (`UNDERIVABLE_EVIDENCE`) — **and the round-trip cannot see it**, because a
  payable table emits no write grant and no write policy and neither does a
  `{read:"none", write:"none"}` declaration, so the comparison is between two
  empty surfaces. That is why the refusal is a separate check.

**AND THE SWEEP FOUND A FALSE ALARM IN MY OWN FIX.** The payable refusal keyed on
all five `PAYMENT_COLUMNS`, so **a `display` price list declaring `currency` read
as payable and was refused recovery for a feature it has not got**. `currency`
and `amount_total` are ordinary words a designer writes; `payment_status` is not,
and the engine creates all five together, so one is sufficient and is the only
one with no false alarm. The same correction took the payment columns back OUT of
`MANAGED_COLUMNS`: `site-schema.mjs:1011` adds them to its managed set only FOR A
PAYABLE TABLE, and an unconditional union here strips `currency` off every
ordinary table — **a NARROWING the one-sided grant check allows through in
silence**.

**5. THE COUNT FUNCTION IS A SEPARATE OBJECT FROM THE DECLARATION.**
`scripts/repairbench-count-fix.mjs`, scoped to `repairbench-1` BY NAME (asserted
as a literal, because `process.env.SLUG || "repairbench-1"` reads identically in
a test and is anything at all in a shell). **`_meta.functions` stores
`{name, args, returns, internal}` and NO BODY** — `applySiteSchema` writes those
four fields and `normalizeSchema` drops a function whose body is empty — so the
stored declaration has nothing to correct and a later apply will not re-create
the function from it. **The body is rewritten from `pg_get_functiondef`, which is
already a complete `CREATE OR REPLACE` carrying the exact signature, language,
volatility, SECURITY DEFINER and search_path**, so changing ONE identifier
changes one identifier; rebuilding the statement from a template is how a repair
quietly takes SECURITY DEFINER off a function every RLS-bypassing read depends
on. Three refusals before it writes (absent · already names `bookings` · does not
name `repairs`), a word-bounded replacement, and a rename guard that is a
DECLARED second wall — `\brepairs\b` cannot match inside `count_booked_repairs`
because `_` is a word character, so the guard never fires while the boundary is
there, and the guard for it mutates the PAIR. **Verification is three numbers
that must agree**: `SELECT COUNT(*) FROM bookings`, the function called directly,
and the function through the site's OWN public RPC route — which is the call
`/status` really makes. **A 200 from `/status` is not one of them**: fetching the
document exercises no query at all, this repository's own recorded "a 200 is an
availability check and never a health check", and run 47 is the instance.

**Guards**: `test/backend-repair.test.mjs` **22 → 44**, `test/addon-route.test.mjs`
**40 → 44** (the four route cases drive the recovery through
`POST /api/site/<slug>/addon` with a `catalog` seam in Neon's own wire shape —
run 47's state recovered with its CONTROL, an unrecoverable table stopping the
step, an honestly empty database still working, and `_meta` not counting as a
disagreement). **Suite 6,448** — 6,422 + 22 + 4, and the arithmetic closes
exactly. **Five older guards were re-anchored, not appeased**, each naming the
property that moved: the six `reconcileSpec` call sites now hand in the real
emitters; `grantRows` and `policyRows` read with the product's own
`splitPrivileges` and `readParens` rather than a second parser; the apply-gate
guard's `indexOf('if (args.mode !== "apply")')` is GONE rather than moved,
because a position is a claim about run order only while the code between is
straight-line and the gate moved into `repairSite`; the identity case is a
PROPERTY rewrite; and `site-addon`'s schema-read anchor went from the whole
expression to the refusal and its reason — *assert the property, not the
spelling*, in the guard for the branch that decides whether a paid step designs
against a schema it could not resolve.

**Sweep: 92 mutants, 89 killed, 0 survived, 0 never applied, 3 comment-only
controls survived.** Twelve survived the first pass; **eleven were guard gaps and
one was the product's** (the `currency` false alarm above). Two of the twelve
were BADLY WRITTEN rather than gaps and were replaced with observable mutants
after being measured: a `why`-string change on the success path of
`proveIdentity` (inert — every gate still ran), and a payment-column union that
the correction had already removed. Two more are DECLARED redundancies mutated as
PAIRS: the rename guard beside the word boundary, and — measured over ten shapes
— `created` versus the declared column list, which emit identical grants for a
DERIVED declaration and diverge only for a PRIOR one naming a column the table
has not got yet, where handing `grantsFor` the really-created list is what stops
a perfectly good recorded declaration reading as a widening.

**STILL NOT RUN LIVE, and still for a credential rather than a judgement.** The
five sites are `incomplete`, `repairbench-1`'s `bookings` declaration is missing,
and `count_booked_repairs` counts `repairs` and answers `0`. The three presses
are the owner's: `node scripts/backend-repair.mjs --preview` (writes nothing),
then `--apply`, then `--verify`; and `node scripts/repairbench-count-fix.mjs`
preview → `--apply` → `--verify`.

### …AND FOUR FAILURES IN THAT REPAIR, FIXED THROUGH THE COMMANDS (2026-09-15)

Owner, on `3711218c`: *"Identity checks the wrong connection… The policy
comparison erases meaning… Both verification commands can exit successfully on
failure… Recovery cannot persist when `_meta` itself is missing."* And the
instruction that shaped the round: ***"Fix these through the actual command
paths."*** Every one was reproduced before it was fixed, and every fix is driven
through `survey → main` or through the script as a PROCESS.

**1. IDENTITY WAS ASKED ABOUT A CONNECTION THE QUERIES DO NOT USE.**
`site_project.neon_conn` is the PROJECT's connection and its path is the
project's default database — `/neondb` on every real row. `main` built its SQL
client with `connForDatabase(site.conn, site.db)` and handed the RAW `site.conn`
to `repairSite` and `verifySite`, so identity was asked about `/neondb` while
every query went to `/site_<slug>`. **Reproduced through `survey → main`:**
`{"ok":false,"proven":false,"why":"connection-does-not-name-the-intended-database","named":"neondb","expectDb":"site_repairbench_1"}`
— **refused at link 2, before the database was asked anything**, on all five
sites. The resolution moved INTO `survey`, which is the one place holding the
project row and the intended name at once: `conn` is built there and is what both
the identity check and the SQL client are given, so *the thing proved and the
thing queried cannot come apart again*. After: `proven: true`, `why:
"project-row-for-this-slug-names-a-database-the-server-confirms"` — **and the
mismatched control still refuses**, now at link 3 with
`server-answers-a-different-database`, which is the link that only exists because
the connection reached a server at all.

**2. THE POLICY FINGERPRINT ERASED THE THING A POLICY MEANS.** `predicateShape`
answered the SET OF FACTS a predicate mentioned. Driven:

    predicateShape("(deleted_at IS NULL)")     === "deleted_at"
    predicateShape("(deleted_at IS NOT NULL)") === "deleted_at"   // equal
    predicateShape("(a AND b)") === predicateShape("(a OR b)")    // equal

— **the same fingerprint for opposite rules**, so a `trash` table whose live
SELECT policy showed only the soft-DELETED rows recovered CLEAN and the next
apply emitted `IS NULL`: every visible row hidden and every hidden row visible.
The comparison is a CANONICAL BOOLEAN TREE now. `AND`/`OR`/`NOT` are structure
and are kept; each operand keeps its own text, so `IS NULL` and `IS NOT NULL`,
`=` and `<>`, `>` and `<` are different strings. **What is normalised away is
only what POSTGRES ITSELF rewrites** — quoting, table qualifiers, casts,
whitespace, case, the redundant parens it adds around a function argument, and
`true` under an AND — and `AND`/`OR` operands are SORTED, because both are
commutative and Postgres is free to reorder. After: `"deleted_at is null"` vs
`"deleted_at is not null"`, `and(…)` vs `or(…)`, and the reconcile answers
`uncertain: ["notes:policy-would-change"]` instead of recovering the reversal.

- **A PREDICATE THIS CANNOT PARSE IS REFUSED, NEVER COMPARED.** `canonPredicate`
  answers `{ok:false, why}` and `verifyDeclaration` turns that into
  `policy-not-comparable` — the table is left alone, which is the fail-closed
  direction. **A refusal must never fold into the `""` an ABSENT clause answers**
  (an INSERT policy has no USING and a SELECT policy has no WITH CHECK, and
  "absent" is a real answer both sides agree on), so `pairShape` carries the
  refusal out rather than rendering it into a string that could equal another.
- **THE ONE LIMIT, STATED IN THE CODE**: grouping parens inside an operand are
  dropped only where BOTH neighbours are edges (`undefined`, `(`, `)`, `,`) —
  the shape Postgres creates around a function argument. A pair adjacent to an
  operator is KEPT, so `(a + b) * c` cannot collapse into `a + (b * c)`.
- **`IS NOT NULL` IS NOT A `NOT`.** The parser reads `not` as the operator only
  when it STARTS an operand; inside `x IS NOT NULL` it belongs to the atom.
- **THE REAL-POSTGRES PROBE GAINED THE COUNTEREXAMPLE.** A `notices` table
  (`display` + `trash`) makes Postgres store `(true AND (deleted_at IS NULL))`,
  which is the `true`-fold and the redundant-paren rule in one live artifact.
  `test/integration/local-pg-recover.mjs` now reads **5 tables recovered and
  re-applied with NO change to any policy, grant or column; the pre-fix control
  changed 3** (`notes`, `posts`, `notices`).

**3. BOTH VERIFICATIONS COULD EXIT 0 ON FAILURE.** `backend-repair --verify`
printed *"0 verified, 1 not verified"* and exited **0**; `repairbench-count-fix
--verify` observed `bookings=3, direct=0, route=0`, fell through to the preview
branch and exited **0**. **Anything reading either as a command — a shell, a
runbook, a workflow step — read that as a pass.** Both now have an EXPLICIT
verify mode that always checks its postconditions and exits nonzero when they
fail. Two shapes worth keeping:

- **IN VERIFY MODE "NOTHING TO DO" IS NOT A PASS.** A named slug matching no
  reachable site is a postcondition that FAILED — the site was supposed to have a
  database by now. It falls THROUGH to the tally rather than returning with its
  own copy of the exit rule, so **one place decides** and `!verified` there is
  load-bearing instead of a second belt. (A sweep survivor found that: as an early
  return, `!verified` was unreachable.)
- **THE COUNT-FIX'S VERIFY SITS ABOVE THE REWRITE.** Its three postconditions are
  the three numbers agreeing, the route answering 200, and `rewriteDefinition`
  finding nothing left to do; a verification placed after the rewrite logic would
  be reporting on a decision rather than on the database.

**AND AN EXIT CODE IS NOT OBSERVABLE FROM INSIDE THE MODULE** — `main()` is not
exported and `process.exitCode` is set on the way out, which is exactly how a
verification that PRINTED its own failure came to exit 0 with every unit guard
green. `test/repair-commands.test.mjs` (**10**) spawns both scripts:
`node --import test/fixtures/repair-process.mjs scripts/<x>.mjs --verify`.
**ONE `globalThis.fetch` installed before the script's module graph loads covers
BOTH halves** — Supabase is plain `fetch` and Neon is `@neondatabase/serverless`,
which is `fetch` over HTTP — so nothing is stubbed, re-implemented or replaced:
the real `main()` runs, the real argument parsing runs, and the process exits
however it really exits. **The scenario is a JSON file the preload writes back on
exit**, because `apply → verify → repeat` is three PROCESSES and a fixture that
reset between them would have the verify checking the state the apply started
from, and the repeat would be a first run wearing a second run's name.

**4. RECOVERY COULD NOT PERSIST WHEN `_meta` ITSELF WAS MISSING.** The write was
one `INSERT … ON CONFLICT`, so the `tables-without-metadata` state — the one the
whole recovery exists for — reproduced as
`{"act":"failed","why":"write-failed","detail":"relation \"_meta\" does not
exist"}`, with the recovery correct and unwritable. **Absent TABLE and absent ROW
are separate cases now**: `readSchemaState` already told them apart
(`why: "no-meta-table"` versus a read that succeeded and found no row), so
`recoverSchema` carries `metaTable` out and the write creates the table first
**using the engine's own statement**. `META_TABLE_SQL` is exported from
`site-schema.mjs` and `applySiteSchema` uses it too — one copy, so a repair
cannot create a `_meta` the platform would not have created.
**Proven apply → verify → repeat as three processes**: the apply issues
`CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)` and then the
INSERT and answers `act: "recovered", created: "_meta"`; the verify reads
`1 verified, 0 not verified` and exits 0; the repeat reads `schema: nothing
missing`. **And the guard asserts the negative**: across all three processes no
statement issued a `DROP`, an `ALTER`, a `TRUNCATE`, a `CREATE TABLE` for
anything but `_meta`, or an `INSERT` into anything but `_meta` — *no application
table was altered*, which is the half an "it worked" reading cannot establish.

**Guards**: `test/repair-commands.test.mjs` (**10**, new) — verify exits 1 on a
failed postcondition; verify reaches the SITE's database and not the project's
(asserted from the database each statement really went to, recorded per
statement); verify fails when the named slug has no reachable database; apply →
verify → repeat over a `_meta`-less database with the application-table negative;
preview writes nothing and exits 0; apply exits 1 when identity refuses; the
count-fix's verify exits 1 while the function counts the wrong table; its apply →
verify passes and a second apply refuses `already-names-bookings`; its verify
fails when the route disagrees with the direct call; and the correction never
leaves `repairbench-1`. `test/backend-repair.test.mjs` **44 → 50**.

**Four older guards were re-anchored, not appeased**, each naming the property
that moved: the predicate guard went from a feature-vocabulary expectation to
`differ`/`same` over the canonical form (with the owner's own counterexample end
to end, and `policy-not-comparable` separated from an absent clause); the survey
guard reads `conn` rather than `projectConn`; the recovery guard asserts the
`_meta` creation by the engine's own statement rather than by its text; and the
`_meta` write anchor moved off `INSERT INTO _meta` alone. **One census guard was
ADDED rather than a mutant written**: `META_TABLE_SQL`'s revert is inert by
construction (the literal and the constant are the same bytes), so the guard
counts the copies of that DDL in the tree instead — `worker.js` keeps exactly two
pre-existing literal copies and the count is pinned, so a third cannot appear
unnoticed.

**Sweep: 111 mutants, 111 killed, 0 survived, 0 never applied, 3 comment-only
controls survived.** Pass 1 killed 108 and three survived — **none of them the
product's**. Two were measured INERT and are declared in the code rather than
deleted: the call-paren `continue` in `dropRedundantParens` (redundant with the
`edge(before)` test, measured identical over five real shapes, so the PAIR is
mutated together), and `!verified` (which the early return made unreachable — the
code was restructured so the line matters, rather than the guard being widened
around it). The third was `META_TABLE_SQL`'s inert revert, closed with the census
above. All three were replaced with observable mutants and pass 2 is the tally.
**Suite 6,464 green.**

**STILL NOT RUN LIVE, and still for a credential rather than a judgement.** The
five sites are `incomplete`, `repairbench-1`'s `bookings` declaration is missing,
and `count_booked_repairs` counts `repairs` and answers `0`.

### …AND THE NORMALISER STILL ERASED SQL MEANING BEFORE PARSING (2026-09-15)

Owner, on `2a6cc32c`: *"`scrubPredicate` lowercases everything and removes
identifier quotes… a live policy `USING ("true")` on a boolean column named
`true` is accepted as equivalent to the generated `USING (true)`… String
literals `'APPROVED'` and `'approved'` also compare equal. Preserve quoted
identifiers and literal contents during tokenization. Do not discard casts or
qualifiers unless their equivalence is established for the supported
expression."*

**THE FIX WAS ONE LAYER TOO LATE.** The canonical boolean tree was right; what
fed it was a REGEX OVER THE WHOLE STRING, and a regex cannot tell a quoted
identifier from the word it spells or a literal's contents from SQL. Five
reproduced, each a real PostgreSQL 16 storage form:

    "true"           -> true            …and `true` is AND's identity, so
                                        `(owner_id = app_user_id()) AND "true"`
                                        folded to just the first half
    'APPROVED'       -> 'approved'      two different rows
    other_table.col  -> col             a policy reading ANOTHER table
    1::int           -> 1

**THE LEXER RUNS ON THE RAW TEXT NOW AND NORMALISES ONE TOKEN AT A TIME**: a
bare word lowercases (Postgres folds unquoted names), a STRING LITERAL is kept
verbatim, and a QUOTED identifier keeps its content and keeps its quotes unless
the content is a bare lowercase name that is not a `SYNTAX_WORD`. A quoted token
starts with `"` and a literal with `'`, neither of which a bare word can
produce, so the three can never collide downstream.

- **`SYNTAX_WORDS` IS DERIVED FROM THE COMPARATOR, NOT FROM POSTGRES.** It is
  `BOOL_WORD ∪ {not, true}` — the words `parsePredicate` and `foldTrue`
  themselves give meaning to — so it cannot drift from them and is **not a copy
  of Postgres's reserved-word list**. **THE UNQUOTING IS SYMMETRIC**, which is
  what makes that sufficient: a name Postgres keeps quoted because IT reserves
  the word (`"user"`) unquotes on BOTH sides and still matches our own emitter,
  which quotes everything. Driven.
- **EACH EQUIVALENCE IS MEASURED, AND THERE ARE EXACTLY TWO.** Our emitter
  writes **8 distinct predicate expressions across all 16 read×write cells and
  every flag, and ZERO casts** — so a cast can only arrive from Postgres, and
  the one place it does is a STRING LITERAL: `to_char(now() AT TIME ZONE 'UTC',
  '…')` comes back as `to_char((now() AT TIME ZONE 'UTC'::text), '…'::text)`.
  So **`::text` directly after a string literal is dropped and nothing else is**
  — `1::int`, `col::text` and `'x'::uuid` are kept, each reads as a difference,
  and the table is left alone. The second is the qualifier: `policiesFor` writes
  `"t"."owner_id"` and `pg_policies` stores `owner_id`, so a qualifier naming
  **the table the policy is ON** is dropped and no other. **WITH NO TABLE NAME
  NOTHING IS STRIPPED** — a caller that cannot say which table it is asking
  about gets the strict comparison, not a lenient one.
- **THE TABLE IS THREADED** through `canonPredicate` → `pairShape` →
  `statementShape` → `emittedPolicyShapes`, because the emitted side needs it as
  much as the live side; reading only one side through it is its own mutant.

**PROVEN BY POSTGRES, AND THE PROBE GAINED ITS NEGATIVE ARM.**
`test/integration/local-pg-recover.mjs` is **5 recovered with no change and the
flag-stripped control changing 3**, unchanged — plus:

- **ARM 3a, END TO END**: a live `notes` policy narrowed by a real boolean column
  named `true`. **The OLD comparator called it equal to our emitted policy** (so
  the recovery would have dropped the conjunct and widened the policy); the new
  one refuses `policy-would-change`, the reconcile leaves `notes` out of the
  spec, and applying that spec leaves the table **exactly as it was**.
- **ARM 3b**: eight pairs CREATEd as real policies and read back out of
  `pg_policies` — 2 that must canonicalise the SAME and 6 that must DIFFER, with
  the observer proved alive in both directions. Three of the six are marked in
  the output as ones the old comparator called equal.
- **A BARE FOREIGN QUALIFIER IS DRIVEN IN THE UNIT GUARD, NOT HERE** — Postgres
  cannot STORE `other.col` in a policy on `m`; a predicate reaching another
  table has to be a subquery. Saying so beats a probe row that claims to test
  something Postgres never holds.

**AND THE REPAIR'S SCOPE IS A WALL IN THE SCRIPT.** `REPAIR_SITES` names the
five sites by hand and `workList` asks it FIRST, so a site outside it is never
reached by anything downstream whatever state it is in. **A `--slug` off the
list is refused BY NAME with exit 2 and nothing is read** — a silent filter
prints "nothing to do", which reads as *"that site was already fine"*, the one
answer a person running a repair must never get by accident. The count
correction stays `repairbench-1` by literal, with no slug input at all.

**THE LIVE PATH IS TWO DISPATCH-ONLY WORKFLOWS** — `.github/workflows/backend-repair.yml`
and `repairbench-count-fix.yml`, both `preview` by default, both taking the
service key from Actions secrets the way `grants preview` does, both requiring
the typed word `apply` to write, both uploading their log `if: always()`.
`test/merge-triggers.test.mjs` is a census and still requires `deploy.yml` to be
the only workflow a push to main starts.

**AND A STEP THAT PIPES INTO `tee` REPORTS TEE'S STATUS UNLESS THE SHELL IS SAID
OUT LOUD (2026-09-15, owner: *"neither declares `shell: bash` nor enables
`pipefail`… a failed repair or verification can therefore produce a green step
because `tee` succeeded"*).** GitHub's UNSPECIFIED Linux shell is **`bash -e
{0}`** — `set -e` with **no `pipefail`** — and a pipeline's status is its LAST
command's. **MEASURED with a stub exiting 1: under `bash -e` the step exits `0`;
under `shell: bash` (`bash --noprofile --norc -eo pipefail {0}`) it exits `1`;
the log is byte-identical (73 bytes) either way**, so nothing is traded for it.
GitHub's own job log prints `shell: /usr/bin/bash -e {0}` above every
unspecified step, which is where the default can be read rather than recalled.
- **THIS IS THE `--verify` DEFECT ONE LAYER UP.** Both scripts were given an
  explicit verify mode *precisely* so a failed postcondition exits nonzero; a
  workflow that swallows it restores "a verification that PRINTS its failure and
  REPORTS success" at the step level. The two walls are independent and both are
  needed.
- **THE GUARD DRIVES THE COMMAND, IT DOES NOT GREP FOR THE SPELLING.**
  `test/repair-workflows.test.mjs` reads the step's `shell:` and its real `run:`
  text out of the YAML, then EXECUTES that text under the argv that shell
  implies, with `node` replaced by a stub whose exit code the case picks. So
  **`shell: sh` fails here** where a name check would pass, and deleting
  `shell: bash` goes red for the real reason. **The default-shell case is the
  CONTROL** — without it, "the failing stub exits nonzero" could be true for
  some reason other than pipefail.
- **A CENSUS, NOT A LIST OF TWO**: every `run:` line in the directory that pipes
  into `tee` must sit under a pipefail shell. **MEASURED: exactly 2 such lines
  exist**, both `shell: bash` — and the scan reads RUN BLOCKS ONLY, so the
  prose above these steps (which quotes `| tee` while explaining the rule) is
  not counted. That is this file's own "prose contains the thing it forbids",
  met in a census, and a mutant widening the scan to comments is killed.
- **`keepsPipeFailure` IS A DECLARED REDUNDANCY**: with the workflows correct,
  replacing its body with `true` changes no result, because the cases still
  execute under `SHELL_ARGV`'s argv. Measured, declared in the code, and the
  observable mutants live on `SHELL_ARGV` and on the workflow files instead.
**Sweep: 13 mutants, 13 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** — each workflow losing its shell, each naming `sh` instead,
stderr off the log, the log not written, the guard's model of either shell
altered, the stub off `PATH` (so the real node runs and no case is about the
shell), the census matching nothing or matching comments, the failing stub made
a success, and the step reader ignoring `shell:` altogether.

**Guards**: `test/backend-repair.test.mjs` **50 → 50** (the predicate case
rewritten onto the new property: the five erasures as `differ` rows, the two
measured equivalences and the symmetric-unquoting row as `same`, and the bare
foreign qualifier both with a table and without) and `test/repair-commands.test.mjs`
**10 → 11** (the scope wall driven as a process: an out-of-scope slug exits 2,
reads nothing and does not say "nothing to do", with the control that a run with
no slug still visits the five). **Three older guards were re-anchored, not
appeased**: two fixtures moved onto real in-scope slugs because `workList` asks
the scope first now, and the `verify`-with-no-database case moved onto an
in-scope name because the scope refusal is its own case.

**MERGED AND DEPLOYED — deploy 2120, 2026-09-15 06:38:31→06:41:17Z, green in
2m46s**, on `main` `1f2d98ed` → `9a4ac614` (fast-forward, 14 commits, 23 files,
+8,745/−41). The whole repair — the four states, the recovery, the comparator,
both scripts and both workflows — is live.

- **THE IMAGE ID WAS COMPUTED BEFORE THE MERGE AND MATCHED, and this is the
  second time that technique has been cross-checked against reality.**
  `origin/main` → **`16cb42353dc4a343`** (180 inputs), which is EXACTLY what run
  47's pre-flight read off the live container; the tip → **`6246eb17cd6595c4`**
  (182 inputs, the two new modules). The deploy then printed `built
  isibi-app-sitebuildcontainer:6246eb17cd6595c4 (registry answered 404; 182
  inputs off ./Dockerfile)`.
- **AND THE ID IS WHAT MADE THE HARNESS COVERAGE EXACT.** `c5b59cc6` (the tree
  `site build` 1142 ran on), `b6e4939c` and `9a4ac614` all hash to the SAME
  `6246eb17cd6595c4` — so 1142's green covers the merged container by the id not
  moving, which is a stronger statement than reading a `paths` list.
- **CONTAINER ROLLED at 06:41:13.7Z**: `EDIT isibi-app-sitebuildcontainer`,
  `16cb42353dc4a343` → `6246eb17cd6595c4`, `SUCCESS Modified application` —
  **read out of the log's own diff rather than inferred from the step's
  duration**. So the 15–20 minute hold ran to ~06:56–07:01Z.
- **WORKER**: `Uploaded isibi-app (3.54 sec)`, `Deployed isibi-app triggers`,
  `Worker Startup Time: 26 ms`, `Total Upload 3446.05 KiB / gzip 928.42 KiB`.
  Image step 2m06s, Wrangler 17s. **`No updated asset files to upload`** — 99
  files read and none changed, because `public/` is untouched and the new
  modules are bundled into the script, **so there is no file-hash check for this
  deploy**; the standby is the gate discriminator (`/api/site/build-health`
  **401**, `/api/site/runtime` **401**, `/api/site/job-probe` **401**,
  `/api/nope-not-a-route` **404**).
- **REGRESSION: BYTE-IDENTICAL, baseline taken BEFORE the push and compared
  after.** Six sites 200 at the same sizes (repairbench-1 45,947 · fretwork-1
  58,285 · ashgrove-1 31,120 · northgroup-5 1,641 · washhouse-1 52,404 ·
  ben-crowe-guitar 52,060), `/status` 200/5,970 on the same
  `x-site-version 01789437370636-f11bde`, and `count_booked_repairs` still `0`.
  Correct on both counts: a Worker deploy changes nothing a visitor sees until a
  site republishes, and the `0` is the unrepaired defect, not a regression.
- **THE MERGE GATE IS PROVEN CLOSED FROM GITHUB'S OWN SIDE**: both workflows
  answered **404** to `GET /actions/workflows/<file>` before the merge and are
  registered now — `backend repair` id **358472078**, `repairbench count fix`
  id **358472079**, both `state: active`, both `blob/main`.
- **AND THE SESSION STILL CANNOT PRESS, RE-TESTED RATHER THAN ASSERTED.** The
  dispatch answers **403 `Resource not accessible by integration`** through the
  MCP tool AND through a direct REST POST with the right endpoint, headers and
  body — **with the control that the SAME credential reads that workflow at
  200**, and `X-Accepted-Github-Permissions: metadata=read` on the repo read.
  The 403 is sharper than the old one: the endpoint now RESOLVES (403, not 404),
  so the only thing left is `actions: write`.

### AND THE FIRST PREVIEW RAN — identity proved, and it CORRECTED THIS FILE

**`backend repair` run 1, 2026-09-15 06:55:20Z, `--preview --slug repairbench-1`,
green, nothing written.** The owner's press; the log is artifact
`backend-repair-log` (443 bytes). Verbatim:

```
mode: preview  slug: repairbench-1
scope: ashgrove-1, fretwork-1, northgroup-5, repairbench-1, washhouse-1
1 site(s): 1 with a database (incomplete 1)
repairbench-1 [incomplete]: identity PROVEN (project-row-for-this-slug-names-a-database-the-server-confirms)
    reference: would-write site_repairbench_1
    schema: nothing missing (2 declared)

0 reference(s) written, 0 schema(s) recovered, 0 refused on identity, 0 failed.
```

- **IDENTITY PROVED, and the `why` names the whole chain** rather than a verdict:
  the `site_project` row found under THIS slug → a connection naming
  `dbNameForSite(slug)` → `SELECT current_database()` agreeing. The fix for
  "identity was asked about a connection the queries do not use" is live: the
  resolution happens in `survey`, so the thing proved and the thing queried are
  one connection.
- **THE SCOPE WALL PRINTED ITSELF** — `scope:` lists the five before anything is
  read, and a named slug narrowed the run to `1 site(s)`. The other four were
  never touched.
- **`shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}`** is in the
  run's own header, so the pipefail fix is live and readable rather than assumed.

**AND `repairbench-1`'s `bookings` DECLARATION IS NOT MISSING. This file said it
was, and the live database says otherwise.** `nothing-missing` is
`rec.changed === false` — `reconcileSpec` found NO live table the stored spec
fails to declare — and `kept.length` is **2**, which is the stored spec's own
entries (the `empty` branch returns `kept: []`, so this is a real spec with two
of them). Every live application table is declared, and `bookings` is live (run
47's control inserted into it), so `bookings` IS declared.
**What is falsified is the claim about THIS SITE's stored spec, not the module
measurement**: `mergeAddonSchema({tables: []}, …)` answering `["repairs"]` was
driven directly and stands. What wrote `bookings` back into `_meta.schema`, or
whether it was ever absent, is **unknown from here and is not being guessed** —
a preview reads, and reading is what it did.
**The consequence is that the apply is SMALLER than planned**: on this site it
is exactly one write, `site_backends.neon_db` ← `site_repairbench_1`, and the
schema half is a no-op. No database table, row, policy or grant is touched.

**NOTHING WAS REFUSED, AMBIGUOUS OR UNRECOVERABLE**: no `LEFT ALONE (would
change behaviour)` line, no `LEFT ALONE (access not derivable)` line, no
`CANNOT RECONCILE`, and `0 refused on identity, 0 failed`. Those lines are
printed when non-empty, so their absence is an answer and not a silence.

### A REFERENCE-ONLY APPLY, BECAUSE A PREVIEW BOUNDS NOTHING (2026-09-15)

Owner: *"Keep the approval limited to the one reference write. Another preview
does not enforce that boundary, and retrospective checking cannot undo an
unauthorized schema change."*

**BOTH HALVES OF THAT ARE STRUCTURAL AND I HAD OFFERED THE WRONG ANSWER.**
`repairSite` plans and writes in the SAME pass, so there is no moment between
"what would change" and "it changed" for a person to stand in — a preview is a
statement about a run that already ended, and the run after it is unbound. And
the schema write is `INSERT INTO _meta … ON CONFLICT DO UPDATE`, which no later
reading undoes. **Separating the TASKS (done earlier) is not the same as
bounding a RUN, and only the second is what an approval needs.**

**`--apply-reference` IS A MODE, NOT A SECOND INPUT.** One selection with one
meaning, offered in the form's own dropdown. A `--reference-only` flag beside
`--apply` would be a two-field invariant, and this repository's rule is that an
input cannot be the wall — a forgotten flag fails OPEN, which is the direction
that writes.

**THE BOUNDARY IS TWO LISTS AND BOTH GATES READ THEM AND NOTHING ELSE:**

    export const WRITES_REFERENCE = Object.freeze(["apply", "apply-reference"]);
    export const WRITES_META      = Object.freeze(["apply"]);

so "may this mode write X" has exactly one answer per X, in one place. **An
unknown mode writes NOTHING** — `includes` on a frozen list fails closed, driven
over `""`, `"APPLY"`, `"apply-everything"`, `"reference"` and `undefined`,
because a typo must not fall through to the widest behaviour.

**WITHHELD IS NOT THE SAME AS NOT-YET**, and they need different sentences: a
preview reports what an apply WOULD do; `apply-reference` reports what it
DELIBERATELY DID NOT DO on a run that wrote something else. The output says
`schema: NOT APPLIED — this run is reference-only; no _meta was created or
updated`, names the outstanding work by table, and tallies it separately
(`1 schema(s) REPORTED AND NOT APPLIED`) so `0 schema(s) recovered` cannot be
misread as "there was nothing to do". **A withheld schema is not a failure** and
changes no exit code; a refused identity still does.

**THE CONFIRM GATE USES `startsWith(mode, 'apply')`, DELIBERATELY.** A list of
two names in the workflow would be a second copy of `WRITES_REFERENCE`, and the
copy that drifts is the one that stops demanding the word. A prefix test errs
toward DEMANDING confirmation for a mode it has never heard of: the cost of a
false demand is typing `apply`, and the cost of a false exemption is an
unconfirmed write. The census asserts every member of `WRITES_REFERENCE` starts
with `apply`, so a writing mode cannot be named around the gate.

**DEMONSTRATED THROUGH THE COMMAND, WITH THE OBSERVER PROVED ALIVE.** The
scenario is the one where a full apply DOES write `_meta` — blank reference, a
live `bookings` the spec does not declare, and no `_meta` table at all — and
the control runs `--apply` on it first, because a database with nothing to
recover would pass with the gate deleted:

```
A. --apply            reference: written site_repairbench_1
                      schema: recovered ["bookings[]"]
                      _meta: SELECT v FROM _meta … / CREATE TABLE IF NOT EXISTS _meta … / INSERT INTO _meta …

B. --apply-reference  reference: written site_repairbench_1
                      schema: would-recover ["bookings[]"]
                      schema: NOT APPLIED — this run is reference-only; no _meta was created or updated
                      1 reference(s) written, 0 schema(s) recovered, 0 refused on identity, 0 failed.
                      1 schema(s) REPORTED AND NOT APPLIED (reference-only).
                      _meta: SELECT v FROM _meta …            ← the READ, and nothing else
                      store after: neon_db='site_repairbench_1'  metaTable=False  meta=None
```

**The refusals are kept and driven under the narrow mode too**: a wrong
`current_database()` exits 1 with no Supabase write AND no `_meta` write, and a
second `--apply-reference` answers `already-set` — the store fence
(`unsetDbFilter`) is unchanged — while STILL reporting the outstanding recovery,
because a repeat must not quietly stop mentioning work it is not doing.

**Guards**: `test/repair-commands.test.mjs` **11 → 14** (the demonstration with
its control, the wrong-identity refusal, the repeat) and
`test/backend-repair.test.mjs` **50 → 51** (the boundary census: both lists
pinned exactly, both predicates over every mode and five junk values, the flag
reaching the mode, the form offering it, and the confirm gate covering every
writing mode). **Suite 6,476** — 6,472 + 4, closes exactly. **CI HAS READ IT:
`unit tests` run 2570 on `0f471f21`, green (the suite step 92.9 s) —
`# tests 6476 / # pass 6473 / # fail 0 / # skipped 3`**, against local
`6476 / 6476 / 0 / 0`. **No `site build` fired and none was due**: the seven
changed files are two documents, a script, a mutant spec, two guards and a
workflow, and none is under `builder/**`, `worker.js` or any other glob in that
workflow's `paths`.

**Sweep: 14 mutants, 14 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** — `WRITES_META` gaining the narrow mode, `WRITES_REFERENCE`
losing it, either gate asking the mode instead of the list, `writesMeta`
widening to a prefix, **the flag silently parsing as `apply`** (the most
dangerous of them: a reference-only press applying everything), the `withheld`
mark dropped, the NOT APPLIED sentence softened, the tally uncounted, the exit
rule narrowed, the form no longer offering the mode, and the confirm gate
narrowed so reference-only writes with no typed word.
**Two survived the first pass and BOTH were the recorded test-side class, proven
rather than assumed**: each weakened an assertion inside
`test/repair-commands.test.mjs`, and **nothing outside the mutant spec reads
that file**, so no other test can observe it — inert by construction. They were
REPLACED with observable mutants of the same properties: the demonstration's
SCENARIO altered so it needs no recovery (the control assertion fires, proving
the control is load-bearing), and the schema `act` collapsed so reference-only
reports `nothing-missing` over real outstanding work. Both killed on pass 2.
**The statement-log check and the store read-back are a DECLARED redundancy** —
two windows on one event, kept because they fail differently, and said in the
code because a sweep cannot say it.

**STILL NOT REPAIRED.** The five sites are `incomplete` (only `repairbench-1`
has been previewed), the reference is unwritten, and `count_booked_repairs`
still counts `repairs` and answers `0` — which the backend repair does not fix
and never claimed to: that is `scripts/repairbench-count-fix.mjs`, a separate
object.

### The write grants are column-scoped (2026-09-13)

Owner: *"fix the managed-column permission gap, covering INSERT and UPDATE while
preserving legitimate operations."*

**THE INSERT HALF WAS THE WIDER ONE AND MY OWN PASS/FAIL HAD CALLED IT A PASS.**
That reading asked *can a member UPDATE this table at all*, which is the right
precondition for UPDATE and the wrong question for INSERT: `write: anyone` — the
`collect` preset, **the commonest table this platform builds** — emitted
`GRANT INSERT ON "<t>" TO anonymous`, table-wide, to a visitor signed in to
nothing.

    GRANT INSERT ("name", "email", "detail") ON "requests" TO anonymous;
    GRANT SELECT, DELETE ON "requests" TO authenticated;
    GRANT INSERT ("title"), UPDATE ("title") ON "requests" TO authenticated;

- **POSTGRES HAS TWO GRAMMARS AND THEY CANNOT BE MIXED** — `GRANT SELECT, INSERT
  (a)` is a syntax error — so table verbs and column verbs are separate
  statements. `DELETE` takes no column list; **`SELECT` stays table-wide
  deliberately**, because a member must read `id` and `created_at` to render a
  row and reading a managed column was never the exposure.
- **A GRANT, NOT A TRIGGER.** A BEFORE INSERT trigger forcing the managed columns
  would re-state every DDL DEFAULT in a second place. A column grant says it once
  and the DEFAULT fills in, so **nothing legitimate loses a write**.
- **`writableColumns(t, created)` USES THE REALLY-CREATED LIST, and `created`
  wins**: a GRANT naming a column the table has not got fails WHOLE, and
  `applySiteSchema` logs a failed statement and carries on — one absent name
  would leave a site silently refusing every form submission.
- **REVOKING A TABLE PRIVILEGE AUTOMATICALLY REVOKES ITS COLUMN PRIVILEGES**
  (Postgres docs), so the `REVOKE ALL` pair already at the head of `grantsFor`
  covers a table moving `user` → `display`. **That pair is why this is worth
  anything on a live site**: Postgres keeps BOTH a table-level and a column-level
  grant and the table-level one still covers every column, so a narrow grant
  added beside the old one would change nothing.
- **A table with nothing declarable is REPORTED, not quietly made read-only** —
  `GRANT INSERT ()` is not a statement, and the design tool sets no minimum
  column count.

**MEASURED over all 16 read×write cells by driving `grantsFor`:**

- **PASS — `write: none` and `write: anyone`** (`display`, `collect`, `admin`):
  no member UPDATE grant at all. **Every payment column is in this class**,
  because a payable table is taken out of the write grants entirely.
- **FAIL — `write: own` and `write: members`** (`user`, `feed`): the UPDATE policy
  names only `owner_id`, so `id`, `created_at`, `updated_at` and (where the flags
  create them) `pinned`, `position`, `deleted_at` had nothing in the SQL stopping
  a member writing them. On `write: members` the reach is **any row**.
- **The answer depends only on the WRITE axis** — pinned, so a future read level
  that quietly granted UPDATE would be a silent widening.

**THE INFERENCE IS CLOSED: a real PostgreSQL 16**
(`test/integration/local-pg-grants.mjs`, **29 cases, no Neon, no network**).
**Nothing is typed in it**: the DDL comes out of the real `applySiteSchema`
through a `fetch` seam, and the OLD grants come out of GIT at run time
(`git show 8e8ac5eb^:site-rls.mjs`), so the "existing table with the old
permissions" half is the state a real pre-fix apply LEFT. Under the old grants an
anonymous visitor could choose `id`, backdate `created_at` and forge
`updated_at` on a booking form; under the fix each is `permission denied for
table`, every legitimate write still succeeds, and a second apply is
byte-identical. **`owner_id` and `deleted_at` were already out of reach and RLS
is why** — said out loud rather than letting the fix take credit for a wall it
did not build.
**EVERY ANSWER IS READ FOR ITS REASON, IN BOTH DIRECTIONS.** A refusal from the
wrong gate reads exactly like the fix working, so each case NAMES the gate it is
about. And **an ALLOWED that touched no row is not an allowed write**: `UPDATE …
WHERE` matching nothing SUCCEEDS, and RLS filters rows out in SILENCE — **three
cases read as successful writes until the command tag was parsed.**
**AND THE ON-SPLIT IS LOAD-BEARING**: the verb comes from BEFORE the `ON`,
because `GRANT SELECT ON "update"` contains the word UPDATE. The two readings
diverge on **7 of 16 cells** for that name and **0 of 16** for any name that does
not contain the verb, so the census runs over both.

**THE REACH, named rather than glossed: nothing triggers the fix on its own.**
`applySiteSchema` has exactly three callers and all three are customer-driven;
there is no backfill, no migration, no cron, and `site_rebuild` republishes
without calling it. So it is **per-site and lazy** — an existing site keeps its
table-wide grants until its owner next changes something schema-shaped, which may
be never. **Open.** `scripts/grants-backfill.mjs` is ready — preview (the
default, writes nothing), apply, verify, rollback; grants only; the column list is
the INTERSECTION of the stored schema and what the table really has, anything
missing NAMED; **verification has two halves** (no table-level write grant AND
the column grants name exactly the writable columns — a table where the REVOKE
landed and the GRANT did not satisfies the first and cannot take a booking);
rollback rebuilds from each table's recorded `relacl`/`attacl`. **Not run.**

**THE INVENTORY: 70 sites, 31 with a Neon project, 39 frontend-only.** Which of
the 31 carry a table-wide client write is deliberately NOT measured here —
answering it means reading each site's `_meta.schema` through the connection
string in `site_project.neon_conn`, and **a live credential does not go into a
session transcript for a count**. `--preview` answers it from where the
credentials already live.

**ONE LIVE CREDENTIAL RULE, in the backfill's own workflow.** The risk is not the
deliberate log line; it is **a driver error whose MESSAGE quotes the URL it was
handed**. `safeErr` is the one scrubber every message goes through, and **the
rule is the URL's own grammar rather than a list of secrets**: any
`scheme://user:password@` becomes `scheme://***@`. A list has to be kept, and the
one it misses is the one that leaks. **The HOST is deliberately kept** — the
owner asked for the database identities reported, and the credential is the half
that must go.


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
- **Balance: 161 credits** (read off the ledger by the harness itself at the end
  of run 47, 2026-09-15 02:00Z). The two verification runs on `repairbench-1`
  took it 182 → 174 (run 46, the `bookings` setup, **8**) → 161 (run 47, the
  `/status` page + counting function, **13**). Before them, **182**
  (2026-09-15 00:38Z, its row last moved 2026-09-14 02:25Z — runs 44 and 45 on
  `repairbench-1` and their two 6-credit refunds). **244 stood here for four
  days and was stale**, which is
  exactly what the last line of this entry warns about; read the ledger.
  Before it, **244** (2026-09-11 17:56Z, after
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
- **`site build` is 382/382, AND CI HAS NOW READ IT — run 1114, 2026-09-12
  08:25:23Z, `382 passed, 0 failed`** on the game deletion's own push, 17m36s
  for the harness step inside a 24m11s job. That is the number closing its own
  loop: it was stamped on 2026-09-09 from a LOCAL run and nothing re-read it for
  three days; the line then said "the next CI run of this workflow is what
  re-reads the number", and what actually re-read it first came back **381
  passed, 1 failed** — the harness's own hardcoded fan-out ceiling, not the
  product (the trap entry has it). So the count was right and the run was red,
  and **a count nobody re-measured is a claim ahead of its evidence in BOTH
  directions**; this is the first run where the count and the colour agree and
  neither is local. Before that, CI had read `373 passed, 0 failed` on runs 1065
  and 1066 once the cap moved to 35 minutes. The other nine integration steps on
  the same run: 4 / 16 / 11 / 29 / 14 / 47, all 0 failed.
  **AND CI HAS READ THE DELETION'S OWN TREE — run 1115, 2026-09-12 18:13→18:33Z,
  ALL TWENTY STEPS GREEN**, `site-build.mjs` 14m21s inside a 19m45s job, on
  stage 3's sha plus the filter fix that is what made it run at all. Stages 2a,
  2b and 3 moved ~2,900 lines of `worker.js` between them and none of the three
  triggered this workflow. **The pass COUNT for 1115 is unread** — the log tail
  fetched reached only step 20 (`site-runtime`, 47 passed) — and it is left
  unstamped rather than carried over from 1114, which is the rule this line's
  own history is about.
  **RE-MEASURED ON RUN 1117 (2026-09-12 21:25→21:49Z, the photograph pipeline's
  own tree, ALL TWENTY STEPS GREEN): `site-build.mjs` `382 passed, 0 failed` in
  17m37s**, read out of the job's own log rather than carried over — so the
  count and the colour agree on a tree that moved `worker.js` and two builder
  modules. The other six: kit-typecheck 4, contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47, every one 0 failed. **The
  count is unchanged from 1114 because this change adds no container case** —
  its guards are unit-level, and what the harness proves here is that a site
  still compiles, renders and serves with the image steps reading the parts.
  **AND RUN 1127 READ THE SAME NUMBER ON A DIFFERENT TREE (2026-09-14
  00:25:15→00:49:16Z, the container clock's first round, ALL TWENTY STEPS
  GREEN): `382 passed, 0 failed` in 17m36s**, with kit-typecheck 4,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47 beside it.
  **AND RUN 1133 READ IT A FOURTH TIME (2026-09-14 08:06:49→08:27:28Z, the wire
  probe's hang fix, ALL TWENTY STEPS GREEN): `382 passed, 0 failed` in 14m53s**,
  with contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47 — every count read out of that job's own log.
  **AND RUNS 1137 AND 1138 READ IT A FIFTH AND SIXTH TIME (2026-09-14, the five
  bounded fixes): 1137 on `d0701415` 23:08:10→23:32:39Z, the harness step
  17m46s; 1138 on `1c397634` 23:25:09→23:41:14Z, the harness step 11m33s — BOTH
  `382 passed, 0 failed`, every step green, the same six beside them (4 / 16 /
  11 / 29 / 14 / 47, all 0 failed).** **SIX independent runs over three days
  agreeing is what makes 382 a measurement rather than a stamp** — and the two
  harness timings, 17m46s against 11m33s on trees that differ by four files,
  are the same lesson the image-step band records: **the runner decides, and no
  inference from the diff to the duration is available.**
  **AND RUN 1142 READ IT A SEVENTH TIME (2026-09-15 05:57:01→06:16:43Z on
  `c5b59cc6`, ALL TWENTY STEPS GREEN): `site-build.mjs` `382 passed, 0 failed`**,
  with kit-typecheck 4, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47 beside it — every count read out of that job's
  own log by bounding each `N passed` to its own `##[group]`, because a forward
  search from a step marker picks up the NEXT step's count and silently
  mis-attributes it (measured: four steps all reported 29 that way).
  The unit suite is **6,472** (2026-09-15, local — the repair steps' shell,
  whose new case file is `test/repair-workflows.test.mjs`'s **seven**: for each
  of the two steps a failing repair that must fail the step with its log intact,
  a succeeding control, and the DEFAULT-shell control that reproduces the
  swallowed failure — plus the directory-wide census of piped commands;
  6,465 + 7 closes exactly. **CI HAS READ IT: `unit tests` run 2564 on
  `b6e4939c`, green (2026-09-15 06:21:40→06:23:40Z, the suite step 98.9 s) —
  `# tests 6472 / # pass 6469 / # fail 0 / # skipped 3`**, against local
  `6472 / 6472 / 0 / 0`; the three are the recorded environment skips.
  **No `site build` run fired for this tip and that is `site-build.yml`'s
  `paths` filter, checked rather than assumed** — the six changed files are two
  workflows, two documents, a mutant spec and a test, and none is under
  `builder/**`, `worker.js` or any other glob in that list. So run **1142**'s
  green on the parent `c5b59cc6` covers it, by the recorded rule that a green
  harness on an ancestor is evidence only when nothing between it and the tip
  is an image input.
  **6,465** before it (2026-09-15, local — the normaliser erasing SQL
  meaning before parsing, whose new case is `repair-commands`'s **one** (the
  scope wall driven as a process: an out-of-scope slug exits 2, reads nothing
  and does not say "nothing to do", with the control that a run with no slug
  still visits the five); 6,464 + 1 closes exactly. **The predicate guard was
  REWRITTEN onto the new property rather than added to**, and three older
  fixtures were re-anchored onto in-scope slugs — none of those is a new case.
  **CI HAS READ IT: `unit tests` run 2561 on `c5b59cc6`, green (2026-09-15
  05:57:01→05:59:00Z, the suite step 104.3 s) — `# tests 6465 / # pass 6462 /
  # fail 0 / # skipped 3`**, against local `6465 / 6465 / 0 / 0`. The three are
  the recorded environment skips, which is why the number to carry is the TOTAL.
  **6,464** before it (2026-09-15, local — the four failures in that
  repair fixed through the commands, whose new cases are
  `test/repair-commands.test.mjs`'s **10** (new — both scripts spawned as real
  PROCESSES through the `--import` preload, exit codes read off the process:
  verify failing, verify reaching the site's database and not the project's,
  verify with no reachable database, apply → verify → repeat over a `_meta`-less
  database with the application-table negative, preview writing nothing, apply
  refused on identity, and the count-fix's four) and `backend-repair`'s **six**
  (44 → 50: the resolved connection through `survey`, the canonical predicate's
  counterexample, `policy-not-comparable` beside an absent clause, the `_meta`
  creation by the engine's own statement, a named failure when it cannot be
  created, and the one-copy census); 6,448 + 10 + 6 closes exactly. **Four
  re-anchors added no case.** **CI HAS READ IT: `unit tests` run 2558 on
  `2a6cc32c`, green (2026-09-15 05:12:04Z, the suite step ~105 s) —
  `# tests 6464 / # pass 6461 / # fail 0 / # skipped 3`**, against local
  `6464 / 6464 / 0 / 0`. The three are the recorded environment skips, which is
  why the number to carry is the TOTAL.
  **6,448** before it (2026-09-15, local — the five gaps in the
  database-discovery repair, whose new cases are `backend-repair`'s **22**
  (22 → 44: the identity chain link by link, the writer's wall with its control,
  the three separated tasks and the driven rerun, `--verify` connecting, the
  catalog-before-`_meta` order, the four fingerprint cases, the round-trip with
  `trash` and a widening, the derived flags against the engine's own DDL, prior
  metadata preferred and still verified, the `currency` false alarm, the
  count-function correction, and the eight that closed the sweep's survivors) and
  `addon-route`'s **four** (40 → 44: run 47's state recovered through the route
  with its control, an unrecoverable table stopping the step, an honestly empty
  database still working, and `_meta` not counting as a disagreement);
  6,422 + 22 + 4 closes exactly. **Five re-anchors added no case.**
  **CI HAS READ IT: `unit tests` run 2553 on `3711218c`, green —
  `# tests 6448 / # pass 6445 / # fail 0 / # skipped 3`**, against local
  `6448 / 6448 / 0 / 0`. The three are the recorded environment skips, which is
  why the number to carry is the TOTAL and why a `pass` count alone drifts
  between the two machines.
  **6,422** before it (2026-09-15, local — the database-discovery
  repair, whose new cases are `backend-repair`'s **22** (the four states and the
  census, the repair's three conditions, the heal's filter by the property it
  enforces, the sixteen-cell round-trip through the real grant and policy
  emitters, the ambiguity refusal, the reconcile over run 47's own state, its
  idempotence, the internal-table and managed-column rules, `MANAGED_COLUMNS`
  against the engine, the catalog queries, the script's preview-by-default wall,
  the credential scrubber, identity proved four ways, an unreadable stored spec,
  the survey, and the four population/seed module cases) and `addon-route`'s
  **thirteen** (27 → 40: the four states, both reads, the probe, the heal's
  no-op, the two reports and their controls, and the provision path driven end
  to end); 6,387 + 22 + 13 closes exactly. **Three re-anchors added no case.**
  CI has NOT read this number yet.
  **6,387** before it (2026-09-15, local — the rollout pre-flight, whose
  new cases are `addon-sweep`'s **six**: a matching pair and a short sha by
  prefix, a mismatch on either half, cannot-tell refusing with the `unstamped`
  case taken from `healthImage` itself, the two readers' disagreement asked with
  no expectation set, `expectedCode` over the environment with the name census
  both ways, and the pre-flight's own position and wiring; 6,381 + 6 closes
  exactly. **One re-anchor added assertions, not a case.** CI has NOT read this
  number yet.
  **6,381** before it (2026-09-14, local — the five bounded fixes and the
  audit-wording correction, whose new cases are `addon-route`'s **seven** (a
  missing page named plus its control, page `reached`, component `changed`, page
  `unexpressed`, the multi-page `no-page` refusal, an unknown kit name dropped
  with a custom part surviving), `addon-steps`' **six** (`frontendItem`, the
  three frontend readings, the length-mismatch refusal, `missingPages`, the
  config-versus-checked split, and the offered-set/list/scan case the sweep
  asked for) and `job-sms-contract`'s **five**; 6,363 + 7 + 6 + 5 closes
  exactly. **Five re-anchors added no case** — they are assertions inside guards
  that already existed. **CI HAS READ IT THREE TIMES, ALL GREEN**: `unit tests`
  run 2529 on `d0701415` (23:08:06→23:10:08Z, the suite step 104 s), and runs
  **2531** (push) and **2532** (pull_request) on the exact tip `1c397634` —
  `unit.yml` carries both triggers, which is why opening the PR fired a second
  run on one sha. **All three read `# tests 6381 / # pass 6378 / # fail 0 /
  # skipped 3`**, against local `# tests 6381 / # pass 6381 / # skipped 0`. The
  three are environment skips, not a smaller suite, which is why the number to
  carry is the TOTAL and why quoting a `pass` count alone drifts between the two
  machines.)
  **6,363** before it, the four outstanding fixes,
  whose new cases are `addon-route`'s **eight**: the five demonstrations the
  owner named (malformed privacy, explicit `definer: false`, public versus
  internal, failed function → blocked job, configuration versus behaviour), the
  control that makes the job block a block rather than a ban, and the lone
  unexpressed setting; 6,355 + 8 closes exactly. **The three re-anchors added no
  case** — they are assertions inside guards that already existed. CI has NOT
  read this number. **6,355** before it, the four route-level gaps,
  whose new cases are `addon-route`'s **twelve** (all four driven end to end
  through `POST /api/site/<slug>/addon`, asserting on the customer's own
  sentence) and `addon-steps`' **seven**; 6,336 + 12 + 7 closes exactly.
  **6,336** before it, the other five addon steps,
  whose new cases were `addon-steps`' **nineteen** and `requirement-coverage`'s
  **one** (the three states and the asymmetric evidence); 6,316 + 19 + 1 closes
  exactly. **6,316** before it, the wire probe's hang fix and
  the read-back door, whose new cases are `job-probe`'s **six**: the bound
  derived and junk-safe, `wireCall` driven hung-versus-killed with the kill as
  its control, `probeWire` driven hang-first through an injected `timer`, both
  arms bounded with a signal each, the runner's watch bound derived, and the
  read-back). **6,310** before them, the probe route's own crash fix;
  **6,302** before that (the container move, whose new
  cases are `container-transport`'s seven, `job-probe`'s eleven, `job-duration`'s consumer census and
  `container-job`'s driven setting. **The delta from 6,270 is NOT derivable and
  is deliberately not claimed**: that stamp was taken before the transport and
  record halves were written, and their guards were never counted on their own —
  which is this file's own rule about a number nobody re-measured, in the one
  direction that looks like arithmetic. **6,270** before them, the container's
  clock, both
  rounds: three cases for the pair and one for the unbounded budget; **6,266**
  before them, the grants backfill's credential rule; **6,256** before that, the
  local-Postgres proof and the backfill script; **6,197** on 2026-09-13, the
  dead-code deletion's six
  new `css-reachable` cases and the `siteBuildStart` call census, against one
  retired when `site-ask`'s two windows became one `declBlock` helper; **6,190**
  before it, the model-context and model-limits work; **6,126** before that, the
  SEO tab's twenty-six; **6,100** before it, the photograph
  pipeline reading the parts; **6,088** before that, plus `image-parts`' twelve;
  6,086 at stage 4 of the media deletion, plus two cases for the one tree and the
  row's ink; CI has NOT read this number yet, and the last one it did read was
  6,072 on run 2473). The arithmetic across the deletion, because a falling
  count is the ordinary shape of one and is only honest written down:
  **6,078 → 6,072** at stage 1 (the game builder retired ten cases when
  `dockerfile`'s `SERVICES` lost its second entry, plus four elsewhere, against
  eight added), **6,072 → 6,078** at stage 2 (the four `media-deleted` cases and
  the driven view fallback, less what the UI removal retired), and
  **6,078 → 6,083** at stage 3 (one retired with `/api/m/*`; six added — the
  SSRF driver's self-test, two worker free-identifier cases, the fal scrubber,
  `eAnswer`'s driven status, and the harness-filter census), and
  **6,083 → 6,086** at stage 4 (three added, none retired — the unread-credential
  census, the deleted-files census and the watermark's removal with the paid
  flag's readers counted) — **DOWN from 6,078, and the subtraction is the point**: the game
  deletion retired its cases (ten at once when `test/dockerfile.test.mjs`'s
  `SERVICES` lost its second entry, plus four in `api-auth`, `build-lane` and
  `client-routes`) and added eight (the DO-migration census and the
  free-identifier walker). A falling count is the ordinary shape of a deletion
  and is only honest when the arithmetic is written down beside it. Before
  those, the count rose through the project-root census, the template name
  guard, the preview-error channel, the code tree's icons and sort, the search
  box, the tree column's width, the row menu, the click twitch, the scrollbar
  gutter, the kit closure, the derived harness ceiling and the phone tile's
  containment.
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

Every one has cost at least one session, most several. **Read this before writing
a guard.** The stories are in `git show a4d0f5e5:CLAUDE.md`; what is here is the
rule and the measurement.

### Guards that pass while the thing is broken

- **THE WIRING LAYER.** Twelve-plus features have shipped DEAD with the module
  perfectly correct and one hop cut — a value computed and never forwarded, a dep
  injected and never called, a field decided and never put on the wire. From
  outside, "the model did not set it" and "we did not forward it" are the same
  `undefined`. **Before rewording a prompt because a field came back empty, check
  that the field can arrive.** Derive the chain from the PRODUCER.
  **AND A GUARD CAN COVER THE CHAIN AND STILL MISS A HOP**: the Code tab's guard
  asserted the tab twice, asserted the loader, drove both handlers, and never read
  the branch that renders the host — which kept its old `!isReact &&`. *A hop
  nobody listed is a hop nobody guards.*
  **The membership test that finds this class**: a design field must be in
  `PLAN_KEYS`, or on `EDIT_FIELDS`, or have a named per-field hop. A dotted
  `designed.<field>` scan answers 0 for six perfectly wired fields.
- **A CHAIN TEST THAT READ THE MODULES INSTEAD OF RUNNING THEM.** A case called
  "THE CHAIN" that reads SOURCE is asserted at the layer below the break. Nothing
  had ever compiled a build carrying a `gif` or a `qr` despite such a case.
- **A GUARD WATCHING THE LAYER BELOW THE BREAK** — it asserts the plumbing and not
  the connection: "the query selects the column" while nothing carries it onward.
- **A TEXT-ORDER GUARD SURVIVES A MOVE INTO A CLOSURE.** Three guards asserted
  "the pageless answer comes AFTER the apply" as `indexOf(a) < indexOf(b)` and all
  three stayed GREEN when the apply moved into a closure run from two places. A
  position in the file is a claim about run order only while the code between is
  straight-line. Read the CALL inside the block it describes.
- **VACUOUS ORDERING.** `indexOf(a) < indexOf(b)` passes when `a` is the thing
  deleted (-1 < anything). Prove both anchors exist first.
- **AND ITS MIRROR: A POSITIONAL GUARD CANNOT SEE A DEAD BRANCH.** `if (false) {…}`
  leaves every landmark at the same offset; `if (false) foo()` leaves `foo(` in the
  file. **A position is not a behaviour** — cut the block out and RUN it.
- **A NEGATIVE ASSERTION MUST PROVE ITS OBSERVER IS ALIVE.** `[].every(...)` is
  `true`. Assert a floor on what was SCANNED before believing an absence — and
  **a floor on the ANSWER is not the same thing**: `service-table-grants` proved
  its scanner alive with `seen.size >= 2` and went on passing for a stage off a
  file nothing served.
- **A GUARD PROVES THE BRANCH IT DRIVES**, and no other. A mutant of the obj-form
  survived because the guard drove only the JSX form.

### Reading source with a regex

- **ASSERT THE PROPERTY, NOT THE SPELLING.** The single most repeated own-goal. A
  guard pinned to `foo(a, b)` goes red the moment an honest third argument
  arrives, reporting the feature as gone. **AND ITS QUIETEST FORM IS PINNING A
  LIST BY ITS LAST ELEMENT** — being last is almost never the property;
  membership is.
- **NEVER SIZE A SOURCE-READ WINDOW IN BYTES.** Ten-plus instances. This repo puts
  its reasoning in comments, so any byte window is outrun by the next comment.
  Window landmark to landmark and **assert both landmarks exist** — `indexOf`
  answering -1 gives `slice(-1,-1)` = `""`, which passes everything inside it.
  **`slice(start, -1)` is the other half**: a missing END landmark swallows the
  file. **And a byte bound outlives the comment that outran it**: the addon
  route's validation window ran to a DISTANT neighbour, a sibling block was
  inserted between the two landmarks, and the window went from ~2.6 KB to
  **4,261 bytes** — reporting the block it describes as broken by a block that
  is not it. Close on the NEXT SIBLING, and on **CODE, never a heading comment**,
  when the scan reads a blanked source.
- **OVERLAPPING WINDOWS.** A window running to a NAMED neighbour swallows whatever
  is inserted between them. Derive the closing landmark from the next sibling,
  **search it FROM the opening one** (`indexOf(end, at)`) and assert `end > at`.
  A landmark is only unique until somebody writes about it upstream, and **a
  description that explains its own exceptions will always name the other
  sections**. And **a window can grow QUIETLY rather than go red**, which is the
  dangerous half: `site-share`'s window silently doubled and every assertion in it
  went on passing over a region twice the size it describes.
- **PROSE CONTAINS THE THING IT FORBIDS.** Ten-plus instances, several inside the
  guard written for that trap, and **twice in one session inside LIVE checks**.
  Blank whole-line comments (length-preserving) before any scan. A comment about a
  name is not a second reader of it.
- **THE BLANKER'S ORDER IS ITSELF A TRAP: LINE COMMENTS FIRST, block openers only
  at the start of a line.** `chat.js` carries `// Every /api/* call …`, whose `/*`
  opened a false block running **71,729 characters**; **37.1% of the visible source
  survived** and three tests reported a feature gone on a change that never touched
  it. **A survival RATIO is the wrong observer** — chat.js is 50.1% comments.
  **Assert that the landmarks the scan is about to look for survived the blanking.**
- **A BLANKER ERASES THE LANDMARK THE GUARD NEEDS** — the mirror. Blanking is for
  scans that FORBID a spelling; a scan that REQUIRES one finds its boundaries on
  the raw text and blanks only the body between them.
- **FLAT SCANS WHERE DEPTH MATTERS.** Written wrong five-plus times, and **twice
  in one sitting on 2026-09-14**: `newJobId\(([^)]*)\)` stops at the `)` inside
  `(b) =>` and reported the two CORRECT call sites as broken; `[^}]*` stops inside
  `${sayNotJson(j)}`. Argument lists, object literals and selector lists all need
  a depth-aware splitter.
- **A NEEDLE THAT CAN MATCH A DECLARATION CANNOT PROVE A CALL; a needle that can
  match a LONGER NAME cannot prove a class.** Three instances in one week:
  `buySitePhotos\(env, \{ slug, pages, parts,` also matches the function's own
  signature, so a mutant cutting the parts off the CALL survived;
  `includes("st-code-bar")` is satisfied by `st-code-bar2`; `stPub` is a substring
  of `stPublish`. Assert `class="x"` with its quote, or walk the argument list
  depth-aware.

### Mutation sweeps

- **INERT MUTANTS.** Sixteen-plus recorded. A mutation that changes no behaviour
  reads exactly like a test gap. **Prove it inert by MEASURING both versions over
  the real corpus** before hunting.
- **TWO REDUNDANT DEFENCES CANNOT BE KILLED ONE AT A TIME.** A survivor is not
  always a missing check; sometimes it is a second wall. Measure both versions,
  then mutate the PAIR, which must die — and **say in the code that the redundancy
  is deliberate**, because a sweep cannot and the next session deletes what
  nothing appears to need.
- **A TEST-SIDE MUTANT IS USUALLY INERT BY CONSTRUCTION.** Weakening a guard's own
  assertion is not a behaviour change, so no other test can catch it. **Give the
  property an OBSERVABLE half and mutate THAT.** One pass had 17 mutants and 10
  survivors, not one of them a guard gap.
- **A MUTANT THAT NEVER APPLIED.** `grep -qF "$to"` is vacuous when the replacement
  is empty or common — verify by CHECKSUM, and **check every anchor occurs exactly
  once BEFORE the run** rather than reading NOT APPLIED afterwards. **A sweep whose
  control never applied is a sweep with no control.**
- **A MUTANT WHOSE ANCHOR IS A SUBSTRING OF ANOTHER'S** — an 8-space-indented line
  contained in its 14-space twin. Anchor with the neighbour.
- **`—` IN THE SOURCE, A DASH IN THE SPEC.** A sweep once reported 12/12 clean
  while the single most important mutant had not run. **MEASURED: `chat.js` carries
  837 real em dashes against 20 escapes.** A NEVER APPLIED line must be read as
  loudly as a survivor.
- **A KILLED SWEEP LEAVES A LIVE MUTANT** — it skips its `finally`. **Never commit
  while a sweep is running.** Put the restore on a trap and run it in the
  background.
- **AND "IN THE BACKGROUND" IS NOT `nohup … &`** — the harness reaps the tracked
  wrapper the instant `&` returns and the runner becomes an orphan nobody owns.
  Run the sweep as the background call's own command. **`pgrep -f
  scripts/mutate.mjs` before believing any sweep result**: two processes wrote one
  log at different offsets and it read like a clean run with a plausible survivor.
- **A CONTROL MUST BE DECLARED, NOT MERELY LABELLED.** Four specs named theirs only
  in the LABEL, so `isControl` was false: the tally printed them as survivors AND
  **the runner's own `CONTROL WAS KILLED` branch was never armed** — the sweep's
  one check on its own honesty, off, in the sweeps that reported it working.
- **A SWEEP DOES NOT NEED THE WHOLE SUITE**, and saying so is not a shortcut: 45
  mutants × the full suite is ~70 minutes; the files that can see the change are
  32 seconds. **A SURVIVOR is re-checked against the whole suite before it is
  believed** — a narrow list can only produce a false survivor, never a false kill.
- **AN AD-HOC CHECK CAN FAIL TO APPLY ITS OWN MUTATION.** An inline `node -e` whose
  quote escaping silently no-op'd the replace compared the original against itself
  and answered INERT. **Any hand-rolled mutation check must REFUSE to run when the
  source did not change.**
- **`String.prototype.replace` READS `$'` IN THE REPLACEMENT** — the file changed,
  the checksum said applied, and the mutant that landed was not the one written.
  Replace through a function and verify the landed text IS the written text.

### Two copies of one thing

- **TWO LISTS OF THE SAME THING.** Routes in a matcher and in a dispatch
  condition; a scanner's list and the kit's. They drift silently. Derive one from
  the other, in BOTH directions where the scan can stop matching.
- **A HAND-TYPED CONSTANT IN A CHECK IS ONE OF THEM.** `site build` came back
  381/1 on a change touching neither the fan-out nor the model path: a check
  hardcoded 9 requests, legal when written and illegal after the two bounds split.
  **A check that hardcodes a number the product exports is a second copy of it.**
- **A NUMBER STAMPED IN TWO PLACES DRIFTS WHEN ONLY ONE IS CORRECTED.** Sweep and
  suite numbers went into four places and the correction reached three. **Grep for
  every copy of the OLD value before believing a correction landed.**
- **A LOOKUP KEYED AT A DIFFERENT GRANULARITY THAN THE THING YOU ASK IT.**
  `LANE_LAYER` is keyed by GROUP; indexing it by a field answers `undefined` for
  three lanes that dispatch fine — and `undefined` there is a legitimate value.
  **When a map's absent key means something, ask its resolver, not the map.**
- **A READ WHOSE ONLY CONSUMER WENT, and the query stayed.** When you delete a
  consumer, grep for what fed it.

### Values that lie

- **`String(["a"])` is `"a"`.** Shipped as a real bug three times. Refuse a
  non-string; never coerce.
- **`X["constructor"]` is truthy.** `Object.hasOwn`, never truthiness, for any
  caller-supplied key.
- **TWO NULLS THAT MEANT DIFFERENT THINGS.** `readAction` answers null for "no
  button" AND for "a computed button"; `applyAction` keyed insertion on that one
  null and `src.slice(0, undefined)` is the whole file. **When a reader answers
  null for "unreadable", check what every consumer SAYS OUT LOUD for that null.**
  A writer that skips is safe; a prompt that says "absent" is not.
- **CANNOT-TELL MUST NEVER READ AS A VALUE** — and the inverse: **`Infinity` is a
  stated answer** and two readers refused it, each falling back to a Worker-sized
  number for the one input where the default is the most wrong answer available.
- **A `//` IN A URL IS NOT COSMETIC.** `https://host//menu` parses as the host
  `menu`, so a wrong canonical names a different SITE. Assert an address by
  PARSING it, never by string equality against an expectation the test assembled
  the same wrong way.
- **A UNIT CONVENTION STATED ONLY IN PROSE** is one a model will read past.
  `OptionPricedList` documents minor units; a page fed major-unit rows, so one
  control read **+£16.40** and the total **£1880.00**, both well-formed. The fix
  shape is a type or a prop name that carries the unit. **Open.**

### Fixtures and instruments

- **A FIXTURE IN A DIFFERENT SHAPE FROM REALITY.** A fake that is MORE capable
  hides bugs exactly like one that is less — and so does one that differs by a
  single character (a trailing slash shipped `//menu` as every canonical for a
  day). **Derive a fixture from its real producer.** A stub `phone` matching
  `/\d{7}/` against `"07700 900000"` — the format the contract it was proving
  says is accepted — found **no run of seven consecutive digits** and dropped the
  message, reporting a working feature as broken.
- **A FIXTURE THAT NAMES A THING THE PRODUCT DOES NOT HAVE PASSES UNTIL THE
  PRODUCT STARTS CHECKING.** Two guards used the kit component `form-shell`,
  which sounds exactly like one of the 2,112 and is not one; both went red the
  hour a name check shipped, and the honest move is a real name **with the drop
  asserted beside it** — swapping the name alone appeases the check without
  saying what changed, which is the same thing as deleting it.
- **A FIXTURE TOO SHALLOW TO SEPARATE THE TWO READINGS.** When a mutant survives,
  ask what input would make the two readings differ, not whether the code looks
  right. `sitePreviewSrc(site, '/')` and `sitePreviewSrc(site, active.path)` answer
  the same string until a case presses on `/press`.
- **A ZERO FROM A BLIND INSTRUMENT IS NOT EVIDENCE OF ABSENCE.** Headless Chromium
  uses OVERLAY scrollbars (0px in precisely the case that moves); Chromium in this
  sandbox cannot reach a site host at all, so a CSP render read BROKEN both ways;
  a fake `sqlQuery` injected where none is accepted answered **0 statements**,
  which reads exactly like "no constraint anywhere". **A `net::` error in a CSP
  failure list is the tell — a refusal is `blockedURI`, never a transport error.**
- **AN INSTRUMENT THAT REPORTS CORRECT CODE AS BROKEN.** A `fullPage: true`
  capture of a site using `animation-timeline: view()` shows every below-the-fold
  section BLANK. **When the instrument and the thing disagree, suspect the
  instrument first** — and screenshot each section scrolled INTO VIEW, asserting
  computed opacity.
- **A DEFECT THAT ONLY EXISTS IN TIME IS INVISIBLE TO EVERY STILL.** An entrance
  animation on an element something rebuilds is a 220 ms twitch; the finished panel
  is pixel-perfect in every frame. **The picture looks like evidence.** Sample one
  element's rect across `requestAnimationFrame`.
- **A CSS RULE CAN BE CORRECT AND STILL LOSE** — `padding-left` above a `padding`
  shorthand loses on source order at equal specificity. No markup assertion sees
  it, and neither does one that checks the rule EXISTS: read the VALUE, and check
  it sits below every shorthand that rewrites it.
- **A PERCENTAGE HEIGHT AGAINST AN `aspect-ratio` BOX IS WHERE ENGINES DISAGREE.**
  Correct CSS; where an engine does not resolve it, `max-width` does not always
  clamp a width the ratio produced. **Bound it on both axes AND clip the parent.**
  Chromium could not reproduce it at five widths — the failure had to be FORCED.
- **A FAILURE THAT CANNOT NAME ITSELF.** Seven-plus instances: four causes wearing
  one sentence, a status with no reason, a report that died with the socket.
  **When two failures need opposite fixes, they must be distinguishable from
  outside** — and a harness that hides the diagnostic half of a response turns
  every failure into a guess.
- **A DIAGNOSTIC FIELD IS NOT A SUBSTITUTE FOR THE ARTIFACT.** Three past sessions
  hit one wall and each bought a narrower field instead of the file. Store the raw
  answer ONCE, before anything can refuse it.
- **A 200 IS AN AVAILABILITY CHECK AND NEVER A HEALTH CHECK** (owner,
  2026-09-15: *"The six sites returning HTTP 200 are useful availability checks;
  they don't yet establish that their interactive features still work."*).
  Fetching a document proves the script is up and serving; it exercises no form,
  no query and no control. **The two are different claims and a post-deploy
  sweep measures only the first.** What an interactive check really costs is
  run 47's shape: fetch the page, read its route chunk for the call it makes,
  POST that call to the site's own route, and compare the answer against a
  number established some other way — which is how `/status` was found answering
  `0` while serving a perfect 200.
- **A CHECK THAT REPORTS IS ONLY AS GOOD AS ITS READERS.** The render check saw
  seven routes throw and said so; the publish shipped it (by design) and the
  harness called it `ok`. **When a check is report-only, list its readers.**
- **A REPORT CUT BY ITS BUDGET READ AS A VERDICT ON PAGES IT NEVER OPENED.** `cut:
  true` was in the report with no reader for three sessions. **An absence in a
  report is only as good as the report's coverage.**
- **A LISTING THAT ANSWERS ONE PAGE.** `wrangler containers images list` fetches
  ONE catalog page; two deploys rebuilt both images off an absence that was the
  instrument's. **Ask for the thing BY NAME**, and make "could not tell" its own
  answer.
- **AN API THAT SERVES A STALE SNAPSHOT.** GitHub answered `in_progress` for a step
  that had finished. `updated_at` moving BEHIND the steps proves staleness; it
  agreeing proves nothing, because a whole snapshot can be old. **What settles it
  is the step's own expected duration** — and a stale reading can persist ~25
  minutes. `date` is the cheap check before calling anything hung.
- **A FALSE ALARM IS WORSE THAN A MISS**, and a false ALL-CLEAR is worse than
  either. Any new lint measures its false-alarm rate against the real corpus and
  must reach ZERO before it ships. **A live check's ambiguous anchor fails
  SILENTLY**: `justify-content: center; overflow: hidden; }` also ends `.ig-ico`,
  so a watch said LIVE about a rule the change never touched. **Count the pattern
  in the source first.**
- **`pgrep -f` / `pkill -f` MATCH YOUR OWN SHELL.** Ten-plus instances. Kill by
  PID; watch a log's tail.

### Loading, parsing, scope

- **LOADING A MODULE PROVES ITS IMPORTS, NOT THE IDENTIFIERS INSIDE ITS FUNCTIONS.**
  Six-plus free-identifier misses. `&&` SHORT-CIRCUITS, so a free name in an
  operand may never run: `node --check` passes, every source guard finds its
  landmarks, a real service starts and listens, and the build that uses the feature
  throws. **The check is a PARSER, not a grep** — `test/free-identifiers.test.mjs`
  walks real lexical scopes over the PAGE (classic scripts share one global scope)
  and over `worker.js`. **Measured zero false alarms**, with a `typeof` operand the
  one forgiven position.
- **IT HAPPENS IN A TEST SCOPE TOO, silently in both directions.** A carried
  function gained two free names and every case went on passing against a scope
  that had neither — green means the fixtures never took that branch. **When a
  carried function gains a free name, add it even if the suite is green.**
- **A `const` CALLED ABOVE ITS OWN LINE passes the parse check and every text
  guard.** The temporal dead zone is a runtime error. **When a call moves earlier,
  check what it calls is declared earlier still.**
- **A MODULE WITH NO IMPORT LINES** puts an anchor-based insertion below its use:
  `node --check` passes and the module throws `ReferenceError` on LOAD. Parsing is
  not loading.
- **`node --check worker.js` PASSES A FILE THAT DOES NOT PARSE.** This package
  declares no `"type"`, so `--check` on a `.js` does not parse it as a module and
  says nothing about a duplicate declaration. **The honest parse is
  `node --input-type=module --check < worker.js`.**
- **A RE-ANCHOR LANDS IN A SCOPE IT DID NOT WRITE** — a `const closure` colliding
  with a local made `node --test` report the whole file as one `not ok`. Check the
  name is free.
- **AN UNCAUGHT THROW INSIDE A ROUTE IS ANSWERED BY CLOUDFLARE IN HTML**, because
  `worker.js`'s `fetch` has no try/catch around `handleRequest`. A caller doing
  `.json()` gets `Unexpected token '<'` and learns nothing about the cause.

### Environments, CI, deploys

- **THE THING THAT RUNS YOUR GUARDS IS NOT ITSELF GUARDED unless somebody writes
  it down.** Four instances: the merge triggers (22 automatic triggers came off in
  one commit and all 5,722 tests stayed green), the DO migrations (a class leaving
  the Worker needs a `deleted_classes` migration or Cloudflare refuses the WHOLE
  deploy), the container-harness `paths` filter (right until `worker.js` became a
  job runtime; **stages 2a, 2b and 3 moved ~2,900 lines and `site build` ran on
  none of them**), and the sweep runner. **It fails silently in the safe-looking
  direction**, because a workflow that stops running produces no red run.
- **A `process.on("SIGTERM")` HANDLER IN A SYNCHRONOUS LOOP SWALLOWS THE SIGNAL
  ENTIRELY** — installing a listener replaces the default, and a handler is
  dispatched through the event loop a loop of `execFileSync` never returns to.
  **Measured: four iterations, the handler never fired, exit 0.** And **the obvious
  fix is INERT**: adding `process.exit()` to a handler that never runs.
- **A CI STEP THAT DOES NOT INSTALL WHAT THE TESTS IMPORT.** True when written and
  false the moment a module gained a dependency; green locally, red in CI. **Never
  let a workflow assert a property about the code in a COMMENT.**
- **`unit tests` WAS RED ON EVERY PUSH TO MAIN FOR A DAY — fifteen runs.** Read the
  run after every push; a red one is a day of pushes shipping unchecked.
- **A MODULE THE CONTAINER IMPORTS AND THE IMAGE DID NOT CARRY.** The transitive
  import walk is the one guard that compares the consumer's ENVIRONMENT with the
  code. **And `container-images` asks git for the COMMITTED tree**, so a Dockerfile
  naming an uncommitted file is an image that cannot be built from that commit —
  staging is not enough.
- **A CHECK THAT ASKS THE FILESYSTEM IS ASKING THE WRONG THING.** `fs.existsSync`
  passed on any machine that had ever built and baked THAT MACHINE'S generated file
  into a committed module. **When a check is about what the REPOSITORY holds, ask
  git**, derive the list, and prove the observer alive first.
- **A `workflow_dispatch` WORKFLOW HAS NO BUTTON UNTIL ITS FILE IS ON THE DEFAULT
  BRANCH (measured 2026-09-15).** `backend-repair.yml` and
  `repairbench-count-fix.yml` were pushed to a feature branch and GitHub answers
  **404** to `GET /actions/workflows/<file>` for both — no entry, no Run workflow
  button, so a dispatch-only tool is not runnable until it is merged. **Ask BY
  NAME, never off the listing**: the same listing returned `agent-deploy.yml`,
  whose file is **not on `origin/main`** at all, so the catalog is not a reader of
  what main holds — this repository's own "ask for the thing by name, and make
  could-not-tell its own answer" trap, met on a registry instead of a container
  registry. **And a `checkout` pinned to `ref: main` is a SECOND, independent
  gate**: the workflow file may come from a branch, but the script it runs is
  always main's, so the tool and its code must BOTH land. Plan the order as
  merge → deploy → press, and never promise a button that does not exist yet.
- **A PUSH TO MAIN ROLLS THE CONTAINER UNDER WHATEVER IS RUNNING.** Never push
  while a live run is in flight; after any code push wait **15–20 minutes**.
- **A COMMIT SAYS WHAT A COMMIT CHANGED; THE DEPLOY FIRES ON THE PUSH.** Two commit
  messages both said "nothing rolls" — true of each alone, false of the deploy they
  triggered. **The roll question has exactly two honest answers**: `git diff
  --name-only <what main had>..<what you pushed>` before, and the deploy's own
  image step after.
- **A SECOND ROUTE UNDER THE SAME WALL.** The 273 s reset was found on the edit
  route, the fork was built on the edit route, and the addon route — same
  connection, LONGER work — stayed synchronous and died at 257.6 s. **When an
  infrastructure limit is found on one route, list every route under it.**
- **`supabase/applied/` IS NOT THE RECORD OF WHAT IS LIVE.** Before redefining any
  RPC, read it out of the database (`pg_get_functiondef`).

### Product-shaped traps

- **A RULE TRUE BECAUSE OF A LAYER BELOW IT EXPIRES WHEN THAT LAYER MOVES, and
  nothing announces it.** Five-plus instances, including the one in the money path
  (the edit budget) and `BATCH = 1` resting on a reason that expired 2026-08-25.
  When something one layer down changes, re-ask what rested on it.
- **A GATE THAT OUTLIVES ITS REASON.** Two tells, both present in the `look`/`logo`
  case: the requirement was never USED, and **the fix for the same symptom sat
  unreachable below it**. When a gate and a later accommodation address the same
  complaint, one of them is dead.
- **A NEGATIVE LIST IS THE WRONG WALL WHEN THE INPUT IS CALLER-SUPPLIED.** A
  deny-list at the door is a claim about the producer, not about the input. **Ask
  the positive list**, derived from the same constant the producer filters on.
- **ONE PROMPT WRITTEN FOR TWO JOBS**, where the second has to argue with the
  first. A prompt that quotes and reverses another prompt in the same call is two
  jobs wearing one tool. **Measured when split: 84,817 characters down to 4,012**,
  and the overruling paragraph simply deleted.
- **A DIRECTIVE FIX THAT WAS INERT BECAUSE THE DIRECTIVE NEVER FIRED.** Before
  concluding a prompt change did not work, check the prompt actually CONTAINED it.
- **TWO KIT COMPONENTS WHOSE NAMES DO NOT DISTINGUISH THEM** cost two paid builds
  at 22 credits. The signature list already said `Figure` took no children and the
  model passed them anyway; naming the right one in the directive was read past
  too. **When the kit has two components for one job, a prompt cannot fix it —
  make the obvious name work.**
- **A PROMISE TO THE MODEL THAT NOTHING EVER COMPILED.** The page rules advertised
  five importable packages; **fixtures importing them: 0 of 5, real pages using
  them: 0 of 324.** A package-list guard cannot catch it — `three` was installed
  and present and still unimportable. **Wiring a feature up is what makes its
  defects reachable.**
- **A GENERATED PAGE BROKE A KIT FILE IT HAD NEVER SEEN.** A `validateSearch` with
  required fields retyped `/` for the whole app. The property is **LITERAL vs
  WIDENED**, not `Link` vs anchor — `to={to}` with `to: string` carries no
  contract, which is why a blanket ban flagged correct code.
- **FOUR PAID BUILDS DIED ON A GATE THAT DID NOT HAVE TO EXIST.** `tsc --noEmit` is
  a gate WE impose; Vite strips types without checking them. **Measured on the exact
  page: tsc exit 2, vite exit 0, 2,186 modules, 6.95 s.** **Before hardening a
  gate, check whether the layer below it needs the gate at all.**
- **SALVAGE CANNOT FIRE ON A NEW BUILD** and has not since `MAX_PAGES` became 1 —
  the only page a new build has is the one page salvage will not replace. Both
  halves correct in isolation; nothing announced it. **Open, owner's call.**
- **A HARNESS THAT PASSED WITHOUT TESTING ANYTHING.** A paid canary POSTed with
  `layer: ""`, matched no branch, and produced a complete clean round trip — 202,
  queued, claimed, terminal, cost 0 — with **not one model call, lane, compile or
  publish**. **A green harness proves the path it took, not the path you meant**,
  and the danger is that a blind post PASSES. The fix is a refusal, not a fixture.
- **A NAME THE HARNESS DID NOT KNOW WAS DROPPED WITHOUT A WORD.** A filter on a
  person's input is a silent drop; a check is a sentence.
- **A KEY WHOSE INVARIANT EXPIRED WHEN THE LAYER BELOW IT MOVED.** The idempotency
  key was minted per ASK and the sideways hop reused it — correct until the queue
  keyed on `(uid, slug, op, idem_key)` **without the layer**, so a hop came back
  `duplicate: true` and silently became a no-op.
- **A ZERO-COST RUNG CANNOT PUBLISH THROUGH THE QUEUE**, and the refusal wore the
  compile's sentence: `edit_may_publish` grants only `reserved` or `exempt`, and a
  rung that makes no model call never reserves. Two traps in one — a gate written
  for the paid rungs disqualifying the free one, and `detail: "unbilled"` on the
  wire with the sentence collapsing it.
- **A REFUSED RESERVATION READ AS A FREE RUNG.** A refused reserve answered 0
  exactly as a rung with no model call does, so the spine exempted the job and the
  work shipped for nothing. **The two zeros are different zeros.**
- **AN OK ANSWER WITH NOTHING TO PUBLISH HAD NO TERMINAL STATE**, so it sat
  non-terminal until the sweep declared it LOST and refunded a 22-second answer
  ~150 seconds later. **A state machine with terminal states only for "shipped" and
  "failed" has no name for "answered, nothing to ship"** — and the nameless case
  falls to whichever sweeper finds it first. Its mirror: **a committed job with no
  finalize held a sweep slot for ever**.
- **THE CLIENT NEVER TERMINATED ON A QUEUED JOB THAT PRODUCED A REPLY.** The stored
  reply IS the synchronous one and has no job-state field, so `classify` answered
  `running` for ever on a charged, PUBLISHED edit. **When one endpoint answers in
  two voices, the voice has to be on the wire.** Two more hid in the same
  duplicated tail: a queued escalate rendered as "✅ Done." (doing less than asked
  and reporting success), and `apply()` bumping the preview and nothing else.
- **A REFRESH MID-EDIT LOST SIGHT OF THE JOB, AND THE FIX HAD BEEN WRITTEN AND LEFT
  UNWIRED.** `resumeEditJob` existed with no caller for days.
- **THE QR RULE IS STRICTER THAN THE REST OF THE DESIGN STEP**, so a first build
  can almost never have one: `NEVER INVENT THE DESTINATION` while every other field
  invents placeholder detail freely. The machinery is not the limit; the rule is.
  **Owner's call.**
- **A STAMP WRITTEN AFTER THE RUN IS A CHANGE THE SUITE HAS NOT SEEN.** The
  stamping rule and the re-run rule pull opposite ways. **Run, stamp, then re-run
  whatever READS the stamp.** And **a count nobody re-measured is a claim ahead of
  its evidence** — in both directions: `382/382` was stamped from a local run and
  the next CI read of it was **381 passed, 1 failed**.
- **RE-RUN THE THING THE CHANGE IS ASSERTED BY.** Appeasing a false alarm in one
  checker while never re-running the harness that proves the change has shipped red
  twice. **The container harness sees what the unit suite structurally cannot** — a
  compiled stylesheet, a rendered head, a real PNG's dimensions. Its 25 minutes are
  not optional on a change to `build-server.mjs`.
- **WHEN A LANE FAILS LIVE, DRIVE ITS MODULE OVER THE CORPUS BEFORE BUYING A SECOND
  RUN.** A writer that emits source is proven by PARSING what it emits over every
  real page there is. One page broke out of 332, and the same audit over the picture
  scanner found the `images` failure with no model call.
- **A DROPPED FIELD HAS A TWIN ONE HOP OVER.** Fixing the producer exposed the
  collector: `publishStep` rebuilds from the LAST rung's args. **When a value is
  added to a chain that collects across steps, check every collector on the chain**
  — it was written before the value existed.
- **AN AUDIT OF THE CONSUMER'S REAL INPUT SURFACE IS THE REUSABLE PART.** Derive
  what the container reads (`payload.<field>`) and what the harness sends, and diff
  them. It found `parts` never once compiled. **Still unexercised: `langs`,
  `fontFiles`, `pageTokens`, `description`.**


## Backlog

- **`updated_at` IS NEVER BUMPED (open, 2026-09-13, kept as its own issue at the
  owner's word: *"Keep timestamps and sync as separate follow-up issues"*).**
  `site-schema.mjs:1121` creates it as a column DEFAULT whose own comment says
  "set on insert, bumped on every UPDATE", and a Postgres default applies only
  when the column is OMITTED from an INSERT. There is no trigger, no route and
  no statement anywhere that touches a site table's `updated_at` on an update —
  every other hit in the tree is a Supabase platform table.
  **The live consumer is a GENERATED PAGE**, not a platform route: the kit's
  `Row` type declares `updated_at?: string`
  (`lovable/template/src/lib/rows.ts:66`) precisely because models wrote
  `deal.updated_at ?? deal.created_at` in two consecutive evals — its own
  comment records that. So a site showing "last updated" shows the CREATION time
  for ever, on every row that has ever been edited, and the page is correct code
  reading a column the engine never moves.
  **The first write-up of this was wrong and is corrected here rather than
  quietly dropped**: it said the defect matters because `/changes?sync=` reads
  the column, which repeated a CODE COMMENT as though it were a live consumer.
  `/changes?sync=` occurs exactly once in the whole tree and it is inside that
  comment (`site-schema.mjs:1187`); there is no such route. **A comment
  describing a consumer is not evidence the consumer exists, and one grep for
  the literal over the whole tree settles it.**
  The fix shape is a trigger or the `timestamps` flag's own write path; it is a
  `timestamps` defect and was deliberately kept out of the column-grant change.
- **`sync` HAS NO READER AT ALL (open, 2026-09-13, its own issue for the same
  reason).** The flag creates `_deletes` and a tombstone trigger per table
  (`site-schema.mjs:1189`, `:1193`) — real DDL, emitted on every site that
  declares it — and `_deletes` is on `INTERNAL_TABLES` (`:61`), denied to the
  browser, with no route serving it. Every byte of that machinery is unreachable
  from outside Postgres. This repository's own most-repeated defect — a value
  computed and never forwarded — in DDL. Decide per the standing rule: build the
  reader, or delete the flag and its DDL.
- **A DATABASE PROVISIONED AFTER THE FIRST BUILD IS NEVER RECORDED ON THE
  OWNERSHIP ROW (open, 2026-09-13, found taking the grants inventory).**
  `claimSiteSlug` writes `site_backends` with `neon_db: ""` — correct, since a
  first build is frontend-only by default — and the ONLY writer of that column is
  `saveBackend`, a POST carrying `resolution=ignore-duplicates`, which is an
  INSERT and cannot update the row already there. Measured: the only two PATCHes
  to `site_backends` anywhere in the Worker are the offline flag and the notify
  flag. So when an addon later provisions the database, `site_project` gets its
  row and `neon_db` stays empty for ever, and `siteBackendBySlug` — which every
  platform reader resolves through — answers `conn: null`.
  **MEASURED: four of the thirty-one sites with a Neon project are in this
  state** — `northgroup-5`, `ashgrove-1`, `washhouse-1`, `fretwork-1`, every one
  created after frontend-only became the default, plus `repairbench-1` since
  2026-09-15.
  **AND WHAT IT COSTS IS NOW VERIFIED, ON A LIVE CUSTOMER-SHAPED RUN (run 47,
  2026-09-15) — it is much worse than "the reader cannot resolve them".** The
  earlier note said the cost was unverified and that the addon reaches its
  database through `ensureSiteBackend`'s own return. **Both halves of that were
  true and the conclusion drawn from them was wrong**: the addon route resolves
  `adb` through `siteBackendBySlug` FIRST, and the two lines under it are
  `let aSpec = adb ? null : { tables: [] }` and an `if (adb)` around the
  `_meta.schema` read. So a site in this state tells every add designer it has
  **no tables**, whatever is really in its database. Run 47 asked for a page
  counting booked repairs on a site whose `bookings` table was twelve minutes
  old; the designer said *"I'll add a repairs table so the status page's count
  function has booked jobs to count"*, made a second table, and the published
  page reads `0`. `aProvisioned` rides the same falsy `adb`, so the reply also
  claims the site got its database for it. And the merged spec written back to
  `_meta.schema` is derived from that empty baseline — `mergeAddonSchema` driven
  both ways answers `["repairs"]` against `["bookings","repairs"]` — so **the
  earlier table's DECLARATION is dropped while the table itself survives.**
  That makes this a data-model defect on the money path, not a reporting gap:
  every addon on an affected site designs against a site it cannot see.
  **BUT THE DROP DID NOT HAPPEN ON THIS SITE — MEASURED 2026-09-15 by the first
  live `backend repair --preview`**, which read `repairbench-1`'s stored spec and
  answered `schema: nothing missing (2 declared)`: every live application table
  IS declared, `bookings` included. **The `mergeAddonSchema` measurement above
  stands** — it was driven directly and says what that function does with an
  empty baseline. What is falsified is the inference from it to THIS site's
  stored spec. Whether `bookings` was ever absent from `_meta.schema` and
  something wrote it back, or whether the route took a different path than the
  drive models, is **unknown and is not being guessed** — the honest reading is
  that the function's behaviour and one site's stored state were conflated.
  The reference half of the defect is untouched by this and is still real:
  `site_backends.neon_db` is blank on all five.
  **FIXED IN CODE 2026-09-15, NOT YET RUN** — the section "THE FOUR STATES" has
  it in full. `ensureSiteBackend` records the name on every provision, so no new
  site can enter this state; `siteBackendDetail` resolves the five that already
  have, and stops rather than calling them empty when it cannot.
  `scripts/backend-repair.mjs --apply` closes the rows for good. **The five are
  `ashgrove-1`, `fretwork-1`, `northgroup-5`, `repairbench-1`, `washhouse-1`**,
  and the derivation is proven credential-free over the whole corpus: **27 of 27
  sites with a recorded name equal `dbNameForSite(slug)`, zero mismatches**. The
  script still verifies each one by connecting, because a name that derives is
  not a database that answers. **The run needs the service key and is the
  owner's press.**
- **AN ADDON DESIGNS A TABLE THAT NOTHING CAN EVER FILL — REPORTED SINCE
  2026-09-15, and deliberately not refused.** `repairs` was declared `read: "none", write: "none"` — the `admin`
  pair — so no client grant is emitted (measured live: `42501 permission denied
  for table repairs` to an anonymous POST) **and `seedSiteRows` skips it**, that
  function seeding the `display` pair and nothing else by a rule with its own
  measured history. The designer answered starter rows and they were correctly
  discarded. The table is empty by construction and the page counting it reads
  `0` for ever. **Nothing anywhere notices**: no step asks whether a table the
  same change designed a reader for has any way of gaining a row. The fix shape
  is a check at the cleaner, not a prompt — a table with no writer and no seed
  is a state the tool can refuse. **What shipped instead is a REPORT**, on the
  owner's correction that *"no client write grant does not mean no writer"*:
  `missingPopulation` names such a table only when the same change gave it a
  reader, and a seed, a function body, a job body or a client grant all count as
  a writer. A blanket refusal would have blocked every `display` table on the
  platform. **Still open**: nothing stops the designer choosing that shape in the
  first place — the customer is told, and the table is still empty.
- **THE SEED SKIP NOW REACHES THE CUSTOMER (closed 2026-09-15).** `seedSiteRows` answers
  `{seeded, skipped}` and `skipped` carries the exact sentence
  `"repairs: only display tables are seeded (…)"` — **the only thing that can
  say why a new table arrived empty**, in that function's own words. It is
  written into the migration record (`withApplied(…, { seeded: aSeeded })`) and
  no reply, no customer sentence and no developer record surfaces it; reading it
  needed an owner token. It rides `seedSkips` on the reply and its own clause
  in `coverNote` now, said as an EFFECT (the table starts empty) rather than as
  our rule about which tables are seeded — and it can never fire for a table
  nobody asked to seed, because the engine only records a skip against the
  design's own seed keys.
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
