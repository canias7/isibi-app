# The agent builder

**A DIFFERENT PRODUCT FROM EVERYTHING ELSE IN THIS REPOSITORY.** The repository
root is *Go Farther*, a website builder. This directory is an **AI agent
framework / SDK** and shares nothing with it but the git remote and the CI
runner. Owner, 2026-09-14: *"This has nothing to do with the website builder,
just heads up… dont mix anything up."*

**THE LAW IN THE ROOT `CLAUDE.md` DOES NOT GOVERN THIS DIRECTORY**, with one
deliberate exception named below. Nothing here has a slug, an R2 prefix, a
publish spine, a Neon project per customer, a credit ledger priced in fal cost,
or a dispatch namespace. When a rule from the root file seems to apply, check
whether it is about *engineering* or about *websites*; only the first carries.

## What carries over, deliberately

The root file's **THE TRAPS** section and its **Working rules** are engineering
law, paid for over months, and they apply here in full:

- Guard tests, a mutation sweep from a verified-green baseline with a
  comment-only control that must survive, the whole suite, notes, and a push.
- Never size a source-read window in bytes. Assert the property, not the
  spelling. A negative assertion must prove its observer alive.
- **A cap the model is only told about is not a cap.** Enforce it in code.
- Cannot-tell must never read as a value, and a stated answer must not read as
  cannot-tell.
- Stamp measured numbers only AFTER the run.

## The separation, MEASURED rather than assumed (2026-09-14)

A push to the working branch runs the website builder's CI. What that means for
this directory was measured, not hoped:

- **`unit tests`** (`.github/workflows/unit.yml`) has **no paths filter**, so it
  runs on every push to any branch but `main`. It runs `npm ci` then `npm test`,
  which is `node --test "test/*.test.mjs"` — **the ROOT test directory only, with
  a 5-minute cap.** Tests in `agent-builder/test/` do not run there and cannot
  make it red.
- **`site build`** and **`answer read`** have paths filters that this directory
  does not match. **NEVER TOUCH THE ROOT `package.json`**, for two independent
  reasons: it is in `site build`'s paths filter, so a one-line edit fires a
  25-minute container harness; and the Dockerfile does
  `COPY package.json package-lock.json ./worker/`, so it is a container **image
  input** and editing it rebuilds the image and rolls the container on a merge.
  This directory carries **its own `package.json`**.
- **Two root censuses `readdirSync` the repository root** —
  `test/css-reachable.test.mjs` and `test/model-limits.test.mjs` — and both filter
  to **`.mjs` files, non-recursively**. A new top-level *directory* is invisible
  to both; **a new top-level `.mjs` FILE would be swept into both.** So nothing
  belonging to this product is ever placed at the repository root.
- **`builder/**` does not match `agent-builder/**`.** GitHub path filters anchor
  at the repository root, so the site builder's filters cannot catch this
  directory. The similar names are safe by anchoring, not by luck.
- **`test/merge-triggers.test.mjs` is a workflow CENSUS** and will fail on a
  workflow added here that has no trigger at all, that fires on a push to
  `main`, or that chains to `Deploy to Cloudflare` completing. A
  `workflow_dispatch`-only workflow passes it.
- **`deploy.yml` fires only on a push to `main`.** Nothing here deploys, and
  nothing here is a container image input — **checked by reading every `COPY` in
  the Dockerfile**, all of which name explicit files or explicit `builder/`
  paths. There is no `COPY . .`, so this directory cannot become an image input
  by accident. A push here rolls no container.

**The one thing that is NOT isolated is the root `CLAUDE.md`**, which a session
at the repository root always loads. It cannot be unloaded; the discipline is
that this product's entries are written HERE and never there.

## What is built

Four modules under `src/`, **all dependency-free** — this has to run in a
Cloudflare Worker, where there is no `node_modules` — with every outside thing
(the model call, the clock) INJECTED. That is not purity for its own sake: it is
what makes every branch below drivable in a test instead of waited on.

- **`limits.mjs`** — the bounds on one run, and the whole safety argument.
- **`define.mjs`** — `defineAgent` / `defineTool`, and the tenancy wall.
- **`fanout.mjs`** — N tools at once, bounded, losing none of them.
- **`meters.mjs`** — what a run has spent, and the one rule about not knowing.
- **`journal.mjs`** — the append-only record, and the replay that rebuilds a run.
- **`run.mjs`** — the loop.

### The law, module by module

**`limits.mjs`**

- **EIGHT BOUNDS, AND EVERY ONE IS ENFORCED IN CODE**: `steps` 16, `toolCalls`
  64, `parallelTools` 8, `wallMs` 300,000, `callMs` 120,000, `toolMs` 30,000,
  `tokens` 1,000,000, `costMicros` 2,000,000. "A cap the model is only told
  about is not a cap."
- **`LIMIT_NAMES` IS DERIVED FROM `LIMIT_DEFAULTS`**, and `RUN_TOTALS` is a
  PARTITION of it — a bound added next month is forced onto one side or the
  other rather than silently being neither.
- **A PER-OPERATION BOUND MAY NEVER END A RUN.** `callMs`, `toolMs` and
  `parallelTools` bound one operation; reading one as a stop would report a
  finished run as a refused one.
- **TWO DOORS, AND THE TRUST BOUNDARY IS BETWEEN THEM.** `planLimits` is the
  AUTHOR's and may set any usable value, `Infinity` included. `narrowLimits` is
  for a caller that is not trusted — a tenant, a request body — and **may only
  ever reduce**, recording what it ignored. **The first cut had only the second
  and applied it everywhere**, which made `Infinity` unreachable from the public
  API and every Infinity branch dead code from outside: the root product's "a
  rule true because of a layer below it expires when that layer moves" (its
  `readJobMaxMs` may only shorten because everything else is derived AT IMPORT;
  nothing here is), on top of the wiring trap. Caught by a test, not by review.
- **`Infinity` IS A STATED ANSWER** in every reader — `leftOf`, `capMs`,
  `stoppedBy`. An unbounded budget is a real thing on this stack.
- **CANNOT-TELL MUST NEVER READ AS A VALUE, and `stoppedBy` names which.** A
  finite bound whose meter is broken is a stop with `reason: "unmeasured"`,
  because the alternative is enforcing a budget by assuming the thing we failed
  to measure was free. An INFINITE bound with a broken meter is NOT a stop —
  there is nothing to be outside of — and that half is what keeps the rule from
  being a nuisance on a provider that does not report usage.
- **`okLimit` REFUSES, NEVER COERCES.** `String(["8"])` is `"8"`. **NaN has no
  branch of its own**: measured over 23 input classes, removing one made zero
  behavioural difference, because `Number.isFinite(NaN)` is false AND
  `NaN >= 0` is false. It was redundancy, not a second wall. Do not add it back.

**`define.mjs`**

- **A DECLARATION THROWS WHEN A PART IS MISSING** — the root product's
  `laneRule` rule, for the same reason: a half-declared thing that loads fails
  later, somewhere else, in a way that does not name this file.
- **`TOOL_NAME` IS THE PROVIDER'S GRAMMAR, NOT OURS** (`^[a-zA-Z0-9_-]{1,64}$`).
  Pinned as an external constraint so nobody tidies it into something a provider
  rejects at run time.
- **`scope` IS COMPELLED, AND `PUBLIC` IS A REAL ANSWER.** Both possible
  defaults are wrong: default-public makes a dangerous tool callable the day
  somebody forgets a line, default-private teaches authors to grant everything.
- **TWO TOOLS WITH ONE NAME ARE REFUSED** — the loser is dead code that reads as
  live, since dispatch can only ever find one.
- **A TOOL IS CHECKED BY SHAPE, NOT BY IDENTITY.** An `instanceof` wall would
  refuse a legitimate tool that crossed a module boundary, for a reason nobody
  can see from the error.
- **`toolsFor` IS A POSITIVE LIST AND FAILS CLOSED** — "a negative list is the
  wrong wall when the input is caller-supplied". A `Set` of strings, so
  `"constructor"` cannot match a scope.
- **BOTH HALVES OF WITHHOLDING ARE LOAD-BEARING**: a tool the tenant may not use
  is never described to the model (it costs tokens and invites a plan that then
  fails), AND the withheld names come back, because "a filter is a silent drop;
  a check is a sentence".

**`fanout.mjs`**

- **`Promise.all` REJECTS ON THE FIRST FAILURE**, which here throws away every
  tool that answered because one did not. ONE shared implementation, and **every
  entry carries its INDEX** — the only thing tying an answer back once they
  finish out of order.
- **A FAILED ITEM IS AN ANSWER AT ITS OWN INDEX**, never an absence, so the
  output length always matches the input and position still means something.
- **EACH ITEM'S CLOCK STARTS AFTER ITS PERMIT.** Time the wait too and `ms`
  grows with the QUEUE rather than the work, and the slowest item cannot be
  found.
- **A LIST THAT FITS TAKES NO QUEUEING**; a longer one queues at the limit.
- **`Math.max(1, NaN)` IS NaN**, so a NaN limit is refused by name rather than
  clamped — the obvious guard silently produces the broken answer.

**`run.mjs`**

- **A STEP IS COUNTED BEFORE THE CALL, NOT AFTER.** Counted after, a `send` that
  always throws never advances the meter and the loop never ends — the bound
  would be described and not enforced. **This is the one mutant that HANGS
  rather than failing**, which is why the sweep is run with `--test-timeout`.
- **NO AUTO-RETRY.** The owner's money rule — *"we should not spend your credits
  for you."* A caller who wants another attempt asks, having seen what failed.
- **`callMs` IS HANDED TO `send`, NOT RACED HERE.** Only the transport can abort
  its own request; a timeout raced in this module leaves the real call running
  and still billing.
- **A BATCH THAT WOULD OUTRUN `toolCalls` IS REFUSED WHOLE, NEVER AS A PREFIX.**
  A prefix performs real side effects whose results nobody reads, because the run
  ends either way and the model is not there to see them.
- **DISPATCH FAILS CLOSED AND IS NOT REDUNDANT WITH `toolsFor`** — a model can
  name a tool that was never offered, withheld or invented. It comes back as a
  readable tool RESULT, and **the two say different things** ("not permitted for
  this tenant" vs "no such tool"), because they need different fixes.
- **A FAILED TOOL IS A RESULT THE MODEL IS SHOWN.** Dropped, the model waits for
  an answer that never comes and re-asks for ever.
- **THE RUN RECORD IS THE PRODUCT** — every step, the meters, the withheld
  names, the tenant, and the stop NAMED. Not a boolean and not a bare string.
- **AN UNREPORTED USAGE IS `null` AND IS STICKY** (`addMeter`). All token kinds
  count in full: a budget is not a bill.

**`meters.mjs`**

- **LIFTED OUT OF `run.mjs` WHEN THE REPLAY NEEDED THE SAME ARITHMETIC.** Two
  copies would drift in the direction where a RESUMED run believes it has spent
  less than it has.

**`journal.mjs`**

- **APPEND-ONLY, AND THAT IS THE WHOLE DESIGN.** A container recycles and an
  isolate dies; on this stack that is Tuesday, not an edge case. A log you only
  add to has no half-updated state to reason about, and the worst a crash can do
  is lose the last entry.
- **THE MODEL ANSWER IS WRITTEN THE MOMENT IT ARRIVES, BEFORE ANY TOOL RUNS.** It
  cost money and it is the one artifact a crash must never take; every later
  entry is cheap beside it. The root product's "store the raw answer ONCE, before
  anything can refuse it".
- **THE MESSAGE BUILDERS LIVE HERE, and that is the reason this module exists
  rather than a `replay()` bolted onto the loop.** The loop composes the
  conversation as it goes and the replay composes it again from the log; two
  copies of that composition drift in the worst possible direction — a RESUMED
  run sending the model a conversation subtly different from the one it would
  have had, with both halves looking right on their own.
- **`used.wallMs` IS WORK TIME, NOT CALENDAR TIME.** A run that died at midnight
  and resumes at nine did not spend nine hours working, and charging it nine
  hours would fail every resumed run on arrival. The replayed wall is the SUM OF
  RECORDED `ms`; the live loop adds its own segment on top. Written down because
  "wall clock" now means something slightly different from what the words say.
- **A JUNK ENTRY IS NAMED IN `problems`, NEVER SKIPPED.** Entries come back from
  storage, so they come from outside. Skipping one rebuilds a SHORTER
  conversation and a SMALLER bill than the run really had — the model sent a
  history missing a step, the meters under-reporting.
- **STEPS ARE REBUILT IN ASCENDING ORDER, not append order.** A tool entry
  follows its model entry in a healthy log, but a log is evidence rather than a
  promise.
- **A BATCH IS COUNTED WHOLE, the way the live loop counts it** — asked-for, not
  answered — or a resumed run believes it has more tool budget left than it does.
- **THE ABSENCE OF A `stopped` ENTRY IS WHAT SAYS "STILL RUNNING".** That is how
  an interrupted run and a finished one are different logs rather than one log
  read two ways.

### Resuming a run

- **PENDING TOOL CALLS ARE THE WHOLE HAZARD.** A call with no recorded result may
  have run, half-run, or never started — the log cannot say, because the process
  died before it could. **So the question is not "did it run" but "is running it
  again safe"**, which is what `repeatable` answers.
- **`repeatable` IS OPTIONAL AND ITS DEFAULT PROTECTS** (`false`). Unlike `scope`
  it is not compelled, and the difference is which way being wrong hurts: both of
  scope's defaults are actively wrong, so the author must choose; here a wrong
  `false` is an inconvenience and a wrong `true` is somebody billed twice.
  **Refused rather than coerced, because `Boolean("false")` is `true`** and a
  string out of a config file must not be what makes a payment tool repeatable.
- **A NON-REPEATABLE PENDING CALL REFUSES THE RESUME AND NAMES EVERY BLOCKER.**
  Refusing strands the run, which is bad; charging somebody twice is worse, and
  only one of the two is reversible by a person who has been told. **OPEN**: the
  alternative is to hand the model a "we could not tell whether this ran" result
  and let it continue. Not taken, and it is the owner's call.
- **THE GAPS ARE FILLED IN THE LOG AND THE LOG IS RE-REPLAYED**, rather than the
  message list being patched. That keeps ONE composer of the conversation.
- **A FINISHED RUN IS NOT RESTARTED** — its own stop comes back, so replaying a
  completed run twice cannot produce a second bill.
- **A LOG THAT CANNOT BE READ IS NOT RESUMED** (`journal-unreadable`), and
  nothing is spent finding out.
- **A FAILED JOURNAL WRITE STOPS THE RUN** (`journal-failed`). A caller who
  passed a journal asked for durability; carrying on without it produces a run
  that looks resumable and is not, and the work is then paid for twice. Nothing
  is lost: the record still carries everything so far.
- **`Infinity` DOES NOT SURVIVE JSON** — `JSON.stringify(Infinity)` is `"null"`
  — so an unbounded limit is logged as the STRING `"Infinity"`. The recorded
  "cannot-tell must never read as a value" trap arriving through a serialiser
  instead of through a reader.
- **NO STORAGE IS CHOSEN HERE.** `journal.append` is injected, so Postgres, R2, a
  Durable Object or an array in a test are all the same to this code. **Nothing
  has been written against a real store yet.**

### Measured

- **Suite: 93 tests, 0 failures** (`cd agent-builder && npm test`).
- **The root product's suite is UNAFFECTED: 6,316 tests, 0 failures** — run
  BEFORE this directory existed and again with it in the tree, same count, same
  colour. Measured rather than argued from the path filters. Note for a fresh
  container: it needs `npm ci` first or ~361 cases fail on missing modules (the
  environment, not the product), and `playwright-core` is NOT needed for it —
  those six checks belong to the container harness.
- **Sweep, FIRST FOUR MODULES: 34 mutants, 34 killed, 0 survived, 0 never
  applied, 2 comment-only controls survived.**
- **Sweep, WITH THE JOURNAL AND RESUME: 51 mutants, 50 killed, ONE SURVIVED, 0
  never applied, 2 controls survived.** The survivor was a real test gap and is
  recorded rather than smoothed over: the mutant made the loop ignore a failed
  MODEL-entry write, and the fixture was a journal that failed on EVERY write —
  so the run reached the `stopped` write, failed there instead, and came back
  `journal-failed` anyway. **The assertion passed for the wrong reason**, which
  is the recorded "a fixture too shallow to separate the two readings". Replaced
  by a census that fails one entry KIND at a time, with a control.
  **THE CONFIRMING RE-RUN HAS NOT BEEN DONE, so there is no clean-sweep number
  for this slice yet** — writing one here would be a claim ahead of its evidence,
  which is this file's own rule.
- Both controls carry `control: true` and not merely the word in their label, so
  the runner's own `CONTROL WAS KILLED` branch was armed. Run with
  `--test-timeout=20000`, because the "step counted after the call" mutant HANGS
  rather than failing.

## Where things stand

Scaffolded 2026-09-14. No source yet — the decisions below came first.

**Settled with the owner (2026-09-14):**
- It is a **framework / SDK**, code-first. Not a chat-to-agent product.
- It runs on **Cloudflare Workers + Supabase + containers** — the stack the owner
  already runs and pays for, so long jobs, queues, leases and the container
  clock are reused patterns rather than new inventions.
- **Multi-tenant from the first migration.** Read together with "framework/SDK"
  (which was offered as the no-tenant option) as: a library whose runtime
  threads a **tenant identity** through storage, quotas and tool permissions
  from the start, so a product built on top never retrofits isolation. **Flagged
  to the owner as an interpretation; not yet confirmed.**

**Open, nothing built on either yet:**
- What an agent's tools may reach, and how a tenant grants that.
- Whether runs are resumable across a process death (the root product's hardest
  won lesson: containers recycle and isolates die, so anything that matters is
  written down before it is needed).
