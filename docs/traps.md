# The traps

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in the second pass
> of its cleanup (the file as it stood: `git show 28bdc97f:CLAUDE.md`).
> CLAUDE.md keeps the ten met most often, a line each, and points here. **Read
> this before writing a guard, a sweep, a harness or a CI reader.**
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## THE TRAPS

Every one has cost at least one session, most several. **Read this before writing
a guard.** The stories are in `git show a4d0f5e5:CLAUDE.md`; what is here is the
rule and the measurement.

### Guards that pass while the thing is broken

- **THE WIRING LAYER.** Twelve-plus features have shipped DEAD with the module
  perfectly correct and one hop cut — a value computed and never forwarded, a dep
  injected and never called, a field decided and never put on the wire. From
  outside, "the model did not set it" and "we did not forward it" are the same
  `undefined`. **Before rewording a prompt because a field came back empty, check
  that the field can arrive.** Derive the chain from the PRODUCER.
  **AND A GUARD CAN COVER THE CHAIN AND STILL MISS A HOP**: the Code tab's guard
  asserted the tab twice, asserted the loader, drove both handlers, and never read
  the branch that renders the host — which kept its old `!isReact &&`. *A hop
  nobody listed is a hop nobody guards.*
  **The membership test that finds this class**: a design field must be in
  `PLAN_KEYS`, or on `EDIT_FIELDS`, or have a named per-field hop. A dotted
  `designed.<field>` scan answers 0 for six perfectly wired fields.
- **A CHAIN TEST THAT READ THE MODULES INSTEAD OF RUNNING THEM.** A case called
  "THE CHAIN" that reads SOURCE is asserted at the layer below the break. Nothing
  had ever compiled a build carrying a `gif` or a `qr` despite such a case.
- **A GUARD WATCHING THE LAYER BELOW THE BREAK** — it asserts the plumbing and not
  the connection: "the query selects the column" while nothing carries it onward.
- **A TEXT-ORDER GUARD SURVIVES A MOVE INTO A CLOSURE.** Three guards asserted
  "the pageless answer comes AFTER the apply" as `indexOf(a) < indexOf(b)` and all
  three stayed GREEN when the apply moved into a closure run from two places. A
  position in the file is a claim about run order only while the code between is
  straight-line. Read the CALL inside the block it describes.
- **VACUOUS ORDERING.** `indexOf(a) < indexOf(b)` passes when `a` is the thing
  deleted (-1 < anything). Prove both anchors exist first.
- **AND ITS MIRROR: A POSITIONAL GUARD CANNOT SEE A DEAD BRANCH.** `if (false) {…}`
  leaves every landmark at the same offset; `if (false) foo()` leaves `foo(` in the
  file. **A position is not a behaviour** — cut the block out and RUN it.
- **A NEGATIVE ASSERTION MUST PROVE ITS OBSERVER IS ALIVE.** `[].every(...)` is
  `true`. Assert a floor on what was SCANNED before believing an absence — and
  **a floor on the ANSWER is not the same thing**: `service-table-grants` proved
  its scanner alive with `seen.size >= 2` and went on passing for a stage off a
  file nothing served.
- **A GUARD PROVES THE BRANCH IT DRIVES**, and no other. A mutant of the obj-form
  survived because the guard drove only the JSX form.

### Reading source with a regex

- **ASSERT THE PROPERTY, NOT THE SPELLING.** The single most repeated own-goal. A
  guard pinned to `foo(a, b)` goes red the moment an honest third argument
  arrives, reporting the feature as gone. **AND ITS QUIETEST FORM IS PINNING A
  LIST BY ITS LAST ELEMENT** — being last is almost never the property;
  membership is.
- **NEVER SIZE A SOURCE-READ WINDOW IN BYTES.** Ten-plus instances. This repo puts
  its reasoning in comments, so any byte window is outrun by the next comment.
  Window landmark to landmark and **assert both landmarks exist** — `indexOf`
  answering -1 gives `slice(-1,-1)` = `""`, which passes everything inside it.
  **`slice(start, -1)` is the other half**: a missing END landmark swallows the
  file. **And a byte bound outlives the comment that outran it**: the addon
  route's validation window ran to a DISTANT neighbour, a sibling block was
  inserted between the two landmarks, and the window went from ~2.6 KB to
  **4,261 bytes** — reporting the block it describes as broken by a block that
  is not it. Close on the NEXT SIBLING, and on **CODE, never a heading comment**,
  when the scan reads a blanked source.
- **OVERLAPPING WINDOWS.** A window running to a NAMED neighbour swallows whatever
  is inserted between them. Derive the closing landmark from the next sibling,
  **search it FROM the opening one** (`indexOf(end, at)`) and assert `end > at`.
  A landmark is only unique until somebody writes about it upstream, and **a
  description that explains its own exceptions will always name the other
  sections**. And **a window can grow QUIETLY rather than go red**, which is the
  dangerous half: `site-share`'s window silently doubled and every assertion in it
  went on passing over a region twice the size it describes.
- **PROSE CONTAINS THE THING IT FORBIDS.** Ten-plus instances, several inside the
  guard written for that trap, and **twice in one session inside LIVE checks**.
  Blank whole-line comments (length-preserving) before any scan. A comment about a
  name is not a second reader of it.
- **THE BLANKER'S ORDER IS ITSELF A TRAP: LINE COMMENTS FIRST, block openers only
  at the start of a line.** `chat.js` carries `// Every /api/* call …`, whose `/*`
  opened a false block running **71,729 characters**; **37.1% of the visible source
  survived** and three tests reported a feature gone on a change that never touched
  it. **A survival RATIO is the wrong observer** — chat.js is 50.1% comments.
  **Assert that the landmarks the scan is about to look for survived the blanking.**
- **A BLANKER ERASES THE LANDMARK THE GUARD NEEDS** — the mirror. Blanking is for
  scans that FORBID a spelling; a scan that REQUIRES one finds its boundaries on
  the raw text and blanks only the body between them.
- **FLAT SCANS WHERE DEPTH MATTERS.** Written wrong five-plus times, and **twice
  in one sitting on 2026-09-14**: `newJobId\(([^)]*)\)` stops at the `)` inside
  `(b) =>` and reported the two CORRECT call sites as broken; `[^}]*` stops inside
  `${sayNotJson(j)}`. Argument lists, object literals and selector lists all need
  a depth-aware splitter.
- **A NEEDLE THAT CAN MATCH A DECLARATION CANNOT PROVE A CALL; a needle that can
  match a LONGER NAME cannot prove a class.** Three instances in one week:
  `buySitePhotos\(env, \{ slug, pages, parts,` also matches the function's own
  signature, so a mutant cutting the parts off the CALL survived;
  `includes("st-code-bar")` is satisfied by `st-code-bar2`; `stPub` is a substring
  of `stPublish`. Assert `class="x"` with its quote, or walk the argument list
  depth-aware.

### Mutation sweeps

- **INERT MUTANTS.** Sixteen-plus recorded. A mutation that changes no behaviour
  reads exactly like a test gap. **Prove it inert by MEASURING both versions over
  the real corpus** before hunting.
- **…AND A MUTANT YOU WROTE CAN BE INERT TOO — read what it DOES, not what it
  was meant to do (2026-09-17, two in one spec).** Two shapes, both found by
  measuring rather than by reading: a change **undone by the line after it** (it
  set a flag above a `return`, so the same refusal went out and nothing about
  the request moved), and a change to a value that is **provably constant on
  every path a test can reach** (`cost: aCost` where `let aCost = 0` has its one
  assignment under a branch the synchronous path never takes — so it *was*
  `cost: 0` there, while being a real difference on the job path). Both read as
  guard gaps and neither was one. **A survivor is a question about the mutant
  first and the guards second.**
- **TWO REDUNDANT DEFENCES CANNOT BE KILLED ONE AT A TIME.** A survivor is not
  always a missing check; sometimes it is a second wall. Measure both versions,
  then mutate the PAIR, which must die — and **say in the code that the redundancy
  is deliberate**, because a sweep cannot and the next session deletes what
  nothing appears to need.
- **A TEST-SIDE MUTANT IS USUALLY INERT BY CONSTRUCTION.** Weakening a guard's own
  assertion is not a behaviour change, so no other test can catch it. **Give the
  property an OBSERVABLE half and mutate THAT.** One pass had 17 mutants and 10
  survivors, not one of them a guard gap.
- **A MUTANT THAT NEVER APPLIED.** `grep -qF "$to"` is vacuous when the replacement
  is empty or common — verify by CHECKSUM, and **check every anchor occurs exactly
  once BEFORE the run** rather than reading NOT APPLIED afterwards. **A sweep whose
  control never applied is a sweep with no control.**
- **A MUTANT WHOSE ANCHOR IS A SUBSTRING OF ANOTHER'S** — an 8-space-indented line
  contained in its 14-space twin. Anchor with the neighbour.
- **`—` IN THE SOURCE, A DASH IN THE SPEC.** A sweep once reported 12/12 clean
  while the single most important mutant had not run. **MEASURED: `chat.js` carries
  837 real em dashes against 20 escapes.** A NEVER APPLIED line must be read as
  loudly as a survivor.
- **A KILLED SWEEP LEAVES A LIVE MUTANT** — it skips its `finally`. **Never commit
  while a sweep is running.** Put the restore on a trap and run it in the
  background.
- **⚠ AND THAT TRAP MUST NOT FIRE ON A SUCCESSFUL EXIT — it discards YOUR OWN
  uncommitted work (2026-09-16, cost one restore).** `trap 'git checkout -- <the
  swept files>' EXIT INT TERM` reads as belt-and-braces and is not: the runner
  already restores in its own `finally`, so on a clean run the trap is a second
  restore of files that are already restored — and `git checkout` restores them to
  **HEAD**, not to the uncommitted edits the sweep was measuring. Measured: a 43/43
  green sweep ended with `git diff` EMPTY on all three swept files, the product fix
  gone. **The trap is for INT and TERM only** — or commit before sweeping. The tell
  is a clean tally beside an empty diff, and the recovery is the spec's own anchor
  census: every `from` string is a line of the change, so `0` occurrences names
  exactly what was lost.
- **AND "IN THE BACKGROUND" IS NOT `nohup … &`** — the harness reaps the tracked
  wrapper the instant `&` returns and the runner becomes an orphan nobody owns.
  Run the sweep as the background call's own command. **`pgrep -f
  scripts/mutate.mjs` before believing any sweep result**: two processes wrote one
  log at different offsets and it read like a clean run with a plausible survivor.
- **A CONTROL MUST BE DECLARED, NOT MERELY LABELLED.** Four specs named theirs only
  in the LABEL, so `isControl` was false: the tally printed them as survivors AND
  **the runner's own `CONTROL WAS KILLED` branch was never armed** — the sweep's
  one check on its own honesty, off, in the sweeps that reported it working.
- **A SWEEP DOES NOT NEED THE WHOLE SUITE**, and saying so is not a shortcut: 45
  mutants × the full suite is ~70 minutes; the files that can see the change are
  32 seconds. **A SURVIVOR is re-checked against the whole suite before it is
  believed** — a narrow list can only produce a false survivor, never a false kill.
  **AND THE LIST IS PART OF THE RESULT, SO THE RUNNER PRINTS IT** (2026-09-17):
  it took the list on argv and recorded it NOWHERE, opening on `baseline…` and
  closing on a count, so a clean tally read back later could not be checked for
  its own SCOPE. `40/40/0` and `40/40/0 against these nine files` are different
  claims and only the second is auditable; it cost a file count stamped here from
  memory, which is a claim ahead of its evidence in the one instrument whose whole
  job is evidence. The scope line goes **before the baseline** (a sweep that dies
  in its baseline still says what it was trying to do) and an empty list is SAID —
  an empty list and a forgotten one are identical in a log.
- **AN AD-HOC CHECK CAN FAIL TO APPLY ITS OWN MUTATION.** An inline `node -e` whose
  quote escaping silently no-op'd the replace compared the original against itself
  and answered INERT. **Any hand-rolled mutation check must REFUSE to run when the
  source did not change.**
- **`String.prototype.replace` READS `$'` IN THE REPLACEMENT** — the file changed,
  the checksum said applied, and the mutant that landed was not the one written.
  Replace through a function and verify the landed text IS the written text.

### Two copies of one thing

- **TWO LISTS OF THE SAME THING.** Routes in a matcher and in a dispatch
  condition; a scanner's list and the kit's. They drift silently. Derive one from
  the other, in BOTH directions where the scan can stop matching.
- **A HAND-TYPED CONSTANT IN A CHECK IS ONE OF THEM.** `site build` came back
  381/1 on a change touching neither the fan-out nor the model path: a check
  hardcoded 9 requests, legal when written and illegal after the two bounds split.
  **A check that hardcodes a number the product exports is a second copy of it.**
- **A NUMBER STAMPED IN TWO PLACES DRIFTS WHEN ONLY ONE IS CORRECTED.** Sweep and
  suite numbers went into four places and the correction reached three. **Grep for
  every copy of the OLD value before believing a correction landed.**
- **A LOOKUP KEYED AT A DIFFERENT GRANULARITY THAN THE THING YOU ASK IT.**
  `LANE_LAYER` is keyed by GROUP; indexing it by a field answers `undefined` for
  three lanes that dispatch fine — and `undefined` there is a legitimate value.
  **When a map's absent key means something, ask its resolver, not the map.**
- **A READ WHOSE ONLY CONSUMER WENT, and the query stayed.** When you delete a
  consumer, grep for what fed it.

### Values that lie

- **`String(["a"])` is `"a"`.** Shipped as a real bug three times. Refuse a
  non-string; never coerce.
- **`X["constructor"]` is truthy.** `Object.hasOwn`, never truthiness, for any
  caller-supplied key.
- **TWO NULLS THAT MEANT DIFFERENT THINGS.** `readAction` answers null for "no
  button" AND for "a computed button"; `applyAction` keyed insertion on that one
  null and `src.slice(0, undefined)` is the whole file. **When a reader answers
  null for "unreadable", check what every consumer SAYS OUT LOUD for that null.**
  A writer that skips is safe; a prompt that says "absent" is not.
- **CANNOT-TELL MUST NEVER READ AS A VALUE** — and the inverse: **`Infinity` is a
  stated answer** and two readers refused it, each falling back to a Worker-sized
  number for the one input where the default is the most wrong answer available.
- **A `//` IN A URL IS NOT COSMETIC.** `https://host//menu` parses as the host
  `menu`, so a wrong canonical names a different SITE. Assert an address by
  PARSING it, never by string equality against an expectation the test assembled
  the same wrong way.
- **A UNIT CONVENTION STATED ONLY IN PROSE** is one a model will read past.
  `OptionPricedList` documents minor units; a page fed major-unit rows, so one
  control read **+£16.40** and the total **£1880.00**, both well-formed. The fix
  shape is a type or a prop name that carries the unit. **Open.**

### Fixtures and instruments

- **A FIXTURE IN A DIFFERENT SHAPE FROM REALITY.** A fake that is MORE capable
  hides bugs exactly like one that is less — and so does one that differs by a
  single character (a trailing slash shipped `//menu` as every canonical for a
  day). **Derive a fixture from its real producer.** A stub `phone` matching
  `/\d{7}/` against `"07700 900000"` — the format the contract it was proving
  says is accepted — found **no run of seven consecutive digits** and dropped the
  message, reporting a working feature as broken.
- **A SUPPLIED ROUTER ANSWER MUST BE THE ONE THE ROUTER IS TOLD TO GIVE
  (2026-09-27, Test 5, cost a paid run).**
  - The free rehearsal posted "Take Gallery out of the menu." as
    `{layer: "nav"}`.
  - The router's own `remove` description sets the flag for `nav` with "take
    Pricing out of the menu" as its example, so the live answer carried
    `remove: true`.
  - That flag opens the part-picker door, a path the rehearsal never took, and
    run 47 failed on it.

  **Read the router tool's description for the exact wording before supplying
  its answer.** A rehearsal is only as good as its least-examined fixture.
- **TWO READERS OF ONE DATABASE DO NOT PRESENT A VALUE ALIKE (2026-09-30, the
  canary's fixture check, caught before the push).**
  - The owner route reads through the Neon driver's default parsers
    (`sqlQuery`, `site-db.mjs`): a NUMERIC or BIGINT column comes back as
    text, and a DATE or TIMESTAMPTZ as a Date object.
  - The site's own read is the Data API, which serves numbers as numbers and
    dates as its own text.
  - A check that required the two to agree value for value would have stopped
    every correct setup on such a table. Its stub gave both readers the same
    rows, so its tests could not show it.

  **Hold a reader to digests taken from that same reader, and give each
  reader in a stub the shape its real producer gives.**
- **A FIXTURE THAT NAMES A THING THE PRODUCT DOES NOT HAVE PASSES UNTIL THE
  PRODUCT STARTS CHECKING.** Two guards used the kit component `form-shell`,
  which sounds exactly like one of the 2,112 and is not one; both went red the
  hour a name check shipped, and the honest move is a real name **with the drop
  asserted beside it** — swapping the name alone appeases the check without
  saying what changed, which is the same thing as deleting it.
- **A FIXTURE TOO SHALLOW TO SEPARATE THE TWO READINGS.** When a mutant survives,
  ask what input would make the two readings differ, not whether the code looks
  right. `sitePreviewSrc(site, '/')` and `sitePreviewSrc(site, active.path)` answer
  the same string until a case presses on `/press`.
- **A ZERO FROM A BLIND INSTRUMENT IS NOT EVIDENCE OF ABSENCE.** Headless Chromium
  uses OVERLAY scrollbars (0px in precisely the case that moves);
  **⚠ "Chromium in this sandbox cannot reach a site host at all" WAS TRUE AND IS
  NOT (falsified 2026-09-21)** — a real Chromium opened
  `fold-lane-bakery.gofarther.app`, answered **NAV 200**, and read both
  photographs as loaded and visible with zero failed requests. It was recorded
  from a CSP render that read BROKEN both ways, and **a limitation nobody
  re-tested is a false negative about our own instruments**: it sat here long
  enough that a live-browser check went unattempted rather than unavailable.
  **⚠ AND IN THE 2026-09-25 CONTAINER IT WAS TRUE AGAIN, FOR A NAMED REASON**:
  `page.goto` answered `net::ERR_CERT_AUTHORITY_INVALID`. `/root/.pki/nssdb`
  held **0** certificates (its `nssPublic` table read empty), although the
  proxy README says the browser NSS store is set up. **Re-test per container;
  never carry the answer over.**
  - **The way through changes no trust setting**: fulfil every request from a
    Node fetch that verifies TLS against the session CA bundle
    (`context.route("**/*")` → `route.fulfill`, `NODE_USE_ENV_PROXY=1`).
    Chromium then runs the live bytes and scripts. Adding the CA to Chromium
    was refused by the permission system, and switching verification off is
    forbidden.
  - **Its limit**: Chromium's own network stack (cache, cookies, service
    workers) is not the one exercised.
  The CSP reading it came from is still the blind one;
  a fake `sqlQuery` injected where none is accepted answered **0 statements**,
  which reads exactly like "no constraint anywhere". **A `net::` error in a CSP
  failure list is the tell — a refusal is `blockedURI`, never a transport error.**
- **AN INSTRUMENT THAT REPORTS CORRECT CODE AS BROKEN.** A `fullPage: true`
  capture of a site using `animation-timeline: view()` shows every below-the-fold
  section BLANK. **When the instrument and the thing disagree, suspect the
  instrument first** — and screenshot each section scrolled INTO VIEW, asserting
  computed opacity.
- **A MISMATCH FROM A BROKEN READER READS LIKE A CHANGE (2026-09-27).**
  `curl … | tee >(wc -c) | sha256sum` hashed `lido-axes-b`'s stylesheet as
  `484438e4…` against a recorded `6f7ca4bc…`: the process substitution
  inherits `tee`'s stdout, so the byte count went into the pipe and the hash
  covered the file plus the count, and the count never printed. Downloaded to
  a file and read on its own, the sheet was the recorded bytes. **Read a
  reference value into a file first, then measure the file.**
- **A STATUS READ OFF `curl -D -` THROUGH THE PROXY IS THE PROXY'S
  (2026-09-27).** The first header block is the proxy's own `HTTP/1.1 200
  Connection established`, so a reader taking the first status line reported
  `/the-starter`'s 301 as a 200. Read the site's status with
  `-w '%{http_code}'`.
- **A DEFECT THAT ONLY EXISTS IN TIME IS INVISIBLE TO EVERY STILL.** An entrance
  animation on an element something rebuilds is a 220 ms twitch; the finished panel
  is pixel-perfect in every frame. **The picture looks like evidence.** Sample one
  element's rect across `requestAnimationFrame`.
- **A CSS RULE CAN BE CORRECT AND STILL LOSE** — `padding-left` above a `padding`
  shorthand loses on source order at equal specificity. No markup assertion sees
  it, and neither does one that checks the rule EXISTS: read the VALUE, and check
  it sits below every shorthand that rewrites it.
- **A PERCENTAGE HEIGHT AGAINST AN `aspect-ratio` BOX IS WHERE ENGINES DISAGREE.**
  Correct CSS; where an engine does not resolve it, `max-width` does not always
  clamp a width the ratio produced. **Bound it on both axes AND clip the parent.**
  Chromium could not reproduce it at five widths — the failure had to be FORCED.
- **A FAILURE THAT CANNOT NAME ITSELF.** Seven-plus instances: four causes wearing
  one sentence, a status with no reason, a report that died with the socket.
  **When two failures need opposite fixes, they must be distinguishable from
  outside** — and a harness that hides the diagnostic half of a response turns
  every failure into a guess.
- **A DIAGNOSTIC FIELD IS NOT A SUBSTITUTE FOR THE ARTIFACT.** Three past sessions
  hit one wall and each bought a narrower field instead of the file. Store the raw
  answer ONCE, before anything can refuse it.
- **A 200 IS AN AVAILABILITY CHECK AND NEVER A HEALTH CHECK** (owner,
  2026-09-15: *"The six sites returning HTTP 200 are useful availability checks;
  they don't yet establish that their interactive features still work."*).
  Fetching a document proves the script is up and serving; it exercises no form,
  no query and no control. **The two are different claims and a post-deploy
  sweep measures only the first.** What an interactive check really costs is
  run 47's shape: fetch the page, read its route chunk for the call it makes,
  POST that call to the site's own route, and compare the answer against a
  number established some other way — which is how `/status` was found answering
  `0` while serving a perfect 200.
- **A CHECK THAT REPORTS IS ONLY AS GOOD AS ITS READERS.** The render check saw
  seven routes throw and said so; the publish shipped it (by design) and the
  harness called it `ok`. **When a check is report-only, list its readers.**
- **A REPORT CUT BY ITS BUDGET READ AS A VERDICT ON PAGES IT NEVER OPENED.** `cut:
  true` was in the report with no reader for three sessions. **An absence in a
  report is only as good as the report's coverage.**
- **A LISTING THAT ANSWERS ONE PAGE.** `wrangler containers images list` fetches
  ONE catalog page; two deploys rebuilt both images off an absence that was the
  instrument's. **Ask for the thing BY NAME**, and make "could not tell" its own
  answer.
- **AN API THAT SERVES A STALE SNAPSHOT.** GitHub answered `in_progress` for a step
  that had finished. `updated_at` moving BEHIND the steps proves staleness; it
  agreeing proves nothing, because a whole snapshot can be old. **What settles it
  is the step's own expected duration** — and a stale reading can persist ~25
  minutes. `date` is the cheap check before calling anything hung.
- **AND `?head_sha=` ANSWERS `total_count: 0` FOR A SHA THAT REALLY HAS RUNS —
  measured 2026-09-19 on two consecutive commits.** `GET /actions/runs?branch=…`
  found `unit tests` and `site build` on both; the same endpoint filtered by
  `head_sha` answered **zero** for each. **A zero from that filter is the
  instrument, not the repository**, and it is the worst-shaped answer available:
  it reads exactly like *"no workflow fired for this push"*, which is a real and
  ordinary outcome here (`paths` and `paths-ignore` produce it every day), so
  there is nothing to make it look wrong. It cost one monitor that polled for
  completion, never saw a run, and **ended silently after 55 rounds**. Ask by
  BRANCH and match the sha yourself.
- **AND A GREP OVER A JOB'S JSON ANSWERS ABOUT ITS FIRST STEP (2026-09-24).** A
  job's `steps` carry the same `status`, `conclusion` and `completed_at` keys as
  the job itself. So `until … grep -q '"status": *"completed"'` exited on its
  first poll, because "Set up job" had already completed, and `grep -o …
  conclusion | head -1` then printed that step's `success` and its
  21:54:59Z — while the job's own field read `in_progress` with `npm test`
  still running. **A false all-clear in the shape of a real one**, caught only
  because the time was two minutes too early. Parse the JSON and read the
  TOP-LEVEL field (`j.status`, `j.conclusion`), never a pattern over the text.
- **A FALSE ALARM IS WORSE THAN A MISS**, and a false ALL-CLEAR is worse than
  either. Any new lint measures its false-alarm rate against the real corpus and
  must reach ZERO before it ships. **A live check's ambiguous anchor fails
  SILENTLY**: `justify-content: center; overflow: hidden; }` also ends `.ig-ico`,
  so a watch said LIVE about a rule the change never touched. **Count the pattern
  in the source first.**
- **`pgrep -f` / `pkill -f` MATCH YOUR OWN SHELL.** Ten-plus instances. Kill by
  PID; watch a log's tail. **AND A WAITER IS THE QUIET HALF OF IT (2026-09-17):**
  `while pgrep -f "node scripts/mutate.mjs"; do sleep 20; done` never exits,
  because the waiter's own `/bin/bash -c … eval '…'` command line contains that
  string — so it waits on itself for ever and the notification never comes.
  **A waiter that will never fire is indistinguishable from a job that never
  finishes**, which is worse than killing the wrong process: nothing is harmed
  and nothing is learned. **Wait on the PID** — `while kill -0 <pid>; do sleep
  15; done` has no pattern to match — and `pgrep -af` prints the command lines,
  which is what shows the waiter standing in its own list.
  **⚠ AND THIS ENTRY WAS IN CONTEXT WHEN THE SAME WAITER WAS WRITTEN TWICE MORE
  (2026-09-20).** Both spun from before a compaction until `ps --forest` was
  asked — hours, silently, while their sweeps had long since finished and their
  tallies were read out of the log by hand. **The entry names the broken form
  first and the fix last, which is the wrong way round for a shape that reads as
  correct while you are typing it**: `while pgrep -f "<the command>"` is the
  obvious thing to write and the `bash -c … eval` wrapper makes it false at the
  moment of writing. It also cost a false alarm in the other direction — a
  routine `pgrep -f "node scripts/mutate.mjs"` inside a compound command
  answered **YES, a sweep is running** about its own shell, one step before a
  commit. **Ask `ps --forest` or `pgrep -af` and READ the lines**; a bare
  `pgrep -f` answering about a commit-blocking condition is answering about
  itself.
  **⚠ AND THE THIRD DOOR IS THE EXPENSIVE ONE: `pkill -f` KILLS THE SHELL THAT
  WOULD HAVE CLEANED UP (2026-09-20, and it left a mutant in the tree).**
  `pkill -f 'scratchpad/rc/p1b.mjs' ; git checkout -- <the swept file>` matched
  the compound command's OWN `/bin/bash -c` line, so the shell died AT the
  `pkill` and the restore on the same line never ran — the probe's mutation
  stayed in `builder/site-files.mjs` and `git status` reported it as ordinary
  work. **The two halves compound**: a killer that kills the restorer is
  silent, and what it leaves behind looks exactly like an edit somebody meant
  to make. Nothing announced it; one `grep -c` of the anchor did. **Put the
  restore in a SEPARATE call, before the kill** — or kill by PID, which has no
  pattern to match — and read the exit code: a compound command that dies at
  its own `pkill` exits non-zero and every later step in it is a step that did
  not happen.

### Loading, parsing, scope

- **LOADING A MODULE PROVES ITS IMPORTS, NOT THE IDENTIFIERS INSIDE ITS FUNCTIONS.**
  Six-plus free-identifier misses. `&&` SHORT-CIRCUITS, so a free name in an
  operand may never run: `node --check` passes, every source guard finds its
  landmarks, a real service starts and listens, and the build that uses the feature
  throws. **The check is a PARSER, not a grep** — `test/free-identifiers.test.mjs`
  walks real lexical scopes over the PAGE (classic scripts share one global scope)
  and over `worker.js`. **Measured zero false alarms**, with a `typeof` operand the
  one forgiven position.
- **IT HAPPENS IN A TEST SCOPE TOO, silently in both directions.** A carried
  function gained two free names and every case went on passing against a scope
  that had neither — green means the fixtures never took that branch. **When a
  carried function gains a free name, add it even if the suite is green.**
- **A `const` CALLED ABOVE ITS OWN LINE passes the parse check and every text
  guard.** The temporal dead zone is a runtime error. **When a call moves earlier,
  check what it calls is declared earlier still.**
- **A MODULE WITH NO IMPORT LINES** puts an anchor-based insertion below its use:
  `node --check` passes and the module throws `ReferenceError` on LOAD. Parsing is
  not loading.
- **`ts.SyntaxKind[n]` ANSWERS AN ALIAS FOR SOME KINDS (2026-09-26).** The
  parser adapter's `k()` is that reverse lookup, and a template literal reads
  back as `FirstTemplateToken`, so `k(e) === "NoSubstitutionTemplateLiteral"`
  can never match: a check that silently never fires. A positive control caught
  it before it shipped. Compare `k()` only against names measured to read back
  as themselves (`StringLiteral`, `JsxText`, `JsxExpression`, `JsxElement`,
  `JsxSelfClosingElement`, `JsxFragment`, `JsxAttribute`, `JsxSpreadAttribute`
  all do), or compare `n.kind` numerically.
- **`node --check worker.js` PASSES A FILE THAT DOES NOT PARSE.** This package
  declares no `"type"`, so `--check` on a `.js` does not parse it as a module and
  says nothing about a duplicate declaration. **The honest parse is
  `node --input-type=module --check < worker.js`.**
- **A RE-ANCHOR LANDS IN A SCOPE IT DID NOT WRITE** — a `const closure` colliding
  with a local made `node --test` report the whole file as one `not ok`. Check the
  name is free.
- **AN UNCAUGHT THROW INSIDE A ROUTE IS ANSWERED BY CLOUDFLARE IN HTML**, because
  `worker.js`'s `fetch` has no try/catch around `handleRequest`. A caller doing
  `.json()` gets `Unexpected token '<'` and learns nothing about the cause.

### Environments, CI, deploys

- **THE THING THAT RUNS YOUR GUARDS IS NOT ITSELF GUARDED unless somebody writes
  it down.** Four instances: the merge triggers (22 automatic triggers came off in
  one commit and all 5,722 tests stayed green), the DO migrations (a class leaving
  the Worker needs a `deleted_classes` migration or Cloudflare refuses the WHOLE
  deploy), the container-harness `paths` filter (right until `worker.js` became a
  job runtime; **stages 2a, 2b and 3 moved ~2,900 lines and `site build` ran on
  none of them**), and the sweep runner. **It fails silently in the safe-looking
  direction**, because a workflow that stops running produces no red run.
- **A `process.on("SIGTERM")` HANDLER IN A SYNCHRONOUS LOOP SWALLOWS THE SIGNAL
  ENTIRELY** — installing a listener replaces the default, and a handler is
  dispatched through the event loop a loop of `execFileSync` never returns to.
  **Measured: four iterations, the handler never fired, exit 0.** And **the obvious
  fix is INERT**: adding `process.exit()` to a handler that never runs.
- **A CI STEP THAT DOES NOT INSTALL WHAT THE TESTS IMPORT.** True when written and
  false the moment a module gained a dependency; green locally, red in CI. **Never
  let a workflow assert a property about the code in a COMMENT.**
- **`unit tests` WAS RED ON EVERY PUSH TO MAIN FOR A DAY — fifteen runs.** Read the
  run after every push; a red one is a day of pushes shipping unchecked.
- **A MODULE THE CONTAINER IMPORTS AND THE IMAGE DID NOT CARRY.** The transitive
  import walk is the one guard that compares the consumer's ENVIRONMENT with the
  code. **And `container-images` asks git for the COMMITTED tree**, so a Dockerfile
  naming an uncommitted file is an image that cannot be built from that commit —
  staging is not enough.
- **A CHECK THAT ASKS THE FILESYSTEM IS ASKING THE WRONG THING.** `fs.existsSync`
  passed on any machine that had ever built and baked THAT MACHINE'S generated file
  into a committed module. **When a check is about what the REPOSITORY holds, ask
  git**, derive the list, and prove the observer alive first.
- **A `workflow_dispatch` WORKFLOW HAS NO BUTTON UNTIL ITS FILE IS ON THE DEFAULT
  BRANCH (measured 2026-09-15).** `backend-repair.yml` and
  `repairbench-count-fix.yml` were pushed to a feature branch and GitHub answers
  **404** to `GET /actions/workflows/<file>` for both — no entry, no Run workflow
  button, so a dispatch-only tool is not runnable until it is merged. **Ask BY
  NAME, never off the listing**: the same listing returned `agent-deploy.yml`,
  whose file is **not on `origin/main`** at all, so the catalog is not a reader of
  what main holds — this repository's own "ask for the thing by name, and make
  could-not-tell its own answer" trap, met on a registry instead of a container
  registry. **And a `checkout` pinned to `ref: main` is a SECOND, independent
  gate**: the workflow file may come from a branch, but the script it runs is
  always main's, so the tool and its code must BOTH land. Plan the order as
  merge → deploy → press, and never promise a button that does not exist yet.
- **A PUSH TO MAIN ROLLS THE CONTAINER UNDER WHATEVER IS RUNNING.** Never push
  while a live run is in flight; after any code push wait **15–20 minutes**.
  **AND THE HARD PART IS KNOWING ONE IS IN FLIGHT — MEASURED 2026-09-16, a near
  miss of 1m52s.** Another session's `lane sweep` run 49 ran 09:31:16→09:41:18Z;
  a push to main at 09:40:23Z rolled the container at 09:43:09.99Z. Nothing was
  harmed, and the push overlapped that run's last 55 seconds. **Main's history
  is not the signal**: the run's own commit landed at 09:46, five minutes after
  the push it would have warned about. **Ask GitHub what is RUNNING, not what
  has LANDED** — the `lane sweep` run was `in_progress` and readable from 09:31,
  so one listing of in-flight Actions runs before a container-rolling push is
  the whole check.
- **A COMMIT SAYS WHAT A COMMIT CHANGED; THE DEPLOY FIRES ON THE PUSH.** Two commit
  messages both said "nothing rolls" — true of each alone, false of the deploy they
  triggered. **The roll question has exactly two honest answers**: `git diff
  --name-only <what main had>..<what you pushed>` before, and the deploy's own
  image step after.
- **A SECOND ROUTE UNDER THE SAME WALL.** The 273 s reset was found on the edit
  route, the fork was built on the edit route, and the addon route — same
  connection, LONGER work — stayed synchronous and died at 257.6 s. **When an
  infrastructure limit is found on one route, list every route under it.**
- **`supabase/applied/` IS NOT THE RECORD OF WHAT IS LIVE.** Before redefining any
  RPC, read it out of the database (`pg_get_functiondef`).

### Product-shaped traps

- **A RULE TRUE BECAUSE OF A LAYER BELOW IT EXPIRES WHEN THAT LAYER MOVES, and
  nothing announces it.** Five-plus instances, including the one in the money path
  (the edit budget) and `BATCH = 1` resting on a reason that expired 2026-08-25.
  When something one layer down changes, re-ask what rested on it.
- **A GATE THAT OUTLIVES ITS REASON.** Two tells, both present in the `look`/`logo`
  case: the requirement was never USED, and **the fix for the same symptom sat
  unreachable below it**. When a gate and a later accommodation address the same
  complaint, one of them is dead.
- **A NEGATIVE LIST IS THE WRONG WALL WHEN THE INPUT IS CALLER-SUPPLIED.** A
  deny-list at the door is a claim about the producer, not about the input. **Ask
  the positive list**, derived from the same constant the producer filters on.
- **ONE PROMPT WRITTEN FOR TWO JOBS**, where the second has to argue with the
  first. A prompt that quotes and reverses another prompt in the same call is two
  jobs wearing one tool. **Measured when split: 84,817 characters down to 4,012**,
  and the overruling paragraph simply deleted.
- **A DIRECTIVE FIX THAT WAS INERT BECAUSE THE DIRECTIVE NEVER FIRED.** Before
  concluding a prompt change did not work, check the prompt actually CONTAINED it.
- **TWO KIT COMPONENTS WHOSE NAMES DO NOT DISTINGUISH THEM** cost two paid builds
  at 22 credits. The signature list already said `Figure` took no children and the
  model passed them anyway; naming the right one in the directive was read past
  too. **When the kit has two components for one job, a prompt cannot fix it —
  make the obvious name work.**
- **A PROMISE TO THE MODEL THAT NOTHING EVER COMPILED.** The page rules advertised
  five importable packages; **fixtures importing them: 0 of 5, real pages using
  them: 0 of 324.** A package-list guard cannot catch it — `three` was installed
  and present and still unimportable. **Wiring a feature up is what makes its
  defects reachable.**
- **A GENERATED PAGE BROKE A KIT FILE IT HAD NEVER SEEN.** A `validateSearch` with
  required fields retyped `/` for the whole app. The property is **LITERAL vs
  WIDENED**, not `Link` vs anchor — `to={to}` with `to: string` carries no
  contract, which is why a blanket ban flagged correct code.
- **FOUR PAID BUILDS DIED ON A GATE THAT DID NOT HAVE TO EXIST.** `tsc --noEmit` is
  a gate WE impose; Vite strips types without checking them. **Measured on the exact
  page: tsc exit 2, vite exit 0, 2,186 modules, 6.95 s.** **Before hardening a
  gate, check whether the layer below it needs the gate at all.**
- **SALVAGE CANNOT FIRE ON A NEW BUILD** and has not since `MAX_PAGES` became 1 —
  the only page a new build has is the one page salvage will not replace. Both
  halves correct in isolation; nothing announced it. **Open, owner's call.**
- **A HARNESS THAT PASSED WITHOUT TESTING ANYTHING.** A paid canary POSTed with
  `layer: ""`, matched no branch, and produced a complete clean round trip — 202,
  queued, claimed, terminal, cost 0 — with **not one model call, lane, compile or
  publish**. **A green harness proves the path it took, not the path you meant**,
  and the danger is that a blind post PASSES. The fix is a refusal, not a fixture.
- **A HARNESS THAT COUNTED REPLIES (run 47, 2026-09-27; owner: *"receiving two
  replies is not page-removal success"*).** Test 5's UI mode printed "UI MODE
  PASSED: 2 messages sent" and its job concluded `success` over two refusals
  (`look/no-change`, then `kept`), with the site byte for byte unchanged and
  the chain VERIFIED over zero publishes. Every check it made was true: each
  message got a reply and the composer came back. None of them asked whether
  the work happened. **A scenario passes on what its operations did, each read
  off its own record** (the stored reply, the publishes, the source, the
  address), and **a message that depends on an earlier one is not sent until
  that one stored its success**: sending it anyway costs a routing call to
  collect a refusal the harness then counts as a reply.
- **A RE-ANCHOR THAT FLIPS WHAT THE CUSTOMER GETS IS NOT A RE-ANCHOR
  (2026-09-28, the owner held a merge for it).** The first removal-door fix made
  `edit-page-verb`'s mixed case go red — a photo removal beside a layout change,
  where the layout had always shipped — and the case was rewritten to expect
  the layout REFUSED, with the loss written up as a "stated consequence". A
  re-anchor is legitimate when the spelling moved and the property held; when
  the expectation flips from *the requested work ships* to *it does not*, the
  guard was reporting a regression. **Ask what the customer now gets that they
  did not before; if the answer is less, it is not a re-anchor.**
- **HOW MANY ANSWERS CAME BACK IS NOT WHAT WAS ASKED (2026-09-28, the owner
  held the same merge a second time).** The removal door's second correction
  read the request from how many lanes the picker named: one meant the routed
  removal, two meant extra work. So a photo removal answered with `shape` alone
  lost its layout, and a two-lane misreading ran. **When one model's answer
  decides what work another step does, give that model the context and ask the
  question in the tool's own shape** — here, the change already routed, and a
  separate list for anything else — rather than inferring intent from the
  answer's size. The add-on reporting learned the same rule one layer over: *a
  count of a step's output is not an association with a requirement.*
- **A NAME THE HARNESS DID NOT KNOW WAS DROPPED WITHOUT A WORD.** A filter on a
  person's input is a silent drop; a check is a sentence.
- **A KEY WHOSE INVARIANT EXPIRED WHEN THE LAYER BELOW IT MOVED.** The idempotency
  key was minted per ASK and the sideways hop reused it — correct until the queue
  keyed on `(uid, slug, op, idem_key)` **without the layer**, so a hop came back
  `duplicate: true` and silently became a no-op.
- **A ZERO-COST RUNG CANNOT PUBLISH THROUGH THE QUEUE**, and the refusal wore the
  compile's sentence: `edit_may_publish` grants only `reserved` or `exempt`, and a
  rung that makes no model call never reserves. Two traps in one — a gate written
  for the paid rungs disqualifying the free one, and `detail: "unbilled"` on the
  wire with the sentence collapsing it.
- **A REFUSED RESERVATION READ AS A FREE RUNG.** A refused reserve answered 0
  exactly as a rung with no model call does, so the spine exempted the job and the
  work shipped for nothing. **The two zeros are different zeros.**
- **AN OK ANSWER WITH NOTHING TO PUBLISH HAD NO TERMINAL STATE**, so it sat
  non-terminal until the sweep declared it LOST and refunded a 22-second answer
  ~150 seconds later. **A state machine with terminal states only for "shipped" and
  "failed" has no name for "answered, nothing to ship"** — and the nameless case
  falls to whichever sweeper finds it first. Its mirror: **a committed job with no
  finalize held a sweep slot for ever**.
- **THE CLIENT NEVER TERMINATED ON A QUEUED JOB THAT PRODUCED A REPLY.** The stored
  reply IS the synchronous one and has no job-state field, so `classify` answered
  `running` for ever on a charged, PUBLISHED edit. **When one endpoint answers in
  two voices, the voice has to be on the wire.** Two more hid in the same
  duplicated tail: a queued escalate rendered as "✅ Done." (doing less than asked
  and reporting success), and `apply()` bumping the preview and nothing else.
- **A REFRESH MID-EDIT LOST SIGHT OF THE JOB, AND THE FIX HAD BEEN WRITTEN AND LEFT
  UNWIRED.** `resumeEditJob` existed with no caller for days.
- **THE QR RULE IS STRICTER THAN THE REST OF THE DESIGN STEP**, so a first build
  can almost never have one: `NEVER INVENT THE DESTINATION` while every other field
  invents placeholder detail freely. The machinery is not the limit; the rule is.
  **Owner's call.**
- **A STAMP WRITTEN AFTER THE RUN IS A CHANGE THE SUITE HAS NOT SEEN.** The
  stamping rule and the re-run rule pull opposite ways. **Run, stamp, then re-run
  whatever READS the stamp.** And **a count nobody re-measured is a claim ahead of
  its evidence** — in both directions: `382/382` was stamped from a local run and
  the next CI read of it was **381 passed, 1 failed**.
- **RE-RUN THE THING THE CHANGE IS ASSERTED BY.** Appeasing a false alarm in one
  checker while never re-running the harness that proves the change has shipped red
  twice. **The container harness sees what the unit suite structurally cannot** — a
  compiled stylesheet, a rendered head, a real PNG's dimensions. Its 25 minutes are
  not optional on a change to `build-server.mjs`.
- **WHEN A LANE FAILS LIVE, DRIVE ITS MODULE OVER THE CORPUS BEFORE BUYING A SECOND
  RUN.** A writer that emits source is proven by PARSING what it emits over every
  real page there is. One page broke out of 332, and the same audit over the picture
  scanner found the `images` failure with no model call.
- **A DROPPED FIELD HAS A TWIN ONE HOP OVER.** Fixing the producer exposed the
  collector: `publishStep` rebuilds from the LAST rung's args. **When a value is
  added to a chain that collects across steps, check every collector on the chain**
  — it was written before the value existed.
- **AN AUDIT OF THE CONSUMER'S REAL INPUT SURFACE IS THE REUSABLE PART.** Derive
  what the container reads (`payload.<field>`) and what the harness sends, and diff
  them. It found `parts` never once compiled. **Still unexercised: `langs`,
  `fontFiles`, `pageTokens`, `description`.**
