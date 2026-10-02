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

## In short

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
    conversion now also swaps the halves of a mixed message (W5);
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
  6. **Parts of a message are lost without a word** (W7, W8, W15): the
     held-back part is mentioned only on success, a climb to the full
     rewrite runs it anyway, and the look step's hand-over drops its own
     changes.
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
  on a first build; an `ask` while answering a question card or with a file
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
| `write_table_rules` | `site-rules.mjs` 86 | rules | a table's rules | not traced |
| `choose_pictures` | `site-picture.mjs` 732 | picture | which photo, which frame | no frame on the named page → hop to the page step (`needs-place`) |
| `write_nav` | `site-nav.mjs` 414 | nav | the menu, the button, the footer | not traced |
| `write_tweak` | `site-tweak.mjs` 104 | page; look's section and layout lanes | one page's new source | the keep check, then the text guard |
| `keep_check` | `page-keep.mjs` 391 | the page writer's result | whether each lost item was asked for, with a quote | withheld |
| `new_address` | `site-alias.mjs` 239 | rename | the new address | not traced |
| `pick_adds` | `site-add.mjs` 1382 | add-on | which kinds (at least one) | not traced |
| `add_to_site` | `site-add.mjs` 1565 | add-on, once per kind | the addition | every kind declined → a refusal, no charge for the add-on |
| `write_rows` | `site-seed.mjs` 117 | builds; the add-on, for a new table | starter rows a table lacks | no rows (the list stays empty) |
| `design_schema` | `worker.js` 2841 | build, rewrite | the design | not traced |
| `write_pages` | `page-gen.mjs` 1643 | build, rewrite, the add-on's page kind | pages | a page that doesn't compile is refused |
| `write_band` / `write_part` | `page-bands.mjs` 286, 445 | build and rewrite (split, the building account) | page parts | not traced |
| `write_translation` | `site-translate.mjs` 69 | publish | translated copy | not traced |
| `web_search` | `worker.js` 4559 | build | current facts | not traced |

"Not traced" means this audit didn't follow that branch; none of them
decides between steps.

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
| `site-ask.mjs` 1155 | `clarify` only on a first build | permission | legitimate |
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

**W7. The held-back part is named only when the turn succeeds.** *Confirmed
(code).*
- **Where**: `alsoTail` is added at `chat.js` 9639 and 10245 only.
- **Expected**: whatever happens to the part that ran, the customer is told
  what was put off.
- **Actual**: a refusal, an explanation or a failure says nothing about it.
- **Impact**: part of a request disappears without a word.
- **Fix**: add the held-back sentence to every final outcome.

**W8. A climb to the full rewrite runs the held-back part too.** *Confirmed
(code).*
- **Where**: `go()` sends the whole message (`chat.js` 9047–9051); the
  rewrite's body has no held-back part (11471–11472).
- **Expected**: the rewrite does only what the edit was doing.
- **Actual**: it gets the whole message, including what the router put off.
- **Impact**: the put-off part is done in the costliest step, by a writer
  that rewrites every page; the customer was told it would wait.
- **Fix**: send the held-back text with the rewrite and take it out, as the
  edit and add-on routes do.

**W13. A question beside a change goes unanswered.** *Confirmed (code).*
- **Where**: the system text's ordered rules (857–903); one intent per
  answer; `answer` is shown only for `ask`.
- **Expected**: "What does an hour's lesson cost? Knock £2 off it." answers
  the question and makes the change, or says it can't do both.
- **Actual**: the change runs; the question is dropped. Low impact.
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
- **Fix**: run the other picked lanes first and hand only the addition on,
  as a held-back part. The router should have held it back; this is the net
  when it doesn't.

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

**W6. Pages the browser didn't keep are unknown to the router.** *Confirmed
(code); corrects R8.*
- **Where**: `chat.js` 4565 (`pages: s.pages.slice(0, 6)`), 4792 (no refresh
  when the stored list has more than one page), 9077 (the router gets
  `sitePages(site)`); the route fills in table names but not pages.
- **Expected**: the router sees every page the site has.
- **Actual**: after a reload, a site with seven or more pages sends six; a
  page added or removed on another device or by our canary is never
  learnt. A `page` answer for a page not sent becomes `addon` (W5, R4).
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
- **Fix**: point translation at `look` (the languages the site is offered
  in), and keep "declared language" as the separate fact it is.

**W11. Router instructions that disagree with each other or with the
product.** *Confirmed (code).*
- **The name instead of a logo**: `look` takes "just use our name as the
  logo" (432); `logo` takes "just the name is fine" as a removal (527, 707).
  The same wish, two steps, two results; on a site with no logo the removal
  changes nothing (probe CF2).
- **Undo**: "Every change is archived and every one can be undone by saying
  so" (216), while "Rebuilding … whatever the owner had is gone" (903), and
  no step undoes anything (R6).
- **What the builder can do** (861–868): "its own Postgres database" (only
  when tables are declared), "read a link", "search the web", "attached
  images and PDFs as reference" — builds only (R11).
- **"When you cannot tell, answer addon — it can do everything an edit can
  except take something away"** (310): the add-on adds; it doesn't change
  words, colours, menus or entries (R5).
- **The tab icon**: `look` draws one ("make the tab icon a scissors", 430);
  `logo` with `tab` takes an attached one (717–722) — the router is never
  told whether a file is attached (W16).
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
- **Fix**: tell the router a file is attached, pass files to the photo step
  and the add-on's photo kind, and say plainly when a file wasn't used.

**W17. A question sent with a file becomes a paid add-on, even when the
file couldn't be read.** *Confirmed (code).*
- **Where**: `site-ask.mjs` 1250–1253 (`ask` + `attached` → fallback, which is
  `addon` on a live site); `chat.js` 4421–4465 (a file too large or
  unreadable is kept in the strip as a placeholder, so `attached` is true).
- **Expected**: "Is this photo sharp enough to use?" gets an answer.
- **Actual**: an add-on starts; its picker must name a kind (W14).
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
- **Fix**: let the picker answer "nothing here", and show the unsupported
  note on a refusal.

**W19. The behaviour lane charges and reports success, but changes nothing
a visitor sees.** *Confirmed (code; its own comment).*
- **Where**: `site-lanes.mjs` 651–655 ("because nothing consumes `behavior`
  yet, an edit here republishes a page that looks and behaves identically").
- **Expected**: "make the button open the booking form" changes what it
  does, or says it can't.
- **Actual**: a stored record changes and the reply says it was updated.
- **Fix**: send behaviour requests to the page writer, or refuse them by
  name, until something reads the field.

**W22. At a zero balance, every message on a live site becomes a rebuild
attempt.** *Confirmed (code); R10.*
- **Where**: `worker.js` 19980–19988 → the browser's `go()` → the rewrite's
  credit gate: "A build needs about N credits." (15132–15134).
- **Expected**: a question is answered, and a change is refused with a
  balance message.
- **Actual**: "what are my opening hours?" gets a sentence about a build.
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
- **Impact**: natural wording is refused after a model call; the router's
  own examples use the refused verbs ("drop the testimonials band", "get rid
  of the QR code", 460).
- **Fix (the owner's call: this guard was built on purpose, refuse-only)**:
  confirm structurally instead of by verb — the keep check (a model) names
  the target with a quote, and code checks that what was lost is exactly
  that target's block.

**W23. Wording from the test sites and test sentences sits in the model
prompts.** *Confirmed (code).*
- **The router**: "drop crookes-guitar" (632: `fretwork-1`'s old name);
  "called "Sunset Shoes" and live at shoeroom-1" (629: `shoeroom-1` is
  "Poulson's" today); "remove the chord diagrams" (460: `ben-crowe-guitar`'s
  section); "Put Gallery in the menu" (257: the bakery's page).
- **The add-on and the menu editor**: "add a line saying we're closed on
  bank holidays" (`site-add.mjs` 927, 959: run 90's and 92's A4, almost word
  for word); "add a Call us button too" (`site-nav.mjs` 522: A3); "add our
  Instagram" (546: A1); "another loaf" (`site-add.mjs` 606, 1435); "a
  luthier's bench … half-finished guitar bodies" (1159–1160: `fretwork-1`).
- **What it means**: nothing in code branches on these, but a probe on these
  sites, or with these sentences, partly tests the example rather than the
  rule. Run 92's frame and words passes rest partly on wording the
  downstream prompts contain; 17 of router-audit-1's 18 probes and all 8 of
  addition-fix-1's were on the bakery.
- **Fix**: replace examples drawn from the test sites and test sentences with
  neutral ones, and test on other sites (Group R uses none of the bakery and
  shares no run of five words with the router's prompt).

### 3.9 Smaller confirmed defects

- **W20. Removing custom styling answers "I couldn't work out how to change
  the site's look that way."** `css` is offered as removable
  (`REMOVABLE_LANES`) but is not a field the merge can clear (`EDIT_FIELDS`,
  `site-edit.mjs` 118), so nothing moves and the step explains
  (`look/no-change`, `worker.js` 23755–23790). *Confirmed (code + free
  check).* Fix: strip the rules the request names, or don't offer `css` as
  removable.
- **W21. A replacement with a straight apostrophe or quote is dropped, then
  answered "I couldn't find that wording on your site."** `site-apply.mjs`
  304 drops it silently; with no edit left the step answers `text/no-match`
  (`edit-failure.mjs` 247). "We're open late on Fridays" is dropped; curly
  quotes pass. *Confirmed (code + free check).* Fix: write the words as a
  JSX expression or an escaped string (the step knows which context it is
  in), and never report a refusal as "not found".
- **W24. The edit's hand-over to the add-on carries no reason.** The edit's
  escalation names the field and why (`worker.js` 21911 and others); the
  add-on post carries neither (`chat.js` 10014–10021), so its picker starts
  from the message alone. *Confirmed (code).*
- **W25. A new entry beside a hand-over is refused naming only the entry**
  (`worker.js` 26439–26441; `site-add.mjs` 3416), though its comment says
  both halves are named. *Confirmed (code).*
- **W26. Stale comments** (no effect on customers): two of R14's three
  remain (`site-ask.mjs` 121 and 1112; the third is gone), and 1178 still
  says the held-back part "does not change what gets DONE: it is a note",
  untrue since 2026-09-29. *Confirmed (code).*

### 3.10 Untested behaviour (needs a run)

| # | What | Why it matters | Settled by |
|---|---|---|---|
| U1 | The add-on's new page is linked from one page only (`site-add.mjs` 3526); `repairbench-1`'s per-page menus today are consistent with that | menus disagree across pages | a delivered add-on page |
| U2 | A frame item beside other kinds is set aside, yet the page writer still reads its words (`worker.js` 26443, 27914) | a link added to some pages only | a delivered mixed addition |
| U3 | What the add-on does with removals, changes and unsupported asks converted to it (W5, W14, W17) | refusals or wrong additions | Group D: D8 |
| U4 | Whether a put-back through the add-on restores the entry's other fields (W18) | a different entry comes back | Group D: D7 |
| U5 | Whether the text step keeps to a page named in the message (W12) | the header changes too | Group R: PS1, then a delivered edit |
| U6 | How often the rewrite's writer leaves pages out (W3) | pages lost | the rewrite path, after W3's fix |
| U7 | Whether the photo step answers `needs-place` for a removal (W1) | a page deleted | after W1's fix, free |
| U8 | What the router answers for each Group R message | every downstream finding | Group R |
| U9 | What a step does with a follow-up that refers to nothing (R7) | a paid rewrite of the wrong thing | Group R: FU1, then D6 |
| U10 | What the photo step does without the attached file (W16) | a bought or wrong photo | Group D: D9 (fal has no credits today) |

### 3.11 Legitimate decisions (recorded so they are not mistaken for defects)

- The browser and route: dispatch on the answer; one hop only, to a
  different step; `fromAddon` so the add-on and the menu editor never loop;
  the add-on's climb only for a missing source.
- The readers: `clarify` only on a first build; `remove` and `tab` only
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

## 4. Free checks run this round

All in `docs/investigations/whole-router-checks.mjs` (`node
docs/investigations/whole-router-checks.mjs`), driving the product's own code
with supplied inputs: no model, no network, no site, no money.

| Check | What it drives | Result |
|---|---|---|
| W1 | the browser's `editAnswer` and `EditPoll` (cut from `chat.js` as `scripts/addon-sweep.mjs` cuts them) with a `needs-place` escalation | a routed photo removal re-posts `{"layer":"page","page":"/about","remove":true}`; the control posts no `remove` |
| W2, W20 | `mergeLook` as the look door calls it for a removal | languages `["fr","es"]` → `[]`; two QR codes → none; `css` not cleared |
| W4 | `applyNav` with an edited list, on two pages whose menus differ | the shorter menu gains every item of the longer one. On run 92's real stored bakery pages (scratch, not committed): one rename rewrote all four menus and added Gallery to `/order` and `/visit` |
| W5 | `readRouting` and `heldBack` with a supplied router answer | with `/events` missing from the list: `addon`, `page-unknown`, and the add-on runs the removal and holds back the addition |
| W9 | `preservePageProse` (with its real parser) on one page change, eight wordings | 3 published, 5 withheld |
| W21 | `readTextEdits` with four replacements | the one with a straight apostrophe is dropped |

Also read, free and read-only: every candidate site's served pages and
sitemap (07:20–07:53 UTC: page lists, menus per page, headings, photo
frames, languages, QR codes), run 92's stored bakery pages, and Supabase
(each candidate site belongs to the building account; which have a
database). The new batch file was read with the press's own reader
(`readProbeBatch`: 20 probes, valid), compared with the two completed
batches (no message repeated) and with the router's full request text (no
run of five words shared).

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

Each probe in the file also records its starting condition (`given`), read
on 2026-10-02, and why its intended outcome is intended (`basis`). A
different answer is a finding, not a failure; the press stops early only
when it cannot read an answer honestly.

**Cost.** Routing only: runs 90 and 91 measured 1–1.5 credits a call (24 for
18; 10 for 8, the first call 3). **About 22–32 credits for the 20.** The
press refuses before its first call when the balance is under 60 (3 a
probe), and checks the deployed commit and image itself.

**The press** (the edit canary's form):
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
site. **Not built or pressed.** The ones that would damage a live site today
wait for their fix; the others can follow Group R once its answers are in.

| # | Message (site) | Measures | When | Estimate | Recovery |
|---|---|---|---|---|---|
| D1 | RM1 (fretwork-1) | only Spanish goes | after W2's fix | 2–4 | free restore |
| D2 | RM2 (fretwork-1) | only the prices code goes | after W2's fix | 2–4 | free restore |
| D3 | "Rename Booking Check to Check a booking in the menu." (repairbench-1) | each page keeps its own menu | after W4's fix | 3–5 | free restore |
| D4 | a photo removal answered `needs-place` | no page is deleted | after W1's fix, as a free check first | 0 | — |
| D5 | RM4 (hearth-paper) | the wording refusal end to end (W9) | after Group R, if routed `look` | 1–3 if withheld; 7–25 if it publishes | free restore |
| D6 | FU1 (ben-crowe-guitar) | what a step does with a reference to nothing | after Group R, only if routed to a step that acts | 2–22 | free restore |
| D7 | "Bring back the Group of three lesson at £18, like before." (fretwork-1; run 80 deleted it) | whether the put-back restores the entry's other fields (U4) | after Group R; a row write needs your approval | 3–6 | your free Data panel delete |
| D8 | US1 (markbook-1), if routed `addon` | what the add-on says to an unsupported ask (U3) | after Group R | 1–3 | none (nothing changes) |
| D9 | AT1 (hartleys-barbers) | what the photo step does without the file (U10) | after a fal top-up | about 20–22 (a bought photo is about 19) | free restore |
| D10 | CF1 (hartleys-barbers) | a language added through the look step | after W10's decision | 2–8 | free restore |

**If all of D5–D8 ran after Group R: about 7–34 credits; D1–D3 after their
fixes, about 7–13.** These are estimates, not caps: nothing enforces a
per-request limit, and the balance is the only bound.

## 6. What this audit does not show

- What any real model answers: every routing outcome in §5 is a prediction
  until Group R runs, and Group R gives one answer per message, from one
  model.
- How often W1's and W3's reach happens; W1 needs the photo step to answer
  `needs-place` for a removal, W3 a writer that leaves pages out.
- Anything about the customer's screen beyond the reply text the code
  composes; no UI was rendered (no UI changed).
- The build path's own quality issues met on the way (link quotas, design
  checks): out of scope for an audit of who decides.
- The fixes: proposed only. Each will need its own red check, sweep, suite
  and review before any merge.
