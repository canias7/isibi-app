# Backlog: open items

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). These are the open
> items as CLAUDE.md held them. The one-line index
> CLAUDE.md kept moved here in the second pass (`git show 28bdc97f:CLAUDE.md`)
> and is the first section below.
>
> **Add a new open item here, with a one-line title in the index below. When
> an item closes, record the closure where the work is recorded and take it out
> of both.** The older `docs/backlog-100-next.md`, `backlog-100-more.md`
> and `backlog-1000.md` are the July–August lists and are not kept current.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## The one-line index (CLAUDE.md's backlog list, as it stood)

The open items in full are `docs/backlog.md`. **Add a new one there and a line
here; take a closed one out of both.**

- A half of a message the router puts off (`alsoAsked`) is still attempted,
  on the home page, and the reply contradicts itself (run 52). **Fixed and
  deployed 2026-09-29 (deploy 2166); run 57 made both changes live, with
  nothing put off (Test 6, closed by the owner). The held-back path ran live
  in Test 8's run 63: the held-back words reached no executor, cost nothing,
  and were named in the reply.**
- Five stylesheet rules match nothing the app serves, and the reachability
  guard counts them live only through a router sentence's line break.
- The header's button carries no `data-slot="button"`, so a rule against the
  kit's button hook misses it.
- The render check judges each selector of a list on its own, so a common
  heading rule can force a correction round.
- No look-door lane describes a menu item, so a menu link taken out beside
  another change can be missed (Test 7's routing review). **Corrected
  2026-09-29 (the menu editor's lane now describes the menu's items), merged
  and deployed in deploy 2168 and runtime-confirmed by run 62; shown live by
  Test 8's run 66, where the real picker placed the menu change on that
  lane.**
- A change a scoped picker answer leaves out is dropped without a word.
- The saved-version list labels a two-change publish with its first change
  only: run 66's `li1j0y` reads "Take Gallery out of the menu." (seen in run
  67's restore list; where the label comes from is not traced; kin to review
  #9). Found 2026-09-29, not changed.
- The data picker is told both to delete a row and to return nothing when
  asked to delete; a live row removal is likely refused. Found 2026-09-29
  while preparing Batch 1. **Corrected 2026-09-30 (Lane 1a, `19f6e480`),
  merged and deployed in deploy 2171 (its code runtime-confirmed under
  deploy 2172 by run 76); shown with supplied picker answers only. The live delete is prepared (the checklist's
  *Lane 4's delete*), not run.**
- An added row's reply reads "Updated one entry in added to <table>." Found
  2026-09-29, not changed.
- Which step adds a row to a list the site already has is undecided: the
  router sends an addition to the add-on step, and the data picker can insert
  (the owner's ruling). Found 2026-09-29.
- ~~The router says nothing about the order of a list~~: decided (2b,
  2026-09-30), its scope corrected 2026-10-01, and merged and deployed in
  deploy 2174: a sort across the whole site is `data`, one limited
  to a named page is `page`, and a selection of pages is never sent to the
  sorter.
- A page-limited sort, or a selection of pages, that reaches `data` anyway
  is applied on every page (the sort lane has no page scope); only the
  router's instructions keep it away. Found 2026-09-30, the selection
  2026-10-01, not changed.
- The look picker is told of no lane for a list's order, so which lane a
  real picker names for a selection of pages is unknown. Found 2026-10-01,
  not changed.
- A selection of pages costs the full writer on each page (the quick writer
  declines list changes). Found 2026-10-01, read, not measured.
- The look door's reply for a selection of pages names neither page
  (*"✅ Updated the look."*). Found 2026-10-01, not changed.
- The quick writer sends "a change to what the page LISTS" to `cannot`, so a
  one-page re-sort may cost the full writer. Found 2026-09-30, read, not
  measured.
- A one-page re-sort through the quick writer does not say the list is shown
  on other pages; the full writer's reply does. Found 2026-09-30.
- A hand-picked order ("put the Walnut Levain at the top") is told "I
  couldn't match that to anything the site stores". Found 2026-09-30, not
  changed.
- A data-step job's row reads `routing` until it publishes (run 84: from
  18 s to 112 s, while it sorted, compiled and checked). Found 2026-10-01,
  observed once, not changed.
- **The add-on step cannot add a row to a table the site already has**: no
  kind inserts one, and a table's seed fills only an empty table. Test 11
  waits on it. Found 2026-10-01 (supplied answers). **Built on the branch
  the same day: the add-on `row` kind (not merged, not shown live).**
- The seed-skip sentence drops its reason: "loaves: already has rows" is
  told as "isn't one visitors can read, so it starts empty". Found
  2026-10-01 (supplied answers), not changed.
- The add-on route's test fixture reads every table as empty (its existence
  probe answers no rows), so a seed into an existing table looks inserted.
  Found 2026-10-01. **Addressed for the new tests**: a stateful database
  fixture with rows (`test/fixtures/rows-db.mjs`), taken by the route
  fixture opt-in; its own default is unchanged.
- The edit canary cannot press an add-on: it refuses unless the router
  answers `edit` with a layer. Found 2026-10-01 (read). **Built on the
  branch the same day**: with the route box `intent=addon` it posts the
  add-on request (not merged).
- The add-on `row` step's known limits: a database with no `_meta` table
  cannot take an entry; a value its column cannot read is told as a generic
  write failure; one `_meta` key per request is never removed; a list named
  in another letter case is refused, as the data step refuses it. Found
  2026-10-01 building it, not changed. **After the owner's reviews of
  `f6532d66`, `31741f6f` and `c3e310e6`** (an unknown outcome is settled
  from the key; a queued job writes only after the ledger's own gate,
  `edit_may_publish`, has said it is still eligible and has begun its write,
  asked before and after its key is recorded): a site with a row job under
  review refuses new messages with the general "stopped while publishing"
  sentence; inline (queue switch off only) nothing pauses the site, so a new
  message can add a second entry, and an entry nobody could confirm is never
  charged; a definite refusal under a job is refunded through the review; a
  consumer that dies after the gate holds its site until its publish lease
  runs out; a consumer that resumes after the review refunded its job parks
  it once more, settled again at once. In full under *THE ADD-ON `row` STEP'S
  KNOWN LIMITS*.
- ~~No route test drives a successful sort to its publish~~: covered
  (`test/edit-list-sort.test.mjs`, both paths, 2026-09-30).
- A natural message cannot hand the picture step a new photograph without
  buying one from fal. Found 2026-09-29, not changed.
- A routing call that fails records no reason: Batch 1's run 70 got `addon`
  with `failed` at cost 0, and nothing says why. Found 2026-09-30.
  **Corrected 2026-09-30 (Lane 1b, `fe20e6cd`, with `d19652c4` and
  `ce992066`), merged and deployed in deploy 2171 (its code
  runtime-confirmed under deploy 2172 by run 76): the answer carries
  `failure`, from allow-lists only,
  and the canary prints it.**
- A price put back to its old value was routed `text`, not `data`, with no
  table names sent (Batch 1's run 74); the same change forward was `data`
  (run 71). One sample each. Found 2026-09-30. **The missing names are
  filled in (Lane 1d, `a02c2003`), merged and deployed in deploy 2171 (its
  code runtime-confirmed under deploy 2172 by run 76). First live reading,
  run 77: the route told the real router four table names (`tablesFilled`),
  and it answered `data` for a row taken off the list. That is one sample of
  a different request; the put-back itself has not been sent again.**
- The owner's Data button can be dark for a site whose database link is
  blank: the site list reads `db` from `neon_db` alone. Found 2026-09-30.
  **Corrected 2026-09-30 (Lane 1c, `b12dd43b`, `bd81a60e`), with the three
  hops behind it (adoption, the owner routes and the panel's text); merged
  and deployed in deploy 2171 (its code runtime-confirmed under deploy 2172
  by run 76). The owner's fresh-browser read of the Data panel is the live
  check.**
- When the site list itself cannot be read, a card drawn from this
  browser's own record that never learned `backend` still says "No database
  yet" (the local record's missing flag is read as a no). Pre-existing,
  found 2026-09-30 during Lane 1c, not changed.
- The backend lookup's KV log line prints a KV error's message, and the
  routing call now reaches it through Lane 1d. Pre-existing (`bd63040c`),
  found 2026-09-30 in Lane 1's log review. **Corrected 2026-09-30 on the
  owner's review (`ce992066`), merged and deployed in deploy 2171 (its code
  runtime-confirmed under deploy 2172 by run 76): the line names the
  operation and a known error class
  only.**
- The build, edit and add-on error replies carry the provider's type as
  `upstreamType`, shape-checked but not from a list of known codes. Found
  2026-09-30 in the owner's review of Lane 1b, not changed.
- A row taken off a list has two claims in the router's instructions:
  `look`'s removal clause ("TAKING SOMETHING OFF THE SITE IS THIS LAYER,
  whatever the something is", a whole page its one exception) and `data`'s
  one-row clause. Neither names a row. Found 2026-09-30 while preparing Lane
  4's delete; read in the code, not measured. **Corrected 2026-09-30 on the
  owner's word (`4e3ef512`), merged and deployed in deploy 2172
  (runtime-confirmed by run 76): a stored row taken off is `data` in both clauses and in
  `look`'s reach; shown with supplied answers, and once live: run 77's real
  router answered `data` for "We don't do the Ten-minute tune-up any more,
  please take it off the price list." (one sample).**
- A paid data press runs whether or not the row it names exists: nothing in
  the canary reads the fixture before it spends. Run 77, the delete test,
  was pressed before its temporary row was added: routing cost 2, and the
  job found no such row (`no-match`, its reserve refunded). Found
  2026-09-30. **Corrected on the branch the same day, on the owner's word
  (`3229272e`, pushed for review, not merged)**: the opt-in `expect_rows`
  box reads the table as the site's own read serves it and judges the
  baseline and the target row before any routing call. **The owner's review
  found it believed any 200 list** (a read leaving a row out passed);
  `fc06edde` makes the read prove it is the whole table by the Data API's
  count contract, and stop at no cost when it cannot. The owner passed that
  review (2026-09-30); merged and deployed in deploy 2173 (`8908b59d`), whose
  runtime run 78 confirmed with the box blank, so the guard has not yet run
  live. A setup that is not as named stops at no cost. `docs/history/2026-09-30-fixture-check.md`.
- A menu removal beside a layout move on another page is answered `nav` with
  `remove` and the move held back, against the router's own `alsoAsked` rule
  (Test 8, run 63). **Corrected 2026-09-29 (the router chooses one answer
  over the whole message, by what a route can make on every page, never by
  kind); merged and deployed in deploy 2170 and runtime-confirmed by run 65;
  run 66's real router answered `look` for the same message, with nothing
  held back (one sample); Test 8 closed by the owner 2026-09-29.**
- The menu editor's other parts (footer details, social icons, small print,
  links in the copy, how the header sits) are described by no look-door lane.
- What the picture step cannot take off on its own is refused: a photograph
  held by a larger block, written inside code, or with children; an emptied
  wrapper with a meaning of its own is kept, and can leave empty space.
- The quick writer stores the model's whole file as written, so whitespace
  outside the change can differ from the page it was given (run 60: the home
  page lost its final newline, accepted for Test 7 alone as a nonfunctional
  exception).
- A look reply's `changed` lists only the steps that name their files; the
  quick writer names none (run 60).
- The kit's `StoryLead` always draws a picture, so a page that gives it none
  shows an empty frame (the bakery's home page, before and after run 60).
- Redirects dropped between 2026-08-17 and deploy 2165 are not rebuilt.
- A page removal does not see a QR code that points at the page.
- The branded not-found page is thrown away on every Start site.
- The rules reply shows literal asterisks around the table name.
- Closing a table leaves the site inviting it, and the refusal is generic
  (`lido-axes-b`; a separate UX gap).
- The logo reply says "on every page".
- The thread's message bubble does not show an attached picture.
- The canary's job reader says `exempt` means a founder account.
- A literal heading names its section whether or not it renders, and names its
  whole section wherever it stands.
- `fretwork-1`'s stored language is Welsh over English copy (parked with
  translation).
- `updated_at` is never bumped; the `sync` flag has no reader.
- Four sites are still `incomplete` (repair: `backend repair` with
  `--apply-reference`, then `--verify`).
- The translator can read page code as text and write its answer back into the
  code (parked).
- A job cannot heal a blank backend reference (its gateway admits no PATCH) —
  read, not driven.
- The band and component prompts choose their digest with `siteHasTables`
  (latent).
- An add-on can design a table nothing can ever fill (reported, not refused).
- A working `video-embed` is invisible to the `data-slot` census.
- Model-written functions on older sites are never re-pinned.
- A refused photograph cannot name itself to anybody who can act on it.
- Salvage cannot fire on a new build; the QR rule is stricter than the rest of
  the design step (both the owner's call).
- The availability calendar's legend (`fretwork-1`) and the price-unit mismatch
  (`ashgrove-1`), both live.
- Raw hex colours are reported on every build and never enforced; in-page links
  that go nowhere.
- Two client POSTs go to routes the Worker does not have (`/api/site/scan`,
  `/api/site/preview`).
- 3D scenes ignore the theme colours; strings outside the page source are never
  translated.
- `env.EMAIL`'s 200-a-day quota is shared by login codes and every site's
  notifications.
- Static voice previews; real background removal (blocked on a fal top-up); the
  app's mobile layout (deliberately not being done).
- A deleted row's reply cuts each field at 40 characters, mid-word (run 80,
  "…with two other , price 18"). Cosmetic; kept for model-written replies.
- The first-run welcome modal greets a returning owner on any new browser
  whenever an unpaid balance is 1 to 20, covers the page, and still speaks of
  the deleted media side (found 2026-09-30 by Test 9's local proof; the
  canary now marks it seen; the product is not changed).
- A photo addition's reply splices its requirement in with the capital
  letter: "…confirm from here that A visitor can see…" (run 92).
- Run 92's app tab logged two untraced "Failed to load resource … 404"
  lines; the canary records only the app's `/api/` calls.
- The menu editor writes a page's whole `links` list on one line when it
  adds an item (run 92; no effect on the pages). Since batch 1 (on the
  branch) a menu a change leaves as it was is left as written; a changed
  one is still written on one line.
- **The whole-router audit's findings** (2026-10-02, W1–W26; each in full in
  `docs/investigations/whole-router-audit.md` §3; **W1–W4 fixed on the
  branch in batch 1, and W5, W7, W8, W15 and W24 in batch 2, not merged or
  deployed**; the rest open):
  - a photo removal handed on to the page step carries the router's
    `remove`, so the page step can delete a page (W1; fixed on the branch);
  - removing one language or one QR code on the look step removes all of
    them (W2; fixed on the branch);
  - the full rewrite is told both that a page it leaves out is kept and
    that it is deleted; the code deletes it (W3; fixed on the branch);
  - a menu edit writes one menu to every page, flattening menus that differ
    per page (W4; fixed on the branch);
  - an edit converted to an add-on keeps the held-back part, so a mixed
    message's halves swap (W5; fixed on the branch);
  - the browser keeps six page addresses after a reload and never refreshes
    a stored list of two or more (W6);
  - the held-back part is named only on success, and a climb to the full
    rewrite runs it anyway (W7, W8; fixed on the branch);
  - the page writer's text guard refuses a removal for its verb ("Get rid
    of", "Drop", "Lose"), after a model confirmed it (W9);
  - the router calls translation a rewrite though the look step translates;
    other router instructions disagree (the name as a logo, undo, what the
    builder can do, "when you cannot tell") (W10, W11);
  - a `text` answer drops the page the customer named; a question beside a
    change goes unanswered (W12, W13);
  - an unsupported request ends in "say it differently" (W14); a question
    with a file becomes a paid add-on (W17); files reach only the logo step
    and builds, and nothing says so (W16);
  - the look step's hand-over to the add-on drops its other lanes (W15); the
    edit's hand-over to the add-on carries no reason (W24); both fixed on
    the branch;
  - replies offer follow-ups no route can serve as meant (W18);
  - the behaviour lane charges with no visible change (W19); removing
    custom styling explains instead (W20); a replacement with a straight
    apostrophe is dropped and reported as not found (W21); a zero balance
    turns every message on a live site into a build attempt (W22);
  - the model prompts carry wording from the test sites and test sentences
    (W23); a row refusal names only the row (W25); stale comments (W26).
- **What batch 1 left, and what the traces found** (2026-10-02, N1–N13 in
  the audit's §3.0): a removal on a one-entry list still emptied it for
  nothing (N1; **resolved after the owner's review**: every list removal
  now names its entries and code checks them); a QR removal with no parser
  is refused (N2); the footer's
  two lists still write one list into every page (N4); a menu item for a
  page the site lacks comes off every menu (N5); an empty band publishes
  silently on the split path (N7); a failed translation publishes behind,
  unsaid (N8); the synchronous edit path keeps a refusal's charge (N9); a
  rewrite's writer could name a page in `remove` unasked (N10). **Found in
  the review's gap fixes:** a QR edit on a one-code site changes that code
  when the answer names none (N11); the long-site rewrite is told to write
  every page again in full without seeing them (N12); the look reply names
  a list field by its key ("— langs", "— qr") and never says which codes
  came off (N13).
- **What batch 2 leaves** (2026-10-02, N14–N21 in the audit's §3.0): an edit
  step handed work by another is not shown the reason (N14); the rewrite's
  designer is not shown the hand-over line (N15); a signed-out reply or a
  watch that gives up adds no held sentence (N16); a readable reply without
  `deferred` names nothing (N17); an addition beside other work with no words
  for each change refuses the whole message (N18); more than four parts are
  refused (N19); a queued add-on swept before its first reply has no parts for
  the review to name (N20); an unreadable router answer drops its held part
  (N21).
- **What the review's gap fixes leave** (2026-10-02, N22–N27 in the audit's
  §3.0): a reload loses the browser's follow of a 202, and a later poll names
  nothing once the finished build's record is gone (N22); the words between a
  change and an addition go with the change (N23); several different
  additions alone are handed on without a part of the site or a page, and
  whether the add-on step makes every one is not shown (N24); a lane named
  with no valid scope counts as other work (N25); N17 narrowed: a followed
  build's final answer without `deferred` now names the 202's parts (N26);
  one equivalent mutant kept as a defence (N27).
- **What the clarification round leaves** (2026-10-02, W27's N28–N40 in the
  audit's §3.0): nothing shown with real models (N28); a side question
  replaces the waiting one (N29); the answer and its request share 2,000
  characters (N30); past two questions a question is words (N31); the
  answer's routing call is charged, your decision (N32); the per-lane calls,
  the full page writer and the add-on's designers do not ask (N33); a step's
  question beside work it can't be told apart from is not kept (N34); files
  survive a reload only in the same browser (N35); a second router question
  that can't be kept uses the answer up (N36); the question field's 884
  characters on every look-picker call (N37); the add-on step still gets no
  attachments (N38); the thread shows a reply's line breaks as spaces (N39,
  yours); the sweep readers return a question no batch reads yet (N40).
  **After the owner's review** (`2965e405`): N31 superseded, N33 narrowed,
  N34 extended, N36 fixed.
- **What the review of the clarification round leaves** (2026-10-02, N41–N47
  in the audit's §3.0): beside a change that was made, earlier answers stay
  out of what is left (N41, the trade yours to confirm); a step's question
  the store refuses twice goes back to the box (N42); the question field on
  more calls, and the full page writer's own cache (N43); the add-on page
  writer, the build's writers and the stylesheet correction do not ask
  (N44); fixed refusals ending *"Say which one"* (N45, found); the real
  models' asking is unmeasured (N46); a repeat or a request too long ends
  the request, said (N47).
  **After the owner's second review** (`09029550`): N41, N47 and N30
  superseded, N44 narrowed.
- **What the second review leaves** (2026-10-02, N48–N55 in the audit's
  §3.0): whether real models name the right answers and reuse them is
  unmeasured (N48); a repeat is caught only in the same words (N49); the
  picker's words must come from the request (N50); a reload between the
  routing answer and the edit's post loses the request (N51, pre-existing);
  11 answers close the router's questions for the next message (N52); a
  repeat costs one unbilled call (N53); 12, 500 and twice are our numbers
  (N54, yours); a step's question past 12 answers is a backstop refusal
  (N55).
  **After the owner's third review** (`a38adac3`): N52 and N55 superseded, N53
  narrowed, N54 restated.
- **What the third review leaves** (2026-10-03, N56–N58 in the audit's
  §3.0): past 12 answers a new answer takes the place of the one the request
  needs least, at worst the oldest (N56); only the customer ends a question,
  or its day-long expiry — no guess is ever made instead (N57); whether real
  models ask better questions and leave proposed changes out when they ask
  is unmeasured (N58).
  **After the owner's fourth review** (`5cbd5239`): N56 superseded — no
  answer still needed is let go; N58 widened to whether a real picker names
  an old answer for the change that needs it.
- **What the fourth review leaves** (2026-10-03, N59–N60 in the audit's
  §3.0): a request's history holds 64 answers, and when all 64 are still
  needed the next answer is refused, free, with the question waiting (N59);
  a long history makes every call shown it longer, about 47,000 characters
  at its longest (N60).
- **What the model-written replies leave** (2026-10-03, MR1–MR8 in
  `docs/history/2026-10-03-model-replies.md` §8): no real model has written
  a reply (MR1); the reply calls are absorbed, not charged, your decision
  (MR2); one quick call more per ending, unmeasured (MR3); the revise and
  the first build keep their composed sentences (MR4); a job that ends with
  no stored answer keeps its fixed sentence, and a Stop before the job is
  claimed is not traced (MR5); one reply per job relies on R2's wildcard
  condition (MR6); the reply's rules are sent uncached (MR7); a fact carries
  only what the route's answer does (MR8). **After the owner's review
  (nothing cut)**: every fact now reaches the model whole; the routes' own
  answers still cap several lists before any reply sees them (MR9, found).
- **Information limits on Edit and Add-on** (2026-10-03, the limits audit,
  `docs/investigations/information-limits-audit.md`, corrected on the
  owner's review): 21 defects (IL1–IL19, IL21, IL22), 2 optional
  capabilities (O1, O2) and 15 untested risks (R1–R15). **Batch 1 is
  implemented, for review** (IL1, IL2, IL5, IL9 and R12:
  `docs/history/2026-10-03-input-limits-batch1.md`; not merged or
  deployed). Left, in the plan's order: batch 2, the pending request (IL3,
  IL4, IL6, IL7, IL8, IL17); batch 3, operations and results (IL10–IL16,
  IL18, IL19); batch 4, the reply (IL21, IL22); then the real-model audit.
  **Batches 2–4 paused by the owner on 2026-10-03**, for the mixed-work
  audit (next line).
- **Mixed work from one message** (2026-10-03, the mixed-work audit,
  `docs/investigations/mixed-work-audit.md`; audit and tests only): eight
  findings reproduced through the real routes (MW1–MW8): steps that ran but
  are never told (MW1, review #9's cause on three- and four-step messages;
  MW5, an added QR code or 3D scene; MW8, page steps alone), parts dropped
  without a word (MW2, a fifth lane; MW4, past a step's count; MW6, an
  addition's declined part), a second part the answer cannot make vanishing
  (MW3), and a job's interval raised unsaid (MW7). A real-model batch
  (MX1–MX6) is prepared, not run.

---

## Backlog

- **INFORMATION LIMITS ON EDIT AND ADD-ON (21 defects, 2 optional
  capabilities, 15 untested risks; found 2026-10-03 by the limits audit on
  the owner's word and corrected on their review; batch 1 implemented for
  review; batches 2–4 paused by the owner on 2026-10-03 for the mixed-work
  audit, whose MW1, MW2, MW4 and MW6 are IL12, IL13, IL14 and IL10 shown in
  a mix).** Each, with its lines, evidence, test coverage and smallest
  change, is in `docs/investigations/information-limits-audit.md` (§9 lists
  them; §10 groups the changes; §11 is the plan).
  - **The words** (IL1, IL2, IL5) — **batch 1, implemented for review**
    (`docs/history/2026-10-03-input-limits-batch1.md`): one size policy
    (16,000 a message, 48,000 a request with what it carries), every hop
    whole, refused past it with the draft and any waiting question kept;
    questions and answers offered kept whole, an unusable one never cut;
    the request's and the answer's files kept together, the logo step
    refusing more than one picture. Was: a message or answer past 2,000
    characters cut in the page and at three server hops, silently; a
    model's question cut at 240, options clipped and a fifth dropped; an
    answer's files pushing out the original message's.
  - **The pending request** (IL3, IL4, IL6, IL7, IL8, IL17) — batch 2: a
    side question while a request waits drops it (`answered` is only yes
    or no); a resumed request sent to the full rewrite loses its answers;
    more than 4 parts across a question is told as "just now"; expiry (24
    hours) drops the request unnamed and a reload clears the card
    silently; at 64 needed answers the next answer is refused and the
    question, request and answers are kept as they were (the request is
    not dropped), but going on means Cancel and retyping; three endings
    drop a step's question and the other steps' refusals.
  - **The page list** (IL9, R12) — **batch 1, implemented for review**: the
    page keeps every page's address, the routing route reads the site's own
    pages (owner-verified, bounded, failing open to the browser's list
    marked unverified, never read as a missing page), and every digest
    names every page. Was: six pages after a reload, a seventh page's edit
    routed as an addition; no page past the 24th nameable.
  - **Lists cut before the reply** (IL11 = MR9, IL13, IL14): nine route
    lists capped with no count; a fifth look lane, the 21st row change, a
    fifth rules table, a ninth picture change, an eleventh menu link and a
    ninth footer item dropped without a word; rows past 60 can't be named.
  - **What is reported** (IL10, IL12, IL15, IL16, IL18, IL19): an
    addition's declined kinds vanish on a partial success (probe); a menu,
    picture, rules, text or rename step beside a look change never reaches
    the reply (probe through the real route: the facts say only "Updated
    /." — review #9's cause); a cut model answer is said as "busy" or "try
    again in a moment"; a replacement with a straight quote is dropped and
    told as wording not found; an unsettled cost is deleted, not said;
    files attached to work that cannot use them are not named in the
    outcome (IL19; using them is O1, an optional capability).
  - **The reply's own edges** (IL21, IL22): the page's fallback composer
    still caps its lists; a reply past 4,000 characters is not asked again
    and the model is not told the bound.
  - **Optional capabilities** (O1, O2): an addition's page writer or a
    picture step using attached files; a Stop for a running edit
    (`cancelEditJob` has no caller; formerly IL20).
  - **Untested** (R1–R16): reply coverage is self-reported (R1); cut
    answers on steps that don't check `stop_reason` (R2); whether real
    replies fit 4,000 characters (R15: the audit's figures are the facts'
    size, measured without a model); the copy-back ceiling for a long
    held-back part in a script near a character a token (R16, batch 1); and
    twelve more, listed in the audit's §9.
- **MIXED WORK FROM ONE MESSAGE (MW1–MW8; found 2026-10-03 by the
  mixed-work audit on the owner's word; audit and tests only, nothing
  changed).** Each is a case in `test/mixed-work.test.mjs` that asserts the
  behaviour as it happens, and each is in
  `docs/investigations/mixed-work-audit.md` §6 with its place in the code;
  the ranked fixes are its §9. Four are information-limits items shown in a
  mix, and would be fixed once:
  - **MW1** (= IL12, review #9): beside a look or page change, a photograph
    change and a menu change are made but told nowhere — the merged answer
    keeps one step's `msg`, and on a `look` answer both the page's composer
    and `editReplyFacts` read only the look's fields and the page
    operations. Shown for three changes on one page and four across pages,
    sync and queued.
  - **MW2** (= IL13): a fifth lane is dropped, not run, put off, listed or
    said; which one goes follows `LANE_FIELDS` order.
  - **MW3** (new): a second part the answer cannot make, beside one the
    router held, can vanish — `alsoAsked` holds one passage, and nothing on
    the edit side checks that every part went to a lane or was held. Shown
    with a supplied picker that left a wording change unscoped; whether a
    real picker does is MX4's to measure.
  - **MW4** (= IL14): changes of one kind past a step's count go without a
    word (the ninth photograph shown; the eleventh menu link, 21st row
    change and fifth rules table by the code).
  - **MW5** (new): a QR code or 3D scene that was added is never named, and
    nothing checks that the code was placed on a page.
  - **MW6** (= IL10): an addition's declined part vanishes beside a part
    that was added.
  - **MW7** (new, low): a job faster than every 15 minutes is slowed to 15,
    at two layers (the add-on's cleaner and `normalizeJob`), and the reply
    states fifteen as if asked.
  - **MW8** (new, low): the page's own reply for page steps alone names no
    page (*"Updated the look."*); a model reply's facts name both.
  - **Kept as decisions, not defects**: an edit and an addition never finish
    together from one message; an addition is all or nothing on a failed
    check; nothing runs concurrently. Whether to change any of the three is
    the owner's (the report's §9, item 6).
- **WHAT THE MODEL-WRITTEN REPLIES LEAVE (MR1–MR8; found 2026-10-03 while
  making edit and add-on replies model-written on the owner's word;
  deliberate unless marked).** Each is in
  `docs/history/2026-10-03-model-replies.md` §8.
  - **No real model has written a reply** (MR1, untested model behaviour):
    whether its replies are faithful to the facts, in the customer's
    language and words, how long they take and what they cost is unmeasured.
    Every route and page case supplies the reply.
  - **The reply calls are absorbed** (MR2, yours to decide): not charged to
    the customer and not on the ledger; each call is logged (`reply:` with
    tokens and milliseconds). At list price about a third to half a credit
    per reply at the default picker (grok-4.6), about 0.6–1.0 on Sonnet and
    0.9–1.7 on Opus; a retry doubles it.
  - **One quick call more per ending** (MR3, latency): at the end of every
    synchronous ending that gets a reply, at the first poll of a finished
    queued job, and for a repeated question's note; unmeasured, bounded at
    12 s per call and 20 s in all (a provider that hangs), after which the
    answer goes out without one. A refusal that came back at once (a stale
    answer, one too long) now waits for its reply; on the synchronous path
    the wait adds to the customer's open connection (reset at about 273 s in
    run 21), while a queued edit, the default, writes it at the poll.
  - **The revise and the first build keep their composed sentences** (MR4,
    scope): they share code, and the first build is to stay as it is; so an
    empty balance on a live site, which the router turns into a build, gets
    the build path's 402 sentence.
  - **A job that ends with no stored answer keeps its fixed sentence** (MR5,
    scope; partly not traced): lost, under review, a finished job whose
    answer is missing. Which sentence a Stop pressed before the job is
    claimed ends on was not traced: `edit_claim` refuses a job whose cancel
    was requested and the consumer only logs it, so the row's later state is
    the sweep's.
  - **One reply per job relies on R2's wildcard condition** (MR6, a
    dependency): the poll keeps the reply with `etagDoesNotMatch: "*"`, which
    workerd reads as its `WildcardEtag`; shown only with the test bucket. If
    R2 ignored it, two polls at the same moment could hand back two
    different replies — never a second change or charge.
  - **The reply's rules are sent uncached** (MR7, cost): 3,103 characters
    (about 820 tokens) of rules and tool on every call since the owner's
    review (2,211 before); prompt caching could cut it.
  - **A fact carries only what the route's answer does** (MR8, deliberate):
    "Changed the description." does not carry the new words, because the
    answer does not (D1's kin). A reply may restate the customer's own words
    for what they asked beside a fact that says it changed — the request's
    words, not a read-back.
  - **The routes' own answers cap several lists** (MR9, found 2026-10-03
    while removing the reply's own cuts on the owner's review; kept
    separate): at most 6 left-out additions (`notAdded`), 4 problems, 6
    words placed and 6 own photographs, 6 kept and 6 unseen sections, 4
    pages listed elsewhere (`reordered`) and 4 left alone (`ignored`), 8 new
    wordings (`changed`) and 4 stale links, set in `worker.js` before the
    page's composer or the reply sees them. The reply now passes on all of
    what an answer carries; lifting these is a separate change.
- **WHAT THE FOURTH REVIEW OF THE CLARIFICATION ROUND LEAVES (N59–N60; found
  2026-10-03 while separating the answer history from the question limit on
  the owner's fourth review; deliberate unless marked).** Each is in the
  audit's §3.0 and in `docs/history/2026-10-03-clarify-history.md` §4.
  - **A request's history holds 64 answers** (N59): at 64 only a `handled`
    answer can make room; when all 64 are still needed, a further answer is
    refused at no cost with the question still waiting (`answers-full`),
    and going on means Cancel and sending what is left as a new message.
    Reaching it takes 52 rounds past the point where our own re-asking
    stops, every one of them the customer's. 64 is our number, yours to
    move.
  - **A long history costs more per call** (N60): every call shown the
    answers is longer — at their longest, 64 answers are about 47,000
    characters in the picker's and the router's input; real answers are
    short.
- **WHAT THE THIRD REVIEW OF THE CLARIFICATION ROUND LEAVES (N56–N58; found
  2026-10-03 while fixing the question limits on the owner's third review;
  deliberate unless marked).** Each is in the audit's §3.0 and in
  `docs/history/2026-10-03-clarify-limits.md` §4.
  - **Past 12 answers, one answer makes room for the next** (N56):
    **superseded by the fourth review** (`5cbd5239`) — no answer still
    needed is let go, not for its age and not because its question was
    answered again. It read: a `handled` answer goes first, then the earlier
    answer to a question answered again, then the oldest — which an
    unfinished part may still need.
  - **Only the customer ends a question** (N57): an answer that settles it, a
    new request, or Cancel — or its expiry after a day. A model that keeps
    asking keeps the request waiting; no guess is ever made instead.
  - **Whether real models ask better questions is unmeasured** (N58): shown
    answers that did not settle a question, whether a real model asks a
    better one rather than the same one, and whether real models leave
    proposed changes out when they ask.
- **WHAT THE SECOND REVIEW OF THE CLARIFICATION ROUND LEAVES (N48–N55; found
  2026-10-02 while finishing clarification continuity on the owner's second
  review; deliberate unless marked).** Each is in the audit's §3.0 and in
  `docs/history/2026-10-02-clarify-continuity.md` §4.
  - **Whether real models use the answers well is unmeasured** (N48): which
    answers a real picker names for each change, and whether a real model
    reuses an answer or asks a better question when shown one.
  - **A repeat is caught only in the same words** (N49): case, accents,
    spacing and punctuation aside; the same thing asked in other words is
    not caught by the check, though every answer is shown and the model told
    never to ask one again.
  - **The picker's words come from the request** (N50): words copied from
    the answers section are not in the message and are withheld
    (`picker/scope-unread`).
  - **A reload in one narrow moment loses the request** (N51, pre-existing):
    between the routing answer (the question already closed) and the edit's
    post (no job yet).
  - ~~**11 answers close the router's questions for the next message** (N52),
    even one that turns out to be a new request.~~ **Superseded by the third
    review** (2026-10-03): the router is offered its question however many
    answers the waiting request carries.
  - **A repeat costs one extra model call** (N53, cost): ours and unbilled;
    the question field's pointer adds 31 characters to every tool that can
    ask, and the scope's `answers` 186 more to the picker. **Narrowed by the
    third review**: at the threshold or past the limit a repeat is never sent
    again, so it costs nothing extra.
  - **12 answers, 500 characters and twice are our numbers** (N54, the
    owner's to move). **Restated by the third review**: 12 is the
    total-answer limit (answers kept; past it nothing is sent again on our
    own) and twice the repeated-question threshold — neither is ever a
    reason to act. **Restated by the fourth review**: 12 keeps nothing — it
    only says when our own re-asking stops; the history holds 64 (N59).
  - ~~**A step's question past 12 answers is refused** (N55, a backstop):
    every call there is offered no question.~~ **Superseded by the third
    review** (2026-10-03): every call is offered its question, and a step's
    question at 12 answers is kept with everything its request needs.
- **WHAT THE REVIEW OF THE CLARIFICATION ROUND LEAVES (N41–N47; found
  2026-10-02 while finishing questions back on the owner's review;
  deliberate unless marked).** Each is in the audit's §3.0 and in
  `docs/history/2026-10-02-live-clarify-review.md` §4.
  - **Beside a change that was made, earlier answers stay out of what is
    left** (N41): which change an earlier answer was about cannot be told,
    and one about the change made would have the resumed picker make it
    again. The question records as asked only what its request still
    answers, so the remaining part may be asked again what the request had
    answered. The trade is the owner's to confirm.
    **Superseded by the second review** (`09029550`): the picker names the
    answers each change needs, and a step's question keeps the answers its
    unfinished part was shown; one only finished work needed is held back
    from models (`handled`) and still reused.
  - **A step's question our store refuses twice is not kept** (N42): its
    sentence names the question, and what was left goes back to the message
    box with the message's files, to be sent again.
  - **The question field rides more calls** (N43): every lane call, the
    removal picker and every designer call; the page rung's full writer has
    its own tool, so its cached prompt prefix is separate from the build's.
  - **Some writers do not ask** (N44, by design): the add-on's page writer,
    the build's writers and the stylesheet correction round.
    **Narrowed by the second review**: the add-on's page writer is shown the
    answers; it still does not ask.
  - **Fixed refusals that end "Say which one"** (N45, found, kept
    separate): `takeOffRefusal`'s unread case and lines in
    `builder/edit-failure.mjs` read as a question no answer resumes; an
    answer typed to one starts a fresh request. A rewording, or making them
    real questions, is a separate change.
  - **The real models' asking is unmeasured** (N46): whether the lanes, the
    removal picker, the page writer and the designers ask only when a detail
    matters.
  - **A repeat or a request too long ends the request** (N47): said and
    uncharged; the customer sends it again with the detail.
    **Superseded by the second review** (`09029550`): a repeat is sent back
    to its model to act or ask more specifically, kept with a note if asked
    again, and closed after twice; no request is too long to ask about.
- **WHAT THE CLARIFICATION ROUND LEAVES (N28–N40; found 2026-10-02 while
  building questions back on a site that exists, W27; deliberate unless
  marked, none changed).** Each is in the audit's §3.0 and in
  `docs/history/2026-10-02-live-clarify.md` §7.
  - **Nothing is shown with real models** (N28): whether a real router asks
    a good question when a detail matters, and acts directly when it
    doesn't, and the same for each step, is a live measurement.
  - **A side question replaces the waiting one** (N29): any message that
    names no question closes the live one, a side question in another tab
    included.
  - **The answer and the request share 2,000 characters** (N30); a longer
    pair is refused at no cost, the question kept.
    **Superseded by the second review** (`09029550`): the answer travels
    beside the request; each answer up to 500 characters, the request never
    cut.
  - **Past two questions per request a question is words** (N31), with
    nothing waiting. **Superseded by the review** (`2965e405`): no count; a
    question is kept whenever its answer can resume the request (N47).
  - **The answer's routing call is charged** (N32, the owner's decision):
    1–2 credits, like any routing call.
  - **Not every model call asks** (N33): the per-lane calls, the full page
    writer and the add-on's designers do not. **Narrowed by the review**:
    they ask now; what still does not is N44.
  - **A step's question beside other work is kept only when what it leaves
    to do can be told apart** (N34); otherwise that part is left alone and
    said as not kept. **Extended by the review**: overlapping scopes are
    cut from the asking step's own words too; the answers rule is N41.
  - **Files survive a reload only in the same browser** (N35, IndexedDB);
    another device or blocked storage is asked to attach them again.
  - **A second router question that can't be kept after the first was
    answered uses the answer up** (N36, a conditional risk): the call fails
    as ours and the request must be sent again. **Fixed by the review**: one
    conditional write; the answered question waits for the answer again.
  - **The question field adds 884 characters** to every look-picker call
    (N37).
  - **The add-on step is still never sent attachments** (N38, pre-existing).
  - **The thread shows a reply's line breaks as spaces** (N39, the owner's
    to decide): what ran and the question after it read as one paragraph.
  - **The sweep readers return the question** a reply asks (N40); no paid
    batch reads it yet.
- **WHAT THE REVIEW'S GAP FIXES LEAVE (N22–N27; found 2026-10-02 while
  fixing the owner's three batch-2 gaps; deliberate unless marked, none
  changed).** Each is in the audit's §3.0 and in
  `docs/history/2026-10-02-router-batch-2.md` §7.5.
  - **A followed rewrite is followed by the open page only.** A reload loses
    the browser's follow of a 202. The poll route names the parts only while
    the resume record exists; a finished build deletes it, and its stored
    answer (which names them) is read once, so a later poll's row verdict
    names nothing (N22, a conditional risk).
  - **The cut is by position, so connective words stay** with the change:
    *"Change the description to … and"* (N23).
  - **Several different additions alone** are handed on without a part of
    the site, and additions on different pages without a page; the add-on
    step reads the whole message, and whether it makes every one is not
    shown (N24, untested model behaviour).
  - **A lane named with no valid scope counts as other work** (it is
    withheld with its own sentence), so an addition beside it is put off
    rather than handed on whole, and with nothing else left the whole message
    is refused (N25).
  - **N17 narrowed**: a followed build's final answer without `deferred` now
    names the 202's parts; a direct answer without one still names nothing
    (N26).
  - **One equivalent mutant kept**: `!op.invalid` beside `op.words` in
    `scopedOps`, true today only because `readScopes` blanks an invalid
    scope's words (N27).
- **WHAT BATCH 2 LEAVES (N14–N21; found 2026-10-02 while fixing W5, W7, W8,
  W15 and W24; deliberate unless marked, none changed).** Each is in the
  audit's §3.0 with where it stands, and in
  `docs/history/2026-10-02-router-batch-2.md` §5.
  - **The hand-over line has two readers.** An edit step handed work by
    another edit step records the reason on its trace, but its picker is not
    shown it (N14). The rewrite's designer is not shown the line, because its
    description becomes the site's (N15).
  - **Some endings name nothing put off.** A signed-out reply (401) and a
    watch that gives up add no held sentence (N16, a conditional risk). A
    readable reply without `deferred` names nothing: the browser trusts the
    server's own account (N17). A queued add-on swept before its first reply
    leaves no stored parts for the review to name (N20, a conditional risk).
  - **Some messages are refused or run whole rather than guessed.** An
    addition beside other work, on a picker answer with no words for each
    change, refuses the whole message (N18). More than four parts are refused
    as unreadable (N19, a conditional risk). An unreadable router answer
    drops its held part, so the add-on step gets the whole message and its
    picker decides (N21).
- **THE WHOLE-ROUTER AUDIT'S FINDINGS (found 2026-10-02; W1–W4 fixed on
  the branch in batch 1, and W5, W7, W8, W15 and W24 in batch 2, for review,
  not merged or deployed; the rest open).** **Batch 2**
  (`docs/history/2026-10-02-router-batch-2.md`): one hand-over contract
  carries the parts put off, the scope and the reason wherever work moves.
  - A missing page's removal stays an edit (W5).
  - Every ending names what was put off (W7).
  - The full rewrite never runs it, and its page writer is told why (W8).
  - An addition beside look work is put off and the look change runs (W15).
  - The add-on step is told the hand-over's reason, part and page (W24).

  The grouped live-validation batch for both batches is the audit's §5.4.
  **Batch 1** (`docs/history/2026-10-02-router-batch-1.md`): a hand-over
  carries only what its destination can do (W1); one language or one QR
  code comes off alone, and a removed code's figure comes off its pages
  (W2); a full rewrite keeps every page it does not return, and a page comes
  off only when the writer names it and nothing still needs it (W3); a menu
  change is made to each page's own menu (W4). Shown with supplied answers
  only; D1–D3 wait for the merge. What batch 1 left (N1–N10) is in the
  audit's §3.0 and the index above. **The owner's review of batch 1 found
  three gaps, fixed on the branch the same day** (the history's §6, the
  audit's §4.2): menu moves of several items (W4); removals that name their
  entries, checked by code, for one, several or every language or code,
  with no one-entry shortcut (W2, N1 resolved); and the last "opposite"
  sentence in the page writer's prompts (W3). Three findings from that work
  are recorded apart, below (N11–N13). The original record follows.
  `docs/investigations/whole-router-audit.md` gives each one's code
  location, expected and actual behaviour, evidence, impact and proposed
  fix; `docs/investigations/whole-router-checks.mjs` re-runs the free
  checks. The four that can damage a live site, most serious first: **W1** a
  hop re-posts the router's first answer (`public/chat.js` 9723), so a photo
  removal answered `needs-place` becomes a page removal the page step makes
  with no model call (unless it is home or linked); **W2** the look door's
  removal clears the whole `langs` or `qr` list (`worker.js` 23703,
  `builder/site-edit.mjs` 641–649), live on `fretwork-1` (French and Spanish,
  two QR codes); **W3** the shared page tool says an unreturned page is kept
  while the rewrite's prompt says it is deleted, and the rewrite publishes
  only what is returned (`builder/page-gen.mjs` 1750–1752 and 2878,
  `builder/publish-pages.mjs` 1194); **W4** `applyNav` writes one list to
  every page (`builder/site-nav.mjs` 1082–1113, 1514), and the bakery's and
  `repairbench-1`'s menus differ per page today. The validation matrix
  (`scripts/router-probes/whole-router-1.json`, routing only) is prepared,
  not run. **Owner's call** on the order of fixes and on W9 (the text guard
  is a deliberate grammar).
- **A QR EDIT ON A ONE-CODE SITE CHANGES THAT CODE WHEN THE ANSWER NAMES
  NONE (N11; found 2026-10-02 in the review's gap fixes; not changed).**
  `patchQr` (`builder/site-qr-list.mjs`) takes the only code when the qr
  lane's patch names no code — the list's length standing in for which code
  was meant, the edit's counterpart of the removal shortcut the owner had
  removed. On a one-code site that is usually the code they meant; when it
  is not (a new destination for a code the site does not have), the one code
  is changed. A fix would ask the lane to name the code always and refuse a
  name not on the list, as removals now do.
- **THE LONG-SITE REWRITE IS TOLD TO WRITE EVERY PAGE AGAIN WITHOUT SEEING
  THEM (N12; found 2026-10-02 while checking W3's prompts; not changed).**
  `priorPagesBlock` (`builder/page-gen.mjs`), for a rewrite whose pages are
  over 90,000 characters in all, shows no source and says *"write them
  again in full — keep the same pages, the same sections and the same
  wording"*. Since batch 1 a page not returned is kept, so a page written
  from its name alone would replace the real one. Its deletion contract
  agrees with every other block. What a long-site rewrite should return is
  the owner's call; the add-on's way is to show what fits and name the rest
  (`priorPagesSent`).
- **THE LOOK REPLY NAMES A LIST FIELD BY ITS KEY AND NEVER SAYS WHICH CODES
  CAME OFF (N13; found 2026-10-02 in the gap fixes' screenshots; not
  changed).** `editReplyBody`'s look branch (`public/chat.js`) maps a few
  field keys to words (`SAY`) and prints the rest raw: a removal reads
  "✅ Updated the look — langs.", "— qr.", "— behavior.". The reply carries
  `qrRemoved` and `qrPages` (which codes came off, which pages changed) and
  the browser reads neither. A word for each list field and a sentence from
  those two fields would say what happened.
- **A PHOTO ADDITION'S REPLY CAPITALISES MID-SENTENCE (found 2026-10-02 in
  run 92; not changed).** The add-on's cover note reads *"I've set that up,
  but I can't confirm from here that A visitor can see a photo of the
  sourdough on the Visit page — have a look and tell me if it isn't
  right."*
  - `coverNote` (`builder/site-requirements.mjs`, the honest clause) joins
    each requirement's `need` after "that", and `need` is written as a
    sentence with a capital letter.
  - The clause itself is the documented design: nothing on this path
    exercises behaviour, so every covered claim reads back with it.
  - Only the capital is wrong. Cosmetic, and kept for model-written
    replies.
- **TWO UNTRACED 404 LINES IN RUN 92'S APP TAB (found 2026-10-02; not
  traced).** The UI record holds two *"Failed to load resource: the server
  responded with a status of 404 ()"* console lines.
  - The canary's network record lists only the app's `/api/` calls (151 of
    them, every one 200 or 202), so neither address is known.
  - Not the photo itself: its address answers 200 on the app and on the
    site.
  - Tracing it needs the browser's own request log (a free local reading).
- **THE MENU EDITOR REFORMATS THE LIST IT ADDS TO (found 2026-10-02 in run
  92; not changed).**
  - Adding "Order", it wrote each page's `links` list, which was one item
    per line, on a single line.
  - It put the two new fields (`secondAction`, `social`) on the
    `const CHROME = {` line.
  - The change sits inside the additions' own places, and the pages render
    the same. A source-layout difference only.

- **THE ADD-ON STEP CANNOT ADD A ROW TO A TABLE THE SITE ALREADY HAS (found
  2026-10-01 preparing Test 11; not changed).**
  - Under the owner's rule an addition reaches the add-on step, whose nine
    kinds are `table · function · api · job · page · component · qr · three
    · photo`. `table` creates a table, or gives an existing one a column,
    payment or a public view. Its seed is written by `seedSiteRows`, which
    skips any table that already has rows.
  - Rehearsed through the real add-on route with supplied answers, on a
    stand-in where `loaves` has rows: every plausible answer is refused, or
    publishes a hand-written card on `/order` as "✅ Done" while the list is
    unchanged.
  - The one row insert in the product is the edit side's data step, which
    the rule does not route an addition to.
  - Proposed: one add-on kind for a new entry in an existing list, writing
    with the data step's own insert, with no page call and no publish.
    *Test 11* in the checklist.
  - **Built on the branch on 2026-10-01, on the owner's word** (not merged,
    not deployed, not shown live): the `row` kind, written with the data
    step's own insert (`builder/site-rows.mjs`), its entries and the
    request's key in one statement, no page call and no publish.
    `docs/history/2026-10-01-add-row.md`.
- **THE SEED-SKIP SENTENCE DROPS ITS REASON (found 2026-10-01; not
  changed).** `seedSkipNote` (`builder/site-add.mjs`) keeps the table name
  before the colon and says "that table isn't one visitors can read, so it
  starts empty" for every skip. `seedSiteRows` also skips for "already has
  rows", "no writable columns" and database errors. For `loaves` (public,
  six rows) the sentence is wrong on both counts.
- **THE ADD-ON ROUTE'S FIXTURE READS EVERY TABLE AS EMPTY (found 2026-10-01;
  not changed).** `test/fixtures/addon-route.mjs` answers the existence probe
  `SELECT 1 AS x FROM "<table>" LIMIT 1` with no rows. So a seed for an
  existing table is inserted (`seeded: {loaves: 1}`), where the live
  product skips it. A test of adding rows must model a table that has them.
  **Addressed for the new tests (2026-10-01)**: `test/fixtures/rows-db.mjs`
  is a database that remembers — tables that already hold rows, an identity
  sequence, the column types, `_meta`'s key — and `addon-route.mjs` takes
  it opt-in (`db`), so the existing tests and the fixture's default are
  unchanged.
- **THE EDIT CANARY CANNOT PRESS AN ADD-ON (found 2026-10-01; not
  changed).** Its one-request path refuses unless the router answers `edit`
  with a layer, after the routing call. The route box can already say
  `intent=addon`. Proposed beside the add-on row kind: post an `addon`
  answer to the add-on route as the browser does. **Built on the branch on
  2026-10-01** (`scripts/canary-addon.mjs`; not merged): only when the box
  says `intent=addon` and the router answers `addon`; otherwise refused as
  before.
- **THE ADD-ON `row` STEP'S KNOWN LIMITS (found 2026-10-01 building it; not
  changed).**
  - **A database with no `_meta` table cannot take a new entry.** The one
    statement saves the entries beside the request's key in `_meta`, so it
    is refused whole (42P01) and nothing is saved: the honest outcome, but
    told as "the database didn't accept it … try again in a moment", which
    will fail again. A real state (`META_TABLE_SQL`'s note in
    `site-schema.mjs`: a recovery meets it); the check before the picker
    reads a missing `_meta` as nothing saved, so other additions, whose
    schema apply makes `_meta`, are not stopped by it.
  - **A value the column cannot read is told as a generic write failure.**
    "£5.00" for a number is Postgres's 22P02, and the reply says the
    database didn't accept the entry, with the code in `detail`, not what
    was wrong with it. The designer is told "a number as a number".
  - **One `_meta` key per request that saved entries is never removed**
    (`addon-row:job:<id>` or `addon-row:idem:<key>`, a few hundred bytes
    each).
  - **A list named in another letter case is refused** (`Loaves` for
    `loaves`, "This site doesn't store a list by that name"), as the data
    step matches table names exactly.
  - **Every addition on a site with a display list reads one `_meta` key
    before the picker** (the replay check). A read that fails for any reason
    but a missing `_meta` stops the request at no cost (`no-meta`), as a
    failed spec read already does a moment earlier; on a site with no
    display list nothing extra is read.
  - **A `row` answer on a site with no display list still calls the row
    designer** before the cleaner refuses it (at no cost to the customer,
    the model call ours); an earlier refusal would save that call.
  - By design for this bounded change: a `row` beside other kinds is set
    aside and named, never written; the canary's after-read sentence says
    "the edit did not publish" for an addition.
  - **AFTER THE OWNER'S REVIEWS OF `f6532d66`, `31741f6f` AND `c3e310e6`
    (2026-10-01; merged and deployed in deploy 2175).** A write whose outcome the step
    cannot see is settled from the request's key. A queued job writes only
    after three yeses: the ledger's own gate (`edit_may_publish`: the lease's
    live holder, the job not finished, refunded, cancelled or under review,
    and billed, its write begun in the same statement), the key's mark
    (`edit_publish_mark`), and the gate again. Every road the ledger has
    parks the job once its write has begun, and the money is kept only on a
    recorded outcome (`edit_committed` after the entries were read back) or
    by the review's own reading of the key (`docs/addon-path.md`, *THE `row`
    KIND*). **Closed by the review of `31741f6f`** (they were recorded here
    for `f6532d66`'s correction): a process dying between the write and the
    review mark, and a review mark that is refused or unanswered, no longer
    end in a refund with the entry saved. **Closed by the review of
    `c3e310e6`**: a consumer that stalls while the sweep refunds its job no
    longer writes the entry on resuming (the mark answered yes to a refunded
    job's holder; the gate refuses it); a cancel asked before the statement
    is sent now stops the write (the gate refuses `cancelled`); and from the
    gate on, the site is held busy (`site_busy` reads the `publishing` state
    the gate sets). No database function was changed. What remains, each
    found while building it:
    - **While a row job is under review, a new message is refused with the
      review machinery's general sentence**: the browser's own *"That edit
      stopped while it was publishing and I can't tell yet whether it went
      live…"* (`EditPoll.outcomeMessage("needs_review")`), which speaks of
      publishing. The job's own reply says what happened. Changing it means
      a `public/` change; not done.
    - **Inline has no job to mark** (it runs only when the queue switch is
      off; production queues every add-on). An entry nobody could confirm is
      never charged, and the customer is told to look in the Data panel.
      Nothing pauses the site, so a new message (a new retry key) can add a
      second entry. A resend of the same POST answers it from the key, at no
      charge.
    - **A definite refusal under a job is refunded through the review**: the
      job was marked before its write. The consumer's own reconcile closes
      the empty key and refunds at once, keeping the step's reply. A site
      database unreachable at that moment leaves the job parked, and the site
      paused, until a sweep tick settles it.
    - ~~A cancel asked while the row step runs does not stop its write~~:
      closed by the review of `c3e310e6` for a cancel asked before the
      statement is sent (the gate refuses it). One asked after the last gate
      cannot stop a statement already on its way, as on the page path.
    - ~~Between a dead consumer's lease running out and the lost sweep
      parking its job, the site is not held busy~~: closed by the review of
      `c3e310e6` (the gate sets `publishing`, which `site_busy` reads).
    - **A consumer that dies after the gate holds its site until its publish
      lease runs out**: the gate gives the job the publish lease (300 s), so
      the sweep parks it about six minutes later (300 s, the 60-second grace,
      then the next two-minute tick) rather than within three. The page path
      holds a site the same way. Found 2026-10-01; not changed.
    - **A consumer that resumes after the review refunded its job parks it
      once more.** The live `edit_refund` parks any job whose write has begun
      unless it published or is `done`, so after the refund-after-the-gate
      ordering (the job refunded while its consumer was stalled, the last
      gate refusing) the consumer's own refund parks the refunded job again.
      Its reconcile settles it at once (the key empty: closed, `failed`, no
      money moving) and the step's reply stands. Pre-existing in the live
      function; shown with supplied answers; not changed.
    - **A job granted at the gate whose key then could not be recorded** is
      parked with no key and settled by the publish's own reconcile as never
      staged (refunded; true, nothing was sent), keeping the step's reply.
      If the site's pointer cannot be read at that moment, it stays parked
      until a sweep tick settles it.
    - **A row job that dies after `edit_committed` and before its finalize**
      is finalized by the lost sweep with its general recovered reply (`{ ok:
      true, recovered: true }`), which names no entry. The entry is saved and
      the reserve kept, as they should be; the reply is the general one.
    - **A job that runs again** (only when the delete of its stored request
      failed) **and writes fresh reports cost 0** in its reply. The repeated
      reserve answers `charged: 0`; the first run's reserve is the one kept.
      Found 2026-10-01 reading `edit_reserve`; not changed.
    - **A closed key (`ROW_VOID`) stays**, as the saved keys do.
    - **A key holding fewer entries than were asked counts as unknown**,
      never as saved. The fixture cannot produce one, so it is not tested.
    - **"Not knowing" is read wide**: a statement timeout (57014) and the
      other listed classes are treated as possibly committed. The cost is a
      key read, and under a job possibly a review that the reconcile settles
      at once; never a duplicate.
- **A DATA-STEP JOB'S ROW READS `routing` UNTIL IT PUBLISHES (found
  2026-10-01 in Test 10's run 84; not changed).** The canary's poll printed
  `routing` from 18 s to 112 s and `publishing` at 126 s, while the sort
  lane rewrote `order.tsx`, compiled the site and checked it. A reader of
  the job row, or of the canary's progress lines, cannot tell the data
  step's work from a routing wait. The browser shows no text from the
  state, so the customer sees nothing different. Observed once; whether
  every data-step job does this is not read.
- **THE FIRST-RUN WELCOME MODAL GREETS A RETURNING OWNER ON A NEW BROWSER
  (found 2026-09-30 by Test 9's local proof; not changed).**
  - **What happens**: `maybeShowWelcome` (`public/chat.js`) covers the page
    with *"Welcome to Go Farther — N free credits, on us"* whenever the
    browser holds no `zephyr_welcome_v1`, the account is not paid, the
    balance is 1 to 20, and **this browser** stores no site. The last test
    reads localStorage, not the server's site list, so an owner with sites,
    on a new browser or after clearing storage, is greeted as new, and the
    modal takes the first click.
  - **Its words are the media side's**: *"Enough for a few images or a voice
    line — every model, one balance. Ready for video? Plans start at
    $24.99/mo."* The media side was deleted on 2026-09-12.
  - **How it was found**: the canary's UI mode opens a fresh browser. Every
    UI run before had a balance above 20; at 10, the modal took the site
    card's click in the local proof. The canary now marks the greeting seen
    in its own plant (`WELCOME_SEEN_KEY`, the app's origin only), as a
    returning owner's browser holds it. No edit passes through the modal.
  - **Not decided**: whether the greeting should ask the server's list, and
    what it should say now. That is the owner's call; nothing is proposed in
    this round.
- **A DELETED ROW'S REPLY CUTS EACH FIELD AT 40 CHARACTERS, MID-WORD (found
  2026-09-30 in run 80; cosmetic; not changed).**
  - **What the customer read**: "✅ Removed one entry. Gone from lessons: name
    Group of three, description Share a 45-minute lesson with two other ,
    price 18. Say “put Group of three back” and I’ll restore it."
  - **Why**: the reply composer (`public/chat.js`, the data branch) takes
    the first three filled fields of the removed row and cuts each with
    `String(w[k]).slice(0, 40)`, with no word boundary and no ellipsis. So a
    long description ends mid-phrase before the comma.
  - **Not a data problem**: the row went exactly as asked, and the full row
    is in the job's `applied[].was`.
  - **Kept for** the model-written replies the owner has deferred (a reply
    says what the operations did, in words). No fix is proposed in this
    milestone.

- **THE OWNER'S DATA BUTTON CAN BE DARK FOR A SITE WHOSE DATABASE LINK IS
  BLANK (found 2026-09-30 while giving Batch 1's row-4 recovery; read in the
  code, not driven live; not changed).**
  - **Why.** The site list answers `db: !!r.neon_db` (`worker.js`, the
    list route), and `public/site-list.js` reads it as `backend`. The card's
    Data button (`siteDbIcon`) and the Data view (`stStageView`,
    `loadSiteData`) open only when `backend` is true.
  - **Who it hits.** An `incomplete` site (the database is real, the link
    is blank: `ashgrove-1`, `fretwork-1`, `northgroup-5`, `washhouse-1`)
    therefore shows the button dark on any browser that did not build it.
    The local record wins only when it says yes.
  - **What still works.** The Worker's owner-rows route resolves through
    `siteBackendBySlug`, which reads the route cache first, so in the
    Worker an `incomplete` site can still be read and saved once the panel
    is open. The same state, the other way up, is why the edit path uses
    `siteBackendDetail`.
  - **What would close it**: the list counting `incomplete` as having a
    database, through the one state function (`site-backend-state.mjs`).
    Healing the four links with the existing repair would also close it,
    but it is maintenance on live rows, is the owner's call, and ends the
    blank-link fixtures.
  - **Corrected on the branch 2026-09-30 (Lane 1c, `b12dd43b`, `bd81a60e`; not merged).**
    - The list decides through `backendState`: `null` for a failed project
      read, never a no.
    - Three more hops were found behind it and corrected: the card's click
      adopted a record without `backend`, so even a lit button opened no
      Data view; the owner data routes relied on the KV cache for a blank
      link, and now fall back to `siteBackendDetail`, read-only; and the
      panel said "No data tables yet." on a failed read.
    - The "What still works" above held only while KV held the connection.
    - `docs/history/2026-09-30-lane1.md`.
- **WHEN THE SITE LIST ITSELF CANNOT BE READ, A LOCAL CARD CAN STILL SAY "NO
  DATABASE YET" (found 2026-09-30 during Lane 1c; pre-existing; not
  changed).** When `/api/site/list` answers, a lookup that could not tell
  is kept apart from a no. When the list itself fails, the cards come from
  this browser's own records. A record that never learned `backend` has no
  flag, and the card reads a missing flag as a no. The fix, if wanted: read
  a missing flag as could-not-tell, as the list's `null` is now read.
- **THE BACKEND LOOKUP'S KV LOG LINE PRINTS A KV ERROR'S MESSAGE (found
  2026-09-30 in Lane 1's log review; pre-existing).**
  `routeDeps`' `onBackfillError` logs `site route KV:` and the message
  (`worker.js`, since `bd63040c`, 2026-07-28). Every caller of
  `siteBackendBySlug` shares it, and Lane 1d makes the routing call one of
  them. A probe planted a password in a thrown KV error's message, and the
  log carried it. A real KV error is not expected to carry the stored
  connection, so this breaks the log rule (allow-listed words only); it is
  not a known leak. The fix, if wanted: log the error's class, as the
  routing lines now do.
  - **Corrected on the branch 2026-09-30 (`ce992066`; not merged)**, on the
    owner's review of Lane 1: `lookupRoute` tells the callback which call
    failed (`read`, `write`, `delete`), and the line is `site route KV:
    <operation> <class>`, the class from a fixed list. Tested through the
    routing route with the connection string planted in a failing read and
    a failing backfill; the lookup still falls back.
- **THE BUILD, EDIT AND ADD-ON ERROR REPLIES CARRY A SHAPE-CHECKED
  PROVIDER TYPE, NOT A KNOWN CODE (found 2026-09-30 in the owner's review of
  Lane 1b; not changed).** Seven callers of `upstreamKind` in `worker.js`
  return its `type` as `upstreamType` (the page build, the edit and add-on
  failures). It is a snake_case word of at most 40 characters and, since
  `ce992066`, never coerced from a non-string, but any such word a provider
  sends is echoed. The routing reason now names a code only from
  `PROVIDER_CODES`; the same table could serve these replies. Kept
  separate: the owner scoped the review to the routing path.
- **A PRICE PUT BACK WAS ROUTED `text`, NOT `data`, WITH NO TABLE NAMES SENT
  (found 2026-09-30 in Batch 1's run 74; one sample each way; not changed).**
  - **What happened.** On `fretwork-1`, whose prices come from the
    `lessons` table, *Change the price of the Hour one-to-one lesson to
    £42.* was answered `data` (run 71) and changed the row. *Change the
    price of the Hour one-to-one lesson back to £40.* was answered `text`
    (run 74, 26.9 s, cost 2). The canary's expected-route check refused it
    before the edit, so what the words rung would have done with it never
    ran.
  - **Why it can happen.** Both routing calls were sent the three pages and
    `tables: []`. The router's own `data` clause and its tie-break are
    conditioned on the tables named to it. The real app sends table names
    only when the browser has them from a build or revise in that browser
    (`public/chat.js`, the digest in `siteSend`). A customer on a fresh
    browser sends none, like the canary and run 42's UI run.
  - **Not measured**: how often, for other wordings, or with table names
    sent.
  - **The names are filled in on the branch 2026-09-30 (Lane 1d, `a02c2003`;
    not merged).** When the digest names no tables, `/api/site/route`
    verifies the caller owns the slug, reads the site's table names (names
    only, read-only, bounded at 3 s) and hands them to the router, with
    `tablesFilled` on the answer. **This fills a confirmed gap in the
    router's context; it is not a proven cause of run 74's `text`**, since
    B1 was routed `data` with no names at all.
- **A FAILED ROUTING CALL RECORDS NO REASON (found 2026-09-30 in Batch 1's
  run 70; read in the code and measured free; not changed).**
  - **The gap.** `routeMessage` in `builder/site-ask.mjs` wraps the request
    build and the model call in a bare `catch`. It returns the fallback
    (`addon` on a site that has one) with `failed: true`, and
    `/api/site/route` forwards only the flag. Nothing logs, stores or
    returns the error, so a failed route cannot say whether the provider
    refused (an outage, a rate limit, billing or a key) or the call died on
    the way.
  - **Run 70** (2026-09-30 00:37 UTC, `fretwork-1`, grok-4.6 because the
    canary names no picker) answered
    `{"ok":true,"intent":"addon","cost":0,"failed":true}` in 0.4 s.
  - **Measured free with a stub sender**: the request for its exact inputs
    builds normally (29,947 bytes, the same keys as the one built for run
    66's inputs). So the throw came from the model call, and its reason is
    gone. The same code had routed run 66 at 21:56 UTC.
  - **The history.** The flag itself was added for the same diagnosis cost:
    a billing refusal read as a router bug (2026-08-12), recorded in the
    route's own comment. The reason is the other half of that fix.
  - **The cause, this time**: the owner found the xAI account's balance
    empty and added credits (2026-09-30, about 01:00 UTC). Nothing we
    record could have said so.
  - **What would close it**: carrying the error's provider, status and
    message on the answer, or into a trace row. Not started; it is outside
    the batch.
  - **Corrected on the branch 2026-09-30 (Lane 1b, `fe20e6cd`; not merged).**
    The answer carries `failure`: the step, the provider, the status, the
    provider's token, whether our account was refused, and the error's
    class. It is built from allow-lists, and **never the message**: a
    provider's words can quote the request. It is logged and returned; the
    canary prints it and `routing.json` keeps it. Run 70's refusal would
    have read `provider xai 403 — refused on our account` (its body was
    never recorded, and xAI documents no codes).
    Since `ce992066` a provider's code is named only from its own
    finite table (`PROVIDER_CODES`), and never coerced from a non-string.
    Since `d19652c4` the tests read the Worker's log too, and the table
    lookup's log line names only a known error class.
- **THE DATA PICKER IS TOLD BOTH TO DELETE A ROW AND TO REFUSE A DELETION
  (found 2026-09-29 while preparing Batch 1; read in the code, not driven
  live; not changed).** `DATA_TOOL` in `builder/site-apply.mjs`: the
  `changes` list's own description still says *"IF THE INSTRUCTION CANNOT BE
  DONE BY CHANGING OR ADDING ROWS — it asks to DELETE one, or it is about the
  look of the page rather than what is stored — return an empty array"*,
  written in `53b0b58c` before rows could be removed. `dcf269a4`
  (2026-08-11, *"REMOVING A ROW WAS REFUSED OUTRIGHT"*) added the item's
  `remove` field (*"True to DELETE the row with this id … ONLY when they
  clearly asked for something to be taken off the site"*) and left the
  list's sentence. The tool's own one-line description names changing and
  adding only. A real model may follow either, and an empty answer reads as a
  no-match. Removal is tested only with supplied answers (`readDataChanges`
  with `remove: true`, `test/site-apply.test.mjs`). **It blocks a live "remove
  a row" acceptance (item 5).** The correction would be that one sentence;
  whether and when is the owner's decision. **Corrected 2026-09-30 (Lane 1a,
  `19f6e480`)** on the owner's word, and **merged and deployed in deploy 2171**
  (its code runtime-confirmed under deploy 2172 by run 76): the list sends a deletion to `remove`, the
  empty array is kept for a request about the look, and adding is described
  as before. Driven through the real edit route with supplied answers
  (`test/data-remove-wording.test.mjs`). How a real picker answers a
  deletion is still unmeasured; the live delete is prepared (the checklist's
  *Lane 4's delete*), not run.
- **A ROW TAKEN OFF A LIST HAS TWO CLAIMS IN THE ROUTER'S INSTRUCTIONS (found
  2026-09-30 while preparing Lane 4's delete; read in the code, not
  measured, not changed).** In `ASK_TOOL`'s `layer` description
  (`builder/site-ask.mjs`), the `look` clause says *"TAKING SOMETHING OFF THE
  SITE IS THIS LAYER, whatever the something is"*, with a whole page as its
  one exception, and the `data` clause says to *"prefer it whenever the thing
  being changed is one row of something the site lists"*. Neither names a row
  taken off a list; the `intent` clause names "a row" only among things taken
  away. A real router may answer `look` for "take the X off the price list".
  On the look door, no lane deletes a row: `backend` dispatches to the rules
  rung, which changes who may read or add, and the page lanes would change
  the page's code rather than the stored row. So a customer's row removal may
  fail or change the wrong thing. The canary's route check makes the delete
  press safe (a misroute is refused for the routing call alone). **Corrected
  2026-09-30 (`4e3ef512`), merged and deployed in deploy 2172, runtime-confirmed
  by run 76**, on the owner's word
  (*"Before the paid row-deletion test, fix the specific router instruction
  conflict you found"*): the `data` clause claims an existing row taken off,
  `look`'s removal clause excepts a stored row for `data` after the whole
  page, and `look`'s reach under `alsoAsked` names no stored row. The
  whole-message rule, the whole-page exception and the open decisions (2a,
  2b) are unchanged. Red-checked, swept (16 of 16) and shown with supplied
  answers through the real routing route
  (`docs/history/2026-09-30-row-removal-routing.md`); how a real router
  answers is not measured.
- **AN ADDED ROW'S REPLY READS "✅ Updated one entry in added to <table>."
  (found 2026-09-29; read in the code; not changed).** The data reply in
  `public/chat.js` prefixes `added to ` to the table's name when a row has no
  id, inside "updated … in …". Kin to the data rung's kept wording (D1). The
  stored `applied` also carries no id for an added row, since the insert
  returns nothing.
- **WHICH STEP ADDS A ROW TO A LIST THE SITE ALREADY HAS IS UNDECIDED (found
  2026-09-29; the owner's ruling).** The router follows the owner's rule
  (2026-09-02, *"Add will always go in addon"*: does the thing they name
  exist on the site now?), so a new dish or lesson reads as an add-on, and its
  `data` clause names changing a row, never adding one. The data picker's tool
  can add a row (`values` with no `id`), and the data route inserts it.
  Until the owner rules which one a live "add a row" should reach, an
  acceptance for it has no expected route (item 5). The plain canary refuses
  to post an `addon` answer, after routing is paid.
- **THE ROUTER SAYS NOTHING ABOUT THE ORDER OF A LIST (found 2026-09-29; read
  in the code).** The data picker's `order` sorts a list by a column and
  publishes the page (the one data change that does), but the router's `data`
  clause names rows only, and no clause mentions ordering. So "show the
  cheapest first" may be answered `data`, `look` or `page`, which is
  unmeasured; a page rewrite costs 6–22. It is item 5's reordering half.
  **Traced 2026-09-30** (the checklist's *Test 10*): on all three demo sites
  a list's order is the `{ order, dir }` of the page's `useRows` call, which
  becomes the Data API's `order=`; no table has an ordering field. The sort
  lane rewrites that call on every page reading the table and publishes;
  the `page` rung can change one page's call and only reports the others
  (`orderingMoved`); the look door has no lane for it. Waiting on the
  owner's decision 2b; recommended `data` for a sort by something the
  entries have, with one router clause. **Decided by the owner the same
  day, with a scope correction**, and built on the branch (not merged): a
  sort not limited to one page is `data`; a sort limited to one named page
  is `page`, and only that page changes; no "whatever page they saw it"
  rule (`docs/history/2026-09-30-sort-routing.md`). **Its scope corrected
  after the owner's review (2026-10-01)**: "not limited to one page" is not
  "across the site". A sort across the whole site (said, or no page named)
  is `data`; one named page is `page`; a selection of pages is never `data`,
  and the closing rule decides it (`docs/history/2026-10-01-sort-scope.md`).
- **A PAGE-LIMITED SORT THAT REACHES `data` ANYWAY IS APPLIED ON EVERY PAGE
  (found 2026-09-30; read; not changed).** The sort lane (`applySort`) has no
  page scope by design: it rewrites every `useRows` call for the table. The
  router now sends a sort limited to one named page to `page`; if it
  answers `data` for one anyway, every page showing the list is re-sorted.
  The reply names how many pages changed (*"… — on 2 pages."*), so it is
  visible, not silent. **The same for a selection of pages (2026-10-01)**:
  a supplied `data` answer to *"On the home page and the menu page, but not
  the order page, …"* re-sorts all three pages (*"… — on 3 pages."*). The
  route reads no page out of the message, so only the router's instructions
  keep a selection from the sorter; on a press, the route box refuses a
  `data` answer before any edit. No code guard was added: it would be a
  keyword rule.
- **THE LOOK PICKER IS TOLD OF NO LANE FOR A LIST'S ORDER (found 2026-10-01;
  read; not changed).** A selection of pages goes to `look` under the closing
  rule, and the look picker's lanes (`builder/site-lanes.mjs`) describe
  sections, building blocks, built parts and what the site stores, never a
  list's order. A page lane (`components`, `shape`, `tsx`, `purpose`,
  `three`) runs the page editor on each scoped page and makes the change;
  `backend` reaches the rules step, which sorts nothing; anything else
  changes nothing. No lane reaches the sorter, so none widens. Which lane a
  real picker names is unmeasured. The committed coverage supplies
  `components`.
- **A SELECTION OF PAGES COSTS THE FULL WRITER ON EACH PAGE (found
  2026-10-01; read, not measured).** Each named page's step tries the quick
  writer first, whose rules send *"a change to what the page LISTS"* to
  `cannot`, so each page likely costs the full writer (6–22 credits a page),
  against about 1 for the sorter across the whole site.
- **THE LOOK DOOR'S REPLY FOR A SELECTION NAMES NEITHER PAGE (found
  2026-10-01; shown with supplied answers; not changed).** Two pages
  re-sorted through the look door read *"✅ Updated the look."*: a case of
  the parked multi-step look reply that names only the look (review #9).
  The full writer's `reordered` heads-up is not shown there, which is as
  well: it suggests *"do the same everywhere"*, which would widen a
  selection.
- **THE QUICK WRITER DECLINES A LIST CHANGE, SO A ONE-PAGE RE-SORT MAY COST
  THE FULL WRITER (found 2026-09-30; read, not measured).** `TWEAK_RULES`
  (`builder/site-tweak.mjs`) tells the quick writer to answer `cannot` for
  *"a change to what the page LISTS"*. A one-page re-sort is a one-line
  change to the list's read, but a writer that reads it as a list change
  hands it to the full writer (6–22 credits). Both paths are covered with
  supplied answers (`test/edit-list-sort.test.mjs`).
- **A ONE-PAGE RE-SORT THROUGH THE QUICK WRITER DOES NOT SAY THE LIST IS
  SHOWN ELSEWHERE (found 2026-09-30; read; not changed).** Only the full
  writer's path computes `orderingMoved` and answers `reordered`, which the
  browser turns into *"Heads up: loaves is listed on other pages too, and I
  only changed this one …"*. The quick writer's success reply carries no
  such field.
- **A HAND-PICKED ORDER IS TOLD "I COULDN'T MATCH THAT" (found 2026-09-30
  preparing Test 10; rehearsed with supplied answers; not changed).** The
  data picker is told that a sequence someone chose ("put the Fade above the
  Beard trim") is not a sort and to leave `order` out, so "Put the Walnut
  Levain at the top of the loaves" ends `no-match`. Its sentence says the
  site stores nothing matching, which is false (the list is right there) and
  gives no next step. The sort lane has its own sentences for a column the
  list lacks and for an order already in place, but none for a sequence it
  cannot keep. Keeping one needs a stored position per row (a schema change,
  a backfill and a page rewrite), which is product work of its own.
- **~~NO ROUTE TEST DRIVES A SUCCESSFUL SORT TO ITS PUBLISH~~ (found
  2026-09-30 preparing Test 10; covered the same day by
  `test/edit-list-sort.test.mjs`, synchronous and queued, with the
  publication, the rows and the billing).** `test/site-order.test.mjs` drives `runDataEdit` and
  `applySort` at the module level; the one route case
  (`test/edit-failure.test.mjs`) is a sort whose publish fails. A sort-only
  `data` answer through the real edit route (status 200, one compile, one
  publish, the page's one line, the reply) was rehearsed in scratch for Test
  10, synchronous path only, and committed with 2b's round, the queued path
  added.
- **A NATURAL MESSAGE CANNOT HAND THE PICTURE STEP A NEW PHOTOGRAPH WITHOUT
  BUYING ONE (found 2026-09-29 while preparing Batch 1; read in the code; not
  changed).** It blocks item 7, the picture swap. Three things together:
  - an attached picture is sent only on a logo edit (`images` in
    `public/chat.js` for layer `logo` alone; *"General attached-image
    replacement outside logo is unsupported on edit"*,
    `docs/investigations/edit-path-milestone.md`);
  - the picture picker is shown each slot's description and a bare list of
    the library's file names, never which file fills which slot
    (`pictureDigest`), so "use the boule photo from the home page" names
    nothing it can match unless the message spells the stored file's name;
  - its one other source, `describe`, buys a fal photograph (about 18.75
    credits) whenever `imagesAffordable` passes, which it does at a balance
    of 22, so a swap message can become a purchase.
- **NO LOOK-DOOR LANE DESCRIBES A MENU ITEM (found 2026-09-29 by Test 7's
  routing review; read in the code, not driven live; not changed).** A
  message with a menu change beside another change is routed `look`: the
  router's instructions make several changes one `look` answer and name "the
  menu and the button" among what it works out. On the look door the picker
  chooses among the lanes, and none describes the items in the menu:
  `action` is "The site's primary button in the header … Only that button",
  and `behavior`, what a control does when used, is the only lane that
  mentions a menu. Run 47's real picker, placing "Take Gallery out of the
  menu." among the lanes, named `behavior`, whose step answered nothing (422,
  `look/no-change`). The removal door has run the router's own menu step
  since deploy 2164; the look door has no such step. The one look-door test
  with a menu item (`test/edit-failure-paths.test.mjs`, a rename beside a
  footer colour) supplies `action` as the answer, so nothing shows what a
  real picker does there. Whether and how the menu gets a lane is the
  owner's decision. **The owner, 2026-09-29: address it with the smallest
  general correction, reusing the menu editor and per-operation scoping.
  Corrected the same day, merged and deployed in deploy 2168 (`47dea9c0`,
  image `dd4f72842234135b`) and runtime-confirmed by run 62**: the one lane that runs
  the menu editor (`action`) now describes the menu's items as well as the
  button, and `behavior` names it as where they go; the route is unchanged,
  because a scoped answer already hands the menu editor only the menu's words.
  Reproduced first with run 47's reading (`behavior`: the menu editor never
  ran). Shown only with supplied answers; Test 8, proposed in the checklist,
  would show it with a real picker: `docs/history/2026-09-29-menu-lane.md`.
- **THE ROUTER HOLDS BACK A LAYOUT MOVE BESIDE A MENU REMOVAL (found
  2026-09-29 in Test 8's run 63; not changed).** Sent "Take Gallery out of
  the menu. Then, on the Visit page only, put the "Order a collection so we
  hold a loaf" band above "Come to the bakery".", the real router (grok-4.6,
  39.1 s) answered `layer: "nav"`, `remove: true`, with the Visit move in
  `alsoAsked`: the removal door, the move held back. Its own `alsoAsked`
  description asks for `look` there: several changes are one turn when the
  answer can make them all (`look` names the menu and the button and a band
  on any page), and a second request is held back only when the answer
  cannot do it this turn (something to add, or a `data` or `text` change
  beside another kind). The `nav` description's "A MENU CHANGE IS "nav"" pulls
  the other way for a mixed message. The route did what the answer said: the
  held-back words were taken out before anything ran, the menu editor took
  Gallery out of every menu, the band was neither moved nor charged, and the
  reply asked the customer to send it next. **Consequences**: the customer
  gets the menu change and is asked to send the other again; and the look
  door's menu lane (deploy 2168) is not reached by such a message, so Test 8
  did not show the real picker choosing it. One sample (Test 7's routing
  review had expected `look`). **The owner, 2026-09-29: resolve the
  conflicting instructions so the router considers the whole request before
  choosing a path or deferring any operation. Corrected the same day, merged
  and deployed in deploy 2170 (`907840c6`), runtime-confirmed by run 65**: the `layer` field now ends on one rule over the whole
  message, which after the owner's review of its first wording chooses by
  targets, never by kind (a layer other than `look` when it can make every
  change on every page each one is on; otherwise `look` when it can make them
  all, changes of one kind on different pages included; a hold only for what
  no one answer can make with the rest); the `page` clause's multi-page line
  points at that rule instead of `addon`; and `alsoAsked` spares a part one
  answer can make with the rest, whatever the first change was. The route is
  unchanged. Run 66's real router answered `look` for the same message, with
  nothing held back, and both changes shipped (one sample; how often is not
  measured): `docs/history/2026-09-29-whole-message-routing.md`.
- **A CHANGE A SCOPED PICKER ANSWER LEAVES OUT IS DROPPED WITHOUT A WORD
  (found 2026-09-29 while reproducing the menu gap; not changed).** On a
  scoped answer each lane runs on its own words, and nothing checks that every
  change the message asked for was placed on some lane. With "Take Gallery out
  of the menu and put the order band above the starter story." and an answer
  scoping only the layout, the route ran the layout alone and the screen read
  "✅ Updated /.", the menu change not mentioned (supplied answers, sync and
  queued, scratch). It holds for any lane. What should happen to words no
  scope places is the owner's decision.
- **THE MENU EDITOR'S OTHER PARTS HAVE NO LOOK-DOOR LANE (found 2026-09-29
  while correcting the menu lane; not changed).** The menu editor (`nav`)
  also writes the footer's contact details, its social icons and small print,
  links written into the pages, and how the header and footer sit. The menu
  lane's description now covers the menu's items and the button only, so a
  message asking for one of those beside other work has no lane that
  describes it on the look door. The router's own `nav` answer reaches all of
  them as before.
- **WHAT THE PICTURE STEP CANNOT TAKE OFF ON ITS OWN (recorded 2026-09-29 as
  the correction's remaining capability limit; the owner: *"For structures the
  targeted editor cannot safely remove, give an accurate refusal without
  silently clearing the image or removing a larger block. Record this as a
  remaining capability limit."*).** Measured on the stored test pages
  (`test/fixtures`, 341 files) with the implemented code: of 210 photographs
  the picture step can address, 190 come off and 20 are refused `part`: 16
  held as `Figure` props, 2 as `MediaObject` props and 2 written as
  `media={<SafeImage …/>}` values. The reply names the photograph and offers
  what would work ("Say “empty that photo” to keep its space, or ask for the
  block to be taken off."); nothing takes the block off for the customer in one
  step. Also refused, each with its own sentence: a photograph inside a
  condition, a map or an attribute, or with children (`part`); two
  photographs on one page with one description (`same`); and every removal in
  a job run inline in the Worker, which has no TypeScript reader (`unchecked`;
  every edit is queued and runs in the container today). **Kept, by the
  owner's rule on wrappers**: 21 of the 190 leave their wrapper empty (9
  `<section>`, 7 `<div>` with a class, 5 `<Parallax>`), and one with padding, a
  background or a size of its own can leave visible empty space where the
  photograph was. Whether any of these should become a capability is the
  owner's decision.
- **THE QUICK WRITER STORES THE MODEL'S WHOLE FILE AS WRITTEN (found
  2026-09-29 by Test 7's run 60; not changed).** The page step's quick writer
  asks the model for the whole file back, and `readTweak`
  (`builder/site-tweak.mjs`) stores the answer's `source` as written once its
  guards pass: the prose, the route, the lint and the component checks. None
  of them looks at whitespace the customer never sees, and nothing puts the
  file's own formatting back. In run 60 the model's answer for the home page
  moved the band exactly and dropped the file's final newline, so the stored
  `index.tsx` is 2,438 characters (`820cf33c…`) where the exact swap is 2,439
  (`0b64985c…`); the build and the served page are unaffected. Run 57's
  answer kept its newline. It matters wherever a stored page is compared
  byte for byte (an acceptance's expected hash, a later diff), and it shows
  the quick writer can change more of a file than the customer asked for
  without any guard noticing, when that change is only whitespace. **The
  owner, closing Test 7 (2026-09-29), accepted run 60's missing newline as a
  specific nonfunctional exception for that acceptance only**: *"Keep it
  recorded; do not claim byte-for-byte preservation or exempt other
  whitespace changes generally."* Whether to restore the untouched
  whitespace in general is the owner's decision.
- **A LOOK REPLY'S `changed` LISTS ONLY THE STEPS THAT NAME THEIR FILES (found
  2026-09-29 by Test 7's run 60; not changed).** The look merge's `changed`
  is `flat("changed")` over the steps that ran (`worker.js`); the quick
  writer's reply carries no `changed`, and its page is reported through
  `pageOps` instead. Run 60's stored reply reads `changed: ["visit.tsx"]`
  beside `pageOps: [{page: "/"}]`, though `index.tsx` changed too. Nothing
  the customer reads uses `changed` on a look reply (the browser reads it on
  the text and add-on replies), so today it is only an incomplete record.
  It is the record a model-written reply would read (the owner's future
  preference), in the same family as review #9, a multi-step look reply
  naming only the look.
- **THE KIT'S `StoryLead` ALWAYS DRAWS A PICTURE (seen 2026-09-29 in Test
  7's run 60 pictures; there before the run; not changed).** `StoryLead`
  (`builder/lovable/template/src/components/ui/story-lead.tsx`) renders
  `<SafeImage src={image} …>` whether or not it is given an `image`, so a
  page that gives it none shows the kit's empty frame, captioned with the
  headline. The bakery's home page does ("Fed every morning since we
  opened"), before and after run 60, and every `StoryLead` in the stored test
  pages (3 of 3: the bakery's and two news pages) is written without one.
  The picture step does not list it as a slot (the home page has two), so a
  customer cannot fill it by asking for a photo there. Whether the component,
  the page writer or the picture step should change is the owner's decision.
- **A HALF OF A MESSAGE THE ROUTER PUTS OFF IS STILL ATTEMPTED (found
  2026-09-28 by Test 6's paid run, run 52; not changed).** The router answered
  `look` with the Visit page's band move in `alsoAsked` and named no page: one
  change per turn. The browser posts the whole message to the edit job (the
  canary does the same), so the look picker picked `shape` for the put-off
  half too, and that step ran on the home page, because the only page named
  belonged to the put-off half. The home page's writer found nothing to change
  (`page/no-change`), so nothing wrong was published or charged. But the reply
  says both "⚠️ I read the / page and couldn't find a change to make for that…"
  and "I only did one thing this time. Say “…” and I’ll do that next." Two
  questions meet here, and both are the owner's: whether the job should do
  only what the routing decided, and whether the router should put a band move
  on a named page off at all, when the look rung can do both in one turn.
  **Fixed 2026-09-29 (owner: "Fix the general routing/execution mismatch")
  and corrected after the owner's review; merged and deployed in deploy 2166,
  and exercised live by run 57, which made both changes; Test 6 is closed by
  the owner for what runs 57 and 58 showed.** The router puts
  off only what its answer cannot do this turn; a part it puts off is posted
  back by the browser and taken out of the message before anything runs
  (`heldBack`), and the reply's tail is composed from what the route really
  held back (`deferred`); the picker names each change's page and words
  (`scopes`), so each runs on its own page with its own words. The
  withholding is proven with supplied model answers only; run 57 measured a
  real router and picker on the ordinary path (both changes in one turn, the
  move scoped to `/visit`). The record is `docs/history/2026-09-29-op-scope.md`.
- **FIVE STYLESHEET RULES MATCH NOTHING THE APP SERVES (found 2026-09-29; not
  changed).** `.model-menu.drop-up.dir-menu`, `.nav-dd-menu`,
  `.nav-dd-menu.open`, `.img-src-menu` and `.img-src-menu .check` in
  `public/styles.css`: no served file names `dir-menu`, `nav-dd-menu` or
  `img-src-menu`, and none builds them. `test/css-reachable.test.mjs` counts
  them live only because a router sentence in `builder/site-ask.mjs` has a
  string starting "menu edit" right after a `+`, which its reader takes for a
  class suffix. Re-wrapping that unchanged sentence made the guard report all
  five, and its planted case, which assumes a stylesheet with no dead rule,
  failed with them. The original line break was put back rather than the rules
  deleted, because the served stylesheet is outside that fix. Whether they go
  is the owner's; so is whether the guard should read router prose as code.
- **THE HEADER'S BUTTON HAS NO `data-slot="button"` (found 2026-09-28 preparing
  Test 6; not changed).** `SiteHeader` renders its action as `<Button asChild>`
  around `SiteLink`, and `SiteLink` passes on only `href`, `className` and
  children, so the marker `Button` stamps is dropped. Read in the served HTML:
  on every fold-lane-bakery page the header's "Order a loaf" is an `<a>` with
  the button classes and no marker, while the CTA band's button carries it. So a
  stylesheet rule written against the kit's documented button hook recolours
  every button but the header's.
- **THE RENDER CHECK JUDGES EACH SELECTOR OF A LIST ON ITS OWN (found
  2026-09-28 preparing Test 6; read in the code, not driven; not changed).**
  `changedSelectors` splits `h1, h2, h3, h4, h5, h6` into six selectors, and a
  selector counts as dead when no rendered page has a match. The render check
  answers the site's data with empty lists, so on a site with only `h1` and `h2`
  (the bakery) a common heading rule would have four dead selectors and force a
  correction round. It sits in the stylesheet work the owner closed.
- **REDIRECTS DROPPED BETWEEN 2026-08-17 AND DEPLOY 2165 ARE NOT RECONSTRUCTED
  (recorded 2026-09-28, the owner: *"This patch preserves saved mappings; it
  does not reconstruct missing history."*).** From 53147339 until deploy 2165
  (`f5e941f4`), every publish wrote a redirect map holding only its own move
  pair, so a site that renamed or removed a page and then published again lost
  that redirect, and no removed page got one. The fix carries what a sidecar
  holds from now on; it rebuilds nothing. How many sites lost a redirect is
  UNMEASURED. Part of the history is readable: each version kept under
  `builds/<slug>/<version>/state/` carries the map it served, but a site keeps
  ten versions (`MAX_VERSIONS`), and publishes before 2026-09-05 used the
  legacy layout. Finding or restoring any of it is a separate decision.
  fold-lane-bakery's `/the-starter` → `/starter` is back only because run 50
  restored a version whose own map had it.
- **A PAGE REMOVAL DOES NOT SEE A QR CODE POINTING AT THE PAGE (found
  2026-09-28, run 49; not changed).** fold-lane-bakery's `/visit` still shows
  `qr-gallery.svg`, which encodes its `/gallery` address, after `/gallery` was
  removed. The link rule reads page source only. The owner's call: refuse the
  removal while a QR names the route, or re-point the code, or accept it.
- **THE BRANDED NOT-FOUND PAGE IS THROWN AWAY ON EVERY START SITE (found
  2026-09-28 tracing run 49; not changed).** For an address a site does not
  have, the script answers its branded not-found document with a 404; when
  `siteRedirectFor` finds nothing, the dispatcher does not return it but falls
  through to the static path, which on a Start site has no `index.html`, and
  answers the bare nine bytes `Not found`. The comment above says the script's
  answer stands; `site-worker-serve`'s test of it checks only the status. A
  small serve-side change (return the script's absolutized 404 when no
  redirect is found) is the owner's call.

- **THE RULES REPLY SHOWS LITERAL ASTERISKS (run 44, recorded; not changed).**
  `rulesReply` (`builder/site-rules.mjs`) writes each table name as
  `**<table>**`, and the chat shows a reply as plain text, so the screen read
  "✅ **bookings** — changed whether it's open." with the asterisks visible
  (the run's own screenshot). Kept with the model-written replies work, beside
  the generic "changed whether it's open".
- **A SEPARATE UX GAP: CLOSING A TABLE LEAVES THE SITE INVITING IT, AND THE
  REFUSAL IS GENERIC (run 44; recorded by the owner's instruction as its own
  item when the rules acceptance closed, 2026-09-27: *"don't expand this
  milestone to fix it"*; not changed).** Two halves:
  - **the invitation stays**: the rules rung changes the database and
    publishes nothing, so after "stop taking bookings on the website for now"
    `lido-axes-b` still shows "Book a table" in its header and hero, and the
    `/book` form;
  - **the refusal is generic**: a visitor who fills the form in is told
    "That isn't available.", not that the café is fully booked.

  The database half of the request is done and the page half is not. Whether
  such a message should also change the pages, and what the refusal should
  say, is the owner's call. **`lido-axes-b`'s bookings stay closed** meanwhile.
- **THE LOGO REPLY SAYS "ON EVERY PAGE" (run 39, recorded separately when the
  owner closed Test 4a, 2026-09-27; not changed).** The logo rung answers
  "✅ That's your logo in the header now, on every page.", and fold-lane-bakery's
  `/starter` is a salvage stub with no header, so the logo shows on four of its
  five pages. Wording only; the upload itself was byte for byte.
- **THE THREAD'S MESSAGE BUBBLE DOES NOT SHOW AN ATTACHED PICTURE (run 39,
  recorded separately; not changed).** The words show and the picture does not,
  because nothing stores an attachment on a thread message. The picture was
  sent and used: it became the logo.
- **THE CANARY'S JOB READER SAYS `exempt` MEANS "A FOUNDER ACCOUNT" (run 39,
  recorded separately; not changed).** `billingMeans` in
  `scripts/canary-read-job.mjs` dates from when only a founder was exempt.
  Since `ed1e3b93` a rung that makes no model call is exempt too, which is what
  run 39's logo and move jobs were. Harness wording, not the product.
- **THE TEXT GUARD CANNOT NAME A SECTION HEADED BY A KIT COMPONENT'S PROP
  (FIXED, MERGED AND DEPLOYED in deploy 2162, `ab74d0d9`: *a section headed by
  the kit*).**
  - **What happens.** `proseInventory` names a section only by literal
    `<h1>`–`<h6>` text or a `<section>`'s id or aria-label. A section headed by
    `<SectionHeader title="…">` therefore cannot be the target of "Remove the
    ‘…’ section", although the visitor sees that title as an `<h2>`. A correct
    removal is refused with `unconfirmed-target`, and the sentence asks for the
    heading the customer already gave.
  - **Reach.** 59% of the corpus's prose-bearing sections (329 of 555).
  - **Impact.** Fail-closed: no content lost, the routing charge spent.
  - **Status.** Fixed, closed by the owner after review, and merged and
    deployed in deploy 2162 (`ab74d0d9`, image `369d7b1e5bae25b0`); the rule and
    its limits are in *a section headed by the kit*. The owner's review of
    `2f2fed58` found that a kit heading the page may not render still named its
    section, closed at `5ec82214`. **It answered live on Test 4a's Part A** (run
    37, 2026-09-26): the correct removal published, and nothing else changed.
- **A LITERAL HEADING NAMES ITS SECTION WHETHER OR NOT IT RENDERS (found
  2026-09-26 in the kit-heading review, not changed).** The kit heading now
  must render whenever its section does; the literal reader has no such check.
  Measured: for 'Remove the ‘Today’s bake’ section from the home page.',
  `{false && <h2>Today’s bake</h2>}`, `<div hidden><h2>…</h2></div>` and
  `<Opaque><h2>…</h2></Opaque>` each name the section, and removing its visible
  paragraph is accepted. 4 of the corpus's 278 literal headings with words
  inside sections sit behind a condition. The owner bounded the correction to
  the kit recognition; aligning the literal reader is separate work.
- **A LITERAL HEADING NAMES ITS WHOLE SECTION, WHEREVER IT STANDS (found
  2026-09-26 while fixing the kit heading, not changed).** Measured:
  'Remove the ‘Sourdough’ section.' naming a card's literal `<h3>` inside a
  "Menu" section authorizes losing the whole Menu section's prose, the Rye card
  included (`{ok: true}` on the whole removal; losing another section is still
  refused). The kit rule is deliberately narrower (h1/h2 only, the heading that
  opens the section). Aligning the literal reader is separate work.
- **fretwork-1's stored language is Welsh (`lang="cy"`) over English copy**, so
  its switcher labels the home page "Cymraeg". Pre-existing, noticed 2026-09-25,
  parked with translation.
- **`updated_at` IS NEVER BUMPED (open).** `site-schema.mjs:1121` creates it as
  a column DEFAULT whose own comment says "bumped on every UPDATE", and a
  Postgres default applies only when the column is OMITTED from an INSERT. There
  is no trigger and no statement anywhere that touches it on an update. **The
  live consumer is a GENERATED PAGE**: the kit's `Row` type declares
  `updated_at?: string` precisely because models wrote
  `deal.updated_at ?? deal.created_at` in two consecutive evals. So a site
  showing "last updated" shows the CREATION time for ever. **An earlier write-up
  justified this by `/changes?sync=`, which occurs exactly once in the tree and
  is inside a CODE COMMENT** — *a comment describing a consumer is not evidence
  the consumer exists*, and one grep settles it.
- **THE `sync` FLAG HAS NO READER AT ALL (open).** It creates `_deletes` and a
  tombstone trigger per table — real DDL emitted on every site that declares it
  — and `_deletes` is on `INTERNAL_TABLES`, denied to the browser, with no route
  serving it. Every byte of that machinery is unreachable from outside Postgres.
  Decide per the standing rule: build the reader, or delete the flag and its DDL.
- **FOUR SITES ARE STILL `incomplete`** — `ashgrove-1`, `fretwork-1`,
  `northgroup-5`, `washhouse-1`. Fixed in code (no new site can enter the state)
  and the repair is two presses each: `backend repair --apply-reference` then
  `--verify`. `repairbench-1` is repaired and verified. **The rules rung, the
  addon and (since 2026-09-22, deploy 2144) the page rung resolve these sites
  themselves**, so the blank column no longer costs an edit its rules; the
  repair is still the clean state. **The full revise did not**: it read
  `ownerConn` off `siteBackendRowFresh` (`conn: null` here), so a revise that
  declares no table rewrote every page of these four sites under the
  no-database rules. **Fixed, merged and deployed in deploy 2160** (`80ce60f4` +
  `8f66dfb9`, the milestone section): a separate read-only `revConn` for the
  writer's spec, with `needsDb` and so the heal untouched.
- **THE TRANSLATOR CAN SEND PAGE CODE TO THE MODEL AND WRITE THE ANSWER BACK
  INTO THE CODE (open, found live on run 26; PARKED by the owner 2026-09-23).** `extractText`
  (`builder/site-text.mjs`) reads a `>` in page-level code as the end of a JSX
  tag, so `x >= 0 ? a : null; return (` became a "string" for
  `collectStrings`, was translated for each extra language, and was applied by
  `translatePages` into `/fr` and `/es`. The answer happened to be identical, so
  run 26's compiled code is intact in all three languages; a different answer
  would change the translated pages' logic, silently, on any edit that adds a
  `>` comparison outside JSX. Measure `extractText` over the corpus for code
  spans before changing it — it is also the reader `sameProse` stands on.
- **A JOB CANNOT HEAL A BLANK REFERENCE, BY ITS OWN GATEWAY'S RULE (read, not
  driven, recorded 2026-09-22).** `healSiteBackendDb` — called by the rules
  rung, the addon and `ensureSiteBackend` — is a `PATCH` on `site_backends`.
  Inside the container every service-key call goes through `gatewayFetch`, and
  `SB_TABLES` in `builder/job-gateway.mjs` lists no `PATCH` for any table. So
  from a job the heal is refused, and `healSiteBackendDb`'s never-throw contract
  turns that into a quiet `{ok: false, healed: false, status}`. **If that
  reading holds, only the `backend repair` workflow can heal these sites** — which
  matches all four still being blank. Settle it with one route test through the
  gateway before building on it.
- **THE BAND AND COMPONENT PROMPTS ASK A DIFFERENT QUESTION FROM THEIR OWN
  RULES (latent, recorded 2026-09-22).** `bandPrompt` and `partPrompt` choose
  the digest with `siteHasTables`, while the system block beside them comes from
  `pageRulesFor` → `siteHasBackend` — the 2026-09-14 correction `pagesPrompt`
  got and these two did not. A site with a function and no table would be told
  *"There is none"* under rules that say to call the functions the digest lists.
  **Unreachable today**: the split runs only on a first build (`bands:revise`),
  and a first build's design tool carries no `backend`, so its spec has no
  function. It becomes live the day either of those moves.
- **AN ADDON DESIGNS A TABLE THAT NOTHING CAN EVER FILL (reported, not
  refused).** `repairs` was declared `read:"none", write:"none"` — the `admin`
  pair — so no client grant is emitted **and `seedSiteRows` skips it**, that
  function seeding the `display` pair alone. **The SYMPTOM is gone** (the count
  function was moved onto `bookings` and `/status` reads 3) **and the DEFECT is
  not**: the table still has no writer and no seed, and the next addon choosing
  that shape gets the same table. The fix shape is a check at the cleaner, not a
  prompt. What shipped instead is a REPORT (`missingPopulation`), because *"no
  client write grant does not mean no writer"* — a seed, a function body, a job
  body or a client grant all count.
*(Two edit-path items closed here on 2026-09-20 — the component-deletion one
and the empty-frame one — moved up to the ladder's own section, because a
closed limitation left in a limitations list is a false negative about our own
product.)*
- **A WORKING `video-embed` IS INVISIBLE TO THE `data-slot` CENSUS (open).** It
  stamps the attribute on its FALLBACK branch alone, so **a video that WORKS is
  invisible and a BROKEN one shows up** — both consequences backwards. Two
  instruments go quiet: the `curl | grep -o 'data-slot=…'` reader and the css
  lane, which is required to target by `data-slot`. One attribute on the success
  branch's outer div; it is a kit file, so the deploy rolls the container.
- **EXISTING MODEL FUNCTIONS ARE NEVER RE-PINNED (open, kept SEPARATE at the
  owner's instruction).** Every model-written function on every site built
  before the `search_path` pin stays exposed, and those are exactly the
  `SECURITY DEFINER` ones granted to `anonymous`. **Not proposed, not written,
  no backfill run.** The shapes worth weighing: persist the body in `_meta` so a
  next change re-declares naturally (largest, and it puts model-written SQL into
  the stored spec); an `ALTER FUNCTION … SET search_path` sweep over `pg_proc`
  per site (needs a credential and the same preview/apply/verify discipline); or
  leave it on the reachability argument and record that the argument rests on a
  layer we do not own.
- **A REFUSED PHOTOGRAPH CANNOT NAME ITSELF TO ANYBODY WHO CAN ACT ON IT
  (open).** `genSitePhoto` throws `"photo " + status + " " + detail`,
  `makeSitePhoto` scrubs it onto `images.error`, and `imageNote` reads that
  field ONLY as a discriminator between four identical-looking placeholder
  outcomes — **it is never put on the reply**. The one surviving copy is
  `console.error` inside the container. So an empty provider balance, a wrong
  key, an outage, a timeout and a non-image answer all reach the owner as one
  sentence. *A failure that cannot name itself*, in the money path's decoration
  step.
- **SALVAGE CANNOT FIRE ON A NEW BUILD** and has not since `MAX_PAGES` became 1
  — the only page a new build has is the one page salvage will not replace. Both
  halves correct in isolation; nothing announced it. **Owner's call.**
- **THE QR RULE IS STRICTER THAN THE REST OF THE DESIGN STEP**, so a first build
  can almost never have one: `NEVER INVENT THE DESTINATION` while every other
  field invents placeholder detail freely. The machinery is not the limit; the
  rule is. **Owner's call.**
- **The availability calendar's own legend (open, live on `fretwork-1`).**
  `availability-calendar.tsx` prints "Each square is the night beginning on that
  date… Prices are per night for the whole property" — written for a
  self-catering let, now on a guitar diary. A legend the model must answer, or
  one that says nothing about the trade, fixes the class; a firmer sentence does
  not.
- **The price-unit mismatch (open, live on `ashgrove-1`).** A kit component
  documents "integer minor units"; the model feeds it major-unit rows, so one
  control says **£16.40** and the total says **£1880.00**. A branded type or a
  `deltaMinor` prop name fixes the class.
- **The raw-hex-colour finding (open, THIRD run running).** Runs 80, 82 and 83
  all reported it. Detected and reported on every build, never enforced, so it
  ships every time.
- **The dead-control finding (open).** On `northgroup-17` the stage filters,
  "New deal" and the deal rows are all `<a href="#pipeline">`, and 15 of 24
  in-page links point at the section they already sit inside — dead by
  construction, while the reply claims the filters run. A lint for a control that
  goes nowhere is the next thing.
- **Two client POSTs go to routes the Worker does not have (open).**
  `/api/site/scan` — the Security panel's "Run scan" button, which promises
  *"Opus is reviewing your code…"* and has no route (**a dead control that makes
  a promise**, and the sentence names Opus so even a real route would ignore the
  picker); and `/api/site/preview`, whose blob fallback means nobody notices.
  **Check first whether either is matched some other way** before deleting — the
  grep was for the literal string.
- **3D scenes ignore the theme colours (open)** — three.js cannot read oklch.
  Visible and low-contrast, NOT invisible.
- **Strings outside the page source are never translated (open, run 39).**
- **`env.EMAIL` daily quota is 200** across login codes AND every site's booking
  notifications. Worth watching, not yet a problem.
- **Static voice previews** — the owner drops MP3s at `public/voices/<name>.mp3`.
- **Real background removal** — needs a fal utility wired as an orchestrator
  step; blocked on a fal top-up.
- **Mobile layout for the app is deliberately NOT being done** (owner's call,
  desktop-first).
