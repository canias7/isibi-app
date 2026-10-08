# Parallel tasks in one message: dependency-aware preparation in the request driver (2026-10-08)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers only**, through the real Worker routes, the real request driver,
> the real queue consumer and a real Chromium for the card. No real model
> and no live site has been asked any of these messages.

The owner's order (2026-10-08), in short: one message can hold several
tasks; independent tasks run concurrently; a task waits only when it needs
another task's result or would conflict with its changes; the model names
the tasks, their targets and their dependencies, and code validates and
enforces that plan; reuse the request records, server jobs, design graph,
routing, clarification, recovery and accounting, with no second
orchestration system; no phrase matching. The batch also carries the two
recovery fixes left over from batch 9.

## 1. The two carried recovery fixes (`af80c83a`)

- **Every clarification answer is kept.** Three places used to cut the list:
  the page (8), the router's prompt (3) and the designer's brief (3).
  - `clarifiedBrief` keeps every pair, and the router is shown every answer.
  - `MAX_CLARIFY` now limits only how many more questions may be asked
    (`left`).
  - The page sends the round's answers whole.
- **A corrective design call keeps its correction across a transient
  retry.** Before, a repaired call that met a busy provider was asked again
  in its plain form. Now `recoverDesign` keeps the correction and the
  question field (`fix`) and sends both on every later attempt.
- `test/recovery-carry.test.mjs`, 5 cases: 4 of them fail on `7012286a`, and
  the fifth is the control.

## 2. What existed, and what was reused

Mapped before any code was written (the record of the map is the summary in
the session; the parts named here are the ones used):

- **The request record** holds parts with `needs`, statuses and jobs. Its
  keys are `requests/<slug>/<key>.json`, written on its etag.
- **One driver** (`advanceRequest` → `nextStep`) is the only thing that
  files a step. The sweep is the guarantee that a request moves on.
- **Every step is an ordinary `edit_jobs` job**, with the existing claim,
  lease, reserve, publish marks and refunds.
- **One job per site at a time.** This is the database's own rule:
  `edit_claim` takes `private.site_busy` for every kind of job. It cannot be
  changed without SQL, so writes to one site stay one at a time.
- **The router already gives** `alsoAsked` (the held parts) and `dependsOn`
  (the order between them).
- **Clarification** keeps the live question and its answers, and resumes
  the right part.
- **Build's design graph** (`builder/design-graph.mjs`) already runs its
  agents concurrently by `needs`.
- **Progress**: model-written task lines (`SITE_SAID_FOR`) and per-part
  states (`PART_STATE`).

**Consequence.** The only place two tasks of one site can overlap without
changing the database is *before* their writes: the model calls a step makes
and the pictures it buys. That is what this batch adds, inside the same
driver, records and jobs.

## 3. The architecture

### 3.1 The plan: model names targets, code checks them

- **The router's tool gains `targets`** (`builder/site-ask.mjs`, `TARGETS`).
  For each change it numbered (0 is the part it answered; 1 onward are the
  held parts, as in `dependsOn`), it gives:
  - `writes` and `reads`;
  - each drawn from one vocabulary: `page:/x`, `new-page:/x`, `menu`,
    `header`, `footer`, `theme`, `identity`, `data:t`, `new-data:t`,
    `component:N`, `new-component:N`, `images`, `pagelist`, `site`.
- **Code keeps only what reads** (`readTargets`, `builder/request-plan.mjs`).
  An entry that does not parse is dropped, never guessed. The trace marks
  `targets-unread`, `targets-out` and `targets-named`.
- **Code adds what each step is known to write** from its own wiring
  (`impliedWrites`), never from the words:
  - the menu step writes `menu`;
  - the logo step writes `identity`;
  - a page taken away or renamed writes the page, every menu and the page
    list;
  - the picture step writes `images` and its page;
  - text or page with a page named writes that page;
  - data and rules write `data`.
- **A part whose writes are unknown is the whole site** (`site`). This is
  conservative: it means less overlap, and never an unsafe one.
- **Code adds waiting of one kind only**, creation (`inferNeeds`). A part
  that reads something another part *creates* waits for it, in whichever
  order the message named them. For example, the menu link to a page the
  add-on makes. A link to something that already exists needs nothing first.
  A waiting that would close a cycle with what the model said is never added.
  Cycles the model named are still refused.
- **Order of writes** (`applyOrder`): after the parts each one needs, then
  message order.

### 3.2 Preparation: the overlap

- **Claimed in the same write as the job it files.** `nextStep` claims up to
  `PREP_MAX_LIVE = 3` other parts for preparation:
  `prep = { seq, for, phase, tries, state: "attempting", at }`.
- **Sent as queue messages** `{ kind: "request-prep", slug, key, n, seq }`.
- **What can be prepared**:
  - a part's **routing** (it writes nothing);
  - the **text**, **menu** and **picture** steps (`PREP_LAYERS`). Their work
    before the publish writes nothing to the site.
  - The look, page, logo, data, rules and add-on steps write as they go, so
    only their routing is prepared.
- **When** (`clearToPrepare`): a part is prepared only when no earlier,
  unfinished part in the write order writes what its step reads
  (`stepInputs`):
  - the text step reads every page's words;
  - the menu step reads the menus and the page list;
  - the picture step reads the pictures;
  - a routing reads the page list.
  A step that writes (not a routing) must also not conflict with any earlier
  unfinished part (`conflicts`: either writes what the other writes or
  reads).
- **After a prepared routing**, the step it chose is prepared only if it
  passes the same checks against the part's *own* route and targets
  (`routedForPrep`). Otherwise the preparation stops at the routing
  (`routed`).
- **How it runs** (`runRequestPrep`): the real routes are replayed in the
  Worker under a preparation context (`makePrepCtx`):
  - there is no job row, no lock, no lease, no charge and no trace;
  - no question is stored;
  - the publish stops before anything is written (`reached`);
  - every model call and every picture goes through a recorder.
- **What is kept**: `requests/<slug>/<key>/prep/p<n>-<seq>.json`, holding
  `{ route: { calls }, run: { calls, images } }`. The outcome goes on the
  part (`notePrepared`) only while the claim is still the same one:
  - `ready` (reached the publish);
  - `ask` (the step asked a question);
  - `routed`;
  - `stopped` (the step refused);
  - `error`.
  A late or repeated answer is refused.
- **Bounds**:
  - `PREP_TRIES = 2` per step;
  - a preparation that has not answered in `PREP_FRESH_MS = 10 min` no
    longer holds its part back;
  - a preparation's own clock is `PREP_RUN_MS = 8 min`.

### 3.3 Applying: one at a time, against the site as it is

- **Which part is filed next**:
  1. a part whose preparation found a question goes first, so it can be
     asked;
  2. otherwise, the first ready part in write order that is not still being
     prepared.
  If every ready part is still being prepared, nothing is filed, and the
  preparation's end moves the request on. Filing it earlier would only make
  the same calls twice.
- **When the part's own job is claimed** (`stagePrepared`), its share of the
  preparation is copied to `jobs/prepared/<id>.json`. That is a key the job
  can read wherever it runs, including the container's gateway.
- **The job's transport** (`jobSend`, `jobImage`, `replayer`) answers a call
  from the preparation only when the call's request is byte for byte the one
  prepared:
  - "byte for byte" means SHA-256 over the deciding fields, canonical;
  - each recorded answer is used once;
  - any other call is made live, against the site as it now is. **This is
    the reconciliation**: a prepared answer is never applied to a site it
    was not made for.
- **The publish** is the existing one, on the pointer's etag, inside the
  job. One task cannot overwrite another's work or publish an outdated
  snapshot, because each write runs in its own job against the current
  pages.
- **A picture the preparation bought is hidden from the job's library
  listing** (`replay.hides`), so that listing matches what the preparation
  saw.
- **A step's context lists only the parts it needs** (`partOf.done`: its
  prerequisites and parent). Its request therefore does not change just
  because an unrelated part finished.

### 3.4 Money

- **A preparation never charges.** `eCharge` returns 0 under it, the routing
  returns before any charge, and every case checks that no database call
  names a job that was never filed (`noPrepMoney`).
- **A replayed answer keeps its recorded usage**, so the job bills it once,
  through its own reserve, exactly as if it had been made then.
- **Redelivery and retries reuse the same staged answers**. Nothing is
  charged twice. A job that dies after its charge is refunded by the
  existing sweep, and its next run is answered from the preparation again
  (P5).

### 3.5 Questions

- **A question found by a preparation is not stored by it.** The part is
  filed first, its job asks the same question from the recorded answer (at
  no new model cost), and the existing clarification flow takes over: the
  question is kept, other parts go on, and the answer resumes the part
  without the message being sent again (P4).

### 3.6 The page and progress

- **The request card** (`siteRequestHTML`, `SITE_REQ_PREP`):
  - "Working on it alongside" while a part is being prepared;
  - "Ready, applying next" once it is ready;
  - its own status once its job runs.
- **The model's task lines** show a part being prepared as `doing`, never as
  done (`otherParts`, from the record's own `prepState`, freshness
  included).
- **Nothing is claimed done before its own job has applied and published
  it.**

## 4. Cost, honestly

- **The same calls are billed.** The customer pays for the calls their
  parts' jobs use, recorded or live. Running in parallel does not save
  credits in itself; what it saves is waiting time.
- **No duplicate routing or planning.** Each part's routing is made once:
  in its preparation, then answered from it by the routing job. The message
  is still routed once at the start.
- **Calls a preparation made and no job used are our cost, not the
  customer's.** This happens when an earlier part changed what the step
  reads, so the request differs and the job asks again. The same holds for
  a picture bought for a description no job then asks for.
  - The gating in 3.2 keeps this rare: a step is not prepared while an
    earlier part that writes its inputs is unfinished.
  - It is not zero: the model may name targets that are too narrow.
- **A prepared picture spends on fal before the part is applied.** If the
  part is then stopped, the purchase is ours.
- **The preparation's own runtime is the Worker's**: one queue message and
  one replay of the route per preparation.

## 5. What is supported

| Path | Routing prepared | Step prepared | Apply |
|---|---|---|---|
| Edit: text, menu, picture | yes | yes | one at a time, in dependency order |
| Edit: look, page, logo, data, rules | yes | no (they write as they go) | one at a time |
| Add-on | yes | no | one at a time |
| Mixed Edit + Add-on | yes | as above per part | one at a time |
| Build (first build) | n/a | the design graph's own concurrency, unchanged | the existing build job; 1 page and 15 components unchanged |

## 6. The tests (all with supplied model answers)

`test/parallel-requests.test.mjs`, 11 cases, through the real `/api/site/route`,
the request driver, the queue consumer, the edit and add-on routes and
Build's route:

- **P1 Overlap** (the owner's example): a photograph is prepared and its
  picture bought *while* the TikTok link's job is still inside its model
  call. A gate proves the two overlap. Then:
  - the picture job answers its call and its picture from the preparation;
  - one routing per part, one text call, one picture call and one
    photograph;
  - each job is charged once.
- **P1c A prepared step that refuses**: the preparation ends `stopped` and
  charges nothing. The part's own job meets the same refusal from the record
  and is charged once.
- **P2 Reverse order**: the menu link is named first and the page it links
  to second, with no order from the model. The link waits for the page
  (creation is inferred); the page is made, then the link.
- **P3 Shared page**: the second change's routing is prepared, but its step
  is not while the first is unapplied. Both changes are kept, with one text
  call each.
- **P3b Shared component, unrelated words**: the photograph's step is held
  back when the model says both parts reach the header. The control: without
  that shared target it is prepared at once.
- **P4 Clarification**: a question found in preparation is asked first, at
  no new model cost. The independent change is applied meanwhile, and the
  answer resumes the photograph.
- **P5 Partial failure and retry**: the picture job dies just after its
  charge. The sweep refunds it, and the rerun is answered from the
  preparation (no second call, no second photograph). The finished link
  part is not run again.
- **P6 Redelivery**: every queued message is delivered twice, with no page
  open. The result is one preparation's calls, one photograph, one publish
  per part and one charge per job. *This also passes on the base commit*:
  it is a guard that the new code keeps the existing idempotency.
- **P7 Mixed Edit + Add-on**: the addition's routing is prepared during the
  edit's model call and answers the routing job. The addition's own work runs
  after.
- **P7b Add-on + Add-on**: the second addition's routing is not prepared
  while the first adds a page, because its router reads the page list.
- **P8 Build**: a first build's design runs as a graph through the real
  build route. Agents with no needs are in flight together, and each agent
  that needs another starts after it. *This also passes on the base
  commit*: the overlap is the design graph's own, covered here, not new.

`test/parallel-plan.test.mjs`, 14 cases:
- reading targets, implied writes, conflicts (including a shared component
  with unrelated words), inferred waiting in either order, and the
  no-cycle and existing-thing controls;
- `clearToPrepare`, the request hash, record and replay (each answer used
  once, a changed request made live, pictures, hiding);
- the progress writer's reading of a preparation;
- the driver's choices: the cap of three, a part still being prepared
  passed over, a question asked first, a late or repeated answer refused,
  and the routed step's own targets.

`test/progress-browser.test.mjs`, *PARALLEL*: the card in real Chromium,
with three screenshots sent in the chat (preparing, prepared, done).

**Re-anchored.** One case in `test/request-plan.test.mjs`, dated: an
independent part is filed when its routing's preparation answers, not
before. The rest of that file (31 cases) is unchanged.
- **A mistake, corrected:** `41e889e8` wrote the new unit cases over this
  file. The full suite's total (10128 against the base's 10139) showed it.
  `6b9c1dcb` restores the file word for word and moves the new cases to
  their own file.

**Red check** (the new files on `af80c83a`):
- 9 of the 11 integration cases fail. P6 and P8 pass, as above.
- `parallel-plan` cannot load, because its modules do not exist there.
- The card case fails.

**Sweep** (`scripts/mutate.mjs`; the request, plan, flow and page test
files), three rounds with a comment-only control in each:
- **Round 1**: 28 mutants, 6 survivors. Answering them found two real
  flaws, fixed in `703eff67`:
  1. A part not yet routed counted as the whole site, so its routing was
     never prepared next to another part's job unless the router had named
     its targets.
  2. After a prepared routing, the step it chose was prepared without
     re-checking for conflicts against its own route.
  New cases cover:
  - each choice the driver makes;
  - the picture step's refusal path, which charges before any publish;
  - the money property (`noPrepMoney`).
- **Final**: 31 of 31 product mutants killed, the control survived. The
  page's label mutant was checked by hand against the browser case: killed,
  and green again once restored.

**Full suite**: `10165 / 10165 / 0 / 0` locally on `703eff67`, against the
base's `10139` on `af80c83a`, measured in a worktree. The difference is 26:
- 11 cases in `parallel-requests`;
- 14 in `parallel-plan`;
- 1 browser case.

## 7. Commits

- `af80c83a`: the two carried recovery fixes (§1).
- `b772ec67`: the plan's targets, waiting by creation, and the preparation
  claims in the record.
- `41e889e8`: preparation in the Worker, replay in the job, the card, the
  integration and browser tests.
- `6b9c1dcb`: restores the request planner's 31 tests that `41e889e8` wrote
  over.
- `703eff67`: routing prepared beside any job, the step re-checked against
  its own route, and the driver-choice and money cases.
- The records: this file, `docs/request-flow.md`, the backlog and
  owner-notes.

**Image**:
- Production is `335396c8c0e0fbcb` (196 inputs).
- The branch predicts `187c501d7e7f2007` (202 inputs: the two new modules
  are in the Dockerfile).
- It has not been built.

## 8. Mocked versus live

- **Mocked**:
  - every model answer and every picture purchase (a stand-in for fal.run);
  - Supabase's RPCs and the queue.
  Everything else is the real code.
- **Not shown live**:
  - whether real models name useful `targets`;
  - real overlap timings;
  - the miss rate of prepared answers;
  - the preparation's real Worker cost.

## 9. Remaining gaps

- **Writes stay one at a time per site.** This is the database's
  `site_busy` rule. Concurrent applies would need SQL, which was out of
  scope here.
- **Look, page, logo, data, rules and add-on steps are prepared only up to
  their routing.** Their work writes as it goes; preparing them would need
  isolated staging of their writes.
- **Prepared work can be wasted**: a call or picture the job did not use is
  our cost (§4).
- **Targets depend on the model.** With none named, a part is the whole
  site: safe, but nothing overlaps beside it.
- **The preparation records no progress milestone of its own.** The card
  and the task lines show it as in progress; the model narrates the part's
  own job events as before.
- **Build**: only the first build's design graph. A message mixing a build
  with edits is not a request of this flow.
- **The constants are estimates**: `PREP_MAX_LIVE`, `PREP_TRIES`,
  `PREP_FRESH_MS` and `PREP_RUN_MS`.
- **No real-model or live run.** Nothing is merged, deployed or built.
