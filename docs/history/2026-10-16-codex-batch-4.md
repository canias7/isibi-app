# The fourth batch on `codex-work-into-claude`, after Codex's review of `ea9a2b71` (2026-10-16)

**On the owner's word**, on `codex-work-into-claude` only, for Codex's review.
Nothing merged, deployed, switched, applied to production SQL, built into an
image or spent; no paid test. `claude/chat-session-0nndv1` untouched
(`f9f983a3`). Codex passed 33 focused tests on `ea9a2b71`. The pagination and
the version-bound preview head stand. Codex found two recovery gaps, closed
here together. The exact commits, results and CI are in owner-notes
(2026-10-16, fourth batch).

## 1. The preview: honest results and durable recovery

**Codex's reproduction.**
- An older save was paused inside its preview upload, and a newer save
  finished. Then the older upload landed, so OLD was up last. Then the repair
  answered `{ ok: false, error: "upload failed" }`.
- The draft selected NEW and the preview served OLD.
- Yet `previewed` was `{ ok: true, superseded: true, repaired: false }`, so
  `draftFacts` said `previewUploaded: true`.
- The loop took the failed repair as NEW being up and stopped after one try.
- Nothing came back to it later.

**The fix** (`site-draft.mjs`, `worker.js`):

- **What a result says:**
  - `convergePreview` counts a version as up only when its upload answered
    `ok`. An upload that failed, threw, or lost its answer confirms nothing,
    so what serves is unknown and the next round tries again, up to three.
  - `ready` is true only when the last confirmed upload is the version the
    draft still selects.
  - `previewed.ok` now means the preview is ready. `pending`, `recoverable`
    and the error are said beside it.
  - The save itself (`ok`) stands either way: saved-draft success is kept
    apart from preview readiness.
  - `draftFacts` gives `previewUploaded` (ready) and `previewPending`.
- **A durable mark** (`preview-state/<slug>.json`):
  - a save marks it pending BEFORE it puts a script up;
  - it marks it ready only over the etag of its own mark, so a newer save's
    pending mark is never overwritten;
  - a save that ends unconfirmed marks pending again, whatever stands. A
    newer save may have marked it ready before this save's stale upload
    landed. Pending is never wrong: at worst the tick puts up what is already
    there.
  - The container's storage wall admits a site's own mark and no other.
- **The tick** (`runPreviewRecovery`, on the scheduled handler, with nobody's
  browser open):
  - it walks the marks fairly by key, 20 per tick;
  - for each pending mark it brings the preview to the version the draft
    selects NOW, from that version's own staged script (`previewVersion`).
    Nothing is built, no model is asked, nothing is charged;
  - it leaves a mark younger than a minute to the save still at work;
  - a try that does not converge waits, doubling from two minutes up to an
    hour;
  - after 12 tries the mark says `stuck`;
  - every write is over the etag read;
  - it uploads only the preview script, so Publish stays the only way to
    the live site.

## 2. Media cancellation: proven before records go

**Codex's reproduction.**
- `runMediaSweep` caught every multipart abort error as "already gone".
- It then dropped the session and part records and counted the session
  reclaimed.
- One transient abort failure left the multipart upload in place with its
  session gone, and three ticks made one abort attempt.

**The fix** (`site-media.mjs`, `worker.js`):
- **`abortProven`**: `true` when the abort answered, or when R2 said
  `NoSuchUpload` (10024), which proves the upload is gone. `false` when the
  request failed or its answer was lost, which proves nothing.
- **The sweep:** when the abort is unproven, the session and its parts are
  kept and tried again next lap.
  - It reads `releaseMedia`'s answer (`ok`), not just the absence of a
    throw.
  - A session marked `aborting` is due at once.
- **The ledger's own expiry (`changeLedger`):** an expired reservation's
  session and parts are dropped only once its abort is proven. An entry that
  never learnt its upload's id leaves the session to the sweep, which reads
  the id from the session itself.
- **A cancelled or refused upload (`abortQuietly`):** when the abort is
  unproven, the session is kept as `aborting` and its room is given back.
  - `liveSession` treats `aborting` as no upload, so it takes no part and
    nothing finishes.
  - The tick stops it and reclaims it.
- **Unchanged:** no object under `uploads/` is deleted; a completed upload's
  file and an active upload are untouched.
- **The fixture** (`r2-media.mjs`) now answers an abort as R2 does:
  `NoSuchUpload` (10024) for an upload that is not there, and
  `lose: { abort }` for an abort that lands and loses its answer.

## 3. Tests

- **New: `test/preview-recovery.test.mjs` (PR1–PR5).**
  - PR1: Codex's reproduction. The save stands, the preview is not ready
    (pending, recoverable, error said), the repair is tried 3 times, and the
    mark says pending.
  - PR2: a lost answer is confirmed by the next round; lost every time, the
    preview stays pending.
  - PR3: the save is interrupted after the stale upload.
  - PR3b: a newer save's pending mark survives an older save's ready.
  - PR4: the Worker's tick on real draft saves. Covered: a normal save
    leaves ready; a stale preview is fixed; a mark younger than a minute is
    left alone; a failed round waits out its backoff; a lost answer is
    confirmed next try; a newer draft selected mid-recovery wins and its
    mark is not overwritten; a real save whose preview cannot go up stands
    and is finished by the tick. No model call, no ledger row, nothing live
    throughout. The mark is stuck after the bound, and the tick is on the
    schedule.
  - PR5: storage permissions.
- **New: `test/media-abort-recovery.test.mjs` (MAR1–MAR6).**
  - MAR1: a failed abort, then recovery, in two attempts.
  - MAR2: an upload already absent.
  - MAR3: a lost answer.
  - MAR4: the room not given back.
  - MAR5: the ledger's expiry, with a control.
  - MAR6: a cancel whose abort fails.
  - Completed files and active uploads are checked in MAR1 and MAR6.
- **Red check on `ea9a2b71`:** the new media cases fail there on the defect
  itself, and MAR2, the already-absent control, passes there.
  - MAR1 reclaimed both sessions after one failed abort.
  - MAR3 took a lost answer as proof.
  - MAR4 dropped a session whose room was not given back.
  - MAR5: the ledger's expiry dropped a session whose upload was not
    stopped.
  - MAR6: the cancelled session was gone.
  - The preview file fails at import there, because the old code has no
    recovery to call. Codex's report is its reproduction, and PR1 restates
    it step for step.

## 4. Completion matrix

**Superseded by `docs/history/2026-10-16-codex-batch-5.md` §4.** The preview
row below claimed crash recovery finished; it was not until the fifth batch
(a writer that stopped for good after a stale upload was not recovered).

This replaces the third batch's §4. Rows not named here are unchanged from it.

| Area | Item | Finished (offline) | Deferred implementation | Live-only verification still owed |
|---|---|---|---|---|
| Publish | the preview's head is the version it serves | yes (DPH1–DPH4, DMO1, MR5) | — | the preview host after an image roll |
| Publish | **the preview converges on the selected draft: honest readiness apart from the save; failed, lost, interrupted and overtaken uploads recovered by the tick, bounded, browser closed, nothing rebuilt or charged, nothing live** | **yes (PR1–PR5)** | the owner's panel showing `previewPending` (frontend narration, deferred) | two real saves racing; Cloudflare's own upload failures |
| Publish | a moment of an older preview while a save or the tick repairs it | stated | a conditional script upload does not exist in the platform | — |
| Media | abandoned sessions/parts/drafts reclaimed fairly; nothing referenced removed | yes (MSF1–MSF7, MR2, MR2b, MR4) | — | R2's own listing behaviour; a tick's subrequest count |
| Media | **an abort proven before its records go (sweep, ledger expiry, cancel); NoSuchUpload as proof; the room's answer read; failed and lost aborts retried** | **yes (MAR1–MAR6)** | — | R2's real NoSuchUpload code and its own multipart expiry |
| Frontend | customer-facing narration of these states | — | deferred (owner) | — |
| Rollout | merge, SQL, switches, image roll | — | deferred (owner) | the image-free batch, first batch §7 |
