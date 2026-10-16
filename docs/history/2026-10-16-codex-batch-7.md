# The seventh batch on `codex-work-into-claude`, after Codex's review of `74cbce6b` (2026-10-16)

**On the owner's word**, on `codex-work-into-claude` only, for Codex's review.
Nothing merged, deployed, switched, applied to production SQL, built into an
image or spent; no paid test. `claude/chat-session-0nndv1` untouched. Codex
passed all 60 focused tests on `74cbce6b` and verified the timer and
preview-recovery corrections; both stand unchanged here. Exact commits,
results and CI are in owner-notes (2026-10-16, seventh batch).

## 1. Codex's reproduction

On an already-published fixture site with `DRAFT_FIRST` on, a text edit's
draft-record write succeeded and then lost its response. The selected draft
held the new text and the live site was unchanged. Yet after background
reconciliation the request and its part were failed, the job was failed and
refunded (`never-activated`), and the preview claim remained. Reproduced
exactly as DOR1 on `fbf7da97` (§4).

## 2. The fix: a job's outcome from its own durable records

The proof is always the job's **own** revision in the draft record — its job
id, its staged version, and its held journal when it carries held changes —
never "some draft exists" and never an old version in the history.

- **Inline (the save still running).** A record write whose answer is lost
  re-reads the draft (`savedRevision(draft, { job, version, held })`). Proven,
  the save goes on as saved: commit once, the editable copy only while its
  version is still the selected draft, the preview converged, the claim
  removed (Edit, Add-on and Build share this save; a build passes its job
  id). Unproven, it fails as before (the claim stays when the write may
  have landed). The same for a held seal (`sealHeld`, data and rules edits):
  a lost answer is proven by the job's held revision.
- **Background, the job stopped after its record and before its commit**
  (needs review). `reconcileFacts` reads the draft record and the job's held
  journal; `draftVerdict` decides first:
  - this job's revision of this job's version (or, held-only, its held
    revision with the journal read back) → **kept `draft-saved`**, billed once
    (`edit_reconcile` committed), the migration record corrected as an
    answered save writes it;
  - the record unreadable, the journal unread or missing, or a list of 60
    trimmed past its first revision → **unknown**, left in review, never
    refunded;
  - nothing of this job → the existing verdicts (a refund where nothing of it
    was saved).
- **Background, the job stopped after its commit** (the lost-job sweep
  finalizes it with a bare `recovered`). When the request driver reads such a
  row under draft-first (`draftSavedEvidence`), the job's own revision (and
  its journal, if held) turns it into a `draft-saved` answer; anything less
  leaves it as it was.

## 3. The facts carried through

- **`checks`** (every page-publishing answer): `revision` and `preview`
  (`ready` once confirmed on the selected draft, `pending` while an upload is
  unconfirmed) beside `draft: true`; read strictly (`readChecks` refuses
  either on a published answer). The sentence says the revision and, when
  pending, that the preview may show the version before for a few minutes.
- **`draft`** facts (`draftFacts`) now ride all eleven page-publishing edit
  and add-on answers and the merged multi-lane answer — **the text edit's
  answer carried none** (the backlog item, closed).
- **A first build saved as a draft** (`buildChecks`) is said as its draft
  revision, no longer as published.
- **A reconciled saved draft**: the job's answer carries `reconciled:
  "draft-saved"` and `draft: { published: false, version, revision, selected,
  preview }`; the request driver reads it as a part done with outcome `draft`
  ("saved the change as draft revision N (not published; what it changed was
  not recorded)"), which is what any step that needs it is told
  (`partOf`); the reply facts say the same, never "Published".
- Saved, preview pending, failed and published stay four different answers.

## 4. Tests

`test/draft-outcome.test.mjs` (DOR1–DOR8b), through the real request driver,
queue, Worker and draft store:

- DOR1 Codex's reproduction inline; DOR2 a hard stop after the record
  (reconcile kept, a second reconcile and duplicate delivery change nothing,
  Publish works); DOR3 a hard stop after the commit (the sweep's bare
  `recovered` read as the saved draft); DOR4 failure before the write
  (control: refunded, part not done); DOR5 a newer draft arriving while the
  answer is lost (built on this job's revision: proven; replaced without it:
  refused and refunded); DOR6 a held data edit's lost answer; DOR6b an
  add-on's page and held table stopped after its record (kept by revision
  and journal; the table created only by Publish, once); DOR7 a dependent
  part waits for its prerequisite to be proven saved and is told it saved a
  draft; DOR8/DOR8b the verdict and every reader, offline.
- Every lifecycle case also checks billing once and nothing live without
  Publish.

**Results (measured):**
- Red check on `fbf7da97`: 9 of the 10 lifecycle cases fail there on the
  defect itself (DOR1 answers Codex's `never-activated`, refunded); DOR4,
  the failure-before-write control, passes.
- Sweep `scripts/mutants/codex-batch-7.json`: 15 of 17 on the first pass
  (D14 an unconfirmed preview said ready, D16 the saved schema's record not
  corrected survived); DOR1b and DOR6c were added for them and a follow-up
  killed both; 17 of 17, every comment-only control survived.
- The related files together: 559 of 559 before the follow-up cases.
- Full suite locally on `fd951ba3`: 11,355 / 11,353 / 0 / 2. The first full
  run (on `2f3af30a`) failed one wiring guard that spelled the wording
  reply's fields exactly; fixed in `fd951ba3`.
- Unit CI: run 38965420327 on `fd951ba3`, 11,355 / 11,307 / 0 / 48, success;
  run 38964324452 on `2f3af30a` failed that same guard; run 38964113997 on
  `1e463350` was cancelled by the next push. Site build run 38964113793 on
  `1e463350`: success.
- Codex then passed 121 focused tests on `fd951ba3`.

## 5. Completion matrix

| Area | Item | Finished (offline) | Deferred | Live-only verification still owed |
|---|---|---|---|---|
| Edit/Add-on | a landed save whose answer was lost settles once from the job's own revision: inline, after a stop before the commit, after a stop after it | yes (DOR1–DOR3, DOR6, DOR6b) | — | a real lost R2 answer |
| Edit/Add-on | genuine refusals and refunds kept: failure before the write, a newer draft without this job's revision, `older` | yes (DOR4, DOR5, DMO1 unchanged) | — | — |
| Edit/Add-on | unreadable, journal-less or trimmed evidence stays unknown and recoverable | yes (DOR8) | — | — |
| Answers | revision and preview readiness in `checks`, `draft` facts on every page answer (the text edit's gap), builds saved as drafts said as drafts | yes (DOR1, DOR8) | frontend narration (owner) | — |
| Requests | a reconciled saved draft is a part done as `draft`; dependents wait for the proof and are told it | yes (DOR2, DOR3, DOR7) | — | — |
| Build | **not verified in this batch**: a build's lost save, and its lost-build recovery | the inline proof is shared (`activateBuild` hands `saveAsDraft` the build's job id) but untested for a build; lost-build recovery still read a draft save as published (Codex, on `fd951ba3`) | the eighth batch | — |
| Rollout | merge, SQL, switches, image roll | — | deferred (owner) | — |
