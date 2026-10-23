# 2026-10-23 — the five decided fixes combined (`decide-combined`)

Branch `decide-combined`, from `origin/main` `a8fbfe876`, with one `git merge`
per branch, in this order:

| Branch | Head | What it is |
|---|---|---|
| `decide-sec-12` | `dfa3ee58a` | the probe routes answer only `OPERATOR_UIDS` (A16-7); a claiming write takes no query and an alias may not be another site's storage name (A16-4) |
| `decide-sec-3` | `f7bfe060c` | a rules change that widens a private table's read is a question unless the customer's own words ask for it (A29-9) |
| `decide-money-8` | `0fb1fa472` | a Stop pressed mid-build refuses the next stage and reverses every debit (S3-4, `STOPPED_FREE_MSG`) |
| `decide-money-5` | `40d97fc60` | the routing route keeps every answer under its request key and replays it free (A13-1) |
| `decide-money-6` | `c87f152fa` | paid queued work is refused at filing below 5 credits (A13-2, `FILING_REFUSAL_MSG`) |

Nothing paid, no model calls, no live writes. Not merged to `main`, not
deployed.

## Merges

All five merged with **no conflicts** (`worker.js` was touched by all five, in
separate places). No branch adds a new builder module: each changed module
(`job-gateway.mjs`, `site-rules.mjs`, `site-requirements.mjs`,
`build-lease.mjs`, `publish-pages.mjs`) already exists and is already in the
Dockerfile's COPY lines.

## Two guards re-anchored

`test/api-auth.test.mjs` ("every /api route requires a Supabase session")
went red on the combined tree, and is red on `decide-sec-12` alone (the same
code): the four probe routes now gate through `operatorRefusal`, which calls
`authUser` and `UNAUTHED` itself, but the guard's one-hop reader looks only at
callees named like handlers (`run…`, `handle…`, `do…`). The reader now also
looks at a helper named `…Refusal`; the helper must still gate within the same
window, so the name only lets it be read, it proves nothing by itself. 42 of 42
in that file.

`test/draft-first.test.mjs` DFB11 pinned `buildAndPublishPages`'s signature
ending at `held = null })`; `decide-money-8` added `stopCheck = null` after it
(red on that branch alone too). The pin now names `stopCheck = null`. 51 of 51.

## The review of the combined diff (interactions)

Read against `origin/main`, looking for the five fixes meeting each other:

- **Replay (5) and the filing floor (6) on the routing route.** The kept
  answer is read before the balance read and the floor, and only a 200 is kept
  (`keepRouteAnswer`), set only on the route's last `return`. The floor's 402
  returns earlier, so it is never kept: after a top-up the same message under
  the same key is routed again rather than refused from memory. That second
  routing call is charged again; this is consistent with a refused message
  doing nothing, and is noted, not changed. An accepted request is answered by
  the request flow's own idempotence, as before.
- **Replay (5) and a kept answer the client then acts on.** A kept answer
  whose intent is an edit or addition and that was not accepted on the route
  is acted on by the page posting to the edit or addon route, where the floor
  (6) applies; a replay cannot carry work past the floor.
- **Stop (8) and replay (5).** Different routes: the stop is on the queued
  build (`runQueuedSiteBuild`, `stopCheck` through the row's lease); the replay
  is the routing route. The stopped build answers 410 with `cancelled: true`
  and closes its row `cancelled` through `edit_refund`; no replay path stores
  it.
- **Stop (8) and the floor (6).** The floor guards filing of edits and
  additions; a build is not filed through it. No interaction.
- **The widening question (3) and the floor/replay.** The question is a step's
  ask on the edit path, at no cost; the replay digest includes the message's
  `ask`, so an answered question under the same key is a different message.
- **The operator gate (12).** Touches only the four probe routes. The edit
  canary's runtime line reads `/api/site/job-probe probe=env`, so a canary or
  probe press answers 403 until the owner sets the `OPERATOR_UIDS` secret to
  the pressing account's id (the branch's own record says so).

**Noted, not changed (kept separate):** with `MODEL_REPLIES` on,
`withModelReply` would write a model reply over the floor's 402 refusal on the
routing route, a model call the platform pays for an out-of-credits customer.
`MODEL_REPLIES` is off and model replies are parked, so this is a backlog
item, not a fix here.

No interaction defect was found, so no red test was added beyond the guard
re-anchor above.

## Full suite

`node --test "test/*.test.mjs"` from the worktree (world-readable path),
`node_modules` linked in, before the two re-anchors: **12198 tests / 12192
pass / 3 fail / 3 skipped** (682 s). The three: the two guards above and the
expected local-only `a node_modules of any form is ignored` (the symlink).
After the re-anchors both files were rerun: 93 of 93. Expected whole-suite
reading now 12198 / 12194 / 1 / 3 locally (not re-measured whole).

## Screenshots

The three new customer sentences, drawn in the site chat's own markup
(`.st-thread`, `.st-msg`, `sitePickHTML`'s card) with the real `styles.css`,
headless Chromium: the out-of-credits refusal, the read-widening question
(`wideningAsk` for a public `bookings`), and the stopped build.
