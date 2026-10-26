# 2026-10-26 — Putting a site's data back to an earlier moment

Branch `restore-data` (from `origin/main` `8f29c37d3`). Not merged, not
deployed. **Not proven live**: shown only with a fake Neon and fake databases.
No model call and no Neon call was made.

## What the owner asked for

A customer asks in chat ("put my data back to how it was yesterday 6pm",
"undo what happened to my lessons this morning"); the real difference is shown
and explained before anything changes; a typed confirmation; a copy first; an
undo. History window: one day (Neon's default), chosen by the owner; no
project's retention is changed.

## What was built

- **Routing** (`builder/site-ask.mjs`): a new live intent `restore`, beside
  `security`, with `restoreWhen` (the moment in their own words) and
  `restoreUndo`. The clause says a single value change is `data`, and going
  back to an earlier *page* version is not this. Read as `{ intent: "restore",
  when, undo }`. Not a keyword rule: the router decides; code reads the time.
- **The moment** (`resolveRestoreTime`): read in the browser's time zone (the
  site stores no zone; the owner's browser is the best one there is). Clock
  times ("6pm", "9:30am", "18:00", noon, midnight) with yesterday / today /
  this morning, "N hours/minutes ago", or a date and time. No clock time ("this
  morning" alone) asks for one; older than 24 hours is refused ("I can only put
  your data back to a moment in the last 24 hours — that is how much history
  your site's database keeps."); the future is refused.
- **The difference** (`previewRestore`): a Neon point-in-time branch of the
  site's branch (`POST /projects/{id}/branches`, `parent_timestamp`;
  `createPastBranch` in `site-db.mjs`, the rehearsal pattern), every `public`
  table read on it and on the live database (primary key, up to 5,000 rows a
  table, said when cut), compared row by row: comes back, changes back (each
  field now → back), would be lost; `created_at`/`updated_at`-style columns give
  the times. The branch is deleted at once.
- **Private details**: columns named like email, phone, address, password,
  token, card… and values that look like an email or phone number are shown as
  "(hidden)" in the facts and the card. Item names are kept.
- **The explanation**: the reply writer (`writeReply`) from the difference's
  facts only, then `checkExplanation`: every number in the text must be in the
  facts; every quoted phrase and every capitalised word that does not start a
  sentence must be in the facts; no email or phone. A failure shows the plain
  list (`plainExplanation`), and `bad` says why.
- **The card** (`public/chat.js`, `siteRestoreHTML`): the explanation, "Comes
  back", "Will be lost" (from the difference, never from the model's text),
  "A copy of your data as it is now is saved first, so this can be undone.",
  "Type restore to confirm", Restore (off until the word is typed), Cancel.
- **The restore** (`confirmRestore`, `POST /api/site/<slug>/data-restore`
  `step: "confirm"`): refused on the server unless the typed word is
  "restore", and the window is checked again. The past is read first (a digest
  of every table), then **Neon's own restore of the site's branch to its own
  history** (`POST /projects/{id}/branches/{branch}/restore` with
  `source_branch_id` = itself, `source_timestamp`, and `preserve_under_name` =
  `before-restore-<time>`). Then the copy is looked for in the branch list, and
  the restored tables are compared with the past's digest. The reply says when
  the copy was not found or the check could not be made, and never claims an
  undo it cannot give.
- **Undo** (`undoRestore`, `step: "undo"`, typed "undo"): the newest
  `before-restore-` branch restored onto the site's branch, and the state it
  replaces is kept too, as `before-undo-<time>`.

## Why Neon's restore with `preserve_under_name` (the choice)

Two ways were possible: copy rows from the past branch into the live database,
or Neon's branch restore. **Branch restore was chosen.** It is one operation in
Neon, it covers everything in the database (rows, sequences, schema, every
table, including ones our reader would skip), and with `preserve_under_name`
Neon keeps the replaced state as a branch **in the same operation**: there is no
moment in which the data has been put back and its copy does not exist, which
a separate "copy first, then restore" could not promise (a failure between the
two). Copying rows would need a write per row under RLS and triggers, could
stop half done, and would not restore sequences or schema. `restoreBranch`
refuses to send a restore without `preserve_under_name`, and the guard test
reads that line. The compute stays with the site's branch, so its connection
string does not change.

**What this cannot do**: the restore moves the whole branch. A project whose
branch holds another database than the site's is refused (`lockSite`,
`shared-project`), so another site's data is never moved. A Neon plan that
keeps less history than 24 hours answers a 4xx, said as "Your site's database
no longer keeps that far back…".

## The site lock

The route asserts the owner (`assertOwner`); the project is the site's own row
(`siteNeonProject`), whose `uid` must be the caller's; every Neon call names
that project and branch; the past branch is read with the site's own database
and role. Refused before any Neon call: no project, another owner. Refused
after one read: a branch holding another database.

## Charges

The difference is free. The explanation is one reply-writer call, charged by
its usage (`collectCredits(pageCredits(...usage))`), like a model-written
reply; the answer says `charged`. The restore and the undo make no model call
and are free.

## Tests

`test/data-restore.test.mjs`, 15 cases, fake Neon and fake databases: the
moment (zones, window, future, ask); the difference (comes back, changes back
with before/after, lost, times; unchanged tables left out); private details
hidden; the check (numbers, quoted and capitalised names, email); preview (model
text kept, invented number falls back, diff branch deleted, no restore call);
window refusal before any Neon call; the site lock (another owner, shared
project, no project); confirmation required on the server (empty, "yes",
"restor", missing); the restore (one call, on the site's project and branch,
with `before-restore-` preserved and the timestamp; data verified; diff branch
gone); a copy Neon did not keep is said, never claimed; a failed restore says
nothing changed; undo (typed "undo", the copy put back, its own copy kept, no
copy → "no-copy"); the wiring (router field, `restoreBranch`'s refusal, the
route, the card's text and disabled button).

- **Red check**: on `origin/main` the module does not exist, so every case
  fails to load.
- **Sweep**: 20 mutants, 20 killed (the typed-word check, both window checks,
  the future check, the owner lock, the shared-project lock, the explanation
  check, the number, email and name checks, the preserved name, the copy
  lookup, the diff branch's delete, lost and comes-back rows, hiding, yesterday,
  the copy filter in undo, `restoreBranch`'s refusal, the router's enum); the
  comment-only control survived. The first sweep left the copy lookup alive; the
  "copy Neon did not keep" case was added and kills it.
- **Screenshots** (headless, the real `siteRestoreHTML`, `styles.css` and input
  listener; the explanation text in them is a sample, not a model's):
  before typing (Restore off) and after typing "restore" (on).

- **Full unit suite** (locally, before the commit): `12908 / 12903 / 2 / 3`.
  The two failures came from the local setup, not from the code: the image-inputs
  test needs the new file committed (`builder/data-restore.mjs` is now a
  container input, added to the Dockerfile's COPY, **so the image rolls**), and
  the node_modules-ignore test fails while a `node_modules` symlink is linked
  in. Both pass after the commit and with the link removed. An earlier run
  failed on a guard counting `modelsFor(body.picker)`, on Effort missing from
  the request, on the `/model3d` dispatch anchor and on the slash-menu harness
  having no `document.addEventListener`. All four are fixed.

## Not done / open

- Not proven live: no Neon point-in-time branch or restore has been run.
- The explanation's model call is not proven live either.
- A row-free change (a table added or dropped) is named as a whole list coming
  back or lost; the schema itself is not described.
