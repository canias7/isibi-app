# 2026-10-23 — The progress voice (branch `progress-voice`)

Branched from `origin/main` `6b980ae15`. Not merged, not deployed. Nothing paid, no model called.

## The owner's request

Progress talk must sound like a professional speaking to a client: first person, but not "I" / "I am" at the start of every line, no repeated boilerplate tails, a problem said once, real names, confident and plain, still only what the facts say. The approved example is the seven Saltmarsh & Sparrow lines (`docs/owner-preferences.md`, "The progress voice").

## What changed

- **One voice block, `PROGRESS_VOICE`** (`builder/site-progress.mjs:1471`): the rules and the approved lines, marked as a tone to match and never words to copy.
- **Every live writer carries it**:
  - `PROGRESS_SYSTEM` (`builder/site-progress.mjs:1487`): edits and add-ons on records without talk.
  - `TALK_SYSTEM` (`:1547`): builds, edits and add-ons on talk records, and the Publish / Restore / Discard action talk (`actionTalk` in `worker.js` writes through `writeProgress(..., talk: true)`).
  - `TASK_SYSTEM` (`:1625`): each request part's lines in every state (including "waiting" on the customer's answer), the parallel card's titles and its opening line.
  - The security scan's lines: `SCAN_LINE_RULE` and `scanLineRule(earlier)` (`builder/security-say.mjs:107`, `:113`), used by both scan-line calls in `worker.js` (the running scan's per-step lines at `:48558`, now handed the lines already shown; the working line at `:48580`).
- Each writer's first-person rule now points at the voice instead of "naturally and conversationally, the way you would tell them yourself", and the task writer is told its lines, titles and opening never all begin the same way.
- **A problem once.** The writers were told a not-done thing "stays exactly as it is said there in every update", and the standing list (`progressContext`, `:1768`) was headed "each stays exactly as said here in every update". That is what made the Saltmarsh build repeat "One photograph could not be made…" on every line. The list is still handed to every later line, so no line can claim the photograph, but now headed "already told to them once: do not say any of them again", and the writers' rules say it once, where it is news.
- **The repeated tail was in code.** About a dozen step facts ended in " Not published yet." (or "The site is not published yet.", "not published yet:" in the add-on and edit milestones) and reached the writer on every line. Those tails are removed; the `prepared` state's definition already tells the writer that the work is not published, and the draft/publish step says it once.

## Tests

- New `test/progress-voice.test.mjs`, 6 cases: the voice's properties; the seven approved lines whole, none opening with "I", each opening differently, the draft and the photo each said once; every writer's system (and the requests it sends) carrying the block; a problem once (rules and the standing list, with a live observer); no per-line fact of any build step, compile stage, section, add-on or edit milestone carrying the not-published tail (with at least 6 prepared facts produced); the scan's lines under the shared rule and given the earlier lines.
- Red on the old code (`origin/main`'s `site-progress.mjs`, `security-say.mjs` and `worker.js`): the file fails (the voice exports do not exist).
- Sweep: 7 mutants, 7 killed (the voice dropped from the task writer, the compile tail restored, the old standing-list heading, the scan's earlier lines dropped, the talk writer's "once" rule, the opener rule, the edit milestone tail); the comment-only control survived.
- Updated on purpose (intentional prompt and text changes): `test/progress.test.mjs` (PROSE 2 and 3 now judge the core instructions without the voice block, which carries the owner's example), `test/progress-context.test.mjs`, `test/progress-missing-photo.test.mjs` (MPH 6, MPH 7), `test/progress-more.test.mjs` (R8 now asserts no publish word in a compile line), and the tail-pinning cases in `test/progress-flow.test.mjs`, `test/progress-import.test.mjs`, `test/progress-live-writer.test.mjs`. No prompt-hash pin exists for these prompts.
- The progress, security, parallel, site-list and emoji files: 337 tests, 0 fail. The full suite was started but cut at the 10-minute limit (two failures seen before the cut are environment cases: the browser media mode and the `node_modules` symlink case, which the linked `node_modules` trips); not run to completion.

## Image prediction

The container copies `builder/site-progress.mjs` and `builder/security-say.mjs`, so a merge **rolls the image**: `665ab9d93b9dce93` (origin/main `6b980ae15`) → `d6408655dec3f62b` (code commit `93b3f2229`), 229 inputs on both ends. Builds should wait 15–20 minutes after such a deploy, and it needs the owner's specific allowance (`docs/owner-preferences.md`, deploys that restart the build container).
