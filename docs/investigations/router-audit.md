# Router audit (2026-10-02)

**Free analysis only.** Nothing was spent, sent to a model, merged, or
changed on any site. The code was read on `main` at `25faac78` (deploy 2177,
runtime-confirmed by run 87), and every line reference below is to that
code. Balance 96 after run 88. The branch now also carries the decision
report and the routing-only batch (§5), built for review and not merged.
Its `site-ask.mjs` is unchanged up to line 788, so a reference past that
line is to `main`'s file, not the branch's.

**Corrected the same day after the owner's review.**
- The expected outcomes now follow the owner's standing policy (below).
- The test matrix keeps intended behaviour, current implementation and
  observed model behaviour in separate columns.
- Every predicted downstream consequence is marked *unverified* until it is
  measured.
- Test 11's saved-row outcome is kept, and separated from proof of the raw
  model's choice.

**The owner's order (2026-10-01):** *"Once that result is verified, our next
priority is a router audit before resuming any broader tests. Audit the
routing instructions, supplied context, route selection, fallback behavior,
mixed requests, page scope, follow-ups and attachments. Explain the actual
decision flow and identify contradictions or gaps, then propose a focused
batch of real-model routing tests with a cost estimate. Keep the broad plan
and batch-runner work paused."* Test 11's retry was verified as run 88 before
this audit started.

**The owner's policy, which every expected outcome here follows
(2026-10-02):** *"all new additions belong to the add-on path, including new
menu links, footer links and header buttons. If add-on cannot perform them,
document the missing capability instead of treating edit as the correct
answer."* It extends two earlier rulings:
- *"add will always go in addon"* (2026-09-02);
- *"Adding a NEW record to an existing table/list must select addon"*
  (Test 11, 2026-10-01).

Line numbers are for `builder/site-ask.mjs` unless another file is named.

## In short

- **One model call decides every message on a live site.** It answers `ask`,
  `edit` (naming one of nine steps), or `addon`, and it can hold back part of
  the message. It sees the message, the site's page addresses and its table
  names. It sees nothing else: no earlier message, no attachment, and nothing
  about what each page shows.
- **Six problems**, most serious first. Each is shown from the code. Items
  marked *needs a reading* depend on what the real model answers, which the
  proposed batch measures. Every consequence further down the pipeline is a
  prediction, *unverified* until measured.
  1. **The router's own instructions contradict the policy for frame
     additions (R1).**
     - Its add-on rule says new things go to `addon`, but its `nav`,
       `picture` and `page` clauses use additions as their own examples ("add
       our Instagram", "add Contact to the menu", "add a Call now button at the
       top", "add a photo to the about page").
     - **And the add-on step can't yet do most of these: a missing
       capability.** It has no kind for a menu link, a footer link or detail,
       or the header button. Today the router's `nav` clause points such
       additions at an edit, which is not the correct answer under the policy.
     - Which instruction the real model follows *needs a reading*.
  2. **Attachments (R2).** The router is told to choose between the logo step
     and the photo step by whether a file is attached, but it is never told
     whether one is. After routing, only the logo step receives the file.
     What happens to a photo attached to "use this on the Visit page instead
     of the current one" is *unverified*. The photo step can only use a file already uploaded or buy
     one, and nothing tells the customer.
  3. **Fallbacks are silent (R3).** Seven kinds of unusable answer quietly
     become a paid `addon`, and the route's reply can't tell them apart from
     the model's own choice. (The decision report built on the branch, §5,
     names them in the reply. It changes no route.)
     - **Test 11 (run 88) proved the saved-row outcome**: exactly one correct
       entry, through the add-on path, nothing else changed.
     - **It did not prove the raw model's choice.** For that sentence the
       realistic wrong answer would have shown, so `addon` was very likely the
       model's own, but only a decision report can show it.
  4. **A removal can become an add-on (R4).** "Remove the blog page" on a
     site with no blog page is turned into `addon` by the code. That
     contradicts the instruction "A REMOVAL IS NEVER AN ADDON" (*needs a
     reading* for how often the model names a page the site doesn't have).
  5. **Vague requests and references have nowhere honest to go (R5, R7).**
     A live site can't ask a question back, "when you cannot tell, answer
     addon" is the rule, and the router never sees the previous message.
     Where "make it better" or "do the same on the Visit page" end up *needs
     a reading*, and what the add-on step then does is *unverified*.
  6. **Undo is promised but can't be routed (R6).** The router is told
     "every one can be undone by saying so", but no step undoes a change.
- **Smaller gaps** (R8–R14):
  - limits the router isn't told: four kinds of change per look message,
    24 pages and 24 tables, and a new entry must come in its own message;
  - which pages show what, which the router can't see;
  - a zero balance, which turns every message on a live site into a rebuild
    attempt;
  - a capability list that describes builds, not edits;
  - some stale comments.
- **The test**: 18 single-message probes in **one batch, one press**.
  - The real router routes each probe once, and nothing it answers is acted
    on.
  - **Cost: about 36–54 credits** (2–3 a probe).
  - The press runs its own runtime checks before the first paid call, so it
    needs no separate free press.
  - Two things are built on the branch for your review, with no merge,
    deploy or spend:
    - **decision-source reporting**: the route's reply says whether its
      answer is the model's own, a fallback, or decided without the model,
      with one of 42 fixed reason codes for every fallback and normalization
      branch;
    - **a routing-only batch mode** in the canary, which cannot post an edit,
      an add-on, a build or a publish.

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

Each item gives:
- what disagrees, with line numbers;
- what follows from it, with consequences further down marked *unverified*
  until measured;
- how it is known: from the code, or needing a reading of the real model;
- how much it matters.

### R1. Frame additions: the router contradicts the policy, and the add-on step lacks the capability (high; needs a reading)

**Intended (your policy):** every new addition goes to the add-on path,
menu links, footer links and header buttons included. Where the add-on step
can't perform one, that is a missing capability, not a reason to call an
edit correct.

**Current implementation: the router's instructions disagree with each
other, and with the policy.**
- Four sentences point new things at `addon`:
  - "ADDING SOMETHING THE SITE DOES NOT HAVE YET … a section … on a page"
    (238–241);
  - "A NEW ENTRY IN A LIST THE SITE ALREADY KEEPS IS AN ADDITION TOO"
    (257–260);
  - "ASK IT OF THE THING ITSELF, NEVER OF WHAT IT GOES INTO" (272–277);
  - "COST NEVER MAKES A NEW ENTRY AN EDIT" (835–837).
- Three layer clauses use **additions** as examples of edits, against the
  policy:
  - `nav`: "add our opening hours at the bottom" (503), "add our Instagram",
    "add a Privacy link in the small print" (507–508), "add Contact to the
    menu" (513–514), "add a Call now button at the top" (516), and "A MENU
    CHANGE IS "nav", NOT THIS AND NOT "addon"" (579);
  - `picture`: "putting one in a space that has none … "add a photo to the
    about page"" (485–487), while the add-on clause claims "a photograph on a
    page that does not have one" (239–240);
  - `page`: "add a block built from parts the page already has" (527–528),
    while the add-on clause claims a new section.
- Only "Add a gallery to the menu" for a page the site doesn't have is
  already `addon` (524–526).

**Missing capabilities in the add-on step** (from its kinds,
`builder/site-add.mjs` 454 onward):

| Addition | Add-on kind today | Status |
|---|---|---|
| A menu link to a page the site has | none | **missing capability** |
| A footer link, social icon or footer detail (phone, email, opening line) | none | **missing capability** |
| The header button | none | **missing capability** |
| One line or sentence on an existing page | none; the nearest is `component`, a whole section | **missing as a small addition**; whether `component` can make one line is *unverified* |
| A photograph on a page | `photo`; on its own it is handed to the picture step (`site-addon.mjs` 34–35) | exists; buying photographs is parked on fal funding |
| A new entry in a stored list | `row` | exists; landed once (run 88) |
| A section, a page, a table, a QR code, a 3D scene | `component`, `page`, `table`, `qr`, `three` | exist |

**What follows (predicted, unverified):**
- If the model follows the `nav` examples, frame additions are routed to an
  edit, the opposite of the policy. The `nav` step's footer and menu editors
  would make them; that isn't measured live for additions.
- If the model follows the add-on rule, the request reaches a step that has
  no kind for it. Its picker can't answer "none" (`minItems: 1`, and "name
  the single closest one", `site-add.mjs` 1288, 1301). The nearest kind is
  `component`: a section designed and placed on a page, charged (add-ons
  measured 2–13 credits), and possibly reported as done.

So aligning the router with the policy, and building the missing add-on
kinds, are two separate changes for your decision. The order matters: routing
frame additions to the add-on step before it can make them would send
customers to a step that can't do the job.

*Not measured: there has been no real-model reading of a frame addition since
deploy 2177.*

### R2. Attachments (high; from the code)

- **The router is told to decide by attachments.**
  - The logo layer is "nearly always with a picture attached … a picture
    attached to a message about the header … is this and not "picture""
    (495–498).
  - `look` takes the logo "when no file is attached" (404–406).
  - "A message that ATTACHES a picture is never a removal" (661–662).
  - `picture` covers "Use my own photo of the shop instead" (486).
- **It is never told whether a file is attached** (from the code).
  `askRequest` has no such input, and its one user message holds only the
  digest and the text (849–897, 895). The flag reaches only `readRouting`,
  after the model call, where it is used to overrule an `ask` (1004).
- **After routing, only the logo step receives the file** (from the code:
  `chat.js` 9354–9359).
  - The picture step chooses from the site's upload library, or buys a
    generated photograph (`worker.js` 22996–23012). Its code comment puts
    each bought photograph at about 19 credits (23002–23005).
  - The add-on request carries no file (10006–10007).
- **Nothing tells the customer** (from the code). The browser's only
  mentions of a dropped attachment are code comments (4342, 9354–9355, 11840,
  11853, 11863).
- The system prompt says the builder "accepts attached images and PDFs as
  reference" (803–804). That is true of builds only.

**What follows (predicted, unverified):**
- "Use this photo on the Visit page instead of the current one", sent with
  a photo attached, could end with a bought photograph or a different upload
  in place of the Visit page's one photograph.
- "Here's the new header", sent with a file but without the word "logo", is
  routed without knowing there is a file.

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

Nothing in the route's reply says a conversion happened (20059–20125). Two
consequences follow:
- **A route check can't tell a conversion from a real answer** (from the
  code). The canary's expected-route check passes either way.
- **A customer can pay for an add-on the model never chose** (predicted,
  unverified). The add-on step must then name some kind.

**Test 11 (run 88): the outcome is proven, the model's choice is not.**
- **Proven**: the saved-row outcome. Exactly one correct entry (`loaves`
  id 7, "Rye & Caraway") was added through the add-on path, the six existing
  rows and every page were unchanged, and the reply was true. That stays
  credited.
- **Not proven**: that the raw model answered `addon` itself. The route
  answered `addon`, but its reply cannot show whether a conversion produced
  it.
  - For that sentence, the realistic wrong answer (`edit` · `data`, run 86's)
    passes through unchanged and would have shown.
  - A conversion would need an unusual answer (no layer, a `page` answer
    naming a missing page, a `clarify`).
  - So `addon` was very likely the model's own. Only the decision report can
    show it.

The comment above `readRouting` still says "WHEN THE ROUTER CANNOT DECIDE,
BUILD" (899–913). On a live site the fallback is `addon` (117, 923).

### R4. A removal can become an add-on (medium; the conversion is from the code, how often it happens needs a reading)

- The instructions say "A REMOVAL IS NEVER AN ADDON" (288–290) and "TAKING A
  WHOLE PAGE OFF THE SITE IS AN EDIT" (228–230).
- But the `page` field says "If the change is about a page that is not in that
  list, the site does not have it yet and the intent is "addon"" (629–631).
- `readEdit` turns `page` with an unknown page into `addon` **before reading
  `remove`** (1249–1252). Its own comment says removal "only applies to a
  page that really exists, and everything else is an ordinary page edit"
  (1268–1269). The code makes it an add-on, not an ordinary edit.
- So "remove the blog page" on a site without one reaches the add-on step
  (from the code). What the add-on step does with it is *unverified*: its
  picker must name some kind.
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
  except `addon`. What the add-on step then makes, and charges, is
  *unverified*.

### R6. Undo (medium; from the code)

- The instructions say "Every change is archived and every one can be undone
  by saying so" (216), and the comment above `readRouting` says the same
  (904).
- There is no undo step: no layer or intent restores a version. Restoring a
  saved version is a separate feature (`POST /api/site/<slug>/versions/restore`,
  which the free restores in our tests used), not something a chat message
  reaches.
- "Put it back" after an entry was deleted is a new row under your policy, so
  it goes to `addon` (257–260).
- The data step was given the deleted rows for exactly this case (`recent`,
  `chat.js` 9347–9353), but only when the layer is `data`. So that
  undo context never reaches the add-on step. Whether a put-back through the
  add-on step restores the entry's other fields (its description, say) is
  *unverified*.

### R7. No conversation (medium; from the code)

- Each message is routed on its own. The route's request body carries no
  earlier message (9117), and the router's request is one user message (895).
- Only three things carry over:
  - a first build's question round (the brief and the answers);
  - a part held back (the customer sends it again);
  - the data step's last deleted rows.
- So "make that one £3.50", "do the same on the Visit page" and "no, the
  other one" are routed with nothing to say what "that one", "the same" or
  "the other one" means. What the steps then do with them is *unverified*.
- Test 9 (closed) showed a self-contained second message after a failure.
  Nothing has tested a message that refers back.

### R8. Limits the router isn't told (low to medium; from the code)

- **The look door takes at most four kinds of change per message.**
  - The cap is in `site-lanes.mjs` (237), in the picker's `maxItems` (1083,
    1177, 1283, 1293), and in `laneList`, which stops at four (1424).
  - The router is told `look` can make every change it lists (`alsoAsked`,
    312–320; the whole-message rule, 609–614).
  - I found no code that tells the customer a fifth kind of change was left
    out. This is *unverified* end to end.
- **The footer isn't on the look door.**
  - The door's lanes are `css`, `theme`, `brand`, `description`, `wordmark`,
    `favicon`, `lang`, `langs`, `behavior`, `qr`, `components`, `shape`,
    `images`, `action` (the menu and the header button), `three`, `tsx` and
    `slug` (475–803).
  - The footer's details and links belong to the `nav` step.
  - `alsoAsked`'s list of what `look` reaches names "the menu and the
    button" but not the footer (316). Whether the model splits a colour
    change from a footer addition needs a reading (probe C2).
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

### R10. A zero balance on a live site (low; the route's answer is from the code, what the customer sees is unverified)

- A readable zero answers `build` without asking the model (`worker.js`
  19978–19985).
- On a live site, the browser runs a whole-site rebuild for that answer
  (9162 → 9047–9051).
- The rebuild's own credit check should then refuse it, so at zero a question
  or a free change (a page move, a logo removal) would get a refusal about
  rebuilding. That is *unverified*.

### R11. The capability list describes builds (low; from the code)

- The system prompt says the builder "can read a link the customer pastes …
  can search the web … accepts attached images and PDFs as reference"
  (801–804).
- Links and web search are read only when a site is built (`worker.js` 14960
  and 15573, both in the build route). On edits, attachments reach only the
  logo step (R2).
- An `ask` answer could therefore tell a live site's owner that an edit can
  do these things. That is *unverified*.

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
| A new entry saved through the add-on path: exactly one correct row (the outcome; the route answered `addon`, and its reply cannot show whether that was the model's own) | 88 (Test 11) |
| A whole page removed → `page` + `remove` | 49, 72 |
| A wrong route refused by the canary before any edit | 74 |

## 5. The proposed routing test

### What it is

- Each probe is one message, routed once by the real router through the real
  `/api/site/route`, exactly as the browser posts it.
- **Nothing is acted on**: no edit, add-on, build or publish is posted, and no
  site or data changes.
- Each answer is saved with its decision source and reasons, and set beside
  the intended outcome. A different answer is a finding, not a failure of the
  batch.

### Built on the branch for review (no merge, deploy or spend)

**(a) Decision-source reporting** (`builder/site-ask.mjs`, `worker.js`).
- The route's reply gains `decision`:
  - `source`: `model` (the model's own intent and layer were used),
    `fallback` (the call failed, or the model's answer could not be used and
    the fallback was given instead), or `rule` (no model was asked);
  - `reasons`: every code that applied, in order, each from one fixed list,
    `ROUTE_REASONS`;
  - `raw`: the model's own intent and layer, read only from their fixed lists
    (`other` for anything else, `none` for nothing). It is present whenever a
    model's reply was read, and absent when a rule decided or the call itself
    failed.
- It is reporting only: every reader returns exactly what it returned before,
  the route answers exactly as before, and the browser reads none of it. No
  message text and no model text is ever in it.
- **The fixed reason codes, one per branch** (42):

  | Kind | What it means for `source` | Codes |
  |---|---|---|
  | `rule` | no model was asked: `rule` | `no-message` (an empty message), `no-credits` (a zero balance, decided in the Worker) |
  | `fallback` | the model's answer was not used: `fallback` | `request-failed`, `send-failed`, `no-tool-call`, `intent-unknown`, `clarify-closed`, `clarify-unreadable`, `work-without-site`, `ask-empty`, `ask-while-answering`, `ask-with-attachment`, `layer-missing`, `layer-unknown`, `page-missing`, `page-unknown` |
  | `changed` | the model's answer was used with a part dropped or rewritten: stays `model` | `page-normalized`, `page-unreadable`, `page-unchecked`, `page-ignored`, `remove-not-true`, `remove-ignored`, `tab-not-true`, `tab-ignored`, `rename-with-remove`, `rename-not-path`, `rename-same-page`, `rename-normalized`, `rename-ignored`, `edit-fields-ignored`, `also-not-text`, `also-too-long`, `also-ignored`, `answer-ignored`, `question-ignored`, `question-clipped`, `options-changed` |
  | `context` | what the model was shown was cut or filled in: stays `model` | `message-cut`, `brief-cut`, `pages-cut`, `tables-cut`, `tables-filled` |

  Every code is reached by the branch that names it in
  `test/route-decision.test.mjs`, and the real route carries the decision.
- `worker.js` and `builder/site-ask.mjs` are container-image inputs, so this
  needs a merge and a deploy with an image roll before a batch can read it.

**(b) The routing-only batch mode** (`scripts/canary-probes.mjs`, wired into
`scripts/edit-canary.mjs` and `edit-canary.yml`).
- **One form box**, *"ROUTING-ONLY BATCH: the name of a committed probe
  list…"*, takes a batch's name. The probes are the committed file
  `scripts/router-probes/router-audit-1.json` (all 18 below), and the press
  prints its sha256.
- **The batch's own runtime check comes before any spending.** A paid press
  must fill the deploy-sha and image boxes. The canary's preflight then
  checks the Worker's commit and the container's image against them, and
  that the two readers agree, and any failure stops the batch at no cost. No
  separate free press is needed.
- **It cannot edit, add, build, publish or restore**:
  - the canary's one request helper asks `assertProbeCall` first, which
    allows the two runtime reads, a site's page list and the routing call,
    and throws on anything else before it is made;
  - `fetch` allows the balance read alone;
  - the mode exits above the free edit checks, so none of the code below it
    runs.
- It reads each site's page list once, before any routing call, and refuses
  below a balance of 3 credits a probe (54 for 18): a floor so the batch is
  never cut short, not a cap.
- Each answer is saved whole with its decision, and set beside its intended
  outcome:
  - *matches* (the model's own answer);
  - *matches only through a fallback or a rule* (never counted as a match);
  - *differs*;
  - *recorded* (no intended outcome set);
  - *failed* (the routing call itself failed).
- It stops early only on a 401, a non-200, or a reply with no readable
  decision (a Worker that does not report it, whose answers it could not
  attribute). That costs at most one routing call.
- **A held-back part is judged by what it holds back** (your review,
  2026-10-02). An intended answer that holds a part back names it (`held`)
  and the part its own route makes (`runs`), both in the probe's own words,
  and the batch refuses an expectation the route could not meet. The
  answer's `alsoAsked` is read with the route's own locator (`heldBack`)
  over the probe's message, so the verdict judges what the route would
  really take out and run. Text the message doesn't contain, the wrong
  clause, part of a clause, more than the other part, or the whole message
  is a difference, never a match.
- **A probe can record its starting condition** (`given`), printed with its
  answer. F1's is the Visit page's one photograph.
- It needs no deploy (scripts and the workflow only).

**Checked on the branch** (the record is
`docs/history/2026-10-02-route-decision.md`):
- **36 new tests**:
  - `test/route-decision.test.mjs` (14): every code reached by the branch
    that names it, through the real readers and `routeMessage`; the readers
    unchanged with and without a trace; the real route carrying the
    decision;
  - `test/canary-probes.test.mjs` (22): the box, the committed batch and
    its policy guard, both walls, and the mode's place in the script. The
    real `scripts/edit-canary.mjs` is driven end to end under an in-process
    stub: a paid press of all 18 probes makes only the allowed requests.
- **The red check**:
  - on the old code, the two new files cannot load, and the two cases in
    `test/route-table-names.test.mjs` with new assertions fail;
  - with the new modules but the old Worker and canary, exactly the 15
    integration tests fail and the 35 module tests pass.
- **A mutation sweep**: 84 changes over the four files.
  - 82 were caught at first.
  - The two it missed are caught by two added cases: a page normalised on
    the look layer's own branch, and an option cut to a button's length
    with the count unchanged.
  - Both comment-only controls survived.
- **The full suite**: `8579 / 8579 / 0 / 0` locally, 36 more than
  `25faac78`'s 8,543.
- **Required CI on `1a8290e7`**, green: unit tests (run 36949313322)
  `8579 / 8575 / 0 / 4`; site build (run 36949313442), 404 checks in 27
  sections, every job green.
- **After your review of the batch** (the history record's §7):
  - the held-back check now judges the part held back, with the route's
    own locator over the probe's message; C1 and C2 name their parts; F1
    is on the Visit page, with its starting condition recorded;
  - 24 tests in `test/canary-probes.test.mjs`, including your two
    reproductions and the corrected case;
  - the red check: the committed batch code fails 7 of them, and the old
    held-back rule alone fails exactly 4;
  - a sweep of 26 mutants: 22 killed at first, and the 4 test gaps it found
    closed (all killed on a re-run), the control surviving;
  - the full suite: `8581 / 8581 / 0 / 0` locally (8,579 and the two new tests);
  - CI on `4866b15b`: unit tests (run 36953647381) `8581 / 8577 / 0 / 4`;
    the site build not re-run, because its inputs fingerprint is the same
    `7c819874b50c4249` as run 36949313442's; the image prediction is
    unchanged.
- **The image**: a merge would roll it from `9a71a6384b4206a2` to
  `a412daac10dbc936` (predicted over both ends, 189 inputs; `worker.js` and
  `site-ask.mjs` differ). The batch's own runtime check reads the new image,
  so it waits 15–20 minutes after the deploy.

### The test matrix

- The probes run on `fold-lane-bakery` ("Harbour Loaf").
  - Pages: `/`, `/starter`, `/visit`, `/gallery`, `/order`.
  - Table: `loaves`.
  - The menu lists Today's bake, The starter, Visit and Gallery, but not
    Order.
- One probe runs on `fretwork-1` (table `lessons`; run 80 deleted the
  "Group of three" entry).
- What the columns mean:
  - **Intended** is what should happen, and its basis: your policy, the
    router's own rule, or not set (yours to decide).
  - **Current implementation** is what the router's instructions and code
    point to, with line numbers. Anything further down the pipeline is a
    prediction, *unverified* unless a run is named.
  - **Observed** is filled from the batch: the answer, its decision source
    and its reasons.

| # | Message | Intended (basis) | Current implementation | Observed |
|---|---|---|---|---|
| P0 | `Make the Country White £4.90.` | `edit` · `data`, nothing held back (router rule: a change to a stored entry) | The data clause (341–344). Next: the data step changes one field (live: runs 71, 77) | — |
| A1 | `Add our Instagram to the footer: @harbourloaf.` | `addon`, nothing held back (your policy). **The add-on step has no kind for a footer link: missing capability** | Conflict: a `nav` example (507) against the add-on rule and tie-break (238–241, 272–277). If `addon`: the picker must name a kind, most likely `component` (*unverified*) | — |
| A2 | `Add Order to the menu.` | `addon`, nothing held back (your policy). **No add-on kind for a menu link: missing capability** | Conflict: "add Contact to the menu" (513–514) and "A MENU CHANGE IS nav" (579) against the add-on rule. If `addon`: the nearest kind is *unverified* | — |
| A3 | `Add a Call us button at the top that rings 0117 496 0000.` | `addon`, nothing held back (your policy). **No add-on kind for the header button: missing capability** | Conflict: "add a Call now button at the top" (516) against the add-on rule | — |
| A4 | `On the Visit page, add a line saying we're closed on bank holidays.` | `addon`, nothing held back (your policy). **No add-on kind for one line on a page**; `component` is a whole section (*unverified* whether it can make one line) | No clause names a small addition. `page` allows "add a block built from parts the page already has" (527–528); `text` changes existing words only (400–402) | — |
| A5 | `Add a photo of our sourdough to the Visit page.` | `addon`, nothing held back (your policy) | Conflict: "add a photo to the about page" is a `picture` example (486–487). If `addon`: a lone `photo` is handed to the picture step (`site-addon.mjs` 34–35); buying is parked on fal funding | — |
| B1 | `We've started baking a Seeded Spelt, £4.80. Put it on the list.` | `addon`, nothing held back (your policy) | The new-entry rule (257–260), without the word "add". If `addon`: the `row` kind (live once: run 88) | — |
| B2 | `Put the Group of three back on the price list, at £18.` (`fretwork-1`) | `addon`, nothing held back (your policy: a re-added entry is a new row) | The new-entry rule. The data step's undo rows reach `data` only (`chat.js` 9347–9353) | — |
| B3 | `Take the Walnut Levain off the list.` | `edit` · `data` (router rule; live: runs 77, 80) | Control | — |
| C1 | `Make the Country White £4.90 and add a Seeded Spelt at £4.80.` | One answer, the other route's part held back: `edit` · `data` holding back "add a Seeded Spelt at £4.80", or `addon` holding back "Make the Country White £4.90" (your policy for the addition; the held-back rule, 321–325). The held-back part is judged with the route's own locator (§5) | `alsoAsked` allows either (321–325) | — |
| C2 | `Make the headings dark green and add our Instagram to the footer.` | One answer, the other route's part held back: `edit` · `look` holding back "add our Instagram to the footer", or `addon` holding back "Make the headings dark green". Not `nav` (your policy). Judged as C1 is | The look door has no footer lane (`site-lanes.mjs` 475–803), and `alsoAsked`'s list omits the footer (316). The `nav` clause claims footer additions (507–508) | — |
| D1 | `Remove the blog page.` (the site has none) | `ask`, saying there's no blog page; never `addon` (router rule, 288–290; `ask` is my reading, for your confirmation) | The `page` field sends an unknown page to `addon` (629–631), and the code converts `page` + an unknown page before reading `remove` (1249–1252) | — |
| D2 | `Make the Gallery page's background warmer and the Visit page's background cooler.` | `edit` · `look`, no page, nothing held back (the whole-message rule by targets, 609–614) | Shown live only for Test 8's mix (run 66). Two pages of one kind not measured | — |
| E1 | `Make it better.` | Not set: yours to decide | "When you cannot tell, answer addon" (287); no question back on a live site (221, 938) | — |
| E2 | `Undo the last change.` | Not set: yours to decide | No step can undo; "every one can be undone by saying so" (216) | — |
| F1 | `Use this photo on the Visit page instead of the current one.` (file attached). **Starting condition**: `/visit` shows exactly one photograph, the counter and morning board (`d5d59152….jpg`, the `SafeImage` in `visit.tsx`), at `01790819484141-dgmag4`: run 88's before-read and a fresh read on 2026-10-02. (It first targeted `/starter`, which shows none.) | `edit` · `picture` (router rule, 485–487: a swap of an existing photo is a change, not an addition) | The router isn't told a file is attached (R2). After routing, the picture step never receives it (from the code: `chat.js` 9354–9359) | — |
| G1 | `Do the same on the Visit page.` | Not set: yours to decide (my suggestion: a question back) | No earlier message reaches the router (R7) | — |
| G2 | `Make that one £3.50 instead.` | Not set: yours to decide | The same (R7) | — |

### Cost (estimates, not limits)

- Routing has cost 2–3 credits a message in recent runs (2 in most, 3 in
  run 88).
- **All 18 in one batch: about 36–54.**
- The balance is 96. Nothing else is charged, because no edit, add-on, build
  or publish runs.
- The batch's own runtime checks run before the first paid call, and cost
  nothing.
- Building (a) and (b) costs nothing. So do the deploy for (a) and the
  batch's runtime checks.

### What it won't show

- **One answer per message.** The same message can be answered differently
  on another call. A probe that disagrees with its intended outcome should be
  repeated before any fix is built on it. That would be a second, smaller
  round, estimated after the first.
- **Routing only.** It doesn't show what each step then does. Every
  consequence further down stays *unverified*, as marked.
- **One model**: the default picker, as a customer with the default model
  gets. And two sites.

### After the readings: decisions that are yours

These findings are recorded here. None is in the backlog yet, and none is
being fixed. Which to pursue is your decision once the readings are in.
- **Frame additions (R1).** Two separate changes:
  - align the router's `nav`, `picture` and `page` examples with your policy;
  - build the missing add-on kinds (menu link, footer link and detail, header
    button, and perhaps a single line on a page).

  The order matters (R1).
- **A small addition to a page** (a line or a sentence): what the add-on step
  should make.
- **A put-back after a deletion**: whether the add-on step should be given
  the deleted entry's other fields.
- **A vague request, or one that refers back**, on a live site: whether it
  should get an honest question back at no charge, instead of the add-on step.
- **Undo**: an honest reply, or a route that restores a saved version.
- **Attachments**:
  - should the router be told a file is attached?
  - should the customer be told when an attachment can't be used?
  - should the picture step use an attached photo?
