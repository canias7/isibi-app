# The agent builder

An **AI agent framework / SDK**: declare an agent and its tools in code, and run
it under bounds that are enforced rather than described.

**IT HAS NOTHING TO DO WITH THE REST OF THIS REPOSITORY.** Owner, 2026-09-14:
*"The code will live in this repo, just separated… it had nothing to do for now
with what's on this repo."* It shares the git remote and the CI runner and
nothing else — no slug, no publish step, no per-customer database, no deploy.
A rule from anywhere else in the tree does not govern this directory, and this
product's notes are written here and never there.

## The engineering rules here

Not inherited from anywhere — this is how work in this directory ships.

- **Every change ships with**: guard tests, a mutation sweep from a
  verified-green baseline with a comment-only control that must survive, the
  whole suite, an entry here and in the owner notes, and a push.
- **The sweep is `npm run sweep`**, and its breakages are COMMITTED
  (`scripts/sweep-spec.mjs`) rather than typed fresh each time — a sweep that
  only ever existed in somebody's terminal cannot be re-run, so it certifies one
  afternoon and nothing after it. The generator REFUSES to emit a spec with an
  ambiguous or missing anchor, because reading "NEVER APPLIED" after the run is
  the same information arriving too late, and a breakage that never landed reads
  exactly like one the tests caught.
- **The sweep RUNNER is a shared dev tool at the repo root** (`scripts/mutate.mjs`),
  used rather than copied: a second copy would drift, and the one that drifts is
  the one reporting whether the tests work. It is the only thing outside this
  directory that any of this depends on, and nothing ships through it.
- **A cap the model is only told about is not a cap.** Enforce it in code.
- **Cannot-tell must never read as a value**, and a stated answer must never read
  as cannot-tell.
- **Assert the property, not the spelling.** A guard pinned to an exact call
  shape goes red on an honest change and reports a working feature as gone.
- **A negative assertion must prove its observer is alive.** `[].every(...)` is
  `true`, and `indexOf(a) < indexOf(b)` is satisfied by `-1`.
- **Refuse, never coerce.** `String(["x"])` is `"x"` and `Boolean("false")` is
  `true`.
- **A filter on somebody's input is a silent drop; a check is a sentence.**
- **Stamp measured numbers only AFTER the run.** A count nobody re-measured is a
  claim ahead of its evidence.
- **Derive a fixture from its real producer.** A fake in a different shape from
  reality hides bugs, and one that is MORE capable hides them just as well as one
  that is less.
- **NO READING OF THE TREE MEANS ANYTHING WHILE A SWEEP IS RUNNING — not a commit, and
  not a test run either.** `npm test` during a sweep reported `233 tests, 232 pass, 1
  fail`, which was a mutant applied at that instant and not a regression; the same run
  minutes later was clean. The rule used to cover committing only, because that is the
  form that leaves damage behind — but a red suite read mid-sweep is a false alarm, and
  a GREEN one read mid-sweep is worse, because a comment-only mutant was applied and the
  run proves nothing about the tree anybody will commit. **Wait for the tally.**
- **A KILLED SWEEP REALLY DOES LEAVE A LIVE MUTANT — confirmed in practice, not
  quoted.** The SQL sweep was stopped part way through and
  `20260915015602_agent_runs.sql` was left with `entries_one_tool_per_slot` dropped: the
  runner skips its restore when it is killed. **The check that catches it is the SPEC
  GENERATOR**, which asserts every anchor occurs exactly once in its file, so a missing
  anchor is a mutant still applied. Run it before committing after any interrupted
  sweep; `git checkout -- supabase/migrations/` is the restore, and an UNTRACKED
  migration has no such safety net.
- **A CHANGE CAN CREATE REDUNDANCY, and the sweep will report it as a test gap.**
  When a wall moves DOWN a layer — into the database, into a privilege — the check
  that used to be the wall becomes a second one in front of it, and no single mutant
  can kill either. Measure both versions, keep the one that earns its place, delete
  the one that was the same wall written twice, and DECLARE what is left where the
  next reader will meet it. Six of these arrived in one change; the sweep found every
  one and called all six test gaps.
- **A mutant aimed at something a later file REDEFINES is inert by construction.**
  Ask the files which one is in force rather than counting them.
- **REPORTING WHAT ANSWERED IS NOT REPORTING WHAT IS DEPLOYED, and the two read
  identically.** A run printed a version id two deploys old as "the deployed version"
  and passed 69 checks under it. Two separate things have to be true: the run must END
  holding one id printed by the LAST step that changes the thing (`wrangler secret put`
  mints a version of its own and prints no id, so a deploy has to come after it), and
  the thing must be ASKED UNTIL it answers that id — one read seconds after a change
  proves nothing, and a liveness answer like `ok: true` is no substitute, because the
  previous deployment gives it just as truthfully.
- **A CHECK THAT CANNOT BE MADE IS NOT A CHECK THAT PASSED.** When the expectation is
  absent, say so where the result is read; a silent skip is how a missing wiring hop
  reads as a pass.
- **THE THING THAT RUNS YOUR GUARDS NEEDS A GUARD.** The deploy workflow had none for
  three deploys, so a step could stop checking and no run would go red — it fails in the
  safe-looking direction. `test/deploy-workflow.test.mjs` reads it now; for a file with
  no parser available, split on an exact structural anchor and PROVE THE READER ALIVE
  before asserting anything about what it found.

## Living in a shared repository

The code sits in this repo, so a few rules keep it from touching anything else.
These were measured on 2026-09-14, not assumed, and re-verified by running the
rest of the tree's suite before and after this directory existed — same count,
same colour.

- **Everything belonging to this product lives under `agent-builder/`.** Never a
  file at the repository root: two checks elsewhere in the tree scan the root for
  `.mjs` files, and a folder is invisible to them where a file is not.
- **NEVER TOUCH THE ROOT `package.json`.** It is a container image input and it
  is in another workflow's paths filter, so a one-line edit rebuilds an image and
  fires a 25-minute harness. This directory has its own.
- **The tests here are run from here** (`cd agent-builder && npm test`). The
  repo-wide `unit tests` workflow runs the root `test/` folder only, so nothing
  here can make it red — and nothing here is covered by it either.
- **Nothing here deploys.** The deploy fires only on a push to `main`, and no
  Dockerfile copies this directory, so a push here rolls no container.
- **⚠ ONE FILE HERE READS THE SITE BUILDER'S CODE, and it is declared rather than
  discovered.** `scripts/verify-agent-chat.mjs` imports the ROOT's `agent-store.mjs`,
  because the thing it verifies is the two halves TOGETHER — the site builder's route
  driving this engine through one database. It is the only such file, it is a script
  rather than a test, and **this directory's own suite still imports nothing outside
  it** — `npm test` here is independent of the other tree, checked rather than assumed.
  The cost is real and small: move or rename `agent-store.mjs` and `npm run
  verify:chat` breaks, loudly, on its import.
  **THE OTHER DIRECTION WAS ALREADY CROSSED AND IS NOT NEW**, and saying so corrects a
  sentence this entry first carried: `test/agent-api.test.mjs` in the ROOT suite READS
  migration files out of `agent-builder/supabase/migrations/`, to census its caps
  against the columns' own check constraints. So a change to those files can make the
  site builder's `unit tests` workflow red — which is the coupling working (that census
  exists because a cap in one place and a constraint in the other is two copies of one
  number), not a leak to be closed.
- **A workflow added here must not fire on a push to `main`** and must have some
  trigger; a `workflow_dispatch`-only workflow is fine. A census elsewhere in the
  tree enforces that and will fail otherwise.

## What is built

Fourteen modules under `src/`, **all dependency-free** — this has to run in a
Cloudflare Worker, where there is no `node_modules` — with every outside thing
(the model call, the clock, the journal) INJECTED. That is not purity for its own sake: it is
what makes every branch below drivable in a test instead of waited on.

- **`limits.mjs`** — the bounds on one run, and the whole safety argument.
- **`define.mjs`** — `defineAgent` / `defineTool`, and the tenancy wall.
- **`fanout.mjs`** — N tools at once, bounded, losing none of them.
- **`meters.mjs`** — what a run has spent, and the one rule about not knowing.
- **`journal.mjs`** — the append-only record, the replay that rebuilds a run, and
  the limits codec.
- **`store.mjs`** — where the log is kept: Supabase, over PostgREST. It READS the log
  and hands every write to the fence.
- **`work.mjs`** — the durable queue's memory: seven RPCs over the same wire, one of
  which (`append_entry`) is the only door into the log.
- **`runner.mjs`** — the consumer. The ONLY place that executes a run.
- **`auth.mjs`** — who is asking, verified against the project rather than a secret.
- **`api.mjs`** — the HTTP surface: accept a run, read it, ask for it again.
- **`agents.mjs`** — the registry. Agents are CODE and this is where it lives.
- **`model-standin.mjs`** — a model-shaped answer that costs nothing.
- **`worker.mjs`** — the entry point, and the only file that knows it is Cloudflare.
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
  API and every Infinity branch dead code from outside. **A rule is only as true
  as the thing it rests on**: "may only reduce" is right where the other numbers
  are derived at import from the one setting, and nothing here is derived at
  import. Caught by a test, not by review.
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

- **A DECLARATION THROWS WHEN A PART IS MISSING.** A half-declared thing that
  loads is a thing that fails later, somewhere else, in a way that does not name
  this file. Author time is the one moment when throwing is cheap.
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
  entry is cheap beside it. **Store the raw answer ONCE, before anything can
  refuse it** — the tempting alternative is a summary or a status field, and a
  summary never answers the question you end up having.
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

## Storing a run (2026-09-15)

`supabase/migrations/20260915002004_agent_runs.sql` and `src/store.mjs`. **The
storage foundation only** — no HTTP route, no real model call, no container.

### The schema

**ITS OWN SCHEMA, `agent`.** Dropping this product is dropping one schema, and
nothing it creates can collide with a table belonging to anything else. The cost
is one deployment detail: the schema must be in Supabase's exposed-schemas
setting, and the store names it per request (`Accept-Profile` / `Content-Profile`).

**THE LOG IS THE ONLY THING WRITTEN, and the engine derives the rest.** The
application inserts a run's `id` and `tenant_id` AND NOTHING ELSE; `status`,
`agent_name`, `model`, `limits`, `stop`, `started_at` and `stopped_at` are all
maintained by triggers off the entries. A `status` the application wrote would be
a second copy of a fact the log already states, and two copies of one fact
eventually disagree.

**`kind`, `step` and `idx` ARE GENERATED COLUMNS off the body**, never supplied.
That is what makes the unique indexes below guarantees about the ENTRY rather than
about a caller-supplied copy of its position.

**WHAT THE DATABASE MAKES IMPOSSIBLE, rather than merely detectable** — `replay`
reports each of these as a `problem` because a log can arrive from anywhere, but
none of them can be written in the first place:

- a second `started` or `stopped` entry for a run;
- a second model answer for one step;
- a second result for one tool slot;
- the same `seq` twice (the primary key);
- a model entry with no step, or a tool entry with no step and index, or an
  unknown kind (one CHECK, written against the body because a check on a
  generated column is evaluated before the column is computed);
- an entry being EDITED after it was written.

**APPEND-ONLY IS A TRIGGER, NOT A GRANT.** UPDATE is refused for everyone,
including a caller with every privilege, because editing history is the one
operation that makes the whole design worthless and a grant would not stop the
role that writes the log.

**AND A SINGLE ENTRY CANNOT BE DELETED WHILE ITS RUN REMAINS — a separate hole
and a worse one, found by looking for it (2026-09-15).** Deleting one entry
corrupts the log in the one way a reader CANNOT SEE: a model entry whose tool
result is gone replays as a call still PENDING, and `problems` comes back EMPTY,
because a deleted entry is indistinguishable from one that was never written.
**MEASURED before the fix**: a completed `charge` came back pending with nothing
flagged. On resume that is a payment taken twice, or a run stranded, depending on
how the tool is declared.

**RETENTION IS THE ONLY WAY THROUGH: delete the RUN and its log goes with it.** A
pair of triggers says exactly that — `agent.runs`' own BEFORE DELETE sets a
transaction-local marker, and an entry may be deleted only while that marker is
set.

- **WHY A MARKER RATHER THAN ASKING WHETHER THE PARENT IS STILL THERE.** The
  obvious test — `exists (select 1 from agent.runs where id = old.run_id)`, since
  a cascade removes the parent first — depends on that row being VISIBLE to the
  check, and `agent.runs` has FORCE row level security, so visibility varies with
  the role and with the platform. **A wall whose answer depends on who is looking
  fails OPEN when it fails.** The marker has no such dependency.
- **THE PRIMARY WALL IS STILL THE GRANT.** No role is given DELETE on the entries,
  so the only caller that can try is the table's owner; the triggers are what stop
  the owner doing it by hand. The redundancy is deliberate and is declared here
  because a sweep cannot see it and the next reader deletes what nothing appears
  to need.
- **THE MARKER IS TRANSACTION-LOCAL**, so it cannot leak into the next statement
  on a pooled connection — checked, because a leaked marker would reopen the hole
  for every later statement on that session.

### Tenant isolation

**RLS on both tables, FORCED** (so the owner is not quietly exempt), keyed on
`agent.tenant_id()` — the tenant from the request JWT.

**IT FAILS CLOSED THREE WAYS, and the mechanism is SQL's own null semantics
rather than something the function remembers to do**: no claims, claims that will
not parse, and claims with no tenant all answer NULL, and `tenant_id = NULL` is
NULL rather than true, so the policy matches no rows.

**AN ENTRY'S TENANT IS ITS RUN'S TENANT, never a column of its own.** A copy on
the entry could disagree with the run it points at, and the disagreeing case is
the one where somebody reads another tenant's log.

**A TENANT READS AND WRITES NOTHING.** `authenticated` has SELECT only; INSERT is
the writer's, and UPDATE and DELETE on entries are granted to nobody at all.

**THE LIMIT OF THIS, STATED RATHER THAN GLOSSED: `service_role` CARRIES
`BYPASSRLS` ON SUPABASE**, so the policies protect the READ path. Nothing in the
database stops a writer that passes the wrong `tenant_id` — that is the
application's job, and `createRun` is the single place it is decided. Worth
knowing before trusting the wall further than it goes.

### The two values that must survive storage

- **UNKNOWN USAGE IS NOT ZERO AND NOT MISSING.** An unreported usage is stored as
  JSON `null` inside the body, with the key still present — three distinct states
  (`null`, `0`, absent) kept distinct, because a budget enforced by assuming the
  unmeasured spend was free is not enforced. Proved on the engine four ways: the
  type is `null`, the key is present, it equals JSON null, and it does not equal
  `0`.
- **AN UNLIMITED LIMIT SURVIVES AS THE STRING `"Infinity"`.**
  `JSON.stringify(Infinity)` is `"null"`, so writing it straight out produces a
  null that no reader can tell from "no limit was recorded" — cannot-tell wearing
  a value's clothes, arriving through a serialiser. **The codec pair lives
  together** in `journal.mjs` (`limitsToJson` / `limitsFromJson`), because an
  encoder in one file and a decoder in another is how a round trip quietly stops
  being one. **A STORED NULL STAYS NULL AND NEVER DECODES TO UNBOUNDED**, which is
  the most expensive possible reading of a missing value.

### The store

- **`fetch` IS INJECTED.** Every branch is drivable with no network and no
  database.
- **THE TENANT IS A CLOSURE, NOT AN ARGUMENT, and that is the whole shape of the
  boundary.** `makeRunStore` returns ONE method, `forTenant`, and every operation
  comes from what that returns. **No call takes a tenant, so a tenant id in a
  request body cannot become authority even by accident — there is nowhere to put
  it.** Asserted as a census over the real surface rather than promised in a
  comment. The tenant handed to `forTenant` must come from a VERIFIED token, and
  that is the one obligation this module cannot check for its caller.
- **A JOURNAL IS UNREACHABLE WITHOUT PASSING THE OWNERSHIP CHECK.** `create` and
  `open` are its only sources and both authorise first; a public
  `journalFor(runId)` would be a way to append to another tenant's log, so it does
  not exist. `load` is `open` minus the journal, so a read-only view cannot hand
  out a way to write.
- **THE OWNERSHIP CHECK ASKS FOR BOTH FILTERS IN ONE REQUEST.** Reading the run
  and then comparing its tenant in JavaScript is the same question asked somewhere
  that forgetting the comparison still compiles.
- **NOT FOUND, NEVER FORBIDDEN.** A run belonging to somebody else and a run that
  does not exist answer the SAME error, because the difference between them is
  information: "forbidden" tells a stranger the id they guessed is real. The error
  also never names the owning tenant.
- **A REPEATED `create` CANNOT HAND OVER ANOTHER TENANT'S RUN.** The primary key
  is on the id ALONE, so a duplicate could be somebody else's run with the same
  id, and answering with a journal for it would be the leak. A duplicate is
  absorbed only after ownership is confirmed.
- **A REFUSED DUPLICATE IS A SUCCESS, and this is the one thing to understand
  before changing that file.** An append can be retried: the network drops after
  Postgres committed and before the answer came back, and the caller cannot know
  which side of the commit it died on. Treating the duplicate-key refusal as an
  error would kill a run that is fine — and the entry being re-sent holds an
  answer already paid for. So the four LOGICAL rules are read as "already
  recorded", which turns them from an obstacle into the thing that makes retrying
  safe.
- **AND THAT ONLY WORKS BECAUSE EVERY KIND HAS A LOGICAL RULE**, so a duplicate
  can never land at a different `seq`. That is what lets a `seq` collision move up
  and try once without any risk of writing the same entry twice: if it really is
  the same entry, the logical rule catches it on the retry.
- **AN UNRECOGNISED REFUSAL IS RAISED, NEVER SWALLOWED.** `duplicateKind` answers
  `null` for a constraint it does not know, because reading an unknown refusal as
  "already recorded" would silently drop a real entry — the one outcome this
  module exists to prevent.
- **`nextSeq` COMES FROM THE HIGHEST `seq`, NEVER FROM THE ROW COUNT.** A gap (a
  retention delete, or a position clash that moved up) makes a count collide with
  an entry that is still there.
- **`load` REPLAYS RATHER THAN HANDING BACK A BARE ARRAY**, so `problems` cannot
  be skipped by accident — a log with problems must not be resumed, and a bare
  array invites passing it straight to `runAgent` without looking.
- **A FAILED READ THROWS.** An empty log and a log we could not see mean opposite
  things: one is a new run, the other is a run whose history is unknown.

### Three findings from the schema check itself

Each cost a round, and each is the fixture being wrong rather than the product:

- **`service_role` CARRIES `BYPASSRLS` ON THE PLATFORM and the first harness
  created it without.** The writer was then refused by the very policies it is
  exempt from, and forty checks failed for a reason that does not exist in
  production. A fixture in a different shape from reality is worse than none,
  because it produces a specific wrong answer.
- **ROLES ARE CLUSTER-WIDE, so `create role if not exists` is not an idempotent
  DEFINITION.** A role left by an earlier run kept its old attributes and the
  create was a no-op. The harness ALTERs the attributes every time now.
- **`select set_config(...)` RETURNS A ROW**, and with `-t -A` that row lands in
  front of the real answer — which is how a count of 0 came back as the claims
  followed by 0. `SET` returns nothing and is what the harness uses. A harness
  that contaminates its own output reports the product as broken.

### What is proven, and what is not

- **`npm run test:pg` — 78 checks, 0 failed, against a real PostgreSQL 16.13** in
  a throwaway database. **The DDL is never typed in the check**: it comes out of
  the migration FILE, so what is proved is what would be applied. Every refusal is
  read for its REASON (a refusal from the wrong gate looks exactly like the wall
  working), and every group carries a CONTROL that must succeed, without which a
  database refusing everything would pass the file.
- **THE DATABASE CHECKS AND THE SQL SWEEP ARE DIFFERENT THINGS, and both now
  exist.** The 70 checks are hand-written adversarial coverage: each attacks one
  guarantee from the outside and names the gate that must stop it. The SQL sweep is
  mechanical: it breaks the schema and requires those checks to go red. **The sweep
  is what found the real hole and the two blind spots** — hand-written coverage
  could not, because it only ever tests what somebody thought of. It covers the
  four named guarantees and NOT the whole schema, so a guarantee outside those four
  is still checked only by hand.
- **APPLIED LIVE, 2026-09-15, to `ujrqdmmtcptvimazlhom`** — the project the rest of
  this repository already uses (owner: *"it can be in the same supabase
  project"*). Recorded as remote version `20260915015602`, and **the migration file
  is named for that** rather than for when it was written, because lining the two
  up by NAME is the only thing that works later.
  **ONE PROJECT, TWO PRODUCTS, ONE SCHEMA EACH.** Nothing here is in `public`, so
  no name can collide and dropping this product is dropping one schema. The cost is
  that the project's migration history now comes from two directories.
  **VERIFIED BY READING IT BACK, not by the success flag**: 2 tables, 3 generated
  columns, 4 partial unique indexes, 4 triggers, RLS enabled and forced on both, 2
  policies, 5 functions — and `public` still holding its 32 tables, so nothing else
  moved. Then a behavioural probe **on Postgres 17** (the local checks run on
  16.13) covering every guarantee: the projection, the unbounded limit surviving as
  a string, an unreported usage staying JSON null and not zero, all four duplicate
  refusals, the malformed-entry refusal, append-only, the lone-delete refusal,
  tenant isolation as a real `authenticated` client, failing closed on absent and
  on junk claims, and retention cascading. **The probe rolled itself back** and
  both tables are empty.
  **THE SECURITY ADVISORS FLAG NOTHING IN `agent`** — every finding is pre-existing
  in `public`/`private`. Note that `agent.project_entry` is SECURITY DEFINER and is
  NOT flagged, because those lints only look at schemas exposed to the API, which
  brings us to:
- **⚠ `agent` IS NOT EXPOSED TO POSTGREST, so the store cannot reach it yet.**
  Checked: there is no role-level `pgrst.db_schemas`, so the project runs the
  platform default (`public, graphql_public`). Adding `agent` in the dashboard
  (Project Settings → API → Exposed schemas) is a one-line change and the last
  thing between the store and the live tables. Until then the tables exist, are
  correct, and are unreachable over REST — which is also why nothing is at risk
  while the rest is unwired.

## The HTTP surface (2026-09-15)

`src/auth.mjs` and `src/api.mjs`. A `fetch(request)` handler, which is what a
Worker wants, with nothing bound to Cloudflare: `verify`, `store`, `send`,
`dispatch`, `now` and `newId` are all injected.

### Who is asking — verified against the PROJECT, not against a secret we hold

**THE SIGNING SECRET IS NO LONGER A REQUIRED SETTING, and that is the point of
`auth.mjs` (2026-09-15).** Asking an operator for a project's HS256 secret means
asking for the credential that can MINT a token for any user, to do a job that only
needs the ability to CHECK one. Three strategies, and **the token in front of it
decides which** — never a configuration guess:

| strategy | when | cost |
|---|---|---|
| `jwks` | the token names an asymmetric `alg` and a `kid` | none: verified in-process with WebCrypto against the published key |
| `auth` | an HS256 token and no local secret | one `GET /auth/v1/user`, cached 60 s per token |
| `secret` | an HS256 token and an operator who opted in | none, and never a default |

**MEASURED AGAINST THIS PROJECT (2026-09-15), which is why the `auth` path is known
to work rather than assumed to:** `/auth/v1/.well-known/jwks.json` answers **one
ES256 key**, `kid` `87e0c19f-00be-48c1-bf46-5a5f318a0ea9`, and it imports into
WebCrypto. A genuine legacy HS256 token (the project's own anon key) is answered
`invalid claim: missing sub claim` — the signature PASSED and it reached the claims
— and the same token with one character changed is answered `token signature is
invalid`. **Two different refusals for two different causes is what makes it an
oracle rather than a guess.** `scripts/auth-probe.mjs` is that reading, re-runnable.

- **THE HEADER ROUTES; IT NEVER AUTHORISES.** Reading `alg` to choose a STRATEGY is
  safe. Reading it to choose a KEY is the oldest hole in JWT, so the two families
  are kept strictly apart: **an HS256 token can never reach a JWKS key** (it does
  not even provoke a key fetch) and an asymmetric token can never reach the HMAC
  one. `none` and every unknown name are refused before anything is looked up.
- **THE PUBLISHED KEY'S OWN `alg` DECIDES.** A key published as ES256 is never used
  to check an RS256 token because the token said so. Driven with a real generated
  P-256 keypair, and every algorithm in the table is proved to name real WebCrypto
  parameters by signing and verifying with it.
- **AN UNKNOWN `kid` IS `no-key`; AN UNREACHABLE KEY SET IS `unavailable`.** One is
  a bad token, the other is our own outage, and collapsing them would report a
  five-minute auth blip as every customer's credentials having been forged. The same
  split on the `auth` path: a 401/403 is Supabase saying no, a 5xx is not an answer.
- **A ROTATION WORKS WITHOUT A DEPLOYMENT** — an unseen `kid` provokes one fetch —
  **and a forged `kid` cannot make this Worker hammer the auth endpoint**, because
  that fetch has a floor (`JWKS_MIN_REFETCH_MS` 60 s, under the 600 s TTL). Proved
  by counting fetches: 20 invented kids cost zero.
- **A CACHED `auth` ANSWER IS BOUNDED BY THE TOKEN'S OWN EXPIRY**, so it can never
  outlive what it was about; a refusal is NEVER cached, or a blip would refuse a
  good token for a minute; and the cache has a ceiling, because one without is a
  leak.
- **AN EXPIRED TOKEN IS REFUSED BEFORE IT COSTS A ROUND TRIP**, and that shortcut
  can only ever REFUSE — it fires on a payload that parses with an `exp` already
  past, and everything else falls through to the authoritative check. Delete it and
  the verdicts are identical; only the bill changes. **A test asserting the call
  count is what found it missing.**
- **A VERIFIER THAT COULD CHECK NOTHING REFUSES TO EXIST.** With no project and no
  secret, every request would be refused for a reason that has nothing to do with
  the request — which reads, from outside, exactly like every customer's token being
  forged at once.
- **THE SIGNATURE IS VERIFIED BEFORE THE PAYLOAD IS EVEN PARSED.** Reading claims
  first is how unsigned data gets trusted by accident — a log line, an early
  return, a metric keyed on an unverified tenant.
- **`exp` IS REQUIRED, not merely honoured when present.** A signed token with no
  expiry never stops working, so a leaked one is permanent. Expiry is checked as
  `<=`: a token valid at its own deadline is valid for one instant longer than it
  says.
- **THE TENANT IS REFUSED, NOT COERCED** (`String(["t1"])` is `"t1"`), and a token
  carrying no tenant is not an identity.
- **BASE64URL IS DECODED STRICTLY.** A segment in standard base64 (`+`, `/`, `=`)
  is refused rather than repaired: a decoder that fixes up its input accepts
  tokens a real one rejects, which is how a parser ends up disagreeing with
  whatever signed the thing. **Found by a sweep** — removing the charset check
  changed nothing any other case could see.
- **A REFUSAL IS NAMED INTERNALLY AND ANONYMOUS ON THE WIRE.** `REFUSALS` lists
  every reason for logs; the response is one sentence and one status, because
  naming the reason turns the endpoint into an oracle for probing tokens.
- **THE CLAIM NAME MUST MATCH THE MIGRATION**, which reads `tenant_id` out of the
  same JWT. The same fact in two languages with no type system between them, so a
  test reads the migration and compares. Diverge and every request would
  authenticate here and see nothing there — and it would look like an empty
  database rather than a mismatch.

### The order of every request IS the security argument

Four steps, always: **verify the token → take the tenant from the VERIFIED claims
→ build a store scoped to that tenant → then look at what was asked for.**

- **THE BODY IS NEVER AUTHORITY.** The scoped store takes no tenant argument, so
  there is nowhere for a body field to be mistaken for one — and a body that
  carries `tenant`, `tenant_id` or `tenantId` is **REFUSED**, not ignored, because
  a silent drop lets somebody believe it worked. Checked with `Object.hasOwn` and
  not truthiness, which matters for exactly one case: a key that is PRESENT and
  FALSY (`{tenant: ""}`) is still a tenant in the body. **That was a sweep's
  finding** — a truthiness check passed every other case.
- **NOT FOUND, NEVER FORBIDDEN.** Another tenant's run and a run that does not
  exist answer the same status and the same body.
- **AN AGENT IS NAMED, NEVER DESCRIBED.** The registry holds `defineAgent`
  results; a request picks one. An agent is tools, instructions and bounds — code
  — and letting a request supply that is letting a request supply code.
- **A RESUME TAKES ITS AGENT FROM THE STORED RUN**, never from the request. A
  resume that could name a different agent would run one agent's tools over
  another's conversation. A run whose agent is no longer registered is a named
  409.

### The work is not the request

- **ACCEPTING A RUN COMMITS IT AND ANSWERS 202. NOTHING IN `api.mjs` EXECUTES
  ANYTHING** — that is `runner.mjs`, behind the queue. The two are deliberately far
  apart, and the ordering is the durability argument; see the queue section below.
- **A FINISHED RUN IS NOT QUEUED**, and the runner would refuse it, and `runAgent`
  would refuse it. Three walls, deliberately: this one makes the answer immediate
  and cheap, the others make it true even if something ever calls past here.
- **A RUN WHOSE LOG CANNOT BE READ IS NOT RESUMED** (409, with the problems).
  Resuming past a junk entry sends the model a history with a step missing and
  under-reports the bill. **Also a sweep's finding.**
- **`send` IS NO LONGER THE API'S BUSINESS AT ALL.** An API built with no model is
  correct rather than broken, and that is pinned — a `send` quietly accepted here
  would be a second execution path beside the runner.

## The durable queue (2026-09-15)

`supabase/migrations/20260915032807_agent_run_work.sql`, `src/work.mjs`,
`src/runner.mjs`, and the three handlers in `src/worker.mjs`.

**`ctx.waitUntil` IS GONE, AND IT IS NOT A FALLBACK EITHER.** It kept a run alive
after the response, which is the right shape and the wrong durability: **the work
existed only as a closure in one isolate**, so an eviction, a deploy or a crash lost
it with nothing anywhere recording that a run was ever meant to progress. A test
scans `worker.mjs` for the word, because a `waitUntil` fallback would satisfy every
behavioural test while quietly restoring the old durability.

### The row is the work; the message is only a doorbell

- **ACCEPTING IS ONE TRANSACTION OR NOTHING.** `agent.accept_run` writes the run,
  **its first journal entry** and the queue row together. Three separate PostgREST
  calls could leave a run with a log and nothing to run it, or a work row for a run
  with no log — and a function body is a transaction, so neither half-state exists.
- **THE `started` ENTRY MOVED INTO THE API, and that is what makes the work durable
  rather than merely recorded.** It carries the prompt, the agent, the model and the
  bounds, so once `accept` commits, everything needed to execute the run is in the
  database and the request can go away. **Built with the SAME `startedEntry` as the
  SDK path**, because two producers of one entry shape is how a resumed run ends up
  with a subtly different conversation.
- **SO THERE IS NO "FRESH START" PATH IN THE RUNNER.** Every execution continues
  from the stored log — one code path, and a log holding only a `started` entry
  replays as a runnable run with `step: 0`.
- **A MESSAGE CARRIES A RUN ID AND NOTHING ELSE.** `claim_run` answers the tenant,
  so claiming the work and learning whose it is are ONE statement and a stale or
  replayed message can never make a consumer act as somebody. A mutant that adds the
  tenant to the message is in the sweep.
- **A DOORBELL IS ALLOWED TO FAIL.** The work is already committed, so a failed
  `notify` is logged and the response still says 202 — with `delivered: false`, because
  a lost delivery costs latency and never work. Answering 500 would tell a caller
  their run was rejected when it is sitting in the queue, ready.

### Exactly one execution, and FOUR things enforce it

**THE FOURTH ARRIVED ON 2026-09-15 and is the section "Fencing the journal" above:**
the claim is a TOKEN, and every journal write presents it, validated in the same
transaction as the insert. The three below are what decides who MAY run; the fence is
what decides who may WRITE, and the deployment proved that the first three are not
enough on their own.

- **THE CLAIM IS THE ONE GATE AND IT IS THE DATABASE'S.** One conditional `UPDATE`:
  the row is taken only if nobody holds a live lease. A duplicate delivery, a
  sweeper racing the original worker, and two simultaneous resumes all lose the same
  way — zero rows back, and the loser does nothing. **Nothing is checked in the
  process that could be raced.**
- **A RESUME MID-RUN IS SETTLED IN `requeue_run`, NOT IN THE CALLER.** It locks the
  row and answers `running`, so the second press never becomes a second delivery. A
  check in JavaScript would be a race wearing a wall's clothes.
- **THE LEASE IS A LIVENESS CHECK, NOT A DURATION CAP.** `LEASE_TTL_S` 90,
  `BEAT_EVERY_MS` 30,000. Reclaim is decided by `lease_expires_at` and **never by
  elapsed time**, so a run that keeps beating is never taken away however long its
  work honestly takes. Driven: a run going for the equivalent of two hours with a
  live lease is not swept and not claimable, with the same row swept once its lease
  lapses as the control.
- **A LAPSED LEASE CANNOT BE REVIVED BY ITS OWN HOLDER.** The sweeper may already
  have handed the run on, and there is no way from inside to tell whether it has —
  extending it would be a guess in the one direction that produces two workers on
  one run. The cost, stated: a worker paused longer than the TTL loses its run even
  if nobody wanted it, and resumes from the log.
- **AND THE CLAIM IS NOT ENOUGH, WHICH IS WHAT THE TWO LEASE GATES ARE FOR.** A
  worker that loses its lease mid-run is stopped **before its next model call** (so a
  lost lease costs nothing rather than money) and **before any journal write** (so it
  cannot write history somebody else now owns). `runAgent` reads a refused write as
  `journal-failed` and returns WITHOUT recording a stop, which is exactly right: the
  run is left as the next holder needs to find it. **MEASURED: the log after a lost
  lease holds only what was written before it went.**
- **THE HONEST LIMIT, STATED: the window is one model call plus one tool batch.**
  Between two checkpoints the process finishes what it started, because tools are the
  agent author's code and there is nowhere to interrupt them from. Making it smaller
  means a cancellation hook inside `run.mjs`, and that has not been done.
- **A BEAT THAT CANNOT BE SENT IS TOLERATED EXACTLY AS FAR AS THE ARITHMETIC
  ALLOWS.** `TOLERATED_MISSES` is DERIVED (`floor(TTL / beat) - 2` = 1): one missed
  beat is still inside a lease we demonstrably hold. **A beat that comes back `false`
  is never tolerated** — that is the database, not a blip — and the two are reported
  under different names (`beat-failed` vs `lease-lost`) because they are different
  problems.

### The restriction on repeating uncertain work survives all of it

**A REDELIVERY WILL NOT REPEAT A TOOL THAT MAY HAVE ALREADY RUN.** The whole hazard
of a durable queue in one test: a non-repeatable `charge` tool runs, the lease lapses
before its result can be written, the sweeper offers the run again — and the
redelivery answers `cannot-resume`, names the blocking call, and **the payment is
taken once**. Its control is the same shape with a repeatable tool, which IS finished
on the redelivery; without that control, "refuses to repeat" is indistinguishable
from "refuses to resume at all".

**A RUN THAT CANNOT BE SAFELY RESUMED COMES OFF THE QUEUE AND KEEPS NO STOP.** It is
waiting for a person, not for a retry, so the log stays open and `GET /runs/:id`
shows the pending call. `problems` is EMPTY, which is correct: a missing tool result
is not a corrupt log.

### Every outcome is named, and a consumer never throws

`OUTCOMES`: `ran` · `not-claimable` · `already-finished` · `unreadable` ·
`no-agent` · `cannot-resume` · `too-many-attempts` · `lease-lost` · `failed`.

- **A CONSUMER THAT THROWS IS A DELIVERY THE PLATFORM RETRIES BLINDLY**, which is
  how one run becomes four. `deliver` never throws, and that is driven with a store
  that falls over.
- **EVERY MESSAGE IS ACKED, EVEN A FAILED ONE: THERE IS EXACTLY ONE RETRY
  AUTHORITY.** The work row decides whether a run is offered again and the cron does
  the offering. Letting the queue retry as well would give two mechanisms
  redelivering on different clocks and a message eventually dead-lettering for a
  reason that has nothing to do with the run. **The one exception is a consumer that
  could not be BUILT** — with no configuration the row cannot be read, so nothing
  could decide anything, and the queue's own retry is right there.
- **`MAX_ATTEMPTS` IS 5, and "this keeps failing" is a named outcome.** Without a
  ceiling a run whose journal cannot be written spins for ever: every sweep
  redelivers it, every attempt fails the same way, and nothing says so.
- **A CRASH IS RETRYABLE UNTIL THE LAST PERMITTED ATTEMPT, THEN THE LOG IS CLOSED.**
  Both halves are driven, because a run nothing will ever deliver again must not read
  as one still going — and a transient crash must not be made final on the first try.
- **THE SWEEPER RE-RINGS RATHER THAN EXECUTING.** A cron tick is short and a run is
  not, so dropped work goes back through the queue and is claimed by a consumer with
  a whole invocation of its own.

### The queue is the backend's alone

`authenticated` gets **nothing** on `agent.run_work` — not even SELECT — because
everything a customer is shown about a run is derived from the log, which they can
already read. RLS is enabled and FORCED **with no policies at all**.

**THREE WALLS STAND BETWEEN A CUSTOMER AND A CLAIM, and the redundancy is declared
because a sweep cannot see it.** MEASURED by taking them away one at a time: the
FUNCTION grant refuses first (`permission denied for function claim_run`); with
EXECUTE widened, the TABLE grant refuses (`for table run_work`); with both widened,
forced RLS matches no rows and the claim answers `claimed: false` having taken
nothing. **Only with all three gone does a customer take the work.** So no single one
is load-bearing today — which is the point, and why the sweep mutates the three
together rather than one at a time.

**The advisors flag `agent.run_work` as `rls_enabled_no_policy` (INFO), and that is
the intended state**, not a finding to fix: there is no grant for a policy to
permit. Eighteen tables in this project are in the same state for the same reason.

## Fencing the journal (2026-09-15)

`supabase/migrations/20260915061219_agent_entry_fencing.sql`, and the code that speaks
to it. **The gap this closes was MEASURED on the live deployment, not imagined**, and
the measurement is in the deployment section below: a consumer whose lease was revoked
at 2 entries reached **4 model answers and 3 tool results** before it stopped, because
"do I still hold this run" was answered from a FLAG in its own process, refreshed at
most once every `BEAT_EVERY_MS` (30 s). The flag was correct about the world as of
thirty seconds ago.

### THE GAP WAS NEVER THE GRACE PERIOD

**`agent.claim_run` TAKES A LAPSED LEASE WITH NO GRACE AT ALL.** The grace belongs to
the sweeper, which is only ONE of the ways a run is offered again — a duplicate
delivery arriving a second after a lease lapses claims it immediately. So the window a
wider grace could cover is not the window that existed, and `SWEEP_GRACE_S` is
deliberately UNCHANGED by this work. Both proofs assert that out loud: the replacement
claims the run while `sweep_run_work(30)` still refuses to offer it.

**AND `attempts` IS NOT EVIDENCE OF EXCLUSIVITY EITHER.** It counts CLAIMS, so it is
evidence about the queue and says nothing about what a displaced holder went on to
write — which is exactly the thing that was wrong. The evidence here is refusals.

### The claim is a TOKEN, and a write presents it

`agent.run_work.claim_token` is a uuid minted by `claim_run` **per claim**, answered on
the same UPDATE that takes the row. `beat_run`, `release_run` and the new
`agent.append_entry` all require it, and the unfenced signatures of the first two are
DROPPED rather than left beside the new ones — an overload that does not ask for the
token is the bypass door this exists to close, and two overloads make a named-argument
call ambiguous as well.

**WHY A TOKEN AND NOT THE WORKER NAME.** A name says *who*; a token says *which claim*.
They come apart in the one case that matters — a run reclaimed by a worker of the SAME
NAME — and that case used to be a hole with a test asserting it: the old `beat_run` was
gated on `claimed_by` alone, so a displaced worker sharing the holder's name kept its
lease, "which is the whole problem" in that test's own words. It is now refused
`bad-token`, and the test records the fix instead of the hazard.

### `agent.append_entry` is the ONLY door into the log

One function, `SECURITY DEFINER`, `search_path` pinned empty, revoked from `public`. It
**LOCKS THE WORK ROW** (`for update` — the same row every claim and reclaim takes) and
checks the holder, the token, that the work is unfinished and that the lease is live,
**in the same transaction as the insert**. A check over PostgREST followed by an insert
would be two statements with a reclaim able to fit between them: the race, moved up a
layer. There are only two orderings and both are safe — whoever takes the row lock
first wins, and the loser reads what the winner left.

**AND THE DIRECT DOOR IS CLOSED, not merely unused.** `revoke insert on
agent.run_entries from service_role` — the role the Worker runs as. A runner that asked
PostgREST to insert a row is refused by a privilege rather than by our own good
intentions. `accept_run` became `SECURITY DEFINER` for the same reason: after the
revoke, it is one of only two things that can write an entry at all. **The limit,
stated: this is a GRANT, so the table's owner and any superuser can still insert
directly.** Nothing that runs in production is the owner.

### Nine answers, and two pairs that must never collapse

| answer | means |
|---|---|
| `stored` | the entry is in the log at this seq |
| `already` | **THIS EXACT entry** was already recorded — a retry, and safe |
| `conflict` | the same logical slot holds a **DIFFERENT** entry: somebody else wrote it |
| `position` | that seq is taken by something else; the caller's counter is behind |
| `no-work` · `finished` · `not-holder` · `bad-token` · `lease-expired` | this worker may not write |

- **`already` vs `conflict` IS THE PAIR THE WHOLE THING TURNS ON.** A network drop after
  Postgres committed leaves the caller unable to tell which side of the commit it died
  on, and killing a run over that throws away a model answer already paid for — so an
  IDENTICAL body is a success. A DIFFERENT body at the same logical position is two
  writers, which no retry can explain, and **reading the second as the first is how a
  double execution disappears from the record.** The bodies are COMPARED with `jsonb`
  equality, so key order and whitespace do not matter and values do.
- **THE COMPARISON IS EXACT BY CONSTRUCTION RATHER THAN BY LUCK.** A retry replays the
  same entry object and its JSON is byte-identical; a second worker's redo carries its
  own `at` and `ms` and cannot be.
- **`position` vs `conflict`** need opposite things done about them — move up and try
  again, versus stop and re-read the log — so they are separate answers. The logical
  slot is looked for BEFORE the position, which is what makes a `position` answer mean
  "this exact entry is not in the log" and the one retry safe.
- **A malformed entry RAISES** (`entry_kind_known`, `entry_position_matches_kind`) rather
  than becoming a tenth answer. It is a bug in the caller, not a state.

**⚠ AND `conflict` IS NEARLY UNREACHABLE ONCE THE FENCE IS IN PLACE, which is worth
knowing before trusting a test that produces one.** Two fenced writers cannot interleave
on one run: a holder is refused from the instant its lease LAPSES, not from the instant
somebody else claims, so a replacement's snapshot is always taken after the previous
holder was already walled off. What remains reachable is an entry written BEFORE the
fence existed, an entry re-sent with a modified body (a caller bug), and a `position`
collision whose other occupant is not this entry. So it is a wall for a state that should
not occur — kept because the ANSWER has to be precise either way, and because "already
recorded" is the one reading that must never cover it. **The tests reach it by handing
the store a scripted answer or by writing two different bodies as the same holder**,
which is honest about what is being proved: the READING, not an interleaving the fence
still permits.

### What changed above the database

- **`store.mjs` HAS NO DIRECT INSERT LEFT.** `appendEntry` is injected and REQUIRED — a
  store without it is refused rather than built, because one that could authorise, read
  and replay a run and then not record a thing about it would fail several steps later
  wearing a journal error's clothes.
- **A JOURNAL NEEDS BOTH THE OWNERSHIP CHECK AND THE CLAIM.** `open(runId, { hold })`
  requires the hold; `load(runId)` is the reader's door and cannot write. `create` hands
  back NO journal at all, because creating a run gives nobody a claim on it and a
  journal that always answers `no-work` is worse than none.
- **OWNERSHIP IS ASKED OF THE DATABASE BEFORE ANY NEW WORK.** `runAgent` gained a
  `checkpoint` seam, called before each model call and before each tool batch (including
  the ones a resume finishes). The runner's checkpoint is a BEAT — because "may I still
  work on this" and "I am still here" are the same fact about the same row, and two RPCs
  for one fact is two answers that can disagree.
- **A CHECKPOINT THAT REFUSES THROWS, AND THE THROW IS THE MECHANISM.** It escapes
  `runAgent` with no stop written, which leaves the run exactly as the next holder needs
  to find it. A `return` would need `run.mjs` to invent a stop reason, and writing a
  stop is the one thing a process that has lost the run must not do.
- **`conflict` IS ITS OWN OUTCOME and does NOT take the run off the queue.** The claim
  may still be ours; what is stale is our snapshot of the log. The next delivery reads
  what is really there, which terminates.
- **THE FIVE `CLAIM_GONE` REFUSALS ALL REPORT AS `lease-lost`, WITH THE REASON BESIDE
  THEM.** An outcome exists to tell a caller what to DO and the answer is identical for
  all five; what differs is what an operator should conclude, so the name rides in the
  delivery's `error` and in the event.

### ⚠ WHAT FENCING CANNOT DO, and it is the distinction the whole design rests on

**It stops the RECORD of an action, never the action.** A tool call already sent cannot
be recalled by a database. A stale worker that fired a payment and was then refused its
write leaves a model answer with no result — which is exactly a PENDING CALL — and if
that tool is not `repeatable`, `replay` reports it pending and the run refuses to resume
(`cannot-resume`) instead of firing it again. **That refusal is the guarantee; fencing
narrows the window in which the send can happen.** Neither replaces the other, and the
live verification checks them as two separate things.

**THE COST, STATED RATHER THAN GLOSSED.** A result a stale worker really did obtain is
now thrown away rather than recorded, so a run that would have completed can end up
waiting for a person. That is the safe direction — exclusivity over completion — and it
is the trade this change makes on purpose.

### Applied live, and verified by reading it back

**APPLIED 2026-09-15 to `ujrqdmmtcptvimazlhom`, recorded as remote version
`20260915061219`, and the file is named for that** rather than for when it was written.
Read back with `pg_get_functiondef` and compared by md5 against a LOCAL apply of the
repository's own migration files: **all five functions this change touches match byte
for byte** — `accept_run`, `append_entry`, `beat_run`, `claim_run`, `release_run` — so
what is live is what is in the tree.

No work row was claimed when it was applied, which was checked first: the whole-claim
constraint would otherwise refuse the ALTER, and the backfill covers the case anyway.

**THE ORDER MATTERS ON AN UPGRADE AND THE WINDOW IS LOUD.** The migration revokes
INSERT on `agent.run_entries`, and a Worker built before it writes entries with a direct
POST. Migration-then-deploy fails every write of an in-flight run; deploy-then-migration
answers `PGRST202` for a function that is not there yet. Either way the failure is loud
and the runs are left resumable — never silent. It was applied first, with nothing in
flight.

### ⚠ A PRE-EXISTING DIVERGENCE FOUND BY THAT COMPARISON, and it is not this change's

**TWO FUNCTIONS FROM THE FIRST MIGRATION DO NOT MATCH THE REPOSITORY, and the
difference is em dashes turned into `--`.** `agent.entries_go_with_their_run` and
`agent.run_delete_begins` were applied in an earlier session with every `—` replaced by
`--`. In `run_delete_begins` it is inside comments only. In `entries_go_with_their_run`
one of them is inside the RAISE message — so the live refusal reads "cannot be deleted
on its own -- delete the run and its log goes with it" where the repository says "…on
its own — delete the run…".

**It is cosmetic, and it is left alone deliberately**: nothing reads past the dash (the
database check matches on "cannot be deleted on its own"), and fixing it means another
migration on a shared project for a punctuation mark. Recorded because
`supabase/migrations/` IS NOT THE RECORD OF WHAT IS LIVE, and this is the first concrete
instance of that in this product. **Today's apply did NOT do it** — all five of its
functions match exactly, em dashes included, so the connector is not what mangles them.

### What the sweep found, and the shape is worth more than the fixes

**EIGHT MUTANTS SURVIVED THE FIRST PASS AND NOT ONE WAS THE PRODUCT'S.** The shape is
the recorded "two redundant defences cannot be killed one at a time", arriving six times
at once — because the fence made six process-level checks redundant in a single change.

**THREE WERE ACTED ON:**

- **ONE WAS DEAD CODE AND WAS DELETED, not declared.** The store had a branch raising a
  fenced refusal for the five `CLAIM_GONE` answers, and the line below it produced
  character for character the same error for every answer that is not `position`. It was
  the same wall written twice, so it went.
- **ONE MUTANT WAS BADLY WRITTEN AND SURVIVED FOR THE WRONG REASON**: it left `hold`
  undefined, so `journalFor`'s own check threw instead of the one being removed. A
  mutant that produces a FABRICATED hold reaches the journal and dies.
- **ONE WAS A REAL GAP AT THE WRONG LAYER.** An unrecognised append answer is raised by
  the store's closed vocabulary as well as by `work.mjs`, so the mutant at the lower
  layer survived until a test drove `work.append` directly. **The recorded "a guard
  proves the branch it drives, and no other."**

**FIVE ARE DECLARED INERT AND REMOVED FROM THE SPEC**, each with its declaration in
`runner.mjs` where the next reader will meet it: `assertHeld()`'s own throw, the same
call in the `send` wrapper, the same call in the `journal` wrapper, `mayStart`'s throw,
and `if (held)` before the release. **Two of the five stand in front of SQL, which the
JavaScript sweep cannot mutate** — `agent.append_entry` refuses the write and
`agent.release_run` refuses the release, and the SQL sweep kills those walls. **Reading
the two sweeps together is the only honest coverage claim for that pair.** What survives
as a JavaScript mutant is the one that removes the whole ownership check
(`checkpoint: undefined`), and it dies.

**AND ONE FIX DID NOT DO WHAT ITS COMMENT CLAIMED, which is worth more than the fix.**
The checkpoint test used a `send` that THROWS, which cannot tell "the work never
started" from "the work started and its stop write was refused" — both answer
`lease-lost`. It counts model calls now, which is a better test and STILL did not kill
the mutant: `assertHeld()` in the `send` wrapper stops the call before the counter can
move. The count is kept because it asserts the right property; the mutant is inert for a
different reason than the comment first said, and saying so is the point.

## The SQL mutation sweep (2026-09-15)

`npm run sweep:sql`. **The current count is in "Measured" at the end of this file, and
this line deliberately does not repeat it** — it said `20 mutants, 20 killed` for two
rounds after it had stopped being true, which is a number stamped in two places drifting
because only one was corrected. Focused on the guarantees the notes make loudest: tenant
isolation, duplicate prevention, journal immutability, whole-run deletion, and since
2026-09-15 the fence.

**IT WORKS BY DRIVING THE DATABASE CHECK.** `node --test` runs
`test/integration/pg-schema.mjs` as one test and propagates its exit code, so the
existing mutation runner needed nothing new. Every mutant creates a database and
applies the whole migration, which is the price of proving a guarantee against the
engine that enforces it.

**IT REFUSES TO RUN WITHOUT A CLUSTER.** The database check SKIPS and exits 0 where
there is none, which a runner would read as "every mutant survived" — a sweep that
tested nothing, reported in the most misleading way available. The cluster is
confirmed before a single mutant is written.

**EVERY MUTANT IS A CHANGE A CARELESS EDIT COULD REALLY MAKE** — a policy loosened,
a `unique` dropped, a raise turned into a return, a marker widened. A migration
that will not apply proves nothing.

### The fence round's sweep is COMPLETE, and one lesson came from stopping it

**64 mutants, 64 killed, 0 survived, 0 never applied, 3 comment-only controls survived**
— the pass that confirms the four fixes below really do catch their breakages, taken
after the run rather than predicted before it. The spec holds 67 entries, which is those
64 plus the three controls; the tally counts controls apart from mutants deliberately, so
the two numbers never have to be reconciled by arithmetic.

**THE MIGRATION FILES ARE PROVED RESTORED AGAINST GIT, NOT BY EYE.** `git diff HEAD --
supabase/migrations/` is empty and all 67 anchors occur exactly once. **And a census of
my own was a false alarm worth recording**: checking that no mutant's REPLACEMENT text
survives in the tree flagged 8 of them, and all 8 were the check's fault — the
replacement text also occurs in the committed file, so the needle could not tell a landed
mutant from ordinary source. *A needle that can match the original cannot prove the
original was restored.* Git can.

**⚠ AND THE INTERRUPTION LEFT A LIVE MUTANT IN THE TREE, exactly as this repository's
root notes say it would.** An earlier pass was killed mid-run to make a commit, and
`entries_one_tool_per_slot` was still dropped from the migration when it died: a killed
sweep skips its `finally`. It was caught by the spec generator's own anchor census on the
next run (`ANCHOR NOT FOUND`) rather than by anything looking for it, and restored from
git. **The rule is not "be careful" — it is that the pre-check which refuses an ambiguous
anchor also happens to be the only thing that notices a tree the previous run corrupted,
so it must run before every pass and its failure must never be waved through.**

### What the version-identity round found — FIVE SURVIVORS, ALL IN GUARDS WRITTEN MINUTES EARLIER

Every one of the five was a guard I had just written for the deploy chain, and **each is
a trap already recorded in this repository**, which is the finding worth more than the
fixes: a guard written in the same sitting as the change it guards inherits the author's
own blind spots, and the sweep is the only thing that reads it adversarially.

- **A SUBSTRING MATCH ON AN IDENTIFIER.** `/id: serving/` is satisfied by
  `id: serving_`, so a mutant renaming the step — which breaks every
  `steps.serving.outputs.version` reader — survived. *A needle that can match a longer
  name cannot prove a class.* The id is matched to END OF LINE now and, better,
  **DERIVED**: the guard reads whatever id the minting step declares and asserts the
  readers name THAT one, so a rename either reaches both sides or fails.
- **A LOOP OF ONE IS NOT A LOOP.** `/for i in \$\(seq 1 \d+\)/` accepted
  `seq 1 1` — the exact defect the loop exists to prevent, wearing a loop's shape. The
  guard reads the bound AND the sleep and requires their PRODUCT to be at least three
  minutes, because what has to outlast propagation is the window, not the iteration
  count.
- **A MUTANT THAT WAS INERT BY CONSTRUCTION: renaming a workflow step.** `name` is a
  display string; `if` decides whether a step runs. So the mutant changed nothing
  observable and its survival said nothing about coverage. Replaced by one that gates the
  step OFF — and the guard now asserts the minting step's condition is EXACTLY the deploy
  step's, taken from the deploy step rather than written out, so the two cannot drift.
- **TWO MUTANTS PROVED THE DIFFERENCE BETWEEN READING AN INSTRUMENT AND RUNNING IT.**
  Replacing a check's condition with `true` survived every source read, because the words
  were all still there — and in one case the guard's needle found the comparison in the
  check's own MESSAGE, three lines below the condition it had been deleted from. **Two
  copies of one thing, in the space of three lines.** Fixed twice over: the comparison is
  written ONCE (`versionOk`), and `test/deploy-workflow.test.mjs` now **DRIVES
  `verify-live.mjs`** against a stub that answers `/health` — matching version, wrong
  version, cacheable answer, and no expectation at all — asserting the `ok`/`FAIL` line
  each produces. The matching case is the positive control, without which a check wired
  to always fail would satisfy every negative case.

**AND THE SPOT-CHECK IS PART OF THE METHOD NOW, not a shortcut.** The seven changed
mutants were applied one at a time against the two test files that can see them before
the full pass was spent — replacing through a FUNCTION and verifying the LANDED text is
the written text, because `String.prototype.replace` reads `$'` in a replacement and this
repository has already had a mutant that "applied" by checksum and was not the one
written. A narrow list can only produce a false SURVIVOR, never a false kill, so the
full pass still decides.

### What the fence round found (2026-09-15)

**FOUR MUTANTS SURVIVED THE FIRST PASS AND EVERY ONE WAS THIS FILE'S FAULT, not the
schema's.** Two were plain coverage gaps, one was a check that REPAIRED the thing it was
testing, and one was a property no sequential harness could observe at all.

- **A CHECK THAT PUT THE STATE BACK FOR THE MUTANT IT WAS TESTING.** The
  before/after demonstration grants INSERT on `agent.run_entries` and revokes it again as
  the owner — so deleting `revoke insert … from service_role` from the MIGRATION changed
  nothing this file could see: the file re-established the state itself. **A check that
  repairs what it is testing proves nothing about whatever was supposed to have done it.**
  The migration's own revoke is now asserted FIRST, through `has_table_privilege`, before
  anything here touches a grant.
- **A CHECK ASKED IN THE ONE STATE THAT CANNOT TEST IT.** `release_run` gained
  `and lease_expires_at > now()` so a lapsed holder cannot end a run mid-flight — and
  removing it survived, because the only release-refusal check ran AFTER a replacement
  had taken the row, where `claimed_by` refuses first and the lease condition is never
  reached. It is now asked while the holder's name and token are BOTH still current,
  which is the only state that exercises it. **The recorded "a refusal from the wrong
  gate looks exactly like the wall working."**
- **A BLANK WORKER HAD NO CHECK AT ALL** on the append: with the raise removed it
  becomes the answer `not-holder`, which is plausible enough to pass unnoticed.
- **AND THE ONE THAT MATTERS MOST: `for update` COULD NOT BE OBSERVED, because every
  check in this file is a SEQUENTIAL `psql` process and a lock only means anything under
  concurrency.** Removing it is not an inert mutant — it is the atomicity argument
  itself. So the harness gained `holdRowLock`: a second session takes the row lock and
  sleeps holding it, and a fenced write is run with `lock_timeout` so that WAITING
  becomes an observable refusal. **It waits for the lock to be VISIBLE in `pg_locks`
  rather than guessing with a pause** — a fixed sleep would be flaky in the direction
  that reports the product as broken — and the control is the same write once the row is
  free, which is what makes the refusal about the lock rather than about the write.

- **A POSITION IS NOT AN IDENTITY — the same trap, a second time, one layer over.** The
  fence migration REDEFINES `claim_run`, `accept_run`, `beat_run` and `release_run`, so
  thirteen mutants aimed at the queue migration's copies of them became **INERT BY
  CONSTRUCTION the moment it landed**: mutating dead code, arriving through migration
  order. The spec already had `lastDefining(needle)` for exactly this, from the round
  before — it just had not been applied per FUNCTION. `mFn(name)` asks the files which
  migration last defines each one, so it cannot go stale, and an anchor pointing at a
  superseded copy fails the pre-check rather than surviving the run.
- **AN ANCHOR CAN BE A SUBSTRING OF ITS OWN NEIGHBOUR THROUGH INDENTATION.**
  `append_entry`'s `position` answer appears twice — the main path at four spaces, the
  unique-violation handler at six — and `"    return …"` is contained in
  `"      return …"`. The anchor carries a leading newline now, which pins the indent.
  The pre-check caught it as AMBIGUOUS; without the newline the mutant would have landed
  in whichever occurrence came first.
- **AND A DELIBERATE REDUNDANCY IN SQL NEEDED THE SAME TREATMENT AS ONE IN JAVASCRIPT.**
  The `already` answer is produced in both the main path and the handler; the mutant for
  it names the `conflict` line after it, so it is unmistakably the main path's.

### What the queue round found (2026-09-15)

- **A REAL TEST GAP: A LONG HEALTHY RUN WAS NOT PROTECTED BY ANY CHECK.** The mutant
  that makes the sweeper select on ELAPSED TIME instead of on the lease SURVIVED —
  every hand-written check passed with it in place, because none of them had a run
  that was **both old and alive**. The product was right; the coverage was not. The
  check now ages a claimed run by two hours with a live lease and requires it to be
  neither swept nor claimable, with the same row swept once its lease lapses as the
  control.
- **A REFUSAL FROM THE WRONG GATE, wearing the right words.** "A customer may call
  the claim function" also survived, and measurement explained it: the function is
  SECURITY INVOKER, so with EXECUTE widened the UPDATE inside meets the TABLE grant
  and says `permission denied` too. The check asked only for those two words. **It
  names the object now** (`permission denied for function claim_run`), which is the
  difference between a wall and a coincidence.
- **AND THAT TURNED OUT TO BE THREE WALLS, MEASURED IN ORDER**: the function grant,
  then the table grant, then forced RLS with no policies (which answers
  `claimed: false` having taken nothing). **Only with all three gone does a customer
  claim work** — so the mutant is now the three together, and it dies.

### What the first round found, which is the whole point

- **A REAL HOLE: THE DELETE MARKER WAS TRANSACTION-WIDE, NOT RUN-SPECIFIC.** It
  said only "some run is being deleted in this transaction", so deleting ANY run
  authorised deleting the entries of ANY OTHER one. Measured: two deletes in one
  `psql -c` share a transaction and the second was allowed. The exposure was narrow
  — no role holds DELETE on the entries — but the claim was "an entry may go only
  with ITS OWN run", and that claim was false. The marker names the run now, and
  APPENDS, because a multi-row delete fires the trigger once per row and the
  cascades all run afterwards.
- **A HAND-WRITTEN CHECK THAT COULD NOT SEE ITS OWN SUBJECT.** Every check runs in
  its own `psql` PROCESS, so anything at SESSION scope was invisible to all of
  them. `psqlSession` runs several statements down ONE connection in separate
  transactions, which is the only shape that separates session scope from
  transaction scope.
- **AN INERT MUTANT, PROVED RATHER THAN HUNTED.** Removing the tenant comparison
  from the ENTRIES policy changed nothing: `agent.runs` is itself under RLS, so the
  policy's subquery is already filtered to this tenant by the runs policy. That
  comparison is a deliberate SECOND WALL and is now declared as such in the
  migration, because a sweep cannot see a deliberate redundancy and the next reader
  deletes what nothing appears to need.
- **A SECOND INERT ONE, AND THE MECHANISM IS NOT ESTABLISHED.** Flipping
  `set_config`'s `is_local` to session scope changed nothing — checked three ways,
  including re-creating a run under the same id in a later transaction of the same
  session. A plain function doing the same `set_config` DOES leak, so the
  difference is something about being called from a trigger. **The behaviour is
  measured; the reason is not known**, and the flag stays because it says what is
  meant and costs nothing.

### ⚠ A correction to an earlier claim

**`force row level security` IS NOT VERIFIED, and the notes previously implied it
was.** It is only observable to a table OWNER who is not a superuser, and the
harness's owner IS one — a superuser bypasses row level security whatever FORCE
says. So that line's effect is unverifiable here, it is deliberately NOT mutated
(the mutant would survive for a reason that has nothing to do with the schema),
and the claim "the owner is not quietly exempt" stands as untested.

## Wired to the live project (2026-09-15)

### The schema is exposed, and the other product still works

**`agent` IS EXPOSED TO POSTGREST**, set as an in-database PostgREST override:
`alter role authenticator set pgrst.db_schemas = 'public, graphql_public, agent'`,
then `notify pgrst, 'reload config'` AND `notify pgrst, 'reload schema'` — **two
separate signals**, and the first alone leaves the tables invisible with a
`PGRST205` that reads like a missing table.

- **THE EXISTING LIST WAS READ FROM POSTGREST ITSELF, not assumed.** Asking for an
  unexposed schema answers `PGRST106` naming every schema that IS exposed, which
  made the before-state authoritative: `public, graphql_public`. The new value is
  those two plus `agent` and nothing else.
- **`SET` ON THE ROLE IS ADDITIVE.** `authenticator` already carried
  `statement_timeout`, `lock_timeout` and `session_preload_libraries`; all three
  survived, which was checked.
- **REVERSING IT** is `alter role authenticator reset pgrst.db_schemas;` plus the
  two reloads.
- **IT IS A DATABASE SETTING, NOT THE DASHBOARD ONE.** If the dashboard's exposed
  schemas are ever edited, this override may still win — so anybody confused by
  that should look here first.
- **VERIFIED IMMEDIATELY AFTER: the other product's API still answers 200** on
  `site_builds` and `site_project`. That was the whole risk of this change and it
  was checked rather than hoped.

### The tenant falls back to the signed-in subject

**SUPABASE DOES NOT PUT A `tenant_id` CLAIM IN A JWT.** Keying only on it meant
every policy was correct and unsatisfiable: a genuinely signed-in customer matched
no rows, for ever. Migration `20260915022217` makes an explicit `tenant_id` win and
the subject (`sub`) the fallback, so each signed-in user is their own tenant —
the conventional Supabase shape, needing no token hook.

- **IT IS A WIDENING, said out loud.** Before, nothing a customer could present
  matched anything. After, a customer matches rows whose tenant is their own uid.
- **`TENANT_CLAIMS` IN `auth.mjs` IS THE SAME LIST IN THE SAME ORDER**, and the
  drift guard now checks BOTH names AND their order in the migration. **The first
  version of that guard checked only that `tenant_id` appeared and stayed green
  while the two sides disagreed about exactly this fallback.**
- **A MALFORMED EXPLICIT TENANT DOES NOT FALL THROUGH TO THE SUBJECT.** Falling
  through would turn a broken claim into a DIFFERENT tenant, which is the worst
  available reading of a malformed value.

### ⚠ What found that, and the lesson

**The divergence was found by driving the real handler against the real project,
NOT by 159 passing tests** — because every token those tests mint carries a
`tenant_id`, which made the fixture more capable than reality. The unit suite, the
SQL sweep and 70 database checks all passed while no real customer could have used
the thing. **A fixture that is more capable than reality is the one trap that
cannot be caught by adding more of the same fixture.**

### Verified through the real Supabase HTTP API

As a genuinely signed-in customer (a real user, a real project-signed JWT):

- **reads exactly their own run and their own entries;**
- **the other customer's run by id, and their entries by run id, both read `[]`** —
  invisible rather than refused;
- **every write is 403**: POST an entry, POST a run, PATCH a run, DELETE a run,
  DELETE an entry. Nothing changed.
- **anon is walled at the SCHEMA level** (`permission denied for schema agent`) for
  both read and write, because `usage` was never granted to it.

**THE BACKEND'S OWN WRITES ARE VERIFIED AT THE DATABASE LEVEL AS `service_role`,
NOT OVER HTTP.** PostgREST needs a service-role JWT to authenticate as that role
and this session has no way to obtain one — the Supabase MCP exposes publishable
keys only. Stated as a gap rather than glossed.

## The Worker

- **`src/worker.mjs` IS THE ONLY FILE THAT KNOWS IT IS CLOUDFLARE.** Everything
  below takes its dependencies as arguments, so this is where the real ones are
  chosen.
- **CONFIGURATION IS CHECKED FIRST AND A GAP IS A NAMED 503**, never a throw: an
  uncaught throw is answered by Cloudflare in HTML and a caller doing `.json()`
  learns nothing. It names the missing settings and never a value.
- **AN UNRECOGNISED MODEL IS REFUSED, NOT DEFAULTED.** Falling back to the stand-in
  would mean a deployment that believes it is talking to a provider and is quietly
  answering from a canned script.
- **THE SCHEMA IS PASSED EXPLICITLY** even though the store defaults to it, because
  a default is what silently keeps working while meaning something else.
- **THREE HANDLERS, AND THEY ARE THREE DIFFERENT JOBS.** `fetch` accepts work and
  answers 202 and runs NOTHING; `queue` claims a delivery and executes the run;
  `scheduled` offers dropped work again.
- **PRODUCING AND CONSUMING NEED DIFFERENT CONFIGURATION, and being precise about
  that is not pedantry.** Accepting work needs somewhere to ring, so `fetch` requires
  the `RUN_QUEUE` binding; the CONSUMER never produces, so it requires only the
  project. `scheduled` DOES produce, so it asks for the full deployment. A caller
  that hands in its own `notify` is a producer with no binding, which is what every
  local driver is.
- **THE QUEUE BINDING IS A REQUIRED SETTING and `waitUntil` is not a fallback**, so a
  missing one is the same named 503 as a missing secret. A deployment that believes
  it is durable and is not is the one failure worth refusing to boot over. An inert
  binding (a name bound to something without `.send`) counts as missing.
- **`wrangler.jsonc` HERE IS THIS DIRECTORY'S OWN AND CANNOT SHIP BY ACCIDENT.**
  The repository's deploy runs `wrangler deploy` at the ROOT against the root
  config and never reads this one; deploying is a deliberate
  `wrangler deploy -c agent-builder/wrangler.jsonc`, **and it has not been run.**
  The secrets are `wrangler secret put`, never vars, never committed —
  `docs/deploy.md` has the exact names and order.
- **THE CONFIG AND THE CODE CANNOT DISAGREE ABOUT THE QUEUE.** A test reads
  `wrangler.jsonc` and compares its producer binding against the Worker's exported
  `QUEUE_BINDING`, checks the consumer is attached to the producer's queue, pins
  `max_batch_size: 1`, and requires the sweep cron to run oftener than the lease
  lasts — derived from `LEASE_TTL_S`, not eyeballed. **Two copies of a binding name
  is the commonest way a deployment is wired to nothing.**
- **`max_batch_size: 1`, ON PURPOSE.** A batch is handled inside ONE invocation, so
  two long runs in one batch would serialise and the second could be cut off before
  it ever started. One per invocation, and Cloudflare scales invocations instead.
- **A LONG RUN IS NOT ONE LONG INVOCATION — IT IS SEVERAL.** A consumer invocation
  has its own wall-clock ceiling, and the answer is not a bigger ceiling: a run cut
  off mid-invocation loses its lease, the cron offers it again, and the next consumer
  continues FROM THE LOG. That is why the journal and `repeatable` exist. **Not
  measured against a real invocation ceiling — the longest run driven end to end is
  65.6 seconds.**
- **`npm run serve` DRIVES ALL THREE HANDLERS OVER REAL HTTP**, importing
  `src/worker.mjs` rather than reimplementing it. **What it substitutes is the
  transport and only the transport**: Cloudflare Queues is not reachable from a
  laptop, so the binding is an in-process doorbell that hands the run id to
  `worker.queue` and returns first. Durability is unchanged, because the work is a
  ROW — and the sweeper runs on a timer there too, exactly as the cron does.
  Settings come from the environment; the banner prints each one's LENGTH and never
  its value.

### The stand-in

`makeStandIn` answers a tool call, then an answer — so a driven run exercises a
step, a tool, a second step and a stop rather than the shortest path. It reports
usage and cost the way a provider does, so the meters and the budget are exercised
rather than bypassed. **It is not a mock of a provider's wire format**: `send` is
the translator in this design, so the stand-in and a real provider are two
implementations of one one-function contract.

**IT CHOOSES WHAT TO DO FROM THE TOOLS IT IS OFFERED, which is the one thing that
makes it model-like rather than scripted.** One `send` serves every agent in the
registry, because that is how a deployment really works: one model, several agents,
a different tool list each time. A stand-in configured per agent would be a second
registry. Offered the `wait` tool it runs the long shape; otherwise the short one.

**`SLOW_ROUNDS` 8 × `SLOW_STEP_MS` 8,000 = 64,000 ms, and `SLOW_TOTAL_MS` is
derived.** Several rounds rather than one long sleep, deliberately: each round
writes a model entry and a tool result, so PROGRESS accumulates in the log and a
reader can watch it move. One sixty-second sleep would be a minute of silence
followed by an answer, which demonstrates nothing about progress.

## Deploying it, and verifying the deployment (2026-09-15)

`wrangler.jsonc`, `scripts/deploy.sh`, `scripts/verify-live.mjs`,
`scripts/verify-local.mjs`, `docs/deploy.md`. **Nothing is deployed yet** — there is
no wrangler and no Cloudflare credential in the session that wrote this, so what
exists is everything up to the two commands somebody has to run.

### ✅ DEPLOYED AND VERIFIED LIVE (2026-09-15, Actions run 6 — the current deployment)

**`https://agent-builder-api.aniascapital.workers.dev`**, version
**`47e5e88a-6f1e-4f76-ad61-615eaf2f9b91`** (`deployedAt 2026-09-15T07:26:19.985979Z`),
model `stand-in`, commit `3344755`. Actions run **34941653115**, green in 6m55s;
**71 passed, 0 failed** — 69 before, plus the version assertion and the caching check.

| check | run | observed |
|---|---|---|
| the long task | `a833bdf5-4e14-4e52-8b5b-f1434bbfbb7e` | 202 in 1,103 ms, **74.4 s of work after it**, progress at ten points, **9 model / 8 tool, attempts 1** |
| one execution | `8ab9e35e-c0a4-4985-ba50-ff1fcd0135b4` | two simultaneous mid-run resumes both `already-running`, the holder's lease untouched, a direct second claim `{"claimed":false}`, **9 model for 9 steps, attempts 1** |
| the handover | `dcb63fab-55b2-4ccc-8f43-98ea49609582` | lease revoked at 2 steps, a different consumer took over **after 32 s**, steps 2→9 never backwards, **9 model for 9 steps, 8 tool, ATTEMPTS EXACTLY 2** |
| the blocked action | `6374bbcf-3de0-4cb6-b35b-a9d2e233884f` | **1 model, 0 tool** — the in-flight `commit` never written, no stop, pending call visible, a resume changed nothing |
| the fence | `f2b67cba-26e4-4cb0-a553-c522c7e93dd3` | direct insert **403 `42501`**; identical retry `already`; different body `conflict`; paused holder `lease-expired`; sweeper offered **0 rows** while a duplicate delivery claimed it; old consumer `not-holder`, replacement `stored`; same-name reclaim `bad-token`; finished work `finished`; probe run deleted 204 |

**THE BLOCKED-ACTION ROW IS THE FENCE'S BEFORE/AFTER.** The same check on the pre-fence
deployment (`4d3c4d0d…`, version `2dfb8be6…`) reached **4 model / 3 tool, step 4** — 32
seconds of work after its lease was revoked. Post-fence it is **1 model / 0 tool, step
1**, twice over (`1ec246d9…` on `64ac3bb4…`, `6374bbcf…` here). Both still end
`status: running` with the pending call visible, which is the `cannot-resume` refusal
working throughout — what went is the displaced consumer's extra work.

The throwaway customer was deleted and the `if: always()` cleanup reported
`13 users listed, 0 left by a verification`.

### ✅ The deployment before it (2026-09-15, Actions run 2)

**`https://agent-builder-api.aniascapital.workers.dev`**, version
`2dfb8be6-3bf1-400d-91dc-ee5990081ffd`, model `stand-in`, on the hosted project.
Actions run **34931112854**, green; **52 checks, 0 failed** — and every run below is a
row in `agent.runs` on `ujrqdmmtcptvimazlhom`, read back afterwards rather than taken
from the log.

| run | id | observed |
|---|---|---|
| the long task | `8f7d4d7f-d62a-4e13-aafb-3304026bce01` | 202 in well under a second, **72.9 s of work after it**, progress readable at 10 points (`0@666ms … 9@72937ms`), answer retrievable. **9 model / 8 tool entries, attempts 1** |
| one execution | `fca9851c-c139-4543-826c-f02e7a9872e7` | two SIMULTANEOUS resumes mid-run both answered `already-running`; the holder's lease untouched; a direct second `claim_run` answered `{"claimed":false}`. **9 model for 9 steps, attempts 1** — the two resumes cost no extra attempt at all |
| the handover | `1946e28b-0d58-40ed-8c1b-e9b66a630863` | lease revoked at 2 steps; **a different consumer took it over after 69 s** (`w-ee9f4a87…` → `w-6072b92f…`); steps went 2 → 4 → 9, never backwards. **9 model for 9 steps, 8 tool, ATTEMPTS EXACTLY 2** — one original, one replacement |
| the blocked action | `4d3c4d0d-e553-426f-b110-74e76b25e5a7` | **4 model, 3 tool** — one answer more than results, so the in-flight `commit` was never recorded. No stop written, status still `running`, pending `[{step:4,name:"commit"}]` visible, `problems` empty. A resume changed nothing: still 3 tool results 90 s later |

**`attempts` IS THE CLEANEST EVIDENCE IN THE WHOLE RUN.** 1 where one consumer did the
work, 1 where two people pressed resume mid-run, and exactly 2 where a consumer was
replaced. A duplicate execution cannot hide from that column.

**⚠ TWO HONEST READINGS OF THE SAME RUN, because the log says more than the checks
asked.** The guarded run's lease was revoked with **2 entries written** and the run
reached **4 model / 3 tool** before its consumer stopped:

- **THE ONE-BEAT WINDOW IS REAL AND WAS OBSERVED.** A worker learns its lease is gone
  at its next beat, so for up to `BEAT_EVERY_MS` it keeps working and its writes
  succeed — the database has no idea the lease lapsed. That is exactly what the
  runner's own note says, and this is the first time it has been seen rather than
  reasoned about. **Nothing was lost by it**: the writes were the run's own next
  steps, and the moment the beat caught up, the in-flight result was refused.
- **AND THE GRACE IS WHAT KEPT IT SAFE — AT ITS TIGHTEST.** `SWEEP_GRACE_S` (30 s) is
  `>= BEAT_EVERY_MS` (30,000 ms) **with equality**, so in the worst case the holder
  notices at the same instant the sweeper becomes willing to hand the run on. Here the
  cron's own minute added the real slack and there was no overlap — the original
  stopped by ~05:07:48 and the replacement claimed at ~05:08:24. **A margin would be
  better than equality**, and that is a change to make deliberately and re-verify,
  not one to slip in after a green run.

The throwaway customer (`0c8d3504-eb8c-447f-b734-33dd5cc071a4`) was deleted, and the
`if: always()` cleanup then reported `13 users listed, 0 left by a verification`.

### It deploys through GitHub Actions, on a push to this branch only

**`.github/workflows/agent-deploy.yml` IS THE ONE FILE THIS PRODUCT HAS OUTSIDE
`agent-builder/`**, added with the owner's explicit permission (2026-09-15). Actions
injects the three credentials it needs — `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_SERVICE_KEY`, all already repository secrets
because `deploy.yml` uses the same ones — so **no value is ever pasted anywhere.**

- **A PUSH TRIGGER IS THE ONLY DOOR, and that is not a preference.** A
  dispatch-only workflow can only be started once the file is on the DEFAULT branch,
  and main is to stay untouched; and `POST /actions/workflows/<file>/dispatches`
  answers **403 Resource not accessible by integration** from a session anyway, which
  `answer-read.yml` already records so nobody re-tries it.
- **⚠ THE BRANCH FILTER MUST STAY INLINE — `branches: [claude/…]`.**
  `test/merge-triggers.test.mjs` reads it with a regex and has no YAML parser, so a
  BLOCK list parses as no filter at all, which means every branch including main. A
  correct-looking reformat would fail the census, and if it ever passed it would put
  this on the merge. **This is the trap that would have been found by the census
  rather than by review, which is the census working.**
- **ORDINARY PUSHES RUN THE CHECKS AND DEPLOY NOTHING.** The tip commit's message has
  to carry an opt-in marker, spelled in the workflow that reads it and in
  `docs/deploy.md` and **nowhere else** — this product's sister rule is recorded twice
  over, because the gate reads the message with no idea it is being quoted, so a
  commit explaining the marker arms itself.
- **THE MESSAGE GOES THROUGH `env`, NEVER INTO THE SCRIPT BODY.** A commit message is
  attacker-controlled text; interpolated straight into `run:` it is a shell injection
  with a runner's credentials behind it.
- **THE RUN STOPS AT THE FIRST THING IT CANNOT CONFIRM.** Credentials by LENGTH and
  never by value, then `wrangler whoami` — a secret that exists and has expired looks
  exactly like one that works right up to the deploy. The queue's verdict **FAILS the
  run** rather than being printed and passed over. Only
  `agent-builder/wrangler.jsonc` is ever named, so nothing can resolve the root
  product's config by accident, and only `SUPABASE_SERVICE_KEY` is uploaded.
- **A THROWAWAY CUSTOMER, AND NO MAIL.** The verification creates a confirmed user
  through the admin API (`email_confirm: true`) so that "a real customer signs in" is
  a real sign-in — an earlier round spent one of the project's 200 daily sends signing
  up the ordinary way. `scripts/verify-cleanup.mjs` removes it on an `if: always()`
  step, and matches on BOTH halves of the throwaway name so a real customer can never
  be in scope.
- **TWO THINGS THE SHELL WOULD HAVE SWALLOWED**, both found before the first push:
  **backticks inside a double-quoted `echo` are command substitution in bash**, and
  the two inline `node -e` config readers were RUN rather than eyeballed.

### One secret, and the ordering is not a preference

- **THE NON-SENSITIVE SETTINGS ARE COMMITTED, DELIBERATELY.** `SUPABASE_URL` and
  `SUPABASE_PUBLISHABLE_KEY` are `vars` in `wrangler.jsonc`: a project URL is public
  and a publishable key is designed to be handed to browsers. So the deployment needs
  exactly ONE `wrangler secret put SUPABASE_SERVICE_KEY`.
- **`SENSITIVE` IS THE LIST AND THE GUARD IS DERIVED FROM IT.** A test asserts no name
  on it is ever a var in the committed config, that every name on it is a setting this
  Worker really reads, and that every setting NOT on it *is* configured — so a deploy
  from that file cannot be quietly half-configured, which at runtime is the same 503
  as a missing secret.
- **⚠ THE SECRET GOES IN BEFORE THE FIRST DEPLOY, and that is this repository's own
  recorded fact rather than a guess.** On this account a standalone `wrangler secret
  put` AFTER a deploy fails with "the latest version of your Worker isn't currently
  deployed" (Cloudflare's versioned-deployments guard) — which is why the root
  product uploads its secrets INSIDE the deploy step, recorded in its own
  `deploy.yml`. So: secret first (wrangler offers to create the Worker — say yes),
  then `./scripts/deploy.sh`.
- **THE QUEUE VERDICT IS PRINTED, NOT SWALLOWED.** `queues create` fails when the
  queue already exists, so it needs `|| true` — and a token WITHOUT the Queues edit
  permission fails identically from a silent `|| true`, surfacing later as a Worker
  answering 503 for a binding nobody created. Reused from the root product's own
  lesson rather than re-learned.
- The script runs the tests first and pins `wrangler@4.107.0`, the same CLI the rest
  of the repository deploys with — a different one is a second variable nobody wants
  when something goes wrong.

### `GET /health`, the one unauthenticated route

It exists because **a deployment cannot be verified if nothing can be asked which
version answered**, and `deployments list` says what was UPLOADED, not what is
serving. It answers the version from Cloudflare's own `version_metadata` binding, the
model, the schema, the agent list, and whether it is configured BY NAME — which is
exactly what the 503 already tells any caller, so it adds nothing a stranger could not
learn with one request. **Never a setting's value, a tenant, a run or a count**, and
it is answered BEFORE the configuration check, because an unconfigured deployment is
when the question is asked most.

**IT REPORTS THE MODEL AS CONFIGURED AND WHETHER THIS WORKER CAN RUN IT, as two
fields.** A deployment whose `MODEL` names something unknown answers 503 on every
request while every setting is present — so `ok` folds in `modelKnown`, and the model
is echoed rather than defaulted. **A sweep found that**: with the model hardcoded to
the default, nothing could see the difference.

### ✅ THE FENCE, MEASURED ON THE DEPLOYMENT: THE SAME CHECK, THE SAME AGENT, TWO DEPLOYS

Read out of `agent.run_entries` on the live project rather than out of a log, so it is
the rows a visitor's run would have left:

| | deploy | run | what the displaced consumer wrote |
|---|---|---|---|
| **before** | `2dfb8be6…` | `4d3c4d0d-e553-426f-b110-74e76b25e5a7` | **8 entries — 4 model, 3 tool, step 4**, written 05:07:08→05:07:40Z: **32 seconds and three whole steps AFTER its lease was revoked** |
| **after** | `64ac3bb4…` | `1ec246d9-77d2-4d98-ba68-c553b7e7db02` | **2 entries — 1 model, 0 tool, step 1**, written 06:51:48→06:51:56Z: it stopped at the first checkpoint |

Same agent (`guarded`), same check, same revocation. Both runs end `status: running` with
no stop and a pending tool call, which is the `cannot-resume` refusal working in both —
**what changed is the three model answers and three tool results the old consumer used to
add to a run it no longer held.**

**AND THE DEPLOYED WORKER IS PROVABLY ON THE FENCED PATH, from a privilege rather than
from a version string.** `service_role` has **no INSERT on `agent.run_entries`**
(`has_table_privilege` → false, live), and the three `slow` runs of that same deployment
each hold **19 entries (9 model, 8 tool)** written between 06:45:11Z and 06:51:47Z. Rows
that exist in a table the caller cannot insert into can only have arrived through
`agent.append_entry`, which is `security definer`. **Only the two functions that write the
journal are DEFINER** — `append_entry` and `accept_run`; `claim_run`, `beat_run`,
`release_run`, `requeue_run` and `sweep_run_work` are `security invoker` deliberately,
because they touch `run_work`, which `service_role` reaches directly. There is exactly
ONE `append_entry` and **no token-less overload of `beat_run` or `release_run` survives**,
so nothing can reach the old unfenced signature. `run_work.claim_token` exists, and it is
`null` on every finished row because `release_run` clears it.

### ✅ MERGED INTO MAIN (2026-09-15, `bd6bf98`), AND IT ROLLED NOTHING — MEASURED

**ADDITIVE BY CONSTRUCTION: 52 paths, all adds.** `git diff --name-status` from main's tip
over the merged tree answered `52 A` and nothing else — no M, no D, no R — so no file of
the site builder's was modified, moved or removed. The two sides changed **zero files in
common** although 29 commits landed on main while this branch ran. First parent is main,
so the push was a fast-forward: no rewrite, no force.

**WHAT THE MERGE'S OWN DEPLOY DID, read out of deploy run 2122's log rather than
predicted** — and deploy 2119 (the site builder's own, three hours earlier) is the control
that makes each line mean something:

| | 2119 (theirs) | 2122 (the merge) |
|---|---|---|
| image | `built … (registry answered 404; 180 inputs)` | **`reused …:6246eb17cd6595c4` (200; 182 inputs)** |
| container | `EDIT …` + `SUCCESS Modified application` | **`no changes` · `No changes to be made`** |
| assets | `1 new or modified … + /chat.js` | **`No updated asset files to upload`** |
| wall clock | 2m51s | **45s** |

So the container did **not** roll and the 15–20 minute hold did not apply — which is the
prediction the Dockerfile's COPY list makes (explicit paths, no whole-context copy, so
`agent-builder/` is not an image input) confirmed by the registry answering 200 to the
unchanged tag. `deploy drain: no live leases after 1s` — nothing was in flight. Every
binding came back (queue, R2, both KV, the dispatch namespace, the container), and
`gofarther.dev` answered 200 afterwards.

**THE CHECK THAT HAD TO BE RUN, and what it is worth saying about it**: the site builder's
whole suite on the MERGED tree — **6,476 tests, 6,474 pass, 0 fail, 2 skipped** — with
`ok 2539` on the guard that was red before the shell fix and `ok 1693` on the census. That
run is the only place a cross-product guard can fire, and it is what caught the `tee`
defect above.

**⚠ AND THE SAME TRAP IS LIVE ONE PRODUCT OVER, pre-existing and NOT this merge's.**
Deploy 2122's own log carries `QUEUE NOT CONFIRMED — do NOT add a queue binding until this
line reads OK` from the SITE BUILDER's queue step, while that binding is live and working
(`Producer`/`Consumer for site-builds` in the same log). Its condition is
`grep -qiE "created queue|already exists"` and Cloudflare says *"is already taken"* — the
wording match this product's own queue step was rewritten to stop using. **Proved
pre-existing rather than assumed**: that line was last touched 2026-09-13, before this
branch existed, and the merge does not touch `deploy.yml` at all (`git diff` over that
path is empty). It prints and carries on by that product's own design, so nothing is
broken — but the sentence is now always wrong, and it tells the reader not to do a thing
already done. **The site builder's call, not this one's; offered and not taken.**

### ⚠ THE OTHER PRODUCT'S GUARD FOUND A REAL DEFECT IN THIS ONE, ON THE MERGE (2026-09-15)

**`test/repair-workflows.test.mjs` — the SITE BUILDER's guard, written for its own repair
workflows — went red the moment the two trees were merged, and it was right.** It reads
every file in `.github/workflows/` and names any step that pipes into `tee` under a shell
that reports tee's status. It named four lines in `agent-deploy.yml`, a file that did not
exist when that guard was written.

**AND THE ONE THAT MATTERED WAS THE QUEUE STEP'S VERDICT.** GitHub's unspecified Linux
shell is `bash -e {0}` — `set -e` with NO `pipefail` — and a pipeline reports its LAST
command's status, so

```
if npx wrangler queues info agent-runs 2>&1 | tee /tmp/qinfo.txt; then confirmed="info"
```

read **tee's** status, which is 0 whatever wrangler did. That step exists precisely
because the version before it matched wrangler's WORDING and failed a deploy on a guessed
string — and its replacement, which reads an exit status instead, was handed a constant by
the pipe. It has said `QUEUE OK … (confirmed by: info)` on every run; that answer happened
to be true, and was never evidence.

**MEASURED, both shells, rather than recalled:**

| shell | `if false \| tee /dev/null` |
|---|---|
| `bash --noprofile --norc -e` (unspecified) | takes the TRUE branch — the failure is swallowed |
| `bash --noprofile --norc -eo pipefail` (`shell: bash`) | takes the false branch |

**AND FIXING IT EXPOSED A SECOND DEFECT `pipefail` CREATES, which the root guard does not
name.** With pipefail on, `ver=$(… | grep nomatch | head -1)` fails the assignment and
`set -e` kills the step — so `if [ -z "$ver" ]`, the named refusal whose whole job is to
say *the deploy printed no version id*, becomes **unreachable**, and that failure would
die saying nothing at all. Measured the same way: without `|| true` the next line never
runs; with it, it does. Both extractions carry `|| true` now, and the `set -o pipefail`
already in those bodies stays as a **declared second wall** — the shell line protects the
step if the body's line is dropped, and the body's line if the shell line is.

**THIS PRODUCT NOW OWNS BOTH PROPERTIES TOO, and both guards EXECUTE.** The root guard
only exists on main; a change to this workflow on the agent branch would not meet it until
the next merge. `test/deploy-workflow.test.mjs` runs the two shells from their documented
argv and asserts what they DO, then holds every piping step to a shell that keeps the
failure and every extraction feeding a `[ -z … ]` refusal to `|| true`. Spot-checked
against three breakages, all caught: the shell line removed, **`shell: sh` substituted for
it** — which a grep for the spelling would have passed — and the `|| true` dropped.

**THE LESSON IS ABOUT THE MERGE, not about `tee`.** Two products in one repository share
exactly one thing, `.github/workflows/`, and a guard on one side reads the other side's
files the instant the trees meet. *Running the other product's suite on the merged tree is
not a formality; it is the only place a cross-product guard can fire.* Merging on the
strength of "no overlapping files" would have shipped this.

### ⚠ WHICH VERSION IS SERVING, AND HOW A RUN ONCE REPORTED THE WRONG ONE (2026-09-15)

**`wrangler secret put` MINTS A VERSION OF ITS OWN AND PRINTS NO ID.** That one fact is
the whole defect, and it is measured rather than reasoned: on Actions run 34938312961
the deploy step printed `Current Version ID: e3bdf22e…` at 06:45:07.785Z, the secret
step's first line came at 06:45:09.242Z, and the Worker has served **`64ac3bb4…`,
stamped 06:45:09.382489Z**, ever since — 140 ms after that line, with no id anywhere in
the log.

So the id the deploy step printed could never be the serving one, and the serving one
was unobtainable. On top of that the wait step asked `/health` ONCE, two seconds after
the upload, and got `2dfb8be6…` — the version from the deploy BEFORE last, because a
version reaches Cloudflare's edges over some seconds and the edge that answered was
honestly still running the old one. **The verification then printed that as "the
deployed version" and passed 69 checks.** Nothing was broken; the run simply could not
say which deployment it had verified — and *a report of the version that answered reads
exactly like a report of the version that was deployed.*

**✅ PROVEN LIVE, AND THE PROOF IS BETTER THAN THE DIAGNOSIS — Actions run 34941653115
(2026-09-15 07:25:45→07:32:40Z, green).** That run printed **THREE version ids inside
seven seconds**, which is the whole defect visible at once:

| id | where it came from |
|---|---|
| `726bb8f2-4a19-48c9-a21c-bf39719260ef` | the deploy step's own `Current Version ID`, 07:26:15.869Z |
| `472ad34c-7c21-479b-8f21-bb9716c57255` | **nowhere — the secret upload's version, which wrangler never printed.** Caught only because `/health` was asked |
| `47e5e88a-6f1e-4f76-ad61-615eaf2f9b91` | the re-deploy's, 07:26:22.093Z — `the version that must be serving` |

And the wait step's two lines are the argument for polling on the ID:

```
  attempt 1: version=472ad34c-7c21-479b-8f21-bb9716c57255 ok=1
  attempt 2: version=47e5e88a-6f1e-4f76-ad61-615eaf2f9b91 ok=1
```

**Attempt 1 answered `ok=1` on a version this run had no id for.** The old step would
have stopped there and the verification would have reported `472ad34c…` as the deployed
version — wrong for the third deploy running, and green. The new step waited ten seconds
and got the id it was holding the Worker to. `/health` has served
`47e5e88a-6f1e-4f76-ad61-615eaf2f9b91`, stamped `2026-09-15T07:26:19.985979Z`, ever
since, with `cache-control: no-store`.

**TWO PROPERTIES, and they are different ones**, both guarded by
`test/deploy-workflow.test.mjs` — the workflow had no guard at all until now, which is
this repository's own recorded trap that *the thing that runs your guards is not itself
guarded unless somebody writes it down*, and it fails in the safe-looking direction
because a workflow that stops checking produces no red run:

1. **THE RUN MUST END HOLDING ONE VERSION ID.** A `wrangler deploy` is now the LAST
   thing that changes the Worker (it re-uploads the same code; secrets are settings and
   survive a deploy), so the id comes from the step that created it, on that step's own
   output. A deploy printing no readable id STOPS the run: the id comes from wrangler's
   own wording, and a guessed string guessed wrong is what failed the deploy before
   this one. The guard also asserts nothing between that step and the verification
   touches the Worker again, because that is exactly how the id stopped being the
   serving one the first time.
2. **`/health` MUST BE ASKED UNTIL IT ANSWERS THAT ID.** `ok: true` is not a substitute
   and that substitution IS the bug: the previous deployment answers `ok: true` just as
   truthfully. The loop compares the id and a run that never sees it FAILS, because a
   check against an unknown version is evidence about the wrong deployment.

**`cache-control: no-store` on `/health` is the third thing and the smallest.** It is
NOT a fix for propagation — an edge can honestly still be on the old version — it
removes the OTHER explanation for a stale answer, so that a reader which keeps asking is
really asking. Both halves are guarded, and the version check is exercised by
`verify:local`, which binds a FRESH id per run and hands the same id in as the
expectation: a check that had stopped comparing would pass every previous run and fail
that one.

**AND `verify-live.mjs` NOW ASSERTS RATHER THAN ECHOES.** The version was printed
correctly all along — the defect was that printing it counted as verifying it. An unset
expectation (a hand run against whatever is live) SAYS it verified nothing rather than
passing quietly: *a check that cannot be made is not a check that passed.*

### The five things a live verification checks

`npm run verify:local` runs `scripts/verify-live.mjs` UNMODIFIED against a local
PostgreSQL with these migrations and **two separate consumer processes** — because a
handover between consumers is not something one process can demonstrate. **50 checks,
0 failed.**

1. **a real customer signs in, starts the long task, is answered 202 promptly, and
   reads progress and then the final result** — plus that the prompt was committed
   BEFORE the response and that the stored log matches what the API reported;
2. **one run, one execution** — two simultaneous resumes mid-run are both refused as
   `already-running` without disturbing the holder's lease; a direct second
   `claim_run` while the lease is live gets nothing; the finished log holds exactly one
   model answer per step;
3. **an interrupted consumer is replaced and progress is kept** — measured locally: a
   consumer lost the run at 2 steps, another took it over **5 s later**, and it
   finished at 9 steps with **9 model entries for 9 steps**, so it continued rather
   than restarting;
4. **a lost lease writes nothing and an uncertain action stays blocked** — the
   `guarded` agent's tool is declared NOT repeatable; its lease is revoked with a tool
   call in flight, and the in-flight result is **never written** (1 model, 0 tool), no
   stop is recorded, the pending call is visible, `problems` is empty, and asking
   again refuses again without repeating the action;
5. **the fence** — a holder writes; the same entry re-sent is `already`; a different
   entry in the same slot is a `conflict`; a paused holder whose lease expired is
   refused; a **duplicate delivery claims the run while the sweeper's grace has not
   expired** and its write succeeds where the old holder's fails; and a reclaim under
   the SAME worker name still refuses the previous claim. Plus: the service key can no
   longer insert an entry directly at all.
   **IT NEEDS NO TIMING AND NO LUCK, deliberately.** The gap it closes was found by
   watching a consumer keep writing for 30 seconds after its lease was revoked, and a
   reproduction that depends on catching a 30-second window is one nobody re-runs.
   **AND WHAT "A DUPLICATE DELIVERY" AMOUNTS TO IS SAID OUT LOUD, so nobody reads more
   into it than is there**: a delivery's only effect on exclusivity is that the consumer
   calls `claim_run`, so check 5 calls the same function the same way. The real delivery
   path is proved by different checks — 2 races two resumes and a second claim against a
   LIVE lease through the deployment, and 3 has a real second consumer take a run over.
   The three together are the claim; none of them is it alone.

- **HOW AN INTERRUPTION IS PRODUCED, SAID PLAINLY: the lease is revoked** with the
  service key, which is what the platform's own reclaim does to a consumer that has
  died. **What it does NOT reproduce is a consumer that dies mid-write** — that needs
  a real isolate killed at a chosen instant, and nothing here can do it.
- **`guarded` IS A PAYMENT'S SHAPE WITHOUT A PAYMENT.** Its `commit` tool only waits,
  and `repeatable` is absent — so the refusal is proved by the DECLARATION, which is
  the only thing that decides it. A verification must not do anything to anybody.
- **THE STAND-IN TREATS `wait` AND `commit` IDENTICALLY**, and that is the point:
  whether a tool may be retried is the platform's business and not something a model
  gets to see.
- **`spawn`, NEVER `execFileSync`, FOR THE CHILD.** `verify-local.mjs` is also the
  process serving the shim and the API, and a synchronous child blocks its event loop
  — so every request timed out with no server having seen it, and the failure read
  like a broken deployment rather than a blocked host. Cost one run.

### ⚠ A REFUSAL THAT COVERS TWO CAUSES: PGRST202

Asking the hosted project whether PostgREST had picked up the new queue functions,
`rpc/claim_run` with `{}` answered **PGRST202, "no matches were found in the schema
cache"** — which reads exactly like a stale cache and is not one. `claim_run`'s first
two arguments have no defaults, so `{}` genuinely does not match; **PGRST202 covers
"not in the cache" AND "wrong arguments" and cannot tell them apart.**

**WHAT SETTLES IT IS THE ARGUMENT NAMES PLUS A CONTROL.** Called as
`{p_run_id, p_worker, p_ttl_s}`, `claim_run` and `accept_run` answer `permission
denied for schema agent` — the `anon` wall, which only a function PostgREST has found
can reach — while a NONEXISTENT function with the same argument names still answers
PGRST202. So the cache knows the table and all six functions.

## The long run, demonstrated (2026-09-15)

`npm run demo:long`. **65.6 SECONDS OF WORK AFTER AN 82 ms RESPONSE, with every
claim checked rather than narrated.** What it proved:

| | |
|---|---|
| the response came back in | **82 ms** |
| the work ran for | **65,630 ms** after that response |
| progress observations while running | **9** (steps 1…9, one every ~8 s) |
| stages that ran | 8 of 8 |
| the stored log | `started, model, tool` × 8, `model`, `stopped` — 19 entries |

- **THE ACCEPTING PROCESS HAD NO CONSUMER AT ALL.** Its queue binding records
  messages and runs nothing, and its `ctx.waitUntil` THROWS if anything touches it.
  If the run had executed there, the demonstration would have proved nothing about
  durability — only that `waitUntil` still works.
- **A SEPARATE OS PROCESS, WHICH NEVER SAW THE REQUEST, RAN IT** (`scripts/consume.mjs`,
  spawned with its own pid). It takes no messages: it sweeps the table, claims what
  it finds, and runs it. **That is the proof that the work is a row and not a
  closure** — if durability were still `waitUntil` there would be nothing for it to
  find.
- **EVERYTHING WAS COMMITTED BEFORE THE RESPONSE**: the run row, the prompt in the
  log, and the queue row, checked by reading the database directly at that instant.
- **WHERE IT RAN, STATED UP FRONT: a throwaway LOCAL PostgreSQL with the real
  migrations applied, through a PostgREST-shaped shim** (`scripts/local-rest.mjs`).
  The schema, the triggers, the generated columns, the partial unique indexes and
  the claim's conditional UPDATE are the genuine article; what is local is the HTTP
  translation. **It is NOT the hosted project and must not be read as proving it** —
  writing there needs the service key. The shim is deliberately narrow, refuses any
  column the store does not ask for, and reproduces Postgres's duplicate code and
  constraint NAME because `store.mjs` reads both.

### ⚠ What is NOT connected, and exactly why (superseded — see below)

**The milestone — one complete task through the Worker into the live database — is
blocked on TWO secrets this session cannot obtain**, and neither is a code problem:

1. **`SUPABASE_JWT_SECRET`**, without which the Worker cannot verify a real
   customer's token.
2. **`SUPABASE_SERVICE_KEY`**, without which the store cannot write.

**WHAT WAS PROVEN INSTEAD**, by running the real handler over real HTTP against the
real project with a self-signed token and a deliberately unprivileged credential in
the service slot: no credentials → 401; a forged token → 401; a correctly signed
token → accepted by the verifier and carried into the store, which reached Supabase
and was refused for holding no privilege. **The chain is connected end to end and
stops exactly at the credential.**

Also not connected: a real model provider, a queue or container for runs longer
than an invocation, and any deployment at all.

### ⚠ WHAT IS STILL NOT CONNECTED, as of the queue work (2026-09-15)

**ONE SECRET, NOT TWO. `SUPABASE_JWT_SECRET` IS NO LONGER NEEDED AT ALL** — the
verifier uses the project's published key, or asks Supabase Auth. That half of the
old blocker was not worked around; it was removed.

**`SUPABASE_SERVICE_KEY` IS THE ONE THING LEFT**, and it is not a code problem: the
Supabase MCP exposes publishable keys only, and the project's JWT secret is not
readable from the database either (checked: no `pgrst.jwt_secret` role setting, and
`current_setting` answers nothing — the platform injects it into PostgREST's
process). **A service-role credential was deliberately NOT manufactured**: the ways
available — a public Edge Function proxy holding the service key, or minting a
long-lived role JWT into a transcript — are each a worse security decision than
waiting for the owner to set a secret.

**WHAT WAS PROVEN INSTEAD, and why it is nearly as good:** the whole flow runs
against a REAL PostgreSQL with these migrations applied
(`npm run demo:long`, 65.6 s), and the hosted schema is verified by 30 behavioural
checks driven against the live project with the six function bodies matching this
repo byte for byte. So the two halves that remain untested together are the HTTP
translation (PostgREST versus the local shim) and nothing else.

Also still not connected: **a real model provider** (one `MODELS` entry plus a
`send`), and **any deployment at all** — no Worker, no queue, no route, no domain.
`docs/deploy.md` is the step-by-step, with the exact secret names.

**⚠ THE LAST SENTENCE IS SUPERSEDED TWICE OVER and is kept for the reasoning above it,
which still holds.** There IS a deployment (see "✅ DEPLOYED AND VERIFIED LIVE"), the
service key came from Actions rather than from a transcript, and the fence round added
`rpc/append_entry` and a direct `POST /run_entries` to what the hosted PostgREST has
answered. The only thing this section still names correctly is the model provider.

### Measured

- **Unit suite: 235 tests, 0 failures** (`cd agent-builder && npm test`). 161 before
  the queue round, 219 after it, 222 after the deployment; **the seven net since are the
  fence's**, and **the four after them are the deploy version identity's** — the run
  holding one id printed by the step that minted it, `/health` asked until it answers
  that id, the verification asserting rather than echoing, and check 0 DRIVEN against a
  stub for all four of its answers (right version, wrong version, cacheable, no
  expectation) — **and two more from the merge**: the two shells driven from their
  documented argv, and every piping step plus every refusal-feeding extraction held to
  what those shells DO — the three-way drift guard
  on `CLAIM_GONE`, every append answer read with
  the two successes told apart, a journal refusing to exist without a claim, `open`'s
  options refusing to carry a tenant, a conflict told from a duplicate, `work.append`'s
  closed vocabulary, the ownership checks' ORDER, a checkpoint that refuses writing
  nothing, a reclaim mid-run stopping the old consumer, and a conflict as its own
  outcome — against several retired with the direct-insert path, since `duplicateKind`
  and the constraint-name reading went with it.
- **Schema check: 185 checks, 0 failed** against a real PostgreSQL 16.13
  (`npm run test:pg`), over all FOUR migrations — 78 before the queue, 125 after it,
  and **the 60 since are the fence's**: the token, the two duplicate readings, every
  refusal by name, the before/after on the direct-insert grant (measured in BOTH
  directions on the same database), the three-party scenario, and the census that every
  overload of `beat_run` and `release_run` requires the token, **and the row lock
  observed from a second session under `lock_timeout`**. Skips with a message, and
  exits 0, where there is no local cluster — "no database here" is not a failing
  schema. **Eight of the 60 were added by a sweep** rather than thought of: see "What
  the fence round found".
- **The long run, end to end: a 75 ms response and 65,593 ms of work after it**
  (`npm run demo:long`), with **9 progress observations** while it ran, all 8 stages
  executed, and every entry in a real PostgreSQL. Re-run on the final tree, not
  carried over from the first pass — the first read 82 ms / 65,630 ms.
- **The live project: 30 behavioural checks, 0 failed**, driven against
  `ujrqdmmtcptvimazlhom` and rolled back, with both tables left empty. The six
  queue function bodies match this repo's migration **byte for byte**
  (`md5(pg_get_functiondef(...))` compared against a local apply, before and after a
  comment-only edit to the file).
- **The live verification against the DEPLOYMENT: 71 checks, 0 failed** (Actions run
  34941653115, version `47e5e88a…`). Driven end to end locally too: **69 checks, 0
  failed**
  (`npm run verify:local`) — the same `verify-live.mjs` an operator points at a
  deployment, run unmodified against a real PostgreSQL with these migrations and TWO
  separate consumer processes. 50 before the fence; **17 of the 19 since are check 5's**,
  and the last two are the version identity's — a FRESH version id per local run, handed
  in as the expectation, so a check that had stopped comparing would pass every earlier
  run and fail this one.
  The handover: a consumer lost the run at 2 steps, another took it over and it
  finished at 9 steps with **9 model entries for 9 steps**. The blocked action:
  **1 model entry, 0 tool results** — the in-flight result was never written, no stop
  was recorded, and asking again refused again. The fence: the service key was refused
  `permission denied for table run_entries` on a direct insert, an identical entry
  re-sent came back `already` and a different one `conflict`, a paused holder was
  refused `lease-expired`, **the sweeper offered 0 rows at the moment a duplicate
  delivery claimed it**, the old holder's write failed and the replacement's was
  stored, and a reclaim under the SAME NAME still refused the previous claim
  `bad-token`.
  **ONE INSTRUMENT GAP WAS FOUND AND FIXED RATHER THAN WORKED AROUND**: the local
  PostgREST shim did not serve `DELETE /runs`, which the hosted API does, so the
  probe's own cleanup reported a false failure. A shim LESS capable than the thing it
  stands in for reports the product as broken.
- **The auth probe: all checks passed** against the live project
  (`scripts/auth-probe.mjs`) — the published ES256 key imports, and Supabase Auth
  answers a genuine token and a tampered one differently.
- **NOTHING ELSE IN THE TREE CHANGED: its suite reads 6,316 tests, 6,314 passing,
  0 failures** — run BEFORE this directory existed, again with it present, again
  after the queue round, and again after the fence: same count, same colour every
  time. Measured, not argued from the path filters — and `git diff --name-only`
  answers nothing outside `agent-builder/` as well, which is the cheap half of the
  same claim. (In a fresh container that
  suite needs `npm ci` first or ~361 cases fail on missing modules — the
  environment, not the code.)
- **Code sweep: 202 mutants, 202 killed, 0 survived, 0 never applied, 4
  comment-only controls survived** (`npm run sweep`). Measured after the run, not
  before it. 173 before the fence, 189 after it; **the 13 since are the version
  identity's**, including a fourth control on the workflow — a file this sweep had never
  touched. **TWO PASSES for this round: 5 survivors, then 0, and all five were in guards
  written minutes earlier** (recorded above). The fence round took three passes: 8, then
  5, then 0. The passes went 34 (the first four modules) → 54 (the journal and
  resume) → 68 (the store and the limits codec) → 74 (the ownership boundary) → 98
  (auth and the HTTP surface) → 108 (the Worker and the tenant claims) → 164 (the
  three auth strategies, `work.mjs`, `runner.mjs` and the three Worker handlers) →
  **173 (`/health` and the lease knobs)**.
  **THE DEPLOYMENT ROUND LEFT THREE SURVIVORS AND EVERY ONE WAS A FIXTURE THAT COULD
  NOT SEE THE NUMBER:** `/health` echoing the default model (the test had `MODEL`
  unset, so the default and the echo were the same string — and fixing it found a
  real dishonesty, a deployment with an unrunnable model reporting `ok: true`); the
  Worker forwarding the lease knobs (INERT — `makeRunner` refuses a non-finite value
  one layer down, so the mutants moved there); and a junk BEAT interval, invisible
  because `fakeTimer` **discarded the delay it was asked for**. A fake that throws
  away a number cannot tell a 30-second heartbeat from a 0 ms busy loop, so it records
  the interval now.
  **TWENTY SURVIVED THE FIRST PASS OF THE QUEUE ROUND and every one was the tests'
  fault, not the product's** — which is the ordinary shape when a sweep grows by
  sixty mutants at once. Sixteen were plain gaps and closed. **Four were INERT and
  were proved so by measurement rather than hunted**, and each is now declared in
  the spec where the next reader will meet it:
  - the `use: "sig"` filter on a published key — **WebCrypto itself refuses to
    import an `enc` key for verification** (`Invalid JWK "use" Parameter`);
  - the auth cache's expiry bound — two walls in front of it, and an expired token
    is refused **without a round trip** either way;
  - the `catch` around `deliver` in the queue handler — `deliver` is built never to
    throw, and a store that falls over is driven and comes back `failed`;
  - the runner's `?? "anyone"` tenant fallback — `work.claim` refuses a claim with
    no tenant one layer down, and that mutant dies.
  **AND TWO SURVIVED BECAUSE THE TEST WAS IN THE WRONG STATE TO SEE THE CHANGE,
  which is worth more than either:** a kid-less token provokes no key fetch only
  *on a cold verifier* (after any other token the refetch floor hides it), and the
  `catch` around `crypto.subtle.verify` is reachable only through the **decode** —
  a wrong-LENGTH signature makes WebCrypto answer false rather than throw, so the
  obvious test proved the comparison and nothing about the catch.
- **SQL sweep: 64 mutants, 64 killed, 0 survived, 0 never applied, 3 comment-only
  controls survived** (`npm run sweep:sql`), over all FOUR migrations — 22 before the
  queue, 43 after it, and 21 more the fence's; 67 spec entries, being those 64 plus the
  three controls. **RE-MEASURED after the run, and this is the pass that closes the
  round.** The first pass read 60 killed / 4 survived, all four this file's fault and all
  four fixed above (the state-repairing check, the release asked in the wrong state, the
  blank worker, and the row lock no sequential check could see) — the schema check went
  177 → 185 closing them. A second pass was stopped at 10 of 67 to commit, **which left a
  live mutant in the tree** (recorded above); this third one ran to the end untouched,
  and the migrations are proved restored against git rather than by eye.
  **A POSITION IS NOT AN IDENTITY.** The spec aimed its tenant mutants at
  `files[files.length - 1]`, which was right for exactly as long as the tenant
  function lived in the newest migration — and a third migration pointed every one
  of them at a file that does not contain them. `lastDefining(needle)` asks the
  files instead, so it cannot go stale.
  **A MUTANT MUST TARGET THE MIGRATION THAT IS IN FORCE.** `agent.tenant_id()` is
  defined twice and the second definition wins, so two mutants aimed at the first
  one survived and were INERT BY CONSTRUCTION — the same trap as mutating dead
  code, arriving through migration order. The spec now names the latest file for
  anything redefined, and its pre-check reads each mutant's OWN file (reading one
  file for every mutant reported two correct anchors as missing).
  **AND A SENTINEL MUST OWN A ROW WHEN THE CHECK LOOKS**: a fail-open mutant
  returning a tenant that owns nothing at that point in the file is inert too.
  **ONE SURVIVED THE FIRST PASS AND IT WAS THE TEST'S FAULT, kept here because
  the shape repeats:** the mutant made the loop ignore a failed MODEL-entry
  write, and the fixture was a journal that failed on EVERY write — so the run
  reached the `stopped` write, failed there instead, and came back
  `journal-failed` anyway. **The assertion passed for the wrong reason**, which
  is the recorded "a fixture too shallow to separate the two readings".
  Replaced by a census that fails one entry KIND at a time with a control, and
  the sweep gained a mutant per write site, because a census in the test needs a
  census in the sweep or only the arm that happens to be mutated is really
  proved. All four write sites now die.
- All five controls carry `control: true` and not merely the word in their label, so
  the runner's own `CONTROL WAS KILLED` branch was armed. Run with
  `--test-timeout=20000`, because the "step counted after the call" mutant HANGS
  rather than failing.

## A customer's own agent runs on the engine (2026-09-16)

`supabase/migrations/20260916000000_agent_send_starts_a_run.sql` (**NOT APPLIED** —
the name is a placeholder to be replaced with the remote version on the day it is),
`src/define.mjs`'s `withInstructions`, the snapshot in `src/journal.mjs`,
`src/agents.mjs`'s `AUTHORED`, `src/model-standin.mjs`'s `simulatedAnswer`, and the
site builder's `/api/agent/send`.

**THE DIVISION IS THE WHOLE THING: the customer owns the INSTRUCTIONS and the
conversation, and this directory owns everything else.** A person writes a name and an
instruction in a browser; they are DATA, stored in `agent.agents`. The tools, the
bounds and the model are CODE, in `agents.mjs`, and cannot be reached from a request at
all — which keeps "an agent is NAMED, never described" true while still letting the
described half be somebody's own writing.

### One transaction, and the app cannot decide anything in it

`agent.send_to_agent(p_tenant, p_agent_id, p_message_id, p_body, p_send_key, p_run_id)`
— **six arguments, not one of them structured**, asserted against the catalog (`jsonb`
is the only type an entry, a bound list or a history could arrive as, and no argument
is one). It verifies the agent is this tenant's, inserts the message, builds the run's
first entry, calls `agent.accept_run`, and links the two.

- **THE FIRST CUT TOOK THE WHOLE ENTRY AS AN ARGUMENT** and merged the snapshot over
  it. That still let a caller decide the model and the bounds, with only the app's own
  care between a bug and a run with sixteen steps. There is nothing to decide now.
- **THE ORDER IS THE RETRY-SAFETY ARGUMENT.** The MESSAGE goes in first, because its
  key is the gate: a repeat must be absorbed BEFORE any run exists. Minting the run
  first would leave a second press having created a run and a work row no message
  points at — and the queue would execute it, which is the duplicate this prevents
  wearing an orphan's clothes.
- **IT CALLS `accept_run` RATHER THAN REPEATING ITS THREE INSERTS.** A second copy
  would be a second definition of "accepted", and the copy that drifts is the one that
  leaves a run with a log and nothing to run it.
- **THE SNAPSHOT IS READ HERE, NOT PASSED IN** — the instructions and the history come
  from rows read in THIS transaction, so a later edit of the agent cannot reach a run
  that has already been accepted.
- **A SEND WITH NO KEY IS REFUSED, NOT ACCEPTED UNKEYED.** The partial unique index
  covers non-null keys only, so an unkeyed send would insert every time: retry safety
  failing OPEN, which is the direction that duplicates a conversation.
- **BOTH ANSWERS CARRY THE STORED BODY**, never the one the call sent. They differ
  exactly when a retry carries different text under the same key — a client bug — and
  the honest answer is what the conversation really holds.

### The message role constraint is inspected and DELIBERATELY UNCHANGED

`agent_messages.role` admits `'user'` and nothing else. Widening it to
`('user','agent')` and writing a row when a run finishes would be wrong twice: it would
be **a second copy of a fact the journal already holds** (the run's stop IS the result,
and a row repeating it can disagree with it), and it would make **a forged answer a row
that EXISTS** — no client role has INSERT here, but the SERVER does, and the only thing
stopping the server writing `role: 'agent'` from a request body would be our own care.
Left at `'user'`, a forged agent reply is not a bug to be prevented; it is a row the
database refuses, whatever any client or route asks for. So an answer is DISPLAYED FROM
THE RUN and the browser has nowhere to put one.

### `agent.agent_thread`, and what it can and cannot say

One view, `security_invoker = true`, spanning three relations: the message, its run, and
the log (for the step). **Without that option it would be a hole through the RLS on all
three**; with it, a pointer at a run that is not the reader's answers NULL rather than a
status — driven, as the owner and then as the tenant.

**A VIEW RATHER THAN A POSTGREST EMBED, deliberately.** `agent_messages` has a foreign
key to `agent.runs` now, so `select=…,runs(status,stop)` would work with no migration —
and could only ever be asserted from documentation, because nothing here can run
PostgREST. A view is plain SQL and the schema check drives it on a real PostgreSQL.

**⚠ AND THE STEP IS WHAT SEPARATES QUEUED FROM WORKING, not the status — measured,
after an expectation written the other way round.** `agent.runs.status` is projected off
the LOG and `accept_run` writes the `started` entry in the accepting transaction, so a
run reads **`running` from the instant it is queued**; `new` belongs to a run row with
no log at all. `agent.run_work` would say it directly and is deliberately NOT joined:
`authenticated` holds nothing on that table, so under `security_invoker` it would answer
NULL for every customer and read as a run that never started.

### `withInstructions`, and the two ways it can be wrong

`withInstructions(agent, instructions)` — the only thing a customer may replace.

- **IT TAKES A STRING AND AN AGENT AND NOTHING ELSE**, so there is nowhere for a tool
  or a limit to arrive. Driven with instructions that ask for both.
- **THE RUNNER READS IT FROM THE LOG ON EVERY DELIVERY**, which is what makes the
  snapshot a snapshot: a long run is several invocations by design, and taking the
  instructions from anywhere else would mean a resumed run continuing under whatever the
  agent says NOW.
- **A RUN WITH NO SNAPSHOT STILL RUNS**, on the registry's own text. Every run accepted
  before this is that shape.

### ⚠ `toolCalls: 0` IS A BRICK WALL, NOT A SECOND WALL — found by a guard, before it shipped

`AUTHORED` was first written with `tools: []` AND `toolCalls: 0`, the second "saying the
same thing as a bound". `toolCalls` is a RUN TOTAL and `stoppedBy` asks `used >= limit`:
at the very start that is `0 >= 0`, so the run stops with
`{reason: "spent", bound: "toolCalls", limit: 0, used: 0}` **before its first model
call**. Every customer-authored agent would have answered nothing at all, and the
failure would have read as a limit doing its job.

**So the bound is ONE, and it is not a second wall — it is the smallest number that
lets the run start.** The tool list is the only wall and it is sufficient: with
`tools: []` there is nothing to dispatch TO, so the bound could be sixty-four and no
tool would run. *Saying a thing twice is not available when one of the two ways is a
brick.* Asserted as the MEASUREMENT (`stoppedBy` over the agent's own bounds answers
`null`, and over the same bounds with `toolCalls: 0` answers the stop) rather than as
the number.

### The stand-in labels itself, and the label is about the RUN

`simulatedAnswer({system, messages})` — `[simulated]`, one sentence saying no model is
connected, then the instructions quoted back (bounded at `SIMULATED_QUOTE`, 120), the
last thing said, and a COUNT of the earlier turns.

- **IT QUOTES WHAT ARRIVED ON PURPOSE**, so a run handed the wrong snapshot, or none,
  produces visibly different text rather than a plausible answer nobody can check. It
  doubles as the verification's own instrument.
- **THE LABEL IS IN THE TEXT AS WELL AS IN THE CHROME**, and the redundancy is
  declared: the chrome's label is gone the moment somebody copies an answer into an
  email, and this one travels.
- **AND WHETHER AN ANSWER IS SIMULATED IS READ FROM THE RUN'S OWN MODEL**
  (`agent.runs.model`, projected off its log), never from a constant and never sniffed
  out of the text. Connect a real provider and the runs that used it are not labelled,
  with no change to any reader — which is what "keep model selection replaceable"
  amounts to in practice.

### The census that keeps two declarations in step

`agent.authored_run()` says what model and bounds an authored run executes under, and
`AUTHORED` says it too. There is no arrangement in which only one holds it: the registry
is code loaded at import and cannot be read from SQL, and the transaction that must be
atomic is in the database. So it is a copy, **declared as one**, and
`test/authored-run.test.mjs` compares them BOTH WAYS — the name, the model, and every
bound, with the SQL read out of the migration file.

- **IT WRITES ALL EIGHT BOUNDS, NOT THE FOUR THIS AGENT OVERRIDES, and the census found
  that.** The API path writes `limitsToJson(agent.limits)` and `defineAgent` has already
  planned them, so the entry there carries the whole set. Writing only the overrides
  would leave the other four to be filled in from whatever the DEFAULTS are on the day a
  run is REPLAYED — identical today, different the day a default moves.
- **AND THE ENTRY SHAPES ARE CENSUSED TOO.** `startedEntry` gained `authoredAgent` and
  `message` for the same reason: the SQL adds them AFTER building the entry, so without
  them the JS producer could not express what the SQL path writes — two producers of one
  shape, which is the thing that constructor exists to prevent.
- **THE KEY READER IS DEPTH-AWARE**, because in `jsonb_build_object('kind', 'started',
  …)` the keys are at EVEN positions and a `/'(\w+)',/` sweep reads `'started'` as a
  field name. It did, on the first try, and reported a correct migration as broken.
- **PROVED ALIVE ON SIX REAL BREAKAGES** — the tool budget widened, the model changed,
  the step bound raised, a bound deleted, a snapshot field renamed, the agent name
  changed. All six killed, the migration restored, and the hand-rolled checker REFUSES
  to run when the source did not change.

### Verified end to end, locally, against a real PostgreSQL

`npm run verify:chat` (`scripts/verify-agent-chat.mjs`) — **58 checks, 0 failed.** It
drives the site builder's real route (`handleAgentApi` + `makeAgentStore` over
PostgREST), a throwaway PostgreSQL with these migrations applied, and the real engine
(`makeRunner`, `makeRunStore`, `makeWork`, `runAgent`, the real journal and registry,
claiming through `claim_run` and writing every entry through the fence).

**WHAT IS SIMULATED, in one place: the HTTP translation** (PostgREST is
`scripts/local-rest.mjs`, because writing to the hosted project needs a service
credential) **and the MODEL** (`makeStandIn`). Nothing else — not the ownership check,
the retry key, the queue, the lease, the journal, the snapshot, the bounds, or the
reading the screen does.

Twelve sections: the send committing everything before it answers; the snapshot being
the agent's with the model and bounds the server's; the conversation reading queued;
the runner claiming, running and releasing; the answer read back labelled and quoting
the instructions; a double send absorbed to one message and one run; the second run
given the first turn WITH its answer; an edit afterwards leaving an accepted run
unchanged and reaching the next one; a failed run named `call-failed`; a reload
mid-run needing no recovery; the account next door refused NOT FOUND with nothing
written; and a finished run not run again.

**⚠ IT FOUND A REAL WIRING GAP THAT EVERY UNIT GUARD MISSED.** The app reads
`run_model` to decide whether an answer is simulated, and the view did not have that
column — so `simulated` would have been false for every answer, with the whole root
suite green, because the FIXTURE answered a column the database did not have. That is
the recorded "a fixture MORE capable than reality" exactly, and the only place it is
visible is a real database. The view carries it now and the schema check censuses every
column the store asks for, by name.

### Measured

- **Unit suite: 256 tests, 0 failures** (254 after `test/authored-run.test.mjs`'s 19
  landed, plus the two census cases). 235 before this round.
- **Schema check: 365 checks, 0 failed** against a real PostgreSQL 16.13 — 262 before
  this round, so **103 are this change's**: the send and its refusals, the snapshot, the
  duplicate absorbed, the cross-account refusal, the history projection, the edit
  afterwards, the role constraint still refusing `'agent'`, the privileges, retention
  leaving the writing, the thread view's four states, its `security_invoker` across
  three relations, the foreign-run NULL, and the column census — **and the 21 the SQL
  sweep asked for**: a conversation longer than the window handing over its NEWEST turns,
  a turn with no run surviving the join, a stop that is not an answer contributing no
  text, `anon` asked as a PRIVILEGE rather than as a refusal, the grant census with its
  observer proved alive, and the absorbed press that says its words differ.
- **End to end: 67 checks, 0 failed** (`npm run verify:chat`) — 58 plus section 13's
  nine, which drive the doorbell and its failure by the ring ALONE.
- **The site builder's suite: 6,628 tests, 0 failures, 2 skipped** on the MERGED tree —
  its own number, run from its own directory, and the one place a cross-product guard can
  fire. 6,606 before main was merged in, plus main's 22, and the arithmetic closes.
- **Code sweep: 65 mutants, 65 killed, 0 survived, 0 never applied, 4 comment-only
  controls survived** — 26 here (`withInstructions`, the snapshot in the journal, the
  runner's per-delivery read, the stand-in's label and the registry entry) and 39 in the
  site builder. **Three survived a first pass here and every one was INERT BY
  CONSTRUCTION, measured rather than hunted, and REPLACED by an observable mutant of the
  same line**: an unused default parameter (a default does not count toward `.length`),
  `tools: agent.tools` (`defineAgent` already freezes its list, so the two are identical
  for any registered agent — what separates them is a hand-built object whose array is
  mutable, which is now driven), and a runner line that read
  `open.state.instructions || registered.instructions`, which is the same agent for
  every input. **Two more were real guard gaps**: a refusal from the WRONG GATE
  (`{}` still threw a TypeError, from the spread rather than from the check — so
  `assert.throws(…, TypeError)` passed over a function that had stopped checking), and
  a third argument that can only reach `name`, `model` and `kind`, because the spread
  sits before the explicit fields. **`model` is the one worth asserting** and was the
  survivor that made it get asserted.
- **SQL sweep: 88 mutants, 88 killed, 0 survived, 0 never applied, 4 comment-only
  controls survived** (`npm run sweep:sql`, 92 spec entries being those 88 plus the four
  controls). **TWO PASSES, and the first one is the more useful.** The earlier partial
  reading — 26 of 92, stopped to commit — had reached none of the controls, which is why
  it was recorded as a partial READING rather than a partial result; *a sweep whose
  control has not been reached is a sweep with no control.* Run to the end it came back
  **81 killed, 7 SURVIVED**, and **every one of the seven was in this change's own
  mutants**, because the spec runs in file order and the send's migration is the newest.
  **AND THE SWEEP WAS RIGHT ABOUT ALL SEVEN.** Five were coverage gaps in the database
  check, one was the SWEEP'S OWN blind spot, and two mutants were badly written:
  - **A LONG CONVERSATION AND A RUN-LESS TURN WERE UNREACHABLE.** `order by m.seq desc`
    → `asc` and `left join` → `join` both survived because the checked conversation is
    three turns long and every turn has a run. A reversed window pins a customer's long
    conversation to its first screen for ever; an inner join sends the model a history
    with the customer's own questions missing. Closed with a fixture of
    `history_turns() + 3` run-less messages on its own agent — INSERTED rather than sent,
    because what is under test is the history READ and every check above already drives
    the writer.
  - **A STOP THAT IS NOT AN ANSWER COULD HAND OVER ITS TEXT.** `case when reason =
    'answered'` survived because no stop the engine writes today carries `text` unless it
    answered. It is the same rule `run.mjs:129` and `api.mjs:77` apply, in a third place
    and deliberately: a bound-stopped run may carry partial text, and passing that on
    puts words in the agent's mouth it never finished saying. The fixture writes the one
    stop shape that could, which is exactly what the wall is for.
  - **⚠ `anon` READING THE WHOLE CONVERSATION SURVIVED A CHECK WRITTEN FOR IT, and this
    is the recorded "a refusal from the wrong gate looks exactly like the wall
    working".** `anon` holds no USAGE on the schema, so every read as anon answers
    `permission denied for schema agent` whatever table grants exist — and the check
    asked only for `permission denied`. So GRANTING anon SELECT on `agent_thread` changed
    nothing it could see. The gate is NAMED now, and the grant is asked DIRECTLY through
    `has_table_privilege`, which is the only reader here that can see that mutant at all.
    **A census beside it caught a defect in my own new check**:
    `information_schema.role_table_grants` shows only grants whose grantee or grantor is
    a CURRENTLY ENABLED role, and this runs as `postgres` — so it answered 0 for `anon`
    AND 0 for `authenticated`, a negative assertion with a dead observer. The
    observer-alive line is what found it; it reads `pg_class.relacl` through
    `aclexplode` now, which does not care who is asking.
  - **THE BOUNDS MUTANT WAS THE SWEEP'S OWN BLIND SPOT, not the schema's.** Widening
    `authored_run()` (`steps` 2 → 16, `toolCalls` 1 → 64) survived while the tree was
    guarded all along: `authored-run.test.mjs` parses that function out of the migration
    and compares it with the engine's registry BOTH WAYS. The database check could not
    see it because the authority for those numbers is the registry, which only that
    census reads. **`sweep:sql` runs every check that guards these migrations now**, not
    just the database one — *a sweep is only as good as the checks it runs*, and reading
    that off one file made it weaker than the tree it was measuring.
  - **TWO MUTANTS WERE BADLY WRITTEN AND WERE REPLACED AFTER BEING MEASURED.** A bare
    `on conflict do nothing` is **MEASURED INERT** on two throwaway databases built from
    these migrations: it still absorbs the send-key conflict, so a duplicate press
    answers `repeat: true` with one message and one run either way, and the ONLY
    observable difference is which refusal a reused message id gets
    (`agent_messages_pkey` as written, the function's own "conflicted with a row that is
    not there" bare) — both refusing having written nothing. The clause is DELETED
    instead, which attacks the guarantee itself. And `perform 1;` appended after the
    accept was a no-op whose LABEL claimed a reorder; the property is what the absorb
    branch buys, so the replacement skips that branch (`if false`) and a duplicate press
    mints a second run linked to nothing — the orphan the queue would execute.
  - **(That "row that is not there" branch is reachable rather than paranoid**: under
    READ COMMITTED a racing press can have its insert skipped by a row that is not
    committed yet and is therefore invisible to the select below it.)
  **THE SECOND PASS IS THE TALLY, taken after the run**: 88/88, and the tree is proved
  restored TWO WAYS — `git status` clean with zero migration files differing from git,
  and the spec generator's own anchor census green over all five files, which it cannot
  be while a mutant is applied. **Measured mid-run, which is worth writing down**: the
  generator refuses with `ANCHOR NOT FOUND` for whichever mutant is live, so it is a
  reader of the tree and only means anything once the runner has exited.
  **AND THE RUNNER IS NOT REAPED BY THE HARNESS**: it ran 4,700+ seconds in one
  backgrounded call, well past the ten-minute tool ceiling, so the earlier truncation was
  my own SIGTERM and not a timeout.

### The doorbell, and the three review findings (2026-09-16)

A code review found three things wrong once a run is really going. All three are the
shape this product's own notes describe: the code reads correctly, every earlier check
passes, and the defect only exists while time passes.

- **THE DOORBELL IS THE ONE THAT BELONGS HERE.** Nothing told this engine when the site
  builder accepted a run, so a committed run waited for the cron — `sweep_run_work`
  offers a row with `claimed_by is null` **with no grace at all**, so the bound was one
  tick, up to a minute of somebody watching a screen that says nothing. The site builder
  now holds a Queues PRODUCER binding on `agent-runs` and rings `{ runId }` AFTER the
  transaction commits. **THE MESSAGE IS A RUN ID AND NOTHING ELSE**, which is this
  product's own rule (`claim_run` answers the tenant, so a stale or replayed delivery can
  never make a consumer act as somebody) — and a census in the site builder's
  `test/agent-send.test.mjs` reads THIS product's reader (`m.body?.runId`) and that
  sender's payload, plus both wrangler configs, so a doorbell wired to a queue nobody
  consumes fails a test rather than a customer.
  **A DUPLICATE RING IS HARMLESS BY CONSTRUCTION AND THAT IS `claim_run`'S PROPERTY, not
  the ringer's care**: a second delivery for a run already claimed or finished answers
  `not-claimable` / `already-finished` and does nothing. So an absorbed press is rung too
  — a first press whose ring failed left a row nobody had been told about.
  **A FAILED RING IS SAID, NEVER RAISED** (`notified: false`): the work is durable before
  that line runs, so answering an error would tell a customer their message failed when it
  is committed and will run. **The sweep is unchanged and is the recovery**, which is
  driven: a send whose doorbell throws leaves the work row claimable and the next pickup
  runs it.
  **MEASURED end to end: send → started → answered in 288 ms with no sweep involved**,
  driven by the ring ALONE (no cron, no hand-written deliver) in `verify:chat`'s section
  13. Locally, against a real PostgreSQL with these migrations.
- **The other two are the site builder's** (a poll that destroyed what was being typed,
  and a retry key that was not bound to its payload) and are recorded in the root
  `CLAUDE.md`. What touches this product is the transaction's new `mismatch` field: an
  absorbed press whose words differ from the stored ones SAYS SO, because a caller that
  reads a repeat as a plain success clears a box holding an edit nobody saved.

### Applied live, and verified by reading it back (2026-09-16)

**APPLIED to `ujrqdmmtcptvimazlhom`, recorded as remote version `20260916031604`**, and
the file is named for that. **VERIFIED BY READING IT BACK, not by the success flag**:
`send_to_agent` with **6 arguments** and `security definer` with `search_path=""`, the
thread view with **`security_invoker=true`** and 12 columns, the partial unique index,
`authored_run()` answering all eight bounds with `steps: 2` and `toolCalls: 1`,
`history_turns()` 20, EXECUTE for `service_role` and **not** for `authenticated`, `anon`
holding no SELECT on the view, and `public` still holding its 32 tables so nothing else
moved. `agent_messages` was empty before and after.

**⚠ AND A SECOND REMOTE RECORD EXISTS FOR ONE FILE (`20260916031852`), which is a
correction rather than a change.** The apply went through a tool that takes SQL as an
argument and the text handed over had comments trimmed — so the live bodies were correct
and did NOT match this tree byte for byte, which is the property this product verifies
deployments with. Closed rather than documented: the three function definitions were
re-applied VERBATIM and now match by md5 AND by length (`send_to_agent` 6,358 ·
`authored_run` 900 · `history_turns` 11). No second file — that would be a second copy
of the same DDL.

### PROVEN LIVE, in a real browser, and it found two defects (2026-09-16)

**16 checks, 0 failed**, driven with Chromium against `gofarther.dev` as a signed-in
throwaway account, after the migration, the engine deploy and the site deploy were all
in place. The account and every row it made were deleted afterwards (14 runs, 6 agents,
1 user).

| what was asked of the live screen | answer |
|---|---|
| a message appears in the conversation | **824 ms** |
| the agent's answer arrives | **7.9 s** from pressing send |
| the answer is `[simulated]` in its own text AND in the chrome | both |
| the answer quotes the instructions it was started with | yes |
| a half-typed next message survives the 2.5 s poll | the words, the caret AND the focus |
| a lost response is reported and the words kept | yes |
| an edited retry lands as its own message | yes |
| the box is cleared only because the edit really was saved | yes |

**THE DATABASE SIDE OF THE SAME RUNS**: 14 messages, **14 runs, all 14 answered, all 14
on `stand-in`**, 14 of 14 messages LINKED to their run, 14 of 14 `started` entries
carrying the instructions snapshot, 0 left queued, and **`attempts` never above 1** —
which is this product's own cleanest evidence that nothing executed twice.

**AND THE DOORBELL IS WHAT MADE IT SECONDS.** `sweep_run_work` runs on a one-minute
cron, so an 7.9-second send-to-answered cannot have come from the sweep. Before the
ring, the same press would have waited up to a minute.

**⚠ TWO DEFECTS THE LIVE SCREEN FOUND AND EVERY UNIT CASE MISSED, both in the composer
work added the same day, and both the same root cause: the fake `#agMsg` carried no
`data-agent`, so the composer read answered "no conversation" and wrote nothing.** *A
fixture less capable than the render it stands in for hides a defect exactly as well as
one that is more* — and this is the most expensive recorded instance of it here, because
the code being hidden was written to fix a different defect in the same function.

1. **A SUCCESSFUL SEND LEFT ITS MESSAGE IN THE BOX.** The draft is dropped on success,
   and the next render READ the box before redrawing it and wrote those words straight
   back into the draft it had just cleared. The next press would have sent the same
   message again. Fixed by emptying the textarea beside the draft; with that removed,
   THREE cases now go red (the new one plus two that had been passing vacuously).
2. **AND THEN THE CLEAR ATE A MESSAGE IT HAD NOT SENT.** The answer lands about a second
   after the press, so anybody typing their next message inside that second lost its
   first characters mid-word — measured live as twelve of them, leaving
   `"ake card payments"`. The clear is conditional on the box still holding exactly what
   was sent; anything else is somebody's new message.

**AND ONE READING THAT WAS THE TEST'S FAULT, kept here because it is a real property.**
A third run showed the box holding `sent + typed`: the product's own rule is that the box
is NOT cleared until the server has the message, so for about a second it still holds
what was sent and typing appends to it — and the clear then correctly refuses to remove
text it did not send. Two correct behaviours meeting, not a defect. The check types once
the send has confirmed, which is what a person does; *a test that fails for a reason the
product is right about is a test that has to change.*

### Not proven live, and the list is short

**EVERYTHING IS DEPLOYED, AND THE ORDER WAS NOT A PREFERENCE.** Before the engine went
out, `/health` answered `agents: ["support","slow","guarded"]` — no `authored` — so a run
accepted for a customer's agent would have come back `no-agent`. Read rather than
assumed, which is what fixed the order: **migration → this engine → the site builder**.
The engine now serves version `147fd716-a091-4c26-8e28-731d103971af` with
`agents: ["support","slow","guarded","authored"]`.

**No real model has been called and none can be**: the registry gives this agent the
stand-in and no tools. Everything a customer sees is labelled `[simulated]`, twice, and
both labels read the model recorded in that run's own log.

**WHAT REMAINS UNPROVEN** is a REAL PROVIDER (one `MODELS` entry plus a `send`), a run
longer than one consumer invocation against a real ceiling (the longest driven end to end
is 65.6 s), and `force row level security`, which is unverifiable where the harness owner
is a superuser.

## Milestone 2: the two workflow findings, closed (2026-09-17)

Both reproduced before anything was changed, and each proved RED against its own defect
while leaving the other's cases green — so they are independent rather than one bug.

**FINDING A — a restart immediately after checkpointing a false `if` lost the decision to
enter `otherwise`.** `jumpedToElse` was a bare `new Set()`, so the choice lived only in
the process that made it: the resumed run reached the `otherwise`, read the empty set as
*the first arm ran*, skipped the whole else arm and reported `done`. **The customer's
workflow ran neither arm and said it was fine.**

It is derived from the RECORD now — each `if`'s own stored outcome, found by that `if`'s
index and resolved through the branch map, so a stored list that no longer matches the
workflow cannot point at an arm that is not there. **AND THE RECORD MUST AGREE WITH THE
STEP IT SITS AT**: `took` is a field only an `if` can write, so an outcome recorded
against something else carrying one is not evidence about this branch. Refuse rather than
coerce — found by a guard case, not by review.

**FINDING B — validation accepted a reference to a value produced only in a branch that
may not run.** One flat set of every `out`, so a name bound under `if` was "available" to
the `otherwise` arm and to every step past the `end`; it saved cleanly and resolved to
nothing at run time on whichever path did not produce it. **A frame per open `if`, each
arm keeping its own additions, and only what BOTH arms produce survives the rejoin** — an
`if` with no `otherwise` contributes nothing, because the empty arm is a real path.

**⚠ AND THE SITE'S OWN VALIDATOR HAD THE SAME FLAT SET, which is the half that mattered
to a customer.** `cleanWorkflow` in the root's `agent-store.mjs` is the door a save really
goes through, and the engine's fix had not reached it: the two disagreed, and the loose
one was the one deciding what may be stored. It is a declared COPY (neither product may
import the other), so `test/agent-send.test.mjs` — the one file that may load both — now
**DRIVES the two over 22 shapes and requires the same verdict, the same sentence and the
same `produces`.** Comparing source could never have seen it; the two are written
differently on purpose.

**A SWEEP SURVIVOR FOUND A THIRD THING, in the fix itself.** Asserting only that a
cross-arm reference is refused was satisfied by the TYPO refusal — and for the commonest
shape of this mistake (bind under `if`, use it after the branch) the frame is popped by
then, so it said *nothing here produces it* and sent somebody hunting a misspelling that
is not there. `armOnly` remembers what a rejoin did not keep, **for the SENTENCE and
never for visibility**. Its neighbour disjunct was measured INERT over nine shapes
(`here()` is itself in `frames`) and deleted rather than left to read as a wall.

**THE INTERRUPTION MATRIX IS ONE CASE AND IT WALKS EVERY BOUNDARY.** One counter spans
the whole execution — not its first delivery, which was this case's own first mistake and
left the wait and the approval untouched — so cut N is the Nth place a deploy, an
eviction or a lost lease could really land. Each cut resumes from the persisted row alone
and must end where the uninterrupted run did, with **nothing completed run twice**,
proved by a mark nothing in the executor can write. `waiting` is deliberately left
unstamped: it is the step the next delivery re-enters, not completed work. **The boundary
count is DERIVED from the uninterrupted chain**, so the observer cannot go quiet as the
workflow grows a step.

**Measured**: engine suite 329 → 332; site suite 6,772 → 6,773; real PostgreSQL **569, 0
failed** (unchanged — the control that the database side did not move); `verify:auto` 70,
unchanged. **`verify:wf` 116 → 125**: a new section drives the branch boundary through the
REAL store, reads `took` back out of jsonb, proves from the journal that the `if`'s own
checkpoint really is a committed position, replays from exactly that state, and carries
the control that with the field gone it runs neither arm. **Engine sweep 306 → 316
spec entries; the site's 55 → 62.**

**⚠ AND THE SITE SWEEP LEFT ONE SURVIVOR THAT WAS A REAL GAP.** Its branch reader matched
`otherwise` by POSITION, and every nested shape in the census passed straight through it —
because when a reader answers only ok-or-error, the one shape that separates position from
depth is **a nested branch with an `otherwise` on BOTH arms**. Measured: the mutant refuses
that legal workflow at step 7. In the census now, killed on both sides.

---

## Milestone 3: an agent's own tools, on the operations the screen runs (2026-09-17)

`src/capabilities.mjs`, `src/capability-tools.mjs`,
`supabase/migrations/20260918000000_agent_capability_operations.sql` (**PREPARED, NOT
APPLIED**), and `scripts/verify-tools.mjs`.

**THE MILESTONE'S OWN WORDING IS THE TEST: *returning canned success messages does not
complete this*.** So every check in the demonstration reads the ROW back out of
PostgreSQL after the tool ran, never the sentence the tool returned.

**THE SHARED THING IS THE DATABASE, because it is what is available.** "The same
underlying operations as the frontend" cannot be a shared JavaScript module here — the two
products are separate Workers and `worker.js`'s module graph is a container image input,
so neither may import the other. One migration adds what both halves need: `owns_agent`,
`list_knowledge`, `read_knowledge`, `list_memory`, `save_memory`, `delete_memory`,
`list_automations`, `read_automation`, `set_automation_enabled`, `list_executions`,
`read_execution`. Each is `security definer` with `search_path` pinned empty, revoked from
`public`, granted to `service_role` ALONE — `authenticated` gets nothing, because these
take the tenant as an ARGUMENT and a customer who could call one could name somebody
else's account.

**⚠ THE TENANT AND THE AGENT ARE CLOSURES, NEVER ARGUMENTS.**
`makeCapabilities(...).forTenant(t).forAgent(a)` hands back the operations and **not one
of the fourteen takes either** — so a model, which writes tool arguments, has nowhere to
put one. It is the shape `store.mjs` already uses for runs. The runner applies both per
delivery, from the CLAIM (answered by `claim_run` in the statement that took the row) and
from the run's own first journal entry, which nobody can edit; **a run with no authored
agent gets no backend at all**, which is every verification agent and every run started
through `POST /runs`.

**AND A SECOND WALL THE DATABASE CANNOT PUT UP.** These functions are scoped to the
ACCOUNT because a person is entitled to their whole account; an agent is entitled to ITS
OWN. So a row naming a sibling agent answers the same "no such thing" a missing one does —
the wall no tenant filter can see, because both agents share an owner.

**TWELVE TOOLS, every one PUBLIC-scoped and in the catalog a customer ticks from**, and
the site's catalog gains them in PERSON-facing words (the engine's `description` is
written for a model deciding whether to call a thing; `label`/`does` for a person deciding
whether to allow it). **A tool with no backend refuses BY NAME** rather than answering as
though it had worked — the dead-control finding in its worst form, the control that
ANSWERS.

**⚠ STARTING AN AUTOMATION IS DURABLE AND NOT INSTANT, and the difference from the
screen's own button is deliberate.** A route rings the queue afterwards; a TOOL runs
inside the CONSUMER, and **the consumer never produces** — which is why its configuration
asks for the project and not for a queue binding. Making a tool ring would put a producer
inside the consumer. The cost is one cron tick: `accept_automation_run` commits the
execution and its work row together, and `sweep_run_work` offers an unheld row **with no
grace at all**. The answer says so, because a tool that implies "now" and means "shortly"
is one whose customer thinks it failed.

**`make_automation` AND `change_automation` ARE DELIBERATELY NOT OFFERED YET.** Writing a
workflow means writing STEPS, and a step list a model composes has to go through the same
`readWorkflow` a saved one does. The capability store already holds `createAutomation` for
the day it is wired, so the gap is one hop rather than a missing feature — and offering a
tool that saves a workflow nothing validated would be a control that answers and then
fails at the first execution.

### Three things the demonstration found that nothing else could

1. **THE STAND-IN READ THE FIRST USER MESSAGE, NOT THE LATEST.** Harmless while a
   conversation was one message long; the moment a second message reached an agent holding
   tools, **every later turn was answered against the opening question** — a run asked to
   list its sources searched them instead, for words typed two turns ago. `simulatedAnswer`
   has always quoted the LAST thing said, so the two halves of that file disagreed about
   which turn the conversation was on.
2. **IT READ `tool.input` WHERE A MODEL IS HANDED `input_schema`**, so it filled no
   arguments at all and `echo` answered about an empty string. *Written against the
   internal shape, delivered the wire one.*
3. **A `name` FOLDS CASE RATHER THAN REFUSING**, so the check written for a bad name was
   passing a good one. The fold is asserted positively now, beside a name no fold can
   rescue.

### Measured

- **`npm run verify:tools`: 57 checks, 0 failed, and 12 of 12 tools really called** —
  asserted as a CENSUS over the catalog, so a tool added next month cannot go
  undemonstrated in silence. The search really finds a price out of material a person
  saved; a memory the agent writes is the row the person's own screen reads back; an
  automation the agent turns off is off in the database.
- **⚠ AND SECTION 7 PROVES "THE SAME OPERATION" BY ITS OUTCOME rather than by its
  source**: the same fact saved through the screen's route and through the agent's tool
  leaves the SAME row but for who said so (`person` against `run`), the version rule is
  one rule through either door, and the two see the same sources and the same automations.
- **Real PostgreSQL (`npm run test:pg`): 569 → 604 checks, 0 failed.** Every refusal read
  for ITS OWN gate with a control beside it, the grants asked as a PRIVILEGE rather than
  as a refusal (`authenticated` holds no USAGE on the schema, so a refusal says nothing
  about the function grant), and all eleven proved `security definer` with
  `search_path=""` — **read off `pg_proc`, because Postgres stores the value WITH its
  quotes and the first write of that line reported eleven correct functions as broken.**
- **Engine suite 332 → 350** (`test/capabilities.test.mjs` 15, `authored-run` 38 → 40).
  Three were proved RED against their own defect.
- **Site suite 6,773**, and the census between the two catalogs is what caught the
  divergence the moment the engine gained tools the site did not offer.
- `verify:wf` **125**, `verify:auto` **70**, `verify:chat` **112** — all unchanged, which
  is the control that this round broke nothing.
- **⚠ AND THE SWEEP'S OWN SPOT-CHECK WAS THE WRONG INSTRUMENT, which is worth more than
  the tally it produced.** This line first read *"all 20 new mutants spot-checked and
  killed"*; the full pass then read **331 mutants, 326 killed, 5 survived**, and
  *"a narrow list can only produce a false SURVIVOR, never a false kill"* says both cannot
  be true. **The re-check was wrong, and this repository records the class.**
  `scripts/mutate.mjs` sets `MUTATION_SWEEP=1` on its child; the re-check did not, so the
  spec-anchor census — whose subject is the COMMITTED tree, which a mutant deliberately is
  not — failed for every mutant. MEASURED: the one failing test was `⚠ THE SWEEP SPEC'S
  ANCHORS ARE ALL STILL THERE`, for all five. A re-check that does not mirror the runner's
  child environment reports a kill for a reason that has nothing to do with the property,
  and **a false kill is worse than a false survivor, because it says a property is guarded
  when nothing asked.** The re-check now mirrors that environment AND NAMES the test that
  failed, so a kill can be read for its reason.
- **THE FIVE WERE REAL, AND EVERY ONE WAS A GAP IN THE NEW GUARDS.** `listExecutions`'
  sibling wall was undriven — `agent.list_executions` filters on the TENANT and the
  automation id and knows nothing about an agent, so that pre-check is the whole of the
  wall, and the case driving the other three sibling refusals never called it. A failed
  request read as an answer, which nothing asked because every case drove a backend that
  answers 200 — and `null` there would have `listMemory` telling an agent it remembers
  nothing during an outage. A `forget` of a name that was not there, whose mutant produced
  a self-contradictory answer nobody drove. And **TWO WIRING HOPS** — `run.mjs` dropping
  `opts.capabilities` and `worker.mjs` dropping the key on the way to `makeRunner` —
  either of which makes every capability answer `no-backend` while the run completes, the
  queue acks and the customer is told the agent knows nothing.
  ⚠ AND THE FIRST DRAFT OF THE SIBLING CASE PASSED VACUOUSLY: `"a1"` is not a UUID, so
  `readAutomation` refused on SHAPE before ever asking who owned it. Its control caught it.
- **Engine sweep spec 316 → 337, then 331 mutants, 331 killed, 0 survived, 0 never
  applied, 6 comment-only controls** on the pass after those five were closed. One
  pre-existing anchor was re-anchored, not appeased.

### What remains disconnected, and what the next milestone rests on

- **NOTHING IS APPLIED AND NOTHING IS DEPLOYED.** The migration is prepared locally. When
  it goes, the order is the recorded one — **migration → engine → site** — and here the
  reason is sharper than usual: the site's catalog ships the TICK, and a tick for a tool
  the live engine cannot run is a control that answers and is discarded.
- **No provider is connected and none can be.** Every conversation runs on the stand-in
  and every automation execution has no model at all; the demonstration asserts both.
- **`run_automation` is the one tool that is not repeatable**, because it mints an id per
  call — so a redelivery would start a second execution. **That is what milestone 5 is
  for**, and until it has an identity derived from its arguments the default that protects
  is the right answer.
- **Milestone 4 (permissions and approvals) rests on this**: the tool catalog, the
  per-agent selection and the closure boundary are what an approval would be bound to,
  and `agent.decide_automation_approval` already holds "only the first decision stands".

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
- ~~Whether runs are resumable across a process death~~ — **DONE**, see the
  journal and "Resuming a run" above.
- ~~Where a run executes once the request is over~~ — **DONE**, see "The durable
  queue" above. `ctx.waitUntil` is gone and the work is a row.
- **A run longer than one consumer invocation is resumed rather than run longer**,
  and that is the design — but it has **not been measured against a real invocation
  ceiling.** The longest run driven end to end is 65.6 s.
- **`force row level security` is still an untested claim** (see the correction
  above). Adding `agent.run_work` did not change that: it is only observable to a
  table owner who is not a superuser, and the harness's owner is one.

---

## Agent settings: a status, and which tools an agent may use (2026-09-16)

Owner: *"Agent settings: persist and edit its name, instructions, and active/paused
status… establish a server-controlled catalog of supported tools and an
agent-specific selection of allowed tools. Only show tools actually implemented…
the backend must enforce the agent's status and allowed tools. Instructions or
request bodies cannot grant capabilities… when a run starts, record the effective
instructions and allowed tools."*

**THE DIVISION THAT ALREADY EXISTED IS THE ONE THIS EXTENDS.** A customer owned the
INSTRUCTIONS; they now own the SELECTION too, and both are data, snapshotted into
the run's first journal entry. What they still cannot own is the CATALOG, the
bounds or the model — those are code in `src/agents.mjs`, and a name in a database
column resolves against them or resolves to nothing.

- **`OFFERED` IS THE CATALOG AND IT IS A POSITIVE LIST IN CODE.** `narrowTools`
  looks a selection's names up in the agent's OWN tools, so a name nobody put in
  that array is not a tool, whatever a request body, a column or an instruction
  sheet says. **It may only ever REDUCE** — the rule `narrowLimits` follows one
  module over.
- **`AUTHORED.tools` IS THE CATALOG, NOT THE PERMISSIONS, and `authored: true` is
  what says so.** For every other agent a tool list is what its runs get; for this
  one it is the most any run may have. **The flag is read from CODE and never from
  the log**, because `POST /runs` can name any registered agent with no snapshot at
  all and such a run must get NOTHING rather than everything.
- **TODAY THE CATALOG HOLDS `echo` ALONE, and that is the honest state of it.**
  `wait` and `commit` are implemented and are deliberately not offered: the
  stand-in answers them with the slow shape — `SLOW_ROUNDS` (8) tool calls —
  against an authored budget of two, so **measured, such a run stops
  `{reason: "spent", bound: "toolCalls"}` after one round and never answers.**
  Offering one would be offering a control that always fails.
- **⚠ AND THE BOUND HAD TO MOVE THE DAY A TOOL BECAME REACHABLE — MEASURED, not
  reasoned about.** `toolCalls` was ONE, chosen as "the smallest number that lets
  the run start" when the tool list was empty. It is a RUN TOTAL and `stoppedBy`
  asks `used >= limit`, so one is a budget already spent the instant one call is
  made: **an authored agent holding `echo` stopped
  `{reason: "spent", bound: "toolCalls", limit: 1, used: 1}` after its tool call
  and never reached the step that answers.** Zero let the run not start; one let it
  not finish. It is **2**, and `steps` is **3** by this file's own older rule — the
  one-tool shape really takes two steps, and a bound that is exactly the happy path
  cannot tell the ordinary path from something having changed.
- **THE SNAPSHOT IS READ AGAIN ON EVERY DELIVERY, exactly as the instructions
  are.** A customer who unticks a tool while a run is going changes what the NEXT
  run may call and never what this one may call. `startedEntry` carries `tools`
  **present or absent, never null-as-a-value**: absent means "not an authored run",
  `[]` means "an authored run allowed nothing", and `replay` reads a `tools` it
  cannot parse as a PROBLEM — a run whose permissions are unknown is not resumed at
  all.
- **A RETIRED TOOL IS NAMED, NEVER DROPPED IN SILENCE.** `narrowTools` answers
  `{agent, unknown}` and the runner logs `tools-gone`. A filter is a silent drop; a
  check is a sentence.
- **⚠ AND THE STAND-IN'S TOOL-USING ANSWER WAS UNLABELLED.** It answered
  `stand-in answer. you said: …` with no `[simulated]` in it at all — invisible
  while only verification agents reached that branch, and a customer-facing
  unlabelled answer the moment a selection could put `echo` on an authored run. The
  chrome's chip would still have said Simulated and the TEXT would not, and the text
  is the half that survives being copied into an email. All three terminal answers
  carry it now, and **a failed tool call is reported as a refusal rather than as the
  tool's own reply** — `toolResultFor` puts the error in the same `result` field, so
  a reader that ignores `ok` makes a blocked tool read exactly like a working one.

### The database half

`supabase/migrations/20260916085453_agent_settings_status_and_tools.sql` — named for
the REMOTE version the apply reported back, as this folder's README requires.

- `agent.agents` gains `status` (`active | paused`, default `active` — **not a
  guess**: an agent written before this column is one its owner expects to answer)
  and `tools text[]` default `{}`.
- **THE CONSTRAINT BOUNDS THE SHAPE AND THE CATALOG DECIDES THE MEANING.** At most
  32 names, no NULL among them, each matching the provider's own grammar
  (`[a-zA-Z0-9_-]{1,64}`, mirrored from `TOOL_NAME`). It deliberately does NOT
  enforce that a name is a real tool (a CHECK cannot read code) or that the names
  are distinct (a CHECK cannot hold a subquery, and a duplicate is harmless because
  every reader builds a Set). **One stated limit**: the charset is checked over the
  names JOINED BY COMMAS, so an element containing a comma reads as two and passes
  — which is not a hole, because such a name matches no catalog tool.
- **`agent_overview` gains both AT THE END, and Postgres requires it rather than
  preferring it**: `create or replace view` may only APPEND columns. Tidying that
  order is a broken deploy.
- **THE ORDER IN `send_to_agent` IS THE WHOLE OF THE PAUSE'S CORRECTNESS.** The key
  is asked as a READ first, so a retry of a press that already landed is absorbed
  **however the agent is configured now**; only then is the status asked, and a
  paused agent is refused with **nothing written at all** — no message, no run — so
  the words stay in the box and the browser's retry key is still this press's key.
  The probe decides only whether to refuse; the `on conflict` clause is still what
  decides whether a message is written, because a read cannot see a twin in another
  transaction.
- **ONE COPY OF THE ABSORBED ANSWER, and it was two.** The probe and the race reach
  the same fact and answering it twice meant two objects that could disagree — and
  it made two of this repository's own SQL mutants ambiguous, which is the same
  defect wearing a sweep's clothes.
- `agent.authored_run()` carries the new bounds, **still censused both ways**
  against the registry. That census is what turned the bound change from a number
  somebody might have forgotten into a red run.

### What was measured

- **Real PostgreSQL 16 (`npm run test:pg`): 365 → 410 checks, 0 failed.** The
  defaults on an insert that names neither column; every refusal the shape
  constraint makes, each read for ITS OWN gate, with four controls; the selection
  reaching the run's entry and surviving an edit afterwards; the paused refusal
  writing nothing; the retry absorbed while paused; the run accepted before the
  pause still on the queue with its log intact.
- **`npm run verify:chat`: 67 → 94 checks, 0 failed** — the whole flow against a
  real database through the real routes. Settings saved, re-read by a fresh list
  call, and held in the database; the account next door seeing neither the agent nor
  its settings and getting the same 404 a missing agent gets; a paused agent
  refusing while its conversation stays whole; a run accepted before a pause
  finishing; **a selected tool really executing** (the journal holds its `tool`
  entry and the answer says which tool ran) **with the setting taken away between
  the accept and the run**; and a made-up tool name refused by name.
- **Suite 256 → 272**, `authored-run.test.mjs` 21 → 37. **⚠ THE COMMIT MESSAGE FOR
  `d47aa10` SAYS 274 AND IS WRONG; 272 is the measured number and this line is the
  one to trust.** Re-derived per file rather than recalled — 14 + 36 + 37 + 14 + 6 +
  10 + 19 + 20 + 2 + 32 + 25 + 25 + 12 + 20 — and the likely slip is counting two of
  `pg-schema.mjs`'s checks into it, which `test/*.test.mjs` does not match at all. A
  commit message cannot be corrected once pushed, so the correction lives here.
- **Sweep: 23 mutants, 23 killed, 0 survived, 0 never applied, 3 comment-only
  controls survived.** Nine survived the first pass and **every one was a gap in the
  new guards**; one more was measured INERT and replaced. Two things worth keeping:
  - **`narrowTools` taking the SELECTION'S order was inert given today's catalog**
    — one tool, so both orders are the same list. Closed with a two-tool agent built
    by hand, because the property is about the list the provider is shown.
  - **`defineAgent`'s `=== true` and the refusal above it are a DECLARED PAIR.**
    Measured: with the refusal in place the only inputs reaching that line are an
    absent key or a real boolean, and `!!` answers identically for all three. The
    mutant on that line is the DIRECTION instead: `!== false` makes an absent key
    mean authored, which narrows every code agent against its own tool list.
- **SQL sweep (`scripts/sql-sweep-spec.mjs`, 92 → 105 mutants): the twelve new ones
  run against a real PostgreSQL — 12 mutants, 12 killed, 0 survived, 0 never
  applied, 5 comment-only controls survived.** One survived the first pass and it
  was the racing-twin branch, which **the probe makes reachable only under real
  concurrency**: a second press in the same call finds the row on the READ and
  returns before the insert. Closed with a real second session — a twin that inserts
  and holds its transaction open, so the probe sees nothing, the insert blocks on the
  unique index, and `on conflict do nothing` is the only thing between one message
  and two. **Its fixture collided with an id three hundred lines up** (`…ee0b` was
  already `SBMSG`), so its first run read somebody else's row and reported a correct
  product as broken; the ids are its own now and the case asserts they are unused
  before it starts.
  **FIVE OF THAT SPEC'S OWN ANCHORS WENT STALE IN THIS CHANGE** — `send_to_agent`
  was restructured and `authored_run`'s bounds moved to a later migration — and
  every one was re-anchored onto what moved.
- **⚠ AND THE SWEEP SPEC ITSELF HAD A STALE ANCHOR NOBODY COULD SEE.**
  `runner: a run whose agent is gone is retried for ever` was anchored on
  `if (!agent)`, which the runner renamed to `registered` some time ago — so that
  mutant was NOT FOUND and the property unswept, silently, because **the
  generator's own pre-check only runs when somebody runs a sweep**. There is a case
  for it now (`THE SWEEP SPEC'S ANCHORS ARE ALL STILL THERE`), and it **skips under
  `MUTATION_SWEEP`** — measured, because while a mutant is applied its own anchor is
  gone by construction, so the check failed for every mutant and reported every one
  as KILLED. A false kill is worse than a false survivor: it says a property is
  guarded when nothing asked. **The tell was all three comment-only controls coming
  back killed at once.**

### ⚠ …AND THE CREATE PATH DROPPED THE STATUS — the shim was the second half (2026-09-16)

Owner: *"the form currently offers it, but creation ignores it and saves the agent as
active."* The defect is the site builder's route and is recorded in the root
`CLAUDE.md`; **what belongs here is the instrument.**

**`scripts/local-rest.mjs` COULD NOT HAVE CAUGHT IT, because it wrote a FIXED COLUMN
LIST.** Its agents POST named `(id, tenant_id, name, instructions, tools)` and nothing
else, so a `status` the route really sent would have been dropped by the shim exactly
as the route was dropping it — *a shim LESS capable than the thing it stands in for
hides a defect precisely as well as one that is more*, and this is the second instance
of that in this file after the `run_model` column the view did not have. Its comment
even quoted the route's old rule back, which made the gap read as intentional.

It now builds each VALUES row per column, with `default` where the caller named
nothing — which is what PostgREST does and is the whole of *"active only when status
is omitted"*: the DATABASE decides, never the shim and never JavaScript. A mixed batch
stays one statement.

**MEASURED, after the runs rather than before them: `npm run test:pg` 410 → 416 checks,
0 failed, against a real PostgreSQL 16; `npm run verify:chat` 94 → 112 checks, 0
failed.** The six are an INSERT that names `status` (the create's real shape) beside the
one that names neither column — the pair is what separates "the default is active" from
"the column takes an answer at creation" — the selection it was created with, the
refusal of a junk status at INSERT with no row made, and the observer-alive line the
re-anchor below needed. The eighteen are section 17: an agent CREATED paused, read back
by an ordinary list call, refusing a send with nothing written, then accepting **the
same press under the same key** once activated and really running; with the control that
an agent created naming no status is active and takes work at once, and the junk status
refused. Both arithmetics close exactly.

**ONE OLDER CHECK WAS RE-ANCHORED, NOT APPEASED.** The overview's tenant check read
`count(*) === "1"`, which is a claim about how many fixtures this file happens to have
paused — adding one made it red for a reason that has nothing to do with tenancy. It
names the ROWS now, against the set `t1` really owns, with its observer proved alive:
strictly stronger than the number it replaced.

**THE MIGRATION IS UNTOUCHED, so the deployment order below is unchanged.** The column,
its default and its check constraint were right all along; nothing above the database
was asking for them.

### The deployment order, and it is one-way

**THE MIGRATION GOES FIRST, and this one really is order-critical.** The site
builder's list read asks for `status,tools` by name, so against a view that has not
got them PostgREST answers 400 and every account's agent list fails — not
degraded, refused. Apply the migration, then deploy.

**THE TWO WORKERS ARE ORDER-FREE ON PERMISSIONS, checked rather than assumed.** If
the site builder deploys first it starts writing `tools` into new entries and an old
engine ignores the key, handing those runs `AUTHORED.tools` — which in the old engine
is `[]`, so they get nothing, which is what they would have got anyway. If the engine
deploys first it narrows against entries that carry no `tools`, which is `[]` by the
fail-closed default. **Neither order widens anything**, and that sentence is about
permissions only.

**⚠ AND ON HONESTY THEY ARE NOT ORDER-FREE AT ALL — THE ENGINE GOES FIRST
(2026-09-16).** The paragraph above stopped one question short: it asked whether an
order could WIDEN a permission and never whether one could make the screen lie. Site
first does. The settings form's tool checkboxes are what that deploy ships, so from
the moment it lands a customer can tick `echo`, the save succeeds, the list draws the
tick — **and the live engine hands every authored run `tools: []` and ignores the
snapshot entirely**, because `narrowTools` and `OFFERED` are not in it. A control
that answers and is discarded is this repository's own worst shape of the
dead-control finding, and it is the *exact* defect this round was opened to fix. So
shipping the site first would reintroduce it one product over, in the same week, for
however long the two deploys were apart.

**ENGINE FIRST IS A MEASURED NO-OP, which is what makes it the safe half of an
asymmetry rather than a preference.** Until the site ships the control nobody can set
`tools`, so every row holds the column's `'{}'` default, every entry records `[]`, and
`narrowTools(agent, [])` offers nothing — byte for byte what the old engine's
`AUTHORED.tools: []` already does. **The order rule is therefore: whichever side
DECIDES a thing must not go out before the side that ACTS on it.** The migration is
first for a different reason again (a 400, not a lie), so the full order is
**migration → engine → site**, and the three reasons are three different failures.

**LIVE, AND THE THREE ARE SEPARATE CLAIMS — a paragraph that lumped them would be
one claim standing in for three.**

**1. The migration** — remote version `20260916085453`, applied and read back
byte-identical to this tree, while the account held zero agents and zero messages.

**2. The engine — `agent deploy` run 27 on `54b29a4`, 09:30:58→09:38:19Z, all
thirteen steps green.** `deploy the agent Worker` → `upload the one agent runtime
secret` → `re-deploy, so the code and the secret are one version` printed *the
version that must be serving:* **`ece0a067-db5b-4410-ab63-61bd088a7bc7`**;
`wait for THIS version to answer` read `attempt 1: version=ece0a067… ok=1` and
`serving ece0a067…, and configured.`; `verify the deployment` ran **71 checks, 0
failed** against the deployed Worker over five real runs (`long`, `exclusive`,
`handover`, `guarded`, `fence`) — including `THE OLD CONSUMER'S WRITE FAILS —
{"ok":false,"why":"not-holder"}`; and the cleanup read `13 users listed, 0 left by
a verification`. `Uploaded agent-builder-api (1.67 sec)`, `Total Upload: 90.76 KiB
/ gzip: 25.23 KiB`, `Worker Startup Time: 6 ms`.
**READ BACK FROM A SECOND PROCESS**: `/health` answers that version, `deployedAt
2026-09-16T09:31:32.897135Z`, `ok: true`, `modelKnown: true`, `missing: []`, the
same four agents.
**⚠ AND THE VERSION ID IS THE ONLY DISCRIMINATOR AVAILABLE HERE, which is worth
saying rather than glossing.** `src/worker.mjs` is byte-identical between
`6aec0ad5` and `54b29a4`, so `/health`'s SHAPE could not move and carries no
`tools` key either way — a diff against the pre-deploy baseline is exactly two
lines, the version and its timestamp. What makes it evidence is the CHAIN: run 27
ran on that sha, wrangler deployed from that checkout, that deploy printed
`ece0a067`, and `/health` answers `ece0a067`. A check that cannot tell two things
apart is not made stronger by wanting it to.

**3. The site builder** — deploy **2130**, `main` `f22c166` → `54b29a4`, green in
2m49s, the container rolled `62c2700fa8c843c2` → `d927ff27fd186f30` at 09:43:09.99Z
and both served assets are byte-identical to the merged tree. The site builder's
own CLAUDE.md has that half in full.

**NOT PROVEN LIVE: a customer ticking a tool and watching it run.** Signing in as
the building account needs `SUPABASE_SERVICE_KEY`, which lives only in GitHub
Actions, so the end-to-end press is the owner's — the same wall every paid harness
in this repository meets. Each layer is established on its own instead.

## Automations: trigger → condition → action → saved result (2026-09-16)

Owner: *"Build one complete automation that a customer can configure and run"*, and
first: ***"inspect the existing engine, queue, scheduler, and frontend so we reuse
what exists."*** That inspection is what decided the shape, so it is written down
before the feature is.

**THE DURABLE EXECUTION SYSTEM IS FOUR GENERIC PIECES AND ONE SPECIFIC EXECUTOR.**
The queue (`agent-runs`, a doorbell carrying `{runId}` and nothing else), the work
row (`agent.run_work` — claim, lease, token, attempts, done), the fence
(`agent.append_entry`) and the recovery (`agent.sweep_run_work` on the one-minute
cron) know nothing about agents. Only `runAgent` does. **So an automation execution
IS a run** — `agent.runs` + `agent.run_work` + a `started`/`stopped` pair in the
journal — and it reuses claiming, leasing, fencing, sweeping and the doorbell
UNCHANGED. Nothing was added to the journal's vocabulary: `replay` reads an
execution's log cleanly (0 steps, no problems), which is the measurement that says
the reuse is real rather than asserted.

**⚠ `run_work.executor` IS THE DISCRIMINATOR, AND `run_work.kind` COULD NOT BE.**
`requeue_run` sets `kind = 'resume'` unconditionally, so `kind` says *why a row is
outstanding* and never *what it is* — an automation resumed once would have been
routed to the agent loop, and only on a resume, which is the worst shape of defect
this repository records. `executor` is a column with the default `'agent'`,
answered by `claim_run` **in the same statement that says whose the work is**, and
set to `'automation'` by `accept_automation_run` **inside the accepting
transaction**, so there is no instant at which a consumer could claim the row and
route it wrongly.

### The step format, and what it has to carry before there are steps worth having

`src/automations.mjs`. `defineStep` compels four parts plus two functions — `type`,
`kind` (`condition | action`), `label`, `does`, `fields`, `read`, `run` — and
THROWS if any is missing, so a step cannot ship as a description with no way to
configure it. **`fields` is what the screen draws**, which is why it is compelled:
a step the catalog offers and the form cannot render is a dead control.

Two steps this milestone: `weekday` (a condition) and `note` (an action). Both run
with **no model call at all**, which is the owner's *"This should work without any
model call"* and is also what makes the whole path cheap enough to drive in a test.

- **A CONDITION THAT DOES NOT MATCH IS `skipped`, NEVER `failed`**, and so is every
  step after it — with a `why` that says which of the two happened, because "an
  earlier condition didn't match" and "an earlier step didn't work" are different
  things to read. The stop's `reason` is `done | skipped | failed`.
- **EVERY STEP GETS AN OUTCOME, including the ones that never ran.** A workflow
  reporting three of five outcomes is a workflow whose reader has to guess.
- **`runWorkflow` NEVER THROWS.** A step that throws becomes that step's outcome.
- **WHICH DAY IT IS, IS ASKED OF THE EXECUTION AND NOT OF THE CLOCK.** A scheduled
  execution carries the local DATE it is an occurrence of, so a catch-up delivery at
  00:30 on Tuesday still asks about the Monday it was FOR. Without it, "every
  Monday" would mean "every Monday the delivery happened to land on".
- **NO ZONE MEANS UTC, AS A CONSTANT AND NEVER AS THE RUNTIME'S LOCALITY.** This
  machine resolves `Intl` to UTC, so the two are indistinguishable here — the guard
  moves `process.env.TZ` to `Asia/Tokyo` and asserts the answer does not follow, with
  the control that a NAMED zone still is honoured. A sweep survivor is what said the
  original assertion could not see it.
- **A STORED STEP TYPE THIS DEPLOYMENT NO LONGER HAS `fails`, it is not skipped.**
  Skipping runs a DIFFERENT workflow from the one somebody saved and reports it fine.
- **`readWorkflow` MINTS THE STEP ID FROM THE POSITION and refuses by name rather
  than shortening.** A workflow quietly missing the step it could not read is a
  workflow that looks saved and does something else.

### The whole execution is one transaction, so there is no step-level fence

`finish_automation_run` writes the outcomes and the `stopped` entry together,
through `append_entry` — the same fence every journal write goes through — and then
releases the work. **The execution is already released by the transaction that
finished it**, so the runner does NOT call its ordinary `finish`: doing so would be
a second release of a claim the database has cleared.

**THE STEP THAT CHANGES THIS IS A `wait` OR AN `approval`**, which is stated now
rather than discovered later: a workflow that can pause between steps needs each
step's outcome durable on its own, and that is a per-step `append_entry` and a
`pending` shape the journal does not have yet. Everything else on the roadmap — app
actions, branches — fits the one-transaction shape as it stands.

### The scheduler rides the cron that already exists

`worker.scheduled` gained a SECOND job and a SECOND `try` block. **Two jobs, two
blocks, and neither can silence the other**: the sweeper is the recovery for every
dropped run in the deployment, and a scheduler that threw would take it down with
it — a broken schedule stopping the thing that fixes everything else.

**IT RE-USES THE CRON RATHER THAN ADDING ONE.** The tick already runs every minute
because the lease is 90 seconds; a daily schedule needs nothing finer, so a second
trigger would be a second thing to configure for no gain.

**THE FUNCTION FILES AND THE WORKER RINGS.** `tick_automations` accepts what is due
in the database and answers one row per automation touched; the Worker's only job
afterwards is the doorbell. **Only an `action === "filed"` row is rung** — a missed
or refused occurrence is already finished and has no work row at all, so ringing for
one would be a doorbell for a run nothing will ever claim.

### Reliable scheduling: three separate problems, three separate answers

1. **DUPLICATE DELIVERIES LOSE IN THE DATABASE.** The occurrence key is the LOCAL
   DATE in the automation's own zone, and `automation_runs_one_per_occurrence` is a
   partial unique index on `(automation_id, occurrence) where occurrence is not
   null`. Two ticks, a redelivered tick and a hand-run of the same minute all arrive
   at `accept_automation_run` and every one of them loses on that index with its
   insert a no-op. A check in the scheduler would be a race wearing a wall's clothes.
   **The partial clause is what keeps "Run now" meaning what it says**: a manual run
   has no occurrence, so two presses are two executions.
2. **TIME ZONES AND DAYLIGHT SAVING ARE ONE FUNCTION.** `automation_next_at` is the
   only place the arithmetic lives — a local date plus a local time, resolved through
   the zone — so a 09:00 London schedule is 08:00Z in summer and 09:00Z in winter
   with the row unchanged. A local time inside the spring-forward gap still answers an
   instant, because a schedule that stops for ever on one day a year is worse than one
   that runs an hour out.
3. **DOWNTIME IS NOT A BURST.** `next_run_at` advances to the first occurrence after
   NOW rather than to the one after the occurrence just handled, so a week away
   produces ONE record — `action: "missed"`, with how many occurrences went by,
   COUNTED IN LOCAL DATES rather than by dividing an interval, because a local day is
   23 or 25 hours long twice a year. `AUTOMATION_CATCHUP_S` (3600) is the line between
   "late enough to still run" and "too old"; `AUTOMATION_TICK_LIMIT` (25) bounds one
   tick. **A missed occurrence is RECORDED, not skipped**: an account that was away
   and then sees nothing in the history cannot tell that from an automation that never
   worked.

### Control and isolation

**DISABLING AN AUTOMATION OR PAUSING ITS AGENT PREVENTS NEW EXECUTIONS, and ⚠
NEITHER REFUSAL WRITES ANYTHING** — not the execution, not a run, not a work row.
Both are how an account says "not now", and turning one back on must not find work
nobody asked for waiting in the queue. The two are ONE READ (`automations` joined to
`agents`), because the question that matters is about the two of them together and a
second statement is something a pause can land between.

**ALREADY-ACCEPTED WORK KEEPS ITS RECORDED CONFIGURATION.** `automation_runs.steps`
and `.zone` are copied in at acceptance and the runner reads THEM, never
`agent.automations` — the same rule the instruction snapshot follows one executor
over. An edit reaches the next execution and never this one.

**OWNERSHIP IS ENFORCED WHERE THE WRITE HAPPENS.** Every function takes the tenant
and puts it in the lookup, so another account's automation and one that does not
exist are the same answer (`no-automation`). RLS is the belt: policies keyed on
`agent.tenant_id()` on both tables, `authenticated` granted SELECT and nothing else,
and `agent.automation_history` is `security_invoker = true` — **without which the
view runs as its OWNER and is a hole through both policies.**

### ⚠ What went wrong, and every one was found by driving rather than by reading

1. **`work.claim` NEVER FORWARDED `executor`.** The column was right, the migration
   was right, `claim_run` answered it, the runner's routing branch was right — and
   every automation delivery answered `no-agent`, because the one hop between them
   dropped the field. **The unit guard could not see it: its fake `work` returned
   `executor` directly, so the fixture was MORE capable than the real producer** in
   the function whose defect it was hiding. Found by the real dispatcher. *The wiring
   layer, for the thirteenth-odd time in this repository, and the fixture trap in the
   same breath.*
2. **THE FOREIGN KEY HAD TO BE DEFERRED, and only a real database said so.**
   `accept_automation_run` probes the occurrence — inserting into `automation_runs` —
   BEFORE `accept_run` creates the `agent.runs` row, because the probe is what makes
   the duplicate lose. With the FK checked per statement every accept failed. It is
   `deferrable initially deferred`, so it is checked at COMMIT: an execution naming no
   run is still impossible, and the order is free.
3. **THE ZONE BELONGS TO THE AUTOMATION, NOT TO ITS SCHEDULE.** The first draft put
   `zone` under the daily-only constraint. A manual automation has no schedule to
   carry one, so "only on Mondays" on a Run-now automation would have meant Monday in
   UTC, silently.
4. **`MAX_NOTE` WAS DECLARED BELOW THE STEP THAT READS IT.** `fields` is evaluated at
   DEFINITION time, unlike a `run` body, so the module threw on load — the temporal
   dead zone, in the one position `node --check` cannot see.
5. **`deliverAutomation` WAS DECLARED AT THE WRONG SCOPE**, assigning `held` and
   `lostBecause` and calling `stopBeating`, all of which are `deliver`-local. `node
   --check` passed and it would have thrown on the first delivery.

### The fixtures had to get more capable, twice

**`test/helpers/memory-rest.mjs` GAINED THE AUTOMATION SIDE** — the two tables, the
three RPCs, and `executor` on the work row — because four sweep mutants survived in
`worker.scheduled` with every module correct: the cron filing nothing, ringing for
occurrences that were never queued, an unbounded catch-up window, and a runner built
with no automation executor. **Every one of them lives in the handler nothing in the
test directory drove.** *A wall nobody can drive is a wall nobody is guarding*, in
the code that decides what happens to a customer's schedule after downtime.
**WHERE THE FAKE IS DELIBERATELY LESS CAPABLE IT SAYS SO**: the DST arithmetic is
not re-implemented there — that is proved on a real PostgreSQL, and a JavaScript copy
of it would be a second version of the one thing this repository proved on the engine.

**AND THE `defineStep` FIXTURE WAS VACUOUS.** It deleted each key of a `whole` spec
in turn and asserted a throw — and `whole` had no `fields` at all, so every variant
threw for the ABSENT `fields` rather than for the deleted key: seven assertions, none
of them about what it said, and `fields` never compelled. A sweep mutant making
`fields` optional is what found it. **The fix is the CONTROL**: the whole spec must be
ACCEPTED first, or "a step with no X is refused" is satisfied by a spec refused for
some other reason.

### What the demonstration really drives

`npm run verify:auto` (`scripts/verify-automations.mjs`) drives **`worker.queue` and
`worker.scheduled` themselves**, against a real PostgreSQL with these migrations
applied and a local PostgREST stand-in — not a hand-built runner, which is precisely
what would have hidden the `executor` hop. Nine sections, in the order the owner
named them:

1. a manual run, end to end: accepted → rung → claimed → the workflow → the outcomes
   and the stop in one transaction;
2. a scheduled run, through `tick_automations` and the real cron handler;
3. duplicate delivery at BOTH ends — the same queue message twice (the claim refuses
   the second) and the same occurrence twice (the index refuses the second);
4. a condition that does not match: `skipped`, with every later step skipped and a
   reason that says which kind of skip it was;
5. disabling an automation, and pausing its agent;
6. account isolation — another tenant's automation is `no-automation`;
7. editing a workflow AFTER a run was accepted: the accepted one keeps what it had,
   the next one gets the edit;
8. missed occurrences after downtime: one record, counted, no burst;
9. what the run left behind — the journal reads back cleanly through `replay`, which
   is the measurement that says an automation execution really is a run.

### Measured

- **`npm run verify:auto`: 68 checks, 0 failed**, with the final tally across the
  fixtures reading `done=5 missed=1 paused=1 skipped=1`.
- **Real PostgreSQL 16 (`npm run test:pg`): 417 → 495 checks, 0 failed.** The 78 are
  the automations section — the once-per-occurrence index with its control, the
  deferred FK proved by a COMMIT-time refusal, both refusals writing nothing, the
  snapshot, the fence, the DST pair, the catch-up and the advance, and the invoker
  view read from both accounts. **Both numbers are runs of this file**: 417 is the
  pre-change tree, measured by checking the parent's copy out and running it, rather
  than taken from the last stamp.
- **Engine mutation sweep: 261 mutants, 261 killed, 0 survived, 0 never applied, 6
  comment-only controls survived.** Pass 1 killed 253 with **eight survivors, and not
  one of them was the product's** — four were the `worker.scheduled` block nothing in
  the test directory drove, two were guard gaps (`defineStep`'s vacuous fixture, the
  store's unreadable `steps`), one was the snapshot's zone and occurrence, and one
  (`no zone guesses the runtime's own locality`) was INERT on this machine and was
  closed by moving `process.env.TZ` rather than by hunting it.
- **Engine suite 306**, 0 failed (299 before this round; +5 `worker`, +2 `automations`).
- **SQL mutation sweep over the migrations**: pass 1 read 123 mutants, 121 killed, 2
  survived, 6 controls. **Both survivors were this file's own gaps and both were real**
  — see the probe's own comments — and closing them took the real-Postgres check from
  487 to **495**.

### AND IT IS ALL LIVE — the scheduled path ran through the real cron (2026-09-17)

Owner: *"Merge carefully"*. **THE ORDER WAS THE WHOLE RISK, and it is
migration → engine → site**, each first for its own reason: the migration because the
engine's cron calls `tick_automations` every minute and the site's list route reads
`agent.automations`, and the engine because a form that saves a step no executor can
run is *a control that ANSWERS, wrongly* — the exact defect the settings round was
opened to fix. The site's half is in the root `CLAUDE.md`.

**1. THE MIGRATION — remote version `20260917003304`, and the file is renamed for it.**
Applied while `agent.agents` held ZERO rows, so no customer's data was anywhere near it.

- **GOING BEFORE THE ENGINE WAS CHECKED, NOT ASSUMED.** This migration redefines
  `agent.claim_run`, which the LIVE engine was calling at the time. Read back with
  `pg_get_functiondef` first: the live body was byte-for-byte the new one MINUS the
  `'executor', v_row.executor` line and its comment. Same signature, one field more —
  so the deployed engine could not notice, and the ordering question had an answer
  instead of a hope.
- **WHAT IS LIVE WAS PROVED EQUAL TO THE FILE, BY EXECUTION.** The connector is the
  only way in from a session, so 57KB of SQL had to be authored in a tool call. The
  whole-line comments OUTSIDE dollar-quoted bodies were stripped mechanically
  (Postgres stores none of them) and the result was proved equivalent by giving two
  throwaway local databases one version each and comparing **357 objects — identical**.
  The strip's toggle is valid because it was MEASURED: the only tag in the file is
  `$$`, it occurs 20 times on 20 distinct lines, and no comment inside a body carries
  a `$`. A hand-rolled dollar-quote parser is this repository's "flat scans where
  depth matters" trap, and the first attempt at one failed exactly that way.
- **THE READ-BACK GATE IS NARROW ON PURPOSE.** 10 function definitions by md5, every
  column of both tables and the view plus `run_work.executor`, every index, both
  policies, every check constraint, the RLS flags, the trigger, and the view's
  `reloptions` where `security_invoker` lives: **82 objects, md5
  `976acfa04457bc8242958900e51d8284`, identical on all three** — the committed file
  locally, the stripped file locally, and the live database.
  **A census over the WHOLE `agent` schema is the WRONG instrument and was tried
  first**: it counts roles and grants the two environments legitimately differ on (342
  rows live against 357 locally), so it cannot tell a transcription slip from Supabase
  holding more roles than a fresh cluster. Narrow, or it says nothing.
- All 24 existing `run_work` rows read `executor='agent'` after it, which is what they
  already meant, and `tick_automations(3600, 25)` answered 0 rows rather than raising
  — a live smoke of the function the cron was about to call every minute.
- **PostgREST resolved all four relations before the site shipped**: `agent.automations`,
  `automation_runs`, `automation_history` and `agents` each answer **`42501 permission
  denied for schema agent`** to the publishable key — the schema-grant wall, NOT
  `PGRST205`, with the pre-existing `agents` as the control. That is the check that
  says the site's routes will not 400 on a relation the cache has never seen.

**2. THE ENGINE — `agent deploy` run 35 on `31efcc7`, all thirteen steps green.**
Version `ef0645d7-fa33-4bf9-afb5-f319b95af51d`, `deployedAt 00:36:32.643217Z`, which
lands inside the run's own re-deploy step (00:36:30→00:36:34Z). The live verification
ran 00:36:45→00:44:06 (**7m21s**) and read **71 passed, 0 failed** over five real runs
(long, exclusive, handover, guarded, fence); the throwaway customer was deleted and the
cleanup read `13 users listed, 0 left by a verification`.
**THAT SUITE DOES NOT TOUCH AUTOMATIONS**, which is said rather than glossed — it is the
pre-existing fencing verification. What proves the automation half is below.

**3. THE SCHEDULED PATH RAN LIVE, THROUGH THE REAL CRON AND THE REAL QUEUE.** A
throwaway tenant, two automations created through the REAL `agent.create_automation`
(not inserts of our own) and made due, then left alone for Cloudflare's own
`* * * * *` trigger to find. Both came back `run_status: stopped`, `finished`, with
`executor: automation` on their work rows:

| automation | stop | outcomes |
|---|---|---|
| `Runs today` (all seven days) | `done` | `weekday: ran` — *"Thursday is one of the days this runs on"*; `note: ran`, result *"the live scheduled path reached the note step"* |
| `Mondays only` (on a Thursday) | **`skipped`** | `weekday: skipped` — *"Thursday isn't one of the days this runs on"*; `note: skipped` — *"an earlier condition didn't match, so this one didn't run"* |

- **A CONDITION THAT DOES NOT MATCH READS `skipped`, NOT `failed`** — the owner's
  requirement 4, live, in the customer-facing view.
- **THE JOURNAL IS A RUN'S**: `started` at seq 0 (`agent: automation`, **`model:
  none`** — not `stand-in`, so nothing wears a "simulated" label) and `stopped` at seq
  1, one stopped entry each. That is the measurement that says an automation execution
  really IS a run.
- **NO BURST**: both advanced to `2026-09-18 00:44:00+00` — tomorrow's occurrence,
  exactly one local day on (01:44 Europe/London is 00:44Z under BST), one row each.
- **DUPLICATE DELIVERY, live**: the same occurrence asked for a second time answered
  `ok: true, repeat: true` with **the original run id** and left the execution count at 1.
- **BOTH REFUSAL WALLS, live, writing nothing**: a disabled automation answers
  `disabled` and a stranger's account answers `no-automation` (so another tenant's
  automation and one that does not exist are one answer), with executions, runs and
  work rows all `2 -> 2` across both calls.
- **AND THE CRON SIMPLY NEVER SELECTS A DISABLED ROW** — `tick_automations` filters on
  `a.enabled`, so "disabling prevents new executions" is a negative reading, which is
  why an enabled control was stood up in the same window rather than trusting a zero.

**MEASURED ON THE MERGED TREE** (main merged in first; only the two documents
overlapped, so no code file was touched by both sides):

- Engine suite **306**, 0 failed. Real PostgreSQL **495 passed, 0 failed**.
  `verify:auto` **68 checks, 0 failed**.
- **SQL sweep over the migrations, a single clean run: 123 mutants, 123 killed, 0
  survived, 0 never applied, 6 comment-only controls survived.** The spec holds 129
  entries — 123 product mutants and 6 controls — and the runner counts only the
  product ones, which is why both passes read "123": the two survivors pass 1 found
  are killed here in one run rather than in a targeted re-run bolted onto a stale
  tally.

**⚠ AND THE SWEEP'S RESTORE TRAP COST A FIX, which is now a recorded rule.** A
`trap … EXIT` around a sweep reads as belt-and-braces and is not: the runner already
restores in its own `finally`, so on a clean run the trap restores the swept files to
**HEAD** — discarding the uncommitted work the sweep was measuring. Measured: a 43/43
green sweep ended with an empty `git diff` on all three swept files. The trap is for
`INT` and `TERM` only. The tell is a clean tally beside an empty diff.

---

## Richer workflows, reference material and memory (2026-09-17)

Owner: *"Focus on richer workflows, knowledge, and memory. Leave the real model
connection for the end. Inspect the existing implementation first and extend it. Reuse
the current agents, conversations, permissions, queue, scheduler, and execution
journal."* **Everything below is an extension of what was already here** — the same
queue, the same claim, the same fence, the same cron, the same journal — and the site
builder's half (the routes and the screen) is in the root `CLAUDE.md`.

**WHAT A CUSTOMER CAN DO THAT THEY COULD NOT BEFORE**: declare what an automation asks
for and answer it when they press Run; name a step's answer and use it in a later step
as `{{that name}}`; branch on a value; wait for a while or until a time; wait for a
person to approve or reject, with a configured outcome if nobody answers; give an agent
reference material and have a step search it; save facts and preferences the agent's
runs read by name; and read an execution history that says which branch ran, what is
being waited for, what each step produced and where an excerpt came from.

### The one new module, because three places need the same syntax

`workflow-refs.mjs` — `REF_NAME`, `refsIn`, `fillRefs`, `valueText`. Its own file
because `readWorkflow` refuses a reference nothing can produce, `runWorkflow`
substitutes at run time, and the SITE BUILDER validates a saved workflow before it
reaches the database. **A second implementation of one syntax is how a name that saves
cleanly fails at run time for a reason nobody can see.**

- **THE SYNTAX IS DELIBERATELY SMALL: a name, and nothing else.** No expressions, no
  property paths, no defaults, no filters. Every one of those is a language, and a
  language in a text box is something to parse, to bound and to get wrong.
- **A MALFORMED REFERENCE IS NOT A REFERENCE AND IS NOT AN ERROR EITHER.** `{{ }}`,
  `{{a b}}` and `{{Name}}` match the braces and not the name rule, so they stay literal —
  the only reading that lets somebody write about braces. What IS refused is a
  WELL-FORMED name nothing produces.
- **`Object.hasOwn`, never truthiness and never `in`**: an empty string is a real value
  somebody typed, and `{{constructor}}` must not resolve to a function.
- **AN UNKNOWN NAME IS NAMED AND NEVER SUBSTITUTED WITH NOTHING.** A note that quietly
  became "Prepared a summary of " is a thing a customer sends to somebody.
- **`valueText` REFUSES A LIST AND AN OBJECT** — `String(["a"])` is `"a"`, this
  repository's most-repeated value trap — and passes a number and a boolean, because a
  step that binds a count and a sentence that quotes it is the ordinary case.

### Nine steps, and the registry compels what a step must say

`weekday · if · otherwise · end · wait · approval · knowledge · memory · note`, in
`STEP_KINDS` = `condition · action · lookup · branch · pause`.

- **A STEP WITH NOTHING TO CONFIGURE MUST SAY SO (`configless: true`).** An empty
  `fields` is otherwise indistinguishable from a field somebody forgot, and the form
  reads that list to decide what to draw.
- **A `when` MUST NAME A REAL SIBLING FIELD AND A VALUE IT CAN REALLY HOLD**, checked in
  `defineStep`. A condition on a field nobody answers is a field that never applies —
  which from outside is a save that dropped it.
- **A FIELD THAT DOES NOT APPLY IS NOT READ AND IS NOT STORED.** A wait FOR a while has
  minutes; a wait UNTIL a time has a time; neither keeps the other's answer.

### The branch is FLAT, matched by depth, and there is no canvas

`branchMap` pairs every `if` with its `otherwise` and its `end` **by depth**, and a list
that does not balance is refused BY POSITION — at save time, while it is still somebody's
form. **A stored list whose `if` has no `end` FAILS WHOLE rather than running the steps
it can read**, because running half a branch is running a workflow nobody wrote.

- **AN `if` IS ALWAYS `ran`, AND `took` IS ITS OWN FIELD.** It did its job, which was to
  choose; without `took` a history shows two identical-looking branch rows and leaves
  somebody to infer the arm from which steps below were skipped.
- **THE ARM THAT WAS NOT TAKEN IS `skipped`, WITH A REASON — never absent and never
  `failed`.** Nothing went wrong on that arm.
- **THE DEPTH IS ONE NUMBER PER ROW** on the screen, which is the whole of what replaces
  a canvas: `if` and `end` at the outer depth, an `otherwise` at its own `if`'s depth,
  the steps under either arm one further in. Measured over `if · note · otherwise · note ·
  end · note`: `[0, 1, 0, 1, 0, 0]`.

### Waiting is a ROW, and that is what makes a restart free

**`runWorkflow` IS RESUMABLE, and the position is the whole of it.** It takes
`position, values, outcomes, decisions, waiting, waitUntil, memory, retrieve, record,
startedAt` and answers exactly one of `{stop}`, `{waiting}` or `{halted}` beside
`outcomes, values, position`. There is no closure, no timer and no held connection:
**the worker is released by the transaction that records the pause**, so a suspended
execution holds nothing at all.

- **PROGRESS IS CHECKPOINTED AFTER EVERY STEP, BEFORE THE NEXT ONE STARTS**, through one
  injected `record` — which is what makes "resuming cannot repeat completed actions" a
  property rather than a hope, and why an execution is N+1 transactions rather than one.
- **THE CHECKPOINT PASSES THE EXECUTOR'S OWN CLOCK (`at: now`), NOT THE RECORDER'S**, so
  a retry inside one delivery replays a BYTE-IDENTICAL journal entry — the only thing
  `agent.append_entry` can read as `already` rather than as a second entry. Reading the
  clock per call would put a new millisecond in every body.
- **A PAUSE CHECKPOINTS AT ITS OWN POSITION, NOT PAST IT.** That step has not finished,
  and its position is what a resume re-enters.
- **A REFUSED CHECKPOINT MEANS THIS WORKER MAY NOT WRITE**, so it stops there and
  attempts nothing else — not the next step, not a stop.
- **WHICH DAY AN EXECUTION IS ABOUT IS FIXED WHEN IT STARTED (`startedAt`), NOT WHEN IT
  RESUMED**, and that is what makes a pause safe for a `weekday` gate: an approval
  answered the following morning would otherwise decide it is Tuesday half way through.
  `now` stays the real clock, because a deadline is compared against the present.
- **A RESUME IS MATCHED BY THE STEP'S OWN ID, never by position alone**, so an answer
  that arrived for one pause can never be read as the answer to another.
- **A RE-PAUSE KEEPS THE DEADLINE IT ALREADY HAS** (in the transaction). A spurious
  delivery before the time would otherwise resolve `for 30 minutes` again from now, and
  a duplicate that extends a wait indefinitely is a duplicate doing harm.
- **THE TIMEOUT OUTCOME IS CONFIGURED AND IS NEVER A DEFAULT.** Carrying on unapproved,
  treating silence as no, and stopping as a failure are each right for some workflow;
  choosing on the customer's behalf is choosing which way their work goes wrong.

### Reference material and memory are three different things, deliberately

A conversation is a record of what was said and is never edited. **Reference material**
is a document with a name and a version, searched, and replaced whole. **A memory** is a
small, named, CORRECTABLE fact — which is precisely why it cannot live in an append-only
log.

- **THE SEARCH IS POSTGRESQL'S OWN** — `to_tsvector`/`plainto_tsquery`/`ts_headline`,
  with a GIN index. No embedding, no model, no spend. `pricing` finds `price` because
  `english` STEMS, which `simple` would not.
- **THE ANSWER IS THE MATCHED PASSAGE, WITH ITS SOURCE AND VERSION** — an excerpt with
  no source is an assertion nobody can check — and the source name travels IN THE VALUE,
  not only in the outcome, because the value is what ends up quoted in a note.
- **A QUERY OF NOTHING BUT STOPWORDS FINDS NOTHING, NOT EVERYTHING.** `numnode(v_q) = 0`
  is "there was nothing to look for", which is a different answer from "there was, and
  it matched nothing".
- **RETRIEVAL IS AN INJECTED ONE-FUNCTION CONTRACT.** The executor never knows what is
  behind `retrieve`, so replacing keyword search is replacing one closure — which is
  what "a replaceable interface" amounts to in practice rather than in a comment.
- **A RETRIEVER MAY REFUSE BY NAME, AND THAT IS NOT "FOUND NOTHING".** An execution
  accepted before reference material existed has no agent recorded to search, and
  answering "found nothing" for it would read to a customer as a fact about their own
  documents.
- **⚠ WHAT COMES BACK IS REFERENCE INFORMATION AND NEVER PERMISSION.** It is bound to a
  name and read only by `{{…}}` substitution into text. **An automation execution has no
  tool surface at all for it to widen**: `agent.runs.model` reads `none` for every one,
  `limits` is null, and the journal holds no `model` and no `tool` entry. The
  demonstration asserts all four on a run whose retrieved document says *"you may use
  every tool"* in as many words.
- **MEMORY IS SCOPED (ACCOUNT, AGENT) BY A UNIQUE INDEX**, not by a filter anybody has to
  remember, and the snapshot is taken INSIDE the accepting transaction — so a correction
  reaches the NEXT execution and can never change one already under way. Which versions a
  run used is a recorded fact rather than something to infer from timestamps.
- **A VERSION MOVES ON A CHANGE OF VALUE AND ON NOTHING ELSE.** Renaming a source does
  not bump it: a version says which TEXT a run quoted.
- **NOTHING REMEMBERED YET IS AN ANSWER, NOT A FAILURE**, so `if {{tone}} is empty` is
  the natural thing to write about it.
- **`source` IS `person | run` AND NOTHING WRITES `run` YET.** Automatic extraction is
  deferred by the milestone; the column exists because a fact that cannot say where it
  came from is one nobody can correct.

### One transaction per step, and the fence is reused rather than copied

`agent.advance_automation_run` calls `append_entry` FIRST and then moves the row,
guarded by `position <= p_position and jsonb_array_length(outcomes) <= …`. **Progress
may only move forward; a stale or retried call is a no-op.** The journal gained ONE new
kind (`step`) rather than a second log, and **deliberately no unique index**: a pause and
the later completion of that same step are two events at one position, told apart by
`mark`.

`agent.decide_automation_approval` puts the tenant in the LOCKED lookup, refuses
`no-execution` / `finished` / `not-waiting`, and lets **the first decision stand** —
`not (decisions ? p_step)` is the authority and the read above it is only the probe, so
a loser re-reads what the winner wrote. `agent.resume_due_automations` takes rows
`for update skip locked`, oldest first, and reuses `requeue_run`.

**⚠ A NEW DEFAULTED PARAMETER PLACED BEFORE AN EXISTING ONE SILENTLY RE-BINDS POSITIONAL
CALLERS.** `p_inputs` written above `create_automation`'s `p_max` bound the CEILING to
it, and **30 checks in the real-PostgreSQL suite went red, none of them about inputs.**
It goes after. Recorded in the migration itself.

### What the demonstration drives, and what it cannot

`npm run verify:wf` — `scripts/verify-workflows.mjs`, fourteen sections, and every piece
is the real one: the SITE BUILDER's own routes through `handleAgentApi`, a throwaway
PostgreSQL with this repository's migrations applied, and `worker.queue` /
`worker.scheduled` as the dispatcher. `scripts/lib/local-stack.mjs` is the only fixture
and is shared with `verify:auto`.

- **NOTHING IN IT IS SIMULATED AI, and that is not a stand-in standing in for one.** The
  search is PostgreSQL's, the branch is a string comparison, the wait and the approval
  are a timestamp and a row, and the note is the customer's own sentence with their own
  values in it. The one simulated thing is the TRANSPORT — PostgREST is a local shim and
  the queue is an in-process doorbell — because neither is reachable from a laptop, and
  durability is unchanged because the work is a ROW.
- **THE CLOCK IS PUSHED RATHER THAN WAITED OUT, declared in the file's own header.** One
  UPDATE moves `wait_until` into the past; the alternative is a check nobody re-runs
  because it takes thirty minutes. What that does NOT simulate is the decision —
  `resume_due_automations` still selects on `wait_until <= now()`.
- **THE RESTART IS A SECOND DISPATCHER with its own env and no memory of anything**,
  which is the same code path a deploy leaves behind, and the assertion under it is that
  the old doorbell had nothing left to deliver.

### ⚠ Four assertions of my own were wrong before the demonstration was green

Each is worth keeping because each was a guess about behaviour that measurement
corrected, and three of the four are recorded traps met again:

1. **The expected result was TRANSCRIBED**, which pins `ts_headline`'s own choice of how
   many fragments to return — a spelling, and one PostgreSQL is free to change. It
   asserts the COMPOSITION now: the two earlier steps' stored answers are read back and
   the sentence is rebuilt from them, with two positive assertions under it so an empty
   `draft` cannot satisfy the equality.
2. **A curly apostrophe in a regex** against a source string with a straight one.
3. **"CLAIMED EXACTLY TWICE" IS NOT A PROPERTY OF THIS SYSTEM.** `requeue_run` sets
   `attempts = 0` deliberately — its own comment says a person asking is new information
   and not a retry — so the count reads 1 after a resume however many times it paused.
   The property that makes a duplicate harmless is that NOTHING RAN TWICE, which the
   journal says outright: no position carries two `progress` marks, the positions only
   move forward, it paused exactly once, and the outcomes hold one slot per step. **And
   a `step` entry records the position REACHED**, so a branch that jumps over an arm
   never checkpoints the positions it skipped — eight progress marks on a nine-step
   workflow, the missing one being the arm that run did not take.
4. **The "not waiting at that step" case asked a run that had FINISHED**, and was
   answered `finished` by a route doing exactly the right thing. It needs an execution
   that really is suspended.

### What the guards cost, and the one finding the sweep produced

**⚠ THE SWEEP SAID THE WHOLE FEATURE WAS UNGUARDED, AND IT WAS RIGHT.** The first pass
over this round read **300 mutants, 262 killed, 38 survived — and 38 of the 39 new
mutants were this round's own work.** Every property they break is proven end to end by
`verify:wf` against a real PostgreSQL; `npm run sweep` runs `test/*.test.mjs` and not
that. **A property proven only by an instrument the sweep cannot run is a property no
mutant can be caught by**, and the demonstration's 116 green checks said nothing about
it either way.

Twenty cases in `automations.test.mjs` (28 → 48) and three in `worker.test.mjs`
(25 → 28) close it at the module, where a mutant can be seen. **It took three more
passes — 262 → 294 → 298 → 300 killed — and not one survivor at any point was the
product's.** Pass 2's six:

- **TWO WERE INERT BY CONSTRUCTION, MEASURED RATHER THAN HUNTED**, and both are
  REPLACED by an observable mutant of the same property rather than deleted.
  `fillRefs`'s FALLBACK bag swapped for `Object.create({})` is reached only when
  `values` is not an object — and that has no own `constructor` either, so
  `Object.hasOwn` answers the same both ways over every shape (driven: `null`,
  `undefined`, `7`, `"x"`, `["a"]`). And `exec.live?.steps ?? exec.steps` reads a field
  **nothing anywhere produces** — not the store, not the migration — so the optional
  chain always answered `undefined`.
- **THREE WERE FIXTURES TOO SHALLOW TO SEPARATE TWO READINGS**, which is this
  repository's own most-repeated guard trap, three times in one pass. The nested branch
  case had the inner `if` already CLOSED at the `otherwise`, so the innermost and the
  outermost open entry are the same one and `open[0]` passes. ONE approval in a workflow
  cannot tell "matched by the step's id" from "matched by anything suspended at all" —
  two can, and the answer to the first must leave the second waiting. And the runner's
  timer threw `set` and `clear` away, so "the heartbeat stopped" was unobservable in the
  one case that is about a released claim not being renewed.
- **ONE WAS SIMPLY UNDRIVEN**: a ring that FAILS. One bad send must not take the rows
  behind it down, and both rows are re-queued either way, because the transaction did
  that before anything was rung.

**AND PASS 3 LEFT TWO, BOTH THE SAME SHAPE ONE LAYER DEEPER — a case that reaches the
right code and cannot OBSERVE the difference.** Worth recording because both readings
looked sufficient and neither was:

- **TWO APPROVALS WERE NOT ENOUGH; THE CLOCK HAD TO BE PAST THE DEADLINE.** Before it, a
  pause with no decision waits whichever way the resume is matched, so the two readings
  agree. Past it, a reader that merely asked "is something suspended" hands the FIRST
  pause's `waitUntil` to the SECOND — which then times out on a deadline that was never
  its own, **rejecting a run nobody was ever asked about**. The control beside it is the
  first pause really timing out on that same deadline, so the case is about which pause
  the deadline belongs to rather than about timeouts working.
- **A RE-RUN OVERWRITES A STORED OUTCOME WITH A BYTE-IDENTICAL ONE.** Dropping the
  resumed position ran step one a second time and wrote the same outcome over the first,
  so every assertion about the answer held. The stored outcome carries a mark no re-run
  can produce (`ranAt`), and the assertion is made on what the runner really handed to
  `finish` — which is the only place the overwrite would show.

### Measured

- **`npm run verify:wf`: 116 checks, 0 failed**, with the final tally reading
  `done=4 failed=1 rejected=2 waiting=4` and *"not one execution anywhere called a
  model"*.
- **`npm run verify:auto`: 70 checks, 0 failed** — unchanged by this round, which is the
  control that says the scheduled path still works.
- **Real PostgreSQL 16 (`npm run test:pg`): 496 → 569 checks, 0 failed.** The 73 are
  this migration's own guarantees, each driven through the real function rather than
  read off the file: progress moving forward only with a stale advance proved a no-op,
  a pause releasing its worker and a re-pause keeping its deadline, the first decision
  standing with the account next door refused, a suspended execution unclaimable, the
  real `tsvector` search STEMMING and scoped three ways, a stopword query finding
  nothing, a version moving on the body and not on the title, memory scoped by its own
  index with the snapshot frozen at acceptance, and an input nothing asked for named
  rather than dropped. **496 is a run of this file on the pre-change tree**, not a
  carried stamp.
- **⚠ THREE SETUP MISTAKES OF MY OWN IN THAT FILE, and each was the schema being
  right.** The claim answers `claim_token`, not `token` — one missing key failed
  fourteen checks in a row. A suspended execution CANNOT be claimed, because the pause
  released it, so a stale-advance case has to re-queue first. And clearing `waiting`
  without `wait_until` is refused by `automation_runs_wait_is_whole`, which is now its
  own check in both directions rather than a workaround.
- **Engine mutation sweep: 300 product mutants, 300 killed, 0 survived, 0 never applied,
  6 comment-only controls survived** — 306 spec entries, of which the runner counts the
  300 that are not controls. Four passes, and the tally above is the last one's own
  answer rather than a targeted re-run bolted onto a stale count.
- **Engine suite 306 → 329**, 0 failed.

## Milestone 4: a tool call a person has to say yes to (2026-09-17)

**THE REQUIREMENT IS DECLARED IN CODE, ON THE TOOL** — `defineTool({ approval: true })` —
and nowhere else. Not in an instruction, not in a retrieved document, not in a memory, not
in a tool result, **because none of those may grant a capability and a requirement DATA can
set is one data can unset.** Data may tighten what an agent may do (the tool list a customer
ticks); it may never loosen it. Driven three ways: the grant written into the instructions,
the grant returned by a tool's own answer — the one an agent can produce for itself — and a
tool nobody gave it, which never reaches the gate at all because the tenancy narrowing is
the wall in front of it.

`approval` is refused if it is not a boolean, for `repeatable`'s own reason: `Boolean("false")`
is `true`, and a string out of a config file must not be what makes a gated tool ungated. It
is NOT compelled the way `scope` is, and the difference is which way being wrong hurts —
both of scope's defaults are actively wrong, while here one default is simply safe.

**WHICH TOOLS NEED A PERSON: `pause_automation` and `run_automation`, pinned BOTH WAYS.**
The line is what the call changes OUTSIDE this conversation — work that carries on after it
is over and that nobody may be watching. Reads and the agent's own notes are not gated,
because gating everything is how an approval becomes a thing people click through.

### The identity is `(run, step, index)`, the authority is the argument hash

Two calls of the same tool in one answer are two requests: the position is part of who is
being asked about. Approving a row authorises EXACTLY the arguments that row holds, so a
decision about other arguments reads as `stale` however it was answered — **`matches` is
asked BEFORE the verdict**, and it is compared by the DATABASE inside the statement that
read the row, because the row it has to agree with is the one a person was shown.

**`canonicalJson` TAGS EVERY SCALAR WITH ITS TYPE, and that is not decoration.** Plain JSON
cannot tell `{a: undefined}` from `{}` (it drops the key), or `1` from `"1"`, or `null` from
`"null"`, or `[undefined]` from `[null]` — and each of those collisions is one person's
approval authorising a different call. Five such pairs are driven. Object keys are SORTED
(key order is not part of the arguments, or a provider reordering a field would void a
person's answer); arrays keep their order, because there the order is the value.

### The wait is the one this product already has

A run whose tool calls have no results is already the shape of "stopped part-way". The work
row is marked DONE — there is nothing to redeliver until somebody answers — the log is left
**OPEN with no stop**, so the run still reads as in progress with its calls pending, and
`agent.decide_tool_approval` calls `agent.requeue_run`: the function a person pressing "try
again" already uses. **No second queue, no second journal, no poller.** Driven end to end
through a real delivery — held, requeued, resumed — with the model NOT asked again for the
step already paid for.

**THE BATCH IS HELD WHOLE**, in front of the dispatch and in front of the meter. A prefix
performs real side effects whose results nobody reads, because the run stops either way —
the same argument the tool-budget refusal above it makes. Nothing is billed as a tool call,
because nothing happened.

### ⚠ The order against `repeatable` on a resume is the whole point

`repeatable` asks *might this have run*. The gate sits IN FRONT of the dispatch, so a call a
person REFUSED definitively did not — and answering `cannot-resume` about it would strand
the run on a hazard that does not exist, for ever, since every later delivery would refuse
the same way. So the decisions are read FIRST, a refused call is answered rather than run,
and only then is `repeatable` asked of what is left.

**AN APPROVED PENDING CALL STILL FALLS TO `repeatable`**, because it may have been
dispatched before the process died — and that control is what stops the case passing with
the whole gate deleted. Making an approved non-repeatable call resumable needs an identity
derived from its arguments, which is M5's work and is not done here.

**EACH ASK IS AT ITS OWN `(step, index)`, taken off the pending entry.** ⚠ My own first
draft asked at FABRICATED positions: it numbered the pending calls 0..n and passed one step,
which would have created requests for calls nobody made. A batch that half-finished leaves a
GAPPED pending list — calls 0 and 2 answered, 1 and 3 not — and that is the case that finds it.

### Three refusals, never one

`rejected` (somebody said no, with their words), `stale` (a decision about different
arguments) and `unavailable` (there is nowhere to ask) are three different errors, because
"somebody said no" and "nobody could be asked" want opposite things done about them. All
three are tool RESULTS the model can read and carry on from, in the `no-backend` idiom — a
refusal the model never sees is a tool it asks for again immediately. **Only `pending` stops
the run.** An ask that THREW is `approval-failed`, which leaves the log open and is
RETRYABLE: a store that is down comes back, and a run closed over it never does.

**A FAILED ASK IS RAISED, NEVER READ AS A VERDICT.** Read as "not approved" an outage stops
every run and fills a customer's screen with requests nobody made; read as "approved" it is
an outage authorising tool calls. ⚠ AND THE STATUS IS CARRIED, which a sweep survivor is
why: there are two walls here — the non-2xx throw and the shape check below it — and with
the first removed the second still rejects, so "it rejects" cannot tell them apart. Only the
status separates an outage from a malformed reply.

### Nothing an agent can call decides an approval

Censused four ways, and it is a census rather than a fact about today's catalog: no
capability names `decide_tool_approval`; no offered tool in either catalog is named for
deciding; the two engine modules an agent's tools can reach do not contain the name
anywhere; and the SITE names it exactly once, in the store operation the route calls, so
there is no second caller for a tool to be wired to later. **Comments are blanked first** —
`approvals.mjs` explains this very rule, which is this repository's own most-repeated trap.

`decide_tool_approval` is `service_role`-only and REFUSES a blank decider (`no-decider`),
which is what "only an authorized user can approve" rests on: a decision nobody can be tied
to is one nobody can be asked about afterwards. The site's route takes that identity from
the VERIFIED session — **there is no `by` field on the wire and nothing reads one**.

### The screen

A banner above the message box, because it is the reason nothing is happening: what the
agent wants to run, in the catalog's own words, **with the arguments it would run with**,
and Approve / Don't. Approving what you were not shown is the one mistake here that cannot
be taken back, so the whole argument object is drawn and a row whose arguments cannot be
read says so rather than drawing an empty box. The textarea stays enabled, and the loser of
a race is told whose answer stands rather than being shown their own.

---

## Milestone 5: an operation's identity is its position AND its arguments (2026-09-17)

**THE MILESTONE'S WORDING IS *"make actions safe across retries and interruptions —
stable operation identities bound to arguments; explicit unresolved state"*, and what
it bought was FOUR MEASURED DEFECTS, every one reproduced before it was fixed.** Three
were in the resume path and one was in the SQL underneath it. None was found by reading.

### THE IDENTITY: `<run>:<step>:<index>:<the arguments' own hash>`

`ctx.operation`, and **each half answers a different question.**

- **THE POSITION SAYS *one slot is one operation*.** It is the same on every redelivery
  of one call, which is what lets a tool ask the database for the row it already made
  rather than making a second one.
- **THE ARGUMENTS SAY *a different call is never the same operation*.** Without them a
  slot re-filled with some other request inherits its predecessor's identity — and for
  `run_automation` that is a genuinely different ask coming back "already running" about
  work nobody wanted.
- **AND KEYING ON THE ARGUMENTS IS A WALL RATHER THAN A FIX FOR SOMETHING BROKEN TODAY,
  which is said rather than glossed.** The position alone is sufficient right now only
  because the model entry is written BEFORE the dispatch and `replay` reads the arguments
  back out of it — a property of the loop, not of identity. *A rule true because of a
  layer below it expires when that layer moves*, and the layer here is one retry policy
  away.
- **`operationKey` ANSWERS `null` FOR ARGUMENTS THAT CANNOT BE WRITTEN DOWN**, and the
  two call sites do different things with it: the live dispatch REFUSES the call and
  tells the model (the same wall shape as "no such tool", for the same reason — it is a
  model's output, so it must come back as a readable tool result), and a resume hands
  `null` through so every tool needing an identity refuses BY NAME rather than minting
  one. Nothing but the encoder's own `TypeError` is caught.

### Defect 1 — A RESUMED CALL RAN WITH ANOTHER CALL'S ARGUMENTS

The arguments were looked up LATER, by the call's `id` — and a model is not obliged to
give one. `modelEntry` stores `id: c.id ?? null`, so with two ids null a `.find` answered
the FIRST call's arguments for both. **MEASURED: two writes in one batch, the model naming
no ids, the store dying before the results were written — and on the resume `forget` ran
with `remember`'s arguments.** The agent forgot the fact it had just been told to keep,
and the name it was asked to forget was never touched.

**For a GATED call the wall failed closed instead, which is worse than it sounds**: the
decision is read at the right position with the wrong arguments, so `matches` is false and
it reads `stale` — a call a person really approved refused for ever.

**THE FIX KILLS THE CLASS RATHER THAN THE INSTANCE.** `replay`'s pending slot carries
`args`, taken off `calls[index]` at the moment the slot is made, beside the name and the
id it already took from there. `findArgs` is deleted: there is no later pairing left to
get wrong. `args: undefined` stays a real answer — a tool that takes none.

### Defect 2 — THE ARGUMENT HASH DID NOT SURVIVE BEING WRITTEN DOWN

`{id: "a-7", note: undefined}` and the same object after a journal round trip hashed
DIFFERENTLY: JSON drops an `undefined` property and rewrites an `undefined` array element
as `null`. The live path hashes the model's own object and a resume hashes what came back
out of the store, so an approval on such a call was asked about one hash and re-read at
another — `matches` false, `stale`, and the call refused for ever. **The two objects PRINT
identically, because JSON is what prints them**, which is why this was invisible to
reading.

**`storedForm` IS JSON'S OWN NORMALISATION, DONE BY JSON, ONCE, IN FRONT OF EVERY HASH.**
Nothing that survives storage is collapsed: `1` and `"1"` still differ, and so do `null`
and `"null"` and `[]` and `{}`. What is collapsed is only what storage collapses anyway —
and **preserving a distinction the store cannot keep does not prevent a collision, it
manufactures one.** A value JSON cannot write at all RAISES.

**ONE CASE WAS RE-ANCHORED, NOT APPEASED.** `⚠ THE SAME CALL HASHES THE SAME WAY` demanded
`{a: undefined}` and `{}` hash apart, on the reasoning that JSON collapsing them is a
collision. That reasoning is wrong in one direction and the case now asserts the opposite
property with its own measurement beside it.

### Defect 3 — AN UNREADABLE `toolCalls` WAS ITERATED, IN THE READER THAT NAMES JUNK

`toolCalls: "junk"` came back as **FOUR pending calls named `null` and four tool calls on
the meter, with `problems` EMPTY** — a string is iterable by index and `.length` is its
character count. A run resumed from such a log was billed for calls nobody made and told
"cannot resume" about calls that do not exist. This is the function whose own
documentation says a junk entry is named rather than skipped.

**ITS GUARD USES A RAW STORED ENTRY, because `modelEntry` CANNOT PRODUCE THAT SHAPE** — it
maps the list and throws. That is the producer being right, and it is exactly why the
reader still has to be checked: such a log comes back from STORAGE, and nothing outside
goes through the producer. The case asserts the producer's throw too, so a `modelEntry`
that started admitting it would go red.

### Defect 4 — A DUPLICATE RUN ID RAISED INSTEAD OF READING AS A REPEAT

`accept_automation_run` named the partial occurrence index as its conflict target, and **a
manual execution has no occurrence** — so a redelivered `run_automation` met the PRIMARY
KEY. **MEASURED on a real PostgreSQL: `duplicate key value violates unique constraint
"automation_runs_pkey"`, with one execution, one run and one work row.** So no second
execution was ever possible and the guarantee held, while the ANSWER was an exception: a
redelivered tool call came back a FAILURE about work that really is queued and will run.

**`capability-tools.mjs`'s OWN NOTE CLAIMED THIS FUNCTION ANSWERED `repeat`. It did not**,
and the correction is written where the claim was rather than the claim quietly becoming
true. The function now probes by the occurrence and then by the run id, and its insert
carries a bare `on conflict do nothing` — **no target, so it absorbs either identity**;
this table has exactly two unique things and both mean "already filed", while a check
constraint and a foreign key are not absorbed with them. A run id belonging to ANOTHER
automation is deliberately not found, so such a call still meets the primary key: that is
a caller pointing one execution's record at another.

**The migration edited is UNAPPLIED** (a round-number placeholder, this folder's own tell
— applied files are renamed to their remote version), so the fix goes in place rather than
duplicating a 172-line function into a fifth file. Had it been applied, the fix would be a
new migration.

### UNRESOLVED IS A THIRD ANSWER, AND IT IS NOT A KIND OF FAILURE

`ok: false` says the work did not happen. `unresolved` says nobody knows whether it did —
we asked a store to change something and never heard back. **The two invite opposite next
moves**: a failure invites doing it again, an unknown invites CHECKING first. Recording an
unknown as a failure is a claim nothing here is entitled to make, in the direction that
loses somebody's data.

- **`writes` ON A TOOL DECIDES WHAT A FAILURE MEANS**, not whether the tool may run. A read
  that throws did not happen; a write that throws may have. Refused if it is not a boolean,
  for `repeatable`'s own reason.
- **AND A WRITE MUST BE REPEATABLE, ENFORCED IN `defineTool`** rather than trusted: a write
  that cannot be repeated can never finish after an interruption at all — the resume refuses
  it and names it, for ever, so the tool is a control that holds and never completes.
- **AND THE HASH HAS NO SITE-SIDE TWIN, checked rather than assumed.** `agent-store.mjs`
  and `public/chat.js` contain no `argsHash`, no `canonicalJson` and no `storedForm`: the
  site reads an approval's stored `args` to DRAW them and never computes or compares a
  fingerprint. So there is nothing to census across the two products here, unlike
  `AGENT_TOOLS`, `AUTOMATION_STEPS` and `cleanWorkflow` — and saying so beats a reader
  going looking for the copy.
- **IT IS A CENSUS, NOT A LABEL.** `test/capabilities.test.mjs` drives every tool against a
  RECORDING capability seam and requires `writes` to be true exactly when one of
  `CAPABILITY_WRITES` was touched — with the observer proved alive (a tool that reached no
  operation proves nothing about its flag) and both directions really exercised.
  `CAPABILITY_WRITES` is declared beside `CAPABILITIES` rather than inferred from a name:
  `setAutomationEnabled` and `startAutomation` both read as writes and `readExecution` does
  not, but a rule built on the words `save`/`set`/`start` is one the next operation's name
  breaks in silence. Four of the twelve write.
- **IT RIDES ONLY WHEN IT IS TRUE**, so every entry written before this exists and every
  resolved entry written after it are byte for byte what they were — and `append_entry`
  validates only that the body is an object, so there is no migration in it.
- **THE MODEL IS TOLD IN THE TEXT**, not only in a field beside it. A flag a model is not
  shown changes nothing about what it does next, and what it does next is the whole reason
  to distinguish the two.
- **AND `cannot-resume` NAMES WHICH BLOCKED CALLS ARE UNRESOLVED.** A non-writing tool that
  blocked a resume changed nothing; somebody deciding what to do about a stranded run needs
  to know which they have, and the stop is the only place they can read it.

### WHAT MAKES EACH WRITE SAFE TO REPEAT, proved on a real PostgreSQL rather than claimed

| tool | why |
|---|---|
| `remember` | an upsert by the fact's own name — **and the VERSION does not move either**, which is `agent.save_memory`'s own rule (`unchanged` for the same words), not this module's care |
| `forget` | a delete of one name; the second answers `forgot: false` and the state is identical |
| `pause_automation` | a write of the CALLER'S value to a named row, and **the ANSWER is identical too**, which is what lets a redelivery finish the call rather than having to tell a resumed run from a first attempt |
| `run_automation` | the derived identity above, and defect 4 is what it took to make that true |

### AND EIGHT SQL MUTANTS WERE AIMED AT SUPERSEDED DEFINITIONS

**The recorded trap a THIRD time, and the third time it sat unnoticed** — found by a
census, not by a survivor, because no SQL sweep had run since the workflow migration
landed. That migration redefines `accept_automation_run`, `finish_automation_run` and
`agent.automation_history`, and `mAuto` still pointed all eight at the automations
migration's superseded copies. **Inert by construction**: the anchor is present and unique
in the file it was pointed at, so the pre-check is satisfied and the mutant lands on dead
code — its survival reading as a test gap rather than as a spec fault. `mAuto`'s own
comment said "these are the things only this migration has", which is what became false.

**THE GENERATOR ASKS NOW**, per mutant: is the anchor inside a function a LATER migration
redefines? Proved alive on two real breakages. **Its first two drafts were both wrong and
both are recorded in the code**:

- asking only whether the ANCHOR TEXT occurs later reported **six correct entries as
  broken** — `using (tenant_id = agent.tenant_id())` is ordinary policy text a later file
  writes for a different table, and `'error', 'no-agent'` is a sentence four functions
  share. *The anchor's text cannot say which object it belongs to; its POSITION can.*
- taking the nearest PRECEDING `create or replace` header attributed every index and
  constraint mutant after the last function in a file to that function — **eight more
  false alarms.** *A preceding landmark is not an enclosing one.*
- and the third draft was a DEAD OBSERVER: it looked for `$$;` at the start of a line,
  which **MEASURED over these migrations is the minority form** (40 bodies end `end; $$;`,
  22 end `$$;` alone, 2 end `end $$;`). It passed with all eight known-bad entries put
  back. Found by proving it alive rather than by trusting a green run.

**VIEWS ARE DELIBERATELY NOT COVERED** and that is stated in the code: a view's body has no
delimiter as unambiguous as `$$;`, and inventing one is the "flat scans where depth
matters" trap. There are four; `automation_history` was the one instance and was
re-pointed by hand.

### OPEN, and it is a decision rather than an oversight

**A STRANDED RUN READS AS "WORKING" TO A CUSTOMER, FOR EVER.** `cannot-resume` and
`awaiting-approval` are RECORDED rather than finished — no `stopped` entry, deliberately,
because the log has to stay open for the delivery after somebody answers — so
`agent.runs.status` is `running` and the site's `runView` answers `working`. For an
approval the screen has the banner, which is the thing to act on. For a `cannot-resume`
there is no row anywhere for a person to see: the pending call lives in the journal, which
nothing on the site reads.

**NOT BUILT, and the reason is scope rather than difficulty.** Surfacing it means a route
that reads a run's pending calls and a piece of screen for them — customer-facing work the
owner directs — and the stop already names every blocked call and now says which are
unresolved, so the fact is recorded and readable by anyone with the run. Written down
because "the state is explicit" is true of the RECORD and not yet of the SCREEN, and
collapsing those two would be the claim this milestone exists to stop making.

### Measured

- **Engine suite 393 → 395**, 0 failed (387 before this round). The two are the sweep
  survivors below.
  **⚠ AND BOTH NUMBERS IN THIS BLOCK ARE LOW — CORRECTED 2026-09-17 by measuring the commit
  they describe, in a clean worktree at `e09fcf6`: the suite is 402 and `test:pg` is 633.**
  The cause is this directory's own first rule, met by the entry that quotes it: *stamp
  measured numbers only AFTER the run.* These were stamped, and then the sweep's eleven
  survivors were closed with **seven** new cases — 395 + 7 = 402, which is the whole of the
  difference and is why the arithmetic closes exactly. The `test:pg` one is the same shape
  one check over. **The stamps are left as they were written and corrected here rather than
  edited in place**, because the correction is the useful part.
- **Real PostgreSQL (`npm run test:pg`): 627 → 632, 0 failed.** The five are the repeated
  run id reading as one execution with nothing written twice, and `set_automation_enabled`
  twice leaving the same state with the same answer, each with its control. (See the
  correction above: measured twice on the unchanged tree, it is **633**.)
- **`npm run verify:tools`: 69 → 78, 0 failed**, section 5b driving the redelivery through
  the REAL capability store: the same call twice is ONE execution naming the same id, a
  DIFFERENT call at the same position is its own (the control that says the arguments are
  load-bearing), and no identity at all refuses `no-id` and starts nothing.
  **`ctx` is built by hand there, deliberately** — two deliveries of one message is a
  different property (the claim refuses the second, which section 8 reads off `attempts`)
  and could never exercise the case where the first attempt's result was lost.
- **`verify:auto` 70, `verify:wf` 125, `verify:chat` 112 and the site builder's suite
  6,791 — every one unchanged**, which is the control that this round moved nothing else.
- **Sweep spec 384 → 400 entries; SQL spec 168.**

### ⚠ AND THE SWEEP SAID THIS ROUND'S CENTREPIECE WAS UNGUARDED — 11 survivors, all mine

**394 mutants, 383 killed, 11 survived, 0 never applied, 6 comment-only controls**, and
**every one of the eleven was in this round's own work.** EIGHT were a single gap:
**nothing in `test/*.test.mjs` had ever read `ctx.operation` as `run.mjs` BUILDS it, or
resumed a batch holding two different calls.** The identity was proved end to end by
`verify:tools`, which `npm run sweep` does not run — *a property proven only by an
instrument the sweep cannot run is a property no mutant can be caught by*, which this
directory recorded once already in the richer-workflows round and earned again here.

**SEVEN CASES CLOSE THEM**, each against a named mutant: a tool told its call's own
identity (the run, the position and the REAL argument hash, with two calls in one batch
differing); the arguments being part of it, driven as two runs at one position with "the
same call is the same identity" beside it so *they differ* is not satisfied by randomness;
no seed meaning NO identity rather than a partial one; unwritable arguments answered and
named with nothing run and no `unresolved`; a resumed batch giving each call its own
arguments and identity; a resumed write that threw being unresolved too; and, in the
RUNNER, the seed being the run's own id.

- **TWO PENDING CALLS IS THE ONLY SHAPE THAT SEPARATES THE TWO READINGS.** With one,
  `p.args` and `prior.pending[0].args` are the same object — so every earlier resume case
  passed with the pairing reversed, which is exactly how the mutant survived.
- **THE RESUME PATH HAS ITS OWN COPY OF THE `unresolved` DECISION**, so the live-path case
  could not see it. Two paths, two mutants, two cases.
- **AND THE SEED HOP EXISTS ONLY IN THE RUNNER**: from inside `run.mjs` a seed is just a
  seed, so a constant one is invisible there and is the difference between two runs having
  one identity and two.

**TWO MUTANTS WERE INERT AND ARE REPLACED, MEASURED RATHER THAN HUNTED.** One ADDED
`repeatable: true` to a tool that already declares it — a duplicate key in an object
literal, the later winning, both `true`; it was written while `run_automation` was
`repeatable: false` and stopped meaning anything when the tool's own answer changed. It
mints a FRESH id per call now, which is the defect it was about. The other is
`operationKey`'s `e instanceof TypeError`, redundant because `storedForm` wraps every
refusal — mutated as the PAIR that IS observable: the encoder raising something the catch
does not read.

**AND `canonicalJson`'s `undefined` ARM IS NOW UNREACHABLE FROM THE HASH**, because
`storedForm` sits in front of it — so its injectivity is asserted DIRECTLY. Kept total
rather than trimmed (it is a standalone encoder and a caller handing it `undefined` must
not get `null`'s answer), and asserted where the only remaining observer is.

**⚠ ONE OF THE NEW CASES FAILED FOR A REASON THE PRODUCT IS RIGHT ABOUT.** Its answers
carried `usage: null`, and an unreported usage against a finite bound is a stop with
`reason: "unmeasured"` — this engine's own rule. Run one ended after a step and the case
reported the identity as broken; `[1, 1]` out of the send log is what said so. *A test
that fails for a reason the product is right about is a test that has to change.*

**All eleven were re-checked one at a time** against the files that can see them — 11
killed, 0 survived, each by a NAMED test, under the runner's own child environment
(`MUTATION_SWEEP=1`, no `NODE_TEST_CONTEXT`), which is the re-check this repository has
already had wrong once. A narrow list can only produce a false SURVIVOR, so the full pass
is what decides — and it did: **394 mutants, 394 killed, 0 survived, 0 never applied, 6
comment-only controls survived**, with the tree proved restored against git and both spec
generators' anchor censuses green afterwards, which is the only check that can say no
mutant is still applied.

**⚠ AND THE FIRST ATTEMPT AT THAT PASS HIT THIS DIRECTORY'S OWN RECORDED TRAP.** It was
started as `nohup npm run sweep &` inside a backgrounded call, so the tracked wrapper was
reaped the instant `&` returned, the runner became an orphan nobody owned, and it was
killed without reaching its `finally` — **leaving a live mutant in `src/auth.mjs` and five
orphaned `node --test` processes holding files.** Caught by `git status`, restored from git,
and both anchor censuses run to confirm nothing else was left applied. The rule is already
written down: *run the sweep as the background call's own command.* And its output was
piped through `tail -30`, which nearly cost the survivor names — they survived only because
the runner prints a SURVIVORS list last. **A tally with survivors you cannot name is not
actionable**, so the second pass was written unpiped to a file.

**AND A TREE READING DURING A SWEEP IS WORTHLESS, MEASURED TWICE HERE RATHER THAN QUOTED.**
`git status` showed a mutant in `src/approvals.mjs` one command and a clean file the next;
later readings named `define.mjs`, then `meters.mjs`, then `worker.mjs`, then `runner.mjs`
as the runner walked its spec. Anything committed on the strength of such a reading is a
deliberate breakage shipped as source, which is why this round's commits during the pass
took files BY EXPLICIT PATH and never `git add -A`.
- ⚠ **AND ONE MORE NAME COLLISION, in my own new section**: `before`, `first`, `again` and
  `second` were already declared in `verify-tools.mjs`, which is one long function body —
  *a re-anchor lands in a scope it did not write*, met three times in one edit. Every local
  the section declares is prefixed now.

---

## Milestone 6: the schema header is the METHOD's, and five stores ask one rule (2026-09-17)

**THE DEFECT WAS MEASURED BEFORE ANYTHING WAS CHANGED: 10 of the 14 capability operations
sent `accept-profile` on a POST.** `Accept-Profile` is honoured on `GET` and `HEAD` only and
`Content-Profile` on everything else; **every PostgREST RPC is a POST**, however purely the
function behind it reads. So those ten named no schema at all, resolved against the default
one, and would have been answered out of a schema cache where `agent`'s functions do not
exist. Among them was the `read_automation` pre-check that `pause_automation` and
`run_automation` each make FIRST, so on a real PostgREST those two would have failed at
their own first step.

**IT IS THE SITE BUILDER'S DELETE DEFECT, ONE PRODUCT OVER, AND THE CAUSE IS THE SAME
SHAPE**: each store decided for itself, behind a flag named for what the FUNCTION does
(`write`) rather than for what the REQUEST is. `src/rest-profile.mjs` is the one rule now —
`READ_VERBS`, `profileHeader`, `profileFor` — and all five stores that speak PostgREST ask
it (`store · work · approvals · capabilities · automation-store`). **A flag a call site can
forget is a flag a call site will forget**: the four operations that happened to be right
were right because somebody remembered, and the ten that were wrong are what remembering
is worth.

- **REFUSE, NEVER COERCE, AND FAIL TOWARD THE WRITE HEADER.** `String(["GET"])` is `"GET"`,
  and this module's own first draft had exactly that — the most-repeated value trap in this
  repository, in the four lines written to close another instance of the same class. A
  non-string is unreadable and answers `content-profile`, which is the cheap way round:
  `Content-Profile` on a GET is ignored and costs nothing, while `Accept-Profile` on a POST
  silently loses the schema.
- **THE METHOD IS FOLDED, because `fetch` does not fold it for you.**

### ⚠ TWO OF THE FIVE STORES USED THE RULE WITHOUT IMPORTING IT

`store.mjs` and `automation-store.mjs`. The reference sits inside a function, so
`node --check` passes and both modules LOAD — this directory's recorded free-identifier
trap, where the throw waits for the first request. **What caught it was the unit suite: 89
of 404 tests red.** What did NOT catch it was the demonstration, which reached it as
`profileFor is not defined` inside a delivery and reported it as a failed run. *The suite
is the instrument for this class and the demonstration is not*, and the census in
`test/rest-profile.test.mjs` now asks for the import as well as the call.

### ⚠ AND THE LOCAL POSTGREST SHIM HAD NO PROFILE HANDLING AT ALL

Which is why `npm run verify:tools` passed **78 checks over a store that could not have
worked**. `scripts/local-rest.mjs` read the path and ignored the headers, so it answered
all ten defective requests happily. *A stand-in MORE permissive than the thing it stands in
for hides a defect exactly as well as one that is less capable* — the third instance of
that class in this product (after the `run_model` column the view did not have, and the
fixed column list that hid the dropped `status`).

**IT ENFORCES THE RULE NOW, GATED ONCE ABOVE EVERY ROUTE**, which is stricter than a gate
per route: a relation added below cannot be reached without naming its schema, because
there is nowhere to add one that is not already behind it. It is deliberately **not a
resolver** — nothing looks in `public`, because these relations are only ever in `agent`.
What it does is refuse in PostgREST's own words, so a store that names the wrong header
fails there rather than in production. **Measured, all six readings, each for its own
reason:**

| request | answer |
|---|---|
| POST + `accept-profile` (the defect) | **404 `PGRST202`**, naming which header was sent instead |
| GET + `content-profile` (the mirror) | **404 `PGRST205`** |
| either verb with no profile at all | the same 404 — which is what "absent means the default schema" amounts to |
| POST + a schema nobody exposes | **406 `PGRST106`**, naming what would be accepted |
| POST + `content-profile` (control) | through the gate |
| GET + `accept-profile` (control) | through the gate |

**THE CONTROLS ARE WHAT MAKE THE FOUR REFUSALS MEAN ANYTHING**: a gate that refused
everything would satisfy all four. And `test/helpers/memory-rest.mjs` — the in-memory fake
— read EITHER header until today, **which is that same trap sitting under a comment written
against it**; it honours the method's own header now, and on table paths as well as RPCs.

### The demonstration carries the claim itself, with its observer alive in that process

`rest.refusedProfiles()` counts what the gate turned away, and `verify:tools` section 7c
asserts it is **zero across the whole run** — a negative assertion, so the same section
then probes the gate (the old defect, refused `404 PGRST202`), probes the control (the same
call with the write header, through), and asserts the counter moved by exactly one. Without
the probes, "everything passed" and "the gate was never built" read identically.

**AND THE OBSERVER WAS PROVED ALIVE THE EXPENSIVE WAY TOO, before the guard existed**: the
defect was put back into `capabilities.mjs` (`"accept-profile": schema` hardcoded) and the
demonstration went RED — `...and it really searched, finding the passage with its source`
and `listing the sources is the real list` both `null`. Restored immediately.

### Measured

- **Engine suite 402 → 408**, 0 failed, **and the arithmetic closes exactly**: five for
  `test/rest-profile.test.mjs` (new) and one for `capabilities.test.mjs` (19 → 20). Measured
  per file and cross-checked against the aggregate, which is how the M5 stamp above was
  found to be seven low. **The 402 is HEAD's own number, measured in a clean worktree at
  `e09fcf6`** rather than taken from the entry above it.
  **ONE CASE MOVED OUT OF `capabilities.test.mjs` RATHER THAN BEING DUPLICATED** — the
  five-speaker census belongs to the rule, not to one of its speakers, and it was two copies
  of one check the moment the rule got a file of its own. The note left behind says where it
  went, because a check that vanishes reads like a check that was dropped.
- **Four demonstrations, every one through the strict shim: `verify:tools` 78 → 82,
  `verify:chat` 112, `verify:auto` 70, `verify:wf` 125 — all 0 failed.** The three
  unchanged counts are the control that says this round broke nothing, and they are
  *stronger* than before because the shim they ran against now refuses a header it used to
  ignore.
- **`npm run test:pg`: 633, 0 failed — UNCHANGED by this round, which is the control.**
  Nothing here can reach that check: `test/integration/` and `supabase/` are both untouched
  (`git status` over both is empty), so 633 is HEAD's number as well as this tree's.
  **⚠ AND IT IS NOT THE 632 MILESTONE 5 STAMPED**, which is corrected in that entry's own
  Measured block rather than quietly here — the same drift as the suite count, one check
  wide, and found only by measuring the commit instead of reading the note about it.
- **Sweep: 402 mutants, 402 killed, 0 survived, 0 never applied, 6 comment-only controls
  survived — CLEAN ON THE FIRST PASS**, taken after the run, in a detached worktree at
  `fa861b3` so the main tree held no mutant while it ran. The spec's 408 entries are those
  402 plus the six controls, which is why the two numbers never have to be reconciled by
  arithmetic.
- **Sweep spec 400 → 408 entries.** The six mutants that named a store's own profile line
  were **re-anchored, not appeased** — each property moved from "this store chooses the
  header" to "this store asks the rule" — and the `store: create` mutant lost `write: true`
  because `req` no longer takes the option. **Eight new**: six on `rest-profile.mjs` (the
  direction inverted, POST admitted to the read set, the case not folded, a non-string
  coerced, cannot-tell failing the expensive way, the header name not used) and **two
  wiring hops** (`work` and `caps` asking the rule about a method they never send). The
  wiring ones are not redundant with the rule's: a store that hands over a constant has
  decided for itself again, one indirection further in, and the rule module cannot see it.

---

## Milestone 7: an operation happens once, however many times it is delivered (2026-09-17)

**THE DEFECT WAS REPRODUCED BEFORE ANYTHING WAS BUILT**, on these migrations, through the
real capability store:

| step | answer | the row |
|---|---|---|
| the agent remembers `tone = formal` | `created` | `formal` v1, by run |
| **the answer is LOST** — a process dies between the commit and the journal write, which is exactly a PENDING TOOL CALL | — | `formal` v1 |
| the person corrects it to `casual` | `corrected` | `casual` **v2, by person** |
| the run is delivered again and the pending call is re-run | **`corrected`** | **`formal` v3, by run** |

**The person's correction is gone, and the retry ANSWERED `saved: "corrected"` — it knew it
was changing something and nothing was looking.** `remember` is declared `repeatable` on the
reasoning that *an upsert by the fact's own name leaves the state running it once does*,
which is true of a world where nothing else wrote in between. **A rule true because of a
layer below it expires when that layer moves**, and the layer here is *who else may write to
this row*.

### The identity is the POSITION; the arguments are a column beside it

`ctx.operation` is `<run>:<step>:<index>:<hash>` and `splitOperation` (in `approvals.mjs`,
the identity module) takes it apart. **Folding the hash into the key would make the table
unable to state its own rule**: two different argument sets would be two different keys and
therefore two separate operations, SILENTLY — which is the one outcome the requirement names.
Kept apart, a slot re-filled with a different call meets the same key with a different hash
and is refused `operation-mismatch`.

- **SPLIT ON THE LAST COLON, and refused rather than repaired.** A run id is a uuid, a step
  and an index are numbers, a hash is hex — so only one colon can be last. Fifteen malformed
  shapes answer `null`, because a key invented from a malformed identity collides with
  something. `run` is the seed only when it really is a uuid, because that column is one.

### `agent.operations`, and the two helpers every wrapper asks

`(tenant_id, op_key)` primary key; `action`, `args_hash`, `run_id`, `outcome` **not null**,
`recorded_at`. RLS enabled AND forced, a tenant may SELECT its own and nothing else, and
**`service_role` holds INSERT and SELECT with UPDATE and DELETE revoked** — an outcome that
can be rewritten is an outcome a retry cannot be answered from.

`operation_check` answers `fresh` · `repeat` (with the outcome) · `mismatch` ·
`unfinished`, and **the fourth is unreachable while every caller keeps claim and outcome in
one transaction** — named rather than read as a repeat with a null answer, because
cannot-tell must never read as a value. `operation_record` inserts `on conflict do nothing`
and says whether it won.

### Six wrappers, one shape, and the six functions are UNTOUCHED

`<fn>_once` takes `p_tenant, p_op_key, p_args_hash, p_op_run` plus the plain function's own
parameters, and calls it **BY NAME**. Wrappers rather than new parameters for two recorded
reasons: adding `p_operation` to each would re-emit ~700 lines into a fifth file (a second
copy of the thing deciding what a customer's data becomes), and **a new DEFAULTED parameter
creates an OVERLOAD rather than replacing anything**, so the old signature would stay
reachable beside the new one — the bypass door `beat_run` had to have dropped. Every existing
caller (the site's routes, `tick_automations`, the scheduler) is byte-identical.

### ⚠ THE RECORD ARBITRATES EVERY FAILURE, AND A CONCURRENCY CHECK IS WHAT BOUGHT THAT

The first design caught only its own `AG001`. **MEASURED, by the check written for exactly
this:** two first attempts both read `fresh`, both call the inner function, and **the INNER
function's own unique key refuses one** — `duplicate key value violates unique constraint
"agent_memory_one_per_key"`, HTTP 409, where the caller wanted the twin's answer. *The inner
functions are not concurrency-safe on their own and were never asked to be.*

So the subtransaction catches **everything**: any failure rolls the work back, and then the
record decides what it was. A committed twin means we lost a race and its answer is
authoritative; no twin means the failure is ours and is **RE-RAISED with its own code and
message** (Postgres's own words, the constraint name included; DETAIL and HINT are lost to
the re-raise, which is stated rather than glossed). Swallowing it would turn a real refusal
into a silent `ok: false`, which is the direction that loses work.

**MEASURED on the race**: both answers `ok`, both **agreeing** about what happened, the fact
written **once** (version 1, not 2), exactly ONE record for that position, and exactly one of
the two told it was a repeat.

### A repeat is carried to the model, and the sentence is different

`remember`, `forget` and `pause_automation` all say so now. **The answer is what the call did
the FIRST time — a historical fact, not a reading of the row as it stands** — so a model told
plainly "saved" would believe the value it sent is what is remembered now, when somebody may
have corrected it since. `forget`'s says the fact may have been written again since;
`pause_automation`'s says the automation may have been changed since. That distinction is the
whole reason for recording the operation rather than repeating it.

**AN IDENTITY IS REQUIRED AND A MISSING ONE IS A REFUSAL** (`operation-required`), with an
unreadable one its own answer (`operation-unreadable`). Falling through to the plain function
would make the deduplication something a caller can forget — the fail-OPEN direction, on the
defect that overwrites somebody's correction.

### Measured

- **Engine suite 408 → 411**, 0 failed, and the arithmetic closes: one in
  `approvals.test.mjs` (`splitOperation` over its own shapes and the real `argsHash`) and two
  in `capabilities.test.mjs` (every write censused against `CAPABILITY_WRITES` both ways —
  refused with no identity, refused with a junk one, and a CONTROL that a real one works; and
  the other half, that no READ asks for a record).
- **Real PostgreSQL (`npm run test:pg`): 634 → 658, 0 failed.** The 24 are this migration's
  own guarantees: the three answers in order, a record that does not move, the mismatch on
  the arguments AND on the action, the same key in another account, the outcome-less refusal,
  each shape constraint read for ITS OWN name with a control, the grants asked as
  PRIVILEGES, RLS forced, all eight functions definer with an empty `search_path`, and the
  wrapper's whole story — writes, is corrected through the UNCHANGED function, repeats
  without writing, refuses a different call, and passes a genuine refusal through as itself.
- **`npm run verify:ops` (new, `scripts/verify-operations.mjs`): 53 checks, 0 failed.** Nine
  sections through the real routes, the real dispatcher, the real engine and a real
  PostgreSQL: the reproduction; the mismatch with its control; **deletion and recreation** (a
  stale `forget` must not take the fact somebody wrote since); **concurrent retries**;
  **a restart** (a wholly fresh store, so the deduplication is proved to be in the database
  rather than in this process); **end to end** through `worker.queue`, leaving a record whose
  `run_id` is that run and whose key starts with it; a census over the writes; the record
  being the ACCOUNT's; and what none of it left behind.
- **`verify:tools` 82 → 84, `verify:chat` 112, `verify:auto` 70, `verify:wf` 125** — the
  three unchanged counts are the control that says this round broke nothing.
- **Sweep spec 408 → 421 entries** (7 on `splitOperation`, 4 on the store's one rule, 2 on the
  tools' identity) and **SQL spec 168 → 186** (7 on the table and its grants, 6 on the rule,
  5 on the wrappers, 1 control).

### ⚠ Five things that went wrong on the way, each worth its own line

1. **THE ROUTE MINTS THE AGENT'S ID AND IGNORES THE BODY'S** — which is the route being
   right. Written as a constant in the new demonstration, every check failed `no-agent` while
   the create's own check passed, **because that one only asked for a 200**.
2. **`get diagnostics v_rows = row_count` NEEDS AN INTEGER.** Declared `boolean` and Postgres
   refused outright — loud, immediately, the right way round for a type mistake.
3. **`accept_automation_run` ALREADY HAS A `p_run_id`**, so the wrapper's could not share the
   name: PL/pgSQL refuses a signature naming one parameter twice. It is `p_op_run` in all six,
   not only where it collides, so a census can read them as one shape.
4. **MY OWN APPLY HARNESS TRUNCATED ITS OWN INPUT.** A loop piping each migration's output
   through `head -5` sent SIGPIPE to `psql` part way through the file that emits six
   NOTICEs — leaving a half-applied view and two errors that read as broken migrations. *A
   harness that contaminates its own output reports the product as broken*; the fix was to use
   `standUp`, which does not.
5. **TWO SQL ANCHORS WERE AMBIGUOUS SIX WAYS**, because six wrappers share one body. Closed by
   making the `operation-lost` residue NAME ITS ACTION — a better answer as well as a unique
   anchor, since a caller told only "lost" cannot say what was lost.

**NOT APPLIED, NOT DEPLOYED, NOT MERGED.** The migration is prepared locally. When it goes,
the order is the recorded one — **migration → engine → site** — and here the engine's half is
the only one that changes: the site's routes call the plain functions and are untouched.

---

## Milestone 8: an agent can write a workflow, through the reader the screen uses (2026-09-17)

Owner: *"Provide validated tools for creating and editing automations using the same backend
rules as the screen. An agent must be able to inspect the available actions, assemble a
workflow, save it, inspect it, and propose changes."*

**FOUR TOOLS, AND THE CATALOG GOES 12 → 16**: `list_actions` · `check_workflow` ·
`make_automation` · `change_automation`.

### The validation is the SAME FUNCTION, and what reaches the database is ITS output

`checkSteps` is `readWorkflow` — the one the screen's own save goes through. It mints each
step's id from its POSITION, refuses an unknown type, a note past its cap, a day that is not a
day, a reference nothing produces (by name AND by position) and a branch that does not
balance, and **it never SHORTENS**. A model composing steps meets exactly those rules, in
exactly that function, and the verdict becomes a sentence rather than a throw.

**WHAT GOES TO THE DATABASE IS `readWorkflow`'S OWN `steps`, NEVER THE MODEL'S LIST.** Passing
the raw list on would put an unvalidated step into the row with a validation having happened
beside it, which is the shape of every "it was checked" defect this repository records — and
the row is read back in the demonstration to prove it, against the ids `readWorkflow` itself
mints rather than against a transcribed `["s0","s1"]`. **That transcription was wrong**: the
counter is 1-based, so the first draft asserted `s0` and measured `s1`. *An expectation copied
from a guess about a producer is a guess.*

### ⚠ THE APPROVAL GATE IS ON THE TOOL, NEVER ON ITS ARGUMENTS

The requirement is that *scheduling or enabling persistent work must follow the approval
policy*, and the obvious reading — gate it only when `enabled` is true or a schedule is set —
**is a decision made FROM ARGUMENTS A MODEL WROTE**. That is the one thing this surface
forbids: tool arguments cannot grant capabilities, and a gate a model can turn off by writing
`enabled: false` and then editing is not a gate.

So both authoring tools are `approval: true`, always. **The cost is stated**: a person
approves a disabled draft. The alternative is a model choosing whether a person is asked.

### What stays the server's, and it is more than the bounds

- **THE CATALOG.** `list_actions` reads `AUTOMATION_STEPS` — code in this repository — so a
  step a model invents is not a step, and neither an instruction sheet nor a saved document
  can add one. It needs no backend at all, which is why it does not go through `withBackend`:
  it describes what the PLATFORM can do, not what one account holds.
- **THE CEILING.** `MAX_WORKFLOW_STEPS` rides on the answer, so a model is not told to guess
  it — and a mutant that tells it 999 is in the sweep.
- **THE ID.** Derived from `ctx.operation`, so a redelivery asks for the same automation. Never
  minted, never an argument.
- **⚠ THE TIME ZONE IS NOT AN ARGUMENT AT ALL.** It belongs to whoever owns the automation; a
  model choosing it would make "every day at nine" mean nine somewhere nobody lives.
- **`AUTOMATION_SCHEDULES` IS NOW A DECLARED COPY IN THREE LANGUAGES** — the engine's (so a
  tool can tell a model which schedules exist), the site's, and the database's own
  `automations_schedule_known` CHECK. `test/agent-send.test.mjs` compares all three, reading
  the constraint out of the migration, because a schedule an agent can ask for that the
  database refuses is a control that answers and then fails at the save.

### Measured

- **Engine suite 411 → 413**, 0 failed: the identity census over all six writes (a forged
  `operation` among the ARGUMENTS reaches nothing, and no schema offers the field) and the
  absorbed-answer census with its control.
- **Site suite: `agent-send` 54 → 55** — the schedule census. The site's catalog gained the
  four in PERSON-facing words, which is what keeps the cross-product census green.
- **`verify:tools` 84 → 112, 0 failed.** Section 5c reads the catalog through the tool AND
  through a real message; refuses a bad reference and an unbalanced branch with the reader's
  own sentences; saves, reads back the validated ids, refuses a bad create having written
  nothing, replaces a workflow, refuses a SIBLING's, absorbs a repeated create into one
  automation, and drives `make_automation` through the loop to prove the approval gate.
- **`test:pg` 658, `verify:ops` 53, `verify:chat` 112, `verify:auto` 70, `verify:wf` 125** —
  all unchanged, which is the control.
- **Sweep spec 421 → 430** (nine on the authoring four).

### ⚠ THE SWEEP FOUND EIGHT SURVIVORS IN M7, AND EVERY ONE WAS THE RECORDED SHAPE

**420 mutants, 412 killed, 8 survived** on the M7 commit — all eight in that round's own work,
because its properties are proved by `verify:ops`, which `npm run sweep` does not run. *A
property proven only by an instrument the sweep cannot run is a property no mutant can be
caught by*, for the third time in this directory.

- **FOUR were "the identity comes from an argument"** — nothing drove a write with `operation`
  among its ARGUMENTS. Closed by a census over all six writes that forges one and reads the
  request: the key is `ctx`'s, the forged one reaches nothing, and no schema offers the field.
- **THREE were the absorbed answers** — nothing drove a capability answering `repeat: true`.
  Closed with a census over five writes AND its control, because "it says repeat" is otherwise
  satisfied by a tool that always does.
- **ONE WAS INERT AND IS DECLARED RATHER THAN RELABELLED.** `cut === operation.length - 1` in
  `splitOperation` — **measured over 18 shapes, every answer identical**, because the hash
  charset test already refuses an empty hash. It stays as a deliberate second wall saying "a
  hash is REQUIRED", the code says so, and the spec says it has no mutant and why. **My first
  attempt replaced it with the same mutant under a new label** — *a replacement for an inert
  mutant has to be observable, not relabelled.*

### ⚠ And two more of this file's own recorded traps, in one section

1. **A NAME COLLISION IN ONE LONG FUNCTION BODY**, for the second time in two milestones:
   `verify-tools.mjs` is a single body and `made` was already declared. Every local the new
   section declares is prefixed `wf`.
2. **AND THE BLANKET RENAME REACHED INSIDE A FIELD AND TWO SENTENCES** — `wfActions.actions`
   became `wfActions.wfActions`, and two check labels read "no automation was wfMade". *A regex
   over identifiers cannot tell a local from an output key or from the same word in prose.*

### One census widened rather than appeased

The final census in `verify:tools` requires every tool to have been called BY A MODEL, and
three of the four cannot be: `check_workflow`, `make_automation` and `change_automation` take a
LIST OF OBJECTS, and the stand-in fills a schema from the words of a request. The set is
**DECLARED** (`NOT_FROM_THE_STAND_IN`), with the reason, **and their observer is their own
effect** — the automation section 5c really wrote, read back, plus the model really reaching
`make_automation` once a person approved it. Every name on the list must be a real tool, so a
typo cannot exempt one that does not exist and quietly excuse one that does.

**NOT APPLIED, NOT DEPLOYED, NOT MERGED**, and this round adds no SQL at all — the wrappers and
the plain functions were already there.

---

## Milestone 4, finished: a window that closes, a permission withdrawn, a run stopped (2026-09-17)

Owner: *"Finish approvals and execution controls: approval expiry, explicit revocation,
cancellation. Approval must identify the exact action and arguments. Changed actions require
fresh approval. Expired, rejected, or revoked approvals cannot execute. Keep accepted runs'
recorded configuration stable, but define explicit permission revocation separately and
enforce it before subsequent actions. Cancellation must stop pending work and future steps,
release waits, and record what already completed. Don't claim completed effects were
undone."*

**FOUR SEPARATE FACTS, AND THE WHOLE POINT IS THAT THEY STAY SEPARATE.** Nobody answered in
time; somebody took a decision back; somebody took a TOOL away; somebody stopped the RUN.
Each needs its own sentence, because a model told the wrong one tells a customer the wrong
one — and a fifth thing is true of all four: **an effect that already happened stays
happened.** Nothing here undoes anything, and every answer says what had already completed
rather than implying a rollback.

### Expiry is DERIVED, and it is not a verdict

`agent.tool_approvals.expires_at`, stamped at request time from `agent.approval_window()` —
24 hours, **the server's function and never a caller's argument**, because a window a caller
chooses is a window a model can widen and this is the wall that closes a request nobody
answered.

- **A VERDICT IS SOMETHING A PERSON DID; A WINDOW CLOSING IS SOMETHING THAT HAPPENED.**
  Writing `expired` into the verdict column would mean a background job going round stamping
  rows — a second writer on a fact the clock already states. So `verdict` stays null and
  every reader compares `expires_at` against `now()` itself.
- **A ROW FROM BEFORE THIS MIGRATION HAS NO WINDOW, AND THAT READS AS *NO WINDOW*** rather
  than as expired. The only safe direction: the other reading refuses every request in flight
  the moment this ships.
- **`expired` ANSWERS `false`, NEVER `null` — measured.** `v_state = 'expired'` is NULL for an
  undecided request inside its window, so every pending request answered `"expired": null`
  before the `coalesce` — cannot-tell wearing a value's clothes, in the one field a caller
  asks to find out whether the window closed.
- **A DECISION ALREADY MADE STANDS, however long ago the window closed.** The repeat check is
  asked BEFORE the window deliberately: it was made in time.
- **`pending_approvals` AND `run_approvals` ANSWER DIFFERENTLY ON PURPOSE.** A closed window
  is not waiting for anybody, so the screen stops offering it — and `decide_tool_approval`
  really does refuse it, so the screen and the wall agree. A run's own list PROJECTS it as
  `expired`, because that is exactly what explains the run.

### ⚠ TWO DEFECTS, BOTH THE SAME SHAPE, BOTH FOUND BY DRIVING IT

**A run waiting for a person has its work row marked DONE** — there is nothing to redeliver
until somebody answers — and `agent.decide_tool_approval` is what puts it back. **So anything
that answers a request INSTEAD of a person has to put it back too**, and neither of these
did:

1. **NOBODY ANSWERING.** MEASURED: a redelivery came back `not-claimable` and the run sat for
   ever reading as `running`, with a refusal that was correct and unreachable.
   `agent.requeue_expired_approvals` is the cron's new **fourth job**, and it only offers a
   run whose windows have **ALL** closed — one holding a live request too would be requeued
   every minute for ever, hold again on the live one, and be requeued again. A run that has
   already ended is not offered either.
2. **A REVOCATION ANSWERING.** `revoke_agent_tool` withdrew every pending request for the tool
   — which it must, or somebody could approve a call whose permission has just been taken away
   — and left their runs in exactly that state. It requeues them now and **hands the run ids
   back so the CALLER can ring them**, because a SQL function cannot ring a Cloudflare queue.

### ⚠ AND THE CANCELLATION'S ENTRY SHAPE WAS WRONG IN A WAY `status` HID

`agent.project_entry` reads `new.body -> 'stop'`. The first draft of `cancel_run` wrote the
reason and the counts at the TOP level of the body: the status arm (which only looks at
`kind`) went to `stopped` while `agent.runs.stop` stayed **NULL** — a run reading as ended
with nothing saying how. **This function is a SECOND producer of `stoppedEntry`'s shape and
has to MATCH it rather than resemble it.**

`agent.cancel_run` is the declared second door into the journal, and the narrowness is the
safety argument: it writes exactly one kind of entry, only for a run that has none, and it is
`service_role`-only. It releases the work row (so nothing is delivered again and whoever holds
it fails its next checkpoint — the fence doing the stopping), clears any wait, withdraws
anything still waiting for a person, and reports `completedSteps`/`completedCalls`. Cancelling
twice answers what really happened and writes no second ending.

### A permission taken away is NOT the settings tick, and the distinction is the requirement

`agent.tool_revocations` — its own table, its own verb, its own reader, and **no UPDATE grant
for anybody**, because a revocation is added or lifted and never edited.

- **THE TOOL TICK IS THE AGENT'S CONFIGURATION**: a run records what it was accepted with, and
  that snapshot is deliberately stable — a customer unticking a tool changes what the NEXT run
  may call, because a run that loses a tool half way through is a run whose plan no longer
  works.
- **A REVOCATION IS THE OPPOSITE ACT.** It says *stop doing this now*, so the runner reads it
  **LIVE on every delivery**, past the snapshot. Two acts, two readers; collapsing them would
  mean either that an ordinary settings edit silently re-permissions a live run, or that a
  withdrawal cannot stop one.
- **IT SUBTRACTS, which is the whole mechanism** — the rule `narrowTools` and `narrowLimits`
  follow. A revoked tool is not offered to the model (no tokens spent on a plan that cannot
  run) and is not in `callable` (cannot be dispatched however it is named).
- **THREE POINTS IN THE LOOP NEEDED IT.** The live dispatch answers the real reason, asked
  BEFORE the "no such tool" branch — which is false about a tool that exists. A **PENDING**
  call of a revoked tool is answered rather than re-run: that is the half `callable` alone
  cannot carry, since a `repeatable` non-gated write (which `remember` and `forget` both are)
  would otherwise be dispatched again under a withdrawn permission. And it is **not** a resume
  hazard, because we are not going to run it — `cannot-resume` would strand the run for ever.
- **`toolRevoked` SAYS BOTH HALVES OF THE TRUTH.** A withdrawal is not a rejection, and for a
  WRITING tool the earlier attempt may already have landed — a revocation does not reach back
  and undo it.
- **LIFTING ONE DOES NOT RE-OPEN WHAT IT WITHDREW.** Those were answered, by the revocation,
  and re-opening them would put a decision in front of somebody who has already made one.
- **SCOPED TO THE AGENT, which is the wall no tenant filter can see**: both agents share an
  owner, so only the agent id tells them apart.

### The engine's own shapes

- **`revoked` IS REFUSED, NOT COERCED.** A caller with nothing revoked passes `[]` or omits
  it; `null` or a string is a caller whose READ FAILED, and reading that as "nothing is
  revoked" is the one direction that lets a withdrawn tool run. The runner's read RAISES for
  the same reason.
- **THE RECORD CARRIES `revoked` BESIDE `withheld`, never folded into it.** "This tenant was
  never granted it" and "somebody took it away" are different facts with different remedies.
- **`revokedHere` IS WHAT WAS REALLY TAKEN AWAY**, not what was asked for: a revocation naming
  a tool this agent has not got removes nothing, and reporting it as removed would be a record
  saying a run was narrowed when it was not.
- **`expiredApprovals` TAKES NO TENANT, and that is not a hole in the closure rule.** The rule
  is that no OPERATION takes a tenant as an argument; this is a PLATFORM SWEEP like
  `reclaimable` and the scheduler's tick, reachable only from `worker.scheduled`.
- **FOUR CRON JOBS, FOUR `try` BLOCKS**, and none may silence another. The expiry sweep is
  last because it is the newest and least load-bearing: a throw there must not cost the
  deployment its sweeper.

### The site's half, and what is deliberately not built

Five routes: `tool-withdraw`, `tool-revoke`, `tool-restore`, `revoked-tools`, `run-cancel`.
`who` comes from the verified session and **there is no `by` on any wire**. The tool name is
checked against `AGENT_TOOLS` — the platform's own catalog, in code — so a revocation of a
name no tool has is refused rather than becoming a row that can never do anything.

**THERE IS NO SCREEN FOR THEM YET, and that is declared rather than disguised.** The standing
instruction is that the frontend is fine as it is, so the backend landed first;
`test/agent-builder-view.test.mjs` gained a **`NO_SCREEN_YET`** list kept SEPARATE from
`SERVER_ONLY`, because they are separate facts — a person is exactly who takes a tool away or
stops a run, so calling these server-only would record a design decision nobody made. Every
name on it must be a real route AND must not already be called, so it shrinks when the screen
arrives rather than being forgotten.

### What the demonstration drives, and the three findings it produced

`npm run verify:controls` — the real routes, the real dispatcher, `worker.queue` and
`worker.scheduled`, and a real PostgreSQL. **What is simulated is three things and they are
named in the file's own header**: the model, the transport, and **THE CLOCK in exactly one
place** — a window is 24 hours, so one UPDATE moves `expires_at` into the past. What that does
not simulate is the DECISION: every reader still compares against `now()` itself.

**THE CHECK WORTH NAMING IS THE DISTINCTION THE REQUIREMENT ASKS FOR, side by side in one
database**: unticking a tool leaves a run already accepted able to use it, while revoking it
does not. Three more findings are recorded where they happened:

- **A WITHDRAWN REQUEST ANSWERS THE WITHDRAWAL rather than a 404** when somebody presses
  Approve late — the first decision stands, and the withdrawal was one. A 404 was my guess and
  the product is right. An EXPIRED request IS a 404, because nothing was decided at all: two
  facts, two answers.
- **THE NEXT RUN IS OFFERED A DIFFERENT TOOL rather than none**, so `ranTool === 0` was the
  wrong assertion and would have been red about a run behaving perfectly. It asks about the
  revoked tool BY NAME now.
- **A CANCELLED EXECUTION CANNOT BE GIVEN A DEADLINE BACK WITHOUT A WAIT** —
  `automation_runs_wait_is_whole` refuses it. That refusal is stronger evidence than "this tick
  did not wake it": the row cannot be put into the selectable state at all.

### Measured

- **`npm run verify:controls`: 71 checks, 0 failed.**
- **Real PostgreSQL (`npm run test:pg`): 658 → 734, 0 failed.** Every refusal read for ITS OWN
  gate with a control beside it, the grants asked as PRIVILEGES, and the two requeues driven.
  **One of its own checks was VACUOUS and is recorded**: an `||` satisfied by `S1` having no
  stop entry, which it did not — the run is really ended there now and the assertion is
  unconditional.
- **Engine suite 429 → 432**, 0 failed. (413 at the start of this round; the sixteen before
  these three are M8's closed survivors and the revocation's own cases.)
- **Site suite 6,799**, 0 failed, 2 skipped. Measured with `npm test` from the repository
  root, not with `--test-timeout=20000`, which cuts `css-reachable` off at 20 s and reads
  6,788.
  **⚠ AND THIS LINE READ 6,792 AND SAID "unchanged, which is the control" — BOTH HALVES WERE
  WRONG, and the correction is here rather than edited silently.** The number was stamped
  before this round's own ten sweep survivors were closed with SEVEN new `agent-api` cases,
  which is exactly the difference: *stamp measured numbers only AFTER the run*, this
  directory's first rule, in the entry that quotes it — and the second time after M5's own
  correction of the same shape. It was found by measuring the commit in a clean worktree
  rather than by reading the note about it. **A worktree run reads one extra FAILURE**
  (`render-sandbox`'s privilege-drop case, which is about writing outside the repository
  root), so the TOTAL is what carries across a machine and the pass count is not.
- **`verify:tools` 112 · `verify:chat` 112 · `verify:auto` 70 · `verify:wf` 125 ·
  `verify:ops` 53 — every one unchanged and green**, which is the control that this round
  broke nothing.
- **Engine sweep: 450 mutants, 450 killed, 0 survived, 0 never applied, 7 comment-only
  controls survived** (457 spec entries, being those 450 plus the seven controls), taken
  after the run in a detached worktree so the main tree held no mutant while it ran, and
  the worktree proved restored against git afterwards.
  **⚠ FIVE SURVIVED THE FIRST PASS AND EVERY ONE WAS IN `runner.mjs` OR `worker.mjs`** —
  every property proved end to end by `verify:controls`, which `npm run sweep` does not
  run. *A property proven only by an instrument the sweep cannot run is a property no
  mutant can be caught by*, for the FOURTH time in this directory. Closed with three
  engine cases (a withdrawn tool not running and the withdrawal SAID; the read happening
  live on every delivery, driven by revoking a tool BETWEEN two deliveries of one run
  with the first delivery's empty answer as the control), one store case (the expiry
  sweep's answer is a list or it is nothing, with a real answer coming through WHOLE as
  its control), and assertions inside the cron's own case.
  **AND ONE OF THE FIVE WAS A WALL NOBODY COULD DRIVE, which is a product change rather
  than a guard one.** `worker.scheduled` rings only an `action === "requeued"` row, and
  `requeue_expired_approvals` never answered anything else — so nothing anywhere handed
  it a row to skip, and the log line beside it carried two numbers (`closed` and `rung`)
  that were always equal. The function reports a `held` row now: the filter is
  load-bearing, an operator can see what a tick LOOKED AT against what it could act on,
  and a run left alone because somebody is on it stops being silent. Its SQL mutant was
  re-anchored from *is a held row reported at all* to *does its action say which it was*,
  which is strictly stronger.
- **Four censuses re-anchored, not appeased**, each by fields of the thing being acted on
  (`tool`, checked against the catalog, and `reason`, a person's own words) rather than by an
  exemption.
- **Two fakes had to get as capable as the real store, and the second would have hidden the
  whole feature**: `bench`'s approvals fake gained `revokedTools` (and a `revoke()` so a case
  can withdraw a tool BETWEEN two deliveries of one run), and the in-memory REST fake gained
  `revoked_tools`, `revoke_agent_tool`, `restore_agent_tool` and `requeue_expired_approvals`
  — including the requeue, because a fake that withdrew the request and left the row is
  exactly the defect the real function had.

**NOT APPLIED, NOT DEPLOYED, NOT MERGED.** `20260918030000_agent_approval_controls.sql` is
prepared locally, and the round-number name is this folder's own tell for an unapplied file.
When it goes, the order is the recorded one — **migration → engine → site** — and here the
reason is sharper than usual: the migration adds `expires_at`, which the live
`request_tool_approval` does not write, so an engine shipped first would stamp no windows; and
a site shipped first would offer routes for functions that do not exist.
---

## Milestone 9: what a run is really doing (2026-09-17)

Owner: *"Make operational states truthful: backend status and history sufficient to
distinguish queued, running, waiting, awaiting approval, unresolved, failed, cancelled,
completed. A stranded run must not appear to be actively working forever. Reuse the current
interface where a small status correction is needed; no redesign."*

**ONE WORD WAS DOING FIVE JOBS.** `agent.runs.status` is `new | running | stopped`, projected
off the log and right about what it says — and the CONVERSATION reader turned `running` into
`working`. So a run really thinking, a run waiting for a person, and a run **nothing will ever
deliver again** all read as *working*, for ever, with nothing telling them apart. The last of
those is the one the requirement names, and M5's own notes had already recorded it as open:
*"a stranded run reads as WORKING to a customer, for ever… the state is explicit in the RECORD
and not yet on the SCREEN."*

**NOTHING IS REDESIGNED AND NO STATUS COLUMN MOVES.** `status` stays a three-valued projection
of the log. What this adds is the two FACTS a reader needs, appended to the view the screen
already reads.

### The two facts, and why each comes out of the log rather than the queue

- **`run_open_calls` — how many tool calls have no result.** A model entry carries its
  `toolCalls` and a tool entry carries the `(step, index)` slot it answers, so the count is
  asked-for minus answered, **floored at zero**: a log holding more tool entries than a model
  asked for is not a state this product can write, and a negative count would read as a value
  to whichever branch tests `> 0`. It is ZERO for every run that has ever finished a batch,
  which is what makes a non-zero one meaningful rather than noisy.
  **IT IS NOT A SECOND COPY OF `replay`'s `pending`.** That says WHICH calls are pending, with
  their names and arguments, because the loop needs them; this says HOW MANY, because a screen
  needs only whether the run can move. The engine's reader stays the authority on what to do.
- **`run_awaiting` — whether a request is waiting for a person AND can still be answered.**
  Not merely *a row exists*: a decided request is answered, a withdrawn one was answered by
  the withdrawal, and an EXPIRED one cannot be answered at all. Reading any of the three as
  waiting would leave a run in a state whose only exit is a decision nobody can make — which
  is the stranding this column exists to expose. And it is the RUN's own request, never any
  request of the account's: without that, one unanswered question would put every one of
  somebody's runs in the waiting state.

**⚠ `agent.run_work` IS STILL DELIBERATELY NOT JOINED.** It would answer "is there anything on
the queue" directly and is the obvious thing to reach for — but `authenticated` holds NOTHING
on that table, so under `security_invoker` it answers NULL for every customer and a run would
read as stranded the moment somebody looked at it. The log and the approvals answer the same
question from relations the reader can see.

**AND THE COLUMNS ARE APPENDED BECAUSE POSTGRES REQUIRES IT, not because it reads nicely:**
`create or replace view` may only ADD columns at the end. Tidying that order is a broken
deploy — the same rule `agent_overview` already records.

### ⚠ A REAL DEFECT ONLY A REAL DATABASE COULD SAY

`security_invoker` reads every relation **as the caller**, so the new approvals lateral needs
the caller's own SELECT. MEASURED before the fix: `has_table_privilege('authenticated',
'agent.tool_approvals', 'select')` is TRUE and the same question for `service_role` is
**FALSE** — that table was reached only through `security definer` functions until now. So the
CUSTOMER could read the conversation and the SERVER could not, and the server is the reader
every route uses: the site's thread read would have failed `permission denied for table
tool_approvals` **on every conversation that has a message in it.**

- **ONE GRANT, AND IT WIDENS NOTHING.** `service_role` already reads any run's requests through
  `agent.run_approvals`, which is definer and granted to it; this only lets it read them
  without naming a run. The alternative — a definer function inside the view — would put a
  privilege-elevating call inside a `security_invoker` view, which is the one thing that
  option exists to avoid.
- **AND THE PROBE THAT MISSED IT IS WORTH MORE THAN THE FIX.** Read against an EMPTY
  `agent_messages` the view answers `0` happily, because **a lateral is never evaluated for a
  row that does not exist** — so the permission is never checked and nothing looks wrong. *A
  negative assertion needs its observer alive*, and here the observer is a row. The check asks
  the privilege directly AND drives both roles over a row that really exists.

### Seven states on the wire, and the order is the meaning

`queued · working · waiting · unresolved · answered · cancelled · failed`, and the two new
ones are told apart by `awaiting ? "waiting" : open > 0 ? "unresolved" : …`. **A person who CAN
answer is the thing to do, whatever else is true**; only when nobody can does an unanswered
call become a stranding. Reversing those two reports a run somebody could rescue as stranded.

- **BOTH FACTS ARE REFUSED, NEVER COERCED.** `run_awaiting` must be the boolean `true` — a
  string `"false"` is truthy and would put every run in the waiting state — and
  `run_open_calls` must be a real integer, because a view that answered `null` (an older
  deployment, a reader asking for fewer columns) must read as *nothing to say* rather than as
  a stranding.
- **`open` RIDES ONLY ON THE TWO STATES IT IS ABOUT.** One call and four calls are different
  things for somebody deciding what to do; sending `0` on the ordinary states would invite a
  reader to draw it.
- **`queued` IS STILL TOLD FROM `working` BY THE STEP**, which is the distinction that was
  already here and had to survive: `status` reads `running` from the instant a run is accepted,
  because the accepting transaction writes the `started` entry.
- **⚠ A RUN SOMEBODY STOPPED IS NOT A RUN THAT FAILED.** Nothing went wrong — a person asked
  for it to stop — so reading it as `failed` would tell them their own decision was a fault,
  and `cancelled` is the one non-answered stop a screen must not offer to retry. It carries
  who, their own words and how far it got, because *don't claim completed effects were
  undone*: the counts are the only honest thing to say about a cancelled run, so they travel
  with it rather than being left in a journal nothing on the site reads.

### What the demonstration drives

`verify:chat` section 18, through the SITE's own conversation route — the reader a customer
gets — against a real PostgreSQL: a run waiting for a person reads `waiting` and says how many
calls are waiting; **the SAME run, with nobody having touched it, reads `unresolved` once its
window closes**, with the control that putting the window back puts it back in `waiting`; an
ordinary run whose batch was answered is still `working` and says nothing about open calls; a
cancellation reads `cancelled` with the account that stopped it, their words and the counts,
and its work row released; and a run accepted and not yet worked on still reads `queued` while
the database says `running`.

### Measured

- **Real PostgreSQL 16 (`npm run test:pg`): 734 → 756 checks, 0 failed** — 22, and the
  arithmetic closes exactly. The column census by name, both readers' privileges, the count
  over a fully-answered batch and a half-answered one and an impossible log, all four ways a
  request stops being answerable, the cancellation's counts and the projection's two halves
  agreeing, and the isolation through the two new columns with its observer alive.
- **`npm run verify:chat`: 112 → 126 checks, 0 failed.**
- **Engine suite 432 → 435**, 0 failed. **Site suite 6,799 → 6,802** (6,800 pass, 2 skipped,
  0 fail), and the arithmetic closes exactly: `agent-send` 55 → 58 and nothing else moved.
- **⚠ AND THE M4 SITE STAMP OF 6,792 WAS LOW BY SEVEN — corrected in that entry rather than
  edited silently.** Measured in a clean worktree at that commit: **6,799**. The seven are
  M4's own survivor-closing cases, which landed AFTER the number was written down. *Stamp
  measured numbers only AFTER the run* — this directory's first rule, in the entry that quotes
  it, for the second time after M5's own correction. **A worktree run reads one extra FAILURE**
  (`render-sandbox`'s privilege-drop case, which is about writing outside the repository root),
  so the TOTAL is what carries across and the pass count does not.
- **Site sweep: 22 mutants, 22 killed, 0 survived, 0 never applied, 2 comment-only controls
  survived** (the spec 13 → 24 entries). Two survived the first pass and **neither was the
  product's**: nothing drove a junk `cancelledBy` (six shapes now), and — the recorded
  WIRING HOP — nothing asserted that the conversation read really ASKS for the two columns.
  `runView` can be perfect and the view can carry both, and if the `&select=` does not NAME
  them PostgREST does not send them, both readers fail closed, and every waiting or stranded
  run reads `working` again. Asserted on the wire and by NAME rather than by counting, with
  a control that a select list which had stopped naming anything would not satisfy it.
- **The SQL sweep is 231 entries (9 controls) and is RUNNING as this is written**, over
  M4's own migration and this one — neither of which has ever been swept. Its tally is
  deliberately NOT stamped here yet: *a count nobody re-measured is a claim ahead of its
  evidence*, and the two SQL mutants this round adds to the expiry sweep's answer are
  exactly the ones a stale tally would say nothing about.

### ⚠ TWO FIXTURE FAULTS OF MY OWN, both recorded shapes

1. **THE PG SECTION REUSED AN AGENT ID FIVE HUNDRED LINES UP** (`dddddddd-1111-…`), so the
   whole section failed on `agents_pkey` and reported **thirteen correct behaviours as
   broken**. This file is one long body whose fixtures share a database, and the same collision
   is already recorded here once. It has its own ids now and a census that they are unused
   before anything is written, which makes a future collision a sentence rather than a cascade.
2. **`decide_tool_approval` TAKES FIVE ARGUMENTS WITH THE NOTE BEFORE THE DECIDER.** The first
   draft wrote six in another order, Postgres refused the call, and the two checks under it
   failed about a decision that never happened. The call's own answer is asserted now, so a
   refused decision is its own failure rather than somebody else's.

**NOT APPLIED, NOT DEPLOYED, NOT MERGED.** `20260918040000_agent_run_states_are_truthful.sql`
is prepared locally, and the round-number name is this folder's own tell for an unapplied file.
When it goes the order is the recorded one — **migration → engine → site** — and here the
migration's reason is the sharpest yet: the site's thread read asks for `run_open_calls` and
`run_awaiting` BY NAME, so against a view that has not got them PostgREST answers 400 and
every account's conversation fails to load. Not degraded — refused.

---

## Milestone 10: richer workflows — types, loops, error paths, subworkflows (2026-09-17)

Owner: *"Build richer workflows: typed inputs and outputs with validated references;
bounded loops with durable iteration progress; subworkflows with version snapshots and
depth limits; explicit error paths and bounded retries; durable waits for events as well
as time and approvals. Prove that restarting inside a loop, branch, or subworkflow
resumes correctly without repeating completed effects. Enforce execution budgets across
parent and child workflows."*

**FOUR OF THE FIVE ARE BUILT AND THE FIFTH IS DEFERRED ON PURPOSE.** Durable waits for
EVENTS belong with the triggers milestone — an event wait and an inbound event are one
mechanism, and building the waiting half without the arriving half would be a control
that answers — so it is recorded there rather than half-done here.

### Typed values: one table in two languages

`VALUE_TYPES` is `text · number · list` and `TYPE_ACCEPTS` says what may be used where.
A step declares what it PRODUCES (derived at declaration, never taken from a stored row)
and a reference field declares what it ACCEPTS, so a list handed to a field that wants
text is refused **while it is still somebody's form** rather than resolving to
`String(["a"])` at run time.

- **`accepts` MUST PAIR WITH `refs: true`**, or it is an opinion about references on a
  field that takes none — a dead declaration, refused at author time.
- **ABSENT MEANS `text`**, which is what every field that existed before this wanted, so
  nothing moved.
- **AN `accepts` OUTSIDE THE TABLE IS REFUSED RATHER THAN IGNORED**: `TYPE_ACCEPTS[undefined]`
  is `undefined`, and a lookup nothing can satisfy reads exactly like no wall at all.

### Bounded loops, and the iteration is a ROW

`repeat`/`endrepeat`, over a named list or a fixed number of times.

- **`BLOCK_SHAPES` IS A TABLE, NOT TWO HARDCODED NAMES.** `branchMap` walks a stack of
  shapes, so a closer must close its OWN kind of block (an "End of the if" under a
  "Repeat" is refused by name and by position) and a middle marker must belong to its own
  opener. Matching by count alone would pair a loop with a branch's end and balance
  perfectly while meaning something nobody asked for.
- **NOTHING BOUND INSIDE A LOOP SURVIVES ITS END**, and that is the same rule an `if` with
  no `otherwise` already has rather than a special case: a list can be empty, so the body
  may never run, and the zero-iterations path is a real path.
- **THE ITERATION IS DURABLE.** `loops` carries each open repeat's index and its resolved
  list; outcome keys are `<position>#<open>.<iteration>`, so a step inside a loop has one
  outcome per round and a resume reads the round it is really on. **THE LIST IS
  SNAPSHOTTED WHEN THE LOOP OPENS** — the same rule an execution's steps follow at
  acceptance — because a loop re-reading its source each time round would iterate
  something that changed under it.
- **`MAX_LOOP_ITERATIONS` 50, `MAX_LOOP_DEPTH` 2, `MAX_STEP_RUNS` 200**, and the third is
  the one loops make necessary: `MAX_WORKFLOW_STEPS` bounds the LIST, and with loops the
  resource is RUNS. An empty list runs `rounds: 0` and skips the body; an over-long one is
  refused WHOLE rather than truncated.

### Error paths: stop, carry on, or try again

- **ABSENT MEANS `stop` AND STORES NOTHING**, so every workflow saved before this round
  trips byte for byte and nothing is migrated.
- **THE OPTIONS ARE THE WALL AND THEY ARE THE FIELD'S OWN.** `errorPathFields` is derived
  from the step's KIND, so a fifth failable step next month carries the controls by
  existing — and `retry` is simply absent from a step whose answer a second attempt could
  not change, which makes "there is no such path" and "that path is not available here"
  ONE refusal off one declaration rather than a second rule beside the list.
- **`knowledge` IS THE ONLY RETRYABLE STEP**, because it is the only one that reaches
  outside the executor (its `retrieve` is an injected seam to the database), so a refusal
  there can be an outage rather than an answer. `memory` reads a snapshot taken at
  acceptance, `note` substitutes a string and `weekday` compares a date fixed for the
  whole execution: trying any of those again spends a step run to reach the same answer.
- **A BRANCH AND A PAUSE MAY NOT DECLARE ONE, and the two that may not are the interesting
  half.** An `if` is always `ran` — it did its job, which was to choose — and a REJECTION
  is a person saying no, so carrying on past one would be a workflow ignoring them.
- **`continue` DOES NOT MAKE A FAILURE A SUCCESS.** The step keeps its `failed` outcome and
  its own error; what changes is only whether the steps below run. The execution is still
  `done` — it ran to its end as configured — but the stop carries **`carried`**, the number
  of failures it went past, because `done` alone would report a success over a failure
  nobody reads. `executionRow` surfaces it on `done` and on no other state.
- **A RETRY IS A STEP RUN.** The outcome row is overwritten by each attempt, so counting
  rows alone would make retries free against `MAX_STEP_RUNS` and a workflow could buy
  itself unbounded work by asking for them. `runsSpent` adds the durable attempt counts,
  and a retry that cannot be afforded is SAID rather than quietly skipped.
- **THE COUNT IS DURABLE, AND THAT IS THE WHOLE OF "BOUNDED" UNDER INTERRUPTION.** A
  counter living in the process gives every delivery a fresh budget — bounded retries,
  unbounded in practice. It is keyed exactly as an outcome is, so inside a loop it is **per
  round**: round three failing is not evidence about round one and must not inherit its
  exhausted budget.
- **IT GOVERNS THE TWO WAYS A STEP SAYS IT FAILED** — it threw, or it answered `failed` —
  **and nothing else.** A row this deployment cannot read, a reference that resolves to
  nothing, a branch that does not balance: those are not failing steps, they are a workflow
  that does not match what somebody saved, and carrying on past one would run a different
  workflow while reporting the one they wrote.
- **`MAX_STEP_RETRIES` 3, and retries exhausted is a STOP.** Asking for another attempt is
  asking for the step to work, not for its failure to be ignored — so "try three times then
  carry on" is not expressible, which is a stated trade rather than an oversight: the
  alternative is a second choice beside the count, and nobody has asked for it.

### Subworkflows: expanded, not called

- **`expandWorkflow` REPLACES A `workflow` STEP WITH THE CHILD'S OWN STEPS BEFORE THE
  EXECUTION STARTS.** So there is no new wait kind, no parent-child link, no second journal,
  and no way for a child to be stranded while its parent waits — **and the budget is shared
  BY CONSTRUCTION rather than by a check**, which is a stronger statement than the
  requirement asks for: one flattened list, one `MAX_STEP_RUNS`, one set of outcomes, one
  position a restart re-enters.
- **THE SNAPSHOT IS THE STAMP.** Every spliced step carries `from` (the child) and `ver`
  (the version copied in), and the answer carries `uses`. **The innermost origin wins**: a
  grandchild's steps keep the grandchild's stamp, because those are its words.
- **THE IDS ARE RE-MINTED BY FLATTENED POSITION, IN EXACTLY ONE PASS** — the recursion hands
  its steps back unnumbered — because the executor keys outcomes on position and two
  children both numbering their steps `s1` would collide.
- **`MAX_SUBWORKFLOW_DEPTH` 2 BOUNDS THE CHAIN; `MAX_FLAT_STEPS` IS DERIVED FROM
  `MAX_STEP_RUNS` and equals it**, because a list longer than the runs one execution may
  make cannot finish however it is written.
- **A CYCLE IS REFUSED BY NAME AND WITH ITS CHAIN, not as depth.** The bound would terminate
  one either way, and "too deep" about a workflow that calls itself sends somebody looking
  for nesting that is not there.
- **A CHILD THAT DECLARES ITS OWN INPUTS IS REFUSED**, because nothing supplies them: a
  subworkflow shares the parent's values and there is no argument list on the call step, so
  every reference to such an input would resolve to nothing at run time — a workflow that
  saves and then fails. Passing values in is the next increment and is deliberately not
  built.
- **NOT FOUND AND NOT THIS AGENT'S ARE ONE ANSWER**, and the LOOKUP is what enforces that:
  `expandWorkflow` knows nothing about a tenant or an agent, so the wall lives where the
  query is and what comes back here is data.
- **A FLATTENED WORKFLOW IS VALIDATED AS ONE WORKFLOW.** A child may name what the parent
  produced above the call, a forward reference is refused exactly as a typo is, and a branch
  may open in the child and close in the parent — driven both ways round, so "one workflow"
  is a measurement rather than a slogan.
- **A CALL THAT REACHED THE EXECUTOR IS A ROW THAT WAS NEVER EXPANDED**, so it fails by name
  rather than falling through to the action tail, which would read a call as a step that did
  something. Declared pair with the step's own `run`, mutated together.

### ⚠ The stamp did not survive validation, and that is the wiring layer one function along

`readWorkflow` rebuilds each step from its READ config — which is right, and is what keeps
a stored row from carrying a field nothing validated — and therefore DROPPED the `from`/`ver`
a flattened subworkflow's steps carry. The snapshot was written by one function and thrown
away by the one that runs next; a case caught it, not a reading. It passes through now,
**CHECKED rather than trusted** (provenance decides nothing, so a forged pair is a wrong
label rather than a hole, and a wrong label is still worth refusing) and **BOTH OR NEITHER**,
because a `from` with no readable `ver` is a snapshot that cannot say what it captured.

### ⚠ TWO COMMITS WERE PUSHED RED, and the reason is worth more than the fix

The error-path round added an `on_error` control to the step catalog. The browser's form
draws every catalog field generically and **a `<select>` always has a value**, so every step
the form saved began carrying `on_error: "stop"` — bytes no workflow saved before it had, and
the server's "absent means the default" unreachable from the one door that matters.
`test/agent-binding.test.mjs` caught it and I did not run it: I ran the three agent test
files whose NAMES matched what I had touched. **A change to a catalog the form draws from
puts the browser guards in scope whatever their filename says**, which is this repository's
own *re-run the thing the change is asserted by*.

The fix is the opposite rule for the opposite reason, and both halves are now in the code:
a REQUIRED choice has no blank option and no silent default, because one with nothing
selected would save whichever value happened to be first; an OPTIONAL one offers a blank,
because there the server owns what absent means. The blank NAMES the default, the reader
sends nothing for it rather than `""` (a second way to say nothing on the wire), and a new
step is seeded with no answer at all.

### ⚠ And the refusal sentences diverge across the two doors — MEASURED, 15 of them

Driving both validators over every step field with a wrong-kind value: **15 divergences
across 11 fields**, every one pre-existing and none previously guarded. The site's generic
`readStepField` names the field KEY where the engine's bespoke `read` carries its own phrase
(`on_timeout has to be one of: …` against `what happens if nobody answers has to be one
of: …`), and for a non-string in a required TEXT field the engine reads it as BLANK where
the site refuses it as the wrong kind — a coercion.

**THE `empty` SENTENCE IS THE PRECEDENT AND IT IS THE FIX**: the word lives on the FIELD and
both doors read it. That closed the four blank-required divergences this round; the other 15
need `defineStep` to hand each `read` a `said(name)` composer and `readTextField` to refuse a
non-string, which is its own piece of work and is recorded rather than buried in this one.
Two of this round's own readers were written the coercing way and were corrected on the spot,
both caught by the cross-product census within the hour.

### Measured

- **Engine suite 435 → 460**, 0 failed (`automations.test.mjs` 51 → 76).
- **Site suite 6,805** (6,803 pass, 2 skipped, 0 fail); `agent-send` 55 → 61,
  `agent-automations` 37.
- **Engine sweep spec 457 → 492 entries** (9 controls). The pass at the error-path commit
  read **469 mutants, 467 killed, 2 survived, 8 comment-only controls**, and neither survivor
  was the product's: one a real guard gap (nothing asserted the attempt count comes back on
  the ANSWER as well as on the checkpoint — two readers of one fact) and one MEASURED INERT
  over 252 stored-row shapes and declared a second wall in the code. **That pair cannot be
  swept as one**: its halves are a thousand lines apart and the runner applies one
  replacement per mutant, so the spec records it as a comment-only control over the
  declaration that explains it. The subworkflow mutants have not been swept yet.
- **Site sweep (`scripts/mutants/workflow-errors.json`): 10 mutants, 10 killed, 0 survived,
  0 never applied, 1 comment-only control.** One survived the first pass — the stray-path
  refusal's ORDER — because every other shape in the census has ONE thing wrong with it, and
  one thing wrong cannot tell an order. Closed with two shapes on `repeat`, whose own field
  refusals already agree word for word because `says` was declared on them.
- **The restart matrices: the LOOP one is 10 cuts over a four-round loop, the RETRY one walks
  every checkpoint of a step that keeps failing, and the SUBWORKFLOW one walks a loop that
  lives inside a child.** Each derives its boundary count from the uninterrupted chain and
  each has its observer proved alive by throwing the durable state away. **⚠ AND THE RETRY
  MATRIX'S FIRST OBSERVER WAS DEAD**: a retriever that fails twice and then works answers its
  THIRD call successfully whichever delivery that call lands in, so the total is three either
  way. The store never recovers now, and the assertion is the number of attempts the step was
  ALLOWED.

### ⚠ IT IS WIRED NOW — and driving it found two real defects (2026-09-18)

The entry above recorded the gap on the day it was created: `expandWorkflow` had no caller.
It has one, and **getting there through the real routes, the real dispatcher and a real
PostgreSQL found two defects that every module test and every earlier demonstration passed
straight through.**

**THE WIRING.** `agent.automation_children` — every automation of ONE agent, scoped to the
tenant AND the agent, because both agents of one owner share a tenant and only the agent id
tells them apart. `agent.set_automation_plan` — the flattened list and what was copied in,
fenced by the caller's own claim, **writable only while `position = 0`**: past it, replacing
the list would renumber outcomes that already exist. `loops`, `tries` and `uses` are columns
now, read back by the store and forwarded on every checkpoint. And `agent.automation_calls`
refuses, **at save time and in the transaction**, a call naming another agent's automation or
itself — a check outside the write can be raced, which is what this schema already says about
agent ownership two functions down.

**NO FLAG SAYS WHETHER AN EXECUTION HAS BEEN EXPANDED, and none is needed**: a flattened list
holds no `workflow` step, so the absence of one IS the flag, in the only place that can see
it. A redelivery whose first attempt expanded and then died finds the plan written and skips
the whole block — driven, with the child REWRITTEN at a new version between the two
deliveries, because a second expansion would be a run executing a list its record never held.

**A WORKFLOW THAT CANNOT BE ASSEMBLED IS A FAILED EXECUTION WITH ITS REASON**, never
`unreadable`: taken off the queue with nothing a customer can act on is the answer that sends
somebody nowhere. And **the version bumps on a change of STEPS and nothing else** — the rule
`agent.save_memory` already follows one table over, because a version says which WORKFLOW a
parent copied in, so renaming an automation must not move it.

#### ⚠ DEFECT 1 — A LOOP'S SECOND ROUND COULD NOT BE RECORDED AT ALL

`agent.advance_automation_run` carried `position <= p_position` as half its guard, on the
reading that progress only ever moves forward. **A `repeat` moves it BACKWARDS by design**:
round two re-enters the body below the high-water mark round one reached, so every checkpoint
inside it failed that condition and was a silent no-op — and the answer was `ok: true,
advanced: false`, which the store's own documentation called *"the progress was already
recorded — a retry, and safe"*.

**MEASURED END TO END, through the real function**: a two-round loop holding a wait recorded
round one, advanced past the wait, jumped back, paused again — and the pause was never
written. The execution sat at the position after the wait with nothing waiting and nothing
finished. **A STRANDED RUN**, which is the exact thing milestone 9 exists to stop, produced by
the guard that was meant to protect it.

**WHAT IS MONOTONIC IS THE OUTCOME COUNT, and it stays so with loops and retries both**: a
new round appends its own keys and a retry overwrites the key it already has. So that is the
guard, a stale call carrying fewer outcomes is still refused, and **the position is no longer
a progress measure at all** — it is where in the list the next step is. The wall against a
displaced worker is the FENCE, which `append_entry` has already applied by the time the row
is touched.

**AND THE RUNNER SAYS WHEN A CHECKPOINT DID NOT LAND.** `advanced: false` with `ok: true` is
the ordinary answer to a redelivery replaying recorded work AND exactly what a disagreement
looks like, so it goes in the log rather than being inferred later from a position that does
not add up. **That silence is what this defect hid behind** for every round after the first.

#### ⚠ DEFECT 2 — A WAIT INSIDE A LOOP WAS HONOURED ONCE

The stored pause records a step ID and nothing else, so on round two the same id matched,
the already-passed deadline read as this round's, and the wait answered *"already over"*. The
execution finished having honoured one of the two waits it was asked for. **A resume is SPENT
BY ITS FIRST ARRIVAL now**; every later one is a fresh pause, which is what each round is.

**AND ITS CONSEQUENCE IS A WALL RATHER THAN A FIX.** An `approval` inside a loop cannot be
made right this way: `agent.automation_runs.decisions` is keyed by the step's id and the first
decision stands, so every round after the first would take the first round's verdict **with
nobody asked** — worse than a stranding, because it is an approval nobody gave. Refused where
the workflow is WRITTEN, in both validators, word for word, and **derived from a `decided`
flag on the DECLARATION** rather than a list of names: a second such step next month carries
the wall by existing. `defineStep` refuses a junk `decided` and refuses it on a step that
cannot pause at all, because a flag about how a resume is matched is a dead declaration there.
Making an approval per-round means keying the decisions by the outcome key, which is a
migration and is not this.

#### ⚠ A VALUE MAY NOT CROSS THE CALL BOUNDARY YET, and that is MEASURED

Each half is validated on its own when it is saved, so a child naming something the parent
produces **cannot be saved**, and neither can a parent naming something the child produces.
The flattened list validates as one workflow — which is what makes the increment small — but
nothing saved in two pieces can reach it. Both refusals are driven through the route, so the
limitation is a measured fact rather than a note about one. Passing values across the call is
the next increment.

#### ⚠ AND A SITE SWEEP SURVIVOR WAS A FIXTURE LESS CAPABLE THAN A BROWSER

A `<select>` with nothing selected answers its **FIRST option**, never the empty string —
HTML's own selectedness algorithm — and `hydrateAuto` answered `""`. So a mutant removing the
blank option from every OPTIONAL choice SURVIVED: a real browser would have read back the
first option and stored a default nobody chose, and the fixture read back nothing and called
it correct. Killed now, by name, by the case that caught the red commit a day earlier.

### Measured

- **Engine suite 460 → 470**, 0 failed. Four in `automations.test.mjs` (a wait honoured on
  every round of a loop with its outside-a-loop control, the `decided` wall with three
  controls, and `defineStep`'s own refusals) and six in `worker.test.mjs`, which drive
  `worker.queue` over the in-memory fake — **because `npm run sweep` does not run
  `verify:wf`**, and a property proved only there is a property no mutant can be caught by.
- **Real PostgreSQL (`npm run test:pg`): 756 → 792, 0 failed.** Seven for the loop's own
  round (a LOWER position with MORE outcomes moving the row, the stale call with fewer
  outcomes still refused as its control, and both new parameters refused rather than
  coerced) — and **twenty-nine for the fifteen SQL sweep survivors below**.
- **`verify:wf` 125 → 157, 0 failed**: two new sections through the customer's own routes.
  **`verify:auto` 70 · `verify:tools` 112 · `verify:ops` 53 · `verify:controls` 71 ·
  `verify:chat` 126 — every one unchanged**, which is the control that this round broke
  nothing. **Site suite 6,806** (6,804 pass, 2 skipped), also unchanged.
- **Sweep spec 492 → 523; SQL spec 231 → 232.** Two engine anchors and one SQL anchor
  re-anchored, not appeased — and **the SQL one ASSERTED THE DEFECT**: `position <=
  p_position` was half a guard the sweep required to EXIST. The mutant that puts it back is
  the one only a loop can kill, and it is in the spec now.

### ⚠ THE SQL SWEEP FOUND FIFTEEN SURVIVORS, AND NOT ONE WAS THE SCHEMA'S

Every one of those properties is proved end to end by a `verify:*` script, and
`npm run sweep:sql` runs `pg-schema.mjs` and `authored-run.test.mjs` **and nothing else**.
*A property proven only by an instrument the sweep cannot run is a property no mutant can be
caught by* — **the fifth recorded instance in this directory**, and the first where a whole
round's worth arrived at once.

**AND ONE ATTRIBUTION IN THESE NOTES WAS WRONG, found by measuring rather than by reading.**
The stopword refusal and the memory scope are recorded above as `test:pg`'s and are
`verify:wf`'s: applying the stopword mutant to the current tree in a detached worktree left
`test:pg` **763 passed, 0 failed** with the wall deleted.

They belong in `pg-schema.mjs` — they are database guarantees, and that is the instrument a
SQL mutant can be seen by. What the twenty-nine checks cover:

- **either identity is absorbed on an accept**, and a redelivery is answered rather than
  raised; **a run id belonging to ANOTHER automation is refused instead**;
- **the first decision stands**, and with no decider named it is the account that answered;
- **the resume tick** is bounded, never offers a finished execution, and `skip locked` is
  driven under REAL CONCURRENCY — a second session holds the row and `lock_timeout` turns
  waiting into an observable refusal. **The row-lock helper takes a TABLE now** rather than
  being copied, because that is the same property one relation over;
- **nothing-to-look-for is not everything**, both ways round, with its control;
- **a memory's scope is (account, agent)** — and ⚠ **THIS LINE SAID IT WAS DRIVEN BY "two
  accounts sharing an AGENT ID … reachable, because an id is a uuid and not something one
  account owns", WHICH IS FALSE OF THE `agents` TABLE AND TRUE ONLY OF THE INDEX.**
  Corrected 2026-09-18 by asking the schema: `agent.agents.id` is a PRIMARY KEY on the id
  ALONE, so two accounts cannot have an agent of one id at all, and a cross-account
  `delete_memory` is answered `no-agent` rather than reaching a row. **The two layers
  separate differently and both are driven now**: the FUNCTION's wall is the other
  account's own agent (`no-agent`, never a silent no-op), and the INDEX's scope is a memory
  row carrying a mismatched pair — which only the table's owner can insert, which is also
  why the function's wall is the real one. Found by writing a check on the old sentence's
  premise and watching it fail;
- **a `step` entry must name where it got to** and must not carry a tool index;
- **an operation record must say what happened**, and is the account's alone.

**⚠ ONE EXPECTATION WAS MINE AND WRONG.** I predicted `automation_runs_pkey` for another
automation's run id; the answer is the function's OWN raise, because the insert meets the key,
`on conflict do nothing` absorbs it, and the re-read IS scoped to this automation and finds
nothing. Re-anchored onto that gate, which is the better one to name: it is what separates
*"another automation's run id"* from *"this automation's repeat"*.

### NOT APPLIED, NOT DEPLOYED, NOT MERGED

The migration is prepared locally, and the loop/retry/subworkflow work went **into
`20260917120000` in place** rather than into a fifth file — it is unapplied, which this
folder's round-number naming is the tell for, and that is the recorded rule.

**⚠ AND EDITING IT IN PLACE HAD TO BE DONE THE RIGHT WAY ROUND.** The first cut appended a
SECOND `create or replace function agent.advance_automation_run` at the end of the same file,
which is the recorded *"a position is not an identity"* trap arriving through position WITHIN
a file rather than through migration order: four SQL anchors became AMBIGUOUS, and the
generator refused rather than pointing a mutant at the superseded copy. **The pre-check is
what caught it**, which is the pre-check working.

When it goes, the order is the recorded one — **migration → engine → site** — and here the
site's half is real: `automation-create` and `automation-update` answer two new refusals in
their own words, so a site shipped first would show *"that agent isn't here any more"* about a
workflow, which is false and sends somebody to look at the wrong thing.

---

## Milestone 6: triggers — a one-off, a weekly schedule, an inbound endpoint, an event (2026-09-18)

Owner: *"Expand triggers: one-time and weekly schedules, authenticated webhooks, and internal
events through the existing durable dispatcher. Verify event deduplication, timezone/DST,
missed occurrences, disabled automations, paused agents, cancellation. Bound recursive event
chains. For event waits, handle an event arriving around the moment the workflow starts waiting
without losing it or applying it twice."*

**FOUR TRIGGERS NOW, AND `AUTOMATION_SCHEDULES` IS A DECLARED COPY IN THREE LANGUAGES** — the
engine's, the site's, and the database's own `automations_schedule_known` CHECK, censused in
`test/agent-send.test.mjs` (the one file that may load both products) with the constraint read
out of the migration. A schedule an agent or a screen can ask for that the database refuses is a
control that answers and then fails at the save.

| trigger | what it is |
|---|---|
| `manual` | a person presses Run |
| `daily` | a local time in the automation's own zone |
| `weekly` | a local time on chosen DAYS — `days text[]`, stored in the week's own order |
| `once` | a local time on one DATE, and no next instant afterwards |
| `on_event` | **not a schedule at all — a second, independent way in** |

**AN EVENT IS NOT A FIFTH SCHEDULE AND THAT IS THE ONE DESIGN DECISION WORTH ARGUING.**
"Every morning AND whenever a payment lands" is a thing somebody wants, so folding the two into
one field would make it unsayable; `on_event` is answered for every schedule, and a `manual`
automation that also listens is the ordinary shape of *"I can run this myself, and it runs
itself when something happens"*.

### The day arithmetic is the database's, and DST is one function

`automation_next_run` is the only place it lives, so a 09:00 London schedule is 08:00Z in
summer and 09:00Z in winter **from one stored row** — measured both ways in the demonstration.
A weekly one walks forward to its next named day; a one-off answers its date's instant and then
`null` for ever, which is what makes it one-off rather than a daily with a stop somebody has to
remember. A calendar date that is not a day (`2026-02-30`) is refused rather than rolled
forward, and a weekly schedule with NO days is refused because it would never come due.

**MISSED OCCURRENCES STAY ONE RECORD, not a burst**, on a weekly schedule as on a daily: a week
behind produces one `missed` row counting the occurrences that went by, **counted in LOCAL
DATES** rather than by dividing an interval, because a local day is 23 or 25 hours long twice a
year — and a week of Mondays and Fridays is not seven days, which is the reading a daily
schedule's arithmetic would get wrong here.

### An inbound endpoint: the account is what a delivery ANSWERS

`src/webhooks.mjs`. `POST /deliver/<id>`, and it is the ONE other route with no bearer token.

- **THE SIGNATURE IS HMAC-SHA256 OVER `${timestamp}.${rawBody}`**, compared with a
  constant-time `sameSignature` that checks the LENGTH first. The window is two-sided
  (`DELIVERY_WINDOW_MS`, 5 min), so a replay from last week and a clock far ahead are both
  refused.
- **⚠ THE ACCOUNT COMES FROM THE VERIFIED ENDPOINT ROW AND NEVER FROM THE PAYLOAD.** The
  demonstration posts a body carrying `tenant`, `tenant_id` and a `name` of its own; the event
  is recorded under the ENDPOINT's account with the ENDPOINT's event name, and the body reaches
  `payload` and nowhere else. **The event a delivery raises is fixed at creation**, which is the
  difference between an endpoint and a way to run any automation.
- **ONE SENTENCE FOR EVERY REFUSAL**, so the route is not an oracle: a wrong secret, a stale
  timestamp, one far in the future and an endpoint that does not exist all answer
  `401 this delivery was not accepted`. Measured — all four bodies identical.
- **THE SIGNATURE AND THE TIMESTAMP ARE ASKED BEFORE ANY SECRET IS READ**, so an unsigned
  delivery costs no database round trip and cannot be used to probe which ids exist.
- **`503` IS OURS AND `401` IS THEIRS.** Our own outage is not a refusal of their delivery, and
  `too-deep` is a 503 too — the chain is our bound, not their fault.
- **A RETRIED DELIVERY IS ONE EVENT AND SAYS SO** (`repeat: true`), keyed on the delivery id
  through `agent.events`' own `events_one_per_key`.

**THE SECRET IS MINTED SERVER-SIDE AND ANSWERED EXACTLY ONCE.** `agent.create_webhook` takes it
and does not hand it back; `agent.list_webhooks` never selects the column; no route reads one
off a request. So the create's own answer is the only time it exists outside the database, and
the sentence beside it says so. **There is no rotate**, deliberately: a rotate has to answer the
new secret, which is a SECOND door that gives one out, and delete-and-make-another does the same
job through the door that already exists.

**⚠ AND IT IS A PATH, NOT A URL.** This product does not hold the engine's origin — the site
rings it through a queue BINDING, which carries no address — so composing one would mean
inventing it, and an invented origin is a URL somebody configures their system with and which
never works. `webhookPath` answers `/deliver/<id>` and stops there.

### An event files what it triggers AND wakes what waited for it, in one transaction

`agent.dispatch_events`, on the cron's **fifth** job. The stamp (`handled_at`) is what makes
both happen exactly once, so doing them in two transactions would leave a window in which one
had happened and the other had not. `for update skip locked`, so two ticks cannot dispatch the
same event and a slow one does not block the rest.

- **FIVE CRON JOBS, FIVE `try` BLOCKS**, and none may silence another. The event job is last
  because it is the newest and least load-bearing: a throw there must not cost the deployment
  its sweeper.
- **THE RING IS SEPARATE FROM THE DISPATCH**, exactly as the scheduler's is: the work is
  committed by the time a run id comes back, so a failed ring costs latency and never work.
  Every row carries a LIST (`ring`) because one event can file a trigger AND wake a waiter.
- **THE DEPTH BOUND IS THE DATABASE'S AND IS TAKEN FROM THE EMITTING RUN, never from the
  caller.** `MAX_EVENT_DEPTH` is 4, `p_max_depth` is the function's own default and nothing
  sends one — a caller-supplied depth is a bound a caller can reset. Past the ceiling the emit
  is refused BY NAME with both numbers and nothing written, because a chain that stops silently
  is one nobody can debug and a chain that does not stop is a platform one workflow can occupy.

### The arrival race, and it really is two halves

**AN EVENT CAN ARRIVE IN THE INSTANT BETWEEN A WORKFLOW DECIDING TO WAIT AND THE ROW SAYING SO,
and neither side alone closes it.** `dispatch_events` wakes what is ALREADY suspended;
`hear_pending_event` asks, for a run that is waiting NOW, whether an event it wants arrived
while it was not yet visible. Both take the row lock, which is what makes the pair exhaustive
rather than two attempts. `heard ? step` is what stops one event being applied twice.

- **THE CLOCK BOUNDS THE SECOND HALF AND NOT THE FIRST, and the demonstration's first draft
  conflated them.** `dispatch_events` compares no clocks at all and is right not to: an event is
  NEWS until it is stamped `handled_at`, so an old undelivered event reaching a waiter is the
  dispatcher doing its job. `hear_pending_event` looks at events ALREADY dispatched, and without
  the pause's own `since` a pause would consume any event of that name from last week. The two
  arms are each other's control: an already-dispatched event dated BEFORE a pause is not
  consumed; one dated after it is.
- **IT IS THE DATABASE THAT PUTS THE WORK BACK.** The consumer never produces — that is this
  Worker's own rule and why its configuration asks for no queue binding — so
  `hear_pending_event` calls `requeue_run` in the same transaction as the `heard` write and the
  cron's sweep is the belt. **The cost is one tick, said out loud**, and the demonstration asserts
  it by ticking rather than by draining a doorbell nobody here may ring.
- **ASKED ONLY FOR AN EVENT PAUSE.** A timed wait has its deadline and an approval has a person;
  asking either would be a round trip that can only answer "no".
- **A FAILED HEARING IS LOGGED AND NEVER RAISED.** The pause is committed, so the worst case is
  the recorded wait taking a tick longer — raising would report a committed pause as a failed
  run, take it off the queue and tell a customer it broke.

**AND AN EVENT WAIT CANNOT GO INSIDE A LOOP**, for the reason an approval cannot: `heard` is
keyed by STEP and accumulated, so round two would read round one's event and carry on with no
second event. `EVENT_WAIT` carries `decided: true` and the wall is DERIVED from that flag rather
than from a list of names, so a third such step next month carries it by existing.

### What the demonstration drives, and what it cannot

`npm run verify:triggers` — **64 checks, 0 failed**, nine sections, and every piece is the real
one: the SITE's own routes through `handleAgentApi`, `worker.fetch` for a delivery,
`worker.queue` and `worker.scheduled` as the dispatcher with all five cron jobs in one call, and
a throwaway PostgreSQL with this repository's migrations applied. **NOT ONE EXECUTION ANYWHERE
CALLED A MODEL**, asserted outright.

**WHAT IS SIMULATED, in one place and named in the file's own header**: the transport (PostgREST
is a local shim, the queue an in-process doorbell) and **TWO CLOCKS PUSHED rather than waited
out** — a schedule's `next_run_at` moved into the past, and an event's `at` set relative to a
pause. What that does NOT simulate is any DECISION: `tick_automations` still selects on
`next_run_at <= now()`, `automation_next_run` still does its own zone arithmetic, and
`hear_pending_event` still compares against the pause's own `since`.

### ⚠ Five things it found, and not one by reading

1. **THE LOCAL SHIM'S COLUMN FILTER WAS SILENT, AND ITS OWN NEIGHBOUR'S COMMENT SAID SO.**
   `selectOf` filtered the asked-for columns against an allow-list and carried on with whatever
   survived — so `heard`, which that set had not been extended with, was absent from every
   execution read, `plainObject(undefined)` answered `{}`, and an event wait read that as
   "nothing heard yet" and **RE-PAUSED FOR EVER** with the engine, the store and the migration
   all correct. The set's own comment two lines above says *"or — worse, if the filter were
   silent — answer a restart that a loop is at its beginning"*, and the filter was silent.
   It REFUSES now, in PostgREST's own words (`400 42703`, naming the column and the relation),
   and **a filter-shaped query parameter on an unknown column is refused too** — that one comes
   back WIDER than was asked for, so a read scoped to one account could answer another's.
   *A shim MORE forgiving than the thing it stands in for hides a defect exactly as well as one
   that is less capable* — the fourth instance in this product.
2. **THREE `_once` WRAPPERS DID NOT FOLLOW THEIR INNER FUNCTIONS.** This migration widened
   `accept_automation_run`, `create_automation` and `update_automation`; the wrappers in
   `20260918020000` were written against the old arity, and the shim DERIVES each wrapper's
   argument list from its inner function. So it sent more arguments than the database would take
   and `run_automation` answered `HTTP 400 … does not exist` — **THREE demonstrations red at
   once, on a wrapper, an inner function and a shim that were each correct alone.** All three
   are widened here beside the functions they wrap, the narrow overloads dropped, and a census
   in `test/integration/pg-schema.mjs` asks the rule of all six off `pg_proc` **with its
   comparator proved to discriminate** — a wrapper one parameter short must not satisfy it.
   **A door narrower than the thing behind it has to be widened eventually anyway**, and the day
   it is, the drift is found by whoever is least expecting it.
3. **THE CRON'S EVENT LOG TALLIED A FIELD THAT DOES NOT EXIST.** `dispatch_events` answers
   `{event_id, name, filed, woke, ring}` and the job counted an `action`, so every tick printed
   `{"events":1,"rung":0,"?":1}` whatever it had done — **a log whose numbers cannot move is not
   an instrument**, which is this product's own `requeue_expired_approvals` finding one job over.
   It reports `filed` and `woke` now, kept APART: ten automations triggered and ten waiters
   released are different facts.
4. **FOUR SQL FUNCTIONS HAD NO CALLER.** `create_webhook`, `list_webhooks`,
   `set_webhook_enabled` and `delete_webhook` are reached by four site routes now. *A value
   computed and never forwarded* is this repository's most-recorded defect, in DDL.
5. **A SCHEDULE THAT IS NOT A WORD WAS SILENTLY `manual`, ON BOTH DOORS.** `text(v)` answers
   `""` for a non-string, so `schedule: ["daily"]` created an UNSCHEDULED automation and
   answered `ok` — and the site's own `cleanSchedule` had the identical shape. Both refuse now,
   with THREE sentences: absent is `manual`, a blank is its own refusal, and a non-string says
   what it should have been. Found by a guard written for a different mutant.

### ⚠ THE SWEEP SAID THE WHOLE ROUND WAS UNGUARDED — 32 survivors, none of them the product's

Every property above is proved by `verify:triggers`, which `npm run sweep` does not run. *A
property proven only by an instrument the sweep cannot run is a property no mutant can be caught
by* — **the FIFTH recorded instance in this directory, and the first where a whole round's worth
arrived at once.** Fourteen module cases close them, and the one worth naming is **the request
the store really sends**: a census over all four event operations with its own count asserted,
because ten of the survivors live inside those bodies and the ANSWERS cannot see any of them.
It also asserts what is NOT on the wire — `p_max_depth`, because a caller-resettable bound is no
bound.

**SIX OF MY OWN ASSERTIONS WERE WRONG BEFORE THEY WERE BELIEVED**, and each is a recorded shape:
the endpoint reader answers `tenantId` and I asked for `tenant`; an approval needs `hours` and
without it the step RAN rather than suspending; `readWorkflow` answers FLAT steps and I asked for
the executor's internal `{config}`; an event name FOLDS case, so my "bad name" case was passing a
good one (asserted positively now, beside names no fold can rescue); a GET to `/deliver/…` is a
401 from the TOKEN GATE, so the status could not tell it from the delivery handler's — the
sentence can; and counting REQUESTS read `change_automation`'s legitimate pre-check READ as a
write.

**AND ONE CONTROL OF MINE ASSERTED NOTHING** — a tangle of `?.` and `??` that never called
`deliver` at all. A negative assertion is only worth what its observer is worth.

**THE RUNNER HARNESS HAD TO GAIN THE EVENT SIDE**, because the runner really calls
`hearPendingEvent`: a fake without it makes that hop throw, which the runner logs and never
raises, so every case would have passed over a hop that does not work.

### Measured

- **`npm run verify:triggers`: 64 checks, 0 failed** (new).
- **`verify:tools` 112 · `verify:ops` 53 · `verify:controls` 71 · `verify:auto` 70 ·
  `verify:wf` 157 · `verify:chat` 126** — every one green at its recorded count, which is the
  control that this round broke nothing, and every one of them now runs against a shim that
  REFUSES a column it used to drop.
- **Real PostgreSQL (`npm run test:pg`): 853 → 877 checks, 0 failed** — 59 for the triggers
  section itself and 18 for the wrapper census, whose comparator is proved to discriminate.
- **Engine suite 490 → 508.** Site suite **6,807** (6,805 pass, 2 skipped, 0 fail).
- **THE SWEEP TALLIES ARE DELIBERATELY NOT STAMPED HERE UNTIL THE RUNS END** — *a count nobody
  re-measured is a claim ahead of its evidence*, and this directory's first rule is to stamp
  only afterwards. Both are running at this commit, in detached worktrees, so the main tree
  holds no mutant while they do.

**NOT APPLIED, NOT DEPLOYED, NOT MERGED.** The migration is prepared locally and the
round-number name is this folder's own tell for that. When it goes, the order is the recorded
one — **migration → engine → site** — and here every link has its own reason: the migration
because the site's list route reads `agent.automations`' three new columns BY NAME (a 400, not a
degradation), the engine before the site because an endpoint the site lets somebody create is an
endpoint no `/deliver/<id>` would answer, and the site last because it is the only half a person
touches.
