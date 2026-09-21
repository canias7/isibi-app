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

**THE TIMING BAND, AND WHY NO INFERENCE FROM THE DIFF IS AVAILABLE.** Before
the skip: 14–15 minutes per deploy. After: a docs/test-only push is a
one-minute deploy that rolls nothing (**47 seconds** on deploy 2019, image step
1.4 s, both `reused`); a push that changes an image input is **~2m05s of image
and ~3m of deploy at best** (2044) and **~3m ordinarily** — **deploy 2138
(2026-09-20) sits exactly on that band: image step 2m06s, Wrangler 19s, whole
run 2m55s**, on a merge whose image inputs really moved. Layer reuse depends
on the GitHub runner's LOCAL Docker cache, and a runner is ephemeral with no
registry cache import — so **a cold runner rebuilds everything whatever the diff
touched** (2053: 2m56s, every layer rebuilt, on 2044's exact shape) and a FAST
step is no more evidence of a small diff than a slow one is of a large one
(2091: the template's `package.json` moved — as far above the worker tree as an
input gets — and it came in at 2m27s / 3m13s). Whether to import a registry
cache is open and unmeasured.

**THE IMAGE ID CAN BE COMPUTED BEFORE THE PUSH, AND IT IS WORTH MORE THAN
ANOTHER TIMING.** `containerInputs`/`imageId` are pure functions of the git
objects the Dockerfile COPYs, so running them over a ref answers what that
ref's image id WILL be — `git rev-parse <ref>:<path>` and `git show` are the
whole reader. **Cross-checked against reality ELEVEN times**, and the eleventh
is the strongest shape available — **deploy 2138 (2026-09-20) was PREDICTED
BEFORE THE PUSH**: the id was computed over the local merge commit
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
served-file check at all** — say so rather than glossing it. **And the Worker's
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
express the change. Cheapest first:

| Layer | What it changes | Cost |
|---|---|---|
| `text` | words in the page source | 1 |
| `data` | rows, and a list's ORDER | ~0.3 |
| `rules` | schema features enforced in Postgres or read from `_meta` | ~0.3 |
| `look` | the EDIT PATH — 21 lanes (see below) | 1 |
| `picture` | swap or reframe a photograph (matched on its alt text) | ~0.3 |
| `logo` | the header logo or tab icon — stored as that mark's `image` form | 0 |
| `nav` | menu, header button, footer contact/social/legal, in-body links | ~0.3 |
| `page` | one page's layout, via `tweak` (minimal patch) | ~1–3 |
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
  safe in both places — **and *"Nothing on your site changed and you haven't
  been charged"* is added by `wholeRequestNote` on the browser's
  complete-refusal branch**, the one reader that can see `ok: false` for the
  whole reply. That is not a guess: the merge sets `ok` from `ranOk.length > 0`,
  so a reply reaching that branch had no rung succeed and published nothing.
- **TWO CONDITIONS, EACH WITH ITS OWN JOB**: `e.ok` is the property (it may
  never fire on a reply that shipped, asked in the composer rather than trusted
  from the one call site), and `error === "withheld"` is the SCOPE — those are
  the sentences written to be completed this way, and every other refusal on
  the route carries its own wording, so firing on them would print the
  reassurance twice.
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
  `tsx` both dispatch to `page`, so one sentence runs the rung TWICE — and each
  run re-read the STORE. `publishStep`'s rule is "a later list wins", so the
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
  *nothing at all* is the outcome the clause exists to close.
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
  write something. **A GENUINE no-change still escalates and the rewrite still
  starts**, asserted as its own control, because a rung that simply stopped
  escalating would delete the ladder.
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
- **1 verb lane** — `pages`: `remove` and `move` are the `page` rung, `add` is
  the addon route. **No default** — an unreadable verb refuses, and this is the
  ONE place where the bias inverts, because a wrong guess takes a page off a
  site.
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
build. **Balance 119** at run 52's end (2026-09-20, read by the harness at both
ends: 121 → 119). `GET /api/fal-balance` answers fal's, separately and free.

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
  **`35545181566` on `0523dfb1`** and run **`35546983002` on `e0540f37`**
  (2026-09-21, 23m54s) — all four **all twenty steps green and
  every figure above matching**: TAP 397, kit-typecheck 4, site-build **382**,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47, and kit-render / kit-a11y / kit-effects / kit-paint
  `all passed`. The second was read out of the twenty-three downloaded
  per-step files rather than the flat log, so the attribution is the
  archive's own. **The sixteen is deliberately NOT incremented**: that
  number is a scan's answer, and the rule two lines up is exactly about taking
  the next ordinal instead of re-deriving it.
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
- **Unit suite: 7,048 LOCALLY and the CI half UNREAD** (2026-09-21). The eight
  are this round's own: five tweak-rung cases, the `sameProse` bypass census,
  and the two scoped-wording cases — **stated as the difference between two
  measured readings**, 7,040 → 7,048, never arithmetic off a paragraph.
  **⚠ AND THIS LOCAL RUN READ `# skipped 0` WHERE EVERY ONE BEFORE IT READ 4** —
  a sandbox difference rather than anything this change did, and the reason
  **THE TOTAL IS THE ONLY COMPARABLE NUMBER**: a `pass` count drifts between
  the two machines by exactly those four, and now the skip count drifts too.
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
  `--verify`. `repairbench-1` is repaired and verified.
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

- **PREPARE AND VERIFY IT RATHER THAN DESCRIBING IT**: apply it in a throwaway
  worktree and check the resulting tree is byte-identical to the base (same tree
  object). Then the image step says `reused` because the inputs really are the
  base's, not because anybody predicted it.
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
