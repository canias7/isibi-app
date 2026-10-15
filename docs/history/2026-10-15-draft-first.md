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
  the follow, an alignment, the takeover repair and the sweep. Each one
  writes or renews its own note (`holdScriptNote`; the earlier
  `noteBeforeUpload` is gone, see the owned-notes bullet below). It does not
  make a publication atomic. Between a stale upload landing and its
  correction, visitors can be served the previous version for about one
  upload plus one read. After a death or a lost answer, the repair waits
  for the 2-minute sweep, which acts only once the note's 12-minute window
  has passed (the upload's 10-minute abort plus 2 minutes), so about 12 to
  14 minutes. Publish's own "live at once" claims must not promise more
  than that.
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

## 6. Hand-over from the concurrency chat (2026-10-15, closing)

The concurrency correction batch is closed at `66cbeb55`. Codex's
overlapping-recovery tests passed on the combined Publish tree.
- **Reuse:** take the code commits `45c163d3`, `6c492b16`, `9da48fe2` and
  `d583030d` as they are, with the rules in §5. Do not re-implement them.
- **Yours:** the newly reported pointer-before-script-upload failure
  belongs to this branch. The concurrency branch leaves it alone. If the
  fix changes shared code (`activateBuild`, `putSiteWorker`,
  `followPointer`, `holdScriptNote`), say so in the record, so that the
  integration takes it once.
- **Timing to respect:**
  - a note's window is `SCRIPT_NOTE_WINDOW_MS` (12 minutes since its last
    renewal);
  - the sweep runs on the 2-minute cron;
  - the bound assumes an aborted upload never takes effect more than 2
    minutes after its 10-minute abort.
- **Integration:** `claude/help-needed-ehlwlj-integration` at `c9ef979d`
  combines the concurrency branch with `main`'s assistant and audio/video
  work (CI green: 38819883606, 38819883654). Publish is not in it yet.
