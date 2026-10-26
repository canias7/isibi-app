# 2026-10-26 — Out of credits during a running task: pause, not lose; the context ring

Branch `credit-pause-2` from `fix-run6` (`b336be4fd`). Owner-approved (2026-10-26),
variant C of the mock. Not merged, not deployed. Nothing spent: every model
answer in the tests is supplied.

## What changed

**A. Pause.** A later part of a running request whose job ends `ok: false`,
`error: "unbilled"`, `detail: "insufficient"`, with nothing of it left
standing, used to end through `endUnfinished` (failed, lost). `settle()` in
`builder/request.mjs` now gives it the non-terminal part status `credits`
(`why: "insufficient"`, `outcome.kind: "credits"`). It holds no job and no lease,
nothing was charged, `nextStep()` never picks it, and `settleState()` keeps the
request open with state `credits`. A request of one part keeps today's
behaviour (no running task to pause), and so does a new message sent with no
credits (refused at routing, before any request exists).

**Resume.** `advanceRequest` (worker.js) calls `creditsStep` on every step, so
the two-minute tick (`runRequestSweep`, which advances every unfinished
request) and every page look re-read the balance (`readCreditsFor`, the
service-role read of `credits.balance`). `creditsDecision` (pure):
- first reading: kept as `credits.base`;
- balance above the base (credits added by any route: top-up, upgrade, monthly
  grant): ticked → `resumeCredits` (paused parts back to `ready`, filed again by
  `nextStep` as any ready part); unticked → `credits.ready = true` only;
- balance below the base: the base follows it down.

**B. The checkbox.** "Continue when topped up" is `creditsAuto` on the request
record (absent = ticked). `POST /api/site/request/<slug>/<key>/credits`:
- `{ auto: true|false }` stores it (survives reloads and other tabs; the tick reads it);
- `{ resume: true }` is Continue: resumes only once credits were added
  (`credits.ready`, or a balance above the base), else 409 `no-credits`.
Stop: the existing stop loop cancels a paused part (it has no current job);
per-part Remove works the same way.

**C. UI (variant C).** `#stCredits` sits between the panel (`#stBg`) and the
box; `siteCreditsPaint` (called from `siteBgPaint`) draws the black `#111` bar:
coins icon, "Out of credits · N tasks paused", the checkbox, the white pill
"Add Credits" (opens `openCredits()`), or "Continue" once credits were added
with the box unticked. No ✕. The pill reads "N tasks waiting for credits". After
a resume (`creditsResumedAt` in the view) the bar shows "Credits added · picking
up where it stopped" for a minute. Fixed text, for this notice only.

**D. Context ring.** The "Context · this chat" line above the box is gone; the
same markup (`ctxChatHTML`, `ctxLineHTML`) is wrapped by `ctxRing` into a 22px
ring (track `#e5e5e5`, fill `#111`, as the mock) in `.st-comp-row` just left of
Send/Stop. Hover, focus or a tap (`ctxOpen`, `wireCtxLine` unchanged) shows the
same details: percent, used / total, legend, note, the compaction mark.

## Tests

- `test/credit-pause.test.mjs` (5, the real Worker over `test/fixtures/request-flow.mjs`):
  CP1 paused not lost; CP2 ticked + credits added → the tick resumes, the request finishes;
  CP3 unticked + credits added → never resumes over four ticks, the view says ready,
  Continue before credits is 409, pressing Continue resumes and finishes;
  CP4 Stop cancels a paused part, nothing charged; CP5 the pure decision.
- `test/credit-pause-browser.test.mjs` (1, real Chromium): the bar's text, black, attached
  to the box at its width, ticked by default, no close; the pill; Add Credits opens the
  credits overlay; unticking posts `{ auto: false }`; a reload in a fresh browser reads the
  tick from the server; Continue replaces Add Credits and posts `{ resume: true }`; the
  resume line; the ring just left of Send, its hover details.
- `test/model-context.test.mjs`: the placement guard now requires the ring before Send and
  the line gone from above the box.
- Red check: with the source changes removed, both new files fail.
- Sweep: 7 of 7 mutants killed (no pause in settle, tick ignored, the tick never resumes,
  the route drops `auto`, Continue without credits, the pill text, Continue never shown);
  the comment-only control survived.

Screenshots (scratchpad, `credit-pause/`): `1-paused-ticked.png`, `1-paused-ticked-full.png`,
`2-paused-unticked.png`, `3-topped-up-unticked-continue.png`, `4-resumed.png`,
`5-context-ring-hover.png`.

## Limits

- The resume test is "balance rose above the reading taken while paused", not "enough for
  the part": a part that is still short is refused again and pauses again, at no cost.
- The check runs on the request sweep's tick (every unfinished request, 100 per tick by
  cursor), not as a separate step beside `runProviderWaits`.
