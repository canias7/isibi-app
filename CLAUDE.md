# Go Farther

> **Read `docs/owner-notes.md` at the start of every session** — the owner's
> running log and how they like things done. Keep it updated.
>
> **PRUNED 2026-09-28 (owner: *"clean up claude md, and transfer anything
> important to other docs, claude md is too full"*).** It was **15,182 lines /
> 1,046,126 bytes** and is **1,815 lines / 121,214 bytes** — 88.4% smaller.
> This is the **sixth** prune: 3,786 → (2026-08-28) → 10,004 → (09-09) 3,808 →
> 7,883 → (09-11) 3,933 → 7,615 → (09-14) 3,157 → 15,657 → (09-20) 3,721 →
> **15,182** in eight days → now. It grows back the same way every time: the
> STORY of each shipped change piles up beside its law. **The totals are the
> file as it stands, measured after the assembly.**
>
> **This time nothing was deleted: everything was moved.** Every line of the
> old file is in exactly one place — still here word for word (the working
> rules, the structure, the deploy rules, how a site gets built, data, auth,
> payments and mail, credits, the ladder table, THE TRAPS, what is proven live,
> the rollback), or moved word for word into one of the docs in the map below.
> A script checked all 31 line ranges against their destinations before this
> was committed. The file as it stood is `git show 86eb5703:CLAUDE.md`; the
> earlier full records are `git show d304120e:CLAUDE.md` (2026-09-14 → 09-20),
> `a4d0f5e5`, `6393b134`, `7104c87b` and `5cfd4e58`.
>
> **THE RULE THAT KEEPS IT THIS SIZE: this file holds what is TRUE NOW and the
> RULES; the docs hold the RECORDS.** When a change ships, its rule goes in the
> summary here and in the topic doc; its story — the reproduction, the review
> rounds, the CI stamps, the deploy's readings, the run's evidence — goes in a
> new dated file under `docs/history/` and in the checklist; a deploy's image
> readings go in `docs/deploy-record.md`; a new open item goes in
> `docs/backlog.md` with a one-line title here. **When an entry is compressed
> rather than moved, keep the numbers**: the timings, the arithmetic that
> closed, the bounds and the flag defaults are what the next decision is made
> from, and re-deriving one costs a paid run.
>
> **Nothing reads this file from disk** (checked 2026-09-28: every `CLAUDE.md`
> hit in the tree is a comment). **Two docs ARE read by tests**:
> `docs/owner-notes.md`'s "Names that must not be renamed" table (by
> `test/brand-rename.test.mjs` and `test/media-deleted.test.mjs`) and
> `docs/components.md` (compared byte for byte by
> `test/components-doc.test.mjs`). Keep both as they are.

## Where things stand (2026-09-28)

- **`main` is `f5e941f4`, deploy 2165** (19:07 UTC, image `8a10715339cdc780`,
  predicted on both ends and built) — **deployed, not runtime-confirmed.** The
  session's dispatch answers 403, so the confirmation is the owner's free
  canary press: `edit canary` from `main`, spend `no`, `expect_deploy`
  `f5e941f494fd96c039eeee4e6f1d44120b80e062`, `expect_image`
  `8a10715339cdc780`. It carries the redirect fix (a publish reads the stored
  sidecar through `manifestFromCsv`); the next real publish is its first live
  use, and redirects dropped between 2026-08-17 and this deploy are not rebuilt.
- **The branch `claude/help-needed-ehlwlj`** is ahead of `main` by the canary's
  read of the description stored in a site's settings (`2a7767cc`:
  `readStoredHead`, the app's own SEO route read in every inventory) and by
  documents. None of it deploys; a press from the branch runs the branch's
  script against main's Worker.
- **Balance 45** on the building account, read by run 50 (18:41 UTC); newest
  ledger row 333, run 49's menu edit. The unit suite is **8,207** at `f08c3ba1`.
- **Closed by the owner, not to be repeated**: live test 2 (run 32); Test 3
  (run 34) with the stylesheet corrections (deploy 2161); the kit-heading fix
  (2162); Test 4a (runs 37 and 39); Test 4b's D1 (run 42) and the conditional
  recovery write (2163); the scoped rules acceptance (run 44 — `lido-axes-b`'s
  bookings stay closed); Test 5's page removal (run 49) and restoration (run 50)
  with the removal-door correction (2164).
- **Next: Test 6, PREPARED and not dispatched** — two changes in one message on
  `fold-lane-bakery` through the existing canary: the site's default search
  description, then a band moved on the Visit page only. The frozen sentence
  (358 characters, sha256 `484b3feb…`), the acceptance judged on what was
  stored and published, the restore to `01790468089054-8btpep` and the paid
  inputs are the checklist's *Test 6*. About 5–6 credits, up to about 10, when
  the owner approves. It covers mixed work through the look door only;
  **real-model mixed work through the removal door stays outstanding.**
- **The short edit-path checklist** (demonstrated live · tested only with
  supplied model output · untested, material gaps first) is the top of
  `docs/investigations/edit-path-checklist.md`, and every test's plan, readings
  and closure are recorded there.
- **Parked or kept separate by the owner**: React #418 (hydration); the
  translator reading page code as text; D2 and D3 (grants apply and a real
  order on `fold-lane-bakery`); model-written replies; `lido-axes-b`'s
  still-visible booking invitation; the lost redirects; the QR code pointing at
  a removed page; the bare not-found text on Start sites; and a multi-step look
  reply naming only the look (review #9).
- **Codex's investigations** — the add-on escalation correction, the edit-path
  milestone and the literal-text guard — are in `docs/investigations/`.

## Where everything else lives

| Doc | What it holds |
|---|---|
| `docs/owner-notes.md` | the owner's running log, in plain English — read at session start |
| `docs/investigations/edit-path-checklist.md` | the short edit-path checklist, and every test's plan, readings and closure |
| `docs/architecture.md` | the owner's drawing: build, then edit / add-on / delete on one spine |
| `docs/edit-path.md` | what an edit may add, what the page rung preserves, the 21 lanes, renaming |
| `docs/addon-path.md` | the add-on's kinds, its requirement report, photographs, QR codes, outside connections |
| `docs/site-database.md` | the four backend states, the `search_path` pin, column-scoped write grants |
| `docs/containers-and-jobs.md` | no clock in the container, the model-call transport, where a job ran, the probes |
| `docs/build-path.md` | the design call, the published site, the code explorer, the design and page splits |
| `docs/instruments.md` | the free instruments, what a paid harness refuses, the edit canary and its modes |
| `docs/app-rules.md` | the builder app's rules, the model table, and the agent builder's half in this app |
| `docs/deploy-record.md` | every deploy's image prediction and timings, 2137 → 2165 (append new ones here) |
| `docs/backlog.md` | the open items in full |
| `docs/history/` | dated records of every run and fix round, 2026-09-21 → 09-28, and the old status and live-state sections — indexed in `docs/history/README.md` |
| `docs/investigations/` | the milestone, text-preservation and add-on escalation investigations |

---

## Two halves, one Worker

Both are **Go Farther** now — one brand, renamed 2026-08-30.

- **The media side** — an AI image/video/voice generator at **gofarther.dev**.
  **DELETED 2026-09-12** in five stages, ~23,000 lines: the composer, the
  gallery, the director, `/api/video|image|audio`, the Media Agent, the avatar,
  the universal memory, the game builder, and the customers' 53 stored
  generations.
- **The site builder** — a customer describes a business in chat and gets a
  published website at **`<slug>.gofarther.app`**. `gofarther.dev` is the tool
  they use; `.app` is theirs. It is the only work now.

**WHAT THE DELETION KEPT, each checked rather than assumed**: the membership
tiers; the credit ledger and every RPC under it (`gen_charges` is a live
Postgres table with `refund_charge` over it — money history); `usage_log` (it
reads as media-era and is the BUILDER's quota); `safeFetch`/`hostIsBlocked`
(the outbound webhook takes a customer's URL); and **fal for the builder's own
photographs** — `genSitePhoto` calls `fal.run` DIRECTLY where the media side
called `queue.fal.run`, so deleting `/api/image` could never take a site's
pictures with it. The 108 site-builder uploads under `<uid>/site/` (162 MB)
stay. **`home` IS AN ALIAS FOR `sites`, NOT A VIEW** — `KNOWN_VIEWS` is
`['sites','settings','agents']` and anything else falls back to the builder.
**The landing page still carries the media side's CRT channel selector and its
model pipeline**, deliberately: rewriting it is a design job the owner directs.
Both landing doors open the builder and the non-website channels are inert.

**THE DEAD-CODE DELETION (2026-09-13)** took ~1,400 lines of `worker.js` and
`public/chat.js`, four modules, a 1.5 MB wasm dependency, and **2,280 lines of
unreachable CSS**. The law that survives:

- **THE LINE IS "DEAD BY CONSTRUCTION" versus "DEAD ONLY GIVEN STORED DATA".**
  A declaration nothing references, or a branch whose condition cannot be true
  from the code alone, is measurable here and goes. A branch reachable only
  from a record in a customer's localStorage is not and STAYS — `chat.js` keeps
  every legacy-`html` arm.
- **`public/styles.css` is held at ZERO unreachable rules** by
  `test/css-reachable.test.mjs` with an EMPTY `KEEP` list. It went 7,210 lines /
  484,036 bytes → **4,930 / 327,903**; the served sheet is 156,133 bytes lighter
  per page load. **A prefix is the TAIL of a literal before a `+`, not the
  literal.** False-alarm rate measured four ways and is zero, including a real
  Chromium comparing all 1,744 elements across five pages at two widths.
- **A comment goes only when EVERY rule it introduces goes** — section
  boundaries are not subject boundaries.
- **A CSS SYNTAX ERROR SHIPPED FOR A DAY** because a deletion cut a two-line
  rule in half; a browser recovers by discarding text until the next `}`,
  silently. The guard asserts the braces balance and `braceReport` is DRIVEN.
- **OPEN**: `GET /preview/<uid>/<nonce>` is served and **nothing anywhere writes
  that object**, so it has answered "Preview not ready" to every request it has
  ever had. Recorded in `client-routes.test.mjs`'s `KNOWN_DEAD` prose.

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
- **Customer replies should EVENTUALLY be model-written from authoritative
  operation results** (owner, 2026-09-24: *"Record my future preference:
  customer replies should eventually be model-written from authoritative
  operation results. Do not implement that redesign now."*). Recorded, not
  started. Until then replies are composed deterministically in `editReply` —
  and the half that carries over is already the rule: **what a reply states
  comes from what the operations really did** (`pageOps`, `partial`, the diff,
  the ledger), never from the request's wording. **Kept for that work, not
  reopened** (owner, closing D1, 2026-09-27): the data rung's "✅ Updated one
  entry in loaves." names the table and not the change, because `applied`
  carries only the table, the row id and the column; the rules rung's "changed
  whether it's open" is the same kind of sentence.

---

## Structure

- **`public/`** — the frontend, plain HTML/CSS/JS, no build step: `index.html`
  (the chatbox, the only app page), `styles.css`, `chat.js` (the builder's
  client and the agent builder's), `auth.js` (Supabase email/password +
  email-code via GoTrue fetch), `edit-poll.js`, `site-list.js`, `site-zip.js`,
  the marketing pages (`privacy`, `terms`, `confirm`, `data-deletion`) and the
  icon set.
- **`worker.js`** — the Cloudflare Worker. Serves assets, and the builder's
  whole `/api/site/*`, `/api/db/*` and `/api/agent/*` surface. **The media
  side's routes are GONE** — `/api/video|image|audio`, `/api/direct`,
  `/api/import/fetch` and `/api/save` occur nowhere in it but prose (checked,
  not assumed). **It CAN be imported by tests** — the belief that it could not
  is why twelve features shipped dead; see the traps below.
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

---

## Deploy

Push to `main` → GitHub Actions → Wrangler → Cloudflare Workers → gofarther.dev.

**A CONTAINER IMAGE IS BUILT ONLY WHEN ITS INPUTS CHANGED (2026-09-04).**
`.github/scripts/container-images.mjs` runs before the Wrangler step: for each
container whose `image` is a Dockerfile path it hashes the git objects the
Dockerfile COPYs (plus the Dockerfile and its `.dockerignore`) into a 16-hex
id, builds and pushes `isibi-app-<class>:<id>` only when the registry lacks
that tag, and rewrites the CHECKOUT's `wrangler.jsonc` to the FULL reference
`registry.cloudflare.com/<account>/<name>:<id>` — full, because Wrangler's
validator parses a non-file image with `new URL("https://" + image)` and a bare
`name:tag` is an invalid URL, the tag reading as a port.

- **THE REGISTRY IS ASKED FOR THE TAG BY NAME** — a HEAD on
  `/v2/<account>/<name>/manifests/<id>` with a five-minute pull-only credential.
  **NOT `wrangler containers images list`**: it fetches ONE catalog page and
  never the next, and on deploys 2017 and 2018 its answer omitted an image that
  had been pushed three times, so both were rebuilt every deploy.
- **A registry that cannot be asked BUILDS and says so** — a build is always
  right and only slow; a wrong skip ships a stale image.
- **A deploy that references an image builds nothing and rolls nothing unless
  the reference MOVED.** Measured on deploy 2018: both images rebuilt under
  unchanged tags and Wrangler answered "no changes" for both apps.
- **THE WORKER'S OWN MODULE GRAPH IS AN IMAGE INPUT SINCE 2026-09-05.** The
  site image carries `worker.js` and every module it imports as the job runtime,
  so a push touching `worker.js`, `site-add.mjs`, `edit-job.mjs`, `page-gen.mjs`
  or any file in that closure rebuilds and rolls. What still reuses: a push
  touching only `docs/`, `test/`, `scripts/`, `public/`, `supabase/` or the
  workflows.
- **AND SOME OF THOSE DO NOT DEPLOY AT ALL** — `deploy.yml` carries a
  `paths-ignore` (`**.md`, `docs/**`, `LICENSE`, `test/**`, `scripts/**`), so
  such a push produces **NO RUN**, not a fast one. **`.github/workflows/**` is
  NOT in it**, so a push that looks docs-only still deploys if it touches a
  workflow — met twice.
- **THE ROLL IS DECIDED BY THE WHOLE PUSH, NEVER BY ITS TIP COMMIT.** The two
  honest ways to ask: `git diff --name-only <what main had>..<what you pushed>`
  before, and the deploy's own image step after.
- After any code push, wait **15–20 minutes** before firing container work that
  must run the new code. The hold is about the ROLL, whatever the image step
  cost. **The base image is not an input**: an upstream `node:22-slim` update
  reaches the image only when something here changes.
- **AND A PUSH THAT ROLLS NOTHING OWES NO HOLD AT ALL** (owner, 2026-09-24:
  *"Determine container-image reuse from the actual inputs; don't assume a roll
  or require an arbitrary wait"*). Predict the id over both ends before the push,
  and read the image step's `reused` and Wrangler's `no changes` after it. On
  deploy 2152 (a `public/`-only product change) those two readings and the
  served-file check were the whole verification.

**THE TIMING BAND AND THE IMAGE-ID PREDICTOR, IN BRIEF.** The deploy-by-deploy
record — every prediction, log line and timing from deploy 2137 to 2165 — is
`docs/deploy-record.md`; add each new deploy there.

- **A push that rolls nothing is a one-minute deploy**: 47 s on 2019 and 46 s
  on 2140 (image step ~1 s, Wrangler ~16 s); 42–57 s on 2152–2155, each
  uploading `chat.js`. **A push that moves an image input** takes an image step
  of ~2m00s–2m56s and a job of ~2m48s–3m43s (2138–2165). The runner is cold
  whatever the diff — **0 `CACHED` layers on every rebuild from 2144 to 2165** —
  so a step's duration says nothing about how much changed. Whether to import a
  registry cache is open and unmeasured.
- **THE IMAGE ID IS COMPUTED BEFORE THE PUSH.** `containerInputs`/`imageId` are
  pure functions of the git objects the Dockerfile COPYs, so run them over BOTH
  ends — `origin/main` and the candidate, and over the merge commit itself when
  there is one, never only the branch tip — and then match the log's
  `built …:<id> (registry answered 404; N inputs …)` or `reused …:<id>
  (registry answered 200 …)`, and the `-`/`+` image pair under `SUCCESS
  Modified application`. **It has matched every deploy it was asked of since
  2137**, rolls and five confirmed negatives alike (no move on 2140 and
  2152–2155), and the input COUNT agrees on its own channel (184 → 188 as files
  joined the worker COPY line). **Today: 188 inputs, 158 distinct paths** (30
  files are COPYed twice). **GitHub masks digit runs: `***` is a run of `1`s**,
  so match on the unmasked characters.
- **If the id does not move, nothing an image is built from moved** — a
  stronger answer than reading a `paths` list — and **a rollback's speed is
  predictable**: a revert restores a tree the registry already holds, so its
  image step says `reused`.

**READ THE ROLL OUT OF THE LOG'S OWN DIFF, never inferred from the step's
duration**: `EDIT isibi-app-sitebuildcontainer`, the `- "image"` / `+ "image"`
pair, `SUCCESS Modified application`, `Applied changes`. GitHub masks digit
runs in the log, so a masked id still matches on every unmasked character.

**A GREEN DEPLOY IS NOT A RUNTIME CONFIRMATION, AND THE TWO MUST BE REPORTED
AS TWO THINGS.** Everything above — the conclusion, the `DEPLOY_ID` var, the
image diff, the timings — is **the deploy reporting on itself**: it says what
Wrangler was told to send and what Cloudflare said it applied. **Not one line
of it is the live Worker answering a question.** That second claim needs
`/api/site/build-health` (the sha AND the cold-start image, from any signed-in
account) or `/api/site/runtime?slug=` (owner-scoped), and a session holding no
Supabase token has neither. **The unauthenticated discriminator does NOT close
the gap**: 401/401/401/404 is identical before and after any deploy, so it
proves the Worker is up and routing and is silent on which code answers —
which is exactly why it is safe to read and worthless as a version check.
**Say "deployed, not runtime-confirmed" rather than letting a green run stand
in for a reading nobody took**; *a claim that launders itself through a
neighbour* is this file's own recorded failure, and a deploy conclusion sitting
next to an unread runtime is the shape it takes here.

**ONE SERVED FILE IS A FREE WORKER-SIDE CHECK — WHEN `public/` CHANGED.** A
deploy that uploads an asset makes it fetchable with no token, byte-comparable
to the merged tree, and a **cheap discriminator** is an identifier the change
introduces (0 occurrences before, N after). When `public/` did not change,
Wrangler answers `No updated asset files to upload` and **there is no
served-file check at all** — say so rather than glossing it. (Met on deploy
2140.)

**AND `DEPLOY_ID` MOVES ON A MERGE THAT CHANGES NO WORKER CODE AT ALL** —
settled by reading deploy 2140's log rather than reasoned about, because the
answer decides whether `expect_deploy` can be filled in before a harness runs.
It is `${{ github.sha }}`, a VAR, so a changed value is a configuration change
and Wrangler uploads a new version whatever the code did: 2140 merged only
`.github/workflows/**`, `scripts/`, `test/` and two documents, and the log
answers **`Uploaded isibi-app`, `Deployed isibi-app triggers`, a fresh
`Current Version ID`** — beside `No updated asset files to upload` and
`no changes isibi-app-sitebuildcontainer`, which are the OTHER two halves
holding still. **The three move independently and a deploy names each one
separately**: the assets, the container app, and the Worker version. Reading
one as the others is how a harness gets pointed at the wrong build.
**AND THIS IS STILL WRANGLER REPORTING ON ITSELF** — the live Worker's own sha
needs `/api/site/build-health` and a Supabase token, so the honest label on a
value derived this way is *deployed, not runtime-confirmed*, and the thing that
confirms it is the next authenticated read.

**THE SERVED-FILE CHECK, DONE PROPERLY** (driven end to end on deploy 2139;
`docs/deploy-record.md`): take the BEFORE reading before the deploy lands —
after it, "0 occurrences" and "never looked" are the same absence — and
byte-compare the served file with `git show <merged>:public/<file>` rather
than grepping, since a count is satisfied by a partial upload and an identical
sha is not. **The two runtime readers are two different gates**:
`/api/site/build-health` asks `authUser` alone, so any signed-in account reads
the Worker's sha and a cold start's image; `/api/site/runtime?slug=` also asks
that the caller owns the site, and answers anyone else the 404 a missing site
gets. A session with no Supabase token reads neither, and the unauthenticated
gates answer 401 / 401 / 401 / 404 (`build-health`, `runtime`, `job-probe`, a
route that does not exist) before and after every deploy, so they prove the
Worker is up and nothing about which code answers.

Secrets live in GitHub Actions and upload to the Worker each deploy. **An
optional secret must carry a `|| fallback`; a required one must not** — listing
a name with no value fails the WHOLE deploy (three merges shipped nothing that
way). **Reading `deploy.yml` tells you the DEFAULT, not the deployment**: a
workflow's `|| 'off'` is what the Worker runs only while nobody has ever set
that secret, and `GET /api/site/runtime?slug=` is the one thing that can say
which is live.

---

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

## Instruments and the edit canary, in brief

The free instruments, what a paid harness refuses, and the canary's modes are
in `docs/instruments.md`; each test's plan and evidence is in the checklist.

- **Free instruments**: the stored `design` and `bands` steps (`agentMs`,
  `waveMs`, a time per agent or piece; `bands:<reason>` names the wall that
  stopped a split); `genMs` on the collector's `resume:finish` step;
  `GET /api/site/runtime?slug=` (the owner's site only: `async`, `runner`, the
  switches, the deploy sha — booleans and the sha, never a value);
  `GET /api/site/build-health` (any signed-in account: the Worker's `DEPLOY_ID`
  and the image a cold start gets); `GET /api/fal-balance` (the owner: a
  precondition, not a gate — an empty fal balance publishes placeholders and
  still charges).
- **A paid harness refuses to spend against the wrong build**, before the
  browser, the balance or the first post: `expect_deploy` matches by prefix,
  floored at 7 characters on both sides; `expect_image` matches whole;
  cannot-tell is a refusal; the two readers must agree; queued work (`async`)
  is required unconditionally.
- **The edit canary** (`edit-canary.yml`, `scripts/edit-canary.mjs`) takes a
  site, a control site, an instruction and the two expectations, and uploads
  its evidence as an artifact: every page and component body, a per-route
  inventory, the raw pages, the description stored in the site's settings,
  then the request, the routing answer, the stored reply, the customer's
  screen and the comparison. The free half runs on every press and reads the
  balance. The paid half runs only with spend `yes` and an instruction — there
  is no default ask (run 14 spent on a substituted one). It routes with the
  site's real page list, watches the job with the browser's own poll reader (a
  stored reply whatever its status; a timeout is "outcome unknown"), composes
  the screen with the browser's own composer (`editBrowserReply`, `actions`
  included), and compares only at the job's own published version
  (`afterReadVerdict`: VERIFIED, or UNVERIFIED with a named reason — an
  unverified comparison passes nothing).
- **Its modes**, each a form box, and a named mode never spends: `read_job` (a
  job's row, its ledger rows and trace candidates; exits above the preflight);
  `restore_version` (lists the site's versions, refuses one not listed or not
  restorable, posts the app's own restore, waits for `x-site-version`, then
  reads — pointed at the live version it is a free, no-post reading of the
  deploy, the restore target and the before-state); `ui_scenario` (the real app
  in a real Chromium, signed in with the canary's own session, one tab, a
  positive wall per scenario and per message, a budget checked before each Send
  that caps no single request; scenarios `4a-part-b`, `4b-d1-price`,
  `4b-d1-restore`, `4b-rules-close`, `5-page-remove`); `rules_allow` (the rules
  test's approvals).
- **Presses are the owner's.** A session's dispatch answers **403** (it lacks
  `actions: write`) even for a free read, so do not retry it: hand over the
  exact values and **name each box by its description**, because the form shows
  descriptions, not input names (run 29's values landed in the wrong boxes). A
  mode that exists only on the branch needs a branch dispatch, which runs the
  branch's script against main's Worker — what the preflight checks.
- **Money is read off the ledger and the job row** (`credit_events`, which
  names each reserve `<job>#<n>` and each refund by the bare job id, and
  `edit_jobs.billing`), never inferred from a net movement: run 14's 77 → 75
  was a routing call of 2 beside an edit charged 2 and refunded 2, which
  neither guess had named.

## Editing a site — the ladder

**Read `docs/architecture.md` first** — the owner's own drawing: one BUILD step
makes the site, then EDIT / ADDON / DELETE act on it and each publishes back
through the one spine. **The site is the centre, not the paths.**

The router picks a layer; each falls through to the one above it when it cannot
express the change — **but only where that climb is CLASSIFIED as one the rung
above can do** (`builder/edit-failure.mjs`, 2026-09-23). Everything else — a
thing that is not there, an ask nobody could place, a failure of ours — is
said, at no cost for the edit. Cheapest first:

| Layer | What it changes | Cost |
|---|---|---|
| `text` | words in the page source | 1 |
| `data` | rows, and a list's ORDER | ~0.3 of model use; **charged 1** (run 42) |
| `rules` | schema features enforced in Postgres or read from `_meta` | ~0.3 of model use; **charged 1** (run 44) |
| `look` | the EDIT PATH — 21 lanes (see below) | 1 |
| `picture` | swap or reframe a photograph (matched on its alt text) | ~0.3 |
| `logo` | the header logo or tab icon — stored as that mark's `image` form | 0 |
| `nav` | menu, header button, footer contact/social/legal, in-body links | ~0.3 |
| `page` | one page's layout, via `tweak` (minimal patch) | ~1–3 **+ routing**; **20 measured once** when the tweak fell through to the rung's own full rewrite (run 11) |
| `addon` | a real page rewrite | ~25 |

**`sameProse` is the guarantee the page layer cannot make**: a tweak that moved
the words is thrown away. Measured 0 false alarms over 1,640 real tweaks.

**A publish that translates something new is charged for the translation on top
of the rung's own price** — one call per extra language, on the picked model,
reserved by the spine before its compile and floored at 1. A monolingual site
and a cached bilingual one pay nothing more; the platform rebuild never pays.

**The 21 lanes, what the page rung preserves, adding versus editing, and
renaming are in `docs/edit-path.md`**; every round since 2026-09-21 is in
`docs/history/`. Everything below was built and tested with supplied model
answers unless a run is named.

### What the edit path does now

- **The router** (`builder/site-ask.mjs`) answers one layer, or `addon`,
  `build`, `ask` or `clarify`. **Display against enforcement decides `page`
  against `rules`**, never the words (`bookings`, `places` and `limit` occur on
  both sides). A page it names is kept on `page` and on `look` (`readEdit`); a
  named page the site does not have is refused on `look` before anything runs
  (`page/no-page`); an unnamed `look` change on a multi-page site goes to the
  home page. The browser routes with the site's real page list and waits for it
  on an existing site (`siteRoutesRead`, `SITE_ROUTES_WAIT_MS` 15,000), so an
  existing site never becomes a first build.
- **Every way the edit route declines is classified**: `builder/edit-failure.mjs`
  `EDIT_FAILURES`, **40 entries** keyed `<rung>/<name>`, in four classes that
  are what the browser does — `up` **7** (the full rewrite), `addon` **5**,
  `hop` **4** (one paid hop sideways), `explain` **24** (a sentence at no edit
  cost, **11** of them ours). A census holds the route to the table both ways,
  so a new `escalate(` with no entry fails by existing. **The browser starts the
  rewrite only from an escalate** — never from a refusal, an unreadable body or
  a dropped connection (`unreadEditMsg`: *"…Asking for it again could make the
  change twice."*). An ownership-gate refusal is re-shaped into a sentence
  (`editGateRefusal`).
- **Replies are checked before they are trusted**:
  `readRouteReply(httpOk, reply, hops)` answers `hop`, `climb`, `receipt`,
  `success`, `refusal` or `unknown` from real booleans, a 2xx status and the
  fields each action needs; `readAddonReply` and `readEditReply` are one line
  over it, and only the edit's list may hop to `addon`. A 401 asks for sign-in.
  A routing answer is checked the same way (`routeActionable`, `routeQuestion`);
  an unusable one stops a live site with a sentence and holds the words and
  files on their own site (`lost()` → `siteHoldUnsent`). An add-on that fails
  never buys the rewrite (`addonOutcomeMsg`); only a well-formed escalate naming
  no layer still climbs, and classifying those is the separate server-side step.
- **One ask, one latch, one ending**: `editAsk`/`editAskDone` hold a site for
  exactly one ask, queued jobs and hand-offs included, and an old completion
  cannot release a newer ask; each POST ends once (`finishOnce`); a success
  this page fails to show stays a success (`applyEditResult`, `editShownMsg`);
  the one-hop bound rides on the job record (`handedOff`). Drafts (a site's
  typed words and attached files) belong to that site's composer and survive
  redraws and navigation within the session, **not a browser refresh**.
- **Steps**: neighbouring page lanes on one page are one page operation
  (`mergePageSteps`); across another rung, the later page step runs only if the
  earlier did not succeed (`pageStepDone`, `samePageOperation`), and a refusal
  that a later success supersedes is not reported. A remove or move verb rides
  on its own step (`runLayer(…, eRemove, eRename)`), never message-wide.
- **The removal door** (a `nav` or `picture` removal the router opened): the
  picker is told the routed change in the router's own words (`layerLine`) and
  answers two lists (`doorPickTool`) — `additional`, the only list that makes
  steps, and `routed`, recorded and never run — and the router's own step runs
  exactly once (`doorDispatch`). Nothing is read from how many lanes came back.
  A home page's menu keeps a link to itself that it already had. A page another
  page's source links to cannot be removed; a QR code pointing at it is not
  seen by that rule (backlog).
- **What an edit preserves**: the quick writer (`runTweak`) is thrown away if it
  moves the words (`sameProse`) or, on a page rendering the site's own
  components, changes what the page computes (`partEligible`, over a real
  TypeScript syntax tree; cannot-tell refuses). Photographs are put back or the
  rung is refused, on both writers (`keepPhotos`; 409 `withheld`,
  `photosBlocked`). Links and the site's own components are checked by
  `builder/page-keep.mjs`: links paired by identity and never counted; a judge
  (`keep_check`) called only on a loss, whose quote must occur in the message
  and name its item, or declare a group of a kind that can hold it — **neither
  proves authorisation; that stays the model's judgement**. Parsed literal JSX
  prose is checked on the full writer by `builder/page-prose.mjs` against a
  supported grammar: an explicit operation on an exact unique heading or
  section id, or quoted exact text; page qualifiers confirmed against the
  edited page and the site's own page names (`sitePageNames`,
  `pageQualifiers`); kit headings read from `builder/kit-headings.mjs` (20
  components, `<h1>`/`<h2>` only, the heading must render). Plain-text and
  kit-only loss outside that grammar stays open.
- **The stylesheet check judges only the rules a request wrote**
  (`changedSelectors` → `verifyCss` → `cssVerify` → `selectorsToJudge`), keyed
  by a reader that keeps strings, escapes and meaningful whitespace
  (`cssPieces`) and treats a comment as a token boundary (`spell`,
  `keepsBoundary`, `judgedSelectors`).
- **Money is stated from the ledger**: the edit's cost and the routing call's
  are two amounts (`wholeRequestNote`); a finished job's cost is read off its
  own row (`ledgerEditCost`, `servedEditReply`); a refused step's charge rides
  on its `partial[]` entry; no failure sentence claims money. The routing call
  is never refunded, and the two money paths still differ on a failed publish
  (the synchronous path keeps its collects; the job refunds everything).
- **What landed before a failed publish is named** (`landedNote`, only on a
  strict `landed === true`); a stopped edit's unpublished design is put back
  (`restoreEditConfig`), and a restore that fails is always said
  (`KEPT_CHANGE_NOTE`). A full revise resolves an `incomplete` site's database
  read-only for its writer (`revConn`, `withStoredSpec`) and never heals it.
- **The reply names what shipped**: `pageOps` (`{page, removed, renamedTo}`,
  from successful steps only) through `pageOpsSaid`; a look that changed nothing
  beside an operation that shipped says *"The requested styling was already in
  place."* A multi-step look reply still names only the look (review #9).
- **A publish carries the site's stored redirects** (`composePublish` reads the
  sidecar through `manifestFromCsv`, deploy 2165): a removed page 301s home and
  a moved one to its new address.

### Containers and jobs, in brief

The full law is `docs/containers-and-jobs.md`. **Every rung runs in the site's
own container, and the container has no clock**: `CONTAINER_*_BUDGET_MS` is
`Infinity`; the lease (`LEASE_TTL_S` 90, `HEARTBEAT_S` 30) is a liveness check
and never a cap. **One setting, `builder/job-duration.mjs`**: a job's deadline
is **50 minutes** (`JOB_MAX_MS`), and the SIGTERM, the SIGKILL and the busy
hold (**52.5 minutes**, `MAX_BUSY_HOLD_MS`) are derived from it under
`edit_handoff`'s 3,600-second limit; `JOB_MAX_MINUTES` may only shorten it. The
per-call ceilings stay: `STEP_TIMEOUT` 30 minutes, `CONTAINER_CALL_MS` and
`BUILDER_CALL_MS` 600 s, `QUICK_STREAM_MS` 480 s, `QUICK_CALL_MS` 240 s. A
job's model calls take the container's own `node:https` transport and stream
(`builder/long-post.mjs`, never imported by `worker.js`), and `callFailure`
names a failure (`headersMs`, `chars`). A fire answers `fired` (409 included),
`inline`, `retry` (3 tries, 2 s apart) or `stop` (503 `no-container`, nothing
spent). `JOB_RUNNER_EVERYONE` is on. The hold probe proved a 20-minute job
child in the container (1,200,182 ms, 20 of 20 pulses); the transport probe's
reading is still to take.

### The add-on path, in brief

The full law is `docs/addon-path.md`. **"Add" always goes to the add-on step;
an edit changes what already exists.** `builder/site-add.mjs` runs `pick_adds`,
then one call per kind in run order — `table · function · api · job · page ·
component · qr · three · photo` (`MAX_ADDS` 9) — then one publish; the first
backend kind on a site with none makes its database (`ensureSiteBackend`). An
addition is always a new thing: every page it changed must still say every word
it said (`keptProse`, else 422 `rewrote` at no cost), and a second one copies
the first's design. The designer's raw reply is kept at
`source/<slug>/addon-answer.json`. A job or an internal function alone changes
no page (`pageless`, 2 credits measured). Requirements ride beside the design
(`builder/site-requirements.mjs`, seven states from `delivered` to `failed`);
nothing exercises a behaviour, so `configured` is as far as a claim can get,
and nothing is called missing unless every reader that could speak has spoken.
The render check will not fake an outside dependency (`apiAnswer`: 424 `unmet`,
not serious). A photograph placed in the same request is bought after the merge
and billed on what was made (~18.75 credits each); a `src` the site does not
own never ships; a QR code pointing at a page that did not survive is withheld
together with everything that renders it. Outside connections carry `returns`,
typed `params` and `credential` (`site-api-shape.mjs`), none of them in the
cache key. Which kinds have been proven live is the table under *What is proven
live*, below.

### The site database, in brief

The full law is `docs/site-database.md`.

- **"No database" is four states** (`site-backend-state.mjs`): `ready`, `none`
  (the only state in which "no tables" is true), `incomplete` (the database is
  real and `site_backends.neon_db` is blank) and `unreadable` (asked first).
  `siteBackendDetail` resolves and proves; the container has no `SITE_ROUTES`
  cache, which is why an `incomplete` site looked fine in the Worker and broke
  in a job. **Four sites are still `incomplete`**: `ashgrove-1`, `fretwork-1`,
  `northgroup-5`, `washhouse-1`.
- **The catalog is asked first** (`readSchemaState`, `specForAddon`): a missing
  `_meta` row is not an empty database; recovery (`site-schema-recover.mjs`) is
  read-only, derives access from the live policies and grants, and refuses
  rather than guesses.
- **Every function the engine creates pins `search_path` to `public, pg_temp`**
  (`FN_SEARCH_PATH`; naming `pg_temp` is the fix, because `TEMP` is granted to
  PUBLIC by default). Model-written functions on sites built before the pin are
  never re-pinned (backlog).
- **Write grants are column-scoped** (`GRANT INSERT ("a", "b")`); a site keeps
  its old table-wide grants until its next schema change. Applying grants
  through `grants preview` is maintenance and never goes through the rules rung.
- **The owner rows route takes a conditional write**: `{"$set": {…}, "$if":
  {…}}` is one `UPDATE … WHERE` statement, 409 `conflict` when the row no
  longer matches; no column can begin with `$`, so an older Worker refuses the
  form rather than doing it unconditionally. **A data edit publishes no
  version**, and the Data panel's Save is not an exact recovery (it sends every
  field as text, so a NULL comes back as `''`).
- **The rules rung closes a table by marking it `retired`**: no row policy,
  every visitor privilege revoked, no public view. A closed table stays in the
  owner's listing with its label unchanged, so the refusal a visitor meets is
  the proof, not the listing.

---

## The builder app and the agent builder, in brief

The full rules are `docs/app-rules.md`, with the model table (each model's
context window, output limit and price); `agent-builder/CLAUDE.md` is the agent
product's own record.

- **The agent builder is a third view (`agents`) in this app.** Its tenant is
  `authUser(request).id` and nothing else; row-level security is the belt and
  the URL's `tenant_id` filter is the wall (`service_role` bypasses RLS); a
  forged agent reply is a row the database refuses (`role = 'user'`); the import
  is one transaction keyed by the browser's own record id; old browser records
  are claimed or sealed by one marker (`zephyr_owner_v1`), never shown to
  another account.
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

**A FOUNDER IS NEVER CREDITED BACK.** `use_credits`, `use_credits_for` and
`get_credits` answer the founder sentinel (1000000) before any debit, and until
2026-09-05 `credit_back` and `refund_charge` credited a founder like anyone else
— a build refund after a failure would have paid back money never taken.
Unreachable only while the one founder had no `credits` row; a purchase or a
grant would have armed it. Both are decided by `private.founders` — the mirror
of the check `use_credits` makes, **NEVER a balance threshold** — and answer
without writing: `credit_back`'s one UPDATE is gated in its WHERE,
`refund_charge` refuses before the row lock. **Driven on the live database and
rolled back** (`scripts/edit-rpc-check.sql`), **run RED against the old bodies
first** (`credit_back` paid a founder, 494 → 496) and green after.

**EXEMPTION AND DEBIT ARE EXPLICIT RESULTS ON THE BUILD PATH.** `use_credits`'s
answer is a balance or -1: a founder's call answered the sentinel and the route
read it as a debit; a short balance answered -1 and took what it could; and
every refund was a NUMBER the route remembered, handed to `credit_back`, which
credited it **whether or not it had ever been taken**. Two RPCs now say what
they did:

- **`credit_debit(amount, ref, reason, partial)`** — caller-scoped, answers
  `{ok, exempt, taken, repeat, prior, balance, short}`. A founder answers
  `exempt` with NO row; **the account row is locked BEFORE the repeat check**,
  so a duplicate delivery waits and then meets the first one's row; a bill above
  the balance is refused whole unless `partial`.
- **`credit_reverse(target, ref, reason, amount)`** — service-role only; finds
  the debit row **by ref AND account** (one account's ref can never be reversed
  onto another), refunds `least(amount, debited − already)`, and **reads the row
  and never the founders table**: a founder at debit time wrote no row and gets
  0; a customer who became a founder after a real debit still has the row and is
  paid back — the case the founder guard could not cover.

**The route is a ledger of refs.** `billRef = "build:" + (jobId || randomUUID())`
— the JOB'S id under the queue, so a duplicate delivery meets its own rows — and
`debitRef(step)` names each debit (`:deposit`, `:settle`, `:pages`).
`refundFields()` carries **NO amount**: it reverses every ref for what stays and
recomputes `refundShort` from `owed()`. **`billRef` is in `buildArgs`** so a
resume debits under the SAME ref.

**A SWEEP SURVIVOR FOUND THE RUNNER'S OWN BUG**: `String.prototype.replace` reads
the `$'` at the end of a mutant's regex literal as "the text after the match", so
the file changed, the checksum said applied, and **the mutant that landed was not
the one written**. The runner replaces through a function now and verifies the
landed text IS the written text.

---

## Live state

**Read the ledger; do not trust a number here.** A stale balance makes
`buildFloor` refuse before spending, and the refusal reads as a broken build.
Every earlier reading — the balance since run 9, the suite and site-build
stamps, how each was taken — is in `docs/history/2026-09-28-live-state.md`.

- **Balance 45** on the building account at run 50's end (2026-09-28 18:41
  UTC): run 49 took it 50 → 45 (routing 2 + 1 and the menu edit's reserve of 2,
  ledger row 333; the page removal `exempt`). `GET /api/fal-balance` answers
  fal's balance separately.
- **The building account is `aniascristian@gmail.com`**, not the session's own
  address. It owns every live site and holds that balance; look at the wrong
  row and the balance reads zero.
- **Live sites**: `northgroup-5`, `-9` … `-17`, `markbook-1`, `shoeroom-1`,
  `repairbench-1`, `fretwork-1`, `ashgrove-1`, `washhouse-1`,
  `ben-crowe-guitar`, and the older `fold-lane-bakery`, `harbourside-roast`,
  `the-lido-cafe`, `oak-and-ash`, `forno-and-co`. **Reusing one of those slugs
  revises that site.** The test fixtures now: `fold-lane-bakery` live at
  `01790468089054-8btpep` (restored by run 50), `fretwork-1` at
  `01790404806543-kk6qsh` (Test 3's removal kept), and `lido-axes-b` with its
  bookings closed (run 44, kept).
- **What things cost, measured** — routing 1–2 per message (it moves with the
  prompt cache); the page rung 6–22 (runs 21–37); a data or rules edit 1; a
  reframe 1; the logo rung, a page move and a page removal 0 (`exempt`); a
  first build 11–45; a revise of the same site 17; an add-on 2–13 (runs
  47–52). **Quote a range or measure the run.** Nothing enforces a per-request
  cap (`edit_reserve` raises only above 100,000), so the balance is the only
  bound. The default builder model is grok (`DEFAULT_PICKER`), and a cold new
  account is one credit short of building (`buildFloor` 20 against a grant of
  20, the routing call spending 1 first).
- **The unit suite is 8,207** (`f08c3ba1`): `8207 / 8205 / 0 / 2` locally,
  `8207 / 8203 / 0 / 4` on CI — **compare the totals, never `pass`**; CI skips
  four where a local run skips two. **`site build`** reads twelve counts green:
  TAP 397, kit-typecheck 4, site-build **404** (382 plus the browser control's
  22), contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47, and kit-render, kit-a11y, kit-effects and kit-paint `all
  passed` (census 7 + 4 + 1 = 12). Its two `##[error]` annotations
  (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) sit inside the case
  that compiles a broken page on purpose.
- **Running the suite here**: `node --test "test/*.test.mjs"` with the glob
  quoted; `playwright-core` at the root (`npm i --no-save`, the template's
  version); a worktree needs `node_modules` linked in; nothing of ours already
  running (`pgrep -af build-server.mjs`, then kill by PID); a shallow clone can
  fail `site-searchpath`'s ancestry case, so unshallow it. **Measure a baseline
  in a worktree; never subtract from a paragraph.** The stamp chain ends at the
  last commit that moved a test or product file.
- **Reading CI**: read a job's own top-level fields (`status`, `conclusion`),
  never a pattern over its JSON (every step carries the same keys); ask for runs
  by branch, never by `?head_sha=` (it answers 0 for shas that have runs); count
  distinct result numbers, not lines (a byte-order mark hides one); read counts
  from the per-step log files; the site-build job has twenty steps and the API
  answers 23.

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
- **A SUPPLIED ROUTER ANSWER MUST BE THE ONE THE ROUTER IS TOLD TO GIVE
  (2026-09-27, Test 5, cost a paid run).**
  - The free rehearsal posted "Take Gallery out of the menu." as
    `{layer: "nav"}`.
  - The router's own `remove` description sets the flag for `nav` with "take
    Pricing out of the menu" as its example, so the live answer carried
    `remove: true`.
  - That flag opens the part-picker door, a path the rehearsal never took, and
    run 47 failed on it.

  **Read the router tool's description for the exact wording before supplying
  its answer.** A rehearsal is only as good as its least-examined fixture.
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
  uses OVERLAY scrollbars (0px in precisely the case that moves);
  **⚠ "Chromium in this sandbox cannot reach a site host at all" WAS TRUE AND IS
  NOT (falsified 2026-09-21)** — a real Chromium opened
  `fold-lane-bakery.gofarther.app`, answered **NAV 200**, and read both
  photographs as loaded and visible with zero failed requests. It was recorded
  from a CSP render that read BROKEN both ways, and **a limitation nobody
  re-tested is a false negative about our own instruments**: it sat here long
  enough that a live-browser check went unattempted rather than unavailable.
  **⚠ AND IN THE 2026-09-25 CONTAINER IT WAS TRUE AGAIN, FOR A NAMED REASON**:
  `page.goto` answered `net::ERR_CERT_AUTHORITY_INVALID`. `/root/.pki/nssdb`
  held **0** certificates (its `nssPublic` table read empty), although the
  proxy README says the browser NSS store is set up. **Re-test per container;
  never carry the answer over.**
  - **The way through changes no trust setting**: fulfil every request from a
    Node fetch that verifies TLS against the session CA bundle
    (`context.route("**/*")` → `route.fulfill`, `NODE_USE_ENV_PROXY=1`).
    Chromium then runs the live bytes and scripts. Adding the CA to Chromium
    was refused by the permission system, and switching verification off is
    forbidden.
  - **Its limit**: Chromium's own network stack (cache, cookies, service
    workers) is not the one exercised.
  The CSP reading it came from is still the blind one;
  a fake `sqlQuery` injected where none is accepted answered **0 statements**,
  which reads exactly like "no constraint anywhere". **A `net::` error in a CSP
  failure list is the tell — a refusal is `blockedURI`, never a transport error.**
- **AN INSTRUMENT THAT REPORTS CORRECT CODE AS BROKEN.** A `fullPage: true`
  capture of a site using `animation-timeline: view()` shows every below-the-fold
  section BLANK. **When the instrument and the thing disagree, suspect the
  instrument first** — and screenshot each section scrolled INTO VIEW, asserting
  computed opacity.
- **A MISMATCH FROM A BROKEN READER READS LIKE A CHANGE (2026-09-27).**
  `curl … | tee >(wc -c) | sha256sum` hashed `lido-axes-b`'s stylesheet as
  `484438e4…` against a recorded `6f7ca4bc…`: the process substitution
  inherits `tee`'s stdout, so the byte count went into the pipe and the hash
  covered the file plus the count, and the count never printed. Downloaded to
  a file and read on its own, the sheet was the recorded bytes. **Read a
  reference value into a file first, then measure the file.**
- **A STATUS READ OFF `curl -D -` THROUGH THE PROXY IS THE PROXY'S
  (2026-09-27).** The first header block is the proxy's own `HTTP/1.1 200
  Connection established`, so a reader taking the first status line reported
  `/the-starter`'s 301 as a 200. Read the site's status with
  `-w '%{http_code}'`.
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
- **AND A GREP OVER A JOB'S JSON ANSWERS ABOUT ITS FIRST STEP (2026-09-24).** A
  job's `steps` carry the same `status`, `conclusion` and `completed_at` keys as
  the job itself. So `until … grep -q '"status": *"completed"'` exited on its
  first poll, because "Set up job" had already completed, and `grep -o …
  conclusion | head -1` then printed that step's `success` and its
  21:54:59Z — while the job's own field read `in_progress` with `npm test`
  still running. **A false all-clear in the shape of a real one**, caught only
  because the time was two minutes too early. Parse the JSON and read the
  TOP-LEVEL field (`j.status`, `j.conclusion`), never a pattern over the text.
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
  **⚠ AND THIS ENTRY WAS IN CONTEXT WHEN THE SAME WAITER WAS WRITTEN TWICE MORE
  (2026-09-20).** Both spun from before a compaction until `ps --forest` was
  asked — hours, silently, while their sweeps had long since finished and their
  tallies were read out of the log by hand. **The entry names the broken form
  first and the fix last, which is the wrong way round for a shape that reads as
  correct while you are typing it**: `while pgrep -f "<the command>"` is the
  obvious thing to write and the `bash -c … eval` wrapper makes it false at the
  moment of writing. It also cost a false alarm in the other direction — a
  routine `pgrep -f "node scripts/mutate.mjs"` inside a compound command
  answered **YES, a sweep is running** about its own shell, one step before a
  commit. **Ask `ps --forest` or `pgrep -af` and READ the lines**; a bare
  `pgrep -f` answering about a commit-blocking condition is answering about
  itself.
  **⚠ AND THE THIRD DOOR IS THE EXPENSIVE ONE: `pkill -f` KILLS THE SHELL THAT
  WOULD HAVE CLEANED UP (2026-09-20, and it left a mutant in the tree).**
  `pkill -f 'scratchpad/rc/p1b.mjs' ; git checkout -- <the swept file>` matched
  the compound command's OWN `/bin/bash -c` line, so the shell died AT the
  `pkill` and the restore on the same line never ran — the probe's mutation
  stayed in `builder/site-files.mjs` and `git status` reported it as ordinary
  work. **The two halves compound**: a killer that kills the restorer is
  silent, and what it leaves behind looks exactly like an edit somebody meant
  to make. Nothing announced it; one `grep -c` of the anchor did. **Put the
  restore in a SEPARATE call, before the kill** — or kill by PID, which has no
  pattern to match — and read the exit code: a compound command that dies at
  its own `pkill` exits non-zero and every later step in it is a step that did
  not happen.

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
- **`ts.SyntaxKind[n]` ANSWERS AN ALIAS FOR SOME KINDS (2026-09-26).** The
  parser adapter's `k()` is that reverse lookup, and a template literal reads
  back as `FirstTemplateToken`, so `k(e) === "NoSubstitutionTemplateLiteral"`
  can never match: a check that silently never fires. A positive control caught
  it before it shipped. Compare `k()` only against names measured to read back
  as themselves (`StringLiteral`, `JsxText`, `JsxExpression`, `JsxElement`,
  `JsxSelfClosingElement`, `JsxFragment`, `JsxAttribute`, `JsxSpreadAttribute`
  all do), or compare `n.kind` numerically.
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
- **A HARNESS THAT COUNTED REPLIES (run 47, 2026-09-27; owner: *"receiving two
  replies is not page-removal success"*).** Test 5's UI mode printed "UI MODE
  PASSED: 2 messages sent" and its job concluded `success` over two refusals
  (`look/no-change`, then `kept`), with the site byte for byte unchanged and
  the chain VERIFIED over zero publishes. Every check it made was true: each
  message got a reply and the composer came back. None of them asked whether
  the work happened. **A scenario passes on what its operations did, each read
  off its own record** (the stored reply, the publishes, the source, the
  address), and **a message that depends on an earlier one is not sent until
  that one stored its success**: sending it anyway costs a routing call to
  collect a refusal the harness then counts as a reply.
- **A RE-ANCHOR THAT FLIPS WHAT THE CUSTOMER GETS IS NOT A RE-ANCHOR
  (2026-09-28, the owner held a merge for it).** The first removal-door fix made
  `edit-page-verb`'s mixed case go red — a photo removal beside a layout change,
  where the layout had always shipped — and the case was rewritten to expect
  the layout REFUSED, with the loss written up as a "stated consequence". A
  re-anchor is legitimate when the spelling moved and the property held; when
  the expectation flips from *the requested work ships* to *it does not*, the
  guard was reporting a regression. **Ask what the customer now gets that they
  did not before; if the answer is less, it is not a re-anchor.**
- **HOW MANY ANSWERS CAME BACK IS NOT WHAT WAS ASKED (2026-09-28, the owner
  held the same merge a second time).** The removal door's second correction
  read the request from how many lanes the picker named: one meant the routed
  removal, two meant extra work. So a photo removal answered with `shape` alone
  lost its layout, and a two-lane misreading ran. **When one model's answer
  decides what work another step does, give that model the context and ask the
  question in the tool's own shape** — here, the change already routed, and a
  separate list for anything else — rather than inferring intent from the
  answer's size. The add-on reporting learned the same rule one layer over: *a
  count of a step's output is not an association with a requirement.*
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



---

## What is proven live, per addon kind

**IMPLEMENTED-BUT-UNVERIFIED IS NOT UNSUPPORTED, and the two are kept apart
because their next steps are different**: one is waiting on a press or a
credential and its next step is a MEASUREMENT; the other has no code behind it
and its next step is a CHANGE.

| kind | live proof | not established |
|---|---|---|
| `table` | runs 30–34, 46, 47 | a table with no writer is REPORTED, not refused |
| `function` | runs 30–34, 47, 49, 50, 52 (a stored internal one reused) | no live run has exercised a `plpgsql` body |
| `api` | **RUN 53 — a published page READ THE REAL SERVICE AND RENDERED ITS DATA**: `/rates` on `repairbench-1` serves `1.1644 / 1.3344 / Rates from 2026-09-18`, which is the keyless rates service's own answer (`{"base":"GBP","date":"2026-09-18","rates":{"EUR":1.1644,"USD":1.3344}}`), read at two depths, zero console errors | a page reading a **keyed** connection, and whether a wrong key surfaces usefully |
| `job` | 50 registered a recurring one and Run now answered `3`; 52 a one-time one | **automatic execution on a real tick**, and **any message actually delivered** |
| `page` | 47 `/status`, 48 `/booking-check`, 49 `/workshop-load`, 51 `/gallery` | — |
| `component` | runs 21–23, 35, 36, 37 | the ONE kind off `APPLIED_KINDS`, so absence is never reportable |
| `qr` | 51 published `qr-gallery.svg` and **the served file re-encodes to `/gallery`** | nothing has ever scanned one |
| `three` | **measured live today**: `fretwork-1` and `ashgrove-1` each serve a `@react-three/fiber` canvas | **which PATH made it** — `three` is a dispatched EDIT lane as well as an addon kind, so a probe of the document cannot say |
| `photo` | **NONE.** Run 51 reached the provider and was **refused** | **the whole kind**, parked on fal funding |

**Eight of nine have landed their own work on a real site. The ninth has not,
and its blocker is a balance rather than code.**

**AND THE BACKEND TIER HAS NO CORPUS, which bounds what can be claimed.** The
100-site corpus is **324 `.tsx` files with ZERO `useRows`, ZERO `useCreateRow`,
ZERO `useApi`, ZERO `useRpc` and ZERO `useUploadFile`** — it is a FRONTEND
corpus, because a first build is frontend-only by default. So the false-alarm
measurements this file leans on (the kit closure's 9–53 files, the 322-against-
222 lint reading, the 320 picture frames) are all statements about the frontend.

**WHAT ONLY WORKS IN COMBINATION**, each measured:

- **A VISITOR MAY SEND A PICTURE AND NOTHING ELSE; AN OWNER MAY SEND A
  DOCUMENT.** `handleVisitorUpload` takes PNG/JPEG/WebP/GIF by magic number,
  2 MB, throttled, SVG refused as stored XSS — while an OWNER's upload also
  takes **PDF and the zip family** (`sniffUpload`, `MAX_DOC_BYTES` 10 MB). So
  *"put our menu PDF up"* works and *"let customers attach a receipt PDF"* does
  not, and they are different questions about different routes.
- **⚠ "`uploadFile` IS IN ZERO PROMPTS" IS FALSIFIED.** That grep used the
  bare function name; **the kit exports TWO things and the prompts name the
  other** — `useUploadFile` occurs **6 times in `builder/page-gen.mjs`**, and
  the chain is whole at every hop: page rule 8 carries a worked example,
  `schemaDigest` states `FILE UPLOAD: YES/NO` per table and NAMES the column,
  the table tool tells the designer what to call it, and a lint refuses
  `useUploadFile` on a table that takes none. *A grep for the wrong identifier
  reads exactly like a missing wire* — and it was recorded as one for four days.
- **WHAT IS REALLY LEFT THERE IS ONE LINE AND IT IS OWNER-GATED.**
  `isImageColumn` answers NO to `attachment · file · upload · receipt ·
  document · screenshot · artwork`, so a designer that ignores the naming
  guidance produces a form with no attach control. **Widening the list widens an
  endpoint that is UNAUTHENTICATED by design**, which is the owner's call.
- **Video and audio EMBED; they do not HOST.** `video-embed`, `video-player`,
  `video-hero`, `audio-player` and `audio-recorder` are all in `COMPONENT_MENU`
  and all make **zero network calls**, so a `component` ask places one around a
  URL the owner supplies. **Neither sniffer admits a video or audio container**,
  so a media file has no home here — which also means a `/u/` media url can only
  be one a model invented, and the stray wall empties it correctly. **The
  reachable half of that wall is the PDF**, which really can be uploaded.
- **`pageless` is job + INTERNAL function only** — driven.
- **CREDENTIAL-SOURCE GUIDANCE EXISTS, CONDITIONAL ON THE METADATA BEING
  SUPPLIED** (moved here 2026-09-20; it had been filed as *"names no sign-up
  page"*). `cleanCredential` (`site-api-shape.mjs`) stores
  **`{service, url|signup, note}`** — WHICH service, its SIGN-UP PAGE, and a
  free-text note, which is where *"the free tier is enough"* belongs. The url
  is **https-validated** and refused as `credential-url` otherwise
  (*"The sign-up page for that service has to be an https address"*), and an
  unreadable object is `credential-shape`, whose sentence asks the customer to
  NAME THE SERVICE. `credentialNote` reads it **PER CONNECTION**, so a mixed
  request cannot tell the owner to sign up for a key nothing will use.
  **THE CONDITION IS THE WHOLE OF IT, AND IT IS A REAL LIMIT**: every part is
  optional, `cleanCredential` answers `null` when all three are absent, and
  **nothing compels the designer to fill them** — so the guidance is present
  when the declaration carries it and silent when it does not. That is
  different from *"no sign-up page exists"*, which is what the old entry said.
  What stays true: **misleading metadata on a KEYLESS connection is ignored
  rather than believed**, and the note never claims a service *"is answering
  already"* — this platform has not called it and has no business saying so.
- **A FUNCTION CHOOSES ITS OWN `language`, AND THIS SAT IN THE UNSUPPORTED LIST
  FOR A DAY AFTER IT SHIPPED** (closed 2026-09-19, moved here 2026-09-20).
  `FN_LANGUAGES` is `["sql", "plpgsql"]` beside the emitter, `fnLanguage` is the
  ONE reader (`site-rls.mjs:932`, emitted at `site-schema.mjs:742`), the tool's
  enum is DERIVED from it, `cleanAdd` refuses `bad-language`
  (`site-add.mjs:2491`), and the **fold** — a third hop nothing had found,
  because `foldAdds` REBUILDS the item too — is SUBTRACTIVE. Proven on a real
  PostgreSQL 16: the same body declared `sql` is REFUSED, created as plpgsql it
  ANSWERS, `pg_proc` agrees, and **SECURITY DEFINER and `search_path = public,
  pg_temp` both survive**. **`job` is still additive and is NAMED in the code as
  the remaining instance of that class.**
  **THE SHAPE OF THE MISTAKE IS THE POINT**: the entry carried its own
  `CLOSED 2026-09-19` in the body while its HEADING still read *"cannot choose
  its language"*, and a heading is what anybody skimming a capability list
  reads. **An entry that closes must MOVE, not gain a sentence** — a closed
  limitation left in a limitations list is a false negative about our own
  product, and it survived a session that quoted the list back out loud.

**UNSUPPORTED, and the honest reason for each:**

- **Nothing deletes a table, a saved function, a connection or a scheduled job**
  — `NOT_REMOVABLE` is `backend · lang · slug · kind · purpose`. **SIXTEEN**
  lanes ARE removable (`components` and `tsx` among them) and `PAGE_VERBS` is
  `add · remove · move`, so "nothing deletes" is only true of the backend.
*(The api tier's `credential` used to sit here as "names no sign-up page". It
does name one — moved up to the supported list on 2026-09-20.)*

---

## Backlog

The open items in full are `docs/backlog.md`. **Add a new one there and a line
here; take a closed one out of both.**

- The header's button carries no `data-slot="button"`, so a rule against the
  kit's button hook misses it.
- The render check judges each selector of a list on its own, so a common
  heading rule can force a correction round.
- Redirects dropped between 2026-08-17 and deploy 2165 are not rebuilt.
- A page removal does not see a QR code that points at the page.
- The branded not-found page is thrown away on every Start site.
- The rules reply shows literal asterisks around the table name.
- Closing a table leaves the site inviting it, and the refusal is generic
  (`lido-axes-b`; a separate UX gap).
- The logo reply says "on every page".
- The thread's message bubble does not show an attached picture.
- The canary's job reader says `exempt` means a founder account.
- A literal heading names its section whether or not it renders, and names its
  whole section wherever it stands.
- `fretwork-1`'s stored language is Welsh over English copy (parked with
  translation).
- `updated_at` is never bumped; the `sync` flag has no reader.
- Four sites are still `incomplete` (repair: `backend repair` with
  `--apply-reference`, then `--verify`).
- The translator can read page code as text and write its answer back into the
  code (parked).
- A job cannot heal a blank backend reference (its gateway admits no PATCH) —
  read, not driven.
- The band and component prompts choose their digest with `siteHasTables`
  (latent).
- An add-on can design a table nothing can ever fill (reported, not refused).
- A working `video-embed` is invisible to the `data-slot` census.
- Model-written functions on older sites are never re-pinned.
- A refused photograph cannot name itself to anybody who can act on it.
- Salvage cannot fire on a new build; the QR rule is stricter than the rest of
  the design step (both the owner's call).
- The availability calendar's legend (`fretwork-1`) and the price-unit mismatch
  (`ashgrove-1`), both live.
- Raw hex colours are reported on every build and never enforced; in-page links
  that go nowhere.
- Two client POSTs go to routes the Worker does not have (`/api/site/scan`,
  `/api/site/preview`).
- 3D scenes ignore the theme colours; strings outside the page source are never
  translated.
- `env.EMAIL`'s 200-a-day quota is shared by login codes and every site's
  notifications.
- Static voice previews; real background removal (blocked on a fal top-up); the
  app's mobile layout (deliberately not being done).

## Releasing

### The rollback, and what a release verdict may claim

**A FAST-FORWARD HAS NO MERGE COMMIT, SO THERE IS NOTHING TO REVERT.** `git
revert <tip>` undoes the LAST COMMIT of the branch, which is usually two
documents. **The rollback is the RANGE**:

```
git revert --no-commit <base>..<candidate>   # the complete introduced change
git commit                                    # one reviewed commit
```

- **WHEN THERE IS A MERGE COMMIT, `git revert -m 1 <merge>` IS THE WHOLE
  ROLLBACK** — and main only gets one when the branch is genuinely behind, which
  it will be whenever main moved during the work. **Deploy 2139's merge
  (`28e46e91`) was not a fast-forward**: main had five commits the branch lacked,
  so the range form and the `-m 1` form are both available and the second is one
  reviewed commit instead of fifteen reverts.
- **PREPARE AND VERIFY IT RATHER THAN DESCRIBING IT**: apply it in a throwaway
  worktree and check the resulting tree is byte-identical to the base (same tree
  object). Then the image step says `reused` because the inputs really are the
  base's, not because anybody predicted it. **DONE FOR `28e46e91`**:
  `git revert -m 1` in a detached worktree answered tree
  `2e682b79b306eb20a14c339a192dd53ea683f885`, **equal to `8b760d6f`'s** — so the
  rollback is a tree the registry already holds. Verified BEFORE it was needed,
  which is the only time the verification is free.
- **IT PRESERVES LATER WORK**, which is why it is a revert and not a
  `reset --hard` + force push. **The cost is stated**: a later commit touching
  the same lines makes it conflict, and the resolution is a judgement about
  which to keep — so the revert is **reviewed**, never `-n | commit` blind, and
  the verification is re-run at rollback time.
- **THE PREREQUISITE IS FIRST**: disable or delete any one-time job created
  while the branch was live, BEFORE restoring the old scheduler. The reverted
  `dueJobs` cannot read `spec.on` and falls to `everyMinutes`, which on such a
  row is the forced monthly ceiling — so a job that should fire once **fires
  every 31 days, indefinitely**. Not a lost feature: a job doing something
  nobody asked for.

**AND NO EXECUTION EVIDENCE EXISTS FOR A CRON RUN.** `runScheduledSiteJobs`
writes `last_run` and `last_result` and nothing else a session can read — no
trace row, no job log — so a press and a tick leave the same two fields. **A
stamp that appears with no press recorded is CONSISTENT WITH scheduled execution
and is not proof of it**, and the one honest statement available is *this session
pressed nothing*, which is a fact about what was done rather than an inference
from the row. **One standard throughout**: applying the weaker reading to a
pre-check and the stronger one to the test is how a claim launders itself
through a neighbour. A panel shows ONE latest timestamp, which is a scalar: it
cannot show a HISTORY and it cannot identify what wrote it.
