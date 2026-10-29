# Deploy record: timings and image-id predictions

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). The rules are in
> `docs/deploy.md`, where CLAUDE.md's **Deploy** section moved in the second
> pass. This file keeps the measurements behind them: the
> timing bands, every image-id prediction checked against a deploy's own log
> (deploys 2137–2187), and the served-file check driven end to end on deploy
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

**Deploy 2179 (2026-10-02) was predicted on both ends and built as
predicted**: `origin/main` `706c9b66` answered `a412daac10dbc936` and the
candidate `f9979497` **`a4409e55d3f3eb09`**, from the same 189 inputs (159
distinct paths), eight of which differ: `worker.js`,
`builder/component-api.mjs`, `builder/lovable/template` (the kit's header
and frame), `builder/site-add.mjs`, `builder/site-addon.mjs`,
`builder/site-ask.mjs`, `builder/site-images.mjs` and
`builder/site-nav.mjs`. The push
carried run 90's five additions, fixed (`202c554a`), their validation batch
(`a5282a6f`), two reply corrections (`6c69d155`, `03e664aa`), the owner's
review round (`f18af0df`, `dbc520f2`) and their records. **`public/` moved**:
`chat.js` and `edit-poll.js`. **A fast-forward of 11 commits**, `706c9b66` →
`f9979497` at 06:00:21Z, on the owner's word (*"The review of f9979497
passes. Merge and deploy these fixes, reusing the passing CI where its inputs
are unchanged."*). Checked first:
- **the candidate**: `main` was still `706c9b66`, an ancestor of
  `f9979497`, read again just before the push;
- **nothing in flight**: no Actions run in progress or queued; no edit job
  open in `edit_jobs` (only `done` and `failed` rows, and the two `lost`
  jobs from 1 and 2 September; the newest row 2026-10-01 23:52 UTC);
- **CI, reused, not repeated**: unit run 36970385602 on `f9979497` itself,
  `8648 / 8644 / 0 / 4`; site build run 36969632759 on `dbc520f2`, 404
  checks in 27 sections, every job green, at inputs `5e086e2167f6637e`, the
  fingerprint `f9979497` prints too (3,967 files);
- **the rollback**: reverting `706c9b66..f9979497` in a throwaway worktree
  gives main's own tree (`991fe75d…`);
- **the served files, read before the push** (05:59:10 UTC): `chat.js`
  790,308 bytes `b294117a…` and `edit-poll.js` 30,203 bytes `930e7daa…`,
  both main's own.

**One deploy run**, 2179 (36971490099, `push` on `f9979497`), `completed` /
`success`, the job **2m54s** (06:00:28–06:03:22):
- **the gate** was set for `f9979497…` (taking over from `706c9b66…`), until
  06:45:53; the drain answered `no live leases after 1s — deploying`
  (masked `***s`);
- **the image**: `built isibi-app-sitebuildcontainer:a4409e55d3f3eb09
  (registry answered 404; 189 inputs off ./Dockerfile)` (masked `***89`).
  0 `CACHED` lines, as always; 15 layers `Pushed` and 4 `Layer already
  exists`; the digest `sha256:924…` (masked). Then Wrangler's container
  step: `EDIT isibi-app-sitebuildcontainer`, `- "image":
  …:a412daac10dbc936` (masked `a4***2daac***0dbc936`) / `+ "image":
  …:a4409e55d3f3eb09`, `SUCCESS Modified application
  isibi-app-sitebuildcontainer` at **06:03:16Z**;
- **timings**: image step **2m06s** (06:00:53–06:02:59), in the ordinary
  rebuild band (2m02s–2m36s on most earlier rebuilds here; 2178 took
  3m05s). The apt layer took 20.9 s and the build was named
  at 06:01:54. The push began at 06:01:55, and the last layer,
  `560bfadc5f7e`, finished at 06:02:53. Wrangler 18 s
  (06:03:00–06:03:18);
- **Wrangler**: `DEPLOY_ID` `f99794979e2590937154d51d1d4f4a15c469d8ef`
  (masked); `Read 99 files from the assets directory`, `Found 2 new or
  modified static assets to upload`, `Uploaded 2 files (84 already
  uploaded)`; `Uploaded isibi-app`, `Deployed isibi-app triggers`,
  `Current Version ID: b869fc…-45ec-80b5-…` (masked in three places). The
  `npm error npx canceled … wrangler` line is the action's check for an
  installed Wrangler, as before.

**The served files match the merged ones**: `chat.js` 792,850 bytes
`accef38ab1e2efe2…` and `edit-poll.js` 30,805 bytes `f789912afdc01386…`,
byte-identical to `f9979497`'s (`cmp`), `chat.js` first seen at 06:03:34Z,
18 s after the roll.

**The image rolled at 06:03:16Z**, so container work waits 15–20 minutes:
press 1 (the routing-only controls, whose own preflight is this deploy's
runtime check) from about 06:20 UTC, and press 2 (the additions, which run
in the container) only after press 1 passes.

**Deployed, not runtime-confirmed**: no dispatch was attempted (the known
403 is not repeated). Both presses carry `expect_deploy` `f9979497…` and
`expect_image` `a4409e55d3f3eb09`, and press 1's preflight reads both before
any routing call. The money, read before the push at 05:59 UTC: balance 72,
the ledger's last row 350, no job open. The bakery still serves
`01790819484141-dgmag4` (read at 06:00 UTC: `/visit` shows its one
photograph, `d5d59152….jpg`), F1's recorded starting condition.

**Runtime-confirmed by the owner's paid controls press, run 91**
(36973396657, 2026-10-02 06:24:29–06:26:53 UTC, from `main` at `f9979497`,
spend `yes`, `addition-fix-1`), pressed 21 minutes after the roll:
`build-health 200 deploy=f99794979e25 image=a4409e55d3f3eb09` and `runtime
200 deploy=f99794979e25 async=true runner=true`, so both readers answered
`f99794979e25`, and a cold container `a4409e55d3f3eb09`; the expected-build
and expected-image checks both `ok`. The batch mode exits above the free
checks, so no zero-cost job ran (by design). It then routed its 8 messages
for 10 credits, every answer the model's own and as intended (no ledger row
after 350, no job created; read in Supabase at 06:29 UTC). The readings are
in `docs/history/2026-10-02-additions.md` §11.1.

**Deploy 2180 (2026-10-03) was predicted on both ends and built as
predicted**: `origin/main` `f9979497` answered `a4409e55d3f3eb09` and the
candidate `b8d12ff9` **`8bfc67dc695e65cc`**, from 191 inputs (161 distinct
paths). The push carried everything reviewed on the branch since deploy 2179,
together, on the owner's word (*"Merge and deploy the reviewed branch once,
carrying the approved router batches and clarification fixes together."*):
the whole-router audit and router batches 1 and 2 with their review fixes
(`22b0f93b` … `a8ed6b73`), questions back on a site that exists and the
owner's four reviews of it (`4d2f10ed`, `2965e405`, `09029550`, `a38adac3`,
`5cbd5239`), and their records. **`public/` moved**: `chat.js` and
`edit-poll.js`. **A fast-forward of 32 commits**, `f9979497` → `b8d12ff9`.
Checked first:
- **the candidate**: `main` was still `f9979497`, an ancestor of `b8d12ff9`;
- **nothing in flight**: no Actions run in progress or queued anywhere; no
  edit job open (`edit_jobs` holds only `done` and `failed` rows, and the two
  `lost` jobs from 1 and 2 September);
- **required CI on the candidate's code**: unit tests run 37090241036 on
  `5cbd5239`, `8972 / 8968 / 0 / 4`; site build run 37090241073 on
  `5cbd5239`, all 8 jobs green (404 checks in 27 sections across 4 shards);
  the two records commits on top are documents only, and unit tests ran green
  on each (37090418289 on `94e79672`, 37090691422 on `b8d12ff9`);
- **the rollback**: reverting `f9979497..b8d12ff9` in a throwaway worktree
  gives main's own tree (`36200b65…`);
- **the served files, read before the push** (02:55 UTC): `chat.js` 792,850
  bytes and `edit-poll.js` 30,805 bytes, both `f9979497`'s own;
- **the money**: balance 137 on the building account, the ledger's last row
  355, no job open.

**One deploy run**, 2180 (37091465975, `push` on `b8d12ff9`), `completed` /
`success`, the job **2m43s** (02:55:30–02:58:13):
- **the gate** was set at 02:55:49–02:55:50; the drain answered `no live
  leases after 1s — deploying` (masked `***s`), and after Wrangler the gate
  was `left to expire for b8d12ff9…`;
- **the image**: `built isibi-app-sitebuildcontainer:8bfc67dc695e65cc
  (registry answered 404; 191 inputs off ./Dockerfile)` (masked `***9***`).
  15 layers `Pushed` and 4 `Layer already exists`. Then Wrangler's container
  step: `EDIT isibi-app-sitebuildcontainer`, `- "image":
  …:a4409e55d3f3eb09` / `+ "image": …:8bfc67dc695e65cc`, `SUCCESS Modified
  application isibi-app-sitebuildcontainer` at **02:58:09Z**;
- **timings**: image step **2m03s** (02:55:50–02:57:53), in the ordinary
  rebuild band. The image was named at 02:56:41, the push began at 02:56:42,
  and the last layer finished at 02:57:47. Wrangler 17 s (02:57:54–02:58:11);
- **Wrangler**: `DEPLOY_ID` `b8d12ff9fe92a79a8ba6050428d9477b31677943`
  (masked); `Read 99 files from the assets directory`, `Found 2 new or
  modified static assets to upload` (`+ /edit-poll.js`, `+ /chat.js`),
  `Uploaded 2 files (84 already uploaded)`; `Uploaded isibi-app`, `Deployed
  isibi-app triggers`, `Current Version ID: 2729da48-4290-4437-ace3-…`
  (masked).

**The served files match the merged ones** (read at 02:59 UTC): `chat.js`
829,182 bytes `d90a0553…` and `edit-poll.js` 42,187 bytes `638f832e…`,
byte-identical to `b8d12ff9`'s (`cmp`).

**The image rolled at 02:58:09Z**, so container work waited 15–20 minutes,
to about 03:14 UTC.

**Deployed, not runtime-confirmed**: the free runtime check is the owner's
press (spend `no`, `expect_deploy` `b8d12ff9`, `expect_image`
`8bfc67dc695e65cc`). The session made one dispatch at 03:14:13 UTC, after the
wait; it answered `403 Resource not accessible by integration` and was not
retried. The unauthenticated gates answered 401, 401, 401 and 404 at 03:14:23
UTC (up, not a version reading). The press's exact boxes are in
`docs/history/2026-10-03-live-matrix.md` §1.3.

**Deploy 2180's own runtime check was never pressed.** Deploy 2181 runs its
code plus the branch's reviewed changes, so 2181's runtime check stands for
it.

**Deploy 2181 (2026-10-04) was predicted on both ends and built as
predicted**: `origin/main` `b8d12ff9` answered `8bfc67dc695e65cc` (191
inputs, 161 distinct paths) and the candidate `f69c873c`
**`882477e1bbbe8cbe`**, from 194 inputs (164 distinct paths), the id it had
at `41286bb3`. 23 paths differ: `worker.js`, 21 builder modules and the
Dockerfile, whose one changed line adds the three new modules
(`builder/input-budget.mjs`, `builder/request.mjs`,
`builder/site-reply.mjs`). The push carried everything reviewed on the branch
since deploy 2180, on the owner's word (*"Approve the merge and deployment of
the reviewed branch. … merge and deploy once. Keep REQUEST_FLOW off and
MODEL_REPLIES on."*):
- model-written replies with the owner's review;
- the information limits' batch 1;
- the mixed-work fixes, and the footer lists and menu;
- the combined request flow with its two review rounds (off);
- the request batch's instruments;
- their records.

**`public/` moved**: `chat.js`, `edit-poll.js` and `styles.css`. **A
fast-forward of 36 commits**, `b8d12ff9` → `f69c873c` at 01:02:00Z. Checked
first:
- **the candidate**: `main` was still `b8d12ff9`, an ancestor of `f69c873c`;
- **nothing in flight**: no Actions run in progress or queued; no open job
  and no live lease in `edit_jobs` (01:01:07 UTC);
- **unit CI on the candidate itself**: run 37166334976 on `f69c873c`, `9275
  / 9271 / 0 / 4`, the local total exactly;
- **the site build, reused**: run 37159581943 on `41286bb3`, every one of
  its 8 jobs green (`all checks` among them), at inputs `70ac3011f592eab2`,
  the fingerprint `f69c873c` reads too (3,972 files). None of the 20 files
  changed since then matches any of its 33 path patterns: scripts, tests, a
  fixture picture, the canary workflow's help text and documents;
- **the rollback**: reverting `b8d12ff9..f69c873c` in a throwaway worktree
  gives main's own tree (`a542846c…`);
- **the served files, read before the push** (01:01:31 UTC): `chat.js`
  829,182 bytes `d90a0553…`, `edit-poll.js` 42,187 bytes `638f832e…` and
  `styles.css` 348,527 bytes `9a72381a…`, all `b8d12ff9`'s own;
- **the money**: balance 137 on the building account, the ledger's last row
  355, no job open.

**One deploy run**, 2181 (37166771523, `push` on `f69c873c`), `completed` /
`success`, the job **2m54s** (01:02:08–01:05:02):
- **the gate** was set at 01:02:34 for `f69c873c…` (taking over from
  `b8d12ff9…`), until 01:47:34; the drain answered `no live leases after 1s —
  deploying` (masked `***s`); after Wrangler the gate was `left to expire`;
- **the image**: `built isibi-app-sitebuildcontainer:882477e1bbbe8cbe
  (registry answered 404; 194 inputs off ./Dockerfile)` (masked `***94`).
  0 `CACHED` lines; 15 layers `Pushed` and 4 `Layer already exists`. Then
  Wrangler's container step: `EDIT isibi-app-sitebuildcontainer`, `-
  "image": …:8bfc67dc695e65cc` / `+ "image": …:882477e1bbbe8cbe`, `SUCCESS
  Modified application isibi-app-sitebuildcontainer` at **01:04:54Z**;
- **timings**: image step **2m01s** (01:02:34–01:04:35), in the ordinary
  rebuild band. The apt layer took 21.6 s. The image was named at 01:03:35,
  the push began at 01:03:36, and the last layer finished at 01:04:29.
  Wrangler 20 s (01:04:36–01:04:56);
- **Wrangler**: 25 secrets uploaded by `wrangler secret bulk`; the step's
  environment prints `MODEL_REPLIES: on` and `REQUEST_FLOW: off` in plain
  text, so both are the workflow's fallbacks and neither secret holds a
  value (a secret's value prints `***`). `DEPLOY_ID`
  `f69c873cc6e078b8b47715557a4fcf85c415b485` (masked); `Read 99 files from
  the assets directory`, `Found 3 new or modified static assets to upload`
  (`+ /edit-poll.js`, `+ /styles.css`, `+ /chat.js`), `Uploaded 3 files (83
  already uploaded)`; `Uploaded isibi-app`, `Deployed isibi-app triggers`,
  `Current Version ID: a6836228-445a-4a95-…` (masked).

**The served files match the merged ones** (read at 01:08:57 UTC):
`chat.js` 869,027 bytes `b677eef0…`, `edit-poll.js` 44,578 bytes
`13418673…` and `styles.css` 349,252 bytes `54f6dd2b…`, byte-identical to
`f69c873c`'s.

**The image rolled at 01:04:54Z**, so container work waited 15–20 minutes,
to 01:24:11 UTC (19 minutes).

**Deployed, not runtime-confirmed**: the free runtime check is the owner's
press (spend `no`, `expect_deploy` `f69c873c`, `expect_image`
`882477e1bbbe8cbe`). The session made one dispatch at 01:24 UTC, after the
wait; it answered `403 Resource not accessible by integration` and was not
retried. The unauthenticated gates answered 401, 401, 401 and 404 at 01:24:29
UTC (up, not a version reading). The press's exact boxes are in
`docs/history/2026-10-04-deploy-2181.md` §8. The money after the deploy
(01:10:24 UTC): balance 137, the ledger's last row 355, no job open, no live
lease.

**Runtime-confirmed by the owner's free press, run 93** (37169827364,
2026-10-04 02:02:28–02:03:04 UTC, from `main` at `f69c873c`, spend `no`),
pressed 58 minutes after the roll:
- `build-health 200 deploy=f69c873cc6e0 image=882477e1bbbe8cbe` and
  `runtime 200 deploy=f69c873cc6e0 async=true runner=true`: both readers
  answered `f69c873cc6e0`, and a cold container `882477e1bbbe8cbe`;
- the expected-build and expected-image checks both `ok`, and `ALL FREE
  CHECKS PASSED`;
- its zero-cost job on `fretwork-1` settled `empty` at cost 0, as designed,
  and the control's job on `washhouse-3` ended at cost 0 too; the canary
  stopped before the paid edit.

Nothing was charged: balance 137, the ledger's last row 355, no job open and
no live lease (read at 02:04:37 UTC). The readings are in
`docs/history/2026-10-04-deploy-2181.md` §8.1.

**Deploy 2182 (2026-10-04) is the owner's redeploy of the same commit, with
`REQUEST_FLOW` set** (Phase C of `docs/investigations/request-flow-rollout.md`).
The owner set the GitHub secret `REQUEST_FLOW` and dispatched *Deploy to
Cloudflare* on `main`: run 37170272516, `workflow_dispatch` on `f69c873c`,
`completed` / `success`, the job **50 s** (02:11:17–02:12:07):
- **the gate** was set at 02:11:45 for `f69c873c…`, until 02:56:45, taking
  over from its own id; the drain answered `no live leases after 1s —
  deploying`; after Wrangler it was `left to expire`;
- **the image**: `reused isibi-app-sitebuildcontainer:882477e1bbbe8cbe
  (registry answered 200; 194 inputs off ./Dockerfile)` (masked
  `sitebuildc***tainer`, `***94`), the step 2 s (02:11:45–02:11:47). Wrangler's
  container step answered `no changes isibi-app-sitebuildcontainer`, so
  nothing rolled and no container wait was owed;
- **Wrangler**, 15 s (02:11:47–02:12:02): 25 secrets uploaded; `Read 99 files
  from the assets directory`, `No updated asset files to upload`; `Uploaded
  isibi-app`, `Deployed isibi-app triggers`, `Current Version ID:
  63fb9429-55…` (masked); `DEPLOY_ID` `f69c873c…`, as before;
- **the switches**: the step's environment now prints `REQUEST_FLOW: ***`
  where deploy 2181 printed `off`, so its value now comes from a GitHub
  secret. Every value that is `on` now prints masked (`MODEL_REPLIES`,
  `EDIT_ASYNC_EVERYONE`, `JOB_RUNNER_EVERYONE`, and `on` inside words:
  `acti***s`, `c***tainer`), while `BAND_SPLIT_EVERYONE: off` still prints
  plain. So a secret now holds exactly `on`, which none did at deploy 2181,
  and one change, `REQUEST_FLOW` set to `on`, accounts for both readings.
  **The log cannot show the value itself**: the live reading is the
  request-mode canary (`rq-canary`). `MODEL_REPLIES` is still its fallback
  `on`, now printed masked.

**No served-file check** (no asset changed), and **no separate runtime press**:
the commit and the image are deploy 2181's, runtime-confirmed by run 93, and
only the Worker's secrets changed, which no reader reports. `rq-canary`'s own
preflight reads the deploy and the image again before any routing call. The
money after it (02:13:24 UTC): balance 137, the ledger's last row 355, no job
open, no live lease.

**Deploy 2183 (2026-10-04) was predicted on both ends and built as
predicted**, on the owner's word (*"Merge and deploy the reviewed fixes,
keeping REQUEST_FLOW and MODEL_REPLIES enabled"*): `main` `f69c873c` →
`e84b8e7e`, a fast-forward of 13 commits (run 95's two findings fixed, and
the owner's review round), at 18:10:27 UTC. Run 37223381974, `push` on
`e84b8e7e`, the only run that push started, `completed` / `success`, the job
**2m38s** (18:10:34–18:13:12):
- **before**: unit CI on the candidate `9381 / 9377 / 0 / 4` (run
  37222281427); the site build reused, its fingerprint the same on
  `305c8b7c` and `e84b8e7e` (`2fe758ae0d2fd885`, 3,972 files; run
  37221787375 green); nothing in flight; the rollback giving back `main`'s
  tree; the served files `f69c873c`'s own; balance 95, last row 367;
- **the image**: `built isibi-app-sitebuildcontainer:386607152d4cb319
  (registry answered 404; 194 inputs off ./Dockerfile)` at 18:12:48, as
  predicted (`882477e1bbbe8cbe` → `386607152d4cb319`); 15 layers pushed, 4
  already there;
- **the drain** `no live leases after 1s — deploying`; the gate left to
  expire for `e84b8e7e…`;
- **Wrangler**: 25 secrets, `MODEL_REPLIES` and `REQUEST_FLOW` among them,
  both printed masked as at deploy 2182 (a secret holds `on`; `off` prints
  plain); 2 assets uploaded (`+ /edit-poll.js`, `+ /chat.js`), 84 already
  there; the container's `- …:882477e1bbbe8cbe` / `+ …:386607152d4cb319`,
  `SUCCESS Modified application` at **18:13:06Z**; `Current Version ID:
  f287d2d3-ee05-4d18-…`; `DEPLOY_ID` `e84b8e7e1bb26c4c0dcdfad24b0b089261a1a4e4`;
- **the served files** byte-identical to `e84b8e7e`'s at 18:14:07 (`chat.js`
  876,852 `9c183012…`, `edit-poll.js` 50,048 `b2a9aba6…`; `styles.css`
  unchanged), after the before reading at 18:10:04;
- **the image window** waited once, to 18:30:30;
- **runtime-confirmed by the owner's free press, run 96** (22:19 UTC; the
  session's one dispatch had answered 403): both readers answered
  `e84b8e7e1bb2`, a cold container `386607152d4cb319`, queued jobs and the
  runner on, nothing charged (balance 95, last row 367)
  (`docs/history/2026-10-04-deploy-2183.md` §6.1);
- **the first paid press on it, run 97** (`rq-menu-link`, 23:30–23:34 UTC, on
  the same image, no rebuild): the Classes link put into the three menus that
  lacked it, every site check passed, 4 credits (rows 368–369, balance 91);
  the reply check failed because the canary judged a reply still being
  written, so `rq-batch-r2` was not pressed (§7 of the same file);
- **then, on the same image, run 98** (the free read of run 97's job: its
  reply written by the model) **and run 99** (`rq-batch-r2` from the branch,
  02:32–03:04 UTC on 2026-10-05: R2–R5 all passed, 43 credits, balance 48;
  `docs/history/2026-10-05-batch-r2.md`).

**Deploy 2184 (2026-10-05) was predicted on both ends and built as
predicted**, on the owner's word (*"merge and deploy"*, authorizing the stage
in `docs/investigations/live-check.md`): `main` `cd817fee` → `d75d79f3`, a
fast-forward of 13 commits (the reply placement, the watched refresh, the
reconcile, the three answers, the response order, the prepared live check,
and their records), at 11:44:54 UTC. Run 37304926492, `push` on `d75d79f3`,
the only run that push started, `completed` / `success`, the job **2m46s**
(11:45:00–11:47:46):
- **before** (11:43–11:44 UTC): unit CI on the candidate `9480 / 9474 / 0 /
  6` (run 37301304437); the site build reused, its fingerprint the same on
  `685a922c` and `d75d79f3` (`23a4d36259d3fb7a`, 3,972 files; run
  37282482599 green); nothing in flight (read twice, the second right before
  the push); no open job; the rollback giving back `main`'s tree
  (`49aa5bba…`); no skip-CI marker in the 13 messages; the served files
  `e84b8e7e`'s own (`chat.js` 876,852 `9c183012…`, `edit-poll.js` 50,048
  `b2a9aba6…`, `styles.css` 349,252 `54f6dd2b…`, read at 11:44:33); balance
  48, last row 385;
- **the image**: `built isibi-app-sitebuildcontainer:589e3e4e85a20066
  (registry answered 404; 194 inputs off ./Dockerfile)` at 11:47:21, as
  predicted (`386607152d4cb319` → `589e3e4e85a20066`); digest
  `sha256:982…`;
- **the drain** `no live leases after 1s — deploying`; the gate left to
  expire for `d75d79f3…`;
- **Wrangler**: 25 secrets, `MODEL_REPLIES` and `REQUEST_FLOW` among them,
  both printed masked as at deploys 2182 and 2183 (a secret holds `on`;
  `BAND_SPLIT_EVERYONE: off` prints plain); 1 asset uploaded (`+ /chat.js`),
  85 already there; the container's `- …:386607152d4cb319` /
  `+ …:589e3e4e85a20066`, `SUCCESS Modified application` at **11:47:39Z**;
  `DEPLOY_ID` `d75d79f374923ae9fca02159becc34adb5ba8b12`;
- **the served files** byte-identical to `d75d79f3`'s at 11:49:03 (`chat.js`
  895,780 `188dc2a9…`; `edit-poll.js` and `styles.css` unchanged);
- **the image window** waited once, to 12:05 UTC;
- **runtime-confirmed by the owner's free press, run 100** (12:17 UTC): both
  readers answered `d75d79f37492`, a cold container `589e3e4e85a20066`,
  queued jobs and the runner on, nothing charged (balance 48, last row 385)
  (`docs/history/2026-10-05-deploy-2184.md` §6.1);
- **the live check passed as the owner's paid press, run 101** (`lv-reopen`
  on `fold-lane-bakery`, 12:20–12:34 UTC, from `main`, its preflight
  answering `d75d79f37492` and `589e3e4e85a20066` again). All 75 checks
  passed. 27 credits (balance 48 → 21, ledger rows 386–392, each under the
  press's own refs). Found while reading the evidence, and recorded in the
  backlog: the preview reloads on every reading of a running request; a
  reply that calls a page both updated and left as it was; an add-on
  requirement the customer did not state; and the canary's preview baseline
  for a closed-tab message (`docs/history/2026-10-05-deploy-2184.md` §7).

**Deploy 2185 (2026-10-06) was predicted on both ends and built as
predicted**, on the owner's word (*"I approve executing the prepared release
plan"*, the stage in `docs/investigations/release-plan.md`): `main`
`d75d79f3` → `b2409b3c`, a fast-forward of 28 commits (the reporting batches
to `1f3dc370`, the release check `f448aaba` and the form step's correction
`09470116`, with their records), at 13:02:20 UTC. Run 37467698447, `push` on
`b2409b3c`, the only run that push started, `completed` / `success`, the job
**2m55s** (13:02:27–13:05:22):
- **before** (13:01–13:02 UTC): unit CI on the candidate `9592 / 9577 / 0 /
  15` (run 37466687110); the site build reused, its fingerprint the same on
  `49a67763` and `b2409b3c` (`5b2b0577046173b7`, 3,972 files; run
  37454790999 green); nothing in flight (read twice, the second right before
  the push); no open job; the rollback giving back `main`'s tree
  (`9e6a94d5…`); no skip-CI marker in the 28 messages; the served files
  `d75d79f3`'s own (`chat.js` 895,780 `188dc2a9…`, `edit-poll.js` 50,048
  `b2a9aba6…`, `styles.css` 349,252 `54f6dd2b…`, read at 13:01:54); balance
  21, last row 392;
- **the image**: `built isibi-app-sitebuildcontainer:c7fe818d446dd957
  (registry answered 404; 194 inputs off ./Dockerfile)` at 13:04:54, as
  predicted (`589e3e4e85a20066` → `c7fe818d446dd957`); digest
  `sha256:766d0…`;
- **the drain** `no live leases after 0s — deploying`; the gate left to
  expire for `b2409b3c…`;
- **Wrangler**: 25 secrets, `MODEL_REPLIES` and `REQUEST_FLOW` among them,
  both printed masked as at deploys 2182–2184 (`BAND_SPLIT_EVERYONE: off`
  prints plain); 1 asset uploaded (`+ /chat.js`), 85 already there; the
  container's `- …:589e3e4e85a20066` / `+ …:c7fe818d446dd957`, `SUCCESS
  Modified application` at **13:05:15Z**; `DEPLOY_ID`
  `b2409b3c064917b9d2aaa3bace6e126b20fdb52c`;
- **the served files** byte-identical to `b2409b3c`'s at 13:06:13 (`chat.js`
  903,533 `dd876c6f…`; `edit-poll.js` and `styles.css` unchanged);
- **the image window** waited once, to 13:22 UTC;
- **runtime-confirmed by the owner's free press, run 102** (13:28 UTC): both
  readers answered `b2409b3c0649`, a cold container `c7fe818d446dd957`,
  queued jobs and the runner on, every zero-cost confirmation passed, nothing
  charged (balance 21, last row 392)
  (`docs/history/2026-10-06-deploy-2185.md` §6.1);
- **the live check passed as the owner's paid press, run 103** (`lv-release`
  on `fold-lane-bakery`, 13:47–14:01 UTC, from `main`, its preflight
  answering `b2409b3c0649` and `c7fe818d446dd957` again), after the balance,
  21 at 13:29 and 13:34 UTC, was raised to 35 at the owner's request. Every
  check passed: one message, routed `addon` with the heading held back as
  its own part, both parts done (the add-on and a text edit), the new page
  served and linked from every menu, the heading changed, one new
  visitor-to-owner table, everything else as it was, both replies the
  model's own on screen, and the visitor's form entry stored, read back by
  the owner's route with each entry in its bound column ("Your name *" →
  `name`, "Email *" → `email`). **26 credits** (balance 35 → 9, ledger rows
  393–397, each under the press's own refs)
  (`docs/history/2026-10-06-deploy-2185.md` §7).

**Deploy 2186 (2026-10-07) was predicted on both ends and built as
predicted**, on the owner's word (*"I approve releasing the reviewed branch at
bcc22295 and running the prepared lv-progress verification"*, the stage in
`docs/investigations/progress-release-plan.md`): `main` `b2409b3c` →
`bcc22295`, a fast-forward of 24 commits (the progress messages, their
wording and outcome corrections, the prepared `lv-progress` press and its
verification gaps, with their records), at 00:27:17 UTC. Run 37552048948,
`push` on `bcc22295`, the only run that push started, `completed` /
`success`, the job **3m21s** (00:27:27–00:30:48), the image step 2m21s
(00:27:59–00:30:20; the Docker build 57 s, 0 `CACHED` lines; the push 79 s,
15 layers pushed and 4 already there), Wrangler about 20 s:
- **before** (00:25–00:27 UTC): unit CI green on the candidate itself (run
  37551100422; the total `9716 / 9694 / 0 / 22` from run 37550771397 on
  `7dc16444`); the site build's last green run 37515372064 on `84d46faf`,
  none of the 19 files changed since matched by its path filter; nothing in
  flight (read twice, the second right before the push); no open job; the
  rollback giving back `main`'s tree (`b035439b…`); no skip-CI marker in the
  24 messages; the served files `b2409b3c`'s own (`chat.js` 903,533
  `dd876c6f…`, `edit-poll.js` 50,048 `b2a9aba6…`, `styles.css` 349,252
  `54f6dd2b…`, read at 00:25:57); balance 9, last row 397 (00:26:14);
- **the image**: `built isibi-app-sitebuildcontainer:5f946c22d42a1b10
  (registry answered 404; 195 inputs off ./Dockerfile)` at 00:30:20, as
  predicted (`c7fe818d446dd957` → `5f946c22d42a1b10`, 194 → 195 inputs);
  digest `sha256:53be5a4b3…`;
- **the drain** `no live leases after 1s — deploying` (the 1 printed
  masked); the gate left to expire for `bcc22295…`;
- **Wrangler**: 26 secrets, `PROGRESS_REPLIES` newly among them and
  **printed plain as `off`**, the deploy's fallback: the repository secret is
  not set, so progress is off. `MODEL_REPLIES` and `REQUEST_FLOW` printed
  masked as at deploys 2182–2185 (`BAND_SPLIT_EVERYONE: off` prints plain); 3
  assets uploaded (`+ /edit-poll.js`, `+ /styles.css`, `+ /chat.js`), 83
  already there; the container's `- …:c7fe818d446dd957` /
  `+ …:5f946c22d42a1b10`, `SUCCESS Modified application` at **00:30:40Z**;
  `DEPLOY_ID` `bcc22295dbd1cd5a593af7c95f57ddd90af5495f`, Version ID
  `7d449665-796a-424f-b666-…`;
- **the served files** byte-identical to `bcc22295`'s at 00:31:36 (`chat.js`
  920,280 `0e68e324…`, `edit-poll.js` 52,888 `fa71335f…`, `styles.css`
  350,604 `d7474cd7…`);
- **the image window** waited once, to 00:50:51 UTC;
- **the free runtime check is the owner's press**: the session's one
  dispatch answered `403 Resource not accessible by integration` (00:51:01),
  not retried; the switch (the secret, then *Deploy to Cloudflare* on `main`)
  is the owner's too, because the session's proxy refuses `actions/secrets`;
- **runtime-confirmed by the owner's free press, run 104** (01:13 UTC): both
  readers answered `bcc22295dbd1`, a cold container `5f946c22d42a1b10`,
  queued jobs and the runner on, every zero-cost confirmation passed, nothing
  charged (balance 32, last row 397, no job open); the usage step's free
  probe answered (the Worker's logs readable, 0 narration lines)
  (`docs/history/2026-10-07-deploy-2186.md` §5.1);
- **the funds** raised to exactly 32 at the owner's request at 00:51:37 UTC
  (9 at 00:51:30), read back at 00:51:53: 32, last row 397, no job open
  (`docs/history/2026-10-07-deploy-2186.md`).

**Deploy 2187 (2026-10-07) is the owner's switch: the same commit, the image
reused as predicted, nothing rolled.** The owner set the repository secret
`PROGRESS_REPLIES` and dispatched *Deploy to Cloudflare* on `main`: run
37556365972, `workflow_dispatch` on `bcc22295`, `completed` / `success`, the
job **45 s** (01:17:45–01:18:30):
- **the image**: `reused isibi-app-sitebuildcontainer:5f946c22d42a1b10
  (registry answered 200; 195 inputs off ./Dockerfile)` at 01:18:10;
- **the drain** `no live leases after 0s — deploying`; the gate left to
  expire;
- **Wrangler**: 26 secrets, **`PROGRESS_REPLIES` printed masked** where
  deploy 2186 printed `off` (a secret is set; the press reads the Worker's
  switch for itself, for free); `No updated asset files to upload`; the
  container step `no changes isibi-app-sitebuildcontainer`, `No changes to be
  made`: **nothing rolled**, so no image window is owed and deploy 2186's roll
  stays the release's single one;
- the money after it (01:19:01 UTC): balance 32, last row 397, no job open
  (`docs/history/2026-10-07-deploy-2186.md` §6.1);
- **the live check, the owner's paid press, run 105** (`lv-progress` on
  `fold-lane-bakery`, 01:22–01:37 UTC, from `main`, its preflight answering
  `bcc22295dbd1` and `5f946c22d42a1b10` again) **failed two checks, both on
  the new menu link's words**: every page's menu gained "Common questions" →
  `/faq` where the check required "FAQ". Every other check passed: the
  request (routed `addon`, the heading its own part, both done), the FAQ page
  with its three answers, the Classes heading, every other page as it was,
  both replies the model's own, the money, and **all eight progress checks**
  (the first line live 150 s after the send, the tab closed, a fresh session
  following the request to its end). **22 credits** (balance 32 → 10, ledger
  rows 398–401). The narration added no charge. Its five line calls were
  measured at $0.00848 (a floor); the task titles' calls were not found in
  the logs, so their usage stays unverified. Not run again, under the owner's
  rule (`docs/history/2026-10-07-deploy-2186.md` §8).

**Deploy 2188 (2026-10-07) was predicted on both ends and built as
predicted**, on the owner's word (*"I approve releasing the prepared batch and
running its one combined live verification, with a maximum spend of 40
credits"*, the stage in `docs/investigations/combined-release-plan.md`):
`main` `bcc22295` → `9d6bda8a`, a fast-forward of 36 commits (the Edit/Add-on
cleanup batch, its correction round and follow-up, the recovery correction
reviewed by Codex at `092ff48a`, the prepared `lv-combined` press, and their
records), pushed at 23:04:49 UTC. Run 37700151308, `push` on `9d6bda8a`, the
only run that push started, `completed` / `success`, the job **3m11s**
(23:04:56–23:08:07), the image step 2m17s (23:05:22–23:07:39), Wrangler 23 s:
- **before** (23:03–23:04 UTC): the candidate `9d6bda8a`, `main` its
  ancestor; **no product file changed since the reviewed `092ff48a`** (the
  only file outside docs, tests and scripts is the dispatch-only canary form,
  `.github/workflows/edit-canary.yml`), and only documents between
  `570adb45` and `092ff48a`; unit CI green on the candidate itself (run
  37698296313, `9885 / 9863 / 0 / 22`); the site build's gate green on
  `570adb45` (run 37674861320 attempt 2, 404 checks), its inputs
  `de6345b9058cd1cc` (3,974 files) the same at `9d6bda8a`; nothing in flight
  (read twice, the second right before the push); no open job in any
  account; balance 40, last row 401 (23:03:55); the rollback giving back
  `main`'s tree (`dcd4e727…`); no skip-CI marker in the 36 messages;
  `chat.js` served as `bcc22295`'s (920,280 `0e68e324…`, 23:04:25);
- **the image**: `built isibi-app-sitebuildcontainer:335396c8c0e0fbcb
  (registry answered 404; 196 inputs off ./Dockerfile)` at 23:07:39, as
  predicted (`5f946c22d42a1b10` → `335396c8c0e0fbcb`, 195 → 196 inputs,
  seventeen differing);
- **the drain** `no live leases after 1s — deploying` (the 1 printed masked);
- **Wrangler**: 26 secrets, `PROGRESS_REPLIES`, `MODEL_REPLIES` and
  `REQUEST_FLOW` printed masked (progress stays on); 1 asset uploaded
  (`+ /chat.js`), 85 already there; the container's `- …:5f946c22d42a1b10` /
  `+ …:335396c8c0e0fbcb`, `SUCCESS Modified application` at **23:07:59Z**;
  `DEPLOY_ID` `9d6bda8afc4e8a99850bd1aff8cf412531a0ef23`, Version ID
  `f2fc7b48-4b07-4c83-a8f4-…`;
- **the served files** byte-identical to `9d6bda8a`'s at 23:08:44
  (`chat.js` 939,255 `dfa07592…`; `edit-poll.js` `fa71335f…`, `styles.css`
  `d7474cd7…` and `/` `84a910b8…`, unchanged by the release);
- **the image window** waited once, to 23:25:05 UTC;
- **the free runtime check is the owner's press**: the session's one
  dispatch answered `403 Resource not accessible by integration` (23:25:15),
  not retried (`docs/history/2026-10-07-combined-release.md`);
- **runtime-confirmed by the owner's free press, run 106** (23:35 UTC): both
  readers answered `9d6bda8afc4e`, a cold container `335396c8c0e0fbcb`,
  queued jobs and the runner on, every zero-cost confirmation passed, nothing
  charged (balance 40, last row 401, no job open);
- **the live check, the owner's paid press, run 107** (`lv-combined` on
  `fold-lane-bakery`, 23:38–23:59 UTC, its preflight answering `9d6bda8afc4e`
  and `335396c8c0e0fbcb` again) **failed**: message 2's step asked its
  question 7 minutes after the send, past the press's 6-minute bound, so
  message 3 was not sent and no footer gained the TikTok link. Verified live:
  the Allergens page and its menu link (order held, all eight progress checks,
  the closed tab and the fresh session), the Order heading, the site otherwise
  unchanged, the money. **25 credits** (40 → 15, rows 402–407, row 407 after
  the press stopped). Not pressed again; the question left unanswered
  (`docs/history/2026-10-07-combined-release.md` §4).

**Deploy 2194 (2026-10-12) was a manual redeploy of `df1dcf30`** (the
owner's run of the deploy workflow, `workflow_dispatch`, run 38264751198,
14:41–14:42 UTC, green). The owner set `IMAGE_PURCHASES` back to `on` after
option A's P1 and P2, so this run carries it. The image is still
`1e30b6fb56b51794` (the container reported no changes), no asset was
uploaded, and the Current Version ID is `f61b2bf…`. **Runtime-confirmed by
the owner's free press, run 130** (14:44 UTC). Both readers answered
`df1dcf30f5fb`, and a cold container got `1e30b6fb56b51794`. The runtime
reported **`imagePurchases=true`**. Every zero-cost check passed. Balance
950, and nothing was charged.

**Deploy 2193 (2026-10-12) was predicted on both ends and reused as
predicted**, on the owner's word ("merge") after option A's opt-in. It
fast-forwarded `main` `e1556086` → **`df1dcf30`**, 9 commits: the opt-in
box for P1 and P2 (`959663d7`, scripts, the edit canary workflow and tests)
and records. No product file changed.

It was pushed at 14:02:05 UTC. Run 38259958345, `push` on `df1dcf30`, was
the only run that push started: `completed` / `success`, 14:02:07–14:03:44.

- **Before**:
  - `main` an ancestor of the candidate;
  - unit CI green on `959663d7` (run 38258334612, `10672 / 10631 / 0 / 41`)
    and on `df1dcf30` (run 38259141545), with records only between them;
  - nothing in flight: no running or queued Actions run, and no open edit
    job;
  - the rollback (`git revert --no-commit e1556086..df1dcf30`) giving back
    `e1556086`'s tree (`bf3ca2da…`);
  - no skip-CI or smoke marker in the 9 messages;
  - nothing under `public/` changed, so no served-file check was owed.
- **The image**: `reused isibi-app-sitebuildcontainer:1e30b6fb56b51794`
  (registry 200, 205 inputs), as predicted. The container application
  reported `no changes`, so no image window is owed.
- **Wrangler**: 27 secrets, including `IMAGE_PURCHASES`. The log masks the
  value, so it is read by the runtime press. No asset was uploaded. Current
  Version ID `1d0a1f60…`.
- **Runtime**: **runtime-confirmed by the owner's free press, run 127**
  (run 38261448264 from `main`, 14:14 UTC). Both readers answered
  `df1dcf30f5fb`, and a cold container got `1e30b6fb56b51794`. Async and the
  runner were on, and the runtime reported **`imagePurchases=false`**. Every
  zero-cost check passed. Balance 971, and nothing was charged.

**Deploy 2192 (2026-10-12) was predicted on both ends and built as
predicted**, on the owner's word ("proceed with merging and deploying the
reviewed branch once"), after Codex reviewed `dc3ea241`. It fast-forwarded
`main` `f96cbfd5` → **`e1556086`**, 127 commits: the parallel-work rounds
1–15 (product), the acceptance harness rounds 16–18, and their records.

It was pushed at 11:13:17 UTC. Run 38241259917, `push` on `e1556086`, was
the only run that push started: `completed` / `success`, 11:13:21–11:16:36.

- **Before**:
  - `main` an ancestor of the candidate;
  - unit CI green on `e1556086` (run 38239692820), and site build green on
    `754c4eb4` (run 38195628259), with only harness files and records
    changed since;
  - nothing in flight: no queued or running Actions run, and no open edit
    job;
  - the rollback (`git revert --no-commit f96cbfd5..e1556086`) giving back
    `f96cbfd5`'s tree (`d0adb519…`);
  - no skip-CI or smoke marker in the 127 messages;
  - `public/chat.js` changed. The served file read before the push matched
    `f96cbfd5`'s (`7a9d8498…`, 955,178 bytes).
- **The image**: built `1e30b6fb56b51794` (registry 404, 205 inputs), as
  predicted. The container's `- …:8d6dbcea93252fbb` / `+ …:1e30b6fb56b51794`,
  with `SUCCESS Modified application` at **11:16:24Z**.
- **Wrangler**: 27 secrets, one asset uploaded (`/chat.js`), Current Version
  ID `e3f86489…`. `BAND_SPLIT_EVERYONE`, `DESIGN_SPLIT_EVERYONE` and
  `DESIGN_GRAPH_EVERYONE` read `off` in the log, as before; no flag was
  changed.
- **The served file**: `/chat.js` byte-identical to `e1556086:public/chat.js`
  (`7f7d7b49…`, 965,025 bytes), read at 11:17 UTC.
- **The image window**: to about 11:35 UTC.
- **Runtime**: **runtime-confirmed by the owner's free press, run 123**
  (edit canary, run 38252367780 from `main`, 12:58 UTC; spend `no`,
  expect_deploy `e1556086`, expect_image `1e30b6fb56b51794`). Both readers
  answered `e1556086808c`, a cold container got `1e30b6fb56b51794`, and
  async and the runner were on (`washhouse-3` async too). The runtime reports
  `imagePurchases=true` (the secret was not changed). The free job settled as
  a hand-over at cost 0; the forged replay marker and the foreign poll both
  answered 404. The balance read 971; nothing was charged.

**Deploy 2191 (2026-10-10) was predicted on both ends and built as
predicted**, on the owner's approval to release the reviewed correction
(Codex passed all 23 dispatch, interval and canary tests on `f96cbfd5`). It
fast-forwarded `main` `19b1628d` → **`f96cbfd5`**, 7 commits:
- the dispatch order and the kept preparation attempts (`ac3e5eca`);
- `lv-parallel`'s cap and fresh targets;
- their records.

It was pushed at 00:14:32 UTC. Run 38008189235, `push` on `f96cbfd5`, was
the only run that push started: `completed` / `success`, 00:14:35–00:17:36.

- **Before**:
  - `main` an ancestor of the candidate;
  - the product diff exactly the reviewed one: `worker.js` (the job filed
    before the preparations) and `builder/request.mjs` (kept attempts, the
    claim's time, `prepRuns`);
  - unit CI green on `f96cbfd5`, and unit and site build green on
    `ac3e5eca`;
  - nothing in flight, and no open edit job;
  - the rollback giving back `19b1628d`'s tree;
  - no skip-CI or smoke marker;
  - nothing under `public/` changed.
- **The image**: built `8d6dbcea93252fbb` (registry 404, 204 inputs), as
  predicted. The container's `- …:9236fe341b77544d` / `+ …:8d6dbcea93252fbb`,
  with `SUCCESS Modified application` at **00:17:29Z**.
- **Wrangler**: 26 secrets, no asset uploaded, Current Version ID
  `309e59b…`.
- **The image window**: to about 00:37 UTC.
- **Runtime-confirmed by the owner's free press, run 118** (run
  38010032315, 00:40 UTC, from `main`):
  - both readers answered `f96cbfd56d65`;
  - a cold container answered `8d6dbcea93252fbb`;
  - async and the runner were on;
  - `ALL FREE CHECKS PASSED`;
  - balance 1002, and nothing charged.
- **The approved follow-up, run 119** (run 38011323505, 00:58–01:13 UTC):
  `success`, every check passed, concurrency shown by recorded intervals;
  12 credits (`docs/history/2026-10-10-run119.md`).

**Deploy 2190 (2026-10-09) was predicted on both ends and built as
predicted**, on the owner's word (*"merge and deploy"*). It fast-forwarded
`main` `0fd50fd2` → **`19b1628d`**, 9 commits:
- the interval correction (`f058eed1`);
- `lv-parallel`'s fresh targets (`a220fd54`);
- their records.

It was pushed at 20:28:17 UTC. Run 37987214270, `push` on `19b1628d`, was the
only run that push started: `completed` / `success`, 20:28:22–20:31:41.

- **Before**:
  - `main` an ancestor of the candidate;
  - unit CI green on `f058eed1`, `a220fd54` and `19b1628d`
    (`10288 / 10247 / 0 / 41`), and the site build green on `f058eed1`;
  - nothing in flight;
  - no open edit job (the only non-terminal-looking rows are two `lost`
    jobs from 2026-09-01/02);
  - the rollback (`git revert --no-commit 0fd50fd2..19b1628d`) giving back
    `0fd50fd2`'s tree;
  - no skip-CI or smoke marker in the 9 messages;
  - nothing under `public/` changed.
- **The image**: the container's `- …:6c9fc805fe4de0d8` /
  `+ …:9236fe341b77544d` (the 1 printed masked), as predicted (204 inputs),
  with `SUCCESS Modified application` at **20:31:32Z**.
- **Wrangler**:
  - 26 secrets;
  - *"No updated asset files to upload"*, so no served-file check is owed;
  - Current Version ID `…ff9cd9d-959a-4de2-b93a-8cc435748be2`.
- **The image window**: to about 20:51 UTC.
- **Run 114** (run 37988274955, 20:37 UTC) was pressed inside the image
  window, and with a wrong sha handed over (`19b1628d6ae4`; my error). It
  failed both checks: the Worker answered the right build, `19b1628df403`,
  and a cold container still started the old `6c9fc805fe4de0d8`. Nothing was
  charged.
- **Runtime-confirmed by the owner's free press, run 115** (run 37991441144,
  21:07 UTC, from `main`):
  - both readers answered `19b1628df403` and agreed;
  - a cold container answered `9236fe341b77544d`;
  - async and the runner were on;
  - `ALL FREE CHECKS PASSED`;
  - balance 18, and nothing charged. The site was as read before:
    `/order`'s heading *"Pick your loaf and a collection time"*, version
    `01791558236422-ny0g8t`.

**Deploy 2189 (2026-10-09) was predicted on both ends and built as
predicted** (the owner's word: *"approve the release and press A's
preparation"*; the plan is `docs/investigations/multi-agent-readiness.md`
§7).

`main` `9d6bda8a` → `0fd50fd2`, a fast-forward of 93 commits:
- the parallel-tasks rounds 1–9 and the readiness review;
- the first-Build batches 1–9;
- the run-107 follow-up and the menu-evidence corrections;
- their records.

It was pushed at 13:40:58 UTC. Run 37938596141, `push` on `0fd50fd2`, was
the only run that push started: `completed` / `success`, 13:41:04–13:44:11.

- **Before** (13:38–13:40 UTC):
  - `main` an ancestor of the candidate;
  - unit CI green on `0fd50fd2` itself (run 37937637159) and on `8109aab4`
    (`10272 / 10231 / 0 / 41`). The site build is green on `58d3350b` (run
    37926585858), and only tests and documents changed after it;
  - nothing in flight, and no open or held edit job (`public.edit_jobs`);
  - the rollback (`git revert --no-commit 9d6bda8a..0fd50fd2`) giving back
    `9d6bda8a`'s tree;
  - no skip-CI or smoke marker in the 93 messages;
  - `chat.js` served as `9d6bda8a`'s (939,255 bytes, `dfa07592…`).
- **The image**: `built isibi-app-sitebuildcontainer:6c9fc805fe4de0d8
  (registry answered 404; 204 inputs off ./Dockerfile)` at 13:43:41, as
  predicted (`335396c8c0e0fbcb` → `6c9fc805fe4de0d8`, 196 → 204 inputs).
- **The drain**: `no live leases after 1s — deploying` (the 1 printed
  masked).
- **Wrangler**:
  - 26 secrets;
  - one asset uploaded (`+ /chat.js`), 85 already there;
  - the container's `- …:335396c8c0e0fbcb` / `+ …:6c9fc805fe4de0d8`,
    `SUCCESS Modified application` at **13:44:01Z**;
  - `DEPLOY_ID` `0fd50fd2d05c29cc…`, Current Version ID `69545b2e-b468-…`.
- **The served file**: `chat.js` byte-identical to `0fd50fd2`'s at 13:44:46
  (955,178 bytes, `7a9d8498…`).
- **The image window**: to about 14:04 UTC.
- **The free runtime check is the owner's press**. Run 110 (13:31 UTC) was
  pressed before the merge and read production as it was then (`9d6bda8afc4e`,
  `335396c8c0e0fbcb`); it is not this check.
- **Runtime-confirmed by the owner's free press, run 111** (run 37943299539,
  14:19 UTC, from `main`):
  - both readers answered `0fd50fd2d05c` and agreed;
  - a cold container answered `6c9fc805fe4de0d8`;
  - async and the runner were on;
  - every zero-cost confirmation passed (`ALL FREE CHECKS PASSED`);
  - balance 11, and nothing charged. (The press before it, at about 14:10,
    never started.)

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

## Deploy 2285 — 2026-10-28 21:49 UTC (`fdfd1970b`)

The model writes the site's own server code, on the owner's word "merge and
deploy": the place, the key-safe `site` helper, the publish check and its fix
loop, hooks, streamed answers, the site's own files, exact schedules, every
path (build, add-on, page edit) checked, routing, and the server writer's
checks (sandboxed test run, wiring, keys, never stubbed, live error log).
Record: `docs/history/2026-10-28-site-server-code.md`. A fast-forward from
`8035fc104`; required CI green on the candidate (unit tests run 40772481294,
site build run 40772481400); rollback verified; nothing in flight. Image
predicted: SiteBuildContainer `054fb4d51c826ecc` → `7a577bf068bd9734` (254
inputs), AppBuildContainer `65022ce71e3d7274` unchanged. Run 40775161625 green,
21:49–21:53 UTC. Deployed, not runtime-confirmed.

## Deploy 2284 — 2026-10-28 18:52 UTC (`4a36d69fe`)

The reply's facts carry the typecheck's verdict (after Kiln Lane's "compiled
without errors" beside a type error), on the owner's word "merge and deploy".
A fast-forward of 1 commit from `d3af83ffa`. Required CI green on the candidate
(unit tests run 40746793766, site build run 40746793797); rollback verified;
nothing in flight. Image predicted: SiteBuildContainer `51b82d120c34280c` →
`054fb4d51c826ecc` (250 inputs), AppBuildContainer `65022ce71e3d7274`
unchanged. Run 40749068840 green, 18:52–18:55 UTC; the image step took 2 min 16 s
(a build). **Runtime-confirmed by canary run 171** (19:02 UTC, free, from `main`):
every preflight check passed with the expected deploy `4a36d69fe` and image
`054fb4d51c826ecc` required; nothing charged (balance 603).

## Deploy 2283 — 2026-10-28 03:37 UTC (`363b13aa9`)

The site owns its work: a fast-forward of 30 commits from `2f8006efa`, on the
owner's word "merge and deploy". Required CI green on the candidate (unit tests
run 40626625875, site build run 40626625866). The rollback (`git revert
--no-commit 2f8006efa..363b13aa9`) was verified to give back main's tree, and
no edit job was open.

- SiteBuildContainer `d798304cc28b0e10` → `51b82d120c34280c` (250 inputs),
  built, as predicted.
- AppBuildContainer `65022ce71e3d7274`: no change, as predicted.
- Platform bindings include `SITE_WORKERS (gofarther-sites)`. The front door
  `gofarther-front` was deployed with `PLATFORM (isibi-app)` and `SITES
  (gofarther-sites)`, on `*.gofarther.app/*` and `*/*` on gofarther.dev.
- Served asset changed: `/chat.js`.
- Run 40627724992, green, 03:37–03:40 UTC. Deployed, not runtime-confirmed;
  the image rolled, so wait 15–20 minutes before container work.
- **Runtime-confirmed by canary run 170** (04:41 UTC, free, from `main`): both
  readers answered `363b13aa9d9b`, a cold container got `51b82d120c34280c`, and
  queued jobs and the runner were on; nothing was charged (balance 603). The
  free inventory read `fretwork-1`'s three pages as 0 bytes with no version
  (its stored source read whole). Not yet traced; the likely cause is that it
  was published before this change, so its pages now come from a Worker it
  may not have. Old sites get no compatibility work, on the owner's word.

## Deploy 2263 — 2026-10-23 13:36 UTC (`091f153e1`)

Round 2 of the owner's scheduled audit work (findings 201–264, the end of the list), merged on the owner's advance word. Six fix branches (r2-g1 … r2-g6) combined as `r2-combine`; one conflict (the restore sidecar line, fixed from two sides); an independent review with no high findings and three small fixes (backup only table-less for state `none`, nested dark high-contrast, fresh share host) (`docs/history/2026-10-23-r2-combine.md`). Full suite `12155 / 12151 / 1 / 3` (the one is the local node_modules link). Unit CI 39959485628 and site build 39959485695 green on `091f153`. Deploy run 39962631259 green (13:36–13:40 UTC); the image rolls (worker.js and the kit stylesheet). **Deployed, not runtime-confirmed.** Deploy 2262 (round 1) was not yet runtime-confirmed either; one canary press confirms both.

## Deploy 2262 — 2026-10-23 12:02 UTC (`838cf7364`)

Round 1 of the owner's scheduled audit work (findings 103–200), merged on the owner's advance word. Seven fix branches (r1-g1 … r1-g7) combined as `r1-combine`, then an independent review that found five defects (one high: a visitor's `{{SECRET}}` text rescanned into the owner's secret by the new json/header parameter escapes) and fourteen combine clashes, all fixed (`docs/history/2026-10-23-r1-combine.md`). Full suite `12110 / 12106 / 1 / 3` (the one is the local node_modules link). Unit CI 39947841535 and site build 39947841351 green on `838cf73`. Deploy run 39950315124 green (12:02–12:05 UTC); the image rolls. **Deployed, not runtime-confirmed.** (Deploy 2261, `cab34c133`, was runtime-confirmed by canary run 39850507671, image `3fb084db9b82baf4`.)

## Deploy 2195 — image purchases off for the K/E/M batch (2026-10-12)

- Run 38290702117 (`workflow_dispatch`, 18:24–18:25 UTC), your manual
  redeploy of `main` `df1dcf30`, after `IMAGE_PURCHASES` was set to `off`.
- `IMAGE SiteBuildContainer: reused …:1e30b6fb56b51794` (205 inputs); the
  container application reported "no changes".
- 27 secrets re-uploaded. Nothing under `public/` was uploaded.
- Runtime: verified by the next press's preflight (`imagePurchases=false`
  required before anything is sent).

## Deploy 2196 — image purchases back on after the K/E/M batch (2026-10-12)

- Run 38300553928 (`workflow_dispatch`, 19:52–19:53 UTC), your manual
  redeploy of `main` `df1dcf30`, after `IMAGE_PURCHASES` was set to `on`.
- The container image was reused (`1e30b6fb56b51794`, "no changes"). No
  asset uploads.
- **Runtime-confirmed by run 139** (free, 19:53:53, after the deploy
  ended):
  - both readers answered `df1dcf30f5fb`, and a cold container got
    `1e30b6fb56b51794`;
  - `imagePurchases=true`;
  - balance 876, nothing charged.

## Deploy 2197 — the task-isolation release, image purchases off (2026-10-12)

- On the owner's approval of the isolation release and one `acc-isolation`
  run. `main` fast-forwarded `df1dcf30` → **`64f17488`** (36 commits: the
  isolation fix `83c9015a`, the checker `6dae03bc` and `b34707e6`, the
  scenario `ec7d894c`, the opt-in `64f17488`, and records).
  `IMAGE_PURCHASES` was set to `off` before the merge.
- Run 38316342390 (push, 22:23–22:26 UTC), green. The container image was
  **built**, as predicted on both ends: `1e30b6fb56b51794` →
  **`eda28cb21064287d`** (205 inputs; the registry answered 404 for the new
  id). 27 secrets uploaded; no asset uploads.
- **Runtime-confirmed by run 140** (free, 22:33 UTC):
  - both readers answered `64f174884cf7`, and a cold container got
    `eda28cb21064287d`;
  - `imagePurchases=false`;
  - balance 876, nothing charged.
- Build flags unchanged (`BAND_SPLIT_EVERYONE`, `DESIGN_SPLIT_EVERYONE` and
  `DESIGN_GRAPH_EVERYONE` off), and the 1-page / 15-component limits
  untouched.

## Deploy 2198 — image purchases back on after run 141 (2026-10-12)

- Run 38321179522 (`workflow_dispatch`, 23:15–23:16 UTC), the owner's
  manual redeploy of `main` `64f17488`, after `IMAGE_PURCHASES` was set to
  `on`.
- The container image was reused (`eda28cb21064287d`, "no changes"). 27
  secrets uploaded; no asset uploads.
- **Runtime-confirmed by run 142** (free, 23:17:40 UTC, job 115049977532):
  - both readers answered `64f174884cf7`, and a cold container got
    `eda28cb21064287d`;
  - `imagePurchases=true`, async and the runner on;
  - balance 860, nothing charged.

## Deploy 2199 — the consolidated release: diagnostics, isolation check, correction reuse (2026-10-13)

- **On the owner's approval** of the consolidated release
  (`docs/history/2026-10-13-release-proposal.md`). `main` fast-forwarded
  `64f17488` → **`fef80b9b`** at 12:26:11 UTC. That is 9 commits:
  - the run 141 follow-up, `1bf174fa`;
  - the evidence round, `8626608a`;
  - correction reuse, `372f8ae0`;
  - its natural-change case, `59faf01b`;
  - records.
- **Preflight** (all on `fef80b9b`):

  | Check | Result |
  |---|---|
  | Required CI | Unit tests run 38392132548: `10737 / 10693 / 0 / 44 skipped`, the totals matching. Site build run 38334767139 on `372f8ae0`: success. No file outside `docs/` and `test/` changed after it. |
  | In flight | No Actions run queued or running; no edit job open. |
  | Image prediction | Each end predicted from its own tree: `eda28cb21064287d` (matches production) → `4444d9d53d906b8d`, 205 inputs. |
  | Rollback | `git revert --no-commit 64f17488..fef80b9b` in a throwaway worktree gave back `main`'s exact tree (`d4a71cbf…`). |
  | Untouched | `wrangler.jsonc`, `deploy.yml`, the kit, `build-server.mjs`. No `_EVERYONE` flag line changed. `BALANCE_OPT_IN` is empty. |
  | Balance before | 860, last ledger row 453 (2026-10-12 23:08 UTC). |
- **One deploy run: 2199** (run 38397272252, push, 12:26:16–12:29:22 UTC),
  green.
  - The container image was **built**, as predicted on both ends:
    `built isibi-app-sitebuildcontainer:4444d9d53d906b8d (registry answered
    404; 205 inputs off ./Dockerfile)`.
  - The container application moved `eda28cb21064287d` →
    `4444d9d53d906b8d` at 12:29:12 UTC.
  - 27 secrets uploaded; no updated asset files (nothing under `public/`
    changed); Worker version `ce248600-…`.
  - Build flags as before: `BAND_SPLIT_EVERYONE`, `DESIGN_SPLIT_EVERYONE` and
    `DESIGN_GRAPH_EVERYONE` are `off`. The 1-page / 15-component limits are
    untouched.
- **After the roll** (12:47:25 UTC): balance 860, last ledger row 453, no
  open job. Nothing was charged by the release.
- The session's dispatch of the free canary press answered 403 (the session
  lacks `actions: write`). It was tried once and not retried.
- **Runtime-confirmed by run 143** (the owner's free press, from `main`,
  13:50:47 UTC, job 115333679391, spend `no`, `fold-lane-bakery`):
  - `build-health` 200 and `runtime` 200 both answered `fef80b9bc913`, and
    the two readers agree;
  - a cold container got **`4444d9d53d906b8d`** (the expected image);
  - `imagePurchases=true`, async and the runner on;
  - every free check passed;
  - the free job settled at cost 0;
  - "CANARY_SPEND is not 1 — stopping before the paid edit. Nothing was
    charged";
  - balance 860, read by the run and again from the ledger at 13:52:05 UTC:
    last row still 453, no open job.

## Deploy 2200 — image purchases off for the one `acc-isolation-page` press (2026-10-13)

- **The owner's manual redeploy** (run 38417493475, `workflow_dispatch`,
  14:55–14:56 UTC) of `main` `fef80b9b`, after setting the
  `IMAGE_PURCHASES` secret to `off`, as deploy 2197 did. No code changed.
- The container image was **reused** (`4444d9d53d906b8d`, "no changes"); no
  image window was owed.
- The log masks the switch's value, because the secret's value is the word
  itself; the state is read from the runtime instead.
- **Read by run 144's own preflight** (15:15:52 UTC): both readers
  `fef80b9bc913`, a cold container `4444d9d53d906b8d`,
  **`imagePurchases=false`** ("the live Worker buys none"). Run 144 then made
  the one approved paid press (`docs/history/2026-10-13-run144.md`).
- Restored by deploy 2201 (below).

## Deploy 2201 — image purchases back on (2026-10-13)

- **The owner's manual redeploy** (run 38428408001, `workflow_dispatch`,
  16:11:14–16:12:05 UTC) of `main` `fef80b9b`, after setting
  `IMAGE_PURCHASES` back to `on`. No code changed.
- The container image was **reused** (`4444d9d53d906b8d`, "no changes");
  Worker version `8ab70897-…`. The log masks every "on" in its text (for
  example "c***tainer"), as it masks a secret's value.
- **Runtime-confirmed by run 145** (the owner's free press from `main`, run
  38429850021, job 115408854868, 16:21:42–16:22:25 UTC, spend `no`,
  `fold-lane-bakery`):
  - `build-health` and `runtime` both answered `fef80b9bc913`;
  - a cold container got `4444d9d53d906b8d`;
  - **`imagePurchases=true`**, async and the runner on;
  - all free checks passed; the free job settled at cost 0;
  - every page served at `01791904998588-e07yu1` (run 144's last version);
  - balance **837**, "CANARY_SPEND is not 1 — stopping before the paid
    edit. Nothing was charged".
- Evidence artifact 11829848645.

## The combined candidate's deploy: `1336f052`, run 38636840828 (2026-10-14)

- **What was merged:** `main` was fast-forwarded `fef80b9b` → `1336f052`
  (`integ/combined-candidate`: `e75ff483` plus the commit opening the two
  opt-ins) at 21:00:26 UTC, on the owner's approval of the live verification
  batch. One deploy run, 38636840828, `success`, 21:00:36–21:04:00.
- **Secrets set by the owner before the push:** `IMAGE_PURCHASES` `off` and
  `PROGRESS_TALK` `on` (both printed masked, as secrets do).
- **Image:** `built isibi-app-sitebuildcontainer:e1582f6f71a41dfb`
  (predicted on both ends; "registry answered 404; 207 inputs"). Container
  `- …:4444d9d53d906b8d` / `+ …:e1582f6f71a41dfb`, `SUCCESS Modified
  application` at 21:03:51Z; Worker version `9a22088c-d826-…`.
- **Assets:** 3 uploaded (`/edit-poll.js`, `/styles.css`, `/chat.js`), 83
  already there.
- **Served files:**
  - the before read at 20:15:09 matched `main`'s bytes;
  - after the deploy, at 21:04:33, all three were byte-identical to the
    merged files: `chat.js` 970,046 `0795960275b5`, `edit-poll.js` 53,124
    `543a30826793`, `styles.css` 355,781 `044a7c2a5892`.
- **Runtime-confirmed by the owner's free check, run 38637835131
  (21:08):**
  - both readers answered `1336f0526194`;
  - a cold container answered `e1582f6f71a41dfb`;
  - `imagePurchases=false progressTalk=true jobProgressTalk=true`;
  - the rehearsal read "photographs: the live Worker buys none" and
    "progress talk: on, as the live Worker and a container job read it".
- **Build prerequisites, free check run 38638468051 (21:12):** all MET,
  including the image-free parallel mode as the build job reads it.
- **Rollback (rehearsed):** restore `fef80b9b`'s tree and commit; the
  rehearsed tree was `6298ed8d…`, `main`'s exactly.
- **Afterwards:** `f1b81477` closed the two opt-ins; it is scripts and tests
  only and started no deploy. The switches were left as set, on the owner's
  word ("I dont need to restore settings, i have no customers").

## The verification batch's deploy: `8e24ca5b`, run 38671851113 (2026-10-15)

- **What was merged:** `main` was fast-forwarded `f1b81477` → `8e24ca5b`
  (14 commits: the batch fix round, Codex's review answered, the proposal,
  and the Step 0 commit) at 02:36:05 UTC, on the owner's word: "Approved —
  do Step 0 through Press 2 as written". One deploy run, 38671851113,
  `success`, 02:36:07–02:39:01.
- **Before the merge:**
  - required unit CI on `8e24ca5b` (run 38671177863): `10976 / 10932 / 0 /
    44`;
  - nothing in flight except unit tests on the `new` branch, which a merge
    here does not touch;
  - no open edit job;
  - balance 726, last ledger row 476;
  - `ferry-lane-deli` free all three ways, its address 404.
- **Image:** `built isibi-app-sitebuildcontainer:e420b3c2d3224dd3`
  (predicted on both ends; "registry answered 404; 207 inputs"). Container
  `- …:e1582f6f71a41dfb` / `+ …:e420b3c2d3224dd3`, `SUCCESS Modified
  application` at 02:38:56Z; Worker version `bc272ed9-37c…`.
- **Assets:** 2 uploaded (`/edit-poll.js`, `/chat.js`), 84 already there.
- **Served files:**
  - the before read matched `main`'s bytes (`chat.js` `0795960275b5`,
    `edit-poll.js` `543a30826793`);
  - after the deploy, at 02:39, all three were byte-identical to the merged
    files: `chat.js` `0e1a4721bdb3`, `edit-poll.js` `05efc5862cbd`,
    `styles.css` `044a7c2a5892` (unchanged).
- **Rollback (rehearsed):** restore `f1b81477`'s tree and commit (`git
  restore --source=f1b81477 --staged --worktree :/`), verified identical to
  `main`'s tree in a throwaway worktree. A `git revert` of the range does not
  apply: it contains a merge commit (`e4e0f944`).
- **Switches as left:** `IMAGE_PURCHASES` off, `PROGRESS_TALK` on. The opt-ins
  are open for `check-no-images` and `acc-mixed-2` only, closed again by
  commit after the presses.
- **Runtime confirmation:** run 38742119254 (the owner's free check, 13:22
  UTC):
  - both readers answered `8e24ca5bb8e9`;
  - a cold container got `e420b3c2d3224dd3`;
  - `imagePurchases=false`, `progressTalk=true`, `jobProgressTalk=true`;
  - queued jobs and the runner on;
  - balance 726, nothing charged.

## An unintended deploy, `c37cbc41` (2026-10-15)

**Not approved as a deploy. My error.** Closing the two paid opt-ins after
the verification batch was meant to reach `main` as a scripts-and-tests
commit that starts no deploy, as `f1b81477` did. The commit was built in a
throwaway worktree, and its `node_modules` symlink (pointing at the
session's own checkout) was committed with it. `node_modules` is not in the
deploy's ignore list, so the push started deploy run 38747702721.

- **Commit:** `c37cbc41`, on `8e24ca5b`, pushed 14:01 UTC. It changes
  `scripts/canary-build.mjs`, `scripts/canary-ui.mjs`, three test files, and
  adds the symlink.
- **The run:** `success`, 14:01:20–14:02:25.
  - `npm ci` removed the dangling link and installed as usual.
  - Image `reused isibi-app-sitebuildcontainer:e420b3c2d3224dd3` (207
    inputs), with no container changes.
  - No asset uploaded.
  - Worker redeployed under `DEPLOY_ID` `c37cbc41` (Cloudflare version
    `8c0ab4ee`).
- **What changed live:** only the deploy id the readers report. The Worker,
  container and served files are the same code as `8e24ca5b`.
- **Not runtime-confirmed by a press.** None was made after it.
- **Still on `main`:** the symlink. Removing it is another push to `main`
  that starts one more identical deploy, so it waits for the owner's word.


## Deploy 2214 — the consolidation, `d8024d63` (2026-10-16)

- **Commit:** `d8024d63`, a fast-forward of `main` from `80910d85` (deploy
  2213). It merges chris-1: Publish, help-needed, and the four integration
  blockers.
- **Required CI on the candidate:** unit run 38909852790 `11277 / 11229 /
  0 / 48`. Site build run 38900493109 green on `c796c2aa`, with no file
  outside the docs changed since.
- **Predicted image:** `892924bc029456f6`, 211 inputs, against `main`'s
  `24b327329c61237d` (210).
- **The run:** 38910865539, `success`, 13:49:38–13:52:44 UTC.
  - `built isibi-app-sitebuildcontainer:892924bc029456f6` (registry
    answered 404).
  - The container moved `24b327329c61237d` → `892924bc029456f6` at
    13:52:35.
  - No asset uploaded. Cloudflare version `84b78ad…`.
- **Switches:** unchanged. `DRAFT_FIRST` now goes through the secret list
  with no repository secret, so it is `off`.
- **Deployed, not runtime-confirmed:** no press yet. Wait the 15–20 minute
  image window first.

## Deploy 2216 (2026-10-18) — audit findings 1–20, Discard draft, the review fixes

- **Commit:** `c0c94186`, a fast-forward of `main` from `01a7d4eb` (deploy 2215), 23 commits, on the owner's word "merge to main".
- **Before the merge:**
  - Unit CI was green on the candidate: run 39171187319, `fail 0`, `skipped 54`. Site build was green on `f1ee494f` (run 39170721071); only `CLAUDE.md` changed after it.
  - Nothing was in flight: no Actions runs, and only two `lost` edit jobs from 2026-09-01/02.
  - The rollback was verified in a throwaway worktree: `git revert --no-commit 01a7d4eb..c0c94186` gives `main`'s own tree.
- **Predicted image:** `f627bfc5e59cb204`, 211 inputs (180 paths), against `main`'s `8278ac9a0bcf0981`. The predictor reproduced 2215's recorded image, so it reads correctly.
- **The run:** 39171938230, `success`, 22:22:30–22:25:09 UTC.
  - `built isibi-app-sitebuildcontainer:f627bfc5e59cb204` (the registry answered 404).
  - The container moved `8278ac9a0bcf0981` → `f627bfc5e59cb204` at 22:25:00.
  - Assets uploaded: `/styles.css` and `/chat.js`. Cloudflare version `02ada375…`.
- **Switches:** unchanged (secrets as before).
- **Deployed, not runtime-confirmed.** It waits for the 15–20 minute image window, then the owner's free canary press. `public/` changed, so the served `chat.js` and `styles.css` are to be byte-compared with the merged files.

## Deploy 2217 (2026-10-19) — no build fails on time alone

- **Commit:** `d2ba84be`, a fast-forward of `main` from `e2a8d1d8`, on the owner's word "yes go".
- **Before the merge:**
  - Unit CI was green on the candidate (run 39178710167).
  - Nothing was in flight.
  - The rollback was verified in a throwaway worktree.
- **Predicted image:** `8f2aee8779c7808a`, 211 inputs.
- **The run:** 39179295898, `success`, 00:06:56–00:09:44 UTC.
  - The container moved `f627bfc5e59cb204` → `8f2aee8779c7808a` at 00:09:40.
  - No assets uploaded.
- **Live proof:** the test account's paid rebuild of the 317-word Harbour Loaf prompt, recorded.
  - Started at 00:31:37; the build row is `ok: true` at 00:43:39 on `harbour-loaf-2`.
  - `genMs` was 441,623, past the 300-second wall that killed the first build. `genVia` was 1 (the container's started-and-polled call), with `tsc` 16,305, `vite` 41,999, render 29,510 and publish 19,138.
  - Cost 18 credits (97 → 79).
  - Before the fix, the same prompt failed at 602,445 ms with `fetch failed` (2026-10-18, build `11a381e8`).

## Deploy 2265 — 2026-10-23 23:11 UTC (`6b980ae15`)

The evening batch (`combine-1023b` + main's plan docs): router holds back by item number; the AI writes every component, header and footer on first builds (6-section cap, notBuilt + noDatabase reply facts, written-frame edits); edit-flow fixes (stuck questions, false summaries, prices, routing, carved parts); add-on compile repair, no orphan database, preview loading state; the slash menu with /sentinel as a chat message and live scan progress; the parallel-work card. On the owner's word. CI green on `c28f63e86` (unit 40036188841, site build 40036188928); the merge added only docs. No jobs open. Deploy run 40037959053 green. Predicted site image `665ab9d93b9dce93` (229 inputs). **Runtime-confirmed** by the owner's canary run 40039829521 (23:28 UTC): both readers `6b980ae15e0c`, cold container `665ab9d93b9dce93`, async/runner on, all free checks passed, nothing charged.

## Deploy 2264 — 2026-10-23 18:12 UTC (`923d278c1`)

The owner's decisions batch (`decide-all`): decisions 1, 2, 3, 5, 6, 8–25, 27, 28, 30–33, plus the no-fixed-messages follow-up; merged as a fast-forward from `a8fbfe876` on the owner's word "merge and deploy when its done". Required CI green on `923d278c1` (unit run 39997867299, site build run 39997867482). No edit jobs open, no run in progress before the push. Deploy run 40000974291 green (18:09–18:12 UTC). Image **rolled** `ebfbd45c42ea43ac` → `145239c1c143183b`, as predicted (226 inputs); `AppBuildContainer` `65022ce71e3d7274` unchanged. `OPERATOR_UIDS` uploaded as a Worker secret (owner set it). Assets uploaded: `chat.js`, `site-media.js`. Decision 7 (`build_debit`) was applied to Supabase separately, 2026-10-23, no deploy needed. **Runtime-confirmed** by the owner's free canary press, run 40004528546 (18:35 UTC, from `main` on `fretwork-1`): both readers answered `923d278c196a`, a cold container `145239c1c143183b`, async and runner on, the container env probe (`/api/site/job-probe`, now behind `OPERATOR_UIDS`) answered, all free checks passed, nothing charged (balance 603).

## Deploy 2259 — 2026-10-22 07:39 UTC (`89a67ec40`)

The second merge of the day (audit fixes 53, 55–60, 62, 79, 82, 84, 88, 99, 100, 102, preview search and the reload fix), on the owner's word "merge when they done". Required CI green on `89a67ec40` (unit run 39740919581, site build run 39740919562). Deploy run 39742014019 green (07:39–07:44 UTC). The served `chat.js` sha256 starts `c63055f3140f8d7d`, the same as the merged `public/chat.js`. **Runtime-confirmed** by the owner's free canary press, run 39802537938 (15:12 UTC, from `main` on `fretwork-1`): both readers answered `89a67ec40ed3`, image `af25591ff1cc217a`, async and runner on, all free checks passed, nothing charged (balance 603).

## Deploy 2258 — 2026-10-22 04:23 UTC (`fdf73825a`)

A fast-forward of 72 commits from `3fda8174d` (deploy 2257), on the owner's
word "everything else yes u can merge and deploy": today's combined work
(design rules, shorter pages, ideas #10 #14 #25/26, Scene3D + Meshy 3D (off),
audit 21–26, 28–31, 35–44, 48–51). One deploy run (39722119574), green. The
container image rolls (many container inputs changed); the image id was not
predicted in advance. Served `public/chat.js` is byte-identical to the merged
file (sha256 starts `ff0eb507d9b92a98`). **Deployed, not runtime-confirmed**:
the authenticated build-health read (the owner's free canary press) is owed.
Required CI green on `fdf73825a`: unit tests 39721233513, site build 39721233572.

## Deploy 2266 (2026-10-24 01:37–01:41 UTC)

`main` fast-forwarded `c89732649` → `692087cde` (combine-c: compile repair everywhere, progress voice, next-step hint, background work + follow-ups, tweak exact edits, file picker; `docs/history/2026-10-24-combine-c.md`), on the owner's "merge and deploy". Run 40050651998, green. SiteBuildContainer rolled `665ab9d93b9dce93` → `0bae00a7003bcc23` (built, as predicted); AppBuildContainer `65022ce71e3d7274` no change (as predicted). Assets uploaded: `chat.js`, `styles.css`, `edit-poll.js`. Unit CI on the head: run 40049772755, 12458 total / 0 fail / 58 skipped. **Runtime-confirmed by canary run 40053450252** (02:16 UTC, free): both readers answered `692087cde88b`, a cold container got `0bae00a7003bcc23`, async and runner on, all free checks passed, nothing charged (balance 603).

## Deploy 2267 (2026-10-24 08:19–08:22 UTC)

`main` fast-forwarded `692087cde` → `1b16aaba0` (combine-d: 13 code branches — build-reply-bubble, progress-voice-2, device-scope + device-scope-build, repair-everywhere + standin-everywhere + standin-refund, first-build-uncapped + first-build-db-limits, addon-uncapped, task-label, build-panel-stop, edit-file-picker, rebuild-scope, build-questions, request-needs, visual-review-frontend; provider-retry merged then reverted in `016aa3d93`; `docs/history/2026-10-24-combine-d.md`), on the owner's "merge and deploy when all the helpers are done". Run 40077593945, green; container images step ran (predicted site image `0bae00a7003bcc23` → `2d440bd194450245`, app `65022ce71e3d7274` unchanged). CI on the candidate: unit 40076993648 (12624 / 12554 / 0 / 70), site build 40076993644 green. **Runtime-confirmed by canary run 40102642196** (14:28 UTC, free): the expected deploy `1b16aaba0` and cold-container image `2d440bd194450245` checks passed, all free checks passed, nothing charged.

## Deploy 2278 — `91b7f1f00` (2026-10-27 17:22 UTC)

Fast-forward from `8f29c37d3` on the owner's "merge and deploy". Run 40549986932
green, front-door step included. Image predicted `8a6274d06052dea1` →
`92992a4ddcce6503` (247 inputs; app image reused `65022ce71e3d7274`).
**Runtime-confirmed by the owner's free press, canary run 169**
(40553645209, 17:46 UTC): both readers `91b7f1f0060f`, cold image
`92992a4ddcce6503`, async and runner on, nothing charged (balance 603).
The front door's rehearsal route answers for `fold-lane-bakery`.

## Deploy 2279 — `59a6e3663` (2026-10-27 17:58 UTC)

Fast-forward from `91b7f1f00` on the owner's "merge and deploy". Run
40555556961 green; no container input changed (image stays
`92992a4ddcce6503`). The front door now takes `*.gofarther.app/*`; read free
at 18:0x: `fretwork-1`, `washhouse-3`, `fold-lane-bakery`, `markbook-1` all 200
with `x-served-by: gofarther-front` and their own build ids; a visitor data
read (`/api/db/fretwork-1/data/lessons`) 200 through the front door; the bare
`gofarther.app` (301, platform's fallback route) and `gofarther.dev` (200)
unchanged. `SITE_OWN_BUCKETS` is set by the owner (value not read); the first
publish after this deploy is its test. Not runtime-confirmed by a canary press.

## Deploy 2280 — `61dd33db4` (2026-10-27 20:18 UTC)

Fast-forward from `59a6e3663` on the owner's "merge and deploy": the limited
login (`site-app-login.mjs`), after `site_app_conn.sql` was applied on the
owner's word. Run 40576916178 green. Image predicted `92992a4ddcce6503` →
`aa188622d81478a6` (248 inputs; app reused). Read free at 20:45: 35 of 37
`site_project` rows hold a limited login (`app_conn` present, value never
read); `wassup` and `helm` do not yet. `ember-cart` (no database) and
`fretwork-1`'s data read answer 200. Not runtime-confirmed by a canary press.

## Deploys 2281 and 2282 (2026-10-27)

- 2281 — `f4997595e` (21:45 UTC): customer domains through the front door.
  Read: `test.isibi.ai` 200 through the front door, and `gofarther.dev`/`www`
  too (the catch-all runs before custom domains), which stripped `x-gf-*` from
  build jobs' gateway calls; no job ran before the fix.
- 2282 — `2f8006efa` (23:00 UTC, run 40598997235, green): the front door
  passes the app's own hosts untouched; sites answer their own reads, save
  their own rows and run their own follow-ups (`SITE_OWN_DATA` on). Image
  predicted `aa188622d81478a6` → `d798304cc28b0e10`. Read free 23:1x:
  `test.isibi.ai`, `gofarther.dev`, `ember-cart`, fretwork-1's data route 200.
  Not runtime-confirmed by a canary press; not yet proven on a new site.

## Deploy 2286 — 2026-10-29 02:17 UTC (`736379436`)

The site agent (one model with tools takes every message; no router, no cap;
cost rules 1, 3 and 4) and its shell commands with no internet, on the
owner's word "merge and deploy". Record: `docs/history/2026-10-28-site-agent.md`.
A fast-forward from `fcc8c056d`; required CI green on the candidate (unit
tests run 40804499999, site build run 40804499983); rollback verified; nothing
in flight. Image predicted: SiteBuildContainer `7a577bf068bd9734` →
`a1f126d49bbe9fe8` (256 inputs), AppBuildContainer `65022ce71e3d7274`
unchanged. Run 40805423501 green, 02:17–02:20 UTC; the log's image pair is
as predicted. Deployed, not runtime-confirmed.

## Deploy 2287 — 2026-10-29 03:33 UTC (`0299f6126`)

The site agent's cost fixes after its first live build (clear only when it
saves 15,000 characters, several tools per round, each round logged as
numbers, trace room 140), on the owner's "merge and deploy". A fast-forward
from `736379436`; required CI green (unit tests run 40811324380, site build run
40811324374); rollback verified; nothing in flight. Image predicted:
SiteBuildContainer `a1f126d49bbe9fe8` → `98e49766f0f461b8` (256 inputs),
AppBuildContainer `65022ce71e3d7274` unchanged. Run 40812828450 green,
03:33–03:37 UTC; the log's image pair is as predicted. Deployed, not
runtime-confirmed.

## Deploy 2288 — 2026-10-29 05:41 UTC (`e3348172b`)

The site agent sees what the checks find (look wired in first builds, the
browser check's findings and type errors in its build/look answers, a must-fix
finding holds the first finish once) and the browser check without a
whole-site time limit, on the owner's "merge and deploy". A fast-forward from
`0299f6126`; required CI green (unit tests run 40823672393 on `e3348172b`, site
build run 40822496447 on `10f92f8e3`, the code; the later commit is tests
only); rollback verified; nothing in flight. Image predicted:
SiteBuildContainer `98e49766f0f461b8` → `4f44a4a20b33575c` (256 inputs),
AppBuildContainer unchanged. Run 40824851436 green, 05:41–05:44 UTC.
Runtime: the session's own authenticated `build-health` read at 05:49 answered
`e3348172b…` and image `4f44a4a20b33575c`, `agentNet` blocked; a canary press
is still the owner's. **Runtime-confirmed by the owner's canary run 40828442157** (06:19 UTC: both expected boxes set, all free checks passed, nothing charged).
