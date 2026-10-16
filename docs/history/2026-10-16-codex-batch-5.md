# The fifth batch on `codex-work-into-claude`, after Codex's review of `6d075aeb` (2026-10-16)

**On the owner's word**, on `codex-work-into-claude` only, for Codex's review.
Nothing merged, deployed, switched, applied to production SQL, built into an
image or spent; no paid test. `claude/chat-session-0nndv1` untouched
(`f9f983a3`). Codex passed all 45 focused tests on `6d075aeb`. The media-abort
fixes and the earlier preview work stand. One crash-recovery defect remained,
fixed here as a general concurrency problem. Exact commits, results and CI are
in owner-notes (2026-10-16, fifth batch).

**Correction to the fourth batch's claim.** The fourth batch's record and my
reply called preview crash recovery complete. It was not. A writer that
stopped for good after a stale upload, with no further line run, was not
recovered. Its PR3 simulated a caught read failure, after which the save
still wrote pending. That is not a process dying. The claim was premature
until the case below passed.

## 1. The defect

**Codex's reproduction:**
- save OLD starts and pauses inside its preview upload, after its pending
  mark exists;
- save NEW completes, including a successful preview upload and its ready
  mark;
- OLD resumes, its upload lands, and its execution stops permanently before
  it returns or runs any further code.

**The result:**
- the draft selects NEW, the preview serves OLD, and `preview-state` says
  ready/up=NEW;
- three calls to `runPreviewRecovery` read the record and skip it, making
  zero repair attempts.

**The cause:** one shared mark cannot carry several writers. One writer's
success erased the obligation of another upload that could still land.

**Reproduced on `6d075aeb`.** A scratch variant of PR4 over the old code:
- the newer save answered `{"ok":true,…}`;
- the register read `ready`, `up` = NEW;
- the preview served OLD;
- every tick answered `ready: 0`, including the one after the landing time.

## 2. The fix: one claim per uploading writer

**Each writer's own claim** (`site-draft.mjs` `claimPreview`, `previewClaims`,
`dropClaims`):
- **What it is.** Every writer that may put a preview script up writes its
  OWN claim first: a draft save, or the recovery tick itself. The claim is
  `preview-claims/<slug>/<at>-<rand>.json`, create-only, with its time in
  the key.
- **No claim, no upload.** A writer with no claim written uploads nothing.
  A save whose claim cannot be written still saves its draft, puts no
  script up, and says `recoverable: false`.
- **Only your own.** A writer removes only its own claim, and only once it
  has confirmed the draft's selected version is up. Otherwise the claim
  stays as durable evidence that an upload may have landed out of order. A
  process that stops for good leaves exactly that.

**The save:**
- **The claim before the record.** A save writes its claim before it records
  the draft. So a save that stops between recording the draft and its
  preview leaves evidence. One that stops before the record leaves a claim
  with nothing to repair, which the tick settles harmlessly. Every early
  exit (refused, older, failed, overtaken) removes the save's own claim.
- **Ready only alone.** A save is ready only when its own version is
  confirmed AND no other writer's claim stands. If the other claims cannot
  be read, it is not ready either.

**Bounded landing:**
- a writer starts no upload later than `PREVIEW_UPLOAD_WINDOW_MS` (5
  minutes) after its claim;
- an upload is abandoned by `PREVIEW_FLIGHT_MS` (10 minutes), which is the
  dispatch call's own limit, `DISPATCH_CALL_MS`, kept equal by a test;
- so a claim older than `PREVIEW_LAND_MS` (16 minutes) can no longer land
  anything.

**The tick** (`worker.js` `runPreviewRecovery`), with nobody's browser open:
- it walks the claims fairly by key and looks at each site once;
- it **waits** while any of the site's claims could still land;
- then, under a claim of its own, it puts up the version the draft selects
  NOW, from that version's staged script. Nothing is built, no model is
  asked, nothing is charged, and only the preview script is touched;
- confirmed, it removes every claim it read and its own. A claim made
  meanwhile is not its to remove;
- unconfirmed, its own claim stays too;
- the bounded retry policy is explicit:
  - it never tries again before the claims can no longer land;
  - nor before a doubling backoff from 2 minutes to an hour;
  - after `PREVIEW_TRIES` (12) it records `stuck` and stops;
  - a newer claim (a new save) unsticks it.
- `PREVIEW_STATE_KEY` is now only the tick's register: tries, next and
  stuck. It decides nothing about readiness.
- The container's storage wall admits a site's own claims and register, and
  no other site's.

**What it costs:** the repair after a hard stop comes at the first tick past
16 minutes, not at once. A tick that acted sooner could be overwritten by the
very upload it cannot see.

## 3. Tests

**`test/preview-recovery.test.mjs`, rewritten around claims (PR1–PR10).**
The interruptions are hard stops: an upload function lands its script and
never returns, so no catch, finally or cleanup of the save runs after the
external upload.

The save on its own (PR1–PR3d):
- PR1: a failed repair.
- PR2: a lost answer.
- PR3: an unreadable draft after the stale upload.
- PR3b: an older save that confirms while a newer save's claim stands is
  not ready.
- PR3c: no claim, no upload.
- PR3d: no upload past the window, and an unreadable claim list is not
  "none".

Through the real Worker tick, with real draft revisions:
- **PR4, Codex's reproduction:**
  - the newer save is not called ready;
  - ticks while the older claim could still land wait and say so;
  - the first tick after it puts the selected version up and clears every
    claim;
  - a later tick has nothing to do;
  - no model call, no ledger row, nothing live.
- PR5: a save that stops for good after its record (and one before it).
- PR6: a newer draft saved while the tick's upload is in flight. The
  tick's own claim is seen standing, the newer save is not ready, and the
  newer version is left up.
- PR7: three duplicate ticks at once.
- PR8: the retry policy step by step: the landing wait, the doubling
  backoff (also when longer than the landing time), `stuck` after 12, and
  unstuck by a newer claim.
- PR9: storage permissions and the flight bound.
- PR10: `draftFacts` and the schedule.

**Unchanged and still passing:** DPH1–DPH4, DMO1–DMO3, MR1–MR5, PPM, the
draft-first suites, and the media-abort and sweep suites.

## 4. Completion matrix

**Superseded by `docs/history/2026-10-16-codex-batch-6.md` §5** (an advancing
clock, the window asked before the external call, uncertain writes
reconciled).

This replaces the fourth batch's §4. Rows not named here are unchanged from it.

| Area | Item | Finished (offline) | Deferred implementation | Live-only verification still owed |
|---|---|---|---|---|
| Publish | the preview's head is the version it serves | yes (DPH1–DPH4, DMO1, MR5) | — | the preview host after an image roll |
| Publish | **preview crash recovery: one claim per uploading writer (saves and the tick); a writer's success never clears another's obligation; repaired by the tick after a hard stop, a stop between record and preview, a newer draft mid-recovery, duplicate ticks; no claim, no upload; bounded retries; nothing rebuilt, charged or live** | **yes (PR1–PR10, PR3b–PR3d)** | the owner's panel showing `previewPending` (frontend, deferred) | two real saves racing on Cloudflare; a real dispatch upload's timing against the 10-minute bound |
| Publish | an older preview visible until the tick (up to ~16 minutes after a hard stop, longer while uploads keep failing; `stuck` waits for a person or a new save) | stated | a conditional script upload does not exist in the platform | — |
| Media | an abort proven before its records go | yes (MAR1–MAR6) | — | R2's real NoSuchUpload code and its own multipart expiry |
| Frontend | customer-facing narration of these states | — | deferred (owner) | — |
| Rollout | merge, SQL, switches, image roll | — | deferred (owner) | the image-free batch, first batch §7 |
