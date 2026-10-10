# A first build found again after a reload or in another session (2026-10-10)

The owner closed the verified missing-photo correction and moved the work to
the known Build browser-reconnection gap. fal is not being topped up; paid
image generation stays paused and real-image generation **unverified**.
Everything here is offline, with images mocked.

## The gap, as the code stood

- A first build's POST (`/api/site/react-build`) holds its socket while the
  build runs (`awaitJobResult`, up to 16 minutes). The browser learns the
  build's job id only when that POST answers, and keeps it in memory only.
- So a reload, a closed tab or another device:
  - left the customer's message with no reply;
  - left the build's answer uncollected;
  - sent the next message in that chat as a fresh first build, which is a
    **second paid build** if the first had not yet named its site.
- No route listed builds. The poll deleted the answer on its first read, so
  even a found job could not be shown twice.

## The change: three records keyed by the account, the durable jobs reused

`builder/build-live.mjs`, wired in `worker.js`:

1. **At acceptance** (`liveBuildStart`, inside `enqueueSiteBuild`, first builds
   only), the chat that asked is claimed with a conditional write, at
   `builds-live/<uid>/chat-<chat>.json`, and a marker is written at
   `builds-live/<uid>/<job>.json` holding the job, the chat, the customer's
   words and the time.
   - **Same chat, build running**: a second first-build POST for the chat is
     answered with the running build's own 202 (`stage: "resuming"`,
     `already: true`). The browser already follows that answer. Nothing is
     filed, stored, queued or charged.
   - If the job cannot be stored or queued, the marker and the claim are
     taken back (`liveBuildRelease`).
2. **At the end**: when the one result writer (`storeBuildResult`) writes a
   terminal answer, it is also kept at `builds-live/<uid>/<job>.done.json`
   (`keepBuildDone`). The poll still reads its slot once; when the slot is
   gone, the poll serves the owner the kept answer, never "collected".
3. **The listing**: `GET /api/site/builds` reads the caller's own prefix only.
   Each build is described from its own records (`buildLiveState`):
   - the kept answer: done (by the browser's own success gate) or failed;
   - the row's verdict (`edit_get`, owner-scoped): failed, lost or cancelled;
   - a done row with no kept answer: unknown;
   - a row with no verdict: running, with the model's own progress lines
     (`progressViewFor`);
   - no row at all: running only while the build is younger than a build can
     run.

   Markers past a day are tidied away as they are read.

**Browser** (`public/chat.js`):
- On open, `siteBuildsCheck` reads the listing once per page load, and again
  after a sign-in.
- Each build still owed to its chat is picked up:
  - **owed** means a chat this session never saw, or one whose last message
    is the customer's own with no reply;
  - a chat this session never saw is created here under the chat's own id,
    with the customer's words as its first message.
- The build then runs through `reactSend`'s own code, given the found build
  (`found`) and never POSTing:
  - running: followed exactly as the POST's 202 is, with its live lines
    painted first;
  - ended: its answer read exactly as the POST's would have been.
- Nothing is resent, restarted or charged, and progress stays model-written.

## Verification (offline, stand-in services, images mocked)

`test/build-reconnect.test.mjs`, 16 cases.
- **Server**: the real Worker drives the build POST and its wait, the real
  consumer and resume (`fireInterim`, `finishResume`), the listing and the
  poll.
  - **RC 1, reload while running**: listed running, with its chat and words;
    no second job or charge.
  - **RC 2, same chat again while running**: the running build's 202; no new
    row, R2 job, queue message, marker or ledger call.
  - **RC 3, completed**:
    - the answer is kept and listed done with its slug;
    - the poll serves it again after the read-once slot was collected;
    - the chat is free again, so a new build is filed.
  - **RC 4, failed**:
    - a design with no plan is failed with its own answer;
    - a lost row is failed with the row's verdict;
    - a resume with no usable page (a placeholder site) is done, as the
      browser reads it.
  - **RC 5, another account**: nothing listed, never served the kept answer,
    and its own build for the same chat id is its own.
  - **RC 6, a job that could not be queued**: unlisted.
  - **RC 7**: the day's window and signed out.
  - **RC 8**: the state rules.
  - **RC 9**: the running build's live lines come back with it; another
    account's record gives none.
  - **RC 10**: a marker under this account's prefix that names another
    account is never listed.
- **Browser**: the real `reactSend`, `followBuildJob`, `siteFinishBuild` and
  the new functions, cut from `chat.js` and fed the Worker's own bodies.
  - **RB 1, reload while running**: the live line painted, followed to the
    end, the slug recorded; requests are only the listing and two polls.
  - **RB 2, fresh session**: the project is created under the chat id and
    followed in; no POST.
  - **RB 3, completed**: shown with no poll and no POST; never answered
    twice over three renders.
  - **RB 4, failed**: shown in its chat with no site; signed out, the listing
    is asked again on the next render.
  - **RB 5**: a chat that already has its site, with a later message of its
    own unanswered, is not answered with its old build again.
- **Duplicate polling**: RC 3 polls twice after the slot is collected and
  is served the same kept answer both times; RB 3 renders three times and
  answers once.
- **Red check** on the old code: 11 of 13 fail or hang. RC 2's second POST
  queues a whole new build and waits on it, which is the defect. RC 6 (a
  control) and RC 8 (the copied module's own rules) pass.
- **Sweep**: 20 mutants plus a comment-only control.
  - First pass: 17 killed and 2 survived. One survivor was the marker's
    account check; the other was "a chat with its site is not owed its old
    build".
  - RC 10 and RB 5 were added, and each kills its survivor when it is
    re-applied.
  - Result: 19 of 19 killed; the control survived.
- **The first full run found four existing guards my change had broken**,
  each fixed at its cause:
  - **the container's worker tree** (`dockerfile.test.mjs`): the job runner
    imports `worker.js`, which now imports `builder/build-live.mjs`, so the
    Dockerfile copies it. That is a new image input, so a deploy would roll
    the image; nothing is built now;
  - **one refusal for the chat** (`site-chat.test.mjs`): the acceptance read
    the request's chat raw. It now goes through `cleanChatId`, as the build
    route does. The guard now holds that every read of the chat goes through
    that refusal, and the acceptance's only after it has refused anything
    but a first build;
  - **the job store's private prefix** (`build-queue-wiring.test.mjs`): the
    account records are a second private prefix. The guard now also requires
    that they hold no credential and that a job was written at all;
  - **the `buildDone` anchor** (`build-survives-disconnect.test.mjs`): my
    `buildDoneKey` import came first in the file. The helper is renamed
    `buildKeptKey`.
- **Full suite**: 10,358 tests. 10,357 passed before the commit, and the
  last (every image input a git object) passes on `47be3540`.
- **Image**: production `8d6dbcea93252fbb` → `a2ad6fa4a83ace7c` (205 inputs,
  174 paths). Predicted, not built.
- **Commit**: `47be3540`.
- **CI on `5234eefc`**: unit tests 38059509449 green (`10358 / 10317 / 0 /
  41 skipped`, the same 41 skips as before); site build 38059509454 green.

## Limits, kept explicit

- **Inline builds** (no queue, a sandbox) have no job and are not listed.
  Production queues every build.
- **Builds accepted before this change** have no marker and are not listed.
- **Images are mocked**: no real image is generated or verified.
- **Progress wording** comes from a supplied writer; a real model's wording is
  not measured.
- **The local thread lives in the browser's storage.** A fresh session gets
  the customer's words and the build's answer, not earlier conversation.
- **Two simultaneous first-build POSTs for one chat** are settled by the
  conditional claim: the loser follows the winner. Tested for the sequential
  case only.
- Not deployed, not pressed. The browser change is in `public/chat.js`, so a
  deploy would need the served-file check.

## Round 2: Codex's three gaps on `7a8e7518` (offline)

Codex passed the 16 cases and CI, then reproduced three gaps that the cases
did not reach. All three are fixed together, as general rules:

1. **The claim-to-marker race** (two POSTs, two paid builds).
   - **What happened**: POST A wrote its chat claim, then its marker. POST B,
     arriving in between, found a claim whose build had no marker, read it as
     free, replaced it and queued its own build; A resumed and queued too.
     Codex saw two `edit_create` calls, two queue messages and two job ids.
   - **Now**:
     - **The marker first, then the claim**, so every claim names a build
       whose marker already exists.
     - **`claimVerdict`** (in `build-live.mjs`) decides what a written claim
       means:
       - *held* (follow it) while its owner may be running;
       - *free* only when the owner ended: a kept answer, a row verdict, its
         own release, or no row and older than any build runs;
       - a claim that isn't one (unparseable) is also free.
       - A missing or unreadable marker is never "free" on its own.
     - **Takeover** is a write conditional on the exact claim judged (its
       ETag). If the claim changed in the meantime, it is judged again, at
       most three times.
     - **Ownership that can't be settled** (the claim can't be read, or it
       keeps changing) answers a retryable 503. Nothing is filed, stored,
       queued or charged, and no marker is left.
     - **A request that follows another build** takes its own marker back.
     - **A release** (the job couldn't be stored or queued) writes `ended`
       over its own claim, conditional on its ETag, before deleting its own
       marker. It never blind-deletes a claim, so it can't remove one
       another request has taken since. The chat is then free for the next
       build.
     - **A marker that can't be written**: the build runs unlisted, as
       before; no claim is made, so nobody's ownership is in doubt.
2. **Running builds skipped while the page was busy**.
   - **What happened**: discovery skipped a running build while `siteBusy`
     was true, but marked the page checked, so later renders never came back
     for it. Codex saw two running builds, three renders, one poll and one
     restored chat.
   - **Now**:
     - each owed build is queued, oldest first;
     - one is taken up at a time, and only while nothing else on the page is
       busy;
     - while owed builds wait and the page is busy, a local re-check (no
       request) comes back every 750 ms and takes the next one as soon as the
       page is free, whichever of its many paths freed it; it stops once
       nothing is owed;
     - the listing is still read while busy, but nothing is taken up and
       another operation's busy state is never touched;
     - a found build takes the busy state as a sent one does and gives it
       back when it ends;
     - nothing is posted, restarted or answered twice.
3. **A 503 from the listing ended discovery for the page load**.
   - **Now**:
     - one listing read at a time;
     - a failed read (non-OK status, unreadable body or network error) is
       retried automatically at 2, 4, 8, 16 and 32 seconds;
     - after that, only a render at least a minute later reads again, so
       there is no rapid loop;
     - a 401 still waits for the next render;
     - a successful read ends discovery for the page load.

### Tests (all offline; images mocked; progress from a supplied writer)

`test/build-reconnect.test.mjs` now has 27 cases (16 kept and 11 new).
- **RC 11, Codex's interleaving**: A paused just after its claim landed; B
  follows A's build; A queues it. One row, one queue message, one job, one
  marker.
- **RC 12, the other side**: A paused after its marker and before its claim.
  B claims and queues; A follows B and takes its own marker back.
- **RC 13, a claim with no marker**:
  - a young one is followed (nothing filed, queued or marked);
  - an abandoned one (older than any build runs) or a released one is
    taken.
- **RC 14**: a claim that can't be read gives a 503 with `retry`. No row, R2
  job, queue message, ledger call or marker.
- **RC 15**: a release leaves another request's claim exactly as it was, both
  when that claim landed before the release and when it landed inside the
  release's own read-then-act window.
- **RC 16**: two takers of one ended claim. Both judge it free; B's takeover
  lands first and B queues. A's takeover, conditional on the claim it
  judged, fails; A judges again and follows B. One row, one queue message.
- **RC 6 (revised)**: the released claim says `ended`, nothing is listed, and
  the next first build for that chat is filed as its own.
- **RB 6, Codex's browser case**: two running builds in two chats over three
  renders. Both are followed one after the other (the second build's polls
  all come after the first's last), each chat gets its answer once, the
  listing is read once, nothing is posted, and the page ends free.
- **RB 10**: one render and two running builds. The second starts when the
  first ends, without waiting for a render.
- **RB 7**: discovery while another operation is busy. Nothing is taken up
  and the busy state is untouched; once free, the ended and running builds
  are each taken up once.
- **RB 8**: renders while the first read is out ask nothing more (counted at
  that moment). Its 503 is
  retried once after 2 s, and the build it names is shown.
- **RB 9**: a listing that keeps failing (503s and thrown network errors)
  gets five retries at exactly 2/4/8/16/32 s, nothing more inside the
  minute, and one more read a minute on.

### Red check

The same test file was run against `7a8e7518`'s `worker.js` and `chat.js`,
with the new module so the imports load:
- RC 11, RC 13 and RC 14 hang: the old code queues a second build, or starts
  one, and waits on it;
- RC 12, RC 6, RC 15 and RB 6–9 fail.
- RC 15's first version passed on the old code, because the old release also
  checked before deleting. The in-release window was added, and it is red on
  the old code.

### Sweep

- **First pass**: 17 mutants plus a comment-only control. 13 were killed and
  4 survived:
  - the takeover without its ETag condition;
  - the finish-triggered drain;
  - the in-flight guard;
  - the found build taking the busy state.
- **What they showed**:
  - **A real defect, not only a weak test.** RB 10, written for the drain
    survivor, failed on the code itself. A successful build ends through
    `siteFinishBuild`, which re-renders only when its chat is the open one,
    so a second owed build could wait for an unrelated render. The fix is
    the general local re-check above, not a hook on one finish path; the
    finish hook was removed as redundant.
  - **Missing assertions**: RC 16 was added, and RB 6 and RB 8 were
    tightened.
- **Second pass**: the four survivors (the drain one now targeting the
  re-check) are all killed, and the control survived.
- **Result**: 17 of 17 killed.
- **Related suites**: 193 of 193 (reconnect, build-queue, jobs, resume,
  parallel, disconnect, chat, Dockerfile, images).

### Commit, suite and image

- **Commit**: `9f62095e`.
- **Full suite**: `10369 / 10369 / 0 / 0` locally.
- **Image**: `builder/build-live.mjs` changed, so the prediction is
  production `8d6dbcea93252fbb` → `dd8d2e17a6559834` (205 inputs, 174
  paths). Predicted, not built.

### CI

- **On `74b41d1a`**: site build 38063680474 was green. Unit tests
  38063680493 were cancelled at the job's 5-minute limit after the suite had
  finished clean (`10369 / 10328 / 0 / 41`, 298.8 s).
- **On `425d6340`** (the same code): unit tests 38064225602 were green
  (`10369 / 10328 / 0 / 41`, 255.6 s).
- The 5-minute limit in `.github/workflows/unit.yml` is now within a slow
  runner's time for the whole suite. It is recorded as a finding and left
  unchanged.

## Round 3: storage failures, unaccepted jobs and the inline fallback (offline)

Three gaps that remained after round 2 (`df55065e`), fixed together as
general rules.

1. **Duplicate work after a storage failure.**
   - **The gap**: the queue consumer runs whatever job object it finds, row
     or no row. When the queue send failed, the producer deleted the job
     (best effort), closed the row and ran the build inline. A send that
     failed after its message had landed, with a delete that also failed,
     meant the queued build and the inline build both ran. The same applied
     to a job store whose write landed but reported failure.
   - **Now** (`buildJobGone`): the inline fallback runs only when the job
     object is provably gone, deleted and then read back as absent. If not:
     - after a failed store, the message is still sent;
     - after a failed send, the build is followed.
     - The row stays open; the stale sweep re-sends a queued row nobody
       touched, and fails it with the deposit back if it never runs.
     - Round 3 claimed "one build, never two". **That was wrong** (Codex's
       review of `b67a1c8b`); see round 4.
2. **Discovery exposing unaccepted jobs.**
   - **The gap**: since round 2 the marker is written before the claim, so
     the listing showed a build as running before its job was stored or
     queued, including ones that then fell back to inline and had no job to
     follow.
   - **Now**: a marker records whether its build was accepted. It becomes
     `accepted` only once its message is sent (or may still run), and the
     listing shows only accepted builds (`listsBuild`). Not yet accepted
     means:
     - **accepting** (it holds its chat) while its row has no verdict, or
       with no row while it is younger than an acceptance takes
       (`BUILD_ACCEPT_MS`, 5 minutes);
     - **abandoned** (the chat is free) once its row has a verdict, or with
       no row once it is older than that. This also shortens round 2's
       "crashed acceptance holds its chat until it ages out" to 5 minutes
       when no row was filed; with a row, the stale sweep settles it.
3. **The inline fallback's ownership.**
   - **The gap**: falling back inline released the chat claim at once, so a
     second POST could start a second, paid build while the first ran
     inline.
   - **Now**:
     - the inline build keeps its claim, and its marker says `inline`;
     - another POST for that chat gets a no-cost 409
       (`build-running-inline`), with nothing filed, queued or charged and
       no job to follow;
     - the build is never listed;
     - when it ends, however it ends, the route releases its claim
       conditionally and deletes its marker (`buildDone.finally`), so the
       next build is free;
     - an `inline` marker holds its chat whatever its closed row says, and
       only while it is younger than a build can run.

### Tests

`test/build-reconnect.test.mjs` now has 30 cases (3 new; RC 8 extended).
- **RC 17**: the queue send fails after its message landed, and the job
  can't be proven gone.
  - Nothing runs inline, the row isn't closed, and the build is accepted
    and listed.
  - The consumer runs it once, and the waiting POST answers with that one
    job.
  - **Store side**: the write lands but reports failure, and the delete
    fails. The message is still sent, and nothing runs inline.
- **RC 18**: the queue send fails and the job is provably gone, so the build
  runs inline.
  - While it runs, a second POST gets a 409 with no row filed, and the
    listing shows nothing.
  - When it ends, the claim says `ended`, the marker is gone, and the next
    build is filed.
- **RC 19**: while a build is being accepted, the listing shows nothing.
  - Once its message is sent, it is listed.
  - An attempt abandoned before acceptance is never listed and frees its
    chat.
- **RC 8**: the new states and both predicates (`holdsChat`, `listsBuild`).
- **Fixture**: `test/build-queue-wiring.test.mjs`'s bucket gained R2's
  `head()`. Its storage-failure case still runs the build inline, because
  the job is provably absent.

### Red check

RC 17, 18 and 19 were run against `df55065e`'s `worker.js`, with the new
module and tests:
- RC 17 and RC 19 fail;
- RC 18 never reaches an inline build (its promise is left pending).

### Sweep

- **Setup**: 15 mutants plus a comment-only control.
- **First pass**: 13 killed and 2 survived, both in `buildJobGone`:
  - **"ignore a failed delete" survived because it was equivalent**: the
    read-back after it still sees the object. The early `return false` on a
    failed delete was redundant and over-cautious, since a delete that
    reports failure may still have removed the object. It is gone; the
    read-back alone decides.
  - **"`return true` instead of the read-back"** survived because every test
    stopped at the delete first. With the early return gone, RC 17 reaches
    the read-back and kills it.
  - **A reverse mutant** (a read-back that throws counted as gone) was added,
    with RC 17's third part, a failed read-back after a failed send. It is
    killed.
- **Result**: 15 of 15 standing mutants killed; the control survived.
- **Related suites**: reconnect 30, queue-wiring 13, jobs 31,
  resume-wiring 44, parallel 15, survives-disconnect 4, chat 21,
  Dockerfile 21, images 17. All pass.

### Commit, suite and image

- **Commit**: `ae62f760`.
- **Full suite**: `10372 / 10372 / 0 / 0` locally.
- **Image**: production `8d6dbcea93252fbb` → `bccb030af1f1eed1` (205 inputs,
  174 paths). Predicted, not built.

### CI

- **On `bfab3f05`**: site build 38070870490 was green. Unit tests
  38070870491 were cancelled at the 5-minute job limit after a clean suite
  (`10372 / 10331 / 0 / 41`, 298.5 s).
- **On `55fadecd`** (the same code): unit tests 38071394565 were green
  (`10372 / 10331 / 0 / 41`, 283.1 s).


## Round 4: one execution rule for queued and inline builds (offline)

Codex reviewed `b67a1c8b` and passed all 43 reconnect and queue-wiring
tests. Codex also confirmed that the losing-candidate discovery reproduction
now passes; that fix is kept. Two deterministic failures remained, and round
3's claim that a storage failure could no longer duplicate a build was
**wrong**.

1. **A marker write that throws bypassed ownership.**
   - **Codex's reproduction**: an accepted running build holds its chat with
     a valid claim and marker. Only the new candidate's marker write throws.
     `liveBuildStart` caught the error and returned without enforcing
     ownership, so `enqueueSiteBuild` filed another row and queued a
     different job.
   - RC 17 never covered this: it tests job storage and queue delivery, not
     the marker.
2. **`buildJobGone` was not proof that execution can't happen.**
   - **Codex's reproduction**: the queue accepts the message, and the real
     consumer reads the job and reaches its designer, which is held open.
     The producer's send then rejects as though its response was lost. The
     producer deletes the stored job, `head` returns null (the consumer had
     already deleted it on read), and an inline build starts while the
     consumer is still executing. Codex saw extra designer calls while the
     consumer's first was held.
   - Deleting an envelope can't revoke execution that has already started.

### The rule: one execution record per job

`builder/build-live.mjs` (`buildRunKey`, `packBuildRun`, `readBuildRun`,
`runVerdict`) and `worker.js` (`claimBuildRun`, `revokeBuildRun`):
`builds-run/<job>.json`, created with a conditional write, so exactly one
party ever creates it.
- **The queue consumer** creates it (owner `queue`) before it executes or
  fires the container.
  - If another party holds it, the consumer doesn't run.
  - If the write can't be settled, it never runs on that: the job goes back
    and the message is asked again, bounded by `CLAIM_RETRY_MAX`.
  - The container's runner (`takeOver`) continues the consumer's own
    execution and takes nothing.
- **The inline fallback** creates it (owner `inline`) before running.
  - If the consumer holds it, the producer follows the queued build. Nothing
    runs inline, the row isn't closed, and nothing is released: a failed
    send response alone never revokes execution in progress.
  - If the write can't be settled after a failed send, the build is followed,
    never run inline.
  - **The store path has one exception.** If the job's store failed, no
    message was ever sent, and the row is confirmed closed (or there is
    none), then no consumer can learn of the job, and the inline build runs
    as the only possible execution.
  - The row is closed only once the producer holds the record.
- **The same logical build and billing identity.** The inline run carries its
  job's id (`billId`), so its deposit and refs are `build:<job>`, exactly as
  the queued run's would be, never a fresh ref beside them.
- **A missing marker never bypasses ownership.** With no marker, a candidate
  claims nothing, but it still reads the chat's owner and follows it. A chat
  with no owner it can see, or one whose claim looks free, answers a
  retryable 503 and starts nothing.
- **The execution record outranks the marker's flags and the acceptance
  timeout.**
  - The listing view reads the record. A queued executor whose "accepted"
    write was lost is still `running`, and an inline executor whose "inline"
    write was lost is still `inline`, long after `BUILD_ACCEPT_MS`.
  - Before a stale-looking claim is taken over, the old job's record is
    written as `revoked`, conditionally. If an executor already holds it, the
    chat stays held, unless the executor is older than any build runs. A
    revoked job's late delivery never executes.
  - Claims the owner released itself, and builds that ended (a kept answer
    or a row verdict), need no revocation.

### Tests (offline; images and designer mocked)

`test/build-reconnect.test.mjs` now has 33 cases.
- **RC 17 (rewritten for the rule)**:
  - a send fails after its message landed: the producer takes the record
    and runs inline once, billed under `build:<job>`, and the delivered
    message's consumer never executes;
  - a store write lands but reports failure: inline, never announced;
  - the record can't be written after a failed send: nothing inline, the row
    stays open, and the consumer runs it once.
- **RC 20, Codex's marker-write reproduction**:
  - a running owner is followed, with no row, no queue message and no
    marker;
  - with no owner, the response is a 503;
  - a claim that looks free is never taken by a candidate with no marker.
- **RC 21, Codex's held-designer reproduction**:
  - the real consumer reaches its designer and is held while the producer's
    send rejects;
  - one designer call, no row closed, the execution record is `queue`;
  - one deposit, and every billing ref is `build:<job>`;
  - the POST answers with that one job.
- **RC 22, the transition windows**:
  - a queued executor past the acceptance window is followed and listed
    running;
  - an inline executor past the window gets a 409;
  - a claim with no marker whose job is executing is held;
  - an abandoned attempt is revoked before its chat is taken, and its late
    delivery never executes.
- **Fixtures**: the queue-wiring bucket answers like R2 (the object written,
  or null when a conditional write's precondition fails).
- **Guards**: two `build-jobs.test.mjs` guards now read the new shape. Rows
  are closed only after the record is won, and `runSiteBuild` takes `billId`.

### Red check

RC 17 and RC 20–22 were run against `b67a1c8b`'s `worker.js`, with the new
module and tests:
- RC 17 fails: the consumer executes a job the inline build held;
- RC 21 fails: the active consumer's row is closed on a failed send;
- RC 20 and RC 22 hang: the old code queues a second build and waits on it.

### Sweep

- **Setup**: 16 mutants plus a comment-only control, run against the
  reconnect and queue-wiring files.
- **First pass**: 12 killed and 4 survived.
  - **The store path's "row confirmed closed" check**: the case is a store
    failure with the record unwritable and a row that can't be closed. RC 17
    gained that part: the job is queued and followed, never run inline.
  - **The revoke that can't be settled**: RC 22 gained the case where the
    old job's record write fails, which answers 503 and takes nothing over.
  - **An already-revoked record counted as free**: RC 22 gained the case of
    an abandoned claim whose job another request had already revoked.
  - **The inline line in `buildLiveState` is equivalent**: without it, a lost
    "inline" write past the window reads `abandoned` rather than `inline`.
    The revoke path then finds the `inline` record, holds the chat and
    answers 409, and neither state is listed. It is kept so the view says
    what is true.
- **Second pass**: the three non-equivalent survivors are killed.
- **Result**: 15 of 16 killed, 1 recorded as equivalent; the control
  survived.
- **Related suites**: reconnect 33, queue-wiring 13, jobs 31,
  resume-wiring 44, parallel 15, survives-disconnect 4, chat 21,
  Dockerfile 21, images 17. All pass (199).

### Two existing tests, restated for the rule

- **`build-batch-9.test.mjs`, "a redelivery of that job makes no second
  corrective call"**: the test re-stores the job and delivers it again after
  it executed. Under the execution record, that redelivery doesn't execute at
  all, which is stronger than "no second corrective call". Its observer had
  required the redelivery to reach the designer. It now requires the first
  delivery's record (`queue`) and asserts zero design calls on the
  redelivery.
- **`credit-debit.test.mjs`, the billing-ref guard**: `billRef` is now
  `jobId || billId || crypto.randomUUID()`.

### Commit, suite and image

- **Commit**: `0cc457de`.
- **Full suite**: `10375 / 10375 / 0 / 0` locally.
- **Image**: production `8d6dbcea93252fbb` → `d2e9c973504783f1` (205 inputs,
  174 paths). Predicted, not built.

### CI

- **On `50029f91`**: unit tests 38079343352 green (`10375 / 10334 / 0 / 41`,
  273.7 s); site build 38079343341 green.

## Round 5: the inline fallback's row, and lost record writes (offline)

Codex reviewed `70222bb5` and passed 114 focused tests. Kept from round 4:
the marker-write protection, the consumer-versus-inline exclusion, the
billing identity and the discovery fixes. Two deterministic regressions
remained.

1. **The inline fallback failed its own row, then billed against it.**
   - `takeInline` won the execution record and then called
     `closeBuildRow(..., "failed", ...)` before running the fallback.
   - Since round 4 the fallback passes `billId` into `buildLedger` as its
     `jobId`, so its deposit goes through `build_debit` against that row.
     The repository's SQL (`supabase/proposed/build_debit.sql`) refuses a
     lost, failed or cancelled row.
   - **Codex's observation** (with a mock that honours that rule):
     `edit_refund` marked the row failed, `build_debit` answered
     `terminal`, the designer was never called, and the POST answered 503
     "Credits check failed."
   - The earlier tests passed only because their billing answers always
     said yes.
2. **A lost builds-run write stranded the job.**
   - The consumer's conditional write of `builds-run/<job>.json` committed,
     and then the call threw because its response was lost.
   - The first delivery scheduled a retry. The retry read `owner: "queue"`,
     assumed another executor was running, and returned after deleting the
     job's envelope.
   - **Codex's observation**: zero designer calls, no result, and no
     further retry.

### The fix

**The fallback keeps its row live** (`worker.js`, `enqueueSiteBuild`):
- `takeInline` no longer closes the row. Once the execution record is won,
  `holdRow()` claims the row's lease under a fresh owner
  (`claimBuildRow`) and beats it (`buildRowBeat`), as the queue consumer
  does. The row moves queued → claimed, which `build_debit` accepts.
- `after(res)`, when the work actually ends, clears the beat and finalizes
  the row: `edit_finalize` with ok for a 2xx answer, and `edit_refund`
  (failed) otherwise.
- The store-unknown path holds the row the same way before it runs inline.
- The terminal-job guard is unchanged, and the billing identity is still
  `build:<job>`.

**The execution record names its attempt** (`builder/build-live.mjs`):
- `packBuildRun` and `readBuildRun` carry `token` (the attempt's own name)
  and `started` (written just before execution begins).
- `runStanding(run, now)` says what another attempt's record means to a new
  arrival:
  - `active`: an inline run, or a queued attempt that started. Protected.
  - `pending`: a queued attempt that claimed and has not started, younger
    than `BUILD_RUN_START_MS` (5 minutes). Waited for, never run beside.
  - `recoverable`: an unstarted attempt past that window, or any executor
    older than `BUILD_JOB_MS`. Replaced, conditionally on exactly the record
    read.
  - `revoked`.

**Write outcomes are reconciled** (`worker.js`):
- `claimBuildRun` reads the record back after a write that threw or
  answered nothing. If the record carries this attempt's token, the write
  landed, and the same delivery proceeds. If the read back fails too, the
  outcome is `unknown`.
- `replaceBuildRun` (conditional on the etag read) and `startBuildRun`
  (marks `started`, conditional on the etag) reconcile the same way.
- An `unknown` outcome never executes. `askAgain` puts the job object back
  and re-sends the message carrying the attempt's `token` and the lease it
  holds (`holder`). The retry adopts its own unstarted attempt, and
  `claimBuildRow` takes the lease over by name through `edit_handoff`, as
  the container runner does.
- `builder/build-job.mjs` `readMessage` passes `token`, `holder` and
  `waits` through when they are well shaped, and drops them otherwise.

**The waits have their own bound** (`RUN_WAIT_MAX`, `worker.js`):
- `CLAIM_RETRY_MAX` is 1, and one re-send is about 67 seconds
  (`SITE_BUSY_DEFER_S`): shorter than the 5-minute start window, so a
  delivery waiting on a pending attempt would have given up before that
  attempt could become recoverable.
- `RUN_WAIT_MAX` is enough re-sends to outlast the window, plus two (7).
  It is counted in the message's own `waits` field.
- At the bound, or when the message cannot be re-sent, the job object is
  put back and kept for a later delivery. It is never deleted on a label.

### Tests (offline; images and the designer mocked)

`test/build-reconnect.test.mjs` now has 36 cases.
- **A stateful SQL stand-in** (`sqlJobs`) replaces the always-yes billing
  answers. It moves one row per job only as the applied functions do:
  - `edit_create` files the row queued;
  - `edit_claim` claims it, and refuses `terminal` or `leased`;
  - `edit_handoff` and `edit_beat` work only for the current owner;
  - `edit_refund` and `edit_finalize` end the row;
  - `build_debit` refuses lost, failed or cancelled rows as `terminal`,
    plus `not-a-build`, `not-owner` and `no-job`.
  
  Every call and state is kept in order. `runNet` routes through it, and
  RC 17, RC 21 and RC 23–25 share one instance between the producer and
  the real consumer (through `fireInterim`'s `over`).
- **RC 23, Codex's fallback-billing reproduction**:
  - the queue send fails and the job is provably gone;
  - the fallback takes the execution and its row's lease (queued →
    claimed);
  - `build_debit` is accepted under `build:<job>` on that row;
  - one designer call, no 503, and no "Credits check failed";
  - no `edit_refund` or `edit_finalize` before the deposit, and exactly one
    terminal write, after it.
  - **Control**: a row the sweep already marked lost is still refused
    `terminal`, with zero designer calls and a 503.
- **RC 24, Codex's lost-record-write reproduction**:
  - (a) the conditional write commits and then throws. The read back finds
    its own token, so the same delivery runs once: one designer call, the
    record `started`, one accepted deposit, and the build carried on to its
    generation.
  - (b) the read back fails too. Nothing executes or charges. The job is
    put back, and the message is re-sent with the attempt's token, its lease
    holder and `waits: 1`. The retry delivery adopts the attempt, takes the
    lease over by name and runs once. In total: one designer call, one
    deposit, and the row queued → claimed.
- **RC 25, competing attempts**:
  - a started queued attempt, or an inline run, is never run beside or
    charged. Its record and lease are untouched, and nothing is re-sent.
  - a pending attempt is waited for: the job is kept and re-sent with
    `waits: 1`.
  - a stale unstarted attempt (past 5 minutes, lease expired) is replaced
    and run once.
  - a delivery at its bound keeps the job and sends nothing.
- **RC 18 restated**: the fallback holds its row's lease while it runs. It
  does not close the row first.
- **Guards re-anchored to the same properties**:
  - `build-jobs.test.mjs`: the fallback holds its row after the record is
    won and closes it only in `after`, and the claim names a retry's
    holder;
  - `build-runner.test.mjs` and `site-busy.test.mjs`: the claim's new
    argument;
  - `broad-rollout.test.mjs`: the delivery's clock still reaches the build
    beside the new fields;
  - `build-job.test.mjs`: a case for the reader's new fields.
- **The fixture** `fireInterim` can deliver a retry's message fields
  (`msg`) onto the envelope a previous attempt put back (`keepJob`).

### Red check

The new tests were run against `70222bb5`'s code (with the start window
inlined, since that commit has no such export). Five cases fail:
- RC 23: `build_debit` answers
  `{"ok":false,"error":"terminal","state":"failed","taken":0}`, Codex's
  observation;
- RC 24: zero designer calls after the lost write, Codex's observation;
- RC 25: a pending attempt's delivery is not asked again;
- RC 17 and RC 18, under the stateful rows.

The active-consumer parts of RC 25 pass there too, as they should: that
protection was already in place.

### Sweep

- **Setup**: 16 mutants plus a comment-only control, against the reconnect
  and `build-job` files.
- **First pass**: 14 killed, 2 open, and the control survived.
  - "holdRow holds nothing" survived. That mutant dropped only the
    reported hold and its beat; the claim itself still ran, so no
    short-lived test can observe it. A stronger mutant that skips the
    claim is killed (RC 17).
  - "pending is recoverable" hung the whole file before RC 25 reported (I
    stopped that run by its process id). Run on RC 23–25 alone, it is
    killed (RC 25).
- **Second pass**: both killed (the stronger hold mutant, and "pending is
  recoverable" on RC 23–25).
- **Result**: 16 of 16 killed, one of them through its stronger form. The
  beat's absence on its own is recorded as unobservable at test timescale.

### Related suites

- reconnect, queue-wiring, jobs, resume-wiring, parallel,
  survives-disconnect, chat, Dockerfile, images, batch-9, credit-debit and
  runner: 261 of 261;
- build-job, rebuild-job and runner: 43 of 43;
- broad-rollout and site-busy: 27 of 27, after the re-anchor.

### Commit, suite and image

- **Commit**: `6777ce1c`.
- **Full suite**: `10378 / 10378 / 0 / 0` locally. The first run found the
  two pinned guards in `broad-rollout` and `site-busy`, which were
  re-anchored before the commit.
- **Image**: `builder/build-live.mjs` and `builder/build-job.mjs` changed,
  so the prediction is now production `8d6dbcea93252fbb` →
  `42bf628bceb7ed5b` (205 inputs, 174 paths). This replaces round 4's
  `d2e9c973504783f1`. Predicted, not built.

### CI

- **Site build** 38082680268 on `6777ce1c`: green.
- **Unit tests** 38082680261 on `6777ce1c`: cancelled after 88 s by the
  records push (the workflow cancels a run in progress).
- **Unit tests** 38082765763 on `79e4a2e4` (the same code plus records):
  cancelled at the job's 5-minute limit (20:11:47 → 20:17:05 UTC). This is
  the recorded finding about that limit; the local suite took 352 s. Its
  log could not be read from here, and a re-run needs `actions: write`,
  which this session doesn't have. The push of this CI record starts
  another run.

### Remaining limitations

- **An attempt that never started holds the job for up to 5 minutes**
  before another delivery may replace it.
- **The waits are bounded** (`RUN_WAIT_MAX`, 7 re-sends). Past the bound,
  the job object is kept, but nothing re-sends it except the row's stale
  sweep. That sweep re-sends only a queued row with no live lease; a
  claimed row whose lease expired is marked lost.
- **A fallback whose row lease cannot be taken** (the claim refused or
  unread) still runs inline without a lease. Its deposit is taken if the
  row is live, and refused if the row is terminal.
- **The heartbeat of the fallback's lease** is not observed by any test.
- **Unchanged from round 4**:
  - execution records are never swept;
  - an executor older than `BUILD_JOB_MS` is treated as gone;
  - builds accepted before round 1 aren't listed;
  - real images, real-model wording and any live run are unverified.
