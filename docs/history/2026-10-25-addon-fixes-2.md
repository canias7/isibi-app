# 2026-10-25 — add-on fixes, round 2 (branch `fix-addon-existing`; `origin/main` c985956c0 merged in; not merged to main, not deployed)

No model calls, no live writes. Nothing spent. The owner approved finishing the branch.

## 1. No question after charging (wired)

- `partClarifyChoice` is now called in the routing route, before `routeOnExisting` and before the preparation return, when the call is a part's routing job (`rPart`) or an answer resuming a paid request (`rWaiting.requestKey` and `answered`). A `clarify` becomes the obvious choice: a page the change names and the site has → page step; otherwise the add-on step decides. Decision reason `clarify-part`.
- Tests rewritten on the owner's approval:
  - **C1, CR 2** now assert the new rule: no question, the part runs in the same pass, one routing row.
  - **C3, C5, D2, E2, I4** (request-flow), **PAGE 3**, **F3**: the question now comes from a **step** (the description lane of part 0, as CR 1 already did), so they still prove the question machinery (queued slot, expiry, files with an answer, reconnection, resend).
  - **SV, DFU4, RC 6**: assert the part goes on without asking; the rest of what they prove is kept.
- Found while rewriting (backlog, not fixed): on the page (PAGE 3), the card for a **step's** question on part 0 has no `request` field, though the server's question route names `{ key, part: 0 }`. The test now ties the card to the part through the record.

## 2. A lone `row` no longer reads as done when the ask was bigger

- `row` now carries the coverage list (`requirements: true`, so `REQUIREMENT_ADDS` gains `row`).
- `rowUnmet` (`builder/addon-existing.mjs`): each requirement the row designer marks `elsewhere`/`unsupported`, grounded in the customer's words (`wordsIn`), is told in `notAdded` (`why: "needs-more"`, "Not done yet: …"). Its words go on as a part of their own (`aHeldOut.parts` → `deferred`), unless they are the whole message. This runs before the charge and the write.
- Limit: the full requirement judge does not run on the row path. The check relies on the row designer declaring the unmet need.

## 3. Header and footer edit refused (driftwood-and-daughters-5)

- **What the rows show**: add-on job `6f7583f4…` escalated `{reason: "layer", layer: "nav", kind: "frame"}`, cost 0. Edit job `75f25f2f…` failed `refused`, `frame: true`, cost 6, `problems: ["footer:kit:@/components/ui/figure"]` (grok-4.7, 5,011 in / 5,171 out).
- **Root cause**: `frameFileProblems` refuses every `@/components/ui/` or `@/components/charts/` import except `safe-image` and `lang-switch` (`FRAME_PLUMBING`). The frame rules never named that list. The appended own-parts rule allows a kit path "where the brief above names it", and the brief names none. `figure` does exist in the kit (`components/ui/figure.tsx`), so the model reached for it, and the whole edit was refused without a retry.
- **Fix, general (no keyword rules)**:
  - The frame rules name the allowed modules from `FRAME_PLUMBING` and say a sign-up form is plain markup.
  - `runFrameEdit` retries once on `refused` or `no-answer`, using `retryRequest` (same request, model and effort) with the check's reason in plain words (`frameRetryReason`). `cannot` and `unchanged` are answers and are never retried. Usage is summed, and `retried` is reported.
  - A failed frame edit on the nav rung answers `cost: 0`.

## 4. Tests

- New or changed: `addon-existing` (wiring landmarks, `rowUnmet`, row-path order), `request-flow` M2b (lone entry with an unmet need, end to end), `written-frame-edit` (retry, no loop, no retry on cannot/unchanged, rules name the plumbing, route refusal: two calls, `retried`, cost 0), `requirement-coverage` / `addon-steps` / `addon-row` censuses (row carries the list).
- Red check: on the merge commit's `worker.js`, `site-frame.mjs` and `site-add.mjs`, 9 of the new or changed cases fail.
- Sweep: 11 mutants, 11 killed. 2 comment-only/no-op controls survived.
- Full suite: `12747 / 12740 / 4 / 3`.
  - The 4 failures come from 2 cases. `addon-row` case 7 (the tool census) was re-anchored afterwards: 80/80.
  - `no-generated-deps` (node_modules symlink in this worktree) fails at the merge base too, so it is environmental.

## 5. Left

- The page card for a step's part-0 question lacks `request` (above).
- No routing refund when the add-on ends with nothing done (unchanged from round 1).
- The container image will rebuild (Dockerfile and builder inputs changed). It was not predicted here.
