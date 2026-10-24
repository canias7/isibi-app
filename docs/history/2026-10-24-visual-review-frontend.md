# 2026-10-24 — The visual review, on, for front-end changes only

Branch `visual-review-frontend` from `origin/main` `692087cde`. Not merged, not
deployed. Nothing spent: no paid run, no model called (every model answer in
the tests is supplied), no live write.

## 1. The owner's rule

> "only when you're changing the front end … if you're changing … the back
> end, like the database … you don't need it" (owner, 2026-10-24)

## 2. Before

The visual review (`builder/visual-review.mjs`, `runVisualReview`) ran only in
`publishPages` (first builds; revises excluded by `&& !revise`), and only with
`VISUAL_REVIEW` set to an affirmative word. `deploy.yml` did not pass it, so it
was off in production. Every other publish went through the shared seam
`recompileAndPublish` (worker.js), whose render check never took screenshots.

## 3. What changed

- **The switch is on by default.** `visualReviewOn` is on unless
  `VISUAL_REVIEW` is `0`/`false`/`off`/`no`. `deploy.yml` passes it with a
  `|| 'on'` fallback (the optional-secret rule in `docs/deploy.md`). Setting
  the secret to `off` turns it off everywhere (builds and the seam).
- **First builds and revises**: `visualOn = visualReviewOn(env)` (the
  `!revise` exclusion is gone).
- **The seam decides from the files** (`visibleChanges`, pure, in
  `visual-review.mjs`). Before the compile, the publish's pages and parts are
  compared with the editable copies (`source/<slug>/pages.json`,
  `parts.json`: written only after a publish, so still the site as it was),
  and its baked stylesheet, theme, logo, brand, wordmark, GIF and QR with the
  live version's own `state/config.json`. Visible = any page added, changed
  or removed; any part; any of those look fields. Not visible: the same files
  republished (a data row, a rule, a table, a function, a schedule, an API
  added with no page, a restore, Back online), the description and SEO, the
  languages, the favicon. **Pages that cannot be read before are unknown, and
  unknown is never visible** (no review).
- **Only visible publishes ask the container for screenshots**: the payload's
  `shots` is now either `true` (builds) or the changed routes
  (`shotPreference`), which the render check takes first after `/`
  (`render-check.mjs` `shotPrefer`, `build-server.mjs`). Three routes at two
  widths, as before.
- **The review in the seam**, after the caller's own `afterCompile` hook:
  `built.shots` and the changed pages (every page when only a part or the
  stylesheet changed) go to the builder's model once (`quickSend`, the job's
  clock, `models.pages`). Fixes recompile through the same compile; one that
  does not build goes to the seam's compile repair (`seamCompileRepair`,
  touched = the review's changed pages); one that still does not build keeps
  the publish as it was (`visualReview.failed`).
- **Billing**: only through the caller's own funnel (`chargeRepair`, else
  `charge`), in the same job. A seam call with neither (the platform rebuild
  drain, the owner's own text editor, Back online, `liveWhenClean` rebuilds)
  does not run the review. The edit route adds `visualReview.charged` to its
  `cost`; the add-on's funnel (`aChargeLangs`) already adds into `aCost`.
- **Once per job**: `job.visualReviewed`, so a stylesheet correction's second
  publish does not look again.
- **Facts**: one progress fact (`visualReviewFacts`, `looked`) and one reply
  fact (`visualReviewFact`, edits and add-ons) only when the review fixed
  something that built. The answer carries `visualReview` `{reviewed, fixed,
  charged, none?, reason?, failed?, changed?}`.
- **Device scope**: not on `main`. The hook is `runVisualReview({ viewport })`
  (`phone`/`desktop` keeps only that width's shots), fed from
  `job.deviceScope` when a caller sets it. The device-scope branch should set
  that field.

## 4. Paths

| Runs | Skips |
|---|---|
| First build, revise (`publishPages`) | Data rung (row writes; no page file changes) |
| Text, look, picture, nav, frame, page, tweak rungs and the CSS lane (any changed page, part or look field) | Rules rung |
| Logo placement (logo or page change) | Add-on that adds only tables, functions, schedules or APIs |
| Add-on that writes a page or a part | Settings, description, SEO-only |
| | Restore, discard, Back online, platform rebuilds (same files, or no bill) |

## 5. Cost and time (estimates, not measured)

One extra model call with up to six screenshots (3 routes x 2 widths, each at
most 4,000 px tall) and the changed pages' source. On the first-build path the
same call was priced at about 3 credits; expect about 2–5 credits per visible
edit with grok, plus a recompile (about 1–3 minutes of container time) only
when it proposes a fix. Back-end-only changes: zero.

## 6. Tests

- `test/visual-review-frontend.test.mjs`, 13 cases: through the real
  `POST /api/site/<slug>/edit` (page edit: review runs on the shots, the fix
  recompiles, is stored and billed, the reply's cost equals what was taken,
  the reply fact; off switch: no shots, no call, one compile) and through the
  real seam (`draftFirstApi.recompileAndPublish`): same files (data, rules,
  table-only, restore) never reviewed; add-on with a page reviewed on its own
  route with only that page offered; a part change reviewed; a fix that does
  not build keeps the original; no bill, no review; the seam's off switch;
  `visibleChanges` cases; the deploy fallback and first-build wiring; the
  device-scope hook; the progress fact.
- `test/visual-review.test.mjs`: the switch's default and the container's
  payload guard updated to the new contract.
- Fixture `test/fixtures/cf-containers.mjs`: `shots` (answered only when the
  payload asks, in the render check's shape) and `failWhen(body)`.
- Red check against `origin/main`'s product files: the new file does not load
  (its exports do not exist), and three cases of `visual-review.test.mjs` fail
  (the switch, the payload guard, the wiring).
- Sweep and suite: §7.

## 7. Readings (stamped after the runs)

- Sweep: 21 of 21 mutants killed (switch, decision, unknown, description,
  stylesheet, parts, removals, viewport, billing gate, screenshots asked,
  pages offered, fix kept, failed fix not kept, charged, cost summed, result,
  first-build-only, progress and reply facts, deploy fallback); the
  comment-only control survived. Restored from saved copies; tree checked.
- Full suite (worktree, node_modules linked): `12471 / 12464 / 4 / 3`. Two
  failures were guards counting the seam (`site-busy` bare source reads,
  `wiring` edit cost); both re-anchored, and those files pass (99 of 99 with
  the review files). The two left are environment-only: the media browser
  case (load) and the `node_modules` symlink case.
- Image prediction (`containerInputs` + `imageId`, 231 inputs): site image `0bae00a7003bcc23` (main `692087cde`) → `8fc2abe34087d682` (rebuilt: `build-server.mjs`, `render-check.mjs`, `visual-review.mjs`); app-builder image `65022ce71e3d7274` unchanged.
