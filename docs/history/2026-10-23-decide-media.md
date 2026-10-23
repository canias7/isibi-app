# 2026-10-23 — the owner's choices for audit findings 20–25 (branch `decide-g-media`)

Five findings from `docs/audits/2026-10-17-builder-audit.md` that rounds 1 and
2 left for the owner (`2026-10-23-r1-g3.md`, `…-r1-g6.md`). Offline only:
nothing paid, no model calls, no live writes. Not merged, not deployed. #21 was
"keep as is": nothing changed.

| Item | # | ID | The owner's choice | What changed |
|---|---|---|---|---|
| 20 | 115 | A10-4 | video/audio attached before the site exists is moved into the site's library before the edit is sent | New owner route `POST /api/site/<slug>/media/adopt` (the build's `adoptDraftMedia`, caller's own drafts only, owner-gated, answers `placed` with `file` and `missing` with why). `SiteMedia.adopt` in `public/site-media.js`; `siteSend` in `public/chat.js` moves draft chips first when the message will be an edit, then sends it with the library address. A failed move sends nothing and says why. |
| 22 | 162 | A25-1 | an attached photo is stored and offered first as the picture | Picture parts' jobs carry the request's images (`builder/request.mjs` `jobBody`; `public/chat.js` edit body), as logo parts do. The picture rung stores each attached image as an owner upload (`storeAttachedPhotos`, `storeOwnPhoto`) and lists it first (`attachedFirst`); `pictureDigest` marks it "ATTACHED TO THIS MESSAGE". |
| 23 | 168 | A26-4 | logo attached to the first build: header, and the reply says to send it as a logo change | Design tool field `logo` (an attachment id). The build stores it and sets `look.wordmark = {form:"image", url}` (`placeAttachedLogo`). The reply says "Your logo … is in the header", or, when it could not be placed, to send it again now as a logo change (`ownLogoSentence`, in `contextNote`). |
| 24 | 173 | A27-7 | a menu change about one page applies only there (per-page option) | Menu tool field `menuPages`; `readMenuScope`; `runNavEdit` reads the answer against those pages' menus and applies it only to them. A page the site lacks, or scoped pages with no menu, refuse by name, never widened. Tool and system wording no longer say "the same menu on every page". |
| 25 | 189 | A31-1 | "forget the old address" refuses while the site's own QR codes open it, naming them | `qrCodesOnHost`, `qrForgetRefusal` (`builder/site-qr-list.mjs`); the rename lane reads the look before both the held and the immediate forget, refuses with the codes named (`qrBlocked`), and an unreadable look refuses too. |

## Limits, said plainly

- 23: the header pickup relies on the design step naming the attachment as the
  logo; when it does not, nothing is said (no keyword rule detects "logo").
- 22: every attached image on a picture part is stored as an owner upload,
  whether or not the picture step places it.
- 24: the router's or picker's page is not passed to the menu step; the scope
  comes from the menu step's own answer.
- 20: the composer only moves drafts for a site that has pages; a draft that
  could not be moved stays in the strip and the message is not sent.

## Tests, sweep, screenshots

Measured after the runs:

- **Red check** (product files swapped back to `origin/main`, then restored
  from saved copies): 13 of the new cases fail; the controls (an unscoped menu
  change, a forget with no matching code, the pure QR helpers) pass.
- **Sweep**: 13 of 13 mutants killed; the comment-only control survived.
- **Affected files**: 13 files, `415 / 415 / 0`.
- **Full suite** before two guard updates: 12,171 tests, 17 subtests failing
  in 4 files. Two were guards this change moved: `site-logo` (the client now
  sends files on picture parts as well as logo parts) and `site-entry-inventory`
  (the composer has a third send, the same words sent again after the move).
  Both updated. The other two, `media-verify` (browser mode B2) and
  `no-generated-deps` (node_modules ignore), fail the same way with `main`'s
  files, so they are environmental here and not caused by this change. Guard tests: `test/decide-media.test.mjs`, and two route cases in
`test/site-public-url.test.mjs`. Screenshots of the new customer-facing strings:
the session scratchpad's `shots-media/`.
