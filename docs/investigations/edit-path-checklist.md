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
| Add-on known-success fallback can throw during its own redraw | `public/chat.js:10149`: the catch calls `o.finish(addonOutcomeMsg('shown'))` without a guard. The corresponding edit fallback catches that second throw. On the queued path this can escape to the event loop. This is a recorded robustness gap, not proof a published addition failed. |
| Queued refusal redraw can escape | `watchEditJob` invokes the outcome reader from its async step; refusal branches call `finish` without containing a redraw exception. Recorded impact: the sentence remains and the request frees, but a rejection can escape. No new live incident is claimed. |
| Preview invalidation can be skipped after a synchronous scheduling exception | `applyEditResult` and `applyAddonResult` call `scheduleCreditRefresh()` before incrementing `previewV`. The injected synchronous throw is recorded. **Do not describe this as every failed balance request:** the actual scheduler defers `fetchCredits` in a timer, so an ordinary later network failure does not establish this sequence. |
| Queued handoff loses the one-hop marker | `watchEditJob` supplies `handedOff:false` to its reader, whereas `escalatedEdit` uses that flag for the hop limit. Latent guard gap: the recorded current data→text and picture→page destinations do not hop again. Not evidence of a current live loop. |

Drafts surviving site switches but not browser reload are an intentional
in-memory limit (`siteDraft`, `sitesSave`), not a newly found defect. The silent
duplicate latch is likewise a deliberate secondary guard, not a stranded-request
regression. Translation and model-written replies remain parked.

## One recommended next check — prepared, not executed

**Queued add-on success whose fallback redraw also throws.** This is the narrow
untested combination beside the existing edit-side and add-on single-failure
controls. It checks an acknowledged gap rather than reopening those fixes.

Preparation: a standalone `prepared-addon-redraw-check.mjs` is supplied with this
task's outputs. It loads only the helper prelude of the existing
`test/edit-result-display.test.mjs`, runs the actual browser handlers in their VM,
and registers one additional scenario. No product or test-suite implementation
is changed. Only the artifact's syntax is checked; no scenario is executed yet.

Scenario: route an edit, return its add-on handoff, queue the add-on and deliver
a valid stored success. Throw synchronously in add-on result application, then
throw again while drawing its known-success fallback. Send a second message
through the same page after both injections have been consumed.

**Acceptance:** exactly one truthful addition-success message; no uncertainty
message, rewrite or extra handoff; no uncaught rejection; the first ask releases
its busy state and lock; the second message posts exactly its own route/edit and
finishes idle. The current unguarded catch is expected to fail the rejection
criterion; the prepared probe has not yet measured it.

**Can run free: yes.** All route/model results are local fixtures. VM fetch records
requests instead of sending them; host fetch is disabled. It needs no account,
credits, canary dispatch, live site or repair. This does not prove live model
quality or billing. A later real edit would require separate spending approval;
the recorded balance 3 is not a budget authorization.
