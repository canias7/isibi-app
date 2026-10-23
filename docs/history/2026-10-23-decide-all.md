# 2026-10-23 — every decided branch on one branch (`decide-all`)

Branch `decide-all`, from `origin/decide-combined` (`a23988601`), with one
`git merge` per branch, in this order (all from `a8fbfe876`):
`decide-g-jobs` (`8e7a42224`), `decide-g-design` (`431567020`),
`decide-g-publish` (`9c471a2ba`), `decide-g-media` (`f85f5d896`),
`decide-g-other` (`a3c42d656`). Nothing paid, no model calls, no live writes.
Not merged to `main`, not deployed.

## Conflicts and how each was settled

- `docs/owner-notes.md`, at jobs, design, publish (and other): the union
  resolver (both entries kept).
- `worker.js`, at publish: the `site-offline.mjs` import (publish added
  `offlineStamp`) beside the `build-lease.mjs` import (jobs/money-8 added
  `STOPPED_FREE_MSG`, `STOPPED_SHORT_MSG`): both kept.
- `worker.js`, at other: the `site-translate.mjs` import (publish's batching
  names) beside other's new `lang-override.mjs` import: both kept.
- `test/edit-path.test.mjs`, at other: both branches appended their own tests
  at the file's end (publish's #195 batching, other's #196 overrides); ours
  kept and theirs appended after it. Other's `withWire`/`edit` helper changes
  (a function answer, a `page` argument) merged on their own.
- `public/chat.js`, `builder/request.mjs`, the `Dockerfile`: merged clean.

## What the merged tree needed (found by the full suite)

All four are the media branch's own, red on `decide-g-media` alone (its record
had counted only two environmental failures):

- **The design field `logo` (#168) was claimed by no design agent and no
  wave**, so `splitGraph`/the waves refused every first build's tool (the
  split designer never ran: `design-graph`, `design-waves`, `build-batch-9`,
  `build-parallel-route`, `parallel-requests`). `logo` now belongs to the
  `wordmark` agent and the `look` wave, beside the mark it replaces.
- `edit-lanes`: `logo` names an attachment, not a part of the look, so it has
  no edit lane on purpose (a later logo change is the logo rung's); excluded
  by name, with the exclusion's own liveness check.
- `build-budget`: the new `ownlogo` mark had no stage; it is `generate`, as
  `ownphotos` is.
- `api-auth`: the export matcher lost its space (`const xp =url…`), so the
  owner dispatch scan stopped seeing it. Restored.
- `draft-blocked-card` SB1 sampled a toast one tick after the request; under a
  full suite's load it missed it (passes alone 4 of 4). It now waits for it.

## The interaction review

- **Per-project busy (32) vs the floor (6) and replay (5).** The floor is read
  per filing on the server and the kept route answer is keyed by site and
  key (`route-answer:<slug>:<key>`), so two projects sending at once cannot
  share a replay or skip a floor. Every busy setter goes through
  `siteBusyBegin/End(origin)`; no raw `siteBusy =` write is left. Nothing to fix.
- **Offline marker (10) vs rebuild (13), prune (11), jobs requeue (16),
  crashed-turn wait (12).** Every path that makes a site live reads
  `offlineMarked` (publish, set-aside, the publication runner and its sweep,
  the rebuild's `rebuildGoesLive`). A deferred edit job (16) saves a draft,
  never live; the dead-holder wait (12) repairs the editable copy from the
  draft under the turn; prune (11) runs inside Publish's turn and keeps every
  draft. No path found that brings an offline site back. Nothing to fix.
- **langOverrides (31) vs translation batching (9).** The stuck-batch record
  lives at `langStrings._stuck`, read only per language tag; overrides are a
  separate config field laid over the cache in `filesFor`, so a stuck batch
  shows English except where the owner's own wording stands. **Found, not
  fixed (backlog):** the build path's own translation fold
  (`buildAndPublishPages`) does not lay overrides over its pages, so a revise
  publishes the machine translation until the next edit. **Fixed in the follow-up:** the revise reads `langOverrides` with the config and the fold lays them over each language's pages (never into the cache), as `recompileAndPublish` does (red first: `decide-all-writers`).
- **Media adopt (20) vs picture attachments (22).** Adopt moves only video and
  audio chips; picture parts carry images on the job. **Fixed:** with one busy
  state per project (32), a move that lands after the owner opened another
  project skipped the resend silently; it now says so (red first:
  `decide-media` "a move that lands after the owner opened another project").
  **Found, then fixed in the follow-up:** `siteMediaMoving` is a set of project ids, so a move out in one project never holds another's Send.
- **Operator gate (sec-12) vs the job probe.** `/api/site/job-probe`,
  `/api/_slow`, `/api/_hold`, `/api/_egress` all gate through
  `operatorRefusal`; no merged branch adds a probe or `/api/_` route. The only
  new owner routes are `media/adopt` and `export`, both in the owner dispatch.

## Customer replies from facts (the owner's rule, added to this branch's scope)

Production runs `MODEL_REPLIES=on`. Each new customer sentence the merged
branches added was checked; where it reaches a reply writer, the answer now
carries structured facts (`refusal.code` with its numbers, pages, codes; each
language by English name with its tag) and `builder/site-reply.mjs`
(`refusalFacts`, `langFacts`, `languageNamed`, and in `buildReplyFacts`) turns
them into the writer's facts. The fixed sentence stays only as the existing
fallback when no reply is written.

| Message | How it is produced now |
|---|---|
| Out of credits at filing (6) | `refusal: {code:"out-of-credits", floor}`; routing route already through `withModelReply` (`routeReplyFacts`); edit and add-on 402s now wrapped in `withModelReply`; the page shows the written reply first |
| Stop pressed mid-build, free / refund short (money-8) | `buildFacts.failure.kind "stopped"`, narrated (`narrateBuild`); the page's `buildFailureView` leads with the reply |
| New site name too long (14) | `refusal: {code:"name-too-long", chars, max, suggested}` in `buildFacts`, narrated; `buildFailureView` shows the reply, `msg` only as fallback |
| Logo placed / not placed (23) | `buildFacts.ownLogo {placed, name, reason}`; `contextNote` is shown only when no reply was written (existing `buildToldLines` rule) |
| Menu change for a page the site lacks / with no menu (24) | `refusal: {code:"menu-page-unknown"/"menu-no-menu", pages}` from `runNavEdit`, passed by the route; edit reply facts |
| "Forget the old address" refused while QR codes open it (25) | `refusal: {code:"qr-forget-blocked", host, codes}`; edit reply facts |
| Translation stuck / behind / failed (9) | `langs` outcomes read by `langFacts`, by language name |
| Owner's translated wording kept / its source changed (31) | `langOverride {tag, changed}` and new `langStale {tag: [sources]}`; `langFacts` |
| Checkpoint refused (request part) | already facts (`requestReplyFacts`, `checkpoint-refused`); unchanged |
| Publish refused while offline (10) | **Done (follow-up).** The route tells the refusal to the Publish talk writer (`actionTalk`, `writeProgress`) from `actionFacts("publish","offline")`; `talk.end` now answers the line it wrote, and the route waits for it (up to `OFFLINE_REPLY_WAIT_MS`, 9 s) and answers it as `reply`. The panel shows `reply` first; `OFFLINE_PUBLISH_REFUSAL` is shown only when no line was written (talk off, no id, writer failed) |
| Read-widening question (sec-3) | **Done (follow-up).** Each widening now carries `from` (who sees it now); `wideningFacts` (table, now, after, the options) goes to `wideningQuestion`, the same writer and budget as the repeated-question note (`writeReply`, quick model, 240 chars). The two answers stay the step's structured `options`; `wideningAsk`'s text is kept only when no question is written |
| Draft media move failures (20) and the "files are now in that site's library" toast | **Done (follow-up).** The words go with the move (`request`); a file left behind is told by the edit reply writer (`writeModelReply("edit", …)`, one cheap call, only when something is left behind) from `refusal {code:"media-unmoved", files:[{name, why}], moved, again}`, answered as `reply` and shown in place of `SiteMedia.adopt`'s sentence (now the fallback); the words go back in the box. **The toast is removed**: a move that lands after another project was opened puts the words back into that project's own box beside its (now library) files, so its own edit reply tells what was done with them |
| Missed-notification line (33) | an email body built by the site's own notifier template (`submissionEmail` in `site-notify.mjs`), with no model; templated by design. Reported, unchanged |
| Offline-abandoned publication | an internal journal state (`abandoned: "offline"`), never shown to the customer |

No emoji prefixes added. Guard tests: `test/decide-all-replies.test.mjs`
(8 cases: every decided code has facts and the step's sentence is not quoted
in its place; the three routes; the floor's code; translations by language
name; the build's stop, name and logo; the wiring through the server and the
page). Red: the file fails on the merged tree before the change (the exports
do not exist). Sweep: 11 of 11 mutants killed, the comment-only control
survived.

## The follow-up (2026-10-23, later): the last four paths, the overrides, the media flag

The owner wants no fixed customer message at all, so the three rows left for
the owner above are now done (each row says how), and the two backlog items
are fixed. Guard tests: `test/decide-all-writers.test.mjs` (10 cases: the
facts reach the writer and the code's sentence is not handed over as them;
each route and page is wired; the fallback is reached only without a written
line; the overrides on the revise; the per-project flag). Red: all 10 fail on
`c0a47034a`'s sources. Sweep: 11 of 11 mutants killed, the comment-only
control survived. Updated guards: `decide-media` (the held move's words go
back to their own project, no fixed toast), `decide-all-replies` (the new
`media-unmoved` code), `rules-widening` (the landmark), `progress-more` (the
talk's no-op `end` answers an empty line).

Full suite after the follow-up (measured): `12304 / 12299 / 2 / 3`. The two
failures are `no-generated-deps` (the linked `node_modules`, as always here)
and `media-verify`'s browser mode, which passed 11 of 11 run alone right after
(timing under the full run's load; it touches none of this change). An earlier
run while the disk was full timed out 13 browser cases, which all passed run
alone (14 of 14).

## The suite

Run from the worktree (world-readable), `node --test "test/*.test.mjs"`, with
`node_modules` linked in. Measured after each run:

- Merged tree, before fixes: `12285 / 12268 / 14 / 3` (tests / pass / fail /
  skipped).
- After the merge fixes: `12286 / 12281 / 2 / 3`: `no-generated-deps` (the
  `node_modules` symlink, environmental, as on every branch here) and SB1's
  toast race (fixed after).
- Final: see the end of this file.

## The container image

Predicted with `containerInputs`/`imageId` over git objects at each end:
`origin/main` `ebfbd45c42ea43ac` (225 inputs, 193 paths); see the end of this
file for the new head. `AppBuildContainer` is unchanged (`65022ce71e3d7274`).
The image rolls (other's `lang-override.mjs` is a new COPY input, and builder
modules changed).

## Final readings (measured after the runs)

- Full suite on the code of `decide-all` (commit after the replies change):
  `12294 / 12290 / 1 / 3`; the one failure is `no-generated-deps` (the linked
  `node_modules`, environmental, fails the same on every tree here).
- Image prediction: `SiteBuildContainer` `ebfbd45c42ea43ac` (origin/main, 225
  inputs, 193 paths) → `695e09e12f6cedb3` (decide-all, 226 inputs, 194
  paths): it rolls. `AppBuildContainer` `65022ce71e3d7274` both ends (reused).

- After the follow-up (`b8db3e5cc`): `SiteBuildContainer` `145239c1c143183b` (226 inputs, 194 paths; the builder modules changed), against `695e09e12f6cedb3` at `c0a47034a` and `ebfbd45c42ea43ac` on origin/main (both re-read the same way to check the method). `AppBuildContainer` `65022ce71e3d7274` at every end (reused).
