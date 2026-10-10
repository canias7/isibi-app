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
