# 2026-10-26 — Deleting a site names what is lost and asks for its name

Branch `delete-confirm` (from `origin/main` `8f29c37d3`). Not merged, not
deployed. Offline only: no paid call, no live press.

## The owner's request

The ✕ on a site card shows a confirmation that names what is lost, e.g. "This
deletes Saltmarsh, its database with 42 orders, and 3 pages. Type the site name
to confirm.", and Delete stays disabled until the typed text is the site's
name (case-insensitive, trimmed). The server refuses a DELETE without the
confirmation.

## What changed

- **`GET /api/site/<slug>/delete-preview`** (`worker.js`, `deletePreviewFor`):
  owner-checked like the DELETE (401 signed out, 403 another account's, 404 no
  row, 503 when the row cannot be read, never "no such site"); reads only.
  Answers `{ ok, slug, name, pages, database, tables }`: `name` is the row's
  `display_name` (the slug when absent or when the column is missing, read again
  without it on a 400); `pages` from the stored source (null when unreadable);
  `database` true / false / null (could not tell); `tables` each table's row
  count, at most 24 (`countSiteRows`, the schema through `specForAddon`), null
  for one table whose count failed and null for the whole when none could be
  read. Never a 0 that was not counted.
- **`DELETE /api/site/<slug>`** now needs a JSON body `confirm` equal to the slug
  or the site's name (case-insensitive, trimmed). Missing, empty, not a string
  or wrong: 400, before anything is looked up or torn down. The account-deletion
  sweep (`POST /api/site/delete-all`) still calls `deleteSiteFor` directly,
  with no confirmation; `deleteSiteFor` itself is unchanged.
- **`public/delete-confirm.js`** (new; runs in the browser and under
  `node --test`): the sentence (tables in plain English, "order_items" → "order
  items", singular for one; no database: "This deletes X and its N pages.";
  unreadable: "its database (couldn't count its entries)"; partly unreadable:
  "(couldn't count the rest)"; could not tell: "its database, if it has one
  (couldn't check)"), the name check, and the dialog in the existing
  `go-confirm` look, with one text box. Cancel, Escape and a click outside
  close it.
- **`public/chat.js`**: the card's ✕ reads the preview (an unanswered preview
  becomes the "couldn't check" sentence), shows the dialog, and sends the same
  DELETE with `{ confirm: slug }` added. Everything after the DELETE is
  unchanged.
- **`public/styles.css`**: two rules only, the text box and the disabled
  Delete (`.go-confirm-input`, `.go-confirm-yes:disabled`). Nothing else
  restyled. `public/index.html` loads the new file before `chat.js`.
- **`.github/scripts/sweep-orphan-site.mjs`** sends `{ confirm: slug }` on its
  DELETE, or the operator's orphan sweep would now be refused.

## Tests

`test/delete-confirm.test.mjs`, 11 cases: the preview owner-checked through the
real route (401/403/404/503) and read-only (no non-GET call); counts; the
unreadable cases (count throws, schema unreadable, connection unreadable, no
database); the DELETE refused 400 for eight missing or bad bodies and a wrong
name, with no store read; slug and name in any case reach `deleteSiteFor`
(observed by its own lookup); the account sweep reaches `deleteSiteFor` with no
confirm; the client, the orphan script and the script order; the sentences; the
name check; and the dialog in headless Chromium (Delete disabled before typing
and on a partial name, a forced click on it does nothing, lit on the name in
upper case with spaces, Delete answers true, Escape and Cancel false).

- **Red check** (the test over `origin/main`'s code): 6 of 11 fail; the 5 that
  pass are the new module's own cases and the two regression controls (the
  sweep and confirm-reaches-delete).
- **Sweep**: 18 mutants, all killed but one equivalent: removing the
  `if (!yes.disabled)` guard in the Delete click survives because a browser
  dispatches no click to a disabled button (kept as belt and braces). The
  comment-only control survived. One mutant (case-sensitive server name check)
  survived the first run; the test was strengthened to observe that
  `deleteSiteFor` is reached, and it is killed now.
- **Full suite** (local, before the re-anchors): `12904 / 12895 / 6 / 3`. Four
  were older guards this change moved, now re-anchored and green: `site-ask`'s
  "own dialog" guard (now reads `DeleteConfirm.ask` and the new file),
  `site-list`'s card-hop window (new end landmark), `request-flow`'s E4b (its
  DELETE now sends `{ confirm: slug }`), and `site-busy`'s bare-reader census
  (17 → 18, `readSiteSource` 9 → 10: the preview's page count, read-only, named).
  The other two were not this change: `no-generated-deps` failed only because of
  the `node_modules` symlink linked into this worktree (green with it removed),
  and `canary-reopen-browser`'s REOPEN 1 passed when run again. Those six files
  re-run together: 0 failed. The full suite was not run a second time.

## Screenshots

Headless renders of the dialog (with a database, without one, counts
unreadable) were sent with the report; they are not committed.
