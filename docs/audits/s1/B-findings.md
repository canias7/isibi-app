# Audit s1, reader B: worker agent paths (findings)

Offline, read-only. No product or test file changed. Line numbers are those of `worker.js` on `claude/cool-fermat-a06gie` at audit time.

## B-1 (high): queued request parts never carry the chat id, so the agent gets no history on the main path
- **Where:** `builder/request.mjs:2766-2830` (`jobBody`), used by `fileRequestJob` at `worker.js:23498`. Read by `runAgentChange` at `worker.js:17019` (`chat: eb && eb.chat`) and history at `worker.js:17019` (the `chatStoreRead`/`historyText` line, function line 122).
- **Summary:** neither the request record (`newRequest` in `acceptRequest`, `worker.js:24990-25010`) nor `jobBody` stores or sends `chat`. Every part run through the request flow (a message with `idem`, flow on, edits queued, which is the production path) replays the edit route with no `eb.chat`, so `history` is always `""`.
- **What the customer sees:** a follow-up such as "make it bigger" or "so can we take payments" is read with no idea what came before. The agent guesses or acts on the bare words. Tonight's `public/chat.js` fix (sending the chat id) cannot help on this path, because the server drops the id when it files the part.
- **Scenario:** the owner talks about payments, then sends "so can we take payments" with an idem key. `acceptRequest` builds the record with no chat, `jobBody` posts `{instruction, picker, idem, ...}` with no `chat`, and `runAgentChange` reads no history.
- **Confidence:** confirmed end to end by reading. `grep chat builder/request.mjs` finds only a comment.

## B-2 (high): only a prompt sentence decides "answer only" or "may build", and nothing on the server stops a large spend on a question
- **Where:** `worker.js:16956-17019` (`runAgentChange` always offers `build`, `applySchema`, `callFunction`, `split`, settings and the other write tools). The only guard is the prompt in `builder/site-agent.mjs:318`. `site-agent.mjs:293` tells it to build on "Build it anyway" after a key question.
- **Summary:** for an existing site there is no server mode or flag that separates a question from work, and no confirmation threshold. `agentRouted` (`worker.js:24924`) always sends `intent: "edit"`. The agent decides alone, and every credit it spends is charged. `affords` checks only the balance.
- **What the customer sees:** a question ("so can we take payments") can become a 47-credit checkout build with no price shown first. This is made much more likely by B-1: with no history, a "so ..." follow-up looks like a fresh request.
- **Scenario:** the payments incident. KEYS FIRST (line 293) also pushes the agent into the feature's key question, whose "Build it anyway" option builds.
- **Confidence:** confirmed that no server-side gate exists. The live misread itself is plausible.

## B-3 (high): a new project's agent that fails falls back to `intent: "build"`, and the browser starts a paid first build
- **Where:** `worker.js:24894-24915` (`newProjectTurn`: `if (!ag || !ag.ok) return { ok: true, intent: "build", failed: true, ... }`), reached from `worker.js:33463`. On the client, `public/chat.js:9775-9830` checks `failed` only for `!isBuild`, and `go()` runs at the `d.intent !== 'ask'` line (~9973).
- **Summary:** any agent failure on a project with no site takes the build path. That includes a provider 503 or 429 (in the Worker `quickSend` has no deadline, so `withProviderRetry` parks and throws at once), a timeout, `too-long` or `no-tool`. The `routed.wait` provider-wait path (`worker.js:33610`) is never reached for new projects.
- **What the customer sees:** they type "hi" or "would a booking page help?" while Grok is down or slow, and a full first build (11–45 credits) starts instead of a reply or the provider-wait notice. This is the "started building on a side question" failure the 2026-11-03 prompt was written to stop.
- **Confidence:** server half confirmed. The client path was traced by reading, not run.

## B-4 (medium): outside the request flow, an answer to the agent's question is not checked or closed, and the question is dropped
- **Where:** `worker.js:33466-33471` (the no-`rKey` branch returns `{intent:"edit", ask:{answered:true, context: []}, instruction: words}`). It returns before the `answerClaim`/`askLive`/`closeAsk` block at `worker.js:33529-33560`.
- **Summary:** when the request flow does not take the message (no idem, flow off, or edits not queued for this owner), the answer is accepted as stale or as someone else's. The live question is never closed. The run's request is the answer text alone ("Stripe"), with empty `context`, so neither the question nor the original request reaches the agent. History is the only bridge, and B-1 or a missing chat id removes it.
- **What the customer sees:** they tap an answer and the agent acts on "Stripe" with no idea what it was for, or asks the same question again. The card can also stay live and be answered twice.
- **Confidence:** plausible. Confirmed by reading; how often production takes this branch depends on `editAsyncFor`.

## B-5 (medium): the add-on route's agent run gets no `context` and no `canAsk`
- **Where:** `worker.js:36453-36462` (compare the edit route at `worker.js:36007-36022`, which passes `context: eCtxAll` and `canAsk`).
- **Summary:** a part filed as `op: "addon"` (`jobBody` addon branch, for example records accepted before the agent-only change, or a resumed older part) runs the agent unable to ask, and an answer to an earlier question is not given beside the request.
- **What the customer sees:** after answering a question on an addition, the work restarts without their answer. Or the agent has to guess a provider instead of asking, and builds the guess.
- **Confidence:** plausible. The wiring gap is confirmed; how often new requests reach this route is low.

## B-6 (medium): a Stop does not cut a model call already running
- **Where:** `worker.js:4735-4767` and `4950-5075`. `providerWaitOpts` reads `JOB_STOP` only between tries and waits, and `callModel` is given no abort signal. `runAgentChange` sees `stopped` only between rounds (`worker.js:16988`, `throttledStop` 10 s).
- **Summary:** a call in flight runs to its end, up to `QUICK_STREAM_MS` 480 s per call, plus helpers, after the owner presses Stop. The customer is not charged (the cancelled ending is `cost: 0`, and the job's reserve is refunded), but the work keeps running, and on the sync path (no job) there is no `stopped` at all.
- **What the customer sees:** Stop shows "Stopped" while the card or progress keeps moving for minutes. On a sync edit, Stop does not stop the agent, and the run is charged when it finishes.
- **Confidence:** plausible. The missing signal is confirmed; whether the sync path's client abort kills the Worker isolate was not checked.

## B-7 (low): an empty balance turns any message on a live site into a `build`
- **Where:** `worker.js:33436-33443` (`rBal !== null && !(rBal > 0)` returns `{ok:true, intent:"build"}`). It runs before the agent path, for site messages as well as first builds.
- **Summary:** this is left over from the old router. On a live site the client treats `build` as actionable and calls `go()`, which is a revise of the live site, refused by its 402 gate.
- **What the customer sees:** at 0 credits, a question ("how do I add a page?") gets a build-failure "out of credits" reply instead of an answer or a clear top-up message. The new-project agent's free answer is skipped too.
- **Confidence:** plausible. The server half is confirmed.

## B-8 (low): the first run's usage is never billed when the automatic retry runs
- **Where:** `worker.js:17136-17143` (`ag = settle(await runOnce(...))` replaces `ag`, and `billUsage = ag.usage` at 17182 is the second run's).
- **Summary:** after a stop and retry, only the second run is charged, and the first run's model spend is lost. This costs the platform, not the customer. The save-retry path is the reverse: it bills only the first run, as documented.
- **Confidence:** confirmed by reading.

## Checked and fine
- Ownership: `/api/site/answer` and `/api/site/context` use `siteOwnerBySlug`; `/{slug}/question` uses `assertOwner`; `/chat/*/context` keys on the caller's uid. Note that `/api/site/reach` needs only a sign-in (it is a probe with no site data).
- `closeAsk`/`replaceAsk` use etag conditional writes. Stale, expired and other-owner answers are refused at no cost (request-flow path).
- Money in `runAgentChange`: charged once (`billed` latch). Without a job, the refund on failure goes through `fail()`; with a job, the reserve comes back at the job's end. Cancelled and no-credits endings are `cost: 0`.
- `withProviderRetry` is bounded by the job deadline (it parks), and its waits poll Stop every 10 s. Account and billing errors are never waited on.
- `siteReadUrl` and the import fetchers go through `safeFetch` with a timeout and a byte cap.

## Units read
All 96 ranges in `B-worker-agent.txt` were skimmed. These were read fully: `throttledStop`, `agentAffords`, `agentAddress`, `runAgentChange`, `answerClaim`, `staleAnswer`, `closeOrphanQuestion`, `agentRouted`, `newProjectTurn`, `/api/site/answer`, `/{slug}/question` (both), `/chat/*/context`, `/api/site/context` (ownership part), `/api/site/reach`, `/api/site/route` (33283–33640), `modelSend` … `quickSend`, `providerWaitOpts`, `journaled`, `runProviderWaits`, `siteReadUrl`, `importFetch*`.
Builder files: `provider-retry.mjs` was read fully; in `clarify.mjs`, `askLive`, `loadAsk`, `closeAsk` and `replaceAsk`.
**Not finished (time):** `site-converse.mjs`, `model-xai.mjs`, `model-fanout.mjs`, `retry-reason.mjs` and `build-models.mjs` were not read. Of the worker units, these were only skimmed: `routeDigest`, `readConverseContext`, `refreshSiteMap`/`loadSiteMap`/`siteMapMemo`, `askReport`, `storeAskTwice`, `routeTableNames`, `siteWebResearch`, `agentShell`/`agentCall`/`agentFetchDocs`/`agentReadErrors`/`agentListKeys`/key-asked units, `tokensReport`/chat windows, `upstreamKind`/`scrubProvider`, `isCallTimeout`, `withPartWaits`/`readNotice`/`providerSink`, and route answer keep/read.
