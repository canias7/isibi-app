# Deploy record: timings and image-id predictions

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). CLAUDE.md's **Deploy**
> section keeps the rules. This file keeps the measurements behind them: the
> timing bands, every image-id prediction checked against a deploy's own log
> (deploys 2137–2165), and the served-file check driven end to end on deploy
> 2139.
>
> **Add each new deploy here**, one paragraph per deploy, in the same shape:
> both ends predicted before the push, the log's `built`/`reused` line with its
> input count, the `-`/`+` image pair under `SUCCESS Modified application`, the
> number of `CACHED` lines, and the image step, Wrangler and job times.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections.

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
3m09s; `No updated asset files to upload`.
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

