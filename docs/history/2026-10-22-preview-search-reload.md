# Preview follow-ups: text search and the reload (2026-10-22)

Two follow-ups to `docs/history/2026-10-22-audit-preview.md`, approved by the
owner, on `preview-search-reload` (from `audit-preview` `d324d2f37`).
Offline; nothing spent, nothing deployed.

## 1. `like` / `ilike` in the draft preview (`applyRowQuery`, `site-draft.mjs`)

- **Added** `like` and `ilike` with PostgREST + Postgres semantics over the
  merged rows: PostgREST turns every `*` into `%` first (so `\*` is `\%`, a
  literal percent); then LIKE: `%` any run, `_` exactly one character
  (code point), `\` escapes the next character, the whole value must match.
  `ilike` folds case per character on both sides (a character whose lower
  case is longer is kept as it is). Null never matches.
- **Refused (422)**: a pattern ending on a lone `\` (an error in Postgres);
  `like`/`ilike` on a column holding non-text values (Postgres: operator
  does not exist).
- **Full-text search stays refused.** The `fts` column is
  `to_tsvector('english', …)` (stemming, stop words, the parser's own
  tokens: hyphenated words, URLs) queried through `to_tsquery`. No word
  match here follows that without sometimes showing a row the database
  would not (a stop-word query matches nothing there) or hiding one it would
  (stems). So `_fts` on a touched table is still answered 422.
- **The kit's search UI** (`builder/lovable/template/src/lib/rows.ts`,
  `pgQuery`) emits `select`, `limit`, `offset`, `order`, `eq` filters, and
  `_fts=fts.<q>` for its `q` search. It never emits `or`, `like` or `ilike`.
  So the common search box on a touched table is still refused (above);
  `like`/`ilike` serve hand-written pages. `or` and `not.` stay refused.
- **Limit**: a NUMERIC column the Data API returns as text would be matched
  as text here, where Postgres refuses `like` on numeric.

## 2. The frame after a reload (server truth)

- **Chosen: the server's reading, not local memory.** `GET /api/site/<slug>/draft`
  now carries `previewServed`: true when readiness is `ready`, or when the
  confirmed-up record (`preview-up/<slug>.json`, `readPreviewUp`) names the
  draft's version or the version of one of its unpublished revisions
  (`previewServed(draft, up)` in `site-draft.mjs`). A discarded or
  published-over version, no record, or a failed read is false, and
  `unknown` readiness is never served.
- **The page** (`siteDraftFrame`, `public/chat.js`) treats
  `previewServed === true` (with readiness not `unknown`) like a ready
  reading seen earlier in the session, so a reloaded page keeps the frame on
  the draft host while a later change lands; otherwise it waits on the live
  site as before. The card thumbnail follows the same rule.

## Tests

- `test/draft-first.test.mjs` DFB14 (like/ilike through the real Worker:
  wildcards, case, escapes, whole-value, refusals incl. `_fts`, `or`,
  `not.`), DFB15 (the real `/draft` reading with no record, this draft's
  version up with a claim standing, another version up; a fresh page's
  `sitePreviewSrc` for each; `unknown` never served). DFB12's former `like`
  refusal case is replaced by a lone-backslash and a number-column case.
- **Red check**: DFB14 and DFB15 fail on `audit-preview`'s product files;
  DFB12 and DFB13 pass on both.
- **Sweep**: `scripts/mutants/preview-search-reload.json` over
  `test/draft-first.test.mjs`: 13 of 13 killed (8 for like/ilike, 5 for the
  reload), the comment-only control survived.
- **Related files** (`test/preview-*`, `test/draft-*`, `test/*held*`,
  `test/audit-batch-3`): 251 of 251.
- **Full suite** (with a temporary `node_modules` link): `11839 / 11835 / 1 / 3`;
  the one failure is `no-generated-deps`, caused by the link, which passes
  (2 of 2) with the link removed. (`media-verify`'s browser case, failing on
  the base branch this morning, passed this run.)
- **Screenshot** (headless Chromium, the real `styles.css`, bar text and
  frame address from the real `chat.js` functions):
  `/tmp/claude-0/-home-user-isibi-app/e771e2f3-3497-5a41-86e7-3125c5cae122/scratchpad/preview-reload.png`.
