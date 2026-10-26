# Any step may ask, at any stage (2026-10-26, branch `ask-anywhere`)

From `fix-run6` (`b336be4fd`). Not merged, not deployed. Nothing spent: every
model answer in the tests is supplied.

Owner, 2026-10-26, replacing "no question after a charge"
(`2026-10-24-no-ask-after-charge.md`) and router batch 1's "never on a part":
*any step, at any stage, may ask the customer a question when it genuinely
can't tell.* That one task pauses ("Waiting for your answer" in the panel, the
existing `ask` state and question card). Nothing is charged for the question or
while it waits: a reserve held for that part's unfinished work is refunded, and
only completed work is charged. The other parts keep running. Answering resumes
that task where it stopped, with the answer passed to the same step. Questions
stay rare (genuine doubt only). Recorded in `docs/owner-preferences.md`.

## 1. What changed (`worker.js`, `builder/site-ask.mjs`, `builder/addon-existing.mjs`)

- **The router is offered its question on a part.** The routing route no longer
  passes `offerAsk: !rPart`. `routeMessage` still reads `offerAsk: false` for a
  caller with nobody to ask, but no route passes it now.
- **A part's question is no longer turned into a choice.** The
  `partClarifyChoice` call (a part's routing job, and an answer resuming a paid
  request) is gone, and so is the function. That conversion caused the earlier
  bug: a follow-up question to a part's answer was turned into `addon`, so the
  answer resumed the add-on step and failed. Now the follow-up is kept for the
  same part (`askedAgain`), and a plain answer resumes it (`answerPart`).
- **The edit and add-on steps keep their question field after a charge.** The
  routes no longer pass `charged` (`eChargedYet`, `aChargedYet`, removed) to
  `eQuick`, `aQuick` or the page writers' `clarifyCall`. A step that asks ends
  its job in the question, the job is refunded (the existing path), and the part
  waits. The transport's `charged` option in `builder/clarify.mjs` is unchanged
  and unused by the routes. `partOf`'s `charged` in `builder/request.mjs` is left
  as is, because two other branches are changing that file. Nothing reads it now.
- **An answer's routing is not charged again** (`rPaidResume`, unchanged; now
  guarded by AA 1 and C1 and covered by the sweep).

## 2. Which steps can ask (survey)

Every step a customer's request reaches already carries the one question field
(`QUESTION_FIELD` / `withQuestion`). Its outcome is read with `askOf`, and the
routes keep it as the part's question:

- text and data: `write_text_edits`, `write_row_changes` (`site-apply.mjs`);
- rules: `write_table_rules`;
- the look door: `pick_lanes` (both), `edit_site` (every lane, the description
  included), `take_off`;
- `choose_pictures`, `write_nav`, `write_tweak`, `edit_frame`, `write_band`;
- the page writer: `write_pages` / `SITE_PAGES_TOOL_ASK`;
- the add-on step: `pick_adds`, the designers (`add_to_site`) and
  `judge_requirements`.

Only internal calls that no customer request reaches have no question field,
because there is nobody to ask: `write_part` (a build's component fan-out),
`repair_frame`, and `editTool(…, { ask: false })` for the correction round. So
no schema line was added. The fix was taking away the gates that removed the
field.

## 3. Tests

- **New: `test/ask-anywhere.test.mjs`** (2 cases).
  - **AA 1**, through the real Worker and the request-flow platform: "Change our
    TikTok link…, make the cafe opening hours 8am to 4pm, and say four
    generations on the About page", with the hours on Home and Visit.
    - Part 0 (TikTok) is charged.
    - Part 1's text step is then offered its question and asks "change both?".
      The part waits, and its job nets 0.
    - Part 2 finishes while it waits.
    - The answer "Both pages" resumes part 1 at the text step, which is shown the
      answer and changes both. The only new charge is the resumed part's, and no
      routing row is added.
  - **AA 2** (source): no `charged` gate passed to any step transport, no
    `offerAsk: !rPart`, no `partClarifyChoice`.
- **Rewritten to the new rule:**
  - `auto-split` C1: a later part's picker is offered its question, waits
    uncharged, and the answer resumes it with no routing charge.
  - `no-ask-after-charge`: the edit route (sync and job) cases now check that
    the photo step after a charge is offered its question and is not charged.
    The add-on page writer case checks that it is offered its question, waits
    with net 0, and that the answer resumes it and lands, charged once.
  - `router-b1`: a part is offered a question.
  - `addon-existing`: the conversion's cases removed, and the source guard
    inverted.
- **Put back to the rule that parts ask** (the old-rule hunks of `8e24dac4a`,
  `ba4d3441e` and `12357f225`, reverse-applied cleanly):
  - `live-clarify-continue`, `-continuity`, `-limits` and `step-pool` (SP 3);
  - `parallel-batch` (BATCH, BATCH 2), `parallel-requests` (P4) and
    `parallel-addon-independent` (CC 3b);
  - `request-flow` (C1, CR 2 and others), `background-work` (SV) and
    `draft-ui-browser` (DFU4).
- **Red check**: with `worker.js`, `site-ask.mjs` and `addon-existing.mjs` from
  `b336be4fd`, the changed files fail 20 cases. These include AA 1, AA 2, C1
  (both), CR 2, BATCH, the edit and add-on route cases, and the continuity
  cases.
- **Sweep** (`worker.js`; ask-anywhere, auto-split, router-b1,
  no-ask-after-charge and request-flow): 5 of 5 killed.
  - the edit `charged` gate put back: 6 fail;
  - the add-on `charged` gate put back: 1 fail;
  - `offerAsk: !rPart` put back: 2 fail;
  - a part's clarify turned into `addon`: 7 fail;
  - the answer's routing charged again: 5 fail.
  - The comment-only control survived. (A first version of the last mutant,
    `rCost = rCost`, was not a mutant: it skipped the charge too, so it
    survived. It was replaced.)
- **Full suite**: `12846 / 12840 / 3 / 3`.
  - SP 3 was fixed after that run: 10 of 10 pass in `step-pool`.
  - `no-generated-deps` fails only because this worktree's `node_modules` is a
    symlink. It passes with the link removed.
  - `canary-reopen-browser` REOPEN 1 passes alone (2 of 2): it timed out under
    load.
- **Screenshots** (headless, unchanged UI):
  - `dfu4-waiting-and-question.png`: a part's question card after the
    description part was charged;
  - `dfu4-both-saved.png`: after the answer;
  - `b-panel-waiting-for-your-answer.png`: the panel with the waiting task.

## 4. Not done / limits

- Supplied answers only. How often a real model asks now that it is offered the
  field after a charge is not measured. `QUESTION_FIELD` still says to ask only
  in genuine doubt, never for what the site or the message already answers.
- The `defaulted` machinery (`noAskRequest`, `defaultedReport`, the reply fact)
  is still in the code. No route triggers it now.
