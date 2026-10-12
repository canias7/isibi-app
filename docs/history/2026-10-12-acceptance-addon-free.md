# 2026-10-12 — Round 16: the repair batch closed; the acceptance plan brought back to the goal, with image-free Add-on cases

**The review**: Codex reviewed `358dff0a` (round 15's code `754c4eb4` with its
records and CI stamp). **357 focused tests and both independent
requirement-retention reproductions passed.** The owner kept the fixes and
closed the repair batch.

**CI on the reviewed commit**: unit tests run 38196615855 `success` on
`358dff0a` — 10638 tests, 10597 passed, 0 failed, 41 skipped (CI skips what
needs the template's browser). Before it, unit tests 38195628173 and site
build 38195628259 `success` on `754c4eb4`, and unit tests 38196181952
`success` on `26cfcaf1`.

**This round changes the acceptance harness only**: scripts, tests, the
workflow's description and the plan. No product file, no container input. The
predicted image stays `1e30b6fb56b51794` (205 inputs; checked: no changed
file is an input). No paid test, fal call, merge, deploy, container build,
balance change or Build flag change; the 1-page / 15-component limits are
unchanged.

## 1. What the owner asked

Bring the acceptance handoff back to the goal — independent substantive work
running at the same time across Build, Edit and Add-on, real dependencies
waiting, successful work reused after questions or restarts — and:

- separate what is proved offline from what still needs live verification,
  from the evidence already there;
- add image-free Add-on scenarios, so independent additions can be tested
  without buying photographs: independent tasks inside one Add-on, and across
  separate request parts;
- name the evidence for execution overlap, correct final results, dependency
  ordering, reuse and no duplicate charges;
- reuse the existing tests and scripts, and add only what is missing.

## 2. What was missing

- **Every Add-on acceptance case involved a photograph** (the plan's §2 item
  6), so none could be pressed with purchases off.
- **Offline**, image-free Add-on overlap was shown only for a table beside a
  section (PI 24) and for an Add-on part beside an Edit part (PI 29). **Not
  shown**: a new page beside a section inside one Add-on, and two Add-on parts
  on two pages.
- **The press could not judge a section added to a page that exists**: the
  outcome check demanded every stored page byte for byte apart from headings
  and one line, and refused any new component unless a new page was asked.
- **Overlap inside one Add-on had no job-joined reading.** The designers'
  start and end marks go to `edit_traces`, which has no job column; the
  read-job lookup listed them only as candidates by site and time window.

## 3. What was added

**Scenarios** (`scripts/canary-ui.mjs`), each `images: "none"`, bound by
`ACCEPTANCE_CAP`, `fundsFirst`, on `fold-lane-bakery`, with no photograph,
form or table, and with words read off the live pages as not yet there:

| Scenario | Shape | Demands | Estimate |
|---|---|---|---|
| `acc-addon-inner` | a Delivery page with its menu link and a questions section on the Tasting Evenings page | the page, its link on every menu and the section; the router's shape recorded; the inside overlap read afterwards (§3 below) | 15–28 (budget 30) |
| `acc-addon-edit` | a questions section on the Bake List page and the Gallery heading | overlap by recorded intervals and one exact reuse; press only if its probe makes parts | 9–20 (budget 22) |
| `acc-addon-pair` | questions sections on the Visit and Starter pages | both sections; the router's shape recorded (expected one Add-on); no overlap demanded | 8–26 (budget 28) |

**Probes** S7–S9 in `acceptance-split-1` route each message first. The batch
is now 9 probes; its floor rises from 18 to 27 by the existing rule.

**`sections`** (`outcomeChecks`, `scripts/canary-requests.mjs`): the page
keeps everything it said and its photographs; it gains the words asked for,
on the page or in a component file the press added, which it did not already
say; the served page says them; a new component is allowed only beside an
asked-for section or a new page; every other page stays byte for byte as it
was.

**`addonDesignOverlap`** (`scripts/canary-read-job.mjs`), on the free
*read_job* box: the lookup now also reads every job on the site in the window.
The two designers' intervals are judged `overlapped` or `not-overlapped` only
when that job is the only job, and its trace the only trace, in the window;
otherwise `candidate-only`, and `unknown` when a read failed or events were
dropped. The account prints a `DESIGNERS` line.

**Offline cases** (`test/parallel-addon-independent.test.mjs`), through the
real driver, queue consumer, routes and job runner, by rendezvous:
- **PI 32**: one Add-on, a new page and a section on another page: the two
  designers run at the same time; both land; each designer and the page
  writer are asked once; nothing bought; no ledger ref repeated.
- **PI 33** (both orders): two Add-on parts on two pages: the second part's
  designer runs while the first's does; its job replays its preparation
  exactly (`staged yes, replayed ≥ 1, fresh 0`); both land; the home page
  untouched; nothing bought; no ledger ref repeated.

**Found while writing PI 32**, already designed and covered (PI 26): two
designers start together only when the picker states what each kind `uses`.
With nothing stated, the old order stands, and they ran one after the other.
Whether the real picker states it is a live question, now in the plan.

**Guards extended**, not rewritten: the cap, spend and form lists, the probe
coverage check and the menu-words list carry the three new scenarios.
`test/acceptance-addon-free.test.mjs` (9 cases): the scenarios' guards, the
probes, `sections` with negative controls, `addonDesignOverlap` across its
verdicts and through the real lookup, and the unverified note.

## 4. Verification

- **Red check**: the new test file over `358dff0a`'s scripts, in a throwaway
  worktree, fails at load (`addonDesignOverlap` is not there). PI 32 and PI 33
  pass on `358dff0a`, as they should: they add coverage of product behaviour
  that is already there, not a fix.
- **Mutation sweep** (`sweep21`, 4 test files, every anchor checked to occur
  once, from the round's working tree): **14 of 14 killed**, the comment-only
  control surviving. The mutants: the sole-candidate rule (always, and without
  the job itself), the crossing test, the row step counted, dropped events
  ignored, an unread window taken as read, an open designer ignored, and in
  `sections` the gain, the served page, lost words, the page's byte check,
  component words, the component allowance and the unverified note.
- Focused tests, the full suite, the consolidated acceptance sweep and CI:
  §5.

## 5. Results

See `docs/owner-notes.md` (round 16), which carries the measured numbers and
the CI runs for this round's commits.

## 6. What remains, by kind

- **Implementation defects known now**: none reproduced and open.
- **Needs live verification** (the plan's §2): the router's split; exact reuse
  of a scoped preparation live; whether the real picker states `uses`, which
  decides overlap inside one Add-on; whether a real model says `needs`; the
  image-free Build's overlap; real images (not proposed).
- **Limits**: inside-one-Add-on overlap is judged live only when the job is
  alone on the site in the window (the trace has no job column; adding one
  would be a product and schema change, not made). Paid acceptance stays
  blocked until the owner's spending decision.
