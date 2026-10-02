# Deploy record: timings and image-id predictions

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). The rules are in
> `docs/deploy.md`, where CLAUDE.md's **Deploy** section moved in the second
> pass. This file keeps the measurements behind them: the
> timing bands, every image-id prediction checked against a deploy's own log
> (deploys 2137–2178), and the served-file check driven end to end on deploy
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

**Deploy 2171 (2026-09-30) was predicted on both ends and built as
predicted**: `origin/main` `907840c6` answered `abf47dfeceba3c5c`, deploy
2170's own image, runtime-confirmed by run 65, and the candidate `29111010`
answered `cdb624837e099719`, both from 188 inputs and 158 distinct paths.
Five container inputs changed among the push's 40 files: `worker.js`,
`site-routing.mjs`, `builder/site-ask.mjs`, `builder/site-apply.mjs` and
`builder/model-xai.mjs` (Lane 1's four corrections and the owner's review
round). **A fast-forward of 29 commits**, `907840c6` → `29111010` at
05:30:28Z, on the owner's word to merge and deploy exactly the reviewed
candidate `291110103024a68da9d0bca525a9d2302d5bd1f2`. Checked first:
- **the candidate unchanged**: the branch on GitHub was exactly `29111010`
  at the push;
- **nothing in flight**: on GitHub, no run in progress or queued (the last,
  site build 36671505766, had finished at 05:27:22); in `edit_jobs`, none
  open (the newest, from 02:21);
- **required CI green on the candidate itself**: unit run 36671505759,
  `8351 / 8347 / 0 / 4`; site build 36671505766, `completed` / `success`, its
  twelve counts read from the log (TAP 397, kit-typecheck 4, site-build 404,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47, and kit-render, kit-a11y, kit-effects and kit-paint `all
  passed`), with only the two known `##[error]` annotations
  (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`);
- **no commit message** in the range carries the skip-CI marker;
- **the rollback**: reverting `907840c6..29111010` in a throwaway worktree
  gives main's own tree (`0a16949c…`), so a rollback reuses
  `abf47dfeceba3c5c`;
- **the served files before**: `chat.js` 788,171 bytes, `82f36de3…`, and
  `site-list.js` 14,957 bytes, `b64e0845…`, each byte-identical to
  `907840c6`'s file, read at 05:30.

**One deploy run**, 2171 (36673728752, `push` on `29111010`), `completed` /
`success`:
- **the gate** was set for `29111010…`, taking over from `907840c6…`, and the
  drain found no live leases after 2 s;
- **the image**: the log answered `built
  isibi-app-sitebuildcontainer:cdb624837e099719 (registry answered 404; 188
  inputs off ./Dockerfile)` (masked `cdb624837e0997***9`, `***88`), and
  `…:abf47dfeceba3c5c` → `…:cdb624837e099719` under `SUCCESS Modified
  application`, then `Applied changes` at 05:33:17, with **0 `CACHED`
  lines**;
- **timings**: image step 121 s (05:30:58–05:32:59), Wrangler 19 s, job 168 s
  (05:30:36–05:33:24);
- **Wrangler**: `DEPLOY_ID` `291110103024a68da9d0bca525a9d2302d5bd1f2`
  (masked `29***0***03024…d***f2`); `Uploaded 2 files (84 already
  uploaded)`; `Current Version ID: 5c47***b95-cefd-426a-83be-adcc5abd4290`,
  masked.

**The served files after** (05:34:36): `chat.js` 789,646 bytes,
`efcae48d…`, and `site-list.js` 15,846 bytes, `56ab5196…`, each
byte-identical to `29111010`'s file, with and without a cache-busting query.
The gates answered 401 / 401 / 401 / 404; `fretwork-1` answers
`kk6qsh` and `fold-lane-bakery` `8btpep`, as before. **Deployed, not
runtime-confirmed**: the container image rolled at 05:33:17, so container work
waits until about 05:53, and the confirmation is the owner's free press
(`build-health` with `29111010` and `cdb624837e099719`). The session's one
dispatch of that free press, at 05:53 after the wait, answered 403 (no
`actions: write`), as before, and was not retried. The Data panel's
fresh-browser read needs the building account's session, so it is the
owner's own check. **The deployment is credited by the owner** (2026-09-30:
*"Deployment 2171 is credited. Keep runtime confirmation and B2 recovery open
until their evidence exists."*); its runtime confirmation stays open.

**Deploy 2172 (2026-09-30) was predicted on both ends and built as
predicted**: `origin/main` `29111010` answered `cdb624837e099719`, deploy
2171's own image, and the candidate `80ece106` answered `e71f7bae88b9ecf1`,
both from 188 inputs and 158 distinct paths. One container input changed
among the push's 12 files: `builder/site-ask.mjs` (the row-removal routing
correction). **A fast-forward of 5 commits**, `29111010` → `80ece106` at
06:57:29Z, on the owner's word to merge the reviewed branch through
`80ece10644a98bb90f376d7b6f85cb61b9a34680`. Checked first:
- **the candidate unchanged**: the branch on GitHub was exactly `80ece106`,
  and main was still `29111010`, re-read just before the push;
- **nothing in flight**: on GitHub, no run in progress or queued; in
  `edit_jobs`, none open (the newest, from 02:21);
- **CI**: unit run 36679661698 on `80ece106` itself, `8360 / 8356 / 0 / 4`;
  site build 36677496840 on `4e3ef512`, the twelve counts. `4e3ef512` →
  `80ece106` changes documents only (seven files under `docs/` and
  `CLAUDE.md`), so the site build's evidence carries;
- **no commit message** in the range carries the skip-CI marker;
- **the rollback**: reverting `29111010..80ece106` in a throwaway worktree
  gives main's own tree (`fad0ae29…`), so a rollback reuses
  `cdb624837e099719`;
- **nothing under `public/`** changed, so no served-file comparison is owed.

**One deploy run**, 2172 (36681001968, `push` on `80ece106`), `completed` /
`success`:
- **the gate** was set for `80ece106…`, taking over from `29111010…`, and the
  drain found no live leases after 0 s;
- **the image**: the log answered `built
  isibi-app-sitebuildcontainer:e71f7bae88b9ecf1 (registry answered 404; 188
  inputs off ./Dockerfile)` (masked `e7***f7bae88b9ecf***`, `***88`), and
  `…:cdb624837e099719` → `…:e71f7bae88b9ecf1` under `SUCCESS Modified
  application`, then `Applied changes` at 07:00:33, with **0 `CACHED`
  lines**;
- **timings**: image step 133 s (06:58:04–07:00:17), Wrangler 19 s, job 184 s
  (06:57:37–07:00:41);
- **Wrangler**: `DEPLOY_ID` `80ece10644a98bb90f376d7b6f85cb61b9a34680`
  (masked); `No updated asset files to upload`; `Current Version ID:
  58fff2af-9b88-4f***d-b748-70a***3f7***a8da`, masked.

**Read at 07:02Z**: the gates answered 401 / 401 / 401 / 404; the served
`chat.js` (789,646 bytes, `efcae48d…`) and `site-list.js` (15,846 bytes,
`56ab5196…`) are still byte-identical to the merged files; `fretwork-1`
answers `kk6qsh` and `fold-lane-bakery` `8btpep`. **Deployed, not
runtime-confirmed**: the container image rolled at 07:00:33, so container
work waits until about 07:21, and the confirmation is the owner's free press
(`build-health` with `80ece106` and `e71f7bae88b9ecf1`). The session does not
dispatch it again: its dispatch answers 403.

**Runtime-confirmed by the owner's free press, edit canary run 76**
(36685956087, 2026-09-30 07:49:37–07:50:11 UTC, 49 minutes after the roll,
from `main` at `80ece106` on `fold-lane-bakery`, spend `no`):
`build-health 200 deploy=80ece10644a9 image=e71f7bae88b9ecf1` and `runtime
200 deploy=80ece10644a9 async=true runner=true`, the two readers agreeing and
both expectations met. The free job (`53838d8f…`) was claimed at 2 s and
settled after about 6 s at cost 0; the control site's job (`cab66735…` on
`washhouse-3`) took the same queued shape; a forged replay marker and a
foreign job's poll answered 404; `ALL FREE CHECKS PASSED`. The bakery's five
stored pages read complete at `8btpep`, and the balance read 15. Read
independently afterwards: the balance 15, no ledger row after 342, both free
jobs `failed` with billing `none` and cost 0, and no job open. **Deploy 2172
runs deploy 2171's code plus one changed container input, so this press is
also the runtime check of 2171's code** (2171's own image,
`cdb624837e099719`, was never read by a press and is no longer served).

**Deploy 2173 (2026-09-30) was predicted on both ends and reused as
predicted**: `origin/main` `80ece106` and the candidate `8908b59d` both
answered `e71f7bae88b9ecf1`, from 188 inputs and 158 distinct paths. None of
the push's 18 files is an image input: the canary's workflow, its script and
tests (the opt-in fixture check with its whole-table read), and documents.
**A fast-forward of 11 commits**, `80ece106` → `8908b59d` at 19:48:47Z, on
the owner's word ("commit and merge"). Checked first:
- **the candidate unchanged**: the branch on GitHub was exactly `8908b59d`,
  and main was still `80ece106`, re-read just before the push;
- **nothing in flight**: on GitHub, no run in progress, queued, waiting,
  requested or pending; in `edit_jobs`, none open (178 `done`, 191
  `failed`, 2 `lost`; the newest, run 77's, from 08:29);
- **CI**: unit run 36767386339 on `8908b59d` itself, `8388 / 8384 / 0 / 4`.
  None of the push's 18 files matches any of the site build's 22 trigger
  paths, so its evidence on main's code (36677496840 on `4e3ef512`)
  carries;
- **no commit message** in the range carries the skip-CI marker (11 read);
- **the rollback**: reverting `80ece106..8908b59d` in a throwaway worktree
  gives main's own tree (`e55dd36d…`), so a rollback reuses
  `e71f7bae88b9ecf1`;
- **nothing under `public/`** changed, so no served-file comparison is owed.

**One deploy run**, 2173 (36768265523, `push` on `8908b59d`), `completed` /
`success`:
- **the gate** was set for `8908b59d…`, taking over from `80ece106…`, and the
  drain found no live leases after 0 s;
- **the image**: the log answered `reused
  isibi-app-sitebuildcontainer:e71f7bae88b9ecf1 (registry answered 200; 188
  inputs off ./Dockerfile)` (masked `e7***f7bae88b9ecf***`, `***88`), and
  Wrangler's container step answered `no changes
  isibi-app-sitebuildcontainer` and `No changes to be made`;
- **timings**: image step 2 s (19:49:17–19:49:19), Wrangler 15 s
  (19:49:20–19:49:35), job 45 s (19:48:54–19:49:39): the band for a push
  that rolls nothing (47 s on 2019, 46 s on 2140);
- **Wrangler**: `DEPLOY_ID` `8908b59d2069dfb5f11fa679a8b33b649194fe77`
  (masked); `No updated asset files to upload`; `Current Version ID:
  b7feba95-c202-4602-a236-…` (masked).

**Read at 19:52Z**: the gates answered 401 / 401 / 401 / 404; `fretwork-1`
answers `kk6qsh` and `fold-lane-bakery` `8btpep`. The image did not roll, so
no container wait was owed.

**Runtime-confirmed by the owner's free press, edit canary run 78**
(36769355267, 2026-09-30 19:58:41–19:59:00 UTC, 10 minutes after the deploy,
from `main` at `8908b59d` on `fold-lane-bakery`, spend `no`): `build-health
200 deploy=8908b59d2069 image=e71f7bae88b9ecf1` and `runtime 200
deploy=8908b59d2069 async=true runner=true`, the two readers agreeing and
both expectations met. The free job (`38d8c243…`) was claimed at 2 s and
settled after about 4 s at cost 0; the control site's job (`3e72065f…` on
`washhouse-3`) took the same queued shape; a forged replay marker and a
foreign job's poll answered 404; `ALL FREE CHECKS PASSED`. The bakery's five
stored pages read complete at `8btpep`, and the balance read 13. Read
independently afterwards: the balance 13, the building account's last ledger
row still 344, both free jobs `failed` with billing `none` and cost 0, and no
job open.

**The owner accepted deploy 2173 and run 78** (2026-09-30). **Run 78 did not
exercise the fixture guard**: its `expect_rows` box was blank (the log's
`CANARY_EXPECT_ROWS` is empty and no `EXPECTED ROWS` line was printed), and so
was `expect_route`. It confirmed the runtime only; the guard it carries has not
yet run live.

**Deploy 2174 (2026-10-01) was predicted on both ends and built as
predicted**: `origin/main` `8908b59d` answered `e71f7bae88b9ecf1` (the image
2173 reused) and the candidate `322c2430` answered `b8c8789aa8e395d6`, both
from 188 inputs and 158 distinct paths. One input moved,
`builder/site-ask.mjs` (decision 2b's sort rule and its scope correction);
the push also changed the canary's workflow text (Test 9's scenario box),
scripts, tests and documents. **A fast-forward of 22 commits**, `8908b59d` →
`322c2430` at 00:58:41Z, on the owner's word ("Merge the reviewed branch and
deploy"). Checked first:
- **the candidate unchanged**: the branch on GitHub was exactly `322c2430`,
  and main was still `8908b59d`, re-read just before the push;
- **nothing in flight**: on GitHub, no run in progress or queued; in
  `edit_jobs`, none open on any account (the newest from 2026-09-30 22:22);
- **CI**: unit run 36798198283 on `322c2430` itself, `8427 / 8423 / 0 / 4`;
  the site build on `99837db1` (run 36795891162, the twelve counts), the
  last commit touching its paths, the candidate adding documents only;
- **the rollback**: reverting `8908b59d..322c2430` in a throwaway worktree
  gives main's own tree, so a rollback reuses `e71f7bae88b9ecf1`;
- **nothing under `public/`** changed, so no served-file comparison is owed.

**One deploy run**, 2174 (36798842190, `push` on `322c2430`), `completed` /
`success`:
- **the gate** was set for `322c2430…`, taking over from `8908b59d…`, and the
  drain found no live leases;
- **the image**: the log answered `built
  isibi-app-sitebuildcontainer:b8c8789aa8e395d6 (registry answered 404; 188
  inputs off ./Dockerfile)` (masked `***88`), and Wrangler's container step
  `EDIT isibi-app-sitebuildcontainer`, `- "image": …:e71f7bae88b9ecf1`
  (masked `e7***f7bae88b9ecf***`) / `+ "image": …:b8c8789aa8e395d6`,
  `SUCCESS Modified application isibi-app-sitebuildcontainer`, `Applied
  changes`;
- **timings**: image step 2m14s (00:59:12–01:01:26), Wrangler 18 s
  (01:01:27–01:01:45), job 3m00s (00:58:48–01:01:48): the band for a push
  that rolls the image (2m06s–2m16s on 2138, 2139 and 2143);
- **Wrangler**: `DEPLOY_ID` `322c24301da9a413f609c1ed8e0d020bbe8fd48c`
  (masked); `No updated asset files to upload`; `Current Version ID:
  bd…2a39b-…` (masked).

**Read at 01:05Z**: the gates answered 401 / 401 / 401 / 404; `fretwork-1`
answers `kk6qsh` and `fold-lane-bakery` `8btpep`. The image rolled at
01:01:45Z, so container work waited 15–20 minutes; the session's dispatch at
01:22:02Z answered 403 and was not retried.

**Runtime-confirmed by the owner's free press, run 83** (36802348994,
01:42 UTC, from `main` on `fold-lane-bakery`, spend `no`): build-health 200
`deploy=322c24301da9 image=b8c8789aa8e395d6`, runtime 200
`deploy=322c24301da9 async=true runner=true`, the control `washhouse-3`
async; the two deploy readers agree, and both demands passed (the Worker is
`322c2430`, a cold container gets `b8c8789aa8e395d6`); every free check
passed. Nothing was charged: the run's own balance read, taken after its free
job, was 6, as at 01:12. The same press rehearsed Test 10 (the checklist's
*Test 10*).

**Deploy 2175 (2026-10-01) was predicted on both ends and built as
predicted**: `origin/main` `322c2430` answered `b8c8789aa8e395d6` (the image
2174 built) and the candidate `2188f706` answered `c051f625db27b5b7`, from
188 and 189 inputs (158 and 159 distinct paths): `builder/site-rows.mjs`
joined the Dockerfile's COPY line, and `worker.js`, `builder/site-add.mjs`
and `builder/site-apply.mjs` moved. The push also changed `public/chat.js`
(the add-on reply names the entries a `row` addition saved), one workflow's
text (`lane-sweep.yml`'s harness box), scripts, tests and documents. **A
fast-forward of 10 commits**, `322c2430` → `2188f706` at 08:09:23Z, on the
owner's word ("The fix on 2188f706 passes review … Once both required checks
are green, merge the reviewed changes into main and monitor deployment").
Checked first:
- **the candidate unchanged**: the branch on GitHub was exactly `2188f706`,
  and main was still `322c2430`, re-read at 08:09:18Z;
- **nothing in flight on GitHub**: no run in progress or queued at 08:09Z.
  **`edit_jobs` was not read** (this session has no Supabase connector); the
  deploy's own drain is the reading for jobs (below);
- **CI on `2188f706` itself**: unit run 36832053188, `8511 / 8507 / 0 / 4`;
  the site build, run 36832053168, `completed` / `success` with every step
  `success` and the twelve counts read from each step's log (TAP 397,
  kit-typecheck 4, site-build 404, contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47; kit-render, kit-a11y,
  kit-effects and kit-paint `all passed`), its two `##[error]` annotations
  the known ones inside the case that compiles a broken page on purpose;
- **the rollback**: reverting `322c2430..2188f706` in a throwaway worktree
  gives main's own tree (`b2115304…`), so a rollback reuses
  `b8c8789aa8e395d6`;
- **`public/chat.js` changed**, so its before-reading was taken at 07:54:08Z:
  200, 789,646 bytes, sha256 `efcae48da9d14edf…`, byte-identical to
  `322c2430`'s, with 0 occurrences of `rowsAdded` (the candidate's file has 3,
  sha256 `b294117a4d1de7bb…`). The gates answered 401 / 401 / 401 / 404, and
  `fold-lane-bakery` answered `01790819484141-dgmag4`, `fretwork-1`
  `01790404806543-kk6qsh`.

**One deploy run**, 2175 (36834581890, `push` on `2188f706`), `completed` /
`success`:
- **the gate** was set for `2188f706…`, taking over from `322c2430…`, and the
  drain answered `no live leases after 0s — deploying`; the clear step left
  it to expire on `DEPLOY_OUTCOME: success`;
- **the image**: the log answered `built
  isibi-app-sitebuildcontainer:c051f625db27b5b7 (registry answered 404; 189
  inputs off ./Dockerfile)` (masked `c05***f625db27b5b7`, `***89`), 15 layers
  `Pushed`, no second attempt; and Wrangler's container step `EDIT
  isibi-app-sitebuildcontainer`, `- "image": …:b8c8789aa8e395d6` / `+
  "image": …:c051f625db27b5b7`, `SUCCESS Modified application
  isibi-app-sitebuildcontainer`, `Applied changes`;
- **timings**: image step **7m37s** (08:09:54–08:17:31), outside the band
  for a roll (2m06s–2m16s on 2138, 2139 and 2143; up to ~3m on a cold
  runner). Read from the step's own timestamps: 0 `CACHED` lines as always,
  and the first `RUN apt-get update && apt-get install … chromium …` layer
  alone took **355.8 s**; the rest of the build ~31 s and the push 63 s. A
  slow package mirror on the runner, not a change of ours: the Dockerfile's
  apt layer did not move. Wrangler 19 s (08:17:32–08:17:51), job 8m24s
  (08:09:30–08:17:54);
- **Wrangler**: `DEPLOY_ID` `2188f70680a844a3e7c56dd339a0483e357b51af`
  (masked); one asset uploaded, `+ /chat.js` (`Uploaded 1 of 1 asset`, 85
  already uploaded); `Uploaded isibi-app`, `Deployed isibi-app triggers`,
  `Current Version ID: 6aa6d40…-2efb-4a03-be36-4…376e355df5` (masked).

**The served file, read after** (08:20:32Z): `/chat.js` 200, 790,308 bytes,
sha256 `b294117a4d1de7bb…`, **byte-identical to `2188f706:public/chat.js`**,
with 3 occurrences of `rowsAdded` (0 before). The gates answered 401 / 401 /
401 / 404, as before every deploy; `fold-lane-bakery` still answers
`dgmag4` and `fretwork-1` `kk6qsh`. The image rolled at 08:17:51Z, so
container work waits 15–20 minutes.

**Deployed, not runtime-confirmed**: the free canary press reads the Worker's sha and a cold
container's image. The session's one dispatch, at 08:32:55Z (15 minutes
after the roll), answered **403** (`Resource not accessible by integration`)
and was not retried, so the press is the owner's.

**Deploy 2176 (2026-10-01) was predicted on both ends and reused as
predicted**: `origin/main` `2188f706` and the candidate `78a95a47` both
answered `c051f625db27b5b7`, from the same 189 inputs (159 distinct paths).
The push carried the parallel `site build` (`34fbd36d`) and its records
(`78a95a47`): two workflow files (`site-build.yml`, `unit.yml`), a script,
tests and documents. **No product file moved**: nothing under `public/`,
`builder/`, `worker.js`, the root modules, the Dockerfile or the package
files. It deployed at all because a workflow file is not in `deploy.yml`'s
ignored paths. **A fast-forward of 4 commits**, `2188f706` → `78a95a47` at
09:41:11Z, on the owner's word ("The CI changes through 78a95a47 pass review.
Merge them into main and monitor deployment"). Checked first:
- **the candidate unchanged**: the branch on GitHub was exactly `78a95a47`,
  and main was still `2188f706`;
- **nothing in flight on GitHub**: no run in progress or queued. `edit_jobs`
  was not read (no Supabase connector here); the deploy's drain is that
  reading;
- **CI**: unit run 36842657567 on `78a95a47` itself, `8531 / 8527 / 0 / 4`.
  The full `site build`, run 36841508489, ran on `34fbd36d`, and **was not
  repeated, on the owner's word**: `78a95a47` changed documents only, and
  both commits print the same inputs fingerprint, `1d31ea591baf27b1` (3,967
  files), which the run's gate printed (`ALL CHECKS: 404 checks in 27
  sections across 4 shards, every job green`);
- **the rollback**: reverting `2188f706..78a95a47` in a throwaway worktree
  gives main's own tree (`026b9c93…`);
- **no served-file reading**: nothing under `public/` changed.

**One deploy run**, 2176 (36844328324, `push` on `78a95a47`), `completed` /
`success`, the job 44 s (09:41:17–09:42:01):
- **the gate** was set for `78a95a47…`, taking over from `2188f706…`, and the
  drain answered `no live leases after 1s — deploying` (masked `***s`);
- **the image**: `reused isibi-app-sitebuildcontainer:c051f625db27b5b7
  (registry answered 200; 189 inputs off ./Dockerfile)` (masked
  `c05***f625db27b5b7`, `***89`), in 1 s; Wrangler's container step answered
  `no changes isibi-app-sitebuildcontainer`, the image
  `…:c051f625db27b5b7`. **No roll, so no wait** before container work;
- **Wrangler** (15 s): `DEPLOY_ID` `78a95a47bfe5eaf3880fdcfd07f8bb4e083031b7`
  (masked); `No updated asset files to upload`; `Uploaded isibi-app`,
  `Deployed isibi-app triggers`, `Current Version ID:
  e2c54aba-778e-4d6e-b5a…-ed3f0f0525a9` (masked). The `npm error npx
  canceled … wrangler` line before it is the action's check for an installed
  Wrangler, also in 2175's log.

**Deployed, not runtime-confirmed**: the free canary press reads the Worker's
sha and a cold container's image. No dispatch was attempted (the owner's
word: the known 403 is not repeated), so the press is the owner's, with
`expect_deploy` `78a95a47…` and `expect_image` `c051f625db27b5b7`. It also
serves for deploy 2175, whose product code is the same: no separate check is
asked for the old deployment.

**Runtime-confirmed by the owner's free press, run 85** (36846351799,
2026-10-01 10:00:16–10:00:49 UTC, from `main` at `78a95a47`, spend `no`, on
`fold-lane-bakery`): `build-health 200 deploy=78a95a47bfe5
image=c051f625db27b5b7` and `runtime 200 deploy=78a95a47bfe5 async=true
runner=true`, so both readers answered `78a95a47bfe5` and a cold container
`c051f625db27b5b7`; the zero-cost confirmations passed (the free job settled
`empty` at cost 0); ALL FREE CHECKS PASSED; the balance read 3 and nothing
was charged. Deploy 2175's code is the same, so this is its runtime check
too.

**Deploy 2177 (2026-10-01) was predicted on both ends and built as
predicted**: `origin/main` `78a95a47` answered `c051f625db27b5b7` and the
candidate `25faac78` **`9a71a6384b4206a2`**, from the same 189 inputs (159
distinct paths). The push carried the router fix for Test 11 (`710ad704`:
`builder/site-ask.mjs`, an image input, with its tests, its mutant spec and
records) and the handoff on top (`25faac78`, documents). Nothing under
`public/` moved. **A fast-forward of 5 commits**, `78a95a47` → `25faac78` at
22:50:07Z, **through `25faac78` exactly**, on the owner's word (*"Complete
the approved merge and deployment of the reviewed router fix through
25faac78, reusing the existing passing CI evidence"*); the branch's later
commits (the paused broad plan) stay off `main`. Checked first:
- **the candidate**: `main` was still `78a95a47`, an ancestor of
  `25faac78`; everything after `710ad704` is documents;
- **nothing in flight**: no Actions run in progress or queued; no edit job
  open in `edit_jobs` (the only rows not `done` or `failed` are two `lost`
  jobs from 1 and 2 September, refunded);
- **CI, reused, not repeated**: unit run 36916597462 on `25faac78` itself,
  `8543 / 8539 / 0 / 4`; site build run 36914784000 on `710ad704`, whose
  gate printed *"ALL CHECKS: 404 checks in 27 sections across 4 shards, every
  job green"* at inputs `899b2151f6729573`, the fingerprint `25faac78` prints
  too (3,967 files);
- **the rollback**: reverting `78a95a47..25faac78` in a throwaway worktree
  gives main's own tree (`fe877d94…`);
- **no served-file reading**: nothing under `public/` changed.

**One deploy run**, 2177 (36937413961, `push` on `25faac78`), `completed` /
`success`, the job **15m50s** (22:50:15–23:06:05):
- **the gate** was set for `25faac78…`; the drain answered `no live leases
  after 1s — deploying` (masked `***s`), and the gate was `left to expire`
  for the new sha;
- **the image**: `built isibi-app-sitebuildcontainer:9a71a6384b4206a2
  (registry answered 404; 189 inputs off ./Dockerfile)` (masked
  `9a7***a6384b4206a2`, `***89`). 0 `CACHED` lines, as always; 15 layers
  `Pushed` and 4 `Layer already exists`; the digest `sha256:ea2d9cc8…`. Then
  Wrangler's container step: `EDIT isibi-app-sitebuildcontainer`, `-
  "image": …:c051f625db27b5b7` / `+ "image": …:9a71a6384b4206a2`, `SUCCESS
  Modified application isibi-app-sitebuildcontainer` at **23:05:58Z**;
- **timings**: image step **15m07s** (22:50:35–23:05:42), the slowest
  recorded, and not for 2175's reason: the apt layer took **20.6 s** this
  time, and the build was named at 22:51:28. The push began at 22:51:29;
  fourteen layers were up by 22:52:01, and **the last one,
  `2d5c0e5a6b4b`, finished at 23:05:35, about 13½ minutes for one layer's
  upload** to the registry. Nothing of ours changed the Dockerfile. Wrangler
  17 s (23:05:43–23:06:00);
- **Wrangler**: `DEPLOY_ID` `25faac78e192ad6923544f90eb7cdb81c8e4c385`
  (masked); `No updated asset files to upload`; `Uploaded isibi-app`,
  `Deployed isibi-app triggers`, `Current Version ID:
  b96e7f53-7733-4c23-8…d9-64a5857…d762` (masked). The `npm error npx
  canceled … wrangler` line is the action's check for an installed Wrangler,
  as in 2175 and 2176.

**The image rolled at 23:05:58Z**, so container work waits 15–20 minutes:
the free runtime check is not to be pressed before 23:26 UTC.

**Deployed, not runtime-confirmed**: the free canary press reads the
Worker's sha and a cold container's image. No dispatch was attempted (the
known 403 is not repeated), so the press is the owner's, with
`expect_deploy` `25faac78…` and `expect_image` `9a71a6384b4206a2`, together
with Test 11's boxes (the checklist's *Test 11*, *Deploy 2177*).

**Runtime-confirmed by the owner's free press, run 87** (36940738610,
2026-10-01 23:25:37–23:26:37 UTC, 19½ minutes after the roll, from `main` at
`25faac78`, spend `no`, on `fold-lane-bakery`): `build-health 200
deploy=25faac78e192 image=9a71a6384b4206a2` and `runtime 200
deploy=25faac78e192 async=true runner=true`, so both readers answered
`25faac78e192` and a cold container `9a71a6384b4206a2`; the zero-cost
confirmations passed (the free jobs `52ab9449…` and `c47d529b…` settled
`empty` at cost 0, billing `none`); ALL FREE CHECKS PASSED. The balance read
101 and nothing was charged (read again in Supabase: the ledger's last row
still 349, no job open).

**Deploy 2178 (2026-10-02) was predicted on both ends and built as
predicted**: `origin/main` `25faac78` answered `9a71a6384b4206a2` and the
candidate `706c9b66` **`a412daac10dbc936`**, from the same 189 inputs (159
distinct paths), two of which differ: `worker.js` and
`builder/site-ask.mjs`. The push carried the router audit's decision report
and the canary's routing-only batch (`1a8290e7`, corrected after the
owner's review at `4866b15b`), the audit and its records, and the paused
broad plan (`72c1c90c`, `f7b57ae9`: documents, and five fixture files under
`docs/test-fixtures/broad-batches/` that no code reads). Nothing under
`public/` moved. **A fast-forward of 12 commits**, `25faac78` → `706c9b66`
at 02:18:36Z, on the owner's word (*"merge and deploy and then i will run
it"*). Checked first:
- **the candidate**: `main` was still `25faac78`, an ancestor of
  `706c9b66`, read again just before the push;
- **nothing in flight**: no Actions run in progress (run 89, the owner's
  press from `main` at 02:15, had already ended: its canary step failed
  after about a second, and it charged nothing); no edit job open in
  `edit_jobs` (the only rows not `done` or `failed` are the two `lost` jobs
  from 1 and 2 September, refunded);
- **CI, reused, not repeated**: unit run 36953951717 on `706c9b66` itself,
  `8581 / 8577 / 0 / 4`; site build run 36949313442 on `1a8290e7`, 404
  checks in 27 sections, every job green, at inputs `7c819874b50c4249`, the
  fingerprint `706c9b66` prints too (3,967 files);
- **the rollback**: reverting `25faac78..706c9b66` in a throwaway worktree
  gives main's own tree (`f45fb56e…`);
- **no served-file reading**: nothing under `public/` changed.

**One deploy run**, 2178 (36955027635, `push` on `706c9b66`), `completed` /
`success`, the job **3m48s** (02:18:41–02:22:29):
- **the gate** was set for `706c9b66…` (taking over from `25faac78…`); the
  drain answered `no live leases after 1s — deploying` (masked `***s`), and
  the gate was `left to expire` for the new sha;
- **the image**: `built isibi-app-sitebuildcontainer:a412daac10dbc936
  (registry answered 404; 189 inputs off ./Dockerfile)` (masked
  `a4***2daac***0dbc936`, `***89`). 0 `CACHED` lines, as always; 15 layers
  `Pushed` and 4 `Layer already exists`; the digest `sha256:7ea…` (masked).
  Then Wrangler's container step: `EDIT isibi-app-sitebuildcontainer`, `-
  "image": …:9a71a6384b4206a2` / `+ "image": …:a412daac10dbc936`, `SUCCESS
  Modified application isibi-app-sitebuildcontainer` at **02:22:23Z**;
- **timings**: image step **3m05s** (02:19:03–02:22:08), back near the
  ordinary rebuild band after 2177's 15m07s. The apt layer took 20.0 s and
  the build was named at 02:20:00. The push began at 02:20:04, every layer
  but one was up by 02:20:38, and the last, `4a8d6864dcf4`, finished at
  02:22:00 (about 1m56s for that layer). Wrangler 16 s (02:22:09–02:22:25);
- **Wrangler**: `DEPLOY_ID` `706c9b66dfce513dcc3a8677acd8438454b02045`
  (masked); `No updated asset files to upload`; `Uploaded isibi-app`,
  `Deployed isibi-app triggers`, `Current Version ID:
  02a5a267-c560-410c-8a33-8e10e46b9a4a` (masked `4***0c` and
  `8e***0e46b9a4a`; the group lengths fix each run at one `1`). The `npm
  error npx canceled … wrangler` line is the action's check for an
  installed Wrangler, as before.

**The image rolled at 02:22:23Z**, so container work waits 15–20 minutes:
the routing-only batch, whose own preflight is this deploy's runtime check,
is not to be pressed before 02:43 UTC.

**Deployed, not runtime-confirmed**: no dispatch was attempted (the known
403 is not repeated). The batch's press carries `expect_deploy` `706c9b66…`
and `expect_image` `a412daac10dbc936`, and its runtime check reads both
before any routing call. The money, read after the push and again at 02:27
UTC: balance 96, the ledger's last row 350 (run 88), no job open. The bakery
still serves `01790819484141-dgmag4` (read at 02:30 UTC: `/visit` shows its
one photograph, `d5d59152….jpg`), F1's recorded starting condition.

**Runtime-confirmed by the owner's paid batch press, run 90** (36956314832,
2026-10-02 02:35:12–02:41:22 UTC, from `main` at `706c9b66`, spend `yes`,
`router-audit-1`). It was pressed 12m49s after the roll, before the
suggested 02:43, and the image check passed all the same: `build-health 200
deploy=706c9b66dfce image=a412daac10dbc936` and `runtime 200
deploy=706c9b66dfce async=true runner=true`. So both readers answered
`706c9b66dfce`, and a cold container `a412daac10dbc936`. The batch mode
exits above the free checks, so no zero-cost job ran (by design: its own
checks replace a separate free press). The batch then routed its 18
messages for 24 credits (96 → 72; no ledger row after 350, no job created;
read in Supabase at 02:45 UTC). The readings are in
`docs/investigations/router-audit.md` §5.

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
