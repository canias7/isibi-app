# The five additions: routed to the add-on step and delivered there (2026-10-02)

*Passed by the owner, and merged and deployed in deploy 2179 (§10.6). Both
presses of the validation batch passed: press 1 as run 91 (§11.1) and press 2
as run 92 (§11.3). The batch is complete and awaits the owner's review. The code is
`202c554a` (the fix), `a5282a6f` (the validation batch), `6c69d155` and
`03e664aa` (two reply sentences corrected before review, §3.4 and §3.5),
and, after the owner's review, `f18af0df` and `dbc520f2` (§10), whose plan
replaces §7's first one; this record and the handoff follow them.*

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

### 3.4 Corrected before review: the no-photo refusal claimed nothing was charged (`6c69d155`)

Found while rendering this round's new reply lines for the owner: the no-photo
refusal said *"…so nothing on your site changed and nothing was charged."* By
then the routing call has been charged, and the browser prints the sentence as
it is, so it called the whole request free. That is against the owner's rule
after run 31 (*"Distinguish the edit's charge from routing … don't … claim the
whole request was free"*). It now says only *"I couldn't get a photograph to
put there just now, so nothing on your site changed."*, like this round's
other refusals.
- **Guard**: both of its paths through the real route (before the page call,
  and after a purchase that failed), with an observer first shown to see the
  claim it forbids (`addon-route.test.mjs`, *the no-photo refusal says the
  site is unchanged, and never that nothing was charged*).
- **Red check**: the guard fails on the old sentence, at the claim.
- **Sweep** (`scripts/mutants/no-photo-money.json`): 5 of 5 killed — the claim
  restored, reworded twice, the unchanged-site clause dropped, and the route
  appending its own claim — and both comment-only controls survived.
- **Older, and not this round's**: `lostPhotosMsg` (an addition that would
  take a photograph off) still says *"Nothing was published and nothing was
  charged"*. It predates this round, so it is left as it was and recorded in
  §8.

### 3.5 Corrected before review: "the new words … without it" (`03e664aa`)

Seen in the same rendering: the sentence for words that did not land read
*"I couldn't add the new words — the page came back without it"*. It chose
"it" whenever one item was missing, but "the new words" are always plural;
only a single photograph is "it". It now reads *"…without them…"* for words
and keeps *"…without it…"* for one photograph.
- **Guard** (`site-add.test.mjs`, *the not-landed sentence refers back to
  what is missing in the same number*): one line, several lines, one
  photograph, several, and words beside a photograph.
- **Red check**: it fails on the old sentence, at the words case.
- **Sweep** (`scripts/mutants/not-landed-number.json`): 4 of 4 killed (the
  old rule, two near misses, the pronouns swapped); the comment-only control
  survived.

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
- **Full suite**: `8639 / 8639 / 0 / 0` locally on `a5282a6f`'s tree, and
  `8641 / 8641 / 0 / 0` on `03e664aa`, the candidate (the two corrections'
  guards added).
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
- **Required CI on `03e664aa`, the candidate**:
  - unit tests, run 36966422224: `8641 / 8637 / 0 / 4` (the same total);
    the run on `6c69d155` (36966106348) was green too;
  - site build, run 36966422193: the gate printed *"ALL CHECKS: 404 checks
    in 27 sections across 4 shards, every job green"*, at inputs
    `6a20f165b967aa9f` (3,967 files, the fingerprint computed locally); the
    other counts from each step's log as on `a5282a6f` (TAP 397,
    kit-typecheck 4, contrast-cases 16, theme-seam 11, theme-render 29,
    site-routing 14, site-runtime 47; kit-render, kit-a11y, kit-effects and
    kit-paint all passed). Its run on `6c69d155` was cancelled when
    `03e664aa` superseded it.
- **Image**: `a412daac10dbc936` on `main` and `efc04d8a` → `331bf9bf72e72309`
  on `202c554a` and `a5282a6f` (189 inputs, 159 paths; the kit's two files
  and the builder modules moved) → `b4f1e95939e15f16` on `03e664aa`, the
  first candidate (`builder/site-add.mjs` is an input; `6c69d155` alone gave
  `ca9575222c27821f`) → **`a4409e55d3f3eb09` on `dbc520f2`**, the candidate
  after the owner's review (§10; `builder/site-nav.mjs` is an input). So a
  merge rolls the container, and owes the usual wait before container work.
- The suite and CI for the candidate after the review are in §10.

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

*Rewritten after the owner's review (§10): two paid presses, the routing
controls first; no separate free rehearsal and no restore. The first plan
(four presses: a free rehearsal, the additions, a free restore to
`01790819484141-dgmag4`, then the controls) is in git at `1e65c842`.*

Two presses of the edit canary, in this order, after the owner's merge and
deploy and the usual 15–20 minutes for the container to roll. Each press is
the owner's, and each fills the deploy's sha and image boxes, so **its own
preflight is the runtime check**: both readers must answer the expected
commit, a cold container the expected image, and queued jobs and the runner
must be on, or it stops before its first paid call.

1. **Paid, routing only: the controls first** (`addition-fix-1`, eight
   probes). Nothing is acted on, so the bakery is unchanged for press 2, and a
   router that now mistakes an edit for an addition is seen before anything
   changes on the site. A paid batch refuses without both deploy boxes and
   below 24 on the balance (3 a probe), so **this press's preflight is the
   enforced runtime check**, at no cost when it fails.
   - X1 the "Order a loaf" button changed → `edit`/`nav`;
   - X2 "The starter" taken out of the menu → `edit`/`nav`;
   - X3 the footer's opening hours changed → `edit`/`nav`;
   - X4 the Visit heading reworded → `edit`/`text`;
   - F1 the Visit photo swapped (attached) → `edit`/`picture`;
   - B1 a new loaf → `addon`;
   - C2 a colour change and a new footer link → each answer holding back the
     other's part;
   - D2 two pages' backgrounds → one `look`, page none.
2. **Paid: the five additions, delivered** (`12-additions`, spend `yes`).
   Its preflight checks the same boxes again, its free checks and before-read
   run in the same press, and the app is not opened if any of them failed.
   Run 90's five messages, word for word, from one tab:
   - A1 "Add our Instagram to the footer: @harbourloaf."
   - A2 "Add Order to the menu."
   - A3 "Add a Call us button at the top that rings 0117 496 0000."
   - A4 "On the Visit page, add a line saying we're closed on bank holidays."
   - A5 "Add a photo of our sourdough to the Visit page."

   **It passes only on what landed** (`additionsVerdict`):
   - each message routed `addon` **by the model itself** (`decision.source`
     `model` and the model's own answer, `decision.raw.intent`, `addon`, with
     no `failed` or `failure`: a fallback that lands on `addon` fails), with
     its own words; one add-on request; for A1–A3 one menu-editor edit
     carrying the addition flag, and no edit at all for A4 and A5;
   - each job's stored reply: the hand-over and the menu editor's success, or
     the add-on's own success, shown as a success;
   - five publishes in order, the after-read at the last;
   - in the stored source: every page's menu gains "Order" → `/order` and
     keeps every item; every footer gains the Instagram link to
     `instagram.com/harbourloaf`; every header keeps "Order a loaf" and gains
     "Call us" ringing 01174960000 beside it;
   - **every page's frame keeps everything else it had, byte for byte**: the
     name, the tagline, the first button, the footer's details and
     small-print links, the arrangement (`frameText`, with only the
     additions' own places taken out, by the menu editor's own writers:
     `withoutAdditions`); every page but `/visit` is byte for byte as it was
     apart from those places;
   - `/visit` keeps every word and photograph it had and gains one photograph
     described as sourdough and one line that **states** "closed on bank
     holidays": the words whole, with nothing before them in their clause
     that denies them (`states`; "We're NOT closed on bank holidays" fails),
     both in the page's text and in the visible text of what the page gained;
   - the same on the published pages a visitor is served, the line held to
     the same rule;
   - the money closes (routing plus each job's row and ledger, the
     hand-overs at nothing).

   **The wall**: the add-on step is open to this scenario's own site alone;
   an edit that is not the add-on's hand-over is stopped in the browser, and
   A4 and A5 may make no edit at all. A message the router sends to an edit
   costs its routing call and changes nothing.

   **The additions stay** (the owner, 2026-10-02): the bakery is not put back.
   The press's after-read records the version it leaves, and that version,
   not `dgmag4`, is the bakery's state for whatever comes next.

**Cost (estimates, not limits; the balance is the only bound).**
- Routing 1.3–3 a call (run 90: 24 credits for 18 calls, 1.33 each).
- A menu edit about 2 (runs 49 and 63). The add-on's own picker is not
  billed when it hands a frame item over: the hand-over answers before any
  bill (`aFailure("layer")`), and its job settles at `none`.
- The line and the photograph: one add-on bill each (its picker, designer
  and page call priced together), about 3–10 (add-ons measured 2–13, runs
  47–52).
- **Press 1, the controls**: about 10–24; it needs 24 on the balance to
  start.
- **Press 2, the additions**: about 19–41 (routing 7–15, the three menu
  edits 6, the line and the photograph 6–20). About 19 more, and $0.15 at
  fal, if the add-on buys the photograph rather than placing one of the
  site's own; it asks for one only when the balance at that moment covers it
  (`imagesAffordable`). The scenario's budget (45) is checked before each
  message.
- **In all**: about 29–65, or up to about 84 with a bought photograph,
  against a balance of 72 (read at 05:28 UTC). After press 1, 48–62 would
  remain, which covers press 2 without a purchase.
- **No free press.** The first plan's estimate (press 2 about 19–37, in all
  29–61) put the page calls at 3–8; the scenario's own comment said 3–10 and
  "about 22–41". They now give one figure, 3–10, which the measured add-ons
  support.

**What a pass shows**: one real routing of each addition after the fix,
chosen by the model rather than reached by a fallback, and each delivered
exactly as asked with nothing else moved, in the stored source and on the
served pages. **Not**: how often the router chooses it, other phrasings or
sites, or a bought photograph.

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
reserved anything (§5, fixed in the harness); the no-photo refusal's claim
that nothing was charged and the not-landed sentence's "without it" (§3.4
and §3.5, this round's own sentences, corrected).

Found in this round and left as it was: **`lostPhotosMsg`** in
`builder/site-add.mjs` (an addition that would take one of the site's
photographs off is refused) says *"Nothing was published and nothing was
charged"*, although the routing call was charged first. It predates this
round (it is in `efc04d8a`).

Found in the owner's review round and left as it was: **`navDigest`** in
`builder/site-nav.mjs` tells the menu editor's model *"THE FOOTER'S CONTACT
DETAILS, on every page:"* and lists the first page's that has any. When
pages differ (§10.1's case), the model is told something that is not so. The
writing side no longer relies on it for an addition (each page keeps its
own); for an ordinary edit it is unchanged, as before this round.

## 9. Test 11

**Closed by the owner (2026-10-02) for its verified saved-row outcome** (run
88): *"Mark Test 11 closed for its verified saved-row outcome."* Not to be
repeated. The checklist's *Test 11* carries the closure.

## 10. The owner's review of the candidate, and its fixes (2026-10-02)

> *"Before merging, fix these review findings together: in site-nav.mjs,
> frameNow takes only the first nonempty contact object, so additionOnly can
> accept a phone number that applyContact then overwrites on another
> page—preserve existing contact fields per page and test differing contacts
> across pages. In canary-additions.mjs, require decision.source=model and
> decision.raw.intent=addon, with no routing failure; a final addon intent
> alone currently lets a fallback from raw edit pass. Strengthen the stored
> and served text checks: "We're NOT closed on bank holidays" currently
> passes the expected closure statement. Also preserve the untouched frame
> fields, including the business name, legal links and layout; blanking the
> entire CHROME object currently hides those changes. Add focused regression
> coverage for these reproductions. Remove the separate free rehearsal and
> restore from the validation plan: use the paid run's built-in preflight,
> run routing controls before the additions, and leave the demo changes in
> place. Update the cost estimate and docs/owner-notes.md, then commit/push
> for review before merge, deployment or spending. After these fixes are
> verified, our next separate task is a whole-router audit across build,
> edit, add-on and internal handoffs for hardcoded intent decisions and
> behavior across different wording and site types. Don't edit CLAUDE.md."*

### 10.1 Each page keeps its own contact details (`f18af0df`, `builder/site-nav.mjs`)

- **Reproduced through the real `runNavEdit`**: a home page whose footer
  shows an address and opening hours, a Visit page whose own footer shows the
  phone 0117 000 1111, and an addition answering
  `contact: { phone: "0117 496 0000" }`. On `1e65c842` the addition was
  accepted, because the first page had no phone, and both pages changed: the
  Visit page's own number became 0117 496 0000. On the fix only the home
  page changes, and the Visit page keeps 0117 000 1111.
- **The fix**:
  - `frameNow` reads every page's contact details (`contacts`, one entry per
    frame, `null` for a frame with none) instead of the first one found;
  - `additionOnly` keeps a detail while some page's footer lacks it, and
    drops one that every footer already shows;
  - `applyChromeObject` takes `keep`, which fills only the fields a frame
    lacks; `runNavEdit` passes it for an addition, so each page gains only
    what it is missing. An ordinary edit writes every page as before.
- **Tests** (`test/frame-addition.test.mjs`), on three pages with different
  footers (home: address and hours; Visit: its own phone and address; Order:
  none):
  - `frameNow` reads each page's own details, not the first page's;
  - an added phone and email fill only what each footer lacks, and the Visit
    page keeps its own number;
  - a phone alone changes only the home and Order pages, and the Visit
    page's source is untouched;
  - the control: the same answer as an ordinary edit writes the phone on
    every page.
- **Red check**: on `1e65c842`'s menu editor, 3 of the file's 11 tests fail
  (the existing addition test, now given each page's details, and the two
  new ones); all 11 pass on the fix.
- **Not changed**: the request's digest still describes the first page's
  contact details as the frame's (`navDigest`). It tells the model what is
  there; the writing side no longer trusts it.

### 10.2 The batch's verdict, made strict (`dbc520f2`, `scripts/canary-additions.mjs`)

- **A route counts only as the model's own answer.** On a site the route
  falls back to `addon` (`FALLBACK_WITH_SITE`), so a record whose final
  intent was `addon` passed when the model had answered an edit and a
  fallback replaced it, or when the call failed. Each message now needs
  `decision.source` `model`, the model's own answer (`decision.raw.intent`)
  `addon`, and no `failed` or `failure`; a reply with no decision, or a
  decision with no raw answer, fails. Tested with nine records, each failing
  for a frame item and for the words: a fallback from an edit naming no step,
  a fallback from an unknown step, a fallback whose raw answer was an add-on,
  a failed call, a model source whose raw intent is an edit, a model add-on
  answer marked failed, one carrying a failure, no decision, and a decision
  with no raw answer.
- **A line must state its words.** "We're NOT closed on bank holidays"
  contains "closed on bank holidays". `states` requires the words whole, on
  word boundaries, with nothing before them in their own clause (back to the
  last `.` `!` `?` `;` or `:`) that denies them (`not`, `never`, `no`, `nor`,
  `without`, or a word ending in `n't`); a later occurrence still counts when
  an earlier one is denied. The text rung's reader skips a lone lowercase
  word, so `<strong>not</strong>` vanished from the page's text; the stored
  check therefore also reads the visible text of the span the page gained
  (between the parts it shares with the page before). The served check uses
  the same rule. Tested stored (NOT, `<strong>not</strong>`, aren't, never,
  no longer) and served (NOT, `<strong>not</strong>`, an escaped aren't),
  with a negation after the words that must still pass.
- **The frame's other fields are compared, not blanked.** The old check
  blanked the whole `const CHROME = {…}` object, so a changed business name,
  tagline, small-print link or arrangement passed. `withoutAdditions` now
  takes out only the additions' own places, with the menu editor's own
  writers (the menus' items, `applyNav(pages, [])`; the second button,
  `applyAction(…, "secondAction")`; the social links,
  `applyChromeList(pages, "social", [])`). Every page, the Visit page
  included, must keep the rest of its frame byte for byte (`frameText`: the
  frame object and the header and frame tags), and every page but the Visit
  page must match entirely. Tested with six changes, each failing: the name
  on the gallery page, the tagline on the home page, small-print links added
  on the order page, the arrangement changed everywhere, the name on the
  Visit page and the first button's words on the Visit page; the delivery
  alone passes.
- **Red check**: with the new helpers first added carrying the old logic (so
  the file loads), the four behaviour tests fail: the routing decision, the
  stored denial, the served denial and the frame fields.

### 10.3 The plan: the paid preflight, the controls first, nothing put back

§7 is rewritten: two paid presses, the routing controls first and then the
additions, each checking the deploy itself before its first paid call; no
free rehearsal and no restore, so the additions stay on the bakery. The
scenario's comment and the workflow's description say so
(`scripts/canary-ui.mjs`, `.github/workflows/edit-canary.yml`), and the
scenario's cost comment now gives the same figure as §7.

### 10.4 Verification

- **Sweeps**, each from a verified-green tree with comment-only controls:
  - `scripts/mutants/review-findings.json`, 13 mutants over the fixes, run
    with `test/frame-addition`, `test/canary-additions` and
    `test/site-contact`: 13 of 13 killed (F-1 the first page's details only,
    F-2 any one page showing a detail drops it, F-3 `keep` ignored, F-4 an
    addition written as an edit; C-1 a failure marked only by its reason,
    C-2 nothing a denial, C-3 no word boundaries, C-4 a denial anywhere
    before the words, C-5 the gained span unread, C-6 the frame not
    compared, C-7 everything taken out, C-8 the served words as a substring,
    C-9 the second button left in); both controls survived; the files were
    restored byte for byte.
  - `scripts/mutants/additions-batch.json`, re-anchored to the new verdict
    (the old route check is implied by the new ones, so it was replaced by
    one mutant on each new condition, with an isolating case): 20 of 20
    killed, both controls survived.
- **Full suite**: `8648 / 8648 / 0 / 0` locally on the candidate's code
  (seven tests more than `03e664aa`).
- **Unit tests, run 36969632740 on `dbc520f2`**: `8648 / 8644 / 0 / 4`, the
  same total (CI skips its usual four).
- **Image**: `a412daac10dbc936` on `main` → **`a4409e55d3f3eb09`** on
  `dbc520f2` (189 inputs, 159 paths; it was `b4f1e95939e15f16` on
  `03e664aa`). A merge rolls the container.
- **Site build, run 36969632759 on `dbc520f2`**: the gate printed *"ALL
  CHECKS: 404 checks in 27 sections across 4 shards, every job green"*, at
  inputs `5e086e2167f6637e` (3,967 files; `6a20f165b967aa9f` at `1e65c842`,
  because `builder/site-nav.mjs` is one). The other counts, from each step's
  log: TAP 397, kit-typecheck 4, contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47; kit-render, kit-a11y,
  kit-effects and kit-paint all passed.

### 10.5 What comes next

- **These fixes**: the owner's review, then the owner's word to merge and
  deploy, then the two presses of §7. Nothing is merged, deployed or spent
  without it.
- **Then, as a separate task, once these fixes are verified**: a
  whole-router audit across the build, the edit, the add-on and the internal
  hand-overs, for intent decided in code rather than by the model and for
  behaviour across different wording and kinds of site. Not started.
- **Still kept for the next round**: undo, conversation context and
  attachments (§8), and `lostPhotosMsg` (§8).

### 10.6 Merged and deployed: deploy 2179 (2026-10-02)

- **The owner's word**: *"The review of f9979497 passes. Merge and deploy
  these fixes, reusing the passing CI where its inputs are unchanged."*
- **Checked before the push**: `main` still `706c9b66`, an ancestor of
  `f9979497`; no Actions run in progress or queued; no edit job open
  (`edit_jobs`: only `done` and `failed`, and the two `lost` jobs from
  September; the newest row 2026-10-01 23:52 UTC); CI reused (unit tests run
  36970385602 on `f9979497` itself, `8648 / 8644 / 0 / 4`; site build run
  36969632759 on `dbc520f2`, whose inputs `5e086e2167f6637e` `f9979497`
  prints too); the image predicted on both ends (`a412daac10dbc936` →
  `a4409e55d3f3eb09`, 189 inputs, 159 paths); the rollback (reverting
  `706c9b66..f9979497` in a throwaway worktree gives `main`'s own tree,
  `991fe75d…`); and the served browser files read first (05:59 UTC:
  `chat.js` 790,308 bytes and `edit-poll.js` 30,203 bytes, both `main`'s).
- **A fast-forward of 11 commits**, `706c9b66` → `f9979497`, at 06:00:21
  UTC.
- **One deploy run**, 2179 (36971490099), `success`, the job 2m54s
  (06:00:28–06:03:22). The image was **built as predicted**,
  `a4409e55d3f3eb09` from 189 inputs (the registry answered 404); the
  container rolled `a412daac10dbc936` → `a4409e55d3f3eb09` at 06:03:16 UTC.
  Wrangler uploaded the 2 changed browser files and deployed the Worker
  with `DEPLOY_ID` `f9979497…`. The readings are in `docs/deploy-record.md`,
  *Deploy 2179*.
- **The served files are the merged ones**: `chat.js` (792,850 bytes,
  `accef38a…`) and `edit-poll.js` (30,805 bytes, `f789912a…`),
  byte-identical, first seen at 06:03:34 UTC.
- **Deployed, not runtime-confirmed**: the signed-in readers are the
  canary's. Press 1's preflight is the check, and it must read
  `f9979497` from both readers and `a4409e55d3f3eb09` from a cold
  container before any routing call.
- **The money and the bakery, read after the push**: balance 72, the
  ledger's last row 350, no job open; the bakery at
  `01790819484141-dgmag4`, `/visit` still showing its one photograph
  (`d5d59152….jpg`), F1's starting condition.

## 11. The validation batch, as pressed (2026-10-02)

### 11.1 Press 1: the routing controls, run 91 (passed)

The owner's press (*"ran first one"*): edit canary run 91 (36973396657),
06:24:29–06:26:53 UTC, from `main` at `f9979497`, spend `yes`,
`addition-fix-1`, with the deploy boxes filled.
- **The preflight, which is deploy 2179's runtime check, passed**:
  `build-health 200 deploy=f99794979e25 image=a4409e55d3f3eb09` and
  `runtime 200 deploy=f99794979e25 async=true runner=true`, so both readers
  answered `f9979497` and a cold container `a4409e55d3f3eb09`; the
  expected-build and expected-image checks both `ok`.
- **All eight controls matched their intended outcome, each the model's own
  answer** (`decision model`, reason `tables-filled`; no fallback, no rule):
  - X1, the "Order a loaf" button changed: `edit` · `nav`;
  - X2, "The starter" taken out of the menu: `edit` · `nav` · `remove`;
  - X3, the footer's opening hours changed: `edit` · `nav`;
  - X4, the Visit heading reworded: `edit` · `text`;
  - F1, the Visit photo swapped (attached; `/visit` showed exactly one
    photograph, as recorded): `edit` · `picture`;
  - B1, a new loaf without the word "add": `addon`;
  - C2, a colour change and a new footer link: `edit` · `look`, holding back
    exactly *"add our Instagram to the footer"*, one of the two answers the
    probe allows;
  - D2, two pages' backgrounds: `edit` · `look`, page none.
- **The summary line**: *"8 match (the model's own), 0 match only through a
  fallback or rule, 0 differ, 0 recorded only, 0 failed; reported cost 10
  credits"*.
- **The money**: 10 credits of routing (X1 3, the rest 1 each), as the
  canary read it before and after; read again in Supabase at 06:29 UTC: no
  ledger row after 350 and no job created, nothing open.
- **The bakery** is unchanged: `01790819484141-dgmag4` at 06:29 UTC.
- **What it shows**: after the fix, each of these existing-item edits, the
  photo swap, the new list entry, the mixed message and the two-page change
  still routes as before, by the model's own choice, once each. **Not**: how
  often, other phrasings, or anything delivered (nothing is acted on).

### 11.2 Before press 2: fal has no credits

- **The owner** (2026-10-02, after run 91): *"fal has no credits , just
  letting you know"*. So no photograph can be bought.
- **The bakery has its own sourdough photograph**: the home page shows
  `8e6bd4818b03….jpg`, *"A sourdough boule cooling after the morning bake"*
  (read from the served pages at 06:33 UTC; `/visit` shows the logo and its
  one photograph, `d5d59152….jpg`). The add-on's photo designer is told to
  use one of the site's own photographs whenever one shows what was asked
  (`src`, "PREFER IT WHENEVER ONE FITS"), so A5 is expected to place that
  one, with nothing bought.
- **If it tried to buy anyway**, the purchase would fail; for a photograph
  asked alone the add-on refuses after the page call with the no-photo
  sentence, at no cost for the step (routing only), and publishes no empty
  frame. A5 would then fail the batch's photo check, with the other four
  additions unaffected.

Press 2 (`12-additions`) was next, on the owner's press (§11.3).

### 11.3 Press 2: the five additions, run 92 (passed)

The owner's press (*"ran"*): edit canary run 92 (36974345843),
06:36:14–06:52:00 UTC, from `main` at `f9979497`, spend `yes`, the UI
scenario `12-additions` on `fold-lane-bakery`, with the deploy boxes filled.
- **The preflight passed again**: `build-health 200 deploy=f99794979e25
  image=a4409e55d3f3eb09`, `runtime 200 … async=true runner=true`, and every
  free check passed.
- **The five messages** were typed into the app's own composer, all in one
  tab that was never reloaded. **Each was routed `addon` by the model.** In
  every routing reply `decision.source` was `model`, the raw intent `addon`
  and the layer `none`, with the reason `tables-filled`.
  1. *"Add our Instagram to the footer: @harbourloaf."*
     - The add-on job `fbfac970…` handed it over (`reason layer`,
       `escalate`, `layer nav`, `kind frame`; cost 0, no billing).
     - The menu editor's job `29d8062b…` changed `index`, `order`, `visit`
       and `gallery` (cost 1).
     - On screen: *"✅ Added 1 social link to the footer, beside what it had
       — on 4 pages."*
     - Cost: routing 3 + 1 = 4.
  2. *"Add Order to the menu."*
     - Hand-over `1e1aacf8…`, then the menu editor `1cd85759…`.
     - On screen: *"✅ Added “Order” to the menu on 4 pages, beside the items
       it had."*
     - Cost: 1 + 1 = 2.
  3. *"Add a Call us button at the top that rings 0117 496 0000."*
     - Hand-over `131ef0da…`, then the menu editor `a735a941…`.
     - On screen: *"✅ Added a second button, “Call us”, going to tel:0117 496
       0000 — the button you had stays as it is — on 4 pages."*
     - Cost: 1 + 1 = 2.
  4. *"On the Visit page, add a line saying we're closed on bank holidays."*
     - The add-on job `94066f0c…` (kinds `words`) changed `visit.tsx`.
     - On screen: *"✅ Done — updated /visit, added “We're closed on bank
       holidays.” to /visit."*
     - Cost: 1 + 7 = 8.
  5. *"Add a photo of our sourdough to the Visit page."*
     - The add-on job `b4ae9ffe…` (kinds `photo`; `ownPhotos` on `/visit`,
       `photos 0`) bought nothing.
     - On screen: *"✅ Done — updated /visit, put one of your own photographs
       on /visit. I've set that up, but I can't confirm from here that A
       visitor can see a photo of the sourdough on the Visit page — have a
       look and tell me if it isn't right."*
     - Cost: 1 + 8 = 9.
- **Five publishes, in order, each built from the one before**: `9zslbu`
  (from `dgmag4`), `jdsbhx`, `eksk9o`, `yt8tva`, `bp9rcv`. The chain read
  VERIFIED. A watcher on the live pages saw each version arrive, at 06:40:26,
  06:42:53, 06:45:42, 06:48:29 and 06:51:37 UTC.
- **The verdict: `UI MODE PASSED`**, with every check `ok`:
  - **Routing and hand-over.** Each message arrived word for word and the
    model routed it to the add-on step. The three frame items were handed to
    the menu editor as additions, and the hand-over and the editor's success
    were stored and shown as a success. The line and the photo were made by
    the add-on step itself, with no edit.
  - **Files.** The same five page files exist before and after. The stored
    components are unchanged byte for byte. The frame was read on every page
    that has one.
  - **The frame.**
    - Every page's menu gained "Order" → `/order` and kept every item it
      had.
    - Every footer gained the Instagram link and kept every link it had.
    - Every header kept its button and gained "Call us", ringing
      01174960000, beside it.
    - The footer details are unchanged.
    - Every page but `visit.tsx` is byte for byte as it was, apart from the
      additions' own places.
    - Every frame keeps its name, tagline, first button, footer details,
      small-print links and arrangement.
  - **`visit.tsx`.** It still says everything it said and shows every
    photograph it showed. It shows exactly one more photograph, described as
    sourdough. It gained one line saying "closed on bank holidays" and no
    other words.
  - **The published pages** show the same: Order → `/order`, the Instagram
    link, Call us, the line and the photograph.
  - **The money closes**: routing 7 + jobs 18 = the balance's move of 25.
- **Read independently afterwards** (06:53–07:00 UTC):
  - **Supabase.**
    - Ledger rows 351–355 are all `edit reserve`: −1 under each of the three
      menu-editor jobs, −7 under `94066f0c…` and −8 under `b4ae9ffe…`. There
      is no refund and no row after 355.
    - The three hand-over jobs are `failed`, with no billing and cost 0.
      That is how a hand-over is recorded; it is not a failure.
    - The five working jobs are `done` and `finalized`, costing 1, 1, 1, 7
      and 8.
    - No job is queued or running.
  - **The stored source** (the evidence's before and after reads).
    - In each of the four pages with a frame, `CHROME` gained
      `secondAction: { label: "Call us", href: "tel:0117 496 0000" }`,
      `social: [{ network: "instagram", href:
      "https://instagram.com/harbourloaf" }]`, and `{ label: "Order", href:
      "/order" }` at the end of `links`.
    - `starter.tsx`, which has no frame, is identical.
    - `visit.tsx` also gained the `<p>` line under the opening hours, and a
      `SafeImage` under the shop's photograph. Its source is
      `/u/fold-lane-bakery/8e6bd4818b03….jpg`, *"A sourdough boule cooling
      after the morning bake"*, the home page's own photograph.
  - **The served pages.** All five were read at `bp9rcv` and compared with
    the 06:33 UTC reading at `dgmag4`.
    - The only differences are the additions and the rebuilt asset names.
      On `/starter` only the asset names and the render time differ.
    - The photograph answers 200 (1,777,447 bytes), and the home page still
      shows it.
  - **Screenshots** of `/visit` and `/`, before and after, were sent to the
    owner.
    - `/visit` shows all five additions.
    - The home pair shows the menu, button and footer additions. Its middle
      sections are blank in both captures, because they fade in on scroll
      and the capture does not scroll; the served HTML shows them unchanged.
- **The money: 25 credits, inside the estimate of about 19–41.** Routing
  was 7 (3, then 1 each). The jobs were 18: the three menu edits 1 each,
  the line 7 and the photo 8. Nothing was bought at fal (`photos 0`), as
  §11.2 expected.
- **Observations, kept separate** (backlog; nothing changed):
  - **The photo reply's capital letter.** It splices the requirement into
    its sentence with its capital: *"…confirm from here that A visitor can
    see…"*. The clause itself is the documented design: in
    `builder/site-requirements.mjs` every covered claim reads back with it,
    because nothing on this path exercises behaviour. Only the capital is a
    defect.
  - **Two 404 lines.** The app tab logged two *"Failed to load resource …
    404"* lines. The canary records only the app's `/api/` calls, all 200 or
    202, so the address is not known and has not been traced.
  - **Source layout.** The menu editor wrote each page's `links` list on
    one line and put the two new fields on `CHROME`'s first line. Both are
    inside the additions' own places and make no difference to the pages.
- **What it shows**: one wording of each of the five additions, on one site,
  each routed `addon` by the model once, delivered where asked, with
  everything else kept, published, and charged as recorded. **Not**: how
  often, other phrasings, other site types, or undo, conversation context
  and attachments (kept separate, §8).

The bakery stays at `01790923788063-bp9rcv`, because the plan keeps the demo
changes and makes no restore. **Both presses passed, so the validation
batch is complete.** The owner's review is next. After it comes the owner's
next separate task, the whole-router audit.
