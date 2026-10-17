# Rollout checklist for the three goals (2026-10-16, prepared, nothing done)

**Nothing on this list has been done.** No merge, deployment, production
SQL, switch change, container build or paid test. Every step is the owner's
to approve and press, in order. The branch is `codex-work-into-claude`;
`claude/chat-session-0nndv1` is not part of it.

## 1. The exact candidate

- **Commit:** `5491e124` (the code and tests of the twelfth batch, all three rounds;
  the records commits on top change only documents).
- **Base:** `main` at `c7c3ca44` (deploy 2214, deployed, not
  runtime-confirmed: its free runtime press is still owed).
- **Required CI on the candidate:** unit tests and site build, green, read
  from each job's own fields (see §6 for the readings so far).
- **The image:** worker and builder modules change (`worker.js`,
  `site-draft.mjs`, `builder/*`), so the container image is expected to roll.
  Predict it over both ends before the push (`.github/scripts/container-images.mjs`:
  `containerInputs` and `imageId` over `main` and the candidate). The
  predicted id is in §6.
- **The rollback:** `git revert --no-commit c7c3ca44..<candidate>` in a
  throwaway worktree must give back `main`'s own tree.

**A gap on `main` this candidate closes (found 2026-10-16, offline):**
`main`'s job gateway refuses the script note its own live publish writes
(`scriptpending/<slug>/<uuid>.json`). So on deploy 2214, a job run in a
container cannot write the note and does not upload the site's script.
- **Nothing was changed in production.** If containers run jobs there now,
  the free runtime press after the merge is where this shows: a container
  job's publish should move the live script.
- **The candidate also admits** a container job's own draft records and a
  build's own marker (the batch record, §3c).

## 2. The SQL

| File | What it does | Needed for |
|---|---|---|
| `supabase/proposed/request_beside.sql` | lets the jobs of one request hold the site together | `PARALLEL_WRITES` only. Without it the second job waits on the site's lock, as before; nothing breaks |

No other SQL. Draft-first, Publish and hosted media need none: their state
is in R2.

**New R2 objects this candidate writes (no setup needed):**
- `preview-up/<slug>.json`: the version a site's preview was confirmed
  serving.
- `site-drafts/<slug>/held-sum.json`: the cumulative record of a draft's
  unpublished held changes.

Both are created on first use. For a draft saved before the deploy, the
first owner read of its state finds no confirmation. It says the preview is
pending and starts one repair, which records it. The first read of its held
changes folds the existing journals into the record, once.

## 3. The switches (Worker secrets, delivered by `deploy.yml`)

| Switch | Default when unset | Set to | What it does | Order |
|---|---|---|---|---|
| `REQUEST_FLOW` | `off` | `on` (read the current value first) | a message becomes a request with parts | already required for the request card |
| `EDIT_ASYNC`, `EDIT_ASYNC_EVERYONE` | `off`, `on` | as now | jobs run in the site's container | unchanged |
| `PARALLEL_WRITES` | `off` | `on` | independent parts write side by side | after the SQL |
| `DRAFT_FIRST` | `off` | `on` | every Build, Edit and Add-on change is a draft revision; only Publish goes live | after `PARALLEL_WRITES`, with the `env` probe |
| `PROGRESS_REPLIES` | `off` | `on` to show the model's progress lines on the card | the "assistant-style" progress the owner asked for | any time; each line is a model call (paid) |
| `PROGRESS_TALK` | `off` | optional, on top of `PROGRESS_REPLIES` | the folded "More detail" explanations | any time; paid |
| `MODEL_REPLIES` | `on` | keep `on` | the request's end reply, model-written | — |
| `IMAGE_PURCHASES` | `on` | **`off` for the live batch** | no picture is bought | before any press |

All of them are read before every use, so a switch moves without a deploy.

## 4. The media limits (repository variables, `default` when unset)

| Variable | Default | Ceiling (clamped) |
|---|---|---|
| `MEDIA_MAX_VIDEO_BYTES` | 250 MB | `MEDIA_CEILINGS` in `site-media.mjs` |
| `MEDIA_MAX_AUDIO_BYTES` | 50 MB | idem |
| `MEDIA_MAX_SITE_BYTES` | 2 GB | idem |
| `MEDIA_MAX_SITE_FILES` | 100 | idem |
| `MEDIA_MAX_DRAFT_FILES` | 6 | idem |

A value that is unset or unreadable means the default, never "no limit".
Parts are 8 MiB; an upload session lasts 24 hours, a pre-site draft upload
7 days.

## 5. Deployment and container requirements

- **Bindings** (already in `wrangler.jsonc`): `SITES_BUCKET` (R2),
  `SITE_WORKERS` (the dispatch namespace; the draft's preview needs it),
  `BUILD_QUEUE`.
- **The preview host:** `<slug>--draft-<token>.gofarther.app`, one label
  under the existing `*/*` route on `gofarther.app` and its wildcard
  certificate. No new DNS or certificate.
- **After the deploy:**
  - read the one deploy run: its `built`/`reused` line and its image pair;
  - wait 15–20 minutes before container work;
  - byte-compare the served `public/chat.js` with the merged one, taking
    the before reading first (`public/` changes).
- **The free runtime press:** both readers on the new sha, a cold container
  on the new image, `draftFirst`/`parallelWrites` off at the Worker, as
  calculated for a job, and observed by the `env` job probe.

## 6. Readings so far (offline; stamped after each run)

Every reading below was taken offline on this branch; none is a production
reading.
- **Unit CI:**
  - [run 38987482899](https://github.com/canias7/isibi-app/actions/runs/38987482899)
    on `bd53675c` (the code of `5491e124`): 11,432 / 11,380 / 0 / 52,
    success;
  - [run 38985469462](https://github.com/canias7/isibi-app/actions/runs/38985469462)
    on `668ebc87`: 11,427 / 11,375 / 0 / 52, success.
- **Site build:**
  [run 38987338040](https://github.com/canias7/isibi-app/actions/runs/38987338040)
  on `5491e124`, success.
- **Full suite locally on `5491e124`:** 11,432 / 11,430 / 0 / 2.
- **Browser, local Chromium:** the draft page cases 3 of 3, the media cases
  3 of 3.
- **Image, predicted, not built:** `892924bc029456f6` (main) to
  `8278ac9a0bcf0981` (the candidate).
- **Mutation sweep:** 63 mutants in three groups, each against the tests that bear on it (`scripts/mutants/codex-batch-13-{client,gateway,server}.json`): client 20 of 20 killed; gateway 10 of 11 killed (T2 survived); server 27 of 30 killed (M4 and R4 survived, R3 never applied); every comment-only control survived. The survivors and the stale anchor are test gaps, recorded, not fixed in this batch (`docs/history/2026-10-16-codex-batch-12.md` §5).

## 7. One combined live verification batch, no image generation

Every press is the owner's, on its own approval, on `fold-lane-bakery` at
its fixture version `8btpep`. Before anything, read and keep: the pointer,
the live script's version, the five stored pages' hashes, every `loaves`
row, the sidecar, the draft record, and the open journals.
`IMAGE_PURCHASES=off` throughout. Estimates are not limits; the balance is
the only bound.

1. **Free:** the runtime press for deploy 2214 (owed), then the merge and
   deploy of the candidate, then the free runtime press with both switches
   off (`job probe` env `draft=off,parallel=off`).
2. **Free:** the SQL, `PARALLEL_WRITES=on`, `DRAFT_FIRST=on`, then `job
   probe` env `draft=on,parallel=on` (observed in a real job child). Read
   the Worker's log for `job gateway refused:` lines throughout the batch:
   none is expected for a job's own draft records, script notes or build
   marker (offline: JGD1–JGD5, DH3, DH4).
3. **Free:** `draft verify`, rehearsal (readings only).
4. **Paid, about 6–10 credits:** one message with three independent parts
   (the Visit opening line, the Order heading, the Olive & Rosemary at
   £6.00), sent **from the app in a browser** by the owner. Observed in the
   page:
   - progress per part;
   - parts working alongside;
   - each part "Saved as a draft";
   - the frame on the draft host, showing both texts and £6.00;
   - the bar saying "Draft preview · not published", "updating…" until
     the preview is confirmed, then plain;
   - the page leaving "updating" by itself, with no reload (DFU6's path,
     live);
   - a reload showing the same.

   Read: the two writing jobs' intervals intersect (`edit canary`
   read-job, free), and nothing live moved. A router that batches the parts
   is recorded as not exercised, never a pass.
5. **Paid, about 3–6 credits:** one message whose first part needs the
   second and whose second asks a question.
   - The card says "Waiting for part 2".
   - The answer is given on the page.
   - Both end saved as a draft.
6. **Free:** in the Files panel:
   - add a short recording, play it and seek in it;
   - replace it (held: live keeps the original, the preview plays the
     replacement);
   - remove another (held);
   - start and cancel a longer upload (nothing kept).
7. **Free of model calls:** Publish the revision before the newest, from
   the panel, and press it twice.
   - The later revision stays out.
   - The frame stays on the draft (something is still unpublished).
8. **Free of model calls:** Publish the newest.
   - The frame returns to the live address, showing all of it.
   - The chip says Published.
   - Recovery runs, and again 15 minutes later.
9. **Free:** the restore to `8btpep` and one owner write for the price row.

**What this batch, if every step passes, verifies live:**
- **Parallel work:** steps 4–5.
- **Draft isolation, readiness, following and explicit Publish:** steps
  2–5, 7 and 8.
- **Video/audio hosting:** step 6 and the frame in step 8.
- **A container job's own draft records through the real gateway:** steps
  4–6, read with step 2's log check.

**What it still leaves unverified:**
- a real crash or lost R2 answer (not induced on a live site);
- capacity at large draft sizes;
- playback on other devices and browsers.

## 8. Implemented, verified offline, still unverified live

| Item | Implemented | Verified offline | Still unverified live |
|---|---|---|---|
| Parallel parts, dependency waiting, clarification answers, reload | yes | yes (CW*, PPM*, DOR7, EER5, DFU4, DUI4) | two writing jobs overlapping on real infrastructure; a real router's split |
| Request progress, model-written lines and end reply | yes (existing; `PROGRESS_REPLIES` off by default) | yes (progress-browser, request-flow) | the real progress writer's lines, with the switch on (paid) |
| Pending, saved, partly done, failed and recovering shown apart on the card | yes (this batch) | yes (DUI3, DFU1, DFU4) | — |
| Draft preview in the frame, its readiness, explicit Publish, the frame returning to live | yes (this batch) | yes (DFU1–DFU3, DUI1, DUI2, DUI5) | the real preview host after an image roll; a real browser on the real host (cookies, framing headers) |
| Readiness from positive evidence (the confirmed version), pending, failed and unknown apart; a refused claim repaired by the owner's read | yes (this batch, second round) | yes (DPS1–DPS3, DFU6) | R2's real conditional writes on `preview-up/`; Cloudflare's own script-upload failures |
| The page following an unsettled preview through delays and failed reads, cleaned up on a site switch, a hidden tab or leaving | yes (this batch, second round) | yes (DPF1–DPF6, DFU6) | a real tab over a real network for 15+ minutes |
| No count limit on unpublished changes; partial publication; changes during publication; duplicate clicks; reloads | yes (this batch) | yes (DRT1–DRT6, EER8) | a long-lived real draft |
| Reads that do not grow with the draft (the cumulative record) | yes (this batch, second round) | yes (DRT7–DRT9; measured 1 read at 10–1,000 revisions) | R2 latency and object size for a record of hundreds of KB |
| A malformed cumulative record repaired from the journals, the next read using it | yes (third round) | yes (DRT8, JGD5) | — |
| Container jobs (Build after scoping, Edit, Add-on) saving drafts, held changes, the cumulative record and the preview's confirmation through the real gateway; cross-site and pre-scope denials; conditional writes across the wire | yes (third round) | yes (JGD1–JGD5, DH3, DH3c, DH4: the real `GatewayBucket`, `gatewayHandler`, `makeContainerEnv` and the Worker's gateway route) | a real container's HTTP hop to the Worker; Cloudflare's own request limits on that hop |
| Video/audio upload, placement, playback, seeking, replacement, removal, cancel | yes | yes (media-*, DFU5) | live playback on real devices (H.264/AAC are not decodable in this Chromium); R2's own multipart expiry |
| Owner panels | unchanged | — | outside this batch |
