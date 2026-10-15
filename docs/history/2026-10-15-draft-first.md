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

## 5. The second round: every builder change (2026-10-15, `claude/draft-first-publish`)

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

### 5.1 Revisions: what Publish names

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

### 5.2 Held changes, where a live site would see them

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

### 5.3 Publish, in order

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

### 5.4 The preview, isolated

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

### 5.5 What the owner sees

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

### 5.6 Tests (offline, supplied model answers only)

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

### 5.7 Remaining gaps

- **The switch is still off by default** (`DRAFT_FIRST`). With it off,
  every path publishes as before. Turning it on is the owner's decision at
  deploy.
- **Owner panels act immediately, by design:** the Data panel, imports,
  members, secrets, domains, the SEO, share and verification panels,
  backups and restores. They are the owner's direct settings, not builder
  tasks.
- **The rename edit layer** (changing the site's address from chat) still
  takes effect at once.
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
- **A publication that stops after the rows** leaves the rows live with the
  previous pages until Publish is pressed again (said in the stop).
- **Concurrent edits from two tasks to the same row** in one draft: the later
  revision's change wins at Publish, as it would have live.
- **Live verification: none.** Nothing here has run against real
  Cloudflare, R2, Neon or a deployed Worker. The preview host also needs a
  deployed container image carrying the template change from round one.
