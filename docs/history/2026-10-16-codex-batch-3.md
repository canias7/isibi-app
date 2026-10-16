# The third batch on `codex-work-into-claude`, after Codex's review of `fbd53dca` (2026-10-16)

**On the owner's word**, on `codex-work-into-claude` only, for Codex's review.
Nothing merged, deployed, switched, applied to production SQL, built into an
image or spent; no paid test. `claude/chat-session-0nndv1` untouched
(`f9f983a3`). Codex passed the 22 focused tests on `fbd53dca` and reproduced
two remaining defects, both fixed here as general correctness problems. The
exact commit, results and CI are in owner-notes (2026-10-16, third batch).

## 1. The media sweep: fair, bounded, restartable

**Codex's reproduction.** `runMediaSweep` listed 100 sessions, looked at 25,
and kept its INCOMING cursor whenever it reached 25. With 25 live sessions at
the front of the listing, an expired 26th was never looked at: four ticks
reclaimed nothing, and a larger budget reclaimed it at once. The parts and
drafts passes always listed their first page, so an expired 101st draft stayed
behind 100 young ones for ever. The test fixture paged by two objects, which
hid both.

**The fix** (`worker.js` `runMediaSweep`, `sweepStep`):
- Each prefix (`media-sessions/`, `media-parts/`, `drafts/`) is walked on its
  own, in key order, with its own budget per tick (25, 50 and 50).
- A tick lists exactly its budget after the last key it reached
  (`startAfter`), looks at every key it listed, and keeps the last one. At the
  end of a prefix the next tick starts again from the front.
  - So every key is looked at within ceil(keys / budget) ticks.
  - An item that failed (a check that threw, a write that did not land) is
    looked at again on the next lap.
- The place is a key, not an opaque cursor, stored per prefix in
  `media-sweep/cursor.json` (`v: 2`).
  - A key deleted meanwhile, by the sweep or by anyone, still orders the next
    listing.
  - A restart, a lost write, an unreadable file, or a place that is not the
    prefix's own only starts that prefix again from the front.
  - A listing that fails keeps that prefix's place; the other prefixes go on.
- **Unchanged:**
  - only a session an hour past its own expiry is touched;
  - an upload whose bytes landed keeps its file;
  - a part record goes only when its session is gone and it is older than a
    session's life plus the grace;
  - **no object under `uploads/` is ever deleted**;
  - a pre-site draft goes a day after its seven.
- A ledger release that fails now skips that session to the next lap instead
  of ending the tick.

**The fixture** (`test/fixtures/r2-media.mjs`) now pages as R2 does:
- it honours `limit` (capped at 1000) and `startAfter`;
- its cursor names the last key served, so a deletion between pages shifts
  nothing;
- `pageSize` (default 2, as before) lets the older cases keep walking several
  pages, and the new cases pass `pageSize: 1000`.

## 2. The preview's head is the version it serves

**Codex's reproduction.** `saveAsDraft` wrote every version's sidecar to one
`sitemeta-draft/<slug>.json`, with no version and no fence. Codex paused an
older save immediately before that write, completed a newer save, then
resumed the older one. The draft stayed on the newer version, its preview
metadata became the OLD version's, and both saves answered success.

**Also found while fixing it:** the same overtaken save then uploaded its own
preview script, so the preview could serve the older version's code as well
as its head.

**The fix:**
- **No shared write at all.** Every staged version already holds its own head
  at `builds/<slug>/<version>/state/sidecar.json`. It is written once by
  `stageBuild`, before the version is saved, never again. It is also the
  bytes Publish of that version writes live (`readBuild` → `b.sidecar`). The
  preview copy of the site's script reads the head of the version it was
  built as (`SITE_VERSION`, baked in). So no earlier or later save can put
  another version's head under it.
  - **Reader:** `builder/lovable/template/src/server.ts`. When previewing, it
    reads that key first. A version staged without one, a script built
    before versions, and any request that is not a preview read the live
    head, as before.
  - **Generated template:** `builder/foundation-files.mjs`, regenerated.
  - **Storage permissions:** `builder/job-gateway.mjs` no longer admits
    `sitemeta-draft/<slug>.json`. A job's version prefix stays admitted
    under `builds/`.
- **The preview shows the draft's version, whichever save finishes last**
  (`site-draft.mjs` `saveAsDraft`):
  - a save overtaken after its record puts no script up (`superseded`);
  - an upload is not conditional, so every upload is followed by a look at
    the draft (up to three);
  - if a newer version stands by then, that version's own script is put
    back up from its staged prefix (`repreview`, `worker.js`
    `previewVersion`, handed in by both the edit and the build activation).
- **What stays:** the overtaken save still answers success. Its record was
  taken while it was newest, its code stands in the history, and under the
  publish turn a later save starts from its editable copy. This matches the
  first batch's rule, and only its preview and head are kept off the draft.
  The mixed code-plus-held refusal (`older`) is unchanged.
- **Recovery paths:**
  - a save whose preview did not go up is said, never a lost change, as
    before;
  - `previewVersion` re-uploads any staged version's script and refuses an
    unstaged one;
  - Publish writes live the same head the preview read (DMO1 now checks
    that).

## 3. Tests

- **New: `test/media-sweep-fair.test.mjs`, MSF1–MSF7.** These use realistic
  pages, more records than the budget, retained records sorting before
  expired ones, and many ticks.
  - MSF1: Codex's 25 live sessions ahead of an expired 26th.
  - MSF2: 100 young drafts ahead of an expired 101st.
  - MSF3: a live session's 120 old parts ahead of orphans.
  - MSF4: the place's key deleted by someone else, the cursor file deleted,
    and garbage in it.
  - MSF5: an item whose check fails once is reclaimed on a later lap.
  - MSF6: 200 ticks with a small budget delete no file and no unexpired
    session, and no tick looks past its budget.
  - MSF7: a finished prefix starts again at once, and a foreign place is not
    believed.
- **New: `test/draft-preview-head.test.mjs`, DPH1–DPH4.**
  - DPH1 is the deterministic overlap, run through the real `saveAsDraft`,
    `stageBuild`, `readBuild` and the real site-script reader. In one
    variant the older save is paused exactly where the shared write was; in
    the other it is paused inside its upload, so its upload lands after the
    newer one. In both, the preview serves the newer version with the NEWER
    head, both saves answer success, nothing shared is written, and nothing
    live moves. A single save is the control.
  - DPH2: `server.ts` transpiled with only its three imports stood in for.
    It covers the preview, a visitor's request, a version with no staged
    head, and the generated copy byte for byte.
  - DPH3: storage permissions.
  - DPH4: the Worker's `previewVersion` on real draft saves, and both
    activations wired.
- **Updated:**
  - DMO1: the preview is the draft's version, its staged head is there, no
    shared sidecar is written, and Publish writes that head live.
  - MR5: restated for the version-bound head.
- **Red check on `fbd53dca`** (the new tests and fixture over the old code):
  all 10 cases fail, and the failures are the defects themselves:
  - MSF1: `reclaimed: 0` over both ticks;
  - MSF2: `[0,0,0]` over three ticks;
  - DPH1: `before-preview: the preview was left on the older script`;
  - DPH3: the old shared key still writable;
  - DPH4: `previewVersion` missing.

## 4. Completion matrix

**Superseded by `docs/history/2026-10-16-codex-batch-4.md` §4** (preview
recovery and proven aborts, after Codex's review of `ea9a2b71`).

This replaces the second batch's §6. Rows not named here are unchanged from it.

| Area | Item | Finished (offline) | Deferred implementation | Live-only verification still owed |
|---|---|---|---|---|
| Parallel | independent parts side by side; dependencies wait | yes (CW1–CW12, PPM2) | — | two writing jobs overlapping on real infrastructure |
| Parallel | a part lost to its own request's overlap re-runs alone | yes (CW5, PPM3, DMO1) | — | live |
| Parallel | additions by their targets; refused and re-run when they need more | yes (AB1, AB3) | — | live |
| Parallel | page-only additions take the turn only at publish | yes (AB1, BC1) | — | live |
| Parallel | provisioning beside the page writer | yes (AB2, AB2b) | — | real Neon timing |
| Parallel | addition page writer prepared past design; Build provisioning overlap | — | yes (Build: a real dependency; addition prep: deferred) | — |
| Parallel | writes from different requests | — | out of scope | — |
| Publish | older code-plus-held save refused, re-run, held once, published once | yes (PPM3b, DMO1, DMA1) | — | live |
| Publish | `DRAFT_FIRST` into every job; observed probe | yes (DH1–DH5, PPM4a) | — | the `env` probe pressed |
| Publish | exact revision; later drafts kept out; duplicate clicks; recovery | yes (DF*, DFP*, PPM2, DV3) | — | live, and a real crash (not induced) |
| Publish | **the preview's head is the version it serves; an overtaken save never leaves its head or script on the draft** | **yes (DPH1–DPH4, DMO1, MR5)** | conditional preview upload (a moment of the older preview is possible; backlog) | the preview host after an image roll; two real saves racing |
| Publish | owner panels and the other immediate writes | stated (second batch §5) | redesign: owner's decision | — |
| Media | upload, sniffing, limits, ownership, Range/ETag | yes | — | — |
| Media | interrupted delete answers 404 and is finished | yes (MR1) | — | live |
| Media | **abandoned sessions/parts/drafts reclaimed fairly across every prefix, restartable, failed items revisited; nothing referenced removed** | **yes (MSF1–MSF7, MR2, MR2b, MR4)** | — | R2's own multipart and listing behaviour; a tick's subrequest count |
| Media | limits from the deploy to Worker and jobs | yes (MR3) | — | a deploy with a variable set |
| Media | replacement, removal, seeking, preview vs live, Publish | yes (PPM1, MR4, DFB6) | — | live |
| Media | `/u/` tied to the host; `If-Range` | — | yes (backlog) | — |
| Frontend | customer-facing narration of these states | — | deferred (owner) | — |
| Rollout | merge, SQL, switches, image roll | — | deferred (owner) | the image-free batch, first batch §7 |
