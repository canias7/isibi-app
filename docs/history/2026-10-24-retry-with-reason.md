# 2026-10-24 — retry once with the check's own reason (branch `retry-with-reason`, not merged, not deployed)

Owner, 2026-10-24: wherever a model's answer fails an exact check, send the same
request once more with the model's previous answer and the failed check stated
in plain words. **Same model, same effort** (the owner's explicit choice: no
raised effort, no model switch). One retry, then the existing refusal or climb.
Evidence: `docs/plans/2026-10-24-model-wrong-failures.md` §3–4 (class C).

## How

`builder/retry-reason.mjs`:
- `retryRequest(req, reply, reason)` builds the retry. It is the first request
  spread, with only `messages` extended: the previous answer, then a
  `tool_result` with `is_error` for each `tool_use` (the reason goes on the
  first), or a user text turn when the answer used no tool. Because nothing
  else changes, the model and effort fields stay byte-identical. Tests assert
  this.
- `withReasonRetry` runs a one-call step at most twice. A step that made more
  than one call (for example, a widened data call) is not retried. When the
  retry's own call fails, the first refusal stands.
- The trace mark is `retry_reason {step, reason, ok}`, written to the edit
  trace (`traceRetryMark`). The routing route keeps no trace row, so there it
  goes to the log.

## Steps covered

| Step | Where | Check(s) retried | Charge |
|---|---|---|---|
| Tweak / page-rung cheap path (also used by compile repair and site repair) | `builder/site-tweak.mjs` `runTweak`, `TWEAK_RETRY_REASONS`, `checkFeedback` | `edits`, `no-change`, `truncated`, `syntax`, `moved-route`, `reworded`, `needs-parts`, `lint` (`cannot`/`unreadable` are not checks) | Both calls' usage is on the result, so the existing rule bills it: on success it is on the edit's one bill; on a fallback to the rewrite the tweak usage rides the rewrite's bill as before |
| Router held-back part | `builder/site-ask.mjs` `routeMessage`, `heldUnread`, `HELD_UNREAD_REASON` | `alsoAsked` not found word for word (`held-unread`) | Both calls go on the message's routing charge (routing is always charged). A second miss is returned as it came, and the routes refuse `held-unread` as today |
| Look-door picker | `builder/site-lanes.mjs` `pickLanes` | no lane, no question, nothing elsewhere (`no-lane`). The removal door is not retried | Usage is summed into `pickUsage`. The rule is unchanged: `picker/no-lane` is explained, and the edit is not charged |
| Menu step | `builder/site-nav.mjs` `runNavEdit` | `no-menu` without a decided refusal; `no-change` | Usage is summed. Billed as today: on success it is on the edit's bill; on a refusal the existing sync/queued rule applies |
| Data step | `builder/site-apply.mjs` `runDataEdit` | `no-match` | The retry's reserve (`before`) sees both calls' usage, so a found row is billed once for both. A second `no-match` is refunded as today |
| Add-on designer | `worker.js` (cleaner correction) | already retried once with the cleaner's reason (`no-job-fn` among them); this change only adds the `retry_reason` mark | unchanged |

**Widened the same day (owner: "a task must never fail completely without at
least one retry").** These steps were added:

| Step | Where | Retried when | Charge |
|---|---|---|---|
| Rules step | `builder/site-rules.mjs` `runRulesEdit` | `no-match` with nothing refused | the retry's reserve sees both calls' usage |
| Picture step | `builder/site-picture.mjs` `runPictureEdit` | `no-match` (no slot, no place) | under today's rule a refused step's charge stands, so it is now both calls (measured: 2 → 3 credits in the removal-door partial cases) |
| A look lane | `builder/site-lanes.mjs` `runLane` | the answer carried no tool answer at all (`unread`). A lane that declines (`null`) is the ordinary shape and is not retried | summed into the lane's usage |

The menu refusal beside work that shipped now costs 3 instead of 2 for the
same reason. Tests were updated where they counted calls or credits (the reason
is in a comment at each place).

The container image's worker tree now carries `builder/retry-reason.mjs`
(Dockerfile line 169), so the image is rebuilt.

**Not covered, said plainly:**
- **Add-on `not-landed` and `rewrote`.** Those checks run after provisioning and
  merging, far from the writer's call. Retrying there means re-running the
  writer and the merge, which is a larger change.
- **Page-writer validation.** Not reworked here.
- **Compile and vite.** Compile repair already exists. Its tweak now gets the
  wider retry.
- **Still ending without a model retry, with the reason:**
  - **`look/no-change`**: every lane answered a value equal to the stored one.
    Each lane may decline legitimately, so there is no exact check to state.
    The next step would be one picker re-ask with that fact.
  - **`page/no-change` and `page/no-page-back` from the page writer**: these
    are not reworked here.
  - **`picker/scope-unread`, `picker/addition-mixed`**: these come from the
    picker's scope reader, inside the door logic. Not wired.
  - **Add-on `not-landed` and `rewrote`; the add-on `declined` and the judge**:
    the checks sit after provisioning and merging.
  - **Add-on `clarify` after charge**: this is `no-ask-after-charge`'s scope.
  - **Request parts**: each part runs these same steps, so it inherits their
    retries. There is no separate part-level retry.
  - **Build design (`design-unusable`, `design-truncated`), pages, bands,
    frame and salvage**: the build path has its own repair and salvage. Not
    audited further here.
  - **`text/no-match`**: not retried, because it climbs to the next rung (a
    climb, not a final failure).

## Overlaps

- `provider-retry-2` (build-call.mjs, callBuilderModel, job runners) waits on
  provider outages. Here a failed retry call simply keeps the first refusal. If
  both land, a provider wait sits inside `send` underneath this.
- `auto-split-edits` and `no-ask-after-charge` touch the same routes. This
  change edits only the four module entry points and four call sites.

## Evidence

- `test/retry-with-reason.test.mjs`, 13 cases. The tweak and data cases go
  through the real `POST /api/site/<slug>/edit`. The router, picker and menu
  cases go through their real entry points. Each case covers three paths:
  - the first answer fails, the retry fixes it: one extra call, the same
    request apart from the two turns, and the reason present;
  - the retry fails too: the existing refusal or climb;
  - the first answer passes: no retry.
- `test/tweak-fallback.test.mjs`: two call-order expectations updated, since the
  tweak is now retried once before the rewrite.
- Red check on `origin/main` (1b16aaba0): 10 of 13 fail. The 3 that pass are
  the new helper's own 2 cases and the "passes, no retry" control.
- Sweep, suite and image: see the owner-notes entry.

## Readings

- Sweep: 15 mutants across the helper and every wired step, all killed. The
  comment-only control survived. One mutant (the data reserve seeing only the
  retry's usage) first survived; a test was added for it, and then it was
  killed.
- Full suite (`node --test "test/*.test.mjs"`) at the final code: 12,640
  tests, 12,634 pass, 3 fail, 3 skipped. The 3 failures:
  - `no-generated-deps`: the environment.
  - `dockerfile` image inputs: `builder/retry-reason.mjs` was not yet
    committed during the run.
  - `canary-ui` "request mode end to end": a timing flake that passes alone.
- Image: SiteBuildContainer `2d440bd194450245` (235 inputs, main `1b16aaba0`)
  → `fa5a328a6849668f` (236 inputs, branch). AppBuildContainer is unchanged at
  `65022ce71e3d7274`.
