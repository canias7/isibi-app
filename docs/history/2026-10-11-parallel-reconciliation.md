# 2026-10-11 — Parallel work: the evidence reconciled across Edit, Add-on and Build

Codex checked `5aa4d052`: 141 focused tests passed, both independent
duplicate-retry reproductions passed, and 22 parallel-work tests passed
offline. The duplicate-execution correction (Build recovery rounds 1–6) is
closed. This record returns to the parallel-agent goal: one batch that sets
the existing evidence side by side, adds offline tests only where coverage
was missing, and fixes the two defects those tests found.

**Fixes**: `88aca4c3`. **Image prediction**: production `8d6dbcea93252fbb` →
`b6ddb38fa003055e` (205 inputs). Not built, merged or deployed. No paid call.
Real images unverified; image work is mocked (fal is funded, and that
balance is off limits).

## 1. The one kind of concurrency that exists

Before a part's writes happen, its model calls (and any photo purchase) are
**prepared** beside another part's running job. Writes stay one at a time:
- **one live job per request**: `nextStep`, `builder/request.mjs`;
- **one writer per site**: `edit_claim`'s `site_busy` lock.

A prepared answer is used by the part's own job only for a **byte-identical**
request (`builder/prepared.mjs`, `replayer`). Otherwise the job asks the
model against the site as it now is.

- **Plan** (`builder/request-plan.mjs`): `stepInputs`, `feeds`, `conflicts`,
  `inferNeeds`, `clearToPrepare`.
- **Driver** (`builder/request.mjs`): `nextStep`, `takePrep`, `notePrepared`,
  `prepRunOf` and `prepRunsOf`. At most 3 preparations live at once
  (`PREP_MAX_LIVE`), two tries each (`PREP_TRIES`), and 10 minutes before a
  silent attempt counts as dead (`PREP_FRESH_MS`).
- **Worker**: `advanceRequest`, `runRequestPrep`, `prepAttempt`,
  `stagePrepared`, `runRequestSweep` (the cron).
- **Purchases**: one record per photograph, bought once whoever asks
  (`purchaseOnce`).

## 2. What overlaps, by flow

**Edit.**
- **Routing** of up to 3 other parts runs beside a job.
- **Steps that can be prepared**: text, menu, picture, look (picker and
  lanes), page (writer and tweak), data, rules. The logo is routing only.
- **What a step reads decides what it may run beside** (`stepInputs` and
  `feeds`):
  - text, page, look and add-on steps read `pages`, which any earlier page,
    menu, header, footer, identity or images write feeds;
  - so two page-writing parts never overlap beyond routing, by design.
- **Found this round, by design**: data and rules steps both read every
  table (`data`), which any earlier `data:` write feeds. So **two data-layer
  steps are never prepared together**, even on different tables.
- **Pairs that can run beside each other**:
  - a picture or text job with data or rules prepared;
  - a data job with look, menu, page or add-on work prepared;
  - a look lane and a menu change prepared at once beside a data job (new,
    PC 2).

**Add-on.**
- Its picker, designers, seed net and page writer are prepared when nothing
  earlier writes what they read. An add-on that needs a new database is
  prepared only up to its design.
- Its photographs are bought by its own job through the purchase record; a
  pending one is placed later.

**Build (first build).**
- **Always beside page generation**: photographs (`startBuildPhotos`),
  fonts, and translations (BLD 1, 7, 9 in `test/build-parallel.test.mjs`).
- **Behind flags, off for ordinary accounts by default**: the designer graph
  and waves, and the page-band fan-out (`DESIGN_GRAPH_*`, and the
  split-design and band canaries in `deploy.yml`). They are proved offline
  with the flags on.

**Mixed requests.**
- **Covered offline**: Edit + Add-on (P2, P7, P7b), the seven-task BATCH,
  and two requests on one page (XR).
- **Unsupported**: a first Build mixed with edits.

**Reply and progress writers** are separate queue tasks and run while jobs
run. They are not preparation.

## 3. What waits

A part waits on its `needs`: the router's `dependsOn` plus `inferNeeds`, so a
part that refers to what another part creates waits for it. A blocked part
is never prepared. A part whose prerequisite failed is `not-run`.
- **Before this round**: P2, BATCH, `request-flow` B1, B2, C2 and M3, and
  `parallel-plan`. They check `blocked` at acceptance and the job order at
  the end.
- **New, PC 3**: while the prerequisite's job is held mid-call, every queued
  message is delivered and the cron runs twice. The dependent is not
  prepared, not routed, and its step is not asked. It is routed only after
  the page job ended, and runs against the menu that page left.

## 4. Reuse, with no repeated call or charge

- **Prepared answers**: kept per attempt under the request, staged to the
  job when it claims, each used once and only for an identical request.
- **One consumer per attempt**: the record is written on its etag
  (`takePrep`).
- **Charges**: a preparation charges nothing. Each job reserves at most once.
- **Before this round**: P1, P1c, P5, P6, the PATH cases, OWN 1–5, PUR 1–11,
  BATCH and BATCH 2, and BLD 3 and 4.
- **New**:
  - **PC 4**: a row-change preparation delivered twice at once makes one
    call, writes the row once, and charges once per job.
  - **PC 5**: a row-change preparation whose consumer died is retaken by
    the cron. There are two calls in all (the dead one, and the recovered
    one); the job makes none.
- **Defect found and fixed, menu step asked twice** (PC 2):
  - A part prepared while still to be routed already had its step's answer.
    When its routing ran while another part's job was still live, it was
    prepared again as a fresh attempt and asked its model a second time.
  - The new attempt now names the earlier one (`prev`) when that one ended
    normally, so its answers are replayed. It still matches by
    byte-identical request only, so a stale answer cannot be applied.
  - The cost was our model call; nothing was charged to the customer.
- **Defect found and fixed, a replay counted as model work**:
  - A preparation step's `calls` counted answers replayed from an earlier
    attempt, so the overlap verdict could credit a replay-only step as model
    work beside another job.
  - `step.calls` now counts model calls made; replays are kept apart as
    `replayed`.

## 5. Coordinated writes: every requested change kept

One live job per request; the site lock between requests; the request record
written on its etag; publishing through the pointer's etag; and a prepared
answer used only for an identical request.
- **Before this round**: P3, P3b, REVALIDATED, PATH add-on row, XR, BATCH's
  `allKept`, and `request-flow` J2 and J3.
- **New**: PC 1, PC 2, PC 4 and PC 5 assert every change kept (heading, row,
  description, menu entry on every menu).
- **Live**: runs 113, 117 and 119 each kept all three changes, with
  everything else byte for byte.

## 6. Recovery with the browser closed

Recovery is server-side: the driver advances on queue messages, and the cron
retakes a silent preparation after 10 minutes, naming the attempt it
replaces.
- **Before this round**: `request-flow` E1, J1 and J5; P5 and P6; OWN 2;
  BATCH; PUR 7; and the offline canary's closed-tab case.
- **New, PC 5**: no browser and no message from anyone. Inside its time the
  dead attempt is not retaken; after it, the cron retakes it naming the
  first, and the part's job answers from the recovered attempt.
- **Live**: runs 117 and 119 sent the answer with the tab closed, and a
  fresh session followed it.

## 7. Questions and progress

- **Questions stay with their own part**: P4, C2, BATCH (part 4 asks; the
  others finish; the answer resumes only part 4), and AT 3 and AT 11.
  - **Live**: run 119 (part 2 asked for the X address while parts 0 and 1
    finished), and runs 117 and 113.
- **Progress lines are model-written** from facts (`otherParts`): a prepared
  part is "being worked out alongside" or "worked out and waiting its turn",
  "nothing of it on the site yet".
  - **Offline**: `parallel-plan`, `progress-browser`'s PARALLEL card,
    BLD 10–14, and APF 7.
  - **Live**: runs 105, 107, 117 and 119 passed their progress checks.
  - **Live failure**: the Add-on photo press (run 38049499667) had one
    overstated photo line. It is fixed offline and not deployed.

## 8. Implemented, verified offline, passed live

| | Implemented | Offline | Live |
|---|---|---|---|
| Routing beside a job | yes | yes | runs 113, 117, 119 |
| A non-image step prepared beside a job | yes | PATH cases; PC 1 by intervals | **run 119** only (a data step, 19.9 s inside the heading job) |
| Two non-image steps prepared at once | yes (look and menu beside data; never two data steps) | **PC 2** (new) | no |
| A photograph bought beside a job | yes | P1, BATCH, intervals | no (the photo press failed; fal is off limits now) |
| A dependent waits | yes | P2, BATCH; **PC 3** mid-hold (new) | run 107 (before preparation existed) |
| No repeated call or charge | yes | OWN, PUR, BATCH 2; **PC 4, PC 5** (new) | not readable from a press (run 119 suggests reuse but cannot show it) |
| Every change kept | yes | many | runs 113, 117, 119 |
| Browser closed | yes | many; **PC 5** (new) | runs 117, 119 |
| Questions per part | yes | P4, BATCH, AT | runs 113, 117, 119 |
| Progress model-written and true | yes | many | runs 105, 107, 117, 119 (one overstated line on the photo press) |
| Add-on work prepared beside a job | yes | PATH add-on page and row | no |
| Build photos, fonts, translations beside generation | yes | BLD 1, 7, 9 | **never pressed** |
| Build designer and band split | flag-gated, off by default | yes, with the flags on | no |

## 9. The exact blockers to calling it complete

1. **Deploy and press**: none of this branch's work since deploy 2191 is
   deployed (image `b6ddb38fa003055e` is predicted, not built). That includes
   the Build recovery rounds and today's two fixes. No press has run on it.
2. **Two substantive steps live**: run 119 showed one non-image step beside
   one job. Two prepared at once (PC 2's shape) has never run live.
3. **Reuse is not visible live**: no field of the request's view says that
   a job answered from its preparation. A press cannot show "no repeated
   call" beyond timing. (`step.replayed` now covers the preparation side,
   not the job side.)
4. **The Add-on and the first Build have never passed a parallel press.**
   The Add-on photo press failed (no photo made), and the first-Build check
   was never pressed. Both involve photographs. With fal off limits, a
   photo-free variant of each is the only live path open.
5. **Real images stay unverified** by your decision (fal funded, off
   limits, mocks only).
6. **By design, not to change without your word**:
   - two page-writing Edits never overlap;
   - two data-layer steps never overlap;
   - writes are one at a time;
   - the Build designer and band splits are off for ordinary accounts.

## 10. Verification of this round

- **New file**: `test/parallel-coverage.test.mjs`, 5 cases (PC 1–5), all
  passing.
- **Red check on `5aa4d052`'s code**: PC 2 fails ("the menu step was asked
  again"). PC 1 and PC 3–5 pass there too: they add coverage rather than
  catching a defect.
- **Sweep**: 6 of 6 mutants killed, and the comment control survived.
  - prev not named for a done attempt;
  - a step counting replays;
  - the reader dropping `replayed`;
  - a blocked part prepared;
  - a preparation taken twice;
  - a dead preparation never stale.
- **Parallel and request suites**: 333 of 333.
- **Full suite**: `10385 / 10385 / 0 / 0` locally (350 s).
- **CI on `9ec30b31`** (code `88aca4c3` plus records, one push): unit tests
  38100732819 green (5 m 16 s); site build 38100732863 green.
