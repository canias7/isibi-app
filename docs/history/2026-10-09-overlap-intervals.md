# Overlap by recorded intervals; the browser-closed press; no automatic restoration (2026-10-09)

Codex reviewed `ac24aece` (run 113's records and the scenario). This file
records what Codex found and what changed on the branch. Nothing is merged,
deployed or built. No paid call, no model call, no balance change and no live
database write were made.

## What Codex found

1. **`overlapVerdict` accepted status sampling.** It passed when a view showed
   a part `preparing` or `prepared` while another part was `queued` or
   `started`. Codex reproduced `ok: true` for `preparing` + `queued` and for
   `prepared` + `queued`. Neither shows two things running at once.
2. **Run 113's concurrency claim rested on that check.** Its job rows are
   sequential:
   - the price `251047…` 14:56:27–14:57:56;
   - the heading `ff717ac8…` 14:58:55–15:02:37;
   - the footer's menu step `c6cb6e8b…` 15:03:34–15:07:05;
   - the routing, add-on and question jobs fell between them.

   No record shows when a preparation's step ran. The `edit_jobs` rows have
   no execution-start column, `edit_traces` names no job, and the request
   record kept no interval. **The claim is now unverified.**
3. **Removing the failed progress check did not meet the requirement.** The
   model-written progress checks and the browser-closed, fresh-session path
   were required.
4. **The press restored demo data automatically** (the focaccia put back).
5. **The handoff was stale.** It said nothing was deployed or tested live,
   beside a record of deploy 2189 and run 113.

## What changed

**Instrumentation (product code; it needs a deploy).** Existing timing
evidence is reused, and one interval is added:
- **A job's execution** is its progress record's own interval. The record
  opens when the job begins running (the recorder's `begin`) and closes at
  its end. `runsForRequest` (`worker.js`) reads it for each of a request's
  run jobs, only for the request's own account and only while
  `PROGRESS_REPLIES` is on.
- **A preparation's step** is new. `runRequestPrep` times the step's replay
  after the routing, from its first instant to its last, and counts its
  model calls. `notePrepared` keeps it on the part as `prep.step`, strictly
  read (`readPrepStep`). When only the routing ran, there is no step.
- **The request view** (`requestView`) serves `prepRun` (the attempt's
  start, end, outcome and step) and `runs` (each run job's `from` and `to`)
  on both of its routes: the single request and the site's list. Nothing
  else of the preparation record is served.

**The verdict (`scripts/canary-requests.mjs`).** `overlapVerdict` reads the
last view of the first message's request, across the press's steps. It
passes only when a part's prepared step with at least one model call
intersects **another** part's closed job interval, each beginning before the
other ended. These do not pass, each with its reason:
- a touching edge;
- an open job;
- routing alone (reported as `routingOnly`);
- a step with no model call;
- a part's own job;
- another request's view;
- missing records.

The press's verdict names the check *"a part's prepared step ran while
another part's job was executing, by their recorded intervals"*.

**The scenario (`lv-parallel`).**
- Message 2, the answer, is sent with its tab closed once a progress line
  shows live on the resumed part, and is followed to its end in a fresh
  browser session (`away: "fresh"`).
- `expect.progress` is restored.
- The focaccia's row is `restore: false`, so the press writes no row. The
  workflow form says so.
- **Fresh targets.** Run 113 kept YouTube in every footer and its Order
  heading, so a rerun as written would ask for what is already there. Read
  live (free GETs of `/` and `/order`) before the change: every footer links
  to Facebook, Instagram, TikTok and YouTube, none to LinkedIn, and
  `/order`'s heading reads *"Pick your loaf and a collection time"*. The
  messages are now:
  - *"Add a link to our LinkedIn page in the footer, change the Sea Salt
    Focaccia's price to £4.60, and change the Order page heading 'Pick your
    loaf and a collection time' to 'Choose a loaf and a time to collect
    it'."*;
  - then *"It's linkedin.com/company/harbourloaf"*.

  LinkedIn is one of the menu step's own networks. The focaccia reads 4.5,
  so its change is still fresh.

## Tests

- **`test/canary-parallel.test.mjs`**, 10 cases:
  - the scenario guard;
  - the positive verdict, and the five negatives Codex asked for: queued
    only, preparation done before the job started, sequential execution,
    routing only, and missing evidence (Codex's two status reproductions
    included);
  - the batch verdict;
  - **lv-parallel driven end to end, offline, through the real canary
    driver** (`runUi`). The footer link's question is on screen while the
    price's job runs and the heading is prepared, and message 1 ends on it
    once nothing else runs. The answer is sent with its tab closed after a
    live progress line, the list alone is read, and a fresh session signed
    in afresh follows it to its end. Every reply is recovered. The row
    shows the one expected change on both readers and on the page, and is
    kept with no write and no probe. The progress, reply and interval
    checks pass, and the money reconciles through `ownMoneyVerdict`
    (routing 3 + jobs 4 = 7);
  - the same press with the heading prepared only after the price's job,
    which fails the interval check and nothing else.
- **`test/parallel-intervals.test.mjs`**, 6 cases through the real Worker
  (`request-flow`, progress on):
  - P1's gated overlap gives a view with `prepRun.step` (one model call)
    inside part 0's run, and the verdict passes;
  - the same message delivered one after the other is refused;
  - P3's routing-only preparation inside a running job is refused as
    routing only;
  - progress off, and progress switched off after the records exist, serve
    no runs;
  - `readPrepStep` and `prepRunOf` accept only well-formed steps.
- **The fixture** `canary-rq-app` answers the site's own list read
  (`shownListInPage`) through a `shown` hook.

**Red check** (measured with the intervals file's first four cases): over
`ac24aece`'s code, all 10 cases of `canary-parallel.test.mjs` fail, and the
intervals file fails at import, because `readPrepStep` does not exist there.

**Sweep**: 22 product and scenario mutants, all killed, and the comment-only
control survived. Two survived the first pass: a malformed step accepted, and
runs served with progress off. Both were killed by the two cases added for
them.
