# Deploy record: timings and image-id predictions

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). The rules are in
> `docs/deploy.md`, where CLAUDE.md's **Deploy** section moved in the second
> pass. This file keeps the measurements behind them: the
> timing bands, every image-id prediction checked against a deploy's own log
> (deploys 2137–2170), and the served-file check driven end to end on deploy
> 2139.
>
> **Add each new deploy here**, one paragraph per deploy, in the same shape:
> both ends predicted before the push, the log's `built`/`reused` line with its
> input count, the `-`/`+` image pair under `SUCCESS Modified application`, the
> number of `CACHED` lines, and the image step, Wrangler and job times.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## Timing bands, and the image id predicted before each push

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
whole reader. **Cross-checked against reality TWENTY-SIX times, and the
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
**The twenty-fourth — deploy 2153 (2026-09-24) — is the THIRD CONFIRMED
NEGATIVE**: both ends answered `56f7d5866240a1de` from 186 inputs, none of the
push's seven files among them (`public/chat.js`, four tests, two documents),
and the log answered `reused … (registry answered 200; ***86 inputs …)` beside
`no changes isibi-app-sitebuildcontainer` — image step **~1.2 s**, Wrangler
**~23 s** (it reinstalled itself first: `npx` found no matching version and
installed 4.107.0 in ~3 s), job **57 s**. The no-roll band again, one asset
uploaded (`+ /chat.js`).
**The twenty-fifth — deploy 2154 (2026-09-24) — is the FOURTH CONFIRMED
NEGATIVE**: both ends answered `56f7d5866240a1de` from 186 inputs, none of the
push's twelve files among them (`public/chat.js`, `scripts/addon-sweep.mjs`,
eight tests, two documents), and the log answered `reused … (registry answered
200; ***86 inputs …)` beside `no changes isibi-app-sitebuildcontainer` — image
step **1.5 s**, Wrangler **16.2 s** (it reinstalled itself first, as on 2153),
job **43 s**. The no-roll band again, one asset uploaded (`+ /chat.js`).
**The twenty-sixth — deploy 2155 (2026-09-25) — is the FIFTH CONFIRMED
NEGATIVE**: both ends answered `56f7d5866240a1de` from 186 inputs, none of the
push's sixteen files among them (`public/chat.js`, `scripts/addon-sweep.mjs`,
twelve tests, two documents — intersected with all **156 distinct input
paths**, since 30 files are COPYed to two destinations and 186 is the count of
entries, not of paths), and the log answered `reused … (registry answered 200;
***86 inputs …)` beside `no changes isibi-app-sitebuildcontainer` — image step
**~1.4 s**, Wrangler **~18 s** (it reinstalled itself first, as on 2153 and
2154), job **52 s**. The no-roll band again, one asset uploaded (`+ /chat.js`).
**Deploy 2158 (2026-09-25) was predicted on both ends and confirmed on both
channels, and the input COUNT moved 186 → 187 as predicted**
(`builder/page-prose.mjs` joined the worker COPY line): `origin/main`
`38fe281d` answered `b83b0611aeecce8f` — what the non-spending canary
36096052737 read LIVE at `5cb8592` — and the tip `6ed355e4` answered
`f05cb5a5a0def44c`, with `Dockerfile`, `worker.js`, `builder/page-keep.mjs` and
`builder/page-prose.mjs` the four of the push's 23 files among the **157
distinct input paths**. The log answered `built …:f05cb5a5a0def44c (registry
answered 404; ***87 inputs …)` and `- …:b83b06***aeecce8f` →
`+ …:f05cb5a5a0def44c` under `SUCCESS Modified application`; **0 `CACHED`
lines**, image step 2m12s, Wrangler 25s (it reinstalled itself first), job
3m09s. **The running count above stops at twenty-six on purpose**: deploys 2156
and 2157 were another session's, and whether their ids were predicted before
the push is not recorded here.
**Deploy 2159 (2026-09-25) was predicted on both ends and confirmed on both
channels**: `origin/main` `6ed355e4` answered `f05cb5a5a0def44c` — what canary
run 30 read LIVE — and the tip `c2fa000c` answered `a51d8b32e5869576`, both from
187 inputs, `worker.js` the one of the push's six files among the 157 distinct
input paths. The log answered `built …:a5***d8b32e5869576 (registry answered
404; ***87 inputs …)` and `- …:f05cb5a5a0def44c` → `+ …:a5***d8b32e5869576`
under `SUCCESS Modified application`; **0 `CACHED` lines**, image step 2m05s,
Wrangler ~22s, job 3m09s.
**Deploy 2160 (2026-09-26) was predicted on both ends and confirmed on both
channels**: `origin/main` `c2fa000c` answered `a51d8b32e5869576` — what canary
run 32 read LIVE — and the tip `7384ddba` answered `c3cc126e45e93815`, both from
187 inputs (the same id at `8f66dfb9`, the round after it moving no input). The
log answered `built …:c3cc***26e45e938***5 (registry answered 404; ***87 inputs
…)` and `- …:a5***d8b32e5869576` → `+ …:c3cc***26e45e938***5` under `SUCCESS
Modified application`; **0 `CACHED` lines**, image step 2m14s, Wrangler ~19s
(it reinstalled itself first), job 3m01s.
**Deploy 2161 (2026-09-26) was predicted on both ends and confirmed on both
channels**: `origin/main` `7384ddba` answered `c3cc126e45e93815` — what deploy
2160 built — and the tip `0de188ff` answered `05750a5120d33570`, both from 187
inputs and 157 distinct paths, with `worker.js`, `builder/build-server.mjs`,
`builder/container-room.mjs` and `builder/site-freecss.mjs` the four of the
push's 20 files among them. The predictor re-run over the MERGED tree (the
fast-forward's `origin/main`) answered the same id. The log answered `built
…:05750a5***20d33570 (registry answered 404; ***87 inputs …)` and
`- …:c3cc***26e45e938***5` → `+ …:05750a5***20d33570` under `SUCCESS Modified
application`; **0 `CACHED` lines**, image step 2m02s, Wrangler 18s, job 2m48s.
**Deploy 2162 (2026-09-26) was predicted on both ends and confirmed on both
channels, and the input COUNT moved 187 → 188 as predicted**
(`builder/kit-headings.mjs` joined the worker COPY line): `origin/main`
`0de188ff` answered `05750a5120d33570` — what run 33 read LIVE — and the tip
`ab74d0d9` answered `369d7b1e5bae25b0`, from 158 distinct paths, with
`Dockerfile`, `builder/kit-headings.mjs`, `builder/page-prose.mjs` and
`builder/site-tweak.mjs` the four of the push's 12 files among them. The
predictor re-run over the MERGED tree answered the same id. The log answered
`built …:369d7b***e5bae25b0 (registry answered 404; ***88 inputs …)` and
`- …:05750a5***20d33570` → `+ …:369d7b***e5bae25b0` under `SUCCESS Modified
application`; **0 `CACHED` lines**, image step 2m05s, Wrangler 16s, job 2m53s.
**Deploy 2163 (2026-09-27) was predicted on both ends and confirmed on both
channels**: `origin/main` `ab74d0d9` answered `369d7b1e5bae25b0` — what runs 35
and 40 read LIVE — and the tip `14df0225` answered `9038e90ab1d5d7fe`, both
from 188 inputs and 158 distinct paths, with `site-owner.mjs` the one of the
push's 21 files among them. The predictor re-run over the MERGED tree (the
fast-forward's `origin/main`) answered the same id. The log answered `built
…:9038e90ab***d5d7fe (registry answered 404; ***88 inputs …)` and
`- …:369d7b***e5bae25b0` → `+ …:9038e90ab***d5d7fe` under `SUCCESS Modified
application`; **0 `CACHED` lines**, image step 2m10s, Wrangler 17s, job 3m01s.
**Deploy 2164 (2026-09-28) was predicted on both ends and confirmed**:
`origin/main` `14df0225` answered `9038e90ab1d5d7fe` and the tip `e4b15ef6`
answered `a217f74c81122512`, both from 188 inputs and 158 distinct paths. The
log answered `built …:a2***7f74c8***225***2 (registry answered 404; ***88
inputs …)` and `…:9038e90ab***d5d7fe` → `…:a2***7f74c8***225***2` under
`SUCCESS Modified application`; **0 `CACHED` lines**, image step 2m36s,
Wrangler ~20s, job 3m29s; `No updated asset files to upload`.
**Deploy 2165 (2026-09-28) was predicted on both ends and confirmed**:
`origin/main` `e4b15ef6` answered `a217f74c81122512` — what run 48 read LIVE —
and the tip `f5e941f4` answered `8a10715339cdc780` (the same id at `2cf8461c`,
the three commits after it touching documents only), both from 188 inputs and
158 distinct paths, `worker.js` the one of the push's five files among them.
The log answered `built …:8a***07***5339cdc780 (registry answered 404; ***88
inputs off ./Dockerfile)` and `…:a2***7f74c8***225***2` →
`…:8a***07***5339cdc780` under `SUCCESS Modified application`; **0 `CACHED`
lines**, image step 2m15s, Wrangler 20s (it reinstalled itself first), job
3m09s; `No updated asset files to upload`. **Runtime-confirmed by the owner's
free press, edit canary run 51** (2026-09-28 22:57 UTC, from the branch at
`37f90769` on `fold-lane-bakery`): `build-health 200 deploy=f5e941f494fd
image=8a10715339cdc780` and `runtime 200 deploy=f5e941f494fd async=true
runner=true`, the two readers agreeing and both expectations met.
**Deploy 2166 (2026-09-29) was predicted on both ends and confirmed**:
`origin/main` `f5e941f4` answered `8a10715339cdc780` — deploy 2165's own
image, runtime-confirmed by run 51 — and the tip `a64729ad` answered
`6fbaccad82fe879d` (the same id at `9ed7da51`, the one commit after it touching
documents only), both from 188 inputs and 158 distinct paths; `worker.js` and
four `builder/` modules (`edit-failure.mjs`, `site-addon.mjs`, `site-ask.mjs`,
`site-lanes.mjs`) are the push's inputs among its 47 files. **A
fast-forward**, `f5e941f4` → `a64729ad` at 02:47:47Z, 16 commits; nothing was
in flight on GitHub or in `edit_jobs` (172 `done`, 144 `failed`, 2 `lost`,
none queued or running), and reverting `f5e941f4..a64729ad` gives main's own
tree (`95183233…`), so a rollback reuses `8a10715339cdc780`. Run 36514259994:
the gate took over from `f5e941f4…` and the drain found no live leases; the
log answered `built …:6fbaccad82fe879d (registry answered 404; ***88 inputs
off ./Dockerfile)` and `…:8a***07***5339cdc780` → `…:6fbaccad82fe879d` under
`SUCCESS Modified application`; **0 `CACHED` lines**, image step 2m55s,
Wrangler 20s, job 3m53s (10 s above the band's recorded top of 3m43s).
`+ /edit-poll.js` and `+ /chat.js`, `Uploaded 2 files (84 already uploaded)`,
`DEPLOY_ID` `a64729ad74***ab***60d93f…`, `Current Version ID: 2575a976-…`.
**The served files are byte-identical to the merged tree**, read at
02:53:41Z: `/chat.js` 787,454 bytes (sha256 `50909c0b57f3a929…`; the before
reading at 02:47:02Z was `f5e941f4`'s own 786,047 bytes, `e56f1c9f4ffca3da…`)
and `/edit-poll.js` 30,203 bytes (`930e7daa1ec68419…`; before, 29,659 bytes,
`ebc0e7094320a447…`); `alsoAsked` 3 → 14 in `chat.js` and `rec.also` 0 → 1 in
`edit-poll.js`. Gates 401 / 401 / 401 / 404 at 02:54:13Z. **Runtime-confirmed
by the owner's free press, edit canary run 54** (2026-09-29 03:36 UTC, from
`main` at `a64729ad` on `fold-lane-bakery`): `build-health 200
deploy=a64729ad741a image=6fbaccad82fe879d` and `runtime 200
deploy=a64729ad741a async=true runner=true`, the two readers agreeing and both
expectations met; the free job was claimed by a container and finished at
cost 0.
**Deploy 2167 (2026-09-29) was predicted on both ends and confirmed**:
`origin/main` `a64729ad` answered `6fbaccad82fe879d` — deploy 2166's own
image, runtime-confirmed by run 54 — and the tip `cb981a4a` answered
`65ce683607928f0e` (the same id at `4ee123d2`, the commit before it, which
the one after only documents), both from 188 inputs and 158 distinct paths;
`builder/site-picture.mjs` and `worker.js` are the push's inputs among its
20 files (the photo-removal correction). **A fast-forward**, `a64729ad` →
`cb981a4a` at 13:59:46Z, 12 commits; nothing was in flight on GitHub (no run
in progress, queued or waiting) or in `edit_jobs` (173 `done`, 154 `failed`, 2
`lost`, none queued or running; the ten `failed` since 2166 are the canary's
own free probe pairs, cost 0), and reverting `a64729ad..cb981a4a` gives
main's own tree (`c5862644…`), so a rollback reuses `6fbaccad82fe879d`. Run
36579291309: the gate took over from `a64729ad…` and the drain found no live
leases; the log answered `built …:65ce683607928f0e (registry answered 404;
***88 inputs off ./Dockerfile)` and `…:6fbaccad82fe879d` →
`…:65ce683607928f0e` under `SUCCESS Modified application`; **0 `CACHED`
lines**, image step 2m21s, Wrangler 23s, job 3m18s, all inside the band.
`+ /chat.js`, `Uploaded 1 file (85 already uploaded)`, `DEPLOY_ID`
`cb98***a4ad***d37***8da7df…`, `Current Version ID: 96e025a…`. **The served
`/chat.js` is byte-identical to the merged tree**, read at 14:05:21Z: 788,171
bytes, sha256 `82f36de3b5535656…` (the before reading at 13:59:09Z was
`a64729ad`'s own 787,454 bytes, `50909c0b57f3a929…`); `photosTakenOff` 0 → 4.
`/edit-poll.js` did not change and still equals the merged file (30,203
bytes). Gates 401 / 401 / 401 / 404 at 14:05Z, and `fold-lane-bakery` still
answers at `01790468089054-8btpep` on all five pages, with `/the-starter`
301 to `/starter` (`public, max-age=600`), at 14:06Z. **Runtime-confirmed
by the owner's free press, edit canary run 59** (2026-09-29 14:53 UTC, from
`main` at `cb981a4a` on `fold-lane-bakery`): `build-health 200
deploy=cb981a4ad1d3 image=65ce683607928f0e` and `runtime 200
deploy=cb981a4ad1d3 async=true runner=true`, the two readers agreeing and both
expectations met; the free job was claimed by a container and finished at
cost 0, and the balance read 37.
**Deploy 2168 (2026-09-29), with a second run of the same push, 2169, was
predicted on both ends and built as predicted**: `origin/main` `cb981a4a`
answered `65ce683607928f0e`, deploy 2167's own image, runtime-confirmed by run
59, and the tip `47dea9c0` answered `dd4f72842234135b`, both from 188 inputs
and 158 distinct paths; `builder/site-lanes.mjs` is the push's one container
input among its 12 files (the look door's menu-lane correction). **A
fast-forward**, `cb981a4a` → `47dea9c0` at 16:35:44Z; nothing was in flight on
GitHub (no run in progress or queued) or in `edit_jobs` (none open; the last,
run 61's free probe, at 15:33), the candidate's CI was green (unit run
36597948276 on `47dea9c0`, `8296 / 8292 / 0 / 4`; site build 36595193255 on
`f2783aef`, the same code), and reverting `cb981a4a..47dea9c0` in a throwaway
worktree gives main's own tree (`4c77ad83…`), so a rollback reuses
`65ce683607928f0e`. **The one push started two deploy runs a second apart**,
2168 (36598877765) and 2169 (36598878917), both `push` on `47dea9c0`; not seen
on an earlier merge. Both ran the whole job and both are `completed` /
`success`: 2169 set the gate first (took over from `cb981a4a…`) and 2168 then
took over from it (`47dea9c0…`, "still live"); both drains found no live
leases; both logs answered `built …:dd4f72842234135b (registry answered 404;
***88 inputs off ./Dockerfile)` and `…:65ce683607928f0e` →
`…:dd4f72842234135b` under `SUCCESS Modified application`, with **0 `CACHED`
lines**; image step 131 s and 150 s, Wrangler 20 s and 17 s, job 180 s and
194 s. `No updated asset files to upload` in both (nothing under `public/`
changed, so no served-file comparison is owed); the last Wrangler deploy to
finish was 2169's (16:39:05Z, `Current Version ID: 86535ed6-…`), and both
deploy the same commit and image. Gates 401 / 401 / 401 / 404 at 16:40Z, and
`fold-lane-bakery` still answers at `01790468089054-8btpep`, with
`/the-starter` 301. **Runtime-confirmed by the owner's free press, edit
canary run 62** (2026-09-29 16:57 UTC, 18 minutes after the roll, from `main`
at `47dea9c0` on `fold-lane-bakery`): `build-health 200 deploy=47dea9c01fbf
image=dd4f72842234135b` and `runtime 200 deploy=47dea9c01fbf async=true
runner=true`, the two readers agreeing and both expectations met; the free
job was claimed by a container and finished at cost 0, and the balance read
32.
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

**Deploy 2170 (2026-09-29) was predicted on both ends and built as
predicted**: `origin/main` `47dea9c0` answered `dd4f72842234135b`, deploy
2168's own image, runtime-confirmed by run 62, and the tip `907840c6`
answered `abf47dfeceba3c5c`, both from 188 inputs and 158 distinct paths;
`builder/site-ask.mjs` is the push's one container input among its 13 files
(the router's whole-message rule, by targets). **A fast-forward**,
`47dea9c0` → `907840c6` at 20:28:25Z, on the owner's word to merge the
reviewed branch through `907840c6`. Checked first:
- **nothing unreviewed**: the branch on GitHub was exactly `907840c6`, eight
  commits past main (two code, `465efe11` and `2771ed3f`, and six records),
  and the router module's only non-comment change is the three reviewed
  strings;
- **nothing in flight**: on GitHub, no run in progress, queued, waiting,
  requested or pending; in `edit_jobs`, none open (the last, run 64's free
  restore, at 17:29);
- **CI green on the candidate**: unit run 36625806573 on `907840c6`,
  `8297 / 8293 / 0 / 4`; unit 36622422731 and site build 36622422715 on
  `2771ed3f`, the same code;
- **no commit message** in the range carries the skip-CI marker;
- **the rollback**: reverting `47dea9c0..907840c6` in a throwaway worktree
  gives main's own tree (`4bc05306…`), so a rollback reuses
  `dd4f72842234135b`.

**One deploy run this time**, 2170 (36626580809, `push` on `907840c6`),
`completed` / `success`:
- **the gate** was set for `907840c6…`, taking over from `47dea9c0…`, and the
  drain found no live leases after 3 s;
- **the image**: the log answered `built
  isibi-app-sitebuildcontainer:abf47dfeceba3c5c (registry answered 404;
  ***88 inputs off ./Dockerfile)`, and `…:dd4f72842234***35b` →
  `…:abf47dfeceba3c5c` under `SUCCESS Modified application`, then `Applied
  changes`, with **0 `CACHED` lines**;
- **timings**: image step 130 s (20:28:53–20:31:03), Wrangler 20 s, job 180 s
  (20:28:30–20:31:30);
- **Wrangler**: `DEPLOY_ID` `907840c67497b2624f***a2febfdb27b947ca5222a` (the
  masked run is a `1`); `No updated asset files to upload`, because nothing
  under `public/` changed, so no served-file comparison is owed; `Current
  Version ID: e***33***b87-cf3a-484f-90fb-9cfe***ec***de09`, masked.

**Read at 21:34Z**: the gates answered 401 / 401 / 401 / 404, and
`fold-lane-bakery` still answers `x-site-version: 01790468089054-8btpep` on
all five pages, with `/the-starter` 301 → `/starter`. **Runtime-confirmed by
the owner's free press, edit canary run 65** (2026-09-29 21:51 UTC, 80
minutes after the roll, from `main` at `907840c6` on `fold-lane-bakery`):
`build-health 200 deploy=907840c67497 image=abf47dfeceba3c5c` and `runtime
200 deploy=907840c67497 async=true runner=true`, the two readers agreeing and
both expectations met; the free job was claimed by a container at 2 s and
finished at cost 0, and the balance read 28.

## The served-file check, driven end to end on deploy 2139

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
