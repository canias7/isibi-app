# The verification gate and the combined release plan (2026-10-07)

The owner, after Codex reviewed `092ff48a`: *"Codex reviewed 092ff48a and
independently passed 90 assertions against the current provisioner and
project-search functions, covering uncertain creation, delayed visibility,
repeated retries, eventual adoption, reuse and incomplete pagination. Preserve
these fixes and close the remaining verification gate without starting another
product audit. Rerun the failed or cancelled jobs in site-build workflow run
37674861320 yourself, then verify the aggregate gate includes every required
shard and check for the matching code inputs … If Chromium installation stalls
again, diagnose that setup failure and make a focused correction if needed,
preserving all tests and their assertions. Once the gate is green, update
owner-notes with the exact reviewed commit, rerun attempt, results and
remaining operational limitation that an uncertain database creation can
require manual settlement. In the same handoff, prepare the concrete release
and combined Edit/Add-on verification plan … Do all preparation now, but keep
the branch unmerged and do not deploy, build the container image, provision
live resources or run paid tests until I approve that release plan."*

On the branch, unmerged. Nothing deployed, no container built, no live
resource provisioned, no model called, nothing paid.

## 1. The reviewed commit

**Codex reviewed `092ff48a`** and passed 90 assertions of its own against the
provisioner and the project search: uncertain creation, delayed visibility,
repeated retries, eventual adoption, reuse and incomplete pagination. The fixes
are kept as reviewed: nothing in `site-provision.mjs` or `site-db.mjs` has
changed since (`git diff 092ff48a -- site-provision.mjs site-db.mjs` is
empty at this round's commits).

## 2. The site build's gate on `570adb45`

**Run 37674861320** (the push of `570adb45`, 19:29–19:50 UTC), not complete:
- **Green**: the published-site checks; shards 3 and 4 (158 and 62 checks,
  sixteen and eight sections); the kit job's first steps (`page-gen` and
  `publish-pages` 398 of 398, `kit-typecheck` 4 passed, `kit-render` all
  passed).
- **Stopped at their 20-minute limit**: the theme checks, shards 1 and 2, and
  the rest of the kit job — each inside `npx playwright install --with-deps
  chromium`, where apt waited on `https://archive.ubuntu.com/ubuntu
  noble-security InRelease` from 19:30 UTC until the limit. None of their
  tests started.
- **The gate** (`all checks`) failed on exactly that: the kit, theme and
  shards jobs cancelled, no report from shards 1 and 2, and the sections
  `style-overrides`, `logo-and-serving` and `dead-link` run 0 times. Its
  inputs: `de6345b9058cd1cc` (3,974 files).
- **Not seen before**: the only other site build on this branch to lose jobs
  recently, run 37371311514 on 2026-10-05, lost them to GitHub giving no
  runner (*"The job was not acquired by Runner of type hosted"*, zero steps
  ran), not to this install.

**The re-run**: the session sent the one request the owner asked for —
re-run the failed jobs of run 37674861320 — between 20:16 and 20:41 UTC. It
answered **403** (*"Resource not accessible by integration"*): the session's
GitHub access cannot re-run a job, as it cannot dispatch one. Under the
owner's rule (2026-09-26: *"If dispatch still returns 403, stop retrying"*)
it was not tried again, through this client or any other. **The re-run is the
owner's press**: *Actions → site build → run 37674861320 → Re-run jobs →
Re-run failed jobs*.

**The eight steps that never ran, run locally** on `570adb45` (a clean tree,
Chromium at `/opt/pw-browsers`, each as the workflow runs it; 19:54–20:10
UTC), all passing:

| Step | Result |
|---|---|
| `contrast-cases` | 16 of 16 |
| `kit-a11y` | all passed (2,626 named controls across 2,008 components) |
| `kit-effects` | all passed (2,068 components mounted and unmounted) |
| `kit-paint` | all passed, light and dark |
| `theme-seam` | 11 of 11 |
| `theme-render` | 29 of 29 |
| `site-build.mjs`, shard 1 | 109 of 109 (`style-overrides`), completed |
| `site-build.mjs`, shard 2 | 76 of 76 (`logo-and-serving` 70, `dead-link` 5, the preamble 1), completed |

A local run is not the gate: CI's own reading needs the re-run.

**No workflow correction**: the owner made one conditional on the install
stalling again; it has stalled once. Recorded in the backlog.

**The inputs**: the gate's fingerprint is `de6345b9058cd1cc` at `570adb45`,
at `092ff48a` and at `b791dec0` (3,974 files, read at each), none of whose files
is one of its inputs. So a green re-run on `570adb45` is evidence for the
candidate.

## 3. The release plan

`docs/investigations/combined-release-plan.md`, for the owner's approval:
- **The release**: one fast-forward of `main` (`bcc22295` → the candidate),
  its one deploy, **one container build**, `5f946c22d42a1b10` (195 inputs) →
  `335396c8c0e0fbcb` (196 inputs; seventeen differ, the new
  `builder/seed-rows.mjs` among them), predicted with the deploy's own
  functions at `092ff48a` and at this round's head. Progress stays on.
- **The served file**: `chat.js`, 920,280 bytes `0e68e3242f209272…` as
  served at 20:41 UTC (`main`'s), 939,255 bytes `dfa075929c9889e0…` merged.
- **The live check**: one press, `lv-combined`, three messages on the bakery —
  a menu link named before the page it needs and that page (no form, no
  table), read to its end in a fresh browser session once a progress line
  shows; the Order heading and a TikTok footer link whose address the message
  leaves out, ending on the link step's question; the answer.
- **The money**: about 28 credits (22–38); budget 38; hard cap 40; the
  balance, 10 at 20:42 UTC (ledger row 401, no job open), raised to exactly
  40.
- **The stop conditions**, the evidence kept apart, the limitations, and each
  press's boxes by their descriptions.

## 4. The preparation

**Why three messages.** One press covers all six things the owner named. A
question's message is ended by the canary only once nothing else runs
(`questionShown`), and its check requires the same, so the question cannot
share a message with the long page build; the long build stays in message 1,
where progress and the closed tab are judged, and the question and its answer
take messages 2 and 3 (R3's shape, run 99). The bounds — 14, 6 and 7 minutes,
with a minute's reply floor each — fill the press's 30.

**The bakery, read first** (free, before 20:41 UTC): its ten pages' headings,
menus and footers. The footer already links Instagram and Facebook, and earlier presses
changed most headings, so the scenario uses a TikTok link (a network the menu
step knows, `builder/site-nav.mjs`), the Order page's untouched heading and a
page no scenario asked for.

**A gap found and closed in the canary**: the order check
(`jobOrderVerdict`) read only the request's own route's readings. A message
read in a fresh browser session has its route read only through the requests
list while its tab is closed — about two readings in the live press — so its
order rested on almost nothing. It now also reads every reading of the
request's card, in the sending tab and in the fresh session (the page's own
kept statuses, kept whenever they change).

| # | Commit | What |
|---|---|---|
| F1 | `b791dec0` | Canary: the combined release check, three messages; the order check reads the card of a fresh-session message; the plan and the tests |
| F2 | these records | the verification gate, the release plan, the handoff |

## 5. The tests

- `test/canary-combined.test.mjs`, 9 cases: the scenario's shape, bounds and
  walls; fresh on the bakery; the plan and the form carrying its words,
  budget and cap; the press driven end to end through the stand-in app (the
  fresh session, the question from that session's tab, the answer resuming
  the part; every message check, the eight progress checks, every reply and
  all six coverages); a link that ran before its page failing the order
  check by name; and each stop condition (no question, progress off, a
  balance outside 38 to 40 — sent at either end — the budget spent before
  message 2, message 1 never ending).
- The order check's card cases in `test/canary-requests.test.mjs`; the
  scenario lists in `test/canary-form.test.mjs` and
  `test/canary-menu-label.test.mjs` gain the new scenario.
- Every canary test file: 21 files, 496 of 496.
- **Red check** on `092ff48a`'s canary scripts with the new tests: 11 of 86
  fail — 8 of the new file's 9 (no scenario; the freshness case passes
  vacuously), the two scenario lists, and the card case on the old order
  check.
- **Sweep** (`scripts/mutants/combined-check.json`): 18 of 18 killed, the comment-only control survived
- **The full suite**: **9885 tests, 9885 pass, 0 fail, 0 skipped**
- Unit CI on `b791dec0`: run 37686599138, `9885 / 9863 / 0 / 22`, the total matching the local run (the 22 real-browser cases skipped, as on every CI run); no site build ran, since none of its inputs changed.

## 6. What stays open

- **The gate**: the owner's re-run of run 37674861320; the session then reads
  it (every job, the gate, four shard reports, every section once, the
  inputs) and records it.
- **The plan**: the owner's approval. Until then nothing is merged, deployed,
  built, provisioned or paid.
- **An uncertain database creation can require manual settlement** (the
  recovery correction's limitation, unchanged): a create Neon answered with
  anything but its own refusal, whose project never shows under its attempt's
  name, keeps that site from making a database until the owner settles the
  note by hand.
