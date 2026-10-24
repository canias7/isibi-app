# 2026-10-24: the first build asks and suggests as edits do

Branch `build-questions`, from `origin/main` (`692087cde`). Not merged and not deployed. Nothing paid, no real model calls (every model answer in the tests is supplied), no live writes.

## What the owner asked for

Give the first build the same question and suggestion behaviour edits have. The parity audit found three gaps:

1. The build's page writer was sent its tool **without** the shared question field (`QUESTION_FIELD`), while the edit's page writer and the add-on's writer had it.
2. A build's question lived only in the browser (`s.clarify`), so it did not work on another device, never expired and was never closed on the server.
3. A build's reply (`narrateBuild`) and the security scan's words (`scanSay`) were not shown the suggestions already made in the chat (`recentSuggestedFor`), so a next step could repeat one.

## What changed

- `builder/page-gen.mjs`: `pagesRequest` and `generateSitePages` take `ask`. With `ask: true` the writer gets `SITE_PAGES_TOOL_ASK`; a revise and every other caller get the tool they always did, byte for byte.
- `builder/page-bands.mjs`: `BAND_TOOL_ASK` (the band tool with the shared field). On a first build the band writers and the header and footer writers get it when the route says the build may ask (`ask`); a part never does. **One question per build**: when writers ask, the first one in page order (bands, then the header and footer) is the question, and nothing of the fan-out is assembled.
- `builder/publish-pages.mjs`: a generation that asks stops right after the call, before anything is kept, compiled, published or charged (`stage: "question"`, `charged: false`).
- `worker.js`
  - The build route offers the question only on a first build that carries no answer yet and was not sent with `noAsk` (`askPages`, kept on the resume record so a collected answer is read with the tool it was sent).
  - On a question: every debit the build made is given back (`refundFields`, the inline route; `refundBuildByRef`, the resume), so the build charges nothing, as the design question. The answer is `intent: "clarify"`, `stage: "pages"`, with the model's own words and options.
  - The question is stored on the server with `packAsk` and `storeAskIfFree`: stage `route`, round 1, the customer's brief as the request, `by: "build:pages"`, under the slug the design chose. Its id goes back as `question.id`, with `askSlug`. A question that cannot be stored is still asked, from the browser's round, as before; one that cannot be shown is refused as ours (`ask-unusable`, 503, nothing charged).
  - The router's answer path (`/api/site/route`) now takes an answer naming that question from a project with no site yet (`rBuildAsk`): the same checks as a site's question (this owner's, pending, within 24 hours, closed once with a conditional write) and only for a question a build's writer asked. Since a first build's router is not sent the live tool (it has no `answered` field), an answer is read as the round's answer unless the router answers it as conversation, which leaves the question waiting. The answer carries `ask.answered` and the brief back as `instruction`.
  - `narrateBuild` takes `uid` and `chat`, reads `recentSuggestedFor` and passes `recent` and `offMenu` to `replyContext`, as `composeModelReply` does. Every build call site passes them; a queued build keeps its chat on the resume record (`replyChat`). `scanSay` passes `recent` for the offer and the report.
- `public/chat.js`
  - `designQuestion` accepts `stage: "pages"` as well as `"design"`, and reads the kept id and slug.
  - The round keeps `askId` and `askSlug`. The answer is routed with `ask: { id, chosen }` and that slug; the build runs with the brief the server sends back.
  - A kept question that is no longer live (answered on another device, or expired) builds nothing: the route's sentence is shown and the round ends.
  - "Skip, just build it" sends `noAsk`, so a skipped round never comes back.
  - The security offer and the report send the chat's key.

## Limits

- **Shown with supplied model answers only.** Whether a real writer asks a good question, and only when it should, is a live measurement not made here.
- A build that asks has already settled its design and, when tables were declared, made its database and claimed its slug. The design and the database are kept; the money is all given back. The answered build designs again from the brief and the answer.
- The band writers run together, so when one asks, the others' work is spent and thrown away (nothing is charged for it).
- A first build's router is not told the waiting question through the live tool. It reads the answer through the first build's own round (`answering`, the brief and the answers).

## Overlaps with other branches

- `first-build-uncapped`, `rebuild-scope` (gives the revise a question field), `build-reply-bubble`, `progress-voice-2`, the retries and the build panel branches all touch `worker.js`'s build route and `public/chat.js`'s build path. The likely textual clashes: `pagesRequest`'s tool line (rebuild-scope), the `buildArgs` object, the `designQuestion` reader and the round's `s.clarify`, and the `narrateBuild` signature.

## Evidence (stamped after the runs)

- **New tests**: `test/build-questions.test.mjs` (11 cases: the real `/api/site/react-build` route inline and queued through the resume, the band fan-out, the real `/api/site/route` answer path, `narrateBuild`'s reply request) and `test/pages-question-browser.test.mjs` (4 cases in a real Chromium). The fixtures `driveBuild` (`pages`) and `finishResume` (`given`) take a supplied page-writer answer.
- **Red check against `origin/main` (`692087cde`)**: 7 of the 11 node cases fail, and the 4 that pass are the controls (one question per build, `noAsk`, a writer that writes, no `ask`); all 4 browser cases fail there.
- **Sweep** (from a verified-green baseline, files restored from saved copies, nothing committed while it ran): 27 of 28 mutants killed; the comment-only control survived. The survivor removes `if (singleAnswer && singleAnswer.ask) return singleAnswer;`: `enforceFallbackFrame` already hands back an answer with no pages unchanged, so the line is a second guard.
- **Guards updated for real changes**: the refusal count in `test/credit-debit.test.mjs` (13 reversals that quote `refundFields`, 14 in all), the browser's routing-body reader in `test/canary-probes.test.mjs` (the build's claim needs `answering` and the round's id), the skip's body in `test/site-entry-inventory.test.mjs` (`noAsk: true`), and the one-call option literal in `test/written-frame-edit.test.mjs` and `test/written-frame-links.test.mjs` (`...pageAsk`).
- **Full suite** (world-readable path, `node_modules` linked, link removed before the commit): `12473 / 12468 / 2 / 3`. The two failures are environment-only and fail the same on `origin/main`: `a node_modules of any form is ignored` (the linked `node_modules` symlink) and `REOPEN 1` in `test/canary-reopen-browser.test.mjs`. On an earlier run under load, `media-verify`'s browser mode and `RC 12` failed too; both pass when run alone.
- **Screenshots**: `pages-question.png`, `pages-question-picked.png` and `pages-question-stale.png` (the session's scratchpad, `shots-buildq/`).
- **Image prediction** (main `692087cde` → this branch): the site image is rebuilt, `0bae00a7003bcc23` → `3e15efff67269b48` (231 inputs, 199 paths; the builder modules changed); the app image stays `65022ce71e3d7274`.
- Nothing paid, no model called, nothing live written.
