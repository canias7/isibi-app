# One kind refused never sinks the rest (2026-10-22)

On the owner's word ("a"), after the big add-on test on `ember-and-oak` (session record, *Big test, step 2*). Branch `addon-partial`, from `codex-work-into-claude`. Offline; nothing spent; not merged or deployed.

## The defect

An add-on runs one designer per kind (table, row, function, api, job, page, component, words, frame, qr, three, photo). When a kind's design failed its cleaner after its one correction, the route returned that refusal as the answer to the whole addition (`worker.js`, `return aFail({ … error: "add", kind: k … })` inside the designer loop). Live: a weekly job naming a function the site did not have (`no-job-fn`) threw away 22 other asks (pages, lists, links and the rest), and the customer was told nothing was added.

## The fix (`worker.js`, three hunks)

- In the designer loop, a refused kind is pushed to `aNotAdded` (`{kind, why, msg}`, the list the reply and screen already read: "Left out one job. The builder's own reason: …") and to `aKindRefused`, and the loop continues.
- Before the final judgment: when no kind designed anything and at least one was refused (`!aAnswers.length && aKindRefused.length`), the first refusal is the answer exactly as before (requirements judged first, `error: "add"`, cost 0, 422).
- `aKindRefused` is declared beside `aDeclined` (a separate name: `aRefused` already holds the database's refused rules).

A kind that depends on a refused one is judged by its own cleaner (a job whose function was refused is refused itself, by name).

## Tests

- New: PARTIAL 1 (a page and a job naming a missing function: the page lands, the job is named with `no-job-fn`, nothing registered) and PARTIAL 2 (every kind refused: the old 422 refusal at no cost).
- Re-anchored to the new rule (they asserted the whole refusal): JUDGE 16 needed no change after the block moved before the final judgment; REFUSE 6 and WIRE 1 (`addon-refusal-warnings`); the component, QR and photo "route nobody is adding" cases and the one-time job case (`addon-route`), which now assert the other kind lands and the refused one is named.
- Red check: PARTIAL 1 fails on the old `worker.js`, passes on the new; PARTIAL 2 passes on both (control).
- Sweep: 4 of 4 mutants killed (no name, whole refusal restored, no all-refused answer, no refused record); the comment-only control survived.
- Add-on files: 743 / 741 → 743 / 743 after the re-anchors. The full suite then found three more landmark or behaviour cases (`site-add` THE ROUTE RUNS THE ADD STEP, `requirement-coverage` HOPS 3, 5, 6, 7 and 8 (two landmarks), `mixed-work` WORKS (ALL OR NOTHING), renamed ONE REFUSED, THE REST LAND); re-anchored. `draft-blocked-card` SB1 failed once and passed on rerun (unrelated, timing).
- Full suite: `11939 / 11937 / 0 / 2` locally.
- "All or nothing" was never the owner's words: it was the code's reading of 2026-09-13's *"Validate model-authored properties before apply"*, recorded by the 2026-10-03 audit as the owner's rule. Corrected there.
