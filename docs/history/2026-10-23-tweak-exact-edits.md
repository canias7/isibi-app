# 2026-10-23 — the tweak rung answers with exact edits (idea #18)

Branch `tweak-exact-edits`, from `compile-repair-all` (`50133724e`). Not merged,
not deployed. Nothing spent, no model called, no live write.

## What the owner asked

Idea #18 (`docs/plans/2026-10-22-open-source-ideas.md`): switch the tweak rung
(`builder/site-tweak.mjs`) from the model returning the WHOLE file to exact
`{old, new}` replacements; each `old` must occur exactly once in the current
file, or the answer is refused with a clear reason fed back for one retry turn;
apply in order; keep every existing guard; share one helper with the visual
review instead of a third copy; keep the full-rewrite fallback only where it
already is.

## What changed

- **`builder/exact-edits.mjs` (new)**: `applyExactEdits(source, edits)` and
  `occurrences`. The visual review's apply loop, moved out unchanged in meaning:
  edits apply in order, each on the result of the one before, all or none;
  `malformed` / `old-missing` / `old-not-unique`, with the failing edit's index.
  The text lane works by offsets, not old→new, so it is not a third user.
- **`builder/visual-review.mjs`**: its local `occurrences` and loop replaced by
  `applyExactEdits`; same refusal names.
- **`builder/site-tweak.mjs`**:
  - `write_tweak`'s schema: `edits: [{old, new}]` replaces `source`; `cannot`
    and `question` unchanged. The rules say "exact edits … Do not send the whole
    file".
  - `TWEAK_MAX_TOKENS` 16,000 → **8,000** (the output is the changed spans; a
    moved block, out then in, is the largest honest answer).
  - `readTweak`: no edits is `cannot` (as an absent `source` was); edits that do
    not apply are `reason: "edits"` with `edit` (`old-missing`,
    `old-not-unique`, `malformed`) and `index`. The applied file then goes
    through the existing guards in the same order: `no-change`, `truncated`,
    `syntax`, `moved-route`, `reworded` (the prose multiset), `needs-parts`,
    `lint`.
  - `runTweak`: on `reason: "edits"` only, ONE retry turn — the same request
    plus the model's answer and a `tool_result` (`is_error: true`) naming the
    edit and why (`editsFeedback`). A second miss is a refusal like any other;
    usage is summed over both calls; the result carries `retried: true`.
  - Every caller of `runTweak` (the edit route's page rung, `site-repair`,
    `compile-repair`, the add-on repair round) gets the new shape, since they
    share the tool. The route's fallback is untouched: a refused tweak goes to
    the full rewrite exactly where it did (`tweak-fallback`).
- **`Dockerfile`**: `builder/exact-edits.mjs` added to the worker tree's COPY
  (the job runner imports it; `test/dockerfile.test.mjs` caught it).

## Tests

- **New `test/tweak-exact-edits.test.mjs`, 7 cases, all red on the old code
  (0/7 pass with the old `site-tweak.mjs` and `visual-review.mjs`)**: the
  request asks for edits (no `source` property, `max_tokens` < 16,000, the
  rules say so); edits applied in order with nothing outside the spans changed;
  a missing `old` refused, fed back once (`tool_result`, `is_error`, the edit
  and reason), and the retry's edits land with both calls' usage; a second miss
  refused after exactly two calls; a non-unique `old` refused and said back; an
  edit dropping a sentence still refused as `reworded` (and a moved route,
  no-change, an empty list, a whole file); one shared helper, and the review
  still refuses as before.
- **Existing tests, only where the tool shape changed**:
  `test/fixtures/tweak-edits.mjs` (new) turns a supplied whole-file answer into
  the one minimal exact edit a model would send (the differing span widened
  until its `old` is unique), reading the before-file off the request (and
  leaving out the answers and whole-request sections a request appends after
  the file). Stubs in 18 test files and 3 fixtures (`live-ask`, `request-flow`,
  `addon-route`) call it for `write_tweak`; no assertion was changed.
- **Mutation sweep**: 14 mutants (the unique and missing checks, the splice,
  chaining, no retry, usage not summed, `is_error`, the ceiling, the applied
  file ignored, the retry reading the first reply, the feedback reason, the
  refusal reason, the tool id, the review's reason), **14 of 14 killed**; 2
  comment-only controls survived. Restored from saved copies.
- **Full suite** (`node --test "test/*.test.mjs"`, before the code commit):
  `12419 / 12411 / 5 / 3` (tests / pass / fail / skipped). Two of the five were
  this change's own and were then fixed and rerun green: `container-images`
  (`builder/exact-edits.mjs` not yet in git at HEAD; green after the commit)
  and `site-build-shards` (the new fixture is imported by
  `publish-pages.test.mjs`, so it is now named in `site-build.yml`'s trigger
  paths). The other three are environment-only, as on the base:
  `no-generated-deps` (the node_modules symlink), `media-verify` (browser) and
  `draft-ui-browser` DFU1–3. So `12419 / 12414 / 3 / 3` with those two
  reruns, which were targeted, not a second full run.

## Container image

Predicted over both ends (`containerInputs`, `imageId`): the site image
`f28858b9eda3840f` (base `50133724e`, 229 inputs) to **`87696d43a1f54ac4`**
(code commit `c846764c8`, 230 inputs: `builder/exact-edits.mjs` added to the
worker tree); the app image unchanged at `65022ce71e3d7274` (9 inputs). The
records commit after it changes no input.

## Still owed

The owner's "small paid test" for #18 (a real model answering with edits on
one live tweak) — not run: nothing paid without approval.
