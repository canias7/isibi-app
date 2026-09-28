# Containers and jobs

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). How every rung runs in
> the site's own container with no clock, the transport its model calls take,
> how a job records where it ran, and the two free probes (a long hold, and a
> wire with no model in it). The short summary CLAUDE.md
> kept moved here in the second pass (`git show 28bdc97f:CLAUDE.md`) and is the
> first section below.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

### Containers and jobs, in brief

The full law is `docs/containers-and-jobs.md`. **Every rung runs in the site's
own container, and the container has no clock**: `CONTAINER_*_BUDGET_MS` is
`Infinity`; the lease (`LEASE_TTL_S` 90, `HEARTBEAT_S` 30) is a liveness check
and never a cap. **One setting, `builder/job-duration.mjs`**: a job's deadline
is **50 minutes** (`JOB_MAX_MS`), and the SIGTERM, the SIGKILL and the busy
hold (**52.5 minutes**, `MAX_BUSY_HOLD_MS`) are derived from it under
`edit_handoff`'s 3,600-second limit; `JOB_MAX_MINUTES` may only shorten it. The
per-call ceilings stay: `STEP_TIMEOUT` 30 minutes, `CONTAINER_CALL_MS` and
`BUILDER_CALL_MS` 600 s, `QUICK_STREAM_MS` 480 s, `QUICK_CALL_MS` 240 s. A
job's model calls take the container's own `node:https` transport and stream
(`builder/long-post.mjs`, never imported by `worker.js`), and `callFailure`
names a failure (`headersMs`, `chars`). A fire answers `fired` (409 included),
`inline`, `retry` (3 tries, 2 s apart) or `stop` (503 `no-container`, nothing
spent). `JOB_RUNNER_EVERYONE` is on. The hold probe proved a 20-minute job
child in the container (1,200,182 ms, 20 of 20 pulses); the transport probe's
reading is still to take.

---

### EVERY RUNG RUNS IN THE SITE'S CONTAINER, AND THE CONTAINER HAS NO CLOCK

Owner, 2026-09-14: *"addon, edit and build gotta run on the container, just like
the build path"* → ***"Containers shouldn't have a time limit."***

**THE CLOCK WAS THE TRAP IN THE MONEY PATH.** `EDIT_JOB_MS` is 840,000 —
fourteen minutes, and every word of its reasoning is about a Cloudflare ISOLATE
(`CONSUMER_CEILING_MS` stops a consumer at fifteen). Inside the container there
is no such ceiling. Builds moved across 2026-09-06 and got their own pair; the
edit branch was wired the same day and **passed no budget at all**, so it fell
back to the Worker's number. *A rule true because of a layer below it expires
when that layer moves* — first in the path that spends money. It cost run 44 an
addon at 12m22s with the database made, the page written and nothing published.

| bound | now | what it governs |
|---|---|---|
| `CONTAINER_*_BUDGET_MS` | **`Infinity`** | the WORK — `expired()`, `spendable()`, every gate |
| `CONTAINER_EDIT_JOB_MS` / `BUILD_JOB_MS` | **50 min** | the token's life; SIGTERM to a wedged child |
| `MAX_BUSY_HOLD_MS` | **52.5 min, derived** | how long a BUSY container is held — the bill |
| per call: `STEP_TIMEOUT` 30 min, `CONTAINER_CALL_MS`/`BUILDER_CALL_MS` 600 s, `QUICK_STREAM_MS` 480 s, `QUICK_CALL_MS` 240 s | unchanged | each model call and each subprocess |

- **THE LEASE IS A LIVENESS CHECK AND NOT A DURATION CAP** — this is what makes
  the removal safe rather than merely permitted. `edit_sweep_lost` selects on
  `lease_expires_at < now() - p_grace` and **never on elapsed**, `LEASE_TTL_S`
  90, `HEARTBEAT_S` 30. A job that keeps beating is NEVER swept however long it
  runs; a job that dies is reclaimed in ~90 seconds. What the lease cannot see
  is a process that is alive, heartbeating and looping — our own bug — and that
  is the one thing the deadline is for, beside the credential.
- **FIFTY MINUTES IS A LIVE RPC, NOT A PREFERENCE.** `HANDOFF_TTL_S` is DERIVED
  as `MAX_BUSY_HOLD_MS / 1000` and `edit_handoff` raises `bad ttl` past
  **3600 s**, so `deadline + JOB_KILL_GRACE_MS + JOB_TERM_GRACE_MS + 60s ≤
  3600s` caps the deadline at **57.5 minutes**. Fifty leaves 450 seconds.
  **Lifting it is a migration**, not a constant this repo can move.
- **`MAX_BUSY_HOLD_MS` WAS A SHIPPED DEFECT.** It was 30 minutes while
  `BUILD_JOB_MS` was ALSO 30, and the build service stops a child at its
  deadline + `JOB_KILL_GRACE_MS` (60 s) and kills it `JOB_TERM_GRACE_MS` (30 s)
  later — so a job that ran to its deadline had its CONTAINER stopped a minute
  BEFORE the SIGTERM that lets it end as a job. **The graceful path was
  unreachable at exactly the moment it exists for.** DERIVED now: **deadline
  50.0 → SIGTERM 51.0 → SIGKILL 51.5, hold ends 52.5.**
- **`Infinity` IS A STATED ANSWER AND BOTH READERS REFUSED IT.**
  `Number.isFinite(Infinity)` is false, so `inlineBudgetMs` handed the
  container's own "no clock" want `EDIT_JOB_MS` and `makeBudget` handed it
  `BUILD_BUDGET_MS` — **each falling back to a Worker-sized number for the one
  input where the default is the MOST wrong answer available**. Both take it
  now, and **the clamp still governs**: `Math.min(Infinity, left)` is `left`, so
  a WORKER delivery is still bounded by what its isolate has left. **Every
  per-call ceiling survives it** (`capMs` is `min(cap, room)`), which was the
  whole safety argument and was asserted nowhere until it was driven.
- **`builder/job-duration.mjs` IS THE ONE SETTING.** `JOB_MAX_MS`, and
  everything else is `jobDurationPlan()`. **`readJobMaxMs(env)` reads
  `JOB_MAX_MINUTES` and MAY ONLY SHORTEN** — every other number is fixed at
  IMPORT, so a LONGER setting moves the deadline past all of them. **It shipped
  with no call site** in the first cut of the change whose whole point was
  configurability; the guard DRIVES its one consumer, because a source read
  cannot tell a wired reader from an unwired one.
- **THE QUEUE WAS SILENTLY SHORT.** A job behind another waited `60s × 45 =
  2,700s` in front of a job that may run **3,000** — failed before the job it
  waited for could finish. `SITE_BUSY_DEFER_S` is derived now (**67 s**).
- **`JOB_RUNNER_EVERYONE` IS `on` IN THE DEPLOY.** The canary is KEPT rather
  than made decorative: it is the state the platform falls back to if the broad
  flag is turned off.
- **WHAT IT COSTS**: every site's jobs share the account's container ceiling. A
  fire that finds no room WAITS (`JOB_FIRE_MS`, 90 s) and the consumer then runs
  the job on what is left of its own invocation. Worst case is the old behaviour
  ninety seconds later, never an eviction.

### THE JOB'S MODEL CALLS TAKE THE CONTAINER'S OWN TRANSPORT

**Run 45 died at 270,025 ms with `fetch failed`** — eleven milliseconds from
`build-call.mjs`'s own recorded `socket hang up`. `longPost` and
`{stream: true}` were handed in from exactly **three call sites, all in
`build-server.mjs`**; the addon and edit page call took the module's default —
**Node's undici global `fetch`, unstreamed**. **THE FLIP IS WHAT MADE IT
REACHABLE**: that path was safe for months because it only ever ran in workerd,
and turning `JOB_RUNNER_EVERYONE` on moved it behind the container's egress.
*A rule true because of a layer below it expires when that layer moves*, where
the layer moved because we moved it.

- **`builder/long-post.mjs` is the transport**, lifted out verbatim so the JOB
  CHILD can use it. **`worker.js` must NEVER import it** — it pulls `node:http`
  in. The job env carries it (`MODEL_SEND`, `MODEL_STREAM`), so one
  `callBuilderModel` serves both sides and the Worker's path is byte for byte
  what it was.
- **TWO TRANSPORTS, TWO PROBLEMS, SEPARABLE ON PURPOSE.** undici's 300 s HEADERS
  timeout cannot be raised by an `AbortSignal` at all — that is what the
  `node:https` sender beats. A connection closed for carrying NO BYTES is what
  `stream: true` beats. Either alone leaves the other.
- **`callFailure(e)` IS THE FALSIFIER**: `error.cause.code`, the error's `name`,
  and `e.wire` — `{headersMs, chars}`. **`headersMs: -1, chars: 0` is a quiet
  connection killed by the egress, which streaming fixes; `chars > 0` is a
  LIFETIME cap, which streaming cannot.** Until this, a failed page call
  recorded one word.
- **`node:https` HAS NO TIMEOUT OF ANY KIND UNLESS ONE IS ASKED FOR** — its own
  comment. Every real model call carries `AbortSignal.timeout(callMs)`.

**LIVE EVIDENCE, two stored traces on `repairbench-1`, same site, same ask, 2½
hours apart**: run 44's page call **459,465 ms → OK, 3 files** (in the Worker);
run 45's **270,025 ms → `fetch failed`** (in the container). Neither trace
carries the `where` field — it shipped after both — so the attribution rests on
the durations plus the flip landing between the deploys.

### WHERE THE JOB RAN IS RECORDED, AND THE WORKER FALLBACK IS NOT SILENT

**`runner: true` IS ELIGIBILITY, NOT EXECUTION** (the owner's own correction).
`JOB_WHERE` and `JOB_DEADLINE_AT` are set by `makeContainerEnv` and
`jobRunDetail(env)` rides the `run` mark. **The Worker's own answer is
`"worker"` by DEFAULT**, so a record that cannot tell reads as the Worker and
never flatters itself.

| answer | means |
|---|---|
| `fired` — **including HTTP 409** | the container has it. 409 is `/job/run`'s duplicate guard; reading it as anything else makes one job two sets of calls and two charges |
| `inline` — `off`, `no-binding`, `not-this-one` | the runner was never asked for |
| `retry` — `room:`, `fetch:`, any 5xx | transient. `FIRE_RETRY_MAX` 3, `FIRE_RETRY_MS` 2000 |
| `stop` — **everything else, unknown reasons included** | finalize 503 `no-container`, nothing charged |

**`stop` IS SAFE BECAUSE NOTHING IS SPENT BEFORE THE FIRE** — there is no
reserve to reverse, which is the whole reason a refusal can be a refusal rather
than a fallback. And the customer is told; a row that stopped without a finalize
is a poll that spins for ever.

### TWO PROBES: A JOB THAT RUNS LONG, AND A WIRE WITH NO MODEL IN IT

`builder/job-probe.mjs`, fired through **`POST|GET /api/site/job-probe`**, both
free — no model call, no credit, no row, no ledger — and both through the REAL
`/job/run` door in a real job child, because `_busy`, the launch's deadline and
the terminator armed off it are three of the things being measured.

- **`hold`** occupies a child for as long as it is asked (default **20
  minutes**), **pulsing once a minute**. The pulse is the reading, not the final
  line: an absent final line is also what a crash produces. **It touches no row
  and no lease on purpose.**
- **`wire`** holds two long connections in turn — **never raced**, because a
  concurrent pair leaves the reading open to "the second kept the first's path
  warm" — through the **same `node:https` sender a model call uses**. `quiet`
  sends nothing until it answers; `trickle` sends a byte every tick. The probe
  NAMES the reading: `idle-kill` · `no-wall` (**the failure was NOT REPRODUCED
  — that is not the same as settling the historical cause**) · `lifetime-cap` ·
  `quiet-survived-trickle-did-not` · **`hung`**.
- **WHAT THE WIRE PROBE CANNOT ATTRIBUTE.** A dead connection looks identical
  from the container whether the container's egress killed it or the gateway
  Worker gave up. **The trickle arm is what makes that not matter** — same path,
  same endpoint, same duration, only the bytes differ. Read `idle-kill` as
  *"silence is what dies"*, never as *"Cloudflare's egress did it"*.
- **A mode nobody recognises answers `null`, never a default.**
- **`runJob` BRANCHES BEFORE `importWorker`** — a probe measures this process and
  its socket, and several hundred modules in front of it measure something else.
- **THE VERDICT LINE CAN FALL OFF THE WIRE.** `build-server.mjs` keeps a job's
  last five stdout lines and **slices each at 300 characters**. MEASURED: the
  whole-answer line for a realistic failure is **exactly 300** with `reading`
  last — no margin. Two defences, each measured sufficient alone and the
  redundancy declared.
- **A RUNNING RECORD HAS NO TAIL** (`tail` is written only in the `close`
  handler), so `state: "running"` past the elapsed time IS the live duration
  answer. **A 404 IS NOT A COMPLETION** — it answers both for an id the service
  never saw and for one whose record went with a recycled container.

**`PROBE_MAX_MS` SITS UNDER `JOB_MAX_MS`** (minus five minutes, DERIVED), and
the caller's number is **CLAMPED rather than refused**, because an instrument
that errors on a too-big argument is one somebody re-runs smaller and mis-reads.
The route is owner-gated, **ALWAYS pre-scoped**, on the hold probe's own lane,
carries **no secrets at all**, and takes its clock from `readJobMaxMs`. The door
is `.github/workflows/job-probe.yml` + `scripts/job-probe.mjs`, dispatch-only,
every secret printed as a LENGTH.

**DURATION: PROVEN (probe run 2).** A job child ran **1,200,182 ms — 20 minutes
— inside the container, `code: 0`, no `signal`, 20 of 20 pulses**, with 30.2
minutes of deadline left. It passed 12m22s (run 44's death), 14 min (the old
`EDIT_JOB_MS`) and 15 min (the consumer ceiling). **TRANSPORT: UNREAD.** Three
instrument defects are why, and each is a rule:

1. **`newJobId` WAS CALLED BARE and the route threw.** It takes its randomness
   as a REQUIRED parameter. **The route was asserted by READING it**, and the
   guard SAID a drive was impossible "because the route is owner-gated", which
   is false: `authUser` asks `/auth/v1/user`, so a stubbed global fetch is the
   whole cost. **A stated impossibility nobody re-tested is how a route ships
   throwing.**
2. **THE RUNNER THREW AWAY THE STATUS.** `.then(r => r.json())` drops the
   status, the content-type and the body — *a failure that cannot name itself*,
   in the instrument built to name failures. The status separates the three
   shapes: 401 is a token that did not take, 404 a Worker without the route, a
   5xx with HTML the Worker throwing.
3. **`wireCall` PASSED NO ABORTSIGNAL.** **THREE OUTCOMES, NOT TWO**: answered,
   died before the bound, and **`hung`** — never answered, never reset. They
   need three different fixes, so collapsing the last two is the one way this
   instrument can mislead rather than go quiet. `hung` is asked FIRST.
4. **A PROBE COULD ONLY BE READ BACK BY THE RUN THAT FIRED IT.** `PROBE_JOB_ID`
   skips the fire and reuses the same polling and verdicts. **The fire is
   skipped rather than made idempotent**: a second launch of the same shape
   would take a second lane to answer a question already in flight.
