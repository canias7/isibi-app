# Go Farther

> **Read `docs/owner-notes.md` at the start of every session** — the owner's
> running log and how they like things done. Keep it updated.
>
> **PRUNED 2026-09-20 (owner: "clean up claude md, it has 13,000 lines").** It
> was **15,657 lines / 1,044,962 bytes and is 3,721 / 252,392 — 11,936 lines
> deleted, 76.2%** — and this is the **fifth** prune: 3,786 → (2026-08-28) →
> 10,004 → (09-09) 3,808 → 7,883 → (09-11) 3,933 → 7,615 → (09-14) 3,157 →
> **15,657** → now. Each time the file grows back the same way: by accreting
> the STORY of every shipped change beside its law. **The totals are the file
> as it stands, measured after the assembly rather than estimated before it.**
>
> **What went this time, and the rule that decided it: a fact that is true
> today belongs here; a story about how it got true belongs in git.** The
> section "Editing a site — the ladder" was **10,326 lines — 66% of the whole
> file — across 74 dated milestone narratives**, every one of them the account
> of a change that has already shipped. It is a few hundred lines now, and
> **every rule and every measured number in it is carried across**; only the
> narrative is gone. `THE TRAPS`, `Working rules`, `Structure`, `How a site
> gets built` and `Data, auth, payments, mail` are kept **verbatim** — they
> were already law.
>
> **Checked before cutting, not assumed: NOTHING reads this file from disk.**
> Every `CLAUDE.md` hit in the tree is a comment referring to it. The control
> that proves that check is alive: `docs/owner-notes.md` **is** parsed, by
> `test/brand-rename.test.mjs` and `test/media-deleted.test.mjs`, for its
> "Names that must not be renamed" table — so that file cannot be pruned this
> way and this one can.
>
> **The full record is in git: `git show d304120e:CLAUDE.md`** — every entry,
> every sweep tally, every live-deploy record, 2026-09-14 to 2026-09-20.
> Earlier ones: `git show a4d0f5e5:CLAUDE.md`, `6393b134`, `7104c87b`,
> `5cfd4e58`.
>
> **Keep it this way.** Add an entry when a decision is made or a trap is
> found; when an entry becomes history rather than law, cut it.
>
> **AND WHEN AN ENTRY IS COMPRESSED RATHER THAN CUT, KEEP THE NUMBERS.** A
> measurement is the one part of a shipped entry that stays law: the timings,
> the arithmetic that closed, the bounds and the flag defaults are what the
> next decision is made from, and re-deriving one costs a paid build.

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
  the ledger), never from the request's wording.

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

**THE TIMING BAND, AND WHY NO INFERENCE FROM THE DIFF IS AVAILABLE.** Before
the skip: 14–15 minutes per deploy. After: a docs/test-only push is a
one-minute deploy that rolls nothing (**47 seconds** on deploy 2019, image step
1.4 s, both `reused`; **reproduced to the second on deploy 2140, 2026-09-21 —
46-second job, image step 1 s, Wrangler 16 s**, on a merge touching only
`.github/workflows/**`, `scripts/`, `test/` and the two documents, so the band
for this shape has two readings a month apart and is as tight as the rebuild
band below); a push that changes an image input is **~2m05s of image
and ~3m of deploy at best** (2044) and **~3m ordinarily** — **deploy 2138
(2026-09-20) sits exactly on that band: image step 2m06s, Wrangler 19s, whole
run 2m55s**, on a merge whose image inputs really moved, and **deploy 2139
(2026-09-21) reproduced it to the second: image step 2m07s, Wrangler 21s, whole
run 3m03s**, on a merge moving ~5,800 lines across 22 files. **Two merges a day
apart, both rebuilding, agreeing within a second on each of the three** — so
the band is tight for this shape and a reading outside it is worth asking about
rather than shrugging at. **Deploy 2143 (2026-09-22) is a third reading inside
it: image step 2m16s, Wrangler 20s, job 3m03s** — nine seconds slower on the
image step and identical on the whole job — on a fast-forward whose image inputs
really moved (3 of 184). Layer reuse depends
on the GitHub runner's LOCAL Docker cache, and a runner is ephemeral with no
registry cache import — so **a cold runner rebuilds everything whatever the diff
touched** (2053: 2m56s, every layer rebuilt, on 2044's exact shape; **2144
reproduced it to the second — 2m56s, 0 `CACHED` layers of 21, Wrangler 17s, job
3m43s**) and a FAST
step is no more evidence of a small diff than a slow one is of a large one
(2091: the template's `package.json` moved — as far above the worker tree as an
input gets — and it came in at 2m27s / 3m13s). Whether to import a registry
cache is open and unmeasured.

**THE IMAGE ID CAN BE COMPUTED BEFORE THE PUSH, AND IT IS WORTH MORE THAN
ANOTHER TIMING.** `containerInputs`/`imageId` are pure functions of the git
objects the Dockerfile COPYs, so running them over a ref answers what that
ref's image id WILL be — `git rev-parse <ref>:<path>` and `git show` are the
whole reader. **Cross-checked against reality TWENTY-THREE times, and the
thirteenth is the first CONFIRMED NEGATIVE** — every earlier one predicted a
MOVE and watched it happen, which cannot distinguish a working predictor from
one that simply agrees with whatever rebuilt. **Deploy 2140 (2026-09-21)
predicted the id would NOT move**: `origin/main` and the branch tip both
answered `82bccb3bee50e4fd` from 184 inputs, none of the merge's changed files
was in the input set, and the log answered **`IMAGE SiteBuildContainer: reused
isibi-app-sitebuildcontainer:82bccb3bee50e4fd (registry answered 200; ***84
inputs off ./Dockerfile)`** — the id, the word `reused`, and the input count on
its own channel. **A predictor that can only ever say "it moved" is half an
instrument**; this is the other half, and it is what licenses *"if the id does
not move, nothing an image is built from moved"* as a reading rather than a
hope. **`***` IS A MASKED RUN OF `1`s**, so `***84` is 184.
**The fourteenth — deploy 2143 (2026-09-22) — predicted BOTH ends before the
push and was confirmed on both channels.** `origin/main` answered
`6b14851c0cd0c1c1`, which is also what run 13 read LIVE off
`/api/site/build-health`, so the predictor agrees with the platform on the FROM
side as well; the fast-forward tip `a208a86a` answered `be869f142e052c8c`, both
from 184 inputs, three of the push's files among them. The log answered
`built isibi-app-sitebuildcontainer:be869f***42e052c8c (registry answered 404;
***84 inputs off ./Dockerfile)` and `- …:6b***485***c0cd0c***c***` →
`+ …:be869f***42e052c8c` under `SUCCESS Modified application`.
**The fifteenth — deploy 2144 (2026-09-22) — the same shape again**:
`origin/main` `be869f142e052c8c` (what runs 18–21 read LIVE) and the tip
`33126616` `962824ede93e7706`, both from 184 inputs, `builder/page-gen.mjs` and
`worker.js` the two of the push's 13 files among them; the log answered
`built …:962824ede93e7706 (registry answered 404; ***84 inputs …)` and
`- …:be869f***42e052c8c` → `+ …:962824ede93e7706` under `SUCCESS Modified
application`.
**The sixteenth — deploy 2145 (2026-09-23)**: `origin/main`
`962824ede93e7706` (what run 22 read LIVE) and the tip `0d5137f0`
`ce67f25d132667d0`, both from 184 inputs, `builder/page-gen.mjs` the one input
among the push's 11 files; the log answered `built …:ce67f25d***32667d0
(registry answered 404; ***84 inputs …)` and `- …:962824ede93e7706` →
`+ …:ce67f25d***32667d0` under `SUCCESS Modified application`. **0 `CACHED`
lines, every layer rebuilt, in 2m01s** — a cold build inside the warm band, so
a fast step is not evidence of a warm runner either.
**The seventeenth — deploy 2146 (2026-09-23)**: `origin/main`
`ce67f25d132667d0` (what run 25 read LIVE) and the tip `3c0a2533`
`fd3355f0b71af621`, **from 185 inputs where every earlier reading was 184** —
`builder/edit-failure.mjs` joined the Dockerfile's worker COPY line in that
push, so the input COUNT moved as well as the id, and both were predicted. The
log answered `built …:fd3355f0b7***af62*** (registry answered 404; ***85 inputs
…)` and `- …:ce67f25d***32667d0` → `+ …:fd3355f0b7***af62***` under `SUCCESS
Modified application`. **0 `CACHED` lines** again; image step 2m28s, Wrangler
19s, job 3m14s.
**The eighteenth — deploy 2147** — `fd3355f0b71af621` → `1aba925de4658f45`,
and **the nineteenth — deploy 2148 (2026-09-23)** — `1aba925de4658f45` →
`bb412dcada44c503`, both from 185 inputs, both ends predicted before each push
and confirmed on both channels (recorded with their merges, below). 2148 was
**0 `CACHED` lines** too: image step 2m08s, Wrangler 23s, job 2m59s.
**The twentieth — deploy 2149 (2026-09-23)** — `bb412dcada44c503` →
`d6d603e4a7921f14`, 185 inputs, `worker.js` the one input among the push's nine
files, both ends predicted and confirmed on both channels (recorded with its
merge, below); **0 `CACHED` lines** again, image step 2m14s, Wrangler 15s, job
2m54s.
**The twenty-first — deploy 2150 (2026-09-24)** — `d6d603e4a7921f14` →
`67a81b55332be3a9`, 185 inputs, `worker.js` the one input among the push's nine
files, both ends predicted and confirmed on both channels (recorded with its
merge, below); **0 `CACHED` lines** again, image step 2m03s, Wrangler 18s, job
2m53s.
**The twenty-second — deploy 2151 (2026-09-24)** — `67a81b55332be3a9` →
`56f7d5866240a1de`, and **the input COUNT moved 185 → 186** as predicted
(`builder/page-keep.mjs` joined the worker COPY line); image step 2m11s with
**0 `CACHED` lines**, Wrangler 19s, job 2m57s.
**The twenty-third — deploy 2152 (2026-09-24) — is the SECOND CONFIRMED
NEGATIVE**: both ends answered `56f7d5866240a1de` from 186 inputs, none of the
push's five files among them (`public/chat.js`, two tests, two documents), and
the log answered `reused … (registry answered 200; ***86 inputs …)` beside `no
changes isibi-app-sitebuildcontainer` — image step **1.1 s**, Wrangler ~16 s,
job **~42 s**: the no-roll band, with an asset upload (`+ /chat.js`) inside it.
The twelfth
added a SECOND CHANNEL — **deploy 2139 (2026-09-21) was predicted before the
push over the local merge commit `28e46e91` as `82bccb3bee50e4fd`, against
`origin/main`'s `c371e27cf3060255`, and the log confirmed BOTH**: `- …:c37***e27cf3060255`
→ `+ …:82bccb3bee50e4fd` under `SUCCESS Modified application`. **And the INPUT
COUNT matched too** — the predictor answered `inputs=184` and the image step
printed `***84 inputs off ./Dockerfile`, which is a different quantity from the
id and agrees independently, so a hash collision cannot be what is being
observed. **RE-RUN THE PREDICTOR OVER THE MERGE COMMIT ITSELF, never only over
the branch tip**: a merge's tree also carries whatever main added, and the
branch's id standing in for it is an assumption, not a reading. (Here they were
equal, because main's five commits touched one `docs/` file — which is the
POSITIVE form of the same rule: two docs-only commits on the branch, `f6b377de`
and `1bb178bc`, also left the id exactly where the code commit put it.)
The eleventh — **deploy 2138 (2026-09-20)** — is the same shape one channel
narrower: the id was computed over the local merge commit
(`28fd02a1`) as `c371e27cf3060255` while main still stood at `7ee5226b`, and
the deploy's own log then recorded `- …:94a380843efd95e1` → `+ …:c371e27cf3060255`
with `SUCCESS Modified application` under it. **BOTH ends of that diff were
computed in advance** — `94a380843efd95e1` is what the same reader answered for
`origin/main` — so the arithmetic predicted the roll rather than being
reconciled to it afterwards. (Deploy 2137 was the tenth: `origin/main` →
`3cfbfded71cf9607`, the id deploy 2136's log recorded rolling to.) **GitHub
masks digit runs, so match on the unmasked characters**: 2138's log prints
`c37***e27cf3060255` and `***84 inputs`, each `***` a run of `1`s.
Two things follow: **a rollback's speed
is PREDICTABLE** (a revert restores a tree the registry already holds, so the
step says `reused`), and **"is this commit an image input?" has an exact
answer** — if the id does not move, nothing an image is built from moved, which
is stronger than reading a `paths` list.

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
**DRIVEN END TO END ON DEPLOY 2139 (2026-09-21), and it is stronger than the
discriminator alone.** The before reading was taken 1m30s after the push and
3m before the deploy finished — served `/chat.js` **719,958 bytes, 0
occurrences of `wholeRequestNote`** — and the after reading is **732,238 bytes,
3 occurrences, and BYTE-IDENTICAL to `git show <merge>:public/chat.js`**
(sha256 prefix `903d9ff39b7d4b1d` on both sides). Wrangler's own log agrees
from the other end: `+ /chat.js`, one file, `85 already uploaded`. **Take the
BEFORE reading before the deploy lands** — after it, "0 occurrences" and "never
looked" are the same absence — and **byte-compare rather than grepping**, since
a count is satisfied by a partial upload and an identical sha is not. **And the Worker's
own deploy sha is not session-readable**, so the Worker half rests on
Wrangler's own report plus the gate discriminator (`/api/site/build-health`
**401**, `/api/site/runtime` **401**, `/api/site/job-probe` **401**,
`/api/nope-not-a-route` **404** — read live on 2026-09-20 and all four as
documented). **THE TWO GATES ARE NOT THE SAME GATE, and this file said they
were** (read out of the routes 2026-09-20, not assumed):
`/api/site/build-health` asks `authUser` ALONE, so **any signed-in account**
reads the sha and the cold-start image; `/api/site/runtime?slug=` asks
`authUser` **and** `siteOwnerBySlug(...) === tu.id`, answering the 404 a
missing site gets. The practical answer is unchanged — a session holding NO
Supabase token reads neither — but *"owner-gated"* was wrong about the first
and names the wrong person to go and ask.

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

## The instruments

Every one of these is free and reads off a stored row.

- **`design` step** — `waves`/`agents` (or `graph`), `agentMs` (every agent's
  own call time, summed) and `waveMs` (the wall). **`agentMs − waveMs` IS the
  overlap**, stored as the two numbers rather than the difference, since a
  derived value beside its inputs is two lists of the same thing. Plus a time
  per agent (`<name>Ms`), keyed by NAME.
- **`bands` step** — `bands`/`wrote`, `parts`/`wroteParts`, the same two
  timings, and a time per piece keyed by POSITION (`b1Ms` … `p1Ms`).
  **Position, not name**, because `bandName` can reach 21 characters and `tr.at`
  cuts a key at 16: two bands agreeing far enough in would arrive as ONE key with
  the later overwriting the earlier — a wrong number wearing a right one's name,
  the only way this instrument can lie rather than go quiet.
- **`bands:<reason>`** — a split that does NOT happen says which wall stopped it
  (`revise`, `thin`, `door`, `nofanout`). The reason rides in the step's NAME
  because `tr.at` keeps finite numbers only. **The order is the code's order,
  which is a limitation rather than a ranking.**
- **`genMs`** on the collector's `resume:finish` step — fire-to-collection, the
  only measurement available on BOTH the split and the single-call path. **It
  was worthless until the wake**: with the collector arriving on a timer it
  measured the TIMER, and it reads exactly as plausible.
- **`GET /api/site/runtime?slug=`** — owner-gated, booleans and the deploy sha
  only. It exists because those flags are GitHub secrets with a workflow
  `|| fallback`.
- **`GET /api/site/build-health`** — which container image a COLD START gets.
  The deploy stamps the image id into the image itself (last line of the
  Dockerfile, from git objects at HEAD so it cannot move), `/health` answers
  `ok <templateId> <imageId>`, and an unstamped image says `unstamped` rather
  than guessing.
- **`GET /api/fal-balance`** — owner-gated, busts its own 60-second cache, and
  answers the precondition every parked photograph test needs: `usd > 0` is
  *"funded — a build can buy photographs"*, `usd <= 0` is *"empty — a build's
  photographs will all come back as placeholders"*, `null` is unreadable. Call
  it from the app console: `await (await apiFetch('/api/fal-balance')).json()`.
  **It is the precondition and NOT a gate** — the builder's photographs are
  bought straight off `fal.run` with no balance check, so a run against an empty
  fal is GRACEFUL and expensive: the addon's credits are spent, placeholders
  publish, and the result is complete, plausible and proves nothing (run 51).
  One free console line against ~13 credits.

**A PAID HARNESS RUN REFUSES TO SPEND AGAINST THE WRONG BUILD.**
`scripts/addon-sweep.mjs` asks `/api/site/build-health` (the Worker's
`DEPLOY_ID` **and** the container's cold-start image, in one call) plus
`/api/site/runtime` as a second reader, **before the browser, the balance or
the first post** — a refusal there has spent nothing, which is the only reason
it can be a refusal rather than a warning printed over a run already under way.
`expect_deploy` and `expect_image` on `lane-sweep.yml`'s form are the demands.

- **TWO HALVES, AND A ROLLOUT MOVES THEM SEPARATELY** — the Worker can be new
  while an instance started seconds earlier is still on the previous image.
- **CANNOT-TELL IS A REFUSAL, NEVER A MATCH.** `unstamped` arrives as `""` and
  refuses; so does a route that failed. The wrong direction is the expensive
  one — a run against the PREVIOUS build produces a complete, plausible,
  green-looking result about code that is not under test.
- **A SHA MATCHES BY PREFIX, FLOORED AT 7 ON BOTH SIDES; AN IMAGE ID MATCHES
  WHOLE.** A prefix of a hash is not a weaker claim, it is a different one.
- **THE TWO READERS MUST AGREE, asked with no expectation set** — a disagreement
  means a roll is in flight, which is a fact about the platform rather than
  about what the caller wanted.
- **QUEUED WORK IS REQUIRED BEFORE ANY PAID POST, UNCONDITIONALLY.** `async` off
  means the addon runs inside the Worker's isolate, bounded by the customer's
  own connection at ~270 s — run 45 died at 270,025 ms with the credits gone.
  As a caller's flag it would be an input, and an input cannot be the wall.
  `!== true`, so the string `"true"` is cannot-tell and not a yes.
- **`codeRefusals` AND `expectedCode` ARE PURE AND EXPORTED**, because the
  wrapper needs two authenticated routes and a cold container: *a wall nobody
  can drive is a wall nobody is guarding*, in the branch whose wrong answer
  costs credits. **The env pair was two module constants until a sweep killed
  it** — two mutants cutting the expectations out of the call SURVIVED every
  guard, since a constant handed over and one not handed over look identical
  from outside.

**THE EDIT CANARY TAKES A SITE AND AN INSTRUCTION, AND WRITES ITS OWN
EVIDENCE (2026-09-21).** `edit-canary.yml` grew `site`, `control`,
`expect_deploy` and `expect_image` beside the `spend`/`instruction` pair it
already had, so one live edit test runs end to end through Actions with no
browser console and nothing collected by hand. **The record is an uploaded
artifact** (`CANARY_EVIDENCE_DIR`, `if: always()` so a refusal's before-state
survives too): `source.json` with every page and component BODY, `inventory.json`
(per route: on-page photographs with the og:image share card stripped, headings
in document order, a word multiset), the raw HTML per route, then `routing.json`,
`terminal.json`, `customer-reply.txt` and `compare.json`. **The inventory runs
on EVERY run, paid or not**, so one free dispatch produces the whole
before-record.

- **THE PREFLIGHT DEMANDS BOTH ELIGIBILITIES, not just the identifiers.**
  `async` false means the edit runs in the Worker's isolate bounded by the
  caller's connection; `runner` false means the job never reached the site's
  own container. Either one makes a green result a statement about a different
  path. Plus both deploy readers agreeing, and `shaMatches` **floored at 7 on
  BOTH sides** so a short expectation cannot pass by being short.
- **⚠ THE CONTROL CHECK WENT STALE FOR SEVENTEEN DAYS AND NOTHING ASSERTED
  IT.** *"A non-canary still receives the SYNCHRONOUS shape"* was written
  2026-09-01 and was true while `EDIT_ASYNC_CANARY` named one slug;
  `EDIT_ASYNC_EVERYONE` opened the door on 2026-09-04 (`dacc9b51`) and the file
  was never touched again. **A rule true because of a layer below it expires
  when that layer moves** — and the cost here is specific: **a failed free
  check REFUSES TO SPEND**, so a stale control blocks every paid dispatch for a
  reason that has nothing to do with the code under test. The expectation is
  DERIVED from `/api/site/runtime` now, which is the property that cannot go
  stale whichever way the flags are set.
- **AN UNREADABLE CONTROL IS OUTSTANDING COVERAGE, NEVER A REFUSAL.** That
  route is owner-scoped, so a control the building account does not own answers
  the 404 a missing site gets — a fact about a DIFFERENT site. Cannot-tell
  refuses in the preflight's own demands and must not refuse here.
- **THE BALANCE IS READ ON EVERY RUN.** It sat inside the paid half, so a FREE
  dispatch — the one whose whole job is to say whether the paid one is worth
  pressing — never printed the one number that decides it. `balanceNow()` is
  ONE reader asked twice, because the free half runs a whole job between the
  two and the number a spend is measured against is the one immediately before
  it. The NUMBER only: the service key is in a header and never in the output.
- **⚠ AND `paidHalf()` WAS ANCHORED ON A LINE OF CODE, so five cases went red
  about a change that touched none of what they assert.** The landmark was
  `const before = await fetch(`, the balance read — which stopped being a
  `fetch(` the moment that read was lifted into a function. **A landmark that
  is a line of code is a claim about how that line is spelled**; it is anchored
  on the section's own heading now (`PAID CANARY EDIT`), which is a claim about
  where the paid half BEGINS — what every case below it actually means. Proved
  LOUD rather than vacuous: removing the heading fails five cases instead of
  passing a window over nothing.
- **⚠ AND THE FIRST PRESS DIED IN ONE SECOND, BECAUSE THE WORKFLOW DID NOT
  INSTALL WHAT THE SCRIPT IMPORTS (run 6, 2026-09-21).**
  `ERR_MODULE_NOT_FOUND: Cannot find package 'qrcode-generator' imported from
  builder/site-qr.mjs`. `edit-canary.yml` had **no `npm ci` step and had never
  needed one** — the canary imported `node:https` and nothing else for months.
  Then it gained `editBrowserReply` from `addon-sweep.mjs`, so the customer's
  own screen is EXECUTED rather than re-composed, and **that one line pulled a
  44-file closure wanting two real packages**. **THE VERIFICATION WAS THE TRAP'S
  OWN SHAPE**: the import was driven LOCALLY, where `node_modules` exists,
  which proves an import works in an environment that is not the one that runs
  it. *A CI step that does not install what the script imports — true when
  written and false the moment a module gained a dependency.*
  **IT COST NOTHING AND THAT IS NOT THE SAME AS BEING HARMLESS**: it died
  before the preflight, before any network call, so no credit moved — and the
  harness tested nothing at all, on a press somebody made.
  **THE GUARD IS THE ENVIRONMENT-VERSUS-CODE COMPARISON, NOT THE TWO NAMES**:
  it walks the real transitive imports, and if the closure reaches ANY bare
  specifier the workflow must carry an install step AND `package.json` must
  declare it (`npm ci` on a lockfile without it installs nothing and the step
  still passes). Pinned to today's two packages it would go quiet on the third,
  which is exactly how the step came to be missing. The walk **proves its own
  observer alive** before believing any absence.

- **THE GUARD IS WHAT WAS MISSING, and it is the reusable part**: the harness
  had six cases and not one of them read the control, which is exactly why the
  constant could rot in plain sight. Four cases now, all four red-checked
  against a backup (never `git checkout`, which restores to HEAD and eats the
  uncommitted work — the 2026-09-16 trap): **five mutants killed, a
  comment-only control survived.**

**RUN 9 (2026-09-21) IS THE PAGE RUNG'S TWEAK PROVEN LIVE, END TO END THROUGH
ACTIONS WITH NO BROWSER CONSOLE.** `fold-lane-bakery`, *"Put the 'Fed every
morning since we opened' section above 'Today's bake'."*

- **THE TWEAK HELD** — `tweak: true`, so the cheap writer answered and nothing
  fell through to the rewrite. **153.9 s** fire-to-terminal, ONE model call
  (grok-4.6, **2,413 in / 1,230 out**), `files: 24`, `photos: 0`.
- **THE ROUTER NAMED THE LAYER AND THE LANE PICKER NEVER RAN** — `intent=edit
  layer=page page=/` and **`lanes: []`** on the merged reply. The prediction
  beforehand was `shape` → `page`, off the picker's own prose (*"moving a band
  up or down"*); the DESTINATION was right and the DOOR was not. **`lanes` is
  empty whenever the router answers a layer directly**, so an empty `lanes` is
  not evidence that no lane would have matched.
- **THE ARITHMETIC CLOSES**: route 2 + rung 2 = **4**, and the balance moved
  **105 → 101** exactly. That is what makes the routing correction a
  measurement rather than an inference.
- **⚠ "ONLY THE TARGET PAGE CHANGED" WAS FIRST CLAIMED OFF HEADINGS AND
  PHOTOGRAPH REFERENCES, WHICH CANNOT ESTABLISH IT (owner: *"that alone does
  not establish unchanged source or wording"*).** Two files can carry identical
  headings and identical `src` attributes and differ everywhere else. **The
  claim is now the STORED SOURCE BODIES, compared out of the run's own
  artifact** — free, no rerun, no harness change:
  **`gallery.tsx` 3011b, `order.tsx` 9262b, `the-starter.tsx` 955b and
  `visit.tsx` 4049b are BYTE-IDENTICAL** (sha256 equal on each), and
  **`index.tsx` alone differs — at exactly 4,389 bytes on both sides.**
- **AND INSIDE IT THE DIFF IS A PURE BLOCK MOVE.** One 16-line `<section>`
  removed from one position and inserted at another, VERBATIM, `SafeImage`'s
  `src`/`alt`/`ratio`/`fallbackSeed` carried with it. **The TOKEN MULTISET over
  the whole file is IDENTICAL** — every token occurs the same number of times
  before and after — which is the property `sameProse` asserts, measured here
  on the artifact rather than trusted from the rung's own verdict.
- **THE PHOTOGRAPHS WERE CHECKED IN A REAL BROWSER, NOT COUNTED IN HTML.**
  Counting `<img src="/u/…">` establishes a reference, never a picture: a
  reference can 404, decode to nothing, or sit under `display: none`. Chromium
  against the live page: **NAV 200, both photographs `complete` with
  naturalWidth 2400×1792, on screen at 976×549 and 720×540, opacity 1, both
  `/u/` responses 200, ZERO failed requests.**
  **⚠ AND THIS FALSIFIES THIS FILE'S OWN RECORDED LIMITATION** — *"Chromium in
  this sandbox cannot reach a site host at all"* is listed under the blind-
  instrument traps and is NOT true today. A stale limitation is a false
  negative about our own instruments, and it had already cost one check nobody
  attempted.
- `photosKept` **absent**, which is the CORRECT outcome for a clean reorder —
  nothing needed restoring, and the owner's own correction on this file
  predicted it.
- **⚠ AND THE HARNESS'S `preserved` CHECK COMPARES NAMES, NOT BODIES.**
  `cmp.parts` is `parts.map(p => p.path).sort()` on each side, so it answers
  *"the same components exist"* and is silent on whether any of them was
  REWRITTEN. **The bodies ARE in the artifact** — `source.json` carries
  `{pages, parts}` whole on both sides — so the comparison is available and
  simply is not made by the check. **Compare the bodies out of the artifact**
  rather than reading `preserved: true` as body preservation; that is what the
  bakery's own claim had to be rebuilt on.
- **⚠ AND A TWEAK CANNOT EVIDENCE COMPONENT PRESERVATION AT ALL.** `runTweak`
  takes ONE page's source and answers ONE page's source, so component bodies
  are carried through **unchanged by construction** — a green components result
  on a tweak run is true of the transport and says nothing about the writer.
  **Only the REWRITE rung can put a stored component at risk**, because that is
  the call `partsSent` shows source to and `mergeParts` folds answers back
  from. So *"components preserved"* is worth having only on a run where the
  tweak DECLINED — **which is run 11, below.**
- **⚠ WHAT THIS RUN DID NOT DEMONSTRATE, KEPT SEPARATE ON PURPOSE.** It
  exercised ONE rung on ONE shape. **The restoration and refusal behaviour is
  untouched** — `keepPhotos` restored nothing and `withheld`/`photosBlocked`
  never fired, because nothing was ever at risk; **custom components are
  untested**, this site storing none; and **the full rewrite path never ran**,
  the tweak having held. Three separate bodies of law, none of them evidenced
  here.
- **CONFIRMED FROM OUTSIDE THE HARNESS**: the live page was fetched separately
  afterwards and serves `Harbour Loaf | Fed every morning since we opened |
  Today's bake | Order a loaf for collection`. The run's own claim and an
  independent read agree.
- **AND THE COMPONENTS HALF IS UNTESTED RATHER THAN PROVED** — this site stores
  NO components, so `parts 0 → 0` establishes nothing, and the harness says so
  in its own output instead of letting the silence read as a pass.

**RUN 11 (2026-09-21) IS THE PAGE RUNG'S FULL WRITER PROVEN LIVE WITH THE
SITE'S OWN COMPONENTS STANDING IN FRONT OF IT — the gap run 9 explicitly could
not close.** `fretwork-1`, *"The home page shows nine beginner quotes in three
stacked blocks and they all say much the same thing. Show just the first three,
in one block."* Run **8m58s** (06:21:38 → 06:30:36Z), routed `intent=edit
layer=page page=/` in **19.4 s for 2 credits**, rung **20**, **balance
101 → 79, moved 22.**

- **THE FIXTURE WAS CHOSEN SO THE TEST COULD NOT BE VACUOUS, and that was
  measured BEFORE the press rather than hoped for.** `partsSent` was driven
  locally over the run-10 free capture and answered **shown 3, withheld 0** —
  so the writer really held all **9,372 bytes** of component source in its
  prompt, and `mergeParts` would have folded any returned component back over
  the stored file. A run where the components were withheld would have proved
  the wall, not the writer.
- **THE THREE COMPONENT BODIES CAME BACK BYTE-IDENTICAL**, compared out of the
  artifact's own `source.json` on both sides rather than off the harness's
  `preserved` flag: `chord-diagram` **3,861 b sha `d0c20d52f91d69d2`**,
  `day-space-lookup` **1,466 b sha `5330fca7b88e5ac1`**, `trial-booking-form`
  **4,045 b sha `4b66386c0ad46092`** — equal on each side, `parts 3 → 3`. All
  three still IMPORTED and still RENDERED by the rewritten page.
- **THE UNRELATED PAGES ARE BYTE-IDENTICAL TOO**: `gear.tsx`
  **`d580389f971cdd31`**, `prices.tsx` **`0d2d72dee56a2a71`**.
- **AND THE TARGET PAGE'S DIFF IS PURELY SUBTRACTIVE** — `index.tsx` 28,002 →
  **26,276**, three hunks, **60 lines removed and one line narrowed**
  (`Testimonial, TestimonialGrid` → `TestimonialGrid`, the import the removal
  left unused). Token multiset over the whole file: **199 lost, 0 gained.** The
  writer invented no words.
- **⚠ WHICH DOOR SENT IT TO THE REWRITE IS UNCONFIRMED, AND THE FIRST WRITE-UP
  OF THIS CLAIMED `sameProse` ON EVIDENCE THAT CANNOT ESTABLISH IT** (owner).
  What the wire carries is `tweak` ABSENT and `tweakUsage` present —
  `{model: "grok-4.6", in: 8776, out: 7797, cacheRead: 512}`. **The honest
  statement is: a tweak attempt incurred usage; the full writer subsequently
  completed; the exact fallback reason is unconfirmed.** The rejected tweak
  output was never captured and `readTweak`'s `reason` is not on the reply, so
  an output-token count plus the FINAL published source — which is the
  REWRITE's output, not the tweak's — cannot tell `reworded` from `cannot`,
  `lint`, `truncated`, `moved-route` or `no-change`. **Putting the reason on
  the wire, or storing the refused answer, is what would settle it**; neither
  exists today.
- **THE CUSTOMER'S SCREEN, VERBATIM** (the browser's own composer, executed):
  > ✅ Updated /. ⚠️ index.tsx: reads table "lessons", which the schema does not declare. index.tsx: reads table "bookings", which the schema does not declare. index.tsx: calls the database function "bookings_on_day", which this schema does not declare — the request is a 404. This schema declares no functions at all.
  > I had a look at the finished pages: 2 pages threw an error and 4 pages reads something the check can't reach, so I couldn't see it with real data.
- **THOSE SCHEMA WARNINGS ARE PRE-EXISTING AND CORRECT, counted on both sides**:
  `lessons` 2 → 2, `bookings` 4 → 4, `bookings_on_day` 1 → 1, `gbp_eur` 1 → 1,
  `gear` 1 → 1, as quoted string arguments across every stored page and
  component. `fretwork-1` is one of the four sites the backlog records as
  `incomplete` — `site_backends.neon_db` blank — so the schema the lint compares
  against is empty and every genuine data read reports undeclared. **The rewrite
  introduced none of them.**
- **⚠ AND THE FIRST READING OF THAT ANSWERED ZERO FOR EVERY NAME**, one step
  from reporting that the rewrite had invented broken database calls. It was a
  shell-quoted `node -e` whose `\b` escaping collapsed, so the regex matched
  nothing — **a zero from a broken reader is byte-identical to an absence**.
  Re-run as a FILE rather than a one-liner, the counts above are what came back.
  This file's own trap, met on its own evidence.
- **THE REPLY PRINTS THREE PROBLEMS AND THE WIRE CARRIES FOUR.** `problemNote`
  is `…slice(0, 3)` with no "and N more" clause, so the fourth —
  *"index.tsx: writes to table \"bookings\", which the schema does not
  declare."* — is on `problems` and not on the screen, and from the screen a
  customer cannot tell it is there. Recorded, not fixed.
- **THE HYDRATION FINDINGS ARE UNRESOLVED IN BOTH DIRECTIONS.** The render
  check answered `checked 7, pages 7, partial: true` with `threw` on **`/`
  [phone]** and **`/es` [phone]** — *"React error #418 (hydration mismatch) —
  no differing text was found once the page had settled"* — plus four `unmet`
  (a database function on `/` and `/es`, an outside connection on `/prices` and
  `/es/prices`), which is run 53's non-serious kind working live. A later
  browser load of both at 390×844 answered **200 with 0 console errors**, and
  **that settles nothing either way**: a clean later load does not establish
  the findings were false, and there is **no before-render baseline**, because
  the free half of this harness takes no render check — so nothing here
  establishes a new regression either. `deadSelectors` were
  `[data-slot="cta-band"] [data-slot="button"]` and `[data-slot="hero-split"]
  h1`, 2 of 7 looked at. #80 already carries the Spanish variant's #418 open.
- **THE BROWSER HALVES ARE TWO READINGS, TAKEN EIGHT MINUTES APART.** Before at
  **06:23:41Z**, deliberately while the run was still working, because after a
  publish lands *"it was there"* and *"I never looked"* are the same absence:
  NAV 200, **9 of 9 quotes on screen**, 2 `testimonial-grid` slots, html
  **76,503 b**. After at **06:31:44Z**: NAV 200, **3 of 9 quotes** — exactly
  the first three, which is what was asked — **1** `testimonial-grid` slot,
  html **72,649 b**. **Zero console errors and zero failed requests on both**,
  and all three components painting at identical sizes both times
  (8 chord diagrams at 160×215, `DaySpaceLookup` and `TrialBookingForm` at
  576×30, opacity 1).
- **THE COST LANDED INSIDE A BAND QUOTED BEFORE THE PRESS** — estimated 15–24
  with an honest band of 12–30, measured **22**. The estimate was built from
  measured prompt sizes (`pageRulesFor` 29,077 + `SITE_PAGES_TOOL` 2,920 +
  `briefWithLayout` 13,639 + the 28,002-character prior page = **73,638
  characters in**) rather than from a remembered figure, which is why it was
  worth quoting at all.
- **⚠ THE CLAIM IS "STILL RENDERING, WITH SOURCE UNCHANGED" AND NEVER "STILL
  WORKING"** (owner). Nothing in this run submitted the trial booking form or
  exercised the day/space lookup, so what is established is that the three
  files are byte-identical and the three components PAINT. Whether their
  behaviour survives is a different check and this run is not it — the same
  distinction this file already draws between a 200 and a health check.
  **ONE OF THE THREE WAS THEN DRIVEN SEPARATELY, FREE, and it works**: in a
  real browser the day/space lookup renders `Choose a day to check space.`,
  and filling its date input calls
  **`POST /api/db/fretwork-1/data/rpc/bookings_on_day` → 200** and renders
  `No bookings on this day yet — it still has space.`, with zero console
  errors and zero failed requests. **AND THAT SETTLES WHAT THE SCHEMA WARNING
  MEANS**: the reply calls `bookings_on_day` undeclared and the live RPC
  answers 200, which is not a contradiction — the warning is about the STORED
  SPEC, empty while this site's backend reference is missing, and the
  DATABASE is real (`lookupRoute` resolves an `incomplete` site out of the KV
  cache in the Worker). *A correct warning about the spec is not a claim about
  the database.* **The trial booking form is still undriven**, deliberately: a
  submission would write a row to a customer site.
- **⚠ WHAT THIS RUN DID NOT DEMONSTRATE, KEPT SEPARATE ON PURPOSE.** The
  photograph **restoration and refusal** behaviour is untouched — `fretwork-1`
  serves no uploaded photographs on any of its three routes, so `keepPhotos`
  had nothing to restore and `withheld`/`photosBlocked` never fired. And
  **deliberate component MODIFICATION is untested**: this proves the writer
  leaves components alone when nothing asks it to change one, which is a
  different claim from the `tsx` lane correctly rewriting one on request.
  Neither is evidenced here.

**RUN 12 (2026-09-21) WAS BLOCKED BEFORE ANY COMPONENT WAS GENERATED, AND THE
RECORD IS A ROUTING READING RATHER THAN A CAPABILITY FINDING.** `fretwork-1`,
an ask aimed at `day-space-lookup`'s booking-count display. The router answered
**`layer=rules`**, the `rules` rung met `no-backend`, and the whole message
stopped: **2 credits** for the routing call, **balance 77**, `cost: 0` on the
terminal body, **nothing published and no component written**.

- **THE TERMINAL BODY IS THE WHOLE OF IT**: `{"ok":false, "escalate":true,
  "reason":"no-backend", "cost":0}` at **HTTP 200** — an escalate is a product
  answer, not a transport failure, so the status is not what separates it from
  a published edit.
- **THE CAUSE IS THE ALREADY-RECORDED `incomplete` STATE MEETING A RUNG THIS
  FILE HAD NOT NAMED.** The `rules` rung gates on `siteBackendBySlug(env,
  ownerSlug)` and escalates on a falsy answer; `fretwork-1` is one of the four
  backlog sites whose `site_backends.neon_db` is blank. Not a new defect —
  the same blank column, one rung over.
- **⚠ THE ROUTING CONCLUSION IS NARROW AND STAYS NARROW (owner).** **This
  WORDING selected `rules`.** It does not establish that a booking-count
  display cannot be edited through the component path: one run fixes one
  sentence's route and says nothing about the rung the sentence never reached.
  The prediction beforehand was `tsx` → `page`; it was wrong because the
  sentence said *"counts bookings"* and *"six lesson slots a day"*, which is
  `rules`' own description. **A routing prediction is a prediction about
  WORDING, and the lane picker never ran** (`lanes` is empty whenever the
  router answers a layer directly — run 9's rule, holding here too).

**⚠ AND THE FIRST WRITE-UP OF THIS GOT THE ESCALATION WRONG (owner:
*"`editBrowserReply` records a FULL rewrite action for this response; it is
not a sideways layer retry"*).** The blank `customer-reply.txt` was written up
as *"the browser re-posts at another layer and the harness sends one POST"* —
which is a different and cheaper outcome than the one the page really takes.
**DRIVEN LOCALLY on the stored body, no paid request, and the helper answers:**

```
shown  : false          (finish was NEVER called — this branch ACTS instead of printing)
text   : ""
actions: 1
   -> start the FULL ~25-credit rewrite (the browser's `fallback`)
```

- **IT IS `up` BY CONSTRUCTION, NOT BY THE HOP BOUND.** `escalateAction` reads
  `e.layer` for a sideways hop and **this reply carries no `layer` at all**, so
  `named` is `""`, `handedOff` never enters it, and the decision falls to `up`
  → `fallback()`. A hop would have been recorded as *a second PAID post naming
  a layer* — a different sentence and a different price.
- **THE CONTROL PROVES THE RECORDER IS NOT MUTE**: an ordinary published edit
  through the same helper answers `"✅ Updated /."` with `actions:
  ["refresh the credit balance"]`, and the three escalate shapes (`up`, `hop`,
  `addon`) record three different actions.
- **⚠ AND THE BLANK CAPTURE WAS THE HARNESS DROPPING A FIELD THE HELPER HAS
  ALWAYS RETURNED.** `editBrowserReply` returns `{ok, text, shown, actions,
  why}`; `edit-canary.mjs` read `.text` alone, so the artifact was **0 bytes**
  and the whole evidence bundle was silent about the ~25-credit rewrite the
  page would start. **`customerLines`, the ADDON sweep's reader one function
  over, had printed `actions` for weeks.** *The wiring trap in its plainest
  form: the producer perfect, the consumer dropping the field, and from outside
  "the helper did not record one" and "we did not read it" are the same
  absence.* Fixed: the capture prints and writes both, and **`shown` separates
  an acting branch from a composer that answered `""`** — without it the two
  write the same blank file. Driven over run 12's stored body: **0 → 179 bytes**.
- **THE GUARD IS WHAT WAS MISSING**, and it is split the way the defect was:
  the helper half is **DRIVEN** (`test/edit-browser-reply.test.mjs`, three
  escalate shapes plus a published-edit control) and the wiring half is the
  hop (`test/edit-canary.test.mjs`, landmark to landmark). **4 mutants killed,
  a comment-only control survived** — the artifact losing `actions`, the
  run-12 defect restored verbatim, the helper's recorder silenced, and a hop
  recorded as a fall.
- **⚠ THE GUARD'S OWN LANDMARK WAS A HEADING COMMENT AND WENT RED AT ONCE** —
  `SRC` is the BLANKED source, so `"THE CUSTOMER'S OWN SCREEN"` is whitespace
  by the time it is searched for. Anchored on **code** now (`const said =
  editBrowserReply(` → `await inventory("after")`). This file's own recorded
  trap, met while writing the guard for another one.
- **AND THE HARNESS REFUSING A NO-OP ROUND TRIP IS IT WORKING**: `check("the
  edit published", ...)` fails on an escalate by design, because a terminal
  answer is not a pass.

**RUN 13 (2026-09-21) IS THE FREE PRESS THAT CONFIRMED WHICH CODE ANSWERS, AND
IT IS THE ONLY RUNTIME READING OF THE MERGE.** `build-health 200 deploy=3b555acf09de
image=6b14851c0cd0c1c1`, `runtime 200 async=true runner=true`, both deploy
readers agreeing, balance **77**. Deploy 2142 had rolled the image
`82bccb3bee50e4fd` → `6b14851c0cd0c1c1`, confirmed on two channels (the log's
own `- "image"`/`+ "image"` pair and an input count of 184). **The deploy said
what Wrangler sent; run 13 is the live Worker answering**, and this file's
standing rule is that those are two claims.

**RUN 14 (2026-09-21) TESTED A REQUEST NOBODY MADE, AND THEN COULD NOT READ ITS
OWN RESULT. BOTH HALVES WERE THE HARNESS (corrected 2026-09-21 from the run's
own log and artifact, after the owner read them).** The first write-up of this
entry reported a routing finding about the places-left ask and a stalled job.
**Neither is true, and the corrected account is shorter than the wrong one.**

**1. `CANARY_INSTRUCTION` WAS BLANK AND THE HARNESS SUBSTITUTED ITS OWN ASK.**
The run's log prints the env block verbatim: `CANARY_SPEND: 1` beside
`CANARY_INSTRUCTION:` with nothing after it. `edit-canary.mjs` read that field
through a fallback to a hardcoded CTA-colour request, so **what was really
submitted was a button-colour change** — and `intent=edit layer=look cost=2` is
the CORRECT route for one.

- **SO THE `look` RESULT IS EVIDENCE ABOUT A BUTTON COLOUR AND NOTHING ELSE.**
  It says nothing about how the places-left wording routes; that ask was never
  sent. Every sentence the first write-up built on it — that the
  recovery-versus-display distinction "did not arise", that the router "stayed
  under test" on this wording — is withdrawn.
- **THE WORST-SHAPED FAILURE AVAILABLE, and that is the general lesson**: a
  substituted ask produces a complete, plausible, internally consistent run.
  Nothing in the artifact disagreed with anything else, because everything in
  it was true of the request the harness invented. **The bundle recorded the
  routing answer, the terminal body and the customer's screen — and nowhere
  the one input that decides all three.**
- **AND THE REFUSAL IT NEEDED WAS ALREADY THERE, ONE FIELD OVER.** Eight lines
  below the fallback sits *"REFUSE TO SPEND BLIND. A blank layer costs nothing
  and proves nothing, and the whole danger is that it PASSES"* — the identical
  argument, applied to the layer and not to the ask.

**2. THE HARNESS COULD NOT ESTABLISH A STALL, AND 845.2 s IS ITS OWN LOOP.**
The watch ended only on HTTP 200: `for (let i = 0; i < 260; i++)` with a
3-second wait. **260 × 3 s = 780 s, plus request latency = 845.2 s** — it ran
to exhaustion and then printed *"the job did not finish inside the watch"*,
which is a claim about the JOB made from a fact about the HARNESS.

- **A COMPLETED FAILURE ANSWERS 503, AND THE POLL ROUTE'S OWN FAILURE ANSWERS
  503.** `EditPoll.readPoll` exists to tell them apart and its comment says so:
  a stored reply keeps its own status and arrives under **`x-gf-edit: final`**,
  while *"by number alone a stored 503 is a transient one, and gets retried
  until the client gives up on an edit that finished minutes ago."* The harness
  re-derived the question as `status === 200` and met exactly that.
- **THE LOG CANNOT SETTLE WHAT REALLY HAPPENED, BECAUSE IT NEVER PRINTED THE
  HTTP STATUS.** The tick line logged `q.json.status`, not `q.status`. What it
  does show is a **shape change at 576 s**: `claimed` → `routing` (cost 2) →
  `? / verify` with cost **0** and no `status` field at all. A stored reply has
  no job-state field — that is `readPoll`'s whole premise — so that is
  *consistent with* the job having finished and the harness having polled past
  it, and is **not proof of it**. Recorded as unresolved rather than
  attributed; the corrected harness would answer it in one press.
- **⚠ AND THE RECORDED "THE BROWSER WOULD START THE FULL ~25-CREDIT REWRITE" IS
  A HARNESS ARTIFACT.** With no terminal answer the reply reader was handed
  **`null`**, and `editAnswer`'s very first branch (`public/chat.js:9058`) is
  `if (!e) { … return o.fallback() }`, whose own comment says *a body we cannot
  read is not a refusal*. **A real browser polling a running job shows
  `running`; it never receives `null`.** The composer is correct and the
  instrument gave up. `terminal.json` recorded `{status: 0, body: null}`, which
  reads identically for a completed failure, a lost job and a watch that
  stopped looking.

**WHAT THE RUN DOES ESTABLISH.** Balance **77 → 75, moved 2** — **a NET
deduction of 2 and nothing more** (corrected 2026-09-21, owner). ⚠ This first
read *"the routing call alone; the edit was never billed"*, and **a before/after
balance cannot establish that**: a net of 2 is equally consistent with a routing
call of 2, and with a routing call of 2 beside an edit charged 20 and refunded
20. **The two need different next steps** — one is a run that stopped before it
spent, the other is a run that spent and reversed — so collapsing them is the
same shape as every other cannot-tell-read-as-a-value in this file. **What
separates them is `edit_jobs.billing` and the `credit_events` rows, neither of
which anything here had ever read**; the read mode below exists for exactly that
and has not been pressed. Nothing published: at **20:40:27Z**, 11.4
hours later, the live site still serves **`x-site-version: 01789972018761-6tng48`**,
minted **06:26:58.761Z**, inside run **11**'s window (06:21:38 → 06:30:36Z).
`mintVersion` runs BEFORE the compile, so a late publish would carry a version
from ~09:16Z and there is none. Reconciled against a curl capture from
2026-09-20: **58,670 b / 2 `testimonial-grid` → 54,453 b / 1**, which is run
11's change and nothing since.
**⚠ RUN 11'S 72,649-BYTE FIGURE IS A BROWSER POST-HYDRATION DOM READING AND IS
NOT COMPARABLE TO A CURL** — two instruments, two numbers.

- **NONE OF THE THREE CORRECTIONS WAS EXERCISED**, and now for two reasons
  rather than one: the ask was not theirs, and no outcome was read. Outstanding
  coverage, not evidence.
- **THE `day-space-lookup` ARITHMETIC IS UNCHANGED** — simulated with
  controlled RPC responses, no rows created: 0 → *"No bookings on this day yet
  — it still has space."*, 2 → `2 bookings already on this day.`, 6 → `6
  bookings already on this day.` Still counting UP.
- **THE COMPONENT STILL WORKS, WHICH IS THE BEFORE BEHAVIOUR AND NOT A PASS**:
  NAV 200, `POST /api/db/fretwork-1/data/rpc/bookings_on_day` → **200, body
  `0`**, 0 console errors, 0 failed requests.
- **⚠ THE JOB RECORD IS READ, AND BOTH OPEN QUESTIONS ARE SETTLED** (the
  owner's press, read-job run **15**, `35669789100`, 2026-09-21T23:56Z, free,
  **18 seconds**). Everything below is `edit_jobs` and `credit_events`
  answering, not a log being interpreted.

**1. THE 576-SECOND SHAPE CHANGE WAS THE JOB FINISHING.** The row is
`state: failed`, created `09:16:38.906801Z`, updated `09:26:10.801425Z` —
**571.9 s**, against the harness's shape change at 576 s. `result` is
**HTTP 503** and the poll answers `503` under **`x-gf-edit: final`**, so the
old watch's `status === 200` polled straight past a completed answer and ran
on to its own 845.2-second exhaustion. *Recorded as unresolved for a day and
resolved by one free press*; the corrected watch's `reply` outcome — a stored
reply **whatever its status** — is the thing that would have read it.

**2. THE MONEY IS CHARGED-AND-REVERSED, AND IT IS A THIRD VALUE NEITHER GUESS
NAMED.** `billing: refunded, cost 2`, and the ledger's own two rows:
`09:18:33 reserve −2 after **73** ref <job>#1` and `09:26:10 refund +2 after
**75** ref <job>` (bare). **The balance arithmetic closes: 77 → 75 → 73 →
75.** The reserve's `after 73` puts the balance at 75 immediately before it
while the harness's before-reading was 77, so 2 moved in between — run 14's
log records a routing call at cost 2, **and that last step is an INFERENCE**:
the routing call's own row does not name this job, so this query did not
return it. **So the standing caution was right and both readings were wrong**:
not *"never billed"*, not *"charged 20 and refunded 20"* — **charged 2 and
refunded 2, beside a routing call of 2.** `billing` and the ledger agree
without borrowing from each other, which is the two-line design working.

**3. WHY IT FAILED, out of the trace** (`e_mub16sydzvwux9q3`, ms **565,204**,
`failed_phase: stopped`, a slug-and-window CANDIDATE rather than a join —
the only one, ending 0.4 s before the row's `updated`): `pick_lanes` 1.3→7.1 s,
`lane:css` 8.0→107.2 s, `publish:1` at 108.5 s reaching `container:ok` at
300.97 s and failing in the same millisecond; `lane:correct` 301→405 s;
`publish:2` at 406 s, `container:ok` at 564.95 s, failing again; `stopped` at
565.2 s. The reply is `{"ok":false,"error":"unverified","phase":"verify",
"cost":0,"refunded":2}` — **the css lane's zero-match rule refusing twice and
refunding**, which is correct for the CTA-colour request the harness invented.
**`publish started -, published -`**, confirming the version reading
independently.
**⚠ AND THE FIRST WRITE-UP CALLED THE TWO `publish:N → container:ok` GAPS
QUEUEING, WHICH THE TRACE CANNOT ESTABLISH (owner, 2026-09-22).** It read
*"~350 s of the 565 was waiting for a container … a fact about the queue
rather than the work"* — and the 192 s and 159 s those numbers come from are
**`publish` to `container:ok`**, which spans the compile and the whole publish
composition as well as any wait for a lane. **That interval is build
processing plus whatever queueing there was, and nothing in the trace splits
them.** What is measured is the two durations; *queueing* is a reading of them
that no mark supports. Recorded as two unattributed intervals — the same
cannot-tell rule this file applies everywhere else, met on its own timing.

- **`credit_events` HAS NOW BEEN READ OVER THE WIRE**, the one hop this file
  records as never driven by anything. It answered with the service key.
- **THE TRANSACTION LINES ARE WHAT MADE THE ARITHMETIC AVAILABLE.** An hour
  earlier the same account would have printed `CHARGED 2 AND REFUNDED 2` with
  nothing beneath it, and 77 → 75 → 73 → 75 could not have been closed from
  it — see the `readable` defect below.
- **STILL UNREACHABLE, AND IMMATERIAL HERE**: the submitted instruction (R2,
  behind a Worker binding). Run 14's own log already showed that box empty.

### THE READ-ONLY JOB LOOKUP (2026-09-21)

`CANARY_READ_JOB` is a MODE on the existing canary, not a flag beside the
others: it signs in, reads the job's row, the ledger rows naming it and the
trace candidates, prints one account, writes it to the evidence directory and
**EXITS ABOVE THE PREFLIGHT** — so the routing call, the edit POST, the watch
and the browser are all unreachable from it. `scripts/canary-read-job.mjs`.

- **THE BOUND IS STRUCTURAL AND NOT A PROMISE.** The module is handed exactly
  two readers — a Supabase GET and a poll GET — so it has no transport of its
  own and no verb to reach for. Asserted as a census over blanked comments: no
  `fetch(`, no `node:https`, and none of `POST`/`PUT`/`PATCH`/`DELETE` occurs
  in it. **⚠ THE POLL ROUTE'S OWN `DELETE` IS A CANCEL**, which is why the
  method is bound at the call site rather than passed in.
- **A READ-JOB DISPATCH BEATS A STALE `spend`, AND IT IS SETTLED IN THE
  WORKFLOW.** `CANARY_SPEND` is `inputs.read_job == '' && inputs.spend ==
  'yes'`, so the two can never both be live on the wire — a `spend: yes` left
  in the form from the previous press is not a second request, and that pairing
  is the only way this mode could cost money.
- **`billing` IS THE FIELD THAT ANSWERS THE MONEY QUESTION**, and its five
  states are the check constraint's own list: `none` is the only one that
  licenses *"never charged"*; `refunded` means **charged and reversed**;
  `reserved` means held and unsettled. **A sixth value is a schema change and
  answers `charged: null`** with the value NAMED — never the most reassuring
  branch.
- **THE LEDGER IS MATCHED ON THE JOB ID INSIDE THE REF** (`ref=like.*<job>*`),
  and a `like` is the ONLY match that works — **read out of the RPCs rather
  than guessed**. A **reserve** writes `ref = p_id || '#' || p_seq`
  (`<job>#1`, `#2`, … — one request makes SEVERAL sequenced holds, which this
  file already records); a **refund** writes the **bare** `p_id`; a build
  writes `build:<job>:<step>`. **So an equality match finds the refunds and
  none of the reserves** — a refund with no debit beside it, which reads as
  credits appearing from nowhere — and a prefix match has the mirror problem
  on the build path.
- **A FAILED LEDGER READ IS NAMED, NEVER FOLDED INTO "NO ROWS"** — the two
  answer identically as `[]` and only one of them licenses a claim about money.
  **⚠ AND THE FIRST CUT DID FOLD IT, on the one line anybody reads.** Reported
  and reproduced: a 503 from `credit_events` printed `LEDGER  no ledger rows
  name this job — nothing was debited under it` and then a failed-read note
  UNDERNEATH it. Both halves were defensible alone — the note was true, the
  verdict was the right sentence for an empty list — and **nothing looked at
  the text they produced together**, which is where the defect lived. The read's
  own state is an ARGUMENT to `ledgerVerdict` now rather than a note beside it:
  on a read that did not answer, `charged`/`refunded`/`debits`/`refunds` are
  **`null`**, `readable` is false, and the line is **`BILLING UNKNOWN — … so
  whether this job was charged is not established either way`** with the status
  named. A read that ANSWERED and found nothing says **`READ CLEAN`**. Two
  facts, two sentences. **`ledgerRead` fails CLOSED** (it opens as `not read`),
  and **no rows are printed under a refusal** — rows in hand do not rescue a
  read that did not answer.
  **⚠ AND THAT LAST RULE WAS TRUE OF EVERY LEDGER THERE IS, WHICH MADE IT
  WORTHLESS (owner, 2026-09-21).** `describeJob` gates the per-transaction
  lines on `readable`, and `ledgerVerdict`'s NON-EMPTY branch never set it —
  the refusal branch says `false`, the empty branch says `true`, and the one
  branch with rows to list left it `undefined`. **So the only case that has
  transactions was the only case that never printed them**: every
  `at / kind / reason / delta / balance_after / ref` line silently absent,
  leaving the summary sentence as the whole of the money evidence with nothing
  under it to audit — which is the opposite of this instrument's point, since
  the summary carries the amounts and only a transaction line carries WHICH
  ref moved WHEN. `readable` is a property of the READ and never of the row
  count. **The two cases are a PAIR and neither is worth anything alone**: the
  refusal case proves the lines are withheld, and *"a readable ledger PRINTS
  its transaction lines, one per row"* proves they arrive — asserted field by
  field on both rows, with the summary line as the control.
  **⚠ THE SHAPE DEMO THAT WOULD HAVE SHOWN IT WAS GENERATED AND NOT READ.** A
  three-shape driver was run over `describeJob` to show what the press would
  print; shape 1 passed two ledger rows and its output listed none, and the
  absence went straight past. *An instrument's output is evidence only once
  somebody reads it* — the same failure as reporting a count nobody
  re-measured, one layer out.
- **THE JOB'S OWN `billing` FIELD AND THE LEDGER ARE PRINTED AS TWO LINES THAT
  NEVER BORROW FROM EACH OTHER**, and that is what makes a disagreement a
  finding. **DRIVEN**: under a failed ledger read the account still prints
  `billing  refunded  cost 20  ->  the edit WAS charged and the charge was
  reversed` beside `LEDGER  BILLING UNKNOWN`. Either reader alone can settle
  the money question; neither is derived from the other.
- **⚠ AND THE MALFORMED-200 CHECK WAS UNREACHABLE FROM THE ONLY CALLER THAT
  RUNS.** PostgREST answers an error as an OBJECT, so `status === 200` alone
  lets it through wearing the one shape that means "no rows" — the module's
  `Array.isArray` check is exactly right and **`scripts/edit-canary.mjs`'s
  getter read `Array.isArray(rows) ? rows : []`**, coercing before the module
  ever saw the body. So the branch could never fire in production while the
  guard drove it happily through an injected store. **This repo's own wiring
  trap, met inside the fix for the class it belongs to**: the module perfect,
  one hop cutting it, and from outside *"the body was a list"* and *"we made it
  one"* are the same value. The getter is TRANSPORT now — `{status, rows}` as
  the body came — and the decision is the module's. **All THREE reads demand a
  list**, because each has its own wrong sentence: the job read would report a
  job as *"never existed, or pruned"*, the ledger read as *nothing charged*,
  and the trace read puts a non-iterable in a field `describeJob` LOOPS over,
  which throws rather than printing anything at all.
- **⚠ AND THE `credit_events` READ IS THE ONE HOP NOTHING HAS EVER DRIVEN.**
  `edit_jobs` over PostgREST with the service key is proven —
  `scripts/gap-sweep.mjs` has done exactly that against the live database —
  and `edit_traces` is written that way by `worker.js`. **`credit_events` is
  only ever touched from INSIDE the SECURITY DEFINER RPCs**, so no code
  anywhere has read it over the wire. RLS is on with no policies and
  `service_role` carries BYPASSRLS, so it *should* answer; it has not been
  asked. **The failure mode is benign and named**: a refusal prints
  `credit_events read failed (<status>)` rather than an empty ledger, which is
  the whole reason that branch exists.
- **`edit_traces` HAS NO JOB COLUMN**, so its rows are found by slug and time
  window and are reported as **CANDIDATES rather than a join**; a second edit
  on the same site inside the window is indistinguishable.
- **THE SUBMITTED INSTRUCTION IS NOT REACHABLE AND THE ACCOUNT SAYS SO.**
  `worker.js` stores the whole request body in R2 at `editJobKey(<job>)`, which
  is a Worker binding — no Supabase read and no existing route reaches it.
  Recovering it would need a new owner route, which is a product change.
- **EVIDENCE**: `test/canary-read-job.test.mjs`, **28 cases**, the decisions
  DRIVEN over injected stores and the wiring a census. **5 mutants killed, a
  comment-only control survived** on the first round (each mutant restores one
  defect: the ledger reading a net zero as never charged, a failing stored
  reply reading as one the old watch would have ended on, a failed ledger read
  folding into no-rows, the mode not exiting, and a stale spend arming the
  paid half), and **3 more killed with the control surviving** on the wiring
  round — the real getter's coercion restored verbatim, and each of the job
  and trace reads dropping its list check. Both files restored byte-identical
  from a SCRATCHPAD backup, never `git checkout`.
  **⚠ THE CONTROL'S FIRST ANCHOR NEVER APPLIED** — it carried a `── ` the real
  comment does not have — and a control that did not apply is a check with no
  control. Re-run with the anchor COUNTED first (1 before, 1 after), it
  survived. This file's own recorded trap, met while writing the check for
  another one.
- **⚠ THE PRINTED ACCOUNT IS WHAT IS ASSERTED, because that is where the
  defect lived.** Six of the cases drive `describeJob` to its finished text
  rather than reading `ledgerVerdict`'s fields: a failed-read case that
  asserts `BILLING UNKNOWN` **and** that the string *"nothing was debited
  under it"* occurs NOWHERE in the whole account, and a successful-empty
  CONTROL that asserts the opposite pair. *Two lines that are each defensible
  alone produce one paragraph that is not, and only the paragraph is read.*

**THE PLACES-LEFT RETRY WAS DISPATCHED AND IS RUN 17 — see below.** It was
prepared here as `edit-canary.yml`, `spend: yes`, `site: fretwork-1`,
`control: washhouse-3`, `read_job` EMPTY, and the instruction **verbatim**:

> The "Space on a preferred day" box counts bookings. Make it count down the
> places left instead — six lesson slots a day, so an empty day reads six
> places left.

— the ask run 14 was pressed for and never sent.

- **⚠ AND A PARAPHRASE OF IT WAS PREPARED HERE FIRST (owner, 2026-09-21).**
  The draft read *"show how many places are left for each lesson slot rather
  than how many are already booked"*, which **is a different request**: it
  loses the DAILY CAPACITY (six slots a day, so an empty day reads six) and
  re-points the count at *each slot* rather than the day. It also drops the
  control's own name, *"Space on a preferred day"*, which is the only thing
  tying the ask to a thing on the page. **A retry that re-words the request is
  a retry of a different request** — precisely run 14's own defect, arrived at
  by a second route: there a blank field was filled by a default, here a
  remembered sentence stood in for the one that was given. **The instruction
  is quoted, never restated.**

- **`expect_deploy=3b555acf09de5e078ef6e7930ea041a32824bbba` and
  `expect_image=6b14851c0cd0c1c1`, VALID AS OF NOW.** `origin/main` is unmoved
  at `3b555acf`, and both numbers are run 13's own LIVE readings off
  `/api/site/build-health` rather than a deploy log — the platform answering,
  not Wrangler reporting on itself. **A merge invalidates them**, and a stale
  pair refuses the run: the safe direction, and still a wasted press.
- **⚠ AND THE READ MODE IS NOT PRESSABLE FROM A SESSION EITHER — RE-TESTED
  2026-09-21 RATHER THAN ASSUMED.** `run_workflow` on `edit-canary.yml` with
  `read_job` filled in and `spend: no` answers **403 Resource not accessible
  by integration**, on a token whose `actions` READS answer 200 in the same
  minute. **So the wall is the `actions: write` permission and NOT the cost**,
  which is worth separating: the standing rule was written about PAID
  harnesses and reads as though spending were what blocks a session, and it is
  not — a free, read-only, zero-spend dispatch is refused identically. *A
  stated impossibility nobody re-tested is how a route ships throwing*, and
  the re-test is what licenses the claim here.
- **⚠ THE DISPATCH MUST NAME THE BRANCH.** GitHub reads a `workflow_dispatch`
  form's inputs from the file on the SELECTED ref and, with an unpinned
  checkout, runs that ref's script — so a dispatch from `main` offers no
  `read_job` box and carries no read mode, and falls through to the ordinary
  free checks. Harmless and not what was pressed for.
- **NO LAYER IS PROMISED.** Run 14 never sent this sentence, so how it routes
  is unknown; `page` and `rules` are both live readings of it and the
  display-versus-enforcement fix earlier today is exactly what it tests. **A
  routing prediction is a prediction about WORDING** and this file's standing
  rule is that a live run settles it and nothing else does.

### THE HARNESS PATCH RUN 14 BOUGHT (2026-09-21)

**THE ASK IS DEMANDED, ABOVE EVERY PAID CALL.** `readInstruction`
(`scripts/canary-watch.mjs`) refuses a missing, whitespace-only or non-string
instruction and **there is no default anywhere** — a census over the blanked
source holds it. The gate sits **above the routing call**, because routing is
billed on its own: run 14 moved the balance by 2 for it and published nothing,
so a gate below it is a gate that has already spent. A **free** dispatch still
needs no ask, exiting on `CANARY_SPEND` first. The exact submitted instruction
is written to `request.json` before the POST.

**THE WATCH IS THE BROWSER'S.** `watchEdit` asks `EditPoll.readPoll` rather
than re-deriving it, so the harness and the customer's screen can never
disagree about what a response meant. Four outcomes, and the fourth is the
point: `reply` (a stored reply, **whatever its status**), `ended` (a terminal
job with nothing stored — the browser's own `outcomeMessage` is printed),
`gone` (404), and **`timeout` — reported as *outcome unknown*, never as a claim
about the job.** `call` keeps `res.headers`, which is the wiring hop that makes
the rest reachable at all. The composer runs **on a stored reply or not at
all**, so a null body can never again be recorded as a paid action.

- **`retries` IS COUNTED AND PRINTED**, because a watch spent retrying a 503 and
  one spent waiting on a running job log identically without it — which is why
  run 14's `? / verify` rows cannot be read either way today.
- **THE HEADER'S KEYS ARE FOLDED, NOT THE NEEDLE.** Folding the needle alone
  looks like a fix and answers `undefined` for `X-GF-Edit` just the same.
- **EVIDENCE**: 12 new cases in `test/canary-watch.test.mjs`, **DRIVEN** against
  literal poll sequences and a fake clock — `edit-canary.mjs` has top-level
  await and spends money, so a test cannot import it, which is why the two
  decisions live in their own module. **5 mutants killed, a comment-only
  control survived**; each mutant restores one half of run 14 verbatim (the
  instruction default, a blank accepted, the final header ignored, a timeout
  reported as the job not finishing, the headers dropped from `call`). Suite
  7,078 → **7,090**.
- **⚠ AND A PRE-EXISTING GUARD WENT RED ON THE FIX** — `edit-canary.test.mjs`'s
  capture case was anchored on `const said = editBrowserReply(`, which is a
  claim about HOW the composer is reached, so making that call conditional
  reported the capture as gone. Re-anchored on `const said =`, the declaration,
  with the observer still asserting `editBrowserReply(` is inside the window.
  **Four rounds running, in guards written by earlier sessions of this work.**
- **⚠ AND THE CENSUS TRIPPED ON ITS OWN PROSE.** The first cut of
  `canary-watch.mjs` explained the defect in a comment that spelled it, and the
  guard forbidding that spelling failed on the paragraph arguing for the rule.
  Comments are blanked before the scan now, with the blanker's own observer
  proved alive. **Tenth-plus recorded instance, and this one was inside the
  guard written for the trap.**

### RUN 17 — THE TWEAK DID THE ARITHMETIC AND NONE OF THE WORDING (2026-09-22)

The places-left retry, pressed at last (`35675546785`, 01:23:01 → 01:31:48Z,
8m47s, **CANARY PASSED**). It published, it cost what it should, it preserved
everything it was supposed to — **and it shipped a live page that tells the
customer the opposite of the truth.** The harness is right and the product is
wrong, which is the first time round these two have come apart that way.

**THE ASK REALLY WENT THIS TIME**, which is run 14's own correction working:
`request.json` records 159 characters, sha256 `622547386217ef0c`, one non-ASCII
codepoint (U+2014 at index 95), `source: "CANARY_INSTRUCTION"`, and the run's
env block prints the same sentence. No default, no substitution.

**WHAT THE TWEAK DID, in full — ONE LINE of `src/routes/index.tsx`:**

```diff
           <DaySpaceLookup
             preferredDay={preferredDay}
-            bookingCount={Number(bookingCount ?? 0)}
+            bookingCount={6 - Number(bookingCount ?? 0)}
             onPreferredDay={setPreferredDay}
```

26,276 → **26,280 bytes**, token multiset **6,990 → 6,992, ZERO lost, two
gained (`-` and `6`)**. `day-space-lookup.tsx` — the component that owns the
box, its heading and every sentence in it — is **byte-identical**
(`5330fca7b88e5ac1` on both sides), and so are `chord-diagram`
(`d0c20d52f91d69d2`), `trial-booking-form` (`4b66386c0ad46092`), `gear.tsx`
(`d580389f971cdd31`) and `prices.tsx` (`0d2d72dee56a2a71`).

**SO THE NUMBER IS RIGHT AND EVERY WORD AROUND IT IS NOW FALSE.** The
component still reads `bookingCount === 0 ? "No bookings on this day yet — it
still has space." : "${bookingCount} booking(s) already on this day."`
**Measured in a real Chromium against the live site** (`x-site-version
01790040384165-wl5it5`, minted 01:26:24.165Z, inside the run's window; NAV 200,
**0 console errors, 0 failed requests**), with the REAL RPC answering:

> `POST /api/db/fretwork-1/data/rpc/bookings_on_day` → **200, body `0`** — and
> the box renders **"6 bookings already on this day."**

**AND THE FULL-DAY CASE IS THE DANGEROUS ONE.** It cannot be measured by making
bookings (that writes rows to a customer's site), so it was measured by
controlling what the RPC answers and reading what the LIVE shipped bundle
renders — same page, same JavaScript, same component, only the number ours:

| real bookings | `6 − n` | what the live box says |
|---|---|---|
| 1 | 5 | `5 bookings already on this day.` |
| 2 | 4 | `4 bookings already on this day.` |
| 5 | 1 | `1 booking already on this day.` |
| **6 (full)** | **0** | **`No bookings on this day yet — it still has space.`** |
| 7 | −1 | `-1 bookings already on this day.` |

**A FULL DAY NOW ADVERTISES SPACE.** The component's own lead paragraph —
*"Pick a day to see how many bookings already sit on it, so you can tell if it
still has space"* — is untouched and now describes something the box does not
do.

- **`sameProse` IS THE GUARANTEE AND HERE IT IS THE DEFECT.** The tweak rung's
  whole contract is *a tweak that moved the words is thrown away*, so the one
  rung that answered was **constitutionally incapable of relabelling text** —
  and this ask is nothing but a relabelling. Zero tokens lost is what a perfect
  `sameProse` pass looks like, and it is exactly the shape of the failure.
  *A guard that passes while the thing is broken*, in its purest recorded form.
- **AND THE WORDS IT NEEDED ARE IN A FILE THE RUNG CANNOT OPEN.** `runTweak`
  takes ONE page's source and answers ONE page's source; the sentences live in
  `-parts/day-space-lookup.tsx`. So the rung could not have completed this
  request by any answer it is able to give — **it reported success on work it
  was structurally unable to do.** This file already records *"a tweak cannot
  touch a component at all"* as a property of the transport; run 17 is what
  that property costs when the ask is aimed at a component.
- **THE ROUTER WAS RIGHT AND THE RUNG WAS WRONG, and those are two questions.**
  `intent=edit layer=page page=/ cost=2` in 36.3 s is the correct layer — the
  display-versus-enforcement fix worked, and this is its first live reading:
  run 12's identical-in-spirit sentence went to `rules`, this one went to
  `page`. **The defect is one rung below the routing decision.**
- **⚠ `changed: []` AND `moved: []` ARE NOT A CLAIM THAT NOTHING MOVED.** The
  tweak's success reply (`worker.js:23041`) carries **neither key**, and the
  merge builds both with `flat("changed")`/`flat("moved")` — an empty union
  over a body that never set them. `index.tsx` really moved. A reader taking
  those arrays as an inventory gets the opposite of the truth, which is the
  same cannot-tell-read-as-a-value shape as everything else here.

**WHAT IT COST, and the arithmetic closes exactly.** Route **2** + rung **8**
= **10**, and the balance moved **75 → 65**. `tweak: true`, `files: 37`,
`photos: 0`, `photosKept` absent, `photosRemoved` absent, `langs` both `fr` and
`es` `cached: true` with `missing: 0`, so no translation was charged. The one
usage record is `{model: "grok-4.6", in: 8314, out: 7627, cacheRead: 512}` —
7,627 output tokens for a four-byte change, because `runTweak` re-emits the
whole 26 KB page; that is what the 445.8-second fire-to-terminal is made of.

- **THE WATCH READ ITS OWN ANSWER**, which is the other half of run 14's patch
  proven live: *"settled after 445.8 s — a stored reply arrived (HTTP 200,
  `x-gf-edit: final`)"*, **polls 132, transient read failures 0**. The old
  `status === 200` watch would have ended here too (this reply is a 200), so
  **run 17 does not exercise the stored-503 case**; what it does prove is that
  `retries` is counted and printed and that the composer ran on a real body.
- **THE JOB'S OWN STATE SEQUENCE**: `claimed` (cost 0) to ~126 s, `routing`
  (cost 8) from ~140 s to ~422 s, `publishing` at ~436 s. **Recorded as
  intervals and NOT attributed** — the run-14 correction one day old is
  exactly about reading a gap like the 126 s as queueing when it also contains
  work.
- **NOTHING BACKEND MOVED.** `layers: ["page"]`, `lanes: []`, and the terminal
  body carries no schema, migration or backend field of any kind; the three
  components and two unrelated pages are byte-identical; `/`, `/gear` and
  `/prices` each `photos 0→0` with identical headings and identical word counts
  (474 / 63 / 46). The `bookings_on_day` RPC still answers 200. `fretwork-1` is
  still one of the four `incomplete` sites and this run did not touch that.
- **THE RENDER CHECK'S FINDINGS ARE DIFFERENT FROM RUN 11'S AND ARE NOT
  RESOLVED.** `checked 3, pages 3, partial: true`: `/` [phone] **`slow`**
  (`page.goto: Timeout 6000ms exceeded`) and `/prices` [phone] **`unmet`** (an
  outside connection). Run 11's `/` [phone] finding was React #418; this is a
  navigation timeout, a different kind. A separate browser load of `/`
  answered 200 with zero console errors, and **that settles neither** — there
  is still no before-render baseline, because the free half takes no render
  check. `deadSelectors` were the same two as run 11, 2 of 2 looked at.
- **⚠ WHAT THIS RUN DOES NOT ESTABLISH.** Whether the REWRITE rung would have
  got it right is untested — the tweak held, so the full writer never ran, and
  the `tsx` lane (the one that can open a component) was never reached. The
  photograph restoration and refusal behaviour is untouched again, this site
  serving none.

**THE FIX IS NOT A PROMPT.** The rung that answers first cannot express this
change, so the lever is the DOOR, not the wording: either a tweak whose target
page passes a component's props must decline when the ask is about what those
props MEAN, or the reply must say which file it could not open.
**⚠ AND "WHAT THOSE PROPS MEAN" IS NOT A QUESTION ABOUT THE CALL SITE, which
the first door assumed and the owner disproved through the real route the next
day** — see the closure correction below. A door built on prop TEXT is opened
by moving the calculation one line up the page.

**THE PAGE IS LIVE IN THIS STATE NOW.** Reverting it is one more paid edit, or
`restoreVersion` to the previous version — this file's own restore path, free.

### THE DOOR, BUILT — AND REBUILT FIVE TIMES BEFORE IT HELD (2026-09-22)

`partEligible` in `site-tweak.mjs`, gated inside `readTweak` **below
`sameProse` and above `tweakLint`** so each refusal keeps its own name.
**`sameProse` IS UNTOUCHED** — this is a second question asked beside it.

**⚠ THE FIRST THREE SHAPES WERE APPROXIMATE READERS AND EACH WAS BEATEN BY A
SPELLING, all five reported by the owner through the real edit route.** The
record of that is the value here, because the lesson is general:

1. **Compare the prop's TEXT.** Beaten by moving the arithmetic one line up:
   `const bookingCount = 6 - Number(rawBookingCount ?? 0)` with
   `bookingCount={Number(bookingCount ?? 0)}` byte-identical.
2. **Compare the prop's text PLUS the declarations it transitively reads.**
   Beaten by a reassignment: `let { data: bookingCount } = useRpc(…)` then
   `bookingCount = 6 - Number(bookingCount ?? 0)` — the call site untouched,
   **the declaration untouched**, the value changed.
3. **Compare the whole file's code tokens as a MULTISET.** Beaten by OPERAND
   ORDER: `Number(bookingCount ?? 0)` → `Number(0 ?? bookingCount)`, which
   **has the identical bag of tokens and always answers zero** — so a fully
   booked day again advertised space, through the real route, `ok: true`,
   `tweak: true`, zero full-writer calls.
4. **A real syntax tree, with a JSX subtree as ONE OPAQUE LEAF.** Beaten by
   BRANCH POSITION: wrap the element in a loading guard and swap the two arms,
   `cond ? <p>Checking availability</p> : <DaySpaceLookup …/>` becoming
   `cond ? <DaySpaceLookup …/> : <p>Checking availability</p>`. **Every
   statement, declaration, hook and prop expression byte-identical**, and the
   published page advertises availability exactly while the data is missing and
   shows the loading line once it arrives. `ok`, `tweak`, zero full-writer
   calls, the wrong source in both the compiler payload and the store.
5. **The same tree, each site's bag in place, but a bag of EXPRESSIONS.**
   Beaten by a component that takes NO PROPS: `preferredDay ?
   <TrialBookingForm /> : <p>Choose a day first</p>` with its arms swapped.
   Branch position really was recorded — and both arms collapsed to the same
   EMPTY bag, because there was no expression in either to record. `ok`,
   `tweak`, zero full-writer calls, the wrong source in both stores.

**⚠ AND THE FIFTH IS THE MECHANISM WORKING EXACTLY AS DESIGNED OVER A SUBTREE
WITH NOTHING IN IT** (owner: *"Preserve custom-component identity and
occurrence within its executable branch independently of whether it carries
props"*). Nothing about the fourth fix was wrong; what was wrong was that a
multiset of expressions is EMPTY for a prop-free component, so the thing being
positioned had no content to position. **THE BAG CARRIES IDENTITIES AS WELL AS
EXPRESSIONS NOW**: each of the site's OWN components contributes its own tag
wherever it is rendered, so identity and occurrence survive in the branch that
renders it whether or not it carries props.

- **ONLY THE SITE'S OWN, AND THAT LINE IS WHY ADDING MARKUP STAYS CHEAP.** The
  rung holds ONE page's source, so what it cannot finish is a change whose
  meaning lives in a file it cannot open. A kit component is settled inside the
  one file it already has — and keying every capitalised tag would make adding
  a `<Button>` a computation change, which is an ordinary visual tweak. The
  kit control asserts it and a mutant that widens the key dies on it.
- **TWO READERS, EACH ASKED THE ONE THING IT KNOWS, JOINED ON THE LITERAL
  SPECIFIER.** `localParts` owns the `-parts/` path convention and answers
  WHICH specifiers name a component of this site's; the PARSER owns the
  language and answers WHAT each import binds (`importsOf`, a ninth injected
  reader). The join is an equality on the raw specifier — which is the whole
  reason `localParts` now carries `spec` — so nothing re-implements either
  half. **ALL THREE CLAUSE FORMS COUNT**, default, `* as` and named: a form
  left out reads as a component this rung is free to move, and each has its
  own case. A namespace binds one name over many components, so MEMBERSHIP is
  the tag's root and the STORED identity is the whole tag.
- **⚠ WHAT IT REACHES, MEASURED: ZERO OF THE 324 CORPUS FILES.** The identity
  entry is added only where a source imports one of the site's own components,
  and the corpus imports none — it predates components, which this file
  already records. So every corpus file answers byte-identically under both
  readers, and the change's blast radius is exactly the pages that render a
  `-parts/` component.
- **THE NEWLY-DEARER CASE IS NARROW AND IS THE CONSISTENCY THAT WAS ASKED
  FOR**: adding or removing a PROP-FREE local component now escalates, as
  adding a propped one already did. Re-ordering two of them, wrapping one,
  adding plain markup and swapping a quoted attribute all stay cheap, because
  the bag is sorted and none of those leaves the tree.

**⚠ THE FOURTH IS THE ONE THAT SAYS THE DESIGN WAS RIGHT AND ITS JOIN WAS
NOT** (owner: *"Keep the parser. Preserve the association between executable
context, branch position and rendered JSX, including the props it receives"*).
Three earlier rounds each replaced a reader; this one kept it and fixed where
its two halves met. **Both halves were independently blind and either alone is
sufficient to miss this**: `sig` answered the identical string `"<jsx/>"` for
every JSX node, so a `ConditionalExpression` over two markup arms was unchanged
by swapping them; and the expressions rode in a MULTISET POOLED ACROSS THE
WHOLE FILE, so both arms' props sat in one bag wherever they stood.

**THE FIX IS THE JOIN, AND IT COLLAPSED TWO SIGNATURES INTO ONE.** Each JSX
site's own sorted multiset now rides **IN PLACE** inside the ordered signature
— `sig(jsxNode)` is `"<jsx:" + markup(node) + ">"` — so a subtree's contents
are recorded at the position the subtree stood in. **The whole-file union is
then strictly IMPLIED by that string**, which is why the second signature was
deleted rather than kept beside it: two copies of one thing is this
repository's own recorded drift, and a sweep would have called the survivor.
One signature `{shape}`, one refusal reason `compute`.

- **WHY THE CHEAP PATH IS UNTOUCHED**: a subtree's bag is invariant under
  exactly what a layout tweak does. A `<section>` wrapper carries no braced
  expression; re-ordering siblings re-sorts to the same list; moving a band
  between wrappers inside one tree never leaves that tree; a QUOTED attribute
  value never enters at all.
- **⚠ WHAT IT COSTS, MEASURED OVER THE REAL CORPUS RATHER THAN GUESSED.** The
  one case that becomes dearer is a BRACED-PROP element moved BETWEEN two
  executable JSX sites — two local render functions, say. **316 of the 324
  corpus files (97.5%) have exactly ONE executable JSX site**, so the case
  cannot arise in them at all; of the other eight, seven have two and one has
  six (`crm/records.tsx`).

**THE THIRD FAILURE SETTLES THE DESIGN, AND IT IS NOT AN EDGE CASE: A BAG OF
TOKENS CANNOT SEE ORDER, AND ORDER IS THE SEMANTICS.** `a ?? 0` and `0 ?? a`
are the same tokens and different programs, and so are `f(x,y)` / `f(y,x)`,
`a?b:c` / `a?c:b`, `a-b` / `b-a`. **No refinement of an unordered comparison
can express what an operand POSITION means**, so the multiset was DELETED
rather than given a rule for `??` — the owner's own instruction: *"remove that
assumption rather than add another exception for this expression."* The two
earlier rulings compound into one law: *"stop extending this into a homemade
JavaScript analysis engine one syntax case at a time"*, and **~380 lines of
that engine are gone** (`partProps`, `localBindings`, `closureOf`, `openTags`,
`propsIn`, then `computeOf`, `QUOTED_ATTR` and `CODE_TOKEN`). `localParts`
stays, because reading import specifiers is the page/component RELATIONSHIP
rather than an analysis of code.

**SO THE COMPARISON IS THE LANGUAGE'S OWN PARSER, AND NOTHING HERE PARSES
JAVASCRIPT** (owner: *"use established parsing tooling if needed; don't build
another approximate JavaScript scanner"*). `ts.createSourceFile` — the same
parser the compile step already runs over these files — builds the real syntax
tree, and ONE signature is read off it.

- **THE QUESTION IS ELIGIBILITY, NOT DETECTION, and it is settled by what the
  rung IS.** `runTweak` takes ONE page's source and answers ONE page's source.
  So on a page that renders the site's own components: **it may change what the
  page RENDERS — markup, ordering, styling, any QUOTED attribute value — and
  may not change what the page COMPUTES.** Everything in the first half is
  settled inside the one file it holds, which is exactly what `sameProse` and
  `tweakLint` already cover.
- **ONE SIGNATURE IN TWO REGISTERS, DIVIDING EXACTLY ALONG THAT LINE.**
  **OUTSIDE MARKUP** it is the ORDERED structure of every construct —
  statements, declarations, hooks and their arguments, in source order.
  **INSIDE MARKUP** a JSX subtree collapses to a sorted MULTISET of every
  expression it carries, **each keyed by its element's tag and the attribute it
  feeds**, and that string rides back into the ordered signature **at the
  position the subtree stood in**. A multiset because re-ordering or
  re-wrapping elements must stay free — `sameProse`'s own reason, one step over;
  keyed by tag and attribute because a value SWAPPED BETWEEN two components is
  a change even when the same expressions are still on the page; **in place**
  because otherwise branch position is invisible, which is the fourth bypass.
  **⚠ AND THE TWO KEYS ARE SEPARATELY LOAD-BEARING AND A RED CHECK HAD TO SAY
  SO.** The obvious pair — `<Band count={n} /><Band total={6} />` with the
  values swapped — proves the ATTRIBUTE half alone, since `count` and `total`
  are already two keys; the TAG is load-bearing exactly when two DIFFERENT
  components are fed the SAME attribute name. A mutant dropping the tag
  survived the whole guard until that shape was written.
- **ORDER IS RECORDED BY CONSTRUCTION, which is why the reported case needed no
  rule of its own** — and why two shapes nobody enumerated fall out free: a
  flipped ternary and a swapped argument list are caught by the same code, with
  nothing written about either. **All six spellings are ONE answer.**
- **⚠ `forEachChild` STOPS ON A TRUTHY CALLBACK RETURN, and the prototype
  walked exactly ONE CHILD of every node** because `kids.push(…)` answers the
  new LENGTH. **All four bypasses read as ELIGIBLE against a comparison that
  was structurally correct and had simply not looked** — the worst-shaped
  failure available, since nothing disagreed with anything. The guard drives a
  shape whose difference is in the SECOND operand, so a re-introduction cannot
  pass.
  **AND THE SECOND CALLBACK IS GONE WITH THE POOL** — `walk` was the file-wide
  bag's own walker, and the recorded "two callbacks spelled alike while only
  one is load-bearing" trap went with it. What survives from that finding is
  the rule: `kids.push(…)` answers a LENGTH, so a concise body in a
  `forEachChild` callback halts the walk after one child.
- **A QUOTED ATTRIBUTE VALUE NEVER ENTERS THE BAG**, which is what keeps
  `className="text-xl"` → `"text-3xl"` — this repository's own encoding of
  *make the heading bigger* — on the cheap path. **A BRACED value always
  does**, because that is where computation lives. Asserted in both
  directions from one instrument.
- **AND A STRING THAT IS NOT AN ATTRIBUTE VALUE IS COMPUTATION.**
  `useRpc("bookings_on_day")` → `useRpc("bookings_two")` changes which data a
  component receives; `sameProse` correctly does not cover it, because
  `extractText` reads an identifier-shaped string as an identifier. The tree
  carries it in `outside` with no rule about strings at all.
- **THE SCOPE IS MOST OF THE PLATFORM, AND IT IS A MUTANT.** A page that
  renders NONE of the site's own components is not asked this question at all,
  so every tweak on such a page behaves byte for byte as before. Cutting that
  scope in either direction dies.
- **⚠ CANNOT-TELL FAILS CLOSED, AND THE PARSER IS THE CANNOT-TELL.**
  `typescript` is a **devDependency**: the CONTAINER resolves it from the
  template's own install, and the Worker is bundled from `npm ci --omit=dev`,
  so `tweakParser()` answers `null` there — **the ordinary state of one of the
  two places this module runs**, driven rather than reasoned about. With no
  parser there is no claim to make, so on a component-bearing page the rung is
  not eligible and the request goes to the writer that can open both files.
  **It costs a rewrite, never a wrong publish.** The loader is cached, its
  specifier assembled at runtime so a bundler cannot statically resolve it, and
  **an unparsable source is its own reason (`unparsed`) rather than wearing the
  runtime's** — two facts, two names, because only one is about the runtime.
  A namespace import still counts as rendering the site's own component.
- **THE PARSER IS INJECTED AND `computeShape` KNOWS NO TypeScript API** — NINE
  small readers are handed in (`importsOf` joined them for the sixth bypass),
  so the decision stays in the module and the dependency sits at its edge.
- **⚠ WHAT IT COSTS, AND THE COST MOVED — AN IMPROVEMENT RECORDED RATHER THAN
  A SILENT ONE.** Under the multiset, **ADDING markup escalated**: a bag cannot
  tell a JSX tag from an identifier. A real tree can, so **wrapping in a
  `<section>` and adding plain markup are now CHEAP**, and the assertion is
  kept pointing the other way so the day somebody narrows the instrument that
  line says what changed. What still escalates: a component-bearing page whose
  computation really moves, including a rewritten BRACED value anywhere in the
  markup (`className={cn(…)}`), at the rewrite plus ~1 credit. **Renaming a
  QUOTED attribute stays invisible** — the same class the old rule called a
  choice, so consistent rather than newly blind. **AND THE FOURTH ROUND MOVED
  IT ONCE MORE, IN THE OTHER DIRECTION**: a braced-prop element moved BETWEEN
  two executable JSX sites now escalates, which **316 of 324 corpus files
  (97.5%) cannot exhibit at all**, having exactly one such site.
- **⚠ `inPart` IS ALWAYS FALSE ON THE ROUTE TODAY — MEASURED, AND SAID IN THE
  CODE.** `target` is found in `eSrc`, which is `loadSiteSourceForEdit` → the
  PAGES store, so no reachable `target.path` is a `-parts/` file. It is
  **DERIVED (`!!partNameOf(target.path)`) rather than written as `false`**: a
  literal would be a latent wrong answer the day a component becomes a tweak
  target. A belt that cannot fire, named as one.
- **BOTH FORWARDING HOPS ARE DRIVEN, `parse` AND `inPart`**, because a value
  computed and never forwarded is this repository's most repeated defect and a
  cut there leaves every module case passing while the route looks at
  `undefined`. **The `parse` case uses the ORDER-ONLY shape deliberately** — a
  difference invisible to anything but a real tree, so it cannot pass by
  accident on a comparison that never ran — with an ordinary visual tweak
  through the same hop as its control.
- **ALL SIX SPELLINGS GO THROUGH THE ROUTE AND SHARE ONE BODY OF ASSERTIONS**
  (`doesNotPublish(slug, tweakSource, home, absent)`): did-not-publish, reached
  the component-capable writer, that writer was SHOWN the component's wording,
  the compiler payload (which carries **neither** arithmetic spelling **nor**
  `Number(0 ?? bookingCount)`), the stored source, the untouched neighbours.
  Written out six times they drift, and the one that drifts is the one nobody
  reads again.
  **⚠ THE FIFTH AND SIXTH NEED TWO PARAMETERS THE FIRST FOUR DID NOT, AND BOTH
  ARE THE SAME FACT.** Its BEFORE-SOURCE is the guarded page, not the ordinary one —
  the tweak is swapping a ternary, so a store holding a page with no ternary
  would be a different and much easier question. And **none of the shared
  negatives can see it**: the swapped page still carries
  `bookingCount={Number(bookingCount ?? 0)}` and none of the four arithmetic
  spellings, so every check the other cases lean on PASSES on the very page
  this one must refuse. `absent` names the ternary.
- **⚠ AND THE CLAIM IS SCOPED: SUPPLIED MODEL OUTPUT PROVES THE EXECUTION PATH,
  NOT THE ANSWER** (owner). The corrected pair is a stubbed answer, so what is
  established is that a request of this class is **not published by the rung
  that cannot finish it** and **reaches the writer that can open both files** —
  never that a real model writes a correct component once it gets there.
- **EVIDENCE**: `test/edit-page-contract.test.mjs`, **24 cases**, on run 17's
  OWN artifact — `index.before.tsx` **26,276 chars / 26,288 bytes, sha
  `129b54600bd30720`** and `day-space-lookup.before.tsx` **1,466 / 1,468, sha
  `5330fca7b88e5ac1`**, the published answer DERIVED from the before-source by
  its one line and **verified BYTE-IDENTICAL against the run's own
  `after/source.json`** at **26,280 chars / 26,292 bytes, sha
  `fbbb0de00096c3b2`**, and **the instruction's own sha (`622547386217ef0c`,
  159 chars, one U+2014)** asserted. **⚠ EVERY LENGTH HERE IS A CHARACTER
  COUNT, NOT A BYTE COUNT** — the page carries em dashes, so `String.length`
  reads 26,276 where `wc -c` reads 26,288; one reader is used on both sides, so
  every comparison is sound and only the LABEL was ever wrong.
  **THE OPERAND AND BRANCH FIXTURES EACH ASSERT THEIR OWN BAG IS UNCHANGED**,
  so neither can drift into testing something else: a fixture whose multiset
  moved would be one of the other four wearing its name.
  **8 mutants killed, a comment-only control survived** on the FIFTH round
  (the identity entry, the join cut at either end, `inPart` unforwarded,
  `localParts` dropping `spec`, default-imports-only, the namespace root, the
  widened key, and the swallowed cannot-tell), both files restored
  byte-identical from a SCRATCHPAD backup, never `git checkout`.
  **⚠ AND THAT ROUND'S FIRST PASS WAS 7 KILLED AND 1 SURVIVED, AND THE
  SURVIVOR WAS THE DESIGN BEING WRONG RATHER THAN A GUARD GAP.**
  `ownComponentTags` CAUGHT a parser that could not answer and returned an
  EMPTY SET, on the reasoning that the expression half still holds so only
  this one wall is lost. Cutting the catch survived — and reading what the
  mutant DID rather than what it was meant to do says the mutant is better:
  swallowing it is the identity half **silently off**, which is the exact
  class of defect this round exists to close, one layer down. It THROWS now
  and `partEligible` answers `unparsed`, which refuses. *Cannot-tell fails
  closed* was already this file's law and the first cut broke it inside the
  fix for a defect of the same shape. Both shapes are driven — a reader that
  is missing and one that throws are the same absence — with a page that
  imports no local component as the control, since it never needed the reader.
  **⚠ AND THE FOURTH ROUND'S FIRST PASS WAS 6 KILLED AND 2 SURVIVED, AND BOTH
  SURVIVORS WERE REAL GUARD GAPS RATHER THAN INERT MUTANTS — MEASURED, WHICH IS
  THE RULE.** Dropping the TAG from the bag's key, and dropping the `.sort()`,
  each survived because the fixture standing for it could not tell the two
  readings apart: the value-swap pair used `count` and `total` on **two of the
  SAME component**, so the attribute key alone separated them; and the reorder
  control used two elements carrying **NO braced prop at all**, so the sort was
  invisible to it. One measurement named each discriminator — the same
  attribute name on two DIFFERENT components, and two BRACED-PROP elements
  re-ordered — and both close with one assertion. *A fixture too shallow to
  separate the two readings*, twice in one file, found by the sweep and not by
  reading the code.
- **SUITE 7,143, BOTH HALVES TAKEN** — locally `# tests 7143 / # pass 7143 /
  # fail 0 / # skipped 0`, `duration_ms 109,853`, and CI on `a208a86a` at
  **`# tests 7143 / # pass 7139 / # fail 0 / # skipped 4`** on BOTH unit runs,
  **`35764802081`** (116,373 ms) and **`35764804869`** (115,978 ms). **THE
  TOTAL IS WHAT MATCHES**, `pass` differing by exactly CI's own four skips.
  **AND `site build` RAN TWICE AND BOTH READ ALL TWELVE COUNTS GREEN,
  IDENTICAL LINE FOR LINE** — runs **`35764802100`** (19m45s) and
  **`35764804818`** (25m54s): TAP 397/397/0/0, kit-typecheck 4, site-build 382,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all
  passed`, the census closing 7 + 4 + 1 = **12** on each. The two known
  annotations sit directly above their own `ok` lines on both, and `tsc`-format
  lines read 9 / 2 prefixed / **7** plain on both.
  **⚠ GITHUB FIRED EACH WORKFLOW TWICE FOR ONE PUSH**, two seconds apart, both
  `event: push`, `run_attempt: 1`, with ONE remote ref at the sha — the push
  before it got one of each. **The cause is not visible from here**, and it is
  recorded rather than explained.
  **AND THAT DUPLICATE IS THE CONTROL THIS FILE'S TIMING RECORD NEVER HAD.**
  Same tree, runners started three seconds apart, and **`site-build.mjs` took
  846 s on one and 1,122 s on the other — 14m06s against 18m42s, 4m36s
  apart**, wider than the whole 17m06s–19m35s range four earlier rounds wrote
  down as "recorded rather than explained". **So that step's duration is a fact
  about the runner and says nothing about the change**, which is now a
  measurement rather than an inference; 14m06s is also the shortest reading of
  the step on record. **The +4 is the difference between two measured readings**,
  7,139 → 7,143, and it is exactly the four new CASES: the prop-free route
  case, the two-different-components control, the identity instrument case and
  the `inPart` join case. **The clause-form and cannot-tell assertions moved
  the count by ZERO**, going into cases that already existed.
- **THE PREVIOUS ROUND'S READING, BOTH HALVES TAKEN: 7,139** — locally
  `# tests 7139 / # pass 7139 / # fail 0 / # skipped 0`, `duration_ms
  109,603`, and CI run **`35749485697` on `2318d4ce`** at **`# tests 7139 /
  # pass 7135 / # fail 0 / # skipped 4`**, `duration_ms 116,213`. **THE TOTAL
  IS WHAT MATCHES** — 7,139 both sides, `pass` differing by exactly CI's own
  four skips.
  **AND `site build` RUN `35749485669` READ ALL TWELVE COUNTS GREEN**
  (15:45:20 → 16:09:36Z, **24m16s**, all twenty steps): TAP **397/397/0/0**,
  kit-typecheck 4, site-build **382**, contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47, and kit-render /
  kit-a11y / kit-effects / kit-paint `all passed`. **The shape census closes**
  — `N passed` 7 + `all passed` 4 + TAP 1 = **12**. Every figure matches what
  is on record, so that round moved none of them. **`site-build.mjs` alone is
  1,052 s — 17m32s, 72% of the job**, inside the band the last three rounds
  read (17m06s · 17m57s · 19m35s) and recorded rather than explained.
  **⚠ AND THE TWO `##[error]` ANNOTATIONS WERE READ FOR WHAT THEY SIT BESIDE
  RATHER THAN COUNTED**: `index.tsx(50,13) TS2322` and `menu.tsx(27,17)
  TS2339`, each immediately followed by its own `ok` line — *"A TYPE ERROR NO
  LONGER STOPS THE SITE"* and *"a site with one bad page still reports the
  type error"* — inside the step that ends `382 passed, 0 failed`.
  **⚠ AND A READER COUNTING `tsc`-FORMAT LINES ANSWERS NINE WHERE THIS FILE
  SAYS SEVEN, AND SEVEN IS RIGHT**: GitHub emits each annotated line TWICE,
  once plain and once `##[error]`-prefixed, so a regex that does not exclude
  the prefix double-counts the two annotated ones. Measured: 9 total, 2
  prefixed, **7 plain**.
  **THE PREVIOUS ROUND'S READING IS KEPT: 7,137, BOTH HALVES TAKEN** — locally
  `# tests 7137 / # pass 7137 / # fail 0 / # skipped 0`, `duration_ms 111,873`,
  and CI run **`35742915576` on `70b9a041`** at **`# tests 7137 / # pass 7133 /
  # fail 0 / # skipped 4`**, `duration_ms 116,877`. **THE TOTAL IS WHAT
  MATCHES** — 7,137 both sides, `pass` differing by exactly CI's own four
  skips, which is this file's standing reading of that gap and not a
  regression.
  **AND `site build` RUN `35742915892` READ ALL TWELVE COUNTS GREEN**
  (14:48:47 → 15:15:08Z, **26m21s**, all twenty steps): TAP **397/397/0/0**,
  kit-typecheck 4, site-build **382**, contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47, and kit-render /
  kit-a11y / kit-effects / kit-paint `all passed`. **The shape census closes**
  — `N passed` 7 + `all passed` 4 + TAP 1 = **12**. Every figure matches what
  is on record, so this round moved none of them.
  **⚠ `site-build.mjs` ALONE IS 1,175 s — 19m35s, 74% of the job — AND THAT
  IS THE LONGEST READING OF THAT STEP ON RECORD**, against 17m57s the previous
  round and the 17m06s this file carries. **Recorded rather than explained**:
  every count matched, so it is runner speed rather than work skipped, and
  there is no per-step baseline from the earlier runs to attribute it to.
  The two `##[error]` annotations are present again and are the harness doing
  its job — `index.tsx(50,13) TS2322` and `menu.tsx(27,17) TS2339`, two of
  seven `tsc`-format lines inside the case that deliberately compiles a broken
  page, both sitting inside the step that ends `382 passed, 0 failed`.
  **The +3 is the difference between two measured readings**,
  7,134 → 7,137, and it is exactly the three new CASES — the operand-order
  route case, the no-parser case and the `parse` forwarding case. The other
  assertions this round added (four order-only pairs, the value-swapped pair,
  the bag-equality check, the payload's third spelling) went into cases that
  already existed and **moved the count by zero**, which is stated rather than
  left to look like nobody ran them.
  **THE PREVIOUS ROUND'S READING, BOTH HALVES TAKEN, IS KEPT**: locally
  `7134 / 7134 / 0 / 0`, `duration_ms 122,130`, and CI run **`35714595824` on
  `be0b9cee`** at **`7134 / 7130 / 0 / 4`**, `duration_ms 107,956` — **the
  TOTAL is what matches**, `pass` differing by exactly CI's own four skips.
  **AND `site build` RUN `35714595795` READ ALL TWELVE COUNTS GREEN**
  (10:11:19 → 10:35:51Z, **24m32s**, all twenty steps): TAP **397/397/0/0**,
  kit-typecheck 4, site-build **382**, contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47, and kit-render /
  kit-a11y / kit-effects / kit-paint `all passed`. **The shape census closes**
  — `N passed` 7 + `all passed` 4 + TAP 1 = **12**. **`site-build.mjs` alone is
  1,077 s — 17m57s, 73% of the job**, against the 17m06s this file records for
  the same step; every count matched, so that ~50 s is runner speed rather than
  work skipped, and it is recorded rather than explained.
  **⚠ AND THE CLOSURE ROUND'S CI HALF WAS READ AND NEVER COMMITTED**, which is
  the same absence one layer over: `d94eefdd` reads **`# tests 7134 / # pass
  7130 / # fail 0 / # skipped 4`** on unit run **`35708117349`**, and `site
  build` run **`35708117472`** came back **20m33s, all twenty steps green, all
  twelve counts matching**. **So the two rounds agree on every figure and
  differ only in the job's wall time** (20m33s against 24m32s) — a
  parent-and-current pair off CI, which is the strongest available form of
  *this change moved the suite by zero*.
  **⚠ AND A GREEN `site build` CARRIES TWO `##[error]` ANNOTATIONS, MET AGAIN
  HERE**: `index.tsx(50,13) TS2322` and `menu.tsx(27,17) TS2339` are two of
  seven `tsc`-format lines inside the case that deliberately compiles a broken
  page to prove *"tsc REPORTS; only `vite` refuses"*. A scan for red words
  answers two on a run whose conclusion is `success`, so read what an
  annotation sits beside rather than counting it.
- **THE WORDING IS VERIFIED BY RENDERING, NOT BY RE-DERIVING THE ARITHMETIC.**
  `test/fixtures/render-part.mjs` transpiles a `.tsx` with `ts.transpileModule`
  and renders it through `react-dom/server`, kit primitives stubbed to elements
  that carry no words of their own. **`typescript`, `react` and `react-dom` are
  root devDependencies AND in the lockfile** — the canary run-6 trap, checked.
  **The reader proves itself alive** against the SHIPPED pair's defect:
  `6 - 0` → *"6 bookings already on this day."* and `6 - 6` → *"No bookings on
  this day yet — it still has space."*
- **THE CORRECTED PAIR, MEASURED AGAINST THE OWNER'S OWN TABLE** with SUPPLIED
  counts (arguments, so no rows are created and no booking rule is touched):
  0 → **6 places left**, 2 → **4 places left**, 6 → **no places left**, and 7
  and 99 the same answer rather than a negative one. **LOADING AND FAILED NEVER
  ADVERTISE PLACES**, the state the old component could not express at all:
  `bookingCount` arrives as 0 both in flight and on failure, and zero is the
  fullest-sounding answer that box had. The word *booking* is gone from it,
  asserted rather than assumed.

**THE NEXT FIXTURE IS `chord-diagram`, PREPARED AND NOT DISPATCHED.** The gap
run 11 left open is *deliberate component MODIFICATION* — run 11 proved the
writer leaves components alone, which is a different claim from the writer
correctly rewriting one on request. `fretwork-1`'s `chord-diagram` (**3,861 b,
sha `d0c20d52f91d69d2`**) draws a muted string as the letter **`X`** and an
open string as **`O`**; the ask is that they become a drawn cross and a drawn
outline ring. **The router stays under test — neither the selected layer nor a
tweak fallback is promised.**

- **⚠ A TWEAK CANNOT TOUCH A COMPONENT AT ALL**, so the two outcomes are not
  symmetric: `runTweak` takes ONE page's source and answers ONE page's source.
  If `tweak: true` comes back **with a changed component**, the model of this
  path is wrong, not the run.
- **THE PLACEMENT IS THE CLAIM AND THE COUNT IS NOT.** *"7 crosses and 18
  rings"* is satisfied by a rewrite that draws them on the WRONG STRINGS of the
  WRONG CHORDS. Every check is keyed on `(chord, string index)`.
- **THE BASELINE RECONCILES FROM TWO INDEPENDENT SOURCES**, which is what makes
  it worth having: the page's own `CHORDS` array declares 8 chords, and a real
  Chromium against the live site reads **the same placement string-index by
  string-index on all eight** — **X 7, O 18, dots 23, finger numbers 23, 13
  lines each, 0 paths, 0 outlined circles, NAV 200, 0 console errors, 0 failed
  requests**, every dot `r=9 fill=currentColor`, every diagram 160×214.8.

  | chord | X at | O at | dots at |
  |---|---|---|---|
  | E major | — | 0,4,5 | 1,2,3 |
  | A major | 0 | 1,5 | 2,3,4 |
  | D major | 0,1 | 2 | 3,4,5 |
  | G major | — | 2,3,4 | 0,1,5 |
  | C major | 0 | 3,5 | 1,2,4 |
  | E minor | — | 0,3,4,5 | 1,2 |
  | A minor | 0 | 1,5 | 2,3,4 |
  | D minor | 0,1 | 2 | 3,4,5 |

- **ONE READER SERVES BOTH SIDES**, because after the change the marks are
  SHAPES and a letters-only reader would report the after side as an empty row
  — indistinguishable from a rewrite that deleted them. Anything above the nut
  (`y < 38` in viewBox units) is a mark; a `<circle>` with no solid fill is a
  ring, two `<line>`s or a two-`M` `<path>` is a cross, an `a`/`A` arc is a
  ring, and **anything else is NAMED as unclassified rather than guessed at**.
- **⚠ AND A SYNTHETIC FIXTURE FOUND TWO READER DEFECTS BEFORE ANYTHING WAS
  SPENT — both of which would have produced a FALSE FAILURE on a correct
  rewrite.** (1) An outlined ring drawn as a `<circle>` was counted as a
  fingering dot too, so the 23-dot census moved for a change that never touched
  a dot; a dot is now required to be BELOW the nut. (2) A ring drawn as an ARC
  PATH vanished **in silence**: the reader averaged the numbers in the `d`, and
  a relative arc's numbers are DELTAS, so it placed the ring at x≈8, `nearest`
  answered `-1`, and `-1` was dropped — *a false "the open marks are gone"*.
  Position comes from the browser's own `getBBox()` now, and a dropped `-1` is
  NAMED. **The observer is proved alive against all three spellings** (lines,
  paths, letters) before any zero it reports is believed.
- **THE FIVE ACCEPTANCE CHECKS** (the owner's own wording): the target's stored
  source changes while the other two components stay **byte-identical**
  (`day-space-lookup` `5330fca7b88e5ac1`, `trial-booking-form`
  `4b66386c0ad46092`); the 7 X and 18 O become drawn crosses and rings **on the
  same strings of the same chords**; the 23 dots, 23 finger numbers, chord
  names and fret positions are unchanged **by placement, not by aggregate
  count**; unrelated pages stay byte-identical and any home-page change is
  INSPECTED rather than auto-failed (the `CHORDS` array is asserted
  byte-identical, since a moved array would make a matching placement
  meaningless); and the result is confirmed in a real browser.
- **TWO WALLS THE PLACEMENT CHECKS CANNOT SEE ON THEIR OWN**, both asserted:
  the letters `X`/`O` must be **gone** from the page (a rewrite that draws
  shapes and leaves the letters standing satisfies every placement check), and
  **something must have been drawn in their place** (or "no letters" is
  satisfied by an empty row).
- **THE PREFLIGHT PAIR MOVED WITH DEPLOY 2143** (2026-09-22): the deploy
  itself reports `DEPLOY_ID` `a208a86a32eb0a048013fc401e94f01080a69059` and
  image `be869f142e052c8c`. **That is Wrangler reporting on itself, not the
  platform answering**, so the rule stands: **take BOTH numbers live off
  `/api/site/build-health` immediately before a dispatch** — the free half of
  the canary prints them — and a later merge invalidates them again. **It
  moved again with deploy 2144** — `33126616…` and `962824ede93e7706`, see
  *the replay prepared again* below.
  **THE EDIT-PATH FIXES OF 2026-09-21/22 ARE MERGED AND DEPLOYED** (the entry
  below), so a live press now exercises the door as it stands after the sixth
  reproduction, rather than the code every one of them was reproduced against.

### MERGED, DEPLOYED, AND THE PLACES-LEFT REPLAY PREPARED (2026-09-22)

**THE MERGE WAS A FAST-FORWARD** (owner: *"merge and deploy this reviewed
patch"*): `main` `3b555acf` → **`a208a86a`** at **18:44:52Z**, 26 commits, 17
files. **Asked before pushing, not assumed**: `main` had not moved (the branch
fast-forwarded onto it), GitHub listed **zero** runs in progress or queued, and
the image id was predicted over both ends (above, the fourteenth cross-check).
**THE ROLLBACK WAS VERIFIED BEFORE IT COULD BE NEEDED**: `git revert --no-commit
3b555acf..a208a86a` in a throwaway worktree gives tree **`5c99f4e8…` — `main`'s
own tree, byte for byte** — so a rollback is a tree the registry already holds
and its image step would say `reused 6b14851c0cd0c1c1`. **No prerequisite**:
no migration, no stored-state format, and `worker.js`'s only functional line is
the `inPart` forward.

**DEPLOY 2143 (`35769231051`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** 3m03s; the
image rebuilt and ROLLED (both ends as predicted, 184 inputs on its own
channel); **`No updated asset files to upload`**, so there is **no served-file
check** for this deploy — `public/` did not change; `Uploaded isibi-app`, a
fresh Worker version, `Deployed isibi-app triggers`. The unauthenticated gates
answered **401 / 401 / 401 / 404** at 18:48Z, which proves the Worker is up and
routing and says nothing about which code answers. **The runtime confirmation
is the canary's free press** (`/api/site/build-health`), the owner's press.

**THE REPLAY IS RUN 17 WITH ONLY THE CODE CHANGED** (owner: *"That remains
necessary to prove the real model changes the calculation and wording correctly
together"*). Same site, same stored source, **the same instruction byte for
byte** — `test/edit-page-contract.test.mjs`'s `ASK`: **159 characters, 161
UTF-8 bytes, sha256
`622547386217ef0cb7b4151358ffa1c3421ac91e7206b90612d342d7441b7193`**, one
U+2014 at index 95, straight double quotes at 4 and 29, byte-identical to run
17's own `request.json`. **PREPARED AND NOT DISPATCHED**: a session can neither
press (403, `actions: write`) nor restore (no token), and nothing is restored,
pressed or retried without the owner's approval.

**⚠ CORRECTED THE SAME DAY (owner), TWO POINTS.** The first cut named the
restore target by an APPROXIMATE TIME (*"about 06:27–06:31 UTC … pick it by
time"*) and filed the loading and error states under *"reported, not a pass
condition"*. **Both were wrong**: *"Identify the intended pre-run-17 version
from the saved evidence, not an approximate timestamp"*, and *"Missing, pending
or failed booking data must never advertise available places. Do not downgrade
these to observations outside the pass."* A time describes a row; it is not the
row's identity. And a property the fixed instruction does not state is still a
property the product owes.

**THE STARTING VERSION IS `01789972018761-6tng48`, FROM SAVED EVIDENCE:**

- **READ VERBATIM off the live `x-site-version` header at
  2026-09-21T20:40:27Z** — the last reading of it before run 17 posted. A
  version id's first 14 digits are its mint time in ms: **06:26:58.761Z**,
  inside run 11 (06:21:38 → 06:30:36Z), whose own log shows the job turning
  from `claimed` to `routing cost=20` between 06:26:43 and 06:26:57 — the
  reserve just before the compile, which is where `mintVersion` runs.
- **THE BODY CHAIN IS UNBROKEN.** The six saved complete source reads since run
  11 published — run 11's after (06:30:31Z), run 12's before and after
  (07:01Z, 07:02Z), run 14's before and after (09:16Z, 09:30Z) and run 17's
  before (01:23:38Z, 22 Sep) — are **byte-identical on all six bodies** (three
  pages, three components). **The control**: run 11's own before-read DIFFERS,
  at `index.tsx` (28,002 → 26,276 chars), so the comparison sees a change when
  there is one.
- **NOTHING THAT PUBLISHES RAN IN BETWEEN.** The only dispatches were run 15
  (the read-only lookup, 18 s) and run 16 (cancelled 15 s into its canary step,
  its instruction blank, so it filed only the zero-cost empty jobs); the
  balance read **75** at run 14's end and at run 17's start.
- **THE RESIDUAL, STATED.** Saved evidence cannot exclude a ZERO-COST republish
  in that 4h43m window that left all six bodies identical. The platform's own
  record that would close it is run 17's manifest `parent`, which the
  owner-only Versions route returns and nothing in the existing workflow reads.
  It does not weaken the replay: the starting SOURCE is re-verified after the
  restore, body by body.
- **IN THE VERSIONS PANEL, which shows a label and a LOCAL time and never the
  id**: the row labelled **"The home page shows nine beginner quotes in three
  stacked…"** (`versionLabel` over run 11's instruction as run 11's own log
  records it), **21 Sep, 06:26 UTC** in the viewer's own zone. It should sit
  directly under "Live now" (run 17's, *"The "Space on a preferred day" box
  counts bookings."*): **run 14's two refused publishes left no row**, because
  the zero-match refusal returns before `stageBuild` writes anything.

**THE ORDER, AND WHO PRESSES WHAT:**

1. **RESTORE AND READ — ONE PRESS, the owner, free** (owner, 2026-09-22: *"You
   do it and tell me what to run again"*). `edit-canary.yml` dispatched from
   **branch `claude/help-needed-ehlwlj`** — the mode exists there only — with
   `restore_version` `01789972018761-6tng48`, `expect_deploy`
   `a208a86a32eb0a048013fc401e94f01080a69059`, `expect_image`
   `be869f142e052c8c`, everything else at its default. It runs the free
   checks, finds the id in the site's own version list, posts the app's own
   restore call, waits for the site's `x-site-version` to read the id, and only
   then takes the inventory — see *the restore mode*, below. (Cloud → Versions
   → Restore in the app is the same call by hand.)
2. **THE HEADER — the session, free, no token.** `x-site-version` must read
   **exactly `01789972018761-6tng48`**; anything else stops the test.
3. **THE BODIES — the session, free.** **The press's preflight is the runtime
   confirmation of the SHA and the image** (both deploy readers,
   `async`/`runner` true), and **its artifact's `before/source.json` is the
   existing workflow's complete source read**: every page and component body is
   compared against run 17's before-read by a comparator that answers
   IDENTICAL, DIFFERS or UNREADABLE and was proven alive both ways — `index.tsx`
   `129b54600bd30720` (26,276 chars), `prices.tsx` `0d2d72dee56a2a71`,
   `gear.tsx` `d580389f971cdd31`, `chord-diagram` `d0c20d52f91d69d2`,
   `day-space-lookup` `5330fca7b88e5ac1`, `trial-booking-form`
   `4b66386c0ad46092`, and the same path set. **A matching visible sentence
   alone is insufficient.**
4. **THE BEFORE READING — the session, free.** The probe on the restored page,
   predicted from the before-source through the contract test's renderer: 0 →
   *"No bookings on this day yet — it still has space."*, 2 → *"2 bookings
   already on this day."*, 6 → *"6 bookings already on this day."*, and
   **every unknown state → *"No bookings on this day yet — it still has
   space."*** — the very defect the loading criterion names.
5. **THE PAID PRESS — the owner.** The same form on `main` — or on the branch
   with `restore_version` blank, since a named version turns spending off —
   with `spend` `yes` and the instruction pasted verbatim. **~22–30 credits**; balance **65** at run 17's
   end, and the free press prints the current one. **The run's OWN
   `before/source.json`, taken seconds before its POST, is compared too** — it
   is the edit's real starting source, and a mismatch makes the run something
   other than the replay, whatever it shows.

**THE INSTRUMENT, v2, PROVEN ALIVE BEFORE IT IS NEEDED.** A Chromium probe
answers `bookings_on_day` itself — **no row is ever written** — for 0, 2, 5, 6,
7 and 99 bookings, an answer that never comes, a 503 on every try (past the
site's two retries), a 404 and a 200 `null`; reads the box before a day is
chosen; and lets the real function through once, untouched, which is a read.
**It finds the box by BEHAVIOUR** — the date input whose fill fires the call;
the trial form's own date input is self-contained, and `useRpc` has no
`enabled` flag, so the call also fires on load with an empty day. **What a state
says** is the box's lines minus the lines present in every state (heading, lead,
label). **The classifier answers FAIL, MATCH or READ, and an unknown state can
never MATCH**: "does not advertise places" is an absence, and a pattern list
cannot prove one, so those lines are read verbatim. Proven both ways before any
live reading leans on it — 25 table lines and 22 states rendered through the
contract test's own renderer, the corrected fixture MATCHING all six counts and
the pre-run-17 and run-17 components FAILING all six — then live on today's
page (`01790040384165-wl5it5`, 19:31Z): **FAIL 10 · MATCH 0 · READ 1**, every
count and every unknown state failing exactly as run 17's recorded table
predicts, the no-day line READ, the real function **200 body `0`**, 0 console
errors, 0 failed requests. It lives in the session scratchpad
(`places-probe.mjs`, `places-classify.mjs` and its self-test,
`bodies-compare.mjs`); what it does is this paragraph, so any session can
rebuild it.

**THE ACCEPTANCE — EVERY ITEM MANDATORY, WRITTEN BEFORE THE PRESS:**

- **The request**: `request.json` carries the instruction whose sha256 is the
  one above, with `source: "CANARY_INSTRUCTION"`.
- **Published**: a stored reply, `ok: true`, and `x-site-version` moved to a
  version minted inside the run's window.
- **The one-file rung did not publish**: `tweak` is not `true`.
- **The wording, English `/`, against the owner's table**: 0 → six places left
  · 2 → four · 5 → **one place, singular** · 6 → full, **not** "still has
  space" · 7 and 99 → full, **never negative**. The count is of PLACES: *"…
  bookings already on this day"* appears in no state.
- **LOADING AND ERRORS**: pending, failed (503 and 404), missing (`null`) and
  no day chosen — **none may advertise available places**: no count of places
  of one or more, no "has space" or "available", no negative, no booking-count
  wording. **⚠ The instruction does not ask for this and the before-state fails
  it**, so a pass needs the writer to protect those states unprompted — which
  is the property the owner named, not a flaw in the test.
- **Scope, compared as BODIES out of the artifact, never off `preserved`**:
  `chord-diagram`, `trial-booking-form`, `gear.tsx` and `prices.tsx`
  byte-identical to the shas above; a file added or removed is inspected; the
  wording must change in `day-space-lookup` **or** the page must stop rendering
  it — the table decides and the choice is recorded; `index.tsx` changes are
  INSPECTED, not auto-failed.
- **Still working**: NAV 200, 0 console errors, 0 failed requests, and the
  UNINTERCEPTED `bookings_on_day` answering 200 with the box reading correctly
  for the real count.
- **An accurate customer reply**: `customer-reply.txt` — the browser's own
  composer, executed — with every claim checked against the artifact and the
  job record (the read-only lookup is free). *"Updated /"* beside a changed
  component is true; the problem list's three-of-N cut is a known quirk.

**Reported, not a pass condition**: what `/es` and `/fr` say (the open
*"strings outside the page source are never translated"* item; the probe reads
them with the classifier off); the cost against the band; and the router's
layer. **A routing prediction is a prediction about wording**: this sentence
went to `page` on run 17 and that is not promised — a `rules` answer could
change the site's database rules, and it would be recorded as what it is.

**WHAT EACH FAILURE WOULD MEAN, SO THE RESULT CANNOT BE READ BACKWARDS.**
`tweak: true` with the page's computation changed is **the door failing live**
— the top finding. `tweak: true` with only rendering changed passed the door
legitimately and did not do the work: a different gap, since nothing asks a
tweak whether it fulfilled the request. The rewrite ran and the wording did not
change: the real model's miss, with the component shown to it. **The rewrite
ran, the six counts MATCH and an unknown state advertises places: the writer's
miss on a property the instruction did not state** — a naive
`6 - Number(x ?? 0)` does exactly that, showing six places while the count is
still loading. Right wording and a doubled subtraction (the page's `6 −` and the
component's): the table catches it at 0 → *"0 places left"*.

**⚠ WHAT THE REPLAY CANNOT SHOW, SAID BEFORE IT RUNS.** `readTweak`'s `reason`
is on **neither the reply nor the trace** — the route reads it only to decide
`twSpent`, and the trace has no mark for the tweak at all, only for the
publish — so `tweak` absent beside `tweakUsage` present establishes that **a
tweak was tried and declined**, never **why**. A pass therefore proves the real
model changes the calculation and the wording together, which is what was
asked; that the DOOR is what declined stays evidenced by the contract tests
alone. Putting the reason on the wire would settle it, and it is a product
change that would need its own deploy before the press.

### RUN 18, AND THE RESTORE THAT MOVED INTO THE CANARY (2026-09-22)

**RUN 18 IS DEPLOY 2143'S RUNTIME CONFIRMATION** (`35780055225`, dispatched on
`main` at 20:24:12Z, free, canary step 23 s): `build-health 200
deploy=a208a86a32eb image=be869f142e052c8c`, `runtime 200 … async=true
runner=true`, both readers agreeing and both expectations matching. **The live
Worker answering, not Wrangler reporting on itself** — so 2143 is deployed AND
runtime-confirmed now. Balance **65**, unchanged since run 17.

**⚠ AND IT RAN BEFORE THE RESTORE, SO IT CANNOT BE THE STARTING-SOURCE CHECK.**
The site still reported `01790040384165-wl5it5` (three reads, 20:25:57 →
20:26:54Z), and the press's `before/source.json` is **byte-identical to run
17's AFTER on all six bodies** and **differs from run 17's before at `index.tsx`
alone** (26,276 → 26,280 chars, `129b5460…` → `fbbb0de0…`, run 17's one line).
Two facts rather than one: nothing on the site has moved since run 17, and the
comparator sees a difference when there is one — a live control in both
directions, on a real artifact.

**THE RESTORE MOVED INTO THE CANARY** (owner: *"You do it and tell me what to
run again"*). `POST /api/site/<slug>/versions/restore` is owner-gated and a
session holds no Supabase token; the canary already signs in as the owner. So
**`restore_version` is a MODE, like `read_job`** — `scripts/canary-restore.mjs`,
handed its three readers and holding no transport of its own:

- **ORDER IS THE SAFETY ARGUMENT.** Free checks first, so a Worker that is not
  the expected build — or a platform failing its own round trip — never has a
  version put back through it (`if (failed)` refuses above the call). Then the
  restore. Then the inventory, so the source read is of the restored site.
  **A restore that did not take STOPS the run above the inventory**: a read
  taken after it would be a perfectly good record of the WRONG site, read as
  the restored one.
- **IT POSTS ONLY WHAT THE SITE'S OWN LIST CARRIES.** An unreadable list — a
  503 CARRYING a list included, which is why the status is asked and not just
  the shape — an id the list does not carry, and a version saved without its
  script (`restorable: false`) all stop BEFORE the post. A site already on the
  version gets **no post**.
- **"DONE" IS THE SITE'S OWN HEADER, NEVER THE ROUTE'S `ok`.** `worker: false`
  (files back, script not up) is its own outcome, never folded into a slow
  roll; an answer naming another version is `wrong-id`; a header that never
  moves is `live-unmoved` after 40 reads 3 s apart. `x-site-version` is what
  the live script bakes, so it is the one reading that says what a visitor is
  served.
- **IT NEVER SPENDS.** The workflow holds `CANARY_SPEND` at 0 while a version is
  named — the read mode's own wall, one clause wider — and the script stops
  above `if (!SPEND)` too. A malformed id refuses with exit 2 **before the
  sign-in**, through the platform's own `isVersionId`, never a second copy of
  the shape, and nothing is repaired: a restore of "roughly that one" is the
  approximate-timestamp mistake this mode exists to close.
- **THE LIST CARRIES EVERY BUILD'S `parent`**, so the press also reads the
  residual recorded above — run 17's manifest parent — as a side effect: row 1
  should be `01790040384165-wl5it5` with parent `01789972018761-6tng48`, row 2
  the target. **Stated before the press; the press settles it.**
- **THE DISPATCH MUST NAME THE BRANCH.** The mode exists on
  `claude/help-needed-ehlwlj` only; a dispatch from `main` offers no box and
  runs the ordinary free checks. A branch dispatch runs the branch's script
  against main's Worker, which is exactly what the preflight checks.
- **EVIDENCE**: `test/canary-restore.test.mjs`, **19 cases** — the decisions
  DRIVEN over recording readers, the wiring a census over blanked comments.
  **18 mutants killed, 0 survived, 0 never applied, 2 comment-only controls
  surviving**, over the module, the canary and the workflow
  (`scripts/mutants/canary-restore.json`, the four canary guard files); all
  three files byte-identical to a SCRATCHPAD backup afterwards. **Suite 7,162
  locally** (`# tests 7162 / # pass 7162 / # fail 0 / # skipped 0`,
  `duration_ms 108,727`) — **+19 against the last measured reading of 7,143**,
  exactly this file's cases. **AND THE CI HALF MATCHES**: unit run
  **`35783295262` on `0f6c3903`** reads **`# tests 7162 / # pass 7158 / # fail 0 /
  # skipped 4`**, `duration_ms 115,660` — **the TOTAL is what matches**, `pass`
  differing by exactly CI's own four skips. **The stamp chain ends here**: every
  commit after it is documents only.

### RUNS 19–21 — THE RESTORE, AND THE REPLAY'S VERDICT (2026-09-22)

**RUN 19 (`35785143379`) RESTORED NOTHING, AND THE ENV BLOCK IS WHAT SAID SO.**
Dispatched from the branch with both expect boxes filled and `restore_version`
EMPTY (`CANARY_RESTORE:` blank), so it ran as an ordinary free press — a second
runtime confirmation (`a208a86a` / `be869f142e052c8c`, balance 65). **A blank
box and a mode that failed to run end the same way**; the missing `RESTORE`
section plus the env block is what separates them.

**RUN 20 (`35785850097`) IS THE RESTORE, AND EVERY PREDICTION CLOSED.** 14
versions listed; row 1 `01790040384165-wl5it5` with **parent
`01789972018761-6tng48`**; row 2 the target, labelled *"The home page shows nine
beginner quotes in three stacked…"*; **zero builds minted between the two** — so
the residual the saved evidence could not close is closed by the platform's own
record: nothing published between run 11 and run 17. POST 200 `{ok, id,
files: 37, swept: 0, worker: true}`, and the site reported the id on the FIRST
read (the session's own header poll agreed at 21:19:29Z). Then **all six bodies
byte-identical to run 17's before-read**, same path set (the control against
run 17's after DIFFERS at `index.tsx` alone), headings identical, words
474/63/46, photos 0, balance 65. **The before reading on the restored page:
FAIL 10 · MATCH 0 · READ 1**, every count and every unknown state in the old
booking-count wording exactly as predicted, the real RPC 200 body `0`, 0 console
errors, 0 failed requests.

**RUN 21 (`35787164840`, `main` at `a208a86a`, 21:31:30 → 21:40:35Z) IS THE
REPLAY. IT IS TWO RESULTS AND THEY ARE KEPT APART (owner): a real component
edit that succeeded, and an acceptance that stays OPEN.**

**1. THE SUCCESSFUL LIVE COMPONENT EDIT — recorded on its own.**

- **The request** ✓: 159 chars, sha256 `622547386217ef0c…`, `source:
  CANARY_INSTRUCTION`. **The run's own before-read** ✓: byte-identical to run
  17's before on all six (checked independently by the owner too).
- **The preflight** ✓, immediately before the spend: `build-health 200
  deploy=a208a86a32eb image=be869f142e052c8c`, `runtime 200 async=true
  runner=true`, both deploy readers agreeing, and BOTH expectations set on the
  form and matched — the live Worker answering, not Wrangler. **The harness's
  own `CANARY PASSED` is a verdict on the transport** (published, photographs
  and component NAMES kept), never on the acceptance list.
- **Routed** `intent=edit layer=page page=/` in 34.6 s, cost 2 — run 17's layer.
- **The one-file rung did not publish** ✓: `tweak` absent, `tweakUsage` `{in
  8314, out 53}`. 53 output tokens is far too few to hold the 26 KB page (run
  17's re-emission took 7,627), which is CONSISTENT WITH the tweak returning no
  page at all. **Its decline reason was not observed and is not claimed** — it
  is on neither the reply nor the trace. **The quick-writer guard is NOT
  reopened** by this run: nothing here is a new reproduction against it.
- **Published** ✓: a stored reply, HTTP 200 under `x-gf-edit: final`, after
  443.3 s (134 polls, 0 transient failures); the live header moved to
  **`01790112998238-ew6e7z`, minted 21:36:38.238Z**, inside the window. Job
  states `claimed` (cost 0) to ~229 s, `routing` (cost 15) from ~242 s,
  `publishing` at ~440 s — intervals, not attributed.
- **Cost: route 2 + edit 15 = 17, balance 65 → 48, the arithmetic closing
  exactly — BELOW the 22–30 band quoted before the press.** Two usage records,
  `8,314 in / 53 out` (the tweak's) and `20,208 in / 9,249 out`; `langs` fr and
  es `cached: true, missing: 0`, nothing translated.
- **ONLY `day-space-lookup` CHANGED** (1,466 → 1,488 chars, `5330fca7…` →
  `eccf4acc56f67a85`): `SLOTS_PER_DAY = 6`, `placesLeft = Math.max(0,
  SLOTS_PER_DAY - bookingCount)`, the lead *"how many places are left on it"*,
  the line `1 place left` / `${placesLeft} places left on this day.`
  **`index.tsx` is BYTE-IDENTICAL** (`129b5460…`); `chord-diagram`,
  `trial-booking-form`, `gear.tsx`, `prices.tsx` byte-identical ✓.
- **The wording, measured live with browser-answered counts, SEVEN of seven**:
  0 → *"6 places left on this day."*, 1 → *"5 places left"*, 2 → *"4"*, 5 →
  *"1 place left"* (singular), 6/7/99 → *"0 places left"* (never negative); the
  unintercepted `bookings_on_day` → **200 body `0`** → *"6 places left"*,
  correct for the real count; *"… bookings already on this day"* in no state.
- **So a real model, shown the component, changed the calculation and the
  wording together** — which run 17's rung could not do. That is the whole of
  what this half establishes.

**2. THE ACCEPTANCE STAYS OPEN: UNKNOWN DATA ADVERTISES PLACES (the finished
read-only verification, probe v3, 2026-09-22 ~22:00Z, `01790112998238-ew6e7z`,
28 page loads, every answer given by the probe in the browser, no row
written).** Four groups, reported apart:

| group | readings | verdict |
|---|---|---|
| successful counts (0, 1, 2, 5, 6, 7, 99) | 7 | **MATCH 7** |
| held: never answers (read at 1 s, 4 s, 10 s), answers after 4 s, a day switch whose new day is held | 8 | **FAIL 6** (every pending reading: *"6 places left on this day."*) · MATCH 2 (the answered phases) |
| upstream failures, read AFTER the site stopped retrying: 503/500/502/504/dropped connection (**3 calls each**, the router's 1 + 2 retries), 404 and 403 (**1 call each**) | 7 | **FAIL 7** — all *"6 places left on this day."* |
| empty responses: 200 `null`, 200 empty body, 204, 200 `[]`, 200 `{}` | 5 | **FAIL 5** — four read *"6 places left"*, `{}` reads **"NaN places left on this day."** |
| no day chosen | 1 | READ — *"Choose a day to check space."* |

- **THE DAY SWITCH IS THE EVERYDAY FORM OF IT**: a full day reads *"0 places
  left"*, and choosing another day shows *"6 places left on this day."* for as
  long as that day's count is loading, because `useRpc` has no placeholder and
  every new day is a new query.
- **THE CAUSE, RENDERED OFFLINE AS WELL** (`renderPart` over the SAVED
  component, fed the page's own `Number(bookingCount ?? 0)`): `undefined`
  (pending, failed), `null` (a 200 null, and a 200 with an empty body, which
  the kit's `send()` turns into `null`), `[]` and `""` all become `0` → *"6
  places left"*; `{}` becomes `NaN`. The component cannot tell unknown from
  zero because the page has already made it zero.
- **THE CONSOLE LISTENER WAS PROVEN LIVE** (one load answered 503: it saw the
  browser's own three `Failed to load resource … 503` lines), so "no other
  console error on 28 desktop loads" is a reading — and **settles nothing about
  the render check's phone-width #418 findings, which stay UNRESOLVED.**

**3. WHY THE WRITER DID NOT PROTECT THE STATES — two findings, both read out of
the code, and the second explains why a rules fix alone would not have reached
this site.**

- **THE STATE CONTRACT STOPS SHORT OF A SINGLE VALUE.** Lists have it
  (`GENERATOR.md` "Every list must handle four states", and the kit's
  `DataList`, which takes the QUERY rather than its data); outside connections
  have it (the digest's *"EVERY ONE OF THESE HAS THREE STATES"*, `useApi`
  only); members and the cart have it (`useMember` "render neither view until
  it settles", `cart.ready`). **A single value from `useRpc` has nothing** —
  while rule 11 names *"the slots left on a day"* as that hook's use. And the
  digest's own comment states the premise that failed here: *"A database read
  is local and fast enough that a page ignoring the wait looks fine"*. **For a
  count it does not look blank, it looks like a real answer.**
- **ON AN `incomplete` SITE THE PAGE REWRITE IS TOLD THE SITE HAS NO
  DATABASE.** The page rung resolves the database with `siteBackendBySlug`,
  which answers `null` for an `incomplete` site in the container (no
  `SITE_ROUTES`), so `eSpec = { tables: [] }` → `siteHasBackend` false →
  `pageRulesFor` returns the FRONTEND rules — **29,077 chars opening "THIS SITE
  HAS NO DATABASE … no useRpc", with rule 11 dropped** — for a writer rewriting
  a pair that calls `useRpc`. **Evidence**: that code path, and run 21's four
  wire problems are **byte-identical** to `lintPages` over the same page with
  `{ tables: [] }` (driven locally). **Not directly observed**: the prompt
  itself is not captured. The rules rung moved to the four-state reader on
  2026-09-21; the page rung did not. **Consequence: a rule added to
  `PAGE_RULES` alone never reaches fretwork-1's writer**, nor the other three
  `incomplete` sites'.

**THE PAGE IS LIVE IN THIS STATE.** The correction below is **merged and
deployed (deploy 2144, 2026-09-22) and NOT proven by a paid run** — no restore,
retry or paid press without the owner.

### THE CORRECTION, BUILT (2026-09-22, owner: *"Can you just fix what i told you to fix"*)

One change per finding, and **neither works without the other**: a rule that
reaches no writer is inert, and a writer reached without the rule is run 21
again.

**1. RULE 11 SAYS WHAT A FUNCTION'S ANSWER IS BEFORE IT ARRIVES.** One
paragraph inside rule 11 of `PAGE_RULES`: `useRpc`'s `data` is `undefined`
while the call waits and after it fails, and `null` when the function answers
nothing — none of them zero, none empty; never default it (`data ?? 0`,
`data || 0`, `data ?? []`, `Number(data)`, `{ data = 0 }`); waiting, failed
and nothing each get their own words; only a real answer may state a number,
"none left" or "has space"; and **a component that shows the answer takes the
QUERY (`{ isPending, isError, data }`) as its prop, never the bare number** —
run 21's defect lived in exactly that hand-off.

- **INSIDE RULE 11 IS LOAD-BEARING.** `hardRulesWithoutData` drops rule 11 as a
  unit, so the paragraph leaves the frontend prompt WITH the rule it belongs
  to. One rule over, it would reach every first build or none.
- **ONE BLOCK, EVERY WRITER THAT HAS A BACKEND.** `pageRulesFor` feeds the page
  call, a band and a component byte for byte, and the build, the edit rewrite
  and the addon all reach it. **The quick writer (`runTweak`) reads none of it
  and is untouched**, as instructed.
- **THE DIGEST'S OWN COMMENT WAS THE PREMISE THAT FAILED** — *"a database read
  is local and fast enough that a page ignoring the wait looks fine"* — and is
  corrected in place: for a count, ignoring the wait does not look blank, it
  looks like an answer.

**2. THE PAGE RUNG ASKS THE FOUR-STATE READER WHEN THE FAST ONE ANSWERS
`null`.** `siteBackendBySlug` stays the first question, so every site it
answers is handled exactly as before; only its `null` — the one answer that
collapses four facts — is asked again, of `siteBackendDetail`, the reader the
rules rung and the addon already use.

- **`incomplete` / `ready`** → the proven connection, and the spec read through
  `specForAddon` — the CATALOG first, so a missing `_meta` row is recovered
  READ-ONLY rather than read as an empty database. **`none`** → `{ tables: [] }`,
  as before. **`unreadable`** → 503, cost 0, `ours`, `backend:
  "derived-database-unreachable"`, and no writer call.
- **A CATALOG THAT CANNOT BE READ STOPS TOO** (503, cost 0, `backend:
  "unreadable:catalog-unreadable"`). It used to leave `eSpec` null and escalate
  `no-meta`, which the browser turns into the ~25-credit rewrite of every page.
- **⚠ THE FIRST CUT ASKED THE STATE AGAIN — `incomplete || ready` — AND A
  SWEEP SURVIVOR SAID WHY THAT WAS WRONG.** Its comment claimed the `ready` arm
  was reached when the fast reader held a cached `null` from before a database
  existed. **`makeCache` refuses to store a `null`** (*"never cache absence"*),
  so the fast reader re-asks every message and finds a new database itself:
  cutting the arm survived every case, and the case written for it was testing
  the fast reader. `ready` reaches the fallback only in a RACE — a backend
  repair landing between the two reads — and `siteBackendDetail` hands a
  connection back for `incomplete` and `ready` and never otherwise, so the check
  is `eBack.conn` alone now. *A comment describing a cache is not evidence the
  cache exists* — the `/changes?sync=` shape from the backlog, met on this
  change's own comment.
- **NOTHING IS WRITTEN.** The reference stays blank, and recording it is not
  this rung's job. The four `incomplete` sites' backend repair is still the
  owner's two presses each — this rung simply stopped depending on it. **⚠ AND
  THE HEAL THE OTHER RUNGS CALL MAY NEVER LAND FROM INSIDE THE CONTAINER** (read,
  not driven): `healSiteBackendDb` is a `PATCH`, and the job gateway's
  `SB_TABLES` admits no `PATCH` for any table — *"`PATCH` is nowhere, because no
  job patches a row"* — so from a job it answers a refusal that its own
  never-throw contract turns into a quiet `healed: false`. In the backlog.
- **AND A SIDE EFFECT IN THE RIGHT DIRECTION**: this rung's `lintPages` now
  reads the real schema, so on an `incomplete` site the reply stops calling the
  site's own function *"undeclared … the request is a 404"* — run 11's and run
  21's wire wording. Asserted, with the lint first proved to flag the same page
  over `{ tables: [] }`.

**⚠ AND ONE WRITER IS STILL TOLD THESE SITES HAVE NO DATABASE — the full
revise (read out of the code, NOT driven).** The build route's revise takes
`ownerConn` from `siteBackendRowFresh`, which answers `conn: null` for an
`incomplete` site, so `needsDb` is `!!spec.tables.length` alone: a revise whose
design declares no table (a colour change, a wording change) keeps `db` null,
`pageSpec = spec`, `siteHasBackend` false, and the FRONTEND rules — for a
rewrite of EVERY page. That is the browser's `up` fallback, the ~25-credit one.
**Not fixed here**: it is outside the approved correction, and the obvious fix
(ask `siteBackendDetail` when the row carries no connection) makes `needsDb`
true and so reaches `ensureSiteBackend`, which TRIES to heal the reference — a
write the owner has not approved, and one the job gateway may refuse anyway (the
next backlog entry). In the backlog.

**NOT BUILT, and said so**: the optional kit component, and the report-only
publish check (the proposal's item 3). **NOT ESTABLISHED**: that a real model
obeys the rule — every model answer in the guards is SUPPLIED, so what they
prove is that the rule is in the prompt and the prompt reaches the writer. **The
acceptance stays OPEN** until the owner's paid replay of run 21's exact
sentence — merged and deployed since, and prepared below.

**⚠ TWO PRE-EXISTING GUARDS WERE PINNED TO THE LINE THIS CHANGED, AND THEY
FAILED IN THE TWO DIRECTIONS THIS FILE RECORDS.** `site-tweak`'s window closed
on `const eDb = await siteBackendBySlug`; that line became `let eDb`, `indexOf`
answered -1, `slice(at, -1)` swallowed the rest of `worker.js` and the guard
**counted 145 answers** — and the sweep refused to start on the red baseline,
which is the runner doing its job. `site-ask`'s NEGATIVE check searched for the
same string and **went on passing about a string that existed nowhere**, the
silent half. Both re-anchored on what they assert, with their landmarks proved
present first, and each has its own mutant in the sweep (G-1, G-2).

**EVIDENCE.** `test/edit-page-rpc-state.test.mjs`, **8 cases**: the paragraph's
wording and its placement inside rule 11 (whitespace folded, since where a
hard-wrapped line breaks is layout), its presence in the full rules for both
kinds and a function-only spec and its absence from both frontend variants, its
reach through `pagesRequest`, `bandRequest` and `partRequest` as ONE block, and
five cases through `POST /api/site/<slug>/edit` with the tweak declining
(`incomplete`; a missing `_meta` row; `none` then a database; an unreachable
database; an unreadable catalog). **Red 8 of 8 against the pre-fix code**, run
in a throwaway worktree so the working tree was never touched.
**Sweep `scripts/mutants/rpc-state.json`: 14 mutants, 14 killed, 0 survived, 0
never applied, 2 comment-only controls surviving**, over `worker.js` and
`builder/page-gen.mjs`, against 15 files (`edit-page-rpc-state`,
`edit-page-context`, `edit-page-protect`, `edit-page-photos`, `edit-parts`,
`edit-page-contract`, `edit-rules-backend`, `edit-nobackend`, `page-gen`,
`page-bands`, `page-parts`, `frontend-build`, `wiring`, `site-tweak`,
`site-ask`); both swept files byte-identical to a SCRATCHPAD backup afterwards.
**The first attempt refused on a red baseline** (the `site-tweak` window above)
and **the second had one survivor** (the `ready` arm above); the third is the
tally. **Rules measured**: full **41,534 → 42,409** (+875, the paragraph
exactly), shopfront full **27,034 → 27,909**, frontend **29,077** and
**14,073** unchanged. **Suite 7,170 locally, taken twice** (`# tests 7170 /
# pass 7170 / # fail 0 / # skipped 0`, `duration_ms` 106,720 and then 106,382
on the committed tree, after a comment-only rewording proved comment-only by a
diff against the swept copy) — **+8 against the last measured reading of
7,162**, exactly this file's cases; the two re-anchored guards added
assertions, not cases. **AND THE CI HALF MATCHES**: unit run **`35794535805`
on `33126616`** reads **`# tests 7170 / # pass 7166 / # fail 0 / # skipped
4`**, `duration_ms 116,210` — the TOTAL is what matches, `pass` differing by
exactly CI's own four skips — and `site build` run **`35794535816`** (24m05s,
all twenty steps) read all twelve counts green out of its per-step files: TAP
397/397/0/0, kit-typecheck 4, site-build 382, contrast-cases 16, theme-seam 11,
theme-render 29, site-routing 14, site-runtime 47, kit-render / kit-a11y /
kit-effects / kit-paint `all passed`, census 7 + 4 + 1 = **12**; the two known
`##[error]` annotations each directly above their own `ok` line, `tsc`-format
lines 9 / 2 / 7, `site-build.mjs` 17m25s. **The stamp chain ends here.**

### MERGED, DEPLOYED, AND THE REPLAY PREPARED AGAIN (2026-09-22, late)

Owner: *"merge and deploy this bounded patch, then prepare the live test
without spending yet."*

**A FAST-FORWARD**: `main` `a208a86a` → **`33126616`** at **23:28:42Z** — 8
commits, 13 files: the correction, the canary's restore mode (runs 19–20 used
it from the branch; **a dispatch from `main` now offers `restore_version`**) and
the two documents. No migration, no `public/`, no build config. **Asked before
the push**: `main` unmoved, zero runs in progress or queued, the image id
predicted over both ends (the fifteenth cross-check), and the rollback
verified — `git revert --no-commit a208a86a..33126616` in a throwaway worktree
gives tree `d9bf69b5…`, `main`'s own, so a rollback reuses `be869f142e052c8c`.

**DEPLOY 2144 (`35797598989`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** 3m43s, cold
runner; image **built `962824ede93e7706`** (404, 184 inputs) and **rolled from
`be869f142e052c8c`** (`SUCCESS Modified application`); **`No updated asset
files to upload`**, so there is no served-file check; `Uploaded isibi-app`, a
fresh Worker version. Gates **401 / 401 / 401 / 404** at 23:34:27Z. fretwork-1
still serves `01790112998238-ew6e7z`. **The runtime confirmation is press 1's
preflight** — **taken 2026-09-23 by run 22** (`deploy=331266164a17
image=962824ede93e7706`, both readers agreeing), so 2144 is deployed AND
runtime-confirmed; see *runs 22–23* below.

**THE PRESSES**, all on `edit-canary.yml` **from `main`**, with
`expect_deploy` **`331266164a17c952b40807eeea8bcb43623cbbb5`** and
`expect_image` **`962824ede93e7706`**:

1. **RESTORE AND READ — free, the owner.** `restore_version`
   `01789972018761-6tng48`, everything else default. Predicted: both deploy
   readers at `33126616…`/`962824ede93e7706`, `async`/`runner` true, balance
   **48** unless something else spent; the version list's row 1
   `01790112998238-ew6e7z` with **parent `01789972018761-6tng48`** — the
   target is that parent, which is why run 21's prune kept it
   (`MAX_VERSIONS` 10 never takes the pointer's version or its parent); POST
   `worker: true`; the header reads the id.
2. **THE SESSION — free.** The header exact; `before/source.json`
   byte-identical to run 17's before on all six bodies (the comparator
   re-proved alive both ways on 2026-09-22: run 20's read IDENTICAL, run 21's
   after DIFFERS at `day-space-lookup` alone); probe v3 on the restored page —
   every count and every unknown state in the old booking-count wording, the
   no-day line READ — run 20's reading again.
3. **THE REPLAY — paid, the owner, no earlier than ~23:50Z** (15–20 minutes
   after the deploy finished at 23:32:27Z). `spend` yes, the instruction
   **verbatim** (sha256 `622547386217ef0c…`, 159 chars), `site` fretwork-1,
   `control` washhouse-3, `restore_version` and `read_job` blank. The run's own
   `before/source.json` is compared too.

**WHAT IS NEW IN THIS PRESS, AND WHAT THE WARNINGS CAN AND CANNOT SAY.** The
writer should now get the full rules (**42,409** chars, the new paragraph
inside rule 11) and a digest of fretwork-1's real schema, where run 21's got
the frontend rules (**29,077**). The prompt is not captured. **Run 21's four
"does not declare" problems disappearing shows only that this rung's LINT read
a spec naming those tables and that function.** **⚠ It does NOT prove the
writer received that context, and says nothing about whether the behaviour was
implemented** (owner, 2026-09-23) — the behaviour is settled by the browser
checks and nothing else. Still there means the rung's spec lacked those names,
which is a finding about the lookup.

**AND IT IS THE FIRST LIVE RUN OF THE LOOKUP.** `siteBackendDetail` resolving
an `incomplete` site inside the container has only ever run against fakes.
Read before the press: the job gateway admits both reads (GET on
`site_backends` and `site_project`, slug-bound, no embeds), and the addon's
runs 47–53 applied their schema to Neon from inside the container. **If it
fails**, the reply is a 503, cost 0, `backend: <reason>` — from the lookup
(`derived-database-unreachable`, `no-derivable-connection`, a failed read) or
from the spec read (`unreadable:<why>`, `permissions-unreadable`,
`unrecoverable-tables`) — so the routing call's 2 is the whole spend and
nothing publishes.

**THE ACCEPTANCE, FOCUSED (owner, 2026-09-23), EVERY ITEM MANDATORY:**

1. **Loading, failed and missing answers never display "6 places left".**
   (Held at 1/4/10 s and a day switch while held; 503, 500, 502, 504 and a
   dropped connection after the retries; 404; 403; 200 `null`, an empty body,
   204, `[]`, `{}`.)
2. **A successful count of zero displays six.**
3. **Counts 2, 5, 6 and above six produce 4, 1, 0 and 0.**
4. **The existing RPC and the unrelated pages and components are preserved**:
   `bookings_on_day` still called, answering 200 unintercepted with the box
   right for the real count; `chord-diagram`, `trial-booking-form`, `gear.tsx`
   and `prices.tsx` byte-identical. `index.tsx` and `day-space-lookup` are
   inspected, and `index.tsx` is EXPECTED to change.
5. **The actual customer reply and the browser behaviour are checked**:
   `customer-reply.txt` against the artifact and the job record, and the box in
   a real browser (NAV 200, console errors and failed requests counted).

**The run counts as the replay only if** the instruction's sha matches, its own
`before/source.json` matches run 17's before-read, and it published — those
decide whether this IS the test, not whether it passed. The probe prints every
state's line verbatim, so anything else an unknown state says is in the report
rather than silently passed.

- **THE INSTRUMENT CANNOT FAIL THE RULE'S OWN WORDS — measured**: *"Checking…"*
  and *"Couldn't check — try again"* classify READ with no advertisement;
  *"Not available"* classifies READ with the note *"claims the day is full
  while the count is not known"* — it advertises nothing, so it passes the
  mandatory item, and whether it reads well is a person's call.
- **WHAT EACH OUTCOME WOULD MEAN**: a 503 `backend` → the lookup, not the
  writer. `tweak: true` with the computation changed → the door failing live.
  The rewrite ran and an unknown state still displays "6 places left" → the
  behaviour failed; **the warnings being gone would NOT show the writer saw the
  rule**, since the prompt is not captured. The warnings still there → the
  rung's spec lacked those names, a lookup finding. A count wrong
  (0 → *"0 places left"*) → a doubled subtraction. Every reading passes → the
  acceptance closes **for this sentence on this site**, and says nothing about
  other wording.
- **COST, FROM MEASURED NUMBERS.** Run 21's edit was 15: the quick writer
  8,314 in / 53 out (~2.1), the full writer 20,208 in / 9,249 out (~12.0),
  rounded once. This press adds **+13,332 characters of rules** (~4,400
  tokens, ~1.1 credits) and a schema digest of unmeasured size; the output is
  about the same, because run 21's writer already re-emitted the whole page.
  **So route 2 + edit ~16–18 ≈ 18–20.** Dearer: the quick writer re-emitting
  the page before it declines (run 17's 7,627 output tokens, ~+5.7), or new
  page wording that needs French and Spanish (≥1 each) — perhaps ~30.
  **⚠ EVERY FIGURE HERE IS AN ESTIMATE, NOT A CAP** (owner, 2026-09-23):
  nothing enforces a per-request limit — `edit_reserve` raises only above
  100,000 — so the account balance is the only bound that binds. Cheaper: the
  lookup stops — 2. Balance **48**.
- **THE SAME LIMITS AS RUN 21**: the tweak's decline reason is on neither the
  reply nor the trace, the writer's prompt is not captured, and the guards'
  supplied answers prove the path, never the model.

### RUNS 22–23 — THE RESTORE HELD, AND THE HARNESS ROUTED BLIND (2026-09-23)

**RUN 22 (`35804550563`, free, `main`, 01:01:20 → 01:02:14Z) IS DEPLOY 2144'S
RUNTIME CONFIRMATION AND THE RESTORE.** `build-health 200
deploy=331266164a17 image=962824ede93e7706`, `runtime 200 async=true
runner=true`, both readers agreeing and both expectations matched: the live
Worker answering, not Wrangler. The version list carried **15** rows, row 1
`01790112998238-ew6e7z` with **parent `01789972018761-6tng48`** as predicted;
POST 200 `{ok, files: 37, swept: 0, worker: true}`; the site reported the id on
the FIRST read, and the session's own curl agreed at 01:03:22Z. **All six
bodies byte-identical to run 17's before-read**, same path set, and to run 20's
restored read; the control against run 21's after DIFFERS at
`day-space-lookup` alone (1,488 → 1,466 chars). **Probe v3 on the restored box:
FAIL 27 · MATCH 0 · READ 1** — every count and every unknown state in the old
booking-count wording, `{}` as *"NaN bookings already on this day."*, the no-day
line READ, the real function **200 body `0`**, 0 console errors and 0 failed
requests beyond the failures the probe served. Balance **48**.

**RUN 23 (`35805508645`, paid, `main`, 01:14:56 → 01:16:18Z) NEVER REACHED THE
EDIT.** The request was right (159 chars, the recorded sha) and so was the
starting source (all six bodies byte-identical to run 17's before). **The
router answered `intent=edit layer=page page=/book`** in 27.9 s — `6,631 in /
20 out`, cost **2** — and fretwork-1 has no `/book` (its routes are `/`,
`/prices`, `/gear`). The page rung answered `{ok: false, escalate: true,
reason: "no-page", cost: 0, page: "/book"}` in 11.7 s; nothing published (the
after-read is byte-identical to the before-read, the header still
`01789972018761-6tng48`), and the balance moved **48 → 46**. **It is not the
replay** — it did not publish — so the acceptance is untouched either way.

**THE CAUSE IS THE HARNESS, AND IT HAS BEEN THERE SINCE `aa96c976`
(2026-09-01).** `edit-canary.mjs` built its routing digest with `pages: []`.
`routeMessage` hands `site.pages` to `readRouting`, and `readEdit`'s check of
the router's page against the site's list runs only when that list is
non-empty — so every routing call the canary ever made was blind, and the
router named a page from the sentence alone (*"Book a guitar lesson"* heads the
home page). **Runs 17 and 21 routed the same sentence to `/` through the same
empty list — luck, not a reading.** The browser does not route blind:
`siteRoutesFetch` fills `site.pages` from `GET /api/site/routes?slug=`, and
`siteRoute` sends those paths capped at 24. *A fixture in a different shape from
reality*, in the harness this file calls the customer's own screen executed.

- **WITH THE LIST PRESENT, A PAGE THE SITE DOES NOT HAVE IS AN `addon`, NOT A
  `no-page`** — `readEdit` returns the fallback intent — so run 23's shape is
  unreachable from a browser that has its list. The canary's existing gate
  (`rd.intent !== "edit"`) refuses to spend on that answer.
- **THE FIX IS THE HARNESS'S ALONE.** `readRoutes` (`scripts/canary-watch.mjs`)
  reads that route with the browser's filter — a 2xx, `ok: true`, a `routes`
  array, only strings starting with `/`, capped at `MAX_ROUTER_PAGES` (24, the
  browser's number, read out of `chat.js` by its guard) — and the canary sends
  that list. **Cannot-tell refuses above the routing call** (`routesRefusal`,
  exit 1, nothing spent), because an empty list is the blind router and not
  "no pages". `routing.json` now records the digest the router was sent — run
  23's bundle had the answer and nowhere the list it answered from.
- **`tables: []` IS KEPT AND SAID**: it is what a browser sends for a site it
  adopted off the list (`fromRow` carries none); a browser that built the site
  sends the build's list. Not exposed by any run — the layer was `page` on all
  three.
- **EVIDENCE**: 5 new cases (4 driven in `test/canary-watch.test.mjs`, 1 wiring
  census in `test/edit-canary.test.mjs` that asserts the condition as well as
  the call, since `if (false)` keeps every landmark). **Sweep
  `scripts/mutants/canary-routes.json`: 10 mutants, 10 killed, 0 survived, 0
  never applied, 2 comment-only controls surviving**, over 4 canary guard files;
  both files byte-identical to a scratchpad backup afterwards. **Suite 7,175
  locally** (`# tests 7175 / # pass 7175 / # fail 0 / # skipped 0`,
  `duration_ms 107,036`) — **+5 against 7,170**, exactly these cases.
- **NOT MERGED, AND IT NEED NOT BE FOR THE NEXT PRESS**: a dispatch from the
  branch runs the branch's script against main's Worker, which is what the
  preflight checks — run 20's precedent. `scripts/**` is in `paths-ignore`, so
  a merge of this would deploy nothing either.

### RUN 24 — THE REPLAY: THE STATES HOLD, AND THE ANSWER IS NEVER CHECKED (2026-09-23)

**`35807954856`, paid, dispatched from `main` (01:50:31 → 02:02:41Z)** — so
the OLD blind harness (`pages: []`), and the router answered `intent=edit
layer=page page=/` in 38.1 s (`6,631 in / 19 out`, cost **2**) — the same
luck runs 17 and 21 had. **So run 24 is no reading of the corrected harness**:
that stays on the branch, and a press that should use it is dispatched from
the branch until it merges (owner: *"Retain the corrected harness for future
runs"*). **It IS the replay**: the request's sha is the recorded one (159
chars), its own before-read is byte-identical to run 17's on all six bodies,
and it published. Job states `claimed` (cost 0) to ~345 s, `routing` (cost 22)
from ~358 s, `publishing` at ~643 s, a stored 200 under `x-gf-edit: final` at
**646.5 s** (190 polls, 0 transient) — intervals, not attributed. The live
header moved to **`01790128661913-dafwjz`**, minted **01:57:41.913Z**, inside
the window.

- **COST: route 2 + edit 22 = 24, balance 46 → 22, closing exactly.** `tweak`
  absent, `tweakUsage` **8,314 in / 7,602 out** — this time the quick writer
  re-emitted the whole page before it was declined (run 21's was 53 tokens), so
  the edit landed in the quoted "dearer" band; its decline reason is still on
  neither the reply nor the trace. The full writer: **24,652 in / 9,410 out**.
  `langs` fr/es `cached, missing 0`.
- **TWO FILES CHANGED, FOUR BYTE-IDENTICAL.** `index.tsx` 26,276 → 26,248
  chars (`e8a2a0a6fc68f6ea`), two lines: the `useRpc` result is kept WHOLE
  (`const bookingsOnDay = useRpc(…)`) and passed as `query={bookingsOnDay}`
  instead of `bookingCount={Number(bookingCount ?? 0)}`. `day-space-lookup`
  1,466 → 1,932 (`4b162037f67df545`): takes `query: {isPending, isError,
  data}`, shows `Checking…` / `Couldn't check — try again` / `Not available` /
  `Six places left.` / `N places left.` / `1 place left.` / `None left.`
  `chord-diagram`, `trial-booking-form`, `gear.tsx`, `prices.tsx` unchanged.
- **THE BOX USES THE RULE'S OWN EXAMPLE WORDS VERBATIM** — *"Checking…"*,
  *"Couldn't check — try again"*, *"Not available"* are rule 11's three
  examples. That is **strong evidence the rule reached the writer**, which the
  vanished warnings alone could not be; the prompt is still not captured.
  `problems` is **0**: run 21's four *"does not declare"* warnings are gone,
  which is the new lookup's FIRST LIVE READING on an `incomplete` site inside
  the container — the rung's lint read the real spec.
- **PROBE v3 ON THE LIVE BOX** (02:06Z, `dafwjz`, no row written): successful
  counts **MATCH 7 of 7** — 0 → *"Six places left."*, 1 → *"5 places left."*,
  2 → *"4"*, 5 → *"1 place left."*, 6/7/99 → *"None left."*; held **READ 6 ·
  MATCH 2** (every pending reading *"Checking…"*, the day switch included);
  upstream failures **READ 7** (*"Couldn't check — try again"*, after the
  retries); empty responses **READ 4 · FAIL 1** — 200 `null`, empty body and
  `{}` → *"Not available"*, 204 → *"Couldn't check — try again"*, and **200
  `[]` → *"Six places left."***; the real function **200 body `0`** → *"Six
  places left."*, correct. No console errors, no failed requests beyond the
  probe's own. **Its five "empty" shapes are a sample, never a type census.**
- **⚠ THE DEFECT IS UNRESTRICTED `Number(data)`, NOT AN EMPTY LIST (owner:
  *"don't close the remaining issue as an empty-array exception"*).** The first
  write-up of this section called `[]` the one failing state — which was the
  PROBE'S list speaking, not the component. `placesLeftLabel` refuses
  `data == null` and a non-finite `Number(data)`, then does arithmetic on
  whatever `Number` made. **Reproduced free** against the saved component
  (`4b162037f67df545`, rendered with real React through `renderPart`):
  `[]`, `false`, `""` and whitespace → *"Six places left."*, `true` → *"5
  places left."*, `[2]` → *"4 places left."* — the owner's six, exactly — and
  beyond them `[0]`, `"0"`, `"\n"`, `-1` and `-0.5` → Six, `"3"` → *"3 places
  left."*, `[7]` and `"7"` → *"None left."*, `1.5` → *"4.5 places left."*.
  Only `{}` and `"abc"` (a NaN) are refused. **The render agrees with the live
  probe on every value both read** (`[]`, `{}`, `null`, the empty body, the
  seven counts); a 204 never reaches it as an answer, since TanStack turns
  `undefined` data into an error — the probe read *"Couldn't check"*.
- **TWO CLAIMS, KEPT APART (owner).** The saved generated component is
  DEFECTIVE for malformed answers — established. The real function sending
  one — **NOT shown.** Read twice at 02:27Z (a real day, and the empty day the
  page sends on load): **200, `application/json; charset=utf-8`,
  `content-range: 0-0/*`, a body of the one byte `0`** — PostgREST's scalar
  answer. `proxySiteService` returns the upstream status, content-type and
  body verbatim, and the kit's `send()` validates nothing: 204 → `undefined`,
  a body that is not JSON → `null`, a non-2xx → throws, anything else →
  `data`, as parsed. **The declared return type lives in the site's stored
  schema and in the digest line the writer is shown (`name(args) ->
  <returns>`), and no route serves either to a session**, so the contract is
  OBSERVED as a JSON integer, never read.
- **`Not available` classifies READ with the note *"may read as full"***: it
  advertises no places, so it passes item 1; whether it reads well is the
  owner's call, as recorded before the press.
- **THE CUSTOMER'S SCREEN**: *"✅ Updated /. I had a look at the finished
  pages: / threw an error and 2 pages reads something the check can't reach,
  so I couldn't see it with real data."* *"Updated /"* is true, and the rest
  relays the render check faithfully: `/` [phone] React #418, `/` and
  `/prices` `unmet` (by design). **⚠ BUT #418 IS UNRESOLVED (runs 11, 21 and
  24), so whether *"/ threw an error"* is true of a visitor's page is not
  established, and the reply is NOT verified as a whole (owner).**
  `deadSelectors` the same two as before.
- **THE VERDICT, KEPT NARROW**: items 2, 3 and 4 pass. Item 1 passes for every
  loading, failed and missing state and **fails on response-type validation** —
  a successful answer that is not a count is turned into one. Item 5 is open
  while #418 is. **The acceptance stays OPEN.** What is established is that a
  real model, given rule 11 through the page rung on an `incomplete` site,
  produced the query hand-off and the three states — for this sentence on this
  site, and nothing wider.
- **THE CORRECTION IS BUILT, MERGED AND DEPLOYED (deploy 2145, below) — NOT
  PROVEN BY A MODEL** (owner, 2026-09-23: *"Implement the bounded rule-11
  guidance correction now"*). Rule 11 already forbade `Number(data)` — as a
  DEFAULT, and the writer read it that way, converting after its null check.
  The sentence *"Only a real answer may state a number, "none left" or "has
  space""* now goes on: **a real answer is one that matches what the function
  is declared to return** (the digest prints it after the arrow), **checked
  before any calculation**; *"For example, a booking count is real only when
  `typeof data === "number" && Number.isInteger(data) && data >= 0`. That check
  is for a count, not for every function"* — one declared to return a price, a
  difference, a row or a list may rightly answer a decimal, a negative number,
  an object or an array, and is checked against its own declared type; **a zero
  that passes is a real answer** (test the type, never truthiness); anything
  that fails gets the "nothing" words; and **never convert** (`Number(data)` and
  `+data` turn `[]`, `""` and `false` into 0 and `true` into 1; `parseInt`
  reads `[2]` as 2). No parser, no kit component, no reporting change.
  - **Rules measured**: full **42,409 → 43,307** (+898), shopfront **27,909 →
    28,807**, frontend **29,077 / 14,073** unchanged.
  - **Guards** — `test/edit-page-rpc-state.test.mjs`, 8 → **12** cases: the
    wording, with the integer check asserted to occur ONCE in the whole prompt
    and only inside its *"For example … not for every function"* frame; the
    rule's own claims about JavaScript asserted true; reach through
    `pageRulesFor` (both kinds, a function-only spec), `pagesRequest` /
    `bandRequest` / `partRequest` (one block) and the real edit route's writer
    on an `incomplete` site, a recovered one and a site that gains a database;
    **the frontend prompts DERIVED byte-identical** — the addition cut back out,
    the frontend prompt derived from what is left and compared, because an
    absence alone cannot say *unchanged*; and run 24's stored component
    (`test/fixtures/run24/`, 1,932 chars, sha `4b162037f67df545`) reproducing the
    owner's six, beside **a SUPPLIED implementation** built from the rule's own
    example expression — hand-assembled, never a model's answer, so it proves the
    example check is sufficient for that component and nothing about whether a
    model writes it. **Red 8 of 12** against the unchanged rule text in a
    throwaway worktree (the four that pass: the older paragraph's case, two
    refusals that call no writer, and the fixture reading).
  - **Focused mutation check** `scripts/mutants/rule11-check.json`: **8
    mutants, 8 killed, 0 survived, 0 never applied, the comment-only control
    surviving**, against the one guard file — the requirement gone, the
    example's frame gone, the example made universal, `>= 0` dropped,
    `Number.isInteger` dropped, the zero clause gone, the conversion clause
    gone, and rule 11 let into the frontend prompt; `page-gen.mjs`
    byte-identical to its backup afterwards.
  - **Suite 7,179, BOTH HALVES TAKEN** — locally `# tests 7179 / # pass 7179 /
    # fail 0 / # skipped 0`, `duration_ms 128,347`, and CI unit run
    **`35829428954` on `821a60ac`** at **`# tests 7179 / # pass 7175 / # fail 0
    / # skipped 4`**, `duration_ms 118,250` — the TOTAL is what matches, `pass`
    differing by exactly CI's own four skips — with **all twelve of the guard
    file's cases matched BY NAME among the passing lines** of the downloaded
    log. **+4 against 7,175**, exactly the four new cases. The focused set
    (the fifteen files of the `rpc-state` sweep) re-run on the committed tree
    reads **615 / 615 / 0 / 0**. **AND `site build` run `35829428934`**
    (07:00:05 → 07:22:28Z, **22m23s**, all twenty steps) read all twelve counts
    green out of its per-step files: TAP 397/397/0/0, kit-typecheck 4,
    site-build 382, contrast-cases 16, theme-seam 11, theme-render 29,
    site-routing 14, site-runtime 47, kit-render / kit-a11y / kit-effects /
    kit-paint `all passed`, census 7 + 4 + 1 = **12**; the two known
    `##[error]` annotations each directly above their own `ok` lines,
    `tsc`-format lines 9 / 2 / 7, `site-build.mjs` 16m02s. **The rendered rules
    were re-measured on the parent (`3281c084`) and the commit in two real
    checkouts**: the full rules `e6f6b98731de6ec6` → `d36aeba09acc8a94`
    (42,409 → 43,307), shopfront 27,909 → 28,807, and **both frontend prompts
    byte-identical on both sides** (`e926db932bfd4666` 29,077 and
    `935cc9b048e4a270` 14,073) — a second instrument beside the derived
    comparison in the guard. **The stamp chain ends here.**
  - **WHAT IT DOES NOT DO.** The live `fretwork-1` still serves run 24's
    generated code (`01790128661913-dafwjz`) and nothing here repairs it: the
    rule reaches only a FUTURE page write (merged and deployed since;
    `page-gen.mjs` is an image input, so the image rolled). **#418 stays
    separate and unresolved.** And the acceptance stays OPEN until a paid run —
    the owner's call.

### MERGED, DEPLOYED, AND THE CORRECTION TEST PREPARED (2026-09-23)

Owner: *"Merge and deploy the reviewed change, preserving newer main commits
and the corrected route-list harness. Verify the actual deployed SHA and
container image. Then prepare the smallest live verification against Run 24's
current state."*

**A FAST-FORWARD, BECAUSE THERE WAS NOTHING NEWER ON MAIN TO PRESERVE.**
`origin/main` was unmoved at `33126616` (`HEAD..origin/main` empty), so `main`
`33126616` → **`0d5137f0`** at **07:33:58Z** — 7 commits, 11 files — keeps every
main commit by construction. **The route-list harness (`cd944888`) is on main
now**, so a dispatch from `main` routes with the site's real page list, as the
browser does. **Asked before the push, not assumed**: zero runs in progress or
queued; the image id predicted over both ends; and the rollback verified —
`git revert --no-commit 33126616..0d5137f0` in a throwaway worktree gives tree
**`bbdc2444…`, main's own**, so a rollback reuses `962824ede93e7706`.
`builder/page-gen.mjs` is the push's one product file and its one image input.

**DEPLOY 2145 (`35832383057`) — DEPLOYED, AND RUNTIME-CONFIRMED BY RUN 25
(below).** Job
**2m47s**, image step **2m01s** with **0 `CACHED` lines** (every layer rebuilt,
and faster than 2144's cold 2m56s — the timing says nothing about the diff),
Wrangler 18s.
- **THE SIXTEENTH IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH**:
  `origin/main` answered `962824ede93e7706` (the id run 22 read LIVE) and the
  tip `ce67f25d132667d0`, both from 184 inputs. The log answered `built
  isibi-app-sitebuildcontainer:ce67f25d***32667d0 (registry answered 404;
  ***84 inputs off ./Dockerfile)` and `- …:962824ede93e7706` →
  `+ …:ce67f25d***32667d0` under `SUCCESS Modified application`, `Applied
  changes`.
- **THE WORKER HALF**: `DEPLOY_ID: 0d5***37f0a7eba5***806d***b3063e87d57ef2092aa4`
  (the merge sha, masked), `Uploaded isibi-app`, `Current Version ID:
  05dc038b-…`, `Deployed isibi-app triggers`; **`No updated asset files to
  upload`**, so there is no served-file check. Gates **401 / 401 / 401 / 404**
  at 07:38:43Z.
- **WHY IT STOPS AT "DEPLOYED"**: both routes that return the sha and the image
  — `/api/site/build-health` and `/api/site/runtime` — ask `authUser` first
  (re-read in `worker.js` today), so the live Worker's own answer needs a
  signed-in press. **Press 1 below is that reading, and it has teeth**: the
  form's `expect_deploy` and `expect_image` refuse on any mismatch.

**THE PREPARED TEST IS A CORRECTION, AND A CORRECTION IS NOT THE GENERATION
PROOF** (owner: *"Don't treat those as the same proof"*).

- **(A) CORRECTING THIS COMPONENT — prepared.** From run 24's live state, one
  paid edit whose instruction NAMES the defect. It can establish that the
  deployed page rung — rule 11 in the prompt, the existing component shown to
  the writer — repairs the answer check on request without breaking what run
  24 got right. **It cannot establish that rule 11 did the work**, because the
  instruction alone asks for the fix. The instruction names the defect and the
  outcome ("only a real count") and deliberately leaves out the check, zero,
  the integer and sign conditions and the wording, so those have to come from
  somewhere — the rule's own example expression or zero clause appearing in
  the answer would be EVIDENCE the rule reached the writer, never proof.
- **(B) GENERATING A CORRECT COMPONENT FROM THE ORIGINAL REQUEST — not
  prepared.** That is run 24 again under the corrected rule: restore
  `01789972018761-6tng48` (free, the canary's restore mode), then replay run
  17's sentence byte for byte (sha `622547386217ef0c…`). Only (B) says whether
  a writer given *"count down the places left"* writes the answer check
  unprompted, which is what rule 11 exists for. It needs a restoration, which
  this step excludes. **~24 credits** (run 24's measured cost, band 17–30) plus
  the free restore.
- **A pass of (A) says nothing about (B).** A failure of (A) says the
  correction path fails even with the defect named, which is the stronger
  finding of the two.

**THE STARTING STATE, READ FREE TODAY.** Live `x-site-version`
**`01790128661913-dafwjz`** at 07:35:49Z — run 24's, nothing published since.
**Probe v4** is v3 with every group unchanged plus **MALFORMED ANSWERS**
(`false`, `""`, whitespace, `true`, `[2]`, `[0]`, `"0"`, `"3"`, `-1`, `1.5`,
`[7]`, `"7"`, `"abc"`, a non-JSON body), a count-claim note, and a
distinct-states line. Read twice against the live box, verdict lines identical:
counts **MATCH 7 of 7**; pending **"Checking…"**, failures **"Couldn't check —
try again"**, missing (null, empty body) **"Not available"** — **DISTINCT**;
malformed **FAIL 10**, plus `[]` in the empty group, so **11 wrong-kind answers
shown as availability**; `[7]` and `"7"` → **"None left."**, a count from a
non-count, not availability and flagged; `{}`, `"abc"` and a non-JSON body →
"Not available"; the real function **200 body `0`** → "Six places left.".
**The instrument is proven alive on the defect it must see go away**: it fails
today's box exactly where the offline render of the saved component said it
would.
**⚠ AND v4's FIRST CUT FILED `[]` AND `{}` AS "MISSING"**, so its
distinct-states line read NOT DISTINCT about a box whose three states are
distinct — the malformed `[]` was contaminating the missing category. Missing
is a null and an empty body; `[]` and `{}` are answers of the WRONG KIND.
Fixed in the instrument, not the product, and re-read. *A summary line is an
instrument too, and it can be wrong while every line under it is right.*

**THE PRESSES**, both `edit-canary.yml` from **`main`**, `expect_deploy`
**`0d5137f0a7eba51806d1b3063e87d57ef2092aa4`**, `expect_image`
**`ce67f25d132667d0`**, `site` fretwork-1, `control` washhouse-3,
`restore_version` and `read_job` blank:

1. **FREE — the runtime confirmation and the before-state.** `spend` no. The
   preflight reads the live Worker's sha and a cold container's image and
   refuses on a mismatch; prints `async`/`runner` and the balance; and
   `before/source.json` must be **byte-identical to run 24's after-read on all
   six bodies**: `index.tsx` 26,248 `e8a2a0a6fc68f6ea`, `day-space-lookup`
   1,932 `4b162037f67df545`, `chord-diagram` 3,861 `d0c20d52f91d69d2`,
   `trial-booking-form` 4,045 `4b66386c0ad46092`, `gear.tsx` 6,249
   `d580389f971cdd31`, `prices.tsx` 2,144 `0d2d72dee56a2a71` (the comparator
   re-proved both ways on run 24's artifact today).
2. **PAID — the correction.** `spend` yes, no earlier than ~07:55Z (15–20
   minutes after the deploy finished at 07:37:27Z), and the instruction
   **verbatim** — 197 characters, all ASCII, sha256
   `ab0e2144c0da4bfc0f7e597df908b13e544b9c05345985c81468d22c324ca4c2`:

   > The "Space on a preferred day" box shows places left even when the booking
   > lookup answers with something that isn't a number of bookings. Only a real
   > count of bookings should ever show places left.

**THE ACCEPTANCE — the original four, unchanged:**

1. **Malformed responses never become availability** — the fourteen malformed
   values plus `[]` and `{}`. `[7]`/`"7"` → "None left." is not availability
   and is REPORTED as a count from a non-count, since rule 11 lets only a real
   answer say "none left".
2. **A successful zero stays valid**: `0` → six places, and the unintercepted
   real function (which answers `0`) reads six.
3. **Loading, error and missing stay distinct**: one reading each, three
   different strings, none advertising.
4. **Unrelated files unchanged**: `chord-diagram`, `trial-booking-form`,
   `gear.tsx`, `prices.tsx` byte-identical; the fix belongs in
   `day-space-lookup`; `index.tsx` inspected, expected unchanged since the page
   already hands the component the query.

Beside them, as before: counts 1, 2, 5, 6, 7, 99 read 5, 4, 1 place (singular)
and none for the rest; the run COUNTS only if its request sha matches, its own
before-read matches run 24's after-read and it published. **#418 is reported,
never a pass condition.**

**WHAT EACH OUTCOME WOULD MEAN.** Rewrite published and all four hold: (A)
passes, for this component, this wording and this site. Some malformed value
still shown as places: the correction failed with the defect named and the
component shown. `0` → "Not available": a truthiness check, the zero clause not
followed. `-1` or `1.5` still shown as places: a type check without the
example's integer and sign conditions. States collapsed: a regression.
`tweak: true`: the one-file writer published without opening the component —
the door let it through and nothing did the work. A `rules` answer: not this
test, and it may change the site's database rules, recorded as what it is. A 503
`backend`: the incomplete-site lookup, not the writer. `addon`: the canary's
intent gate refuses to spend.

**COST, ESTIMATED FROM MEASURED RUNS — NOT A CAP.** Run 21 was route 2 + edit
15 (the quick writer declined in 53 tokens), run 24 route 2 + edit 22 (it
re-emitted the page first). This press differs by ~300 tokens of rules and a
component 466 characters longer, so **~17–24 credits, perhaps ~30** with a
correction round. Nothing enforces a per-request limit; the balance is the only
bound. **Balance 22 at run 24's end**: if press 1 prints under ~30, top up
first — a reservation refused partway stops the edit, and that tests nothing.

### RUN 25 — THE FREE PRESS: 2145 CONFIRMED, THE STARTING STATE EXACT (2026-09-23)

**`35842017069`, free, `main` at `0d5137f0`, 09:17:03 → 09:17:39Z, canary step
18 s.** `build-health 200 deploy=0d5137f0a7eb image=ce67f25d132667d0`,
`runtime 200 deploy=0d5137f0a7eb async=true runner=true`, both readers agreeing
and both form expectations matched — **the live Worker answering, not Wrangler
reporting on itself, so deploy 2145 is deployed AND runtime-confirmed.** The
two zero-cost async checks settled `{"ok":false,"escalate":true,
"reason":"empty","cost":0}`, as every free press does.

- **THE STARTING SOURCE IS EXACTLY RUN 24's AFTER-READ**: the artifact's
  `before/source.json` (`complete=true`, all three `reads` true) is
  **IDENTICAL on all six bodies, same path set** — `index.tsx`
  `e8a2a0a6fc68f6ea`, `day-space-lookup` `4b162037f67df545`, `chord-diagram`
  `d0c20d52f91d69d2`, `trial-booking-form` `4b66386c0ad46092`, `gear.tsx`
  `d580389f971cdd31`, `prices.tsx` `0d2d72dee56a2a71`. **The control**: the
  same comparator against run 24's BEFORE-read answers DIFFERS at exactly
  `index.tsx` and `day-space-lookup`, the two files run 24 changed.
- **The header agrees**: `x-site-version: 01790128661913-dafwjz` at 09:19:10Z.
  So probe v4's before-reading (this section above) still describes the live
  box — same version, same bodies.
- **Balance 22** — under the ~30 this section set as the top-up line, since
  route 2 leaves 20 and run 24's edit alone was 22. **The paid press is
  prepared and not made**; nothing has spent since run 24.

### RUN 26 — THE CORRECTION: ALL FOUR HOLD, AND IT LANDED ON THE PAGE (2026-09-23)

**`35842461500`, paid, `main` at `0d5137f0`, 09:21:35 → 09:29:41Z.** It counts
as the test: the request is 197 chars with sha256 `ab0e2144…` (`source:
CANARY_INSTRUCTION`), its own `before/source.json` is identical to run 24's
after-read on all six bodies, and it published — `x-site-version`
**`01790155568567-c1td33`**, minted **09:26:08.567Z**, inside the window.
Preflight `0d5137f0a7eb` / `ce67f25d132667d0`, `async`/`runner` true.

- **THE ROUTER WAS GIVEN THE SITE'S REAL PAGES** (`/, /prices, /gear`) — the
  route-list harness's first live run from `main` — and answered `intent=edit
  layer=page page=/` in 30.1 s, cost 2 (`6,645 in / 19 out`).
- **COST: route 2 + edit 17 = 19, balance 22 → 3, closing exactly.** No top-up
  was made and it fitted. `tweak` absent, `tweakUsage` `8,309 in / 53 out` (a
  quick decline, as in run 21; the reason is still not on the wire); the full
  writer `25,027 in / 8,820 out`; two translation calls `980 in / 35 out` (fr
  and es `missing: 1` each — see the finding below). Job states `claimed`
  (cost 0) to ~194 s, `routing` (cost 16 → 17) from ~207 s, `publishing` at
  ~407 s, a stored 200 under `x-gf-edit: final` at 414.1 s (123 polls, 0
  transient). `problems` 0 — the lookup read the real spec again.
- **ONLY `index.tsx` CHANGED** (26,248 → 26,563 chars, `8041046d0e4aba77`), in
  two hunks: `const bookingCount = typeof bookingsOnDay.data === "number" &&
  Number.isInteger(bookingsOnDay.data) && bookingsOnDay.data >= 0 ?
  bookingsOnDay.data : null`, and the component handed `{ isPending, isError,
  data: bookingCount }` instead of the raw query. **`day-space-lookup` is
  byte-identical** (`4b162037f67df545`), so the prediction that the fix belongs
  in the component was wrong; the acceptance said `index.tsx` is inspected, and
  inspected it is those two hunks and nothing else. `chord-diagram`,
  `trial-booking-form`, `gear.tsx`, `prices.tsx` byte-identical.
- **THE CHECK IS RULE 11's EXAMPLE EXPRESSION VERBATIM**, and the instruction
  named none of its integer or sign conditions — evidence the rule reached the
  writer, never proof (the prompt is not captured).
- **⚠ THE CHECK LIVES ON THE PAGE, NOT IN THE COMPONENT.** `placesLeftLabel`
  still does `Number(data)`; it is safe here only because the page hands it an
  integer ≥ 0 or `null`. The component reused elsewhere with a raw answer would
  convert again.
- **PROBE v4 ON THE LIVE BOX (09:30Z, `c1td33`, nothing written): FAIL 0.**
  Counts **MATCH 7 of 7** (0 → *"Six places left."*, 1 → 5, 2 → 4, 5 → *"1
  place left."*, 6/7/99 → *"None left."*); held **READ 6 · MATCH 2** (every
  pending reading *"Checking…"*, the day switch included); failures **READ 7**
  (*"Couldn't check — try again"*); empty **READ 5** (200 `null`, empty body,
  `[]`, `{}` → *"Not available"*; 204 → *"Couldn't check — try again"*);
  malformed **READ 14, FAIL 0** — every one *"Not available"*, `[7]` and `"7"`
  included, so no count is made from a non-count any more; the real function
  **200 body `0`** → *"Six places left."*. Plain loads at 1280×900 and 390×844:
  NAV 200, 0 console errors, 0 failed requests.
- **THE FOUR ITEMS**: malformed never availability ✓, zero stays six ✓,
  loading / error / missing distinct ✓, unrelated files unchanged ✓. **(A)
  passes — for this component, this wording, this site. (B), generation from
  the original request, is untested.**
- **THE CUSTOMER'S SCREEN**: *"✅ Updated /. I had a look at the finished
  pages: 2 pages threw an error and 4 pages reads something the check can't
  reach, so I couldn't see it with real data."* *"Updated /"* is true; the two
  errors are #418 on `/` and `/es` at phone width, **still unresolved**, so that
  clause is not verified; the four `unmet` are by design.
- **⚠ NEW FINDING: THE TRANSLATOR READ CODE AS PAGE TEXT.** `extractText` took
  `= 0 ? bookingsOnDay.data : null; return (` as JSX text — the `>` of `>=` read
  as a tag's end, running to `<SiteChrome` — so that chunk was the one
  "missing" string, sent to the model for fr and es and applied back into the
  translated pages' code. **The compiled check is identical in all three
  language chunks** (`index-CKn4l9II`, `index-BjcqMVEi`, `index-CkAVYpOq`), so
  this time the answer left the code intact — but any other answer would
  rewrite code on `/fr` and `/es`, and any `>` comparison in page-level code
  triggers it. In the backlog; not fixed.

### THE EDIT-PATH REVIEW (2026-09-23, read-only, at `0d5137f0`)

Owner: *"Close the booking-box correction as demonstrated by Run 26. Keep
first-attempt generation unverified, and park translation and the hydration
finding for now."* The goal it serves: a customer changes an existing site, the
change works, unrelated content survives, and the reply describes the result.

- **CLOSED — the booking-box correction (A)**, as demonstrated by run 26: all
  four items held live. **(B), a correct component from the original sentence
  on the first attempt, stays UNVERIFIED.** **PARKED (owner)**: the translator
  reading page code as text (backlog) and React #418 (runs 11, 21, 24, 26).

**HOW THE PATH REALLY ROUTES, read out of the code rather than the docs.** The
router answers ONE layer (text · data · rules · look · picture · logo · nav ·
page · rename, or `addon`), and `readEdit` kept a page ONLY for the page layer
(`site-ask.mjs:872`; **`look` keeps one too since the wrong-page fix, below**).
Only `look` runs several steps (`pick_lanes`, ≤4 lanes,
five of which — purpose, components, shape, three, tsx — dispatch to the page
rung). **Every `escalate` with no `layer` is answered `up` by `escalateAction`
and starts `go()` = `reactSend(…, 'revise')`: the full rewrite of every page,
with nothing shown and no price** (`edit-poll.js:469-485`, `chat.js:9151-9189`,
`8746-8751`). A refusal body with no `msg` does the same (`chat.js:9076`).
**⚠ Both closed on the branch the same day — the next section.**

**REPRODUCED FREE THROUGH THE REAL ROUTE** — every model answer SUPPLIED, the
browser's own composer executed through `editBrowserReply`. Scratch scripts
only; nothing added to the repo.

1. **data on an `incomplete` site** → `{escalate, no-backend}`, zero model
   calls → full rewrite. The rung still asks `siteBackendBySlug`
   (`worker.js:21297-21298`); the rules rung on the identical fixture resolved
   the database and reached its model call.
2. **a photograph that lives only in a component** → the picture rung is
   handed `pages: eSrc` (`21957`), finds no slot → `no-slots` → full rewrite.
3. **"take the blog page off" on a site with none** → `{escalate, no-page,
   verb: remove}` (`21215`) → full rewrite, whose own contract says a page not
   returned is deleted.
4. **two page steps both refused by the photograph protection** (409
   `withheld`, cost 0 each) → merged `{ok:false, layer:"look", partial}` at
   200 with no `msg` (`24071`) → full rewrite, and neither protection sentence
   is shown.
5. **look → `[shape, components]`** → the page rung runs TWICE on one
   instruction (`pick_lanes, write_tweak, write_tweak, write_pages`); the move
   landed and the screen says *"One part of that message didn't go through"*.
   `21157-21160` pushes one step per page lane with no dedup. **Fixed for
   NEIGHBOURING page lanes** — *one page operation for neighbouring page
   lanes*, below — **and across another rung**, order kept (*a page operation
   that succeeded is not run again*). **Both merged and live since deploy
   2148.**
6. **a section change routed through look on a two-page site lands on `/`**
   whatever page the message named (`fallbackPage`, `21153`): stored
   `index.tsx` changed, `gallery.tsx` untouched, *"✅ Updated /."* **Fixed on
   the branch for a page the router NAMES** — *a named page reaches the page it
   names*, below.
7. **the page rung's full writer drops an unrelated section** → published,
   *"✅ Updated /."* Nothing compares the sections or words that survived
   (the addon's `keptProse` is not used here), and `chat.js:10274` never reads
   what changed.
8. **the css lane drops an earlier rule** while answering the whole sheet →
   stored, *"✅ Updated the look — the design."* Its `keep` part is prompt-only
   (`site-lanes.mjs:465-485`).
9. **look + rename both succeed** → the screen says only *"✅ Updated the look
   — the design."*; the new address is on `body.msg` and never shown (the
   merged `layer` is `look`, `24075`, and that branch reads no `msg`).

**MONEY, DRIVEN THROUGH THE REAL QUEUE CONSUMER WITH THE RPCS FAKED:**
- **a refused rung inside a multi-rung message stays charged** — css ok +
  refused rename → reserves 1 + 1, `edit_finalize p_ok:true`, reply `cost: 2`,
  although the loop's own comment says a failed step charges nothing.
- **direct writes land before the one publish** (alias rows driven; data rows
  and rules DDL by reading); if that publish fails the whole job is refunded
  and the reply says *"your site is untouched"* while the address has moved.
- the routing call (≥1, **2 measured**) is never refunded (`19513-19516`), and
  `edit_refund` is all-or-nothing per job.

**THE SHARED BUILD EFFECT THAT MAKES THE FALL-THROUGH DANGEROUS.** The rewrite
every `up` lands on has **no photograph wall** — `keepPhotos`/`keptImages`
occur only on the edit page rung and the addon (`23010`, `23512`, `24053`
report-only, `26718`) — and on a site that already shows photographs it hands
the writer `imageDirective(0)`: *"PHOTOGRAPHS: none on this site … Every
picture is <SafeImage> with no src … that is the intended look here"*
(`budgetFor` answers 0 on a photographed revise; driven at helper level). That
is the sentence the edit page rung stopped sending after it stripped two
photographs. On the four `incomplete` sites the same rewrite is told there is
no database (recorded above, read not driven).

**ROUTER SIDE, read and driven at `readRouting` only:** an adopted site (one
opened on a browser that did not build it) has no page list until
`/api/site/routes` answers, so a message sent before then — or for the whole
page load if that read fails — routes as a FIRST BUILD (`chat.js:10885`), posts
the project's chat, `siteForChat` finds no row, and a fresh paid site is built
(`worker.js:14415-14427`). **Re-read hop by hop 2026-09-24, and every hop
holds**: `fromRow` (`public/site-list.js`) carries no `pages`; `isBuild =
!sitePages(site).length`; a build body carries `chat` and no slug; `siteForChat`
answers `null` for it, so `chatOwnsNoSite` is true and `freeSlugFor` names a NEW
site. The routes read is asked once per page load (`siteRoutesAsked`) and never
retried, so one failed read exposes every message of that load. **DRIVEN END TO
END the same day** (*an existing site whose page list has not loaded is built as
a new site*), which corrected one hop: the chat is **not** `srv_<slug>` — opening
the card runs `siteAdopt`, which makes a fresh local record, so the body carried
`chat: "site_<ms>_<rand>"`; `siteForChat` found no row for it just the same.
**FIXED ON THE BRANCH THE SAME DAY** (*an existing site waits for its page list*,
below). Attachments reach only the
logo layer (`chat.js:8973`), and wording + colour cannot both happen in one
turn: the look door has no text lane, so the second half is an `alsoAsked`
sentence at best.

**EVIDENCE BY OPERATION** — live · supplied-output route tests · helper only:
text — route tests, no live run · look/css — run 14 refused twice and
refunded, run 41 wordmark finished, route tests · page layout — live runs 9 and
11 · custom components — live runs 17, 21, 24, 26 · pictures — route tests, no
live picture-rung run · remove/move — live run 11 (a section), route tests for
page delete and lane removal, and for a layout beside a removal or a move
(`edit-page-verb`), no live page delete or move · rules/data — route
tests only (run 12 was blocked, since fixed) · combined — route tests and the
driven money cases above.

**THE NEXT TASK — BUILT THE SAME DAY, next section; `no-lane` ended up
`explain`, not the control named here: no automatic full rewrite for a failure
the route can name.** Every no-layer `escalate` in the edit route is
classified — the revise genuinely does it (`up`), another rung does (a named
`layer`), or nothing above can (a sentence, cost 0) — and a census guard makes
a new `escalate` declare its class. Acceptance, each through the real route
with `editBrowserReply` recording NO paid follow-up and a customer sentence:
cases 1–4 above; an all-failed merge showing the steps' own sentences; and a
control proving a genuine `up` (text `too-much-text`, a look `no-lane`) still
reaches the revise. Whether a kept `up` is announced before it spends is the
owner's call.

### EVERY WAY THE EDIT ROUTE DECLINES IS CLASSIFIED, AND A REFUSAL NEVER BUYS THE REWRITE (2026-09-23)

Owner, after reproducing the review's missing-page removal and all-refused
cases independently through the route and the browser handler: *"Both produce
no customer sentence and would start the full paid rewrite. Fix this failure
handling first."* **Merged and deployed in deploy 2146 (below); no paid run.**
Bounded to edit failure handling; translation, #418 and architecture parked.

**THE CLASSIFICATION IS ONE TABLE**: `builder/edit-failure.mjs`
`EDIT_FAILURES`, **40 entries, keyed `<rung>/<name>`** because one reason means
different things on different rungs (`no-meta` is a hop on data, an add-on on
rules, a failed read on look). **Four classes, and the class is what the
customer's browser does**:

| class | n | the browser | entries |
|---|---|---|---|
| `up` | **7** | the full rewrite | `route/empty` · `route/no-source` · `picker/build` · `text/too-much-text` · `look/no-look` · `look/needs-pages` · `page/no-look` |
| `addon` | **5** | the add-on route | `picker/addon` · `pages/addon` · `rules/no-backend` · `rules/no-meta` · `rules/no-tables` |
| `hop` | **4** | one paid hop sideways | `data/no-backend` · `data/no-meta` · `data/no-data` (→ `text`) · `picture/needs-place` (→ `page`) |
| `explain` | **24** | a sentence, nothing bought | everything else — **11 of them ours** |

- **`up` ONLY WHERE THE RUNG POSITIVELY ESTABLISHED THE CHANGE IS BEYOND IT
  AND A WRITER THAT REGENERATES PAGES IS THE DESIGNED NEXT STEP.** Everything a
  rewrite cannot be shown to solve is `explain`: a thing that is not there, an
  ask nobody could place, every failure of ours. **`no-lane` is `explain`** —
  the review's own proposed control named it a genuine `up`, and the owner
  overruled that in as many words (*"don't assume "no-lane" … proves a rewrite
  can safely solve the request"*). The router's *"every unclear case resolves
  to work"* is the build/ask/clarify decision and is UNCHANGED; this is the
  lane picker inside the edit route.
- **THE CLASS IS CARRIED BY THE CALL, BY CONSTRUCTION**: no `layer` is `up`,
  `layer: "addon"` is `addon`, any other layer is `hop` — the only three things
  `EditPoll.escalateAction` can do with an escalate.
- **THE ROUTE IS HELD TO THE TABLE BOTH WAYS** (`test/edit-failure.test.mjs`):
  every `escalate(` and `explain(` in the edit route — window
  `const escalate = (reason, extra) =>` → `return Response.json(merged);`,
  **4,064 lines**, whole-line comments blanked — must have a LITERAL first
  argument; the multiset of escalate (reason, class) pairs must EQUAL the
  table's climbing entries (**16 call sites, 16 entries**); every explain key
  (**29 call sites, 24 keys**) must be an `explain` entry and every `explain`
  entry used; `escalate: true` is produced ONCE (the helper). **A new escalate
  with no entry fails by existing**, which is exactly how the missing-page
  removal came to buy a rewrite: its comment said "an addon" and its escalate
  named no layer.
- **`explain(key, facts, extra)`** answers **422, or 503 when ours**, `{ok:
  false, error: <reason>, cost: 0, unchanged: true, ours, msg}`. The sentence
  is the table's (`failureMsg`) and is **RUNG-SCOPED** — asserted over all 24:
  none says *nothing on your site changed*, *haven't been charged*, *cost you
  nothing* or *nothing was changed*; every `ours` sentence says *this is on us*
  and no other does. **`unchanged: true` is the rung saying IT wrote nothing**;
  a rename whose first alias write landed passes `unchanged: false`.

**THE BROWSER STARTS THE REWRITE FROM AN ESCALATE AND FROM NOTHING ELSE.**
`editAnswer`'s refusal branch **never calls `fallback`**: its own `msg`, else
every refused step's (`partialSaid`), else `outcomeMessage('failed')`. **An
unreadable body and a dropped connection** (`siteEdit`'s catch) say
`unreadEditMsg()` — *"I couldn't read the answer to that change, so I can't
tell whether it went through"* — because a rewrite on top of an edit that may
have landed charges twice for one ask. Both used to fall to `fallback`.

**THE ALL-REFUSED MERGE** (the owner's second reproduction): **422**; `cost` is
the ledger's — `syncLedger.taken` on the synchronous path, **0 on the job path**
(the consumer's `edit_refund` returns everything a refused reply reserved) —
never a sum of the steps' own figures; `unchanged` **only when every step wrote
nothing** (`stepWroteNothing`: it said so, it was withheld, or it escalated —
every escalation returns before its rung writes); every `partial[]` entry
carries its step's own sentence, or `stepMsg` for a step that escalated (said
beside other steps, never acted on, since acting would do part of a message at
a price nobody saw) — **not every entry, though**: a step whose reply could not
be read (`body` null) or whose failure carried no `msg` and did not escalate
still arrives with none (read, not driven). The screen prints each distinct
sentence ONCE (two withheld page steps write the same one), two at most plus a
count, **and counts every step with no sentence beside them** — *the mixed
partial*, below.
- **UNANIMOUS CLIMB IS THE ONE EXCEPTION**: every step escalated to the same
  `layer|page` → the first step's escalate is the answer, acted on exactly as
  one step's would be (a site from before designs were stored, where every step
  needs the rewrite). Mixed is said step by step.

**WHAT THE EDIT COST AND WHAT THE ROUTING CALL COST ARE TWO AMOUNTS.**
`wholeRequestNote(e, d)` fires on `unchanged === true` (or the older `withheld`)
and says *"Nothing on your site changed, and this edit cost you nothing."* (or
*"…but this edit cost N credits."*) then, **when the browser still holds the
routing reply**, *"Reading your message cost N credit(s)."* — `d.cost`, which is
the routing reply's own `cost: rCost`, handed to the answer on BOTH paths
(`siteEdit` → `editAnswer`, `watchEditJob` → `reader`). **A watch resumed after a
refresh holds no routing reply and says nothing about it rather than a guess.**
`editBrowserReply(reply, httpOk, d)` takes that `d` now; absent, as every
earlier caller passes it, the screen is what it was.

**THE REPORTED CASES, THROUGH AN EXISTING CAPABLE PATH:**
- **data on an `incomplete` site** asks the four-state reader when the fast one
  answers `null` — `incomplete`/`ready` → the PROVEN connection, **nothing
  written** (no `PATCH site_backends`, asserted); `none` → a hop to `text`;
  `unreadable` → explained, ours — and the catalog-first `specForAddon` when
  `_meta` gives nothing (a confirmed-empty catalog is the same hop).
- **a photograph only in a component**: the picture rung reads
  `editableFiles(eSrc, parts)` and publishes `splitEditable`'s two halves — the
  text rung's 2026-09-11 fix, one rung over — **only when the parts store
  ANSWERED**; otherwise the pages go alone (the spine re-sends the store's copy,
  never `parts: []`), and a photograph then not found is `parts-unreadable`
  (ours), **never "your site has no photograph"**. A component slot is shown
  under `partPath(name)` = `-parts/<name>.tsx`.
- **a page that is not there** (both the lanes' `pages` verb and the page
  rung): removal is *already true*, a move has *nothing to move*, an edit lists
  the real pages and asks which. **Which page gets targeted is its own task.**
- **THE SOURCE READ**: a repairing read that answers nothing is asked again of
  the three-state reader to tell a read that THREW from an empty store — and
  **that second read only classifies**: pages it finds mean the repairing read
  blinked, and the answer is `route/no-source-unreadable`, never an edit of a
  copy nothing repaired. **`site-busy`'s census caught the first cut adopting
  them** (7 → 8 bare reads); it is argued there now, with the property asserted.

**⚠ THE 2026-09-20 CONTROL IS REVERSED, DELIBERATELY.** A genuine page
no-change was kept escalating (*"the site already does that"*, climb). It is
`page/no-change` now, a sentence at no cost: the page's own writer saw the page
and the request, and a rewrite of EVERY page is no evidence it would do better.
**The ladder's control moved** to `edit-failure.test.mjs`, where
`too-much-text`, `kind`, a unanimous `no-look` and an empty store still start
the rewrite, `three` still reaches the add-on, `data` with no database still
hops to `text` and `needs-place` to `page` — each through the route AND the
browser's own handler, so a fix that stopped escalating everywhere fails there.

**AND ONE MORE THAT NEVER REACHED A SCREEN**: *"your site doesn't have a QR
code, so there was nothing to take off"* answered `ok: true` with no layer, and
the success composer printed *"✅ Done."* over it. A refusal now
(`picker/nothing-to-remove`).

**EVIDENCE.** `test/edit-failure.test.mjs`, **33 cases**: the owner's two
reproductions, move and edit of a missing page, the mixed all-refused, no-lane,
look no-change, the reversed page no-change, three failures of ours (missing
key, unreadable store, a read that blinks once), the three data states, the
three picture states, and the controls — each asserting the stored bytes, the
response, the screen's exact sentence and the recorded follow-ups, plus
`sum(debits) === cost` wherever a charge is claimed. **Red 25 of 33 against the
unfixed `a018ad3e`** in a throwaway worktree; the 8 that pass there are the six
controls whose behaviour must not change and the two pure table checks. **One
targeted mutation** (the classifier adopting the pages again) killed, restored
byte-identical from a scratchpad backup. **No broad mutation campaign** (owner).
Every model answer is SUPPLIED and every case is the synchronous path.
**Pre-existing guards re-anchored to the property, not appeased**: `edit-path`
(no-lane, page-verb and a missing page's verbs are refusals with sentences, no
escalate); `edit-poll` (the refusal branch contains no `fallback(` call, its
observer proved alive; the catch landmark no longer names `err`);
`edit-page-protect` (a genuine no-change is said — the reversal — and the
wordless-partial count arm driven on a legacy reply, since the route no longer
writes one); `site-apply` (the escalating reasons that still climb, the four
that went are `explain`ed, the data lane resolves the four states, an unreadable
body and a dropped connection no longer buy a rewrite); `edit-rules-backend`,
`edit-nobackend`, `edit-parts`, `removal-door`, `site-picture`; `site-busy` (the
classifier, above); **`api-auth`** — see the next paragraph.

**⚠ THE FOCUSED SET MISSED A GUARD AND CI CAUGHT IT.** The local run was
KEYWORD-selected (files naming `escalate`, `editAnswer`, the harness, the source
readers …): **88 files, 2,680 / 2,680** on the committed tree. CI's full run on
`1f234090` (unit run **`35854168333`**) read **7,212 / 7,207 / 1 / 4**: the
failure was `api-auth`'s *"the picture layer's working balance moves as it
spends"*, which reads the picture block by BYTE OFFSET (900 bytes above
`runPictureEdit(`) and names none of the keywords. The new comment about the
rung's components pushed `let balance` past the 900 — **and its END landmark
(`pages: eSrc });`) had matched NOTHING since the call gained `model:
eQuickModel`**, so `slice(start, -1)` had been searching the rest of worker.js
all along: the byte-window trap in both of its halves at once. Re-anchored
landmark to landmark (`if (eLayer === "picture") {` → the next `if (!pOut.ok)
{`), both proved, and a `let` → `const` mutation of the balance now fails it
(restored byte-identical). **The whole suite then read 7,212 / 7,212 / 0 / 0
locally** (`duration_ms 126,927`). *A focused list selected by keyword is blind
to exactly the guards that read by position* — which is why a narrow list is
only ever believed for a green, never for completeness.

**CI, BOTH HALVES TAKEN.** Unit run **`35855079271` on `aa9728ef`** reads
**`# tests 7212 / # pass 7208 / # fail 0 / # skipped 4`** (`duration_ms
117,064`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips. **`site build` run `35854168288` on `1f234090`** (11:22:37 → 11:46:54Z,
**24m17s**, all twenty steps) read all twelve counts green out of its per-step
files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases 16,
theme-seam 11, theme-render 29, site-routing 14, site-runtime 47, kit-render /
kit-a11y / kit-effects / kit-paint `all passed`, census 7 + 4 + 1 = **12**; the
two known `##[error]` annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17)
TS2339`) each directly above their own `ok` lines; `site-build.mjs` **17m40s**.
`aa9728ef` fires no site build — it touches `test/api-auth.test.mjs` and the two
documents, none on that workflow's `paths` — and its product tree is
`1f234090`'s, so that run is the reading for both. **The stamp chain ends at
`aa9728ef`.**

**THE MIXED PARTIAL (the same day, the owner's browser-composer
reproduction).** `partial: [{layer: "page", msg: "The photo change was
refused."}, {layer: "look", error: "compile"}]` printed *"⚠️ The photo change
was refused."* — **byte-identical to a reply holding that one failure**, on the
refusal branch and after the tick alike. `partialSaid` counted steps with no
sentence only in the branch reached when NO step had one, so one explained step
made every unexplained one vanish. It now says the sentences as before
(deduplicated, two shown, the rest counted), then *"One more part of that
message didn’t go through. Ask for it again on its own and I’ll tell you why."*
— **"more" only beside a sentence**, so a reply of one kind alone reads
byte-identically to before. **The dedup is of SENTENCES**: two steps with none
are two failures, counted one by one even when their entries are identical.
**A composer reproduction, not a live failure**: whether the route has written
such a mix on a real message is not established.
- **Evidence.** `test/edit-failure.test.mjs` 33 → **35 cases** — a complete
  refusal and a partial success, each asserting the exact screen and the
  recorded actions (`[]`; `["refresh the credit balance"]`), with a one-failure
  control and both single-kind controls. **Red first**: both failed on the
  unfixed composer with the one-failure text as `actual`. **One targeted
  mutant** (every silent step counted as one) was killed by both — **and the 33
  originals all passed under it**, so the new cases are the only guard on that
  property; `chat.js` restored byte-identical from a scratchpad backup. Every
  test file that reads or runs `chat.js` (93): **2,876 / 2,876**. Whole suite
  locally: **`# tests 7214 / # pass 7214 / # fail 0 / # skipped 0`**,
  `duration_ms 116,962` — **+2 against 7,212**, exactly the two cases. Rendered
  in the real workspace chat (the real composer's text, the real `chat.js` and
  `styles.css`). **No `site build` run**: `public/` and this test file are on
  none of its `paths`, so there is no run at all, not a fast one.
- **CI, the same reading.** Unit run **`35897585399` on `3da0be16`** reads
  **`# tests 7214 / # pass 7210 / # fail 0 / # skipped 4`** (`duration_ms
  118,607`) — the TOTAL matches, `pass` differing by exactly CI's four skips —
  and all 35 of the file's cases were found passing **by name** in the
  downloaded log (the two new ones as `ok 1657` / `ok 1658`), with zero `not
  ok` lines. **The stamp chain ends at `3da0be16`.**

**SEPARATE NEXT TASKS — RECORDED, NOT STARTED** (owner: *"Record wrong-page
targeting, duplicate execution, content preservation and billing findings as
separate next tasks"*):
1. **Wrong-page targeting.** Review #6 (a section change through `look` lands on
   `/` via `fallbackPage`) and run 23's `/book` (the router naming a page from
   the sentence). A missing page is now SAID; choosing the right one is not
   fixed. **STARTED 2026-09-23 — the NAMED half is fixed on the branch** (*a
   named page reaches the page it names*, below); a message naming no page on a
   multi-page site still goes to the home page by the documented default.
2. **Duplicate execution.** Review #5: two page lanes (`components`+`tsx`,
   `shape`+`components`) push two page steps for one sentence — the all-refused
   reproduction still calls `write_tweak`/`write_pages` twice. **STARTED
   2026-09-23 — NEIGHBOURING page lanes are one page operation on the branch**
   (*one page operation for neighbouring page lanes*, below). Two page lanes
   with another rung's step between them still run the page rung twice,
   deliberately (that order is load-bearing), and are the recorded remainder.
   **THE REMAINDER IS FIXED TOO, ORDER KEPT** (*a page operation that
   succeeded is not run again*, below). **CLOSED 2026-09-23 by the owner after
   review (81 focused cases passing), merged and deployed in deploy 2148 —
   with the limit KEPT: every model answer in those cases is SUPPLIED, so what
   is closed is the route running one requested page change once, never a
   claim that a real model's first attempt applies the whole request.**
3. **Content preservation.** Review #7 (the page writer drops an unrelated
   section and publishes), #8 (the css lane drops an earlier rule), #9 (look +
   rename both land and the screen names only the look), and the full rewrite's
   missing photograph wall and `imageDirective(0)` on a photographed site.
   **#7 REPRODUCED 2026-09-24 through the route** (*the full page writer drops
   unrelated content silently*, below), the design revised on the owner's four
   points, and **BUILT ON THE BRANCH THE SAME DAY** (*the preservation check,
   built*, below) — merged and deployed in deploy 2151, no paid run. **It covers links
   and the site's own components only; plain-text and kit-only section loss
   stays OPEN**, and the judge's reading of a message is the model's, proven by
   no test here. **A GROUP asked for at once** (*"remove all links"*) was
   refused by it and is supported the same day (*a group asked for at once*,
   below), judge-declared and kind-checked — and after a shared-heading bypass
   the owner reproduced, **a declared group constrains its answer** (next
   section but one). **CLOSED AT CODE REVIEW BY THE OWNER 2026-09-24** (*"The
   87 focused tests pass, and both CI checks are green"*) and handed off for
   merge, **merged and deployed in deploy 2151** (*merged and deployed: the
   preservation check*, below). **Partial
   protection, not the edit path complete**: supplied model answers only.
4. **Billing.** A refused rung stays charged when another step of the message
   succeeded (job path); direct writes (rows, DDL, aliases) land before the one
   publish and a failed publish refunds everything and says "untouched"; the
   routing call is never refunded; **pre-existing unscoped "nothing was charged"
   wording on other failure paths** (`modelDown`'s timeout, `compileMsg`,
   `editStopped`, `outcomeMessage('cancelled')`, the build-lease sentences,
   `NO_CONTAINER_MSG`); and refusals that collect a charge (nav `no-menu`, the
   rename refusals, data/rules `no-match`, picture `no-change`) report a `cost`
   the job path then refunds, so the stored reply disagrees with the ledger.
5. **Found on the way, out of scope**: the rename's SECOND alias write failing
   leaves the old name demoted and the new one unwritten (explained with
   `unchanged: false`; the half-moved state is not repaired); `siteRoute`'s own
   failure still falls to `go()` (the router, not the edit route) — **re-read
   2026-09-24**: `if (!r.ok || !d) return go();` and `.catch(go)`, so on a live
   site a dropped connection, a non-2xx or an unreadable routing answer starts
   the full rewrite of every page with nothing shown and no price —
   **REPRODUCED THE SAME DAY through the real handler, and BUILT ON THE BRANCH
   THE SAME DAY, not merged** (*a routing answer that cannot be acted on stops
   a live site*, below); and an
   add-only wall or page-verb answer in the look door ends the WHOLE message —
   *"add a QR code and make the footer navy"* goes to the add-on and the css
   lane never runs.
6. **The page verbs bleed into sibling page steps** (found 2026-09-23 while
   reproducing #2). `eRemove` and `eRename` were MESSAGE-WIDE `let`s the
   `pages` verb set, and every page step read them — so `shape` picked beside
   `pages` (*"…and take the gallery page off"*) ran the `shape` step down the
   REMOVAL branch: no page writer, `/gallery` removed, the layout never made.
   **CLOSED 2026-09-23 by the owner after review (251 focused and regression
   tests passing), merged and deployed in deploy 2149** (*a page verb belongs to
   its own step*, below): aimed at a NON-home page the same sentence had DELETED
   that page too, with *"✅ Updated the look."* on the screen, and the router's
   own `remove` reached a layout lane through the picture door. **The limit is
   KEPT**: every model answer in the evidence is SUPPLIED, so what is closed is
   the route scoping each verb to its own step and target — never that a real
   picker names these lanes or a real writer makes the layout change.
7. **An adopted site with no page list builds a NEW site** (recorded
   2026-09-24 for later — owner: *"Keep the separate missing-page-inventory/
   new-build issue recorded for later"*). A site opened on a browser that did
   not build it has no page list until `/api/site/routes` answers, asked once per
   load and never retried, so `isBuild` is true and the message routes as a
   FIRST build with `hasSite: false`: a failed routing call, a `build` answer, and
   `edit`/`addon` (closed off without `hasSite`, so they fall to `build`) all end
   in `react-build` with the project's chat, `siteForChat` finds no row, and a
   fresh paid site is named. **Driven for the failure door only**
   (`test/site-route-failure.test.mjs`); the answer doors are read hop by hop
   (*router side*, above). **REPRODUCED END TO END 2026-09-24 in a real browser
   with every request recorded, and the correction PROPOSED, not built** —
   *an existing site whose page list has not loaded is built as a new site*,
   below: a new paid build, the wrong site, and the request lost, all three.
   **BUILT ON THE BRANCH THE SAME DAY, not merged** (*an existing site waits for
   its page list*, below), with the clarify doors the owner added.
8. **The addon's own failures fall to the full rewrite** (found 2026-09-24,
   driven): a valid addon answer whose addon POST drops, or whose reply cannot
   be read, starts `react-revise` — on top of an addon that may have landed.
   `siteAddon`'s `.catch(fallback)` and `addonAnswer`'s `fall()`; the
   double-charge shape `siteEdit`'s catch was fixed for on 2026-09-23. Kept out
   of the routing correction.
9. **A routing call that cannot be acted on drops the attachments** (found
   2026-09-24, driven through the entry harness on `c5c93652`): `siteRoute`'s
   `lost()` stops with *"…Send it again in a moment"*, and the files `siteSend`
   took off the composer are held nowhere — strip empty, and the resend's logo
   edit posts no image. On any live site, page list loaded or not, and on an
   existing site's round, which is cleared before routing. The same loss the
   pre-routing stop had (*a message the page-list check stopped keeps its
   files*, below), one step later; that correction's hold is the mechanism,
   and the owner scoped it to the pre-routing check.

### MERGED AND DEPLOYED: THE FAILURE HANDLING (2026-09-23, evening)

Owner: *"Close this correction. Merge and deploy the reviewed failure-handling
changes, preserving anything newer on main. Report the actual deployed SHA and
container image. No paid replay is needed for this deterministic reporting
correction."*

- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `0d5137f0` →
  **`3c0a2533`**, 10 commits, 20 files (+3,079 / −210): the classification
  table, the browser's refusal handling, the mixed-partial count, their guards
  and the documents. Asked before the push: zero runs in progress or queued,
  the image id predicted over both ends (the seventeenth cross-check, above),
  and the rollback verified in a throwaway worktree — reverting the range gives
  tree `3ccf15bf…`, **main's own**, so a rollback reuses `ce67f25d132667d0`.
- **DEPLOY 2146 (`35901168665`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  18:15:12 → 18:18:29Z. `DEPLOY_ID` `3c0a25335c4f6fbd3ae506999e51c1ff3e29d357`
  (masked in the log as `…e5***c***ff3e29d357`); image **built
  `fd3355f0b71af621`** (404, 185 inputs) and **rolled from
  `ce67f25d132667d0`**; `Uploaded isibi-app`, a fresh Worker version,
  `Deployed isibi-app triggers`.
- **THE SERVED-FILE CHECK, BOTH READINGS TAKEN**: `public/` changed, so
  Wrangler answered `+ /chat.js`, 1 file, 85 already uploaded. **Before**
  (taken before the deploy landed): 732,238 bytes, sha256 `903d9ff39b7d4b1d`,
  0 occurrences of `unreadEditMsg`. **After**: 736,749 bytes, sha256
  `bf745e7118484cad`, 3 occurrences — **byte-identical to `git show
  3c0a2533:public/chat.js`**. Gates **401 / 401 / 401 / 404** at 18:20:15Z.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `3c0a25335c4f6fbd3ae506999e51c1ff3e29d357` and `expect_image`
  `fd3355f0b71af621` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token.

### A NAMED PAGE REACHES THE PAGE IT NAMES (2026-09-23, on the branch)

Owner: *"Reproduce a request explicitly targeting /gallery on a two-page site
that passes through look → page. Trace where the requested page is lost and
why the dispatcher falls back to /. Preserve the explicit target through
routing and dispatch. A named page must resolve to that page or produce a
clear missing/ambiguous-target response; it must not silently become the
homepage."* **Not merged, not deployed, no paid run.**

**THE PAGE WAS LOST AT THE FIRST OF FOUR HOPS, AND THE OTHER THREE WERE
STARVED.** `route_message`'s `page` field said *"Only when layer is page"*, and
`readEdit` returned for every other layer before it read the field — so a
`look` answer arrived with no page whatever the model wrote. `/api/site/route`
forwards `routed.page` for ANY edit, `siteEdit` posts `d.page` for ANY layer,
and the look door already preferred a named page (`fallbackPage = ePage || …`);
with `ePage` always empty the fallback chose the site's only page, else `/`.
**Reproduced through all four hops with supplied model answers, red**: the
router named `/gallery`, the routing reply had no page, the browser posted
`page: ''`, the writer was shown `index.tsx`, the home page changed, the gallery
did not, and the screen said *"✅ Updated /."* A page the site does not have
(`/menu`) went the same way — made on the home page, reported as done.

**THE FIX IS THREE SMALL CHANGES:**
1. **The router may name the page on `look`** — the field's description says
   when (the page they SAID, copied from the list; never guessed; absent for a
   whole-site change), and the look layer's description says to fill it.
2. **`readEdit` keeps it for `look`**, in `normalizePagePath`'s spelling; absent
   stays absent (no key), and every other non-page layer still carries none.
   **A page the site does not have is KEPT, not turned into an add-on** as the
   page layer's is — a colour or a section aimed at a missing page is not an
   addition, and *"take the 3D thing off the menu page"* must not design one.
3. **The look door checks a named page before anything runs** — before the
   picker is paid for or any lane acts — and answers a missing one with the page
   rung's own `page/no-page` key and sentence and the site's real pages: 422,
   cost 0, `unchanged`, nothing compiled, no follow-up. So no site-wide lane can
   quietly change the whole site for a page that is not there, and no page-shaped
   lane can land on the home page instead.

- **THE DEFAULT IS KEPT AND PINNED**: a look message naming NO page on a
  multi-page site still goes to the home page (`fallbackPage`'s documented
  rule). The owner's rule is about a named page; a control asserts the default so
  the fix cannot pass by refusing every unnamed page change.
- **⚠ ONE CONSEQUENCE BEYOND THE REPRODUCED CASE**: the `pages` verb's step used
  `pv.name || fallbackPage`, and the fold for a `removes: ["pages"]` answer
  names `ePage`. Both were written to take a named page and never received one;
  now a page verb the picker answers WITHOUT naming a page acts on the page the
  router named, where it used to fall to `/` (whose removal is refused). That is
  the rule applied consistently and it is NOT separately tested — the picker's
  own `pageName` still wins when it gives one.
- **WHAT DID NOT MOVE**: the css lane (and every other own lane) ignores the
  page, so a colour change *"for one page"* is still written into the site-wide
  sheet exactly as before; the page layer's own unknown-page → add-on rule; the
  routing reply, `siteEdit` and the dispatcher, all unchanged.

**EVIDENCE.** `test/edit-page-target.test.mjs`, **5 cases**, every hop DRIVEN:
the real `/api/site/route`, the real `siteEdit` cut out of `chat.js` and run
with a recording `apiFetch`, the real edit route on the exact body `siteEdit`
posted, and the real browser composer. The writer stub **obeys whatever file it
is shown**, which is what makes a wrong target visible. Asserted: the routing
reply's page, the posted page, the writer's file AND its whole source (and the
home page absent from its prompt), the model calls, the compiler payload, the
stored pages, the edit's debits against its reported cost, the screen, and the
home page **byte-identical** in both the payload and the store. Controls: `/`
named explicitly (the positive homepage edit), and no page named (the default).
**Red 4 of 5 against unfixed `3c0a2533`** in a throwaway worktree — only the
unnamed-default control passes on both. **Focused mutation check
`scripts/mutants/page-target.json`: 9 mutants, 9 killed, 0 survived, 0 never
applied, the comment-only control surviving**, one mutant per hop or fact (the
router dropping the page, its spelling, the routing reply, the browser POST, the
door check, the dispatcher, the sentence's verb and its page list, the tool
text); the three swept files byte-identical to a scratchpad backup afterwards.
**Suite 7,219 locally, taken twice** (`# tests 7219 / # pass 7219 / # fail 0 /
# skipped 0`, `duration_ms` 116,888 and then 116,312 on the committed tree) —
**+5 against 7,214**, exactly this file's cases.
**AND THE CI UNIT HALF MATCHES**: run **`35904011295` on `807d88b8`** reads
**`# tests 7219 / # pass 7215 / # fail 0 / # skipped 4`** (`duration_ms
118,875`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all five cases found passing BY NAME (`ok 1807`–`ok 1811`) and
zero `not ok` lines in the downloaded log.
**AND `site build` run `35904011369` on `807d88b8`** (18:39:48 → 19:05:25Z,
**25m37s**, all twenty steps) read all twelve counts green out of its per-step
files, the flat log agreeing line for line: TAP 397/397/0/0, kit-typecheck 4,
site-build **382**, contrast-cases 16, theme-seam 11, theme-render 29,
site-routing 14, site-runtime 47, kit-render / kit-a11y / kit-effects /
kit-paint `all passed`, census 7 + 4 + 1 = **12**; the two known `##[error]`
annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the
case that compiles a broken page on purpose, `tsc`-format lines 9 / 2 / 7;
`site-build.mjs` **18m22s**. **⚠ THE SECOND ANNOTATION IS NOT DIRECTLY ABOVE
ITS `ok` LINE THIS TIME**: the two known `SSR stream transform exceeded maximum
lifetime` lines landed between them, where run `35854168288` printed them after
the `ok` lines. That is the order asynchronous output reached the log, not a
change in what passed — its own `ok` (*"a site with one bad page still reports
the type error"*) follows two lines later — so read what an annotation sits
INSIDE rather than what line happens to follow it. `dc3f8efc` fires no site
build (the two documents only), so this run is the reading for the branch.
**The stamp chain ends at `807d88b8`.**
**⚠ WHAT IT DOES NOT CLAIM**: every model answer is SUPPLIED, so this proves a
page the router names is carried to the writer and published there — never that
a real router names it. The router's instructions changed; whether the model
fills the field is unproven until a live run.
**⚠ A MEASURED LIMIT, SHARED WITH THE PAGE RUNG**: a named page is compared
LOWERCASED (`readEdit` normalises it) against `routeOf`, which KEEPS case
(`About.tsx` → `/About`), so a capitalised route file would be refused as
missing — by the new door check, and already by the page rung's own lookup.
**Measured: 0 capitalised routes** across the 324 corpus pages, the 8 generated
fixtures and 53 live routes on 25 sites' sitemaps, so it is recorded rather than
built for.

### MERGED AND DEPLOYED: THE NAMED-PAGE CORRECTION (2026-09-23, evening)

Owner: *"Keep the claim precise: a target supplied by the router now survives
through publication; real-model target selection remains unverified. Merge and
deploy this reviewed correction, preserving newer main changes. Report the
actual deployed SHA and image. No paid replay yet."*

- **THE CLAIM, IN THE OWNER'S WORDS**: **a target supplied by the router now
  survives through publication; real-model target selection remains
  unverified.** The reviewed evidence is the 40 focused cases, unit CI and the
  site build — all on SUPPLIED answers.
- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `3c0a2533` →
  **`90045638`** at ~19:25Z, 3 commits, 7 files (+784 / −15). Asked before the
  push: zero runs in progress or queued, the image id predicted over both ends
  (the eighteenth cross-check), and the rollback verified in a throwaway
  worktree — reverting the range gives tree `6eed00f2…`, **main's own**, so a
  rollback reuses `fd3355f0b71af621`.
- **DEPLOY 2147 (`35909174705`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  19:25:10 → 19:28:17Z, **3m07s**; image step **2m15s** with **0 `CACHED`
  lines**; Wrangler 18s. `DEPLOY_ID` **`9004563879727638d4db6405e7560c7a2700ab03`**
  (unmasked in the log); image **built `1aba925de4658f45`** (registry answered
  404, 185 inputs — the log prints `***aba925de4658f45`, the `***` a masked
  `1`) and **rolled from `fd3355f0b71af621`** (`- …:fd3355f0b7***af62***` →
  `+ …:***aba925de4658f45` under `SUCCESS Modified application`, `Applied
  changes`); `Uploaded isibi-app`, `Current Version ID: 54890ba0-…`, `Deployed
  isibi-app triggers`. **`No updated asset files to upload`** — `public/` did
  not change — so there is **no served-file check**. Gates **401 / 401 / 401 /
  404** at 19:28:49Z.
- **THE EIGHTEENTH IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH**:
  `origin/main` answered `fd3355f0b71af621` (what deploy 2146 rolled to) and
  the tip `1aba925de4658f45`, both from 185 inputs, three of the push's seven
  files among them (`builder/edit-failure.mjs`, `builder/site-ask.mjs`,
  `worker.js`) — re-read over the deployed range afterwards, same answer.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `9004563879727638d4db6405e7560c7a2700ab03` and `expect_image`
  `1aba925de4658f45` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token. **No paid replay** (owner).

### ONE PAGE OPERATION FOR NEIGHBOURING PAGE LANES (2026-09-23, merged and deployed in 2148)

Owner: *"Reproduce one look request whose selected fields include shape and
components, both targeting the same page. Measure how many page-writer calls,
compilations and charges it causes, and whether the second execution repeats
or reverses the first. For compatible changes to the same page, prepare one
page operation carrying both requested changes. Preserve genuinely different
page targets and operations that require separate ordering."* **Merged and
deployed in deploy 2148 (below); no paid run.**

**THE REPRODUCTION, THROUGH THE REAL ROUTE WITH SUPPLIED ANSWERS.** A two-page
site, `shape` + `components` both landing on `/`, both money paths. The writers
are stubs that apply the request to the file they are SHOWN, which is what
makes a repeated execution visible:

| the ask | page-writer calls | compiles | what shipped | charged | screen |
|---|---|---|---|---|---|
| a swap (*"swap the opening hours and the market times"*) | **2**, the second shown the first's swapped page | 1 | the **ORIGINAL** page — the second run swapped it back | **3 + 2** (`use_credits`); job path `edit_reserve` seq 1 = 3, seq 2 = 2 | *"✅ Updated the look."* |
| a placement (*"put the market times at the top"*) | **3** — the second run's cheap writer found nothing to do, then its full writer returned the page unchanged | 1 | the change | 3 (the second run's two calls unbilled: our cost) | *"✅ Updated /. ⚠️ I read the / page and couldn't find a change to make for that…"* |

Controls — `shape` alone, `components` alone, and `shape` alone on the job
path: 1 writer call, the change shipped, 3, *"✅ Updated /."* The unrelated
gallery was byte-identical in every run.

- **SO THE SECOND EXECUTION DOES BOTH, DEPENDING ON THE ASK**: it REVERSES a
  change whose second application undoes it, and REPEATS one whose second
  application finds nothing to do — and then reports a refusal beside a change
  that shipped. Either way somebody pays for it and the screen is wrong.
- **THE CAUSE**: the look door pushed one step per dispatched lane —
  `purpose`, `components`, `shape`, `three` and `tsx` all dispatch to the page
  rung — and the page rung reads the customer's SENTENCE and none of the lane
  names (`runLayer` hands it `fields`; the page branch reads none of them). Two
  such steps are one operation run twice, the second on the first's output
  because `publishStep` advances `eSrc`.

**THE FIX IS ONE PURE FUNCTION AT THE ONE PLACE THE STEPS ARE MADE.**
`mergePageSteps` (`builder/site-lanes.mjs`) joins CONSECUTIVE page steps aimed
at the SAME page, each with no ask of its own and every field a lane that
dispatches to the page rung by its own name, into one step carrying every field
in order. The look door applies it to the dispatched steps alone
(`steps.push(...mergePageSteps(dispatched))`), so the QR placement step and the
`pages` verb step — pushed separately — never meet it.

- **WHAT NEVER JOINS, each a different operation rather than the same one
  twice**: a step with its OWN ask (the QR placement's fixed text); a `pages`
  verb step (`laneLayer("pages")` is null — the verb decides the rung); a step
  on a DIFFERENT page; and **two page steps with ANOTHER rung between them**.
  The last is the owner's *"operations that require separate ordering"*:
  joining them moves one page change across that rung, and the order is
  load-bearing — the picture rung's work reaches a later page step through
  `eSrc`, which is what the photograph protection reads, and a page step run
  first can be withheld for a loss the picture rung was about to authorise.
  **No step moves; neighbours are joined.**
- **AFTER, SAME ROUTE, SAME ANSWERS**: a swap-plus-card ask on `shape` +
  `components` → **1** writer call shown the stored page, **1** compile carrying
  BOTH changes, both in the store, the gallery byte-identical, **one debit
  equal to the one-lane control's**, `lanes: ["components", "shape"]`,
  `layers: ["page"]`, *"✅ Updated /."*; the job path takes **one**
  `edit_reserve` (seq 1). The placement ask: one call, no false refusal.
- **THE REMAINDER, STATED**: two page lanes with another rung's step between
  them — `components` + `images` + `tsx` — still run the page rung twice, and
  the second execution still repeats or reverses the first. Kept deliberately
  for the ordering above. **FIXED ON THE BRANCH THE SAME DAY, ORDER KEPT** —
  *a page operation that succeeded is not run again*, below.
- **AND A SEPARATE DEFECT FOUND ON THE WAY — THE VERB BLEEDS** into sibling
  page steps (next-task 6 above). Unchanged by this fix.

**FOUR PRE-EXISTING CASES WERE BUILT ON THE DEFECT'S SHAPE, AND EACH WAS
RE-ANCHORED TO WHAT IT ASSERTS**, not appeased:
- `edit-failure`'s owner reproduction (two page steps both withheld): the same
  input is ONE page step now — its own 409 refusal, its sentence at the top —
  and **the screen is byte-identical to what the merge was fixed to say**: the
  sentence once, the whole-request clause, no follow-up. The merge's
  all-refused law moved to a new case on `components` + `images` + `tsx`: two
  page steps answering *no change* beside the picture rung finding no
  photograph — 422, three entries, the repeated sentence printed ONCE. File
  35 → **36 cases**.
- `edit-page-context`'s snapshot case and `edit-page-protect`'s two
  merge-reporting cases moved to `components` + `images` + `tsx`, the shape that
  still runs two page rungs, each with its premise asserted (two page rungs,
  the picture rung between them). **Moved again by the next section**, whose
  fix makes that shape run one page operation too.

**EVIDENCE.** `test/edit-page-once.test.mjs`, **7 cases**: the reproduction
fixed on the synchronous path and on the job path, the placement shape, the
single-lane controls, the ordering case (the picture rung's call sits between
the two page calls, and the second is shown the first's output), and two unit
cases driving `mergePageSteps` over every joining and non-joining shape. **Red
3 of 7 against unfixed `90045638`** in a throwaway worktree (only the new
function copied in, so the file loads) — the three route cases, each on its
first gate (*the page writer ran more than once*); the controls, the ordering
case and the rule cases pass on both. **And each layer sees the defect on its
own**: with the call-count gate cut in the throwaway copy the same cases fail
on the published page (the swap lost), and with that cut too, on money
(`[3, 2]` debited; seq 1 = 3, seq 2 = 2 reserved). **Focused mutation check
`scripts/mutants/page-once.json`: 8 mutants, 8 killed, 0 survived, 0 never
applied, the comment-only control surviving**, against the eight edit-path files
that can see the change (the new file, `edit-failure`, `edit-page-context`,
`edit-page-protect`, `edit-lanes`, `edit-parts`, `site-apply`,
`edit-page-target`); both swept files byte-identical to a scratchpad backup
afterwards. **Suite 7,227 locally** (`# tests 7227 / # pass 7227 / # fail 0 /
# skipped 0`, `duration_ms 117,122`) — **+8 against 7,219**, exactly this
change's cases: seven in the new file and one in `edit-failure`.
**AND THE CI UNIT HALF MATCHES**: run **`35912468500` on `7ee2e427`** reads
**`# tests 7227 / # pass 7223 / # fail 0 / # skipped 4`** (`duration_ms
119,331`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all nine new or renamed cases found passing BY NAME (`ok
1632`–`1633` in `edit-failure`, `ok 1766`–`1772` in the new file) and zero
`not ok` lines in the downloaded log. **AND `site build` run `35912468693` on
`7ee2e427`** (19:55:00 → 20:19:35Z, **24m35s**, all twenty steps) read all
twelve counts green out of its per-step files: TAP 397/397/0/0, kit-typecheck
4, site-build **382**, contrast-cases 16, theme-seam 11, theme-render 29,
site-routing 14, site-runtime 47, kit-render / kit-a11y / kit-effects /
kit-paint `all passed`, census 7 + 4 + 1 = **12**; the two known `##[error]`
annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) each
directly above its own `ok` line this time, `tsc`-format lines 9 / 2 / 7;
`site-build.mjs` **17m58s**. **The stamp chain ends at `7ee2e427`.**
**⚠ WHAT IT DOES NOT CLAIM**: every model answer is SUPPLIED and every writer is
a stub that applies the ask to what it is shown, so this proves the route runs
ONE page operation, publishes both changes and bills once — never that a real
model applies two changes correctly in one call.

### A PAGE OPERATION THAT SUCCEEDED IS NOT RUN AGAIN (2026-09-23, merged and deployed in 2148)

Owner, after reproducing the recorded remainder independently through the
route with supplied answers (`components` + `images` + `tsx`, the picture step
failing, `write_tweak` twice, debits `[3, 2]`, the swap reversed, *"Updated the
look"* naming only the picture failure): *"Preserving step order is necessary,
but replaying the full request and undoing its result is still incorrect. …
Ensure the same requested page change is not applied twice across an
intervening step. Preserve genuine picture dependencies and ordering; do not
blindly merge across them."* **Reviewed and CLOSED by the owner (81 focused
cases passing), merged and deployed in deploy 2148 — the next section. No paid
run; the supplied-answer limit is kept.**

**THE REMAINDER, REPRODUCED ON BOTH MONEY PATHS BEFORE THE FIX** (this file's
harness in `test/edit-page-once.test.mjs`, one page, a reframe as the
successful picture change):

| picture step | page-writer calls | what shipped | charged | screen |
|---|---|---|---|---|
| fails (its model unreachable) | **2**, the second shown the first's output | the swap **undone**, the card kept | **3 + 2** (reserved 3, then 2) | *"✅ Updated the look. ⚠️ I couldn't reach the model that picks the picture — try again in a moment."* |
| succeeds (a reframe) | **2** | the swap **undone**, the reframe kept | **3 + 1 + 2** (reserved 3, 1, 2) | *"✅ Updated the look."* — a success sentence over a lost change |

**THE FIX IS ONE RULE AT THE STEP LOOP, AND IT MOVES NOTHING.**
`pageStepDone(step, done)` (`builder/site-lanes.mjs`): a page step running the
customer's sentence, on a page where an earlier such step already SUCCEEDED,
is not run; its lanes are folded onto the step that did the work, so `lanes`
still names every one. The steps keep their order and nothing is merged across
the picture step.
- **SKIPPED ONLY AFTER A SUCCESS, AND ONLY A RECORDED ONE** (`failed ===
  false`). An earlier step that was withheld or failed leaves the request
  undone, and the later step completes it — on the state the picture rung left,
  which is the dependency the order exists for. An entry that cannot say lets
  the later step run: cannot-tell degrades to the old path, never to dropped
  work.
- **ONE DEFINITION OF "THE SAME OPERATION"** — `samePageOperation`: both steps
  the page rung on the customer's sentence (no ask of their own, every field a
  page lane) on the same page. Asked by `mergePageSteps`, `pageStepDone` and
  the supersede below; the adjacent merge's arrow predicate moved into it
  unchanged (`sentencePageStep`).
- **AND THE MIRROR, FOUND BY THE DEPENDENCY CONTROL.** When a later attempt of
  the same operation SUCCEEDS, the earlier attempt's refusal is **superseded**:
  kept in `done` (its lanes and its cost stay on the reply), dropped from
  `failures`. **Measured on HEAD and pre-existing, not caused by the skip**: the
  dependency case — first page attempt withheld for a photograph, the picture
  step takes it off, the second attempt ships the swap — printed *"⚠️ I
  couldn't make that change … so I didn't make it"* beside the change that
  shipped. **Superseded only by the same operation**: a picture step that fails
  BEFORE a page step that ships stays on the screen (a control).

**AFTER, SAME ROUTE, SAME ANSWERS, BOTH MONEY PATHS:**
- **picture FAILS** → **1** page-writer call (shown the stored page), then the
  picture step; the swap once and the card; the photograph untouched; debits
  **`[3]`**, reserved **`seq 1: 3`**; `layers ["page"]`; *"✅ Updated /. ⚠️ I
  couldn't reach the model that picks the picture — try again in a moment."*
- **picture SUCCEEDS** → 1 page-writer call, then the reframe; the swap once,
  the card, `focus="top"` kept; debits **`[3, 1]`**, reserved **`3, 1`**;
  `layers ["page", "picture"]`; *"✅ Updated the look."*
- **both are asserted EQUAL to `components` + `images`** — the same
  publication, the same bill, the same refusals, the same screen — because a
  page lane after the picture lane adds no page operation.
- **the DEPENDENCY** → page (withheld, 409, cost 0), picture (takes the bench
  off), page (runs, shown the picture step's result, ships the swap once);
  debits **`[2, 2]`**, reserved **`2, 2`**; no refusal on the reply;
  *"✅ Updated the look. One photograph is no longer on the site. If that was
  not what you wanted, say "put the photo back". There is a space for a photo
  — upload yours in the Data panel and it'll fill in."*

**THREE PRE-EXISTING CASES DROVE TWO SUCCESSFUL PAGE RUNS ACROSS THE PICTURE
STEP — the shape this fix makes unreachable — and each moved to a shape that
still carries its property, re-anchored rather than appeased:**
- `edit-page-context`'s snapshot case → `components` + `images`, the page step
  changing `card-a` and the picture step reframing a photograph inside
  `card-b`. The picture rung reads `editParts()` and hands every component to
  `publishStep`, so without the snapshot's advance it republishes the stored
  `card-a`. **Probed: cutting the advance fails it** (*"the picture step handed
  over the stored one"*), `worker.js` restored byte-identical from the
  scratchpad.
- `edit-page-protect`'s withheld-component case → `images` + `tsx`: the picture
  step reframes first and the page step, second, withholds `card-b` — the
  look-shaped merge with the warning on the LATER rung, and the screen naming
  it.
- `edit-page-protect`'s frame case → `components` + `images`: the page step
  leaves an empty frame and the picture step fills it with the owner's upload;
  the publication has none and the reply says none. Renamed *"an empty frame a
  LATER rung filled is not reported"*; the test bucket learned to list uploads.
- **`edit-failure`'s all-refused case is UNCHANGED**, and correctly: both of its
  page steps answer *no change*, so the first did not succeed and the second
  still runs.

**EVIDENCE.** `test/edit-page-once.test.mjs`, **10 cases**: the old ordering
case replaced by three route cases — the picture step failing, succeeding, and
the dependency with its different-operation control — each on both money
paths, plus one unit case for the rule. **Red 3 of 40 against HEAD's route**
across the three touched files (the new helpers copied into a throwaway
worktree so the file loads), each on its own gate: the owner's two on *"the
page operation ran again after the picture step"*, the dependency on *"the
superseded refusal was reported beside the change that shipped"* — its calls,
layout and charges PASSED on HEAD, so the order was always right and only the
reply was wrong. **Focused mutation check `scripts/mutants/page-replay.json`: 10
mutants, 10 killed, 0 survived, 0 never applied, the comment-only control
surviving**, against the eight edit-path files that can see the change; both
swept files byte-identical to their pre-sweep hashes afterwards. One comment
in `site-lanes.mjs` was reworded after the sweep, proved comment-only by a diff
against the swept copy, and the eight files re-run green (**193 / 193**).
(`page-once.json`'s
anchors name the arrow predicate that is now `sentencePageStep`; the ask and
field rules are re-covered here, R-5 and R-6.) **Suite 7,230 locally, taken twice** (`# tests 7230 / # pass 7230 / # fail 0 /
# skipped 0`, `duration_ms` 117,572 and then 117,219 on the final tree, after
the comment rewording) — **+3 against 7,227**, exactly this change's net cases:
the file goes 7 → 10, and the three re-anchored cases replaced their old
versions one for one.
**AND THE CI UNIT HALF MATCHES**: run **`35921456483` on `bee51307`** reads
**`# tests 7230 / # pass 7226 / # fail 0 / # skipped 4`** (`duration_ms
107,507`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all seven new or re-anchored cases found passing BY NAME (`ok
1735` in `edit-page-context`, `ok 1770`–`1772` and `1775` in the new cases,
`ok 1794`–`1795` in `edit-page-protect`) and zero `not ok` lines in the
downloaded log. **AND `site build` run `35921456542` on `bee51307`**
(21:17:04 → 21:42:28Z, **25m24s**, all twenty steps) read all twelve counts
green out of its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build
**382**, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all
passed`, census 7 + 4 + 1 = **12**; the two known `##[error]` annotations
(`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the case that
compiles a broken page on purpose, the second followed by the two SSR-stream
lines and then its own `ok`, `tsc`-format lines 9 / 2 / 7; `site-build.mjs`
**18m37s**. **The stamp chain ends at `bee51307`.**
**⚠ WHAT IT DOES NOT CLAIM**: every model answer is SUPPLIED and every writer is
a stub that applies the ask to what it is shown, so this proves the route runs
the page operation once, keeps the order and the picture step's result, bills
once and says what shipped — never that a real model's first page attempt
applies the whole request, which is the premise the skip rests on.

### MERGED AND DEPLOYED: DUPLICATE EXECUTION CLOSED (2026-09-23, late)

Owner: *"The duplicate-execution correction is reviewed: all 81 focused cases
pass. Close the reproduced duplication defect, retaining the limit that these
tests supply model answers. Merge and deploy the reviewed correction,
preserving newer main work. Report the actual deployed SHA and image. No paid
replay."*

- **CLOSED, WITH THE LIMIT KEPT**: the route runs one requested page change
  once — neighbouring page lanes as one operation, and across another rung the
  later step only where the earlier did not succeed. Every model answer in the
  evidence is SUPPLIED, so no claim is made that a real model's first page
  attempt applies the whole request.
- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `90045638` →
  **`d7890bab`** at **22:22:15Z**, 4 commits, 10 files (+1,618 / −115): both
  page-once fixes, their tests and mutation specs, and the two documents.
  Asked before the push: zero runs in progress or queued, the image id
  predicted over both ends (the nineteenth cross-check, below), and the
  rollback verified in a throwaway worktree — reverting the range gives tree
  `fde516bb…`, **main's own**, so a rollback reuses `1aba925de4658f45`.
- **DEPLOY 2148 (`35927959426`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  job 22:22:20 → 22:25:19Z, **2m59s**; image step **2m08s** with **0 `CACHED`
  lines** (cold again, inside the warm band); Wrangler 23s. `DEPLOY_ID`
  **`d7890bab48828d6092399571d050eb02536973ac`** (masked in the log as
  `…9239957***d050eb…`); image **built `bb412dcada44c503`** (registry answered
  404, 185 inputs — the log prints `bb4***2dcada44c503`) and **rolled from
  `1aba925de4658f45`** (`- …:***aba925de4658f45` → `+ …:bb4***2dcada44c503`
  under `SUCCESS Modified application`, `Applied changes`); `Uploaded
  isibi-app`, `Current Version ID: 36990fe3-…`, `Deployed isibi-app triggers`.
  **`No updated asset files to upload`** — `public/` did not change — so there
  is **no served-file check**. Gates **401 / 401 / 401 / 404** at 22:26:15Z.
- **THE NINETEENTH IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH**:
  `origin/main` answered `1aba925de4658f45` (what deploy 2147 rolled to) and the
  tip `bb412dcada44c503`, both from 185 inputs, `builder/site-lanes.mjs` and
  `worker.js` the two of the push's ten files among them.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `d7890bab48828d6092399571d050eb02536973ac` and `expect_image`
  `bb412dcada44c503` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token. **No paid replay** (owner).

### A PAGE VERB BELONGS TO ITS OWN STEP (2026-09-23, merged and deployed in 2149)

Owner, after reproducing it through the route: *"On the home page put the
opening hours above the welcome, and remove the gallery page." With shape +
pages/remove, no page writer runs. The gallery is removed, the homepage stays
unchanged, and the reply warns that the homepage cannot be removed. Scope
remove and move/rename instructions to their individual operation and target,
not shared request-wide flags. An ordinary layout step must not inherit another
step's destructive action.* **Reviewed and CLOSED by the owner (251 focused and
regression tests passing), merged and deployed in deploy 2149 — the next
section. No paid run; the supplied-answer limit is kept.**

**THE DEFECT, MEASURED THROUGH THE ROUTE ON HEAD `67c010fd`** (supplied
answers; four pages — `/`, `/prices`, `/gallery`, `/visit` — none linking to
another, so a wrong removal or move lands rather than being stopped by the
merge's own link check; the job path identical):

| message | page writers | what shipped | charged | the customer's screen |
|---|---|---|---|---|
| home layout + remove `/gallery` | **0** | the gallery removed, the home page unchanged | 0 | *"✅ Took /gallery off the site. Every publish is kept, so say the word if you want it back. ⚠️ I left / — that is the home page, and removing it would leave the site with no front door."* |
| `/prices` layout + remove `/gallery` | **0** | **`/prices` DELETED** as well as the gallery | 0 | *"✅ Updated the look."* |
| home layout + move `/gallery` → `/photos` | **0** | the gallery moved, the home page unchanged | 0 | *"✅ Updated /gallery. ⚠️ I couldn't move that page — the home page has no address to move."* |
| `/prices` layout + move `/gallery` → `/photos` | **0** | **`/prices` MOVED to `/photos`**; the gallery's own move refused | 0 | *"✅ Updated /prices. ⚠️ I couldn't move that page — there is already a page at /photos."* |
| the router's `remove` (picture door) + a `/prices` layout lane | **0** | **`/prices` DELETED** | 0 | *"✅ Took /prices off the site. Every publish is kept, so say the word if you want it back. ⚠️ I couldn't find a photograph on your site that I can change. …"* |

- **THE HOME PAGE'S OWN PROTECTION IS WHAT HID IT.** In the owner's
  reproduction the layout step's inherited removal was REFUSED (the home page
  cannot go), which is why the damage looked like a missing layout change.
  Aimed at `/prices`, nothing refused it: the page was deleted, and the screen
  said *"✅ Updated the look."* — **byte-identical to what the fixed code says
  when it works**, so from the screen the deletion was invisible.
- **"CHARGED 0" IS NOT A SAVING.** The removal and move branches are free and no
  writer ran, so the picker call went unbilled (our cost) — the customer paid
  nothing for a message that deleted or moved the wrong page and did not make
  the change they asked for.
- **TWO SOURCES OF ONE FLAG.** (1) The `pages` step WROTE the picker's verb into
  the message-wide `let`s while the steps were being built, so every page step
  read it. (2) The router's own `remove`, read off the body, opens the lane door
  for `picture` and `nav` — and a page lane the picker named beside the picture
  lane read that same flag (row five).

**THE FIX: A VERB RIDES ON THE STEP IT WAS GIVEN TO.** The `pages` step carries
`{remove, rename}` from the picker's verb and target; the router's own step
(the non-look branch, and the removal door's fall-through) carries the
router's; `runLayer(eLayer, ePage, pickedFields, eRemove, eRename)` takes the
STEP's verb under the two names every branch already reads — the precedent
`eLayer`/`ePage` set — so the router's are shadowed inside it and no rung can
read another step's. The router's two are `const` now. **The logo rung reads the
step's `eRemove` too** — equal to the body's on every path that reaches it (no
lane dispatches to `logo`), so that line is argued in the code and no case can
separate the two.

- **THE DUPLICATE-EXECUTION FIX CANNOT ABSORB A VERB STEP**, measured rather
  than assumed: `sentencePageStep` requires at least one field and every field a
  page lane — the `pages` step's one field is not a page lane
  (`laneLayer("pages")` is null) and the router's own step has no fields. So
  `mergePageSteps` never joins a verb step and `pageStepDone` never skips one.
  **`site-lanes.mjs` is untouched.**
- **UNCHANGED, AND SAID**: a picker that folds `pages` under `removes` without a
  `pageName` still targets the page the ROUTER named (`name: ePage || ""`) —
  the named-page section's recorded consequence — and the picker's own
  `pageName` still wins when it gives one.
- **THE QR PLACEMENT STEP WAS THE SAME CLASS**: a page step with an ask of its
  own, so `qr` beside `pages` would have run the placement down the removal or
  move branch on its page. It carries no verb now — **by construction, not
  driven by a case**.

**AFTER, SAME ROUTE, SAME ANSWERS, BOTH MONEY PATHS**: each layout case runs
**1** page writer, shown the stored target page; **1** compile carries the
layout change AND the verb's result; the unrelated pages are byte-identical in
the payload and the store; debits **`[3]`** (synchronous) / **reserve seq 1 = 3**
(job), nothing refunded; `layers ["page", "page"]`, no `partial`; `removed:
["gallery.tsx"]` or `renamedTo: "/photos"`. The picture door: `/prices` laid
out and KEPT, `partial [picture no-slots]`, *"✅ Updated /prices. ⚠️ I couldn't
find a photograph on your site that I can change. If you'd like one added, say
which page it should go on and where."*

- **⚠ THE COMBINED REPLY NAMED NEITHER CHANGE**: *"✅ Updated the look."* The
  merged reply lands on the browser's look branch, which read no `removed`, no
  `renamedTo` and no page, and `renamedTo` had no reader in the browser at all,
  so a standalone move said *"✅ Updated /gallery."* — the OLD address. Left
  exactly as it was by this fix and asserted, so changing it was a decision
  made on purpose: **it is the next section, *the reply names the page
  operations that shipped*.**

**EVIDENCE.** `test/edit-page-verb.test.mjs`, **17 cases**: layout + removal
and layout + move on the home page AND on `/prices`, each on both money paths
(8); the picture door (1); two layout lanes beside a removal — one page
operation, the removal its own step (1); and **7 controls** — the router's own
removal and move on both paths, the `pages` lane's removal and move alone, and
the `/prices` layout alone. Every case asserts the writer's calls and the file
it was shown, the compiler payload and the store page by page, the unrelated
pages byte-identical, the money on its path, and the customer's exact sentence
through `editBrowserReply`. **Red 10 of 17 against `67c010fd`** in a throwaway
worktree, each on its first gate (*no page writer ran*); **with that gate cut in
the throwaway copy every one of the ten still fails on the compiler payload**
(the home page unchanged, or `/prices` missing from the page set), so each layer
sees the defect alone. The 7 controls pass on both sides, and
`edit-page-once.test.mjs` — the duplicate-execution controls — is unchanged and
green.
**Four pre-existing guards re-anchored to what they assert**: `edit-parts` (the
call's POSITION between the ask being set and restored, anchored on the call
without its whole argument list), `removal-door` (the door's fall-through is
still the router's own layer and page, now carrying the router's verbs),
`site-ask` (`const eRemove`, read strictly off the body) and `edit-path` (a
comment quoting the deleted line).
**Focused mutation check `scripts/mutants/page-verb.json`: 7 mutants, 7 killed,
0 survived, 0 never applied, the comment-only control surviving**, against 13
files (`edit-page-verb`, `edit-page-once`, `edit-failure`, `edit-path`,
`removal-door`, `site-ask`, `edit-parts`, `site-delete`, `edit-lanes`,
`edit-page-target`, `edit-page-context`, `edit-page-protect`, `site-apply`):
the `pages` step losing its removal, losing its move, the loop forwarding the
ROUTER's verbs, any step's verb reaching every step (the defect restored), the
router's own step without its verbs, without its move, and `runLayer`'s
parameter renamed so the page rung reads the router's flag. `worker.js`
byte-identical to its scratchpad backup afterwards. **Two lines left out of the
sweep, and said**: the door step's verbs (inert today — the `picture` and `nav`
rungs read neither) and the logo rung's read (equivalent on every reachable
path).
**Suite 7,247 locally** (`# tests 7247 / # pass 7247 / # fail 0 / # skipped 0`,
`duration_ms 117,405`) — **+17 against 7,230**, exactly this file's cases; the
re-anchors added assertions, not cases.
**AND THE CI UNIT HALF MATCHES**: run **`35930143106` on `9ca86137`** reads
**`# tests 7247 / # pass 7243 / # fail 0 / # skipped 4`** (`duration_ms
110,793`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all seventeen cases found passing BY NAME (`ok 1823`–`1839`) and
zero `not ok` lines in the downloaded log. The docs-only `9dd117df` reads the
same four numbers on run `35930280497`, so the pair off CI says that commit
moved the suite by zero. **AND `site build` run `35930143439` on `9ca86137`**
(22:46:16 → 23:11:56Z, **25m40s**, all twenty steps) read all twelve counts
green out of its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build
**382**, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all passed`,
census 7 + 4 + 1 = **12**; the two known `##[error]` annotations
(`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the case that
compiles a broken page on purpose, the second followed by the two SSR-stream
lines and then its own `ok`; `tsc`-format lines 9 / 2 / 7, **the same nine
lines as run `35921456542`'s** (counted over any `.tsx(l,c): error TS` line — a
reader limited to `src/routes/` answers 8 / 2 / 6, missing the kit's
`chart-bar-label.tsx` line); `site-build.mjs` **18m34s**. The documents-only
commits after it fire no site build. **The stamp chain ends at `9ca86137`.**
**⚠ WHAT IT DOES NOT CLAIM**: every model answer is SUPPLIED and the page writer
is a stub that applies the layout to the file it is shown, so this proves the
route scopes each verb to its own step and target — never that a real picker
names these lanes and this verb, nor that a real writer makes the layout change.

### MERGED AND DEPLOYED: THE PAGE-VERB CORRECTION (2026-09-23, late)

Owner: *"The page-verb correction is reviewed: 251 focused and regression tests
pass. Close the shared-flag defect, keeping the supplied-model-output
limitation explicit. Merge and deploy the reviewed correction, preserving newer
main changes. Report the actual deployed SHA and image. No paid replay."*

- **CLOSED, WITH THE LIMIT KEPT**: a remove or move verb rides on its own step
  and target, so a layout step beside it can no longer remove or move its own
  page, and the router's own verb reaches only the router's step. Every model
  answer in the evidence is SUPPLIED and the page writer is a stub, so no claim
  is made that a real picker names these lanes or a real writer makes the
  layout change.
- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `d7890bab` →
  **`d86aa232`** at **23:53:09Z**, 5 commits, 9 files (+1,006 / −57): the fix
  in `worker.js`, its 17-case test file and mutation spec, four re-anchored
  guards, and the two documents. Asked before the push: `HEAD..origin/main`
  empty, zero runs in progress or queued, the image id predicted over both ends
  (the twentieth cross-check, above), and the rollback verified in a throwaway
  worktree — reverting the range gives tree `79b0e0b7…`, **main's own**, so a
  rollback reuses `bb412dcada44c503`.
- **DEPLOY 2149 (`35935786369`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  job 23:53:17 → 23:56:11Z, **2m54s**; image step **2m14s** with **0 `CACHED`
  lines**; Wrangler 15s. `DEPLOY_ID`
  **`d86aa232687d4a0e56e9ce5d75c503dbb9e3fc38`** (unmasked in the log); image
  **built `d6d603e4a7921f14`** (registry answered 404, 185 inputs — the log
  prints `d6d603e4a792***f***4`) and **rolled from `bb412dcada44c503`**
  (`- …:bb4***2dcada44c503` → `+ …:d6d603e4a792***f***4` under `SUCCESS
  Modified application`, `Applied changes`); `Uploaded isibi-app`, `Current
  Version ID: 242ee8f5-…`, `Deployed isibi-app triggers`. **`No updated asset
  files to upload`** — `public/` did not change — so there is **no served-file
  check**. Gates **401 / 401 / 401 / 404** at 23:57:52Z.
- **THE TWENTIETH IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH**:
  `origin/main` answered `bb412dcada44c503` (what deploy 2148 rolled to) and the
  tip `d6d603e4a7921f14`, both from 185 inputs, `worker.js` the one of the
  push's nine files among them.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `d86aa232687d4a0e56e9ce5d75c503dbb9e3fc38` and `expect_image`
  `d6d603e4a7921f14` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token. **No paid replay** (owner).

### THE REPLY NAMES THE PAGE OPERATIONS THAT SHIPPED (2026-09-24, merged and deployed in 2150)

Owner: *"Layout + removal must identify the edited page and the removed page.
Layout + move must identify the edited page and the move's old and new
addresses. A standalone move must report the move, not "Updated" at the old
address. Use successful operation results, not the request's wording, as
evidence. Preserve partial-failure warnings and do not describe a refused
removal or move as completed. … Keep this to operation reporting—not a
requirements redesign."* **Reviewed by the owner (263 focused and regression
tests, both CI checks green), merged and deployed in deploy 2150** — no paid run.

**MEASURED THROUGH THE ROUTE BEFORE THE CHANGE** (supplied answers, the
page-verb fixture): all four combined cases said *"✅ Updated the look."*; a
move on its own said *"✅ Updated /gallery."*; and a refused removal or move
beside a layout change was ALREADY right — *"✅ Updated /prices. ⚠️ I left / —
that is the home page…"* — because the one step that succeeded lands on the
page branch and the refusal rides `partial`. **The combined reply could not
have said more**: the merge's catch-all keeps the FIRST `page`, so *"lay out
/prices and move the gallery to /photos"* replied `page: "/prices"` beside
`renamedTo: "/photos"`, and the move's starting address was on no field at all.

**THE ROUTE CARRIES `pageOps`**: one entry per page step that SUCCEEDED, in the
order it ran, each `{page, removed, renamedTo}` read off that step's own reply —
`removed` the files the merge really took away, `renamedTo` the address
`renameRoute` really published. Built from `ranOk`, so a refused step cannot be
listed; it stays on `partial`, in its own words.

**THE BROWSER HAS ONE COMPOSER FOR IT, `pageOpsSaid`**, and both shapes go
through it: the page branch (a single page step's reply is read as its own
entry) and the look branch (a multi-step reply). `pageOpVerb` is the one
reading of which operation an entry was. The old removal branch's sentence is
byte-identical through the new composer.
- **THE LOOK BRANCH USES IT ONLY WHEN AN ENTRY REMOVED OR MOVED A PAGE**, so
  every other multi-step sentence — page + picture, css + layout — reads as it
  did. With nothing else to name, the page operations ARE the sentence; beside
  a look change they follow it. **⚠ The `lookNote` early return appended them
  too, and that was half a fix**: *"✅ Your site already looks like that —
  nothing to change."* had been the WHOLE reply over a removal that shipped,
  and appending the removal left it claiming the whole message had nothing to
  change beside a change that shipped. The owner caught it — next section.
- **ONE PAGE, ONE CLAUSE**: two successful steps on one page are named once.
  Reachable by reading, not driven: the QR placement step carries an ask of its
  own, so `samePageOperation` never joins or skips it beside a layout step on
  the same page.

**WHAT THE CUSTOMER SEES NOW** (exact, all asserted): *"✅ Updated /prices and
took /gallery off the site. Every publish is kept, so say the word if you want
it back."* · *"✅ Updated /prices and moved /gallery to /photos."* · *"✅ Moved
/gallery to /photos."* · a refused removal or move beside a layout change
unchanged (*"✅ Updated /prices. ⚠️ I couldn't move that page — there is already
a page at /visit."*) · a standalone refusal unchanged.

**THE DISCRIMINATOR BETWEEN RESULT AND REQUEST**: a move asked for as
*"/Photos/"* reaches the step as `"/photos/"` (the picker's reader lowercases)
and is published by `renameRoute` as `"/photos"`; the reply says `/photos`. A
reply composed from the request would say `/photos/`, and a mutant doing
exactly that is killed by that one case.

**⚠ FOUND ON THE WAY, NOT CHANGED**: a refused standalone move answers without
`unchanged: true` (a refused removal carries it), so its screen has no
whole-request note — *"⚠️ I couldn't move that page — there is already a page at
/visit."* and nothing after it. It never claims the move happened; recorded, not
fixed. And the old removal branch appended `problemNote` itself while the
wrapper appends it again — a double that could never fire, a removal's reply
carrying no `problems`, and the text branch has the same latent twin.

**EVIDENCE.** `test/edit-page-verb.test.mjs`, **17 → 29 cases**, every one
through the real route and the browser's own composer, asserting the stored
pages, the compiler payload, the money and the exact sentence: the four
combined cases and the joined-layout case now assert `pageOps` and the new
sentence; the standalone move (router, both paths; pages lane) asserts *"✅
Moved /gallery to /photos."*; **new**: a refused removal and a refused move
beside a layout change (both paths), a refused move and a refused home-page
removal on their own (both paths), the `/Photos/` discriminator, a stylesheet
change beside a removal, an unchanged look beside a removal (its expectation
corrected by the next section — it asserted the misleading sentence), and the
one-clause composer case. **Red 20 of 29 against unfixed `9a4d1787`** in a throwaway
worktree; **with the `pageOps` assertion cut, 16 of 29 fail on the sentence
alone** — the four partial-success cases then pass, their sentences having
been right already, so they fail on the unfixed code only on the missing
field. The 9 green on both are the controls (the standalone removals, the
layout alone, the picture door, the four standalone refusals).
**Two pre-existing guards went red and neither was appeased**: `site-apply`'s
landmark window (`const was = imageSources(…)` → `const merged = {`) grew by the
new block, and the block MOVED rather than the window widening — it reads only
`ranOk`, so it sits beside `flat` and `last`; `site-ask`'s *"the customer is
told the page went"* matched the old composer's spelling (`'Took ' + (gone`) and
now DRIVES the composer on the removal rung's reply shape.
**Focused mutation check `scripts/mutants/page-reply.json`: 16 mutants, 16
killed, 0 survived, 0 never applied, the comment-only control surviving**,
against the 24 files that can see the change (the edit-path and reply tests,
`site-ask`, `site-apply`, `free-identifiers`, `wiring`): four in the route (a
refused step listed, the move's address and the removal taken from the
REQUEST, the field off the reply), eleven in the composer (the old
removal-only branch, page operations composed without a verb, dropped as the
sentence / after the look / after `lookNote`, a move said as an update, either
verb unrecognised, the removal's "every publish is kept", the "and", the
one-clause rule) and one in the harness (the composer not cut out of
`chat.js`). All three swept files byte-identical to their pre-sweep hashes
afterwards. **Two mutants were left out and are inert by construction, said
here rather than swept**: the entry's `page` taken from the step (the page
rung's `wantRoute` IS the step's page, lowercased by both readers), and the
removal named by the step's page rather than the files (`sitePathOf` of the
removed file IS that page on every fixture). **Suite 7,259 locally** (`# tests
7259 / # pass 7259 / # fail 0 / # skipped 0`, `duration_ms 121,328`) — **+12
against 7,247**, exactly this file's new cases; the `site-ask` re-anchor
added an assertion, not a case.
**AND THE CI UNIT HALF MATCHES**: run **`35937632664` on `45ea3eec`** reads
**`# tests 7259 / # pass 7255 / # fail 0 / # skipped 4`** (`duration_ms
113,089`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all twenty-nine of this file's cases found passing BY NAME (`ok
1823`–`1851`), the re-anchored `site-ask` case as `ok 3868`, and zero `not ok`
lines in the full downloaded log (44,611 lines; the job-log tool returns only
its tail, so the run's log archive is what was read). **AND `site build` run
`35937632658` on `45ea3eec`** (00:16:06 → 00:40:09Z, **24m03s**, all twenty
steps) read all twelve counts green out of its per-step files: TAP
397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases 16,
theme-seam 11, theme-render 29, site-routing 14, site-runtime 47, kit-render /
kit-a11y / kit-effects / kit-paint `all passed`, census 7 + 4 + 1 = **12**; the
two known `##[error]` annotations (`index.tsx(50,13) TS2322`,
`menu.tsx(27,17) TS2339`) inside the case that compiles a broken page on
purpose, each directly above its own `ok` line this time; `tsc`-format lines
9 / 2 / 7, the same nine lines as run `35930143439`'s; `site-build.mjs`
**17m26s**. **The stamp chain ends at `45ea3eec`.** **The supplied-answer
limit holds**: this proves what the reply says about operations the route
performed, never that a real model makes the layout change.

### A LOOK THAT CHANGED NOTHING SPEAKS FOR THE STYLING ALONE (2026-09-24, merged and deployed in 2150)

Owner, after checking the reply correction (263 focused and regression tests,
both CI checks green): *"When the stylesheet already matches and the gallery is
successfully removed, the real browser composer says: "Your site already looks
like that — nothing to change. Took /gallery off the site." Scope the
no-change statement to the design operation that did nothing. … Do not
describe the whole request as having nothing to change when another operation
shipped. … Use the operation result to determine the scope."* **Reviewed by the
owner (71 focused tests, unit CI green; *"No further wording expansion is
needed"*), merged and deployed in deploy 2150** — no paid run.

**MEASURED ON HEAD `f4e28dc8`, THROUGH THE ROUTE AND THE BROWSER'S OWN
COMPOSER** (supplied answers, the stored sheet already the one asked for):
styling + removal *"✅ Your site already looks like that — nothing to change.
Took /gallery off the site. Every publish is kept…"*; styling + move *"… nothing
to change. Moved /gallery to /photos."*; and **styling + a layout change on
/prices *"✅ Your site already looks like that — nothing to change."* — the
WHOLE reply, over a layout change that shipped.** That third one is older than
the reply correction: the early return printed the look's note alone from the
day the note existed, and the correction only appended page operations that
removed or moved a page.

**THE SERVER SCOPES THE NOTE, FROM THE STEPS' OWN RESULTS.** `lookNote` is
composed server-side and the browser prints it verbatim, and the merge is where
every step's result is known — so the merge decides: a SUCCESSFUL step carrying
no note is an operation that shipped, and beside one the note is *"The
requested styling was already in place."*; otherwise it is the step's own
sentence. Read off `ranOk`, never off the request's lanes or verb. **A step
answering `ok` that wrote nothing would read as shipped** — none does in the
look door today (every `ok: true` the edit route answers is a write, checked by
listing them) — and that errs the safe way: the scoped sentence is true either
way, and only the whole-message one can be false.
- **AND THE BROWSER NAMES EVERY PAGE OPERATION THAT SHIPPED AFTER THE NOTE**,
  an ordinary edit included (`pageOpsSaid(ops)`, not `opsSaid`): with the look
  having changed nothing, nothing else in that branch can say what shipped. The
  non-note path is unchanged — there a verb-less page edit is still unnamed
  beside "Updated the look".
- **A TAB STILL RUNNING THE DEPLOYED `chat.js`** prints the note verbatim, so it
  gets the scoped sentence without the new composer: never the whole-message
  claim, only without the page operations after it.

**WHAT THE CUSTOMER SEES NOW** (exact, all asserted): *"✅ The requested styling
was already in place. Took /gallery off the site. Every publish is kept, so say
the word if you want it back."* · *"✅ The requested styling was already in
place. Moved /gallery to /photos."* · *"✅ The requested styling was already in
place. Updated /prices."* · and on its own, unchanged: *"✅ Your site already
looks like that — nothing to change."*

**⚠ A REFUSED OPERATION SHIPPED NOTHING, SO BESIDE ONE THE LOOK'S OWN SENTENCE
STANDS** — the owner's rule taken literally (*"when another operation
shipped"*), and recorded as a decision rather than left to be found: styling +
a refused removal of `/` reads *"✅ Your site already looks like that — nothing
to change. ⚠️ I left / — that is the home page, and removing it would leave the
site with no front door."*, the refused removal never described as done.
Scoping it there too is one condition, and the sweep's S-2 mutant is that
condition (`done.length > 1` for "a successful step without the note") — killed
by the two refused-operation controls, so the choice is pinned whichever way the
owner takes it.

**WHAT IT DOES NOT NAME**: a picture, menu or address change beside an
unchanged look gets the scoped sentence alone — the look branch names none of
those in any multi-step reply (the review's #9, next-task 3). The scoped
sentence is true of what it names and claims nothing about the rest.

**EVIDENCE.** `test/edit-page-verb.test.mjs`, **29 → 35 cases**: the
unchanged-styling case's expectation corrected and run on both money paths;
new: styling + move, styling + a layout change, and three controls — styling on
its own, and styling beside a refused removal and a refused move — each
asserting the stored pages, the compile count, `pageOps`, the note on the wire
and the exact screen. **Red 4 of 35 against unfixed `f4e28dc8`** in a throwaway
worktree — the removal (both paths), the move and the layout case, each first
on the note on the wire; **with those assertions cut, all four still fail on
the sentence alone**, the layout case reading *"nothing to change"* as its
whole reply. The controls pass on both sides. The edit-path set — 34 files —
**867 / 867**. **Focused mutation check `scripts/mutants/look-scope.json`: 6
mutants, 6 killed, 0 survived, 0 never applied, the comment-only control
surviving** — the note never scoped, scoped beside a refused step, scoped with
the look alone, scoped only by a verb; the browser naming only a verb after the
note, and nothing after it — against the same 34 files; both swept files
byte-identical to their pre-sweep hashes afterwards. **Suite 7,265 locally**
(`# tests 7265 / # pass 7265 / # fail 0 / # skipped 0`, `duration_ms 121,875`)
— **+6 against 7,259**, exactly this file's new cases.
**AND THE CI UNIT HALF MATCHES**: run **`35941990927` on `d4ae8af7`** reads
**`# tests 7265 / # pass 7261 / # fail 0 / # skipped 4`** (`duration_ms
121,097`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all thirty-five of this file's cases found passing BY NAME (`ok
1823`–`1857`) in the full downloaded log archive, and **zero `not ok N` result
lines**. **⚠ A BARE `grep -c "not ok"` ANSWERS 4 ON THAT GREEN LOG**: two test
names contain the words *"is not ok"*, each printed twice (`# Subtest:` and its
own `ok` line). Count result lines anchored as `ok N -` / `not ok N -`, never
the phrase.
**AND `site build` run `35941990957` on `d4ae8af7`** (01:13:43 → 01:36:45Z,
**23m02s**, all twenty steps) read all twelve counts green out of its per-step
files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases 16,
theme-seam 11, theme-render 29, site-routing 14, site-runtime 47, kit-render /
kit-a11y / kit-effects / kit-paint `all passed`, census 7 + 4 + 1 = **12**; the
two known `##[error]` annotations (`index.tsx(50,13) TS2322`,
`menu.tsx(27,17) TS2339`) inside the case that compiles a broken page on
purpose; `site-build.mjs` **16m42s**. **The stamp chain ends at `d4ae8af7`.**

### MERGED AND DEPLOYED: THE REPORTING CHANGES (2026-09-24)

Owner: *"The scoped no-change correction passes review: 71 focused tests pass,
and unit CI is green. No further wording expansion is needed. Once the current
site build passes, merge and deploy the reviewed reporting changes, preserving
newer main work. Report the actual deployed SHA and image. No paid replay."*
Both corrections above — the reply naming the page operations that shipped, and
the look's no-change sentence scoped to the styling — plus their CI stamps.

- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `d86aa232` →
  **`4df02867`** at **01:39:42Z**, 5 commits, 9 files (+1,110 / −51), pushed
  only after `site build` run `35941990957` finished green. Asked before the
  push: `origin/main` unmoved, zero runs in progress or queued, the image id
  predicted over both ends (the twenty-first cross-check, above), and the
  rollback verified in a throwaway worktree — reverting the range gives tree
  `6b081e00…`, **main's own**, so a rollback reuses `d6d603e4a7921f14`.
- **DEPLOY 2150 (`35943904626`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  01:39:44 → 01:42:37Z, **2m53s**; image step **2m03s** with **0 `CACHED`
  lines**; Wrangler 18s. `DEPLOY_ID` **`4df028677ffef22cbe4399049fe6b4009bf2112f`**
  (the log prints `…4009bf2***2f`, the `***` a masked `11`); image **built
  `67a81b55332be3a9`** (registry answered 404, 185 inputs — the log prints
  `67a8***b55332be3a9`) and **rolled from `d6d603e4a7921f14`** (`- …:d6d603e4a792***f***4`
  → `+ …:67a8***b55332be3a9` under `SUCCESS Modified application`, `Applied
  changes`); `Uploaded isibi-app`, `Current Version ID: 1e7018c7-…`, `Deployed
  isibi-app triggers`.
- **THE SERVED-FILE CHECK, BOTH READINGS TAKEN**: `public/` changed, so
  Wrangler answered `+ /chat.js`, 1 file, 85 already uploaded. **Before** (taken
  at 01:27:27Z, before the push): 736,749 bytes, sha256 `bf745e7118484cad` —
  byte-identical to `d86aa232`'s — and **0** occurrences of `pageOpsSaid`.
  **After** (01:43:46Z): 740,600 bytes, sha256 `37983c53938d6581`, **4**
  occurrences — **byte-identical to `git show 4df02867:public/chat.js`**. The
  scoped sentence itself lives in `worker.js`, so the served file cannot show
  it; the Worker half rests on Wrangler's report until a signed-in read.
  Gates **401 / 401 / 401 / 404** at 01:43:46Z.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `4df028677ffef22cbe4399049fe6b4009bf2112f` and `expect_image`
  `67a81b55332be3a9` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token. **No paid replay** (owner).

### THE FULL PAGE WRITER DROPS UNRELATED CONTENT SILENTLY — REPRODUCED (2026-09-24; built on the branch, next section)

Owner: *"Investigate whether the full page writer can silently drop unrelated
content during a small requested edit … Use a page containing distinct
sections, links and a custom component; request one narrow change, then supply
an answer that also omits an unrelated section. Check the compiler payload,
stored source and customer reply. Include controls for the correct narrow edit
and an explicitly requested section removal. Return the concrete reproduction
and smallest proposed protection before implementing it. Keep full-site revise
separate."* **Reproduced; nothing built.** The reproduction is COMMITTED —
`test/edit-page-keep.test.mjs`, **13 cases** through the real `POST
/api/site/<slug>/edit`, supplied answers, the tweak declining so the full
writer runs — as a CHARACTERISATION of today's behaviour, no product change:
the OPEN DEFECT cases assert the loss IS published, so a fix must flip each one
deliberately into a refusal case, and a fix that leaves one green has not fixed
that shape. Suite **7,265 → 7,278** locally (`# tests 7278 / # pass 7278 /
# fail 0 / # skipped 0`, `duration_ms 116,832`), exactly those cases; **and CI
matches**: unit run **`35945643176` on `32e0966b`** reads **`# tests 7278 / #
pass 7274 / # fail 0 / # skipped 4`** (`duration_ms 122,592`) — the total is
what matches, `pass` differing by CI's four skips — with all thirteen cases
found passing BY NAME and zero anchored `not ok` lines in the downloaded log.
No `site build` fires for it: a `test/` file outside that workflow's `paths`
produces no run. **The stamp chain ends at `32e0966b`.**

**THE FIXTURE**: a home page of four sections — a hero with a `<Link
to="/menu">`, the opening hours, "Order ahead" rendering the site's own
`<OrderForm />` (`./-parts/order-form`, stored in `parts.json`), and "Find us"
with a `<Link to="/visit">Directions</Link>` — beside `/menu`, `/visit` and
`/contact` pages. The narrow ask: *"Show the opening hours on the home page as
a short list…"*.

Every case publishes today, stores the writer's answer byte for byte, leaves the
other pages and the component FILE untouched, charges 3 (4 through look, the
picker call) and says *"✅ Updated /."*:

| kind | the ask → the writer's answer | what the existing readers see |
|---|---|---|
| must stay published | the hours → just the hours (correct) | links and `order-form` kept |
| must stay published | *"Put "Find us" at the top"* → reordered | the same links, `rendered` |
| must stay published | *"Take the "Find us" section off"* via look, picker `removes: ["components"]` → removed | Directions gone, as asked |
| must stay published | the same removal routed straight to `page` — no picker, no removal signal at all | the same |
| must stay published | *"Send the Directions link to the contact page"* → retargeted | `Directions → /contact` |
| must stay published | the hours → the order form rendered through `const Form = OrderForm` | `partUse` **`unsure`**, never `unused` |
| **open defect** | the hours → + "Find us" left out | `Directions → /visit` gone |
| **open defect** | the hours → + "Order ahead" left out, import kept | **`unused`** — a confirmed absence |
| **open defect** | the hours → + "Order ahead" left out, import removed too | **`none`** — confirmed against the before |
| **open defect** | the hours → Directions removed, `Get in touch → /contact` added | **2 links before, 2 after** |
| **open defect** | *"Take "Find us" off"* via look → + "Order ahead" left out | Directions gone (asked) + `unused` (not asked) |
| open, outside the proposed inventory | the hero line → + "Opening hours" left out | nothing the inventory reads moved |

**SO THE LOSS IS SILENT AND INDISTINGUISHABLE**: the page rung's walls cover
photographs, oversized or unreadable components and no-change, and nothing
compares the page's sections, links or rendered components before and after —
a silent unrelated loss reads exactly as a correct edit or an asked-for removal.

**⚠ THE MEASUREMENT THAT DECIDES WHAT CAN BE PROTECTED — RUN 11.** Over the
saved before/after pairs of the live page-rung runs (9, 11, 17, 24, 26): section
titles live mostly in kit components' props, not raw `<h1>`–`<h6>` (the bakery
page has 0; fretwork-1 2 across 13–15 sections), and **run 11 — a correct,
requested consolidation routed straight to the page layer with no removal mark
— took `<section>` from 15 to 13.** So any block- or section-level refusal would
have refused a real, correct edit. What NONE of the five real edits lost is an
in-body link or one of the site's own components.

**THE FIRST PROPOSAL WAS REJECTED ON FOUR POINTS (owner, 2026-09-24), and each
is a rule for this protection now:** *"1. Preserve intentional section removal
whether it arrives through look or directly through page. Blocking the direct
route is a regression, not an acceptable coverage limit. 2. Scope removal
permission to the requested target. "Remove Find us" must not also authorize
dropping OrderForm or unrelated links. 3. Do not use link counts alone.
Removing Directions while adding a different link must not conceal the loss.
Preserve legitimate requested retargeting. 4. Check component loss both when
its import remains and when the writer removes the import too. Keep uncertain
readings distinct from confirmed absence."* The first proposal took its
permission from the picker's `removes`, which fails 1 and 2 at once —
**`readRemoves` answers LANE names (`components`), never a target, and only the
look door has a picker** — and it counted links, which fails 3.

**THE REVISED DESIGN (awaiting the owner; nothing built):**

- **THE FACTS ARE CODE'S, THE INTENT IS THE CUSTOMER'S OWN WORDS, AND THE TWO
  ARE NEVER MIXED.** Code computes exactly what the answer lost, from the two
  existing readers; a small model call — made ONLY when something was lost —
  answers, item by item, whether the customer's message asked for it, and must
  QUOTE the words that do; code checks the quote is really in the message. No
  phrase matching in code: a deterministic reader of intent is refused by
  paraphrase and fooled by *"keep Find us"*, and this file's standing rule
  against homemade analysis engines applies to language as it did to syntax.
- **LINKS ARE PAIRED BY IDENTITY, NEVER COUNTED.** `linkSlots` gives each
  in-body literal link its words and destination; before and after pair in
  order, each after-link used once: **(1)** same words and destination → kept;
  **(2)** same words, new destination → **RETARGETED**; **(3)** same
  destination, new words → relabelled, kept (words are text, which this does
  not protect); **(4)** a before-link left over → **LOST**, an after-link left
  over → added, **which never offsets a loss**. Words before destination, so an
  ambiguous pairing resolves toward asking; a wordless link pairs by
  destination alone.
- **A COMPONENT IS READ BY `partUse` ON BOTH SIDES, AND ONLY WHAT THE BEFORE
  PROVABLY SHOWED IS PROTECTED:**

  | before | after | reading |
  |---|---|---|
  | `rendered` | `rendered` | kept |
  | `rendered` | `unused` — import kept, tag gone, name mentioned nowhere | **CONFIRMED ABSENT** |
  | `rendered` | `none`, and no tag of its old binding left | **CONFIRMED ABSENT** (import removed too) |
  | `rendered` | `unsure` — still mentioned, not provably rendered | **UNCERTAIN** |
  | `rendered` | `none`, but its old binding still appears as a tag | **UNCERTAIN** |
  | `unsure` | anything but `rendered` | **UNCERTAIN** — never confirmed shown |

  The component list comes from the BEFORE's imports (`localParts`), so a
  writer that deletes the import line cannot take the component out of the
  question — which is the whole of point 4's second half.
- **PERMISSION IS PER ITEM, FROM THE CUSTOMER'S MESSAGE, AND IDENTICAL ON BOTH
  ROUTES** — the message is the one thing the look door and the direct page
  route both carry. The judge sees the message verbatim and the numbered items:
  the kind; the words or the destination; the heading the item sat under (the
  nearest `<h1>`–`<h6>` or kit `title`/`heading` prop above it in the BEFORE —
  a description, never a permission and never a grouping); a retarget's old and
  new destination; a component's declared `does` when `look.tsx` has one. Its
  tool is one property, `answers: [{n, asked, quote}]`, on the picker's quick
  model (`eQuick`, `eQuickModel` — every small call follows the picker).
  **`asked: true` counts only with a quote found in the message** after folding
  case, whitespace and quote marks, holding a word of three or more letters; an
  item missing from the answer, or answered twice in disagreement, is NOT
  asked. **⚠ CORRECTED (owner, 2026-09-24): a verified quote proves the words
  OCCUR in the request; whether they AUTHORISE that particular loss is still
  the model's judgement, and nothing in code makes that judgement a
  guarantee.** This paragraph first said *"Take the "Find us" section off"*
  *cannot* authorise the order form — true of code's own checks (as built, a
  quote must also NAME its item — next section), never of the judgement: a
  judge that quotes *"keep the order form"* as permission is quoting real words
  that name the item, and it is believed.
- **FOUR OUTCOMES.** Everything lost was asked → publishes, the reply
  unchanged, the judge's tokens billed with the edit. Anything not asked →
  **409 `withheld`, cost 0, nothing compiled or stored** — the photo refusal's
  shape, so `stepWroteNothing`, the whole-request note and the job path's
  refund read it unchanged — naming each unasked item in the customer's words
  (a link by its words, a component by the heading it sat under or its declared
  `does`, never a file name) and how to authorise it. The judge unreachable or
  unreadable → **503 `withheld`, `ours`, cost 0**, with a DIFFERENT sentence (*"I
  couldn't check that the rewrite kept everything you didn't ask to change —
  that's on us"*), because the loss may have been asked for: fail closed, two
  facts, two sentences. **An UNCERTAIN component never refuses and is never
  counted as kept**: `partsUnsure` on the reply and one clause naming the
  heading — the only browser change, recommended, because silence would let
  "✅ Updated /." stand over something the check could not see.
- **BOTH RUNGS, ONE CONTRACT — the photo protection's own rules**: asked of the
  ACCEPTED publication, after the photo refusal, before `publishStep`; the
  before is `eSrc`, so what an earlier step of the same message did is already
  in it; and a loss the TWEAK made REFUSES rather than falling through (the
  owner's own ruling on the photo case: *"Do not publish the loss merely
  because matching failed, or trigger a full rewrite"*). On the tweak only
  links can arrive — `sameProse` already refuses worded content and
  `partEligible` own-component identity — so what reaches the check there is a
  wordless link or a retarget.
- **MEASURED**: the prototype classifies every committed case as above; over
  the five saved live page edits (runs 9, 11, 17, 24, 26 — runs 12, 14, 21 and
  23 changed no page) it finds nothing lost, retargeted, relabelled, added or
  uncertain, so **the judge would have been called 0 times. n = 5**, said as
  n = 5; no larger set of real before/after page pairs exists here.
- **⚠ WHAT STAYS OPEN — THIS IS A PARTIAL IMPROVEMENT, NOT CONTENT
  PRESERVATION** (owner): a section of plain words or kit components (the
  committed hours case stays green under this design by construction, which is
  why it is kept); links built from data (`to={…}`), links inside components,
  and kit components' own `href` props; a section MOVED into a new component
  takes its links out of the page's inventory and would be REFUSED (a
  conservative false refusal; the remedy, if it is met, is reading the rendered
  components' links too); the judge can misattribute a quote that IS in the
  message — supplied answers prove the path and never the judgment, and only a
  paid run measures that. Full-site revise untouched.
- **THE FOOTPRINT, ON APPROVAL**: `builder/page-keep.mjs` (new, pure: the
  inventory, the pairing, the component states, the headings, the judge's tool,
  prompt and reader, the sentences); two call sites in `worker.js`, one per
  rung; the one clause in `chat.js` if approved. Tests: the OPEN DEFECT cases
  flipped into refusals, the MUST-STAY cases kept publishing (the removals and
  the retarget now with a supplied "asked"), plus a quote not in the message, a
  judge that fails, the tweak path and the job path's money; a focused mutation
  check, no broad sweep.

### THE PRESERVATION CHECK, BUILT (2026-09-24, merged and deployed in 2151 — no paid run)

Owner: *"Proceed with the bounded implementation of the revised preservation
check. The committed reproductions check out."* — six requirements, each met
below and each with a case: the documentation's permission claim corrected (a
verified quote proves occurrence; the model judges authorisation); intentional
removals through look AND page, and requested retargets, preserved without an
authorised removal authorising anything else; exact link identity matched
across both inventories before any retarget or relabel, with repeated labels
and reorders covered; negative controls for *"keep the order form"*, an
unrelated removal and a genuine quote on the wrong item, with supplied judge
answers kept apart from any claim about a real model; the same protection on
both writers before publication, a refused tweak buying no rewrite, and
compiler/store inactivity and real billing verified on refusal — including a
mixed request where another step succeeded; the five defect cases flipped, the
controls kept, uncertain components kept apart from confirmed loss, and
plain-text/kit-only loss explicitly open.

**THE MODULE**: `builder/page-keep.mjs`, pure, on the Dockerfile's worker COPY
line — and `container-images` went red until it was COMMITTED, the guard asking
git rather than the disk, exactly as designed. `site-files.mjs` gained two
exported readers (`partBindings`, `tagAt`/`drawsTag`) rather than a second
reader of an import clause.

- **LINKS, PAIRED BY IDENTITY IN SIX PASSES** — each rule twice, first between
  links under the same heading, then anywhere: exact (words and destination) →
  kept · same words, new destination → RETARGETED, judged · same destination,
  new words → relabelled, kept · a before-link left over → LOST, judged · an
  after-link left over → added, which never offsets a loss. **Exact across the
  whole page BEFORE any retarget**: a moved "Book now → /book" beside a new
  "Book now → /offers" is kept, never claimed as a retarget (the K-2 mutant
  dies on it). **The same-heading pass is what keeps a repeated label honest**:
  two "Book now → /book", the FIRST section removed, and the loss is reported in
  the first section (K-1). A wordless link pairs by destination alone. **A
  LIMIT, STATED**: two links keeping their words and swapping destinations read
  as moved.
- **COMPONENTS, BY THE APPROVED TABLE**: rendered → `unused`, and rendered →
  `none` with no tag of the old binding left, are CONFIRMED losses and judged;
  rendered → `unsure`, rendered → `none` with the tag still drawn, and `unsure`
  → anything but rendered are UNCERTAIN — never judged, never refused, never
  counted as kept. `partsUnsure` rides the reply in the customer's words (the
  heading, else the declared `does`, never a file name) and the browser adds ONE
  clause: *"I couldn’t confirm that the “Order ahead” section is still on the
  page — have a look before you share it."* **`unsure` → `unsure` reports too**,
  as the table says, so a page rendering a component through an alias gets the
  clause on every edit. **Measured, and the sample is narrow**: the 324-file
  corpus imports no `-parts/` component at all, and across the nine saved run
  artifacts (29 page readings) the only page importing one is fretwork-1's home
  page — 8 readings × 3 components, all 24 `rendered → rendered`, zero
  uncertain. One site's one page, said as that.
- **THE JUDGE**: tool `keep_check`, one property `answers: [{n, asked, quote}]`
  (plus an optional `group` since the next section's round),
  on `eQuickModel` through `eQuick("keep_check")`, `KEEP_MAX_TOKENS` 1024, called
  ONLY when something was lost. Its rules say a request to KEEP something, or a
  mention, is not a request to remove it, and that asking for one thing never
  asks for another.
- **TWO CHECKS ON EVERY QUOTE — AND WHAT NEITHER PROVES.** (1) The words occur
  in the message: whole words, case/spacing/punctuation folded, at least one
  word of three letters. (2) The quote NAMES its item: it shares a naming word
  with the item's link words, heading, destination (or new destination),
  component name or declared purpose, after a short stop list of grammar, page
  furniture and request verbs. **(2) is what refuses a genuine quote attached to
  the wrong item.** **Neither proves authorisation**: *"keep the order form"*
  occurs and names the item, and a judge that reads it as permission is
  believed — a case says so (`LIMIT, NOT A PROTECTION`). **The cost of (2),
  stated**: a paraphrase sharing no naming word (*"the map link"* for a link
  that says "Directions") is refused and the sentence asks for it to be named;
  an item with NO naming words (a wordless link to `/` under no heading) is left
  to the judge alone. **⚠ AND (2) IS NO LONGER MANDATORY** (owner, the same day:
  *"a clear request about a group cannot succeed unless the customer names each
  member"*): a group the judge declares, of a kind that can hold the item, is
  the other way a quote covers it — *a group asked for at once*, below. **⚠ AND
  THE TWO WAYS ARE EXCLUSIVE PER ANSWER** (owner, the same day): an answer that
  declares a group is checked by kind ALONE, so (2) cannot rescue a group that
  cannot hold the item — *a declared group constrains its answer*, below.
- **FOUR VERDICTS, ONE WRITER (`keepRefusal`) FOR BOTH RUNGS**: `kept` (no
  call) · `asked` (publish; the judge's tokens billed with the edit in the ONE
  `eCharge`) · `withheld` (409 `withheld`, cost 0, `contentBlocked:
  [{kind, label, href, to, name, section, group, why}]`, nothing compiled,
  stored or charged) · `unchecked` (503 `withheld`, `ours`, `contentUnchecked`). The photo
  refusal's shape, so the merge's `stepWroteNothing`, the browser's
  whole-request note and the job path's refund read it with no new branch.
- **BOTH WRITERS, BEFORE THE PUBLISH.** The tweak after its photograph refusal,
  before `publishStep` — **and its refusal RETURNS**: the case asserts the calls
  are exactly `write_tweak, keep_check`, no `write_pages`. The rewrite after its
  photograph refusal, over the guarded page, with the site's declared `tsx`
  purposes. A tweak whose compile then fails hands its judge's tokens to the
  rewrite's bill (`twJudged`), as `twSpent` hands on the tweak's own. The
  tweak's `partsUnsure` line is a belt that cannot fire today (a re-bound
  component moves the identity `partEligible` compares) and says so.
- **THE MONEY, DRIVEN ON BOTH PATHS**: a publish debits
  `pageCredits(tweak, writer, judge)`, a refusal debits nothing; on the job path
  one `edit_reserve` on a publish, none on a refusal, `edit_finalize p_ok:
  false`. **The mixed request** (css + a refused page): one compile carrying the
  ORIGINAL home page and the new stylesheet, charged (sync) and reserved (job)
  for the picker and the css lane only, the refusal on `partial` and on the
  screen after the look's sentence, and no whole-request note.

**EVIDENCE.** `test/edit-page-keep.test.mjs`, **13 → 42 cases**, every route
case through the real `POST /api/site/<slug>/edit` with every model answer
SUPPLIED, asserting the calls, the compiler payload, the store (the page, the
other pages, the component file, the stylesheet), the debits or reservations,
and the screen through the browser's own `editBrowserReply`. **Red 23 of 42
against the unfixed route** (`80036b40` in a throwaway worktree, only the module
and the two readers copied in so the file loads), each on its own gate —
published where a refusal was expected, no judge call, no clause, the judge
unbilled — and **with the calls assertion cut in the throwaway copy the mixed
case still fails on the compiler payload**, the loss shipping. The 19 green on
both are the pure module cases, the readers' baseline and the four controls
(the correct edit, the reorder, the plain-words drop, the visual tweak).
**One pre-existing guard re-anchored, not appeased**: `site-tweak`'s *"WHAT THE
CHEAP ATTEMPT COST IS BILLED WITH THE REWRITE"* was pinned to
`eCharge(eGen && eGen.usage, twSpent)` WITH its closing parenthesis; the
property is that `twSpent` rides in the rewrite's own call, and the judge's
honest third argument read as the cheap attempt going unbilled. **Focused
mutation check `scripts/mutants/page-keep.json`: 21 mutants, 21 killed, 0
survived, 0 never applied, the comment-only control surviving**, over
`page-keep.mjs`, `worker.js` and `chat.js` against eight files (`edit-page-keep`,
`site-tweak`, `site-files`, `edit-browser-reply`, `edit-page-protect`,
`edit-parts`, `edit-failure`, `free-identifiers`); all three swept files
byte-identical to their scratchpad backups afterwards. **Two gaps were found
while WRITING the spec, before it ran**: nothing asserted the cross-page exact
pass (a moved link beside a new same-words link) or that the site's declared
purpose reaches the judge through the route — each got its own case or
assertion first. **Suite 7,307 locally** (`# tests 7307 / # pass 7307 / #
fail 0 / # skipped 0`, `duration_ms 115,247`) — **+29 against 7,278**, exactly
the file's 13 → 42. **AND THE CI UNIT HALF MATCHES**: run **`35949168893` on
`249fc8c7`** reads **`# tests 7307 / # pass 7303 / # fail 0 / # skipped 4`**
(`duration_ms 122,105`) — the total is what matches, `pass` differing by CI's
four skips — with all 42 of the file's cases found passing BY NAME in the
downloaded log archive and zero anchored `not ok N -` lines. **Rendered in the
real workspace chat, before and after** (the real `chat.js` and `styles.css`, the
sign-in gate held down on a served copy): eight scenarios, each chat sentence
the browser composer's own output captured out of the route — BEFORE on
`80036b40` in a throwaway worktree (which read **19 pass / 23 fail** again, the
red count reproduced), AFTER on this branch — and all sixteen drawn bubbles equal
to the composer's text. **AND `site build` run `35949168905` on `249fc8c7`**
(02:53:50 → 03:18:49Z, **24m59s**, all twenty steps) read all twelve counts
green out of its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build
**382**, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all passed`,
census 7 + 4 + 1 = **12**; the two known `##[error]` annotations
(`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the case that
compiles a broken page on purpose, the first directly above its own `ok` line,
the second followed by the two SSR-stream lines and then its own `ok`;
`tsc`-format lines 9 / 2 / 7; `site-build.mjs` **18m20s**. The docs-only
`5f4bdf53` reads the same four unit numbers on run `35950590450` (`duration_ms
121,019`, zero anchored `not ok N -` lines), so the pair off CI says that commit
moved the suite by zero. **The stamp chain ends at `249fc8c7`** — the last
commit to touch a product file (a comment in `worker.js`).

**⚠ WHAT IT DOES NOT CLAIM, AND WHAT STAYS OPEN.** Every model answer in the
evidence is SUPPLIED — the writers' and the judge's — so it proves the path,
never a real model's reading of a message; only a paid run measures that.
Outside the inventory: a section of plain words or kit-only markup (kept as a
publishing case), links built from data, links inside components, kit
components' own `href` props; a section moved into a new component is refused
(conservative). Full-site revise, translation and hydration untouched; the
model-written-replies preference stays recorded, not started.

### A GROUP ASKED FOR AT ONCE (2026-09-24, merged and deployed in 2151 — no paid run)

Owner, reproducing it through the real edit route: *"Request: “Remove all
links from the home page, keeping their text and everything else.” … Judge:
asked:true for both items, quoting the actual request. Result: 409 withheld,
both items quote-not-about-item. The customer is incorrectly told the message
didn't ask to remove those links. quoteNamesItem makes shared naming words
mandatory, so a clear request about a group cannot succeed unless the customer
names each member. Fix this without adding a growing English keyword parser or
a blanket removal bypass. Support explicitly requested groups while keeping
judgment per item. Quote presence and word overlap are not proof of intent."*

- **REPRODUCED FIRST, EXACTLY, AND IT IS TWO DEFECTS.** On `58dfa875`, the
  writer taking both `<Link>` wrappers off with every word kept and the judge
  answering `asked: true` for both with the request's own words: 409
  `withheld`, both `quote-not-about-item`, and the screen said *"…which your
  message didn't ask for…"*. (1) Naming was the ONLY way a quote could cover an
  item. (2) The refusal sentence claimed the JUDGE'S reading whatever refused —
  and here the judge had said yes.
- **THE GROUP IS THE JUDGE'S TO DECLARE AND CODE'S TO CHECK, BY KIND.** Each
  answer may carry `group`, enum `Object.keys(KEEP_GROUPS)`: `links` holds
  `link-lost` and `link-moved`; `sections` holds `part-gone` and `link-lost` (a
  section taken off takes its links). A quote covers an item when it occurs in
  the message AND either names the item OR comes with a declared group that can
  hold the item's kind (`groupCovers`). **⚠ CORRECTED THE SAME DAY: never
  "either" for one answer** — an answer that declares a group is checked by kind
  alone and one that declares none by naming alone (*a declared group
  constrains its answer*, below). **The kinds are the inventory's own, so
  nothing is a word list**: which group words ask for is reading English, and a
  keyword list (*"all links"*, *"every button"*, *"everything below the
  hours"*) only grows — and reads no message written in Spanish or French.
- **WHY THE JUDGE MUST DECLARE IT, AND WHAT THAT COSTS.** To code, the owner's
  quote *"Remove all links from the home page"* and the unrelated-removal
  control's *"Take the phone number off"* are ONE shape — words really in the
  message that name nothing on the page. Accepting the first without a
  declaration accepts the second — MEASURED: the G-2 mutant, which reads an
  undeclared quote as a links group, fails four cases run one at a time — that
  phone-number control, the owner's undeclared answer on both writers, and the
  wrong-item control (on its reason, `group-other-kind` where
  `quote-not-about-item` was due). **So the owner's
  exact supplied answer, with no group named, STILL REFUSES** — on both writers,
  now with the honest sentence. **Whether a real model fills `group` is
  unverified**; that is the risk this design carries, stated rather than hidden.
- **STILL JUDGED ITEM BY ITEM.** Every item needs its own answer; a group's
  quote must still occur in the message and must not be empty; a name not ours
  is `unknown-group`; a group stretched over a kind it cannot hold is
  `group-other-kind`. **⚠ "A GROUP CAN ONLY ADD AN ACCEPTANCE" WAS THE BYPASS
  (corrected the same day, owner).** This bullet first said a quote that names
  its item is accepted *with or without a group (a wrong group label on it costs
  nothing)*, and a unit case asserted exactly that for the order form under
  `group: "links"` — so under a heading the quote named, a links group answered
  for the form and it shipped. And a non-string `group` was *"not read at
  all"*, which made it no group and handed the answer back to naming — the same
  hole by a malformed route. Both are closed: *a declared group constrains its
  answer*, next section.
- **THE REFUSAL CLAIMS ONLY WHAT MADE IT.** `keepWithheldMsg` says *"which your
  message didn't ask for"* only when EVERY listed item's reason is `not-asked`
  — the judge said no. Any other reason (the judge said yes and a check could
  not confirm it, left an item out, contradicted itself) says *"which I
  couldn't confirm your message asked for"*, and a MIXED list takes the weaker
  clause, true of both. **The closing advice — *"say so in your message and
  send it again"* — is unchanged**, and reads oddly to a customer who already
  asked for the group; it is a wording question for the owner, not changed
  here.
- **THE RULES** gain three bullets: how to declare a group; *"A group is still
  answered item by item"* (anything the message leaves out of its group is not
  asked for); *"A group asks only for what it names"* (every link asks for no
  section; the sections ask for the links inside them and for no link anywhere
  else). `contentBlocked` carries `group`, so a `group-other-kind` refusal says
  which group was claimed.
- **THE ROUTE CASES THE OWNER LISTED**, all through `POST
  /api/site/<slug>/edit` with the calls, the compiler payload, the store, the
  money and the screen asserted: **remove all links keeping their text** —
  publishes on the full writer and on the TWEAK, the judge billed with the edit,
  exactly the two links asked about; **all links except one named link** —
  honoured, it publishes with only the one link asked about; the writer taking
  the named link too is refused for THAT link alone, `not-asked`, with the
  "didn't ask for" sentence; **a group beside an unrelated component loss** —
  the collateral loss alone is refused, on BOTH money paths (no reservation,
  `edit_finalize p_ok: false`), and refused by kind (`group-other-kind`, the
  claimed group on the record) when the judge stretches the links group over the
  order form; **the named-section removal (look and page) and retarget
  controls** — unchanged and green. Beside them: a sections group (*"every
  section off except the hours"*) publishes, three items each asked about; the
  owner's undeclared answer refuses on both writers.
- **TWO LIMITS, RECORDED AS CASES AND NEVER AS PROTECTIONS**: a judge that
  counts the excepted "Directions" into the group is believed — code does not
  read *"except"*; and a judge that calls a links quote a SECTIONS group is
  believed and the order form goes — which group words ask for is its reading,
  so the kind check stops a group being STRETCHED, never one being MISLABELLED.
  A sections group can likewise answer for any lost link by kind, not only the
  links that sat inside the sections that went.
- **EVIDENCE.** `test/edit-page-keep.test.mjs` **42 → 57 cases** (3 unit, 12
  route). **Red 14 of 57 against the unfixed `58dfa875`** (a throwaway worktree
  with only `KEEP_GROUPS`/`groupCovers` appended so the file loads): every group
  case that must publish fails on 409 `withheld` — the owner's regression — the
  wording cases on *"didn't ask for"*, and the except/collateral refusals on the
  other links refused beside them as `quote-not-about-item`. Twelve of the
  fifteen new cases are red there, plus two EXTENDED old ones (the judge-prompt
  case, now asserting the group rules, and the wrong-item control, now
  asserting the weaker sentence). The 43 green on both: the 40 old cases whose
  assertions did not change, the group table itself (copied in so the file
  loads), and two refusals that refuse either way — the collateral loss on the
  job path and the undeclared answer on the tweak.
  The eight focused files (`edit-page-keep`, `site-tweak`, `site-files`,
  `edit-browser-reply`, `edit-page-protect`, `edit-parts`, `edit-failure`,
  `free-identifiers`) **168 / 168**. **Suite 7,322 locally** (`# tests 7322 / #
  pass 7322 / # fail 0 / # skipped 0`, `duration_ms 116,718`) — **+15 against
  7,307**, exactly the file's 42 → 57. **AND THE CI UNIT HALF MATCHES**: run
  **`35953017719` on `5437cbf5`** reads **`# tests 7322 / # pass 7318 / # fail 0
  / # skipped 4`** (`duration_ms 118,157`), all fifteen new cases passing BY
  NAME in the downloaded log and zero anchored `not ok N -` lines. **Focused
  mutation check `scripts/mutants/keep-groups.json`: 19 mutants, 19 killed, 0
  survived, 0 never applied, the comment-only control surviving**, over
  `page-keep.mjs` and `worker.js` against the same eight files — the group
  ignored, an undeclared quote read as a links group, no kind check, an unknown
  group accepted, each kind list widened or narrowed, a group excusing a
  missing or absent quote, a coerced group, the group dropped from the record,
  the tool or any of the three rules losing it, and the refusal sentence always
  strong, never strong, or strong on one `not-asked`; both swept files
  byte-identical to their scratchpad backups (and to HEAD) afterwards. **One gap
  was found while WRITING the spec, before it ran**: nothing asserted that a
  non-string `group` is ignored, so that assertion went in first and the
  coercion mutant dies on it. **The final tree read 7,322 / 7,322 / 0 / 0 again
  locally** (`duration_ms 116,194`) — that assertion sits inside an existing
  case. **Rendered in the real workspace chat, before and after** (the real
  `chat.js` and `styles.css`, the sign-in gate held down on a served copy): six
  scenarios, every chat sentence the browser composer's own output captured out
  of the route — BEFORE on `58dfa875` in a throwaway worktree (which read 43
  pass / 14 fail again, the red count reproduced), AFTER on this branch — and all
  twelve drawn bubbles equal to the composer's text. **The docs-and-assertion
  commit `f89846de` reads the same four unit numbers** on run **`35953787126`**
  (`duration_ms 116,441`, zero anchored `not ok N -` lines), so it moved the
  count by zero. **AND `site build` run `35953017727` on `5437cbf5`** (03:49:03 →
  04:13:58Z, **24m55s**, all twenty steps) read all twelve counts green out of
  its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all
  passed`, census 7 + 4 + 1 = **12**; the two known `##[error]` annotations
  (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the case that
  compiles a broken page on purpose, the first directly above its own `ok`
  line, the second followed by the two SSR-stream lines and then its own `ok`;
  `tsc`-format lines 9 / 2 / 7; `site-build.mjs` **18m19s**. **⚠ THE RUN-LEVEL
  API ANSWERED `in_progress` FOR THIS RUN AT 04:14Z WHILE ITS JOB HAD COMPLETED
  AT 04:13:58** — `updated_at` still read the creation second — so the job
  listing, not the run, is what said it was done: this file's stale-snapshot
  trap, met again.
- **⚠ WHAT IT DOES NOT CLAIM.** Every model answer is SUPPLIED — the writers'
  and the judge's, the `group` included — so this proves the path: a declared
  group is read, kind-checked and judged per item, a collateral loss is still
  refused, and the refusal says only what made it. It proves nothing about how
  a real model reads *"all the links except Directions"*, or whether it declares
  a group at all. Plain-words and kit-only section loss stays OPEN; full-site
  revise, translation and hydration are untouched; model-written replies stay a
  recorded future preference.

### A DECLARED GROUP CONSTRAINS ITS ANSWER (2026-09-24, closed at code review, merged and deployed in 2151 — no paid run)

Owner, reproducing it through the edit route: *"Before: “Order ahead” contains
a link and OrderForm. Request: “Remove all links under ‘Order ahead’, keeping
their text.” Writer removes the link wrapper AND OrderForm. Judge answers
asked:true, group:"links" for both, quoting that request. Result: 200, compiled
and stored without the form, customer hears “✅ Updated /.” readKeep checks
groupCovers only when quoteNamesItem fails. The shared heading makes
quoteNamesItem pass, so a links-group answer authorizes a part-gone item. Make
an explicitly declared group constrain its answer. Matching words must not
override a contradictory group kind. A named individual removal can remain
valid without a group; an inconsistent answer should not silently regain
permission through the naming fallback."*

- **REPRODUCED FIRST, THROUGH THE ROUTE, ON BOTH MONEY PATHS.** On `f89846de`:
  200, the form gone from the compiled AND stored page, the synchronous reply
  charging `cost: 6`, and *"✅ Updated /."* on both paths — the owner's report
  exactly. **The cause is the ORDER of two checks**: `quoteNamesItem` ran first
  and `groupCovers` only when it failed, and *"Remove all links under ‘Order
  ahead’"* names the form by its heading (and by its own name), so the form's
  `group-other-kind` was never asked. **The previous round built that order on
  purpose** (*"A GROUP CAN ONLY ADD AN ACCEPTANCE"*, above, now corrected) and a
  unit case asserted it — the order form named outright and accepted under
  `group: "links"`. That case preserved the bypass, and the owner named it.
- **THE FIX IS WHICH QUESTION IS ASKED, NOT A NEW QUESTION.** An answer either
  declares a group or it does not, and `readKeep` asks exactly ONE question of
  it: a group answer is checked by KIND (`groupCovers`) and naming is never
  asked of it; a plain answer is checked by NAMING (`quoteNamesItem`), as
  before. So matching words cannot override a group that cannot hold the item,
  and a named individual removal with no group still publishes. **No English is
  read and nothing is bypassed**: the kinds are the inventory's own.
- **WHAT COUNTS AS DECLARED: anything in `group` but nothing.** Left out,
  `null` or blank is no group. A string that is not one of `KEEP_GROUPS`
  (`"components"`), or a value that is not a string at all (`["sections"]`,
  `7`), is a declaration nobody can read — refused as `unknown-group`, **never
  coerced and never ignored**, because ignoring it hands the answer back to
  naming. **⚠ CORRECTED**: last round a non-string group was *"not read at
  all"*, which made it an undeclared answer — on a quote that named its item,
  the same bypass by a malformed route. `null` and blank are read as absent
  deliberately: they declare nothing, so they open nothing an absent field does
  not.
- **AND A SECOND WAY IN, CLOSED WITH IT: TWO ANSWERS TO ONE ITEM.** The merge
  kept the first answer that carried a quote, so `{asked, quote}` then `{asked,
  quote, group: "links"}` for the form kept the plain one and naming let it
  through. **Two yes answers that do not declare the same group are now a
  conflict** (`conflicting`), in either order, and so are two different groups;
  agreeing duplicates are read as before.
- **THE COST, STATED**: a judge that labels a request NAMING the form outright
  (*"Take the order form off"*) as a links group is refused now, where it used
  to cost nothing. That is a refusal the customer can answer; the other way
  round loses part of the site.
- **THE SENTENCE**: `group-other-kind` and `unknown-group` are not
  `not-asked`, so the customer hears *"…which I couldn't confirm your message
  asked for…"* — the judge said yes, and the screen does not claim otherwise.
- **THE ROUTE CASES**, through `POST /api/site/<slug>/edit` on a starting page
  whose "Order ahead" holds a "Large batches" link beside the form (the harness
  now takes the starting page, and a refusal is compared against IT rather than
  the fixed fixture): **the owner's bypass** — refused, 409, nothing compiled,
  stored or charged, `contentBlocked` naming the form ALONE with `group:
  "links"` and `group-other-kind`, the exact screen, no follow-up bought;
  **the same on the job path** — no reservation, `edit_finalize p_ok: false`;
  **correct link-only removal under the heading** — publishes, the judge billed
  with the edit, one item asked about; **the form named on its own** (*"Take the
  order form out of ‘Order ahead’"*, no group) — publishes, only the form an
  item, the link under the same heading kept. **Retained unchanged and green**:
  all links (full writer and tweak), the two except-one cases, the three
  collateral cases (both money paths, and the stretched group), the sections
  group, the named-section removal and retarget controls, and the billing
  controls.
- **A LIMIT, RECORDED AS A CASE AND NEVER AS A PROTECTION**: the form answered
  with NO group, quoting the links request that shares its heading, is believed
  and the form goes — the heading's words really do name it. Telling *"the
  links under Order ahead"* from *"Order ahead"* is reading English, the
  judge's call, which the rules already steer (*"Asking for every link does not
  ask for any section"*). **The fix constrains a DECLARED group and claims
  nothing about an undeclared misreading.**
- **EVIDENCE.** `test/edit-page-keep.test.mjs` **57 → 63 cases** — one reader
  case (the shared heading, the premise that the quote names BOTH items asserted
  first, and the duplicate-answer conflicts), five route cases, and the group
  reader case rewritten (its named-form-under-links assertion reversed, the
  non-string expectation corrected, unknown / non-string / absent groups
  added). **Red 4 of 63 against the unfixed `f89846de`** (a throwaway worktree,
  the product byte-identical to the scratchpad backup, sha `5f340fb0`): the two
  reader cases and the owner's bypass on both money paths, each route case at
  200 where 409 was due; the rewritten case's first gate is its non-string line,
  and with that line cut its named-form assertion is red on its own. The 59
  green on both are the controls, the limit and every retained case. **The
  eight focused files 174 / 174** (+6). **Focused mutation check
  `scripts/mutants/keep-groups.json`, re-anchored and extended: 25 mutants, 25
  killed, 0 survived, 0 never applied, the comment-only control surviving**,
  over `page-keep.mjs` and `worker.js` against the same eight files — G-1 and
  G-2 re-anchored (their line was the one this round replaced), and six new:
  naming asked before a declared group (the bypass restored), a non-string group
  read as no group, `null` counted as a declaration, a blank group counted as
  one, two answers disagreeing about the group not a conflict, and two
  different groups agreeing; both swept files byte-identical to their
  pre-sweep hashes afterwards. **Suite 7,328 locally** (`# tests 7328 / # pass
  7328 / # fail 0 / # skipped 0`, `duration_ms 117,043`) — **+6 against 7,322**,
  exactly the file's 57 → 63. **AND THE CI UNIT HALF MATCHES**: run
  **`35955566283` on `16b9ce72`** reads **`# tests 7328 / # pass 7324 / # fail 0
  / # skipped 4`** (`duration_ms 110,682`) — the total is what matches, `pass`
  differing by CI's four skips — with the rewritten reader case, the new reader
  case and all five shared-heading route cases found passing BY NAME in the
  downloaded log (`ok 1780`, `ok 1781`, `ok 1824`–`1828`) and zero anchored
  `not ok N -` lines; the documents-only `03cde33e` reads the same four numbers
  on run `35955832188` (`duration_ms 120,893`), so it moved the count by zero.
  **AND `site build` run `35955566453` on `16b9ce72`** (04:25:17 → 04:45:51Z,
  **20m34s**, all twenty steps) read all twelve counts green out of its per-step
  files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases
  16, theme-seam 11, theme-render 29, site-routing 14, site-runtime 47,
  kit-render / kit-a11y / kit-effects / kit-paint `all passed`, census 7 + 4 + 1
  = **12**; the two known `##[error]` annotations (`index.tsx(50,13) TS2322`,
  `menu.tsx(27,17) TS2339`) inside the case that compiles a broken page on
  purpose, each directly above its own `ok` line this time; `tsc`-format lines
  9 / 2 / 7; `site-build.mjs` **14m59s**. **The stamp chain ends at
  `16b9ce72`**, the last commit to move a product or test file. **Rendered in
  the real workspace chat, before and
  after** (the owner's bypass, link-only removal, the form named on its own):
  every chat sentence the browser composer's own output captured out of the
  route — BEFORE on the unfixed product (captured before the fix), AFTER on this
  branch — and all six drawn bubbles equal to the composer's text. In the
  owner's AFTER nothing published, so the link the customer DID ask about is
  still a link: a refusal withholds the whole change, as every preservation
  refusal does.
- **⚠ WHAT IT DOES NOT CLAIM.** Every judge answer is SUPPLIED, the `group`
  included, so this proves that code enforces the kind a judge DECLARES — and
  nothing about how often a real model declares a group, declares the wrong
  one, or misreads a shared heading without one. Plain-words and kit-only
  section loss stays OPEN; full-site revise, translation and hydration are
  untouched; model-written replies stay a recorded future preference.

### HANDED OFF FOR MERGE: THE PRESERVATION CHECK (2026-09-24, merged and deployed in 2151 — next section)

Owner: *"Close this bounded correction at the code-review level. Stop
expanding this guard or running further sweeps. Prepare the merge/deployment
handoff against current main … Do not merge, deploy or dispatch a paid run
yet."* Everything below was read or computed 2026-09-24 ~05:14Z; **re-ask each
one immediately before the push**, because a merge is judged on the state it
meets, not on this paragraph.

- **THE CANDIDATE IS THE BRANCH TIP, A FAST-FORWARD OF MAIN `4df02867`**
  (`HEAD..origin/main` empty). Its product tree is `16b9ce72`'s; every commit
  after that one is `CLAUDE.md` and `docs/owner-notes.md` alone. The exact tip
  is the handoff reply's, and `git rev-parse origin/claude/help-needed-ehlwlj`
  re-derives it — this paragraph cannot name the commit it is in.
- **THE PRODUCT CHANGES ARE FIVE FILES**: `builder/page-keep.mjs` (new),
  `builder/site-files.mjs` (`partBindings`, `tagAt`, `drawsTag`), `worker.js`
  (the import, `keepRefusal`, `keepCheck` on the tweak and on the rewrite, the
  judge's tokens in the one `eCharge`), `public/chat.js` (one clause reading
  `partsUnsure`) and `Dockerfile` (`page-keep.mjs` on the worker COPY line).
  Beside them `test/edit-page-keep.test.mjs` (63 cases), a re-anchor in
  `test/site-tweak.test.mjs` and two mutation specs. **No migration, no
  `wrangler.jsonc`, no workflow, no package change, no stored-state format**:
  every new reply field is additive and an older tab ignores it.
- **THE REQUIRED CI, READ**: unit tests on the tip, and `site build` on the
  product tree — run **`35955566453` on `16b9ce72`**, green, since docs-only
  commits fire no site build. `e6eb22f0`'s unit run **`35957268327`** reads
  **`# tests 7328 / # pass 7324 / # fail 0 / # skipped 4`** (`duration_ms
  121,334`), zero anchored `not ok N -`, the seven declared-group cases found by
  name. **Zero runs in progress, queued or waiting at 05:13:50Z.**
- **THE IMAGE, PREDICTED OVER BOTH ENDS**: `origin/main` answers
  `67a81b55332be3a9` from **185** inputs (what deploy 2150 rolled to) and the
  candidate **`56f7d5866240a1de`** from **186** — `builder/page-keep.mjs`
  ADDED, `Dockerfile`, `worker.js` and `builder/site-files.mjs` moved. The same
  id at `16b9ce72`, so the docs commits do not move it. The deploy should say
  `built … (registry answered 404; ***86 inputs …)` and roll `67a8***b55332be3a9`
  → `56f7d5866240a***de` under `SUCCESS Modified application`.
- **THE ROLLBACK, VERIFIED BEFORE IT CAN BE NEEDED**: a fast-forward has no
  merge commit, so it is the RANGE — `git revert --no-commit
  4df02867..<candidate>` then one reviewed commit. In a throwaway worktree that
  gives tree **`ddabc0dd…`, main's own**, so a rollback's image step says
  `reused 67a81b55332be3a9`. **No prerequisite**: the check writes nothing when
  it refuses, and nothing stored depends on it.
- **THE SERVED-FILE CHECK'S BEFORE READING, TAKEN** (05:13:59Z):
  `https://gofarther.dev/chat.js` **740,600 bytes, sha256 `37983c53938d6581`,
  0 occurrences of `partsUnsure`**, byte-identical to `4df02867:public/chat.js`.
  After the deploy it should be **741,487 bytes, `54397bfe3a57abb0`, 2
  occurrences**, byte-identical to the candidate's. Re-take the before reading
  if anything deploys first.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  the candidate sha and `expect_image` `56f7d5866240a1de` — a green deploy is
  Wrangler reporting on itself. **And the check is live on the edit path only
  once the CONTAINER has rolled**: edits run as jobs in the site's container,
  so a job started on the old image publishes without it, exactly as today —
  the 15–20 minute rule.
- **THE LIMITS TRAVEL WITH IT**: every model answer in the evidence is
  supplied, so real-model judgment is unverified; plain-text and kit-only
  section loss stays open. **Partial preservation protection, not the edit path
  complete.**

### MERGED AND DEPLOYED: THE PRESERVATION CHECK (2026-09-24)

Owner: *"The preservation handoff passed independent review. Proceed with
merging and deploying this reviewed patch. Recheck current main and the
candidate before merging. Reviewed candidate: 1b968c9; expected image:
56f7d5866240a1de. If product code changed meanwhile, stop and identify the
difference."*

- **RECHECKED AT 05:30:38Z AND NOTHING HAD MOVED**: `origin/main` still
  `4df02867`, the candidate still `1b968c9`, and no product file differing from
  the reviewed tree (`16b9ce72`'s). Zero runs in progress or queued; the image
  predicted over both ends again; the rollback tree re-verified (`ddabc0dd…`,
  main's own); the served-file BEFORE reading re-taken at 05:30:58Z — **740,600
  bytes, `37983c53938d6581`, 0 × `partsUnsure`**, byte-identical to main's.
- **A FAST-FORWARD**: `main` `4df02867` → **`1b968c9`** at **05:31:09Z**.
- **DEPLOY 2151 (`35960304858`)** — success, job 05:31:15 → 05:34:12Z,
  **2m57s**; image step **2m11s** with **0 `CACHED` lines**; Wrangler 19s.
  `DEPLOY_ID` `***b968c9de0530872e06ee24680dbfec9d36b928f` (the `***` a masked
  `1`); image **built `56f7d5866240a***de`** (registry answered 404, `***86
  inputs off ./Dockerfile`) and **rolled from `67a8***b55332be3a9`** (`- "image"`
  → `+ "image"` under `SUCCESS Modified application`, `Applied changes`);
  `+ /chat.js`, 1 uploaded, 85 already; `Uploaded isibi-app`, `Current Version
  ID: 5f694545-…`, `Deployed isibi-app triggers`.
- **THE TWENTY-SECOND IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH,
  AND THE INPUT COUNT MOVED 185 → 186 AS PREDICTED** — `builder/page-keep.mjs`
  joined the Dockerfile's worker COPY line, so the count is a second quantity
  agreeing independently of the id.
- **THE SERVED-FILE CHECK, BOTH READINGS**: after (05:35:15Z) **741,487 bytes,
  `54397bfe3a57abb0`, 2 × `partsUnsure`, byte-identical to `git show
  1b968c9:public/chat.js`** — exactly the handoff's prediction. Gates **401 /
  401 / 401 / 404**.
- **DEPLOYED, NOT RUNTIME-CONFIRMED.** The confirmation is the canary's free
  press, and the session **re-tested it rather than assumed it**: at 05:52:40Z,
  18 minutes after the deploy finished, `run_workflow` on `edit-canary.yml`
  (`main`, `spend: no`, both expectations set) answered **403 Resource not
  accessible by integration** — the `actions: write` wall again. **The owner's
  press**: `edit-canary.yml` from `main`, `spend` no, `expect_deploy`
  **`1b968c9de0530872e06ee24680dbfec9d36b928f`**, `expect_image`
  **`56f7d5866240a1de`**, everything else at its default. It refuses on a
  mismatch of either, so it cannot pass against the previous build.
- **THE LIMITS TRAVEL WITH IT**: supplied model answers only, so a real model's
  judgment is unverified; plain-text and kit-only section loss stays open.
  **Partial preservation protection, not the edit path complete.**

### A ROUTING ANSWER THAT CANNOT BE ACTED ON STOPS A LIVE SITE (2026-09-24; merged and deployed in 2152 — no paid run)

Owner, after checking the reproduction: *"On an existing site with pages,
validate the routing result before dispatching any action. Network/HTTP/parse
failures, explicitly failed results and malformed action payloads must stop
with an explanation—no edit, addon or rewrite POST."* — with two response
shapes added to the same task: `{ok:true, intent:"addon", failed:true}` (it
started the paid add-on) and `{ok:false, intent:"build"}` /
`{ok:false, intent:"edit", layer:"look"}` (they started work).

**WHAT THE OLD HANDLER DID, MEASURED** through the real send handler on
`7bdee26c`'s `siteRoute` (supplied answers, no network): of the 31 answer
shapes in the stop table, **19 posted `react-revise`** — the rewrite of every
page (a revise of the same site measured **17** credits) — **9 posted the edit
route** (`{ok:false…}`, an edit with no `ok`, and every malformed edit: a layer
of `["look"]` posted `layer: "look"`, the `String(["a"])` trap; a `rename` that
is not a string or a `remove` that is not a boolean posted an ordinary page edit
of the sentence with the move or removal dropped), **1 posted the paid add-on**
(the router's `failed: true` fallback) and **2 bought nothing but printed the
answer raw** (`[object Object]`, a blank line). An edit answer for a site with
pages and no address posted the rewrite; a 401 showed the gate AND started the
rewrite behind it. None said a sentence; every one that sent left the busy flag
set.

**THE RULE NOW**, `routeActionable(d, site)` in `public/chat.js`, asked once,
on a live site only (`!isBuild`), above every branch that sends:

- **the route's own verdict first**: `ok === true` and `failed !== true`. A body
  that is not a decision — `null`, a list, a bare value — fails there too.
- **then the fields each action READS, with the type it reads them as**: `edit`
  needs the site's address and a layer in `ROUTE_EDIT_LAYERS`, with `page` and
  `rename` absent or strings and `remove` and `tab` absent or booleans; `addon`
  needs the address; `build` nothing more; `ask` a non-blank string; `clarify`
  the one reader its branch draws from (`routeQuestion`, the paragraph after the
  evidence); any other intent fails. **A malformed field refuses the whole answer rather than
  reading as absent**, because at the point of use absent is a different action.
- **a refusal is `lost(r)`**: `finish` with *"⚠️ I couldn’t work out what to do
  with that just now, so nothing on your site changed. Send it again in a
  moment."*, or *"⚠️ You’re signed out. Sign in and send that again."* on a 401,
  beside the gate `apiFetch` already shows. `finish` clears `siteBusy`, stops the
  rail and its clock. **It claims nothing about money**: the routing call is
  billed on its own and may already be charged, and `apiFetch` refreshes the ✦
  pill on this route whatever it answered.
- **a thrown fetch** is `.catch(() => (isBuild ? go() : lost()))`.
- **`ROUTE_EDIT_LAYERS` IS A COPY of `EDIT_LAYERS`** (a classic script cannot
  import), compared both ways by the test.
- **the comment above `siteRoute` is corrected**: it said every failure falls
  through to the build, true while every message on an existing site WAS a
  revise. *A rule true because of a layer below it expires when that layer
  moves*, in the browser this time.

**KEPT, AND ASSERTED**: a valid edit for each of the nine `EDIT_LAYERS` posts the
edit route with that layer; well-typed `page`, `remove`, `rename` and `tab`
reach the POST as they came; a valid add-on; an explicit build on a live site
(the revise — how a customer says "scrap this"); the route's zero-balance build
(the revise's own 402 speaks); a question with an answer; a clarify round on a
live site and on an empty project; an explicit build on an empty project. **AN
EMPTY PROJECT KEEPS ITS DOCUMENTED DEFAULT**: a dropped request, a 500,
`{ok:false}` and a `failed: true` build all still start the first build.
**UNCHANGED, STILL SEPARATE TASKS**: the adopted site with no page list
(next-task 7 — its `isBuild` is true, so it is outside this rule) and the
add-on request's own failures (next-task 8, two ADJACENT OPEN DEFECT cases).

**⚠ FOUND WHILE RENDERING, NOT CHANGED: CHROMIUM RE-SENDS A ROUTING POST WHOSE
CONNECTION IS RESET.** One `fetch` from the page, against a local server that
destroys the socket, drew **3** requests (reset before or after reading the
body) or **2** (reset after the headers); the screenshot harness drew 7. That is
the browser's network stack, identical before and after this change, and **not
measured against the real edge** — Cloudflare answers a Worker that throws with
a 5xx, not a reset. Where it does happen, each re-send that reaches the model is
billed. Recorded, not investigated.

**EVIDENCE.** `test/site-route-failure.test.mjs` goes **32 → 55 cases** and now
drives the real `siteSend`, so the busy flag, `siteBuildStart`/`siteBuildStop`
and the rail's clock are the real ones (the clock counted, not scheduled): 33
stop cases, each asserting no request after the routing call, the busy flag
cleared, the rail stopped, its clock started once and cleared once, the exact
sentence, and no money word in it; the census; 17 controls; the empty-project
default; the adopted row; the two adjacent add-on cases. **Red 33 of 55 against
`7bdee26c`'s handler** (the three new helpers appended so the file loads) —
exactly the 33 stop cases; the other 22 pass on both. `site-ask`'s *"falls
through on anything unexpected"* guard pinned the old property and is
re-anchored to both rules (the empty project's two fall-throughs, the live
check before every sender, the catch, the clarify predicate). **Sixteen
targeted probes, not a sweep**, one per clause — `ok` ignored, `failed`
ignored, any truthy layer, each of the four field types unchecked, either
address check, a blank answer accepted, an unknown intent accepted, the status
ignored, the live check gone, `.catch(go)` back, the 401 sentence gone, the rule
applied to an empty project — **16 killed, the comment-only control
surviving**, `chat.js` restored byte-identical (`babddbb9dbb5a3f4`) after each.
The 91 test files that read `chat.js`: **2,889 / 2,889** on the committed tree. **Suite 7,383
locally** (`# tests 7383 / # pass 7383 / # fail 0 / # skipped 0`, `duration_ms
117,452`) — **+23 against 7,360**, exactly the file's 32 → 55. **AND CI
MATCHES**: unit run **`35964401253` on `d0e9c896`** reads **`# tests 7383 /
# pass 7379 / # fail 0 / # skipped 4`** (`duration_ms 122,195`) — the total is
what matches, `pass` differing by CI's four skips — with all 55 of the file's
cases found passing BY NAME in the downloaded log archive and zero `not ok N -`
lines. **⚠ AN ANCHORED COUNT OF `ok N -` LINES READS 7,382 ON THAT LOG, AND
7,383 IS RIGHT**: result 5300's line opens with a byte-order mark where the log
was chunked, so `^<timestamp> ok` misses it — count the result numbers, not the
lines. No `site build` fires: `public/` and these test files are on none of its
`paths`. The documents-only `9650c0d7` reads the same four numbers on run
`35964678838` (`duration_ms 100,145`), so it moved the suite by zero. **That
round's stamp chain ended at `d0e9c896`.** **Rendered in the
real workspace chat**, the message typed into the composer and sent, before and
after: a dropped request, the router's `failed: true` fallback, and
`{ok:false, intent:"edit", layer:"look"}` — before, the rail and the stop
button over a rewrite, add-on or edit request; after, the sentence and the send
button. **Every routing answer is SUPPLIED**: this proves what the browser does
with a response, never what a real router answers.

**A CLARIFY ROUND IS AN ACTION TOO, AND ITS CHECK READ ONE FIELD** (the owner's
review, the same day: *"routeAsksQuestion checks only the options array's
length"*). Reproduced by the owner through the real handler and again here in
the real workspace chat, on `d0e9c896`'s handler: `{question:{options:["Order",
"Visit"]}}` drew the question **"undefined"**, words that were an object drew
**"[object Object]"**, and `{text:"Choose one", options:[null, {}]}` drew two
buttons answering **"null"** and **"[object Object]"** — each with the clarify
round STORED, so the next message would be read as an answer to it. **Nothing
was sent, which is why the first round's stop table could not see it**: a
drawing is not a request, and every assertion there was about requests.

- **ONE READER, AND THE BRANCH DRAWS WHAT IT RETURNS.** `routeQuestion(d)`
  answers `{text, options}` — the words a string with something in it, at least
  two answers, every one a string with something in it — or `null`.
  `routeActionable`'s clarify arm and the clarify branch both ask it, and the
  branch pushes the reader's `text` and `options`, never the answer's own
  fields: a field the reader never looked at cannot reach the screen. **The
  rule is the producer's own shape** — `readQuestion` in `builder/site-ask.mjs`
  sends a clipped non-empty text and two to four non-empty string options and
  nothing else — so the browser refuses nothing the real route sends.
- **EVERY ANSWER IS CHECKED, THE FIFTH TOO**, though four are drawn: an unusable
  one dropped there would be a malformed field read as absent. Four or more
  usable answers still draw the first four (a control).
- **ON A LIVE SITE A REFUSED QUESTION IS `lost(r)`**: the same sentence, busy
  flag and rail cleared, **no clarify round stored**, nothing sent.
- **⚠ ONE CONSEQUENCE OFF THE LIVE SITE, STATED RATHER THAN LEFT TO BE FOUND**:
  the reader is shared, so an EMPTY project no longer draws a question it
  refuses either — and with nothing to draw, the answer falls to that project's
  documented default for an unusable answer, **the first build, which is paid**,
  where it used to draw the garbled question. A case pins it, so choosing a stop
  there instead is one assertion to flip, and the owner's to make.
- **UNCHANGED**: `siteAskHTML` still draws whatever a message STORED before this
  change — a branch reachable only from a record in a customer's localStorage
  STAYS, by this file's own rule — and the route never sends these shapes, so
  such a record exists only if a route misbehaved while the old code ran.

**EVIDENCE.** `test/site-route-failure.test.mjs` goes **55 → 74 cases**: 17
malformed shapes on a live site (the owner's three first; words missing, empty,
blank, a number, null or an object; answers missing, a single string, an empty
list, empty, blank, a number, a list, or an unusable fifth; no question at all;
a question that is only a string), a four-or-more control, and the empty-project
case. **Every stop now also asserts that no clarify round is stored**, and both
clarify controls assert the exact drawn message and the stored round `{brief,
qa: [], imgs: []}`. **Red 13 of 74 against `d0e9c896`'s handler** in a throwaway
worktree, the harness's one cut line pointed at the old function's name so the
file loads — the 12 shapes the length check let through and the empty-project
case; the 5 it already refused and every control pass on both. **Each red case
fails first on what was drawn** (`q: 'undefined'`, `q: '[object Object]'`,
`opts: [null, {}]`), **and with that assertion cut in the throwaway copy all 12
live-site shapes still fail — on the stored round**, so each assertion sees the
defect alone. `site-ask`'s guard pinned `routeAsksQuestion`'s exact body and is
re-anchored to the property: whole-line comments blanked, the code it scans
proved still there, siteRoute reads no `.question`, the reader does, and the
live check asks the same reader. **Nine targeted probes, not a sweep** — the
words read for truthiness, blank words accepted, the answers unchecked, only the
four drawn checked, one answer enough, every answer drawn, the check keeping the
old length rule, the branch drawing the raw answer, the branch keeping the old
rule — **9 killed, the comment-only control surviving**, `chat.js`
byte-identical to the fixed copy (`35e09289eb624b2e`) afterwards. **The
raw-answer mutant is killed only by the structural guard**, being behaviourally
equivalent on every input the reader admits — which is exactly why that guard
exists. The 91 files that read `chat.js`: **2,908 / 2,908**, +19. **Suite 7,402
locally** (`# tests 7402 / # pass 7402 / # fail 0 / # skipped 0`, `duration_ms
115,601`) — **+19 against 7,383**, exactly the file's 55 → 74. **AND CI
MATCHES**: unit run **`35967266345` on `0ca6b143`** reads **`# tests 7402 /
# pass 7398 / # fail 0 / # skipped 4`** (`duration_ms 121,218`) — the total is
what matches, `pass` differing by CI's four skips — with **all 183 cases of the
two changed files found passing BY NAME** in the downloaded log archive, 7,402
distinct result numbers and zero `not ok N -`. No `site build` fires, as before.
**The stamp chain ends at `0ca6b143`.** **Rendered in the real workspace chat**, the message typed and sent, before and
after: the owner's three shapes and a valid control — before, the garbled
question with its buttons and the round stored; after, the sentence, no round,
no buttons; the control identical both ways. **Every routing answer is
SUPPLIED**, as above.

### MERGED AND DEPLOYED: THE ROUTING PATCH (2026-09-24)

Owner: *"Merge and deploy the reviewed routing patch after rechecking current
main and candidate 40190564. Stop if additional product changes appeared.
Verify the deployed SHA and served chat.js against the merged file. Determine
container-image reuse from the actual inputs; don't assume a roll or require an
arbitrary wait. No paid run."*

- **RECHECKED BEFORE THE PUSH, AND NOTHING HAD MOVED**: a clean tree, `origin/main`
  still `1b968c9`, the candidate `40190564` the branch tip, and zero runs in
  progress, queued or waiting. The range is 7 commits and **5 files**:
  `public/chat.js`, `test/site-route-failure.test.mjs`, `test/site-ask.test.mjs`
  and the two documents. The one product file is the reviewed `chat.js`.
- **A FAST-FORWARD**: `main` `1b968c9` → **`40190564`** at **07:12:17Z**.
- **REUSE WAS PREDICTED FROM THE INPUTS, NOT ASSUMED**: both ends answer
  **`56f7d5866240a1de` from 186 inputs**, and none of the five files is an input
  (`public/` is not copied). The observer was proven first: `worker.js` and
  `builder/page-keep.mjs` are inputs, and nothing under `public/` is.
- **DEPLOY 2152 (`35968361110`)**: success, job 07:12:25 → 07:13:06Z (**~42 s**);
  image step **1.1 s** — `reused isibi-app-sitebuildcontainer:56f7d5866240a***de
  (registry answered 200; ***86 inputs off ./Dockerfile)`; Wrangler **~16 s** —
  `+ /chat.js`, 1 uploaded, 85 already, `Uploaded isibi-app`, **`no changes
  isibi-app-sitebuildcontainer`**, `Deployed isibi-app triggers`, `Current
  Version ID: 98474cac-…`. `DEPLOY_ID` `40190564b02e24b299d66fe6e9d0ecb1d4c3e466`
  (the log masks it as `40***90564…ecb***d4c3e466`).
- **NO HOLD IS OWED**: the 15–20 minute rule is about the roll, and nothing
  rolled. The edit jobs run on the image deploy 2151 put there. The whole change
  is the served file.
- **THE SERVED-FILE CHECK, BOTH READINGS**: before (07:12:08Z, before the push):
  **741,487 bytes, sha256 `54397bfe3a57abb0`**, byte-identical to `1b968c9`'s
  `chat.js`, 0 occurrences of `routeActionable` or `routeQuestion`. After
  (07:13:52Z): **746,091 bytes, sha256 `35e09289eb624b2e`**, 2 and 3 of them,
  and **byte-identical to `git show 40190564:public/chat.js`**. Gates **401 / 401
  / 401 / 404**.
- **THE ROLLBACK WAS VERIFIED BEFORE IT COULD BE NEEDED**: `git revert --no-commit
  1b968c9..40190564` in a throwaway worktree gives tree **`b436a175…`**, main's
  own, so a rollback also reuses `56f7d5866240a1de`.
- **DEPLOYED, NOT RUNTIME-CONFIRMED.** The Worker half is Wrangler's own report;
  the served file is the one reading taken directly. The canary dispatch answered
  **403** again at 07:14Z, so the confirmation is the owner's free press:
  `edit-canary.yml` from `main`, spend `no`, `expect_deploy`
  **`40190564b02e24b299d66fe6e9d0ecb1d4c3e466`**, `expect_image`
  **`56f7d5866240a1de`**. It also confirms 2151, since 2152 reused 2151's image.

### AN EXISTING SITE WHOSE PAGE LIST HAS NOT LOADED IS BUILT AS A NEW SITE — REPRODUCED (2026-09-24; built the same day, next section)

Owner: *"Then take the next separate edit-entry issue: an existing site whose
page inventory hasn't loaded is treated as a new project. Reproduce through the
real browser flow with recorded network actions … Establish whether an ordinary
edit starts a new build, targets the wrong site, or loses the request. Return the
smallest proposed correction before implementing it."* Next-task 7, driven end to
end.

**THE HARNESS** (scratchpad, not committed): the real `public/` app (`index.html`,
`chat.js`, `site-list.js`, `styles.css`) runs in a real Chromium with the sign-in
gate held down on the served copy, and every request the page makes is recorded.
The site list, the page list, the routing call and the build call are answered by
the real Worker (`loadWorker`). Its own outbound calls are stubbed: the owner, a
balance of 50, the site row, and a chat lookup that finds no site bound to the
chat the build names. **ONLY THE ROUTER'S ANSWER IS SUPPLIED.** Any other model
call is the build's design call, which is recorded and stopped there with a 503.
The site is `fretwork-1` as the server holds it: three stored pages (`/`,
`/prices`, `/gear`), built on another machine, bound to no chat. It is opened
from its start-screen card, which adopts it (`siteAdopt`: a new local record with
the slug and **no pages**), and sent *"Make the footer navy"*.

| `/api/site/routes` | routing body | router (supplied) | the work request |
|---|---|---|---|
| answered before the send | `firstBuild: false`, `hasSite: true`, pages `/ /prices /gear` | `edit`/`look` | `POST /api/site/fretwork-1/edit`, `layer: look`: **correct** |
| answers after the send | `firstBuild: true`, `hasSite: false`, pages `[]`, `slug: fretwork-1` | `build` | `POST /api/site/react-build` `{brief: "Make the footer navy", chat: site_…}`, **no slug** |
| fails | the same | `build` | the same |
| a new project (control) | `firstBuild: true`, `hasSite: false`, pages `[]`, `slug: ""` | `build` | `POST /api/site/react-build`: correct |

**THE REAL BUILD ROUTE THEN BUYS A NEW SITE**, identically for the last three rows:
the chat lookup finds no site, **`credit_debit` takes the 2-credit deposit**, and
**the design model is called**. A paid build of a new site has started there; the
harness stopped it with a 503 and the route reversed the deposit. In the "answers
after" row the page list did land, but after the build had been sent. **With the
build's answer supplied as a success** (a fifth run), the workspace opened for
`fretwork-1` became **"Navy Footer" at `navy-footer`**, the thread said *"✅ Built
“Navy Footer”. Tell me what to change."*, and `fretwork-1` was never touched.

**SO IT IS ALL THREE, NOT ONE**:
- it **starts a new paid build**: the deposit and the design call, plus the routing call;
- it **targets the wrong site**: the build body names no site, and its answer points
  the open workspace at the new one (`s.slug = d.slug`);
- it **loses the request**: the edit never reaches `fretwork-1`, and the sentence
  becomes a new site's brief.

**AND NO ROUTER ANSWER CAN REACH THE EXISTING SITE FROM THAT STATE.** Here is the
real `/api/site/route`, driven with every answer supplied over the two bodies:

| body | edit | edit (a page) | addon | build | clarify | ask |
|---|---|---|---|---|---|---|
| list missing | build | build | build | build | **clarify** | ask |
| list loaded | edit/look | edit/page | addon | build | addon | ask |

`hasSite: false` closes `edit` and `addon` at `readRouting`, so both fall to
`FALLBACK_NO_SITE` (a build). `firstBuild: true` opens **a first-build interview on
an existing site**, and the answer to that question goes through `siteAnswer`,
which builds. **No change to the router's instructions can fix this: the body it
is sent is the defect.**

**THE CAUSE IS ONE LINE AND A LATCH.**
- `siteSend` decides *first build?* with `const isBuild = !sitePages(site).length`,
  read off localStorage. An adopted record has no pages (`fromRow` and `siteAdopt`
  carry none).
- The list arrives only through `siteRoutesFetch`, which the render fires and
  forgets, **once per slug per page load** (`siteRoutesAsked`, never cleared), and
  which is **silent on every failure**.
- **THE WINDOW**: the first message on a site opened in a browser that did not
  build it, until that read lands; or every message of a page load in which the
  read failed. Once a read succeeds the list is saved and later loads are safe.
- `siteRoute` sends `firstBuild: !!isBuild` and `hasSite: !!(site.slug &&
  sitePages(site).length)`, and the Worker takes both **on trust, deliberately**.
- **Its comment is wrong in one clause**: *"claim you have none and you rebuild
  your own site"*. A first-build body carries no slug, so what gets bought is a
  NEW site, never a rebuild of yours.
- **The browser's comment above the body is wrong twice**: it says `hasSite` is
  *"about the SERVER owning a published site"* and that *"the server re-checks it
  anyway"*. In fact it is computed from localStorage pages, and the server
  re-checks nothing.

**⚠ A SECOND COLLAPSE UNDER THE FIRST**: `/api/site/routes` reads through
`loadSiteSource`, which folds a FAILED R2 read into `null`. So it answers `{ok:
true, routes: []}` with *"nothing stored — this site has not published a build
yet"* both for a site that never published and for a read that threw.
(`readSiteSource` already answers `{ok, pages, why}`; the route just does not ask
it.) **A correction that reads `routes: []` as "never published, so a first build
is right" re-opens the defect on an R2 blip.**

**THE PROPOSED CORRECTION — BUILT THE SAME DAY, with the clarify doors the owner
added (next section).** It touches the browser
only (`public/chat.js`), so no container roll:

1. **A PROJECT WITH AN ADDRESS IS NEVER A FIRST BUILD.** In `siteSend`, a site with
   a `slug` and no page list waits for the page list before anything is routed. A
   read already in flight is reused; one that failed or answered nothing is asked
   again, since the customer's send is reason enough for one request.
   `siteRoutesFetch` returns the read (one promise per slug). The render path is
   unchanged and keeps its once-per-load latch.
2. **THE LIST ARRIVES → the ordinary live-site path**, routed with the real pages
   (`firstBuild: false`, `hasSite: true`).
3. **THE READ FAILS → STOP WITH A SENTENCE, NOTHING SENT**: no routing call, no
   charge, busy flag and rail cleared. Wording is the owner's; a draft: *"⚠️ I
   couldn't load your site's pages just now, so nothing on your site changed. Send
   it again in a moment."*
4. **THE READ ANSWERS NO PAGES → ALSO A STOP, NEVER A FIRST BUILD.** Recommended
   because of the collapse above: a first build from a slugged record makes a
   different site under a different name, and `routes: []` cannot tell "never
   published" from "the read failed". **The cost**: a never-published site opened
   from its card in another browser cannot be built from that card (a new project
   still can). **The alternative** is a Worker change (the route asks
   `readSiteSource` and answers 503 when the read did not happen) so that
   `routes: []` means what it says. That costs an image roll, since `worker.js` is
   an input.
5. **THE TWO WRONG COMMENTS ARE CORRECTED** in the same change.

- **NOT RECOMMENDED: the two-line alternative** of taking `isBuild` and `hasSite`
  from `site.slug` alone and routing with `pages: []`. That is the **blind router**
  (run 23's `/book`: `readEdit` checks a named page only against a non-empty list).
  A blind router also cannot draw the edit/addon line, which is *does the thing
  they name exist on the site now*.
- **NOT IN IT**: the addon request's own failures (next-task 8); a clarify round
  the defect already stored on a slugged record (reachable only from such a record,
  and it still answers through `siteAnswer`) — **the owner put this one IN: next
  section**; the full revise; translation; hydration; model-written replies.
- **TESTS, ON APPROVAL**: focused cases driving the real `siteSend` for loaded,
  loading, failed, answered-empty and a new project. Each asserts the requests,
  the busy flag, the rail and the sentence. The RECORDED case in
  `site-route-failure.test.mjs` (*"a failed routing call on an adopted site with no
  page list starts a NEW site build"*) flips from a characterisation into a stop.
- **⚠ WHAT THE REPRODUCTION DOES NOT CLAIM**: the router's answer is supplied, so
  what a real router says to *"Make the footer navy"* under `firstBuild: true` is
  unmeasured. The matrix is why that does not matter: every work answer it could
  give is a build, and `clarify` leads to one.
- **FOUND ON THE WAY, NOT CHANGED**: a legacy static project answers *"Say “rebuild
  it” and I’ll regenerate it"*, but `siteRebuild` no longer exists anywhere. Its
  comment still cites it, so "rebuild it" gets the same sentence back forever.
  That branch is reachable only from a stored record, so it stays; only the promise
  is false.

### AN EXISTING SITE WAITS FOR ITS PAGE LIST, AND A ROUND ON ONE SENDS THE ORIGINAL REQUEST (2026-09-24, on the branch — not merged, not deployed, no paid run)

Owner: *"An existing site must not become a first build because its page
inventory is loading, empty or unreadable. Await the in-flight inventory request
before routing; allow a retry after failure. If usable inventory cannot be
established, stop without starting paid work. Keep genuine new-project behavior
working. Cover clarification entry points in this same correction. … Protect
typed replies, option clicks and skip; preserve the original request and
attachments. Keep the wait bounded and tied to the original site."* **Browser
only (`public/chat.js`)** — no Worker change, so no image input moves.

- **ONE READ PER SLUG IN THE AIR** — `siteRoutesRead(slug)`, shared by the
  picker's fetch and by a message. A message sent while the picker's read is out
  waits on THAT read: measured in the real browser, one request. It resolves
  `{paths, status}` and never rejects. **BOUNDED**: `SITE_ROUTES_WAIT_MS` 15,000,
  the request aborted at the bound. It leaves the map when it settles, which is
  what lets the next message ask again after a failure, and any read marks the
  picker's once-per-load latch, so a list a message fetched is not re-read by the
  next render. `paths: null` (unread) and `[]` (answered none) are kept apart and
  **nothing downstream reads them differently today** — both stop — so a probe on
  that line is equivalent by construction and was left out, said here.
- **THE PICKER BEHAVES AS IT DID**: latched, silent on failure, never
  overwriting a longer list at apply time (`siteRoutesApply`). Its once-per-slug
  case now also renders AFTER the answer landed — a read in the air is shared by
  construction, so only a later render shows the latch itself holds.
- **THE SEND** — `siteSend`: a record with an address and no page list waits
  (`siteWithPages`), then routes as the live site (`firstBuild` false, `hasSite`
  true, its real pages); with no usable list it stops with `SITE_NO_PAGES_MSG`,
  *"⚠️ I couldn’t load your site’s pages just now, so nothing on your site
  changed. Send it again in a moment."* (the owner's to reword), or the
  signed-out sentence on a 401. **No routing call on a stop** — that call is
  billed too. **Empty stops as well**, because the route answers `routes: []`
  for a store read that failed.
- **TIED TO THE SITE IT WAS SENT FROM.** The continuation re-reads the ORIGIN's
  record by id, never `siteOpenId`, and requires the address the list was read
  for: a workspace switch during the wait cannot send the message to the site on
  screen; a record removed meanwhile is sent nothing and the workspace freed; a
  re-addressed one stops. The busy flag is set before the wait, so a second press
  — any door, any workspace — is refused rather than queued, and the attachments
  leave the composer at send, so they travel with that message. **⚠ And a stop
  then left them nowhere** — the owner's reproduction the same day; they are
  handed back now (next section).
- **A ROUND ON AN EXISTING SITE** — `siteAnswer`. Every way out of a stored
  first-build round built a new site: skip posted `react-build` with no slug, an
  answer was routed with `firstBuild` set (the owner's two). **Reproducing them
  found a third**: on a site whose list WAS loaded, an answer the router took as
  an edit went as the edit's instruction — *"A guitar school"* for a look change
  — and the round stayed stored (the real Worker, real browser, both halves).
  Now, on a site with an address, a typed reply, an option (clicked or keyed) or
  skip (clicked or Escape) ends the round and sends the ORIGINAL request
  (`round.brief`) with its attachments (`round.imgs`) down the live path once
  the list is in. The answer stays in the thread and is sent nowhere. **A stop
  leaves the round untouched** — no answer written into it — so the next press
  tries again. **One redraw** when the round ends takes its buttons off the
  screen; they are inert while busy, but otherwise stayed drawn until the work
  finished. The new-project path keeps that stale draw — pre-existing, untouched.
- **A NEW PROJECT IS UNCHANGED**: no address, no read; a first build, the
  interview, skip straight to the build, a failed routing call still building.
- **THE `hasSite` COMMENT IS CORRECTED**: it said the flag was "about the SERVER
  owning a published site … and the server re-checks it anyway"; it is read off
  this browser's record and the server takes it on trust.

**EVIDENCE.** `test/site-entry-inventory.test.mjs`, **37 cases**, drives the real
`siteSend`, `siteAnswer`, the thread's click delegation and the keyboard listener
with the real `siteRoute`, `siteEdit`, `reactSend`, busy flag and rail; `fetch`
is the one seam. Every case asserts the outgoing requests and the screen state —
thread, busy flag, rail and its clock, the round, the pages, the redraws.
**Red 32 of 37 against unfixed `c0acaf88`** in a throwaway worktree (the new
helpers appended so it loads), every red case failing first on the defect itself
(*the list was not read*, or nothing was waiting); the 5 green are the loaded
control and the four new-project controls. **Three existing harnesses carried
the change rather than being appeased**: `page-picker` now carries the shared
read (never faked); `site-route-failure` answers the page-list read on its own,
and its RECORDED adopted-site case flipped into a live-site stop;
`site-ask`'s skip-path window re-anchored landmark to landmark — **it was vacuous
before this change** (its slice stopped just before the only `siteRoute(` it
could have matched) and empty after it, and is proved alive now by making a new
project's skip call the router. **Targeted probes, not a sweep: 20 killed, 0
survived, 0 never applied, the comment-only control surviving**, over `chat.js`
against the four files (spec in the scratchpad, as the last two rounds kept
theirs), run on the final file; `chat.js` byte-identical to its backup
afterwards (`22161c29c3c977be`). **Suite 7,439 locally** (`# tests 7439 / # pass
7439 / # fail 0 / # skipped 0`, `duration_ms 116,676`) — **+37 against 7,402**,
exactly the new file; the 92 files that read `chat.js`: **2,945 / 2,945**.
**AND CI MATCHES**: unit run **`35974950743` on `fcc0d067`** reads **`# tests
7439 / # pass 7435 / # fail 0 / # skipped 4`** (`duration_ms 110,479`) — the
total is what matches, `pass` differing by CI's four skips — with all 37 of the
file's cases found passing BY NAME in the downloaded log archive, 7,439 distinct
result numbers and zero `not ok N -`. No `site build` fires: `public/` and these
test files are on none of its `paths`. **The stamp chain ends at `fcc0d067`.**
**Rendered in the real workspace, before and after**, nine scenes (the reproduction's
instrument: real app, real Chromium, real Worker for the page list, routing call
and build route): before, a loading, failed or empty list and a skip each started
a paid build of a new site (deposit taken, design model called) and an option or
typed answer sent the answer as the edit; after, the loading list is waited on
and the original request reaches `fretwork-1`, and a failed or empty list stops
with the sentence after one retry. **Every routing answer is SUPPLIED**: this
proves what the browser sends and shows, never what a real router answers.

### A MESSAGE THE PAGE-LIST CHECK STOPPED KEEPS ITS FILES (2026-09-24, on the branch — not merged, not deployed, no paid run)

Owner, reproducing it through the real handlers on `c5c93652`: an existing site
with no page list loaded, a picture attached, *"Use this picture as the logo."*,
the page-list read fails → *"Send it again in a moment"* — `siteAttach` empty,
the stored message carrying no attachment, and the message sent again routed
`attached: false` and posted the logo edit with no images. *"Preserve the
original request and attachments when this pre-routing check stops. Keep
recovery tied to the original site; do not restore its files into another
workspace or overwrite newly selected attachments. No automatic paid retry."*
**Browser only (`public/chat.js`).**

- **REPRODUCED FIRST, TWO WAYS**: through the real `siteSend` with the picture
  made by the real attach code (`siteAttachFiles` → `siteAttachOne`), and in a
  real browser with the real + button and file chooser. After the stop the box
  and the strip were empty; the resend was routed `attached: false` and the logo
  edit posted `images: none`.
- **THE CAUSE IS LAST ROUND'S OWN DESIGN**: `siteSend` takes the attachments off
  the composer at send so they travel with the message whatever is on screen
  during the wait — and a stop then left them nowhere. Nothing stores an
  attachment on a thread message, anywhere.
- **KEPT ON ITS OWN SITE** (`siteHoldUnsent`): on a stop before routing,
  `siteSend` keeps `{t, imgs}` on the ORIGIN record, by id, **before** `finish`
  redraws — so that redraw is the one that hands it back. A LIST, so two stopped
  messages on one site each keep their own words and files.
- **HANDED BACK ONLY TO THAT SITE'S COMPOSER** (`siteUnsentBack`, called by
  `wireSiteComposer` — the composer's wiring lifted out of `renderSiteWorkspace`
  unchanged): the latest held message, whole — its files into the strip, its
  words into the box — **only into an EMPTY strip, and while nothing is being
  sent**. Another workspace or the start screen never draws it; the history rail
  draws no composer, and it waits.
- **WHOLE AND ALONE, AND WHY NOT BESIDE.** The first cut put the held files
  beside a picture chosen during the wait. **The logo rung uses the FIRST
  attachment and ignores the rest** (`worker.js`: *"UP TO 3 ARRIVE AND ONLY THE
  FIRST IS USED"*), so a quick "send it again" would have put the NEW picture up
  as the logo. So a newly chosen attachment stays exactly as it is — not
  replaced, joined or moved — and the held message waits until the strip is
  clear.
- **NOT WHILE SENDING**: `siteSend` redraws BEFORE it takes the strip, so a
  hand-back on that redraw would leave with the new message's words — a
  words-only message would have carried the held picture, routed `attached:
  true`. Asserted, and the probe that drops the check dies on it.
- **IN MEMORY ONLY**: `sitesSave` writes `unsent: undefined`. A held picture is a
  data URL of up to ~7 MB, and a record carrying one can overflow localStorage
  and fail the save of every site, not just this one. It lasts as long as the
  page, like anything in the composer — **a reload loses it**, the owner's call.
- **NOTHING SENDS IT AGAIN**: the routing call is billed, so sending is the
  customer's press.
- **UNCHANGED, AND SAID** — **⚠ AND WRONG TO LEAVE, the same day (owner)**: the
  strip was ONE list drawn by whichever composer is showing, so a file handed
  back and not sent followed the customer to another site "like any attachment",
  and the box is drawn empty on every redraw, so the handed-back words went at
  the next one. Recorded here as pre-existing; the owner reproduced both as the
  defect they are, and they are fixed in the next section — *a composer's words
  and files belong to its own site*.
- **⚠ FOUND ON THE WAY, NOT CHANGED — THE SAME LOSS ONE STEP LATER.** A routing
  call that fails or answers something unusable stops in `siteRoute`'s `lost()`
  with *"…Send it again in a moment"* and drops the attachments too — on any
  live site, page list loaded or not, and on an existing site's round, whose
  round is cleared before routing. **Measured through the same harness on
  `c5c93652`**: strip empty, nothing held, the resend's logo edit posting no
  image. Outside "this pre-routing check", so it is next-task 9, not fixed here.

**EVIDENCE.** `test/site-entry-inventory.test.mjs` **37 → 48 cases**. The
harness now draws the composer the way the page does on every redraw — a new,
empty box; Send, or Stop while busy; the +; a new strip; or no composer on the
history rail — and wires it with the real `wireSiteComposer`; the attachment is
made by the real attach code out of a file; the real `paintAttachStrip` paints it
(what it DRAWS is asserted); the real `sitesSave` writes a fake localStorage.
**11 new cases**: the owner's reproduction as failure → retry through the
composer's own Send button, the exact image object on the logo edit; the other
three stop reasons (empty, signed out, the bound); a switch to another site and
to the start screen during the wait; a picture chosen during the wait (left as
it is; the held message waits, then comes back whole after its × and a redraw); a
words-only message sent while one waits; two stopped messages (latest first);
the history rail; storage. **The 37 existing cases pass unchanged** — the
clarify, timeout, duplicate-send and new-project cases among them. **Red 11 of
48 against `c5c93652`**, in a throwaway worktree with the old inline composer
wiring packaged under the new name so the file loads — exactly the 11 new
cases, each failing first on the missing hand-back or hold; the controls'
protective halves (nothing into another workspace, a new picture untouched) pass
on both, as a control's should. **Targeted probes, not a sweep: 13 killed, 0
survived, 0 never applied, the comment-only control surviving**, over `chat.js`
against seven files (spec in the scratchpad); `chat.js` byte-identical to its
backup afterwards (`41ccd678eec40411`). The files that read `siteSend`, the
workspace render, the strip or the save: **486 / 486**. **Suite 7,450 locally**
(`# tests 7450 / # pass 7450 / # fail 0 / # skipped 0`, `duration_ms 116,649`)
— **+11 against 7,439**, exactly the new cases. **AND CI MATCHES**: unit run
**`35978672105` on `bd70385a`** reads **`# tests 7450 / # pass 7446 / # fail 0 /
# skipped 4`** (`duration_ms 103,827`) — the total is what matches, `pass`
differing by CI's four skips — with all 48 of the file's cases found passing BY
NAME in the downloaded log archive, 7,450 distinct result numbers and zero `not
ok N -`. No `site build` fires: `public/` and this test file are on none of its
`paths`. **The stamp chain ends at `bd70385a`.** **Rendered in the real
workspace, before and after**: the owner's case (box and strip empty → the words
and the picture back; the resend `attached: false`, no image → `attached: true`,
the attached picture on the logo edit) and the workspace switch. **Every routing
answer is SUPPLIED**: this proves what the browser sends and shows, never what a
real router answers.

### A COMPOSER'S WORDS AND FILES BELONG TO ITS OWN SITE (2026-09-24, on the branch — not merged, not deployed, no paid run)

Owner, on `3736239`, with the real handlers and the composer wiring: *"Fail the
page-list read with “Use this picture as the logo” and an attachment. Recovery
restores both. Redraw the workspace: the message becomes empty, the attachment
remains, and unsent is already null."* And: *"After recovery, switch to another
site. The restored attachment remains in global siteAttach. Sending a logo edit
there posts the original site’s picture to the other site’s edit endpoint."* —
*"Keep recovered words and files associated with their original site until
explicitly sent, replaced or discarded. Redraws must preserve that association,
and switching sites must not transfer the recovered attachment. Preserve any
newer draft or attachments too."* **Browser only (`public/chat.js`).**

- **REPRODUCED FIRST, BOTH**, through the real `siteSend`, the real attach code
  and the real `wireSiteComposer`: after one redraw the box read `""` with
  `logo.png` still in the strip and nothing held; on ashgrove-1 the strip still
  held it and `POST /api/site/ashgrove-1/edit` went with `images: ["logo.png"]`;
  back on fretwork-1, nothing at all.
- **THE CAUSE IS LAST ROUND'S HAND-BACK.** It moved the held message into the
  only two places a composer had — the words into a box every redraw draws
  empty, the files into ONE list drawn by whichever composer is showing — and
  cleared the hold. Last round recorded the strip following the customer as
  pre-existing; the owner reproduced it as the defect it is, and it is the same
  defect for ANY attachment, returned or not.
- **EACH COMPOSER HAS A DRAFT** (`siteDraft(id)`): `{t, imgs}` on the site's own
  record, and `siteNewDraft` for the start screen. `siteAttachFor` names the
  composer on screen (a site's id, or `''`). The box writes its words into its
  draft on every keystroke (`oninput`) and is filled from it on every draw; the
  strip draws the draft of the composer on screen and its × removes from that
  draft; a file goes into the draft of the composer it was CHOSEN in
  (`siteAttachFiles` names the owner before the read, which answers on a later
  turn); `siteSend` takes the origin site's files and the Send button its words.
  **The global `siteAttach` is gone**: no list belongs to nobody any more.
- **A RETURNED MESSAGE GOES INTO ITS SITE'S DRAFT** (`siteUnsentBack`), so it
  survives every redraw and stays on its site when another is opened, until it
  is sent, changed or cleared. **Only into an EMPTY draft — no words, no files —
  and never while a message is in flight**: last round's "whole and alone" rule,
  widened to the words.
- **⚠ TWO CONSEQUENCES, SAID RATHER THAN LEFT TO BE FOUND:**
  1. **Words typed while a message waits now SURVIVE its stop**, and the stopped
     message waits behind them until they are sent or cleared; the next draw
     then brings it back. Last round the stop's redraw wiped them and the
     stopped words took their place.
  2. **A returned message whose picture alone is removed keeps its words in the
     box**, and the next held message waits until the box is clear too. One
     existing case (two stopped messages) asserted the old order; it now clears
     the words before the redraw that brings the first message back.
- **THE PLATFORM'S OWN WORDS NEVER TAKE THE DRAFT.** The two Fix presses
  (`stFixBtn`, `stErrFix`) call `siteSend(text, true)` (`leaveDraft`). Before, a
  Fix press took the strip with it — a returned logo sent with an instruction
  nobody wrote — and its redraw wiped the box. A census holds it: every call
  that sends a sentence written in the code passes `true`, and the composer's
  two sends (`t`, `prompt`) pass nothing.
- **THE START SCREEN'S FILES ARE ITS OWN**: opening a site no longer carries them
  into that site's strip, and `siteCreate` moves them to the new project's
  draft, which its first build takes. **Its words are unchanged** — its box is
  still drawn empty on a redraw (pre-existing, not asked).
- **IN MEMORY ONLY**, like the held message: `sitesSave` writes `draft:
  undefined`, and a reload loses a draft. A deleted site's draft goes with its
  record.
- **UNCHANGED**: next-task 9 (a routing call that cannot be acted on drops the
  attachments) is untouched.

**EVIDENCE.** `test/site-entry-inventory.test.mjs` **48 → 60 cases**, and its
harness now carries the real `siteDraft` and `siteCreate`; typing fires the box's
`input` event, as a browser does. **12 new cases**: the owner's first sequence
(redraws and the history rail round trip keep both, Send sends both); the
second sequence to another site AND to the start screen (nothing arrives, and
what is sent from there carries no picture — ashgrove-1's logo edit and a new
project's build); switching back after a message was sent and answered on the
other site; a newer draft kept on both sites; words typed during the wait; a Fix
press; the census; a file still being read when another site is opened; the
start screen's files reaching a new project's build and no other composer; the
start screen's two modelled lines, asserted in `renderSites`; and an answer typed
into the box not coming back into it. The storage case now also saves after the
hand-back and finds no draft and no picture. **The immediate-retry and every
clarification case pass unchanged.** `test/site-route-failure.test.mjs` carries
the real draft code in place of the old strip: **74 / 74**. **Red 12 of 59
against `3736239f`** (in a throwaway worktree, with a shim making every "draft"
the old single strip so the harness loads): the 11 new cases then written and the
changed half of the two-messages case, each failing first on the defect — the box
`''` after the redraw, `logo.png` in ashgrove-1's strip, ashgrove-1's routing call
`attached: true`, the Fix press routed with the picture. **With those gates cut
in the throwaway copy, the second sequence fails at the wire**: `logo.png` posted
to `/api/site/ashgrove-1/edit`, and into a new project's build from the start
screen. The typed-answer case was written afterwards for a probe (below); the old
code keeps no draft for it to read. **Targeted probes, not a sweep: 22 killed, 0
survived, 0 never applied, the comment-only control surviving**, over `chat.js`
against five files (`site-entry-inventory`, `site-route-failure`, `site-ask`,
`site-context`, `free-identifiers`; spec in the scratchpad); `chat.js`
byte-identical to its backup afterwards (`98f883cf3bff10bd`). **Not probed, and
said**: the three-file limit's counts (`siteAttachOpen` is stubbed in the
harness) and `siteDraft`'s answer for a site that is gone (unreachable there).
**One redundancy removed rather than left for a probe to survive**: `siteSend`
also cleared the draft's words, which only the Send button holds; it takes the
files alone now. The 92 files that read `chat.js`: **2,968 / 2,968**. **Suite
7,462 locally** (`# tests 7462 / # pass 7462 / # fail 0 / # skipped 0`,
`duration_ms 116,248`) — **+12 against 7,450**, exactly the new cases.
**Rendered in the real workspace, before and after**, both sequences with the
real + button and file chooser, the real Worker, every request recorded:
before, the redraw emptied the box and Send sent nothing, and ashgrove-1's logo
edit carried `fretwork-logo.png` while fretwork-1 was left empty; after, both
kept, ashgrove-1's edit carried no picture, and back on fretwork-1 the request
went whole. **Every routing answer is SUPPLIED**: this proves what the browser
sends and shows, never what a real router answers.

### THE THREE PRODUCT DEFECTS RUN 12 EXPOSED (2026-09-21)

Run 12 cost 2 credits and published nothing, and every one of its causes is a
COLLAPSE — two different facts arriving as one value, then acted on as if they
were the same fact. Three fixes, and the third was found by the guard written
for the second.

**1. THE ROUTER PREFERRED `rules` FOR ANYTHING "BEHAVIOURAL", WHICH IS FALSE OF
A PAGE.** The layer description ended *"so prefer it whenever the change is
honestly about behaviour rather than appearance"* — and **a component on a page
has behaviour too**: it counts, it subtracts, it decides what to say when a
number is zero, and every one of those is a file a page writer edits.

- **THE LINE IS ENFORCEMENT AGAINST DISPLAY, AND THE WORDS DO NOT DECIDE IT.**
  *"Reject bookings after six places are taken"* is `rules` — the site must
  start accepting or refusing something different. *"Show six minus the booking
  count"* is `page` — a section calculates differently from data it already
  receives. **`bookings`, `capacity`, `places`, `slots` and `limit` occur on
  BOTH sides**, which is asserted rather than claimed, so matching on them is
  how a display change is routed into the database.
- **SAID IN BOTH DESCRIPTIONS, DELIBERATELY.** A model reading downwards meets
  whichever description its candidate answer is, and run 12's candidate was
  `rules` — the `page` block alone would not have caught it.
- **⚠ AND NO GUARD HERE CLAIMS A ROUTING OUTCOME.**
  `test/ask-router-display.test.mjs` asserts a property of the INSTRUCTIONS THIS
  REPOSITORY SHIPS and nothing else; it reaches no model, and a stubbed answer
  would be a fixture agreeing with itself. **Which layer grok picks for a given
  sentence is settled by a live run and by nothing else** — a census in the file
  fails if anybody adds a stub, so the claim and the code cannot drift.

**2. THE `rules` RUNG READ ONE `null` FOR FOUR FACTS.** It asked
`siteBackendBySlug` and escalated on a falsy answer — the collapse
`site-backend-state.mjs` has argued apart since 2026-09-15, and which the ADDON
path was fixed for then. This rung was not.

- **`siteBackendDetail` IS THE READER NOW**, the same one the addon uses:
  `ready` · `none` · `incomplete` · `unreadable`. It **resolves and then
  PROVES** — for `incomplete` the name derives and the project row carries the
  credential, so a connection is built and probed with one query before it is
  used, because a name that derives is not a database that answers. A reference
  that was missing is recorded on the way past, from a database known good.
- **AND THE TWO LAYERS DISAGREED SILENTLY, which is the half worth keeping.**
  `siteBackendBySlug` checks the `SITE_ROUTES` KV cache FIRST and the container
  has no such binding — so in the Worker an `incomplete` site resolved out of
  the cache and everything looked fine, while the container met the blank
  column. One rung, two answers, depending on where it ran.
- **NOTHING HERE PROVISIONS.** `none` is the only state in which a site
  genuinely has no database, and making one is the addon step's job. Asserted
  as a census over `ensureSiteBackend`/`createSiteDatabase`/`createSiteProject`.

**3. AN UNRESOLVED BACKEND BOUGHT A REWRITE OF EVERY PAGE.** `escalate(...)`
carries no `layer`, so `escalateAction` fell to `up` — **and a full-site rewrite
does not repair a missing database reference.**

- **CANNOT-TELL STOPS.** `unreadable` answers 503, `cost: 0`, `ours: true`, a
  NAMED reason, and no `escalate` field at all. Driven: **0 paid actions
  recorded by the browser's own handler.**
- **GENUINELY-NOTHING-THERE KEEPS ITS FALLBACK, BY NAME.** `none` escalates
  with **`layer: "addon"`**, so `escalateAction`'s addon branch fires and the
  ask reaches the one step whose first backend kind provisions a database. The
  legitimate fallback is kept and the wrong one is closed — measured through
  the real handler: `["post a PAID request to the addon route"]`.

**⚠ AND THE SAME DEFECT WAS ONE LINE DOWN, AND THEN ONE LAYER DOWN AGAIN.**
The guard written for (2) got past the fixed gate and straight into
`escalate("no-meta")` — same shape, same wrong remedy. Fixing THAT exposed the
root: **`loadSiteSchema` has a bare `catch {}` and answers `{tables: []}`
either way**, so a `_meta` read that threw and a database with no tables were
one value. Its own comment already knew — it refuses to CACHE the empty answer
precisely because a transient failure must not serve "no tables" — *the
distinction was understood and thrown away one line above it.*

- **`readSiteSchema` ANSWERS `{ok, spec, why}`** and `loadSiteSchema` is a
  WRAPPER over it, not a second copy of the query, so the cache, the TTL and
  the never-cache-an-empty rule cannot drift. Every existing caller is
  untouched.
- **THE SECOND WALL IS REAL AND DELIBERATE, AND A SWEEP IS WHAT SHOWED IT.**
  Cutting the resolution gate SURVIVED: an unresolved backend hands `null`
  down, the schema read throws, and the next gate refuses with the same status
  and the same cost. **Redundancy is fine; a refusal that cannot say WHICH link
  failed is not**, so the guard is on the named REASON — the one thing the two
  walls do not share. The PAIR mutated together dies.

### THE THREE CORRECTIONS ON TOP OF THOSE (2026-09-21, owner, after reviewing
`0d15ab4c` and running the fourteen cases independently)

**1. THE OWNERSHIP GATE'S REFUSAL STILL BOUGHT A REWRITE, AND IT WAS LEFT AS AN
OPEN FINDING IN THE ROUND ABOVE.** *"`assertOwner` is one gate shared by a
dozen routes"* is true and is **not a reason to leave the EDIT route starting a
paid request off a refusal.** The gate is untouched; `editGateRefusal`
(`site-owner.mjs`, called from ONE place, censused) re-shapes its answer at the
edit boundary alone — the decision, the STATUS and the gate's own `error`
survive verbatim and the two fields the screen reads are added.

- **`e.msg` IS THE WHOLE CONTRACT.** `editAnswer`'s branch order is
  `escalate` → `needs-review` → **`if (e.msg)`** → `fallback()`, so a body
  without `msg` cannot be displayed and falls to the ~25-credit rewrite. `ok`
  absent is already falsy; nothing else is needed.
- **⚠ THE REPORT NAMED THE 503 AND THE 404 HAD THE IDENTICAL DEFECT** —
  measured, not assumed: `{error: "no such site"}` recorded the same paid
  action. **Ownership enforcement is unchanged**: a non-owner still gets the
  404 a missing site gets, now as a sentence instead of a silent fall into a
  paid request.
- **`Response.json`, NEVER `eAnswer`** at that call site — `eAnswer` is a
  `const` three hundred lines below and would be a temporal-dead-zone throw.

**2. A MISSING `_meta` ROW IS NOT AN EMPTY DATABASE.** Reproduced: `bookings`
exists, the schema row does not, and the rung escalated to a PAID addon without
ever looking at the table inventory — an inference from the absence of ONE ROW
to the absence of every table, which is run 47's defect on a third path.
**`specForAddon` is the reader now** — the same one the addon path uses, over
`readSchemaState`, which **asks the catalog FIRST**. It is READ-ONLY: nothing
is written back to `_meta`.

- **THE FOUR STATES ARE MEASURED, NOT INFERRED**: `stored`/`empty` proceed
  (`empty` meaning the catalog CONFIRMED none), `tables-without-metadata`
  recovers through the real `policiesFor`/`grantsFor` or refuses, `unreadable`
  refuses. `escalate("no-meta", {layer:"addon"})` is now reachable ONLY from
  `empty`.
- **⚠ AND THE FIRST GUARD FOR THIS ASSERTED THE WRONG OUTCOME.** It was written
  expecting a bare fixture to REFUSE ("no grants, so nothing can be rebuilt")
  and the run answered that recovery **SUCCEEDS**: a table with no grants and
  no policies derives as the admin pair and the re-emit matches. The behaviour
  is right and the guess was wrong — *read what a thing DOES, not what it was
  meant to do* — so the case is split in two, recovery-succeeds and
  permission-surface-unreadable.
- **`readSiteSchema` KEEPS NO READER OF ITS `ok`** and says so in its own
  comment: it separates "the read threw" from "no row" and is silent on whether
  the DATABASE has tables, which is the question. It stays as
  `loadSiteSchema`'s implementation; **do not reach for its `ok`** — ask the
  catalog-aware reader, or the two become two answers to one question and the
  weaker one wins by being nearer.

**3. "YOU HAVEN'T BEEN CHARGED" WAS FALSE AND IS SCOPED.** `cost: 0` is true of
the EDIT; the routing call that chose the layer is a separate POST billed on its
own — **run 12 moved the balance by 2 on a message that published nothing**. A
zero edit cost does not establish a zero-cost request. Every refusal this round
adds says *"this edit cost you nothing"*, and **no refund is claimed, because
none happened**. A source census over `editGateRefusal` and the rung's own
window holds it, with comments blanked first (the note explaining it quotes the
forbidden phrase) and **both apostrophes** matched.

**⚠ AND `wholeRequestNote` IN `chat.js` CARRIED THE SAME UNSCOPED CLAIM** — it
appended *"you haven't been charged"* on the `withheld` branch, where the routing
call was billed too. Reported and left that round; **FIXED 2026-09-23** (owner:
*"distinguishing the edit from any separately charged routing call"*) — it states
the edit's cost and the routing call's as two amounts now (the classification
section above).

**THE EVIDENCE**: the file goes 8 → **15 cases**, **6 mutants killed with a
comment-only control surviving** and all three touched files restored
byte-identical (each mutant restores one of the three defects verbatim).
**⚠ AND A PRE-EXISTING GUARD WENT RED ON A COMMENT** — `site-owner.test.mjs`
matched `assertOwner\([^)]*\);\n([^\n]*)`, literally the next LINE, and the edit
call site gained a note explaining why its refusal is re-shaped. Re-anchored on
the next few NON-COMMENT lines, bounded by the next `assertOwner` call, with the
window asserted non-empty — and red-checked by making one call site test `.ok`.
*A guard pinned to a position reports a comment as the feature going away*, and
that is now **three** pre-existing guards in two rounds of this one change.

**THE EVIDENCE**: 14 new cases (8 backend, 6 router), **9 mutants killed with a
comment-only control surviving**, all three touched files restored
byte-identical. **Two pre-existing guards were re-anchored rather than
appeased** — `site-apply`'s pinned to the spelling
`if (!rdb) return escalate("no-backend")` and `site-delete`'s to an EXACT COUNT
of `eAnswer` call sites (`=== 2`, right the day it was typed). Both reported an
honest change as the feature going away; both now assert the property.

**AND A SESSION CANNOT PRESS THE BUTTON.** Every paid harness is
`workflow_dispatch` only; a dispatch needs GitHub's **`actions: write`**, and
the session's App does not have it — the MCP tool and a direct REST POST both
answer **403**, with a read control on the same token answering 200, so it is
the permission and not the credential. **The three ways round are all
forbidden**: asking for the service key (the owner ruled it out), adding a push
trigger to a money-spending workflow (inventing the accidental-spend door that
workflow exists to close), or running the harness locally (same key). **So a
live paid check is the OWNER'S press, always**, and what a session can do is
everything up to it: merge, deploy, verify both halves of which-code-is-
answering, record the baseline, and leave the dispatch armed with
`expect_deploy` and `expect_image` filled in. Plan the work that way rather than
discovering it at the end.

**THE FINISHED ANSWER WAKES ITS OWN COLLECTOR.** `/api/site/genresult` enqueues
the collector the moment it stores the answer, after the release and only for a
report whose binding was proved. Before that, ~253 seconds of every build were
spent idle against `RESUME_FIRST_SECONDS` — a constant whose own comment said
"nothing has ever come back inside four minutes", true when written and
falsified by the band split's 93,375 ms. **The belt stays at 240**, for a
container that dies after generating and before posting.

---

## Rules from recent fixes

Each of these is shipped and live. What is kept is the RULE and the NUMBERS.

### The agent builder

**THERE IS A THIRD VIEW: `agents`** (owner: *"under the A for the profile thing,
put agent builder"*), a view in THIS app rather than a page on the agent
Worker's own domain — which would have meant a second sign-in to reach a menu
item. **`agent-builder/` IS A SEPARATE PRODUCT WITH ITS OWN CLAUDE.md**, and the
full account of the engine, the step registry, the workflow executor, the
scheduler and the DST arithmetic is there. What belongs here is the site's half:

- **THE AGENTS ARE ON THE ACCOUNT**, in the `agent` schema — `agent.agents` and
  `agent.agent_messages`, **separate from `agent.runs` and `agent.run_entries`
  by construction**, with no foreign key between the halves: one is mutable prose
  somebody wrote and edits, the other an append-only fenced journal of work that
  ran. `agent-store.mjs` (root, dependency-free, on the Dockerfile's COPY line)
  owns all of it.
- **RLS IS THE BELT AND THE URL FILTER IS THE WALL, and only saying so keeps
  them apart.** Policies key on `agent.tenant_id()`, which protects the
  `authenticated` role and protects nothing on this path: `service_role` carries
  BYPASSRLS, so the only thing between one customer and another's written
  instructions is `tenant_id=eq.` in the query. **A suite that only ever signs in
  as one account cannot see that**, so most guards read the REQUEST THAT WENT
  OUT. Its consequence is the shape of `update`, `remove` and `ownsAgent`: the
  tenant is in the FILTER, so "somebody else's id" and "an id that does not
  exist" are one answer and one 404.
- **THE TENANT IS `authUser(request).id` AND NOTHING ELSE.** No route reads an
  account off the body or the query string, asserted as a census. **The block is
  gated ONCE, above all the routes**, which is stricter than N gates — a new
  route cannot be added ungated because there is nowhere to add it that is not
  already behind it, and it is why adding seven automation routes needed no
  change to `worker.js` at all.
- **A REPLY IS IMPOSSIBLE RATHER THAN ABSENT.** `check (role = 'user')` on the
  column, and no `role` is ever sent — a forged agent reply is *a row the
  database refuses* rather than a bug for this code to prevent. The answer is
  read from the RUN and never copied into a message row.
- **`security_invoker = true` IS THE WHOLE SAFETY ARGUMENT** on
  `agent.agent_overview` — without it the view runs as its OWNER and is a hole
  through the RLS on both base tables. PostgREST could embed a child relation
  with its own order and limit; it is not used because **nothing here can run
  PostgREST**, so that query could only be asserted from documentation, while a
  view is plain SQL a real PostgreSQL can drive.
- **`agent.import_agent` IS ONE TRANSACTION BECAUSE THE IMPORT CAN BE PRESSED
  TWICE**, and **ATOMIC IS NOT IDEMPOTENT**: the first version closed the
  half-imported agent and left the one beside it open, so the obvious second
  press made a second agent. The identity is the browser's own record id,
  **scoped by tenant and enforced by a partial unique index**; the message loop
  is skipped on the conflict path, because answering the right id while
  re-running it doubles the conversation. **The four-argument signature is
  DROPPED, not left as an overload** — Postgres would keep both.
- **NOTHING DELETES WHAT SOMEBODY TYPED INTO A BROWSER**, and **whose the legacy
  records are is decided by ONE marker**. `zephyr_owner_v1` is the only thing in
  a browser that says which account was last in it, so both doors read it and
  neither reads who is present: `enterApp` claims for `prevOwner` or SEALS, ABOVE
  the `setItem` that moves the marker; `doSignOut` claims BEFORE the wipe and
  takes the MARKER rather than `Auth.userId()` (**the two can disagree and that
  case is driven**). **The marker never moves ahead of the ownership record** —
  `agentsStore` READS THE VALUE BACK rather than trusting `setItem`.
  **`agentOwns(a, uid)` is the one predicate** — `!!uid && !!a && a.uid === uid`,
  no pass for an unstamped record — and **`AGENT_OWNER_UNKNOWN` (`'?unknown'`)
  is a VALUE, not an absence**, so a sealed record can never be laundered one
  sign-in later. **The cost, stated: a browser whose last sign-out ran the old
  code has records preserved and PERMANENTLY HIDDEN, from everyone.** That is
  the requirement met rather than a regression.
- **THE IMPORT ASKS THE SAME PREDICATE AT THE POINT IT WOULD SEND**, reading the
  STORE rather than the offer — the list asks "what may I show", this asks "may
  I send THIS", and they are different questions with different consequences.
  **Silent, deliberately**: naming the skips would tell the person that another
  account has records in this browser.
- **A FAILED READ IS NOT AN EMPTY ACCOUNT AND A FAILED SAVE KEEPS THE WORDS.**
  `null` for "not asked yet" against `[]` for "this account has none" is what
  makes loading, empty and failed three screens.
- **A DELAYED ANSWER MUST LAND IN THE CONVERSATION THAT ASKED.** `agentBind()`
  is taken before the request and `agentSame`/`agentSameEdit` asked after it,
  comparing **both the conversation and the ACCOUNT**; nothing that fails may
  write. Drafts are keyed by agent, and **the key is bound with the request** —
  computing it from `agentUid()` when the answer arrives means a session that
  expired mid-send deletes a key belonging to nobody. `undefined` (never falsy)
  means "whoever is here now", because a signed-out `''` is a real answer.
- **THE POLL DESTROYED WHAT WAS BEING TYPED.** `renderAgents` writes `innerHTML`
  every `AGENT_POLL_MS` (2,500), so a sentence typed while waiting was destroyed
  **EIGHT TIMES A MINUTE** with the caret and focus. It is a WRAPPER now
  (`agentComposerRead` → `renderAgentsNow` → `agentComposerRestore`), so no
  caller has to remember, and **the box's own `data-agent` attribute decides
  whose words they are** — restoring into a conversation somebody has since
  opened would move their caret, a worse bug than the one being fixed. The input
  hook deliberately DRAWS NOTHING.
- **A RETRY KEY MUST BE BOUND TO ITS PAYLOAD.** Held per conversation, a send
  that committed with its response lost, then EDITED and pressed again, carried
  the first message's key: the server absorbed it, answered the original body,
  the browser read `ok` and cleared the box. `agentSendKeys` stores
  `{key, body}`. *Retry safety was never about the conversation; it was always
  about the payload.* **The key is minted per PRESS, not per request**, and
  cleared **only on success**.
- **A GENERATION NUMBER ON THE DRAWING.** A read-first door is correct until
  something writes a value the DOM has never seen: a structural change to the
  automation form wrote the new list and the read-back immediately overwrote it
  with the stale DOM. `data-gen`, and **`|| '0'` on `getAttribute` read "no
  attribute" as generation zero** — the one value a fresh draft always holds.
- **`undefined !== null` IS TRUE**, so three optional lines gated on `!== null`
  drew the literal word `undefined`, the last of them in the red error slot.
  **No unit case could see it, because every fixture was the real producer's
  output** — which is the right way to build a fixture and exactly why the new
  guard's is deliberately not. `autoSaid` is the one test all three go through.
- **THE ENGINE IS RUNG AFTER THE COMMIT, AND THE RING IS A DOORBELL AND NEVER
  THE WORK.** A failed ring is logged and said (`notified: false`) and never
  raised — the work is durable either way, and answering an error would tell a
  customer their message failed when it is committed and will run. **An absorbed
  press is rung too**, and a duplicate ring is harmless BY CONSTRUCTION (that is
  `claim_run`'s property). **PRODUCER ONLY**: a consumer here would be a second
  executor of other people's runs.
- **THE CATALOG IS THE SERVER'S AND THE BROWSER ONLY DRAWS IT.** `AGENT_TOOLS`
  rides on `/api/agent/list`'s answer, is a COPY of the engine's `OFFERED` names
  **censused both ways**, and what lives here and not there is the WORDS: the
  engine's `description` is for a MODEL deciding whether to call a thing,
  `label`/`does` for a person deciding whether to allow it.
- **A SELECTION IS A POSITIVE INTERSECTION AND A REFUSED NAME IS NAMED.**
  `cleanTools` intersects, collapses duplicates and takes the CATALOG'S order, so
  two saves of one selection are byte-identical; `readTools` refuses an unknown
  name rather than storing less than was asked for. **The catalog is a
  PARAMETER**, because with one tool on the platform the order rule is
  undrivable and a sweep mutant taking the caller's order survived everything.
- **ABSENT AND EMPTY ARE TWO DIFFERENT THINGS ON A SAVE.** `/api/agent/update`
  is a PATCH: a tab opened before today saves a name and says nothing about the
  settings, and filling them from a default would un-pause an agent from a
  screen that never showed a pause control. **A status it cannot READ is a 400,
  never a default.** `"active"` assigned in JavaScript would be a second copy of
  the COLUMN's default in a second language — the copy that drifts is the one a
  migration cannot move.
- **`agentRow` FAILS CLOSED ON BOTH SETTINGS**: an unreadable status is `paused`
  (being wrong costs a press of Resume; the other way is an agent taking work its
  owner stopped) and an unreadable selection is empty.
- **WHICHEVER SIDE DECIDES A THING MUST NOT GO OUT BEFORE THE SIDE THAT ACTS ON
  IT.** The order for these three-part changes is **migration → engine → site**,
  and the middle one is the one nearly got wrong: this product's note said the
  two Workers were "order-free", which was true about PERMISSIONS and silent
  about HONESTY — the live engine handed every authored run `tools: []`, so
  shipping the settings form first would have put a tick on screen that saves,
  draws, and can never be honoured. **Engine first is a MEASURED no-op.**
- **ADDING A VIEW MEANS SATISFYING A PROPERTY, NOT A COUNT.** `KNOWN_VIEWS` was
  pinned to an exact list, bought by a survivor that added a door to a deleted
  screen — which froze the count and failed identically for every later
  legitimate view. It forbids the deleted media views BY NAME, forbids
  `home`/`landing` (aliases `showView` resolves, never views), and requires
  **every** known view to have a `render…` call.

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
  | `grok-4.6` (default) | **500K** | **no stated limit** | $2 · $6 |
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
| `data` | rows, and a list's ORDER | ~0.3 |
| `rules` | schema features enforced in Postgres or read from `_meta` | ~0.3 |
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

### EVERY RUNG RUNS IN THE SITE'S CONTAINER, AND THE CONTAINER HAS NO CLOCK

Owner, 2026-09-14: *"addon, edit and build gotta run on the container, just like
the build path"* → ***"Containers shouldn't have a time limit."***

**THE CLOCK WAS THE TRAP IN THE MONEY PATH.** `EDIT_JOB_MS` is 840,000 —
fourteen minutes, and every word of its reasoning is about a Cloudflare ISOLATE
(`CONSUMER_CEILING_MS` stops a consumer at fifteen). Inside the container there
is no such ceiling. Builds moved across 2026-09-06 and got their own pair; the
edit branch was wired the same day and **passed no budget at all**, so it fell
back to the Worker's number. *A rule true because of a layer below it expires
when that layer moves* — first in the path that spends money. It cost run 44 an
addon at 12m22s with the database made, the page written and nothing published.

| bound | now | what it governs |
|---|---|---|
| `CONTAINER_*_BUDGET_MS` | **`Infinity`** | the WORK — `expired()`, `spendable()`, every gate |
| `CONTAINER_EDIT_JOB_MS` / `BUILD_JOB_MS` | **50 min** | the token's life; SIGTERM to a wedged child |
| `MAX_BUSY_HOLD_MS` | **52.5 min, derived** | how long a BUSY container is held — the bill |
| per call: `STEP_TIMEOUT` 30 min, `CONTAINER_CALL_MS`/`BUILDER_CALL_MS` 600 s, `QUICK_STREAM_MS` 480 s, `QUICK_CALL_MS` 240 s | unchanged | each model call and each subprocess |

- **THE LEASE IS A LIVENESS CHECK AND NOT A DURATION CAP** — this is what makes
  the removal safe rather than merely permitted. `edit_sweep_lost` selects on
  `lease_expires_at < now() - p_grace` and **never on elapsed**, `LEASE_TTL_S`
  90, `HEARTBEAT_S` 30. A job that keeps beating is NEVER swept however long it
  runs; a job that dies is reclaimed in ~90 seconds. What the lease cannot see
  is a process that is alive, heartbeating and looping — our own bug — and that
  is the one thing the deadline is for, beside the credential.
- **FIFTY MINUTES IS A LIVE RPC, NOT A PREFERENCE.** `HANDOFF_TTL_S` is DERIVED
  as `MAX_BUSY_HOLD_MS / 1000` and `edit_handoff` raises `bad ttl` past
  **3600 s**, so `deadline + JOB_KILL_GRACE_MS + JOB_TERM_GRACE_MS + 60s ≤
  3600s` caps the deadline at **57.5 minutes**. Fifty leaves 450 seconds.
  **Lifting it is a migration**, not a constant this repo can move.
- **`MAX_BUSY_HOLD_MS` WAS A SHIPPED DEFECT.** It was 30 minutes while
  `BUILD_JOB_MS` was ALSO 30, and the build service stops a child at its
  deadline + `JOB_KILL_GRACE_MS` (60 s) and kills it `JOB_TERM_GRACE_MS` (30 s)
  later — so a job that ran to its deadline had its CONTAINER stopped a minute
  BEFORE the SIGTERM that lets it end as a job. **The graceful path was
  unreachable at exactly the moment it exists for.** DERIVED now: **deadline
  50.0 → SIGTERM 51.0 → SIGKILL 51.5, hold ends 52.5.**
- **`Infinity` IS A STATED ANSWER AND BOTH READERS REFUSED IT.**
  `Number.isFinite(Infinity)` is false, so `inlineBudgetMs` handed the
  container's own "no clock" want `EDIT_JOB_MS` and `makeBudget` handed it
  `BUILD_BUDGET_MS` — **each falling back to a Worker-sized number for the one
  input where the default is the MOST wrong answer available**. Both take it
  now, and **the clamp still governs**: `Math.min(Infinity, left)` is `left`, so
  a WORKER delivery is still bounded by what its isolate has left. **Every
  per-call ceiling survives it** (`capMs` is `min(cap, room)`), which was the
  whole safety argument and was asserted nowhere until it was driven.
- **`builder/job-duration.mjs` IS THE ONE SETTING.** `JOB_MAX_MS`, and
  everything else is `jobDurationPlan()`. **`readJobMaxMs(env)` reads
  `JOB_MAX_MINUTES` and MAY ONLY SHORTEN** — every other number is fixed at
  IMPORT, so a LONGER setting moves the deadline past all of them. **It shipped
  with no call site** in the first cut of the change whose whole point was
  configurability; the guard DRIVES its one consumer, because a source read
  cannot tell a wired reader from an unwired one.
- **THE QUEUE WAS SILENTLY SHORT.** A job behind another waited `60s × 45 =
  2,700s` in front of a job that may run **3,000** — failed before the job it
  waited for could finish. `SITE_BUSY_DEFER_S` is derived now (**67 s**).
- **`JOB_RUNNER_EVERYONE` IS `on` IN THE DEPLOY.** The canary is KEPT rather
  than made decorative: it is the state the platform falls back to if the broad
  flag is turned off.
- **WHAT IT COSTS**: every site's jobs share the account's container ceiling. A
  fire that finds no room WAITS (`JOB_FIRE_MS`, 90 s) and the consumer then runs
  the job on what is left of its own invocation. Worst case is the old behaviour
  ninety seconds later, never an eviction.

### THE JOB'S MODEL CALLS TAKE THE CONTAINER'S OWN TRANSPORT

**Run 45 died at 270,025 ms with `fetch failed`** — eleven milliseconds from
`build-call.mjs`'s own recorded `socket hang up`. `longPost` and
`{stream: true}` were handed in from exactly **three call sites, all in
`build-server.mjs`**; the addon and edit page call took the module's default —
**Node's undici global `fetch`, unstreamed**. **THE FLIP IS WHAT MADE IT
REACHABLE**: that path was safe for months because it only ever ran in workerd,
and turning `JOB_RUNNER_EVERYONE` on moved it behind the container's egress.
*A rule true because of a layer below it expires when that layer moves*, where
the layer moved because we moved it.

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
  LIFETIME cap, which streaming cannot.** Until this, a failed page call
  recorded one word.
- **`node:https` HAS NO TIMEOUT OF ANY KIND UNLESS ONE IS ASKED FOR** — its own
  comment. Every real model call carries `AbortSignal.timeout(callMs)`.

**LIVE EVIDENCE, two stored traces on `repairbench-1`, same site, same ask, 2½
hours apart**: run 44's page call **459,465 ms → OK, 3 files** (in the Worker);
run 45's **270,025 ms → `fetch failed`** (in the container). Neither trace
carries the `where` field — it shipped after both — so the attribution rests on
the durations plus the flip landing between the deploys.

### WHERE THE JOB RAN IS RECORDED, AND THE WORKER FALLBACK IS NOT SILENT

**`runner: true` IS ELIGIBILITY, NOT EXECUTION** (the owner's own correction).
`JOB_WHERE` and `JOB_DEADLINE_AT` are set by `makeContainerEnv` and
`jobRunDetail(env)` rides the `run` mark. **The Worker's own answer is
`"worker"` by DEFAULT**, so a record that cannot tell reads as the Worker and
never flatters itself.

| answer | means |
|---|---|
| `fired` — **including HTTP 409** | the container has it. 409 is `/job/run`'s duplicate guard; reading it as anything else makes one job two sets of calls and two charges |
| `inline` — `off`, `no-binding`, `not-this-one` | the runner was never asked for |
| `retry` — `room:`, `fetch:`, any 5xx | transient. `FIRE_RETRY_MAX` 3, `FIRE_RETRY_MS` 2000 |
| `stop` — **everything else, unknown reasons included** | finalize 503 `no-container`, nothing charged |

**`stop` IS SAFE BECAUSE NOTHING IS SPENT BEFORE THE FIRE** — there is no
reserve to reverse, which is the whole reason a refusal can be a refusal rather
than a fallback. And the customer is told; a row that stopped without a finalize
is a poll that spins for ever.

### TWO PROBES: A JOB THAT RUNS LONG, AND A WIRE WITH NO MODEL IN IT

`builder/job-probe.mjs`, fired through **`POST|GET /api/site/job-probe`**, both
free — no model call, no credit, no row, no ledger — and both through the REAL
`/job/run` door in a real job child, because `_busy`, the launch's deadline and
the terminator armed off it are three of the things being measured.

- **`hold`** occupies a child for as long as it is asked (default **20
  minutes**), **pulsing once a minute**. The pulse is the reading, not the final
  line: an absent final line is also what a crash produces. **It touches no row
  and no lease on purpose.**
- **`wire`** holds two long connections in turn — **never raced**, because a
  concurrent pair leaves the reading open to "the second kept the first's path
  warm" — through the **same `node:https` sender a model call uses**. `quiet`
  sends nothing until it answers; `trickle` sends a byte every tick. The probe
  NAMES the reading: `idle-kill` · `no-wall` (**the failure was NOT REPRODUCED
  — that is not the same as settling the historical cause**) · `lifetime-cap` ·
  `quiet-survived-trickle-did-not` · **`hung`**.
- **WHAT THE WIRE PROBE CANNOT ATTRIBUTE.** A dead connection looks identical
  from the container whether the container's egress killed it or the gateway
  Worker gave up. **The trickle arm is what makes that not matter** — same path,
  same endpoint, same duration, only the bytes differ. Read `idle-kill` as
  *"silence is what dies"*, never as *"Cloudflare's egress did it"*.
- **A mode nobody recognises answers `null`, never a default.**
- **`runJob` BRANCHES BEFORE `importWorker`** — a probe measures this process and
  its socket, and several hundred modules in front of it measure something else.
- **THE VERDICT LINE CAN FALL OFF THE WIRE.** `build-server.mjs` keeps a job's
  last five stdout lines and **slices each at 300 characters**. MEASURED: the
  whole-answer line for a realistic failure is **exactly 300** with `reading`
  last — no margin. Two defences, each measured sufficient alone and the
  redundancy declared.
- **A RUNNING RECORD HAS NO TAIL** (`tail` is written only in the `close`
  handler), so `state: "running"` past the elapsed time IS the live duration
  answer. **A 404 IS NOT A COMPLETION** — it answers both for an id the service
  never saw and for one whose record went with a recycled container.

**`PROBE_MAX_MS` SITS UNDER `JOB_MAX_MS`** (minus five minutes, DERIVED), and
the caller's number is **CLAMPED rather than refused**, because an instrument
that errors on a too-big argument is one somebody re-runs smaller and mis-reads.
The route is owner-gated, **ALWAYS pre-scoped**, on the hold probe's own lane,
carries **no secrets at all**, and takes its clock from `readJobMaxMs`. The door
is `.github/workflows/job-probe.yml` + `scripts/job-probe.mjs`, dispatch-only,
every secret printed as a LENGTH.

**DURATION: PROVEN (probe run 2).** A job child ran **1,200,182 ms — 20 minutes
— inside the container, `code: 0`, no `signal`, 20 of 20 pulses**, with 30.2
minutes of deadline left. It passed 12m22s (run 44's death), 14 min (the old
`EDIT_JOB_MS`) and 15 min (the consumer ceiling). **TRANSPORT: UNREAD.** Three
instrument defects are why, and each is a rule:

1. **`newJobId` WAS CALLED BARE and the route threw.** It takes its randomness
   as a REQUIRED parameter. **The route was asserted by READING it**, and the
   guard SAID a drive was impossible "because the route is owner-gated", which
   is false: `authUser` asks `/auth/v1/user`, so a stubbed global fetch is the
   whole cost. **A stated impossibility nobody re-tested is how a route ships
   throwing.**
2. **THE RUNNER THREW AWAY THE STATUS.** `.then(r => r.json())` drops the
   status, the content-type and the body — *a failure that cannot name itself*,
   in the instrument built to name failures. The status separates the three
   shapes: 401 is a token that did not take, 404 a Worker without the route, a
   5xx with HTML the Worker throwing.
3. **`wireCall` PASSED NO ABORTSIGNAL.** **THREE OUTCOMES, NOT TWO**: answered,
   died before the bound, and **`hung`** — never answered, never reset. They
   need three different fixes, so collapsing the last two is the one way this
   instrument can mislead rather than go quiet. `hung` is asked FIRST.
4. **A PROBE COULD ONLY BE READ BACK BY THE RUN THAT FIRED IT.** `PROBE_JOB_ID`
   skips the fire and reuses the same polling and verdicts. **The fire is
   skipped rather than made idempotent**: a second launch of the same shape
   would take a second lane to answer a question already in flight.

### ADD ALWAYS GOES TO THE ADDON STEP (owner, 2026-09-02)

*"Add will always go in addon"*, and the one carve-out is the owner's too:
*"tsx does exist tho, is literally everything on the page, it could be changing
a component, is changing tsx."* **The line is at the THING, not the page**: does
what the customer names exist on the site now? It does — EDIT changes it. It
does not — ADDON makes it. Until 2026-09-02 the router said the opposite in as
many words, because the line sat at the page. Four hops, each guarded:

- the router's wording (`site-ask.mjs`) — the English word IS the question;
- **a wall at the edit route's PICKER** (`ADD_ONLY_FIELDS = ["qr","three"]`,
  `hasLookField`): a picked field the stored look lacks escalates `addon`. At
  the picker and NOT in the look step — the first draft sat after the look
  step's `no-look` and `three` is a dispatched lane that never runs that step.
  `tsx` is deliberately off the list. **A config read that fails lets the lane
  run**: cannot-tell must never read as nothing-there;
- **the browser's `escalateAction` answers `addon`** for that layer. Before
  this, every escalate that was not a sideways hop fell to `up` — the
  ~25-credit full revise — so the middle rung was unreachable from an edit;
- **the addon step keeps what it designs** (`mergeLook` + `readCss`, the page
  call told the bindings, the look STORED just before the publish and reverted
  on a failed one). **And it no longer refuses a site without a database** — the
  `look`/`logo` dead gate again, one step over: a first build provisions none,
  so `no-backend` had sent every "add a QR code" on most of the platform to a
  rebuild.

### WHAT THE EDIT'S PAGE RUNG PRESERVES (2026-09-20 → 09-21)

Eleven defects, each reproduced through `POST /api/site/<slug>/edit` before it
was fixed, each now asserted on the designer's input, the compiler payload, the
stored inventory and the browser's own sentence.
`test/edit-page-{context,photos,protect}.test.mjs`, `test/edit-parts.test.mjs`
and `test/edit-browser-reply.test.mjs`.

**⚠ FIVE OF THE ELEVEN ARE DEFECTS IN THE FIX FOR THE FIRST PHOTOGRAPH ONE, and
that is the shape worth keeping**: each shipped with a green suite, a sweep and
an entry in this file, and each was reported back by the owner off the shipped
code. The protection's *mechanism* was right every time; what was wrong was the
SCOPE it applied to, the COVERAGE it claimed, the number of LISTS it looked at,
**the RUNG it was attached to, and the REACH of the sentence it refused with**.

**⚠ AND THE FOURTH ROUND IS THE ONE WITH A GENERAL LESSON: THE PROTECTION WAS
BUILT ON THE RUNG THAT ANSWERS SECOND (2026-09-21, owner: *"Successful tweaks
bypass protection"*).** `runTweak` is tried FIRST and unconditionally, and on
`tw.ok` it published and returned — three hundred lines above every guard. So
*"make the heading bigger and keep both photographs"* came back with the larger
heading and one emptied `src`, shipped it, and reported the loss afterwards:
the exact behaviour two rounds had already closed on the rewrite, still live on
the path most messages take. **A guard on the FALLBACK is a guard on the case
that does not usually happen.**
- **THE CONTRACT IS NOW ONE CONTRACT**, asked before `publishStep` on both
  rungs: restore what can be restored, refuse what cannot (409 `withheld`,
  cost 0, `photosBlocked`), and `withheldPhotosMsg` is ONE composer so the two
  refusals cannot drift into describing one outcome differently.
- **THE COMPONENTS GO ON BOTH SIDES THOUGH A TWEAK CANNOT TOUCH ONE** —
  `runTweak` takes one page's source and answers one page's source, so they are
  equal by construction; they are passed because `keepPhotos` is SITE-WIDE and
  a photograph the page drops that a component still shows must not be put
  back.
- **A TWEAK THAT IS A NO-OP ONCE THE PICTURE IS BACK FALLS THROUGH**, and that
  is NOT the rewrite rung's *"the only thing that change would have done"*
  refusal: there the expensive writer has had its go, here it has not, and the
  fall-through is what that branch exists for. `twSpent` carries the call's
  tokens into the rewrite's bill.
- **⚠ AND `alt` TEXT IS PROSE, WHICH DECIDES WHICH BYPASSES REACH THIS RUNG AT
  ALL — MEASURED, and it is not what the general contract predicts.** `proseOf`
  reads a picture's description as words on the page, so of the three bypasses
  the previous round named, **DELETE the element and RENAME its description are
  refused by `sameProse` as `reworded`** and never get past `readTweak`;
  **SUBSTITUTE another url is the one that arrives**, and it is what the
  withheld case drives. A case built on a deletion would be green about a path
  it never took, so the census is asserted rather than commented.
- **⚠ AND THE TEST FILE'S OWN HABIT WAS THE BLIND SPOT.** Every case in
  `edit-page-protect.test.mjs` stubbed `write_tweak` with `{cannot}`, because
  each was written about the rewrite — so all of them drove the fallback and
  not one drove the path a customer takes. *"Test this with `write_tweak`
  succeeding; forcing it to decline misses the defect"* is the owner's own
  wording and it names a property of the harness, not of the product.

**⚠ AND A RUNG'S REFUSAL DOES NOT SPEAK FOR THE WHOLE REQUEST (2026-09-21,
owner: *"Partial-success wording makes whole-site claims"*).** The picture rung
took the window photograph off as asked, the page rung withheld a second change
it could not make safely, and the screen read *"✅ Took the picture off "the
window". ⚠️ … so I left your site exactly as it was."* — a picture HAD just come
off. Both halves true of their own rung and the second **false of the request**.
- **THE CAUSE IS THAT A RUNG CANNOT KNOW.** It is one step of a message that
  may run several, its neighbours run after it, and `editOutcomes` prints its
  sentence VERBATIM beside whatever shipped — correctly, because the rung is
  the only side that knows why it stopped. What it does not know is what ran
  beside it.
- **SO THE SENTENCES END AT *"so I didn't make it"*** — true of the rung
  whether it stood alone or beside six others, which is what makes one string
  safe in both places — **and *"Nothing on your site changed, and this edit
  cost you nothing."* is added by `wholeRequestNote` on the browser's
  complete-refusal branch**, the one reader that can see `ok: false` for the
  whole reply. That is not a guess: the merge sets `ok` from `ranOk.length > 0`,
  so a reply reaching that branch had no rung succeed and published nothing.
  (Re-worded 2026-09-23: *"you haven't been charged"* was false beside a billed
  routing call; the routing charge is its own sentence now.)
- **TWO CONDITIONS, EACH WITH ITS OWN JOB**: `e.ok` is the property (it may
  never fire on a reply that shipped, asked in the composer rather than trusted
  from the one call site), and the SCOPE is **`unchanged === true`** — the rung
  (or, on a merge, every step) saying it wrote nothing — **or the older
  `error === "withheld"`**. Widened 2026-09-23 from `withheld` alone, when the
  classification gave every explained refusal the flag; a refusal that cannot
  say it wrote nothing still gets no whole-request claim.
- **⚠ AND FOUR GUARDS WERE PINNED TO THE OLD SPELLING**, two in each of the
  protect and photos files: `includes("left your site exactly as it was")`.
  They assert a PROPERTY — the customer is told nothing changed — and are
  re-anchored to `"Nothing on your site changed"`, which is where that claim
  now lives. *This file's single most repeated own-goal, met four times in one
  correction.*
- **THE CENSUS WIDENED TO THE ENTRY POINT'S OWN CALLS, AND DELIBERATELY NO
  FURTHER.** `wholeRequestNote` is reached from `editAnswer`'s REFUSAL branch,
  which the transitive walk from `editReply` — the SUCCESS composer — cannot
  see. **Rooting that walk at `editAnswer` was tried and MEASURED: it demands
  36 further functions** (`siteEdit`, `watchEditJob`, `siteAddon`, `sitesSave`,
  the whole build-panel closure) **which the harness does not cut ON PURPOSE** —
  they are injected as recorders and stubs, which is what makes `actions` a
  record of what the screen would do rather than the screen doing it. A census
  demanding those be cut would assert the opposite of the design. The property
  is the entry point's own direct calls: three today, all cut.

- **`readSiteParts`'s THREE STATES REACH THIS RUNG.** `loadSiteParts` collapses
  "no components" and "the read threw" into one `null`, and
  `mergeParts(null, [one])` answers `[one]` — so a transient R2 failure
  published ONE component and deleted the rest. The addon's shape, on the
  caller that never moved: `partsSent` answers `unreadable`, every returned
  component is refused, the merge hands over `null`, and the spine re-sends the
  store's own copy.
- **ONE SNAPSHOT PER MESSAGE, ADVANCED BY `publishStep`.** `components` and
  `tsx` both dispatch to `page`, so one sentence could run the rung TWICE (since
  2026-09-23 only when another rung's step sits between them — neighbouring
  page lanes are one step, `mergePageSteps` — and then only when the first did
  not succeed, `pageStepDone`; the snapshot's live reader beside a page step is
  now a later PICTURE step, which reads `editParts()` too) — and each run re-read the STORE. `publishStep`'s rule is "a later list wins", so the
  first rung's work was overwritten by the second rung's merge of the original:
  step one ran, was charged for, reported success, and shipped nothing.
  `editParts()` is the message-wide read and `publishStep` advances it exactly
  as it advances `eSrc` — **the pages never had this bug because `eSrc` is this
  variable one field over**.
- **⚠ THE `text` RUNG'S VERSION WAS WORSE AND IT REFUSES NOW.** Its empty list
  is REAL rather than absent: `editableFiles(eSrc, null)` presents the pages
  alone, `splitEditable` answers `parts: []`, and both the spine's preference
  and its save take that at face value. **Measured through the route: reply
  `{ok: true, applied: 1}`, payload `parts: []`, and `source/<slug>/parts.json`
  REWRITTEN TO `[]`** — every component deleted by a one-word wording change.
  503 `parts-unreadable`, **above the model call**, cost 0, nothing written.
- **THE PAGE WRITER GETS WHAT `briefWithLayout` HAS ALWAYS TAKEN** — `parts`,
  `partsUnreadable`, `theme`, `css`, `plan`, all five omitted, so the one call
  on this path that rewrites a whole page was that function's blindest caller.
  The plan is scoped to the TARGET page and takes `modules`, never `kit`.
  **⚠ THE SCOPING IS THE `[wantRoute]` INDEX, NOT THE `[target]` ARGUMENT** —
  `pageComponents` answers a map keyed by route, so both give the same entry;
  the argument saves a walk. A sweep mutant said so.
- **THE PROMPT STOPS TELLING A PHOTOGRAPHED SITE IT HAS NONE.** A bare
  `images: 0` renders as *"PHOTOGRAPHS: none on this site … that is the
  intended look here"* — false on every site with any, and the last two clauses
  are an instruction to STRIP them. Driven on a site showing two, on a request
  that asked to keep them: both came back with an empty `src`. `images:
  {shown: shownPhotos(photoInventory(…)), place: false}` — **the budget did not
  move; no `buy` key IS the zero.**
- **⚠ THE PHOTOGRAPH GOES BACK — REPORTING IS NOT PRESERVATION (2026-09-20,
  owner).** The first cut of this rung detected the loss, PUBLISHED it and
  named it: *"keep both photographs and change the opening hours"* shipped
  `src=""` and a note about it. `keepPhotos` restores the attribute **from the
  file's own previous source**, so it can only ever put back a picture the site
  was already serving from that exact place — there is no url it could invent
  and `strayPhotos`' concern cannot arise. **The identity is the `alt`**, which
  is `PICTURE_TOOL`'s own rule rather than a second idea of what makes a
  picture the same picture. **Four refusals to guess**: a slot holding a
  DIFFERENT picture is an ANSWER and is left alone; `src={row.photo}` is a
  binding; an `alt` two slots share is skipped on either side; and **a
  photograph the answer still shows SOMEWHERE is never put back** — that last
  one is not local, because `keptImages` is deliberately site-wide and a
  per-file restoration would meet a legitimate MOVE and publish the picture
  twice.
- **⚠ AND AUTHORISED REMOVAL STILL WORKS — BUT THE PERMISSION IS A STATE AND
  NEVER A FLAG (corrected 2026-09-20, owner: *"`ePhotoAsk` disables protection
  globally"*).** The first cut asked whether the MESSAGE had a picture step at
  all, which is a judgement about the sentence made by a rung that cannot see
  WHICH picture was meant — so *"remove only the window photograph; keep the
  bench photograph"* turned the protection off for every picture on the site
  and published both missing. **The scope is `eSrc`**, the site as THIS rung
  finds it: the picture rung publishes through `publishStep`, which advances
  `eSrc`, so a photograph it really cleared is already gone from the before
  side and there is nothing to put back, while one it did not touch is still
  standing and is protected. *"Permission belongs to the operations that
  matched, and the state is where those are recorded."*
  **⚠ AND THE RUNNING ORDER IS WHAT MAKES THAT TESTABLE.** `LANE_FIELDS` puts
  `shape` (12) and `components` (11) BEFORE `images` (13) and `tsx` (17)
  AFTER, so only an `images`+`tsx` message runs the picture rung FIRST — and a
  red check proved that mutating the before side to `eSrcAt0` survived every
  case until one drove that ordering. **The two readings are equal by
  construction whenever the page rung goes first**, which is most messages.
- **⚠ RESTORATION IS NOT COVERAGE, AND A LOSS IT CANNOT REACH REFUSES THE RUNG
  (corrected 2026-09-20, owner: *"Do not publish the loss merely because
  matching failed"*).** Everything `keepPhotos` does needs a slot to write into
  and a description to match on, so a writer that **DELETES** the element,
  **RENAMES** its description or **SUBSTITUTES** another url walks straight
  past it — and the previous cut then published the loss and named it
  afterwards, which is the behaviour the round before that was meant to end. A
  match that never happened is indistinguishable, from outside, from a file
  that had nothing to protect. So `keepPhotos` answers `lost` as well as
  `restored`, over the same accepted publication, and a loss left standing is
  **409 `withheld`, cost 0, `photosBlocked: n`** — nothing compiles, neither
  store is written, and the customer is told how to authorise it. **NOT an
  `escalate`**, which would buy the ~25-credit rewrite of every page to protect
  one photograph.
  **THE LINE THAT STILL SEPARATES THIS RUNG FROM THE ADDON'S IS THE WORD
  *UNRELATED*, not the word *refuse*.** There a lost photograph is 422
  `lost-photos` at cost 0 on a step whose contract is *"an addition is always
  a new thing"*; here a removal the picture rung really made ships and is
  REPORTED. Three refusals with three sentences and they are not
  interchangeable: a reachable loss that is the change's whole content
  (*"the only thing that change would have done…"*), a loss we could not put
  back (`photosBlocked`), and a component we would not rewrite unseen
  (`keptParts`).
  **`photosRemoved`, NOT `lostPhotos`**: the addon's field is a LIST of urls on
  a refusal that published nothing (`Array.isArray` in its own harness) and
  this is a count on a change that shipped — `Number([…])` is NaN, so one name
  over two shapes makes the browser's clause silently never fire.
- **⚠ AND THE GUARD TAKES BOTH LISTS IN ONE CALL (corrected 2026-09-20, owner:
  *"Moving an image from the page into a component publishes it twice"*).** It
  ran once per list, so each call's site-wide rule was only half site-wide: the
  pages call saw an empty `src`, could not see where the url had gone, and put
  the old copy back beside the component that now carried it. **One call,
  `{pages, parts}` on both sides, ONE `shows` set over the union** — which is
  what makes *"a photograph the answer still shows SOMEWHERE is never put
  back"* true rather than aspirational. It is asked of the **ACCEPTED
  publication**: the target page folded into the site's own list, and the
  components the wall admitted, so a refused component cannot be protected and
  a page nobody publishes cannot count. And **both its outputs go on to
  publish** — `pGuard.parts`, not the unguarded merge, or a `src` written back
  into a component is silently dropped.
- **AND `photosKept` IS THE PROTECTION'S RECEIPT, INTERSECTED WITH WHAT SHIPS.**
  A customer cannot otherwise tell the builder nearly took them off. It is
  **not a sum of the rungs' own counts**: the page rung puts a picture back,
  an AUTHORISED picture rung further down the same sentence takes that same
  picture off, and the sum then prints *"the 2 photographs are still there"*
  beside *"one photograph is no longer on the site"* — two sentences about one
  publication, disagreeing. `ePhotosHeld` is a set of URLS across the message,
  intersected below the loop with what the publication really shows; urls
  because only an identity can be intersected, and they never reach the wire.
- **THE EMPTY FRAME IS COUNTED BY A FRAME READER.** `photos` was
  `countImageSlots`, which counts `@@IMG:` TOKENS on a rung whose directive
  forbids them — zero on every obedient answer, so `photoNote` never fired.
  `newEmptySlots(before, after)`, token counter behind it. **`countImageSlots`
  now has NO caller in `worker.js` at all** (asserted, over blanked comments,
  because the note explaining the move names it): both paths ask the frame
  reader, which sees a swept token AND a frame the model simply wrote.
  **Both readers take `imageSources(pages, parts)`**: a photograph
  can live in a component since the band split, and reading the pages alone
  answers a smaller inventory, which is an invitation to strip what is not in
  it. A sweep mutant survived until a case put a picture in a component AND
  lost it — **the untouched-component case cannot tell the two apart**, because
  `keptImages` reports only what the BEFORE had and the AFTER lacks.
- **⚠ AND BOTH COMPARISONS ARE ASKED ONCE, BELOW THE LOOP (2026-09-20, owner:
  *"avoid reporting intermediate changes that the final publication
  reverses"*).** Each rung used to answer about its OWN output — and
  `components` and `tsx` both dispatch here, so rung 2's "before" was rung 1's
  output: a frame rung 1 left and rung 2 removed was reported on a publication
  that does not have it, and the merge's first-body-wins rule carried exactly
  that number to the customer. **The two ends that are really comparable are
  `eSrcAt0`/`ePartsAt0` and `pendingPublish`**, and both exist only below the
  loop. `ePartsAt0` falls back to **`[]` and never to the store**: an
  unreadable store publishes no components, so both sides empty is the reading
  that says *nothing moved*.
- **⚠ AND THE WARNINGS DID NOT SURVIVE THE MERGE AT ALL.** `merged.layer` is
  `"look"` whenever more than one rung SUCCEEDED, and `editReply`'s look branch
  read none of `keptParts`, `unseenParts`, `photosRemoved` or `photos` — **the
  facts were on the wire the whole way and none of them on the screen**.
  `editOutcomes` is ONE writer (every field is absent on an ordinary edit, so
  the sentence is byte-identical where they do not apply), and the merge takes
  a **UNION**: the catch-all copies a key from the FIRST body that has one and
  skips every later rung, so a second page rung's withheld component could
  never arrive.
- **⚠ AND THE SAME COMPLAINT CAME BACK A THIRD TIME THROUGH THE FAILURE PATH
  (2026-09-20).** `editOutcomes` was called from TWO of `editReply`'s ELEVEN
  layer branches — the two the previous round drove — and a message that runs
  several rungs lands on whichever layer SUCCEEDED. So a rung that FAILED
  beside one that shipped was written to **`partial`, which had no reader
  anywhere in `chat.js`**. **MEASURED through the real route**: "take the
  window photo off and rewrite the cards", where the picture rung succeeds and
  the page rung withholds a photograph it could not put back, answered
  `layer: "picture"` and the screen read *"✅ Took the picture off “the
  window”."* and stopped. **The SITE was right** — the bench survived, the
  window went, the withheld half published nothing — **which is what makes it
  a reporting defect and exactly the kind that ships unnoticed.**
  **THE FIX IS ONE HOP, NOT ELEVEN**: `editReply` is a wrapper that appends
  `editOutcomes` + `photoNote` + `problemNote` ONCE above the switch, and
  `editReplyBody` holds the eleven branches. Every clause is absent on a reply
  that does not carry its field, so every other branch's sentence is
  byte-identical — *the widening costs nothing where there is nothing to say,
  which is what makes one hop safer than eleven*. The recovered reply is
  exempt: it has no layer, no pages and no fields. **The partial clause opens
  with a warning inside a reply whose first character is a green tick**, and
  prints the rung's **own sentence verbatim** (never re-composed from `error`,
  which would be a second copy of every refusal's wording); over two it counts
  the remainder, and a failed rung with **no** sentence is still counted —
  *nothing at all* is the outcome the clause exists to close. **⚠ That last
  clause was true only when EVERY failed rung was silent**, until 2026-09-23:
  beside one with a sentence the silent one vanished, byte-identically (*the
  mixed partial*, in the classification section). Counted in both now.
  **AND THE HARNESS CAUGHT THE WIRING, AS DESIGNED**: `editReplyBody` was not
  on `EDIT_BROWSER_FNS`, so the reader threw `editReplyBody is not defined`
  and reported **NO** screen rather than a wrong one.
- **⚠ A CHANGE A PROTECTION WITHHELD IS NOT A NO-CHANGE (2026-09-20, owner).**
  An oversized stored component, an unchanged page back and a replacement for
  the component the wall withheld: nothing differed, so the rung answered
  `escalate("no-change")` — **which `escalatedEdit` turns into the ~25-credit
  rewrite of every page**, to avoid rewriting ONE component unseen, with no
  sentence reaching the screen. **409 `withheld`, cost 0, naming the
  component**; nothing compiles and neither store is written. The
  discriminator is a positive test on this route's own three lists
  (`pKeptParts`, `pUnseenParts`, `pRestored`) — all three are US declining to
  write something. ~~A GENUINE no-change still escalates and the rewrite still
  starts~~ — **REVERSED 2026-09-23**: a genuine no-change is `page/no-change`, a
  sentence at no cost (a rewrite of every page is no evidence it would do
  better). The control that keeps the ladder honest moved to
  `test/edit-failure.test.mjs`, which drives the climbs that remain.
- **⚠ THE HARNESS WAS READING THE WRONG COMPOSER.** `browserReply` runs
  `addonAnswer`, the ADD route's selection; an edit reply goes through
  `editAnswer` → `applyEditResult` → `editReply`. The add composer does not
  throw on an edit body — it answers a PLAUSIBLE `"✅ Done."` — so an assertion
  pinned to it passes whatever the edit screen does. **MEASURED: a reply naming
  a page, a lost photograph and two picture spaces came back as three words.**
  `editBrowserReply` runs the real selection, refusal branches included, and
  its function list is censused from `editReply`'s own body — a clause whose
  composer is not cut is a `ReferenceError` that reports NO screen rather than
  a wrong one.

### THE EDIT PATH IS ITS OWN PATH (2026-08-29)

Owner: *"it should be 2 separated path tho"*, and on what the edit step IS:
*"customer says edit this, and booom you go edit it"* — pure action, no design
round. **`look` used to call `designSiteSchema`** — the BUILD's function, tool
and system text — to change one colour on a live site: **84,817 characters** of
instructions for inventing a business from nothing. **And the two framings
fought**: the build's `css` description opens "ONLY WHEN ASKED… OMIT this field
entirely unless", which an edit reads as *don't touch the stylesheet*. Now
**`builder/site-lanes.mjs`, which imports nothing from `worker.js`**:

```
customer ──► pick_lanes ──► edit_site ──► publish
             2,811 chars    one per lane   ONCE
             21 names       1 property
```

**Twenty-one lanes and EVERY ONE ACTS.** `pick_lanes` runs ABOVE the layer
dispatch, so it is the front door for all of them. **DERIVE THIS LIST, DO NOT
TRUST IT** — it has gone stale twice: `node -e` over `site-lanes.mjs` and print
`LANE_FIELDS`, `OWN_LANES`, `DISPATCHED_LANES`, `VERB_LANES`, `ESCALATE_LANES`,
`UNBUILT_LANES`. **FOR A FIELD'S LAYER, CALL `laneLayer(field)` — NEVER READ
`LANE_LAYER`**, which is keyed by GROUP, so indexing it by a field name answers
`undefined` for three lanes that dispatch perfectly well.

- **10 act here** — `css theme brand description wordmark favicon qr lang langs
  behavior`. **Every one but `css` must be on `EDIT_FIELDS`** — the lane reads
  `priorLook[field]` and writes through `mergeLook`, so a lane missing from that
  list bills and changes nothing, silently, at both ends.
- **9 dispatch** — `images`→`picture`, `action`→`nav`, `backend`→`rules`,
  `slug`→`rename`, `shape`/`components`/`purpose`/`three`/`tsx`→`page`.
  **Neighbouring page lanes on one page are ONE page step** (`mergePageSteps`,
  2026-09-23): the page rung reads the sentence, not the lane names, so two of
  them were one operation run twice. **Across another rung they stay two steps
  in their order, and the later one runs only when the earlier did not
  succeed** (`pageStepDone`).
- **1 verb lane** — `pages`: `remove` and `move` are the `page` rung, `add` is
  the addon route. **No default** — an unreadable verb refuses, and this is the
  ONE place where the bias inverts, because a wrong guess takes a page off a
  site. **The verb rides on the `pages` step itself** (`{remove, rename}`, and
  the router's own step carries the router's): `runLayer` reads the STEP's, so
  a layout lane picked beside it never inherits a removal or a move
  (2026-09-23).
- **1 escalates** — `kind`→`build`. A rebuild is what it IS.
- **0 unbuilt.** The five groups are a **total, disjoint partition**. **A
  dispatched lane must never target `look`** — that is the door it came through.
- **ALL SIXTEEN REMOVABLE LANES CAN BE TAKEN OFF, not nine** (**re-derived
  2026-09-20 by DRIVING `removalRefusal` over all 21 `LANE_FIELDS`: 16
  removable, 5 refused, the partition holding** — the file had said FIFTEEN in
  two places and both were stale; `NOT_REMOVABLE` is the only gate, so the
  count is `21 − 5` and never a list somebody typed). The removal verb
  lived inside `eLayer === "look"`, so six dispatching lanes never reached it:
  nothing failed and the STORED field kept saying the site had the thing.
  `DOOR_LAYERS` is derived from the two meanings collapsed into one constant.
  **`page` is NOT widened and must never be** — `remove` there deletes the page.
  `NOT_REMOVABLE` is `backend · lang · slug · kind · purpose`.

**A RULE PER LANE, IN FOUR NAMED PARTS** (owner: *"i want a rule per everysingle
one of them"*): `is` · `yours` · `wide` · `keep`, and only `wide` is genuinely
per-field — it names how THIS field gets over-answered. `css` gets a token where
a rule was asked for; `brand` gets a name improved instead of copied; `lang`
gets the site TRANSLATED. Structural, not prose: `laneRule` THROWS if a part is
missing.

**THE CONTRACT IS TWO OPPOSITE HALVES AND THEY MUST ARRIVE TOGETHER** (owner:
*"it's free css — the model can edit anything on the page… but when they ask one
thing, you only edit one thing"*): **unlimited in WHAT** (the sheet is the whole
look and nothing on the page is out of reach) and **strict in HOW MUCH** (as
many edits as there were asks and never more; each only as wide as it was asked;
nothing unasked-for moves). Either half alone misleads. **Stated as the
mechanism, never as a ban-list** — a list covers tonight's control and the next
request is always a different one.

**THE WALL, NOT THE RULE.** A `css` lane cannot re-theme or rename a site
because its tool has one property and there is nowhere to put the answer. A rule
in prose is one a model eventually reads past.

**ONE PUBLISH PER MESSAGE.** The eight branches call `publishStep`; the spine
runs once below the loop. `eSrc` carries forward between rungs; a config
snapshot taken before any rung runs is restored if that publish fails.
**Measured: 5,606 of tool for a colour change against 89,195, still 1 credit** —
`pageCredits` is variadic and rounds once with a floor of 1.

**A LANE'S OUTPUT CEILING IS WHAT ITS FIELD CAN STORE.** `laneMaxTokens(field)`
derives from `FIELD_STORE_CAP` — **the refusals themselves and never a second
list** — at three characters per token with a quarter of slack. **It can only
ever REDUCE**: wordmark **16,000 → 3,334**, favicon **→ 1,667**, everything else
untouched. A pre-existing gap is named: `MAX_CSS` is 60,000 characters and the
shared ceiling expresses about 48,000; an overrun is a NAMED failure.

**AND THE CEILING WAS NEVER THE BINDING CONSTRAINT — run 40 disproved it.** The
next `wordmark` ask came back a THIRD timeout at exactly 240,000 ms, cost 0.
**The tell is which failure came back**: a bound ceiling stops with a
`max_tokens` stop, and this stopped with a TIMEOUT. *Lowering a budget truncates
a long answer; it cannot make a slow one finish sooner.* **THE BINDING
CONSTRAINT IS THE WIRE**: `QUICK_CALL_MS` is 240 s only because the egress hangs
up an IDLE connection at ~270 s, and **streaming is what stops it being idle**.
Two hops: `callBuilderModel`'s Worker wrapper FORWARDS `opts` (it had dropped a
fourth argument the module has taken for months — the wiring trap, found by a
live timeout because every guard drove the MODULE), and `quickSend` passes
`{stream: true}` and clamps a queued call to `QUICK_STREAM_MS` (480,000). **The
synchronous path keeps 240 s deliberately** — off the queue the bound is the
CUSTOMER'S connection (~273 s). **480,000 is a chosen bound, not a measured
one.** **PROVEN by run 41**: `lane:wordmark` ran **292,336 ms and FINISHED**,
where runs 11, 12 and 40 were each cut at exactly 240,000 for nothing.

**EVERY SMALL CALL FOLLOWS THE PICKER, NOT A HARDCODED MODEL.** `BUILD_MODELS`
has a third slot, **`quick`**, equal to the picker's own model. **WHAT IT COST
TO LEARN**: run 93 bought a `css` edit and got a **503 in 5.3 seconds having
spent nothing**, because every cheap rung was pinned to `claude-haiku-4-5` and
Anthropic refused on billing — *the platform's cheap ladder was entirely behind
one provider while its expensive half was not*. Two guards, and **the second is
the one that matters**: a source scan for a pinned id (comments blanked), and
`picked-model.test.mjs`, which DRIVES each runner with a sentinel and reads the
request that would have gone out. Only the second caught `routeMessage` taking a
`model` and never passing it on.

**Every prompt in there is a PLACEHOLDER** and marked so (owner: *"i will tell
you the prompt later"*).

### RENAMING A SITE IS AN ALIAS, NOT A MOVE (2026-08-29)

`slug`→`rename`, and **nothing moves**. A slug keys five Supabase tables, seven
R2 prefixes and one dispatch script; R2 has no rename, so a "real" move is a
loop of PUTs with no transaction — a copy that dies halfway leaves the site half
at each address with nothing to roll back to. **And the move needs everything
the alias needs anyway**: either way the platform must remember the old name
belongs to this site, because customers print it (we generate **QR codes**
pointing at it) and the old name has to stay CLAIMED.

**THE STORAGE SLUG AND THE PUBLIC ADDRESS CAN NOW DIFFER, and nothing may assume
they are equal.** `slug` stays the storage key — every R2 prefix, every table,
the dispatch script, and `SITE_SLUG` baked into the page (which addresses the
site's own API). The one place the distinction is load-bearing is the canonical
link and `og:url`, both baked into the R2 sidecar at publish time. Two hops
carry it, and until 2026-09-02 neither existed: (1) `publicUrlFor(env, slug)` is
the ONE reader of the public address — both publish sites had handed
`siteUrlFor` the STORAGE slug, and `publicNameFor` had no consumer at all;
(2) the rename lane patches that one sidecar key the moment the alias is current
— **the R2 write IS the deployment** — and no longer republishes.

- `site_aliases (alias PK, slug, uid, current)`, with **one current name per
  site enforced by a partial unique index** rather than by us. Proved by
  INSERTING a second current row and watching Postgres refuse it, not by reading
  `pg_indexes`.
- **A rename settles everywhere within five minutes**: the alias caches are
  300 s per isolate and only the lane's own isolate forgets at once.
- **The cache rule INVERTS from `hostRoutes`.** There a miss is rare and must not
  be cached; here the miss is every site that has never been renamed, so not
  caching it would put a Supabase round trip in front of every page load. The
  miss is cached as `NO_ALIAS`; a lookup that FAILED caches nothing.
- **AN OLD NAME CAN BE FORGOTTEN** (owner: *"isnt when you do the change the old
  one is gone?" … "yea i want that"*). "Forget the old address X" deletes that
  name's row: the address stops answering (a 404 that is never cached) and the
  name is free. **A deliberate second step, never a side effect of a rename**,
  because it cannot be undone once somebody else takes the name. **One request
  both checks and deletes** — `DELETE
  site_aliases?alias=eq.X&slug=eq.<site>&current=is.false` with
  `return=representation`. **The storage name is the one label a deleted row
  cannot make disappear**, so `resolveAlias` has a fourth case: no row AND the
  site this label names answers to another name → gone.
- **The bias inverts here too**: a message with no name in it is REFUSED, never
  guessed, because the old address 301s forever after. `cleanAlias` refuses
  rather than repairs — the first draft turned "déjà vu café" into `dj-vu-caf`.
- **The code still degrades cleanly if the table goes away**: `aliasRowFor`
  answers null on any read failure and `resolveAlias` reads a null row as "no
  alias", so the platform falls back to its old behaviour rather than erroring.

### THE ADD STEP IS ITS OWN PATH TOO (2026-09-02)

`builder/site-add.mjs`, which imports nothing from `worker.js`:

```
customer ──► pick_adds ──► add_to_site ──► [make the db] ──► the page call ──► ONE PUBLISH
             1,936 chars   one per kind    first touch     (addon mode)
             9 kinds       0 required      then apply
```

**Nine kinds, and ORDER IS RUN ORDER** — a table before the function that reads
it, both before the job that runs it, all before the page that shows them.
`ADD_KINDS`, `OWN_ADDS`, `DISPATCHED_ADDS`, `PLACING_ADDS`, `BACKEND_ADDS`,
`addLayerIn` — **derive, don't trust**. Measured today: `DISPATCHED_ADDS` is
**EMPTY** and `PLACING_ADDS` is `["photo"]`.

| kind | makes | cap | the tool's own properties |
|---|---|---|---|
| `table` | a Postgres table; the first backend kind PROVISIONS the database | 6 | `table · seed · shows · because` |
| `function` | a Postgres function, public or internal | 6 | `name · args · returns · body · language · internal` |
| `api` | a stored outside connection | 4 | `name · url · method · headers · body · params · returns · credential · cacheSeconds` |
| `job` | a scheduled or one-time run of an internal function | 4 | `name · fn · everyMinutes · at · on` |
| `page` | a route, in `sitemap.xml`, linked from the nav | 6 | `path · name · purpose · sections · components · tsx · link` |
| `component` | a band on a page — a kit part by name, or a `tsx` part | 12 | `page · where · does · components · tsx` |
| `qr` | a code drawn by us, baked as `/qr-<name>.svg` | 6/site | `name · points · label · page · where` |
| `three` | a WebGL element | 1/site | `scene · page` |
| `photo` | a photograph bought from fal and placed in the same request | 6 | `page · describe · name` |

`MAX_ADDS` is 9; **SEVEN** answer LISTS (`LIST_ADDS` = `table · function · api ·
job · page · component · photo` — re-derived 2026-09-20; the record said "six"
and had gone stale). **No low limits while testing**
(owner) — every list rule says "as many as they asked for, and not one more".

- **A SECTION IS A COMPONENT** (owner: *"section is just adding a new component,
  so its a tsx step"*). The kind NAMES the component and where on which page. An
  answer naming neither is refused `no-component`.
- **One tool per kind, one property, nothing required** — the wall, not the
  rule. A four-part rule per kind (`is` · `yours` · `wide` · `keep`),
  `composeRule` refusing a missing part.
- **THE UNIVERSAL RULE** (owner: *"anytime something new is added it needs to
  keep the design system"*). `ADD_DESIGN_RULE`, ONE string sent to BOTH models
  that have to hold it, and the guard asserts both hops carry the same sentence.
- **AN ADDITION IS ALWAYS A NEW THING.** An ask for a section the site already
  has ADDS a second one, after the first, and the first is left exactly as it
  is. **THE WALL, not the rule**: every page the addition CHANGED must still say
  every word it said. `keptProse` is the SUBSET of `sameProse` counted as a
  MULTISET, so a quote carried twice and returned once is lost. A page that lost
  words is refused 422 `rewrote`, **cost 0**.
- **AND A SECOND ONE COPIES THE FIRST'S DESIGN** — same component, same wrapper,
  same layout; only the words are new. A rule to name the first one's component
  is empty without the FACT, so `pageComponents(sources)` reads each stored
  page's imports and `siteNote` prints "/ is built from: SiteChrome, …".
- **Refusals are sentences, never climbs** (`addRefusal`, `alreadyReply`).
  `ADD_ONLY_FIELDS` and `ADD_EVIDENCE` are the same two lists, so the two doors
  never bounce a customer between them. **A photo beside another kind is set
  aside and SAID.**
- **THE SITE'S OWN ADDRESS AND ITS PAGE LABELS ARE IN THE NOTE.** A QR "that
  opens the booking page" has no destination unless the designer is told the
  address (`publicUrlFor`) and what each page is CALLED (`pageLabels`, read from
  each page's `<h1>`) — three live declines cost 0 credits and bought exactly
  those two facts. `cleanAdd` resolves a bare route against that address,
  refusing `no-such-page` and `no-address` rather than guessing an origin.
- **EVERY DESIGNER'S RAW REPLY IS KEPT** at `source/<slug>/addon-answer.json`,
  written the moment the add loop ends and BEFORE a decline can return.
- **THE FOLD IS THE HOP THE OLD ROUTE NEVER HAD**: the page call gets a
  directive for the addition (file, route, LAYOUT, numbered bands, kit parts,
  where it links from) plus the union of kit parts. **`tsx` is APPENDED by
  name** — the old `mergeLook` REPLACED it, so a new part on a site that had one
  forgot the first on its next revise.
- **On the wire**: 1,936 picker + 1,299 (`three`) / 1,570 (`qr`) / 20,045
  (`table`) / ~35,000 (`page`, `section`) against 97,142.

**THE BACKEND IS THE ADDON'S** (owner: *"the build step doesnt have backend so
its gonna be on the addon step … if customer touches it then neon db is
created"*). **The first of any of the four tiers designed for a site with no
database MAKES the database**, through `ensureSiteBackend` — claimed atomically,
idempotent on a retry, gated under a job, before the schema is applied. A failed
provision is a named 502 that is `ours`. Three hops that were not obvious:

1. **each kind is its own call, so the job designer must be TOLD the function
   the function designer just declared** — designed functions are appended to
   `aSite.functions` (internal ones to `aSite.jobFns`) as they are cleaned, and
   `cleanAdd("job")` admits a job only against `jobFns`.
2. **a job on a STORED internal function is re-attached after `normalizeSchema`**,
   which keeps a job only when its function is declared in the same spec — right
   for a build, a silent drop here.
3. **the function designer is shown each table WITH its columns** — a `sql` body
   is parsed at CREATE, so a guessed column is a function that does not exist.

**A job, or an internal function alone, changes no page** (`pageless`): billed
through the ONE charge closure, answered in the page path's shape with nothing
added, no page call, no compile. **Measured live: 2 credits** (run 52), against
3 (run 50), 12 (run 49) and 13 (run 47).

**JOBS**: `JOB_ITEM` carries an optional `at` ("HH:MM", the site's local time)
for a daily-or-slower job — `everyMinutes` alone made "every day at nine" into
"every 1440 minutes from whenever it was added". **The zone is NOT the
model's**: the browser sends its IANA zone with the POST, read through
`validTimeZone` (asked of Intl, never a list). **Run now**: `POST
/api/site/<slug>/jobs {name, run: true}`, owner-scoped, the SAME `jobDeps` — the
press is the decision. A function may answer `{"did": "cleared 12 expired
holds"}` — **its own words, never a number read as "rows"**.

**THE PLATFORM-SIDE SERVICES** (each needs a credential AND a network call, so
none is a model step): **CSV import** (`site-csv.mjs`, RFC 4180 with quoted line
breaks, BOM, Excel's `;`, a cell read AS ITS COLUMN; a hundred rows an INSERT, a
batch Postgres refuses **retried a row at a time so the bad line names itself**,
an outage stopping it where it is — **not a transaction, deliberately**;
**never a member-written table**); **one submission, once** (`site-idem.mjs`: an
`Idempotency-Key` renewed only after a SUCCESS, ONE store at module scope plus
KV across isolates, **eventually consistent — two presses on different isolates
can both reach Postgres, named rather than papered over**); **member reset and
verification** (a LINK for reset, a CODE for verification — Neon's docs, read
rather than guessed); **inbound webhook signatures** (`authorize`, fail-closed
404, no replay guard).

**THE MESSAGE CONTRACT IS ONE STRING SENT TO BOTH STEPS.** `MESSAGE_CONTRACT` —
`{channel, to, subject, body}`, `"email"` or `"sms"`, **absent or unknown is
EMAILED** (email costs the owner nothing per send), an email needs all three of
`to`/`subject`/`body`, a text needs `to` and `body` and takes **NO `subject`**,
and each channel has its own key so a message whose channel has no key is HELD
rather than lost. **ONE string, not two copies**, asserted into both tools by
identity, and **the default is asserted against `shapeMessages` itself, never
against the sentence**. SMS was **UNDOCUMENTED TO THE DESIGNER** rather than
impossible — every hop worked for weeks while the word `channel` occurred ZERO
times in the `function` and `job` tools.

**A JOB CAN RUN ONCE AND THEN NEVER AGAIN (2026-09-19).** `spec.on`
(`"YYYY-MM-DD"`, the site's local time) is the whole representation and its
presence is the marker — one place to ask, no second flag that can disagree.

- **`on` REQUIRES `at`**, refused whole without it (`no-time`): a one-time
  reminder has no second occurrence to be right at, so "midnight, presumably" is
  a guess made once and then made for ever.
- **⚠ AN UNREADABLE `on` REFUSES THE JOB rather than falling back to the
  interval**, and this is the ONE place the engine departs from its tolerant
  habit. Dropping `on` leaves a perfectly valid RECURRING job, so the tolerant
  reading is not the feature degrading, it is the feature INVERTED — one message
  becomes one a month for ever.
- **`everyMinutes` IS FORCED TO THE MONTHLY CEILING** (`MAX_EVERY_MINUTES`,
  twinned with `MAX_JOB_MINUTES` and censused equal), so if `spec.on` is ever
  lost such a job degrades to *at most monthly*. **The forcing sits ABOVE the
  `at` gate** and the order is load-bearing.
- **THE CLAIM CONDITION SURVIVES "RUN NOW".** The owner pressing the button
  decides a job is due NOW; it cannot decide a one-time job is due TWICE. A
  one-time job's claim filter is always `&last_run=is.null`.
- **`last_run` IS THE CONSUMPTION RECORD, AND IT IS THE ONLY ONE AVAILABLE.**
  `persistSiteJobs` rewrites `spec` on every publish, so a `done` flag written
  there would be destroyed by the next unrelated change.
- **AN ATTEMPT CONSUMES THE OCCURRENCE**, because `runJob` stamps before it
  sends — deliberate: a retry after a provider timeout is how one reminder
  becomes two, and nobody can tell a timeout from a slow success.
- **`MISSED_GRACE_MS` IS 24 HOURS** and past it the occurrence is gone rather
  than late. `onceState` answers `scheduled · attempted · missed · unreadable`
  — **`attempted` deliberately, not `done`**: what `last_run` records is that
  the one run was used up, and whether anything arrived is the result line.

**THE SELECTOR AND THE CLAIM ARE ONE RULE.** `dueJobs` moved to the occurrence
rule when the manual-run drift was fixed and the stamp's filter stayed the
elapsed one — so a job the calendar selected was refused by the same code path
meant to run it (0 rows matched, `fnCalls` empty). `claimFilter` is a
compare-and-swap: **`last_run` IS the etag**, so the claim asks *"is this the
row I selected"* and never re-derives dueness. Two ticks that both select one
job send the same condition and exactly one PATCH matches. **`jobDeps`'s `force`
option is GONE, not defaulted.**

**A MANUAL RUN MUST NOT MOVE THE NIGHTLY OCCURRENCE.** The elapsed test measured
24 hours from whenever the job last ran, so one press slid the schedule to the
hour of the press — for ever. **For a daily-or-faster clock-time job the
occurrence gate is the whole rule**: `anchor >= due` refuses a job that has run
since the latest occurrence, whatever ran it, and at `mins <= 1440` there is
exactly one occurrence a day. **Slower than daily KEEPS the elapsed test** — a
weekly 09:00 has to skip six occurrences — and measuring it to the OCCURRENCE
instead of to `now` was tried and is WORSE. **Stated in the code**: a manual run
still perturbs a job slower than daily; fixing that needs the last SCHEDULED
occurrence stored apart from `last_run`, which is a migration.

**AND THE OCCURRENCE RULE EXPOSED A DAYLIGHT-SAVING BUG UNDER IT.** `lastDueAt`
read the offset at `now`, so the instant a zone moved, "today's 00:30" was
computed under the new offset and landed an hour past the one already served —
and stood for the rest of that local day. The doc comment conceded the
approximation and named the rule that covered it — *the interval rule that runs
beside this* — which is the rule the fix above took off. **The fix reads the
offset at the TARGET MINUTE**: the two offsets in force a day either side are
the only two that can apply, each candidate VERIFIED by formatting it back,
two local days asked (complete rather than a sample, since an occurrence carries
the local date it belongs to).

| the local time | the occurrence | why |
|---|---|---|
| **repeats** (autumn) | the **FIRST** reading | one local day stays one run — `anchor >= due` then refuses the second |
| **never happens** (spring) | the **LATER** candidate | the job is NOT skipped; a reminder that silently does not go out once a year is the failure nobody notices |

**AND THE ARITHMETIC IS THE ZONE'S, NOT AN HOUR'S** — proven on
`Australia/Lord_Howe`, which shifts by **thirty minutes**: a nonexistent 02:15
resolves to **02:45 local**. A fix that hardcoded an hour passes every London
case and fails both of those.

### WHAT THE ADDON REPORTS, AND WHAT IT REFUSES TO CLAIM

**The reporting system is the addon path's largest body of law**, built across
2026-09-13 → 09-20 from roughly thirty reproduced defects. Every rule below was
driven through `POST /api/site/<slug>/addon` against stubbed seams before it was
believed; the narrative of each round is in git.

**THE METADATA RIDES BESIDE THE DESIGN, NEVER INSIDE IT.**
`builder/site-requirements.mjs` owns `REQUIREMENT_ITEM` — `need` · `status`
(`covered` | `elsewhere` | `unsupported`) · `by` | `step` | `why` · `item` ·
`kind` · `answers` — as a SIBLING of the kind on the add tool. Inside
`TABLE_ITEM` it would reach `design_schema` (which binds that item by identity),
enlarge the build's 97,142-character tool, and become a promise the schema
ENGINE must keep. **All nine kinds offer `requirements`**, measured by
evaluating `addTool(k)`.

**SEVEN STATES, AND EACH PAIR EXISTS BECAUSE THE TWO NEED DIFFERENT SENTENCES:**

| state | when | what the customer hears |
|---|---|---|
| `delivered` | a `checked` behaviour ties the claim to the work | nothing |
| `configured` | a real SETTING read back off what was applied matches | "I can't confirm…" |
| `unverified` | it is there, or nothing here can see whether it is | "I can't confirm…" |
| `unknown` | nothing established either way | "I can't see from here whether…" |
| `missing` | this layer looked and the work is not there | "Still to do: …" |
| `blocked` | the step this need depends on ran and FAILED | "waiting on another part…" |
| `failed` | we said we could not, or the claiming step failed | "Still to do: …" |

- **`checked` IS EMPTY AND THAT IS THE CORRECT ANSWER.** Nothing on this path
  exercises a behaviour, so `configured` is as far as a claim about a real
  setting can get. The three wrong fillings are named in `appliedFacts`' own
  comment: configuration (collapses the distinction), a keyword match
  (`claimEvidence` already asks that, so the claim would be its own evidence),
  and one passing live run. The guard drives all seven applied kinds and asserts
  every `checked` is `[]`. **So the platform cannot confirm its own feature
  works** — runs 49 and 51 were confirmed from OUTSIDE, by a browser and by
  re-encoding the published QR file. That is a stated limit of the design.
- **A REFERENCE IS `{kind, name}`, BECAUSE A NAME COLLIDES.** `bookings` is the
  commonest name on this platform to be a table AND the thing a job is named
  after. `referenceOf` is the single producer and `broken` is keyed the way it
  answers. **Where the kind comes from is the only per-status part**: an
  `elsewhere` reference is a request TO a named step, so the STEP is the kind; a
  `covered` reference has no such field (`from` is which CALL answered, never
  where the thing lives), so the kind is DECLARED. `ITEM_KINDS` is DERIVED
  (`COVERAGE_STEPS` less `edit`) and censused both ways against the tool's enum.
  **An unknown kind is DROPPED, never repaired to a plausible one.**
- **AMBIGUOUS OUTRANKS EVERY WEAKER READING.** A reference with no kind reads
  `unknown` with `unresolved: "no-kind"`, never rescued by evidence about a
  thing the designer may not have meant. Asked AFTER the two failure branches.
- **`evidenceItems(made, impl)` IS THE ONE SCOPE, DERIVED FROM `impl` RATHER
  THAN RE-RESOLVED.** An `item` reference sees that `{kind, name}` and nothing
  else (a miss is EMPTY); a `kind` reference sees the responsible step's own
  output; no kind sees nothing. **An item reference is never narrowed by
  `from`.** The stricter reading — no prose match at all — was DRIVEN and lost
  five real findings, three of them the owner's own demonstrations.
- **EXISTENCE IS NOT DELIVERY.** Each applied item carries `holds` (words from a
  closed vocabulary true of it), `fails` (words from that same vocabulary that
  are false) and `checked`, and **`fails` is asked FIRST**. The vocabulary is
  the ENGINE'S OWN (`ACCESS_PRESETS` ∪ `READ_LEVELS` ∪ `WRITE_LEVELS`), never a
  second list. **`evidenceName` is word-bounded, never `includes`** —
  `bookings` must not match inside `bookings_old` — and a name under three
  characters is never evidence.
- **A CONTRADICTION IS ITS OWN KIND, NOT A `null`.** `unknown`'s sentence —
  *"nothing I can check says either way"* — is FALSE of a contradiction, where
  something can be checked and it says the opposite. It answers `contradicted`,
  reads `unverified`, and records `contradictedBy`.
- **WHY THIS CANNOT CRY WOLF**: every reading moves a requirement towards
  `unverified` and never towards `failed` — there is no corpus of real `by`
  claims to measure a false-alarm rate against. A false "I can't confirm" costs
  a look; a false "done" costs them the guarantee.
- **"NOT ADDED BY THIS CHANGE" IS NOT "ABSENT FROM THE SITE".** `existingFacts`
  is the second presence source (the stored spec's four tiers, the site's own
  routes, the look's `qr` and `three`), and the record carries **`foundIn`**
  (`applied` | `existing`), because *this change made it* and *the site already
  had it* is the distinction and a record collapsing them cannot be audited.
- **ABSENCE NEEDS EVERY READER THAT COULD SPEAK TO HAVE SPOKEN, and that is NOT
  a blanket demand for two readers** — the first cut demanded both everywhere
  and lost a real finding. `COVERAGE_STEPS` splits three ways, total and
  disjoint: `SITE_KINDS` (`table · function · api · job · page · qr · three ·
  **photo**` — EIGHT, re-derived 2026-09-20; the record listed seven and had
  gone stale when photo joined the coverage steps)
  claim absence only when the inventory was really READ; `OPAQUE_KINDS`
  (`component`) **never**, because an addition folded into an existing page
  leaves no item in any list; and `edit` names no artifact at all.
  **`OPAQUE_KINDS` is load-bearing and a sweep proved it** — for `component`
  every other wall is open and it is the whole of what stops a change reporting
  a working section as still to do.
- **`aReportable` IS PER KIND.** A code is settled by the look merge long before
  any backend apply, and on a change with no database `aApplied` is false for
  ever — so a code this change really made would have read as unseeable on every
  frontend-only addon there is. `ready` names the kinds whose results arrive on
  their own clock.
- **A COUNT OF A STEP'S OUTPUT IS NOT AN ASSOCIATION WITH A REQUIREMENT.** A
  rule that let a step's output answer an un-named hand-off when the counts
  matched was **unsound at every N, not at the margin** — its argument was about
  CARDINALITY and silent about CORRESPONDENCE. Reproduced: a `page` step hands
  *"A QR code opens the gallery page"* to the `qr` step, which makes one Wi-Fi
  code, and the two cases came back byte-identical. Gone.
- **A FAILURE IS SCOPED TO A THING, NOT A KIND.** `failedItems` is
  `[{kind, name}]`; a requirement that NAMES its dependency is judged on that
  dependency. **Both halves are asserted**, because a fix that simply stopped
  blocking would lose the real dependency failure: the kind-wide rule survives
  with `!depThere` as its scope. **`depBroke` is asked before `depThere`**, so a
  thing KNOWN to have failed is blocked before anything excuses it.
- **THE HAND-OFF AND ITS ANSWER ARE ONE OUTCOME.** `cleanRequirements` stamps
  `<step>#<position>` on every entry it keeps; `requirementBrief` prints each
  handed need as `[function#0] …`; `reconcileHandoffs` joins on that id and
  nothing else. **Four conditions**: the answering entry must NAME the hand-off
  (never "this step ran"), be `covered`, have its own implementation FOUND, and
  the result is **CAPPED at `configured`**. **Both entries survive for
  diagnosis**; it is the CUSTOMER NOTE that collapses them.
- **AN ECHOED ID SAYS WHICH REQUEST IS BEING ANSWERED; IT SAYS NOTHING ABOUT
  WHETHER THE ANSWER IS TRUE.** Three walls: a known problem (`blocked`,
  `failed`, `missing`) is never overwritten; the answer must come from the step
  the request was addressed to; and if the request named its own thing, the
  answer must be that thing by `{kind, name}`. **Refusing to reconcile is only
  half the fix** — the answering entry was still `configured` and still reached
  the prose, so one need came back as two opposite sentences with the reassuring
  one being the worse. Keyed by the echoed ID, never by the need text.
- **AN UNRESOLVED ANSWER MAY NOT REGAIN CERTAINTY THROUGH PROSE.** With no item
  the answer's own implementation is `unknown`, so it is capped there —
  **`unknown` and not `!== "found"`**, because an answer naming an item this
  layer LOOKED FOR AND DID NOT FIND reads `absent` → `missing` → *"Still to
  do"*, the most actionable line in the reply. `spokenForBy` names the request
  that speaks for it, silent in the prose and whole in the record.
- **`auditTier(spec, tier, context)` IS ONE CORE** and `refusedFields`,
  `droppedFields`, `unbuiltItems` are thin wrappers defaulting to
  `tier: "table"`. The observer was dead above the table tier for three of four
  tiers — `droppedFields({functions: […]})` answered `[]` whatever it was
  handed — a clean sweep over nothing, indistinguishable from a designer that
  stayed inside the tool. **A/B over 64 specs: ZERO differences on `reached`,
  ONE on `refused`**, and the old reader was right about that one.
- **FOUR BUCKETS, AND EACH ASKS A DIFFERENT QUESTION**: `reached` (the key
  reached something), `refused` (the effect is not live), `changed` (a declared
  value the pipeline KEPT under another value — `method: "PUT"` stored as
  `"GET"`), and `unexpressed` (the ENGINE would have used it and this step lost
  it — `engineWouldUse` asks the engine directly rather than keeping a list).
  **`scanned` rides beside them**, because every one is a NEGATIVE assertion.
  **A REFUSAL ASKS WHETHER THE FIELD'S EFFECT WAS LIVE, not whether its key
  survived** — `cacheSeconds: 300` is kept as `ttl: 300`, and `maxRows: -5` is
  kept as `maxRows: 0`, where zero means NO CAP.
- **THE VALIDATION READS WHAT THE MODEL DECLARED, NOT WHAT THE CLEANER KEPT.**
  `cleanAdd` REBUILDS a `function`, `api` or `job` out of the keys it knows;
  only `table` spreads, which is the accident that made the table tier look as
  though this worked. `auditTier` takes `{ sent }` — a Map of name → the item
  that really goes into the engine — and reads the keys off the DECLARATION.
  **By NAME, never by position.** **And normalising what was SENT is not the
  same as normalising the DECLARATION** — measured over ten shapes, ONE divides
  them and it is a privacy guarantee: `internal: "yes"` is truthy and is not
  `true`, so the function is created PUBLIC; from what was SENT that reads
  `refused` and from the DECLARATION `changed`. **`refused` is the true one.**
- **VALIDATED WITH ITS DEPENDENCIES PRESENT.** `normalizeSchema({jobs:[job]}).jobs`
  is **`undefined`** — the job vanishes, its function absent. Correct
  normalisation and the wrong question: the item is normalised INSIDE the
  accumulated proposal.
- **THE BASELINE AND THE PROPOSAL ARE TWO SPECS.** `aBaseline` is the stored
  spec and is never written to; `aProposed` accumulates every cleaned item in
  `ADD_KINDS` order and `aSite = siteFacts(aProposed)` is rebuilt after each
  kind, marked **"(being added by this same change)"**. An EXTENSION merges
  through **the APPLY'S OWN `mergeAddonSchema`** rather than replacing by name —
  the commonest addition there is arrives as one column and no access, and
  replacing had been handing the next designer a three-column table as one
  column with `collect` stamped on it.
- **ONE NUMBER PER BODY WALL, AND THE CLEANER REFUSES RATHER THAN CUTS.**
  `MAX_FN_BODY` and `MAX_API_BODY` are both **4000** and both exported. The
  function wall had been **8,000 in the cleaner against the engine's 4,000** —
  two copies of one number, drifted by a factor of two, so a body in between
  passed whole, was reported as added, and reached Postgres as 4,000 characters
  of a statement. **The API half needs a real POST to see at all**: a GET's body
  normalises to `""` whatever it declared.
- **NOTHING REQUESTED IS DISCARDED IN SILENCE.** A bare-string column is **kept
  as `{name}`** (the engine gives a nameless-type column `text`); a column that
  really cannot be read is named on `droppedFields`; a kit name failing `NAME`
  lands on `unknownComponents` via a pre-pass over the RAW list; a `tsx` entry
  missing `does`/`props` is named and **not repaired**, because those ARE the
  component; and a list cap is `over-cap` BY NAME, its own token, **below** the
  loop that fills `skipped` — the same correction `cleanAdd` made for itself.
- **COMPLETION HAS THREE STATES, NOT TWO** (owner: *"Something existing does not
  prove the requirement works"*). **THE EVIDENCE IS ASYMMETRIC** — a call to a
  function that failed proves a problem; the absence of one proves nothing.
- **A FAILED JOB REGISTRATION IS SAID**, and a job whose new function the
  database refused is **blocked per job, by the name of the function IT runs**,
  taken off `aJobs` AND off `merged.jobs`. Its schedule is real and the work it
  does is not.
- **A PUBLIC FUNCTION AND A CONNECTION CANNOT BE PAGELESS** — both exist to be
  read BY A PAGE. **A CONNECTION OR A CALLABLE FUNCTION IS A BACKEND**
  (`siteHasBackend`, against `siteHasTables`): four places agreed and all four
  were wrong about a site with one connection and no tables, so the connection
  was designed, applied, served — and unreachable from every page.
- **TWO REFUSALS ARE 409s WITH THEIR OWN FLAGS**, never the missing-agent 404: a
  disabled automation and a paused agent are both "not now". **Nothing at all is
  written on either path.**
- **A JOB REUSING A STORED INTERNAL FUNCTION READ AS NEVER CREATED (run 52).**
  `applySiteSchema` persists a function with **NO BODY** and `normalizeSchema`
  drops a bodiless function, so the audit called the job `unbuilt` while the
  apply three hundred lines later re-attached and registered it. **Fixed at the
  source**: `withJobDeps` gives a declared internal function with nothing to
  normalise a stand-in body, and `storedJobFns` is the ONE answer to *which
  functions may a job name*, read by the apply too. **The repaired context is
  never applied** — re-sending a stored function would `CREATE OR REPLACE` the
  live one with the stand-in — so the stand-in is deliberately not runnable SQL.
  **Scoped to the job tier by its caller**: a table's `confirm.fn` is nulled by
  the APPLY too, so repairing it would make the audit disagree the other way.

### RUN 53 — WHAT THE CHECK CAN STAND IN FOR, AND WHAT SHIPPED (2026-09-20)

One paid addon run produced two independent false reports, and the honest
summary is that **the connection, the declared shape and the page were all
correct**: `/rates` is live and renders `1.1644 / 1.3344 / Rates from
2026-09-18` with zero console errors. Everything wrong was ours.

**AND THAT SENTENCE IS A CAPABILITY PROOF, NOT ONLY AN EXONERATION — READ IT AS
BOTH.** Those three values are the REAL keyless rates service's own answer,
fetched through the platform's own `/api/db/<slug>/api/<name>` and read at two
depths, so **run 53 is the live proof that a published page reads an outside
connection and renders its data** — the `api` row's "not established" for a
year. It went a day unrecorded because this section is a STORY about two
defects, and nobody edits a capability table while writing up a bug. **The row
is updated; when a run proves something, edit the SUMMARY first.**

**A SYNTHETIC RESPONSE MUST NOT STAND IN FOR A DEPENDENCY WE CANNOT REACH.**
`serveDist` answered **`200 []`** to every `/api/…` path that was not auth — so
the render check handed a page reading `data.rates.EUR` an empty ARRAY, which is
truthy, and the page threw reading `.EUR` of `undefined`. The check reported it
`threw`, which is **SERIOUS**, and `isSerious` is what `site-repair.mjs` and
`site-add.mjs` read to buy a paid repair of code that works.

- **`apiAnswer(pathname)` IS THE ONE CLASSIFIER**, and it splits *supported
  fixture* from *unavailable dependency*. Supported: `rows` (`200 []` — an empty
  table list is a REAL answer and the page draws its empty state), `auth` (401),
  `turnstile`, `error`. Unavailable: `api`, `rpc`, `checkout`, `uploads`, `hook`
  and **every path it does not recognise**, which fails CLOSED.
- **THE RPC TEST SITS ABOVE THE DATA TEST AND THE ORDER IS THE RULE.** `useRpc`
  posts to `/api/db/<slug>/data/rpc/<fn>` — inside `/data/` — and a function may
  return an object or a scalar, so the table-list fixture is exactly as wrong
  there as it was for `api`. The guard asserts the ordering, not just the rows.
- **424, NOT 503, AND THE SITE'S OWN RETRY POLICY IS WHY.** `router.tsx` fails a
  4xx immediately and retries a 5xx twice at 500/1000 ms — so a 5xx would spend
  the check's clock on a dependency that is never coming.
- **`unmet` IS A FINDING KIND AND IS NOT SERIOUS**, the `slow` precedent. The
  customer's sentence is *"reads something the check can't reach, so I couldn't
  see it with real data"* — which is what it is, and never a page error.
- **THE BROWSER'S OWN REPORT OF OUR REFUSAL IS NOT THE PAGE LOGGING AN ERROR.**
  Chromium writes `Failed to load resource: …424` to the console for every
  marked response, so the first cut reported our own fixture as `logged`.
  `ourRefusal(line)` filters those and ONLY when something was really unmet.
- **THE GUARD WAS VACUOUS BEFORE IT WAS FIXED, and the trap is this file's own.**
  It asserted through `checkRender` that nothing `threw` — and CI has **no
  browser**, so `checked: 0` made every absence true about nothing. `serveDist`
  is exported now and the wire is driven with plain `fetch`; the finding readers
  are pure. **Separately proven with the REAL hooks in a REAL Chromium**
  (`src/lib/rows.ts`, the site's own retry policy, run 53's `data.rates.EUR`
  read): both refusals draw the page's error state, the table list draws its
  empty state, nothing throws, `isSerious` is false — and a genuine error on the
  same page is still `threw` and still serious.

**`aShipped` WAS THE PLAN LESS THE MISSING, SO A PUBLISHED PAGE WAS NOT IN THE
INVENTORY.** The `api` designer handed two needs to `page`; the `page` KIND
designer declared NOTHING, which is correct — a connection is not pageless, so
the PAGE CALL writes the page. `aWanted` is the kind designer's answer, so
`aShipped` was `[]` on a change that published `/rates`.

- **EXISTENCE COMES FROM THE PUBLICATION, ABSENCE COMES FROM THE PLAN.**
  `aShipped` is now derived from `aFilesOut` (`aMerge.added` + `changed` — what
  really compiled and shipped); `aMissing` is still `aWanted` less that. Two
  questions, two sources. They cannot disagree, because they read the same
  artifact rather than one being defined as the other's complement.
- **A COMPONENT IS NOT A ROUTE AND `routeOf` CANNOT SAY SO** — it answers
  `/-parts/tide-chart`, measured. Since the band split the publication carries
  components too, so the `PART_DIR` filter is what stops every section this
  change wrote arriving as a page a visitor can open. **⚠ IT IS A BELT AND
  CANNOT FIRE TODAY, and a sweep called the comment that said otherwise.**
  Cutting the filter SURVIVED every guard, so it was measured rather than
  argued: `aFilesOut` is `mergeAddonPages` over the PAGES alone and components
  merge separately into `aParts`, so no entry can contain `-parts/` — driven
  through the route, a change writing `tide-chart` answers
  `changed: ["index.tsx"]` with the component in the container's own `parts`
  list. **KEPT deliberately and said so in the code**, because the day
  components join that list is one edit to `aFilesOut`; the PAIR is swept
  (parts added AND the filter cut) and dies.
- **THE DISCRIMINATOR IS AN EXPLICIT ITEM REFERENCE.** A need naming NO item has
  nothing to look up and reads `unknown` on BOTH sides of this fix — so a case
  built only out of run 53's two unnamed needs cannot tell the versions apart.
  Measured on the reproduction, reverting the derivation and nothing else:
  applied pages **`[]` → `["/rates", "/"]`**; the named need **`missing`/`absent`
  → `unverified`/`found`**; both unnamed needs **`unknown` → `unknown`**; the
  unrelated `/stockists` **`missing` → `missing`**; counts **missing 2 →
  missing 1 + unverified 1**; and `"Still to do"` stops naming `/rates`.
- **PUBLISHING A PAGE PROVES THE PAGE IS THERE AND NOTHING ELSE.** The ceiling
  is `unverified`; `checked` stays `[]` for `page` as for every kind, so
  `delivered` is unreachable from a publication. Publishing ANY page still
  satisfies NO page requirement that does not name one.
- **⚠ RUN 53'S OWN `missing: 2` IS CONSISTENT WITH THE INFERRED `/rates`
  REFERENCES — NOT REPRODUCED, AND NOT "ANOTHER, UNIDENTIFIED CAUSE".** Two
  earlier notes overstated it in opposite directions; this is the standing
  reading. **THE EVIDENCE LIMIT IS EXPLICIT AND STAYS**: the capture truncates
  at `…right now","statu`, so what those two entries declared past `status` is
  unknown, and **the stored record is not readable from a session** —
  `ADDON_ANSWER_KEY` (`source/<slug>/addon-answer.json`) has **no reader
  route**, `GET /api/site/answer` serves `answer.json` ALONE, and the free
  `answer read` workflow checks out `ref: main` and defaults to another slug.
  Recovering it needs a reader, a merge and a press. **Nothing invents those
  fields.**
  What the deployed code (`d304120e`, byte-identical here in
  `site-requirements.mjs` and `site-add.mjs`) does settle: `missing` is
  reachable from ONE line, `impl.state === "absent"`; the only other "Still to
  do" state is `failed`, which needs `status: "covered"` (both are `elsewhere`,
  and the capture records `0 unsupported`); and with NO item `absent` comes from
  the kind branch, gated on `mine.length || theirs.length`, where `theirs` is
  the site's own routes. **repairbench-1 HAD routes** — its live sitemap answers
  `/`, `/booking-check`, `/rates`, `/status`, `/workshop-load`, `/rates` being
  the one that run added — and the reply's own *"updated /"* says so a second
  way. **Measured on the real readers with those routes present**: no item →
  `unknown` on BOTH inventories; `item: "/rates"` → **`absent` before, `found`
  after**. So an item-less reading is RULED OUT, a `/rates`-or-`/` reading is
  consistent and is corrected by this fix — **and a third reading survives**: a
  reference naming a page NOBODY published is equally consistent with `missing`
  and is NOT changed by the fix, correctly, being a true "still to do". The
  guard drives the measurement so the inference cannot rot into a story.
  **AND THE *"I can't see from here whether…"* CLAUSE IS NOT THIS FIX'S EITHER**
  — run 53 never printed it at all; it belongs to the item-less fixtures.

### THE ADDON KNOWS WHAT THE SITE IS

- **A PAGE THIS SAME CHANGE IS ADDING IS A REAL DESTINATION.** `page` runs
  before `component`, `qr`, `three` and `photo` in `ADD_KINDS`, so
  `site.planned` carries `{path, name}` and **`going = have ∪ planned` is the
  ONE list** both "where may this go" and "where may a code point" are answered
  from. `siteNote` prints the planned pages on their OWN line, saying they do
  not exist yet. **`SPEC_OF_KIND` HAS NO `page` ENTRY AND MUST NOT GAIN ONE.**
- **THE ONE-PAGE SHORTCUT READS THE POST-CHANGE SITE.** Its whole justification
  is *"a site with exactly one page has exactly one place a component can go"*,
  which expires the instant this same change adds a second. **A NAMED route
  resolves to that route or to NOTHING** — `onPage` answers `{page}` or
  `{bad: true}`, and all four placing kinds refuse `no-page` on `bad`. **An
  omitted optional placement is untouched** (absent still answers `""`), and
  **prose is a named destination too**: `route("the gallery page")` is `""`, so
  a designer writing a page's NAME took the no-answer branch and landed on the
  front page exactly as `/nowhere` did. Whitespace alone is an omission.
- **AN EXISTING COMPONENT IS NOT ONE TO BUILD.** `look.tsx` is the cumulative
  DECLARATION list — true of a component nobody ever wrote — and the page writer
  was handed it under *"the kit does not have these, so you write them"*, so
  `mergeParts` replaced a real file by name: **a rewrite of working code from
  its own summary, with nothing saying it had happened.** `partsSent` decides
  once and is read twice: `{shown, withheld, names}` over
  `source/<slug>/parts.json`, showing the source of what fits and **NAMING what
  does not, with an instruction** — a withheld component said nothing about is
  indistinguishable from one that does not exist. `tsxDirective(tsx, names)` is
  filtered by **every** name the site has a file for. **TWO BOUNDS**:
  `MAX_PART_CHARS` **12,000** for one and `MAX_PARTS_CHARS` **36,000** for the
  block, against `MAX_PRIOR_CHARS` (**90,000**, the PAGE source, which keeps the
  larger share). In stored order and **never sorted by size**, or which
  component is shown would depend on the others.
- **`readSiteParts` ANSWERS `{ok, parts, why}` — THREE STATES.** The route read
  the store TWICE, minutes apart, and the two could disagree: a first read that
  THREW gave `partsSent` `null` (no source shown, the DECLARATION handed over,
  the wall with nothing to refuse) while the second SUCCEEDED and the merge
  replaced the real file. One snapshot now serves the note, the prompt, the wall
  and the merge. **With BOTH reads failing, `mergeParts(null, [one])` answers
  `[one]`** — every other component deleted, none of them named. While `ok` is
  false nothing is offered, every returned component is refused, and
  `parts.json` is not written at all. **A different refusal needs a different
  sentence**: `keptPartsNote` is about a SIZE BOUND, `unseenPartsNote` about a
  store that failed.
- **THE SAME SHAPE IS LIVE ON THE EDIT PATH** (`worker.js`'s `pStored` read) and
  is in the backlog, not fixed there.
- **THE LOOK IT IS WEARING, AND THE SIGNATURES IT NEEDS.** The page writer gets
  the theme and the site's own stylesheet **as ALREADY APPLIED** — a model shown
  one with no such sentence restates its rules inline, where editing the
  stylesheet can no longer reach them; over `MAX_STYLE_CHARS` (**16,000**) it is
  cut and **the cut is announced**. `plan.components` gains the kit modules the
  pages being edited already import. **`pageComponents` answers EXPORT names and
  `siteComponentApi` is keyed on MODULE names** — handing it the exports answers
  `""` for every one, indistinguishable from a site importing nothing, so one
  walk answers both.
- **A SITE TOO LARGE TO SHOW WHOLE KEEPS ITS CONTRACT AND SAYS WHAT IT HID.**
  Over `MAX_PRIOR_CHARS` the block fell through to a REVISE's wording — *"write
  them again in full"* — on a path where a returned page REPLACES the stored
  one, losing `remove`, the byte-identical rule and *"a page you do not return
  is KEPT"*, with `ok: true` and **nobody told**. `priorPagesSent` is
  `partsSent`'s shape one layer over: a page named and not shown is told it must
  not be returned. **`keep` is the pages this change is about, then the HOME
  page** (the nav anchor almost every addon touches). **A page too big for what
  is left is SKIPPED, never a stop**; **the wire order is the SITE'S**, whatever
  `keep` did to the selection; **one selection, two readers**, because a fallback
  living in the BLOCK left the route's own reader reporting a shown page as
  unseen. Measured: **0 of 100 corpus sites exceed it**, the largest being 50,646
  characters over 6 pages, so this arrives by growth.
- **A PAGE HAS ONE IDENTITY.** `cleanPath` strips the `src/routes/` prefix, so
  every persisted path is bare and a keep list built with the prefix could never
  match — the large-site selection was stored order on every real site.
  `pageId` is the one definition, asked of both sides, and the comparison is
  **case-insensitive ON BOTH SIDES** (`SAFE_PATH` carries `/i`, so `About.tsx`
  really is stored with its capital). **The fixtures were the reason it
  survived**: every stored-page fixture carried the prefix, so the guard's two
  sides agreed by accident and `keptProse` had never fired in any of them.
- **THE PRESERVATION POLICY HAD ONE REASON AND NEEDED TWO.** Reachability is a
  guess about a page NOBODY mentioned — a good guess, bought by a live run where
  *"add a gallery page"* rewrote four of four pages for 28 credits. `asked` is
  not a guess: it is the destination a CLEANED designer answer NAMED.
  **`aAskedPages` and `aKeepPages` are two lists out of one walk, and the
  difference is the `/`** — the home page is a BUDGET decision, not a claim that
  anybody asked, so handing the window's list to the merge would exempt `/` from
  preservation on every addon.
- **"updated", NOT "linked it from".** `added.length ? "linked it from" :
  "updated"` was an INFERENCE from *a page was added* to *this changed page
  carries the link*, written when that was the only reason a page could change
  beside an addition. It contradicted itself in one sentence — *"added
  /gallery, linked it from /. Nothing links to /gallery yet…"*.

### PHOTOGRAPHS, CODES AND SCENES ON THE ADDON PATH

- **A BUDGET OF OURS IS NOT A FACT ABOUT THE SITE.** `imageDirective(0)` said
  *"PHOTOGRAPHS: none on this site"* — measured identical on a site showing two
  bought photographs. The zero is stated as OURS; what the site has is a second
  sentence. **`shownPhotos` IS THREE-STATE**: `null` is "nobody looked" and gets
  *"Leave every picture already on this site exactly as it is."*
- **THE DISCRIMINATOR IS HOW THE SITE USES THE FILE, not what it is called.** A
  `src` — attribute or object key — is a picture the site DRAWS; an `href` is a
  file it LINKS. An extension rule would be a second idea of what a picture is
  and would be wrong about a `.jpg` offered as a download.
- **`photoInventory(pages, parts, partsKnown)` IS THE SIXTH STEP ASKING
  `imageSources`**, not a sixth copy of the union. **An incomplete inventory is
  `null`, never a shorter list.**
- **PAGE + PHOTOGRAPH IN ONE REQUEST: IT BUYS THE PICTURE AND PLACES IT.** The
  line is WHO MAKES THE SLOT, the same line `runPictureEdit` draws with
  `needs-place`: a photograph asked for beside a page is a slot THIS change is
  writing. **A photograph ALONE is still the picture rung's, unchanged.**
  `PLACING_ADDS` is a third group and the partition stays total and disjoint;
  **`addLayerIn(kind, kinds, placing)` is the ONE reader** every route ask goes
  through (four calls, pinned by census), because two of them disagreeing is a
  kind designed and then reported as skipped. `IMAGE_CAP` and `MAX_PROMPT_CHARS`
  are IMPORTED. **The balance cuts the list before the writer sees it**
  (`imagesAffordable`, the same reader `buySitePhotos` asks at the moment of
  spend), so the writer is never shown a token the purchase will refuse.
  **Bought after the merge and the parts wall, before `newEmptySlots`**; billed
  on `made`, never `planned`. A photograph is `IMAGE_USD / CREDIT_USD` ≈ **18.75
  credits**.
- **⚠ AND THE SWEEP BELT WAS STRIPPING THE VERY TOKENS THE PURCHASE IS FOR.**
  `applyImages(aValid.pages, {})` ran unconditionally, which was right for every
  addon before today — the step bought nothing. *A rule true because of a layer
  below it expires when that layer moves*, and **here we are the layer.**
- **`unaffordable` IS HOW THE FULL LIST TRAVELS AND THE ROUTE NAMES THE
  REASON**, because it is the only place holding both numbers. **It is NOT
  `overflow`**, which is tokens the writer WROTE beyond the budget and which
  `applyImages` sweeps to `src=""` — so *"the other 2 pictures are
  placeholders"* is TRUE there and a lie here. **`frames` keeps the zero-budget
  sentence honest**: with nothing affordable the writer is asked for
  `<SafeImage src="">`, so *"the pictures are placeholders"* is true when it
  writes one and false when it does not.
- **IT ASKS FOR `src=""`, NOT A MISSING `src`.** The picture rung fills a slot
  by rewriting a `src` ATTRIBUTE, so the shape the addon used to ask for read as
  ZERO slots to the very next rung. An empty src and a missing one **render
  identically** (`safe-image.tsx` branches on `!src`).
- **BUYING ONE MAY NOT LOSE THE ONES ALREADY THERE.** `keptImages(before, after,
  slug)` — every photograph the site showed is still shown, or 422
  `lost-photos`, cost 0, before the purchase and before the gate. **Site-wide,
  never per file**, so a writer that moves a `<SafeImage>` between components has
  kept every picture the site shows. **The slug folds case and the URL does
  not**: the rest of the path is an R2 KEY, where a re-cased hash is a different
  object. **Replacement is removal.** `lostPhotosMsg` gives the COUNT and never
  the urls — a storage key tells a customer nothing.
- **A PHOTOGRAPH THE SITE ALREADY HAS MAY BE SHOWN AGAIN.** The capability was
  always there (a `/u/` url copied onto a new page passes `keptImages`, survives
  `applyImages` byte-identical, and adds no spend) and **the directive carried
  zero `/u/` urls in all three of its forms** while the sentence beside it read
  as an instruction not to. **A count cannot be copied into a `src`**, so the
  list and the permission arrive together or not at all: `urls` distinct, sorted
  (a prompt that moves for no reason is a cache miss and an unreadable diff),
  capped at `MAX_KEEP_URLS` (12) against a measured real-site maximum of 3.
- **A `src` THIS SITE DOES NOT OWN NEVER SHIPS.** `strayPhotos` is `keptImages`
  turned round — one function cannot answer both, because each is an addition as
  far as the other is concerned. **Swept to empty, not refused** (the
  `applyImages` precedent), asked BESIDE `keptImages` and before the purchase,
  and both lists written back into their own.
- **OWNERSHIP COMES FROM THE UPLOAD STORE, NOT FROM THE PAGES.** A picture
  nobody has placed is on no page, so building the owned set from `photoUrls`
  invented an upload made that morning. `siteUploadExists` HEADs
  `uploads/<slug>/<file>`; **three answers, and only `false` sweeps** — an
  unknown is LEFT STANDING, because an unknown left is at worst a broken image
  and an unknown swept is somebody's photograph gone. `before` is a fast path
  and not the definition. **A url the serve route itself refuses is a real
  absence**, and `uploadKeyFor` is the serve route's own shape rule, **resolved
  from the PATHNAME** (`new URL(raw, base).pathname`) so `?v=2` and `#preview`
  look up correctly and dot segments normalise the way the route normalises
  them. `/u/` is required BEFORE the parse, or `https://evil.example/u/…`
  resolves to a pathname the shape accepts. **The original URL is never
  rewritten.**
- **THE CORRECTION IS AN IMAGE REFERENCE, NEVER A STRING REPLACE.** `imageRefs`
  is the one definition, read by the FINDER and the CORRECTOR alike: a `src` as
  a JSX attribute or an object key, the kit's own naming in both places. An
  `href` is neither. The grammar is IMPORTED from `site-picture.mjs`
  (`KEY_BEFORE`, `keyName`), which is what stops `dataSrc` and `image_src`
  matching. A mismatched quote pair is refused rather than rewritten.
- **A DEPENDENCY IS COMPLETED OR WITHHELD, NEVER WARNED ABOUT.** A QR code
  pointing at a page that did not survive generation used to publish beside a
  sentence asking the customer please not to print it — **and a QR is the one
  thing here somebody PRINTS**. The whole dependent set goes together: the code
  is dropped and every page and component THIS CHANGE WROTE that renders it is
  withheld, an existing one reverting to its PREVIOUS version and an invented
  one not written at all. **Nothing breaks because what ships already shipped**:
  the binding is never deleted from a live page, it is never introduced.
  - **IT IS A FIXED POINT, NOT A PASS** — withholding an ADDED page takes its
    route away, which can kill a second code, which withholds a third page.
    `MAX_QRS` is 6, so a chain that long is constructible. **Re-merged, never
    patched**, because `mergeAddonPages` owns the link rule and a hand-edited
    answer satisfies none of it. **`validatePages` is asked AGAIN over what
    survives**, or a home page carrying `<Link to="/posters">` for a withheld
    page publishes with `TS2322` and a 404 for whoever clicks.
  - **NOTHING LEFT TO PUBLISH IS A REFUSAL** (`qr-dependency`, 422, cost 0) —
    a compile and a version for a site byte-identical to itself costs a build
    and moves nothing.
  - **A COMPONENT IS A GENERATED FILE TOO**, in both readers: since the band
    split a section IS `src/routes/-parts/<name>.tsx`. An **added** component
    that is withheld takes every page that IMPORTS it with it (publishing the
    importer without the module is `vite` refusing); a **changed** one breaks no
    importer. `PART_DIR` is the one definition; the leading `(^|["'/])` keeps a
    page called `my-parts/x.tsx` from reading as an import, and the trailing
    `(?![\w-])` keeps `qr-banner-2` from matching `qr-banner`.
  - **AND A SIBLING IS `./x`, WITH NO `-parts/` IN IT.** From inside `-parts/` a
    relative `./x` can resolve to NOTHING BUT `-parts/x.tsx`, so admitting it
    has a false-alarm rate of **zero by construction**; from a PAGE the same
    three characters mean another page, which is what `inPart` discriminates.
  - **`qrUnplaced` IS THE ONE READER of "does a page show this code"**, asked
    one source at a time against the WHOLE list, because its legacy `SITE_QR`
    arm keys on a code's INDEX — a one-element list makes every code look like
    the first.
  - **THE SAME DESTINATION, SPELLED TWO WAYS, GETS ONE ANSWER.** `cleanAdd`
    checked a destination against `going` **only when it `startsWith("/")`**, so
    a full URL to a route the site has not got was drawn, baked and published —
    **and the full URL is the spelling the tool offers FIRST**. `qrSiteRoute` is
    the one reader, shared with `deadQrs`; an external URL, a `tel:`, a `WIFI:`
    and a `mailto:` are none of our business.
- **A COMPONENT'S FILE PATH IS NOT A ROUTE.** `routeOf("src/routes/-parts/photo-wall.tsx")`
  answers `/-parts/photo-wall`, so a photograph in a component was bought,
  billed ~18.75 credits, published — and the same reply said *"Still to do"*.
  `routedSources(pages, parts)` answers `imageSources`' own list with a `routes`
  array: a page's is its own route, a component's is every page that imports it,
  **transitively**. Built from `imageSources` in two calls, so no index
  arithmetic ties the answer back to its input. **A page whose path is not a
  route contributes none.**
- **AN IMPORT IS NOT A PLACEMENT, AND A COMMENT IS NOT AN IMPORT.** Four shapes
  — a line comment, a block comment, a quoted example and a live-but-unused
  import — all read as placement. **`importSpecs` scans `codeOnly`** (the
  comment half) and **a specifier is a string literal by POSITION**, after
  `from`/`import`/inside `import(`/`require(` (the quoted half) — *a substring
  test cannot express that at all*. **`codeOnly` lives in `site-files.mjs`** and
  `site-picture.mjs` re-exports it, asserted the same function by identity.
  **The compile question and the placement question are two**: a dangling import
  breaks `vite` whether or not anything renders it, so the cascade keeps
  `importsPart`; `partUses` answers `rendered` / `unused` (the one definite
  negative) / `unsure`. **The direction is asymmetric on purpose** — reading a
  placed component as `unused` costs a false "Still to do".
- **AND A NAME INSIDE A STRING IS TEXT ON THE PAGE, NOT A PLACEMENT.** The
  placement test (`<Name`) reads the **masked** copy and the mention test reads
  the **code** copy, and that asymmetry is the whole correction: real JSX
  survives masking (`<Band title="a <Band /> example" />` keeps its own opening
  tag), while masking the mention too would call a binding referenced only in
  `` `${Band}` `` a DEFINITE absence — `scanSource` masks a template literal
  WHOLE.
- **`routes` IS ESTABLISHED PLACEMENT AND `maybeRoutes` IS WHAT COULD NOT BE**,
  `min` along each path and `max` across them, and a route in one is never in
  the other. The three readers take `routes` for positive evidence and neither
  answer for uncertainty — **`appliedFacts` has exactly two words**, so an
  unestablished placement was being recorded as `fails: ["onpage"]`, the
  strongest negative this vocabulary has, over evidence that establishes
  nothing.
- **A PICTURE A PAGE DRAWS FROM A LIST WAS COUNTED BY NOTHING.** `imageSlots` is
  RIGHT not to see a `<Gallery items={[…six…]}/>` — its contract is a `src` SPAN
  to replace and a LITERAL `alt` to match — but **the customer's sentence is
  about what they SEE**. Over the 100-site corpus that is **320 such frames in 60
  of 324 files, and EVERY ONE IS EMPTY** (254 explicitly `src: null`, 66 with no
  picture key, zero carrying a url or a token). The rule is `alt`, the kit's own
  `{src?, alt?, caption?}` as object keys, so `listFrames` knows nothing about
  which components exist. **A COUNT IS ESTABLISHED ONLY WHERE THE ARRAY IS THE
  PROP'S WHOLE VALUE** — measured, **297 of the 320** are in that shape — and
  everything else (a named const, a call, a memo, a spread, a ternary) is
  uncertainty, which reaches the customer with **no number at all**. A deny-list
  of runtime methods caught **ZERO of the 23**, because a generated page declares
  its array at the top of the file and maps it two hundred lines below.
  `MAX_PROP_LOOKBACK` is 2000 and **the 815 is measured** (the furthest a counted
  entry sits from its own `items={`); a bound reached is uncertainty, never a
  number.
- **AN OBJECT INSIDE A STRING IS AN EXAMPLE** — two views of one file, because a
  frame is FOUND by its braces and READ by its values. `codeOnly(src, true)`
  blanks contents and KEEPS the quotes. **⚠ The first cut destroyed 29 real
  frames across 6 corpus sites**: JSX text is full of apostrophes, and read as
  string openers they swallow a whole `<Gallery>` two hundred characters below.
  `AFTER_WORD` (`/[A-Za-z0-9]$/`) is the fix — a string never opens directly
  after a letter or digit — **with a BACKTICK exempt**, because `` css`…` `` is
  a tagged template.
- **`newEmptySlots(before, after)` IS PER PAGE AND ONLY THE INCREASE**, computed
  AFTER `applyImages` over the PUBLICATION (not the writer's answer), so a page
  the QR dependency withheld is not counted. **Negative never subtracts**; a
  `src`-less element is not a frame anybody can fill; and an unreadable
  component store takes components off BOTH sides, never one.
- **A SCENE'S DECLARATION AND ITS PLACEMENT ARE TWO FACTS.** `three` is a stored
  look field decided by the design step and the canvas is written by the page
  step, so `sceneOn` (beside `sceneDirective`) requires **both** the import and
  the element, the conservative direction.
- **A PHOTOGRAPH'S IDENTITY IS ITS `name`**, a label the designer coins, not a
  binding: `describe` is capped at 240 and an `item` at **80**, so a designer
  echoing a real brief would have it silently truncated. **Required, not
  optional** (an optional identity leaves the collapse reachable in the ordinary
  case) and **refused rather than sliced** (a sliced brief is still the picture
  somebody asked for; a sliced NAME is a label the designer never wrote). Two
  pictures in one answer may not share a name. **The chain is request → token →
  url → file → route** and `shotKey` is the ONE normalisation both ends ask.
  **The wall fires only where something else would answer for it** — a lost
  request on a route carrying no photograph is already `absent` and earns the
  better clause.
- **A PARTIAL OUTCOME IS SAID.** `droppedNote` joins `coverNote` beside
  `missingPagesNote`: a thing the design asked for and this step could not build
  is a fact about the change whether or not a requirement named it. **Counts and
  kinds, never the identifiers** — `tide-chart` is a file name the DESIGNER
  coined. The kind is said in the customer's vocabulary (a component is a
  *section*, a column a *field*) and an unrecognised one is a *thing*, which
  fails open.
- **A REFUSAL STORES NOTHING ON ITS WAY OUT.** `patchSiteConfig` ran ABOVE
  `keptImages`, so a combined gallery + photo + QR request failing `lost-photos`
  left the QR persisted for a route that will never exist. **Moved rather than
  compensated for** — a restore-on-refusal is a second repair path that can
  itself fail — which keeps ONE rule (*a refusal changes nothing*) instead of a
  rule plus an exception, and makes the store-to-publish window strictly
  SMALLER. The store's own comment read *"every refusal above leaves the site
  exactly as it was"*, which was TRUE when written and is why nobody looked.

### AN OUTSIDE CONNECTION A PAGE CAN ACTUALLY RENDER (2026-09-19)

Of every gap in the `api` tier this was the only one where **the page provably
cannot be written correctly from what it is given**. Three pieces, in the order
they fail: **`returns`** (a sketch of the answer's SHAPE), **`params` with types
and required flags**, and **`credential`** (which service, and where the owner
signs up).

**A TYPE ANNOTATION CHANGES NOTHING A VISITOR SEES**, and this is measured, not
argued: two `.tsx` pages differing only in `useApi<Rates>(…)` against
`useApi(…)`, built with the template's own esbuild, are **408 bytes each,
sha256 `73a4782b79a186d0`, byte-identical** — with both asserted NON-EMPTY
first, because esbuild answers zero bytes on a bad flag and two empty files are
vacuously identical. **And an invented type cannot catch a wrong field name,
because the same guess produced both**: `type Rates = {rate: number}` reading
`q.data?.rate` **typechecks CLEAN under `tsc --strict`** and renders `""`
against `{rates:{current:{gbp:0.79}}}`. **The failure is the field name and the
type is what stopped anybody noticing** — so `TS2339` is evidence of a typing
problem and never of blank rendering.

- **`site-api-shape.mjs` IS THE ONE DEFINITION** — dependency-free, at the root,
  on the Dockerfile's worker line. `site-apis.mjs` keeps the REQUEST (fill,
  call, cache); this keeps the three things a page writer needs and could never
  discover.
- **THE SKETCH IS A TREE OF TYPE NAMES AND NEVER A SAMPLE.**
  `{"current":{"temp_c":"number"}}` says which field to read;
  `{"current":{"temp_c":18.5}}` is a sample, and a page written against one
  hardcodes today's answer (`shape-leaf`). A list is a ONE-ENTRY array; two
  entries say two things. `unknown` is a real leaf. Depth **5**, **60** nodes.
  **`typeFromShape` is what makes it actionable**, and a key that is not a plain
  identifier is QUOTED or the type does not parse.
- **`SHAPE_TOP` IS THE ONE DEFINITION AND THE TOOL'S TYPE IS DERIVED FROM IT.**
  The tool said object-only while `cleanShape` accepted a top-level ARRAY — what
  most list endpoints send — so a model obeying the schema could not describe a
  list at all. **A bare leaf is out on purpose** (`shape-top`): `returns: "a list
  of exchange rates"` is what a model writes reaching for prose.
- **THE SKETCH'S OWN FIELD NAMES MUST BE PERMITTED ON THE WIRE.** xAI's
  documented tool-schema rules default `additionalProperties` to false, and
  `toXaiRequest` passes `input_schema` VERBATIM — so a declared object with no
  key permission admits **no keys at all**, and a sketch is nothing BUT
  arbitrary field names. **The permission sits where a type is declared, and
  that is one place**: the array branch declares no `items` so its entries are
  unconstrained, and below the root nothing declares a type. A belt at either
  would be a keyword that constrains nothing. **This is the repository's first
  type union AND its first `additionalProperties` permission**, in ONE place so
  a live 400 is a one-line flip. **The reach is the `api` ADDON kind and a
  design call that carries `backend` — a revise — and NO first build**, because
  `FRONTEND_SCHEMA_TOOL` destructures `backend` out. Measured; the first
  write-up of this overstated the blast radius twice.
- **`params` STAYS THE LIST OF NAMES AND `paramInfo` SITS BESIDE IT**, because
  `declFingerprint`, `cacheKey` and `takeParams` all iterate `api.params` as
  names and changing the shape would re-key every cached answer on the platform.
  One walk produces both. **Re-reading a stored declaration must put the two
  back together** — `cleanParams(params, stored)` pairs **BY NAME**, never by
  position.
- **NONE OF THE THREE IS IN THE CACHE FINGERPRINT.** Correcting a parameter's
  description would otherwise drop every cached answer and put the owner's
  third-party quota back on the next page view — a documentation fix billed as a
  configuration change. The parameter NAMES stay in it.
- **A REQUIRED BLANK IS REFUSED BEFORE THE UPSTREAM CALL.** Without it `fill`
  substitutes an empty string and plenty of services answer 200 with a default,
  so the page renders something plausible and wrong.
- **WHERE THE KEY COMES FROM IS DERIVED FROM THE DECLARATION, NEVER CLAIMED.**
  `credentialNote` reads `secretsNeeded` — the declaration's own `{{SECRET}}`
  placeholders — **asked PER CONNECTION**, so a mixed request cannot tell the
  owner to sign up for a key nothing will use, and misleading metadata on a
  keyless connection is ignored rather than believed. It must not say a keyless
  connection *"is answering already"*: this platform has not called that service
  and has no business saying it works; what it knows is that there is nothing to
  paste. `secretsNeeded` lives in `site-api-shape.mjs` and `site-apis.mjs`
  RE-EXPORTS it, asserted the same function by identity.
- **THE PAGE IS TOLD IT HAS THREE STATES TO DRAW.** The word "loading" did not
  occur in `builder/page-gen.mjs` at all. A database read is local; a
  third-party read crosses the internet, answers 503 until the key is in the
  vault and 502/504 when the service is down. **That sentence is new for EVERY
  connection**, so the per-connection LINE is unchanged for a connection that
  declared none of the three and the block gains one shared sentence.
- **THE TOLERANT READER AND THE REFUSING CLEANER.** `normalizeApi` is what every
  STORED spec passes through on its way to being served, so a sketch it cannot
  read is DROPPED and the connection still works; `cleanAdd` refuses by name at
  the moment a person can be told. One definition of clean, two decisions.
- **THE JOINED ACCEPTANCE IS THE CLAIM THE THREE SEPARATE ONES CANNOT MAKE.**
  Between the page and the service sit two hops nothing had ever run together —
  the url `useApi` builds and what the platform's own route does with it — so
  the page goes through the REAL addon route, is read back **out of the store**,
  and that exact string is rendered with the kit's own `useApi` against
  `worker.js`'s own `/api/db/<slug>/api/<name>`. **This proves LOCAL WIRING
  only**: the service is stubbed, and neither documented compatibility nor local
  validation is provider acceptance.
  **⚠ AND THAT LAST SENTENCE IS NO LONGER THE WHOLE STORY — RUN 53 SUPPLIED THE
  MISSING HALF.** The acceptance test stubs the service because it must; run 53
  did not. A published page on `repairbench-1` called the REAL keyless rates
  service through this exact chain and rendered its answer — `1.1644 / 1.3344 /
  Rates from 2026-09-18`, read at TWO depths (`date` at the top level, `EUR`
  inside `rates`), with zero console errors. **So provider acceptance IS
  established for one keyless connection**, and what the stub sentence still
  correctly guards is the general claim: one service answering is not every
  service answering, and a KEYED connection remains unproven.
  **THE TRAP THIS ENTRY WAS CAUGHT BY**: the run that proved it is written up
  three hundred lines above, and the capability table went on saying *"NO page
  has ever read one live"* for a day — **the file falsified itself and neither
  half noticed**, exactly as the `language` entry did. When a run proves
  something, the CAPABILITY SUMMARY is the thing to edit; the narrative is
  where nobody checks a claim.
- **KEPT RECORDED, NOT FIXED**: native one-time scheduling for a job, which
  shipped 2026-09-19.

### THE FOUR STATES "NO DATABASE" MEANT (2026-09-15)

`siteBackendBySlug` answers ONE `null` for four different facts, and
`site-backend-state.mjs` is the one pure function that tells them apart — shared
by the Worker, the job child and `scripts/backend-repair.mjs`.

| state | means |
|---|---|
| `ready` | `site_backends.neon_db` names a database |
| `none` | no name AND no `site_project` row — **the only state in which `{tables: []}` is true** |
| `incomplete` | no name but a project row EXISTS: the database is real, the REFERENCE is missing |
| `unreadable` | a lookup threw. Asked FIRST, so a partial answer never decides a state |

- **THE KV CACHE IS WHY IT HID FOR A YEAR OF DEPLOYS.** `lookupRoute` checks
  `env.SITE_ROUTES` first, so in the WORKER an `incomplete` site resolves out of
  the cache. **`SITE_ROUTES` is ABSENT in the container**, so when the addon
  moved behind `JOB_RUNNER_EVERYONE` it met the blank column. A repair that
  consulted the cache would report every affected site as healthy, which is why
  `siteBackendDetail` reads Supabase and never `siteBackendBySlug`.
- **THE ROOT IS ONE LINE, IN THE PROVISION.** `saveBackend` is an INSERT with
  `resolution=ignore-duplicates`: for a site whose first build was frontend-only
  the row ALREADY EXISTS with `neon_db: ""`, so the claim is a no-op for ever.
  `ensureSiteBackend` writes it now, **from the connection it is about to hand
  back** rather than re-deriving off the slug.
- **`incomplete` IS RESOLVED AND THEN PROVED** — a name that derives is not a
  database that answers, so it is probed; a probe that fails is `unreadable`,
  never `none`.
- **`readSchemaState` ASKS THE CATALOG FIRST**, and the order is the fix. Four
  outcomes: `stored` (with `missing` naming live tables the spec does not
  declare), `empty` (the catalog CONFIRMS none), `tables-without-metadata`
  (recoverable), `unreadable`. **A catalog we could not read is `unreadable`,
  never "no tables".** In the Worker, `specForAddon` RECOVERS or STOPS, and it
  is READ-ONLY.
- **RECOVERING A DROPPED DECLARATION** — `site-schema-recover.mjs`.
  `reconcileSpec` keeps every stored entry EXACTLY as it stands and rebuilds an
  entry for each table the database has and the spec does not. `deriveAccess` is
  the inverse of `grantsFor`/`policiesFor`; **a table whose access cannot be
  derived is NAMED and left out, never guessed.**
- **THE SIXTEEN-CELL ROUND-TRIP CAUGHT A REAL BUG IN THAT DERIVATION.**
  `policiesFor` writes BOTH member levels against `app_user_id()`, so "mentions
  the function" called **seven of sixteen cells** `own` that are `members` — the
  direction that NARROWS a live table's access. **It is the EQUALITY that
  separates them**, and the guard asserts all sixteen exactly rather than a
  floor, because a floor is what let it sit under a passing assertion.
- **RECOVERY MUST NOT CHANGE BEHAVIOUR ONE APPLY LATER.** Rebuilding
  `{name, columns, read, write}` drops every flag: a `trash` table whose live
  policy reads `((owner_id = app_user_id()) AND (deleted_at IS NULL))` recovers
  without it and `policiesFor` emits the first half alone — **every soft-deleted
  row visible again on the next schema change, days later**. Flags are DERIVED
  from the artifacts the engine leaves (`DERIVED_FLAGS`), and the rebuilt
  declaration is run back through the REAL `policiesFor`/`grantsFor`, INJECTED
  as `emit`, and compared. **The policy comparison is EXACT and the grant
  comparison is ONE-SIDED**, and the asymmetry is deliberate: every apply DROPs
  and re-CREATEs policies from the declaration, so the live policy IS the
  fingerprint — while a site that has had no schema change since 2026-09-13
  still carries table-wide write grants the next apply narrows. **With no `emit`
  every recovery is `uncertain`.**
- **A POLICY FINGERPRINT MUST NOT ERASE WHAT A POLICY MEANS.** A shape answering
  the SET OF FACTS a predicate mentions gave `IS NULL` and `IS NOT NULL` the
  same answer, and `AND` the same as `OR`. It is a CANONICAL BOOLEAN TREE:
  `AND`/`OR`/`NOT` are structure, each operand keeps its own text, `AND`/`OR`
  operands are SORTED (both commutative), and **what is normalised away is only
  what POSTGRES ITSELF rewrites**. A predicate this cannot parse is REFUSED,
  never compared, and **a refusal must never fold into the `""` an ABSENT clause
  answers**.
- **THE LEXER RUNS ON THE RAW TEXT, ONE TOKEN AT A TIME.** A regex over the
  whole string cannot tell a quoted identifier from the word it spells:
  `"true"` (a boolean column named `true`) folded to `true`, AND's identity, and
  took a whole conjunct with it; `'APPROVED'` became `'approved'`;
  `other_table.col` became `col`. **`SYNTAX_WORDS` is DERIVED FROM THE
  COMPARATOR** (`BOOL_WORD ∪ {not, true}`), not from Postgres's reserved list,
  and **the unquoting is SYMMETRIC**, which is what makes that sufficient.
  **EACH EQUIVALENCE IS MEASURED AND THERE ARE EXACTLY TWO**: our emitter writes
  8 distinct predicates across all 16 cells and **ZERO casts**, so `::text`
  directly after a string literal is dropped and nothing else is; and a
  qualifier naming **the table the policy is ON** is dropped and no other —
  **with no table name nothing is stripped.**
- **FOUR THINGS ONLY A REAL POSTGRES COULD HAVE SAID**, each a defect in code
  that read correctly: `information_schema.column_privileges` EXPANDS a
  table-level grant across every column; the predicate fingerprint kept the
  TABLE QUALIFIER (`"notes"."owner_id"` against `(owner_id = …)`) and **no
  fixture would have shown it, because a fixture writes both sides in one
  hand**; `GRANT INSERT ("body","title"), UPDATE ("body","title")` split flat
  into the column `"update(title"`; and **`payment` is an OBJECT, not a
  boolean**, so the probe's first `payment: true` fixture created no payment
  columns and the arm passed while proving nothing.
- **AND THE SWEEP FOUND A FALSE ALARM IN THE FIX.** The payable refusal keyed on
  all five `PAYMENT_COLUMNS`, so a `display` price list declaring `currency`
  read as payable. `currency` and `amount_total` are ordinary words a designer
  writes; `payment_status` is not, and the engine creates all five together.
- **IDENTITY IS THE AUTHORITATIVE MAPPING, AS A CHAIN FROM THE SLUG OUTWARD**:
  the `site_project` row found UNDER THIS SLUG → a connection NAMING
  `dbNameForSite(slug)` → `SELECT current_database()` agreeing. Comparing the
  catalog with `_meta` FROM THAT SAME DATABASE establishes only that it is
  internally CONSISTENT. **Every link is required and there is no "probably"**:
  `ok === proven` always. **The wall is in `writeRef`, not at its call site.**
  **And `site_project.neon_conn` is the PROJECT's connection**, whose path is
  `/neondb` on every real row — so the resolution moved INTO `survey`, the one
  place holding the project row and the intended name at once, and *the thing
  proved and the thing queried cannot come apart again*.
- **THE THREE TASKS ARE SEPARATE.** `workList` covers `ready` **and**
  `incomplete`, because **every site is `ready` the moment its reference is
  repaired** — a filter on `backfill` made the rerun the run that can never
  finish the job.
- **`--verify` MUST EXIT NONZERO ON A FAILED POSTCONDITION.** Both scripts
  printed a failure and exited **0**, which any shell, runbook or workflow step
  reads as a pass. **In verify mode "nothing to do" is not a pass**, and it
  falls THROUGH to the tally so one place decides. **An exit code is not
  observable from inside the module**, so `test/repair-commands.test.mjs` spawns
  both as real PROCESSES with ONE `globalThis.fetch` preloaded — Supabase is
  plain `fetch` and Neon is `fetch` over HTTP, so nothing is re-implemented; the
  scenario is a JSON file the preload writes back on exit, because
  apply → verify → repeat is three PROCESSES.
- **AND A STEP THAT PIPES INTO `tee` REPORTS TEE'S STATUS** unless the shell is
  said out loud. GitHub's UNSPECIFIED Linux shell is `bash -e {0}` — `set -e`
  with **no `pipefail`**. **MEASURED with a stub exiting 1: under `bash -e` the
  step exits 0; under `shell: bash` it exits 1; the log is byte-identical (73
  bytes) either way.** This is the `--verify` defect one layer up, and the two
  walls are independent. **PROVEN LIVE** by `backend repair` run 5, the first
  failing run of either workflow.
- **ABSENT TABLE AND ABSENT ROW ARE SEPARATE CASES.** The `_meta` write was one
  `INSERT … ON CONFLICT`, so the `tables-without-metadata` state — the one the
  recovery exists for — was correct and unwritable. `META_TABLE_SQL` is exported
  from `site-schema.mjs` and `applySiteSchema` uses it too, so a repair cannot
  create a `_meta` the platform would not have.
- **THE SCOPE IS A WALL IN THE SCRIPT.** `REPAIR_SITES` names five sites by hand
  and `workList` asks it FIRST; a `--slug` off the list is refused BY NAME with
  exit 2 and nothing is read — **a silent filter prints "nothing to do", which
  reads as "that site was already fine"**, the one answer a person running a
  repair must never get by accident.
- **`--apply-reference` IS A MODE, NOT A SECOND INPUT.** A flag beside `--apply`
  would be a two-field invariant, and a forgotten flag fails OPEN.
  `WRITES_REFERENCE` and `WRITES_META` are two frozen lists and both gates read
  them and nothing else; **an unknown mode writes NOTHING**. **WITHHELD IS NOT
  NOT-YET**: a preview reports what an apply WOULD do, `apply-reference` what it
  DELIBERATELY DID NOT on a run that wrote something else, tallied separately so
  `0 schema(s) recovered` cannot be misread. The confirm gate uses
  `startsWith(mode, 'apply')` deliberately — a list of two names would be a
  second copy of the first, and a prefix test errs toward DEMANDING confirmation.
- **A FORM VALUE COULD SELECT THE MODE, PAST THE APPROVAL GATE.** The step built
  ONE string and expanded it unquoted, so `column="drop_off_day --apply"` word-
  split into more arguments and the LAST mode flag won — while the confirm gate
  had seen `counts`. **The gate and the parser were answering about different
  runs.** Two walls, measured independent: a quoted bash ARRAY, and `parseArgs`
  REFUSING rather than guessing (two different mode flags, the same flag twice,
  a value missing or shaped like a flag, an unrecognised argument — **never
  silently ignored**), answering `{…, error}` and refusing with **exit 2 ABOVE
  the credential check**, because the argv is what the caller can fix.
- **A NARROW READ-ONLY AGGREGATE.** `--counts` groups by a column, and it
  **cannot return a name** by two properties rather than by discipline: the mode
  is on neither write list, and the grouping column must be a **DATE OR TIME
  type asked of the catalog** — a positive, type-derived rule, never a deny-list
  of column names. `GROUP BY 1 ORDER BY 2 DESC, 1` by ordinal. **Widening
  `COUNTS_TYPES` to text is the wrong fix** — the type rule is the entire reason
  `customer_name` cannot be grouped — and **a cast is worse**, because Postgres
  quotes the offending VALUE in its error. The one narrow exception is an exact
  triple (`repairbench-1` · `bookings` · `drop_off_day`), asked only after the
  general rule refuses, with the value projected through a SHAPE regex so an
  unusable value never leaves Postgres, `bad` separating "not date-shaped" from
  a genuine NULL, **a failed read reported by SQLSTATE and never by message**,
  and the arithmetic printed so it can be seen to close.

### `search_path` — the premise was wrong, and the fix is one clause

**THE PREMISE THAT KEPT IT OPEN WAS FALSE.** The earlier probe said the
escalation needs a caller who can put a schema ahead of `public` AND create an
object in it, and measured four `CREATE` privileges to say nobody can. **The
four checks are true and the premise is incomplete**: `TEMP` on the database is
granted to **PUBLIC by Postgres's own default**, and an unlisted `pg_temp` is
searched **FIRST** for relations — so the caller never touches their own
`search_path` either. **MEASURED on a real PostgreSQL 16**: a role refused
`SELECT` on the table outright creates `pg_temp.bookings` and the definer
function counting the owner's three rows answers **1**. Same for `plpgsql`, and
**same through an INVOKER callee** — so pinning only the definer leaves the hole
one hop along.

**NAMING `pg_temp` IS THE FIX. NAMING `public` IS NOT, AND THE TWO LOOK ALIKE.**
Measured: `SET search_path = pg_catalog, public` with an unqualified body is
redirected **exactly as an unpinned function is**. The guard asserts the ORDER
and the sweep mutates it. `FN_SEARCH_PATH = "public, pg_temp"` on every model
function (definer AND invoker) and every trigger function; `pg_catalog, pg_temp`
on the three identity helpers — those three were SAFE, but **safe only because
every relation in their bodies is schema-qualified**, an argument about the
bodies that expires the first time one is edited.

- **14 OF THE 15 FUNCTIONS THE ENGINE CREATES PINNED NOTHING.** The platform's
  own Supabase side is clean: 69 functions, **0** unpinned definer functions —
  the one grep hit was the phrase inside a COMMENT.
- **THE PIN TRUSTS `public`**, so "public is not writable by untrusted roles" is
  a requirement this KEEPS, not a premise it retired. Case 9 pins the trusted
  set to exactly `["public", "pg_temp"]`. Whether a writable `public` is
  exploitable UNDER this pin is **UNMEASURED** — a draft tried and could not.
- **THE SCOPE, measured twice**: `app_user_id()`/`app_team_id()` and every
  trigger function are RE-PINNED on a site's next schema change; **every
  model-written function is NOT TOUCHED, not now and not ever**, because
  `_meta.functions` stores no body and `normalizeSchema` drops a bodiless
  function. **And that last row is the high-value half**, since the model's
  functions are the `SECURITY DEFINER` ones GRANTed to `anonymous`. The one path
  that reaches them is an addon that RE-DECLARES with a body.
- **THE REACH IS LAZY AND PER-SITE.** `applySiteSchema` has three callers and
  all three are customer-driven; **no customer database is touched by this**.
  And `_meta.functions` carries no body and no config, so **a stored spec can
  never say whether a site's live functions are pinned** — `pg_proc.proconfig`
  is the only reader.
- **THE PROBE'S OWN CONTROL MUST BE AN IMMUTABLE COMMIT.** `OLD_REF` defaulted
  to `HEAD`, so the moment the fix was committed every BEFORE case inverted and
  the probe reported the PIN as broken; moving it to `origin/main` is the same
  defect deferred to merge day — which is exactly when somebody re-runs the
  documented command. **The property is IMMUTABILITY**: every moving form is a
  NAME, and a hex object id is the only thing git will not re-point. The
  run-time refusal is KEPT beside the sha, because the two answer different
  questions, and **the two guards are split the same way** and proved in both
  directions (an immutable but POST-fix sha passes one and fails the other).

### The write grants are column-scoped (2026-09-13)

**THE INSERT HALF WAS THE WIDER ONE AND AN EARLIER PASS CALLED IT A PASS.** That
reading asked *can a member UPDATE this table at all*, the right precondition
for UPDATE and the wrong question for INSERT: `write: anyone` — the `collect`
preset, **the commonest table this platform builds** — emitted `GRANT INSERT ON
"<t>" TO anonymous`, table-wide, to a visitor signed in to nothing.

```
GRANT INSERT ("name", "email", "detail") ON "requests" TO anonymous;
GRANT SELECT, DELETE ON "requests" TO authenticated;
GRANT INSERT ("title"), UPDATE ("title") ON "requests" TO authenticated;
```

- **POSTGRES HAS TWO GRAMMARS AND THEY CANNOT BE MIXED** — `GRANT SELECT, INSERT
  (a)` is a syntax error. `DELETE` takes no column list; **`SELECT` stays
  table-wide deliberately**, because a member must read `id` and `created_at` to
  render a row.
- **A GRANT, NOT A TRIGGER.** A BEFORE INSERT trigger forcing the managed columns
  would re-state every DDL DEFAULT in a second place.
- **`writableColumns(t, created)` USES THE REALLY-CREATED LIST**: a GRANT naming
  a column the table has not got fails WHOLE, and one absent name would leave a
  site silently refusing every form submission.
- **REVOKING A TABLE PRIVILEGE AUTOMATICALLY REVOKES ITS COLUMN PRIVILEGES**, so
  the `REVOKE ALL` pair at the head of `grantsFor` covers a table moving
  `user` → `display`. **That pair is why this is worth anything on a live
  site**: Postgres keeps BOTH levels and the table-level one still covers every
  column, so a narrow grant added beside the old one would change nothing.
- **MEASURED over all 16 read×write cells**: PASS for `write: none` and
  `write: anyone` (every payment column is in this class, a payable table being
  taken out of the write grants entirely); FAIL for `write: own` and
  `write: members`, where the UPDATE policy names only `owner_id` so `id`,
  `created_at`, `updated_at` and the flag columns had nothing in the SQL
  stopping a member writing them — on `members`, **any row**. **The answer
  depends only on the WRITE axis**, pinned.
- **THE INFERENCE IS CLOSED BY A REAL POSTGRESQL 16** —
  `test/integration/local-pg-grants.mjs`, **29 cases, no Neon, no network**, and
  **nothing typed in it**: the DDL comes out of the real `applySiteSchema` and
  the OLD grants come out of GIT at run time, so the "existing table" half is
  the state a real pre-fix apply LEFT. **`owner_id` and `deleted_at` were
  already out of reach and RLS is why** — said out loud rather than letting the
  fix take credit for a wall it did not build.
- **EVERY ANSWER IS READ FOR ITS REASON, IN BOTH DIRECTIONS**, because a refusal
  from the wrong gate reads exactly like the fix working. **And an ALLOWED that
  touched no row is not an allowed write**: `UPDATE … WHERE` matching nothing
  SUCCEEDS and RLS filters rows out in SILENCE — **three cases read as
  successful writes until the command tag was parsed.**
- **THE ON-SPLIT IS LOAD-BEARING**: the verb comes from BEFORE the `ON`, because
  `GRANT SELECT ON "update"` contains the word UPDATE. The two readings diverge
  on **7 of 16 cells** for that name and **0 of 16** for any other.
- **THE REACH: nothing triggers the fix on its own.** Per-site and lazy — an
  existing site keeps its table-wide grants until its owner next changes
  something schema-shaped, which may be never. **Open.**
  `scripts/grants-backfill.mjs` is ready (preview default, apply, verify,
  rollback; grants only; the column list the INTERSECTION of the stored schema
  and what the table really has; **verification has two halves**, because a table
  where the REVOKE landed and the GRANT did not satisfies the first and cannot
  take a booking). **Not run.**
- **THE INVENTORY: 70 sites, 31 with a Neon project, 39 frontend-only.**
- **ONE LIVE CREDENTIAL RULE.** The risk is not the deliberate log line; it is
  **a driver error whose MESSAGE quotes the URL it was handed**. `safeErr` is the
  one scrubber, and **the rule is the URL's own grammar rather than a list of
  secrets**: any `scheme://user:password@` becomes `scheme://***@`. A list has to
  be kept, and the one it misses is the one that leaks. **The HOST is
  deliberately kept.**

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

**READ THE LEDGER; DO NOT TRUST THIS LINE.** A stale number is worse than none,
because `buildFloor` refuses before spending and the refusal reads as a broken
build. **Balance 22** at run 24's end (2026-09-23, the replay: **46 → 22,
moved 24** — route 2 + the page rung's 22, closing exactly, on a run that
published), and **run 25's free press read 22 again** (09:17Z, nothing spent
between). **Balance 3** at run 26's end (2026-09-23, the correction: **22 → 3,
moved 19** — route 2 + the page rung's 17, closing exactly, on a run that
published). **Balance 46** at run 23's end (2026-09-23: **48 → 46, moved 2** — the
routing call; the edit escalated `no-page` at `cost: 0` and nothing published;
run 22's free restore read 48). **Balance 48** at run 21's end (2026-09-22, the places-left replay:
**65 → 48, moved 17** — route 2 + the page rung's 15, closing exactly, on a run
that published; runs 18–20 were free and read 65 each). **Balance 65** at run
17's end (2026-09-22, read by the canary at both
ends: **75 → 65, moved 10** — route 2 + the page rung's 8, the arithmetic
closing exactly, on a run that published). Before it, **balance 75** at run
14's end (2026-09-21: 77 → 75, **a NET movement of 2**, on a run whose outcome
the harness could not read; see run 14 below). **⚠ A NET MOVEMENT IS NOT A CHARGE
HISTORY** (owner, 2026-09-21): 2 is equally consistent with a routing call of 2
and with a routing call of 2 beside an edit charged 20 and refunded 20, and
only `edit_jobs.billing` and the `credit_events` rows separate them. **Every
figure on this line is a net reading** and the same caution applies to all of
them.
**✅ AND FOR RUN 14 THE LEDGER HAS NOW BEEN READ AND THE TRUE ANSWER IS A
THIRD VALUE** (read-job run 15, 2026-09-21T23:56Z): `billing: refunded,
cost 2`, with `reserve −2 after 73` and `refund +2 after 75` — so
**77 → 75 → 73 → 75**, a routing call of 2 beside an edit **charged 2 and
refunded 2**. **Neither guess named it**, which is the strongest form of the
rule this line states: a net reading does not merely fail to *choose* between
two histories, it can be consistent with a history nobody listed. The balance
of **75** is unchanged and now has a second, stronger reader behind it. Run 12 ended at 77 (79 → 77, net 2) — and **that one has a second,
stronger reader**: its terminal body states `cost: 0` for the edit in the
route's own words, which a balance cannot. Run 11 ended at 79 (101 → 79, net 22)
and run 9 at 101 (105 → 101, moved 4). It was 119 at run 52's end on
2026-09-20 and **14 went somewhere this session did not spend** — run 9's free
press read 105 before anything paid ran, which is exactly the reading a stale
line cannot give you. `GET /api/fal-balance` answers fal's, separately and
free.

- **The building account is `aniascristian@gmail.com`**, not the session's own
  address. It owns every live site and holds that balance. Look at the wrong row
  and the balance reads as zero.
- **Owner's live sites**: `northgroup-5`/`-9`…`-17`, `markbook-1`, `shoeroom-1`,
  `repairbench-1`, `fretwork-1`, `ashgrove-1`, `washhouse-1`,
  `ben-crowe-guitar`, plus older `fold-lane-bakery`, `harbourside-roast`,
  `the-lido-cafe`, `oak-and-ash`, `forno-and-co`. **Reusing one of those slugs
  REVISES that site.**
- **ON-PAGE PHOTOGRAPHS, measured SITE-WIDE** (walking every route in each
  sitemap and counting DISTINCT `<img src="/u/<slug>/…">`, which is what
  `photoUrls` counts; `og:image` excluded, since it is a share card and not a
  picture on a page): `fold-lane-bakery` **3**, `oak-and-ash` **3**,
  `shoeroom-1` **2**, `forno-and-co` **1**, everything else **0** —
  `fretwork-1` and `ashgrove-1` included, `ashgrove-1`'s one `/u/` url being
  og:image ALONE. **⚠ Three of these were once stamped as HOME-PAGE readings
  beside a SITE-WIDE route list**, which reads as a site-wide claim and is not
  one. **A COUNT OF `<img>` IS THE WRONG INSTRUMENT** — `fretwork-1` reads 3
  with zero photographs.
- **A BUILD AND A REVISE COST DIFFERENT MONEY, BOTH MEASURED.** A first build on
  grok is **11 to 45 credits** — run 91 (`coalhole-2`, one page, 8,967 chars, 0
  photographs) cost 11 and run 80 (`ashgrove-1`, one page, 2 photographs) cost
  45 — so **quote a range or measure the run**. A REVISE of the same site is
  **17**, because it anchors to the stored design. Addon runs measured: pageless
  **2** (run 52) and **3** (run 50), `function`+`page` **12** (run 49),
  `table`+`function`+`page` **13** (run 47), `page`+`qr`+a refused photograph
  **13** (run 51). **Nothing records what a build costs** — `gen_charges` is the
  media side's image ledger and `site_builds` has no cost column — so the
  balance before and after IS the measurement. **And ONE addon request makes
  SEVERAL sequenced reservations** with nothing summing them; `edit_reserve`
  raises only above **100,000**, so **no server-side per-request cap exists** and
  the account balance is the only bound that binds.
- **Analytics is collecting** since the CSP fix on 2026-08-15: 451 pageloads in
  the 7 days to 2026-08-28 across ~25 hostnames. `rum report` reads it free.
- **`site build` is 382/382, and SIXTEEN INDEPENDENT CI RUNS HAVE READ IT**
  across 2026-09-12 → 09-20, with kit-typecheck 4, contrast-cases 16,
  theme-seam 11, theme-render 29, site-routing 14, site-runtime 47 beside it and
  kit-render / kit-a11y / kit-effects / kit-paint each `all passed` with no
  count — **the three result SHAPES a census has to ask for**, since a scan for
  `N passed` alone finds seven of twelve and silently reports the other five as
  absent. **DERIVE the run count with a scan rather than taking the next ordinal
  in a sentence** — the chain drifted once with two entries both claiming "the
  twelfth" — and note that run 1065 read **373** and run 1115's count is
  recorded UNREAD, so neither is one of them. **The unit step's TAP is 397**,
  and it moved from 396 at `c2f6bb66` with nothing stamping it, because the two
  runs between were a docs commit and a run that failed at `npm ci`.
  **A count nobody re-measured is a claim ahead of its evidence in BOTH
  directions**: 382 was once stamped from a LOCAL run and the next CI read of it
  came back **381 passed, 1 failed** — the harness's own hardcoded fan-out
  ceiling, not the product.
  **AND THIS BRANCH HAS ITS OWN READS, NAMED RATHER THAN COUNTED**: run
  `35503280850` on `ecd3184d`, run **`35542140721` on `903b5ea2`**, run
  **`35545181566` on `0523dfb1`**, run **`35546983002` on `e0540f37`**
  (2026-09-21, 23m54s), run **`35554760166` on `38d934a2`**
  (2026-09-21, 02:36:53 → 03:00:33Z, **23m40s**) and run **`35574816749` on
  `0d15ab4c`** (2026-09-21, 07:49:53 → 08:11:28Z, **21m35s**) — all six **all
  twenty steps green and every figure above matching**: TAP 397, kit-typecheck 4,
  site-build **382**, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47, and kit-render / kit-a11y / kit-effects /
  kit-paint `all passed`. The second was read out of the twenty-three downloaded
  per-step files rather than the flat log, so the attribution is the
  archive's own; the fifth and sixth were read landmark-to-landmark off the flat
  log, **all twelve counts in one pass with every shape asked for separately**,
  and both came back step by step in the workflow's own order. **The sixteen is
  deliberately NOT incremented**: that number is a scan's answer, and the rule
  two lines up is exactly about taking the next ordinal instead of re-deriving
  it. (**"All six" IS auditable** — it is a count of the named runs on this
  line, which is a different kind of number from a scan's.)
  **THE CENSUS OF SHAPES IS THE OBSERVER'S OWN PROOF, and on run 1238 it closes
  exactly**: `N passed` **7** + `all passed` **4** + TAP **1** = **12**, the
  twelve steps that report. A scan finding eleven has lost one silently, and
  the sum is what says it has not.
  **⚠ 21m35s IS ~2 MINUTES UNDER THE OTHER TWO READS AND IS RECORDED RATHER
  THAN EXPLAINED.** Every count matched, so it is runner speed rather than work
  skipped; there is no per-step baseline from the earlier runs to compare it
  against, and inventing one would be arithmetic off a paragraph.
  **⚠ A GREEN `site build` CARRIES TWO `##[error]` ANNOTATIONS, AND THEY ARE THE
  HARNESS DOING ITS JOB.** GitHub annotates any line in `tsc`'s own error format,
  and `site-build.mjs` deliberately builds a page with a type error to prove
  *"tsc REPORTS; only `vite` refuses"* — measured on run `35554760166`:
  `src/routes/index.tsx(50,13) TS2322` and `src/routes/menu.tsx(27,17) TS2339`,
  each immediately followed by its own `ok` line, inside the step that ends
  **382 passed, 0 failed**. **A scan for red words answers TWO on a run whose
  conclusion is `success`**, so read what the annotation sits next to rather than
  counting it. (`SSR stream transform exceeded maximum lifetime (120000ms)` is
  the same shape, twice, and is also inside passing cases.)
- **READ THE COUNTS OUT OF THE RUN'S PER-STEP LOG FILES**, which attribute by
  construction rather than by a window somebody drew. The flat-log alternative
  is landmark-to-landmark (`##[group]Run …` to the NEXT one, because GitHub
  wraps only the command echo and the OUTPUT follows `##[endgroup]`), and the
  two agree exactly — the same twelve steps, the same counts. **A census that
  anchors TAP at the start of a line finds eleven of twelve**, because a GitHub
  log line carries a timestamp prefix.
- **THE JOB HAS TWENTY STEPS AND THE API ANSWERS 23** — three are GitHub's own
  (two `Post …` and **`Complete job`**, which is not named like one), so
  `len(steps)` and a `startsWith("Post ")` filter both answer wrongly.
- **Unit suite: 7,119, BOTH HALVES TAKEN** (2026-09-21, the unprinted
  transaction lines) — locally `# tests 7119 / # pass 7119 / # fail 0 /
  # skipped 0`, `duration_ms 111,953`, and CI run **`35667246371` on
  `66c45d0f`** at **`# tests 7119 / # pass 7115 / # fail 0 / # skipped 4`**,
  `duration_ms 112,524`. **THE TOTAL IS WHAT MATCHES** — 7,119 both sides,
  `pass` differing by exactly CI's own four skips. **The +1 is the difference
  between two measured readings**, 7,118 → 7,119: the one case asserting a
  readable ledger prints a line per row.
- **Unit suite: 7,118, BOTH HALVES TAKEN** (2026-09-21, the reader's own wiring
  hole) — locally `# tests 7118 / # pass 7118 / # fail 0 / # skipped 0`,
  `duration_ms 112,388`, and CI run **`35666256160` on `e7f0e82f`** at
  **`# tests 7118 / # pass 7114 / # fail 0 / # skipped 4`**, `duration_ms
  113,629`. **THE TOTAL IS WHAT MATCHES** — 7,118 both sides, `pass` differing
  by exactly CI's own four skips. **The +2 is the difference between two
  measured readings**, 7,116 → 7,118: the census over the REAL Supabase getter,
  and the case driving all three reads against a non-list body.
- **Unit suite: 7,116, BOTH HALVES TAKEN** (2026-09-21, the unreadable-ledger
  correction) — locally `# tests 7116 / # pass 7116 / # fail 0 / # skipped 0`,
  `duration_ms 113,677`, and CI run **`35665789941` on `04f1897c`** at
  **`# tests 7116 / # pass 7112 / # fail 0 / # skipped 4`**, `duration_ms
  106,086`. **THE TOTAL IS WHAT MATCHES** — 7,116 both sides, `pass` differing
  by exactly CI's own four skips, which is this file's standing reading of that
  gap and not a regression. **The +6 is the difference between two measured
  readings**, 7,110 → 7,116: `test/canary-read-job.test.mjs` goes 20 → 26
  cases, the six being the unreadable-read loop (three shapes), the
  missing-read argument, the non-list-200, the PRINTED ACCOUNT under a failed
  read, the successful-empty CONTROL, and the no-rows-listed-under-a-refusal
  case.
- **Unit suite: 7,110, BOTH HALVES TAKEN** (2026-09-21, the read-only job
  lookup) — locally `# tests 7110 / # pass 7110 / # fail 0 / # skipped 0`,
  `duration_ms 112,947`, and CI run **`35659172717` on `f662d68d`** at
  **`# tests 7110 / # pass 7106 / # fail 0 / # skipped 4`**, `duration_ms
  113,158`. **THE TOTAL IS WHAT MATCHES** — 7,110 both sides, `pass` differing
  by exactly CI's own four skips, which is this file's standing reading of that
  gap and not a regression. **The +20 is the difference between two measured
  readings**: `test/canary-read-job.test.mjs` arriving with twenty cases.
  **AND THE STAMP CHAIN'S OWN ENDPOINT AGREES**: `283046ba`, the last commit
  that moved a test or product file, reads **`7110 / 7106 / 0 / 4`** on CI run
  **`35659338080`** — the ref-shape correction added an ASSERTION to an
  existing case, so it moved the count by zero, and a current-and-parent pair
  off the same machine is what settles that rather than an argument about what
  an assertion costs.
- **Unit suite: 7,090, BOTH HALVES TAKEN** (2026-09-21, the run-14 harness
  corrections) — locally `# tests 7090 / # pass 7090 / # fail 0 / # skipped 0`,
  `duration_ms 117,987`, and CI run **`35655515164` on `c0dcd60e`** at
  **`# tests 7090 / # pass 7086 / # fail 0 / # skipped 4`**. **THE TOTAL IS
  WHAT MATCHES** — 7,090 both sides, with `pass` differing by exactly CI's own
  four skips, which is this file's standing reading of that gap and not a
  regression. **The +12 is the difference between two measured readings**:
  `test/canary-watch.test.mjs` arriving with twelve cases. The re-anchored
  `edit-canary` guard added none — it is the same case asserting the same
  property through a wider landmark.
- **Unit suite: 7,078 LOCALLY, and the CI half of THAT reading is UNREAD** —
  `# tests 7078 / # pass 7078 / # fail 0 / # skipped 0`, `duration_ms 111,643`,
  taken 2026-09-21 on the three bounded corrections. **The +7 is the difference
  between two measured readings**: `edit-rules-backend` goes 8 → 15 cases.
  `site-owner`'s re-anchored guard added none — it is the same case asserting
  the same property through a window instead of a line. **Say which half is
  taken**: a local number beside an unread CI run is ONE reading.
  **⚠ AND THE FIRST RUN OF IT WAS 7,078 WITH ONE FAILURE**, which was a
  PRE-EXISTING guard going red on a COMMENT — see the re-anchor above.
- **Unit suite: 7,071, BOTH HALVES TAKEN** (2026-09-21, the run-12 product
  fixes) — locally `# tests 7071 / # pass 7071 / # fail 0 / # skipped 0`,
  `duration_ms 111,743`, and CI run **`35574816773` on `0d15ab4c`** at
  **`# tests 7071 / # pass 7067 / # fail 0 / # skipped 4`**, `duration_ms
  113,310`. **THE TOTAL IS WHAT MATCHES** — 7,071 both sides, with `pass`
  differing by exactly CI's own four skips, which is this file's standing
  reading of that gap and not a regression. **The +14 is the difference between
  two measured readings, never arithmetic off a paragraph**: 7,057 → 7,071 is
  this round's own fourteen — eight in `edit-rules-backend` and six in
  `ask-router-display`.
  **⚠ AND THE FIRST RUN OF IT WAS 7,070/1.** Two PRE-EXISTING guards went red
  on honest changes, and neither was appeased: `site-apply`'s was pinned to the
  spelling `if (!rdb) return escalate("no-backend")` and `site-delete`'s to an
  EXACT COUNT of `eAnswer` call sites (`=== 2`). Both re-anchored on the
  property they describe. *A guard pinned to a spelling reports an honest
  change as the feature going away* — twice in one round, in guards written by
  earlier sessions of this same work.
- **Unit suite: 7,057 LOCALLY, and the CI half of that reading is UNREAD** —
  `# tests 7057 / # pass 7057 / # fail 0 / # skipped 0`, `duration_ms 111,992`,
  taken 2026-09-21 on run 12's docs-and-guards commit. 7,053 → 7,057 was that
  round's own four cases — three escalate-action cases in `edit-browser-reply`
  and one capture-wiring case in `edit-canary`.
- **Unit suite: 7,053, BOTH HALVES TAKEN, AND THE DOCS COMMIT MOVED IT BY ZERO**
  (2026-09-21, run 11's docs). **CI runs 2862 (the parent) and 2864 (the
  current) BOTH read `7,053 total / 7,049 passed / 0 failed / 4 skipped`** —
  the parent-and-current pair is what settles *the docs change did not increase
  the count*, and it is a stronger reading than a local baseline because both
  halves come off the same machine. Locally the same tree reads
  `# tests 7053 / # pass 7053 / # fail 0 / # skipped 0`, `duration_ms 111,174`.
  **⚠ AND THE THREE READINGS ARE THE CLEANEST DEMONSTRATION THIS FILE HAS OF
  *THE TOTAL IS THE ONLY COMPARABLE NUMBER*.** One tree, one day, **three
  different pass/skip splits and ONE total**: the main checkout `7053/0`, a
  worktree at the parent `7051/2`, CI `7049/4`. A stamp comparing `pass` would
  have reported a two-test regression against the worktree and a four-test one
  against CI, and **neither exists**. What moves is the SANDBOX — a worktree's
  linked `node_modules`, CI's own four — never the suite.
  **⚠ AND THE +1 AGAINST THE PREVIOUS LOCAL READING OF 7,052 IS UNEXPLAINED AND
  PREDATES THIS COMMIT.** 7,052 was taken earlier the same day after the
  edit-canary work (`# tests 7052 / # pass 7052 / # fail 0 / # skipped 0`, the
  four being that round's own cases in `test/edit-canary.test.mjs`, 7,048 →
  7,052). Every commit between it and `4e2c076a` is docs-only, and the two
  tests that PARSE `docs/owner-notes.md` read **31/31 on both sides**, so the
  docs are ruled out as the cause. **It is recorded as unexplained rather than
  reconciled and NO further investigation is owed** (owner) — a count nobody
  can attribute is not a count to argue from, and the parent/current CI pair
  already answers the only question the milestone needed.
- **Unit suite: 7,048, BOTH HALVES TAKEN** (2026-09-21) — locally, and CI run
  **`35554760170` on `38d934a2`** at **`# tests 7048 / # pass 7044 / # fail 0
  / # skipped 4`**. The eight are this round's own: five tweak-rung cases, the
  `sameProse` bypass census, and the two scoped-wording cases — **stated as the
  difference between two measured readings**, 7,040 → 7,048, never arithmetic
  off a paragraph.
  **⚠ AND THE LOCAL RUN READ `# skipped 0` WHERE CI READ 4 — MEASURED ON THIS
  VERY PAIR, and it is the cleanest demonstration this file has of why THE
  TOTAL IS THE ONLY COMPARABLE NUMBER.** Every earlier local run read 4 as
  well, so the sandbox moved rather than the suite; `pass` differed by exactly
  those four (7,048 against 7,044) while the totals were equal. A stamp
  comparing `pass` would have reported a four-test regression that does not
  exist.
  The reading before it had both halves at **7,040** — locally, and CI run
  **`35547698419` on `9a56cacc`** at **`# tests 7040 / # pass 7036 / # fail 0
  / # skipped 4`**. The two readings before that also agreed both ways: **7,038**
  locally and CI run **`35546983030` on `e0540f37`** at
  **`# tests 7038 / # pass 7034 / # fail 0 / # skipped 4`**; before that
  **7,033** locally and CI run **`35545181576` on
  `0523dfb1`** at **`# tests 7033 / # pass 7029 / # fail 0 / # skipped 4`** —
  the four being the privilege-drop case, two RTL cases and
  `site-searchpath`'s baseline-commit case. **THE TOTAL IS WHAT MATCHES** — a
  `pass` count alone drifts between the two machines by exactly those four —
  and there the totals were equal, 7,033 both sides. The two before that:
  **7,026** on `903b5ea2` (CI run `35542140722` at `7,022 / 0 / 4`) and
  **7,005** on `2c596bc5` (CI run `35504473370` at `7,001 / 0 / 4`).
  **EACH STEP IS THE DIFFERENCE BETWEEN TWO MEASURED READINGS**, never
  arithmetic off a paragraph: 7,033 → 7,038 is five new route cases in
  `edit-page-protect`, and 7,038 → 7,040 is the two the silent partial needed;
  the +7 before all of them was that file arriving.
  **THE `7,022 / 0 / 4` WAS WRITTEN HERE AS AN EXPECTATION AND BECAME A
  MEASUREMENT, and only the second kind is worth anything** — it happened to
  have been right, which is exactly the case where a paragraph quietly turns
  into evidence if nobody stamps the run that settled it.
  It was 6,992 at `26f52f95` and 7,005 before the edit-path work.
  **⚠ AND `9a56cacc` HAS NO `site build` RUN AT ALL, WHICH IS THE `paths`
  FILTER AND NOT A MISSING RUN** — it touched `CLAUDE.md`,
  `docs/owner-notes.md`, `public/chat.js`, `scripts/addon-sweep.mjs` and two
  unit test files, and **not one of those is in `site-build.yml`'s `paths`**
  (`builder/**`, `worker.js`, root `*.mjs` — `scripts/*.mjs` is NOT root —
  `Dockerfile`, `.dockerignore`, `package.json`/`-lock`, the workflow's own
  file, and **eleven `test/integration/` files plus `test/page-gen.test.mjs`
  NAMED ONE BY ONE — not a `test/**` glob**, so a test file added anywhere
  else, this round's two included, fires nothing).
  **NO RUN, not a fast one**, the shape the deploy section records one layer
  up. The last commit touching those paths is `e0540f37`, whose run is stamped
  with the other three above. **Say which of the two it is by reading the
  commit's own file list against that `paths` block** — a listing with no run
  in it reads identically to a run that never fired.
  - **Run it as `node --test "test/*.test.mjs"`** — the quoted glob.
    `node --test test/` reads the directory as a MODULE path and answers
    `MODULE_NOT_FOUND` as one failing "test".
  - **In this sandbox the harness needs `playwright-core` at the root**
    (`npm i --no-save playwright-core@<the template's version>`), and **a
    worktree needs `node_modules` linked in** or four files answer `# tests 1` —
    one failing "test" is a file that would not LOAD.
  - **Run it with nothing else of its own already running**: a leftover
    `build-server.mjs` makes the new one's `listen` throw and every streaming leg
    report "0 reports arrived". Check `pgrep -a -f build-server.mjs` and kill by
    PID — killing the harness by PID orphans that child.
  - **MEASURE A BASELINE IN A WORKTREE; NEVER SUBTRACT FROM A PARAGRAPH.** A
    suite number derived by arithmetic off two remembered baselines has been
    wrong twice, each time closing against itself and against nothing else.
  - **THE STAMP CHAIN ENDS AT THE LAST COMMIT THAT MOVED A TEST OR PRODUCT
    FILE**, or it is an infinite regress: a docs-only push starts a run that
    reads the same number, which would want its own stamp. **A reading that is
    not new is where it stops** — but **read every run anyway**, because
    `brand-rename` and `media-deleted` PARSE `docs/owner-notes.md` and a
    docs-only push really can turn the suite red.
- **Default builder model is Grok** (`DEFAULT_PICKER`), ~3.5× cheaper than
  Sonnet on a comparable site and ~3× slower on the pages call.
- **A cold new account is one credit short of building**: `buildFloor(sonnet)`
  is 20, the grant is 20, and the routing call spends 1 first. Owner's call is to
  fund the test account rather than raise the grant.

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
  uses OVERLAY scrollbars (0px in precisely the case that moves);
  **⚠ "Chromium in this sandbox cannot reach a site host at all" WAS TRUE AND IS
  NOT (falsified 2026-09-21)** — a real Chromium opened
  `fold-lane-bakery.gofarther.app`, answered **NAV 200**, and read both
  photographs as loaded and visible with zero failed requests. It was recorded
  from a CSP render that read BROKEN both ways, and **a limitation nobody
  re-tested is a false negative about our own instruments**: it sat here long
  enough that a live-browser check went unattempted rather than unavailable.
  The CSP reading it came from is still the blind one;
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

- **`updated_at` IS NEVER BUMPED (open).** `site-schema.mjs:1121` creates it as
  a column DEFAULT whose own comment says "bumped on every UPDATE", and a
  Postgres default applies only when the column is OMITTED from an INSERT. There
  is no trigger and no statement anywhere that touches it on an update. **The
  live consumer is a GENERATED PAGE**: the kit's `Row` type declares
  `updated_at?: string` precisely because models wrote
  `deal.updated_at ?? deal.created_at` in two consecutive evals. So a site
  showing "last updated" shows the CREATION time for ever. **An earlier write-up
  justified this by `/changes?sync=`, which occurs exactly once in the tree and
  is inside a CODE COMMENT** — *a comment describing a consumer is not evidence
  the consumer exists*, and one grep settles it.
- **THE `sync` FLAG HAS NO READER AT ALL (open).** It creates `_deletes` and a
  tombstone trigger per table — real DDL emitted on every site that declares it
  — and `_deletes` is on `INTERNAL_TABLES`, denied to the browser, with no route
  serving it. Every byte of that machinery is unreachable from outside Postgres.
  Decide per the standing rule: build the reader, or delete the flag and its DDL.
- **FOUR SITES ARE STILL `incomplete`** — `ashgrove-1`, `fretwork-1`,
  `northgroup-5`, `washhouse-1`. Fixed in code (no new site can enter the state)
  and the repair is two presses each: `backend repair --apply-reference` then
  `--verify`. `repairbench-1` is repaired and verified. **The rules rung, the
  addon and (since 2026-09-22, deploy 2144) the page rung resolve these sites
  themselves**, so the blank column no longer costs an edit its rules; the
  repair is still the clean state. **⚠ THE FULL REVISE DOES NOT** — it reads
  `ownerConn` off `siteBackendRowFresh` (`conn: null` here), so a revise that
  declares no table rewrites every page of these four sites under the
  no-database rules. Read out of the code, not driven; the obvious fix reaches
  `ensureSiteBackend`'s heal, which is the owner's call.
- **THE TRANSLATOR CAN SEND PAGE CODE TO THE MODEL AND WRITE THE ANSWER BACK
  INTO THE CODE (open, found live on run 26; PARKED by the owner 2026-09-23).** `extractText`
  (`builder/site-text.mjs`) reads a `>` in page-level code as the end of a JSX
  tag, so `x >= 0 ? a : null; return (` became a "string" for
  `collectStrings`, was translated for each extra language, and was applied by
  `translatePages` into `/fr` and `/es`. The answer happened to be identical, so
  run 26's compiled code is intact in all three languages; a different answer
  would change the translated pages' logic, silently, on any edit that adds a
  `>` comparison outside JSX. Measure `extractText` over the corpus for code
  spans before changing it — it is also the reader `sameProse` stands on.
- **A JOB CANNOT HEAL A BLANK REFERENCE, BY ITS OWN GATEWAY'S RULE (read, not
  driven, recorded 2026-09-22).** `healSiteBackendDb` — called by the rules
  rung, the addon and `ensureSiteBackend` — is a `PATCH` on `site_backends`.
  Inside the container every service-key call goes through `gatewayFetch`, and
  `SB_TABLES` in `builder/job-gateway.mjs` lists no `PATCH` for any table. So
  from a job the heal is refused, and `healSiteBackendDb`'s never-throw contract
  turns that into a quiet `{ok: false, healed: false, status}`. **If that
  reading holds, only the `backend repair` workflow can heal these sites** — which
  matches all four still being blank. Settle it with one route test through the
  gateway before building on it.
- **THE BAND AND COMPONENT PROMPTS ASK A DIFFERENT QUESTION FROM THEIR OWN
  RULES (latent, recorded 2026-09-22).** `bandPrompt` and `partPrompt` choose
  the digest with `siteHasTables`, while the system block beside them comes from
  `pageRulesFor` → `siteHasBackend` — the 2026-09-14 correction `pagesPrompt`
  got and these two did not. A site with a function and no table would be told
  *"There is none"* under rules that say to call the functions the digest lists.
  **Unreachable today**: the split runs only on a first build (`bands:revise`),
  and a first build's design tool carries no `backend`, so its spec has no
  function. It becomes live the day either of those moves.
- **AN ADDON DESIGNS A TABLE THAT NOTHING CAN EVER FILL (reported, not
  refused).** `repairs` was declared `read:"none", write:"none"` — the `admin`
  pair — so no client grant is emitted **and `seedSiteRows` skips it**, that
  function seeding the `display` pair alone. **The SYMPTOM is gone** (the count
  function was moved onto `bookings` and `/status` reads 3) **and the DEFECT is
  not**: the table still has no writer and no seed, and the next addon choosing
  that shape gets the same table. The fix shape is a check at the cleaner, not a
  prompt. What shipped instead is a REPORT (`missingPopulation`), because *"no
  client write grant does not mean no writer"* — a seed, a function body, a job
  body or a client grant all count.
*(Two edit-path items closed here on 2026-09-20 — the component-deletion one
and the empty-frame one — moved up to the ladder's own section, because a
closed limitation left in a limitations list is a false negative about our own
product.)*
- **A WORKING `video-embed` IS INVISIBLE TO THE `data-slot` CENSUS (open).** It
  stamps the attribute on its FALLBACK branch alone, so **a video that WORKS is
  invisible and a BROKEN one shows up** — both consequences backwards. Two
  instruments go quiet: the `curl | grep -o 'data-slot=…'` reader and the css
  lane, which is required to target by `data-slot`. One attribute on the success
  branch's outer div; it is a kit file, so the deploy rolls the container.
- **EXISTING MODEL FUNCTIONS ARE NEVER RE-PINNED (open, kept SEPARATE at the
  owner's instruction).** Every model-written function on every site built
  before the `search_path` pin stays exposed, and those are exactly the
  `SECURITY DEFINER` ones granted to `anonymous`. **Not proposed, not written,
  no backfill run.** The shapes worth weighing: persist the body in `_meta` so a
  next change re-declares naturally (largest, and it puts model-written SQL into
  the stored spec); an `ALTER FUNCTION … SET search_path` sweep over `pg_proc`
  per site (needs a credential and the same preview/apply/verify discipline); or
  leave it on the reachability argument and record that the argument rests on a
  layer we do not own.
- **A REFUSED PHOTOGRAPH CANNOT NAME ITSELF TO ANYBODY WHO CAN ACT ON IT
  (open).** `genSitePhoto` throws `"photo " + status + " " + detail`,
  `makeSitePhoto` scrubs it onto `images.error`, and `imageNote` reads that
  field ONLY as a discriminator between four identical-looking placeholder
  outcomes — **it is never put on the reply**. The one surviving copy is
  `console.error` inside the container. So an empty provider balance, a wrong
  key, an outage, a timeout and a non-image answer all reach the owner as one
  sentence. *A failure that cannot name itself*, in the money path's decoration
  step.
- **SALVAGE CANNOT FIRE ON A NEW BUILD** and has not since `MAX_PAGES` became 1
  — the only page a new build has is the one page salvage will not replace. Both
  halves correct in isolation; nothing announced it. **Owner's call.**
- **THE QR RULE IS STRICTER THAN THE REST OF THE DESIGN STEP**, so a first build
  can almost never have one: `NEVER INVENT THE DESTINATION` while every other
  field invents placeholder detail freely. The machinery is not the limit; the
  rule is. **Owner's call.**
- **The availability calendar's own legend (open, live on `fretwork-1`).**
  `availability-calendar.tsx` prints "Each square is the night beginning on that
  date… Prices are per night for the whole property" — written for a
  self-catering let, now on a guitar diary. A legend the model must answer, or
  one that says nothing about the trade, fixes the class; a firmer sentence does
  not.
- **The price-unit mismatch (open, live on `ashgrove-1`).** A kit component
  documents "integer minor units"; the model feeds it major-unit rows, so one
  control says **£16.40** and the total says **£1880.00**. A branded type or a
  `deltaMinor` prop name fixes the class.
- **The raw-hex-colour finding (open, THIRD run running).** Runs 80, 82 and 83
  all reported it. Detected and reported on every build, never enforced, so it
  ships every time.
- **The dead-control finding (open).** On `northgroup-17` the stage filters,
  "New deal" and the deal rows are all `<a href="#pipeline">`, and 15 of 24
  in-page links point at the section they already sit inside — dead by
  construction, while the reply claims the filters run. A lint for a control that
  goes nowhere is the next thing.
- **Two client POSTs go to routes the Worker does not have (open).**
  `/api/site/scan` — the Security panel's "Run scan" button, which promises
  *"Opus is reviewing your code…"* and has no route (**a dead control that makes
  a promise**, and the sentence names Opus so even a real route would ignore the
  picker); and `/api/site/preview`, whose blob fallback means nobody notices.
  **Check first whether either is matched some other way** before deleting — the
  grep was for the literal string.
- **3D scenes ignore the theme colours (open)** — three.js cannot read oklch.
  Visible and low-contrast, NOT invisible.
- **Strings outside the page source are never translated (open, run 39).**
- **`env.EMAIL` daily quota is 200** across login codes AND every site's booking
  notifications. Worth watching, not yet a problem.
- **Static voice previews** — the owner drops MP3s at `public/voices/<name>.mp3`.
- **Real background removal** — needs a fal utility wired as an orchestrator
  step; blocked on a fal top-up.
- **Mobile layout for the app is deliberately NOT being done** (owner's call,
  desktop-first).

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
