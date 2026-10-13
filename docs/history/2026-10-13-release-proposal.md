# Release proposal: run 141's follow-up, task-marking diagnostics, isolation check, correction reuse (2026-10-13)

**Status: APPROVED and deployed as deploy 2199** (`main` `fef80b9b`, image
`4444d9d53d906b8d` built, 2026-10-13 12:26–12:29 UTC). Runtime confirmation
waits for the owner's free press (`docs/deploy-record.md`). The optional
isolation press (§5) was **not** approved or run. The proposal as written
follows.

**As proposed: nothing merged, deployed, built, pressed or spent.** One consolidated release of everything pending on
`claude/help-needed-ehlwlj` since deploy 2198. No new audit. Run 141 stays
closed, and **its cause stays unconfirmed**.

## 1. What would ship

**Production today:** deploy 2198, `main` `64f17488`, image
`eda28cb21064287d`, image purchases on. Balance 860 (last read by run 142; to
be read again before anything that spends).

| # | Change | Where | Commits | Customer-visible? |
|---|---|---|---|---|
| 1 | The canary's served-text reader: quoted attributes containing `>` no longer leak into text | `scripts/canary-requests.mjs` | `1bf174fa` | No (instrument) |
| 2 | The Add-on's `scoped` count: calls made under a part's page scope are counted, where it said 0 | `worker.js` | `1bf174fa` | No (evidence on the request view) |
| 3 | Per-call task markings, preparations included: numbers only, never prompts | `builder/prepared.mjs`, `builder/request.mjs`, `worker.js` | `8626608a` | No (request view: `prepRun.step.marks`, `prepUse[].marks`) |
| 4 | The honest isolation verdict: marks, three per-job versions in order, "discriminating" only Add-on-first; the `acc-isolation-page` scenario | `scripts/canary-*.mjs`, `edit-canary.yml` | `8626608a` | No (instrument) |
| 5 | The old balance opt-in, closed | `scripts/canary-ui.mjs`, `edit-canary.yml` | `8626608a` | No (instrument) |
| 6 | **Correction reuse.** A refusal's facts, never its answer, take an Add-on job straight to the recorded correction when its first request and cleaner input match exactly; otherwise it asks as before | `builder/prepared.mjs`, `worker.js` | `372f8ae0`, tests `59faf01b` | **Yes, indirectly**: fewer repeated designer calls, so lower cost and latency on that path. Nothing new is shown to a customer. |

- **Nothing under `public/`** changed, so there is no served-file comparison.
- **The image is rebuilt**, because `worker.js` is a container input:
  `eda28cb21064287d` → **`4444d9d53d906b8d`** (205 inputs, predicted from the
  branch head; to be predicted again on the exact candidate).
- **A workflow file changed** (`edit-canary.yml`). The merge's push runs the
  deploy, as any merge does.

## 2. Evidence for each change (offline, supplied answers only)

| Change | Evidence | Records |
|---|---|---|
| 1 | Run 141's saved page plus attribute controls; red check; sweep | `docs/history/2026-10-12-run141-followup.md` |
| 2 | R141 1 (`scoped 3`) and R141 4 (unscoped control, 0) | the same |
| 3 | `part-marks` 5/5; R141 5 on run 141's site, every call clean; no request text in the record | `docs/history/2026-10-13-evidence-round.md` §2 |
| 4 | `canary-isolation` 10/10, both orders, every missing-evidence case | the same, §3 |
| 5 | `acceptance-balance-opt-in` 7/7 | the same, §5 |
| 6 | `correction-reuse` 11 cases (CR 1–9c); R141 3; VA 0–5 and UA 0–6 unchanged; sweep 25/25 with 2 controls | `docs/history/2026-10-13-correction-reuse.md` |

**Correction reuse in particular:**
- **CR 1, R141 3:** on run 141's shape, the job makes no designer call, and is
  charged as a job with no refusal.
- **CR 9:** a **natural** change of the cleaner's input (the site's day turns
  over between preparation and job) with the request byte for byte unchanged.
  The job declines, asks fresh, is refused `past-date` against the new day,
  corrects once and lands; counts and charges match the calls used.
- **CR 9c:** the same-day control reuses the correction.
- **Fallbacks:** CR 2–4b.
- **Continuation:** CR 6 and CR 8.
- **Never in any output:** CR 1 shows refused content in no request, staged
  or kept record, view or page.

**Suite:**
- `10737 / 10737 / 0 / 0` locally on `59faf01b`.
- CI on `372f8ae0`: unit tests 38334767137 (`10735 / 10691 / 0 / 44
  skipped`), site build 38334767139 success.
- CI on `b318e17b` (`59faf01b`'s code plus records): unit tests
  38391184627, `10737 / 10693 / 0 / 44 skipped`. The run on `59faf01b` was
  cancelled when `b318e17b` superseded it.

## 3. What is not shown, and stays so after this release

- **Run 141's cause.** Its preparation record is still unread. You can open
  it free in the Cloudflare dashboard: R2, the sites bucket,
  `requests/fold-lane-bakery/71b20ee310bf857b0310a9918215f201/prep/p1-1.json`,
  then look for `unusable` on the designer's entry.
- **Real-model behaviour.** Everything above uses supplied answers:
  - whether real models receive the markings is shown only by the numbers the
    released code will record;
  - whether real models refuse in this shape is shown only when it happens.
- **Isolation, live.** Unshown until a press runs the Add-on first.
- **Correction reuse, live.** No press can force a refusal. After release,
  any Add-on request's view shows `prepUse[].skipped` when it happens.
- **Out of scope** (backlog, untouched):
  - the other `<[^>]+>` strippers;
  - the coverage judge calling a collapsed answer "unseen";
  - text and data steps adopting reuse;
  - an R2 read route;
  - concurrency inside one Add-on;
  - the missing-context clarification;
  - the image-free first Build.

## 4. The release steps (free; each runs on your word)

1. **Preflight on the exact candidate** (the branch head when you approve):
   - nothing in flight (Actions runs, edit jobs);
   - required CI green on the candidate (unit tests, site build);
   - the image predicted on both ends;
   - the rollback verified in a throwaway worktree:
     `git revert --no-commit 64f17488..<candidate>` must give back `main`'s
     own tree.
2. **Fast-forward `main`** to the candidate. That starts one deploy run. Read
   its `built` line and the `eda28cb21064287d` → `4444d9d53d906b8d` pair.
3. **Wait 15–20 minutes** for the image roll.
4. **Your free runtime press**, with every other box blank and spend `no`:
   both readers must answer the new sha, a cold container must report
   `4444d9d53d906b8d`, `imagePurchases=true`, and nothing may be charged.
   Until that read, the release is "deployed, not runtime-confirmed".
5. **Record** deploy 2199 and the runtime run.

**Rollback:** revert the merged range and redeploy. That rebuilds back to
`eda28cb21064287d`'s inputs; no data migrations are involved. Correction
reuse needs no data rollback either: records without refusal facts behave
exactly as before.

**Cost of steps 1–5:** nothing (no model calls).

## 5. Optional, separately approved: one live isolation press

Only if you want isolation shown live. It is not needed to release.

- **The press:** `acc-isolation-page` on `fold-lane-bakery`, once. Estimate
  12–26 credits; an estimate, not a limit. The press fails its own check if
  it spends more, and it runs under the canary's 100-credit cap.
- **What it can show:**
  - the first live per-call markings (every model call's numbers);
  - three served versions in order;
  - either a **discriminating** isolation pass (only if the router runs the
    Add-on first), or **consistent only** (edit first), or **not exercised**
    (any other split);
  - incidentally, `prepUse[].skipped` if a refusal happens.
- **What it needs, beyond steps 1–5:**
  1. **A scoped opt-in naming `acc-isolation-page` alone.** Paid acceptance
     presses send nothing while the balance is above 100 (now 860), and the
     opt-in is closed. This is a one-line `BALANCE_OPT_IN` change and its
     form description, as `64f17488` did for `acc-isolation`. It could ride in
     this merge or follow as a scripts-only commit. **Not made until you say
     so.**
  2. **Image purchases off** for the press (the scenario refuses otherwise).
     That is deploy 2197's pattern: `IMAGE_PURCHASES=off` before the merge
     (or a manual redeploy), then back `on` with a manual redeploy after the
     press, as 2198 did. This stops photographs for every customer while it is
     off.
  3. **Your approval of the spend.**
- **The press inputs**, by box description:
  - *Run the ONE paid edit as well*: `yes`;
  - *RUN A NAMED SCENARIO IN A REAL BROWSER*: `acc-isolation-page`;
  - *Refuse to spend unless the Worker reports this deploy sha*: the new sha;
  - *Refuse to spend unless a cold container reports this image id*:
    `4444d9d53d906b8d`;
  - everything else blank.

## 6. My recommendation

- **Release now** (steps 1–5, free). It carries correction reuse and the
  diagnostics. Both fall back to today's behaviour on any missing evidence.
  The diagnostics are what will finally show, from real model calls, whether
  the markings arrive.
- **Decide the isolation press separately.** If you want it, approve the
  scoped opt-in and the images-off window together, so that it costs one
  press and two redeploys rather than several rounds.
