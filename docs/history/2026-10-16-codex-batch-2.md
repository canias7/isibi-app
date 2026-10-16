# The second batch on `codex-work-into-claude`, after Codex's review of `99021708` (2026-10-16)

**On the owner's word**, on `codex-work-into-claude` only, for Codex's review.
Nothing merged, deployed, switched, applied to production SQL, built into an
image or spent; no paid test. `claude/chat-session-0nndv1` untouched
(`f9f983a3`). Codex had passed 33 focused tests and unit CI on `99021708`
and found the mixed code-plus-held save; this batch closes it and the
connected gaps. Exact commits, results and CI are in owner-notes (2026-10-16,
second batch).

## 1. Code and held changes saved behind a newer draft

**Codex's reproduction.** With a newer draft already saved, an older save
carrying a nonempty held journal returned success and ran `commit`: its code
stayed in the history only, and a revision of its held changes was written
on the NEWER code. Publish would then have applied, for example, a table
with no page that uses it, and the job was billed as done.

**The fix, in three connected parts:**
- `saveDraftRecord`: a save strictly older than the draft that carries held
  changes **writes nothing** and answers `older`. Its immutable journal stays
  unreferenced, so it is never applied and never duplicated. `saveAsDraft`
  then refuses every older save (with or without held changes) before its
  commit: nothing is billed as done.
- **The part runs again alone** (the overlap re-run from the first batch),
  and the re-run holds its changes afresh, once.
- **The re-run wins.** Under draft-first a publish or a build mints its
  version after the draft's (`mintAfter`, `mintForDraft`), so a clock behind
  another isolate's can no longer lose a save on every try.

**What the job path needed besides** (found by the end-to-end case):
- the add-on's failure answered `compile`, losing the overlap code — now
  `lostOr`;
- after the publish gate, the review reconcile rewrote the answer as
  `reconciled`; it now keeps the job's own code as `was`, and the request
  reads an overlap there too;
- the add-on said **"database applied"** (and its migration record
  `applied_without_page`) for a schema that was only held: now `none` and a
  new migration state `discarded`.

## 2. Within-request serialization

- **An addition is judged by its router targets.** It used to count as a
  config and a schema writer whatever its targets said, so two additions
  never overlapped, nor an addition beside a rules or look step. Now an
  addition writes what its targets name, and the whole site when they name
  nothing.
- **What keeps that safe:**
  - an addition cleared without the look that designs one is refused at
    its config write (`turnStillMine` answers `turn-lost`) and runs again
    alone;
  - one cleared without a table that designs one is refused before
    anything is made (`conflict`), but only while another part of its
    request is still open (`othersOpen`), and runs again alone;
  - a part running alone holds the turn throughout (`holdsConfig`) and is
    cleared for the schema.
- **Turn ownership shortened:** a page-only addition no longer takes the
  publish turn before its first read; it takes it at its publish, as a text
  step does. Look and logo steps keep holding it throughout: they rewrite
  the config before they publish.
- **The database is made beside the page writer.** An addition's
  provisioning starts as a promise and is settled after the page call, at
  the top of the pageless path, before the stop at the page gate, and in the
  failure door. A failure answers word for word as before, and the reserve
  taken meanwhile is refunded with the rest of a job that did not ship.
- **Kept as real dependencies:** a Build's page generation reads the
  schema it has just applied (`specForAddon` over the new database), so a
  Build still provisions and applies before generating; parts on the same
  page, two config writers and two schema writers still wait; every cap is
  unchanged.
- **Not done:** preparing an addition's page writer past its design (its
  request would depend on what the job's designs answer at run time, and a
  mismatch only wastes a call); the driver's one-at-a-time row reads
  (latency only).

## 3. Video and audio

- **An interrupted delete no longer serves.** A delete records `deleted`
  before it removes the object. A stop between the two left the bytes
  playing. `/u/` now reads a media file's record and answers 404 for one
  recorded deleted, and that read finishes the delete. A record that
  cannot be read serves as before.
- **Abandoned uploads are reclaimed** by the two-minute tick
  (`runMediaSweep`):
  - it runs a bounded number per tick, from a cursor kept between ticks,
    and acts only an hour past a session's own expiry;
  - an open upload whose bytes never landed is aborted (an abort discards
    parts; it never removes an object);
  - a finished one whose record said open keeps its file;
  - room, session and part records are released;
  - **no object under `uploads/` is ever deleted**;
  - a pre-site draft goes a day after its seven.
- **Configurable limits reach the runtime.** The deploy passes
  `MEDIA_MAX_VIDEO_BYTES`, `MEDIA_MAX_AUDIO_BYTES`, `MEDIA_MAX_SITE_BYTES`,
  `MEDIA_MAX_SITE_FILES` and `MEDIA_MAX_DRAFT_FILES`.
  - They are plain Worker vars, GitHub repository variables of the same
    names, with a `default` fallback, since an empty value fails a deploy;
    `default` reads as the default.
  - Container jobs are handed them (`JOB_ENV_NAMES`).
  - The owner's file list reports the limits in force. The runtime route
    stays booleans only, by its own contract.
  - A limit under a megabyte is said in KB.
- **Together** (MR4): a recording replaced and a video removed under
  draft-first are both held. Live plays the old recording and the video,
  seeking included. The preview plays the new recording at the old address
  and not the video. Publish makes both live once, and the tick afterwards
  deletes nothing.

## 4. The preview read the live sidecar

The preview copy of the site's script is compiled with the site's slug, so
it read `sitemeta/<slug>.json` — the LIVE description, address and
redirects. A draft that changed the description (or an address or a
redirect) previewed with the live head.
- A draft save now writes the draft version's own composed sidecar to
  `sitemeta-draft/<slug>.json`; the live one is untouched.
- The site script reads it when previewing, falling back to the live one
  (`server.ts`, and its copy in `foundation-files.mjs`, regenerated).
- The container's storage wall admits the key.
- **Changes the template, so a merge rolls the container image.**
- Redirects are applied by the platform, not by the preview path, so a
  draft's new redirect is still not followed in the preview. This is
  recorded, not changed.

## 5. Immediate writes under draft-first, stated exactly

Draft isolation covers builder-initiated changes (Build, Edit, Add-on,
including their backend and library effects) on a published site, and the
Files panel's deletions and media replacements. **These act on the live site
at once, by design or by scope, and are not claimed as drafts:**
- **Owner panels:** the SEO description (the live sidecar), the share
  picture, site verification, custom domains, secrets, notifications,
  members, the Data panel's row writes and CSV import, backups and restores,
  Versions restore (it activates a published version), offline and Back
  online (Back online restores a published version and never recompiles
  the draft).
- **A site that was never published:** its database is written directly
  (nobody uses it yet), and a rename moves its address directly. Scheduled
  jobs are always held.
- **A new upload** (a picture, or a video or recording that is not a
  replacement) is stored at once at its own public `/u/` address. No page
  plays it until a draft that uses it is published. `/u/` addresses are
  public and unguessable, never private.
- **A platform rebuild** saves a draft under draft-first rather than
  updating the live site.

## 6. Completion matrix

| Area | Item | Finished (offline) | Deferred implementation | Live-only verification still owed |
|---|---|---|---|---|
| Parallel | independent parts side by side; dependencies wait | yes (CW1–CW12, PPM2) | — | two writing jobs overlapping on real infrastructure |
| Parallel | a part lost to its own request's overlap re-runs alone | yes (CW5, PPM3, DMO1) | — | live |
| Parallel | additions by their targets; refused and re-run when they need more | yes (AB1, AB3) | — | live |
| Parallel | page-only additions take the turn only at publish | yes (AB1, BC1) | — | live |
| Parallel | provisioning beside the page writer | yes (AB2, AB2b) | — | real Neon timing |
| Parallel | addition page writer prepared past design; Build provisioning overlap | — | yes (Build: a real dependency; addition prep: deferred) | — |
| Parallel | writes from different requests | — | out of scope | — |
| Publish | older code-plus-held save refused, re-run, held once, published once | yes (PPM3b, DMO1, DMA1) | — | live |
| Publish | `DRAFT_FIRST` into every job; observed probe | yes (DH1–DH5, PPM4a) | — | the `env` probe pressed |
| Publish | exact revision; later drafts kept out; duplicate clicks; recovery | yes (DF*, DFP*, PPM2, DV3) | — | live, and a real crash (not induced) |
| Publish | the preview's head is the draft's | yes (MR5, DMO1) | — | the preview host after an image roll |
| Publish | owner panels and the other immediate writes (§5) | stated | redesign: owner's decision | — |
| Media | upload, sniffing, limits, ownership, Range/ETag | yes | — | — |
| Media | interrupted delete answers 404 and is finished | yes (MR1) | — | live |
| Media | abandoned sessions/parts reclaimed, nothing referenced removed | yes (MR2, MR4) | — | R2's own multipart behaviour |
| Media | limits from the deploy to Worker and jobs | yes (MR3) | — | a deploy with a variable set |
| Media | replacement, removal, seeking, preview vs live, Publish | yes (PPM1, MR4, DFB6) | — | live |
| Media | `/u/` tied to the host; `If-Range` | — | yes (backlog) | — |
