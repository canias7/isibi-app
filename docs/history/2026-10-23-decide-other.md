# 2026-10-23 — The owner's choices on items 31, 32, 33 (branch `decide-g-other`)

From `origin/main` `a8fbfe876`. Not merged, not deployed; nothing paid, no model
calls, no live writes. Finding numbers are rows of the audit's "Every kept
finding" table (`docs/audits/2026-10-17-builder-audit.md`).

| Item | Finding | Choice | State |
|---|---|---|---|
| 31 | #196, A32-3 | translated pages become editable | done |
| 32 | #138, A15-6 | builds and chats on different sites at the same time | done |
| 33 | #124, A12-9 | missed-notification counter | done; SQL proposed, not applied |

## 31 — translated pages are editable (#196)

- **New module** `builder/lang-override.mjs`. An edit aimed at a translated page is
  stored in the site config as `langOverrides[tag][<primary string>] = { said, was, at, stale? }`
  — keyed by the main-language string it was made from, so the source is recorded.
- **Spine** (`recompileAndPublish`): overrides are laid over the translation cache
  in `filesFor` on every publish and never written into the cache, so a
  re-translation (including a cache started over) cannot undo them. An override
  whose source string is no longer on the site is **kept, not applied, flagged
  `stale: true`** (written back only when a flag changes) and the reply's
  `renderNote` says: "Your own es wording for “…” was kept, but the original
  wording it was made from has changed — check the es pages." A source that
  comes back clears the flag.
- **Edit** (text rung): reached when the router names a page under a language
  prefix (`/es/...`), or when the primary wording matched nothing and the request
  quotes a language's current wording. The text step runs on the translated pages
  as served now; each change is read back to its primary string, stored, and the
  site republished. Reply note: "Changed the es wording to “…”. It is kept as your
  own es wording, so later translations won't replace it." (carried past the
  deferred publish as `langNote`).
- `site-config.mjs`: `langOverrides` is a config field (no legacy `_meta` name, not
  baked into a version's state — like `share`).
- **Not done**: the router's page list was not widened with `/es/...` routes, so a
  page-named trigger relies on the router naming one; the quoted-wording fallback
  covers the common case. `Dockerfile` now copies the new module into the worker
  tree: **the container image's inputs change** (predict before any deploy).

## 32 — one site building no longer blocks the others (#138)

- **Server checked (`worker.js`, Supabase claims)**: no cross-site block. One job per
  site (`private.site_busy` in the claim) and the per-account limit of 3 live talk
  streams stay as they were.
- **Browser (`public/chat.js`)**: the block was page-wide `siteBusy`/`siteBuild`/`siteAbort`.
  Now one busy state per project: the globals are the open project's; other
  projects' work waits in `siteSlots` and is swapped in by `openProject`
  (`siteSlotSwap`). Every setter is `siteBusyBegin(<project>)`, every finish
  `siteBusyEnd(origin)` / `siteBuildStop(origin)`, so a finish never ends another
  project's work; each send's Stop controller is kept per project (`siteAborts`);
  owed builds found on load wait only for their own project. The refusal
  "Another project is still building — send this once it has finished." is
  removed. A project's own Send is still refused while it is busy.
- Harnesses carry the block via `test/fixtures/busy-slots.mjs`. Two build-reconnect
  cases (RB 6, RB 7) encoded the old one-at-a-time rule and were re-anchored to
  side by side.

## 33 — missed-notification counter (#124)

- **Proposed SQL** `supabase/proposed/notify_missed.sql` (NOT applied): column
  `site_backends.notify_missed integer not null default 0`, and two
  service-role functions `site_notify_missed_add(slug, n)` (counts only when
  notifications are on) and `site_notify_missed_take(slug)` (read and zero).
- `site-notify.mjs`: a lost claim (inside the cooldown), a failed claim, no sender,
  no address, a failed lookup or a failed send counts 1 (plus whatever the winner
  had taken); the winner takes the count and the email says "You missed N
  notification(s) since the last email." (replaces the never-reached "…and N more").
- `worker.js` `notifyMissed`: both RPCs **fail open** — absent column or function,
  404, network error: take reads 0, add does nothing, the email goes as before.

## Tests

- New: `test/notify-missed.test.mjs` (11), `test/site-busy-per-project.test.mjs` (6),
  `test/lang-override.test.mjs` (6), five `#196` driven cases in `test/edit-path.test.mjs`.
- **Red on old code**: notify-missed + per-project 15 of 17 fail (the 2 that pass are
  controls); `#196` 4 of 5 fail (the control passes).
- **Sweep**: 13 mutants, 13 killed; 3 comment-only controls survived. Restored from
  saved copies, never git.
- **Full suite** (local, before the last fixes): `12183 / 12173 / 7 fail / 3 skipped`;
  of the 7, four were fixed (Dockerfile copy, a lane window, a render-note regex, a
  scoping checker), one is the node_modules link made for the run, two are flaky or
  environment cases (`PAGE 1`, the browser media mode) that fail the same way off this
  change. The affected files were re-run green afterwards; the image-inputs case
  passes once the new module is committed.

## Screenshots

`scratchpad/shots-other/33-email-missed.png`, `31-translated-edit-notes.png`. No new
string for item 32 (one removed).
