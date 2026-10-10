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
