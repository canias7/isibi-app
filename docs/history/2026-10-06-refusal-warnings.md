# A refusal's requirements, and every missing page, code, seed skip and empty table, reach the customer (2026-10-06, on the branch)

The owner, after the requirement-reporting fix passed Codex's review
(`2026-10-06-requirement-reporting.md`):
*"The requirement-reporting correction passes Codex review. Keep it and the
earlier fixes. Next, close the two remaining reporting omissions together in
one focused batch: requirement details disappearing from refused Add-on
responses, and individual missing pages, QR codes, seed skips or unfillable
tables disappearing behind shortened warning lists. Carry every relevant
outcome through the stored answer, reply-model facts and existing customer
display paths, preserving accurate states, reasons and legitimate
deduplication. Let the model write normal customer replies naturally; avoid
new canned messages, site-specific rules or "and N more" replacing the actual
missing items. On refusal, report only what the available evidence
establishes; an incomplete judgment must never become a claim that work
succeeded. Add focused cases for complete and incomplete judgments beside
refusals, lists above the existing cutoffs, mixed outcomes and stored-answer
replay. Preserve existing execution and charging behavior. Keep the separate
twelve-requirement intake limit documented and parked. Push the correction,
run relevant tests and required CI, and update owner-notes with the exact
commit and remaining limitations. Keep everything unmerged; no deployment,
container image build or paid retest yet."*

**The fix is on the branch only** (`46a7746c`): not merged, not deployed, no
image built, nothing pressed or spent. It is shown with supplied model
answers through the real routes, not live.

## 1. The reproduction

Both omissions reproduced before anything changed, at the module and through
the route, for free.

- **A refusal.** A cleaner's refusal (a 3D scene that says nothing of what it
  shows) beside "let people pay by bank transfer": the answer carried
  `requirementsTold` and a complete `coverNote`, and the reply's facts were one
  line, *"Nothing was added. The builder's own reason: …"*. The browser printed
  only the refusal's sentence. So the bank transfer reached neither — the
  limitation TOLD 11 pinned.
- **And what carrying it naively would have said.** On a refusal nothing is
  applied, so a requirement can only be carried by what the site already has.
  The note the refusal kept, and never showed, told such a requirement as
  *"I've set that up, but I can't confirm…"* — the sentence for work this
  change did. Shown to the customer as it was, the fix would have claimed work
  on a refusal. The same sentence was said on a success of a requirement
  carried only by what the site already had (`addon-route`'s existing QR code:
  a job-only change told "I've set that up" of a code it never made).
- **The four lists.** With five of each:
  - `missingPagesNote`: *"5 pages … /a, /b, /c and 2 more didn't make it
    through"*;
  - `deadQrNote`: named the first three codes, pages and sections and said
    nothing of the fourth and fifth;
  - `seedSkipNote`: *"t1, t2, t3 and 2 more"*, and every skip said to leave a
    table *"empty because visitors can't read it"*, whatever the engine's
    reason — "already has rows" included, which is the opposite;
  - `populationNote`: *"f1, f2, f3 and 2 more"*;
  - the reply model was given all four as one fact (`coverOther`).
- **And the route cut two of the lists at twelve.** `aSeedSkips` kept the first
  twelve skips the engine handed over, and the wire sent twelve unfillable
  tables. A row the database refuses is a skip of its own
  (*"breads row 1: …"*), so six tables with three refused rows each is eighteen
  skips, and the last two tables reached nothing.

## 2. What it does now

### Refusals

- **Both refusals that carry the requirements** (the cleaner's, `error: "add"`,
  and every designer declining, `"declined"`) compose their note as refusals
  (`aCoverage({ refused: true })`): the requirements and the change's own
  items, without the two counted sentences — *"so those aren't in place"* and
  *"Part of that didn't get built"* describe a change that was built, and
  nothing was. `coverOther` is not sent on a refusal. The developer fields
  (`invalidProps`, `droppedFields`) keep the findings.
- **The reply's facts on a refusal** (`addonReplyFacts`, the `ok: false`
  branch) are the refusal's own sentence, then one fact per requirement the
  judgment kept, each its state's kind — under the reply writer's existing
  completeness check.
- **Nothing here says work was done on a refusal.** A requirement carried by
  what the site already had is told as already there (below); an older stored
  refusal that told one as "set up" or "scheduled" is read as already there,
  because nothing was added; a refusal's list that does not read tells nothing
  — never its older note, which may say "I've set that up"; and its counted
  sentences are never told.
- **An incomplete judgment beside a refusal tells nothing** — not even the
  verdicts that came back, because a judgment is whole or it is not used (the
  incomplete-judgment fix). The refusal's own sentence stands, nothing is
  applied or charged, and no requirement is called set up, already there or
  not done.
- **The browser's refusal** (`public/chat.js`, `addonAnswer`) prints the
  server's note under the refusal's own sentence, in all three arms (with a
  question, with a sentence, without one), verbatim: `coverNote`'s rule. With a
  model-written reply, that reply is shown as it came, as before.
- **The codes' own refusal** (`qr-dependency`: every page was withheld for a
  code whose page did not come) names the page the codes were for — its
  sentence said "that page" and nothing before it said which — and sends
  `missingPages`.
- **Execution and charging are unchanged**: every refusal still costs 0,
  charges nothing and writes nothing (asserted in each case).

### What the site already had

- **"I've set that up" is said only of what this change set up.** A requirement
  whose every carrier was found among what the site already had
  (`foundIn: "existing"`, the distinction the record has kept since
  2026-09-15) is told `already-there`, on every path:
  - the fact: *"Their site already had this before this request, and nothing
    here can check that it works: …"* (`note`, like set-up);
  - the note: *"Your site already had that in place, but I can't confirm from
    here that …"* — the set-up sentence's own words without the claim.
- **Where it was found means every carrier.** `foundIn` names a carrier this
  change applied whenever it applied one, so a requirement it helped carry out
  is still "set up", whichever carrier the judgment named first.

### The four lists

- **One selection per list, read twice** (`builder/site-add.mjs`): by its
  sentence, which the browser prints, and by `warningReport`, which returns one
  entry per thing, in the note's order:
  - `page` — a page this change set out to add that is not there;
  - `qr` — a code not added because its page is not there (`route`);
  - `held-page` / `held-section` — a page or a component kept out because its
    change depended on such a code, with `added`;
  - `seed` — a table whose starter rows were not put in, with the engine's own
    reason (`why`): `not-display`, `has-rows`, `no-table`, `no-columns`,
    `row-failed`, or none when the engine gave one this does not recognise
    (a database error's text);
  - `fill` — a table this change reads that nothing can put rows into.
- **The route sends it** (`warningsTold`) and `coverOther` keeps only the two
  counted sentences, which name no items.
- **Each entry is its own fact** (`not-done`, as the one sentence they replace
  was), so the completeness check holds the reply model to every one.
- **The sentences name every item**: no slice, no "and N more", nothing silent.
- **Each seed skip keeps its reason.** The note says "starts empty" only of the
  tables skipped for who can read them; "Not all of the starter rows I had
  ready for X went in" of a table the database refused rows for; and names the
  rest with no reason. The facts state each reason.
- **The route keeps every seed skip** and sends `seedSkips` and `noPopulation`
  whole.
- **Deduplication** is each list's own, unchanged: a page, a code, a held page
  or section, a seed table (its first reason) or an empty table is said once.
  A page both missing and withheld is two entries — two different things to
  know about it.
- **An answer stored before the list** reads as it did (`coverOther` as one
  fact), and a list that does not read is the whole note as one fact (on a
  refusal, nothing).

No new canned customer message: the facts are statements for the model, which
writes the reply. The browser's fallback prints the server's existing sentences,
now whole; the two sentence changes are the already-there one (the set-up
sentence without its false claim) and the seed note's split by reason (the same
sentence, said only of the skips it is true of, and its first half for a
refused row and for the rest).

## 3. What changed

- `builder/site-add.mjs`: `warningReport` (new), and the four sentences uncut
  over one selection each (`missingRoutes`, `qrOutcomes`, `seedSkipsOf`,
  `fillTables`); `seedSkipNote` split by the engine's reason.
- `builder/site-requirements.mjs`: `TOLD` gains `already-there`;
  `requirementReport` tells a requirement found only where it already was as
  `already-there`; `toldNote` says it; `requirementOutcomes` names an applied
  carrier first.
- `builder/site-reply.mjs`: `already-there` among `TOLD_FACTS`; `WARNED_FACTS`
  and `SEED_FACTS`; `coverFacts` reads `warningsTold` (cannot-tell is the whole
  note) and has its refusal reading; the `ok: false` branch reads the
  requirements.
- `worker.js`: `aCoverage({ refused })`, `warningsTold`, `coverOther` counted
  only, the seed skips and empty tables whole, both refusals as refusals, the
  codes' refusal naming the missing page.
- `public/chat.js`: the refusal prints `coverNote` under its sentence.
- `test/fixtures/addon-route.mjs`: one option, `rowFail`, refusing every starter
  row of the tables it names in Postgres's own error shape — the only way a
  case drives more seed skips than tables (six tables is the most one designer
  may add).
- Tests: `test/addon-refusal-warnings.test.mjs`, new (16 cases); re-anchored:
  TOLD 1, 2, 4, 11 and 12 (`requirement-told`), the missing-pages count
  (`addon-steps`), the existing-QR sentence (`addon-route`), four guards in
  `requirement-coverage` (the composer's signature, both refusals, the note's
  composition), and JUDGE 16's comment.

## 4. Verification

- **The tests** (`test/addon-refusal-warnings.test.mjs`, 16 cases):
  - **REFUSE 1, a refusal beside a judgment that finished**, through the
    route: five requirements beside a refused 3D scene — can't do yet, not
    done, carried by what the site already had, nobody could see, and an extra
    the judgment set aside. The list, the facts (the refusal's own first, then
    one per requirement, each its state's kind), the outcome ("not done") and
    the screen ("⚠️ " + the refusal's sentence + the note) each have the four
    requirements; nothing anywhere says "set up" or "scheduled", the extra is
    nowhere, and nothing is applied or charged;
  - **REFUSE 2, the same refusal beside a judgment that did not finish** (empty
    twice, one verdict of five twice, cut off): no list, an empty note, the
    refusal's own fact alone, the screen its sentence alone; nothing applied
    or charged;
  - **REFUSE 3, every designer declined**, each having written requirements:
    the all-declined refusal tells each the same way, and its developer record
    says the email requirement was found where it already was;
  - **REFUSE 4, a refused addition inside a request**: the answer its job
    stores carries every requirement, the background reply writer is given
    each as a fact of its own, and the reply it keeps names each;
  - **REFUSE 5, answers stored before this fix, replayed**: a refusal's
    "set up" and "scheduled" are read as already there; a refusal's
    unreadable list (five shapes) tells nothing, never its older note; a
    refusal stored before the list tells its own sentence only; a success
    reads as it always did;
  - **REFUSE 6**: a refusal after a design asking for two guarantees the
    database does not offer says nothing about them to the customer (the
    developer's `invalidProps` keeps them); on a change that was built the same
    finding is told once, beside the requirement;
  - **ALREADY 1**: a requirement carried by the site's table and this change's
    is set up by this change, whichever was named first; only the site's own is
    already there; only this change's is set up;
  - **WARN 1, every list above its old cut, at the module**: five missing
    pages, four codes and a repeat, four withheld pages (two new) and a repeat,
    four withheld sections (two new), fifteen seed skips over thirteen tables
    with every reason the engine writes (and a table repeated with a second
    reason), thirteen empty tables and a repeat — one entry each, in the note's
    order; the sentences name every one; the seed note says "starts empty" only
    of the tables skipped for who can read them; one fact each, every one not
    done, with its own words;
  - **WARN 2, the reply writer's own completeness check**: every item is shown
    to the model by its id; the last left out is asked for again by its id;
    left out twice, the reply is not used;
  - **WARN 3–5, through the real route**: five pages that did not come; a code
    whose page did not come and the five new pages that only showed it (and
    the codes' own refusal when nothing else was left, naming the page);
    eighteen refused starter rows over six tables (`rowFail`), five tables
    skipped for who can read them beside one that already had rows, and five
    tables nothing can fill — every one on the answer, a fact of its own, and on
    the screen;
  - **WARN 6, mixed**: four undone requirements, four pages that did not come
    and a table's skipped starter rows, each once, the outcome "partly";
  - **WARN 7, the whole path in a request**: the addition's missing pages are
    in the answer its job stored, given to the background writer one fact
    each, and named in the reply it keeps;
  - **WARN 8**: an answer stored before the list reads as it did; a list that
    does not read (seven shapes) is the whole note as one fact, and on a
    refusal nothing;
  - **WIRE 1**: the route's lines — every seed skip kept, the lists whole on
    the wire, both refusals as refusals, the codes' refusal naming the page
    first, and the browser's refusal printing the note in all three arms.
- **Re-anchored**: TOLD 1, 2 and 4 gain three requirements carried by what the
  site already had (above the set-up sentence's old cut of two); TOLD 11 pins
  the fix where it pinned the omission; TOLD 12 reads the missing page as its
  own fact; `addon-steps`' missing-pages count; `addon-route`'s existing QR
  code, now *"Your site already had that in place…"* and never "I've set that
  up" (a job-only change made no code); four guards in `requirement-coverage`.
- **The red check**: the new file against `f060a8b8` (the branch before this
  fix) in a separate worktree, `warningReport` bound to nothing there and the
  harness's `rowFail` copied in. **15 of 16 fail**, the route and request cases
  on the omissions themselves:
  - REFUSE 1 and 3: the old report told the email requirement `set-up` on a
    refusal — the false claim the omission was hiding;
  - REFUSE 4: the background writer was given the refusal's own fact and the
    routing charge, and no requirement;
  - REFUSE 6: the refusal's note said *"I also asked the database for 2
    guarantees it doesn't offer, so those aren't in place."*;
  - ALREADY 1: the first carrier named decided, so it read "existing";
  - WARN 3, 4 and 6: no list was sent; WARN 5: twelve of eighteen seed skips
    reached the answer; WARN 7: the stored answer's note said "/menu, /hours,
    /team and 2 more";
  - WARN 1, 2 and 8 at the missing `warningReport`; WIRE 1 at its landmarks;
  - **REFUSE 2 passes on both trees**, as it should: the old code told nothing
    on any refusal, and the case pins that an incomplete judgment beside a
    refusal still tells nothing.
- **The sweep** (`scripts/mutants/refusal-warnings.json`, 35 planted defects
  and 4 comment-only controls over the five files, run against the new file,
  `requirement-told`, `requirement-coverage`, `site-add`, `backend-repair`,
  `addon-steps` and `addon-judgment` from a green baseline): **35 of 35 killed
  on the first run**, and the 4 controls survived. It plants: a refusal's facts
  dropped, its older "set up" kept, its old note or counted sentences told, the
  mapping applied to a success; already-there said as set up, never said, or
  said of what this change set up; the first carrier deciding; each list cut at
  three in the report and in its sentence; a repeat told twice; a held page's
  `added` lost; a refused row read as a table; "already has rows" unrecognised;
  every skip "starting empty"; the last reason winning; the items never told,
  told as notes, or an unreadable or empty list trusted; a seed reason dropped;
  the route keeping or sending twelve, cutting the empty tables, sending no
  list, or carrying the item sentences in `coverOther` again; each refusal's
  note composed as a success; the browser dropping the note; the codes'
  refusal not naming the page.
- **Twelve older mutants re-anchored** (`addon-delivery`,
  `addon-parts-and-frames`, `addon-qr-and-identity`, `backend-discovery`,
  `requirement-told`), whose lines this change rewrote, onto the property each
  guards: **12 of 12 killed**, the control survived. `backend-discovery`'s pair
  of empty checks became one selection, so its mutant now plants the
  selector's blank-name check, and `seedSkipNote`'s early return is a declared
  shortcut. **Last round's whole spec** (`requirement-told.json`) re-run on the
  new code: **35 of 35 killed** with this batch's file in its set — two of its
  mutants (an empty list trusted; `coverOther` not sent) are now killed there,
  because the missing pages left `coverOther` for `warningsTold`; REFUSE 6 kills
  the second by behaviour (shown by hand, the source guard aside).
- **The suite**: `9553 / 9553 / 0 / 0` here (the 9,537 before and the 16 new
  cases), in 227 s, the real-browser cases included. The earlier corrections
  are among them, unchanged and green: run 101's three, the requirement
  judgment, the incomplete judgment and the requirement reporting.
- **CI**: read to completion after the push, in the record that follows this
  one.
- **The image** (predicted, not built): `140199b61e2581c4` at the branch before
  this fix becomes `3f3862946e322404` at `46a7746c`. There are 194 inputs, none
  under `public/`. Four differ (`builder/site-add.mjs`,
  `builder/site-reply.mjs`, `builder/site-requirements.mjs`, `worker.js`), and
  five from deploy 2184's `589e3e4e85a20066` (those four and
  `builder/site-addon.mjs`). A merge would build it, and nothing was built.
  `public/chat.js` changed too: the Worker serves it, so a merge would owe the
  served-file byte check.

## 5. Remaining limitations, kept separate

- **A refusal after the design stage carries no requirement outcomes** (the
  backlog): only the two designer refusals carry the report; the later ones
  (`no-photo`, `unseen-rewrite`, the merge refusals, `rewrote`,
  `qr-dependency`, `not-landed`, `lost-photos`, `compile`) send their own
  sentence. And the reply's facts open every `ok: false` with "Nothing was
  added", including the compile failure after the database change was made,
  whose own sentence says it was.
- **An incomplete judgment beside a refusal tells nothing**, by the rule: the
  bank transfer the customer asked for is then not named beside the refusal.
  Nothing is claimed either way.
- **The codes' own refusal** (`qr-dependency`) reaches the reply model as its
  quoted sentence, now whole and naming the page, not one fact per item.
- **More than three dropped codes cannot come from one request** (the qr
  designer answers one code), so the codes' list past its old cut is shown at
  the module; the pages and sections withheld with a code are shown through the
  route.
- **The seed note's display-only sentence** says "isn't one visitors can read"
  of every table skipped for that reason, including one visitors can read but
  members write (the backlog); the reply model's fact states the rule exactly.
- **Found here, not fixed** (the backlog): the lint's "worth knowing" list is
  cut at four on the wire and three on the screen and can name pages that were
  withheld; the seed engine numbers a refused row by the rows that went in; a
  table whose starter rows were skipped is never also reported as one nothing
  can fill.
- **Parked, as the owner said**: a designer's requirements past its twelfth are
  set aside at intake (`over-cap`) and never told.
- **Nothing here is shown live.** A real reply model's wording, with many
  items, is untested; the completeness check holds it to naming each.
