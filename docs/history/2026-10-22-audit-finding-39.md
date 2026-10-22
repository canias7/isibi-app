# Audit finding 39 (2026-10-22): a page edit's rewritten components are checked (A21-2)

Finding 39 of `docs/audits/2026-10-17-builder-audit.md` (A21-2, high), on branch `audit-finding-39`. Offline; nothing spent, nothing deployed.

## Re-verified on the current code

Real. On `3fda8174` the page rung (`worker.js`, `if (eLayer === "page")`) kept every component the writer returned (`pFreshParts`), apart from those `partsSent` withheld or an unreadable store. `keepPhotos` was the only check that read them. `keepCheck` and `preservePageProse` compared `target.source` with `wrote.source` only, so a page sent back unchanged gave them two equal strings: `keepInventory` found nothing (`kept`, no call) and `preservePageProse` answered `ok` (`before === after`). `partMoved` was true and `pGuard.parts` was published. Nothing limited the returned components to the ones the edited page draws.

The audit's example, driven through `POST /api/site/<slug>/edit` with the wire stubbed ("Change the sourdough price on the menu card to £5"; the writer returns /menu unchanged, `menu-card` with the price changed and two loaves deleted, and `visit-map`, drawn only by /visit, reworded): on the old code the edit published both components and answered success.

## Fix

`builder/part-keep.mjs` (new), wired into the page rung above the photograph guard. Each returned component that differs from its stored copy is judged in one of two ways:

1. **Not drawn by the edited page → put back as it was.** "Drawn" is followed through imports, the page's own before and after and the imports of what those import (`partsReached`, using `partBindings`). An import this reader cannot follow counts as drawn, so rule 2 still holds the component to its words. A component that is itself the edited target counts as drawn.
2. **Drawn → it keeps its words and links unless the message asks to change them.** Links and nested components come from the page check's own inventory (`keepInventory`, `inPart: true`). Words come from the page prose check's parser (`proseInventory`, which now records each line's position). Lines are matched exactly first. A lost line that has an unmatched new line of the same kind in the same place is one **change** ("£4" now reads "£5"). Any other lost line is a **loss**. Each item names the heading it sat under. Every item goes to the existing keep judge (`judgeItems`, which `keepCheck` now shares), under the same fail-closed quote rules. Only `kept` or `asked` ship. A missing parser, an unreadable file or a failed judge counts as `unchecked`, and the component is put back.

A brand-new component has nothing to lose and is not judged. A component that was put back is dropped from what the rung accepted, so the stored copy is what gets merged, published and stored. The rest of the change still ships. If nothing else changed, the rung refuses at no cost (409 `withheld`, never an escalate). Its sentence comes from `partsHeldMsg`.

The customer is told which components were put back, in their own words (the component's declared `does`, else its name). The reply carries `partsLossHeld` (the rewrite would have taken words or links off that were not asked about) and `partsHeld` (another page's component). Both are carried through the multi-step merge, the reply facts (`site-reply.mjs`) and the screen (`public/chat.js`). The judge calls are billed with the rung's other calls (`eCharge`).

The judge's prompt gains two item kinds, `text-lost` and `text-changed`. The `sections` group can now hold `text-lost`. Page edits never send these kinds: page text keeps its own parsed check. A21-1 (props and data content in the page guard) is a separate fix by another helper. This change does not touch it.

## Tests

- `test/edit-part-keep.test.mjs`, 8 cases:
  - **The audit's example:** both components put back, 409 at cost 0, no escalate, one judge call (for the card only), the store unchanged, nothing compiled, and both components named on the screen.
  - **The price alone:** ships, and the reworded `visit-map` is put back and named.
  - **An asked-for removal inside the card** ("Take the rye off the menu card"): ships.
  - **A lost link the judge does not answer for:** the component is held.
  - **A brand-new component:** ships unjudged.
  - **Unit cases:** `partsReached` (nested, namespace import, self), `partTextItems` and `partKeepCheck` (cannot-tell is never `kept`; an unchanged component costs nothing).
- **Red check:** on the old `worker.js` the audit example, the price-only case and the lost-link case fail (5 pass, 3 fail). The controls pass on both versions.
- **Existing cases updated** for the intended change:
  - Three route cases now rewrite a component under a message that asks for it. They gain a keep-judge stub that answers as a reading judge would: `edit-page-context` "a page step and then a picture step…" and "CONTROL: with the store readable…", and `edit-page-protect` "a withheld component is named… when two rungs ran".
  - One source guard (`edit-parts` "a changed component is a change…") now matches the held branch's head up to its first three lists.
- **Sweep** (hand-run, 7 mutants and 1 comment-only control, on `test/edit-part-keep.test.mjs`): 7 of 7 killed (the reach rule, the verdict gate, the drop from accepted, the reply field, the held branch, cannot-tell imports, text losses), and the control survived.
- **Also from the change:**
  - `builder/part-keep.mjs` is added to the Dockerfile's worker tree. The job runner imports it through `worker.js` (`dockerfile.test.mjs`). This is a container input, so the next deploy rolls the image.
  - `edit-page-contract`'s run-17 cases gain a keep-judge stub. Their corrected component rewords the box the request is about.
  - The page rung's success reply stays inside `site-apply`'s 4,000-byte window (it trimmed a comment).
- **Full suite** (`node --test "test/*.test.mjs"`, machine shared with other helpers), measured before those three fixes: `11655 / 11640 / 12 / 3`.
  - 9 of the 12 failures were the three items above, and each passes after its fix (its files re-run).
  - The other 3 are environmental:
    - `media-verify` THE BROWSER MODE fails on the base commit too.
    - `no-generated-deps` trips on this worktree's `node_modules` symlink, and passes with the symlink removed.
    - `purchase-recovery-card` RC 5 is timing under load, and passes re-run.
  - After the fixes, the touched files were re-run green: `edit-part-keep`, `edit-page-protect`, `edit-page-context`, `edit-parts`, `edit-page-contract`, `dockerfile`, `site-apply`, `no-silent-loss`, `requirement-coverage`.
  - The whole suite was not re-run after them.

## Limits

- Words are compared as written JSX text. Copy computed in code, or passed as props or data, is not read here. That belongs to A21-1.
- A paraphrased request that shares no word with the lost line or its heading is refused by the judge's quote rule. This is the same cost the page check states.
- On band-split home pages the bands are components the home page draws, so they are now checked like any other component.
