# The eighth batch on `codex-work-into-claude`, after Codex's review of `fd951ba3` (2026-10-16)

**On the owner's word**, on `codex-work-into-claude` only, for Codex's review.
Nothing merged, deployed, switched, applied to production SQL, built into an
image or spent; no paid test. `claude/chat-session-0nndv1` untouched. Codex
passed 121 focused tests on `fd951ba3`, including the seventh batch's
saved-draft outcome fixes; those stand unchanged. Exact commits, results and
CI are in owner-notes (2026-10-16, eighth batch).

## 1. Codex's two reproductions

Through `stageBuild` → `claimBuildFence` → `activateBuild(asDraft:
saveAsDraft)` → `reconcileLostBuilds`:

- **Stopped before the completion marker**: the saved draft stayed
  `unknown` / `publish-in-flight` on every recovery pass, so it was never
  settled.
- **Stopped after it**: recovery said `published` and told the customer the
  site went live, though the live pointer was absent and the version
  existed only as a draft.

The cause: the Build path called `markPublished` after any successful
activation, a draft save included, and lost-build recovery read that marker
as publication.

## 2. The fix

- **Completion records** (`worker.js`):
  - a draft save is recorded on the job's fence as `saved`, with its draft
    revision and held journal (`markSaved`);
  - a publication is recorded as `published` with `live: true`
    (`markPublished`), and `live` is written nowhere else;
  - neither marker overwrites the other or a recorded failure.
- **Recovery decisions** (`lostBuildVerdict`, `savedOfJob`):
  - `saved` marker → `saved`;
  - `published` with `live` → `published`;
  - `published` without `live` (written by the earlier code, after a draft
    save or a publication alike) → `saved` when this job's own revision of
    that version is in the draft record; unknown when the record, the
    versions or the journal cannot be read, or the list is trimmed past
    it; published otherwise (a real earlier publication, no draft
    revision);
  - no marker and a publish-held fence → `saved` from this job's own
    revision of a version a manifest says this job staged, its held journal
    read back; another job's revision, or this job's id on a version it
    never staged, proves nothing;
  - a recovery-held fence is still `not-published` (no save can follow it).
- **Settlement and money**: `saved` keeps what the build charged, exactly
  as `published` does — never a reversal; `not-published` is refunded as
  before; the refund stays idempotent by ref.
- **Stored answers**: recovery's `saved` answer is `ok: true`, `page:
  "app"`, `draft: { published: false, version, revision }` and `checks`
  saying a draft revision; its sentence says the draft was saved, the live
  site is unchanged, and Publish puts it live. The build's own answer (inline
  and resumed) now carries its `draft` facts. Settlement facts, an answer's
  known settlement and the reply's note all carry `saved`.
- **Dependent requests**: an approved rewrite answered as a saved draft is a
  part done ("saved them as draft revision N (not published)"), so what
  needs it runs; a lost rewrite with no answer yet waits
  (`rewrite-recovering`) until recovery decides, instead of failing.

## 3. Tests

- `test/build-draft-recovery.test.mjs` (BDR1–BDR9), Codex's chain:
  - BDR1, before the marker;
  - BDR2, after the new marker;
  - BDR3, the earlier code's marker (`saved`; the draft unreadable →
    unknown, then `saved`; a real earlier publication stays published);
  - BDR4, unrelated drafts;
  - BDR5, the draft unreadable and a held journal missing, each settled
    once the evidence reads;
  - BDR6, a genuine failure before saving (refunded once);
  - BDR7, a newer draft after the save;
  - BDR8, the markers;
  - BDR9, the readers.
- `test/build-draft-lifecycle.test.mjs` (BDL1–BDL6), the real lifecycle:
  - an approved rewrite through the request driver, the queued build, the
    sweep and recovery: BDL1 no fault; BDL2 a hard stop before the marker;
    BDL3 after it; BDL4 a lost save answer; BDL5 a failure before saving;
  - each checks one design, the charges kept or not taken, the part and
    its dependant, repeated ticks and deliveries, nothing live, and
    (BDL2, BDL3) Publish;
  - BDL6: a first build through the real consumer and resume, then each
    crash's durable state (no answer and no marker; no answer after the
    marker; the earlier code's marker) settled by the real recovery.
- The request-flow fixture filters `edit_jobs` by `op`, `state` and an id
  set, and answers `updated_at` as a timestamp, as PostgREST does;
  recovery's reads depend on all of them.

RESULTS: filled after the runs.

## 4. Completion matrix

This corrects the seventh batch's §5, which had grouped Build with the
verified Edit and Add-on cases.

| Area | Item | Finished (offline) | Deferred | Live-only verification still owed |
|---|---|---|---|---|
| Edit/Add-on | a landed save whose answer was lost settles once from the job's own revision | yes (seventh batch, DOR1–DOR8b) | — | a real lost R2 answer |
| Build | a draft save recorded as saved, a publication as published (`live`) | yes (BDR2, BDR8, BDL1, BDL6) | — | — |
| Build | lost-build recovery: before the marker, after it, the earlier code's marker; this job's own revision, version and journal; unrelated drafts prove nothing | yes (BDR1–BDR5, BDR7, BDL2, BDL3, BDL6) | — | a real lost build under draft-first |
| Build | missing or unreadable evidence stays unknown and recoverable | yes (BDR3, BDR5, BDR9) | — | — |
| Build | external billing unchanged: saved keeps its charges, not-published refunds once, nothing generated twice | yes (BDR1, BDR6, BDL2–BDL5) | — | — |
| Build | a lost save answer during the build | yes (BDL4) | — | — |
| Requests | a saved rewrite settles its part as a draft, its dependant runs; a lost one waits for recovery | yes (BDL1–BDL3, BDL5) | — | — |
| Build | Publish after recovery | yes (BDL2, BDL3) | — | — |
| Frontend | narration of saved, pending, failed and published | — | deferred (owner) | — |
| Rollout | merge, SQL, switches, image roll | — | deferred (owner) | — |
