# Remaining edit-path checklist

Scope: current product at `5cb8592`, the recorded reviews and canary 28. This is
not a new lane audit. Escalation correction and deployment verification are
closed; no further deployment checks, retries or paid runs are requested.

## Demonstrated behavior (with the evidence boundary)

| Behavior | Evidence |
| --- | --- |
| Correct Worker/container identity, async and runner flags | Live non-spending canary 36096052737, 2026-09-25 04:50:36 UTC: `5cb8592661ff`, `b83b0611aeecce8f`, both flags true. Balance 3. |
| Empty edit queues and reaches its stored terminal refusal; forged replay and unknown-job poll are rejected | Same live canary. This did not call a model or demonstrate a content edit. |
| Failed/unreadable add-on state and unusable answers stop; verified absence alone permits reconstruction; photo handoff and successful additions remain | Actual Worker responses through direct and queued browser handlers with stubbed providers: `test/addon-failure.test.mjs`, `test/addon-route.test.mjs`. Independent review and required CI green. |
| Untrusted edit/add-on replies cannot authorize success or another operation | `readRouteReply`, `readEditReply`, `readAddonReply`; controlled reply tests in `test/edit-reply-validation.test.mjs`, `test/addon-failure.test.mjs`. |
| Ask lock survives handoffs, releases once, blocks duplicate presses; old completions do not unlock newer requests | `siteEdit`, `editAsk`, `editAskDone`; `test/edit-lock.test.mjs`. Previously corrected, not reopened. |
| Edit-side result-display failure preserves known success and permits a next message | `applyEditResult`; `test/edit-result-display.test.mjs`, including credit-scheduling and redraw fault injection. Previously corrected, not reopened. |
| Served browser code matches reviewed code | Recorded byte comparison of live `chat.js`. Draft isolation, routing and preservation behavior also have controlled tests; those tests do not prove every real model response. |

## Implemented, but not established by this live verification

- A nonempty model-backed edit/addition through the real browser, queue, model,
  compiler, publish and result-display chain on this deployment.
- Its exact requested change, preservation of unrelated content/behavior,
  visible preview, truthful partial-result wording and per-operation billing.
- Live reconstruction and photo handoff with real providers. Controlled tests
  cover their decisions; the empty-edit canary does not exercise them.

These are missing observations, **not product defects**. Do not repeat completed
deployment checks or spend credits merely to relabel the same evidence.

## Known remaining defects and limits

| Item | Current-code evidence and precise scope |
| --- | --- |
| Add-on known-success fallback redraw — fixed on working branch, not deployed | The owner independently reproduced an escaped queued display error; publication and request cleanup succeeded. The fallback now uses the existing edit-side guarded finish. Focused regressions cover direct/queued double failures, the subsequent message and a newer request started during redraw. Ordinary success-redraw controls remain. |
| Queued refusal redraw can escape | `watchEditJob` invokes the outcome reader from its async step; refusal branches call `finish` without containing a redraw exception. Recorded impact: the sentence remains and the request frees, but a rejection can escape. No new live incident is claimed. |
| Preview invalidation can be skipped after a synchronous scheduling exception | `applyEditResult` and `applyAddonResult` call `scheduleCreditRefresh()` before incrementing `previewV`. The injected synchronous throw is recorded. **Do not describe this as every failed balance request:** the actual scheduler defers `fetchCredits` in a timer, so an ordinary later network failure does not establish this sequence. |
| Queued handoff loses the one-hop marker | `watchEditJob` supplies `handedOff:false` to its reader, whereas `escalatedEdit` uses that flag for the hop limit. Latent guard gap: the recorded current data→text and picture→page destinations do not hop again. Not evidence of a current live loop. |

Drafts surviving site switches but not browser reload are an intentional
in-memory limit (`siteDraft`, `sitesSave`), not a newly found defect. The silent
duplicate latch is likewise a deliberate secondary guard, not a stranded-request
regression. Translation and model-written replies remain parked.

## Prepared check completed; narrow correction awaiting review

The owner independently reproduced the queued add-on double display failure.
The regression also failed before the patch with “the redraw failed” escaping.
The existing edit-side guard now contains that fallback redraw exception.

All 179 focused tests pass in edit-result-display, edit-lock and addon-failure:
one truthful success, no rewrite or extra handoff, busy/lock released, subsequent
message completes, and an older completion leaves a newer request alone.
The harness reads normalize CRLF so these controls also run on Windows.

This is an escaped display error, not a failed publication or stranded request.
All providers are fixture-backed; no paid run, merge or deployment. Other
checklist items remain separate and unchanged. Required branch CI is recorded
with the delivery; no next sweep or additional correction is started.
