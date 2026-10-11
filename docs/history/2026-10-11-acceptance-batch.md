# 2026-10-11 — The final acceptance batch, prepared (not pressed)

Codex reviewed `5504bb55`: 164 focused tests passed, CI green, and
independent checks confirmed the stale-value correction and the image-only
fresh-call counting. **Both corrections are closed as verified offline.**

The owner then asked for the final acceptance batch to be prepared, not run:
- the existing harness's verdicts should read the per-job `prepUse` evidence;
- the image-spending restriction should be enforced in the execution path;
- image-free scenarios, one real-model case, offline rehearsal with
  negative controls, and the commands, deployment requirements, costs and
  enforceable caps, ready for approval.

**Commits**: `1e853d92` (the harness and the switch), with records after.
**Nothing was executed**: no paid test, image generation, image retry, merge,
deploy or container build. fal stays funded and off limits.

## 1. What changed

**The image-purchase switch, in the execution path**:
- `IMAGE_PURCHASES=off` refuses every photograph at `makeSitePhoto`
  (`worker.js`), before anything leaves for the image service. It is the one
  place a photograph is bought: every build, edit, add-on, placement and
  preparation path reaches it, and the only `fal.run/` post sits behind it.
  The outcome is `refused`, which every caller already reports as not made
  and not paid for.
- Container jobs get the switch too (`JOB_ENV_NAMES`).
- `/api/site/runtime` reports it as `imagePurchases`, and the free runtime
  press prints it.
- **Deploy fallback `'on'`**: production is unchanged until the owner sets
  the secret.
- **Proof**: through the real request driver, a message asking for a
  photograph makes no provider call with the switch off, and its one call
  with it on (the control). On `5504bb55` the same off case made the call
  (`actual: 1`).

**The press's verdicts read the per-job evidence** (`reuseVerdict` in
`scripts/canary-requests.mjs`):
- **Every run job must have evidence that reads**: `known`, whole-number
  `replayed`, `rebased` and `fresh`, and `staged` of yes, no or unreadable.
  It fails on a job listed as not known, a run job with no entry, a count
  that is not a number, or any `rebased` above 0. Missing evidence is never
  read as zero.
- **Exact reuse** (staged yes, replayed ≥ 1, fresh 0) is told apart from a
  prepared job that also asked a model (replayed ≥ 1, fresh ≥ 1).
- With `overlapped`, the exact reuse must be by a part whose prepared step
  overlapped other work, as shown by the recorded intervals
  (`overlapVerdict`, unchanged).
- The final-state checks (headings, pages, menus, rows) are unchanged.

**The real-model observation** (`needsObservation`): for the named part it
records `asked-again`, `exact`, `not-prepared` or `unknown`, off the
evidence. It passes nothing and fails nothing. The press's verdict lists it
under *unverified* as one sample. The final state judges whether the
result is right.

**The press refuses to buy images**: a scenario marked `images: "none"`
sends nothing, rehearsal or not, unless the live Worker answers
`imagePurchases: false`. The image-free Build check does the same.

**The spend wall** (`spendWall` in `scripts/canary-ui.mjs`):
- **What it counts**: the balance spent before this message, this message's
  routing charge, and what the request's jobs have been charged since.
  Charges an earlier message already counted are subtracted.
- **What it does**: once that reaches the scenario's budget, the driver
  presses the request's own Stop, so the server files no further job.
- **A charge that cannot be told** stops the request too.
- **The limit**: a job already running finishes and is charged. So a press
  can spend at most its `ceiling`: the budget plus the largest single job its
  walls allow.

**The image-free first Build** (`BUILD_CHECK_NO_IMAGES`, owner workflow
`mode: check-no-images`):
- a fresh slug, and a brief that asks for no photographs;
- it refuses unless the live Worker buys none;
- its uploads must hold no image and its page must place none of its own;
- its overlap must come from page bands or design agents, never photographs.

## 2. Why the scenarios look as they do

- **The real router splits a message only into what it holds back**
  (`planParts`). One text answer can change headings on several pages, and
  one data answer can change rows in several tables. So two headings, or two
  prices, become one part with nothing to run beside it.
- **Independent page and table work** is therefore a heading beside a price:
  two parts. That shape has been split live before (run 119, lv-parallel).
- **Neither demo site has a second display table** (read live and free on
  2026-10-11: the bakery has `loaves`; fretwork-1 has `lessons`, and its
  `gear` is not readable to visitors). So the real-model case uses the text
  step: a heading that must repeat another page's heading, which a step
  shown only its own page cannot know.

## 3. The batch, in order

All on **fold-lane-bakery**, in request mode, each buying no image. Each
starts from the table the one before leaves, so a press that finds anything
else refuses before sending. The headings and the table were read live and
free on 2026-10-11.

| Order | Scenario | The message | Checks | Estimate | Budget (spend wall) | Ceiling |
|---|---|---|---|---|---|---|
| 1 | `acc-page-table` | *Change the Wholesale page heading 'Daily bread for Bristol cafés' to 'Daily bread for Bristol cafés and delis', and change the Country White's price to £4.90.* | heading; Country White 4.8 → 4.9; intervals; evidence with ≥ 1 exact reuse by an overlapping part | 4–9 | 12 | 14 |
| 2 | `acc-table-page` | *Change the Walnut Levain's price to £6.30, and change the home page heading 'Fed every morning since 2019' to 'Fed by hand every morning since 2019'.* (tab closed once progress shows; followed in a fresh browser session) | as 1, and progress checks | 4–9 | 12 | 14 |
| 3 | `acc-needs` | *Change the Seeded Wholemeal's price to £5.50, and change the Order page heading 'Pick a loaf and a time to collect it' so it says exactly the same as the main heading on our Visit page.* | /order heading becomes "Come and see us"; Seeded 5.4 → 5.5; evidence; the model's answer recorded, **unverified** | 4–11 | 14 | 17 |
| 4 | `acc-mixed` | *Add a Bulk Orders page explaining how cafés can order bread in bulk: a minimum order of ten loaves, and orders in by 2pm for delivery the next morning. Put a link to it in the menu, and change the Olive & Rosemary's price to £5.90.* | the page by its words; its menu link waits for it; Olive 5.8 → 5.9; intervals; ≥ 1 exact reuse | 17–31 | 34 | 53 |
| 5 | Build, `check-no-images` | the Saltmarsh cheese counter brief (no photographs) on `saltmarsh-cheese-counter` | one page, ≤ 15 components, overlap by bands or design, order, progress lines, closure, no image stored or placed, money | 11–30 | funds 40 | one build charge (largest measured 45) |

**Totals**: about **40–90 credits** expected. The most the four request
presses can spend is **98**, their ceilings together. The Build is one
charge, whose largest measured value is 45. Last recorded balance: 971. The
balance is re-read by every press.

**Estimate sources** (measured): routing 1–3 per message and 1–3 per held
part; a text job 1–2; a data job 1; an add-on with a page 12–18, its
requirement judgment about 1; a menu step 1–2; a first build 11–45 (the top
with two photographs, which this one cannot buy).

## 4. What must happen first (the owner's)

1. Review and approve this batch: the messages, estimates and ceilings.
2. **Set the repository secret `IMAGE_PURCHASES` to `off`.**
3. **Merge the branch to `main`** (a fast-forward). That is one deploy run.
   The container image rolls `8d6dbcea93252fbb` → `9547695841a6c5ac` (predicted, not
   built), because the Worker changed.
4. Wait 15–20 minutes for the image window.
5. **The free runtime press** (*edit canary*, every paid box left blank or
   `no`): it must print the new deploy sha, the new image and
   `imagePurchases=false`. Fill:
   - *Refuse to spend unless the Worker reports this deploy sha* = the merge
     sha;
   - *Refuse to spend unless a cold container reports this image id* =
     `9547695841a6c5ac`.

## 5. The presses (each the owner's, in order)

**Requests 1–4**, workflow *edit canary*, one press each. The boxes, by
their descriptions:
- **The site to edit…**: `fold-lane-bakery`
- **RUN A NAMED SCENARIO IN A REAL BROWSER…**: `acc-page-table`, then
  `acc-table-page`, `acc-needs`, `acc-mixed`
- **Run the ONE paid edit as well (yes/no)**: `yes`
- **Refuse to spend unless the Worker reports this deploy sha…**: the merge
  sha
- **Refuse to spend unless a cold container reports this image id…**:
  `9547695841a6c5ac`

Every other box stays blank. With the spend box `no`, each is a free
rehearsal that types its message and stops, and still refuses if photographs
are bought. Stop the batch at the first failure and review it before the
next press: each press's table record assumes the one before landed.

**The Build**, workflow *build as owner*:
- **build | edit | check …**: `check-no-images`
- **check only: yes sends the build…**: `yes`

## 6. How each spend is bounded (enforced, not just written)

- **No image can be bought**: the switch is checked in the Worker and in
  every container job before the image service is called. Every press also
  refuses unless the live Worker reports it off.
- **Before message 1**: the press sends nothing unless the balance covers its
  budget (`fundsFirst`).
- **While a request runs**: the spend wall stops it at its budget. The most it
  can spend is its ceiling.
- **Between messages**: the press stops once its spend reaches its budget
  (`budgetRefusal`).
- **Everywhere**: every charge path refuses what the balance cannot cover.
- **Not enforced here**: no per-request cap on the server beyond the balance.
  The Build is a single charge the press cannot stop part way. Its bound is
  the build path's own debit.

## 7. Rehearsed offline (supplied answers)

**`test/canary-acceptance.test.mjs`** (13 cases):
- each scenario as written, with the table chain;
- `reuseVerdict` on every shape of evidence;
- `needsObservation` and its place under *unverified*;
- the spend wall and the image refusal;
- `acc-page-table` through the **real canary driver** against the stand-in
  app:
  - the positive press;
  - one negative control at a time, each failing its own check and nothing
    else: no concurrency, evidence not known, a count missing, fresh where
    exact was required, a run job with no evidence;
  - the requested change never made: the row check fails while the evidence
    and intervals pass;
  - the image guard stopping the press before its message: purchases on,
    the runtime unreadable or throwing, no reader;
  - the spend wall pressing Stop, with its control;
- the wiring.

**`test/canary-build.test.mjs`** (+4 cases): the image-free spec; its
refusals; end to end offline with an image stored, a photograph placed,
uploads unread and an overlap only photographs could show, each failing;
the wiring.

**`test/image-purchase-switch.test.mjs`** (3 cases): the switch through the
real request flow, its control, and the wiring.

**Verification**:
- **Red check on `5504bb55`**: with `IMAGE_PURCHASES=off`, the add-on's
  photograph was still asked of the provider (`expected: 0, actual: 1`). The
  new verdicts and scenarios do not exist there.
- **Sweep**: 24 of 24 mutants killed; the comment-only control survived.
  Every file was checked restored by checksum. The mutants cover:
  - `reuseVerdict`: not known, counts, a run job with no entry, a re-base,
    exact against fresh, overlapped, staged, nothing served;
  - the batch verdict's wiring and `needsObservation`;
  - the spend wall: its threshold, an unknown charge, the baseline, its
    wiring;
  - the image refusal and the press's preflight;
  - the Worker's switch, its reader, the container passthrough and the
    runtime field;
  - the Build's preflight, its no-image checks and its photograph-free
    overlap.
- **Related suites**: the canary files 595 of 595 and the Build file 21 of
  21. Doc tests 32 of 32.
- **Full suite**: `10425 / 10425 / 0 / 0` locally on the code of
  `1e853d92`.
- **Image prediction**: production `8d6dbcea93252fbb` →
  `9547695841a6c5ac` (205 inputs). Not built.
- **CI on `aa02672f`** (code plus records, one push): unit tests
  38123355384 green (4 m 56 s); site build 38123355338 green (all eight
  jobs).

## 8. What stays open — the completion criteria

- **Run the batch live**, in order, after the owner's approval and the steps
  in §4. Each press passes:
  - concurrency by recorded intervals (1, 2, 4);
  - known, valid per-job evidence with exact reuse (1, 2, 4);
  - every requested change in the final state (all);
  - no image bought (all);
  - spend inside the ceiling (all).
- **Record the real model's answer** in `acc-needs`, as one observation. Run
  it more than once before calling anything a rate.
- **The Build's overlap must show by bands or design agents** on the live
  flags. With neither split on for the account, it fails and says so.
- **Put `IMAGE_PURCHASES` back** to `on` (or leave it off) by the owner's
  choice, with a redeploy. Until then, every customer build gets no
  photographs.
- **Carried**:
  - real images remain unverified;
  - two substantive steps at once has never run live;
  - the canary reads `prepUse` only once this deploy is live.
