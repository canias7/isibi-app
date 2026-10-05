# Run 101's live check closed, and the four things found in its evidence corrected (2026-10-05, on the branch)

The owner, after run 101 (`2026-10-05-deploy-2184.md` §7): *"Close the
original live verification using run 101, clearly distinguishing the
successful outcomes from the weak closed-tab preview assertion and the
separate frame-load evidence. Handle the four newly observed issues together
in one focused correction batch. Preserve the preview iframe and its state
during chat/progress polling while still showing actual published changes and
updating progress; verify this through real browser behavior, including
iframe identity, load counts and preserved scroll or form state. Reconcile
reverted and changed outcomes after all operations finish so the reply model
receives accurate final facts: restoring an unrelated content change and
later adding a navigation link must not become contradictory whole-page
claims. Trace the invented confirmation-email requirement back through
planning and requirement reporting; ground requirements in the user's request
and necessary dependencies, keep optional suggestions distinct, and ask a
natural clarification when a meaningful choice needs the user. Do not add
email functionality to satisfy an invented requirement or introduce keyword
bans, site-specific exceptions or hardcoded customer replies. Correct the
closed-tab preview test to capture the reopened tab's own initial address
before reconciliation and prove the test fails when reconciliation is
disabled. Cover these shared behaviors with varied sites and requests,
preserve the passing routing, inventory, reply-placement and closed-tab
completion behavior, and push focused evidence plus required CI. Keep this
correction batch unmerged, with no deployment, container image build or paid
rerun yet; leave first Build, RW and unrelated backlog items outside
scope."*

**The corrections are on the branch only**: not merged, not deployed, no
image built, nothing pressed or spent. They are shown with supplied answers,
the real Worker routes and a real Chromium, not live.

## 1. The live check, closed on run 101

**Closed by the owner** (2026-10-05) on run 101 (`lv-reopen`,
`2026-10-05-deploy-2184.md` §7). The plan was
`docs/investigations/live-check.md`. Three kinds of evidence are kept apart.

**What run 101 showed live** (the canary's checks, agreed by the session's
own reads of the site and the ledger):
- **Completion with the tab closed**: message 1's request ended 560 s after
  its tab closed. Meanwhile it was read only through the requests list, and
  nothing read its route. The tab opened afterwards showed it ended, with
  every part's reply.
- **Reply placement, in run 99's own case**: the first tab's first look at
  the site's earlier requests came 76 ms after the send. All 5 requests' 10
  replies were drawn above message 1, and none after it. Each message's own
  card and replies came after it, and message 1's before message 2.
- **The table inventory**: message 1's routing answer named `loaves` and
  `orders`, every table the site had. Part 1's routing job was told all
  three tables. Once message 1 was done, the reopened page's tables held
  `bake_list`, added last, as the reconcile adds it. Message 2's routing
  call and its answer carried all three, and the page's tables were then
  the answer's.
- **The page inventory**: the reopened page's list held `/bake-list`. That
  list is also read from the server when a tab opens (`siteRoutesFetch`), so
  this shows the list was right, not which path made it right.
- **Message 2's preview refresh**: `?v=11` before the send, `?v=12` once the
  heading was done, loaded by that tab 19 ms after the page read the job's
  answer.
- **An edit and an add-on in one message**: the add-on made the page, the
  table and the menu links; the edit made the Visit heading. Every reply
  was the model's own and on screen.
- **The money**: 27 credits, exactly the press's own charges (ledger rows
  386–392).

**The weak assertion, not counted**: message 1's two preview checks ("given
a newer address" and "loaded the newer address") compared against the
address read before the send (`?v=0`). Within two seconds of the send, the
first tab's own first look at earlier requests moved its preview to `?v=9`,
and the reopened tab opened there. So in run 101 those two checks could not
have failed, and they are not evidence for message 1's refresh.

**The separate evidence for message 1's refresh**: the frame's load record,
read by the session and not by any check. The reopened tab opened at `?v=9`,
then moved to `?v=10` and to `?v=11`. Each move came within half a second
of the page reading the answer of one of message 1's two publishing jobs.
That is the reconcile, live, in the reopened tab.

**Still shown with supplied answers only** (the plan's §7): another
browser's addition finishing while a page watches; two routing calls out at
once, an older answer arriving after a newer one; a route whose own read of
the tables is unavailable; and the inventory's "none" and "cannot tell"
answers. A request the reader applies in its own tab (R1–R5, and message 2)
is live.

**What closes with it** (in the backlog until now):
- the placement fix and its two corrections (the watched refresh and the
  reconcile);
- a site never moved drawn at `?v=0`. Live, the first tab started at `?v=0`,
  and each of its nine moves changed the address;
- the route reading the site's whole table list.

**Still open**: an ended request's own reply with no record is asked for
whenever it is read, however old.

## 2. The preview frame survives polling (the first item)

**The cause**: the workspace is drawn by replacing its whole markup through
`innerHTML`, the preview `<iframe>` included (`renderSiteWorkspace`,
`public/chat.js`). It is drawn on every reading of a running request
(`siteRequestShow` → `renderSites`), and on every reply and progress step.
A new frame is a new load. Run 101's reopened tab asked for the same `?v=11`
17 times in message 2's two minutes.

**Measured in Chromium before writing anything** (a probe of the browser
alone):
- assigning an iframe's `src` the value it already has reloads it, through
  the property and the attribute alike. The comment above `sitePreviewSrc`
  said the opposite, and is corrected;
- a frame that stays in the document reloads nothing when its siblings
  change around it;
- a frame taken out of the document and put back reloads.

**The fix** (`public/chat.js`):
- **`paintWorkspace(view, html)`**: it applies when the new markup draws a
  frame for the same site (`data-site`) in the same place. Then every
  element from the workspace down to the frame is kept and given the new
  markup's attributes (added, changed and dropped alike). Everything beside
  that path is the new markup's. The frame itself is never touched.
- **Anything else is drawn whole, as before**: no frame now, a frame not yet
  pointed anywhere, none in the new markup, another site's frame, or a
  different shape.
- **`loadSiteFrame`** navigates only to an address the frame does not have.
  A real move always changes the address (`?v=`), so a published change,
  another page and Refresh still load.
- **A draft preview** (a site drawn from stored HTML) loads again only when
  the draft changed, or when Refresh asks (`again`). Its errors are cleared
  by a load, never by a repaint that kept the page.

**Measured on the real page**, the same probe on both versions (the repo's
`public/`, a bakery with a running request, the preview scrolled and typed
into, four readings of the request):

| | the frame element | loads of the same address | the scroll | the typed words |
|---|---|---|---|---|
| before (`d53caefc`) | replaced | 4 × `?v=0` | back to 0 | lost |
| after | kept | none | held | held |

**Tests**:
- **`test/preview-keep-browser.test.mjs`**: a real Chromium on the repo's
  own `public/`, every server answer supplied. It runs locally; unit CI has
  no browser and skips it.
  - KEEP 1 (a bakery's home page) and KEEP 2 (a teacher's site open on
    `/lessons`): each preview is scrolled and typed into while the page
    reads its running request at least four times, and its card moves from
    Queued to In progress. Throughout, the frame is the same element, it
    loads nothing, and the scroll and the words are held. Then the
    published changes load it in the same element, each load at a newer
    address and never two for one change, ending on the new page.
  - KEEP 3, a draft never published: repaints keep it, and Refresh reloads
    it.
  - KEEP 4: the Code tab and back, and another site opened, still get a
    fresh frame.
  - Run three times: 4 of 4 each time.
- **`test/preview-keep.test.mjs`** (CI): the real `paintWorkspace`,
  `loadSiteFrame` and `loadSitePreview`, against a small DOM stand-in that
  counts every node leaving the tree. It checks:
  - the frame and its path are kept and never detached;
  - attributes are synced, and the dropped ones removed;
  - the cases drawn whole;
  - an unchanged address and an unchanged draft are skipped;
  - the render paints through `paintWorkspace`.
- **`test/preview-reload.test.mjs`**: Refresh on a draft asks for it again.
- **Screenshots**, the same probe on both versions with the card "In
  progress". Before, the preview is back at its top and the name is gone.
  After, it is still on the form with the name typed.

## 3. What was put back and what changed, settled after every step (the second item)

**The cause**:
- the add-on's merge puts back a page the page writer changed though its
  part never named it (`reverted`);
- the code then puts the new page's link in every menu, that page's
  included (`changed`);
- nothing settled the two, so run 101's reply said "updated … Visit" and
  "The Visit page was left as it was".

**The fix**:
- **`settleReverted`** (`builder/site-addon.mjs`) is called where the answer
  is assembled, once every step has run, against the final sources:
  - a page byte for byte as stored stays `reverted`;
  - a page whose only change since is the menu link is `restored`, with
    the link's address (`to`). It reads the menu-link step's own record of
    the pages it changed (`aLinked`, `worker.js`);
  - anything else is neither, and no claim is made.
- **The replies say a restored page exactly**, in the reply facts
  (`builder/site-reply.mjs`), the server's composed reply (`addonReply`)
  and the browser's (`addonReplyText`): "On /visit, the only change is the
  link to /bake-list in its menu; nothing else there needed to change for
  this." None of them calls that page updated as a whole, or left as it was.

**Tests** (`test/addon-settle.test.mjs`, through the real route with
supplied answers):
- SETTLE 1, the rule itself, including junk and a link with no address;
- SETTLE 2, run 101's shape on the run-47 bakery: the writer's Visit change
  is put back and the link published, and every reply names only the link;
- SETTLE 3, a teacher's site whose menu is written the other way
  (`links={[…]}`), with two new pages: both links are named;
- SETTLE 4, the two cases where "left as it was" stays true: the page with
  no menu, and a link placed on a page instead of the menu.

## 4. Requirements grounded in the request (the third item)

**The trace** (run 101, from the code and the job's stored answer):
- **Planning**: every designer shares one requirement item
  (`REQUIREMENT_ITEM`), and it told them to read requirements off "what
  they asked for, including what the ask IMPLIES". The answer declared 6
  requirements: 4 `covered` and 2 `elsewhere` (its `coverage`). Among the
  covered was "The person who joins gets an email confirming they are on
  the list", tied to something this change made.
- **Reporting**: `requirementOutcomes` could only call it `unverified`: the
  thing was made, and nothing tied it to the claim. `requirementNote` then
  wrote "I've set that up, but I can't confirm from here that … The person
  who joins gets an email confirming they are on the list". The model's
  reply carried it on. Nothing sends such an email: the add-on made a table
  and a page.
- **Not read**: which designer declared it. The designers' raw answers are
  kept by `saveAddonAnswer`, in storage this session did not read.

**The fix**:
- **The item**: `basis` ("asked", or "needed": what they asked cannot work
  without) and `words` (their own words, copied) are required. The `need`
  wording no longer invites what the ask "implies", and sends an extra to
  the suggestions instead.
- **`groundRequirements`** (`builder/site-requirements.mjs`) runs in the
  route after each designer.
  - **An entry is kept** when its basis is one of the two and its words are
    in what they wrote: this part's words, and every answer they gave to a
    question about it. An entry that answers a hand-off already kept is
    kept too.
  - **Everything else is set aside**, and kept for the record only
    (`ungrounded`, with why). It is never counted, never handed on, and
    never reported as set up, unconfirmed or missing.
  - **No word is banned**: the same rule holds for a booking, a list or a
    gallery, in any language.
- **Suggestions**: the designer's tool has a place for extras
  (`suggestions`), which nobody designs or builds. They are kept apart,
  carried on the answer and in the record, and offered once as an idea, in
  the reply facts and in both composed replies. They are never claimed. The
  field's wording gives no example of an extra, so it steers no designer
  toward any one. A first draft used run 101's own email as its example, and
  it was taken out before the commit.
- **A real choice**: the requirement and suggestion wording send a choice
  only they can make to the question every designer already carries. The
  route asks it, and changes nothing until they answer. That path existed
  already.
- **Not done**, by the owner's rule: no email added, no word lists, no site
  exceptions, no fixed reply. The composed replies gained general sentences
  built from the results (the restored page and the suggestions), in the
  pattern they already follow.

**Tests** (`test/addon-grounding.test.mjs`, through the real route with
supplied answers):
- GROUND 1, the rule: case, punctuation, another language, half a word, a
  basis it does not know, and hand-offs;
- GROUND 2, the tool's own wording, on every designer that answers
  requirements;
- GROUND 3, run 101's bake list: the email set aside and offered as an idea,
  nothing that sends mail made, and the cover note and both replies about
  what was asked only;
- GROUND 4, a teacher's booking: a real dependency kept, and an invented
  text-message reminder set aside;
- GROUND 5, a Spanish café's contact page: their own words, an invented
  confirmation set aside, and an answer they gave counted as theirs;
- GROUND 6, a yoga studio's paid-or-reserved choice: asked, with nothing
  designed, applied or charged.

**The harness**: the add-on route's test designers predate `basis` and
`words`. An entry carrying neither is answered grounded in exactly the
message the route showed that designer, as a designer quoting the whole
request would, so every earlier case still says what it said. A case with
either field is left as written, and a case can ask for no grounding at all
(`ungrounded`).

## 5. The closed-tab preview check, corrected (the fourth item)

**The fix** (`scripts/canary-ui.mjs`, `scripts/canary-requests.mjs`): the
driver captures the reopened tab's own first address, the first its frame
asked for, before the page's first look could move anything
(`away.reopened.firstFrame`, with the tab's number). A message sent with its
tab closed is judged against that address, and the run log prints it.

**Proven**:
- **The stand-in app in run 101's shape** (CI, `test/canary-requests.test.mjs`):
  the first tab moves its preview nine times after the send, and the
  reopened tab opens at `?v=9`. With the reconcile, both checks pass.
  Without it, both fail. The old baseline passed both.
- **The real page in Chromium** (`test/canary-reopen-browser.test.mjs`,
  local): the first tab's first look reconciles an earlier job and moves
  to `?v=1`, and the second tab opens there.
  - With its reconcile, it moves to `?v=2`, and both checks pass (REOPEN 1).
  - With its reconcile cut (`siteReqRefresh` made to do nothing, in the
    `chat.js` served to the second tab alone), it stays at `?v=1`, and both
    checks fail (REOPEN 2). The address read before the send would have
    passed them.

## 6. Verification

**The red check**: the new tests and the changed behaviour tests, run
against the previous commit's code (`d53caefc`) in a separate worktree.
- **`preview-keep-browser`**: KEEP 1, 2 and 3 fail at their first check:
  after the readings the frame is a new element. (The probe behind the
  screenshots measured the rest on that code: 4 loads of the same
  address, the scroll back at 0, the typed words gone.) KEEP 4 passes, as
  it should: a fresh frame where one is right was true before.
- **`preview-keep`**: fails, because `paintWorkspace` does not exist there.
- **`preview-reload`**: 1 of 10 fails (Refresh on a draft does not ask for
  it again).
- **`canary-requests`**: 2 of 47 fail.
  - LV IN RUN 101'S SHAPE fails on its subject: the old baseline passes a
    message with no reconcile.
  - LV on the old page fails only because a check's name changed. Its
    subject, the old page failing, holds on both.
- **`canary-reopen-browser`**: REOPEN 2 fails (the cut reconcile passes
  there). REOPEN 1 passes, as it should.
- **`addon-settle`, `addon-grounding` and `requirement-coverage`**: fail at
  their import, because `settleReverted` and `BASES` do not exist there.
  Their behaviour is shown red by the sweep's mutants instead (S1–S10,
  G1–G18).

**The sweeps** (`scripts/mutate.mjs`, from a green baseline, each with
comment-only controls that must survive):
- **Over the CI tests** (`scripts/mutants/run101-corrections.json`, 9 test
  files):
  - the first run killed 40 of 42 mutants;
  - P5 survived: a dropped attribute was not tested. A case was added;
  - G17 survived: the cleaner kept a basis the model made up, and the rule
    accepted it. `groundRequirements` now checks the basis itself, both
    points are tested, and G18 was added;
  - the rerun killed **43 of 43**, and the 3 controls survived.
- **Over the real-browser tests** (`scripts/mutants/run101-browser.json`:
  `preview-keep-browser`, `canary-reopen-browser`,
  `request-refresh-browser`): 9 of 12 killed, and the 2 controls
  survived.
  - **P4, P5 and P9 survived.** They drop the attribute sync on the frame's
    path (P4, P5) and the shape check (P9).
  - **The real page does not reach those cases today.** The one attribute
    on the path that changes, the stage's `data-dev`, is set directly by
    its own control. The rail and mobile-panel classes are set the same
    way. So the next repaint's markup already agrees, and no repaint
    changes the path's shape while the same site's frame is drawn.
  - **They are guards**, and the CI sweep's `preview-keep` kills all three.
  - The browser's reply composer (S9, S10) is in the CI sweep only, where
    `addon-settle` kills both.

**The suite**:
- the first full run was `9502 / 9499 / 3 / 0`. The three failures were
  guards this change tripped:
  - a landmark in `mobile-panel` (the render now ends in `paintWorkspace`);
  - a phrase `site-add` forbids in a designer's tool ("You design");
  - `site-add`'s list of the tool's properties (now with `suggestions`);
- the guards were corrected, the description reworded, and the two sweep
  gaps closed;
- then `9502 / 9502 / 0 / 0`;
- the suggestions field's example was then taken out (see §4). The four
  files that read that tool passed, 96 of 96, and the CI sweep was run again
  on the final code: 43 of 43 killed, and the 3 controls survived;
- the final run, on the tree as committed, is `9502 / 9502 / 0 / 0`. The
  new browser cases run here (Chromium is installed), and unit CI skips
  them.

**CI** on `936295a5`:
- **Unit tests** (run 37371311515): `9502 / 9490 / 0 / 12`. The totals
  match. CI skips its usual 6, and the 6 new browser cases (KEEP 1–4,
  REOPEN 1–2), which need Chromium.
- **The site build** (run 37371311514) is **not green, and no check in it
  failed**:
  - five of its seven jobs passed: shards 1–3 (341 checks in 19 sections),
    the kit and generator checks, and the published-site checks;
  - the other two, the theme checks and shard 4, never started. GitHub
    gave them no runner ("The job was not acquired by Runner of type
    hosted even after multiple attempts") and cancelled them at 20:56 UTC;
  - so the gate (`all checks`) failed, naming those two jobs and shard 4's
    8 sections, which ran 0 times: fonts, colour-override, row-value,
    edit-shapes, salvage-stub, render-check, comment-boundary and stopping;
  - its inputs are `9833608b1323318a` (3,972 files);
  - **it needs its failed jobs re-run**. That is free, and it is the owner's
    press: the session cannot re-run a job.

**The image** (predicted, not built): `589e3e4e85a20066` at `d53caefc`
(deploy 2184's) becomes `1df286f23782ff82` on this branch. There are 194
inputs, none under `public/`, and five differ: `builder/site-add.mjs`,
`builder/site-addon.mjs`, `builder/site-reply.mjs`,
`builder/site-requirements.mjs` and `worker.js`. A merge would build it,
and nothing was built.

## 7. Not done

- **Not merged, not deployed, no image built, nothing pressed or spent.**
- **Not shown live**: the frame kept through polling, the settled reply, the
  grounding and the suggestions, and the corrected baseline. A live check
  would need the owner's word.
- **First Build, RW and unrelated backlog items** are outside this batch.
