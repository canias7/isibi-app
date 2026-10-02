# The whole-router audit's batch 1: W1–W4 (2026-10-02)

**On the branch `claude/help-needed-ehlwlj`, for review. Not merged, not
deployed, no live run.** Nothing was spent, no model was called, nothing
was changed on a site, and no container was built. Every outcome below is
shown with supplied model answers through the product's own code.

**The owner's order:** *"Fix W1–W4 together first, including W3's
conflicting rewrite/deletion contract. Make handoffs carry only operations
valid for their destination, make partial removals preserve the other
languages and QR codes, keep omitted pages unless deletion is explicitly
requested and validated, and apply menu changes to each page's existing
items without flattening unrelated differences. Keep this universal: no
customer-word regexes, keyword lists, site exceptions or test-specific
patches. Add focused regression checks through the affected execution
paths, including successful intended removals and unchanged neighboring
content. Finish the eight response/fallback branches currently marked "not
traced," and update the audit to distinguish confirmed code defects from
conditional risks and untested model behavior. Keep the other findings
tracked for the following batches. Run focused free checks and required
unit CI, then commit/push the fixes and current owner-notes for review;
leave CLAUDE.md alone. Hold paid runs and deployment until this batch is
reviewed, and avoid an unnecessary container build."*

The findings themselves, with their evidence, are in
`docs/investigations/whole-router-audit.md` (§3.1 W1–W3, §3.3 W4); each
now carries a *Fixed on the branch* entry saying what changed and what it
does not cover. §3.0 classes all 26 findings and lists the risks the fixes
left (N1–N10).

## 1. What changed

**No rule reads the customer's words.** Every decision below is made on the
step's own answer, the site's own files, or the destination's own
capability.

### 1.1 W1: a hand-over carries only what its destination can do

- **Before**: when a step handed the job on (the photo step's
  `needs-place`, the edit's hand-over to the add-on, the add-on's
  hand-back), the browser re-posted the router's own `remove`, `rename` and
  `tab` to the new step. A photo removal handed to the page step deleted the
  page, with no model call.
- **Now**: every hop is built by one helper, `EditPoll.handOver`
  (`public/edit-poll.js`): the destination's step and page (else the ask's
  own page), what the router held back, what reading the message cost and
  the add-on bound, and `handedOff: true`. None of the first answer's verbs
  travel. The edit route reads none of `remove`, `rename` or `tab` on a
  request so marked (`worker.js`, the `eHanded` reads), and the mark counts
  only as a real boolean. The router's own removal, move and tab still act.

### 1.2 W2: taking one entry off a list keeps the rest

- **Before**: a removal the look step's picker marked on `langs` or `qr`
  emptied the whole field. "Take the Spanish version down" took French too;
  taking one QR code off took both.
- **Now**: a removal on a list holding more than one entry is answered by
  that field's own lane, told it is a removal (`removalNote`,
  `builder/site-lanes.mjs`): the languages and controls lanes answer the
  list with the named entry gone, the QR lane names the code, which comes
  off by name (`patchQr` with `remove`, `builder/site-qr-list.mjs`). The
  field is emptied only by a lane answering an empty list.
- **Every code that comes off takes its figure off** every page and
  component that shows it, found in the file's own syntax tree
  (`codeFigureRemoval`, `builder/site-picture.mjs`, with the container's
  TypeScript parser): the figure reading the code, and a bare wrapper
  holding only it. A figure inside a condition, inside a sentence, or beside
  a code that stays is refused with nothing written, published or charged;
  so is a component store that cannot be read, and an edit with no parser.
  This closes a defect W2 hid: when the only code came off, its figure
  stayed, reading a binding the publish no longer writes.

### 1.3 W3: a full rewrite keeps every page it does not return

- **Before**: the one page tool every mode shares said "an unreturned page
  is KEPT", the rewrite's own prompt said "to DELETE a page, simply do not
  return it", and the publish kept only what came back. A rewrite returning
  one edited page published a one-page site, and a link from it to a page it
  did not return was rewritten to `/` as dangling.
- **Now**: one contract, the tool's. Both of the rewrite's prompt blocks
  (the full one and the one for long sites) say an unreturned page is kept
  and `remove` deletes one (`builder/page-gen.mjs`). The publish folds the
  returned pages over the stored site (`mergeRevisedPages`,
  `builder/site-addon.mjs`; `builder/publish-pages.mjs`): a returned page
  replaces or adds, every other page stays byte for byte, and a page comes
  off only when the writer named it in `remove` and the add-on's own rule
  allows it (`takePagesAway`: never the home page, never a page another page
  still links to). A refused removal is said (`keptNote`, carried by
  `builder/build-answer.mjs` and shown with the build's other notes in
  `public/chat.js`). The returned pages are checked as part of a site, so a
  link to a kept page stays and a home page left out is not reported
  missing.
- **Folded in**: the rewrite handed the container only the components the
  writer wrote, so a kept page's components went missing; it now hands the
  stored ones too, the rewritten one replacing its old source (`mergeParts`),
  when the store was read (`worker.js` passes `priorParts` from
  `readSiteParts`).

### 1.4 W4: a menu change is made to each page's own menu

- **Before**: the menu editor's answer, one list, was written into every
  page's menu, so a page that listed two of four items gained the other two.
  On run 92's stored bakery pages, one rename added Gallery to `/order` and
  `/visit`.
- **Now**: the answer is read as the changes it makes to the menu the
  editor was shown, by address (`menuChange`, `builder/site-nav.mjs`): an
  item taken off, renamed, pointed somewhere else, replaced by a new item
  between the same neighbours, moved (the fewest items that explain the new
  order), or added. Only those changes are made to each page's own menu
  (`menuApply` through `applyNav`): a page never gains an item it did not
  list (an addition excepted), and keeps its own order and its own words for
  items the answer only restated. A rename reaches the item on every page
  that lists it.
- **Folded in**: a menu the change leaves as it was is left as written, to
  the byte (an unchanged menu used to be rewritten onto one line and counted
  as changed: "Updated the menu on 4 pages" for a change two menus had), and
  the reply names the menus as they now read, with how many pages carry each
  when they differ (`menusNow`, `navReply`).

### 1.5 The eight replies §1.6 marked "not traced"

Traced, each to its customer sentence and its money: the rules editor, the
menu editor, the address step, the add-on picker, the designer, the split
page writer, the translator and the research search. Two are risks (an
empty band publishes silently on the split path, N7; a failed translation
publishes behind, unsaid, N8), and the money rule they share is N9 (the
synchronous edit path keeps a refusal's model charge; the queued path, the
one in use, refunds it). The audit's §1.6 has each row.

## 2. What the customer reads

Two sentences are new on screen. Rendered from the real code: the server's
reply composed by the product with supplied answers, the browser's own
reply composer and note list, the chat's own thread markup and stylesheet
(cut from `public/chat.js` landmark to landmark), and the app's own font.

- **The menu reply** (`docs/edits/router-batch-1-menu-reply.png`): *"Rename
  Visit us to Find us in the menu."* on a site whose four menus differ,
  through the real edit route (queued), the editor's answer supplied. On
  the unfixed code: *"✅ Updated the menu on 4 pages: Home · Menu · Find us
  · Order · Status."*, a list no page had, written on every page. On the
  branch: *"✅ Updated the menu on 3 pages, each keeping its own items —
  Home · Menu · Find us · Order (1 page); Menu · Find us · Order (1 page);
  Home · Find us · Menu · Order (1 page)."* The Status page never listed
  Visit, so it is not touched or counted. The cost is 2 either way.
- **The kept note** (`docs/edits/router-batch-1-kept-note.png`): a rewrite
  whose writer returned the Visit page and named `/menu` in `remove`,
  through the real `/api/site/react-revise` route: the page stays (all four
  pages compiled), and the build's note reads *"I left /menu — / still
  links to it. Ask me to take the link out first."* above the browser's own
  success line. (The free harness has no image model, so its answer also
  carried a note about placeholder photographs; it is left out of the
  picture because it is the harness's, not this batch's.)

## 3. Checks

All free: no model, no network, no site, no money.

### 3.1 New tests (84 cases), and how many fail on the unfixed code

| File | Cases | Red on `5ce037a0` |
|---|---|---|
| `test/handover-operations.test.mjs` | 8 | 7 (the control passes) |
| `test/handover-route.test.mjs` | 12 | 6 (the 6 controls pass) |
| `test/partial-removal.test.mjs` | 19 | 16 (3 pass: the only-language controls and the all-languages case) |
| `test/qr-figure-removal.test.mjs` | 11 | 10 (the parser control passes) |
| `test/revise-keeps-pages.test.mjs` | 12 | 10 (the 2 controls pass) |
| `test/menu-per-page.test.mjs` | 22 | 20 (the 2 controls pass) |

Route cases go through the real `POST /api/site/<slug>/edit` (or
`/api/site/react-revise`) on both money paths where the step has two, and
judge the compile payload and the store page by page, the money and the
reply. **Successful intended removals are held as closely as the neighbours
they must leave alone**: the Spanish version goes and French stays; the
prices code and its figure go and the ring code and its figure stay; an
unlinked page named in `remove` goes and every other page stays byte for
byte; Order comes off the three menus that list it, and the page whose menu
never listed it stays byte-identical.

The red checks ran in a worktree at `5ce037a0` with the branch's test files
copied in; a name the old module lacks reads `undefined`, so its own cases
fail rather than the whole file.

### 3.2 Existing tests changed

Each keeps its property; the reason is in a comment beside it.
- `edit-removal-door.test.mjs`: the reply counts the two menus that
  changed, not four, and a menu without Gallery is now held byte-identical
  (17 of 97 fail on the unfixed code).
- `page-gen.test.mjs`: the rewrite's new sentence in both blocks, and the
  old one gone (2 fail on the unfixed code).
- `build-answer.test.mjs`: the kept note rides on the answer, and only as a
  string (1 fails on the unfixed code).
- Eight source-reading pins re-anchored to the new call sites, each keeping
  what it guarded: `add-goes-to-addon`, `publish-pages`, `wiring`,
  `site-addon`, `site-apply`, `site-ask`, `site-logo`, `site-qr-list`.

### 3.3 Mutation sweeps

`scripts/mutate.mjs`, each from a verified-green baseline, scoped to the
files that guard the change, with comment-only controls that all survived.

| Fix | Mutants | Killed | Survivors, and what closed them |
|---|---|---|---|
| W1 | 14 | 13, then 14 | a truthy `handedOff` read as a mark: a control sending `"true"`, `1` and `{}` |
| W2 | 23 | 22, then 23 | a code's reference outside a `{…}` read further up: a binding used as a tag name |
| W3 | 21 | 16, then 20 | four closed by new assertions (the rewrite read as a whole site; the long-site block's keep rule; the kept note on the answer; the chat showing it); one equivalent, below |
| W4 | 20 | 20 | none |

The W3 survivor left standing drops the `ok` test before the rewrite folds
the stored components. It is equivalent for the one producer there is:
`readSiteParts` answers an empty list with every failure, and folding an
empty list hands over what the writer wrote. The test stays, with a comment
saying so, in case a reader one day returns a partial list on a failure.

### 3.4 Full suite and CI

- **Full suite, locally: `8732 / 8732 / 0 / 0`** (tests / pass / fail /
  skipped), 2m24s, with the sweeps finished and the tree clean of mutants.
  The base (`5ce037a0`) is 8,648 (unit CI run 36982708849, `8648 / 8644 /
  0 / 4`); the 84 new cases account for the difference exactly.
- **Unit CI on `d4e3f1c7`** (the batch with its record corrections): run
  36992649625, `8732 / 8728 / 0 / 4` — the same total as locally; CI skips
  four. **Site build on `22b0f93b`**: run 36992452995, all 8 jobs green.

## 4. What this does not show

- **What a real model answers.** Every outcome is shown with supplied
  answers: how often the photo step answers `needs-place` for a removal
  (U7), how often a rewrite leaves pages out (U6), what a real lane names
  for a removal, and what a real menu editor returns.
- **A live run.** Group D's D1–D3 (fretwork-1's Spanish version, its prices
  code, repairbench-1's menu rename) wait for the owner's merge and deploy;
  D4 needs none (the hand-over route tests cover it).
- **What each fix leaves**, recorded in the audit's §3.0:
  - N1: a removal on a one-entry list still empties it for nothing, as
    before, even for an entry the site doesn't have;
  - N2: with no TypeScript parser (an edit run inline in the Worker), a QR
    removal whose code a page shows is refused, never guessed;
  - N3: a figure whose caption is the page's own words keeps the caption;
  - N4: the footer's two lists still write one list into every page;
  - N5: a menu item for a page the site no longer has comes off every menu
    (the reply names it);
  - N6: a hand-over without a page of its own falls back to the ask's page;
  - N10: a rewrite's writer could name in `remove` a page nobody asked to
    delete (the home page and linked pages are refused).
- **W5–W26** stand, classed in §3.0, and stay tracked for the following
  batches.

## 5. The container

Nine of the batch's files are image inputs (`worker.js` and eight `builder/`
modules), so a merge would roll the image. That roll is needed: the queued
edit path, the one in use, runs in the container, and each fix is in both
paths. Nothing was built: a push to the branch builds no image.

**Predicted over both ends** with `containerInputs` and `imageId`
(`.github/scripts/container-images.mjs`): `main` (`f9979497`) is
`a4409e55d3f3eb09`, the image deployed today; the branch's tree is
`088883cc39806bc6`. 189 inputs, 159 distinct paths, on both ends. A merge
would build `088883cc39806bc6`; after it, the rollout wait applies before
any container work that must run the new code.

## 6. The owner's review, and the gap fixes (2026-10-02)

**Still on the branch, for review. Not merged, not deployed, no live run;
nothing spent, no model called, no site changed, no container built.**

**The owner's words:** *"Hold the merge and fix these batch-1 gaps together.
W4: through runNavEdit, start with Home, Menu, Visit, Order, Status and
supply the correct model answer Order, Status, Home, Menu, Visit—the current
code returns no-change. Fix menuChange/menuApply generally; nine of the 120
permutations of five items failed my comparison, so cover multiple-item
moves and differing per-page menus without flattening them. W2: support
explicitly selected QR removals, including several or all codes, through the
model contract, reader, merge and figure cleanup; the current single-name
patch cannot express removing all. Remove the one-entry shortcut too: list
length does not establish which item the customer meant, so a request for an
absent language or code must preserve the existing item. Let the model
identify the targets and have code validate them, without customer-word
heuristics. W3: remove the remaining "opposite of what it means on an
ordinary rewrite" instruction in priorPagesBlock and check the active
prompts agree. Add focused regressions for these cases and preserved
neighbors, run the relevant checks and unit CI, update the audit and
owner-notes, and push for review. No deployment, paid runs or container
build yet."*

### 6.1 Reproduced first, on `d4e3f1c7`

- **W4**: 9 of the 120 orders of a five-item menu came out wrong through
  `runNavEdit`, the owner's own as "That's already the menu — nothing to
  change." Through the real route on four menus that differ, "Order then
  Visit us first" gave no page that order.
- **W2**: German asked off a site offered only in French took French off,
  with no model call; "both codes" left the ringing code; the wifi code asked
  off a site whose one code is for prices took the prices code and its
  figure off.
- **W3**: the add-on block's removal paragraph still called an unreturned
  page being kept *"the opposite of what it means on an ordinary rewrite"*.

### 6.2 What changed

- **W4 (`builder/site-nav.mjs`, `menuApply`)**: moved items were placed one
  at a time with the others still standing in their old places, so an item
  anchored on a later moved item where that one used to be, and went back
  with it. Now every moved item is lifted out first, and the moved and the
  added go back in the answer's order, each after the nearest item the
  answer put before it that the page has (else before the nearest one after
  it, else at the end). Each page keeps its own items, words and the order
  of what the answer did not move.
- **W2 (`builder/site-lanes.mjs`, `worker.js`, `builder/site-qr-list.mjs`,
  `public/chat.js`)**: every removal on a list (`langs`, `qr`, `behavior`)
  is one small call, `take_off`. The model is shown each entry by the name
  to answer with and answers the names of the entries the customer asked to
  take off: one, several, every one, or none. Code checks each name against
  the stored list by the lane's own rule (`takeOffTargets`). Only names on
  the list come off; a name not on it takes nothing off and is said beside
  what did (`takeOffNote`, shown after the look sentence); a removal that
  names nothing on the list changes nothing and says what the site has (422,
  nothing charged for the edit). Every code named comes off with its figure;
  every entry named empties the field. The QR patch lost its removal option
  (a removal is not a patch). The one-entry shortcut is gone: such a removal
  now costs one small call. Nothing reads the customer's words but the
  model.
- **The refusal sentences say only what the step found.** The screenshot of
  the first version showed "…Nothing was changed. Nothing on your site
  changed, and this edit cost you nothing.": the browser already adds the
  second sentence for every `unchanged` reply (2026-09-23), so the take-off
  refusals, and batch 1's two figure refusals, no longer say it themselves.
- **W3 (`builder/page-gen.mjs`)**: the clause is gone, and every prompt the
  page writer can be given is held by one test to the tool's contract.

### 6.3 Checks

The tables are in the audit's §4.2. In short: 34 new cases (8,732 on
`d4e3f1c7`, 8,766 now), and the removal file's 19 rewritten to the new
contract.
On `d4e3f1c7`, 47 of the 53 new or rewritten cases fail, and both
re-anchored pins (5 of the menu file's 32, 33 of the removal file's 34, the
new module file unable to load, 1 each in `page-gen` and `site-addon`, 2 in
`site-qr-list`). The 6 that pass there are the failed-call control, the
never-twice contract (its guard predates this round), and two route moves
in both money paths that the old placement happened to get right. (A first
draft of these records said 25 new cases, counted from a total that already
held the first nine W4 cases, and that every new case but the controls was
red; both corrected before review.) Sweeps W4 10 mutants (9
killed, 1 equivalent, measured over 494,721 page applications), W2 35 of 35,
W3 8 of 8, every control surviving; full suite `8766 / 8766 / 0 / 0`
locally. Unit CI and site build are read after the push, in the owner-notes
handoff.

### 6.4 The container

Five image inputs changed (`worker.js`, `builder/page-gen.mjs`,
`builder/site-lanes.mjs`, `builder/site-nav.mjs`,
`builder/site-qr-list.mjs`), so a merge would roll the image, which the
queued edit path needs. Predicted, not built: `main` (`f9979497`)
`a4409e55d3f3eb09`; batch 1 (`d4e3f1c7`) `088883cc39806bc6`; this tree
`963a7d3ac5946579`. 189 inputs, 159 distinct paths, on every end.

### 6.5 What this does not show, and what was found

- What a real model names as the entries to take off, or returns as a menu
  order (Group D, after a merge).
- **Found and kept separate** (audit §3.0, backlog): N11, a QR edit on a
  one-code site changes that code when the answer names none; N12, the
  long-site rewrite is told to "write them again in full" without seeing
  the pages; N13, the look reply names a list field by its key ("— langs")
  and never says which codes came off.

