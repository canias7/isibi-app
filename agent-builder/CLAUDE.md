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
- **`store.mjs`** — where the log is kept: Supabase, over PostgREST.
- **`work.mjs`** — the durable queue's memory: six RPCs over the same wire.
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

### Exactly one execution, and three things enforce it

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

## The SQL mutation sweep (2026-09-15)

`npm run sweep:sql` — **20 mutants, 20 killed, 0 survived, 0 never applied, 1
comment-only control.** Focused on the four guarantees the notes make loudest:
tenant isolation, duplicate prevention, journal immutability, whole-run deletion.

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

### The four things a live verification checks

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
   again refuses again without repeating the action.

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

### Measured

- **Unit suite: 222 tests, 0 failures** (`cd agent-builder && npm test`). 161 before
  the queue round, 219 after it; the three since are `/health`, the grace-versus-beat
  invariant and the lease knobs' fallback.
- **Schema check: 125 checks, 0 failed** against a real PostgreSQL 16.13
  (`npm run test:pg`), over all THREE migrations — 78 before the queue, and the 47
  are the queue's own (accepting, the claim, the lease, the resume, the grants, the
  cascade) plus the long-healthy-run pair a sweep found missing. Skips with a
  message, and exits 0, where there is no local cluster — "no database here" is not
  a failing schema.
- **The long run, end to end: a 75 ms response and 65,593 ms of work after it**
  (`npm run demo:long`), with **9 progress observations** while it ran, all 8 stages
  executed, and every entry in a real PostgreSQL. Re-run on the final tree, not
  carried over from the first pass — the first read 82 ms / 65,630 ms.
- **The live project: 30 behavioural checks, 0 failed**, driven against
  `ujrqdmmtcptvimazlhom` and rolled back, with both tables left empty. The six
  queue function bodies match this repo's migration **byte for byte**
  (`md5(pg_get_functiondef(...))` compared against a local apply, before and after a
  comment-only edit to the file).
- **The live verification, driven end to end: 50 checks, 0 failed**
  (`npm run verify:local`) — the same `verify-live.mjs` an operator points at a
  deployment, run unmodified against a real PostgreSQL with these migrations and TWO
  separate consumer processes. The handover: a consumer lost the run at 2 steps,
  another took it over **5 s later**, and it finished at 9 steps with **9 model
  entries for 9 steps**. The blocked action: **1 model entry, 0 tool results** —
  the in-flight result was never written, no stop was recorded, and asking again
  refused again.
- **The auth probe: all checks passed** against the live project
  (`scripts/auth-probe.mjs`) — the published ES256 key imports, and Supabase Auth
  answers a genuine token and a tampered one differently.
- **NOTHING ELSE IN THE TREE CHANGED: its suite reads 6,316 tests, 6,314 passing,
  0 failures** — run BEFORE this directory existed, again with it present, and
  again after the queue round: same count, same colour every time. Measured, not
  argued from the path filters. (In a fresh container that
  suite needs `npm ci` first or ~361 cases fail on missing modules — the
  environment, not the code.)
- **Code sweep: 173 mutants, 173 killed, 0 survived, 0 never applied, 3
  comment-only controls survived** (`npm run sweep`). Measured after the run, not
  before it. The passes went 34 (the first four modules) → 54 (the journal and
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
- **SQL sweep: 43 mutants, 43 killed, 0 survived, 0 never applied, 2 comment-only
  controls survived** (`npm run sweep:sql`), over all three migrations. 22 before
  the queue; the 21 are the claim, the lease, accepting, asking again and the
  grants.
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
