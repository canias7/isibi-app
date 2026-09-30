# Instruments and the edit canary

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). This file holds the
> free instruments, the rules a paid harness follows before it spends, and the
> edit canary's inputs and modes: reading a job, the harness corrections run 14
> bought, the after-read wait for a job's own version, and the UI mode that
> drives the real app in a real browser. The short summary CLAUDE.md
> kept moved here in the second pass (`git show 28bdc97f:CLAUDE.md`) and is the
> first section below.
>
> The rules-test and page-removal scenarios are recorded with their runs in
> `docs/history/2026-09-26-28-tests-3-to-5.md`, and each test's acceptance is in
> `docs/investigations/edit-path-checklist.md`.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## Instruments and the edit canary, in brief

The free instruments, what a paid harness refuses, and the canary's modes are
in `docs/instruments.md`; each test's plan and evidence is in the checklist.

- **Free instruments**: the stored `design` and `bands` steps (`agentMs`,
  `waveMs`, a time per agent or piece; `bands:<reason>` names the wall that
  stopped a split); `genMs` on the collector's `resume:finish` step;
  `GET /api/site/runtime?slug=` (the owner's site only: `async`, `runner`, the
  switches, the deploy sha — booleans and the sha, never a value);
  `GET /api/site/build-health` (any signed-in account: the Worker's `DEPLOY_ID`
  and the image a cold start gets); `GET /api/fal-balance` (the owner: a
  precondition, not a gate — an empty fal balance publishes placeholders and
  still charges).
- **A paid harness refuses to spend against the wrong build**, before the
  browser, the balance or the first post: `expect_deploy` matches by prefix,
  floored at 7 characters on both sides; `expect_image` matches whole;
  cannot-tell is a refusal; the two readers must agree; queued work (`async`)
  is required unconditionally.
- **The edit canary** (`edit-canary.yml`, `scripts/edit-canary.mjs`) takes a
  site, a control site, an instruction and the two expectations, and uploads
  its evidence as an artifact: every page and component body, a per-route
  inventory, the raw pages, the description stored in the site's settings,
  then the request, the routing answer, the stored reply, the customer's
  screen and the comparison. The free half runs on every press and reads the
  balance. The paid half runs only with spend `yes` and an instruction — there
  is no default ask (run 14 spent on a substituted one). It routes with the
  site's real page list, watches the job with the browser's own poll reader (a
  stored reply whatever its status; a timeout is "outcome unknown"), composes
  the screen with the browser's own composer (`editBrowserReply`, `actions`
  included), and compares only at the job's own published version
  (`afterReadVerdict`: VERIFIED, or UNVERIFIED with a named reason — an
  unverified comparison passes nothing).
- **Its modes**, each a form box, and a named mode never spends: `read_job` (a
  job's row, its ledger rows and trace candidates; exits above the preflight);
  `restore_version` (lists the site's versions, refuses one not listed or not
  restorable, posts the app's own restore, waits for `x-site-version`, then
  reads — pointed at the live version it is a free, no-post reading of the
  deploy, the restore target and the before-state); `ui_scenario` (the real app
  in a real Chromium, signed in with the canary's own session, one tab, a
  positive wall per scenario and per message, a budget checked before each Send
  that caps no single request; scenarios `4a-part-b`, `4b-d1-price`,
  `4b-d1-restore`, `4b-rules-close`, `5-page-remove`); `rules_allow` (the rules
  test's approvals).
- **The route a paid press expects** (`expect_route`, 2026-09-30,
  `scripts/canary-route.mjs`): space-separated `key=value` over the router's
  own fields (`intent`, `layer`, `page`, `rename`, `remove`, `tab`,
  `alsoAsked=none`). Only the named fields are judged.
  - It is read whole before the sign-in. A malformed box, or one beside a
    mode, refuses at no cost.
  - The router's answer is written to `routing.json` the moment it arrives.
  - A different answer is refused above the edit POST: the routing call is
    spent and nothing else is.
  - A matching answer is posted exactly as it came.
  - Blank means no check.
- **The rows a data press is written for** (`expect_rows`, 2026-09-30, after
  run 77; `scripts/canary-fixture.mjs`; on the branch, not merged): one JSON
  object, `{"table":…, "baseline":…, "target":{…}}`.
  - `baseline` is 16 to 64 hex characters, the start of the sha256 of the
    table's rows other than the target, in canonical form: keys sorted, rows
    by id, types kept (`rowsDigest`).
  - `target` holds the fields of the one row the message is about. Exactly
    one row must have every one of them, with the same type. A column the row
    lacks never meets a `null`.
  - It is read whole before the sign-in. A malformed box, or one beside a
    mode, refuses with no network call.
  - The table is read as the site's own read serves it
    (`/api/db/<slug>/data/<table>`), the read the digests are computed from
    and the one the job's writes show in, **and only as the whole table**
    (`readWhole`, after the owner's review): it asks `Prefer: count=exact`
    and keeps the `Content-Range`. Whole is `0-(n-1)/n`, or `*/0` with no
    rows. A 206 or a count above the rows served is `incomplete`; no header,
    a `*` count, or a header that does not describe the rows is
    `completeness-unknown`. Either stops before any routing call. The owner route is not read: its
    driver hands NUMERIC and BIGINT back as text and dates as Date objects,
    so it cannot be held to those digests. A table the site does not serve
    is `unreadable` and stops. The reading goes to `fixture.json`, with the
    rows the site served.
  - The check sits above the spend switch. With spend `no` it is the whole
    run, a free rehearsal. With spend `yes`, a setup that is not as named
    stops before the routing call, at no cost.
  - Blank means no check.
- **What the routing call said, and why it failed** (Lane 1, 2026-09-30,
  deployed in 2171):
  - a failed call's line reads `FAILED (<reason>)`, read by `failureSaid`
    over the router's own lists, e.g. `FAILED (provider xai 403
    insufficient_quota — refused on our account (billing or key))`;
  - `routing.json`'s `body` carries the route's `failure`, and `tablesFilled`
    when the route filled in the site's table names. The canary sends
    `tables: []`, and signs in as the fixtures' owner, so its router is told
    those names: run 77's `routing.json` carries four. Batch 1's presses ran
    without them.
- **Presses are the owner's.** A session's dispatch answers **403** (it lacks
  `actions: write`) even for a free read, so do not retry it: hand over the
  exact values and **name each box by its description**, because the form shows
  descriptions, not input names (run 29's values landed in the wrong boxes). A
  mode that exists only on the branch needs a branch dispatch, which runs the
  branch's script against main's Worker — what the preflight checks.
- **Money is read off the ledger and the job row** (`credit_events`, which
  names each reserve `<job>#<n>` and each refund by the bare job id, and
  `edit_jobs.billing`), never inferred from a net movement: run 14's 77 → 75
  was a routing call of 2 beside an edit charged 2 and refunded 2, which
  neither guess had named.

---

## The instruments

Every one of these is free and reads off a stored row.

- **`design` step** — `waves`/`agents` (or `graph`), `agentMs` (every agent's
  own call time, summed) and `waveMs` (the wall). **`agentMs − waveMs` IS the
  overlap**, stored as the two numbers rather than the difference, since a
  derived value beside its inputs is two lists of the same thing. Plus a time
  per agent (`<name>Ms`), keyed by NAME.
- **`bands` step** — `bands`/`wrote`, `parts`/`wroteParts`, the same two
  timings, and a time per piece keyed by POSITION (`b1Ms` … `p1Ms`).
  **Position, not name**, because `bandName` can reach 21 characters and `tr.at`
  cuts a key at 16: two bands agreeing far enough in would arrive as ONE key with
  the later overwriting the earlier — a wrong number wearing a right one's name,
  the only way this instrument can lie rather than go quiet.
- **`bands:<reason>`** — a split that does NOT happen says which wall stopped it
  (`revise`, `thin`, `door`, `nofanout`). The reason rides in the step's NAME
  because `tr.at` keeps finite numbers only. **The order is the code's order,
  which is a limitation rather than a ranking.**
- **`genMs`** on the collector's `resume:finish` step — fire-to-collection, the
  only measurement available on BOTH the split and the single-call path. **It
  was worthless until the wake**: with the collector arriving on a timer it
  measured the TIMER, and it reads exactly as plausible.
- **`GET /api/site/runtime?slug=`** — owner-gated, booleans and the deploy sha
  only. It exists because those flags are GitHub secrets with a workflow
  `|| fallback`.
- **`GET /api/site/build-health`** — which container image a COLD START gets.
  The deploy stamps the image id into the image itself (last line of the
  Dockerfile, from git objects at HEAD so it cannot move), `/health` answers
  `ok <templateId> <imageId>`, and an unstamped image says `unstamped` rather
  than guessing.
- **`GET /api/fal-balance`** — owner-gated, busts its own 60-second cache, and
  answers the precondition every parked photograph test needs: `usd > 0` is
  *"funded — a build can buy photographs"*, `usd <= 0` is *"empty — a build's
  photographs will all come back as placeholders"*, `null` is unreadable. Call
  it from the app console: `await (await apiFetch('/api/fal-balance')).json()`.
  **It is the precondition and NOT a gate** — the builder's photographs are
  bought straight off `fal.run` with no balance check, so a run against an empty
  fal is GRACEFUL and expensive: the addon's credits are spent, placeholders
  publish, and the result is complete, plausible and proves nothing (run 51).
  One free console line against ~13 credits.

**A PAID HARNESS RUN REFUSES TO SPEND AGAINST THE WRONG BUILD.**
`scripts/addon-sweep.mjs` asks `/api/site/build-health` (the Worker's
`DEPLOY_ID` **and** the container's cold-start image, in one call) plus
`/api/site/runtime` as a second reader, **before the browser, the balance or
the first post** — a refusal there has spent nothing, which is the only reason
it can be a refusal rather than a warning printed over a run already under way.
`expect_deploy` and `expect_image` on `lane-sweep.yml`'s form are the demands.

- **TWO HALVES, AND A ROLLOUT MOVES THEM SEPARATELY** — the Worker can be new
  while an instance started seconds earlier is still on the previous image.
- **CANNOT-TELL IS A REFUSAL, NEVER A MATCH.** `unstamped` arrives as `""` and
  refuses; so does a route that failed. The wrong direction is the expensive
  one — a run against the PREVIOUS build produces a complete, plausible,
  green-looking result about code that is not under test.
- **A SHA MATCHES BY PREFIX, FLOORED AT 7 ON BOTH SIDES; AN IMAGE ID MATCHES
  WHOLE.** A prefix of a hash is not a weaker claim, it is a different one.
- **THE TWO READERS MUST AGREE, asked with no expectation set** — a disagreement
  means a roll is in flight, which is a fact about the platform rather than
  about what the caller wanted.
- **QUEUED WORK IS REQUIRED BEFORE ANY PAID POST, UNCONDITIONALLY.** `async` off
  means the addon runs inside the Worker's isolate, bounded by the customer's
  own connection at ~270 s — run 45 died at 270,025 ms with the credits gone.
  As a caller's flag it would be an input, and an input cannot be the wall.
  `!== true`, so the string `"true"` is cannot-tell and not a yes.
- **`codeRefusals` AND `expectedCode` ARE PURE AND EXPORTED**, because the
  wrapper needs two authenticated routes and a cold container: *a wall nobody
  can drive is a wall nobody is guarding*, in the branch whose wrong answer
  costs credits. **The env pair was two module constants until a sweep killed
  it** — two mutants cutting the expectations out of the call SURVIVED every
  guard, since a constant handed over and one not handed over look identical
  from outside.

**THE EDIT CANARY TAKES A SITE AND AN INSTRUCTION, AND WRITES ITS OWN
EVIDENCE (2026-09-21).** `edit-canary.yml` grew `site`, `control`,
`expect_deploy` and `expect_image` beside the `spend`/`instruction` pair it
already had, so one live edit test runs end to end through Actions with no
browser console and nothing collected by hand. **The record is an uploaded
artifact** (`CANARY_EVIDENCE_DIR`, `if: always()` so a refusal's before-state
survives too): `source.json` with every page and component BODY, `inventory.json`
(per route: on-page photographs with the og:image share card stripped, headings
in document order, a word multiset), the raw HTML per route, then `routing.json`,
`terminal.json`, `customer-reply.txt` and `compare.json`. **The inventory runs
on EVERY run, paid or not**, so one free dispatch produces the whole
before-record.

- **THE PREFLIGHT DEMANDS BOTH ELIGIBILITIES, not just the identifiers.**
  `async` false means the edit runs in the Worker's isolate bounded by the
  caller's connection; `runner` false means the job never reached the site's
  own container. Either one makes a green result a statement about a different
  path. Plus both deploy readers agreeing, and `shaMatches` **floored at 7 on
  BOTH sides** so a short expectation cannot pass by being short.
- **⚠ THE CONTROL CHECK WENT STALE FOR SEVENTEEN DAYS AND NOTHING ASSERTED
  IT.** *"A non-canary still receives the SYNCHRONOUS shape"* was written
  2026-09-01 and was true while `EDIT_ASYNC_CANARY` named one slug;
  `EDIT_ASYNC_EVERYONE` opened the door on 2026-09-04 (`dacc9b51`) and the file
  was never touched again. **A rule true because of a layer below it expires
  when that layer moves** — and the cost here is specific: **a failed free
  check REFUSES TO SPEND**, so a stale control blocks every paid dispatch for a
  reason that has nothing to do with the code under test. The expectation is
  DERIVED from `/api/site/runtime` now, which is the property that cannot go
  stale whichever way the flags are set.
- **AN UNREADABLE CONTROL IS OUTSTANDING COVERAGE, NEVER A REFUSAL.** That
  route is owner-scoped, so a control the building account does not own answers
  the 404 a missing site gets — a fact about a DIFFERENT site. Cannot-tell
  refuses in the preflight's own demands and must not refuse here.
- **THE BALANCE IS READ ON EVERY RUN.** It sat inside the paid half, so a FREE
  dispatch — the one whose whole job is to say whether the paid one is worth
  pressing — never printed the one number that decides it. `balanceNow()` is
  ONE reader asked twice, because the free half runs a whole job between the
  two and the number a spend is measured against is the one immediately before
  it. The NUMBER only: the service key is in a header and never in the output.
- **⚠ AND `paidHalf()` WAS ANCHORED ON A LINE OF CODE, so five cases went red
  about a change that touched none of what they assert.** The landmark was
  `const before = await fetch(`, the balance read — which stopped being a
  `fetch(` the moment that read was lifted into a function. **A landmark that
  is a line of code is a claim about how that line is spelled**; it is anchored
  on the section's own heading now (`PAID CANARY EDIT`), which is a claim about
  where the paid half BEGINS — what every case below it actually means. Proved
  LOUD rather than vacuous: removing the heading fails five cases instead of
  passing a window over nothing.
- **⚠ AND THE FIRST PRESS DIED IN ONE SECOND, BECAUSE THE WORKFLOW DID NOT
  INSTALL WHAT THE SCRIPT IMPORTS (run 6, 2026-09-21).**
  `ERR_MODULE_NOT_FOUND: Cannot find package 'qrcode-generator' imported from
  builder/site-qr.mjs`. `edit-canary.yml` had **no `npm ci` step and had never
  needed one** — the canary imported `node:https` and nothing else for months.
  Then it gained `editBrowserReply` from `addon-sweep.mjs`, so the customer's
  own screen is EXECUTED rather than re-composed, and **that one line pulled a
  44-file closure wanting two real packages**. **THE VERIFICATION WAS THE TRAP'S
  OWN SHAPE**: the import was driven LOCALLY, where `node_modules` exists,
  which proves an import works in an environment that is not the one that runs
  it. *A CI step that does not install what the script imports — true when
  written and false the moment a module gained a dependency.*
  **IT COST NOTHING AND THAT IS NOT THE SAME AS BEING HARMLESS**: it died
  before the preflight, before any network call, so no credit moved — and the
  harness tested nothing at all, on a press somebody made.
  **THE GUARD IS THE ENVIRONMENT-VERSUS-CODE COMPARISON, NOT THE TWO NAMES**:
  it walks the real transitive imports, and if the closure reaches ANY bare
  specifier the workflow must carry an install step AND `package.json` must
  declare it (`npm ci` on a lockfile without it installs nothing and the step
  still passes). Pinned to today's two packages it would go quiet on the third,
  which is exactly how the step came to be missing. The walk **proves its own
  observer alive** before believing any absence.

- **THE GUARD IS WHAT WAS MISSING, and it is the reusable part**: the harness
  had six cases and not one of them read the control, which is exactly why the
  constant could rot in plain sight. Four cases now, all four red-checked
  against a backup (never `git checkout`, which restores to HEAD and eats the
  uncommitted work — the 2026-09-16 trap): **five mutants killed, a
  comment-only control survived.**

### THE READ-ONLY JOB LOOKUP (2026-09-21)

`CANARY_READ_JOB` is a MODE on the existing canary, not a flag beside the
others: it signs in, reads the job's row, the ledger rows naming it and the
trace candidates, prints one account, writes it to the evidence directory and
**EXITS ABOVE THE PREFLIGHT** — so the routing call, the edit POST, the watch
and the browser are all unreachable from it. `scripts/canary-read-job.mjs`.

- **THE BOUND IS STRUCTURAL AND NOT A PROMISE.** The module is handed exactly
  two readers — a Supabase GET and a poll GET — so it has no transport of its
  own and no verb to reach for. Asserted as a census over blanked comments: no
  `fetch(`, no `node:https`, and none of `POST`/`PUT`/`PATCH`/`DELETE` occurs
  in it. **⚠ THE POLL ROUTE'S OWN `DELETE` IS A CANCEL**, which is why the
  method is bound at the call site rather than passed in.
- **A READ-JOB DISPATCH BEATS A STALE `spend`, AND IT IS SETTLED IN THE
  WORKFLOW.** `CANARY_SPEND` is `inputs.read_job == '' && inputs.spend ==
  'yes'`, so the two can never both be live on the wire — a `spend: yes` left
  in the form from the previous press is not a second request, and that pairing
  is the only way this mode could cost money.
- **`billing` IS THE FIELD THAT ANSWERS THE MONEY QUESTION**, and its five
  states are the check constraint's own list: `none` is the only one that
  licenses *"never charged"*; `refunded` means **charged and reversed**;
  `reserved` means held and unsettled. **A sixth value is a schema change and
  answers `charged: null`** with the value NAMED — never the most reassuring
  branch.
- **THE LEDGER IS MATCHED ON THE JOB ID INSIDE THE REF** (`ref=like.*<job>*`),
  and a `like` is the ONLY match that works — **read out of the RPCs rather
  than guessed**. A **reserve** writes `ref = p_id || '#' || p_seq`
  (`<job>#1`, `#2`, … — one request makes SEVERAL sequenced holds, which this
  file already records); a **refund** writes the **bare** `p_id`; a build
  writes `build:<job>:<step>`. **So an equality match finds the refunds and
  none of the reserves** — a refund with no debit beside it, which reads as
  credits appearing from nowhere — and a prefix match has the mirror problem
  on the build path.
- **A FAILED LEDGER READ IS NAMED, NEVER FOLDED INTO "NO ROWS"** — the two
  answer identically as `[]` and only one of them licenses a claim about money.
  **⚠ AND THE FIRST CUT DID FOLD IT, on the one line anybody reads.** Reported
  and reproduced: a 503 from `credit_events` printed `LEDGER  no ledger rows
  name this job — nothing was debited under it` and then a failed-read note
  UNDERNEATH it. Both halves were defensible alone — the note was true, the
  verdict was the right sentence for an empty list — and **nothing looked at
  the text they produced together**, which is where the defect lived. The read's
  own state is an ARGUMENT to `ledgerVerdict` now rather than a note beside it:
  on a read that did not answer, `charged`/`refunded`/`debits`/`refunds` are
  **`null`**, `readable` is false, and the line is **`BILLING UNKNOWN — … so
  whether this job was charged is not established either way`** with the status
  named. A read that ANSWERED and found nothing says **`READ CLEAN`**. Two
  facts, two sentences. **`ledgerRead` fails CLOSED** (it opens as `not read`),
  and **no rows are printed under a refusal** — rows in hand do not rescue a
  read that did not answer.
  **⚠ AND THAT LAST RULE WAS TRUE OF EVERY LEDGER THERE IS, WHICH MADE IT
  WORTHLESS (owner, 2026-09-21).** `describeJob` gates the per-transaction
  lines on `readable`, and `ledgerVerdict`'s NON-EMPTY branch never set it —
  the refusal branch says `false`, the empty branch says `true`, and the one
  branch with rows to list left it `undefined`. **So the only case that has
  transactions was the only case that never printed them**: every
  `at / kind / reason / delta / balance_after / ref` line silently absent,
  leaving the summary sentence as the whole of the money evidence with nothing
  under it to audit — which is the opposite of this instrument's point, since
  the summary carries the amounts and only a transaction line carries WHICH
  ref moved WHEN. `readable` is a property of the READ and never of the row
  count. **The two cases are a PAIR and neither is worth anything alone**: the
  refusal case proves the lines are withheld, and *"a readable ledger PRINTS
  its transaction lines, one per row"* proves they arrive — asserted field by
  field on both rows, with the summary line as the control.
  **⚠ THE SHAPE DEMO THAT WOULD HAVE SHOWN IT WAS GENERATED AND NOT READ.** A
  three-shape driver was run over `describeJob` to show what the press would
  print; shape 1 passed two ledger rows and its output listed none, and the
  absence went straight past. *An instrument's output is evidence only once
  somebody reads it* — the same failure as reporting a count nobody
  re-measured, one layer out.
- **THE JOB'S OWN `billing` FIELD AND THE LEDGER ARE PRINTED AS TWO LINES THAT
  NEVER BORROW FROM EACH OTHER**, and that is what makes a disagreement a
  finding. **DRIVEN**: under a failed ledger read the account still prints
  `billing  refunded  cost 20  ->  the edit WAS charged and the charge was
  reversed` beside `LEDGER  BILLING UNKNOWN`. Either reader alone can settle
  the money question; neither is derived from the other.
- **⚠ AND THE MALFORMED-200 CHECK WAS UNREACHABLE FROM THE ONLY CALLER THAT
  RUNS.** PostgREST answers an error as an OBJECT, so `status === 200` alone
  lets it through wearing the one shape that means "no rows" — the module's
  `Array.isArray` check is exactly right and **`scripts/edit-canary.mjs`'s
  getter read `Array.isArray(rows) ? rows : []`**, coercing before the module
  ever saw the body. So the branch could never fire in production while the
  guard drove it happily through an injected store. **This repo's own wiring
  trap, met inside the fix for the class it belongs to**: the module perfect,
  one hop cutting it, and from outside *"the body was a list"* and *"we made it
  one"* are the same value. The getter is TRANSPORT now — `{status, rows}` as
  the body came — and the decision is the module's. **All THREE reads demand a
  list**, because each has its own wrong sentence: the job read would report a
  job as *"never existed, or pruned"*, the ledger read as *nothing charged*,
  and the trace read puts a non-iterable in a field `describeJob` LOOPS over,
  which throws rather than printing anything at all.
- **⚠ AND THE `credit_events` READ IS THE ONE HOP NOTHING HAS EVER DRIVEN.**
  `edit_jobs` over PostgREST with the service key is proven —
  `scripts/gap-sweep.mjs` has done exactly that against the live database —
  and `edit_traces` is written that way by `worker.js`. **`credit_events` is
  only ever touched from INSIDE the SECURITY DEFINER RPCs**, so no code
  anywhere has read it over the wire. RLS is on with no policies and
  `service_role` carries BYPASSRLS, so it *should* answer; it has not been
  asked. **The failure mode is benign and named**: a refusal prints
  `credit_events read failed (<status>)` rather than an empty ledger, which is
  the whole reason that branch exists.
- **`edit_traces` HAS NO JOB COLUMN**, so its rows are found by slug and time
  window and are reported as **CANDIDATES rather than a join**; a second edit
  on the same site inside the window is indistinguishable.
- **THE SUBMITTED INSTRUCTION IS NOT REACHABLE AND THE ACCOUNT SAYS SO.**
  `worker.js` stores the whole request body in R2 at `editJobKey(<job>)`, which
  is a Worker binding — no Supabase read and no existing route reaches it.
  Recovering it would need a new owner route, which is a product change.
- **EVIDENCE**: `test/canary-read-job.test.mjs`, **28 cases**, the decisions
  DRIVEN over injected stores and the wiring a census. **5 mutants killed, a
  comment-only control survived** on the first round (each mutant restores one
  defect: the ledger reading a net zero as never charged, a failing stored
  reply reading as one the old watch would have ended on, a failed ledger read
  folding into no-rows, the mode not exiting, and a stale spend arming the
  paid half), and **3 more killed with the control surviving** on the wiring
  round — the real getter's coercion restored verbatim, and each of the job
  and trace reads dropping its list check. Both files restored byte-identical
  from a SCRATCHPAD backup, never `git checkout`.
  **⚠ THE CONTROL'S FIRST ANCHOR NEVER APPLIED** — it carried a `── ` the real
  comment does not have — and a control that did not apply is a check with no
  control. Re-run with the anchor COUNTED first (1 before, 1 after), it
  survived. This file's own recorded trap, met while writing the check for
  another one.
- **⚠ THE PRINTED ACCOUNT IS WHAT IS ASSERTED, because that is where the
  defect lived.** Six of the cases drive `describeJob` to its finished text
  rather than reading `ledgerVerdict`'s fields: a failed-read case that
  asserts `BILLING UNKNOWN` **and** that the string *"nothing was debited
  under it"* occurs NOWHERE in the whole account, and a successful-empty
  CONTROL that asserts the opposite pair. *Two lines that are each defensible
  alone produce one paragraph that is not, and only the paragraph is read.*

**THE PLACES-LEFT RETRY WAS DISPATCHED AND IS RUN 17 — see below.** It was
prepared here as `edit-canary.yml`, `spend: yes`, `site: fretwork-1`,
`control: washhouse-3`, `read_job` EMPTY, and the instruction **verbatim**:

> The "Space on a preferred day" box counts bookings. Make it count down the
> places left instead — six lesson slots a day, so an empty day reads six
> places left.

— the ask run 14 was pressed for and never sent.

- **⚠ AND A PARAPHRASE OF IT WAS PREPARED HERE FIRST (owner, 2026-09-21).**
  The draft read *"show how many places are left for each lesson slot rather
  than how many are already booked"*, which **is a different request**: it
  loses the DAILY CAPACITY (six slots a day, so an empty day reads six) and
  re-points the count at *each slot* rather than the day. It also drops the
  control's own name, *"Space on a preferred day"*, which is the only thing
  tying the ask to a thing on the page. **A retry that re-words the request is
  a retry of a different request** — precisely run 14's own defect, arrived at
  by a second route: there a blank field was filled by a default, here a
  remembered sentence stood in for the one that was given. **The instruction
  is quoted, never restated.**

- **`expect_deploy=3b555acf09de5e078ef6e7930ea041a32824bbba` and
  `expect_image=6b14851c0cd0c1c1`, VALID AS OF NOW.** `origin/main` is unmoved
  at `3b555acf`, and both numbers are run 13's own LIVE readings off
  `/api/site/build-health` rather than a deploy log — the platform answering,
  not Wrangler reporting on itself. **A merge invalidates them**, and a stale
  pair refuses the run: the safe direction, and still a wasted press.
- **⚠ AND THE READ MODE IS NOT PRESSABLE FROM A SESSION EITHER — RE-TESTED
  2026-09-21 RATHER THAN ASSUMED.** `run_workflow` on `edit-canary.yml` with
  `read_job` filled in and `spend: no` answers **403 Resource not accessible
  by integration**, on a token whose `actions` READS answer 200 in the same
  minute. **So the wall is the `actions: write` permission and NOT the cost**,
  which is worth separating: the standing rule was written about PAID
  harnesses and reads as though spending were what blocks a session, and it is
  not — a free, read-only, zero-spend dispatch is refused identically. *A
  stated impossibility nobody re-tested is how a route ships throwing*, and
  the re-test is what licenses the claim here.
- **⚠ THE DISPATCH MUST NAME THE BRANCH.** GitHub reads a `workflow_dispatch`
  form's inputs from the file on the SELECTED ref and, with an unpinned
  checkout, runs that ref's script — so a dispatch from `main` offers no
  `read_job` box and carries no read mode, and falls through to the ordinary
  free checks. Harmless and not what was pressed for.
- **NO LAYER IS PROMISED.** Run 14 never sent this sentence, so how it routes
  is unknown; `page` and `rules` are both live readings of it and the
  display-versus-enforcement fix earlier today is exactly what it tests. **A
  routing prediction is a prediction about WORDING** and this file's standing
  rule is that a live run settles it and nothing else does.

### THE HARNESS PATCH RUN 14 BOUGHT (2026-09-21)

**THE ASK IS DEMANDED, ABOVE EVERY PAID CALL.** `readInstruction`
(`scripts/canary-watch.mjs`) refuses a missing, whitespace-only or non-string
instruction and **there is no default anywhere** — a census over the blanked
source holds it. The gate sits **above the routing call**, because routing is
billed on its own: run 14 moved the balance by 2 for it and published nothing,
so a gate below it is a gate that has already spent. A **free** dispatch still
needs no ask, exiting on `CANARY_SPEND` first. The exact submitted instruction
is written to `request.json` before the POST.

**THE WATCH IS THE BROWSER'S.** `watchEdit` asks `EditPoll.readPoll` rather
than re-deriving it, so the harness and the customer's screen can never
disagree about what a response meant. Four outcomes, and the fourth is the
point: `reply` (a stored reply, **whatever its status**), `ended` (a terminal
job with nothing stored — the browser's own `outcomeMessage` is printed),
`gone` (404), and **`timeout` — reported as *outcome unknown*, never as a claim
about the job.** `call` keeps `res.headers`, which is the wiring hop that makes
the rest reachable at all. The composer runs **on a stored reply or not at
all**, so a null body can never again be recorded as a paid action.

- **`retries` IS COUNTED AND PRINTED**, because a watch spent retrying a 503 and
  one spent waiting on a running job log identically without it — which is why
  run 14's `? / verify` rows cannot be read either way today.
- **THE HEADER'S KEYS ARE FOLDED, NOT THE NEEDLE.** Folding the needle alone
  looks like a fix and answers `undefined` for `X-GF-Edit` just the same.
- **EVIDENCE**: 12 new cases in `test/canary-watch.test.mjs`, **DRIVEN** against
  literal poll sequences and a fake clock — `edit-canary.mjs` has top-level
  await and spends money, so a test cannot import it, which is why the two
  decisions live in their own module. **5 mutants killed, a comment-only
  control survived**; each mutant restores one half of run 14 verbatim (the
  instruction default, a blank accepted, the final header ignored, a timeout
  reported as the job not finishing, the headers dropped from `call`). Suite
  7,078 → **7,090**.
- **⚠ AND A PRE-EXISTING GUARD WENT RED ON THE FIX** — `edit-canary.test.mjs`'s
  capture case was anchored on `const said = editBrowserReply(`, which is a
  claim about HOW the composer is reached, so making that call conditional
  reported the capture as gone. Re-anchored on `const said =`, the declaration,
  with the observer still asserting `editBrowserReply(` is inside the window.
  **Four rounds running, in guards written by earlier sessions of this work.**
- **⚠ AND THE CENSUS TRIPPED ON ITS OWN PROSE.** The first cut of
  `canary-watch.mjs` explained the defect in a comment that spelled it, and the
  guard forbidding that spelling failed on the paragraph arguing for the rule.
  Comments are blanked before the scan now, with the blanker's own observer
  proved alive. **Tenth-plus recorded instance, and this one was inside the
  guard written for the trap.**

### THE CANARY'S AFTER-READ WAITS FOR ITS JOB'S OWN VERSION (2026-09-25, `72885ca9`, merged and deployed in deploy 2160)

Owner: *"Fix the harness's early after-read with a bounded wait for the expected
published version. A timeout means the comparison is unverified; an unrelated
newer version is not a match. Focused checks only, no paid rerun."*

- **THE TARGET IS THE JOB'S OWN, NEVER "THE NEWEST".** The edit route stamps
  `job.id` into every build it stages (`manifest.job`, `recompileAndPublish`).
  `listBuilds` and `mergeVersions` carry it on each row of the owner-only
  `GET /api/site/<slug>/versions`.
  - `publishedVersion(reply, job)` takes the row whose `job === job` (strict)
    and answers the newest of that job's rows, since a correction round
    publishes twice.
  - A list inside a failing answer is `list-unreadable`.
  - An unpublished edit's target is the before-read's version, via
    `afterReadTarget`.
- **THE WAIT IS BOUNDED AND HAS THREE OUTCOMES.** `awaitVersion` reads the
  home page's `x-site-version`, 40 reads × 3 s (the restore mode's numbers).
  - **`match`**: the job's version was read.
  - **`superseded`**: a version minted AFTER the target was read. It stops at
    once and is never a match.
  - **`timeout`**: the bound ran out. That is a fact about the harness, not the
    site.
  - An OLDER version (the before-read's, while the new script spreads) is
    waited through. That is run 32's 7.9 s exactly.
- **EVERY PAGE RECORDS THE VERSION IT WAS READ AT.** With a target, a page read
  at another version is re-read, up to 5 reads × 3 s. Every page route on
  fretwork-1 sends `x-site-version`; `sitemap.xml` does not and is not
  required.
- **`afterReadVerdict` IS VERIFIED ONLY WHEN BOTH READS ARE TIED TO THE JOB.**
  The before-read must be one version (`sameVersion`). A published job's
  version must have been built FROM it (`parent === before`). The wait must
  have matched, and every after-page must be at the target. The first failing
  reason is named: `before-unknown`, `list-unreadable`, `not-listed`,
  `parent-mismatch`, `timeout`, `superseded`, `page-version` and others.
  `verdictSentence` is the one composer for the log and `compare.json`.
- **AN UNVERIFIED COMPARISON PASSES NOTHING.** The photo and component checks
  run inside `if (VERDICT.verified)`, and otherwise print `UNVERIFIED`, never
  ok and never FAIL. `compare.json` carries `comparison` and each route's
  `versionBefore`/`versionAfter`. The exit code is unchanged (publication), and
  the last line says which comparison the run has.
- **EVIDENCE.**
  - Tests: `test/canary-watch.test.mjs` +10 cases, driven with run 32's own
    ids. The run-32 shape matches on read 3 with two naps. Run 32's actual
    after-read is `page-version` UNVERIFIED. `test/edit-canary.test.mjs` +1
    wiring census covering the order (target → live read → wait → after
    inventory → verdict), the job passed as itself, the header, the gate and
    the else-branch.
  - **Red on the unfixed script** (a throwaway worktree with only the pure
    functions appended): exactly the census, failing on *"the after-read no
    longer asks which version it must see"*.
  - **Probes `scripts/mutants/after-read.json`: 20 mutants, 20 killed, 0
    survived, 0 never applied, 2 comment-only controls surviving**, over the
    four canary test files. Both files were byte-identical afterwards.
  - Suite **7,840 locally** (`7840 / 7838 / 0 / 2`, +11 against main's 7,829)
    and **CI unit run `36177280477` on `72885ca9`: `7840 / 7836 / 0 / 4`**, all
    11 new cases and the re-anchored capture guard found passing BY NAME,
    7,840 distinct result numbers, zero `not ok`.
  - No `site build` fires: none of the files is on its paths.
  - **Driven read-only against the live site**: the unpublished path read
    `VERIFIED` (every page `n7mtnq`), and a target the site never served
    timed out `UNVERIFIED`.
- **RE-ANCHORED, NOT APPEASED**: the reply-capture guard closed on
  `await inventory("after")`, which gained an argument. It now closes on the
  new block's first line, so the window is as wide as before.
- **MERGED IN DEPLOY 2160; ON ITS OWN A MERGE WOULD HAVE DEPLOYED NOTHING.**
  `scripts/**` and `test/**` are in `deploy.yml`'s `paths-ignore`. Before the
  merge, **a dispatch from main read early**. **Reviewed by the owner: the 40
  focused tests passed independent review.**

### THE CANARY'S UI MODE: THE REAL APP, IN A REAL BROWSER (2026-09-26, late — on the branch; run 39 used it and passed, 2026-09-27)

Owner: *"Use browser automation for Part B. … Exercise the real app: upload a
known test image through its attachment control, send the three planned
messages in one tab without reloading, and wait for each completed reply. …
Direct API calls alone do not cover this UI test. If existing tooling cannot do
it, identify the exact blocker and prepare the smallest necessary browser-test
addition."* `scripts/canary-ui.mjs`, the `ui_scenario` box on `edit-canary.yml`,
`test/canary-ui.test.mjs`, `test/fixtures/ui-logo.png`. What is law here:

- **THE BLOCKER WAS THREE WALLS, NOT ONE.**
  - No tool drove the signed-in builder app: every harness posts to the API,
    and the most any does is EXECUTE the reply composer in Node
    (`editBrowserReply`).
  - A session holds no owner credential, and must not mint or read one.
  - A session cannot dispatch (403, `actions: write`), and a NEW workflow file
    has no Run button until it is on main.

  So the smallest addition is a MODE of the workflow the owner already presses,
  like the read and restore modes: a branch dispatch offers its box.
- **SIGNED IN WITH THE CANARY'S OWN SESSION, NOT A SECOND WAY IN.** The canary
  already opens an owner session: a magic link minted with the service key,
  then verified. `auth.js` keeps its session in localStorage
  `zephyr_session_v1` as `{access_token, refresh_token, expires_at, user}`,
  with `expires_at` in **milliseconds**. A seeded session makes boot run
  `Auth.isSignedIn() → enterApp()`, so the app signs in through its own code.
- **⚠ AN INIT SCRIPT RUNS IN EVERY FRAME, AND THE WORKSPACE FRAMES THE
  CUSTOMER'S SITE.** Playwright's `addInitScript` runs in every frame, and the
  preview frame is the site's own origin running the site's own JavaScript. So
  a plant with no condition hands the owner's token to that site's scripts.
  - The plant runs **only where `location.origin` is the app's and no session
    is stored yet**.
  - The second half matters too: the app rotates its tokens, and planting
    again on a later navigation would overwrite the rotated session with a
    used refresh token.
  - Both halves are driven by running the script itself in both origins.
- **WHAT IS SENT IS A NAMED SCENARIO, NEVER FORM TEXT, TIED TO ONE SITE.**
  `UI_SCENARIOS["4a-part-b"]` is frozen and names fold-lane-bakery. The name is
  refused whole before the sign-in (exit 2), and so is a scenario written for
  another site, or one named beside a version to restore.
- **IDLE IS EVERY SIGN OF IT AT ONCE** (`composerReady`): the page's busy flag
  down, Send drawn and live, no Stop button (drawn in Send's place while
  busy), no "Working" row, and a box that takes typing. Any one alone has been
  true of a busy page. **"Usable again" is a reading**: after each reply the
  mode types into the box, reads it back and checks idle.
- **THE WALL IN THE PAGE.** Every scenario is edits, so a POST to the add-on,
  build or full-rewrite route is aborted in the browser before it leaves, and
  recorded as BLOCKED. A hand-off to another edit layer is let through: the
  real app makes it as a second edit request, and it is part of one message.
  Everything else goes to the live Worker.
- **THE BUDGET IS BETWEEN MESSAGES, SO IT CAPS NO SINGLE REQUEST** (owner,
  2026-09-27, correcting *"the test won't go past 5"*). D1's single message
  meets the check with nothing spent, so there the balance is the only bound.
  Each scenario's budget (Part B's 15, D1's 5) is asked before each Send from
  the balance the canary reads; an unreadable balance refuses. One message's
  own cost is never cut off mid-way.
- **EVERY JOB A MESSAGE FILED, IN ORDER** (`jobs`), because a hand-off has a job
  of its own and can publish. The chain of publishes (`chainVerdict`) requires
  each published version to have been built from the one before it (the first
  from the before-read's), the wait to have matched, and every after page to
  be at the last version.
- **THE BROWSER IS INSTALLED ONLY FOR THE MODE**, before the canary step, on
  `lane-sweep.yml`'s line (`playwright@1.49.1`, `--with-deps chromium`).
  `test/ci-browser-order.test.mjs` reads only the script a step runs and cannot
  see a launch inside an imported module, so the new census asserts the launch
  in the module and the install above the step.
- **⚠ THE SPEND GATE'S SPELLING IS A LANDMARK, AND THE MODE'S FIRST CUT MOVED
  IT.** Its paid/rehearsal split was written `if (!SPEND)`, the exact text
  every canary guard uses to find where spending begins, so the guards began
  reading from the wrong line. It is `if (SPEND) … else …` now, and the census
  asserts the landmark occurs once. *A landmark is only unique until somebody
  writes the same line upstream.*
- **WHAT IT CANNOT SHOW**: it is a headless Chromium on a GitHub runner at
  1440×900, not the owner's browser, and what the screen shows is recorded as
  text and screenshots, not judged by eye.
- **A BLOCKED REQUEST FAILS THE RUN AND DOES NOT STOP THE SCENARIO.** The page
  answers the aborted request with its own not-knowing sentence, the composer
  comes back, and the next message goes: each message is its own test, and a
  misrouted one has changed nothing.
- **PROVEN BEFORE ANY PRESS, AND WHAT THAT PROOF IS.**
  - **Locally against the real app's code.** The live gofarther.dev files were
    fetched over TLS-verified Node fetch and served into a real Chromium, with
    every `/api` and Supabase call answered in the page. Five paths were run:
    the three messages, a rehearsal, a refused session, a message misrouted to
    the add-on (BLOCKED, with the add-on's own not-knowing sentence on screen),
    and a job that never finished. It was re-run on the final module: the
    three messages, the block and the hang. **It proves the driver, never the
    live platform's answers.**
  - **Unit cases**: `test/canary-ui.test.mjs`, 22, through a stand-in page that
    forces every stop, plus the wiring and workflow censuses.
  - **Probes**: `scripts/mutants/canary-ui.json` — 33 mutants, 33 killed, 0
    survived, 0 never applied, 3 comment-only controls surviving — over the
    41 test files that can see the canary or a workflow. The three probed files
    were byte-identical to a scratchpad backup afterwards.
  - Three probes needed a case written for them first: a page that goes busy
    again after a reply, a box that stops taking typing, and a hand-off's
    second job. Two needed the census tightened: each pre-sign-in refusal must
    exit on its own, and the spend switch must not read the scenario box.
  - **Suite 8,040 locally** (`# tests 8040 / # pass 8038 / # fail 0 /
    # skipped 2`, `duration_ms 144,142`): +22 against 8,018, exactly the new
    file. **CI matches**: unit run `36278361266` on `ca3a6fae` reads `8040 /
    8036 / 0 / 4` (`duration_ms 120,507`). All 22 cases were found passing by
    name in the downloaded log, with 8,040 distinct result numbers and zero
    `not ok`.
- **⚠ AND THE CANARY'S BALANCE READER TURNED CANNOT-TELL INTO 0.**
  - `balanceNow` was `Number((rows[0] || {}).balance || 0)`. So a missing row, a
    PostgREST error body at any status and a null balance all read as a real
    balance of 0. The canary's free check "the balance is readable" passed on
    it, and the UI mode's budget could never trip when both readings were that
    0.
  - `readBalance(ok, rows)` in `scripts/canary-watch.mjs` answers -1 for
    anything but exactly one row carrying a finite, non-negative number (or
    the digits PostgREST can send). It never coerces: `Number(null)` is 0.
  - Driven over 14 shapes in `test/canary-watch.test.mjs`, beside a check that
    `balanceNow` goes through it. Probes `scripts/mutants/canary-balance.json`:
    5 mutants, 5 killed, the comment-only control surviving.
  - Found after `ca3a6fae` was pushed, and fixed before the handover. The
    session's one try at the free rehearsal dispatch (spend `no`) answered
    **403** again and was not retried.
  - **Suite 8,041 locally** (`# tests 8041 / # pass 8039 / # fail 0 /
    # skipped 2`, `duration_ms 143,296`): +1, the new case. **CI matches**:
    unit run `36278804992` on `714cd952` reads `8041 / 8037 / 0 / 4`
    (`duration_ms 127,276`). All 23 new cases (22 in `canary-ui`, 1 in
    `canary-watch`) were found passing by name, with 8,041 distinct result
    numbers and zero `not ok`. **The stamp chain ends at `714cd952`.**
- **RUN 38 WAS THE SCENARIO-TO-SITE WALL, LIVE** (`36281161831`, 2026-09-27
  00:00Z): the owner's first press left "The site to edit" at its default,
  `fretwork-1`, and the canary refused with exit 2 before the sign-in, spending
  nothing. **A form box with a default is the one most likely to be left as
  it is**, which is why the refusal names the box and both sites.
- **RUN 39 IS THE MODE'S FIRST LIVE PRESS, AND IT PASSED** — the record is
  under Test 4a above. What it proves about the mode itself: the planted
  session signed the live app in, the + button's file chooser landed the file,
  the idle reading held across three messages, the in-page wall had nothing to
  block, the balance was read before each message, every filed job was
  followed, and the after-read waited for the last published version.
