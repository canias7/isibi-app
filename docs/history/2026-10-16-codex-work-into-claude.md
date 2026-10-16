# Parallel tasks, explicit Publish and hosted media, finished together (2026-10-16, branch `codex-work-into-claude`)

**On the owner's word**, on the one working branch `codex-work-into-claude`,
for Codex's review. Nothing was merged, deployed, switched, applied to
production SQL, built into a container image or spent. No image, video or
audio was generated. `claude/chat-session-0nndv1` was not checked out,
merged, changed or deleted (still `f9f983a3`).

## 1. The baseline

- **The consolidation into `main` had finished** before this work began:
  `main` was **`c7c3ca44`** ("Records: repository consolidated into main,
  deploy 2214"), on top of the consolidation merge `d8024d63`. Deploy 2214
  is recorded as deployed, not runtime-confirmed (owner-notes, 2026-10-16,
  consolidation).
- `codex-work-into-claude` was created from `origin/main` at `c7c3ca44`. No
  other branch held work that was not already in `main`, so nothing else was
  brought in. The session's own branch was identical to `main`.
- **Baseline suite** on `c7c3ca44` (full, local): 11,277 tests, 11,275 pass,
  0 fail, 2 skipped. The run overlapped the first edits for its last files,
  so it is a near-baseline, not a clean one; the clean reading is the final
  suite in §5.

## 2. What was already there (verified by reading the code, not rebuilt)

Read in full by three audits of the current code, with each finding checked
against the code before acting on it:
- **Publish:** `DRAFT_FIRST` reaches every queued job through the one launch
  path (`fireContainerJob` → `jobSecrets` → `readLaunch` →
  `makeContainerEnv`), resumes included; the deploy delivers it with an
  `|| 'off'` fallback; the runtime route reports the switches at the Worker
  and as calculated for a job; the container `env` probe answers what a
  real job child read. Builder changes, first builds included, are saved as
  drafts; backend and library changes are held per revision; Publish runs a
  phased journal with recovery and the script-follow fencing; the preview is
  isolated; nothing treats a saved pointer alone as an activation.
- **Media:** upload in parts with content sniffing, limits, ownership,
  metadata, model context for Build, the Edit page step and Add-on, the
  pre-site drafts moved by the first build, Range/ETag serving on the app,
  site and preview hosts, held deletes under draft-first.
- **Parallel:** targets, inferred needs, apply order, side-by-side filing
  (`PARALLEL_WRITES`), the publish turn and rebase, preparation ahead, the
  Build caps, per-part charging and refunds.

## 3. What was missing, and what changed

### 3.1 Parallel tasks (one request)

- **A part that lost to its own request's overlap ended failed.** When a
  side-by-side job's publish found another part's change on the same files
  (`conflict`), lost the publish turn (`turn`, `turn-lost`), or saved behind
  a newer draft (`older`), the customer had to send it again, although
  nothing of it went in and it was refunded. It now runs again **alone**
  (`serial`: it waits for every running writer and none is filed beside
  it), at most `OVERLAP_RETRIES` = 2 times, then fails as before
  (`builder/request.mjs`, `builder/request-plan.mjs`).
- **Every edit rung answered those refusals as `compile`, with "our build
  service was restarting"** — the request could not tell an overlap, and the
  customer was told something false. Found by the existing side-by-side test
  CW5 once the re-run was in. `lostOr` keeps the spine's own code on nine
  rung answers; `compileMsg` says what happened (`worker.js`).
- **A paused part held later parts back, only when jobs run side by side.**
  A part waiting on a question, an approval or a purchase nobody can tell
  kept every later conflicting part from being filed or prepared, where one
  job at a time never did. Real dependencies are `needs` and running writers
  still hold back what they conflict with (`clearToWrite`,
  `clearToPrepare`).
- **A code-only draft save that landed behind a newer draft was committed
  and billed**, while the draft did not hold its change. `saveAsDraft` now
  answers `older` before the commit; the part runs again on the newer draft.
  A save that also carried held changes goes on as before (`site-draft.mjs`).
- **Kept as they are (real conflicts or dependencies):** `needs` and
  inferred needs; Build design waves; two parts on the same page (whole-file
  rebase); two config writers; two schema writers; the turn held through
  compile and publish; every cap (`MAX_MODEL_FANOUT` 8, `MAX_FANOUT_REQS`
  16, `MAX_WAVE_AGENTS` 4, first-build `MAX_PAGES` 1, `MAX_SECTIONS` 8,
  `MAX_TSX` 3, `WRITE_BESIDE_MAX` 3, `PREP_MAX_LIVE` 3, `STEP_AHEAD_MAX` 3).
- **Identified and NOT changed** (each touches refund ordering or the
  fences; recorded in the backlog):
  - a look step or addition holds the publish turn from its first read to
    its end (`holdsConfig`), so a text part beside it cannot publish until
    the addition's designers and page writer finish;
  - every addition counts as both a config and a schema writer, whatever
    its targets say;
  - an addition with any backend is not prepared past its design, though
    its page writer reads only the merged spec;
  - an addition provisions its database before its page writer, which does
    not need it; a Build does the same before generating pages;
  - the driver reads job rows one await at a time (latency only).
- **Cross-request concurrent writes were not started**, as asked.

### 3.2 Publish

- **The Publish route required no revision.** A bare `version` reached for
  the newest revision carrying it, which could take in held changes saved
  after the click. The revision is now required; the version is a
  cross-check (`worker.js`). The page always sent both.
- **The recovery sweep ran only while `DRAFT_FIRST` was on**, so turning the
  switch off with an approved publication open stranded it. It now runs on
  every tick (`scheduled`).
- **"Back online" under draft-first** could recompile the editable copy —
  which is the draft — and either publish unapproved changes or save them as
  a draft and report the site back while it stayed offline. The recompile
  refuses (`draftOnly`) and the owner is told why (`site-live.mjs`).
- **The container's observed switches had no door.** `job-probe` accepts the
  `env` shape and judges the Worker's reading, the calculated job reading
  and the container's observed reading apart (`switchChecks`); a probe line
  that cannot be read is unverified. One `want` box (`draft=on,parallel=off`).
- **The verifier did not check that drafts saved after the click stay out.**
  `publishChecks` takes `later` and fails if one of them stops reading
  unpublished or reaches the pointer; with no later revision it says not
  exercised (unverified).
- **The pressable scenario** (`scripts/draft-verify.mjs`,
  `.github/workflows/draft-verify.yml`, dispatch only): modes `rehearsal`,
  `send` (paid), `media` (writes a test recording), `publish` (publishes),
  `recovery`, each with its own opt-in, refusing before any write when a box
  is missing, the switch is off, images could be bought or a revision is not
  listed. Exit 0 all passed, 3 something unverified, 1 a failure, 2 refused.

### 3.3 Hosted video and audio

- **A held replacement was never held.** Under draft-first on a live site,
  the media route read fields no handler sends (`sid` from the start,
  `file.name` from the finish), so the `replacing/` pairing and the
  `media-replace` hold were never written: a separate new file appeared,
  the live address was untouched, and the panel said "Replaced — pages that
  play it play the new file." The route now reads `session` and the flat
  finish, and answers flat with `held`, `replaces`, the address and the draft
  revision (`worker.js`).
- **The Files panel showed none of the draft's markers.** It now says
  "Removed in your draft · still on your live site until you publish" and
  "New version in your draft · your live site keeps the old one until you
  publish", and the toasts say held instead of replaced or deleted
  (`public/chat.js`, `public/styles.css`).
- **Publishing a held replacement streamed with no known length**, which R2
  refuses for a stream; it now uses `FixedLengthStream` as the draft-media
  move does (offline the fixture has no such stream, so this is shown live
  only).
- **`pendingMedia` was never cleared** once the first build held the
  address; a later build would have named moved files as waiting.
- **Unchanged and recorded:** `/u/` addresses are public (no page calls them
  private); upload sessions and reservations expire lazily (a sweep of
  `media-sessions/`, `media-parts/` and `drafts/` is backlog); `MEDIA_MAX_*`
  are not passed by the deploy, so the defaults apply; `/u/<other-slug>` is
  served on a site's own host; a delete that crashed after recording
  `deleted` still serves the bytes; `If-Range` is not read.

## 4. The offline tests

- **`test/parallel-publish-media.test.mjs`** (8 cases):
  - PPM1: a recording replaced under draft-first through the real media
    routes: held, the live address keeps the old bytes (seeking included),
    the preview plays the new bytes at the old address, the list says what
    the draft will do, Publish puts them live once, a duplicate click says
    already; PPM1c the switch-off control.
  - PPM2: two independent page changes of one message run side by side **in
    the container with only what each launch carried** (`containerEnvOf`),
    `DRAFT_FIRST` and `PARALLEL_WRITES` on: the home job's whole run falls
    inside the Visit job's model call; both changes in the draft; nothing
    live; a held row change saved after is a later revision; Publish of the
    page revision makes exactly it live and leaves the row out; a duplicate
    click redoes nothing; Publish of the row revision applies it once; each
    job charged once, Publish charged nothing.
  - PPM3a–c: the driver's rules with negative controls; PPM4a–b: the probe
    reader, Back online.
- **`test/draft-verify.test.mjs`** (5 cases): the scenario against the real
  Worker — strict boxes, refusals (switch off, no opt-in, no ceiling, a
  revision not listed), send → publish (later revision kept out) →
  recovery, the media mode, missing evidence unverified.
- **Changed:** CW5 (re-run alone, said as a conflict); DF2/DF3 (Publish names
  the revision); DFP4b added (the cron finishes an approved publication with
  the switch off); CD1 (a later revision kept out, with its negative
  control); one landmark guard for `lostOr`.
- **Mutation sweep:** 19 of 19 killed, both controls survived (each fix's
  mutant fails its test, so each test fails on the old code).

## 5. Results

Commits: `672a527a` (the gaps), `901efc77` (the tests and the scenario),
then the records commit with two `site-apply` guards. Full suite locally on
`901efc77`: 11,291 tests, 11,287 pass, 2 fail (those two guards, which read
the old spelling `error: "compile"`; red since `672a527a`, fixed in the
records commit), 2 skipped. Sweep: 19 of 19 killed. CI: unit tests run
38927394396 on `b81294cf` 11,291 / 11,243 / 0 / 48, success; site build run
38926066981 on `901efc77`, success.

## 6. Status matrix

| Area | Item | Implemented | Verified offline | Verified live | Still missing |
|---|---|---|---|---|---|
| Parallel | independent parts side by side, dependencies waited for | yes (`PARALLEL_WRITES`, needs the proposed SQL) | yes (CW1–CW12, PPM2) | no | live overlap |
| Parallel | a part lost to its own overlap re-runs alone | yes (this branch) | yes (CW5, PPM3) | no | — |
| Parallel | a paused part holds no later part back | yes (this branch) | yes (PPM3a) | no | — |
| Parallel | parallel results accumulate in one draft | yes | yes (PPM2) | no | live |
| Parallel | an older draft save not billed | yes (this branch) | yes (PPM3b) | no | — |
| Parallel | addition turn held long, additions always conflict, addition/Build provisioning before page writing | no | — | — | backlog |
| Parallel | writes from different requests | no (not asked) | — | — | by design |
| Publish | `DRAFT_FIRST` into every job, resumes included | yes | yes (DH1–DH5) | no | observed in a real container (`job-probe` env) |
| Publish | calculated vs observed switches | yes; probe pressable (this branch) | yes (DH2, PPM4a) | no | the press |
| Publish | every builder change held; preview isolated; live unchanged | yes | yes (DF*, DFB*, PPM2) | no | live |
| Publish | exact revision only; later drafts kept out | yes; revision required (this branch) | yes (DF2, PPM2, CD1, DV3) | no | live |
| Publish | duplicate clicks, interrupted publication, recovery sweep | yes; sweep always on (this branch) | yes (DFP4, DFP4b, DFP5) | no | a real crash, not induced |
| Publish | Back online never publishes the draft | yes (this branch) | yes (PPM4b) | no | — |
| Publish | owner panels (SEO, share, verify, domains, Data panel, restore) | act at once by design | — | — | owner decision |
| Publish | pressable scenario with opt-ins | yes (this branch) | yes (DV1–DV5) | no | the press |
| Media | upload, limits, sniffing, ownership, Range/ETag | yes | yes (media-* tests) | no (not pressed since) | — |
| Media | held replacement under draft-first | fixed (this branch) | yes (PPM1, DV4) | no | live |
| Media | held removal | yes | yes (DFB6) | no | live |
| Media | Files panel shows held state | yes (this branch) | render only | no | — |
| Media | Build, Edit, Add-on get hosted media; survives handoff | yes | yes (media-route, media-recovery) | no | live |
| Media | publish copy with a known length | yes (this branch) | not testable offline | no | live |
| Media | session/part sweep, `MEDIA_MAX_*` in the deploy, host-tied `/u/` | no | — | — | backlog |

## 7. The consolidated image-free live batch (prepared, nothing pressed)

Every step is the owner's, in order; nothing here repeats a closed test or a
build. Estimates are not limits; the balance is the only bound.

1. **The free runtime press for deploy 2214** (still owed): both readers on
   `d8024d63`/`c7c3ca44`, a cold container on `892924bc029456f6`, both
   switches off.
2. **The proposed SQL** `supabase/proposed/request_beside.sql`, then **merge
   and deploy** this branch (image predicted over both ends before the push;
   the rollback checked; 15–20 minutes before container work).
3. **`job probe`, probe `env`, want `draft=off,parallel=off`** (free): the
   three readings agree off.
4. **Switches on** (`PARALLEL_WRITES`, then `DRAFT_FIRST`), then **`job
   probe` env, want `draft=on,parallel=on`** (free): observed in a real job
   child.
5. **`draft verify`, rehearsal** on `fold-lane-bakery` (free): readings and
   what each mode would refuse on.
6. **`draft verify`, media**, mutate yes (free): a new recording replaced —
   held, live keeps the original, the preview plays the replacement.
7. **`draft verify`, send**, spend yes (paid, about 6–10 credits): the L1
   message (Visit opening line, Order heading, the Olive & Rosemary at
   £6.00), `expect_revisions` 3, `expect_held` row. Overlap is read from the
   two jobs' rows with `edit canary`'s read-job box (free); a router that
   batches the parts is recorded as not exercised, never a pass.
8. **`draft verify`, publish** (free of model calls), the revision before
   the newest: the later revision must stay out; pressed twice.
9. **`draft verify`, publish** the newest revision (the row and the media
   replacement), then **recovery**, and recovery again 15 minutes later.
10. **The free restore** to `8btpep` and one owner write for the price row.

**Still unverified after the batch:** a real crash, a lost answer or a
duplicate delivery (not induced on a live site); two isolates racing the
turn beyond what the press happens to show; the 12–14 minute repair
estimate; the addition and provisioning serializations above.
