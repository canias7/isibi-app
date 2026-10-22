# Audit: the preview (A07-2, A07-3, A07-5) (2026-10-22)

Three preview findings from `docs/audits/2026-10-17-builder-audit.md`, each
re-checked against `codex-work-into-claude` (`a6564cf80`) before fixing, one
commit each on `audit-preview`. Offline; nothing spent, nothing deployed.

## A07-2 — after a stuck episode a good save never made the preview ready (`567eab4b9`)

- **Real.** `previewReadiness` (`site-draft.mjs`) is ready only with no claim
  standing, and returns `failed` on a `stuck` register otherwise. A stuck
  episode leaves every claim it read; a later save that confirms its version
  removes only its own claim, so the old ones kept readiness `failed`. The
  tick never cleared them: `repairPreview` (`worker.js`) answers `stuck`
  unless a claim newer than the register stands, and a good save's claim is
  gone within seconds.
- **Fix** (`saveAsDraft`, `site-draft.mjs`). After its version is confirmed
  and recorded (`markPreviewUp`) and its own claim is gone, the save drops
  the other claims older than `PREVIEW_LAND_MS`. By the claims' own rule they
  can no longer put a script up. A claim that may still land is kept, and
  the save is still not ready over it. With no claim left, a `stuck`
  register is reset to `ready` on this version, over the etag it read
  (`unstick`). The register is only bookkeeping: readiness already reads
  ready once the claims are gone.
- **Test.** `test/preview-recovery.test.mjs` PR19 sets up 13 stale claims and
  a stuck register, then runs a good save. The save is ready, no claim is
  left, the register is `ready` on the version, and `previewReadiness` reads
  `ready`. The control is a fresh claim: the next save is not ready, and the
  fresh claim is kept.
- **Red check.** PR19 fails on the old `site-draft.mjs` with "another upload
  of the preview may still land".

## A07-3 — preview lists ignored the page's query (`863c661a7`)

- **Real.** `servePreview` sent the page's own query (filters, `order`,
  `limit`, `offset`, `id=eq.N`) to the live data service, then appended every
  held new row with `rowsOverlay`, which knows nothing of the query. A
  filtered list showed rows that do not match, a limited list grew past its
  limit, and a live row's detail read (`useRow`, `r[0]`) could answer the
  held row.
- **Fix.** For a table the draft touches, the Worker now asks the live service
  for the whole table (`?select=*`). It overlays the held changes and then
  answers the page's query itself, with the new `applyRowQuery`
  (`site-draft.mjs`):
  - filters: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `is`;
  - `order` (several columns, `nullsfirst` and `nullslast`), then `offset`
    and `limit`;
  - a held new row (negative id) sorts as newer than every live row, as it
    will be once published;
  - anything else is answered **422** "the preview can't show this list with
    the draft's changes yet", never with a row that may not match: full-text
    search (`_fts`), `or`, a column list, or an unknown operator.

  A table the draft does not touch is passed through as before.
- **Test.** `test/draft-first.test.mjs` DFB12, through the real Worker. The
  live service is asked only `?select=*`. It covers:
  - a filtered list, newest first;
  - a limited list;
  - an offset;
  - a live row's detail;
  - a removed row's detail (empty);
  - an `in` list;
  - `_fts` refused with 422.
- **Red check.** DFB12 fails on the old `worker.js` (the live service was
  asked the page's query).
- **Limits.** A NUMERIC column that the Data API returns as text compares as
  text (`"5.20"` is not `eq.5.2`). Full-text search on a touched table is
  refused rather than shown. The whole table is read for a touched table,
  bounded by the data service's own row limit.

## A07-5 — the frame showed "Not found" before the first preview existed (`8c4e84e43`)

- **Real.** A held-only revision on a site with no draft (a first price edit
  under draft-first) creates a draft record with a new preview host and
  uploads nothing. `siteDraftFrame` (`public/chat.js`) moved the frame to
  that host whenever the draft was ahead, without looking at readiness. With
  no script, production's dispatch call throws and `servePreview` answers 404
  "Not found". The shared test stand-in (`test/fixtures/request-flow.mjs`)
  answers 200 for any script name, which hid this.
- **Fix** (`public/chat.js`). The frame moves to a draft host only once the
  server has read that host's preview `ready` at least once. The page
  remembers this for the session, per host. Until then the frame stays on the
  live site, and the bar says "Live site · preparing your preview…", or
  "Live site · couldn't prepare your preview yet" when the tick has given up.
  - After the preview has been ready once, a later change keeps the frame on
    the draft host while it updates, because the host then serves the
    earlier draft.
  - A new host (a new token after a discard) waits again.
  - The card thumbnail follows the same rule.
  - The page already follows readiness on its backoff, and `siteDraftFrameKey`
    changes when the preview turns ready, so the frame moves by itself.
- **Test.** `test/draft-first.test.mjs` DFB13 uses its own dispatch stand-in,
  which throws "Worker not found" for a script never uploaded, as
  production's namespace does. With it:
  - the draft host answers 404;
  - the real `GET /draft` reads the preview not ready;
  - the page's own `sitePreviewSrc` keeps the live address, and
    `siteDraftWaiting` reports the waiting draft;
  - the bar's words are checked;
  - once read ready, the frame moves to the draft host, and stays there for
    a later pending revision;
  - a new host waits again.
- **Red check.** DFB13 fails on the old `chat.js` ("the frame moved to a draft
  host whose preview is not ready").
- **Not changed.** The shared stand-in still answers every name, because
  changing it reaches every request-flow test (backlog). `sealHeld` still
  puts no preview up: the owner's read starts the repair, as before.
- **Not persisted.** After a page reload with a pending revision, the frame
  shows the live site with the note until the next ready reading.
- **Screenshots** (headless Chromium, the real `styles.css` and the bar text
  computed by the real `chat.js` code), in the session scratchpad:
  `preview-before-fix-first-change.png` (old: the draft host, "Not found"),
  `preview-after-fix-preparing.png`, `preview-after-fix-failed.png`,
  `preview-after-fix-ready.png`.

## Checks

- Related files: `test/preview-*.test.mjs`, `test/draft-*.test.mjs`,
  `test/*held*.test.mjs`, `test/audit-batch-3.test.mjs`,
  `test/media-reliable.test.mjs` and `test/parallel-publish-media.test.mjs`,
  211 of 211 green after the last commit.
- **Full suite** (after the three fix commits, before DFB12's four extra
  refusal cases): `11836 / 11829 / 4 / 3`. The 4 failures are two cases
  plus their parents:
  - `media-verify`'s browser mode also fails with the base branch's
    `site-draft.mjs`, `worker.js` and `chat.js` checked back in, so it was
    failing before this work;
  - `no-generated-deps` fails only because of the temporary `node_modules`
    link, and passes with it removed.
- **Sweep.** `scripts/mutants/audit-preview.json` over
  `test/preview-recovery.test.mjs` and `test/draft-first.test.mjs`: 11 of 11
  killed, and the comment-only control survived. M8 (an unknown parameter
  answered) survived the first run. DFB12 then gained four refusal cases
  (`or`, a bad column name, a column list, `like`), and M8 was killed.
