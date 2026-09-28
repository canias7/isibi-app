# Edit-path history, 2026-09-24: preservation, routing answers, the existing-site entry, add-on and edit replies

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). In order: the full
> page writer dropping unrelated content (reproduced), the preservation check,
> groups asked for at once and a declared group constraining its answer
> (deploy 2151); a routing answer that cannot be acted on stopping a live site
> (2152); an existing site waiting for its page list, a stopped message keeping
> its files, and each composer's words and files belonging to its own site
> (2153); the add-on's own failures and its reply validation (2154); the edit
> reply validated, the edit latch held for exactly its ask, and a published edit
> this page fails to show (2155).
>
> What is still law from these rounds is summarised in CLAUDE.md.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at its other sections.

### THE FULL PAGE WRITER DROPS UNRELATED CONTENT SILENTLY — REPRODUCED (2026-09-24; built, next section — merged and deployed in 2151)

Owner: *"Investigate whether the full page writer can silently drop unrelated
content during a small requested edit … Use a page containing distinct
sections, links and a custom component; request one narrow change, then supply
an answer that also omits an unrelated section. Check the compiler payload,
stored source and customer reply. Include controls for the correct narrow edit
and an explicitly requested section removal. Return the concrete reproduction
and smallest proposed protection before implementing it. Keep full-site revise
separate."* **Reproduced; nothing built.** The reproduction is COMMITTED —
`test/edit-page-keep.test.mjs`, **13 cases** through the real `POST
/api/site/<slug>/edit`, supplied answers, the tweak declining so the full
writer runs — as a CHARACTERISATION of today's behaviour, no product change:
the OPEN DEFECT cases assert the loss IS published, so a fix must flip each one
deliberately into a refusal case, and a fix that leaves one green has not fixed
that shape. Suite **7,265 → 7,278** locally (`# tests 7278 / # pass 7278 /
# fail 0 / # skipped 0`, `duration_ms 116,832`), exactly those cases; **and CI
matches**: unit run **`35945643176` on `32e0966b`** reads **`# tests 7278 / #
pass 7274 / # fail 0 / # skipped 4`** (`duration_ms 122,592`) — the total is
what matches, `pass` differing by CI's four skips — with all thirteen cases
found passing BY NAME and zero anchored `not ok` lines in the downloaded log.
No `site build` fires for it: a `test/` file outside that workflow's `paths`
produces no run. **The stamp chain ends at `32e0966b`.**

**THE FIXTURE**: a home page of four sections — a hero with a `<Link
to="/menu">`, the opening hours, "Order ahead" rendering the site's own
`<OrderForm />` (`./-parts/order-form`, stored in `parts.json`), and "Find us"
with a `<Link to="/visit">Directions</Link>` — beside `/menu`, `/visit` and
`/contact` pages. The narrow ask: *"Show the opening hours on the home page as
a short list…"*.

Every case publishes today, stores the writer's answer byte for byte, leaves the
other pages and the component FILE untouched, charges 3 (4 through look, the
picker call) and says *"✅ Updated /."*:

| kind | the ask → the writer's answer | what the existing readers see |
|---|---|---|
| must stay published | the hours → just the hours (correct) | links and `order-form` kept |
| must stay published | *"Put "Find us" at the top"* → reordered | the same links, `rendered` |
| must stay published | *"Take the "Find us" section off"* via look, picker `removes: ["components"]` → removed | Directions gone, as asked |
| must stay published | the same removal routed straight to `page` — no picker, no removal signal at all | the same |
| must stay published | *"Send the Directions link to the contact page"* → retargeted | `Directions → /contact` |
| must stay published | the hours → the order form rendered through `const Form = OrderForm` | `partUse` **`unsure`**, never `unused` |
| **open defect** | the hours → + "Find us" left out | `Directions → /visit` gone |
| **open defect** | the hours → + "Order ahead" left out, import kept | **`unused`** — a confirmed absence |
| **open defect** | the hours → + "Order ahead" left out, import removed too | **`none`** — confirmed against the before |
| **open defect** | the hours → Directions removed, `Get in touch → /contact` added | **2 links before, 2 after** |
| **open defect** | *"Take "Find us" off"* via look → + "Order ahead" left out | Directions gone (asked) + `unused` (not asked) |
| open, outside the proposed inventory | the hero line → + "Opening hours" left out | nothing the inventory reads moved |

**SO THE LOSS IS SILENT AND INDISTINGUISHABLE**: the page rung's walls cover
photographs, oversized or unreadable components and no-change, and nothing
compares the page's sections, links or rendered components before and after —
a silent unrelated loss reads exactly as a correct edit or an asked-for removal.

**⚠ THE MEASUREMENT THAT DECIDES WHAT CAN BE PROTECTED — RUN 11.** Over the
saved before/after pairs of the live page-rung runs (9, 11, 17, 24, 26): section
titles live mostly in kit components' props, not raw `<h1>`–`<h6>` (the bakery
page has 0; fretwork-1 2 across 13–15 sections), and **run 11 — a correct,
requested consolidation routed straight to the page layer with no removal mark
— took `<section>` from 15 to 13.** So any block- or section-level refusal would
have refused a real, correct edit. What NONE of the five real edits lost is an
in-body link or one of the site's own components.

**THE FIRST PROPOSAL WAS REJECTED ON FOUR POINTS (owner, 2026-09-24), and each
is a rule for this protection now:** *"1. Preserve intentional section removal
whether it arrives through look or directly through page. Blocking the direct
route is a regression, not an acceptable coverage limit. 2. Scope removal
permission to the requested target. "Remove Find us" must not also authorize
dropping OrderForm or unrelated links. 3. Do not use link counts alone.
Removing Directions while adding a different link must not conceal the loss.
Preserve legitimate requested retargeting. 4. Check component loss both when
its import remains and when the writer removes the import too. Keep uncertain
readings distinct from confirmed absence."* The first proposal took its
permission from the picker's `removes`, which fails 1 and 2 at once —
**`readRemoves` answers LANE names (`components`), never a target, and only the
look door has a picker** — and it counted links, which fails 3.

**THE REVISED DESIGN (awaiting the owner; nothing built):**

- **THE FACTS ARE CODE'S, THE INTENT IS THE CUSTOMER'S OWN WORDS, AND THE TWO
  ARE NEVER MIXED.** Code computes exactly what the answer lost, from the two
  existing readers; a small model call — made ONLY when something was lost —
  answers, item by item, whether the customer's message asked for it, and must
  QUOTE the words that do; code checks the quote is really in the message. No
  phrase matching in code: a deterministic reader of intent is refused by
  paraphrase and fooled by *"keep Find us"*, and this file's standing rule
  against homemade analysis engines applies to language as it did to syntax.
- **LINKS ARE PAIRED BY IDENTITY, NEVER COUNTED.** `linkSlots` gives each
  in-body literal link its words and destination; before and after pair in
  order, each after-link used once: **(1)** same words and destination → kept;
  **(2)** same words, new destination → **RETARGETED**; **(3)** same
  destination, new words → relabelled, kept (words are text, which this does
  not protect); **(4)** a before-link left over → **LOST**, an after-link left
  over → added, **which never offsets a loss**. Words before destination, so an
  ambiguous pairing resolves toward asking; a wordless link pairs by
  destination alone.
- **A COMPONENT IS READ BY `partUse` ON BOTH SIDES, AND ONLY WHAT THE BEFORE
  PROVABLY SHOWED IS PROTECTED:**

  | before | after | reading |
  |---|---|---|
  | `rendered` | `rendered` | kept |
  | `rendered` | `unused` — import kept, tag gone, name mentioned nowhere | **CONFIRMED ABSENT** |
  | `rendered` | `none`, and no tag of its old binding left | **CONFIRMED ABSENT** (import removed too) |
  | `rendered` | `unsure` — still mentioned, not provably rendered | **UNCERTAIN** |
  | `rendered` | `none`, but its old binding still appears as a tag | **UNCERTAIN** |
  | `unsure` | anything but `rendered` | **UNCERTAIN** — never confirmed shown |

  The component list comes from the BEFORE's imports (`localParts`), so a
  writer that deletes the import line cannot take the component out of the
  question — which is the whole of point 4's second half.
- **PERMISSION IS PER ITEM, FROM THE CUSTOMER'S MESSAGE, AND IDENTICAL ON BOTH
  ROUTES** — the message is the one thing the look door and the direct page
  route both carry. The judge sees the message verbatim and the numbered items:
  the kind; the words or the destination; the heading the item sat under (the
  nearest `<h1>`–`<h6>` or kit `title`/`heading` prop above it in the BEFORE —
  a description, never a permission and never a grouping); a retarget's old and
  new destination; a component's declared `does` when `look.tsx` has one. Its
  tool is one property, `answers: [{n, asked, quote}]`, on the picker's quick
  model (`eQuick`, `eQuickModel` — every small call follows the picker).
  **`asked: true` counts only with a quote found in the message** after folding
  case, whitespace and quote marks, holding a word of three or more letters; an
  item missing from the answer, or answered twice in disagreement, is NOT
  asked. **⚠ CORRECTED (owner, 2026-09-24): a verified quote proves the words
  OCCUR in the request; whether they AUTHORISE that particular loss is still
  the model's judgement, and nothing in code makes that judgement a
  guarantee.** This paragraph first said *"Take the "Find us" section off"*
  *cannot* authorise the order form — true of code's own checks (as built, a
  quote must also NAME its item — next section), never of the judgement: a
  judge that quotes *"keep the order form"* as permission is quoting real words
  that name the item, and it is believed.
- **FOUR OUTCOMES.** Everything lost was asked → publishes, the reply
  unchanged, the judge's tokens billed with the edit. Anything not asked →
  **409 `withheld`, cost 0, nothing compiled or stored** — the photo refusal's
  shape, so `stepWroteNothing`, the whole-request note and the job path's
  refund read it unchanged — naming each unasked item in the customer's words
  (a link by its words, a component by the heading it sat under or its declared
  `does`, never a file name) and how to authorise it. The judge unreachable or
  unreadable → **503 `withheld`, `ours`, cost 0**, with a DIFFERENT sentence (*"I
  couldn't check that the rewrite kept everything you didn't ask to change —
  that's on us"*), because the loss may have been asked for: fail closed, two
  facts, two sentences. **An UNCERTAIN component never refuses and is never
  counted as kept**: `partsUnsure` on the reply and one clause naming the
  heading — the only browser change, recommended, because silence would let
  "✅ Updated /." stand over something the check could not see.
- **BOTH RUNGS, ONE CONTRACT — the photo protection's own rules**: asked of the
  ACCEPTED publication, after the photo refusal, before `publishStep`; the
  before is `eSrc`, so what an earlier step of the same message did is already
  in it; and a loss the TWEAK made REFUSES rather than falling through (the
  owner's own ruling on the photo case: *"Do not publish the loss merely
  because matching failed, or trigger a full rewrite"*). On the tweak only
  links can arrive — `sameProse` already refuses worded content and
  `partEligible` own-component identity — so what reaches the check there is a
  wordless link or a retarget.
- **MEASURED**: the prototype classifies every committed case as above; over
  the five saved live page edits (runs 9, 11, 17, 24, 26 — runs 12, 14, 21 and
  23 changed no page) it finds nothing lost, retargeted, relabelled, added or
  uncertain, so **the judge would have been called 0 times. n = 5**, said as
  n = 5; no larger set of real before/after page pairs exists here.
- **⚠ WHAT STAYS OPEN — THIS IS A PARTIAL IMPROVEMENT, NOT CONTENT
  PRESERVATION** (owner): a section of plain words or kit components (the
  committed hours case stays green under this design by construction, which is
  why it is kept); links built from data (`to={…}`), links inside components,
  and kit components' own `href` props; a section MOVED into a new component
  takes its links out of the page's inventory and would be REFUSED (a
  conservative false refusal; the remedy, if it is met, is reading the rendered
  components' links too); the judge can misattribute a quote that IS in the
  message — supplied answers prove the path and never the judgment, and only a
  paid run measures that. Full-site revise untouched.
- **THE FOOTPRINT, ON APPROVAL**: `builder/page-keep.mjs` (new, pure: the
  inventory, the pairing, the component states, the headings, the judge's tool,
  prompt and reader, the sentences); two call sites in `worker.js`, one per
  rung; the one clause in `chat.js` if approved. Tests: the OPEN DEFECT cases
  flipped into refusals, the MUST-STAY cases kept publishing (the removals and
  the retarget now with a supplied "asked"), plus a quote not in the message, a
  judge that fails, the tweak path and the job path's money; a focused mutation
  check, no broad sweep.

### THE PRESERVATION CHECK, BUILT (2026-09-24, merged and deployed in 2151 — no paid run)

Owner: *"Proceed with the bounded implementation of the revised preservation
check. The committed reproductions check out."* — six requirements, each met
below and each with a case: the documentation's permission claim corrected (a
verified quote proves occurrence; the model judges authorisation); intentional
removals through look AND page, and requested retargets, preserved without an
authorised removal authorising anything else; exact link identity matched
across both inventories before any retarget or relabel, with repeated labels
and reorders covered; negative controls for *"keep the order form"*, an
unrelated removal and a genuine quote on the wrong item, with supplied judge
answers kept apart from any claim about a real model; the same protection on
both writers before publication, a refused tweak buying no rewrite, and
compiler/store inactivity and real billing verified on refusal — including a
mixed request where another step succeeded; the five defect cases flipped, the
controls kept, uncertain components kept apart from confirmed loss, and
plain-text/kit-only loss explicitly open.

**THE MODULE**: `builder/page-keep.mjs`, pure, on the Dockerfile's worker COPY
line — and `container-images` went red until it was COMMITTED, the guard asking
git rather than the disk, exactly as designed. `site-files.mjs` gained two
exported readers (`partBindings`, `tagAt`/`drawsTag`) rather than a second
reader of an import clause.

- **LINKS, PAIRED BY IDENTITY IN SIX PASSES** — each rule twice, first between
  links under the same heading, then anywhere: exact (words and destination) →
  kept · same words, new destination → RETARGETED, judged · same destination,
  new words → relabelled, kept · a before-link left over → LOST, judged · an
  after-link left over → added, which never offsets a loss. **Exact across the
  whole page BEFORE any retarget**: a moved "Book now → /book" beside a new
  "Book now → /offers" is kept, never claimed as a retarget (the K-2 mutant
  dies on it). **The same-heading pass is what keeps a repeated label honest**:
  two "Book now → /book", the FIRST section removed, and the loss is reported in
  the first section (K-1). A wordless link pairs by destination alone. **A
  LIMIT, STATED**: two links keeping their words and swapping destinations read
  as moved.
- **COMPONENTS, BY THE APPROVED TABLE**: rendered → `unused`, and rendered →
  `none` with no tag of the old binding left, are CONFIRMED losses and judged;
  rendered → `unsure`, rendered → `none` with the tag still drawn, and `unsure`
  → anything but rendered are UNCERTAIN — never judged, never refused, never
  counted as kept. `partsUnsure` rides the reply in the customer's words (the
  heading, else the declared `does`, never a file name) and the browser adds ONE
  clause: *"I couldn’t confirm that the “Order ahead” section is still on the
  page — have a look before you share it."* **`unsure` → `unsure` reports too**,
  as the table says, so a page rendering a component through an alias gets the
  clause on every edit. **Measured, and the sample is narrow**: the 324-file
  corpus imports no `-parts/` component at all, and across the nine saved run
  artifacts (29 page readings) the only page importing one is fretwork-1's home
  page — 8 readings × 3 components, all 24 `rendered → rendered`, zero
  uncertain. One site's one page, said as that.
- **THE JUDGE**: tool `keep_check`, one property `answers: [{n, asked, quote}]`
  (plus an optional `group` since the next section's round),
  on `eQuickModel` through `eQuick("keep_check")`, `KEEP_MAX_TOKENS` 1024, called
  ONLY when something was lost. Its rules say a request to KEEP something, or a
  mention, is not a request to remove it, and that asking for one thing never
  asks for another.
- **TWO CHECKS ON EVERY QUOTE — AND WHAT NEITHER PROVES.** (1) The words occur
  in the message: whole words, case/spacing/punctuation folded, at least one
  word of three letters. (2) The quote NAMES its item: it shares a naming word
  with the item's link words, heading, destination (or new destination),
  component name or declared purpose, after a short stop list of grammar, page
  furniture and request verbs. **(2) is what refuses a genuine quote attached to
  the wrong item.** **Neither proves authorisation**: *"keep the order form"*
  occurs and names the item, and a judge that reads it as permission is
  believed — a case says so (`LIMIT, NOT A PROTECTION`). **The cost of (2),
  stated**: a paraphrase sharing no naming word (*"the map link"* for a link
  that says "Directions") is refused and the sentence asks for it to be named;
  an item with NO naming words (a wordless link to `/` under no heading) is left
  to the judge alone. **⚠ AND (2) IS NO LONGER MANDATORY** (owner, the same day:
  *"a clear request about a group cannot succeed unless the customer names each
  member"*): a group the judge declares, of a kind that can hold the item, is
  the other way a quote covers it — *a group asked for at once*, below. **⚠ AND
  THE TWO WAYS ARE EXCLUSIVE PER ANSWER** (owner, the same day): an answer that
  declares a group is checked by kind ALONE, so (2) cannot rescue a group that
  cannot hold the item — *a declared group constrains its answer*, below.
- **FOUR VERDICTS, ONE WRITER (`keepRefusal`) FOR BOTH RUNGS**: `kept` (no
  call) · `asked` (publish; the judge's tokens billed with the edit in the ONE
  `eCharge`) · `withheld` (409 `withheld`, cost 0, `contentBlocked:
  [{kind, label, href, to, name, section, group, why}]`, nothing compiled,
  stored or charged) · `unchecked` (503 `withheld`, `ours`, `contentUnchecked`). The photo
  refusal's shape, so the merge's `stepWroteNothing`, the browser's
  whole-request note and the job path's refund read it with no new branch.
- **BOTH WRITERS, BEFORE THE PUBLISH.** The tweak after its photograph refusal,
  before `publishStep` — **and its refusal RETURNS**: the case asserts the calls
  are exactly `write_tweak, keep_check`, no `write_pages`. The rewrite after its
  photograph refusal, over the guarded page, with the site's declared `tsx`
  purposes. A tweak whose compile then fails hands its judge's tokens to the
  rewrite's bill (`twJudged`), as `twSpent` hands on the tweak's own. The
  tweak's `partsUnsure` line is a belt that cannot fire today (a re-bound
  component moves the identity `partEligible` compares) and says so.
- **THE MONEY, DRIVEN ON BOTH PATHS**: a publish debits
  `pageCredits(tweak, writer, judge)`, a refusal debits nothing; on the job path
  one `edit_reserve` on a publish, none on a refusal, `edit_finalize p_ok:
  false`. **The mixed request** (css + a refused page): one compile carrying the
  ORIGINAL home page and the new stylesheet, charged (sync) and reserved (job)
  for the picker and the css lane only, the refusal on `partial` and on the
  screen after the look's sentence, and no whole-request note.

**EVIDENCE.** `test/edit-page-keep.test.mjs`, **13 → 42 cases**, every route
case through the real `POST /api/site/<slug>/edit` with every model answer
SUPPLIED, asserting the calls, the compiler payload, the store (the page, the
other pages, the component file, the stylesheet), the debits or reservations,
and the screen through the browser's own `editBrowserReply`. **Red 23 of 42
against the unfixed route** (`80036b40` in a throwaway worktree, only the module
and the two readers copied in so the file loads), each on its own gate —
published where a refusal was expected, no judge call, no clause, the judge
unbilled — and **with the calls assertion cut in the throwaway copy the mixed
case still fails on the compiler payload**, the loss shipping. The 19 green on
both are the pure module cases, the readers' baseline and the four controls
(the correct edit, the reorder, the plain-words drop, the visual tweak).
**One pre-existing guard re-anchored, not appeased**: `site-tweak`'s *"WHAT THE
CHEAP ATTEMPT COST IS BILLED WITH THE REWRITE"* was pinned to
`eCharge(eGen && eGen.usage, twSpent)` WITH its closing parenthesis; the
property is that `twSpent` rides in the rewrite's own call, and the judge's
honest third argument read as the cheap attempt going unbilled. **Focused
mutation check `scripts/mutants/page-keep.json`: 21 mutants, 21 killed, 0
survived, 0 never applied, the comment-only control surviving**, over
`page-keep.mjs`, `worker.js` and `chat.js` against eight files (`edit-page-keep`,
`site-tweak`, `site-files`, `edit-browser-reply`, `edit-page-protect`,
`edit-parts`, `edit-failure`, `free-identifiers`); all three swept files
byte-identical to their scratchpad backups afterwards. **Two gaps were found
while WRITING the spec, before it ran**: nothing asserted the cross-page exact
pass (a moved link beside a new same-words link) or that the site's declared
purpose reaches the judge through the route — each got its own case or
assertion first. **Suite 7,307 locally** (`# tests 7307 / # pass 7307 / #
fail 0 / # skipped 0`, `duration_ms 115,247`) — **+29 against 7,278**, exactly
the file's 13 → 42. **AND THE CI UNIT HALF MATCHES**: run **`35949168893` on
`249fc8c7`** reads **`# tests 7307 / # pass 7303 / # fail 0 / # skipped 4`**
(`duration_ms 122,105`) — the total is what matches, `pass` differing by CI's
four skips — with all 42 of the file's cases found passing BY NAME in the
downloaded log archive and zero anchored `not ok N -` lines. **Rendered in the
real workspace chat, before and after** (the real `chat.js` and `styles.css`, the
sign-in gate held down on a served copy): eight scenarios, each chat sentence
the browser composer's own output captured out of the route — BEFORE on
`80036b40` in a throwaway worktree (which read **19 pass / 23 fail** again, the
red count reproduced), AFTER on this branch — and all sixteen drawn bubbles equal
to the composer's text. **AND `site build` run `35949168905` on `249fc8c7`**
(02:53:50 → 03:18:49Z, **24m59s**, all twenty steps) read all twelve counts
green out of its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build
**382**, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all passed`,
census 7 + 4 + 1 = **12**; the two known `##[error]` annotations
(`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the case that
compiles a broken page on purpose, the first directly above its own `ok` line,
the second followed by the two SSR-stream lines and then its own `ok`;
`tsc`-format lines 9 / 2 / 7; `site-build.mjs` **18m20s**. The docs-only
`5f4bdf53` reads the same four unit numbers on run `35950590450` (`duration_ms
121,019`, zero anchored `not ok N -` lines), so the pair off CI says that commit
moved the suite by zero. **The stamp chain ends at `249fc8c7`** — the last
commit to touch a product file (a comment in `worker.js`).

**⚠ WHAT IT DOES NOT CLAIM, AND WHAT STAYS OPEN.** Every model answer in the
evidence is SUPPLIED — the writers' and the judge's — so it proves the path,
never a real model's reading of a message; only a paid run measures that.
Outside the inventory: a section of plain words or kit-only markup (kept as a
publishing case), links built from data, links inside components, kit
components' own `href` props; a section moved into a new component is refused
(conservative). Full-site revise, translation and hydration untouched; the
model-written-replies preference stays recorded, not started.

### A GROUP ASKED FOR AT ONCE (2026-09-24, merged and deployed in 2151 — no paid run)

Owner, reproducing it through the real edit route: *"Request: “Remove all
links from the home page, keeping their text and everything else.” … Judge:
asked:true for both items, quoting the actual request. Result: 409 withheld,
both items quote-not-about-item. The customer is incorrectly told the message
didn't ask to remove those links. quoteNamesItem makes shared naming words
mandatory, so a clear request about a group cannot succeed unless the customer
names each member. Fix this without adding a growing English keyword parser or
a blanket removal bypass. Support explicitly requested groups while keeping
judgment per item. Quote presence and word overlap are not proof of intent."*

- **REPRODUCED FIRST, EXACTLY, AND IT IS TWO DEFECTS.** On `58dfa875`, the
  writer taking both `<Link>` wrappers off with every word kept and the judge
  answering `asked: true` for both with the request's own words: 409
  `withheld`, both `quote-not-about-item`, and the screen said *"…which your
  message didn't ask for…"*. (1) Naming was the ONLY way a quote could cover an
  item. (2) The refusal sentence claimed the JUDGE'S reading whatever refused —
  and here the judge had said yes.
- **THE GROUP IS THE JUDGE'S TO DECLARE AND CODE'S TO CHECK, BY KIND.** Each
  answer may carry `group`, enum `Object.keys(KEEP_GROUPS)`: `links` holds
  `link-lost` and `link-moved`; `sections` holds `part-gone` and `link-lost` (a
  section taken off takes its links). A quote covers an item when it occurs in
  the message AND either names the item OR comes with a declared group that can
  hold the item's kind (`groupCovers`). **⚠ CORRECTED THE SAME DAY: never
  "either" for one answer** — an answer that declares a group is checked by kind
  alone and one that declares none by naming alone (*a declared group
  constrains its answer*, below). **The kinds are the inventory's own, so
  nothing is a word list**: which group words ask for is reading English, and a
  keyword list (*"all links"*, *"every button"*, *"everything below the
  hours"*) only grows — and reads no message written in Spanish or French.
- **WHY THE JUDGE MUST DECLARE IT, AND WHAT THAT COSTS.** To code, the owner's
  quote *"Remove all links from the home page"* and the unrelated-removal
  control's *"Take the phone number off"* are ONE shape — words really in the
  message that name nothing on the page. Accepting the first without a
  declaration accepts the second — MEASURED: the G-2 mutant, which reads an
  undeclared quote as a links group, fails four cases run one at a time — that
  phone-number control, the owner's undeclared answer on both writers, and the
  wrong-item control (on its reason, `group-other-kind` where
  `quote-not-about-item` was due). **So the owner's
  exact supplied answer, with no group named, STILL REFUSES** — on both writers,
  now with the honest sentence. **Whether a real model fills `group` is
  unverified**; that is the risk this design carries, stated rather than hidden.
- **STILL JUDGED ITEM BY ITEM.** Every item needs its own answer; a group's
  quote must still occur in the message and must not be empty; a name not ours
  is `unknown-group`; a group stretched over a kind it cannot hold is
  `group-other-kind`. **⚠ "A GROUP CAN ONLY ADD AN ACCEPTANCE" WAS THE BYPASS
  (corrected the same day, owner).** This bullet first said a quote that names
  its item is accepted *with or without a group (a wrong group label on it costs
  nothing)*, and a unit case asserted exactly that for the order form under
  `group: "links"` — so under a heading the quote named, a links group answered
  for the form and it shipped. And a non-string `group` was *"not read at
  all"*, which made it no group and handed the answer back to naming — the same
  hole by a malformed route. Both are closed: *a declared group constrains its
  answer*, next section.
- **THE REFUSAL CLAIMS ONLY WHAT MADE IT.** `keepWithheldMsg` says *"which your
  message didn't ask for"* only when EVERY listed item's reason is `not-asked`
  — the judge said no. Any other reason (the judge said yes and a check could
  not confirm it, left an item out, contradicted itself) says *"which I
  couldn't confirm your message asked for"*, and a MIXED list takes the weaker
  clause, true of both. **The closing advice — *"say so in your message and
  send it again"* — is unchanged**, and reads oddly to a customer who already
  asked for the group; it is a wording question for the owner, not changed
  here.
- **THE RULES** gain three bullets: how to declare a group; *"A group is still
  answered item by item"* (anything the message leaves out of its group is not
  asked for); *"A group asks only for what it names"* (every link asks for no
  section; the sections ask for the links inside them and for no link anywhere
  else). `contentBlocked` carries `group`, so a `group-other-kind` refusal says
  which group was claimed.
- **THE ROUTE CASES THE OWNER LISTED**, all through `POST
  /api/site/<slug>/edit` with the calls, the compiler payload, the store, the
  money and the screen asserted: **remove all links keeping their text** —
  publishes on the full writer and on the TWEAK, the judge billed with the edit,
  exactly the two links asked about; **all links except one named link** —
  honoured, it publishes with only the one link asked about; the writer taking
  the named link too is refused for THAT link alone, `not-asked`, with the
  "didn't ask for" sentence; **a group beside an unrelated component loss** —
  the collateral loss alone is refused, on BOTH money paths (no reservation,
  `edit_finalize p_ok: false`), and refused by kind (`group-other-kind`, the
  claimed group on the record) when the judge stretches the links group over the
  order form; **the named-section removal (look and page) and retarget
  controls** — unchanged and green. Beside them: a sections group (*"every
  section off except the hours"*) publishes, three items each asked about; the
  owner's undeclared answer refuses on both writers.
- **TWO LIMITS, RECORDED AS CASES AND NEVER AS PROTECTIONS**: a judge that
  counts the excepted "Directions" into the group is believed — code does not
  read *"except"*; and a judge that calls a links quote a SECTIONS group is
  believed and the order form goes — which group words ask for is its reading,
  so the kind check stops a group being STRETCHED, never one being MISLABELLED.
  A sections group can likewise answer for any lost link by kind, not only the
  links that sat inside the sections that went.
- **EVIDENCE.** `test/edit-page-keep.test.mjs` **42 → 57 cases** (3 unit, 12
  route). **Red 14 of 57 against the unfixed `58dfa875`** (a throwaway worktree
  with only `KEEP_GROUPS`/`groupCovers` appended so the file loads): every group
  case that must publish fails on 409 `withheld` — the owner's regression — the
  wording cases on *"didn't ask for"*, and the except/collateral refusals on the
  other links refused beside them as `quote-not-about-item`. Twelve of the
  fifteen new cases are red there, plus two EXTENDED old ones (the judge-prompt
  case, now asserting the group rules, and the wrong-item control, now
  asserting the weaker sentence). The 43 green on both: the 40 old cases whose
  assertions did not change, the group table itself (copied in so the file
  loads), and two refusals that refuse either way — the collateral loss on the
  job path and the undeclared answer on the tweak.
  The eight focused files (`edit-page-keep`, `site-tweak`, `site-files`,
  `edit-browser-reply`, `edit-page-protect`, `edit-parts`, `edit-failure`,
  `free-identifiers`) **168 / 168**. **Suite 7,322 locally** (`# tests 7322 / #
  pass 7322 / # fail 0 / # skipped 0`, `duration_ms 116,718`) — **+15 against
  7,307**, exactly the file's 42 → 57. **AND THE CI UNIT HALF MATCHES**: run
  **`35953017719` on `5437cbf5`** reads **`# tests 7322 / # pass 7318 / # fail 0
  / # skipped 4`** (`duration_ms 118,157`), all fifteen new cases passing BY
  NAME in the downloaded log and zero anchored `not ok N -` lines. **Focused
  mutation check `scripts/mutants/keep-groups.json`: 19 mutants, 19 killed, 0
  survived, 0 never applied, the comment-only control surviving**, over
  `page-keep.mjs` and `worker.js` against the same eight files — the group
  ignored, an undeclared quote read as a links group, no kind check, an unknown
  group accepted, each kind list widened or narrowed, a group excusing a
  missing or absent quote, a coerced group, the group dropped from the record,
  the tool or any of the three rules losing it, and the refusal sentence always
  strong, never strong, or strong on one `not-asked`; both swept files
  byte-identical to their scratchpad backups (and to HEAD) afterwards. **One gap
  was found while WRITING the spec, before it ran**: nothing asserted that a
  non-string `group` is ignored, so that assertion went in first and the
  coercion mutant dies on it. **The final tree read 7,322 / 7,322 / 0 / 0 again
  locally** (`duration_ms 116,194`) — that assertion sits inside an existing
  case. **Rendered in the real workspace chat, before and after** (the real
  `chat.js` and `styles.css`, the sign-in gate held down on a served copy): six
  scenarios, every chat sentence the browser composer's own output captured out
  of the route — BEFORE on `58dfa875` in a throwaway worktree (which read 43
  pass / 14 fail again, the red count reproduced), AFTER on this branch — and all
  twelve drawn bubbles equal to the composer's text. **The docs-and-assertion
  commit `f89846de` reads the same four unit numbers** on run **`35953787126`**
  (`duration_ms 116,441`, zero anchored `not ok N -` lines), so it moved the
  count by zero. **AND `site build` run `35953017727` on `5437cbf5`** (03:49:03 →
  04:13:58Z, **24m55s**, all twenty steps) read all twelve counts green out of
  its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**,
  contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
  site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all
  passed`, census 7 + 4 + 1 = **12**; the two known `##[error]` annotations
  (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the case that
  compiles a broken page on purpose, the first directly above its own `ok`
  line, the second followed by the two SSR-stream lines and then its own `ok`;
  `tsc`-format lines 9 / 2 / 7; `site-build.mjs` **18m19s**. **⚠ THE RUN-LEVEL
  API ANSWERED `in_progress` FOR THIS RUN AT 04:14Z WHILE ITS JOB HAD COMPLETED
  AT 04:13:58** — `updated_at` still read the creation second — so the job
  listing, not the run, is what said it was done: this file's stale-snapshot
  trap, met again.
- **⚠ WHAT IT DOES NOT CLAIM.** Every model answer is SUPPLIED — the writers'
  and the judge's, the `group` included — so this proves the path: a declared
  group is read, kind-checked and judged per item, a collateral loss is still
  refused, and the refusal says only what made it. It proves nothing about how
  a real model reads *"all the links except Directions"*, or whether it declares
  a group at all. Plain-words and kit-only section loss stays OPEN; full-site
  revise, translation and hydration are untouched; model-written replies stay a
  recorded future preference.

### A DECLARED GROUP CONSTRAINS ITS ANSWER (2026-09-24, closed at code review, merged and deployed in 2151 — no paid run)

Owner, reproducing it through the edit route: *"Before: “Order ahead” contains
a link and OrderForm. Request: “Remove all links under ‘Order ahead’, keeping
their text.” Writer removes the link wrapper AND OrderForm. Judge answers
asked:true, group:"links" for both, quoting that request. Result: 200, compiled
and stored without the form, customer hears “✅ Updated /.” readKeep checks
groupCovers only when quoteNamesItem fails. The shared heading makes
quoteNamesItem pass, so a links-group answer authorizes a part-gone item. Make
an explicitly declared group constrain its answer. Matching words must not
override a contradictory group kind. A named individual removal can remain
valid without a group; an inconsistent answer should not silently regain
permission through the naming fallback."*

- **REPRODUCED FIRST, THROUGH THE ROUTE, ON BOTH MONEY PATHS.** On `f89846de`:
  200, the form gone from the compiled AND stored page, the synchronous reply
  charging `cost: 6`, and *"✅ Updated /."* on both paths — the owner's report
  exactly. **The cause is the ORDER of two checks**: `quoteNamesItem` ran first
  and `groupCovers` only when it failed, and *"Remove all links under ‘Order
  ahead’"* names the form by its heading (and by its own name), so the form's
  `group-other-kind` was never asked. **The previous round built that order on
  purpose** (*"A GROUP CAN ONLY ADD AN ACCEPTANCE"*, above, now corrected) and a
  unit case asserted it — the order form named outright and accepted under
  `group: "links"`. That case preserved the bypass, and the owner named it.
- **THE FIX IS WHICH QUESTION IS ASKED, NOT A NEW QUESTION.** An answer either
  declares a group or it does not, and `readKeep` asks exactly ONE question of
  it: a group answer is checked by KIND (`groupCovers`) and naming is never
  asked of it; a plain answer is checked by NAMING (`quoteNamesItem`), as
  before. So matching words cannot override a group that cannot hold the item,
  and a named individual removal with no group still publishes. **No English is
  read and nothing is bypassed**: the kinds are the inventory's own.
- **WHAT COUNTS AS DECLARED: anything in `group` but nothing.** Left out,
  `null` or blank is no group. A string that is not one of `KEEP_GROUPS`
  (`"components"`), or a value that is not a string at all (`["sections"]`,
  `7`), is a declaration nobody can read — refused as `unknown-group`, **never
  coerced and never ignored**, because ignoring it hands the answer back to
  naming. **⚠ CORRECTED**: last round a non-string group was *"not read at
  all"*, which made it an undeclared answer — on a quote that named its item,
  the same bypass by a malformed route. `null` and blank are read as absent
  deliberately: they declare nothing, so they open nothing an absent field does
  not.
- **AND A SECOND WAY IN, CLOSED WITH IT: TWO ANSWERS TO ONE ITEM.** The merge
  kept the first answer that carried a quote, so `{asked, quote}` then `{asked,
  quote, group: "links"}` for the form kept the plain one and naming let it
  through. **Two yes answers that do not declare the same group are now a
  conflict** (`conflicting`), in either order, and so are two different groups;
  agreeing duplicates are read as before.
- **THE COST, STATED**: a judge that labels a request NAMING the form outright
  (*"Take the order form off"*) as a links group is refused now, where it used
  to cost nothing. That is a refusal the customer can answer; the other way
  round loses part of the site.
- **THE SENTENCE**: `group-other-kind` and `unknown-group` are not
  `not-asked`, so the customer hears *"…which I couldn't confirm your message
  asked for…"* — the judge said yes, and the screen does not claim otherwise.
- **THE ROUTE CASES**, through `POST /api/site/<slug>/edit` on a starting page
  whose "Order ahead" holds a "Large batches" link beside the form (the harness
  now takes the starting page, and a refusal is compared against IT rather than
  the fixed fixture): **the owner's bypass** — refused, 409, nothing compiled,
  stored or charged, `contentBlocked` naming the form ALONE with `group:
  "links"` and `group-other-kind`, the exact screen, no follow-up bought;
  **the same on the job path** — no reservation, `edit_finalize p_ok: false`;
  **correct link-only removal under the heading** — publishes, the judge billed
  with the edit, one item asked about; **the form named on its own** (*"Take the
  order form out of ‘Order ahead’"*, no group) — publishes, only the form an
  item, the link under the same heading kept. **Retained unchanged and green**:
  all links (full writer and tweak), the two except-one cases, the three
  collateral cases (both money paths, and the stretched group), the sections
  group, the named-section removal and retarget controls, and the billing
  controls.
- **A LIMIT, RECORDED AS A CASE AND NEVER AS A PROTECTION**: the form answered
  with NO group, quoting the links request that shares its heading, is believed
  and the form goes — the heading's words really do name it. Telling *"the
  links under Order ahead"* from *"Order ahead"* is reading English, the
  judge's call, which the rules already steer (*"Asking for every link does not
  ask for any section"*). **The fix constrains a DECLARED group and claims
  nothing about an undeclared misreading.**
- **EVIDENCE.** `test/edit-page-keep.test.mjs` **57 → 63 cases** — one reader
  case (the shared heading, the premise that the quote names BOTH items asserted
  first, and the duplicate-answer conflicts), five route cases, and the group
  reader case rewritten (its named-form-under-links assertion reversed, the
  non-string expectation corrected, unknown / non-string / absent groups
  added). **Red 4 of 63 against the unfixed `f89846de`** (a throwaway worktree,
  the product byte-identical to the scratchpad backup, sha `5f340fb0`): the two
  reader cases and the owner's bypass on both money paths, each route case at
  200 where 409 was due; the rewritten case's first gate is its non-string line,
  and with that line cut its named-form assertion is red on its own. The 59
  green on both are the controls, the limit and every retained case. **The
  eight focused files 174 / 174** (+6). **Focused mutation check
  `scripts/mutants/keep-groups.json`, re-anchored and extended: 25 mutants, 25
  killed, 0 survived, 0 never applied, the comment-only control surviving**,
  over `page-keep.mjs` and `worker.js` against the same eight files — G-1 and
  G-2 re-anchored (their line was the one this round replaced), and six new:
  naming asked before a declared group (the bypass restored), a non-string group
  read as no group, `null` counted as a declaration, a blank group counted as
  one, two answers disagreeing about the group not a conflict, and two
  different groups agreeing; both swept files byte-identical to their
  pre-sweep hashes afterwards. **Suite 7,328 locally** (`# tests 7328 / # pass
  7328 / # fail 0 / # skipped 0`, `duration_ms 117,043`) — **+6 against 7,322**,
  exactly the file's 57 → 63. **AND THE CI UNIT HALF MATCHES**: run
  **`35955566283` on `16b9ce72`** reads **`# tests 7328 / # pass 7324 / # fail 0
  / # skipped 4`** (`duration_ms 110,682`) — the total is what matches, `pass`
  differing by CI's four skips — with the rewritten reader case, the new reader
  case and all five shared-heading route cases found passing BY NAME in the
  downloaded log (`ok 1780`, `ok 1781`, `ok 1824`–`1828`) and zero anchored
  `not ok N -` lines; the documents-only `03cde33e` reads the same four numbers
  on run `35955832188` (`duration_ms 120,893`), so it moved the count by zero.
  **AND `site build` run `35955566453` on `16b9ce72`** (04:25:17 → 04:45:51Z,
  **20m34s**, all twenty steps) read all twelve counts green out of its per-step
  files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases
  16, theme-seam 11, theme-render 29, site-routing 14, site-runtime 47,
  kit-render / kit-a11y / kit-effects / kit-paint `all passed`, census 7 + 4 + 1
  = **12**; the two known `##[error]` annotations (`index.tsx(50,13) TS2322`,
  `menu.tsx(27,17) TS2339`) inside the case that compiles a broken page on
  purpose, each directly above its own `ok` line this time; `tsc`-format lines
  9 / 2 / 7; `site-build.mjs` **14m59s**. **The stamp chain ends at
  `16b9ce72`**, the last commit to move a product or test file. **Rendered in
  the real workspace chat, before and
  after** (the owner's bypass, link-only removal, the form named on its own):
  every chat sentence the browser composer's own output captured out of the
  route — BEFORE on the unfixed product (captured before the fix), AFTER on this
  branch — and all six drawn bubbles equal to the composer's text. In the
  owner's AFTER nothing published, so the link the customer DID ask about is
  still a link: a refusal withholds the whole change, as every preservation
  refusal does.
- **⚠ WHAT IT DOES NOT CLAIM.** Every judge answer is SUPPLIED, the `group`
  included, so this proves that code enforces the kind a judge DECLARES — and
  nothing about how often a real model declares a group, declares the wrong
  one, or misreads a shared heading without one. Plain-words and kit-only
  section loss stays OPEN; full-site revise, translation and hydration are
  untouched; model-written replies stay a recorded future preference.

### HANDED OFF FOR MERGE: THE PRESERVATION CHECK (2026-09-24, merged and deployed in 2151 — next section)

Owner: *"Close this bounded correction at the code-review level. Stop
expanding this guard or running further sweeps. Prepare the merge/deployment
handoff against current main … Do not merge, deploy or dispatch a paid run
yet."* Everything below was read or computed 2026-09-24 ~05:14Z; **re-ask each
one immediately before the push**, because a merge is judged on the state it
meets, not on this paragraph.

- **THE CANDIDATE IS THE BRANCH TIP, A FAST-FORWARD OF MAIN `4df02867`**
  (`HEAD..origin/main` empty). Its product tree is `16b9ce72`'s; every commit
  after that one is `CLAUDE.md` and `docs/owner-notes.md` alone. The exact tip
  is the handoff reply's, and `git rev-parse origin/claude/help-needed-ehlwlj`
  re-derives it — this paragraph cannot name the commit it is in.
- **THE PRODUCT CHANGES ARE FIVE FILES**: `builder/page-keep.mjs` (new),
  `builder/site-files.mjs` (`partBindings`, `tagAt`, `drawsTag`), `worker.js`
  (the import, `keepRefusal`, `keepCheck` on the tweak and on the rewrite, the
  judge's tokens in the one `eCharge`), `public/chat.js` (one clause reading
  `partsUnsure`) and `Dockerfile` (`page-keep.mjs` on the worker COPY line).
  Beside them `test/edit-page-keep.test.mjs` (63 cases), a re-anchor in
  `test/site-tweak.test.mjs` and two mutation specs. **No migration, no
  `wrangler.jsonc`, no workflow, no package change, no stored-state format**:
  every new reply field is additive and an older tab ignores it.
- **THE REQUIRED CI, READ**: unit tests on the tip, and `site build` on the
  product tree — run **`35955566453` on `16b9ce72`**, green, since docs-only
  commits fire no site build. `e6eb22f0`'s unit run **`35957268327`** reads
  **`# tests 7328 / # pass 7324 / # fail 0 / # skipped 4`** (`duration_ms
  121,334`), zero anchored `not ok N -`, the seven declared-group cases found by
  name. **Zero runs in progress, queued or waiting at 05:13:50Z.**
- **THE IMAGE, PREDICTED OVER BOTH ENDS**: `origin/main` answers
  `67a81b55332be3a9` from **185** inputs (what deploy 2150 rolled to) and the
  candidate **`56f7d5866240a1de`** from **186** — `builder/page-keep.mjs`
  ADDED, `Dockerfile`, `worker.js` and `builder/site-files.mjs` moved. The same
  id at `16b9ce72`, so the docs commits do not move it. The deploy should say
  `built … (registry answered 404; ***86 inputs …)` and roll `67a8***b55332be3a9`
  → `56f7d5866240a***de` under `SUCCESS Modified application`.
- **THE ROLLBACK, VERIFIED BEFORE IT CAN BE NEEDED**: a fast-forward has no
  merge commit, so it is the RANGE — `git revert --no-commit
  4df02867..<candidate>` then one reviewed commit. In a throwaway worktree that
  gives tree **`ddabc0dd…`, main's own**, so a rollback's image step says
  `reused 67a81b55332be3a9`. **No prerequisite**: the check writes nothing when
  it refuses, and nothing stored depends on it.
- **THE SERVED-FILE CHECK'S BEFORE READING, TAKEN** (05:13:59Z):
  `https://gofarther.dev/chat.js` **740,600 bytes, sha256 `37983c53938d6581`,
  0 occurrences of `partsUnsure`**, byte-identical to `4df02867:public/chat.js`.
  After the deploy it should be **741,487 bytes, `54397bfe3a57abb0`, 2
  occurrences**, byte-identical to the candidate's. Re-take the before reading
  if anything deploys first.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  the candidate sha and `expect_image` `56f7d5866240a1de` — a green deploy is
  Wrangler reporting on itself. **And the check is live on the edit path only
  once the CONTAINER has rolled**: edits run as jobs in the site's container,
  so a job started on the old image publishes without it, exactly as today —
  the 15–20 minute rule.
- **THE LIMITS TRAVEL WITH IT**: every model answer in the evidence is
  supplied, so real-model judgment is unverified; plain-text and kit-only
  section loss stays open. **Partial preservation protection, not the edit path
  complete.**

### MERGED AND DEPLOYED: THE PRESERVATION CHECK (2026-09-24)

Owner: *"The preservation handoff passed independent review. Proceed with
merging and deploying this reviewed patch. Recheck current main and the
candidate before merging. Reviewed candidate: 1b968c9; expected image:
56f7d5866240a1de. If product code changed meanwhile, stop and identify the
difference."*

- **RECHECKED AT 05:30:38Z AND NOTHING HAD MOVED**: `origin/main` still
  `4df02867`, the candidate still `1b968c9`, and no product file differing from
  the reviewed tree (`16b9ce72`'s). Zero runs in progress or queued; the image
  predicted over both ends again; the rollback tree re-verified (`ddabc0dd…`,
  main's own); the served-file BEFORE reading re-taken at 05:30:58Z — **740,600
  bytes, `37983c53938d6581`, 0 × `partsUnsure`**, byte-identical to main's.
- **A FAST-FORWARD**: `main` `4df02867` → **`1b968c9`** at **05:31:09Z**.
- **DEPLOY 2151 (`35960304858`)** — success, job 05:31:15 → 05:34:12Z,
  **2m57s**; image step **2m11s** with **0 `CACHED` lines**; Wrangler 19s.
  `DEPLOY_ID` `***b968c9de0530872e06ee24680dbfec9d36b928f` (the `***` a masked
  `1`); image **built `56f7d5866240a***de`** (registry answered 404, `***86
  inputs off ./Dockerfile`) and **rolled from `67a8***b55332be3a9`** (`- "image"`
  → `+ "image"` under `SUCCESS Modified application`, `Applied changes`);
  `+ /chat.js`, 1 uploaded, 85 already; `Uploaded isibi-app`, `Current Version
  ID: 5f694545-…`, `Deployed isibi-app triggers`.
- **THE TWENTY-SECOND IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH,
  AND THE INPUT COUNT MOVED 185 → 186 AS PREDICTED** — `builder/page-keep.mjs`
  joined the Dockerfile's worker COPY line, so the count is a second quantity
  agreeing independently of the id.
- **THE SERVED-FILE CHECK, BOTH READINGS**: after (05:35:15Z) **741,487 bytes,
  `54397bfe3a57abb0`, 2 × `partsUnsure`, byte-identical to `git show
  1b968c9:public/chat.js`** — exactly the handoff's prediction. Gates **401 /
  401 / 401 / 404**.
- **DEPLOYED, NOT RUNTIME-CONFIRMED.** The confirmation is the canary's free
  press, and the session **re-tested it rather than assumed it**: at 05:52:40Z,
  18 minutes after the deploy finished, `run_workflow` on `edit-canary.yml`
  (`main`, `spend: no`, both expectations set) answered **403 Resource not
  accessible by integration** — the `actions: write` wall again. **The owner's
  press**: `edit-canary.yml` from `main`, `spend` no, `expect_deploy`
  **`1b968c9de0530872e06ee24680dbfec9d36b928f`**, `expect_image`
  **`56f7d5866240a1de`**, everything else at its default. It refuses on a
  mismatch of either, so it cannot pass against the previous build.
- **THE LIMITS TRAVEL WITH IT**: supplied model answers only, so a real model's
  judgment is unverified; plain-text and kit-only section loss stays open.
  **Partial preservation protection, not the edit path complete.**

### A ROUTING ANSWER THAT CANNOT BE ACTED ON STOPS A LIVE SITE (2026-09-24; merged and deployed in 2152 — no paid run)

Owner, after checking the reproduction: *"On an existing site with pages,
validate the routing result before dispatching any action. Network/HTTP/parse
failures, explicitly failed results and malformed action payloads must stop
with an explanation—no edit, addon or rewrite POST."* — with two response
shapes added to the same task: `{ok:true, intent:"addon", failed:true}` (it
started the paid add-on) and `{ok:false, intent:"build"}` /
`{ok:false, intent:"edit", layer:"look"}` (they started work).

**WHAT THE OLD HANDLER DID, MEASURED** through the real send handler on
`7bdee26c`'s `siteRoute` (supplied answers, no network): of the 31 answer
shapes in the stop table, **19 posted `react-revise`** — the rewrite of every
page (a revise of the same site measured **17** credits) — **9 posted the edit
route** (`{ok:false…}`, an edit with no `ok`, and every malformed edit: a layer
of `["look"]` posted `layer: "look"`, the `String(["a"])` trap; a `rename` that
is not a string or a `remove` that is not a boolean posted an ordinary page edit
of the sentence with the move or removal dropped), **1 posted the paid add-on**
(the router's `failed: true` fallback) and **2 bought nothing but printed the
answer raw** (`[object Object]`, a blank line). An edit answer for a site with
pages and no address posted the rewrite; a 401 showed the gate AND started the
rewrite behind it. None said a sentence; every one that sent left the busy flag
set.

**THE RULE NOW**, `routeActionable(d, site)` in `public/chat.js`, asked once,
on a live site only (`!isBuild`), above every branch that sends:

- **the route's own verdict first**: `ok === true` and `failed !== true`. A body
  that is not a decision — `null`, a list, a bare value — fails there too.
- **then the fields each action READS, with the type it reads them as**: `edit`
  needs the site's address and a layer in `ROUTE_EDIT_LAYERS`, with `page` and
  `rename` absent or strings and `remove` and `tab` absent or booleans; `addon`
  needs the address; `build` nothing more; `ask` a non-blank string; `clarify`
  the one reader its branch draws from (`routeQuestion`, the paragraph after the
  evidence); any other intent fails. **A malformed field refuses the whole answer rather than
  reading as absent**, because at the point of use absent is a different action.
- **a refusal is `lost(r)`**: `finish` with *"⚠️ I couldn’t work out what to do
  with that just now, so nothing on your site changed. Send it again in a
  moment."*, or *"⚠️ You’re signed out. Sign in and send that again."* on a 401,
  beside the gate `apiFetch` already shows. `finish` clears `siteBusy`, stops the
  rail and its clock. **It claims nothing about money**: the routing call is
  billed on its own and may already be charged, and `apiFetch` refreshes the ✦
  pill on this route whatever it answered.
- **a thrown fetch** is `.catch(() => (isBuild ? go() : lost()))`.
- **`ROUTE_EDIT_LAYERS` IS A COPY of `EDIT_LAYERS`** (a classic script cannot
  import), compared both ways by the test.
- **the comment above `siteRoute` is corrected**: it said every failure falls
  through to the build, true while every message on an existing site WAS a
  revise. *A rule true because of a layer below it expires when that layer
  moves*, in the browser this time.

**KEPT, AND ASSERTED**: a valid edit for each of the nine `EDIT_LAYERS` posts the
edit route with that layer; well-typed `page`, `remove`, `rename` and `tab`
reach the POST as they came; a valid add-on; an explicit build on a live site
(the revise — how a customer says "scrap this"); the route's zero-balance build
(the revise's own 402 speaks); a question with an answer; a clarify round on a
live site and on an empty project; an explicit build on an empty project. **AN
EMPTY PROJECT KEEPS ITS DOCUMENTED DEFAULT**: a dropped request, a 500,
`{ok:false}` and a `failed: true` build all still start the first build.
**UNCHANGED, STILL SEPARATE TASKS**: the adopted site with no page list
(next-task 7 — its `isBuild` is true, so it is outside this rule) and the
add-on request's own failures (next-task 8, two ADJACENT OPEN DEFECT cases).
*Both have since been built: next-task 7 merged in deploy 2153, and next-task 8
on the branch the same day, where those two cases now stop.*

**⚠ FOUND WHILE RENDERING, NOT CHANGED: CHROMIUM RE-SENDS A ROUTING POST WHOSE
CONNECTION IS RESET.** One `fetch` from the page, against a local server that
destroys the socket, drew **3** requests (reset before or after reading the
body) or **2** (reset after the headers); the screenshot harness drew 7. That is
the browser's network stack, identical before and after this change, and **not
measured against the real edge** — Cloudflare answers a Worker that throws with
a 5xx, not a reset. Where it does happen, each re-send that reaches the model is
billed. Recorded, not investigated.

**EVIDENCE.** `test/site-route-failure.test.mjs` goes **32 → 55 cases** and now
drives the real `siteSend`, so the busy flag, `siteBuildStart`/`siteBuildStop`
and the rail's clock are the real ones (the clock counted, not scheduled): 33
stop cases, each asserting no request after the routing call, the busy flag
cleared, the rail stopped, its clock started once and cleared once, the exact
sentence, and no money word in it; the census; 17 controls; the empty-project
default; the adopted row; the two adjacent add-on cases. **Red 33 of 55 against
`7bdee26c`'s handler** (the three new helpers appended so the file loads) —
exactly the 33 stop cases; the other 22 pass on both. `site-ask`'s *"falls
through on anything unexpected"* guard pinned the old property and is
re-anchored to both rules (the empty project's two fall-throughs, the live
check before every sender, the catch, the clarify predicate). **Sixteen
targeted probes, not a sweep**, one per clause — `ok` ignored, `failed`
ignored, any truthy layer, each of the four field types unchecked, either
address check, a blank answer accepted, an unknown intent accepted, the status
ignored, the live check gone, `.catch(go)` back, the 401 sentence gone, the rule
applied to an empty project — **16 killed, the comment-only control
surviving**, `chat.js` restored byte-identical (`babddbb9dbb5a3f4`) after each.
The 91 test files that read `chat.js`: **2,889 / 2,889** on the committed tree. **Suite 7,383
locally** (`# tests 7383 / # pass 7383 / # fail 0 / # skipped 0`, `duration_ms
117,452`) — **+23 against 7,360**, exactly the file's 32 → 55. **AND CI
MATCHES**: unit run **`35964401253` on `d0e9c896`** reads **`# tests 7383 /
# pass 7379 / # fail 0 / # skipped 4`** (`duration_ms 122,195`) — the total is
what matches, `pass` differing by CI's four skips — with all 55 of the file's
cases found passing BY NAME in the downloaded log archive and zero `not ok N -`
lines. **⚠ AN ANCHORED COUNT OF `ok N -` LINES READS 7,382 ON THAT LOG, AND
7,383 IS RIGHT**: result 5300's line opens with a byte-order mark where the log
was chunked, so `^<timestamp> ok` misses it — count the result numbers, not the
lines. No `site build` fires: `public/` and these test files are on none of its
`paths`. The documents-only `9650c0d7` reads the same four numbers on run
`35964678838` (`duration_ms 100,145`), so it moved the suite by zero. **That
round's stamp chain ended at `d0e9c896`.** **Rendered in the
real workspace chat**, the message typed into the composer and sent, before and
after: a dropped request, the router's `failed: true` fallback, and
`{ok:false, intent:"edit", layer:"look"}` — before, the rail and the stop
button over a rewrite, add-on or edit request; after, the sentence and the send
button. **Every routing answer is SUPPLIED**: this proves what the browser does
with a response, never what a real router answers.

**A CLARIFY ROUND IS AN ACTION TOO, AND ITS CHECK READ ONE FIELD** (the owner's
review, the same day: *"routeAsksQuestion checks only the options array's
length"*). Reproduced by the owner through the real handler and again here in
the real workspace chat, on `d0e9c896`'s handler: `{question:{options:["Order",
"Visit"]}}` drew the question **"undefined"**, words that were an object drew
**"[object Object]"**, and `{text:"Choose one", options:[null, {}]}` drew two
buttons answering **"null"** and **"[object Object]"** — each with the clarify
round STORED, so the next message would be read as an answer to it. **Nothing
was sent, which is why the first round's stop table could not see it**: a
drawing is not a request, and every assertion there was about requests.

- **ONE READER, AND THE BRANCH DRAWS WHAT IT RETURNS.** `routeQuestion(d)`
  answers `{text, options}` — the words a string with something in it, at least
  two answers, every one a string with something in it — or `null`.
  `routeActionable`'s clarify arm and the clarify branch both ask it, and the
  branch pushes the reader's `text` and `options`, never the answer's own
  fields: a field the reader never looked at cannot reach the screen. **The
  rule is the producer's own shape** — `readQuestion` in `builder/site-ask.mjs`
  sends a clipped non-empty text and two to four non-empty string options and
  nothing else — so the browser refuses nothing the real route sends.
- **EVERY ANSWER IS CHECKED, THE FIFTH TOO**, though four are drawn: an unusable
  one dropped there would be a malformed field read as absent. Four or more
  usable answers still draw the first four (a control).
- **ON A LIVE SITE A REFUSED QUESTION IS `lost(r)`**: the same sentence, busy
  flag and rail cleared, **no clarify round stored**, nothing sent.
- **⚠ ONE CONSEQUENCE OFF THE LIVE SITE, STATED RATHER THAN LEFT TO BE FOUND**:
  the reader is shared, so an EMPTY project no longer draws a question it
  refuses either — and with nothing to draw, the answer falls to that project's
  documented default for an unusable answer, **the first build, which is paid**,
  where it used to draw the garbled question. A case pins it, so choosing a stop
  there instead is one assertion to flip, and the owner's to make.
- **UNCHANGED**: `siteAskHTML` still draws whatever a message STORED before this
  change — a branch reachable only from a record in a customer's localStorage
  STAYS, by this file's own rule — and the route never sends these shapes, so
  such a record exists only if a route misbehaved while the old code ran.

**EVIDENCE.** `test/site-route-failure.test.mjs` goes **55 → 74 cases**: 17
malformed shapes on a live site (the owner's three first; words missing, empty,
blank, a number, null or an object; answers missing, a single string, an empty
list, empty, blank, a number, a list, or an unusable fifth; no question at all;
a question that is only a string), a four-or-more control, and the empty-project
case. **Every stop now also asserts that no clarify round is stored**, and both
clarify controls assert the exact drawn message and the stored round `{brief,
qa: [], imgs: []}`. **Red 13 of 74 against `d0e9c896`'s handler** in a throwaway
worktree, the harness's one cut line pointed at the old function's name so the
file loads — the 12 shapes the length check let through and the empty-project
case; the 5 it already refused and every control pass on both. **Each red case
fails first on what was drawn** (`q: 'undefined'`, `q: '[object Object]'`,
`opts: [null, {}]`), **and with that assertion cut in the throwaway copy all 12
live-site shapes still fail — on the stored round**, so each assertion sees the
defect alone. `site-ask`'s guard pinned `routeAsksQuestion`'s exact body and is
re-anchored to the property: whole-line comments blanked, the code it scans
proved still there, siteRoute reads no `.question`, the reader does, and the
live check asks the same reader. **Nine targeted probes, not a sweep** — the
words read for truthiness, blank words accepted, the answers unchecked, only the
four drawn checked, one answer enough, every answer drawn, the check keeping the
old length rule, the branch drawing the raw answer, the branch keeping the old
rule — **9 killed, the comment-only control surviving**, `chat.js`
byte-identical to the fixed copy (`35e09289eb624b2e`) afterwards. **The
raw-answer mutant is killed only by the structural guard**, being behaviourally
equivalent on every input the reader admits — which is exactly why that guard
exists. The 91 files that read `chat.js`: **2,908 / 2,908**, +19. **Suite 7,402
locally** (`# tests 7402 / # pass 7402 / # fail 0 / # skipped 0`, `duration_ms
115,601`) — **+19 against 7,383**, exactly the file's 55 → 74. **AND CI
MATCHES**: unit run **`35967266345` on `0ca6b143`** reads **`# tests 7402 /
# pass 7398 / # fail 0 / # skipped 4`** (`duration_ms 121,218`) — the total is
what matches, `pass` differing by CI's four skips — with **all 183 cases of the
two changed files found passing BY NAME** in the downloaded log archive, 7,402
distinct result numbers and zero `not ok N -`. No `site build` fires, as before.
**The stamp chain ends at `0ca6b143`.** **Rendered in the real workspace chat**, the message typed and sent, before and
after: the owner's three shapes and a valid control — before, the garbled
question with its buttons and the round stored; after, the sentence, no round,
no buttons; the control identical both ways. **Every routing answer is
SUPPLIED**, as above.

### MERGED AND DEPLOYED: THE ROUTING PATCH (2026-09-24)

Owner: *"Merge and deploy the reviewed routing patch after rechecking current
main and candidate 40190564. Stop if additional product changes appeared.
Verify the deployed SHA and served chat.js against the merged file. Determine
container-image reuse from the actual inputs; don't assume a roll or require an
arbitrary wait. No paid run."*

- **RECHECKED BEFORE THE PUSH, AND NOTHING HAD MOVED**: a clean tree, `origin/main`
  still `1b968c9`, the candidate `40190564` the branch tip, and zero runs in
  progress, queued or waiting. The range is 7 commits and **5 files**:
  `public/chat.js`, `test/site-route-failure.test.mjs`, `test/site-ask.test.mjs`
  and the two documents. The one product file is the reviewed `chat.js`.
- **A FAST-FORWARD**: `main` `1b968c9` → **`40190564`** at **07:12:17Z**.
- **REUSE WAS PREDICTED FROM THE INPUTS, NOT ASSUMED**: both ends answer
  **`56f7d5866240a1de` from 186 inputs**, and none of the five files is an input
  (`public/` is not copied). The observer was proven first: `worker.js` and
  `builder/page-keep.mjs` are inputs, and nothing under `public/` is.
- **DEPLOY 2152 (`35968361110`)**: success, job 07:12:25 → 07:13:06Z (**~42 s**);
  image step **1.1 s** — `reused isibi-app-sitebuildcontainer:56f7d5866240a***de
  (registry answered 200; ***86 inputs off ./Dockerfile)`; Wrangler **~16 s** —
  `+ /chat.js`, 1 uploaded, 85 already, `Uploaded isibi-app`, **`no changes
  isibi-app-sitebuildcontainer`**, `Deployed isibi-app triggers`, `Current
  Version ID: 98474cac-…`. `DEPLOY_ID` `40190564b02e24b299d66fe6e9d0ecb1d4c3e466`
  (the log masks it as `40***90564…ecb***d4c3e466`).
- **NO HOLD IS OWED**: the 15–20 minute rule is about the roll, and nothing
  rolled. The edit jobs run on the image deploy 2151 put there. The whole change
  is the served file.
- **THE SERVED-FILE CHECK, BOTH READINGS**: before (07:12:08Z, before the push):
  **741,487 bytes, sha256 `54397bfe3a57abb0`**, byte-identical to `1b968c9`'s
  `chat.js`, 0 occurrences of `routeActionable` or `routeQuestion`. After
  (07:13:52Z): **746,091 bytes, sha256 `35e09289eb624b2e`**, 2 and 3 of them,
  and **byte-identical to `git show 40190564:public/chat.js`**. Gates **401 / 401
  / 401 / 404**.
- **THE ROLLBACK WAS VERIFIED BEFORE IT COULD BE NEEDED**: `git revert --no-commit
  1b968c9..40190564` in a throwaway worktree gives tree **`b436a175…`**, main's
  own, so a rollback also reuses `56f7d5866240a1de`.
- **DEPLOYED, NOT RUNTIME-CONFIRMED.** The Worker half is Wrangler's own report;
  the served file is the one reading taken directly. The canary dispatch answered
  **403** again at 07:14Z, so the confirmation is the owner's free press:
  `edit-canary.yml` from `main`, spend `no`, `expect_deploy`
  **`40190564b02e24b299d66fe6e9d0ecb1d4c3e466`**, `expect_image`
  **`56f7d5866240a1de`**. It also confirms 2151, since 2152 reused 2151's image.

### AN EXISTING SITE WHOSE PAGE LIST HAS NOT LOADED IS BUILT AS A NEW SITE — REPRODUCED (2026-09-24; built the same day, next section)

Owner: *"Then take the next separate edit-entry issue: an existing site whose
page inventory hasn't loaded is treated as a new project. Reproduce through the
real browser flow with recorded network actions … Establish whether an ordinary
edit starts a new build, targets the wrong site, or loses the request. Return the
smallest proposed correction before implementing it."* Next-task 7, driven end to
end.

**THE HARNESS** (scratchpad, not committed): the real `public/` app (`index.html`,
`chat.js`, `site-list.js`, `styles.css`) runs in a real Chromium with the sign-in
gate held down on the served copy, and every request the page makes is recorded.
The site list, the page list, the routing call and the build call are answered by
the real Worker (`loadWorker`). Its own outbound calls are stubbed: the owner, a
balance of 50, the site row, and a chat lookup that finds no site bound to the
chat the build names. **ONLY THE ROUTER'S ANSWER IS SUPPLIED.** Any other model
call is the build's design call, which is recorded and stopped there with a 503.
The site is `fretwork-1` as the server holds it: three stored pages (`/`,
`/prices`, `/gear`), built on another machine, bound to no chat. It is opened
from its start-screen card, which adopts it (`siteAdopt`: a new local record with
the slug and **no pages**), and sent *"Make the footer navy"*.

| `/api/site/routes` | routing body | router (supplied) | the work request |
|---|---|---|---|
| answered before the send | `firstBuild: false`, `hasSite: true`, pages `/ /prices /gear` | `edit`/`look` | `POST /api/site/fretwork-1/edit`, `layer: look`: **correct** |
| answers after the send | `firstBuild: true`, `hasSite: false`, pages `[]`, `slug: fretwork-1` | `build` | `POST /api/site/react-build` `{brief: "Make the footer navy", chat: site_…}`, **no slug** |
| fails | the same | `build` | the same |
| a new project (control) | `firstBuild: true`, `hasSite: false`, pages `[]`, `slug: ""` | `build` | `POST /api/site/react-build`: correct |

**THE REAL BUILD ROUTE THEN BUYS A NEW SITE**, identically for the last three rows:
the chat lookup finds no site, **`credit_debit` takes the 2-credit deposit**, and
**the design model is called**. A paid build of a new site has started there; the
harness stopped it with a 503 and the route reversed the deposit. In the "answers
after" row the page list did land, but after the build had been sent. **With the
build's answer supplied as a success** (a fifth run), the workspace opened for
`fretwork-1` became **"Navy Footer" at `navy-footer`**, the thread said *"✅ Built
“Navy Footer”. Tell me what to change."*, and `fretwork-1` was never touched.

**SO IT IS ALL THREE, NOT ONE**:
- it **starts a new paid build**: the deposit and the design call, plus the routing call;
- it **targets the wrong site**: the build body names no site, and its answer points
  the open workspace at the new one (`s.slug = d.slug`);
- it **loses the request**: the edit never reaches `fretwork-1`, and the sentence
  becomes a new site's brief.

**AND NO ROUTER ANSWER CAN REACH THE EXISTING SITE FROM THAT STATE.** Here is the
real `/api/site/route`, driven with every answer supplied over the two bodies:

| body | edit | edit (a page) | addon | build | clarify | ask |
|---|---|---|---|---|---|---|
| list missing | build | build | build | build | **clarify** | ask |
| list loaded | edit/look | edit/page | addon | build | addon | ask |

`hasSite: false` closes `edit` and `addon` at `readRouting`, so both fall to
`FALLBACK_NO_SITE` (a build). `firstBuild: true` opens **a first-build interview on
an existing site**, and the answer to that question goes through `siteAnswer`,
which builds. **No change to the router's instructions can fix this: the body it
is sent is the defect.**

**THE CAUSE IS ONE LINE AND A LATCH.**
- `siteSend` decides *first build?* with `const isBuild = !sitePages(site).length`,
  read off localStorage. An adopted record has no pages (`fromRow` and `siteAdopt`
  carry none).
- The list arrives only through `siteRoutesFetch`, which the render fires and
  forgets, **once per slug per page load** (`siteRoutesAsked`, never cleared), and
  which is **silent on every failure**.
- **THE WINDOW**: the first message on a site opened in a browser that did not
  build it, until that read lands; or every message of a page load in which the
  read failed. Once a read succeeds the list is saved and later loads are safe.
- `siteRoute` sends `firstBuild: !!isBuild` and `hasSite: !!(site.slug &&
  sitePages(site).length)`, and the Worker takes both **on trust, deliberately**.
- **Its comment is wrong in one clause**: *"claim you have none and you rebuild
  your own site"*. A first-build body carries no slug, so what gets bought is a
  NEW site, never a rebuild of yours.
- **The browser's comment above the body is wrong twice**: it says `hasSite` is
  *"about the SERVER owning a published site"* and that *"the server re-checks it
  anyway"*. In fact it is computed from localStorage pages, and the server
  re-checks nothing.

**⚠ A SECOND COLLAPSE UNDER THE FIRST**: `/api/site/routes` reads through
`loadSiteSource`, which folds a FAILED R2 read into `null`. So it answers `{ok:
true, routes: []}` with *"nothing stored — this site has not published a build
yet"* both for a site that never published and for a read that threw.
(`readSiteSource` already answers `{ok, pages, why}`; the route just does not ask
it.) **A correction that reads `routes: []` as "never published, so a first build
is right" re-opens the defect on an R2 blip.**

**THE PROPOSED CORRECTION — BUILT THE SAME DAY, with the clarify doors the owner
added (next section).** It touches the browser
only (`public/chat.js`), so no container roll:

1. **A PROJECT WITH AN ADDRESS IS NEVER A FIRST BUILD.** In `siteSend`, a site with
   a `slug` and no page list waits for the page list before anything is routed. A
   read already in flight is reused; one that failed or answered nothing is asked
   again, since the customer's send is reason enough for one request.
   `siteRoutesFetch` returns the read (one promise per slug). The render path is
   unchanged and keeps its once-per-load latch.
2. **THE LIST ARRIVES → the ordinary live-site path**, routed with the real pages
   (`firstBuild: false`, `hasSite: true`).
3. **THE READ FAILS → STOP WITH A SENTENCE, NOTHING SENT**: no routing call, no
   charge, busy flag and rail cleared. Wording is the owner's; a draft: *"⚠️ I
   couldn't load your site's pages just now, so nothing on your site changed. Send
   it again in a moment."*
4. **THE READ ANSWERS NO PAGES → ALSO A STOP, NEVER A FIRST BUILD.** Recommended
   because of the collapse above: a first build from a slugged record makes a
   different site under a different name, and `routes: []` cannot tell "never
   published" from "the read failed". **The cost**: a never-published site opened
   from its card in another browser cannot be built from that card (a new project
   still can). **The alternative** is a Worker change (the route asks
   `readSiteSource` and answers 503 when the read did not happen) so that
   `routes: []` means what it says. That costs an image roll, since `worker.js` is
   an input.
5. **THE TWO WRONG COMMENTS ARE CORRECTED** in the same change.

- **NOT RECOMMENDED: the two-line alternative** of taking `isBuild` and `hasSite`
  from `site.slug` alone and routing with `pages: []`. That is the **blind router**
  (run 23's `/book`: `readEdit` checks a named page only against a non-empty list).
  A blind router also cannot draw the edit/addon line, which is *does the thing
  they name exist on the site now*.
- **NOT IN IT**: the addon request's own failures (next-task 8); a clarify round
  the defect already stored on a slugged record (reachable only from such a record,
  and it still answers through `siteAnswer`) — **the owner put this one IN: next
  section**; the full revise; translation; hydration; model-written replies.
- **TESTS, ON APPROVAL**: focused cases driving the real `siteSend` for loaded,
  loading, failed, answered-empty and a new project. Each asserts the requests,
  the busy flag, the rail and the sentence. The RECORDED case in
  `site-route-failure.test.mjs` (*"a failed routing call on an adopted site with no
  page list starts a NEW site build"*) flips from a characterisation into a stop.
- **⚠ WHAT THE REPRODUCTION DOES NOT CLAIM**: the router's answer is supplied, so
  what a real router says to *"Make the footer navy"* under `firstBuild: true` is
  unmeasured. The matrix is why that does not matter: every work answer it could
  give is a build, and `clarify` leads to one.
- **FOUND ON THE WAY, NOT CHANGED**: a legacy static project answers *"Say “rebuild
  it” and I’ll regenerate it"*, but `siteRebuild` no longer exists anywhere. Its
  comment still cites it, so "rebuild it" gets the same sentence back forever.
  That branch is reachable only from a stored record, so it stays; only the promise
  is false.

### AN EXISTING SITE WAITS FOR ITS PAGE LIST, AND A ROUND ON ONE SENDS THE ORIGINAL REQUEST (2026-09-24, merged and deployed in 2153 — no paid run)

Owner: *"An existing site must not become a first build because its page
inventory is loading, empty or unreadable. Await the in-flight inventory request
before routing; allow a retry after failure. If usable inventory cannot be
established, stop without starting paid work. Keep genuine new-project behavior
working. Cover clarification entry points in this same correction. … Protect
typed replies, option clicks and skip; preserve the original request and
attachments. Keep the wait bounded and tied to the original site."* **Browser
only (`public/chat.js`)** — no Worker change, so no image input moves.

- **ONE READ PER SLUG IN THE AIR** — `siteRoutesRead(slug)`, shared by the
  picker's fetch and by a message. A message sent while the picker's read is out
  waits on THAT read: measured in the real browser, one request. It resolves
  `{paths, status}` and never rejects. **BOUNDED**: `SITE_ROUTES_WAIT_MS` 15,000,
  the request aborted at the bound. It leaves the map when it settles, which is
  what lets the next message ask again after a failure, and any read marks the
  picker's once-per-load latch, so a list a message fetched is not re-read by the
  next render. `paths: null` (unread) and `[]` (answered none) are kept apart and
  **nothing downstream reads them differently today** — both stop — so a probe on
  that line is equivalent by construction and was left out, said here.
- **THE PICKER BEHAVES AS IT DID**: latched, silent on failure, never
  overwriting a longer list at apply time (`siteRoutesApply`). Its once-per-slug
  case now also renders AFTER the answer landed — a read in the air is shared by
  construction, so only a later render shows the latch itself holds.
- **THE SEND** — `siteSend`: a record with an address and no page list waits
  (`siteWithPages`), then routes as the live site (`firstBuild` false, `hasSite`
  true, its real pages); with no usable list it stops with `SITE_NO_PAGES_MSG`,
  *"⚠️ I couldn’t load your site’s pages just now, so nothing on your site
  changed. Send it again in a moment."* (the owner's to reword), or the
  signed-out sentence on a 401. **No routing call on a stop** — that call is
  billed too. **Empty stops as well**, because the route answers `routes: []`
  for a store read that failed.
- **TIED TO THE SITE IT WAS SENT FROM.** The continuation re-reads the ORIGIN's
  record by id, never `siteOpenId`, and requires the address the list was read
  for: a workspace switch during the wait cannot send the message to the site on
  screen; a record removed meanwhile is sent nothing and the workspace freed; a
  re-addressed one stops. The busy flag is set before the wait, so a second press
  — any door, any workspace — is refused rather than queued, and the attachments
  leave the composer at send, so they travel with that message. **⚠ And a stop
  then left them nowhere** — the owner's reproduction the same day; they are
  handed back now (next section).
- **A ROUND ON AN EXISTING SITE** — `siteAnswer`. Every way out of a stored
  first-build round built a new site: skip posted `react-build` with no slug, an
  answer was routed with `firstBuild` set (the owner's two). **Reproducing them
  found a third**: on a site whose list WAS loaded, an answer the router took as
  an edit went as the edit's instruction — *"A guitar school"* for a look change
  — and the round stayed stored (the real Worker, real browser, both halves).
  Now, on a site with an address, a typed reply, an option (clicked or keyed) or
  skip (clicked or Escape) ends the round and sends the ORIGINAL request
  (`round.brief`) with its attachments (`round.imgs`) down the live path once
  the list is in. The answer stays in the thread and is sent nowhere. **A stop
  leaves the round untouched** — no answer written into it — so the next press
  tries again. **One redraw** when the round ends takes its buttons off the
  screen; they are inert while busy, but otherwise stayed drawn until the work
  finished. The new-project path keeps that stale draw — pre-existing, untouched.
- **A NEW PROJECT IS UNCHANGED**: no address, no read; a first build, the
  interview, skip straight to the build, a failed routing call still building.
- **THE `hasSite` COMMENT IS CORRECTED**: it said the flag was "about the SERVER
  owning a published site … and the server re-checks it anyway"; it is read off
  this browser's record and the server takes it on trust.

**EVIDENCE.** `test/site-entry-inventory.test.mjs`, **37 cases**, drives the real
`siteSend`, `siteAnswer`, the thread's click delegation and the keyboard listener
with the real `siteRoute`, `siteEdit`, `reactSend`, busy flag and rail; `fetch`
is the one seam. Every case asserts the outgoing requests and the screen state —
thread, busy flag, rail and its clock, the round, the pages, the redraws.
**Red 32 of 37 against unfixed `c0acaf88`** in a throwaway worktree (the new
helpers appended so it loads), every red case failing first on the defect itself
(*the list was not read*, or nothing was waiting); the 5 green are the loaded
control and the four new-project controls. **Three existing harnesses carried
the change rather than being appeased**: `page-picker` now carries the shared
read (never faked); `site-route-failure` answers the page-list read on its own,
and its RECORDED adopted-site case flipped into a live-site stop;
`site-ask`'s skip-path window re-anchored landmark to landmark — **it was vacuous
before this change** (its slice stopped just before the only `siteRoute(` it
could have matched) and empty after it, and is proved alive now by making a new
project's skip call the router. **Targeted probes, not a sweep: 20 killed, 0
survived, 0 never applied, the comment-only control surviving**, over `chat.js`
against the four files (spec in the scratchpad, as the last two rounds kept
theirs), run on the final file; `chat.js` byte-identical to its backup
afterwards (`22161c29c3c977be`). **Suite 7,439 locally** (`# tests 7439 / # pass
7439 / # fail 0 / # skipped 0`, `duration_ms 116,676`) — **+37 against 7,402**,
exactly the new file; the 92 files that read `chat.js`: **2,945 / 2,945**.
**AND CI MATCHES**: unit run **`35974950743` on `fcc0d067`** reads **`# tests
7439 / # pass 7435 / # fail 0 / # skipped 4`** (`duration_ms 110,479`) — the
total is what matches, `pass` differing by CI's four skips — with all 37 of the
file's cases found passing BY NAME in the downloaded log archive, 7,439 distinct
result numbers and zero `not ok N -`. No `site build` fires: `public/` and these
test files are on none of its `paths`. **The stamp chain ends at `fcc0d067`.**
**Rendered in the real workspace, before and after**, nine scenes (the reproduction's
instrument: real app, real Chromium, real Worker for the page list, routing call
and build route): before, a loading, failed or empty list and a skip each started
a paid build of a new site (deposit taken, design model called) and an option or
typed answer sent the answer as the edit; after, the loading list is waited on
and the original request reaches `fretwork-1`, and a failed or empty list stops
with the sentence after one retry. **Every routing answer is SUPPLIED**: this
proves what the browser sends and shows, never what a real router answers.

### A MESSAGE THE PAGE-LIST CHECK STOPPED KEEPS ITS FILES (2026-09-24, merged and deployed in 2153 — no paid run)

Owner, reproducing it through the real handlers on `c5c93652`: an existing site
with no page list loaded, a picture attached, *"Use this picture as the logo."*,
the page-list read fails → *"Send it again in a moment"* — `siteAttach` empty,
the stored message carrying no attachment, and the message sent again routed
`attached: false` and posted the logo edit with no images. *"Preserve the
original request and attachments when this pre-routing check stops. Keep
recovery tied to the original site; do not restore its files into another
workspace or overwrite newly selected attachments. No automatic paid retry."*
**Browser only (`public/chat.js`).**

- **REPRODUCED FIRST, TWO WAYS**: through the real `siteSend` with the picture
  made by the real attach code (`siteAttachFiles` → `siteAttachOne`), and in a
  real browser with the real + button and file chooser. After the stop the box
  and the strip were empty; the resend was routed `attached: false` and the logo
  edit posted `images: none`.
- **THE CAUSE IS LAST ROUND'S OWN DESIGN**: `siteSend` takes the attachments off
  the composer at send so they travel with the message whatever is on screen
  during the wait — and a stop then left them nowhere. Nothing stores an
  attachment on a thread message, anywhere.
- **KEPT ON ITS OWN SITE** (`siteHoldUnsent`): on a stop before routing,
  `siteSend` keeps `{t, imgs}` on the ORIGIN record, by id, **before** `finish`
  redraws — so that redraw is the one that hands it back. A LIST, so two stopped
  messages on one site each keep their own words and files.
- **HANDED BACK ONLY TO THAT SITE'S COMPOSER** (`siteUnsentBack`, called by
  `wireSiteComposer` — the composer's wiring lifted out of `renderSiteWorkspace`
  unchanged): the latest held message, whole — its files into the strip, its
  words into the box — **only into an EMPTY strip, and while nothing is being
  sent**. Another workspace or the start screen never draws it; the history rail
  draws no composer, and it waits.
- **WHOLE AND ALONE, AND WHY NOT BESIDE.** The first cut put the held files
  beside a picture chosen during the wait. **The logo rung uses the FIRST
  attachment and ignores the rest** (`worker.js`: *"UP TO 3 ARRIVE AND ONLY THE
  FIRST IS USED"*), so a quick "send it again" would have put the NEW picture up
  as the logo. So a newly chosen attachment stays exactly as it is — not
  replaced, joined or moved — and the held message waits until the strip is
  clear.
- **NOT WHILE SENDING**: `siteSend` redraws BEFORE it takes the strip, so a
  hand-back on that redraw would leave with the new message's words — a
  words-only message would have carried the held picture, routed `attached:
  true`. Asserted, and the probe that drops the check dies on it.
- **IN MEMORY ONLY**: `sitesSave` writes `unsent: undefined`. A held picture is a
  data URL of up to ~7 MB, and a record carrying one can overflow localStorage
  and fail the save of every site, not just this one. It lasts as long as the
  page, like anything in the composer — **a reload loses it**, the owner's call.
- **NOTHING SENDS IT AGAIN**: the routing call is billed, so sending is the
  customer's press.
- **UNCHANGED, AND SAID** — **⚠ AND WRONG TO LEAVE, the same day (owner)**: the
  strip was ONE list drawn by whichever composer is showing, so a file handed
  back and not sent followed the customer to another site "like any attachment",
  and the box is drawn empty on every redraw, so the handed-back words went at
  the next one. Recorded here as pre-existing; the owner reproduced both as the
  defect they are, and they are fixed in the next section — *a composer's words
  and files belong to its own site*.
- **⚠ FOUND ON THE WAY, NOT CHANGED — THE SAME LOSS ONE STEP LATER.** A routing
  call that fails or answers something unusable stops in `siteRoute`'s `lost()`
  with *"…Send it again in a moment"* and drops the attachments too — on any
  live site, page list loaded or not, and on an existing site's round, whose
  round is cleared before routing. **Measured through the same harness on
  `c5c93652`**: strip empty, nothing held, the resend's logo edit posting no
  image. Outside "this pre-routing check", so it is next-task 9, not fixed here.

**EVIDENCE.** `test/site-entry-inventory.test.mjs` **37 → 48 cases**. The
harness now draws the composer the way the page does on every redraw — a new,
empty box; Send, or Stop while busy; the +; a new strip; or no composer on the
history rail — and wires it with the real `wireSiteComposer`; the attachment is
made by the real attach code out of a file; the real `paintAttachStrip` paints it
(what it DRAWS is asserted); the real `sitesSave` writes a fake localStorage.
**11 new cases**: the owner's reproduction as failure → retry through the
composer's own Send button, the exact image object on the logo edit; the other
three stop reasons (empty, signed out, the bound); a switch to another site and
to the start screen during the wait; a picture chosen during the wait (left as
it is; the held message waits, then comes back whole after its × and a redraw); a
words-only message sent while one waits; two stopped messages (latest first);
the history rail; storage. **The 37 existing cases pass unchanged** — the
clarify, timeout, duplicate-send and new-project cases among them. **Red 11 of
48 against `c5c93652`**, in a throwaway worktree with the old inline composer
wiring packaged under the new name so the file loads — exactly the 11 new
cases, each failing first on the missing hand-back or hold; the controls'
protective halves (nothing into another workspace, a new picture untouched) pass
on both, as a control's should. **Targeted probes, not a sweep: 13 killed, 0
survived, 0 never applied, the comment-only control surviving**, over `chat.js`
against seven files (spec in the scratchpad); `chat.js` byte-identical to its
backup afterwards (`41ccd678eec40411`). The files that read `siteSend`, the
workspace render, the strip or the save: **486 / 486**. **Suite 7,450 locally**
(`# tests 7450 / # pass 7450 / # fail 0 / # skipped 0`, `duration_ms 116,649`)
— **+11 against 7,439**, exactly the new cases. **AND CI MATCHES**: unit run
**`35978672105` on `bd70385a`** reads **`# tests 7450 / # pass 7446 / # fail 0 /
# skipped 4`** (`duration_ms 103,827`) — the total is what matches, `pass`
differing by CI's four skips — with all 48 of the file's cases found passing BY
NAME in the downloaded log archive, 7,450 distinct result numbers and zero `not
ok N -`. No `site build` fires: `public/` and this test file are on none of its
`paths`. **The stamp chain ends at `bd70385a`.** **Rendered in the real
workspace, before and after**: the owner's case (box and strip empty → the words
and the picture back; the resend `attached: false`, no image → `attached: true`,
the attached picture on the logo edit) and the workspace switch. **Every routing
answer is SUPPLIED**: this proves what the browser sends and shows, never what a
real router answers.

### A COMPOSER'S WORDS AND FILES BELONG TO ITS OWN SITE (2026-09-24, merged and deployed in 2153 — no paid run)

Owner, on `3736239`, with the real handlers and the composer wiring: *"Fail the
page-list read with “Use this picture as the logo” and an attachment. Recovery
restores both. Redraw the workspace: the message becomes empty, the attachment
remains, and unsent is already null."* And: *"After recovery, switch to another
site. The restored attachment remains in global siteAttach. Sending a logo edit
there posts the original site’s picture to the other site’s edit endpoint."* —
*"Keep recovered words and files associated with their original site until
explicitly sent, replaced or discarded. Redraws must preserve that association,
and switching sites must not transfer the recovered attachment. Preserve any
newer draft or attachments too."* **Browser only (`public/chat.js`).**

- **REPRODUCED FIRST, BOTH**, through the real `siteSend`, the real attach code
  and the real `wireSiteComposer`: after one redraw the box read `""` with
  `logo.png` still in the strip and nothing held; on ashgrove-1 the strip still
  held it and `POST /api/site/ashgrove-1/edit` went with `images: ["logo.png"]`;
  back on fretwork-1, nothing at all.
- **THE CAUSE IS LAST ROUND'S HAND-BACK.** It moved the held message into the
  only two places a composer had — the words into a box every redraw draws
  empty, the files into ONE list drawn by whichever composer is showing — and
  cleared the hold. Last round recorded the strip following the customer as
  pre-existing; the owner reproduced it as the defect it is, and it is the same
  defect for ANY attachment, returned or not.
- **EACH COMPOSER HAS A DRAFT** (`siteDraft(id)`): `{t, imgs}` on the site's own
  record, and `siteNewDraft` for the start screen. `siteAttachFor` names the
  composer on screen (a site's id, or `''`). The box writes its words into its
  draft on every keystroke (`oninput`) and is filled from it on every draw; the
  strip draws the draft of the composer on screen and its × removes from that
  draft; a file goes into the draft of the composer it was CHOSEN in
  (`siteAttachFiles` names the owner before the read, which answers on a later
  turn); `siteSend` takes the origin site's files and the Send button its words.
  **The global `siteAttach` is gone**: no list belongs to nobody any more.
- **A RETURNED MESSAGE GOES INTO ITS SITE'S DRAFT** (`siteUnsentBack`), so it
  survives every redraw and stays on its site when another is opened, until it
  is sent, changed or cleared. **Only into an EMPTY draft — no words, no files —
  and never while a message is in flight**: last round's "whole and alone" rule,
  widened to the words.
- **⚠ TWO CONSEQUENCES, SAID RATHER THAN LEFT TO BE FOUND:**
  1. **Words typed while a message waits now SURVIVE its stop**, and the stopped
     message waits behind them until they are sent or cleared; the next draw
     then brings it back. Last round the stop's redraw wiped them and the
     stopped words took their place.
  2. **A returned message whose picture alone is removed keeps its words in the
     box**, and the next held message waits until the box is clear too. One
     existing case (two stopped messages) asserted the old order; it now clears
     the words before the redraw that brings the first message back.
- **THE PLATFORM'S OWN WORDS NEVER TAKE THE DRAFT.** The two Fix presses
  (`stFixBtn`, `stErrFix`) call `siteSend(text, true)` (`leaveDraft`). Before, a
  Fix press took the strip with it — a returned logo sent with an instruction
  nobody wrote — and its redraw wiped the box. A census holds it: every call
  that sends a sentence written in the code passes `true`, and the composer's
  two sends (`t`, `prompt`) pass nothing.
- **THE START SCREEN'S FILES ARE ITS OWN**: opening a site no longer carries them
  into that site's strip, and `siteCreate` moves them to the new project's
  draft, which its first build takes. **Its words are unchanged** — its box is
  still drawn empty on a redraw (pre-existing, not asked).
- **IN MEMORY ONLY**, like the held message: `sitesSave` writes `draft:
  undefined`, and a reload loses a draft. A deleted site's draft goes with its
  record.
- **UNCHANGED**: next-task 9 (a routing call that cannot be acted on drops the
  attachments) is untouched.

**EVIDENCE.** `test/site-entry-inventory.test.mjs` **48 → 60 cases**, and its
harness now carries the real `siteDraft` and `siteCreate`; typing fires the box's
`input` event, as a browser does. **12 new cases**: the owner's first sequence
(redraws and the history rail round trip keep both, Send sends both); the
second sequence to another site AND to the start screen (nothing arrives, and
what is sent from there carries no picture — ashgrove-1's logo edit and a new
project's build); switching back after a message was sent and answered on the
other site; a newer draft kept on both sites; words typed during the wait; a Fix
press; the census; a file still being read when another site is opened; the
start screen's files reaching a new project's build and no other composer; the
start screen's two modelled lines, asserted in `renderSites`; and an answer typed
into the box not coming back into it. The storage case now also saves after the
hand-back and finds no draft and no picture. **The immediate-retry and every
clarification case pass unchanged.** `test/site-route-failure.test.mjs` carries
the real draft code in place of the old strip: **74 / 74**. **Red 12 of 59
against `3736239f`** (in a throwaway worktree, with a shim making every "draft"
the old single strip so the harness loads): the 11 new cases then written and the
changed half of the two-messages case, each failing first on the defect — the box
`''` after the redraw, `logo.png` in ashgrove-1's strip, ashgrove-1's routing call
`attached: true`, the Fix press routed with the picture. **With those gates cut
in the throwaway copy, the second sequence fails at the wire**: `logo.png` posted
to `/api/site/ashgrove-1/edit`, and into a new project's build from the start
screen. The typed-answer case was written afterwards for a probe (below); the old
code keeps no draft for it to read. **Targeted probes, not a sweep: 22 killed, 0
survived, 0 never applied, the comment-only control surviving**, over `chat.js`
against five files (`site-entry-inventory`, `site-route-failure`, `site-ask`,
`site-context`, `free-identifiers`; spec in the scratchpad); `chat.js`
byte-identical to its backup afterwards (`98f883cf3bff10bd`). **Not probed, and
said**: the three-file limit's counts (`siteAttachOpen` is stubbed in the
harness) and `siteDraft`'s answer for a site that is gone (unreachable there).
**One redundancy removed rather than left for a probe to survive**: `siteSend`
also cleared the draft's words, which only the Send button holds; it takes the
files alone now. The 92 files that read `chat.js`: **2,968 / 2,968**. **Suite
7,462 locally** (`# tests 7462 / # pass 7462 / # fail 0 / # skipped 0`,
`duration_ms 116,248`) — **+12 against 7,450**, exactly the new cases.
**AND CI MATCHES**: unit run **`35983286186` on `2e2998cc`** reads **`# tests
7462 / # pass 7458 / # fail 0 / # skipped 4`** (`duration_ms 122,549`) — the
total is what matches, `pass` differing by CI's four skips — with all 60 of the
file's cases and all 74 of `site-route-failure`'s found passing BY NAME in the
downloaded log archive, 7,462 distinct result numbers with no gap, and zero `not
ok N -`. **An anchored count of result lines reads 7,461, and 7,462 is right**:
result 5316's line opens with a byte-order mark where the log was chunked — the
trap the routing round recorded (result 5300 there), met again. No `site build` fires: none of the
commit's five files is on that workflow's `paths`. **The stamp chain ends at
`2e2998cc`.**
**Rendered in the real workspace, before and after**, both sequences with the
real + button and file chooser, the real Worker, every request recorded:
before, the redraw emptied the box and Send sent nothing, and ashgrove-1's logo
edit carried `fretwork-logo.png` while fretwork-1 was left empty; after, both
kept, ashgrove-1's edit carried no picture, and back on fretwork-1 the request
went whole. **Every routing answer is SUPPLIED**: this proves what the browser
sends and shows, never what a real router answers.

### MERGED AND DEPLOYED: THE EXISTING-SITE ENTRY AND THE COMPOSER DRAFTS (2026-09-24)

Owner: *"The correction checks out. Independent review on baeca95 passed 260
focused tests, including recovery across redraws, switching sites, returning and
resending, and preserving newer drafts. Proceed with merging and deploying … after
confirming the candidate and required CI remain current. … Record that drafts
survive navigation and redraws within the session, not a browser refresh. Then
close this correction."*

- **CLOSED BY THE OWNER**, as one correction: an existing site waits for its
  page list and a round on one sends the original request; a stopped message
  keeps its files; a composer's words and files belong to its own site — the
  three sections above. **The limit travels with it**: every routing answer in
  the evidence is SUPPLIED, so what is closed is what the browser sends and
  shows, never what a real router decides.
- **DRAFTS SURVIVE NAVIGATION AND REDRAWS WITHIN THE SESSION, NOT A BROWSER
  REFRESH** (the owner's own words, recorded as the rule). A site's typed words
  and attached files stay with that site through redraws, other sites, the start
  screen and back, for as long as the page is open; a refresh loses them.
  `sitesSave` writes `draft: undefined` and never stores a held message, because
  a picture is a data URL of up to ~7 MB and one oversized record can fail the
  save of every site. Making drafts outlive a refresh is a separate decision.
- **RECHECKED BEFORE THE PUSH, AND NOTHING HAD MOVED**: a clean tree;
  `origin/main` still `40190564`; the candidate `baeca959` the branch tip and a
  fast-forward of main; the range **7 commits, 7 files (+2,381 / −74)** —
  `public/chat.js`, `test/page-picker.test.mjs`, `test/site-ask.test.mjs`,
  `test/site-entry-inventory.test.mjs`, `test/site-route-failure.test.mjs` and
  the two documents — with the one product file the reviewed `chat.js`
  (sha256 `98f883cf3bff10bd`); unit CI green on `2e2998cc` (run `35983286186`,
  `7462 / 7458 / 0 / 4`) and on the documents-only `baeca959` (run
  `35983726339`); **no `site build` owed**, none of the seven files being on
  its `paths`; zero runs in progress or queued at 09:59Z.
- **THE ROLLBACK, VERIFIED BEFORE IT COULD BE NEEDED**: `git revert --no-commit
  40190564..baeca959` in a throwaway worktree gives tree **`79ab1cc7…`, main's
  own**, so a rollback also reuses `56f7d5866240a1de`.
- **A FAST-FORWARD**: `main` `40190564` → **`baeca959`** at **09:59:36Z**.
- **DEPLOY 2153 (`35984592632`)**: success, job 09:59:42 → 10:00:39Z (**57 s**).
  `DEPLOY_ID` **`baeca9590e6fb988a883e9f9abf00aa9ed568de7`** (unmasked in the
  log); the deploy gate *"took over from `40190564…`"*; image step **reused
  `56f7d5866240a1de`** (`registry answered 200; ***86 inputs off ./Dockerfile`)
  and Wrangler **`no changes isibi-app-sitebuildcontainer`** — the image id was
  recomputed over both ends before the push and answered the same id from 186
  inputs on each, none of the seven files among them (the THIRD CONFIRMED
  NEGATIVE, in the deploy section above); `+ /chat.js`, 1 uploaded, 85 already;
  `Uploaded isibi-app`, `Current Version ID: 24633147-…`, `Deployed isibi-app
  triggers`. **No hold was owed**: nothing rolled, and the edit jobs keep running
  on the image deploy 2151 put there.
- **THE SERVED-FILE CHECK, BOTH READINGS**: before (09:58:08Z) **746,091 bytes,
  sha256 `35e09289eb624b2e`**, byte-identical to `40190564`'s `chat.js`, 0
  occurrences of `siteDraft`; after (10:02:53Z) **760,703 bytes, sha256
  `98f883cf3bff10bd`, byte-identical to `git show baeca959:public/chat.js`**,
  with `siteDraft` 12, `siteRoutesRead` 3, `siteHoldUnsent` 4 and
  `siteUnsentBack` 4. Gates **401 / 401 / 401 / 404** at 10:02:58Z.
- **DEPLOYED, NOT RUNTIME-CONFIRMED.** The canary dispatch answered **403** again
  at 10:03Z, so the Worker's own sha is the owner's free press:
  `edit-canary.yml` from `main`, spend `no`, `expect_deploy`
  **`baeca9590e6fb988a883e9f9abf00aa9ed568de7`**, `expect_image`
  **`56f7d5866240a1de`**. It also confirms 2151 and 2152, which put that image
  and that Worker code there.
- **THE LIVE CHECK, FREE, IN THE DEPLOYED APP** (10:09Z, owner: *"recover a
  stopped request with a picture, redraw, switch sites, return, and verify the
  original request and picture remain together"*). A real Chromium loaded
  **https://gofarther.dev unchanged** — `index.html`, `chat.js` and every other
  asset from the live origin, `chat.js` hashed as it arrived and equal to the
  merged file — with a fake session seeded into localStorage so the app booted
  signed in through its own code path. **Nothing that costs could leave the
  browser**: all **9** `/api` requests were answered in the page (GETs by a local
  copy of the deployed Worker with its outbound calls stubbed, the routing call
  by it with the router's answer SUPPLIED, the edit POST **stopped in the page**
  and never sent), Supabase was answered in the page, and every other non-static
  request was aborted — **0 `/api` and 0 Supabase requests reached the network**,
  counted. The sequence, with the real + button and file chooser: open
  fretwork-1 with its page list failing, attach a picture, type *"Use this
  picture as the logo."*, Send → the stop sentence, **no routing call**, and the
  words and **the attached picture** back in the box and strip; open and close
  the history rail → both still there; back to the start screen and open
  Ashgrove → **its box and strip empty**; back to fretwork-1 → **the words and
  the picture together**; the page list answering, Send → routed `attached:
  true, firstBuild: false, hasSite: true`, and the edit request carried
  `instruction` *"Use this picture as the logo."*, `layer: logo` and **the
  attached picture byte for byte**. **18 of 18 checks PASS**; the screenshots
  are in the chat. The page's own console carried nothing but the browser
  reporting the check's own 503 and 422 answers; the rest came from the sites'
  own preview and thumbnail frames. **It proves the deployed browser code, not
  the router**: the routing answer is supplied, as in every test of this
  correction.
- **AND THE OWNER CHECKED THE DEPLOYED CORRECTION AND CLOSED IT** (later the
  same day: *"The deployed entry/draft correction checks out. Close it."*).
  What that check covered is the owner's; nothing here records a canary press,
  so the Worker's own sha stays read by the owner's free press, as above.

### THE ADD-ON'S OWN FAILURES BUY THE FULL REWRITE — REPRODUCED (2026-09-24; built the same day, next section)

Owner: *"Bring back the next bounded edit-path issue already recorded, with its
reproduction and proposed scope before implementation."* That is **next-task 8**:
the 05:31 owner-notes entry recorded three items for later — the site with no
page list (closed above), the add-on's own failures, and the reader-broke flag
(read by the routing correction since) — and this is the one left.

**THE REPRODUCTION, FREE, THROUGH THE REAL HANDLERS ON THE DEPLOYED
`baeca959`** (a scratch driver, not committed): the real `siteSend` →
`siteRoute` → `siteAddon` → `addonAnswer`, and for a queued add-on the real
`watchEditJob` with the real `EditPoll`, cut out of `chat.js` and run; `fetch`
is the one seam — the routing call answers a valid add-on, the add-on POST
answers the case, a poll answers the case's stored reply under `x-gf-edit:
final`, and any further POST is recorded and never answered; `applyAddonResult`
is a recorder. **25 of 31 shapes post `/api/site/react-revise`** — the full
rewrite of every page (a revise of the same site measured 17 credits) — and say
nothing:

| shape | what the browser does |
|---|---|
| the add-on POST dropped, or aborted | the rewrite |
| a 200 carrying HTML, truncated JSON or an empty body | the rewrite |
| a 500 carrying Cloudflare's HTML (the Worker threw) | the rewrite |
| a 503, 429 or 501 JSON with no sentence; a 200 `{ok:false}` with none | the rewrite |
| a 401 | the sign-in gate, **and** the rewrite behind it |
| a 404 or 503 from the owner check (`assertOwner` answered raw — the edit route re-shapes it with `editGateRefusal`, this route does not) | the rewrite |
| the route's own escalates, which carry no layer: `empty`, `unconfigured`, `no-source`, `no-meta`, `no-add`, a merge that returned nothing usable | the rewrite |
| the success handler throws after a successful add-on (**injected**, to measure how wide the catch is) | the rewrite |
| queued: a stored 503 or `{ok:false}` with no sentence; a stored escalate with no layer | the rewrite |
| an edit the edit route hands to the add-on (`picker/addon`), whose add-on POST drops or answers 503 with no sentence | the rewrite |
| controls: a refusal with a sentence (both paths), an escalate naming a layer (the hop), a success (both paths), a poll that lost the job | unchanged — no rewrite |

- **THE DOUBLE CHARGE IS THE SEVERE HALF.** A dropped POST, an unreadable 200, a
  Worker that threw after filing the job and a success handler that throws are
  each a point where the add-on may already have LANDED — the rewrite then
  charges again for the same ask and regenerates every page on top of it, with
  no photograph wall (recorded above). It is the shape `siteEdit`'s catch was
  fixed for on 2026-09-23 (`unreadEditMsg`), one route over.
- **THE ESCALATES ARE THE SERVER'S, AND THEY ARE UNCLASSIFIED.** `aEscalate`
  carries no layer, and the browser answers every such escalate with the
  rewrite. The edit route's table already rules on the same reasons one route
  over: `unconfigured` is `explain` and ours (the rewrite meets the same missing
  key), a store read that failed is `explain` and ours, a message nobody could
  place is `explain` — while a store that answered with no pages, and a site
  with no stored design, are genuine `up`. **The add-on route has no such
  table**, and its `no-source` also folds a failed read into "no pages".

**THE PROPOSED SCOPE — BOUNDED, BROWSER ONLY (`public/chat.js`), NOTHING
BUILT:**

1. `siteAddon`'s catch says an unread sentence of its own — a function beside
   `unreadEditMsg`, drafted as *"I couldn't read the answer to that addition,
   so I can't tell whether it went through. Check the preview before asking for
   it again."* (the wording is the owner's) — and never starts the rewrite.
2. `addonAnswer`: an unreadable body says the same; a refusal with no sentence
   says `outcomeMessage('failed')`, or the signed-out sentence on a 401 — never
   the rewrite.
3. The success handler moves out of the catch's reach, so a throw after a
   successful add-on is said rather than answered with a rewrite.
4. **Unchanged**: a refusal with its own sentence; an escalate naming a layer
   (the hop to the edit route); a watch resumed after a refresh (it holds no ask
   and already says so); and — deliberately — the no-layer escalates, which
   stay the server's explicit climb in this scope.

That closes **18 of the 25**: every shape but the seven no-layer escalates (six
answered at once, one stored for a queued add-on).
**The server half, recommended as its own next step and NOT in this scope**:
classify the add-on route's escalates as `EDIT_FAILURES` classifies the edit
route's (an `addon/<name>` table and a census over the route's window; a
sentence at no cost for `unconfigured`, a failed read, `no-add` and a writer
that answered nothing usable; `up` kept for a store that answered with no pages
and a site with no stored design; the owner check re-shaped with
`editGateRefusal`). That is `worker.js` — an image roll — and a class decision
per reason for the owner.

- **TESTS, ON APPROVAL**: the two ADJACENT OPEN DEFECT cases in
  `test/site-route-failure.test.mjs` flip into stops; the reproduction's shapes
  become cases asserting no rewrite POST, the sentence and the busy flag
  cleared, the queued path through the real `watchEditJob`; the controls stay.
- **NOT IN IT**: next-task 9 (a routing call that cannot be acted on drops the
  attachments), translation, full-rewrite internals, model-written replies.
- **WHAT THE REPRODUCTION DOES NOT CLAIM**: every answer is SUPPLIED, so this is
  what the browser does with a response and never how often the route sends
  one; the injected throw measures the catch's width, not a known bug.

### AN ADD-ON THAT FAILS NEVER BUYS THE REWRITE (2026-09-24, passed the owner's independent review, 269 focused tests; merged and deployed in deploy 2154 — no paid run)

Owner, having reproduced the dropped POST and the unreadable response starting
`react-revise` independently: *"A transport failure, unreadable response,
missing refusal sentence or client-side result-handler exception must never
initiate another paid operation."* The distinctions, in the owner's words: lost
connection or an unusable response is an unknown outcome; an authoritative
refusal is shown; an authentication failure asks for sign-in; a success followed
by a display or application error keeps the known result and never calls the
addition failed. *"An HTTP error alone does not establish that nothing changed
or nothing was charged. Likewise, checking the preview cannot establish every
backend addition's outcome."* **Browser only (`public/chat.js`).**

- **REPRODUCED FIRST, REBUILT FROM SCRATCH** (the earlier driver was gone with
  its container): the real `siteSend` → `siteRoute` → `siteAddon`/`siteEdit` →
  `watchEditJob` with the real `edit-poll.js`, `fetch` the one seam, on the
  deployed `chat.js` (sha256 `98f883cf…`). **25 of 36 shapes posted
  `/api/site/react-revise` and said nothing**: every transport and parse
  failure, every failing status without a sentence, a 401 (behind the gate), a
  throw while showing a success — **and the redraw throwing after "✅ Done" was
  already on the thread, which started the rewrite anyway** — and all of those
  again after an edit handed its ask to the add-on route. **Two queued shapes
  hung instead**: an unreadable stored reply ended the watch in silence, and a
  throw on a stored success escaped as an unhandled rejection; the send box
  stayed busy in both. Two more printed garbage rather than rewriting: a blank
  `msg` as a bare warning sign, and an object `msg` as `[object Object]`.
- **ONE SENTENCE FUNCTION, FOUR FACTS** — `addonOutcomeMsg(kind)`, a function so
  the reply harness cuts and runs it:
  `unknown` *"⚠️ I didn’t get a usable answer about that addition, so I can’t
  tell whether it went through. Asking for it again could add it a second
  time."* · `unsaid` *"⚠️ That addition didn’t finish, and I wasn’t told why, so
  I can’t tell whether any part of it was added."* · `signed-out` (the routing
  stop's own sentence) · `shown` *"✅ That addition went through, but I couldn’t
  show the details of what it changed here."* **None claims anything about the
  site, the money or the preview** — the preview cannot show a table, a saved
  function or a schedule. The wording is the owner's to change.
- **WHICH ONE, and the line is the route's own word.** No body → `unknown`. A
  failing status or `ok` not true: its own `msg` if that is a non-blank STRING
  (a blank or an object is no sentence), else `unsaid` when the body says
  `ok: false` and `unknown` when it says less (a raw owner-check `{error}`, a
  list, `{ok:true}` at a 5xx). **A 401 is decided in `siteAddon` from the
  status, before the body**, so an unreadable 401 still asks for sign-in; the
  queued path never meets one, a stored reply never being a 401.
- **A SUCCESS THIS PAGE BREAKS SHOWING STAYS A SUCCESS.** `applyAddonResult`'s
  body is wrapped: a throw before its sentence is out says `shown`; a throw
  after (the redraw) is swallowed, the sentence standing alone. What it recorded
  before the throw — a new page in the picker, a table in the digest — is kept.
- **ONE SENTENCE PER ADDITION.** `siteAddon` latches its `finish` (`tell`) and
  hands the SAME latched one to the synchronous reader and the queued watch; the
  POST's catch — which was `.catch(fallback)` — says `unknown` only when nothing
  has been said, so a refusal whose redraw throws is not contradicted.
- **THE SHARED WATCHER ASKS THE LATCH, NOT WHAT `take` RETURNS.** `take` answers
  null both for an answer already used and for a final reply that would not
  parse; `if (!once) return` read both as "used". `if (w.taken()) return` now,
  and the reader is handed the null. **This reaches queued EDITS too**: an
  unreadable stored edit reply now says `unreadEditMsg` where it hung.
- **FROM AN ADDITION THE REWRITE NOW STARTS IN TWO PLACES, CENSUSED**: a site
  with no address (`if (!slug) return fallback()`, unreachable from `siteRoute`
  and `escalatedEdit`, both of which require one), and **the route's own
  escalate naming no layer — KEPT, and the separate server-side step**: which of
  those reasons really need the rewrite is a class decision per reason, as
  `EDIT_FAILURES` made for the edit route. So **not every automatic rewrite is
  closed**, and a case asserts the climb as it stands on both paths.
- **KEPT AND ASSERTED**: a success (said, the picker updated), a refusal with its
  own sentence, an escalate naming a layer (one edit POST, the same ask), and
  the valid edit → add-on handoff (one add-on POST, the customer's words).
- **EVIDENCE.** `test/addon-failure.test.mjs`, **38 cases** through the real
  handlers — direct, handoff (synchronous and queued edits) and queued add-ons —
  each asserting the requests after the routing call (no rewrite, the add-on
  posted exactly once), the one sentence, the busy flag, the rail and its clock.
  **Red 32 of 38 against `5e82a50b`** in a throwaway worktree (the new sentence
  function appended so the file loads); the 6 green there are the wording case
  and the five controls. With the request gate cut in the throwaway copy, **30
  of the 32 still fail on the sentence**; the two that then pass are the redraw
  cases, whose only defect is the rewrite they start after a correct sentence —
  "✅ Done", and a refusal's own words (**a refusal whose redraw threw reached
  `.catch(fallback)` too**; that case was written after the first red run, and
  the first stamp of 31 of 37 was re-measured with it rather than carried
  over). **Re-anchored, not appeased**: `site-addon` (renamed — it was
  titled "…falls back on everything else", and its `.catch(fallback)` pin
  asserted the defect; now a census of the fallback's calls, over comment-blanked
  code, because the comment recording the old line spells it), `addon-queue` and
  `site-addon` (the two call spellings → *one* finish on both paths, whatever it
  is called), `addon-sweep` (two cases asserted the rewrite for a no-sentence
  refusal and an unparsable body; now the sentence and no action, beside a
  no-layer escalate that still records the rewrite so the recorder is proved
  alive), `add-second-one` (the `if (a.msg)` spelling → driven through
  `browserReply`), and `site-route-failure` (its two ADJACENT OPEN DEFECT cases
  flipped into stops). `scripts/addon-sweep.mjs` cuts `addonOutcomeMsg`, and its
  inert-coercion note was RE-MEASURED rather than kept: 16 bodies × 2 statuses,
  every body the coercion changes gives the raw value's screen on both versions.
  **Targeted probes, not a sweep: 14 killed, 0 survived, 0 never applied, the
  comment-only control surviving**, over `chat.js` against nine files (spec in
  the scratchpad); `chat.js` byte-identical to its backup afterwards
  (`a7389aebbfed06bf`). The 104 files that read `chat.js` or the harness:
  **3,205 / 3,205**. **Suite 7,500 locally** (`# tests 7500 / # pass 7498 /
  # fail 0 / # skipped 2`, `duration_ms 141,432`) — **+38 against 7,462**,
  exactly the new file; the two skips need the site template's own
  dependencies, absent in this container. **AND CI MATCHES**: unit run
  **`36053871897` on `248e6aaa`** reads **`# tests 7500 / # pass 7496 / # fail 0
  / # skipped 4`** (`duration_ms 123,979`) — the total is what matches, `pass`
  differing by CI's four skips — with all 38 of the file's cases, and every
  re-anchored case, found passing BY NAME in the downloaded log archive, 7,500
  distinct result numbers with no gap and zero `not ok N -`. No `site build`
  fires: none of the push's eight files is on its `paths`. **The stamp chain
  ends at `248e6aaa`.** (Its commit message says "red 31": that count was taken
  before the 38th case existed, and is corrected to 32 of 38 above.) **⚠ AND THE FIRST LOCAL RUN READ ONE
  FAILURE THAT WAS THE CLONE**: `site-searchpath` case 11 asks git whether its
  pinned baseline is an ancestor of HEAD, and this container's clone was
  shallow (51 commits) with the baseline's object present — so the skip did not
  fire and the ancestry could not be proved. It failed identically on unchanged
  HEAD and passed once unshallowed; recorded so the next shallow container does
  not chase it. **Rendered in the real app in a real Chromium**, the message
  typed and sent, every request answered in the page, before and after: a
  dropped POST, a 503 with no sentence and an HTML answer — before, the rewrite's
  rail and the stop button with nothing said; after, one sentence and the send
  button. **Every answer is SUPPLIED**: this proves what the browser sends and
  says, never how often a real route answers these shapes.
- **FOUND ON THE WAY, NOT CHANGED**: the edit's own not-knowing sentence
  (`unreadEditMsg`) still ends *"Check the preview before asking for it
  again"*, which the owner's rule says cannot establish a backend change (a
  data or rules edit) — now also said by a queued edit's unreadable reply
  (**reworded 2026-09-25, `a3efddef`, merged and deployed in deploy 2160**); a
  queued job whose poll answers 401 keeps polling behind the gate (no paid
  operation, pre-existing); and a queued REFUSAL whose redraw throws still
  escapes the watcher as an unhandled rejection after its sentence is out (no
  paid operation, pre-existing, the watcher not catching its reader).

### AN ADD-ON REPLY IS VALIDATED BEFORE IT IS TRUSTED (2026-09-24, passed the owner's independent review, 318 focused tests; merged and deployed in deploy 2154 — no paid run)

Owner, after the failure round above passed independent review (269 focused
tests): *"One response-validation gap remains on 248e6aaa: HTTP 503 +
{ok:false, escalate:true, layer:"picture"} posts another paid edit. HTTP 200 +
{ok:false, escalate:"false", layer:"picture"} also posts another edit. HTTP
200 + {ok:"false"} prints "✅ Done." Validate the response before treating it as
authority for success, a queued receipt or another paid action. Require real
booleans, a successful HTTP status for actionable responses, and valid fields
for the action. Invalid or contradictory replies must stop with uncertainty.
Apply the same rules to direct and queued final replies. Retain valid explicit
handoffs and successful additions. This is response validation, not the
deferred classification of legitimate no-layer escalations."* **Browser only
(`public/chat.js`).**

- **REPRODUCED FIRST, AND WIDER THAN REPORTED**, through the real send path on
  248e6aaa, each shape straight back and as a queued job's stored reply: **45
  shapes, and every one acted or claimed.** **16 posted a second paid edit**
  (the 503 escalate, `escalate: "false"`, `escalate: 1`, an escalate beside
  `ok: true`, one with no `ok`, a layer the edit route does not have, a `page`
  that is not a string — and the first two again after an edit handed its ask
  over). **14 started the rewrite** (a layer that is a list, the add-on's own
  name, an empty or null layer, a no-layer escalate at a 503 or with `ok` spelled
  as a string, `escalate: "true"` on a success). **7 printed "✅ Done"** (`ok`
  as `"false"`, `"true"` or `1`), **2 printed a success's own words under a
  warning** (`ok: true` at a 422 carrying a sentence), and **6 took a receipt
  that was not one** (`ok: "true"` watched, `job: 7` polled `/api/site/edit/7`,
  a receipt at a 503 watched, an empty job id and a receipt carrying a `result`
  printed "Done", and a job's own final reply shaped as a receipt printed
  "Done"). Every branch read its field by truthiness and none asked the status.
- **`readAddonReply(httpOk, a)` IS THE ONE READING**, asked by `siteAddon` for
  its receipt and by `addonAnswer` for every outcome, straight back or a job's
  final reply. Six answers:
  - **`hop`** — HTTP 2xx, `ok: false`, `escalate: true`, a `layer` in
    `ROUTE_EDIT_LAYERS` (the browser's guarded copy of the edit route's list, so
    `addon` is never a hop), `page` a string or absent → one paid edit there.
  - **`climb`** — the same with the `layer` KEY MISSING → the rewrite. **KEPT,
    and still the deferred server-side classification**; this refuses only a
    malformed one.
  - **`receipt`** — HTTP 2xx, `ok: true`, a non-empty string `job`, no `result`
    → watched. Only the POST can answer one: in `addonAnswer` a receipt is not
    knowing, a job's final reply never being "queued".
  - **`success`** — HTTP 2xx, `ok: true`, no escalate, and no `job` unless it is
    the sweep's recovered reply (`EditPoll.isRecovered`) → applied and said.
  - **`refusal`** — `ok: false`, no escalate, at ANY status, since it starts
    nothing → the route's sentence or `unsaid`.
  - **`unknown`** — everything else → `addonOutcomeMsg('unknown')`, nothing more
    posted.
- **ABSENT IS `== null`**, `routeActionable`'s convention, **EXCEPT THE CLIMB'S
  LAYER**: the climb is the one paid step an absence reaches, and the route's
  no-layer escalate has no `layer` key at all (`aEscalate(reason)` spreads
  nothing; a hop is written only when `addLayerIn` answered a real layer), so
  `layer: null` is not knowing, never a climb.
- **THE JOB ID'S GRAMMAR IS THE SERVER'S.** The browser asks for a non-empty
  string; the poll route answers any id that is not 32 hex (`isJobId`) with the
  404 a lost job gets, which the watcher reads as `gone`. A shape check here
  would be a second copy of `ID_RE`.
- **ONE CHANGE BEYOND THE REPORT, SAID**: `ok: true` at a failing status CARRYING
  a sentence printed that sentence under a warning; it is not knowing now. With
  no sentence it already was, since the failure round.
- **FOUND ON THE WAY, NOT CHANGED — THE EDIT READER HAS THE SAME CLASS**,
  measured through the real handler on this branch, straight back AND queued: a
  503 escalate naming the add-on posts the paid add-on; one naming a layer posts
  another paid edit; one naming no layer starts the rewrite; `escalate: "false"`
  naming a layer posts another edit; `ok: "false"` prints "✅ Done.".
  `editAnswer` reads `e.escalate` by truthiness before `httpOk`, and `!e.ok`.
  The owner's report and rule were the add-on's, so it is next-task 10; the same
  reader shape would close it.
- **EVIDENCE.** `test/addon-failure.test.mjs` **38 → 87 cases**, every one
  through the real handlers with `fetch` the one seam: the three reproductions
  straight back, as a queued job's stored reply AND after an edit handed its ask
  over; the fifteen wider shapes straight back and queued; five receipts that
  are not one, and a job's final reply shaped as a receipt; and four new
  controls — a real 202 receipt and the 200 for an ask already filed, the
  sweep's recovered reply (a `job` on a FINAL reply, still a success),
  `escalate: false` as a real boolean (a refusal shown, a success applied,
  neither hopping), and a hop naming a page carrying it to the edit route.
  **Red 45 of 87 against 248e6aaa** in a throwaway worktree, the reader
  appended there unused so the harness can cut it — exactly the 45 new
  non-control cases; the 42 green on both are the 38 kept and the 4 new
  controls. **⚠ THE FIRST RED RUN READ 43, AND THE TWO WERE A ROW THAT DID NOT
  DISCRIMINATE**: `ok: true` at a 422 with no sentence was already a stop after
  the failure round, so a comment calling every row "measured acting on
  248e6aaa" was false for it. The row carries a sentence now, the shape the old
  reader printed, and the red run was re-taken rather than the claim kept.
  **Re-anchored, not appeased — five guards pinned the old spelling**:
  `addon-queue` (the receipt's truthiness → the reader asked before the receipt
  branch, and a job watched only inside it; the reader's branch ORDER → the
  reader asked first, the applied branch the fall-through, and a census that
  `addonAnswer` reads none of `ok`/`escalate`/`layer`/`page`/`job` itself, over
  comment-blanked code), `site-addon` twice (`layer !== 'addon'` → the reader's
  `ROUTE_EDIT_LAYERS` check plus the browser's list parsed and found holding
  `picture` and not `addon`; the escalate-before-refusal order, which is
  LOAD-BEARING in the reader, since an escalate is `ok: false` too), `addon-sweep`
  (the hop fixture had no `ok` and is the route's own shape now; `{ok: true,
  msg}` at a 422 showed the msg and is not knowing now; the owner's three
  asserted as the paid run's reader records them: no action), and `edit-poll`
  (its resume case pinned `rememberJob(slug, a.job, …)` — the fifth, found by
  the focused run rather than by reading). `scripts/addon-sweep.mjs` cuts
  `readAddonReply` and gains `BROWSER_LINES` for the layer list, a LINE the
  function cutter cannot reach — its valid-hop case is what proves both in
  scope, reaching `ROUTE_EDIT_LAYERS.includes`. The three `siteSend` harnesses
  cut the reader too. **Targeted probes, not a sweep: 25 killed, 0 survived, 0
  never applied, the comment-only control surviving**, over `chat.js` and
  `scripts/addon-sweep.mjs` against thirteen files (spec in the scratchpad) —
  one per clause of the reader, each wiring hop (the POST's receipt, its status,
  the reader's status, the queued reply's status, the hop's page, the unsaid
  sentence) and both harness lists; both files byte-identical to their backups
  afterwards (sha256 `489b2884eab21157`, `6170bfc7ee4d0d49`). **Two redundant
  belts were removed before the probes rather than left to survive them**: a
  list, a bare value and a string all lack a boolean `ok`, so `Array.isArray`
  and `typeof a !== 'object'` could never decide anything the `ok` check did
  not. The 92 files that read `chat.js`: **3,051 / 3,051**. **Suite 7,549
  locally** (`# tests 7549 / # pass 7547 / # fail 0 / # skipped 2`,
  `duration_ms 132,610`) — **+49 against 7,500**, exactly the new cases; the
  re-anchors added assertions, not cases. **AND CI MATCHES**: unit run
  **`36058296434` on `f1dadcdc`** reads **`# tests 7549 / # pass 7545 / # fail 0
  / # skipped 4`** (`duration_ms 111,191`) — the total is what matches, `pass`
  differing by CI's four skips against the two local ones — with all 87 of the
  file's cases and the six re-anchored ones found passing BY NAME in the
  downloaded log archive, 7,549 distinct result numbers with no gap and zero
  `not ok N -`. No `site build` fires: none of the commit's nine files is on its
  `paths`. **The stamp chain ends at `f1dadcdc`.** **Rendered in the real app in a real
  Chromium**, before and after, the owner's three typed and sent: before, the
  503 escalate and `escalate: "false"` left the rail running on a second paid
  edit POST with nothing said, and `ok: "false"` printed "✅ Done."; after, one
  sentence, the send button, and nothing past the add-on POST. **Every answer
  is SUPPLIED**: this proves what the browser does with a reply, never how
  often a real route sends one.

### MERGED AND DEPLOYED: THE ADD-ON FAILURE HANDLING AND REPLY VALIDATION (2026-09-24, evening)

Owner: *"The add-on validation checks out on fd27cc9. Independent review passed
318 focused tests, and CI is green. Proceed with merging and deploying this
reviewed correction after checking the candidate and required CI. Verify the
deployed SHA, served chat.js, and container reuse or roll from actual
deployment evidence. No paid replay."* The two sections above — *an add-on that
fails never buys the rewrite* and *an add-on reply is validated before it is
trusted* — go out as one push.

- **RECHECKED BEFORE THE PUSH, AND NOTHING HAD MOVED**: a clean tree;
  `origin/main` still `baeca959`; the candidate `fd27cc9f` the branch tip and a
  fast-forward of main; the range **5 commits, 12 files (+1,714 / −156)** —
  `public/chat.js`, `scripts/addon-sweep.mjs`, eight test files and the two
  documents; unit CI green on every commit of it (the last three `36053871897`,
  `36058296434`, `36058719896`); zero runs in progress or queued at 21:23Z.
- **NO `site build` WAS OWED, ASKED WITH GITHUB'S OWN GLOB RULE.** The first
  check was a shell `case`, whose `*` crosses `/`, and it answered that every
  `scripts/` and `test/` file matched `site-build.yml`'s root `*.mjs`. GitHub's
  `*` stops at `/`: re-asked that way, **none of the twelve matched**, and the
  branch's last `site build` is `16b9ce72`'s, before the range. *An instrument
  with a different grammar from the thing it imitates* — it erred the safe way
  this time.
- **REUSE PREDICTED FROM THE INPUTS**: both ends answered `56f7d5866240a1de`
  from 186 inputs, and the push's twelve files intersected with the input set
  answered none — the observer proved alive first (`worker.js` and
  `builder/page-keep.mjs` are inputs).
- **THE ROLLBACK, VERIFIED BEFORE IT COULD BE NEEDED**: `git revert --no-commit
  baeca959..fd27cc9f` in a throwaway worktree gives tree **`4edb0c82…`, main's
  own**, so a rollback also reuses `56f7d5866240a1de`.
- **A FAST-FORWARD**: `main` `baeca959` → **`fd27cc9f`** at **21:23:36Z**.
- **DEPLOY 2154 (`36061189343`)**: success, job 21:23:45 → 21:24:28Z (**43 s**).
  `DEPLOY_ID` `fd27cc9ffcfa5aae9cdbf66a8a5ce***c9595f***efc` (each `***` a masked
  `1`); the deploy gate *"took over from `baeca959…`"*; image step **1.5 s** —
  `reused isibi-app-sitebuildcontainer:56f7d5866240a***de (registry answered
  200; ***86 inputs off ./Dockerfile)`; Wrangler **16.2 s** (it reinstalled
  itself first, as on 2153) — `+ /chat.js`, 1 uploaded, 85 already, `Uploaded
  isibi-app`, **`no changes isibi-app-sitebuildcontainer`**, `Deployed isibi-app
  triggers`, `Current Version ID: 6327b***3b-…`. **No hold was owed**: nothing
  rolled, and the edit jobs keep running on the image deploy 2151 put there.
- **THE SERVED-FILE CHECK, BOTH READINGS**: before (21:23:24Z) **760,703 bytes,
  sha256 `98f883cf3bff10bd`**, byte-identical to `baeca959`'s `chat.js`, 0
  occurrences of `readAddonReply` or `addonOutcomeMsg`; after (21:25:12Z)
  **770,384 bytes, sha256 `489b2884eab21157`, byte-identical to `git show
  fd27cc9f:public/chat.js`** with and without a query string, 5 and 6 of them.
  Gates **401 / 401 / 401 / 404** at 21:25:15Z.
- **DEPLOYED, NOT RUNTIME-CONFIRMED.** The canary dispatch answered **403**
  again at ~21:25Z, so the Worker's own sha is the owner's free press:
  `edit-canary.yml` from `main`, spend `no`, `expect_deploy`
  **`fd27cc9ffcfa5aae9cdbf66a8a5ce1c9595f1efc`**, `expect_image`
  **`56f7d5866240a1de`** — which also confirms the image and Worker code
  2151–2153 put there.

### AN EDIT REPLY IS VALIDATED BEFORE IT IS TRUSTED (2026-09-24, merged and deployed in deploy 2155 — no paid run)

Owner, once the add-on round had deployed: *"I independently reproduced: HTTP
503 carrying the edit's addon handoff posts a paid addon. HTTP 200 with
{ok:"false"} prints "✅ Done." Apply equivalent response validation to the
edit's direct response, queued receipt and stored final reply. Require real
booleans, appropriate HTTP status and valid action fields before success or
another paid action. Invalid or contradictory responses must stop with
uncertainty. Preserve legitimate edit handoffs, refusals, recovered results,
partial outcomes and duplicate-execution protection. Keep the add-on's
legitimate no-layer escalation classification as its separate follow-up."*
**Browser only (`public/chat.js`).** Next-task 10.

- **REPRODUCED FIRST, ON THE DEPLOYED CODE, AND WIDER.** Through the real send
  path on `fd27cc9f` — byte-identical to what `gofarther.dev` serves — each of
  25 malformed shapes straight back and as a queued job's stored reply. **In 34
  of the 50 readings the page started a paid request**: another edit (16 — a
  503 hop, `escalate` spelled `"false"`, `"true"` or `1`, an escalate beside
  `ok: true` or with no `ok`, a layer the edit route does not have, a `page`
  that is a number), the add-on (6 — the owner's 503 handoff, `escalate:
  "false"` naming it, one beside `ok: true`), or the full rewrite (12 — a 503
  climb, a layer that is a list, `null` or empty, a climb with `ok: "false"`,
  `escalate: "true"` on a success). **8 printed "✅"** (`ok` as `"false"`,
  `"true"` or `1`), **2 printed a success's own words under a warning** (`ok:
  true` at a 422 with a sentence), and **5 said *"That edit didn't finish. Your
  site is untouched and anything it cost has been refunded"*** about a body
  that said nothing of the kind (a success at a 503, a list, a bare `{error}`).
  **Six replies that were not receipts were taken as one** — `ok: "true"`
  watched, `job: 7` polled as `/api/site/edit/7`, a receipt at a 503 and one
  beside an escalate watched, and an empty job id or a receipt carrying a
  `result` printed "✅ Done." at once — and **a job's own final reply shaped as a
  receipt printed "✅ Done."**. `editAnswer` read `e.escalate` by truthiness
  before it asked the status, and `!e.ok`; `siteEdit` took a receipt on `e.ok
  && e.job && !e.result`.
- **ONE RULE, NOT A SECOND COPY.** The add-on reader's body is now
  `readRouteReply(httpOk, reply, hops)`, and both readers are one line over it:
  `readAddonReply` passes `ROUTE_EDIT_LAYERS` (no `addon` — its own name is never
  a hop), `readEditReply` that list plus `addon`, because the edit route's
  `escalate("addon", { layer: "addon" })` is its handoff and
  `EditPoll.escalateAction` sends it there. **The two routes' replies were
  already one shape** — the edit route's `escalate()`, `explain()`,
  `enqueueReply`, `editStopped` and the sweep's recovered and reconciled replies
  all land in the add-on's six answers — so the difference is one argument, and
  **the add-on's behaviour is byte-for-byte unchanged**: its 87 cases pass
  without an edit, and a differential case drives both readers over 37 shapes
  and finds them equal everywhere but the handoff.
- **WHERE IT IS ASKED**: `siteEdit`'s POST, for its receipt (HTTP 2xx, a real
  `ok: true`, a non-empty string `job`, no `result`), and `editAnswer`, for
  every outcome — straight back, a queued job's stored reply, a watch resumed
  after a refresh, and a hop's own reply. **`unknown` — and a receipt-shaped
  FINAL reply — says the edit's own not-knowing sentence (`unreadEditMsg`) and
  posts nothing.** `hop` and `climb` go to `escalatedEdit` **with only the fields
  the reader checked** (`{layer, page}`, never the raw body), which still decides
  where they go; `refusal` keeps its branch exactly; a `success` is applied.
- **KEPT, AND DRIVEN ON THE OLD AND THE NEW CODE**: a success and a partial
  success; the 202 receipt and the 200 for an ask already filed, the receipt
  remembered with its ask; the valid edit → add-on handoff (straight back,
  queued and resumed — the add-on posted once, in the customer's words); a hop
  to a cheaper rung, carrying a named page; a classified climb to the rewrite;
  **the one-hop bound** (a hop's own escalate goes up, never sideways again) and
  an escalate naming its own layer going up; the `explain` refusals with the
  whole-request note on both paths; the all-refused merge; `escalate: false` as
  a real boolean; **needs-review blocking the next message without an edit
  POST**; `editStopped` and the reconcile's refund in their own words; the
  sweep's recovered reply; a dropped POST and an unreadable body. **24
  legitimate shapes read identically before and after.**
- **ONE CHANGE BEYOND THE REPORT, SAID: A 401 ASKS FOR SIGN-IN.** Read as a
  reply, a 401 (`{error: "sign in required"}`, no `ok`) would now be not knowing;
  it is the one failure whose next step is known, so `siteEdit` decides it from
  the status before the body — the add-on's and the routing stop's rule and
  sentence (*"You're signed out. Sign in and send that again."*), where it said
  *"That edit didn't finish … refunded"*.
- **THE NOT-KNOWING SENTENCE IS REUSED, NOT REWORDED.** `unreadEditMsg` still
  ends *"Check the preview before asking for it again"* — the open wording
  question recorded last round (a `rules` edit leaves nothing on the preview),
  now said for more shapes. The wording is the owner's. (**Reworded
  2026-09-25, `a3efddef`, merged and deployed in deploy 2160**: *"Asking for it again could make
  the change twice."*)
- **NOT CHANGED, AS SCOPED**: the add-on route's well-formed no-layer escalates
  still climb (the separate server step); the edit route's are classified
  already (`builder/edit-failure.mjs`) and still climb where it says `up`. A
  stored reply with a 404 status is still read by the poll as a lost job before
  any reader sees it — *"I lost track of that edit…"* — pre-existing, and nothing
  is posted.
- **⚠ FOUND ON THE WAY, NOT CHANGED — A HOP THAT SUCCEEDS LEAVES THE SITE'S
  EDIT LATCH HELD** (next-task 11): the next edit message of that page load pays
  for its routing call and then hangs, busy, with the rail running. **Fixed on
  the branch the next round** (*a site's edit latch is held for exactly as long
  as its ask*, below).
- **EVIDENCE.** `test/edit-reply-validation.test.mjs`, **72 cases** through the
  real handlers with `fetch` the one seam: the owner's two and the 23 wider
  shapes, each straight back and as a stored reply (50); six receipts that are
  not one and a receipt-shaped final reply (7); the 401 (1); a watch resumed
  after a refresh, stopped, and its handoff control (2); eleven controls; the
  differential case over both readers (1); and a structural census (1) —
  `editAnswer` reads none of `ok`/`escalate`/`layer`/`page`/`job` itself, over
  comment-blanked code, `escalatedEdit` is handed the reader's fields,
  `siteEdit` watches no job the reader did not check, and the 401 is asked
  before the reader. **Red 60 of 72 against `fd27cc9f`** in a throwaway
  worktree, the two readers appended there unused so the harness can cut them —
  exactly the non-control cases; the 12 green on both are the eleven controls
  and the differential case, which drives the readers alone. **With the
  request-trail assertions cut in that copy, all 60 still fail** — on what was
  said, or on the send box left busy — so each case sees the defect twice.
  **Re-anchored, not appeased — seven failures in four files pinned the old
  spelling**: `addon-queue` (the edit's watch call → `\w+\.job`), `edit-poll`
  four times (the receipt gate → the reader asked, with the rule's receipt and
  success lines read in the shared reader; the watch call and `rememberJob` →
  `\w+\.job`; the failure branch's observer → the reader's `refusal`),
  `site-addon` (the reader window → `readRouteReply`'s body for the rule and
  `readAddonReply`'s argument for the list), and `site-apply` (the
  escalate-before-refusal order → the rule's own order, where it is
  load-bearing, plus `editAnswer` asking the reader; the unreadable-body pin →
  the `unknown` branch). `scripts/addon-sweep.mjs` cuts `readRouteReply` into
  both harnesses and `readEditReply` plus the layer line into the edit's; the
  three `siteSend` harnesses cut both readers. **Targeted probes, not a sweep:
  17 killed, 0 survived, 0 never applied, the comment-only control
  surviving**, over `chat.js` and `scripts/addon-sweep.mjs` against fourteen
  files (spec in the scratchpad) — the old receipt gate, the 401, the reader
  bypassed, a receipt-shaped final reply, a climb not escalated, a refusal only
  at 2xx, the handoff off the edit's list, `addon` on the add-on's, the rule's
  status, boolean and hop-list clauses, and the three harness lists. **Two of
  them — the raw body to `escalatedEdit`, the raw `e.job` to the watch — are
  equivalent on input the reader has checked and are killed only by the
  census**, which is why it exists. Both files byte-identical to their backups
  afterwards (sha256 `7e90c39ee2285341`, `3a265f350f922395`). The 104 files
  that read `chat.js`, the edit poll or the reply harness: **3,310 / 3,310**.
  **Suite 7,621 locally** (`# tests 7621 / # pass 7619 / # fail 0 / # skipped
  2`, `duration_ms 132,199`) — **+72 against 7,549**, exactly the new file; the
  re-anchors added assertions, not cases. **AND CI MATCHES**: unit run
  **`36063913439` on `8921c0ec`** reads **`# tests 7621 / # pass 7617 / # fail
  0 / # skipped 4`** (`duration_ms 108,822`) — the total is what matches,
  `pass` differing by CI's four skips against the two local ones — with all 72
  of the file's cases and the seven re-anchored ones found passing BY NAME in
  the downloaded log archive, 7,621 distinct result numbers with no gap and zero
  `not ok N -`. **The stamp chain ends at `8921c0ec`.** No `site build` fires:
  none of the commit's ten files is on its `paths`. **Rendered in the real app
  in a real Chromium**, before (the deployed `fd27cc9f`) and after, the owner's
  two typed and sent: before, the 503 handoff left the rail running on a paid
  add-on POST with nothing said, and `ok: "false"` printed "✅ Done."; after,
  one sentence and nothing past the edit POST. **Every answer is SUPPLIED**:
  this proves what the browser does with a reply, never how often a real route
  sends one.

### A SITE'S EDIT LATCH IS HELD FOR EXACTLY AS LONG AS ITS ASK (2026-09-24, merged and deployed in deploy 2155 — no paid run)

Owner, having reproduced it independently through the real handlers: *"1. An
edit hands off to another edit layer. 2. That layer succeeds and the customer
hears "Updated the wording." 3. A second message reaches the router. 4. No
second edit POST occurs, and busy stays true."* — *"Release the original
request's duplicate-execution lock when its handoff chain genuinely finishes.
Preserve protection while work is active, including queued jobs, and ensure an
old completion cannot release a newer request's lock."* Next-task 11. **Browser
only (`public/chat.js`).** The edit-reply validation (`8921c0ec`) is under it and
is NOT deployed either — the owner put this correction before that deploy.

- **REPRODUCED FIRST, AND IT IS TWO DEFECTS POINTING OPPOSITE WAYS**, through
  the real `siteSend` → `siteRoute` → `siteEdit` → `watchEditJob`/`siteAddon`
  → `reactSend` on `4b849501`, two messages through one page:
  - **HELD FOR GOOD.** Every chain with a synchronous hop left the site latched
    after message 1, whatever the hop answered — **10 of 10**: a success (the
    owner's), a 422 refusal, a dropped POST, an unreadable body, a 401, the
    hop's own queued success, a handoff to the add-on, a climb to the rewrite
    (402), `needs-review`, and an escalate at a 503. Message 2 then made its
    routing call, posted no edit, said nothing, and left the send box busy with
    the rail running. The latch was a site name in a `Set`, released by
    `clearFlight` — a no-op inside a hop (`handedOff`), and never called by the
    first POST once it had handed off (`escalatedEdit`'s hop: *"THE LATCH IS
    NOT CLEARED HERE"*).
  - **RELEASED TOO EARLY.** A queued edit released it at its RECEIPT, while the
    job it had just filed was still running — and `EDIT_ASYNC_EVERYONE` makes
    every edit POST answer a receipt, so **during the ordinary edit the latch
    protected nothing**. An edit that handed its ask to the add-on released it
    at the handoff too. Only the page's busy flag stood in front of a second
    ask.
  - **THE CONCURRENT CONTROL HELD ON THE OLD CODE**: a second press while
    message 1's POST was unanswered sent nothing (the busy flag) — 1 routing
    call, 1 POST.
- **THE LATCH BELONGS TO THE ASK.** `editInFlight` is a `Map` from a site to the
  ask holding it; `editAsk(slug)` hands out a fresh token or `null`, and
  `editAskDone(slug, ask)` deletes the entry only while THAT token still holds
  it — so an old ask's late completion cannot release a newer one. `siteEdit`
  takes it for a customer's message (`!handedOff`) and wraps that message's
  `finish` and `fallback` — release first, then continue — **before the POST**,
  so every callback the POST can reach is handed the wrapped pair: its reply,
  its catch, a hop, a queued watch, the add-on handoff. **`clearFlight` is gone**,
  the receipt's release and the add-on handoff's with it; nothing else names the
  map (a census holds it).
- **THE HANDOFF TO THE FULL REWRITE RELEASES — MEASURED, NOT CHOSEN.** A
  rewrite that succeeds ends through `siteFinishBuild` and never calls the
  `finish` it was handed (`reactSend`'s success branch), so a latch waiting for
  the rewrite would be held for good by every successful climb — the defect
  again. The page's busy flag stays set until the rewrite ends, and a case
  asserts a message sent meanwhile reaches nothing.
- **A HOP TAKES NO LATCH AND RELEASES NONE**: it inherits the wrapped pair.
  **A RESUMED WATCH TAKES NONE, AS BEFORE** — `resumeOpenSite` sets the busy
  flag, and a control asserts a resumed hop leaves nothing held.
- **THE DUPLICATE REFUSAL STAYS SILENT**, and is reached only when the busy flag
  came down while another ask holds the site — an older ask's `finish` running a
  second time, which the flag, having no owner, cannot tell from the holder's.
  A sentence there could only go through the refused message's own `finish`,
  which would lower the flag while the holder runs. Wording, and whether to say
  anything, is the owner's. **That second run was the only path found to reach
  it, and it is closed** (next section), so the refusal is now the wall behind
  the busy flag.
- **THE VALIDATED READERS ARE UNTOUCHED**: `readRouteReply`, `readEditReply`
  and `readAddonReply` are byte-identical, and `edit-reply-validation`'s 72
  cases pass with only their harness's declaration line changed.
- **FOUND ON THE WAY, NOT CHANGED**: the one-hop bound is not enforced on the
  queued path (next-task 12, unreachable today), and a throw after an edit's
  sentence is out says a second sentence and lowers the busy flag (next-task
  13) — both driven. **Next-task 13 is fixed in the next section.**
- **EVIDENCE.** `test/edit-lock.test.mjs`, **23 cases**, every one sending TWO
  messages through ONE page with `fetch` the one seam — a request the script
  does not answer is HELD, which is how a case reads the latch while work is
  active — and asserting every request (the message a routing call routed, the
  layer and ask an edit posted, the job a poll followed), what was said, and
  the final busy, rail, clock and latch state: the hop's every end (success,
  422, dropped POST, unreadable body, 401, an escalate at a 503 the reader
  refuses), a first POST that drops, `needs-review` (message 2 meets the review
  block, not the latch), four queued shapes (the latch held while the job runs
  and while a stored hop posts, a hop's own queued answer, a stored refusal, a
  lost job), the add-on handoff (held through it, straight and queued) and a
  hop into it, the climb (released at the handoff, the page busy until the
  rewrite ends, a message sent meanwhile reaching nothing), two duplicate-press
  controls, the latch refusing a second ask on its own during a watch, the
  token contract, an old ask's late finish after a newer ask took the site
  (the newer ask keeps it, and a third press meets the latch), and a resumed
  watch's hop leaving nothing held. **Red 17 of 23 against `4b849501`** in a
  throwaway worktree, only the two new functions appended so the file loads:
  16 fail on the latch itself, and the contract case fails because the
  appended functions meet the old `Set` (not evidence); the 6 green on both are
  the first-POST drop, the queued refusal, the lost job, the two duplicate-press
  controls and the resume control. **With the latch assertions cut in that
  copy, the 8 stuck-chain cases still fail on the owner's own symptom** —
  message 2 routed and posted no edit — and the lock-wall case on a second
  POST; the climb and stale-completion cases fail on latch assertions of their
  own, which the cut left in place. The four too-early cases then pass, and so
  does `needs-review` (the review block refuses message 2 either way): in those
  the latch state is the only difference, and the too-early half is otherwise
  visible only through a second ask past the busy flag — which the lock-wall
  case drives. **Re-anchored, not appeased**: `edit-poll` three times
  (the latch landmark → `const ask = editAsk(slug);`, the guard's close found
  by DEPTH with a new `blockEnd` — the block holds the two wrappers now, so a
  flat `indexOf("}")` finds the first wrapper's brace; and the `clearFlight`
  count, which was the defect's own shape, → the wrappers, a census of
  `editAskDone` (one definition and two calls), no `clearFlight` anywhere, and
  `editInFlight` named only by its declaration and its two owners), `site-apply`
  (both not-knowing lines without `clearFlight();`), and five harnesses —
  `edit-reply-validation` and `addon-failure` cut the page's own declarations
  and the two functions instead of a hard-coded `Set` line, `site-route-failure`,
  `site-entry-inventory` and `edit-page-target` cut the two functions and supply
  a `Map`. `scripts/addon-sweep.mjs` drops the dead `clearFlight` field.
  **Targeted probes, not a sweep: 11 killed, 0 survived, 0 never applied, the
  comment-only control surviving**, over `chat.js` against the 26 files that
  load the edit path (spec in the scratchpad) — the receipt releasing again,
  either wrapper not releasing, the fallback unwrapped, a release without the
  token compare, a held site handing out a second ask, a refused ask carrying
  on, a hop taking a latch of its own, the add-on handoff releasing early, the
  release after the page's `finish` instead of before, and a release with a
  foreign token — **and the same 11 killed by `edit-lock.test.mjs` ALONE**, so
  the two-message cases catch each one without the census. `chat.js`
  byte-identical to its backup after both runs (sha256 `420e05d71a71b313`). The
  26 files, before the probes: **948 / 948**. **Suite 7,644 locally** (`# tests
  7644 / # pass 7642 / # fail 0 / # skipped 2`, `duration_ms 130,375`) — **+23
  against 7,621**, exactly the new file; the re-anchors added assertions, not
  cases. **AND CI MATCHES**: unit run **`36070847167` on `c3963607`** reads
  **`# tests 7644 / # pass 7640 / # fail 0 / # skipped 4`** (`duration_ms
  122,639`) — the total is what matches, `pass` differing by CI's four skips
  against the two local ones — with all 23 of the file's cases, the three
  re-anchored `edit-poll` cases and the re-anchored `site-apply` case found
  passing BY NAME in the downloaded log archive, 7,644 distinct result numbers
  with no gap and zero `not ok N -`. **The stamp chain ends at `c3963607`.** No
  `site build` fires: none of the commit's twelve files is on its `paths`,
  checked with GitHub's own glob rule (`*` does not cross `/`) and the matcher
  proved alive on `worker.js` first. **Rendered in the real app in a
  real Chromium**, before (`4b849501`) and after, the owner's sequence typed and
  sent: before, message 2 routed and then sat on "Thinking" with the stop
  button drawn; after, it posted its edit and was answered. **Every answer is
  SUPPLIED**: this proves what the browser sends and holds, never how often a
  real route answers these shapes.

### A PUBLISHED EDIT THIS PAGE FAILS TO SHOW IS STILL A PUBLISHED EDIT (2026-09-24, merged and deployed in deploy 2155 — no paid run)

Owner, keeping the lock correction (*"539 focused tests, all green. Keep
it."*): *"A queued edit receives a successful stored result. scheduleCreditRefresh
throws inside result application (injected). The rejection escapes; no reply is
shown; busy remains true; editInFlight still holds fretwork-1. This is a
controlled error-injection result, not a new live incident. It extends the
display-error finding you already recorded."* — and the rule, the add-on's:
*"A successful server result remains successful if local application or
rendering fails. Finish the request and release only its own lock. Do not start
another paid operation. Do not append an uncertainty warning after success has
already been reported. A late completion must not clear a newer request's busy
state or lock."* Next-task 13. **Browser only (`public/chat.js`)**, on top of the
lock correction and the edit-reply validation, neither deployed.

- **REPRODUCED FIRST ON `ce27b5bb`, AND WIDER THAN REPORTED**, through the real
  send path with `fetch` the one seam and the failure injected where the owner
  put it — the credit refresh throwing only when called from inside the result's
  application (the routing call refreshes the balance too, and a throw there is
  `siteRoute`'s `lost()`), or the redraw throwing once a reply is recorded:
  - **the owner's case, and then the NEXT message sent nothing at all** — not
    even its routing call: stuck until a reload. The same on a hop whose own
    answer was queued, a watch resumed after a refresh (no latch, busy stuck)
    and a queued double failure.
  - **straight back, the same throw reached `siteEdit`'s POST catch**, which
    said *"I couldn't read the answer to that change, so I can't tell whether
    it went through"* about an edit the route had published — and on a hop's
    success.
  - **a redraw failing after "✅ Updated the look." was recorded** printed that
    sentence UNDER it (straight back, and on a hop) and ran the page's finish a
    second time; queued, it escaped the watcher as an unhandled rejection.
  - **a late completion**: where that redraw had started a newer message
    (through the page's own `siteSend`), the second finish lowered the newer
    message's busy flag and stopped its rail with its edit in flight — the
    latch still refused a third ask's edit, after that ask had paid its routing
    call. The same for a refusal's redraw.
  - **and the recorded finding for every other sentence**: a refusal, an
    unreadable answer, a sign-out and a hop's refusal each got the not-knowing
    sentence under them when their redraw threw.
- **`applyEditResult` KEEPS A KNOWN RESULT — `applyAddonResult`'s rule, line for
  line.** A throw before its sentence says `editShownMsg()` — *"✅ That change
  went through, but I couldn't show the details of what it changed here."*, the
  add-on's `shown` sentence one noun over (the wording is the owner's); a throw
  after is left standing (`told`). **And nothing escapes it**: the known-result
  sentence's own finish is guarded as well — where the add-on's is not — because
  on a queued edit there is no catch above it but the event loop's. The sentence
  is COMPOSED outside that guard, so a missing composer still fails out loud.
- **`siteEdit` ENDS EACH POST ONCE — the add-on's `tell`, for the edit.** The
  finish it hands on drops anything after the first call, carried by the finish
  rather than a flag its catch reads, because a hop and a queued watch are
  handed it and end the chain from their own code. **Per POST, not per ask**: a
  resumed watch takes no ask, and its hop's catch is reached only by the POST's
  own ending — a probe applying the ending to a customer's ask alone survived
  everything until a resumed-hop case was written.
- **TWO WALLS, DELIBERATELY, AND THE PROBES SAID WHERE THE SECOND IS THE ONLY
  ONE.** On a customer's message `applyEditResult`'s `told` and the POST's
  ending both drop a second sentence, so three probes on `told` SURVIVED the
  first run. The chain where `told` is the only wall is a watch resumed after a
  refresh (the page's own finish, no POST around it); a resumed success whose
  redraw throws after its sentence kills all three. Said in the code.
- **WHAT THE CUSTOMER SEES**: the owner's case says the known-result sentence,
  the page frees, and the next message posts its edit; a success whose redraw
  fails says its own sentence once; and a late completion leaves the newer
  message's busy flag, rail and latch alone, so a third press sends NOTHING —
  it used to pay its routing call and meet the latch. **No paid request is
  started by any of it**, asserted as every request line in every case.
- **KEPT**: the readers byte-identical; the latch; the duplicate-send controls
  and the latch-alone case; the add-on's own known-result sentence on an edit
  handed to it (a control).
- **`edit-lock`'s OLD/NEW-REQUEST CASE IS RE-ANCHORED, NOT APPEASED.** It
  recorded the second finish — `[LOOK, UNREAD]`, the busy flag lowered, the
  third press routed — and now asserts message 1 ends once and message 2 keeps
  its busy flag. Its message 2 is started through the page's own `siteSend`
  rather than a stand-in finish, so the flag it asserts is the page's.
- **FOUND, NOT CHANGED**:
  - a QUEUED refusal (any non-success sentence the watcher reads) whose redraw
    throws after its sentence still escapes the watcher as an unhandled
    rejection — one sentence, the page freed, the latch released. The add-on's
    queued refusal is recorded as the same; the watcher does not catch its
    reader.
  - the add-on's known-result sentence is not guarded against its own redraw
    failing (straight back, `told` drops the catch's second sentence; queued,
    it escapes with the state correct).
  - both appliers refresh the credit balance FIRST, so a throw there skips the
    preview bump, the picker update and the undo record: the customer is told
    the change went through and the preview may show the old bundle until the
    next bump. The add-on's order is kept, as asked.
  - the not-knowing sentence's "Check the preview", recorded before
    (reworded 2026-09-25, `a3efddef`, merged and deployed in deploy 2160).
- **EVIDENCE.** `test/edit-result-display.test.mjs`, **23 cases**: a success
  whose application throws before its sentence (queued — the owner's —
  straight back, a hop, a hop's queued answer, a resumed watch); a success
  whose redraw throws after its sentence (straight back, queued, a hop, a
  resumed watch); both at once (straight back, queued); a newer message started
  in the old one's redraw (a success straight back, queued, and a refusal);
  every other sentence whose redraw throws (a refusal, an unreadable answer, a
  sign-out, a hop's refusal, a resumed watch's hop refusal); two controls; a
  second press while the job runs; and the wording. Every one sends a second
  message through the same page and asserts every request, what was said, the
  final busy, latch and rail state, and that nothing reached the event loop (a
  file-wide `unhandledRejection` recorder). **Red 20 of 23 on `ce27b5bb`** (a
  throwaway worktree, `editShownMsg` appended so the harness loads): the
  straight-back cases on the sentence, the queued ones first on the escaped
  rejection — node's runner attributes it to the running case, and the scratch
  reproduction shows the same queued shapes stuck at the state level (no reply,
  busy, latched, the next message sending nothing); the 3 green are the two
  controls and the wording. Plus `edit-lock`'s re-anchored case (red on the old
  code: `[LOOK, UNREAD]`) and one `edit-browser-reply` case — a reply whose
  composer throws is drawn as the known result by the canary's own reader (red
  on the old code: the reader threw) — with `editShownMsg` on
  `EDIT_BROWSER_FNS`, since `editAnswer`'s own calls cannot reach it and the
  census does not see it. Three harnesses cut the new sentence. **Targeted
  probes, not a sweep: 12 killed, 0 survived, 0 never applied, the comment-only
  control surviving**, over `chat.js` and `scripts/addon-sweep.mjs` against the
  27 files that load the edit path (spec in the scratchpad): the catch
  rethrowing, speaking after its sentence, `told` never set or set after the
  page's finish, the known result said as not knowing, its finish unguarded, the
  POST's ending dropping nothing, missing, applied to an ask alone or set after
  the finish, the sentence reworded, and the harness list; the new file alone
  kills 11 (the list is the other file's). Both files byte-identical to their
  backups afterwards (sha256 `974b455ab0135e1d`, `38ccd24bb90cb4dc`). The 27
  files: **972 / 972**. **Suite 7,668 locally, taken twice** (`# tests 7668 /
  # pass 7666 / # fail 0 / # skipped 2`, `duration_ms` 125,370 and then 126,780
  on the committed tree) — **+24 against 7,644**: the 23 new cases and the
  harness case. **AND CI MATCHES**: unit run **`36079630725` on `86e8893f`**
  reads **`# tests 7668 / # pass 7664 / # fail 0 / # skipped 4`**
  (`duration_ms 121,589`) — the total is what matches, `pass` differing by
  CI's four skips against the two local ones — with all 23 of the file's cases
  (`ok 2221`–`2243`), the re-anchored `edit-lock` case (`ok 1817`) and the
  `edit-browser-reply` case (`ok 1702`) found passing BY NAME in the downloaded
  log archive, 7,668 distinct result numbers with no gap and zero `not ok N -`;
  the job read by its own top-level fields (`completed`, `success`, 00:56:23Z).
  **The stamp chain ends at `86e8893f`.** No `site build` fires: none of the
  commit's nine files is on its `paths`, checked with GitHub's own glob rule
  and the matcher proved alive on `worker.js` first. **Rendered in the real app in a real
  Chromium**, before (`ce27b5bb`) and after, the owner's case typed and sent:
  before, "Thinking" for good with the stop button drawn, the second message
  never sent, and the page's own uncaught rejection; after, the known-result
  sentence, the send button back, and the second message answered. **Every
  answer is SUPPLIED**: this proves what the browser says and holds, never how
  often a real route answers these shapes.

