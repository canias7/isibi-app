# Audit batch 3 (2026-10-22)

Audit findings 21–24 from `docs/audits/2026-10-17-builder-audit.md`, on the owner's word "double check this but do fix 21,22,23,24". Each was first checked again against the current code (`3fda8174d`, on `codex-work-into-claude`). Branch `claude/audit-batch-3`, one commit each. Offline; nothing spent; not merged, pushed to `main` or deployed. Tests: `test/audit-batch-3.test.mjs` (B3-1 … B3-8).

## 21 — A10-1: pre-site video and audio never reached the new site (already fixed, nothing changed)

- **Checked again.** Batch 1's fix #9 (`ownAccountKey`, `builder/job-gateway.mjs`) lets a job list and read `drafts/<its uid>/` (also before it has a name), remove a moved draft once it holds a site, and read and write only its own site's `media-ledger/site-<slug>.json`. The gateway's read, write, delete and list doors all ask it. The whole-file buffering the audit also named (S1-4) is fixed as well: a file of known length is streamed (JGD-S).
- **Evidence.** `test/job-gateway-draft.test.mjs` JGD-M (a first build reads and moves the account's pre-site files through the real gateway handler, pre-scoped then named; never writes a draft, never reads another account's; a pre-scoped job never touches a ledger), JGD-L (ledger writes limited to its own hold or release), JGD-S: 9 of 9 pass on this commit. `test/audit-batch-1.test.mjs` 9 of 9.
- **Left as is** (as batch 1 recorded): the browser forgets its pending list after a build that named a file it could not move. The "could not be read just now" wording now only covers real read failures, since the gateway no longer refuses the read.

## 22 — A10-2: a held replacement's new version was an ordinary library file (`f55149475`)

- **Checked again: real.** `siteMediaFiles` listed the stand-in and files held for removal to the Edit and Add-on writers. The Files panel drew Use in chat, Replace and delete on the stand-in's row. The preview followed `media-replace` by name only, so it disagreed with Publish for chained or repeated replacements. For example, [A←B, A←C] played take 2 in the preview, while Publish put take 3 live.
- **Fix.**
  - `heldMediaSource(ops, file)` (`site-draft.mjs`) follows the held library ops in order, exactly as `applyHeldMedia` applies them. The preview's `/u/` serves the result, so the preview and the live site agree.
  - `siteMediaFiles` leaves out whatever Publish takes off (stand-ins and held removals).
  - The media route refuses Replace (on start) and Delete of a stand-in: 409 `stand_in`, naming the file it replaces. A draft that cannot be read answers 503, never "not a stand-in".
  - `public/chat.js`: a stand-in row has no Use in chat, Replace or delete button.
- **Tests.** B3-6 (the ops, unit), B3-7 (the real media routes: refusals, a second replacement played in the preview and live after Publish, the stand-ins gone), B3-8 (wiring: the writers' list, the preview, the panel row).
- **Red check.** With `worker.js` and `public/chat.js` at the previous commit, B3-7 and B3-8 fail (6 pass, 2 fail).
- **Left.** Publish does not search the draft pages for a stand-in address typed in by hand. The panel change was not screenshotted: it only removes three buttons from the stand-in's row.

## 23 — A11-2: Publish and restore undid the owner's panel changes (`528c33cfc`)

- **Checked again: real.** `runPublication` and `restoreVersion` handed activation the version's staged sidecar unchanged, apart from the address on a held rename.
- **Fix.** `carryPanelFields(version, live, prior)` (`site-meta.mjs`), through `withPanelFields` in `worker.js`:
  - the verification pairs are always taken from the live sidecar (only the verification panel writes them, and a restore promised to keep them);
  - the share picture and the description are taken from the live sidecar when it differs from the staged sidecar of the version that was live (`j.from` at Publish, the pointer's version at restore). That difference means a panel set them after that version went live. Otherwise the version's own value stands, so a description an edit saved in the draft still goes live;
  - routes, redirects and the address are always the version's;
  - any text that cannot be read carries nothing.
- **Tests.** B3-4 (the rule, including the edit's description and the unreadable cases), B3-5 (wiring at Publish and restore).
- **Red check.** With `worker.js` at the previous commit, B3-5 fails (4 pass, 1 fail).
- **Not driven** through the real Publish route with a panel change in between. A head change on Back online (A33-5) and the stale per-isolate head (A11-4) are separate findings.

## 24 — A11-3: a page rename's redirect was lost by a later draft save (`f85b2d786`)

- **Checked again: real.** `composePublish` diffed against the live `sitemeta/<slug>.json`.
- **Fix.** `previousSidecar(deps, slug, { draftFirst, liveKey })` (`site-draft.mjs`):
  - under draft-first with a standing draft, it reads that draft version's staged sidecar (`builds/<slug>/<version>/state/sidecar.json`);
  - when that sidecar is absent or held, or draft-first is off, it reads the live key;
  - an unreadable draft record throws, which suppresses the manifest (the existing "never read as no history" rule).
- **Tests.** B3-1 (the next save keeps `/about → /our-story`; the control shows the live read sending it home), B3-2 (the fallbacks and the throw), B3-3 (wiring).
- **Red check.** With `worker.js` at the previous commit, B3-3 fails.
- **Spelling guards re-anchored to the new read**, with their properties unchanged: `test/site-seo.test.mjs` "composePublish derives the manifest…" and `test/site-meta-sidecar.test.mjs` "the publish WRITES it and reads the previous one…".

## Readings

- Targeted runs after each step: `test/audit-batch-3.test.mjs` 8 of 8, and the publish, draft, restore, sidecar, verify, SEO and media files, all green except `test/media-verify.test.mjs`'s browser mode. That case fails the same way on the code before this batch (it needs this machine's Chromium media codecs), so it is not this batch's.
- No mutation sweep was run in this batch: the owner asked for the fixes with red tests.
- Full suite: see the owner-notes entry for the numbers, stamped after the run.
