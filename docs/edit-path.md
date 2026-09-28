# The edit path: what an edit may add, what the page rung preserves, the lanes, renaming

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). CLAUDE.md keeps the
> ladder table and a summary of what the edit path does now. The rounds that
> built each mechanism after 2026-09-21 are in `docs/history/`; the short
> edit-path checklist is the top of `docs/investigations/edit-path-checklist.md`.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections.

### ADD ALWAYS GOES TO THE ADDON STEP (owner, 2026-09-02)

*"Add will always go in addon"*, and the one carve-out is the owner's too:
*"tsx does exist tho, is literally everything on the page, it could be changing
a component, is changing tsx."* **The line is at the THING, not the page**: does
what the customer names exist on the site now? It does — EDIT changes it. It
does not — ADDON makes it. Until 2026-09-02 the router said the opposite in as
many words, because the line sat at the page. Four hops, each guarded:

- the router's wording (`site-ask.mjs`) — the English word IS the question;
- **a wall at the edit route's PICKER** (`ADD_ONLY_FIELDS = ["qr","three"]`,
  `hasLookField`): a picked field the stored look lacks escalates `addon`. At
  the picker and NOT in the look step — the first draft sat after the look
  step's `no-look` and `three` is a dispatched lane that never runs that step.
  `tsx` is deliberately off the list. **A config read that fails lets the lane
  run**: cannot-tell must never read as nothing-there;
- **the browser's `escalateAction` answers `addon`** for that layer. Before
  this, every escalate that was not a sideways hop fell to `up` — the
  ~25-credit full revise — so the middle rung was unreachable from an edit;
- **the addon step keeps what it designs** (`mergeLook` + `readCss`, the page
  call told the bindings, the look STORED just before the publish and reverted
  on a failed one). **And it no longer refuses a site without a database** — the
  `look`/`logo` dead gate again, one step over: a first build provisions none,
  so `no-backend` had sent every "add a QR code" on most of the platform to a
  rebuild.

### WHAT THE EDIT'S PAGE RUNG PRESERVES (2026-09-20 → 09-21)

Eleven defects, each reproduced through `POST /api/site/<slug>/edit` before it
was fixed, each now asserted on the designer's input, the compiler payload, the
stored inventory and the browser's own sentence.
`test/edit-page-{context,photos,protect}.test.mjs`, `test/edit-parts.test.mjs`
and `test/edit-browser-reply.test.mjs`.

**⚠ FIVE OF THE ELEVEN ARE DEFECTS IN THE FIX FOR THE FIRST PHOTOGRAPH ONE, and
that is the shape worth keeping**: each shipped with a green suite, a sweep and
an entry in this file, and each was reported back by the owner off the shipped
code. The protection's *mechanism* was right every time; what was wrong was the
SCOPE it applied to, the COVERAGE it claimed, the number of LISTS it looked at,
**the RUNG it was attached to, and the REACH of the sentence it refused with**.

**⚠ AND THE FOURTH ROUND IS THE ONE WITH A GENERAL LESSON: THE PROTECTION WAS
BUILT ON THE RUNG THAT ANSWERS SECOND (2026-09-21, owner: *"Successful tweaks
bypass protection"*).** `runTweak` is tried FIRST and unconditionally, and on
`tw.ok` it published and returned — three hundred lines above every guard. So
*"make the heading bigger and keep both photographs"* came back with the larger
heading and one emptied `src`, shipped it, and reported the loss afterwards:
the exact behaviour two rounds had already closed on the rewrite, still live on
the path most messages take. **A guard on the FALLBACK is a guard on the case
that does not usually happen.**
- **THE CONTRACT IS NOW ONE CONTRACT**, asked before `publishStep` on both
  rungs: restore what can be restored, refuse what cannot (409 `withheld`,
  cost 0, `photosBlocked`), and `withheldPhotosMsg` is ONE composer so the two
  refusals cannot drift into describing one outcome differently.
- **THE COMPONENTS GO ON BOTH SIDES THOUGH A TWEAK CANNOT TOUCH ONE** —
  `runTweak` takes one page's source and answers one page's source, so they are
  equal by construction; they are passed because `keepPhotos` is SITE-WIDE and
  a photograph the page drops that a component still shows must not be put
  back.
- **A TWEAK THAT IS A NO-OP ONCE THE PICTURE IS BACK FALLS THROUGH**, and that
  is NOT the rewrite rung's *"the only thing that change would have done"*
  refusal: there the expensive writer has had its go, here it has not, and the
  fall-through is what that branch exists for. `twSpent` carries the call's
  tokens into the rewrite's bill.
- **⚠ AND `alt` TEXT IS PROSE, WHICH DECIDES WHICH BYPASSES REACH THIS RUNG AT
  ALL — MEASURED, and it is not what the general contract predicts.** `proseOf`
  reads a picture's description as words on the page, so of the three bypasses
  the previous round named, **DELETE the element and RENAME its description are
  refused by `sameProse` as `reworded`** and never get past `readTweak`;
  **SUBSTITUTE another url is the one that arrives**, and it is what the
  withheld case drives. A case built on a deletion would be green about a path
  it never took, so the census is asserted rather than commented.
- **⚠ AND THE TEST FILE'S OWN HABIT WAS THE BLIND SPOT.** Every case in
  `edit-page-protect.test.mjs` stubbed `write_tweak` with `{cannot}`, because
  each was written about the rewrite — so all of them drove the fallback and
  not one drove the path a customer takes. *"Test this with `write_tweak`
  succeeding; forcing it to decline misses the defect"* is the owner's own
  wording and it names a property of the harness, not of the product.

**⚠ AND A RUNG'S REFUSAL DOES NOT SPEAK FOR THE WHOLE REQUEST (2026-09-21,
owner: *"Partial-success wording makes whole-site claims"*).** The picture rung
took the window photograph off as asked, the page rung withheld a second change
it could not make safely, and the screen read *"✅ Took the picture off "the
window". ⚠️ … so I left your site exactly as it was."* — a picture HAD just come
off. Both halves true of their own rung and the second **false of the request**.
- **THE CAUSE IS THAT A RUNG CANNOT KNOW.** It is one step of a message that
  may run several, its neighbours run after it, and `editOutcomes` prints its
  sentence VERBATIM beside whatever shipped — correctly, because the rung is
  the only side that knows why it stopped. What it does not know is what ran
  beside it.
- **SO THE SENTENCES END AT *"so I didn't make it"*** — true of the rung
  whether it stood alone or beside six others, which is what makes one string
  safe in both places — **and *"Nothing on your site changed, and this edit
  cost you nothing."* is added by `wholeRequestNote` on the browser's
  complete-refusal branch**, the one reader that can see `ok: false` for the
  whole reply. That is not a guess: the merge sets `ok` from `ranOk.length > 0`,
  so a reply reaching that branch had no rung succeed and published nothing.
  (Re-worded 2026-09-23: *"you haven't been charged"* was false beside a billed
  routing call; the routing charge is its own sentence now.)
- **TWO CONDITIONS, EACH WITH ITS OWN JOB**: `e.ok` is the property (it may
  never fire on a reply that shipped, asked in the composer rather than trusted
  from the one call site), and the SCOPE is **`unchanged === true`** — the rung
  (or, on a merge, every step) saying it wrote nothing — **or the older
  `error === "withheld"`**. Widened 2026-09-23 from `withheld` alone, when the
  classification gave every explained refusal the flag; a refusal that cannot
  say it wrote nothing still gets no whole-request claim.
- **⚠ AND FOUR GUARDS WERE PINNED TO THE OLD SPELLING**, two in each of the
  protect and photos files: `includes("left your site exactly as it was")`.
  They assert a PROPERTY — the customer is told nothing changed — and are
  re-anchored to `"Nothing on your site changed"`, which is where that claim
  now lives. *This file's single most repeated own-goal, met four times in one
  correction.*
- **THE CENSUS WIDENED TO THE ENTRY POINT'S OWN CALLS, AND DELIBERATELY NO
  FURTHER.** `wholeRequestNote` is reached from `editAnswer`'s REFUSAL branch,
  which the transitive walk from `editReply` — the SUCCESS composer — cannot
  see. **Rooting that walk at `editAnswer` was tried and MEASURED: it demands
  36 further functions** (`siteEdit`, `watchEditJob`, `siteAddon`, `sitesSave`,
  the whole build-panel closure) **which the harness does not cut ON PURPOSE** —
  they are injected as recorders and stubs, which is what makes `actions` a
  record of what the screen would do rather than the screen doing it. A census
  demanding those be cut would assert the opposite of the design. The property
  is the entry point's own direct calls: three today, all cut.

- **`readSiteParts`'s THREE STATES REACH THIS RUNG.** `loadSiteParts` collapses
  "no components" and "the read threw" into one `null`, and
  `mergeParts(null, [one])` answers `[one]` — so a transient R2 failure
  published ONE component and deleted the rest. The addon's shape, on the
  caller that never moved: `partsSent` answers `unreadable`, every returned
  component is refused, the merge hands over `null`, and the spine re-sends the
  store's own copy.
- **ONE SNAPSHOT PER MESSAGE, ADVANCED BY `publishStep`.** `components` and
  `tsx` both dispatch to `page`, so one sentence could run the rung TWICE (since
  2026-09-23 only when another rung's step sits between them — neighbouring
  page lanes are one step, `mergePageSteps` — and then only when the first did
  not succeed, `pageStepDone`; the snapshot's live reader beside a page step is
  now a later PICTURE step, which reads `editParts()` too) — and each run re-read the STORE. `publishStep`'s rule is "a later list wins", so the
  first rung's work was overwritten by the second rung's merge of the original:
  step one ran, was charged for, reported success, and shipped nothing.
  `editParts()` is the message-wide read and `publishStep` advances it exactly
  as it advances `eSrc` — **the pages never had this bug because `eSrc` is this
  variable one field over**.
- **⚠ THE `text` RUNG'S VERSION WAS WORSE AND IT REFUSES NOW.** Its empty list
  is REAL rather than absent: `editableFiles(eSrc, null)` presents the pages
  alone, `splitEditable` answers `parts: []`, and both the spine's preference
  and its save take that at face value. **Measured through the route: reply
  `{ok: true, applied: 1}`, payload `parts: []`, and `source/<slug>/parts.json`
  REWRITTEN TO `[]`** — every component deleted by a one-word wording change.
  503 `parts-unreadable`, **above the model call**, cost 0, nothing written.
- **THE PAGE WRITER GETS WHAT `briefWithLayout` HAS ALWAYS TAKEN** — `parts`,
  `partsUnreadable`, `theme`, `css`, `plan`, all five omitted, so the one call
  on this path that rewrites a whole page was that function's blindest caller.
  The plan is scoped to the TARGET page and takes `modules`, never `kit`.
  **⚠ THE SCOPING IS THE `[wantRoute]` INDEX, NOT THE `[target]` ARGUMENT** —
  `pageComponents` answers a map keyed by route, so both give the same entry;
  the argument saves a walk. A sweep mutant said so.
- **THE PROMPT STOPS TELLING A PHOTOGRAPHED SITE IT HAS NONE.** A bare
  `images: 0` renders as *"PHOTOGRAPHS: none on this site … that is the
  intended look here"* — false on every site with any, and the last two clauses
  are an instruction to STRIP them. Driven on a site showing two, on a request
  that asked to keep them: both came back with an empty `src`. `images:
  {shown: shownPhotos(photoInventory(…)), place: false}` — **the budget did not
  move; no `buy` key IS the zero.**
- **⚠ THE PHOTOGRAPH GOES BACK — REPORTING IS NOT PRESERVATION (2026-09-20,
  owner).** The first cut of this rung detected the loss, PUBLISHED it and
  named it: *"keep both photographs and change the opening hours"* shipped
  `src=""` and a note about it. `keepPhotos` restores the attribute **from the
  file's own previous source**, so it can only ever put back a picture the site
  was already serving from that exact place — there is no url it could invent
  and `strayPhotos`' concern cannot arise. **The identity is the `alt`**, which
  is `PICTURE_TOOL`'s own rule rather than a second idea of what makes a
  picture the same picture. **Four refusals to guess**: a slot holding a
  DIFFERENT picture is an ANSWER and is left alone; `src={row.photo}` is a
  binding; an `alt` two slots share is skipped on either side; and **a
  photograph the answer still shows SOMEWHERE is never put back** — that last
  one is not local, because `keptImages` is deliberately site-wide and a
  per-file restoration would meet a legitimate MOVE and publish the picture
  twice.
- **⚠ AND AUTHORISED REMOVAL STILL WORKS — BUT THE PERMISSION IS A STATE AND
  NEVER A FLAG (corrected 2026-09-20, owner: *"`ePhotoAsk` disables protection
  globally"*).** The first cut asked whether the MESSAGE had a picture step at
  all, which is a judgement about the sentence made by a rung that cannot see
  WHICH picture was meant — so *"remove only the window photograph; keep the
  bench photograph"* turned the protection off for every picture on the site
  and published both missing. **The scope is `eSrc`**, the site as THIS rung
  finds it: the picture rung publishes through `publishStep`, which advances
  `eSrc`, so a photograph it really cleared is already gone from the before
  side and there is nothing to put back, while one it did not touch is still
  standing and is protected. *"Permission belongs to the operations that
  matched, and the state is where those are recorded."*
  **⚠ AND THE RUNNING ORDER IS WHAT MAKES THAT TESTABLE.** `LANE_FIELDS` puts
  `shape` (12) and `components` (11) BEFORE `images` (13) and `tsx` (17)
  AFTER, so only an `images`+`tsx` message runs the picture rung FIRST — and a
  red check proved that mutating the before side to `eSrcAt0` survived every
  case until one drove that ordering. **The two readings are equal by
  construction whenever the page rung goes first**, which is most messages.
- **⚠ RESTORATION IS NOT COVERAGE, AND A LOSS IT CANNOT REACH REFUSES THE RUNG
  (corrected 2026-09-20, owner: *"Do not publish the loss merely because
  matching failed"*).** Everything `keepPhotos` does needs a slot to write into
  and a description to match on, so a writer that **DELETES** the element,
  **RENAMES** its description or **SUBSTITUTES** another url walks straight
  past it — and the previous cut then published the loss and named it
  afterwards, which is the behaviour the round before that was meant to end. A
  match that never happened is indistinguishable, from outside, from a file
  that had nothing to protect. So `keepPhotos` answers `lost` as well as
  `restored`, over the same accepted publication, and a loss left standing is
  **409 `withheld`, cost 0, `photosBlocked: n`** — nothing compiles, neither
  store is written, and the customer is told how to authorise it. **NOT an
  `escalate`**, which would buy the ~25-credit rewrite of every page to protect
  one photograph.
  **THE LINE THAT STILL SEPARATES THIS RUNG FROM THE ADDON'S IS THE WORD
  *UNRELATED*, not the word *refuse*.** There a lost photograph is 422
  `lost-photos` at cost 0 on a step whose contract is *"an addition is always
  a new thing"*; here a removal the picture rung really made ships and is
  REPORTED. Three refusals with three sentences and they are not
  interchangeable: a reachable loss that is the change's whole content
  (*"the only thing that change would have done…"*), a loss we could not put
  back (`photosBlocked`), and a component we would not rewrite unseen
  (`keptParts`).
  **`photosRemoved`, NOT `lostPhotos`**: the addon's field is a LIST of urls on
  a refusal that published nothing (`Array.isArray` in its own harness) and
  this is a count on a change that shipped — `Number([…])` is NaN, so one name
  over two shapes makes the browser's clause silently never fire.
- **⚠ AND THE GUARD TAKES BOTH LISTS IN ONE CALL (corrected 2026-09-20, owner:
  *"Moving an image from the page into a component publishes it twice"*).** It
  ran once per list, so each call's site-wide rule was only half site-wide: the
  pages call saw an empty `src`, could not see where the url had gone, and put
  the old copy back beside the component that now carried it. **One call,
  `{pages, parts}` on both sides, ONE `shows` set over the union** — which is
  what makes *"a photograph the answer still shows SOMEWHERE is never put
  back"* true rather than aspirational. It is asked of the **ACCEPTED
  publication**: the target page folded into the site's own list, and the
  components the wall admitted, so a refused component cannot be protected and
  a page nobody publishes cannot count. And **both its outputs go on to
  publish** — `pGuard.parts`, not the unguarded merge, or a `src` written back
  into a component is silently dropped.
- **AND `photosKept` IS THE PROTECTION'S RECEIPT, INTERSECTED WITH WHAT SHIPS.**
  A customer cannot otherwise tell the builder nearly took them off. It is
  **not a sum of the rungs' own counts**: the page rung puts a picture back,
  an AUTHORISED picture rung further down the same sentence takes that same
  picture off, and the sum then prints *"the 2 photographs are still there"*
  beside *"one photograph is no longer on the site"* — two sentences about one
  publication, disagreeing. `ePhotosHeld` is a set of URLS across the message,
  intersected below the loop with what the publication really shows; urls
  because only an identity can be intersected, and they never reach the wire.
- **THE EMPTY FRAME IS COUNTED BY A FRAME READER.** `photos` was
  `countImageSlots`, which counts `@@IMG:` TOKENS on a rung whose directive
  forbids them — zero on every obedient answer, so `photoNote` never fired.
  `newEmptySlots(before, after)`, token counter behind it. **`countImageSlots`
  now has NO caller in `worker.js` at all** (asserted, over blanked comments,
  because the note explaining the move names it): both paths ask the frame
  reader, which sees a swept token AND a frame the model simply wrote.
  **Both readers take `imageSources(pages, parts)`**: a photograph
  can live in a component since the band split, and reading the pages alone
  answers a smaller inventory, which is an invitation to strip what is not in
  it. A sweep mutant survived until a case put a picture in a component AND
  lost it — **the untouched-component case cannot tell the two apart**, because
  `keptImages` reports only what the BEFORE had and the AFTER lacks.
- **⚠ AND BOTH COMPARISONS ARE ASKED ONCE, BELOW THE LOOP (2026-09-20, owner:
  *"avoid reporting intermediate changes that the final publication
  reverses"*).** Each rung used to answer about its OWN output — and
  `components` and `tsx` both dispatch here, so rung 2's "before" was rung 1's
  output: a frame rung 1 left and rung 2 removed was reported on a publication
  that does not have it, and the merge's first-body-wins rule carried exactly
  that number to the customer. **The two ends that are really comparable are
  `eSrcAt0`/`ePartsAt0` and `pendingPublish`**, and both exist only below the
  loop. `ePartsAt0` falls back to **`[]` and never to the store**: an
  unreadable store publishes no components, so both sides empty is the reading
  that says *nothing moved*.
- **⚠ AND THE WARNINGS DID NOT SURVIVE THE MERGE AT ALL.** `merged.layer` is
  `"look"` whenever more than one rung SUCCEEDED, and `editReply`'s look branch
  read none of `keptParts`, `unseenParts`, `photosRemoved` or `photos` — **the
  facts were on the wire the whole way and none of them on the screen**.
  `editOutcomes` is ONE writer (every field is absent on an ordinary edit, so
  the sentence is byte-identical where they do not apply), and the merge takes
  a **UNION**: the catch-all copies a key from the FIRST body that has one and
  skips every later rung, so a second page rung's withheld component could
  never arrive.
- **⚠ AND THE SAME COMPLAINT CAME BACK A THIRD TIME THROUGH THE FAILURE PATH
  (2026-09-20).** `editOutcomes` was called from TWO of `editReply`'s ELEVEN
  layer branches — the two the previous round drove — and a message that runs
  several rungs lands on whichever layer SUCCEEDED. So a rung that FAILED
  beside one that shipped was written to **`partial`, which had no reader
  anywhere in `chat.js`**. **MEASURED through the real route**: "take the
  window photo off and rewrite the cards", where the picture rung succeeds and
  the page rung withholds a photograph it could not put back, answered
  `layer: "picture"` and the screen read *"✅ Took the picture off “the
  window”."* and stopped. **The SITE was right** — the bench survived, the
  window went, the withheld half published nothing — **which is what makes it
  a reporting defect and exactly the kind that ships unnoticed.**
  **THE FIX IS ONE HOP, NOT ELEVEN**: `editReply` is a wrapper that appends
  `editOutcomes` + `photoNote` + `problemNote` ONCE above the switch, and
  `editReplyBody` holds the eleven branches. Every clause is absent on a reply
  that does not carry its field, so every other branch's sentence is
  byte-identical — *the widening costs nothing where there is nothing to say,
  which is what makes one hop safer than eleven*. The recovered reply is
  exempt: it has no layer, no pages and no fields. **The partial clause opens
  with a warning inside a reply whose first character is a green tick**, and
  prints the rung's **own sentence verbatim** (never re-composed from `error`,
  which would be a second copy of every refusal's wording); over two it counts
  the remainder, and a failed rung with **no** sentence is still counted —
  *nothing at all* is the outcome the clause exists to close. **⚠ That last
  clause was true only when EVERY failed rung was silent**, until 2026-09-23:
  beside one with a sentence the silent one vanished, byte-identically (*the
  mixed partial*, in the classification section). Counted in both now.
  **AND THE HARNESS CAUGHT THE WIRING, AS DESIGNED**: `editReplyBody` was not
  on `EDIT_BROWSER_FNS`, so the reader threw `editReplyBody is not defined`
  and reported **NO** screen rather than a wrong one.
- **⚠ A CHANGE A PROTECTION WITHHELD IS NOT A NO-CHANGE (2026-09-20, owner).**
  An oversized stored component, an unchanged page back and a replacement for
  the component the wall withheld: nothing differed, so the rung answered
  `escalate("no-change")` — **which `escalatedEdit` turns into the ~25-credit
  rewrite of every page**, to avoid rewriting ONE component unseen, with no
  sentence reaching the screen. **409 `withheld`, cost 0, naming the
  component**; nothing compiles and neither store is written. The
  discriminator is a positive test on this route's own three lists
  (`pKeptParts`, `pUnseenParts`, `pRestored`) — all three are US declining to
  write something. ~~A GENUINE no-change still escalates and the rewrite still
  starts~~ — **REVERSED 2026-09-23**: a genuine no-change is `page/no-change`, a
  sentence at no cost (a rewrite of every page is no evidence it would do
  better). The control that keeps the ladder honest moved to
  `test/edit-failure.test.mjs`, which drives the climbs that remain.
- **⚠ THE HARNESS WAS READING THE WRONG COMPOSER.** `browserReply` runs
  `addonAnswer`, the ADD route's selection; an edit reply goes through
  `editAnswer` → `applyEditResult` → `editReply`. The add composer does not
  throw on an edit body — it answers a PLAUSIBLE `"✅ Done."` — so an assertion
  pinned to it passes whatever the edit screen does. **MEASURED: a reply naming
  a page, a lost photograph and two picture spaces came back as three words.**
  `editBrowserReply` runs the real selection, refusal branches included, and
  its function list is censused from `editReply`'s own body — a clause whose
  composer is not cut is a `ReferenceError` that reports NO screen rather than
  a wrong one.

### THE EDIT PATH IS ITS OWN PATH (2026-08-29)

Owner: *"it should be 2 separated path tho"*, and on what the edit step IS:
*"customer says edit this, and booom you go edit it"* — pure action, no design
round. **`look` used to call `designSiteSchema`** — the BUILD's function, tool
and system text — to change one colour on a live site: **84,817 characters** of
instructions for inventing a business from nothing. **And the two framings
fought**: the build's `css` description opens "ONLY WHEN ASKED… OMIT this field
entirely unless", which an edit reads as *don't touch the stylesheet*. Now
**`builder/site-lanes.mjs`, which imports nothing from `worker.js`**:

```
customer ──► pick_lanes ──► edit_site ──► publish
             2,811 chars    one per lane   ONCE
             21 names       1 property
```

**Twenty-one lanes and EVERY ONE ACTS.** `pick_lanes` runs ABOVE the layer
dispatch, so it is the front door for all of them. **DERIVE THIS LIST, DO NOT
TRUST IT** — it has gone stale twice: `node -e` over `site-lanes.mjs` and print
`LANE_FIELDS`, `OWN_LANES`, `DISPATCHED_LANES`, `VERB_LANES`, `ESCALATE_LANES`,
`UNBUILT_LANES`. **FOR A FIELD'S LAYER, CALL `laneLayer(field)` — NEVER READ
`LANE_LAYER`**, which is keyed by GROUP, so indexing it by a field name answers
`undefined` for three lanes that dispatch perfectly well.

- **10 act here** — `css theme brand description wordmark favicon qr lang langs
  behavior`. **Every one but `css` must be on `EDIT_FIELDS`** — the lane reads
  `priorLook[field]` and writes through `mergeLook`, so a lane missing from that
  list bills and changes nothing, silently, at both ends.
- **9 dispatch** — `images`→`picture`, `action`→`nav`, `backend`→`rules`,
  `slug`→`rename`, `shape`/`components`/`purpose`/`three`/`tsx`→`page`.
  **Neighbouring page lanes on one page are ONE page step** (`mergePageSteps`,
  2026-09-23): the page rung reads the sentence, not the lane names, so two of
  them were one operation run twice. **Across another rung they stay two steps
  in their order, and the later one runs only when the earlier did not
  succeed** (`pageStepDone`).
- **1 verb lane** — `pages`: `remove` and `move` are the `page` rung, `add` is
  the addon route. **No default** — an unreadable verb refuses, and this is the
  ONE place where the bias inverts, because a wrong guess takes a page off a
  site. **The verb rides on the `pages` step itself** (`{remove, rename}`, and
  the router's own step carries the router's): `runLayer` reads the STEP's, so
  a layout lane picked beside it never inherits a removal or a move
  (2026-09-23).
- **1 escalates** — `kind`→`build`. A rebuild is what it IS.
- **0 unbuilt.** The five groups are a **total, disjoint partition**. **A
  dispatched lane must never target `look`** — that is the door it came through.
- **ALL SIXTEEN REMOVABLE LANES CAN BE TAKEN OFF, not nine** (**re-derived
  2026-09-20 by DRIVING `removalRefusal` over all 21 `LANE_FIELDS`: 16
  removable, 5 refused, the partition holding** — the file had said FIFTEEN in
  two places and both were stale; `NOT_REMOVABLE` is the only gate, so the
  count is `21 − 5` and never a list somebody typed). The removal verb
  lived inside `eLayer === "look"`, so six dispatching lanes never reached it:
  nothing failed and the STORED field kept saying the site had the thing.
  `DOOR_LAYERS` is derived from the two meanings collapsed into one constant.
  **`page` is NOT widened and must never be** — `remove` there deletes the page.
  `NOT_REMOVABLE` is `backend · lang · slug · kind · purpose`.
  **On a door the router opened for its OWN `nav` or `picture` removal, the
  picker is asked a different question** (on the branch, not merged, 2026-09-28;
  *Test 5*): it is told the routed change in the router's own words and answers
  `additional` (other work, the only list that makes steps) and `routed`
  (recorded, never run), and the router's step runs exactly once. The look
  door's request is unchanged byte for byte.

**A RULE PER LANE, IN FOUR NAMED PARTS** (owner: *"i want a rule per everysingle
one of them"*): `is` · `yours` · `wide` · `keep`, and only `wide` is genuinely
per-field — it names how THIS field gets over-answered. `css` gets a token where
a rule was asked for; `brand` gets a name improved instead of copied; `lang`
gets the site TRANSLATED. Structural, not prose: `laneRule` THROWS if a part is
missing.

**THE CONTRACT IS TWO OPPOSITE HALVES AND THEY MUST ARRIVE TOGETHER** (owner:
*"it's free css — the model can edit anything on the page… but when they ask one
thing, you only edit one thing"*): **unlimited in WHAT** (the sheet is the whole
look and nothing on the page is out of reach) and **strict in HOW MUCH** (as
many edits as there were asks and never more; each only as wide as it was asked;
nothing unasked-for moves). Either half alone misleads. **Stated as the
mechanism, never as a ban-list** — a list covers tonight's control and the next
request is always a different one.

**THE WALL, NOT THE RULE.** A `css` lane cannot re-theme or rename a site
because its tool has one property and there is nowhere to put the answer. A rule
in prose is one a model eventually reads past.

**ONE PUBLISH PER MESSAGE.** The eight branches call `publishStep`; the spine
runs once below the loop. `eSrc` carries forward between rungs; a config
snapshot taken before any rung runs is restored if that publish fails.
**Measured: 5,606 of tool for a colour change against 89,195, still 1 credit** —
`pageCredits` is variadic and rounds once with a floor of 1.

**A LANE'S OUTPUT CEILING IS WHAT ITS FIELD CAN STORE.** `laneMaxTokens(field)`
derives from `FIELD_STORE_CAP` — **the refusals themselves and never a second
list** — at three characters per token with a quarter of slack. **It can only
ever REDUCE**: wordmark **16,000 → 3,334**, favicon **→ 1,667**, everything else
untouched. A pre-existing gap is named: `MAX_CSS` is 60,000 characters and the
shared ceiling expresses about 48,000; an overrun is a NAMED failure.

**AND THE CEILING WAS NEVER THE BINDING CONSTRAINT — run 40 disproved it.** The
next `wordmark` ask came back a THIRD timeout at exactly 240,000 ms, cost 0.
**The tell is which failure came back**: a bound ceiling stops with a
`max_tokens` stop, and this stopped with a TIMEOUT. *Lowering a budget truncates
a long answer; it cannot make a slow one finish sooner.* **THE BINDING
CONSTRAINT IS THE WIRE**: `QUICK_CALL_MS` is 240 s only because the egress hangs
up an IDLE connection at ~270 s, and **streaming is what stops it being idle**.
Two hops: `callBuilderModel`'s Worker wrapper FORWARDS `opts` (it had dropped a
fourth argument the module has taken for months — the wiring trap, found by a
live timeout because every guard drove the MODULE), and `quickSend` passes
`{stream: true}` and clamps a queued call to `QUICK_STREAM_MS` (480,000). **The
synchronous path keeps 240 s deliberately** — off the queue the bound is the
CUSTOMER'S connection (~273 s). **480,000 is a chosen bound, not a measured
one.** **PROVEN by run 41**: `lane:wordmark` ran **292,336 ms and FINISHED**,
where runs 11, 12 and 40 were each cut at exactly 240,000 for nothing.

**EVERY SMALL CALL FOLLOWS THE PICKER, NOT A HARDCODED MODEL.** `BUILD_MODELS`
has a third slot, **`quick`**, equal to the picker's own model. **WHAT IT COST
TO LEARN**: run 93 bought a `css` edit and got a **503 in 5.3 seconds having
spent nothing**, because every cheap rung was pinned to `claude-haiku-4-5` and
Anthropic refused on billing — *the platform's cheap ladder was entirely behind
one provider while its expensive half was not*. Two guards, and **the second is
the one that matters**: a source scan for a pinned id (comments blanked), and
`picked-model.test.mjs`, which DRIVES each runner with a sentinel and reads the
request that would have gone out. Only the second caught `routeMessage` taking a
`model` and never passing it on.

**Every prompt in there is a PLACEHOLDER** and marked so (owner: *"i will tell
you the prompt later"*).

### RENAMING A SITE IS AN ALIAS, NOT A MOVE (2026-08-29)

`slug`→`rename`, and **nothing moves**. A slug keys five Supabase tables, seven
R2 prefixes and one dispatch script; R2 has no rename, so a "real" move is a
loop of PUTs with no transaction — a copy that dies halfway leaves the site half
at each address with nothing to roll back to. **And the move needs everything
the alias needs anyway**: either way the platform must remember the old name
belongs to this site, because customers print it (we generate **QR codes**
pointing at it) and the old name has to stay CLAIMED.

**THE STORAGE SLUG AND THE PUBLIC ADDRESS CAN NOW DIFFER, and nothing may assume
they are equal.** `slug` stays the storage key — every R2 prefix, every table,
the dispatch script, and `SITE_SLUG` baked into the page (which addresses the
site's own API). The one place the distinction is load-bearing is the canonical
link and `og:url`, both baked into the R2 sidecar at publish time. Two hops
carry it, and until 2026-09-02 neither existed: (1) `publicUrlFor(env, slug)` is
the ONE reader of the public address — both publish sites had handed
`siteUrlFor` the STORAGE slug, and `publicNameFor` had no consumer at all;
(2) the rename lane patches that one sidecar key the moment the alias is current
— **the R2 write IS the deployment** — and no longer republishes.

- `site_aliases (alias PK, slug, uid, current)`, with **one current name per
  site enforced by a partial unique index** rather than by us. Proved by
  INSERTING a second current row and watching Postgres refuse it, not by reading
  `pg_indexes`.
- **A rename settles everywhere within five minutes**: the alias caches are
  300 s per isolate and only the lane's own isolate forgets at once.
- **The cache rule INVERTS from `hostRoutes`.** There a miss is rare and must not
  be cached; here the miss is every site that has never been renamed, so not
  caching it would put a Supabase round trip in front of every page load. The
  miss is cached as `NO_ALIAS`; a lookup that FAILED caches nothing.
- **AN OLD NAME CAN BE FORGOTTEN** (owner: *"isnt when you do the change the old
  one is gone?" … "yea i want that"*). "Forget the old address X" deletes that
  name's row: the address stops answering (a 404 that is never cached) and the
  name is free. **A deliberate second step, never a side effect of a rename**,
  because it cannot be undone once somebody else takes the name. **One request
  both checks and deletes** — `DELETE
  site_aliases?alias=eq.X&slug=eq.<site>&current=is.false` with
  `return=representation`. **The storage name is the one label a deleted row
  cannot make disappear**, so `resolveAlias` has a fourth case: no row AND the
  site this label names answers to another name → gone.
- **The bias inverts here too**: a message with no name in it is REFUSED, never
  guessed, because the old address 301s forever after. `cleanAlias` refuses
  rather than repairs — the first draft turned "déjà vu café" into `dj-vu-caf`.
- **The code still degrades cleanly if the table goes away**: `aliasRowFor`
  answers null on any read failure and `resolveAlias` reads a null row as "no
  alias", so the platform falls back to its old behaviour rather than erroring.

