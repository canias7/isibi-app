# 2026-10-24 — The first build in the background panel, with a real Stop (branch `build-panel-stop`)

From `origin/main` `692087cde`. Not merged, not deployed. Nothing spent, no model called, no live write.

## 1. The question first: does a build keep running and charging after Stop today?

**Yes, verified offline.**
- **The page.** On `main`, Stop on a first build only aborts the browser's own request and follow (`siteStop`, the `AbortError` branch in `reactSend`: "■ Stopped. (A build already running may still finish server-side.)"). The page has no call that tells the server to stop a build. `DELETE /api/site/edit/<id>` is called only for standalone job cards, and a build is never one of those.
- **Queued builds.** These already check for a Stop at every stage boundary (S3-4, 2026-10-23, `test/build-stop-midway.test.mjs`): the row's `edit_beat` answers `cancel`, and every debit is reversed. But no page ever marked the row, so the check never fired.
- **Inline fallback builds** (the queue could not take the job). These had no check at all. Red run on `main`: with the row marked cancelled before the design step, the inline build answered **200**, ran the design call and went on to publish. Its stage boundaries were read **0** times.
- So after Stop, a build ran to its end. It published and was charged: the deposit, the settlement and the pages.

## 2. What changed

**Server (`worker.js`)**
- **New `POST /api/site/build-stop`**, taking `{ job }` or `{ chat }`.
  - It marks the build's row cancelled through `edit_cancel`, scoped to the caller's own id.
  - When the page has no job id, the build is found through the account's own chat claim. An ended claim, a missing claim or a bad id finds nothing (404).
  - Too late answers 409 `too-late`. Signed out answers 401.
- **Inline fallback builds now check for a Stop too.** `enqueueSiteBuild`'s `inline()` hands back a `stopCheck` that reads the held row's `edit_beat`. The route passes it to `runSiteBuild`, so the same gates run: design, provision, generate and publish.
  - A Stop reverses every ref (`refundBuildByRef`, reason `cancelled`), publishes nothing, and answers 410 `cancelled`.
  - The reply is written by `narrateBuild` from the facts (`buildFacts` failure `stopped`, cost 0). `STOPPED_FREE_MSG` / `STOPPED_SHORT_MSG` are used only when the writer cannot be reached.
  - With no held row there is no check, and the build runs as before.

**Page (`public/chat.js`)**
- **A running first build is a row in the panel** (`site.buildJob`, plus `siteBuildJob*`).
  - The row is created by the build's 202 `accepted`/`resuming` (`reactSend`), and ended by its final answer.
  - Title: the model's own first progress line. "Building your site" is shown until the model writes one.
  - Row line: the newest progress line.
  - Job view: "You asked", every line, the Stop button, then after the end the build's own reply (and Show me when it is done).
  - States: run, stopping ("Stopping…"), stopped ("Stopped · when"), done, and didn't finish. A finished row drops off after the usual 5 minutes.
- **Stop is now the server's.** The panel Stop, Stop all and the box's Stop on a first build all post `/api/site/build-stop`. The page keeps following until the build's own 410 answer arrives; the chat shows that reply, and the row shows Stopped.
  - With no job id, the page sends the chat id instead. Only when the server knows no build for it does the page abort its own send, as before.
  - Too late, or a failed stop, is shown in a toast, and the row goes back to running.
- **The box keeps Send while the build is listed.** A message sent then stays in the box, and a toast says the site is still being built, so it can be sent once the build is done. Nothing is lost and nothing is sent.
- **Reload or another device.** `site.buildJob` is kept on the project, and `/api/site/builds` (server state) finds a running build and follows it through the same `reactSend` path, which creates the row again. The screenshots were taken through exactly that path.

## 3. Proof

- **New tests: `test/build-panel-stop.test.mjs`, 13 cases.**
  - PANEL ×6: the row follows progress, the Stop post, the chat fallback, too-late and failure, the stopped reply and reload, the wiring.
  - ROUTE ×3.
  - INLINE ×4: the control; a Stop before the design and after the design, each with refunds, no publish and cost 0; the facts the reply is written from.
  - Queued builds stay proven by `build-stop-midway` (7 cases, green).
- **Red check on `origin/main`: 13 of 13 fail.** The inline control's failure on main is itself the finding: 0 beats.
- **Mutation sweep: 20 of 20 mutants killed, and both comment-only controls survived.** It was run twice, the second time after the last code change. Files were restored from saved copies.
- **Full unit suite:** see §5.
- **Screenshots** are in `/tmp/claude-0/-home-user-isibi-app/e771e2f3-3497-5a41-86e7-3125c5cae122/scratchpad/shots-buildpanel/`: `1-panel-running-build.png`, `2-build-job-view.png`, `3-stopping.png`, `4-after-stop.png`. They show the real `public/` in Chromium with supplied server answers.

## 4. Limits and overlaps

- **Revise is not covered.** A revise (`/api/site/react-revise`) still holds its POST open with no early job id, so it has no panel row and no server Stop yet. That overlaps `rebuild-scope`.
- **The lines appear twice while the build runs**: the build's live steps are still drawn on the thread as well as in the panel. Hiding them, as a request's card is hidden, was left out to keep the change small.
- **Overlaps with other branches**: `first-build-uncapped` and `build-reply-bubble` (`reactSend`), `progress-voice-2` (progress lines), and `build-questions` (the first-build send path). The changes here are additive and placed beside those spots.

## 5. Suite and image

- **Full unit suite** (run from this worktree, a world-readable path, with `node_modules` linked and the link removed before the commit): `12471 / 12464 / 4 / 3`.
  - **1 failure was ours.** `site-chat`'s count of places that read the chat id went from 5 to 6, because the stop route reads it through `cleanChatId`. The guard was updated to name the new reader, and the file now passes 21 of 21.
  - **3 failures come from this environment**, not the change: `canary-reopen-browser` REOPEN 1 (it fails the same way on `origin/main`, re-run alone), media-verify's browser mode, and the no-generated-deps symlink case.
- **Image prediction** (`containerInputs`/`imageId`, over both ends): the site image `0bae00a7003bcc23` (main) → `e9c36f5bd0aa464d` (head), 231 inputs, because `worker.js` moved; the app image `65022ce71e3d7274` is unchanged.
