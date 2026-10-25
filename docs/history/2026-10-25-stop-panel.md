# 2026-10-25 — Stop is never nowhere (branch `fix-stop-panel`, not merged, not deployed)

From `origin/main` `c985956c0`. Nothing spent: no model call, no paid run, no live read or write.

## The live report (2026-10-24)

One multi-part add-on message became 30+ server-side part jobs that ran and charged for about 15 minutes. The builder page showed no "tasks in progress" pill and no Stop button the whole time.

## What was found (offline, from the code)

The box gives its Stop to the panel while a request runs (`siteComposerStops` returns false for `kind === 'request'`). Three gaps let Stop end up nowhere:

1. **The panel and the box found requests only by their card on the thread.** `siteBgItems` and `siteRunningWork` both walked `site.msgs` for `m.request`. The request's own record (`site.requests[key]`, kept two days) was read only through a card. A request's parts write their replies to the thread one by one, the browser keeps only the last 40 messages (`sitesSave`), and a chat read back from the server replaces the thread whole (`chatAdopt`). Once the card is gone, the panel lists nothing, and the box shows Send unless this page's own send is in flight. Nothing on the page could stop the request.
2. **A live request whose parts could not be read** (`parts: []`) counted as running in `siteRunningWork` (cannot-tell is never idle), so the box gave up Stop. `siteBgItems` skipped it, so the panel had no row either.
3. **A second Stop did nothing on the server.** `stopRequest` broke out as soon as `rec.stop` was set, so if the first press's `edit_cancel` failed, or a job was filed beside it, pressing again never asked the live jobs to cancel.

Not proven: which of these the live session hit. Its browser state was not read, and reading it is not allowed. Gap 1 fits the report: 30+ parts, each writing replies, against a 40-message thread.

## The fix

- `public/chat.js`
  - New `siteReqKeys(site)`: every request this page knows. First each card on the thread, in thread order; then each kept request record whose card is not there, ordered by the server's `at`.
  - `siteBgItems` and `siteRunningWork` both read `siteReqKeys`, so a request with no card still lists every queued or running part as a row, with its Stop and Stop all.
  - A live request with no readable parts gets one row, "Your request" (`n: -1`, `whole`). Its Stop calls the request's own stop (`siteRequestStop`, `DELETE /api/site/request/<slug>/<key>`), never a per-part stop.
  - `siteComposerStops`: the box gives Stop to the panel only while the panel lists that request with work left. Otherwise the box keeps Stop, and pressing it stops the request (`siteStopWork` → `siteRequestStop`).
- `worker.js` `stopRequest`: on a request already stopped and not ended, a second Stop sends `edit_cancel` again for every live job (and a recorded rewrite's key), with no second record write.
- Routes reused, none added: `DELETE /api/site/request/<slug>/<key>` (whole request) and `POST …/stop {part}` (one part), both through `edit_cancel`.

Nothing restyled: the rows, the pill and the panel are the existing ones.

## Evidence

- `test/stop-panel.test.mjs`, 4 cases:
  - **K**: a card off the thread, 32 parts (2 done, 4 running, 26 waiting): the pill reads "30 tasks in progress", the panel has 4 running rows and 26 waiting rows, Stop all stops the request, and a running part has its own Stop.
  - **W**: a live request with no parts shows one row, and its Stop stops the whole request.
  - **B**: the box keeps Stop when the panel cannot list the running request, and that Stop stops it.
  - **SV**: through the real routes, a second DELETE sends `edit_cancel` again for the live job.
- Red check: on `origin/main`'s `chat.js` and `worker.js`, all 4 fail. A stub `siteReqKeys` was added for this check only, so the harness could load.
- Two harness lists gained `siteReqKeys`, the new helper the cut functions call: `test/background-work.test.mjs` and `test/build-panel-stop.test.mjs`. Nothing else in them changed. Those files plus `site-busy-origin`: 32 / 32.
- Sweep: 6 of 6 mutants killed, and the comment-only control survived. The mutants: the records loop, the whole-request row, the box's request rule, the whole row's Stop, `siteRunningWork` reading cards only, and the server's second Stop.
- Screenshots (headless Chromium, the real `styles.css`; the scenario is a 32-part request whose card is off the thread): before, no pill and Send only; after, the pill "30 tasks in progress ▾", and when opened, "32 tasks · 4 in progress · Stop all".
- Full suite `node --test "test/*.test.mjs"`: **12743 / 12738 / 2 / 3**. The two failures come from this machine, not from the change: `node-modules-symlink` (the worktree links `node_modules`) and `canary-reopen-browser`. The same two fail on main here (diagnosis-view record: 12,739, 2 fail). The total is 4 above main: the 4 new cases.
