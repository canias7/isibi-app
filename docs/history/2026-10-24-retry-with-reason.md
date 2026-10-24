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

## Round 2 (branch `retry-with-reason-2`, from `retry-with-reason` e858c7f6e; not merged, not deployed)

Owner, 2026-10-24: **"a task must never fail completely without at least one
retry"** (small AI imperfections are fine; a whole failed task is not). Every
retry below is the SAME request (same model, same effort, same tools) with the
model's own answer and the failed check's reason appended (`retryRequest`), or
for the add-on designer the cleaner's own correction shape (`feedback`, same
model and effort). One retry; a second miss is the existing refusal.

### Newly covered

| Ending | Where | Retry | Charge when still refused |
|---|---|---|---|
| `look/no-change` (every part declined) | `worker.js`, the look step after its lanes (`eReaskable`, "EVERY PART DECLINED") with `builder/site-lanes.mjs` `reaskLane`, `LOOK_DECLINED_REASON` | each lane that ran is asked once more with the fact that every part answered no change; the QR lane is left out (its answer is a patch, not a value) | `look/no-change` is explained at cost 0, as before; a re-ask whose step then changes nothing ("already looks like that") is not billed (`eReaskUsages` taken back out) |
| `page/no-change`, `page/no-page-back` | `worker.js`, the page rung after `pRead` ("NO PAGE BACK, OR THE PAGE BACK UNCHANGED") with `builder/retry-reason.mjs` `recordCall` | the page writer asked once more naming the page and the reason; its answer read by the same `pRead` | explained at cost 0, as before (the edit is refunded on the job path) |
| `picker/scope-unread`, `picker/addition-mixed` | `builder/site-lanes.mjs` `pickLanes` → `pickScopeReason`; `worker.js` hands `isAddition` (the wall's own reading: stored look, page evidence) | a scoped change whose page is not a path or whose words are not the customer's, a picked lane no scope places, or an addition beside other work with no scopes — on the look door and the removal door | the pick carries its first call's usage only |
| Add-on `not-landed`, `rewrote`, `nothing-returned` (no note) and `no-change` (and every batch of a parallel write) | `worker.js`, the writer loop (`aWriterCheck`, `aCallFor`, `aRecs`) | the writer's answer is merged once ahead with the same removals and named destinations; one that would lose words, or (an addition of only lines and photographs) leave one out, is asked once more naming the words lost or what did not land. Provisioning settles once, after the loop (`aProvCheck`): no table is made or charged twice | the refusal takes nothing off the ledger, as before; both writer calls are on the page bill only when the retry passed |
| Add-on `declined` (a designer that designed nothing) | `worker.js`, after `aNeedsAgain` | the designer asked once more with that fact, through `aNeedsAgain` | the empty retry's usage is not billed |
| Requirements judge: a cut-off first answer | `builder/site-add.mjs` `runJudge` | asked once more with that fact; never a third call | ours (`extraUsage`), as the judge's second call always was |
| Build: no usable page (`validate`), no home page (`home`) | `builder/publish-pages.mjs` (`deps.regenerate`, `genWhy`) with `builder/page-gen.mjs` `pagesAgain` and `worker.js` `pagesAgain` (the one-call writer; a fired or resumed build's retry goes to the container's ordinary page call) | the writer asked once more with the reason | the first call's charge only (`retryUsage` rides apart) |

### Charging fix

Round 1 made a refused step's charge cover both calls (menu 2 → 3, picture
2 → 3). Now, in `withReasonRetry`, a step that still ends refused (the retry
failed its check, or ended in another refusal) carries the FIRST call's usage
only, and the retry's rides apart as `retryUsage`. The same in the router
(`routeMessage`: a retry that still misquotes is billed one routing call), the
tweak (`runTweak`) and the build's pages. The removal-door cases are back to
2 credits (menu and picture). Where a refused step is refunded today, it still
is.

### Found on the way: the retry never reached Grok

`builder/model-xai.mjs` `toXaiRequest` dropped `tool_use` and `tool_result`
blocks, so on Grok (the default picker) every round-1 retry went out as the
first request again, with neither the answer nor the reason. Now an assistant
`tool_use` is a `tool_calls` entry and each `tool_result` a `tool` message
answering it (ids paired in order; `fromXaiResponse` keeps none). Overlaps
`grok-4-7`, which touches the same file (the model name, not this function).

### Still ending without a retry, and why

- Provider outages and account errors (`send`, `generate` 503, `modelDown`):
  `provider-retry-2`'s scope.
- Honest declines: one lane of several answering no change; the tweak's own
  `cannot`; a menu or picture step's decided refusal (a page the site lacks, a
  page with no menu); a take-off that names nothing on the list; a writer's
  `nothing-returned` with a note of its own; `too-many` and an unseen-page
  rewrite (refused, the rest kept).
- Genuinely impossible: `page/no-page`, `not-removable`, `nothing-to-remove`,
  `pages/page-verb`, a QR destination refused.
- Small imperfections: one line or photograph of a larger addition left out
  by name; one band of a fan-out stubbed (the fan-out is one container job;
  a second would be a second job and resume); a page the writer was not shown
  refused while the rest ships.
- The QR lane in an all-declined look step (its answer is a patch read
  against the stored list).
- `picker/addition-mixed` when the addition's own words are the whole
  message: the answer is consistent (it is the addition alone), and asks for
  it alone.
- Add-on `clarify` after charge: `no-ask-after-charge`'s scope.
- `text/no-match`: climbs, not a final failure.
- Design, frame, compile: already asked again (`recoverDesign`,
  `enforceFallbackFrame`, compile repair and salvage).

### Overlaps

- `provider-retry-2`: a provider wait sits inside `send` under these retries.
- `no-ask-after-charge`, `auto-split-edits`: same routes; this round adds code
  beside the pick, the look lanes, the page rung and the add-on writer, and
  changes no route signature.
- `grok-4-7`: `builder/model-xai.mjs` (different function).

### Evidence

- Tests (code at `76691fa01`): `test/retry-with-reason-2.test.mjs` (16 cases:
  the charging rule, the picker's scope, the look re-ask, the judge, the
  build's pages, `recordCall`, `pagesAgain`, Grok's shape); route cases in
  `test/edit-removal-door.test.mjs` ("ROUND 2", 10, sync and job),
  `test/addon-route.test.mjs` ("RETRY", 7) and the judge cases in
  `test/addon-judgment.test.mjs`. Each newly covered path: fail → retry fixes
  (the retry request equal to the first apart from the two turns, the reason's
  words present), fail twice → the existing refusal at the old charge, pass →
  no retry. Existing call-count expectations updated where a path now retries
  (`edit-op-scope`, `edit-removal-door`, `edit-failure`, `addon-judgment`), and
  the removal-door charges back to 2 credits; source guards re-anchored
  (`page-gen` census 3 → 4, `site-addon` merge sites 2 → 3, `site-add` leaf
  list, `site-tweak` landmark).
- Red check against `origin/retry-with-reason` (e858c7f6e): 29 of the 50
  selected cases fail there (every fix case, the charges and the unit file,
  which cannot load); the 21 that pass are the pass → no-retry controls and
  cases whose old behaviour already matched.
- Sweep: 24 mutants across `retry-reason`, `site-lanes`, `site-add`,
  `publish-pages`, `page-gen`, `model-xai`, `site-ask`, `site-tweak` and
  every new hop in `worker.js`, all killed (the router and tweak charge mutants
  first survived; a test was added for each, then killed). The comment-only
  control survived.
- Full suite (world-readable path) at the final code: 12,672 tests, 12,667
  pass, 2 fail, 3 skipped. Both failures are the environment: `no-generated-deps`
  (the node_modules symlink) and `canary-reopen-browser` REOPEN 1.
- Image: SiteBuildContainer `2d440bd194450245` (main `1b16aaba0`, 235 inputs)
  → `63ac477324969a39` (236 inputs; round 1 was `fa5a328a6849668f`).
  AppBuildContainer unchanged at `65022ce71e3d7274`.
- Nothing spent: no model call, no paid run, no live write.
