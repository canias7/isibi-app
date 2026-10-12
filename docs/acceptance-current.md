# Acceptance: the instructions to follow now

*Current instructions only. They are replaced, never appended to, when they
change. The history of how they came to be, including superseded image ids,
stages and budgets, is in `docs/history/2026-10-11-acceptance-batch.md` and
`docs/history/2026-10-12-acceptance-addon-free.md`; nothing there is an
instruction.*

**As of 2026-10-12, branch `claude/help-needed-ehlwlj`. Product code
`754c4eb4`, reviewed by Codex on `358dff0a`. The acceptance harness changed in
round 16 (scripts and tests only, no product code).**

## 1. State

- **Production**: deploy 2191, `main` `f96cbfd5`, image `8d6dbcea93252fbb`.
- **The branch is unmerged.** Its predicted image is **`1e30b6fb56b51794`**
  (205 inputs, predicted on `754c4eb4`, and again after round 16, which
  changes no input; not built).
- **Paid acceptance is blocked.** Every paid acceptance entry point (the
  request presses, the routing-only probe batch and the image-free Build)
  refuses while the balance is above 100 (`ACCEPTANCE_CAP`). The balance is
  971, and nothing here asks for it to change. **No separate test budget
  exists.**
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
| **Correct final results** | `outcomeChecks`: `headings`, `pages`, `menu`, and `sections` (a section added to a page that exists keeps everything that page said, and the served page says it); **every fact the message asked for** (`facts`, `only`, `denies`, round 17): each place, amount, day and time stated, no other amount, day or time beside it, and no claim the customer denied; equivalent wording allowed only from each fact's own list; every other stored page byte for byte; tables, logos and photographs as they were | every named change and every asked-for fact is there, nothing contradicts them, and nothing else moved |
| **Dependency ordering** | `jobOrderVerdict`: no part started before a part it needs had finished; COVERAGE `waits-for-prerequisite` | the order holds; a press where nothing waited says so (vacuous), never claims it |
| **Reuse** | `reuseVerdict`: per-job `prepUse` (`exact` = staged yes, replayed ≥ 1, fresh 0) | the demanded number of jobs answered exactly from prepared work; a missing record fails |
| **No duplicate charges** | `moneyVerdict`, `ownMoneyVerdict` (the press's own ledger rows), `laterChargesVerdict` (charges after the request ended), and the read-job ledger (`credit_events` by job id) | each job reserved once, every ledger ref distinct, nothing charged after the end, spend within the estimate |

## 4. The minimal live proposal (not approved; nothing is pressed)

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

## 5. The spending decision you need to make first

**What is actually enforced today**: the server's charge functions refuse
any charge the balance cannot cover. So **the only enforced bound on a paid
press is the whole account balance (971)**. No per-press or per-request cap
exists on the server. The press's own 100-credit refusal is a guard that
blocks every paid press at 971. It is not a budget.

Before anything is implemented or pressed, choose one:

- **A. Accept the account balance as the bound for P1 and P2** (and, if you
  want them, B1–B3). Their worst case is the whole balance. Their expected
  spend is in §4; run 119, the closest past press in shape, spent 12. Neither
  figure is a limit. Implementation: one small, reviewed change that lets
  these presses run above 100 only with an explicit opt-in box you fill,
  naming the balance it may run against. The guard stays in place for
  everything else. No billing change.
- **B. A real separate test budget first.** A bound smaller than the
  account needs a billing change, for example a per-request cap in the
  server's charge functions or a separate funded test account with its own
  site. You asked for no billing redesign in this round, so this would be a
  separate, approved piece of work, and the presses stay blocked until it
  exists.
- **C. Do nothing live.** Paid acceptance stays blocked. Every claim in §2
  stays verified offline only.

**Not an option**: lowering or resetting the account's balance.

## 6. Deployment steps the presses need (after the decision; each the owner's)

1. Approve the decision in §5 and the presses in §4.
2. Review and merge whatever §5's choice needs (for A, the opt-in change).
3. **Set the repository secret `IMAGE_PURCHASES` to `off`** (needed for P2
   and B1–B3, not P1: every acceptance scenario refuses unless the live
   Worker reports it off; the routing-only probe never reaches an image).
   **This stops photographs for every customer while it is off, not only for
   the tests.**
4. **Merge the branch to `main`** (a fast-forward; one deploy run). P1 also
   needs it: a probe routes through the live Worker, so it only measures the
   router that is deployed. The image rolls `8d6dbcea93252fbb` →
   `1e30b6fb56b51794` (predicted, not built). If the merged commit's
   container inputs differ from `754c4eb4`'s, the image is predicted again
   first.
5. Wait 15–20 minutes for the image window.
6. **The free runtime press** (*edit canary*, every paid box blank or `no`):
   it must print the new deploy sha, image `1e30b6fb56b51794` and
   `imagePurchases=false`.
7. **The free rehearsals** of each press (spend not `yes`): each reads its
   prerequisites and reports every one a paid press would refuse on.
8. **P1**, workflow *edit canary*: *ROUTING-ONLY BATCH* = `acceptance-split-1`;
   *Run the ONE paid edit as well* = `yes`; *Refuse to spend unless the Worker
   reports this deploy sha* = the merge sha; *Refuse to spend unless a cold
   container reports this image id* = `1e30b6fb56b51794`. Every other box
   blank.
9. **P2**, only if P1 allows it: *The site to edit* = `fold-lane-bakery`;
   *RUN A NAMED SCENARIO IN A REAL BROWSER* = `acc-page-table` (or
   `acc-table-page`, as §4 says); spend `yes`; the same deploy sha and image
   boxes.
10. **B1–B3**, if approved and as §4 allows: the same boxes as P2, with the
    scenario `acc-addon-inner`, `acc-addon-edit` or `acc-addon-pair`.
11. **After B1**: the free read-job press, *read_job* = the Add-on's job id
    (from B1's record). Its `DESIGNERS` line is the inside-one-Add-on
    reading: `overlapped`, `not-overlapped`, `candidate-only` or `unknown`
    (§3).
12. **Afterwards**, decide whether to set `IMAGE_PURCHASES` back to `on`
    (with a redeploy). Until then, no customer gets photographs.

## 7. Offline verification of this plan (rounds 16 and 17)

- Harness commit `8db3cbea`. Full suite `10650 / 10650 / 0 / 0`.
  Consolidated sweep 41 files, **524 / 524** (independent work 124,
  dependencies 92, clarification and resume 201, partial failure 107).
  Mutation sweep 14 of 14 killed, control surviving. CI: unit tests
  38198232545 `success` on `8db3cbea`.
