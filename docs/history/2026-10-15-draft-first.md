# Draft-first publishing (2026-10-15)

**The owner's requirement (2026-10-15):** "Only an explicit click on the
Publish button may make changes live. Apply this universally across Build,
Edit and Add-on, including parallel tasks. Tasks should save their results
into a persistent draft and update its preview. Completing a task, answering
a question, recovering a job, or finishing a chain must never automatically
publish. Publish must release the specific ready draft version the user
approved. Tasks still running or edits made afterward must not slip into
that publication; they belong to a later draft. Show clearly whether changes
are saved, still processing, or published."

Branch only. Nothing merged, deployed, built or switched. `DRAFT_FIRST`
is a new switch, and it is **off** everywhere until the owner turns it on.

## 1. The audit: everything that changes a live site, as the code stood

There was **no Publish step at all.** Every task that finished called
`activateBuild` (`site-builds.mjs`) and was live from that moment. No route
named publish or go-live existed. `site-live.mjs` records that the old
`/api/site/publish` and `/api/site/preview` were deleted.

The live site is made of:

- the R2 pointer `current/<slug>.json`;
- the dispatch script `site-<slug>`;
- the live marker `sites/<slug>/site.live`;
- the sidecar `sitemeta/<slug>.json`, read by the script for its head;
- legacy files under `sites/<slug>/`;
- the site's own Neon database, scheduled functions, domains, secrets and
  uploads.

| Path (worker.js unless named) | What it changes live | Trigger | Automatic before this change |
|---|---|---|---|
| `buildAndPublishPages` → `activateBuild` | pointer, sidecar, marker, script | build completion; queue consumer; resumed-build collector | yes |
| `recompileAndPublish` → `activateBuild` (via `publishSpine`/`publishBeside`) | pointer, sidecar, marker, script | edit job completion: sync, queued (`runQueuedSiteEdit`), takeover, request driver/chain (`runRequestPrep` → `replayPrepared`); add-on completion (`/addon`); text route (`/text`); platform rebuild (`/rebuild`, replay only); put-back-online source fallback | yes |
| `restoreVersion` → `activateBuild` | pointer, sidecar, marker, script, editable copy | owner: Versions → restore; put-back-online | no (explicit) |
| `retryLostUpload` → `putSiteWorker` | live script | review-reconcile sweep (cron), refund reconcile, `/api/site/reconcile` | yes |
| `followPointer` / `alignLiveScript` / `runScriptPendingSweep` | live script → the **pointer's** version | takeover repair, 2-minute cron | yes, but only to the already-published version |
| `dropSiteWorker` | removes the script | delete, take offline, legacy restore | no (explicit) |
| sidecar patches | `origin`, verify tokens, share card, SEO | the `rename` edit layer (inside `/edit`, automatic); `/verify`, `/share`, `/seo` panels (explicit) | rename: yes |
| social card | `config/<slug>.json`'s `share` read at request time | any config write | yes |
| Neon: `ensureSiteBackend`, `applySiteSchema`, `persistSiteJobs` | schema, grants, scheduled functions | build, add-on, `rules` edit layer | yes |
| Neon rows | data | `data` edit layer; Data panel; imports | data layer: yes |
| `_errors` table | created on the fly | error logging | yes |
| Data panel, members, secrets, jobs, domains, uploads, notify, backups | each its own | owner panels | no (explicit) |

## 2. What is implemented (`DRAFT_FIRST=on`)

- **`site-draft.mjs`**: the draft record `drafts/<slug>.json` holds:
  - the latest saved version;
  - every earlier saved draft, each still publishable by name;
  - a stable 12-hex preview token.

  It is written conditionally on the record as read. A save that meets a
  newer draft goes into its history and never replaces the newer one.
  `draftState` reports `processing`, `saved` or `published`.
- **One gate at the activation.** `activateBuild` takes `asDraft`. The edit
  and add-on publication (`recompileAndPublish`) and the build
  (`buildAndPublishPages`) pass `saveAsDraft` when the switch is on, and then
  nothing live moves: no pointer, sidecar, marker or live script. The steps
  run in this order:
  1. the draft record;
  2. the editable copy and head marker (skipped when a newer draft already
     stands);
  3. the preview script, uploaded under its own name `draft-<slug>`;
  4. the job's commit.

  Every path in the table that reached `activateBuild` automatically
  reaches it through these two call sites, so they are all gated. That
  covers sync, queued, takeover, replayed and chained jobs, add-ons, text,
  rebuild and builds. DF6 is a source guard holding that only the owner's
  Publish and Versions restore activate without the gate.
- **Publish.** `POST /api/site/<slug>/publish {version}`
  (`publishDraft`) runs only for the owner, and only for a version the draft
  record holds (the draft or an earlier saved draft). It checks that the
  staged build is complete. It then activates exactly that staged build
  through the same conditional activation, with the script following the
  pointer. It does not touch the editable copy, which may already hold a
  newer draft. `GET /api/site/<slug>/draft` reports:
  - the state;
  - the live and draft versions;
  - how many jobs are running;
  - the preview address;
  - every saved version.
- **Preview.** `<slug>--draft-<token>.gofarther.app` dispatches to
  `draft-<slug>` with `x-site-preview: 1`, and only with the token the
  record holds. It answers `no-store` and `noindex`. The site template's
  live-marker probe is skipped only with that header, so a first build's
  draft renders before the site is live. The platform strips the header
  from every request it forwards to a live script.
- **No automatic path publishes.**
  - The lost-upload reconcile refuses under the switch (`kind: draft-first`).
  - The takeover repair (`ensureEditableState`) matches the editable copy to
    the **draft's** version, never the live one, so it cannot erase
    unpublished work. Its script alignment still uses the live pointer.
  - The cron sweep and alignment only ever restore the published version.
- **What the owner sees.**
  - `checks` carries `draft: true` with `published: false`, and its
    sentence (`DRAFT_SAID`) says the change is saved as a draft and the live
    site is unchanged until Publish.
  - A chip beside Publish reads "Saved · not published", "Still
    processing…" or "Published".
  - The Publish panel shows the draft preview link and the live address,
    and has one button, "Publish this draft". It publishes the version the
    panel was opened with, so a draft saved while the panel is open is not
    included. While a task runs, the panel says so.

## 3. Tests (offline)

- `test/site-draft.test.mjs` (5 cases): the switch; newer and older saves;
  concurrent saves; an unreadable record throws; the three states.
- `test/turn-fence.test.mjs`:
  - **DF1:** an edit saves a draft and publishes nothing.
  - **DF2:** Publish releases the approved D1 while a later D2 stays the
    draft; an unknown version is refused.
  - **DF3:** a task running at the click saves a later draft, not the
    publication.
  - **DF4:** no automatic path publishes (repair, sweep).
  - **DF5:** the preview serves the draft script with its header, a wrong
    token gets 404, and a visitor's header never reaches a live script.
  - **DF6:** the source guard on activation sites.
- Screenshots of the chip and the panel (saved, processing, published),
  rendered with the real `chat.js` functions and stylesheet.

## 4. Remaining gaps (not implemented)

- **The switch is off by default.** Turning it on is the owner's call
  (a Worker variable). With it off, every path publishes as before.
- **Backend effects are live immediately and cannot be drafted yet.** Schema
  and grants from builds, add-ons and the `rules` layer, scheduled functions,
  `data`-layer row writes, seeds and `_errors` all hit the site's one Neon
  database at once. The smallest sound correction is a Neon branch per draft,
  promoted on Publish. That is a design decision for the owner; it is
  proposed, not built.
- **Edits that write config or the sidecar directly bypass the draft:**
  - the `rename` edit layer patches the live sidecar's `origin`;
  - the social card is read from the editable config at request time.

  Both need to move into the staged version, or the Publish step.
- **Billing.** An edit's reserve is finalized when its draft is saved
  (`published_at` is set by the same commit RPC), not when it is published.
  The column now means "delivered". No SQL was changed.
- **Lost-job recovery under the switch.** A job that dies between saving
  its draft and its commit is refunded. The draft stays, so the customer
  gets the work free (the money-safe direction).
- **Pruning is skipped under the switch.** Staged builds for drafts are kept
  until a retention rule that knows the draft history is written.
- **Put back online** by its source fallback recompiles through the gated
  path, so under the switch it saves a draft instead of going live.
- **Preview limits:**
  - the preview address is unavailable for slugs longer than 43 characters
    (the DNS label limit);
  - the preview's head and meta come from the live sidecar;
  - it needs the template change in a deployed container image (not built).
- **Replies.** The deterministic and model-written replies read
  `checks.published` / `draft`. Wording elsewhere that says "live" on its
  own (for example progress milestones or build replies) has not been
  audited line by line.
- **Live verification: none.** Nothing here has run against real
  Cloudflare, R2 or a deployed Worker.

## 5. Changed under draft-first by the corrections chat (2026-10-15, late)

Draft-first belongs to another chat. These corrections, made in the
concurrency chat, touch the code draft-first uses; reuse them rather than
redo them:

- **The draft record can be held absent.** A takeover writes
  `{"held":"absent"}` (metadata `held: absent`) at `drafts/<slug>.json` when
  there is no draft, so a stale first save is refused by the store.
  `readDraft` reads that as no draft and returns its etag, so the first real
  save is conditional on it. Any new reader of the record must do the same
  (`isHeldObject` in `site-builds.mjs`).
- **The live marker is written only after the script answered**, only when
  absent, and never undone (`activateBuild`). Publish inherits this through
  the same activation.
- **The live script follows the pointer with a durable note before every
  upload.** That covers the publication's own upload and the uploads made by
  the follow, an alignment, the takeover repair and the sweep
  (`noteBeforeUpload`). It does not make a publication atomic. Between a
  stale upload landing and its correction, visitors can be served the
  previous version for about one upload plus one read, or until the
  2-minute sweep after a death or lost answer (notes older than 5 minutes).
  Publish's own "live at once" claims must not promise more than that.
- **Rollback writes hold keys absent instead of deleting them.** Any undo
  the Publish path adds should use `holdAbsent` (or `POINTER_NONE` for the
  pointer), never `deps.remove`.
- **Recovery notes are owned (2026-10-15, after Codex's fourth review).**
  Every invocation that uploads a script — publication, follow, alignment,
  takeover repair, sweep — writes its own note and renews it immediately
  before each upload (`holdScriptNote`). It takes away only its own
  (`retireOwnNotes`). Another invocation's note is retired only by a sweep
  whose follow settled, only after that note's window (`SCRIPT_NOTE_WINDOW_MS`
  = the upload's 10-minute abort plus 2 minutes) since its last renewal, and
  only by a conditional tombstone. Publish's uploads must go through
  `putSiteWorker` (or `followPointer` with their own `ctx`) so they get the
  same ownership. Never delete a `scriptpending/` note you did not write.

## 6. The second round: every builder change (2026-10-15, `claude/draft-first-publish`)

**The owner's requirement, restated:** "every builder-made change to a site
must save to a persistent draft and appear in the builder's preview.
Visitors keep seeing the last published version until the owner explicitly
clicks Publish." It covers Build, Edit and Add-on, uploads, replacements,
deletions, text, styling, pages, components, navigation, assets and backend
functionality. Ordinary conversation changes nothing.

**Where it was built.** The first round (`0966ea90`, above) is reused, not
rebuilt. The branch `claude/draft-first-publish` is current `main`
(`772bb885`, the assistant and hosting release) with help-needed at
`0966ea90` merged in (`0da51d1a`). That merge also carries help-needed's
publish-integrity corrections, unchanged, because the draft path depends on
their conditional activation. Three conflicts, each resolved as a union:
the Dockerfile's module lists, the owner-route dispatch list in `worker.js`,
and `owner-notes`.

**The record moved to its own namespace:** `site-drafts/<slug>.json`.
`main`'s video and audio kept before a site exists live under
`drafts/<uid>/`; the two never shared a key, but no longer share a prefix
either.

### 6.1 Revisions: what Publish names

Every task that saves anything makes a numbered **revision** of the draft:
- a code version, as before (the staged build, immutable);
- plus, when the task changed the database or the library of a site
  visitors already use, its **held changes**: a journal written once,
  immutable, `site-drafts/<slug>/held/<id>.json`.

A task whose only change is held (a row, a rule, a pageless addition, a
library file) makes a revision on the draft's current code. A task with
both makes **one** revision, so a half of a task is never publishable alone.
The record keeps `applied`, the last revision published.

`POST /api/site/<slug>/publish {revision, version}` publishes exactly that
revision. The version is a cross-check: a mismatch is refused. Nothing newer
is reached for. A revision at or below `applied` answers `already`.

### 6.2 Held changes, where a live site would see them

| What | Published site, switch on | Never-published site, switch on | Switch off |
|---|---|---|---|
| schema, rules (`applySiteSchema`) | held | written | written |
| starter rows (`seedSiteRows`) | held | written | written |
| scheduled jobs (`persistSiteJobs`) | **held** | **held** (they would run by themselves) | written |
| data-step row changes and additions | held | written | written |
| add-on entries (the `row` kind) | held | written | written |
| a video or recording replaced | held: uploaded under its own name, paired with the one it replaces | written | written |
| a video, recording, picture or document taken off | held | done | done |
| a new upload | a new, unreferenced address: no live page uses it until a published one does | same | same |

**One writer per task (`backendWriter`)** stands in for the three
schema-side calls.
- The add-on, the build and the rules step each bind those very names from
  their writer (`const { applySiteSchema, seedSiteRows, persistSiteJobs } =
  aWriter.calls`). Their call lines read exactly as before, and every earlier
  guard anchored on them still holds.
- Publish applies through the same writer, switched off, so the real calls
  are made in one function only.
- DFB11, a source guard, holds all of that.

A build whose generation finishes in a later invocation carries its hold in
its arguments, which its resume record keeps. `saveAsDraft` writes that
journal if it is not yet written.

**The next task reads the draft** (`draftView`):
- the data step is shown the rows as the draft has them (held updates
  applied, held removals gone, held new rows with a negative id that leads
  back to their insert);
- the rules step and the add-on design against the draft's schema;
- the editable copy already follows the draft (first round).

A change to a held new row amends that insert. If the insert was published
earlier, the change goes to the id it was given (`refs`).

### 6.3 Publish, in order

> **Superseded by §7** (the third round): the order below applied every
> held row change before the switch, so a script refusal left visitors with
> new data and old pages. §7.2 is the order now.

1. The revision is one the record holds; its build is complete.
2. **One publication at a time** (`site-drafts/<slug>.publishing.json`):
   - a second click on the same revision answers 202 "already being
     published";
   - another revision's click while one runs is 409;
   - a lock older than ten minutes belongs to a dead publication and is
     taken over.
3. The held changes of every unpublished revision up to the one named,
   applied in a repeatable order:
   - the latest schema (re-emitted whole);
   - the jobs (written over by name);
   - the starter rows (a table is seeded only while empty);
   - each change to an existing row (`UPDATE`/`DELETE` by id: the same
     result twice);
   - the new rows in **one** statement beside a `_meta` key for this
     publication (`rowsInsert`, the add-on's exactly-once pattern), so a
     second run collides, rolls back, and reads the first run's ids from the
     key;
   - the library: new bytes copied to the old address and the stand-in
     taken off; files taken off.
4. The version is activated through the same conditional activation, unless
   the live site is already on it (a rows-only revision).
5. `applied` moves to the revision.

A stop at any step answers what stopped and "press Publish again to finish".
Nothing is marked published, and the lock is released. Pressed again, the
publication resumes without doing anything twice.

**Only the owner's route calls Publish** (DFB8, a source guard). No task,
retry, recovery, reconnect, queue, cron or background completion can.

### 6.4 The preview, isolated

The preview host `<slug>--draft-<token>.gofarther.app` used to send every
path to the draft's script, so its own `/api/db/...` reads reached nothing,
and nothing refused a write. Now:
- `GET /api/db/<slug>/data/<table>` is served by the platform: the live rows
  with the draft's held changes applied (`rowsOverlay`). A table the draft
  adds reads as its held rows only when the data service says it does not
  exist; any other failure is passed on as it came;
- `/u/<slug>/<file>` serves the draft's library, through the platform's own
  `/u/` route asked on the app's address: a replaced file's new bytes at its
  old address, a file taken off as 404;
- **every other `/api/` path answers 403 `preview`**: writes, function calls
  (GET or POST), checkout, sign-in, visitor uploads, form hooks and error
  reports. Nothing done in the preview reaches the live database, a payment,
  a message or a visitor's account;
- preview reads are not counted in the site's own traffic metrics (DFB5
  found the `_metrics` write).

### 6.5 What the owner sees

- **Labels:** the build's stage rail and rows say "Saving to your draft" and
  "Saved to your draft" when the switch is on (`/api/credits` now says
  `draftFirst`). A build's answer carries `draft` (its version, revision and
  preview), which it used to drop on the way out.
- **The edit reply** adds "Saved to your draft — your live site changes when
  you publish." for a change saved to the draft. The rules reply no longer
  says "It's live now" for a held rule. Customer conversation is untouched
  and stays model-written.
- **The Publish panel** publishes the revision it was opened with.
  - States: "Saved, not published", "Not published yet" (a first build),
    "Still processing" and "Publishing".
  - One click sends one request. A 202 says it is already under way, and a
    stop shows the server's sentence.
- **The library list** marks a file the draft takes off (`draft: "remove"`)
  and a stand-in for a replacement (`draft: "replaces"`).

### 6.6 Tests (offline, supplied model answers only)

`test/draft-first.test.mjs`, 11 cases, the real Worker over stand-ins that
remember:

| Case | What it shows |
|---|---|
| DFB1 | first build (fired path) saves revision 1; no pointer, no live marker; the answer says saved to the draft |
| DFB2 | four edits (price, new loaf, change to the new loaf, a page line) are four revisions; the next task is shown the draft's rows; nothing live moves |
| DFB3 | revision 2 published alone; revision 4 later, the held change reaching the new loaf by its id; an edit after publication held again; refusals |
| DFB4 | a refused script stops after the rows; pressed again: no duplicate rows; two clicks at once; dead lock taken over; busy lock refused |
| DFB5 | preview overlay against live data; 11 write and side-effect paths refused; a refused read passed on; a draft-only table read |
| DFB6 | picture removal and recording replacement held, served live until Publish, previewed, listed, published, repeat is `already` |
| DFB7 | the writer: what is held where; jobs held before first publication; switch off writes live; the publish plan's folding |
| DFB8 | only the owner's route calls Publish; reloads read the same state |
| DFB9 | ordinary conversation with the switch on writes nothing |
| DFB10 | a row change finishing during a publication is the next revision, not in it |
| DFB11 | backend writes only through the writer and Publish's apply |

Also run: `site-draft` (5) and `turn-fence` (DF1–DF6 with the new key),
`publish-integrity`, `publish-pages`, `site-meta-sidecar`: 217 of 217.
**Mutation sweep: 21 of 21 killed, the comment-only control survived.** One
first-pass survivor (the missing-table narrowing) was a gap; its case is in
DFB5, and it is killed.

**The first full run found real wiring gaps, and fixed them:**
- 463 failures, nearly all because the tests run the page's reply
  functions cut out by name: the new helpers and a new global were not
  among them. They are now inline in the functions already listed.
- A dozen earlier source guards had lost their anchors. The code was changed
  to keep them, not the guards: call lines restored, a parameter order kept,
  the `/u/` route left byte-identical, and no new build refusal path, so the
  ten counted refusals stay ten.

**Full suite, local, measured in two worktrees:**

| | Tests | Passed | Failed | Skipped |
|---|---|---|---|---|
| baseline, the merge `0da51d1a` | 11,204 | 11,201 | 1 | 2 |
| this round | 11,215 | 11,212 | 1 | 2 |

The one failure on both is environmental: `no-generated-deps`' symlink case
fails where the worktree links `node_modules` (git refuses a path "beyond a
symbolic link"); a plain checkout and CI answer it.

**Screenshots** of the Publish panel (saved, first build, processing,
published), rendered with the real `chat.js` functions and stylesheet, were
shown in the conversation.

### 6.7 Remaining gaps

- **The switch is still off by default** (`DRAFT_FIRST`). With it off,
  every path publishes as before. Turning it on is the owner's decision at
  deploy.
- **Owner panels act immediately, by design:** the Data panel, imports,
  members, secrets, domains, the SEO, share and verification panels,
  backups and restores. They are the owner's direct settings, not builder
  tasks.
- ~~**The rename edit layer** (changing the site's address from chat) still
  takes effect at once.~~ Held since §7.1.
- **The preview shows rows, not rules.** A held rule or access change is
  applied at Publish; the preview reads anonymously. A held new table's
  functions (RPC) are refused in the preview, not simulated.
- **Preview row reads with filters or ordering:** held changes are overlaid
  on what the live query returned; a held row that would match a filter the
  live row did not is not added, and held new rows are appended unsorted.
- **Migration records** for a held add-on schema still say `applied` when
  the draft is saved; Publish does not rewrite them.
- **Billing** is unchanged from round one: a task is charged when its draft
  is saved (`published_at` means "delivered").
- ~~**A publication that stops after the rows** leaves the rows live with the
  previous pages until Publish is pressed again (said in the stop).~~
  Replaced by the phased publication, §7.2.
- **Concurrent edits from two tasks to the same row** in one draft: the later
  revision's change wins at Publish, as it would have live.
- **Live verification: none.** Nothing here has run against real
  Cloudflare, R2, Neon or a deployed Worker. The preview host also needs a
  deployed container image carrying the template change from round one.

## 7. The third round: publishing, coherent (2026-10-15, `claude/draft-first-publish`)

The owner, verbatim in part: *"Keep this branch focused only on publishing.
… leave owner-panel changes out of this work."* Three gaps: a chat rename
went live at once; Publish applied backend changes **before** the script
switch, so a refused script left visitors with old pages and new backend
behaviour; and the exact revision a click names must survive duplicates,
retries and recovery. help-needed's ownership and recovery corrections are
merged at `45c163d3` (merge `997ed529`), not rebuilt.

### 7.1 A chat rename is held

On a published site under `DRAFT_FIRST`, the `rename` layer still asks its
model and runs every check it ran before (the same name, a reserved name, a
name taken by another site or alias, a lookup that could not be made), then
**holds** `{kind:"alias", action:"rename", from, to}` in the draft and
answers `renamedInDraft`. A forget of an old address is held the same way
(`forgotInDraft`); it must be one of this site's own names. Nothing is
written to `site_aliases`, the alias cache or the live sidecar.

- The address the draft has is `addressOverlay(live, held ops)`: the next
  rename message is about that name, and the draft route answers
  `address: {live, draft}`.
- At Publish, consecutive renames are **one move** from the live name to the
  last name (`publishPlan`): a name only the draft ever had never becomes a
  redirect, and a move back to the live name is no move.
- The availability check runs again at Publish (preflight); a name taken in
  the meantime stops the publication before anything changes.
- The published version's sidecar carries the new origin (canonical link and
  `og:url`); a revision of held changes only, on the version already live,
  has the live sidecar's origin set at the switch.

### 7.2 The publication, as phases

`site-publishing/<slug>.json` is a journal written conditionally (etags) and
read strictly. Its phases:

1. **start** — preflight, nothing written: the revision is in the record with
   the same version; its build is complete; the held changes up to it form a
   plan; the database answers (when needed); a new address is free; every
   replacement file exists. A refusal drops the journal: `live: "unchanged"`.
2. **prepared** — only what the live version cannot see: tables it does not
   have (`newTablesOf`) and their starter rows. Nothing a visitor reads moves.
3. **switched** — the pointer and the script, through the same conditional
   activation and its own undo (help-needed's correction: the live marker
   only after the script answers). A refusal here is still
   `live: "unchanged"`.
4. **finished** — rolled **forward** step by recorded step:
   `address`, `schema`, `jobs`, `seeds`, `changes`, `inserts`, `library`,
   each marked in `done` when it lands, then `applied` moves to the revision
   and the journal is dropped.

A failure after the switch keeps the journal (`running: false`, the error,
`attempts + 1`) and answers 502 `live: "switched"`; the panel then says the
new pages are live and offers **Finish publishing**. Nothing is rolled back:
no database content is reverted, and no step deletes or overwrites a visitor's
row apart from the approved changes themselves (below).

**Exactly the revision clicked** (`clickPlan`):
- a fresh runner (written within 3 minutes) answers 202 to the same revision
  and 409 to another;
- the same revision stopped or with a dead runner is **resumed** from its
  journal, never re-planned from a newer draft;
- another revision that already **switched** is finished first (it was
  approved and its pages are live), then the click's own revision runs;
- another that stopped before its switch is set aside (nothing of it is
  live);
- a revision at or below `applied` answers `already` and changes nothing.

**Recovery without a click:** the 2-minute tick (`scheduled`, only with
`DRAFT_FIRST` on) runs `runPublishRecovery`: a stale `switched` journal is
finished from its own revision; a stale pre-switch one is deleted. It never
begins a publication. DFB8's guard still holds: only the owner's route and
this sweep call `runPublication`, and only the owner's route calls
`publishDraft` (DF6).

**Repeats change nothing twice:** alias writes are upserts and a forget of a
name already gone is done; `UPDATE`/`DELETE` by id give the same result
twice; new rows go in one statement beside the `_meta` key
`draft-publish:<preview>:<n>`, so a second run collides, rolls back and reads
the first run's ids.

### 7.3 The concrete limitation (not removed)

**A database and a site script cannot switch in one atomic step on this
platform** (Neon and the Workers dispatch namespace share no transaction).
The phases make the order safe, not instant, and completion is not
guaranteed (corrected in §8: a step whose store keeps refusing keeps the
window open, and §7's recovery had two holes, now closed):

- **Between the switch and the last finishing step**, visitors see the new
  pages against the old address rows, the old existing-table schema and
  rules, and the old rows — apart from tables that are new in this revision,
  which are already in place. In the tests this window is a single request;
  live it is the time of the alias writes and the SQL statements (expected
  seconds), and **if a step fails, until it is finished** by a click or the
  next tick. The pages a revision ships therefore must not depend on a held
  row change being present the instant they are served. The panel and the
  stop say plainly that the new pages are live and the rest is finishing.
- **Held row changes set values, they are not diffs.** An approved `UPDATE`
  writes the held column values over whatever the row holds at Publish; a
  visitor's change to **the same column of the same row** between the draft
  and Publish is overwritten (other columns and other rows are untouched).
  Held removals delete by id. No published row is ever reverted.
- **A schema change to an existing table** (a new column, a changed rule) is
  applied after the switch, not before: applying it before would change what
  the live version's visitors get. A page that reads the new column sees it
  absent for that window.

### 7.4 Tests (offline; supplied model answers; real Worker handlers)

`test/draft-first.test.mjs`, each reading the stored draft record, journal,
pointer, live script, sidecar, `site_aliases` rows and database rows:

| Case | What it shows |
|---|---|
| DFP1 | a chat rename and a second rename stay in the draft (aliases empty, sidecar origin unchanged, draft address shown); Publish moves the live name once to the last name, the old name redirects, the in-between name never becomes one; the sidecar origin moves |
| DFP2 | the click names revision 2 of 3: the pointer moves in the switch phase with the old price still live; after it revisions 1–2 are live and revision 3's loaf is not; revision 3's own click adds it once; a third click is `already` |
| DFP3 | the script refused before the switch: pointer, script, sidecar, rows, aliases and record unchanged, no journal, the draft still offered; pressed again it publishes once |
| DFP4 | the alias store refuses after the switch: 502 `live:"switched"`, journal kept with the error, record not marked, rows not yet changed; a newer draft meanwhile; the sweep while the store still refuses changes nothing; once it answers, the sweep finishes the same revision (address, rows once) and the newer change stays unpublished |
| DFP5 | the runner dies right after the switch: a duplicate click is 202, another revision 409; after 4 minutes the click resumes the same revision (one alias row, the loaf once), then the newer revision publishes on its own click |
| DFP6 | revision A switched and stopped; a click on newer B finishes A first, then B; nothing of A repeated |
| DFP7 | two clicks at once: one publication, one pointer move, one loaf, one alias row; an edit after publication is a new, unpublished revision |
| DFB10 | (kept) a task finishing during a publication becomes the next revision |
| DFB11 | (rewritten) every backend write a task makes goes through its writer; Publish applies through the writer switched off; the rename layer holds before its first alias write |

`test/site-draft.test.mjs`: `clickPlan`, strict journal reads, the draft's
address and the rename collapse. `test/turn-fence.test.mjs` DF6: only
`publishDraft` and `runPublishRecovery` call `runPublication`.

The panel (`public/chat.js`): "Address after publishing" when the draft has
a new address; a publication that switched and stopped reads "Some of this
draft is already live" with **Finish publishing**; a stop after the switch
never says "nothing changed on your live site".

### 7.5 Checks

- Commits: `27abcaea` (code and tests), then `b6a6a30f`, a merge of
  help-needed's `6c492b16` (a store without `head` read with `get`; its own
  fix for 54 failures that `45c163d3` brought, red on help-needed's CI run
  38810045259 and green on 38811169965). Without it this branch had the
  same 54 failures; none were from this round.
- Mutation sweep over `site-draft.mjs` and `worker.js`, with the draft-first,
  site-draft and turn-fence tests: 13 of 14 killed. One survived, and it
  cannot be caught: repeating the address step changes nothing, because
  alias writes are upserts. Both controls (an identity edit and a comment)
  survived.
- Full suite on `b6a6a30f`, local: 11,242 tests, 11,239 passed, 1 failed,
  2 skipped. The failure is the worktree's `node_modules` symlink case
  (environmental, present on every baseline here).
- CI on `b6a6a30f`: unit run 38814376697 green, 11,242 tests, 11,194 passed, 0 failed, 48 skipped (the same total as local); site build run 38814376586 green.
- The Publish panel was rendered headless (the draft's new address; a
  switched-and-stopped publication).
- No production SQL, container build, deploy, paid run or live mutation.
  `DRAFT_FIRST` stays off.

### 7.6 Remaining publishing gaps

- **The window after the switch** (§7.3): not atomic. Between the switch and
  the last step, visitors get new pages against the old existing-table rows,
  schema and address. On a failure that lasts until a click or the next
  tick gets the step through. ~~at most about 2 minutes after the runner
  goes stale~~ — corrected in §8.5: there is no such bound while the step's
  store keeps refusing.
- **Held row changes overwrite the same column** if a visitor changed it
  after the draft was saved (§7.3).
- **Recovery needs the tick.** `runPublishRecovery` runs only from
  `scheduled()` with `DRAFT_FIRST` on, and handles at most 10 journals per
  tick.
- **A held forget re-checks nothing at Publish.** A name already gone is
  done; one taken by another site meanwhile is not this site's row and is
  untouched.
- **The preview's address**: the preview host is the draft token host, not
  the new name. The new name answers only after Publish.
- **No live verification.** None of this has run against real Cloudflare,
  R2, Neon or Supabase.
- Unchanged from §6.7: the switch is off by default; owner panels are out of
  scope; the preview shows rows, not rules; filtered preview reads are
  approximate; migration records are not rewritten; billing is at save.

## 8. Recovery at every boundary (2026-10-15, after Codex's review of `af0819bf`)

Codex confirmed the focused tests and CI on `af0819bf`, then reproduced two
recovery failures with the real Worker functions and network-blocked
fixtures:

1. **A switch that landed under a `prepared` journal.** The runner stopped
   after `activateBuild` and before `switched` was stored. The sweep read the
   stale `prepared` journal as "nothing live" and deleted it: `{finished:0,
   cleared:1}`, `applied` 0, the row unchanged, the new pages live.
2. **Cleanup deleting newer work.** The sweep read an expired journal and then
   deleted the key unconditionally. A fresh journal written in between was
   removed. `drop()` was also a read-then-delete.

help-needed's recovery-note ownership corrections (`9da48fe2`, `d583030d`)
were merged first (merge `9c1a5af3`); the Publish path's script upload already
goes through `putSiteWorker`, so it carries their per-invocation notes.

### 8.1 The design now

- **Every side effect follows a checkpoint that names it.** A new phase,
  `switching`, is stored with `from` (the live version it replaces) before
  the pointer and script move. A journal in `switching` may or may not be
  live.
- **Every resumption reads the pointer, not its memory.** A click, a
  takeover or the sweep handles `switching` the same way:
  - on the approved version: the switch happened, so it continues;
  - still on `from`: the switch is made (it was approved, and the
    activation is conditional on the pointer's etag, so two runners cannot
    both make it);
  - on anything else: the live site moved on (for example the owner
    restored a version), so the publication is set aside and nothing is
    forced over it.
- **An answer is not an outcome.** When activation answers with a failure,
  the pointer is read again before anything is retired. A thrown error,
  or an unreadable pointer, at or after the intent keeps the journal and
  answers `live: "unknown"` (or `"switched"`), never "nothing changed".
- **Journals are never deleted.** R2 has no conditional delete, so retiring
  is a conditional write, on the etag the retiring runner holds, of
  `finished` or `retired`. A journal another runner wrote meanwhile has
  another etag and stays whole. A new publication is written conditionally
  over the tombstone it read. The sweep pages through the whole prefix.
- **Ownership:** every journal write is conditional on the etag its writer
  holds. A slow runner whose journal was taken over fails its next
  checkpoint (`TAKEN_OVER`) before its next side effect, apart from the one
  already under way. That one is either conditional (the activation) or
  repeatable (the finish steps; new rows by their `_meta` key).

### 8.2 Every boundary, audited

| Boundary | A stop or lost answer there leaves | Recovery |
|---|---|---|
| journal create (lost answer) | `start`, running | the click answers 503 "nothing changed"; once stale, the sweep sets it aside |
| new tables applied, `prepared` not stored | unused new tables, `start` | set aside; a later run finds the tables, and the finish seeds them |
| `prepared` stored (lost answer) | `prepared` | set aside: nothing visible was written |
| pointer read before the intent fails | `prepared` | set aside |
| `switching` stored (lost answer) | `switching`, pointer on `from` | 502 `unknown`; the click or sweep makes the switch, then finishes |
| activation: script uploaded, pointer not moved | `switching`, pointer on `from` | the same; help-needed's notes make the script follow the pointer |
| activation: pointer landed, sidecar or script not (§9) | `switching`, pointer on the version, old script running | ~~continues as switched~~ — §9: the sidecar, script and live marker are made true first |
| activation landed, answer lost or failed | `switching`, pointer on the version | the pointer is re-read: continues as switched |
| activation undone (its own undo) | `switching`, pointer on `from`, new etag | the switch is made again |
| live site changed by something else | `switching`, pointer elsewhere | set aside, nothing forced |
| `switched` stored (lost answer) | `switched` | 502 `switched`; finished by a click or the sweep |
| a finish step done, its mark not stored | `switched`, step not in `done` | the step runs again (upserts, `UPDATE`/`DELETE` by id, new rows by `_meta` key, library copy) |
| `markApplied` landed, answer lost | `switched`, all steps done | `markApplied` answers `already`; closed |
| the `finished` tombstone lost | `finished` stored, or `switched` with every step done | closed as is, or closed by the next run doing nothing again |
| takeover write (click or sweep), lost | the journal, fresh runner | 503; carried on once that window passes |

### 8.3 Tests (offline; real Worker handlers; supplied model answers)

`test/draft-first.test.mjs`. Each case reads the pointer, the live script,
the rows, the draft record and the stored journal:

| Case | What it shows |
|---|---|
| DFR1 | **Codex's first reproduction.** The runner stops after the activation, before `switched`: the journal says `switching` with `from`, the new pages live, the row old, `applied` 0. A fresh sweep leaves it alone. Five minutes on, the sweep finishes it: `{finished:1}`, the new price, `applied` = the revision, the journal `finished`, the panel's state `published` |
| DFR2 | Stopped right before its pointer write: nothing new is live, then the sweep makes the switch and finishes. Variant: the live site moved to another version meanwhile, and the sweep sets it aside (`cleared:1`): the other version stays live, the row unchanged, `applied` 0 |
| DFR3 | Lost answers: (a) `switching` → 502, not "unchanged"; a click in the runner's window is 202; the sweep completes it. (b) `switched` → a click after the window finishes it. (c) The runner dies after adding the new loaf and before recording it: finished with one loaf |
| DFR4 | **Codex's second reproduction.** A fresh journal lands between the sweep's read and its retirement, and is still there, whole. The same for a runner retiring its own journal after a refused switch. Both observers prove they fired |
| DFR5 | The sweep and a click at once on a stopped publication: finished once (the row, one loaf, the record); then a newer revision publishes over the tombstone; a later sweep over closed journals touches nothing |
| DFR6 | Lost answers at the ends: the journal create (503 "nothing changed", true; set aside; a fresh click publishes) and the closing tombstone (complete; nothing repeated) |
| DFR7 | The activation's own answer goes wrong. (a) The pointer write lands with its answer lost: the publication carries on and finishes. (b) The script is refused and the activation's own undo of the pointer also fails, so it answers a failure while the pointer names the new version: the pointer is read again, the publication is not set aside, and it finishes |
| DFR8 | The pointer cannot be read during a recovery at `switching`: the journal is kept, with `attempts` 1 and never retired on an unknown; the next sweep finishes it |

The earlier DFP cases now expect the closed tombstone instead of a deleted
journal, and expect the pointer to move under `switching`. `site-draft`
unit cases cover the phases, `clickPlan` on `switching` and on closed
journals, and the strict reading of `from`.

**Guard kept, code conformed:** `publish-integrity`'s source guard requires
every activation's `previous` and `expectEtag` to come from one
`readPointerTag` statement. The switch reads them that way.

**Mutation sweep** (draft-first, site-draft and turn-fence tests), 14
product mutants, all killed, the comment control surviving each round:
- the intent not stored;
- the sweep retiring `switching`;
- retire as a delete;
- the sweep deleting;
- the failed activation not re-read (it survived until DFR7(b));
- forcing over a moved site;
- a throw at the switch retiring;
- "uncertain" said as unchanged;
- a new journal written create-only;
- `journalMayBeLive` without `switching`;
- a closed journal counted live;
- `switching` read without `from`;
- finished retired as `retired`;
- an unreadable pointer retiring (it survived until DFR8).

**Full suite**, local, on the final tree: 11,260 tests, 11,257 passed,
2 skipped, 1 failed (the worktree's `node_modules` symlink case,
environmental).

**Red check:** the new test files, run against the pre-fix product code
(`9c1a5af3`). All six DFR cases written first (DFR1–DFR6) fail, and so does DFP2 (the order check).
The `site-draft` file fails there because the new names do not exist yet.

### 8.4 The panel

A publication stopped at its switch reads "Publishing stopped while
switching your site to this draft", says the live site "may already show
the new pages", and offers **Finish publishing**. No message says it
finishes "shortly" any more; they say it is "also retried automatically".

### 8.5 What is still true, and not removed

- **The window between new pages and the backend.** From the switch to the
  last finishing step, visitors get the new pages against the old rows, the
  old schema of existing tables and the old address (new tables are in
  place). Normally that is the rest of one request. After a stop, it lasts
  until a click or a sweep, and the sweep runs only every 2 minutes and
  only after a runner has been quiet for 3. **If a step's store keeps
  refusing, it lasts until the store answers: there is no bound, and
  completion is not guaranteed in any given time.** Nothing is rolled back
  to close it.
- **A stopped switch may be completed by the sweep** without a further
  click, because the owner's click approved that revision. If the live site
  moved to another version in the meantime, it is set aside instead.
- **Held row changes overwrite the same column** that a visitor changed
  after the draft (§7.3).
- **Recovery runs only with `DRAFT_FIRST` on** (`scheduled`), handles at
  most 10 open journals a tick, and keeps one small tombstone per site.
- **A slow runner, not a dead one,** may still be inside a repeatable finish
  step when another takes over. Its repeat writes the same approved values,
  and new rows are exactly-once.
- **No live verification.**

## 9. A pointer on the version is not an activation (2026-10-15, after Codex's review of `ea75976f`; fix `71f7d48d`)

**The reproduction.** Old code is live, and a newer draft with held backend
changes is approved. `activateBuild`'s pointer write lands, and execution
stops before the call returns and before the script upload starts. The
journal stays at `switching`. `runPublishRecovery` saw `pointer.version ===
j.version`, skipped the activation, applied the held changes, and marked
`draft.applied` and the journal `finished`. The script actually running was
still the old version.

**Why:** `activateBuild` writes the pointer first. The sidecar, the script
upload and (on a first site) the live marker come after it. §8 took a
matching pointer as proof that all of them had happened.

**The fix (`completeActivation`).** Wherever a publication finds the pointer
on its version, having replaced another version, it makes the activation's
other effects true before it records `switched`. This covers its own
activation, one whose answer was lost, and one that stopped part-way:
- **The sidecar** the version names, with the held address baked in. It is
  written only after re-reading that the pointer still names the version,
  and conditionally on the sidecar it read. A newer activation's sidecar is
  never overwritten.
- **The live script**, through help-needed's `alignLiveScript`. That follows
  the pointer, never this version blindly, so newer work wins. It uploads
  under its own recovery note (`holdScriptNote`), and counts as aligned only
  when the dispatch probe sees the script serving the pointer's version.
- **The live marker**, created only if absent, after the script serves.

If any step fails, or the script is accepted but not yet serving, the
journal is kept at `switching` with the attempt counted and `live:
"unknown"`. No backend change is made, and the next click or sweep repeats
the check. If the pointer moved on, that next run sets the publication
aside. Every step is safe to repeat: a second sweep uploads nothing and
writes nothing.

A revision of held changes only, on the version already live (`from ===
version`), has no activation; only its address goes into the live sidecar,
as before.

### 9.1 Tests (offline; `liveScripts: true`; the running script asked through the dispatch stub)

| Case | What it shows |
|---|---|
| DFR9 | **Codex's reproduction, at two points:** (a) stopped after the pointer write, before the sidecar; (b) after the sidecar, before the script's upload note. At the stop the pointer names the new version while the running script is the old one. The sweep uploads the script, sees it serving, writes the sidecar with the held address, then finishes the address, the row, the record and the journal. A second sweep uploads and writes nothing |
| DFR7 (strengthened) | (a) a lost pointer-write answer: at the stop the running script is still the old one; at the end it serves the new version. (b) the script refused and the pointer's undo failed: at the end the running script serves the new version |
| DFR1 (strengthened) | the running script is checked at the end |
| DFR10 | **The outcome stays unknown:** the sweep's upload is accepted but not serving yet, so nothing is recorded, no backend change is made, and the journal keeps the attempt; once it serves, the next sweep finishes. Newer work had moved the pointer: set aside, nothing of the approved version uploaded. Newer work moves the pointer and writes its sidecar during the sweep's reconciliation: that sidecar is never overwritten, and the publication is set aside |
| DFR11 | a first publication (no pointer, no live marker before) stopped before its script: the sweep uploads the script, creates the live marker and finishes; a second sweep does nothing |

**Red check.** The new test file, run against `ea75976f`'s product code:
- DFR7 fails: "finished with the old script running".
- DFR9 fails: `dfr9a`, "finished with the old script running".
- DFR10 fails: `{finished:1}` while the script was not serving.

**Mutation sweep.** 8 mutants of `completeActivation` and its call site,
all killed; the comment control survived:
- effects not reconciled;
- alignment not required;
- no alignment;
- sidecar not reconciled;
- live marker not made;
- sidecar written without the pointer check (killed by DFR10's third
  case);
- an unreconciled switch recorded as switched;
- alignment replaced by a constant.

**Full suite**, local: 11,263 tests, 11,260 passed, 2 skipped, 1 failed
(the worktree's `node_modules` symlink case, environmental). **CI on the
previous push `ea75976f`:** unit 38823795399 green (11,260 tests, 11,212
passed, 0 failed, 48 skipped), site build 38823795461 green.

### 9.2 What stays true

- **The window between the new pages and the backend** (§8.5) is unchanged.
  It now begins only once the new script is seen serving.
- **The script check reads the dispatch probe.** It cannot see every edge
  location; it is the same evidence help-needed's follow and sweep rely on.
  An upload that is accepted but never seen serving keeps the publication at
  `switching` indefinitely, and it is retried every sweep.
- **The sidecar is rewritten to the approved version's** while a
  publication is at `switching`. A change made to the live sidecar in that
  window by anything other than a newer activation is replaced. (Owner
  panels that write it are out of scope here.)
- **No live verification.**
