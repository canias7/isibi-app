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

**Results (measured):**
- **Red check on `ff842781`:** 4 of 6 fail on the defect itself.
  - EER1 refunded `never-staged` (Codex's case);
  - EER4 kept an add-on whose manifest was missing;
  - EER5 ran the dependant early;
  - EER7, the verdict offline.
  - Two pass there: EER2/3 (thrown and malformed reads, already unknown since
    the eighth batch; they stay as regression guards) and EER6 (the genuine
    control).
- **Sweep `scripts/mutants/codex-batch-10.json`:** 7 of 7 killed; both
  comment-only controls survived.
- **The related suites together:** 1,167 / 1,167.
- **Full suite locally.**
  - On `567ada13`: 11,385 / 11,382 / 1 / 2. The failure was PR6, an earlier
    test that compared the tick's claim stamp exactly. Since the sixth batch
    that stamp comes from an advancing clock, so PR6 failed 2 of 5 runs
    alone. Fixed in `5f5ecaa3` (test only, no product code), then 12 of 12
    alone and its file 21 of 21 three times.
  - On `5f5ecaa3`: 11,385 / 11,383 / 0 / 2.
- **Unit CI:**
  - run 38971917378 on `95974b1b`: 11,385 / 11,337 / 0 / 48, success;
  - run 38973278304 on `5f5ecaa3`: 11,385 / 11,337 / 0 / 48, success;
  - site build 38971848496 on `db544075`: success;
  - the runs on `db544075` and `567ada13` were cancelled by the next push.
- **Codex passed 205 focused tests on `95974b1b`**, and its own
  missing-manifest reproduction recovers.
- **Everything here is offline**; what needs production is in the table
  below.

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

## 5. The consolidated completion table: the three goals

From the records of the whole branch (`2026-10-16-codex-work-into-claude.md`
and batches 2–9), no new audit. "Verified offline" means supplied model
answers, the in-process store and network stand-ins; nothing here has been
pressed live on this branch.

| Goal | Item | Implemented | Verified offline | Remaining backend work | Needs production to verify |
|---|---|---|---|---|---|
| **Parallel tasks (Build/Edit/Add-on)** | independent parts of one request run side by side; a part waits for what it needs | yes (behind `PARALLEL_WRITES`) | yes (CW1–CW12, PPM2) | the proposed `request_beside.sql` must be applied before the switch is turned on | two writing jobs overlapping on real infrastructure |
| | a part lost to its own request's overlap re-runs alone; an older save is never billed; parallel results land in one draft | yes | yes (CW5, PPM3, PPM3b, DMO1) | — | live |
| | additions judged by their targets; provisioning beside the page writer | yes | yes (AB1–AB3, BC1) | an addition's page writer prepared past its design; a row read one at a time (backlog) | real Neon timing |
| | a dependent part waits until its prerequisite is proven saved, then runs once | yes | yes (DOR7, BDL1–BDL3, EER5) | a lost build whose evidence never reads is retried with no limit, and its part waits as long | — |
| | writes from different requests | not in scope | — | — | — |
| **Only explicit Publish goes live** | every Build, Edit and Add-on change saved as a draft revision (`DRAFT_FIRST` into every job, resumes included); the live site untouched | yes | yes (DF*, DFB*, DH1–DH5, PPM2) | — | the `env` probe pressed in a real container; turning `DRAFT_FIRST` on |
| | Publish takes the exact revision; later drafts kept out; duplicate clicks; an interrupted publication finished by the sweep; Back online never publishes | yes | yes (DF2, DFP4/4b/5, PPM4b, DV3) | — | a real crash (not induced) |
| | the preview shows the selected draft: version-bound head, claims, the tick's recovery | yes | yes (DPH1–DPH4, PR1–PR18) | the preview script upload is not conditional (an older preview can show for up to about 16 minutes); timing assumptions unmeasured | the preview host after an image roll; Cloudflare's own upload failures |
| | a save that landed and lost its answer settles once as a saved draft (Edit, Add-on and Build), never refunded or published by mistake | yes | yes (DOR1–DOR8b, BDR1–BDR9, BDL1–BDL6) | — | a real lost R2 answer; a real lost build |
| | unreadable, malformed or missing evidence is never proof (manifests, the draft record, held journals) | yes | yes (BER1–BER9, EER1–EER7) | — | R2's own read failures and listing behaviour |
| | answers say saved, preview pending, failed and published apart | yes (backend facts) | yes (DOR1, DOR8, BDR9) | — | — |
| | owner panels (SEO, share, verify, domains, Data panel, restore) act at once | by design | — | owner's decision whether they should be held | — |
| | customer-facing narration of these states | — | — | frontend, deferred by the owner | — |
| **Video/audio upload hosting** | upload, sniffing, limits, ownership, Range/ETag seeking | yes | yes (media-* tests) | `If-Range` not read; `/u/<other-slug>` served on a site's own host (backlog) | live, since the consolidation |
| | Build, Edit and Add-on use hosted media; survives the handoff | yes | yes (media-route, media-recovery) | — | live |
| | held replacement and removal under draft-first; preview vs live; Publish | yes | yes (PPM1, DFB6, MR4, DV4) | — | live |
| | interrupted deletes, abandoned sessions and parts reclaimed fairly; aborts proven before records go | yes | yes (MR1–MR4, MSF1–MSF7, MAR1–MAR6) | a tick's subrequest count against the Worker limit (estimated, not measured) | R2's own multipart expiry and `NoSuchUpload` code |
| | `MEDIA_MAX_*` limits from the deploy to Worker and jobs | yes | yes (MR3) | — | a deploy with the variables set |
| | the publish copy with a known length | yes | not testable offline | — | live |
| **Rollout (all three)** | merge, production SQL, switches, image roll | — | — | deferred by the owner | the image-free live batch (first record §7) |
