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
**CI HAS READ IT: `unit tests` run 2590 on `ca58222`, green (2026-09-15
22:16:42→22:18:44Z, the suite step 109 s) — `# tests 6560 / # pass 6557 /
# fail 0 / # skipped 3`**, against local `6560 / 6558 / 0 / 2`; the third is the
recorded environment skip, which is why the number to carry is the TOTAL. Run
2591 is `unit.yml`'s `pull_request` trigger on the same sha. **No `site build`
fired and none was due**: the six changed files are two documents, `public/chat.js`
and three guards, and none is under `builder/**`, `worker.js` or any other glob in
that workflow's `paths`.

**NOT PROVEN LIVE.** Every measurement is from driving `public/chat.js` in a real
page scope; nothing is merged or deployed.
- **THE AGENT BUILDER'S AGENTS NOW RUN (2026-09-16).** A message typed to a saved
  agent is saved AND starts a run on the engine in `agent-builder/`, and the
  conversation shows that run's progress, result or failure. **`agent-builder/` is a
  SEPARATE PRODUCT with its own CLAUDE.md, and the full entry is there** — what
  belongs here is the site builder's half.
  **`POST /api/agent/send`** is the eighth `/api/agent/*` route. It mints the message
  and run ids, takes the tenant from `authUser(request).id` as every other one does,
  and calls ONE database function that saves the message and accepts the run in one
  transaction. **NOTHING ABOUT THE RUN'S SHAPE PASSES THROUGH THIS WORKER**: the
  function takes six arguments and not one of them is structured (asserted against
  Postgres's catalog — `jsonb` is the only type an entry, a bound or a history could
  arrive as), so the model, the tools and the bounds come from the engine's registry
  and a bug here cannot widen them.
  **THE KEY IS THE BROWSER'S AND IT IS MINTED PER PRESS, NOT PER REQUEST.** A double
  click and a lost response are the same event from a browser, and the database holds
  `(agent_id, send_key)` unique, so both must carry the SAME key — which is false the
  moment one is minted inside `agentSend`. It lives beside the draft
  (`agentSendKeys`), is cleared WITH it and **only on success**: clearing it after a
  failure makes the next press a different press, and a message the server already
  committed gains a second copy with a second run. The route REFUSES a send with no
  key rather than minting one, because retry safety failing open is the direction that
  duplicates a conversation.
  **AND NEITHER THE DRAFT NOR THE KEY NEEDS CLEARING ON AN ACCOUNT CHANGE — checked,
  not assumed.** `agentMsgDrafts` and `agentSendKeys` are in-memory maps keyed by agent
  id, and `doSignOut` ends in `location.reload()`, so every account change discards
  them with the page. They are unreachable in the meantime anyway: the composer draws
  only for an agent in `agentRows`, which is the server's list for whoever is signed in
  now. A defensive wipe would be a second wall in front of a reload, and the reload is
  the one that exists.
  **THE ANSWER IS READ FROM THE RUN AND NEVER COPIED INTO A MESSAGE ROW.**
  `agent_messages.role` still admits `'user'` and nothing else, deliberately: a row
  repeating the run's stop could disagree with it, and leaving the column as it is
  makes a forged agent reply *a row the database refuses* rather than a bug for this
  code to prevent. One view (`agent.agent_thread`) hands each message back with its
  run, so the two are never lined up in JavaScript.
  **FOUR STATES, AND QUEUED IS TOLD FROM WORKING BY THE STEP.** `agent.runs.status` is
  projected off the log and the accepting transaction writes the `started` entry, so a
  run reads `running` from the instant it is queued — measured on a real PostgreSQL,
  after an expectation written the other way round. `runView` is the one reader;
  `null` is a real answer for a message that started nothing (every imported
  conversation), and a failure carries the engine's own reason rather than "something
  went wrong".
  **THE SIMULATION IS LABELLED TWICE AND BOTH ARE READ FROM THE RUN'S OWN MODEL.** The
  answer's TEXT carries `[simulated]` from the engine and the chrome carries a chip;
  the redundancy is deliberate, because the chrome's label is gone the moment somebody
  copies an answer into an email. Neither is a constant and neither is sniffed out of
  the text — both come from `agent.runs.model`, so connecting a real provider stops
  the label with no change to any reader.
  **THE SCREEN WATCHES ON A TIMER AND THE BINDING IS ASKED WHEN IT FIRES.**
  `AGENT_POLL_MS` is 2,500; the poll is armed only by live work in a SUCCESSFUL read
  (a failed read arming one would hammer a server that is down at that interval for as
  long as the screen is open), and it re-asks the conversation AND the account when the
  timer fires, because between arming and firing somebody can open another
  conversation or sign in as somebody else. **A reload mid-run needs no recovery**:
  the browser holds no state about a run, so a reload is an ordinary read of a
  conversation that happens to have work in it.
  **⚠ A GUARD THAT ARMS A REAL TIMER MUST STOP IT IN A HOOK, NOT AT THE END OF ITS
  BODY — and this cost a whole mutation sweep.** A running conversation arms a 2.5
  second timer that RE-ARMS after each read, so a case whose assertion FAILS never
  reaches its own cleanup and the process never exits: `node --test` sat for eleven
  minutes on a mutant it had correctly killed, and the runner read a HANG instead of a
  kill. `t.after()` runs on the failing path too. **`--test-force-exit` IS NOT THE
  FIX**: measured, it reported **31 tests where the file has 36**, so it truncates the
  run — a flag that hides failures in exchange for exiting.
  **AND KILLING THE SWEEP BY PID ORPHANS ITS CHILD**, which this repository already
  records: a `node --test` from the first run was still holding a test file 23 minutes
  after its parent was gone. `ps --forest` is what shows it.
  **Guards**: `test/agent-send.test.mjs` (**22**, new) drives the route and the store;
  `test/agent-binding.test.mjs` **27 → 36** drives the send, the double press, the
  poll's binding, a reload mid-run, a failed run and what each state DRAWS;
  `agent-api` 42, with three of its censuses re-anchored off hardcoded counts onto
  `AGENT_ROUTES` itself. **Suite 6,590** — 6,560 + 22 + 8, and the arithmetic closes
  exactly.
  **Sweep: 39 mutants, 39 killed, 0 survived, 0 never applied, 2 comment-only controls
  survived** (two runs, split by the file each mutant touches so each ran only against
  the tests that can SEE it — a narrow list can only produce a false SURVIVOR, never a
  false kill).** Two survived the first pass and both were guard gaps in `agentRunHtml`,
  which nothing drove directly: a chrome label written unconditionally (which would
  keep saying "simulated" over a real provider's answer) and a message with no run
  drawn as a failure.
  **ALL THREE HALVES ARE LIVE (2026-09-16)** and each was verified rather than assumed:
  the migration as remote version `20260916031604` (read back, bodies byte-identical to
  this tree), the engine at `147fd716-a091-4c26-8e28-731d103971af` (its `/health` lists
  `authored`, which it did NOT before — that is what fixed the order), and this Worker
  through deploy **2125**, whose served `/chat.js` is byte-identical to the merged tree.
  **PROVEN THROUGH THE LIVE UI in a real browser: 16 checks, 0 failed** — send to message
  **824 ms**, send to answer **7.9 s** (the doorbell; the engine's own sweep is a
  one-minute cron), the `[simulated]` label in the text and the chrome, a half-typed next
  message surviving the poll with its caret and focus, a lost response keeping its words,
  and an edited retry landing as its own message. 14 runs, all answered, `attempts` never
  above 1.
  **⚠ AND THE LIVE SCREEN FOUND TWO DEFECTS THE WHOLE SUITE MISSED** — a successful send
  leaving its message in the box, and then the clear eating the first twelve characters of
  a next message — both because the fake `#agMsg` carried no `data-agent`, so the composer
  read wrote nothing. The full account is in `agent-builder/CLAUDE.md`; the rule to carry
  is that *the fixture was less capable than the render, in the function whose defect it
  was hiding.*

- **⚠ THREE DEFECTS IN THAT SCREEN, FOUND BY REVIEW AND EACH REPRODUCED FIRST
  (2026-09-16).** All three are the recorded shape: the code reads correctly, every guard
  passes, and the defect exists only while time passes and somebody is typing.
  **THE POLL DESTROYED WHAT WAS BEING TYPED.** `renderAgents` writes `innerHTML` and the
  poll calls it every `AGENT_POLL_MS` (2,500), while the draft it redraws from was written
  only on Send — so a sentence typed while waiting for an answer was destroyed at the next
  tick, EIGHT TIMES A MINUTE, with the caret and the focus going with it. A quiet reload
  already kept the thread on screen; it did not keep the person's half-typed reply.
  `renderAgents` is a WRAPPER now (`agentComposerRead` → `renderAgentsNow` →
  `agentComposerRestore`), so no caller has to remember, and the box carries
  `data-input="agent-msg"` so what is typed is the draft immediately rather than at Send.
  **THE BOX'S OWN ATTRIBUTE (`data-agent`) DECIDES WHOSE WORDS THEY ARE**, read off the
  element being replaced and never from whatever conversation is open now: restoring into
  one somebody has since opened would move their caret, which is a worse bug than the one
  being fixed. The input hook deliberately DRAWS NOTHING — a re-render per keystroke is
  the twitch the wrapper exists to remove.
  **A RETRY KEY MUST BE BOUND TO ITS PAYLOAD.** The key was held per conversation, so a
  send that committed with its response lost, then EDITED and pressed again, carried the
  first message's key: the server absorbed it, answered the original body, the browser read
  `ok` and cleared the box — the edit discarded silently, the conversation keeping words
  nobody wanted. `agentSendKeys` stores `{key, body}`: the same text is the same press (one
  message, one run, absorbed exactly as before), changed text is a new press with its own
  key. *Retry safety was never about the conversation; it was always about the payload.*
  **AND THE TRANSACTION ANSWERS `mismatch`**, which THIS browser can no longer provoke and
  which is handled anyway — another tab or an older cached script can, and the one outcome
  that must never happen is an edit vanishing behind an `ok`. On a mismatch the words stay,
  the key is dropped (so the next press is a NEW message) and a sentence says so.
  **DRAFTS ARE KEYED BY ACCOUNT AND CONVERSATION, AND THE KEY IS BOUND WITH THE REQUEST —
  an existing guard found that half.** Computing it from `agentUid()` when the answer
  arrives means a session that expired mid-send deletes a key belonging to nobody and
  leaves the real draft behind for ever. `undefined` (never falsy) is what means "whoever
  is here now", because a signed-out `''` is a real answer. The account half does not rest
  on `doSignOut`'s `location.reload()` three hundred lines away — this repository has the
  expiry of exactly that kind of reasoning recorded four times.
  **THE ENGINE IS RUNG AFTER THE COMMIT, AND THE RING IS A DOORBELL AND NEVER THE WORK.**
  `AGENT_RUN_QUEUE` is a Queues PRODUCER binding on the engine's own `agent-runs`; the
  route sends `{ runId }` once the transaction has committed. A failed ring is logged and
  said (`notified: false`) and never raised — the work is durable either way, and answering
  an error would tell a customer their message failed when it is committed and will run.
  **AN ABSORBED PRESS IS RUNG TOO**, because a first press whose ring failed left a row
  nobody had been told about, and a duplicate ring is harmless BY CONSTRUCTION (that is
  `claim_run`'s property, not this line's care). **PRODUCER ONLY**: a consumer here would
  be a second executor of other people's runs, and the queue census forbids it.
  **THE DEPLOY ENSURES BOTH QUEUES NOW**, because a binding naming a queue the account
  does not hold fails the WHOLE deploy and `agent-runs` is created by a different
  deployment — without it the ORDER of two products' first deploys would decide whether
  this one works. Idempotent; both may create it.
  **Guards**: `test/agent-binding.test.mjs` **36 → 42** (typing through a real poll with
  the cursor and focus asserted, the restore refusing another conversation, the control
  that a box naming no conversation is read by nobody, the input hook drawing nothing, an
  edited retry taking a new key, and an absorbed mismatch keeping the edit);
  `test/agent-send.test.mjs` **23 → 31** (the ring and its failure, no binding, an absorbed
  press rung, a runless send ringing nothing, `mismatch` on the wire, and the census that
  reads the ENGINE's own `m.body?.runId` plus both wrangler configs). **THE FAKE ELEMENT
  HAD TO GAIN REAL ATTRIBUTES, A SELECTION AND FOCUS** — it answered `null` to every
  `getAttribute` and did nothing on `focus()`, so the whole fix would have read as working
  with it deleted: *a fake LESS capable than the thing it stands in for hides a defect
  exactly as well as one that is more.*
  **Five older guards re-anchored, not appeased**: the queue census (a producer may name
  another Worker's queue, proved from THAT Worker's config, and must not be consumed here),
  the deploy's create step (read as the names it really creates, not one literal per
  queue — it became a loop), the image step's ordering (anchored on what the step DOES
  rather than on its title), and two draft anchors in the view guard.

- **AN AGENT HAS SETTINGS NOW: A STATUS, AND WHICH TOOLS IT MAY USE (2026-09-16).**
  Owner: *"persist and edit its name, instructions, and active/paused status…
  establish a server-controlled catalog of supported tools and an agent-specific
  selection of allowed tools. Only show tools actually implemented."* **The engine
  half — the catalog, the narrowing, the snapshot and the measured bounds — is in
  `agent-builder/CLAUDE.md`**; what belongs here is the site builder's.
  **THE CATALOG IS THE SERVER'S AND THE BROWSER ONLY DRAWS IT.** `AGENT_TOOLS` rides
  on `/api/agent/list`'s answer — one read for the screen, because the settings form
  is only reachable from it. It is a COPY of the engine's `OFFERED` names, declared
  as one, **censused both ways** in `test/agent-send.test.mjs`, which is the only
  place that may import both products. **What lives here and not there is the
  WORDS**: the engine's `description` is written for a MODEL deciding whether to
  call a thing, and `label`/`does` for a person deciding whether to allow it.
  **A SELECTION IS A POSITIVE INTERSECTION AND A REFUSED NAME IS NAMED.**
  `cleanTools` intersects with the catalog, collapses duplicates and takes the
  CATALOG'S order, so two saves of one selection are byte-identical; `readTools`
  refuses an unknown name rather than storing less than was asked for — a selection
  quietly shortened is a permission that appears granted and is not. **The catalog
  is a PARAMETER** (`cleanTools(v, catalog)`), because with one tool on the platform
  the order rule is undrivable and a sweep mutant taking the caller's order survived
  everything: *a wall nobody can drive is a wall nobody is guarding.*
  **ABSENT AND EMPTY ARE TWO DIFFERENT THINGS ON A SAVE.** `/api/agent/update` is a
  PATCH: a field the caller did not name is left alone, because a browser tab opened
  before today saves a name and an instruction and says nothing about either setting
  — filling them in from a default would un-pause an agent from a screen that never
  showed a pause control. `tools: []` is a real selection and `undefined` is silence.
  A status it cannot READ is a 400, never a default: reading a typo as `active`
  un-pauses on purpose and as `paused` stops what nobody asked to stop.
  **⚠ AND A CREATE CARRIES BOTH SETTINGS — CORRECTED 2026-09-16, and this line used
  to state the defect as the rule.** It read *"a create may choose tools and may not
  choose a status — nobody writes an agent in order to pause it"*, which was an
  argument about what people want and not about what the screen does: **the settings
  form draws a Paused checkbox for a NEW agent**, so the route dropping the field
  made that tick a control somebody sets and nothing reads. The agent came back
  active and the box was the only thing claiming otherwise — **a dead control that
  ANSWERS, wrongly**, which is this repository's own worst shape of that finding, one
  milestone after it was written down.
  **THE FIX IS FOUR LAYERS AND ABSENT STILL MEANS ACTIVE.** `agentSave`'s create body
  carries `status`, the route reads it through `readStatus` — **one reader for both
  writing routes now**, exactly as `readTools` already was, so the two cannot
  disagree about what may be stored — `store.create` puts the key on the insert row
  only when it was given, and the shim's INSERT lets an unnamed column fall to
  `default`. **"Default to active only when status is omitted" is the COLUMN's
  default and is never written in JavaScript**: `"active"` assigned here would be a
  second copy of it in a second language, and the copy that drifts is the one a
  migration cannot move. A junk value is the same 400 the update gives, where it used
  to be accepted and ignored.
  **Sweep: 43 mutants, 43 killed, 0 survived, 0 never applied, 3 comment-only
  controls survived** (the spec 40 → 46), and **all six new ones died on the first
  pass** — the create dropping the status, a junk status accepted there, the insert
  row dropping it, a silent create DEFAULTING it, the browser's body leaving it out
  again, and the browser hardcoding the pause instead of reading the control. One
  older mutant was **re-anchored, not appeased**: the update's inline refusal became
  `readStatus`'s, so its anchor was gone — caught by the pre-run census rather than
  by reading NOT APPLIED afterwards.
  **Guards**: `agent-send` 42 (one case REPLACED by its opposite, plus the
  store-request assertion inverted), `agent-binding` 55 → 56, `agent-api` 42 with its
  body-reads census **widened from the handler onto the whole file** — a body read
  moved into a HELPER and the old window could not see it, which is this repository's
  "a route family reached through a helper has no literal there" met in the census
  written to stop it; `readTools` was already outside that window before today, so my
  own change is what made a pre-existing blind spot load-bearing. **All four replaced
  assertions were proved RED against the pre-change product** before being believed,
  the `active` control included — without it a screen hardcoding `"paused"` satisfies
  every other assertion. Real PostgreSQL 410 → **416** checks, the local end-to-end
  94 → **112**, both 0 failed and both arithmetics closing exactly.
  **A PAUSE IS A 409 WITH ITS OWN FLAG, never the missing-agent 404.** The request
  was well formed, the agent exists and is theirs, and nothing is broken; `paused:
  true` rides beside the sentence so the screen offers the one thing that helps
  rather than parsing our prose for it. **Nothing at all is written on that path**,
  so the browser keeps the words AND the retry key — the next press against a
  resumed agent is the SAME press, and clearing the key is how a lost message
  becomes two.
  **`/api/agent/message` IS DELIBERATELY UNCHANGED, and it is worth saying why.**
  It saves a message and starts no run, so a pause has nothing there to refuse —
  "refuse new runs" is about work, and writing is not work. It also has **no caller
  in the browser** any more (the screen sends through `/api/agent/send`), so the
  question is about a route only a script reaches. Left as it is rather than
  hardened for a case nobody can produce.
  **`agentRow` FAILS CLOSED ON BOTH SETTINGS.** A status it cannot read is `paused`
  (being wrong that way costs a press of Resume; the other way is an agent taking
  work its owner stopped) and a selection it cannot read is empty.
  **THE SCREEN**: tool checkboxes drawn from the catalog with the stored ticks, a
  Paused checkbox, and **an honest sentence when the catalog is empty** — a real
  branch, because a Worker that predates the catalog answers no `tools` key.
  **The controls keep their own DOM state**, so ticking one re-renders nothing and
  the two text boxes above keep what is typed in them; `agentSave` reads the ticks
  off the boxes, and the draft carries all four fields so a failed save redraws the
  ticks and the pause that failed rather than the stored ones. **The form stays open
  and says "Saved"** where the button is, and a create becomes an edit of what it
  just made. A paused agent shows a chip on its row, a line above its message box
  with a way into its settings, and a dead Send button — **the textarea stays
  enabled**, because disabling it is how a draft gets lost.
  **Sweep: 37 mutants, 37 killed, 0 survived, 0 never applied, 3 comment-only
  controls survived** (`scripts/mutants/agent-settings.json`, over `agent-store.mjs`,
  `public/chat.js` and the sheet). Six survived the first pass; **five were gaps in
  the new guards and one was INERT and is declared in the code**: `JSON.stringify`
  OMITS a key whose value is `undefined`, so guarding the two settings assignments
  changes nothing on the wire — measured, and replaced by the observable direction
  (a silent save DEFAULTING the field). The other five were the four that live in
  `store.update`'s own body, which the route's arguments cannot see, and a catalog
  read as whatever the answer carried.
  **Guards**: `agent-send` 31 → 42 (the census both ways, the caps read out of the
  migration, the two readers, the routes, the paused 409, and **the REQUEST the
  store really sends** — four sweep mutants lived in `store.update`'s body and the
  route's own arguments cannot see any of them), `agent-binding` 45 → 55 (the form
  hydrated from the markup it really drew, so a case that unticks a box unticks a
  real control), `agent-api` 42 with two re-anchored. **Four older guards
  re-anchored, not appeased**: the body-reads census gained two SETTINGS rather than
  an exemption; `agentRow`'s key set; the failed-save draft shape (a strictly
  stronger claim); and the `agentDraft = {…}` source scan, which was pinned to the
  literal and now reads the FIELD LIST.
  **ALL THREE HALVES ARE LIVE (2026-09-16), IN THAT ORDER, AND THE ORDER IS THE
  FINDING.** migration → engine → site, three pieces each first for its own
  reason, and the middle one is the one that was nearly got wrong: this
  product's own note said the two Workers were "order-free", which was true
  about PERMISSIONS and silent about HONESTY. The live engine handed every
  authored run `tools: []` and had no `narrowTools` — read out of `6aec0ad5`,
  the sha the serving version `147fd716` was deployed from — so shipping the
  settings form first would have put a tool tick on screen that saves, draws,
  and can never be honoured. **A dead control that ANSWERS, which is the exact
  defect this round was opened to fix, one product over.** Engine first is a
  MEASURED no-op: until the site ships the tick nobody can set `tools`, every
  row holds the column's `'{}'` default, and `narrowTools(agent, [])` offers
  nothing — byte for byte what the old engine already did. **The rule to carry:
  whichever side DECIDES a thing must not go out before the side that ACTS on
  it.** The full account is in `agent-builder/CLAUDE.md`.
  - **Migration** `20260916085453`, applied and read back byte-identical to this
    tree, while there were zero agents and zero messages.
  - **Engine**: `agent deploy` run 27 on `54b29a4`, all thirteen steps green.
    `wait for THIS version to answer` read `attempt 1: version=ece0a067-db5b-
    4410-ab63-61bd088a7bc7 ok=1`, the live verification **71 passed / 0 failed**
    over five real runs, and the cleanup `13 users listed, 0 left`. Read back
    from a second process: `/health` answers that version, `deployedAt
    09:31:32Z`, `ok: true`, `missing: []`. **THE VERSION ID IS THE ONLY
    DISCRIMINATOR AVAILABLE and that is said rather than glossed**: `worker.mjs`
    is byte-identical between the two shas, so `/health`'s SHAPE could not move
    — the chain is run 27 on that sha → wrangler deploy from that checkout →
    `ece0a067` → `/health` answering it.
  - **Site**: **deploy 2130, 09:40:28→09:43:17Z, green in 2m49s**, on `main`
    `f22c166` → `54b29a4` (fast-forward). Image step 2m06s, Wrangler 18s.
  **THE IMAGE ID WAS COMPUTED BEFORE THE PUSH AND THE DEPLOY AGREED ON BOTH
  SIDES — the sixth cross-check, and the strongest form of it yet.** Earlier
  ones matched the NEW id only; this log carries the OLD one too, so both ends
  of the transition are checked against arithmetic done before anything moved:
  `origin/main` → `62c2700fa8c843c2` and the candidate → `d927ff27fd186f30`
  (183 inputs each). The step printed `built
  isibi-app-sitebuildcontainer:d927ff27fd…86f30 (registry answered 404; …83
  inputs off ./Dockerfile)` and **the container rolled**, read out of the log's
  own diff rather than inferred from the step's duration:
  `EDIT isibi-app-sitebuildcontainer` at **09:43:09.99Z**,
  `- "image": "…:62c2700fa8c843c2"` / `+ "image": "…:d927ff27fd…86f30"`,
  `SUCCESS Modified application`, `Applied changes` at 09:43:11.63Z. **So the
  15–20 minute hold ran to ~09:58–10:03Z.**
  **AND THE SERVED-FILE CHECK IS AVAILABLE THIS TIME**, because `public/` really
  changed: `Found 2 new or modified static assets`, and both are **byte-identical
  to the merged tree** — `chat.js` 665,502 bytes sha256 `a8b1dc1674cf5bf4`
  (654,556 / `30ea523e42a0efb3` before) and `styles.css` 342,648 /
  `8bfc582c9cd7d11c`. **The cheap discriminator for this particular change is
  `agPaused`, 0 occurrences before and 2 after** — the identifier the whole fix
  turns on, absent from every byte the platform served until this deploy.
  **REGRESSION: BYTE-IDENTICAL, baseline taken 46 seconds before the push and
  compared four minutes after.** Six sites 200 at the same sizes (repairbench-1
  46,336 · ashgrove-1 31,120 · fretwork-1 58,404 · northgroup-5 1,641 ·
  washhouse-1 52,404 · ben-crowe-guitar 52,060), and the interactive half
  because a 200 is an availability check and never a health check: `/status`
  200/6,272 and `/booking-check` 200/6,390 on the same `x-site-version
  01789551373761-47doj7`, both RPCs answering **3**. Gate discriminator
  401/401/401/404. **`repairbench-1` republished BETWEEN my two baselines and
  not across this deploy** — 46,151 → 46,336 and the version moving from
  `01789500698949-dggs37`, both already true at 09:39:42Z — which is why the
  baseline is retaken immediately before the push rather than reused from
  earlier in a session. **AND THE CAUSE IS NOW KNOWN RATHER THAN GUESSED**: it
  was `lane sweep` run 49, the owner's paid addon press, which republished that
  site. The first reading of this recorded it as *unexplained but not ours*,
  which was the honest answer at the time and is superseded by main's own
  history five minutes later.
  **The merge started exactly one workflow**, deploy 2130 and nothing else,
  which is the merge-trigger census holding in the live.
  **⚠ AND A RECORDED RULE WAS BROKEN WITH UNDER TWO MINUTES TO SPARE, which is
  worth writing down precisely because nothing went wrong.** The rule is *never
  push to main while a live run is in flight* — the roll replaces the container
  under whatever is running. Measured, after the fact: `lane sweep` run 49 ran
  **09:31:16→09:41:18Z**, my push to main was **09:40:23Z**, and the container
  rolled at **09:43:09.99Z**. So the PUSH overlapped that run's last 55 seconds
  and the ROLL — which is what the rule is really about — landed **1m52s after
  it ended**. Nothing was harmed and the margin was thin.
  **THE REASON IS STRUCTURAL AND IS THE REUSABLE PART: NOTHING TELLS ONE SESSION
  THAT ANOTHER HAS A PAID RUN IN FLIGHT.** Main's history is the only signal and
  it arrives at the COMMIT, which here was 09:46 — five minutes after the push
  it would have warned about. **The cheap check that WOULD have seen it is a
  read of the Actions runs before pushing**, not of main: `lane sweep` was
  `in_progress` and visible from 09:31. Ask GitHub what is RUNNING, not what has
  LANDED, before a push that rolls the container.
  **NOT PROVEN LIVE: a customer ticking a tool and watching it run.** That needs
  a session on the building account, and signing in as the owner needs
  `SUPABASE_SERVICE_KEY`, which lives only in GitHub Actions — the same wall
  every paid harness here meets. What IS established is each layer on its own:
  the database by the migration read-back, the engine by 71 live checks, and the
  screen by the served bytes matching the tree.

- **AN AGENT CAN BE AUTOMATED NOW: trigger → condition → action → saved result
  (2026-09-16).** Owner: *"Build one complete automation that a customer can
  configure and run"*, and *"Keep the real model for the end."* **The engine half —
  the step registry, the workflow executor, the scheduler, the once-per-occurrence
  guarantee and the DST arithmetic — is in `agent-builder/CLAUDE.md`**; what belongs
  here is the site builder's.
  **SEVEN ROUTES, AND `worker.js` NEEDED NO CHANGE AT ALL.** The `/api/agent/*`
  block dispatches on `Object.hasOwn(AGENT_ROUTES, url.pathname)` and already hands
  every handler `query`, `body`, `tenant: user.id`, `store`, `ring` and `log` — so
  adding `automations`, `automation-create`, `automation-update`, `automation-enable`,
  `automation-delete`, `automation-run` and `automation-history` is seven entries on
  one object. **That is the gate-once design paying for itself**: an eighth route
  cannot be added ungated because there is nowhere to add one that is not already
  behind the gate, and the tenant census over the whole family passes by construction.
  **THE STEP CATALOG HERE IS A COPY, AND IT IS CENSUSED BOTH WAYS.** `worker.js`'s
  module graph is a container image input, so importing the engine's
  `src/automations.mjs` into `agent-store.mjs` would put the agent product inside the
  site's container image. `AUTOMATION_STEPS` is declared as a copy and
  `test/agent-send.test.mjs` — the ONE file that may import both products — asserts
  the two name sets equal in both directions, plus each step's kind, label, does and
  field shape, and the two caps. **What lives here and not there is the WORDS**: the
  engine's are written for an executor, `label`/`does` for a person choosing a step.
  **A SELECTION IS VALIDATED WHERE IT IS WRITTEN, AND A REFUSED STEP IS NAMED.**
  `cleanWorkflow` refuses an unknown type, a note past `MAX_STEP_NOTE` (2000) and a
  day that is not a day, by name, and **never shortens** — a workflow quietly missing
  the step it could not read is one that looks saved and does something else. The day
  list takes the WEEK'S order rather than the ticking order, so two saves of one
  selection are byte-identical. `validTimeZone` asks `Intl`, never a list.
  **`enabled` IS REFUSED, NEVER COERCED**, and the toggle's body carries the id and
  the flag and nothing else: a route that read `"false"` as true would disable
  nothing while saying it had.
  **`automationRow` AND `executionRow` FAIL CLOSED.** A schedule it cannot read is
  `manual` (no next run rather than a wrong one), and an execution's state is
  DERIVED from the run's own `status`/`stop` — `queued · done · skipped · failed ·
  missed · paused` — because `agent.automation_runs` deliberately has no status
  column to disagree with the journal.
  **⚠ TWO REFUSALS ARE 409s WITH THEIR OWN FLAGS, never the missing-agent 404**: a
  disabled automation and a paused agent are both "not now", the request was well
  formed, and the screen offers the one thing that helps rather than parsing prose
  for it. **Nothing at all is written on either path.**
  **THE SCREEN** is a section on the existing agent view: a list with a next-run
  line and an execution history, a form with a name, an enabled tick, a trigger
  (Run now / daily at a time in a zone) and an ORDERED step list with add, move and
  remove. No canvas.
  **⚠ AND THE FORM DREW ZERO STEPS — a defect a real browser found and the whole
  suite could not.** `renderAgents` rebuilds from `innerHTML` and reads the live form
  back first so a re-render cannot eat what is typed; a structural change (adding,
  moving or dropping a step) then wrote the new list and the read-back *immediately
  overwrote it with the stale DOM*. The fix is a GENERATION NUMBER on the drawing:
  the form carries `data-gen`, `agentAutoFormRead` reads it back only when the
  drawing is as new as what is held, and `agentAutoStructural` bumps it. *A
  read-first door is correct until something writes a value the DOM has never seen.*
  **AND `gen` LEAKED ONTO THE WIRE** in the create body until it was destructured
  out — the draft's own bookkeeping arriving at the server as a field.
  **A RUN NOW OPENS THE HISTORY AND WATCHES IT**, `AUTO_WATCH_MS` 1500 for at most
  `AUTO_WATCH_TRIES` (6) reads, armed only by a successful read and re-asking the
  account and the agent when it fires — the same binding rule the conversation poll
  follows, for the same reason.
  **⚠ AND THE EXECUTION HISTORY DREW THE WORD `undefined`, THREE TIMES.** The three
  optional lines — what it saved, why it skipped, what broke — were gated on
  `!== null`, which is right for every row `executionRow` builds (it answers all three
  as `string | null`) and **`undefined !== null` is TRUE**, so a row that does not
  CARRY the keys drew the literal word, the last of them in the red error slot.
  MEASURED in a real render: 3 occurrences before, 0 after. **No unit case could see
  it, because every fixture was the real producer's output** — which is the right way
  to build a fixture and is exactly why the new guard's is deliberately not.
  `autoSaid` is the one test all three go through, so `null`, an absent key and an
  empty string are ONE answer. *Cannot-tell must never read as a value*, in the one
  layer where a row of some other shape eventually arrives.
  **AND THE GENERATION GATE READ "NO ATTRIBUTE" AS GENERATION ZERO.** `|| '0'` on
  `getAttribute('data-gen')` turned an undeclared generation into the one value a
  fresh draft always holds, so a form element found before anything had drawn it
  passed the gate and the draft was overwritten from an EMPTY DOM. Same trap, same
  screen, one function apart — and the second one is what a fake `getElementById`
  that creates on demand makes reachable, which is how it was found.
  **OPEN, and it is a design call rather than a defect**: at the page's real 560px
  the row gives **262.8px to its four buttons and 245.6px to the automation's name,
  schedule and steps** (card 553.6px, measured in a real browser), and the actions do
  NOT wrap below on that width. It is legible and it is tight; whether the actions
  should drop to their own line is the owner's.
  **MEASURED**: site suite **6,720** (6,718 pass, 2 skipped, 0 fail); `agent-binding`
  42 → **74**, `agent-automations` **19**, `agent-send` 42 → **43**. Site sweep
  (`scripts/mutants/automations.json`, 11 test files — a narrow list can only produce a
  false SURVIVOR, never a false kill): **51 mutants, 51 killed, 0 survived, 0 never
  applied, 2 comment-only controls survived.**
  **Pass 1 read 43/8 and not one survivor was the product's — but two of them were
  CASES THAT ASSERTED NOTHING, which is the more useful finding.** `held()` hands back
  `{p, release}` and two of my own cases asked for `gate.res`, which is `undefined`: the
  save fell into its own catch and the list answer never landed, so both passed with the
  wall deleted. Every other held-gate case in that file uses `gate.p`. Both now have a
  CONTROL underneath — the same save landing on the form it was pressed from DOES become
  an edit, the same answer landing on the screen that asked for it IS written — because
  a negative assertion is only worth what its observer is worth.
  Of the other six: the history read's tenant filter and `answerOf`'s junk-answer wall
  were undriven (the store request census now walks **every** automation operation and
  asserts its own count, so one added later fails by existing); the save-through-the-gate
  and both watch properties had no case at all; and the generation belt was **INERT** —
  with `|| '0'` already gone, `null !== String(gen)` returns anyway — so it is declared
  in the code and mutated as a PAIR with the default it belts.
- **AND ALL THREE HALVES ARE LIVE (2026-09-17), IN THE ORDER migration → engine →
  site, each first for its own reason.** Owner: *"Merge carefully"*, and careful here
  meant the ORDER above everything: the migration first because the engine's cron calls
  `tick_automations` every minute and this Worker's list route reads `agent.automations`;
  the ENGINE before the site because a form that saves a step no executor can run is **a
  control that ANSWERS, wrongly** — the defect the settings round was opened to fix, one
  milestone earlier. The engine's half is in `agent-builder/CLAUDE.md`; this is the site's.
  - **Migration `20260917003304`**, applied while the platform held ZERO agents. Going
    before the engine was CHECKED: it redefines `agent.claim_run`, which the live engine
    was calling, and the live body read back byte-for-byte as the new one minus its one
    new field. Equality with the committed file was proved by EXECUTION (357 objects
    across two throwaway local databases) and then by a narrowed read-back of the live
    result — **82 objects, md5 `976acfa04457bc8242958900e51d8284`, identical on all
    three**. A whole-schema census is the WRONG instrument and was tried first: it counts
    roles and grants the environments legitimately differ on.
  - **Engine**: `agent deploy` run 35, thirteen steps green, **71 passed / 0 failed**.
  - **Site**: **deploy 2133, 00:52:28→00:55:26Z, green in 2m58s**, on `main` `10a6c5d` →
    `522d00e` (fast-forward). Image step 2m13s, Wrangler 20s.
  **⚠ AND POSTGREST HAD THE NEW RELATIONS BEFORE THIS WORKER SHIPPED — the check that
  belongs to THIS side.** `agent.automations`, `automation_runs` and `automation_history`
  each answer **`42501 permission denied for schema agent`** to the publishable key, not
  `PGRST205`, with the pre-existing `agents` answering identically as the CONTROL.
  Without it the agent list would 400 on a relation the schema cache has never seen —
  the recorded settings-round defect, met from the other direction and closed in advance.
  **THE IMAGE ID WAS COMPUTED BEFORE THE PUSH AND THE DEPLOY AGREED ON BOTH ENDS — the
  seventh cross-check of that technique, and the strongest available form of it.**
  `origin/main` → **`03fd9114aab4c098`** and the candidate → **`7273d2569866364f`** (183
  inputs each), both hashed before anything moved; the log's own diff then reads
  `- "image": …03fd9114aab4c098` / `+ "image": …7273d2569866364f`, `EDIT
  isibi-app-sitebuildcontainer`, `SUCCESS Modified application`, `Applied changes` at
  **00:55:20.88Z** — read out of the diff rather than inferred from the step's duration.
  **So the 15–20 minute hold ran to ~01:10–01:15Z.** The ids differ because
  `agent-store.mjs` is on the Dockerfile's COPY line.
  **THE SERVED-FILE CHECK IS AVAILABLE AND IT DISCRIMINATES THIS DEPLOY.** `Found 2 new
  or modified static assets` (`/chat.js`, `/styles.css`), and both are **byte-identical
  to the merged tree** — `chat.js` 705,648 bytes sha256 `56c3cfa2c177e6a5` (665,502 /
  `a8b1dc1674cf5bf4` before), `styles.css` 348,527 / `9a72381a99f662b7`. **The cheap
  discriminator is `agAutoForm`: 0 occurrences in what main served before, 2 now** — the
  identifier the whole Automations form turns on, absent from every byte the platform
  had ever served. `env.AGENT_RUN_QUEUE (agent-runs)` and `Producer for agent-runs` are
  in the deploy's own binding list, so the site's ring to the engine is live.
  **REGRESSION: BYTE-IDENTICAL, with the baseline taken immediately BEFORE the push and
  compared after** (the process miss of two rounds ago, not repeated). Six sites 200 at
  the same sizes (repairbench-1 46,355 · fretwork-1 58,523 · ashgrove-1 31,120 ·
  northgroup-5 1,641 · washhouse-1 52,404 · ben-crowe-guitar 52,060), and the
  interactive half because a 200 is an availability check and never a health check:
  `/status` **200/6,272** and `/booking-check` **200/6,390** on the same
  `x-site-version 01789551373761-47doj7`, with `count_booked_repairs` and
  `count_existing_bookings` both **200 answering 3**. Gate discriminator 401/401/401/404.
  **The merge started exactly one workflow** — deploy 2133 and nothing else.
  **MEASURED ON THE MERGED TREE: site suite 6,743** (6,741 pass, 2 skipped, 0 fail), and
  **the arithmetic closes exactly**: this branch's 6,720 plus main's **23**, isolated by
  running the three test files main touched at both tips (77 at the merged tree against
  54 at the pre-merge tip, `test/job-delivery.test.mjs` being new) rather than by
  subtracting. Only `CLAUDE.md` and `docs/owner-notes.md` were touched by both sides of
  the merge, so there was no clean-but-wrong auto-merge in any code file to hunt.
  **AND THE SQL SWEEP'S SINGLE CLEAN PASS: 123 mutants, 123 killed, 0 survived, 0 never
  applied, 6 comment-only controls survived.** The spec holds 129 entries — 123 product
  mutants and 6 controls — and the runner counts only the product ones, which is why
  both passes read "123": the two survivors pass 1 found are killed here in one run
  rather than in a targeted re-run bolted onto a stale tally.
  **⚠ AND A SWEEP'S RESTORE TRAP MUST NOT FIRE ON A SUCCESSFUL EXIT — it discards your
  own uncommitted work.** Recorded in THE TRAPS; it cost one restore this round.
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
**`search_path` was UNRESOLVED here and is RESOLVED as of 2026-09-16** — the
review section above has the measurement, the correction and what it does not
settle. Left standing as it was written because the entry is dated; the fact
that is true today is in that section.

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
4. **`search_path` — MEASURED AND ANSWERED 2026-09-16**, and this item said
   "neither has been checked", which was the honest state then and is not the
   state now. Both halves were checked: the mechanism is real (a role with **no
   `CREATE` anywhere** redirects an unpinned definer function through `pg_temp`,
   measured on a real PostgreSQL 16) and the reachability turns on Neon's Data
   API exposing no DDL, which is a layer we do not own. The correction is one
   clause and is written, guarded and swept. **See the `search_path` review
   section above; NOT merged and NOT deployed** — the press is the owner's.

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

**MERGED AND LIVE — deploy 2121, 2026-09-15 16:35:17→16:36:03Z, green in 46
seconds**, on `main` `9a4ac614` → `76ef26c8` (fast-forward; 4 commits, 7 files).
**THE IMAGE ID WAS COMPUTED BEFORE THE MERGE AND THE DEPLOY AGREED WITH IT**:
`origin/main` and the branch tip both hashed to `6246eb17cd6595c4` (182 inputs),
so nothing an image is built from moved — and the step's own line reads `IMAGE
SiteBuildContainer: reused isibi-app-sitebuildcontainer:6246eb…7cd6595c4
(registry answered 200; …82 inputs off ./Dockerfile)`, 1 second. Wrangler
answered `no changes isibi-app-sitebuildcontainer` and `╰ No changes to be
made`, so **the container did NOT roll and no 15–20 minute hold applies** — read
out of the log's own diff rather than inferred from the step's duration.
`Uploaded isibi-app (3.55 sec)`, `Current Version ID: c85b09e4-2c50-4ff5-9a25-…`.
**NO SERVED ASSET CHANGED** (`No updated asset files to upload` — the merge
touched `.github/workflows/`, `scripts/`, `test/` and the two documents, nothing
under `public/`), so there is no file-hash check for this deploy; what stands in
is the gate discriminator, measured after it: `/api/site/build-health` **401**,
`/api/site/runtime` **401**, `/api/nope-not-a-route` **404**. The five sites all
answer **200** (`repairbench-1` 45,928 B · `ashgrove-1` 31,120 · `fretwork-1`
58,285 · `northgroup-5` 1,641 · `washhouse-1` 52,404) — **an availability check
and never a health check**, this file's own rule, which is why the interactive
half was measured too: `/status` **200**, 5,970 B, `x-site-version
01789437370636-f11bde`, build `mu20t4j1-ziyak2`, and the public RPC
`POST /api/db/repairbench-1/data/rpc/count_booked_repairs` **200 answering `0`**
— unchanged, because the repair has not run.

**BOTH WORKFLOWS ARE REGISTERED ON MAIN AND THE FORM REALLY OFFERS THE NEW
MODE.** Asked BY NAME rather than off the listing: `GET
/actions/workflows/backend-repair.yml` **200** and `repairbench-count-fix.yml`
**200**, and main's own copy of the file carries `options: [preview,
apply-reference, apply, verify]` and `shell: bash`. **The dispatch is still
refused**, re-tested rather than asserted: a direct REST POST with the right
endpoint, headers and body answers **403 `Resource not accessible by
integration`**, the MCP tool answers the same 403 on the same endpoint, and a
**read control on the same token answers 200** — so it is the `actions: write`
permission and not the credential. The press is the owner's, as recorded.

### AND IT RAN — `repairbench-1`'s REFERENCE IS WRITTEN AND VERIFIED (2026-09-15)

The owner's two presses, both green, the code under them proved unchanged first.
**THE RUNS, BY LINK, because a quoted log is a transcription and the run is the
record** — `https://github.com/canias7/isibi-app/actions/runs/<id>`: `backend
repair` preview **34939144314**, apply-reference **34999557540**, verify
**35000218315**.

**`backend repair` run 2, 17:10:10→17:10:27Z, `--apply-reference --slug
repairbench-1`, green in 17 s:**

```
mode: apply-reference  slug: repairbench-1
scope: ashgrove-1, fretwork-1, northgroup-5, repairbench-1, washhouse-1
1 site(s): 1 with a database (incomplete 1)
repairbench-1 [incomplete]: identity PROVEN (project-row-for-this-slug-names-a-database-the-server-confirms)
    reference: written site_repairbench_1
    schema: nothing missing (2 declared)

1 reference(s) written, 0 schema(s) recovered, 0 refused on identity, 0 failed.
```

**`backend repair` run 3, 17:16:24→17:16:39Z, `--verify --slug repairbench-1`,
green in 15 s, exit 0:**

```
1 site(s): 1 with a database (ready 1)
repairbench-1: VERIFIED
    ok   reference recorded — site_repairbench_1
    ok   reference is the derived name — site_repairbench_1 vs site_repairbench_1
    ok   database answers and is this site's — project-row-for-this-slug-names-a-database-the-server-confirms
    ok   stored schema readable — stored (stored)
    ok   every live table declared — 2 table(s), all declared

1 verified, 0 not verified.
```

- **THE STATE LINE IS THE INDEPENDENT READ-BACK.** Every earlier run said
  `incomplete 1`; run 3 says **`ready 1`** — a fresh process re-reading Supabase
  through `siteBackendDetail` and classifying the site, which only answers
  `ready` when `neon_db` names a database. The verdict is not the writer saying
  it succeeded.
- **NOTHING WAS WITHHELD BECAUSE NOTHING WAS OUTSTANDING.** `schema: nothing
  missing` matches the preview, so the `NOT APPLIED` sentence and the
  `REPORTED AND NOT APPLIED` tally are correctly absent rather than skipped —
  the reference-only bound was never tested against real schema work here, and
  that is what the driven demonstration in the section above is for.
- **`shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}`** is in both
  run headers, so the verify's nonzero exit could reach the step.
- **THE CODE THAT RAN WAS THE CODE REVIEWED, CHECKED RATHER THAN ASSUMED.**
  `main` moved under the presses — `76ef26c8` → `ef55f4de`, another session's
  `agent-builder` tree, 52 files and 17,746 insertions, **all additions**. A
  diff over `scripts/backend-repair.mjs`, `scripts/repairbench-count-fix.mjs`,
  both workflows, `site-backend-state.mjs`, `site-schema-recover.mjs` and
  `site-schema.mjs` across those two commits is EMPTY. *A `checkout` pinned to
  `ref: main` means the tool's code is whatever main holds at press time, so
  "the reviewed tip" and "the tip that ran" are two different questions.*

**`repairbench-1` IS OUT OF THE FIVE.** Four remain `incomplete` and untouched:
`ashgrove-1`, `fretwork-1`, `northgroup-5`, `washhouse-1`.

### AND THE COUNT FUNCTION IS CORRECTED — `/status` READS 3 (2026-09-15)

Three presses on `repairbench count fix`, all green, all on `main` `ef55f4de`.
**Run 1 (preview, 17:19:06→17:19:47Z)**, **run 2 (apply, 17:48:02→17:48:34Z)**,
**run 3 (verify, 17:52:25→17:52:40Z, exit 0)** —
`https://github.com/canias7/isibi-app/actions/runs/<id>`, ids **35000500401**,
**35003509208**, **35003953873**.

**ONE IDENTIFIER MOVED AND THE ARITHMETIC PROVES IT: the definition went 159 →
160 characters**, which is exactly `bookings`(8) − `repairs`(7). `RETURNS
bigint`, `LANGUAGE sql` and **`SECURITY DEFINER`** all came through as Postgres
itself had written them, because the statement was rewritten from
`pg_get_functiondef` rather than rebuilt from a template — the recorded reason
that rule exists, now with a live instance behind it.

**THE DIFF AS THE RUN PRINTED IT, both definitions whole rather than the one
changed line**, because "the rest of the definition is preserved" is a claim
about the parts that did NOT move and a one-line diff cannot carry it:

```
current definition (159 chars):
CREATE OR REPLACE FUNCTION public.count_booked_repairs()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ SELECT COUNT(*) FROM repairs $function$

would replace 1 occurrence(s) of "repairs" with "bookings":
CREATE OR REPLACE FUNCTION public.count_booked_repairs()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ SELECT COUNT(*) FROM bookings $function$
```

Run 3 read it back at **160 chars** with `FROM bookings`. **`1 occurrence(s)` is
the wall doing its job in the log**: `\brepairs\b` cannot match inside
`count_booked_repairs` because `_` is a word character, so the function's own
NAME was never a candidate — the count in that sentence is what says so.

**THE THREE NUMBERS, before and after, from the run's own output:**

| reader | before | after |
|---|---|---|
| `SELECT COUNT(*) FROM bookings` | 3 | **3** |
| `count_booked_repairs()` direct | **0** | **3** |
| the site's own public RPC (HTTP 200) | **0** | **3** |

`PASS — all three agree` on the apply; `VERIFY PASSED — all three counts agree
and the function reads bookings` on the separate verify run, which sits ABOVE
the rewrite and exits nonzero on any failed postcondition. **And the RPC was
read a second time from this session**, through both addresses
(`gofarther.dev/api/db/…` and `repairbench-1.gofarther.app/api/db/…`), both
**200 answering `3`** — two processes, one number.

**AND THE BROWSER CHECK IS ITS OWN CLAIM, with a baseline taken BEFORE the
press.** A real Chromium opened `/status` twice with the same script: the
rendered figure under *"Repairs currently booked"* went **`0` → `3`**, the
page's own recorded network call went `…/rpc/count_booked_repairs → 0` → `→ 3`,
and there were no page errors either time. **`x-site-version
01789437370636-f11bde` in both**, so the site was never republished and never
needed to be — the page had been asking the right question all along and the
function was answering about the wrong table. That is why this cost no build,
no container and no credits.
**The two checks are deliberately separate and neither substitutes for the
other**: the RPC asks the database over HTTP, the browser runs the real route
chunk and reads the pixels' own source — and the RECORDED CALL is what ties
"the page shows 3" to the call that produced it rather than to a number that
happens to be on screen. This is the shape the "a 200 is an availability check
and never a health check" trap asks for, run for the first time.

**THE SESSION'S BROWSER TRUST STORE WAS EMPTY, and that is worth recording
because a render is now a usable instrument here.** Chromium refused the site's
certificate with `net::ERR_CERT_AUTHORITY_INVALID`: the agent proxy
re-terminates TLS, and `/root/.pki/nssdb` held **zero** certificates despite the
proxy's README saying the browser NSS store is set up. The fix is
`apt-get install libnss3-tools` then `certutil -A -n ccr-agent-proxy -t "C,," -d
sql:$HOME/.pki/nssdb -i /root/.ccr/agent-proxy-ca.crt` — **trusting ONE NAMED CA,
never `--ignore-certificate-errors`**, which would be the disabling this
environment forbids. The executable is `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(the bare `chromium` symlink's `chrome-linux/chrome` does not exist).

**WHAT THIS DOES NOT CLOSE.** `repairs` still exists, is still `read:"none",
write:"none"`, and still has no way of gaining a row — the backlog entry stands
exactly as written. What changed is that nothing reads it any more, so the
site's own page is correct while the underlying design defect is not fixed.
`search_path` is untouched and stays recorded on its own: the corrected function
is still `SECURITY DEFINER` with no `SET search_path`, which the repair
PRESERVED rather than changed, and whether that is exploitable here is still
unmeasured in both directions.

### THE BASELINE FOR THE ADDON TEST, TAKEN BEFORE THE SPEND (2026-09-15 19:16:49Z)

Owner: *"prove the fixed addon can automatically build a working feature using an
existing site's database"* — one live request on `repairbench-1`, and
***"Record the initial outcome before making any manual correction. A manually
repaired result must not count as automatic addon success."*** **This entry is
written and pushed BEFORE the press**, because a baseline recorded afterwards is
not a baseline.

| condition | reading |
|---|---|
| the page name is free | `GET /booking-check` **404** (control: `/status` **200**, so the site is up and the 404 is an answer) |
| the function name is free | `POST …/rpc/count_existing_bookings` **404**, `PGRST202 Could not find the function public.count_existing_bookings` |
| **`bookings` EXISTS** | `GET …/data/bookings?select=id` **403**, `42501 permission denied for table bookings` |
| **the count is 3** | `POST …/rpc/count_booked_repairs` **200**, answering `3` |

**THE REFUSAL IS THE EXISTENCE PROOF, and that is the interesting one.** A table
Postgres does not have answers `42P01 relation does not exist` (PGRST205); this
answers `42501 permission denied`, which only a table that IS there can produce.
`bookings` is `collect` — anyone writes, nobody reads — so a client SELECT is
refused by design, and the refusal's own code is what establishes the table.

**THE COUNT IS INDEPENDENT OF THE THING UNDER TEST, AND ITS LIMIT IS STATED.**
`count_booked_repairs` is a DIFFERENT function from the one this run will design,
so it cannot be its own witness — but it is not a raw row read either, because
this session has no Neon credential. The raw `SELECT COUNT(*) FROM bookings` leg
was read at **17:52:40Z** by the count-fix verify run and answered **3**; the RPC
answers **3** again ninety minutes later. Two readings, one of them a real row
count, agreeing.

**WHICH CODE WILL ANSWER, both halves, checked not assumed.** Worker: deploy
**`87b4057e`** (run 2123, 17:51Z), and `git diff 9a4ac614..origin/main --
worker.js builder/ Dockerfile .dockerignore site-schema.mjs site-apis.mjs` is
**EMPTY** — so the addon path is byte for byte the code deploy 2120 shipped.
Container: `origin/main` hashes to **`6246eb17cd6595c4`** (182 inputs), which is
the id deploy 2120 rolled to and nothing has moved it since.

**EXACTLY ONE PAID POST, MEASURED RATHER THAN HOPED.** The harness's second paid
call (`POST /api/site/<slug>/edit`, the photo hop) is gated on `c.hop`, and
`askCase` — the case a free-text `ask` builds — sets no `hop` field, so that
branch is unreachable on this run. The only other loop is a bounded re-READ of
the site's build id. **There are no automatic paid retries.**

**AND THE `budget` INPUT CANNOT MAKE A HARD CAP — said plainly because the owner
asked for one.** `if (spent > BUDGET) break` is checked BEFORE each case, and an
`ask` collapses the case list to exactly one (`casesFor` answers `[askCase(said)]`),
so at the only check `spent` is 0 and the gate never fires. More fundamentally
the credits are spent INSIDE the single addon request, and nothing outside that
request can stop it mid-flight — **no harness setting can bound one addon run.**
What does bound it: the ledger refuses a bill above the balance (**161**), the
ask forbids a new table, and the measured precedent is run 47's **13** for the
larger `table · function · page` shape against **31** for the most expensive run
ever seen on this account. The field is set to 40 anyway: it costs nothing and is
correct the day the harness runs more than one case.

### RUN 48: THE FEATURE WORKED AND THE REPORT CONTRADICTED IT (2026-09-15)

Owner: *"Keep run 48 recorded as automatic functional success with a
customer-reporting failure."* **Both halves are true and they are about
different things**, which is the whole finding.

**WHAT RUN 48 BUILT, AUTOMATICALLY, FROM ONE SENTENCE**: a page at
`/booking-check` and a function `count_existing_bookings` reading the site's
EXISTING `bookings` table. The page is live, the function answers **3** through
the site's own public RPC, and a real Chromium reads **3** on the page. No new
table. That is the thing being proven and it is proven.

**WHAT IT TOLD THE CUSTOMER**: *"Still to do: A new function named
count_existing_bookings"* — about a function created in that same change, live
and answering within the minute.

**THE CAUSE IS FOUR LINES AND IT IS A CONFLATION, NOT A BUG IN THE EVIDENCE.**
The `page` step handed *"a new function named count_existing_bookings"* BACK to
the `function` step, which runs before it in `ADD_KINDS` order and so could not
have heard it. That hand-off really was undelivered — and `requirementOutcomes`
asked only that one question, so an undelivered hand-off fell straight to
`failed` and `failed` is what "Still to do" is composed from.

**THE FIX IS TWO QUESTIONS WHERE THERE WAS ONE**, and the owner's own wording is
the design: *"A requirement sent backward to an earlier step is an unresolved
handoff; that alone does not establish that its implementation is missing."*

- **`handoff` IS ITS OWN FIELD AND IS DECIDED FIRST**, kept whatever else
  happens: `delivered` | `undelivered`, with a `handoffs` ledger on the record.
  The bookkeeping defect is still reported; what it stopped doing is standing in
  for the work.
- **`implementationOf` IS THE SECOND QUESTION, AND IT MATCHES ON EXPLICIT
  REFERENCES** (owner: *"kind and item name — not another keyword heuristic"*).
  Every `appliedFacts` entry now carries a **`kind`**; `REQUIREMENT_ITEM` gained
  an optional **`item`** for `elsewhere` only, with *"LEAVE IT OUT rather than
  inventing one"* in its own description. A claim about a `function` can only be
  answered by an applied `function`, by name.
- **AND IT IS ASYMMETRIC ON PURPOSE.** Finding an item proves existence; NOT
  finding one proves absence only where this layer can see that kind at all.
  `APPLIED_KINDS` is `table · function · api · job · page`; `component` is
  deliberately off it, because an addition folded into an existing page leaves no
  item in any list, so a working section and an absent one look identical.
  A kind off the list answers `unknown` → `unverified`, never `missing`.
  **A populated kind with NO `item` also answers `unknown`** — only the EMPTY
  direction is sound there, or any function would satisfy any request for one.

**SIX STATES, AND EACH PAIR EXISTS BECAUSE THE TWO NEED DIFFERENT SENTENCES:**

| state | when | what the customer hears |
|---|---|---|
| `delivered` | a `checked` behaviour ties the claim to the work | nothing |
| `configured` | a real SETTING read back off what was applied matches | "I can't confirm…" |
| `unverified` | it is there, or nothing here can see whether it is | "I can't confirm…" |
| `missing` | this layer looked and the work is not there | "Still to do: …" |
| `blocked` | the step this need depends on ran and FAILED | "waiting on another part of the same change that didn't work" |
| `failed` | we said we could not, or the claiming step failed | "Still to do: …" |

**`checked` IS STILL EMPTY** and the guard drives all five applied kinds to
assert it: nothing on this path exercises a behaviour, so `configured` is as far
as a claim about a real setting can get.

**`reportable` IS WHAT MAKES `missing` SAFE, and its first clause does most of
the work**: a kind this change never RAN is reportable — it made none,
definitionally. A kind that ran is reportable only once its results exist
(`aApplied` after the backend apply, `aShipped` after the publish), because
before then "nothing was applied" and "nothing has been applied YET" are the
same empty list.

**TWO WIRING DEFECTS THE SWEEP FOUND, both in this change's own plumbing.**
(1) The record's last re-write sat inside `if (aMissing.length)`, so on the
ORDINARY path — every page shipped — the stored coverage was composed while
`aShipped` was still null and said no page was applied. The REPLY was right and
the RECORD was not, which is the worse way round. It is unconditional now.
(2) **`aShipped` was FILE names and a requirement names a ROUTE.** It is the
requested routes LESS `aMissing` now — derived from the one reader that already
knows both, so the two lists are complements by construction and a page that did
not survive can never count as the work being there.

**AND THE EVIDENCE GAPS THE RUN LEFT, closed or narrowed by measurement:**

- **GAP A — the designer's input was NOT recorded, and the instrumentation now
  exists.** `saveAddonAnswer` stored ONE `site` value written after the whole
  kinds loop, so for run 48 — whose `function` step ran first — the stored facts
  had already been rebuilt over that step's own answer. **Schema receipt for run
  48 is UNVERIFIED and is recorded as such.** `shownSchema(site)` is the fix:
  `shownSteps` on the developer record, one entry per kind in run order, taken
  **from the object really handed to the call and ABOVE the await** — a digest
  taken after it records the OUTPUT wearing the input's name, which the sweep
  drives. Schema only (tables, their columns, the other three tiers by name,
  `hasDatabase`), never the composed prompt: that carries the customer's words
  and the kit menu, and the question being settled is narrow.
- **GAP B — NARROWED, and the authoritative reading is one free press away.**
  The no-new-table claim rests on per-NAME PostgREST probes, which are exact per
  name (`42501 permission denied` proves a table exists; `PGRST205` proves the
  schema cache has no such relation) and are **not a catalog enumeration**. The
  proxy does not forward PostgREST's root, so no OpenAPI listing is reachable.
  **The BEFORE is authoritative and already recorded**: `backend repair
  --verify --slug repairbench-1` (run 35000218315, 17:16:39Z, before run 48)
  read *"every live table declared — 2 table(s), all declared"*, and `st.tables`
  is `information_schema` BASE TABLEs in `public` less the internal names. **The
  AFTER is the same command**, writes nothing, costs nothing, and is the owner's
  press. Until then the claim is *"no table of any name we probed was created"*,
  not *"no table was created"*.
- **GAP C — CLOSED, browser-only, nothing touched.** `/booking-check`'s loading
  and error states, with the RPC intercepted inside Chromium: **loading** — the
  call held open 12 s, `spinner: 1` in the DOM against `0` in the control, and
  the number absent; **error (transport)** — *"That didn't load / Failed to
  fetch / Try again"*; **error (HTTP 500)** — the same shell carrying the
  SERVER'S own message (`boom`), not a canned string. **Measured: the page
  retries 3 times** before showing the error, which is TanStack Query's default
  and is real behaviour worth knowing. The control run, untouched, reads `3`.
  **Deliberately separate runs from the successful live request**, and the
  control is what proves the interception is doing the work.

**Guards**: `test/addon-route.test.mjs` **44 → 55**, every case driven through
`POST /api/site/<slug>/addon` and asserted on the customer's own sentence — run
48's late hand-off with its function applied, the same with the function NAMED
by `item`, with nothing applied, with creation REFUSED, the forward control, a
kind this layer cannot see, a page that did not survive, a coverage composed
before the publish, and the two input-digest cases with the output-order wall.
`test/requirement-coverage.test.mjs` and `test/addon-steps.test.mjs` re-anchored.

**Sweep: 28 mutants, 28 killed, 0 survived, 0 never applied, 2 comment-only
controls survived.** Pass 1 killed 20 of 25 and **all five survivors were gaps
in the new guards, not the product's**; pass 2 killed 25 of 28 with three more,
**two of which were real product defects the guards had not reached** (the
conditional record write, and `aShipped` carrying files where a requirement
names a route). **Nine older guards were re-anchored, not appeased**, each
naming the property that moved — the six-state list, the mark's counters (now
asserted as *a filter over the outcomes naming the states it claims to count*
rather than by one predicate's spelling), the `configured`/`configuredBy`
rename, and two expectations that MOVED rather than broke: an undelivered
hand-off to a populated kind now reads "can't confirm" instead of "still to do",
and a step that was told and failed is `blocked` instead of `missing`.
**Suite 6,487.**

**NOT DEPLOYED AND NOT MERGED** — the owner's instruction for this round. Run 48
stands exactly as it ran; nothing was repaired by hand and no paid call was made.

### …AND THREE REPORTING CASES THE SEPARATION LEFT OPEN (2026-09-15)

Owner, on the hand-off/implementation split: *"Scope failures to the referenced
item and its actual dependencies… Distinguish 'not added by this change' from
'absent from the site'… Separate unknown implementation from existing-but-
unverified behavior in the customer wording. 'I've set that up' is inappropriate
when implementation is unknown."* Plus: ***"Demonstrate all three through the
addon route, asserting the stored outcomes and customer sentence. Include a
mixed-success function step, reuse of an existing function without creating it
again, and an unobservable component."***

**1. A FAILURE WAS SCOPED TO A KIND, NOT TO A THING.** `aFailedKinds` is per-KIND,
so ONE refused function marked the whole `function` step failed and every
requirement handed to it read `blocked` — including one naming a function
Postgres created without complaint. `failedItems` is `[{kind, name}]`, built in
the route from `aFnErrors` + `aJobErrors` + `aMissing`, and a requirement that
NAMES its dependency is judged on that dependency. **Both halves are asserted,
because a fix that simply stopped blocking would lose the real dependency
failure**: the kind-wide rule survives with `!depThere` as its scope — the step
had A failure, and if the thing THIS requirement names is nonetheless there,
that failure was somebody else's. A requirement that names nothing still blocks,
because a failed step is the only evidence available about it.
**THE ORDER IS FAIL-CLOSED AND SAID SO IN THE CODE**: `depBroke` is asked before
`depThere`, so a thing KNOWN to have failed is blocked before anything excuses
it. The two are disjoint today (only CREATED items reach `made`) and the order
is what keeps that an observation rather than a dependency.

**2. "NOT ADDED BY THIS CHANGE" IS NOT "ABSENT FROM THE SITE".** A change that
deliberately REUSES a function leaves nothing in `made`, and reading that silence
as "still to do" is run 48's defect wearing a different hat. `existingFacts`
(`builder/site-add.mjs`) is the second presence source — the stored spec's four
tiers, the site's own routes, and the look's `qr` and `three`, which are the two
kinds a site carries by NAME rather than in its schema. `implementationOf` asks
`made` first and `existing` second, and the record carries **`foundIn`**
(`applied` | `existing`), because *this change made it* and *the site already had
it* are the distinction this item is about and a record collapsing them cannot be
audited later.

**THE EVIDENCE IS TRUSTWORTHY BY CONSTRUCTION, and that is why it may be
believed.** `aSpec` reaches this code only through `specForAddon`, which recovers
a table the catalog has and the spec does not or STOPS; a `none` site is
`{tables: []}` against its own measured state. `aSrc` is the stored page source.
Neither is a guess.

**ABSENCE NEEDS EVERY READER THAT COULD SPEAK TO HAVE SPOKEN — and that is NOT a
blanket demand for two readers.** The first cut demanded both everywhere and lost
a real finding, which is how the partition was found. `COVERAGE_STEPS` splits
into three, **total and disjoint**, censused both ways:

| group | kinds | absence |
|---|---|---|
| `SITE_KINDS` | `table · function · api · job · page · qr · three` | only when the site's inventory was really READ (`canExisting`); unread, nobody looked → `unknown` |
| `OPAQUE_KINDS` | `component · photo` | **never** — an addition folded into an existing page leaves no item in any list, so a working section and an absent one look identical |
| neither | `edit` | names no site artifact, so the applied evidence is the whole answer |

**`OPAQUE_KINDS` IS LOAD-BEARING AND A SWEEP PROVED IT.** `aReportable` answers
TRUE for a kind this change never RAN — it made none, definitionally — so for
`component` every other wall is open and this one is the whole of what stops a
change reporting a section as still to do. **The first reading called it
redundant with `APPLIED_KINDS` and that was wrong**, and the mutant that
survived is what said so.

**3. UNKNOWN IS ITS OWN STATE AND ITS OWN SENTENCE.** `unverified`'s clause opens
*"I've set that up, but I can't confirm…"*, which is a claim nobody is entitled
to make about an implementation nobody could find. **Seven states now**
(`delivered · configured · unverified · unknown · missing · blocked · failed`)
and `unknown` gets: *"I can't see from here whether … — nothing I can check says
either way, so have a look, and ask me for it again if it isn't there."* It is an
invitation to ask again rather than a correction, because there may be nothing to
correct. Its own number on the record (`unknown`) and on the trace mark
(`unseen`) — **beside `unsure`, never in it**: a run of these built nothing
anybody can point at, and summed together the two read as a productive run
nobody checked.

**`checked` STAYS EMPTY**, and the guard drives all five applied kinds to assert
it: nothing on this path exercises a behaviour, so `configured` is as far as a
claim about a real setting can get. Existence and behaviour stay separate.

**THE TEMPORAL DEAD ZONE BIT A THIRD TIME IN THIS ROUTE, and was caught by
reading.** `aFailedItems()` is read from inside `aCoverage()`, whose first
possible call is a refusal in the kinds loop — four hundred lines ABOVE where
`aJobErrors` was declared. It is hoisted onto the accumulator line with the
reason recorded in both places. *Declare what a closure reads above its first
possible call, not above its obvious one.*

**Guards**: `test/addon-route.test.mjs` **55 → 59**, each of the three demonstrated
through `POST /api/site/<slug>/addon` and asserted on the customer's own
sentence — a mixed-success function step (one created, one refused, asserted as
the precondition) where only the requirement naming the refused one is blocked
and the sentence names `count_bad`; a reuse case with its CONTROL, the same
change and the same requirement on a site that does NOT declare the function,
where "still to do" is the true answer and must still be said; and a stocked
site where an unnamed requirement, an existing QR code and an unobservable
component give three different answers in one reply.
`test/requirement-coverage.test.mjs` gained the three-group census and the
`unseen` counter.

**Sweep: 28 mutants, 28 killed, 0 survived, 1 never applied on pass 1 and 0 on
pass 2, 2 comment-only controls survived.** Pass 1 killed 20 of 28 with seven
survivors and one ambiguous anchor; **every survivor was a guard gap and one of
them was a PRODUCT property nobody had reached** — `OPAQUE_KINDS` above. The
others: a missing page named on the blocked `why` rather than only in the state,
the customer's SENTENCE told which items failed (it recomputes the outcomes from
its own arguments, so the record can be right while the sentence is generic), an
unnamed requirement on a stocked site, the look as an inventory, and the trace
mark's two. The ambiguous anchor was `pages: (aSrc || [])…`, which occurs twice
in the route.

**EIGHT older guards were re-anchored, not appeased** (five in
`requirement-coverage`, three in `addon-route`), each naming the property that
moved — **and the number was CORRECTED from five before it was pushed**, by
counting the cases that gained a note in this commit's own diff rather than by
recalling how many I had touched. The mark's key census and its predicate loop
gained `unseen`; the mark's outcome call gained `failedItems` and `existing`;
the six-state list became seven; and several expectations MOVED rather than
broke — an `elsewhere` hand-off with nothing applied and no `item` reads
`unknown` where it read `missing`, and its clause is the can't-see one rather
than "still to do".

**Suite 6,491.**

**NOT MERGED AND NOT DEPLOYED** — the owner's instruction for this round, as for
the last. No paid call was made and no demo site was touched. **The `search_path`
review stays queued.**

### …AND THE SAME EVIDENCE RULES FOR `covered` (2026-09-15)

Owner: *"The earlier handoff cases now work. Apply the same evidence rules to
covered requirements too … Do not let the model's covered label substitute for
implementation evidence. Support explicit item references for covered
requirements, preserve them through cleaning, and reconcile both covered and
elsewhere against the same item-level results and existing-site evidence. Keep
handoff tracking separate."*

**`covered` NEVER REACHED THE IMPLEMENTATION READER AT ALL.** `implementationOf`
refused any status but `elsewhere`, so a `covered` entry fell through to the
initial `state = "unverified"` and its customer clause — *"I've set that up, but
I can't confirm…"* — was composed off the LABEL. Two consequences, both the
owner's own:

1. **A claim whose own function applied still read `failed`** when an unrelated
   function in the same step did not. The kind-wide rule (`the owning step is in
   failed`) had the `!depThere` scope added for `elsewhere` last round and a
   separate, unscoped `covered` branch beside it. There is ONE branch now, and
   the two statuses part company only on which SENTENCE it earns: a hand-off is
   `blocked` (waiting on another part), a claim the failed step MADE goes down
   with the step that made it (`failed`).
2. **A `covered` label with nothing behind it claimed the work was set up.** It
   is `unknown` now — the same state, and the same sentence, an `elsewhere`
   hand-off with nothing behind it already got.

**THE HAYSTACK IS THE ONE DIFFERENCE BETWEEN THE TWO, and it is the whole of
what is status-specific.** Same equality, same two sources (`made` and the site's
own inventory), same three-group visibility rule. `elsewhere` NAMES a step, so
its `item` is a request TO that step and a thing of another kind is not what was
asked for. `covered` names no step — `from` is OUR bookkeeping of which call
answered, never a claim about where the thing lives — so its `item` is a claim
that THE THING EXISTS and is looked for across every kind, in `made` and in the
site's contents alike. **The no-item branch stays kind-scoped for both**: with no
name the question is "did the responsible step produce anything at all", which is
about one step's output whichever status asked it. `depBroke` follows the same
split — `brokenAny` (bare names) for a claim, the kinded index for a hand-off —
and the looser match can only ever move a requirement to `blocked`, whose
sentence invites a look at the other part.

**`cleanRequirements` KEEPS `item` FOR BOTH**, and the tool says so: the
description was *"For \"elsewhere\" only"*, which is the wiring trap in prose —
the reconciliation would have been perfect and unreachable, and from outside "the
model did not name it" and "we told it not to" are the same missing field. **An
`item` is deleted when the status IS or BECOMES `unsupported`**, because the
reference then names nothing this change will ever run.

**A CONTRADICTION IS ITS OWN KIND, NOT A `null`** — and this is the correction
the round's own first cut needed. `claimEvidence` answered nothing both for "a
`fails` token matched" and for "there was nothing to check against"; once
`covered` started reading its implementation, those fell to opposite states and
`unknown`'s sentence — *"nothing I can check says either way"* — is FALSE of a
contradiction, where something can be checked and it says the opposite. It
answers `contradicted`, which reads `unverified` (the item was named and really
applied, so the implementation is established and only the guarantee is denied)
and records `contradictedBy` for the developer. **The customer hears the same
sentence either way, deliberately**: nothing here is entitled to call a claim
wrong, which is the never-move-towards-`failed` rule this file already carries.
A BARE NAME is kept as `named` for the same reason and is KEPT rather than
returned, so a later item carrying a real guarantee still wins.

**HAND-OFF TRACKING STAYS SEPARATE**, in as many words: `handoff` is set only for
`elsewhere`, the ledger counts only those, and a `covered` claim carries no
hand-off verdict — it asked nobody for anything.

**AND THE ROUTE HAD ONE WRITER OF `aFailedKinds` WITH NOTHING ON THE ITEM LIST.**
A function the database REFUSES is named in `functionErrors`; a function the
ENGINE will not build is dropped WHOLE — no field to point at, no statement
issued, nothing in `functionErrors` — and the kind was failing wholesale off it,
so a claim naming the dropped thing and a claim naming the one that applied got
the same verdict. `aUnbuilt`'s entries join `aFailedItems()` (declared at the
accumulator, well above the closure's first possible call — this route's own
thrice-recorded temporal-dead-zone trap).

**Guards**: `test/addon-route.test.mjs` **59 → 62** — the two cases the owner
named, each driven through `POST /api/site/<slug>/addon` and asserted on the
stored outcomes AND the customer's own sentence (a `covered` claim in a
mixed-success function step, where the claim whose function applied is
`unverified`, the one whose function was refused is `blocked` NAMING `count_bad`,
and a claim resting on nothing still `failed` — three sentences from one step;
and a `covered` claim about a section nobody can see, `unknown`, with the control
that the SAME step's claim naming an applied function moves to `unverified`),
plus the engine-dropped item. **Both new cases were proved RED against the
pre-change module** (`git show 82e3c885:builder/site-requirements.mjs` swapped
in) before being believed. `requirement-coverage` and `addon-steps` gained
assertions inside existing cases and no new case — the cross-kind haystack
asserted BOTH WAYS ROUND (one direction alone passes with the haystack widened
for everything), the `covered` `missing` naming its own thing, `brokenAny` with
its kinded control, the kept-not-returned bare name, the tool's own description,
and the `unsupported` item drop.

**Four older guards were re-anchored, not appeased** — counted from this commit's
own diff rather than recalled — each naming the property that moved:
`appliedFacts`' two `claimEvidence` answers (asserted on what each BUYS rather
than on the shape of the refusal), `requirementNote`'s bare covered claim (now
the can't-SEE clause, with *"I've set that up"* asserted ABSENT), the six-state
fixture's second entry and its `claimEvidence` block, and the developer record's
counts — where **both entries are now the same state and that IS the property**:
two different statuses with the same nothing behind them get the same honest
answer, with a CONTROL beside it so `unknown` cannot become a new default.

**Sweep: 27 mutants, 27 killed, 0 survived, 0 never applied, 2 comment-only
controls survived.** Pass 1 killed 24 with three survivors, and **all three were
guard gaps, not the product's** — the SITE half of the widened search (a claim
resting on something the site already had, across kinds), the tool's description
(the prose half of the wiring trap, which no behaviour test can see), and the
route's engine-dropped items, which needed a case where the engine drops a
function whole (`returns: "setof nowhere"`) rather than the database refusing it.
**Every anchor was checked to occur exactly once before each run.**

**Suite 6,494. CI has read it: `unit tests` run 2597 on `23f6ae22`, green —
`# tests 6494 / # pass 6491 / # fail 0 / # skipped 3`.**

**AND ONE READING OF MY OWN WAS WRONG BEFORE `date` CORRECTED IT.** Watching
that run, the API answered `in_progress` for a step whose band is ~100 s and
the run's `updated_at` sat BEHIND its own steps — which is this file's recorded
tell for a stale snapshot, and I read it as one. It was not: **`date -u` said
23:27, ninety seconds after the push.** The background `sleep`s I had started
were never awaited — I read each one's empty output file and polled GitHub
immediately, so no time had passed at all. **The trap entry's own last line is
the fix and it works**: `date` is the cheap check before calling anything hung,
and it is equally the check before calling an instrument stale. A wait is only a
wait when something blocks on it.

**NOT MERGED AND NOT DEPLOYED** — the owner's instruction for this round, as for
the last two. No paid call was made and no demo site was touched. **The
`search_path` review stays queued.**

### …AND A REFERENCE IS `{kind, name}`, BECAUSE A NAME COLLIDES (2026-09-16)

Owner, on the round above: *"covered references now lose their kind.
`implementationOf` searches all kinds by name, and `brokenAny` similarly ignores
kind."* Two failures, reproduced at the module before anything was touched, both
on the name every real site uses for both things:

| reproduced | what the reader said |
|---|---|
| applied TABLE `bookings`, no function `bookings` | a `covered` claim about the FUNCTION → `implementation: found` and *"I've set that up"* |
| applied TABLE `bookings`, FAILED function `bookings` | a `covered` claim about the TABLE → `blocked` |

**ONE IDENTITY, `{kind, name}`, FOR ALL THREE LOOKUPS** — applied, existing and
failed. `referenceOf(r)` is the single producer and `broken` is keyed the way it
answers (`kind + "::" + name`), so the index and the lookup cannot drift apart.
`brokenAny` and the cross-kind `anyKind` search are gone.

**WHERE THE KIND COMES FROM IS THE ONLY PER-STATUS PART, and it is not a
symmetry that could have been collapsed.** An `elsewhere` reference is a request
TO a named step, so the STEP is the kind — a request to the function step is a
request for a function, and a second field beside it would be a two-field
invariant that can disagree with itself. A `covered` reference has no such
field: **`from` is which CALL answered, never a claim about where the thing
lives**, and the tool deliberately invites a table step to name the function that
does the work. So the kind is DECLARED, which is the owner's own instruction —
*"Allow covered requirements to name a different implementation kind explicitly;
the authoring step alone cannot identify it."*

- **`ITEM_KINDS` IS DERIVED** (`COVERAGE_STEPS` less `edit`) and censused both
  ways against the tool's own enum. `edit` is out BY MEANING — it names no
  artifact a site holds, so `{kind: "edit", item: "x"}` could never be looked up
  in anything. `component` and `photo` are deliberately IN although they always
  answer `unknown`: the designer can say what it made and this layer says it
  cannot see one, where refusing the kind leaves them naming nothing.
- **THE KIND IS PRESERVED THROUGH CLEANING for `covered` and dropped for
  everything else**, and a kind outside `ITEM_KINDS` is DROPPED rather than
  repaired to a plausible one — a wrong kind is a lookup in the wrong list, and
  `unknown` is a sentence the customer can act on.
- **AMBIGUOUS OUTRANKS EVERY WEAKER READING, and that is the whole reason the
  branch exists.** With nothing in `by` the fall-through lands on `unknown`
  anyway; it changes an answer only when `by` NAMES an applied item — and
  `claimEvidence` matches on PROSE across every kind, which is the same
  collision one layer over. So a reference with no kind reads `unknown` with
  `unresolved: "no-kind"` on the record, never rescued by evidence about a thing
  the designer may not have meant. It is asked AFTER the two failure branches,
  so a known dependency failure and a failed owning step still win.
- **"COULD WE HAVE SEEN ONE" IS ASKED OF THE REFERENCE'S KIND, NEVER THE
  STEP'S.** The two agree on a claim about the step's own work and part company
  on exactly the claim the declared kind exists for — the `page` step resting on
  a FUNCTION. Reading the step's kind there would turn "nobody enumerated
  functions" into "still to do" on the strength of having read the pages.
- **A ROUTE-SIDE FAILURE CARRIES ITS OWN KIND**: the function errors, the job
  errors, the missing pages and the engine-dropped items each name theirs, so
  the second collision cannot come back from the producing end either.

**THE ONE INERT LINE IS DECLARED RATHER THAN DELETED, and it was MEASURED
inert, not reasoned about.** `if (e.status !== "covered") delete e.kind;` is a
belt: `e` is built fresh and `e.kind` is assigned inside the `covered` branch and
nowhere else, and the one status rewrite in `cleanRequirements` is on the
`elsewhere` branch, which a `covered` entry never takes. **720 probes — every
status including junk and wrong-case, every kind including junk, empty and
`undefined`, every step including junk and `undefined` — byte-identical with the
line and without it.** It stays because the PAIR is "the assignment sits inside
the covered branch" and "a non-covered entry cannot keep a kind", and hoisting
the assignment out is a one-line refactor that reads as tidying; the spec mutates
**the two together**, which is the only way a redundancy can be sweep-tested at
all, and the code says so because a sweep cannot.

**Guards**: `test/addon-route.test.mjs` **62 → 64** — the owner's two collisions
driven through `POST /api/site/<slug>/addon` and asserted on the stored coverage
AND the customer's own sentence, both on a site whose stored schema declares
neither name (`STORED_SCHEMA` already has `bookings`, which would have made the
addition an EXTENSION and the case about something else). The three `covered`
cases from the round above were re-anchored onto explicit kinds and kept, which
is the owner's *"Retain the successful mixed-function and unknown-component
cases."* `test/requirement-coverage.test.mjs` stays **22** and gained
assertions inside existing cases: the `ITEM_KINDS` census both ways plus the
tool's enum, `referenceOf` driven directly for both kind sources and both halves
of its `null`, ambiguity outranking a prose match WITH its control, a junk kind
dropped, a stray kind on a hand-off, and the visibility question asked of the
reference's kind with the control that makes it about the haystack.

**Five older guards were re-anchored, not appeased** — counted from this
commit's own diff rather than recalled: three route fixtures that gained an
explicit kind (`OK`/`BAD`, `GONE`/`KEPT`, `SECTION`/`BACKED`), case 15's
haystack block rewritten onto the kinded identity, and case 17's `kind: "table"`
control with its `vague` counterpart.

**Sweep: 25 mutants, 25 killed, 0 survived, 0 never applied, 2 comment-only
controls survived.** Pass 1 killed 21 of 25 and **all four survivors were
guard gaps, not the product's** — a junk kind kept, a stray kind on a hand-off,
the visibility question asked of the wrong kind, and the ambiguity branch, whose
only observable case needs `by` to name an applied item. One of the four was
then measured INERT (above) and REPLACED with the pair mutant rather than
hunted. **Every anchor was checked to occur exactly once before each run.**

**Suite 6,496** — 6,494 + `addon-route`'s two collision cases, and the
arithmetic closes exactly: everything in `requirement-coverage` is an assertion
inside a case that already existed. **CI has read it: `unit tests` run 2599 on
`e032afad`, green — `# tests 6496 / # pass 6493 / # fail 0 / # skipped 3`.**

**NOT MERGED AND NOT DEPLOYED** — the owner's instruction for this round, as for
the last three: *"Keep this correction bounded. No merge, deployment, paid
rerun, or demo-site cleanup yet."* No paid call was made and no demo site was
touched. **The `search_path` review stays queued.**

### …AND THE EVIDENCE LOOKUP HAD THE SAME BYPASS UNDER IT (2026-09-16)

Owner, on the round above: *"The original two collisions are fixed. One bypass
remains: `claimEvidence(r.by, made)` still searches every applied kind …
Evidence from another item must not turn an unknown implementation into
configured, unverified, or delivered. Missing or ambiguous references must not
regain certainty through an unrestricted prose match."*

**THE IDENTITY REACHED `implementationOf` AND STOPPED THERE.** Underneath it
sits an older, kind-blind reader — `claimEvidence` matches the applied items'
names inside the sentence the model wrote — and it was handed `made` WHOLE. So
whenever the exact question had no answer, the loose one supplied one.
Reproduced at the module before anything was touched:

| applied | the reference | what it said |
|---|---|---|
| TABLE `bookings` | `{kind: "component", item: "bookings"}` | `implementation: unknown`, state `unverified`, *"I've set that up"* |
| TABLE `bookings` | `{kind: "table", item: "bookings"}` + prose naming an applied FUNCTION | `configuredBy` read off the FUNCTION |

The second is the quieter face and it puts a wrong FACT on the record rather
than a wrong state: the reference resolves perfectly and the *"here is the
setting I checked"* note comes off a different item the sentence mentions in
passing.

**`evidenceItems(made, impl)` IS THE ONE SCOPE, DERIVED FROM `impl` RATHER THAN
RE-RESOLVED**, so the two readers cannot come apart. Three answers, each a
different claim about what may count as proof:

| `impl.by` | haystack |
|---|---|
| `item` | that `{kind, name}` and nothing else. A miss is EMPTY, which is right for `absent` (not there) and for `unknown` (nobody could look) alike |
| `kind` | the responsible STEP's own output — which is the question `implementationOf`'s no-name branch already asks in as many words. One haystack, two readers |
| no kind | nothing. Ambiguous, or not reconciled at all |

- **THE `kind` TEST IS WHAT MAKES THE LAST CASE SAFE.** An ambiguous reference
  carries `kind: ""`, and filtering for that matches every applied item whose
  OWN kind is missing rather than none of them — the empty-needle shape, in the
  branch whose whole job is to answer nothing.
- **AN ITEM REFERENCE IS NEVER NARROWED BY `from`.** That is which CALL
  answered, never a claim about where the thing lives; it is the no-reference
  haystack's scope only because there the question really is about a step's
  output.
- **THE LINE FOR A REFERENCE-LESS CLAIM WAS MEASURED, NOT ARGUED.** The
  stricter reading — no prose match at all — was driven: **9 guards red against
  4, and the five extra are real findings lost**, three of them the owner's own
  earlier demonstrations (public versus internal functions, the stored
  connection, configuration-is-not-behaviour). A claim resting on a guarantee
  its own step's applied item really carries would read *"nothing I can check
  says either way"*, which is FALSE when something can be checked and it holds.

**THE `unresolved` BRANCH IS NOW A DECLARED REDUNDANCY, MEASURED INERT:
27,216 probes over every status, kind, item, `from`, claim, failed kind and
failed item — byte-identical with it and with it cut.** Kept because the two say
different things: the branch is the ORDER (ambiguity outranks every weaker
reading, and is asked AFTER the two failure branches), the haystack is the
SCOPE. Widen the scope by one line — an ambiguous reference falling back to the
step's kind is the plausible version — and it is the only wall again. The sweep
mutates the PAIR.

**FOUR GUARD FIXTURES HAD DRIFTED FROM THEIR PRODUCER, AND THAT IS WHAT THE
FIRST RUN REPORTED.** Each was a hand-typed applied item with **no `kind`** (one
also called `cleanRequirements` with no `from`) — free while the search was
kind-blind, and impossible in the product: `appliedFacts` stamps a kind on every
item and the route always hands the kind that answered. They read as the scoping
being broken. Re-anchored onto the producer's shape, and `addon-steps`' `checked`
fixture is now DERIVED from `appliedFacts` outright — the recorded "derive a
fixture from its real producer", in the one fixture that drove the `delivered`
door.

**Guards**: `test/addon-route.test.mjs` **64 → 66** — the owner's reproduction
driven through `POST /api/site/<slug>/addon` with its matching-item positive
control IN THE SAME REPLY (same name, same applied table, only the reference's
kind differs), and the `configuredBy` face with its own control; **both proved
RED against the pre-change module** before being believed.
`test/requirement-coverage.test.mjs` stays **22** and gained assertions inside a
case that already existed: the three arms driven directly, both halves of the
item identity, a kindless item in no haystack, the folded name comparison, the
fail-closed unknown `by`, a non-array `made`, the scope driven end to end
through `requirementOutcomes`, and a hand-off's prose ignored.
**THE FUNCTION-INVENTORY CASE IS AT THE MODULE, DELIBERATELY, AND THE TEST SAYS
WHY**: on the route `aSpec` is always read (`specForAddon` recovers or stops), so
`existingFacts` always speaks for `function` and that state is unreachable there
— saying so beats a route case that fakes it.

**Four older guards were re-anchored, not appeased** — counted from this
commit's own diff: `requirementNote says only what is still outstanding`, `the
six states separate implementation from hand-off`, `ACCEPTANCE: the reproduced
omitted requirement`, and `addon-steps`' `configuration is recorded and never
promoted`.

**Sweep: 14 mutants, 14 killed, 0 survived, 0 never applied, 2 comment-only
controls survived.** Pass 1 killed 9 with five survivors, and **every one was a
gap in the new guards, not the product's** — three of them about shapes the
route cannot produce, which is what a module guard is for: a hand-off reading a
`by` the cleaner drops, an unrecognised `by` falling through to everything, a
non-array `made`, a kindless applied item admitted everywhere, and a name
comparison folded on one side only. **Every anchor was checked to occur exactly
once before each run.**

**Suite 6,498** — 6,496 + `addon-route`'s two, and the arithmetic closes
exactly.

**MERGED AND LIVE — deploy 2124, 2026-09-16 01:47:09→01:50:02Z, green in 2m53s**,
on `main` `989d32a0` → `0dc1d27c`. **NOT a fast-forward to begin with**: main had
moved to another session's agent-builder work and some app chrome, so main was
merged INTO the branch first (no conflicts, in either document), the merged tree
measured, and only then was main fast-forwarded to it.

- **THE IMAGE ID WAS COMPUTED BEFORE THE MERGE AND THE DEPLOY AGREED — the third
  time that technique has been cross-checked against reality.** `origin/main` →
  `6246eb17cd6595c4` (182 inputs), **which is the id the live container was on**;
  the merged tree → `c6980fe3efce66d3` (182 inputs — the same COUNT, different
  content, because `builder/site-requirements.mjs` is in the worker's module
  graph and the image carries it). The step's own line: `IMAGE SiteBuildContainer:
  built isibi-app-sitebuildcontainer:c6980fe3efce66d3 (registry answered 404; 182
  inputs off ./Dockerfile)`.
- **AND THE MERGE COMMIT HASHES IDENTICALLY TO THE BRANCH TIP**, which is the
  exact answer to "is main's own work an image input": it is not. `agent-builder/`
  and `public/` are outside the Dockerfile's COPY set, and the id not moving says
  so more strongly than reading a `paths` list.
- **CONTAINER ROLLED at 01:49:55.6Z**: `EDIT isibi-app-sitebuildcontainer`,
  `6246eb17cd6595c4` → `c6980fe3efce66d3`, `SUCCESS Modified application`,
  `Applied changes` — read out of the log's own diff rather than inferred from the
  step's duration. **So the 15–20 minute hold ran to ~02:05–02:10Z.**
- **WORKER**: `Uploaded isibi-app (3.85 sec)`, `Worker Startup Time: 32 ms`,
  `Total Upload: 3463.86 KiB / gzip: 933.59 KiB`, 99 asset files read.
- **`No updated asset files to upload` — AND THE REASON IS NOT THE USUAL ONE.**
  The merge DOES carry `public/chat.js`, `index.html` and `styles.css` changes;
  they are main's, and deploy 2123 already uploaded them, so 2124 saw them
  unchanged. **The `/chat.js` comparison therefore proves the served bytes are
  main's and CANNOT discriminate 2124 from 2123**: live 603,362 bytes, sha256
  `b5572f382c733be0`, identical to the merged tree. Saying which of the two a
  check can settle is the whole point of running it. The standby is the gate
  discriminator, measured after: `/api/site/build-health` **401**,
  `/api/site/runtime` **401**, `/api/site/job-probe` **401**,
  `/api/nope-not-a-route` **404**.
- **THE PRE-PUSH BASELINE WAS NOT TAKEN THIS ROUND, and that is a process miss
  rather than a judgement.** The recorded practice is a baseline BEFORE the push
  compared after; what stands in is deploy 2121's recorded numbers, which are
  nine hours and two other-session deploys old. Four of six sites are
  byte-identical to it — `ashgrove-1` 31,120 · `northgroup-5` 1,641 ·
  `washhouse-1` 52,404 · `ben-crowe-guitar` 52,060. `repairbench-1` 45,928 →
  **46,151** is explained and expected: run 48 republished it, and its
  `x-site-version` moved to `01789500698949-dggs37` (build `mu32igiu-dao04n`).
- **`fretwork-1` IS 58,285 → 58,404 AND THAT IS UNEXPLAINED FROM HERE.** It is
  **not** per-request variance — five consecutive reads answer 58,404 exactly,
  with `ashgrove-1` stable at 31,120 as the control — and the site has **not**
  republished: `x-site-version 01788755899622-6w90uf`, days old and unmoved. So
  by the standing rule (a Worker deploy changes nothing a visitor sees until a
  site republishes) this deploy is not the cause, and with no pre-push reading
  there is nothing here that can say whether the 119 bytes moved before it or
  across it. **Recorded as an open observation, not as a clean regression pass.**
  **CLOSED 2026-09-16 by deploy 2128**, which did take a pre-push baseline:
  58,404 on both sides, same version. So it moved before 2124 and outside this
  session's window — *not caused by a deploy in this window*, which is what the
  evidence supports and is weaker than an explanation.
- **THE INTERACTIVE HALF, because a 200 is an availability check and never a
  health check**: `/status` **200** and its RPC `count_booked_repairs` **3**;
  `/booking-check` **200** and run 48's `count_existing_bookings` **3**. Both
  features built by the addon path still answer after the roll.
- **The merge started exactly one workflow** — `Deploy to Cloudflare` run 2124
  and nothing else, which is the merge-trigger census holding in the live.

**NO PAID CALL WAS MADE AND NO DEMO SITE WAS TOUCHED** — the owner said
*"Merge"*, which lifts the merge and the deploy it necessarily fires, and nothing
else. **The `search_path` review stays queued.**

### THE `search_path` REVIEW — the premise was wrong, and the fix is one clause (2026-09-16)

Owner: *"Trace every generated SECURITY DEFINER function and its creation path.
Check actual permissions where authorized access exists… Keep missing hardening
separate from demonstrated exploitability… Use real PostgreSQL tests… Return the
findings and concrete proposed change before deployment."*

**NOT MERGED AND NOT DEPLOYED.** The change is written, guarded and proven; the
press is the owner's.

**THE PREMISE THAT KEPT IT OPEN WAS FALSE, AND `neon-e2e` HAD WRITTEN IT DOWN.**
That probe said the escalation "needs BOTH halves … a caller can put a schema of
their own ahead of `public`, and they can create an object in it", and measured
four `CREATE` privileges to say nobody can. **The four checks are true and the
premise is incomplete**: there is a third kind of conflicting object that needs
no `CREATE` anywhere. `TEMP` on the database is granted to **PUBLIC by
Postgres's own default**, and an unlisted `pg_temp` is searched **FIRST** for
relations — so the caller never touches its own `search_path` either.

**MEASURED ON A REAL POSTGRESQL 16** (`test/integration/local-pg-searchpath.mjs`,
**61 checks**, real DDL out of `applySiteSchema` through the `fetch` seam, the
pre-fix side loaded out of git so the negative control is the code that shipped):
a role refused `SELECT` on the table outright (`permission denied for table
bookings`) creates `pg_temp.bookings` and the definer function that counts the
owner's three rows answers **1**. Same for the `plpgsql` form, and **same through
an INVOKER callee** — a SECURITY INVOKER function called from inside a definer
one runs with the DEFINER's rights, so pinning only the definer leaves the hole
one hop along.

**NAMING `pg_temp` IS THE FIX. NAMING `public` IS NOT, AND THE TWO LOOK ALIKE.**
Measured: `SET search_path = pg_catalog, public` with an unqualified body is
redirected **exactly as an unpinned function is**. A pin that does not name
`pg_temp` pins nothing that matters. That is the shape a later edit reaches for,
so the guard asserts the ORDER and the sweep mutates it.

**THE CORRECTION IS ONE CLAUSE, in three places.** `FN_SEARCH_PATH = "public,
pg_temp"` on every model function (definer AND invoker); the same on every
trigger function `pgTrigger` writes (separable — those are the ENGINE's bodies
and are invoker, so nothing is ESCALATED; what is redirected is a GUARANTEE,
and `enforceRefs`' "missing parent" wall is measured passing over a temp
parent); and `pg_catalog, pg_temp` on the three identity helpers. Those three
were `pg_catalog` alone and were SAFE — measured — but **safe only because every
relation in their bodies is schema-qualified**, which is an argument about the
bodies that expires the first time one is edited. One token each makes the rule
uniform: **every function the engine creates ends its path with `pg_temp`**, and
no reader has to check a body.

**14 OF THE 15 FUNCTIONS THE ENGINE CREATES PINNED NOTHING.** Measured by
driving the pre-change engine over a wide spec; the one exception was
`app_team_id`, which has had its pin since it was written. **The platform's own
Supabase side is clean**: 69 functions across the applied migrations, **0**
unpinned definer functions — the one grep hit was the phrase inside a COMMENT,
this repository's own "prose contains the thing it forbids", met in my own scan.

**WHAT IS DEMONSTRATED AND WHAT IS NOT, kept apart because they are different
claims:**

- **DEMONSTRATED — the mechanism**, both directions, on real DDL, with the
  privilege surface asserted byte-identical (every function's ACL, every
  table/column grant, every policy) so a pin that quietly moved a privilege
  would be red.
- **CORRECTED — the upgrade path, which I claimed and got WRONG** (owner:
  *"Arm 9 resends the full original function definitions, so it does not
  demonstrate 'the site's next schema change upgrades existing functions.'"*).
  The first arm 9 stood a site up on the pre-fix DDL and then replayed the
  statements captured from the ORIGINAL spec — **full function bodies and all**
  — and read the resulting pin as an upgrade. A real next change is composed
  from what `_meta.schema` PERSISTED, which is a different thing, and the
  correction is below. **The claim was the probe's fixture, not the product.**
- **REACHABLE IN PRINCIPLE, NOT DEMONSTRATED — an in-product DDL door.**
  `normalizeSchema`'s `execute` ban stops DYNAMIC SQL, and a `plpgsql` body may
  contain a STATIC `CREATE TEMP TABLE`. Measured: such a body is **KEPT**. So a
  site whose model wrote a function that creates a temp table, granted to
  `anonymous`, gives a visitor the door — needing that specific function to
  exist AND a pooled PostgREST session reused across two calls. **The pin closes
  it without a new deny-list**, which is the right answer here: a deny-list is a
  claim about the producer, and this repository has that trap recorded.
- **NOT DEMONSTRATED — any door through Neon's Data API itself.** PostgREST
  exposes tables, views and RPC, and `proxySiteService` forwards only
  `content-type, authorization, accept, prefer, cookie`; there is no raw-SQL
  route anywhere in the tree. **That blocker is a property of a layer we do not
  own and do not test** — the recorded "a rule true because of a layer below it
  expires when that layer moves", which is exactly the shape that has cost this
  repository four times.

**THE CORRECTED SCOPE — which functions a next schema change really re-pins.**
Measured twice, at the module (`test/site-searchpath.test.mjs` case 8, no
database) and on a real server (arm 9), by composing the next change the way an
addon composes one: **from what `_meta.schema` PERSISTED**, not from the spec
the first build was handed.

| family | on a site's next schema change |
|---|---|
| `app_user_id()`, `app_team_id()` | **RE-PINNED** — created unconditionally at the head of every apply |
| every trigger function (`pgTrigger`) | **RE-PINNED** — the merged spec re-declares every table, so each is re-emitted |
| **every model-written function** | **NOT TOUCHED. Not now, not ever, without separate work** |

**AND THAT LAST ROW IS THE HIGH-VALUE HALF**, because the model's functions are
the `SECURITY DEFINER` ones GRANTed to `anonymous`. The mechanism:
`applySiteSchema` persists a function as `{name, args, returns, internal}` with
**no body**, and `normalizeSchema` drops a bodiless function — correctly, since
a body is what makes one. Measured end to end: the next change emitted
`app_user_id`, `app_team_id` and three `trg_bookings_aud_*_fn`, **all pinned**,
and **no `CREATE OR REPLACE` and no `ALTER FUNCTION` naming the model's
function at all** — which arm 9 then confirms by redirecting it again through
`pg_temp`, in the same database, after the change.

**THE ONE PATH THAT DOES REACH IT** is an addon that RE-DECLARES the function
with a body: `CREATE OR REPLACE` carries the pin, the grants survive, the
redirect closes. Driven in both places. **Upgrading the rest is separate work
and is NOT proposed here** — see the backlog entry; no backfill is written and
none is run.

**THE REACH IS LAZY AND PER-SITE, and there is no backfill.** `applySiteSchema`
has three callers and all three are customer-driven; nothing in `scripts/` calls
it, `site_rebuild` republishes without it, and `site-schema-recover.mjs` has no
function reader at all. **No customer database is touched by this review.** And
`_meta.functions` carries no body and no config, so **a stored spec can never
say whether a site's live functions are pinned** — `pg_proc.proconfig` is the
only reader.

**THE PIN TRUSTS `public`, SO "public is not writable by untrusted roles" IS A
REQUIREMENT THIS KEEPS — not a premise it retired** (owner: *"Pinning public,
pg_temp does not remove that requirement"*). `SET search_path = public, pg_temp`
closes the `pg_temp` vector and says nothing whatever about a `public` an
untrusted role can write to. Case 9 pins the trusted set to exactly
`["public", "pg_temp"]`, so widening it is a deliberate edit rather than a quiet
one. **Whether a writable `public` is exploitable UNDER this pin is
UNMEASURED** — a first draft tried to demonstrate it and could not (within one
schema there is nothing to shadow, and a low-privilege role cannot drop an
object it does not own), and it is recorded as unmeasured rather than claimed
either way.

**THE THREE CLASSES OF EVIDENCE, KEPT APART** (owner's instruction):

| class | what it covers | status |
|---|---|---|
| **local tests** | everything above: the mechanism, the pin, the scope, the compatibility and privilege surfaces | run here — probe **61/61**, guards **9/9** |
| **older probe results** | `neon-e2e`'s four `CREATE` privilege checks against a real Neon project | assertions that EXIST in that file; **no run of them is recorded in this repository**, so they are not being quoted as a live reading |
| **current live permission evidence** | what `anonymous`/`authenticated` really hold on a real site today | **NONE. This session has no Neon credential.** `neon-e2e` is the only reader, and running it is the owner's |

**Guards**: `test/site-searchpath.test.mjs` (**9**) — and the shape is the point.
When the pin was added the WHOLE suite stayed green, because the existing
`functionSql` guard asserts `create.includes(" SECURITY DEFINER ")` and a new
trailing clause does not disturb it. **A change nothing could see is a change
nothing will notice being undone.** Case 1 is a **CENSUS over the DDL the engine
really sends** (through the same `fetch` seam, no database), so a function added
next month fails by existing; it asserts the ORDER and not the presence, which a
sweep survivor is why. `neon-e2e` was **re-anchored, not appeased**: its
assertion that a model function does NOT pin is inverted, the TEMP privilege it
never asked about is now reported beside the four `CREATE` checks, and the order
is asserted.

**Sweep: 17 mutants, 17 killed, 0 survived, 0 never applied, 2 comment-only
controls survived.** An earlier pass killed 15 of 16 with one survivor — a
trigger pinned `pg_temp, public`, which the census could not see because it
asked whether a pin was PRESENT while case 3 asked about the constant that
mutant no longer used. Closed by reading the path out of each STATEMENT rather
than out of `FN_SEARCH_PATH`. The seventeenth mutant appends a third schema to
the pinned path with `pg_temp` still last, so **only** the trust-set census
sees it — which is what makes case 9 load-bearing rather than decorative.
Every new case was proved RED against the pre-change modules first (case 8
shows **5 of 5 re-issued functions unpinned** on the old tree); case 6 is green
by design, being the control that privilege must NOT move.

**AND THE PROBE'S OWN CONTROL HAD STOPPED BEING ONE — TWICE, and the second
time was a MOVING REF rather than the wrong ref (owner, 2026-09-16: *"use an
immutable known pre-fix commit instead of `origin/main`… Otherwise the
documented test command stops working immediately after merge."*).** `OLD_REF`
defaulted to `HEAD`, so the moment the fix was committed HEAD *was* the fix:
every BEFORE case inverted and the probe reported the PIN as broken. The first
correction moved it to `origin/main`, **which is the same defect deferred to
merge day** — and merge day is exactly when somebody re-runs the command
CLAUDE.md documents. **THE PROPERTY IS IMMUTABILITY, NOT THE PARTICULAR SHA**:
every moving form this can drift back to is a NAME, and a hex object id is the
only thing git will not re-point. It defaults to **`0fff5317`** now
(`71c2c4b8^`, an ancestor of `origin/main`, measured pre-fix: no
`FN_SEARCH_PATH` in its `site-rls.mjs` and no `search_path` at all in its
`site-schema.mjs`, so the model functions AND the trigger functions are both
unpinned there).

**AND THE RUN-TIME REFUSAL IS KEPT RATHER THAN RETIRED BY THE SHA**, because the
two answer different questions: the sha makes the DEFAULT reproducible and says
nothing about an `OLD_REF=` somebody passes, nor about a later edit moving the
default to a different sha that happens to be post-fix. **The two guards are
split the same way and the division is proved in both directions** — case 10
asks the SHAPE (and that the refusal is still present and still keyed on the
baseline's model-function DDL), case 11 asks GIT whether that sha's tree is
really pre-fix. Driven: `origin/main` fails 10; `HEAD` fails both; cutting the
refusal's condition or its `process.exit(2)` fails 10; **an immutable but
POST-fix sha passes 10 and fails 11**, which is the one case that says case 11
is load-bearing rather than decorative. **Case 11 SKIPS where the object is
absent** — `actions/checkout@v4` is `fetch-depth: 1`, so CI holds one commit —
and skips VISIBLY rather than passing, which is why the CI skip count is 4 and
the local one is 0.

**THE DEPLOY WILL ROLL THE CONTAINER**: `site-rls.mjs` and `site-schema.mjs` are
in the worker's module graph, so the image id moves and the 15–20 minute hold
applies.

**AND THE PER-STEP INPUT CAPTURE WAS RECORDED AND NEVER READ.** `shownSteps` has
been on the developer record since it shipped (run 48's own instrumentation) and
`askLines` — the harness's one reader of that record — never printed it. So the
next paid run, bought to prove a designer was shown a column, would have come
back **without the receipt**: this repository's own wiring defect, in the
instrument built to settle it. Two lines per step now, a HEADLINE carrying
`hasDatabase` and the tables (`hasDatabase: false` beside real tables is run
47's whole defect, so `NO` must read as loudly as `YES` rather than as an
absence) and the entry WHOLE as JSON under it, so nothing is lost to formatting.
**An empty capture is a SENTENCE**, not a blank — "no step was recorded" and "no
step saw anything" are two readings a blank collapses. The fixture is DERIVED
from `shownSchema` rather than typed, because a hand-typed entry is a second
copy of its producer and this one is the whole evidence for schema receipt.
**One older guard was re-anchored, not appeased**: `askLines({coverage:{counts:{}}})`
was pinned to a LENGTH of 2, which was the property "a counts line and nothing
else" only while this block did not exist; it asserts the counts line, the
absence of any requirement line, and that an empty record still reads differently
from a missing one — which is what the length was ever about.

**A WRITE-FREE, CREDENTIAL-FREE COLUMN INVENTORY EXISTS, and it is the
before/after instrument the next live test needs.** PostgREST resolves a
`select=` column against Postgres, so on a `collect` table (no read grant) the
two answers separate exactly: **`42501 permission denied for table <t>`** means
the column EXISTS (it resolved, then the table privilege refused) and **`42703
column <t>.<c> does not exist`** means it does not. No row is written, no key is
needed, and it is per-NAME rather than an enumeration — the authoritative list is
still `backend repair --verify`, which is free and reads `information_schema`.
Measured on `repairbench-1` (2026-09-16): `bookings` has `id`, `customer_name`,
`bike`, `drop_off_day`, `created_at`, `updated_at` and **not** `owner_id`
(correct — `collect` needs none); `repairs` has `id`, `customer_name`, `bike`,
`created_at`, `updated_at` and **no `drop_off_day` at all**, which is what makes
a drop-off-day question answerable only from `bookings`.

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

### A READ-ONLY AGGREGATE ON THE REPAIR WORKFLOW (2026-09-16)

Owner: *"check whether the existing credentialed verification workflow can run a
narrowly scoped, read-only aggregate on repairbench-1: count bookings grouped by
drop_off_day, ordered by count descending. Return dates and counts only, no
customer details. That could establish the expected result independently without
changing the data."*

**IT CAN, AND `--counts` IS THAT MODE.** It exists because an expected result
bought inside the run under test is not a baseline, and the only other way to get
one was to insert rows — which changes the thing being measured.

**IT CANNOT RETURN A NAME, AND THAT IS A PROPERTY RATHER THAN A PROMISE.** Two
walls and neither is a new check written for this. (1) The mode is on **neither**
`WRITES_REFERENCE` nor `WRITES_META`, and both gates are `includes` over a frozen
list, so a mode they have never heard of writes nothing. (2) The grouping column
must be a **DATE OR TIME type asked of the catalog** — a positive, type-derived
rule, never a deny-list of column names (the recorded *"a negative list is the
wrong wall when the input is caller-supplied"*). So `customer_name` is refused by
the TOOL and not by the caller's discipline, and the answer is a date and a count
with nowhere for anything else to sit.

- **TWO CHECKS THAT ARE NOT REDUNDANT.** Catalog membership answers *is there
  such a column*; `PLAIN_NAME` answers *is its name safe to interpolate*.
  Postgres allows a quoted identifier to hold characters this interpolates, so
  they are two questions — driven over `b"; DROP TABLE x; --`.
- **`GROUP BY 1 ORDER BY 2 DESC, 1`, BY ORDINAL.** Each identifier is named
  exactly once and the tie-break is deterministic, which is what makes "busiest
  first" a reproducible reading rather than a lucky one.
- **`MODES` IS THE ONE LIST** and `parseArgs` derives its flags from it. The
  census compares it with the form's own `options:` **both ways**: a mode that
  exists and is not offered is unreachable by the only person who can press it,
  and a mode offered and not implemented is a button that answers `preview`.
  That guard pinned the option list as a LITERAL and went red on the first honest
  addition — *assert the property, not the spelling*, in the guard written for
  the write boundary. Re-anchored, not appeased.
- **THE EXIT RULE IS THE `--verify` DEFECT'S, ONE MODE OVER**: a refusal or a
  failed read exits nonzero, so a run that asked for a number and got none cannot
  read as a successful read of nothing. **And the "nothing to do" sentence NAMES
  THE MODE THAT ASKED**, derived from `args.mode` — a counts run must not report
  itself as a failed verification, and a verification must not lose its own word
  to a mode added beside it.

**THE FIXTURE WAS THE LESS-CAPABLE FAKE, in the one field the feature turns on.**
`test/fixtures/repair-process.mjs` answered `ty: "text"` for **every** column,
free while nothing read the type and fatal the moment something did: it made the
positive arm unreachable and **reported the working mode as broken**. A column
carries its type now — a bare name still defaults to `text`, so every scenario
written before this is byte-identical.

**Guards**: `backend-repair` **52 → 55**, `repair-commands` **14 → 16** (both as
real PROCESSES — a good aggregate read busiest-first with every statement
asserted non-writing, and the text column refused with **a DATE column beside it
as the control** that proves the observer alive in the other direction),
`repair-workflows` **7 → 8** (the step's own `run:` executed under the shell it
declares, with a stub that records its argv, so a form field taken and never
forwarded is a red run). **Sweep: 26 mutants, 26 killed, 0 survived, 0 never
applied, 2 comment-only controls survived.** Pass 1 killed 20 with six survivors
and **every one was a guard gap in the process-level cases, not the product's** —
all six live in `main`, which no module guard runs: identity not proven before
the read, a refused plan uncounted, a refusal not stopping the read, a run that
read nothing exiting 0, the mode leaving the "nothing to do" gate, and the
failure sentence hardcoded to the verification's word.

**WHAT IT DOES NOT SETTLE, and the reason is a permission rather than a
judgement.** A session has no `actions: write`, so **the grouping still comes
from the owner's press** — `backend repair`, mode `counts`, slug `repairbench-1`,
table `bookings`, column `drop_off_day`. Free, read-only, writes nothing.
**What IS established here, free and re-read 2026-09-16**: the total is **3**
(`count_booked_repairs` and `count_existing_bookings` both answer 3 at both
addresses, and the raw `SELECT COUNT(*) FROM bookings` read 3 at 17:52:40Z on
2026-09-15), and `bookings` carries `id`, `created_at`, `customer_name`, `bike`,
`drop_off_day` — by the write-free PostgREST probe, with `nope_not_a_column`
answering `42703` as the control. **The per-date split is unknown from here**:
`bookings` is `collect`, so no client SELECT of values exists, and reading it any
other way means a live Neon credential in a session transcript.

### AND BOTH PRESSES RAN — the inventory landed and the aggregate REFUSED (2026-09-16)

The owner's two presses on `backend repair`, both on main `4de589cc`.
**Run 4 `verify` green in 51 s** (35065641461) and **run 5 `counts` RED in 17 s**
(35067011145) — and the red one is the tool being right.

**THE AUTHORITATIVE BEFORE-STATE, out of `information_schema` rather than out of
per-name probes.** Five postconditions ok, `ready 1`, `every live table declared
— 2 table(s), all declared`, then the inventory:

```
_errors    id integer · at text · message text · stack text · route text · source text
_meta      k text · v text
_metrics   day text · reqs integer · errs integer
_secrets   name text · cipher text · hint text · created_at text
bookings   id integer · customer_name text · bike text · drop_off_day text · updated_at text · created_at text
repairs    id integer · customer_name text · bike text · issue text · updated_at text · created_at text
```

- **SIX TABLES AGAINST "2 DECLARED" IS NOT A CONTRADICTION.** The four
  `_`-prefixed ones are `INTERNAL_TABLES`, excluded from `st.tables` and present
  in the catalog read, which walks every column in `public`.
- **AND IT FOUND A COLUMN THE PROBE NEVER ASKED ABOUT — `repairs.issue`.** The
  PostgREST probe is exact per NAME and is not an enumeration, so it can only
  report on names somebody guessed; this is that recorded limit met live, and it
  is the whole reason the owner required an authoritative inventory before a
  before/after claim.

**`drop_off_day` IS `text`, AND THAT IS WHY `counts` REFUSED IT.** `COUNTS_TYPES`
is `["date","timestamp","time"]` asked of the catalog, so the run answered
`REFUSED (not-a-date-column) — bookings.drop_off_day is text`, named the allowed
set, and exited **1**. **Three properties held live, in order:**

1. **IDENTITY IS PROVEN BEFORE THE PLAN** — `identity PROVEN` precedes the
   refusal, so a run that cannot establish whose database it is never reaches the
   question of what to group.
2. **THE REFUSAL STOPPED THE READ** — MEASURED: the log carries **zero**
   `reading:` lines, so no aggregate statement was ever issued.
3. **THE NONZERO EXIT REACHED THE STEP** (`##[error]Process completed with exit
   code 1`), under the step's own
   `bash --noprofile --norc -e -o pipefail {0}`. **THIS IS THE PIPEFAIL FIX'S
   FIRST LIVE PROOF IN THE FAILING DIRECTION**: measured, run 5 is the **first
   failing run of either repair workflow** — 8 runs, the 7 before it all green —
   so until now that wall had only ever been driven with a stub. Under the
   default `bash -e` this exact run reads GREEN.

**WIDENING `COUNTS_TYPES` TO TEXT IS THE WRONG FIX AND IS NOT BEING MADE.** The
type rule is the entire reason `customer_name` cannot be grouped, and
`customer_name` is `text` too — so admitting text trades the one property that
makes the mode safe for one number. **A cast is worse**: `"drop_off_day"::date`
fails at runtime with Postgres's own message, which quotes the offending
**value**, so a single bad row leaks a customer name out of a mode built to
return dates and counts only.

**THE PER-DATE SPLIT CANNOT BE READ BY THIS SESSION, AND THAT IS A LIMIT OF THE
FREE READERS, NOT OF WHAT A READ-ONLY QUERY CAN DO.** This paragraph read *"the
per-date split cannot be read for free"* and the owner corrected it: *"The
current helper cannot read it; that does not make a credentialed read-only query
impossible."* Both halves of the correction are right. What is true of the free
readers stays true — `bookings` is `collect` (no client SELECT of values),
`count_booked_repairs` gives only the total, and the catalog holds no row values.
What was wrong is the inference from that to the query. **The narrow exception
below is that query**, and it is still read-only, still credentialed, and still
the owner's press.

**AND THE TYPE IS ITSELF SOMETHING THE ADDON HAS TO GET RIGHT.** A tie-break on
a text date sorts lexicographically — chronological for `YYYY-MM-DD` and wrong
for every other format. **THE SENTENCE THAT USED TO CLOSE THIS PARAGRAPH IS
FALSIFIED AND IS CORRECTED BELOW**: it read *"so a generated function that
orders by the date rather than by the count is visible in its own output"*, and
on the data this site really holds it is not. See the baseline entry.

### …AND A FORM VALUE COULD SELECT THE MODE, PAST THE APPROVAL GATE (2026-09-16)

Owner, before this merged: *"The backend-repair workflow expands `$S` unquoted.
With mode=counts, column=\"drop_off_day --apply\", and confirm empty, the actual
parser selects apply. The confirmation gate checked counts, so it never required
approval for the resulting write mode."*

**EXACTLY RIGHT, AND REPRODUCED END TO END BEFORE ANYTHING WAS TOUCHED** — the
step's own `run:` text executed under the shell it declares, with a stub
recording the argv:

```
MODE=counts COLUMN='drop_off_day --apply'
  →  scripts/backend-repair.mjs --counts --slug repairbench-1 --table bookings
     --column drop_off_day --apply
  →  parseArgs → {mode:"apply"}   writesReference: true   writesMeta: true
```

**THE TWO HALVES THAT MADE IT A HOLE RATHER THAN A TYPO.** The step built ONE
string and expanded it unquoted, so a value word-split into more arguments; and
the old loop let the **LAST** mode flag win. The confirm gate asks
`startsWith(github.event.inputs.mode, 'apply')` and had seen `counts`, so it
demanded no word. **The gate and the parser were answering about different
runs** — the widest mode the script has, reached with no approval, through a
mode whose whole selling point is that it writes nothing.

**TWO WALLS, AND THEY ARE NOT THE "cannot be killed one at a time" SHAPE —
MEASURED BOTH WAYS.** With the array in place, reverting the parser leaves every
case in `repair-workflows` green (that census can only see the workflow);
reverting the workflow leaves the parser's own cases green. But each has its OWN
door — the parser revert turns **2** cases red in `backend-repair` +
`repair-commands`, the workflow revert **1** in `repair-workflows` — so they are
swept separately rather than as a pair, and the measurement is in the spec.

1. **A BASH ARRAY, QUOTED.** `args+=(--slug "$SLUG")` … `"${args[@]}"`. A value
   stays one argument whatever it holds, so `drop_off_day --apply` arrives as
   one column name and is refused LATER by `countsPlan`, for the real reason.
2. **`parseArgs` REFUSES RATHER THAN GUESSING.** Four fail-closed refusals: two
   DIFFERENT mode flags (there is no rule for which wins that is not a guess
   about the caller, and the guess that shipped chose the widest), the same flag
   twice, a value missing or shaped like a flag (`-…`, the word-split's own
   residue), and an argument it does not recognise — **never silently ignored**,
   because ignoring is how an argument meant to do something reads as having
   done it. It answers `{…, error}` rather than throwing, and `main` refuses
   with **exit 2 ABOVE the credential check**: the argv is what the caller can
   fix, and a bad argv must not read as a missing key. **It never prints a
   mode** for a parse it refused, and **a refusal puts the mode back to
   `preview`** — without that, `--apply --counts` answers `apply` while claiming
   to have been refused.

**Guards**: `repair-workflows` **8 → 9** — the census the owner asked for, driven
**shell → argv → parser**, because that is exactly where the two came apart.
Five modes × three fields × eight split shapes (the reproduction, a bare
`--apply`, `--apply-reference`, a second slug, `;`, `$( )`, backticks, another
option's name): each must select EXACTLY the form's own mode or be refused, with
the write boundary asserted for every read-only mode. `backend-repair` **55 →
56** (the parser's own door: eleven refusals each by reason, every ordinary argv
still reading, and `main`'s order read out of the file); `repair-commands` **16 →
17** (the exit code, which only a spawned process can say: the split argv exits
**2**, prints its reason, reads **nothing**, and never announces a mode — with
the control that a good argv runs and reads).

**Sweep: 18 mutants, 18 killed, 0 survived, 0 never applied, 3 comment-only
controls survived.** Pass 1 killed 14 with **four survivors, every one a guard
gap**: three reverted the workflow's quoting and survived because the census
allowed *"or it was refused"* everywhere — the right SAFETY property and a
useless REGRESSION one, since the parser catches every split. Closed with a
second list that must arrive **WHOLE** (`"a b c"`, `"two words"`, a trailing
space): only the array delivers those, and a refusal cannot satisfy it. The
fourth was my own vacuous assertion — it excused `apply`, the one value it most
needed to forbid — and closing it found the real product gap in (2) above.

**Suite 6,652** — 6,649 + one case in each of the three guards, and the
arithmetic closes exactly. **CI HAS READ IT: `unit tests` run 2622 on
`91fc2a8b`, green — `# tests 6652 / # pass 6648 / # fail 0 / # skipped 4`**,
against local `6652 / 6652 / 0 / 0`; the four are the recorded environment skips
plus `site-searchpath`'s baseline-commit case.

**AND IT IS ALL ON MAIN NOW — deploy 2128, 2026-09-16 06:33:14→06:36:43Z, green
in 3m29s**, on `main` `c20226e6` → `f88c9198` (fast-forward). Before the merge
this paragraph read *"nothing of this repair tooling is on main yet"*, which was
true when written and is what the merge was for; the order was the recorded one,
**merge → deploy → press**, because a `workflow_dispatch` button does not exist
until its file is on the default branch.

- **THE IMAGE ID WAS COMPUTED BEFORE THE MERGE AND THE DEPLOY AGREED — the
  fourth cross-check of that technique against reality.** `origin/main` →
  `c2aba7a7bd276c36`, the branch tip → **`62c2700fa8c843c2`** (183 inputs each),
  and the step's own line reads `IMAGE SiteBuildContainer: built
  isibi-app-sitebuildcontainer:62c2700fa8c843c2 (registry answered 404; 183
  inputs off ./Dockerfile)`. The ids differ because the `search_path` pin touches
  `site-rls.mjs` and `site-schema.mjs`, which are in the worker's module graph.
  **CONTAINER ROLLED at 06:36:34.8Z**: `EDIT isibi-app-sitebuildcontainer`,
  `c2aba7a7bd276c36` → `62c2700fa8c843c2`, `SUCCESS Modified application`,
  `Applied changes` — read out of the log's own diff, never inferred from the
  step's duration. **So the 15–20 minute hold ran to ~06:52–06:57Z.** Image step
  2m36s, Wrangler 16 s.
- **THE HOLD IS ABOUT THE CONTAINER AND THESE TWO PRESSES DO NOT USE ONE.**
  `backend repair` and `repairbench count fix` are Node scripts on a GitHub
  runner talking to Supabase and Neon; no container, no compile, no credits. The
  hold binds the PAID addon run and nothing else.
- **WORKER**: `Uploaded isibi-app (3.23 sec)`, `Worker Startup Time: 29 ms`,
  `Total Upload: 3484.55 KiB / gzip: 939.48 KiB`. **`No updated asset files to
  upload`** — `public/` is untouched by this branch (main's own chat.js changes
  went out on 2127), **so there is no file-hash check for this deploy and the
  Worker's deploy sha cannot be read from a session at all**: both routes that
  carry it are owner-gated. What stands in is the gate discriminator, measured
  after: `/api/site/build-health` **401**, `/api/site/runtime` **401**,
  `/api/site/job-probe` **401**, `/api/nope-not-a-route` **404**. The Worker half
  is proved to Wrangler's own report and the gate, and no further — said rather
  than glossed.
- **REGRESSION: BYTE-IDENTICAL, and the baseline was taken 22 seconds after the
  push and before the deploy could land** (the process miss of the previous
  round, not repeated). Six sites 200 at the same sizes before and after —
  repairbench-1 46,151 · fretwork-1 58,404 · ashgrove-1 31,120 · northgroup-5
  1,641 · washhouse-1 52,404 · ben-crowe-guitar 52,060 — and the interactive
  half, because a 200 is an availability check and never a health check:
  `/status` **200/6,272** and `/booking-check` **200/6,290**, with
  `count_booked_repairs` and `count_existing_bookings` both **200 answering 3**.
- **AND `fretwork-1`'s 119 BYTES ARE SETTLED AS NOT-THIS.** The previous round
  recorded 58,285 → 58,404 as an open observation with no pre-push baseline to
  decide it. It is 58,404 on **both** sides of this deploy, on the same
  days-old `x-site-version 01788755899622-6w90uf`, so whatever moved it happened
  before deploy 2124 and outside this session's window. Recorded closed as *not
  caused by a deploy in this window*, which is weaker than an explanation and is
  what the evidence supports.
- **The merge started exactly one workflow** — deploy 2128 and nothing else,
  which is the merge-trigger census holding in the live. **And CI has read the
  DEPLOYED SHA, not merely an ancestor of it: `unit tests` run 2624 on
  `f88c9198`, green — `# tests 6652 / # pass 6648 / # fail 0 / # skipped 4`**,
  against local `6652 / 6652 / 0 / 0`; the four are the three recorded
  environment skips plus `site-searchpath`'s baseline-commit case, which needs
  git objects `fetch-depth: 1` does not fetch. **The docs push that followed
  started NO deploy** — `deploy.yml`'s `paths-ignore` covers `**.md` and
  `docs/**`, and the API answers zero runs for that sha, which is the recorded
  behaviour rather than a missing run.
- **BOTH WORKFLOWS ARE REGISTERED ON MAIN WITH THE NEW MODE, asked BY NAME**:
  `backend repair` id **358472078** and `repairbench count fix` id
  **358472079**, both `state: active`, and main's own copy of the form carries
  `options: [preview, apply-reference, apply, verify, counts]`, `shell: bash`
  and the quoted array. Main's script carries `countsPlan`, `columnInventory`,
  `VALUE_ARGS` and `COUNTS_TYPES`.
- **THE DISPATCH IS STILL REFUSED, re-tested rather than asserted, and the
  refusal has SHARPENED ITS WORDING.** A direct REST POST with the right
  endpoint, headers and body answers **403 `Dispatching, enabling or disabling
  workflows and deleting workflow runs, logs or artifacts are not permitted for
  this session type`** — it names the session type where the old text said
  `Resource not accessible by integration` — with the control that the SAME
  token reads that workflow at **200**. A body with no `Content-Type` answers
  **415** first, which is worth knowing before reading a 415 as the permission.
  The press is the owner's, as recorded.

**AND RUNNING A STEP'S REAL `run:` TEXT BY HAND DROPS ITS LOG IN THE REPOSITORY
ROOT.** Both repair steps end in `| tee <name>.log`, so the end-to-end
reproduction that found the injection defect committed a 37-byte
`backend-repair.log` in that same commit. The driven guard never had this — it
runs in a temp directory (`cwd: dir`) — so the guard was right and the hand-run
was not. Both names are in `.gitignore` now with the reason; the workflows are
unaffected, each writing its log in the runner's workspace and uploading it as
an artifact.


### THE PER-DATE SPLIT IS READABLE AFTER ALL — one triple, read-only (2026-09-16)

Owner, on the entry above: *"Keep them recorded, but correct 'the per-date split
cannot be read for free.' The current helper cannot read it; that does not make a
credentialed read-only query impossible. Finish the baseline with a narrowly
scoped exception for exactly repairbench-1 → bookings → drop_off_day. Keep the
general refusal of text columns. No data writes, no schema changes, no other
sites, and no arbitrary SQL input. Return only date-shaped values and aggregate
counts. If values cannot safely be treated as dates, report the number of invalid
rows without printing those values or raw database errors. Do not silently
discard invalid rows."*

**THE CORRECTION IS THE SMALLER HALF AND IT IS MADE ABOVE.** What is true of the
FREE readers stays true; what was wrong was inferring from it that no read-only
query could answer. Two different claims, and the first does not carry the
second.

**`COUNTS_TEXT_DATE` IS AN EXACT TRIPLE, ASKED ONLY AFTER THE GENERAL RULE HAS
REFUSED.** One frozen entry — `repairbench-1` · `bookings` · `drop_off_day` —
and all three must match. Widening `COUNTS_TYPES` to admit text was the fix NOT
made: the type rule is the entire reason `customer_name` (also `text`) cannot be
grouped, and the general refusal is left untouched and is its own guard case.
Every other text column, on every site, **including every other text column on
that same table**, is refused exactly as before.

- **THE SLUG IS THE SITE REALLY BEING READ, never the form's input** — `site.slug`,
  which came through `REPAIR_SITES` and the identity chain. `countsPlan` takes it
  as a fourth argument and **an omitted slug means no exception**, which is the
  fail-closed direction: a caller that cannot say which site it is asking about
  gets the general rule.
- **THE TYPE MUST STILL BE A CHARACTER TYPE** (`COUNTS_TEXT_TYPES`, exact —
  `information_schema.columns.data_type` spells these whole). The triple says
  WHICH column, not "whatever that column happens to be": `~` is not defined on
  every type, and a triple matching a `json` or `bytea` column would reach
  Postgres as an operator error instead of a refusal.
- **`!typed` IS A DECLARED REDUNDANCY, MEASURED INERT AND MUTATED AS A PAIR.**
  The two lists are disjoint, so `COUNTS_TEXT_TYPES.includes(ty)` already
  excludes every typed column. It is kept because it states the ORDER — the
  general rule is asked first — which is the whole design and is not otherwise
  written down in code.

**THE PROJECTION IS THE WALL, NOT THE READER.**

```sql
SELECT CASE WHEN "drop_off_day" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN "drop_off_day" ELSE NULL END AS v,
       ("drop_off_day" IS NOT NULL AND "drop_off_day" !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') AS bad,
       COUNT(*)::bigint AS n
FROM "bookings" GROUP BY 1, 2 ORDER BY 3 DESC, 1
```

`v` is the value only where it matches and NULL otherwise, so **an unusable value
never leaves Postgres** and only its COUNT comes back. `bad` separates "not
date-shaped" from a genuine NULL, so neither is folded into the other. `[0-9]`
rather than `\d`: no backslash, so the literal means the same thing whatever
`standard_conforming_strings` is set to.

**NOTHING CASTS, AND THAT IS THE WHOLE REASON FOR THE SHAPE REGEX.**
`"drop_off_day"::date` fails at runtime with Postgres's own message, **which
quotes the offending value** — a single bad row leaks a customer name out of the
one mode built never to return one. **MEASURED on a real PostgreSQL 16**:
`ERROR: invalid input syntax for type date: "Alice Bloom, 07700 900123"`.

**A FAILED READ IS REPORTED BY SQLSTATE AND NEVER BY MESSAGE.** `errCode` answers
five alphanumerics or `""`, so it can carry nothing; a message that is not a code
answers `""` rather than falling back to the text. This is the one read in the
mode where a row could ride out on an error.

**NOTHING IS SILENTLY DISCARDED, AND THE ARITHMETIC IS PRINTED SO IT CAN BE SEEN
TO CLOSE.** Every row lands in exactly one of `rows` and `invalid`, `total` is
every row the table holds, and the run prints
`N group(s), G grouped + U unusable = T row(s) in total`. A bare total cannot be
checked; this can.

**THE CALENDAR CHECK IS OURS AND RUNS ONLY WHERE WE ARE THE VALIDATOR.**
`DATE_SHAPE` admits `2026-13-45`, so `calendarDate` asks — pure arithmetic, no
`Date` (`Date.UTC(1, 0, 1)` silently means 1901, so a round-trip reports a
well-formed early year as invalid), and it cannot throw. On a TYPED column
Postgres is the validator and the check is skipped: a timestamp renders a shape
this check does not know, so running it there would report every row of a working
column as invalid.

**PROVEN ON A REAL POSTGRESQL 16 — `test/integration/local-pg-counts.mjs`, 48
checks, 0 failed**, over a `text` date column holding real dates at different
frequencies, a genuine NULL, an empty string, a customer's name and phone number,
`2026-13-45` and `2026-02-29`. The statement comes out of the real `countsPlan`
and the reading out of the real `countsOf`; nothing is typed. **The leak
assertion is made against the RAW psql output**, because a reader that drops a
value is a weaker claim than a value that never arrived: no customer name, no
phone number, and every value on the wire date-shaped or NULL. Arm 5 asserts the
negative — no statement carries a write verb, the row count is unchanged, the
schema is unchanged.
**AND THE PROBE'S OWN CONTROL WAS WRONG FIRST**: it asserted the cast's message
quotes THE NAME, and Postgres stops at the FIRST value it cannot cast, which on
that fixture is the empty string. The property is *"the message quotes the value
it choked on"*; the name is then demonstrated by a second cast restricted to that
row. *Assert the property, not the spelling* — in a probe's own control.

**⚠ AND THE FIXTURE WAS THE LESS-CAPABLE FAKE AGAIN, IN THE ONE FIELD THE FEATURE
TURNS ON.** `test/fixtures/repair-process.mjs` hardcoded `dataTypeID: 25` (text)
for every column, so a JS `true` for `bad` came back through the real driver as
the STRING `"true"`; `r.bad === true` was false, every unusable row read as a
genuine NULL, and **the working feature reported itself broken**. MEASURED both
ways: OID 16 with `"t"`/`"f"` parses to a real boolean, which is what a real Neon
answer does and what the probe reads out of psql. The fixture encodes per-column
OIDs now, and `bigint` is deliberately left a STRING because pg-types does.

**Guards**: `test/backend-repair.test.mjs` **56 → 59** (the triple both ways with
every junk argument, the emitted statement whole, the character-type family in and
the other types out, the typed control, the three-answer reading with the
arithmetic closing, the calendar check, and `errCode`); `test/repair-commands.test.mjs`
**17 → 18** — **the wiring hop, which only a PROCESS can see**: `countsPlan` takes
the slug as a fourth argument, and a module that never receives it is
indistinguishable from one that ignores it, so the same table and the same text
column on ANOTHER site is driven as a real run and refused.
`test/integration/local-pg-counts.mjs` is new.

**One older guard was re-anchored, not appeased**: `2 group(s), 3 row(s) in
total` became the arithmetic that closes — the property it was ever about.

**THE WRITE BOUNDARY IS UNMOVED.** `counts` is still on neither `WRITES_REFERENCE`
nor `WRITES_META`, both gates are `includes` over a frozen list, and a mutant
adding it to either is a red run.

**Sweep: 40 mutants, 40 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** — three passes, and the two middle ones are the record worth
keeping. **Pass 1: 39 mutants, 33 killed, 6 survived**, and NOT ONE was the
product's: three were guard gaps (the wiring hop, an array coerced by
`calendarDate`, and the failing-read catch), two were redundancies MEASURED inert
and replaced by PAIR mutants, and one was a test-side mutant measured inert
against the product. **Pass 2: 40 mutants, 39 killed, 1 survived — and the pair
mutant found a REAL gap**: `2026-13-45` is refused by its DAY, so no case
anywhere drove a month past 12 whose day would otherwise pass. **Pass 3: 40/40/0**
is the tally above. *A pair mutant is not a formality; this one bought a case.*

**AND ONE AD-HOC MEASUREMENT MEASURED NOTHING BEFORE IT WAS MADE TO REFUSE.** The
first probe of the test-side survivor compared two empty objects, because it
built its plan with the wrong table name and `countsOf` answered `{ok: false}` —
"an ad-hoc check that failed to apply its own mutation", this repository's own
recorded trap. It refuses now when the plan under test is not the plan it asked
for, and the answer was then the honest one: the product reads both row sets
identically, because the calendar check catches everything the SQL regex would.

**Suite 6,657** — 6,652 + 3 (`backend-repair`) + 2 (`repair-commands`), and the
arithmetic closes exactly.

**NOT RUN LIVE.** Every measurement is from driving the modules, the real process
and a local PostgreSQL. The press is the owner's: `backend repair`, mode
`counts`, slug `repairbench-1`, table `bookings`, column `drop_off_day`, confirm
blank. Free, read-only, writes nothing.

**MERGED AND DEPLOYED — deploy 2129, 2026-09-16 08:24:17→08:25:00Z, green in 42
seconds**, on `main` `f88c9198` → `ea44a70c` (fast-forward). **It had to be
merged**: the workflow checks out `ref: main`, so the button always runs main's
copy of the script.

- **IT DEPLOYED AT ALL BECAUSE `.github/workflows/**` IS NOT IN `paths-ignore`,
  and that was checked rather than predicted.** Every other file in this push is
  under `scripts/`, `test/` or `**.md`, all of which the filter covers — the
  workflow file is what fired it. *A push that looks docs-only is not, if it
  touches a workflow.*
- **THE IMAGE ID WAS COMPUTED BEFORE THE PUSH AND THE DEPLOY AGREED — the fifth
  cross-check of that technique.** `origin/main` and the candidate BOTH hashed
  to **`62c2700fa8c843c2`** (183 inputs each), so nothing an image is built from
  moved; the deploy's own line names that same reference and the container
  answered **`no changes isibi-app-sitebuildcontainer`** / `No changes to be
  made` — **read out of the log's own diff, never inferred from the step's 1
  second. THE CONTAINER DID NOT ROLL, so no 15–20 minute hold applies.**
- **WORKER**: `Uploaded isibi-app (3.35 sec)`, `Total Upload: 3484.55 KiB / gzip:
  939.48 KiB`, 99 asset files read, `Current Version ID:
  629b5db5-ead4-49a9-b03d-…`. The gate was left to expire on success.
- **`No updated asset files to upload`** — `public/` is untouched, so **there is
  no file-hash check for this deploy**. The standby is the gate discriminator,
  measured after: `/api/site/build-health` **401**, `/api/site/runtime` **401**,
  `/api/site/job-probe` **401**, `/api/nope-not-a-route` **404**.
- **REGRESSION: BYTE-IDENTICAL to deploy 2128's recorded numbers** — repairbench-1
  46,151 · fretwork-1 58,404 · ashgrove-1 31,120 · northgroup-5 1,641 ·
  washhouse-1 52,404 · ben-crowe-guitar 52,060 — and the interactive half, because
  a 200 is an availability check and never a health check: `/status` **200/6,272**
  and `/booking-check` **200/6,290**, with `count_booked_repairs` and
  `count_existing_bookings` both **200 answering 3**.
- **THE FORM ON MAIN REALLY CARRIES THE NEW WORDING, asked BY NAME** rather than
  off a listing: main's copy reads *"A text column is refused, except
  repairbench-1 bookings.drop_off_day, which is read as dates by shape"*, keeps
  `options: [preview, apply-reference, apply, verify, counts]` and keeps
  `shell: bash`. Main's script carries `COUNTS_TEXT_DATE`, `DATE_SHAPE`,
  `calendarDate` and `errCode`.
- The merge started **exactly one workflow** — deploy 2129 and nothing else,
  which is the merge-trigger census holding in the live.

### THE BASELINE IS READ — and it is smaller than the claim made about it (2026-09-16)

The owner's press, `backend repair` run 6 (**35076966863**, green in 21 s on
`06f466eb`), mode `counts`, `repairbench-1` · `bookings` · `drop_off_day`:

```
NARROW EXCEPTION: repairbench-1 bookings.drop_off_day is text, read as dates by SHAPE. Every other text column is still refused.
reading: SELECT CASE WHEN "drop_off_day" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN "drop_off_day" ELSE NULL END AS v, ("drop_off_day" IS NOT NULL AND "drop_off_day" !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') AS bad, COUNT(*)::bigint AS n FROM "bookings" GROUP BY 1, 2 ORDER BY 3 DESC, 1
  2026-09-18  2
  2026-09-19  1
2 group(s), 3 grouped + 0 unusable = 3 row(s) in total

1 read, 0 not read. (read-only: this mode writes nothing.)
```

**THE SPLIT IS `2026-09-18 → 2`, `2026-09-19 → 1`.** The arithmetic closes and
is printed so it can be seen to: 3 grouped + 0 unusable = 3, which is the total
two other readers already established independently (`SELECT COUNT(*) FROM
bookings` at 17:52:40Z on 2026-09-15, and both RPCs answering 3 today). **Zero
unusable and zero NULL**, so the shape projection and the calendar check both
had nothing to reject — the wall held, and it held over a row set that never
tested it.

**AND THE TIE-BREAK CLAIM THIS FILE MADE IS FALSIFIED BY THIS DATA.** It said a
generated function that orders by the DATE rather than by the COUNT would be
*"visible in its own output"*. Measured over the real two rows:

| ordering | answer |
|---|---|
| `count DESC, date ASC` (what the ask says) | `2026-09-18, 2026-09-19` |
| `date ASC` | `2026-09-18, 2026-09-19` — **IDENTICAL** |
| `count ASC` | `2026-09-19, 2026-09-18` — differs |
| `date DESC` | `2026-09-19, 2026-09-18` — differs |

The counts happen to fall in the same direction as the dates, so **"busiest
first" and "oldest first" produce the same answer here and the confound cannot
be separated**. A function that sorted by the wrong column would pass. The claim
was written from the TYPE and never checked against the ROWS — *a property of
the format is not a property of the data*, and only the read could say so.

**WHAT THIS DATA CAN TEST, then, stated as what it discriminates:**

- **That the schema was received** — `drop_off_day` lives on `bookings` and
  **not** on `repairs` (the column inventory read it: `repairs` has `id`,
  `customer_name`, `bike`, `issue`, `updated_at`, `created_at`). A function
  reading `repairs` cannot group by date at all, so picking the right table is
  observable — and it is exactly what run 47 got wrong.
- **That grouping happened** — 3 rows collapse to 2 groups. A per-row listing,
  a bare total or a `COUNT(DISTINCT)` all answer something other than two rows.
- **That the counts are right** — `2` and `1`, and they sum to the independently
  established 3.
- **That it is not the quietest-first or newest-first ordering.**
- **That no customer name reaches the page** — the ask says so and `bookings`
  carries `customer_name`.

**AND WHAT IT CANNOT TEST, because the rows are not there:**

- **Busiest-first versus oldest-first** — the confound above.
- **Tie handling** — there are no equal counts (2 against 1). The owner's own
  note applies: the ask says only "busiest first", so no tie order is required
  of the feature; what is true is that this data could not check one either way.
- **An unusable or NULL date** — zero of each, so nothing exercises how a
  generated function treats one.
- **Many groups, cross-month or cross-year ordering** — two adjacent days in one
  month is the whole range.
- **Whether a `::date` cast would break** — both values are well-formed, so a
  generated function that casts looks identical to one that does not.

**Breaking the confound would mean inserting a row, which is forbidden** ("No
data writes"), so it is recorded as a limit of the baseline rather than worked
around.

### RUN 49: THE ADDON BUILT THE FEATURE FROM THE EXISTING DATABASE (2026-09-16)

The owner's press, `lane sweep` run **49** (**35079881765**, green in 10m02s on
`main` `f22c166c`; the addon job itself **429.2 s**, cost **12**, balance
**149 → 137**). One free-text ask, the date column's SQL name absent from it.

**BOTH HALVES OF WHICH-CODE-IS-ANSWERING WERE PROVED BEFORE A CREDIT WAS SPENT**
— the pre-flight's whole purpose, and this is the second run to clear it:

```
worker deploy: ea44a70c90bfb44e769a1eee6bc9131622e5b224  [build-health 200]
container image (cold start, lane health-probe): 62c2700fa8c843c2  health="ok 850968e5fecd 62c2700fa8c843c2" in 1941ms
runtime for repairbench-1: deploy=ea44a70c… runner=true async=true  [200]
the code under test is the code answering — proceeding
```

**AND SCHEMA RECEIPT IS ESTABLISHED FROM THE PRE-CALL CAPTURE, NOT FROM THE
FEATURE WORKING.** `shownSteps` — the instrumentation written for run 48's Gap A
and printed by `askLines` for the first time here — records what each designer
was really handed, taken above the await:

```
· function — database: YES — 2 table(s): ["bookings","repairs"]
  {"kind":"function","tables":["bookings","repairs"],
   "columns":{"bookings":["customer_name","bike","drop_off_day"],
              "repairs":["customer_name","bike","issue"]},
   "functions":["count_booked_repairs","count_existing_bookings"],"hasDatabase":true}
· page — database: YES — 2 table(s): ["bookings","repairs"]
```

**`hasDatabase: true` with both tables and their columns is run 47's defect not
recurring**, and it is the milestone the owner set. Run 47 was told the site had
no tables and invented `repairs`; run 49 was told the truth and used it.

**THE FUNCTION IT WROTE, VERBATIM — and it picked the right table:**

```sql
SELECT COALESCE(json_agg(json_build_object('drop_off_day', drop_off_day,
                                           'booked', booked)
                         ORDER BY booked DESC), '[]'::json)
FROM (SELECT drop_off_day, COUNT(*)::int AS booked
      FROM bookings GROUP BY drop_off_day) counts
```

`bookings`, not `repairs` — which is the discriminator, because `repairs` has no
`drop_off_day` at all. It routed **`function · page`** and made **no table**.

**CORRECTNESS, THREE INDEPENDENT READINGS AGREEING**, which is what a 200 alone
could never say:

| reader | answer |
|---|---|
| the baseline aggregate (your `counts` press, before the run) | `2026-09-18 → 2`, `2026-09-19 → 1` |
| the site's own public RPC `workshop_load` (**200**) | `[{"drop_off_day":"2026-09-18","booked":2},{"drop_off_day":"2026-09-19","booked":1}]` |
| a real Chromium on `/workshop-load` | the same two rows, **0 page errors** |

`/workshop-load` **200/6,561 B**, `x-site-version 01789551373761-47doj7`, build
`mu32igiu-dao04n → mu3wolgr-eqt2r5`, linked from the header. The browser's own
RECORDED network call is `workshop_load → [{18: 2},{19: 1}]`, which is what ties
the pixels to the query rather than to a number that happens to be on screen.
**Controls unchanged**: `count_booked_repairs` and `count_existing_bookings`
both still **200 answering 3**; `/status` and `/booking-check` both 200.

**NO CUSTOMER NAME REACHES THE PAGE, checked three ways.** The route chunk
`workshop-load-BJi9w4fU.js` (4,180 B) contains `workshop_load` ×1,
`drop_off_day` ×8, `booked` ×4 and **`customer_name` ×0, `repairs` ×0**; the RPC
returns only the date and the count; the rendered text contains no name, no
phone number and no `customer_name`.

**NO NEW TABLE**, by seven per-name PostgREST probes (`workshop_loads`,
`bookings_by_day`, `daily_load`, `workshop`, `bikes_booked`, `load_by_date` —
every one `PGRST205`). **That is exact per name and is NOT an enumeration**: the
authoritative read is `backend repair --verify`, free and the owner's press.

**THE REPORTING IS HONEST AND RUN 48'S DEFECT DID NOT RECUR.** The record reads
`{total: 7, covered: 5, elsewhere: 2, unsupported: 0, unreadable: 0, delivered:
0, configured: 0, unverified: 7, unknown: 0, missing: 0, blocked: 0, failed:
0}` — **nothing `missing` and nothing `failed`**, so nothing working was called
"Still to do". The customer heard the `unverified` clause: *"I've set that up,
but I can't confirm from here that A page at /workshop-load shows how many bikes
are booked in for each drop-off date; or that A function the page calls works out
booked bikes per date from the bookings — have a look and tell me if it isn't
right."*

**AND `unverified` IS THE CEILING BY DESIGN, WHICH IS THE GAP THAT REMAINS.**
`delivered` needs a `checked` behaviour and `checked` is deliberately empty —
nothing on this path exercises a behaviour — so **the platform cannot confirm its
own feature works; the browser and the RPC comparison above are what confirmed
it, from outside.** That is the honest reading and it is a limit of the design
rather than a defect in it.

**THE HARNESS'S `STILL OWED` LINE READS MORE ALARMING THAN THE STATES DO**, and
saying so is the point: it prints the route's `requirements` list verbatim
(`askLines`, `list(r.requirements)`), which carries both `elsewhere` hand-offs —
including the FORWARD one the `page` step really was handed. The STATES are all
`unverified`, and the customer's sentence is the can't-confirm one. Two readings
of one run, and only the state one is about whether the work happened.

**AND THE ORDERING CLAIM IS SOURCE EVIDENCE, NEVER OUTPUT EVIDENCE.** The SQL
says `ORDER BY booked DESC` — it orders by the COUNT — and that is read off the
function's own body. The OUTPUT cannot discriminate it, because on these rows
busiest-first and oldest-first coincide (the confound recorded above). Both
statements are true and they are about different things; collapsing them is what
the falsified tie-break claim did.

**NO DEPLOY OVERLAPPED THE PAID WORK, checked rather than assumed.** Another
session's deploy **2130** ran 09:40:25→09:43:18Z; the addon job finished at
~09:39:19Z (429.2 s from ~09:32:10). The live verification above therefore reads
the sweep's own publish — `x-site-version` is the build the run made, and a
Worker deploy changes nothing a visitor sees until a site republishes.
**The run pushed its own screenshots to main** (`9872f111`, existing
`lane-sweep.yml` behaviour), which started no deploy — docs only, `paths-ignore`.

### CLOSED — the after-inventory is authoritative and unchanged (2026-09-16)

`backend repair` run **7** (**35131202825**, the owner's press,
`--verify --slug repairbench-1`, green in 22 s, exit 0, on main `6624ca40`).
Five postconditions ok, the site classified **`ready`** by a fresh process
re-reading Supabase, `every live table declared — 2 table(s), all declared`.

**THE COLUMN INVENTORY IS BYTE-IDENTICAL TO THE PRE-RUN-49 READING** — run 4
(06:51Z, before the paid run) and run 7 (17:56Z, after it) list the same six
tables, the same columns, the same types, in the same order:

```
_errors    id · at · message · stack · route · source          (all text bar id)
_meta      k · v
_metrics   day · reqs · errs
_secrets   name · cipher · hint · created_at
bookings   id · customer_name · bike · drop_off_day · updated_at · created_at
repairs    id · customer_name · bike · issue · updated_at · created_at
```

**So the hedge comes off.** The run-49 entry above says *"no new table, by seven
per-name PostgREST probes … exact per name and NOT an enumeration"*, and names
`--verify` as the authoritative read. It has now been taken: **run 49 created no
table and no column.** `information_schema`, not names somebody guessed — and
the difference is not theoretical, since the inventory is where `repairs.issue`
was first seen, a column no probe had asked about.

**THE MILESTONE IS CLOSED**: *the addon receives the existing schema, builds the
correct feature automatically, and reports its outcome accurately.* Each third
proven by its own reader and not by the other two — receipt from the pre-call
`shownSteps` capture, correctness from three independent readings (the `counts`
baseline, the site's own RPC, a real browser with its network call recorded),
reporting from the stored coverage and the customer's own sentence. **What is
NOT closed is `delivered`**: `checked` is empty by design, so the platform still
cannot confirm its own feature works, and the browser check is what confirmed
this one from outside. That is the design's stated limit, recorded above.

**Three things the run's own log says in passing**, each a wall proving itself
live rather than in a guard: `scope:` printed the five sites before anything was
read and the named slug narrowed it to one, so the other four were untouched;
the step header carries `bash --noprofile --norc -e -o pipefail`, so a failed
postcondition could have reached the step; and `refuse an apply that was not
asked for` reads **skipped**, the confirm gate correctly standing down for a
read-only mode.


### THE SCHEDULED-JOB TIER: STUBBED DELIVERY PROVEN, THE LIVE TEST NARROWED (2026-09-16)

Owner: *"prepare one focused addon test for a scheduled job using an existing
function. Check the designer inputs, persisted schedule and timezone, actual
runner execution, dependency failures, and customer report. Start with stubbed
delivery."* Then five corrections to the first draft, **every one of which was
right**; what follows is the corrected state, not the draft.

**THE JOB TIER IS THE ONE WHOSE WORK DOES NOT HAPPEN IN THE REQUEST.** Every
other kind is done when the reply arrives; a job REGISTERS a row and a later
cron tick runs it. **26 jobs were registered with zero sends ever** before the
2026-09-03 fix, which is that gap exactly, and that fix is still recorded **not
proven live**.

#### THREE CLAIMS, AND PASSING ONE PROVES NEITHER OTHER

Owner: *"Separate persisted schedule/timezone, Run now execution, and automatic
cron selection."* They were folded together in the draft. They are three:

| claim | proved by | state |
|---|---|---|
| **the schedule and zone were PERSISTED** | `GET /api/site/<slug>/jobs` — `everyMinutes`, `at`, **`tz`** off the row | live only; nothing else reads that hop |
| **the RUNNER executes** | `POST {name, run: true}` | live only |
| **a TICK would pick the job** | `dueJobs(rows, now)` on a fixed clock | **PROVEN in `test/job-delivery.test.mjs`** |

**RUN NOW CANNOT PROVE THE THIRD, and that is structural rather than a
shortfall**: it passes `force: true`, which drops the dueness clause from the
claim's WHERE entirely. It proves the runner works and says nothing whatever
about selection. Automatic firing on a real tick is proven by neither and would
need waiting one out.

#### STUBBED DELIVERY IS A DRIVEN TEST NOW, NOT A LIVE RUN WITH NO KEY

**The draft called "a live run on a site with no provider key" stubbed delivery.
It is not.** With no key `runJob` returns BEFORE the sender is reached, so
nothing about the recipient, the date, the body or the stamp is exercised at
all; the only thing that run proves is the refusal. `test/job-delivery.test.mjs`
(**11**) drives the real `runJob` with everything injected — a fixed clock, a
stub sender that RECORDS its payload, and synthetic recipients (`example.com`
and the reserved UK `07700 900xxx` range; nothing in the file can reach a
person, and nothing is copied from a customer's row). What it demonstrates:

- **recipient, date and body**, read off the payload the provider WOULD have
  been handed — the `to` is the row's and never the credential's `from`, the
  date the reminder is ABOUT survives in the body, and the body arrives byte for
  byte. Two due rows, so a loop that runs once does not satisfy it.
- **drops, counted**: no address, no subject, no body, and `a@x, evil@y` — which
  is header injection whoever wrote it.
- **SMS**: the number parsed to `+447700900123`, and **no `subject`**, which on
  some providers would ride out as part of the body.
- **the missing key, DEMONSTRATED SEPARATELY** (the owner's instruction) in both
  shapes: no key at all → the sender is never called, `ok: true`, reason naming
  the channel; and one key of two → the emails go, the texts are `unsent` and
  never `failed`, because a half-configured site must not read as broken.
- **a refused send is a `failed`, a held one is `unsent`** — one needs looking
  at, the other needs a key.
- **housekeeping** (`{"did"}`), **an empty list** (the ordinary morning, and it
  must read as success), **a lost claim** (the double-send wall: no function
  call, no send), and **the hundred-and-first message reported** rather than
  silently capped.
- **`dueJobs` on a fixed clock**, with the zone isolated by a case where London
  and UTC DISAGREE — registered between the two occurrences, so one is due and
  the other is not. Anything less leaves "the zone is read at all" unproven,
  which is what the first draft of that case got wrong.

**⚠ WHAT IT PROVES IS SCOPED, AND THE SCOPE IS THE OWNER'S WORDING** (*"the new
cases prove runner behavior with supplied function output, not generated SQL or
provider delivery"*). The function's answer is HANDED IN by the test, so every
case is a claim about what `runJob` does WITH that answer. **NOT proven: that a
model-written SQL function returns this shape** — nothing here runs generated
SQL, and the shapes used are ones a correct function WOULD produce, which is an
assumption about the designer rather than a measurement of it. **NOT proven:
that anything is DELIVERED** — the last hop visible is the payload the provider
would have been handed; no provider accepts it, no handset receives it, no real
key is exercised. Both gaps are live questions and a green run of that file
closes neither. **The file's own header says so**, because a test named
`job-delivery` is exactly the one somebody later quotes as proof that mail
works. **No real message has been sent and none may be.**

#### THE LIVE SCENARIO WAS WRONG, AND THE RECIPIENT SOURCE IS THE REASON

Owner: *"`bookings` has no email field, so the proposed customer-reminder request
is not established as function + job only."* **Correct, and measured.** The
authoritative inventory (`backend repair --verify`, run 7) reads `bookings` as
`id · customer_name · bike · drop_off_day · updated_at · created_at` and
`repairs` as `id · customer_name · bike · issue · updated_at · created_at`.
Probed per name with the observer proved alive in both directions:
`email`, `phone`, `mobile`, `contact`, `customer_email` and `tel` all answer
**`42703 column does not exist`**, while the control `drop_off_day` answers
**`42501 permission denied for table`** — which only a column that RESOLVED can
produce. **No table on the site holds a recipient of any kind.**

**So a customer-reminder job cannot be function + job.** Its function would have
no address to return; the change would have to extend `bookings` with a contact
column, which is a **table** kind — and `pageless` is FALSE the moment a table
is in the answers, so the whole cost argument went with it. The draft's ask is
withdrawn.

**THE SMALLEST LIVE TEST IS THE OWNER'S OWN WORDING**, which is simpler than
the draft's and says the two prohibitions out loud:

> *"Every night at 11, count how many bookings we have and record the total in
> the job's run result. Don't delete or change any bookings, don't email or text
> anyone, and don't add a page."*

| it needs | it does not need |
|---|---|
| read `bookings` — a plain `COUNT(*)`, no date arithmetic | any recipient — **the site has none** |
| an INTERNAL function returning `{"did": …}` — which is what *"record the total in the job's run result"* names without naming it | a contact column, so no table kind |
| a `job` at `23:00`, `everyMinutes` 1440, with the browser's `tz` | a page, so no compile and no publish |
| | any write, so no booking is added, changed or deleted |

**AND THE EXPECTED ANSWER IS ALREADY ESTABLISHED INDEPENDENTLY: 3.** No new
baseline tooling is needed, which is the point of the simpler count — three
readers already agree and all three predate this test: the raw
`SELECT COUNT(*) FROM bookings` at 17:52:40Z on 2026-09-15, the `counts` press's
per-date split (2 + 1), and both public RPCs answering 3 today. **So the run has
a number to be wrong against**, which a date-arithmetic ask would not have had.

`pageless([{kind:"function",value:[{internal:true}]},{kind:"job",…}])` is
**true**, driven. **But that is conditional on the model's own answer and the
three ways it can miss are all OBSERVABLE, not silent**: a function marked
public makes the job refuse `no-job-fn` AND makes the change not pageless; a
function returning messages instead of `{"did"}` drops them all for want of an
address (`dropped: N`); and a table in the answer is visible in `kinds`. None of
those is a wrong answer wearing a right one's face, which is why the ask is
worth running rather than rewriting until it cannot fail.

**THE FOUR CHECKS, as the owner set them:**

1. **the function and job designers' actual inputs** — `shownSteps`, the
   per-kind pre-call capture, printed by `askLines`. For the `job` step the line
   that matters is `siteNote`'s *"The functions a scheduled job may run are: …"*.
2. **the persisted function reference, schedule and EXPLICIT timezone** —
   `GET /api/site/<slug>/jobs`: the row's `fn`, `everyMinutes` 1440, `at`
   `23:00`, and `tz` present rather than `(NO ZONE)`.
3. **Run now returning 3, and the fresh persisted result AGREEING** — the press
   answers `result`, the re-read answers `lastResult`, and the harness now
   **compares them and says AGREE / DISAGREE / CANNOT BE COMPARED** rather than
   printing two numbers near each other. A row with nothing recorded is the
   third state, not a pass: `recordJobOutcome`'s write can fail on its own.
4. **the customer reply accurately describing what was configured** — the
   pageless reply's own sentence plus the stored coverage.

**WHAT THE LIVE RUN ADDS over the stub**: the designer inputs (`shownSteps` for
the `function` and `job` steps), the Worker→Supabase registration hop, the live
`jobDeps` built from a real row against real Neon and the real `_secrets`, and
the customer report for a job-only change. Nothing else.

**THE PRICE IS UNMEASURED. FULL STOP** (owner: *"'below 12' is not an enforced or
demonstrated bound"*). No pageless run's cost is recorded anywhere, nothing
enforces a ceiling — `edit_reserve` only refuses above 100,000 and the harness's
`budget` is read BETWEEN cases, which a single-ask run never has two of — so the
account balance is the only bound that binds. The design half is smaller than a
page build's (`job` **6,617** and `function` **8,130** on the wire against
`page` **38,688**) and the page call and compile do not run; **that is an
argument about shape and not a number, and it is not a bound.**

#### THE INSTRUMENTATION, AND THE TRAP IT CONTAINED

`GET /api/site/<slug>/jobs` is the only reader of what was PERSISTED and carries
the one field no model chose — `tz`, which the browser sends. Read BEFORE the
post and after, so *"this run added it"* is a claim somebody can make. The press
is its own switch, **defaults to pressing nothing**, and `auto` fires only a job
THIS run registered.

**⚠ AND THE FIRST DRAFT PUT THIS FILE'S OWN MOST-RECORDED TRAP IN THE FUNCTION
WRITTEN TO STOP IT.** The re-read after the press was
`jobRows(…) || extra.jobsAfter` — so a re-read that FAILED printed the PRE-press
stamp, `lastRun never`, which reads as a press that did nothing at all.
Cannot-tell arriving as a value, one line below a comment about cannot-tell
arriving as a value. The two reads are separate maps now: `jobsAfter` is what
the change persisted, `jobsVerify` is what the run recorded, and a failed
re-read says **`the persisted outcome COULD NOT BE VERIFIED`** and prints no
stamp. **The route's answer and the persisted outcome are two claims** — the
first is `runJob`'s return, the second is what `recordJobOutcome` wrote, and the
write can fail on its own.

**DEPENDENCY FAILURE STAYS WHERE IT IS.** The wall is per job, by the name of
the function it runs, and fires only when the database really refuses one —
which no customer sentence can reliably cause. Kept in
`test/addon-route.test.mjs` (the mixed-success function step, with the control
that one surviving function keeps its job), as the owner asked.

**Guards**: `test/job-delivery.test.mjs` (**11**, new), `addon-sweep` **32 →
38**, every new assertion proved RED against the defect it forbids — including
the stale fallback, driven in both its shapes. **Sweep: 22 mutants, 22 killed,
0 survived, 0 never applied, 2 comment-only controls survived.** Two passes;
both survivors were the SAME recorded shape one hop apart — the lines computed
under `if (false)`, and then the fourth argument dropped at the call site, which
makes `verify` `undefined` and reports "could not be verified" over a re-read
that worked. Suite **6,697** — 6,685 + 11 + 1, closing exactly.

**AUTOMATIC CRON EXECUTION STAYS UNVERIFIED** until a real scheduled tick is
observed, and a green Run now does not move it: `force: true` drops the dueness
clause, so the press proves the runner and says nothing about selection. What is
proven about selection is `dueJobs` on a fixed clock, and that is a different
layer from a tick really firing.

**REUSE OF THIS STORED INTERNAL FUNCTION IS A SEPARATE FOLLOW-UP TEST** — a
later job naming the function this run creates, which is the recorded hop 2
(*"a job on a STORED internal function is re-attached after `normalizeSchema`"*,
which keeps a job only when its function is in the same spec: right for a build,
a silent drop here). Not part of this run and not bought with it.

#### MERGED AND DEPLOYED, AND THE INPUTS ARE EXACT NOW (2026-09-16)

**CI first**: `unit tests` run **2644** on `d9d8018d`, green — `# tests 6698 /
# pass 6694 / # fail 0 / # skipped 4`, against local `6698 / 6698 / 0 / 0`. The
four are the three recorded environment skips plus `site-searchpath`'s
baseline-commit case; **the TOTAL is what matches**, which is why the total is
the number stamped. No `site build` fired and none was due — the seven changed
files are two documents, a script, a mutant spec, two guards and a workflow, and
none is under `builder/**`, `worker.js` or any other glob in that `paths` list.

**Deploy 2131, 2026-09-16 19:02:09→19:02:57Z, green in 48 seconds**, on `main`
`6624ca40` → `d9d8018d` (fast-forward, 7 files). **NO PRODUCT CODE MOVED** —
`scripts/`, `test/`, one workflow and two documents; no `worker.js`, no
`builder/`, nothing under `public/`.

- **THE IMAGE ID WAS COMPUTED BEFORE THE MERGE AND THE DEPLOY AGREED — the sixth
  cross-check of that technique.** Both sides hashed to **`d927ff27fd186f30`**
  (183 inputs), and the container answered **`no changes
  isibi-app-sitebuildcontainer`** / `No changes to be made` — read out of the
  log's own diff, never inferred from a duration. **THE CONTAINER DID NOT ROLL,
  so no 15–20 minute hold applies.**
- **It deployed at all because `.github/workflows/**` is not in `paths-ignore`**
  — every other file in the push is under `scripts/`, `test/` or `**.md`, which
  the filter covers. *A push that looks docs-only is not, if it touches a
  workflow*, met for the second time.
- **`No updated asset files to upload`**, so there is no file-hash check for
  this deploy. The standby is the gate discriminator, measured after:
  `/api/site/build-health` **401**, `/api/site/runtime` **401**,
  `/api/site/job-probe` **401**, `/api/nope-not-a-route` **404**.
  `Uploaded isibi-app (4.68 sec)`.
- **The form on main really carries the box**, asked by name rather than off a
  listing: `run_job` is there with its `IT REALLY RUNS` sentence intact.
- **The two RPCs still answer 3**, which is the number the live test will be
  judged against. **⚠ AND THE REGRESSION READING IS NOT A CLEAN PASS, because no
  pre-push baseline was taken this round**: `repairbench-1` reads 46,358 B
  against 46,151 recorded at deploy 2128, and `fretwork-1` 58,407 against
  58,404. Stable across three consecutive reads, `x-site-version` unchanged at
  `01789551373761-47doj7` (run 49's build, so the site has not republished), and
  this deploy uploaded no asset and rolled no container — so it cannot be the
  cause. **Not attributable to this deploy, and not explained either**; the gap
  is the missing baseline, which is the recorded practice and was skipped.

**THE EXACT LIVE-RUN INPUTS.** `lane sweep`, dispatch-only, **the owner's
press**:

| field | value |
|---|---|
| `confirm` | `spend` |
| `harness` | `addon` |
| `site` | `repairbench-1` |
| `ask` | *Every night at 11, count how many bookings we have and record the total in the job's run result. Don't delete or change any bookings, don't email or text anyone, and don't add a page.* |
| `picker` | `grok` |
| `budget` | `40` |
| `expect_deploy` | `d9d8018dd336b8f3558e708c81840565cab67cce` |
| `expect_image` | `d927ff27fd186f30` |
| `run_job` | `auto` |
| `lanes` | *(leave as `all` — the `ask` replaces the case list entirely)* |

`run_job: auto` is safe here for a stated reason rather than by luck: it fires
only a job THIS run registered, and `repairbench-1` has **no mail or SMS key in
Secrets**, so the runner cannot reach a sender even if the model returns
messages instead of a note.

#### RUN 50: IT RAN, IT COUNTED 3, AND THE REPORT UNDER-SOLD IT (2026-09-16)

The owner's press. `lane sweep` run **50** (**35140360136**), green in 5m21s,
the addon job **173 s**, **cost 3 — balance 137 → 134**. Routed
`["function","job"]`. **THE PRE-FLIGHT CLEARED BOTH HALVES BEFORE A CREDIT WENT**:
`worker deploy: d9d8018d…`, `container image (cold start): d927ff27fd186f30`,
the runtime route agreeing, then *"the code under test is the code answering"*.

**THE FIRST MEASURED PAGELESS COST IS 3 CREDITS.** The shape argument said
"smaller than a page build" and refused to name a number; the number is 3,
against run 49's 12 and run 47's 13. **`build UNMOVED`** (`mu3wolgr-eqt2r5` →
the same), verified from outside afterwards: `x-site-version` is still
`01789551373761-47doj7`, run 49's build, and all four pages answer 200 at their
previous sizes. No page, no compile, no publish — pageless proven live rather
than driven.

**THE FOUR CHECKS, each answered:**

1. **DESIGNER INPUTS — hop 1 proven in the capture itself.** Both steps read
   `hasDatabase: true` with both tables and their columns. The `function` step
   was shown `functions: ["count_booked_repairs","count_existing_bookings",
   "workshop_load"]`; the `job` step was shown those **plus
   `nightly_booking_count`** — the function declared one call earlier, in the
   job designer's own input, which is the hop `aSite.jobFns` exists for.
2. **PERSISTED SCHEDULE AND EXPLICIT TIMEZONE**: `nightly_booking_count: at
   23:00 Europe/London every 1440m`, the zone spelled out rather than
   `(NO ZONE)`. **⚠ BUT THE FUNCTION REFERENCE IS NOT IN THAT ROUTE'S ANSWER** —
   `GET /api/site/<slug>/jobs` returns `name · everyMinutes · at · tz · enabled
   · lastRun · lastResult` and **no `fn`**, so the reference cannot be READ
   back. It is proven FUNCTIONALLY instead: `runJob` reads `spec.fn` and calls
   it, and the press returned the count, which a missing or wrong reference
   answers `"no function"` for. A real reader gap, named rather than papered
   over — and here the job and the function share a name, so the line is
   ambiguous even to a careful eye.
3. **RUN NOW RETURNED 3, AND THE PERSISTED RESULT AGREES.**
   `ran nightly_booking_count now: 200 sent 0 — "Done — counted 3 bookings."`
   then `persisted: lastRun 2026-09-16T19:29:36.345+00:00 lastResult "Done —
   counted 3 bookings."` and **`the route's answer and the persisted result
   AGREE`**. The 3 matches the total established three independent ways before
   this test existed.
4. **THE CUSTOMER REPLY — nothing `missing`, nothing `failed`**, and the record
   reads `{total: 8, covered: 5, elsewhere: 3, delivered: 0, configured: 3,
   unverified: 4, unknown: 1, missing: 0, blocked: 0, failed: 0}`. **But see the
   finding below: it is accurate about what it can check and under-sells what it
   configured.**

**THE FUNCTION IS INTERNAL, PROVEN FROM OUTSIDE.** An anonymous RPC call answers
**`42501 permission denied for function nightly_booking_count`** while the
control `count_existing_bookings` answers **200 with `3`** — the observer alive
in both directions. Its body is a single `SELECT json_build_object('did', …)
FROM bookings`: no write, no delete, no recipient.

**AND THAT FALSIFIES SOMETHING I SAID EARLIER IN THIS SESSION.** Deciding the
test's shape I wrote that the PostgREST probe *"cannot reliably distinguish
'internal function exists' from 'no function'"* and planned around it. It can:
an internal function answers **`42501`**, an absent one **`PGRST202`**. That was
reasoned about rather than measured, and the measurement is the opposite. **The
same discrimination the tables already had** (`42501` = exists, `PGRST205` =
does not), one object kind over.

**⚠ THE CONCRETE FINDING: ONE NEED, TWO ENTRIES, TWO VERDICTS — AND THE
CUSTOMER HEARS THE WEAKER ONE.** *"That count runs every night at 11"* appears
**twice** in the coverage, because two designers both spoke to it:

| written by | entry | verdict |
|---|---|---|
| the `function` step | `elsewhere → job`, **no `item`** | **`unknown`** |
| the `job` step | `covered`, `item: nightly_booking_count` | one of the **`configured: 3`** |

Both are the recorded rules applied correctly — a populated kind with no `item`
must answer `unknown`, or any job would satisfy any request for one. **The
EFFECT is that one reply says a thing is both configured and unseeable**, and
the sentence the customer gets carries the pessimistic half: *"I can't see from
here whether That count runs every night at 11 — nothing I can check says
either way"*, about a job registered at 23:00 Europe/London that the same run
then fired successfully. The hand-off itself was DELIVERED (`handedTo` names
it); it is the implementation verdict that is unknown, and the implementation
verdict is what reaches the prose.

**Not fixed, and deliberately not**: the owner's standing instruction is no
reporting redesign unless a test exposes a concrete defect. This is the
concrete defect it exposed, recorded with its evidence, and what to do about it
is the owner's call. The obvious shapes — resolve duplicate needs to their
strongest verdict, or let a named entry settle an unnamed one for the same need
— are both changes to how a reply is composed and neither is being made here.

**STILL OWED READS WORSE THAN THE STATES, AGAIN** — it prints the raw
`requirements` list, so all three `elsewhere` entries appear outstanding while
the states are `configured`/`unverified`/`unknown` and none is `missing` or
`failed`. Recorded before run 49 and unchanged; it is a harness label, not a
verdict.

**WHAT IS STILL NOT PROVEN, unchanged by this run**: automatic cron execution —
Run now passes `force: true` and drops the dueness clause, so a real tick at
23:00 Europe/London is the only thing that settles it. And reuse of this stored
internal function by a LATER job (hop 2) is its own follow-up, not bought here.

**And the run pushed its own results file to main** (`37736708`), existing
`lane-sweep.yml` behaviour; it started no deploy.




### THE ADDON KNOWS WHAT THE SITE IS, AND ITS OWN STEPS TELL EACH OTHER (2026-09-17)

Owner: *"We're keeping the work on the entire ADDON path until that milestone is
complete. Edit comes afterwards."* Milestone 1, frontend context and hand-offs,
addon only — and the instruction that shaped every case: ***"Demonstrate those
through the real addon route with mocked external dependencies, checking
designer inputs, generated directives, stored results, and the response."***

**1. A PAGE THIS SAME CHANGE IS ADDING IS A REAL DESTINATION.** The backend
tiers have crossed between kinds since 2026-09-14 — a job may name a function
designed one call earlier — and the frontend never did. `page` runs before
`component`, `qr` and `three` in `ADD_KINDS`, so the owner's two reproductions
had ONE cause. **MEASURED at the cleaner before the fix:**

| ask | before |
|---|---|
| component on a new `/gallery`, one-page site | **ACCEPTED, page `/`** |
| component on a new `/gallery`, three-page site | refused `no-page` |
| QR pointing at a new `/gallery`, either | refused `no-such-page` |

**The first is the silent substitution the owner named**: the section was built
on the FRONT page and the customer was told it had been added.
`site.planned` carries `{path, name}`; **`going = have ∪ planned` is the ONE
list** both "where may this go" and "where may a code point" are answered from,
so they cannot come apart. `siteNote` prints the planned pages on their OWN
line, saying they do not exist yet — folding them into "Its pages are:" would
send a designer looking for source to copy that has not been written.
**`SPEC_OF_KIND` HAS NO `page` ENTRY AND MUST NOT GAIN ONE** — it names the four
SCHEMA tiers and `proposedSpec` writes into a spec list, which a page is not.

**AND THE ONE-PAGE SHORTCUT NOW READS THE POST-CHANGE SITE.** Its whole
justification is *"a site with exactly one page has exactly one place a
component can go"*, which expires the instant this same change adds a second —
the recorded *"a rule true because of a layer below it expires when that layer
moves"*, where the layer is this message's own earlier designer. **A NAMED
route also resolves to that route or to nothing**, where it used to fall through
to the shortcut: two guards asserted THAT as correct and were re-anchored.

**2. AN EXISTING COMPONENT IS NOT ONE TO BUILD.** `look.tsx` is the cumulative
DECLARATION list — a name, a sentence and a props line, true of a component
nobody ever wrote and kept for ever either way — and the page writer was handed
it under *"the kit does not have these and this site needs them, so you write
them"*. So a page importing a component this platform wrote months ago was
edited by a model that had never seen it, and `mergeParts` replaced the real
file by name: **a rewrite of working code from its own summary, with nothing
anywhere saying it had happened.**

- **`partsSent` DECIDES ONCE AND IS READ TWICE.** `{shown, withheld, names}`
  over `source/<slug>/parts.json`. `partsDirective` shows the source of what
  fits and **NAMES what does not, with an instruction** — a withheld component
  said nothing about is indistinguishable from one that does not exist, which
  is what makes a model write it again. `tsxDirective(tsx, names)` is filtered
  by **every** name the site has a file for, not only the shown ones, so no
  component is in both blocks and none is missing from both.
- **TWO BOUNDS, NOT ONE**: `MAX_PART_CHARS` **12,000** for one component and
  `MAX_PARTS_CHARS` **36,000** for the block, sized against `MAX_PRIOR_CHARS`
  (90,000, the site's own PAGE source, which keeps the larger share). In stored
  order and **never sorted by size**, or which component is shown would depend
  on the others and an unrelated addition could withdraw one silently.
- **THE WALL READS THE SAME OBJECT.** A returned component may replace one the
  writer was shown and may not replace one it was not; the refusal rides
  `keptParts` and `keptPartsNote` — composed server-side and printed VERBATIM,
  `coverNote`'s rule, because the server is the only thing that knows which
  sources fitted.
- **AND THE WALL'S OBVIOUS SECOND HALF WAS DEAD BY CONSTRUCTION.** *"…unless it
  was shown"* reads as a belt and cannot ever fire: `partsSent` sends each
  component down exactly one branch and dedupes names first, so `shown` and
  `withheld` are disjoint — **MEASURED over five shapes, including a name given
  twice at both sizes and a list that overruns the block bound: zero overlap.**
  Deleted rather than kept.

**3. THE LOOK IT IS WEARING, AND THE SIGNATURES IT NEEDS.** Every add rule
tells the designer to keep the site's design system and nothing in its inputs
said what that system IS. The page writer gets the theme and the site's own
stylesheet **as ALREADY APPLIED** — it is appended last at build time so it
wins on source order, and a model shown one with no such sentence restates its
rules inline, where editing the stylesheet can no longer reach them; a sheet
over `MAX_STYLE_CHARS` (**16,000**) is cut and **the cut is announced**. The
designers get the theme by NAME, which is `siteNote`'s own standing rule.
`plan.components` gains the kit modules the pages being edited already import.

**⚠ AND ONE WIRING DEFECT IN MY OWN CHANGE, caught by running the case against
the pre-change product rather than by reading it.** `pageComponents` answers
EXPORT names (`SeatMap`) and `siteComponentApi` is keyed on MODULE names
(`seat-map`) — **measured, handing it the export names answers `""` for every
one**, a value computed and never forwarded, which from outside is
indistinguishable from the site importing nothing. One walk answers both now
(`modules`), so a second parser of import lines cannot drift from it. **The
first draft of that case used `accordion` and `card`, and BOTH are among the 72
standard shadcn primitives whose props the signature scan cannot read** — so
every assertion passed with the fix reverted. A vacuous assertion, found by the
red-check and not by reading.

**`siteNote` SEPARATES CURRENT IMPLEMENTATION FROM PLAN IN THREE PLACES NOW**
(owner: *"Clearly separate current implementation from the original design
plan"*): live pages against planned ones, components that have a FILE against
declarations nothing has written, and the theme/stylesheet line. **`null` is a
third state throughout** — a parts read that FAILED keeps the old sentence,
because cannot-tell must never read as *"this site has no components of its
own"*.

**Guards**: `test/addon-route.test.mjs` **66 → 73**, every case driven through
`POST /api/site/<slug>/addon` and asserted on the designer's real request, the
generated directive, the stored result and the reply — **and every one proved
RED against the pre-change product first, one fix reverted at a time**, which
is what caught the vacuous assertion and the wiring defect above.
`site-add` **37 → 39**, `page-gen` **246 → 249**, plus assertions inside
`copy-design` and `requirement-coverage`. The fixture gains `parts`, `css`,
`storedPages`, `writtenParts` and `pagePrompt` — **by TOOL NAME, never by the
property key**, since the writer's tool answers `pages` and the page DESIGNER
answers `page`.

**Six older guards re-anchored, not appeased**, each naming the property that
moved: two `site-add` expectations that **asserted the defect as correct** (a
NAMED route swallowed by the one-page shortcut, for a component and for a QR);
the page call's plan (pinned to `aFold.components`, now asserted as both
sources reaching it); the parts merge (pinned to `aValid.parts`, now the
property plus the wall); `pageComponents`' shape; and one route fixture that
placed a section on a page its site did not have — **given the page rather than
the destination quietly changed**, since a fixture change that appeases a check
without asserting what changed is the same thing as deleting the check.

**Sweep: 36 mutants, 36 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-frontend-context.json`, over
`worker.js`, `builder/page-gen.mjs`, `builder/site-add.mjs`,
`builder/site-addon.mjs` and `public/chat.js`, against 17 test files — a narrow
list can only produce a false SURVIVOR, never a false kill). **Three passes.**
Pass 1 read 25/11 and **not one survivor was the product's**: ten were gaps in
the new guards and the eleventh was the dead wall above. Pass 2 read 34/2 and
**both of those were INERT, measured rather than hunted** — the stylesheet's
code-block ternary (`cut ? sheet.slice(0, N) : sheet` cannot differ from
`sheet.slice(0, N)`, since the slice is already a no-op at or under N; five
shapes, zero bytes different) and the route's three-state parts read, which had
a module case and no route case. Both were replaced with observable mutants of
the same property.

**Suite 6,761** — 6,749 + 7 (`addon-route`) + 2 (`site-add`) + 3 (`page-gen`),
and the arithmetic closes exactly.

**CI HAS READ IT: `unit tests` run 2659 on `4e4e2289`, green (2026-09-17
06:11:15→06:13:15Z, the suite step 109 s) — `# tests 6761 / # pass 6757 /
# fail 0 / # skipped 4`**, against local `6761 / 6761 / 0 / 0`. **The four are
named rather than assumed**: the privilege-drop case (needs root and an
unprivileged user), two RTL cases (template deps not installed) and
`site-searchpath`'s baseline-commit case (a shallow checkout holds one commit).
Three recorded environment skips plus the one this branch's neighbour added —
which is why the number to carry is the TOTAL.

**AND `site build` RUN 1164 IS GREEN ON THE SAME SHA (2026-09-17
06:11:15→06:30:24Z, all twenty steps): `site-build.mjs` 382 passed / 0
failed in 13m48s**, with kit-typecheck 4, contrast-cases 16, theme-seam 11,
theme-render 29, site-routing 14, site-runtime 47 beside it — every count
bounded to its own step window, 12 steps carrying a result and 0 before the
first marker. **It fired because `worker.js` and `builder/**` moved**, which is
that workflow's `paths` behaving; 1164 joins the 382 scan list.
**AND THAT STEP'S TAP MOVED, WHICH IS THE ARITHMETIC CLOSING ONE LAYER DOWN**:
the unit step (`page-gen` + `publish-pages`) reads `pass 393` against **390** on
runs 1162 and 1163 — exactly the three `page-gen` cases this round added, since
`test/page-gen.test.mjs` is in that step's own glob.
**The docs push that followed (`fb643a8d`) started `unit tests` 2660, green, and
NO `site build`** — two documents, which the `paths` filter does not cover.

**NOT MERGED AND NOT DEPLOYED, and no paid call was made** — the owner's
instruction for this round. Every measurement here is from driving the real
route against stubbed seams.

### …AND TWO GAPS IN IT, PLUS A THIRD THE FIRST REPRODUCTION FOUND (2026-09-17)

Owner, on the milestone: *"Component-source read failure bypasses the new
guard… Distinguish a successfully read empty inventory from an unreadable one.
Do not permit an unseen replacement because the inventory read failed. Use a
consistent source snapshot…"* and *"Planned-page dependencies need a final
check… One publish does not establish that both requested items exist."*

**1. THE ROUTE READ THE COMPONENT STORE TWICE, MINUTES APART, AND THE TWO COULD
DISAGREE.** Reproduced: the first read THREW, so `partsSent` got `null` — no
`shown`, no `withheld`, no names — the writer was shown no source AND handed the
stored DECLARATION under *"Components to build"*, and the wall had nothing to
refuse; the second read SUCCEEDED, so `mergeParts` replaced the real file with a
rewrite composed from a one-line description, with no `keptParts` and no
sentence. **`readSiteParts` answers `{ok, parts, why}`** — three states where
there was one `null` — and the route reads it ONCE: the same snapshot serves the
designers' note, the page prompt, the wall and the merge. `loadSiteParts` stays
as a thin wrapper so its five other callers are byte-identical.

**AND THE THIRD FINDING IS THE EXPENSIVE ONE: with BOTH reads failing,
`mergeParts(null, [one])` answers `[one]`** — every other component on the site
deleted, none of them named in the request, nothing anywhere saying so. Driven;
both survive byte-identical now. **The same shape is live on the EDIT path**
(`worker.js`'s `pStored` read) and is recorded in the backlog, not fixed here.

- **`ok: false` IS A REFUSAL, NOT AN EMPTY SITE.** While it is false nothing is
  offered to be built, every returned component is refused, and `parts.json` is
  not written at all — `null` leaves the spine to re-send the store's own copy,
  which is exactly what an addon that touched no component does.
- **A DIFFERENT REFUSAL NEEDS A DIFFERENT SENTENCE.** `keptPartsNote` tells the
  customer to ask for that one component on its own, which is advice about a
  SIZE BOUND and is wrong about a store that failed to read. `unseenPartsNote`
  says what happened and to ask again. Two functions, not one with a flag: the
  harder branch — a refusal with no name behind it — would be the one nobody
  reads. They are disjoint by construction, because `partsSent` answers empty
  lists when it cannot read.
- **AND A MISSING `parts.json` IS NOW HONESTLY EMPTY.** "There is no such
  object" is a read that SUCCEEDED, so the designer hears that `tide-chart` is
  declared and nothing has written it — which is what `look.tsx` means. The old
  guard asserted the conflation and was re-anchored, not appeased.

**2. A NEW QR CODE OUTLIVED THE PAGE IT OPENS.** `cleanAdd` admits a code
pointing at a page this same change is adding — correct, and correct *because
the two go out in one publish* — but **one publish is not proof the page
survived generation**. Reproduced: plan `/gallery`, have the writer return only
the home page, and the code was stored pointing at
`https://<site>/gallery`, published, `moved: ["qr"]`, and the only thing the
customer heard was that the page had not made it. **A QR is the one thing here
somebody PRINTS.**

`deadQrs` checks each code THIS change added whose destination is a route THIS
change planned and lost — before the bill and before the look is stored, which
is what makes a drop cost nothing and leave nothing behind (the container bakes
`/qr-<name>.svg` from what is stored when it compiles).

- **THE ORIGIN IS COMPARED, NOT JUST THE PATH**, so another site's URL at our
  path is never a candidate; and `route()` refuses a `tel:`/`WIFI:`/`mailto:`
  pathname, so a payload that is not a page cannot be read as one. A code the
  site already had is never touched, whatever it opens.
- **…AND IT IS KEPT WHEN A SHIPPED PAGE RENDERS IT.** `cleanAdd` takes `page`
  for exactly that, so the writer can put `SITE_QRS.gallery` on the home page
  and fail to write `/gallery`; dropping the code then takes the binding out
  from under a live page, which is the worse of the two and visible to every
  visitor rather than to whoever scans. Such a code is `stuck`: kept, on the
  wire as itself, and said in its own words.
- **`qrUnplaced` IS THE ONE READER of "does a page show this code"** — its own
  binding regex, inverted — so there is one copy of that correspondence.
- **THE MISSING-PAGE LIST MOVED ABOVE THE BILL and is now ONE computation with
  two readers.** `aMerge` is settled before either, so the answer is the same on
  both sides of the publish; what the move buys is a check that happens before
  anything of it is stored.

**MEDIA, VERIFIED RATHER THAN ASSUMED (the owner's correction: *"video-embed is
already offered through the component path… Verify rendering before deciding
prompt changes are necessary"*).** It is in `COMPONENT_MENU`, its signature
reaches the writer (`VideoEmbed(url: string, title?: string = "Video", ratio?:
string = "16/9")` through `siteComponentApi`), and **it RENDERS** — react-dom/
server over the real kit file: `youtube.com/watch`, `youtu.be`, `/embed/`,
`vimeo.com/N` and `vimeo.com/video/N` all produce a correct
`youtube-nocookie`/`player.vimeo?dnt=1` iframe with the asked-for
`aspect-ratio`, and two unparseable URLs produce the "Video unavailable" panel.
**No prompt change is needed.** One finding recorded and NOT fixed: only the
FALLBACK branch stamps `data-slot`, so a WORKING video is invisible to the
`data-slot` census and to the css lane, and only a broken one shows up.

**Guards**: `addon-route` **73 → 78** — both gaps and the third finding driven
end to end through `POST /api/site/<slug>/addon`, asserting the stored component
BYTES and the customer's own sentence, plus the recovery control (same site,
same ask, same rewrite, a read that works) and the two the owner asked to keep
(page + QR both arriving, and an older code untouched). `site-add` **39 → 42**,
`page-gen` **249 → 250**. **Every new case proved RED against the pre-change
product first**, by stashing the four product files and running against `HEAD`.

**Four older guards re-anchored, not appeased**: the merge's anchor became *"the
same snapshot the prompt and the wall were built from, and this key is read
exactly once"* (strictly stronger than the spelling it pinned); `partsSent`'s
shape gained its third state; `keptPartsNote`'s composer is read as a property
because an honest second composer moved the spelling; and the no-`parts.json`
expectation above.

**Sweep: 36 mutants, 36 killed, 0 survived, 0 never applied, 2 comment-only
controls survived.** Pass 1 read 33/3 and **not one survivor was the
product's**: one was a real gap in my own new guards (`aStoredParts =
aPartsRead.parts` — the designers' note then reads an EMPTY ARRAY as *"its
design declares these and nothing has written them"*, about a site whose store
we could not read: **cannot-tell as a value, in the one input a designer is told
to copy an existing component from**), and two were MEASURED inert and are
declared in the code rather than hunted. The filter's `return false` under
`unreadable` is belted by the merge's own `aPartsRead.ok` gate — driven through
the route with one read failing and with both, the reply and the stored bytes
are IDENTICAL; and `!base` in `opens` is belted by the origin comparison — 45
probes over every payload shape and four address shapes, zero differences. Both
became PAIR mutants. **And the second one's LABEL was wrong too**: it claimed to
read a `tel:` payload as a route, which is `route()`'s refusal and not that
line — *read what a mutant really does, not what it was meant to do.*

**Suite 6,770** — 6,761 + 5 + 3 + 1, and the arithmetic closes exactly.

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH** — the owner's instruction.

### A SITE TOO LARGE TO SHOW WHOLE KEEPS ITS CONTRACT, AND SAYS WHAT IT HID (2026-09-17)

Owner, after the two gaps closed: *"continue with large-site context."*

**MEASURED FIRST, AND THE MEASUREMENT IS WHY THIS IS THE PLATFORM'S FUTURE
RATHER THAN ITS PRESENT: over the 100-site corpus ZERO sites exceed
`MAX_PRIOR_CHARS` today** — the largest is 50,646 characters over 6 pages, the
mean page is 7,744, so the window holds about 11.6 of them. A site reaches the
wall by GROWING, one addon at a time, which is exactly what this path is for.

**THE DEFECT, REPRODUCED THROUGH THE ROUTE ON 17 REAL PAGES (181,258
characters).** Over the window `priorPagesBlock` fell through to a branch
written for a REVISE — page names and *"write them again in full"* — and on a
path where a returned page REPLACES the stored one that is the opposite
instruction. Everything this lane means went with the source: no *"RETURN ONLY
WHAT IS NEW OR CHANGED"*, no `remove` verb (whose own comment records that
answering a deletion by returning nothing is the revise habit, and that it is
what really happens when the sentence is missed), no byte-identical rule, no
*"a page you do not return is KEPT"*. And `ok: true` came back with an empty
`problems` and an empty `coverNote`: **nobody was told** — not the customer,
not the record, not the trace.

**THE CONTRACT IS UNCONDITIONAL NOW AND THE SOURCE IS WHAT GIVES.**
`priorPagesSent` is `partsSent`'s shape one layer over, for the same reason: a
bound that drops what it cannot carry has to NAME what it dropped, or the
reader concludes the site does not have it. A page named and not shown is told
it must not be returned, which is exactly what it is — returning it would
replace a file nobody saw, and `keptProse` would refuse the whole change for it.

- **`keep` IS THE PAGES THIS CHANGE IS ABOUT, then the HOME page.** Every add
  kind carries the route it lands on, so the route fills the list from the
  cleaned answers' own `page`/`path` fields and then adds `/` — the nav anchor
  almost every addon touches, and the prompt's own *"usually ONE new page, plus
  the page a visitor would look on to find it"*. Without it the selection is
  stored order, and the page a section was designed to land on is exactly the
  one worth the budget.
- **A PAGE TOO BIG FOR WHAT IS LEFT IS SKIPPED, NEVER A STOP** — `partsSent`'s
  rule, so one enormous page does not withhold four small ones behind it.
- **THE WIRE ORDER IS THE SITE'S, WHATEVER `keep` DID TO THE SELECTION.** Which
  pages are shown is a budget decision; the order they are read in is the
  site's own, and a model handed its pages in an order that moves per request
  reads that order as meaning something.
- **ONE SELECTION, TWO READERS — and a sweep survivor is how that was found.**
  The at-least-one fallback lived in the BLOCK, so the route's own reader did
  not know about it: on a one-page site over the window the prompt SHOWED the
  page and the reply reported it as unseen. It lives inside `priorPagesSent`
  now, and the block owning a second selection is its own mutant.
- **THE ONE-PAGE CASE IS A BELT, NOT A PATH, AND IT IS ASSERTED AS ONE.**
  `MAX_PAGE_CHARS` (48,000) is under `MAX_PRIOR_CHARS` (90,000), so no page
  `validatePages` admits can reach it; a page stored before those caps can. The
  guard asserts the inequality, so the day either moves it stops being a belt
  loudly.

**A REVISE STILL DEGRADES THE OLD WAY, AND THAT IS RIGHT.** There an unreturned
page is a DELETED page, so *"return only what changed"* really is unfollowable
without the source in hand. The two modes part company, which is the finding
rather than an omission.

**…AND TWO OLDER FINDINGS REACHED THE REPLY AND NOT THE RECORD.**
`requirementRecord` has been HANDED `missingPages` and `unknownKit` since each
was written and had neither in its destructure — measured:
`requirementRecord({…, missingPages: ["/gallery"]}).missingPages` answered
`undefined`. So a page that did not survive generation and a kit name that is
not in the kit were on the reply and absent from the thing anybody comes back
to. Both land now, beside this round's `unseenPages`. **A value computed and
never forwarded, in the record written to stop exactly that** — and nothing was
watching, which is why each is its own mutant.

**ALSO CHECKED AND NEEDING NO FIX, recorded rather than assumed**: `siteNote`
is bounded by its OWN SLICES — the route list at 24, the coming-pages list at
24, each page's kit at 40 and its parts at 20, read off the function — and the
component block already names what it withholds (8 shown, 12 withheld at 20
real components). **The page-source block was the one dishonest bound.**
**⚠ AND THE CHARACTER FIGURE THAT USED TO SIT HERE IS WITHDRAWN RATHER THAN
RESTATED.** The fix commit stamped *"926 at 1 page, 6,667 at 100"*; three
attempts to reproduce it measured three different things, because `siteNote`
takes `pages`, `tables` and `functions` as arrays of NAMES with `columns`,
`tableInfo` and `builtFrom` keyed beside them, and every hand-built fixture got
one of those shapes wrong — the first two answered 449 for BOTH sizes, which is
the list never being read at all. *Derive a fixture from its real producer*, met
three times in a row inside one check. The slice constants are the claim that
survives; the number is not being carried forward on the strength of a fixture
nobody can see.

**⚠ A FREE-IDENTIFIER MISS, CAUGHT BY DRIVING AND BY NOTHING ELSE.**
`fileOfRoute` was not imported into `worker.js`. `node --check` passes it and
every source guard finds its landmarks; the route threw at its first call.

**Guards**: `addon-route` 78 → 82 — the window driven end to end on real corpus
pages (the contract, shown + named equal to the whole site with no overlap, the
reply AND the stored record), `keep` proved against a target the budget
provably drops, the route's own reader pinned to the prompt, and an ordinary
site as the control, byte-identical. `requirement-coverage` 28, with the three
record fields asserted inside the case that already drives it.

**Sweep: 26 mutants, 26 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** — three passes, and **not one survivor at any point was the
product's**. Pass 1 read 11/14 and every one of the fourteen was a guard gap;
pass 2 read 25/1; pass 3 is the tally above. Two of those gaps are worth
keeping as rules:

- **⚠ THE `keep` CASE WAS VACUOUS AND EIGHT MUTANTS SURVIVED IT.** It targeted
  the LAST page in stored order, on the reasoning that stored order would drop
  it — and `priorPagesSent` SKIPS a page too big for the remainder rather than
  stopping, so the last page fits in what is left and was shown either way. It
  carries its own CONTROL now: the same site and the same change aimed at a
  page the budget takes anyway, which establishes BY MEASUREMENT which page is
  dropped, and only then is that page named.
- **⚠ AND THE FIXTURE COULD NOT TELL THE TWO PAGE ORDERS APART.** Both
  large-site fixtures had the home page at index 0, so the budget took it
  whatever `keep` said and three more mutants survived. The home page is LAST
  in both now, and the order assertion carries its own non-vacuity check.
- **⚠ THE LAST SURVIVOR WAS THE ROUTE'S OWN READER, AND WHICH CASE CAN SEE IT
  IS A MEASUREMENT.** `aUnseenPages` comes from `priorPagesSent` called AGAIN
  in the route, so it must ask with the SAME keep list the prompt was built
  from. On the FIRST case's fixture the two lists give byte-identical
  selections — nine pages, 89,403 characters, same order — because the home
  page is small and stored order reaches it anyway. On the SECOND's they differ
  by exactly one pair: named, the target `printer-quote` is shown and
  `printer-products` is withheld; unnamed, that pair swaps. So the assertion
  lives in the second case, with its own non-vacuity check that the prompt does
  not already name the target.

**Suite 6,774** — 6,770 + 4, and the four are all `addon-route`'s (78 → 81 for
the fix, 81 → 82 for pass 1's one-page closure). `requirement-coverage` stays
28: the record's three fields and pass 3's reader assertion are all inside
cases that already existed. **The counts are read out of git at each commit
rather than recalled** — the commit that shipped the fix stamped 6,773 from a
tree where `addon-route` was 81, and a number stamped before its last case is
this file's own recorded trap.

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH** — the owner's instruction.

### A COMBINED PAGE + PHOTOGRAPH ASK STOPS LYING AND LEAVES A FILLABLE SLOT (2026-09-17)

Owner, after the large-site work: *"then continue with … combined page + photo."*

*"Add a gallery page showing photos of our work"* picks `page` AND `photo`, and
`photo` is the one DISPATCHED kind, so it is set aside with a sentence — *"ask
for it on its own and I'll place it"* — and the page is built and published.
**Three things were wrong with that, every one MEASURED through
`POST /api/site/<slug>/addon` before anything was touched.** **Only the second
is specific to the pairing** — the other two are true of any addon that reaches
the page writer at all, which every `page` and `component` ask does — and all
three surface together here, which is why this combination is what found them.

**1. A BUDGET OF OURS WAS SAID AS A FACT ABOUT THE SITE.** The addon passes
`images: 0` — correct, and the rule `budgetFor` exists to keep, since a revise
re-buying pictures the owner already has was a ~94-credit bug. But
`imageDirective(0)` says *"PHOTOGRAPHS: none on this site"*, which is false on
every site that has any: measured on a site showing two bought photographs,
**identical sentence.** The two are separated now — the zero is stated as OURS
(*"this change buys none, so do not write any `@@IMG:@@` token"*) and what the
site has is a second sentence.

- **`shownPhotos(pages, slug)` IS THREE-STATE**, because `null` is "nobody
  looked" and the one thing that must not happen there is a claim either way:
  an unread source gets *"Leave every picture already on this site exactly as
  it is."* It counts DISTINCT urls under the site's own `/u/<slug>/` mark, so
  one photograph drawn in two bands is one, and another site's uploads are
  none of ours.
- **AND NAMING THEM IS ONLY HALF OF IT.** A page writer edits what it is SHOWN,
  and those photographs sit on a page this change hands it back in full — so the
  count without an instruction tells it they are there and nothing about leaving
  them alone. *"…and they stay exactly as they are — do not replace one, and do
  not remove it."* They cost real money and the owner already paid it.

**2. IT ASKED FOR THE ONE SLOT SHAPE ITS OWN NEXT STEP CANNOT FILL.** The zero
form said *"a `<SafeImage>` with NO src"*, and the picture rung — the rung this
hand-off promises — fills a slot by rewriting a `src` ATTRIBUTE. **MEASURED both
directions: a build whose token was not bought comes out of `applyImages` as
`src=""` and the picture rung sees ONE slot; the shape the addon asked for reads
as ZERO.** So the customer was told to ask again for a photograph the next rung
had nowhere to put. It asks for `src=""` now, and **an empty src and a missing
one render identically** — `safe-image.tsx` branches on `!src` — so it costs
nothing a visitor can see. Sent only when a photograph was really set aside, so
an addon nobody asked a picture of is byte-identical to what it was.

**3. THE CUSTOMER WAS NEVER TOLD THE NEW PAGE HAS EMPTY FRAMES.**
`countImageSlots` counts `@@IMG:` TOKENS, and its own comment says exactly why
it exists — *"a NEW page that wants one publishes with a placeholder and, until
this, said nothing about it"* — while this step's directive FORBIDS tokens. So
its answer here is *the number of tokens a model wrote against an instruction
not to*, which is 0 whenever the model obeys: `photoNote` has never once fired
on this path. **The defect that reader was written to close, one rung along from
where it was closed.**

**AND THE SAME IS TRUE OF THE EDIT PATH'S `page` RUNG, checked rather than
assumed** — it passes `images: 0` for the same reason and computes `pSlots` the
same way, so its `photos` is 0 on every obedient answer too. **Not fixed here**:
that rung tweaks an existing page rather than adding one, the owner's standing
instruction is to keep edit-path work separate, and it is recorded in the
backlog.

- **`newEmptySlots(before, after)` IS PER PAGE AND ONLY THE INCREASE.** An addon
  that edits the home page to add a link must not report the home page's
  EXISTING empty frames as new spaces — a true count of the wrong thing, which
  reads to a customer as *"your change made these"*.
- **NEGATIVE NEVER SUBTRACTS.** A change that FILLS a frame leaves fewer empty
  than it found, and letting that offset another page's new one reports zero
  over a site that really does have a new empty frame on it.
- **A `src`-LESS ELEMENT IS NOT A FRAME ANYBODY CAN FILL**, so it is not
  counted: promising it is promising a space the picture step cannot use.
- **THE TWO COUNTERS ARE DISJOINT BY ORDER, and that is what stops one frame
  being reported twice**: both are taken BEFORE `applyImages` sweeps, where a
  token is a non-empty `src` and therefore not an empty slot. A token a model
  wrote despite the ban is still counted, because the sweep makes the frame
  real.

**⚠ `!Array.isArray(n)` IN THE OBJECT BRANCH IS INERT, MEASURED AND DECLARED.**
The list branch above returns on EVERY path, its own `!shots.length` fallback
included, so no array can reach it — **ten array shapes, byte-identical with the
guard and with it cut.** Kept because the PAIR is what a reader needs (*arrays
are answered above* / *this branch is objects only*) and reordering the two
branches is a one-line edit that reads as tidying; the sweep drives the list
branch's own guard plus an observable mutant of the same line instead.

**Guards**: `addon-route` **82 → 85**, `site-images` **70 → 72**, `site-picture`
**52 → 53**, every case driven through the real route or the real module, and
every new assertion proved RED against the defect it forbids. **Suite 6,780** —
6,774 + 6, and the arithmetic closes exactly.

**Sweep: 24 mutants, 24 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-page-photo.json`, over `worker.js`,
`builder/site-images.mjs` and `builder/site-picture.mjs`, against 7 test files).
**Pass 1 read 23/18/5 and not one survivor was the product's** — four were gaps
in this change's own guards and the fifth was the inert belt above. Two of the
four are worth keeping as rules:

- **⚠ THE CLAMP HAD NO ARMING FIXTURE, AND THE CASE'S OWN COMMENT CLAIMED
  OTHERWISE.** It said *"a fill somewhere else must not offset a new one"* and
  filled the page's ONLY frame — which takes that page out of the `after` map
  entirely, so the loop never visits it and there is no negative to clamp.
  **MEASURED: the unclamped sum passes every other assertion in the case.** The
  shape that arms it keeps one empty frame while losing another. *A case that
  names the property it tests is not thereby testing it.*
- **⚠ AND NO FIXTURE HAD A PAGE GAIN A PICTURE**, so "count the empty frames"
  and "count every frame" were the same assertion throughout — measured, the
  whole case passes with `isEmptySlot` never asked. A new page with one filled
  frame and one empty is the discriminator.

The other two were walls nobody drove: the protection clause had **no reader
anywhere in the tree** (one occurrence, the source), and `countImageSlots` on
this path had no case writing a token.

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH** — the owner's instruction.

### THE HAND-OFF AND ITS ANSWER ARE ONE OUTCOME NOW (2026-09-16)

Owner, after run 50: *"Reconcile the original handoff with the receiving
designer's response using an explicit requirement identity… Do not match prose,
clear every requirement owned by that step, or let configuration imply delivered
behavior."*

**THE IDENTITY IS OURS AND THE ECHO IS THE MODEL'S.** `cleanRequirements`
stamps `<step>#<position>` on every entry it keeps — deterministic, unique by
the step owning its prefix, and stamped only when the owner is known.
`requirementBrief` prints each handed need as `[function#0] …` and says to copy
the id back; `REQUIREMENT_ITEM` gains **`answers`**, kept for `covered` only.
`reconcileHandoffs` joins on that id and on nothing else.

**FOUR CONDITIONS, EACH ONE OF THE OWNER'S:** the answering entry must NAME the
hand-off (never "this step ran", which would clear every requirement the step
owns); it must be `covered` (a step SAYING it could not must not settle what it
was asked for — and the cleaner drops `answers` from an `unsupported` entry as
the belt); its own implementation must have been **found** (or an unknown
launders into a configured through a claim nobody could check); and the result
is **CAPPED at `configured`** — even a `delivered` answer hands the hand-off
`configured`, because a hand-off is evidence about what was SET UP.

**BOTH ENTRIES SURVIVE FOR DIAGNOSIS** and carry `reconciledBy`,
`reconciledItem`, `reconciledKind`; it is the CUSTOMER NOTE that collapses them,
so one need is said once. **ADDITIVE AND FAIL-CLOSED**: no id, no echo, a stray
echo, or an older caller reconciles nothing and reads exactly as it did before.

**RUN 50'S CASE, DRIVEN**: the hand-off goes `unknown` → `configured`, linked to
`job#0` → `nightly_booking_count`, and the need appears **once** in the customer
sentence. **THE CONTROL**: two distinct needs handed to one step with only the
first answered — the second stays `unknown` and is still said.

**AND THE JOB CLAUSE CARRIES THE OWNER'S OWN MEANING** (*"Scheduled nightly at
23:00 Europe/London. Automatic execution has not yet been verified."*). For
every other kind "I can't confirm" is a general limit; for a job it is one
specific thing, true of every job this platform has registered. **The zone is
NOT quoted** — a job's applied facts carry `everyMinutes` and `at` and no
timezone, and a clause quoting one would state a fact this function cannot see.

### WHICH FUNCTION THE JOB RUNS IS READABLE (2026-09-16)

Owner: *"An identical count is not proof of which function was called."*
`GET /api/site/<slug>/jobs` answered the schedule and never the reference, so
the one thing a job IS — a function on a timer — could not be read back. **Run
50's job and its function shared a name**, which is what made the omission
invisible: the line looked complete and was ambiguous. The route answers `fn`
**off the SPEC, where `runJob` reads it**, so it reports the reference the
runner would really call rather than a second copy; empty for a row that lost
it, because that is a job which can never run. The harness prints
`runs <fn>()` — or **`(NO FUNCTION)`** — on every row.

**Guards**: `requirement-coverage` **22 → 26**, `addon-sweep` **39 → 40**. Every
new assertion proved RED against the defect it forbids. **Two of those probes
survived first and both were gaps in my own cases**: the no-echo control took
`reconcileHandoffs`'s early return, so a prose fallback inside the join was
never reached (a second, echoing pair arms it now); and the unverified-answer
fixture was `state: "unknown"` AND `implementation: "absent"`, two reasons to
skip, so cutting the implementation test changed nothing — one reason at a time,
with a control proving the same entry DOES reconcile when its implementation is
found. Suite **6,703** — 6,698 + 5, closing exactly.

**NOT YET DEPLOYED.** This changes `worker.js` and `builder/`, so the merge will
roll the container and the 15–20 minute hold will apply — unlike the last one.

### …AND TWO DEFECTS IN IT, BOTH REPRODUCED BEFORE AND AFTER (2026-09-16)

Owner: *"1. …The elapsed-interval gate makes Run now postpone and shift the
nightly schedule. Correct the manual-run/calendar interaction so a manual
execution does not move the requested nightly occurrence… 2. `reconcileHandoffs`
overwrites a blocked requirement when an answering entry names a different
successfully applied job. Preserve known dependency failures… an echoed ID alone
cannot override contradictory application evidence."* Plus: ***"These are
targeted fixes, not a reporting redesign. Show the focused reproductions before
and after."***

#### 1. A MANUAL RUN MOVED THE NIGHTLY OCCURRENCE

**REPRODUCED against the deployed `dueJobs`, on run 50's own row** —
`last_run 2026-09-16T19:29:36.345Z` (the stamp "Run now" left), `everyMinutes
1440`, `at "23:00"`, `tz "Europe/London"`:

```
BEFORE   2026-09-16T22:00:00Z  not due     ← the occurrence the customer asked for
         2026-09-16T22:02:00Z  not due
         2026-09-17T19:30:00Z  DUE         ← half past seven, the time of the press
AFTER    2026-09-16T22:00:00Z  DUE
         2026-09-16T22:02:00Z  DUE
         …fires at 22:00:05 → not due at 22:02, 23:59 or next-day 19:30
         2026-09-17T22:00:00Z  DUE
```

**THE ELAPSED TEST MEASURED 24 HOURS FROM WHENEVER THE JOB LAST RAN**, so one
press slid the whole schedule to the hour of the press — and slid it again on
every press after that. The customer asked for eleven at night and would have
got half past seven in the evening, for ever.

**FOR A DAILY-OR-FASTER CLOCK-TIME JOB THE OCCURRENCE GATE IS THE WHOLE RULE,
AND IT ALREADY CARRIES THE DUPLICATE PROTECTION.** `anchor >= due` refuses a job
that has run since the latest occurrence, **whatever ran it** — a cron tick, a
press, a resumed consumer. At `mins <= 1440` there is exactly one occurrence a
day, so *has this occurrence been served* is a complete question and elapsed time
adds nothing but the drift.

**SLOWER THAN DAILY KEEPS THE ELAPSED TEST, UNCHANGED AND DELIBERATELY** — a
weekly 09:00 has to skip six occurrences and the interval is what does that.
**Measuring it to the OCCURRENCE instead of to `now` was tried and is WORSE**: a
run that landed late (09:05 on a busy tick) then fails its own next occurrence by
five minutes and slips a whole day, where measuring to `now` slips it by minutes
within the same day. That alternative is one of the sweep's mutants.

**WHAT THIS DOES NOT FIX, STATED IN THE CODE**: a manual run still perturbs a job
**slower than daily** — it becomes the anchor and the next occurrence can fall
short of the interval. Fixing that needs the last SCHEDULED occurrence stored
apart from `last_run`, which is a migration; this change leaves that case byte
for byte as it was.

**AND AN OLDER GUARD ASSERTED THE DEFECT AS CORRECT — RE-ANCHORED, NOT
APPEASED.** `test/site-jobs.test.mjs` read
`assert.equal(due(row({last_run: day2 08:02Z}), day3 08:01Z), false, "ran a
minute early — the interval is not kept")`: a run that landed two minutes LATE
pushing the next morning's firing two minutes back, pinned as the property. It
asserts the calendar property now (that same row IS due at day 3 08:01Z), with
the *before its own time* half added beside it (day 3 07:59Z, still false) so
nothing early slips through. **Proved red against the pre-fix gate and green
after.**

#### 2. AN ECHOED ID OVERWROTE A KNOWN DEPENDENCY FAILURE

**REPRODUCED**: a hand-off naming a job the database REFUSED (`blocked`,
`the broken_job it needs could not be created`) and an answering `covered` entry
naming a DIFFERENT job that applied, echoing the id.

```
BEFORE   hand-off state `configured`, reconciled by job#0 → good_job
         the customer heard "Scheduled as you asked: The nightly reminder goes out."
AFTER    hand-off state `blocked`
         the customer hears only "waiting on another part of the same change
         that didn't work… the broken_job it needs could not be created"
         run 50's unnamed hand-off still reconciles — `configured`, said once
```

**THE ID SAYS WHICH REQUEST IS BEING ANSWERED; IT SAYS NOTHING ABOUT WHETHER THE
ANSWER IS TRUE.** Three walls keep those apart, and each is its own question:

1. **A KNOWN PROBLEM IS NEVER OVERWRITTEN.** `blocked`, `failed` and `missing`
   each rest on evidence about the APPLICATION — a dependency the database
   refused, a step that failed, a thing this layer looked for and did not find.
   Reconciliation may resolve an UNCERTAINTY; it may not resolve a finding.
2. **THE ANSWER MUST COME FROM THE STEP THE REQUEST WAS ADDRESSED TO.** An
   `elsewhere` entry names its step; an echo from any other step is a different
   call answering a question it was never asked.
3. **AND IF THE REQUEST NAMED ITS OWN THING, THE ANSWER MUST BE THAT THING** —
   `kind` AND name, which is the `{kind, name}` identity this file already
   records, met one function later. `referenceOf` answers `null` when the
   hand-off named nothing, **which is run 50's legitimate case and stays
   reconcilable**: the customer named a behaviour and neither designer named an
   artifact for it.

**REFUSING TO RECONCILE IS ONLY HALF THE FIX, and the other half is what the
reproduction found.** The answering entry was still `configured`, still carried
the same need in its own words, and still reached the prose — so one need came
back as *"waiting on another part that didn't work: the nightly reminder goes
out"* **and** *"Scheduled as you asked: the nightly reminder goes out"*, two
opposite sentences, **and the worse reading is the reassuring one**. An answer
whose request carries a finding is silent in the note now. **KEYED BY THE ECHOED
ID, never by the need text** — matching prose here would be the thing the
reconciliation itself is forbidden to do, arriving through the back door.
**ONLY OVER A PROBLEM STATE**: a mismatch with no finding behind it (the wrong
step, or a reference naming something else) leaves both entries speaking, which
is exactly what they did before any of this existed. **Both entries stay in the
RECORD** with `overruledBy` / `overruledAs`.

**Guards**: `test/job-delivery.test.mjs` **11 → 13** (the owner's exact sequence
end to end, and the control that a job slower than daily keeps its interval
unchanged); `test/requirement-coverage.test.mjs` **26 → 28** (the blocked
overwrite with its `overruledBy` mark, an ISOLATING case for the state guard — a
hand-off naming nothing, to a step that failed, where `referenceOf` is `null` and
the reference check cannot stand in — and the wrong-step / wrong-item refusals
with run 50's unnamed control, plus the KIND COLLISION and the arming pair the
sweep asked for); `test/site-jobs.test.mjs` **46**, re-anchored in place.
**Suite 6,707** — 6,703 + 2 + 2, and the arithmetic closes exactly, measured per
file on both trees rather than derived.

**Sweep: 16 mutants, 16 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/job-calendar.json`, over `site-jobs.mjs`
and `builder/site-requirements.mjs`). Pass 1 killed 14 with two survivors and
**both were gaps in my own new guards, not the product's**:

- **THE REFERENCE MATCHED BY NAME ALONE.** No case drove a kind collision, which
  is this file's own `{kind, name}` finding one function later — and `bookings`
  is the commonest name on this platform to be a table AND the thing a job is
  named after. Closed with a pair whose applied lists are IDENTICAL and where
  only the answer's own `kind` moves, so the control is about the kind and not
  about which items exist.
- **THE OVERRULE ARMED BY A BLOCKED HAND-OFF NOBODY ANSWERED.** The silencing
  exists for an answer that WOULD have reconciled and was refused over a finding;
  an entry that could never have reconciled is an independent `missing` finding
  about its OWN item, and losing it costs the customer a "Still to do" they can
  act on. `answering` is what tells those apart, so the arming reads it — **and
  that mutant's first LABEL was wrong** (it claimed to key the overrule on the
  need's prose and actually changed the precondition), corrected by reading what
  the replacement really does rather than what it was meant to do.
- **AND THAT SECOND GUARD'S FIRST FIXTURE MINTED BOTH HAND-OFF IDS AS
  `function#0`**, because the id is `<owner>#<position in THIS list>` and the
  fixture called `cleanRequirements` once per entry. Every echo was a stray one
  and the case proved nothing. **A fixture that mints its ids the way the product
  does is the only one whose echoes mean anything** — the recorded *derive a
  fixture from its real producer*, in the one field the whole join runs on.

**CI HAS READ BOTH, ON THE BRANCH TIP `51f61f40`.** `unit tests` run **2647**,
green (2026-09-16 21:26:04→21:28:01Z) — `# tests 6707 / # pass 6703 / # fail 0 /
# skipped 4`, against local `6707 / 6707 / 0 / 0`; the four are the three
recorded environment skips plus `site-searchpath`'s baseline-commit case, and
**the TOTAL is what matches**. And `site build` run **1160** (21:26:04→21:44:12Z)
green, `site-build.mjs` **382 passed / 0 failed**, with kit-typecheck 4,
contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14, site-runtime
47 beside it — every count read out of that job's own log, bounded to its own
step file. **It fired because `site-jobs.mjs` is in that workflow's `paths`**,
which is the point: this change moves product code the container carries.
**1160 joins the `382` scan list** — derive the total with the scan, never by
taking the next ordinal in a sentence.

**NOT MERGED AND NOT DEPLOYED.** The cron observation is PAUSED at the owner's
word. Automatic execution stays **explicitly unverified**: run 50's job has only
ever been fired by hand.

#### THE OBSERVATION BASELINE, AND WHY IT NEEDS THE DEPLOY

**The row as run 50 left it**: `nightly_booking_count()` · `at 23:00
Europe/London` · `everyMinutes 1440` · `last_run 2026-09-16T19:29:36.345Z` ·
`lastResult "Done — counted 3 bookings."`

**Both selectors driven against that exact row** (the deployed one read out of
git at `origin/main`, not recalled):

| code | first selects it | London |
|---|---|---|
| deployed (`origin/main`) | **2026-09-17T19:29:06Z** | 20:29 — the drift |
| the fix | **2026-09-16T22:00:00Z** | 23:00 — the asked-for time |

**The deployed number is `last_run + 24h − 30s` and the arithmetic closes to the
millisecond**, which is what makes it a prediction rather than an observation
waiting to be explained.

**⚠ AND WHAT THAT SECOND ROW MEANS FOR A DEPLOY IS NOT "IT WAITS FOR 23:00" —
CORRECTED 2026-09-17 (owner: *"with an unserved previous occurrence, deploying
during the day can make the job immediately eligible as overdue"*).** The 16th's
22:00Z occurrence is in the PAST and was never served — Run now stamped
19:29:36Z, two and a half hours before it, and the deployed selector has not
come round — so the corrected rule finds an occurrence behind `now` with nothing
after it and the job is **due at the first tick after the deploy, whatever time
of day that is**. Measured at 2026-09-17T03:41Z on the real row: `lastDueAt`
answers `2026-09-16T22:00:00Z` and the anchor is `2026-09-16T19:29:36Z`, so the
gate opens.
**THE FIRST RUN AFTER A DAYTIME DEPLOY IS THEREFORE A CATCH-UP, NOT THE NIGHTLY
ONE, and only the second proves the time.** It then runs again that night: the
catch-up stamps `last_run` in the daytime, the 17th's own occurrence
(`2026-09-17T22:00:00Z`) is still ahead of it, and the gate opens a second time
at 23:00 London. Two runs on deploy day, both correct — one serving a missed
occurrence, one at the asked-for time — and reading the first as "the nightly
schedule fired" would be reading a catch-up as the thing under test.
**AND THE PREDICTION IS CONDITIONAL ON WHEN THE DEPLOY LANDS.** If it lands
after **2026-09-17T19:29:06Z** the DEPLOYED selector may have fired the job
first; `last_run` then sits past the 16th's occurrence, the catch-up is gone,
and the corrected rule waits for 22:00Z that night. So a deploy before ~19:29Z
and a deploy after it produce two different first observations, which is the
whole reason the baseline has to be READ rather than assumed.

**THE CORRECTED SCHEDULE CANNOT BECOME DUE UNTIL THIS IS DEPLOYED**, and a
WORKER deploy is enough: `dueJobs` runs in the Worker's cron handler, not in a
container, so the 15–20 minute container hold does not gate this particular
observation (the merge still rolls the container, because `builder/` moved).

**THE PANEL CANNOT BE READ FROM A SESSION** — `GET /api/site/<slug>/jobs` is
owner-gated and no `SUPABASE_*` or `OWNER_*` credential exists in this
environment, checked rather than assumed (the names were enumerated and their
lengths printed; nothing was). **Re-checked 2026-09-17 and the environment is
still empty**; the route answers **401** to an unauthenticated read, which is
the control that it is the gate and not the route. So *"read a fresh baseline"*
is the owner's read — the Jobs panel, or a `lane sweep` with `run_job` left at
`none`, which prints the row and presses nothing.

**WHAT CAN BE ESTABLISHED FROM HERE, AND IT IS WORTH HAVING BEFORE THE READ.**
`lane sweep` run **50 is still the latest** (asked of the Actions API, not
recalled), so nothing has pressed Run now again; and the deployed selector's
first selection, `2026-09-17T19:29:06Z`, is **still ahead** of the clock as this
is written (03:41Z). Both point at the row being exactly as run 50 left it —
which is a reason to expect a particular baseline, never a substitute for
reading one.

**AND A TIMESTAMP DOES NOT IDENTIFY AN INVOCATION** (the owner's own correction).
The row records the time and the result and nothing about what fired it. The one
honest statement available is *this session pressed nothing* — a fact about what
was done, not an inference from the row. A stamp within seconds of the due
instant is CONSISTENT WITH the cron and is not proof of it; and **a two-minute
cron is a cadence, not a deadline**, so a job that has not run by 22:02 has not
thereby established that nothing fired it.

### …AND THE OCCURRENCE RULE EXPOSED A DAYLIGHT-SAVING BUG UNDER IT (2026-09-17)

Owner, reviewing the two fixes above: *"The new daily occurrence rule exposes a
daylight-saving bug in `lastDueAt` … it uses the offset at 'now,' so its
calculated occurrence shifts when the clocks change. Correct that calculation
without restoring the elapsed-time gate that caused Run now to move the nightly
schedule."*

**REPRODUCED AGAINST THE COMMITTED SCHEDULER BEFORE ANYTHING WAS TOUCHED**, on
the owner's own row — `everyMinutes 1440`, `at "00:30"`, `tz "Europe/London"`,
`last_run "2026-10-24T23:30:05Z"`, which is 00:30:05 BST on the 25th and so has
SERVED that day's occurrence. London goes back at `2026-10-25T01:00:00Z`.

```
                  lastDueAt("00:30","Europe/London")        anchor 23:30:05Z
BEFORE  00:58:00Z  -> 2026-10-24T23:30:00Z   not due    ← correct
        01:00:00Z  -> 2026-10-25T00:30:00Z   DUE        ← the defect
        23:00:00Z  -> 2026-10-25T00:30:00Z   DUE        ← and all day
AFTER   00:58:00Z  -> 2026-10-24T23:30:00Z   not due
        01:00:00Z  -> 2026-10-24T23:30:00Z   not due
        23:00:00Z  -> 2026-10-24T23:30:00Z   not due
        26th 00:29Z                          not due
        26th 00:30Z                          DUE        ← the following day, 25 hours on
```

**`2026-10-25T00:30:00Z` IS 01:30 BST, WHICH IS NOT A 00:30 READING AT ALL** —
that is the whole of the defect. The offset was read at `now`, so the instant
the zone moved, "today's 00:30" was computed under the new offset and landed an
hour past the one already served. **And the owner's two readings only sample
it**: the wrong occurrence stood for the rest of that local day, so every tick
from 01:00Z to the next day's occurrence would have run the job.

**THE DOC COMMENT CONCEDED THE APPROXIMATION AND NAMED THE RULE THAT COVERED
IT** — *"the interval rule that runs beside this in `dueJobs` means never
twice"* — which is exactly the rule the previous entry took off for daily jobs.
**A rule true because of a layer below it expires when that layer moves**, fifth
recorded instance, and the second in a row where the layer moved because we
moved it.

**THE FIX READS THE OFFSET AT THE TARGET MINUTE.** The two offsets in force a
day either side of the target are the only two that can apply to it, so
`wall - before` and `wall - after` are the only candidate instants; each is
VERIFIED by formatting it back, because only the read-back can tell a real
clock reading from one the zone skips over. Two local days are asked and the
latest answer at or before `now` wins — **two, and that is complete rather than
a sample**: an occurrence carries the local date it belongs to and `now`'s local
date is today, so yesterday's is always behind `now` and the day before it can
never be needed. **The elapsed-time gate is NOT restored.**

**THE TWO POLICIES, STATED IN THE CODE AND DRIVEN** (the owner's *"an explicit
policy for nonexistent or repeated local times"*):

| the local time | the occurrence | why |
|---|---|---|
| **repeats** (autumn) | the **FIRST** reading | one local day stays one run — `anchor >= due` then refuses the second, where taking the later one leaves the earlier reading unserved for an hour |
| **never happens** (spring) | the **LATER** candidate — the instant it would have had under the offset in force before the change | the job is NOT skipped; for a daily job it is exactly 24 h after yesterday's run, one hour later by the clock for that one day. A reminder that silently does not go out once a year is the failure nobody notices, and running after the time asked for is the safe side of running before it |

**AND THE ARITHMETIC IS THE ZONE'S, NOT AN HOUR'S — proven on a half-hour
transition.** `Australia/Lord_Howe` shifts by **thirty minutes**: a nonexistent
02:15 resolves to **02:45 local** and a repeated 01:45 has its two readings half
an hour apart. A fix that hardcoded an hour passes every London case and fails
both of those.

**THE MIRROR FAILURE IS FIXED BY THE SAME LINE, and it strands a run rather than
duplicating one**: a job at 01:30 London on the fall-back morning answered
`2026-10-24T01:30:00Z` at 01:00Z — a whole DAY back — because today's 01:30
computed under the new offset was still ahead of `now`. It answers
`2026-10-25T00:30:00Z`, half an hour ago.

**Guards**: `test/job-delivery.test.mjs` **13 → 14** (the owner's exact sequence,
the whole day it held, the following day running at the right minute, and the
mirror failure) and `test/site-jobs.test.mjs` **46 → 47** (both policies driven
at `lastDueAt` AND through `dueJobs`, the half-hour zone, **a time falling AFTER
the transition on the transition day** — the only shape that resolves under the
offset after the change, without which half of `occurrenceOn`'s candidate pair
is never the answer and could be deleted with the suite green — and ordinary
days on both sides of both transitions as the control). **Both proved RED
against the committed scheduler and green after; the other 59 cases in those two
files are green on BOTH trees**, which is what says the fix breaks nothing and
the cases are genuinely about it.

**Sweep: 25 mutants, 25 killed, 0 survived, 0 never applied, 3 comment-only
controls survived — and all nine new ones died on the FIRST pass.** The offset
read at `now` again (the reported defect, the committed arithmetic restored
verbatim); the repeat policy flipped to the later reading; the gap policy
flipped to the earlier candidate; the gap SKIPPED; the read-back verification
dropped; only the offset before the target tried; the offsets probed at the
target itself rather than a day either side; only today's local date asked; and
an occurrence still ahead of `now` accepted. Every anchor was checked to occur
exactly once before the run, and the tree was verified restored afterwards.

**ONE DECLARED BELT, measured rather than reasoned about.** `zoneOffsetAt`
floors its instant to the minute, and every caller now passes a whole minute
(`Date.UTC` at minute precision), so a mutant on that floor is INERT by
construction. It stays because the function's contract is "the offset at an
instant" and a sub-minute error in a scheduler is the kind nobody sees; it is
said here because a sweep cannot say it and the next session deletes what
nothing appears to need. The same applies to `best == null || x > best`: with
two days asked in calendar order, "the latest at or before `now`" and "the first
found" cannot differ, and the comment says so.

**MAIN MERGED INTO THE CANDIDATE** (owner: *"The branch was nine commits behind
main when reviewed"*). Nine commits, the `agent-builder` automations work plus
`agent-store.mjs`, `public/`, guards and documents — **no product-code overlap
with this branch at all**, so the merge cannot change what the sweep proved:
the only two files both sides touch are `CLAUDE.md` and `docs/owner-notes.md`,
and both merged clean with each side's sections checked present afterwards.

**SUITE 6,749 ON THE MERGED TREE, AND THE ARITHMETIC CLOSES ON THREE MEASURED
NUMBERS RATHER THAN TWO.** The merge base is 6,703; this branch measured
**6,709** (6,703 + round 13's 4 + this round's 2) and `origin/main` measured
**6,743** in a detached worktree at its own tip — **which is the number main's
own CLAUDE.md stamps, so that is two independent measurements agreeing** — and
6,703 + 40 + 6 = **6,749**, measured on the merged tree. **The worktree run
reads 1 fail and 2 skips a repo-root run does not**, and it was identified
rather than glossed: `render-sandbox`'s *"THE DROP IS PROVEN BY A REFUSED
WRITE"*, which is about writing outside the repository root and is the recorded
environment case. The TOTAL is what carries across.

**CI HAS READ BOTH, ON THE MERGED TIP `91fec70a`.** `unit tests` run **2655**,
green (2026-09-17 03:49:22→03:51:22Z) — `# tests 6749 / # pass 6745 / # fail 0 /
# skipped 4`, against local `6749 / 6749 / 0 / 0`; the four are the three
recorded environment skips plus `site-searchpath`'s baseline-commit case, and
**the TOTAL is what matches**. Run **2656** is green on the docs-only tip
`6c55bc57`, and that push started **no** `site build` — `paths` covers neither
document, which is the filter behaving.

**AND `site build` RAN TWICE ON THIS BRANCH, BOTH GREEN, BOTH READ — 1162 IS
THE MERGE COMMIT ITSELF, which is the stronger of the two.** 1163 is a
comment-only child of it, so 1162 covers the merged tree directly rather than by
the ancestor rule. Both fired because **`site-jobs.mjs` is in that workflow's
`paths`** — this change moves product code the container carries. **Both join
the `382` scan list.**

| run | sha | all twenty steps | `site-build.mjs` |
|---|---|---|---|
| **1162** | `75e5f9a9` (the merge) | green | **382 passed / 0 failed**, 17m38s |
| **1163** | `91fec70a` | green | **382 passed / 0 failed**, 14m19s |

**Every other count is identical across the two**: kit-typecheck 4,
contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14, site-runtime
47, and the unit step's TAP `pass 390 / fail 0`. **The two harness timings differ
by 3m19s on trees that differ by a COMMENT** — the runner decides, exactly as the
image-step band records, and no inference from the diff to the duration is
available in either direction.

- **⚠ AND THE `##[group]` BOUNDING DOES ATTACH — the run-1152 note said it does
  not, and what was wrong was WHERE the window is drawn.** GitHub wraps only a
  step's COMMAND ECHO in the group; the step's OUTPUT follows after
  `##[endgroup]`, so reading *inside* the groups finds **zero** counts and reads
  as "this log format has no groups". The honest window is landmark to
  landmark — one `##[group]Run …` marker to the NEXT one — which is this file's
  own windowing rule, met on a log instead of on source. Measured on both runs:
  every result inside the window of the step that produced it, and **0 before
  the first marker**. So attribution is bounded here rather than read in step
  order, which is what 1152 had to settle for.
- **A RESULT COMES IN THREE SHAPES AND ONLY SEVEN OF THE TWELVE TEST STEPS USE
  THE NUMBER.** `kit-render`, `kit-a11y`, `kit-effects` and `kit-paint` end in
  **`all passed`** with no count at all, and the unit step (`page-gen` +
  `publish-pages`) prints **TAP**. **A census that counts only `N passed` lines
  finds seven results and silently reports the other five as absent** — the
  recorded "a negative assertion must prove its observer is alive", in the
  reader for it. Ask for all three forms, or say which steps the number does not
  cover. (The remaining eight of the twenty are setup: checkout, setup-node, two
  `npm ci`s, the two playwright steps and the artifact upload.)
- **The two `##[error]` lines in the log are the harness's own fixtures**, both
  inside the `site-build.mjs` window: `[build-service] typecheck failed,
  shipping anyway`, each followed immediately by its own `ok` line (*"A TYPE
  ERROR NO LONGER STOPS THE SITE"*, *"a site with one bad page still reports the
  type error"*). GitHub's renderer stamps any line containing `error TS…`; the
  step is 382/0 and the job is green. **A red-looking line in a green job is
  worth naming rather than glossing** — it is the recorded "the typecheck
  REPORTS; only `vite build` refuses", visible in CI.

**NOT MERGED TO MAIN AND NOT DEPLOYED** — the owner's instruction for this round,
as for the last four. No paid call was made and no demo site was touched.

### A DEPENDENCY IS COMPLETED OR WITHHELD, NEVER WARNED ABOUT — AND A PAGE HAS ONE IDENTITY (2026-09-17)

Owner, on the two rounds above: *"Remove the exception that publishes a newly
added QR pointing to a missing planned page merely because a generated page
renders it… A warning does not complete the dependency."* And: *"Fix large-site
selection using the actual persisted page format… Match page identities
consistently across stored source, selection, generation and merging."*

**BOTH REPRODUCED THROUGH THE REAL ROUTE BEFORE ANYTHING WAS TOUCHED**, and the
second one exactly as the owner gave it.

**1. THE `stuck` EXCEPTION IS GONE, AND THE DEPENDENT SET IS WITHHELD TOGETHER.**
The previous round kept a code a shipped page renders, reasoning that dropping it
takes `SITE_QRS.<name>` out from under that page. The reasoning is sound and the
conclusion was wrong: it published a printed thing that opens nothing beside a
sentence asking the customer please not to print it. Reproduced: `STORED QR:
[{"name":"gallery","points":"https://<site>/gallery"}]`, `moved: ["qr"]`, `ok:
true`. **The whole dependent set now goes together** — the code is dropped and
every page THIS CHANGE WROTE that renders it is withheld, an existing one going
out as its PREVIOUS version and an invented one not at all. Nothing breaks
because what ships already shipped: the binding is never deleted from a live
page, it is never introduced.

- **IT IS A FIXED POINT, NOT A PASS**, and that is not decoration: withholding an
  ADDED page takes its route away, which can kill a second code pointing at it,
  which withholds a third page. `MAX_QRS` is 6, so a chain that long is
  constructible. A CHANGED page does not break the chain — it reverts to a
  version the site is already serving, so its route stays.
- **RE-MERGED, NEVER PATCHED.** The route takes the withheld files out of what
  the writer RETURNED and asks `mergeAddonPages` again, because that function
  owns "a changed page keeps its change only if it carries a link to a route
  this change added" and a hand-edited answer satisfies none of it. `aMerge`
  became a `let` for this; **five older guards were anchored on the `const`**.
- **⚠ AND THE FIX REINTRODUCED THIS REPOSITORY'S OWN MOST EXPENSIVE CLASS UNTIL
  IT WAS MEASURED.** A home page carrying `<Link to="/posters">` for a withheld
  `/posters` published with that link intact — `TS2322` on the typecheck, a 404
  for whoever clicks it. `validatePages` owns that repair and its own comment
  records the history (a cap dropped `/account` and the two pages linking to it
  took the build down), so it is asked AGAIN over what survives: the link is
  rewritten to "/" and REPORTED. Measured both ways.
- **NOTHING LEFT TO PUBLISH IS A REFUSAL** — `qr-dependency`, 422, cost 0,
  nothing stored, both sentences — because a compile and a version for a site
  byte-identical to itself costs a build and moves nothing. Asked by
  `mergeAddonPages` itself rather than by counting.
- **TWO SENTENCES FOR TWO KINDS OF WITHHOLDING.** *"I've left / as it was"* is
  FALSE of a page this change invented, and a customer reading it would go
  looking for something that never existed.

**2. A PAGE HAS ONE IDENTITY, AND `keep` HAD NEVER MATCHED ANYTHING.**
`aKeepPages` built `"src/routes/" + fileOfRoute(r)` on a comment asserting *"that
is what `priorPages` really carries"*. **MEASURED through the validator: it is
not.** `cleanPath` strips the prefix, so `validatePages` answers `target.tsx` and
`saveSiteSource` keeps exactly that — every persisted path is bare, no keep entry
could ever match, and the large-site selection was stored order on every real
site. The owner's reproduction, driven: three valid ~40k pages, asking to change
`/target` showed `index.tsx` and `middle.tsx` and **withheld `target.tsx`**.
After: shown `index.tsx` and `target.tsx`, withheld `middle.tsx`.

- **`pageId` IS THE ONE DEFINITION AND IS ASKED OF BOTH SIDES.** The defect was
  not a wrong conversion; it was two spellings of one identity compared with
  `===`, which fails silently and reads as *"this site does not have that page"*.
  `keep` names ROUTES now and the route passes them straight through, which
  removes a conversion rather than fixing one.
- **⚠ AND THE FIXTURE WAS THE WHOLE REASON IT SURVIVED.** Every stored-page
  fixture in `test/addon-route.test.mjs` was `writtenPage`, whose path carries
  the prefix — so the guard's two sides agreed by accident. **MEASURED through
  the real `mergeAddonPages`: a prefixed stored page beside a bare returned one
  answers `added: ["index.tsx"]` and leaves BOTH files in the site**, where the
  real shapes answer `changed` and one. So every *"the site already has this
  page"* case here was exercising a duplicate ADD, and **`keptProse` — the wall
  that refuses an addition which lost the page's words — had never fired in any
  of them.** `storedPage` is validator-produced and `addedTo` is what an addon
  really returns; five route fixtures were re-anchored onto them and the wall
  now arms on every such case. `routeOf`'s own comment already records this exact
  trap costing the whole `page` edit layer.

**3. THE MERGE BOUNDARY ENFORCES IT, because wording does not.** Owner: *"Prompt
wording and keptProse do not establish that an unseen rewrite preserves
behavior."* Both halves exact — the prompt NAMES every withheld page and forbids
returning one, and `keptProse` asks only whether the WORDS survived, which a
rewrite that drops a form, a link or a hook passes cleanly. A returned file for a
withheld path is refused, the stored one kept, and **said** (`keptPages`,
`unseenPagesNote`): a withheld page dropped in silence is indistinguishable from
one the model never touched. **This is `partsSent`'s wall one layer over, for the
same reason in the same words** — the pages we could not SHOW are the pages we
cannot CHECK — and a change that was ONLY that rewrite refuses rather than
climbing to the ~25-credit revise.

**Guards**: `addon-route` **85 → 91** — the three QR withholding cases (the
narrow drop, the withheld page with an independent page shipping beside it, the
invented page, and the empty-change refusal), **THE LIFECYCLE** (validator-
produced pages, hop by hop: the validator strips the prefix → the selection finds
the target → the merge reports `changed` and not a second file), and the merge
boundary with its control. `site-add` **42** (the `stuck` case REPLACED by its
opposite, the other two re-anchored, plus the cascade and both sentences).
**Every new case was proved RED against the pre-change product** — six of them,
including two that had passed only because the fixture was prefixed on both
sides: `["index.tsx","middle.tsx"]` for the lifecycle and *"a page nobody was
shown was replaced by a rewrite of it"* for the boundary.

**Seven older guards re-anchored, not appeased**, each naming the property that
moved: `page-gen`'s partial-lane census (2 → 3, kept as a COUNT rather than
loosened to a floor — it is a census, and `>= 2` would let a deleted call site
pass); `publish-pages`' repair census (the subject is a lane validating what a
MODEL wrote, so the re-validation is told apart by what it is HANDED and censused
both ways); `requirement-coverage`'s HOP 6b (a third composer made the field an
array join, so the window is landmark-to-landmark rather than one line); the
three `site-addon` merge anchors and `add-second-one`'s merge-to-gate window
(`const` → `let`).

**Sweep: 43 mutants, 43 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-qr-and-identity.json`, over
`worker.js`, `builder/site-add.mjs`, `builder/page-gen.mjs` and
`builder/site-addon.mjs`, against 12 test files — a narrow list can only produce
a false SURVIVOR, never a false kill). **Pass 1 read 44/35/9 and NOT ONE
SURVIVOR WAS THE PRODUCT'S**: six were gaps in this change's own guards, two
were mutants of mine that measured INERT, and one was a wall nobody had driven.
Four are worth keeping as rules:

- **⚠ THE "REDUNDANT PAIR" WAS NOT ONE, AND MEASURING IT IS WHAT SAID SO.** Two
  survivors both cut a `pageId` on the keep side — the route's own
  (`aKeepPages.push(pageId(r))`) and the module's (`keep.map(pageId)`) — which
  reads exactly like the recorded *"two redundant defences cannot be killed one
  at a time"*. **Driven over four spellings against three ~40k pages, it is one
  wall and one absorbed line**: with the module's map, a prefixed file, a bare
  file, a mixed-case route and an exact route all select the same two pages;
  without it, only the already-exact route does and the other three fall back to
  stored order. So the ROUTE's call is what is absorbed and the MODULE's map is
  the wall — **guarded now, where nothing had ever asked it a question it could
  fail**, because every case anywhere hands `keep` an exact route. The module's
  own prose promised this (*"`routeOf` already tolerates either spelling"*) and
  that promise had no reader: this repository's own *"a wall nobody can drive is
  a wall nobody is guarding"*. The absorbed line is KEPT — it says the list holds
  page identities rather than raw model strings, which is what makes its
  `includes` a real de-duplication, and `aKeepPages` has no other consumer that
  could tell the two apart — and it is **declared absorbed in the code**, so the
  next sweep reads a survivor there as the record rather than as a gap.
- **⚠ AND A MUTANT WRITTEN AS A PAIR IS NOT A PAIR MUTANT.** The first repair
  appended the two halves as TWO spec entries, which is the inertness being fixed
  wearing a different hat; and `scripts/mutate.mjs` applies ONE `from`/`to` per
  entry against `m.files[0]`, so a genuine two-file pair cannot be expressed at
  all. **Read the runner before writing a mutant shape it has to support.**
- **`qrUnplaced` IS ASKED WITH THE WHOLE LIST, ONE PAGE AT A TIME** — never one
  code at a time — because its legacy `SITE_QR` arm is keyed on a code's INDEX,
  so a one-element list makes every code look like the first. MEASURED on a page
  carrying a bare `SITE_QR`: the real reading answers `["gallery"]` and the
  one-at-a-time reading `["gallery","posters"]`, so a second code reads as
  rendered and its page is withheld over a binding that is not its. Closed with
  its CONTROL — the same page with the FIRST code dropped — so the case is about
  the index and not about the legacy form being unreadable.
- **`String(["a"]) === "a"`, IN THE READER FOR WHAT A PAGE RENDERS.**
  `qrUnplaced` reads `String((p && p.source) || "")`, so an entry whose `source`
  is an ARRAY reads as a page rendering the code and its page is withheld for
  nothing. The `typeof p.source === "string"` filter is what stops it; measured
  over six shapes, five agree and that one does not.

**Suite 6,788** — 6,780 + 6 (`addon-route` **85 → 91**) + 2 (`page-gen`
**250 → 252**: `pageId`'s own case, and the keep-spelling contract above).
`site-add` is **42 → 42**: the `stuck` case was REPLACED by its opposite and both
closers are assertions inside cases that already existed, so it adds none.

**⚠ AND THE FIRST STAMP OF THAT NUMBER WAS DERIVED AND WRONG — 6,785, by
arithmetic off two remembered baselines.** The suite measured **6,788**, and the
three baselines measured in a detached worktree at `86c45695` are what closed it:
`addon-route` 85, `site-add` 42, `page-gen` **250** — not the 89 and 251 the
derivation assumed. This file's own rule is *stamp measured numbers only AFTER
the run*, and the failure mode it is warning about is exactly this: an arithmetic
that closes against itself and against nothing else. **Measure the baseline in a
worktree; never subtract from a number in a paragraph.**

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH, NO EDIT-PATH WORK** — the owner's
instruction for this round.

**CI HAS READ IT: `unit tests` run 2668 green — `# tests 6788 / # pass 6784 /
# fail 0 / # skipped 4`**, against local `6788 / 6788 / 0 / 0`; the four are the
three recorded environment skips plus `site-searchpath`'s baseline-commit case.
And **`site build` run 1171 (10:15:41→10:39:56Z), ALL TWENTY STEPS GREEN:
`site-build.mjs` 382 passed / 0 failed** in 17m31s — the FIFTEENTH independent
run to answer 382, read out of the job's own log with every count bounded
landmark-to-landmark (`##[group]Run …` to the next), **0 result lines before the
first marker**. Beside it: kit-typecheck 4, contrast-cases 16, theme-seam 11,
theme-render 29, site-routing 14, site-runtime 47, and kit-render / kit-a11y /
kit-effects / kit-paint each `all passed` with no count — the three result SHAPES
the census has to ask for. **The unit step's TAP is `# pass 396 / # fail 0`**,
and the arithmetic closes one layer down: 393 at run 1163 + 1 (`page-gen`
249 → 250, the large-site round) + 2 (250 → 252, this one).

### …AND A COMPONENT IS A GENERATED FILE TOO, IN BOTH READERS (2026-09-17)

Owner: *"The latest tip still reproduces both outstanding defects… Include
existing pages and custom components in the relevant readers. Calculate newly
added frames from what actually survives the merge, matching files consistently.
Do not turn an incomplete photo inventory into a claim that every image is a
placeholder."*

**THREE OF THE FOUR REPRODUCED AND ONE DID NOT, and saying which is the first
finding.** Every shape was driven through `POST /api/site/<slug>/addon` before
anything was touched:

| shape | measured at the tip |
|---|---|
| a QR binding in a **custom component** | **REPRODUCES** — `ok: true`, `heldPages` absent, `SITE_QRS.gallery` stored in `parts.json`: a dead build, published |
| a QR binding in an **added page** | already correct — 422 `qr-dependency`, `heldPages ["posters.tsx"]` |
| **large-site page identity** | **does NOT reproduce** — `keep ["/target","/"]` shows `["index.tsx","target.tsx"]` and withholds `middle.tsx`; the route answers `unseenPages ["middle.tsx"]`, `changed ["target.tsx"]` |
| a photograph in a component / an unchanged component's frame | **BOTH REPRODUCE** — see below |

**The identity fix landed in the previous round and the guards for it are the
LIFECYCLE case and the `keep` case; what the report describes is the state
before it.** Recorded rather than silently re-fixed: re-fixing working code is
how a guard ends up asserting the defect as correct, which this file has twice.

**1. THE QR WITHHOLDING READ `wrote` — THE PAGES — AND A COMPONENT IS NOT A
PAGE.** Since the band split a section IS a component: `src/routes/-parts/<n>.tsx`,
travelling in its own list. So the fix shipped one file kind short, and the
answer is the same one: a component this change **rewrote** goes back to the
source the site is already serving, one it **invented** is not written at all.

- **`deadQrs` TAKES `wroteParts` AND ANSWERS `withheldParts`**, and
  `qrUnplaced` is still the ONE reader of "does this source show that code" —
  asked one source at a time against the WHOLE code list, because its legacy
  `SITE_QR` arm keys on a code's INDEX. It reads `source` and nothing else,
  which is exactly why a component can be asked a page's question.
- **THE CASCADE CROSSES THE TWO LISTS.** An **added** component that is
  withheld is a file that will not exist, so every page this change wrote that
  **imports** it goes with it — publishing the importer without the module is
  `vite` refusing the build. A **changed** component breaks no importer.
  MEASURED end to end: `heldParts ["qr-banner"]` + `heldPages ["posters.tsx"]`,
  and with nothing left, the 422 at cost 0.
- **`PART_DIR` IS THE ONE DEFINITION** of where a component lives — the same
  constant `partNameOf` reads — so there is no second spelling of the import
  path here. The leading `(^|["'/])` is what keeps a PAGE called
  `my-parts/x.tsx` from reading as an import of `x`, and the trailing
  `(?![\w-])` keeps `qr-banner-2` from matching `qr-banner`: both are the trap
  that guard already records, met on the other side.
- **THE WITHHELD COMPONENT LEAVES `aValid.parts` AT THE ROUTE, above everything
  that reads it** — the wall, the reply, the merge and the trace each reading a
  different idea of what this change wrote is how two lists of one thing come
  apart. `mergeParts` then does the rest by itself.
- **`heldParts` IS ITS OWN FIELD**, because a component has no route and folding
  it into `heldPages` puts a name where every reader expects a path. Its
  sentence is its own too: *"I haven't written the qr-banner section — it was
  there to show that code"*, since *"I've left it as it was"* is false of
  something that never existed.

**2. THE PHOTO INVENTORY WAS PAGES ONLY, AND IT SAID SO AS A FACT ABOUT THE
SITE.** A photograph inside an existing component produced *"This site shows no
real photographs yet; every picture on it is a placeholder."* MEASURED at the
module: `shownPhotos(pages, "fw")` → **0** against
`shownPhotos(imageSources(pages, parts), "fw")` → **1**, on the same site;
through the route, the two sentences swap.

- **`photoInventory(pages, parts, partsKnown)` IS THE SIXTH STEP ASKING
  `imageSources`**, not a sixth copy of the union. That function's own comment
  records why it exists: five steps each read `pages` and a band-split build's
  photographs were never planned, bought, counted, swept or linted.
- **AN INCOMPLETE INVENTORY IS `null`, NEVER A SHORTER LIST** — the owner's own
  instruction, and the whole reason this is a function rather than a call site.
  `readSiteParts` answers `{ok, parts, why}` precisely because a read that
  FAILED is not a site with no components; hand the failure through as `[]` and
  the answer becomes *"every picture on it is a placeholder"* about a site whose
  pictures we could not see. `null` reaches `shownPhotos` as `known: false` and
  the directive says **"Leave every picture already on this site exactly as it
  is"** — cannot-tell as a third answer, in the one input that decides what a
  model believes about the site it is editing.

**3. THE FRAME COUNT NOW READS WHAT SURVIVES THE MERGE, AND BOTH HALVES OF THAT
ARE THE OWNER'S CORRECTION.** It ran above the sweep over `aValid.pages` — what
the writer RETURNED — with `aSrc` as the before. Two things were wrong and each
was measured: **the BEFORE was pages only**, so a component the site already has
had no before at all and an UNCHANGED one carrying one empty frame reported one
newly added frame (**1 against 0**, through the route); and **the AFTER was the
answer, not the publication**, so a page the QR dependency withheld or the merge
boundary refused was still counted.

- **ONE READER NOW, NOT A SUM.** After `applyImages` a token IS an empty
  `src=""`, so the same reader counts a frame written as asked and a token
  written against the ban; adding the old `countImageSlots` here would report
  one frame twice. What it stops counting is a token in an element with no
  `alt` — right, not a loss: the picture rung finds a slot BY its alt text, so
  promising that one is the missing-`src` mistake wearing another hat, and
  `lintPages` reports it separately.
- **AN UNREADABLE COMPONENT STORE TAKES COMPONENTS OFF BOTH SIDES**, never one.
  Nothing is written to `parts.json` while `aPartsRead.ok` is false, so a
  symmetric omission is the exact truth about what this change did; dropping
  them from the BEFORE alone is defect 3 wearing the other hat.
- **MEASURED through the route**: an unchanged component returned byte-identical
  is **0**, and the control — the same component gaining a second frame — is
  **1**, where before the fix they read 1 and 2.

**⚠ AND COMBINED PAGE + PHOTOGRAPH WAS STILL INCOMPLETE WHEN THIS WAS WRITTEN**
(the owner's own words): *"it still skips photo and publishes a placeholder. The
current work prepares a later request; it does not fulfil both parts in one
request."* What this round and the one before it bought is that the placeholder
is now a slot the picture rung can really fill and the customer is told it is
there. **CLOSED by the section below (2026-09-17): the picture is bought and
placed in the same request, and the hand-off survives only where it is still
the right answer.**

**Guards**: `addon-route` **91 → 96** (the component that shows the dead code,
with its cascade and the 422; **a component the site ALREADY HAS reverting while
its importer still ships**; the photograph inside a component with the
unreadable-store control; the unchanged component's frame with its control),
`site-add` **42 → 43** (`deadQrs`' parts half driven directly — the reference,
its control, the two `added` markings, the cross-list cascade, the chain break,
the name boundary, the non-string source, **the four import shapes** and **a
three-link chain**), `site-images` **72 → 73** (`photoInventory` three ways, plus
the assertion that it IS `imageSources` and not a second definition), and
`site-picture` **53** with the AFTER-only property asserted for the route's
sake. **Every new case was proved RED against the pre-change product**, one file
at a time — and the `site-images` one goes red at IMPORT, which is honest: the
pre-change module has no such export.

**Sweep: 29 mutants, 29 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-parts-and-frames.json`, over
`worker.js`, `builder/site-add.mjs` and `builder/site-images.mjs`, against 12
test files). **Three passes, and pass 1 read 31/25/6 with NOT ONE SURVIVOR THE
PRODUCT'S**: three were guard gaps and three were measured inert.

- **THE THREE GAPS WERE ALL REAL WALLS NOBODY DROVE**, each settled by
  measurement rather than reading: the import test's LEFT EDGE (over four real
  shapes — `@/components/my-parts/qr-banner` and a `/spare-parts/` link ship
  with it and are withheld without it, while both spellings of our own import
  are withheld either way); the fixed point's ROUND BOUND (a three-link chain —
  with the loop cut to two passes, `c` survives its missing page, `pc` publishes
  a dead binding and `leaflet.tsx` ships importing a file nothing will write);
  and the route's `added` LOOKUP, which no module case can see because they hand
  that flag in by hand.
- **⚠ AND THE OTHER THREE HAD NO OBSERVABLE FORM AT ALL — the PAIR mutants
  SURVIVED TOO, which is a stronger finding than "a redundant pair".** This
  file's rule is *measure both versions, then mutate the PAIR, which must die*.
  Mine did not. Measured over seven route shapes, `aPicParts` and the
  withheld-name `toLowerCase()` changed no answer in ANY form — single or
  paired — because each is **dead by construction**: `readSiteParts` answers
  `parts: []` on every `ok: false`, so the flag's two branches are the same
  list; and `withheldParts` is built from the very list the filter walks, so a
  case difference cannot arise. Both are GONE, and the sentences they stood for
  are in the code where they were.
- **THE THIRD IS NOT THAT, AND THE DIFFERENCE IS THE RULE.**
  `aParts || aPartsRead.parts` is inert only because `newEmptySlots` walks the
  AFTER alone — a property of ANOTHER MODULE, not of this expression — so it is
  kept, declared, and given a reader in `test/site-picture`: the day removals
  count, it stops being documentation and starts being a wall. *Dead by
  construction goes; dead only given a neighbour's behaviour stays and is
  guarded where that behaviour lives.*

**One older guard re-anchored, not appeased, and the property MOVED rather than
broke.** `site-apply`'s *"a photo slot nobody can fill is said out loud"* looped
over `aSlots` and `pSlots` asserting *"counted BEFORE the sweep, or there is
nothing left to count"*. That is true of a TOKEN counter and false of a FRAME
counter, so the loop is the EDIT path's alone now — the one rung that really
counts tokens — and the addon half is asserted on what it became, as three
separate properties: it runs AFTER the sweep, it reads `aMerge.pages` and never
`aValid.pages`, and both sides are `imageSources`. **Strictly stronger than the
line it replaces, and red against the pre-change product for the right reason**
(*"the addon's empty-frame count is gone"*).

**Suite 6,795** — 6,788 + 5 + 1 + 1, and the arithmetic closes exactly against
**baselines re-measured in a detached worktree at `0cc8104d`** (`addon-route`
91, `site-add` 42, `site-images` 72, `site-apply` 87, `site-picture` 53) rather
than subtracted from a paragraph. `site-apply` and `site-picture` stay where
they were: both gained assertions inside cases that already existed.

### …AND THE CHAIN BROKE AT ITS FIRST HOP: COMPONENT → COMPONENT (2026-09-17)

Owner: *"homepage → panel → qr-card → QR targeting missing /gallery. The route
withholds qr-card but retains panel and the homepage. The actual compiler
payload contains panel importing the missing qr-card module."*

**REPRODUCED THROUGH `POST /api/site/<slug>/addon` BEFORE ANYTHING WAS
TOUCHED**, exactly as reported: `heldParts ["qr-card"]`, `heldPages undefined`,
`changed ["index.tsx"]`, `ok: true` — and the container payload's `parts`
carrying `panel` with `import { QrCard } from '@/routes/-parts/qr-card'`, a
module nothing would write. `vite` refuses that build, which is this
repository's own most expensive measured class, published on purpose.

**THE CAUSE WAS ONE MISSING TEST, NOT A MISSING IDEA.** The PAGE loop has asked
*"does this import a component that will not exist"* since the cascade shipped;
the COMPONENT loop asked only *"does this render a dead code"*. So the chain
broke at its first hop and everything past it read as unrelated — the fix
shipped one file kind short of its own argument, for the second round running.
The component loop asks both questions now, in the same shape the page loop
does, and the whole set settles together: **restore an existing component to the
source the site is serving, withhold a new one and every file that depends on
it.** One rule rather than two branches, because a reverted component still
exists and therefore never joins the *will-not-exist* set.

**⚠ AND A SIBLING IS `./x`, WITH NO `-parts/` IN IT AT ALL.** That is the one
place this edge differs from the page edge, and it was decided by measurement
rather than by preference: the only spelling ANY prompt teaches is
`@/routes/-parts/<name>` (`page-gen.mjs`, twice), and **the 100-site corpus
holds ZERO `-parts/` files — it predates components entirely** — so there is no
evidence either way about what a model writes between two siblings. What
decides it is the asymmetry: a relative `./x` from inside `-parts/` can resolve
to NOTHING BUT `-parts/x.tsx`, so admitting it has a false-alarm rate of **zero
by construction**, while missing it hands the compiler a dangling import.
**`inPart` is the discriminator that keeps it safe** — from a PAGE, `./x` means
`src/routes/x.tsx`, another page — and the three walls inside that regex are
each measured against a shape a real component carries: without the quote a
COMMENT saying *"the card is in ./qr-card"* reads as an import; without the
`./` any path ending in `/qr-card` does, which is a link, a kit module of the
same name, or a sentence about a print file. All four ship as they are.

**⚠ AND THE BOUND WAS WIDENED, MEASURED INERT, AND PUT BACK — with a proof
instead of a term.** `+ written.length` was added on the reasoning that
withholding an ADDED page returns its route to `gone` and can kill a second
code. **A/B over 6,000 random chain shapes (2,621 with something really
withheld) found ZERO differences**, and the reason is structural rather than a
sample: a round that changes neither `dead` nor `goneParts` cannot withhold a
page it did not already withhold last round, because the page loop walks the
WHOLE list every round against exactly those two sets. So **no round is ever
productive on pages alone** and `codes + parts` bounds the productive rounds
however the three chains interleave. The bound is what it was; what is new is
that it is now written down why.

**`esc(name)` CANNOT FIRE THROUGH THE ROUTE AND IS DRIVEN ANYWAY.**
`validatePages` refuses any component name but
`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`, so no name reaching `deadQrs` can hold a
regex metacharacter — and the function is exported and takes what it is handed,
where `qr.card` unescaped matches `qrxcard`. *A wall nobody can drive is a wall
nobody is guarding*, answered by driving it at the module rather than by
declaring it a belt.

**Guards**: `addon-route` **96 → 98** — the owner's chain end to end, plus the
matching successful control where `/gallery` exists. **The compiler inputs are
read from a DERIVED check**, `danglingParts`, which walks BOTH payload halves
(pages arrive in `files`, components in `parts`) and answers "does anything here
import a file that is not here" — a hardcoded expectation stops being that
property the moment a fixture gains a file, and a check reading only `files`
would report a component importing a missing component as clean, which is the
defect itself. **One unrelated `/prices` is declared scaffolding**: the chain
alone leaves nothing to publish, and a 422's compiler inputs are the empty set
— a true assertion and a weak one. `site-add` **43 → 44**, where the three
spellings, the discriminator both ways round, a five-link chain listed
BACKWARDS, the existing-component revert at depth and its `added` control all
live. Both new cases proved RED against the pre-change product, and **the
control passes on BOTH trees**, which is what makes it a control rather than a
second copy of the case.

**Sweep: 17 mutants, 17 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-nested-parts.json`). Pass 1 read
18/14/4 and **not one survivor was the product's**: three were gaps in the new
guards (the quote, the dot, and `esc` — each closed by a measured real shape
rather than by a contrived one) and the fourth was the inert bound above, which
was removed with its proof instead of being hunted.

**Suite 6,798** — 6,795 + 2 (`addon-route`) + 1 (`site-add`), and the arithmetic
closes exactly.

**CI HAS READ BOTH, ON `b953c0fb`.** `unit tests` run **2674**, green
(2026-09-17 19:04:41→19:06:43Z, the suite step 109 s) — `# tests 6798 /
# pass 6794 / # fail 0 / # skipped 4`, against local `6798 / 6798 / 0 / 0`; the
four are the three recorded environment skips plus `site-searchpath`'s
baseline-commit case, and **the TOTAL is what matches**. And `site build` run
**1173** (19:04:41→19:27:07Z), **all twenty steps green**: `site-build.mjs`
**382 passed / 0 failed** in 16m06s, with kit-typecheck 4, contrast-cases 16,
theme-seam 11, theme-render 29, site-routing 14, site-runtime 47 beside it and
kit-render / kit-a11y / kit-effects / kit-paint each `all passed` with no count
— the three result SHAPES a census has to ask for. Every count bounded
landmark-to-landmark (`##[group]Run …` to the next), **0 result lines before the
first marker**. It fired because `site-add.mjs` is under `builder/**`.
**The unit step's TAP is `# pass 396 / # fail 0`, unchanged from run 1171** —
correct, because this round adds no `page-gen` or `publish-pages` case.

**⚠ AND THE "HOW MANY RUNS HAVE ANSWERED 382" SCAN IS NOT TRUSTWORTHY AS
WRITTEN, which is worth saying rather than quietly publishing a number.** The
recorded instruction is to DERIVE the count with a scan of this file instead of
taking the next ordinal — and a scan for *a run number in the same paragraph as
a 382 claim* over-collects: it picks up the `unit tests` run quoted in the same
breath, and it picks up **run 1065, which read 373**, and **run 1115, whose
count is recorded as UNREAD**. So the ordinal stays dropped and each entry names
its own run and its own counts; anyone wanting the total has to scan for `site
build` numbers only and subtract those two by hand.

**COMBINED PAGE + PHOTOGRAPH REMAINS INCOMPLETE**, in the owner's words: it
still skips photo and publishes a placeholder, and the same request does not yet
place the picture.

### THE PRESERVATION POLICY HAD ONE REASON AND NEEDED TWO (2026-09-17)

Owner: *"Add a gallery page and add a parking note to the homepage."* The
component designer explicitly targets `/`, the writer returns the correct
homepage addition, and `mergeAddonPages` nevertheless REVERTS `index.tsx`
because it contains no link to the newly added route. ***The identical
component-only request succeeds.***

**REPRODUCED THROUGH THE ROUTE BEFORE ANYTHING WAS TOUCHED**: `reverted
["index.tsx"]`, `changed []`, the note in **neither** the container payload nor
the stored source, and the customer told *"I left / as it was — nothing there
needed to change for this"* about the half of their own sentence that named that
page. The component-only control: `changed ["index.tsx"]`, note published.

**THE RULE WAS RIGHT AND ITS JUSTIFICATION WAS INCOMPLETE.** Reachability is a
guess about a page NOBODY mentioned — the nav link a new page needs — and it is
a good guess, bought by a live run where *"add a gallery page"* rewrote four of
four pages for 28 credits. `asked` is not a guess: it is the destination a
CLEANED designer answer NAMED. Both reasons are kept and they are independent;
what the fix must not do is infer permission from the customer's prose, or
exempt a page nobody named.

**`aAskedPages` AND `aKeepPages` ARE TWO LISTS OUT OF ONE WALK, AND THE
DIFFERENCE IS THE `/`.** The route has collected the cleaned answers'
`page`/`path` fields since the large-site window shipped — and it appends the
home page unconditionally, because that is the nav anchor almost every addon
touches. **That is a BUDGET decision, not a claim that anybody asked**, so
handing the window's list to the merge would exempt `/` from the preservation
rule on every addon — *removing protection from unrelated pages*, the one thing
forbidden. One walk, two lists derived from it, so they cannot drift; the
`keepOnly` flag is what separates them and a mutant collapsing it is a red run.

**THE IDENTITY IS A CONTRACT, NOT A PREFERENCE.** `asked` arrives as ROUTE
identities because **`page-gen.mjs` imports `routeOf` from `site-addon.mjs`** —
importing its `pageId` back would be a cycle. The route normalises with `pageId`
(which delegates to that very `routeOf` for a file) and the merge maps its own
stored paths through `routeOf`, so the two normalisers are one definition with
the file case shared; measured equal on every real shape. **The comparison is
case-insensitive ON BOTH SIDES and that is load-bearing**: `SAFE_PATH` in
`page-gen.mjs` carries `/i`, so `About.tsx` really is stored with its capital
and `routeOf` answers `/About` where `pageId` answers `/about` — measured
through `validatePages`, not assumed.

**Guards**: `addon-route` **98 → 101**, the three the owner named — the
component-only control, the page + requested homepage component with no link
between them, and an unrelated existing-page rewrite that must still be
rejected. Each asserts the **compiler inputs**, the **stored source**
(`storedSource`, reading `source/<slug>/pages.json` — a third claim, not a
second: a change that reached the compiler and not the store leaves the next
edit working from the old file) and the **customer wording**, composed by the
real `addonReply` over the real reply. The false sentence is asserted ABSENT on
the two legitimate changes and **PRESENT on the unrelated rewrite**, which is
what stops the fix from being "delete the sentence". `site-addon` **190 → 191**
for the contract itself. All three route cases were run against the pre-change
product: **only the reproduction goes red, and both controls pass on both
trees** — which is what makes them controls rather than second copies.

**⚠ FIVE OLDER GUARDS RE-ANCHORED, NOT APPEASED, AND FOUR ARE ONE CLASS.** They
used the merge call as a **window OPENER** and pinned its whole argument list,
so an honest fourth argument turned them red on a change they are not about —
this repository's own *assert the property, not the spelling*, four times in one
file, **and three of the four had already been re-anchored yesterday** when
`const` became `let`. The landmark is the ASSIGNMENT (`aMerge =
mergeAddonPages(`) now; an argument list was never part of a window's claim. The
fifth is the wiring census, which really IS about the arguments — it reads them
**depth-aware** (a nested call inside one cannot end the list early) and asserts
the count, the removals and the named destinations **on both call sites**,
because the second is the re-merge after a withheld QR and a different
permission set there would revert on the second pass exactly what the first kept.

**Sweep: 15 mutants, 15 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-asked-pages.json`, three passes).
**Not one survivor at any point was the product's.** Pass 1 read 16/13/3 and
pass 2 15/14/1; the three were a non-string entry, and the fold on each side —
each closed by the case that needs it to MATCH rather than to miss, which is the
half that was absent. The fourth was **measured inert and kept with its reason
rather than hunted**: `v.path` is read into both lists and only the `page` kind
carries `path`, and `cleanAdd` answers `page-exists` for a path the site already
has — so a cleaned `path` always names a page that is in neither `changed` nor
`aSrc`. **That deadness rests on a NEIGHBOUR'S rule**, which is guarded four
ways where it lives, so the line stays, says so, and carries the destination the
day a kind extends an existing page.

**⚠ AND MY OWN FIRST CASE PASSED THE LIST IN THE `remove` SLOT.**
`mergeAddonPages(SITE, [...], ["/"])` is the third argument, not the fourth, and
it read as the fix not working — caught because the case asserted a POSITIVE
outcome and driving the module directly disagreed with it. A case that only
asserted the negative would have "passed".

**Suite 6,802** — 6,798 + 3 + 1, and the arithmetic closes exactly.

**⚠ AND THE REPLY CLAIMED A LINK IT HAD NOT MADE — corrected the same day**
(owner: *"a changed page does not establish that a link was added"*).
`addonReply` and the browser's `addonReplyText` both read
`added.length ? "linked it from " : "updated "` — an INFERENCE from *a page was
added in this change* to *this changed page carries the link to it*, written for
run 35 when that was the only reason a page could legitimately change beside an
addition, and false the moment the preservation policy above learned its second.

**IT CONTRADICTED ITSELF IN ONE SENTENCE**, which is how it was caught: the
parking-note case produced *"added /gallery, linked it from /. Nothing links to
/gallery yet…"* — the link claim and the no-link warning four words apart, from
a composer holding both facts. It reads *"added /gallery, updated /. Nothing
links to /gallery yet — say where you want the link and I'll add it."* now.

**"updated" IS TRUE OF EVERY CHANGED PAGE WHATEVER ELSE HAPPENED**, so there is
no inference left to be wrong; `unlinked` is the one field that really knows
about links and it is measured rather than guessed. **THREE ASSERTIONS EXPECTED
THE FALSE CLAIM** — two older guards and the new route case — and each is
re-anchored onto the property rather than appeased: every one now asserts that
NO reply claims a link, with the paired and unpaired shapes driven on both
composers. No new reporting machinery, and the suite is unmoved at 6,802
because all of it is assertions inside cases that already existed.

**COMBINED PAGE + PHOTO WAS THE NEXT INCOMPLETE CAPABILITY** when this was
written, in the owner's words: the same request did not yet place the photo, and
a placeholder plus an invitation to ask again is not that capability. **CLOSED by
the section below.**

### PAGE + PHOTOGRAPH IN ONE REQUEST: IT BUYS THE PICTURE AND PLACES IT (2026-09-17)

Owner: *"proceed to completing page + photo in one request. Placeholders and
asking the customer to repeat the photo request do not complete that capability.
Start with stubbed-provider verification."*

**MEASURED THROUGH THE ROUTE BEFORE ANY OF THIS**, on *"add a gallery page with a
photograph of the workshop on it"*: `kinds: ["page"] / skipped: ["photo"]`, a
gallery page whose every picture was `<SafeImage src="">`, nothing bought, and
the customer told *"The photograph is a separate step — ask for it on its own."*

**THE LINE IS WHO MAKES THE SLOT, and it is the same line `runPictureEdit`
already draws with `needs-place`.** That rung fills a `<SafeImage>` that EXISTS
and escalates when there is none; a photograph asked for beside a page or a
component is a slot THIS change is writing, so this is the only step that can
create it and fill it in one request. **A photograph ALONE is still the picture
rung's, unchanged** — it prices one against the real balance and refuses
honestly, and a change that designed a picture for every `photo` ask would take
that rung's work and its refusals with it.

- **`photo` GAINS A TOOL ANSWERING `{page, describe}` AND KEEPS `elsewhere`.**
  That is `imageDirective`'s own list shape, so the shot list crosses to the page
  writer through the build path's reader rather than a second shape beside it.
  **`PLACING_ADDS` is a third group and the partition stays total and disjoint**
  — a kind that names a layer AND carries a tool — and
  **`addLayerIn(kind, kinds, placing = PLACING_ADDS)` is the ONE reader** every
  route ask goes through (**four calls**, pinned by census: the escalate twice,
  the set-aside list and the loop gate), because two of them disagreeing is a
  kind designed and then reported as skipped, or set aside and never designed.
  `IMAGE_CAP` and `MAX_PROMPT_CHARS` are IMPORTED: a ceiling retyped here would
  be a wall the tool promises and the spend path does not keep.
  **`DISPATCHED_ADDS` IS EMPTY TODAY**, so its guard loop asserts nothing — which
  is why the placing group is driven in both directions instead.
- **THE BALANCE CUTS THE LIST BEFORE THE WRITER SEES IT**, which is the build
  path's own rule in as many words: *"printing all of them would invite a page
  writer to spend money the account has not got."* `imagesAffordable` is the same
  reader `buySitePhotos` asks at the moment of spend, so the writer is never
  shown a token the purchase will refuse.
- **BOUGHT AFTER THE MERGE AND THE PARTS WALL, BEFORE `newEmptySlots`.** A page
  the QR dependency withheld, one the merge boundary refused and a component the
  writer was never shown are all gone by that line, so nothing is paid for on a
  file nobody will be served; and a slot this change FILLED is not an empty frame
  to warn the customer about. `buySitePhotos` is the build path's own function,
  unchanged.
- **BILLED ON `made`, NEVER `planned`** — the build path's rule and the picture
  rung's. Its own reserve (**#5**) under a job, placed before the publish gate;
  one more term in the one synchronous collect, which rounds once.
- **`pictures` AND `pictureNote` ON THE REPLY.** `pictures`, never `photos`: that
  field has meant "empty frames left over" since it was written and the browser's
  `photoNote` reads it as one. The sentence is `imageNote`'s — the build path's
  own composer, and the only thing that can tell four identical-looking blank
  frames apart — printed verbatim, before the empty-frame sentence, because what
  the customer asked for comes first.

**⚠ AND THE SWEEP BELT WAS STRIPPING THE VERY TOKENS THE PURCHASE IS FOR.**
`applyImages(aValid.pages, {})` ran unconditionally, which was right for every
addon before today — the step bought nothing, so a token could only be a model
writing one against the ban. *A rule true because of a layer below it expires
when that layer moves*, and here **we are the layer**. MEASURED through the
route: `plan.shots` came back **0** on a run whose directive named the picture
and whose writer wrote the token exactly as asked. It waits for the buying
branch now; the property is unchanged, because `buySitePhotos` ALWAYS sweeps
(its own comment records the live broken image that bought that guarantee) and
nothing between the two publishes.

**⚠ AND AN EXISTING GUARD GOING RED FOUND A REAL GAP IN THE CHANGE.** `place` —
*leave an empty `src` the picture rung can fill* — was keyed on `aSkipped`,
which is **empty on exactly the asks that clause was written for** once a
photograph is designed here. So a picture the BALANCE refused, or one its
designer could not describe, would have published a page with no slot at all
while the customer was told the pictures are placeholders. It asks
`aKinds.includes("photo")` as well: the trigger is *a picture was asked for and
is not being bought*, which is wider than the hand-off it replaced.

**MEASURED, end to end through `POST /api/site/<slug>/addon` with the provider
stubbed in its own two hops** (`genSitePhoto` POSTs to fal and then FETCHES the
url fal answers): `kinds ["page","photo"]`, `skipped []`, the writer handed
`/gallery — <SafeImage src="@@IMG:the workshop bench under the window, warm
afternoon light@@" …>`, **exactly one prompt paid for**, the compiled gallery
page carrying `src="/u/<slug>/<32 hex>.jpg"` and no token, `pictures: 1`,
`photos: 0`, and **cost 19** — a photograph is `IMAGE_USD` / `CREDIT_USD` ≈ 18.75
credits, so the picture is nearly all of that bill and a run that forgot to
charge for it reads ~1.

**What the customer hears**, driven through the browser's own `addonReplyText`:

| state | the sentence |
|---|---|
| bought | `✅ Done — added /gallery, updated /. Made 1 photograph for the site.` |
| unaffordable | `…Not enough credits left over for photographs, so the pictures are placeholders for now. There is a space for a photo — upload yours in the Data panel and it'll fill in.` |
| provider refused | `…Couldn't make the photographs this time, so the pictures are placeholders — the site is otherwise fine.` + the space sentence |
| set aside (photo alone, or beside a table) | the space sentence + `The photograph is a separate step — ask for it on its own and I'll place it.` |
| no picture asked for | `✅ Done — added /gallery.` — byte-identical to before |

**Guards**: `addon-route` **101 → 111** — the combined request end to end (the
hand-off gone, the exact token, the prompt really paid for, the published page's
own `src`, the three reply fields and the bill), a photograph ALONE still hopping
and buying nothing, one beside a table still set aside, a provider that refuses
costing nothing and sweeping, the destination rule with its control, the belt
still firing on a change that buys none, a photograph beside a SECTION, the
purchase reading the PUBLICATION rather than the writer's answer, a stored
component's token left unbought, and the cap. `site-add` **44 → 45** (the tool's
shape and its cap, the three refusals, the slice, the fold's PAIR dedupe, that
the list is NOT on `designed` — storing it would re-buy the same set on the next
unrelated edit, which is the rule `budgetFor` exists for — and the placing group
driven as a PARAMETER in a two-kind world). `site-addon` **89** and `addon-queue`
**14**, each gaining assertions inside a case that already existed: the browser's
two sentences driven, in order, **against `imageNote`'s own output rather than a
sentence typed in the guard**, and the job path's cost asserted as a CENSUS over
its own accumulators. **The fixture stubs fal in its own two hops, records every
prompt paid for, and answers real JPEG magic** — `sniffImage` reads the bytes and
refuses anything else.

**⚠ AND THREE OF THOSE FOUR CASES WERE VACUOUS IN THEIR FIRST SHAPE, each for a
different reason and each found by MEASURING rather than by reading.**
(1) *A picture is bought for what will be published* aimed its photograph at the
very page it wanted reverted — and a photograph answer NAMES its destination, so
that page joins `aAskedPages` and the merge KEEPS it. `reverted` came back `[]`
and the case's own precondition assertion is what said so. The picture is
designed for `/gallery` now and the writer puts its token on the unasked
`/prices`, which is the shape where the two lists really differ.
(2) *A stored component's token is not bought* could not discriminate at all:
with one shot and one token in the page, `planImages` fills its budget from the
page and never reaches the component, so handing the stored list in changes
nothing. Two shots and one token is what leaves the room.
(3) *The browser keeps its own copy* was pinned to `/Made 1 photograph/`, which
a browser composing its own sentence from `a.pictures` satisfies exactly — the
one thing that case exists to forbid. Derived from `imageNote` and asserted
whole.

**Eleven older guards re-anchored, not appeased**, each naming the property that
moved: the two-group partition (three now, with the placing group driven in both
directions); the `addTool`/`addRule` refusal (the property is *no shape*, not
*dispatches*); `cleanAdd`'s `no-kind`; `LIST_ADDS`; the four-part rule census;
`foldAdds`' empty shape; the route's `addLayer(` census (now `addLayerIn(`, with
the count of asks pinned at 4 and the bare reader forbidden); the parts-sweep
pairing — **`/\bparts\b/` cannot match `aParts`**, so a real part sweep read as a
page sweep and the census reported the product unpaired over correct code; the
hop census (`DISPATCHED_ADDS ∪ PLACING_ADDS`, because each harness case posts one
ask); the unbought-token guard (the property was never *neither lane buys*, it is
that an unbought token never publishes); and four bill lines whose tail is now
open because a picture is a non-spread `{images: n}` term.

**Sweep: 40 mutants, 40 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-page-photo-buys.json` — 42 entries,
40 product and 2 controls, read back out of the spec — over `worker.js`,
`builder/site-add.mjs` and `public/chat.js`).
**⚠ AND THE TEST LIST THIS RAN AGAINST IS NOT RECORDED ANYWHERE, so it is not
being stamped.** A first draft of this line said "against 9 test files" from
memory; the runner took its list on argv and printed the spec's name nowhere,
opening on `baseline…` and closing on a count — **so a clean tally could not be
checked for its own SCOPE**, which is exactly the claim that matters here,
because a narrow list is what makes a narrow sweep cheap and **a narrow list can
only produce a false SURVIVOR, never a false kill**. `40/40/0` and `40/40/0
against these nine files` are different claims and only the second is auditable.
Fixed at the instrument: `scripts/mutate.mjs` now opens with the spec, the two
counts, the files it mutates and the test list — **before the baseline**, so a
sweep that dies in its baseline still says what it was trying to do — and an
empty list is SAID (`(the whole suite)`), because an empty list and a forgotten
one are identical in a log. `test/sweep-runner.test.mjs` **4 → 7**, all three
driven as a real process in a temp directory and all three proved RED against
the pre-change runner with the existing four green on both.
**AND THE HEADER'S CONTROL COUNT IS THE TALLY'S, one binding**: two `filter`s of
one predicate is a sweep arguing with itself about what it just did. It was
written as two on the first pass, and hoisting the computation while leaving the
old `const` in place threw `Identifier 'controls' has already been declared` at
LOAD — `.mjs` is parsed as a module, so **driving the runner caught what a source
read would not have**, which is this file's own recorded re-anchor trap in the
instrument that measures re-anchors.
**Pass 1 read 39/30/9 and NOT ONE SURVIVOR WAS THE PRODUCT'S**: seven were gaps
in this change's own guards and two were measured INERT. The seven are the three
vacuous cases above plus four walls nobody drove — the photo tool's cap read as
its own number rather than the platform's, the purchase reading the answer rather
than the publication, the stored components handed in for the sweep, and the job
branch's reserve dropped from the reply's cost (which no route guard can see, so
it is closed as a CENSUS in `addon-queue`).
**⚠ AND THE TWO INERT ONES HAVE THE SAME CAUSE: `photo` IS THE ONLY KIND WITH A
LAYER AND A TOOL, so `addLayerIn`'s membership test and `PLACING_ADDS`' `shape`
filter cannot separate from the conditions beside them — 81 probes (every kind
against nine company shapes), ZERO differences either way.** They are answered
differently on purpose. The first is made DRIVABLE — `addLayerIn(kind, kinds,
placing = PLACING_ADDS)` takes the group as a PARAMETER, the `cleanTools(v,
catalog)` precedent, so a two-kind world exists to ask it in and the guard drives
every member both ways; *a wall nobody can drive is a wall nobody is guarding*,
and the answer is to build the world rather than to declare the wall. The second
has nowhere to stand, so it is DECLARED in the code with its pair named (the
load-time partition below it) and given an observable replacement mutant.

**Suite 6,816, and it is TWO changes**: 6,813 for the capability — 6,802 + 10
(`addon-route` 101 → 111) + 1 (`site-add` 44 → 45) — then **+ 3** for the sweep
runner's own scope line (`sweep-runner` 4 → 7). **Both arithmetics close exactly
and both were measured, never derived**; the baselines are from a
detached worktree at `0f873e2c` rather than subtracted from a paragraph —
`site-addon` and `addon-queue` stay where they were (89 and 14), because
everything they gained is an assertion inside a case that already existed.
**And a worktree needs `node_modules` linked into it or three of those four
files answer `# tests 1`** — one failing "test" is a file that would not LOAD,
which reads as a baseline of one rather than as a broken command.

**CI HAS READ BOTH NUMBERS, EACH ON ITS OWN SHA.** `unit tests` run **2681** on
`e48e7ae2` (the capability) — `# tests 6813 / # pass 6809 / # fail 0 /
# skipped 4`; run **2683** on `7627c71e` (the runner) — `# tests 6816 /
# pass 6812 / # fail 0 / # skipped 4`, with **all three sweep-runner cases
present in the CI log** rather than inferred from the total. Both against local
`… / … / 0 / 0`; the four are the three recorded environment skips plus
`site-searchpath`'s baseline-commit case, and **the TOTAL is what matches**.
**⚠ AND THE FIRST READ OF 2683 WAS THE WRONG RUN** — a run id kept from an
earlier listing was run **2682**, the docs-only stamp commit, which answers
6,813 correctly. Two shas were in flight and the number that came back was the
right answer to a question I had not asked. *Re-resolve the run id from the sha
when more than one push is outstanding.*
**AND `site build` RUN 1177 IS GREEN ON `e48e7ae2` (21:09:20→21:33:55Z), ALL
TWENTY STEPS**: `site-build.mjs` **382 passed / 0 failed**, with kit-typecheck 4,
contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14, site-runtime
47 beside it and kit-render / kit-a11y / kit-effects / kit-paint each `all
passed` — the three result SHAPES. Every count bounded landmark-to-landmark,
**0 result lines before the first marker**. It fired because `builder/site-add.mjs`
and `worker.js` moved. **The unit step's TAP is `# pass 396 / # fail 0`,
unchanged from 1171 and 1173** — correct, because this round adds no `page-gen`
or `publish-pages` case. **No `site build` fired for either later push and none
was due**: `scripts/**` and `test/sweep-runner.test.mjs` are outside that
workflow's `paths`.
**⚠ AND "TWENTY STEPS" NEEDS THE RIGHT FILTER, which is worth one line because
this file already records the count.** The API answers **23**, and dropping
everything that `startsWith("Post ")` leaves **21** — the third trailing entry is
**`Complete job`**, which is GitHub's too and is not named like one. Twenty is
right; a filter on the name prefix is not what establishes it.

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH, NO EDIT-PATH WORK** — the owner's
instruction. **NOT PROVEN LIVE**: every measurement here is from driving the real
route with the provider stubbed, and no real photograph has been generated. The
first live proof is a paid addon run, which is the owner's press.

### …AND BUYING ONE MAY NOT LOSE THE ONES ALREADY THERE (2026-09-17)

Owner: *"Preserve existing photographs when buying new ones. The paid-photo
directive currently says every other picture should have no src. Correct that
instruction and prevent an addon from accepting removal or replacement of
existing image references in pages and custom components."* And: *"Carry the
full requested photo list separately from the affordable purchase list. A
two-photo request with credits for one must explain that one was omitted because
of the balance. Do not imply a placeholder exists unless one actually survived
publication."*

**BOTH REPRODUCED THROUGH `POST /api/site/<slug>/addon` BEFORE ANYTHING WAS
TOUCHED**, which is what named the cause in each case rather than the symptom.

**1. THE PAID DIRECTIVE WAS AN INSTRUCTION TO STRIP.** Its tail read *"Do NOT
invent an extra token: any other picture stays a `<SafeImage>` with no src,
which renders this theme's own placeholder — that is the intended look for the
rest of the site."* True of a FIRST BUILD, where nothing else on the site is
real; false of every addon that buys one for a site that has some. Measured on a
site showing two bought photographs: the writer returned both stripped, the
**compiler payload** and **`source/<slug>/pages.json`** each came back with ZERO
`/u/` urls, the customer was told *"Made 1 photograph for the site."*, and the
two stripped pictures were counted as **`photos: 2`** — empty frames this change
had ADDED.

- **THE BAN IS NARROWED TO WHAT THIS CHANGE ADDS, and the inventory is now in
  the paid form too.** That needed one shape rather than two: the route sent the
  bare LIST when buying — `imageDirective`'s build-path door, which carries no
  inventory — so a correction could land on the zero form and miss the buying
  one. It sends `{buy, shown, place}` always; `imageDirective`'s array door
  delegates to the object (`imageDirective({buy: n})`), so there is ONE composer
  and `keepClause` is one definition read by both forms.
- **AND AN EMPTY SRC RATHER THAN NO SRC**, for the reason the zero form already
  carried: the picture rung fills a slot by rewriting a `src`, so an element with
  none is invisible to the one step that could later fill it.
- **THE BUILD PATH SUPPLIES NO INVENTORY AND IS SILENT, correctly**, because
  `budgetFor` answers 0 for a revise of a site that has photographs — so a paid
  directive is only ever reached there on a site that has none. `keepClause`
  answers `""` for an absent inventory and the ZERO form normalises absence to
  `{known: false}` instead, because *this form's subject is what the site has*
  and cannot-tell must never read as a value.

**2. AND THE WALL BEHIND THE CORRECTION.** `keptImages(before, after, slug)` —
every photograph the site showed is still shown, or the change is refused 422
`lost-photos`, cost 0, before the purchase and before the gate. `keptProse`'s
shape one field over, and for the same reason: these are money the owner already
spent, and an addition may only ADD.

- **SITE-WIDE, NEVER PER FILE, which is why it takes two LISTS.** A writer that
  moves a `<SafeImage>` out of one component and into another has kept every
  picture the site shows; a per-file wall refuses that reorganisation.
  `imageSources` is the one definition of the files a photograph can be in, so
  pages and components are one question — the owner's *"in pages and custom
  components"* — and it is **the same pair `newEmptySlots` is handed**, not a
  second idea of before-and-after.
- **⚠ AND THE DEMONSTRATION HAD TO MOVE, WHICH IS ITSELF A FINDING.** The
  obvious shape — a picture moved off a PAGE into a component — is already
  refused one wall earlier by `keptProse`, because an `alt` is WORDS: driven,
  the change comes back `error: "rewrote"` naming *"a guitar being refretted"*.
  `keptProse` loops `aMerge.changed` PAGES and never the parts, so
  component-to-component is the shape where the two readings really differ.
- **`photoUrls` IS THE ONE READER** of "a photograph this site owns", shared with
  `shownPhotos`, so the count a designer is told and the wall that refuses a
  change cannot disagree. **The SLUG folds case and the URL does not**: a slug is
  lowercased at every door, so `/u/FW/` is this site's — while the rest of the
  path is an R2 KEY, where a re-cased hash is a different object and therefore a
  broken image, so `/u/fw/A1.jpg` coming back as `/u/fw/a1.jpg` reads as LOST.
  `/u/` itself is ours and is matched literally; the first draft of the guard
  asserted a fold there that the reader does not do, and driving it is what said
  so.
- **REPLACEMENT IS REMOVAL** — a `src` swapped for a different `/u/` url loses
  the first, which is what *"removal or replacement"* names as one thing — and an
  ADDITION is invisible, because adding is the whole point of the step.
- **`lostPhotosMsg` GIVES THE COUNT AND NEVER THE URLS.** `/u/fw/a1b2c3d4.jpg`
  is a storage key and tells a customer nothing; how many of their own pictures
  were at stake is what they can act on. The urls ride the reply as
  `lostPhotos`, developer-facing, the division `unknownComponents` already makes.

**3. THE FULL REQUEST AND THE AFFORDABLE ONE ARE TWO LISTS.** Reproduced: two
pictures designed, a balance covering one (a photograph is `IMAGE_USD /
CREDIT_USD` = **18.75 credits**, so 30 buys exactly one of two), one bought — and
the customer heard *"Made 1 photograph for the site."* with `photos: 0` beside
it. Nothing said a second had been asked for and nothing said why it was absent.

- **`unaffordable` IS HOW THE FULL LIST TRAVELS, and the ROUTE names the reason**
  because it is the only place holding both numbers: `imagesAffordable` against
  the balance is the one thing that cuts `aFold.photos` down to `aShots`.
  `imageNote` must not infer it from `planned - budget`, which inside the
  purchase is a different clamp with a sentence of its own.
- **⚠ IT IS NOT `overflow`, AND WIRING IT THERE WOULD HAVE BEEN THE LIE THE
  OWNER'S THIRD SENTENCE NAMES.** `overflow` is tokens the writer WROTE beyond
  the budget; `applyImages` sweeps each to `src=""`, so *"the other 2 pictures
  are placeholders"* is TRUE there. These were cut off the list before the writer
  saw them — no token, no frame, no space — so they get their own clause:
  *"There weren't enough credits for the other one, so it isn't on the site —
  top up and ask for it and I'll add it."* A second CLAUSE rather than a second
  sentence, so every outcome keeps its exact words and a change that buys nothing
  extra is byte-identical. **"weren't enough CREDITS" whatever the count**: the
  verb agrees with the credits, and the first cut read *"There wasn't enough
  credits for the other one."*
- **AND `frames` IS THE OBSERVATION THAT KEEPS THE ZERO-BUDGET SENTENCE HONEST.**
  With nothing affordable the writer is asked for `<SafeImage src="">` — a real,
  fillable space — so *"the pictures are placeholders"* is true when it writes one
  and false when it does not, and only the run itself can say which. Asked in
  that ONE branch and nowhere else, because `full`, `slow`, `empty` and the error
  sentence are each reachable only once a token was written and swept, so a frame
  exists there by construction. A caller that passes nothing gets exactly the
  sentence it got before, which is what leaves the build path untouched.
- **⚠ AND `planned` IS DELIBERATELY NOT OVERRIDDEN AT THE REPLY.** A first cut
  passed `aFold.photos.length` into it — the obvious other half of "carry them
  separately" — and it is a value NOTHING ON THIS PATH READS: measured over 810
  shapes, the one branch that reads `planned` is the silence guard, and
  `unaffordable` is non-zero on every route shape that could reach it. A value
  computed and forwarded to no reader is this repository's most-recorded defect,
  and shipping one inside the round that is about exactly that would be the wrong
  way round. **It was found as a sweep survivor and REMOVED rather than declared**;
  the distinction is carried where it is read — `unaffordable` at the reply, and
  `planned`/`offered` on the trace mark, which was also reporting the cut list as
  the plan.

**Guards**: `addon-route` **111 → 118** (the loss case with the corrected
directive asserted verbatim, the successful-retention control, the
component-to-component move, the component wall with its own control, the
two-of-two omission, the credits-for-both control, and the survived-versus-not
placeholder pair) — each driven through the real route and each asserting the
**compiler payload**, the **stored source** and the **customer reply**, which are
three different claims. `site-images` **73 → 78** (`photoUrls`, `keptImages`,
the shared clause, `imageNote`'s two fields). **Every new case was proved RED
against the pre-change product**, with the controls passing on BOTH trees —
which is what makes them controls rather than second copies.

**One older guard re-anchored, not appeased, and it is the THIRD time for that
same reason** — `site-addon`'s *"neither lane can publish an unbought image
token"* pinned `images: <x>.length ? <y> : { … buy: 0 }`, the shape of a call
choosing between the bare list and an object. It asserts the two KEYS that carry
the property now (`buy:` and `shown:`), which is strictly stronger: the old form
allowed the buying branch to carry no inventory, and that was the defect.

**Sweep: 37 mutants, 37 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-photo-preserve.json`, over
`worker.js`, `builder/site-images.mjs` and `builder/site-add.mjs`, against seven
test files — a narrow list can only produce a false SURVIVOR, never a false
kill). **Pass 1 read 37/31/6 and NOT ONE SURVIVOR WAS THE PRODUCT'S**: five were
gaps in this change's own guards and the sixth was the inert `planned` above.
Two of the five are worth keeping as rules:

- **A 422 SAYS `ok: false` AND THE BROWSER READS THE FIELD, NOT THE CODE.**
  Both refusal cases asserted the status and the error and never `ok`, so a
  mutant flipping it survived — and `chat.js` renders such a reply as a
  successful change.
- **`String(["…"]) === "…"` REACHED THE READER THAT DECIDES WHAT A SITE OWNS.**
  Every junk shape the case drove (`null`, `["a"]`, `123`) answers empty either
  way; a one-element array whose entry holds a quoted url does not. That
  coercion has shipped as a real bug three times here, and in `photoUrls` it
  would fire a wall over a file whose `source` is not a string at all.

**Suite 6,828** — 6,816 + 7 (`addon-route`) + 5 (`site-images`), **and the
arithmetic closes exactly against baselines measured in a detached worktree at
`aec76dc6`** (`addon-route` 111, `site-images` 73, `site-addon` 89) rather than
subtracted from a paragraph. `site-addon` stays 89: its change is a re-anchor
inside a case that already existed.

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH, NO EDIT-PATH WORK.**

**KEPT RECORDED, NOT FIXED — two more places the same sentence is wrong, both on
the BUILD path and both out of this round's scope:**

1. **The bare-COUNT paid form still says *"Every OTHER image stays a
   `<SafeImage>` with no src."*** — the same missing-src shape the list form just
   lost. Only the build path reaches it (the addon always sends the object), so
   correcting it is a change to the build path's prompt with its own guards and
   its own live-proof economics.
2. **`imageDirective(0)` says *"PHOTOGRAPHS: none on this site"*, which is FALSE
   on a revise of a photographed site** — `budgetFor` answers 0 there precisely
   because the site HAS photographs. It is the reported defect, on the build
   path, reached whenever an owner revises a site with pictures. Fixing it needs
   the inventory threaded into the build path's call, which is where the object
   form already knows how to say it.

### …AND A REFUSAL STORED THE DESIGN ON ITS WAY OUT (2026-09-17)

Owner: *"`patchSiteConfig` runs before `keptImages`. A combined gallery + photo
+ QR request that fails with `lost-photos` leaves the QR persisted, although the
gallery was never published."*

**REPRODUCED THROUGH `POST /api/site/<slug>/addon` BEFORE ANYTHING WAS TOUCHED**,
on exactly that ask: **422 `lost-photos`, `cost: 0`, nothing compiled, nothing
bought, `source/<slug>/pages.json` untouched** — and `look.qr` left holding
`{name: "gallery", points: "https://<slug>.gofarther.app/gallery"}` for a route
that will never exist. **A QR is the one thing here somebody PRINTS**, which is
what the `qr-dependency` refusal one block up exists to prevent; it arrived
through the refusal path instead.

**THE REACH IS ONE DAY, MEASURED RATHER THAN ASSUMED.** `lost-photos` is the
ONLY refusal that was ever below the store — `rewrote` and `qr-dependency` are
both ABOVE the old position — so the defect is the previous entry's own sibling,
shipped the same day. *A rule true because of the layer below it expires when
that layer moves*, met from the other direction: **the rule stood still and a
refusal was added underneath it.** The store's own comment read *"every refusal
above leaves the site exactly as it was"*, which was TRUE when written, which
nothing tested, and which is why nobody looked.

**MOVED RATHER THAN COMPENSATED FOR** — the other option the owner offered, and
the weaker one: a restore-on-refusal is a second repair path that can itself
fail, and a failed restore leaves the site wrong with nothing left to try.
Moving the write below every refusal keeps ONE rule — *a refusal changes
nothing* — instead of a rule plus an exception. **And the move makes the
store-to-publish window strictly SMALLER**, so it cannot have introduced an
unreverted refusal of its own: measured, the only `return` in that window is the
write's own failure, which stored nothing.

**THE WHOLE CONFIG IS THE ASSERTION, NOT THE ONE FIELD.** `look.qr` is what the
report named, and pinning only that passes again the day some other field is
written above a wall; `deepEqual` over the entire stored object answers *did this
refusal write ANYTHING* in one claim. Before the move it answered a 22-key merged
look; after, the seeded two.

**AND THE SWEEP ASKED FOR THREE MORE CASES — every one a branch of the block
that moved, and not one of them drivable.** The fixture's every `put` succeeded
and its compiler always answered `ok`, so three of the store's four behaviours
had no seam at all:

- **A change with nothing to store must not rewrite the config.**
  `withConfig(cur, undefined)` NORMALISES — measured, it answers a seven-key
  config where the site had two — so `if (aLookPatch)` is what keeps five
  settings off a site that never asked for them. A page-only addon publishes
  with the config byte-identical.
- **A refused write is said out loud**: 503, `error: "config"`, `cost: 0`,
  nothing compiled, and the site really as it was — the claim its own sentence
  makes.
- **⚠ AND A FAILED PUBLISH PUTS THE OLD LOOK BACK, WHICH IS THE CLAIM THIS
  CHANGE'S OWN COMMENT MAKES.** An invariant asserted in a comment and tested
  nowhere is exactly how the defect above shipped. Leaving it undrivable would
  repeat that mistake inside the fix for it, so the fixture gained two knobs
  (`configFail` throws on the config key alone, `compileFail` refuses the build)
  rather than the survivors gaining a paragraph.

**THE REVERT IS NOT BYTE-IDENTICAL AND THE CASE SAYS SO** rather than asserting
something false: it writes the look as the route READ it, which `markOf` has
already normalised, so `favicon` and `wordmark` come back as forms the seeded
object never carried. What must be true is that nothing this change DESIGNED
survived (`qr`, `three` absent) and nothing the site had was lost (`theme`,
`description` intact).

**⚠ TWO OF MY OWN MUTANTS WERE BADLY WRITTEN AND BOTH WERE CAUGHT BY MEASURING
THEM, NOT BY READING THEM.** One set `aStored = true` above a `return`, so the
503 still went out and nothing about the request changed — **inert by
construction**. The other read `cost: aCost`, and `let aCost = 0` has its ONE
assignment under `if (aJob)`, which the route's synchronous path never takes —
so it *was* `cost: 0` on every path a test can reach, while being a real
difference on the job path. Both replaced with observable forms (`if (false &&
!w.ok)`, `cost: 1`). *Read what a mutant really does, not what it was meant to
do.*

**AND THE PRE-RUN ANCHOR CENSUS PAID FOR ITSELF**: `if (!w.ok) {` occurs **four
times** in `worker.js`, so that mutant would have silently mutated the wrong
site. Anchored with its neighbour — the recorded *check every anchor occurs
exactly once BEFORE the run, rather than reading NOT APPLIED afterwards*.

**Guards**: `addon-route` **118 → 123** — the regression the owner asked for
(the whole prior configuration, its pages and its components, with no purchase
and no compile), its control (the same request succeeding), and the three the
sweep asked for. The regression and the control were proved RED/green against
the pre-change product, and **the control passes on BOTH trees**, which is what
makes it a control rather than a second copy of the case.

**⚠ AND THE CONTROL FAILED FIRST ON A FIXTURE THAT NAMED A THING THE PRODUCT
DOES NOT HAVE.** The prior look invented the theme `kraft`; `FIELD_KEEPS.theme`
judges a stored theme against all 500 registry ids, so `mergeLook` dropped it to
`null` and the case reported the successful store as losing the site's theme.
It is `THEME_IDS[0]` now **with the reason written beside it** — a quiet name
swap would have appeased the check without recording why.

**Sweep: 8 mutants, 8 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/addon-refusal-order.json`, over
`worker.js`, against 11 test files — a narrow list can only produce a false
SURVIVOR, never a false kill). Pass 1 read 4/4 and **not one survivor was the
product's**: two were the badly-written mutants above and two were the undriven
branches the three new cases now cover.

**Suite 6,833** — 6,830 + 3 (`addon-route` **120 → 123**), and the arithmetic
closes exactly. **⚠ AND THE FIRST STAMP OF IT WAS DERIVED AND WRONG**: 6,835,
from "118 → 123, so five" — but the 6,830 reading was already taken with two of
those five in the file, so the delta is the THREE added since. Held as PENDING
until the run answered rather than published and corrected. *Measure the
baseline; never subtract from a paragraph* — this file's own rule, in the round
that records it.

**CI HAS READ BOTH, ON `bb7b4214`.** `unit tests` run **2691**, green
(2026-09-17 23:27:57→23:29:50Z) — `# tests 6833 / # pass 6829 / # fail 0 /
# skipped 4`, against local `6833 / 6833 / 0 / 0`; the four are the three
recorded environment skips plus `site-searchpath`'s baseline-commit case, and
**the TOTAL is what matches**. And `site build` run **1183**
(23:27:57→23:51:56Z), **all twenty steps green**: `site-build.mjs` **382 passed
/ 0 failed**, with kit-typecheck 4, contrast-cases 16, theme-seam 11,
theme-render 29, site-routing 14, site-runtime 47 beside it, and kit-render /
kit-a11y / kit-effects / kit-paint each `all passed` with no count — the three
result SHAPES a census has to ask for. Every count bounded landmark-to-landmark
(`##[group]Run …` to the next), **0 result lines before the first marker**. It
fired because `worker.js` moved. **The unit step's TAP is `# pass 396 /
# fail 0`, unchanged from runs 1171, 1173 and 1177** — correct, because this
round adds no `page-gen` or `publish-pages` case. **THE REFUSAL-ORDER DEFECT IS
CLOSED.**

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH, NO EDIT-PATH WORK.**

### THE INSTRUMENT FOR THE PAGE + PHOTO + QR LIVE TEST (2026-09-18)

Owner, six corrections to the preparation. Four are code and all four are the
same class — **the harness could not see what the run is bought to prove.**

**1. IT WAS PHOTOGRAPH-BLIND, MEASURED RATHER THAN SUSPECTED: `pictures`,
`pictureNote`, `photos` and `lostPhotos` occurred ZERO times in
`scripts/addon-sweep.mjs`.** A run bought to prove a photograph was bought,
preserved and placed would have come back with no reading of any of it — this
repository's own recorded wiring defect (`shownSteps` was recorded by the route
for a milestone and printed by nobody), in the instrument built to settle it.
`photoLines` prints all four **on every outcome**, which the free-text branch
already makes possible by running its check on refusals too.

- **ABSENT IS NOT ZERO, AND THE TWO READINGS ARE THE POINT.** `photos` rides
  every SUCCESS whatever was asked for; `pictures` rides only a change that
  really bought one. So `photos` present with `pictures` absent is *it shipped
  and bought none*, and BOTH absent is *the request never reached the
  purchase*. A bare `0` collapses them.
- **THE PICTURE SENTENCE IS PRINTED VERBATIM** — it is the one thing that can
  tell four identical blank frames apart (bought, unaffordable, provider
  refused, none asked for), so a word of our own in its place would be the
  harness deciding which of the four it was.
- **AND `coverNote` ALONE WAS "THE CUSTOMER WAS TOLD".** A refusal's whole
  reply is `msg`, so the one outcome whose entire customer-facing text lives in
  a single field was the outcome that lost it. `customerLines` prints `msg`
  plus every `*Note` carrying a string, **DISCOVERED FROM THE REPLY** rather
  than from a list typed here — and a census over `addonReplyText`'s own
  verbatim prints proves that rule reaches all of them (measured: exactly
  three, `pictureNote`, `coverNote`, `keptPartsNote`). Not a re-composition:
  writing the browser's concatenation out here would be a second copy of it.

**2. QUEUED WORK IS REQUIRED BEFORE ANY PAID POST, AND IT IS NOT A BOX THE
CALLER CAN FORGET.** `async` off means the addon runs inside the Worker's
isolate, bounded by the customer's own connection at ~270 s — run 45 died at
270,025 ms with the credits gone. **UNCONDITIONAL, deliberately**: the
`expect*` pair asks *is this the build I meant* and has nothing to answer when
nothing was demanded; this asks *can the work survive at all*, which is true of
every run. As a caller's flag it would be an input, and an input cannot be the
wall. `!== true`, so the string `"true"` is cannot-tell and not a yes; `false`
and cannot-tell get **different sentences**, because one is a switch somebody
can turn on and the other is a route that did not answer. The wrapper hands
`runtime.async` over RAW — a `|| false` there, or a `=== true`, turns *nobody
answered* into *the switch is off*.

**3. A QR'S DESTINATION IS READ OFF THE DRAWING, AGAINST EVERY ADDRESS THE SITE
HAS.** `qrModules`/`qrEncodes` are the guard's own matrix comparison lifted
into `builder/site-qr.mjs` — the module that EMITS the path owns the reader of
it, so the live check and the guard cannot disagree about our own artwork.
**Not a decoder, and that is the stronger claim**: a decoder says what a
scanner happens to read; this says the drawing IS the canonical encoding of the
text expected. `qrOpens` asks every candidate, so the answer is *which page
this code opens* rather than *does it open the one somebody guessed*, and the
NAME comes from whichever file the inventory diff shows appeared.
**THE QUIET ZONE IS DERIVED, NOT PASSED IN** — a served file is all a live
check has. **Two defects found by RUNNING it**: `matchAll` SKIPS what it cannot
match, so one malformed stroke in four hundred was silently dropped and the
drawing read as a code missing a few modules, which a comparison then blames on
the payload; and the stroke counter's `\b` matched only the FIRST `M`, because
`z` and `M` are both word characters, so it counted 1 stroke in a path of 295.

**4. THE INVENTORY IS THE STORED SOURCE, BOTH SIDES, TAKEN IMMEDIATELY BEFORE
THE POST.** Not the sitemap — a list the publish COMPOSES, cached as its own
object at the edge (run 23 called a real new page a lie on it), and silent
about codes and pictures — and not probed filenames, which answer about the
name somebody guessed and no other. `GET /api/site/source?slug=` is the store:
every page, every component, and `assets`, which carries each code's file name
AND the drawing the build bakes. Routes through `sitePathOf`, photographs
through the product's own `photoUrls` over pages AND components, codes by
`qrFile`'s own naming (**the legacy single code is `qr.svg`, with no name in
it — a `qr-` prefix test would miss it on exactly the oldest sites**). A read
that FAILED is `null` and says so: an inventory nobody took and a change that
moved nothing print the same zeroes otherwise. **And a browser answers whether
the new picture renders** — `naturalWidth`, because a 200 on the file says the
bytes are served and a `src` says the page asked for it, and neither says a
visitor sees anything.

**Guards**: `addon-sweep` **40 → 46**, `site-marks` re-anchored onto the shared
reader with the observer proved alive both ways. **Suite 6,833 → 6,839**, and
the arithmetic closes exactly. **Sweep: 29 mutants, 29 killed, 0 survived, 0
never applied, 2 comment-only controls survived.** Pass 1 read 23/6 and **not
one survivor was the product's** — five were walls nobody drove and one was
measured INERT and is declared in the code (an empty reference matrix cannot
happen through `qrcode-generator`: the finder patterns are always drawn, and
even the EMPTY payload gives 21×21 with **234 dark modules**).

**CI HAS READ BOTH, ON `361ae0fb`.** `unit tests` run **2698**, green
(2026-09-18 00:58:59→01:00:52Z, the suite step 94.9 s) — `# tests 6839 /
# pass 6835 / # fail 0 / # skipped 4`, against local `6839 / 6839 / 0 / 0`; the
four are the three recorded environment skips plus `site-searchpath`'s
baseline-commit case, and **the TOTAL is what matches**. And `site build` run
**1187** (00:59:00→01:24:00Z), **all twenty steps green** — the API answers 23
and three are GitHub's own (`Post` ×2 and `Complete job`): `site-build.mjs`
**382 passed / 0 failed**, the step 01:01:15→01:19:20Z (18m05s), with
kit-typecheck 4, contrast-cases 16, theme-seam 11, theme-render 29,
site-routing 14, site-runtime 47 beside it and kit-render / kit-a11y /
kit-effects / kit-paint each `all passed` with no count — the three result
SHAPES a census has to ask for. Every count bounded landmark-to-landmark
(`##[group]Run …` to the next), **0 result lines before the first marker**.
It fired because `builder/site-qr.mjs` is under `builder/**` — this round moves
product code the container carries, which the harness one is not.
**The unit step's TAP is `# pass 396 / # fail 0`, unchanged from runs 1171,
1173, 1177 and 1183** — correct, because this round adds no `page-gen` or
`publish-pages` case. **The two `##[error]` lines are the harness's own
typecheck fixtures** (`TS2322` on `index.tsx`, `TS2339` on `menu.tsx`), both
inside the `site-build.mjs` window and each followed immediately by its own
`ok` line — the recorded "the typecheck REPORTS; only `vite build` refuses",
visible in CI in a green job.

#### …AND THREE BOUNDED CORRECTIONS TO IT (2026-09-18)

Owner, on the async stop: *"Three bounded corrections remain before the paid
test."* Each is a claim the instrument was making and could not support.

**1. PUBLICATION IS READ OFF THE PUBLISHED FILE, NOT THE STORED SETTINGS**
(*"The source endpoint regenerates QR drawings from settings; comparing those
does not establish publication."*). `assets` on `/api/site/source` is
`siteAssetFiles(config)` — the drawing COMPOSED FROM THE SETTINGS at the moment
of the read, which is what the container bakes FROM and is not a reading of what
it baked. A publish that never ran, a build that refused, a file the sweep took:
every one leaves the settings perfect and the site without the code.
`qrPublished` GETs the file from the public origin with no token and answers
**four ways, because they need four different fixes** — not served at all (the
publish is missing), served but unreadable (a broken drawing shipped), served and
opening the wrong page, served and opening the one asked for. **TWO LABELLED
LINES PER ADDED CODE, NEVER MERGED** (*"Keep the stored inventory and
public-site observations distinct."*), and the disagreement is the finding.

**MEASURED LIVE on fretwork-1**: `qr-prices.svg` **200 / 3,256 B** and it
verifies against `/prices` by re-encoding; `qr-nope.svg` **404**; `qr.svg`
(the legacy single code) is served at 2,290 B and **opens none of the site's
three addresses** — a real fact about that site, and the reader behaving
correctly rather than a defect.

**⚠ AND MY OWN FIRST "IS THIS A DRAWING" TEST FAILED, caught by running it.**
`/<svg[\s>]/` passes fretwork-1's **home page at 58,642 bytes**, because a React
page is full of inline icon SVGs — so a site answering its index document for an
unknown path read as `served: true`, and a MISSING FILE was reported as a BROKEN
DRAWING, which points at the wrong fix. The test is whether the answer **IS** an
SVG document: prolog and doctype off, then `^<svg`.

**2. THE CUSTOMER'S SCREEN IS THE BROWSER'S OWN COMPOSER, EXECUTED** (*"Reuse or
execute the existing formatter; don't create another composition."*).
`browserReply` loads `public/chat.js` and runs `addonReplyText` + `renderTail`
out of it — the `cut()` + `new Function` pattern `test/site-addon.test.mjs`
already uses, with `EditPoll` through `createRequire`. **WHY THE GAP EXISTED IS
THE REUSABLE PART**: the per-field census proves its discovery rule (`msg` plus
every `*Note`) complete for what the browser prints **VERBATIM**, and says
nothing whatever about what it **COMPOSES** — which is most of what a customer
reads. A reply carrying none of those fields printed `NOTHING`; it now prints
the success sentence, the placeholder explanation and the missing-link warning.
The per-field breakdown stays beneath it, relabelled: one is the screen, the
other is which field carried which sentence, and they fail differently.

**3. INVENTORY COMPLETENESS IS OBSERVABLE, AND AN INCOMPLETE BEFORE-READ STOPS
THE RUN** (*"An incomplete before-read must stop this test before spending; an
incomplete after-read must make preservation unverified. Checking HTTP status
alone is insufficient."*). Four loaders in `/api/site/source` collapsed a failed
read into an empty list, and **`loadConfig` had answered `{ok, why}` since it was
written and the route dropped it on the floor** — the value computed and never
forwarded, in the half that carries a customer's QR codes. So a bucket that threw
answered byte-identically to a site with nothing on it, and a comparison taken
across it said *"nothing was added and nothing was lost"*.

- **`readSiteSource` IS THE THREE-STATE READER** — `readSiteParts`' shape one
  store over — and `/api/site/source` carries **`reads`**, one boolean per store
  the inventory is built from (`pages`, `parts`, `assets`; **not** `kit` or
  `shared`, which nothing compares). **THE 200 AND `ok: true` STAY**: the
  explorer is a read-only tab and must get everything readable; what was missing
  was the ability to say so.
- **`loadSiteSource` BECOMES A THIN WRAPPER**, so its nine callers are unchanged
  and there is one reader underneath. **Its `null` still covers the EMPTY array
  deliberately** — every one of those callers asks "is there source to work
  from", where a stored `[]` and no object at all are the same answer.
- **AN ABSENT OBJECT IS A READ THAT SUCCEEDED.** A site that has never published
  has no `pages.json`, and reading that as a failed store would make every new
  site look broken.
- **`complete` IS THREE STATES AND `null` IS THE ONE THAT MATTERS.** An older
  Worker sends no `reads` and CANNOT SAY; reading its silence as "complete" is
  how this instrument goes back to reporting an unread store as an empty site.
  It **REFUSES**.
- **`inventoryRefusals` IS PURE AND EXPORTED, AND THE EXIT IS BEFORE THE POST** —
  the only reason it can be a refusal rather than a note printed over a run
  already under way. **Three refusals, three sentences**, because they point at
  three different fixes: a route that did not answer, a Worker that cannot say,
  and a store that failed.
- **AN INCOMPLETE AFTER-READ PRINTS `PRESERVATION UNVERIFIED`** and says the ±
  counts are not evidence. **A loss seen across an incomplete pair is still
  said**: incompleteness makes an ABSENCE untrustworthy, never a PRESENCE.

**⚠ AND THE PAID TEST NOW NEEDS THIS DEPLOYED BEFORE IT CAN RUN.** Main's
`worker.js` has no `reads` (checked, not assumed), so the harness against the
live Worker today answers `complete: null` and **refuses**. That is the owner's
own instruction taken to its conclusion rather than a regression, and it makes
the order **merge → deploy → press** rather than press.

**PLUS THE PLACEMENT HALF** (*"Verify the new image loads and inspect its actual
placement."*). `imagesOn` read `naturalWidth` — the FILE's own size — so a
picture whose bytes arrived perfectly into a collapsed container renders at 0×0
and was invisible to it. It reads the rendered rect, the offset down the
document and the nearest heading above, and **the two failures are counted
apart**: a file that never arrived and a file laid out to nothing need different
fixes, and only the first is what a 404 on the image produces.

**AND ONE DEFECT THIS ROUND FOUND IN ITS OWN READER: `want` was a parameter
`inventoryLines` has always accepted and NOBODY passed**, so the ✓/✗ against the
expected address had never once printed in a live run — the recorded
value-never-forwarded defect, in the reader for the claim the run is bought to
make. It is the route THIS change added, discovered from the reply.

**TWO EARLIER OBSERVATIONS WERE MY FIXTURES' DEFECTS, NOT THE PRODUCT'S, and
both were measured rather than claimed.** `unlinkedPages` returns `routeOf(path)`
— routes, not file paths — so *"Nothing links to `src/routes/gallery.tsx`"* came
from a driver handing it the wrong shape; and `mergeAddonSchema` does
`added.push(copy.name)`, so `tables` carries NAMES and a guard's `[{name}]`
fixture is what produced *"now storing [object Object]"*. **The browser's
composer is what exposed the second**, the moment the report started printing the
customer's real screen — *derive a fixture from its real producer*, in the guard
for a reader of that producer's output.

**Guards**: `addon-sweep` **46 → 48** (the published-file reader with its four
answers, its HTML-page control and its prolog control; the gate, its three
distinct refusals and the unverified-preservation half with its complete-pair
control), `site-source` **72 → 73** (the `reads` field driven per store, with an
absent object asserted as a read that SUCCEEDED). **Every new case proved RED
against the pre-change product**: three red in `site-source`, and `addon-sweep`
red at IMPORT — which is honest and is the weaker form, so the per-assertion
proof is the sweep.

**Five older guards re-anchored, not appeased — and one is a HOLE rather than a
count.** `site-busy`'s bare-reader census counted only `loadSiteSource`, so
`readSiteSource` was a **second non-repairing reader a publishing read could walk
onto unseen**: move `let eSrc = …` across and nothing noticed. It counts both
now, **6 → 7**, and the seventh is the wrapper's own delegation — measured, not
predicted, because a first draft of that comment called it the sixth.

**Sweep: 38 mutants, 38 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/live-test-instrument.json`, over
`scripts/addon-sweep.mjs` and `worker.js`, against five test files — a narrow
list can only produce a false SURVIVOR, never a false kill). **Pass 1 read
37/34/3 and NOT ONE SURVIVOR WAS THE PRODUCT'S**; all three are worth keeping:

- **THE TAIL WAS DROPPED AND NOTHING NOTICED.** `renderTail` prints
  `renderNote` — what the render check found, which the route puts on every reply
  that has one — and **no fixture anywhere carried one**, so a composer running
  `addonReplyText` alone looked right on every clean reply and would have lost
  exactly the ones worth reading.
- **A POSITIONAL GUARD CANNOT SEE A DEAD BRANCH, and this file already records
  the trap.** `if (false) { … }` leaves `process.exit(1)` exactly where a search
  finds it — which is how the deploy pre-flight's own gate survived its first
  sweep two rounds ago, and how this one survived its first. The gate is asserted
  by its own CONDITION now.
- **THE BROWSER READING IS LIFTED AND DRIVEN rather than declared unguardable.**
  It ran inside `page.evaluate`, so no unit case could reach it — *a wall nobody
  can drive is a wall nobody is guarding*, on a READING whose wrong answer is a
  report saying the picture is fine when it is not. `IMAGE_READING` is the SOURCE
  `page.evaluate` is handed (the shape `browserComposer` already uses), so a
  guard `new Function`s it with `document` and `window` as parameters and drives
  the real text: **box 720×540 from the rect against a file of 1600×1200**, the
  offset, the folded heading, and a picture whose bytes arrived into no size.
  **Plus the free-identifier wall** — Playwright ships the TEXT to the page, so a
  module name in there throws in the browser and comes back as "the image read
  failed", the recorded free-identifier trap with a browser between the halves.

**THE ANCHOR CENSUS PAID FOR ITSELF AGAIN: 11 of 39 anchors were not exactly
once** on the first write, every one caught before the run rather than read as
NOT APPLIED afterwards.

**Suite 6,842** (6,842 pass, 0 fail, 0 skipped) — **and the arithmetic closes on
measured numbers, not subtracted ones**: the three affected files read **137** at
`28dc6e4e` in a detached worktree and **140** now, against 6,839 → 6,842.
`site-busy` stays 19: everything it gained is an assertion inside a case that
already existed.

**CI HAS READ BOTH, ON `20792563`.** `unit tests` run **2701**, green (2026-09-18
02:36:58→02:39:09Z) — `# tests 6842 / # pass 6838 / # fail 0 / # skipped 4`,
against local `6842 / 6842 / 0 / 0`; the four are the three recorded environment
skips plus `site-searchpath`'s baseline-commit case, and **the TOTAL is what
matches**. And `site build` run **1188** (02:36:58→02:56:53Z), **all twenty steps
green** (the API answers 23; three are GitHub's own — two `Post` steps and
`Complete job`): `site-build.mjs` **382 passed / 0 failed**, the step
02:38:49→02:53:09Z (14m20s), with kit-typecheck 4, contrast-cases 16, theme-seam
11, theme-render 29, site-routing 14, site-runtime 47 beside it and kit-render /
kit-a11y / kit-effects / kit-paint each `all passed` with no count — the three
result SHAPES a census has to ask for. Every count bounded landmark-to-landmark
(`##[group]Run …` to the next), **0 result lines before the first marker**, and
none carried over from an earlier run. **It fired because `worker.js` moved** —
the three-state reader and the `reads` field; the push carried the code and these
documents together, `28dc6e4e` having already gone out on its own as `unit tests`
2700. **The unit step's TAP is `# tests 396 / # pass 396 / # fail 0 / # skipped
0`, unchanged from runs 1171, 1173, 1177, 1183 and 1187** — correct, because this
round adds no `page-gen` or `publish-pages` case. The two `##[error]` lines are
the harness's own typecheck fixtures (TS2322 on `index.tsx`, TS2339 on
`menu.tsx`), both inside the `site-build.mjs` window and each followed
immediately by its own `ok` line.

**AND THE FLAT-LOG WINDOWING WAS CHECKED AGAINST A SECOND, INDEPENDENT BOUNDING
FOR THE FIRST TIME — they agree exactly.** The run's log archive carries **one
file per step** (`build/11_Run node test_integration_site-build.mjs.txt`), so a
count read there is attributed by construction rather than by a window somebody
drew. Both readings find the same **twelve** steps carrying a result, the same
counts, in the same steps. That is worth a line because the landmark-to-landmark
window is the instrument this file records and revised once already (run 1152
concluded the `##[group]` bounding "did not attach"; run 1163 falsified it), and
until now nothing had asked a second instrument the same question.

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH** — the owner's instruction, and
every passing control was retained.

#### …AND THE MEASUREMENT KILLED MY OWN RECOMMENDATION

**`ashgrove-1` SHOWS NO PHOTOGRAPH, and the claim that it was the only suitable
site is WITHDRAWN.** Its one `/u/` reference is `og:image` — the share card —
and its page carries **zero `<img>` tags at all**. The earlier correction to
this file was right that fal was not empty and that a photograph was bought;
inferring from that to *"a site with existing photographs on its pages"* was
not, and one probe says so. **A file being served is not a picture being
shown.**

**MEASURED over the 32 sites this file names** (which is NOT the ~70 the
account has, so this is a sample and not an enumeration — the authoritative
list needs `/api/site/list` and a token). Telling an on-page photograph from a
share card is the whole of it: `og:image`/`twitter:image` are meta content and
were counted separately.

| site | `<img>` | on-page photographs | routes |
|---|---|---|---|
| `fold-lane-bakery` | 2 | **2** | `/ /order /the-starter /visit` |
| `oak-and-ash` | 1 | **1** (`data-slot="photo"`) | `/ /make /work /workshop` |
| `shoeroom-1` | 2 | **1** | `/` (162 KB page) |
| `forno-and-co` | 1 | **1** | sitemap EMPTY |
| `fretwork-1` | 3 | **0** | two QR codes: `/qr.svg`, `/qr-prices.svg` |
| `ashgrove-1` · `repairbench-1` · 26 others | 0–3 | **0** | — |

All are React sites; **none carries `x-site-version`**, so every one is still
on the legacy prefix and its next publish moves it to the build layout.

**THE TENSION IS REAL AND IS THE OWNER'S CALL: no site is strong on both
halves.** The four with photographs are the owner's older sites and have no QR
codes, so *"a new code does not disturb the existing ones"* is untestable
there; `fretwork-1` is the strongest QR subject and has nothing to preserve —
and `keptImages` SHORT-CIRCUITS on a site with no photographs (`if (!had.size)
return {ok: true}`), so running the preservation test there is **vacuous by
construction**, which is exactly the shape this repository keeps catching.

**AND `fretwork-1`'s TWO CODES ARE THEMSELVES THE "DON'T GUESS FILENAMES"
LESSON, live**: a probe of five plausible names found `qr.svg` and missed
`qr-prices.svg`, which the page references and which serves perfectly well.
The before-inventory finds both, from the store, without guessing.

**NOT MERGED, NOT DEPLOYED, NO PAID DISPATCH, NO BACKEND REPAIR.** The balance
and fal's readiness are both unreadable from here — re-checked, not asserted:
every `SUPABASE_*`, `OWNER_*` and `FAL_*` name is ABSENT from this
environment — so both are the owner's read, and the estimate below is an
estimate and not a cap.

#### …AND THE SUCCESS COMPOSER RAN ON REFUSALS: SELECTION IS A LAYER TOO (2026-09-18)

Owner: *"`browserReply` invokes the success formatter on refusals. For
`{ok:false, error:"lost-photos", msg:"Nothing was published and nothing was
charged."}`, the harness labels '✅ Done.' as the customer's screen. The
browser's `addonAnswer` instead displays the warning plus `msg`. Respect the
browser's actual response selection, including HTTP status."*

**REPRODUCED BEFORE ANYTHING WAS TOUCHED, on the owner's exact body: the harness
answered `"✅ Done."` where the browser shows `"⚠️ Nothing was published and
nothing was charged."`** — a refusal that published nothing, reported as the
change having landed, on the run bought to read what the product says.

**THE CAUSE IS THE ROUND BEFORE THIS ONE FIXING THE LAYER ABOVE IT.** That round
stopped the harness re-composing the reply and made it EXECUTE `addonReplyText`
out of `public/chat.js` — correct, and `addonReplyText` is the SUCCESS composer.
The browser SELECTS first: `addonAnswer` has four answers (an escalate hops
sideways or falls, a null body falls, a non-2xx **or** `ok:false` shows `'⚠️ ' +
msg` or falls, and only the last reaches `applyAddonResult` and the composer).
So COMPOSITION was fixed and SELECTION was left re-implemented as *"always the
success one"* — **the recorded two-copies trap one layer up from where it had
just been closed.**

**`addonAnswer` IS EXECUTED NOW, with `applyAddonResult` and `alsoTail` beside
it**, so the real call site runs rather than two-thirds of it. `alsoTail(d)` gets
`d: undefined` and that is honest rather than a hole: `d` is the ROUTING
decision (`/api/site/route`'s answer) and carries `alsoAsked` alone, the harness
posts straight to the addon route, and `alsoTail(undefined)` is `''`.

**`httpOk` IS `Response.ok` AND IS NOT DERIVABLE FROM THE BODY — and the pair
that proves it is not the reported one.** `{ok:false}` reaches the refusal branch
at ANY status, so the owner's body cannot show the status being read. A body that
claims success at a FAILING status is where they disagree, and it is the real
shape: measured, `{ok:true, added:[…]}` at 200 composes `✅ Done — added
/gallery` and the same body at 422 composes nothing and falls. The status is
carried from the POST (`extra.status = p.status`) rather than guessed at.

**`httpOkOf(status)` HAS THREE STATES AND THE THIRD REFUSES.** `null` for a
status nobody recorded — an answer the browser never has and this harness can —
and `browserReply` then answers `NOT COMPOSED` rather than picking a branch:
reading it as `false` reports a refusal screen over a successful change, as
`true` it is the reported defect.

**NO EXTERNAL ACTION CAN OCCUR, AND THAT IS STRUCTURAL RATHER THAN CAREFUL.** The
two arms that reach outside are INJECTED recorders — `siteEdit` (the sideways
hop, a SECOND PAID POST) and `o.fallback` (the ~25-credit full rewrite) — so each
is reported as a thing the browser WOULD do and none of them happens; `siteById`
answers `null`, so the whole local-record mutation block is skipped and
`sitesSave` is **unreachable**; `scheduleCreditRefresh` is recorded and does
nothing. **And they are REPORTED**, because a run that printed only the text
would be silent about the expensive half of what the browser would do.
`o.instruction` and `o.fallback` are both real, because `canFall` reads them and
the browser has both on every post this harness makes — handing in neither would
drive the lost-the-original-message branch, a screen these posts can never
produce, which is a fixture LESS capable than reality in the one field the
selection turns on.

**Guards**: `addon-sweep` **48 → 49**, the new case driving all four branches
plus the status pair, the cannot-tell refusal, the recorded actions and the
entry-point census. **PROVED RED against the real pre-change shape** — the
success composer restored surgically so the module still loads: `"✅ Done."`
against `"⚠️ Nothing was published and nothing was charged."`, and **two** cases
go red, the new one and the re-anchored refusal case.

**Three older guards re-anchored, not appeased.** The refusal-reader case gained
the refusal SCREEN (it is the case about that outcome, so it is where that screen
belongs); the free-text verdict case moved onto `addonAnswer` **with the status
it was handed asserted** — a hardcoded 200 inside `customerLines` satisfies the
label alone; and the wiring assertion became `customerLines(r, x && x.status)`,
with `extra = { status: p && p.status }` asserted beside it, because a reader
handed nothing answers NOT COMPOSED on every case of a paid run.

**Sweep: 25 mutants, 25 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/browser-selection.json`, over
`scripts/addon-sweep.mjs`, against `test/addon-sweep.test.mjs`).
**Pass 1 read 24/23/1 and the one survivor was MEASURED INERT, not a guard
gap**: the `: null` coercion. **32 probes over sixteen bodies × both statuses ×
three coercions found ZERO differences**, because every non-success branch of
`addonAnswer` converges on the fall. **It is KEPT, and the rule decided it**: the
deadness is a property of a NEIGHBOUR (chat.js's convergence) rather than of the
expression, and the line is what the page's own reader hands in — so it is
declared with its measurement and given a READER, the browser's own
`r.json().catch(() => null)` asserted beside it, so the two cannot drift
silently. **A two-file pair is not expressible** — `scripts/mutate.mjs` applies
one `from`/`to` per entry against `files[0]`, which this file already records —
so the replacement is an observable mutant of the same line (hand on nothing at
all) with the correspondence mutant beside it. Both killed on pass 2.

**Suite 6,843** — 6,842 + 1, and the arithmetic closes exactly against a baseline
**measured in a detached worktree** (`addon-sweep` 48) rather than subtracted
from a paragraph.

**CI HAS READ IT: `unit tests` run 2719 on `d1457ad9`, green (2026-09-18
19:29:57→19:32:17Z, the suite step 109 s) — `# tests 6843 / # pass 6839 /
# fail 0 / # skipped 4`**, against local `6843 / 6843 / 0 / 0`; the four are the
three recorded environment skips plus `site-searchpath`'s baseline-commit case,
and **the TOTAL is what matches**. **No `site build` fired and none was due** —
the five changed files are two documents, `scripts/addon-sweep.mjs`, a mutant
spec and `test/addon-sweep.test.mjs`, and not one is under `builder/**`,
`worker.js`, the root `*.mjs` glob, `test/integration/**` or any other entry in
that workflow's `paths`.

**AND HARNESS PREPARATION IS CLOSED HERE.** Nothing further is added to the
instrument.

**THE IDENTIFIERS, COMPUTED BEFORE ANYTHING MOVES, AND CROSS-CHECKED AGAINST
REALITY.** `origin/main` (`d826d7fb`, docs-only over deploy 2133) hashes to
**`7273d2569866364f`** (183 inputs) — **which is exactly the image deploy 2133's
own log records rolling to**, so the arithmetic is checked against the live
container and not only against itself. The candidate tip hashes to
**`3b93a9cae43bac41`** (183 inputs); the ids differ because `worker.js` and the
`builder/*` modules this branch moves are in the worker's module graph, which is
an image input. **The branch is a clean fast-forward of main** (`git merge-base
--is-ancestor origin/main HEAD` → yes, with no main commit outside it), so
`expect_deploy` is the branch tip itself rather than a merge commit nobody can
name yet. **The container WILL roll, so the 15–20 minute hold applies.**

**THE ORDER IS MERGE → DEPLOY → PRESS, and that is the previous round's own
instruction taken to its conclusion**: the harness refuses to spend when it
cannot confirm the before-inventory was complete, main's Worker sends no `reads`
key, so a press against the live Worker today REFUSES. The live-test inputs are
in `docs/owner-notes.md`.

#### MERGED AND LIVE — deploy 2134 (2026-09-18), and the press is the owner's

Owner: *"you merge it and do whatever we gotta do, i will do the spwnding part,
the clicks"* — the merge and the deploy authorized, the paid dispatch reserved.

**Deploy 2134, 21:09:02→21:12:54Z, green in 3m52s**, on `main` `d826d7fb` →
`ff9fce5f` (fast-forward, 60 commits, 56 files, +17,961/−313). **`expect_deploy`
is `ff9fce5f72fe1b16339a687ec0ad76d07fce3778`** — `DEPLOY_ID` is `github.sha`,
so that is what the Worker answers, and the harness matches a 7+ prefix.

**THE IMAGE ID WAS COMPUTED BEFORE THE MERGE AND THE DEPLOY AGREED ON BOTH ENDS
— the eighth cross-check of that technique, and the strongest form of it.**
`origin/main` → **`7273d2569866364f`** and the candidate → **`3b93a9cae43bac41`**
(183 inputs each), both hashed before anything moved; the log's own diff then
reads `- "image": …7273d2569866364f` / `+ "image": …3b93a9cae43bac41`, `EDIT
isibi-app-sitebuildcontainer`, `SUCCESS Modified application`, `Applied changes`.
**The container rolled at 21:12:47.7Z** — read out of the diff, never inferred
from the step's duration. **So the 15–20 minute hold ran to ~21:28–21:33Z.**
`Uploaded isibi-app (7.40 sec)`, `Worker Startup Time: 30 ms`, `Total Upload
3569.50 KiB / gzip 962.69 KiB`, `Current Version ID: ae95b5ba-7efe-4e22-…`.

**THE SERVED-FILE CHECK IS AVAILABLE AND IT DISCRIMINATES THIS DEPLOY**, because
`public/chat.js` really moved: `/chat.js` is **byte-identical to the merged
tree** — **707,785 bytes, sha256 `4b3e8c869af12519`** (705,648 /
`56c3cfa2c177e6a5` before). **The cheap discriminator is `pictureNote`: 0
occurrences in what main served before, 2 now**, with `keptPartsNote` 0 → 1 —
identifiers the combined page + photo reply turns on, absent from every byte the
platform had ever served.

**REGRESSION: BYTE-IDENTICAL, with the baseline taken 48 seconds BEFORE the push
and compared 40 seconds after the deploy** (the process miss of the 2124 round,
not repeated). Seven sites 200 at the same sizes — repairbench-1 46,358 ·
fretwork-1 58,642 · ashgrove-1 31,120 · northgroup-5 1,641 · washhouse-1 52,404 ·
ben-crowe-guitar 52,060 · fold-lane-bakery 11,262 — each on the same
`x-site-version` and the same build id, and the interactive half because a 200 is
an availability check and never a health check: `/status` **200/6,272** and
`/booking-check` **200/6,390** on the same version, with `count_booked_repairs`
and `count_existing_bookings` both **200 answering 3**. Gate discriminator
401/401/401/404.
**AND `fretwork-1` IS 58,642 HERE against 58,404 at deploy 2128** — it moved
again between the two sessions, on a days-old `x-site-version` that has not
changed. Identical on both sides of THIS deploy, so it is not this one's; not
explained beyond that, and not claimed to be.

**THE MERGE STARTED EXACTLY ONE WORKFLOW** — deploy 2134 and nothing else, the
merge-trigger census holding in the live. **And the in-flight check was made
BEFORE the push rather than after**, which is the September near-miss's own
lesson: the last `lane sweep` was run 50 on 2026-09-16, so nothing paid was
running. Two other sessions' runs were in flight on their own branches
(`unit tests`, `site build`, `agent deploy`) and none of them touches this
Worker or its container.

**CI HAD READ THE SHA BEFORE THE MERGE**: `unit tests` run **2725** on
`ff9fce5f`, green — `# tests 6843 / # pass 6839 / # fail 0 / # skipped 4`,
against local `6843 / 6843 / 0 / 0`; the four are the three recorded environment
skips plus `site-searchpath`'s baseline-commit case, and the TOTAL is what
matches.

**NOT PRESSED.** The paid run is the owner's dispatch and nothing here spent a
credit.

### RUN 51: THREE QUARTERS PROVEN, AND THE PROVIDER REFUSED THE PICTURE (2026-09-19)

The owner's press. `lane sweep` run **51** (**35408232713**), green,
00:07:09→00:17:58Z; the addon job **485 s**, **cost 13 — balance 134 → 121**.
One free-text ask on `fold-lane-bakery`, routed **`["page","qr","photo"]`**.

**THE PRE-FLIGHT CLEARED BOTH HALVES BEFORE A CREDIT WENT**, which is the third
run to do so: `worker deploy: ff9fce5f…`, `container image (cold start):
3b93a9cae43bac41`, the runtime route agreeing, then *"queued work is on, and the
code under test is the code answering — proceeding"*.

**WHAT SHIPPED, VERIFIED FROM OUTSIDE.** `/gallery` **200/17,594 B** on build
`mu7mwvb6-yhwx01` (`x-site-version 01789776828162-bdqv15`), in `sitemap.xml`,
`href="/gallery"` **twice** on the home page. The stored inventory moved routes
**4→5**, codes **0→1**, photographs **3→3**.

- **THE QR IS PROVEN TWICE, AND THE SECOND READING IS THE NEW ONE.** The stored
  settings say it opens `https://fold-lane-bakery.gofarther.app/gallery`, and
  the **PUBLISHED FILE** — `qr-gallery.svg`, 200/4,079 B — re-encodes to that
  same address through `qrModules`/`qrEncodes`. It renders on `/visit` as
  `<img src="/qr-gallery.svg" alt="See photographs of our work">`, which is
  where its own designer put it (*"beside the opening hours"*). The
  settings-versus-file split the instrument was built for, answering the same
  way on both sides.
- **THE PRESERVATION WALL HELD ON A SITE THAT REALLY HAD SOMETHING TO LOSE** —
  `existing ones LOST 0`, and independently: the same three `/u/` urls on the
  same two pages, 1,938,794 / 1,777,447 / 1,517,100 bytes, all 200. This is what
  `fold-lane-bakery` was chosen for; `keptImages` SHORT-CIRCUITS on a site with
  no photographs, so every earlier site would have made the case vacuous.
- **AND THE PHOTOGRAPH WAS NOT BOUGHT.** `imageNote`'s **provider-refused**
  branch: *"Couldn't make the photographs this time, so the pictures are
  placeholders — the site is otherwise fine."* Not the affordability branch —
  the balance was 134 — so the purchase was attempted and the provider said no.
  **Billed on `made`, so the 13 credits are the page and the QR and the customer
  paid nothing for the picture that never arrived**, which is the build path's
  own rule holding on the addon path.

**⚠ AND THE REFUSAL CANNOT NAME ITSELF TO ANYBODY WHO CAN ACT ON IT.**
`genSitePhoto` throws `"photo " + status + " " + detail`, `makeSitePhoto`
scrubs it onto `images.error`, and `imageNote` reads that field ONLY as a
discriminator between four identical-looking placeholder outcomes — **it is
never put on the reply**. The one surviving copy is `console.error("photo
failed:", …)`, which under the runner is the job child's stdout inside the
container. So an empty provider balance, a wrong key, a provider outage, a
timeout and a non-image answer all reach the owner as one sentence, and none of
them reaches a session at all. The repository's own *"a failure that cannot name
itself"* trap, in the money path's decoration step. **Open.**

**⚠ AND THE PAGE SHOWS SEVEN EMPTY FRAMES WHERE THE CUSTOMER WAS TOLD ABOUT
ONE.** Measured on the live page: `role="img"` **×7**, `bg-muted` **×7**,
`aspect-ratio` **×7**, `<img>` **×0** — seven placeholders, each carrying real
alt text the writer wrote. The reply said *"There is a space for a photo"*,
singular, and the harness read `empty frames left 1`. **The probable mechanism
is that the grid is ONE `.map()` element in the source** — `site-picture.mjs`
records that shape in as many words (*"`{SPREADS.map((s) => <SafeImage …/>)}` is
ONE element"*) — so a source-element count and a rendered-frame count
legitimately differ and the sentence is composed from the source. **Not
settled**: confirming it needs the stored source, which is owner-gated. Open.

**⚠ AND THE INSTRUMENT IS BLIND ON EXACTLY THIS OUTCOME.** `imagesOn` reads
`<img>` elements, and `SafeImage` branches on `!src` to a placeholder that draws
none — so the browser half answered `0 drawn, 0 whose file loaded NOTHING, 0
laid out to NO SIZE` on the run it most needed to report. The server-side
`empty frames left N` is what carries it, and it counts something a visitor does
not see. Both halves of this were written in the round before the press and
neither was measured against a real placeholder.

**WHAT IS PROVEN AND WHAT IS NOT.** Proven: the routing (all three kinds
designed in one request), the QR end to end including the published file, the
preservation of existing photographs, and billing on `made`. **Not proven: the
photograph itself** — no generated picture has been made or placed on this path,
which is the one thing the milestone is named for. The re-run costs ~13 credits
and needs the provider's readiness confirmed first, which is a precondition and
not a risk to absorb: an empty provider produces a complete, green, plausible
run that proves nothing.

### …AND BOTH OF RUN 51'S DEFECTS ARE CLOSED (2026-09-19)

Owner: *"Fix the mismatch between the gallery's seven empty frames and the
reply's 'one photo space.' Check whether those extra frames should have been
created for this request. Check why the reply says it cannot establish the QR
implementation when this run created and published it. Keep configuration
separate from verified behavior."* Both reproduced from the page run 51 really
published, written back from the live bundle rather than invented.

**1. A PICTURE A PAGE DRAWS FROM A LIST WAS COUNTED BY NOTHING.** `/gallery`
ships `<SafeImage src="" alt="…"/>` once and `<Gallery items={[…six…]}/>` once,
so a visitor sees SEVEN empty frames and the reply said ONE. `imageSlots` sees
the first and is RIGHT not to see the other six — its contract is a `src` SPAN
to replace and a LITERAL `alt` to match a sentence against, which is what makes
it the picture rung's addressability reader, and widening it would offer that
rung slots it cannot edit. **The customer's sentence is about what they SEE, not
about what this layer can edit, and those are two questions.**

- **THE SCALE, MEASURED BY THE PRODUCT OVER THE 100-SITE CORPUS: 320 of these
  frames, in 60 of 324 page files, and EVERY ONE IS EMPTY** — 254 carrying
  `src: null` explicitly and 66 with no picture key at all; zero carry a url and
  zero carry a token. So run 51's six are not a curiosity: this is the ordinary
  shape of every gallery the platform has ever generated, and not one of those
  frames has ever been counted by anything.
- **THE RULE IS `alt`, AND IT IS THE KIT'S OWN.** `Gallery` and `MediaGrid` both
  declare `items: { src?: string | null; alt?: string; caption?: string | null }[]`
  — the SAME `src`/`alt` pair `imageSlots`' component branch already calls "the
  kit's own naming", as object keys rather than attributes. So `listFrames` knows
  nothing about which components exist: an object literal carrying a written
  `alt` is a picture entry, and it is EMPTY when no picture value sits beside it.
- **A COMPUTED `alt` IS A DATA ROW AND IS REFUSED.** Exactly ONE corpus page of
  324 carries `items={HOUSES.map((x) => ({ alt: \`${x.name}\` }))}`, whose LENGTH
  is decided at runtime — so no reader of the source can say how many frames it
  draws. That is the one place this count is a floor rather than the truth, and
  it is stated rather than papered over. **A first measurement using a hand-
  written scan answered 321/61 because it accepted that shape; the product
  refusing it is the right answer and the ad-hoc number was the wrong
  instrument.**
- **TWO NUMBERS, NEVER ONE.** Summing them would fix the count and ship a bigger
  claim than the one it replaced: `photoNote` offers to FILL a space from an
  upload, and nothing on this platform can fill a list entry. `listPhotos` rides
  the reply beside `photos` with its own sentence — *"The page's own layout has
  6 picture spaces in it that an upload won't reach — ask me for photographs
  there and I'll change the page itself."*
- **ALWAYS A NUMBER, 0 included**, so "this change added none" and "the Worker
  that answered predates the field" stay two different absences — which is what
  the harness's `(not said)` then means.

**AND NO, THE SIX SHOULD NOT HAVE BEEN CREATED.** The ask was *"showing
photographs of our work, with a new photograph of the bakery on it"* on a site
that **already owns three photographs**, and the page shows none of them: the
writer was told the count (*"This site already shows 3 real photographs, and
they stay exactly as they are"*) and never told WHERE they are or that it may
place one. Its own designer planned a `gallery` section, so it filled the band
with six blanks. **The capability gap is that a page writer cannot place a
photograph the site already has** — recorded, not fixed here.

**2. A CODE THIS CHANGE MADE AND PUBLISHED READ AS UNSEEABLE.** The page step
handed *"A QR code opens the gallery page."* to the `qr` step, which made one
code pointing at `/gallery`; the container baked `qr-gallery.svg`, the site
published it, and it re-encodes to that address. The customer was told **"I
can't see from here whether A QR code opens the gallery page — nothing I can
check says either way."** **TWO CAUSES AND NEITHER ALONE IS ENOUGH** — proved by
reverting each on its own and watching the case go red:

- **`appliedFacts` SPOKE FOR FIVE KINDS AND A CODE WAS NONE OF THEM.** A QR and
  a scene are applied results of the change exactly as a page is. They were on
  `SITE_KINDS` (the site can hold one and `existingFacts` enumerates them) and
  off `APPLIED_KINDS`, which is the combination that says *we can see what the
  site already had and never what this change added* — true of no other kind.
  A code now carries its DESTINATION'S PATH WORDS as `holds` (configuration read
  back off what was stored; `fails` empty, because a code pointing at `/gallery`
  contradicts nothing) and `checked` stays EMPTY — nothing scanned the drawing
  and nothing here ever will.
- **AND `implementationOf` READ THIS CHANGE'S OWN OUTPUT AS THE SITE'S BACK
  CATALOGUE.** `mine` and `theirs` were one test and they are two facts: the site
  already holding five codes genuinely cannot say which one was asked for, while
  this change's own step, asked for this in this same message, producing output
  IS the definition of `unverified` — *the implementation is established and
  nothing ties it to this particular claim*. `made` is that reading.
- **TWO CONDITIONS MAKE IT SOUND, AND THREE OLDER GUARDS WROTE BOTH.** It is a
  HAND-OFF only — a step always produces something, so letting a bare `covered`
  label read its own step's output restores the *"I've set that up"* the owner
  struck out on 2026-09-15 — and **the step has to have HEARD it**, because a
  hand-off BACKWARD names a step that already ran and whatever it made it made
  for its own reasons. Plus the COUNT: with more un-named asks resting on a step
  than things it made, at least one has nothing and which one is unknowable, so
  the whole group stays `unknown`.
- **CONFIGURATION, NEVER BEHAVIOUR.** `unverified`, not `delivered` and not
  `configured`: the customer hears *"I've set that up, but I can't confirm"*
  rather than *"I can't see from here whether"* — the difference between a thing
  that exists and a thing nobody looked for.
- **`aReportable` IS PER KIND NOW, NOT ONE FLAG.** A code is settled by the look
  merge and the dead-QR drop, long before any backend apply — and on a change
  with no database `aApplied` is false for ever, so a code this change really
  made would have read as unseeable on every frontend-only addon there is.
  `ready` names the kinds whose results arrive on their own clock; everything
  else falls to the apply, so a kind added to `APPLIED_KINDS` next month gets the
  conservative answer rather than a wrong one.

**⚠ AND `listPhotoNote` THREW IN TWO PLACES THE HOUR IT WAS WRITTEN** — the free
identifier trap, in the two files that keep a hand-written list of what the
browser's reply composer needs in scope. `BROWSER_FNS` gained the name AND a
census derived from `addonReplyText`'s own body, so the next one fails at the
guard rather than in a paid run; `test/site-addon.test.mjs` was keeping a SECOND
copy of that list and now derives it from `BROWSER_FNS` — one definition.

**Guards**: `addon-route` **123 → 132** (the seven-frame mismatch with its
control and the filled-entry direction; the QR reproduction, a code the change
did not make, a NAMED code the step ran and did not make — which is what makes
`APPLIED_KINDS` load-bearing — two asks on one step, and the two already-had
controls below), `site-picture` **53 → 61**, `requirement-coverage` **28 → 34**.
**Nine red-checks, each reverting ONE line and asserting exactly which cases go
red**, so no part of the change is decoration.

**⚠ AND THE TWO ALREADY-HAD CONTROLS WERE VACUOUS UNTIL THE SWEEP SAID SO, both
for one reason worth keeping.** Each drove a bare hand-off naming the `qr` /
`three` step on a change where that step never RAN — so nothing heard it, the
`made` branch is unreachable, there is no `item` to reach the other branch, and
BOTH readings answer `unknown`. The negative was true whatever the diff did.
**A `covered` claim NAMING the thing is what makes the two part**, because it
goes through the item branch where they differ not in `state` (both `found`)
but in `foundIn` — `existing` against `applied`. So the assertion is on which
READER answered: calling the site's own code or its own scene this change's
work is the defect, and `foundIn` is the only field that can say so.

**Four older guards re-anchored, not appeased**, each naming the property that
moved: `site-apply`'s frame-count anchor (pinned to the argument list, which was
hoisted into a named pair when a second counter started reading it — the new
assertion is strictly stronger, because BOTH counters must take that same pair);
`addon-sweep`'s `photoLines` line; and two in `requirement-coverage` where
`unknown` was a PROXY for a property and stopped being one — *"a hand-off's `by`
is never read"* (now asserted as `configuredBy`/`contradictedBy` undefined, with
an isolating control) and *"with no echo the reconciliation does nothing"* (now
`reconciledBy` undefined and not `configured`).

**Sweep: 43 mutants, 43 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/run51-frames-and-qr.json`, over
`builder/site-picture.mjs`, `builder/site-add.mjs`, `worker.js`,
`public/chat.js`, `builder/site-requirements.mjs` and `scripts/addon-sweep.mjs`,
against 11 test files — a narrow list can only produce a false SURVIVOR, never a
false kill). **Three passes, and NOT ONE SURVIVOR AT ANY POINT WAS THE
PRODUCT'S.** Pass 1 read 42/35/7 and pass 2 43/40/3; every survivor was a gap in
this change's own guards, and two of the seven are worth keeping as rules — the
vacuous already-had controls above, and **one that was MEASURED INERT and is
declared in the code rather than hunted.** `if (!APPLIED_KINDS.includes(k))
return false;` in `aReportable` cannot change any answer today: the only kinds
that can be in `ran` and are not in `APPLIED_KINDS` are `component` and `photo`,
and `seeable` — the ONE reader of that list — asks `OPAQUE_KINDS` independently,
which holds exactly those two. **A two-FILE pair is not expressible** (the runner
applies one `from`/`to` against `files[0]`, which this file already records), so
the mutant moved onto the OBSERVABLE half of the pair — `seeable`'s own
`OPAQUE_KINDS` test, which two existing cases already kill — and the absorbed
line keeps its measurement beside it, because the deadness is a property of that
NEIGHBOUR and not of the expression.

**Suite 6,866** (6,866 pass, 0 fail, 0 skipped) — 6,843 + 9 + 8 + 6, **and the
arithmetic closes exactly against baselines measured in a detached worktree at
`bd0b00c4`** (123 / 53 / 28) rather than subtracted from a paragraph; the three
files that gained only ASSERTIONS (`addon-sweep` 49, `site-addon` 89,
`site-apply` 87) are unmoved. A worktree run reads one FAIL and two SKIPs a
repo-root run does not — `render-sandbox`'s privilege-drop case is about writing
outside the repository root, which is the recorded environment case — so the
TOTAL is what carries across.

**CI HAS READ IT: `unit tests` run 2736 on `0b21bab1`, green (2026-09-19
02:09:49→02:11:41Z, the suite step 111.7 s) — `# tests 6866 / # pass 6862 /
# fail 0 / # skipped 4`**, against local `6866 / 6866 / 0 / 0`, and **the TOTAL
is what matches**. **The four are NAMED out of the log rather than recalled** —
the privilege-drop case (*"needs root and an unprivileged user"*), the two RTL
cases (*"template deps not installed"*) and `site-searchpath`'s baseline-commit
case (*"a shallow checkout holds one commit"*): the three recorded environment
skips plus the one this branch's neighbour added, which is the standing
expectation met rather than a new one.

**NOT MERGED, NOT DEPLOYED, NO PAID RUN.** The photograph test is parked awaiting
fal funding, at the owner's word.

### …AND TWO CORRECTIONS TO THAT ROUND, BOTH REPRODUCED FIRST (2026-09-19)

Owner: *"Remove output-count matching as proof of requirement implementation… A
gallery handoff currently becomes 'set up' when the step produces only a Wi-Fi
code. Associate the requirement with its actual item explicitly; preserve
uncertainty where that association is missing."* And: *"Don't report arbitrary
source objects as visible picture spaces. Comments currently count, and a filled
entry with a quoted `"src"` key reads as empty… avoid exact counts for
runtime-dependent lists."*

**1. A COUNT OF A STEP'S OUTPUT IS NOT AN ASSOCIATION WITH A REQUIREMENT.** The
round above closed run 51's *"I can't see from here whether A QR code opens the
gallery page"* by letting `implementationOf`'s no-name branch answer `made` when
a step made at least as many things as there were un-named asks resting on it.
**REPRODUCED before anything was touched**: the `page` step hands *"A QR code
opens the gallery page."* to the `qr` step, the `qr` step designs ONE code —
`{name: "wifi", points: "WIFI:S=Bakery;…"}` — and the reader answered
`implementation: "made"` → `unverified` → *"I've set that up"*. **The gallery
case and the Wi-Fi case came back byte-identical**, which is the whole finding:
a count cannot tell them apart because a count is not about the things.

- **IT WAS UNSOUND AT EVERY N, not at the margin.** Its argument was *"a step
  that made as many things as there are asks resting on it made something for
  each of them"* — arithmetic about CARDINALITY, silent about CORRESPONDENCE.
  One ask and one thing made is the case it was written for and is exactly the
  case above. The branch, the `asked` bag, the `heard` bound and the `resting`
  map all go; `requirementOutcomes` no longer computes the map at all.
- **THE ASSOCIATION THAT ANSWERS ALREADY EXISTED**: `{kind, name}` — the
  requirement's own `item`, resolved against the applied items by identity.
  Driven: a hand-off naming `gallery` against the gallery code reads `found` /
  `applied` / *"I've set that up"*, and against a Wi-Fi code reads **`missing`**,
  which is the actionable answer rather than the reassuring one.
- **WHERE IT IS MISSING THE ANSWER IS `unknown`**, which says *nothing here can
  establish whether the implementation is there* — true, and the uncertainty the
  owner asked to preserve.
- **⚠ THE GAP IS NAMED RATHER THAN CLOSED, because it is a capability call.**
  `qr`, `three` and `photo` are the three kinds off `REQUIREMENT_ADDS`, so their
  tools carry no `requirements` property and a step that makes a code CANNOT
  echo the id `requirementBrief` handed it. On today's tools the association for
  a QR hand-off can therefore only come from the page designer naming a code
  whose name it cannot know — so run 51's own shape reads `unknown`. Closing it
  is one flag (`requirements: true` on those kinds), **measured at +3,579
  characters on a 2,228-character tool**, and it would also let those steps
  RAISE needs, which is more than was asked for. The owner's call.

**2. THREE THINGS THE FRAME READER GOT WRONG, all reproduced.** An object
literal inside a **line, block or jsdoc comment** counted as a picture space a
visitor can see; a **FILLED entry with a quoted `"src"` key** came back
`value: "", empty: true` — a photograph the owner paid for, offered as a space
nothing can fill — while a quoted `"alt"` was missed altogether; and a `.map`
over a runtime array was counted as **exactly one**.

- **THE SCAN RUNS ON THE CODE.** `codeOnly` blanks comments in ONE pass that
  tracks strings and comments together, which is the only order correct in both
  directions: this repository's recorded trap is a `/*` inside a LINE comment
  opening a block that runs thousands of characters, and its mirror is the `//`
  inside every `href="https://…"` on every page. Both are driven as CONTROLS.
  **`codeOnly` is EXPORTED and its length-preservation asserted**, because
  everything downstream reads the blanked copy and nothing there can tell
  blanking from deleting — two sweep survivors said so.
- **A KEY IS `src`, `"src"` OR `'src'`, FROM ONE DEFINITION.** `OBJ_START`
  already admitted a quoted key, so the object was FOUND and then read by a
  grammar that could not see its keys — which is why the failure was a wrong
  number rather than a missing one. The character before it is still the wall.
- **A RUNTIME ENTRY MAKES THE TOTAL A FLOOR, never drops it.** A mapped gallery
  really does put spaces on the page, so it is counted and the number is handed
  over as a minimum: `listPhotosMin` on the reply, *"at least 6 picture spaces"*
  in the browser. **The walk goes out through EVERY unclosed bracket** — a
  correction the sweep bought, since stopping at a `[` called
  `ROWS.map((r) => ({shots: [{…}]}))` exact — and the BALANCE is what keeps that
  sound: a call whose parentheses closed before the object is balanced on the
  way out, so the only `(` reachable unclosed is one the object really sits in.
- **FALSE-ALARM RATE ZERO, MEASURED THE ONLY WAY IT CAN BE**: every generated
  page the platform has, read before and after. **320 frames in 60 of 324 files,
  0 filled, 0 runtime — byte-identical on both sides**, and the wide walk
  answers the same as the narrow one. So the three fixes fire on the shapes that
  were wrong and on nothing else; `runtime === 0` is asserted in the corpus case
  so a widening that started flagging ordinary literal galleries would turn
  every exact count into a floor in silence.

**Guards**: `requirement-coverage` **34** (three cases re-anchored onto the
property and one REPLACED by the reproduction — the count is gone, so the old
fixtures' arms answer alike and discriminate nothing), `addon-route` **132 →
134** (the Wi-Fi reproduction with the control that the RIGHT code answers the
same way, and the mapped gallery said as a floor), `site-picture` **61 → 65**,
`site-images` **78 → 79**, `site-apply` re-anchored onto the pair.
**Five older guards re-anchored, not appeased**, each naming the property that
moved — and two of them had become VACUOUS rather than wrong: `notEqual(…,
"made")` is satisfied by every answer once that state is gone, so both now
assert `found` + `foundIn: "existing"`, which is the distinction they were
always about.

**Sweep: 33 mutants, 33 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/three-corrections.json`, over
`builder/site-requirements.mjs`, `builder/site-picture.mjs`, `worker.js`,
`public/chat.js` and `builder/site-images.mjs`, against eight test files — a
narrow list can only produce a false SURVIVOR, never a false kill). **Pass 1
read 32/23/9 and not one survivor was the product's**: seven were gaps in this
round's own guards, one was a vacuous case of mine and one was an inert mutant.
Three are worth keeping as rules:

- **⚠ THE `dataSrc` CASE WAS VACUOUS AND THE CAPITAL IS WHY.** `dataSrc` carries
  a capital S, so a lowercase `src` needle never matches inside it and the case
  asserting the character-before-the-key wall could not fail. **`image_src` is
  the snake_case shape that discriminates**; both are kept, the second declared,
  because the camelCase one is what a model really writes.
- **⚠ THE `flatMap` CASE WAS DECIDED BY ITS INNER `.map`.** The fixture wrapped
  one in the other, so the answer came from the inner call and taking `flatMap`
  off the list changed nothing.
- **⚠ AND TWO SURVIVORS WERE A PROPERTY WITH NO READER**, not a gap: `codeOnly`'s
  length-preservation is invisible to every caller in the module. The answer was
  to give it one rather than to hunt it.

**Suite 6,873** — 6,866 + 6 + 1, **and the arithmetic closes exactly against a
baseline measured in a detached worktree** (392 → 398 over the five files) rather
than subtracted from a paragraph.

**CI HAS READ IT: `unit tests` run 2739 on `6096f1bf`, green — `# tests 6873 /
# pass 6869 / # fail 0 / # skipped 4`**, against local `6873 / 6873 / 0 / 0`; the
four are the three recorded environment skips plus `site-searchpath`'s
baseline-commit case, and **the TOTAL is what matches**. `site build` run **1194**
is green on the same sha — it fired because `builder/site-picture.mjs` and
`builder/site-add.mjs` moved.

**NOT MERGED, NOT DEPLOYED, NO PAID RUN, AND fal VERIFICATION STAYS PARKED.**

#### What the addon can do, measured end to end (2026-09-19)

Owner: *"Review the remaining addon capabilities end to end… what customers can
add now, what works only in certain combinations, and what remains
unsupported."* Every line here is DERIVED by driving the modules, never read off
a description. **`ADD_KINDS` is nine and `DISPATCHED_ADDS` is EMPTY** — the whole
list acts here except `photo`, which is `PLACING_ADDS`: it carries a tool AND
names a layer, so it designs a shot list beside a page and hops to the `picture`
rung when it is the only thing asked for.

| kind | cap per ask | what it really makes |
|---|---|---|
| `table` · `function` · `api` · `job` | 6 · 6 · 4 · 4 | the database half; the first of any of them PROVISIONS the database |
| `page` | 6 | a route, in `sitemap.xml`, linked from the nav |
| `component` | 12 | a band on a page — a kit part by name, or a `tsx` part written for this site (`MAX_TSX` 3 against a 2,112-entry menu) |
| `qr` | one per ask, `MAX_QRS` 6 per site | drawn by us from the stored string, baked as `/qr-<name>.svg` |
| `three` | one per SITE (`SINGLE_FIELDS`) | a WebGL element |
| `photo` | 6 (`IMAGE_CAP`) | bought from fal and placed in the same request |

**`MAX_ADDS` is 9, so one message may name every kind it asks for**, and
`ADD_KINDS` order IS run order — a table before the function that reads it, both
before the job that runs it, all before the page that shows them.

**WHAT ONLY WORKS IN COMBINATION**, each measured rather than inferred:

- **A visitor upload needs a column named one of fifteen words.**
  `/api/db/<slug>/uploads` is live (POST, images only — PNG/JPEG/WebP/GIF by
  magic number, SVG refused as stored XSS, 2 MB, throttled), the kit ships
  `uploadFile(table, file)`, and `acceptsVisitorUploads` requires a write grant
  AND a column matching `isImageColumn`. **That function's own comment records
  the gap**: `attachment`, `file`, `upload`, `receipt`, `document`, `screenshot`
  and `artwork` all answer NO. So *"let people attach a receipt"* builds a
  perfect form that refuses every file.
- **…AND `uploadFile` IS IN ZERO PROMPTS.** Measured: `builder/page-gen.mjs`,
  `builder/site-add.mjs` and `builder/site-plan.mjs` contain the identifier **0
  times**, while page rule 1 reads *"NO FETCH CODE. Read with `useRows`, write
  with `useCreateRow`"*. The route, the kit helper, the sniffer, the throttle and
  the column rule all exist and the one entry point is named nowhere — this
  repository's own wiring trap, at the capability level.
- **Video and audio EMBED; they do not HOST.** `video-embed`, `video-player`,
  `video-hero`, `audio-player` and `audio-recorder` are all in
  `COMPONENT_MENU` and all make **zero network calls** — they are prop-driven, so
  a `component` ask places one around a URL the owner supplies. There is nothing
  to supply it FROM: uploads are images only, so a media file has no home here.
- **A page this same change adds is a real destination** for a component, a QR
  code or a photograph (`site.planned`), and the dependent set is withheld
  together when the page does not survive.
- **`pageless` is job + INTERNAL function only** — driven. Anything else wants a
  compile and a publish, which is most of the bill.

**WHAT IS UNSUPPORTED, and the honest reason for each:**

- **⚠ "A photograph the site already has cannot be placed on a new page" WAS
  WRONG AND IS CORRECTED (owner, 2026-09-19: *"Existing URLs can already reach
  the writer through page source, and reuse is accepted."*).** Both halves are
  right and the line above them was written from reading the directive rather
  than driving the path. **Measured**: a `/u/` url copied onto a new page passes
  `keptImages` (`{ok: true, lost: []}` — reuse ADDS, and the wall asks about
  losses), survives `applyImages` **byte-identical** (the sweep rewrites unbought
  `@@IMG:` tokens and a real url is not one), and publishes; `shownPhotos` then
  answers the same DISTINCT count, so a picture drawn twice is one picture and
  no new spend. **The capability is there.** What is missing is two other things,
  and naming them apart is the point:
  - **GUIDANCE.** `keepClause` states the COUNT and forbids replacing or
    removing — *"they stay exactly as they are — do not replace one, and do not
    remove it"* — and says nothing about showing one again; the sentence beside
    it, *"Any picture this change adds stays a `<SafeImage>` with an empty src"*,
    reads literally as an instruction to leave a new page's picture empty even
    when the picture is one the site already owns. **Measured: the directive
    contains no `/u/` url at all.**
  - **CONTEXT, and only on a large site.** The inventory is SITE-WIDE
    (`photoInventory` over every page and component) while the source the writer
    is shown is BOUNDED by `priorPagesSent` — so a photograph on a WITHHELD page
    is counted in the sentence and its url never reaches the writer. Driven.
    **Unreachable today: 0 of 100 corpus sites exceed `MAX_PRIOR_CHARS`, the
    largest being 50,646 characters**, so this arrives by growth.
  **NOT FIXED HERE, and the risk is why**: the obvious guidance ("you may show
  one again") invites an INVENTED `/u/` path, which nothing validates —
  `keptImages` sees only losses and `applyImages` does not check — so it would
  publish as a broken image. The wall for that is capability work and is the
  owner's call. `test/site-images.test.mjs` pins both measurements so the
  assessment cannot drift again. **Run 51's six blank frames are a separate
  thing**: the page writer had a gallery band to fill, no shot list, and no
  sentence inviting reuse.
- **An `api` cannot say where its credential comes from.** A required secret
  reaches the owner as a bare name (`WEATHER_KEY`) with nothing saying where to
  get one, and `params` is a name allow-list with **no types and no required
  flag**, so a connection cannot say which parameter a page must supply.
- **A job cannot run ONCE.** `JOB_ITEM` carries `everyMinutes` (minimum 15) and
  an optional `at`; there is no run-once field. A missing field, not a missing
  capability.
- **A function cannot choose its `language`** — the engine reads `f.language`
  and emits `LANGUAGE plpgsql`; the addon's cleaner drops the key and reports it
  as `unexpressed`.
- **`three` and `photo` cannot report a coverage gap at all**: they are the two
  kinds still off `REQUIREMENT_ADDS`, so their tools carry no `requirements`
  property and they can neither raise a need nor echo a hand-off. **`qr` JOINED
  THEM on 2026-09-19** and every other kind could already.
- **Nothing deletes.** `remove` is the edit path's verb; the addon adds.

**COST, from the runs that were really bought**: pageless **3** (run 50),
`function`+`page` **12** (run 49), `table`+`function`+`page` **13** (run 47),
`page`+`qr`+a refused photograph **13** (run 51 — billed on `made`, so the
picture that never arrived cost nothing). A photograph is `IMAGE_USD /
CREDIT_USD` ≈ **18.75 credits**, which is most of any bill that includes one.


### …AND THE TWO THAT FINISHED THEM (2026-09-19)

Owner: *"1. Correct the frame counter's remaining assumptions. An empty mapped
array renders zero frames but currently reports 'at least 1.' A quoted example
containing an object also counts as a picture. Exclude strings and unused
examples; don't treat runtime expressions as a positive lower bound. Use wording
without a number when the visible count cannot be established. Preserve the known
six-entry gallery case. 2. Finish the original QR handoff correction. Let the QR
step associate the requirement ID it received with the actual kind and item it
produced, using the existing reconciliation mechanism. Start with QR only…
Keep `checked` empty."*

**1a. A RUNTIME ENTRY BOUNDS THE PAGE FROM NEITHER SIDE.** The round before this
one stopped calling a mapped gallery an exact count and called it a FLOOR
instead — the entry counted as one, the sentence saying *"at least"*. That is the
same mistake wearing a hedge: `SHOTS.map(…)` draws six frames or none, and the
one object in the source says nothing about which. **`n` and `more` are two
answers now**, both through `grewBy` so the same per-page increase rule decides
each: `n` is the frames whose number is WRITTEN DOWN, `more` is *"and a list
draws some too"*. With `n > 0` the number really is a floor — the literal entries
are there — and the customer hears *"at least 2 picture spaces"*; with `n === 0`
there is nothing to be a floor of and **the clause carries no number at all**:
*"The page draws its pictures from a list, so how many spaces it has is up to
that data."* Run 51's six-entry gallery is unmoved, because it is a LITERAL array
and its number is written down.

**1b. AN OBJECT INSIDE A STRING IS AN EXAMPLE.** Reproduced in all three quoting
shapes — a double-quoted hint, its single-quoted mirror, a template — each
counted as a picture space on a page that draws nothing of the kind.
**TWO VIEWS OF ONE FILE, because one copy cannot serve both readers**: a frame is
FOUND by its braces and READ by its values, and the values are strings, so
blanking string contents loses every `alt` and keeping them lets a quoted example
in. `codeOnly(src, true)` blanks contents and KEEPS the quotes — the empty pair
`""` is exactly what a quoted KEY needs and all it needs — and both copies are
length-preserving, so one offset means the same thing in each. That property was
exported and asserted long before anything used it; it is load-bearing now.

**⚠ AND THE FIRST CUT DESTROYED 29 REAL PICTURE FRAMES ACROSS 6 OF THE 100
CORPUS SITES — a false ALL-CLEAR, and only the corpus caught it.** A `.tsx` page
is JSX and JSX text is full of apostrophes (*"somebody else's oven"*); read as
string openers they swallow everything to the next one, and a whole
`<Gallery items={[…]}/>` two hundred characters below vanished. `AFTER_WORD`
(`/[A-Za-z0-9]$/`) is the fix: in JavaScript a string never opens directly after
a letter or digit, so the test costs nothing real — **a BACKTICK is exempt**,
because `css\`…\`` is a tagged template and a word character before it is the
ordinary case. Re-measured: **320 frames in 60 of 324 files, 0 filled, 0 runtime,
and zero difference from the committed reader.** The limit it leaves is stated
rather than hidden: a quote opening after `>` in JSX prose still reads as a
string, and the direction is a MISSED frame rather than an invented one.

**2. THE QR STEP CAN SAY WHICH REQUEST ITS CODE ANSWERS — ONE WORD, AND THE WORD
IS THE WHOLE FIX.** `ADDS.qr` gains `requirements: true`; `REQUIREMENT_ADDS` is
DERIVED from that flag, so the tool gains the property and nothing else was
built. `cleanRequirements` stamps `from: "qr"`, `referenceOf` reads `{kind,
item}`, and `reconcileHandoffs` joins on the echoed id under its four existing
conditions. **The step was already TOLD**: `requirementBrief` is composed for
every kind in the route's loop, so the qr designer has been reading *"[page#0] A
QR code opens the gallery page."* since that brief went general — and had
nowhere to answer.

**⚠ AND A ROUTE CASE ALMOST PROVED NOTHING, which is this repository's own wiring
trap met inside the round that closes it.** MEASURED: the whole demonstration was
green against a product whose qr tool had NO `requirements` property, because
`cleanRequirements`, `referenceOf` and `reconcileHandoffs` are kind-agnostic and
always were — a fixture that hands the echo in bypasses the tool entirely. From
outside, *"the step did not echo"* and *"we never offered it anywhere to echo"*
are one absence. The route fixture keeps the tool's own property set now
(`prompts[].props`, read off the request the route really sent), and the case
asserts the qr designer was handed a tool it can answer in AND a brief carrying
the id. It goes red for that reason and for no other.

**THE CAP HOLDS AND `checked` STAYS EMPTY.** An echo earns the hand-off
`configured` and never `delivered`: a code's destination is configuration read
back off what was stored, nothing has scanned the drawing, and nothing on this
path exercises a behaviour. The customer moves from *"I can't see from here
whether…"* to *"I've set that up, but I can't confirm…"* — two different clauses,
and the move between them is the whole of what the association buys.

**⚠ AND THE `checked` ASSERTION WAS VACUOUS WHERE I FIRST PUT IT.** The stored
record carries no `made` list at all, so a loop over it was a negative assertion
with no observer — green whatever the code did. It is asserted where it lives:
`addon-steps`' census drives `appliedFacts` over every applied kind, **and that
census was five of seven**, because `qr` and `three` joined `APPLIED_KINDS` a
round ago and it did not follow them. It derives the kind set from
`APPLIED_KINDS` now, so a kind added next month cannot slip past.

**Guards**: `site-picture` **65 → 66** (the string exclusion in all three quoting
shapes, the JSX-apostrophe control that cost 29 frames, a URL's `//` not opening
a comment, and the masked copy's own length and line preservation),
`addon-route` **134 → 135** (the QR echo end to end with the tool assertion, and
three controls: an echo naming a code nobody made, an echo naming nothing, and a
dependency failure an echo may not overwrite). **Every new case proved RED
against the pre-change product, one file at a time**, and the reach is exactly
what it should be: the picture change turns **2 of 66** red and everything else
passes on both trees; the qr flag turns **3** red — the new case and the two
censuses — with every pre-existing QR control green on both.

**Five older guards re-anchored, not appeased**, each naming the property that
moved: `site-apply`'s three anchors on the renamed pair (`{n, atLeast}` →
`{n, more}`, `listPhotosMin` → `listPhotosMore`, and the browser's call), with
`atLeast` now forbidden by name so the floor reading cannot come back;
`site-picture`'s floor case rewritten onto the new property; `addon-route`'s
six-entry control; and the two `REQUIREMENT_ADDS` censuses, which gained `qr`
AND a derivation from the tools themselves in both directions.

**Sweep: 21 mutants, 21 killed, 0 survived, 0 never applied, 2 comment-only
controls survived — ON THE FIRST PASS**
(`scripts/mutants/frames-and-qr-echo.json`, over `builder/site-picture.mjs`,
`worker.js`, `public/chat.js` and `builder/site-add.mjs`, against nine test
files — a narrow list can only produce a false SURVIVOR, never a false kill).
Both of the owner's own reproductions are mutants: a runtime entry counted into
the number, and a runtime entry alone becoming a floor of 1. So are the string
masking dropped, the braces matched against the unmasked copy, the prose
apostrophe, the word test losing its `$`, a masked escape losing a character
(which drifts the two views apart after it), the no-number sentence dropped, an
exact count offered as a floor and a floor as exact, and the qr flag itself.
**AND THE RUNNER'S FIRST INVOCATION DIED IN ITS OWN LOAD** — the spec was
written as `{note, files, mutants}` and it reads a top-level ARRAY — which is
what the round before this one's scope line is for: the header prints before
the baseline, so a sweep that never starts still says what it was trying to do.

**Suite 6,875** — 6,873 + 1 + 1, **and the arithmetic closes exactly against a
baseline measured in a detached worktree** (the five touched files read 352 at
the committed tip and 354 now) rather than subtracted from a paragraph.

**CI HAS READ IT: `unit tests` run 2743 on `7840772d`, green (2026-09-19
03:45:19→03:47:3xZ) — `# tests 6875 / # pass 6871 / # fail 0 / # skipped 4`**,
against local `6875 / 6875 / 0 / 0`, and **the TOTAL is what matches**. The four
are NAMED out of the log rather than recalled: the privilege-drop case (*"needs
root and an unprivileged user"*), two RTL cases (*"template deps not
installed"*) and `site-searchpath`'s baseline-commit case (*"a shallow checkout
holds one commit"*) — the standing expectation met rather than a new one.
**AND `site build` RUN 1195 IS GREEN ON THE SAME SHA (2026-09-19
03:45:23→04:09:25Z), ALL TWENTY STEPS** — read the next day rather than carried
over from 1194, which is what that paragraph was left open for: `site-build.mjs`
**382 passed / 0 failed**, with kit-typecheck 4, contrast-cases 16, theme-seam
11, theme-render 29, site-routing 14, site-runtime 47 beside it and kit-render /
kit-a11y / kit-effects / kit-paint each `all passed` with no count — the three
result SHAPES a census has to ask for. Every count bounded landmark-to-landmark
(`##[group]Run …` to the next), **0 result lines before the first marker**, 12
of the 19 markers carrying a result. It fired because `builder/site-add.mjs` and
`builder/site-picture.mjs` moved. **The unit step's TAP is `# tests 396 /
# pass 396 / # fail 0`, unchanged from 1194** — correct, because that round adds
no `page-gen` or `publish-pages` case.

**NOT MERGED, NOT DEPLOYED, NO PAID RUN.** Fal verification stays parked, and
the photo-reuse guidance work is queued behind these two (the owner: *"Photo
reuse needs no new permission decision merely to improve guidance. Keep its
assessment corrected and queue that work after these fixes."*).

### …AND TWO CORRECTIONS TO THAT ROUND, BOTH REPRODUCED FIRST (2026-09-19)

Owner: *"Keep the working QR association and the corrected string/empty-map
cases. Two bounded corrections remain."* Both were driven before anything was
touched, and the second is the owner's own echo verbatim.

**1. A LITERAL OBJECT IS NOT PROOF THAT IT RENDERS, AND THE DENY-LIST COULD NOT
SAY SO.** Owner: *"An unused image array and an array filtered to zero still
report visible picture spaces… Narrow numeric reporting to cases where the count
can actually be established; use uncertainty otherwise. Don't keep adding
individual runtime-method exceptions."* REPRODUCED: a `const SHOTS = [{…},{…}]`
nothing on the page references, and `<Gallery items={SHOTS.filter((s) =>
s.featured)} />`, each answering **an exact 2** where a visitor sees zero.

**THE OLD RULE'S FAILURE IS STRUCTURAL AND IT IS MEASURED.** It looked back 600
characters for `.map` / `.flatMap` / `Array.from`; a generated page declares its
array at the top of the file and maps it two hundred lines below, so **over the
100-site corpus that deny-list caught ZERO of the 23 runtime-decided frames** —
three `.map`s and a `.filter`, and `salon/work.tsx`'s `SETS.filter(...)` is the
owner's reported shape live in the corpus. A list of methods can only ever be
extended; **the positive rule catches all 23 and names no method at all.**

**A COUNT IS ESTABLISHED ONLY WHERE THE ARRAY IS THE PROP'S WHOLE VALUE** —
`<Gallery items={[{…}, {…}]} />`, the one place where what is written is what
the browser draws. **MEASURED: 297 of the corpus's 320 frames are in that shape,
run 51's six included**, so the narrowing costs no real page its number and
`listFrames` still reads 320 / 60 files / 0 filled. Everything else — a named
const, a call, a memo, an arrow body — is uncertainty, which reaches the customer
as the no-number sentence.

**⚠ AND "WHAT THE ENTRY SITS INSIDE" IS NOT THAT QUESTION — three shapes bought
that, found by probing the first cut rather than by reading it.**
`items={on ? A : [{…}]}`, `items={[...A, {…}]}` and `n={[{…}].length}` each sit
inside a prop's expression container and none establishes a number. So the
container must hold the array and NOTHING ELSE (whitespace-only on both sides)
and the array must carry no `...`. A spread's literal entries really are on the
page and could have been a floor; they go to `more` instead, because the
uncertain sentence is exactly right for a list whose length is data's to decide
and a floor invites the customer to count.
**`MAX_PROP_LOOKBACK` IS 2000, AND THE 815 IS MEASURED**: that is the furthest a
counted entry sits from its own `items={` across the corpus (`game-studio/press.tsx`,
the last of a long literal list); 600 would have lost 7 of the 297, 1000 finds
all of them. A bound reached is uncertainty, never a number.

**2. AN UNRESOLVED ANSWER REGAINED CERTAINTY THROUGH PROSE.** Owner: *"Reproduce
an echo with `answers: "page#0"`, no item, and `by: "the gallery code points at
/gallery"`. It currently produces both "I've set that up" and "I can't see
whether" for the same need."* REPRODUCED exactly — the hand-off `unknown` and
the answer `configured`, two opposite sentences about one need in one reply, the
reassuring one being the wrong one.

**THE ECHO SAYS WHICH REQUEST IS BEING ANSWERED; IT IS NOT EVIDENCE THAT IT WAS.**
With no item the answer's own implementation is `unknown`, so `reconcileHandoffs`
refuses it — and `claimEvidence` then matched the word `gallery` inside that
sentence against the qr step's own applied code. An entry that names the hand-off
it answers has said where its work belongs; if nothing can resolve WHAT that work
is, the ceiling is the same `unknown` the implementation reader already gave it.
**NARROW BY CONSTRUCTION**: the gate asks for `answers`, so a bare `covered`
claim is untouched and keeps the five real findings the stricter reading was
measured to lose on 2026-09-16.

**AND GATING THE PROSE IS HALF THE FIX.** Both entries then read `unknown` and
the need was said TWICE in the customer's own words — the duplicate half of the
same incoherence. `spokenForBy` names the request that speaks for it: silent in
the prose, whole in the record, **its OWN field and not `overruledBy`**, because
*"a finding contradicted your answer"* and *"your answer named nothing anyone
could find"* are two facts a developer acts on differently.

**⚠ `unknown` AND NOT `!== "found"`, AND THE WRONG-ITEM CONTROL IS WHAT SAID SO.**
The first cut used the looser test and ate a real finding: an answer naming an
item this layer LOOKED FOR AND DID NOT FIND reads `absent` → `missing` →
*"Still to do"*, the most actionable line in the reply. **`absent` is resolved —
resolved to NOT THERE.** Only `unknown` established nothing either way. The two
gates are written as two properties (*may this be lifted by a sentence* against
*does this add anything to its request*) rather than one, because they coincide
only while `absent` never reaches the prose branches.
**AND AN ECHO NAMING A REQUEST NOBODY SENT KEEPS SPEAKING** — it is the only
record of its own need, and silencing it would lose the need rather than say it
once.

**Guards**: `site-picture` **66** (the frame case REPLACED, not added to — its
expectations MOVED rather than broke, and the old control was a bare `const`
array which is now one of the refusals) and `requirement-coverage` **34 → 35**.
**⚠ AND LAST ROUND'S CONTROL 2 IN `addon-route` WAS VACUOUS, which is the
finding**: it drove the owner's shape with `by: "a code was made"` — prose
carrying no applied item's name — so `claimEvidence` matched nothing and it
passed whatever the product did. It carries the owner's own sentence now, with
the COMPLETE customer note asserted, because the defect is a contradiction
BETWEEN two clauses and no assertion about one of them can see it.

**Reach, measured by reverting each product file alone**: the frame reader turns
exactly **1** case red and the requirements reader exactly **2** (the route's QR
case and the new module case), with everything else green on both trees.

**Sweep: 27 mutants, 27 killed, 0 survived, 0 never applied, 2 comment-only
controls survived** (`scripts/mutants/frames-and-echo.json`, over
`builder/site-picture.mjs` and `builder/site-requirements.mjs`, against 8 test
files). **Pass 1 read 25/3 and not one survivor was the product's** — one was a
real guard gap and two were MEASURED inert:

- **THE GAP: an array handed to a CALL.** Every other shape reaches its second
  encloser as a `{`; these reach a `(` — `items={pick([{…}])}`, `useMemo(() =>
  [{…}], [])`, `wrap(fn([{…}]))`. All four answer `false` correctly and no case
  drove one.
- **⚠ AND THE OTHER TWO ARE A BELT BEHIND A BELT, three deep with only the
  outermost observable.** `arrayEnd`'s `-1`, the caller's `shut < 0` and the
  caller's *"the next character is the expression's `}`"* all enforce one
  property, and **cutting any one — or the first two together — changes no answer
  over 20 constructed shapes and the whole corpus**, because a bound, a file end
  or index 0 is never `}`. So the recorded "mutate the PAIR" does not apply: the
  pair is not a pair. The outermost is what the sweep mutates and the two inner
  ones are declared where they live. The name test is a true pair with the `=`
  test (measured absorbed alone, killed together).

**Suite 6,876** — 6,875 + 1, **and the arithmetic closes exactly against
baselines measured in a detached worktree at `c745ce9a`** (site-picture 66,
addon-route 135, requirement-coverage 34) rather than subtracted from a
paragraph. `addon-route` stays 135: everything it gained is an assertion inside a
case that already existed.

**NOT MERGED, NOT DEPLOYED, NO PAID RUN; fal verification stays parked.** The
photo-reuse guidance work is next.

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
- **Balance: 121 credits** (read off the ledger by the harness itself at both
  ends of run 51, 2026-09-19 00:17Z — `134 → 121`, spent **13**: the page and
  the QR code, with the refused photograph correctly costing nothing). Before
  it, 137 → 134 on run 50 and 149 → 137 on run 49. **Read the ledger, do not
  trust this line** — the older readings below are kept for the arithmetic and
  every one of them was current when written.
- Before those, **161 credits** (read off the ledger by the harness itself at the end
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
  **AND RUN 1147 READ IT AN EIGHTH TIME (2026-09-15 22:24:15→22:47:54Z on
  `82e3c885`, the three reporting cases, ALL TWENTY STEPS GREEN):
  `site-build.mjs` `382 passed, 0 failed` in 17m11s**, with kit-typecheck 4,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47 beside it — every count bounded to its own `##[group]`.
  **THE JOB HAS TWENTY STEPS AND THE API ANSWERS 23**: three of them are
  GitHub's automatic post-steps (numbered 39–41), so `len(steps)` is not the
  step count this line means — checked rather than "corrected", because the
  phrasing was right and a number moved for the wrong reason is still a wrong
  number.
  **AND RUN 1148 READ IT A NINTH TIME (2026-09-15 23:26:02→23:52:28Z on
  `23f6ae22`, the covered-evidence round, ALL TWENTY STEPS GREEN):
  `site-build.mjs` `382 passed, 0 failed` in 19m14s**, with kit-typecheck 4,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47 beside it — every count bounded to its own `##[group]`, and
  the count read rather than carried over from 1147.
  **AND RUN 1149 READ IT A TENTH TIME (2026-09-16 00:08:50→00:28:25Z on
  `e032afad`, the kinded reference, ALL TWENTY STEPS GREEN): `site-build.mjs`
  `382 passed, 0 failed` in 14m06s**, with kit-typecheck 4, contrast-cases 16,
  theme-seam 11, theme-render 29, site-routing 14, site-runtime 47 beside it —
  every count bounded to its own `##[group]`, and read rather than carried over
  from 1148.
  **AND RUN 1150 READ IT AN ELEVENTH TIME (2026-09-16 01:07:50→01:32:50Z on
  `561db453`, the evidence scope, ALL TWENTY STEPS GREEN): `site-build.mjs`
  `382 passed, 0 failed` in 18m11s**, with kit-typecheck 4, contrast-cases 16,
  theme-seam 11, theme-render 29, site-routing 14, site-runtime 47 beside it —
  every count bounded to its own `##[group]` by parsing the job's own log, and
  read rather than carried over from 1149. **Eleven independent runs over four
  days agreeing is what 382 rests on**; the three harness timings in a row, 17m11s · 19m14s · 14m06s on trees
  that differ by a handful of files, are the runner deciding again, exactly as
  the image-step band records.
  **AND RUNS 1156 AND 1157 READ IT AGAIN (2026-09-16, the create's paused
  status): 1156 on `55bb554f` and 1157 on `ab0ac826`, both ALL TWENTY STEPS
  GREEN, both `site-build.mjs` `382 passed, 0 failed`**, with kit-typecheck 4,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47 beside them — every count bounded to its own `##[group]`, and
  read rather than carried over. 1157's harness step ran 09:04:20→09:22:32Z (18m12s)
  inside a job of 09:02:11→09:27:02Z.
  **⚠ AND THE ORDINAL IS DROPPED, because the chain had already drifted.** Two
  entries below both said "the twelfth" (1152 and 1155) while 1154 said "a
  thirteenth", which is this file's own *a number stamped in two places drifts
  when only one is corrected* met in the very line that counts the evidence.
  **DERIVE IT INSTEAD**: a scan of this file for a run number in the same
  paragraph as a `382 passed` claim answers **14 runs** (1114 · 1117 · 1127 ·
  1133 · 1137 · 1138 · 1142 · 1147 · 1148 · 1149 · 1150 · 1152 · 1154 · 1155) —
  1065 read **373** and is not one of them, and 1115's count is recorded as
  UNREAD and is not one either. **With 1156 and 1157 that is 16 independent runs
  over five days**, and the way to check it is the scan rather than the next
  ordinal in a sentence.
  **AND RUN 1154 READ IT A THIRTEENTH TIME (2026-09-16 04:56:20→05:18:10Z on
  `7c2a9ff4`, the column inventory's tree, ALL TWENTY STEPS GREEN):
  `site-build.mjs` `382 passed, 0 failed`**, with kit-typecheck 4, contrast-cases
  16, theme-seam 11, theme-render 29, site-routing 14, site-runtime 47 beside it
  — every count bounded to its own `##[group]`, and read rather than carried over
  from 1152. **AND IT COVERS THE MERGED CANDIDATE BY THE IMAGE ID, not by a
  `paths` list**: `7c2a9ff4` and the merge of `origin/main` `c20226e6` into it
  both hash to **`62c2700fa8c843c2`** (183 inputs), so nothing an image is built
  from moved across the merge — main's two commits are `public/chat.js`, one
  guard and three documents. (`origin/main` itself hashes to
  `c2aba7a7bd276c36`; the branch differs because the `search_path` pin touches
  `site-rls.mjs` and `site-schema.mjs`, which are in the worker's module graph.)
  **THE MERGED TREE IS 6,680** (2026-09-16, local — 6,678 pass, 2 skipped, 0 fail),
  **and the arithmetic closes exactly**: main's 6,657 plus this branch's 23 over the
  shared ancestor (22 for the agent settings, 1 for the create's control).
  **CI HAS READ IT: `unit tests` run 2632 on `ab0ac826`, green (2026-09-16
  09:02:07→09:04:08Z, the suite step 104.9 s) — `# tests 6680 / # pass 6676 /
  # fail 0 / # skipped 4`**, against local `6680 / 6678 / 0 / 2`; **the TOTAL is
  what matches and the skips are what differ**, which is the whole reason the
  number to carry is the total — the two extra are the recorded environment skips,
  and quoting a `pass` count alone drifts between the two machines. And **the two numbers below
  it are two BRANCHES rather than a sequence**, which is why neither is the head and
  why saying so beats letting a reader take the larger for the latest. Main's chain
  ran to **6,657** and this one to **6,654** over a shared **6,631**; the merge is
  both, and the arithmetic is stated where it is measured rather than predicted from
  either side.
  Before it, **6,654** (2026-09-16, local — 6,652 pass, 2 skipped, 0 fail;
  the create's own pause, whose ONE new case is `agent-binding`'s control that a new
  agent nobody paused sends `active` — the two cases that required the defect were
  REPLACED rather than added to, so the count moves by the control alone.
  **6,653 + 1 closes exactly.** **CI HAS READ 6,653** on `d47aa10`: `unit tests` run
  2628, green (07:49:38→07:51:42Z, the suite step 103 s) — `# tests 6653 / # pass
  6650 / # fail 0 / # skipped 3`, against local `6653 / 6651 / 0 / 2`; the three are
  the recorded environment skips, which is why the number to carry is the TOTAL. And
  **`site build` run 1155 is green on that sha**, all twenty steps, `site-build.mjs`
  **382 passed, 0 failed** — the twelfth independent run to answer 382 — with
  kit-typecheck 4, contrast-cases 16, theme-seam 11, theme-render 29, site-routing
  14, site-runtime 47 beside it, each bounded to its own `##[group]`.
  Before it, **6,653** (2026-09-16, local — 6,651 pass, 2 skipped, 0 fail; the
  agent settings, whose **22** new cases are `agent-send`'s eleven (the cross-product
  catalog census, the caps read out of the migration, the two readers, the update's
  present-or-absent fields and its refusals, the create, the list's catalog, the
  paused 409, and the two that read the REQUEST the store really sends),
  `agent-binding`'s ten (the form hydrated from the markup it drew, the empty state
  and its non-list shapes, the save's four fields, an empty selection against
  silence, a create becoming an edit, the Saved line, the failed save's ticks, the
  paused banner and chip, and the pause-refused send keeping its key) and
  `agent-builder-view`'s one (a list row that can gain a badge without wrapping).
  **6,631 + 22 = 6,653 and the arithmetic closes exactly**, measured per file.
  **CI has NOT read this number yet.**
  Before it, **6,657** (2026-09-16, local — the narrow text-date
  exception: `6657 / 6657 / 0 fail / 0 skipped`). **The arithmetic closes
  exactly**: 6,652 + 3 (`backend-repair` 56 → 59) + 2 (`repair-commands`
  17 → 19). `test/integration/local-pg-counts.mjs` is new and is a PROBE, not in
  the suite; it reads **48 checks, 0 failed** on a real PostgreSQL 16. CI has
  NOT read this number yet.
  Before it, **6,649** (2026-09-16, local, ON THE MERGED CANDIDATE —
  `6649 / 6649 / 0 fail / 0 skipped`). **The arithmetic closes exactly**: the
  branch tip `7c2a9ff4` measured **6,642** — re-measured in a detached worktree
  at that commit rather than derived — plus `backend-repair`'s **3**,
  `repair-commands`' **2** and `repair-workflows`' **1** for the aggregate, plus
  `main`'s one new `agent-binding` case (42 → 43). **6,642 + 3 + 2 + 1 + 1 =
  6,649.** The six sweep-survivor closers are assertions inside cases that
  already existed and add none. **A worktree run reads one FAIL and two SKIPs
  that a repo-root run does not** — `render-sandbox`'s privilege-drop case is
  about writing outside the repo root, so it is the environment, not the
  product; the TOTAL is what carries across, which is why the total is the
  number stamped. **CI HAS READ IT: `unit tests` run 2620 on `28969cb1`, green
  (2026-09-16 05:34:15→05:36:13Z, the suite step 103.4 s) — `# tests 6649 /
  # pass 6645 / # fail 0 / # skipped 4`.** The four are the three recorded
  environment skips plus `site-searchpath`'s baseline-commit case, which needs
  git objects `actions/checkout@v4`'s `fetch-depth: 1` does not fetch — the
  prediction of 4 was written down before the run, which is the only way a skip
  count is evidence rather than an observation. **AND 1154's GREEN STILL COVERS
  THE PUSHED TIP**: `28969cb1` hashes to `62c2700fa8c843c2` too, and the twelve
  files between the two are documents, scripts, a mutant spec, guards, a
  workflow and `public/chat.js` — none under `builder/**`, `worker.js` or the
  Dockerfile's context, so no `site build` fired and none was due.
  Before it, the suite was **6,642** (2026-09-16, local, ON THE TREE WITH `main`
  MERGED IN — `6642 / 6642 / 0 fail / 0 skipped`). **That arithmetic closes three ways and
  that is what makes it a measurement**: `main` carried 6,505 → 6,628 (its agent
  chain) → 6,630 (the send-box fix, `agent-binding` 42 → 44) and this branch
  carried 6,505 → 6,516 (`site-searchpath`'s 9, then its 2 baseline cases), so the
  merge is 6,630 + 11 = **6,641**, plus **one** for the column-inventory module
  case = 6,642. **AND THE MERGE CAUGHT A REAL RED**: `container-images`' input walk
  failed mid-merge on `agent-store.mjs` — `main`'s new root module, staged and not
  yet committed, and the walk asks GIT AT HEAD. Committing the merge fixed it. That
  is the recorded *"staging is not enough"* guard being exactly right, met for the
  first time during a merge rather than during a Dockerfile edit. CI has NOT read
  this number yet.
  **AND THE COLUMN INVENTORY IS AUTHORITATIVE NOW** (owner: *"Make authoritative
  schema inventories part of the before/after checks if claiming no new tables or
  columns. Otherwise narrow the claim to the names actually probed."*).
  `readSchemaState` has read `information_schema.columns` since it was written —
  `appTables` is DERIVED from those rows — and `describeContents` dropped them one
  hop later, so `--verify` could enumerate TABLES and nothing else. It carries
  `columns` now and `verifySite` attaches `columnInventory(st.columns)`,
  `{table: ["name type", …]}`. **A REPORT AND NEVER A CHECK**: there is no
  expectation to compare it against, so it must not touch `out.ok` — a verify that
  failed because a column list differs from a remembered one would be asserting
  something nobody declared — and it PRINTS ON A FAILING RUN, which is when it is
  most wanted. Absent means the catalog was never reached (identity refused), which
  is a different answer from a site with no tables. **The write-free PostgREST
  probe stays what it is: exact per NAME and not an enumeration**, so a
  "no new columns" claim now rests on the catalog and the probe is the cheap
  cross-check. **Sweep: 8 mutants, 8 killed, 0 survived, 0 never applied, 2
  comment-only controls survived** — the columns dropped again, the inventory never
  attached, the stored SPEC standing in for the catalog, the inventory made a
  CHECK, a junk catalog row rendered as a value, the type dropped, a non-array
  argument thrown on, and **the print gated on `v.ok`**. That last one SURVIVED
  pass 1 and was the recorded *"a wall nobody can drive is a wall nobody is
  guarding"*: the print lives in `main`, which no module guard runs, so it is
  closed in `test/repair-commands.test.mjs`, which spawns the script as a real
  PROCESS. Guards: `backend-repair` **51 → 52**, `repair-commands` **14** (the
  failing-verify case gained the print assertions). Every new assertion was proved
  RED four ways first.
  **AND THE BALANCE IS 137 AS OF RUN 49** (2026-09-16 09:41Z; the harness read it
  at both ends — `149 → 137`, spent **12**, which is inside the 12–13 band quoted
  before the press). Before it, **149** (read off `public.credits` 2026-09-16; its
  row last moved 19:31:38Z on 2026-09-15). Run 48 took 161 → 149. **The ledger also
  answers a question the SQL alone could not: ONE addon request makes SEVERAL
  sequenced reservations** — run 46 `#1 −3`/`#4 −5` = 8, run 47 `#1 −7`/`#4 −6` =
  13, run 48 `#1 −5`/`#4 −7` = **12** — each checked against the balance at that
  moment and **nothing anywhere summing them**. `edit_reserve` raises `bad cost`
  only above **100,000**, which no balance reaches, so **no server-side per-request
  cap exists**; the account balance is the only bound that binds, and the harness's
  `budget` is read BETWEEN cases, which an `ask` run never has two of.
  The unit suite was **6,631** (2026-09-16, local — 6,629 pass, 2 skipped, 0 fail; the
  three since 6,628 are the two live-found composer defects and their control). The agent-run branch measured **6,606** and `main`
  carried **22** cases the branch had not seen (the addon reporting work), so
  **6,606 + 22 = 6,628 and the arithmetic closes exactly**. The branch's own chain:
  6,592 for the send, then **6,606** for the three review fixes — six browser cases
  (typing through a real poll, the restore's two refusals, the input hook, an edited
  retry, an absorbed mismatch) and eight route cases (the ring, its failure, no binding,
  an absorbed press rung, a runless send, `mismatch`, and the cross-product census).
  **CI has NOT read 6,628 yet.**
  The unit suite is **6,516** (2026-09-16, local — the probe's immutable
  baseline, whose new cases are `site-searchpath`'s **two** (9 → 11: the
  default asserted an immutable sha with the refusal kept, and the sha proved
  pre-fix by asking GIT); **6,514 + 2 closes exactly**, and `addon-sweep` stays
  **32** — the shown-steps reader is assertions inside the case that already
  reads the coverage record, with one older expectation re-anchored off a
  length. **LOCAL IS `6516 / 6516 / 0 / 0` AND CI WILL READ 4 SKIPPED, NOT 3**:
  case 11 needs the baseline commit's git objects and `actions/checkout@v4` is
  `fetch-depth: 1`, so it skips there — visibly, rather than passing and
  claiming to have checked. **CI HAS READ IT AND THE PREDICTION MATCHED:
  `unit tests` run 2614 on `04b6f335`, green (2026-09-16 04:32:35→04:34:40Z) —
  `# tests 6516 / # pass 6512 / # fail 0 / # skipped 4`**, against local
  `6516 / 6516 / 0 / 0`. The prediction of 4 was written into the commit message
  before the run, which is the only way a skip count is evidence rather than an
  observation. **`site build` run 1152's green still covers this tip, and by the
  IMAGE ID rather than by a `paths` list**: `71c2c4b8`, `546550b7` and
  `04b6f335` all hash to `b5c638bdfb04f3c4` (182 inputs), so nothing an image is
  built from moved and no run fired or was due.
  **6,514** before it (2026-09-16, local — the `search_path` review
  after its scope correction, whose new case file is
  `test/site-searchpath.test.mjs`'s **9**: the census over the real emitted DDL,
  the two emitters counted apart, the ORDER, the invoker form, the placement
  before `AS`, the privilege control, the three identity helpers, **the SCOPE
  (what a next schema change re-pins and what it does not)** and **the trusted
  set pinned to exactly `public, pg_temp`**. **6,505 + 9 closes exactly**; the
  re-anchor in `neon-e2e` is an integration probe and is not in the suite.
  **CI HAS READ IT: `unit tests` run 2612 on `748ae587`, green — `# tests 6514 /
  # pass 6511 / # fail 0 / # skipped 3`**, against local `6514 / 6514 / 0 / 0`;
  the three are the recorded environment skips, which is why the number to carry
  is the TOTAL. **`site build` run 1152 is GREEN on the PARENT `71c2c4b8`**, and
  it covers this tip by the recorded ancestor rule — the five files between the
  two are `CLAUDE.md`, `docs/owner-notes.md`, a mutant spec and two test files,
  and not one is under `builder/**`, `worker.js` or any other glob in that
  workflow's `paths`, so no run fired for the tip and none was due. That run (2026-09-16,
  all twenty steps, `site-build.mjs` **382 passed / 0 failed**, with
  kit-typecheck 4, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47 beside it — the TWELFTH independent run to
  answer 382. **That reading said the per-step `##[group]` bounding "did not
  attach on this log format" and settled for step order; run 1163 FALSIFIED
  that** — the bounding attaches, the window just has to be drawn marker to
  marker rather than inside the group, because GitHub wraps only the command
  echo. See the DST section for the measurement; 1152's counts are unchanged and
  only their attribution was weaker than it needed to be.)
  Before it, **6,505** (2026-09-16, local, ON THE MERGED TREE). **Two
  sessions stamped a suite and neither number was the merged one**, which is
  this file's own "a number stamped in two places drifts when only one is
  corrected": this branch measured **6,498** and `main` brought
  `test/agent-builder-view.test.mjs`, whose **7** cases are the whole
  difference — **6,498 + 7 = 6,505, and the arithmetic closes exactly**,
  measured by running that file alone rather than by subtracting. The
  `agent-builder/test/*.test.mjs` files are NOT in this count: `npm test` runs
  `node --test "test/*.test.mjs"` and that glob does not reach them.
  **6,498** before the merge (2026-09-16, local — the evidence lookup's own
  bypass, whose new cases are all `addon-route`'s **two** (64 → 66: the
  component/table reproduction with its matching-item positive control in the
  same reply, and the `configuredBy` face with its own control); **6,496 + 2
  closes exactly**. `requirement-coverage` stays 22 and gained ASSERTIONS inside
  a case that already existed — `evidenceItems` driven arm by arm, both halves
  of the item identity, the kindless item, the folded name, the fail-closed
  unknown `by`, a non-array `made`, the scope end to end, and a hand-off's prose
  ignored. **CI HAS READ IT: `unit tests` run 2602 on `561db453`, green
  (2026-09-16 01:07:50→01:09:40Z, the suite step 97.9 s) — `# tests 6498 /
  # pass 6495 / # fail 0 / # skipped 3`**, against local `6498 / 6498 / 0 / 0`;
  the three are the recorded environment skips, which is why the number to
  carry is the TOTAL. **AND `site build` run 1150 IS GREEN ON THIS SHA** — all
  twenty steps, `site-build.mjs` 382/0, stamped above.
  **6,496** before it (2026-09-16, local — the kinded reference, whose
  new cases are all `addon-route`'s **two** (62 → 64: the owner's two
  collisions, an applied TABLE against a claim about a FUNCTION of the same
  name and a FAILED function against a claim about the TABLE); **6,494 + 2
  closes exactly**. `requirement-coverage` stays 22 and gained ASSERTIONS
  inside existing cases and no new case — the `ITEM_KINDS` census both ways
  with the tool's enum, `referenceOf` driven directly, ambiguity outranking a
  prose match with its control, a junk kind dropped, a stray kind on a hand-off,
  and the visibility question asked of the reference's kind. **CI HAS READ IT:
  `unit tests` run 2599 on `e032afad`, green (2026-09-16 00:08:50→00:10:47Z,
  the suite step 104.3 s) — `# tests 6496 / # pass 6493 / # fail 0 /
  # skipped 3`**, against local `6496 / 6496 / 0 / 0`; the three are the
  recorded environment skips, which is why the number to carry is the TOTAL.
  **6,494** before it (2026-09-15, local — the same evidence rules
  applied to `covered`, whose new cases are all `addon-route`'s **three**
  (59 → 62: a `covered` claim in a mixed-success function step, a `covered`
  claim about a section nobody can see with its control, and an item the ENGINE
  dropped whole); **6,491 + 3 closes exactly**. `requirement-coverage` and
  `addon-steps` gained ASSERTIONS inside existing cases and no new case — the
  cross-kind haystack both ways round, `brokenAny` with its kinded control, the
  kept-not-returned bare name, the tool's own description and the `unsupported`
  item drop. **CI HAS READ IT: `unit tests` run 2597 on `23f6ae22`, green
  (2026-09-15 23:26:02→23:27:51Z, the suite step 90.6 s) — `# tests 6494 /
  # pass 6491 / # fail 0 / # skipped 3`**, against local `6494 / 6494 / 0 / 0`;
  the three are the recorded environment skips, which is why the number to carry
  is the TOTAL.
  **6,491** before it (2026-09-15, local — the three reporting cases the
  hand-off/implementation split left open, whose new cases are all
  `addon-route`'s **four** (55 → 59: the mixed-success function step, the reuse
  of an existing function, its CONTROL on a site that does not declare it, and
  the stocked site answering three different silences in one reply); **6,487 + 4
  closes exactly**. `requirement-coverage` gained the three-group census and
  the `unseen` counter as ASSERTIONS inside existing cases and no new case.
  **CI HAS READ IT: `unit tests` run 2594 on `82e3c885`, green (2026-09-15
  22:24:15→22:26:48Z) — `# tests 6491 / # pass 6488 / # fail 0 / # skipped 3`**,
  against local `6491 / 6491 / 0 / 0`; the three are the recorded environment
  skips, which is why the number to carry is the TOTAL.
  **6,487** before it (2026-09-15, local — run 48's reporting fix and
  the three evidence gaps, whose new cases are all `addon-route`'s **eleven**
  (44 → 55: run 48's late hand-off with its function applied, the same named by
  `item`, with nothing applied, with creation refused, the forward control, a
  kind this layer cannot see, a page that did not survive, a coverage composed
  before the publish, and the two input-digest cases with the output-order
  wall); **6,476 + 11 closes exactly**. `requirement-coverage` and
  `addon-steps` gained ASSERTIONS inside existing cases and no new case — the
  six-state list, the mark's counters, the `configuredBy` rename, the hand-off
  ledger and both halves of the run-48 shape. CI has NOT read this number yet.
  **6,476** before it (2026-09-15, the reference-only apply mode);
  **6,472** before that (2026-09-15, local — the repair steps' shell,
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
- **…AND A MUTANT YOU WROTE CAN BE INERT TOO — read what it DOES, not what it
  was meant to do (2026-09-17, two in one spec).** Two shapes, both found by
  measuring rather than by reading: a change **undone by the line after it** (it
  set a flag above a `return`, so the same refusal went out and nothing about
  the request moved), and a change to a value that is **provably constant on
  every path a test can reach** (`cost: aCost` where `let aCost = 0` has its one
  assignment under a branch the synchronous path never takes — so it *was*
  `cost: 0` there, while being a real difference on the job path). Both read as
  guard gaps and neither was one. **A survivor is a question about the mutant
  first and the guards second.**
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
- **⚠ AND THAT TRAP MUST NOT FIRE ON A SUCCESSFUL EXIT — it discards YOUR OWN
  uncommitted work (2026-09-16, cost one restore).** `trap 'git checkout -- <the
  swept files>' EXIT INT TERM` reads as belt-and-braces and is not: the runner
  already restores in its own `finally`, so on a clean run the trap is a second
  restore of files that are already restored — and `git checkout` restores them to
  **HEAD**, not to the uncommitted edits the sweep was measuring. Measured: a 43/43
  green sweep ended with `git diff` EMPTY on all three swept files, the product fix
  gone. **The trap is for INT and TERM only** — or commit before sweeping. The tell
  is a clean tally beside an empty diff, and the recovery is the spec's own anchor
  census: every `from` string is a line of the change, so `0` occurrences names
  exactly what was lost.
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
  **AND THE LIST IS PART OF THE RESULT, SO THE RUNNER PRINTS IT** (2026-09-17):
  it took the list on argv and recorded it NOWHERE, opening on `baseline…` and
  closing on a count, so a clean tally read back later could not be checked for
  its own SCOPE. `40/40/0` and `40/40/0 against these nine files` are different
  claims and only the second is auditable; it cost a file count stamped here from
  memory, which is a claim ahead of its evidence in the one instrument whose whole
  job is evidence. The scope line goes **before the baseline** (a sweep that dies
  in its baseline still says what it was trying to do) and an empty list is SAID —
  an empty list and a forgotten one are identical in a log.
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
- **AND `?head_sha=` ANSWERS `total_count: 0` FOR A SHA THAT REALLY HAS RUNS —
  measured 2026-09-19 on two consecutive commits.** `GET /actions/runs?branch=…`
  found `unit tests` and `site build` on both; the same endpoint filtered by
  `head_sha` answered **zero** for each. **A zero from that filter is the
  instrument, not the repository**, and it is the worst-shaped answer available:
  it reads exactly like *"no workflow fired for this push"*, which is a real and
  ordinary outcome here (`paths` and `paths-ignore` produce it every day), so
  there is nothing to make it look wrong. It cost one monitor that polled for
  completion, never saw a run, and **ended silently after 55 rounds**. Ask by
  BRANCH and match the sha yourself.
- **A FALSE ALARM IS WORSE THAN A MISS**, and a false ALL-CLEAR is worse than
  either. Any new lint measures its false-alarm rate against the real corpus and
  must reach ZERO before it ships. **A live check's ambiguous anchor fails
  SILENTLY**: `justify-content: center; overflow: hidden; }` also ends `.ig-ico`,
  so a watch said LIVE about a rule the change never touched. **Count the pattern
  in the source first.**
- **`pgrep -f` / `pkill -f` MATCH YOUR OWN SHELL.** Ten-plus instances. Kill by
  PID; watch a log's tail. **AND A WAITER IS THE QUIET HALF OF IT (2026-09-17):**
  `while pgrep -f "node scripts/mutate.mjs"; do sleep 20; done` never exits,
  because the waiter's own `/bin/bash -c … eval '…'` command line contains that
  string — so it waits on itself for ever and the notification never comes.
  **A waiter that will never fire is indistinguishable from a job that never
  finishes**, which is worse than killing the wrong process: nothing is harmed
  and nothing is learned. **Wait on the PID** — `while kill -0 <pid>; do sleep
  15; done` has no pattern to match — and `pgrep -af` prints the command lines,
  which is what shows the waiter standing in its own list.

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
  **AND THE HARD PART IS KNOWING ONE IS IN FLIGHT — MEASURED 2026-09-16, a near
  miss of 1m52s.** Another session's `lane sweep` run 49 ran 09:31:16→09:41:18Z;
  a push to main at 09:40:23Z rolled the container at 09:43:09.99Z. Nothing was
  harmed, and the push overlapped that run's last 55 seconds. **Main's history
  is not the signal**: the run's own commit landed at 09:46, five minutes after
  the push it would have warned about. **Ask GitHub what is RUNNING, not what
  has LANDED** — the `lane sweep` run was `in_progress` and readable from 09:31,
  so one listing of in-flight Actions runs before a container-rolling push is
  the whole check.
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
  `scripts/backend-repair.mjs --apply-reference` closes the rows for good, and
  the derivation is proven credential-free over the whole corpus: **27 of 27
  sites with a recorded name equal `dbNameForSite(slug)`, zero mismatches**. The
  script still verifies each one by connecting, because a name that derives is
  not a database that answers.
  **ONE OF THE FIVE IS REPAIRED — `repairbench-1`, 2026-09-15**, the owner's
  press: `--apply-reference` wrote `site_repairbench_1` after proving identity,
  and a separate `--verify` process re-read Supabase and classified the site
  **`ready`** on five postconditions with exit 0. **FOUR REMAIN `incomplete`:
  `ashgrove-1`, `fretwork-1`, `northgroup-5`, `washhouse-1`** — untouched by
  instruction, and each is the same two presses.
- **AN ADDON DESIGNS A TABLE THAT NOTHING CAN EVER FILL — REPORTED SINCE
  2026-09-15, and deliberately not refused.** `repairs` was declared `read: "none", write: "none"` — the `admin`
  pair — so no client grant is emitted (measured live: `42501 permission denied
  for table repairs` to an anonymous POST) **and `seedSiteRows` skips it**, that
  function seeding the `display` pair and nothing else by a rule with its own
  measured history. The designer answered starter rows and they were correctly
  discarded. The table is empty by construction. **The page no longer counts it
  — the count correction moved `count_booked_repairs` onto `bookings` on
  2026-09-15 and `/status` reads 3 — so the SYMPTOM is gone and the DEFECT is
  not**: `repairs` still exists, still has no writer and no seed, and the next
  addon that chooses that shape gets the same table. **Nothing anywhere notices**: no step asks whether a table the
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
- **THE EDIT PATH CAN STILL DELETE EVERY COMPONENT A REQUEST NEVER MENTIONED
  (open, 2026-09-17, found while fixing the addon's copy of it).** `worker.js`'s
  page rung reads `const pStored = (pValid.parts && pValid.parts.length) ? await
  loadSiteParts(env, ownerSlug) : null;` and merges into it. `loadSiteParts`
  answers `null` for a read that FAILED exactly as it does for a site with no
  components, and `mergeParts(null, [one])` answers `[one]` — so a failed read
  plus any returned component writes a `parts.json` holding ONE file, and every
  other component on the site is gone. Driven on the addon path, where the same
  shape cost the reproduction two components.
  **The fix is the one the addon has**: `readSiteParts`'s three states, one
  snapshot per request, and nothing written while `ok` is false. Deliberately
  NOT done here — the owner's instruction for that round was *"Keep edit-path
  work … separate"* — and the addon's `readSiteParts` is already exported-shaped
  for it, so this is a wiring change rather than a design one.
- **THE EDIT PATH'S `page` RUNG NEVER TELLS THE CUSTOMER ABOUT AN EMPTY PICTURE
  FRAME EITHER (open, 2026-09-17, found while fixing the addon's copy of it).**
  `worker.js:22532` computes `pSlots = countImageSlots(…)` on a rung whose
  directive is `images: 0` — *"do not write any `@@IMG:@@` token"* — so the
  count is the number of tokens a model wrote against an instruction not to,
  and `photoNote` is silent on every obedient answer. A tweak that adds a
  picture slot to an existing page publishes an empty frame the customer is
  never told about, exactly as the addon did.
  **The fix is the one the addon has**: `newEmptySlots(before, after)` beside
  the token count, per page and only the increase, both taken before
  `applyImages` sweeps so no frame is reported twice. The function is exported
  and driven. Deliberately NOT done here — *"Keep edit-path work … separate"* —
  and it is a wiring change rather than a design one.
- **A WORKING `video-embed` IS INVISIBLE TO THE `data-slot` CENSUS (open,
  2026-09-17, found by verifying the render).** The component stamps
  `data-slot="video-embed"` on its FALLBACK branch — the "Video unavailable"
  panel — and on nothing else, so the success branch's wrapper and iframe carry
  no slot at all. Measured through react-dom/server over the real kit file:
  five real URL shapes render a correct iframe with no `data-slot`, and only the
  two unparseable ones are countable. **Two instruments go quiet on it**: `curl
  --compressed <slug>.gofarther.app | grep -o 'data-slot="[^"]*"'`, which is how
  "what does this site really use" is answered without auth or a publish; and
  the css lane, which is required to target by `data-slot`. So a site with a
  working video reads as a site with none, and a site with a BROKEN one reads as
  having a video. One attribute on the outer `<div>` of the success branch is
  the whole fix; it is a kit file, so it is an image input and the deploy rolls
  the container and wants `site build`.
- **EXISTING MODEL FUNCTIONS ARE NEVER RE-PINNED (open, 2026-09-16, kept
  SEPARATE at the owner's instruction: *"If upgrading existing functions is
  needed, propose that separately"*).** The `search_path` pin reaches a function
  the engine RE-DECLARES, and `_meta.functions` stores no body, so
  `normalizeSchema` drops every stored function and no schema change ever
  re-emits one. Measured both at the module and on a real PostgreSQL 16: after a
  next change, the identity helpers and every trigger function are pinned and
  the model's function is still unpinned and still redirected through `pg_temp`.
  **So every model-written function on every site built before the pin stays
  exposed to the mechanism**, and those are exactly the `SECURITY DEFINER` ones
  granted to `anonymous`.
  **NOT PROPOSED, NOT WRITTEN, AND NO BACKFILL RUN.** The shapes worth weighing
  when it is: (a) persist the body in `_meta` so a next change re-declares
  naturally — the largest change, and it puts model-written SQL into the stored
  spec; (b) an `ALTER FUNCTION … SET search_path` sweep over `pg_proc` per site,
  which touches nothing but the setting and needs a credential and the same
  preview/apply/verify discipline as `backend-repair`; (c) leave it, on the
  reachability argument, and record that the argument rests on a layer we do not
  own. **Which of the three is the owner's call**, and nothing here presumes it.
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
- **⚠ "fal balance is empty, so no generated photograph has ever been bought on a
  site" IS FALSIFIED AND IS CORRECTED HERE (2026-09-17).** That sentence was
  written **2026-08-08** (`git log -S` over this file) and has been carried
  through four prunes since; `ashgrove-1` was built on **2026-08-30** and this
  same file records it as *"one page, 2 photographs: 45 billed"*. **MEASURED
  today**: `https://ashgrove-1.gofarther.app/` serves
  `/u/ashgrove-1/86833f9a21022de9a22d55cd6bc3ba0d.jpg` at **200, 1,348,708
  bytes, `image/jpeg`** — so fal had a balance three weeks after the line was
  written and a photograph really was bought and really is being served.
  `fretwork-1` also serves a `/u/` url, a **150-byte PNG**, which is far too
  small to be a photograph and is almost certainly its uploaded mark; noted
  because `photoUrls` counts any `/u/<slug>/` url and does not tell a logo from
  a photograph.
  **WHAT IS TRUE TODAY IS UNKNOWN FROM HERE AND IS NOT BEING GUESSED IN EITHER
  DIRECTION.** No session holds a fal credential, and fal's own API is the only
  reader of its balance. **The wrong direction is the expensive one**: an empty
  balance is a GRACEFUL outcome — `imageNote` answers *"Couldn't make the
  photographs this time, so the pictures are placeholders"* — so a paid run
  against an empty fal spends the addon's credits, publishes placeholders, and
  proves nothing about placement while looking like a complete result. It is a
  **precondition to confirm before a photograph test, never a risk to absorb.**
- **Mobile layout for the app is deliberately NOT being done** (owner's call,
  desktop-first).
