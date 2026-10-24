# 2026-10-24 — a first build's model-written reply goes in the bubble

Branch `build-reply-bubble` from `main` `692087cde`. Not merged, not deployed.
Nothing spent, no model called, no live write.

## 1. The problem (live, `driftwood-and-daughters`)

The reply writer's account of a finished build (`narrateBuild`,
`replySource: "model"`, read by `EditPoll.modelReply`) reached the page only
through `buildToldLines` → `noteShown` → the message's `note`, which is drawn
above the progress list. The bubble showed `said || canned`: the builder's
`notes`, or "Built “X”. Tell me what to change." The customer read the fixed
line and never the model's reply.

## 2. The change (`public/chat.js`, the finished-build branch of `reactSend`)

- The bubble is `modelSaid || said || canned`. `modelSaid` is the model reply
  only when the build was built (`page !== 'placeholder'`) and is not still
  being written (`firedJob`): a placeholder keeps its own line, and a build
  still running keeps the server's sentence.
- When the model reply is in the bubble, it is filtered out of the note; the
  money line and `tokensNote`/`styleNote`/`cssNote`/`keptNote`/`renderNote`/
  `builtNote` stay as before.
- With the writer unreachable (`replyState: "unavailable"`), `buildFactLines`
  now words `notBuilt` ("Asked for, not built yet (ask for it next): “…”") and
  `noDatabase` ("No database yet: …"). Before, both existed only inside
  `builder/site-reply.mjs`.
- Revise and queue/resume: the same branch serves both. A revise differs only
  in `canned`; a build followed through `followBuildJob` replaces `d` with the
  final answer, so its model reply lands in the bubble the same way. Only
  `firedJob` (the follow stopped before an answer) keeps `d.msg`. The revise
  path is covered by the shared code, not by its own browser case.

## 3. "This build made no database for the site": true

Supabase, non-secret columns only (2026-10-24): `site_backends` for
`driftwood-and-daughters` has a blank `neon_db` (read as a boolean), and
`site_builds.steps` record `provision {db: 0}`, `schema {tables: 0}`,
`seed {ms: 1}`. Those steps are written on every build (`tr.at("provision",
needsDb ? undefined : { db: 0 })`, worker.js); `db` stays `null` when the spec
declares no tables, and `noDatabase: !db` is correct. No fix needed.

## 4. Tests

`test/build-reply-bubble.test.mjs`, 5 cases in a real Chromium with the real
`public/chat.js` and supplied answers: the model reply is the bubble and not
in the note (other notes kept); it wins over `notes`; a placeholder never
shows it; writer unavailable lists left-out and no-database facts; control
with no reply keeps `notes`.

- Red check over `origin/main`'s `chat.js`: 3 fail, 2 pass (the placeholder
  case and the control, as they should).
- Sweep: 6 of 6 mutants killed, the comment-only control survived.
- Full suite: see §6.

## 5. Image

Only `public/chat.js`, a test and docs change; `public/chat.js` is not a
container input. Predicted unchanged on both ends: SiteBuildContainer
`0bae00a7003bcc23` (231 inputs), AppBuildContainer `65022ce71e3d7274` (9).

## 6. Full suite

`12463 / 12458 / 2 / 3` (tests / pass / fail / skipped), from this worktree
(world-readable) with `node_modules` linked. The two failures: the known
env-only `node_modules` symlink case (the link itself), and
`build-facts-browser`'s first case, which read the thread after a fixed
800 ms; with the reply now in the bubble, which reveals its words over time,
the long account was not finished. The test now waits for the whole account
(15 s cap); that file and the new one pass `17 / 17`.

Screenshots: `shots-reply/before/` and `shots-reply/after/` in the session
scratchpad (`model-reply.png`, `writer-unavailable.png`).
