# Whole-router audit (2026-10-02)

**Free analysis and focused free checks only.** Nothing was spent, sent to a
model, merged, deployed or changed on any site, and no container was built.
The code was read on `main` at `f9979497` (deploy 2179, image
`a4409e55d3f3eb09`, runtime-confirmed by runs 91 and 92); the branch has
changed only documents since. Every line reference below is to that code.
Live readings were taken the same morning from the served pages and sitemaps
(07:20–07:53 UTC), from run 92's stored bakery pages, and from Supabase
(read-only: who owns each site, whether it has a database). Started after
Test 12's closure (runs 91 and 92), on the owner's word.

**The owner's order (2026-10-02):** *"start the separate whole-router audit.
Trace the complete flow from the browser's request and context through the
main router, every internal model picker, response reader, normalizer,
fallback, escalation and handoff across build, edit and add-on. Find intent
decisions made through keywords, regexes, site-specific exceptions or
overrides of the model's answer; distinguish those from legitimate
validation, permissions and capability dispatch. Check conflicting
instructions, missing context, lost or deferred request parts, wrong page
scope, mixed requests, removals, ambiguous follow-ups, undo, attachments and
unsupported requests. Use the current site state and existing evidence;
don't repeat the completed batch."*

The earlier router audit (`docs/investigations/router-audit.md`, R1–R14) is
not repeated here; §3.12 says where each of its items stands now.

**Batch 1 of the fixes (later on 2026-10-02, on the owner's word):** *"Fix
W1–W4 together first, including W3's conflicting rewrite/deletion contract
… Keep this universal: no customer-word regexes, keyword lists, site
exceptions or test-specific patches … Finish the eight response/fallback
branches currently marked "not traced," and update the audit to distinguish
confirmed code defects from conditional risks and untested model behavior.
Keep the other findings tracked for the following batches."* **W1–W4 are
fixed on the branch `claude/help-needed-ehlwlj`, not merged and not
deployed**; each finding below says what changed and what it does not cover.
The eight replies §1.6 left untraced are traced there. Every finding is now
classed (§3.0), and the risks the fixes left or uncovered are listed beside
them. Nothing was spent, no model was called, nothing was changed on a site,
and no container was built. Line numbers in the findings are still those of
`f9979497` unless a finding says otherwise.

**Batch 2 (later the same day, on the owner's word):** *"Start the next
grouped fix for W5, W7, W8, W15 and W24: preserve every part of a mixed
request across routing conversions, failures, edit/add-on handoffs and
escalation to a full rewrite … Use a consistent handoff contract across these
paths, with models deciding intent and code validating and dispatching—no
keyword rules or site-specific exceptions … Keep deployment and paid runs
pending so we can combine the deployment and prepare one grouped
live-validation batch with a cost estimate."* **W5, W7, W8, W15 and W24 are
fixed on the branch, not merged and not deployed**, through one hand-over
contract (`builder/hand-over.mjs`): the parts put off, the scope and the
reason travel together wherever work moves, and every ending names the parts
put off. Each finding below says what changed and what it does not cover; the
checks are §4.3, the grouped live plan with its cost is §5.4, and the record
is `docs/history/2026-10-02-router-batch-2.md`. Nothing was spent, no model
was called, nothing was changed on a site, and no container was built.

**Your review of batch 2 (the same day):** *"Finish the batch 2 handoff fixes
before deployment: persist every deferred part through background rewrite
storage, resume, retries, and final success/failure replies so the browser
still reports it; replace additionOp's first-match handling so multiple
scoped additions in the same lane are all preserved; and ensure newly
deferred instructions are excluded from every executing step's model input,
including overlapping scope words and removal-door steps that fall back to
eRun … Keep deployment and paid live testing pending so we can validate the
reviewed batches together."* **The three gaps are fixed on the branch
(`129a1757`), for review, not merged or deployed**: the parts put off ride
the background rewrite's record to every final answer and the screen; every
scoped addition in a lane is put off; and once the plan is built, every part
put off is taken out of each step's own words and of the message a step
falls back to, before any step runs. Each finding (W7, W8, W15) says what
changed under *After your review*; the checks are §4.4, the limits N22–N27
(§3.0), and the record is the history's §7. Nothing was spent, no model was
called, nothing was changed on a site, and no container was built.

**Questions back on a site that exists (later the same day, on the owner's
word):** *"Implement model-driven clarification for existing-site edit and
add-on requests only; preserve current first-build behavior. Let the router
ask a targeted question when missing information materially affects which
path, target, or operation to choose, instead of converting clarification
into add-on work. Let edit and add-on steps request clarification too when
they discover missing details after routing … preserve the original request,
attachments, scope, deferred parts, and completed work across the answer and
page refresh … support cancellation and a changed request, and prevent stale
answers from triggering work … intent and questions must come from the model
without customer-keyword or site-specific hardcoding … Keep deployment and
paid testing pending so we can combine the approved changes."* **Done on the
branch (`4d2f10ed`), for review, not merged or deployed** (W27): a live
site's router may ask, and the question is kept as the site's one live
question instead of being turned into paid add-on work; the edit and add-on
steps may ask after routing; an answer resumes the waiting request with the
answer in it, its question count and the parts it put off; a changed request,
a cancel and a stale answer each start nothing. The contract is §3.13, the
checks §4.5, the limits N28–N40 (§3.0), and the record
`docs/history/2026-10-02-live-clarify.md`. Nothing was spent, no model was
called, nothing was changed on a site, and no container was built.

## In short

- **Where it stands after batch 1.** W1–W4 are fixed on the branch, with
  route-level tests, red checks on the unfixed code and mutation sweeps
  (§4); not merged, not deployed, and no live check has run (Group D's
  D1–D4 wait for your merge and deploy). W5–W26 stood after it, each
  classed in §3.0; batch 2 has since fixed five of them (the next point).
  **The three gaps your
  review found are fixed on the branch too** (§4.2): menu moves of several
  items (W4), removals that name their entries, checked by code, with no
  one-entry shortcut (W2, N1 resolved), and the last "opposite" sentence in
  the page writer's prompts (W3); three findings from that work are
  recorded apart (N11–N13). **Those fixes passed your review**
  (2026-10-02); their live-model confirmation stays pending, for one
  grouped live batch after a combined deploy.
- **Where it stands after batch 2.** W5, W7, W8, W15 and W24 are fixed on
  the branch, for review, not merged or deployed: one hand-over contract
  carries the parts put off, the scope and the reason wherever work moves,
  and every ending names the parts put off, on the server and on screen
  (§3.2, §3.9, §4.3). Shown with supplied answers only: 47 new cases, 35 of
  them red on `ef158022`. **Your review's three gaps are fixed too** (§4.4):
  the background rewrite keeps and names the parts put off through its
  record, retries and final answers; every scoped addition in a lane is
  kept; and no step that runs is handed words put off, its own or the
  message it falls back to. 26 more cases, 25 red on `03189a0d`.
  **The grouped live-validation batch** (§5.4), run after one combined
  deploy of batches 1 and 2, is Group R, D1–D3 and four batch-2 checks:
  about 35–59 credits against a balance of 137 (read at 12:53 and again at
  13:02 UTC).
- **Who decides.** One model call (the router) decides every message on a
  live site, and smaller model calls then decide inside each step. Code
  around them mostly validates, checks permission or money, or sends work to
  the step that can do it. I found **no regex or word list on the customer's
  message in the browser, the route, the router's readers, the edit route's
  dispatch or the add-on route.**
- **Where code does decide intent** (each is a finding):
  - **one keyword grammar**: the page writer's text guard reads the
    customer's verbs to decide whether text loss was asked for (W9). The same
    removal publishes for "Remove …" and is refused for "Get rid of …",
    "Drop …" or "Lose …" (free check). It is refuse-only and was built on
    purpose, but it runs after a model has already confirmed the request;
  - **one override that costs money**: a question sent with a file becomes
    a paid add-on (W17);
  - **converters to a paid add-on**: an unusable or unplaceable edit answer
    becomes `addon` (R3, R4). Since deploy 2178 the reply says so, but the
    conversion also swaps the halves of a mixed message (W5; fixed on the
    branch in batch 2: a missing page's removal or move stays an edit, and
    a conversion carries its page and reason);
  - **one money rule**: at a zero balance every message on a live site is
    answered `build` without asking the model (W22).
- **Site- and account-specific text and switches**: the model prompts carry
  wording taken from the test sites and from run 90's and 92's own test
  sentences (W23); two build switches default to the building account
  (owner-directed, §3.11), so build evidence from that account is not the
  customer's path.
- **26 confirmed findings** (W1–W26), each shown by the code, a free check
  or a past run (§3). The most serious, in plain words:
  1. **A photo removal can delete a page** (W1): when the photo step hands
     the job on, the browser forwards the router's "remove" flag to the page
     step, which deletes a page with no model call.
  2. **Removing one language or one QR code removes all of them** (W2).
     `fretwork-1` today has French and Spanish versions and two QR codes.
  3. **The full rewrite is told opposite things about pages it leaves out**
     (W3), and the code deletes every page it doesn't return.
  4. **A menu edit writes one menu to every page** (W4), flattening menus
     that differ per page, as the bakery's and `repairbench-1`'s do today.
  5. **A converted edit swaps the halves of a mixed message** (W5): the
     add-on runs the part it cannot do and holds back the part it can.
     *Fixed on the branch in batch 2.*
  6. **Parts of a message are lost without a word** (W7, W8, W15): the
     held-back part is mentioned only on success, a climb to the full
     rewrite runs it anyway, and the look step's hand-over drops its own
     changes. *Fixed on the branch in batch 2, with W24.*
- **Untested behaviour** (§3.10): what the real models answer for these
  cases, and what several steps then do. Each is marked *unverified* until a
  run measures it.
- **The matrix (§5)**: **Group R**, 20 routing-only probes on seven sites
  (none on the bakery), committed as `scripts/router-probes/whole-router-1.json`
  and ready for one press: **about 22–32 credits** (measured 1–1.5 a call
  in runs 90 and 91), with a balance floor of 60 that the press checks
  itself. **Group D**, ten delivered checks, listed with estimates; the four
  that would damage a site today (W1, W2, W4) wait for their fixes. Nothing
  is spent until you approve.

## The plan, in plain language

1. **Follow one message the way the product does.** What the browser sends,
   what the router is shown and answers, what code does with that answer,
   which step runs, which smaller models that step asks, how their answers
   are read, what happens when an answer can't be used, and every place work
   is handed from one step to another. Builds, edits and add-ons each get
   the same walk.
2. **At every decision, ask who made it**: a model, or code. When code
   decides, it is one of three legitimate things:
   - checking that an answer is well-formed (validation);
   - checking permission, money or safety;
   - sending the work to the step that can do it (capability dispatch).

   Or it is a finding:
   - deciding what the customer meant from their words (a keyword or a
     pattern);
   - a special case for one site, fixture or account;
   - overruling the model's answer.
3. **Walk the owner's scenario list across all three paths**: conflicting
   instructions, missing context, parts of a message lost or put off, the
   wrong page, mixed requests, removals, follow-ups that refer back, undo,
   attachments, and requests nothing can do.
4. **Confirm what can be confirmed for free.** Read the code, and where it
   matters, drive the real code with supplied answers (no model, no money).
   Read the live sites, without changing them, so every probe starts from a
   known state.
5. **Label every finding honestly**:
   - *confirmed defect*: shown by the code, a free check or a past run;
   - *untested*: it depends on what a real model answers, or on a step
     nothing has exercised;
   - *legitimate*: validation, permission or dispatch, recorded so nobody
     mistakes it for a defect.
6. **Prepare one grouped real-model matrix** for what only a real model can
   settle, across varied wording and different kinds of site, with a cost
   estimate. Nothing is spent until you approve it.

## 1. How a message travels

### 1.1 In the browser (`public/chat.js`, `public/edit-poll.js`)

- **What the router is sent** (`chat.js` 9074–9079, 9117): the message, the
  site's name and address, **up to 24 page addresses and 24 table names**,
  the chosen model, whether this is a first build, the brief and answers of
  a first build's question round, whether the message answers a question
  card, **whether a file is attached** (a yes/no only), the slug and whether
  a site exists. No earlier message, no attachment content, nothing about
  what any page shows.
- **But the page list is shorter than it looks** (W6). The browser stores at
  most six pages per site (`sitesSave`, 4565) and never refreshes a stored
  list of two or more from the server (`siteRoutesApply`, 4792). After a
  reload, a site with seven or more pages sends six addresses.
- **What it does with the answer** (9128–9162):
  - `ask`: shows the answer, nothing else (cost: the routing call);
  - `clarify`: a question card (first builds only);
  - `edit`: posts to `/api/site/<slug>/edit` (`siteEdit`, 9253–9365) with
    the step (`layer`), the page, `remove`, `tab`, `rename`, the held-back
    part, the data step's last deleted rows (`recent`, data only, 9356) and
    the files (**logo step only**, 9363);
  - `addon`: posts to `/api/site/<slug>/addon` (`siteAddon`, 10014–10021)
    with the message, the model, a request key, the time zone and the
    held-back part — **no files, no reason, no deleted rows**;
  - `build`: the full rewrite (`go()`, 9047–9051 → `reactSend` 'revise';
    body `{ slug, instruction, images, picker }`, 11471–11472).
- **When a step hands the job on** (`EditPoll.escalateAction`,
  `edit-poll.js` 486–507): the server's escalation names a class (from
  `builder/edit-failure.mjs`): `hop` to another step (once), `addon`, `up`
  to the full rewrite, or `explain` (a sentence, nothing charged for the
  edit). A hop re-posts **the router's first answer with the new step
  written over it** (`{ ...(o.d || {}), layer, page }`, 9723) — W1. An
  add-on handed back to the menu editor is marked `fromAddon` so it cannot
  loop.
- **What the customer is told** comes from what the route reports
  (`editReply`, `addonReplyText`), plus the held-back part's sentence
  (`alsoTail`) — **on success only** (9639, 10245; W7).

### 1.2 The route and the main router (`worker.js` 19949–20166, `builder/site-ask.mjs`)

- **Before the model**: a readable zero balance answers `build` with no model
  call (19980–19988; W22). The site's own table names are filled in when the
  browser sent none (Lane 1d, `routeDigest`). Pages are never filled in.
- **The model call**: `route_message` (`site-ask.mjs` 201) with the system
  text (857–903) and one user message holding the digest and the message
  (`askRequest`, 911). It answers `ask`, `clarify`, `build`, `edit` (one of
  nine steps: `data`, `text`, `look`, `page`, `rules`, `picture`, `logo`,
  `nav`, `rename`) or `addon`, and can name a page, `remove`, `tab`,
  `rename`, and a held-back part (`alsoAsked`).
- **The readers** (`readRouting` 1126–1256, `readEdit` 1452–1535,
  `readAlso` 1316): an answer that can't be used becomes the fallback —
  `addon` on a live site, `build` with no site. `clarify` is honoured only
  on a first build (on the branch since W27, a live site's router may ask
  too, with its own budget and a kept question: §3.13); an `ask` while
  answering a question card or with a file
  attached becomes the fallback (1250–1253). `remove` and `tab` are kept
  only on the steps that take them; a page is kept only on `look` and
  `page` (1510–1527); a `page` answer naming no page, or a page not in the
  list sent, becomes `addon`, **whatever `remove` says** (1524–1531). The
  route's reply carries a decision report (deploy 2178): `model`,
  `fallback` or `rule`, with fixed reason codes.

### 1.3 Build and the full rewrite (`worker.js` 14659 `runSiteBuild`, 20410)

- A first build: the design call (`design_schema`, `worker.js` 2841; on the
  building account split into waves, §3.11), a database only when tables are
  declared, the page writer (`write_pages`, `page-gen.mjs` 1643; on the
  building account split into bands, `write_band`/`write_part`), compile,
  render check, publish. Links in the brief are read and the web searched
  here only (`web_search`, `worker.js` 4559).
- **The full rewrite (revise)** runs the same writer over every page with
  the site's own source shown. It is reached three ways on a live site: a
  `build` answer (honoured to "scrap this site", `readRouting` 1199), any
  edit escalation classed `up`, and the zero-balance rule (refused at the
  rewrite's own credit gate, W22). **No step asks the customer to confirm a
  rewrite.** W3 and W8 are about this path.

### 1.4 Edit (`worker.js` ~20879–25663)

- The step named by the router runs. Its own model calls:
  - `text`: `write_text_edits` (`site-apply.mjs` 108) picks wording by id
    and gives the new words; the reader drops a replacement with a straight
    quote or apostrophe (W21);
  - `data`: `write_row_changes` (448) on a stored list;
  - `rules`: `write_table_rules` (`site-rules.mjs` 86);
  - `look` (the look door): `pick_lanes` (`site-lanes.mjs` 1075) picks up to
    four lanes, each lane a small `edit_site` call (1758), and removals are
    written by code with no call (W2, W20); section and layout lanes reach
    the page writer (`write_tweak`, `site-tweak.mjs` 104), whose result
    passes the keep check (`keep_check`, `page-keep.mjs` 391, a model with
    its quotes checked against the message) and then the text guard
    (`page-prose.mjs`, W9);
  - `picture`: `choose_pictures` (`site-picture.mjs` 732); on the removal and
    picture doors a second `pick_lanes` (1276) asks whether anything else was
    asked for;
  - `nav`: `write_nav` (`site-nav.mjs` 414), applied to every page as one
    list (W4);
  - `page`: removal and move are code only (`mergeAddonPages`, never the home
    page, never a page another links to, 24009); other page edits use
    `write_tweak`;
  - `logo`: no model for a removal; the attached file for a new logo;
  - `rename`: `new_address` (`site-alias.mjs` 239).
- Translations are written at publish (`write_translation`,
  `site-translate.mjs` 69) for the languages the site offers.
- **When a step can't do it**, it answers with a class from
  `edit-failure.mjs`: `explain`, `hop` (for example a photo with no frame
  goes to the page step: `picture/needs-place`, 112–113), `addon`, or `up`.

### 1.5 Add-on (`worker.js` 25665–29655, `builder/site-add.mjs`)

- The held-back part is taken out first (`heldBack`, 25739).
- `pick_adds` (`site-add.mjs` 1382) names the kinds: at least one
  (`minItems: 1`, "name the single closest one", 1388–1402; W14).
- One `add_to_site` designer call per kind (1565), each told "IF THEIR
  MESSAGE IS NOT ABOUT THIS KIND OF THING, ANSWER NOTHING" (1615). A new
  entry is the designer's row, written by the shared insert; a new table's
  missing starter rows come from `write_rows` (`site-seed.mjs` 117, also used
  by builds); a page kind uses the page writer.
- Hand-overs: a lone frame item (menu link, footer link, header button) goes
  to the menu editor as an addition (`ADD_HOPS`, `site-addon.mjs` 51–52);
  the add-on climbs to the full rewrite only when the site's source is
  missing and a reconstruction is allowed (48–49). Every decline ends in a
  refusal at no cost for the add-on: "I couldn't work out what to add from
  that — say what you want on the site and where." (3481).

### 1.6 Every model call, and who reads its answer

| Call | Defined | Asked by | Decides | When its answer can't be used |
|---|---|---|---|---|
| `route_message` | `site-ask.mjs` 201 | the route | ask / edit + step / addon / build | `addon` on a live site, `build` with none (reported since 2178) |
| `pick_lanes` | `site-lanes.mjs` 1075, 1276 | look door; picture and removal doors | which lanes, their words, removals | look: explained (`picker/no-lane`); a door the router opened: the router's step runs alone |
| `edit_site` | `site-lanes.mjs` 1758 | each look lane | that lane's field | that lane changes nothing |
| `write_text_edits` | `site-apply.mjs` 108 | text | which words, the new words | no usable edit → "I couldn't find that wording" (`text/no-match`) |
| `write_row_changes` | `site-apply.mjs` 448 | data | which row, column, value | no matching row → refunded (run 77) |
| `write_table_rules` | `site-rules.mjs` 86 | rules | a table's rules | a failed call: "I couldn't reach the model that sets that rule", nothing charged; no usable rule (no tool call, an unknown table, a level not offered): `rules/no-match`, "Nothing there was a rule I could change." or "I couldn't make that change." with each refusal's reason; a schema write that fails: "That change couldn't be saved — try again." (traced in batch 1) |
| `choose_pictures` | `site-picture.mjs` 732 | picture | which photo, which frame | no frame on the named page → hop to the page step (`needs-place`) |
| `write_nav` | `site-nav.mjs` 414 | nav | the menu, the button, the footer | no menu, button or link on any page: `nav/no-nav`, explained before any call; a failed call: "I couldn't reach the model that sets the menu", nothing charged; nothing usable: "I couldn't work out what the menu should be…"; nothing changed: "That's already the menu — nothing to change."; an item for a page the site lacks is left out and named, the rest applies (traced in batch 1) |
| `write_tweak` | `site-tweak.mjs` 104 | page; look's section and layout lanes | one page's new source | the keep check, then the text guard |
| `keep_check` | `page-keep.mjs` 391 | the page writer's result | whether each lost item was asked for, with a quote | withheld |
| `new_address` | `site-alias.mjs` 239 | rename | the new address | a failed call: "The editor is busy", nothing charged; no name, or a malformed one: "Tell me what you would like the address to be…"; the current name, a reserved one, a taken one or a lookup that could not be made: refused, each with its own sentence (traced in batch 1) |
| `pick_adds` | `site-add.mjs` 1382 | add-on | which kinds (at least one) | a failed call: "The builder is busy", nothing charged for the add-on; no kind it offers in the answer: `no-add`, "I couldn't determine a supported addition from that message…", the picker's own call not billed (routing was) (traced in batch 1) |
| `add_to_site` | `site-add.mjs` 1565 | add-on, once per kind | the addition | every kind declined → a refusal, no charge for the add-on |
| `write_rows` | `site-seed.mjs` 117 | builds; the add-on, for a new table | starter rows a table lacks | no rows (the list stays empty) |
| `design_schema` | `worker.js` 2841 | build, rewrite | the design | a failed, timed-out or truncated call: the deposit is reversed and the build stops with "The designer is busy", the timeout sentence, "temporarily unavailable" or "needs more room"; no tables where the build needs one: "That brief didn't describe anything to store…", deposit refunded (a first build and a rewrite may declare none) (traced in batch 1) |
| `write_pages` | `page-gen.mjs` 1643 | build, rewrite, the add-on's page kind | pages | a page that doesn't compile is refused |
| `write_band` / `write_part` | `page-bands.mjs` 286, 445 | build and rewrite (split, the building account) | page parts | every band empty: refused like an empty `write_pages`; **some** bands empty: each becomes an empty section and the page publishes without it, recorded on the trace (`wrote < bands`) and **not said** (N7); a part with no answer is a stub that renders nothing (traced in batch 1) |
| `write_translation` | `site-translate.mjs` 69 | publish | translated copy | never throws: a failed call, a missing key or a wrong-length answer publishes the language with what is cached and the site's own words for anything new; traced (`translate:<tag>`), **not said** (N8) (traced in batch 1) |
| `web_search` | `worker.js` 4559 | build | current facts | never throws: a failed or unreadable answer ends the search with what it found, possibly nothing; the build goes on without researched facts, the tokens and searches spent are billed, and nothing tells the customer research ran (traced in batch 1) |

None of these replies decides between steps. Every edit step's refusal
reports what it cost; on the queued path, the one the product uses, a reply
that did not ship is refunded (`edit_refund`, `worker.js` ~13697); on the
synchronous path the model call's debit stands and the reply says so (N9).

## 2. Who decides: every code decision about intent

| Where | What it decides | Class | Verdict |
|---|---|---|---|
| `chat.js` 9117 | `attached` is true when the strip holds anything | validation (a fact) | legitimate, but counts files the browser could not read (W17) |
| `chat.js` 9128–9162 | the answer's intent picks the route | dispatch | legitimate |
| `chat.js` 9723 | a hop re-posts the first answer with a new step | dispatch | **defect**: carries `remove` (W1) |
| `edit-poll.js` 486–507 | hop / addon / up / stop from the server's class | dispatch | legitimate (loop guard included) |
| `chat.js` 10077–10100 | add-on hop to the menu editor; climb only on reconstruction | dispatch | legitimate |
| `chat.js` 4565, 4792 | which pages the browser keeps and refreshes | state | **defect** (W6) |
| `worker.js` 19980–19988 | zero balance → `build`, no model | money rule over intent | **defect** in its outcome (W22) |
| `site-ask.mjs` 1155 | `clarify` only on a first build | permission | legitimate then; **superseded on the branch** (W27, §3.13): a live site's router may ask, with its own budget and a kept question |
| `site-ask.mjs` 1250–1253 | `ask` + answering a card, or + a file → fallback | **override** | answering a card: defensible (the message is an instruction); a file: **defect** (W17) |
| `site-ask.mjs` 1455–1531 | unusable layer / no page / unknown page → `addon` | validation, converting to paid work | reported since 2178; **defect** in outcome (W5, R4) |
| `site-ask.mjs` 1474–1527 | `remove`/`tab`/page kept only where a step takes them | validation | legitimate; drops a named page on `text` (W12) |
| `site-ask.mjs` 1316, 1439 | held-back text must be the customer's own words | validation | legitimate |
| `worker.js` 21011 | `remove` read from the request body | trusts the client | **defect** with W1 |
| `worker.js` 21911 | a look lane only the add-on can do → hand to the add-on | dispatch | legitimate, but drops the other lanes (W15) |
| `worker.js` 24009 | page removal: never home, never a linked page | safety | legitimate |
| `page-prose.mjs` 395 `permissions()` | whether the message's wording authorises text loss | **keyword grammar on the message** (refuse-only) | **finding** (W9) |
| `page-keep.mjs` 268 | a model's quote must occur in the message | validation of a model's evidence | legitimate |
| `site-apply.mjs` 304, `site-text.mjs` 179 | no quotes or braces in replacement words | output safety | legitimate aim, **defect** in effect (W21) |
| `worker.js` 10104 `ADD_EVIDENCE` | patterns over page source, not the message | state | legitimate |
| `site-add.mjs` 1382–1402 | at least one kind | schema | **defect** in outcome (W14) |
| `site-addon.mjs` 48–52 | frame → menu editor; climb only on reconstruction | dispatch | legitimate |
| `worker.js` 26439–26441 | a new row beside a hand-over is refused | validation | legitimate (wording W25) |
| QR scheme allow-list, validators, page guards, `additionOnly` | safety and shape | permission / validation | legitimate |
| `deploy.yml` 464, 482 | split design and bands for one account | **account-specific switch** | owner-directed (§3.11); an evidence caveat |
| `deploy.yml` 437 | the job runner for `fretwork-1` by default | site-specific switch | owner-directed; not about intent |
| prompt text (W23) | examples drawn from the test sites and test sentences | **site-specific text** | **finding** |

How the scan was done: every `.test(`, `.match(`, `includes(` and word list
in `public/chat.js`, `public/edit-poll.js`, the route and readers in
`builder/site-ask.mjs`, the edit route's dispatch and the add-on route in
`worker.js`, `builder/site-add.mjs`, `builder/site-addon.mjs` and
`builder/site-lanes.mjs` was read for what it is applied to. Only the page
writer's text guard applies one to the customer's message to decide intent;
the keep check's quote test validates a model's evidence; the rest apply to
source, model output or configuration.

## 3. Findings

Each finding gives where it is, what should happen, what does happen, the
evidence, the impact and a proposed fix. **Status** is one of: *confirmed
(code)*, *confirmed (free check)*, *confirmed (run N)*, *untested*.
Predicted consequences further down the pipeline are marked *unverified*.

### 3.0 Each finding, classed (batch 1)

Three classes, so a confirmed defect is never read as a risk or a guess:

- **Confirmed code defect**: the code does the wrong thing for an input the
  product meets today (an everyday message, a live site's shape), shown by a
  free check, a past run, or code with no other path. No model has to answer
  anything unusual for it to happen.
- **Conditional risk**: the code is wrong only under a condition not shown
  to occur today: a site shape no live site has, a failure (an unreadable
  store, a provider error), a client the product doesn't have, or a path only
  the building account takes.
- **Untested model behaviour**: the outcome turns on what a model answers,
  and no run has measured it. Where an instruction is confirmed wrong but its
  effect needs a model, it is here, with the instruction named as confirmed.

| # | Class | What is confirmed | What still rests on a model or a condition | Status |
|---|---|---|---|---|
| W1 | Confirmed code defect | a hand-over carried `remove`; the page step deleted with no model call (free check) | how often the photo step answers `needs-place` for a removal (U7) | **fixed on the branch** |
| W2 | Confirmed code defect | one removal emptied the whole list (free check; `fretwork-1` has two of each) | what a real model names as the entries to take off (Group D) | **fixed on the branch**; your review's gaps fixed too (§3.1, §4.2) and passed your review (2026-10-02); live-model confirmation pending |
| W3 | Confirmed code defect | two opposite rules in one request; the publish kept only returned pages | how often a writer leaves pages out (U6) — harmless after the fix | **fixed on the branch**; the last "opposite" sentence removed after your review (§3.1, §4.2), which that review passed (2026-10-02); live-model confirmation pending |
| W4 | Confirmed code defect | one menu written everywhere (free check on run 92's pages) | — | **fixed on the branch**; multi-item moves fixed after your review (§3.3, §4.2), which that review passed (2026-10-02); live-model confirmation pending |
| W5 | Confirmed code defect | a converted answer swaps the halves (free check) | the trigger: a router answer naming a page the browser didn't send | **fixed on the branch** (batch 2, §3.2, §4.3), pending your review |
| W6 | Conditional risk | six pages sent after a reload (code) | a site of seven or more pages; no live site has more than five | open |
| W7 | Confirmed code defect | the held-back part is named on success only (code) | — | **fixed on the branch** (batch 2, §3.2, §4.3); your review's gap (the background rewrite's final answers) fixed too (§4.4), pending your review |
| W8 | Confirmed code defect | a climb runs the held-back part (code) | — | **fixed on the branch** (batch 2, §3.2, §4.3); your review's gap (the parts through the resume record and retries) fixed too (§4.4), pending your review |
| W9 | Confirmed code defect | five of eight wordings withheld (free check) | — (built on purpose; your call) | open |
| W10 | Untested model behaviour | the instruction calls translation a rewrite (code) | what the router answers (probe CF1) | open |
| W11 | Untested model behaviour | five instructions disagree (code) | which answer the model picks (CF2, AT2) | open |
| W12 | Untested model behaviour | a `text` answer drops the page (code) | whether the text step keeps to the page (PS1) | open |
| W13 | Confirmed code defect | one intent per answer; `answer` shown for `ask` only (code) | — | open |
| W14 | Confirmed code defect | the picker must name a kind; the refusal says "say it differently" (code) | whether an unsupported ask reaches the add-on (US1) | open |
| W15 | Confirmed code defect | the look step hands over before any lane runs (code) | the trigger: a picker answer naming an addition beside look work | **fixed on the branch** (batch 2, §3.2, §4.3); your review's gaps (every scoped addition kept; put-off words reaching no step that runs) fixed too (§4.4), pending your review |
| W16 | Confirmed code defect | files reach the logo step and builds only (code) | what the photo step does without the file (D9) | open |
| W17 | Confirmed code defect | `ask` with a file becomes `addon` in the reader (code) | — | open |
| W18 | Confirmed code defect | the replies promise follow-ups (code) | what each follow-up then does (D7) | open |
| W19 | Confirmed code defect | the behaviour lane changes nothing a visitor sees (its own comment) | — | open |
| W20 | Confirmed code defect | a `css` removal changes nothing (free check) | — | open |
| W21 | Confirmed code defect | a straight apostrophe is dropped (free check) | — | open |
| W22 | Confirmed code defect | at a zero balance every message is a build (code) | — (a zero balance is a state customers reach) | open |
| W23 | Untested model behaviour | test-site wording in the prompts (code) | how much it steers answers | open |
| W24 | Confirmed code defect | the hand-over to the add-on carries no reason (code) | what the add-on then designs | **fixed on the branch** (batch 2, §3.9, §4.3), pending your review |
| W25 | Confirmed code defect | the refusal names the entry only (code) | — | open |
| W26 | Confirmed (no customer effect) | stale comments (code) | — | open |
| W27 | Policy change (the owner's order) | on a live site the router's question became `addon` (`clarify-closed`), paid add-on work for a request it could not place, and no step could ask (free probe on `a8ed6b73`) | what a real router and real steps ask, and when (N28) | **done on the branch** (§3.13, §4.5), pending your review |

**Risks the fixes left or the traces found (batch 1):**

| # | Class | What | Where it stands |
|---|---|---|---|
| N1 | Conditional risk | a removal the picker marks on a list holding **one** entry still empties it for nothing, even when the customer named an entry the site doesn't have (W2's free path asks no lane) | **resolved after your review** (2026-10-02): no shortcut; every removal on a list asks the model which entries it names, and code checks each name against the list (§3.1 W2). The cost: one small call where a one-entry removal was free |
| N2 | Conditional risk | with no TypeScript parser (an edit run inline in the Worker), a QR removal whose code a page shows is refused (`figure-unchecked`), never guessed | recorded; the container has the parser, as the photo removal already needs |
| N3 | Limit (by design) | a figure whose caption is the page's own words keeps the caption: only the code's own element comes off | recorded |
| N4 | Conditional risk | the footer's two lists (`social`, small print) on an ordinary edit still write one list into every page (`applyChromeList`), W4's shape one place over | tracked; per-page footer lists not measured on the live sites |
| N5 | Conditional risk (pre-existing) | a menu item pointing at a page the site no longer has is dropped by the reader and so comes off every menu; the reply names it | recorded |
| N6 | Limit (by design) | a hand-over without a page of its own falls back to the ask's page (a scope the destination checks, not an operation) | recorded |
| N7 | Conditional risk | split page writing: a band that answered nothing publishes as an empty section; the trace says so, the reply doesn't (building account only) | tracked |
| N8 | Conditional risk | a translation that fails publishes the language behind (new words in the site's own language); traced, not said | tracked |
| N9 | Conditional risk | the edit route's synchronous path keeps a refusal's model charge; the queued path, the one in use, refunds it | recorded |
| N10 | Untested model behaviour | after W3, a rewrite's writer could name in `remove` a page nobody asked to delete; the home page and linked pages are refused, an unlinked page so named goes | tracked; Group R/D can measure it on a rewrite |
| N11 | Conditional risk (pre-existing) | a QR **edit** (a new destination or caption, not a removal) on a site with one code changes that code when the answer names none (`patchQr`'s one-code rule): the list's length again standing in for which code was meant, the edit's counterpart of N1 | tracked (found during the review's gap fixes); not changed in this batch |
| N12 | Confirmed instruction, untested effect | the long-site rewrite (pages over 90,000 characters in all) is shown no page source and told to "write them again in full"; since batch 1 a page not returned is kept, so a page written from its name alone would replace the real one | tracked (found while checking W3's prompts); what a long-site rewrite returns is your call — the add-on's way is to show what fits and name the rest |
| N13 | Confirmed code defect (pre-existing) | the look reply names a list field by its key ("✅ Updated the look — langs.", "— qr.", "— behavior.") and never reads `qrRemoved` or `qrPages`, so which codes came off, and from which pages, is not said | tracked (seen in the gap fixes' screenshots); a word map and a reply change |

**Risks and limits batch 2 leaves** (each deliberate unless marked; the
record's §5):

| # | Class | What | Where it stands |
|---|---|---|---|
| N14 | Limit (by design) | an edit step handed work by another edit step (the photo step's `needs-place` to the page step, say) records the hand-over's reason on its trace, but its picker is not shown it; only the add-on's picker and the rewrite's page writer are shown the line | recorded; the edit steps are told their page and act on it, as since batch 1 |
| N15 | Limit (by design) | the rewrite's designer is not shown the hand-over line, because its description becomes the site's | recorded |
| N16 | Conditional risk | a signed-out reply (401) and a watch that gives up ("Reload…") add no held sentence | recorded; the customer signs in or reloads, and the job's own reply, when it comes, names the parts |
| N17 | Limit (by design) | a readable reply without `deferred` names nothing: the browser trusts the server's account of what it took out, and names what it posted only when no reply can be read | recorded |
| N18 | Limit (by design) | an addition beside other work, on a picker answer with no words for each change, refuses the whole message (`picker/addition-mixed`, nothing charged for the edit) rather than guess which words ask for the addition | recorded |
| N19 | Conditional risk | more than four parts put off (`MAX_HELD`) are refused as unreadable | recorded; the router puts off one part, and a step's net adds one per addition |
| N20 | Conditional risk | a queued add-on swept before its first reply has no stored reply, so the review's settled reply has no parts to name | recorded; the browser names the parts it posted while it watches |
| N21 | Limit (by design) | when the router's answer is unreadable, its held part is dropped (`also-dropped`) and the step it falls to gets the whole message, held part included: the model did not decide, so the add-on's picker does | recorded |

**Risks and limits your review's fixes leave** (the history's §7.5):

| # | Class | What | Where it stands |
|---|---|---|---|
| N22 | Conditional risk | a reload loses the browser's follow of a 202; the poll route names the parts only while the resume record exists (a finished build deletes it, and its stored answer, which names them, is read once), so a later poll's row verdict names nothing | recorded; the follow is the normal path, and the stored answer it reads names them |
| N23 | Limit (by design) | the words between a change and an addition go with the change, so its step can be handed *"Change the description to … and"* | recorded; the words are the customer's own, and none of the addition's |
| N24 | Untested model behaviour | several different additions with nothing else are handed on without a part of the site, and additions on different pages without a page: the add-on step reads the whole message, and whether it makes every one is not shown | recorded; needs a real add-on picker |
| N25 | Limit (by design) | a lane named with no valid scope counts as other work (it is withheld with its own sentence), so an addition beside it is put off rather than handed on whole, and with nothing else of the message left the whole message is refused | recorded |
| N26 | Limit (by design), narrowing N17 | a followed build's final answer without `deferred` now names the 202's parts; a direct answer without one still names nothing | recorded |
| N27 | Equivalent mutant, kept | `!op.invalid` beside `op.words` in `scopedOps` changes nothing today, because `readScopes` blanks an invalid scope's words (its own test pins that); the guard stays against that layer moving | recorded |

**Limits the clarification round leaves** (W27; the history's §7; each
deliberate unless marked):

| # | Class | What | Where it stands |
|---|---|---|---|
| N28 | Untested model behaviour | whether a real router asks a good question when a detail matters, and acts directly when it doesn't; the same for each step | recorded; needs a real router and real steps |
| N29 | Limit (by design) | any message that names no question closes the live one as replaced, including a side question asked in another tab | recorded; the router decides whether a reply that names it answers it |
| N30 | Limit (by design) | the answer and the request it resumes share 2,000 characters; a longer pair is refused at no cost, with the question kept | recorded |
| N31 | Limit (by design) | past two questions per request a question is shown as words with nothing waiting | recorded |
| N32 | Decision (yours) | the answer's routing call is charged like any other routing call | recorded; it could be free with a rule for who pays when the router asks |
| N33 | Limit (by design) | not every model call asks: the per-lane calls, the full page writer and the add-on's designers do not; the pickers and the text, data, rules, picture, menu and page steps do | recorded |
| N34 | Limit (by design) | a step's question beside other work is kept only when what it leaves to do can be told apart from what ran (its own words, or the message less every other step's own words); when another step ran on the whole message, or on a fixed request, that part is left alone and said as not kept (*"…so I left that part alone. Send it again"*), never resumed with work that ran | recorded |
| N35 | Limit (by design) | a request's files survive a reload in the same browser only (IndexedDB); another device or blocked storage is asked to attach them again | recorded |
| N36 | Conditional risk | if a second router question cannot be kept after the first was answered, the call fails as ours and the answer is used up; the request must be sent again | recorded |
| N37 | Cost | the question field adds 884 characters to every look-picker call | recorded; the picker's share of its file re-anchored from a tenth to an eighth |
| N38 | Limit (pre-existing) | the add-on step is still never sent attachments | recorded (W16's shape) |
| N39 | Display (yours) | the thread shows a reply's line breaks as spaces, so what ran and the question after it read as one paragraph | recorded; not restyled |
| N40 | Instrument | the sweep's readers return the question a reply asks; no paid batch reads it yet | recorded |

**Tracked for the following batches** (a proposed grouping, your call):
lost and deferred parts W5, W7, W8, W15, W24 (**batch 2, fixed on the
branch**); context and files W6, W12, W16, W17; instructions and wording W9,
W10, W11, W23; the rest W13, W14, W18–W22, W25, W26, with N4, N7 and N8.

### 3.1 Removals

**W1. A hand-over carries the router's "remove" to another step, so a photo
removal can delete a page.** *Confirmed (code + free check of the browser
half); its reach is untested.*
- **Where**: `chat.js` 9723 (`siteEdit(o.site, { ...(o.d || {}), layer:
  e.layer, page: … })`), 9332 (`remove: d.remove === true`); `worker.js`
  21011 (`eRemove = eb.remove === true`), 24009–24037 (the page step's
  removal, no model call); `edit-failure.mjs` 112–113 (`picture/needs-place`
  → hop to `page`).
- **Expected**: a hop asks the next step to do the same job — for
  `needs-place`, to make a frame on that page.
- **Actual**: the hop keeps every field of the router's answer, `remove`
  included. "Take the photo off the About page" routed `picture` with
  `remove`, and answered `needs-place` by the photo step, becomes a request
  to the page step to remove `/about`. The page step deletes it at once,
  unless it is the home page or another page links to it.
- **Evidence**: free check W1 (§4): the browser's own `editAnswer` and
  `EditPoll` post `{"layer":"page","page":"/about","remove":true}`; the
  same escalation without `remove` posts no `remove`.
- **Impact**: an unlinked page lost for a photo request (it answers 301 home
  afterwards; restorable from Versions). How often the photo step answers
  `needs-place` for a removal is *unverified*.
- **Fix**: build a hop's request from the escalation's own fields (step,
  page) and the message, never from the first answer's verbs (`remove`,
  `tab`, `rename`); or mark a hand-over in the request (the server can't
  tell one today) and have the server ignore `remove` on it unless the
  escalation itself asked for a removal.
- **Fixed on the branch (batch 1, not deployed)**: both halves. The browser
  builds every hand-over from one helper, `EditPoll.handOver`: where it goes
  (the destination's step and page, else the ask's own page), what the
  router held back, what reading the message cost and the add-on bound —
  never the first answer's `remove`, `rename` or `tab` — and marks the
  request `handedOff: true` (the edit hop, the edit's hand-over to the
  add-on, and the add-on's hand-back). The edit route reads none of the
  three verbs on a request so marked, a mark that is only ever a real
  boolean. Shown through the real send handler (both chains, direct and
  queued) and through the real route on both money paths: the page step
  makes the change on the page it was handed and deletes nothing, a handed
  move moves nothing, a handed `tab` puts a logo in the header; the router's
  own removal still removes, at no model call. *Not covered*: how often the
  photo step answers `needs-place` for a removal (U7) — now harmless.

**W2. Removing one language or one QR code removes all of them.**
*Confirmed (code + free check).*
- **Where**: `site-lanes.mjs` 616 (`langs` removal: "the one they name, or
  every extra one"), 710 (`qr`: "the one they name, or the only one"),
  1135–1143 (the picker's examples include "drop the Spanish version");
  `worker.js` 23576–23579 (a removal makes no lane call), 23703
  (`mergeLook(…, { clear: eRemoves.remove })`); `site-edit.mjs` 641–649 (a
  cleared list becomes `[]`).
- **Expected**: "take the Spanish version down" removes Spanish only; "take
  the Scan for prices code off but keep the other" removes that code only.
- **Actual**: the whole field is emptied: every extra language, every QR
  code.
- **Evidence**: free check W2: `["fr","es"]` → `[]`; two codes → none.
  `fretwork-1` today serves French and Spanish versions and two QR codes
  ("Scan for prices", "Scan to ring and book"), read 07:49 UTC.
- **Impact**: a translation or a printed code the customer asked to keep
  stops working. Restorable from Versions; a re-added language is paid
  translation again.
- **Fix**: run the lane for a partial removal (the `langs` lane's own
  contract already says "send the whole list"; `qr` already patches one
  code at a time) and clear the field only when they ask for all.
- **Fixed on the branch (batch 1, not deployed)**: a removal on a list that
  holds more than one entry (`langs`, `qr`, and the controls' `behavior`
  list) is answered by that field's own lane, told it is a removal
  (`removalNote`): the languages and controls lanes answer the list with the
  named entry gone, the QR lane names the code, which comes off by name
  (`patchQr` with `remove`). The field is emptied only by a lane answering
  an empty list. **Every code that comes off takes its figure off every page
  and component that shows it**, found in the file's own syntax tree
  (`codeFigureRemoval`): the figure that reads the code, and a bare wrapper
  holding only it; a figure inside a condition, inside a sentence, or beside
  a code that stays is refused with nothing written, nothing published and
  nothing charged; so is a component store that cannot be read. This also
  closes a defect W2 hid: when the only code came off, its figure stayed,
  reading a binding the publish no longer writes. A one-entry list is still
  emptied for nothing, as before (N1). *Not covered*: what a real lane names;
  N2 and N3.
- **Your review of batch 1, and the gap fixes (2026-10-02, not deployed)**:
  *"Remove the one-entry shortcut too: list length does not establish which
  item the customer meant, so a request for an absent language or code must
  preserve the existing item. Let the model identify the targets and have
  code validate them."* Reproduced on `d4e3f1c7` through the real route:
  German asked off a site offered only in French took French off with no
  model call; "both codes" left the ringing code (the patch could name one
  code); the wifi code asked off a site whose one code is for prices took the
  prices code and its figure off. **Now every removal on a list is one small
  call** (`take_off`, in `site-lanes.mjs`): the model is shown each entry by
  the name to answer with (a language by its tag, a code by its name with its
  caption and destination, a control by its number) and answers the names of
  the entries the customer asked to take off — one, several, every one, or
  none. Code checks each name against the stored list by the lane's own rule
  (`takeOffTargets`: a tag whatever its case, a code by the one code-name
  rule, a control by its number). A name on the list comes off; a name not on
  it takes nothing off and is said beside what did (`takeOffNote`, shown
  after the look sentence); every entry not named stays as stored. A removal
  that names nothing on the list changes nothing and says what the site has
  (422, nothing charged for the edit); an unreadable answer is refused as
  such; a failed call is the editor-busy reply. Every entry named empties the
  field (for codes through the merge's `clear`, every figure off with them);
  several codes' figures come off together, and the figure refusals name
  every code. Two removals in one message each get only their own words. The
  refusal sentences say only what the step found: the browser adds "Nothing
  on your site changed" and the money, as it does for every `unchanged`
  reply (saying it in the sentence too printed it twice; batch 1's figure
  refusals did that as well, and are corrected). **Nothing reads the
  customer's words but the model**: the same words with a different answer
  take a different entry off (a control). Cost: a one-entry removal that was
  free now makes one small call, on the bill by its own usage. *Not
  covered*: what a real model names (Group D); N11, N13.

**W3. The full rewrite is told opposite things about pages it leaves out,
and the code deletes them.** *Confirmed (code); how often a writer leaves
pages out is untested.*
- **Where**: the one page tool every mode uses, `SITE_PAGES_TOOL`
  (`page-gen.mjs` 1643, 4453): its `remove` field says "Leaving a page out
  of `pages` does NOT delete it here: an unreturned page is KEPT"
  (1750–1752). The rewrite's own prompt says "To DELETE a page, simply do not
  return it." (2878). The rewrite publishes only the pages returned
  (`publish-pages.mjs` 1194, 1530) and never reads `remove` (only the add-on
  does, `worker.js` 28093).
- **Expected**: one rule, and a page nobody asked to delete survives.
- **Actual**: two rules in one request; a writer that trusts the tool and
  returns only the pages it changed deletes every other page.
- **Evidence**: the code; the add-on prompt's own comment calls the rewrite's
  sentence "exactly true there" (2853).
- **Impact**: reached by a `build` answer on a live site and by every `up`
  climb (the zero-balance rule starts a rewrite too, but its credit gate
  refuses it first, W22). Pages lost silently; restorable from Versions.
- **Fix**: on a rewrite, keep every stored page the writer did not return
  unless it is named in `remove`, and give the rewrite the same instruction
  as the tool.
- **Fixed on the branch (batch 1, not deployed)**: one contract. The rewrite
  is told what the tool says: *"A PAGE YOU DO NOT RETURN IS KEPT exactly as
  it is published now. To DELETE a page, put its file in `remove`…"* (both
  the full prompt and the one for long sites). The publish folds what the
  writer returned over the stored site (`mergeRevisedPages`): a returned page
  replaces or adds, every other page is kept byte for byte, and a page comes
  off only when the writer named it in `remove` and the add-on's own rule
  allows it (`takePagesAway`: never the home page, never a page another page
  still links to). A refused removal is said (`keptNote`, shown with the
  build's other notes); a removal-only rewrite is allowed. The returned pages
  are checked as part of a site (their links to kept pages are not rewritten
  away, and a home page left out is not reported missing). **Folded in, a
  related defect**: the rewrite handed the container only the components the
  writer wrote, so a kept page's components went missing; it now hands the
  stored ones too, the rewritten one replacing its old source
  (`mergeParts`), when the store was read. Shown through the real module and
  the real `/api/site/react-revise` route. *Not covered*: how often a writer
  returns a subset (U6, harmless now), and a writer naming a page in
  `remove` unasked (N10).
- **Your review of batch 1 (2026-10-02, not deployed)**: the add-on block
  still said an unreturned page being kept was *"the opposite of what it
  means on an ordinary rewrite"* — false once the rewrite keeps them too.
  Removed. Every prompt the page writer can be given — the rewrite, the
  long-site rewrite, the add-on with every page shown or some withheld, the
  one-page edit, and the tool's own `remove` field — is held by one test to
  one contract: a page not returned is kept, `remove` is the only delete,
  nothing calls that the opposite of anything, and no block says a page not
  returned goes. *Found while checking, kept separate*: N12.

**W9 (removal wording) is in §3.8. W20 (removing custom styling) is in §3.9.**

### 3.2 Lost or deferred parts, and mixed requests

**W5. An edit the reader turns into an add-on keeps the held-back part, so
the halves swap.** *Confirmed (code + free check).*
- **Where**: `site-ask.mjs` 1191–1194 (`{ ...readEdit(…), ...readAlso(…) }`),
  1455–1458, 1524–1531 (the conversions); `worker.js` 25739 (the add-on takes
  the held-back part out).
- **Expected**: when an edit answer can't be used, the part held back for
  later is not what runs, and the part that was meant to run is not lost.
- **Actual**: "Take the Events page off the site and add a page for our cake
  orders", answered `page` + `remove` for `/events` with the addition held
  back, on a page list without `/events`: the reader makes it `addon` and
  keeps the held-back addition. The add-on then runs "Take the Events page
  off the site and ." and holds back "add a page for our cake orders".
- **Evidence**: free check W5 (reason `page-unknown`; the same with
  `layer-missing`).
- **Impact**: the add-on declines a removal (*unverified*, W14), and the
  addition it could have made is put off; with W7, the customer is not told.
- **Fix**: when a reader converts an answer, drop `alsoAsked` (run the whole
  message) — better, answer an unknown page with the site's real pages at no
  cost, as the look step already does (`page/no-page`).
- **Fixed on the branch (batch 2, not deployed)**: both, by what the
  model's answer is. Every way out of `readEdit` that does not use the
  model's edit answer now carries why (`converted`), and `readRouting`
  decides what becomes of the held part:
  - **a removal or a move of a page the site lacks stays an edit**: no
    addition takes a page away or moves it. The page step answers with the
    site's real pages at no cost for the edit, and the reply names the part
    held back. The free check's message now ends: *"Your site doesn't have a
    /events page, so there was nothing to take off. Its pages are /,
    /gallery and /visit."* plus the held sentence;
  - **a plain edit of a missing page is still an addition on that page**
    (the policy as it was). It keeps the held part and carries
    `handOver {from: route, reason: page-unknown, page}` to the add-on step,
    whose picker is shown it (W24);
  - **an answer the model did not decide drops the held part** (no step, an
    unknown one, or a page edit naming no page; marked `also-dropped`), so
    the step it falls to gets the whole message, told why
    (`route-unreadable`).

  Shown through the real router reader, the real browser and the real edit
  route, sync and queued (`route-decision`, `handover-route`, `edit-op-scope`,
  `handover-operations`). *Not covered*: how often a real router names a page
  the site lacks.

**W7. The held-back part is named only when the turn succeeds.** *Confirmed
(code).*
- **Where**: `alsoTail` is added at `chat.js` 9639 and 10245 only.
- **Expected**: whatever happens to the part that ran, the customer is told
  what was put off.
- **Actual**: a refusal, an explanation or a failure says nothing about it.
- **Evidence**: the code: `alsoTail` has no other caller.
- **Impact**: part of a request disappears without a word.
- **Fix**: add the held-back sentence to every final outcome.
- **Fixed on the branch (batch 2, not deployed)**, at both ends:
  - **The server.** Every ending of the edit route, the add-on route and the
    full rewrite passes through one wrapper (`heldReport`,
    `builder/hand-over.mjs`). It adds `deferred` to the JSON reply: the parts
    the request really took out (`heldParts`, now a list), and any a step put
    off itself (W15). The build route's own deadline answer names the
    rewrite's parts (`BUILD_HELD`). The row review's settled reply, stored
    over the step's first one, names what that first reply put off, in
    either shape, on both verdicts. Before, a list was dropped and the
    refund named nothing.
  - **The browser.** `alsoTail` (`public/chat.js`) runs on every ending.
    - A readable reply speaks for itself through its own `deferred`.
    - With no readable reply, the browser names the parts it posted (an
      unreadable body, a dropped connection, a job with no stored reply,
      `gone`).
    - An ending that did not succeed says the part was left, never that
      anything ran: *"I left “X” for later, so it wasn’t tried. Send that on
      its own when you’re ready."*
    - Several parts are named in turn.
    - A reply whose `deferred` does not read is treated as unreadable.

  Shown through the real routes and the browser's own send chain: a
  refusal, an escalation, a failure, an unreadable answer, a dropped
  rewrite, the add-on's refusal and both review verdicts
  (`handover-route`, `handover-operations`, `edit-op-scope`, `addon-row`,
  `handover-batch2`). *Not covered*: N16 and N17 (§3.0).
- **After your review (2026-10-02, `129a1757`)**: a rewrite long enough to
  run in the background answers 202 and is finished later by another
  invocation, from a stored record that had no field for the parts. So its
  final answer, the poll route's replay of it and the screen named nothing,
  after a 202 that had named them. Now the record carries them (all or
  nothing, within the hand-over's own bounds) and every final answer names
  them: the collector's success and failure, the poll route's own verdict
  for a build lost after its fire (its owner only), and the queued route's
  own answer. The browser keeps the 202's account for a final answer with
  none of its own. Shown through the real queued route, the fire, the
  resume message, the collector, the poll route and the browser's own
  follow (`handover-resume`). *Not covered*: N22 and N26.

**W8. A climb to the full rewrite runs the held-back part too.** *Confirmed
(code).*
- **Where**: `go()` sends the whole message (`chat.js` 9047–9051); the
  rewrite's body has no held-back part (11471–11472).
- **Expected**: the rewrite does only what the edit was doing.
- **Actual**: it gets the whole message, including what the router put off.
- **Evidence**: the code.
- **Impact**: the put-off part is done in the costliest step, by a writer
  that rewrites every page; the customer was told it would wait.
- **Fix**: send the held-back text with the rewrite and take it out, as the
  edit and add-on routes do.
- **Fixed on the branch (batch 2, not deployed)**:
  - **The climb sends the parts.** It posts the parts put off (`alsoAsked`)
    and the hand-over, from the edit's climb and the add-on's alike, through
    the same helper as every other hop (`EditPoll.handOver`).
  - **The rewrite takes them out first** (`runSiteBuild`, `worker.js`),
    before the designer or the page writer reads anything. A part it cannot
    find is refused at no cost, with no model called (`held-unread`).
  - **The page writer is told why it was handed the work**: one line from
    the fixed lists. The designer is not told (N15).
  - **The reply names the parts.**

  Shown through the real `/api/site/react-revise`: the part put off reached
  no model, the writer got the line, the neighbouring pages were kept byte
  for byte, and the reply named the part (`handover-batch2`). The browser's
  climbs post it (`handover-operations`), including a 402 refusal naming the
  part. *Not covered*: what a real page writer does with the line.
- **After your review (2026-10-02, `129a1757`)**: the parts ride the
  rewrite's resume record, so a retry (the generation lost and fired again)
  keeps them, and no page-writer job the container is handed carries them.
  Shown on a finish, a retry and a give-up, asserting the designer's request
  and each job the container was handed (`handover-resume`). *Not covered*:
  no natural message we choose reaches the full rewrite, so this stays shown
  with supplied answers only.

**W13. A question beside a change goes unanswered.** *Confirmed (code).*
- **Where**: the system text's ordered rules (857–903); one intent per
  answer; `answer` is shown only for `ask`.
- **Expected**: "What does an hour's lesson cost? Knock £2 off it." answers
  the question and makes the change, or says it can't do both.
- **Actual**: the change runs; the question is dropped.
- **Evidence**: the code.
- **Impact**: low: the customer asks again, and the routing call is charged
  again.
- **Fix**: let a work answer carry a one-line reply, shown before the step's
  sentence.

**W15. The look step's hand-over to the add-on sends the whole message and
drops the look changes beside it.** *Confirmed (code); the outcome is
untested.*
- **Where**: `worker.js` 21911 (`escalate("addon", …)` before any lane runs).
- **Expected**: a colour change beside a new QR code makes the colour change
  and adds the code (or holds one part back, named).
- **Actual**: no lane runs; the add-on gets the whole message and its
  designers decline the colour part (*unverified*).
- **Evidence**: the code.
- **Impact**: the look change is lost, and the reply speaks only of the
  add-on's outcome (*unverified*).
- **Fix**: run the other picked lanes first and hand only the addition on,
  as a held-back part. The router should have held it back; this is the net
  when it doesn't.
- **Fixed on the branch (batch 2, not deployed)**, as proposed, with the
  picker deciding:
  - **Beside other work, the addition is put off.** When the picker names an
    addition the site does not have (a QR code, a 3D scene, a page) beside
    other work, its words come from the picker's own scope for it. They join
    the parts put off (`deferred` on the reply, `alsoAsked` for every later
    step), and the other lanes run on their own words. The page addition
    beside a move is covered too: that branch returned before the steps
    already built could run.
  - **Alone, it is the whole ask**: handed to the add-on step as before, now
    with its page.
  - **An answer with no words for each change** cannot separate the
    addition's words, so nothing runs and the customer is asked to send it
    alone (`picker/addition-mixed`, 422, nothing charged for the edit; N18).
  - **The removal door never hands on**: the router's own step there is
    always other work.

  Code checks only that the site has no such thing and that the words are
  the customer's own (`readScopes`). Shown through the whole chain (the
  routing route, the browser, the edit route; sync and queued): the
  description changed, no code made, every page byte for byte, the code named
  as left for later, no paid follow-up (`edit-op-scope`). *Not covered*:
  what a real picker gives as the addition's words.
- **After your review (2026-10-02, `129a1757`)**:
  - **Every scoped addition is kept.** The look step took the first scope
    the picker gave a lane (`additionOp`), so a second QR code was neither
    made nor named; alone, two codes were handed on with the first one's
    page. Now every valid scope is put off, in order (`scopedOps`), and
    additions alone name the part of the site and the page only when they
    share them.
  - **No step that runs is handed words put off.** Each planned step now
    carries its own words. Once the plan is built, every part put off is
    taken out of each step's words by position (`wordsLess`) and out of the
    message a step falls back to (`eRun`), which the removal door's own step
    runs on. A step left with no words of its own does not run, a change
    wholly inside an addition is that addition, and when nothing of the
    message is left nothing runs and nothing is named as put off.

  Shown through the whole chain and the removal door, asserting each lane's,
  writer's and picture step's actual request (`edit-op-scope`,
  `edit-removal-door`, `handover-batch2`). *Not covered*: N23–N25 and N27.

### 3.3 Page scope and missing context

**W4. A menu edit writes one menu to every page.** *Confirmed (code + free
check on run 92's stored pages).*
- **Where**: `site-nav.mjs` 1082–1113 (`applyNav`: "a list writes one menu
  everywhere"), 1514 (an edit's list applied to all pages), 680–712 (the
  editor is shown one merged menu, "THE MENU AS IT IS NOW").
- **Expected**: renaming or removing one menu item changes that item on each
  page and leaves each page's other items alone (additions already work
  that way, `withAdded`).
- **Actual**: every page gets the one list. On run 92's stored bakery pages,
  renaming "Today's bake" also adds Gallery to `/order` and `/visit`; on a
  copy of `repairbench-1`'s menus, renaming "Booking Check" adds Workshop
  Load and Rates to `/status` (§4).
- **Evidence**: free check W4; the bakery's menus differ today (`/` and
  `/gallery` five items, `/order` and `/visit` four), and so do
  `repairbench-1`'s (four, four, two, two and three), read 07:53 UTC.
- **Impact**: menus the owner shaped per page are rewritten by any menu
  edit. Restorable from Versions.
- **Fix**: apply a rename, removal or reorder to each page's own items by
  identity, as additions are applied.
- **Fixed on the branch (batch 1, not deployed)**: the editor's answer is
  read as the changes it makes to the menu it was shown, by address
  (`menuChange`): an item taken off, renamed, pointed somewhere else (each
  page keeps its own words), replaced by a new item between the same
  neighbours, moved (the fewest items that explain the new order), or added.
  Only those changes are made to each page's own menu (`menuApply`): a page
  never gains an item it did not list (an addition excepted), keeps its own
  order and its own words for items the answer only restated; a rename
  reaches the item on every page that lists it. A menu the change leaves as
  it was is left as written, to the byte. **Folded in, two related
  defects**: an unchanged menu was rewritten onto one line, so a page whose
  menu did not change still changed and was counted ("Updated the menu on 4
  pages" for a change two menus had); and the reply listed the answer's menu,
  which after per-page edits may be no page's menu — it now names the menus
  as they read, and how many pages carry each when they differ. Shown through
  the real edit route on both money paths, on a site whose four menus all
  differ. *Not covered*: the footer's two lists still write one list (N4);
  N5.
- **Your review of batch 1, and the fix (2026-10-02, not deployed)**:
  *"through runNavEdit, start with Home, Menu, Visit, Order, Status and
  supply the correct model answer Order, Status, Home, Menu, Visit — the
  current code returns no-change … nine of the 120 permutations of five
  items failed my comparison"*. Reproduced: 9 of the 120 orders of a
  five-item menu came out wrong through `runNavEdit`, yours as "nothing to
  change". The cause: moved items were placed one at a time with the others
  still standing in their old places, so an item anchored on a later moved
  item where that one used to be, and went back with it. Now every moved
  item is lifted out first, and the moved and the added go back in the
  answer's order, each after the nearest item the answer put before it that
  the page has (else before the nearest one after it). All 120 orders through
  `runNavEdit` end as the answer (119 changed, the restatement unchanged); a
  property test over the 120 orders on four menus that differ holds each
  page's items and words, keeps what the answer did not move in the page's
  own order, and places each moved item after its nearest earlier neighbour;
  through the real route, two items moved together on four differing menus
  keep each page's words and the rest of its order.

**W6. Pages the browser didn't keep are unknown to the router.** *Confirmed
(code); corrects R8.*
- **Where**: `chat.js` 4565 (`pages: s.pages.slice(0, 6)`), 4792 (no refresh
  when the stored list has more than one page), 9077 (the router gets
  `sitePages(site)`); the route fills in table names but not pages.
- **Expected**: the router sees every page the site has.
- **Actual**: after a reload, a site with seven or more pages sends six; a
  page added or removed on another device or by our canary is never
  learnt. A `page` answer for a page not sent becomes `addon` (W5, R4).
- **Evidence**: the code; no 7-page site was reloaded live for this audit.
- **Impact**: wrong routes on larger sites; the earlier audit's "24 pages"
  holds only until a reload.
- **Fix**: fill the page list on the server from the stored source, as
  table names are (Lane 1d), or keep every path (without the page HTML) and
  refresh on open.

**W12. A `text` answer drops the page the customer named.** *Confirmed
(code); the effect is untested.*
- **Where**: `site-ask.mjs` 1517–1520 (`page-ignored` for every step but
  `look` and `page`).
- **Expected**: "On the home page only, change Ring the workshop to Call the
  workshop" changes the heading, not the header button on every page.
- **Actual**: the text step gets no page; whether it keeps to the home page
  rests on its model reading the message (*unverified*).
- **Evidence**: the code; probe PS1 measures the routing half.
- **Impact**: wording the customer limited to one page can change on every
  page (*unverified*).
- **Fix**: carry the page to the text step and limit its items to that page
  when one is named.

### 3.4 Conflicting instructions

**W10. The router sends translation "further up" though the look step
translates.** *Confirmed (code).*
- **Where**: `site-ask.mjs` 436–437 ("translate the whole site into Spanish
  is a rewrite and belongs further up"); the look door's `langs` lane
  (`site-lanes.mjs` 615–633) offers the site in another language, written at
  publish (`site-translate.mjs`); `fretwork-1` serves `/fr` and `/es`.
- **Expected**: "Could the site be in Polish as well?" goes to `look`.
- **Actual**: the router is told it is a rewrite. A `build` answer would
  rewrite every page (~25 credits). What the model answers is *unverified*
  (probe CF1).
- **Evidence**: the code, and `fretwork-1`'s live `/fr` and `/es` versions
  (read 07:49 UTC).
- **Impact**: a cheap language change risks a rewrite of every page.
- **Fix**: point translation at `look` (the languages the site is offered
  in), and keep "declared language" as the separate fact it is.

**W11. Router instructions that disagree with each other or with the
product.** *Confirmed (code).*
- **Where**, each in `site-ask.mjs`:
  - **the name instead of a logo**: `look` takes "just use our name as the
    logo" (432); `logo` takes "just the name is fine" as a removal (527,
    707);
  - **undo**: "Every change is archived and every one can be undone by
    saying so" (216), beside "Rebuilding … whatever the owner had is gone"
    (903);
  - **what the builder can do** (861–868): "its own Postgres database", "read
    a link", "search the web", "attached images and PDFs as reference";
  - **"When you cannot tell, answer addon — it can do everything an edit can
    except take something away"** (310);
  - **the tab icon**: `look` draws one ("make the tab icon a scissors", 430);
    `logo` with `tab` takes an attached one (717–722).
- **Expected**: one instruction for each wish, and every claim true of the
  product.
- **Actual**: the same wish (show the name, not a logo) has two steps with
  two results, and on a site with no logo the removal changes nothing; no
  step undoes anything (R6); a database is made only when tables are
  declared, and links, search and attachments are read on builds only
  (R11); the add-on adds, and doesn't change words, colours, menus or
  entries (R5); which tab-icon step is meant depends on a file the router is
  never told about (W16).
- **Evidence**: the code (each quote at its line).
- **Impact**: the model is left to choose between two answers for one wish,
  or answers a question with a capability an edit doesn't have; which it
  does is *unverified* (probes CF2 and AT2 measure two of them).
- **Fix**: one owner of each wish (the name lettering to `look`; a logo
  removal only when a logo exists), the capability list split into build
  and edit, the undo promise replaced by the restore that exists, and the
  "cannot tell" rule made true.

### 3.5 Follow-ups and undo

**W18. Replies suggest follow-ups the router can't serve.** *Confirmed
(code); what each does is untested.*
- **Where**: `chat.js` 11095–11096 ("Say "put NAME back" and I'll restore
  it."; its comment says this makes the ask data-shaped, but a put-back now
  routes to the add-on, run 90's B2, and the deleted rows reach the data
  step only, 9356); 10845 ("say "put the photo back""); 11018 ("Every
  publish is kept, so say the word if you want it back." after a page
  removal: the page is no longer in the list, so asking for it designs a new
  one through the add-on); 11171 ("say "do the same everywhere"", with no
  earlier message for the router to read).
- **Expected**: a reply offers only what a message can do, and points to
  the free, exact restore (Versions) for undo.
- **Actual**: each phrase starts a route with no context; a put-back through
  the add-on may not restore the entry's other fields (*unverified*).
- **Evidence**: the code; run 90's B2 routed a put-back to `addon`.
- **Impact**: a customer who follows the reply's own advice gets a
  different, possibly paid, result than it promised.
- **Fix**: give the add-on the deleted rows for a put-back, point undo
  sentences at Versions, and drop the phrases no route can serve.

R6 (undo) and R7 (no conversation) stand (§3.12).

### 3.6 Attachments

**W16. A file reaches only the logo step and builds, and nothing says so.**
*Confirmed (code); extends R2.*
- **Where**: the router gets a yes/no only, and never in its prompt
  (`askRequest`); files go to the logo step (`chat.js` 9363) and to builds
  and rewrites (11471–11472); not to `ask`, the other edit steps, the
  add-on or either hand-over.
- **Expected**: a photo sent with "use this for the big picture at the top"
  is the photo used, or the customer is told it can't be.
- **Actual**: the photo step chooses from the site's uploads or buys one
  (*unverified* which); the customer isn't told the file wasn't used.
- **Evidence**: the code; run 90's F1 (a photo swap with a file) was routed
  `picture` with the router not told of the file.
- **Impact**: the customer's own photograph is not used, and they may pay
  for one that was bought.
- **Fix**: tell the router a file is attached, pass files to the photo step
  and the add-on's photo kind, and say plainly when a file wasn't used.

**W17. A question sent with a file becomes a paid add-on, even when the
file couldn't be read.** *Confirmed (code).*
- **Where**: `site-ask.mjs` 1250–1253 (`ask` + `attached` → fallback, which is
  `addon` on a live site); `chat.js` 4421–4465 (a file too large or
  unreadable is kept in the strip as a placeholder, so `attached` is true).
- **Expected**: "Is this photo sharp enough to use?" gets an answer.
- **Actual**: an add-on starts; its picker must name a kind (W14).
- **Evidence**: the code; probe AT3 measures it.
- **Impact**: a paid add-on the model did not choose, for a question.
- **Fix**: keep `ask` with a file as `ask` (or answer that the file can't be
  judged here); count only files that were read.

### 3.7 Unsupported requests

**W14. An unsupported request ends in "say it differently", never "the site
can't do this".** *Confirmed (code); the outcome is untested.*
- **Where**: `site-add.mjs` 1388–1402 (`minItems: 1`, "name the single
  closest one"); 1615 (designers answer nothing when it isn't their kind);
  3481 (the refusal); `chat.js` 10101–10104 (a refusal shows only its own
  sentence, never the notes beside it).
- **Expected**: "Could you turn this into an app teachers can download?" is
  answered as something the builder doesn't do.
- **Actual**: if it reaches the add-on, the customer is told to say what
  they want and where. The routing call is charged.
- **Evidence**: the code; probe US1 measures the routing half.
- **Impact**: the customer is told to rephrase something nothing can do, and
  pays for the routing call each time.
- **Fix**: let the picker answer "nothing here", and show the unsupported
  note on a refusal.

**W19. The behaviour lane charges and reports success, but changes nothing
a visitor sees.** *Confirmed (code; its own comment).*
- **Where**: `site-lanes.mjs` 651–655 ("because nothing consumes `behavior`
  yet, an edit here republishes a page that looks and behaves identically").
- **Expected**: "make the button open the booking form" changes what it
  does, or says it can't.
- **Actual**: a stored record changes and the reply says it was updated.
- **Evidence**: the code's own comment.
- **Impact**: a charge and a success sentence for a change nobody can see.
- **Fix**: send behaviour requests to the page writer, or refuse them by
  name, until something reads the field.

**W22. At a zero balance, every message on a live site becomes a rebuild
attempt.** *Confirmed (code); R10.*
- **Where**: `worker.js` 19980–19988 → the browser's `go()` → the rewrite's
  credit gate: "A build needs about N credits." (15132–15134).
- **Expected**: a question is answered, and a change is refused with a
  balance message.
- **Actual**: "what are my opening hours?" gets a sentence about a build.
- **Evidence**: the code.
- **Impact**: low (only at zero), but every message, a question included,
  is answered with a sentence about a build.
- **Fix**: at zero, answer `ask` with a balance message, no model call.

### 3.8 Keyword and site-specific decisions

**W9. The page writer's text guard decides from the customer's verbs.**
*Confirmed (free check).*
- **Where**: `page-prose.mjs` 395 (`permissions()`: "a deliberately small,
  explicit request grammar"), 451 (the verbs: change, rewrite, reword,
  update, show, rename, replace, remove, delete, take, make), 422 (a target
  must be a section's exact name, "X section", "X heading" or "the
  line/paragraph/text under X"), 453 (negations); called at `worker.js` 24905, **after** the
  keep check (24894), whose model has already said, with a quote checked
  against the message, that the loss was asked for.
- **Expected**: the same removal is treated the same however it is worded.
- **Actual**: one removal, eight wordings: "Remove the Parking section.",
  "Delete the parking section from the visit page." and "Take the Parking
  section off the visit page." publish; "Get rid of the Parking section.",
  "We don't need the parking info any more.", "Lose the bit about parking.",
  "Drop the parking paragraph." and "Please take out the parking part,
  nobody parks there." are withheld with *"Please identify the section by
  its unique heading or quote the exact text…"* (409, edit not charged,
  routing charged).
- **Evidence**: free check W9 (§4): the real guard, with its real parser.
- **Impact**: natural wording is refused after a model call; the router's
  own examples use the refused verbs ("drop the testimonials band", "get rid
  of the QR code", 460).
- **Fix (the owner's call: this guard was built on purpose, refuse-only)**:
  confirm structurally instead of by verb — the keep check (a model) names
  the target with a quote, and code checks that what was lost is exactly
  that target's block.

**W23. Wording from the test sites and test sentences sits in the model
prompts.** *Confirmed (code).*
- **Where**: the router: "drop crookes-guitar" (632: `fretwork-1`'s old
  name); "called "Sunset Shoes" and live at shoeroom-1" (629); "remove the
  chord diagrams" (460: `ben-crowe-guitar`'s section); "Put Gallery in the
  menu" (257: the bakery's page). The add-on and the menu editor: "add a line
  saying we're closed on bank holidays" (`site-add.mjs` 927, 959: run 90's
  and 92's A4, almost word for word); "add a Call us button too"
  (`site-nav.mjs` 522: A3); "add our Instagram" (546: A1); "another loaf"
  (`site-add.mjs` 606, 1435); "a luthier's bench … half-finished guitar
  bodies" (1159–1160: `fretwork-1`).
- **Expected**: examples that teach a rule without naming our test sites or
  repeating our test sentences.
- **Actual**: they do both. Nothing in code branches on them, but a model is
  shown them on every call.
- **Evidence**: the code; `shoeroom-1` is "Poulson's" today (served page,
  07:49 UTC), so the "Sunset Shoes" line describes a fixture's history.
- **Impact**: a probe on these sites, or with these sentences, partly tests
  the example rather than the rule. Run 92's frame and words passes rest
  partly on wording the downstream prompts contain; 17 of router-audit-1's
  18 probes and all 8 of addition-fix-1's were on the bakery.
- **Fix**: replace them with neutral examples, and test on other sites
  (Group R uses none of the bakery and shares no run of five words with the
  router's prompt).

### 3.9 Smaller confirmed defects

**W20. Removing custom styling explains instead of removing.** *Confirmed
(code + free check).*
- **Where**: `css` is offered as removable (`REMOVABLE_LANES`) but is not a
  field the merge can clear (`EDIT_FIELDS`, `site-edit.mjs` 118);
  `worker.js` 23755–23790.
- **Expected**: "take off the custom styling" removes it, or says it can't.
- **Actual**: nothing moves, and the step answers "I couldn't work out how to
  change the site's look that way." (`look/no-change`).
- **Evidence**: free check W2/W20 (§4).
- **Impact**: low: nothing changes, and the routing call is charged.
- **Fix**: strip the rules the request names, or stop offering `css` as
  removable.

**W21. A replacement with a straight apostrophe or quote is dropped, then
answered "I couldn't find that wording on your site."** *Confirmed (code +
free check).*
- **Where**: `site-apply.mjs` 304 (dropped silently); `edit-failure.mjs` 247
  (`text/no-match`, the sentence).
- **Expected**: "Change it to We're open late on Fridays" changes the words.
- **Actual**: the edit is dropped, and the customer is told the wording
  wasn't found. Curly quotes pass.
- **Evidence**: free check W21 (§4).
- **Impact**: an everyday word ("we're", typed on a keyboard) fails with a
  misleading sentence; the routing call is charged.
- **Fix**: write the words as an escaped string or a JSX expression (the
  step knows which context it writes into), and never report a refusal as
  "not found".

**W24. The edit's hand-over to the add-on carries no reason.** *Confirmed
(code).*
- **Where**: the edit's escalation names the field and why (`worker.js`
  21911 and others); the add-on post carries neither (`chat.js`
  10014–10021).
- **Expected**: the add-on knows what the edit couldn't do.
- **Actual**: its picker starts again from the message alone.
- **Evidence**: the code.
- **Impact**: the add-on may design something other than what the edit
  handed on (*unverified*).
- **Fix**: post the escalation's field and reason with the hand-over.
- **Fixed on the branch (batch 2, not deployed)**:
  - **The browser posts the hand-over on every hop** (`EditPoll.handOver`):
    the destination's step and page, the reason from the step's own answer,
    and the part of the site. The router's own conversion posts its page and
    reason too (W5).
  - **The add-on route checks it** against the fixed lists (`readHandOver`)
    and the site's own pages. A page the site lacks is dropped, except the
    router's `page-unknown`, whose page is the one to make.
  - **The add-on route records it** (trace mark `handover`) and shows its
    picker one line built from those lists only, never words the customer
    typed or a model wrote: *"How this reached the add-on step: Handed on by
    the look step: the edit step was asked to add something the site does
    not have yet. The part of the site: qr. The page: /visit."*
  - **The edit route records a hand-over it receives**, and so does the
    rewrite, whose page writer is shown the same line (W8).
  - **Every reason a step hands work on with is on the list, and no other**
    (a test reads them off the code).

  Shown through the real add-on route and the browser's chain
  (`edit-op-scope`, `handover-operations`, `handover-route`,
  `handover-batch2`). *Not covered*: what a real add-on picker designs with
  the line, and N14 (an edit step handed work by another records the reason
  but is not shown it).

**W25. A new entry beside a hand-over is refused naming only the entry.**
*Confirmed (code).*
- **Where**: `worker.js` 26439–26441; `site-add.mjs` 3416.
- **Expected**: both halves named, as the code's own comment says.
- **Actual**: only the entry is named.
- **Evidence**: the code.
- **Impact**: low: the other half goes unmentioned.
- **Fix**: name both halves in the refusal.

**W26. Stale comments.** *Confirmed (code).*
- **Where**: two of R14's three remain (`site-ask.mjs` 121 and 1112; the
  third is gone), and 1178 still says the held-back part "does not change
  what gets DONE: it is a note".
- **Expected**: comments that say what the code does.
- **Actual**: the held-back part has changed what gets done since
  2026-09-29.
- **Evidence**: the code.
- **Impact**: none on customers; a reader is misled.
- **Fix**: correct the comments.

### 3.10 Untested behaviour (needs a run)

| # | What | Why it matters | Settled by |
|---|---|---|---|
| U1 | The add-on's new page is linked from one page only (`site-add.mjs` 3526); `repairbench-1`'s per-page menus today are consistent with that | menus disagree across pages | a delivered add-on page |
| U2 | A frame item beside other kinds is set aside, yet the page writer still reads its words (`worker.js` 26443, 27914) | a link added to some pages only | a delivered mixed addition |
| U3 | What the add-on does with removals, changes and unsupported asks converted to it (W5, W14, W17) | refusals or wrong additions | Group D: D8 |
| U4 | Whether a put-back through the add-on restores the entry's other fields (W18) | a different entry comes back | Group D: D7 |
| U5 | Whether the text step keeps to a page named in the message (W12) | the header changes too | Group R: PS1, then a delivered edit |
| U6 | How often the rewrite's writer leaves pages out (W3) | harmless since batch 1 (an unreturned page is kept); what matters now is N10, a page named in `remove` unasked | a delivered rewrite, after the merge |
| U7 | Whether the photo step answers `needs-place` for a removal (W1) | harmless since batch 1 (a hand-over carries no removal) | nothing needed; covered free (§4) |
| U8 | What the router answers for each Group R message | every downstream finding | Group R |
| U9 | What a step does with a follow-up that refers to nothing (R7) | a paid rewrite of the wrong thing | Group R: FU1, then D6 |
| U10 | What the photo step does without the attached file (W16) | a bought or wrong photo | Group D: D9 (fal has no credits today) |

### 3.11 Legitimate decisions (recorded so they are not mistaken for defects)

- The browser and route: dispatch on the answer; one hop only, to a
  different step; `fromAddon` so the add-on and the menu editor never loop;
  the add-on's climb only for a missing source.
- The readers: `clarify` only on a first build (superseded on the branch by
  W27, §3.13: a live site has its own budget and a kept question); `remove`
  and `tab` only
  where a step takes them; a held-back part must be the customer's own words
  (`heldBack`, `wordsIn`), never coerced; the decision report.
- The steps: page removal never of the home page or a linked page; the menu
  editor held to additions when the add-on hands it an addition
  (`additionOnly`); the keep check's quotes checked against the message;
  validators on every model answer; the QR destinations allowed; patterns
  over page source (`ADD_EVIDENCE`), never the message.
- **Owner-directed switches, with one evidence caveat**: `deploy.yml` 464
  and 482 default the split design and the split page bands to the building
  account (*"switch it on"*, 2026-09-10); 437 defaults the job runner to
  `fretwork-1`. They don't decide intent, but every build and band edit on
  the building account takes a path customers don't, so build evidence from
  this account is not the customer's path.
- **Not confirmed, and contradicted**: a sub-trace suggested the build's
  salvage step is unreachable; the bakery's `/starter` is a salvage stub
  ("This page isn't finished yet"), so it has run. Not pursued.

### 3.12 The earlier audit's items (R1–R14), now

| Item | Where it stands |
|---|---|
| R1 frame additions | **Closed**: fixed (deploy 2179) and Test 12 closed by the owner (runs 91, 92) |
| R2 attachments | Stands; extended by W16 and W17 |
| R3 silent conversions | The reply now names them (deploy 2178); they still become a paid add-on, and now swap a mixed message's halves (W5) |
| R4 a removal becomes an add-on | Stands (code); run 90 didn't reach it; W5 and W6 widen it |
| R5 "when you cannot tell" | The instruction stands (W11); run 90's "Make it better." got `ask` |
| R6 undo | Stands; the replies invite it (W18) |
| R7 no conversation | Stands; probe FU1 asks again on a one-page site |
| R8 limits | "24 pages" is six after a reload (W6); the look door's four lanes stand (untested) |
| R9 page scope | Stands; W12 adds the `text` step's dropped page |
| R10 zero balance | Confirmed from the code, with the sentence the customer gets (W22) |
| R11 the capability list | Stands (W11) |
| R12 written vs stored price | Table names filled since Lane 1d; run 77 answered `data`; probe CF3 asks again |
| R13 overlapping removal instructions | Stands; W1 shows a hand-over can turn one removal into another |
| R14 stale comments | Two of the three stand, plus one more (W26) |

### 3.13 Questions back on a site that exists (W27, 2026-10-02)

**W27. A question the router wanted to ask on a live site became paid
add-on work.** *A policy change on the owner's order; done on the branch.*
- **Before**: the reader overruled a live site's `clarify` to its fallback
  (`clarify-closed`), so a request the router could not place became an
  add-on, and no step after routing could ask anything. Measured free on
  `a8ed6b73` with a supplied router answer: `intent: "addon"`, decision
  `fallback`, reason `clarify-closed`. On the branch: `intent: "clarify"`,
  the model's own question, decision `model`.
- **The contract** (`builder/clarify.mjs`): one live question per site in
  R2 (`source/<slug>/question.json`, inside a job's wall), holding the owner,
  the stage that asked, the question count, the request the answer resumes,
  the parts put off before it, the files flag, the time and a status; it
  closes once on its etag; it lives 24 hours; two questions per request.
  The question is the model's (`QUESTION_FIELD` on every tool that may ask,
  read by one reader); no customer word decides whether to ask.
- **The route**: an answer names its question and is checked before any
  model call (409 `stale-question`, at no cost: answered, cancelled,
  replaced, expired, another owner's, another question, malformed, or on a
  first build); the router is shown what waits and says in `answered`
  whether the message answers it (a pressed answer always does); an answer
  resumes the waiting request with the question and the answer added (422
  `answer-too-long` past 2,000 characters, the question kept); a changed
  request is routed on its own; a message naming no question replaces it; a
  new question is kept only on the caller's own site; unusable questions and
  store failures fail the call at no cost.
- **The steps**: the look picker and door, the text, data, rules, picture,
  menu and page steps and the add-on picker may ask; a step that asks writes
  and charges nothing; the ending keeps the question with only what the
  answer must still do (beside work that ran, the step's own words), the
  parts put off before and by this message, and the files flag; past the
  budget it is words; a question that cannot be kept is our failure
  (`clarify-unkept`).
- **The page**: the question card (numbered answers, Esc cancels), typed and
  pressed answers, the request's files beside the question (memory and
  IndexedDB, never localStorage), a browser without them asked to attach
  again, the reload check, cancel, and the count and parts put off through
  every post, hop, job record and resume.
- **The first build is unchanged**: its tool, request and reader are
  byte-identical to `a8ed6b73` (42 pinned hashes), and it never reads or
  writes a site's question.
- **Found while testing the page**: a second router question after an answer
  was refused by the page's reader (it wanted an instruction the route never
  sends with a question) and said as *"I couldn't work out what to do"*.
  Fixed; the case fails with the fix reverted.
- **What it does not cover**: N28–N40 (§3.0). W13 (a question beside a
  change goes unanswered) and W17 (a question with a file becomes an add-on)
  are about the customer's questions, not the router's, and stay open.

## 4. Free checks run this round

All in `docs/investigations/whole-router-checks.mjs` (`node
docs/investigations/whole-router-checks.mjs`), driving the product's own code
with supplied inputs: no model, no network, no site, no money.

| Check | What it drives | Result |
|---|---|---|
| W1 | the browser's `editAnswer` and `EditPoll` (cut from `chat.js` as `scripts/addon-sweep.mjs` cuts them) with a `needs-place` escalation | on `f9979497`: a routed photo removal re-posted `{"layer":"page","page":"/about","remove":true}`; on the branch since batch 1 it posts `{"layer":"page","page":"/about"}`, like the control |
| W2, W20 | `mergeLook` as the look door called it for a removal; since the review's gap fixes `takeOffTargets` and `takeOffRefusal`, as the route now calls them, with the model's answer supplied | on `f9979497`: languages `["fr","es"]` → `[]`; two QR codes → none. On the branch: answering `["es"]` keeps `["fr"]`; German asked off a French-only site takes nothing off and says so; `["prices"]` keeps the ringing code, both names empty the list, and the wifi code asked off a prices-only site takes nothing off; `css` not cleared (W20, open) |
| W4 | on `f9979497`, `applyNav` with an edited list; since batch 1, `runNavEdit` (what the edit route calls) with the editor's answer supplied, on two pages whose menus differ | on `f9979497`: the shorter menu gained every item of the longer one (on run 92's stored bakery pages, one rename added Gallery to `/order` and `/visit`). On the branch: the rename reaches both menus and the shorter keeps its two items; taking Workshop Load out rewrites only the page that listed it |
| W5 | `readRouting` and `heldBack` with a supplied router answer | on `f9979497`, with `/events` missing from the list: `addon`, `page-unknown`, and the add-on runs the removal and holds back the addition. On the branch since batch 2 the removal stays an edit, and the page step refuses it with the site's real pages, naming the addition as put off (§4.3) |
| W9 | `preservePageProse` (with its real parser) on one page change, eight wordings | 3 published, 5 withheld |
| W21 | `readTextEdits` with four replacements | the one with a straight apostrophe is dropped |

### 4.1 Batch 1's checks (W1–W4, 2026-10-02)

Every case drives the real code with every model answer supplied: no model,
no network, no site, no money. Route cases go through the real
`POST /api/site/<slug>/edit` (or `/api/site/react-revise`) on both money
paths where the step has two, and judge the compile payload and the store
page by page, the money, and the reply.

| File | Cases | Red on the unfixed code (`5ce037a0`) | What it holds |
|---|---|---|---|
| `test/handover-operations.test.mjs` | 8 | 7 fail, the control passes | the real send handler: a photo removal handed to the page step and an addition handed to the menu editor post no verb, marked `handedOff`; the held-back part and the routing cost travel; the router's own removal is still posted |
| `test/handover-route.test.mjs` | 12 | 6 fail, the 6 controls pass | the route: a handed `remove` keeps the page and makes the change, a handed `rename` moves nothing, a handed `tab` puts the logo in the header; a mark that is not a real boolean is not one; the router's own removal and tab still act |
| `test/partial-removal.test.mjs` | 19 | 16 fail; 3 pass (the only-language controls and the all-languages case, the same either way) | one language off keeps the other; one code off keeps the other code and its figure and takes its own figure off; the only code comes off with its figure; a figure in a component, or shown twice, comes off; a guarded figure and an unreadable component store refuse, nothing written or charged; a code no page shows needs no placement step; one control of several |
| `test/qr-figure-removal.test.mjs` | 11 | 10 fail (the function is new); the parser control passes | `codeFigureRemoval` on its own: what comes off, what stays, what is refused, and that cannot-tell is never nothing-to-cut |
| `test/revise-keeps-pages.test.mjs` | 12 | 10 fail; the 2 controls pass | the fold, the removal rule, refusals said, components kept, an unread store, a first build unchanged, the chat's own note list showing a refused removal, and the real rewrite route keeping three pages and their components |
| `test/menu-per-page.test.mjs` | 22 | 20 fail; the 2 controls pass | the comparison and the per-page apply on their own, and the real edit route on both money paths, on four differing menus: take out, rename, move, add, replace and repoint, each page's own items, order and words, the menus as they read in the reply, and an answer that changes nothing publishing nothing |

**69 of the 84 new cases fail on the unfixed code; the 15 that pass are
the 14 controls and the all-languages case, the same either way.** Each red
check ran in a worktree at `5ce037a0` with the branch's test files copied
in, a name the old module lacks read as `undefined` so its own cases fail
rather than the whole file.

**Existing tests changed** (each keeps its property; the reason is in a
comment beside it): `edit-removal-door.test.mjs` (the reply counts the two
menus that changed, not four, and a menu without Gallery is now held
byte-identical: 17 of its 97 fail on the unfixed code); `page-gen.test.mjs`
(the rewrite's new sentence, in both the full and the long-site block, and
the old one is gone: 2 fail); `build-answer.test.mjs` (the kept note rides
on the answer, and only as a string: 1 fails); eight source-reading pins
re-anchored to the new call sites (`add-goes-to-addon`, `publish-pages`,
`wiring`, `site-addon`, `site-apply`, `site-ask`, `site-logo`,
`site-qr-list`).

**Mutation sweeps** (`scripts/mutate.mjs`, each from a verified-green
baseline, scoped to the files that guard it, with comment-only controls that
all survived). Every survivor was closed by a new case and the survivors
re-run, all killed:
- **W1**: 14 mutants, 13 killed. The survivor, a truthy `handedOff` read as
  a mark, is killed by a control that sends `"true"`, `1` and `{}`.
- **W2**: 23 mutants, 22 killed. The survivor, a code's reference outside a
  `{…}` read further up, is killed by a binding used as a tag name.
- **W3**: 21 mutants, 16 killed. Four survivors are killed by new
  assertions: the rewrite read as a whole site (a kept home page reported
  missing), the long-site block dropping the keep rule, the build answer
  dropping the kept note, and the chat not showing it. The fifth, the
  rewrite folding an unreadable component store, is equivalent for the one
  producer there is (`readSiteParts` answers an empty list on every
  failure, and folding an empty list hands over what the writer wrote); the
  test stays, with a comment saying why.
- **W4**: 20 mutants, 20 killed, over the per-page apply, the change
  reader, the comparison and the reply, against every test that runs the
  menu editor (10 files).

The re-run of `whole-router-checks.mjs` on the branch prints the batch-1
behaviour beside `f9979497`'s (the W1, W2 and W4 rows of the table above).

Also read, free and read-only: every candidate site's served pages and
sitemap (07:20–07:53 UTC: page lists, menus per page, headings, photo
frames, languages, QR codes), run 92's stored bakery pages, and Supabase
(each candidate site belongs to the building account; which have a
database). The new batch file was read with the press's own reader
(`readProbeBatch`: 20 probes, valid), compared with the two completed
batches (no message repeated) and with the router's full request text (no
run of five words shared).

### 4.2 The review's gap fixes (W2, W3, W4, 2026-10-02)

Your review of batch 1 found three gaps; each was reproduced on `d4e3f1c7`
first, through the real code, and the tests below drive the real code with
every model answer supplied (no model, no network, no site, no money). The
red checks ran in a worktree at `d4e3f1c7` with this round's test files
copied in.

| File | Cases | Red on `d4e3f1c7` | What it holds |
|---|---|---|---|
| `test/menu-per-page.test.mjs` | 32 (10 new) | 5 fail; 5 new cases pass there (the never-twice contract, and two route moves in both money paths that the old placement got right) | your case through `runNavEdit` (Home, Menu, Visit us, Order, Status answered Order, Status, Home, Menu, Visit us); all 120 orders of five items through `runNavEdit` (119 changed, the restatement unchanged); every order over four menus that differ (items and words kept, unmoved items in the page's order, each moved item after its nearest earlier neighbour); `menuApply` never lists an address twice; through the real route on both money paths: Order and Status first, Order then Visit us first (the case red on the old code) and the whole menu reversed, each page keeping its own words |
| `test/partial-removal.test.mjs` | 34 (rewritten to the new contract) | 33 fail; the failed-call control passes | through the real route, sync and queued: one language of two; your two absent-entry cases (German on a French-only site, the wifi code on a prices-only site) take nothing off, with the call made and the list shown; an empty answer; the only language named comes off (asked, not assumed); one code of two, two of three and every code, each with its figures; a guarded figure and an unreadable answer refused; the same words with a different answer (the control); several of three languages; every language; a name present and one absent (the note, on the customer's screen too); a failed call; an empty list asks no one; two removals in one message each told only their own words; a control by number; a figure in a component, or shown twice; an unreadable component store; a code no page shows. Every case checks what the removal was shown, the stored look field by field, pages and components byte for byte, the reply and the money, with the removal call on the bill by its own usage |
| `test/take-off.test.mjs` | 7 (new) | the file cannot load (the functions do not exist there) | which lanes take entries off by name; the tool answers a list of names only, forced; what the model is shown and the system rules; an answer read as names only, never coerced; each lane's matching rule and what stays; one call, an empty list asking no one, failed, cut-off and unreadable answers; the three refusal sentences and the note |
| `test/page-gen.test.mjs` | +1 | 1 fails | every prompt the page writer can be given holds one contract (see W3) |
| `test/site-qr-list.test.mjs` | +1, one pin re-anchored | 2 fail | the figure refusals name every code coming off in words that agree with how many; the qr fold is handed a patch only, after the removal |
| `test/site-addon.test.mjs` | one pin re-anchored | 1 fails | the add-on block's removal paragraph without "here" or "opposite" |

**Mutation sweeps** (from a verified-green baseline, each with two
comment-only controls that survived):
- **W4**: 10 mutants over the new `menuApply`, 9 killed. One survivor, a
  missing-guard mutant (an addition placed where the page already lists it),
  is unreachable through `runNavEdit` (the change is read against the union
  of the very menus it is applied to); a direct `menuApply` case now pins it.
  The other, putting the moved items back in reverse answer order, is
  equivalent: 494,721 page applications (161,179 with moves; differing
  menus, renames, removals and additions) gave identical menus, which fits
  the reason: with every moved item lifted out, each one is placed beside
  its nearest unmoved neighbour, so either order ends the same.
- **W2**: 35 mutants, 35 killed, over the take-off module, the route's
  branch, the merge, the bill, the reply, the browser's note and the figure
  refusals' words. One survivor of the first run (the removal call left off
  the bill) was closed by checking the bill for the call's own usage.
- **W3**: 8 mutants, 8 killed. One survivor of the first run (the withheld
  pages said to go when not returned, beside a block that still says
  "kept") was closed by checking that no block says a page not returned
  goes.

**Full unit suite** on the final tree: `8766 / 8766 / 0 / 0` locally:
batch 1's `d4e3f1c7` had 8,732; this round adds 34 cases and rewrites the
removal file's 19 to the new contract.

**Required CI**, both green: unit tests, run 36998606299 on `a0057c71` (the
same code as `1c2f2ab5`), `8766 / 8762 / 0 / 4` (the same total; CI skips
four); site build, run 36998368346 on `1c2f2ab5`, *"ALL CHECKS: 404 checks
in 27 sections across 4 shards, every job green"* at inputs
`89971686f325b91a`, which `a0057c71` shares, and TAP 398 (batch 1's 397
plus the agreement case). The history's §6.3 has every count.

**How many fail on `d4e3f1c7`**: 47 of the 53 new or rewritten cases, and
both re-anchored pins. The 6 that pass there: the removal file's failed-call
control; `menuApply` never listing an address twice (its guard predates this
round); and two route moves — Order and Status first, and the whole menu
reversed — in both money paths, which the old placement happened to get
right on that fixture. The case that is red, Order then Visit us first, is
the one where a moved item's anchor was itself moving.

**Screenshots** (the chat's own markup and stylesheet, the real route's
replies on the old and the new code): `docs/edits/router-batch-1-gaps-*.png`
— the absent language, the absent code, the note beside a removal, and two
menu items moved together.

### 4.3 Batch 2's checks (W5, W7, W8, W15, W24, 2026-10-02)

Every case drives the real code with every model answer supplied: no model,
no network, no site, no money. Route cases go through the real routes on
both money paths where the step has two. They judge the stored pages and
look byte for byte (and the published pages when anything published), the
money, the reply and what the browser's own code then says and does. The red
check ran in a worktree at `ef158022` (batch 1 with its review gaps, the
same code as `a0057c71`) with every changed test file copied in. Each file
also ran in its base version, so new cases are told from changed ones by
name.

| File | New cases | On `ef158022` | What it holds |
|---|---|---|---|
| `test/handover-operations.test.mjs` | 14 (22 in all) | all 14 fail | the browser's send chain: the look step's hand-over to the add-on (direct and queued) with its reason, part and page; the climb to the rewrite carrying the parts and the hand-over, and its 402 refusal naming the part; the add-on's climb; a dropped rewrite, an edit refusal and an unreadable answer each naming what was posted; several parts on a success and on a refusal; a malformed `deferred`, `reason` or `field` not trusted; a list surviving a refresh; the router's conversion reaching the add-on with its page and reason |
| `test/handover-route.test.mjs` | 10 (22 in all) | 6 fail; 4 pass (two controls in both money paths, which the old code already met) | the edit route, sync and queued: a missing page's removal refused with the real pages, nothing called, charged or stored, the part named; an escalation naming the part; a part the route cannot find naming nothing; a success naming it; a hand-over checked and recorded |
| `test/edit-op-scope.test.mjs` | 9 (39 in all) | all 9 fail | the whole chain (the routing route, the browser, the edit route): a QR code beside a description (sync and queued), the description stored, no code made, every page kept, the code named; the code alone handed on with its page; the unscoped refusal; the router's part and the step's together; a page addition beside a move; the add-on picker shown the hand-over line and the route recording it; a hand-over checked, never trusted; the add-on refusal naming the part |
| `test/handover-batch2.test.mjs` | 12 (new file) | cannot load (its module is new). Run without it, 4 of its 5 route and source cases fail and the control passes; its other 7 test the new module | the module (what a hand-over may carry, its line, the parts' shapes, the wrapper); the browser's and the module's held-part readings agreeing both ways; every reason a step hands on with on the list and nothing else; the row review's settled reply in every shape; the real rewrite route (the part reaching no model, the writer told why, the designer not, the pages kept, the part named; a part it cannot find refused free; the control); the deadline answer |
| `test/addon-row.test.mjs` | 2 (73 in all) | both fail | through the real queued add-on route, consumer and review: a review that keeps the entry naming both parts the first reply put off, and one that refunds naming the part as left for later; the six existing entries kept |

**Of the 47 new cases, 35 fail on the unfixed code, 7 need the new module,
and 5 pass (the controls).**

**Existing tests changed**, each keeping its property with the reason beside
it:
- **22 existing cases in 14 files fail on `ef158022`** with the branch's
  versions:
  - `add-goes-to-addon`: 2;
  - `edit-poll` and `edit-reply-validation`: 2 each;
  - `site-ask`: 3;
  - `route-decision`: 4;
  - `addon-queue`, `edit-failure`, `handover-operations`, `removal-door`,
    `requirement-coverage`, `site-addon`, `site-apply`, `site-chat` and
    `topbar-layout`: 1 each.
- **Four harnesses** give their `EditPoll` stand-in the real module's held
  readers and pass on both versions.

**Mutation sweeps** (from a verified-green baseline, comment-only controls
all surviving):
- **The contract**: 43 mutants over `hand-over.mjs`, `worker.js`,
  `site-ask.mjs`, `chat.js` and `edit-poll.js`, against the nine files that
  guard it (289 cases). All 43 killed, 3 controls surviving.
- **The row review**: 7 mutants over `site-add.mjs` and the reconcile's call
  in `worker.js`, all killed, including the reconcile handing no reader in.
  The first shape had swept 5 of 5.

**Full suite and CI**:
- **Full suite, locally**: `8813 / 8813 / 0 / 0` on `28690c06`. The base is
  8,766, and the 47 new cases account for the difference.
- **The first push, `391b5bd8`, was red**: unit CI run 37007899348 read
  `8813 / 8808 / 1 / 4`. The add step had imported the router's module for
  the reader, which `site-add.test.mjs`'s separation guard refuses.
  `28690c06` hands the reader in instead.
- **Unit CI on `28690c06`**: run 37008479007, `8813 / 8809 / 0 / 4`, the
  same total as locally; CI skips four.
- **Site build on `28690c06`**: run 37008478966, all 8 jobs green. The
  gate printed *"ALL CHECKS: 404 checks in 27 sections across 4 shards,
  every job green"* at inputs `ecda9a2f406edba4` (3,968 files).

**Screenshots** (the chat's own markup and stylesheet, the real routes'
replies composed by the browser's own code): `docs/edits/router-batch-2-*.png`.
They show:
- the missing page's removal;
- a look change with a QR code put off;
- several parts;
- the unscoped refusal;
- the add-on refusal before and after;
- the row review's three replies.

The record's §3 quotes each.

### 4.4 Your review's gap fixes for batch 2 (2026-10-02)

Every model answer supplied, as in §4.3. The red check ran in a worktree at
`03189a0d` (batch 2 with its records) with the new and changed test files
copied in.

| File | New cases | On `03189a0d` | What it holds |
|---|---|---|---|
| `test/handover-resume.test.mjs` | 9 (new file) | all 9 fail | the record (all or nothing; an older record names none; the bounds are the hand-over's); the real queued rewrite on a finish, a retry and a give-up, through the fire, the resume message, the collector and the poll route, asserting the designer's request and each page-writer job the container was handed, the record before and after the retry, the final answer, the poll, the stored pages and the browser's own last sentence; the poll route's verdict for a lost build (owner only); the queued route's own answer; the browser's precedence (the final answer's own, the 202's, a direct answer with none, a dropped follow, a Stop press, a lost POST) |
| `test/edit-op-scope.test.mjs` | 13 (52 in all) | all 13 fail | the whole chain: two codes on two pages beside a description (sync and queued); a lane's words running on into a code's (sync and queued); a move reaching part-way into a page addition; two codes alone; a change inside an addition; a code and a scene alone on one page; a change inside a page addition; the refusal when nothing is left; two changes joined on one page beside a code; changes wholly inside an addition beside a change of their own (sync and queued) |
| `test/edit-removal-door.test.mjs` | 3 (100 in all) | all 3 fail | a photo removal beside a 3D scene put off (sync and queued): the picture step's request carries the removal and none of the scene, the photo alone comes off, the scene is named; a removal whose words the picker gave wholly to the scene is refused before anything runs |
| `test/handover-batch2.test.mjs` | 1 (13 in all) | cannot load (`wordsLess` is new); its 12 other cases pass there in their base version | `wordsLess`, at its boundaries |

**25 of the 26 fail on `03189a0d`, and the other needs the new export**,
each on its own property. **Four existing cases changed**, each keeping its
property: `site-ask` (the rewrite's take-out, now through `buildHeld`),
`build-jobs` (the poll route's verdict, now two lines), `add-goes-to-addon`
(the escalate's layer) and `edit-parts` (`eRun`, now a `let` with one other
assignment).

**Mutation sweeps** (verified-green baseline, comment-only controls
surviving):
- **The rewrite chain and the browser**: 20 mutants over `build-resume.mjs`,
  `worker.js` and `chat.js`, all killed.
- **The look step**: 25 mutants over `worker.js`, `site-lanes.mjs` and
  `site-ask.mjs`; 23 killed and 2 survived, both equivalent. The removal
  door's own refusal duplicated the take-out's, so it was removed. An
  invalid scope's words are already blank, so `!op.invalid` changes nothing
  today and is kept as a defence (N27). On the final code: 24 mutants, 23
  killed, the same one surviving.

**Full suite, locally: `8839 / 8839 / 0 / 0`** on `129a1757`. The base is
8,813, and the 26 new cases account for the difference.

**CI on `129a1757`**: unit tests run 37017956143, `8839 / 8835 / 0 / 4`, the
same total as locally (CI skips its usual four); site build run
37017956398, all 8 jobs green (each job's own conclusion), the gate printing
*"ALL CHECKS: 404 checks in 27 sections across 4 shards, every job green"*
at inputs `c0ca5ff6e57434fe` (3,968 files, as many as batch 2's).

**Screenshots** (the chat's own markup, the real chain's bodies):
`docs/edits/router-batch-2-review-resume-finish.png` and
`…-giveup.png`. Before, the final reply after a 202 said only *"✅ Updated
the home page."*; now it asks for each part put off, and a give-up names
them as left for later.

### 4.5 The clarification round's checks (W27, 2026-10-02)

- **61 new cases**: `test/live-clarify-contract.test.mjs` (17),
  `test/live-clarify-route.test.mjs` (21, through the real routes,
  synchronously and as queued jobs) and `test/live-clarify-browser.test.mjs`
  (23, the page's real handlers). The history's §6.1 lists each.
- **Red checks**: all three files fail to load on `a8ed6b73`; the free probe
  above shows the live-site question becoming `addon` there; the
  second-question fix's case fails with the fix reverted.
- **21 existing files** re-anchored or widened, each with its reason in the
  file (the history's §6.3).
- **Mutation sweeps**: the server (`builder/clarify.mjs`,
  `builder/site-ask.mjs`, `worker.js`) 40 of 40 killed, 3 comment-only
  controls surviving; the page (`public/chat.js`) 37 of 37 after one new case
  closed the one survivor (a malformed answer settlement), its control
  surviving.
- **Full suite** `8901 / 8901 / 0 / 0` at `4d2f10ed`; **unit CI**
  `8901 / 8897 / 0 / 4` (run 37032417202); **site build** run 37032417218, all 8 jobs green, "404 checks in 27 sections across 4 shards, every job green";
  the image predicted `a4409e55d3f3eb09` → `836ed46c411ade1f` (191 inputs)
  and not built (the history's §9).

## 5. The validation matrix

### 5.1 The sites, as read on 2026-10-02

| Site | Kind | Pages | Database | What matters here |
|---|---|---|---|---|
| `fretwork-1` (Crookes Guitar School) | guitar school | `/`, `/prices`, `/gear` | yes | Welsh pages with French and Spanish versions; two QR codes; a logo |
| `repairbench-1` (Hebden Bike Repair) | bike repair | `/`, `/status`, `/booking-check`, `/workshop-load`, `/rates` | yes | menus differ per page (4, 2, 2, 3, 4 items) |
| `hearth-paper` (Hearth Paper) | shop | `/` | no | an empty photo frame; a "Bulk pricing" section; a drawn mark |
| `hartleys-barbers` (Hartley's Barbers) | barber | `/` | no | English only; no logo image; an empty hero frame; six cuts in the page |
| `oak-and-ash` (Oak & Ash) | furniture maker | `/`, `/make`, `/work`, `/workshop` | no | "Ring the workshop" is a heading on `/` and the header button everywhere |
| `ben-crowe-guitar` (Ben Crowe Guitar) | guitar teacher | `/` | no | one page, no photographs |
| `markbook-1` (Markbook) | mark sheet | `/` | no | one page |

The bakery is deliberately absent: 25 of the 26 earlier probes were on it.

### 5.2 Group R: routing only (one press, committed)

`scripts/router-probes/whole-router-1.json` (sha256 `f953ac709d93bb44…`,
which the press prints). Each message is routed once by the real router; nothing is edited, added, built or published. "Intended" is
the outcome the owner's rules and the product's capabilities call for
(blank where there is no ruling: recorded only). "Current implementation" is
what the code does with that answer. **Observed is empty: not run.**

| ID | Site | Message | Intended | Current implementation (from the code) | Observed |
|---|---|---|---|---|---|
| CT1 | fretwork-1 | On the Gear Board page, change the heading to Our gear. | `edit` `text` | the text step (control) | — |
| RM1 | fretwork-1 | We've stopped teaching in Spanish, so take the Spanish version of the site down. | `edit` `look` | French goes too (W2) | — |
| RM2 | fretwork-1 | Take the Scan for prices QR code off the home page but keep the one for ringing us. | `edit` `look` | both codes go (W2) | — |
| RM3 | repairbench-1 | Nobody uses the Workshop Load page, please get rid of it. | `edit` `page` `/workshop-load` `remove` | refused while other menus link to it | — |
| RM4 | hearth-paper | Lose the bulk pricing bit, we only sell single packs now. | `edit` `look` | withheld at the page writer for its wording (W9) | — |
| MX1 | repairbench-1 | On the Rates page, change the heading to What we charge, and add a page about e-bike servicing. | `edit` `text` holding back the page, or `addon` holding back the heading | the held-back part is named only on success (W7) | — |
| MX2 | hartleys-barbers | Give the site an older, more traditional typeface and put a Senior Cut, £20, in with the other cuts. | `edit` `look` holding back the cut, or `addon` holding back the typeface | as MX1 | — |
| MX3 | oak-and-ash | Take the old Commissions page down and add a page for our spoon-carving classes. | (recorded) | a `page` answer for `/commissions` becomes `addon` running only the removal (W5) | — |
| PS1 | oak-and-ash | On the home page only, change the heading Ring the workshop to Call the workshop. | `edit` `text`, or `edit` `page` `/` | a `text` answer carries no page (W12) | — |
| FU1 | ben-crowe-guitar | Same again for the Studio section, please. | (recorded) | no earlier message reaches any step (R7) | — |
| FU2 | hearth-paper | Actually, put it back how it was before. | (recorded) | no step restores a version (R6) | — |
| AT1 | hartleys-barbers | Use the attached photo of the shop for the big picture at the top. *(file attached)* | `edit` `picture` | the photo step never gets the file (W16) | — |
| AT2 | hearth-paper | This is our new logo, can you swap it in? *(file attached)* | `edit` `logo` | the file reaches the logo step (control) | — |
| AT3 | ben-crowe-guitar | Is this photo sharp enough to use on the site? *(file attached)* | `ask` | an `ask` becomes `addon` (W17) | — |
| US1 | markbook-1 | Could you turn this into an app the teachers can download on their phones? | `ask` | at the add-on: "say what you want on the site and where" (W14) | — |
| US2 | repairbench-1 | Text me on my mobile whenever someone books a repair. | (recorded) | no kind sends a text message | — |
| CF1 | hartleys-barbers | Could the site be in Polish as well? Lots of our regulars speak it. | `edit` `look` | the router is told translation is a rewrite (W10) | — |
| CF2 | hartleys-barbers | Forget a logo, just have Hartley's written nicely at the top. | `edit` `look` | a `logo` removal changes nothing here (W11) | — |
| CF3 | fretwork-1 | What does an hour's lesson cost at the moment? Knock £2 off it. | `edit` `data` | the question is dropped (W13) | — |
| LK1 | hearth-paper | Copy the delivery wording from our old site, https://hearthpaper.example/delivery, into the delivery section. | (recorded) | no edit step reads a link (R11) | — |

**The "Current implementation" column is `f9979497`'s, the code deployed
today.** Batch 1 changes two of its rows on the branch, not deployed: RM1
keeps French (W2), and RM2 takes only the prices code and its figure (W2).
No other row's implementation moves. Group R measures only the router's
answer, which batch 1 does not change: the router's instructions and readers
are untouched.

**Batch 2 changes three rows, and one of the router's readers** (on the
branch, not deployed):
- **MX1 and MX2**: the held-back part is named on every outcome, not only on
  success (W7).
- **MX3**: a `page` answer removing `/commissions`, a page `oak-and-ash`
  does not have, now stays an edit. The page step refuses it at no cost for
  the edit, naming the site's real pages and the addition as put off (W5).
  The route's reply, which is what Group R records, therefore reads `edit`
  `page` `/commissions` `remove` where `f9979497` reads `addon`. A plain
  edit of a missing page is still `addon`, now with a `handOver` naming the
  page and the reason.
- **The router's instructions are untouched**: what the model answers is
  the same question as before.

Each probe in the file also records its starting condition (`given`), read
on 2026-10-02, and why its intended outcome is intended (`basis`). A
different answer is a finding, not a failure; the press stops early only
when it cannot read an answer honestly.

**Cost.** Routing only: runs 90 and 91 measured 1–1.5 credits a call (24 for
18; 10 for 8, the first call 3). **About 22–32 credits for the 20.** The
press refuses before its first call when the balance is under 60 (3 a
probe), and checks the deployed commit and image itself.

**The press** (the edit canary's form). The two refuse boxes name what is
deployed today; if batch 1 is merged and deployed first, they take that
deploy's commit and image instead:
- "Use workflow from": the branch `claude/help-needed-ehlwlj` (the batch
  file is on the branch, not on `main`; the canary script is the same as
  `main`'s).
- "Run the ONE paid edit as well (yes/no)":
  ```text
  yes
  ```
- "Refuse to spend unless the Worker reports this deploy sha (prefix, >=7 chars). Blank = read and print only.":
  ```text
  f9979497
  ```
- "Refuse to spend unless a cold container reports this image id (exact). Blank = read and print only.":
  ```text
  a4409e55d3f3eb09
  ```
- "ROUTING-ONLY BATCH: the name of a committed probe list in scripts/router-probes …":
  ```text
  whole-router-1
  ```
- Every other box left as it is (blank, or its default).

### 5.3 Group D: delivered checks (listed, not prepared)

Each is one message through the real app, judged on what it did to the
site. **Not built or pressed.** D1–D3 would damage a live site on the code
deployed today; their fixes are on the branch (batch 1), so they wait for
your merge and deploy, not for more code. D4 needs no live run: the free
route tests cover it (§4.1). The others can follow Group R once its answers
are in.

| # | Message (site) | Measures | When | Estimate | Recovery |
|---|---|---|---|---|---|
| D1 | RM1 (fretwork-1) | only Spanish goes | after batch 1's merge and deploy (W2) | 2–4 | free restore |
| D2 | RM2 (fretwork-1) | only the prices code and its figure go | after batch 1's merge and deploy (W2) | 2–4 | free restore |
| D3 | "Rename Booking Check to Check a booking in the menu." (repairbench-1) | each page keeps its own menu | after batch 1's merge and deploy (W4) | 3–5 | free restore |
| D4 | a photo removal answered `needs-place` | no page is deleted | done free: `handover-operations` and `handover-route` (§4.1); no live run | 0 | — |
| D5 | RM4 (hearth-paper) | the wording refusal end to end (W9) | after Group R, if routed `look` | 1–3 if withheld; 7–25 if it publishes | free restore |
| D6 | FU1 (ben-crowe-guitar) | what a step does with a reference to nothing | after Group R, only if routed to a step that acts | 2–22 | free restore |
| D7 | "Bring back the Group of three lesson at £18, like before." (fretwork-1; run 80 deleted it) | whether the put-back restores the entry's other fields (U4) | after Group R; a row write needs your approval | 3–6 | your free Data panel delete |
| D8 | US1 (markbook-1), if routed `addon` | what the add-on says to an unsupported ask (U3) | after Group R | 1–3 | none (nothing changes) |
| D9 | AT1 (hartleys-barbers) | what the photo step does without the file (U10) | after a fal top-up | about 20–22 (a bought photo is about 19) | free restore |
| D10 | CF1 (hartleys-barbers) | a language added through the look step | after W10's decision | 2–8 | free restore |

**If all of D5–D8 ran after Group R: about 7–34 credits; D1–D3 after batch
1's merge and deploy, about 7–13.** These are estimates, not caps: nothing enforces a
per-request limit, and the balance is the only bound.

### 5.4 The grouped live-validation batch (after one combined deploy)

**Prepared, not pressed.** Your word (2026-10-02): batches 1 and 2 deploy
together, and one grouped live batch validates them. Nothing below runs
until you approve it and press it. **The balance is 137** on the building
account (read at 12:53 UTC on 2026-10-02 and again at 13:02 UTC: the last
ledger row 355 at 06:49 UTC, and no job open).

Each step is the edit canary's form. The exact box values are handed over
after the deploy, when its commit and image are known. The runtime check
comes first. The rollout wait (15–20 minutes after the image roll) applies
before steps 2–7, which run in the container.

| Step | What | Site | Measures | Estimate | Recovery |
|---|---|---|---|---|---|
| 0 | the free runtime check (spend `no`) | — | both readers on the new commit, a cold container on `5fcfae2277e23544` (predicted for `129a1757`) | 0 | — |
| 1 | Group R (§5.2), one routing-only press | seven sites | the router's 20 answers, read by batch 2's reader (MX3 now reads `edit`, §5.2) | about 22–32; the press refuses under 60 | none: nothing is edited |
| 2–4 | D1, D2 and D3 (§5.3), batch 1's delivered checks | `fretwork-1` (×2), `repairbench-1` | only Spanish goes; only the prices code and its figure go; each page keeps its own menu | about 7–13 | a free restore after each |
| 5 | **H1** (W5, W7): *"Take the old Commissions page down and add a page for our spoon-carving classes."* (MX3's message) | `oak-and-ash`, which serves `/`, `/make`, `/work` and `/workshop` | expected route `intent=edit layer=page page=/commissions remove=true`; any other answer stops the press after routing. If it runs: refused at no cost for the edit, the real pages named, the addition named as left for later, nothing stored or published | 1–2 (routing only; the refusal is free) | none |
| 6 | **H2** (W15, W7): *"Make the headings dark green and add a QR code that opens our booking page."* | `hartleys-barbers`, which has no QR code | expected route `intent=edit layer=look`. The headings change, no code is made, and the reply names the QR words as left for later, whether the router held them back or the look step put them off. Every page otherwise byte for byte | 2–5 | a free restore |
| 7 | **H3** (W15 alone; W24's edit half): *"Put a QR code on the home page that opens our booking page."* | `hartleys-barbers` | expected route `intent=edit layer=look`: the look step hands the code to the add-on step with its reason, part and page (`escalate`, `field qr`, `page /`, cost 0). The API press stops at the hand-over, so nothing is added | 1–2 | none |
| 8 | **H4** (your review: several additions kept): *"Make the headings dark green, put a QR code on the home page that opens our workshop page, and put another one on the Make page that opens our work page."* | `oak-and-ash`, whose four served pages carry no QR code (read free at 14:07 UTC) | expected route `intent=edit layer=look`. The headings change, no code is made, and the reply names **both** codes as left for later, in order, whether the router held them back or the look step put them off (the trace's `handover:held` says which). Every page otherwise byte for byte | 2–5 | a free restore |

**About 35–59 credits in all.** These are estimates, not caps: nothing
enforces a per-request limit, and the balance is the only bound. Each
delivered step's site is read free before its press, so the starting state
it is judged against is recorded, not assumed.

**What this batch cannot show**:
- **The add-on step's use of the hand-over line** (W24's add-on half) needs
  the browser to follow the hand-over, which the API press does not do. A
  press in the canary's browser mode could, for about 2–13 more and a free
  restore after.
- **The climb to the full rewrite with a part put off** (W8) is not
  triggered by any natural message we can choose, and with it the
  background rewrite's 202 → resume → final answer (your review's first
  gap). Both stay shown with supplied answers only.
- **What each step's model was handed**: a press reads the reply, the
  stored pages, the publish and the trace. Which words each lane, writer or
  picture step was given (your review's third gap) is shown with supplied
  answers only.
- **How often each answer happens**: one sample per message, from one model.

## 6. What this audit does not show

- What any real model answers: every routing outcome in §5 is a prediction
  until Group R runs, and Group R gives one answer per message, from one
  model.
- How often W1's and W3's reach happens; W1 needs the photo step to answer
  `needs-place` for a removal, W3 a writer that leaves pages out. Since batch
  1 neither does harm when it happens (§3.10's U6 and U7), and N10 is what is
  left of W3.
- Anything about the customer's screen beyond the reply text the code
  composes. Batch 1 changes two sentences the customer reads (the menu reply
  and the kept-page note), shown as rendered by the chat in the batch's
  record (`docs/history/2026-10-02-router-batch-1.md`). Batch 2 adds the
  sentence naming what was put off on every ending, the wording for several
  parts, and the refusal for an addition whose words cannot be separated,
  each rendered in its record (`docs/history/2026-10-02-router-batch-2.md`).
- The build path's own quality issues met on the way (link quotas, design
  checks): out of scope for an audit of who decides.
- **W1–W4: fixed on the branch, shown only with supplied answers.** Each has
  its own tests, red check and sweep (§4.1); none is merged, deployed or
  exercised by a real model. What each fix does not cover is under its own
  finding and in N1–N10 (§3.0).
- **W5, W7, W8, W15 and W24: fixed on the branch (batch 2), shown only with
  supplied answers.** Each has its tests, red check and sweep (§4.3), none
  is merged, deployed or exercised by a real model, and what each does not
  cover is under its own finding and in N14–N21 (§3.0). **Your review's
  three gaps** are fixed the same way (§4.4), with what they leave in
  N22–N27.
- **W27 (questions back on a site that exists): done on the branch, shown
  only with supplied answers.** Its tests, red checks and sweeps are §4.5;
  it is not merged, deployed or exercised by a real model, and what it does
  not cover is N28–N40 (§3.0).
- **W6, W9–W14, W16–W23, W25 and W26: proposals only.** Each will need its
  own red check, sweep, suite and review before any merge.
