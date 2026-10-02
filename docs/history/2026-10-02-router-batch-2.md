# The whole-router audit's batch 2: W5, W7, W8, W15, W24 (2026-10-02)

**On the branch `claude/help-needed-ehlwlj`, for review. Not merged, not
deployed, no live run.** Nothing was spent, no model was called, nothing was
changed on a site, and no container was built. Every outcome below is shown
with supplied model answers through the product's own code.

**The owner's order:** *"Batch 1's review gaps pass review; keep its
live-model confirmation pending. Start the next grouped fix for W5, W7, W8,
W15 and W24: preserve every part of a mixed request across routing
conversions, failures, edit/add-on handoffs and escalation to a full rewrite.
A conversion must not send the wrong half to the next executor; deferred work
must remain explicitly reported on every final outcome; a rewrite must not
silently execute deferred work; look changes must not disappear when an
addition is handed off; and the destination must receive the relevant scope
and reason for the handoff. Use a consistent handoff contract across these
paths, with models deciding intent and code validating and dispatching—no
keyword rules or site-specific exceptions. Add focused regression checks
covering successful delivery, refusal, failure and preserved neighboring
content. Run relevant checks and unit CI, update the audit and owner-notes,
and push for review. Keep deployment and paid runs pending so we can combine
the deployment and prepare one grouped live-validation batch with a cost
estimate."*

The findings, with their evidence, are in
`docs/investigations/whole-router-audit.md` (§3.2 W5, W7, W8 and W15; §3.9
W24). Each now carries a *Fixed on the branch* entry saying what changed and
what it does not cover. The grouped live-validation plan is the audit's §5.4.

## 1. One hand-over contract

Work moves between steps in five places: the router's reader turning an edit
into an add-on, one edit step handing on to another, the edit handing on to
the add-on, the add-on handing on to the menu editor, and the climb to the
full rewrite. Each carried something different, and the climb carried
nothing. Now every one carries the same three things
(`builder/hand-over.mjs`):

- **held**: the parts put off this turn, in the customer's own words. These
  are the router's part, and any part a step put off as the router's net. On
  the wire it is `alsoAsked`: a string for one part, a list for several
  (`heldList` in `builder/site-ask.mjs`). Every step it reaches takes the
  parts out of the message before anything runs (`heldParts`), and refuses
  at no cost when a part is not in the message. It never runs them. Every
  final reply names them (`deferred`).
- **scope**: the page the work is about, checked against the site's own
  pages, and the part of the site the step that handed it on could not do (a
  lane of the look step, or an add-on kind).
- **reason**: why it moved, from one fixed list (`HAND_REASONS`: the
  router's two conversions, every reason the edit route escalates with, and
  the add-on's own hand-over), and which step it left (`HAND_FROM`).

**Who decides what.** A model decided every part of the intent: the router
decides what is put off and which step runs, a lane picker decides that
something is an addition and which words ask for it, and the add-on's picker
decides what the addition is. Code checks only three things: that a field is
one of the fixed values, that a page is one the site has, and that a held
part is in the message. Nothing reads the customer's words to decide what
they meant. Nothing is coerced: a field of the wrong type is absent
(`String(["look"])` is "look"). A value that cannot be read is never read as
none: the step refuses, because running the whole message would run the
parts meant for later.

| Where work moves | Before | Now |
|---|---|---|
| The router's reader converts an edit (W5) | the held part was kept; the page and the reason were dropped | a plain edit of a page the site lacks keeps the held part and carries its page and reason (`page-unknown`); an answer the model did not decide drops the held part, so the step it falls to gets the whole message (`route-unreadable`, marked `also-dropped`); a removal or a move of a missing page stays an edit |
| The look step finds an addition (W15) | the whole message went to the add-on step before any lane ran | beside other work, the addition is put off by its own words and the rest runs; alone, it goes on with its page; with no words for each change, nothing runs and the customer is asked to send it alone |
| The edit hands on to the add-on (W24) | the held part only | the held part and `handOver {from, reason, field, page}`; the add-on checks the page and shows its picker one line from the fixed lists |
| A step climbs to the full rewrite (W8) | the whole message, held part included | the held parts and the hand-over; the rewrite takes the parts out before any model reads the message, and its page writer is shown the line |
| Every ending (W7) | `deferred` on a success only | every JSON ending of the edit, add-on and rewrite routes, the build route's deadline answer, and the row review's settled reply; the browser names the parts on every final outcome |

## 2. What changed, finding by finding

### 2.1 W5: a conversion no longer sends the wrong half on

- **Before**: *"Take the Events page off the site and add a page for our
  cake orders"*, answered `page` + `remove` for `/events` with the addition
  held back, on a site without `/events`. The reader turned it into the
  add-on and kept the held part. So the add-on step got *"Take the Events
  page off the site and ."* (a removal, which it cannot make), and put off
  the cake page, which it could make.
- **Now** (`readEdit` and `readRouting`, `builder/site-ask.mjs`):
  - **A removal or a move of a page the site lacks stays an edit.** The
    model's own fields say it takes a page away or moves it, and no addition
    does that. The page step answers with the site's real pages, at no cost
    for the edit, and names the held part beside it.
  - **A plain edit of a missing page is still an addition on that page**
    (the policy as it was). It keeps the held part, because that is the
    decision the part was made with. It now carries `handOver {from: route,
    reason: page-unknown, page}`, and the route's reply passes it to the
    browser.
  - **An answer the model did not decide drops the held part.** That is no
    step, an unknown step, or a page edit naming no page. Without a held
    part, the step it falls to gets the whole message rather than the half
    the model meant for another step. The trace marks it `also-dropped`.

### 2.2 W7: every ending names what was put off

- **Before**: `alsoTail` (`public/chat.js`) was called on two success paths
  only. A refusal, a failure or not knowing said nothing about the part put
  off.
- **Now**:
  - **The server.** The edit route, the add-on route and the full rewrite
    each pass every ending through one wrapper (`heldReport`). It adds
    `deferred` (the parts the request really took out, plus any a step put
    off itself) to the JSON reply it returns. The routes end in about a
    hundred places, and this way none can be missed and none added later can
    forget. The build route's own deadline answer gets the rewrite's parts
    too: the build registers them against the request's budget
    (`BUILD_HELD`). The row review's settled reply names what the first reply
    put off, in either shape, on both verdicts (§2.6).
  - **The browser** (`alsoTail`, `public/edit-poll.js`):
    - A readable reply speaks for itself through its own `deferred`.
    - With no readable reply, the browser names the parts it posted. That
      covers a body that cannot be read, a dropped connection, a job that
      ended with no stored reply, and `gone`.
    - On an ending that did not succeed, the sentence says the part was
      left, without claiming anything ran: *"I left “X” for later, so it
      wasn’t tried. Send that on its own when you’re ready."*
    - Several parts read *"I only did part of it this time. Say “A”, then
      “B”, and I’ll do those next."* on a success, and *"I left “A” and “B”
      for later, so they weren’t tried. Send each on its own when you’re
      ready."* otherwise.
    - The one-part success sentence is unchanged.
    - A reply whose `deferred` does not read is treated as unreadable, never
      half-trusted.
  - **A list survives a page refresh**: a job's resumable record keeps it.

### 2.3 W8: the full rewrite never runs work that was put off

- **Before**: a step that could not make a change climbed to
  `/api/site/react-revise` with the whole message, so the costliest step (a
  writer that rewrites every page) did what the customer had been told would
  wait.
- **Now**:
  - **The climb posts the parts and the hand-over.** It sends the parts put
    off (`alsoAsked`) and the hand-over (`EditPoll.handOver`, the same helper
    as every other hop), from the edit's climb and from the add-on's climb
    alike.
  - **The rewrite takes the parts out first** (`runSiteBuild`, `worker.js`),
    before the designer or the page writer reads anything. A part it cannot
    find is refused at no cost, with no model called (`held-unread`).
  - **The page writer is shown the hand-over line**, so it knows what the
    step before it could not do. The designer is not: its description
    becomes the site's.
  - **The rewrite's reply names the parts.**

### 2.4 W15: a look change is not lost when an addition is handed off

- **Before**: the look step's walls (`worker.js`) sent the whole message to
  the add-on step the moment the picker named something the site does not
  have (a QR code, a 3D scene, a page), before any other lane ran. *"Change
  the description and add a QR code for our menu"* changed no description.
- **Now**:
  - **Beside other work, the addition is put off exactly as the router puts
    a part off.** Its own words come from the picker's scope for it. They
    join the parts every ending reports and every later step takes out, and
    the rest runs. The same holds for a page addition beside a move. That
    branch used to return before the steps already built could run.
  - **Alone, the addition is the whole ask.** It is handed on as before, now
    with its page (`escalate("addon", {field, layer, page})`).
  - **With no words for each change, nothing runs.** If the picker's answer
    names the addition but gives no words for each change, the words cannot
    be separated, so the customer is asked to send the addition alone
    (`picker/addition-mixed`, 422, nothing charged for the edit).
  - **The removal door never hands on**: the router's own step is always
    other work there.

### 2.5 W24: the destination is told the scope and the reason

- **Before**: the edit's escalation named the part of the site and why, but
  the add-on post carried neither, so the add-on's picker started again from
  the message alone.
- **Now**:
  - **The browser posts the hand-over on every hop.** The destination's step
    and page, the reason, and the part of the site travel with it.
  - **The add-on route checks it** against the fixed lists and the site's own
    pages. A page the site lacks is dropped, except `page-unknown`'s, which
    is the page it is asked to make.
  - **The route records it** (trace mark `handover`) and shows its picker one
    line built from the fixed lists only. That line never contains words the
    customer typed or a model wrote: *"How this reached the add-on step:
    Handed on by the look step: the edit step was asked to add something the
    site does not have yet. The part of the site: qr. The page: /visit."*
  - **The edit route records a hand-over it receives**, too.

### 2.6 Found while recording: the row review dropped several parts

The row review stores its own reply over the step's first one
(`rowReviewReply`, `builder/site-add.mjs`), so it is the reply a returning
customer reads.

- **The defect**: it copied the first reply's `deferred` only when it was a
  string. Since a hand-over may put off several parts, a list was dropped,
  and the refund's reply never named any.
- **The fix**: both verdicts now read it with the routes' own reader. The
  reconcile in `worker.js` hands that reader in (`{ held: heldList }`),
  because the add step may import nothing of the router's module (the two
  paths' separation, held by `test/site-add.test.mjs`).
- **The guard caught a first version**: that version imported the reader
  directly, and the guard refused it. Unit CI on `391b5bd8` failed on exactly
  that case. The correction is `28690c06` (§4.4).

## 3. What the customer reads

Rendered from the real code: the real routes' replies with supplied answers,
composed by the browser's own reply code, in the chat's own thread markup and
stylesheet (cut from `public/chat.js` landmark to landmark), with the app's
own font. **The chat shows a reply's line break as a space, as it always
has.** The thread's `linkify` escapes the text and never turns `\n` into a
break.

- **W5** (`docs/edits/router-batch-2-missing-page-removal.png`), through the
  whole chain (the routing route, the browser, the queued edit route):
  *"⚠️ Your site doesn't have a /events page, so there was nothing to take
  off. Its pages are /, /visit and /gallery. Nothing on your site changed,
  and this edit cost you nothing. Reading your message cost 1 credit. I left
  “add a page for our cake orders” for later, so it wasn’t tried. Send that
  on its own when you’re ready."* On `ef158022` the same router answer became
  a paid add-on request running the removal half.
- **W15, mixed** (`router-batch-2-mixed-look-addition.png`): *"✅ Updated the
  look — the description. I only did one thing this time. Say “add a QR code
  for our menu on the Visit page” and I’ll do that next."* The description is
  stored and no code is made. On `ef158022` the browser posted the whole
  message to the add-on and said nothing about the look change.
- **Several parts** (`router-batch-2-two-parts.png`): the router's part and
  the look step's together: *"… I only did part of it this time. Say “add a
  booking form”, then “add a QR code for our menu on the Visit page”, and
  I’ll do those next."*
- **W15, words that cannot be separated**
  (`router-batch-2-addition-unscoped.png`): *"⚠️ Adding a QR code is a step
  of its own, and I couldn't tell which of your words asked for it, so I
  haven't changed anything. Ask for a QR code on its own, then for the rest,
  and I'll make each. Nothing on your site changed, and this edit cost you
  nothing. Reading your message cost 1 credit."*
- **W7, before and after** (`router-batch-2-addon-refusal-held.png`): the
  same request reaching the add-on route on both versions. The refusal is
  the same, and the branch adds *"I left “make the headings dark green” for
  later, so it wasn’t tried. …"*
- **The row review** (`router-batch-2-row-review.png`):
  - the first reply, which could not confirm the entry's save, names both
    parts as left for later;
  - the review that keeps the entry asks for them in turn;
  - a review that refunds names the part as left for later.

## 4. Checks

All free: no model, no network, no site, no money.

### 4.1 New tests (47 cases), and how many fail on the unfixed code

The red check ran in a worktree at `ef158022` (batch 1 with its review gaps;
the same code as `a0057c71`, whose unit CI counted 8,766), with every changed
test file copied in from the branch. Each file was also run in its base
version, so new cases are told from changed ones by name.

| File | New cases | On `ef158022` |
|---|---|---|
| `test/handover-operations.test.mjs` | 14 (22 in all) | all 14 fail |
| `test/handover-route.test.mjs` | 10 (22 in all) | 6 fail; 4 pass: two controls in both money paths (a part the route cannot find names nothing; a success names the part), which the old code already met |
| `test/edit-op-scope.test.mjs` | 9 (39 in all) | all 9 fail |
| `test/handover-batch2.test.mjs` | 12 (new file) | cannot load (its module is new). Run without the module, 4 of its 5 route and source cases fail and the control passes; its other 7 test the new module itself |
| `test/addon-row.test.mjs` | 2 (73 in all) | both fail |

**Of the 47, 35 fail on the unfixed code, 7 need the new module, and 5 pass
(the controls).** What they hold, as the owner asked:

- **Successful delivery**:
  - the look change made and the addition put off (sync and queued);
  - a page addition put off beside a move that ships;
  - a success naming the part;
  - the rewrite making the change it was given;
  - the add-on picker shown the hand-over;
  - the row review keeping the entry.
- **Refusal**:
  - the missing-page removal refused with the real pages (sync and queued);
  - the unscoped addition;
  - the add-on step's refusal;
  - a part the route or the rewrite cannot find;
  - a malformed `deferred`, `reason` or `field` not trusted.
- **Failure**:
  - an escalation (the stored pages unreadable);
  - an unreadable answer;
  - a dropped connection;
  - the rewrite's 402;
  - the build's deadline answer;
  - the review's refund.
- **Preserved neighbouring content**: every route case checks the stored
  pages (and the published ones, when anything published) byte for byte, and
  the look field by field.

### 4.2 Existing tests changed

Each keeps its property; the reason is in a comment beside it.

- **22 existing cases in 14 files fail on `ef158022`** with the branch's
  versions: re-anchored source pins and expectations the contract changed.
  - `add-goes-to-addon`: 2;
  - `addon-queue`, `edit-failure`, `handover-operations`, `removal-door`,
    `requirement-coverage`, `site-addon`, `site-apply`, `site-chat` and
    `topbar-layout`: 1 each;
  - `edit-poll` and `edit-reply-validation`: 2 each;
  - `site-ask`: 3;
  - `route-decision`: 4 (the page-unknown conversion, the dropped held
    part, a missing page's removal and move staying an edit, the route
    reply's hand-over).
- **Four harnesses** give their `EditPoll` stand-in the real module's held
  readers: `edit-list-sort`, `edit-page-target`, `site-entry-inventory` and
  `site-route-failure`. They pass on both versions.
- **`test/fixtures/addon-route.mjs`** posts an opt-in `handOver`.
- **`addon-row`'s `send`** takes an opt-in extra body (`alsoAsked`).

### 4.3 Mutation sweeps

`scripts/mutate.mjs`, each from a verified-green baseline, with comment-only
controls that all survived.

- **The contract**: 43 mutants over `hand-over.mjs`, `worker.js`,
  `site-ask.mjs`, `chat.js` and `edit-poll.js`, against the nine files that
  guard it (289 cases). All 43 killed, the 3 controls surviving.
- **The row review**: 5 of 5 in its first shape, then 7 of 7 in the final
  one, including the reconcile handing no reader in. The 2 controls
  survived.

### 4.4 Full suite and CI

- **Full suite, locally: `8813 / 8813 / 0 / 0`** (tests / pass / fail /
  skipped) on `28690c06`, 2m34s, with the sweeps finished and the tree clean
  of mutants. The base is 8,766 (unit CI run 36998606299 on `a0057c71`, the
  same code as `ef158022`), and the 47 new cases account for the difference
  exactly.
- **The first push, `391b5bd8`, was red.**
  - Unit CI run 37007899348: `8813 / 8808 / 1 / 4`. Locally `8813 / 8812 /
    1 / 0`, on the same case: `site-add.test.mjs`'s guard against the add
    step importing the router's module (§2.6).
  - Its site build was cancelled by the next push, as the workflow's
    concurrency group does.
- **Unit CI on `28690c06`**: run 37008479007, `8813 / 8809 / 0 / 4`, the
  same total as locally; CI skips its usual four.
- **Site build on `28690c06`**: run 37008478966, all 8 jobs green (each
  job's own conclusion). The gate printed *"ALL CHECKS: 404 checks in 27
  sections across 4 shards, every job green"* at inputs `ecda9a2f406edba4`
  (3,968 files; batch 1's `89971686f325b91a` had 3,967, and the one new file
  is the hand-over module). Contrast-cases read 16 passed, and kit-a11y,
  kit-effects and kit-paint all passed.

## 5. What this does not show

- **What a real model answers**:
  - how often the router puts a part off;
  - what a lane picker gives as an addition's words;
  - whether a real add-on picker or page writer uses the hand-over line
    well.

  The audit's §5.4 is the grouped live plan for these.
- **Deliberate limits** (each in the audit's finding entries and the
  backlog):
  1. An edit step handed work by another edit step records the reason on its
     trace, but its picker is not shown it. Only the add-on's picker and the
     rewrite's page writer see the line.
  2. The rewrite's designer is not shown the line, because its description
     becomes the site's.
  3. A signed-out reply (401) and a watch that gives up ("Reload…") add no
     held sentence.
  4. A readable reply without `deferred` names nothing: the browser trusts
     the server's own account of what it took out.
  5. A plain edit of a missing page still becomes an add-on, as it did, now
     carrying its page and reason.
  6. An addition beside other work, on a picker answer with no words for
     each change, refuses the whole message rather than guess the words.
  7. More than four parts (`MAX_HELD`) are refused as unreadable.
  8. A queued add-on swept before it answered has no stored reply, so the
     review's settled reply has no parts to name.
  9. When the router's answer is unreadable, its held part is dropped, so
     the step it falls to (the add-on) gets the whole message, held part
     included. The model did not decide, so the whole message is the honest
     input; the add-on's picker decides.

## 6. The container

Six image inputs changed over batch 1: the `Dockerfile` (which copies the new
module), `builder/hand-over.mjs` (new), `builder/edit-failure.mjs`,
`builder/site-add.mjs`, `builder/site-ask.mjs` and `worker.js`. So a merge
would roll the image. The roll is needed: the queued edit path, the one in
use, runs in the container. `public/chat.js` and `public/edit-poll.js` are
served by the Worker, not built into the image. Nothing was built.

**Predicted over every end** with `containerInputs` and `imageId`
(`.github/scripts/container-images.mjs`):

| End | Commit | Image | Inputs (distinct paths) |
|---|---|---|---|
| `main` | `f9979497` | `a4409e55d3f3eb09` | 189 (159) |
| batch 1 with its gap fixes | `ef158022` | `963a7d3ac5946579` | 189 (159) |
| this branch | `28690c06` | `4458b0613dcc79b6` | 190 (160) |

A merge would build `4458b0613dcc79b6`, carrying batch 1 and batch 2
together. After it, the rollout wait applies before any container work that
must run the new code.
