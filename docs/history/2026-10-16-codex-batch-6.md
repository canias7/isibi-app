# The sixth batch on `codex-work-into-claude`, after Codex's review of `dbf7a2c8` (2026-10-16)

**On the owner's word**, on `codex-work-into-claude` only, for Codex's review.
Nothing merged, deployed, switched, applied to production SQL, built into an
image or spent; no paid test. `claude/chat-session-0nndv1` untouched
(`f9f983a3`). Codex passed 52 focused tests on `dbf7a2c8`, and the hard-stop
case stands. Two recovery gaps remained and are closed here together. Exact
commits, results and CI are in owner-notes (2026-10-16, sixth batch).

## 1. The tick's clock froze at its start

**Codex's reproduction.** `runPreviewRecovery` handed `convergePreview` a
clock of `() => now`. Codex drove the real Worker recovery with a simulated
clock: the first upload failed after six minutes, and the recovery then
started another upload "at minute zero". That was past
`PREVIEW_UPLOAD_WINDOW_MS` (five minutes).

**The fix:**
- **An advancing clock throughout.** The tick's `now` is a clock function,
  or a starting time from which the real clock advances. Every comparison
  reads it afresh:
  - the landing wait;
  - the backoff;
  - the writer's own claim;
  - the deadline;
  - the register.
- **A writer's claim is stamped when that writer starts.** The tick claims
  each site at the moment it begins work on it, not when the tick began, and
  counts its window from there. A site processed after a slow one gets its
  own window.
- **The window is asked immediately before the external upload.**
  - `convergePreview` asks before each attempt, and hands the upload a `go`
    check.
  - `previewVersion` passes it through after its staged-build read.
  - `uploadScriptOnce` asks it again right before `uploadSiteWorker`.
  - Both activations hand it to the save's `preview` and `repreview`.
  - So an upload that waited on a slow storage read does not start late.
- **Why retiring a claim stays sound.** No upload of a writer starts after
  `claim + 5 minutes`, and each upload is abandoned by the dispatch call's own
  10-minute limit. So nothing of that writer can land after
  `claim + PREVIEW_LAND_MS` (16 minutes). A writer that runs out of window
  keeps its claim, and the next tick waits out that claim's landing time
  before it repairs and retires it. An expired writer can neither start
  another upload nor shorten that bound.
- **The remaining external timing assumption, stated exactly.** An upload's
  effect lands within `DISPATCH_CALL_MS` (10 minutes) of the moment it
  starts: the dispatch call is aborted by its own timeout
  (`AbortSignal.timeout`), and Cloudflare is assumed not to apply a script
  upload whose request was abandoned more than a minute later. That minute
  is the margin in `PREVIEW_LAND_MS`.
  - Claims are stamped by each writer's own clock, and compared with the
    tick's.
  - Clocks on different isolates are assumed to agree within that same
    one-minute margin.
  - Neither assumption is measured.

## 2. A draft-record write whose answer was lost

**Codex's reproduction.**
- The draft-record put succeeded, then threw because its response was lost.
- `saveAsDraft`'s catch removed the claim unconditionally.
- The new draft stayed selected, the save answered failure, and no preview
  was uploaded.
- With no claim left, recovery inspected zero sites.

**The fix (`saveAsDraft`):**
- **A thrown write is reconciled, not forgotten.** After a throw from the
  held journal or the record write, the save reads the draft:
  - it selects this version: the write landed. The claim stays, and the
    answer says `recoverable: true, landed: true`;
  - it selects another version, or there is none: proven not landed. The
    claim is removed;
  - it cannot be read: uncertain. The claim stays (`landed: null`).
- **A confirmed refusal still removes the claim:** `saveDraftRecord`
  answering `ok: false`, or an older save.
- **A genuinely absent draft is not kept as permanent work.** When the tick
  reads the draft and there is none (`convergePreview` `absent`), it clears
  the claims it read and its own, uploads nothing, and records `cleared`
  instead of retrying to `stuck`. A draft that cannot be read is not
  absent.

## 3. The claim rules, reviewed together

The same rules now hold for saves and for the tick:
- **Creation.** A writer claims before anything it might need to recover:
  before the draft record for a save, before its first upload for the tick.
  It is stamped by the writer's advancing clock at that moment. No claim
  means no upload.
- **Uploads.** Uploads may start only inside `claim + 5 minutes`, asked
  immediately before each external call.
- **Retention.** A writer keeps its claim:
  - when its uploads are unconfirmed;
  - when its window ran out;
  - when a write's outcome is uncertain;
  - or when it stops for good.
- **Removal by its own writer:**
  - after confirming the selected version is up;
  - when a write is proven not to have landed;
  - on a confirmed refusal;
  - when it was overtaken before uploading.
- **Removal by the tick:** every claim it read, but only once each can no
  longer land, and only after it has either confirmed the selected version
  is up or read that there is no draft at all.

## 4. Tests

**`test/preview-recovery.test.mjs`: PR11–PR18 added; PR1–PR10 kept.**
PR8's backoff check now allows the milliseconds an advancing clock moves.
- PR11: a slow failure on an advancing clock. One attempt only, the claim
  kept, every upload inside its writer's window, the next tick waiting out
  that claim's landing time and then repairing.
- PR12: slow retries. Only those starting inside the window run, at
  minutes 0 and 3, never at 6.
- PR13: a six-minute staged-build read. No upload starts.
- PR14: two sites in one tick. The second site's claim is stamped after
  the first site's slow work, and both are repaired.
- PR15: Codex's lost record answer. The save fails, its claim stays, and the
  tick puts the selected draft's preview up.
- PR16: failure before the write removes the claim; an unreadable draft
  keeps it, and the tick settles it harmlessly.
- PR17: a genuinely absent draft is cleared, with no upload and not stuck;
  an unreadable draft is not absent.
- PR18: hard stops after the record lands, after the claim lands, and
  between a failed write and its reconciling read.
- Every worker case checks: no model call, no ledger row, no live change.

**Red check on `dbf7a2c8`:** all eight new cases fail there, and the thirteen
earlier ones pass. For example:
- PR14: the second site's claim was stamped 17 minutes before its work began;
- PR15: `{"ok":false,"error":"draft: r2 response lost"}` with no claim left.

## 5. Completion matrix

This replaces the fifth batch's §4. Rows not named here are unchanged from it.

| Area | Item | Finished (offline) | Deferred implementation | Live-only verification still owed |
|---|---|---|---|---|
| Publish | **preview crash recovery: one claim per writer (saves and the tick), stamped when the writer starts on an advancing clock; uploads gated immediately before the external call; uncertain writes reconciled against the draft; absent drafts cleared; bounded retries; nothing rebuilt, charged or live** | **yes (PR1–PR18, PR3b–PR3d)** | the owner's panel showing `previewPending` (frontend, deferred) | two real saves racing on Cloudflare; real dispatch timing against the 10-minute bound and the one-minute margin; isolate clock agreement |
| Publish | an older preview visible until the tick (up to ~16 minutes after a hard stop, longer while uploads keep failing; `stuck` waits for a person or a new save) | stated | a conditional script upload does not exist in the platform | — |
| Publish | a save whose record landed but whose answer was lost answers failure (the job is refunded) while its draft stands | stated (backlog) | reconciling the job's own outcome is outside this batch | — |
| Frontend | customer-facing narration of these states | — | deferred (owner) | — |
| Rollout | merge, SQL, switches, image roll | — | deferred (owner) | the image-free batch, first batch §7 |
