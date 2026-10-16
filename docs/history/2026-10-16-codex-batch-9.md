# The ninth batch on `codex-work-into-claude`, after Codex's review of `5eca67cb` (2026-10-16)

**On the owner's word**, on `codex-work-into-claude` only, for Codex's review.
Nothing merged, deployed, switched, applied to production SQL, built into an
image or spent; no paid test. `claude/chat-session-0nndv1` untouched. Codex
passed 199 focused tests on `5eca67cb` and the `ff842781` handoff, CI green,
and the exact Build reproduction fixed; all of it stands. Exact commits,
results and CI are in owner-notes (2026-10-16, ninth batch).

## 1. The remaining gap (Codex's reproduction)

A text edit was stopped right after its draft record landed. That
revision's manifest was removed, recovery ran, the manifest was restored,
and recovery ran again.
- **Outcome:** the job became failed and refunded (`kind: never-staged`);
  its request failed and said "Ask again"; restoring the manifest changed
  nothing.
- **What was true meanwhile:** the draft stayed selected and the live
  content unchanged.

**The cause:**
- `listBuildsRead` leaves out an *absent* manifest (a staging that never
  finished), while an unreadable one is named, so `mine` was not found.
- `draftVerdict` recognised a code-only revision only through `mine`.
- So the reconcile fell through to `never-staged`.

The eighth batch's evidence rule had reached Build (`savedOfJob`) but not
the Edit and Add-on reconcile.

## 2. The fix: one evidence contract for Build, Edit and Add-on

- **A durable revision naming this job is evidence that it saved.** It
  contradicts "never staged".
- **The reconcile reads each such revision's version's own manifest and
  held journal** (`reconcileFacts`: `readManifest`, exact, with its read
  state). The same reads Build recovery makes.
- **`draftVerdict` decides by that evidence:**
  - the version is `mine`, or its manifest names this job → its code was
    saved: kept `draft-saved`, billed once;
  - its manifest names another job and the revision carries held changes →
    a held-only seal on the draft as it stood: its held changes were saved,
    proven by their journal;
  - its manifest names another job and nothing is held → proves nothing for
    this job;
  - its manifest is missing or unreadable → unknown
    (`draft-manifest-unread`), recoverable, never refunded, until it reads.
- **No revision of this job:** the existing refund verdicts stand
  (`never-staged`, `never-activated`), the genuine control.
- **No special case** for text edits or for any site: the rule reads the
  job's own records.

## 3. Tests

`test/edit-evidence-reads.test.mjs` (EER1–EER7), through the real request
driver, queue, sweep and reconcile:
- EER1: Codex's reproduction (missing, then restored), and then Publish;
- EER2/3: thrown reads, then a malformed manifest, each then restored;
- EER4: an add-on's page and held table (the table created only by
  Publish);
- EER5: a dependent part waits, then runs once;
- EER6: the genuine control (no revision of this job → refunded once as
  never live);
- EER7: the verdict offline.

Every lifecycle case also checks: no refund while unknown, billing once,
nothing regenerated, and nothing live until Publish.

BER7 (the eighth batch) now fails both of the first pass's reads, since the
reconcile's exact read is authoritative.

RESULTS: filled after the runs.

## 4. Completion matrix

This replaces the eighth batch's §6. Rows not named here are unchanged from
it.

| Area | Item | Finished (offline) | Deferred | Live-only verification still owed |
|---|---|---|---|---|
| Build | a revision naming this job, its version's manifest read exactly; missing or unreadable stays unknown | yes (eighth batch: BER1–BER9, BDR5) | — | R2's own read failures |
| Edit/Add-on | **the same rule**: missing, thrown or malformed manifest → unknown and waiting; restored → kept as a saved draft; held changes by their journal; no revision → refunded | **yes (EER1–EER7, BER7)** | — | a real lost edit under draft-first |
| Requests | a dependent part waits while its prerequisite is unknown, then runs once | yes (EER5) | — | — |
| Frontend | narration | — | deferred (owner) | — |
| Rollout | merge, SQL, switches, image roll | — | deferred (owner) | — |
