# 2026-10-24 — Progress voice, round 2 (branch `progress-voice-2`, not merged, not deployed)

## 1. Why

The live build of `driftwood-and-daughters` (2026-10-24, Grok, effort Low)
wrote lines like "A new site is going up from your description; nothing is on
the pages yet…", "The site is named … Nothing is on the pages yet." and
"…Visitors cannot see it yet." The approved voice (`PROGRESS_VOICE`, the
Saltmarsh lines) was in the prompt but came LAST, after the states' glosses,
and the facts themselves ended almost every step with "Nothing is built yet."
The model echoed the facts and the glosses instead of the voice.

## 2. What changed (`builder/site-progress.mjs`, `builder/security-say.mjs`, `worker.js`)

- **The voice comes first** in `PROGRESS_SYSTEM`, `TALK_SYSTEM` and
  `TASK_SYSTEM`, behind one line (`VOICE_FIRST`): "THE VOICE COMES FIRST: it
  decides the wording; the states decide only what may be said." The rules now
  say "as THE VOICE above says". The scan's line rule (`SCAN_LINE_RULE`) also
  starts with the voice.
- **The glosses are shorter**: `designed: planned or designed, not built yet.`;
  `prepared: made in the builder, not published.` ("visitors cannot see it" is
  gone from the prompt). Every state still decides what may be said.
- **The facts lost their per-fact tails**: "Nothing is built yet." (design,
  links, research, attachments, import, the design parts, the add-on pick, the
  build's start), "Nothing is changed yet.", "Nothing is decided yet.", "None
  is finished yet.", "Nothing new is finished yet.", "Designed, not built yet:"
  (now "Designed:"), and the held step's "not in effect yet … It takes effect
  when they press Publish." **The draft status is said once**: by
  `draftSavedFacts` ("Saved to their draft. Visitors keep seeing the published
  site until they press Publish."), marked when the save really happens. The
  "Saving … to their draft now." doing facts and the start's plan no longer
  repeat the Publish clause.
- **`readProgress` was already reading only `says`** (the declared state of
  each fact), never gloss words in the line; it is unchanged, and now guarded.
- **No repeated tails, checked on shape**: `lastClause`, `repeatsTail`,
  `repeatedTails`. A line whose last clause (three words or more, without case
  or punctuation) is the last clause of an earlier line repeats a tail. No
  phrase list. `writeProgress` takes `earlier` (the record's earlier lines);
  when its line repeats a tail it asks once more ("YOUR LAST UPDATE ENDED WITH
  THE SAME CLAUSE AS AN EARLIER UPDATE: end on what is new in this one."), and
  **keeps the second answer either way**, so a line that passed every truth
  check is never lost to wording. The three worker call sites pass
  `earlier: rec.lines.map(...)`.

Every truth check stays: a fact declared in another state (published, checked,
finished) is still refused and re-asked, and dropped if the second answer is
wrong too.

## 3. Tests

- New: `test/progress-voice-2.test.mjs`, 5 cases (VB1 voice before states
  through the real writer and in the task and scan prompts; VB2 no tail in
  over 30 build, edit and add-on facts; VB3 a first-person line without tail
  words passes, a fact declared `published` or `checked` early is refused,
  through `readProgress` and the writer; VB4 the supplied driftwood lines are
  flagged at [1, 2], a short shared ending is not, the writer re-asks once and
  keeps the second answer; VB5 every worker call passes `earlier`).
- Updated to the new wording (they pinned the old tails): `progress-flow`,
  `progress-import`, `progress-more`, `progress`, `progress-voice`.
- Red check vs `origin/main` (`692087cde`): the new file fails there (its new
  exports do not exist; every case is red).
- Sweep and full suite: §4.

## 4. Numbers

- Focused: `progress-voice-2`, `progress`, `progress-voice`, `progress-more`
  together 85 / 85 green (measured).
- Sweep (from that green baseline, restored from saved copies, nothing
  committed during it): 13 of 13 mutants killed (a tail put back on the
  design fact, on the draft save, on the held step and on the sections; the
  voice-first line emptied; the talk prompt's states put ahead of the voice;
  `repeatsTail` always false; no retry on a tail; a one-word clause counted
  as a tail; the tail note dropped from the request; the state check turned
  off; the scan rule's order put back; one worker call without `earlier`).
  The comment-only control survived. (A first pass let the held-step tail
  survive: the test fed a `text` step, which is not a database layer; it now
  feeds a `data` step and asserts the held fact was observed.)
- Full suite (world-readable worktree, `node_modules` linked, then removed):
  12,463 tests, 12,456 pass, 4 fail, 3 skipped. The 4: `audit-r2-g1` A14-6
  (it pinned "press Publish" in the draft start plan; widened to "saved to /
  as their draft", the plan still ends at the draft, now 8 / 8), and three
  environment-only cases: the node_modules symlink case, `media-verify`'s
  browser mode, and `canary-reopen-browser` REOPEN 1, which is flaky under
  load here (1 of 3 reruns failed on the branch; green on a rerun of main's
  source, so it is noted as flaky, not proven unrelated).
- Image prediction: `SiteBuildContainer` `0bae00a7003bcc23` (origin/main,
  231 inputs, 199 distinct) -> `3e0c9cad27528970` (head); `site-progress.mjs`,
  `security-say.mjs` and `worker.js` are all inputs. `AppBuildContainer`
  stays `65022ce71e3d7274`.

## 5. Image

`builder/site-progress.mjs`, `builder/security-say.mjs` and `worker.js` are
inputs of `SiteBuildContainer`, so the site image rolls; `AppBuildContainer`
does not move. Prediction in §4.

## 6. Proposed live check (asks first; not run)

One first build with `PROGRESS_TALK` on, on a throwaway slug, with a short
description (one page), about 11–20 credits by the measured range of a first
build (11–45). Read the stored progress lines: the voice's openers vary, no
line ends with the same clause as another, the draft status appears once, and
no line claims published or live before the publish fact.
