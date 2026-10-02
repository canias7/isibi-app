# Router audit (2026-10-02)

**Free analysis only.** Nothing was spent, sent to a model, merged, or
changed on any site. The code was read on `main` at `25faac78` (deploy 2177,
runtime-confirmed by run 87). The branch adds documents only, so its code is
the same. Balance 96 after run 88.

**The owner's order (2026-10-01):** *"Once that result is verified, our next
priority is a router audit before resuming any broader tests. Audit the
routing instructions, supplied context, route selection, fallback behavior,
mixed requests, page scope, follow-ups and attachments. Explain the actual
decision flow and identify contradictions or gaps, then propose a focused
batch of real-model routing tests with a cost estimate. Keep the broad plan
and batch-runner work paused."* Test 11's retry was verified as run 88 before
this audit started.

Line numbers are for `builder/site-ask.mjs` unless another file is named.

## In short

- **One model call decides every message on a live site.** It answers `ask`,
  `edit` (naming one of nine steps), or `addon`, and it can hold back part of
  the message. It sees the message, the site's page addresses and its table
  names. It sees nothing else: no earlier message, no attachment, and nothing
  about what each page shows.
- **Six problems a customer would notice**, most serious first. Each is shown
  from the code. Items marked *needs a reading* depend on what the real model
  answers, which the proposed batch measures.
  1. **"Add …" to the menu, the footer or the header button.** Since the
     add-on rule was strengthened for Test 11, two instructions contradict each
     other here (*needs a reading*). The add-on step has no kind for these
     things, and its picker must still name one. So a misroute would design a
     new section on a page instead of adding the link, charge for it, and
     report it as done.
  2. **Attachments.** The router is told to choose between the logo step and
     the photo step by whether a file is attached, but it is never told
     whether one is. After routing, only the logo step receives the file. So
     "use this photo on the starter page" reaches the photo step without the
     photo. That step can only use a file already uploaded to the site, or buy
     a generated photograph. Nothing tells the customer.
  3. **Fallbacks are silent.** Seven kinds of unusable answer quietly become a
     paid `addon`, and the route's reply cannot tell them apart from the
     model's own choice. Our tests have the same blind spot: run 88's `addon`
     was very likely the model's own answer, but the reply cannot prove it.
  4. **A removal can become an add-on.** "Remove the blog page" on a site with
     no blog page is turned into `addon` by the code. That contradicts the
     instruction "A REMOVAL IS NEVER AN ADDON" (*needs a reading* for how
     often the model names a page the site doesn't have).
  5. **Vague requests and references have nowhere honest to go.** A live site
     cannot ask a question back. The rule "when you cannot tell, answer addon:
     it can do everything an edit can" is false. And the router never sees the
     previous message. So "make it better", "do the same on the Visit page"
     and "undo that" go to a paid step that must design something (*needs a
     reading*).
  6. **Undo is promised but can't be routed.** The router is told "every one
     can be undone by saying so", but no step undoes a change. And "put it
     back" after a deletion now meets the new-entry rule, which sends it to the
     add-on step.
- **Smaller gaps**:
  - limits the router isn't told: four kinds of change per look message,
    24 pages and 24 tables, and a new entry must come in its own message;
  - which pages show what, which the router can't see;
  - a zero balance, which turns every message on a live site into a rebuild
    attempt;
  - a capability list that describes builds, not edits;
  - some stale comments.
- **The proposal**: 14 single-message routing probes, with 4 optional ones.
  The real router routes each probe once, and **nothing it answers is acted
  on**.
  - Cost: about 2–3 credits a probe, so **28–42 for the 14 and 36–54 for all
    18**.
  - It needs two things built first, both free to build and both waiting for
    your word:
    - a route-only mode in the canary (scripts only, no deploy);
    - a field on the route's reply saying whether an answer is the model's
      own (needs a merge and a deploy with an image roll).

## 1. How a message is actually routed

1. **The browser** (`public/chat.js` `siteRoute`, 9031–9178).
   - It builds a digest of the site: its name, its address, up to 24 page
     addresses and up to 24 table names (9074–9079).
   - It posts the message to `/api/site/route` with that digest (9117). Also
     in the post:
     - the picked model;
     - for a first build, the brief and the earlier questions;
     - whether the message answers a question card;
     - **a yes/no for "a file is attached"**;
     - the slug, and whether a site exists.
   - **No earlier message is sent.**
2. **The route** (`worker.js` 19949–20126).
   - It reads the balance. **A readable zero answers `build` without asking
     the model** (19978–19985).
   - It fills in the site's table names for the verified owner when the
     browser sent none (Lane 1d, 19986–19989).
   - It calls the router (19991–20046) and charges routing on what the call
     really used.
   - It replies (20059–20125) with:
     - `intent`, and the `answer` for `ask`;
     - for `edit`: `layer`, `page`, `remove`, `rename` and `tab`;
     - `alsoAsked`, `question`, `cost`, `usage`, `failed`/`failure` and
       `tablesFilled`.
   - **Nothing in the reply says whether the answer was the model's own.**
3. **The router** (`routeMessage`, 1523–1572).
   - An empty message answers `build` with no model call (1528). The
     composer never sends an empty message.
   - A question back (`clarify`) is possible only on a first build with
     questions left (1534).
   - The request (`askRequest`, 849–897) is the system prompt, the
     `route_message` tool (forced) and **one user message**, which holds, in
     order:
     - "THEIR SITE" (the digest);
     - whether a site exists;
     - on a first build, the question round; otherwise "Questions are
       closed";
     - "THEIR MESSAGE".
   - **The attachment flag is not in the request.**
   - If building or sending the request fails, the router answers `addon` on
     a live site (`build` otherwise), with `failed` and an allow-listed
     `failure` (1552–1567). The browser treats that as a failure (step 6).
4. **Reading the answer** (`readRouting`, 914–1006).
   - `clarify` is kept only when it's allowed and its question can be read
     (938–945).
   - `addon` and `edit` are kept only when a site exists (963–964), each with
     any part held back (`alsoAsked`, 962).
   - `build` is always kept (968).
   - `ask` needs a non-empty answer (974). It is overruled when the message
     answers a question card or carries a file (1004).
   - **Anything else becomes the fallback**: `addon` on a live site, `build`
     otherwise (923, 970).
5. **Reading an edit** (`readEdit`, 1197–1303).
   - An unknown or missing layer becomes `addon` (1198–1199).
   - `look` keeps the page it named (1244–1246).
   - The other layers pass through (1248):
     - `remove` is kept on `page`, `logo`, `picture` and `nav`
       (`REMOVABLE_LAYERS`, 156);
     - `tab` is kept on `logo`.
   - `page` with no page, or with a page not among the (at most 24) addresses
     sent, becomes `addon`, **before `remove` is looked at** (1249–1252).
   - `remove` must be exactly `true` (1215).
   - A new address needs a leading slash, and a removal wins over a move
     (1296–1302).
6. **The browser acts on the answer** (`chat.js` 9118–9177).
   - On a live site, a failed or malformed answer is refused at no further
     cost (`routeActionable` 8992–9009; `lost` 9066–9071; 9122). The customer
     sees *"I couldn't work out what to do with that just now, so nothing on
     your site changed. Send it again in a moment."*, and the message is kept
     for sending again.
   - `clarify` shows the question card.
   - `edit` goes to the edit step (9153).
   - `addon` goes to the add-on step (9159).
   - `ask` shows the answer (9162–9176).
   - **`build` on a live site rebuilds (revises) the whole site** (`go`,
     9047–9051).
7. **What each step is sent.**
   - The edit request carries:
     - the routed fields;
     - the instruction;
     - the held-back part;
     - the picked model;
     - **the last deleted rows, only when the layer is `data`** (9347–9353);
     - **the attachment, only when the layer is `logo`** (9354–9359).
   - The add-on request carries the instruction, the picked model, a retry
     key, the time zone and the held-back part (10006–10007). **It carries no
     attachment and no layer.**
8. **Further down, where a routing answer is checked again.**
   - **The add-on picker** must name at least one of ten kinds (`table`,
     `row`, `function`, `api`, `job`, `page`, `component`, `qr`, `three`,
     `photo`; `builder/site-add.mjs` 454 onward, picker 1273–1308).
     - When it can't tell which kind is meant, it is told to "name the single
       closest one" (1301).
     - A `photo` on its own is handed back to the picture step
       (`builder/site-addon.mjs` 34–35; `chat.js` 10077).
     - A new entry beside other additions is set aside, and the customer is
       asked to send it on its own (`worker.js` 26407, 26436).
   - **The look door** splits a message into at most four kinds of change
     ("lanes"; `builder/site-lanes.mjs` 237, 1424), each with its own page
     and words. A page the site doesn't have, or words that aren't in the
     message, are withheld at no cost (deploy 2166).

## 2. What the router is told, and what it isn't

| Told | Not told |
|---|---|
| The message (up to 2,000 characters, 850) | Any earlier message, reply or result |
| The site's name and address | Whether a file is attached, or what it shows |
| Up to 24 page addresses (789–790) | Which page shows which section, list or photo |
| Up to 24 table names (791–792), filled in by the route when the browser sent none | What the tables hold, or which pages show them |
| Whether a site exists; on a first build, its brief and earlier questions | What the menu, the footer and the header button hold |
| What each step can do, in its instructions | The limits further down: 4 lanes, a new entry on its own, the add-on step's kinds |

## 3. Contradictions and gaps

Each item gives what disagrees (with line numbers), what follows from it, how
it is known (from the code, or needing a reading of the real model), and how
much it matters.

### R1. "Add …" to the menu, the footer, the header button and a page (high; needs a reading)

The add-on rule was strengthened for Test 11 (deploy 2177). Four sentences
now point new things at `addon`:
- "ADDING SOMETHING THE SITE DOES NOT HAVE YET … a section … on a page"
  (238–241);
- "A NEW ENTRY IN A LIST THE SITE ALREADY KEEPS IS AN ADDITION TOO"
  (257–260);
- "ASK IT OF THE THING ITSELF, NEVER OF WHAT IT GOES INTO" (272–277);
- "COST NEVER MAKES A NEW ENTRY AN EDIT" (835–837).

Against them, the layer clauses still use **additions** as their own
examples:
- `nav`: "add our opening hours at the bottom" (503), "add our Instagram",
  "add a Privacy link in the small print" (507–508), "add Contact to the menu"
  (513–514), "add a Call now button at the top" (516);
- `picture`: "putting one in a space that has none … "add a photo to the about
  page"" (485–487), while the add-on clause claims "a photograph on a page that
  does not have one" (239–240);
- `page`: "add a block built from parts the page already has" (527–528),
  while the add-on clause claims a new section.

**What follows if the model obeys the add-on rule over the examples.**
- The add-on step has no kind for the menu, the footer or the header button.
- Its picker can't answer "none": `minItems: 1`, and "name the single closest
  one" (`site-add.mjs` 1288, 1301).
- The closest kind is a `component`: a new section, designed and placed on a
  page, charged (add-ons measured 2–13 credits), and reported as done.

The photo case is absorbed further down: a `photo` on its own is handed to the
picture step, which costs one extra picker call. *Not measured: there has been
no real-model reading of a frame addition since deploy 2177.*

### R2. Attachments (high; from the code)

- **The router is told to decide by attachments.**
  - The logo layer is "nearly always with a picture attached … a picture
    attached to a message about the header … is this and not "picture""
    (495–498).
  - `look` takes the logo "when no file is attached" (404–406).
  - "A message that ATTACHES a picture is never a removal" (661–662).
  - `picture` covers "Use my own photo of the shop instead" (486).
- **It is never told whether a file is attached.** `askRequest` has no such
  input, and its one user message holds only the digest and the text
  (849–897, 895). The flag reaches only `readRouting`, after the model call,
  where it is used to overrule an `ask` (1004).
- **After routing, only the logo step receives the file** (`chat.js`
  9354–9359).
  - The picture step chooses from the site's upload library, or buys a
    generated photograph (`worker.js` 22996–23012). Its code comment puts
    each bought photograph at about 19 credits (23002–23005).
  - The add-on request carries no file (10006–10007).
- **Nothing tells the customer.** The browser's only mentions of a dropped
  attachment are code comments (4342, 9354–9355, 11840, 11853, 11863).
- The system prompt says the builder "accepts attached images and PDFs as
  reference" (803–804). That is true of builds only.

So "Use this photo on the starter page", sent with a photo attached, can end
with a bought photograph or a different upload. And "here's the new header",
sent with a file but without the word "logo", is routed without knowing there
is a file.

### R3. Silent conversions to a paid add-on (high, for customers and for our evidence; from the code)

On a live site, each of these answers becomes `addon`, which the browser runs
as a paid add-on:

| The model's answer | Where |
|---|---|
| `edit` with no layer, or a layer not among the nine | `readEdit` 1198–1199 |
| `edit` · `page` with no page | 1250 |
| `edit` · `page` naming a page that isn't among the addresses sent | 1252 |
| `ask` with an empty answer | 974 |
| `ask` while answering a question card, or with a file attached | 1004 |
| `clarify` on a live site | 938–945, then 970 |
| any other intent, or no tool call at all | 970 |

Nothing in the route's reply says a conversion happened (20059–20125).
That has three consequences:
- **A customer can pay for an add-on the model never chose**, and the add-on
  step must then design something.
- **A route check can't tell a conversion from a real answer.** The canary's
  expected-route check passes either way. For Test 11's sentence, the
  realistic wrong answer (`edit` · `data`, as in run 86) passes through
  unchanged and would have shown. A conversion needs an unusual answer (no
  layer, a `page` answer naming a missing page, a `clarify`). So run 88's
  `addon` was very likely the model's own, but its reply alone can't prove
  it.
- **A routing test that expects `addon` is only sound once the reply says
  which it was** (prerequisite (a), §5).

The comment above `readRouting` still says "WHEN THE ROUTER CANNOT DECIDE,
BUILD" (899–913). On a live site the fallback is `addon` (117, 923).

### R4. A removal can become an add-on (medium; needs a reading)

- The instructions say "A REMOVAL IS NEVER AN ADDON" (288–290) and "TAKING A
  WHOLE PAGE OFF THE SITE IS AN EDIT" (228–230).
- But the `page` field says "If the change is about a page that is not in that
  list, the site does not have it yet and the intent is "addon"" (629–631).
- `readEdit` turns `page` with an unknown page into `addon` **before reading
  `remove`** (1249–1252). Its own comment says removal "only applies to a
  page that really exists, and everything else is an ordinary page edit"
  (1268–1269). The code makes it an add-on, not an ordinary edit.
- So "remove the blog page" on a site without one reaches the add-on step,
  which can't decline (R1). The right outcome is an honest "you don't have a
  blog page" (`ask`), costing only the routing.
- The same happens to a page beyond the 24th address (R8).

### R5. "When you cannot tell" (medium; needs a reading)

- The instructions say "WHEN YOU CANNOT TELL, ANSWER "addon" — it can do
  everything an edit can EXCEPT take something away" (287). That isn't true.
  The add-on step adds things of ten kinds. It doesn't change words, colours,
  the menu, entries or rules: its picker is told to "Name what this message
  is asking to ADD" (`site-add.mjs` 1282, 1310–1313).
- A live site can't ask a question back. `clarify` is "Never on a change to a
  site that already exists" (221), and `readRouting` allows it only on a
  first build (938).
- `ask` is for messages that don't describe a change (210).
- So a vague change ("make it better", "fix the prices") has no honest answer
  except `addon`, which must design something and charge for it.

### R6. Undo (medium; from the code)

- The instructions say "Every change is archived and every one can be undone
  by saying so" (216), and the comment above `readRouting` says the same
  (904).
- There is no undo step: no layer or intent restores a version. Restoring a
  saved version is a separate feature (`POST /api/site/<slug>/versions/restore`,
  which the free restores in our tests used), not something a chat message
  reaches.
- "Put it back" after an entry was deleted now meets the new-entry rule: the
  entry doesn't exist, so it is `addon` (257–260).
- The data step was given the deleted rows for exactly this case (`recent`,
  `chat.js` 9347–9353), but only when the layer is `data`.
- So the rule written for Test 11 and the data step's undo now point
  different ways.

### R7. No conversation (medium; from the code)

- Each message is routed on its own. The route's request body carries no
  earlier message (9117), and the router's request is one user message (895).
- Only three things carry over:
  - a first build's question round (the brief and the answers);
  - a part held back (the customer sends it again);
  - the data step's last deleted rows.
- So "make that one £3.50", "do the same on the Visit page" and "no, the
  other one" are routed and acted on with nothing to say what "that one",
  "the same" or "the other one" means.
- Test 9 (closed) showed a self-contained second message after a failure.
  Nothing has tested a message that refers back.

### R8. Limits the router isn't told (low to medium; from the code)

- **The look door takes at most four kinds of change per message.**
  - The cap is in `site-lanes.mjs` (237), in the picker's `maxItems` (1083,
    1177, 1283, 1293), and in `laneList`, which stops at four (1424).
  - The router is told `look` can make every change it lists (`alsoAsked`,
    312–320; the whole-message rule, 609–614).
  - I found no code that tells the customer a fifth kind of change was left
    out. This isn't confirmed end to end.
- **The footer isn't on the look door.**
  - The door's lanes are `css`, `theme`, `brand`, `description`, `wordmark`,
    `favicon`, `lang`, `langs`, `behavior`, `qr`, `components`, `shape`,
    `images`, `action` (the menu and the header button), `three`, `tsx` and
    `slug` (475–803).
  - The footer's details and links belong to the `nav` step.
  - `alsoAsked`'s list of what `look` reaches names "the menu and the
    button" but not the footer (316). So a colour change plus a footer
    change should be split between two answers. Whether the model does that
    needs a reading (probe C2).
- **24 pages and 24 tables.**
  - The browser sends at most 24 of each (`chat.js` 9077–9078), and the
    digest keeps 24 (789–792).
  - `readEdit` checks a page against the same 24 (1543, 1251–1252).
  - On a larger site, the router doesn't know a page beyond the 24th, and a
    page edit there becomes an add-on.
- **A new entry must come on its own** in the add-on step. A new entry beside
  other additions is set aside, and the customer is asked to send it alone
  (`worker.js` 26407, 26436). The customer is told; nothing is silent.

### R9. Page scope (low to medium; partly needs a reading)

- The router knows page addresses only (782–795). It doesn't know which pages
  show the loaves, a photo or a band.
- It is still asked to judge "every page each one is on" (609–614) and which
  pages a sort covers (392–399, 540–544), from the customer's words alone.
- The same mistake is treated two ways:
  - on `look`, an unknown page is kept and refused further down at no cost
    (1244–1246; deploy 2166's `page/no-page`);
  - on `page`, it becomes an add-on (1252).

### R10. A zero balance on a live site (low; from the code)

- A readable zero answers `build` without asking the model (`worker.js`
  19978–19985).
- On a live site, the browser runs a whole-site rebuild for that answer
  (9162 → 9047–9051), which the rebuild's own credit check then refuses.
- So at zero, every message gets a refusal about rebuilding instead of an
  answer about what was asked. That includes a question, and changes that
  cost nothing (a page move, a logo removal).

### R11. The capability list describes builds (low; from the code)

- The system prompt says the builder "can read a link the customer pastes …
  can search the web … accepts attached images and PDFs as reference"
  (801–804).
- Links and web search are read only when a site is built (`worker.js` 14960
  and 15573, both in the build route). On edits, attachments reach only the
  logo step (R2).
- So an `ask` answer can tell the owner of a live site that an edit can do
  these things.

### R12. A written price and a stored price (low; already seen live)

- `text` takes "a price written on the page" (401), and `data` takes a price
  stored in a list (341–344).
- The router can tell them apart only by the table names.
- Batch 1's B2 (run 74) answered `text` for a stored price, before the route
  filled in table names (Lane 1d, deploy 2171). Run 77 answered `data` once
  the names were supplied. That is one sample each.

### R13. Overlapping removal instructions (low)

- `picture` and `nav` take `remove` (663–665), while `look` says "TAKING
  SOMETHING OFF THE SITE IS THIS LAYER, whatever the something is" (432–436).
- Both reach working removal paths (the lane door), so the overlap costs at
  most a different route to the same result.

### R14. Stale comments (no effect on customers; the model never sees them)

- "The three things an edit can be" (121): there are nine layers.
- "names exactly these two" (154): `REMOVABLE_LAYERS` has four.
- "WHEN THE ROUTER CANNOT DECIDE, BUILD" (899–913): on a live site, the
  fallback is `addon`.

## 4. Already shown live, so not to be tested again

| What | Run |
|---|---|
| Several changes, of one kind or more, across pages, as one `look` answer with nothing held back | 66 (Test 8) |
| A part held back, and the customer asked to send it next | 63 (old wording) |
| A stored price changed → `data` | 71, 77 |
| A stored entry taken off → `data` | 77 (routing), 80 (the deletion) |
| A new entry → `addon` | 88 (Test 11) |
| A whole page removed → `page` + `remove` | 49, 72 |
| A wrong route refused by the canary before any edit | 74 |

## 5. The proposed routing test

### What it is

- Each probe is one message, routed once by the real router through the real
  `/api/site/route`, exactly as the browser posts it.
- **Nothing is acted on**: no edit or add-on is posted, and no site or data
  changes.
- Each answer is saved and compared with its expected answer. A different
  answer is a finding, not a failure of the batch.

### Two things to build first (free to build; both need your word)

- **(a) The route's reply says whether its answer is the model's own.**
  - One allow-listed field on the reply: `chosen: "model"`, or
    `chosen: "fallback"` with a reason from a fixed list (the rows of R3's
    table).
  - It carries no message text, shows nothing to the customer, and changes
    nothing that runs.
  - Without it, every `addon` reading might be a conversion (R3).
  - `worker.js` and `builder/site-ask.mjs` are container-image inputs. So
    this needs a merge and a deploy with an image roll, then one free
    runtime press.
- **(b) A route-only mode in the edit canary.**
  - A new form box takes the list of probes.
  - With the box filled, the canary signs in and routes each probe with the
    site's real page list, the site's name as the browser sends it, and the
    `attached` flag as given.
  - It saves every answer (`routing-probes.json`) and prints a table against
    the expectations.
  - It **never posts an edit or an add-on**.
  - Spend must be `yes`, because routing is charged.
  - At most 20 probes per press.
  - It changes only `scripts/` and the canary workflow, so it needs no deploy
    and can be pressed from the branch once you've reviewed it.
  - It is tested against the in-process stub, as before.

Without (b), each probe needs its own press, and a probe whose route matches
its expectation goes on to post the paid edit.

### The probes

The probes run on two sites:
- `fold-lane-bakery`, the bakery ("Harbour Loaf").
  - Pages: `/`, `/starter`, `/visit`, `/gallery`, `/order`.
  - Table: `loaves`.
  - The menu lists Today's bake, The starter, Visit and Gallery, but not
    Order.
- `fretwork-1`, for one probe. Its table is `lessons`; run 80 deleted the
  "Group of three" entry.

**Core (14)**

| # | Site | Message | Expected | What it tells us |
|---|---|---|---|---|
| P0 | bakery | `Make the Country White £4.90.` | `edit` · `data` | Control: a known answer, read correctly by the new mode |
| A1 | bakery | `Add our Instagram to the footer: @harbourloaf.` | `edit` · `nav` | R1: an addition to the footer |
| A2 | bakery | `Add Order to the menu.` | `edit` · `nav` | R1: an addition to the menu (the page exists) |
| A3 | bakery | `Add a Call us button at the top that rings 0117 496 0000.` | `edit` · `nav` | R1: the header button |
| A4 | bakery | `On the Visit page, add a line saying we're closed on bank holidays.` | recorded; no clause decides it (`addon` would design a section; `page` · `/visit`; `text`) | A small addition to a page, which no clause names |
| B1 | bakery | `We've started baking a Seeded Spelt, £4.80. Put it on the list.` | `addon`, nothing held back | The new-entry rule without the word "add" |
| B2 | fretwork-1 | `Put the Group of three back on the price list, at £18.` | `addon`, by the instructions as written | R6: a put-back after a deletion |
| C1 | bakery | `Make the Country White £4.90 and add a Seeded Spelt at £4.80.` | one answer, with the other part held back word for word: `edit` · `data` holding the addition, or `addon` holding the price change | A change plus an addition, which no single answer can make |
| C2 | bakery | `Make the headings dark green and add our Instagram to the footer.` | one answer, with the other part held back: `edit` · `look` holding the footer, or `edit` · `nav` holding the colour | R8: the footer isn't on the look door |
| D1 | bakery | `Remove the blog page.` | `ask` (there is no blog page); never `addon` | R4 |
| D2 | bakery | `Make the Gallery page's background warmer and the Visit page's background cooler.` | `edit` · `look`, no page named, nothing held back | The whole-message rule by targets: two pages, one kind |
| E1 | bakery | `Make it better.` | recorded (the instructions say `addon`) | R5 |
| E2 | bakery | `Undo the last change.` | recorded (no step can undo) | R6 |
| G1 | bakery | `Do the same on the Visit page.` | recorded (ideally `ask`: there is nothing to refer to) | R7 |

**Optional (4)**

| # | Site | Message | Expected | What it tells us |
|---|---|---|---|---|
| A5 | bakery | `Add a photo of our sourdough to the Visit page.` | `edit` · `picture` or `addon` (the instructions allow both, and both end on the picture step) | R1's photo case |
| F1 | bakery, file attached | `Use this photo on the starter page instead of the current one.` | `edit` · `picture` | R2: the route an attached photo takes (that the picture step never receives the file is already shown by the code) |
| G2 | bakery | `Make that one £3.50 instead.` | recorded | R7: "that one" with nothing before it |
| B3 | bakery | `Take the Walnut Levain off the list.` | `edit` · `data` | Control for taking an entry off |

### Cost (estimates, not limits)

- Routing has cost 2–3 credits a message in recent runs (2 in most, 3 in
  run 88).
- **The core 14: about 28–42. All 18: about 36–54.**
- The balance is 96. Nothing else is charged, because no edit, add-on or
  publish runs.
- Building (a) and (b) costs nothing. The deploy for (a) is free, and so is
  its one runtime press.

### What it won't show

- **One answer per message.** The same message can be answered differently
  on another call. A probe that disagrees with its expectation should be
  repeated before any fix is built on it. That would be a second, smaller
  round, estimated after the first.
- **Routing only.** It doesn't show what each step then does, except where
  the code already shows the consequence (R1–R4 say so).
- **One model**: the default picker, as a customer with the default model
  gets. And two sites.

### After the readings: decisions that are yours

These findings are recorded here. None is in the backlog yet, and none is
being fixed. Which to pursue is your decision once the readings are in. The
questions the readings will inform:
- Should additions to the menu, the footer and the header button be stated to
  go to `nav`, since the add-on step has no kind for them?
- Where should a small addition to a page go (a sentence, a line)?
- Should a put-back after a deletion use the data step's undo, or be treated
  as a new entry?
- Should a vague request, or one that refers back, on a live site get an
  honest question back at no charge, instead of the add-on step?
- Undo: an honest reply, or a route that restores a saved version?
- Attachments:
  - should the router be told a file is attached?
  - should the customer be told when an attachment can't be used?
  - should the picture step use an attached photo?
