# Audit batch 1: the first ten findings (2026-10-18)

On the owner's word ("ok start fixing", after the first ten of
`docs/audits/2026-10-17-builder-audit.md`, most severe first). Branch
`codex-work-into-claude`, offline only: nothing merged, deployed, switched,
applied or spent.

## What each finding was, and what changed

| # | Finding | What went wrong | The fix | Test, and its red check on the old code |
|---|---|---|---|---|
| 1, 7 | A03-1, S1-1 | In a container, the rename step's "is that name a site?" read was refused by the gateway, and the refusal read as "nobody" — one account could take another's live address | `siteNameTaken` answers true / false / cannot-tell and the rename (and Publish's `addressTaken`) refuses cannot-tell; the gateway admits one **existence read** (`slug=eq.<name>&select=slug`, any name, nothing else) | DH7 (container, real gateway, Supabase through the gateway's door): a rename onto `harbourside-roast` is refused, nothing written; a free name is held in the draft. Old code: the takeover went through |
| 2, 4 | A04-2, A09-1 | A database first made in a container left the site's row blank (`neon_db: ""`), so every visitor form, sign-in and booking answered 404 | The gateway admits **one PATCH**: the job's own row (`slug` and `uid` bound), only while the name is blank (`or=(neon_db.is.null,neon_db.eq.)`), only `neon_db`, a plain name | DH8 (container add-on on a site with no database): the name is recorded. Old gateway: `PATCH site_backends` refused |
| 3 | A05-1 (with A03-3, A37-2, S1-2) | Production is blocked: `main`'s gateway refuses the publish turn | The gateway fix is `db4e73e1` (already on the branch). Added: a turn the store **refuses** is never waited out — the job ends at once (`turn-refused`, not an overlap loss, so not re-run); a check stopped before its first write says "Nothing was changed", not "Recovery may already have updated stored state" | DH9 (the turn's key refused, as on `main`): every part ends at once, none re-run, nothing changed, no "another change" sentence. Old code: the misleading sentence |
| 5, 6 | A11-1, A38-1 | Under draft-first, Back online activated the newest staged build — usually the unapproved draft | `unpublishedVersions(draft)` (site-draft.mjs); Back online's list leaves those versions out, and an unreadable draft record leaves out every staged build (the recompile's own draft-first refusal then answers) | DFO1 (through the offline route): published, a draft saved, offline, back online — the published version is live, not the draft. Old code: the draft went live |
| 8 | A01-1 (A08-3, S1-3) | A container first build could not see its chat's site or the account's names, so the duplicate-build guard and the fresh-name rule were dead | The gateway admits the job's **own account's rows** (`uid` bound to the token; columns `slug, neon_db, brief, chat_id` only); `freeSlugFor` asks ownership through that read and each candidate through the existence read | sb-gateway "the own-account read" (bounds); fresh-build-slug 10/10 with the new lookups. **Not driven**: a whole first build through the container (the route harness cannot pass the designer) |
| 9 | A01-2 (A08-2, A10-1, S1-4) | Video and audio attached before the site existed never reached a first build in the container | `ownAccountKey`: a job lists and reads `drafts/<its uid>/` (also before it has a name), removes a moved draft, never writes one; reads and writes its own site's `media-ledger/site-<slug>.json` (never a pre-scoped job, never another site) | JGD-M, through the real gateway handler. **Left as is**: the browser forgets the list after a build that named a file it could not move (A01-2's last part); the gateway PUT still buffers whole files (S1-4) |
| 10 | A03-2 | The picture step offered visitors' form uploads as "photographs the owner has uploaded" | Its library leaves out `visitor` uploads, as the share picker and the conversation already did | PV1, through the edit route. Old code: the stranger's file was offered |

## The test fixture now runs Supabase through the gateway

The audit's first theme was tests that stand in for the gateway. DH8 first
passed on the old gateway too: the fired job's Supabase calls reached the
stand-ins directly. `containerEnvOf(…, { sb: true })` and
`throughGatewaySb` (test/fixtures/fired-jobs.mjs) now put the container's own
shim (`gatewayFetch`) in front, so a marked call goes to the Worker's `/sb`
door. DH7 and DH8 use it; the other fired tests are unchanged.

## Readings

Recorded after the runs: see the owner-notes entry of 2026-10-18 for the
sweep, the full suite and CI.
