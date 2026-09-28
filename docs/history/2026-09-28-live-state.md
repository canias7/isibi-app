# CLAUDE.md's "Live state", as of 2026-09-28

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`): the balance readings
> since run 9, the live sites, measured build and add-on costs, and the
> site-build and unit-suite readings with how each was taken. CLAUDE.md's new
> **Live state** keeps the current numbers and the rules for taking a reading.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at its other sections.

## Live state

**READ THE LEDGER; DO NOT TRUST THIS LINE.** A stale number is worse than none,
because `buildFloor` refuses before spending and the refusal reads as a broken
build. **Balance 91** at run 32's end (2026-09-25, the section move: **101 → 91,
moved 10**, route 2 + the page rung's 8, closing exactly, on a run that
published; the ledger holds one reserve of 8 and no refund), **and run 33's free
press read 91 again** (2026-09-26 06:24Z, nothing spent between). **Balance 73**
at run 34's end (2026-09-26, Test 3: **91 → 73, moved 18**, route 2 + the page
rung's 16, closing exactly, on a run that published; the ledger holds one reserve
of 16 and no refund), **and read 73 again on 2026-09-26 at 20:46:59Z** off the
balance row the canary itself reads, matching the last ledger row (run 34's
reserve), and by the free presses of run 35 (21:08Z) and run 36 (21:36Z).
**Balance 65** at run 37's end (2026-09-26, Test 4a's Part A: **73 → 65, moved
8**, route 2 + the page rung's 6, closing exactly, on a run that published; the
ledger holds one reserve of 6 and no refund), read on the balance row at
22:05:27Z. **Balance 59** at run 39's end (2026-09-27, Test 4a's Parts B and C:
**65 → 59, moved 6**, routing 2 + 1 + 2 and one edit of 1, closing exactly, on
a run that published three times; the ledger holds one reserve of 1 and no
refund), read on the balance row at 00:45:33Z, and read 59 again by run 40's
free rehearsal (03:35Z), on the balance row at 03:43Z, on the balance row at
05:17:01Z after deploy 2163, by run 41's free rehearsal (05:37Z), and on the
balance row at 05:48:40Z after it (the last ledger row still run 39's reserve).
**Balance 56** at run 42's end (2026-09-27, Test 4b's D1: **59 → 56, moved
3**, routing 2 + the data rung's 1, closing exactly; the ledger holds one
reserve of 1 and no refund; a row edit publishes nothing), read on the balance
row at 06:13:03Z.
**Balance 53** at run 44's end (2026-09-27, the rules test: **56 → 53, moved
3**, routing 2 + the rules rung's 1, closing exactly; the ledger holds one
reserve of 1 and no refund; a rules edit publishes nothing), read on the
balance row at 17:52:51Z.
**Balance 50** at run 47's end (2026-09-27, Test 5's paid press: **53 → 50,
moved 3**, the two routing calls 2 + 1; both edits `billing: none` and
unpublished, so no ledger row; the newest is still run 44's reserve), read on
the balance row at 23:15Z.
**Balance 45** at run 49's end (2026-09-28, Test 5's paid retry: **50 → 45,
moved 5**, routing 2 + 1 and the menu edit's one reserve of 2, ledger row 333;
the page removal `exempt`, cost 0), and read 45 again by run 50's free restore
(18:41Z).
**Between run 31 and
run 32 the balance rose from 1 to 101** (read on the ledger at 18:09Z and by the
canary before its paid call). **Only the readings are recorded; how it rose is
not.** Run 31 ended at **1** (3 → 1, the routing call alone, the edit's
reservation refused `unbilled`), and the free runs 28 and 30 read **3**. **Balance 22** at run 24's end (2026-09-23, the replay: **46 → 22,
moved 24** — route 2 + the page rung's 22, closing exactly, on a run that
published), and **run 25's free press read 22 again** (09:17Z, nothing spent
between). **Balance 3** at run 26's end (2026-09-23, the correction: **22 → 3,
moved 19** — route 2 + the page rung's 17, closing exactly, on a run that
published). **Balance 46** at run 23's end (2026-09-23: **48 → 46, moved 2** — the
routing call; the edit escalated `no-page` at `cost: 0` and nothing published;
run 22's free restore read 48). **Balance 48** at run 21's end (2026-09-22, the places-left replay:
**65 → 48, moved 17** — route 2 + the page rung's 15, closing exactly, on a run
that published; runs 18–20 were free and read 65 each). **Balance 65** at run
17's end (2026-09-22, read by the canary at both
ends: **75 → 65, moved 10** — route 2 + the page rung's 8, the arithmetic
closing exactly, on a run that published). Before it, **balance 75** at run
14's end (2026-09-21: 77 → 75, **a NET movement of 2**, on a run whose outcome
the harness could not read; see run 14 below). **⚠ A NET MOVEMENT IS NOT A CHARGE
HISTORY** (owner, 2026-09-21): 2 is equally consistent with a routing call of 2
and with a routing call of 2 beside an edit charged 20 and refunded 20, and
only `edit_jobs.billing` and the `credit_events` rows separate them. **Every
figure on this line is a net reading** and the same caution applies to all of
them.
**✅ AND FOR RUN 14 THE LEDGER HAS NOW BEEN READ AND THE TRUE ANSWER IS A
THIRD VALUE** (read-job run 15, 2026-09-21T23:56Z): `billing: refunded,
cost 2`, with `reserve −2 after 73` and `refund +2 after 75` — so
**77 → 75 → 73 → 75**, a routing call of 2 beside an edit **charged 2 and
refunded 2**. **Neither guess named it**, which is the strongest form of the
rule this line states: a net reading does not merely fail to *choose* between
two histories, it can be consistent with a history nobody listed. The balance
of **75** is unchanged and now has a second, stronger reader behind it. Run 12 ended at 77 (79 → 77, net 2) — and **that one has a second,
stronger reader**: its terminal body states `cost: 0` for the edit in the
route's own words, which a balance cannot. Run 11 ended at 79 (101 → 79, net 22)
and run 9 at 101 (105 → 101, moved 4). It was 119 at run 52's end on
2026-09-20 and **14 went somewhere this session did not spend** — run 9's free
press read 105 before anything paid ran, which is exactly the reading a stale
line cannot give you. `GET /api/fal-balance` answers fal's, separately and
free.

- **The building account is `aniascristian@gmail.com`**, not the session's own
  address. It owns every live site and holds that balance. Look at the wrong row
  and the balance reads as zero.
- **Owner's live sites**: `northgroup-5`/`-9`…`-17`, `markbook-1`, `shoeroom-1`,
  `repairbench-1`, `fretwork-1`, `ashgrove-1`, `washhouse-1`,
  `ben-crowe-guitar`, plus older `fold-lane-bakery`, `harbourside-roast`,
  `the-lido-cafe`, `oak-and-ash`, `forno-and-co`. **Reusing one of those slugs
  REVISES that site.**
- **ON-PAGE PHOTOGRAPHS, measured SITE-WIDE** (walking every route in each
  sitemap and counting DISTINCT `<img src="/u/<slug>/…">`, which is what
  `photoUrls` counts; `og:image` excluded, since it is a share card and not a
  picture on a page): `fold-lane-bakery` **3**, `oak-and-ash` **3**,
  `shoeroom-1` **2**, `forno-and-co` **1**, everything else **0** —
  `fretwork-1` and `ashgrove-1` included, `ashgrove-1`'s one `/u/` url being
  og:image ALONE. **⚠ Three of these were once stamped as HOME-PAGE readings
  beside a SITE-WIDE route list**, which reads as a site-wide claim and is not
  one. **A COUNT OF `<img>` IS THE WRONG INSTRUMENT** — `fretwork-1` reads 3
  with zero photographs.
- **A BUILD AND A REVISE COST DIFFERENT MONEY, BOTH MEASURED.** A first build on
  grok is **11 to 45 credits** — run 91 (`coalhole-2`, one page, 8,967 chars, 0
  photographs) cost 11 and run 80 (`ashgrove-1`, one page, 2 photographs) cost
  45 — so **quote a range or measure the run**. A REVISE of the same site is
  **17**, because it anchors to the stored design. Addon runs measured: pageless
  **2** (run 52) and **3** (run 50), `function`+`page` **12** (run 49),
  `table`+`function`+`page` **13** (run 47), `page`+`qr`+a refused photograph
  **13** (run 51). **Nothing records what a build costs** — `gen_charges` is the
  media side's image ledger and `site_builds` has no cost column — so the
  balance before and after IS the measurement. **And ONE addon request makes
  SEVERAL sequenced reservations** with nothing summing them; `edit_reserve`
  raises only above **100,000**, so **no server-side per-request cap exists** and
  the account balance is the only bound that binds.
- **Analytics is collecting** since the CSP fix on 2026-08-15: 451 pageloads in
  the 7 days to 2026-08-28 across ~25 hostnames. `rum report` reads it free.
- **`site build` is 382/382, and SIXTEEN INDEPENDENT CI RUNS HAVE READ IT**
  across 2026-09-12 → 09-20, with kit-typecheck 4, contrast-cases 16,
  theme-seam 11, theme-render 29, site-routing 14, site-runtime 47 beside it and
  kit-render / kit-a11y / kit-effects / kit-paint each `all passed` with no
  count — **the three result SHAPES a census has to ask for**, since a scan for
  `N passed` alone finds seven of twelve and silently reports the other five as
  absent. **DERIVE the run count with a scan rather than taking the next ordinal
  in a sentence** — the chain drifted once with two entries both claiming "the
  twelfth" — and note that run 1065 read **373** and run 1115's count is
  recorded UNREAD, so neither is one of them. **The unit step's TAP is 397**,
  and it moved from 396 at `c2f6bb66` with nothing stamping it, because the two
  runs between were a docs commit and a run that failed at `npm ci`.
  **A count nobody re-measured is a claim ahead of its evidence in BOTH
  directions**: 382 was once stamped from a LOCAL run and the next CI read of it
  came back **381 passed, 1 failed** — the harness's own hardcoded fan-out
  ceiling, not the product.
  **AND THIS BRANCH HAS ITS OWN READS, NAMED RATHER THAN COUNTED**: run
  `35503280850` on `ecd3184d`, run **`35542140721` on `903b5ea2`**, run
  **`35545181566` on `0523dfb1`**, run **`35546983002` on `e0540f37`**
  (2026-09-21, 23m54s), run **`35554760166` on `38d934a2`**
  (2026-09-21, 02:36:53 → 03:00:33Z, **23m40s**) and run **`35574816749` on
  `0d15ab4c`** (2026-09-21, 07:49:53 → 08:11:28Z, **21m35s**) — all six **all
  twenty steps green and every figure above matching**: TAP 397, kit-typecheck 4,
  site-build **382**, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47, and kit-render / kit-a11y / kit-effects /
  kit-paint `all passed`. The second was read out of the twenty-three downloaded
  per-step files rather than the flat log, so the attribution is the
  archive's own; the fifth and sixth were read landmark-to-landmark off the flat
  log, **all twelve counts in one pass with every shape asked for separately**,
  and both came back step by step in the workflow's own order. **The sixteen is
  deliberately NOT incremented**: that number is a scan's answer, and the rule
  two lines up is exactly about taking the next ordinal instead of re-deriving
  it. (**"All six" IS auditable** — it is a count of the named runs on this
  line, which is a different kind of number from a scan's.)
  **THE CENSUS OF SHAPES IS THE OBSERVER'S OWN PROOF, and on run 1238 it closes
  exactly**: `N passed` **7** + `all passed` **4** + TAP **1** = **12**, the
  twelve steps that report. A scan finding eleven has lost one silently, and
  the sum is what says it has not.
  **⚠ 21m35s IS ~2 MINUTES UNDER THE OTHER TWO READS AND IS RECORDED RATHER
  THAN EXPLAINED.** Every count matched, so it is runner speed rather than work
  skipped; there is no per-step baseline from the earlier runs to compare it
  against, and inventing one would be arithmetic off a paragraph.
  **⚠ A GREEN `site build` CARRIES TWO `##[error]` ANNOTATIONS, AND THEY ARE THE
  HARNESS DOING ITS JOB.** GitHub annotates any line in `tsc`'s own error format,
  and `site-build.mjs` deliberately builds a page with a type error to prove
  *"tsc REPORTS; only `vite` refuses"* — measured on run `35554760166`:
  `src/routes/index.tsx(50,13) TS2322` and `src/routes/menu.tsx(27,17) TS2339`,
  each immediately followed by its own `ok` line, inside the step that ends
  **382 passed, 0 failed**. **A scan for red words answers TWO on a run whose
  conclusion is `success`**, so read what the annotation sits next to rather than
  counting it. (`SSR stream transform exceeded maximum lifetime (120000ms)` is
  the same shape, twice, and is also inside passing cases.)
- **READ THE COUNTS OUT OF THE RUN'S PER-STEP LOG FILES**, which attribute by
  construction rather than by a window somebody drew. The flat-log alternative
  is landmark-to-landmark (`##[group]Run …` to the NEXT one, because GitHub
  wraps only the command echo and the OUTPUT follows `##[endgroup]`), and the
  two agree exactly — the same twelve steps, the same counts. **A census that
  anchors TAP at the start of a line finds eleven of twelve**, because a GitHub
  log line carries a timestamp prefix.
- **THE JOB HAS TWENTY STEPS AND THE API ANSWERS 23** — three are GitHub's own
  (two `Post …` and **`Complete job`**, which is not named like one), so
  `len(steps)` and a `startsWith("Post ")` filter both answer wrongly.
- **Unit suite: 7,119, BOTH HALVES TAKEN** (2026-09-21, the unprinted
  transaction lines) — locally `# tests 7119 / # pass 7119 / # fail 0 /
  # skipped 0`, `duration_ms 111,953`, and CI run **`35667246371` on
  `66c45d0f`** at **`# tests 7119 / # pass 7115 / # fail 0 / # skipped 4`**,
  `duration_ms 112,524`. **THE TOTAL IS WHAT MATCHES** — 7,119 both sides,
  `pass` differing by exactly CI's own four skips. **The +1 is the difference
  between two measured readings**, 7,118 → 7,119: the one case asserting a
  readable ledger prints a line per row.
- **Unit suite: 7,118, BOTH HALVES TAKEN** (2026-09-21, the reader's own wiring
  hole) — locally `# tests 7118 / # pass 7118 / # fail 0 / # skipped 0`,
  `duration_ms 112,388`, and CI run **`35666256160` on `e7f0e82f`** at
  **`# tests 7118 / # pass 7114 / # fail 0 / # skipped 4`**, `duration_ms
  113,629`. **THE TOTAL IS WHAT MATCHES** — 7,118 both sides, `pass` differing
  by exactly CI's own four skips. **The +2 is the difference between two
  measured readings**, 7,116 → 7,118: the census over the REAL Supabase getter,
  and the case driving all three reads against a non-list body.
- **Unit suite: 7,116, BOTH HALVES TAKEN** (2026-09-21, the unreadable-ledger
  correction) — locally `# tests 7116 / # pass 7116 / # fail 0 / # skipped 0`,
  `duration_ms 113,677`, and CI run **`35665789941` on `04f1897c`** at
  **`# tests 7116 / # pass 7112 / # fail 0 / # skipped 4`**, `duration_ms
  106,086`. **THE TOTAL IS WHAT MATCHES** — 7,116 both sides, `pass` differing
  by exactly CI's own four skips, which is this file's standing reading of that
  gap and not a regression. **The +6 is the difference between two measured
  readings**, 7,110 → 7,116: `test/canary-read-job.test.mjs` goes 20 → 26
  cases, the six being the unreadable-read loop (three shapes), the
  missing-read argument, the non-list-200, the PRINTED ACCOUNT under a failed
  read, the successful-empty CONTROL, and the no-rows-listed-under-a-refusal
  case.
- **Unit suite: 7,110, BOTH HALVES TAKEN** (2026-09-21, the read-only job
  lookup) — locally `# tests 7110 / # pass 7110 / # fail 0 / # skipped 0`,
  `duration_ms 112,947`, and CI run **`35659172717` on `f662d68d`** at
  **`# tests 7110 / # pass 7106 / # fail 0 / # skipped 4`**, `duration_ms
  113,158`. **THE TOTAL IS WHAT MATCHES** — 7,110 both sides, `pass` differing
  by exactly CI's own four skips, which is this file's standing reading of that
  gap and not a regression. **The +20 is the difference between two measured
  readings**: `test/canary-read-job.test.mjs` arriving with twenty cases.
  **AND THE STAMP CHAIN'S OWN ENDPOINT AGREES**: `283046ba`, the last commit
  that moved a test or product file, reads **`7110 / 7106 / 0 / 4`** on CI run
  **`35659338080`** — the ref-shape correction added an ASSERTION to an
  existing case, so it moved the count by zero, and a current-and-parent pair
  off the same machine is what settles that rather than an argument about what
  an assertion costs.
- **Unit suite: 7,090, BOTH HALVES TAKEN** (2026-09-21, the run-14 harness
  corrections) — locally `# tests 7090 / # pass 7090 / # fail 0 / # skipped 0`,
  `duration_ms 117,987`, and CI run **`35655515164` on `c0dcd60e`** at
  **`# tests 7090 / # pass 7086 / # fail 0 / # skipped 4`**. **THE TOTAL IS
  WHAT MATCHES** — 7,090 both sides, with `pass` differing by exactly CI's own
  four skips, which is this file's standing reading of that gap and not a
  regression. **The +12 is the difference between two measured readings**:
  `test/canary-watch.test.mjs` arriving with twelve cases. The re-anchored
  `edit-canary` guard added none — it is the same case asserting the same
  property through a wider landmark.
- **Unit suite: 7,078 LOCALLY, and the CI half of THAT reading is UNREAD** —
  `# tests 7078 / # pass 7078 / # fail 0 / # skipped 0`, `duration_ms 111,643`,
  taken 2026-09-21 on the three bounded corrections. **The +7 is the difference
  between two measured readings**: `edit-rules-backend` goes 8 → 15 cases.
  `site-owner`'s re-anchored guard added none — it is the same case asserting
  the same property through a window instead of a line. **Say which half is
  taken**: a local number beside an unread CI run is ONE reading.
  **⚠ AND THE FIRST RUN OF IT WAS 7,078 WITH ONE FAILURE**, which was a
  PRE-EXISTING guard going red on a COMMENT — see the re-anchor above.
- **Unit suite: 7,071, BOTH HALVES TAKEN** (2026-09-21, the run-12 product
  fixes) — locally `# tests 7071 / # pass 7071 / # fail 0 / # skipped 0`,
  `duration_ms 111,743`, and CI run **`35574816773` on `0d15ab4c`** at
  **`# tests 7071 / # pass 7067 / # fail 0 / # skipped 4`**, `duration_ms
  113,310`. **THE TOTAL IS WHAT MATCHES** — 7,071 both sides, with `pass`
  differing by exactly CI's own four skips, which is this file's standing
  reading of that gap and not a regression. **The +14 is the difference between
  two measured readings, never arithmetic off a paragraph**: 7,057 → 7,071 is
  this round's own fourteen — eight in `edit-rules-backend` and six in
  `ask-router-display`.
  **⚠ AND THE FIRST RUN OF IT WAS 7,070/1.** Two PRE-EXISTING guards went red
  on honest changes, and neither was appeased: `site-apply`'s was pinned to the
  spelling `if (!rdb) return escalate("no-backend")` and `site-delete`'s to an
  EXACT COUNT of `eAnswer` call sites (`=== 2`). Both re-anchored on the
  property they describe. *A guard pinned to a spelling reports an honest
  change as the feature going away* — twice in one round, in guards written by
  earlier sessions of this same work.
- **Unit suite: 7,057 LOCALLY, and the CI half of that reading is UNREAD** —
  `# tests 7057 / # pass 7057 / # fail 0 / # skipped 0`, `duration_ms 111,992`,
  taken 2026-09-21 on run 12's docs-and-guards commit. 7,053 → 7,057 was that
  round's own four cases — three escalate-action cases in `edit-browser-reply`
  and one capture-wiring case in `edit-canary`.
- **Unit suite: 7,053, BOTH HALVES TAKEN, AND THE DOCS COMMIT MOVED IT BY ZERO**
  (2026-09-21, run 11's docs). **CI runs 2862 (the parent) and 2864 (the
  current) BOTH read `7,053 total / 7,049 passed / 0 failed / 4 skipped`** —
  the parent-and-current pair is what settles *the docs change did not increase
  the count*, and it is a stronger reading than a local baseline because both
  halves come off the same machine. Locally the same tree reads
  `# tests 7053 / # pass 7053 / # fail 0 / # skipped 0`, `duration_ms 111,174`.
  **⚠ AND THE THREE READINGS ARE THE CLEANEST DEMONSTRATION THIS FILE HAS OF
  *THE TOTAL IS THE ONLY COMPARABLE NUMBER*.** One tree, one day, **three
  different pass/skip splits and ONE total**: the main checkout `7053/0`, a
  worktree at the parent `7051/2`, CI `7049/4`. A stamp comparing `pass` would
  have reported a two-test regression against the worktree and a four-test one
  against CI, and **neither exists**. What moves is the SANDBOX — a worktree's
  linked `node_modules`, CI's own four — never the suite.
  **⚠ AND THE +1 AGAINST THE PREVIOUS LOCAL READING OF 7,052 IS UNEXPLAINED AND
  PREDATES THIS COMMIT.** 7,052 was taken earlier the same day after the
  edit-canary work (`# tests 7052 / # pass 7052 / # fail 0 / # skipped 0`, the
  four being that round's own cases in `test/edit-canary.test.mjs`, 7,048 →
  7,052). Every commit between it and `4e2c076a` is docs-only, and the two
  tests that PARSE `docs/owner-notes.md` read **31/31 on both sides**, so the
  docs are ruled out as the cause. **It is recorded as unexplained rather than
  reconciled and NO further investigation is owed** (owner) — a count nobody
  can attribute is not a count to argue from, and the parent/current CI pair
  already answers the only question the milestone needed.
- **Unit suite: 7,048, BOTH HALVES TAKEN** (2026-09-21) — locally, and CI run
  **`35554760170` on `38d934a2`** at **`# tests 7048 / # pass 7044 / # fail 0
  / # skipped 4`**. The eight are this round's own: five tweak-rung cases, the
  `sameProse` bypass census, and the two scoped-wording cases — **stated as the
  difference between two measured readings**, 7,040 → 7,048, never arithmetic
  off a paragraph.
  **⚠ AND THE LOCAL RUN READ `# skipped 0` WHERE CI READ 4 — MEASURED ON THIS
  VERY PAIR, and it is the cleanest demonstration this file has of why THE
  TOTAL IS THE ONLY COMPARABLE NUMBER.** Every earlier local run read 4 as
  well, so the sandbox moved rather than the suite; `pass` differed by exactly
  those four (7,048 against 7,044) while the totals were equal. A stamp
  comparing `pass` would have reported a four-test regression that does not
  exist.
  The reading before it had both halves at **7,040** — locally, and CI run
  **`35547698419` on `9a56cacc`** at **`# tests 7040 / # pass 7036 / # fail 0
  / # skipped 4`**. The two readings before that also agreed both ways: **7,038**
  locally and CI run **`35546983030` on `e0540f37`** at
  **`# tests 7038 / # pass 7034 / # fail 0 / # skipped 4`**; before that
  **7,033** locally and CI run **`35545181576` on
  `0523dfb1`** at **`# tests 7033 / # pass 7029 / # fail 0 / # skipped 4`** —
  the four being the privilege-drop case, two RTL cases and
  `site-searchpath`'s baseline-commit case. **THE TOTAL IS WHAT MATCHES** — a
  `pass` count alone drifts between the two machines by exactly those four —
  and there the totals were equal, 7,033 both sides. The two before that:
  **7,026** on `903b5ea2` (CI run `35542140722` at `7,022 / 0 / 4`) and
  **7,005** on `2c596bc5` (CI run `35504473370` at `7,001 / 0 / 4`).
  **EACH STEP IS THE DIFFERENCE BETWEEN TWO MEASURED READINGS**, never
  arithmetic off a paragraph: 7,033 → 7,038 is five new route cases in
  `edit-page-protect`, and 7,038 → 7,040 is the two the silent partial needed;
  the +7 before all of them was that file arriving.
  **THE `7,022 / 0 / 4` WAS WRITTEN HERE AS AN EXPECTATION AND BECAME A
  MEASUREMENT, and only the second kind is worth anything** — it happened to
  have been right, which is exactly the case where a paragraph quietly turns
  into evidence if nobody stamps the run that settled it.
  It was 6,992 at `26f52f95` and 7,005 before the edit-path work.
  **⚠ AND `9a56cacc` HAS NO `site build` RUN AT ALL, WHICH IS THE `paths`
  FILTER AND NOT A MISSING RUN** — it touched `CLAUDE.md`,
  `docs/owner-notes.md`, `public/chat.js`, `scripts/addon-sweep.mjs` and two
  unit test files, and **not one of those is in `site-build.yml`'s `paths`**
  (`builder/**`, `worker.js`, root `*.mjs` — `scripts/*.mjs` is NOT root —
  `Dockerfile`, `.dockerignore`, `package.json`/`-lock`, the workflow's own
  file, and **eleven `test/integration/` files plus `test/page-gen.test.mjs`
  NAMED ONE BY ONE — not a `test/**` glob**, so a test file added anywhere
  else, this round's two included, fires nothing).
  **NO RUN, not a fast one**, the shape the deploy section records one layer
  up. The last commit touching those paths is `e0540f37`, whose run is stamped
  with the other three above. **Say which of the two it is by reading the
  commit's own file list against that `paths` block** — a listing with no run
  in it reads identically to a run that never fired.
  - **Run it as `node --test "test/*.test.mjs"`** — the quoted glob.
    `node --test test/` reads the directory as a MODULE path and answers
    `MODULE_NOT_FOUND` as one failing "test".
  - **In this sandbox the harness needs `playwright-core` at the root**
    (`npm i --no-save playwright-core@<the template's version>`), and **a
    worktree needs `node_modules` linked in** or four files answer `# tests 1` —
    one failing "test" is a file that would not LOAD.
  - **Run it with nothing else of its own already running**: a leftover
    `build-server.mjs` makes the new one's `listen` throw and every streaming leg
    report "0 reports arrived". Check `pgrep -a -f build-server.mjs` and kill by
    PID — killing the harness by PID orphans that child.
  - **MEASURE A BASELINE IN A WORKTREE; NEVER SUBTRACT FROM A PARAGRAPH.** A
    suite number derived by arithmetic off two remembered baselines has been
    wrong twice, each time closing against itself and against nothing else.
  - **THE STAMP CHAIN ENDS AT THE LAST COMMIT THAT MOVED A TEST OR PRODUCT
    FILE**, or it is an infinite regress: a docs-only push starts a run that
    reads the same number, which would want its own stamp. **A reading that is
    not new is where it stops** — but **read every run anyway**, because
    `brand-rename` and `media-deleted` PARSE `docs/owner-notes.md` and a
    docs-only push really can turn the suite red.
- **Default builder model is Grok** (`DEFAULT_PICKER`), ~3.5× cheaper than
  Sonnet on a comparable site and ~3× slower on the pages call.
- **A cold new account is one credit short of building**: `buildFloor(sonnet)`
  is 20, the grant is 20, and the routing call spends 1 first. Owner's call is to
  fund the test account rather than raise the grant.

---

