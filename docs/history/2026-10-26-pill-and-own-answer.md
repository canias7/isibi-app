# Questions counted apart; "Something else…" shows it was chosen (2026-10-26)

**The pill.** In live test 11 the pill read "3 tasks in progress" for twenty minutes. Two of the three were questions waiting on the customer. `siteBgHTML` now counts parts in `ask` separately:
- the pill reads "2 need you · 3 in progress", or "1 needs you" when only questions remain;
- the open panel's header reads "6 tasks · 2 need you · 2 in progress".

**The part "left running" after a `retry_reason` failure.** Checked, and it was not stuck:
- `retry_reason` is only a trace mark. The job row ends `failed`, and the request's `settle` reads the row's state.
- After the two answers, the panel read "1 in progress": the remaining open question (the reviews move). That is the pill defect above, not an unsettled part.

**"Something else…".** Clicking it cleared the pick and focused the box below, but the row never showed it was chosen. Now:
- the row is drawn checked (`aria-checked="true"`, the filled dot);
- a line under it says "Type your answer in the box below and press send.";
- a real pick clears both.

Continue stays disabled, because the answer is sent from the box. The first-build card behaves the same way.

**Checks.**
- Tests: `background-work.test.mjs` (1 new case) and `question-pick.test.mjs` (1 new case). The three vm harnesses now declare `sitePickOwnKey`.
- Red: 2 fail before the change.
- Sweep: 4 of 4 run were killed (a fifth's anchor was missing); the comment control survived.
- Screenshot: `ui-something-else-and-pill.png` in the session scratchpad, rendered with the real `styles.css` and the real `sitePickHTML` output.

**Full suite on `09e2dc19c` (all five changes):** 12,893 tests: 12,889 pass, 2 fail, 2 skipped. The 2 failures: `site-secrets` (fails on `main` too) and `canary-reopen-browser` REOPEN 1 (passes alone).
