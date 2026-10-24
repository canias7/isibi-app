# Background work: keep chatting while the builder works (2026-10-23)

Branch `background-work`, from `origin/main` `6b980ae15`. Plan:
`docs/plans/2026-10-23-background-work.md`; approved mock (option A, the pill):
`docs/plans/2026-10-23-background-work-mock.html`. Nothing paid, no model
calls, no live writes, not merged.

## 1. Step 1: what made the composer "busy" (read-only check, before any change)

- **The Stop/Send swap** (`public/chat.js`, the rail's composer row, about line
  9272): `siteBusyHere(site) || siteRunningWork(site)` drew **Stop** (`#stStop`)
  in place of Send. `siteRunningWork` is true while any request on the thread
  has a part `ready/queued/started/unverified/recovering/uncertain`
  (`siteRequestWorking`; fix-edit-flow already excludes parts waiting on the
  customer) or a standalone job card is queued/running. So for a request's
  whole run the box had no Send button, and Enter went nowhere
  (`ta.onkeydown` calls `sendBtn.onclick`, and there was no `sendBtn`).
- **`siteBusy` / the per-project slots** (`siteBusyBegin`/`siteBusyEnd`,
  `siteSlots`): set from Send until the routing answer comes back (or a build
  ends). A request accepted by the route ends it; the request then runs on its
  own polling (`siteRequestFollow`). So `siteBusy` holds the composer only for
  the routing call (and a first build/revise), not for the request.
- **`wireSiteComposer`'s Enter handler** refuses while `siteBusy` (the routing
  call), keeping the words in the box; it blocks nothing else.
- **`siteSend` while a request is live**: nothing special. A waiting question
  makes the message its answer (`site.ask`); otherwise it is routed like any
  message under its own key (`siteMessageKey`), so a change becomes a **new
  request** and a question gets the router's `ask` answer.
- **Server, `POST /api/site/route`**: it does not look at other live requests.
  Each message is its own request (keyed by `idem`); `intent: "ask"` is answered
  at once (the conversation writer `converse`, else the router's own answer)
  and touches no request or job. A change creates a new request that runs
  alongside. `builder/request.mjs` keeps one job of a request live at a time,
  and the site's lock (the job runner's lease) keeps writes sequential across
  requests, so a second request's write waits for the first's.
- **No per-part stop existed.** `DELETE /api/site/request/<slug>/<key>` stops the
  whole request (`stopRequest`: `rec.stop`, then `edit_cancel` of the live
  jobs); `DELETE /api/site/edit/<id>` stops one standalone job.
- **Appending to a live request** does not exist (`planParts`/`carveParts` only
  carve from the request's own message); a new request beside it is what the
  route already does, so that is the path used here.

## 2. What changed

- **Composer** (`public/chat.js`): `siteComposerStops(site)` decides the button. It shows Send while a request has work running. Stop shows only for this project's own send in flight with nothing in the panel (a first build), or a standalone job. Enter sends.
- **Pill and panel** (`siteBg*` in `public/chat.js`, `.st-bg-*` in `public/styles.css`, greys only, the parallel card's dots):
  - "N things in progress ▾" opens the panel: "N things · K in progress", Stop all, ▴.
  - Rows show the state dot (`siteParState`), the model's title, and one line. A working row shows its newest progress line. A next row shows "Next — after <title>", from `siteParTag`'s "waiting for". A done row shows "Saved as draft · <time>" and drops off after `SITE_BG_KEEP_MS` (5 min).
  - A row opens the job view: the fixed bar (‹ Back · name · Stop / Remove), "You asked", every line, then the reply with Show me (the part's `page`) or the not-done line with Try again (its words sent with `leaveDraft`).
  - The panel's `max-height` is 45vh. The list and the job view scroll in `.st-bg-scroll`. A working job follows its newest line unless scrolled up, then "↓ new" appears.
- **Reload**: `siteParSnap` keeps a snapshot for single-part requests too (the parallel card still needs 2 or more parts). Request state and `doneAt` live with `site.requests`.
- **Server**:
  - `stopPart`, `stoppedPart` and `partJobId` in `builder/request.mjs`. `nextStep` cancels a part named in `stopParts` as `stopped`.
  - `POST /api/site/request/<slug>/<key>/stop {part}` in `worker.js` (`stopRequestPart`). It records the stop on the etag, calls `edit_cancel` on the part's live job, then advances.
  - `requestView` now carries `page` for a done part.
- **A question** goes through the route's existing `intent: "ask"`. **A change** runs as a new request beside the live one. Writes still go one at a time under the site lock.

## 3. Tests

- `test/background-work.test.mjs` has 12 cases (C, P×2, J×3, S×2, R, SV×3). `test/background-work-browser.test.mjs` runs the real app in Chromium. Both are red on `origin/main`.
- Four existing guards were re-anchored to the new intent: `model-context` (the pill sits between the context line and the box), `parallel-card` (a single part now keeps a snapshot), `site-busy-origin` (`siteComposerStops`), and `site-entry-inventory` (two Try again sends).
- Sweep: 18 of 18 mutants killed. Mutant 8 was re-run by hand with a unique anchor. The comment-only control survived.
- Full suite: `12416 / 12412 / 1 / 3`. The only failure is the environment's node_modules symlink case.
- Screenshots (real chat.js and styles.css): `shots-bg/` in the session scratchpad.

## 4. Not done

- ~~Appending a change to the live request~~: done in §5.
- Standalone jobs (request flow off) are not listed in the panel and keep the box's Stop.
- "Next — after <title>" names what a part waits for (`needs`). A joined part that needs nothing still runs after the request's earlier parts (one job at a time), and its row says only "Next". A part from another request waiting on the site lock shows "Next".

## 5. The owner's three fixes (same branch, ordinary commit)

- **A change sent while a request runs joins it** (`appendParts` in `builder/request.mjs`; `joinLiveRequest` in `worker.js`, called from `acceptRequest`).
  - The route reads the owner's live markers for the site (`requests-live/<slug>/`). It takes the newest request that has not ended or stopped, plans the message as any message (`planParts` with its routing answer), and numbers the new parts after the ones there.
  - The message is appended to the request's `message`, so a later carve finds its words. `inferNeeds` then runs over all the parts. The parts already there keep their own `needs`, `held` and parents. A new answered part that now waits is routed again on its turn, as `planParts` does for part 0.
  - The record is written on its etag (4 tries). It records `joined: [{ key, at, parts }]`, and each new part carries `joined: <message key>`.
  - Idempotent on the message key: a key already joined to any live request answers that request (`duplicate`), and a key that is a request of its own goes through the acceptance as before.
  - Only the routing route joins (`acceptRequest`'s `join`). An addition posted straight to the add-on route (`addonAsRequest`) is still a request of its own.
  - Not joined: an answer to a question, a message carrying files (a request's files are kept under its own key), and a request that ended or stopped between the read and the write. Those messages are taken on as a request of their own.
  - A change typed beside a waiting question still closes that question as replaced. Joined to the waiting request, it lets the request's step offer the same question again in the same call.
  - The reply carries `request` (the live request's view) and `joined`. The page already follows that request by its key, so the new rows appear in the same panel.
- **No duplicate display** (`siteBgHolds`, `siteReqCardHTML`, `siteReqCardShows` in `public/chat.js`; `.st-msg[hidden], .st-bg-held[hidden]` in `public/styles.css`).
  - While the panel lists any of a request's parts, or once the request has ended, its card's part list is not drawn on the thread. The thread keeps the model's opening line, the waiting question box, and the request's model-written summary.
  - A single-part request's status card is not drawn; its part's own reply stays on the thread. A card message that shows nothing is drawn `hidden`. A reload reads the same rule from the snapshot (`rq`).
  - **The part list is kept in the page, hidden** (`<div class="st-bg-held" hidden>`), not dropped. The UI canary's reader (`scripts/canary-ui.mjs`, about line 3039) and the browser guards that read cards (`progress-browser`, `preview-keep-browser`) read `.st-req`/`.st-par` parts from the page. Hidden, nothing of the card is shown, and those readers still find it. Moving the canary's reader to the panel is not done.
  - The full card is still drawn for a request the panel does not hold (one stopped with parts left).
- **The panel kept across a reload** (`siteBgState`, `siteBgKeep`): open or closed and the job view shown, per project, in `sessionStorage` (`gf.bgPanel.<site id>`). Every read and write is in try/catch, so blocked storage leaves the panel closed, as before. A job not listed yet after a reload shows the list and keeps the choice.

### Tests (§5)

- `test/background-work.test.mjs`, 16 cases (+4, one rewritten):
  - **SV-join** drives the real `/api/site/route` twice. The second change joins the first request: no record under its own key, part 1 has its words and `joined`, and part 0 is unchanged. A retry under the same key adds nothing. Both parts finish done.
  - **SV-needs**: a joined change reading `page:/gallery`, which the running part creates, waits for it (`needs [0]`, `blocked`, in the view too). After the request ends, the next change is its own request.
  - **SV-append**: `appendParts`' numbering, the old parts' needs, carving and parent kept, idempotence, and an ended or stopped request refused.
  - **D**: the card is not drawn while listed, only the opening line. Once the request has ended and left the panel, only the summary shows, and the same after a reload.
  - **K**: open and job kept per project, and storage that throws.
- `test/background-work-browser.test.mjs` (real Chromium, real `chat.js`/`styles.css`), checked in the browser:
  - no `.st-par`/`.st-req` on the thread beside the panel, and the opening line kept;
  - a reload reopens the job view, and a closed panel stays closed;
  - a second case shows a joined change as one more row, "Next — after Bookshop page", with no second card.
- `test/parallel-card.test.mjs`: its harness stubs `siteBgHolds` to false, to keep testing the card renderer itself.
- Re-anchored to joining:
  - `parallel-requests` XR: its second message carries a file, so it stays the second request this guard is about.
  - `request-reply-placement` PLACE 5: the message sent after the reload joins the first request, and its replies and the request's own reply go with it.
  - `request-reply-placement` PLACE 11: the replaced question is offered again by the joined request's step, the same one, pending.
- **Red check** on `aa5edf8e5`'s `chat.js`, `request.mjs` and `worker.js` (missing functions cut as empty): D, K, SV-join, SV-needs and SV-append fail, and the 11 earlier cases pass. Both browser cases fail.
- **Sweep**: 15 of 15 mutants killed (appendParts ×6, worker ×3, chat ×6), restored from saved copies each time. The comment-only control survived.
- **Full suite**: `12421 / 12414 / 4 / 3` on the full run. Two of the four failures were source guards anchored on the assistant message's opening tag (`build-live-lines`, `reply-held-page`); both are re-anchored and pass. `canary-reopen-browser` REOPEN 1 passes alone (it timed out under the full run's load). The fourth is the environment's node_modules symlink case. So after the fixes: `12421 / 12417 / 1 / 3`, with only the environment failure (the two re-anchored files and the reopen file re-run, 29 / 29).
- Screenshots (real `chat.js` + `styles.css`), in `shots-bg/` in the session scratchpad: 1–4 re-rendered, plus `5-joined-change-next-after.png`.
- Image prediction: IMAGE_LINE

