# The five additions: routed to the add-on step and delivered there (2026-10-02)

*On the branch for review: nothing merged, deployed or spent. The code is
`202c554a` (the fix) and `a5282a6f` (the validation batch); this record and
the handoff follow them.*

## 1. The owner's request

> *"Proceed with fixing A1–A5 together. Don't spend on repeating the
> unchanged requests first: the conflicting instructions are visible in code
> and run 90 shows all five misroutes. Make the router consistently treat new
> menu links, footer links, header buttons, page text and photos as
> additions, and ensure the add-on path can actually deliver them before
> changing live routing. Trace and reuse suitable existing execution code
> through shared helpers where practical; avoid duplicating whole pipelines
> or adding keyword overrides. Preserve existing-item edits, removals, row
> additions, page scope and correct mixed-request handling. Add focused
> regression coverage and prepare one post-fix validation batch covering
> routing plus actual delivered results, with its cost estimate. Keep undo,
> conversation context and attachment delivery recorded as separate findings
> for the next round. Mark Test 11 closed for its verified saved-row
> outcome. Commit/push the implementation and updated handoff for review
> before merge, deployment or further spending; broader testing stays
> paused."*

## 2. Why run 90's five went to edits

The router audit's R1 (`docs/investigations/router-audit.md`) had it from the
code, and run 90 confirmed it with one answer each: the `nav`, `picture` and
`page` clauses gave additions as their own examples ("add our Instagram",
"add Contact to the menu", "add a Call now button at the top", "add a photo
to the about page", "add a block built from parts the page already has"),
against the add-on clause and the tie-break. The model followed the
examples. And the add-on step had no kind for a menu link, a footer link, a
header button or one line of words; a lone photograph was handed to the
picture step, which fills a frame that exists and cannot add one.

## 3. What changed

### 3.1 The add-on step delivers each of the five (`202c554a`)

Each reuses the code that already makes the thing; no pipeline is copied and
no message wording is matched.

- **A new item in the frame — a menu link, a footer link or detail, a header
  button — is the `frame` kind**, dispatched to the menu editor
  (`ADD_HOPS = { frame: "nav" }` in `builder/site-addon.mjs`, the one list of
  hand-overs). Asked alone it is handed over with the customer's sentence;
  beside other kinds it is set aside and named (`skipped`), so it is never
  designed into a page by the add-on's page writer.
- **The menu editor gained an addition mode** (`builder/site-nav.mjs`): the
  request carries `ADDITION_NOTE`, and the answer is held to adding
  (`additionOnly`) — nothing taken off, nothing repointed (the links in the
  pages included), the frame's arrangement left alone, a footer detail the
  site has never rewritten or cleared. The button they have stays: a new one
  becomes the **second button** (`secondAction`), and a third is refused by
  name ("kept"). Menus and the footer's lists are added to **page by page**
  (`newItems`, `withAdded`, and the function forms of `applyNav` and
  `applyChromeList`), so a page whose menu differs from the home page's keeps
  its difference — the bakery's Order and Visit pages have no Gallery link,
  and an answer restating the home page's menu gives them none.
- **The kit's header and frame take an optional second button**
  (`site-header.tsx`, `site-chrome.tsx`): an outline button beside the first,
  hidden on a phone's header and shown in its menu sheet.
  `builder/component-api.mjs` is regenerated. Rendered and shown to the owner
  as a screenshot during the work.
- **New words on a page are the `words` kind**, designed here: the page must
  be one the site has (refused by name otherwise, never moved to the home
  page), and the words are placed exactly or refused — never trimmed
  (`no-words`). Before the bill the route reads the written page with the
  text rung's own reader (`extractText`) and requires the line there more
  times than before (`wordsLanded`); otherwise it answers 422 `not-landed`
  at cost 0 and nothing ships.
- **A photograph is designed here whatever company it keeps** (the hand-off
  to the picture step is gone). It is either one of the site's own
  photographs, by its exact address (`ownPhotos` over `photoInventory`; the
  designers are shown the list, and the cleaner refuses an address the site
  does not have: `not-ours`), or one bought as before. A placed photograph is
  checked on its page before the bill (`photosLanded`, `imageRefs`' own
  grammar). **A photograph alone with nothing real to show is refused at no
  cost** (`no-photo`): before the page call when there is neither one of the
  site's own nor the balance to buy, and after the page call when a purchase
  fails — never an empty frame published under "a photograph was added".
- **The browser** (`public/chat.js`, `public/edit-poll.js`): the add-on's
  hand-over posts the edit with `addition: true`; and since the add-on can now
  hand an ask to an edit, an edit that the add-on handed over and that names
  the add-on again **stops** (`fromAddon`, kept across a resumed watch) with
  "⚠️ I couldn't add that, so nothing on your site changed. Try describing it
  a little differently." The add-on's reply names the words and the site's
  own photographs from what landed, and a frame item that was set aside.
- **A row beside other kinds**: beside the one kind that still hops (a frame
  item asked alone) the message is refused whole, as it was beside the old
  photo hand-off; beside a photograph, now designed here, the entry is set
  aside and named like beside any designed kind, and the `no-photo` refusal
  names it too.

### 3.2 The router says the same everywhere (`builder/site-ask.mjs`)

- The `addon` clause claims a new item in the frame, new words and a new
  photograph, with its own examples (none of run 90's sentences).
- The `edit` sentence, the tie-break ("ask it of the thing itself") and the
  system's cost rule say the same: a new link, button, line or photograph is
  an addition; changing or taking off one the site has is an edit.
- `text`, `picture`, `nav` and `page` no longer give additions as their
  examples, and each says where an addition goes. What stays claimed: the
  menu items the site has (order, renames, removals, a whole list given),
  the button, the footer's details, a photograph's swap and crop, links in
  the copy, the frame's arrangement.
- `look`'s reach is what the site already has, so a new item beside a look
  change is held back rather than dropped into `look`.
- The one-page example now changes the phone number in every page's footer
  rather than putting one there.

### 3.3 A defect found on the way, fixed in the shared path (flagged for review)

Taking a button off **the shared frame object** (`const CHROME = { …, action:
{ … }, … }`) left `,\n ,` — an object that does not parse — so "drop the
button" on such a site could only fail to compile. The second button's
removal shares the line, which is how it was found. The object form now takes
its comma, and the whole line when the property is on a line of its own.
This changes the existing edit's removal too (for the better); it is called
out here so the review can weigh it separately.

## 4. What is preserved, and the cases that pin it

- **Existing-item edits**: without the flag, the same menu answer is the menu
  edit it always was, a button answer replaces the button, and a taking
  answer takes (`edit-removal-door.test.mjs`, *FRAME ADDITION … the control*,
  sync and queued). The router keeps claiming the menu items, the button, the
  footer's details and a photo's swap and crop (`router-additions.test.mjs`).
- **Removals**: unchanged; the removal door and the photo removal are
  untouched, and a removal is still never an addition.
- **Row additions**: the `row` kind is unchanged; a new entry in a stored list
  stays `addon`.
- **Page scope and mixed requests**: the whole-message rule is unchanged; a
  frame item beside other kinds is set aside and named, never designed into a
  page; a new item beside a look change is held back, not dropped.

## 5. Verification

- **Focused tests**: the twelve affected files, 896 tests, all passing, and
  the harness's two files, 87; new files `test/frame-addition.test.mjs`,
  `test/router-additions.test.mjs`, `test/canary-additions.test.mjs`. Two old
  guards were re-anchored to their property: the poll module is now driven
  rather than read (`add-goes-to-addon.test.mjs`), and the row-beside-a-hop
  refusal is pinned on the kind that still hops, with a new case for a row
  beside a photograph (`addon-row.test.mjs`).
- **Red check** (the new and changed tests on `efc04d8a`): 46 fail across 11
  files; the four behaviour controls (the same answers without the flag) pass
  on both; the two button controls fail on the old code only through their
  observer, because the old `actionSlots` has no second-button reading.
- **Mutation sweep of the fix** (`scripts/mutants/additions-a1-a5.json`, 35
  mutants over the route's landing checks and no-photo refusals, the flag and
  the loop bound in the browser, the menu editor's addition rules, the kinds'
  cleaners, the hand-over list and the router's eight new sentences): 32
  killed on the first pass. The three survivors were test gaps, each closed
  and then killed: an addition repointing a link in the copy (now asserted on
  the starter page's real link), the words cleaner's refusal (a new cleaner
  case), and the hand-over's layer check (a direct case). Both comment-only
  controls survived.
- **Mutation sweep of the batch's harness** (`scripts/mutants/additions-batch.json`,
  18 mutants over the wall and the verdict): 15 killed first; the three
  survivors were each masked by another check in the test's cases, and an
  isolating case for each brought it to 18 of 18. Both controls survived.
- **How the hand-over's job settles**, read through the real queued route: no
  reserve, no ledger entry, its row at `billing: none`. The canary's money
  check refused `none` as unsettled, so it now accepts it as "never reached a
  paid step", with an empty ledger, like an exempt job.
- **Full suite**: `8639 / 8639 / 0 / 0` locally on `a5282a6f`'s tree.
- **Required CI on `a5282a6f`**, both green (one push carried both commits):
  - unit tests, run 36964844334: `8639 / 8635 / 0 / 4` (the same total; CI
    skips its usual four);
  - site build, run 36964844335: the gate printed *"ALL CHECKS: 404 checks
    in 27 sections across 4 shards, every job green"*, at inputs
    `6edc8816087ae55d` (3,967 files). `202c554a` has the same fingerprint
    (computed locally), so the run covers the fix as well. The other counts,
    from each step's log: TAP 397, kit-typecheck 4, contrast-cases 16,
    theme-seam 11, theme-render 29, site-routing 14, site-runtime 47;
    kit-render, kit-a11y, kit-effects and kit-paint all passed.
- **Image**: `a412daac10dbc936` on `main` and `efc04d8a` → `331bf9bf72e72309`
  on `202c554a` and `a5282a6f` (189 inputs, 159 paths; the kit's two files
  and the builder modules moved). So a merge rolls the container, and owes
  the usual wait before container work.

## 6. What this does not show

- **No real model has routed any of the five since the fix**, and no real
  add-on designer or page writer has answered for `words` or `photo`; every
  route case uses supplied answers. The batch below is the first reading.
- **A bought photograph** is unchanged and unfunded at fal; only the site's
  own photograph path is new.
- **A frame item beside other kinds** is set aside, not made: "add Order to
  the menu and a line on the Visit page" makes the line and says the menu
  item was left out. Whether the add-on should hand the frame item over after
  its own work is a decision for later.
- **Several new buttons at once**: a third button is refused by name.

## 7. The post-fix validation batch (prepared, not run)

Four presses of the edit canary, in this order, after the owner's merge and
deploy; each is the owner's.

1. **Free: the runtime check and the batch's rehearsal.** `12-additions` with
   spend `no`, and the deploy's sha and image: the free checks confirm the
   Worker and a cold container, the before-read is taken, and the real app
   opens signed in, opens the bakery and types message 1 — sending nothing.
2. **Paid: the five additions, delivered** (`12-additions`, spend `yes`).
   Run 90's five messages, word for word, from one tab:
   - A1 "Add our Instagram to the footer: @harbourloaf."
   - A2 "Add Order to the menu."
   - A3 "Add a Call us button at the top that rings 0117 496 0000."
   - A4 "On the Visit page, add a line saying we're closed on bank holidays."
   - A5 "Add a photo of our sourdough to the Visit page."

   **It passes only on what landed** (`additionsVerdict`): each message
   routed `addon` with its own words, one add-on request, and — for A1–A3 —
   one menu-editor edit carrying the addition flag, with no edit at all for
   A4 and A5; each job's stored reply the hand-over and the menu editor's
   success, or the add-on's own success, shown as a success; five publishes
   in order, the after-read at the last; in the stored source, every page's
   menu gains "Order" → `/order` and keeps every item, every footer gains the
   Instagram link to `instagram.com/harbourloaf`, every header keeps "Order a
   loaf" and gains "Call us" ringing 01174960000 beside it, the footer's
   details unchanged, every page but `/visit` byte for byte as it was outside
   its frame, and `/visit` keeps every word and photograph it had and gains
   one line saying "closed on bank holidays" and one photograph described as
   sourdough; the same five on the published pages a visitor is served; and
   the money closes (routing plus each job's row and ledger, the hand-overs
   at nothing).
   **The wall**: the add-on step is open to this scenario's own site alone;
   an edit that is not the add-on's hand-over is stopped in the browser, and
   A4 and A5 may make no edit at all. A message the router sends to an edit
   costs its routing call and changes nothing.
3. **Free: the restore** to `01790819484141-dgmag4`, the version the
   before-read saw (read live at 04:02 UTC today).
4. **Paid, routing only: the controls** (`addition-fix-1`, eight probes):
   - X1 the "Order a loaf" button changed → `edit`/`nav`;
   - X2 "The starter" taken out of the menu → `edit`/`nav`;
   - X3 the footer's opening hours changed → `edit`/`nav`;
   - X4 the Visit heading reworded → `edit`/`text`;
   - F1 the Visit photo swapped (attached) → `edit`/`picture`;
   - B1 a new loaf → `addon`;
   - C2 a colour change and a new footer link → each answer holding back the
     other's part;
   - D2 two pages' backgrounds → one `look`, page none.

**Cost (estimates, not limits; the balance is the only bound).** Routing
1.3–3 a call (run 90 averaged 1.33); a menu edit 2 (runs 49 and 63); a line
or a photograph through the add-on's page call about 3–8 each.
- Press 2: about 19–37 credits; about 19 more (and $0.15 at fal) if the
  add-on buys the photograph instead of placing the site's own. The
  scenario's budget (45) is checked before each message.
- Press 4: about 10–24 credits; it needs a balance of 24 to start (3 a
  probe).
- Presses 1 and 3: free.
- In all: about 29–61, or up to about 80 with a bought photograph, against a
  balance of 72 (run 90's reading). If press 2 runs high, press 4 can wait
  for a top-up.

**What a pass shows**: one real routing of each addition after the fix, and
each delivered exactly as asked, with nothing else moved. **Not**: how often
the router chooses it, other phrasings or sites, or a bought photograph.

## 8. Separate findings for the next round (not fixed here)

Recorded for the owner's next decisions, from the audit:
- **Undo** (R6): "Undo the last change." went to `look` in run 90; no step
  restores a saved version from a message.
- **Conversation context** (R7): the router sees one message; "Do the same on
  the Visit page." and "Make that one £3.50 instead." were routed without the
  message they refer to.
- **Attachment delivery** (R2): the router is told only that a file is
  attached; the customer is not told when it cannot be used; the picture step
  does not use an attached photo.

Found in this round and handled: the shared frame object's button removal
(§3.3, fixed, flagged); the canary's money check refusing a job that never
reserved anything (§5, fixed in the harness).

## 9. Test 11

**Closed by the owner (2026-10-02) for its verified saved-row outcome** (run
88): *"Mark Test 11 closed for its verified saved-row outcome."* Not to be
repeated. The checklist's *Test 11* carries the closure.
