# Parallel tasks, round 7: an addition's photograph recovered wherever the job runs, and legacy posts brought into the request flow (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers and a stand-in image service only**, through the real Worker routes,
> request driver, queue consumer and cron, plus the real build service
> (`builder/build-server.mjs`) spawned on a local port, with the network
> blocked. Nothing here is live proof.

The owner's order (2026-10-09), after Codex reviewed `fd9c9a0d` and passed 48
focused offline tests: keep the batch and move toward acceptance. Close the
runtime and entry-point gaps:
- trace which add-on and placement paths run in the container and which in
  the Worker;
- give Worker-run paths the same durable recovery without string matching;
- bring legacy add-on entry points into the existing durable flow;
- finish with an acceptance report.

## 1. Where each path really runs

Read from the code: the runner flags, the fire and its fallback rules, and
the add-on route's fork. **"Container" means the Worker's own modules under
Node in the site's container, where `typescript` loads (the image installs
the template's dev dependencies). "Worker" means the workerd isolate, where
it never loads.**

| Entry | Decided by | Runs in | Frames read by |
|---|---|---|---|
| A routed request part (`REQUEST_FLOW` on, a request key, `editAsyncFor`), each step a queued job | `fireContainerJob` → `fireOutcome` | **container** when `jobRunnerFor` names the uid or slug (`JOB_RUNNER_EVERYONE`, default `on`). **Worker** (`inline`) when the flags name nobody (`off`, `not-this-one`). With no container binding, `no-binding` is inline too, but then no publish can compile either. Every other refusal is retried 3 times and then **stopped** (503 `no-container`, nothing charged), never run quietly in the Worker | container: its own parser. **Worker: the site's container through `/frames` (new)** |
| The placement (a picture job carrying `place`) | the same | the same | the same |
| A part's preparation | the queue consumer | Worker | stops before any write, so it never marks |
| An addition posted straight to `/api/site/<slug>/addon` (the page acting on a routing answer the router did not take on, an edit's hand-over, an older page, the canaries) | `editAsyncFor`, then **`addonAsRequest` (new)** | flow on, a request key, no pictures: **a one-part request (row 1)**. Otherwise a job of its own, by the row-1 rules | as row 1 when a request; none for a job of its own (nothing places later) |
| The synchronous add-on (`editAsyncFor` false) | the route | Worker, on the customer's connection | none; nothing places later |

The deploy's defaults are `EDIT_ASYNC_EVERYONE on` and `JOB_RUNNER_EVERYONE
on`, with the master `EDIT_ASYNC` and `REQUEST_FLOW` taken from secrets.
Their live values are not readable here. The records show both in use since
deploys 2182 and 2184.

## 2. Parser-capable recovery for Worker-run paths (`f7992fae`)

- **One implementation, two places.** The frame code (`markPending`,
  `fillPending` and their readers) moved from `site-images.mjs` into
  `builder/pending-frames.mjs`, **with no imports**, together with a minimal
  parser loader (`frameParser`). `site-images.mjs` re-exports it unchanged.
- **The container's door.** `build-server.mjs` serves `POST /frames`:
  - `mark`: pages and ids in, `markPending`'s answer out;
  - `fill`: one source, id and url in, `fillPending`'s answer out.
  It runs the same code with the container's parser. It takes no lane lock,
  so it never waits behind a build, and it has no write, model or credit.
  The Dockerfile copies the module to the service and to the Worker's own
  tree.
- **`framesFor(env, slug)`** in the Worker:
  - a local parser when this process has one (the container's own jobs);
  - otherwise the site's container through `/frames`, using the same
    container and lane the add-on's compile already needs;
  - otherwise (no binding) nothing, with the reason said.
- **An answer that does not read is never taken for one:**
  - a mark that fails is `parser-unreachable`: the purchase stays pending
    with no frame, is told, and is saved when it lands;
  - a fill that fails is `unreachable`: the placement is held on its purchase
    (`frames-unreachable`) and asked again by the driver. Nothing is bought
    again and nothing is published. The hold has its own sentence and never
    says the purchase is in doubt.
- **Still not guessed:** a token inside a longer string, in text, as a key,
  or in a file that does not parse.

## 3. The legacy entry brought into the durable flow (`f7992fae`)

- **`addonAsRequest`**: a post straight to the add-on route is accepted
  exactly as the router accepts one (`acceptRequest`), under the post's own
  key. It becomes one part, the add-on step, carrying the router's held
  parts, the hand-over and an answered question's context. From then on:
  - its purchases are the part's records;
  - a waiting frame is placed by the existing driver;
  - a duplicate post finds the same request;
  - reserves, refunds and the site lock are the part's job's own.
  There is no second scheduler.
- **The page follows it**: `siteAddon` hands a request answer to
  `siteRequestStart`, as a routing answer does. A job receipt is watched as
  before.
- **Not taken on**, so it stays a job of its own:
  - the flow off;
  - no request key;
  - a post carrying pictures (the request keeps none it was not sent);
  - a plan the acceptance will not read.
  Such a job's purchases are now records keyed by the job (`job-<id>`), or on
  the synchronous path by the post's key. A redelivery reuses what was bought
  and never buys an unknown one again. Nothing places its frames later, and
  its reply says the frame was left empty.
- **A store that fails around the acceptance** is said, never followed by a
  second filing: the record may have landed, and the sweep runs what landed.

## 4. Tests and results

- **New**: `test/addon-runtime-paths.test.mjs`. The real Worker; the real
  build service for `/frames`; the network blocked. Each case checks the
  final page, the task statuses, provider calls, publication and accounting:
  - RT 1: inline in the Worker, the parser absent in-process (as in
    workerd). The braced frame is marked and later filled through the real
    `/frames` door. One provider call, two publishes, charged once.
  - RT 2: inline, no parser, the door unreachable at marking. Pending with no
    frame, told, saved when it lands, never guessed, ends partial.
  - RT 3: inline, the door down at placement and back. Held with nothing
    bought, published or changed, and the truthful sentence. Then placed
    once.
  - RT 4: fired (`JOB_RUNNER_EVERYONE`). The consumer runs nothing itself;
    the container's side (`runContainerJob`, with the parser) marks and
    places without asking any door.
  - RT 5: the legacy post taken on as a request: held, placed, and the same
    post again finds the same request.
  - RT 6: the legacy post with the flow off stays a job. Its purchase is a
    record keyed by the job; the same post is the same job; nothing is marked
    or placed later.
  - RT 7: a legacy post with pictures stays a job.
  - RT 8: the page (`siteAddon`, cut from `chat.js`) follows a request
    answer, and still watches a job receipt.
  - A network check.
- **Updated**: 18 page-filed cases (`progress-flow` 6 posts,
  `progress-gaps`' `filePage`, `partial-evidence` 1 post). With the flow on,
  such a post is now a request, so these cases make their one page-filed
  post with the flow off, which is the only way that job still exists. Their
  subject is unchanged.
- **Red check** on `fd9c9a0d`, the new test and fixture copied in, with
  `typescript` blocked from resolving in the test process (a stand-in for
  the isolate; the old code has no other hook):
  - RT 1: no frame found without a parser;
  - RT 2: the door never asked;
  - RT 3: no mark to fill;
  - RT 5: a 202 job of its own, not a request;
  - RT 6: no purchase record;
  - RT 4 (the fired path, which already worked) and the network check pass.
  That is **5 of 5 behaviour cases failing**. RT 7 and RT 8 were written
  after.
- **Focused run**: the new file, `addon-pending-forms`, `addon-pending-photo`,
  `pending-frames`, the seven-task batch (`parallel-batch`) and Build progress
  (`build-parallel`), every one with the network blocked: **`45 / 45 / 0 / 0`**
  on `f7992fae`.
- **Sweep**: 12 product mutants and a comment-only control, over
  `worker.js`, `build-server.mjs`, `chat.js` and `pending-frames.mjs`:
  - the container door dropped, and the add-on's frames dropped;
  - a failed fill read as unverified, and a placement not held when
    unreachable;
  - the held sentence made generic;
  - the door marking and filling without its parser;
  - the legacy post never taken on, taken on with pictures, or taken on with
    the flow off;
  - the standalone job with no record;
  - the page ignoring a request answer.
  **12 of 12 killed, the control survived.**
- **Full suite**: **`10258 / 10258 / 0 / 0`** on `f7992fae` (was 10249 at
  `36d431e2`).
- **Required CI**: unit tests green on `f7992fae` (run 37894981092): `10258 / 10217 / 0 / 41`,
  the same total as locally (CI skips 41). **Site build** (run 37894981062) is
  **not green**. Shard 2 was cancelled at its 20-minute limit while its runner
  was still installing Playwright's system packages: `apt-get` hung on a
  package mirror from 06:43 until it was cancelled, before any test ran. The
  other three `site-build.mjs` shards, the published-site, theme and
  kit-and-generator checks all passed, and "all checks" failed only on the
  cancelled shard. A session cannot re-run a workflow; it is yours to re-run.
- **Image** (predicted, not built): `335396c8c0e0fbcb` → **`4f631d9c2e42064b`**
  (204 inputs). It changes because the container now serves `/frames`, so
  **the door exists live only after an image build**.

## 5. Acceptance report

**Supported paths, offline proof only:**
- a routed request part or its placement, run in the container (fired) or
  in the Worker (`inline`), with the parser local or through the site's
  container;
- a legacy post taken on as a request;
- every equivalent JSX form, a shared component's value, a late purchase,
  redelivery, and a frame changed or removed (rounds 5–6, kept).

**Genuine remaining blockers:**
1. **No live evidence of any of it**: no real model, image service,
   container door or timing. The fired path's container side is this process
   running the Worker's export, not a container with its gateway.
2. **The `/frames` door needs the new image.** Until it is built, a job the
   runner keeps in the Worker marks nothing: it stays explicit pending work
   with no frame (`parser-unreachable`). With the deploy's default
   (`JOB_RUNNER_EVERYONE on`) no supported job runs inline.
3. **Not placed automatically, and told:**
   - the synchronous add-on;
   - a legacy job with the flow off or with pictures;
   - a token inside a longer string;
   - a container that cannot be reached when the addition marks.
   The photograph is saved to the customer's images when it lands.
4. **The image provider has no idempotency key or lookup** (unchanged).
5. **The finite-clock wait** (round 6) has not had a live look.
6. **Kept unswept on purpose**: `addonAsRequest`'s own duplicate read,
   before acceptance, is redundant with `acceptRequest`'s read-back. It is
   kept for the request's nudge on a duplicate, as the routing route does.

**The smallest eventual live validation** (after the owner's merge, the image
build, the image window and the free runtime check that reads the new image
id):
- one paid request on `fold-lane-bakery`: *"add a gallery page with one
  photo of the workshop bench"*, expected route `addon`;
- check that the part ran in the container (its trace's `where`), that one
  photograph was bought and placed, and that there was one publish and the
  charge;
- estimated 3–13 credits (an add-on measured 2–13), with the balance as the
  only bound;
- then the free restore.

The pending path (a store failure, a late purchase, a door down) cannot be
forced live without fault injection, so it stays offline-only proof. Putting
a job in the Worker on purpose (the runner flags) is the owner's call and is
not recommended.

## 6. Mocked versus live

- **Mocked**: every model answer, the image service and its store failures,
  Supabase's RPCs, the queue, the cron, and the container's launch.
- **Real**: the Worker, the parser, and the build service's `/frames` door
  (spawned).
- **Not shown**: anything live.
