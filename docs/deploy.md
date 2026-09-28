# Deploying and releasing

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in the second pass
> of its cleanup (the file as it stood: `git show 28bdc97f:CLAUDE.md`): the two
> working rules about what a push starts and about the paid workflows, the
> **Deploy** section, and **Releasing**. CLAUDE.md keeps "Deploying, in brief".
> Each deploy's own readings are in `docs/deploy-record.md`.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## What a push starts, and the paid workflows

These two rules were bullets in CLAUDE.md's working rules.

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
