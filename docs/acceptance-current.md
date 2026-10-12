# Acceptance: the instructions to follow now

*Current instructions only. They are replaced, never appended to, when they
change. The history of how they came to be, including superseded image ids,
stages and budgets, is in `docs/history/2026-10-11-acceptance-batch.md` and
`docs/history/2026-10-12-acceptance-addon-free.md`; nothing there is an
instruction.*

**As of 2026-10-12, branch `claude/help-needed-ehlwlj`. Product code
`754c4eb4`, reviewed by Codex on `358dff0a`. The acceptance harness changed in
rounds 16–18 (scripts and tests only, no product code) and was reviewed by
Codex on `dc3ea241`: the harness repair batch is closed.**

## 1. State

- **Production**: deploy 2193 (2026-10-12, 14:03 UTC), `main` **`df1dcf30`**,
  the opt-in (§5) merged; image `1e30b6fb56b51794` **reused**;
  **runtime-confirmed by run 127** (14:14 UTC), with
  **`imagePurchases=false`** and balance 971.
- **P1 ran** (run 128, 14:24 UTC, 13 credits, balance 971 → 958). S1, S2
  and S9 came back batched; S3–S8 came back as parts. **S3 made parts, so P2
  (`acc-page-table`) is next.** S7 was split too (the section held back from
  the add-on), so `acc-addon-inner` would now test overlap across parts. The
  full table is in owner-notes.
- **P2 passed** (run 129, 14:29–14:36 UTC, 8 credits, balance 958 → 950).
  - The price part's preparation overlapped the heading job by **13.1 s**
    (recorded intervals), and the price job reused it exactly.
  - Both changes landed exactly, with nothing else touched.
  - No duplicate charge: the charges are routing 3, then jobs 3, 1 and 1.
  - Option A total: 21 credits. **Image purchases are still off**: switch
    them back on (§6 step 8). Before it:
- deploy 2192 (2026-10-12), `main` **`e1556086`**, image
  **`1e30b6fb56b51794`** (built as predicted, 205 inputs; the container moved
  from `8d6dbcea93252fbb` at 11:16:24 UTC). The served `chat.js` is
  byte-identical to the merged file. **Runtime-confirmed by the owner's free
  press, run 123** (12:58 UTC): both readers `e1556086808c`, a cold container
  `1e30b6fb56b51794`, async and the runner on, nothing charged (balance 971).
  The runtime reports **`imagePurchases=true`**: P2 still needs
  `IMAGE_PURCHASES` set to `off` (§6 step 3). **The probe rehearsal (run 125,
  free)** read the 9 probes and the bakery's 12 pages, and confirmed that a
  paid probe would refuse on the 100-credit cap at 971. **The P2 rehearsal
  (run 126, free)** read Country White at 4.8 (£4.80 on `/order`) and stopped
  at step 1 because image purchases are on; nothing was sent. The previous production was deploy
  2191, `f96cbfd5`, image `8d6dbcea93252fbb`.
- **The branch is merged** (a fast-forward, one deploy run). Records after it
  live on `claude/help-needed-ehlwlj` and start no deploy.
- **Paid acceptance is blocked** except for P1 and P2 run with the opt-in box
  (§5), which is merged and deployed in deploy 2193. Every paid acceptance entry point refuses while the balance is
  above 100 (`ACCEPTANCE_CAP`); the balance is 971, and nothing here asks for
  it to change. **No separate test budget exists.** You chose option A for P1
  and P2 (2026-10-12); the opt-in box that carries it is on the branch.
- **Real images are unverified**, and stay so: no test here buys one. fal is
  off limits. **Every case below is image-free**, the Add-on ones included.
- **The account's Build flags are left as they are.** Nothing is switched on
  for a test. The 1-page / 15-component limits are unchanged.

## 2. The goal, and what is proved offline versus live

**The goal**: independent, substantive work runs at the same time across
Build, Edit and Add-on; real dependencies wait; work that succeeded is reused,
not redone, after a question or a restart; nothing is charged twice.

**Offline** means through the real request driver, queue consumer, routes and
job runner, with supplied model answers and no network. Overlap is proved by
a rendezvous: each of two calls is held until the other has started, so a
schedule that runs them one after the other cannot pass. **Live** means a
press against the deployed Worker, with real models.

| Claim | Build | Edit | Add-on |
|---|---|---|---|
| **Independent work overlaps** | Offline: `build-parallel` BLD 1 (photographs bought while the pages are generated; it involves photographs). The image-free overlap by bands or design agents runs only under the `design`, `graph` or `bandsEveryone` flags. Live: **not shown**. | Offline: PC 1–2, `parallel-dispatch`, `parallel-intervals`, `step-pool`. Live: **run 119** (production `f96cbfd5`), a prepared price step inside an executing heading job, by recorded intervals. | Offline, **inside one Add-on**: PI 1 (photo), PI 24 (table and section), **PI 32** (a new page and a section, image-free, new in round 16). Offline, **across parts**: PI 2–3 (photo), PI 29 (an Add-on part beside an Edit part), **PI 33** (two Add-on parts on two pages, image-free, new). Live: **not shown**. |
| **Real dependencies wait** | Offline: `build-parallel` BLD 2 (the build is not handed on while a photograph is out). | Offline: PC 3 (a menu link waits for the page it needs, held mid-call), `parallel-plan`, `parallel-readiness`, `request-plan`. Live: **not shown on the branch**. | Offline: PI 5 (a photo inside the component another part creates), PI 25 and PI 28 (a form waits for the table it saves into). Live: **not shown**. |
| **Results are correct** | Offline: BLD 1–6. | Offline: every case reads the stored pages and rows. Live: run 119's changes landed. | Offline: every PI case reads the stored pages. Live: **not shown** without a photograph. |
| **Success is reused after a question** | Not covered by these files. | Offline: `continuation-unusable`, `validation-reuse`, `live-clarify-*`. Live: **not shown**. | Offline: PI 30–31 (the table's finished design replayed across a question), RS 1–13 (every requirement kept). Live: **not shown**. |
| **Success is reused after a restart** | Offline: BLD 3–4 (a redelivered first run, and a purchase whose buyer died, found and reused), `build-resume`. | Offline: PC 5 (preparation taken again by the cron after a crash), `handover-resume`. Live: **not shown**. | Offline: RC 1 (the same request resumes after a restart, with no new message), PI 21 (the run after a held purchase replays what was finished). Live: **not shown**. |
| **Prepared work is replayed exactly** | n/a | Offline: PC 1–2, PI 29. Live: **not shown** (run 119 predates per-job `prepUse`). | Offline: PI 29, PI 33. Live: **not shown**. |
| **Nothing is charged twice** | Offline: BLD 3–5, `parallel-purchase`, `purchase-outcomes`. | Offline: PC 4 (redelivered preparation), RC 3, RS 12. Live: **not shown on the branch** (run 119 spent 12 on production). | Offline: PI 7 (every message delivered twice), PI 32–33 (unique ledger refs). Live: **not shown**. |

The consolidated offline sweep groups these files: independent work, genuine
dependencies, clarification and resume, partial failure (§6 gives the counts).

**Still needs live verification**, and only a press can show it:

1. whether the real router splits independent changes into parts or batches
   them into one answer (P1);
2. a scoped preparation replayed exactly by its job (`replayed ≥ 1, fresh 0`)
   while another part runs (P2, B2);
3. **inside one Add-on, whether the real picker says what each addition uses.**
   Two designers start together only when the picker states their `uses`;
   with nothing stated, the old order stands (PI 26). PI 32 shows the overlap
   with `uses: []` supplied (B1);
4. whether a real model says `needs` when it lacks context (one sample at most);
5. the image-free first Build's overlap by bands or design agents;
6. real images (not proposed: fal is off limits).

## 3. The evidence each live claim needs

Every check reads what the run recorded, never a status or a routing answer.

| Claim | Evidence (existing reader) | Passes only when |
|---|---|---|
| **Overlap across parts** | `overlapVerdict` (`scripts/canary-requests.mjs`): the request view's recorded intervals, a part's prepared step (`prepRun`, calls > 0) against another part's job run (`runs`), or two prepared steps together | the intervals intersect; a batched answer or parts run one after another fail, and are recorded as such |
| **Overlap inside one Add-on** | **`addonDesignOverlap`** (`scripts/canary-read-job.mjs`), read free afterwards with the *read_job* box on the Add-on's job: the job's `add:<kind>` start and end marks in its trace. The lookup reads **every job on the site whose run touches the window** (created before its end, still updated after the earliest returned trace began), never by a creation lookback | the two designers' intervals cross, **and** the job has finished, the jobs read is complete and holds it, exactly one trace ran inside the job's own run (a trace that began before the job existed is never its), and no other job ran beside that trace. Two traces inside the run or another job beside it: `candidate-only`. A failed or cut read, an unfinished job, a trace without times, or no trace inside the run: `unknown`. Never a pass by default |
| **Correct final results** | `outcomeChecks`: `headings`, `pages`, `menu`, and `sections` (a section added to a page that exists keeps everything that page said, and the served page says it); **every fact the message asked for** (`facts`, `only`, `denies`, round 17): each place, amount, day and time stated, no other amount, day or time beside it, and no claim the customer denied; equivalent wording allowed only from each fact's own list; **judged on the asked section itself, in stored and served output alike** (round 18): only what the press added, one added section holding every fact, any other added section judged for contradictions; every other stored page byte for byte; tables, logos and photographs as they were | every named change and every asked-for fact is there, nothing contradicts them, and nothing else moved |
| **Dependency ordering** | `jobOrderVerdict`: no part started before a part it needs had finished; COVERAGE `waits-for-prerequisite` | the order holds; a press where nothing waited says so (vacuous), never claims it |
| **Reuse** | `reuseVerdict`: per-job `prepUse` (`exact` = staged yes, replayed ≥ 1, fresh 0) | the demanded number of jobs answered exactly from prepared work; a missing record fails |
| **No duplicate charges** | `moneyVerdict`, `ownMoneyVerdict` (the press's own ledger rows), `laterChargesVerdict` (charges after the request ended), and the read-job ledger (`credit_events` by job id) | each job reserved once, every ledger ref distinct, nothing charged after the end, spend within the estimate |

## 4. The minimal live proposal (P1 and P2 approved under option A; nothing is pressed)

Two paid presses are necessary to verify the remaining parallel-work claims
(items 1 and 2). The image-free Add-on presses are optional, and each is
pressed only if its probe allows it.

| # | Press | What it proves | Estimate |
|---|---|---|---|
| P1 | routing probe `acceptance-split-1` (**9** routing calls, nothing applied) | the real router's answer for every acceptance message, S1–S9: **batched** (one answer: not parallel work) or **parts** | 9–27 |
| P2 | `acc-page-table` on `fold-lane-bakery`, **only if S3 came back as parts** | the price part's scoped preparation overlaps the heading job by recorded intervals, its job replays it exactly, and both changes land (heading; Country White 4.80 → 4.90) | 4–12 |
| B1 | `acc-addon-inner` (optional; S7) | **inside one Add-on**: a Delivery page with its menu link and a questions section on the Tasting Evenings page, no photograph, form or table. Both land; afterwards the free read-job lookup on the Add-on's job reads whether the two designers overlapped (§3) | 15–28 (budget 30) |
| B2 | `acc-addon-edit` (optional; **only if S8 came back as parts**) | **across parts**: a questions section on the Bake List page and the Gallery heading; the held part is prepared beside the other part's job and replayed exactly | 9–20 (budget 22) |
| B3 | `acc-addon-pair` (optional; S9) | two questions sections on the Visit and Starter pages: what the router made of them is recorded (expected one Add-on); both land; reuse recorded, no overlap demanded | 8–26 (budget 28) |

- **If S3 is batched**, P2 is not pressed. `acc-table-page` (S4) takes its
  place if S4 made parts, at the same estimate. If both are batched, the
  result is recorded as *the real router batches these messages; parallel
  parts are not reachable from them*, and nothing more is spent on them.
- **B1 needs no split**: its overlap is inside one job. If S7 came back as
  parts, B1 still runs, and its overlap is judged across parts.
- **Expected total**: 13–39 for P1 and P2; up to 74 more with B1–B3. These are
  estimates, not limits.
- **Optional, not needed for the parallel-work claims**: `acc-needs` (item 4,
  4–14), `acc-mixed` (an add-on prepared beside a price, its menu link
  waiting, 17–34), `acc-pages-real` (3–8), and the image-free Build (item 5,
  11–40). The Build runs only if one of `design`, `graph` or `bandsEveryone`
  is already on for the account; its free rehearsal says so.
- Each section's words were read off the live pages on 2026-10-12 as not yet
  there. A press compares against its own before-read, so the order of B1–B3
  does not matter.

## 5. The spending decision: option A, chosen 2026-10-12

**What is actually enforced**: the server's charge functions refuse any
charge the balance cannot cover. So **the only enforced bound on a paid press
is the whole account balance (971)**. No per-press or per-request cap exists
on the server. The press's own 100-credit refusal is a guard, not a budget.

**You chose A** ("go with A"): the account balance is accepted as the bound
for **P1 and P2 only** (`acceptance-split-1`, and `acc-page-table` or
`acc-table-page`). B1–B3 are not included; they stay behind the cap.

**The opt-in, on the branch, not yet reviewed or merged**: a new form box,
*ACCEPTANCE P1/P2 ONLY* (`accept_balance`). You type your balance in whole
credits. Then:
- the press runs above the 100-credit cap **only if the balance read just
  before the first paid call is exactly that number**; a top-up, a charge or
  an unreadable balance in between refuses;
- every other check stands: the estimate, the deploy sha, the image id and,
  for P2, image purchases off;
- the box beside any other press, or anything but a whole number, refuses
  before the sign-in, at no cost;
- left blank, nothing changes: the cap stands.

It is still not a budget: under it, a press can spend up to the whole
balance. The estimates (§4) are not limits.

Until the opt-in is reviewed, merged and deployed, **paid acceptance is
blocked**.

**Not an option**: lowering or resetting the account's balance.

## 6. The steps from here (each the owner's)

1. **Done**: the decision (§5, option A, for P1 and P2), and the free checks
   on deploy 2192 (runs 123, 125, 126).
2. **Review the opt-in** (§5) on the branch.
3. **Set the repository secret `IMAGE_PURCHASES` to `off`** just before the
   merge, so the merge's one deploy carries it. P2 needs it; P1 does not.
   **This stops photographs for every customer while it is off.**
4. **Merge the branch to `main`** (a fast-forward; one deploy run, because a
   workflow changed). The container inputs are unchanged, so the image is
   expected to be **reused** (`1e30b6fb56b51794`) and no image window is
   owed. If the deploy log says `built`, wait 15–20 minutes before step 5.
5. **The free runtime press** (*edit canary*, spend `no`, the new deploy sha
   and image boxes): it must print the merge sha, image `1e30b6fb56b51794`
   and `imagePurchases=false`. Read your balance there.
6. **P1**, workflow *edit canary* from `main`:
   - *ROUTING-ONLY BATCH* = `acceptance-split-1`;
   - *ACCEPTANCE P1/P2 ONLY* = your balance, exactly as step 5 read it;
   - *Run the ONE paid edit as well* = `yes`;
   - *Refuse to spend unless the Worker reports this deploy sha* = the merge
     sha;
   - *Refuse to spend unless a cold container reports this image id* =
     `1e30b6fb56b51794`;
   - every other box blank.
7. **P2**, only if P1's S3 made parts (else `acc-table-page` if S4 did; else
   neither):
   - *The site to edit* = `fold-lane-bakery`;
   - *RUN A NAMED SCENARIO IN A REAL BROWSER* = `acc-page-table`;
   - *ACCEPTANCE P1/P2 ONLY* = your balance after P1, exactly;
   - spend `yes`, and the same deploy sha and image boxes.
8. **Afterwards**, set `IMAGE_PURCHASES` back to `on` and re-run the deploy
   workflow (it has a manual run). Until then, no customer gets photographs.

B1–B3 are not part of option A: their presses still refuse above the cap.

## 7. Offline verification of this plan (rounds 16 to 18)

- Round 16: harness commit `8db3cbea`; full suite `10650 / 10650 / 0 / 0`;
  acceptance sweep 524 / 524; sweep 14 of 14; CI unit tests 38198232545
  `success`.
- Round 17 (`docs/history/2026-10-12-acceptance-harness-controls.md`):
  commit `1eac62c1`, after Codex's controls on `3869478b`. Every asked-for
  fact is judged, and trace attribution goes by run. Full suite `10657 /
  10657 / 0 / 0`; acceptance sweep 41 files, **531 / 531**; sweep 21 of 21,
  control surviving; red check 9 of 16 failing on `3869478b`; CI unit tests
  38201146344 `success` on `1eac62c1`.
- Round 18 (`docs/history/2026-10-12-acceptance-served-sections.md`):
  commit `d9434979`, after Codex's control on `2015cc0c` (a section served
  with an added "£50 a head" passed). The asked section is judged whole, on
  stored and served output alike, on what the press added only. Full suite
  `10663 / 10663 / 0 / 0`; acceptance sweep 41 files, **537 / 537**; sweep
  13 of 14 (1 equivalent), control surviving; red check 5 of 22 failing on
  `2015cc0c`; CI unit tests 38236080782 `success` on `d9434979`.
- **Closed** (2026-10-12): Codex reviewed `dc3ea241`. 212 focused tests
  passed, three browser-dependent tests were skipped, both independent
  served-price controls passed, and CI was green (unit tests 38237458207
  `success` on `dc3ea241`). The acceptance-harness repair batch is closed.
  Nothing completed is to be repeated without a concrete reason.
