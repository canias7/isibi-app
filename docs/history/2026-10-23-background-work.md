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

- Appending a change to the live request: it runs as a new request instead.
- Standalone jobs (request flow off) are not listed in the panel and keep the box's Stop.
- "Next" names only what a part waits for inside its own request. A part from another request waiting on the site lock shows "Next".
