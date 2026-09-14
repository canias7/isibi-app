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

### Measured

- **Suite: 65 tests, 0 failures** (`cd agent-builder && npm test`).
- **The root product's suite is UNAFFECTED: 6,316 tests, 0 failures** — run
  BEFORE this directory existed and again with it in the tree, same count, same
  colour. Measured rather than argued from the path filters. Note for a fresh container: the root
  suite needs `npm ci` first or ~361 cases fail on missing modules — that is the
  environment, not the product, and `playwright-core` is NOT needed for it (its
  six checks belong to the container harness).
- **Sweep: 34 mutants, 34 killed, 0 survived, 0 never applied, 2 comment-only
  controls survived** — both controls carry `control: true` and not merely the
  word in their label, so the runner's own `CONTROL WAS KILLED` branch was armed.
  Run with `--test-timeout=20000`, because the "step counted after the call"
  mutant HANGS rather than failing. One mutant survived the first pass and was
  proved INERT by measurement rather than hunted: see `okLimit` above.

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
