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
  publishes the machine translation until the next edit.
- **Media adopt (20) vs picture attachments (22).** Adopt moves only video and
  audio chips; picture parts carry images on the job. **Fixed:** with one busy
  state per project (32), a move that lands after the owner opened another
  project skipped the resend silently; it now says so (red first:
  `decide-media` "a move that lands after the owner opened another project").
  **Found, not fixed (backlog):** `siteMediaMoving` is page-wide.
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
| Publish refused while offline (10) | `refusal: {code:"site-offline"}` carried, and `refusalFacts` reads it; **but the Publish panel is a toast UI with no reply writer**, so the toast still shows the route's sentence. Left for the owner |
| Read-widening question (sec-3) | the question card's text is composed by code (`wideningAsk`, with the structured `widening` list); turning it into a model-written question needs a question-writing call. Left for the owner |
| Draft media move failures (20) and the new "files are now in that site's library" toast | browser toasts, no server reply on `media/adopt`; a written reply would be a model call per move. Left for the owner |
| Missed-notification line (33) | an email body built by the site's own notifier template (`submissionEmail` in `site-notify.mjs`), with no model; templated by design. Reported, unchanged |
| Offline-abandoned publication | an internal journal state (`abandoned: "offline"`), never shown to the customer |

No emoji prefixes added. Guard tests: `test/decide-all-replies.test.mjs`
(8 cases: every decided code has facts and the step's sentence is not quoted
in its place; the three routes; the floor's code; translations by language
name; the build's stop, name and logo; the wiring through the server and the
page). Red: the file fails on the merged tree before the change (the exports
do not exist). Sweep: 11 of 11 mutants killed, the comment-only control
survived.

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
