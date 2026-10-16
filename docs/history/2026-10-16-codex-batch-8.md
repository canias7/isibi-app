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

## 4. The evidence reads (after Codex's review of `305c9425`)

Codex passed 190 focused checks on `305c9425`; the two Build failures above
stood fixed. **One evidence gap remained.**
- `listBuilds` caught each manifest's read or parse failure and silently
  left that version out.
- `savedOfJob` then answered "none" for this job's draft revision.
- `lostBuildVerdict` read "none" beside the earlier code's marker
  (`published`, no `live`) as publication.

Codex's reproduction: one failed get of that version's `manifest.json`.
Recovery recorded `published`, dropped the pending entry and said the site
went live. Two healthy passes kept that answer, though the draft existed
and no pointer did.

**The contract now** (`site-builds.mjs`, `build-lease.mjs`,
`site-reconcile.mjs`, `worker.js`):
- **One manifest** (`readManifest`) is read for what it proves:
  - `read`;
  - `absent` (a staging that never finished);
  - `unreadable` (a failed read, bad JSON, no files).
  Unreadable is never absence.
- **The listing** (`listBuildsRead`) names what it could not read
  (`unread`). `listBuilds`, the versions panel's reader, answers the same
  versions as before.
- **Lost-build recovery reads the exact manifest** of each of this job's
  revisions, with its state:
  - read and naming this job proves the version is this job's;
  - unreadable, or absent though a revision names it, is unknown;
  - read and naming another job proves nothing.
  A decision from absence (a job from before the fence: no version of it,
  nothing unattributed) waits while any manifest is unread.
- **The same reader's other recovery callers had the same failure class**,
  each demonstrated on `305c9425` and fixed together:
  - the Edit reconcile refunded a draft-first job `never-staged` when its
    version's manifest could not be read; it now waits (unknown) and keeps
    the job as a saved draft once the manifest reads;
  - the owner's source-by-job route said "no stored version of this site
    was staged by that job"; it now answers 503 while any manifest is
    unread.

**Tests** (`test/build-evidence-reads.test.mjs`, BER1–BER9), at the storage
boundary:
- BER1: Codex's reproduction;
- BER2/3: malformed, missing and file-less manifests, then restored;
- BER4: a partial listing for a job from before the fence (it had been
  refunded 6);
- BER5: controls: a genuine earlier publication, a clean saved draft beside
  an unrelated unreadable manifest, both new-format markers, an unrelated
  revision;
- BER6: the readers themselves;
- BER7a/BER7: the Edit reconcile, offline and through its lifecycle;
- BER8: the owner route;
- BER9: another job's manifest proves nothing.

## 5. Results (measured)

- **Red checks.**
  - On `c77cc4ba` (before this batch): 12 of the 15 BDR/BDL cases fail
    there on the defect itself. The three that pass are the controls the
    earlier code already got right: BDL5 (a failure before saving), BDR4
    (an unrelated draft) and BDR6 (a genuine refusal).
  - On `305c9425`: BER1–BER4 and BER6–BER8 fail there. Codex's case records
    `published`, and the partial listing refunds 6. BER7's lifecycle alone
    fails ("a job whose version's manifest was unreadable was refunded").
    BER5, the controls, passes.
- **Sweeps.**
  - `scripts/mutants/codex-batch-8.json`: 22 of 23 at first. E19 survived
    because the line it removed was redundant: the resume's answer already
    spreads its pages' draft facts. The line was removed, BDL6 now asserts
    the resumed build's own answer, and the spec holds 22 of 22.
  - `scripts/mutants/codex-batch-9.json`: 12 of 13 at first (F9 survived).
    BER9 was added, and a follow-up killed F9: 13 of 13.
  - Every comment-only control survived.
- **The related suites together:** 1,105 / 1,105 at `02f577d9`, and
  1,139 / 1,139 at `d4289e0b`.
- **Full suite locally:** `305c9425` 11,370 / 11,368 / 0 / 2. `d4289e0b`:
  FULL_PENDING.
- **Unit CI:**
  - run 38968286798 on `305c9425`, 11,370 / 11,322 / 0 / 48, success; site
    build 38968286831 success;
  - runs on `02f577d9` and `8dd9328e` were cancelled by the next push;
  - CI_PENDING.

## 6. Completion matrix

This corrects the seventh batch's §5, which had grouped Build with the
verified Edit and Add-on cases.

| Area | Item | Finished (offline) | Deferred | Live-only verification still owed |
|---|---|---|---|---|
| Edit/Add-on | a landed save whose answer was lost settles once from the job's own revision | yes (seventh batch, DOR1–DOR8b) | — | a real lost R2 answer |
| Build | a draft save recorded as saved, a publication as published (`live`) | yes (BDR2, BDR8, BDL1, BDL6) | — | — |
| Build | lost-build recovery: before the marker, after it, the earlier code's marker; this job's own revision, version and journal; unrelated drafts prove nothing | yes (BDR1–BDR5, BDR7, BDL2, BDL3, BDL6) | — | a real lost build under draft-first |
| Build | missing or unreadable evidence stays unknown and recoverable: the draft record, a held journal, **each manifest read for this job's exact version, a listing that names what it could not read** | yes (BDR3, BDR5, BDR9, BER1–BER6, BER9) | — | R2's own read failures and listing behaviour |
| Edit/owner route | the same listing's other recovery callers wait on an unread manifest (no `never-staged` refund, no "no version") | yes (BER7a, BER7, BER8) | — | — |
| Build | external billing unchanged: saved keeps its charges, not-published refunds once, nothing generated twice | yes (BDR1, BDR6, BDL2–BDL5) | — | — |
| Build | a lost save answer during the build | yes (BDL4) | — | — |
| Requests | a saved rewrite settles its part as a draft, its dependant runs; a lost one waits for recovery | yes (BDL1–BDL3, BDL5) | — | — |
| Build | Publish after recovery | yes (BDL2, BDL3) | — | — |
| Frontend | narration of saved, pending, failed and published | — | deferred (owner) | — |
| Rollout | merge, SQL, switches, image roll | — | deferred (owner) | — |
