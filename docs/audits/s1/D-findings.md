# Reader D: requests on the server and the page (offline, read-only)

Branch `claude/cool-fermat-a06gie` at `c7c881dc`. I changed no product or test files and spent nothing.

## D-1 (high): a message accepted as a request still reaches the site agent with no conversation

- **Where:** `worker.js:24932-25062` (`acceptRequest` → `newRequest`), `builder/request.mjs:311` (`newRequest` has no chat field), `builder/request.mjs:2766` (`jobBody` has no chat field) and `worker.js:36009` (`chat: eb && eb.chat`).
- **Summary:** commit `180f2382` ("Edits send their chat id") added `chat: origin` only to the page's direct edit body (`reactSend`). A site message that the route takes on with its key goes another way: `/api/site/route` → `acceptRequest(..., queue: true)` at `worker.js:34094`. The request record never stores `rb.chat`, and `jobBody` builds the part's job body without it. So `runAgentChange` receives `chat: undefined`, and the history at `worker.js:16926` stays empty.
- **What the customer sees:** the same bug as Market Lane's "delete that". A follow-up such as "make it bigger" or "delete that" is read with no context, so the agent may edit the wrong thing.
- **Scenario:** the customer asks what "Loading goods…" is. The reply is an answer. The customer then says "delete that". The route accepts it as a request (rKey set, intent edit), the request files a job with `jobBody`, and the agent runs with `history = ""`.
- **Confidence:** confirmed by reading the code. `grep chat builder/request.mjs` finds nothing, and no test covers the request path (`test/edit-sends-chat.test.mjs` checks only the page's edit body). The fix needs to keep `cleanChatId(rb.chat)` on the record and send it in `jobBody`'s edit and addon bodies.

## D-2 (medium): a reload or a second device can miss the running message and the queued ones

- **Where:** `worker.js:34440-34450` (the `GET /api/site/requests/<slug>` route).
- **Summary:** the route lists `requests-live/<slug>/` once with `limit: 50` and does not page. Markers stay for 24 h after a request ends (`LIVE_AFTER_END_MS`), and keys are random UUIDs (`chat.js:6851`), so R2 returns the first 50 in an effectively random order. The running request and the queued requests can fall outside those 50. `siteOpenRequests` does page (5×100), so the server's queue and the page's view can disagree.
- **What the customer sees:** after a busy day on one site (more than 50 messages in 24 h), a reload or another device shows no working line, no Stop and no queued chips for work that is still running or waiting. The replies to those messages never appear on that device.
- **Scenario:** 60 edits on one site today, then a reload while message 61 runs and 62 waits. The list misses 61 and 62, and `siteRequestsCheck` never follows them.
- **Confidence:** plausible. The limit and the key order are confirmed. The volume is what makes it happen.

## D-3 (low): the "steps above the reply" fix also draws steps above other lines

- **Where:** `public/chat.js:10066-10078` (`siteReqDoneLines`).
- **Summary:** the fix reads `m.req`, and `siteReqPut` stamps `req` on every assistant line of a request. The function also calls `siteReqWorkingLine(m, site)` as its "still working" guard. That guard reads `m.request`, which a reply never has, so it is always false for a reply.
- **What the customer sees:** for a one-part message, the job's steps drawn as done appear:
  - above the agent's question while the work is paused waiting for the answer;
  - above "I lost sight of how that request is going" and "I couldn’t stop that just now";
  - again above a second reply of the same request (go-ahead, then end).

  The steps look finished while the work is not.
- **Confidence:** confirmed by reading the code (`siteReqDoneLines` → `siteReqWorkingLine` checks `m.request`).

## D-4 (low): a queued message can wait up to two minutes after a failed read of the line

- **Where:** `worker.js:24768-24776` (`advanceRequest`).
- **Summary:** if `siteOpenRequests` fails once (an R2 list or read error, which returns null), a new queued message is held "in line" even when nothing runs. Only the sweep (about 2 minutes) releases it.
- **What the customer sees:** a message sent to an idle site shows "Waiting for the current job to finish" or a queued chip, with nothing running, for up to 2 minutes.
- **Confidence:** plausible. It needs a transient storage failure.

## Rules checked that held

- **One request per site:** `queueBlockers` and `holdsQueue`, with etag-guarded release. I traced the races between two new messages, between a message and an end, and between an end and a sweep. Each release is a compare-and-swap, and every reader sees the other request as either running or ahead in line.
- **Stop only the running one:** `siteRunningWork` skips queued and waiting requests. The queued chip's ✕ stops only its own key, and nothing is filed for it, so nothing is charged.
- **A resumed request waits:** `resumeRequestPart` → `resumeInLine` puts it at the front of the line, behind the running request.
- **Ownership:** every `/api/site/request*` route checks `rec.uid` (and the site owner when it can be read). Ask-files and the chat store are keyed by uid.
- **Duplicate acceptance:** retries under the same key are create-only and read back, so nothing runs twice.
- **The reply on reload:** the one reply is claimed on the server (`oneReplyFor`) and charged under a fixed ref, so it is not billed twice.

## Units read

- **worker.js:** `acceptRequest`, `advanceRequest`, `startNextInLine`, `siteOpenRequests`, `siteQueueAhead`, `stopRequest`, `stopRequestPart`, `resumeRequestPart`, `loadRequest`, `createRequestRecord`, `saveRequestRecord`, `settleRequestMarker`, `oneReplyFor` / `writeOneReplyNow`, the room units (`ROOM_KEEP_MS` … `streamFromRoom`, `actionRoom`), the ask-files units and route, every `/api/site/request*` route, and `newProjectTurn` / `agentRouted` (nearby).
- **chat.js:** `siteReqFollowing` through `siteRequestsCheck`, `siteReqQueued` through `siteReqCardHTML`, and `siteRequestWorking` (with `siteRunningWork` and `siteStopWork`).
- **builder/request.mjs (for context):** `queueBlockers`, `holdsQueue`, `aheadInLine`, `releaseQueue`, `resumeInLine` and `jobBody`.

## Not finished

I did not read these fully, so money and held-change double billing are not audited:

- the preparation and held-change units: `stage*`, `prep*`, `held*`, `sealHeld`, `applyHeldAlias`, `resumeHeld`, `buildHeld`;
- the purchase units: `purchaseOnce`, `purchasesKnown`, `purchaseBuyer`, `purchaseGuard`;
- `enqueueSiteBuild`, `runQueuedSiteBuild`, `runQueuedSiteEdit`, `designRequest`;
- the rewrite and approve units;
- the task-line units: `syncRequestTasks`, `writeTaskLines`, `newerWorkSince`, `newerRequestSince`, `repeatNote`, `requeueReply`, `enqueueReply`;
- the attachment decoders;
- in chat.js: `initRunAgents`, `clarifyOf`, `siteReqKeys`, `siteReqKeyCard`, `siteRequestHTML`.
